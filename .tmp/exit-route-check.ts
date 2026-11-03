import { World } from '../src/game/world';
import { ARENAS } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS } from '../src/game/config';
const level = PLAYABLE_CAMPAIGN_LEVELS[0];
const arena = ARENAS.find((a) => a.id === level.arenaId)!;
const run = (openBridges: boolean) => {
  const names = new Array<string>(MAX_PLAYERS).fill(''); names[0] = 'P';
  const w = new World('gauntlet', names, 0, arena, false, 0, 0, null, true, level.dataCrates,
    false, level.intro, level.clearKills, false, level.boss ?? -1, true) as any;
  if (openBridges) w.bridgeOpen = w.bridgeOpen.map(() => true);
  const b = arena.bounds, step = 16;
  const open = (x: number, y: number) => !w.offFloor(x, y) && x > b.left && x < b.right && y > b.top && y < b.bottom;
  const start = arena.spawns[0];
  const seen = new Set<string>([`${Math.round(start.x)},${Math.round(start.y)}`]);
  const q: [number, number][] = [[start.x, start.y]];
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of [[step,0],[-step,0],[0,step],[0,-step]] as [number,number][]) {
      const nx = x + dx, ny = y + dy;
      if (!open(nx, ny)) continue;
      const k = `${Math.round(nx)},${Math.round(ny)}`;
      if (seen.has(k)) continue; seen.add(k); q.push([nx, ny]);
    }
  }
  const p = arena.port!;
  let best = Infinity;
  for (const k of seen) { const [x, y] = k.split(',').map(Number); best = Math.min(best, Math.hypot(x - p.x, y - p.y)); }
  return { bridges: w.bridgeOpen.map((v: boolean) => (v ? 1 : 0)).join(''), cells: seen.size, port: `${Math.round(p.x)},${Math.round(p.y)}`, nearest: Math.round(best) };
};
console.log('closed bridges:', run(false));
console.log('open bridges:  ', run(true));
