import { useEffect, useRef, type PointerEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  CircleHelp,
  Wind,
  Heart,
  Shield,
  Flame,
  Crosshair,
  Zap,
  Timer,
  SkipForward,
  Volume2,
  VolumeX,
  Keyboard,
  Flag,
} from 'lucide-react';
import {
  HEROES,
  WEAPONS,
  MAPS,
  WIDTH,
  HEIGHT,
  firingAngle,
  slopeAt,
  type GameState,
  type Shot,
  type Skill,
} from '@/lib/game';
import BattleCanvas from './battle-canvas';

type Props = {
  game: GameState;
  shot: Shot | null;
  shotProgress: number;
  effect: { x: number; y: number; tick: number } | null;
  angle: number;
  power: number;
  charging: boolean;
  held: Set<string>;
  guide: boolean;
  canAct: boolean;
  handoff: boolean;
  sound: boolean;
  seconds: number;
  skill: Skill;
  onDown: (code: string) => void;
  onUp: (code: string) => void;
  onCancel: () => void;
  onAim: (angle: number) => void;
  onItem: (item: string) => void;
  onGuide: () => void;
  onSound: () => void;
  onQuit: () => void;
  onHelp: () => void;
  onHandoff: () => void;
};
const src = (file: string) => `./assets/${file}.webp`;

export default function ClassicBattle(p: Props) {
  const arena = useRef<HTMLElement>(null),
    g = p.game,
    a = g.actors[g.active];
  const last = g.lastShots[g.active],
    actualAngle = firingAngle(g, p.angle);
  const human = g.mode !== 'adventure' || g.active === 0;
  const moving = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].some((k) =>
    p.held.has(k),
  );
  useEffect(() => {
    if (p.canAct) arena.current?.focus({ preventScroll: true });
  }, [p.canAct]);
  const hold = (code: string) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (!p.canAct) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      p.onDown(code);
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      p.onUp(code);
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
      arena.current?.focus({ preventScroll: true });
    },
    onPointerCancel: p.onCancel,
  });
  return (
    <main
      className="classic-battle"
      ref={arena}
      tabIndex={0}
      aria-label="弹弹堂经典键盘战场"
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest('button,input,a'))
          arena.current?.focus({ preventScroll: true });
      }}
      data-phase={g.phase}
      data-round={g.round}
      data-active={g.active}
      data-x={a.x.toFixed(2)}
      data-facing={a.facing}
      data-angle={p.angle.toFixed(2)}
      data-power={p.power.toFixed(2)}
      data-charging={p.charging}
    >
      <div className="classic-topline">
        <button onClick={p.onQuit}>
          <ChevronLeft size={17} />
          退出对战
        </button>
        <div>
          <b>{MAPS.find((m) => m.id === g.map)?.name}</b>
          <span>
            {g.mode === 'training'
              ? '练习靶场'
              : g.mode === 'duel'
                ? '同屏双人'
                : '经典对战 · AI'}
          </span>
        </div>
        <div className="battle-top-actions">
          <button
            onClick={p.onSound}
            aria-label={p.sound ? '关闭音效' : '开启音效'}
          >
            {p.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button onClick={p.onHelp}>
            <CircleHelp size={17} />
            操作说明
          </button>
        </div>
      </div>
      <div className="classic-world-wrap">
        <section className={`battle-arena classic-world map-${g.map}`}>
          <div
            className="battle-background"
            style={{ backgroundImage: `url(${src('islands')})` }}
          />
          <div className="battle-sky-wash" />
          <div className="classic-hud">
            {g.actors.map((actor, i) => (
              <div
                key={i}
                className={`classic-player player-${i} ${g.active === i ? 'active' : ''}`}
              >
                <div className="classic-avatar">
                  <img src={src(`hero-${actor.hero}`)} alt="" />
                </div>
                <div>
                  <div className="player-name">
                    <b>{HEROES[actor.hero].name}</b>
                    <span>
                      {i === 0 ? 'P1' : g.mode === 'duel' ? 'P2' : 'AI'}
                    </span>
                  </div>
                  <div className="classic-hp">
                    <i
                      style={{ width: `${(actor.hp / actor.maxHp) * 100}%` }}
                    />
                  </div>
                  <span className="classic-hp-text">
                    {actor.hp} / {actor.maxHp} HP
                    {actor.shield > 0 && (
                      <span>
                        <Shield size={11} />
                        {actor.shield}
                      </span>
                    )}
                  </span>
                </div>
                <img
                  className="player-weapon"
                  src={src(`item-${actor.weapon}`)}
                  alt={WEAPONS[actor.weapon].name}
                />
              </div>
            ))}
          </div>
          <div className="classic-turn">
            <span>第 {g.round} 回合</span>
            <strong>
              {g.phase === 'aim'
                ? g.mode === 'training'
                  ? '∞'
                  : Math.ceil(p.seconds)
                : '…'}
            </strong>
            <div
              className={
                Math.ceil(p.seconds) <= 8 && g.mode !== 'training'
                  ? 'urgent'
                  : ''
              }
            >
              <Timer size={13} />
              {g.phase === 'flying'
                ? '炮弹飞行中'
                : human
                  ? '你的操作时间'
                  : '对手的回合'}
            </div>
          </div>
          <div className="classic-wind">
            <Wind size={20} />
            <b>
              {g.wind < 0 ? '←' : '→'} {Math.abs(g.wind).toFixed(1)}
            </b>
            <span>
              上回合 {g.previousWind < 0 ? '←' : '→'}{' '}
              {Math.abs(g.previousWind).toFixed(1)}
            </span>
          </div>
          <BattleCanvas
            game={g}
            shot={p.shot}
            shotProgress={p.shotProgress}
            angle={p.angle}
            power={p.power}
            guide={p.guide && human}
            effect={p.effect}
            onAim={(angle) => {
              if (p.canAct && !p.charging && g.mode === 'training')
                p.onAim(angle);
            }}
          />
          {g.actors.map((actor, i) => (
            <div
              className={`classic-actor ${g.active === i && moving && p.canAct ? 'walking' : ''} ${p.charging && i === g.active ? 'is-charging' : ''} ${actor.hp <= 0 ? 'is-defeated' : ''}`}
              key={i}
              style={{
                left: `${(actor.x / WIDTH) * 100}%`,
                top: `${((actor.y + 28) / HEIGHT) * 100}%`,
              }}
            >
              <span className="actor-nameplate">
                {i === g.active && g.phase === 'aim' && <i />}
                {HEROES[actor.hero].name}
              </span>
              <div
                className="actor-body"
                style={{
                  transform: `scaleX(${actor.facing}) rotate(${-Math.max(-22, Math.min(22, slopeAt(g, actor))) * actor.facing}deg)`,
                }}
              >
                <img
                  src={src(`hero-${actor.hero}`)}
                  alt={HEROES[actor.hero].name}
                />
              </div>
              {actor.shield > 0 && <span className="shield-bubble" />}
              {p.charging && i === g.active && (
                <span className="actor-charge">
                  <i style={{ width: `${p.power}%` }} />
                </span>
              )}
            </div>
          ))}
          {p.effect && (
            <div
              className="hit-impact"
              key={p.effect.tick}
              style={{
                left: `${Math.max(7, Math.min(93, (p.effect.x / WIDTH) * 100))}%`,
                top: `${Math.max(20, (p.effect.y / HEIGHT) * 100 - 12)}%`,
              }}
            >
              {g.message.includes('造成')
                ? g.message.match(/\d+/)?.[0]
                : 'BOOM!'}
            </div>
          )}
          <div className="classic-world-status">
            {g.phase === 'flying'
              ? '观察落点，下回合修正角度和力度'
              : p.charging
                ? '松开空格，即刻发射！'
                : human
                  ? '← → 走位转身　↑ ↓ 瞄准　按住空格蓄力'
                  : '对手正在瞄准…'}
          </div>
          {p.handoff && (
            <div className="arena-overlay">
              <div className="handoff-card">
                <Flag size={30} />
                <h2>
                  轮到 P{g.active + 1} · {HEROES[a.hero].name}
                </h2>
                <p>交接操作后再开始计时</p>
                <button className="primary-button" onClick={p.onHandoff}>
                  准备好了，开始回合
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      <div className="classic-console">
        <div className="console-upper">
          <div className="angle-instrument">
            <svg
              viewBox="0 0 180 116"
              aria-label={`当前角度${Math.round(p.angle)}度`}
            >
              <path
                d="M16 96 A74 74 0 0 1 164 96"
                fill="none"
                stroke="#638ca033"
                strokeWidth="17"
              />
              {Array.from({ length: 19 }, (_, i) => {
                const angle = (i * Math.PI) / 18,
                  long = i % 3 === 0;
                return (
                  <line
                    key={i}
                    x1={90 + Math.cos(angle) * (long ? 61 : 68)}
                    y1={96 - Math.sin(angle) * (long ? 61 : 68)}
                    x2={90 + Math.cos(angle) * 77}
                    y2={96 - Math.sin(angle) * 77}
                    stroke={long ? '#7395a6' : '#a3b8c3'}
                    strokeWidth={long ? 2 : 1}
                  />
                );
              })}
              <text x="10" y="111">
                180
              </text>
              <text x="84" y="15">
                90
              </text>
              <text x="164" y="111">
                0
              </text>
              {last && (
                <line
                  x1="90"
                  y1="96"
                  x2={90 + Math.cos((last.angle * Math.PI) / 180) * 64}
                  y2={96 - Math.sin((last.angle * Math.PI) / 180) * 64}
                  stroke="#d98d76"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              )}
              <line
                x1="90"
                y1="96"
                x2={90 + Math.cos((p.angle * Math.PI) / 180) * 69}
                y2={96 - Math.sin((p.angle * Math.PI) / 180) * 69}
                stroke="#f4a940"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx="90" cy="96" r="6" fill="#f4a940" />
            </svg>
            <div className="angle-reading">
              <b>
                {Math.round(p.angle)}
                <small>°</small>
              </b>
              <span>发射角度</span>
            </div>
            <div className="angle-subline">
              地形修正 {Math.round(actualAngle)}°{' '}
              <span>上次 {last ? `${Math.round(last.angle)}°` : '—'}</span>
            </div>
          </div>
          <div className="direction-controls">
            <div className="direction-keyboard">
              <button
                className={
                  p.held.has('ArrowUp') || p.held.has('KeyW')
                    ? 'pressed key-up'
                    : 'key-up'
                }
                disabled={!p.canAct || p.charging}
                {...hold('ArrowUp')}
                aria-label="按住向上调角度"
              >
                <ArrowUp size={19} />
              </button>
              <button
                className={
                  p.held.has('ArrowLeft') || p.held.has('KeyA') ? 'pressed' : ''
                }
                disabled={!p.canAct || p.charging}
                {...hold('ArrowLeft')}
                aria-label="按住向左移动"
              >
                <ArrowLeft size={19} />
              </button>
              <button
                className={
                  p.held.has('ArrowDown') || p.held.has('KeyS') ? 'pressed' : ''
                }
                disabled={!p.canAct || p.charging}
                {...hold('ArrowDown')}
                aria-label="按住向下调角度"
              >
                <ArrowDown size={19} />
              </button>
              <button
                className={
                  p.held.has('ArrowRight') || p.held.has('KeyD')
                    ? 'pressed'
                    : ''
                }
                disabled={!p.canAct || p.charging}
                {...hold('ArrowRight')}
                aria-label="按住向右移动"
              >
                <ArrowRight size={19} />
              </button>
            </div>
            <span>长按移动 / 调角度</span>
            <div className="classic-energy">
              <Zap size={12} />
              <i>
                <em style={{ width: `${(g.energy / 60) * 100}%` }} />
              </i>
              <b>{Math.ceil(g.energy)}</b>
            </div>
          </div>
          <div className="classic-tools">
            <div className="tools-heading">
              <span>战斗道具</span>
              <small>数字键快捷使用</small>
            </div>
            <div className="tool-buttons">
              <button
                disabled={!p.canAct || p.charging || g.energy < 25}
                className={p.skill === 'boost' ? 'chosen' : ''}
                onClick={() => p.onItem('Digit1')}
              >
                <kbd>1</kbd>
                <Flame size={23} />
                <b>强力弹</b>
                <small>伤害 +50%</small>
              </button>
              <button
                disabled={
                  !p.canAct ||
                  p.charging ||
                  g.energy < 25 ||
                  !a.heals ||
                  a.hp === a.maxHp
                }
                onClick={() => p.onItem('Digit2')}
              >
                <kbd>2</kbd>
                <Heart size={23} />
                <b>治疗</b>
                <small>剩余 {a.heals} 次</small>
              </button>
              <button
                disabled={!p.canAct || p.charging || g.energy < 25 || !a.guards}
                onClick={() => p.onItem('Digit3')}
              >
                <kbd>3</kbd>
                <Shield size={23} />
                <b>护盾</b>
                <small>剩余 {a.guards} 次</small>
              </button>
              <button
                disabled={!p.canAct || p.charging}
                onClick={() => p.onItem('KeyP')}
              >
                <kbd>P</kbd>
                <SkipForward size={23} />
                <b>结束回合</b>
                <small>蓄势待发</small>
              </button>
            </div>
          </div>
          <div className="classic-fire-wrap">
            <button
              className={`classic-fire ${p.charging ? 'charging' : ''}`}
              disabled={!p.canAct}
              {...hold('Space')}
              aria-label="按住蓄力，松开发射"
            >
              <Crosshair size={26} />
              <b>
                {p.charging
                  ? '松手发射'
                  : g.phase === 'flying'
                    ? '飞行中'
                    : !human
                      ? '等待对手'
                      : '按住蓄力'}
              </b>
              <span>SPACE / 鼠标长按</span>
            </button>
            <button
              className={`classic-guide ${p.guide ? 'on' : ''}`}
              onClick={p.onGuide}
            >
              <Crosshair size={12} />
              {p.guide ? '轨迹辅助：开' : '轨迹辅助：关'}
            </button>
          </div>
        </div>
        <div className="power-dashboard">
          <div className="power-heading">
            <span>
              <Keyboard size={16} />
              <b>力度</b>
              <strong>
                {p.power.toFixed(0)}
                <small>%</small>
              </strong>
            </span>
            <span className="power-reminder">
              {p.charging
                ? '持续蓄力中… 松开空格发射，满格自动发射'
                : last
                  ? `上一发：${last.angle.toFixed(0)}° / ${last.power.toFixed(0)} 力度`
                  : '按住空格，观察力度条；松手发射'}
            </span>
          </div>
          <div
            className="classic-power"
            role="meter"
            aria-label="蓄力力度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(p.power)}
          >
            <div className="power-fill" style={{ width: `${p.power}%` }} />
            {last && (
              <i
                className="last-power-marker"
                style={{ left: `${last.power}%` }}
              >
                <span>上次</span>
              </i>
            )}
            <i className="power-needle" style={{ left: `${p.power}%` }} />
            <div className="power-tick-marks">
              {Array.from({ length: 51 }, (_, i) => (
                <i key={i} className={i % 5 === 0 ? 'major' : ''} />
              ))}
            </div>
          </div>
          <div className="power-numbers">
            {Array.from({ length: 11 }, (_, i) => (
              <span key={i}>{i * 10}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="classic-bottom-status" role="status">
        <span>{g.message}</span>
        <span>
          {g.mode === 'training'
            ? '靶场无风、无倒计时，对手不还击'
            : '方向由你决定 · 风力每回合变化'}{' '}
          · 经典操作 v1.1
        </span>
      </div>
    </main>
  );
}
