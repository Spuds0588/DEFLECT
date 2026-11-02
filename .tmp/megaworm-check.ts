/** Mega Worm probe: plate damage, chain splits, head promotion, whip and the legs phase. */
import { MEGA_WORM, SIM_DT } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import type { Worm } from '../src/game/types';

const fail = (m: string): never => {
  throw new Error(m);
};

const arena = ARENAS.find((a) => a.id === 22) ?? ARENAS[0];

function freshWorld(): { world: World; priv: any } {
  const world = new World('gauntlet', ['MEGA'], 0, arena);
  const priv = world as any;
  // Clear the seeded floor so the boss math is the only thing under test.
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const s of world.sentries) s.active = false;
  for (const e of world.errors) e.active = false;
  const p = world.players[0];
  p.x = (arena.bounds.left + arena.bounds.right) * 0.5;
  p.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
  p.vx = 0;
  p.vy = 0;
  p.alive = true;
  p.hp = 60;
  p.cloakT = 0;
  p.iframes = 0;
  return { world, priv };
}

const nodeX = (w: Worm, k: number) => (k === 0 ? w.x : w.segX[k - 1]);
const nodeY = (w: Worm, k: number) => (k === 0 ? w.y : w.segY[k - 1]);

// --- spawn and hit routing --------------------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 320, p.y - 60) ?? fail('the boss never spawned');
  if (!boss.mega) fail('the spawned body is not flagged mega');
  const nodes = boss.segCount + 1;
  if (nodes !== MEGA_WORM.segments + 1) fail(`boss started with ${nodes} plates, expected ${MEGA_WORM.segments + 1}`);
  if (!(boss.hp > 60)) fail(`boss health is only ${boss.hp}`);
  if (boss.hitR < 40) fail('the boss is not scaled up');

  const mid = 6;
  const before = boss.segHp[mid];
  priv.damageWorm(boss, 1, 0, 0, 0, 0, nodeX(boss, mid), nodeY(boss, mid));
  if (boss.segHp[mid] !== before - 1) fail('a shell did not land on the plate at the contact point');
  if (boss.segHp[0] !== MEGA_WORM.headHp) fail('a hit on the body damaged the head instead');
  if (boss.segCount + 1 !== nodes) fail('one point of damage broke a plate');

  // --- split through the middle --------------------------------------------
  priv.damageWorm(boss, boss.segHp[mid], 0, 0, 0, 0, nodeX(boss, mid), nodeY(boss, mid));
  const pieces = world.worms.filter((w) => w.active && w.mega) as Worm[];
  if (pieces.length !== 2) fail(`a mid-chain break produced ${pieces.length} bosses instead of 2`);
  const back = pieces.find((w) => w !== boss) ?? fail('the detached half never spawned');
  if (back.segCount + 1 < 2) fail('the detached half is shorter than two plates');
  if (!(back.eyeT > 0)) fail('the detached half never opened eyes on its new head');
  if (boss.segCount + 1 !== mid) fail(`the front half kept ${boss.segCount + 1} plates of ${mid}`);
  if (back.hp < 1 || boss.hp < 1) fail('a split half lost all of its health');

  // --- head loss promotes the next plate -----------------------------------
  const headBefore = boss.segCount;
  const oldX = boss.x;
  const oldY = boss.y;
  priv.damageWorm(boss, boss.segHp[0], 0, 0, 0, 0, boss.x, boss.y);
  if (!boss.active) fail('destroying the head killed the whole boss');
  if (boss.segCount !== headBefore - 1) fail('the head was not replaced by the next plate');
  if (Math.hypot(boss.x - oldX, boss.y - oldY) < 1) fail('the promoted head did not move onto the next plate');
  if (!(boss.eyeT > 0)) fail('the promoted head did not flash its new eyes');
  const stillMega = world.worms.filter((w) => w.active && w.mega).length;
  if (stillMega !== 2) fail(`head promotion changed the boss count to ${stillMega}`);
  console.log(JSON.stringify({ split: { front: boss.segCount + 1, back: back.segCount + 1 }, bossHp: Math.round(boss.hp) }));
}

// --- whip ------------------------------------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 150, p.y) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.whipCd = 0;
  boss.touchCd = 999; // contact damage off: only the swing may hurt the player here
  let started = false;
  for (let i = 0; i < 240 && !started; i++) {
    priv.updateWorm(boss, SIM_DT);
    if (boss.whipT > 0) started = true;
  }
  if (!started) fail('the boss never committed a body whip with a player in range');
  // Stand in the arc the committed swing is about to cross.
  const target = boss.whipA + boss.whipDir * 1.15;
  p.x = boss.whipPivotX + Math.cos(target) * boss.whipR;
  p.y = boss.whipPivotY + Math.sin(target) * boss.whipR;
  p.hp = 40;
  p.iframes = 0;
  const hpBefore = p.hp;
  let hitFrame = -1;
  for (let i = 0; i < 120; i++) {
    priv.updateWorm(boss, SIM_DT);
    if (p.hp < hpBefore) {
      hitFrame = i;
      break;
    }
  }
  if (hitFrame < 0) fail('the body whip crossed the player without hitting');
  const hits = boss.whipHit;
  if (hits === 0) fail('the whip never latched a hit');
  console.log(JSON.stringify({ whip: { damage: hpBefore - p.hp, mask: hits } }));
}

// --- last plate: legs, speed and acid --------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 300, p.y) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.whipCd = 99; // keep the whip out of the way while the chain is chewed down
  let guard = 0;
  while (boss.segCount > 0 && guard++ < 40) {
    const tail = boss.segCount;
    priv.damageWorm(boss, boss.segHp[tail], 0, 0, 0, 0, nodeX(boss, tail), nodeY(boss, tail));
  }
  if (boss.segCount !== 0) fail(`the chain never chewed down to one plate (${boss.segCount} left)`);
  priv.updateWorm(boss, SIM_DT);
  if (!boss.legs) fail('the last plate never grew legs');
  if (boss.hitR < 40) fail('the last plate shrank');
  const px = boss.x;
  const py = boss.y;
  for (let i = 0; i < 4; i++) priv.updateWorm(boss, SIM_DT);
  const moved = Math.hypot(boss.x - px, boss.y - py);
  if (moved < MEGA_WORM.legs.speedMult * MEGA_WORM.speed * SIM_DT * 3) {
    fail(`the legs phase moved only ${moved.toFixed(1)} units in four frames`);
  }
  // Acid: park the player in range, clear the spit clock, then tick.
  p.x = boss.x + 240;
  p.y = boss.y;
  p.hp = 40;
  boss.acidT = 0;
  for (const proj of world.projectiles) proj.active = false;
  priv.updateWorm(boss, SIM_DT);
  priv.updateWorm(boss, SIM_DT);
  const acid = world.projectiles.filter((proj) => proj.active && proj.type === 3 && proj.owner === -1);
  if (acid.length < 2) fail(`the legs phase threw ${acid.length} acid balls instead of a pair`);
  if (acid[0].radius < MEGA_WORM.legs.acidRadius - 1) fail('acid balls are not boss-sized');
  console.log(JSON.stringify({ legs: { speedMult: MEGA_WORM.legs.speedMult, acid: acid.length, moved: Math.round(moved) } }));

  // --- last plate dies ----------------------------------------------------
  const killsBefore = world.gauntletKills;
  priv.damageWorm(boss, boss.segHp[0], 0, 0, 0, 0, boss.x, boss.y);
  if (boss.active) fail('the last plate did not die');
  if (world.gauntletKills <= killsBefore) fail('the boss kill was not credited to the player');
  if (boss.active) fail('the final plate did not die');
}

console.log('megaworm-check: OK');
