/** Checks the reflected-shot lifetime and damage-growth rule. Run with `npx tsx .tmp/check-reflect.ts`. */
import { ARENAS } from '../src/game/arenas';
import { BOLT, PLAYER, SIM_DT } from '../src/game/config';
import { PROGRAM_ID } from '../src/game/programs';
import { World } from '../src/game/world';
import type { InputFrame, Player, Projectile } from '../src/game/types';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const arena = ARENAS[0];
const w = new World('training', ['QA'], 0, arena, false, PROGRAM_ID.PROBE);
(w as unknown as { drone: { active: boolean } }).drone.active = false;
const p = w.players[0];
p.active = true;
p.alive = true;
p.facing = 0;
p.lockActive = false;
p.powerupT = 0;
p.guardReach = PLAYER.guardReach;

const priv = w as unknown as {
  resolveGuard(player: Player): void;
  resolveSwing(player: Player): void;
};

function place(overrides: Partial<Projectile> = {}): void {
  const proj = w.projectiles[0];
  proj.active = true;
  proj.owner = 1;
  proj.type = 0;
  proj.x = p.x + 40;
  proj.y = p.y;
  proj.vx = -200;
  proj.vy = 0;
  proj.radius = BOLT.radius;
  proj.damage = BOLT.damage;
  proj.fuse = BOLT.ttl;
  proj.deflects = 0;
  proj.bounces = 0;
  proj.armed = false;
  proj.grace = 0;
  proj.homing = false;
  proj.orbOwner = -1;
  proj.hitPlayers = 0;
  proj.hitWorms = 0;
  proj.hitViruses = 0;
  proj.hitErrors = 0;
  proj.hitSentries = 0;
  Object.assign(proj, overrides);
}

console.log('reflect rule probe');

place();
p.guardT = PLAYER.guardDuration;
priv.resolveGuard(p);
let proj = w.projectiles[0];
check('guard reflects the shot', proj.deflects === 1 && proj.owner === p.slot);
check('first catch adds 1 damage', proj.damage === BOLT.damage + 1, `got ${proj.damage}`);
check('first catch refills the fuse', proj.fuse === BOLT.reflectTtl, `got ${proj.fuse}`);
check(
  'first catch multiplies speed',
  Math.abs(Math.hypot(proj.vx, proj.vy) - 200 * BOLT.deflectMult) < 0.01,
  `got ${Math.hypot(proj.vx, proj.vy).toFixed(1)}`,
);

place({ vx: -280, fuse: BOLT.ttl, deflects: 1, damage: BOLT.damage + 1 });
p.guardT = PLAYER.guardDuration;
priv.resolveGuard(p);
proj = w.projectiles[0];
check('second catch reaches 3 damage', proj.damage === 3, `got ${proj.damage}`);
check('second catch refills the fuse again', proj.fuse === BOLT.reflectTtl, `got ${proj.fuse}`);
check(
  'second catch keeps gaining speed',
  Math.abs(Math.hypot(proj.vx, proj.vy) - 280 * BOLT.deflectMult) < 0.01,
  `got ${Math.hypot(proj.vx, proj.vy).toFixed(1)}`,
);

// A reflected shot must outlive the original bolt TTL (0.45 s) by a wide margin.
// Open floor near the player's spawn. The center of CROSSROADS has cover; a shot
// placed inside a pillar correctly dies on the first step, which is not a TTL failure.
proj.x = p.x + 140;
proj.y = p.y;
proj.vx = 0;
proj.vy = 0;
proj.fuse = BOLT.reflectTtl;
p.guardT = 0;
const idle: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
for (let i = 0; i < 60; i++) w.step(SIM_DT, [idle]);
check(
  'reflected shot survives past the original TTL',
  proj.active && proj.fuse > BOLT.ttl,
  `active ${proj.active}, fuse ${proj.fuse.toFixed(2)}`,
);

place({ x: p.x + 30, vx: -100 });
p.swingHit = false;
p.swingFacing = 0;
p.swingDir = 1;
p.swingKind = 1;
p.swingT = PLAYER.swingActive;
p.program = PROGRAM_ID.PROBE;
p.meleeHalfAngle = PLAYER.swingHalfAngle;
p.meleeReachMult = 1;
p.powerupT = 0;
priv.resolveSwing(p);
proj = w.projectiles[0];
check(
  'lash applies the same +1 and fuse',
  proj.deflects === 1 && proj.damage === BOLT.damage + 1 && proj.fuse === BOLT.reflectTtl,
  `deflects ${proj.deflects}, damage ${proj.damage}, fuse ${proj.fuse}`,
);

place({ type: 8, x: p.x + 40, vx: -200 });
p.guardT = PLAYER.guardDuration;
priv.resolveGuard(p);
proj = w.projectiles[0];
check('bombs are still not reflectable', proj.deflects === 0 && proj.active, `deflects ${proj.deflects}`);

console.log(`\n${pass}/${pass + fail} checks passed`);
if (fail > 0) process.exitCode = 1;
