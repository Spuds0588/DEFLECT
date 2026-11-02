/**
 * QUARANTINE plate rebuild probe.
 *
 * Checks the four-plate floor (no shared rectangle under it), the three bridge decks
 * with two of them retracted, and the ingress ports: authored on the plates, damageable
 * through the ordinary prop path, releasing a bridge and finally the white exit port.
 */
import { ARENAS, arenaIndexById } from '../src/game/arenas';
import { PLAYER } from '../src/game/config';
import { CAMPAIGN_LEVELS } from '../src/game/campaign';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};

const index = arenaIndexById(14);
const arena = ARENAS[index];
if (arena.name !== 'QUARANTINE') fail(`arena 14 is ${arena.name}`);
const islands = arena.islands ?? fail('QUARANTINE has no islands');
if (islands.length !== 4) fail(`expected 4 plates, got ${islands.length}`);
const rooms = arena.rooms ?? fail('QUARANTINE has no rooms');
if (rooms.length !== islands.length) fail('every plate needs one room dressing');
const bridges = arena.bridges ?? fail('QUARANTINE has no bridges');

// Each plate has to be bigger than the old floor plates it replaced and carry one room.
for (let i = 0; i < islands.length; i++) {
  const plate = islands[i];
  const room = rooms[i];
  if (room.x !== plate.x || room.y !== plate.y || room.w !== plate.w || room.h !== plate.h) {
    fail(`room ${i} does not match its plate`);
  }
  if (plate.w * plate.h < 300_000) fail(`plate ${i} is only ${Math.round(plate.w * plate.h)} square units`);
}

// Plates must not touch each other: the gap is what makes them islands.
for (let i = 0; i < islands.length; i++) {
  for (let j = i + 1; j < islands.length; j++) {
    const a = islands[i];
    const b = islands[j];
    const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    if (overlapX > 0 && overlapY > 0) fail(`plates ${i} and ${j} overlap`);
  }
}

// Bridge gaps must be wider than a dash, or a retracted deck is pointless.
for (const bridge of bridges) {
  const horizontal = bridge.h < bridge.w;
  const span = horizontal ? bridge.w : bridge.h;
  if (span < PLAYER.dashDistance + PLAYER.radius * 2) {
    fail(`bridge ${bridge.label} spans ${span}, which a dash can clear`);
  }
}

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

// Every plate centre is floor; every gap centre is not.
for (const plate of islands) {
  if (inVoid(plate.x + plate.w * 0.5, plate.y + plate.h * 0.5)) fail('a plate centre reads as void');
}
const gapX = (islands[0].x + islands[0].w + islands[2].x) * 0.5;
const gapY = islands[2].y + islands[2].h * 0.5;
if (!inVoid(gapX, gapY)) fail('the gap between the left and right plates is floor');

// Bridge A is the way in; B and C are retracted, and a retracted deck is solid.
if (world.bridgeMask !== 1) fail(`only bridge A should start extended, mask=${world.bridgeMask}`);
if (!inVoid(bridges[1].x + bridges[1].w * 0.5, bridges[1].y + bridges[1].h * 0.5)) {
  fail('a retracted deck reads as walkable floor');
}
// The solver is rebuilt in place on a milestone, so read it fresh every time.
const hasRect = (r: { x: number; y: number; w: number; h: number }): boolean =>
  ((world as any).solids as { x: number; y: number; w: number; h: number }[]).some(
    (s) => s.x === r.x && s.y === r.y && s.w === r.w && s.h === r.h,
  );
if (!hasRect(bridges[1])) fail('the retracted deck is not a body barrier');
if (!hasRect(bridges[2])) fail('the retracted right deck is not a body barrier');

// Spawns and cover have to sit on a plate, never over a gap.
for (const spawn of arena.spawns) {
  if (inVoid(spawn.x, spawn.y)) fail(`spawn ${spawn.x},${spawn.y} starts over the void`);
}
for (const pillar of arena.pillars) {
  const cx = pillar.x + pillar.w * 0.5;
  const cy = pillar.y + pillar.h * 0.5;
  if (inVoid(cx, cy)) fail(`cover at ${cx},${cy} floats over the void`);
}

// --- Ports ---------------------------------------------------------------------
if (world.portTotal !== 3) fail(`expected 3 ingress ports, got ${world.portTotal}`);
const portals = world.props.filter((p) => p.portal === true);
if (portals.length !== 3) fail(`expected 3 portal props, got ${portals.length}`);
for (const portal of portals) {
  if (inVoid(portal.x + portal.w * 0.5, portal.y + portal.h * 0.5)) fail('a port sits over the void');
  if (portal.fixed !== true) fail('a port must be mounted, not loose debris');
}

// --- The level opens populated -------------------------------------------------
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

const damageProp = (world as any).damageProp.bind(world) as (b: any, n: number, x: number, y: number) => void;
const boardPorts = portals.filter((p) => p.portalBridge === 2);
if (boardPorts.length !== 2) fail(`expected two mainboard ports, got ${boardPorts.length}`);
const routerPort = portals.find((p) => p.portalBridge !== 2) ?? fail('no router port');

// Closing one of the board pair must not release the bridge on its own.
damageProp(boardPorts[0], boardPorts[0].hp, 0, 0);
if (world.portsClosed !== 1) fail('the port did not close');
if (world.bridgeMask !== 1) fail('one board port released the bridge early');
damageProp(boardPorts[0], 5, 0, 0);
if (world.portsClosed !== 1) fail('a closing port kept taking damage');
damageProp(boardPorts[1], boardPorts[1].hp, 0, 0);
if (world.bridgeMask !== 5) fail(`both board ports should extend bridge C, mask=${world.bridgeMask}`);
if (hasRect(bridges[2])) fail('the released deck is still a barrier');

// All ports down: the white party port opens and kitty takes the story box.
damageProp(routerPort, routerPort.hp, 0, 0);
if (!world.campaignExitReady) fail('the exit port did not open');
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

console.log('islands-ports-check: OK');
