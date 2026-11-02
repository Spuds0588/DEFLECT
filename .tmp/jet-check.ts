/** WEAPON SYSTEMS probe: the fighter silhouette is real jet geometry, shared by both draws. */
import { readFileSync } from 'node:fs';
import { ARENAS, FIGHTER_SIDE, arenaIndexById } from '../src/game/arenas';

const fail = (m: string): never => {
  throw new Error(m);
};

const names = FIGHTER_SIDE.map((s) => s.name);
for (const required of ['fuselage', 'canopy', 'wing', 'fin', 'stabilizer', 'nozzle', 'intake']) {
  if (!names.includes(required as (typeof names)[number])) fail(`the jet is missing its ${required}`);
}
if (FIGHTER_SIDE.length !== names.length) fail('duplicate silhouette parts');
if (FIGHTER_SIDE.length < 8) fail(`expected at least 8 parts, got ${FIGHTER_SIDE.length}`);

for (const shape of FIGHTER_SIDE) {
  if (!shape.closed) fail(`${shape.name} should be a closed outline`);
  if (shape.points.length < 3) fail(`${shape.name} has too few points to be a shape`);
  for (const [x, y] of shape.points) {
    if (x < 0 || x > 1.02) fail(`${shape.name} escapes the box on x (${x})`);
    if (Math.abs(y) > 0.2) fail(`${shape.name} is too tall for a side profile (${y})`);
  }
}

const part = (name: string) => FIGHTER_SIDE.find((s) => s.name === name) ?? fail(`missing ${name}`);
const xs = (points: readonly (readonly [number, number])[]) => points.map((p) => p[0]);
const ys = (points: readonly (readonly [number, number])[]) => points.map((p) => p[1]);

// Nose at the front, tail at the back.
const fuselage = part('fuselage');
if (Math.min(...xs(fuselage.points)) > 0.06) fail('the nose is blunt');
if (Math.max(...xs(fuselage.points)) < 0.9) fail('the fuselage does not reach the tail');
// A canopy sits high and forward, not on the spine.
const canopy = part('canopy');
if (Math.min(...ys(canopy.points)) > -0.05) fail('the canopy has no bubble');
if (Math.max(...xs(canopy.points)) > 0.5) fail('the canopy is behind the wing root');
// The vertical fin is tall and aft.
const fin = part('fin');
if (Math.min(...ys(fin.points)) > -0.12) fail('the fin is a stub');
if (Math.min(...xs(fin.points)) < 0.55) fail('the fin is too far forward for a fighter');
// The wing sweeps back: its lowest point is further aft than its root.
const wing = part('wing');
const low = wing.points.reduce((a, b) => (b[1] > a[1] ? b : a));
const root = wing.points.reduce((a, b) => (b[1] < a[1] ? b : a));
if (low[0] <= root[0]) fail('the wing sweeps forward, which is not this aircraft');
if (low[1] < 0.1) fail('the wing barely leaves the fuselage');
// Exhaust at the very back.
const nozzle = part('nozzle');
if (Math.min(...xs(nozzle.points)) < 0.85) fail('the nozzle is not at the tail');

const arena = ARENAS[arenaIndexById(19)];
const weapon = arena.weapon ?? fail('arena 19 is not WEAPON SYSTEMS');
if (weapon.jet.w <= 0 || weapon.jet.h <= 0) fail('the jet has no drawing box');

// One silhouette, two consumers: neither draw may inline its own polygon again.
const renderSrc = readFileSync('src/game/render.ts', 'utf8');
const arenaSrc = readFileSync('src/game/arenas.ts', 'utf8');
if (!renderSrc.includes('FIGHTER_SIDE')) fail('the arena renderer does not use the shared silhouette');
if (!arenaSrc.includes('FIGHTER_SIDE.length')) fail('the arena picker does not use the shared silhouette');
if (renderSrc.includes('ctx.moveTo(jet.x + jet.w * 0.12')) fail('the arena renderer still has the old polygon');
console.log('jet-check: OK');
