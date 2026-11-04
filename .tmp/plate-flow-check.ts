/**
 * Plate flow: every authored plate arena must be entered on its open left side and left on
 * its right, and no bridge landing may sit inside cover or a sealed cell block.
 *
 * Everything here is read from the same data the renderer and the body solver use:
 * `islands`, `rooms`, `bridges`, `pillars`, `port` and `holdingCellLayout`. A plate that
 * needs a different flow has to be listed in EXCEPTIONS with the reason, so an accident
 * cannot pass as a design choice.
 *
 * Run with `npx tsx .tmp/plate-flow-check.ts`.
 */
import { ARENAS, holdingCellLayout } from '../src/game/arenas';
import type { ArenaDef, Rect } from '../src/game/arenas';

/** Plates whose route is deliberately not left-to-right, with the reason. */
const EXCEPTIONS: Record<number, string> = {
  32: 'CAPCOM: a four-plate ring, every deck open by design, so the route has no single exit; entry is the left plate',
  5: 'TRANSIT: a chasm arena crossed by pads (west) and lifts (east); the deck is the route, not a plate ring',
};

const inside = (r: Rect, x: number, y: number) =>
  x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;

/**
 * Decks abut a plate's edge rather than overlapping it, so touching is tested with a
 * two-unit inflation: a deck that stops short of the floor is the bug this must catch,
 * and a real overlap still reads as touching.
 */
const hits = (a: Rect, b: Rect) =>
  a.x - 2 < b.x + b.w && a.x + a.w + 2 > b.x && a.y - 2 < b.y + b.h && a.y + a.h + 2 > b.y;

/** The powered cell block in a holding plate, straight from the shared layout. */
function cellBlocks(arena: ArenaDef): Rect[] {
  const room = arena.rooms?.find((r) => r.theme === 'holding');
  if (!room) return [];
  const l = holdingCellLayout(room);
  return [{ x: l.left, y: l.top, w: l.cellW * 3, h: l.bottom - l.top }];
}

function plateOf(arena: ArenaDef): Rect[] {
  return arena.islands ?? [];
}

let checked = 0;
const problems: string[] = [];

for (const arena of ARENAS) {
  const plates = plateOf(arena);
  const bridges = arena.bridges ?? [];
  if (plates.length === 0) {
    if (!arena.rooms) continue;
    // A campaign device is one continuous floor: its rooms are painted plates, and the
    // route is a walk from the entry spawn to the party port, not a deck graph.
    const tag = `${arena.id} ${arena.name}`;
    if (bridges.length > 0) problems.push(`${tag}: single-floor device still declares bridge decks`);
    // A one-room tutorial arena is portal-fed: it has no party port, because the clear
    // opens the right-wall portal itself. There is no left-to-right plate route to check.
    if (!arena.port && arena.rooms.length === 1) {
      console.log(`${tag}: portal-fed room (one room, no party port, right-wall exit)`);
      checked++;
      continue;
    }
    const blocked: Rect[] = [...(arena.pillars ?? []), ...cellBlocks(arena)];
    const b = arena.bounds;
    const step = 24;
    const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
    const walk = (x: number, y: number) =>
      x > b.left && x < b.right && y > b.top && y < b.bottom && !blocked.some((r) => inside(r, x, y));
    const spawn = arena.spawns?.[0];
    const port = arena.port;
    if (!spawn || !port) {
      problems.push(`${tag}: missing entry spawn or party port`);
      continue;
    }
    const seen = new Set<string>([key(spawn.x, spawn.y)]);
    const queue: [number, number][] = [[spawn.x, spawn.y]];
    while (queue.length) {
      const [x, y] = queue.pop()!;
      for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]] as [number, number][]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!walk(nx, ny)) continue;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
    let nearest = Infinity;
    for (const k of seen) {
      const [x, y] = k.split(',').map(Number);
      nearest = Math.min(nearest, Math.hypot(x - port.x, y - port.y));
    }
    if (nearest > 24) problems.push(`${tag}: party port is ${Math.round(nearest)} from the nearest walkable cell`);
    if (port.x <= spawn.x) problems.push(`${tag}: party port is not right of the entry spawn`);
    console.log(`${tag}: single floor, ${arena.rooms.length} rooms, spawn -> port ${Math.round(nearest)}`);
    checked++;
    continue;
  }
  if (bridges.length === 0 && !arena.traverse) continue;

  const tag = `${arena.id} ${arena.name}`;
  const blocked: Rect[] = [...(arena.pillars ?? []), ...(arena.traverse?.chasms ?? []), ...cellBlocks(arena)];

  // Every deck must land on two different plates, on open floor.
  for (const b of bridges) {
    const touching = plates.filter((p) => hits(p, b));
    if (plates.length && touching.length < 2) {
      problems.push(`${tag}: bridge ${b.label ?? '?'} at ${b.x},${b.y} touches ${touching.length} plate(s), needs two`);
    }
    // Landing points sit just inside each plate the deck reaches.
    for (const p of touching) {
      const cx = Math.min(Math.max(b.x + b.w * 0.5, p.x + 24), p.x + p.w - 24);
      const cy = Math.min(Math.max(b.y + b.h * 0.5, p.y + 24), p.y + p.h - 24);
      const land = { x: cx, y: cy };
      for (const solid of blocked) {
        if (inside(solid, land.x, land.y)) {
          problems.push(`${tag}: bridge ${b.label ?? '?'} lands inside solids at ${Math.round(cx)},${Math.round(cy)}`);
        }
      }
    }
    // A deck must not be swallowed by a plate's cover either: its own footprint stays clear.
    for (const solid of blocked) {
      if (hits(solid, b) && !(arena.traverse?.chasms ?? []).some((c) => hits(c, b))) {
        problems.push(`${tag}: bridge ${b.label ?? '?'} overlaps cover at ${solid.x},${solid.y}`);
      }
    }
  }

  if (EXCEPTIONS[arena.id]) {
    console.log(`${tag}: documented exception // ${EXCEPTIONS[arena.id]}`);
    checked++;
    continue;
  }

  // Primary route: entry plate holds spawn 0, exit plate holds the network port.
  const spawn = arena.spawns?.[0];
  const entry = spawn ? plates.find((p) => inside(p, spawn.x, spawn.y)) : undefined;
  const port = arena.port;
  const exit = port ? plates.find((p) => inside(p, port.x, port.y)) : undefined;
  if (!entry || !exit) {
    problems.push(`${tag}: cannot resolve entry/exit plates (entry ${!!entry}, exit ${!!exit})`);
    continue;
  }
  // Reachability over the deck graph.
  const adj = new Map<Rect, Rect[]>();
  for (const p of plates) adj.set(p, []);
  for (const b of bridges) {
    const t = plates.filter((p) => hits(p, b));
    for (const a of t) for (const c of t) if (a !== c) adj.get(a)!.push(c);
  }
  const seen = new Set<Rect>([entry]);
  const queue: Rect[] = [entry];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of adj.get(cur) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  }
  if (!seen.has(exit)) problems.push(`${tag}: no deck route from the entry plate to the exit plate`);
  const entryMid = entry.x + entry.w * 0.5;
  const exitMid = exit.x + exit.w * 0.5;
  if (exitMid <= entryMid) {
    problems.push(`${tag}: exit plate ${Math.round(exitMid)} is not right of the entry plate ${Math.round(entryMid)}`);
  }
  console.log(
    `${tag}: entry ${Math.round(entryMid)} -> exit ${Math.round(exitMid)} over ${bridges.length} decks (${plates.length} plates)`,
  );
  checked++;
}

console.log(`plates checked: ${checked}`);
if (problems.length) {
  for (const p of problems) console.log('FAIL ' + p);
  process.exit(1);
}
console.log('plate-flow-check: OK (entry left, exit right, decks on open floor)');
