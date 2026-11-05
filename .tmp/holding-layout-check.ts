/**
 * QUARANTINE // HOLDING is its own arena now. The north wall is a shallow ten-cell row;
 * the floor in front of it has to admit a body from the left and reach the right-wall
 * portal by ordinary walking after the cell wave clears.
 */
import { ARENAS, holdingCellLayout, type Rect } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS, campaignChapterForLevel } from '../src/game/campaign';
import { MAX_PLAYERS } from '../src/game/config';
import { World } from '../src/game/world';

const level = PLAYABLE_CAMPAIGN_LEVELS.find((entry) => entry.arenaId === 34)!;
const arena = ARENAS.find((a) => a.id === 34)!;
const problems: string[] = [];
if (arena.islands) problems.push('QUARANTINE still declares islands');
if (arena.bridges) problems.push('QUARANTINE still declares bridge decks');

const room = arena.rooms?.find((r) => r.theme === 'holding');
if (!room) throw new Error('QUARANTINE has no holding room');
const cells = holdingCellLayout(room);
const block: Rect = { x: cells.left, y: cells.top, w: cells.cellW * cells.cellCount, h: cells.bottom - cells.top };

const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'INMATE';
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
  campaignChapterForLevel(level),
);

const inside = (r: Rect, x: number, y: number) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
const blocked: Rect[] = [...arena.pillars, block];
const walkable = (x: number, y: number): boolean => {
  const b = arena.bounds;
  if (x <= b.left || x >= b.right || y <= b.top || y >= b.bottom) return false;
  if ((world as any).offFloor(x, y)) return false;
  for (let i = 0; i < blocked.length; i++) if (inside(blocked[i], x, y)) return false;
  return true;
};

const step = 20;
const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
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
const reach = (x: number, y: number): boolean => {
  for (const k of seen) {
    const [kx, ky] = k.split(',').map(Number);
    if (Math.hypot(kx - x, ky - y) <= step) return true;
  }
  return false;
};

const frontY = Math.min(block.y + block.h + 40, room.y + room.h - 30);
const left = { x: room.x + 40, y: frontY };
const front = { x: block.x + block.w * 0.5, y: frontY };
const portalX = arena.bounds.right - 36;
const portalY = (arena.bounds.top + arena.bounds.bottom) * 0.5;
if (!reach(left.x, left.y)) problems.push('the open left side of the holding room is not reachable from spawn');
if (!reach(front.x, front.y)) problems.push('the front of the cell block is not reachable from spawn');
if (!reach(portalX, portalY)) problems.push('the right-wall portal is not reachable from spawn');
if (left.y <= block.y + block.h) problems.push('the holding entry point is not in front of the cell block');

console.log(
  `flat floor: ${seen.size} cells // cells x ${Math.round(block.x)}..${Math.round(block.x + block.w)} y ${Math.round(
    block.y,
  )}..${Math.round(block.y + block.h)}`,
);
console.log(
  `entry ${Math.round(left.x)},${Math.round(left.y)} // front ${Math.round(front.x)},${Math.round(
    front.y,
  )} // portal ${Math.round(portalX)},${Math.round(portalY)}`,
);
if (problems.length) {
  for (const p of problems) console.log('FAIL ' + p);
  process.exit(1);
}
console.log('holding-layout-check: OK (enter left of the cells, front reachable, right-wall portal reachable)');
