import {
  ARENAS,
  FAX_STATE,
  faxCycle,
  faxHeadX,
  faxPhaseAt,
} from '../src/game/arenas';
import { SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';

if (ARENAS.length !== 26) throw new Error(`expected 26 arenas, got ${ARENAS.length}`);
const arena = ARENAS[25];
if (arena.id !== 25 || arena.name !== 'FAX MACHINE') throw new Error('FAX MACHINE is not arena 25');
const fx = arena.fax;
if (!fx) throw new Error('FAX MACHINE has no print-head layout');
if (fx.documents.length < 3) throw new Error('expected a fax page stack');
if (fx.headW <= 0 || fx.speed <= 0) throw new Error('fax carriage geometry is invalid');

const cycle = faxCycle(fx);
const phases = new Set<number>();
let minX = Infinity;
let maxX = -Infinity;
for (let t = 0; t <= cycle + 0.2; t += 0.01) {
  phases.add(faxPhaseAt(fx, t));
  const x = faxHeadX(fx, t);
  minX = Math.min(minX, x);
  maxX = Math.max(maxX, x);
}
if (phases.size !== 4) throw new Error(`expected all four fax phases, got ${[...phases].join(',')}`);
if (minX < fx.x + fx.headW * 0.5 - 0.1) throw new Error('fax head crossed the left rail');
if (maxX > fx.x + fx.w - fx.headW * 0.5 + 0.1) throw new Error('fax head crossed the right rail');
if (!phases.has(FAX_STATE.printLeft) || !phases.has(FAX_STATE.printRight)) {
  throw new Error('fax head did not make both passes');
}

const world = new World('training', ['FAX'], 0, arena);
world.drone.active = false;
world.drone.respawnT = 1e9;
const player = world.players[0];
player.x = fx.x + fx.w * 0.5;
player.y = fx.y + fx.h * 0.5;
player.prevX = player.x;
player.prevY = player.y;
player.iframes = 0;
const hp = player.hp;
let t = 0;
while (t < 4.2 && player.hp === hp) {
  world.step(SIM_DT, [null]);
  t += SIM_DT;
}
if (player.hp !== hp - 1) throw new Error(`expected one fax hit, hp ${player.hp} from ${hp}`);
if (player.killerKind !== 17) throw new Error(`expected SRC.FAX 17, got ${player.killerKind}`);
const hazardDamage = hp - player.hp;
if (buildSnapshotHazards(world) !== null) throw new Error('fax state leaked into SnapshotHazards');

world.beginRound();
if (world.faxT !== 0 || world.faxPage !== 0) throw new Error('round reset did not rewind the fax');

console.log(
  JSON.stringify({
    arenas: ARENAS.length,
    faxId: arena.id,
    cycle: Number(cycle.toFixed(2)),
    headRange: [Math.round(minX), Math.round(maxX)],
    hitAt: Number(t.toFixed(2)),
    hazardDamage,
    hazards: buildSnapshotHazards(world) === null ? 0 : 1,
  }),
);
