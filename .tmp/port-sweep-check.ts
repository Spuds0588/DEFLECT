/**
 * Feed-room port sweep, driven through ordinary ranged input.
 *
 * MAINBOARD has two ingress ports and ROUTER has one. For each port the probe tries the
 * firing lanes a player would use and closes it with held fire. The last closure is not
 * enough by itself: any live squad must be cleared too. Only then does the right-wall
 * portal open and the pull clear the node without a party-port prop.
 *
 * Run with `npx tsx .tmp/port-sweep-check.ts`.
 */
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { ACTION, type Prop } from '../src/game/types';
import { World } from '../src/game/world';

const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'PORTER';
const frames = new Array(MAX_PLAYERS).fill(null);
const frame = { mx: 0, my: 0, held: ACTION.BOLT, pressed: 0 };
frames[0] = frame;
const idle = new Array(MAX_PLAYERS).fill(null);

let totalSeconds = 0;
const report: string[] = [];

for (const index of [2, 3]) {
  const level = PLAYABLE_CAMPAIGN_LEVELS[index];
  const arena = ARENAS.find((a) => a.id === level.arenaId);
  if (!arena) throw new Error(`${level.name}: arena missing`);
  const world = new World(
    'gauntlet', names, 0, arena, false, 0, 0, null, true,
    level.dataCrates, false, level.intro, level.clearKills, false, -1,
  );
  const p = world.players[0];
  p.iframes = 1e9;

  const ports = world.props.filter((b) => b.portal && !b.portalExit) as Prop[];
  if (ports.length !== (arena.ingress?.length ?? 0)) {
    throw new Error(`${level.name}: expected ${arena.ingress?.length ?? 0} ports, got ${ports.length}`);
  }
  if (world.portTotal !== ports.length) throw new Error(`${level.name}: portTotal ${world.portTotal}`);

  const lineBlocked = (world as unknown as { lineBlocked: (x1: number, y1: number, x2: number, y2: number) => boolean }).lineBlocked.bind(
    world,
  );
  const laneSpot = { x: 0, y: 0, cx: 0, cy: 0 };

  const fire = (seconds: number, until: () => boolean): number => {
    let t = 0;
    while (t < seconds && !until()) {
      // The room has become a portal. Stop steering the test body; the pull now owns
      // it, and snapping it back onto a firing lane would fight the game rule.
      if (world.campaignExitReady) break;
      if (Math.hypot(p.x - laneSpot.x, p.y - laneSpot.y) > 45) {
        p.x = laneSpot.x;
        p.y = laneSpot.y;
      }
      p.facing = Math.atan2(laneSpot.cy - p.y, laneSpot.cx - p.x);
      world.step(SIM_DT, frames);
      t += SIM_DT;
    }
    return t;
  };

  let levelSeconds = 0;
  for (let i = 0; i < ports.length; i++) {
    const port = ports[i];
    const cx = port.x + port.w * 0.5;
    const cy = port.y + port.h * 0.5;
    const startHp = port.hp;
    const lanes: { x: number; y: number; label: string }[] = [];
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      for (const dist of [170, 140, 110]) {
        const x = cx + ox * dist;
        const y = cy + oy * dist;
        if (x < arena.bounds.left + 30 || x > arena.bounds.right - 30) continue;
        if (y < arena.bounds.top + 30 || y > arena.bounds.bottom - 30) continue;
        if (lineBlocked(x, y, cx, cy)) continue;
        lanes.push({ x, y, label: `${ox},${oy}@${dist}` });
      }
    }
    let used: string | null = null;
    let spent = 0;
    for (const lane of lanes) {
      p.x = lane.x;
      p.y = lane.y;
      p.alive = true;
      p.active = true;
      p.hp = p.maxHp;
      p.kx = 0;
      p.ky = 0;
      p.lockActive = false;
      laneSpot.x = lane.x;
      laneSpot.y = lane.y;
      laneSpot.cx = cx;
      laneSpot.cy = cy;
      spent += fire(4, () => false);
      if (port.hp < startHp) {
        used = lane.label;
        break;
      }
    }
    if (!used) throw new Error(`${level.name}: port ${i} took no damage from any of ${lanes.length} lanes`);
    if (port.hp > 0) spent += fire(25, () => !port.active || port.hp <= 0);
    if (port.hp > 0) throw new Error(`${level.name}: port ${i} still at ${port.hp} hp`);
    levelSeconds += spent;
    report.push(`${level.name}: port ${i} @${Math.round(cx)},${Math.round(cy)} hp ${startHp} lane ${used} closed in ${spent.toFixed(1)}s`);
    if (world.campaignExitReady) break;
  }

  if (!world.campaignExitReady) {
    const floorClear = (world as unknown as { campaignFloorClear: () => boolean }).campaignFloorClear.bind(world);
    if (floorClear()) throw new Error(`${level.name}: cleared floor did not open the exit portal`);
    // The old contract opened on the last port hit. Retire the remaining squad the way a
    // completed sweep would, then confirm the portal waits for that floor.
    const retired = world as unknown as {
      sentries: { active: boolean }[];
      viruses: { active: boolean }[];
      worms: { active: boolean }[];
      errors: { active: boolean }[];
    };
    for (const s of retired.sentries) s.active = false;
    for (const v of retired.viruses) v.active = false;
    for (const w of retired.worms) w.active = false;
    for (const e of retired.errors) e.active = false;
    for (let i = 0; i < 120 && !world.campaignExitReady; i++) world.step(SIM_DT, idle);
  }
  if (!world.campaignExitReady) throw new Error(`${level.name}: last port and clear floor did not open the exit portal`);
  if (world.campaignPortalT < 0) throw new Error(`${level.name}: portal pull did not start`);
  if (world.props.some((b) => b.portalExit)) throw new Error(`${level.name}: a party-port prop still spawned`);
  for (let i = 0; i < 180 && world.campaignPhase !== 'cleared'; i++) world.step(SIM_DT, idle);
  if (world.campaignPhase !== 'cleared') throw new Error(`${level.name}: pull left phase ${world.campaignPhase}`);
  if (!(p.x > arena.bounds.right - 60)) throw new Error(`${level.name}: body did not reach the right wall`);
  totalSeconds += levelSeconds;
}

for (const line of report) console.log(line);
console.log(`port-sweep-check: OK (${report.length} ports, ${totalSeconds.toFixed(1)}s firing, both feed rooms cleared through the pull)`);
