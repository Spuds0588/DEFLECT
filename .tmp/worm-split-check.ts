/**
 * Standard worm split probe:
 *   1. body nodes have their own pool and do not spend the head pool;
 *   2. a destroyed middle node severs the rear chain into a second worm;
 *   3. the rear tail becomes the new head and the new chain points away from the cut;
 *   4. the split cap stops exponential growth;
 *   5. a head hit still ends that worm.
 *
 * Run with `npx tsx .tmp/worm-split-check.ts`.
 */
import { ARENAS } from '../src/game/arenas';
import { WORM } from '../src/game/config';
import { World } from '../src/game/world';
import type { Projectile, Worm } from '../src/game/types';

const fail = (message: string): never => {
  throw new Error(message);
};

const clearWorld = (world: World): World => {
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const s of world.sentries) s.active = false;
  for (const e of world.errors) e.active = false;
  for (const p of world.projectiles) p.active = false;
  const priv = world as any;
  priv.drone.active = false;
  priv.drone.respawnT = 1e9;
  return world;
};

const straightWorm = (world: World, x = 620, y = 430): Worm => {
  const priv = world as any;
  const w = priv.spawnWorm(x, y) ?? fail('the worm did not spawn');
  w.spawnT = 0;
  w.prevX = w.x;
  w.prevY = w.y;
  for (let i = 0; i < w.segCount; i++) {
    const sx = x - WORM.spacing * (i + 1);
    w.segX[i] = sx;
    w.segY[i] = y;
    w.segPrevX[i] = sx;
    w.segPrevY[i] = y;
    w.segAngle[i] = 0;
    w.segHp[i] = WORM.segmentHp;
    w.segMaxHp[i] = WORM.segmentHp;
  }
  return w;
};

const world = clearWorld(new World('gauntlet', ['QA'], 0, ARENAS[0], false, 0));
const priv = world as any;
const worm = straightWorm(world);
const headHp = worm.hp;
const cut = 3;
const cutX = worm.segX[cut];
const cutY = worm.segY[cut];
const tailX = worm.segX[worm.segCount - 1];
const tailY = worm.segY[worm.segCount - 1];
const nextTailX = worm.segX[worm.segCount - 2];
const nextTailY = worm.segY[worm.segCount - 2];

// A bolt-size body hit spends the node, not the head pool.
priv.damageWorm(worm, 1, 0, 1, 0, 0, cutX, cutY);
if (worm.hp !== headHp) fail(`a body hit spent the head pool: ${headHp} -> ${worm.hp}`);
if (worm.segHp[cut] !== WORM.segmentHp - 1) fail(`body node is at ${worm.segHp[cut]}, want ${WORM.segmentHp - 1}`);
if (world.worms.filter((w) => w.active).length !== 1) fail('a damaged node split before it was destroyed');
if (worm.segCount !== 7) fail(`a chipped node changed the chain length to ${worm.segCount}`);

// The second hit destroys the node and severs the rear.
priv.damageWorm(worm, 1, 0, 1, 0, 0, cutX, cutY);
const live = world.worms.filter((w) => w.active);
if (live.length !== 2) fail(`the cut made ${live.length} worms, want 2`);
if (worm.segCount !== cut) fail(`the head side kept ${worm.segCount} nodes, want ${cut}`);
if (worm.hp !== headHp) fail('severing the chain changed the original head pool');
const child = live.find((w) => w !== worm) ?? fail('the severed rear did not become a worm');
if (child.segCount !== 2) fail(`the new worm has ${child.segCount} body nodes, want 2`);
if (Math.abs(child.x - tailX) > 0.01 || Math.abs(child.y - tailY) > 0.01) {
  fail('the old tail was not promoted to the new head');
}
if (Math.abs(child.angle - Math.PI) > 0.01) fail(`the rear points ${child.angle}, want away from the cut`);
if (!(child.eyeT > 0)) fail('the promoted head did not flash its new eyes');
if (child.hp !== WORM.hp) fail(`the new head has ${child.hp} hp, want ${WORM.hp}`);
if (Math.abs(child.segX[0] - nextTailX) > 0.01 || Math.abs(child.segY[0] - nextTailY) > 0.01) {
  fail('the first body node behind the promoted head is not the old second-to-last node');
}

// A head hit on the new worm ends it; body nodes do not shield the head.
priv.damageWorm(child, WORM.hp, 0, 0, 0, 0, child.x, child.y);
if (child.active) fail('a head hit did not kill the new worm');

// Cap: four standard worms is the ceiling. A fresh cut truncates instead of adding a fifth.
const capped = clearWorld(new World('gauntlet', ['QA'], 0, ARENAS[0], false, 0));
for (let i = 0; i < WORM.splitCap; i++) {
  const w = straightWorm(capped, 300 + i * 120, 280 + (i % 2) * 90);
  w.spawnT = 0;
}
const victim = capped.worms[0];
const beforeCap = capped.worms.filter((w) => w.active).length;
(capped as any).damageWorm(victim, WORM.segmentHp, 0, 0, 0, 0, victim.segX[3], victim.segY[3]);
const afterCap = capped.worms.filter((w) => w.active).length;
if (beforeCap !== WORM.splitCap) fail(`cap setup has ${beforeCap} worms, want ${WORM.splitCap}`);
if (afterCap !== WORM.splitCap) fail(`a cap cut made ${afterCap} worms, want ${WORM.splitCap}`);
if (victim.segCount !== 3) fail(`a capped cut left ${victim.segCount} nodes, want 3`);

// Use the ordinary projectile pass so the test covers the real collision point, not
// just the damage helper.
const shotWorld = clearWorld(new World('gauntlet', ['QA'], 0, ARENAS[0], false, 0));
const shotWorm = straightWorm(shotWorld, 600, 400);
const shot = shotWorld.projectiles[0] as Projectile;
const shoot = (x: number, y: number) => {
  shot.active = true;
  shot.type = 0;
  shot.owner = 0;
  shot.x = x;
  shot.y = y;
  shot.vx = 120;
  shot.vy = 0;
  shot.radius = 6;
  shot.damage = 1;
  shot.hitWorms = 0;
  const handled = (shotWorld as any).projectileHitsGauntlet(shot);
  if (!handled) fail('the projectile pass did not register the body');
};
shoot(shotWorm.segX[2], shotWorm.segY[2]);
shoot(shotWorm.segX[2], shotWorm.segY[2]);
if (shotWorm.segCount !== 2) fail(`projectile cut left ${shotWorm.segCount} nodes, want 2`);
if (shotWorld.worms.filter((w) => w.active).length !== 2) fail('projectile body hit did not split the worm');

console.log(
  JSON.stringify({
    bodyPool: WORM.segmentHp,
    split: { headSide: worm.segCount, rearSide: child.segCount, promotedTail: true },
    cap: { before: beforeCap, after: afterCap },
    projectileCut: true,
  }),
);
console.log('worm-split-check: OK');
