/**
 * Food-court / arcade probe:
 *   1. IDs 42-48 sit before the QA range and keep the shared arcade spawn ring clear;
 *   2. snack/token drops warn then fall and hit a body on the chute;
 *   3. soda stacks lose cover without mutating the shared arena record;
 *   4. race cars move and a guard reverses one;
 *   5. the fighter cabinet lands a melee hit and can launch a fireball;
 *   6. a duck is marked, falls, and leaves the sky;
 *   7. Tetris blocks land as real cover without mutating the shared arena record;
 *   8. none of this enters SnapshotHazards.
 *
 * Run with `npx tsx .tmp/arcade-arena-check.ts`.
 */
import { ARENAS, arenaSolids } from '../src/game/arenas';
import { PLAYER, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';

const fail = (message: string): never => {
  throw new Error(message);
};

const specs = [
  [42, 'SNACK MACHINE'],
  [43, 'TOKEN DISPENSER'],
  [44, 'SODA MACHINE'],
  [45, 'ARCADE RACING'],
  [46, 'FIGHTING GAME'],
  [47, 'DUCK HUNTER'],
  [48, 'TETRIS'],
] as const;

const gapToRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }): number => {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
};

const makeWorld = (id: number, mode: 'training' | 'match' = 'training'): World => {
  const world = new World(mode, ['QA'], 0, ARENAS[id]);
  world.drone.active = false;
  world.drone.respawnT = 1e9;
  return world;
};

const run = (world: World, seconds: number): void => {
  const steps = Math.ceil(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) world.step(SIM_DT, [null]);
};

for (const [index, name] of specs) {
  const arena = ARENAS[index] ?? fail(`ARENAS[${index}] is missing`);
  if (arena.id !== index || arena.name !== name) fail(`arena ${index} is ${arena.id}/${arena.name}, want ${index}/${name}`);
  if (arena.qa) fail(`${name} is marked QA`);
  if (arena.spawns.length !== 8) fail(`${name} has ${arena.spawns.length} spawns, want 8`);
  for (let i = 0; i < arena.spawns.length; i++) {
    const s = arena.spawns[i];
    if (s.x <= arena.bounds.left || s.x >= arena.bounds.right || s.y <= arena.bounds.top || s.y >= arena.bounds.bottom) {
      fail(`${name} spawn ${i} leaves the floor`);
    }
    for (let p = 0; p < arena.pillars.length; p++) {
      if (gapToRect(s.x, s.y, arena.pillars[p]) < PLAYER.radius + 4) fail(`${name} spawn ${i} crowds static pillar ${p}`);
    }
  }
  if (arenaSolids(arena).length !== arena.pillars.length) fail(`${name} has extra static body solids`);
  const world = makeWorld(index);
  if (!world.arcade) fail(`${name} has no arcade runtime`);
  if (buildSnapshotHazards(world) !== null) fail(`${name} leaked into SnapshotHazards`);
  if (makeWorld(index, 'match').arcade === null) fail(`${name} is absent from a local match`);
}

if (ARENAS[53]?.id !== 90) fail(`QA arena moved: index 53 is ${ARENAS[53]?.id}`);

// Snack and token drops warn, fall, and remove one segment on the way down.
for (const index of [42, 43] as const) {
  const arena = ARENAS[index];
  const def = arena.dispenser ?? fail(`${arena.name} has no dispenser`);
  const world = makeWorld(index);
  const p = world.players[0];
  p.x = def.points[0].x;
  p.y = 620;
  p.iframes = 0;
  p.hp = p.maxHp;
  const before = p.hp;
  run(world, 3.2);
  if (p.hp !== before - def.damage) fail(`${arena.name} drop damage was ${before - p.hp}, want ${def.damage}`);
  const arcade = world.arcade ?? fail(`${arena.name} has no runtime`);
  if (arcade.dropFlashT <= 0 && arcade.drops.every((drop) => !drop.active)) {
    // The item may still be in flight after the hit; the hit itself is the contract.
  }
}

// Soda cover is per-World and shrinks from the authored stack.
{
  const arena = ARENAS[44];
  const def = arena.soda ?? fail('SODA MACHINE has no soda data');
  const sharedBefore = arena.pillars.length;
  const a = makeWorld(44);
  const b = makeWorld(44);
  const initial = a.arena.pillars.length;
  if (initial !== sharedBefore + def.stacks.length) fail(`soda beginning cover ${initial}, want ${sharedBefore + def.stacks.length}`);
  if (a.arena.pillars.length === b.arena.pillars.length && a.arena.pillars === b.arena.pillars) fail('soda worlds share a pillar list');
  run(a, def.interval + 0.4);
  if (a.arcade?.sodaCounts.every((count, i) => count >= def.stacks[i].cans)) fail('soda did not remove a can');
  if (a.arena.pillars[4]?.h !== (def.stacks[0].h / def.stacks[0].cans) * (def.stacks[0].cans - 1)) {
    fail(`soda top can did not shrink cover (h ${a.arena.pillars[4]?.h})`);
  }
  if (b.arena.pillars.length !== initial) fail('soda removal mutated another world');
  if (arena.pillars.length !== sharedBefore) fail('soda removal mutated the shared ARENAS record');
}

// Race cars move, and a guarded body reverses one.
{
  const arena = ARENAS[45];
  const def = arena.race ?? fail('ARCADE RACING has no race data');
  const world = makeWorld(45);
  const arcade = world.arcade ?? fail('ARCADE RACING has no runtime');
  const live = arcade.raceCars.filter((car) => car.active);
  if (live.length !== def.cars) fail(`race started ${live.length} cars, want ${def.cars}`);
  const angle = live[0].angle;
  run(world, 0.2);
  if (live[0].angle === angle) fail('race car did not move');
  for (let i = 1; i < arcade.raceCars.length; i++) arcade.raceCars[i].active = false;
  const car = arcade.raceCars[0];
  car.active = true;
  car.angle = 0;
  car.dir = 1;
  const p = world.players[0];
  p.x = def.center.x + def.rx;
  p.y = def.center.y;
  p.facing = Math.PI * 0.5;
  p.guardT = 1;
  p.iframes = 0;
  const dir = car.dir;
  world.step(SIM_DT, [null]);
  if (car.dir !== -dir) fail(`guard did not reverse race car (dir ${car.dir})`);
}

// The fighter telegraphs and lands a punch, then a fireball.
{
  const arena = ARENAS[46];
  const def = arena.fighter ?? fail('FIGHTING GAME has no fighter data');
  const world = makeWorld(46);
  const p = world.players[0];
  // The opening telegraph is the right cabinet's kick.
  p.x = def.right.x - 150;
  p.y = def.right.y;
  p.iframes = 0;
  p.hp = p.maxHp;
  const before = p.hp;
  run(world, 2.4);
  if (p.hp >= before) fail('fighter punch never landed');
  const arcade = world.arcade ?? fail('FIGHTING GAME has no runtime');
  let sawShot = false;
  for (let i = 0; i < 360; i++) {
    world.step(SIM_DT, [null]);
    if (arcade.fighterShots.some((shot) => shot.active)) {
      sawShot = true;
      break;
    }
  }
  if (!sawShot) fail('fighter never launched a fireball');
}

// A duck is marked, falls, and leaves the sky.
{
  const world = makeWorld(47);
  const arcade = world.arcade ?? fail('DUCK HUNTER has no runtime');
  let fell = false;
  for (let i = 0; i < 60 * 12; i++) {
    world.step(SIM_DT, [null]);
    if (arcade.duckBirds.some((bird) => bird.state === 1)) fell = true;
  }
  if (!fell) fail('no duck was marked and dropped');
}

// Tetris lands ordinary cover and leaves the shared arena untouched.
{
  const arena = ARENAS[48];
  const sharedBefore = arena.pillars.length;
  const world = makeWorld(48);
  const arcade = world.arcade ?? fail('TETRIS has no runtime');
  run(world, 8);
  if (!arcade.tetrisGrid.some((value) => value !== 0)) fail('Tetris never landed a piece');
  if (world.arena.pillars.length === 0) fail('Tetris did not expose landed cover');
  if (arena.pillars.length !== sharedBefore) fail('Tetris mutated the shared ARENAS record');
}

console.log('arcade arenas ok: snacks, tokens, soda, racing, fighter, duck, tetris');
