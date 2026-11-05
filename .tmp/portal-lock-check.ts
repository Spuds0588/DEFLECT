import { ARENAS } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { ACTION, type InputFrame } from '../src/game/types';
import { World } from '../src/game/world';

const arena = ARENAS.find((entry) => entry.id === 35);
const level = PLAYABLE_CAMPAIGN_LEVELS.find((entry) => entry.arenaId === 35);
if (!arena || !level) throw new Error('MAINBOARD arena or campaign level is missing');

const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'P';
const world = new World(
  'gauntlet',
  names,
  0,
  arena,
  false,
  0,
  0,
  null,
  true,
  level.dataCrates,
  false,
  level.intro,
  level.clearKills,
  false,
  level.boss ?? -1,
  false,
  level.opening ?? null,
  level.finale === true,
  0,
  level.blurb ?? null,
);

// Isolate the feed mouths from every other lockable body and stop them emitting
// while the lock is being tested.
for (const s of world.sentries) s.active = false;
for (const v of world.viruses) v.active = false;
for (const w of world.worms) w.active = false;
for (const e of world.errors) e.active = false;
const portals = world.props.filter((prop) => prop.active && prop.portal && !prop.portalExit);
if (portals.length !== 2) throw new Error(`expected two live MAINBOARD feeds, got ${portals.length}`);
for (const portal of portals) portal.portalT = 999;

const p = world.players[0];
// Stand in the east open lane: it is within lock range of both wall feeds and the
// line to each one avoids the top, left and lower-right racks.
p.x = 1600;
p.y = 600;
p.active = true;
p.alive = true;
p.travelT = 0;

const frames: (InputFrame | null)[] = new Array(MAX_PLAYERS).fill(null);
const frame: InputFrame = { mx: 0, my: 0, held: ACTION.LOCK, pressed: 0 };
frames[0] = frame;

for (let i = 0; i < 30; i++) world.step(SIM_DT, frames);
if (!p.lockActive || p.lockKind !== 7) {
  throw new Error(`portal lock was not acquired: active=${p.lockActive} kind=${p.lockKind}`);
}
const firstId = p.lockId;
const first = world.props[firstId];
if (!first || !world.readLockTarget(p)) throw new Error('locked portal has no readable target');
const firstX = first.x + first.w * 0.5;
const firstY = first.y + first.h * 0.5;
if (Math.abs(world.assistTarget.x - firstX) > 0.01 || Math.abs(world.assistTarget.y - firstY) > 0.01) {
  throw new Error('lock point is not the centre of the portal');
}
const facingError = Math.abs(
  Math.atan2(Math.sin(p.facing - Math.atan2(firstY - p.y, firstX - p.x)), Math.cos(p.facing - Math.atan2(firstY - p.y, firstX - p.x))),
);
if (facingError > 0.001) throw new Error('facing did not settle on the portal');

frame.pressed = ACTION.LOCK_NEXT;
world.step(SIM_DT, frames);
frame.pressed = 0;
if (!p.lockActive || p.lockKind !== 7 || p.lockId === firstId) {
  throw new Error(`cycle did not move to another portal: kind=${p.lockKind} id=${p.lockId} first=${firstId}`);
}
const second = world.props[p.lockId];
if (!second || !world.readLockTarget(p)) throw new Error('cycled portal has no readable target');
const secondX = second.x + second.w * 0.5;
const secondY = second.y + second.h * 0.5;
if (Math.abs(world.assistTarget.x - secondX) > 0.01 || Math.abs(world.assistTarget.y - secondY) > 0.01) {
  throw new Error('cycled lock point is not the centre of the second portal');
}

console.log(
  `portal-lock-check: OK (locked ${firstId} -> ${p.lockId}, centres ${firstX.toFixed(0)},${firstY.toFixed(0)} / ${secondX.toFixed(0)},${secondY.toFixed(0)})`,
);
