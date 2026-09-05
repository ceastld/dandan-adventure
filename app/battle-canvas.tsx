import { useEffect, useRef } from 'react';
import { WIDTH, HEIGHT, WEAPONS, trajectory, type GameState, type Shot } from '@/lib/game';
export default function BattleCanvas({ game, shot, shotProgress, angle, power, guide, effect, onAim }: { game: GameState; shot: Shot | null; shotProgress: number; angle: number; power: number; guide: boolean; effect: { x: number; y: number; tick: number } | null; onAim: (angle: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const path = () => { ctx.beginPath(); ctx.moveTo(0, HEIGHT); game.terrain.forEach((y, x) => { if (x % 2 === 0) ctx.lineTo(x, y); }); ctx.lineTo(WIDTH, HEIGHT); ctx.closePath(); };
    const earth = ctx.createLinearGradient(0, 440, 0, 640); earth.addColorStop(0, game.map === 'moon' ? '#707ba1' : '#dbad74'); earth.addColorStop(1, game.map === 'moon' ? '#444d7b' : '#ac724f');
    path(); ctx.fillStyle = earth; ctx.fill(); ctx.save(); path(); ctx.clip(); ctx.fillStyle = game.map === 'moon' ? '#98a4c045' : '#f7dcb866';
    for (let i = 0; i < 115; i++) { const x = (i * 179 + 27) % WIDTH, y = 420 + (i * 53) % 230; ctx.beginPath(); ctx.ellipse(x, y, 6 + i % 10, 3 + i % 6, i, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore(); ctx.beginPath(); game.terrain.forEach((y, x) => { if (x % 2 === 0) { if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } });
    ctx.strokeStyle = game.map === 'moon' ? '#7ca7b9' : '#569854'; ctx.lineWidth = 13; ctx.stroke(); ctx.strokeStyle = game.map === 'moon' ? '#a2d6d4' : '#a6d570'; ctx.lineWidth = 6; ctx.stroke();
    if (guide && game.phase === 'aim') {
      const prediction = trajectory(game, angle, power); ctx.beginPath(); prediction.points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.setLineDash([3, 13]); ctx.lineCap = 'round'; ctx.strokeStyle = '#ffffffd9'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
      const p = prediction.impact;
      if (p.x >= 0 && p.x <= WIDTH) { ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x - 19, p.y); ctx.lineTo(p.x + 19, p.y); ctx.moveTo(p.x, p.y - 19); ctx.lineTo(p.x, p.y + 19); ctx.stroke(); }
    }
    if (shot) {
      const index = Math.min(shot.points.length - 1, Math.floor(shotProgress * (shot.points.length - 1)));
      for (let i = Math.max(0, index - 12); i <= index; i++) { const p = shot.points[i]; ctx.beginPath(); ctx.arc(p.x, p.y, 3 + (i - index + 12) * 0.55, 0, Math.PI * 2); ctx.fillStyle = `${WEAPONS[shot.weapon].color}${Math.round((i - index + 13) / 13 * 255).toString(16).padStart(2, '0')}`; ctx.fill(); }
      const p = shot.points[index]; ctx.beginPath(); ctx.arc(p.x, p.y, shot.skill === 'boost' ? 13 : 9, 0, Math.PI * 2); ctx.fillStyle = '#fff7ce'; ctx.shadowColor = '#ffb339'; ctx.shadowBlur = 20; ctx.fill(); ctx.shadowBlur = 0;
    }
    if (effect) {
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 45, 0, Math.PI * 2); const glow = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, 55); glow.addColorStop(0, '#ffffffdd'); glow.addColorStop(0.4, '#ffefad99'); glow.addColorStop(1, '#ffa73e00'); ctx.fillStyle = glow; ctx.fill();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.arc(effect.x + Math.cos(a) * (28 + i % 3 * 12), effect.y + Math.sin(a) * (28 + i % 3 * 12), 3 + i % 3, 0, Math.PI * 2); ctx.fillStyle = i % 2 ? '#fff' : '#ffc45c'; ctx.fill(); }
    }
  }, [game, shot, shotProgress, angle, power, guide, effect]);
  return <canvas ref={ref} width={WIDTH} height={HEIGHT} className="battle-canvas" aria-label="弹射战场：点击位置调整瞄准角度" onPointerDown={e => {
    const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * WIDTH, y = (e.clientY - r.top) / r.height * HEIGHT, a = game.actors[game.active];
    onAim(Math.max(10, Math.min(85, Math.round(Math.atan2(a.y - 22 - y, Math.abs(x - a.x)) * 180 / Math.PI))));
  }}/>;
}
