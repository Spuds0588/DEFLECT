import { ACTION, type InputFrame } from './types';

const MOVE_KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
} as const;

const ACTION_KEYS: Record<string, number> = {
  KeyJ: ACTION.SWING,
  KeyQ: ACTION.LOCK,
  KeyK: ACTION.BOLT,
  KeyL: ACTION.CANDLE,
  KeyE: ACTION.CANDLE,
  ShiftLeft: ACTION.DASH,
  ShiftRight: ACTION.DASH,
  Space: ACTION.DASH,
};

const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  L3: 10,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

const DEADZONE = 0.2;

export interface MenuEdges {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  /** Face button B — cancel/back in menus, but deflect in game. */
  back: boolean;
  /** Start/View — the only gamepad button that opens the in-game menu. */
  menu: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * One input source for the local player: keyboard + mouse buttons + first connected gamepad.
 * The most recently used device owns the frame; there is no on-screen input-mode indicator.
 * Facing is not an input (AGENTS.md D2) so there is deliberately no mouse-position sampling.
 */
export class Input {
  readonly frame: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };

  private keys = new Set<string>();
  private keyHeld = 0;
  private pendingPressed = 0;
  private mouseHeld = 0;

  private padIndex: number | null = null;
  private padPrev: boolean[] = new Array(16).fill(false);
  private padHeld = 0;
  private padPressed = 0;
  private padX = 0;
  private padY = 0;
  private padSwingDown = false;
  /** Ignore a brief missing-pad frame (Chrome drops pads for a poll after focus changes). */
  private padGraceUntil = 0;
  private padLastSeen = 0;
  private padRescan = true;

  private menu = { up: false, down: false, left: false, right: false, confirm: false, back: false, menu: false };
  /** Held menu direction, edge-triggered with a repeat delay so a D-pad tap is one move. */
  private menuDir = 0;
  private menuRepeatAt = 0;
  /** Analog stick direction with hysteresis, so a tilt near the threshold cannot chatter. */
  private menuStickDir = 0;

  lastDevice: 'keyboard' | 'gamepad' = 'keyboard';
  gamepadName = '';

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('auxclick', this.onAuxClick);
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    window.addEventListener('focus', this.onFocus);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('auxclick', this.onAuxClick);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    window.removeEventListener('focus', this.onFocus);
  }

  private onVisibility = (): void => {
    if (document.hidden) this.clear();
  };

  private clear = (): void => {
    this.keys.clear();
    this.keyHeld = 0;
    this.pendingPressed = 0;
    this.mouseHeld = 0;
    this.padHeld = 0;
    this.padPressed = 0;
    this.padX = 0;
    this.padY = 0;
    this.menuDir = 0;
    this.menuStickDir = 0;
    this.padPrev.fill(false);
    this.padRescan = true;
  };

  private onFocus = (): void => {
    this.padRescan = true;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (isTypingTarget(e.target)) return;
    // Leave Space to native button activation when a menu button has focus.
    if (e.code === 'Space' && e.target instanceof HTMLElement && e.target.closest('button')) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    // The most recent real input wins until the other device is touched.
    this.lastDevice = 'keyboard';

    if (
      MOVE_KEYS.up.includes(e.code as never) ||
      MOVE_KEYS.down.includes(e.code as never) ||
      MOVE_KEYS.left.includes(e.code as never) ||
      MOVE_KEYS.right.includes(e.code as never)
    ) {
      this.keys.add(e.code);
    }

    const action = ACTION_KEYS[e.code];
    if (action && !e.repeat) {
      this.keyHeld |= action;
      this.pendingPressed |= action;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    const action = ACTION_KEYS[e.code];
    if (action) this.keyHeld &= ~action;
  };

  private onMouseDown = (e: MouseEvent): void => {
    const bit = e.button === 0 ? ACTION.SWING : e.button === 2 ? ACTION.BOLT : e.button === 1 ? ACTION.CANDLE : 0;
    if (!bit) return;
    e.preventDefault();
    this.mouseHeld |= bit;
    this.pendingPressed |= bit;
    this.lastDevice = 'keyboard';
  };

  private onMouseUp = (e: MouseEvent): void => {
    const bit = e.button === 0 ? ACTION.SWING : e.button === 2 ? ACTION.BOLT : e.button === 1 ? ACTION.CANDLE : 0;
    if (bit) this.mouseHeld &= ~bit;
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private onAuxClick = (e: Event): void => {
    e.preventDefault();
  };

  private onGamepadConnected = (e: GamepadEvent): void => {
    if (this.padIndex === null) {
      this.padIndex = e.gamepad.index;
      this.gamepadName = e.gamepad.id.slice(0, 48);
      this.padPrev.fill(false);
    }
    this.padRescan = true;
    this.lastDevice = 'gamepad';
  };

  private onGamepadDisconnected = (e: GamepadEvent): void => {
    if (this.padIndex === e.gamepad.index) {
      // Do not clear the index here. Chrome can emit a disconnect for a controller
      // that is still alive (idle pad, focus change), and dropping the index was
      // making the pad stop responding until another connect event fired.
      this.padRescan = true;
    }
  };

  /** Called once per animation frame before sampling or menu handling. */
  poll(): void {
    const now = performance.now();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;

    if (this.padIndex !== null) {
      const current = pads[this.padIndex] ?? null;
      if (current && current.connected) pad = current;
    }
    if (!pad) {
      for (const candidate of pads) {
        if (candidate && candidate.connected && candidate.buttons.length > 0) {
          pad = candidate;
          break;
        }
      }
    }

    if (!pad) {
      // Hold the last known pad through a real gap. Chrome intermittently omits a
      // connected pad for a frame or two during focus changes; dropping the index
      // here made the controller appear dead until it reconnected. Keep the last
      // device as gamepad too: only a real keyboard/mouse event should take over.
      if (this.padIndex !== null && now - this.padLastSeen < 3000) {
        this.padHeld = 0;
        this.padPressed = 0;
        this.padX = 0;
        this.padY = 0;
        this.padPrev.fill(false);
        this.menuDir = 0;
        this.menuStickDir = 0;
        return;
      }
      this.padIndex = null;
      this.gamepadName = '';
      this.padHeld = 0;
      this.padPressed = 0;
      this.padX = 0;
      this.padY = 0;
      this.menuDir = 0;
      this.menuStickDir = 0;
      this.padRescan = false;
      return;
    }

    if (this.padIndex !== pad.index) {
      this.padPrev.fill(false);
      this.padHeld = 0;
      this.padPressed = 0;
    }
    this.padIndex = pad.index;
    this.gamepadName = pad.id.slice(0, 48);
    this.padLastSeen = now;
    this.padGraceUntil = now + 300;
    this.padRescan = false;

    if (pad.buttons.length === 0) {
      // Some browsers expose a pad for a frame before its inputs are readable.
      this.padHeld = 0;
      this.padPressed = 0;
      this.padX = 0;
      this.padY = 0;
      return;
    }

    const btn = (i: number): boolean => !!pad!.buttons[i]?.pressed;
    const axis = pad.axes;
    this.menu.up = this.menu.down = this.menu.left = this.menu.right = false;
    // Face-button layout: X weak, Y strong, B deflect, A dash.
    const swingDown = btn(PAD.B);
    const boltDown = btn(PAD.X);
    const candleDown = btn(PAD.Y);
    const lockDown = btn(PAD.LT) || (axis[4] ?? 0) > 0.5;

    let x = axis[0] ?? 0;
    let y = axis[1] ?? 0;
    const mag = Math.hypot(x, y);
    if (mag < DEADZONE) {
      x = 0;
      y = 0;
    } else {
      const scaled = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE));
      x = (x / mag) * scaled;
      y = (y / mag) * scaled;
    }
    this.padX = x;
    this.padY = y;

    let held = 0;
    if (swingDown) held |= ACTION.SWING;
    if (boltDown) held |= ACTION.BOLT;
    if (candleDown) held |= ACTION.CANDLE;
    if (lockDown) held |= ACTION.LOCK;
    if (btn(PAD.A) || btn(PAD.L3)) held |= ACTION.DASH;
    if (x !== 0 || y !== 0 || held !== 0) this.lastDevice = 'gamepad';

    this.padPressed |= held & ~this.padHeld;
    this.padHeld = held;

    // D-pad first, then the left stick. The stick path was missing entirely, so a
    // controller user could move in-game but not navigate a single menu line.
    let dir = 0;
    if (btn(PAD.UP)) dir = 1;
    else if (btn(PAD.DOWN)) dir = 2;
    else if (btn(PAD.LEFT)) dir = 3;
    else if (btn(PAD.RIGHT)) dir = 4;
    if (dir === 0) {
      const ax = axis[0] ?? 0;
      const ay = axis[1] ?? 0;
      // Engage around 0.55 raw, release below 0.32. Without the release gap a
      // stick resting near the threshold fires a stream of direction changes.
      const threshold = this.menuStickDir === 0 ? 0.55 : 0.32;
      let stickDir = 0;
      if (Math.abs(ax) > threshold || Math.abs(ay) > threshold) {
        stickDir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 4 : 3) : ay > 0 ? 2 : 1;
      }
      this.menuStickDir = stickDir;
      dir = stickDir;
    }
    if (dir === 0) {
      this.menuDir = 0;
    } else if (dir !== this.menuDir) {
      this.menuDir = dir;
      // `now` is milliseconds. A seconds value here made every frame count as a
      // repeat, so one D-pad tap skipped several menu lines.
      this.menuRepeatAt = now + 360;
      this.setMenuDir(dir);
    } else if (now >= this.menuRepeatAt) {
      this.menuRepeatAt = now + 110;
      this.setMenuDir(dir);
    }

    if ((btn(PAD.A) && !this.padPrev[PAD.A]) || (btn(PAD.START) && !this.padPrev[PAD.START])) {
      this.menu.confirm = true;
      this.lastDevice = 'gamepad';
    }
    if (btn(PAD.B) && !this.padPrev[PAD.B]) {
      this.menu.back = true;
      this.lastDevice = 'gamepad';
    }
    if ((btn(PAD.START) && !this.padPrev[PAD.START]) || (btn(PAD.BACK) && !this.padPrev[PAD.BACK])) {
      this.menu.menu = true;
      this.lastDevice = 'gamepad';
    }

    if (swingDown && !this.padSwingDown) this.lastDevice = 'gamepad';
    this.padSwingDown = swingDown;

    for (let i = 0; i < this.padPrev.length; i++) this.padPrev[i] = btn(i);
  }

  private setMenuDir(dir: number): void {
    if (dir === 1) this.menu.up = true;
    else if (dir === 2) this.menu.down = true;
    else if (dir === 3) this.menu.left = true;
    else if (dir === 4) this.menu.right = true;
    this.lastDevice = 'gamepad';
  }

  /** Reads and clears the latched gamepad menu edges. */
  readMenuEdges(): MenuEdges {
    const out: MenuEdges = { ...this.menu };
    this.menu.up = this.menu.down = this.menu.left = this.menu.right = false;
    this.menu.confirm = this.menu.back = this.menu.menu = false;
    return out;
  }

  hasGamepad(): boolean {
    return this.padIndex !== null;
  }

  /** Builds the local input frame from the most recently used device. */
  sample(): InputFrame {
    const padActive = this.lastDevice === 'gamepad';
    let mx = 0;
    let my = 0;

    if (padActive) {
      mx = this.padX;
      my = this.padY;
    } else {
      if (this.isDown(MOVE_KEYS.left)) mx -= 1;
      if (this.isDown(MOVE_KEYS.right)) mx += 1;
      if (this.isDown(MOVE_KEYS.up)) my -= 1;
      if (this.isDown(MOVE_KEYS.down)) my += 1;
      if (mx !== 0 || my !== 0) {
        const mag = Math.hypot(mx, my);
        mx /= mag;
        my /= mag;
      }
    }

    const held = padActive ? this.padHeld : this.keyHeld | this.mouseHeld;
    const pressed = padActive ? this.padPressed : this.pendingPressed;
    this.pendingPressed = 0;
    this.padPressed = 0;

    this.frame.mx = mx;
    this.frame.my = my;
    this.frame.held = held;
    this.frame.pressed = pressed;
    return this.frame;
  }

  private isDown(codes: readonly string[]): boolean {
    for (const code of codes) if (this.keys.has(code)) return true;
    return false;
  }
}
