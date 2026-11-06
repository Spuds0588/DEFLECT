/** Mega Worm probe: one straight body, one health pool, off-map lane staging and contact-only damage. */
import { GAUNTLET, MEGA_WORM, PLAYER, SIM_DT } from '../src/game/config';
import { MINIBOSS, MINIBOSSES } from '../src/game/minibosses';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import type { Worm } from '../src/game/types';

const fail = (m: string): never => {
  throw new Error(m);
};

const arena = ARENAS.find((a) => a.id === 22) ?? ARENAS[0];
const fullHp = MEGA_WORM.headHp + MEGA_WORM.segments * MEGA_WORM.hpPerSegment;

function freshWorld(): { world: World; priv: any } {
  const world = new World('gauntlet', ['MEGA'], 0, arena);
  const priv = world as any;
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

const outsideArena = (x: number, y: number) =>
  x < arena.bounds.left || x > arena.bounds.right || y < arena.bounds.top || y > arena.bounds.bottom;

// --- spawn, one straight body, one health pool ------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 320, p.y - 60) ?? fail('the boss never spawned');
  if (!boss.mega) fail('the spawned body is not flagged mega');
  if (!outsideArena(boss.x, boss.y)) fail('the boss spawned inside the arena instead of offscreen');
  if (!(boss.entryT > 0)) fail('the boss skipped its entrance swim');
  if (boss.segCount !== MEGA_WORM.segments) fail(`boss started with ${boss.segCount} plates, expected ${MEGA_WORM.segments}`);
  if (boss.hp !== fullHp) fail(`boss health is ${boss.hp}, expected one pool of ${fullHp}`);
  if (boss.maxHp !== fullHp) fail('the boss max health is not the single pool');
  if (boss.hitR < MEGA_WORM.headRadius - 1) fail(`the boss head is ${boss.hitR}, expected ${MEGA_WORM.headRadius}`);

  // Rigid straight body: plates sit one spacing behind the last on the heading.
  const dx = Math.cos(boss.angle);
  const dy = Math.sin(boss.angle);
  for (let i = 0; i < boss.segCount; i++) {
    const want = MEGA_WORM.spacing * (i + 1);
    const got = Math.hypot(boss.segX[i] - boss.x, boss.segY[i] - boss.y);
    if (Math.abs(got - want) > 2) fail(`plate ${i} sits ${got.toFixed(1)} from the head, expected ${want}`);
    const cross = (boss.segX[i] - boss.x) * dy - (boss.segY[i] - boss.y) * dx;
    if (Math.abs(cross) > 2) fail(`plate ${i} is off the straight heading by ${cross.toFixed(1)}`);
  }

  // A hit anywhere drains the same pool; the body never loses a plate or promotes a head.
  const headX = boss.x;
  const headY = boss.y;
  priv.damageWorm(boss, 5, 0, 0, 0, 0, boss.segX[5], boss.segY[5]);
  if (boss.hp !== fullHp - 5) fail(`a body hit left ${boss.hp} health, expected ${fullHp - 5}`);
  if (boss.segCount !== MEGA_WORM.segments) fail('a hit changed the plate count');
  if (Math.abs(boss.x - headX) > 0.001 || Math.abs(boss.y - headY) > 0.001) fail('a body hit moved the head');
  priv.damageWorm(boss, 5, 0, 0, 0, 0, boss.x, boss.y);
  if (boss.hp !== fullHp - 10) fail('a head hit did not drain the same pool');
  if (boss.segCount !== MEGA_WORM.segments) fail('a head hit promoted a plate');

  const killsBefore = world.gauntletKills;
  priv.damageWorm(boss, boss.hp, 0, 0, 0, 0, boss.x, boss.y);
  if (!boss.active) fail('the boss vanished on the lethal hit instead of starting its final pass');
  if (boss.megaDeath !== 0) fail(`death state ${boss.megaDeath}, expected the final crossing`);
  if (world.gauntletKills !== killsBefore) fail('the boss kill was credited before the head exploded');

  let sawDeathPass = false;
  let sawHeadSpin = false;
  let maxHeadSpin = 0;
  let maxBursts = 0;
  let deathTicks = 0;
  for (; deathTicks < 3000 && boss.active; deathTicks++) {
    priv.updateMegaWorm(boss, SIM_DT);
    if (boss.megaDeath === 0) sawDeathPass = true;
    maxBursts = Math.max(maxBursts, boss.megaDeathSegs);
    if (boss.megaDeath === 2) {
      sawHeadSpin = true;
      if (boss.megaDeathSegs !== boss.segCount) fail('the head spun before every plate burst');
      maxHeadSpin = Math.max(maxHeadSpin, boss.megaDeathSpin);
    }
  }
  if (boss.active) fail('the boss death animation never finished');
  if (!sawDeathPass) fail('the boss never flew its final crossing');
  if (!sawHeadSpin) fail('the head was not the last part to explode');
  if (maxHeadSpin <= 0) fail('the head did not spin before exploding');
  if (maxBursts !== MEGA_WORM.segments) fail(`only ${maxBursts} plates burst, expected ${MEGA_WORM.segments}`);
  if (world.gauntletKills !== killsBefore + 1) fail('the boss kill was not credited after the head exploded');
  console.log(
    JSON.stringify({
      sponge: { hp: fullHp, plates: MEGA_WORM.segments, pool: true },
      death: { seconds: +(deathTicks * SIM_DT).toFixed(2), bursts: maxBursts, finalPass: sawDeathPass },
    }),
  );
}

// --- straight run, wide turn, no teleport ----------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 320, p.y - 60) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.entryT = 0;
  boss.touchCd = 999; // isolate the geometry of the flight; contact is checked below
  p.hp = 40;

  boss.anchorX = p.x;
  boss.anchorY = p.y;
  priv.beginMegaPass(boss);
  if (boss.flyPhase !== 0) fail('the first run did not start straight');

  let sawRun = false;
  let sawTurn = false;
  let turns = 0;
  let straight = true;
  let maxStep = 0;
  let prevX = boss.x;
  let prevY = boss.y;
  let straightAngle = boss.angle;
  for (let i = 0; i < 1600; i++) {
    const wasTurn = boss.flyPhase === 1;
    priv.updateWorm(boss, SIM_DT);
    // A finished pass is staged by teleporting the head to the next off-map lane. That one
    // jump is the designed reset; every other tick must be continuous flight.
    const staged = wasTurn && boss.flyPhase === 2;
    if (!staged) maxStep = Math.max(maxStep, Math.hypot(boss.x - prevX, boss.y - prevY));
    prevX = boss.x;
    prevY = boss.y;
    if (boss.flyPhase === 0) {
      sawRun = true;
      if (wasTurn) straightAngle = boss.angle;
      else if (Math.abs(boss.angle - straightAngle) > 1e-9) straight = false;
    } else {
      if (!wasTurn) turns++;
      sawTurn = true;
      straightAngle = boss.angle;
    }
  }
  if (!sawRun) fail('the boss never ran straight');
  if (!sawTurn) fail('the boss never turned back over the arena');
  if (turns === 0) fail('the boss never began a turn');
  if (!straight) fail('the heading changed during a straight run');
  const teleportStep = 1400 * SIM_DT;
  if (maxStep > teleportStep) fail(`the boss jumped ${maxStep.toFixed(1)} units in one tick, so it teleported`);
  console.log(JSON.stringify({ flight: { runs: true, turns, straight, maxStep: +maxStep.toFixed(1) } }));
}

// --- jagged side volley: two directions, and a returned shot hurts the boss -----
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x, p.y) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.entryT = 0;
  boss.flyPhase = 0;
  // The first volley waits until the head has entered the arena lip (`flyT > 0.34`).
  // Start the fixture inside that window so this checks the volley, not the gate.
  boss.flyT = 0.4;
  boss.volleyT = 0;
  boss.x = p.x - 420;
  boss.y = p.y;
  boss.angle = 0;
  priv.followMegaChain(boss, 0);
  for (const pr of world.projectiles) pr.active = false;
  priv.updateMegaWorm(boss, SIM_DT);
  const volley = world.projectiles.filter((pr: any) => pr.active && pr.type === 20 && pr.owner === -1);
  if (volley.length !== 2) fail(`the fly-by fired ${volley.length} jagged balls, expected one per side`);
  if (!volley.some((pr: any) => pr.vy < 0) || !volley.some((pr: any) => pr.vy > 0)) {
    fail('the jagged volley did not leave both sides of the body');
  }
  const returned = volley[0];
  returned.owner = 0;
  returned.type = 0;
  returned.x = boss.segX[3];
  returned.y = boss.segY[3];
  returned.vx = 100;
  returned.vy = 0;
  returned.radius = 10;
  returned.damage = 1;
  const hpBefore = boss.hp;
  if (!priv.projectileHitsGauntlet(returned)) fail('a returned jagged ball missed the boss');
  if (boss.hp >= hpBefore) fail('a returned jagged ball did not damage the boss');
  console.log(JSON.stringify({ volley: { count: volley.length, returnedDamage: hpBefore - boss.hp } }));
}

// --- heavy beam stops on the boss, not behind it ----------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x, p.y) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.entryT = 0;
  boss.x = p.x + 500;
  // Keep the long body vertical and beside the player: a horizontal boss at this
  // distance would cover the player with its tail, making the beam start inside it.
  boss.y = p.y - 500;
  boss.angle = -Math.PI / 2;
  priv.followMegaChain(boss, 0);
  p.laserFacing = 0;
  p.laserT = 1;
  p.laserStopDist = 0;
  const hpBefore = boss.hp;
  priv.applyLaserDamage(p);
  if (!(boss.hp < hpBefore)) fail('the heavy beam did not damage the Mega Worm');
  if (!(p.laserStopDist > 0 && p.laserStopDist < PLAYER.laserRange)) {
    fail(`the beam stop distance is ${p.laserStopDist}, expected a boss hit inside its range`);
  }
  if (p.laserStopDist > 500) fail('the heavy beam drew past the Mega Worm body');
  console.log(JSON.stringify({ beamStop: +p.laserStopDist.toFixed(1) }));
}

// --- contact on the run ----------------------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 320, p.y - 60) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.entryT = 0;
  boss.touchCd = 0;
  p.hp = 40;
  p.iframes = 0;
  boss.anchorX = p.x;
  boss.anchorY = p.y;
  priv.beginMegaPass(boss);
  for (let i = 0; i < 240; i++) priv.updateWorm(boss, SIM_DT);
  if (!(p.hp < 40)) fail('the straight run never touched a player on its lane');
  console.log(JSON.stringify({ contact: { hp: p.hp } }));
}

// --- low-health rage: one extra scream, then faster staged passes ----------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 320, p.y - 60) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.entryT = 0;
  priv.beginMegaPass(boss);
  boss.hp = boss.maxHp * MEGA_WORM.flyby.rageAt + 1;
  priv.damageWorm(boss, 2, 0, 0, 0, 0, boss.x, boss.y);
  if (!boss.megaRage) fail('crossing the low-health threshold did not trigger rage');
  if (!(boss.roarT > 0)) fail('the rage turn did not reset the roar timer');
  // Finish a pass and let it stage: the next arrival uses the short rage delay.
  boss.flyPhase = 1;
  boss.flyT = MEGA_WORM.flyby.leaveTime;
  priv.updateWorm(boss, SIM_DT);
  if (boss.flyPhase !== 2) fail('the rage pass did not stage');
  if (Math.abs(boss.spawnT - MEGA_WORM.flyby.rageRepeatDelay) > SIM_DT) {
    fail(`the rage pass spawn delay is ${boss.spawnT}, expected ${MEGA_WORM.flyby.rageRepeatDelay}`);
  }
  console.log(JSON.stringify({ rage: { threshold: MEGA_WORM.flyby.rageAt, spawnT: +boss.spawnT.toFixed(2) } }));
}

// --- mini-boss registry, ingress family and wave gate ----------------------
{
  const def = MINIBOSSES.find((d) => d.id === MINIBOSS.MEGA_WORM) ?? fail('the Mega Worm is missing from the mini-boss registry');
  if (def.body !== 'segmented-worm') fail('the registry lost the segmented-worm body flag');
  if (!GAUNTLET.bossSchedule.some((g) => g.kind === MINIBOSS.MEGA_WORM)) {
    fail('no gauntlet wave gate schedules the Mega Worm');
  }

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
  if (boss.flyPhase !== 0) fail('the entrance did not hand off into a straight run');
  if (Math.abs(boss.anchorX - p.x) > 1 || Math.abs(boss.anchorY - p.y) > 1) {
    fail('the first pass did not latch the player it detected');
  }
  console.log(JSON.stringify({ arrival: { cry: true, lane: true, phase: boss.flyPhase } }));
}

console.log('megaworm-check: OK');
