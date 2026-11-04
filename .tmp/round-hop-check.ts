/**
 * Round-end island hop, headless:
 *   1. a decided round pulls every standing body toward the right-wall portal;
 *   2. the next arena is a fresh World that carries the scoreline and the next round
 *      and drops the bodies on its left-wall entry portal.
 * The main-thread hop uses the same rule; this probe proves the simulation half.
 */
import { ARENAS } from '../src/game/arenas';
import { MAX_PLAYERS } from '../src/game/config';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};

const first = ARENAS.find((a) => a.id === 1) ?? fail('GRID ZERO is missing');
const next = ARENAS.find((a) => a.id === 0) ?? fail('CROSSROADS is missing');
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'P1';
names[1] = 'P2';
const world = new World('match', names, 0, first);
if (world.players[0].active !== true || world.players[1].active !== true) fail('two players did not activate');
const idle = new Array(MAX_PLAYERS).fill(null);
// The countdown owns the opening seconds; the round can only resolve once it is live.
for (let i = 0; i < 300 && world.phase !== 'live'; i++) world.step(1 / 60, idle);
if (world.phase !== 'live') fail(`round never went live, phase=${world.phase}`);

// End the round by downing slot 1; the live round resolves on the next step.
world.players[1].hp = 0;
world.players[1].alive = false;
world.step(1 / 60, idle);
if (world.phase !== 'roundover') fail(`round did not finish, phase=${world.phase}`);

const cx = first.bounds.right - 36;
const cy = (first.bounds.top + first.bounds.bottom) * 0.5;
const before = Math.hypot(world.players[0].x - cx, world.players[0].y - cy);
for (let i = 0; i < 72; i++) world.step(1 / 60, idle);
const after = Math.hypot(world.players[0].x - cx, world.players[0].y - cy);
if (!(after < before - 40)) fail(`portal pull did not move the body (${before.toFixed(1)} -> ${after.toFixed(1)})`);
if (!(world.players[0].x > first.bounds.right - 60)) fail('portal pull did not finish at the right wall');

// The main thread rebuilds on the next arena, carries scores and starts the next round.
world.players[0].score = 2;
const nextWorld = new World('match', names, 0, next);
nextWorld.round = world.round + 1;
for (let i = 0; i < MAX_PLAYERS; i++) nextWorld.players[i].score = world.players[i].score;
nextWorld.beginRound(true);
if (nextWorld.arena.id === first.id) fail('the hop did not change arenas');
if (!(nextWorld.players[0].x < next.bounds.left + 70)) fail('the next round did not enter from the left wall');
if (nextWorld.round !== 2) fail(`round did not carry, got ${nextWorld.round}`);
if (nextWorld.players[0].score !== 2) fail(`score did not carry, got ${nextWorld.players[0].score}`);

console.log(
  `round-hop-check: OK (pull ${before.toFixed(0)} -> ${after.toFixed(0)} // ${first.name} -> ${next.name} // round ${
    nextWorld.round
  }, score ${nextWorld.players[0].score})`,
);
