/** Memory fragment probe: drops, stacking, damage scale, respawn carry, match exclusion. */
import { MEMORY } from '../src/game/memory';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';

const fail = (m: string): never => {
  throw new Error(m);
};
const arena = ARENAS.find((a) => a.id === 22) ?? ARENAS[0];

function fresh(mode: 'training' | 'match'): { world: World; priv: any } {
  const world = new World(mode, ['A', 'B'], 0, arena, false, 0, 1);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  for (const s of world.sentries) s.active = false;
  const a = world.players[0];
  const b = world.players[1];
  a.x = (arena.bounds.left + arena.bounds.right) * 0.5 - 200;
  a.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
  b.x = a.x + 120;
  b.y = a.y;
  a.alive = true;
  b.active = true;
  b.alive = true;
  a.hp = a.maxHp = 3;
  b.hp = b.maxHp = 3;
  a.iframes = 0;
  b.iframes = 0;
  a.memory = 0;
  b.memory = 0;
  a.memoryDropped = false;
  b.memoryDropped = false;
  return { world, priv };
}

function fresh2(): { world: World; priv: any } {
  const world = new World('training', ['A', 'B'], 0, arena, false, 0, 1);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  for (const s of world.sentries) s.active = false;
  return { world, priv };
}
const live = (world: World) => world.fragments.filter((f) => f.active);

// --- drop, collect, stack ---------------------------------------------------
{
  const { world, priv } = fresh('training');
  const [a, b] = world.players;
  priv.damagePlayer(b, 99, 0, 1, 0, 0);
  if (live(world).length !== 1) fail('a downed player left no memory fragment');
  if (!b.memoryDropped) fail('the body did not latch its one drop');
  const f = live(world)[0];
  if (Math.hypot(f.x - b.x, f.y - b.y) > 1) fail('the fragment did not land on the body');
  a.x = f.x;
  a.y = f.y;
  priv.updateFragments(0.016);
  if (live(world).length !== 0) fail('standing on a fragment did not collect it');
  if (a.memory !== 1) fail(`stack count is ${a.memory}`);
  if (a.maxHp !== 4) fail(`max health is ${a.maxHp}, expected 4`);
  if (a.hp !== 4) fail(`health did not grow with the stack (${a.hp})`);
  console.log(JSON.stringify({ pickup: { memory: a.memory, maxHp: a.maxHp } }));
}

// --- damage scaling --------------------------------------------------------
{
  const { world, priv } = fresh('training');
  const [a, b] = world.players;
  a.memory = 3;
  b.hp = 3;
  b.iframes = 0;
  priv.damagePlayer(b, 1, 0, 1, 0, 0);
  const taken = 3 - b.hp;
  if (Math.abs(taken - 1.75) > 1e-6) fail(`three stacks dealt ${taken} instead of 1.75`);
  b.hp = 3;
  b.iframes = 0;
  priv.damagePlayer(b, 1, -1, 1, 0, 0);
  if (3 - b.hp !== 1) fail('an enemy hit was scaled by the player damage bonus');
  console.log(JSON.stringify({ damage: { stacks3: 1.75, enemy: 1 } }));
}

// --- cap and once-per-run --------------------------------------------------
{
  const { world, priv } = fresh('training');
  const [a, b] = world.players;
  a.memory = MEMORY.maxStacks;
  priv.damagePlayer(b, 99, 0, 1, 0, 0);
  const f = live(world)[0];
  a.x = f.x;
  a.y = f.y;
  priv.updateFragments(0.016);
  if (a.memory !== MEMORY.maxStacks) fail('the stack cap was exceeded');
  if (live(world).length !== 1) fail('a capped player consumed the shard instead of leaving it');

  b.alive = true;
  b.hp = 3;
  b.iframes = 0;
  for (const frag of world.fragments) frag.active = false;
  priv.damagePlayer(b, 99, 0, 1, 0, 0);
  if (live(world).length !== 0) fail('a respawned body dropped a second fragment');
}

// --- respawn and campaign carry -------------------------------------------
{
  const { world, priv } = fresh('training');
  const a = world.players[0];
  a.memory = 2;
  priv.applyMemoryHealth(a, true);
  if (a.maxHp !== 5) fail(`memory health is ${a.maxHp}, expected 5`);
  priv.respawnTrainingPlayer(a);
  if (a.maxHp !== 5) fail(`a respawn dropped the memory health (${a.maxHp})`);
  if (a.hp !== 5) fail('a respawn did not refill the enlarged pool');

  priv.setMemoryStacks(0, 3);
  if (a.maxHp !== 6) fail(`carry-over set max health to ${a.maxHp}, expected 6`);
  priv.setMemoryStacks(0, 9);
  if (a.memory !== MEMORY.maxStacks) fail('carry-over did not clamp to the cap');
}

// --- speed constant and match exclusion -----------------------------------
{
  if (MEMORY.speedPerStack !== 0.2) fail('speed per stack drifted from 20%');
  const { world, priv } = fresh('match');
  const b = world.players[1];
  b.hp = 1;
  b.iframes = 0;
  priv.damagePlayer(b, 99, 0, 1, 0, 0);
  if (live(world).length !== 0) fail('a versus match dropped a memory fragment');
}


// --- shards never age out ---------------------------------------------------
{
  const { world, priv } = fresh('training');
  const [a, b] = world.players;
  priv.damagePlayer(b, 99, 0, 1, 0, 0);
  a.x = b.x + 900;
  a.y = b.y;
  for (let i = 0; i < 10; i++) priv.updateFragments(30);
  if (live(world).length !== 1) fail('a shard expired instead of waiting to be picked up');
}

// --- a total wipe clears the floor -----------------------------------------
{
  const world = new World('gauntlet', ['A'], 0, arena);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  const p = world.players[0];
  p.alive = true;
  p.hp = p.maxHp = 3;
  priv.dropMemoryFragment(p);
  if (live(world).length !== 1) fail('the wipe test never placed a shard');
  p.alive = false;
  world.gauntletOver = true;
  priv.updateFragments(0.016);
  if (live(world).length !== 0) fail('a total wipe left shards on the floor');
}

// --- save-point round trip --------------------------------------------------
{
  const { world, priv } = fresh('training');
  priv.restoreFragments([{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.2 }]);
  if (live(world).length !== 2) fail('restoreFragments did not place both saved shards');
  const saved = world.saveShards();
  if (saved.length !== 2) fail(`saveShards reported ${saved.length} shards`);
  if (Math.abs(saved[0].x - 0.25) > 0.02) fail('a saved shard lost its normalized position');
  const next = fresh2();
  next.priv.restoreFragments(saved);
  if (live(next.world).length !== 2) fail('a saved shard did not restore into the next arena');
}

console.log('memory-check: OK');
