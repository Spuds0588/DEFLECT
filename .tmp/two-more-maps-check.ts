import {
  ARENAS,
  arenaIndexById,
  arenaSolids,
  carProgressAt,
  carRouteAt,
  type Rect,
} from '../src/game/arenas';
import { buildSnapshotHazards } from '../src/net/net';
import { World } from '../src/game/world';
import type { InputFrame } from '../src/game/types';

const zero: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };

if (ARENAS.length !== 22) throw new Error(`expected 22 arenas, got ${ARENAS.length}`);
if (arenaIndexById(19) !== 19) throw new Error('WEAPON SYSTEMS moved out of index 19');
if (arenaIndexById(20) !== 20) throw new Error('SPEAK & FIND is not at index 20');
if (arenaIndexById(21) !== 21) throw new Error('CAR NAVIGATION is not at index 21');

const seekArena = ARENAS[20];
if (seekArena.name !== 'SPEAK & FIND') throw new Error('wrong seek arena');
const seek = seekArena.seek;
if (!seek) throw new Error('seek arena has no seek layout');
if (seek.cards.length !== 6) throw new Error(`expected 6 picture cards, got ${seek.cards.length}`);
if (seek.prompts.length !== 6) throw new Error('prompt deck does not cover every card');
for (let i = 0; i < seek.prompts.length; i++) {
  const prompt = seek.prompts[i];
  if (prompt.card < 0 || prompt.card >= seek.cards.length) throw new Error('prompt points outside the card deck');
  if (!prompt.text.includes('FIND')) throw new Error(`prompt is not a find instruction: ${prompt.text}`);
}
if (seekArena.pillars.length < 4) throw new Error('seek toy has too few cover keys');
for (const spawn of seekArena.spawns) {
  for (const pillar of seekArena.pillars) {
    if (
      spawn.x > pillar.x &&
      spawn.x < pillar.x + pillar.w &&
      spawn.y > pillar.y &&
      spawn.y < pillar.y + pillar.h
    ) {
      throw new Error(`seek spawn ${spawn.x},${spawn.y} is inside cover`);
    }
  }
}
for (const card of seek.cards) {
  if (card.w < 100 || card.h < 100) throw new Error('picture card is too small to read');
}

const seekWorld = new World('training', ['SEEK'], 0, seekArena);
seekWorld.drone.active = false;
for (let i = 0; i < 120; i++) seekWorld.step(1 / 60, [zero]);
if (seekWorld.carProgress !== 0 || seekWorld.rocketProgress !== 0) throw new Error('seek arena ran a route clock');
if (buildSnapshotHazards(seekWorld) !== null) throw new Error('seek presentation leaked into SnapshotHazards');

const carArena = ARENAS[21];
if (carArena.name !== 'CAR NAVIGATION') throw new Error('wrong car arena');
const car = carArena.car;
if (!car) throw new Error('car arena has no route layout');
if (car.route.length < 8) throw new Error('route needs a serpentine polyline');
if (car.segments < 128 || car.thickness < 20) throw new Error('route wall is too sparse');
if (car.stops.length < 3) throw new Error('car route needs named stops');
for (const spawn of carArena.spawns) {
  for (const pillar of carArena.pillars) {
    if (
      spawn.x > pillar.x &&
      spawn.x < pillar.x + pillar.w &&
      spawn.y > pillar.y &&
      spawn.y < pillar.y + pillar.h
    ) {
      throw new Error(`car spawn ${spawn.x},${spawn.y} is inside cover`);
    }
  }
}
if (carProgressAt(car, 0) !== 0 || carProgressAt(car, car.duration) !== 1) throw new Error('car progress is wrong');
if (carProgressAt(car, car.duration * 2) !== 1) throw new Error('car progress is not clamped');

const p = { x: 0, y: 0 };
carRouteAt(car, 0, p);
if (Math.abs(p.x - car.route[0].x) > 0.01 || Math.abs(p.y - car.route[0].y) > 0.01) {
  throw new Error('route does not start at the first point');
}
carRouteAt(car, 1, p);
const last = car.route[car.route.length - 1];
if (Math.abs(p.x - last.x) > 0.01 || Math.abs(p.y - last.y) > 0.01) throw new Error('route does not end at the last point');

let routeLength = 0;
for (let i = 1; i < car.route.length; i++) {
  routeLength += Math.hypot(car.route[i].x - car.route[i - 1].x, car.route[i].y - car.route[i - 1].y);
}
if (routeLength < 1500) throw new Error('route is too short to divide the arena');
if (routeLength / car.segments >= car.thickness) throw new Error('route samples can leave a walkable gap');
let turns = 0;
for (let i = 2; i < car.route.length; i++) {
  const a = car.route[i - 1].y - car.route[i - 2].y;
  const b = car.route[i].y - car.route[i - 1].y;
  if (a !== 0 && b !== 0 && Math.sign(a) !== Math.sign(b)) turns++;
}
if (turns < 3) throw new Error('route does not snake');

const world = new World('training', ['CAR'], 0, carArena);
world.drone.active = false;
world.drone.respawnT = 1e9;
const internals = world as unknown as {
  carBarrierRects: Rect[];
  solids: readonly Rect[];
};
const staticSolids = arenaSolids(carArena).length;
if (internals.solids.length !== staticSolids + car.segments) {
  throw new Error('car collision blocks are missing from solids');
}
if (internals.carBarrierRects.some((r) => r.w > 0)) throw new Error('car wall starts live');

for (let i = 0; i < 60 * 6; i++) world.step(1 / 60, [zero]);
if (world.carProgress <= 0 || world.carProgress >= 1) throw new Error('car wall did not grow');
const liveEarly = internals.carBarrierRects.filter((r) => r.w > 0).length;
if (liveEarly < 10 || liveEarly > car.segments) throw new Error('car wall live count is wrong');

for (let i = 0; i < 60 * 26; i++) world.step(1 / 60, [zero]);
if (world.carProgress !== 1) throw new Error('car wall did not reach the destination');
const liveLate = internals.carBarrierRects.filter((r) => r.w > 0).length;
if (liveLate !== car.segments) throw new Error(`car wall incomplete (${liveLate}/${car.segments})`);
if (internals.carBarrierRects.some((r) => r.w !== car.thickness || r.h !== car.thickness)) {
  throw new Error('car wall blocks do not use the authored thickness');
}
const hazards = buildSnapshotHazards(world);
if (hazards !== null) throw new Error('local car state leaked into SnapshotHazards');

world.beginRound();
if (world.carProgress !== 0) throw new Error('round reset did not clear the car clock');
if (internals.carBarrierRects.some((r) => r.w > 0)) throw new Error('round reset did not clear the car wall');

console.log(
  JSON.stringify({
    arenas: ARENAS.length,
    seekId: seekArena.id,
    seekCards: seek.cards.length,
    seekPrompts: seek.prompts.length,
    seekKeys: seekArena.pillars.length,
    carId: carArena.id,
    carSegments: car.segments,
    carThickness: car.thickness,
    carRouteLength: Math.round(routeLength),
    carLiveEarly: liveEarly,
    carLiveLate: liveLate,
    carTurns: turns,
    carHazards: hazards === null ? 0 : hazards.length,
    carReset: world.carProgress,
  }),
);
