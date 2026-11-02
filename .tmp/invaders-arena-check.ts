import { ARENAS, arenaIndexById } from '../src/game/arenas';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';
import type { InputFrame } from '../src/game/types';

const zero: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };

if (ARENAS.length !== 25) throw new Error(`expected 25 arenas, got ${ARENAS.length}`);
if (arenaIndexById(24) !== 24) throw new Error('SPACE INVADERS is not at index 24');
const arena = ARENAS[24];
if (arena.name !== 'SPACE INVADERS') throw new Error('wrong invaders arena');
const inv = arena.invaders;
if (!inv) throw new Error('SPACE INVADERS has no cannon layout');
if (inv.rows < 3 || inv.cols < 6) throw new Error('invader fleet is too small to read');
if (arena.pillars.length < 3) throw new Error('invaders arena needs bunker cover');
if (arena.spawns.length !== 8) throw new Error('invaders arena needs eight spawn points');
for (const spawn of arena.spawns) {
  for (const bunker of arena.pillars) {
    if (
      spawn.x > bunker.x &&
      spawn.x < bunker.x + bunker.w &&
      spawn.y > bunker.y &&
      spawn.y < bunker.y + bunker.h
    ) {
      throw new Error(`invaders spawn ${spawn.x},${spawn.y} is inside a bunker`);
    }
  }
}
if (inv.cannon.y < arena.bounds.top || inv.cannon.y > arena.bounds.bottom) {
  throw new Error('invaders cannon is outside the floor');
}

const world = new World('training', ['INV'], 0, arena);
world.drone.active = false;
world.drone.respawnT = 1e9;
const player = world.players[0];
player.x = 700;
player.y = 500;
player.prevX = player.x;
player.prevY = player.y;
const hp = player.hp;
for (let i = 0; i < 60 * 3; i++) world.step(1 / 60, [zero]);
const damageTaken = hp - player.hp;
if (damageTaken <= 0) throw new Error('simulated cannon never hit the player');
if (player.killerKind !== 16) throw new Error('cannon hit did not use the ARCADE source');
if (world.invaderCannonX >= 930) throw new Error('simulated cannon did not track toward its target');
if (buildSnapshotHazards(world) !== null) throw new Error('invaders state leaked into SnapshotHazards');

world.beginRound();
if (world.invaderShots.some((shot) => shot.active)) throw new Error('round reset left cannon shots live');

console.log(
  JSON.stringify({
    arenas: ARENAS.length,
    invadersId: arena.id,
    fleet: [inv.rows, inv.cols],
    bunkers: arena.pillars.length,
    cannonStart: inv.cannon.x,
    cannonEnd: Math.round(world.invaderCannonX),
    hazardDamage: damageTaken,
    shots: world.invaderShots.length,
    hazards: buildSnapshotHazards(world) === null ? 0 : 1,
  }),
);
