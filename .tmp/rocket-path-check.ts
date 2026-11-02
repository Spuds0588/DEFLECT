import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';

const arena = ARENAS.find((a) => a.name === 'ROCKET NAVIGATION');
if (!arena || !arena.rocket) throw new Error('ROCKET NAVIGATION missing');
const world = new World('training', ['TEST'], 0, arena);
const anyWorld = world as unknown as {
  rocketProgress: number;
  refreshRocketBarrier: () => void;
  rocketBarrierRects: { x: number; y: number; w: number; h: number }[];
  solids: readonly { x: number; y: number; w: number; h: number }[];
  dashSolids: readonly { x: number; y: number; w: number; h: number }[];
  bouncePillars: (p: unknown) => void;
  projectiles: { active: boolean }[];
};
anyWorld.rocketProgress = 1;
anyWorld.refreshRocketBarrier();
const rects = anyWorld.rocketBarrierRects;
const sameRect = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
for (const r of rects) {
  if (r.h <= 0) continue;
  if (anyWorld.solids.some((s) => sameRect(s, r))) throw new Error('rocket arc still blocks bodies');
  if (anyWorld.dashSolids.some((s) => sameRect(s, r))) throw new Error('rocket arc still stops a dash');
}

// A block whose right-face firing point is clear of cover, so the shot meets only the line.
const clear = (x: number, y: number, pad: number): boolean =>
  !arena.pillars.some((r) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);
const target = rects.find((r) => r.h > 0 && clear(r.x + r.w + 8, r.y + r.h / 2, 8));
if (!target) throw new Error('no clear rocket block found');

const proj = anyWorld.projectiles.find((p) => !p.active) as unknown as Record<string, number | boolean>;
function fire(type: number, owner: number): void {
  proj.active = true;
  proj.x = target!.x + target!.w + 3.5;
  proj.y = target!.y + target!.h * 0.5;
  proj.prevX = proj.x;
  proj.prevY = proj.y;
  proj.vx = -260;
  proj.vy = 0;
  proj.radius = 4;
  proj.type = type;
  proj.owner = owner;
  proj.bounces = 0;
  proj.deflects = 0;
  proj.fuse = 10;
  proj.armed = false;
  anyWorld.bouncePillars(proj);
}

fire(0, 0);
if (!proj.active || proj.bounces !== 1 || !(proj.vx > 0)) throw new Error('player bolt did not reflect off the line');
fire(3, -1);
if (!proj.active || proj.bounces !== 1 || !(proj.vx > 0)) throw new Error('hostile shot did not reflect off the line');
fire(8, 0);
if (!proj.active || proj.bounces !== 0 || !(proj.vx < 0)) throw new Error('bomb should pass the reflector untouched');
console.log('rocket-path-check: OK', { bodies: anyWorld.solids.length, dash: anyWorld.dashSolids.length, segments: rects.length });
