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
      // Hold the last known pad through a short gap, then degrade cleanly.
      if (this.padIndex !== null && now - this.padLastSeen < 1200) {
        this.padHeld = 0;
        this.padPressed = 0;
        this.padX = 0;
        this.padY = 0;
        this.padPrev.fill(false);
        return;
      }
      this.padIndex = null;
      this.gamepadName = '';
      this.lastDevice = 'keyboard';
      this.padHeld = 0;
      this.padPressed = 0;
      this.padX = 0;
      this.padY = 0;
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

    if (btn(PAD.UP)) this.menu.up = true;
    if (btn(PAD.DOWN)) this.menu.down = true;
    if (btn(PAD.LEFT)) this.menu.left = true;
    if (btn(PAD.RIGHT)) this.menu.right = true;
    if ((btn(PAD.A) && !this.padPrev[PAD.A]) || (btn(PAD.START) && !this.padPrev[PAD.START])) {
      this.menu.confirm = true;
    }
    if (btn(PAD.B) && !this.padPrev[PAD.B]) {
      this.menu.back = true;
    }
    if ((btn(PAD.START) && !this.padPrev[PAD.START]) || (btn(PAD.BACK) && !this.padPrev[PAD.BACK])) {
      this.menu.menu = true;
    }

    if (swingDown && !this.padSwingDown) this.lastDevice = 'gamepad';
    this.padSwingDown = swingDown;

    for (let i = 0; i < this.padPrev.length; i++) this.padPrev[i] = btn(i);
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
