/** Mega Worm probe: straight body, off-map lane staging, plate damage, head promotion and the legs phase. */
import { GAUNTLET, MEGA_WORM, SIM_DT } from '../src/game/config';
import { MINIBOSS, MINIBOSSES } from '../src/game/minibosses';
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

const outsideArena = (x: number, y: number) =>
  x < arena.bounds.left || x > arena.bounds.right || y < arena.bounds.top || y > arena.bounds.bottom;

// --- spawn, straight body and hit routing -----------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 320, p.y - 60) ?? fail('the boss never spawned');
  if (!boss.mega) fail('the spawned body is not flagged mega');
  if (!outsideArena(boss.x, boss.y)) fail('the boss spawned inside the arena instead of offscreen');
  if (!(boss.entryT > 0)) fail('the boss skipped its entrance swim');
  const nodes = boss.segCount + 1;
  if (nodes !== MEGA_WORM.segments + 1) fail(`boss started with ${nodes} plates, expected ${MEGA_WORM.segments + 1}`);
  if (!(boss.hp > 60)) fail(`boss health is only ${boss.hp}`);
  if (boss.hitR < MEGA_WORM.headRadius - 1) fail(`the boss head is ${boss.hitR}, expected ${MEGA_WORM.headRadius}`);
  if (Math.abs(boss.segR - MEGA_WORM.segmentRadius) > 1) fail('the boss plates are not the tuned size');

  // Rigid straight body: each plate sits one spacing behind the last, on the heading,
  // and none of them bends toward an old trail.
  const dx = Math.cos(boss.angle);
  const dy = Math.sin(boss.angle);
  for (let i = 0; i < boss.segCount; i++) {
    const want = MEGA_WORM.spacing * (i + 1);
    const got = Math.hypot(boss.segX[i] - boss.x, boss.segY[i] - boss.y);
    if (Math.abs(got - want) > 2) fail(`plate ${i} sits ${got.toFixed(1)} from the head, expected ${want}`);
    const cross = (boss.segX[i] - boss.x) * dy - (boss.segY[i] - boss.y) * dx;
    if (Math.abs(cross) > 2) fail(`plate ${i} is off the straight heading by ${cross.toFixed(1)}`);
    if (Math.abs(boss.segAngle[i] - boss.angle) > 0.001) fail(`plate ${i} does not share the head heading`);
  }

  const mid = 6;
  const before = boss.segHp[mid];
  priv.damageWorm(boss, 1, 0, 0, 0, 0, nodeX(boss, mid), nodeY(boss, mid));
  if (boss.segHp[mid] !== before - 1) fail('a shell did not land on the plate at the contact point');
  if (boss.segHp[0] !== MEGA_WORM.headHp) fail('a hit on the body damaged the head instead');
  if (boss.segCount + 1 !== nodes) fail('one point of damage broke a plate');

  // --- a mid-chain cut shortens the body, it never splits ------------------
  const cutHp = boss.segHp[mid];
  priv.damageWorm(boss, cutHp, 0, 0, 0, 0, nodeX(boss, mid), nodeY(boss, mid));
  const pieces = world.worms.filter((w) => w.active && w.mega) as Worm[];
  if (pieces.length !== 1) fail(`a mid-chain break produced ${pieces.length} bosses instead of 1`);
  if (boss.segCount + 1 !== mid) fail(`the cut left ${boss.segCount + 1} plates, expected ${mid}`);
  if (boss.segHp[mid] !== 0) fail('the shredded back half kept its health');
  if (boss.hp !== priv.megaTotalHp(boss)) fail('the total health did not follow the shortened body');

  // --- head loss promotes the next plate ----------------------------------
  const headBefore = boss.segCount;
  const oldX = boss.x;
  const oldY = boss.y;
  priv.damageWorm(boss, boss.segHp[0], 0, 0, 0, 0, boss.x, boss.y);
  if (!boss.active) fail('destroying the head killed the whole boss');
  if (boss.segCount !== headBefore - 1) fail('the head was not replaced by the next plate');
  if (Math.hypot(boss.x - oldX, boss.y - oldY) < 1) fail('the promoted head did not move onto the next plate');
  if (!(boss.eyeT > 0)) fail('the promoted head did not flash its new eyes');
  const stillMega = world.worms.filter((w) => w.active && w.mega).length;
  if (stillMega !== 1) fail(`head promotion changed the boss count to ${stillMega}`);
  console.log(JSON.stringify({ body: { plates: mid, bossHp: Math.round(boss.hp) } }));
}

// --- the lane is latched when the pass is staged ----------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 320, p.y - 60) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.entryT = 0;
  p.hp = 40;

  priv.stageMegaPass(boss, p);
  if (boss.flyPhase !== 0) fail('staging did not hold the boss outside the floor');
  if (!outsideArena(boss.x, boss.y)) fail('the staged boss is not off the map');
  if (Math.abs(boss.anchorX - p.x) > 1 || Math.abs(boss.anchorY - p.y) > 1) {
    fail('the pass did not latch the last detected position');
  }
  const anchoredX = boss.anchorX;
  const anchoredY = boss.anchorY;
  // The player walks away after the warning: this lane must stay on the latched point.
  p.x += 620;
  p.y += 240;
  let sawPass = false;
  let straight = true;
  for (let i = 0; i < 180 && boss.flyPhase !== 2; i++) {
    priv.updateWorm(boss, SIM_DT);
    if (boss.flyPhase === 1) sawPass = true;
    if (Math.abs(boss.anchorX - anchoredX) > 1 || Math.abs(boss.anchorY - anchoredY) > 1) {
      fail('the committed lane followed the player instead of staying latched');
    }
    if (boss.flyPhase === 1) {
      const dx = Math.cos(boss.angle);
      const dy = Math.sin(boss.angle);
      for (let k = 0; k < boss.segCount; k++) {
        const cross = (boss.segX[k] - boss.x) * dy - (boss.segY[k] - boss.y) * dx;
        if (Math.abs(cross) > 2) straight = false;
      }
    }
  }
  if (!sawPass) fail('the boss never committed to a straight pass');
  if (!straight) fail('the body bent off its heading during a pass');
  console.log(JSON.stringify({ lane: { latched: true, straight, sawPass } }));
}

// --- pass cycle and the aimed maw snap --------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 320, p.y - 60) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.entryT = 0;
  boss.touchCd = 999; // contact off: only the pass's aimed snap may hurt the player
  p.hp = 40;
  p.iframes = 0;

  priv.stageMegaPass(boss, p);
  let sawPass = false;
  let sawRecover = false;
  let sawStagedAgain = false;
  let sawOutside = false;
  let maxDist = 0;
  const startX = boss.x;
  const startY = boss.y;
  for (let i = 0; i < 1400; i++) {
    priv.updateWorm(boss, SIM_DT);
    if (boss.flyPhase === 1) sawPass = true;
    if (boss.flyPhase === 2) sawRecover = true;
    if (sawPass && boss.flyPhase === 0) sawStagedAgain = true;
    if (outsideArena(boss.x, boss.y)) sawOutside = true;
    maxDist = Math.max(maxDist, Math.hypot(boss.x - startX, boss.y - startY));
  }
  if (!sawPass) fail('the boss never committed to a straight pass');
  if (!sawRecover) fail('the pass never reached its run-out phase');
  if (!sawStagedAgain) fail('the boss never staged a second lane after a pass');
  if (!sawOutside) fail('the pass never left the arena bounds');
  if (maxDist < 300) fail('the boss barely moved during its pass cycle');
  if (!(p.hp < 40)) fail('the pass snap never hit a player on the latched line');
  console.log(JSON.stringify({ flight: { sawPass, sawRecover, straight: true, hp: p.hp } }));
}

// --- last plate: legs, speed and acid --------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 300, p.y) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.entryT = 0;
  let guard = 0;
  while (boss.segCount > 0 && guard++ < 40) {
    const tail = boss.segCount;
    priv.damageWorm(boss, boss.segHp[tail], 0, 0, 0, 0, nodeX(boss, tail), nodeY(boss, tail));
  }
  if (boss.segCount !== 0) fail(`the body never chewed down to one plate (${boss.segCount} left)`);

  // The last plate fights as a straight runner too; give it a long lane so the pass
  // cannot end inside the measurement.
  boss.flyPhase = 1;
  boss.flyT = 0;
  boss.flyDX = 1;
  boss.flyDY = 0;
  boss.angle = 0;
  boss.anchorX = boss.x + 6000;
  boss.anchorY = boss.y;
  priv.updateWorm(boss, SIM_DT);
  if (!boss.legs) fail('the last plate never grew legs');
  if (boss.hitR < 40) fail('the last plate shrank');
  const px = boss.x;
  const py = boss.y;
  for (let i = 0; i < 4; i++) priv.updateWorm(boss, SIM_DT);
  const moved = Math.hypot(boss.x - px, boss.y - py);
  const legStep = MEGA_WORM.flyby.speed * MEGA_WORM.flyby.legsSpeedMult * SIM_DT * 3;
  if (moved < legStep) fail(`the legs phase moved only ${moved.toFixed(1)} units in four frames`);
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
  console.log(JSON.stringify({ legs: { speedMult: MEGA_WORM.flyby.legsSpeedMult, acid: acid.length, moved: Math.round(moved) } }));

  // --- last plate dies ----------------------------------------------------
  const killsBefore = world.gauntletKills;
  priv.damageWorm(boss, boss.segHp[0], 0, 0, 0, 0, boss.x, boss.y);
  if (boss.active) fail('the last plate did not die');
  if (world.gauntletKills <= killsBefore) fail('the boss kill was not credited to the player');
}

// --- mini-boss registry, ingress family and wave gate ----------------------
{
  const def = MINIBOSSES.find((d) => d.id === MINIBOSS.MEGA_WORM) ?? fail('the Mega Worm is missing from the mini-boss registry');
  if (def.body !== 'segmented-worm') fail('the registry lost the segmented-worm body flag');
  if (!GAUNTLET.bossSchedule.some((g) => g.kind === MINIBOSS.MEGA_WORM)) {
    fail('no gauntlet wave gate schedules the Mega Worm');
  }

  // A boss travels through the same ingress family as any other arrival.
  const { world, priv } = freshWorld();
  const p = world.players[0];
  if (world.worms.some((w) => w.active && w.bossKind >= 0)) fail('a mini-boss was already on the floor');
  priv.queueAssault(3, MINIBOSS.MEGA_WORM, 1);
  let arrived = false;
  for (let i = 0; i < 1200 && !arrived; i++) {
    priv.updateGauntlet(SIM_DT);
    arrived = world.worms.some((w) => w.active && w.bossKind === MINIBOSS.MEGA_WORM);
  }
  if (!arrived) fail('a mini-boss queued through the ingress family never arrived');
  const boss = world.worms.find((w) => w.active && w.bossKind === MINIBOSS.MEGA_WORM);
  if (!boss || !boss.mega) fail('the arrived mini-boss is not a boss body');
  if (Math.hypot(boss.x - p.x, boss.y - p.y) < GAUNTLET.assault.playerClear - 80) {
    fail('the mini-boss arrived on top of the player');
  }

  // The wave gate reads the schedule rather than a constant per boss.
  const gated = freshWorld();
  gated.world.gauntletT = (GAUNTLET.bossSchedule[0].wave - 1) * GAUNTLET.waveDuration + 1;
  for (let i = 0; i < 12; i++) gated.priv.updateGauntlet(SIM_DT);
  const queued = (gated.priv.assaultQueueCount as number) > 0 || gated.world.worms.some((w) => w.active && w.bossKind >= 0);
  if (!queued) fail('the scheduled mini-boss wave never asked for a boss');
  console.log(JSON.stringify({ registry: { bosses: MINIBOSSES.length, gates: GAUNTLET.bossSchedule.length } }));
}

// --- arrival lap, cry and first lane ---------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x, p.y) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  if (!(boss.entryT > 0)) fail('the boss skipped the entrance lap');
  if (!outsideArena(boss.x, boss.y)) fail('the boss did not start beyond the arena lip');
  let steps = 0;
  while (boss.entryT > 0 && steps++ < 900) priv.updateWorm(boss, SIM_DT);
  if (boss.entryT > 0) fail('the entrance never finished');
  if (!(boss.roarT > 0)) fail('the arrival never let out its cry');
  if (boss.flyPhase !== 1) fail('the entrance did not hand off into a straight pass');
  if (Math.abs(boss.anchorX - p.x) > 1 || Math.abs(boss.anchorY - p.y) > 1) {
    fail('the first pass did not latch the player it detected');
  }
  console.log(JSON.stringify({ arrival: { cry: true, lane: true, phase: boss.flyPhase } }));
}

console.log('megaworm-check: OK');
