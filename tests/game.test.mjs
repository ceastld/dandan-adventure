import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, trajectory, applyShot, moveActor, useItem, aiAim, ground, MAPS, WIDTH, HEIGHT } from '../outputs/logic/game.js';

const center = () => 0.5;
test('nearby opponents are detected even during the first milliseconds of a fast shot', () => {
  const g = createGame('duel', 'islands');
  g.actors[1].x = 268; g.actors[1].y = ground(g.terrain, 268) - 28;
  assert.equal(trajectory(g, 10, 100).direct, 1);
});
test('wind changes landing direction and simulation terminates for extreme shots', () => {
  const g = createGame('training', 'islands');
  const left = trajectory({ ...g, wind: -3 }, 45, 55), right = trajectory({ ...g, wind: 3 }, 45, 55);
  assert.ok(right.impact.x > left.impact.x + 30);
  for (const angle of [10, 45, 85]) for (const power of [10, 100]) {
    const shot = trajectory(g, angle, power);
    assert.ok(shot.points.length < 602); assert.ok(Number.isFinite(shot.impact.x)); assert.ok(Number.isFinite(shot.impact.y));
  }
});
test('all map/loadout combinations allow AI to hit the other actor', () => {
  for (const map of MAPS) for (let weapon = 0; weapon < 3; weapon++) for (let hero = 0; hero < 3; hero++) {
    const g = createGame('adventure', map.id, hero, weapon);
    for (const active of [0, 1]) {
      const state = { ...g, active }, aim = aiAim(state, center), shot = trajectory(state, aim.angle, aim.power), target = state.actors[1 - active];
      assert.ok(Math.hypot(shot.impact.x - target.x, shot.impact.y - target.y) < 80, `${map.id} hero ${hero} weapon ${weapon} active ${active}`);
    }
  }
});
test('movement consumes energy, follows terrain and refuses actions during flight', () => {
  let g = createGame('adventure', 'islands'); const originalX = g.actors[0].x;
  for (let i = 0; i < 12; i++) g = moveActor(g, 1);
  assert.equal(g.energy, 0); assert.equal(g.actors[0].x, originalX + 144);
  assert.equal(g.actors[0].y, ground(g.terrain, g.actors[0].x) - 28);
  assert.equal(moveActor(g, 1), g);
  const flying = { ...g, phase: 'flying', energy: 60 };
  assert.equal(moveActor(flying, -1), flying); assert.equal(useItem(flying, 'shield'), flying);
});
test('equipment alters actual health, initial shield and damage', () => {
  const attack = createGame('training', 'islands', 0, 0, 0), hp = createGame('training', 'islands', 0, 0, 1), shield = createGame('training', 'islands', 0, 0, 2);
  assert.equal(hp.actors[0].maxHp, attack.actors[0].maxHp + 20); assert.equal(shield.actors[0].shield, 25);
  const aim = aiAim(attack, center);
  const attackResult = applyShot(attack, trajectory(attack, aim.angle, aim.power), center);
  const hpResult = applyShot(hp, trajectory(hp, aim.angle, aim.power), center);
  assert.ok(attackResult.actors[1].hp < hpResult.actors[1].hp);
});
test('shield absorbs damage first, heal caps at maxHP, charges and energy are enforced', () => {
  let g = createGame('duel', 'islands');
  assert.equal(useItem(g, 'heal'), g);
  g.actors[0].hp -= 10;
  const healed = useItem(g, 'heal'); assert.equal(healed.actors[0].hp, healed.actors[0].maxHp); assert.equal(healed.actors[0].heals, 1); assert.equal(healed.energy, 35);
  const guarded = useItem(healed, 'shield'); assert.equal(guarded.actors[0].shield, 30); assert.equal(guarded.actors[0].guards, 1); assert.equal(guarded.energy, 10); assert.equal(useItem(guarded, 'shield'), guarded);
  guarded.active = 1;
  const aim = aiAim(guarded, center), result = applyShot(guarded, trajectory(guarded, aim.angle, aim.power), center);
  assert.equal(result.actors[0].shield, 0); assert.ok(result.actors[0].hp > guarded.actors[0].hp - 40);
});
test('explosions destroy terrain without mutating original state or generating invalid heights', () => {
  const g = createGame('training', 'islands', 0, 2); const snapshot = JSON.stringify(g);
  const shot = trajectory(g, 45, 40), result = applyShot(g, shot, center);
  assert.equal(JSON.stringify(g), snapshot); assert.ok(result.terrain.some((v, i) => v > g.terrain[i]));
  assert.ok(result.terrain.every(v => Number.isFinite(v) && v <= HEIGHT - 12)); assert.equal(result.terrain.length, WIDTH + 1);
});
test('boost increases actual damage and ice removes half of the incoming turn energy', () => {
  const g = createGame('duel', 'islands', 0, 1), aim = aiAim(g, center);
  const normal = applyShot(g, trajectory(g, aim.angle, aim.power), center), boost = applyShot(g, trajectory(g, aim.angle, aim.power, 'boost'), center);
  assert.ok(boost.actors[1].hp < normal.actors[1].hp); assert.equal(normal.active, 1); assert.equal(normal.energy, 30);
});
test('training keeps player control with zero wind; duel alternates turns', () => {
  for (const mode of ['training', 'duel']) {
    const g = createGame(mode, 'moon'), next = applyShot(g, trajectory(g, 85, 10), () => 1);
    assert.equal(next.active, mode === 'training' ? 0 : 1); assert.equal(next.round, 2);
    if (mode === 'training') assert.equal(next.wind, 0); else assert.equal(next.wind, 3.1);
  }
});
test('complete AI-driven games terminate with valid HP and winner on every map', () => {
  for (const map of MAPS) {
    let g = createGame('adventure', map.id), count = 0;
    while (g.phase !== 'over' && count++ < 61) { const aim = aiAim(g, center); g = applyShot(g, trajectory(g, aim.angle, aim.power), center); }
    assert.equal(g.phase, 'over'); assert.ok(count <= 60); assert.ok(g.actors.every(a => a.hp >= 0 && a.hp <= a.maxHp)); assert.ok([0, 1, null].includes(g.winner));
    console.log(`${map.name}: ${count} shots, winner ${g.winner}, HP ${g.actors.map(a => a.hp).join('/')}`);
  }
});
test('the 60-turn limit gives draw for equal health and winner for higher health', () => {
  const g = createGame('duel', 'islands'); g.round = 60; g.actors[0].hp = 90; g.actors[1].hp = 90;
  const miss = { points: [], impact: { x: -100, y: 400 }, direct: null, owner: 0, skill: 'normal', weapon: 0 };
  assert.equal(applyShot(g, miss).winner, null); g.actors[1].hp = 10; assert.equal(applyShot(g, miss).winner, 0);
});
