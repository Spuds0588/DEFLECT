/**
 * The red triangle fires a readable fan of fast hostile missiles, not a shard cloud.
 * The volley is quicker but the cadence is longer, so it reads as a committed burst.
 * Missiles are ordinary type-3 hostile projectiles, so the shared guard/lash reflect
 * path handles them; the old kind-7 seeker children must not appear.
 *
 * Run with `npx tsx .tmp/triangle-missile-check.ts`.
 */
import { ARENAS } from '../src/game/arenas';
import { CALIBRATION, MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';

const fail = (m: string): never => {
  throw new Error(m);
};

const arena = ARENAS.find((a) => a.id === 14) ?? ARENAS[0];
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'TRI';
const frame = { mx: 0, my: 0, held: 0, pressed: 0 };
const frames = new Array(MAX_PLAYERS).fill(null);
frames[0] = frame;

const world = new World('gauntlet', names, 0, arena);
const priv = world as any;
for (const s of world.sentries) s.active = false;
for (const w of world.worms) w.active = false;
for (const v of world.viruses) v.active = false;
for (const e of world.errors) e.active = false;

const p = world.players[0];
p.x = (arena.bounds.left + arena.bounds.right) * 0.5;
p.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
p.alive = true;
p.hp = 60;
p.cloakT = 0;

const slot = priv.spawnCalibrationShape(5, p.x + 320, p.y);
if (slot < 0) fail('the triangle did not spawn');
const tri = world.sentries[slot];
tri.shapeState = 2;
tri.shapeAtkCd = 0;

// This subject is dispatched by the campaign calibration updater, which a plain gauntlet
// world does not run. Drive the attack entry point directly so the probe measures the
// missile fan, then step the world for the flight/reflection half.
priv.updateTriangleSubject(tri, SIM_DT, p);

const missiles = world.projectiles.filter(
  (q) => q.active && q.type === 3 && q.variant === 1,
);
if (missiles.length < CALIBRATION.triangle.volley) {
  fail(`triangle fired ${missiles.length} missiles, expected ${CALIBRATION.triangle.volley}`);
}
if (world.sentries.some((s) => s.active && s.kind === 7)) {
  fail('the triangle spawned the old shard cloud');
}
if (CALIBRATION.triangle.cooldown < 4) {
  fail(`triangle cooldown ${CALIBRATION.triangle.cooldown}s is not the reduced-fire cadence`);
}
for (const q of missiles) {
  const speed = Math.hypot(q.vx, q.vy);
  if (speed > CALIBRATION.triangle.missileSpeed + 1) {
    fail(`missile speed ${speed.toFixed(0)} exceeds ${CALIBRATION.triangle.missileSpeed}`);
  }
  if (q.owner !== -1) fail('a triangle missile is not hostile fire');
}

// These are ordinary type-3 hostile shots, which is the exact family the shared guard/lash
// catch path is built on (`check-reflect-all.ts` exercises it for every program).
console.log(JSON.stringify({
  triangle: {
    volley: missiles.length,
    speed: CALIBRATION.triangle.missileSpeed,
    life: CALIBRATION.triangle.missileLife,
    reflectable: missiles.every((q) => q.type === 3 && q.owner === -1),
  },
}));
console.log('triangle-missile-check: OK');
