/**
 * Campaign companion death, headless:
 *   1. a dead bot is removed from the floor and does not respawn on the training timer;
 *   2. the loss bitmask reports the slot;
 *   3. a later node built with that mask never activates the lost bot, including through
 *      the drill reactivation path.
 */
import { ARENAS } from '../src/game/arenas';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};
const arena = ARENAS[0] ?? fail('arena 0 is missing');
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'HUMAN';
names[1] = 'BOT-1';
const makeWorld = (deadBots = 0): any =>
  new World(
    'gauntlet',
    names,
    0,
    arena,
    false,
    0,
    1,
    null,
    true,
    [],
    false,
    'assault',
    999,
    false,
    -1,
    false,
    null,
    false,
    deadBots,
  ) as any;
const frame = { mx: 0, my: 0, held: 0, pressed: 0 };

const world = makeWorld();
world.tutorial = null;
world.phase = 'practice';
world.campaignPhase = 'assault';
const bot = world.players[1];
world.damagePlayer(bot, 99, 0, 0, 0, 0);
if (bot.alive) fail('the companion survived lethal damage');
if (bot.active) fail('the dead companion was still on the floor');
if ((world.campaignBotsLost & 2) === 0) fail('the world did not record the lost companion');
for (let i = 0; i < 300; i++) world.step(SIM_DT, [frame, null]);
if (bot.active || bot.alive) fail('the companion respawned on the training timer');

const next = makeWorld(2);
next.tutorial = null;
next.campaignPhase = 'calibration';
if (next.players[1].active) fail('a later node reactivated a lost companion');
next.beginDrill();
if (next.players[1].active) fail('the drill reactivated a lost companion');
if (!next.players[0].active) fail('the player was not active in the new node');

console.log('campaign-bot-death-check: OK (dead bot stays removed // loss mask persists // drill skip)');
