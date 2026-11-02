import { ARENAS, watchHandAngle } from '../src/game/arenas';
import { PLAYER, SIM_DT } from '../src/game/config';
import { SRC } from '../src/game/types';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';

if (ARENAS.length !== 29) throw new Error(`expected 29 arenas, got ${ARENAS.length}`);
const arena = ARENAS[28];
if (arena.id !== 28 || arena.name !== 'SMART WATCH') throw new Error('SMART WATCH is not arena 28');
const watch = arena.watch;
if (!watch) throw new Error('SMART WATCH has no hand layout');
if (arena.pillars.length !== 4) throw new Error('expected four complication cards');
if (watch.handLength <= 0 || watch.handWidth <= 0 || watch.speed <= 0) throw new Error('watch hand geometry is invalid');

const start = watchHandAngle(watch, 0);
if (start !== -Math.PI * 0.5) throw new Error('watch hand did not start at twelve');
const quarter = Math.PI * 0.5 / watch.speed;
if (Math.abs(watchHandAngle(watch, quarter)) > 0.0001) throw new Error('watch hand did not reach three');
for (let i = 0; i < arena.spawns.length; i++) {
  const s = arena.spawns[i];
  if (Math.abs(s.x - (arena.bounds.left + arena.bounds.right) * 0.5) < PLAYER.radius + watch.handWidth) {
    throw new Error(`spawn ${i} starts on the opening hand line`);
  }
  for (let j = 0; j < arena.pillars.length; j++) {
    const r = arena.pillars[j];
    const nx = Math.max(r.x, Math.min(s.x, r.x + r.w));
    const ny = Math.max(r.y, Math.min(s.y, r.y + r.h));
    if (Math.hypot(s.x - nx, s.y - ny) < PLAYER.radius + 1) {
      throw new Error(`spawn ${i} overlaps complication card ${j}`);
    }
  }
}

const world = new World('training', ['SMART WATCH'], 0, arena);
world.drone.active = false;
world.drone.respawnT = 1e9;
const player = world.players[0];
const cx = (arena.bounds.left + arena.bounds.right) * 0.5;
const cy = (arena.bounds.top + arena.bounds.bottom) * 0.5;
player.x = cx + 280;
player.y = cy;
player.prevX = player.x;
player.prevY = player.y;
player.iframes = 0;
const hp = player.hp;
let t = 0;
while (t < 1.1) {
  world.step(SIM_DT, [null]);
  t += SIM_DT;
}
if (player.hp !== hp) throw new Error('watch hand hit before reaching the body');
while (t < 2.1 && player.hp === hp) {
  world.step(SIM_DT, [null]);
  t += SIM_DT;
}
if (player.hp !== hp - 1) throw new Error(`expected one watch hit, hp ${player.hp} from ${hp}`);
if (player.killerKind !== SRC.WATCH) throw new Error(`expected SRC.WATCH ${SRC.WATCH}, got ${player.killerKind}`);
const hitT = t;
const hitHp = player.hp;
for (let j = 0; j < 4; j += SIM_DT) {
  player.x = cx + 280;
  player.y = cy;
  player.prevX = player.x;
  player.prevY = player.y;
  player.iframes = 0;
  world.step(SIM_DT, [null]);
}
if (player.hp !== hitHp) throw new Error('watch hand hit the same body twice in one revolution');
if (buildSnapshotHazards(world) !== null) throw new Error('watch state leaked into SnapshotHazards');

world.beginRound();
if (world.watchT !== 0 || Math.abs(world.watchAngle - start) > 0.0001) throw new Error('round reset did not rewind the hand');

console.log(
  JSON.stringify({
    arenas: ARENAS.length,
    watchId: arena.id,
    cards: arena.pillars.length,
    speed: watch.speed,
    hitAt: Number(hitT.toFixed(2)),
    hazardDamage: hp - hitHp,
    hazards: buildSnapshotHazards(world) === null ? 0 : 1,
  }),
);
