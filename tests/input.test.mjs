import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleInput, bindBattleKeyboard } from '../outputs/logic/battle-input.js';
import { createGame, moveActor, trajectory, applyShot, sampleShot, firingAngle } from '../outputs/logic/game.js';

function setup() {
  const state = { enabled: true, moves: 0, angle: 45, power: 0, charging: false, fires: [], shortcuts: [], held: new Set() };
  const input = new BattleInput({ enabled: () => state.enabled,
    move: (direction, distance) => { state.moves += direction * distance; },
    aim: delta => { state.angle += delta; }, charge: (power, charging) => { state.power = power; state.charging = charging; },
    fire: power => state.fires.push(power), shortcut: code => state.shortcuts.push(code), held: keys => { state.held = keys; } });
  return { input, state };
}
const advance = (input, seconds, fps = 60) => { for (let i = 0; i < Math.round(seconds * fps); i++) input.tick(1 / fps); };
test('a long held arrow moves continuously and stops on release, independently of frame rate', () => {
  for (const fps of [30, 60, 144]) {
    const { input, state } = setup(); input.down('ArrowRight'); advance(input, 1, fps);
    assert.ok(Math.abs(state.moves - 76) < 0.01); input.up('ArrowRight'); advance(input, 1, fps);
    assert.ok(Math.abs(state.moves - 76) < 0.01);
    input.down('ArrowLeft'); advance(input, 1, fps); assert.ok(Math.abs(state.moves) < 0.01);
  }
});
test('aim holds are smooth, opposing arrows cancel, and auto-repeat adds no extra steps', () => {
  const { input, state } = setup(); input.down('ArrowUp'); advance(input, 0.5); const expected = state.angle;
  input.down('ArrowUp'); assert.equal(state.angle, expected);
  input.down('ArrowDown'); const heldAngle = state.angle; advance(input, 1); assert.equal(state.angle, heldAngle);
  input.up('ArrowUp'); advance(input, 0.5); assert.ok(state.angle < heldAngle - 15);
});
test('Space down never fires, release does, and longer holds produce stronger shots', () => {
  const a = setup(); a.input.down('Space'); advance(a.input, 0.4); assert.equal(a.state.fires.length, 0); a.input.up('Space');
  const b = setup(); b.input.down('Space'); advance(b.input, 1.2); b.input.up('Space');
  assert.equal(a.state.fires.length, 1); assert.equal(b.state.fires.length, 1); assert.ok(b.state.fires[0] > a.state.fires[0] * 2.5);
  a.input.up('Space'); assert.equal(a.state.fires.length, 1);
});
test('a rapid Space tap fires once even with no intervening React render or animation frame', () => {
  const { input, state } = setup(); input.down('Space'); input.up('Space'); input.up('Space'); assert.deepEqual(state.fires, [0]);
});
test('charge increases monotonically and fires exactly once at 100', () => {
  const { input, state } = setup(); input.down('Space'); let previous = 0;
  for (let i = 0; i < 180; i++) { input.tick(1 / 60); assert.ok(state.power >= previous); previous = state.power; }
  assert.deepEqual(state.fires, [100]); input.up('Space'); assert.deepEqual(state.fires, [100]);
});
test('charging locks movement and aim; cancellation never fires and clears held keys', () => {
  const { input, state } = setup(); input.down('Space'); input.down('ArrowRight'); input.down('ArrowUp'); advance(input, 1);
  assert.equal(state.moves, 0); assert.equal(state.angle, 45); input.cancel(); input.up('Space');
  assert.equal(state.charging, false); assert.equal(state.held.size, 0); assert.deepEqual(state.fires, []);
});
test('turn and modal disable cancel charging without discharging into the next turn', () => {
  const { input, state } = setup(); input.down('Space'); advance(input, 0.5); state.enabled = false; input.tick(1 / 60);
  input.up('Space'); state.enabled = true; advance(input, 1); assert.equal(state.fires.length, 0); assert.equal(state.charging, false);
});
class FakeWindow extends EventTarget { document = Object.assign(new EventTarget(), { hidden: false }); }
function key(target, type, code, options = {}) {
  const { source, ...flags } = options;
  const e = new Event(type, { cancelable: true }); Object.assign(e, { code, repeat: false, ...flags });
  if (source) Object.defineProperty(e, 'target', { value: source });
  target.dispatchEvent(e); return e;
}
test('keyboard adapter prevents page scrolling and captures keys while a range/button has focus', () => {
  const { input, state } = setup(), w = new FakeWindow(), unbind = bindBattleKeyboard(w, input);
  assert.equal(key(w, 'keydown', 'ArrowUp').defaultPrevented, true); key(w, 'keyup', 'ArrowUp'); assert.ok(state.angle > 45);
  for (const source of [{ tagName: 'INPUT', type: 'range' }, { tagName: 'BUTTON' }]) {
    assert.equal(key(w, 'keydown', 'Space', { source }).defaultPrevented, true);
    advance(input, 0.5); key(w, 'keyup', 'Space');
  }
  assert.equal(state.fires.length, 2); unbind();
});

test('text entry and disabled-game dialogs retain their native keyboard behavior', () => {
  const { input, state } = setup(), w = new FakeWindow(), unbind = bindBattleKeyboard(w, input);
  assert.equal(key(w, 'keydown', 'Space', { source: { tagName: 'INPUT', type: 'text' } }).defaultPrevented, false);
  assert.equal(state.charging, false);
  state.enabled = false;
  assert.equal(key(w, 'keydown', 'Space', { source: { tagName: 'BUTTON' } }).defaultPrevented, false);
  assert.equal(key(w, 'keydown', 'ArrowDown').defaultPrevented, false); unbind();
});
test('focus loss and hidden-tab transitions cancel all input, held repeats cannot restart it', () => {
  const { input, state } = setup(), w = new FakeWindow(), unbind = bindBattleKeyboard(w, input);
  key(w, 'keydown', 'Space'); advance(input, 0.4); w.dispatchEvent(new Event('blur'));
  key(w, 'keydown', 'Space', { repeat: true }); advance(input, 0.5); key(w, 'keyup', 'Space'); assert.equal(state.fires.length, 0);
  key(w, 'keydown', 'Space'); w.document.hidden = true; w.document.dispatchEvent(new Event('visibilitychange')); key(w, 'keyup', 'Space'); assert.equal(state.fires.length, 0); unbind();
});
test('facing is controlled by horizontal keys, including turning when energy is empty', () => {
  const g = createGame('training', 'islands'); const left = moveActor(g, -1, 0);
  assert.equal(left.actors[0].facing, -1); assert.equal(left.energy, g.energy); assert.equal(left.actors[0].x, g.actors[0].x);
  assert.ok(trajectory(left, 45, 60).impact.x < left.actors[0].x);
  const exhausted = { ...left, energy: 0 }, turned = moveActor(exhausted, 1, 20);
  assert.equal(turned.actors[0].facing, 1); assert.equal(turned.actors[0].x, exhausted.actors[0].x);
});
test('map boundaries do not consume movement energy and steep walls block climbing', () => {
  const g = createGame('training', 'islands'); g.actors[0].x = 45; g.actors[0].facing = -1;
  assert.equal(moveActor(g, -1, 20).energy, g.energy);
  g.terrain[46] = 350; const blocked = moveActor(g, 1, 1); assert.equal(blocked.actors[0].x, 45); assert.equal(blocked.energy, g.energy);
});
test('last-shot markers record exact angle/power/wind and terrain adjusts launch angle', () => {
  const g = createGame('training', 'islands'); const shot = trajectory(g, 55, 70); const result = applyShot(g, shot);
  assert.deepEqual(result.lastShots[0], { angle: 55, power: 70, wind: 0, facing: 1 }); assert.notEqual(firingAngle(g, 55), 55);
});
test('animation sampling is safe before the first frame, at the end, and for empty paths', () => {
  const shot = trajectory(createGame('training', 'islands'), 45, 70);
  for (const progress of [-0.5, 0, 0.2, 0.999, 1, 2, NaN]) { const sample = sampleShot(shot, progress); assert.ok(Number.isFinite(sample.point.x)); assert.ok(Number.isFinite(sample.point.y)); }
  assert.deepEqual(sampleShot({ ...shot, points: [] }, 1).point, shot.impact);
});
