import { ARENAS } from '../src/game/arenas';
import { BotBrain } from '../src/game/bot';
import { SIM_DT } from '../src/game/config';
import { PROGRAM_ID } from '../src/game/programs';
import type { InputFrame, Player } from '../src/game/types';
import { World } from '../src/game/world';

function frame(): InputFrame {
  return { mx: 0, my: 0, held: 0, pressed: 0 };
}

function popcount(n: number): number {
  let total = 0;
  while (n > 0) {
    total += n & 1;
    n >>>= 1;
  }
  return total;
}

function hits(p: Player): number {
  return popcount(p.wedgeHitPlayers) + popcount(p.wedgeHitSentries);
}

interface Result {
  fires: number;
  charge: number[];
  active: number[];
  hits: number;
  seconds: number;
}

function run(seed: number): Result {
  const w = new World('match', ['WEDGE', 'PROBE'], -1, ARENAS[0], false, PROGRAM_ID.WEDGE, 1, [
    PROGRAM_ID.WEDGE,
    PROGRAM_ID.PROBE,
  ]);
  const brains = [new BotBrain(0, 'digital', 0, seed), new BotBrain(1, 'digital', 0, seed ^ 0x9e37)];
  const inputs = [frame(), frame()];
  const result: Result = { fires: 0, charge: [], active: [], hits: 0, seconds: 0 };
  let t = 0;
  let lastHeld = false;
  let lastWedge = 0;
  let chargeStart = 0;
  let activeStart = 0;
  let counted = false;
  while (t < 45 && w.phase !== 'roundover') {
    if (w.phase === 'live') {
      brains[0].think(w, inputs[0], SIM_DT);
      brains[1].think(w, inputs[1], SIM_DT);
    } else {
      inputs[0].pressed = 0;
      inputs[1].pressed = 0;
    }
    w.step(SIM_DT, inputs);
    w.clearEvents();
    const p = w.players[0];
    if (!lastHeld && p.laserChargeHeld) chargeStart = t;
    if (lastWedge <= 0 && p.wedgeT > 0) {
      result.fires++;
      result.charge.push(t - chargeStart);
      activeStart = t;
      counted = false;
    }
    if (lastWedge > 0 && p.wedgeT <= 0 && !counted) {
      result.hits += hits(p);
      result.active.push(t - activeStart);
      counted = true;
    }
    lastHeld = p.laserChargeHeld;
    lastWedge = p.wedgeT;
    t += SIM_DT;
  }
  result.seconds = t;
  return result;
}

let fires = 0;
let hitsTotal = 0;
let seconds = 0;
let charge = 0;
let active = 0;
let samples = 0;
for (let seed = 0; seed < 12; seed++) {
  const r = run(0x51f15e + seed * 7919);
  fires += r.fires;
  hitsTotal += r.hits;
  seconds += r.seconds;
  charge += r.charge.reduce((a, b) => a + b, 0);
  active += r.active.reduce((a, b) => a + b, 0);
  samples += r.charge.length;
}
console.log(
  `MATCH WEDGE: fires=${fires} runs=12 hits=${hitsTotal} avgAlive=${(seconds / 12).toFixed(1)} charge=${(
    charge / Math.max(1, samples)
  ).toFixed(3)} active=${(active / Math.max(1, samples)).toFixed(3)}`,
);
