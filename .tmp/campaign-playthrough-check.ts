/**
 * One continuous campaign playthrough: BUILD ROOT then REBOOT, three runs, three bots.
 *
 * Everything is earned by input. The only conveniences a player has are used: the on-screen
 * SKIP TUTORIAL, and walking the decks the arena actually provides. No kill quota, port
 * health, boss health or phase is written by this probe, and the local body is mortal.
 *
 * Run with `npx tsx .tmp/campaign-playthrough-check.ts`.
 */
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import type { CampaignLevel } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { ARENAS, holdingCellLayout } from '../src/game/arenas';
import type { ArenaDef, Rect } from '../src/game/arenas';
import { World } from '../src/game/world';
import { ACTION } from '../src/game/types';

const CELL = 30;
const SWING = ACTION.SWING;

function buildFloor(arena: ArenaDef, isOpen: (i: number) => boolean) {
  const plates: Rect[] = [...(arena.islands ?? [])];
  const decks: Rect[] = [...(arena.bridges ?? [])];
  const blocks: Rect[] = [...(arena.pillars ?? []), ...(arena.traverse?.chasms ?? [])];
  const room = arena.rooms?.find((r) => r.theme === 'holding');
  if (room) {
    const l = holdingCellLayout(room);
    blocks.push({ x: l.left, y: l.top, w: l.cellW * 3, h: l.bottom - l.top });
  }
  const b = arena.bounds;
  // A plate and the deck that meets it only abut, so an inset large enough to keep the body
  // off a lip also opens a walkable gap at every junction and no route can cross. Containment
  // stays tight (6) and the step guard below supplies the clearance instead.
  const inRect = (r: Rect, x: number, y: number) => x > r.x + 6 && x < r.x + r.w - 6 && y > r.y + 6 && y < r.y + r.h - 6;
  const walkable = (x: number, y: number) => {
    if (x < b.left + 10 || x > b.right - 10 || y < b.top + 10 || y > b.bottom - 10) return false;
    let on = plates.length === 0;
    if (!on) for (const r of plates) if (inRect(r, x, y)) { on = true; break; }
    if (!on) for (let i = 0; i < decks.length; i++) if (isOpen(i) && inRect(decks[i], x, y)) { on = true; break; }
    if (!on) return false;
    for (const r of blocks) if (inRect(r, x, y)) return false;
    return true;
  };
  const cols = Math.ceil((b.right - b.left) / CELL);
  const rows = Math.ceil((b.bottom - b.top) / CELL);
  const idx = (cx: number, cy: number) => cy * cols + cx;
  const cellAt = (i: number) => ({ x: b.left + (i % cols) * CELL + CELL / 2, y: b.top + Math.floor(i / cols) * CELL + CELL / 2 });
  function path(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number }[] | null {
    const cl = (v: number, max: number) => Math.max(0, Math.min(max - 1, Math.round(v)));
    const s = idx(cl((fromX - b.left) / CELL, cols), cl((fromY - b.top) / CELL, rows));
    let g = idx(cl((toX - b.left) / CELL, cols), cl((toY - b.top) / CELL, rows));
    if (!walkable(cellAt(g).x, cellAt(g).y)) {
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < cols * rows; i++) {
        const c = cellAt(i);
        if (!walkable(c.x, c.y)) continue;
        const d = (c.x - toX) ** 2 + (c.y - toY) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) return null;
      g = best;
    }
    const prev = new Int32Array(cols * rows).fill(-2);
    const q = new Int32Array(cols * rows);
    let head = 0, tail = 0;
    prev[s] = -1;
    q[tail++] = s;
    while (head < tail) {
      const cur = q[head++];
      if (cur === g) break;
      const cx = cur % cols;
      const cy = Math.floor(cur / cols);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = idx(nx, ny);
        if (prev[ni] !== -2) continue;
        const c = cellAt(ni);
        if (!walkable(c.x, c.y)) continue;
        prev[ni] = cur;
        q[tail++] = ni;
      }
    }
    if (prev[g] === -2) {
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < cols * rows; i++) {
        if (prev[i] === -2) continue;
        const c = cellAt(i);
        const d = (c.x - toX) ** 2 + (c.y - toY) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) return null;
      g = best;
    }
    const out: { x: number; y: number }[] = [];
    for (let cur = g; cur >= 0; cur = prev[cur]) out.push(cellAt(cur));
    out.reverse();
    return out;
  }
  return { path, walkable };
}

const live = (t: any): boolean => !!t && t.active !== false && (t.hp === undefined || t.hp > 0);

function nearestHostile(world: any, p: any): { body: any; dist: number } | null {
  let best: any = null;
  let bd = Infinity;
  for (const arr of [world.worms, world.viruses, world.sentries, world.errors]) {
    for (const t of (arr ?? []) as any[]) {
      if (!live(t)) continue;
      if (t.held === true) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < bd) { bd = d; best = t; }
    }
  }
  return best ? { body: best, dist: bd } : null;
}

type Result = { run: number; level: string; phase: string; seconds: number; kills: number; ports: string; boss: number[]; deaths: number; log: string[] };

function playLevel(level: CampaignLevel, run: number): Result {
  const arena = ARENAS.find((a) => a.id === level.arenaId);
  if (!arena) throw new Error(`level ${level.id} arena ${level.arenaId} missing`);
  const names = new Array<string>(MAX_PLAYERS).fill('');
  names[0] = `PILOT${run}`;
  for (let i = 1; i <= 3; i++) names[i] = `BOT${i}`;
  const world = new World(
    'gauntlet', names, 0, arena, false, run % 4, 3, null, true,
    level.dataCrates, false, level.intro, level.clearKills, false, level.boss ?? -1,
  );
  const priv = world as any;
  const floor = buildFloor(arena, (i) => world.bridgeOpen[i] === true || arena.bridges?.[i]?.closed !== true);
  const p = world.players[0];
  const frames: any[] = new Array(MAX_PLAYERS).fill(null).map(() => ({ mx: 0, my: 0, held: 0, pressed: 0 }));
  let route: { x: number; y: number }[] | null = null;
  let routeKey = '';
  let routeTick = -999;
  let ticks = 0;
  let deaths = 0;
  let wasAlive = p.alive;
  let bossLogged = -1;
  const bossHp: number[] = [];
  const log: string[] = [];
  let lastPhase = '';
  const maxTicks = Math.round(420 / SIM_DT);
  const portsAtStart = world.portsClosed;

  while (ticks++ < maxTicks && world.campaignPhase !== 'cleared') {
    if (world.campaignPhase === 'failed') {
      throw new Error(`run ${run} ${level.name}: run failed at ${Math.round(ticks * SIM_DT)}s (${log.slice(-4).join(' | ')})`);
    }
    if (wasAlive && !p.alive) {
      deaths++;
      log.push(`${Math.round(ticks * SIM_DT)}s DEATH killer ${p.killerKind} at ${Math.round(p.x)},${Math.round(p.y)} hp ${p.hp}`);
    }
    wasAlive = p.alive;
    if (world.campaignPhase !== lastPhase) {
      log.push(`${Math.round(ticks * SIM_DT)}s ${world.campaignPhase} kills ${world.gauntletKills}/${world.campaignKillsToClear} ports ${world.portsClosed}/${world.portTotal}`);
      lastPhase = world.campaignPhase;
    }
    if (priv.tutorial && !priv.tutorial.done) world.skipTutorial();
    if (!p.alive) { world.step(SIM_DT, frames); continue; }

    const boss = level.boss !== undefined ? world.worms.find((w: any) => w.active && w.bossKind === level.boss) : undefined;
    const assault = world.campaignPhase === 'assault';
    const portals = assault ? world.props.filter((b: any) => b.portal && !b.portalExit && b.active && b.hp > 0) : [];
    const exit = assault ? world.props.find((b: any) => b.portalExit && b.active) : undefined;
    const hostile = nearestHostile(world, p);

    let goal: { x: number; y: number } | null = null;
    let closeIn = true;
    let goalKind = 'none';

    const hurt = p.hp / p.maxHp <= 0.34;

    if (boss) {
      const hp = Math.round(boss.hp);
      if (hp !== bossLogged) { bossLogged = hp; bossHp.push(hp); }
      const d = Math.hypot(boss.x - p.x, boss.y - p.y);
      // Keep a firing band: close when far, back off when it crowds, strafe in between.
      goalKind = 'boss';
      if (hurt && d < 320) goal = { x: p.x + (p.x - boss.x), y: p.y + (p.y - boss.y) };
      else if (d > 300) goal = { x: boss.x, y: boss.y };
      else goal = { x: p.x + (p.y - boss.y) * 0.8, y: p.y + (boss.x - p.x) * 0.8 };
    } else if (exit) {
      goalKind = 'exit';
      // Clear what is shooting at the body before standing in the exit lane.
      goal = hostile && hostile.dist < 230
        ? { x: hostile.body.x, y: hostile.body.y }
        : { x: exit.x + exit.w / 2, y: exit.y + exit.h / 2 };
    } else if (hostile && hostile.dist < 145) {
      goalKind = 'engage';
      // Fight what is close, and back off while doing it when the ring is nearly gone.
      goal = { x: hostile.body.x, y: hostile.body.y };
    } else if (portals.length) {
      goalKind = 'sweep';
      const port = portals.reduce((a: any, b: any) =>
        Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? a : b);
      const cx = port.x + port.w / 2;
      const cy = port.y + port.h / 2;
      const lane = { x: cx - 168, y: cy };
      if (Math.hypot(lane.x - p.x, lane.y - p.y) > 30) goal = lane;
      else { goal = { x: cx, y: cy }; closeIn = false; }
    } else if (hostile) {
      goalKind = 'chase';
      goal = { x: hostile.body.x, y: hostile.body.y };
    } else {
      goalKind = 'wait';
      const room = arena.rooms?.find((r) => r.theme === 'holding');
      goal = room
        ? { x: room.x + room.w * 0.5, y: room.y + room.h * 0.82 }
        : { x: (arena.bounds.left + arena.bounds.right) / 2, y: (arena.bounds.top + arena.bounds.bottom) / 2 };
    }

    let mx = 0;
    let my = 0;
    if (goal) {
      const key = `${Math.round(goal.x / 60)},${Math.round(goal.y / 60)}`;
      if (!route || key !== routeKey || ticks - routeTick > 40) {
        route = floor.path(p.x, p.y, goal.x, goal.y);
        routeKey = key;
        routeTick = ticks;
      }
      let nx = goal.x;
      let ny = goal.y;
      if (!closeIn && Math.hypot(goal.x - p.x, goal.y - p.y) < 40) {
        nx = goal.x;
        ny = goal.y;
      } else if (route && route.length > 1) {
        let i = 1;
        while (i < route.length - 1 && Math.hypot(route[i].x - p.x, route[i].y - p.y) < 34) i++;
        nx = route[i].x;
        ny = route[i].y;
      }
      const dx = nx - p.x;
      const dy = ny - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (closeIn) {
        mx = dx / d;
        my = dy / d;
      } else {
        // Stand and fire. Facing comes from movement, so the approach already points the body
        // at the port; strafing here turned it across the target and no shot ever landed.
        mx = (dx / d) * 0.12;
        my = (dy / d) * 0.12;
      }
    }

    // Defensive play a person actually does: sidestep a shot, dash out of a close one, and
    // put the guard up when the shot is already in front. Standing still in a firing lane
    // with three ports awake is how the first version of this probe died.
    let incoming = false;
    let closestShot = Infinity;
    let shotX = 0;
    let shotY = 0;
    for (const q of world.projectiles ?? []) {
      if (!q || !q.active) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 200) continue;
      if ((q.vx ?? 0) * dx + (q.vy ?? 0) * dy < 0) continue;
      if (d < closestShot) { closestShot = d; shotX = dx; shotY = dy; }
      const fx = Math.cos(p.facing);
      const fy = Math.sin(p.facing);
      if (dx * fx + dy * fy > -0.15 * d) incoming = true;
    }
    let pressed = 0;
    if (incoming) {
      const l = Math.hypot(shotX, shotY) || 1;
      // Sidestep across the shot's line, choosing the side with more floor ahead. A body that
      // sidesteps into the void has dodged the shot and lost the run, so clearance decides.
      const clear = (ddx: number, ddy: number) => {
        for (const step of [70, 120, 170]) if (!floor.walkable(p.x + ddx * step, p.y + ddy * step)) return false;
        return true;
      };
      const a = { x: -shotY / l, y: shotX / l };
      const b = { x: shotY / l, y: -shotX / l };
      const pick = clear(a.x, a.y) ? a : clear(b.x, b.y) ? b : null;
      if (pick) { mx = pick.x; my = pick.y; }
      // Dash only when the whole dash lane is floor; otherwise walk it.
      if (pick && closestShot < 95 && clear(pick.x * 1.6, pick.y * 1.6)) pressed |= ACTION.DASH;
    }
    // Never step off the floor, however the movement above was chosen (a dodge included).
    const stepOk = (ddx: number, ddy: number) =>
      floor.walkable(p.x + ddx * 26, p.y + ddy * 26) && floor.walkable(p.x + ddx * 52, p.y + ddy * 52);
    if ((mx || my) && !stepOk(mx, my)) {
      const alt = [[-my, mx], [my, -mx], [-mx, -my]];
      let fixed = false;
      for (const [ax, ay] of alt) {
        const l = Math.hypot(ax, ay) || 1;
        const nx2 = ax / l;
        const ny2 = ay / l;
        if (stepOk(nx2, ny2)) { mx = nx2; my = ny2; fixed = true; break; }
      }
      if (!fixed) { mx = 0; my = 0; }
    }
    frames[0].mx = mx;
    frames[0].my = my;
    frames[0].pressed = pressed;
    frames[0].held = incoming ? SWING : (ACTION.BOLT | (boss ? ACTION.LOCK : 0));
    world.step(SIM_DT, frames);
    if (ticks % Math.round(20 / SIM_DT) === 0) {
      const nearestPort = portals.length
        ? Math.round(Math.min(...portals.map((b: any) => Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y))))
        : -1;
      console.log(JSON.stringify({
        at: Math.round(ticks * SIM_DT), ph: world.campaignPhase, goal: goalKind,
        ports: `${world.portsClosed}/${world.portTotal}`, openPortals: portals.length, nearestPort,
        kills: world.gauntletKills, hp: p.hp, x: Math.round(p.x), y: Math.round(p.y),
        decks: world.bridgeOpen.map((o: boolean) => (o ? 1 : 0)).join(''),
      }));
    }
  }

  const result: Result = {
    run, level: level.name, phase: world.campaignPhase, seconds: +(ticks * SIM_DT).toFixed(1),
    kills: world.gauntletKills,
    ports: `${world.portsClosed - portsAtStart}/${world.portTotal}`,
    boss: bossHp, deaths, log,
  };
  console.log(JSON.stringify(result));
  if (world.campaignPhase !== 'cleared') {
    throw new Error(`run ${run} ${level.name}: did not clear (phase ${world.campaignPhase}, kills ${world.gauntletKills}/${world.campaignKillsToClear}, ports ${world.portsClosed}/${world.portTotal}, boss hp ${bossHp.slice(-3).join('/') || 'none'})`);
  }
  return result;
}

for (let run = 1; run <= 3; run++) {
  for (const level of PLAYABLE_CAMPAIGN_LEVELS) playLevel(level, run);
  console.log(`run ${run}: BUILD ROOT -> REBOOT -> Mega Worm defeated`);
}
console.log('campaign-playthrough-check: OK (three continuous campaign clears)');
