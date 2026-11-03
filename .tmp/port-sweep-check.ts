/**
 * BUILD ROOT port sweep, driven through ordinary ranged input.
 *
 * Answers three questions with numbers instead of opinion: can a body stand in front of
 * each ingress port with a clear line, do ordinary bolts damage it, and how long does the
 * sweep take. Then it walks into the party exit and checks the node clears. The pilot is
 * damage-immune so the measurement is the ports, not incoming fire.
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

for (let i = 0; i < ports.length; i++) {
  const port = ports[i];
  const cx = port.x + port.w * 0.5;
  const cy = port.y + port.h * 0.5;
  // Stand off along the first unobstructed axis, at a comfortable ranged distance.
  let spot: { x: number; y: number } | null = null;
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    for (const dist of [170, 140, 110]) {
      const x = cx + ox * dist;
      const y = cy + oy * dist;
      if (x < arena.bounds.left + 30 || x > arena.bounds.right - 30) continue;
      if (y < arena.bounds.top + 30 || y > arena.bounds.bottom - 30) continue;
      if (priv.lineBlocked(x, y, cx, cy)) continue;
      spot = { x, y };
      break;
    }
    if (spot) break;
  }
  if (!spot) throw new Error(`no clear firing line to port ${i} at ${Math.round(cx)},${Math.round(cy)}`);

  p.x = spot.x;
  p.y = spot.y;
  p.alive = true;
  p.active = true;
  p.hp = p.maxHp;
  p.facing = Math.atan2(cy - spot.y, cx - spot.x);
  p.kx = 0;
  p.ky = 0;
  p.lockActive = false;

  const startHp = port.hp;
  const before = world.portsClosed;
  let t = 0;
  while (t < 14 && port.hp > 0) {
    // Re-aim every frame: the body is pushed by the port's own emissions.
    p.facing = Math.atan2(cy - p.y, cx - p.x);
    p.x = spot.x;
    p.y = spot.y;
    world.step(SIM_DT, frames);
    t += SIM_DT;
  }
  if (port.hp > 0) throw new Error(`port ${i} survived 14 s of ranged fire (${startHp} -> ${port.hp})`);
  if (world.portsClosed !== before + 1) throw new Error(`port ${i} closed without counting`);
  totalSeconds += t;
  report.push(
    `port ${i} @${Math.round(cx)},${Math.round(cy)} hp ${startHp} standoff ${Math.round(Math.hypot(spot.x - cx, spot.y - cy))} cleared in ${t.toFixed(1)}s`,
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
