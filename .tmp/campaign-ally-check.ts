/**
 * Campaign ally intent, headless:
 *   1. a campaign companion never targets the human or another bot by default;
 *   2. damage without a lock does not turn it;
 *   3. a locked-on damaging hit turns that specific companion, not the squad;
 *   4. allied bot fire passes through the party; a turned bot can hurt the human
 *      but still cannot hurt its fellow bots.
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
  'none',
  level.clearKills,
  false,
  -1,
) as any;
world.tutorial = null;
world.campaignPhase = 'assault';
world.phase = 'practice';
const frame = (): { mx: number; my: number; held: number; pressed: number } => ({
  mx: 0,
  my: 0,
  held: 0,
  pressed: 0,
});
const targetOf = (brain: BotBrain): number => (brain as any).target as number;

const one = new BotBrain(1, 'veteran', 0, 0x111);
const two = new BotBrain(2, 'veteran', 1, 0x222);
one.think(world, frame(), 1 / 60);
two.think(world, frame(), 1 / 60);
if (targetOf(one) !== -1) fail(`companion 1 picked player ${targetOf(one)} as a target`);
if (targetOf(two) !== -1) fail(`companion 2 picked player ${targetOf(two)} as a target`);
if (world.campaignAllyHostile(1) || world.campaignAllyHostile(2)) fail('companions started hostile');

// A stray hit without a lock is not intent.
const bot1Hp = world.players[1].hp;
world.damagePlayer(world.players[1], 1, 0, 1, 0, 0);
if (world.players[1].hp !== bot1Hp - 1) fail('the stray hit did not damage the companion');
if (world.campaignAllyHostile(1)) fail('a stray hit turned the companion hostile');

// Lock on the companion, then damage it: that specific bot turns.
world.players[0].lockActive = true;
world.players[0].lockKind = 1;
world.players[0].lockId = 1;
world.damagePlayer(world.players[1], 1, 0, 1, 0, 0);
if (!world.campaignAllyHostile(1)) fail('a locked-on hit did not turn companion 1');
if (world.campaignAllyHostile(2)) fail('companion 2 turned without being attacked');

one.reset();
two.reset();
one.think(world, frame(), 1 / 60);
two.think(world, frame(), 1 / 60);
if (targetOf(one) !== 0) fail(`turned companion 1 targets ${targetOf(one)}, expected the human`);
if (targetOf(two) !== -1) fail(`companion 2 became hostile without being attacked (target ${targetOf(two)})`);

// Allied bot fire passes through the party.
const humanHp = world.players[0].hp;
const bot2Hp = world.players[2].hp;
world.damagePlayer(world.players[0], 1, 2, 1, 0, 0);
world.damagePlayer(world.players[2], 1, 1, 1, 0, 0);
if (world.players[0].hp !== humanHp) fail('an allied companion damaged the human');
if (world.players[2].hp !== bot2Hp) fail('a companion damaged its fellow bot');

// A turned companion can fight the human, but still not its fellow bot.
world.damagePlayer(world.players[0], 1, 1, 1, 0, 0);
if (world.players[0].hp !== humanHp - 1) fail('a turned companion could not damage the human');
world.damagePlayer(world.players[2], 1, 1, 1, 0, 0);
if (world.players[2].hp !== bot2Hp) fail('a turned companion damaged its fellow bot');

console.log(
  `campaign-ally-check: OK (both companions allied // stray hit ignored // locked hit turned bot 1 only // ` +
    `turned bot targets human // allied fire passes through)`,
);
