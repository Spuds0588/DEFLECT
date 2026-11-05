/**
 * Car-radio probe:
 *   1. CAR RADIO is index 52 before QA TEST RANGE, which has moved to 53;
 *   2. spawns sit on the full floor and there are no static pillars;
 *   3. the tuner needle moves, damages a body once per pass, and clears its hit mask
 *      when it reverses;
 *   4. the dial needles animate and the station clock warns, advances and changes the
 *      waveform phase;
 *   5. none of the runtime enters SnapshotHazards and a local match still runs it.
 *
 * Run with `npx tsx .tmp/car-radio-check.ts`.
 */
import { ARENAS } from '../src/game/arenas';
import { PLAYER, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';

const fail = (message: string): never => {
  throw new Error(message);
};

const arena = ARENAS[52] ?? fail('ARENAS[52] is missing');
if (arena.id !== 52 || arena.name !== 'CAR RADIO') fail(`arena 52 is ${arena.id}/${arena.name}`);
if (arena.qa) fail('CAR RADIO is marked QA');
if (arena.pillars.length !== 0) fail('CAR RADIO has static pillars');
if (arena.spawns.length !== 8) fail(`CAR RADIO has ${arena.spawns.length} spawns, want 8`);
for (let i = 0; i < arena.spawns.length; i++) {
  const s = arena.spawns[i];
  if (s.x <= arena.bounds.left || s.x >= arena.bounds.right || s.y <= arena.bounds.top || s.y >= arena.bounds.bottom) {
    fail(`CAR RADIO spawn ${i} leaves the floor`);
  }
}
if (ARENAS[53]?.id !== 90) fail(`QA arena moved: index 53 is ${ARENAS[53]?.id}`);

const makeWorld = (mode: 'training' | 'match' = 'training'): World => {
  const world = new World(mode, ['QA'], 0, arena);
  world.drone.active = false;
  world.drone.respawnT = 1e9;
  return world;
};

const world = makeWorld();
const def = arena.radio ?? fail('CAR RADIO has no radio data');
const radio = world.radio ?? fail('CAR RADIO has no runtime');
if (def.dials.length !== 2) fail(`CAR RADIO has ${def.dials.length} dials, want 2`);
if (def.stations.length < 2) fail('CAR RADIO needs at least two stations');
if (buildSnapshotHazards(world) !== null) fail('CAR RADIO leaked into SnapshotHazards');
if (makeWorld('match').radio === null) fail('CAR RADIO is absent from a local match');

// The needle moves along the whole track and damages a body once per pass.
const p = world.players[0];
const start = def.slider.path[0];
p.x = start.x + 220;
p.y = start.y;
p.iframes = 0;
p.hp = p.maxHp;
const before = p.hp;
const startX = radio.sliderX;
world.step(SIM_DT, [null]);
if (Math.abs(radio.sliderX - startX) < 0.001) fail('tuner needle did not move');

let hit = false;
for (let i = 0; i < 300 && !hit; i++) {
  world.step(SIM_DT, [null]);
  if (p.hp < before) hit = true;
}
if (!hit) fail('tuner needle never damaged the body');
if (p.hp !== before - def.slider.damage) fail(`tuner damage was ${before - p.hp}, want ${def.slider.damage}`);
if ((radio.sliderHitPlayers & (1 << p.slot)) === 0) fail('tuner did not mark the body for this pass');

let flipped = false;
for (let i = 0; i < 1200 && !flipped; i++) {
  world.step(SIM_DT, [null]);
  if (radio.sliderDir === -1) flipped = true;
}
if (!flipped) fail('tuner never reversed at the end of its track');
if (radio.sliderHitPlayers !== 0) fail('tuner did not clear its hit mask on reversal');

// The stations advance on their own clock and change the waveform phase.
const dialBefore = radio.dialAngle[0];
world.step(SIM_DT, [null]);
if (radio.dialAngle[0] === dialBefore) fail('dial needle did not animate');
const waveBefore = radio.wavePhase;
world.step(SIM_DT, [null]);
if (radio.wavePhase === waveBefore) fail('station waveform phase did not advance');

radio.station = 0;
radio.stationT = def.stationTime - def.warn * 0.5;
radio.stationWarnT = 0;
world.step(SIM_DT, [null]);
if (!(radio.stationWarnT > 0)) fail('station change had no warning window');
const stationBefore = radio.station;
radio.stationT = def.stationTime - 0.005;
world.step(SIM_DT, [null]);
if (radio.station === stationBefore) fail('station never changed');
if (radio.stationFlashT <= 0) fail('station change had no flash');

console.log('car radio ok: two dials, sweeping tuner, station waveform');
