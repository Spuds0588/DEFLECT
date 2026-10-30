import { HAPTICS } from './config';

export type RumbleCue = 'tap' | 'guard' | 'hit' | 'blast' | 'heavy' | 'death';

interface RumbleEffect {
  startDelay: number;
  duration: number;
  strongMagnitude: number;
  weakMagnitude: number;
}

interface RumbleActuator {
  /** Standard Gamepad API: `vibrationActuator.playEffect('dual-rumble', ...)`. */
  playEffect?: (type: string, params: RumbleEffect) => Promise<unknown> | void;
  /** Older Chrome/Edge surfaces expose `hapticActuators[n].pulse`. */
  pulse?: (value: number, duration: number) => Promise<unknown> | void;
  reset?: () => Promise<unknown> | void;
}

type RumblePad = Gamepad & {
  vibrationActuator?: RumbleActuator | null;
  hapticActuators?: RumbleActuator[] | null;
};

/**
 * Controller haptics through the Gamepad API. A pad without an actuator is silent,
 * and every promise is swallowed: rumble must never affect gameplay or crash on a
 * browser that exposes only part of the API. Cues and strengths live in
 * `tuning/world.json` under HAPTICS.
 */
export class Haptics {
  enabled = true;
  private lastPlayAt = 0;

  constructor(private pad: () => Gamepad | null) {}

  setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    if (!on) this.stop();
  }

  play(cue: RumbleCue): void {
    if (!this.enabled) return;
    const pad = this.pad();
    if (!pad) return;
    const now = performance.now();
    // A frame can emit a swing, a hit and a death at once. Keep the light cues from
    // stacking; the death thump is always allowed through.
    if (cue !== 'death' && now - this.lastPlayAt < 55) return;
    const spec = HAPTICS[cue];

    const actuator = (pad as RumblePad).vibrationActuator;
    if (actuator?.playEffect) {
      try {
        const result = actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: spec.duration,
          strongMagnitude: spec.strong,
          weakMagnitude: spec.weak,
        });
        if (result) void result.catch(() => {});
        this.lastPlayAt = now;
        return;
      } catch {
        // A pad can expose the actuator but reject the effect synchronously. Fall
        // through to the legacy surface instead of losing the cue.
      }
    }

    const legacy = (pad as RumblePad).hapticActuators?.[0];
    if (legacy?.pulse) {
      try {
        const result = legacy.pulse((spec.strong + spec.weak) * 0.5, spec.duration);
        if (result) void result.catch(() => {});
        this.lastPlayAt = now;
      } catch {
        // Unsupported pad: silent by design.
      }
    }
  }

  /** Stops a cue in progress when the player turns rumble off. */
  private stop(): void {
    const pad = this.pad();
    if (!pad) return;
    const actuator = (pad as RumblePad).vibrationActuator;
    try {
      const result = actuator?.reset?.();
      if (result) void result.catch(() => {});
    } catch {
      /* silent */
    }
  }
}
