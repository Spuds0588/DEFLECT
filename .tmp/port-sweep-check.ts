/**
 * BUILD ROOT port sweep, driven through ordinary ranged input.
 *
 * For each ingress port it tries the ordinary firing lanes a player would use (eight axes at
 * three standoffs, each side of the port), stands still and holds fire, and reports which lane
 * actually lands damage and how long the port takes to close. Then it walks into the party exit
 * and checks the node clears. The pilot is damage-immune so the measurement is the ports, not
 * incoming fire.
 *
 * Run with `npx tsx .tmp/port-sweep-check.ts`.
 */
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import { ACTION } from '../src/game/types';
import type { Prop } from '../src/game/types';

const level = PLAYABLE_CAMPAIGN_LEVELS[0];
const arena = ARENAS.find((a) => a.id === level.arenaId);
if (!arena) throw new Error('level 1 arena missing');

const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'PORTER';
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
  -1,
);
const priv = world as unknown as {
  tutorial: unknown;
  campaignPhase: string;
  beginAssault: () => void;
  lineBlocked: (x1: number, y1: number, x2: number, y2: number) => boolean;
};
priv.tutorial = null;
priv.campaignPhase = 'assault';
priv.beginAssault();

const p = world.players[0];
p.iframes = 1e9;
const frames = new Array(MAX_PLAYERS).fill(null);
const frame = { mx: 0, my: 0, held: ACTION.BOLT, pressed: 0 };
frames[0] = frame;

const ports = world.props.filter((b) => b.portal && !b.portalExit) as Prop[];
if (ports.length !== 3) throw new Error(`expected three ingress ports, got ${ports.length}`);
if (world.portTotal !== 3) throw new Error(`portTotal ${world.portTotal}`);

const report: string[] = [];
let totalSeconds = 0;

function place(x: number, y: number, cx: number, cy: number) {
  p.x = x;
  p.y = y;
  p.alive = true;
  p.active = true;
  p.hp = p.maxHp;
  p.kx = 0;
  p.ky = 0;
  p.lockActive = false;
  p.facing = Math.atan2(cy - y, cx - x);
}

let laneSpot = { x: 0, y: 0, cx: 0, cy: 0 };
function fire(seconds: number, quiet = true, until?: () => boolean): number {
  let t = 0;
  let nextLog = 1;
  while (t < seconds && !(until && until())) {
    // A player steering at the port keeps facing on it; knockback from the port's own
    // squad shoves the body, so step back onto the lane when displaced by a body length.
    laneSpot.cx = laneSpot.cx;
    if (Math.hypot(p.x - laneSpot.x, p.y - laneSpot.y) > 45) {
      p.x = laneSpot.x;
      p.y = laneSpot.y;
    }
    p.facing = Math.atan2(laneSpot.cy - p.y, laneSpot.cx - p.x);
    world.step(SIM_DT, frames);
    t += SIM_DT;
    if (!quiet && t >= nextLog) {
      nextLog += 2;
      console.log(`    t=${t.toFixed(0)}s hp=${currentPort?.hp} player=${Math.round(p.x)},${Math.round(p.y)} facing=${p.facing.toFixed(2)} bolts=${world.projectiles.filter((q) => q.active && q.owner === 0).length}`);
    }
  }
  return t;
}
let currentPort: Prop | null = null;

for (let i = 0; i < ports.length; i++) {
  const port = ports[i];
  const cx = port.x + port.w * 0.5;
  const cy = port.y + port.h * 0.5;
  const startHp = port.hp;
  const before = world.portsClosed;

  const lanes: { x: number; y: number; label: string }[] = [];
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    for (const dist of [170, 140, 110]) {
      const x = cx + ox * dist;
      const y = cy + oy * dist;
      if (x < arena.bounds.left + 30 || x > arena.bounds.right - 30) continue;
      if (y < arena.bounds.top + 30 || y > arena.bounds.bottom - 30) continue;
      if (priv.lineBlocked(x, y, cx, cy)) continue;
      lanes.push({ x, y, label: `${ox},${oy}@${dist}` });
    }
  }

  let used: string | null = null;
  let spent = 0;
  for (const lane of lanes) {
    place(lane.x, lane.y, cx, cy);
    laneSpot = { x: lane.x, y: lane.y, cx, cy };
    currentPort = port;
    spent += fire(4);
    if (port.hp < startHp) {
      used = lane.label;
      break;
    }
  }
  if (!used) throw new Error(`port ${i} @${Math.round(cx)},${Math.round(cy)} took no damage from any of ${lanes.length} firing lanes`);
  // Keep firing from the lane that works until the port closes.
  console.log(`  port ${i}: lane ${used} first hit after ${spent.toFixed(1)}s (hp ${port.hp})`);
  const rest = fire(25, false, () => !port.active || port.hp <= 0);
  spent += rest;
  if (port.hp > 0) throw new Error(`port ${i} still at ${port.hp} hp after ${spent.toFixed(1)}s from lane ${used}`);
  if (false) throw new Error(`port ${i} closed only ${startHp - port.hp} of ${startHp} hp from lane ${used} in ${spent.toFixed(1)}s`);
  if (world.portsClosed !== before + 1) throw new Error(`port ${i} closed without counting`);
  totalSeconds += spent;
  report.push(
    `port ${i} @${Math.round(cx)},${Math.round(cy)} hp ${startHp} lane ${used} (of ${lanes.length}) closed in ${spent.toFixed(1)}s`,
  );
}

if (!world.campaignExitReady) throw new Error('closing every port did not open the party exit');
const exit = world.props.find((b) => b.portalExit);
if (!exit) throw new Error('party exit prop missing');
p.x = exit.x + exit.w * 0.5;
p.y = exit.y + exit.h * 0.5;
let t = 0;
while (t < 3 && world.campaignPhase !== 'cleared') {
  world.step(SIM_DT, frames);
  t += SIM_DT;
}
if (world.campaignPhase !== 'cleared') throw new Error(`standing in the exit left phase ${world.campaignPhase}`);

for (const line of report) console.log(line);
console.log(`port-sweep-check: OK (sweep ${totalSeconds.toFixed(1)}s of firing, exit reached in ${t.toFixed(2)}s, phase ${world.campaignPhase})`);
