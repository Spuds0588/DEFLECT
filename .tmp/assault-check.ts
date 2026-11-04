/** Gauntlet ingress probe: arrivals come in bursts from map edges, never around the player. */
import { GAUNTLET, SIM_DT } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';

const fail = (m: string): never => {
  throw new Error(m);
};

const arena = ARENAS.find((a) => a.id === 22) ?? ARENAS[0];
const world = new World('gauntlet', ['INGRESS'], 0, arena);
const cfg = GAUNTLET.assault;
if (!cfg) fail('GAUNTLET.assault tuning is missing');

const player = world.players[0];
player.x = arena.bounds.left + (arena.bounds.right - arena.bounds.left) * 0.5;
player.y = arena.bounds.top + (arena.bounds.bottom - arena.bounds.top) * 0.5;
player.alive = true;
player.hp = player.maxHp;

const queue = (world as any).queueAssault.bind(world) as (f: number, k: number, n: number) => void;
const tick = (world as any).tickAssault.bind(world) as (dt: number) => void;
const liveSentries = () => world.sentries.filter((s) => s.active).length;
const liveErrors = () => world.errors.filter((e) => e.active).length;
const resetAssault = () => {
  for (const s of world.sentries) s.active = false;
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const e of world.errors) e.active = false;
  for (const p of world.assaultPortals) p.active = false;
  (world as any).assaultQueueCount = 0;
  (world as any).assaultQueueIndex = 0;
  (world as any).assaultCooldown = 0;
};

resetAssault();
queue(0, 0, 4);

let opened = -1;
for (let i = 0; i < 120 && opened < 0; i++) {
  tick(SIM_DT);
  if (world.assaultPortals.some((p) => p.active)) opened = i;
}
if (opened < 0) fail('a queued burst never opened a portal');
const portal = world.assaultPortals.find((p) => p.active) ?? fail('no active portal');

// The mouth sits on an edge lane, not in the middle of the floor.
const b = arena.bounds;
const edgeDistance = Math.min(
  Math.abs(portal.y - (b.top + cfg.edgeInset)),
  Math.abs(portal.y - (b.bottom - cfg.edgeInset)),
  Math.abs(portal.x - (b.left + cfg.edgeInset)),
  Math.abs(portal.x - (b.right - cfg.edgeInset)),
);
if (edgeDistance > 12) fail(`portal is not on an edge lane (${edgeDistance.toFixed(1)} off)`);
const playerDistance = Math.hypot(portal.x - player.x, portal.y - player.y);
if (playerDistance < cfg.playerClear - 1) fail(`portal opened ${playerDistance.toFixed(0)} from the player`);

// It spews the whole burst on one frame, then closes.
let burstTick = -1;
let burstSentries = 0;
for (let i = 0; i < 120 && burstTick < 0; i++) {
  tick(SIM_DT);
  if (portal.emitted >= 4) {
    burstTick = i;
    burstSentries = liveSentries();
  }
}
if (burstTick < 0) fail('the queued burst never left the portal');
if (burstSentries < 4) fail(`burst trickled: only ${burstSentries} of 4 sentries were live on its first frame`);
for (let i = 0; i < 240; i++) tick(SIM_DT);
if (world.assaultPortals.some((p) => p.active)) fail('the portal never closed after the burst');
for (const s of world.sentries) {
  if (!s.active) continue;
  if (Math.hypot(s.x - portal.x, s.y - portal.y) > 150) fail('a burst sentry appeared away from the portal mouth');
  if (Math.hypot(s.x - player.x, s.y - player.y) < 200) fail('a burst sentry landed on top of the player');
}

// A pack request goes through the queue, not a direct spawn.
resetAssault();
(world as any).spawnSentryPack();
if ((world as any).assaultQueueCount !== 2) fail('a sentry pack did not queue a pair for a portal');
if (liveSentries() !== 0) fail('a sentry pack still spawned around the player directly');

// Worms use the same ingress.
resetAssault();
queue(1, 0, 1);
for (let i = 0; i < 900; i++) tick(SIM_DT);
if (!world.worms.some((w) => w.active)) fail('a worm never arrived through a portal');

// Cascading-error colonies queue an edge burst instead of seeding at a spawn or the centre.
resetAssault();
(world as any).wave = GAUNTLET.errorWave;
(world as any).errorSpawnT = 0;
(world as any).updateErrors(SIM_DT);
if (liveErrors() !== 0) fail('cascading errors spawned directly instead of queuing ingress');
if ((world as any).assaultQueueCount < 3) fail('cascading errors did not queue a colony burst');
let errorPortal = null as (typeof world.assaultPortals)[number] | null;
for (let i = 0; i < 300; i++) {
  tick(SIM_DT);
  const openedError = world.assaultPortals.find((p) => p.active);
  if (openedError && openedError.emitted >= 3) {
    errorPortal = openedError;
    break;
  }
}
if (!errorPortal) fail('a cascading-error burst never opened a portal');
if (liveErrors() < 3) fail(`cascading-error burst delivered ${liveErrors()} of 3 blocks`);
for (let i = 0; i < 120; i++) tick(SIM_DT);
if (world.assaultPortals.some((p) => p.active)) fail('the cascading-error portal never closed');
for (const e of world.errors) {
  if (!e.active) continue;
  if (Math.hypot(e.x - errorPortal.x, e.y - errorPortal.y) > 120) fail('an error block appeared away from the portal mouth');
  if (Math.hypot(e.x - player.x, e.y - player.y) < 300) fail('an error block landed near the player instead of the edge');
}
console.log(JSON.stringify({ portal: { x: Math.round(portal.x), y: Math.round(portal.y), playerDistance: Math.round(playerDistance) }, burstSentries, errors: liveErrors() }));
console.log('assault-check: OK');
