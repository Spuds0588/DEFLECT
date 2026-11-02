/**
 * CAR NAVIGATION probe: the country-to-city map must keep its buildings clear of the
 * driving route, keep every spawn off cover, and keep the city legs square to the grid.
 */
import { PLAYER, SIM_DT } from '../src/game/config';
import { ARENAS, carRouteLength } from '../src/game/arenas';
import { World } from '../src/game/world';

const fail = (m: string): never => {
  throw new Error(m);
};

const arena = ARENAS.find((a) => a.id === 21) ?? fail('CAR NAVIGATION is missing');
const car = arena.car ?? fail('the arena lost its car block');
const b = arena.bounds;

const routePoint = { x: 0, y: 0 };
const step = Math.max(1, Math.floor(carRouteLength(car) / 900));
const samples: { x: number; y: number }[] = [];
for (let i = 0; i <= 900; i++) {
  // Sample by arc length so long legs and short legs are weighted the same.
  const target = (i / 900) * carRouteLength(car);
  let walked = 0;
  const pts = car.route;
  for (let s = 1; s < pts.length; s++) {
    const seg = Math.hypot(pts[s].x - pts[s - 1].x, pts[s].y - pts[s - 1].y);
    if (walked + seg >= target || s === pts.length - 1) {
      const f = seg > 0.0001 ? (target - walked) / seg : 0;
      routePoint.x = pts[s - 1].x + (pts[s].x - pts[s - 1].x) * f;
      routePoint.y = pts[s - 1].y + (pts[s].y - pts[s - 1].y) * f;
      break;
    }
    walked += seg;
  }
  samples.push({ x: routePoint.x, y: routePoint.y });
}

const rectGap = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
};

// --- district split and grid legs ------------------------------------------
{
  if (car.cityX <= b.left || car.cityX >= b.right) fail('the city split is outside the arena');
  if (car.farmCount <= 0 || car.farmCount >= arena.pillars.length) fail('the farm/city pillar split is wrong');
  if (car.labels.length !== arena.pillars.length) fail('the building label list does not match the pillar list');
  const pts = car.route;
  let cityLegs = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const c = pts[i];
    if (a.x < car.cityX || c.x < car.cityX) continue;
    cityLegs++;
    if (Math.abs(a.x - c.x) > 0.001 && Math.abs(a.y - c.y) > 0.001) {
      fail(`city leg ${i} runs diagonally (${a.x},${a.y})->(${c.x},${c.y})`);
    }
  }
  if (cityLegs < 4) fail(`the route has only ${cityLegs} city legs`);
  if (!(car.gridStep > car.thickness * 2)) fail('the street spacing is too tight for the barrier');
  console.log(JSON.stringify({ districts: { cityX: car.cityX, cityLegs, farms: car.farmCount } }));
}

// --- buildings clear the route ---------------------------------------------
{
  let worst = Infinity;
  let worstIndex = -1;
  for (let i = 0; i < arena.pillars.length; i++) {
    const rect = arena.pillars[i];
    if (rect.x < b.left || rect.y < b.top || rect.x + rect.w > b.right || rect.y + rect.h > b.bottom) {
      fail(`pillar ${i} sits outside the arena`);
    }
    for (const s of samples) {
      const gap = rectGap(s, rect);
      if (gap < worst) {
        worst = gap;
        worstIndex = i;
      }
    }
  }
  const need = car.thickness * 0.5 + PLAYER.radius;
  if (worst < need) fail(`pillar ${worstIndex} is ${worst.toFixed(1)} from the route; need ${need}`);
  console.log(JSON.stringify({ clearance: { worst: Math.round(worst), need: Math.round(need), pillar: worstIndex } }));
}

// --- spawns are clear of cover and the route -------------------------------
{
  let worstCover = Infinity;
  let worstRoute = Infinity;
  for (const spawn of arena.spawns) {
    for (const rect of arena.pillars) {
      worstCover = Math.min(worstCover, rectGap(spawn, rect));
    }
    for (const s of samples) {
      worstRoute = Math.min(worstRoute, Math.hypot(s.x - spawn.x, s.y - spawn.y));
    }
  }
  if (worstCover < PLAYER.radius + 4) fail(`a spawn is ${worstCover.toFixed(1)} from cover`);
  if (worstRoute < 30) fail(`a spawn is ${worstRoute.toFixed(1)} from the driving route`);
  console.log(JSON.stringify({ spawns: { count: arena.spawns.length, cover: Math.round(worstCover), route: Math.round(worstRoute) } }));
}

// --- the bridge sits under the crossing ------------------------------------
{
  let best = Infinity;
  for (const s of samples) best = Math.min(best, rectGap(s, car.bridge));
  if (best > 0.5) fail('the route does not cross the river on the bridge deck');
  console.log(JSON.stringify({ bridge: { x: car.bridge.x, y: car.bridge.y, w: car.bridge.w, h: car.bridge.h } }));
}

// --- trail cap and sampled spacing ----------------------------------------
{
  const world = new World('match', ['A', 'B'], 0, arena);
  const priv = world as any;
  const rects = priv.carBarrierRects as { x: number; y: number; w: number; h: number }[];
  if (rects.length !== car.segments) fail(`the barrier has ${rects.length} blocks instead of ${car.segments}`);
  // Longest sampled gap must stay under one block width, or the wall has a hole.
  const spacing = carRouteLength(car) / car.segments;
  if (spacing > car.thickness) fail(`block spacing ${spacing.toFixed(1)} exceeds thickness ${car.thickness}`);
  priv.tickCar(16);
  const live = rects.filter((r) => r.w > 0).length;
  if (live <= 0) fail('halfway through the route the barrier is empty');
  // One live block covers one sampled spacing of road, not its own square thickness.
  if (live * spacing > car.trailLength + spacing * 2) {
    fail(`the live trail is ${Math.round(live * spacing)} units, over the ${car.trailLength} cap`);
  }
  // A full route pass must never leave the whole length live.
  priv.tickCar(car.duration);
  const atEnd = rects.filter((r) => r.w > 0).length;
  if (atEnd * spacing > carRouteLength(car)) fail('the finished route stays entirely live');
  console.log(
    JSON.stringify({
      barrier: {
        blocks: rects.length,
        spacing: Number(spacing.toFixed(1)),
        liveAtHalf: live,
        liveUnits: Math.round(live * spacing),
        cap: car.trailLength,
      },
    }),
  );
}

// --- stops are ordered and reachable --------------------------------------
{
  let last = 0;
  for (const stop of car.stops) {
    if (stop.at <= last || stop.at > 1) fail(`stop ${stop.label} is out of order at ${stop.at}`);
    last = stop.at;
  }
  if (car.duration <= 0) fail('the route has no duration');
  console.log(JSON.stringify({ stops: car.stops.map((s) => `${s.label}@${s.at}`), duration: car.duration }));
}

void step;
void SIM_DT;
console.log('car-arena-check: OK');
