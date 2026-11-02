/** Storm Cloud probe: shape, ceiling band, rain rows, shoot-down, lightning and its reflect. */
import { SIM_DT, STORM_CLOUD } from '../src/game/config';
import { MINIBOSS, MINIBOSSES } from '../src/game/minibosses';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import type { Worm } from '../src/game/types';

const fail = (m: string): never => {
  throw new Error(m);
};
const arena = ARENAS.find((a) => a.id === 22) ?? ARENAS[0];

function fresh(): { world: World; priv: any; storm: Worm } {
  const world = new World('gauntlet', ['STORM'], 0, arena);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const s of world.sentries) s.active = false;
  for (const e of world.errors) e.active = false;
  const p = world.players[0];
  p.x = (arena.bounds.left + arena.bounds.right) * 0.5;
  p.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
  p.alive = true;
  p.hp = p.maxHp = 40;
  p.iframes = 0;
  p.cloakT = 0;
  const storm = priv.spawnMiniboss(MINIBOSS.STORM_CLOUD, p.x, p.y - 300) as Worm;
  if (!storm || !storm.storm) fail('the storm cloud never spawned');
  storm.spawnT = 0;
  return { world, priv, storm };
}

const rainDrops = (world: World) =>
  world.projectiles.filter((q) => q.active && q.owner === -1 && q.type === 18);
const bolts = (world: World) => world.projectiles.filter((q) => q.active && q.owner === -1 && q.type === 19);

// --- registry and shape -----------------------------------------------------
{
  const def = MINIBOSSES.find((d) => d.id === MINIBOSS.STORM_CLOUD) ?? fail('storm cloud missing from the registry');
  if (def.body !== 'storm-cloud') fail('the registry lost the storm-cloud body flag');
  const { world, storm } = fresh();
  if (storm.hp !== STORM_CLOUD.hp || storm.maxHp !== STORM_CLOUD.hp) fail('the cloud has the wrong health pool');
  if (Math.abs(storm.hitR - STORM_CLOUD.radius) > 1) fail(`the cloud spawned at radius ${storm.hitR}`);
  const top = arena.bounds.top;
  if (!(storm.y < top + STORM_CLOUD.hoverTop + STORM_CLOUD.hoverBob + 1)) fail('the cloud did not take the ceiling');
  if (!(world.worms.filter((w) => w.active).length === 1)) fail('the cloud spawned extra bodies');
  console.log(JSON.stringify({ shape: { hp: storm.hp, radius: Math.round(storm.hitR), y: Math.round(storm.y - top) } }));
}

// --- rain rows --------------------------------------------------------------
{
  const { world, priv, storm } = fresh();
  const p = world.players[0];
  p.x = storm.x;
  p.y = storm.y + 240;
  p.cloakT = 0;
  let drops: typeof world.projectiles = [];
  for (let i = 0; i < 300 && drops.length === 0; i++) {
    priv.updateWorm(storm, SIM_DT);
    drops = rainDrops(world);
  }
  if (drops.length < STORM_CLOUD.rain.count) fail(`a rain row laid ${drops.length} drops, expected ${STORM_CLOUD.rain.count}`);
  for (const d of drops) {
    if (d.y < storm.y) fail('a rain drop spawned above the cloud instead of under it');
    if (Math.abs(d.vx) > STORM_CLOUD.rain.speed) fail('a rain drop has no downward bias');
  }
  // A held guard burns through the barrage: each catch costs guard energy and the
  // rows keep coming, so the shield times out rather than the rain.
  p.guardT = 1;
  p.guardMax = 1;
  let caught = 0;
  let spawned = 0;
  const seen = new Set<number>();
  for (let i = 0; i < 240; i++) {
    world.step(SIM_DT, [{ mx: 0, my: 0, held: 0, pressed: 0 }]);
    for (const d of world.projectiles) {
      if (!d.active || d.owner !== -1 || d.type !== 18 || seen.has(d.serial)) continue;
      seen.add(d.serial);
      spawned++;
    }
    for (const d of rainDrops(world)) {
      if (d.y > p.y - 22) {
        d.active = false;
        caught++;
      }
    }
  }
  if (spawned < 18) fail(`four seconds of barrage only laid ${spawned} drops`);
  if (caught < 6) fail(`the barrage only delivered ${caught} drops in four seconds`);
  console.log(JSON.stringify({ rain: { row: drops.length, delivered: caught, cycle: STORM_CLOUD.rain.cycle } }));
}

// --- shoot a drop out of the sky -------------------------------------------
{
  const { world, priv, storm } = fresh();
  for (let i = 0; i < 200 && rainDrops(world).length === 0; i++) priv.updateWorm(storm, SIM_DT);
  const drop = rainDrops(world)[0] ?? fail('no rain drop to shoot');
  const bolt = world.projectiles.find((q) => !q.active) ?? fail('no free projectile slot');
  bolt.active = true;
  bolt.type = 0;
  bolt.owner = 0;
  bolt.radius = 7;
  bolt.x = bolt.prevX = drop.x;
  bolt.y = bolt.prevY = drop.y;
  bolt.vx = 0;
  bolt.vy = 0;
  bolt.fuse = 1;
  bolt.lightning = false;
  priv.projectileHitsGauntlet(bolt);
  if (drop.active) fail('a player bolt passed through a rain drop');
  if (bolt.active) fail('the bolt survived the drop it popped');
  console.log(JSON.stringify({ shootDown: true }));
}

// --- ceiling band and repel ------------------------------------------------
{
  const { world, priv, storm } = fresh();
  const p = world.players[0];
  p.x = storm.x;
  p.y = arena.bounds.top + 120;
  for (let i = 0; i < 600; i++) priv.updateWorm(storm, SIM_DT);
  const band = arena.bounds.top + STORM_CLOUD.hoverTop + STORM_CLOUD.hoverBob;
  if (storm.y > band + 1) fail(`the cloud drifted down to ${Math.round(storm.y - arena.bounds.top)} from the top`);
  if (Math.abs(storm.x - p.x) < STORM_CLOUD.repelRadius * 0.5) fail('the cloud did not slide out from under the player');
  console.log(JSON.stringify({ hover: { y: Math.round(storm.y - arena.bounds.top), band: Math.round(band - arena.bounds.top) } }));
}

// --- lightning and the reflected punish -------------------------------------
{
  const { world, priv, storm } = fresh();
  const p = world.players[0];
  p.x = storm.x;
  p.y = storm.y + 260;
  storm.storm!.boltCd = 0;
  let bolt: (typeof world.projectiles)[number] | null = null;
  for (let i = 0; i < 400 && !bolt; i++) {
    priv.updateWorm(storm, SIM_DT);
    bolt = bolts(world)[0] ?? null;
  }
  if (!bolt) fail('the cloud never threw a bolt');
  if (!bolt.lightning) fail('the bolt did not carry its storm flag');
  if (bolt.damage !== STORM_CLOUD.lightning.damage) fail('the bolt has the wrong player damage');

  // Clear the sky so the return shot cannot be intercepted by rain.
  for (const q of world.projectiles) if (q !== bolt) q.active = false;
  const hpBefore = storm.hp;
  bolt.owner = 0;
  bolt.type = 0;
  bolt.deflects = 1;
  bolt.x = bolt.prevX = storm.x;
  bolt.y = bolt.prevY = storm.y;
  bolt.vx = 0;
  bolt.vy = 0;
  priv.projectileHitsGauntlet(bolt);
  const dealt = hpBefore - storm.hp;
  if (dealt !== STORM_CLOUD.lightning.reflectDamage) fail(`a caught bolt dealt ${dealt}, expected ${STORM_CLOUD.lightning.reflectDamage}`);
  console.log(JSON.stringify({ lightning: { damage: STORM_CLOUD.lightning.damage, reflect: dealt } }));
}

// --- death and kill credit --------------------------------------------------
{
  const { world, priv, storm } = fresh();
  const kills = world.gauntletKills;
  priv.damageWorm(storm, STORM_CLOUD.hp, 0, 0, 1, 0);
  if (storm.active) fail('the cloud survived its whole health pool');
  if (world.gauntletKills <= kills) fail('the cloud kill was not credited');
  if (storm.storm !== null) fail('a dead cloud kept its storm state');
  console.log(JSON.stringify({ death: true }));
}

// --- no arena clamp, and the floor cull leaves the body alone ---------------
{
  const { priv, storm } = fresh();
  const outside = arena.bounds.left - 260;
  storm.x = outside;
  storm.spawnT = 0;
  priv.updateWorm(storm, SIM_DT);
  if (storm.x <= outside) fail('the cloud did not resume tracking after leaving the arena');
  if (storm.x > arena.bounds.left) fail('the cloud was clamped back inside the arena');
  priv.cullVoidThreats();
  if (!storm.active) fail('the off-floor cull deleted the storm cloud');
  console.log(JSON.stringify({ bounds: { x: Math.round(storm.x - arena.bounds.left), alive: storm.active } }));
}

// --- cover blocks the rain and the return fire both ways --------------------
{
  const coverArena = {
    ...arena,
    id: 900,
    name: 'COVER TEST',
    pillars: [{ x: 700, y: 320, w: 180, h: 180 }],
    bounds: { left: 0, top: 0, right: 1600, bottom: 900 },
    spawns: Array.from({ length: 7 }, (_, i) => ({ x: 220 + i * 160, y: 720 })),
  } as typeof arena;
  const world = new World('gauntlet', ['STORM'], 0, coverArena);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const s of world.sentries) s.active = false;
  for (const e of world.errors) e.active = false;
  priv.wormSpawnT = 999;
  priv.virusSpawnT = 999;
  priv.sentrySpawnT = 999;
  priv.errorSpawnT = 999;
  priv.powerupSpawnT = 999;
  const p = world.players[0];
  const block = coverArena.pillars[0];
  const cx = block.x + block.w * 0.5;
  p.x = cx;
  p.y = block.y + block.h + 90;
  p.alive = true;
  p.hp = p.maxHp = 40;
  p.iframes = 0;
  p.cloakT = 0;
  p.guardT = 0;
  const storm = priv.spawnMiniboss(MINIBOSS.STORM_CLOUD, cx, coverArena.bounds.top) as Worm;
  storm.spawnT = 0;
  storm.storm!.rainCd = 0;
  storm.storm!.rowsLeft = 1;
  storm.storm!.rowT = 0;
  storm.storm!.boltCd = 0;
  // Pin the body over the block each tick: the live cloud repels sideways from a body
  // below it, which would walk the rain lane off the roof this test is about.
  const pin = () => {
    storm.x = storm.prevX = cx;
    storm.y = storm.prevY = coverArena.bounds.top + STORM_CLOUD.hoverTop;
  };
  pin();
  priv.updateWorm(storm, SIM_DT);
  if (rainDrops(world).length < STORM_CLOUD.rain.count) fail('the cover row did not lay its drops');
  const hpBefore = storm.hp;
  let leaked = 0;
  for (let i = 0; i < 240; i++) {
    pin();
    world.step(SIM_DT, [{ mx: 0, my: 0, held: 0, pressed: 0 }]);
    for (const d of rainDrops(world)) {
      if (d.x > block.x && d.x < block.x + block.w && d.y > block.y + block.h) leaked++;
    }
    for (const b of bolts(world)) {
      if (b.y > block.y + block.h) leaked++;
    }
  }
  if (leaked > 0) fail(`${leaked} hostile shots fell through cover`);
  if (p.hp !== 40) fail('rain or lightning under cover still damaged the body');
  // The same block hides the cloud from return fire: the shot stops on the roof.
  const shot = world.projectiles.find((q) => !q.active) ?? fail('no free projectile slot');
  shot.active = true;
  shot.type = 0;
  shot.owner = 0;
  shot.radius = 7;
  shot.x = shot.prevX = cx;
  shot.y = shot.prevY = p.y - 20;
  shot.vx = 0;
  shot.vy = -900;
  shot.fuse = 2;
  shot.lightning = false;
  let highest = shot.y;
  for (let i = 0; i < 20; i++) {
    pin();
    world.step(SIM_DT, [{ mx: 0, my: 0, held: 0, pressed: 0 }]);
    highest = Math.min(highest, shot.y);
  }
  if (highest < block.y + block.h - 6) fail('a player shot passed into the block toward the cloud');
  if (storm.hp !== hpBefore) fail('the cloud took damage through cover');
  console.log(JSON.stringify({ cover: { leaked, shielded: p.hp === 40, blockedShot: highest >= block.y + block.h - 6 } }));
}

console.log('storm-check: OK');
