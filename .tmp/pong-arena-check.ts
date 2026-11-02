import { ARENAS, arenaIndexById } from '../src/game/arenas';
import { PLAYER } from '../src/game/config';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';
import type { InputFrame } from '../src/game/types';

const zero: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };

if (ARENAS.length !== 23) throw new Error(`expected 23 arenas, got ${ARENAS.length}`);
if (arenaIndexById(22) !== 22) throw new Error('PONG is not at index 22');
const arena = ARENAS[22];
if (arena.name !== 'PONG') throw new Error('wrong pong arena');
const pong = arena.pong;
if (!pong) throw new Error('PONG has no court layout');

const b = arena.bounds;
const c = pong.court;
if (c.x <= b.left || c.y <= b.top || c.x + c.w >= b.right || c.y + c.h >= b.bottom) {
  throw new Error('pong court is outside the arena bounds');
}
if (pong.paddleH <= PLAYER.radius * 2) throw new Error('pong paddle is too short');
if (pong.paddleInset - pong.paddleW * 0.5 <= 0) throw new Error('pong paddle overlaps the court edge');
if (pong.speed <= 0 || pong.maxSpeed < pong.speed) throw new Error('pong speed range is invalid');
if (pong.bounceAngle <= 0 || pong.bounceAngle >= Math.PI / 2) throw new Error('pong bounce angle is invalid');
if (arena.spawns.length !== 8) throw new Error('pong needs eight spawn points');
for (const spawn of arena.spawns) {
  if (spawn.x < c.x + 40 || spawn.x > c.x + c.w - 40 || spawn.y < c.y + 40 || spawn.y > c.y + c.h - 40) {
    throw new Error(`pong spawn ${spawn.x},${spawn.y} is outside the court`);
  }
  const leftCenter = c.x + pong.paddleInset;
  const rightCenter = c.x + c.w - pong.paddleInset;
  if (
    Math.abs(spawn.x - leftCenter) < pong.paddleW * 0.5 + PLAYER.radius &&
    Math.abs(spawn.y - (c.y + c.h * 0.5)) < pong.paddleH * 0.5
  ) {
    throw new Error('pong spawn is on the left paddle');
  }
  if (
    Math.abs(spawn.x - rightCenter) < pong.paddleW * 0.5 + PLAYER.radius &&
    Math.abs(spawn.y - (c.y + c.h * 0.5)) < pong.paddleH * 0.5
  ) {
    throw new Error('pong spawn is on the right paddle');
  }
}

const world = new World('training', ['PONG'], 0, arena);
world.drone.active = false;
world.drone.respawnT = 1e9;

for (let i = 0; i < 60; i++) world.step(1 / 60, [zero]);
if (!world.pongBallActive) throw new Error('pong did not serve');
const startX = world.pongBallX;
for (let i = 0; i < 60 * 12; i++) world.step(1 / 60, [zero]);
if (!world.pongBallActive) throw new Error('pong ball went out without a serve reset');
if (world.pongBallX < c.x || world.pongBallX > c.x + c.w) throw new Error('pong ball left the court');
if (world.pongBallY < c.y || world.pongBallY > c.y + c.h) throw new Error('pong ball left the court vertically');
if (world.pongBallX === startX) throw new Error('pong ball did not move');
if (world.pongLeftY < c.y || world.pongLeftY > c.y + c.h) throw new Error('left paddle left the court');
if (world.pongRightY < c.y || world.pongRightY > c.y + c.h) throw new Error('right paddle left the court');
if (world.pongScoreLeft < 0 || world.pongScoreRight < 0) throw new Error('pong score went negative');

const scoreBeforeReset = [world.pongScoreLeft, world.pongScoreRight];
const ballBeforeReset = [Math.round(world.pongBallX), Math.round(world.pongBallY)];

const hazardWorld = new World('training', ['HIT'], 0, arena);
hazardWorld.drone.active = false;
hazardWorld.drone.respawnT = 1e9;
const player = hazardWorld.players[0];
player.x = c.x + c.w * 0.5;
player.y = c.y + c.h * 0.5;
player.prevX = player.x;
player.prevY = player.y;
const hp = player.hp;
for (let i = 0; i < 90; i++) hazardWorld.step(1 / 60, [zero]);
if (player.hp >= hp) throw new Error('pong ball did not damage a body on the court');
if (player.killerKind !== 14) throw new Error('pong hit did not use the PONG death source');

if (buildSnapshotHazards(world) !== null) throw new Error('pong state leaked into SnapshotHazards');
world.beginRound();
if (world.pongBallActive || world.pongScoreLeft !== 0 || world.pongScoreRight !== 0) {
  throw new Error('round reset did not clear the pong rally');
}

console.log(
  JSON.stringify({
    arenas: ARENAS.length,
    pongId: arena.id,
    court: [c.x, c.y, c.w, c.h],
    spawns: arena.spawns.length,
    ballBeforeReset,
    scoresBeforeReset: scoreBeforeReset,
    paddles: [Math.round(world.pongLeftY), Math.round(world.pongRightY)],
    scoresAfterReset: [world.pongScoreLeft, world.pongScoreRight],
    hazardDamage: hp - player.hp,
    resetActive: world.pongBallActive,
    hazards: buildSnapshotHazards(world) === null ? 0 : 1,
  }),
);
