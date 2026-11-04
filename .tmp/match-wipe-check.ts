/**
 * Match wipe, headless:
 *   1. every body down at once ends the match instead of opening the island hop;
 *   2. no entry portal is armed and no new round is built;
 *   3. a timer draw with both bodies alive still rolls into the next round.
 * The main thread's `canHopRound` also refuses a round with no live body.
 */
import { ARENAS } from '../src/game/arenas';
import { MAX_PLAYERS, ROUND } from '../src/game/config';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};

const arena = ARENAS[0] ?? fail('arena 0 is missing');
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'P1';
names[1] = 'P2';
const idle = new Array(MAX_PLAYERS).fill(null);

const goLive = (world: World): void => {
  for (let i = 0; i < 300 && world.phase !== 'live'; i++) world.step(1 / 60, idle);
  if (world.phase !== 'live') fail(`round never went live, phase=${world.phase}`);
};

const wipe = new World('match', names, 0, arena);
goLive(wipe);
const wipeRound = wipe.round;
for (let i = 0; i < wipe.players.length; i++) {
  const p = wipe.players[i];
  if (!p.active) continue;
  p.hp = 0;
  p.alive = false;
}
wipe.step(1 / 60, idle);
if (wipe.phase !== 'matchend') fail(`wipe did not end the match, phase=${wipe.phase}`);
if (wipe.matchWinner !== -1) fail(`wipe invented a winner: ${wipe.matchWinner}`);
if (wipe.roundWinner !== -1) fail(`wipe invented a round winner: ${wipe.roundWinner}`);
if (wipe.round !== wipeRound) fail(`wipe advanced the round to ${wipe.round}`);
if (wipe.entryPortalT !== 0) fail(`wipe armed the entry portal for ${wipe.entryPortalT}s`);
if (wipe.portalOpen) fail('wipe left the round portal open');
const frozenX = wipe.players[0].x;
for (let i = 0; i < 180; i++) wipe.step(1 / 60, idle);
if (wipe.phase !== 'matchend') fail(`wipe restarted after the result plate, phase=${wipe.phase}`);
if (wipe.players[0].x !== frozenX) fail('wipe moved a body after the match ended');

// A rematch is still a normal, fully alive round.
wipe.resetMatch();
if (wipe.phase !== 'countdown') fail(`rematch did not reset to countdown, phase=${wipe.phase}`);
if (wipe.aliveCount() !== 2) fail(`rematch did not revive both bodies, alive=${wipe.aliveCount()}`);
if (wipe.entryPortalT !== 0) fail('rematch armed an entry portal');

// A time-limit draw keeps the island hop: everybody was alive when the clock ran out.
const draw = new World('match', names, 0, arena);
goLive(draw);
draw.roundTimer = 0;
draw.step(1 / 60, idle);
if (draw.phase !== 'roundover') fail(`timer draw did not resolve as roundover, phase=${draw.phase}`);
if (draw.aliveCount() !== 2) fail('timer draw killed a body');
for (let i = 0; i < Math.ceil((ROUND.roundEndHold + 0.1) * 60); i++) draw.step(1 / 60, idle);
if (draw.phase !== 'countdown') fail(`timer draw did not start the next round, phase=${draw.phase}`);
if (draw.round !== 2) fail(`timer draw did not advance the round, round=${draw.round}`);
if (draw.matchWinner !== -1) fail('timer draw ended the match');

console.log(
  `match-wipe-check: OK (wipe -> matchend, round ${wipeRound}, no portal // timer draw -> round ${draw.round})`,
);
