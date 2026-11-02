/** Proves guard and lash reflection are shared by every roster program. */
import { ARENAS } from '../src/game/arenas';
import { BOLT, PLAYER } from '../src/game/config';
import { PROGRAMS } from '../src/game/programs';
import { World } from '../src/game/world';
import type { Player, Projectile } from '../src/game/types';

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

function place(w: World, p: Player): Projectile {
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
  return proj;
}

console.log('all-program reflection probe');

for (const def of PROGRAMS) {
  const w = new World('training', ['QA'], 0, ARENAS[0], false, def.id);
  (w as unknown as { drone: { active: boolean } }).drone.active = false;
  const p = w.players[0];
  p.active = true;
  p.alive = true;
  p.facing = 0;
  p.powerupT = 0;
  p.lockActive = false;
  p.guardReach = PLAYER.guardReach;
  p.guardMax = PLAYER.guardDuration;
  p.meleeHalfAngle = PLAYER.swingHalfAngle;
  p.meleeReachMult = 1;
  const priv = w as unknown as {
    resolveGuard(player: Player): void;
    resolveSwing(player: Player): void;
  };

  let proj = place(w, p);
  p.guardT = PLAYER.guardDuration;
  priv.resolveGuard(p);
  check(
    `${def.name} guard reflects`,
    proj.deflects === 1 &&
      proj.owner === p.slot &&
      proj.damage === BOLT.damage + 1 &&
      proj.fuse === BOLT.reflectTtl,
    `deflects ${proj.deflects}, owner ${proj.owner}, damage ${proj.damage}, fuse ${proj.fuse}`,
  );

  proj = place(w, p);
  p.guardT = 0;
  p.swingHit = false;
  p.swingPhase = 2;
  p.swingT = PLAYER.swingActive;
  p.swingFacing = 0;
  p.swingDir = 1;
  p.swingKind = 0;
  p.program = def.id;
  priv.resolveSwing(p);
  check(
    `${def.name} lash reflects`,
    proj.deflects === 1 &&
      proj.owner === p.slot &&
      proj.damage === BOLT.damage + 1 &&
      proj.fuse === BOLT.reflectTtl,
    `deflects ${proj.deflects}, owner ${proj.owner}, damage ${proj.damage}, fuse ${proj.fuse}`,
  );
}

console.log(`\n${pass}/${pass + fail} checks passed`);
if (fail > 0) process.exitCode = 1;
