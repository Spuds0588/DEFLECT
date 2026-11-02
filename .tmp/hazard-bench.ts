import { pack } from 'peerjs-js-binarypack';
import { getArena } from '../src/game/arenas';
import { SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';
const names = ['P1','P2','P3','P4','P5','P6','P7','P8'];
const inputs = new Array(8).fill(null);
const world = new World('match', names, 0, getArena(7));
for (let i=0;i<60*8;i++) world.step(SIM_DT, inputs);
const hazard = buildSnapshotHazards(world)!;
const base = [1, 700, 1, 12, 1, 80, -1, -1, [], [], [], null, []];
const full = [...base, hazard];
// Warm both shapes before timing, then alternate order to keep JIT out of the delta.
for (let i=0;i<2000;i++) { pack(base); pack(full); }
const N = 5000;
let baseTotal = 0, fullTotal = 0;
for (let round=0; round<4; round++) {
  let t0 = performance.now();
  for (let i=0;i<N;i++) pack(base);
  baseTotal += performance.now()-t0;
  t0 = performance.now();
  for (let i=0;i<N;i++) pack(full);
  fullTotal += performance.now()-t0;
}
const baseMs = baseTotal/(N*4), fullMs = fullTotal/(N*4);
let b0 = performance.now();
for (let i=0;i<20000;i++) buildSnapshotHazards(world);
const buildMs = (performance.now()-b0)/20000;
console.log(`pack base ${baseMs.toFixed(4)} ms, full ${fullMs.toFixed(4)} ms, delta ${((fullMs-baseMs)*1000).toFixed(1)} us; build ${buildMs.toFixed(4)} ms; props ${hazard[6].length}`);
