import { ARENAS } from '../src/game/arenas';
import { BotBrain } from '../src/game/bot';
import { SIM_DT } from '../src/game/config';
import { PROGRAM_ID } from '../src/game/programs';
import type { InputFrame } from '../src/game/types';
import { World } from '../src/game/world';

function frame(): InputFrame {
  return { mx: 0, my: 0, held: 0, pressed: 0 };
}

const w = new World('gauntlet', ['PROBE'], 0, ARENAS[7], false, PROGRAM_ID.PROBE);
const brain = new BotBrain(0, 'digital', 0, 0x51f15e);
const raw = brain as unknown as { heavyCd: number; heavyHold: number };
const input = frame();
let t = 0;
let last = -1;
while (t < 12 && !w.gauntletOver) {
  brain.think(w, input, SIM_DT);
  w.step(SIM_DT, [input]);
  w.clearEvents();
  const p = w.players[0];
  const tick = Math.floor(t * 4);
  if (tick !== last) {
    last = tick;
    console.log(
      `t=${t.toFixed(2)} pos=${p.x.toFixed(0)},${p.y.toFixed(0)} hp=${p.hp} alive=${p.alive} ` +
        `held=${input.held} charge=${p.laserChargeHeld} heavyHold=${raw.heavyHold.toFixed(2)} ` +
        `arm=${w.pusherActive} warn=${w.pusherWarnT.toFixed(2)} front=${w.pusherY.toFixed(0)}`,
    );
  }
  t += SIM_DT;
}
console.log('end', t.toFixed(2), 'alive', w.players[0].alive, 'over', w.gauntletOver);
