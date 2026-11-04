/** Every BUILD ROOT ingress port must have walkable floor beside it on the flat device. */
import { ARENAS } from '../src/game/arenas';
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
const start = arena.spawns[0];
const seen = new Set<string>([key(start.x, start.y)]);
const queue: [number, number][] = [[start.x, start.y]];
const open = (x: number, y: number) => !(world as any).offFloor(x, y) && x > b.left && x < b.right && y > b.top && y < b.bottom;
while (queue.length) {
  const [x, y] = queue.pop()!;
  for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]] as [number, number][]) {
    const nx = x + dx;
    const ny = y + dy;
    if (!open(nx, ny)) continue;
    const k = key(nx, ny);
    if (seen.has(k)) continue;
    seen.add(k);
    queue.push([nx, ny]);
  }
}
console.log(`reachable cells from spawn: ${seen.size}`);
let failed = false;
for (let i = 0; i < (arena.ingress ?? []).length; i++) {
  const p = arena.ingress![i];
  let best = Infinity;
  for (const k of seen) {
    const [x, y] = k.split(',').map(Number);
    best = Math.min(best, Math.hypot(x - p.x, y - p.y));
  }
  console.log(`port ${i} at ${Math.round(p.x)},${Math.round(p.y)} hp=${p.hp} nearestReachable=${Math.round(best)}`);
  if (best > 40) {
    console.log(`FAIL port ${i} has no reachable floor beside it`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('port-route-check: OK (all ports reachable on one floor)');
