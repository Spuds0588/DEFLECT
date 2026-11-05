import { World } from '../src/game/world';
import { ARENAS } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS, campaignChapterForLevel } from '../src/game/campaign';
import { MAX_PLAYERS } from '../src/game/config';
import { writeFileSync } from 'node:fs';
const level = PLAYABLE_CAMPAIGN_LEVELS[0];
const arena = ARENAS.find((a) => a.id === level.arenaId)!;
const names = new Array<string>(MAX_PLAYERS).fill(''); names[0] = 'P';
const w = new World('gauntlet', names, 0, arena, false, 0, 0, null, true, level.dataCrates,
  false, level.intro, level.clearKills, false, level.boss ?? -1, campaignChapterForLevel(level)) as any;
const b = arena.bounds; const step = 16;
const open = (x: number, y: number) => !w.offFloor(x, y) && x > b.left + 50 && x < b.right - 50 && y > b.top + 50 && y < b.bottom - 50;
const seen = new Set<string>(); const start = arena.spawns[0];
const q: [number, number][] = [[start.x, start.y]]; seen.add(`${Math.round(start.x)},${Math.round(start.y)}`);
while (q.length) {
  const [x, y] = q.pop()!;
  for (const [dx, dy] of [[step,0],[-step,0],[0,step],[0,-step]] as [number,number][]) {
    const nx = x + dx, ny = y + dy;
    if (!open(nx, ny)) continue;
    const k = `${Math.round(nx)},${Math.round(ny)}`;
    if (seen.has(k)) continue; seen.add(k); q.push([nx, ny]);
  }
}
const cells = [...seen].map((k) => { const [x, y] = k.split(',').map(Number); return { x, y, d: Math.hypot(x - start.x, y - start.y) }; })
  .filter((c) => c.d > 400 && c.d < 950).sort((p, q2) => q2.d - p.d);
const picked: { x: number; y: number }[] = [];
for (const c of cells) {
  if (picked.every((p) => Math.hypot(p.x - c.x, p.y - c.y) > 320)) picked.push({ x: c.x, y: c.y });
  if (picked.length === 3) break;
}
writeFileSync('/tmp/ports.json', JSON.stringify(picked));
console.log('reachable', seen.size, 'picked', picked.map((p) => `${p.x},${p.y}`).join(' | '));
