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
// The level-2 fight is flown by the game's own bot brain, the same pilot the gauntlet
// attract hook uses; the level-1 port sweep stays on the probe's route follower.
import { BotBrain } from '../src/game/bot';
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
  let fam = '?';
  for (const [name, arr] of [['worm', world.worms], ['virus', world.viruses], ['sentry', world.sentries], ['error', world.errors]] as any[]) {
    for (const t of (arr ?? []) as any[]) {
      if (!alive(t) || t.held === true) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < bd) { bd = d; best = t; fam = name; }
    }
  }
  return best ? { body: best, dist: bd, fam } : null;
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
  // Every slot gets the shipped brain. The bots used to stand still while only the pilot
  // fought, which is not a multi-bot run: the level-2 boss was being soloed.
  const brains: (BotBrain | null)[] = new Array(MAX_PLAYERS).fill(null);
  brains[0] = level.boss !== undefined
    ? new BotBrain(0, 'impossible', 0, 0x51f15e + arena.id * 983 + 29)
    : null;
  for (let i = 1; i < MAX_PLAYERS; i++) {
    brains[i] = new BotBrain(i, 'digital', i - 1, 0x51f15e + arena.id * 997 + i * 131);
  }
  const brain = brains[0];
  const driveBots = () => {
    for (let i = 1; i < MAX_PLAYERS; i++) {
      const b = brains[i];
      const pl = world.players[i];
      if (b && pl && pl.active && pl.alive) b.think(world, frames[i], SIM_DT);
      else { frames[i].mx = 0; frames[i].my = 0; frames[i].held = 0; frames[i].pressed = 0; }
    }
  };
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
  const damage: any[] = [];
  const heals: any[] = [];
  let assaultEntryHp = -1;
  let bossSpawn: any = null;
  let hpBeforeStep = p.hp;
  let lastDir = 'none';
  const maxTicks = Math.round(420 / SIM_DT);
  const portsAtStart = world.portsClosed;

  while (ticks++ < maxTicks && world.campaignPhase !== 'cleared') {
    if (world.campaignPhase === 'failed') {
      console.log('DIAG ' + JSON.stringify({
        run, level: level.name, at: Math.round(ticks * SIM_DT), killer: p.killerKind,
        assaultEntryHp, heals, hp: p.hp, maxHp: p.maxHp,
        damage: damage.slice(-12), log,
        live: (world.worms ?? []).concat(world.viruses ?? [], world.sentries ?? [], world.errors ?? [])
          .filter((t: any) => t.active !== false && (t.hp === undefined || t.hp > 0))
          .map((t: any) => ({ k: t.kind ?? t.bossKind ?? 'w', hp: Math.round(t.hp ?? -1), d: Math.round(Math.hypot(t.x - p.x, t.y - p.y)) })).slice(0, 10),
        kills: world.gauntletKills, need: world.campaignKillsToClear,
      }));
      throw new Error(`run ${run} ${level.name}: run failed at ${Math.round(ticks * SIM_DT)}s by killer ${p.killerKind} at ${Math.round(p.x)},${Math.round(p.y)} (${log.slice(-3).join(' | ')})`);
    }
    if (wasAlive && !p.alive) { deaths++; log.push(`${Math.round(ticks * SIM_DT)}s DEATH killer ${p.killerKind}`); }
    wasAlive = p.alive;
    if (world.campaignPhase !== lastPhase) {
      log.push(`${Math.round(ticks * SIM_DT)}s ${world.campaignPhase} kills ${world.gauntletKills}/${world.campaignKillsToClear} ports ${world.portsClosed}/${world.portTotal} hp ${p.hp}/${p.maxHp}`);
      if (world.campaignPhase === 'assault' && assaultEntryHp < 0) assaultEntryHp = p.hp;
      lastPhase = world.campaignPhase;
    }
    if (priv.tutorial && !priv.tutorial.done) world.skipTutorial();
    if (!p.alive) { world.step(SIM_DT, frames); continue; }

    if (brain) {
      const hpPrev = p.hp;
      brain.think(world, frames[0], SIM_DT);
      // The shipped brain does not know about pickups or about a one-segment pool. A player
      // does: at one segment it goes for the RESTORE drop, and with none on the floor it
      // backs out of melee instead of trading the last segment.
      const rest = (world.pickups ?? []).find((k: any) => k.active && k.kind === 0);
      if (rest && p.hp < (p.maxHp ?? 3)) {
        const rdx = rest.x - p.x;
        const rdy = rest.y - p.y;
        const rd = Math.hypot(rdx, rdy) || 1;
        if (rd > 10) { frames[0].mx = rdx / rd; frames[0].my = rdy / rd; }
      } else if (p.hp <= 1) {
        const near = nearestHostile(world, p);
        if (near && near.dist < 220) {
          frames[0].mx = (p.x - near.body.x) / (near.dist || 1);
          frames[0].my = (p.y - near.body.y) / (near.dist || 1);
        }
      }
      driveBots();
      world.step(SIM_DT, frames);
      if (p.hp < hpPrev) {
        let near: any = null;
        let nd = Infinity;
        for (const w of (world.worms ?? []) as any[]) {
          if (!w.active) continue;
          const d = Math.hypot(w.x - p.x, w.y - p.y);
          if (d < nd) { nd = d; near = { d: Math.round(d), boss: (w.bossKind ?? -1) >= 0 ? 1 : 0, hp: Math.round(w.hp), v: Math.round(Math.hypot(w.vx ?? 0, w.vy ?? 0)) }; }
        }
        damage.push({ t: Math.round(ticks * SIM_DT), ph: world.campaignPhase, from: hpPrev, to: p.hp, by: 'brain', extra: frames[0].held, dash: (p as any).dashCharges ?? -1, near });
      } else if (p.hp > hpPrev) {
        heals.push({ t: Math.round(ticks * SIM_DT), from: hpPrev, to: p.hp });
      }
      const liveBoss = (world.worms ?? []).find((w: any) => w.active && w.bossKind !== undefined);
      if (liveBoss && !bossSpawn) {
        bossSpawn = { t: Math.round(ticks * SIM_DT), x: Math.round(liveBoss.x), y: Math.round(liveBoss.y), d: Math.round(Math.hypot(liveBoss.x - p.x, liveBoss.y - p.y)), hp: Math.round(liveBoss.hp) };
        console.log('BOSS ' + JSON.stringify(bossSpawn));
      }
      if (liveBoss) {
        const hp = Math.round(liveBoss.hp);
        if (hp !== bossLogged) { bossLogged = hp; bossHp.push(hp); }
      }
      if (ticks % Math.round(15 / SIM_DT) === 0) {
        console.log(JSON.stringify({
          at: Math.round(ticks * SIM_DT), ph: world.campaignPhase, pilot: 'brain',
          kills: world.gauntletKills, hp: p.hp, boss: liveBoss ? Math.round(liveBoss.hp) : -1,
          warn: (world as any).campaignWarnStep ? 1 : 0,
        }));
      }
      continue;
    }

    const boss = level.boss !== undefined ? world.worms.find((w: any) => w.active && w.bossKind === level.boss) : undefined;
    const assault = world.campaignPhase === 'assault';
    const portals = assault ? world.props.filter((b: any) => b.portal && !b.portalExit && b.active && b.hp > 0) : [];
    const exit = assault ? world.props.find((b: any) => b.portalExit && b.active) : undefined;
    const hostile = nearestHostile(world, p);

    let goal: { x: number; y: number } | null = null;
    let kind = 'none';
    // Healing is part of playing the game, not an injected state: RESTORE_STATUS heals
    // are live pickups in a campaign run, so a competent pilot goes and takes one.
    const restore = (world.pickups ?? []).find((k: any) => k.active && k.kind === 0);
    const restoreD = restore ? Math.hypot(restore.x - p.x, restore.y - p.y) : Infinity;
    const restless = p.hp < (p.maxHp ?? 3);

    if (restore && restless && restoreD < 1500 && (!boss || p.hp <= 1)) {
      kind = 'heal';
      goal = { x: restore.x, y: restore.y };
    } else if (boss) {
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
    } else if (hostile && hostile.dist < 430) {
      // Hold a firing standoff. Every kit here shoots, so there is no reason to stand inside
      // a bite: melee families get more room than shooters, and the body only closes the gap
      // when it is outside its own hold range.
      kind = 'engage';
      const want = hostile.fam === 'worm' ? 300 : hostile.fam === 'virus' ? 260 : 235;
      goal = hostile.dist < want - 30
        ? { x: p.x + ((p.x - hostile.body.x) / hostile.dist) * 160, y: p.y + ((p.y - hostile.body.y) / hostile.dist) * 160 }
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
      // A dash spent on a shot that would have missed is a dash unavailable for the bite
      // that lands. Hold the charges unless the body is already down to its last segment.
      const charges = (p as any).dashCharges ?? (p as any).dashLeft ?? 2;
      if (closestShot < 90 && charges > 0 && p.hp <= 1 && floor.walkable(p.x + ux * 130, p.y + uy * 130)) pressed |= ACTION.DASH;
    }
    // A body inside melee reach is the one threat the guard cannot answer: shove it off with
    // the lash and dash out of its arc. Backing into a wall just feeds the bite.
    if (hostile && hostile.dist < 78) {
      // One shove to break the bite, not a swing every third tick: a swing locks facing,
      // halves movement and adds recovery lag, so spamming it is how the fourth kill stalls.
      if (p.hp <= 1) pressed |= ACTION.SWING;
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
    const hpPrev = p.hp;
    driveBots();
    world.step(SIM_DT, frames);
    if (p.hp < hpPrev) {
      damage.push({
        t: Math.round(ticks * SIM_DT), ph: world.campaignPhase, from: hpPrev, to: p.hp,
        by: hostile ? ((hostile.body as any).kind ?? (hostile.body as any).bossKind ?? '?') : '-',
        dist: hostile ? Math.round(hostile.dist) : -1,
        dash: (p as any).dashCharges ?? (p as any).dashLeft ?? -1,
        guard: (frames[0].held & SWING) !== 0,
        healing: restore ? Math.round(restoreD) : -1,
      });
    } else if (p.hp > hpPrev) {
      heals.push({ t: Math.round(ticks * SIM_DT), from: hpPrev, to: p.hp });
    }

    if (ticks % Math.round(20 / SIM_DT) === 0) {
      console.log(JSON.stringify({
        at: Math.round(ticks * SIM_DT), ph: world.campaignPhase, goal: kind,
        ports: `${world.portsClosed}/${world.portTotal}`, open: portals.length,
        kills: world.gauntletKills, hp: p.hp, x: Math.round(p.x), y: Math.round(p.y),
        route: route ? route.length : -1, aim: `${Math.round(aimX)},${Math.round(aimY)}`,
        step: lastDir, refused, decks: world.bridgeOpen.map((o: boolean) => (o ? 1 : 0)).join(''),
        heal: restore ? Math.round(restoreD) : -1,
        picks: (world.pickups ?? []).filter((k: any) => k.active).length,
      }));
    }
  }

  const result = {
    run, level: level.name, phase: world.campaignPhase, seconds: +(ticks * SIM_DT).toFixed(1),
    assaultEntryHp, heals, bossSpawn, damage: damage.slice(0, 14),
    kills: world.gauntletKills, ports: `${world.portsClosed - portsAtStart}/${world.portTotal}`,
    boss: bossHp, deaths, refusedSteps: refused, log,
  };
  console.log('RESULT ' + JSON.stringify(result));
  if (world.campaignPhase !== 'cleared') {
    throw new Error(`run ${run} ${level.name}: did not clear (phase ${world.campaignPhase}, kills ${world.gauntletKills}/${world.campaignKillsToClear}, ports ${world.portsClosed}/${world.portTotal})`);
  }
}

// Diagnostic filters for iterating one level; the closing criterion runs the full chain.
const ONLY = Number(process.env.LEVEL ?? -1);
const RUNS = Number(process.env.RUNS ?? 3);
let cleared = 0;
let failed = 0;
for (let run = 1; run <= RUNS; run++) {
  try {
    for (const level of PLAYABLE_CAMPAIGN_LEVELS) {
      if (ONLY >= 0 && level.id !== ONLY) continue;
      playLevel(level, run);
    }
    cleared++;
  } catch (err) {
    failed++;
    console.log('RUNFAIL ' + (err as Error).message);
  }
  if (ONLY < 0) console.log(`run ${run}: BUILD ROOT -> REBOOT -> Mega Worm defeated`);
}
console.log(`campaign-playthrough-check: ${cleared} cleared, ${failed} failed of ${RUNS} continuous runs`);
if (ONLY < 0 && cleared < RUNS) throw new Error('not every continuous run cleared');
