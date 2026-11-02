import { ARENAS, satelliteFloorAt, satelliteSolarStateAt, satelliteTelescopeExtensionAt, SATELLITE_SOLAR_STATE } from '../src/game/arenas';
import { World } from '../src/game/world';
import type { InputFrame } from '../src/game/types';

const arena = ARENAS.find((a) => a.name === 'SATELLITE');
if (!arena) throw new Error('SATELLITE missing');
if (arena.id !== 17) throw new Error(`SATELLITE has id ${arena.id}, expected 17`);
const sat = arena.satellite;
if (!sat) throw new Error('SATELLITE has no satellite record');
if (ARENAS.length !== 18) throw new Error(`expected 18 arenas, got ${ARENAS.length}`);

// The floor is the authored union of plates, not the camera bounds.
if (!satelliteFloorAt(arena, 640, 960)) throw new Error('hull is not floor');
if (!satelliteFloorAt(arena, 200, 600)) throw new Error('port wing is not floor');
if (!satelliteFloorAt(arena, 390, 700)) throw new Error('port bridge is not floor');
if (!satelliteFloorAt(arena, 1060, 700)) throw new Error('starboard wing/bridge is not floor');
if (satelliteFloorAt(arena, 410, 600)) throw new Error('space between wing and hull became floor');
if (satelliteFloorAt(arena, 640, 1750)) throw new Error('below the hull became floor');

const zero: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
const world = new World('training', ['SAT'], 0, arena);
const p = world.players[0];
if (!p || !p.alive) throw new Error('training player did not spawn');
world.drone.active = false;
world.drone.respawnT = 1e9;
world.satelliteMeteorT = 1e9;
p.iframes = 0;

// Port wing is hot in the early cycle while starboard is still resting.
if (satelliteSolarStateAt(sat, sat.panels[0], 4) !== SATELLITE_SOLAR_STATE.hot) {
  throw new Error('port wing is not hot at t=4');
}
if (satelliteSolarStateAt(sat, sat.panels[1], 4) !== SATELLITE_SOLAR_STATE.rest) {
  throw new Error('starboard wing should be resting at t=4');
}
p.x = 200;
p.y = 600;
p.hp = p.maxHp;
p.iframes = 0;
world.satelliteT = 4;
const solarHp = p.hp;
world.step(1 / 60, [zero]);
if (p.hp !== solarHp - 1) throw new Error(`solar wing did not damage the player (${solarHp} -> ${p.hp})`);

// The mast uses the same extension curve as the renderer and collision rect.
world.satelliteT = 5.2;
p.x = 640;
p.y = 960;
p.iframes = 0;
world.step(1 / 60, [zero]);
if (satelliteTelescopeExtensionAt(sat.telescope, world.satelliteT) < 0.99) {
  throw new Error('telescope did not reach full extension');
}
if (world.satelliteTelescopeRect.h < 295 || world.satelliteTelescopeRect.x !== sat.telescope.x) {
  throw new Error('telescope collision rect did not follow the mast');
}
world.satelliteT = 13;
world.step(1 / 60, [zero]);
if (world.satelliteTelescopeRect.h > 1) throw new Error('telescope did not retract');

// A shower drops rocks on real floor, and a warning impact removes one segment.
world.satelliteMeteorT = 0.001;
world.step(1 / 60, [zero]);
const meteor = world.satelliteMeteors.find((m) => m.active);
if (!meteor) throw new Error('meteor shower never started');
if (!satelliteFloorAt(arena, meteor.x, meteor.y)) throw new Error('meteor target is off the floor');
p.x = 640;
p.y = 1000;
p.hp = p.maxHp;
p.iframes = 0;
meteor.x = p.x;
meteor.y = p.y;
meteor.t = 0.88;
meteor.hit = false;
const meteorHp = p.hp;
for (let i = 0; i < 3; i++) world.step(1 / 60, [zero]);
if (p.hp !== meteorHp - 1) throw new Error(`meteor did not damage the player (${meteorHp} -> ${p.hp})`);

// Capacitors are mounted: a lash context cannot launch one, but damage still breaks it.
const cap = world.satelliteCapsules[0];
if (!cap) throw new Error('no capacitor props');
const internals = world as unknown as {
  launchProp: (b: typeof cap, nx: number, ny: number, speed: number) => void;
  damageProp: (b: typeof cap, amount: number, x: number, y: number) => void;
};
internals.launchProp(cap, 100, 0, 500);
if (cap.tx !== 0 || cap.ty !== 0) throw new Error('capacitor was launched as debris');
internals.damageProp(cap, cap.hp, cap.x, cap.y);
if (cap.active) throw new Error('capacitor did not break through the prop damage path');

// All three containers destroyed arms the thrusters, then the reentry front.
for (const b of world.satelliteCapsules) b.active = false;
world.satelliteState = 0;
world.step(1 / 60, [zero]);
if (world.satelliteState !== 1) throw new Error('destroyed capacitors did not arm the thrusters');
if (Math.abs(world.satelliteThrusterT - sat.reentry.fuse) > 0.02) throw new Error('thruster fuse is wrong');
world.satelliteThrusterT = 0.01;
world.step(1 / 60, [zero]);
if (world.satelliteState !== 2) throw new Error('thrusters did not start reentry');

// The heat front burns bodies below it and resets the room after the full rise.
p.x = 640;
p.y = 1200;
p.hp = p.maxHp;
p.iframes = 0;
world.satelliteReentryT = 6.9;
world.satelliteBurnTickT = 0;
const heatHp = p.hp;
world.step(1 / 60, [zero]);
if (p.hp !== heatHp - 1) throw new Error(`reentry front did not burn the player (${heatHp} -> ${p.hp})`);
world.satelliteReentryT = 17;
world.step(1 / 60, [zero]);
if (world.satelliteState !== 3) throw new Error('full heat rise did not start the reset cooldown');
world.satelliteResetT = 0.01;
world.step(1 / 60, [zero]);
if (world.satelliteState !== 0) throw new Error('satellite did not reset');
if (world.satelliteCapsules.some((b) => !b.active)) throw new Error('reset did not restore every capacitor');

console.log(
  JSON.stringify({
    arena: arena.name,
    id: arena.id,
    arenas: ARENAS.length,
    solarHp,
    meteorHp,
    heatHp,
    telescope: world.satelliteTelescopeRect.h,
    state: world.satelliteState,
    caps: world.satelliteCapsules.filter((b) => b.active).length,
  }),
);
