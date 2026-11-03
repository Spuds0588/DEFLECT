/** Does the holding plate still admit a body from the intake bridge, clear of the cells? */
import { ARENAS, holdingCellLayout } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';

const level = PLAYABLE_CAMPAIGN_LEVELS[0];
const arena = ARENAS.find((a) => a.id === level.arenaId)!;
const room = arena.rooms!.find((r) => r.theme === 'holding')!;
const cells = holdingCellLayout(room);
const block = { x: cells.left, y: cells.top, w: cells.cellW * 3, h: cells.bottom - cells.top };
const inside = (x: number, y: number) => x > block.x && x < block.x + block.w && y > block.y && y < block.y + block.h;
const a = arena.bridges!.find((b) => b.label === 'A')!;
const b = arena.bridges!.find((b) => b.label === 'B')!;
const aLand = { x: a.x + a.w / 2, y: room.y + 24 };
const bLand = { x: room.x + room.w - 30, y: b.y + b.h / 2 };
const problems: string[] = [];
if (inside(aLand.x, aLand.y)) problems.push(`intake bridge lands inside the cell block at ${aLand.x},${aLand.y}`);
if (aLand.y > block.y && aLand.y < block.bottom) problems.push('intake landing is level with the cell block, not beside it');
if (aLand.x > block.x) problems.push(`intake landing ${Math.round(aLand.x)} is not left of the block (${Math.round(block.x)})`);
if (b.y < block.y + block.h) problems.push('holding->mainboard doorway starts behind the cell block front');
if (inside(bLand.x, bLand.y)) problems.push('holding->mainboard doorway is inside the cell block');
console.log(`cells x ${Math.round(block.x)}..${Math.round(block.x + block.w)} y ${Math.round(block.y)}..${Math.round(block.y + block.h)}`);
console.log(`bridge A lands ${Math.round(aLand.x)},${Math.round(aLand.y)}; bridge B doorway ${Math.round(b.x)},${Math.round(b.y)}..${Math.round(b.y + b.h)}`);
if (problems.length) { for (const p of problems) console.log('FAIL ' + p); process.exit(1); }
console.log('holding-layout-check: OK (enter left of the cells, leave in front of them)');
