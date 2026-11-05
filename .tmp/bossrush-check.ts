/** Boss rush probe: ladder order, no fodder, gaps, clear state and co-op respawns. */
import { BOSS_RUSH, SIM_DT } from '../src/game/config';
import { BOSS_RUSH_ORDER } from '../src/game/minibosses';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import type { Worm } from '../src/game/types';

const fail = (m: string): never => {
  throw new Error(m);
};

const arena = ARENAS.find((a) => a.id === 22) ?? ARENAS[0];
const frame = { mx: 0, my: 0, held: 0, pressed: 0 };

function rush(names: string[] = ['RUSH']): { world: World; priv: any } {
  const world = new World('gauntlet', names, 0, arena, false, 0, 0, null, false, null, false, 'none', 0, true);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const s of world.sentries) s.active = false;
  for (const e of world.errors) e.active = false;
  return { world, priv };
}

function liveBoss(world: World): Worm | null {
  for (const w of world.worms) {
    if (w.active && w.bossKind >= 0 && !w.armState) return w;
  }
  return null;
}

// --- ladder order and clear state -------------------------------------------
{
  const { world, priv } = rush();
  if (!world.bossRush) fail('the world is not in boss-rush mode');
  if (world.bossRushTotal !== BOSS_RUSH_ORDER.length) fail('the ladder does not cover every staged mini-boss');
  const seen: number[] = [];
  for (let i = 0; i < 600 && !liveBoss(world); i++) priv.updateBossRush(SIM_DT);
  if (!liveBoss(world)) fail('the first boss never arrived');
  let guard = 0;
  while (!world.bossRushCleared && guard < 40) {
    guard++;
    const live = liveBoss(world);
    if (!live) {
      for (let i = 0; i < 600 && !liveBoss(world) && !world.bossRushCleared; i++) priv.updateBossRush(SIM_DT);
      continue;
    }
    seen.push(live.bossKind);
    // Retire the whole kind at once. A segmented body can leave parts that keep the
    // kind live for a few more frames, which is the gauntlet's business, not the
    // ladder's: the ladder only advances when the kind is fully gone.
    for (const w of world.worms) {
      if (w.active && w.bossKind === live.bossKind) w.active = false;
    }
    for (let i = 0; i < 600 && !liveBoss(world) && !world.bossRushCleared; i++) priv.updateBossRush(SIM_DT);
  }
  if (seen.length !== BOSS_RUSH_ORDER.length) fail(`the ladder ran ${seen.length} bosses (${seen.join(',')}), not ${BOSS_RUSH_ORDER.length}`);
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] !== BOSS_RUSH_ORDER[i]) fail(`boss ${i} was kind ${seen[i]}, expected ${BOSS_RUSH_ORDER[i]}`);
  }
  if (!world.bossRushCleared) fail('clearing the last boss did not clear the ladder');
  if (!world.gauntletOver) fail('a cleared ladder did not freeze the arena');
  if (world.bossRushStage !== BOSS_RUSH_ORDER.length) fail('the stage readout ran past the ladder');
  console.log(JSON.stringify({ ladder: { bosses: seen.length, order: seen, firstDelay: BOSS_RUSH.firstDelay, gap: BOSS_RUSH.gap } }));
}

// --- no fodder, ever ---------------------------------------------------------
{
  const { world, priv } = rush();
  for (let i = 0; i < 360; i++) priv.updateGauntlet(SIM_DT);
  let fodder = 0;
  for (const w of world.worms) if (w.active && w.bossKind < 0) fodder++;
  for (const v of world.viruses) if (v.active) fodder++;
  for (const s of world.sentries) if (s.active) fodder++;
  for (const e of world.errors) if (e.active) fodder++;
  for (const f of world.firewalls) if (f.active) fodder++;
  if (fodder > 0) fail(`boss rush spawned ${fodder} fodder bodies in six seconds`);
  if (!liveBoss(world)) fail('six seconds in, no boss had arrived');
  console.log(JSON.stringify({ fodder: 0, boss: liveBoss(world)?.bossKind }));
}

// --- one gap between bosses, not a spawn trickle ----------------------------
{
  const { world, priv } = rush();
  for (let i = 0; i < 600 && !liveBoss(world); i++) priv.updateBossRush(SIM_DT);
  const live = liveBoss(world) ?? fail('the first boss never arrived');
  for (const w of world.worms) {
    if (w.active && w.bossKind === live.bossKind) w.active = false;
  }
  let ticks = 0;
  while (!liveBoss(world) && ticks < 900) {
    priv.updateBossRush(SIM_DT);
    ticks++;
  }
  const gap = ticks * SIM_DT;
  if (!liveBoss(world)) fail('the second boss never arrived');
  if (gap < BOSS_RUSH.gap - SIM_DT) fail(`the next boss arrived after ${gap.toFixed(2)}s, short of the ${BOSS_RUSH.gap}s gap`);
  console.log(JSON.stringify({ gap: +gap.toFixed(2) }));
}

// --- local co-op: both seats, respawn instead of a lost run -----------------
{
  const { world, priv } = rush(['ALPHA', 'BETA']);
  if (!world.players[0].active || !world.players[1].active) fail('boss rush did not seat the second local player');
  const a = world.players[0];
  const b = world.players[1];
  if (Math.hypot(a.x - b.x, a.y - b.y) < 40) fail('co-op players spawned on top of each other');
  a.hp = 1;
  a.iframes = 0;
  priv.damagePlayer(a, 1, -1, 0, 1, 0, 0, -1);
  if (world.gauntletOver) fail('a boss-rush death ended the run instead of putting the body on respawn');
  if (!(a.respawnT > 0)) fail('the dead co-op body never entered its respawn timer');
  if (!b.alive) fail('the other co-op player was killed with the respawn');
  console.log(JSON.stringify({ coop: { players: 2, respawn: +a.respawnT.toFixed(2), runOver: world.gauntletOver } }));
}

// --- a normal gauntlet still ends on a death -------------------------------
{
  const world = new World('gauntlet', ['SOLO'], 0, arena, false, 0);
  const priv = world as any;
  const p = world.players[0];
  p.hp = 1;
  p.iframes = 0;
  priv.damagePlayer(p, 1, -1, 0, 1, 0, 0, -1);
  if (!world.gauntletOver) fail('the boss-rush rules leaked into a scored gauntlet run');
  console.log(JSON.stringify({ scoredGauntletStillEnds: true }));
  void frame;
}

console.log('bossrush-check: OK');
