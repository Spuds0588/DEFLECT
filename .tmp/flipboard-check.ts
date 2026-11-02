/** AIRPORT probe: the board fills the arena, every text field flips, and each row band hurts. */
import { ARENAS, arenaIndexById, flipFieldAt, flipRowRectAt, flipRowStateAt } from '../src/game/arenas';
import { PLAYER, SIM_DT } from '../src/game/config';
import { FLIP_STATE } from '../src/game/arenas';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';

const fail = (m: string): never => {
  throw new Error(m);
};

const arena = ARENAS[arenaIndexById(23)];
if (arena.name !== 'AIRPORT') fail(`arena 23 is ${arena.name}`);
const flip = arena.flip ?? fail('AIRPORT has no flipboard');
const board = flip.board;

// The board is the floor: no arena left outside it, and no furniture on it.
if (arena.pillars.length !== 0) fail('the board floor should have no furniture cover');
if (board.x < arena.bounds.left || board.y < arena.bounds.top) fail('the board starts outside the bounds');
if (board.x + board.w > arena.bounds.right || board.y + board.h > arena.bounds.bottom) fail('the board spills outside the bounds');
const covered = (board.w * board.h) / ((arena.bounds.right - arena.bounds.left) * (arena.bounds.bottom - arena.bounds.top));
if (covered < 0.85) fail(`the board only covers ${(covered * 100).toFixed(0)}% of the floor`);
if (flip.rows.length < 18) fail(`expected 18 flipboard rows, got ${flip.rows.length}`);
if ((flip.banks ?? 1) < 2) fail('eighteen rows need two banks');

// Every text field changes on its own clock.
const decks: Array<[string, string[] | undefined]> = [
  ['destination', flip.destinations],
  ['gate', flip.gates],
  ['status', flip.statuses],
];
for (const [name, deck] of decks) {
  if (!deck || deck.length < 2) fail(`${name} has no deck to flip through`);
  const first = flipFieldAt(flip, 0, deck, 'X', 0);
  const later = flipFieldAt(flip, 0, deck, 'X', flip.period * 1.5);
  if (first === later) fail(`${name} never changes`);
}
for (let row = 0; row < flip.rows.length; row++) {
  const a = flipFieldAt(flip, row, flip.destinations, 'X', 0);
  const b = flipFieldAt(flip, row, flip.destinations, 'X', flip.period * 2.5);
  if (a === b) fail(`row ${row} destination is static`);
}

// Row bands do not overlap and stay on the board.
const rect = { x: 0, y: 0, w: 0, h: 0 };
for (let row = 0; row < flip.rows.length; row++) {
  flipRowRectAt(flip, row, rect);
  if (rect.x < board.x || rect.y < board.y) fail(`row ${row} escapes the board`);
  if (rect.x + rect.w > board.x + board.w || rect.y + rect.h > board.y + board.h) fail(`row ${row} spills off the board`);
  if (rect.h !== flip.rowH) fail(`row ${row} band is not a row tall`);
}

// A body standing on a text field, far from the time tile, is hit when that row lands.
const world = new World('training', ['AIRPORT'], 0, arena);
world.drone.active = false;
world.drone.respawnT = 1e9;
const player = world.players[0];
flipRowRectAt(flip, 4, rect);
player.x = rect.x + rect.w - 120;
player.y = rect.y + rect.h * 0.5;
player.hp = player.maxHp;
const before = player.hp;
let landed = -1;
for (let i = 0; i < 60 * 40 && landed < 0; i++) {
  world.step(SIM_DT, [null]);
  if (player.hp < before) landed = i;
}
if (landed < 0) fail('a row landing did not damage a body on its text fields');
if (before - player.hp !== flip.damage) fail(`one landing took ${before - player.hp} segments`);
for (let i = 0; i < 90; i++) world.step(SIM_DT, [null]);
if (player.hp < before - flip.damage) fail('one landing hit the same body twice');

// Spawns sit on the board, and the board stays local-only.
for (const s of arena.spawns) {
  if (s.x < board.x || s.x > board.x + board.w || s.y < board.y || s.y > board.y + board.h) fail(`spawn ${s.x},${s.y} is off the board`);
  if (Math.hypot(s.x - player.x, s.y - player.y) < PLAYER.radius) fail(`spawn ${s.x},${s.y} overlaps the probe body`);
}
if (buildSnapshotHazards(world) !== null) fail('AIRPORT leaked into SnapshotHazards');
if (flipRowStateAt(flip, 0, 0) === undefined) fail('row state clock is not readable');
console.log('flipboard-check: OK');
