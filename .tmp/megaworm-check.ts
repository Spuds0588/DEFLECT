/** Mega Worm probe: plate damage, chain splits, head promotion, flyby passes and the legs phase. */
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

// --- spawn and hit routing --------------------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 320, p.y - 60) ?? fail('the boss never spawned');
  if (!boss.mega) fail('the spawned body is not flagged mega');
  if (
    boss.x >= arena.bounds.left &&
    boss.x <= arena.bounds.right &&
    boss.y >= arena.bounds.top &&
    boss.y <= arena.bounds.bottom
  ) {
    fail('the boss spawned inside the arena instead of offscreen');
  }
  if (!(boss.entryT > 0)) fail('the boss skipped its entrance swim');
  const nodes = boss.segCount + 1;
  if (nodes !== MEGA_WORM.segments + 1) fail(`boss started with ${nodes} plates, expected ${MEGA_WORM.segments + 1}`);
  if (!(boss.hp > 60)) fail(`boss health is only ${boss.hp}`);
  if (boss.hitR < MEGA_WORM.headRadius - 1) fail(`the boss head is ${boss.hitR}, expected ${MEGA_WORM.headRadius}`);
  if (Math.abs(boss.segR - MEGA_WORM.segmentRadius) > 1) fail('the boss plates are not the tuned size');
  // The arrival is coiled: the far plates stay within a few spacings of the head, where
  // a straight chain would trail the whole length of the body.
  let far = 0;
  for (let i = 0; i < 8; i++) far = Math.max(far, Math.hypot(nodeX(boss, i) - boss.x, nodeY(boss, i) - boss.y));
  if (far > MEGA_WORM.spacing * 8) fail(`the spawn coil reaches ${Math.round(far)} units from the head`);

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

// --- flight -----------------------------------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 320, p.y - 60) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.flyCd = 0;
  boss.touchCd = 999; // contact off: only the pass's aimed snap may hurt the player
  p.hp = 40;
  p.iframes = 0;
  const startX = boss.x;
  const startY = boss.y;
  let sawPass = false;
  let sawOutside = false;
  let maxPhase = 0;
  let maxDist = 0;
  for (let i = 0; i < 700; i++) {
    priv.updateWorm(boss, SIM_DT);
    if (boss.flyPhase === 1) sawPass = true;
    if (boss.flyPhase > maxPhase) maxPhase = boss.flyPhase;
    maxDist = Math.max(maxDist, Math.hypot(boss.x - startX, boss.y - startY));
    if (
      boss.x < arena.bounds.left ||
      boss.x > arena.bounds.right ||
      boss.y < arena.bounds.top ||
      boss.y > arena.bounds.bottom
    ) {
      sawOutside = true;
    }
  }
  if (!sawPass) fail('the boss never committed to a flyby pass');
  if (maxPhase < 2) fail('the pass never reached its climb-out phase');
  if (!sawOutside) fail('the flyby never left the arena bounds');
  if (maxDist < 300) fail('the boss barely moved during its flight cycle');
  if (!(p.hp < 40)) fail('the pass snap never hit a player on the line');
  console.log(JSON.stringify({ flight: { sawPass, sawOutside, maxPhase, hp: p.hp } }));
}

// --- last plate: legs, speed and acid --------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 300, p.y) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.entryT = 0; // test the legs after the offscreen entrance has handed off
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
  const queued =
    (gated.priv.assaultQueueCount as number) > 0 ||
    gated.world.worms.some((w) => w.active && w.bossKind >= 0);
  if (!queued) fail('the scheduled mini-boss wave never asked for a boss');
  console.log(JSON.stringify({ registry: { bosses: MINIBOSSES.length, gates: GAUNTLET.bossSchedule.length } }));
}

// --- arrival lap, cry and the slow tail sweep -------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x, p.y) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  if (!(boss.entryT > 0)) fail('the boss skipped the entrance lap');
  const outside =
    boss.x < arena.bounds.left ||
    boss.x > arena.bounds.right ||
    boss.y < arena.bounds.top ||
    boss.y > arena.bounds.bottom;
  if (!outside) fail('the boss did not start beyond the arena lip');
  let steps = 0;
  while (boss.entryT > 0 && steps++ < 900) priv.updateWorm(boss, SIM_DT);
  if (boss.entryT > 0) fail('the entrance never finished');
  if (!(boss.roarT > 0)) fail('the arrival never let out its cry');
  if (!(boss.flyCd > MEGA_WORM.whip.minLead)) fail('the first pass was not held after the cry');
  const hold = boss.flyCd;

  // Tail sweep: park a body on the tail tip while the head is circling. Contact is
  // muted so only the committed arc can do the damage under test.
  boss.entryT = 0;
  boss.roarT = 0;
  boss.flyCd = 3;
  boss.whipCd = 0;
  boss.whipT = 0;
  boss.whipHit = 0;
  boss.touchCd = 999;
  const tail = boss.segCount;
  p.x = nodeX(boss, tail);
  p.y = nodeY(boss, tail);
  p.hp = 40;
  p.iframes = 0;
  p.alive = true;
  p.cloakT = 0;
  const sweepTotal = MEGA_WORM.whip.windup + MEGA_WORM.whip.active + MEGA_WORM.whip.recovery;
  let started = false;
  let hit = false;
  for (let i = 0; i < 220; i++) {
    // Once the windup is over, keep the body on the sweeping tail: this is the arc that
    // is supposed to punish standing beside the chain, not the pre-sweep pose.
    if (boss.whipT > 0 && sweepTotal - boss.whipT >= MEGA_WORM.whip.windup) {
      p.x = nodeX(boss, boss.segCount);
      p.y = nodeY(boss, boss.segCount);
    }
    priv.updateWorm(boss, SIM_DT);
    if (boss.whipT > 0) started = true;
    if (p.hp < 40) hit = true;
  }
  if (!started) fail('the tail never swept at a body beside the chain');
  if (!hit) fail('the tail sweep never damaged a body on its arc');
  if (!(boss.whipCd > 3)) fail(`the tail sweep did not take a real cooldown (${boss.whipCd.toFixed(2)})`);
  console.log(
    JSON.stringify({
      arrival: { outside, cry: true, hold: Number(hold.toFixed(2)) },
      tail: { hit, cooldown: Number(boss.whipCd.toFixed(2)), arc: MEGA_WORM.whip.sweepArc },
    }),
  );
}

console.log('megaworm-check: OK');
