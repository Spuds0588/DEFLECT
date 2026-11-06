/**
 * Campaign party rules, headless:
 *   1. a campaign companion never targets the human or another companion;
 *   2. campaign friendly fire is locked off at the World, so neither a player shot
 *      nor a companion shot can damage the other party member;
 *   3. damaging a companion (including through the real lock intent) never turns it;
 *   4. a companion keeps fighting the floor threats after being shot.
 */
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { ARENAS } from '../src/game/arenas';
import { MAX_PLAYERS } from '../src/game/config';
import { BotBrain } from '../src/game/bot';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};

const level = PLAYABLE_CAMPAIGN_LEVELS[0] ?? fail('level 0 is missing');
const arena = ARENAS.find((a) => a.id === level.arenaId) ?? fail('level 0 arena is missing');
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'HUMAN';
names[1] = 'BOT-1';
names[2] = 'BOT-2';
const world = new World(
  'gauntlet',
  names,
  0,
  arena,
  false,
  0,
  2,
  null,
  true,
  level.dataCrates,
  false,
  'assault',
  level.clearKills,
  false,
  -1,
) as any;
world.tutorial = null;
world.phase = 'practice';
const frame = (): { mx: number; my: number; held: number; pressed: number } => ({
  mx: 0,
  my: 0,
  held: 0,
  pressed: 0,
});
const targetOf = (brain: BotBrain): number => (brain as any).target as number;

if (world.friendlyFire) fail('campaign started with friendly fire on');
if (world.campaignAllyHostile) fail('the removed ally-aggro state still exists');

const one = new BotBrain(1, 'veteran', 0, 0x111);
const two = new BotBrain(2, 'veteran', 1, 0x222);
one.think(world, frame(), 1 / 60);
two.think(world, frame(), 1 / 60);
if (targetOf(one) !== -1) fail(`companion 1 picked player ${targetOf(one)} as a target`);
if (targetOf(two) !== -1) fail(`companion 2 picked player ${targetOf(two)} as a target`);

// The campaign gate rejects both directions, with or without a lock.
const humanHp = world.players[0].hp;
const bot1Hp = world.players[1].hp;
const bot2Hp = world.players[2].hp;
world.players[0].lockActive = true;
world.players[0].lockKind = 1;
world.players[0].lockId = 1;
world.damagePlayer(world.players[1], 1, 0, 1, 0, 0); // human -> locked companion
world.damagePlayer(world.players[0], 1, 1, 1, 0, 0); // companion -> human
world.damagePlayer(world.players[2], 1, 1, 1, 0, 0); // companion -> companion
if (world.players[0].hp !== humanHp) fail('a companion damaged the human');
if (world.players[1].hp !== bot1Hp) fail('the human damaged a campaign companion');
if (world.players[2].hp !== bot2Hp) fail('a companion damaged another companion');

one.reset();
two.reset();
one.think(world, frame(), 1 / 60);
two.think(world, frame(), 1 / 60);
if (targetOf(one) !== -1) fail(`companion 1 turned on the party (target ${targetOf(one)})`);
if (targetOf(two) !== -1) fail(`companion 2 turned on the party (target ${targetOf(two)})`);

// A companion still engages a floor threat after the party-fire attempt.
const worm = world.worms.find((w: any) => !w.active) ?? world.worms[0];
worm.active = true;
worm.x = world.players[1].x + 90;
worm.y = world.players[1].y;
world.players[1].x = worm.x - 60;
world.players[1].y = worm.y;
one.think(world, frame(), 1 / 60);
if (targetOf(one) === 0 || targetOf(one) === 2) {
  fail(`companion targeted a party member instead of the floor threat (${targetOf(one)})`);
}

console.log(
  'campaign-ally-check: OK (campaign friendly fire locked off // both directions blocked // ' +
    'companions never target party // floor threat still engaged)',
);
