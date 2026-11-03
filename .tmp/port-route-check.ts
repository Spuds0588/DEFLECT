import { World } from '../src/game/world';
import { ARENAS } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS } from '../src/game/config';

const level = PLAYABLE_CAMPAIGN_LEVELS[0];
const arena = ARENAS.find((a) => a.id === level.arenaId)!;
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'P';
const w = new World('gauntlet', names, 0, arena, false, 0, 0, null, true, level.dataCrates,
  false, level.intro, level.clearKills, false, level.boss ?? -1, level.primitivesOnly === true) as any;
const b = arena.bounds;
const step = 16;
const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
const seen = new Set<string>();
const start = arena.spawns[0];
const q: [number, number][] = [[start.x, start.y]];
seen.add(key(start.x, start.y));
const open = (x: number, y: number) => !w.offFloor(x, y) && x > b.left && x < b.right && y > b.top && y < b.bottom;
while (q.length) {
  const [x, y] = q.pop()!;
  for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]] as [number, number][]) {
    const nx = x + dx, ny = y + dy;
    if (!open(nx, ny)) continue;
    const k = key(nx, ny);
    if (seen.has(k)) continue;
    seen.add(k); q.push([nx, ny]);
  }
}
console.log('reachable cells from spawn:', seen.size, 'bridgeOpen', w.bridgeOpen.map((v: boolean) => (v ? 1 : 0)).join(''));
for (let i = 0; i < (arena.ingress ?? []).length; i++) {
  const p = arena.ingress![i];
  let best = Infinity;
  for (const k of seen) { const [x, y] = k.split(',').map(Number); best = Math.min(best, Math.hypot(x - p.x, y - p.y)); }
  console.log(`port ${i} at ${Math.round(p.x)},${Math.round(p.y)} bridge=${p.bridge ?? -1} hp=${p.hp} nearestReachable=${Math.round(best)}`);
}
