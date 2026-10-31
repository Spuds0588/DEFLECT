import { BUG, COMPRESS, GHOST, PLAYER, WEDGE, type Bounds, type Rect } from './config';
import type { ArenaDef } from './arenas';
import { circleRect, hitScratch } from './collision';
import type { Player } from './types';

/**
 * Shared kinematic step used by the authoritative world and the guest's local prediction.
 * Facing is derived from movement (single-stick), locked while swinging or dashing.
 * `solids` is cover plus any floor gaps; a dodge phases both. `openWalls` drops the
 * arena wall so a body can be carried over the lip; the world turns that into a fall.
 */
export function stepPlayerMotion(
  p: Player,
  mx: number,
  my: number,
  dt: number,
  solids: readonly Rect[],
  bounds: Bounds,
  openWalls = false,
): void {
  const movingSq = mx * mx + my * my;

  if (p.wedgeT > 0) {
    // Wedge's plow is a committed straight line. No steering, no turn.
    p.vx = p.wedgeDirX * WEDGE.chargeSpeed;
    p.vy = p.wedgeDirY * WEDGE.chargeSpeed;
    p.facing = Math.atan2(p.wedgeDirY, p.wedgeDirX);
  } else if (p.dashT > 0) {
    const speed = p.dashKind === 1 ? PLAYER.chargeDashSpeed : PLAYER.dashSpeed;
    p.vx = p.dashDirX * speed;
    p.vy = p.dashDirY * speed;
    p.facing = Math.atan2(p.dashDirY, p.dashDirX);
  } else {
    if (movingSq > 0.0025 && p.swingPhase === 0) {
      p.facing = Math.atan2(my, mx);
    }
    if (p.lockActive) p.facing = p.lockFacing;
    const slow =
      p.swingPhase === 3
        ? PLAYER.whiffSlow
        : p.swingPhase !== 0
          ? PLAYER.swingSlow
          : 1;
    const trapFactor = p.slowT > 0 ? BUG.trapSlow : 1;
    // A caught body can still turn and look around, but its feet are webbed.
    const held = p.netPinT > 0 ? 0 : 1;
    // Time effects scale walking only. Dashes and plows are committed shapes with
    // their own distance, so fast-forward does not turn one into a cross-arena leap.
    // Ghost's bite daze is a heavy-footed wobble, not a root: the victim can still
    // turn and answer, just late.
    const dazeFactor = p.dazeT > 0 ? GHOST.shotDazeSlow : 1;
    // Compress's skill folds the body small so it covers ground fast. It is a walking
    // multiplier, not a dash: dashes and plows keep their own committed distances.
    const compressFactor = p.shrinkT > 0 ? COMPRESS.skillSpeed : 1;
    const tx = held * mx * PLAYER.speed * slow * trapFactor * p.speedMult * dazeFactor * compressFactor;
    const ty = held * my * PLAYER.speed * slow * trapFactor * p.speedMult * dazeFactor * compressFactor;
    const k = 1 - Math.exp(-PLAYER.accel * dt);
    p.vx += (tx - p.vx) * k;
    p.vy += (ty - p.vy) * k;
  }

  p.x += (p.vx + p.kx) * dt;
  p.y += (p.vy + p.ky) * dt;
  p.kx *= Math.exp(-PLAYER.knockDrag * dt);
  p.ky *= Math.exp(-PLAYER.knockDrag * dt);

  // Arena bounds. An open arena has no wall to stop at, so the body is left past the
  // lip for the world to read as a fall.
  const r = PLAYER.radius;
  if (!openWalls) {
    const minX = bounds.left + r;
    const maxX = bounds.right - r;
    const minY = bounds.top + r;
    const maxY = bounds.bottom - r;
    if (p.x < minX) {
      p.x = minX;
      if (p.vx < 0) p.vx = 0;
    } else if (p.x > maxX) {
      p.x = maxX;
      if (p.vx > 0) p.vx = 0;
    }
    if (p.y < minY) {
      p.y = minY;
      if (p.vy < 0) p.vy = 0;
    } else if (p.y > maxY) {
      p.y = maxY;
      if (p.vy > 0) p.vy = 0;
    }
  }

  // Both dodge kinds phase through cover; the charged dash is the damaging one.
  if (p.dashT <= 0) {
    for (let i = 0; i < solids.length; i++) {
      if (circleRect(p.x, p.y, r, solids[i], hitScratch)) {
        p.x = hitScratch.px;
        p.y = hitScratch.py;
        const vn = p.vx * hitScratch.nx + p.vy * hitScratch.ny;
        if (vn < 0) {
          p.vx -= vn * hitScratch.nx;
          p.vy -= vn * hitScratch.ny;
        }
      }
    }
  }
}

/** Evenly spreads the arena's ordered perimeter spawns for any active player count. */
export function computeSpawns(
  count: number,
  arena: ArenaDef,
  x: Float32Array,
  y: Float32Array,
): void {
  const n = Math.max(1, count);
  const total = arena.spawns.length;
  for (let i = 0; i < n; i++) {
    const point = arena.spawns[Math.floor((i * total) / n) % total];
    x[i] = point.x;
    y[i] = point.y;
  }
}
