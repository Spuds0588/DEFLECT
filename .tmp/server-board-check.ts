/**
 * Server-board foundations, headless:
 *   1. IDs 37-39 stay in order before the QA range;
 *   2. every module is inside the board, becomes exactly one pillar, and modules do not
 *      overlap each other;
 *   3. every perimeter spawn is clear of module cover and inside the playfield;
 *   4. the boards carry no hazard/fixture state yet, and no room/portal state that would
 *      accidentally make them a campaign node or an online arena.
 *
 * Run with `npx tsx .tmp/server-board-check.ts`.
 */
import { ARENAS, arenaSolids } from '../src/game/arenas';

const fail = (message: string): never => {
  throw new Error(message);
};

const expected = [
  { id: 37, name: 'CPU BOARD', kind: 'cpu' },
  { id: 38, name: 'GPU BOARD', kind: 'gpu' },
  { id: 39, name: 'NETWORK BOARD', kind: 'network' },
] as const;

const rectGap = (
  r: { x: number; y: number; w: number; h: number },
  x: number,
  y: number,
): number => {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
};

for (let i = 0; i < expected.length; i++) {
  const want = expected[i];
  const arena = ARENAS[want.id];
  if (!arena) fail(`arena index ${want.id} is missing`);
  if (arena.id !== want.id) fail(`arena index ${want.id} holds id ${arena.id}`);
  if (arena.name !== want.name) fail(`arena ${want.id} is ${arena.name}, want ${want.name}`);
  const server = arena.server ?? fail(`arena ${want.id} has no server board`);
  if (server.kind !== want.kind) fail(`arena ${want.id} is ${server.kind}, want ${want.kind}`);
  if (server.modules.length < 5) fail(`arena ${want.id} has only ${server.modules.length} modules`);
  if (arena.pillars.length !== server.modules.length) {
    fail(`arena ${want.id} has ${arena.pillars.length} pillars for ${server.modules.length} modules`);
  }

  const board = server.board;
  const bounds = arena.bounds;
  for (let m = 0; m < server.modules.length; m++) {
    const mod = server.modules[m];
    const tag = `${arena.name} ${mod.label}`;
    if (mod.x < board.x || mod.y < board.y || mod.x + mod.w > board.x + board.w || mod.y + mod.h > board.y + board.h) {
      fail(`${tag} leaves the PCB footprint`);
    }
    if (mod.x < bounds.left || mod.y < bounds.top || mod.x + mod.w > bounds.right || mod.y + mod.h > bounds.bottom) {
      fail(`${tag} leaves the playfield`);
    }
    const pillar = arena.pillars[m];
    if (pillar.x !== mod.x || pillar.y !== mod.y || pillar.w !== mod.w || pillar.h !== mod.h) {
      fail(`${tag} does not match its pillar`);
    }
    for (let n = m + 1; n < server.modules.length; n++) {
      const other = server.modules[n];
      if (mod.x < other.x + other.w && mod.x + mod.w > other.x && mod.y < other.y + other.h && mod.y + mod.h > other.y) {
        fail(`${tag} overlaps ${other.label}`);
      }
    }
  }

  if (arena.spawns.length !== 8) fail(`${arena.name} has ${arena.spawns.length} spawns, want 8`);
  for (let s = 0; s < arena.spawns.length; s++) {
    const spawn = arena.spawns[s];
    if (spawn.x < bounds.left || spawn.x > bounds.right || spawn.y < bounds.top || spawn.y > bounds.bottom) {
      fail(`${arena.name} spawn ${s} leaves the playfield`);
    }
    for (let m = 0; m < server.modules.length; m++) {
      const mod = server.modules[m];
      if (rectGap(mod, spawn.x, spawn.y) < 28) {
        fail(`${arena.name} spawn ${s} crowds ${mod.label}`);
      }
    }
  }

  const hazards = [
    arena.emitters,
    arena.disc,
    arena.pipes,
    arena.firewallSwitch,
    arena.keypad,
    arena.scanner,
    arena.fax,
    arena.browser,
    arena.regulars,
    arena.usb,
    arena.swipe,
    arena.car,
    arena.radar,
    arena.pong,
    arena.flip,
    arena.invaders,
    arena.plug,
    arena.smoke,
    arena.watch,
    arena.laptop,
    arena.rocket,
    arena.weapon,
    arena.seek,
    arena.rooms,
    arena.ingress,
    arena.port,
  ];
  if (hazards.some((h) => h !== undefined)) fail(`${arena.name} gained a hazard or portal record`);
  if (arenaSolids(arena).length !== arena.pillars.length) fail(`${arena.name} has extra body solids`);
}

if (ARENAS[40]?.id !== 90) fail(`QA arena moved: index 40 is ${ARENAS[40]?.id}`);

const names = expected.map((e) => ARENAS[e.id].name).join(', ');
console.log(`server boards ok: ${names} // modules and spawns are clear`);
