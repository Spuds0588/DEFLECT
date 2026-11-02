/** Mini-boss entrances freeze the room, hold the camera target, then hand back. */
import { ARENAS } from '../src/game/arenas';
import { MINIBOSS } from '../src/game/minibosses';
import { SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';

const fail = (m: string): never => {
  throw new Error(m);
};

const arena = ARENAS.find((a) => a.id === 22) ?? ARENAS[0];

function fresh(): { world: World; p: any } {
  const world = new World('gauntlet', ['INTRO'], 0, arena);
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const s of world.sentries) s.active = false;
  for (const e of world.errors) e.active = false;
  const p = world.players[0];
  p.x = (arena.bounds.left + arena.bounds.right) * 0.5;
  p.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
  p.alive = true;
  p.hp = 60;
  return { world, p };
}

const cases = [MINIBOSS.MEGA_WORM, MINIBOSS.IDLE_HANDS, MINIBOSS.STARFISH, MINIBOSS.BLOB];
for (const kind of cases) {
  const { world, p } = fresh();
  const boss = world.spawnMiniboss(kind, p.x + 320, p.y - 60) ?? fail(`boss ${kind} did not spawn`);
  const intro = world.bossIntro;
  if (!intro) fail(`boss ${kind} did not start an entrance`);
  if (intro.kind !== kind) fail(`boss ${kind} opened the wrong entrance`);
  if (intro.label.length === 0) fail(`boss ${kind} has no entrance title`);

  const startX = p.x;
  world.step(SIM_DT, [{ mx: 1, my: 0, held: 0, pressed: 0 }]);
  if (p.x !== startX) fail(`gameplay moved during the ${intro.label} entrance`);
  if (!world.bossIntro) fail(`the ${intro.label} entrance ended after one tick`);
  if (!boss.active) fail(`the ${intro.label} body vanished during its entrance`);

  let guard = 0;
  while (world.bossIntro && guard++ < 1500) world.step(SIM_DT, [null]);
  if (world.bossIntro) fail(`the ${intro.label} entrance never finished`);
  console.log(JSON.stringify({ intro: intro.label, seconds: Number(intro.duration.toFixed(2)), ticks: guard }));
}

console.log('bossintro-check: OK');
