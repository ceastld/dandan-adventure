/** Frame-driven game input, independent of React rendering and OS key-repeat. */
export const CHARGE_SECONDS = 2.1;
export const MOVE_SPEED = 76;
export const AIM_SPEED = 34;
export const KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'KeyA',
  'KeyD',
  'KeyW',
  'KeyS',
  'Space',
  'Digit1',
  'Digit2',
  'Digit3',
  'KeyP',
]);
export type BattleInputCallbacks = {
  enabled: () => boolean;
  move: (direction: -1 | 1, distance: number) => void;
  aim: (degrees: number) => void;
  charge: (power: number, charging: boolean) => void;
  fire: (power: number) => void;
  shortcut: (code: string) => void;
  held: (keys: Set<string>) => void;
};
export class BattleInput {
  keys = new Set<string>();
  charging = false;
  power = 0;
  constructor(private callbacks: BattleInputCallbacks) {}
  get enabled() {
    return this.callbacks.enabled();
  }
  down(code: string) {
    if (!KEYS.has(code) || !this.callbacks.enabled()) return false;
    if (this.keys.has(code)) return true;
    this.keys.add(code);
    this.callbacks.held(new Set(this.keys));
    if (code === 'Space') {
      this.charging = true;
      this.power = 0;
      this.callbacks.charge(0, true);
    } else if (!this.charging) {
      if (['ArrowUp', 'KeyW'].includes(code)) this.callbacks.aim(1);
      if (['ArrowDown', 'KeyS'].includes(code)) this.callbacks.aim(-1);
      if (['ArrowLeft', 'KeyA'].includes(code)) this.callbacks.move(-1, 0);
      if (['ArrowRight', 'KeyD'].includes(code)) this.callbacks.move(1, 0);
      if (['Digit1', 'Digit2', 'Digit3', 'KeyP'].includes(code))
        this.callbacks.shortcut(code);
    }
    return true;
  }
  up(code: string) {
    const wasHeld = this.keys.delete(code);
    if (wasHeld) this.callbacks.held(new Set(this.keys));
    if (code === 'Space' && this.charging) {
      this.charging = false;
      this.callbacks.charge(this.power, false);
      if (this.callbacks.enabled()) this.callbacks.fire(this.power);
    }
    return wasHeld;
  }
  tick(seconds: number) {
    if (!this.callbacks.enabled()) {
      this.cancel();
      return;
    }
    // Ignore suspended-tab time: a focus transition must never discharge a shot.
    const dt = Math.max(0, Math.min(seconds, 0.05));
    if (this.charging) {
      this.power = Math.min(100, this.power + (dt * 100) / CHARGE_SECONDS);
      this.callbacks.charge(this.power, true);
      if (this.power >= 100) {
        this.charging = false;
        this.callbacks.charge(100, false);
        this.callbacks.fire(100);
      }
      return;
    }
    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const up = this.keys.has('ArrowUp') || this.keys.has('KeyW');
    const down = this.keys.has('ArrowDown') || this.keys.has('KeyS');
    if (left !== right) this.callbacks.move(right ? 1 : -1, MOVE_SPEED * dt);
    if (up !== down) this.callbacks.aim((up ? 1 : -1) * AIM_SPEED * dt);
  }
  cancel() {
    if (this.keys.size) {
      this.keys.clear();
      this.callbacks.held(new Set());
    }
    if (this.charging) {
      this.charging = false;
      this.power = 0;
      this.callbacks.charge(0, false);
    }
  }
}

/** Capture game keys before focused buttons/range controls can consume them. */
export function bindBattleKeyboard(target: Window, input: BattleInput) {
  const isTextEntry = (node: EventTarget | null) => {
    const el = node as HTMLElement | null;
    return (
      !!el &&
      (el.isContentEditable ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        (el.tagName === 'INPUT' &&
          !['range', 'checkbox', 'radio', 'button'].includes(
            (el as HTMLInputElement).type,
          )))
    );
  };
  const keyDown = (e: KeyboardEvent) => {
    if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.isComposing &&
      !isTextEntry(e.target) &&
      KEYS.has(e.code)
    ) {
      // Dialogs and the between-player handoff retain native keyboard controls.
      if (!input.enabled) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat || input.keys.has(e.code)) input.down(e.code);
    }
  };
  const keyUp = (e: KeyboardEvent) => {
    if (input.up(e.code)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const cancel = () => input.cancel();
  const visibility = () => {
    if (target.document.hidden) cancel();
  };
  target.addEventListener('keydown', keyDown, true);
  target.addEventListener('keyup', keyUp, true);
  target.addEventListener('blur', cancel);
  target.document.addEventListener('visibilitychange', visibility);
  return () => {
    cancel();
    target.removeEventListener('keydown', keyDown, true);
    target.removeEventListener('keyup', keyUp, true);
    target.removeEventListener('blur', cancel);
    target.document.removeEventListener('visibilitychange', visibility);
  };
}
