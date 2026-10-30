/**
 * Camera rigs are deliberate overrides of the normal framing: a boss entrance, a
 * narrative beat, a pack dropping in from off-screen. The director holds a small
 * fixed pool, blends the highest-priority active rig in and out, and hands control
 * back to the default camera when it expires. No allocation in `update()`.
 */

export interface CameraRig {
  /** World point to frame. Ignored when `followSlot` is a live player. */
  x: number;
  y: number;
  /** -1 keeps the fixed point; a slot number follows that player as it moves. */
  followSlot?: number;
  /** Multiplier on the default zoom. 0.9 pulls back, 1.1 pushes in. */
  zoom: number;
  /** Seconds held at full blend after the in-blend. */
  hold: number;
  /** Seconds to ease in and back out. */
  blendIn: number;
  blendOut: number;
  /** Peak blend, 0..1. A partial look-ahead is ~0.4; a cutscene is 1. */
  weight: number;
  /** Higher wins when rigs overlap. */
  priority: number;
}

interface RigSlot extends CameraRig {
  followSlot: number;
  active: boolean;
  t: number;
  serial: number;
}

const RIG_POOL = 4;

function emptyRig(): RigSlot {
  return {
    active: false,
    x: 0,
    y: 0,
    followSlot: -1,
    zoom: 1,
    hold: 0,
    blendIn: 0,
    blendOut: 0,
    weight: 1,
    priority: 0,
    t: 0,
    serial: 0,
  };
}

export class CameraDirector {
  private rigs: RigSlot[] = [];
  private nextSerial = 1;

  /** Sampled state for the current frame, after `update`. */
  active = false;
  x = 0;
  y = 0;
  zoom = 1;
  blend = 0;
  followSlot = -1;

  constructor() {
    for (let i = 0; i < RIG_POOL; i++) this.rigs.push(emptyRig());
  }

  /**
   * Starts a rig. Prefers a free slot, then the lowest-priority active rig, so a
   * boss intro can replace a wave look-ahead but not the other way around.
   */
  play(rig: CameraRig): void {
    let target = this.rigs[0];
    for (let i = 0; i < this.rigs.length; i++) {
      const r = this.rigs[i];
      if (!r.active) {
        target = r;
        break;
      }
      if (r.priority < target.priority || (r.priority === target.priority && r.serial < target.serial)) {
        target = r;
      }
    }
    target.active = true;
    target.x = rig.x;
    target.y = rig.y;
    target.followSlot = rig.followSlot ?? -1;
    target.zoom = rig.zoom;
    target.hold = Math.max(0, rig.hold);
    target.blendIn = Math.max(0, rig.blendIn);
    target.blendOut = Math.max(0, rig.blendOut);
    target.weight = Math.max(0, Math.min(1, rig.weight));
    target.priority = rig.priority;
    target.t = 0;
    target.serial = this.nextSerial++;
    this.refresh();
  }

  /** Advances every active rig and picks the winner. Call once per rendered frame. */
  update(dt: number): void {
    for (let i = 0; i < this.rigs.length; i++) {
      const r = this.rigs[i];
      if (!r.active) continue;
      r.t += dt;
      if (r.t >= r.blendIn + r.hold + r.blendOut) r.active = false;
    }
    this.refresh();
  }

  clear(): void {
    for (let i = 0; i < this.rigs.length; i++) this.rigs[i].active = false;
    this.refresh();
  }

  private refresh(): void {
    let best: RigSlot | null = null;
    for (let i = 0; i < this.rigs.length; i++) {
      const r = this.rigs[i];
      if (!r.active) continue;
      if (
        !best ||
        r.priority > best.priority ||
        (r.priority === best.priority && r.serial > best.serial)
      ) {
        best = r;
      }
    }
    if (!best) {
      this.active = false;
      this.blend = 0;
      this.followSlot = -1;
      return;
    }
    const total = best.blendIn + best.hold + best.blendOut;
    const inT = best.blendIn > 0 ? Math.min(1, best.t / best.blendIn) : 1;
    const outT = best.blendOut > 0 ? Math.min(1, (total - best.t) / best.blendOut) : 1;
    const p = Math.max(0, Math.min(1, Math.min(inT, outT)));
    const eased = p * p * (3 - 2 * p);
    this.active = true;
    this.x = best.x;
    this.y = best.y;
    this.followSlot = best.followSlot;
    this.zoom = best.zoom;
    this.blend = eased * best.weight;
  }
}
