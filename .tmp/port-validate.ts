/** Validate concrete replacement spots for the QUARANTINE ports. */
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';

const level = PLAYABLE_CAMPAIGN_LEVELS[0];
const arena = ARENAS.find((a) => a.id === level.arenaId)!;
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'SPOT';
const world = new World('gauntlet', names, 0, arena, false, 0, 0, null, true, level.dataCrates, false, level.intro, level.clearKills, false, -1);
const priv = world as unknown as { lineBlocked: (x1: number, y1: number, x2: number, y2: number) => boolean };
const islands = arena.islands ?? [];
const half = 39;
const inside = (r: { x: number; y: number; w: number; h: number }, x: number, y: number, pad = 0) =>
  x > r.x + pad && x < r.x + r.w - pad && y > r.y + pad && y < r.y + r.h - pad;

const candidates: [number, number, string][] = [
  [1330, 900, 'mainboard A'],
  [1640, 900, 'mainboard A alt'],
  [1780, 940, 'mainboard B (unchanged)'],
  [1600, 620, 'board seam'],
  [1350, 230, 'router'],
  [1600, 250, 'router alt'],
  [1300, 400, 'router low'],
];

for (const [x, y, label] of candidates) {
  const onIsland = islands.some((r) => inside(r, x, y, half));
  const inPillar = arena.pillars.some((p) => x + half > p.x && x - half < p.x + p.w && y + half > p.y && y - half < p.y + p.h);
  const lines: string[] = [];
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    let best = 0;
    for (const d of [170, 140, 110]) {
      const px = x + dx * d, py = y + dy * d;
      if (islands.length && !islands.some((r) => inside(r, px, py, 20))) continue;
      if (!priv.lineBlocked(px, py, x, y)) { best = d; break; }
    }
    if (best) lines.push(`${dx},${dy}:${best}`);
  }
  console.log(
    `${label} @${x},${y} onIsland=${onIsland} inPillar=${inPillar} lines=${lines.length ? lines.join(' ') : 'NONE'}`,
  );
}
