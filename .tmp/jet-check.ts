/** WEAPON SYSTEMS probe: the fighter is a nose-up plan view, shared by both draws. */
import { readFileSync } from 'node:fs';
import { ARENAS, FIGHTER_TOP, arenaIndexById } from '../src/game/arenas';

const fail = (m: string): never => {
  throw new Error(m);
};

const names = FIGHTER_TOP.map((s) => s.name);
for (const required of ['fuselage', 'canopy', 'wing', 'fin', 'stabilizer', 'nozzle', 'intake']) {
  if (!names.includes(required as (typeof names)[number])) fail(`the jet is missing its ${required}`);
}
if (new Set(names).size !== names.length) fail('duplicate silhouette parts');
if (FIGHTER_TOP.length < 7) fail(`expected at least 7 parts, got ${FIGHTER_TOP.length}`);

for (const shape of FIGHTER_TOP) {
  if (!shape.closed) fail(`${shape.name} should be a closed outline`);
  if (shape.points.length < 3) fail(`${shape.name} has too few points to be a shape`);
  for (const [x, y] of shape.points) {
    if (x < 0 || x > 1) fail(`${shape.name} escapes the box on x (${x})`);
    if (y < 0 || y > 1) fail(`${shape.name} escapes the box on y (${y})`);
  }
}

const part = (name: string) => FIGHTER_TOP.find((s) => s.name === name) ?? fail(`missing ${name}`);
const xs = (points: readonly (readonly [number, number])[]) => points.map((p) => p[0]);
const ys = (points: readonly (readonly [number, number])[]) => points.map((p) => p[1]);

// Nose at the top, centred on the box.
const fuselage = part('fuselage');
const nose = fuselage.points.reduce((a, b) => (b[1] < a[1] ? b : a));
if (nose[1] > 0.05) fail('the nose is not at the top of the box');
if (Math.abs(nose[0] - 0.5) > 0.06) fail('the nose is not centred');
if (Math.max(...ys(fuselage.points)) < 0.95) fail('the fuselage does not reach the tail');

// The canopy is forward and centred, not a side-profile bubble.
const canopy = part('canopy');
if (Math.min(...ys(canopy.points)) > 0.22) fail('the canopy is too far aft');
if (Math.max(...ys(canopy.points)) > 0.4) fail('the canopy stretches into the wing');
if (Math.abs((Math.min(...xs(canopy.points)) + Math.max(...xs(canopy.points))) * 0.5 - 0.5) > 0.03) {
  fail('the canopy is not centred');
}

// Wings span both sides, sweep aft, and sit beside the cockpit.
const wing = part('wing');
if (Math.min(...xs(wing.points)) > 0.1 || Math.max(...xs(wing.points)) < 0.9) fail('the wings do not span the box');
if (Math.min(...ys(wing.points)) < 0.3) fail('the wing root reaches the nose');
const tipY = Math.max(...ys(wing.points));
const tips = wing.points.filter((point) => point[1] === tipY);
if (!tips.some((point) => point[0] < 0.1) || !tips.some((point) => point[0] > 0.9)) {
  fail('the wingtips do not sweep outward');
}

// Tail planes and exhaust sit at the back, and the fin is a centred tail mark.
const stabilizer = part('stabilizer');
if (Math.min(...ys(stabilizer.points)) < 0.75) fail('the stabilizer is too far forward');
if (Math.max(...xs(stabilizer.points)) < 0.8) fail('the stabilizer does not span the tail');
const nozzle = part('nozzle');
if (Math.min(...ys(nozzle.points)) < 0.9) fail('the nozzle is not at the tail');
const fin = part('fin');
if (Math.min(...ys(fin.points)) < 0.6) fail('the fin is too far forward');
if (Math.min(...xs(fin.points)) < 0.42 || Math.max(...xs(fin.points)) > 0.58) fail('the fin is off-centre');

const arena = ARENAS[arenaIndexById(19)];
const weapon = arena.weapon ?? fail('arena 19 is not WEAPON SYSTEMS');
if (weapon.jet.w <= 0 || weapon.jet.h <= 0) fail('the jet has no drawing box');
if (weapon.jet.h <= weapon.jet.w) fail('the jet is not a nose-up portrait');
if (weapon.buttons.length !== 3) fail('WEAPON SYSTEMS needs three control banks');
const fire = weapon.buttons.find((button) => button.kind === 0) ?? fail('missing fire bank');
const eject = weapon.buttons.find((button) => button.kind === 1) ?? fail('missing eject bank');
const thrust = weapon.buttons.find((button) => button.kind === 2) ?? fail('missing thruster bank');
if (fire.x + fire.w > weapon.jet.x + 20) fail('the fire bank is not beside the forward wing');
if (eject.y + eject.h > weapon.jet.y + weapon.jet.h * 0.45) fail('the eject bank is not beside the cockpit');
if (thrust.y < weapon.jet.y + weapon.jet.h * 0.7) fail('the thruster bank is not near the tail');

// One silhouette, two consumers: neither draw may inline its own polygon again.
const renderSrc = readFileSync('src/game/render.ts', 'utf8');
const arenaSrc = readFileSync('src/game/arenas.ts', 'utf8');
if (!renderSrc.includes('FIGHTER_TOP')) fail('the arena renderer does not use the shared silhouette');
if (!arenaSrc.includes('FIGHTER_TOP.length')) fail('the arena picker does not use the shared silhouette');
if (renderSrc.includes('FIGHTER_SIDE')) fail('the arena renderer still uses the old side profile');
if (renderSrc.includes('ctx.moveTo(jet.x + jet.w * 0.12')) fail('the arena renderer still has the old polygon');
console.log('jet-check: OK');
