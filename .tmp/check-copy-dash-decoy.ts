import { ARENAS } from '../src/game/arenas';
import { COPYPASTA } from '../src/game/config';
import { PROGRAM_ID } from '../src/game/programs';
import { SRC } from '../src/game/types';
import { World } from '../src/game/world';

const w = new World('gauntlet', ['QA'], 0, ARENAS[0], false, PROGRAM_ID.COPYPASTA) as World & {
  spawnCopyClone: (p: unknown) => boolean;
  tryDash: (p: unknown) => void;
  threatTarget: (x: number, y: number) => unknown;
  damagePlayer: (
    p: unknown,
    amount: number,
    sourceSlot: number,
    dirX: number,
    dirY: number,
    force: number,
    sourceKind?: number,
  ) => void;
};
const input = [{ mx: 0, my: 0, held: 0, pressed: 0 }];
let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`ok   ${name}${detail ? `  (${detail})` : ''}`);
    return;
  }
  failures++;
  console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
}

const p = w.players[0];
p.iframes = 999;
p.x = 500;
p.y = 500;
p.alive = true;
p.dashT = 0;
p.dashCharges = 2;

check('skill copy and dash afterimage use separate bodies',
  (() => {
    const made = w.spawnCopyClone(p);
    w.tryDash(p);
    return made && !!w.players.find((q) => q.active && q.copyDecoy);
  })());

const decoy = w.players.find((q) => q.active && q.copyDecoy)!;
const skillCopy = w.players.find((q) => q.active && q.copyClone && !q.copyDecoy)!;
check('afterimage spawns at the takeoff point', decoy.x === p.x && decoy.y === p.y);
check('afterimage has a short life', decoy.copyT === COPYPASTA.dashDecoyLife, String(decoy.copyT));
check('afterimage has one health', decoy.hp === COPYPASTA.dashDecoyHp && decoy.maxHp === p.maxHp);
check('afterimage is inert', decoy.dashCharges === 0 && decoy.energy === 0);
check('skill copy still owns the reserved slot', skillCopy.slot === 7 && decoy.slot !== 7);

const threat = { x: decoy.x + 4, y: decoy.y };
p.x = 900;
p.y = 900;
const aggro = w.threatTarget(threat.x, threat.y) as { copyDecoy?: boolean };
check('threats target the afterimage', aggro.copyDecoy === true);

const startX = decoy.x;
const startY = decoy.y;
const startSwing = decoy.swingPhase;
w.step(0.25, input);
check('afterimage does not move or attack', decoy.x === startX && decoy.y === startY && decoy.swingPhase === startSwing);

decoy.iframes = 0;
w.damagePlayer(decoy, 1, -1, 1, 0, 0, SRC.SENTRY);
check('one hit removes the afterimage', !decoy.active && !decoy.alive);
check('afterimage death does not score a gauntlet kill', w.gauntletKills === 0, String(w.gauntletKills));

p.dashT = 0;
p.dashCharges = 2;
p.x = 700;
p.y = 500;
w.tryDash(p);
const fading = w.players.find((q) => q.active && q.copyDecoy)!;
check('a second dash leaves a second afterimage', !!fading);
for (let i = 0; i < 100; i++) w.step(1 / 60, input);
check('afterimage expires after its timer', !fading.active, String(fading.copyT));

console.log(failures === 0 ? '\nALL COPY DASH DECOY CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
