import type { Rect } from './config';

export interface CircleRectHit {
  nx: number;
  ny: number;
  px: number;
  py: number;
}

/** Shared scratch result; callers must copy what they need before the next call. */
export const hitScratch: CircleRectHit = { nx: 0, ny: 0, px: 0, py: 0 };

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
