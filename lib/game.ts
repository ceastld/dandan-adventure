export const WIDTH = 1200, HEIGHT = 640;
export type Mode = 'adventure' | 'training' | 'duel';
export type MapId = 'islands' | 'sunset' | 'moon';
export type Skill = 'normal' | 'boost';
export const HEROES = [
  { name: '晴晴', title: '追风冒险家', text: '把勇气装进炮膛，今天也要漂亮地出发！', color: '#ff9c37', hp: 150, attack: 1, trait: '元气满满', detail: '生命值 +10' },
  { name: '凛夜', title: '星月巡航员', text: '风的方向，就是下一颗流星的方向。', color: '#8b80e5', hp: 140, attack: 1.1, trait: '精准射击', detail: '伤害 +10%' },
  { name: '小芽', title: '森野治愈师', text: '带上小太阳，让冒险开出花来。', color: '#5bbd93', hp: 160, attack: 0.95, trait: '森林祝福', detail: '生命值 +20 · 伤害 −5%' },
] as const;
export const WEAPONS = [
  { name: '橘子汽水', subtitle: '每一发，都元气十足', tag: '均衡型', damage: 39, radius: 58, color: '#ff9d36', desc: '稳定的伤害和爆炸范围，适合找到你的第一条完美抛物线。' },
  { name: '极光冰晶', subtitle: '来自极地的一束流光', tag: '精准型', damage: 48, radius: 40, color: '#64a7ea', desc: '较小的爆炸范围换来更高伤害。命中后减少对手下一回合的体力。' },
  { name: '向日葵号', subtitle: '阳光，也可以很有力量', tag: '范围型', damage: 32, radius: 83, color: '#85b85a', desc: '宽广的爆炸范围，擅长破坏地形，让远处的对手无处藏身。' },
] as const;
export const EQUIPMENT = [
  { name: '逐风护目镜', tag: '攻击', desc: '攻击伤害 +8%', color: '#e8b255' },
  { name: '云游披风', tag: '防御', desc: '最大生命 +20', color: '#64b9b0' },
  { name: '星愿吊坠', tag: '守护', desc: '开场获得 25 护盾', color: '#a899df' },
] as const;
export const MAPS = [
  { id: 'islands' as MapId, name: '风铃浮岛', en: 'WINDMILL ISLES', desc: '微风与绿野之间', wind: 1.2, label: '晴空 · 轻风' },
  { id: 'sunset' as MapId, name: '落日峡谷', en: 'SUNSET CANYON', desc: '追逐最后一束阳光', wind: 2.3, label: '黄昏 · 阵风' },
  { id: 'moon' as MapId, name: '星眠之境', en: 'MOONLIT GARDEN', desc: '让星光指引弹道', wind: 3.1, label: '星夜 · 强风' },
] as const;
export interface Actor { x: number; y: number; hp: number; maxHp: number; shield: number; hero: number; weapon: number; equipment: number; heals: number; guards: number; slow: boolean; }
export interface GameState { terrain: number[]; actors: [Actor, Actor]; active: 0 | 1; round: number; wind: number; mode: Mode; map: MapId; phase: 'aim' | 'flying' | 'over'; winner: 0 | 1 | null; energy: number; message: string; }
export interface Point { x: number; y: number; }
export interface Shot { points: Point[]; impact: Point; direct: number | null; owner: 0 | 1; skill: Skill; weapon: number; }
export function ground(terrain: number[], x: number) { return terrain[Math.max(0, Math.min(WIDTH, Math.round(x)))] ?? HEIGHT; }
export function terrainFor(map: MapId) {
  return Array.from({ length: WIDTH + 1 }, (_, x) => {
    const rolling = Math.sin(x / 95) * 15 + Math.sin(x / 230 + 1) * 21;
    return map === 'sunset' ? 475 + rolling + Math.sin(x / 135) * 30 : map === 'moon' ? 470 + rolling + Math.cos(x / 190) * 18 : 480 + rolling;
  });
}
export function createGame(mode: Mode, map: MapId, hero = 0, weapon = 0, equipment = 0): GameState {
  const terrain = terrainFor(map);
  const actor = (x: number, h: number, w: number, e: number): Actor => ({ x, y: ground(terrain, x) - 28, hero: h, weapon: w, equipment: e, maxHp: HEROES[h].hp + (e === 1 ? 20 : 0), hp: HEROES[h].hp + (e === 1 ? 20 : 0), shield: e === 2 ? 25 : 0, heals: 2, guards: 2, slow: false });
  return { terrain, actors: [actor(200, hero, weapon, equipment), actor(1000, (hero + 1) % 3, (weapon + 1) % 3, 1)], active: 0, round: 1, wind: mode === 'training' ? 0 : 0.8, mode, map, phase: 'aim', winner: null, energy: 60, message: mode === 'training' ? '训练开始：目标不会反击，试着命中它！' : '你的回合，观察风向后出发吧！' };
}
export function trajectory(g: GameState, angle: number, power: number, skill: Skill = 'normal'): Shot {
  const actor = g.actors[g.active], other = g.actors[1 - g.active];
  const direction = other.x >= actor.x ? 1 : -1, radians = angle * Math.PI / 180;
  const velocity = 235 + Math.max(10, Math.min(100, power)) * 5.3;
  let x = actor.x + direction * 24, y = actor.y - 22, vx = Math.cos(radians) * velocity * direction, vy = -Math.sin(radians) * velocity;
  const points: Point[] = [{ x, y }]; let direct: number | null = null;
  const dt = 1 / 120;
  for (let step = 0; step < 1800; step++) {
    vx += g.wind * 10 * dt; vy += 390 * dt; x += vx * dt; y += vy * dt;
    if (step % 3 === 0) points.push({ x, y });
    const hit = g.actors.findIndex((a, i) => (i !== g.active || step > 70) && Math.hypot(x - a.x, y - a.y) < 28);
    if (hit >= 0) { direct = hit; break; }
    if (x < -50 || x > WIDTH + 50 || y > HEIGHT + 30) break;
    if (x >= 0 && x <= WIDTH && y >= ground(g.terrain, x)) break;
  }
  points.push({ x, y });
  return { points, impact: { x, y }, direct, owner: g.active, skill, weapon: actor.weapon };
}
export function applyShot(g: GameState, shot: Shot, random = Math.random): GameState {
  const state: GameState = { ...g, terrain: [...g.terrain], actors: g.actors.map(a => ({ ...a })) as [Actor, Actor] };
  const weapon = WEAPONS[shot.weapon], radius = weapon.radius * (shot.skill === 'boost' ? 1.2 : 1), shooter = state.actors[shot.owner];
  const damage = weapon.damage * HEROES[shooter.hero].attack * (shooter.equipment === 0 ? 1.08 : 1) * (shot.skill === 'boost' ? 1.5 : 1);
  let damageDealt = 0;
  state.actors.forEach((a, i) => {
    const distance = Math.hypot(a.x - shot.impact.x, a.y - shot.impact.y);
    if (distance < radius + 28 || shot.direct === i) {
      const raw = Math.round(damage * (shot.direct === i ? 1.15 : Math.max(0.15, 1 - Math.max(0, distance - 28) / (radius + 10))));
      const absorbed = Math.min(a.shield, raw); a.shield -= absorbed; a.hp = Math.max(0, a.hp - raw + absorbed);
      if (i !== shot.owner) damageDealt += raw;
      if (shot.weapon === 1 && raw > 0) a.slow = true;
    }
  });
  if (shot.impact.x >= 0 && shot.impact.x <= WIDTH && shot.impact.y < HEIGHT) {
    for (let x = Math.max(0, Math.floor(shot.impact.x - radius)); x <= Math.min(WIDTH, Math.ceil(shot.impact.x + radius)); x++) {
      const depth = Math.sqrt(Math.max(0, radius * radius - (x - shot.impact.x) ** 2));
      state.terrain[x] = Math.min(HEIGHT - 12, Math.max(state.terrain[x], shot.impact.y + depth));
    }
  }
  state.actors.forEach(a => { const oldY = a.y; a.y = ground(state.terrain, a.x) - 28; if (a.y - oldY > 85) a.hp = Math.max(0, a.hp - Math.round((a.y - oldY - 70) * 0.5)); });
  const dead = state.actors.map(a => a.hp <= 0);
  if (dead.some(Boolean) || g.round >= 60) {
    state.phase = 'over'; state.winner = dead[0] && dead[1] ? null : dead[0] ? 1 : dead[1] ? 0 : state.actors[0].hp === state.actors[1].hp ? null : state.actors[0].hp > state.actors[1].hp ? 0 : 1;
    state.message = state.winner === null ? '势均力敌，平局！' : `${HEROES[state.actors[state.winner].hero].name}获得胜利！`; return state;
  }
  state.active = g.mode === 'training' ? 0 : (1 - g.active) as 0 | 1; state.round = g.round + 1;
  const strength = MAPS.find(m => m.id === state.map)!.wind;
  state.wind = g.mode === 'training' ? 0 : Math.round((random() * 2 - 1) * strength * 10) / 10;
  state.energy = state.actors[state.active].slow ? 30 : 60; state.actors[state.active].slow = false; state.phase = 'aim';
  state.message = damageDealt ? `漂亮！造成 ${damageDealt} 点伤害` : '擦肩而过，再调整一下角度与力度'; return state;
}
export function moveActor(g: GameState, direction: number): GameState {
  if (g.phase !== 'aim' || g.energy < 5) return g;
  const a = g.actors[g.active], enemy = g.actors[1 - g.active], x = Math.max(45, Math.min(WIDTH - 45, a.x + direction * 12));
  if (Math.abs(x - enemy.x) < 65) return g;
  const actors = g.actors.map(a => ({ ...a })) as [Actor, Actor]; actors[g.active].x = x; actors[g.active].y = ground(g.terrain, x) - 28;
  return { ...g, actors, energy: g.energy - 5 };
}
export function useItem(g: GameState, item: 'heal' | 'shield'): GameState {
  if (g.phase !== 'aim' || g.energy < 25) return g;
  const a = g.actors[g.active]; if ((item === 'heal' && (!a.heals || a.hp === a.maxHp)) || (item === 'shield' && !a.guards)) return g;
  const actors = g.actors.map(a => ({ ...a })) as [Actor, Actor], target = actors[g.active];
  if (item === 'heal') { target.hp = Math.min(target.maxHp, target.hp + 35); target.heals--; } else { target.shield += 30; target.guards--; }
  return { ...g, actors, energy: g.energy - 25, message: item === 'heal' ? '恢复了 35 点生命' : '获得 30 点护盾' };
}
export function aiAim(g: GameState, random = Math.random) {
  const target = g.actors[1 - g.active]; let best = { angle: 45, power: 65, score: Infinity };
  for (let angle = 22; angle <= 78; angle += 4) for (let power = 20; power <= 100; power += 3) {
    const shot = trajectory(g, angle, power), score = Math.hypot(shot.impact.x - target.x, shot.impact.y - target.y) - (shot.direct === 1 - g.active ? 40 : 0);
    if (score < best.score) best = { angle, power, score };
  }
  return { angle: best.angle, power: Math.max(10, Math.min(100, best.power + (random() - 0.5) * 7)) };
}
