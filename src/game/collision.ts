import type { ArenaDef } from './arenas';
import { WEDGE, type Rect } from './config';
import type { Barrier } from './types';

export interface CircleRectHit {
  nx: number;
  ny: number;
  px: number;
  py: number;
}

/** Shared scratch result; callers must copy what they need before the next call. */
export const hitScratch: CircleRectHit = { nx: 0, ny: 0, px: 0, py: 0 };

/**
 * How far a straight beam reaches before it meets something solid. Used by both the
 * heavy beam's damage test and its drawing, so the visible shaft and the hit test end
 * on the same surface.
 *
 * Pillars, deployed walls, the compactor plate and a walled arena's bounds are solid;
 * a chasm or an open lip is not (a beam flies over the drop). Barriers are thin walls,
 * so the ray-segment crossing is expanded by half the plate's thickness.
 * Allocation-free; returns `max` when nothing is in the way.
 */
export function beamReach(
  arena: ArenaDef,
  barriers: readonly Barrier[] | null | undefined,
  pusherActive: boolean,
  pusherY: number,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  max: number,
): number {
  let best = max;

  // Arena bounds on a walled floor. An open arena has no wall to stop the beam, but a
  // round platter still has a rim, so the shaft ends where the floor does.
  const disc = arena.disc;
  if (disc) {
    const cx = (arena.bounds.left + arena.bounds.right) * 0.5;
    const cy = (arena.bounds.top + arena.bounds.bottom) * 0.5;
    const rx = ox - cx;
    const ry = oy - cy;
    const b = rx * dx + ry * dy;
    const c = rx * rx + ry * ry - disc.radius * disc.radius;
    const t = -b + Math.sqrt(Math.max(0, b * b - c));
    if (t > 0) best = Math.min(best, t);
  } else if (arena.walls !== 'open') {
    const b = arena.bounds;
    if (dx < -1e-6) best = Math.min(best, (b.left - ox) / dx);
    else if (dx > 1e-6) best = Math.min(best, (b.right - ox) / dx);
    if (dy < -1e-6) best = Math.min(best, (b.top - oy) / dy);
    else if (dy > 1e-6) best = Math.min(best, (b.bottom - oy) / dy);
  }

  // Pillars: ray vs slab, keeping the near entry distance.
  for (let i = 0; i < arena.pillars.length; i++) {
    const r = arena.pillars[i];
    let tmin = 0;
    let tmax = best;
    if (Math.abs(dx) < 1e-6) {
      if (ox < r.x || ox > r.x + r.w) continue;
    } else {
      let t1 = (r.x - ox) / dx;
      let t2 = (r.x + r.w - ox) / dx;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }
    if (Math.abs(dy) < 1e-6) {
      if (oy < r.y || oy > r.y + r.h) continue;
    } else {
      let t1 = (r.y - oy) / dy;
      let t2 = (r.y + r.h - oy) / dy;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
    }
    if (tmin > 0 && tmin < best) best = tmin;
  }

  // Deployed walls are line segments. Pad the segment's parameter range by half the
  // plate thickness so a beam that grazes the end still stops on the wall.
  if (barriers) {
    const half = WEDGE.wallThickness * 0.5;
    for (let i = 0; i < barriers.length; i++) {
      const wall = barriers[i];
      if (!wall.active) continue;
      const sx = wall.x2 - wall.x1;
      const sy = wall.y2 - wall.y1;
      const denom = dx * sy - dy * sx;
      if (Math.abs(denom) < 1e-6) continue;
      const wx = wall.x1 - ox;
      const wy = wall.y1 - oy;
      const t = (wx * sy - wy * sx) / denom;
      if (t <= 0 || t >= best) continue;
      const u = (wx * dy - wy * dx) / denom;
      const len = Math.hypot(sx, sy) || 1;
      const pad = half / len;
      if (u < -pad || u > 1 + pad) continue;
      best = t;
    }
  }

  // The compactor plate is a moving wall: a beam travelling up into it stops there.
  if (pusherActive && dy < -1e-6) {
    const t = (pusherY - oy) / dy;
    if (t > 0 && t < best) best = t;
  }

  return best;
}

/**
 * Circle vs axis-aligned rectangle. Fills `out` with the contact normal and the
 * closest non-overlapping center position. Returns false when not touching.
 * Allocation-free.
 */
export function circleRect(
  cx: number,
  cy: number,
  r: number,
  rect: Rect,
  out: CircleRectHit = hitScratch,
): boolean {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return false;

  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    out.nx = dx / d;
    out.ny = dy / d;
    out.px = nx + out.nx * r;
    out.py = ny + out.ny * r;
    return true;
  }

  // Center is inside the rectangle: eject through the nearest face.
  const dl = cx - rect.x;
  const dr = rect.x + rect.w - cx;
  const dt = cy - rect.y;
  const db = rect.y + rect.h - cy;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) {
    out.nx = -1;
    out.ny = 0;
    out.px = rect.x - r;
    out.py = cy;
  } else if (m === dr) {
    out.nx = 1;
    out.ny = 0;
    out.px = rect.x + rect.w + r;
    out.py = cy;
  } else if (m === dt) {
    out.nx = 0;
    out.ny = -1;
    out.px = cx;
    out.py = rect.y - r;
  } else {
    out.nx = 0;
    out.ny = 1;
    out.px = cx;
    out.py = rect.y + rect.h + r;
  }
  return true;
}
