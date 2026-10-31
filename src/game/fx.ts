import {
  ParticleSystem,
  P_COLOR_BLAST_ORANGE,
  P_COLOR_BLAST_RED,
  P_COLOR_BUFFER,
  P_COLOR_COMPRESS,
  P_COLOR_DANGER,
  P_COLOR_DUST,
  P_COLOR_FIREWALL,
  P_COLOR_ICE,
  P_COLOR_VIRUS,
  P_COLOR_WHITE,
  P_COLOR_WORM,
} from './particles';
import { COMPRESS, MINE, PLAYER } from './config';
import { POWERUPS } from './powerups';
import { EV, type GameEvent } from './types';

/**
 * Local visual feedback: particles, shake, flash. Driven by replicated game events so
 * every client reacts to the same moments.
 */
export class Fx {
  readonly particles = new ParticleSystem();
  shake = 0;
  shakeX = 0;
  shakeY = 0;
  /** Screen tilt in radians on a local hit; scaled by the settings slider. */
  rotationShake = 0;
  rotationScale = 1;
  /** Global multiplier for the white impact flash, from the settings screen. */
  flashScale = 1;
  flash = 0;
  flashColor = '#ffffff';

  reset(): void {
    this.shake = 0;
    this.flash = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.rotationShake = 0;
  }

  update(dt: number): void {
    this.particles.update(dt);
    this.shake *= Math.exp(-10 * dt);
    if (this.shake < 0.05) this.shake = 0;
    this.shakeX = (Math.random() * 2 - 1) * this.shake;
    this.shakeY = (Math.random() * 2 - 1) * this.shake;
    this.rotationShake *= Math.exp(-13 * dt);
    if (Math.abs(this.rotationShake) < 0.0004) this.rotationShake = 0;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
  }

  /** A short tilt with a random side; called only when the local avatar loses health. */
  triggerHitRotation(): void {
    if (this.rotationScale <= 0) return;
    const amp = 0.022 * this.rotationScale;
    this.rotationShake = (Math.random() < 0.5 ? -1 : 1) * amp;
  }

  handle(ev: GameEvent): void {
    const color = ev.slot >= 0 ? ev.slot : P_COLOR_ICE;
    switch (ev.kind) {
      case EV.SHOOT: {
        this.particles.cone(ev.x, ev.y, ev.power + Math.PI, 4, color, 300, 0.85);
        break;
      }
      case EV.PLANT_MINE: {
        this.particles.cone(ev.x, ev.y, ev.power + Math.PI, 7, color, 220, 1.1);
        this.particles.ring(ev.x, ev.y, color, 5, 40, 0.18);
        break;
      }
      case EV.DEFLECT: {
        this.particles.burst(ev.x, ev.y, 16, color, 140, 620);
        this.particles.ring(ev.x, ev.y, color, 6, 120, 0.28);
        this.shake = Math.max(this.shake, 4);
        this.flash = Math.max(this.flash, 0.16);
        this.flashColor = '#ffffff';
        break;
      }
      case EV.SHIELD_WAVE: {
        this.particles.cone(ev.x, ev.y, ev.power, 10, color, 260, 0.6);
        this.particles.ring(ev.x, ev.y, color, 8, PLAYER.waveRange * 0.9, 0.3);
        this.shake = Math.max(this.shake, 5);
        this.flash = Math.max(this.flash, 0.12);
        this.flashColor = '#ffffff';
        break;
      }
      case EV.BOUNCE: {
        if (ev.power > 0) this.particles.burst(ev.x, ev.y, 3, color, 60, 220);
        break;
      }
      case EV.EXPLODE: {
        // Blasts are hot metal: strictly red and orange, no owner colour and no white, so
        // a detonation never reads as another body's death shards.
        const scale = Math.max(0.8, Math.min(2.2, ev.power / 90));
        const shards = Math.round(14 + 12 * scale);
        const hot = Math.round(shards * 0.65);
        this.particles.ring(ev.x, ev.y, P_COLOR_BLAST_ORANGE, 10, ev.power * 3.2, 0.36);
        this.particles.ring(ev.x, ev.y, P_COLOR_BLAST_RED, 4, ev.power * 1.8, 0.24);
        this.particles.shards(ev.x, ev.y, hot, P_COLOR_BLAST_ORANGE, 120, 720 * scale);
        this.particles.shards(ev.x, ev.y, shards - hot, P_COLOR_BLAST_RED, 140, 780 * scale);
        this.particles.burst(ev.x, ev.y, Math.round(10 + 6 * scale), P_COLOR_BLAST_ORANGE, 180, 760 * scale);
        this.particles.burst(ev.x, ev.y, 5, P_COLOR_BLAST_RED, 100, 420);
        this.shake = Math.max(this.shake, 7 + 4 * scale);
        this.flash = Math.max(this.flash, 0.24 + 0.08 * scale);
        this.flashColor = '#ffb27a';
        break;
      }
      case EV.WORM_KILL: {
        const scale = Math.max(1, Math.min(2.6, ev.power / 100));
        this.particles.ring(ev.x, ev.y, P_COLOR_WORM, 12, 90 + ev.power * 0.7, 0.5);
        this.particles.shards(ev.x, ev.y, Math.round(17 + 15 * scale), P_COLOR_WORM, 100, 520 * scale);
        this.particles.shards(ev.x, ev.y, Math.round(8 + 8 * scale), P_COLOR_WHITE, 80, 420 * scale);
        this.particles.burst(ev.x, ev.y, Math.round(10 + 6 * scale), P_COLOR_DANGER, 120, 680 * scale);
        this.shake = Math.max(this.shake, 8 + 5 * scale);
        this.flash = Math.max(this.flash, 0.28);
        this.flashColor = '#ffd6ce';
        break;
      }
      case EV.VIRUS_KILL: {
        this.particles.ring(ev.x, ev.y, P_COLOR_VIRUS, 8, 70 + ev.power * 2, 0.42);
        this.particles.shards(ev.x, ev.y, 13, P_COLOR_VIRUS, 90, 390);
        this.particles.burst(ev.x, ev.y, 6, P_COLOR_WHITE, 80, 320);
        break;
      }
      case EV.HIT: {
        this.particles.impact(ev.x, ev.y, ev.dirX, ev.dirY, P_COLOR_DANGER, 20);
        this.particles.burst(ev.x, ev.y, 6, P_COLOR_WHITE, 90, 320);
        this.particles.ring(ev.x, ev.y, color, 8, 72, 0.2);
        this.shake = Math.max(this.shake, 6);
        this.flash = Math.max(this.flash, 0.1);
        this.flashColor = '#ffffff';
        break;
      }
      case EV.DISSOLVE: {
        // A shot that simply ran out of range breaks into a small shard fizzle. Bigger
        // shapes (spear, broom, needle, mouth, hourglass) leave a few more pieces than
        // a bolt, and hostile fire uses the danger tint instead of a program colour.
        const tint = ev.slot >= 0 ? ev.slot : P_COLOR_DANGER;
        const bits = ev.power >= 5 ? 6 : 4;
        this.particles.shards(ev.x, ev.y, bits, tint, 24, 110);
        this.particles.burst(ev.x, ev.y, 4, tint, 18, 80);
        this.particles.burst(ev.x, ev.y, 2, P_COLOR_WHITE, 12, 50);
        this.particles.ring(ev.x, ev.y, tint, 2, 18, 0.16);
        break;
      }
      case EV.WORM_HIT: {
        this.particles.impact(ev.x, ev.y, ev.dirX, ev.dirY, P_COLOR_WORM, 12);
        this.shake = Math.max(this.shake, 2.5);
        break;
      }
      case EV.VIRUS_HIT: {
        this.particles.impact(ev.x, ev.y, ev.dirX, ev.dirY, P_COLOR_VIRUS, 12);
        break;
      }
      case EV.EAT: {
        this.particles.ring(ev.x, ev.y, P_COLOR_WORM, 5, 46, 0.26);
        this.particles.shards(ev.x, ev.y, 7, P_COLOR_WORM, 60, 280);
        break;
      }
      case EV.VIRUS_SPLIT: {
        this.particles.ring(ev.x, ev.y, P_COLOR_VIRUS, 6, 66, 0.34);
        this.particles.impact(ev.x, ev.y, 1, 0, P_COLOR_VIRUS, 5);
        break;
      }
      case EV.INFECT: {
        this.particles.ring(ev.x, ev.y, P_COLOR_VIRUS, 18, 42 + ev.power * 30, 0.36);
        this.particles.shards(ev.x, ev.y, 8, P_COLOR_VIRUS, 80, 300);
        break;
      }
      case EV.FIREWALL: {
        this.particles.ring(ev.x, ev.y, P_COLOR_FIREWALL, 12, 52, 0.3);
        break;
      }
      case EV.THRALL: {
        this.particles.ring(ev.x, ev.y, P_COLOR_VIRUS, 10, 190, 0.55);
        this.particles.shards(ev.x, ev.y, 16, P_COLOR_VIRUS, 80, 420);
        this.shake = Math.max(this.shake, 7);
        this.flash = Math.max(this.flash, 0.2);
        this.flashColor = '#ffb6ee';
        break;
      }
      case EV.DASH: {
        for (let i = 0; i < 3; i++) {
          this.particles.spawn(3, ev.x, ev.y, 0, 0, 0.28 + i * 0.04, 16, color);
        }
        break;
      }
      case EV.ELIMINATED: {
        this.particles.ring(ev.x, ev.y, color, 8, 220, 0.5);
        this.particles.shards(ev.x, ev.y, 22, color, 80, 540);
        this.particles.burst(ev.x, ev.y, 12, P_COLOR_WHITE, 100, 460);
        this.shake = Math.max(this.shake, 12);
        this.flash = Math.max(this.flash, 0.28);
        this.flashColor = '#ffffff';
        break;
      }
      case EV.RESPAWN: {
        this.particles.ring(ev.x, ev.y, color, 6, 170, 0.45);
        this.particles.burst(ev.x, ev.y, 8, color, 60, 260);
        break;
      }
      case EV.DRONE_SHOOT: {
        this.particles.cone(ev.x, ev.y, ev.power, 4, P_COLOR_ICE, 200, 0.6);
        break;
      }
      case EV.ROUND_START: {
        this.particles.ring(ev.x, ev.y, P_COLOR_ICE, 40, MINE.blastRadius * 2.2, 0.7);
        break;
      }
      case EV.LASER: {
        this.particles.cone(ev.x, ev.y, ev.power, 12, P_COLOR_WHITE, 520, 0.35);
        this.particles.ring(ev.x, ev.y, color, 10, 120, 0.55);
        this.shake = Math.max(this.shake, 7);
        break;
      }
      case EV.BEAM_END: {
        // A switched-off overcharge beam sheds embers along its shaft and a small puff
        // where it stopped, so a quick tap release does not blink the light out.
        const reach = Math.max(24, Math.min(ev.power, PLAYER.laserRange));
        const ax = ev.dirX;
        const ay = ev.dirY;
        const px = -ay;
        const py = ax;
        const bits = Math.max(6, Math.min(22, Math.round(reach / 44)));
        for (let i = 0; i < bits; i++) {
          const along = ((i + 0.5) / bits) * reach;
          const side = (Math.random() - 0.5) * PLAYER.laserHalfWidth * 1.8;
          this.particles.spawn(
            0,
            ev.x + ax * along + px * side,
            ev.y + ay * along + py * side,
            px * (Math.random() - 0.5) * 120 + ax * 42,
            py * (Math.random() - 0.5) * 120 + ay * 42,
            0.22 + Math.random() * 0.4,
            1 + Math.random() * 1.6,
            i % 5 === 0 ? P_COLOR_WHITE : color,
            3.2,
          );
        }
        const endX = ev.x + ax * reach;
        const endY = ev.y + ay * reach;
        this.particles.burst(endX, endY, 6, color, 40, 170);
        this.particles.burst(endX, endY, 3, P_COLOR_WHITE, 30, 120);
        this.particles.ring(endX, endY, color, 3, 34, 0.2);
        break;
      }
      case EV.COMPRESS: {
        // `power` is the new body scale; 0 marks the heavy burst, which gets the wide
        // ring. A hit gets a small squeeze pop on the victim instead.
        if (ev.power <= 0) {
          this.particles.ring(ev.x, ev.y, P_COLOR_COMPRESS, 14, COMPRESS.powerRadius * 0.92, 0.55);
          this.particles.ring(ev.x, ev.y, P_COLOR_WHITE, 4, COMPRESS.powerRadius * 0.5, 0.32);
          this.particles.burst(ev.x, ev.y, 14, P_COLOR_COMPRESS, 80, 380);
          this.shake = Math.max(this.shake, 8);
          this.flash = Math.max(this.flash, 0.16);
          this.flashColor = '#e8ccff';
        } else {
          const size = Math.max(0.4, Math.min(1, ev.power));
          this.particles.ring(ev.x, ev.y, P_COLOR_COMPRESS, 5, 18 + 26 * size, 0.24);
          this.particles.burst(ev.x, ev.y, 5, P_COLOR_COMPRESS, 40, 180);
          this.shake = Math.max(this.shake, 2);
        }
        break;
      }
      case EV.ERROR_SPAWN: {
        this.particles.ring(ev.x, ev.y, P_COLOR_FIREWALL, 6, 56, 0.45);
        this.particles.shards(ev.x, ev.y, 5, P_COLOR_FIREWALL, 40, 150);
        break;
      }
      case EV.ERROR_HIT: {
        this.particles.impact(ev.x, ev.y, ev.dirX, ev.dirY, P_COLOR_FIREWALL, 8);
        break;
      }
      case EV.ERROR_BREAK: {
        this.particles.ring(ev.x, ev.y, P_COLOR_FIREWALL, 8, 80, 0.35);
        this.particles.shards(ev.x, ev.y, 14, P_COLOR_FIREWALL, 70, 320);
        this.particles.burst(ev.x, ev.y, 5, P_COLOR_DANGER, 60, 260);
        break;
      }
      case EV.SENTRY_SHOOT: {
        this.particles.cone(ev.x, ev.y, ev.power, 3, P_COLOR_DANGER, 220, 0.55);
        break;
      }
      case EV.SENTRY_HIT: {
        this.particles.impact(ev.x, ev.y, ev.dirX, ev.dirY, P_COLOR_DANGER, 9);
        this.shake = Math.max(this.shake, 2);
        break;
      }
      case EV.SENTRY_KILL: {
        const scale = Math.max(0.75, Math.min(1.8, ev.power / 80));
        this.particles.ring(ev.x, ev.y, P_COLOR_DANGER, 7, 64 + ev.power * 0.3, 0.34);
        this.particles.shards(ev.x, ev.y, Math.round(10 + 8 * scale), P_COLOR_DANGER, 80, 360 * scale);
        this.particles.burst(ev.x, ev.y, Math.round(4 + 4 * scale), P_COLOR_WHITE, 80, 280 * scale);
        this.shake = Math.max(this.shake, 4 + scale);
        break;
      }
      case EV.POWERUP: {
        const def = POWERUPS[ev.power];
        const tint = def ? def.color : '#ffffff';
        this.particles.ring(ev.x, ev.y, color, 9, 92, 0.42);
        this.particles.burst(ev.x, ev.y, 12, color, 80, 300);
        this.particles.ring(ev.x, ev.y, color, 4, 42, 0.24);
        this.flash = Math.max(this.flash, 0.08);
        this.flashColor = tint;
        break;
      }
      case EV.HEAL: {
        this.particles.ring(ev.x, ev.y, color, 8, 96, 0.45);
        this.particles.burst(ev.x, ev.y, 10, P_COLOR_WHITE, 40, 180);
        break;
      }
      case EV.PROP_HIT: {
        this.particles.impact(ev.x, ev.y, ev.dirX, ev.dirY, P_COLOR_DUST, 6);
        this.particles.burst(ev.x, ev.y, 3, P_COLOR_WHITE, 40, 160);
        break;
      }
      case EV.PROP_BREAK: {
        const shards = Math.max(4, Math.min(14, Math.round(ev.power * 0.28)));
        this.particles.shards(ev.x, ev.y, shards, P_COLOR_DUST, 60, 300);
        this.particles.ring(ev.x, ev.y, P_COLOR_DUST, 4, ev.power * 1.2, 0.22);
        break;
      }
      case EV.TIME_WARP: {
        // An hourglass burst: two counter-rotating rings plus a short white core. Fast
        // forward and dilation share it, so one effect owns "Bad Lag spent a cooldown".
        this.particles.ring(ev.x, ev.y, P_COLOR_BUFFER, 16, 190, 0.5);
        this.particles.ring(ev.x, ev.y, P_COLOR_BUFFER, 8, 120, 0.36);
        this.particles.ring(ev.x, ev.y, P_COLOR_WHITE, 4, 66, 0.24);
        this.particles.shards(ev.x, ev.y, 16, P_COLOR_BUFFER, 90, 420);
        this.particles.burst(ev.x, ev.y, 8, P_COLOR_WHITE, 60, 240);
        this.shake = Math.max(this.shake, 5);
        this.flash = Math.max(this.flash, 0.16);
        this.flashColor = '#ffd7f2';
        break;
      }
      case EV.WALL_BREAK: {
        this.particles.shards(ev.x, ev.y, 18, P_COLOR_DANGER, 90, 420);
        this.particles.ring(ev.x, ev.y, P_COLOR_DANGER, 9, ev.power * 1.4, 0.3);
        this.particles.burst(ev.x, ev.y, 8, P_COLOR_WHITE, 70, 300);
        this.shake = Math.max(this.shake, 6);
        this.flash = Math.max(this.flash, 0.12);
        this.flashColor = '#ffd9b0';
        break;
      }
      default:
        break;
    }
  }
}
