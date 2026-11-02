import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import { NetView, type Snapshot } from '../src/net/net';

const inputs = [
  { mx: 0, my: 0, held: 0, pressed: 0 },
  { mx: 0, my: 0, held: 0, pressed: 0 },
];
let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`ok   ${name}${detail ? `  (${detail})` : ''}`);
    return;
  }
  failures++;
  console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
}

function aliveViruses(w: World): number {
  let n = 0;
  for (let i = 0; i < w.viruses.length; i++) if (w.viruses[i].active) n++;
  return n;
}

type DamagePlayer = (p: object, a: number, s: number, dx: number, dy: number, k: number) => void;

const arena = ARENAS[0];
const w = new World('gauntlet', ['HOST', 'GUEST'], 0, arena, false, 0, 0, null, false, null, true);
check('co-op infection flag', w.infectionMode);
check('guest slot stays on the roster', w.players[1].active && w.players[1].connected, `${w.players[1].active}/${w.players[1].connected}`);
check('both runners spawn alive', w.players[0].alive && w.players[1].alive);
check('opening flood is still 24', aliveViruses(w) === 24, String(aliveViruses(w)));
const seededNear = (slot: number): number =>
  w.viruses.filter((v) => v.active && Math.hypot(v.x - w.players[slot].x, v.y - w.players[slot].y) < 640).length;
check('colony seeded around both runners', seededNear(0) >= 4 && seededNear(1) >= 4, `${seededNear(0)}/${seededNear(1)}`);

// Keep both alive long enough to prove the shared colony does not park on slot 0.
w.players[0].iframes = 999;
w.players[1].iframes = 999;
for (let i = 0; i < 180; i++) w.step(1 / 60, inputs);
check('co-op clock runs', w.gauntletTime > 2.9, w.gauntletTime.toFixed(2));
check('colony buds in co-op', aliveViruses(w) >= 24, String(aliveViruses(w)));
check('run still live', !w.infectionOver && !w.infectionFailed && !w.infectionCleared);

// One death is only one spectator. The squad is still standing.
const hit = (w as unknown as { damagePlayer: DamagePlayer }).damagePlayer.bind(w) as DamagePlayer;
w.players[1].iframes = 0;
hit(w.players[1], 99, -1, 1, 0, 0);
check('downed guest stays on the roster', w.players[1].active && !w.players[1].alive);
check('one death does not fail co-op', !w.infectionFailed && !w.gauntletOver);

// Last runner down ends the attempt.
w.players[0].iframes = 0;
hit(w.players[0], 99, -1, 1, 0, 0);
check('last death fails co-op', w.infectionFailed && w.infectionOver && w.gauntletOver);
check('failed co-op is not a clear', !w.infectionCleared);

// Guest view accepts the host's colony and infection readout.
const view = new NetView(1, arena, true);
const snap = (seq: number, progress: number, over: boolean): Snapshot => ({
  seq,
  phase: 'practice',
  phaseTimer: 0,
  round: 0,
  roundTimer: 0,
  roundWinner: -1,
  matchWinner: -1,
  players: [],
  projectiles: [],
  events: [],
  infection: [progress, 12.4, 7, over ? 1 : 0, 0, over ? 1 : 0],
  viruses: [
    [3, 300, 240, 0.5, 7, 0, 0.1],
    [9, 420, 260, 1.5, 7, 0, 0],
  ],
  // Put both samples behind the interpolation clock so present() selects the newest.
  time: performance.now() / 1000 - 1,
});
view.pushSnapshot(snap(1, 0.35, false));
view.present();
check('view is infection mode', view.infectionMode && view.mode === 'gauntlet');
check('view mirrors clear progress', Math.abs(view.infectionProgress - 0.35) < 1e-6, view.infectionProgress.toFixed(3));
check('view mirrors the clock', Math.abs(view.gauntletTime - 12.4) < 1e-6, view.gauntletTime.toFixed(2));
check('view mirrors kills', view.infectionKills === 7, String(view.infectionKills));
check('view places both viruses', view.viruses[3].active && view.viruses[9].active);
check('view virus position', Math.abs(view.viruses[3].x - 300) < 1e-6, String(view.viruses[3].x));

view.pushSnapshot(snap(2, 1, true));
view.present();
check('view closes the run', view.infectionOver && view.gauntletOver && view.infectionCleared);
view.resetPrediction();
check('rematch clears the colony', view.viruses.every((v) => !v.active));
check('rematch clears the readout', !view.infectionOver && view.infectionProgress === 0 && view.gauntletTime === 0);

console.log(failures === 0 ? '\nALL CO-OP INFECTION CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
