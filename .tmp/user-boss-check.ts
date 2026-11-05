/**
 * USER finale probe.
 *
 * Verifies the giant 👤 body is registered outside the gauntlet ladder, stages at the
 * top of NETWORK BOARD with the full 330-unit hit circle and 480 HP, and that every
 * attack in its kit puts ordinary hostile projectiles or gauntlet bodies on the floor.
 * Also pins the campaign redistribution so a future edit cannot silently move a mini-boss.
 *
 * Run with `npx tsx .tmp/user-boss-check.ts`.
 */
import { BOSS_RUSH_ORDER, MINIBOSS, MINIBOSSES } from '../src/game/minibosses';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { ARENAS } from '../src/game/arenas';
import { SIM_DT, USER } from '../src/game/config';
import { World } from '../src/game/world';
import type { Worm } from '../src/game/types';

const fail = (message: string): never => {
  throw new Error(message);
};

const arena = ARENAS.find((entry) => entry.id === 39) ?? fail('NETWORK BOARD (arena 39) is missing');

function fresh(): { world: World; priv: any; p: any; user: Worm } {
  const world = new World('gauntlet', ['USER'], 0, arena);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const s of world.sentries) s.active = false;
  for (const e of world.errors) e.active = false;
  const p = world.players[0];
  p.x = (arena.bounds.left + arena.bounds.right) * 0.5;
  p.y = arena.bounds.bottom - 220;
  p.alive = true;
  p.hp = p.maxHp = 99;
  p.iframes = 0;
  p.cloakT = 0;
  const user = priv.spawnMiniboss(MINIBOSS.USER) as Worm | null;
  if (!user || !user.user) fail('USER did not spawn');
  user.spawnT = 0;
  priv.bossIntro = null;
  return { world, priv, p, user };
}

const hostile = (world: World, type: number) =>
  world.projectiles.filter((q) => q.active && q.owner === -1 && q.type === type);

// --- registry ---------------------------------------------------------------
{
  const def = MINIBOSSES.find((entry) => entry.id === MINIBOSS.USER) ?? fail('USER missing from the registry');
  if (def.body !== 'user') fail(`USER body is ${def.body}`);
  if (def.label !== 'USER') fail(`USER label is ${def.label}`);
  if (def.tuning !== USER) fail('USER does not read the USER tuning block');
  if (BOSS_RUSH_ORDER.includes(MINIBOSS.USER)) fail('USER leaked into the gauntlet boss rush');
}

// --- body -------------------------------------------------------------------
{
  const { world, priv, user } = fresh();
  if (!user.active) fail('USER spawned inactive');
  if (user.bossKind !== MINIBOSS.USER) fail('USER has the wrong boss kind');
  if (user.segCount !== 0) fail('USER has body segments');
  if (user.hp !== USER.hp || user.maxHp !== USER.hp) fail(`USER pool is ${user.hp}/${user.maxHp}`);
  if (Math.abs(user.hitR - USER.radius) > 0.01) fail(`USER hit radius is ${user.hitR}`);
  const top = arena.bounds.top;
  if (Math.abs(user.y - (top + USER.hoverY)) > 1) fail(`USER staged at y=${user.y}, expected ${top + USER.hoverY}`);
  if (Math.abs(user.x - (arena.bounds.left + arena.bounds.right) * 0.5) > 1) fail('USER is not centered');
  if (priv.minibossLiveCount(MINIBOSS.USER) !== 1) fail('the boss count does not see USER as one body');
  if (world.worms.filter((w) => w.active).length !== 1) fail('USER spawned extra bodies');
  console.log(JSON.stringify({ body: { hp: user.hp, radius: Math.round(user.hitR), y: Math.round(user.y - top) } }));
}

// --- fists: damage plus a reflectable shockwave ring -------------------------
{
  const { world, priv, p, user } = fresh();
  const hp = p.hp;
  priv.userBeginFists(user, user.user, p);
  for (let i = 0; i < 120; i++) priv.updateWorm(user, SIM_DT);
  const shock = hostile(world, 3);
  if (p.hp >= hp) fail('the fist slam did not damage a body standing on the impact point');
  if (shock.length < USER.hands.shockCount * 2) {
    fail(`the fist slam made ${shock.length} shock bolts, expected ${USER.hands.shockCount * 2}`);
  }
  if (shock.some((q) => q.owner !== -1 || q.damage !== USER.hands.shockDamage)) {
    fail('a shock bolt is not an ordinary hostile projectile');
  }
  console.log(JSON.stringify({ fists: { damage: hp - p.hp, shock: shock.length } }));
}

// --- eyes: two converging fans of type-20 bolts ------------------------------
{
  const { world, priv, p, user } = fresh();
  priv.userBeginEyes(user, user.user, p);
  for (let i = 0; i < 90; i++) priv.updateWorm(user, SIM_DT);
  const bolts = hostile(world, 20);
  if (bolts.length !== USER.eyes.count * 2) {
    fail(`the eye volley made ${bolts.length} bolts, expected ${USER.eyes.count * 2}`);
  }
  if (bolts.some((q) => q.damage !== USER.eyes.damage)) fail('an eye bolt has the wrong damage');
  console.log(JSON.stringify({ eyes: { bolts: bolts.length, speed: Math.round(Math.hypot(bolts[0].vx, bolts[0].vy)) } }));
}

// --- portals: a squad arrives at the rings ----------------------------------
{
  const { world, priv, user } = fresh();
  const sentries = world.sentries.filter((s: any) => s.active).length;
  const viruses = world.viruses.filter((v: any) => v.active).length;
  const worms = world.worms.filter((w: any) => w.active).length;
  priv.userBeginPortals(user, user.user);
  if (user.user.portalCount !== USER.portals.sentries + USER.portals.viruses + USER.portals.worms) {
    fail(`the portal cast laid ${user.user.portalCount} rings`);
  }
  for (let i = 0; i < 90; i++) priv.updateWorm(user, SIM_DT);
  const ds = world.sentries.filter((s: any) => s.active).length - sentries;
  const dv = world.viruses.filter((v: any) => v.active).length - viruses;
  const dw = world.worms.filter((w: any) => w.active).length - worms;
  if (ds + dv + dw < 3) fail(`the portal burst added only ${ds + dv + dw} bodies`);
  console.log(JSON.stringify({ portals: { sentries: ds, viruses: dv, worms: dw } }));
}

// --- fly-over: staged silhouette and two strafing volleys --------------------
{
  const { world, priv, user } = fresh();
  priv.userBeginFlyby(user, user.user);
  for (let i = 0; i < 220; i++) priv.updateWorm(user, SIM_DT);
  if (user.user.state !== 11) fail(`fly-over state is ${user.user.state}`);
  if (user.user.flyX < arena.bounds.left - 500 || user.user.flyX > arena.bounds.right + 500) {
    fail('the fly-over head left its pass');
  }
  const volley = hostile(world, 3);
  if (volley.length < USER.flyby.volley * USER.flyby.volleyCount) {
    fail(`the fly-over fired ${volley.length} bolts, expected ${USER.flyby.volley * USER.flyby.volleyCount}`);
  }
  console.log(JSON.stringify({ flyby: { x: Math.round(user.user.flyX), bolts: volley.length } }));
}

// --- death clears the boss gate ---------------------------------------------
{
  const { world, priv, user } = fresh();
  const kills = world.gauntletKills;
  priv.damageWorm(user, USER.hp + 10, 0, 1, 0);
  if (user.active) fail('USER stayed active after lethal damage');
  if (user.user !== null) fail('USER kept its attack state after death');
  if (priv.minibossLiveCount(MINIBOSS.USER) !== 0) fail('the boss count still sees USER');
  if (world.gauntletKills !== kills + 1) fail('the killing blow did not credit a gauntlet kill');
}

// --- campaign distribution ---------------------------------------------------
{
  const level = (arenaId: number) =>
    PLAYABLE_CAMPAIGN_LEVELS.find((entry) => entry.arenaId === arenaId) ?? fail(`no level on arena ${arenaId}`);
  const expect = [
    [1, MINIBOSS.MEGA_WORM],
    [23, MINIBOSS.BLOB],
    [33, MINIBOSS.STORM_CLOUD],
    [17, MINIBOSS.IDLE_HANDS],
    [24, MINIBOSS.STARFISH],
    [39, MINIBOSS.USER],
  ] as const;
  for (const [arenaId, boss] of expect) {
    const entry = level(arenaId);
    if (entry.boss !== boss) fail(`${entry.name} has boss ${entry.boss}, expected ${boss}`);
  }
  const laptop = level(29);
  if (laptop.boss !== undefined) fail('BUSINESS LAPTOP still authors a mini-boss');
  const finale = level(39);
  if (!finale.finale) fail('NETWORK BOARD is not the finale');
  if (finale.name !== 'NETWORK BOARD') fail(`finale is ${finale.name}`);
  const tetris = level(48);
  if (tetris.finale || tetris.boss !== undefined) fail('TETRIS is still a boss finale');
  if (PLAYABLE_CAMPAIGN_LEVELS.filter((entry) => entry.finale).length !== 1) fail('more than one finale');
  console.log(
    JSON.stringify({
      campaign: expect.map(([arenaId, boss]) => ({
        arena: arenaId,
        boss: MINIBOSSES.find((entry) => entry.id === boss)?.label,
      })),
    }),
  );
}

console.log('user-boss-check: OK (👤 body, fists, eyes, portals, fly-over, death, campaign)');
