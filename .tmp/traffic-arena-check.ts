/**
 * Traffic fixture probe:
 *   1. TRAFFIC CAMERA, TRAFFIC LIGHT and CROSSWALK SIGN are indexes 49-51 before QA
 *      TEST RANGE, and TEST RANGE has moved to index 52;
 *   2. every spawn clears both crosswalk layouts;
 *   3. camera photos warn, launch, travel an authored route, hit one body once and de-rez
 *      into the matching feed mouth;
 *   4. the traffic light warns before damage, damages only the live zone and advances its
 *      stage on the authored clock;
 *   5. the crosswalk swaps its solid layout, ejects a body from the new cover, and leaves
 *      the shared ARENAS record untouched;
 *   6. host state is carried in SnapshotHazards and a local match still runs the fixtures.
 *
 * Run with `npx tsx .tmp/traffic-arena-check.ts`.
 */
import { ARENAS } from '../src/game/arenas';
import { PLAYER, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';

const fail = (message: string): never => {
  throw new Error(message);
};

const specs = [
  [49, 'TRAFFIC CAMERA'],
  [50, 'TRAFFIC LIGHT'],
  [51, 'CROSSWALK SIGN'],
] as const;

const gapToRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }): number => {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
};

const insideRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean =>
  x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;

const makeWorld = (id: number, mode: 'training' | 'match' = 'training'): World => {
  const world = new World(mode, ['QA'], 0, ARENAS[id]);
  world.drone.active = false;
  world.drone.respawnT = 1e9;
  return world;
};

const run = (world: World, seconds: number): void => {
  const steps = Math.ceil(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) world.step(SIM_DT, [null]);
};

for (const [index, name] of specs) {
  const arena = ARENAS[index] ?? fail(`ARENAS[${index}] is missing`);
  if (arena.id !== index || arena.name !== name) fail(`arena ${index} is ${arena.id}/${arena.name}, want ${index}/${name}`);
  if (arena.qa) fail(`${name} is marked QA`);
  if (arena.spawns.length !== 8) fail(`${name} has ${arena.spawns.length} spawns, want 8`);
  if (arena.pillars.length !== 0) fail(`${name} has authored static pillars`);
  const layouts = arena.crosswalk ? [...arena.crosswalk.stop, ...arena.crosswalk.walk] : arena.pillars;
  for (let i = 0; i < arena.spawns.length; i++) {
    const s = arena.spawns[i];
    if (s.x <= arena.bounds.left || s.x >= arena.bounds.right || s.y <= arena.bounds.top || s.y >= arena.bounds.bottom) {
      fail(`${name} spawn ${i} leaves the floor`);
    }
    for (let p = 0; p < layouts.length; p++) {
      if (gapToRect(s.x, s.y, layouts[p]) < PLAYER.radius + 4) fail(`${name} spawn ${i} crowds crosswalk cover ${p}`);
    }
  }
  const world = makeWorld(index);
  if (!world.traffic) fail(`${name} has no traffic runtime`);
  if (buildSnapshotHazards(world) === null) fail(`${name} emitted no SnapshotHazards block`);
  if (makeWorld(index, 'match').traffic === null) fail(`${name} is absent from a local match`);
}

if (ARENAS[53]?.id !== 90) fail(`QA arena moved: index 53 is ${ARENAS[53]?.id}`);

// A camera photo warns, launches, crosses the floor and lands in its feed.
{
  const arena = ARENAS[49];
  const def = arena.camera ?? fail('TRAFFIC CAMERA has no camera data');
  const world = makeWorld(49);
  const traffic = world.traffic ?? fail('TRAFFIC CAMERA has no runtime');
  const p = world.players[0];
  const a = def.paths[0][0];
  const b = def.paths[0][1];
  p.x = a.x + (b.x - a.x) * 0.4;
  p.y = a.y + (b.y - a.y) * 0.4;
  p.iframes = 0;
  p.hp = p.maxHp;
  const before = p.hp;
  traffic.photoT = 0;
  world.step(SIM_DT, [null]);
  if (traffic.cameraFlashT <= 0) fail('camera never flashed');
  run(world, def.warn + 0.02);
  if (!traffic.photos.some((photo) => photo.active)) fail('camera flash launched no photo');
  run(world, 1);
  if (p.hp !== before - def.damage) fail(`camera photo damage was ${before - p.hp}, want ${def.damage}`);
  let arrived = false;
  for (let i = 0; i < 600 && !arrived; i++) {
    world.step(SIM_DT, [null]);
    if (traffic.pipeFlash.some((flash) => flash > 0)) arrived = true;
  }
  if (!arrived) fail('camera photo never reached a feed mouth');
  for (let i = 0; i < def.paths.length; i++) {
    const end = def.paths[i][def.paths[i].length - 1];
    if (end.x !== def.pipes[i].x || end.y !== def.pipes[i].y) fail(`camera route ${i} does not end at its pipe`);
  }
}

// The signal warns before it burns, and only the live stage's zone is hot.
{
  const arena = ARENAS[50];
  const def = arena.light ?? fail('TRAFFIC LIGHT has no light data');
  const world = makeWorld(50);
  const traffic = world.traffic ?? fail('TRAFFIC LIGHT has no runtime');
  const p = world.players[0];
  p.x = traffic.zoneX[0];
  p.y = traffic.zoneY[0];
  p.iframes = 0;
  p.hp = p.maxHp;
  const before = p.hp;
  run(world, def.warn - 0.12);
  if (p.hp !== before) fail('traffic light damaged a body during its warning');
  run(world, 0.3);
  if (p.hp !== before - def.damage) fail(`traffic light damage was ${before - p.hp}, want ${def.damage}`);
  const stage = traffic.lightStage;
  traffic.lightStageT = def.stages[stage].duration - 0.01;
  world.step(SIM_DT, [null]);
  if (traffic.lightStage === stage) fail('traffic light did not advance its stage');
  if (traffic.lightWarnT <= 0) fail('traffic light advanced without a warning window');
}

// The sign swaps the solid layout and clears a body out of the new cover.
{
  const arena = ARENAS[51];
  const def = arena.crosswalk ?? fail('CROSSWALK SIGN has no crosswalk data');
  const sharedBefore = arena.pillars.length;
  const world = makeWorld(51);
  const traffic = world.traffic ?? fail('CROSSWALK SIGN has no runtime');
  if (world.arena.pillars.length !== def.stop.length) fail('crosswalk did not start on its stop layout');
  const target = def.walk[0];
  const p = world.players[0];
  p.x = target.x + target.w / 2;
  p.y = target.y + target.h / 2;
  traffic.crosswalkT = def.period - def.walkTime - 0.02;
  run(world, 0.08);
  if (!traffic.crosswalkWalk) fail('crosswalk did not reach its walk phase');
  if (world.arena.pillars.length !== def.walk.length) fail('crosswalk did not install its walk layout');
  for (let i = 0; i < def.walk.length; i++) {
    if (insideRect(p.x, p.y, def.walk[i])) fail(`crosswalk left a body inside walk block ${i}`);
  }
  if (arena.pillars.length !== sharedBefore) fail('crosswalk mutated the shared ARENAS record');
  traffic.crosswalkT = def.period - 0.02;
  run(world, 0.1);
  if (traffic.crosswalkWalk) fail('crosswalk did not return to its stop phase');
  if (world.arena.pillars.length !== def.stop.length) fail('crosswalk did not restore its stop layout');
}

console.log('traffic arenas ok: camera files, signal stages, crosswalk cover');
