import { ACTION, type InputFrame } from '../game/types';

interface TouchButton {
  el: HTMLButtonElement;
  bit: number;
  pointerId: number | null;
}

/** Deadzone inside the stick's travel, so a resting thumb does not creep. */
const STICK_DEADZONE = 0.18;
/** Knob travel as a fraction of the base diameter. */
const STICK_TRAVEL = 0.29;

/**
 * DOM touch layer for the local player. It writes ordinary action bits, so the
 * simulation cannot tell a phone from a controller. The left stick owns movement;
 * the three action buttons are hold-capable, which is what lets one button be both
 * guard and lash, or skill and power attack.
 *
 * This is input only: no game state, no settings, no snapshots.
 */
export class TouchControls {
  readonly frame: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
  private enabled = false;
  private buttons: TouchButton[] = [];
  private stickPointer: number | null = null;
  private stickActive = false;
  private stickCenterX = 0;
  private stickCenterY = 0;
  private stickTravel = 1;

  constructor(
    private root: HTMLElement,
    private stick: HTMLElement,
    private knob: HTMLElement,
  ) {
    const bind = (id: string, bit: number): void => {
      const el = document.getElementById(id) as HTMLButtonElement | null;
      if (!el) return;
      const button: TouchButton = { el, bit, pointerId: null };
      this.buttons.push(button);
      el.addEventListener('pointerdown', (e) => this.pressButton(button, e), { passive: false });
    };
    bind('touch-shield', ACTION.SWING);
    bind('touch-skill', ACTION.CANDLE);
    bind('touch-dash', ACTION.DASH);

    this.stick.addEventListener('pointerdown', this.onStickDown, { passive: false });
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onWindowUp);
    window.addEventListener('pointercancel', this.onWindowUp);
    window.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Shows the layer and allows samples. Hiding always releases every touch. */
  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    this.root.hidden = !on;
    if (!on) this.reset();
  }

  /** True while the thumb owns the stick, even inside the deadzone. */
  get isStickActive(): boolean {
    return this.stickActive;
  }

  /** Reads and clears the one-shot press bits, like `Input.sample()`. */
  sample(): InputFrame {
    this.frame.pressed = 0;
    return this.frame;
  }

  reset(): void {
    this.frame.mx = 0;
    this.frame.my = 0;
    this.frame.held = 0;
    this.frame.pressed = 0;
    this.stickActive = false;
    this.stickPointer = null;
    this.stick.classList.remove('active');
    this.knob.style.setProperty('--tx', '0px');
    this.knob.style.setProperty('--ty', '0px');
    for (let i = 0; i < this.buttons.length; i++) {
      const button = this.buttons[i];
      button.pointerId = null;
      button.el.classList.remove('active');
    }
  }

  private pressButton(button: TouchButton, e: PointerEvent): void {
    if (!this.enabled || button.pointerId !== null) return;
    e.preventDefault();
    button.pointerId = e.pointerId;
    button.el.classList.add('active');
    this.frame.held |= button.bit;
    this.frame.pressed |= button.bit;
  }

  private onStickDown = (e: PointerEvent): void => {
    if (!this.enabled || this.stickPointer !== null) return;
    e.preventDefault();
    const rect = this.stick.getBoundingClientRect();
    this.stickPointer = e.pointerId;
    this.stickActive = true;
    this.stickCenterX = rect.left + rect.width * 0.5;
    this.stickCenterY = rect.top + rect.height * 0.5;
    this.stickTravel = Math.max(8, rect.width * STICK_TRAVEL);
    this.stick.classList.add('active');
    this.updateStick(e.clientX, e.clientY);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.enabled || this.stickPointer !== e.pointerId) return;
    e.preventDefault();
    this.updateStick(e.clientX, e.clientY);
  };

  private onWindowUp = (e: PointerEvent): void => {
    if (this.stickPointer === e.pointerId) {
      this.stickPointer = null;
      this.stickActive = false;
      this.frame.mx = 0;
      this.frame.my = 0;
      this.stick.classList.remove('active');
      this.knob.style.setProperty('--tx', '0px');
      this.knob.style.setProperty('--ty', '0px');
    }
    for (let i = 0; i < this.buttons.length; i++) {
      const button = this.buttons[i];
      if (button.pointerId !== e.pointerId) continue;
      button.pointerId = null;
      button.el.classList.remove('active');
      this.frame.held &= ~button.bit;
    }
  };

  private onVisibility = (): void => {
    if (document.hidden) this.reset();
  };

  private updateStick(clientX: number, clientY: number): void {
    let dx = clientX - this.stickCenterX;
    let dy = clientY - this.stickCenterY;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) {
      this.frame.mx = 0;
      this.frame.my = 0;
      this.knob.style.setProperty('--tx', '0px');
      this.knob.style.setProperty('--ty', '0px');
      return;
    }
    const travel = Math.min(1, len / this.stickTravel);
    const ux = dx / len;
    const uy = dy / len;
    this.knob.style.setProperty('--tx', `${ux * travel * this.stickTravel}px`);
    this.knob.style.setProperty('--ty', `${uy * travel * this.stickTravel}px`);
    if (travel <= STICK_DEADZONE) {
      this.frame.mx = 0;
      this.frame.my = 0;
      return;
    }
    const magnitude = Math.min(1, (travel - STICK_DEADZONE) / (1 - STICK_DEADZONE));
    this.frame.mx = ux * magnitude;
    this.frame.my = uy * magnitude;
  }
}
