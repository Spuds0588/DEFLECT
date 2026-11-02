/** Temporary hazard diagnostic. Usage: npx tsx .tmp/debug-hazard.ts <arenaId> [programId] */
import { ARENAS } from '../src/game/arenas';
import { SIM_DT } from '../src/game/config';
import { BotBrain } from '../src/game/bot';
import { World } from '../src/game/world';
import type { InputFrame } from '../src/game/types';

const arena = ARENAS[Number(process.argv[2] ?? 7)];
const program = Number(process.argv[3] ?? 0);
const w = new World('gauntlet', ['PILOT'], 0, arena, false, program);
const brain = new BotBrain(0, 'digital', 0, 0x51f15e);
const input: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
let t = 0;
let nextLog = 0;
console.log(`${arena.name} / program ${program}`);
while (t < 20 && !w.gauntletOver) {
  brain.think(w, input, SIM_DT);
  w.step(SIM_DT, [input]);
  t += SIM_DT;
  if (t < nextLog) continue;
  nextLog += 1;
  const p = w.players[0];
  const hazards = {
    pusherY: w.pusherActive ? w.pusherY.toFixed(0) : '-',
    pusherWarn: w.pusherWarnT.toFixed(1),
    emitters: w.emitters.map((e) => `${e.charge.toFixed(1)}/${e.beamDist.toFixed(0)}`).join(','),
    sentries: w.sentries
      .filter((s) => s.active)
      .map((s) => `${s.kind}@${s.x.toFixed(0)},${s.y.toFixed(0)}`)
      .join(' '),
  };
  console.log(
    `${t.toFixed(1).padStart(4)}s p=${p.x.toFixed(0)},${p.y.toFixed(0)} hp=${p.hp} alive=${p.alive} ` +
      `wave=${w.wave} kills=${w.gauntletKills} ${JSON.stringify(hazards)}`,
  );
}
console.log('over', w.gauntletOver, 't', t.toFixed(1), 'hp', w.players[0].hp);
