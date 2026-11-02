/** AIR TRAFFIC probe: a radar disc, slow sweep, and aircraft that hurt what they cross. */
import { ARENAS, arenaIndexById } from '../src/game/arenas';
import { World } from '../src/game/world';

const fail = (m: string): never => {
  throw new Error(m);
};

const arena = ARENAS[arenaIndexById(33)];
if (arena.name !== 'AIR TRAFFIC') fail(`arena 33 is ${arena.name}`);
const radar = arena.radar ?? fail('AIR TRAFFIC has no radar');
if (radar.sweepPeriod < 8) fail('the sweep is not slow');
if (radar.planes.length < 4) fail('too little traffic');
for (const plane of radar.planes) {
  if (plane.entry <= radar.radius) fail(`${plane.tag} does not start off the scope`);
  if (plane.speed < 200) fail(`${plane.tag} crawls`);
  // Every pass must actually cross the disc, or it is decoration.
  const offset = Math.abs(Math.sin(plane.heading - plane.bearing - Math.PI));
  if (plane.entry * offset > radar.radius - plane.radius) fail(`${plane.tag} never crosses the scope`);
}

const world = new World('gauntlet', ['SCOPE'], 0, arena);
const inVoid = (world as any).inVoid.bind(world) as (x: number, y: number) => boolean;
if (inVoid(radar.cx, radar.cy)) fail('the scope centre is not floor');
if (!inVoid(radar.cx + radar.radius + 12, radar.cy)) fail('the floor does not end at the scope rim');
if (inVoid(radar.cx + radar.radius - 12, radar.cy)) fail('the inner rim is not floor');
for (const s of arena.spawns) if (inVoid(s.x, s.y)) fail(`spawn ${s.x},${s.y} is off the scope`);
for (const p of arena.pillars) {
  const corners = [
    [p.x, p.y],
    [p.x + p.w, p.y],
    [p.x, p.y + p.h],
    [p.x + p.w, p.y + p.h],
  ];
  for (const [x, y] of corners) if (inVoid(x, y)) fail('a console hangs off the scope');
}

const player = world.players[0];
player.x = radar.cx;
player.y = radar.cy;
player.hp = player.maxHp;
const before = player.hp;
let firstHit = -1;
for (let i = 0; i < 60 * 40 && firstHit < 0; i++) {
  (world as any).tickRadar(1 / 60);
  if (player.hp < before) firstHit = i;
}
if (firstHit < 0) fail('no aircraft hit a body standing on the centre line');
const afterFirst = player.hp;
if (before - afterFirst !== radar.damage) fail(`one pass took ${before - afterFirst} segments`);
for (let i = 0; i < 240; i++) (world as any).tickRadar(1 / 60);
if (player.hp < afterFirst) fail('one aircraft hit the same body twice in a pass');
if (!(world.radarT > 0)) fail('the sweep clock did not advance');
console.log('radar-check: OK');
