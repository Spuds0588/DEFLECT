/**
 * REBOOT boss staging.
 *
 * The node must open with its authored squad, light six corner feeds, and refuse the
 * Mega Worm until all six ports are down and every body is gone. Once the worm is in,
 * the campaign branch must not run the gauntlet's automatic packs during or between its
 * passes.
 *
 * Run with `npx tsx .tmp/reboot-boss-check.ts`.
 */
import { getArena } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, MEGA_WORM, SIM_DT } from '../src/game/config';
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
  level.opening ?? null, level.finale === true,
);
const player = world.players[0];
player.iframes = 1e9;

const internal = world as unknown as {
  campaignBossWarned: boolean;
  campaignBossSpawned: boolean;
  campaignBossWarnT: number;
  damageProp: (prop: unknown, amount: number, x: number, y: number) => void;
  campaignFloorClear: () => boolean;
  bounceWalls: (proj: unknown) => void;
  megaBodyHit: (w: unknown, x: number, y: number, pad: number) => boolean;
  projectileHitsGauntlet: (proj: unknown) => boolean;
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
if (!arena.openShots) fail('GRID ZERO does not open its outer wall to shots');
if (arena.walls === 'open') fail('GRID ZERO must keep its body floor bounded');
if (MEGA_WORM.spacing >= MEGA_WORM.segmentRadius * 1.6) {
  fail(`Mega Worm spacing ${MEGA_WORM.spacing} leaves visible seams between plates`);
}
if (liveSentryCount() !== 4 || liveVirusCount() !== 2 || liveWorms() !== 1) {
  fail(`the boss node opening squad is ${liveSentryCount()} sentries / ${liveVirusCount()} viruses / ${liveWorms()} worms`);
}
// The warning is about the live floor, not the opening squad. Clear the authored bodies
// the way the player must before the feeds can finish the run-up.
for (const s of internal.sentries) s.active = false;
for (const v of internal.viruses) v.active = false;
for (const e of internal.errors) e.active = false;
for (const w of world.worms) w.active = false;

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

// The fight body is one straight capsule. Every plate must sit on that line at the
// authored spacing, and the capsule must include the full body, not just the head.
const ux = Math.cos(boss.angle);
const uy = Math.sin(boss.angle);
for (let i = 0; i < boss.segCount; i++) {
  const dx = boss.segX[i] - boss.x;
  const dy = boss.segY[i] - boss.y;
  if (Math.abs(dx * uy - dy * ux) > 0.25) fail(`plate ${i} drifted off the straight body`);
  if (Math.abs(Math.hypot(dx, dy) - MEGA_WORM.spacing * (i + 1)) > 0.5) {
    fail(`plate ${i} lost its authored overlap spacing`);
  }
}
if (!internal.megaBodyHit(boss, boss.x, boss.y, 0)) fail('capsule missed its own head');
const tail = boss.segCount - 1;
const midX = (boss.x + boss.segX[tail]) * 0.5;
const midY = (boss.y + boss.segY[tail]) * 0.5;
if (!internal.megaBodyHit(boss, midX, midY, 0)) fail('capsule missed the middle of the body');
if (!internal.megaBodyHit(boss, boss.segX[tail], boss.segY[tail], 0)) fail('capsule missed its tail');
if (internal.megaBodyHit(boss, midX - uy * (boss.segR + 8), midY + ux * (boss.segR + 8), 0)) {
  fail('capsule swallowed a point outside the body');
}

// A round fired at the body's middle must use the capsule, not only the head.
const bodyShot = world.projectiles[1];
bodyShot.active = true;
bodyShot.type = 0;
bodyShot.owner = 0;
bodyShot.x = midX;
bodyShot.y = midY;
bodyShot.vx = 100;
bodyShot.vy = 0;
bodyShot.radius = 2;
bodyShot.damage = 1;
const hpBefore = boss.hp;
if (!internal.projectileHitsGauntlet(bodyShot)) fail('a shot on the middle plate missed the Mega Worm body');
if (boss.hp >= hpBefore) fail('a capsule body hit did not damage the Mega Worm');
bodyShot.active = false;

// An outside shot must survive the old arena wall long enough to reach the boss.
const shot = world.projectiles[0];
shot.active = true;
shot.x = arena.bounds.right + 160;
shot.y = arena.bounds.top + 400;
shot.vx = 100;
shot.vy = 0;
shot.radius = 2;
internal.bounceWalls(shot);
if (!shot.active) fail('a shot died on GRID ZERO\'s missing outer wall');
shot.active = false;

console.log(
  `reboot-boss-check: OK (opening squad cleared, six feeds, ${warnedFor.toFixed(1)}s warning, ${passMarks} static passes, one straight hittable body, open shot edge, no little enemies)`,
);
