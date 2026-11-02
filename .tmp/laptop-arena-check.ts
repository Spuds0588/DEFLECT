import { ARENAS, laptopCardY } from '../src/game/arenas';
import { PLAYER, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';

if (ARENAS.length !== 30) throw new Error(`expected 30 arenas, got ${ARENAS.length}`);
const arena = ARENAS[29];
if (arena.id !== 29 || arena.name !== 'BUSINESS LAPTOP') throw new Error('BUSINESS LAPTOP is not arena 29');
const lap = arena.laptop;
if (!lap) throw new Error('BUSINESS LAPTOP has no mail layout');
if (lap.messages.length !== 4) throw new Error('expected four messages');
if (lap.cards !== 4) throw new Error('expected four inbox cards');
if (lap.messages.some((message) => message.layout.length === 0)) throw new Error('a message has no preview cover');

for (let i = 0; i < arena.spawns.length; i++) {
  const s = arena.spawns[i];
  for (let j = 0; j < lap.messages.length; j++) {
    for (let k = 0; k < lap.messages[j].layout.length; k++) {
      const r = lap.messages[j].layout[k];
      const nx = Math.max(r.x, Math.min(s.x, r.x + r.w));
      const ny = Math.max(r.y, Math.min(s.y, r.y + r.h));
      if (Math.hypot(s.x - nx, s.y - ny) < PLAYER.radius + 1) {
        throw new Error(`spawn ${i} overlaps message ${j} block ${k}`);
      }
    }
  }
}
const firstY = laptopCardY(lap, 0, 0);
const movedY = laptopCardY(lap, 0, 1);
if (!(movedY < firstY)) throw new Error('inbox card did not move upward');

const world = new World('training', ['BUSINESS LAPTOP'], 0, arena);
world.drone.active = false;
world.drone.respawnT = 1e9;
if (world.laptopMessage !== 0) throw new Error('laptop did not start on message 0');
if (world.laptopSolids.length !== lap.cards + lap.messages[0].layout.length) {
  throw new Error(`unexpected initial cover count ${world.laptopSolids.length}`);
}
for (let i = 0; i < arena.spawns.length; i++) {
  const s = arena.spawns[i];
  for (let j = 0; j < world.laptopSolids.length; j++) {
    const r = world.laptopSolids[j];
    if (r.w <= 0 || r.h <= 0) continue;
    const nx = Math.max(r.x, Math.min(s.x, r.x + r.w));
    const ny = Math.max(r.y, Math.min(s.y, r.y + r.h));
    if (Math.hypot(s.x - nx, s.y - ny) < PLAYER.radius) throw new Error(`spawn ${i} starts inside laptop cover`);
  }
}
for (let t = 0; t < 8.2; t += SIM_DT) world.step(SIM_DT, [null]);
if (world.laptopMessage !== 1) throw new Error(`message did not advance, got ${world.laptopMessage}`);
if (world.laptopSolids.length !== lap.cards + lap.messages[1].layout.length) {
  throw new Error('preview cover did not swap with the message');
}
if (buildSnapshotHazards(world) !== null) throw new Error('laptop state leaked into SnapshotHazards');
world.beginRound();
if (world.laptopMessage !== 0 || world.laptopT !== 0) throw new Error('round reset did not rewind the mail');

console.log(
  JSON.stringify({
    arenas: ARENAS.length,
    laptopId: arena.id,
    messages: lap.messages.length,
    cards: lap.cards,
    coverAfterChange: world.laptopSolids.length,
    hazards: buildSnapshotHazards(world) === null ? 0 : 1,
  }),
);
