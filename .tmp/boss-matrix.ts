/**
 * Boss matrix: every mini-boss spawns, survives the floor/cull rules and can be killed
 * on a spread of arena shapes. Damage is applied through `damageWorm`, so this checks
 * the real kill path rather than a test-only shortcut.
 */
import { SIM_DT } from '../src/game/config';
import { MINIBOSSES } from '../src/game/minibosses';
import { ARENAS, type ArenaDef } from '../src/game/arenas';
import { World } from '../src/game/world';
import type { Worm } from '../src/game/types';

const fail = (m: string): never => {
  throw new Error(m);
};

const frames = Array.from({ length: 8 }, () => ({ mx: 0, my: 0, held: 0, pressed: 0 }));
const arenaIds = [0, 1, 3, 14];
const arenas: ArenaDef[] = [];
for (const id of arenaIds) {
  const arena = ARENAS.find((a) => a.id === id);
  if (!arena) fail(`arena ${id} is missing`);
  arenas.push(arena);
}

function fresh(arena: ArenaDef): { world: World; priv: any } {
  const world = new World('gauntlet', ['MATRIX'], 0, arena);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const s of world.sentries) s.active = false;
  for (const e of world.errors) e.active = false;
  for (const p of world.players) p.active = p.slot === 0;
  const p = world.players[0];
  p.alive = true;
  p.hp = p.maxHp;
  p.iframes = 999;
  return { world, priv };
}

const liveBosses = (world: World, kind: number) =>
  world.worms.filter((w) => w.active && w.bossKind === kind) as Worm[];

const report: Record<string, unknown>[] = [];

for (const arena of arenas) {
  for (const def of MINIBOSSES) {
    const { world, priv } = fresh(arena);
    const p = world.players[0];
    p.x = (arena.bounds.left + arena.bounds.right) * 0.5;
    p.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
    const boss = priv.spawnMiniboss(def.id, p.x + 220, p.y - 40);
    if (!boss) fail(`${def.key} did not spawn on ${arena.name}`);
    priv.bossIntro = null;
    for (const w of liveBosses(world, def.id)) {
      w.spawnT = 0;
      w.entryT = 0;
      w.roarT = 0;
      w.held = false;
    }
    // Three seconds of real simulation: culls, hazards, bosses' own updates.
    for (let i = 0; i < 180; i++) {
      p.iframes = 999;
      world.step(SIM_DT, frames);
    }
    const alive = liveBosses(world, def.id);
    if (alive.length === 0) fail(`${def.key} disappeared on ${arena.name} after ${(180 * SIM_DT).toFixed(1)}s`);
    for (const w of alive) {
      if (!Number.isFinite(w.x) || !Number.isFinite(w.y)) fail(`${def.key} has a non-finite position on ${arena.name}`);
      if (Math.hypot(w.x - p.x, w.y - p.y) > 6000) fail(`${def.key} left the map on ${arena.name}`);
    }
    // Kill every body of the boss. Starfish arms and Idle Hands' pair are bodies too.
    let guard = 0;
    while (liveBosses(world, def.id).length > 0 && guard++ < 40) {
      for (const w of liveBosses(world, def.id)) {
        priv.damageWorm(w, w.hp + 10, 0, 0, 0, 0, w.x, w.y);
      }
      for (let i = 0; i < 3; i++) {
        p.iframes = 999;
        world.step(SIM_DT, frames);
      }
    }
    if (liveBosses(world, def.id).length > 0) fail(`${def.key} survived its kill on ${arena.name}`);
    report.push({ arena: arena.name, boss: def.key, bodies: alive.length, killed: true });
  }
}

console.log(JSON.stringify({ matrix: report.length, cases: report }));
console.log('boss-matrix-check: OK');
