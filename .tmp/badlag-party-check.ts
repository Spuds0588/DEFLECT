/**
 * Bad Lag party audit. Local-only measurement; no gameplay state is written.
 *
 * Run: npx tsx .tmp/badlag-party-check.ts
 */
import { ARENAS } from '../src/game/arenas';
import { BUFFER, SIM_DT } from '../src/game/config';
import { PROGRAM_ID } from '../src/game/programs';
import { ACTION, type InputFrame } from '../src/game/types';
import { World } from '../src/game/world';

const frame = (): InputFrame => ({ mx: 0, my: 0, held: 0, pressed: 0 });
const REBIN = ARENAS.find((a) => a.name === 'RECYCLING BIN');
if (!REBIN) throw new Error('RECYCLING BIN missing');

function liveWorld(arena = ARENAS[0]): World {
  // Campaign is the co-op party rule, not a local duel where the other body is a target.
  const world = new World(
    'gauntlet',
    ['LAG', 'ALLY'],
    0,
    arena,
    false,
    PROGRAM_ID.BUFFER,
    1,
    [PROGRAM_ID.PROBE],
    true,
  );
  const idle = [frame(), frame()];
  for (let i = 0; i < 30; i++) world.step(SIM_DT, idle);
  return world;
}

function liveMatch(): World {
  const world = new World('match', ['LAG', 'ENEMY'], 0, ARENAS[0], false, PROGRAM_ID.BUFFER, 1, [PROGRAM_ID.PROBE]);
  const idle = [frame(), frame()];
  for (let i = 0; i < 300 && world.phase !== 'live'; i++) world.step(SIM_DT, idle);
  return world;
}

function place(world: World, separateRows = false): void {
  const b = world.arena.bounds;
  const y = b.top + 202;
  for (const [slot, x] of [[0, b.left + 552], [1, separateRows ? b.left + 552 : b.left + 752]] as const) {
    const p = world.players[slot];
    p.active = true;
    p.alive = true;
    p.iframes = 0;
    p.x = x;
    p.y = separateRows && slot === 1 ? b.top + 702 : y;
    p.prevX = p.x;
    p.prevY = p.y;
    p.kx = 0;
    p.ky = 0;
    p.facing = 0;
    p.speedMult = 1;
    p.dashT = 0;
    p.travelT = 0;
  }
}

function walk(world: World, seconds: number): [number, number] {
  const before = [world.players[0].x, world.players[1].x];
  const inputs = [frame(), frame()];
  inputs[0].mx = 1;
  inputs[1].mx = 1;
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) world.step(SIM_DT, inputs);
  return [world.players[0].x - before[0], world.players[1].x - before[1]];
}

function slow(world: World): void {
  const owner = world.players[0];
  owner.energy = 100;
  (world as any).startTimeSlow(owner);
  if (world.timeSlowT !== BUFFER.slowTime || world.timeSlowOwner !== 0) {
    throw new Error('time dilation did not start');
  }
}

const world = liveWorld();
place(world);
const baseline = walk(world, 0.5);
place(world);
slow(world);
const slowed = walk(world, 0.5);

const projectiles = liveWorld();
place(projectiles, true);
slow(projectiles);
const shots = [frame(), frame()];
const p0 = projectiles.players[0];
const p1 = projectiles.players[1];
const sx0 = p0.x;
const sx1 = p1.x;
const fired0 = (projectiles as any).spawnProjectile(p0, 0, 4, 400, false, 6, 1, 0);
const fired1 = (projectiles as any).spawnProjectile(p1, 0, 4, 400, false, 6, 1, 0);
for (let i = 0; i < 12; i++) projectiles.step(SIM_DT, shots);
const active = (projectiles as any).projectiles.filter((p: any) => p.active && (p.owner === 0 || p.owner === 1));
const shotX: Record<number, number> = {};
for (const p of active) {
  if (shotX[p.owner] === undefined || p.x > shotX[p.owner]) shotX[p.owner] = p.x;
}

const hazardWorld = liveWorld(REBIN);
place(hazardWorld);
const beforePusher = hazardWorld.pusherT;
slow(hazardWorld);
for (let i = 0; i < 60; i++) hazardWorld.step(SIM_DT, [frame(), frame()]);
const pusherDelta = hazardWorld.pusherT - beforePusher;

const duel = liveMatch();
place(duel);
slow(duel);
const duelMove = walk(duel, 0.5);

const result = {
  slowScale: BUFFER.slowScale,
  slowTime: BUFFER.slowTime,
  campaignBaselineMove: baseline.map((v) => +v.toFixed(1)),
  campaignSlowedMove: slowed.map((v) => +v.toFixed(1)),
  campaignAllyRatio: +(slowed[1] / Math.max(0.001, baseline[1])).toFixed(3),
  campaignCasterRatio: +(slowed[0] / Math.max(0.001, baseline[0])).toFixed(3),
  localPvpOpponentMove: duelMove.map((v) => +v.toFixed(1)),
  localPvpOpponentRatio: +(duelMove[1] / Math.max(0.001, duelMove[0])).toFixed(3),
  projectileStartX: [sx0, sx1],
  projectileFired: [fired0, fired1],
  projectilePlayer: [{ x: p0.x, y: p0.y, active: p0.active, alive: p0.alive, glue: p0.glueT }, { x: p1.x, y: p1.y, active: p1.active, alive: p1.alive, glue: p1.glueT }],
  projectileMaxX: [shotX[0] ?? sx0, shotX[1] ?? sx1],
  projectileTravel: [shotX[0] === undefined ? 'missing' : +(shotX[0] - sx0).toFixed(1), shotX[1] === undefined ? 'missing' : +(shotX[1] - sx1).toFixed(1)],
  projectileTimeRatio: shotX[0] !== undefined && shotX[1] !== undefined ? +((shotX[1] - sx1) / Math.max(0.001, shotX[0] - sx0)).toFixed(3) : null,
  hazardPusherDelta: +pusherDelta.toFixed(2),
  hazardExpectedRaw: 1,
};
console.log(JSON.stringify(result, null, 2));

if (!fired0 || !fired1) throw new Error('test projectile failed to spawn');
if (result.campaignAllyRatio < 0.9) throw new Error(`campaign ally still slowed: ${result.campaignAllyRatio}`);
if (result.localPvpOpponentRatio > 0.35) throw new Error(`local PvP opponent not slowed: ${result.localPvpOpponentRatio}`);
if (result.projectileTimeRatio === null || result.projectileTimeRatio < 0.8) throw new Error('campaign ally projectile still dilated');
if (Math.abs(result.hazardPusherDelta - 1) > 0.05) throw new Error(`hazard clock changed: ${result.hazardPusherDelta}`);
console.log('PASS badlag-party-check');
