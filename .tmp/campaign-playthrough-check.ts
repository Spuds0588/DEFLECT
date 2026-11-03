/**
 * One continuous campaign playthrough: BUILD ROOT then REBOOT, three runs, three bots.
 *
 * Everything is earned by input: no kill quota, port health, boss health or phase is written.
 * The only affordance a player also has is the on-screen SKIP TUTORIAL.
 *
 * Navigation is deliberately simple so it cannot lie: the body takes the best of eight
 * compass steps that both the floor model and a 26/52-unit look-ahead accept, and walks the
 * BFS route one waypoint at a time. Every rejection is counted and printed, so a stall names
 * its own cause instead of needing to be inferred from positions.
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
const DIRS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

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
  // Match World.inVoid exactly (inclusive edges, no inset). An inset reads every plate/deck
  // junction as a hole, which is how the pilot walked off the intake beside deck A.
  const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
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
  return { walkable, path };
}

type Floor = ReturnType<typeof buildFloor>;

/** Best legal compass step toward a point, or null when every step is refused. */
function pickStep(floor: Floor, p: { x: number; y: number }, tx: number, ty: number, clearance: number) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const l = Math.hypot(dx, dy) || 1;
  const gx = dx / l;
  const gy = dy / l;
  let best: { mx: number; my: number } | null = null;
  let bestScore = -Infinity;
  for (const [cx, cy] of DIRS) {
    const ux = cx / Math.hypot(cx, cy);
    const uy = cy / Math.hypot(cx, cy);
    if (!floor.walkable(p.x + ux * clearance, p.y + uy * clearance)) continue;
    if (!floor.walkable(p.x + ux * clearance * 2, p.y + uy * clearance * 2)) continue;
    const score = ux * gx + uy * gy;
    if (score > bestScore) { bestScore = score; best = { mx: ux, my: uy }; }
  }
  return best;
}

const alive = (t: any) => !!t && t.active !== false && (t.hp === undefined || t.hp > 0);

function nearestHostile(world: any, p: any) {
  let best: any = null;
  let bd = Infinity;
  for (const arr of [world.worms, world.viruses, world.sentries, world.errors]) {
    for (const t of (arr ?? []) as any[]) {
      if (!alive(t) || t.held === true) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < bd) { bd = d; best = t; }
    }
  }
  return best ? { body: best, dist: bd } : null;
}

function playLevel(level: CampaignLevel, run: number) {
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
  let refused = 0;
  let lastDir = 'none';
  const maxTicks = Math.round(420 / SIM_DT);
  const portsAtStart = world.portsClosed;

  while (ticks++ < maxTicks && world.campaignPhase !== 'cleared') {
    if (world.campaignPhase === 'failed') {
      throw new Error(`run ${run} ${level.name}: run failed at ${Math.round(ticks * SIM_DT)}s by killer ${p.killerKind} at ${Math.round(p.x)},${Math.round(p.y)} (${log.slice(-3).join(' | ')})`);
    }
    if (wasAlive && !p.alive) { deaths++; log.push(`${Math.round(ticks * SIM_DT)}s DEATH killer ${p.killerKind}`); }
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
    let kind = 'none';

    if (boss) {
      const hp = Math.round(boss.hp);
      if (hp !== bossLogged) { bossLogged = hp; bossHp.push(hp); }
      const d = Math.hypot(boss.x - p.x, boss.y - p.y);
      kind = 'boss';
      goal = d < 210 ? { x: p.x + (p.x - boss.x), y: p.y + (p.y - boss.y) } : { x: boss.x, y: boss.y };
    } else if (exit) {
      kind = 'exit';
      goal = hostile && hostile.dist < 150
        ? { x: hostile.body.x, y: hostile.body.y }
        : { x: exit.x + exit.w / 2, y: exit.y + exit.h / 2 };
    } else if (hostile && p.hp <= Math.max(1, Math.ceil((p.maxHp ?? 3) * 0.34))) {
      // One segment left in a one-life phase: break contact instead of trading.
      kind = 'retreat';
      const dx = p.x - hostile.body.x;
      const dy = p.y - hostile.body.y;
      const l = Math.hypot(dx, dy) || 1;
      const back = pickStep(floor, p, p.x + (dx / l) * 240, p.y + (dy / l) * 240, 26);
      goal = { x: p.x + (dx / l) * 240, y: p.y + (dy / l) * 240 };
      if (!back) goal = { x: p.x + (dx / l) * 90, y: p.y + (dy / l) * 90 };
    } else if (hostile && hostile.dist < 260) {
      // Hold a firing standoff: bolts reach ~390, so 200 keeps the pack at arm's length.
      kind = 'engage';
      goal = hostile.dist < 170
        ? { x: p.x + ((p.x - hostile.body.x) / hostile.dist) * 140, y: p.y + ((p.y - hostile.body.y) / hostile.dist) * 140 }
        : { x: hostile.body.x, y: hostile.body.y };
    } else if (portals.length) {
      kind = 'sweep';
      const port = portals.reduce((a: any, b: any) =>
        Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? a : b);
      const cx = port.x + port.w / 2;
      const cy = port.y + port.h / 2;
      goal = { x: cx - 168, y: cy };
    } else if (hostile) {
      kind = 'chase';
      goal = { x: hostile.body.x, y: hostile.body.y };
    } else {
      kind = 'wait';
      const room = arena.rooms?.find((r) => r.theme === 'holding');
      goal = room
        ? { x: room.x + room.w / 2, y: room.y + room.h * 0.82 }
        : { x: (arena.bounds.left + arena.bounds.right) / 2, y: (arena.bounds.top + arena.bounds.bottom) / 2 };
    }

    // Route to the goal once per goal cell; follow it one waypoint at a time.
    if (goal) {
      const key = `${Math.round(goal.x / 60)},${Math.round(goal.y / 60)}`;
      if (!route || key !== routeKey || ticks - routeTick > 45) {
        route = floor.path(p.x, p.y, goal.x, goal.y);
        routeKey = key;
        routeTick = ticks;
      }
    }

    let aimX = goal ? goal.x : p.x;
    let aimY = goal ? goal.y : p.y;
    if (route && route.length > 1) {
      let i = 1;
      while (i < route.length - 1 && Math.hypot(route[i].x - p.x, route[i].y - p.y) < CELL * 0.9) i++;
      aimX = route[i].x;
      aimY = route[i].y;
    }

    // Defensive step: measure the closest inbound shot.
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
    let step = pickStep(floor, p, aimX, aimY, 26);
    if (incoming && closestShot < 120) {
      // Step across the shot's line when that side has floor; guard covers the rest.
      const l = Math.hypot(shotX, shotY) || 1;
      const side = pickStep(floor, p, p.x - (shotY / l) * 100, p.y + (shotX / l) * 100, 26);
      if (side) step = side;
      // Dash only when the landing arc is floor: a dash is airborne, so it clears a lip
      // straight into a void if the probe asks it to.
      const ux = step ? step.mx : Math.cos(p.facing);
      const uy = step ? step.my : Math.sin(p.facing);
      if (closestShot < 90 && floor.walkable(p.x + ux * 130, p.y + uy * 130)) pressed |= ACTION.DASH;
    }
    // A body inside melee reach is the one threat the guard cannot answer: shove it off with
    // the lash and dash out of its arc. Backing into a wall just feeds the bite.
    if (hostile && hostile.dist < 95) {
      if (ticks % 18 === 0) pressed |= ACTION.SWING;
      const ax = p.x - hostile.body.x;
      const ay = p.y - hostile.body.y;
      const l = Math.hypot(ax, ay) || 1;
      // The dash travels along the movement vector, so the flee step must *be* that vector
      // and the gate has to look as far as the dash actually carries the body.
      const flee = pickStep(floor, p, p.x + (ax / l) * 220, p.y + (ay / l) * 220, 26);
      if (flee && floor.walkable(p.x + flee.mx * 260, p.y + flee.my * 260)) {
        step = flee;
        pressed |= ACTION.DASH;
        lastDir = `flee ${flee.mx.toFixed(2)},${flee.my.toFixed(2)}`;
      }
    }
    if (!step) refused++;
    lastDir = step ? `${step.mx.toFixed(2)},${step.my.toFixed(2)}` : 'refused';
    frames[0].mx = step ? step.mx : 0;
    frames[0].my = step ? step.my : 0;
    frames[0].pressed = pressed;
    // Target lock keeps facing on the enemy while the body strafes, so bolts leave along
    // the line to the target instead of along the dodge vector.
    frames[0].held = ACTION.BOLT | (hostile && hostile.dist < 460 ? ACTION.LOCK : 0)
      | (incoming && closestShot < 150 ? SWING : 0);
    world.step(SIM_DT, frames);

    if (ticks % Math.round(20 / SIM_DT) === 0) {
      console.log(JSON.stringify({
        at: Math.round(ticks * SIM_DT), ph: world.campaignPhase, goal: kind,
        ports: `${world.portsClosed}/${world.portTotal}`, open: portals.length,
        kills: world.gauntletKills, hp: p.hp, x: Math.round(p.x), y: Math.round(p.y),
        route: route ? route.length : -1, aim: `${Math.round(aimX)},${Math.round(aimY)}`,
        step: lastDir, refused, decks: world.bridgeOpen.map((o: boolean) => (o ? 1 : 0)).join(''),
      }));
    }
  }

  const result = {
    run, level: level.name, phase: world.campaignPhase, seconds: +(ticks * SIM_DT).toFixed(1),
    kills: world.gauntletKills, ports: `${world.portsClosed - portsAtStart}/${world.portTotal}`,
    boss: bossHp, deaths, refusedSteps: refused, log,
  };
  console.log('RESULT ' + JSON.stringify(result));
  if (world.campaignPhase !== 'cleared') {
    throw new Error(`run ${run} ${level.name}: did not clear (phase ${world.campaignPhase}, kills ${world.gauntletKills}/${world.campaignKillsToClear}, ports ${world.portsClosed}/${world.portTotal})`);
  }
}

for (let run = 1; run <= 3; run++) {
  for (const level of PLAYABLE_CAMPAIGN_LEVELS) playLevel(level, run);
  console.log(`run ${run}: BUILD ROOT -> REBOOT -> Mega Worm defeated`);
}
console.log('campaign-playthrough-check: OK (three continuous campaign clears)');
