import {
  ARENAS,
  arenaIndexById,
  flipRowStateAt,
  flipRowTimeAt,
  flipTimeRectAt,
  FLIP_STATE,
  type Rect,
} from '../src/game/arenas';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';
import type { InputFrame } from '../src/game/types';

const zero: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };

if (ARENAS.length !== 24) throw new Error(`expected 24 arenas, got ${ARENAS.length}`);
if (arenaIndexById(23) !== 23) throw new Error('AIRPORT is not at index 23');
const arena = ARENAS[23];
if (arena.name !== 'AIRPORT') throw new Error('wrong airport arena');
const flip = arena.flip;
if (!flip) throw new Error('AIRPORT has no flip-board layout');
if (flip.rows.length !== 6) throw new Error('airport board needs six flight rows');
if (flip.rows.filter((row) => row.section === 'ARRIVALS').length !== 3) {
  throw new Error('airport board needs three arrivals');
}
if (flip.rows.filter((row) => row.section === 'DEPARTURES').length !== 3) {
  throw new Error('airport board needs three departures');
}
for (const row of flip.rows) {
  if (row.times.length < 2) throw new Error('airport row needs a flip deck');
  if (!row.destination || !row.gate || !row.status) throw new Error('airport row is missing a label');
}
const b = arena.bounds;
const board = flip.board;
if (board.x <= b.left || board.y <= b.top || board.x + board.w >= b.right || board.y + board.h >= b.bottom) {
  throw new Error('airport board is outside the arena bounds');
}
const cell: Rect = { x: 0, y: 0, w: 0, h: 0 };
for (let i = 0; i < flip.rows.length; i++) {
  flipTimeRectAt(flip, i, cell);
  if (
    cell.x < board.x ||
    cell.y < board.y + flip.headerH ||
    cell.x + cell.w > board.x + board.w ||
    cell.y + cell.h > board.y + board.h
  ) {
    throw new Error(`airport time tile ${i} is outside the board`);
  }
  const spawn = arena.spawns[i];
  if (
    spawn.x > cell.x - 30 &&
    spawn.x < cell.x + cell.w + 30 &&
    spawn.y > cell.y - 30 &&
    spawn.y < cell.y + cell.h + 30
  ) {
    throw new Error(`airport spawn ${i} is on time tile ${i}`);
  }
  for (const pillar of arena.pillars) {
    if (
      spawn.x > pillar.x &&
      spawn.x < pillar.x + pillar.w &&
      spawn.y > pillar.y &&
      spawn.y < pillar.y + pillar.h
    ) {
      throw new Error(`airport spawn ${i} is inside cover`);
    }
  }
}

if (flipRowStateAt(flip, 0, 0) !== FLIP_STATE.warn) throw new Error('airport row does not open on warning');
if (flipRowStateAt(flip, 0, flip.warn + 0.01) !== FLIP_STATE.flap) {
  throw new Error('airport row does not flap after warning');
}
if (flipRowTimeAt(flip, 0, 0) !== flip.rows[0].times[0]) throw new Error('airport row has the wrong opening time');
if (!flipRowTimeAt(flip, 0, flip.period).includes(':')) throw new Error('airport time is not a clock string');

const world = new World('training', ['FLIP'], 0, arena);
world.drone.active = false;
world.drone.respawnT = 1e9;
const player = world.players[0];
flipTimeRectAt(flip, 0, cell);
player.x = cell.x + cell.w * 0.5;
player.y = cell.y + cell.h * 0.5;
player.prevX = player.x;
player.prevY = player.y;
const hp = player.hp;
for (let i = 0; i < 90; i++) world.step(1 / 60, [zero]);
const damageTaken = hp - player.hp;
if (damageTaken <= 0) throw new Error('airport flip tile did not damage a body');
if (player.killerKind !== 15) throw new Error('airport hit did not use the FLIP death source');
if (!world.flipStates.some((state) => state === FLIP_STATE.flap)) {
  throw new Error('airport board never entered a flap');
}
if (buildSnapshotHazards(world) !== null) throw new Error('airport state leaked into SnapshotHazards');

world.beginRound();
if (world.flipT !== 0 || world.flipStates[0] !== FLIP_STATE.warn) {
  throw new Error('round reset did not rearm the airport board');
}

console.log(
  JSON.stringify({
    arenas: ARENAS.length,
    airportId: arena.id,
    rows: flip.rows.length,
    arrivals: flip.rows.filter((row) => row.section === 'ARRIVALS').length,
    departures: flip.rows.filter((row) => row.section === 'DEPARTURES').length,
    timeTiles: flip.rows.length,
    board: [board.x, board.y, board.w, board.h],
    hazardDamage: damageTaken,
    stateAfterReset: world.flipStates[0],
    hazards: buildSnapshotHazards(world) === null ? 0 : 1,
  }),
);
