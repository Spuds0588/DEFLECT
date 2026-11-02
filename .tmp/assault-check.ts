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

for (const s of world.sentries) s.active = false;
for (const w of world.worms) w.active = false;
for (const v of world.viruses) v.active = false;
for (const portal of world.assaultPortals) portal.active = false;
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

// It spews the whole burst, then closes.
for (let i = 0; i < 240; i++) tick(SIM_DT);
if (liveSentries() < 4) fail(`burst delivered ${liveSentries()} of 4 sentries`);
if (world.assaultPortals.some((p) => p.active)) fail('the portal never closed after the burst');
for (const s of world.sentries) {
  if (!s.active) continue;
  if (Math.hypot(s.x - portal.x, s.y - portal.y) > 150) fail('a burst sentry appeared away from the portal mouth');
  if (Math.hypot(s.x - player.x, s.y - player.y) < 200) fail('a burst sentry landed on top of the player');
}

// A pack request goes through the queue, not a direct spawn.
for (const s of world.sentries) s.active = false;
for (const p of world.assaultPortals) p.active = false;
(world as any).assaultQueueCount = 0;
(world as any).assaultQueueIndex = 0;
(world as any).spawnSentryPack();
if ((world as any).assaultQueueCount <= 0) fail('a sentry pack did not queue for a portal');
if (liveSentries() !== 0) fail('a sentry pack still spawned around the player directly');

// Worms use the same ingress.
for (let i = 0; i < 3; i++) tick(SIM_DT);
queue(1, 0, 1);
for (let i = 0; i < 900; i++) tick(SIM_DT);
if (!world.worms.some((w) => w.active)) fail('a worm never arrived through a portal');
console.log(JSON.stringify({ portal: { x: Math.round(portal.x), y: Math.round(portal.y), playerDistance: Math.round(playerDistance) }, sentries: liveSentries() }));
console.log('assault-check: OK');
