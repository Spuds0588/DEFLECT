import { ARENAS } from '../src/game/arenas';
import { BotBrain } from '../src/game/bot';
import { SIM_DT, WEDGE } from '../src/game/config';
import { PROGRAM_ID } from '../src/game/programs';
import { ACTION, type InputFrame } from '../src/game/types';
import { World } from '../src/game/world';

const w = new World('gauntlet', ['WEDGE'], 0, ARENAS[1], false, PROGRAM_ID.WEDGE);
w.seedAttractRun(8);
const brain = new BotBrain(0, 'digital', 0, 0x51f15e);
const raw = brain as unknown as { heavyCd: number; heavyHold: number };
const input: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
let t = 0;
let lastProbe = -1;
let lastHeld = false;
let lastWedge = 0;
let trace = 0;
console.log('WEDGE', WEDGE.chargeTime, WEDGE.chargeDuration, WEDGE.chargeCost, WEDGE.chargeCooldown);
while (t < 40 && !w.gauntletOver) {
  brain.think(w, input, SIM_DT);
  w.step(SIM_DT, [input]);
  w.clearEvents();
  const p = w.players[0];
  const started = !lastHeld && p.laserChargeHeld;
  const ended = lastHeld && !p.laserChargeHeld;
  const fired = lastWedge <= 0 && p.wedgeT > 0;
  if (started) {
    trace++;
    console.log(`\nSTART ${trace} t=${t.toFixed(3)} energy=${p.energy.toFixed(1)} hp=${p.hp} held=${input.held}`);
  }
  if (started || (p.laserChargeHeld && trace > 0)) {
    console.log(
      `t=${t.toFixed(2)} charge=${p.laserChargeT.toFixed(2)} held=${p.laserChargeHeld} wedge=${p.wedgeT.toFixed(
        2,
      )} energy=${p.energy.toFixed(1)} cd=${p.laserCd.toFixed(2)} inputHeld=${input.held}`,
    );
  }
  // Private pilot state is still a normal property at runtime; use it to see why the
  // generic heavy branch is never reached in the demo.
  const probeTick = Math.floor(t * 2);
  if (probeTick !== lastProbe && t > 5) {
    lastProbe = probeTick;
    let nearest = Infinity;
    let nx = 0;
    let ny = 0;
    for (const s of w.sentries) {
      if (!s.active) continue;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < nearest) { nearest = d; nx = s.x; ny = s.y; }
    }
    for (const worm of w.worms) {
      if (!worm.active) continue;
      const d = Math.hypot(worm.x - p.x, worm.y - p.y);
      if (d < nearest) { nearest = d; nx = worm.x; ny = worm.y; }
    }
    for (const v of w.viruses) {
      if (!v.active) continue;
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d < nearest) { nearest = d; nx = v.x; ny = v.y; }
    }
    const blocked = nearest < Infinity ? (brain as any).lineBlocked(p, nx, ny, w.arena.pillars) : false;
    console.log(
      `PROBE t=${t.toFixed(1)} heavyCd=${raw.heavyCd.toFixed(2)} heavyHold=${raw.heavyHold.toFixed(
        2,
      )} laserCd=${p.laserCd.toFixed(2)} energy=${p.energy.toFixed(1)} nearest=${nearest.toFixed(
        1,
      )} blocked=${blocked} swing=${p.swingPhase} dash=${p.dashT.toFixed(2)}`,
    );
  }
  if (ended) {
    console.log(
      `END ${trace} t=${t.toFixed(3)} energy=${p.energy.toFixed(1)} wedge=${p.wedgeT.toFixed(2)} hp=${p.hp}`,
    );
  }
  if (fired) console.log(`FIRED t=${t.toFixed(3)} wedge=${p.wedgeT.toFixed(2)} energy=${p.energy.toFixed(1)}`);
  lastHeld = p.laserChargeHeld;
  lastWedge = p.wedgeT;
  t += SIM_DT;
  if (trace >= 2) break;
}
