/**
 * BUILD ROOT's exit on the flat floor: every ingress port and the white party port must
 * have walkable floor beside them, with no bridge state to release first. This is the
 * regression guard for the bridge-era deadlock that used to strand the exit behind a
 * retracted deck.
 */
import { ARENAS, type Rect } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS } from '../src/game/config';
import { World } from '../src/game/world';

const level = PLAYABLE_CAMPAIGN_LEVELS[0];
const arena = ARENAS.find((a) => a.id === level.arenaId)!;
if (arena.islands || arena.bridges) throw new Error('QUARANTINE is still a plate arena');

const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'P';
const world = new World(
  'gauntlet',
  names,
  0,
  arena,
  false,
  0,
  0,
  null,
  true,
  level.dataCrates,
  false,
  level.intro,
  level.clearKills,
  false,
  level.boss ?? -1,
  level.primitivesOnly === true,
);

const b = arena.bounds;
const step = 16;
const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
const inside = (r: Rect, x: number, y: number) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
const walkable = (x: number, y: number): boolean => {
  if (x <= b.left || x >= b.right || y <= b.top || y >= b.bottom) return false;
  if ((world as any).offFloor(x, y)) return false;
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

const port = arena.port!;
const exitNearest = nearest(port.x, port.y);
console.log(
  `flat floor: ${seen.size} cells // port ${Math.round(port.x)},${Math.round(port.y)} // nearest reachable ${Math.round(
    exitNearest,
  )}`,
);
if (exitNearest > 40) {
  console.log('FAIL the party port has no reachable floor beside it');
  process.exit(1);
}

let failed = false;
for (let i = 0; i < (arena.ingress ?? []).length; i++) {
  const p = arena.ingress![i];
  const d = nearest(p.x, p.y);
  console.log(`ingress ${i} @${Math.round(p.x)},${Math.round(p.y)} nearest reachable ${Math.round(d)}`);
  if (d > 40) {
    console.log(`FAIL ingress ${i} has no reachable floor beside it`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('exit-route-check: OK (walk to every port and the exit on one floor)');
