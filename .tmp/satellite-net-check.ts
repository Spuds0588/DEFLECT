import { pack } from 'peerjs-js-binarypack';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import { buildSnapshotHazards, MSG, NetView, parseSnapshot } from '../src/net/net';

const arena = ARENAS.find((a) => a.name === 'SATELLITE');
if (!arena?.satellite) throw new Error('SATELLITE arena missing');
const world = new World('training', ['QA'], 0, arena);
world.players[0].iframes = 1e9;
world.satelliteT = 4;
world.satelliteState = 2;
world.satelliteThrusterT = 0;
world.satelliteReentryT = 7;
world.satelliteHeatY = 1000;
for (let i = 0; i < world.satelliteMeteors.length; i++) {
  const meteor = world.satelliteMeteors[i];
  meteor.active = true;
  meteor.x = 640 + i * 20;
  meteor.y = 900 + i * 10;
  meteor.t = 0.5;
  meteor.hit = false;
}

const hazards = buildSnapshotHazards(world);
if (!Array.isArray(hazards)) throw new Error('SATELLITE emitted no hazard block');
if (hazards.length !== 16) throw new Error(`expected 16 hazard fields, got ${hazards.length}`);
if (hazards[9] === null || !Array.isArray(hazards[9])) throw new Error('props missing at index 9');
const capRow = (hazards[9] as number[][]).find((row) => row[9] === 1);
if (!capRow) throw new Error('capacitor flag was not carried in the prop row');
if (hazards[10] !== 4 || hazards[11] !== 2) throw new Error('satellite clock/state missing');
if (!Array.isArray(hazards[15]) || (hazards[15] as number[][]).length !== 7) {
  throw new Error('live meteor rows missing');
}

const packet: unknown[] = [
  MSG.SNAPSHOT,
  1,
  1,
  0,
  1,
  0,
  0,
  -1,
  [[0, 1, 640, 960, 0, 3, 100, 0]],
  [],
  [],
  null,
  [],
  hazards,
];
const snap = parseSnapshot(packet);
if (!snap?.hazards) throw new Error('snapshot parser dropped SATELLITE hazards');
if (snap.hazards.satelliteState !== 2 || snap.hazards.satelliteT !== 4) {
  throw new Error('snapshot parser lost the satellite state');
}
if (snap.hazards.satelliteMeteors.length !== 7) throw new Error('snapshot parser lost the meteors');

const view = new NetView(0, arena);
view.pushSnapshot(snap);
view.present();
if (view.satelliteState !== 2) throw new Error(`guest state is ${view.satelliteState}`);
if (view.satelliteT < 4) throw new Error('guest satellite clock did not advance');
if (view.satelliteReentryT < 7) throw new Error('guest reentry clock did not advance');
if (view.satelliteHeatY >= arena.bounds.bottom) throw new Error('guest heat front did not derive');
if (!view.satelliteMeteors.every((m) => m.active)) throw new Error('guest meteors are not visible');
if (!view.props.some((p) => p.active && p.capacitor)) throw new Error('guest capacitor is not visible');

// The mast is dynamic body cover in the guest predictor.
type PredictorInternals = { solids: { x: number; y: number; w: number; h: number }[] };
const predictor = view.predictor as unknown as PredictorInternals;
view.predictor.setHazards(0, 0, 0, 0, 5.2);
const tel = arena.satellite.telescope;
const mast = predictor.solids.find((r) => r.x === tel.x && r.w === tel.w && r.h > 200);
if (!mast) throw new Error('guest predictor did not add the extended mast');

console.log(
  JSON.stringify({
    hazards: hazards.length,
    hazardBytes: pack(hazards).byteLength,
    props: (hazards[9] as number[][]).length,
    meteor: view.satelliteMeteors[0],
    satelliteT: view.satelliteT,
    reentryT: view.satelliteReentryT,
    heatY: Math.round(view.satelliteHeatY),
    mastH: mast.h,
    capacitors: view.props.filter((p) => p.capacitor).length,
  }),
);
