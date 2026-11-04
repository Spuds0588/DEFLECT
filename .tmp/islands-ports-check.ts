/**
 * Split quarantine ports.
 *
 * MAINBOARD and ROUTER are separate flat devices. Each has only its authored ingress
 * ports, and closing the last one starts the right-wall portal pull. No party-port prop
 * spawns. Replicators remain a separate local fixture and never count as campaign ports.
 */
import { ARENAS, arenaIndexById } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};

for (const [id, expected] of [[14, 0], [34, 0], [35, 2], [36, 1]] as const) {
  const arena = ARENAS[arenaIndexById(id)];
  if (!arena) fail(`arena ${id} missing`);
  if (arena.islands || arena.bridges) fail(`${arena.name} still declares plate/bridge geometry`);
  if (arena.rooms?.length !== 1) fail(`${arena.name} has ${arena.rooms?.length ?? 0} rooms`);
  if ((arena.ingress?.length ?? 0) !== expected) fail(`${arena.name} expected ${expected} ports, got ${arena.ingress?.length ?? 0}`);
  const level = PLAYABLE_CAMPAIGN_LEVELS.find((entry) => entry.arenaId === id);
  if (!level) fail(`${arena.name} has no campaign level`);

  const world = new World(
    'gauntlet', ['INMATE'], 0, arena, false, 0, 0, null, true,
    level.dataCrates, false, level.intro, level.clearKills, false, level.boss ?? -1, false,
  );
  const inVoid = (world as unknown as { inVoid: (x: number, y: number) => boolean }).inVoid.bind(world);
  for (const spawn of arena.spawns) if (inVoid(spawn.x, spawn.y)) fail(`${arena.name}: spawn falls in the void`);
  for (const room of arena.rooms!) {
    if (inVoid(room.x + room.w * 0.5, room.y + room.h * 0.5)) fail(`${arena.name}: room centre falls in the void`);
  }

  const portals = world.props.filter((p) => p.portal === true);
  if (portals.length !== expected) fail(`${arena.name}: expected ${expected} portal props, got ${portals.length}`);
  if (world.portTotal !== expected) fail(`${arena.name}: portTotal ${world.portTotal}`);

  if (expected > 0) {
    const damageProp = (world as unknown as { damageProp: (b: any, n: number, x: number, y: number) => void }).damageProp.bind(world);
    for (let i = 0; i < portals.length; i++) {
      damageProp(portals[i], portals[i].hp, 0, 0);
      if (i < portals.length - 1 && world.campaignExitReady) fail(`${arena.name}: exit opened with ports standing`);
    }
    if (world.portsClosed !== expected) fail(`${arena.name}: expected ${expected} closed ports, got ${world.portsClosed}`);
    if (!world.campaignExitReady) fail(`${arena.name}: last port did not open the exit portal`);
    if (world.campaignPortalT < 0) fail(`${arena.name}: portal pull did not start`);
    if (world.props.some((p) => p.portalExit)) fail(`${arena.name}: a party-port prop spawned`);
    for (let i = 0; i < 180 && world.campaignPhase !== 'cleared'; i++) world.step(SIM_DT, [null]);
    if (world.campaignPhase !== 'cleared') fail(`${arena.name}: portal pull left phase ${world.campaignPhase}`);
    if (!(world.players[0].x > arena.bounds.right - 60)) fail(`${arena.name}: body did not reach the portal`);
  }
  console.log(`${arena.name}: ports=${expected}, exit=${expected > 0 ? 'portal pull' : 'n/a'}`);
}

// Replicators are not campaign ports.
const satArena = ARENAS[arenaIndexById(17)];
if (satArena.name !== 'SATELLITE') fail(`arena 17 is ${satArena.name}`);
if (!satArena.replicator || satArena.replicator.length === 0) fail('SATELLITE has no replicator');
const satWorld = new World('gauntlet', ['INMATE'], 0, satArena);
const reps = satWorld.props.filter((p) => p.replicator === true);
if (reps.length !== satArena.replicator.length) fail(`expected ${satArena.replicator.length} replicators, got ${reps.length}`);
if (satWorld.portTotal !== 0) fail('a replicator must not count as a campaign port');
const damageProp = (satWorld as unknown as { damageProp: (b: any, n: number, x: number, y: number) => void }).damageProp.bind(satWorld);
damageProp(reps[0], reps[0].hp, 0, 0);
if (satWorld.portsClosed !== 0) fail('closing a replicator counted as a campaign port');
if (!((reps[0].portalCloseT ?? 0) > 0)) fail('the replicator did not close');

console.log('islands-ports-check: OK (split rooms, last port starts the pull, replicators stay separate)');
