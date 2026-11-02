import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';

const inputs = [{ mx: 0, my: 0, held: 0, pressed: 0 }];
let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`ok   ${name}${detail ? `  (${detail})` : ''}`);
    return;
  }
  failures++;
  console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
}

function alive(w: World): number {
  let n = 0;
  for (let i = 0; i < w.viruses.length; i++) if (w.viruses[i].active) n++;
  return n;
}

const arena = ARENAS[0];
const w = new World('gauntlet', ['QA'], 0, arena, false, 0, 0, null, false, null, true);
check('infection flag', w.infectionMode);
check('bigger virus pool', w.viruses.length === 44, String(w.viruses.length));
check('opening flood', alive(w) === 24, String(alive(w)));
check('starts at 0%', w.infectionProgress === 0, String(w.infectionProgress));
check('no worms/sentries/errors', w.worms.every((x) => !x.active) && w.sentries.every((x) => !x.active) && w.errors.every((x) => !x.active));
check('friendly fire off by default here', w.friendlyFire === true); // main sets it false; the world default stays on

// Kill one body through the real damage path (the probe reaches the private handler).
(w as unknown as { damageVirus: (v: object, a: number, s: number, dx: number, dy: number) => void }).damageVirus(
  w.viruses[0],
  99,
  0,
  1,
  0,
);
check('kill credited', w.infectionKills === 1, String(w.infectionKills));
check('progress follows kills', Math.abs(w.infectionProgress - 1 / 24) < 1e-6, w.infectionProgress.toFixed(4));

// 4 seconds of play: growth beats and a live clock. The probe holds the player
// invulnerable so this checks the colony, not whether standing still is survivable.
w.players[0].iframes = 999;
for (let i = 0; i < 240; i++) w.step(1 / 60, inputs);
check('colony buds', alive(w) >= 24, String(alive(w)));
check('clock runs', w.gauntletTime > 3.9, w.gauntletTime.toFixed(2));
check('no stray families after 4 s', w.worms.every((x) => !x.active) && w.sentries.every((x) => !x.active) && w.errors.every((x) => !x.active));
check('no pickups (fair time)', w.pickups.every((x) => !x.active));

// Sweep the floor: the run must end at exactly 100% and freeze the clock.
for (let i = 0; i < w.viruses.length; i++) {
  if (w.viruses[i].active) {
    (w as unknown as { damageVirus: (v: object, a: number, s: number, dx: number, dy: number) => void }).damageVirus(
      w.viruses[i],
      99,
      0,
      1,
      0,
    );
  }
}
w.step(1 / 60, inputs);
w.players[0].iframes = 0;
check('clean sweep closes the run', w.infectionCleared && w.infectionOver && w.gauntletOver);
check('meter hits 100%', w.infectionProgress === 1, String(w.infectionProgress));
const frozen = w.gauntletTime;
w.step(1 / 60, inputs);
check('clock frozen after clear', w.gauntletTime === frozen, `${frozen.toFixed(3)} -> ${w.gauntletTime.toFixed(3)}`);

// A death ends the attempt instead of closing it.
const f = new World('gauntlet', ['QA'], 0, arena, false, 0, 0, null, false, null, true);
(f as unknown as { damagePlayer: (p: object, a: number, s: number, dx: number, dy: number, k: number) => void }).damagePlayer(
  f.players[0],
  99,
  -1,
  1,
  0,
  0,
);
f.step(1 / 60, inputs);
check('death fails the run', f.infectionFailed && f.infectionOver && f.gauntletOver);
check('failed run is not a clear', !f.infectionCleared);

// The ordinary gauntlet is untouched: its pool and first wave stay as they were.
const g = new World('gauntlet', ['QA'], 0, arena, false, 0, 0, null, false, null);
check('gauntlet pool unchanged', g.viruses.length === 10, String(g.viruses.length));
check('gauntlet is not infection', !g.infectionMode);

console.log(failures === 0 ? '\nALL INFECTION CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
