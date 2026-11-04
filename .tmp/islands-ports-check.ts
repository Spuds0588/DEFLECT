/**
 * QUARANTINE flat-floor campaign probe.
 *
 * The campaign device is one continuous floor now: rooms are painted plates, there are
 * no island decks or retracted bridges, and the three ingress ports are the only gate to
 * the white party port. Replicators still must not count as campaign ports.
 */
import { ARENAS, arenaIndexById } from '../src/game/arenas';
import { CAMPAIGN_LEVELS } from '../src/game/campaign';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};

const arena = ARENAS[arenaIndexById(14)];
if (arena.name !== 'QUARANTINE') fail(`arena 14 is ${arena.name}`);
if (arena.islands) fail('QUARANTINE still declares islands');
if (arena.bridges) fail('QUARANTINE still declares bridge decks');
const rooms = arena.rooms ?? fail('QUARANTINE has no rooms');
if (rooms.length !== 4) fail(`expected four painted rooms, got ${rooms.length}`);

const level = CAMPAIGN_LEVELS[0];
const world = new World(
  'gauntlet',
  ['INMATE'],
  0,
  arena,
  false,
  0,
  0,
  null,
  true,
  level.dataCrates,
  false,
  'warden',
  level.clearKills,
);

const inVoid = (world as any).inVoid.bind(world) as (x: number, y: number) => boolean;

// The whole device is floor: spawns, cover and every room centre stay on it.
for (const spawn of arena.spawns) {
  if (inVoid(spawn.x, spawn.y)) fail(`spawn ${spawn.x},${spawn.y} starts over the void`);
}
for (const pillar of arena.pillars) {
  const cx = pillar.x + pillar.w * 0.5;
  const cy = pillar.y + pillar.h * 0.5;
  if (inVoid(cx, cy)) fail(`cover at ${cx},${cy} floats over the void`);
}
for (const room of rooms) {
  if (inVoid(room.x + room.w * 0.5, room.y + room.h * 0.5)) fail(`room ${room.label} centre reads as void`);
}

// --- Ports ---------------------------------------------------------------------
if (world.portTotal !== 3) fail(`expected 3 ingress ports, got ${world.portTotal}`);
const portals = world.props.filter((p) => p.portal === true);
if (portals.length !== 3) fail(`expected 3 portal props, got ${portals.length}`);
for (const portal of portals) {
  if (inVoid(portal.x + portal.w * 0.5, portal.y + portal.h * 0.5)) fail('a port sits over the void');
  if (portal.fixed !== true) fail('a port must be mounted, not loose debris');
}

const liveSentries = (): number => world.sentries.filter((s) => s.active).length;
const liveViruses = (): number => world.viruses.filter((v) => v.active).length;
for (const sentry of world.sentries) sentry.active = false;
for (const virus of world.viruses) virus.active = false;
(world as any).beginAssault();
if (world.campaignPhase !== 'assault') fail('the assault did not start');
const sentryCap = (world as any).sentryLimit() as number;
const virusCap = (world as any).virusLimit() as number;
if (liveSentries() < 2) fail(`the assault started with only ${liveSentries()} sentries`);
if (liveSentries() > sentryCap) fail(`the seed put ${liveSentries()} sentries past the ${sentryCap} cap`);
if (liveViruses() < 4) fail(`the assault started with only ${liveViruses()} viruses`);
if (liveViruses() > virusCap) fail(`the seed put ${liveViruses()} viruses past the ${virusCap} cap`);

// An open port keeps feeding the floor while a slot is free.
const openPort = portals.find((p) => p.active && !p.portalExit) ?? fail('no port left open');
for (const sentry of world.sentries) sentry.active = false;
const before = liveSentries();
openPort.portalT = 0;
(world as any).updatePortals(0.02);
if (liveSentries() <= before) fail('an open port emitted nothing');

// Every port must close before the white party port opens. There is no bridge pacing
// between them any more: the third closure is the gate.
const damageProp = (world as any).damageProp.bind(world) as (b: any, n: number, x: number, y: number) => void;
for (let i = 0; i < portals.length; i++) {
  damageProp(portals[i], portals[i].hp, 0, 0);
  if (i < portals.length - 1 && world.campaignExitReady) fail(`the exit opened with ${portals.length - 1 - i} ports standing`);
}
if (world.portsClosed !== 3) fail(`expected 3 closed ports, got ${world.portsClosed}`);
if (!world.campaignExitReady) fail('the exit port did not open after all three ports closed');

const exits = world.props.filter((p) => p.portalExit === true);
if (exits.length !== 1) fail(`expected one white exit port, got ${exits.length}`);
if (exits[0].fixed !== true) fail('the exit port must be mounted');
damageProp(exits[0], 99, 0, 0);
if (!exits[0].active) fail('the exit port took damage');
const line = world.tutorial?.current;
if (!line || line.speaker !== 'SCRIPT_KITTY') fail('kitty did not take the story box on the clear');

// A closed port emits nothing, once its collapse has finished.
(world as any).updatePortals(1.2);
const closed = portals.find((p) => !p.active) ?? fail('no closed port');
const held = liveSentries();
closed.portalT = 0;
(world as any).updatePortals(0.5);
if (liveSentries() > held) fail('a closed port still emitted');

// Standing in the open party port clears the node.
world.players[0].x = exits[0].x + exits[0].w * 0.5;
world.players[0].y = exits[0].y + exits[0].h * 0.5;
world.players[0].alive = true;
world.players[0].active = true;
(world as any).updateCampaign(0.016, [null]);
if (world.campaignPhase !== 'cleared') fail('standing in the party port did not clear the node');

// --- Replicators: the second ingress -------------------------------------------
const satArena = ARENAS[arenaIndexById(17)];
if (satArena.name !== 'SATELLITE') fail(`arena 17 is ${satArena.name}`);
if (!satArena.replicator || satArena.replicator.length === 0) fail('SATELLITE has no replicator');
const satWorld = new World('gauntlet', ['INMATE'], 0, satArena);
const reps = satWorld.props.filter((p) => p.replicator === true);
if (reps.length !== satArena.replicator.length) fail(`expected ${satArena.replicator.length} replicators, got ${reps.length}`);
if (satWorld.portTotal !== 0) fail('a replicator must not count as a campaign port');
satWorld.players[0].x = 640;
satWorld.players[0].y = 1700;
for (const s of satWorld.sentries) s.active = false;
reps[0].portalT = 0;
(satWorld as any).updatePortals(0.02);
if (satWorld.sentries.filter((s) => s.active).length === 0) fail('the replicator printed nothing');
(satWorld as any).damageProp(reps[0], reps[0].hp, 0, 0);
if (satWorld.portsClosed !== 0) fail('closing a replicator counted as a campaign port');
if (!((reps[0].portalCloseT ?? 0) > 0)) fail('the replicator did not close');
for (const s of satWorld.sentries) s.active = false;
reps[0].portalT = 0;
(satWorld as any).updatePortals(0.5);
if (satWorld.sentries.some((s) => s.active)) fail('a closed replicator kept printing');

console.log('islands-ports-check: OK (flat campaign floor, ports gate the exit, replicators stay separate)');
