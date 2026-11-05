/**
 * New-fixture multiplayer probe:
 *   1. the host emits a SnapshotHazards block for each new arena;
 *   2. parseSnapshot carries the traffic/radio state to a guest;
 *   3. NetView mirrors camera photos, light zones, the crosswalk layout and the tuner;
 *   4. a guest predictor receives the crosswalk layout as solid cover.
 *
 * Run with `npx tsx .tmp/mp-fixtures-check.ts`.
 */
import { pack, unpack } from 'peerjs-js-binarypack';
import { ARENAS } from '../src/game/arenas';
import { SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';
import { buildSnapshotHazards, LocalPredictor, MSG, NetView, parseSnapshot, type Snapshot } from '../src/net/net';

const fail = (message: string): never => {
  throw new Error(message);
};

const makeWorld = (id: number): World => {
  const world = new World('training', ['QA'], 0, ARENAS[id]);
  world.drone.active = false;
  world.drone.respawnT = 1e9;
  return world;
};

const packetFor = (world: World): unknown[] => {
  const hazards = buildSnapshotHazards(world);
  if (!hazards) fail(`${world.arena.name} emitted no hazard block`);
  if (typeof hazards[10] !== 'object' || hazards[10] === null) fail(`${world.arena.name} did not use the fixture slot`);
  return [MSG.SNAPSHOT, 1, 1, 0, 1, 0, -1, -1, [], [], [], null, [], hazards];
};

const guestView = (world: World): { view: NetView; snap: Snapshot } => {
  const snap = parseSnapshot(unpack(pack(packetFor(world))) as unknown[]) ?? fail('snapshot did not parse');
  const view = new NetView(0, world.arena);
  view.pushSnapshot(snap);
  view.present();
  return { view, snap };
};

// TRAFFIC CAMERA: a live photo must reach the guest view.
{
  const world = makeWorld(49);
  const traffic = world.traffic ?? fail('TRAFFIC CAMERA has no host runtime');
  traffic.photoT = 0;
  world.step(SIM_DT, [null]);
  for (let i = 0; i < 40; i++) world.step(SIM_DT, [null]);
  const { view, snap } = guestView(world);
  if (!snap.hazards?.traffic) fail('camera state missing after parse');
  if (!view.traffic?.photos.some((photo) => photo.active)) fail('guest camera view has no live photo');
  if (view.traffic.pipeFlash.length !== 3) fail('guest camera view has no feed flashes');
}

// TRAFFIC LIGHT: the stage clock and zone positions reach the guest.
{
  const world = makeWorld(50);
  for (let i = 0; i < 45; i++) world.step(SIM_DT, [null]);
  const { view, snap } = guestView(world);
  if (!snap.hazards?.traffic) fail('traffic-light state missing after parse');
  if (!view.traffic) fail('traffic-light guest view missing');
  if (view.traffic.lightStage !== 0) fail(`guest light stage ${view.traffic.lightStage}, want 0`);
  if (!view.traffic.lightActive) fail('guest light warning never became live');
  if (view.traffic.zoneX[0] === 0) fail('guest light zone did not move');
}

// CROSSWALK: the walk layout reaches the guest and the predictor.
{
  const world = makeWorld(51);
  const traffic = world.traffic ?? fail('CROSSWALK has no host runtime');
  traffic.crosswalkT = 4.98;
  world.step(SIM_DT, [null]);
  world.step(SIM_DT, [null]);
  if (!traffic.crosswalkWalk) fail('host crosswalk did not enter the walk layout');
  const { view, snap } = guestView(world);
  if (!snap.hazards?.traffic?.crosswalkWalk) fail('crosswalk walk layout missing after parse');
  if (!view.traffic?.crosswalkWalk) fail('guest crosswalk view did not adopt the walk layout');
  if (!view.predictor.crosswalkWalk) fail('guest predictor did not adopt the walk layout');

  const walk = world.arena.crosswalk?.walk[0] ?? fail('crosswalk has no walk cover');
  const model = new LocalPredictor(0, world.arena);
  const cx = walk.x + walk.w * 0.5;
  const cy = walk.y + walk.h * 0.5;
  model.adopt([0, 1, cx, cy, 0, 3, 80, 0, 0, -1, 0, 0, 0]);
  model.setCrosswalk(true);
  model.setHazards(0, 0, 0, 0, 0);
  model.step({ held: 0, pressed: 0, mx: 0, my: 0 }, SIM_DT);
  if (model.p.x > walk.x && model.p.x < walk.x + walk.w && model.p.y > walk.y && model.p.y < walk.y + walk.h) {
    fail('guest prediction did not resolve the walk cover');
  }
}

// CAR RADIO: the tuner and station clock reach the guest.
{
  const world = makeWorld(52);
  for (let i = 0; i < 14; i++) world.step(SIM_DT, [null]);
  const { view, snap } = guestView(world);
  if (!snap.hazards?.radio) fail('car-radio state missing after parse');
  if (!view.radio) fail('car-radio guest view missing');
  if (view.radio.sliderT <= 0) fail('guest tuner did not move');
  if (view.radio.sliderX <= world.arena.radio!.slider.path[0].x) fail('guest tuner x did not advance');
  if (view.radio.station !== 0) fail('guest radio began on the wrong station');
}

console.log('mp fixtures ok: camera, light, crosswalk and radio reach the guest');
