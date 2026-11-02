import { ARENAS } from '../src/game/arenas';
import { PLAYER, SIM_DT } from '../src/game/config';
import { SRC } from '../src/game/types';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';

if (ARENAS.length !== 28) throw new Error(`expected 28 arenas, got ${ARENAS.length}`);
const arena = ARENAS[27];
if (arena.id !== 27 || arena.name !== 'SMOKE DETECTOR') throw new Error('SMOKE DETECTOR is not arena 27');
const smoke = arena.smoke;
if (!smoke) throw new Error('SMOKE DETECTOR has no alarm layout');
if (!arena.disc || arena.disc.radius <= 0) throw new Error('smoke arena is not round');
if (arena.disc.holes.length !== 0) throw new Error('smoke arena should not have disc holes');
if (smoke.sensors.length !== 4) throw new Error('expected four smoke sensors');
if (smoke.batteryHp < 2) throw new Error('battery needs a multi-hit health pool');
for (let i = 0; i < arena.spawns.length; i++) {
  const spawn = arena.spawns[i];
  const dx = spawn.x - (arena.bounds.left + arena.bounds.right) * 0.5;
  const dy = spawn.y - (arena.bounds.top + arena.bounds.bottom) * 0.5;
  if (Math.hypot(dx, dy) + PLAYER.radius > arena.disc.radius) throw new Error(`spawn ${i} is off the round floor`);
}

const world = new World('training', ['SMOKE DETECTOR'], 0, arena);
world.drone.active = false;
world.drone.respawnT = 1e9;
const player = world.players[0];
const sensor = smoke.sensors[0];
player.x = sensor.x;
player.y = sensor.y;
player.prevX = player.x;
player.prevY = player.y;
player.iframes = 0;
const hp = player.hp;
world.step(SIM_DT, [null]);
if (!world.smokeAlarm) throw new Error('standing on a sensor did not arm the alarm');
if (world.smokeBattery === null || !world.smokeBattery.fixed) throw new Error('battery is not fixed hardware');

player.x = (arena.bounds.left + arena.bounds.right) * 0.5;
player.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
player.prevX = player.x;
player.prevY = player.y;
player.iframes = 0;
let t = 0;
while (t < 2.2 && player.hp === hp) {
  world.step(SIM_DT, [null]);
  t += SIM_DT;
}
if (player.hp !== hp - 1) throw new Error(`expected one alarm wave hit, hp ${player.hp} from ${hp}`);
if (player.killerKind !== SRC.SMOKE) throw new Error(`expected SRC.SMOKE ${SRC.SMOKE}, got ${player.killerKind}`);
const hazardDamage = hp - player.hp;
if (buildSnapshotHazards(world) !== null) throw new Error('smoke state leaked into SnapshotHazards');

const battery = world.smokeBattery;
if (!battery) throw new Error('battery prop missing');
world.smokeAlarm = true;
world.smokeAlarmT = 1;
battery.active = false;
world.step(SIM_DT, [null]);
if (world.smokeAlarm) throw new Error('destroyed battery did not break the alarm');
if (world.smokeWaves.some((wave) => wave.active)) throw new Error('destroyed battery left a live wave');

world.beginRound();
if (world.smokeAlarm || world.smokeAlarmT !== 0) throw new Error('round reset did not clear the alarm');
if (!battery.active || battery.hp !== smoke.batteryHp) throw new Error('round reset did not restore the battery');

console.log(
  JSON.stringify({
    arenas: ARENAS.length,
    smokeId: arena.id,
    sensors: smoke.sensors.length,
    alarmAfterSensor: 1,
    waveHitAt: Number(t.toFixed(2)),
    hazardDamage,
    batteryHp: smoke.batteryHp,
    batteryBreaksAlarm: 1,
    hazards: buildSnapshotHazards(world) === null ? 0 : 1,
  }),
);
