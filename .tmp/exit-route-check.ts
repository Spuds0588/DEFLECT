/**
 * Split quarantine exits: every room is a flat device with a reachable right-wall
 * portal, and each ingress port stands on open floor. The old party-port prop is gone.
 */
import { ARENAS } from '../src/game/arenas';
import type { Rect } from '../src/game/arenas';

const rooms = [14, 34, 35, 36].map((id) => ARENAS.find((a) => a.id === id)!);
const problems: string[] = [];

for (const arena of rooms) {
  if (!arena) {
    problems.push('a split arena is missing');
    continue;
  }
  if (arena.islands || arena.bridges) problems.push(`${arena.name}: still declares plate/bridge geometry`);
  if (arena.port) problems.push(`${arena.name}: still declares a party-port prop`);
  if (arena.rooms?.length !== 1) problems.push(`${arena.name}: expected one room, got ${arena.rooms?.length ?? 0}`);

  const b = arena.bounds;
  const step = 16;
  const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  const inside = (r: Rect, x: number, y: number) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
  const walkable = (x: number, y: number): boolean => {
    if (x <= b.left || x >= b.right || y <= b.top || y >= b.bottom) return false;
    for (let i = 0; i < arena.pillars.length; i++) if (inside(arena.pillars[i], x, y)) return false;
    return true;
  };
  const start = arena.spawns[0];
  const seen = new Set<string>([key(start.x, start.y)]);
  const queue: [number, number][] = [[start.x, start.y]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]] as [number, number][]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!walkable(nx, ny)) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  const nearest = (x: number, y: number): number => {
    let best = Infinity;
    for (const k of seen) {
      const [kx, ky] = k.split(',').map(Number);
      best = Math.min(best, Math.hypot(kx - x, ky - y));
    }
    return best;
  };

  const portal = { x: b.right - 36, y: (b.top + b.bottom) * 0.5 };
  const portalReach = nearest(portal.x, portal.y);
  console.log(`${arena.name}: ${seen.size} cells // portal @${Math.round(portal.x)},${Math.round(portal.y)} nearest ${Math.round(portalReach)}`);
  if (portalReach > 40) problems.push(`${arena.name}: right-wall portal has no reachable floor beside it`);
  for (let i = 0; i < (arena.ingress?.length ?? 0); i++) {
    const p = arena.ingress![i];
    const d = nearest(p.x, p.y);
    console.log(`  ingress ${i} @${Math.round(p.x)},${Math.round(p.y)} nearest ${Math.round(d)}`);
    if (d > 40) problems.push(`${arena.name}: ingress ${i} has no reachable floor beside it`);
  }
}

if (problems.length) {
  for (const p of problems) console.log('FAIL ' + p);
  process.exit(1);
}
console.log('exit-route-check: OK (four flat rooms, right-wall portals reachable, no party-port prop)');
