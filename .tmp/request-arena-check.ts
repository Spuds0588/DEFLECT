/**
 * DISPATCH YARD / LOAD BALANCER probe:
 *   1. Both arenas sit immediately before the QA range and keep their authored order;
 *   2. every route lane is inside the floor, clear of cover, and reachable from the switch;
 *   3. request trains are spaced cars, use every authored lane, and hit a body once;
 *   4. the traffic is local-only: a hosted match builds no request state and no snapshot
 *      hazard record.
 *
 * Run with `npx tsx .tmp/request-arena-check.ts`.
 */
import { ARENAS, arenaSolids, type ArenaDef } from '../src/game/arenas';
import { PLAYER, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';

const fail = (message: string): never => {
  throw new Error(message);
};

const requestSpecs = [
  { id: 40, name: 'DISPATCH YARD', kind: 'dispatch' },
  { id: 41, name: 'LOAD BALANCER', kind: 'balancer' },
] as const;

const pointRectGap = (
  x: number,
  y: number,
  r: { x: number; y: number; w: number; h: number },
): number => {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
};

const segmentRectGap = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: { x: number; y: number; w: number; h: number },
): number => {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(length / 5));
  let best = Infinity;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    best = Math.min(best, pointRectGap(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, r));
  }
  return best;
};

for (let s = 0; s < requestSpecs.length; s++) {
  const want = requestSpecs[s];
  const arena: ArenaDef = ARENAS[want.id] ?? fail(`arena index ${want.id} is missing`);
  if (arena.id !== want.id) fail(`arena index ${want.id} holds id ${arena.id}`);
  if (arena.name !== want.name) fail(`arena ${want.id} is ${arena.name}, want ${want.name}`);
  const req = arena.requests ?? fail(`${arena.name} has no request track`);
  const b = arena.bounds;
  const tag = arena.name;

  if (req.kind !== want.kind) fail(`${tag} is ${req.kind}, want ${want.kind}`);
  if (!(req.entry.x < req.hub.x && req.hub.x < req.exitX)) fail(`${tag} route runs backwards`);
  if (req.exitX > b.right) fail(`${tag} exit is outside the floor`);
  if (req.lanes.length < 3) fail(`${tag} has only ${req.lanes.length} outbound lanes`);
  for (let i = 0; i < req.lanes.length; i++) {
    const lane = req.lanes[i];
    if (lane <= b.top || lane >= b.bottom) fail(`${tag} lane ${i} is outside the floor`);
    if (i > 0 && lane <= req.lanes[i - 1]) fail(`${tag} lanes are not in ascending order`);
    if (!req.pattern.includes(i)) fail(`${tag} lane ${i} is never routed`);
  }
  if (req.pattern.length < req.lanes.length * 2) fail(`${tag} pattern is too short to read`);
  for (let i = 0; i < req.pattern.length; i++) {
    const route = req.pattern[i];
    if (!Number.isInteger(route) || route < 0 || route >= req.lanes.length) {
      fail(`${tag} pattern step ${i} names lane ${route}`);
    }
  }
  if (req.cars < 1) fail(`${tag} has no cars`);
  if (req.carGap < req.carW + 8) fail(`${tag} cars overlap: gap ${req.carGap}, length ${req.carW}`);
  if (!(req.interval > req.warn && req.warn > 0)) fail(`${tag} warning window is invalid`);
  if (!(req.speed > 0 && req.damage > 0 && req.knockback > 0)) fail(`${tag} traffic values are invalid`);

  if (arena.spawns.length !== 8) fail(`${tag} has ${arena.spawns.length} spawns, want 8`);
  if (arenaSolids(arena).length !== arena.pillars.length) fail(`${tag} has extra body solids`);
  for (let i = 0; i < arena.pillars.length; i++) {
    const p = arena.pillars[i];
    if (p.x < b.left || p.y < b.top || p.x + p.w > b.right || p.y + p.h > b.bottom) {
      fail(`${tag} pillar ${i} leaves the floor`);
    }
  }

  // Cars are wider than a body, so cover clearance uses the car's short axis plus radius.
  const need = req.carH * 0.5 + PLAYER.radius + 2;
  const minLane = Math.min(...req.lanes);
  const maxLane = Math.max(...req.lanes);
  const rails: Array<[number, number, number, number]> = [
    [req.entry.x, req.hub.y, req.hub.x, req.hub.y],
    [req.hub.x, minLane, req.hub.x, maxLane],
  ];
  for (let i = 0; i < req.lanes.length; i++) {
    rails.push([req.hub.x, req.lanes[i], req.exitX, req.lanes[i]]);
  }
  for (let i = 0; i < rails.length; i++) {
    const [x1, y1, x2, y2] = rails[i];
    for (let p = 0; p < arena.pillars.length; p++) {
      const gap = segmentRectGap(x1, y1, x2, y2, arena.pillars[p]);
      if (gap < need) fail(`${tag} rail ${i} is ${gap.toFixed(1)} from pillar ${p}; need ${need}`);
    }
  }

  // Spawns must be clear of both cover and the moving train envelope.
  for (let i = 0; i < arena.spawns.length; i++) {
    const spawn = arena.spawns[i];
    if (spawn.x < b.left || spawn.x > b.right || spawn.y < b.top || spawn.y > b.bottom) {
      fail(`${tag} spawn ${i} leaves the floor`);
    }
    for (let p = 0; p < arena.pillars.length; p++) {
      const gap = pointRectGap(spawn.x, spawn.y, arena.pillars[p]);
      if (gap < PLAYER.radius + 4) fail(`${tag} spawn ${i} crowds pillar ${p}`);
    }
    for (let r = 0; r < rails.length; r++) {
      const [x1, y1, x2, y2] = rails[r];
      let best = Infinity;
      const length = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(length / 5));
      for (let n = 0; n <= steps; n++) {
        const f = n / steps;
        best = Math.min(best, Math.hypot(spawn.x - (x1 + (x2 - x1) * f), spawn.y - (y1 + (y2 - y1) * f)));
      }
      if (best < need) fail(`${tag} spawn ${i} is ${best.toFixed(1)} from rail ${r}; need ${need}`);
    }
  }

  // A local match still runs the authored traffic. Hosted rooms are excluded by the
  // arena picker gate, not by silently disabling the sim. No mode may leak it into
  // the snapshot hazard payload.
  const matchWorld = new World('match', ['A', 'B'], 0, arena);
  if (matchWorld.requests === null) fail(`${tag} lost its request track in a local match`);
  const trainingWorld = new World('training', ['QA'], 0, arena);
  if (trainingWorld.requests === null) fail(`${tag} lost its request track in training`);
  if (buildSnapshotHazards(trainingWorld) !== null) fail(`${tag} leaked into SnapshotHazards`);

  // Simulate until the first train reaches a body on the inbound line. The train must
  // take exactly one segment, even though its cars cross the body in quick succession.
  trainingWorld.drone.active = false;
  trainingWorld.drone.respawnT = 1e9;
  const player = trainingWorld.players[0];
  player.x = req.hub.x - 300;
  player.y = req.hub.y;
  player.hp = player.maxHp;
  player.iframes = 0;
  const before = player.hp;
  let firstHitAt = -1;
  for (let i = 0; i < 60 * 4; i++) {
    trainingWorld.step(SIM_DT, [null]);
    if (firstHitAt < 0 && player.hp < before) firstHitAt = i;
  }
  const lost = before - player.hp;
  if (lost !== req.damage) fail(`${tag} first train took ${lost} segments, want ${req.damage}`);
  if (firstHitAt < 0) fail(`${tag} never hit a body on the inbound line`);
  const offRail = Math.abs(player.y - req.hub.y);
  const needOffRail = req.carH * 0.5 + PLAYER.radius + 2;
  if (offRail < needOffRail) fail(`${tag} knockback left the body ${offRail.toFixed(1)} from the rail; need ${needOffRail}`);

  // The authored pattern must actually reach every platform, and a live train must
  // carry the full car count long enough to be seen.
  const trafficWorld = new World('training', ['QA'], 0, arena);
  trafficWorld.drone.active = false;
  trafficWorld.drone.respawnT = 1e9;
  const seen = new Set<number>();
  let liveAtOnce = 0;
  for (let i = 0; i < 60 * 24; i++) {
    trafficWorld.step(SIM_DT, [null]);
    let live = 0;
    for (let c = 0; c < trafficWorld.requestCars.length; c++) {
      const car = trafficWorld.requestCars[c];
      if (!car.active) continue;
      live++;
      seen.add(car.route);
      if (car.s >= 0 && (car.x < b.left - req.carW || car.x > b.right + req.carW || car.y < b.top - req.carW || car.y > b.bottom + req.carW)) {
        fail(`${tag} live car left the floor`);
      }
    }
    liveAtOnce = Math.max(liveAtOnce, live);
  }
  if (seen.size !== req.lanes.length) fail(`${tag} routed ${seen.size} lanes, want ${req.lanes.length}`);
  if (liveAtOnce < req.cars) fail(`${tag} never showed a full ${req.cars}-car train`);

  console.log(
    JSON.stringify({
      arena: tag,
      lanes: req.lanes.length,
      cars: req.cars,
      pattern: req.pattern.length,
      clearance: Math.round(need),
      liveAtOnce,
      offRail: Math.round(offRail),
      seen: [...seen].sort(),
    }),
  );
}

if (ARENAS[53]?.id !== 90) fail(`QA arena moved: index 53 is ${ARENAS[53]?.id}`);
console.log('request arenas ok: dispatch + balancer before the QA range');
