/**
 * CAPCOM plate arena probe: four department plates in a ring, all decks open, no ingress.
 */
import { ARENAS, arenaIndexById } from '../src/game/arenas';
import { PLAYER } from '../src/game/config';
import { World } from '../src/game/world';

const fail = (m: string): never => {
  throw new Error(m);
};

const arena = ARENAS[arenaIndexById(32)];
if (arena.name !== 'CAPCOM') fail(`arena 32 is ${arena.name}`);
const islands = arena.islands ?? fail('CAPCOM has no islands');
const rooms = arena.rooms ?? fail('CAPCOM has no rooms');
const bridges = arena.bridges ?? fail('CAPCOM has no bridges');
if (islands.length !== 4) fail(`expected 4 plates, got ${islands.length}`);
if (rooms.length !== 4) fail(`expected 4 departments, got ${rooms.length}`);
if (bridges.length !== 4) fail(`expected 4 decks, got ${bridges.length}`);
if (new Set(rooms.map((r) => r.label)).size !== 4) fail('department labels repeat');
for (const b of bridges) if (b.closed) fail(`deck ${b.label} starts closed on a versus map`);
for (let i = 0; i < islands.length; i++) {
  const plate = islands[i];
  const room = rooms[i];
  if (room.x !== plate.x || room.y !== plate.y || room.w !== plate.w || room.h !== plate.h) {
    fail(`room ${i} does not match its plate`);
  }
  if (room.theme !== 'console') fail(`room ${i} is ${room.theme}, not a console room`);
}
for (let i = 0; i < islands.length; i++) {
  for (let j = i + 1; j < islands.length; j++) {
    const a = islands[i];
    const b = islands[j];
    const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    if (ox > 0 && oy > 0) fail(`plates ${i} and ${j} overlap`);
  }
}
// The ring is the route only if a dash cannot skip a gap.
const minGap = Math.min(1098 - 858, 664 - 444);
if (minGap < PLAYER.dashDistance + PLAYER.radius * 2) fail(`gap ${minGap} is dashable`);

const world = new World('gauntlet', ['CAPCOM'], 0, arena);
const inVoid = (world as any).inVoid.bind(world) as (x: number, y: number) => boolean;
for (const plate of islands) {
  if (inVoid(plate.x + plate.w * 0.5, plate.y + plate.h * 0.5)) fail('a plate centre reads as void');
}
for (const b of bridges) {
  if (inVoid(b.x + b.w * 0.5, b.y + b.h * 0.5)) fail(`deck ${b.label} is not walkable`);
}
const gapX = (islands[0].x + islands[0].w + islands[3].x) * 0.5;
// Sample clear of deck C (160..300) and deck D (800..940): the first probe point
// landed on a deck and read as floor, which is correct behaviour for a deck.
if (!inVoid(gapX, islands[0].y + islands[0].h - 30)) fail('the gap between plates reads as floor');
// Decks are floor now, never a gate: no deck may appear in the body solver's solid list.
const solids = (world as any).solids as Rect[];
for (const b of bridges) {
  if (solids.some((s) => s.x === b.x && s.y === b.y && s.w === b.w && s.h === b.h)) {
    fail(`deck ${b.label} is a body blocker`);
  }
}
for (const s of arena.spawns) if (inVoid(s.x, s.y)) fail(`spawn ${s.x},${s.y} is over the void`);
for (const p of arena.pillars) {
  if (inVoid(p.x + p.w * 0.5, p.y + p.h * 0.5)) fail('a console floats over the void');
}
if (arena.ingress || arena.replicator) fail('CAPCOM is a fighting map, not an ingress node');

// Every department reads differently: one furniture set and one cover layout each.
const variantByDepartment: Record<string, string> = {
  CAPCOM: 'flight',
  FIDO: 'dynamics',
  GUIDO: 'guidance',
  EECOM: 'systems',
};
for (const room of rooms) {
  if (room.variant !== variantByDepartment[room.label]) {
    fail(`${room.label} draws the ${room.variant} set`);
  }
}
if (new Set(rooms.map((r) => r.variant)).size !== 4) fail('two departments share a furniture set');
const plateSignature = (plate: { x: number; y: number; w: number; h: number }) =>
  arena.pillars
    .filter(
      (p) =>
        p.x >= plate.x &&
        p.y >= plate.y &&
        p.x + p.w <= plate.x + plate.w &&
        p.y + p.h <= plate.y + plate.h,
    )
    .map((p) => `${p.x},${p.y},${p.w},${p.h}`)
    .sort()
    .join('|');
const signatures = islands.map(plateSignature);
if (signatures.some((s) => s.length === 0)) fail('a department has no console banks');
if (new Set(signatures).size !== 4) fail('two departments share a cover layout');
for (const s of arena.spawns) {
  for (const p of arena.pillars) {
    const nx = Math.max(p.x, Math.min(s.x, p.x + p.w));
    const ny = Math.max(p.y, Math.min(s.y, p.y + p.h));
    if (Math.hypot(s.x - nx, s.y - ny) < PLAYER.radius + 6) {
      fail(`spawn ${s.x},${s.y} sits inside a console bank`);
    }
  }
}
console.log(
  JSON.stringify({
    departments: rooms.map((r) => `${r.label}:${r.variant}`),
    banks: arena.pillars.length,
  }),
);
console.log('capcom-check: OK');
