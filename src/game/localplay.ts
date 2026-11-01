import { Haptics, type RumbleCue } from './haptics';
import { ACTION, type InputFrame } from './types';

const DEADZONE = 0.2;
/** Keyboard is always P1, so this counts seats including P1. */
const MAX_LOCAL_SEATS = 4;
/** Chrome can omit a live pad for a frame or two after a focus change. */
const DISCONNECT_GRACE_MS = 900;

const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  RB: 5,
  LT: 6,
  START: 9,
  L3: 10,
} as const;

/** One couch player's assigned pad. Slot 0 is the keyboard and has no seat here. */
export interface LocalSeat {
  slot: number;
  padIndex: number;
  name: string;
  padName: string;
  connected: boolean;
  missingSince: number;
}

interface PadState {
  prev: boolean[];
  held: number;
  latched: boolean;
  frame: InputFrame;
}

function padLabel(pad: Gamepad): string {
  const id = pad.id.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return (id || `PAD ${pad.index + 1}`).slice(0, 34).toUpperCase();
}

/**
 * Local drop-in seats. P1 is always keyboard + mouse; every detected gamepad is
 * adopted as P2..P4 without a confirmation step, both on the setup screen and while
 * a match is live. A seat is kept through a short disconnect so a dropped pad can
 * reconnect to the same body instead of stealing a new slot.
 *
 * This owns only device assignment and per-pad frames. It never touches `World`;
 * the caller decides what a join means.
 */
export class LocalSeats {
  readonly seats: LocalSeat[] = [];
  readonly maxSeats = MAX_LOCAL_SEATS;
  /** Called after a pad is adopted, never for the keyboard. */
  onJoin: ((seat: LocalSeat) => void) | null = null;

  private states = new Map<number, PadState>();
  private pads = new Map<number, Haptics>();

  /** Drops every seat. The next poll re-adopts whatever is plugged in. */
  reset(): void {
    this.seats.length = 0;
    this.states.clear();
  }

  /**
   * Adopts every connected pad that does not already own a seat, and ages out
   * disconnected ones. Safe to call every frame; it allocates only on a join.
   */
  poll(now = performance.now()): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const present = new Set<number>();
    for (const pad of pads) {
      if (!pad || !pad.connected || pad.buttons.length === 0) continue;
      present.add(pad.index);
      const existing = this.seats.find((seat) => seat.padIndex === pad.index);
      if (existing) {
        if (!existing.connected) {
          existing.connected = true;
          existing.padName = padLabel(pad);
          // Drop the cached button state so a reconnect cannot fire a held edge.
          this.states.delete(pad.index);
        }
        existing.missingSince = 0;
        continue;
      }
      if (this.seats.length + 1 >= this.maxSeats) continue;
      const free = this.freeSlots();
      if (free.length === 0) continue;
      const slot = free[0];
      const seat: LocalSeat = {
        slot,
        padIndex: pad.index,
        name: `P${slot + 1}`,
        padName: padLabel(pad),
        connected: true,
        missingSince: 0,
      };
      this.seats.push(seat);
      this.onJoin?.(seat);
    }

    for (const seat of this.seats) {
      if (present.has(seat.padIndex)) continue;
      if (seat.missingSince === 0) seat.missingSince = now;
      if (seat.connected && now - seat.missingSince > DISCONNECT_GRACE_MS) {
        seat.connected = false;
        this.states.delete(seat.padIndex);
      }
    }
  }

  /** Slots a new pad could take: 1..maxSeats-1, excluding occupied ones. */
  freeSlots(): number[] {
    const used = new Set(this.seats.map((seat) => seat.slot));
    const free: number[] = [];
    for (let slot = 1; slot < this.maxSeats; slot++) if (!used.has(slot)) free.push(slot);
    return free;
  }

  /** Every local slot in seat order, keyboard first. */
  slots(): number[] {
    const out = [0];
    for (const seat of this.seats) out.push(seat.slot);
    return out;
  }

  activeCount(): number {
    return 1 + this.seats.length;
  }

  /** Cheap change detector so a menu only rebuilds its seat rows on a real event. */
  signature(): string {
    let sig = 'P1';
    for (const seat of this.seats) sig += `|${seat.slot}:${seat.padIndex}:${seat.connected ? 1 : 0}`;
    return sig;
  }

  /**
   * Builds one frame per local slot. `out` must be MAX_PLAYERS long; slots with no
   * seat are left null so `World.step` treats them as empty, exactly like bots that
   * are not present.
   */
  writeFrames(keyboard: InputFrame, out: (InputFrame | null)[]): void {
    for (let i = 0; i < out.length; i++) out[i] = null;
    out[0] = keyboard;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const seat of this.seats) {
      if (!seat.connected) continue;
      const pad = pads[seat.padIndex];
      if (!pad || !pad.connected) continue;
      out[seat.slot] = this.samplePad(pad);
    }
  }

  /** Haptics for the pad that owns `slot`; keyboard and missing pads are silent. */
  rumble(slot: number, cue: RumbleCue): void {
    const seat = this.seats.find((s) => s.slot === slot && s.connected);
    if (!seat) return;
    let rumble = this.pads.get(seat.padIndex);
    if (!rumble) {
      const padIndex = seat.padIndex;
      rumble = new Haptics(() => {
        if (!navigator.getGamepads) return null;
        const pad = navigator.getGamepads()[padIndex] ?? null;
        return pad && pad.connected ? pad : null;
      });
      this.pads.set(seat.padIndex, rumble);
    }
    rumble.play(cue);
  }

  private samplePad(pad: Gamepad): InputFrame {
    let st = this.states.get(pad.index);
    if (!st) {
      st = { prev: new Array(16).fill(false), held: 0, latched: false, frame: { mx: 0, my: 0, held: 0, pressed: 0 } };
      this.states.set(pad.index, st);
    }
    const btn = (i: number): boolean => !!pad.buttons[i]?.pressed;
    const axes = pad.axes;

    let x = axes[0] ?? 0;
    let y = axes[1] ?? 0;
    const mag = Math.hypot(x, y);
    if (mag < DEADZONE) {
      x = 0;
      y = 0;
    } else {
      const scaled = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE));
      x = (x / mag) * scaled;
      y = (y / mag) * scaled;
    }

    let held = 0;
    if (btn(PAD.B)) held |= ACTION.SWING;
    if (btn(PAD.X)) held |= ACTION.BOLT;
    if (btn(PAD.Y)) held |= ACTION.CANDLE;
    if (btn(PAD.LT) || (axes[4] ?? 0) > 0.5) held |= ACTION.LOCK;
    if (btn(PAD.A) || btn(PAD.L3)) held |= ACTION.DASH;

    let pressed = held & ~st.held;
    if (btn(PAD.RB) && !st.prev[PAD.RB]) pressed |= ACTION.LOCK_NEXT;
    const rx = axes[2] ?? 0;
    const threshold = st.latched ? 0.3 : 0.6;
    if (!st.latched && Math.abs(rx) > threshold) {
      pressed |= rx > 0 ? ACTION.LOCK_NEXT : ACTION.LOCK_PREV;
      st.latched = true;
    } else if (st.latched && Math.abs(rx) < 0.3) {
      st.latched = false;
    }

    st.prev[PAD.RB] = btn(PAD.RB);
    st.held = held;
    st.frame.mx = x;
    st.frame.my = y;
    st.frame.held = held;
    st.frame.pressed = pressed;
    return st.frame;
  }
}
