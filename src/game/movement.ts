import { BUG, COMPRESS, GHOST, PLAYER, WEDGE, type Bounds, type Rect, } from './config';
import { MEMORY } from './memory';
import type { ArenaDef } from './arenas';
import { circleRect, hitScratch } from './collision';
import type { Player } from './types';

/**
 * Shared kinematic step used by the authoritative world and the guest's local prediction.
 * Facing is derived from movement (single-stick), locked while swinging or dashing.
 * `solids` is cover plus any floor gaps. A dash is airborne over the gaps, but it is
 * not a phase through solid cover: `dashSolids` is the hard-cover subset that still
 * stops it. `openWalls` drops the arena wall so a body can be carried over the lip;
 * the world turns that into a fall.
 */
export function stepPlayerMotion(
  p: Player,
  mx: number,
  my: number,
  dt: number,
  solids: readonly Rect[],
  bounds: Bounds,
  openWalls = false,
  dashSolids: readonly Rect[] = solids,
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
    const tx = held * mx * PLAYER.speed * slow * trapFactor * p.speedMult * dazeFactor * compressFactor *
      (1 + MEMORY.speedPerStack * p.memory);
    const ty = held * my * PLAYER.speed * slow * trapFactor * p.speedMult * dazeFactor * compressFactor *
      (1 + MEMORY.speedPerStack * p.memory);
    const k = 1 - Math.exp(-PLAYER.accel * dt);
    p.vx += (tx - p.vx) * k;
    p.vy += (ty - p.vy) * k;
  }

  const r = PLAYER.radius;
  const moveX = (p.vx + p.kx) * dt;
  const moveY = (p.vy + p.ky) * dt;
  // A dash is fast enough to skip a thin pillar in one frame. While it is airborne,
  // advance it in sub-radius steps and resolve the cover-only list after each one so
  // the first contact is always on the near side. A floor gap is absent from that list.
  if (p.dashT > 0 && dashSolids.length > 0) {
    const steps = Math.max(1, Math.ceil(Math.hypot(moveX, moveY) / (r * 0.5)));
    const stepX = moveX / steps;
    const stepY = moveY / steps;
    for (let i = 0; i < steps; i++) {
      p.x += stepX;
      p.y += stepY;
      pushOutOfSolids(p, dashSolids, r);
    }
  } else {
    p.x += moveX;
    p.y += moveY;
  }
  p.kx *= Math.exp(-PLAYER.knockDrag * dt);
  p.ky *= Math.exp(-PLAYER.knockDrag * dt);

  // Arena bounds. An open arena has no wall to stop at, so the body is left past the
  // lip for the world to read as a fall.
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

  // Both dodge kinds clear floor gaps, but neither goes through solid cover. The
  // caller supplies the cover-only list; ordinary walking still collides with both.
  pushOutOfSolids(p, p.dashT > 0 ? dashSolids : solids, r);
}

/** Resolve a body against a cover list without allocating. */
function pushOutOfSolids(p: Player, solids: readonly Rect[], r: number): void {
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
