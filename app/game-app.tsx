'use client';
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
} from 'react';
import {
  Compass,
  Crosshair,
  Backpack,
  CircleHelp,
  Volume2,
  VolumeX,
  Settings2,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Swords,
  Target,
  Users,
  Wind,
  Coins,
  Star,
  Heart,
  Shield,
  Flame,
  Zap,
  Check,
  RotateCcw,
  MoveHorizontal,
  Trophy,
  Mountain,
  Flag,
  MousePointer2,
  Keyboard,
  Home,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  BattleInput,
  bindBattleKeyboard,
  type BattleInputCallbacks,
} from '@/lib/battle-input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  HEROES,
  WEAPONS,
  EQUIPMENT,
  MAPS,
  createGame,
  trajectory,
  applyShot,
  moveActor,
  nextTurn,
  useItem,
  aiAim,
  WIDTH,
  HEIGHT,
  type GameState,
  type Mode,
  type MapId,
  type Shot,
  type Skill,
} from '@/lib/game';
import ClassicBattle from './classic-battle';

export const asset = (name: string) =>
  `./assets/${name.replace(/\.png$/, '.webp')}`;
type Save = {
  hero: number;
  weapon: number;
  equipment: number;
  coins: number;
  wins: number;
  games: number;
  xp: number;
  sound: boolean;
};
const defaults: Save = {
  hero: 0,
  weapon: 0,
  equipment: 0,
  coins: 1200,
  wins: 0,
  games: 0,
  xp: 0,
  sound: true,
};
function readSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem('ddqt-save-v1') || '{}'),
      saved = { ...defaults };
    for (const key of ['hero', 'weapon', 'equipment'] as const)
      if (Number.isInteger(s[key]) && s[key] >= 0 && s[key] < 3)
        saved[key] = s[key];
    for (const key of ['coins', 'wins', 'games', 'xp'] as const)
      if (Number.isFinite(s[key]) && s[key] >= 0)
        saved[key] = Math.floor(s[key]);
    if (typeof s.sound === 'boolean') saved.sound = s.sound;
    return saved;
  } catch {
    return { ...defaults };
  }
}
function HeroArt({
  hero,
  className = '',
}: {
  hero: number;
  className?: string;
}) {
  return (
    <img
      src={asset(`hero-${hero}.png`)}
      alt={`${HEROES[hero].name}角色立绘`}
      className={`hero-art ${className}`}
      draggable={false}
    />
  );
}
function ItemArt({
  item,
  className = '',
}: {
  item: number;
  className?: string;
}) {
  return (
    <img
      src={asset(`item-${item}.png`)}
      alt={item < 3 ? WEAPONS[item].name : EQUIPMENT[item - 3].name}
      className={`item-art ${className}`}
      draggable={false}
    />
  );
}

export default function GameApp() {
  const [save, setSave] = useState<Save>(defaults),
    [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<'lobby' | 'battle'>('lobby');
  const [modal, setModal] = useState<
    'heroes' | 'weapons' | 'equipment' | 'help' | 'settings' | 'quit' | null
  >(null);
  const [mode, setMode] = useState<Mode>('adventure'),
    [map, setMap] = useState<MapId>('islands');
  const [game, setGame] = useState<GameState | null>(null),
    [toast, setToast] = useState('');
  const [angle, setAngle] = useState(45),
    [power, setPower] = useState(0),
    [guide, setGuide] = useState(false);
  const [skill, setSkill] = useState<Skill>('normal'),
    [charging, setCharging] = useState(false),
    [shot, setShot] = useState<Shot | null>(null);
  const [effect, setEffect] = useState<{
      x: number;
      y: number;
      tick: number;
    } | null>(null),
    [shotProgress, setShotProgress] = useState(0);
  const [held, setHeld] = useState<Set<string>>(new Set()),
    [seconds, setSeconds] = useState(30);
  const [handoff, setHandoff] = useState(false),
    [storageBlocked, setStorageBlocked] = useState(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  const firing = useRef(false),
    audioRef = useRef<AudioContext | null>(null),
    chargedRef = useRef(0),
    rewardApplied = useRef(false);
  const inputRef = useRef<BattleInput | null>(null),
    actionsRef = useRef<BattleInputCallbacks | null>(null);
  const angleRef = useRef(45),
    aimMemory = useRef<[number, number]>([45, 45]),
    secondsRef = useRef(30);
  const currentHero = HEROES[save.hero],
    currentWeapon = WEAPONS[save.weapon],
    selectedMap = MAPS.find((m) => m.id === map)!;
  const humanTurn = !!game && (game.mode !== 'adventure' || game.active === 0);
  const canAct =
    !!game && game.phase === 'aim' && humanTurn && !modal && !handoff;
  useEffect(() => {
    if (!canAct) setCharging(false);
  }, [canAct]);
  useEffect(() => {
    setSave(readSave());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem('ddqt-save-v1', JSON.stringify(save));
      } catch {
        setStorageBlocked(true);
      }
  }, [save, loaded]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const sound = useCallback(
    (type: 'click' | 'fire' | 'hit' | 'win') => {
      if (!save.sound) return;
      try {
        const ctx = audioRef.current || (audioRef.current = new AudioContext());
        void ctx.resume();
        const notes =
          type === 'win'
            ? [523, 659, 784, 1046]
            : type === 'fire'
              ? [360, 160]
              : type === 'hit'
                ? [90, 45]
                : [660];
        notes.forEach((freq, i) => {
          const o = ctx.createOscillator(),
            g = ctx.createGain();
          o.type = type === 'hit' ? 'triangle' : 'sine';
          o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
          g.gain.setValueAtTime(0, ctx.currentTime);
          g.gain.setValueAtTime(0.09, ctx.currentTime + i * 0.09);
          g.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + i * 0.09 + 0.22,
          );
          o.connect(g);
          g.connect(ctx.destination);
          o.start(ctx.currentTime + i * 0.09);
          o.stop(ctx.currentTime + i * 0.09 + 0.23);
        });
      } catch {
        /* Browsers may disable sound. */
      }
    },
    [save.sound],
  );
  function choose(key: 'hero' | 'weapon' | 'equipment', value: number) {
    setSave((s) => ({ ...s, [key]: value }));
    sound('click');
    setToast(
      `已${key === 'hero' ? '出战' : '装备'}：${key === 'hero' ? HEROES[value].name : key === 'weapon' ? WEAPONS[value].name : EQUIPMENT[value].name}`,
    );
  }
  function startBattle() {
    const g = createGame(mode, map, save.hero, save.weapon, save.equipment);
    setGame(g);
    gameRef.current = g;
    setScreen('battle');
    setAngle(45);
    angleRef.current = 45;
    aimMemory.current = [45, 45];
    setPower(0);
    chargedRef.current = 0;
    setGuide(mode === 'training');
    setSeconds(30);
    secondsRef.current = 30;
    setShot(null);
    setEffect(null);
    setSkill('normal');
    setHandoff(false);
    setModal(null);
    setCharging(false);
    firing.current = false;
    rewardApplied.current = false;
    sound('click');
  }
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const commitGame = (next: GameState) => {
    gameRef.current = next;
    setGame(next);
  };
  const changeAngle = (degrees: number) => {
    const g = gameRef.current;
    if (!g) return;
    const value = Math.max(0, Math.min(100, degrees));
    angleRef.current = value;
    aimMemory.current[g.active] = value;
    setAngle(value);
  };
  const launch = (aim: number, strength: number, ai = false) => {
    const g = gameRef.current;
    if (!g || g.phase !== 'aim' || firing.current) return;
    firing.current = true;
    const boost = !ai && skill === 'boost' && g.energy >= 25;
    const projectile = trajectory(g, aim, strength, boost ? 'boost' : 'normal');
    commitGame({ ...g, phase: 'flying', energy: g.energy - (boost ? 25 : 0) });
    inputRef.current?.cancel();
    setCharging(false);
    setShot(projectile);
    setShotProgress(0);
    setPower(strength);
    chargedRef.current = strength;
    soundRef.current('fire');
  };
  const finishTurn = (next: GameState) => {
    inputRef.current?.cancel();
    commitGame(next);
    setSkill('normal');
    setShot(null);
    firing.current = false;
    secondsRef.current = 30;
    setSeconds(30);
    angleRef.current = aimMemory.current[next.active];
    setAngle(angleRef.current);
    setPower(0);
    chargedRef.current = 0;
    if (next.mode === 'duel' && next.phase !== 'over') setHandoff(true);
  };
  const item = (code: string) => {
    const g = gameRef.current;
    if (!g || !canAct || inputRef.current?.charging) return;
    if (code === 'Digit1' && g.energy >= 25)
      setSkill((v) => (v === 'boost' ? 'normal' : 'boost'));
    if (code === 'Digit2' || code === 'Digit3') {
      commitGame(useItem(g, code === 'Digit2' ? 'heal' : 'shield'));
      setSkill('normal');
      soundRef.current('click');
    }
    if (code === 'KeyP')
      finishTurn(nextTurn({ ...g, message: '蓄势待发，结束本回合。' }));
  };
  actionsRef.current = {
    enabled: () => canAct && gameRef.current?.phase === 'aim',
    move: (direction, distance) => {
      const g = gameRef.current;
      if (g) {
        const next = moveActor(g, direction, distance);
        if (next.energy < 25) setSkill('normal');
        commitGame(next);
      }
    },
    aim: (delta) => changeAngle(angleRef.current + delta),
    charge: (strength, active) => {
      chargedRef.current = strength;
      setPower(strength);
      setCharging(active);
    },
    fire: (strength) => launch(angleRef.current, strength),
    shortcut: item,
    held: setHeld,
  };
  useEffect(() => {
    if (screen !== 'battle') return;
    const input = new BattleInput({
      enabled: () => actionsRef.current?.enabled() ?? false,
      move: (d, n) => actionsRef.current?.move(d, n),
      aim: (n) => actionsRef.current?.aim(n),
      charge: (n, c) => actionsRef.current?.charge(n, c),
      fire: (n) => actionsRef.current?.fire(n),
      shortcut: (c) => actionsRef.current?.shortcut(c),
      held: (keys) => setHeld(keys),
    });
    inputRef.current = input;
    const unbind = bindBattleKeyboard(window, input);
    let raf = 0,
      last = performance.now();
    const tick = (time: number) => {
      const dt = Math.max(0, Math.min(0.05, (time - last) / 1000));
      last = time;
      input.tick(dt);
      const g = gameRef.current;
      if (
        g &&
        g.mode !== 'training' &&
        actionsRef.current?.enabled() &&
        !document.hidden
      ) {
        secondsRef.current = Math.max(0, secondsRef.current - dt);
        setSeconds(secondsRef.current);
        if (secondsRef.current === 0) {
          if (input.charging) input.up('Space');
          else actionsRef.current?.shortcut('KeyP');
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      unbind();
      inputRef.current = null;
    };
  }, [screen]);
  useEffect(() => {
    if (!canAct) inputRef.current?.cancel();
  }, [canAct]);
  useEffect(() => {
    if (!shot) return;
    let frame = 0,
      elapsed = 0,
      last = performance.now();
    const duration = Math.max(0.18, shot.duration ?? shot.points.length / 40);
    const animate = (time: number) => {
      elapsed += Math.max(0, Math.min(0.05, (time - last) / 1000));
      last = time;
      const progress = Math.min(1, elapsed / duration);
      setShotProgress(progress);
      if (progress < 1) frame = requestAnimationFrame(animate);
      else {
        const g = gameRef.current;
        if (!g) return;
        const next = applyShot(g, shot);
        setEffect({ ...shot.impact, tick: Date.now() });
        soundRef.current('hit');
        finishTurn(next);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [shot]);
  useEffect(() => {
    if (effect) {
      const t = setTimeout(() => setEffect(null), 850);
      return () => clearTimeout(t);
    }
  }, [effect]);
  useEffect(() => {
    if (
      !game ||
      game.phase !== 'aim' ||
      game.mode !== 'adventure' ||
      game.active !== 1 ||
      modal
    )
      return;
    const timer = setTimeout(() => {
      const g = gameRef.current;
      if (!g || g.phase !== 'aim') return;
      const aim = aiAim(g);
      launch(
        aim.angle,
        Math.max(1, Math.min(100, aim.power + (Math.random() - 0.5) * 7)),
        true,
      );
    }, 1500);
    return () => clearTimeout(timer);
  }, [game?.round, game?.phase, game?.active, modal]);
  useEffect(() => {
    if (!game || game.phase !== 'over' || rewardApplied.current) return;
    rewardApplied.current = true;
    const win = game.winner === 0,
      reward = game.mode === 'training' ? 30 : win ? 150 : 50;
    setSave((s) => ({
      ...s,
      coins: s.coins + reward,
      games: s.games + 1,
      wins: s.wins + (win ? 1 : 0),
      xp: s.xp + (win ? 100 : 30),
    }));
    soundRef.current('win');
  }, [game?.phase]);
  function leaveBattle() {
    inputRef.current?.cancel();
    setScreen('lobby');
    setGame(null);
    gameRef.current = null;
    setShot(null);
    firing.current = false;
    setModal(null);
    setCharging(false);
  }
  const nav = [
    { id: null, label: '冒险大厅', icon: Compass },
    { id: 'heroes', label: '角色图鉴', icon: Users },
    { id: 'weapons', label: '武器工坊', icon: Crosshair },
    { id: 'equipment', label: '装备背包', icon: Backpack },
  ] as const;

  return (
    <div className={`game-app ${screen === 'battle' ? 'in-battle' : ''}`}>
      <aside className="sidebar">
        <button
          className="brand-symbol"
          aria-label="弹弹奇旅首页"
          onClick={() =>
            screen === 'battle' ? setModal('quit') : setModal(null)
          }
        >
          <Crosshair size={31} />
          <i />
        </button>
        <div className="side-nav">
          {nav.map((n) => (
            <button
              key={n.label}
              className={`side-link ${modal === n.id && screen === 'lobby' ? 'active' : ''}`}
              onClick={() =>
                screen === 'battle' ? setModal('quit') : setModal(n.id)
              }
            >
              <n.icon size={23} />
              <span>{n.label}</span>
              {n.id === 'weapons' && <i className="new-dot" />}
            </button>
          ))}
        </div>
        <div className="side-bottom">
          <button onClick={() => setModal('help')} aria-label="玩法指南">
            <CircleHelp size={22} />
          </button>
          <span>让快乐起飞</span>
          <small>v1.0 · 原创冒险</small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="wordmark">
            弹弹<span>奇旅</span>
            <small>BOUNCE & BEYOND</small>
          </div>
          <div className="header-divider" />
          <span className="header-context">
            {screen === 'lobby' ? '冒险，从这里开始' : '天空竞技场'}
          </span>
          <div className="header-right">
            <div className="currency">
              <span className="coin-icon">
                <Coins size={17} />
              </span>
              <b>{save.coins.toLocaleString()}</b>
            </div>
            <div className="level-pill">
              <Star size={16} fill="currentColor" />
              <b>Lv. {Math.floor(save.xp / 300) + 1}</b>
            </div>
            <div className="header-divider" />
            <button
              className="icon-btn sound-button"
              aria-label={save.sound ? '关闭音效' : '开启音效'}
              onClick={() => setSave((s) => ({ ...s, sound: !s.sound }))}
            >
              {save.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button
              className="icon-btn"
              aria-label="游戏设置"
              onClick={() => setModal('settings')}
            >
              <Settings2 size={20} />
            </button>
            <button
              className="profile-avatar"
              aria-label="选择出战角色"
              disabled={screen === 'battle'}
              onClick={() => setModal('heroes')}
            >
              <HeroArt hero={save.hero} />
            </button>
          </div>
        </header>
        {screen === 'lobby' ? (
          <main className="lobby">
            <div className="welcome-row">
              <div>
                <div className="eyebrow">
                  <span />
                  天空冒险季 <i /> SEASON 01
                </div>
                <h1>
                  今天，也来一场漂亮的抛物线！
                  <Sparkles size={25} />
                </h1>
              </div>
              <button className="text-button" onClick={() => setModal('help')}>
                第一次冒险？
                <span>
                  查看指南 <ArrowUpRight size={16} />
                </span>
              </button>
            </div>
            <div className="lobby-grid">
              <section className={`island-stage map-${map}`}>
                <div
                  className="stage-backdrop"
                  style={{ backgroundImage: `url("${asset('islands.png')}")` }}
                />
                <div className="stage-wash" />
                <div className="map-label">
                  <span className="map-badge">
                    <span />
                    自由探索
                  </span>
                  <h2>{selectedMap.name}</h2>
                  <p>{selectedMap.en}</p>
                  <div className="weather">
                    <Wind size={16} />
                    {selectedMap.label}
                    <span>24°</span>
                  </div>
                </div>
                <div className="stage-corner">
                  <Mountain size={15} />
                  天空群岛 · 01
                </div>
                <div className="hero-speech">
                  {save.hero === 0
                    ? '风刚刚好，我们出发吧！'
                    : save.hero === 1
                      ? '准备好，追上那颗星了吗？'
                      : '今天也会有好事发生～'}
                  <span>✦</span>
                </div>
                <div className="hero-platform" />
                <HeroArt hero={save.hero} className="lobby-hero" />
                <div className="floating-stat stat-heart">
                  <Heart size={17} fill="currentColor" />
                  <span>元气满格</span>
                </div>
                <div className="floating-stat stat-star">
                  <Star size={17} fill="currentColor" />
                  <span>准备就绪</span>
                </div>
                <button
                  className="stage-equip equip-one"
                  onClick={() => setModal('weapons')}
                  aria-label="更换武器"
                >
                  <ItemArt item={save.weapon} />
                  <span>
                    <Crosshair size={12} />
                  </span>
                </button>
                <button
                  className="stage-equip equip-two"
                  onClick={() => setModal('equipment')}
                  aria-label="更换装备"
                >
                  <ItemArt item={save.equipment + 3} />
                  <span>
                    <Shield size={12} />
                  </span>
                </button>
                <div className="hero-caption">
                  <span className="hero-tier">SR</span>
                  <div>
                    <b>{currentHero.name}</b>
                    <span>{currentHero.title}</span>
                  </div>
                  <button
                    onClick={() => setModal('heroes')}
                    aria-label="切换角色"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
                <div className="map-switcher">
                  {MAPS.map((m, i) => (
                    <button
                      key={m.id}
                      className={map === m.id ? 'selected' : ''}
                      onClick={() => {
                        setMap(m.id);
                        sound('click');
                      }}
                    >
                      <span
                        className={`map-thumb map-thumb-${i}`}
                        style={{
                          backgroundImage: `url("${asset('islands.png')}")`,
                        }}
                      />
                      <span>{m.name}</span>
                      {map === m.id && <Check size={13} />}
                    </button>
                  ))}
                </div>
              </section>
              <aside className="preparation">
                <div className="panel-heading">
                  <h2>出发准备</h2>
                  <span className="ready-indicator">
                    <i />
                    准备就绪
                  </span>
                </div>
                <div className="loadout-summary">
                  <span className="small-label">当前出战</span>
                  <button onClick={() => setModal('heroes')}>
                    更换 <ChevronRight size={14} />
                  </button>
                  <div className="loadout-hero">
                    <div className="avatar-box">
                      <HeroArt hero={save.hero} />
                    </div>
                    <div>
                      <h3>
                        {currentHero.name}
                        <span>Lv. {Math.floor(save.xp / 300) + 1}</span>
                      </h3>
                      <p>{currentHero.title}</p>
                      <span className="trait">
                        <Sparkles size={12} />
                        {currentHero.trait}
                      </span>
                    </div>
                  </div>
                  <div className="hero-metrics">
                    <span>
                      <Heart size={14} />
                      生命{' '}
                      <b>{currentHero.hp + (save.equipment === 1 ? 20 : 0)}</b>
                    </span>
                    <span>
                      <Swords size={14} />
                      攻击{' '}
                      <b>
                        {Math.round(
                          currentWeapon.damage *
                            currentHero.attack *
                            (save.equipment === 0 ? 1.08 : 1),
                        )}
                      </b>
                    </span>
                  </div>
                </div>
                <div className="weapon-select">
                  <div className="subheading">
                    <h3>带上趁手的武器</h3>
                    <button
                      onClick={() => setModal('weapons')}
                      aria-label="查看武器详情"
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="weapon-mini-grid">
                    {WEAPONS.map((w, i) => (
                      <button
                        key={w.name}
                        className={save.weapon === i ? 'selected' : ''}
                        onClick={() => choose('weapon', i)}
                      >
                        <ItemArt item={i} />
                        <span>{w.name}</span>
                        {save.weapon === i && (
                          <i>
                            <Check size={10} />
                          </i>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="selected-weapon-info">
                    <span>{currentWeapon.tag}</span>
                    <p>{currentWeapon.subtitle}</p>
                  </div>
                </div>
                <div className="mode-section">
                  <h3>选择你的冒险</h3>
                  <div className="mode-options">
                    {(
                      [
                        {
                          id: 'adventure',
                          title: '冒险对战',
                          desc: '挑战 AI · 赢取星币',
                          icon: Swords,
                        },
                        {
                          id: 'training',
                          title: '练习靶场',
                          desc: '零风力 · 自由练习',
                          icon: Target,
                        },
                        {
                          id: 'duel',
                          title: '同屏双人',
                          desc: '和朋友轮流来一发',
                          icon: Users,
                        },
                      ] as const
                    ).map((m) => (
                      <button
                        className={mode === m.id ? 'selected' : ''}
                        key={m.id}
                        onClick={() => {
                          setMode(m.id);
                          sound('click');
                        }}
                      >
                        <span className="mode-icon">
                          <m.icon size={19} />
                        </span>
                        <span>
                          <b>{m.title}</b>
                          <small>{m.desc}</small>
                        </span>
                        <i>{mode === m.id && <span />}</i>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className="launch-button"
                  disabled={!loaded}
                  onClick={startBattle}
                >
                  <Swords size={23} />
                  <span>
                    开始冒险
                    <small>
                      {mode === 'adventure'
                        ? '与 AI 一决高下'
                        : mode === 'training'
                          ? '找到你的完美弹道'
                          : '两个人，双倍快乐'}
                    </small>
                  </span>
                  <ArrowRight size={22} />
                </button>
                <p className="start-note">
                  <Shield size={12} />
                  无需下载 · 即刻开玩
                </p>
              </aside>
            </div>
            <section className="bottom-strip">
              <button
                className="equipment-banner"
                onClick={() => setModal('equipment')}
              >
                <div className="banner-icon">
                  <Backpack size={23} />
                </div>
                <div>
                  <h3>小装备，大能量</h3>
                  <p>搭配你的专属冒险风格</p>
                </div>
                <div className="banner-equipment">
                  <ItemArt item={3} />
                  <ItemArt item={4} />
                  <ItemArt item={5} />
                </div>
                <ArrowUpRight size={20} />
              </button>
              <div className="adventure-record">
                <div className="record-icon">
                  <Trophy size={23} />
                </div>
                <div>
                  <h3>我的冒险足迹</h3>
                  <p>每一次出发，都值得记录</p>
                </div>
                <div className="record-stat">
                  <b>{save.games}</b>
                  <span>累计场次</span>
                </div>
                <div className="record-stat">
                  <b>{save.wins}</b>
                  <span>获得胜利</span>
                </div>
              </div>
            </section>
            <footer className="lobby-footer">
              <span>
                <i className="online-dot" />
                冒险家，欢迎来到天空群岛
              </span>
              <span>
                {storageBlocked
                  ? '本次进度仅在当前页面保留'
                  : '进度自动保存在此浏览器'}
                <i className="footer-dot" />
                原创弹射游戏
              </span>
            </footer>
          </main>
        ) : (
          game && (
            <ClassicBattle
              game={game}
              shot={shot}
              shotProgress={shotProgress}
              effect={effect}
              angle={angle}
              power={power}
              charging={charging}
              held={held}
              guide={guide}
              canAct={canAct}
              handoff={handoff}
              seconds={seconds}
              skill={skill}
              sound={save.sound}
              onDown={(code) => inputRef.current?.down(code)}
              onUp={(code) => inputRef.current?.up(code)}
              onCancel={() => inputRef.current?.cancel()}
              onAim={changeAngle}
              onItem={item}
              onGuide={() => setGuide((v) => !v)}
              onSound={() => setSave((s) => ({ ...s, sound: !s.sound }))}
              onQuit={() => setModal('quit')}
              onHelp={() => setModal('help')}
              onHandoff={() => {
                setHandoff(false);
                inputRef.current?.cancel();
              }}
            />
          )
        )}
      </div>
      <Dialog
        open={modal !== null && modal !== 'quit'}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <DialogContent
          className={`game-dialog ${modal === 'help' ? 'help-dialog' : ''}`}
        >
          <DialogTitle className="dialog-title">
            {modal === 'heroes'
              ? '遇见你的冒险搭档'
              : modal === 'weapons'
                ? '武器工坊'
                : modal === 'equipment'
                  ? '冒险装备箱'
                  : modal === 'settings'
                    ? '让冒险更合心意'
                    : '第一发，从这里开始'}
          </DialogTitle>
          <DialogDescription className="dialog-description">
            {modal === 'heroes'
              ? '三位伙伴，三种天赋。选择一位，一起奔向天空。'
              : modal === 'weapons'
                ? '每件武器都有自己的脾气，找到适合你的那一款。'
                : modal === 'equipment'
                  ? '每次出战可携带一件装备，效果将在下一场战斗生效。'
                  : modal === 'settings'
                    ? '调整音效和瞄准辅助，找到舒服的游戏节奏。'
                    : '观察风向，调整角度和力度，将炮弹送到对手身边。'}
          </DialogDescription>
          {modal === 'heroes' && (
            <div className="hero-selection-grid">
              {HEROES.map((h, i) => (
                <button
                  key={h.name}
                  className={`hero-choice ${save.hero === i ? 'selected' : ''}`}
                  onClick={() => choose('hero', i)}
                  style={{ '--hero-accent': h.color } as CSSProperties}
                >
                  <span className="choice-rarity">SR</span>
                  <HeroArt hero={i} />
                  <div className="hero-choice-info">
                    <small>{h.title}</small>
                    <h3>{h.name}</h3>
                    <p>{h.text}</p>
                    <span>
                      <Sparkles size={13} />
                      {h.detail}
                    </span>
                    <b className="choice-action">
                      {save.hero === i ? (
                        <>
                          <Check size={16} />
                          已出战
                        </>
                      ) : (
                        '选择出战'
                      )}
                    </b>
                  </div>
                </button>
              ))}
            </div>
          )}
          {modal === 'weapons' && (
            <div className="weapon-selection-grid">
              {WEAPONS.map((w, i) => (
                <button
                  key={w.name}
                  className={`weapon-choice ${save.weapon === i ? 'selected' : ''}`}
                  onClick={() => choose('weapon', i)}
                >
                  <span className="weapon-tag">{w.tag}</span>
                  <ItemArt item={i} />
                  <h3>{w.name}</h3>
                  <p>{w.desc}</p>
                  <div className="weapon-meter">
                    <span>
                      伤害 <b>{w.damage}</b>
                    </span>
                    <i>
                      <em style={{ width: `${(w.damage / 50) * 100}%` }} />
                    </i>
                  </div>
                  <div className="weapon-meter">
                    <span>
                      范围 <b>{w.radius}</b>
                    </span>
                    <i>
                      <em style={{ width: `${w.radius}%` }} />
                    </i>
                  </div>
                  <b className="choice-action">
                    {save.weapon === i ? (
                      <>
                        <Check size={16} />
                        已装备
                      </>
                    ) : (
                      '装备武器'
                    )}
                  </b>
                </button>
              ))}
            </div>
          )}
          {modal === 'equipment' && (
            <div className="equipment-selection">
              {EQUIPMENT.map((e, i) => (
                <button
                  key={e.name}
                  className={`equipment-choice ${save.equipment === i ? 'selected' : ''}`}
                  onClick={() => choose('equipment', i)}
                >
                  <ItemArt item={i + 3} />
                  <div>
                    <span className="weapon-tag">{e.tag}</span>
                    <h3>{e.name}</h3>
                    <p>{e.desc}</p>
                  </div>
                  <span className="choice-action">
                    {save.equipment === i ? (
                      <>
                        <Check size={16} />
                        已装备
                      </>
                    ) : (
                      '装备'
                    )}
                  </span>
                </button>
              ))}
              <p className="equipment-tip">
                <Sparkles size={16} />
                角色、武器与装备均已解锁，自由搭配，快乐出发。
              </p>
            </div>
          )}
          {modal === 'help' && (
            <Tabs defaultValue="basics">
              <TabsList className="help-tabs">
                <TabsTrigger value="basics">快速上手</TabsTrigger>
                <TabsTrigger value="tactics">战术小课堂</TabsTrigger>
              </TabsList>
              <TabsContent value="basics">
                <div className="help-steps">
                  <div>
                    <span>01</span>
                    <div>
                      <h3>看一眼风，选一个角度</h3>
                      <p>
                        按住 ← → 连续走位并转身，按住 ↑ ↓
                        调角度。左下角的角度盘显示当前角度、地形修正和上一发角度。
                      </p>
                    </div>
                  </div>
                  <div>
                    <span>02</span>
                    <div>
                      <h3>给炮弹刚刚好的力量</h3>
                      <p>
                        按住空格，底部力度条从 0 匀速增加，松开立即发射，到 100
                        自动发射。红线记录上一发力度。鼠标或触屏可长按发射按钮。
                      </p>
                    </div>
                  </div>
                  <div>
                    <span>03</span>
                    <div>
                      <h3>轮流出招，直到胜利</h3>
                      <p>
                        每回合有 30 秒。数字 1 / 2 / 3 使用道具，P
                        结束回合。训练没有计时，显示轨迹辅助；实战默认关闭完整预测线。
                      </p>
                    </div>
                  </div>
                </div>
                <div className="keyboard-guide">
                  <Keyboard size={22} />
                  <span>
                    <kbd>←</kbd>
                    <kbd>→</kbd>走位
                  </span>
                  <span>
                    <kbd>↑</kbd>
                    <kbd>↓</kbd>角度
                  </span>
                  <span>
                    <kbd>空格</kbd>蓄力
                  </span>
                </div>
              </TabsContent>
              <TabsContent value="tactics">
                <div className="tactic-list">
                  <p>
                    <Wind />
                    顺风飞得更远，逆风需要更大力度。每回合风力都会变化。
                  </p>
                  <p>
                    <Mountain />
                    爆炸会挖出弹坑。地形变化后，你与对手的高度也会变化。
                  </p>
                  <p>
                    <Flame />
                    强力弹增加 50% 伤害，消耗 25 体力；移动按实际距离消耗体力。
                  </p>
                  <p>
                    <Shield />
                    治疗与护盾各有 2 次，均消耗 25 体力。护盾优先抵挡伤害。
                  </p>
                  <p>
                    <Target />
                    冰晶命中可减缓对手行动；向日葵擅长范围轰炸。
                  </p>
                  <p>
                    <Flag />
                    对战上限为 60 回合，之后按剩余生命判定胜负。
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}
          {modal === 'settings' && (
            <div className="settings-list">
              <label>
                <div>
                  <b>游戏音效</b>
                  <p>发射、命中与胜利时的声音反馈</p>
                </div>
                <Switch
                  aria-label="游戏音效"
                  checked={save.sound}
                  onCheckedChange={(checked) =>
                    setSave((s) => ({ ...s, sound: checked }))
                  }
                />
              </label>
              <label>
                <div>
                  <b>轨迹辅助</b>
                  <p>显示炮弹的预计飞行路线</p>
                </div>
                <Switch
                  aria-label="轨迹辅助"
                  checked={guide}
                  onCheckedChange={setGuide}
                />
              </label>
              <div className="save-info">
                <Shield size={21} />
                <p>
                  {storageBlocked
                    ? '当前浏览器无法保存进度，关闭页面后进度会丢失。'
                    : '冒险进度保存在当前浏览器，无需注册账号。清除浏览器数据会重置进度。'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal === 'quit'}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <DialogContent className="small-dialog">
          <DialogTitle>暂时返回天空群岛？</DialogTitle>
          <DialogDescription>
            本场对战将结束，未完成的对战不会获得奖励。
          </DialogDescription>
          <div className="dialog-buttons">
            <button className="secondary-button" onClick={() => setModal(null)}>
              继续对战
            </button>
            <button className="primary-button" onClick={leaveBattle}>
              返回大厅
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={game?.phase === 'over' && screen === 'battle'}>
        <DialogContent className="result-dialog" showCloseButton={false}>
          <div className="result-trophy">
            <Trophy size={55} />
          </div>
          <span className="eyebrow">ADVENTURE COMPLETE</span>
          <DialogTitle>
            {game?.winner === null
              ? '这一次，旗鼓相当！'
              : game?.mode === 'duel'
                ? `P${game.winner! + 1}，漂亮的一发！`
                : game?.winner === 0
                  ? '胜利！天空为你喝彩'
                  : '差一点！再来一场吧'}
          </DialogTitle>
          <DialogDescription>
            {game?.mode === 'training'
              ? '每一发练习，都让你更靠近完美弹道。'
              : `在第 ${game?.round} 回合，完成了这次冒险。`}
          </DialogDescription>
          <div className="result-rewards">
            <span>
              <Coins size={20} />+
              {game?.mode === 'training' ? 30 : game?.winner === 0 ? 150 : 50}{' '}
              星币
            </span>
            <span>
              <Star size={20} />+{game?.winner === 0 ? 100 : 30} 经验
            </span>
          </div>
          <div className="dialog-buttons">
            <button className="secondary-button" onClick={leaveBattle}>
              <Home size={17} />
              返回大厅
            </button>
            <button className="primary-button" onClick={startBattle}>
              <RotateCcw size={17} />
              再来一场
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {toast && (
        <div className="toast-message" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
