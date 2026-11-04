/**
 * REBOOT boss staging.
 *
 * The node must open empty, light six corner feeds, and refuse the Mega Worm until all
 * six ports are down and every body is gone. Once the worm is in, the campaign branch
 * must not run the gauntlet's automatic packs during or between its passes.
 *
 * Run with `npx tsx .tmp/reboot-boss-check.ts`.
 */
import { getArena } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};

const level = PLAYABLE_CAMPAIGN_LEVELS.find((entry) => entry.boss !== undefined && entry.boss >= 0);
if (!level) fail('no boss campaign level');
const arena = getArena(level.arenaId);
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'REBOOT';
const idle = new Array(MAX_PLAYERS).fill(null);
const world = new World(
  'gauntlet', names, 0, arena, false, 0, 0, null, true,
  level.dataCrates, false, 'assault', level.clearKills, false, level.boss ?? -1, false,
);
const player = world.players[0];
player.iframes = 1e9;

const internal = world as unknown as {
  campaignBossWarned: boolean;
  campaignBossSpawned: boolean;
  campaignBossWarnT: number;
  damageProp: (prop: unknown, amount: number, x: number, y: number) => void;
  campaignFloorClear: () => boolean;
  sentries: { active: boolean }[];
  viruses: { active: boolean }[];
  errors: { active: boolean }[];
};
const liveWorms = () => world.worms.filter((w) => w.active).length;
const liveSentryCount = () => internal.sentries.filter((s) => s.active).length;
const liveVirusCount = () => internal.viruses.filter((v) => v.active).length;
const liveErrorCount = () => internal.errors.filter((e) => e.active).length;

if (world.campaignPhase !== 'assault') fail(`opened in ${world.campaignPhase}, not assault`);
if (world.portTotal !== 6) fail(`expected six corner feeds, got ${world.portTotal}`);
if (liveSentryCount() !== 0 || liveVirusCount() !== 0 || liveErrorCount() !== 0 || liveWorms() !== 0) {
  fail('the boss node opened with pre-placed enemies');
}

const portals = world.props.filter((p) => p.portal && !p.portalExit);
if (portals.length !== 6) fail(`expected six portal props, got ${portals.length}`);
for (let i = 0; i < 5; i++) internal.damageProp(portals[i], portals[i].hp, 0, 0);
world.step(SIM_DT, idle);
if (internal.campaignBossWarned || internal.campaignBossSpawned) fail('boss arrived with a feed still open');

internal.damageProp(portals[5], portals[5].hp, 0, 0);
world.step(SIM_DT, idle);
if (!internal.campaignBossWarned) fail('all six feeds down did not warn the boss');
if (internal.campaignBossSpawned) fail('boss spawned on the same frame as the warning');

let warnedFor = 0;
while (!internal.campaignBossSpawned && warnedFor < 12) {
  world.step(SIM_DT, idle);
  warnedFor += SIM_DT;
}
if (!internal.campaignBossSpawned) fail('boss never arrived after the warning');
if (liveWorms() !== 1) fail(`expected one Mega Worm, got ${liveWorms()}`);
if (liveSentryCount() !== 0 || liveVirusCount() !== 0 || liveErrorCount() !== 0) {
  fail('little enemies spawned with the boss');
}

const boss = world.worms.find((w) => w.active);
if (!boss) fail('Mega Worm missing');
let passMarks = 0;
let lastPass = boss.megaPass ?? 0;
for (let i = 0; i < 60 * 36; i++) {
  world.step(SIM_DT, idle);
  player.iframes = 1e9;
  player.hp = player.maxHp;
  if ((boss.megaPass ?? 0) !== lastPass) {
    lastPass = boss.megaPass ?? 0;
    passMarks++;
  }
  if (liveSentryCount() > 0 || liveVirusCount() > 0 || liveErrorCount() > 0) {
    fail(`an automatic family appeared during the worm fight (${liveSentryCount()}/${liveVirusCount()}/${liveErrorCount()})`);
  }
}
if (passMarks < 2) fail(`only ${passMarks} static pass(es) ran in 36s`);
if (world.campaignPhase !== 'assault') fail(`worm fight ended as ${world.campaignPhase}`);
if (world.portsClosed !== 6) fail(`ports closed ${world.portsClosed}/6`);

console.log(
  `reboot-boss-check: OK (six feeds, ${warnedFor.toFixed(1)}s warning, ${passMarks} static passes, no little enemies)`,
);
