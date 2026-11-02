/** Starfish probe: armor, detach, hatchery, live cap, mouth cycle and the armless phase. */
import { SIM_DT, STARFISH } from '../src/game/config';
import { MINIBOSS, MINIBOSSES } from '../src/game/minibosses';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import type { Worm } from '../src/game/types';

const fail = (m: string): never => {
  throw new Error(m);
};
const arena = ARENAS.find((a) => a.id === 22) ?? ARENAS[0];

function fresh(): { world: World; priv: any; center: Worm } {
  const world = new World('gauntlet', ['STAR'], 0, arena);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const s of world.sentries) s.active = false;
  for (const e of world.errors) e.active = false;
  const p = world.players[0];
  p.x = (arena.bounds.left + arena.bounds.right) * 0.5;
  p.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
  p.alive = true;
  p.hp = p.maxHp = 6;
  p.iframes = 0;
  p.cloakT = 0;
  const center = priv.spawnMiniboss(MINIBOSS.STARFISH, p.x + 300, p.y) as Worm;
  if (!center || !center.starfish) fail('the starfish never spawned');
  center.spawnT = 0;
  for (const w of world.worms) if (w.armState && w.armState.group === center.starfish!.group) w.spawnT = 0;
  return { world, priv, center };
}
const armsOf = (world: World, group: number) =>
  world.worms.filter((w) => w.active && w.armState && w.armState.group === group) as Worm[];
const centers = (world: World) =>
  world.worms.filter((w) => w.active && w.bossKind === MINIBOSS.STARFISH && w.starfish) as Worm[];

// --- registry, shape and armor ---------------------------------------------
{
  const def = MINIBOSSES.find((d) => d.id === MINIBOSS.STARFISH) ?? fail('Starfish missing from the registry');
  if (def.body !== 'starfish') fail('the registry lost the starfish body flag');
  if (!arena) fail('no arena');
  const { world, priv, center } = fresh();
  const arms = armsOf(world, center.starfish!.group);
  if (arms.length !== STARFISH.arms) fail(`the boss spawned ${arms.length} arms instead of ${STARFISH.arms}`);
  if (center.starfish!.armMask !== (1 << STARFISH.arms) - 1) fail('the arm mask does not start full');
  if (priv.minibossLiveCount(MINIBOSS.STARFISH) !== 1) fail('the boss count treats arms as extra bosses');
  const hp0 = center.hp;
  priv.damageWorm(center, 10, 0, 0, 0, 0);
  if (Math.abs(hp0 - center.hp - 1.5) > 1e-6) fail(`an armored center took ${hp0 - center.hp} from 10`);
  console.log(JSON.stringify({ shape: { arms: arms.length, mask: center.starfish!.armMask } }));
}

// --- detach and destroy -----------------------------------------------------
{
  const { world, priv, center } = fresh();
  const arm = armsOf(world, center.starfish!.group)[0];
  arm.spawnT = 0;
  priv.damageWorm(arm, STARFISH.armHp, 0, 1, 0, 0);
  if (!arm.active) fail('the arm died instead of detaching');
  if (arm.armState!.attached) fail('the stripped arm is still attached');
  if (arm.hp !== STARFISH.armDetachedHp) fail(`a detached arm has ${arm.hp} hp instead of ${STARFISH.armDetachedHp}`);
  if (center.starfish!.armCount !== STARFISH.arms - 1) fail('the center did not lose the arm');
  if ((center.starfish!.armMask & 1) !== 0) fail('the center still draws the stripped arm');
  const kills = world.gauntletKills;
  priv.damageWorm(arm, 999, 0, 1, 0, 0);
  if (arm.active) fail('a destroyed arm survived');
  if (world.gauntletKills !== kills + 1) fail('destroying an arm was not credited');
  console.log(JSON.stringify({ detach: { armCount: center.starfish!.armCount, mask: center.starfish!.armMask } }));
}

// --- hatchery and the live cap ---------------------------------------------
{
  const { world, priv, center } = fresh();
  const group = center.starfish!.group;
  const arms = armsOf(world, group);
  priv.damageWorm(arms[0], 999, 0, 1, 0, 0);
  const stripped = armsOf(world, group)[0];
  stripped.spawnT = 0;
  stripped.armState!.hatchT = 0.001;
  priv.updateWorm(stripped, SIM_DT);
  if (centers(world).length !== 2) fail('an undestroyed arm did not hatch a second Starfish');
  if (armsOf(world, centers(world)[1].starfish!.group).length !== STARFISH.arms) fail('the hatched boss has no arms');

  // The cap stops a third center while two are alive.
  const survivor = armsOf(world, group)[0];
  priv.damageWorm(survivor, 999, 0, 1, 0, 0);
  survivor.armState!.hatchT = 0.001;
  priv.updateWorm(survivor, SIM_DT);
  if (centers(world).length !== 2) fail('the hatchery ignored the live boss cap');
  if (survivor.armState!.hatchT <= 0) fail('a capped arm did not keep its timer');
  console.log(JSON.stringify({ hatch: { centers: centers(world).length, cap: STARFISH.maxLive } }));
}

// --- mouth: suck then chomp -------------------------------------------------
{
  const { world, priv, center } = fresh();
  const st = center.starfish!;
  const p = world.players[0];
  priv.damageWorm(armsOf(world, st.group)[0], 999, 0, 1, 0, 0);
  if (st.armCount !== STARFISH.arms - 1) fail('the mouth did not unlock');
  p.x = center.x + 180;
  p.y = center.y;
  p.hp = 5;
  p.iframes = 0;
  st.cd = 0;
  st.state = 0;
  const startX = p.x;
  let chomped = false;
  for (let i = 0; i < 260 && !chomped; i++) {
    priv.updateWorm(center, SIM_DT);
    if (st.state === 2) chomped = true;
  }
  if (!chomped) fail('the mouth never chomped');
  if (p.x >= startX) fail('the suck did not pull the player toward the center');
  if (p.hp >= 5) fail('the chomp did not damage a player inside the maw');
  console.log(JSON.stringify({ mouth: { pulled: Math.round(startX - p.x), damage: 5 - p.hp } }));
}

// --- armless phase: faster spin and a spine ring ---------------------------
{
  const { world, priv, center } = fresh();
  const st = center.starfish!;
  for (const arm of armsOf(world, st.group)) {
    arm.spawnT = 0;
    priv.damageWorm(arm, 999, 0, 1, 0, 0); // strip
    if (arm.active) priv.damageWorm(arm, 999, 0, 1, 0, 0); // destroy
  }
  if (st.armCount !== 0) fail(`the center still counts ${st.armCount} arms`);
  const before = world.projectiles.filter((proj) => proj.active).length;
  st.spineCd = 0;
  priv.updateWorm(center, SIM_DT);
  const after = world.projectiles.filter((proj) => proj.active).length;
  if (after - before < STARFISH.angry.spineCount) fail(`the spin phase fired ${after - before} spines`);
  const spin0 = st.spin;
  for (let i = 0; i < 10; i++) priv.updateWorm(center, SIM_DT);
  if (st.spin <= spin0) fail('the center stopped spinning');
  console.log(JSON.stringify({ angry: { spines: after - before, spin: st.spin > spin0 } }));
}

// --- the center dies and takes its arms with it ----------------------------
{
  const { world, priv, center } = fresh();
  priv.damageWorm(center, 999, 0, 1, 0, 0);
  if (center.active) fail('the center survived a lethal hit');
  if (armsOf(world, center.starfish ? center.starfish.group : -1).length !== 0 && center.starfish) {
    fail('the arms outlived their center');
  }
  console.log(JSON.stringify({ cleared: centers(world).length }));
}

console.log('starfish-check: OK');
