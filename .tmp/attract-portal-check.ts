/** Attract kiosk probe: every opening/refill threat arrives through an edge portal. */
import { ARENAS } from '../src/game/arenas';
import { ATTRACT, GAUNTLET, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};

const arena =
  ARENAS.find((candidate) => candidate.id === 22) ??
  ARENAS.find((candidate) => !candidate.ingress && !candidate.rooms && !candidate.qa) ??
  ARENAS[0];
const world = new World('gauntlet', ['DEMO'], 0, arena);
const internals = world as any;
const liveSentries = () => world.sentries.filter((sentry) => sentry.active).length;
const liveWorms = () => world.worms.filter((worm) => worm.active && worm.bossKind < 0).length;
const liveViruses = () => world.viruses.filter((virus) => virus.active).length;
const liveErrors = () => world.errors.filter((error) => error.active).length;
const liveThreats = () => liveSentries() + liveWorms() + liveViruses() + liveErrors();
const queued = (family: number) => internals.assaultQueued(family) as number;
const tickAssault = (dt: number) => internals.tickAssault(dt) as void;
const resetArrivals = () => {
  for (const sentry of world.sentries) sentry.active = false;
  for (const worm of world.worms) worm.active = false;
  for (const virus of world.viruses) virus.active = false;
  for (const error of world.errors) error.active = false;
  for (const portal of world.assaultPortals) portal.active = false;
  internals.assaultQueueCount = 0;
  internals.assaultQueueIndex = 0;
  internals.assaultCooldown = 0;
};

world.seedAttractRun(ATTRACT.wave);
if (liveThreats() !== 0) fail('attract seeded a threat directly instead of queueing a portal burst');
if (internals.assaultQueueCount === 0) fail('attract seeded no ingress requests');
const openingQueue = internals.assaultQueueCount as number;
if (queued(0) === 0) fail('attract did not queue sentries');
if (queued(1) === 0) fail('attract did not queue worms');
if (queued(2) === 0) fail('attract did not queue viruses');
if (queued(4) === 0) fail('attract did not queue the opening error colony');

let portal = null as (typeof world.assaultPortals)[number] | null;
let firstArrival = -1;
for (let i = 0; i < 240; i++) {
  tickAssault(SIM_DT);
  if (liveThreats() > 0) {
    portal = world.assaultPortals.find((candidate) => candidate.active) ?? null;
    firstArrival = i;
    break;
  }
}
if (!portal) fail('the opening ingress never opened');
if (firstArrival < 0) fail('the opening portal never released a threat');
if (liveThreats() === 0) fail('the opening portal produced no live threats');
const openingLive = liveThreats();

// Everything that just appeared has to be at the portal mouth, not around the player.
for (const sentry of world.sentries) {
  if (!sentry.active) continue;
  if (Math.hypot(sentry.x - portal.x, sentry.y - portal.y) > 150) {
    fail('a sentry appeared away from the opening portal');
  }
}
for (const worm of world.worms) {
  if (!worm.active || worm.bossKind >= 0) continue;
  if (Math.hypot(worm.x - portal.x, worm.y - portal.y) > 150) {
    fail('a worm appeared away from the opening portal');
  }
}
for (const virus of world.viruses) {
  if (!virus.active) continue;
  if (Math.hypot(virus.x - portal.x, virus.y - portal.y) > 150) {
    fail('a virus appeared away from the opening portal');
  }
}
for (const error of world.errors) {
  if (!error.active) continue;
  if (Math.hypot(error.x - portal.x, error.y - portal.y) > 170) {
    fail('an error block appeared away from the opening portal');
  }
}

const player = world.players[0];
if (player.alive) {
  const portalDistance = Math.hypot(portal.x - player.x, portal.y - player.y);
  if (portalDistance < GAUNTLET.assault.playerClear - 1) {
    fail(`the opening portal opened ${portalDistance.toFixed(0)} from the player`);
  }
}

// The recurring top-up must only enqueue. It must not refill the room directly.
resetArrivals();
internals.fillAttractRoom();
if (liveThreats() !== 0) fail('the attract refill spawned threats directly');
if (internals.assaultQueueCount === 0) fail('the attract refill queued nothing');

// A wiped error colony reseeds through the queue, not as a direct center/spawn colony.
resetArrivals();
internals.wave = GAUNTLET.errorWave;
internals.errorSpawnT = 0;
internals.updateErrors(SIM_DT);
if (liveErrors() !== 0) fail('an attract error colony spawned directly');
if (queued(4) === 0) fail('an attract error colony did not queue an edge burst');

console.log(
  JSON.stringify({
    arena: arena.name,
    openingQueue,
    firstArrivalTick: firstArrival,
    portal: { x: Math.round(portal.x), y: Math.round(portal.y) },
    openingLive,
  }),
);
console.log('attract-portal-check: OK');
