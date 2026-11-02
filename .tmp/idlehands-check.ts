/** Idle Hands probe: trio spawn, slam AOE, finger charge, dash redirect, kill credit and ingress. */
import { GAUNTLET, IDLE_HANDS, SIM_DT } from '../src/game/config';
import { MINIBOSS, MINIBOSSES } from '../src/game/minibosses';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import type { Worm } from '../src/game/types';

const fail = (m: string): never => {
  throw new Error(m);
};

const arena = ARENAS.find((a) => a.id === 22) ?? ARENAS[0];

function freshWorld(): { world: World; priv: any } {
  const world = new World('gauntlet', ['HANDS'], 0, arena);
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

const hands = (world: World) =>
  world.worms.filter((w) => w.active && w.bossKind === MINIBOSS.IDLE_HANDS) as Worm[];

// --- registry, trio and body shape ------------------------------------------
{
  const def = MINIBOSSES.find((d) => d.id === MINIBOSS.IDLE_HANDS) ?? fail('Idle Hands is missing from the registry');
  if (def.body !== 'idle-hands') fail('the registry lost the idle-hands body flag');
  if (!GAUNTLET.bossSchedule.some((g) => g.kind === MINIBOSS.IDLE_HANDS)) fail('no gauntlet wave schedules the hands');

  const { world, priv } = freshWorld();
  const p = world.players[0];
  priv.spawnMiniboss(MINIBOSS.IDLE_HANDS, p.x + 300, p.y) ?? fail('the trio never spawned');
  const trio = hands(world);
  if (trio.length !== IDLE_HANDS.hands) fail(`the boss spawned ${trio.length} hands instead of ${IDLE_HANDS.hands}`);
  for (const w of trio) {
    if (!w.hand) fail('a hand body has no hand state');
    if (w.segCount !== 0) fail('a hand carries worm segments');
    if (w.hp !== IDLE_HANDS.hp) fail(`a hand has ${w.hp} hp instead of ${IDLE_HANDS.hp}`);
    if (w.hitR < 30) fail('a hand is too small to read as a palm');
    if (w.mega) fail('a hand is flagged as a segmented worm');
  }
  if (priv.minibossLiveCount(MINIBOSS.IDLE_HANDS) !== IDLE_HANDS.hands) fail('the boss count does not see the trio');
  console.log(JSON.stringify({ trio: trio.length, radius: trio[0].hitR, hp: trio[0].hp }));
}

// --- slam: telegraph, landing and AOE ---------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  priv.spawnMiniboss(MINIBOSS.IDLE_HANDS, p.x + 180, p.y);
  const w = hands(world)[0];
  const h = w.hand ?? fail('no hand state');
  w.spawnT = 0;
  p.x = w.x + 70;
  p.y = w.y;
  p.iframes = 0;
  p.hp = 40;
  h.state = 1;
  h.t = 0;
  h.slamX = p.x;
  h.slamY = p.y;
  const before = p.hp;
  let landed = false;
  for (let i = 0; i < 150 && !landed; i++) {
    priv.updateWorm(w, SIM_DT);
    if (h.state === 3) landed = true;
  }
  if (!landed) fail('the slam never reached its landing frame');
  if (p.hp >= before) fail('a player standing on the telegraph ring took no slam damage');
  if (Math.hypot(w.x - h.slamX, w.y - h.slamY) > 3) fail('the hand did not come down on its own telegraph');
  console.log(JSON.stringify({ slam: { damage: before - p.hp, aoe: IDLE_HANDS.slam.aoe } }));
}

// --- slam misses outside the ring -------------------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  priv.spawnMiniboss(MINIBOSS.IDLE_HANDS, p.x + 180, p.y);
  const w = hands(world)[0];
  const h = w.hand ?? fail('no hand state');
  w.spawnT = 0;
  h.state = 1;
  h.t = 0;
  h.slamX = w.x;
  h.slamY = w.y;
  p.x = w.x + IDLE_HANDS.slam.aoe + 60;
  p.y = w.y;
  p.iframes = 0;
  p.hp = 40;
  const before = p.hp;
  for (let i = 0; i < 150; i++) priv.updateWorm(w, SIM_DT);
  if (p.hp < before) fail('the slam reached a player standing outside the ring');
}

// --- finger charge and the dash redirect -----------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  priv.spawnMiniboss(MINIBOSS.IDLE_HANDS, p.x + 260, p.y);
  const [a, b] = hands(world);
  a.spawnT = 0;
  b.spawnT = 0;
  a.hand!.state = 5;
  a.hand!.t = 0;
  a.hand!.dirX = 1;
  a.hand!.dirY = 0;
  b.x = a.x + 150;
  b.y = a.y;
  p.x = a.x - 260;
  p.y = a.y;
  p.dashT = 0.3;
  p.dashKind = 1;
  p.dashDirX = 1;
  p.dashDirY = 0;
  priv.damageWorm(a, 1, 0, 1, 0, 0);
  if (a.hand!.state !== 6) fail('a dash into a charging hand did not redirect it');
  const hpB = b.hp;
  let collided = false;
  for (let i = 0; i < 60; i++) {
    priv.updateWorm(a, SIM_DT);
    if (a.hand!.state === 7) {
      collided = true;
      break;
    }
  }
  if (!collided) fail('the redirected hand never entered its stun');
  if (b.hand!.state !== 7) fail('the partner hand was not stunned by the redirect');
  if (b.hp >= hpB) fail('the redirected hand never hit its partner');
  if (hpB - b.hp < IDLE_HANDS.charge.deflectDamage) fail('the redirect hit was not big damage');
  const ax = a.x;
  const ay = a.y;
  const bx = b.x;
  const by = b.y;
  for (let i = 0; i < 10; i++) {
    priv.updateWorm(a, SIM_DT);
    priv.updateWorm(b, SIM_DT);
  }
  if (Math.hypot(a.x - ax, a.y - ay) < 1 || Math.hypot(b.x - bx, b.y - by) < 1) {
    fail('stunned hands did not fly apart');
  }
  if (a.hand!.state !== 7 || b.hand!.state !== 7) fail('the stun ended too early');
  if (a.hand!.state === 5) fail('the redirected hand kept charging on its old line');
  console.log(JSON.stringify({ deflect: { toPartner: hpB - b.hp, life: IDLE_HANDS.charge.deflectLife, stun: IDLE_HANDS.charge.stunTime } }));
}

// --- the trio dies and credits the player ----------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  priv.spawnMiniboss(MINIBOSS.IDLE_HANDS, p.x + 260, p.y);
  const killsBefore = world.gauntletKills;
  for (const w of hands(world)) {
    w.spawnT = 0;
    priv.damageWorm(w, 999, 0, 0, 0, 0);
  }
  if (hands(world).length !== 0) fail('a hand survived a lethal hit');
  const credited = world.gauntletKills - killsBefore;
  if (credited !== IDLE_HANDS.hands) fail(`the trio credited ${credited} kills instead of ${IDLE_HANDS.hands}`);
  if (priv.minibossLiveCount(MINIBOSS.IDLE_HANDS) !== 0) fail('the boss count still sees dead hands');
}

// --- hovering hands survive a void-floor cull -------------------------------
{
  const usbArena = ARENAS.find((a) => a.usb) ?? fail('no USB HUB arena to test the floor cull');
  const world = new World('gauntlet', ['HANDS'], 0, usbArena);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  const p = world.players[0];
  p.x = (usbArena.bounds.left + usbArena.bounds.right) * 0.5;
  p.y = (usbArena.bounds.top + usbArena.bounds.bottom) * 0.5;
  p.alive = true;
  priv.spawnMiniboss(MINIBOSS.IDLE_HANDS, p.x + 300, p.y) ?? fail('the trio never spawned on the USB HUB');
  const trio = hands(world);
  if (trio.length !== IDLE_HANDS.hands) fail('the USB HUB trio did not spawn');
  // The hands are floating bodies and hover over the hub's gaps. A corner is
  // definitely off the disc; the void cull must not delete them there.
  for (const w of trio) {
    w.spawnT = 0;
    w.x = usbArena.bounds.left + 10;
    w.y = usbArena.bounds.top + 10;
    w.prevX = w.x;
    w.prevY = w.y;
  }
  priv.cullVoidThreats();
  if (hands(world).length !== IDLE_HANDS.hands) fail('the void floor cull deleted the floating hands');
  console.log(JSON.stringify({ voidCull: { hands: hands(world).length } }));
}

// --- the trio keeps a hover margin and never stacks -------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  priv.spawnMiniboss(MINIBOSS.IDLE_HANDS, p.x + 300, p.y) ?? fail('the trio never spawned for the separation check');
  const trio = hands(world);
  const minPair = (): number => {
    let min = Infinity;
    for (let i = 0; i < trio.length; i++) {
      for (let j = i + 1; j < trio.length; j++) {
        min = Math.min(min, Math.hypot(trio[i].x - trio[j].x, trio[i].y - trio[j].y));
      }
    }
    return min;
  };
  if (minPair() < IDLE_HANDS.separation - 1) fail('the trio spawned inside its separation margin');
  for (const w of trio) {
    w.spawnT = 0;
    if (w.hand) w.hand.cd = 99;
    w.x = p.x;
    w.y = p.y;
  }
  priv.separateIdleHands();
  if (minPair() < IDLE_HANDS.separation - 1) fail('the trio stayed stacked after separation');
  console.log(JSON.stringify({ separation: { min: Math.round(minPair()), target: IDLE_HANDS.separation } }));
}

// --- the trio never targets the player's back -------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  priv.spawnMiniboss(MINIBOSS.IDLE_HANDS, p.x + 300, p.y) ?? fail('the trio never spawned for the hover check');
  for (const w of hands(world)) {
    w.spawnT = 0;
    if (w.hand) w.hand.cd = 99;
  }
  let behind = 0;
  for (let i = 0; i < 600; i++) {
    for (const w of hands(world)) priv.updateWorm(w, SIM_DT);
    for (const w of hands(world)) if (w.y < p.y - 1) behind++;
  }
  if (behind > 0) fail('an idle hand targeted the player\'s back');
  console.log(JSON.stringify({ hover: { behind, hands: hands(world).length } }));
}

// --- the trio arrives through the ordinary ingress family -------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  priv.queueAssault(3, MINIBOSS.IDLE_HANDS, 1);
  let arrived = 0;
  for (let i = 0; i < 1400 && arrived < IDLE_HANDS.hands; i++) {
    priv.updateGauntlet(SIM_DT);
    arrived = hands(world).length;
  }
  if (arrived !== IDLE_HANDS.hands) fail(`the ingress delivered ${arrived} hands instead of ${IDLE_HANDS.hands}`);
  const nearest = hands(world).reduce((m, w) => Math.min(m, Math.hypot(w.x - p.x, w.y - p.y)), Infinity);
  if (nearest < IDLE_HANDS.radius + 40) fail('the trio arrived on top of the player');
  if (nearest > GAUNTLET.assault.playerClear) fail('the trio arrived too far from the player');
  console.log(JSON.stringify({ ingress: { hands: arrived, clear: Math.round(nearest) } }));
}

// --- the palm stays down long enough to punish ------------------------------
{
  const { world, priv } = freshWorld();
  const p = world.players[0];
  priv.spawnMiniboss(MINIBOSS.IDLE_HANDS, p.x + 180, p.y);
  const w = hands(world)[0];
  const h = w.hand ?? fail('no hand state');
  w.spawnT = 0;
  h.state = 1;
  h.t = 0;
  h.slamX = w.x;
  h.slamY = w.y;
  for (let i = 0; i < 200 && h.state !== 3; i++) priv.updateWorm(w, SIM_DT);
  if (h.state !== 3) fail('the slam never landed');
  const x = w.x;
  const y = w.y;
  const hpBefore = w.hp;
  let ticks = 0;
  while (h.state === 3 && ticks < 400) {
    priv.updateWorm(w, SIM_DT);
    ticks++;
  }
  const seconds = ticks * SIM_DT;
  if (seconds < IDLE_HANDS.slam.hold - SIM_DT) fail(`the palm only stayed down ${seconds.toFixed(2)}s`);
  if (Math.hypot(w.x - x, w.y - y) > 3) fail('the grounded palm drifted while it was held down');
  h.state = 3;
  h.t = 0;
  priv.damageWorm(w, 3, 0, 0, 1, 0);
  if (w.hp >= hpBefore) fail('the held palm was not damageable');
  console.log(
    JSON.stringify({ slamHold: { seconds: +seconds.toFixed(2), damageable: hpBefore - w.hp } }),
  );
}

console.log('idlehands-check: OK');
