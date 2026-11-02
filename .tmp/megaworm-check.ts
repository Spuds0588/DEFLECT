/** Mega Worm probe: one straight body, one health pool, off-map lane staging and contact-only damage. */
import { GAUNTLET, MEGA_WORM, SIM_DT } from '../src/game/config';
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
  if (boss.active) fail('the boss survived its pool reaching zero');
  if (world.gauntletKills <= killsBefore) fail('the boss kill was not credited to the player');
  console.log(JSON.stringify({ sponge: { hp: fullHp, plates: MEGA_WORM.segments, pool: true } }));
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

// --- pass cycle and contact-only damage ------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  const boss: Worm = priv.spawnMegaWorm(p.x + 320, p.y - 60) ?? fail('the boss never spawned');
  boss.spawnT = 0;
  boss.entryT = 0;
  boss.touchCd = 0;
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
  if (!(p.hp < 40)) fail('the pass never touched a player standing on its lane');
  console.log(JSON.stringify({ flight: { sawPass, sawRecover, contactHp: p.hp } }));
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
  if (boss.flyPhase !== 1) fail('the entrance did not hand off into a straight pass');
  if (Math.abs(boss.anchorX - p.x) > 1 || Math.abs(boss.anchorY - p.y) > 1) {
    fail('the first pass did not latch the player it detected');
  }
  console.log(JSON.stringify({ arrival: { cry: true, lane: true, phase: boss.flyPhase } }));
}

console.log('megaworm-check: OK');
