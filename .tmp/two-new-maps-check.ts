import {
  ARENAS,
  arenaIndexById,
  arenaSolids,
  rocketArcAt,
  rocketProgressAt,
  type Rect,
} from '../src/game/arenas';
import { buildSnapshotHazards } from '../src/net/net';
import { World } from '../src/game/world';
import type { InputFrame } from '../src/game/types';

const zero: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };

if (ARENAS.length !== 20) throw new Error(`expected 20 arenas, got ${ARENAS.length}`);
if (arenaIndexById(17) !== 17) throw new Error('SATELLITE moved out of index 17');
if (arenaIndexById(18) !== 18) throw new Error('ROCKET NAVIGATION is not at index 18');
if (arenaIndexById(19) !== 19) throw new Error('WEAPON SYSTEMS is not at index 19');

const rocketArena = ARENAS[18];
if (rocketArena.name !== 'ROCKET NAVIGATION') throw new Error('wrong rocket arena');
if (rocketArena.id !== 18) throw new Error('wrong rocket arena id');
const rocket = rocketArena.rocket;
if (!rocket) throw new Error('rocket arena has no rocket layout');
if (rocket.segments < 64 || rocket.thickness < 16) throw new Error('trajectory wall is too sparse');
if (rocket.stages.length < 2) throw new Error('rocket has no staged separations');

const p = { x: 0, y: 0 };
rocketArcAt(rocket, 0, p);
if (Math.abs(p.x - rocket.launch.x) > 0.01 || Math.abs(p.y - rocket.launch.y) > 0.01) {
  throw new Error('arc does not start at launch');
}
rocketArcAt(rocket, 1, p);
if (Math.abs(p.x - rocket.end.x) > 0.01 || Math.abs(p.y - rocket.end.y) > 0.01) {
  throw new Error('arc does not end at the authored end');
}
if (rocketProgressAt(rocket, rocket.duration * 0.5) !== 0.5) throw new Error('arc progress is wrong');
if (rocketProgressAt(rocket, rocket.duration * 2) !== 1) throw new Error('arc progress is not clamped');

const world = new World('training', ['ROCKET'], 0, rocketArena);
world.drone.active = false;
world.drone.respawnT = 1e9;
const internals = world as unknown as {
  rocketBarrierRects: Rect[];
  solids: readonly Rect[];
};
const staticSolids = arenaSolids(rocketArena).length;
if (internals.solids.length !== staticSolids + rocket.segments) {
  throw new Error('rocket collision blocks are missing from solids');
}
if (internals.rocketBarrierRects.some((r) => r.w > 0)) throw new Error('rocket wall starts live');

for (let i = 0; i < 60 * 6; i++) world.step(1 / 60, [zero]);
if (world.rocketProgress <= 0 || world.rocketProgress >= 1) throw new Error('rocket wall did not grow');
const liveEarly = internals.rocketBarrierRects.filter((r) => r.w > 0).length;
if (liveEarly < 10 || liveEarly > rocket.segments) throw new Error('rocket wall live count is wrong');

for (let i = 0; i < 60 * 20; i++) world.step(1 / 60, [zero]);
if (world.rocketProgress !== 1) throw new Error('rocket wall did not reach the top');
const liveLate = internals.rocketBarrierRects.filter((r) => r.w > 0).length;
if (liveLate !== rocket.segments) throw new Error(`rocket wall incomplete (${liveLate}/${rocket.segments})`);
if (internals.rocketBarrierRects.some((r) => r.w !== rocket.thickness || r.h !== rocket.thickness)) {
  throw new Error('rocket wall blocks do not use the authored thickness');
}

world.beginRound();
if (world.rocketProgress !== 0) throw new Error('round reset did not clear the launch clock');
if (internals.rocketBarrierRects.some((r) => r.w > 0)) throw new Error('round reset did not clear the wall');

const hazards = buildSnapshotHazards(world);
if (hazards !== null) throw new Error('local rocket state leaked into SnapshotHazards');

const weaponArena = ARENAS[19];
if (weaponArena.name !== 'WEAPON SYSTEMS') throw new Error('wrong weapon arena');
const weapon = weaponArena.weapon;
if (!weapon) throw new Error('weapon arena has no weapon layout');
if (weapon.buttons.length !== 3) throw new Error('weapon arena needs three control banks');
const labels = weapon.buttons.map((b) => b.label).join('|');
if (labels !== 'FIRE WEAPONS|EJECTOR SEAT|THRUSTERS') throw new Error(`wrong control banks: ${labels}`);
if (weaponArena.pillars.length < weapon.buttons.length) throw new Error('control banks are not cover');
for (let i = 0; i < weapon.buttons.length; i++) {
  const button = weapon.buttons[i];
  if (weaponArena.pillars[i] !== button) throw new Error('control bank is not the pillar instance');
  if (button.w < 100 || button.h < 80) throw new Error('control bank is too small to read as cover');
}

const weaponWorld = new World('training', ['WEAPON'], 0, weaponArena);
weaponWorld.drone.active = false;
for (let i = 0; i < 120; i++) weaponWorld.step(1 / 60, [zero]);
if (weaponWorld.rocketProgress !== 0) throw new Error('weapon arena ran a rocket clock');

console.log(
  JSON.stringify({
    arenas: ARENAS.length,
    rocketId: rocketArena.id,
    rocketSegments: rocket.segments,
    rocketLiveEarly: liveEarly,
    rocketLiveLate: liveLate,
    rocketHazards: hazards === null ? 0 : hazards.length,
    rocketReset: world.rocketProgress,
    weaponId: weaponArena.id,
    weaponButtons: weapon.buttons.map((b) => b.label),
    weaponPillars: weaponArena.pillars.length,
    weaponSteps: 120,
  }),
);
