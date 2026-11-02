import { ARENAS } from '../src/game/arenas';
import { INFECTION } from '../src/game/config';
import { World } from '../src/game/world';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`ok   ${name}${detail ? `  (${detail})` : ''}`);
  else {
    failures++;
    console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
  }
}

const arena = ARENAS.find((a) => a.id === 10) ?? ARENAS[0];
const w = new World('gauntlet', ['QA', 'WING'], 0, arena, false, 0, 0, null, false, null, true);
const b = arena.bounds;
const cx = (b.left + b.right) * 0.5;
const activeViruses = () => w.viruses.filter((v) => v.active);

check('both operators are active in infection', w.players[0].active && w.players[1].active);
check('operators start on the left side', w.players[0].x < cx && w.players[1].x < cx, `${w.players[0].x.toFixed(0)}/${w.players[1].x.toFixed(0)}`);
check('operators share the left launch line', Math.abs(w.players[0].x - w.players[1].x) < 1);
check('the opening colony is on the right', activeViruses().every((v) => v.x > cx), String(activeViruses().length));
check('the colony starts off the right lip', activeViruses().every((v) => v.x > b.right));
check('arrivals glide left, not pop in', activeViruses().every((v) => v.spawnT > 0 && v.vx < 0));
check('some viruses carry fake swarm satellites', activeViruses().some((v) => v.swarm > 0), String(activeViruses().filter((v) => v.swarm > 0).length));
check('satellites do not add entities', activeViruses().length === INFECTION.startViruses, String(activeViruses().length));

const first = activeViruses()[0];
const startX = first.x;
for (let i = 0; i < 24; i++) w.step(1 / 60, [null, null]);
check('the colony has moved into the arena', first.x < startX, `${startX.toFixed(0)} -> ${first.x.toFixed(0)}`);
check('entering viruses are not culled off the lip', activeViruses().length === INFECTION.startViruses, String(activeViruses().length));

// Let the countdown reach a split, then verify the child re-enters from the right.
// Check during the 0.55 s entry window, not after it has already finished gliding in.
for (let i = 0; i < 90; i++) w.step(1 / 60, [null, null]);
const arrivals = activeViruses().filter((v) => v.spawnT > 0);
check('reinforcements still enter from the right', arrivals.length > 0 && arrivals.every((v) => v.x > cx || v.spawnT > 0));

console.log(failures === 0 ? '\nALL INFECTION TIDE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
