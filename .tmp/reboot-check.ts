/**
 * REBOOT boss node: six corner feeds must be reachable and killable, and the Mega Worm
 * must stay off the floor until every port and body is gone.
 *
 * Run with `npx tsx .tmp/reboot-check.ts`.
 */
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { ACTION, type Prop } from '../src/game/types';
import { World } from '../src/game/world';

const fail = (m: string): never => {
  throw new Error(m);
};

const level = PLAYABLE_CAMPAIGN_LEVELS.find((l) => l.boss !== undefined) ?? fail('no boss node');
const arena = ARENAS.find((a) => a.id === level.arenaId) ?? fail('boss arena missing');
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'REBOOTER';
const frames = new Array(MAX_PLAYERS).fill(null);
const idle = new Array(MAX_PLAYERS).fill(null);
const p = { mx: 0, my: 0, held: ACTION.BOLT, pressed: 0 };
frames[0] = p;

const world = new World(
  'gauntlet', names, 0, arena, false, 0, 0, null, true,
  level.dataCrates, false, level.intro, level.clearKills, false, level.boss ?? -1,
);
const priv = world as any;
priv.tutorial = null;
priv.campaignPhase = 'assault';
priv.beginAssault();

const ports = world.props.filter((b) => b.portal && !b.portalExit) as Prop[];
if (ports.length !== 6) fail(`REBOOT authored ${ports.length} feeds, expected 6`);
if (world.portTotal !== 6) fail(`REBOOT portTotal is ${world.portTotal}, expected 6`);

const lineBlocked = priv.lineBlocked.bind(world);
const player = world.players[0];
player.iframes = 1e9;

const summary: { i: number; lanes: number; used: string; seconds: number }[] = [];
for (let i = 0; i < ports.length; i++) {
  const port = ports[i];
  const cx = port.x + port.w * 0.5;
  const cy = port.y + port.h * 0.5;
  const lanes: { x: number; y: number; label: string }[] = [];
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    for (const dist of [190, 160, 130, 100]) {
      const x = cx + ox * dist;
      const y = cy + oy * dist;
      if (x < arena.bounds.left + 30 || x > arena.bounds.right - 30) continue;
      if (y < arena.bounds.top + 30 || y > arena.bounds.bottom - 30) continue;
      if (lineBlocked(x, y, cx, cy)) continue;
      lanes.push({ x, y, label: `${ox},${oy}@${dist}` });
    }
  }
  let used = '';
  let spent = 0;
  for (const lane of lanes) {
    player.x = lane.x;
    player.y = lane.y;
    player.alive = true;
    player.active = true;
    player.hp = player.maxHp;
    player.kx = 0;
    player.ky = 0;
    player.facing = Math.atan2(cy - lane.y, cx - lane.x);
    const start = port.hp;
    let t = 0;
    while (t < 6 && port.hp >= start) {
      player.x = lane.x;
      player.y = lane.y;
      player.facing = Math.atan2(cy - player.y, cx - player.x);
      world.step(SIM_DT, frames);
      t += SIM_DT;
    }
    spent += t;
    if (port.hp < start) {
      used = lane.label;
      break;
    }
  }
  if (!used) fail(`feed ${i} at ${Math.round(cx)},${Math.round(cy)} took no damage from ${lanes.length} lanes`);
  let t = 0;
  while (port.hp > 0 && t < 30) {
    player.x = player.x;
    player.alive = true;
    world.step(SIM_DT, frames);
    t += SIM_DT;
  }
  if (port.hp > 0) fail(`feed ${i} did not close`);
  summary.push({ i, lanes: lanes.length, used, seconds: +(spent + t).toFixed(1) });
  console.log(JSON.stringify(summary[summary.length - 1]));
}

// A closed feed keeps its collapse animation for a beat before de-rezzing.
for (let i = 0; i < 60; i++) world.step(SIM_DT, idle);
if (ports.some((port) => port.active)) fail('a feed stayed active after closing');
if (world.portsClosed !== 6) fail(`portsClosed is ${world.portsClosed}, expected 6`);

// With every feed down, retire the leftover squad the way a completed sweep would. The
// boss warning starts on the cleared floor; the body itself waits out the warning card.
for (const s of world.sentries) s.active = false;
for (const v of world.viruses) v.active = false;
for (const w of world.worms) w.active = false;
for (const e of world.errors) e.active = false;
for (let i = 0; i < 240 && !priv.campaignBossWarned; i++) world.step(SIM_DT, idle);
if (!priv.campaignBossWarned) fail('the cleared floor never announced the Mega Worm');
if (world.worms.some((w: any) => w.active && w.bossKind === level.boss)) fail('the boss landed before its warning');
for (let i = 0; i < 600 && !world.worms.some((w: any) => w.active && w.bossKind === level.boss); i++) {
  world.step(SIM_DT, idle);
}
if (!world.worms.some((w: any) => w.active && w.bossKind === level.boss)) fail('the Mega Worm never arrived');

console.log(`reboot-check: OK (6 feeds closed, boss held until the floor was quiet)`);
