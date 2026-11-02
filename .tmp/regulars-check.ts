/**
 * Ordinary-program format check: unique colours/faces, and the intake placements are
 * inside the circular room, clear of cover and clear of the chasm ring.
 */
import { ARENAS, arenaSolids } from '../src/game/arenas';
import { REGULAR_PROGRAMS, regularProgram } from '../src/game/regulars';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`PASS ${name}`);
  else {
    failures++;
    console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
  }
}

check('four regular programs defined', REGULAR_PROGRAMS.length === 4, String(REGULAR_PROGRAMS.length));
check('ids are unique', new Set(REGULAR_PROGRAMS.map((p) => p.id)).size === REGULAR_PROGRAMS.length);
check('cart colours are unique', new Set(REGULAR_PROGRAMS.map((p) => p.cart)).size === REGULAR_PROGRAMS.length);
check('faces are unique single emoji', new Set(REGULAR_PROGRAMS.map((p) => p.face)).size === REGULAR_PROGRAMS.length && REGULAR_PROGRAMS.every((p) => [...p.face].length === 1));
check('lookup resolves by id', regularProgram('ping').name === 'PING');
check('unknown id falls back safely', regularProgram('missing' as never).name === 'TICKET');

const arena = ARENAS[14];
const regulars = arena.regulars ?? [];
check('three regulars staff the intake', regulars.length === 3, String(regulars.length));
check(
  'all regulars use defined ids',
  regulars.every((p) => REGULAR_PROGRAMS.some((def) => def.id === p.id)),
);

const cx = 310;
const cy = 547;
const radius = 235;
const solids = arenaSolids(arena);
for (let i = 0; i < regulars.length; i++) {
  const p = regulars[i];
  const scale = p.scale ?? 1;
  const reach = 26 * scale;
  check(
    `regular ${p.id} is inside the intake circle`,
    Math.hypot(p.x - cx, p.y - cy) + reach <= radius,
    `${Math.hypot(p.x - cx, p.y - cy).toFixed(0)} + ${reach.toFixed(0)}`,
  );
  check(
    `regular ${p.id} is clear of cover`,
    !arena.pillars.some(
      (r) => p.x + reach > r.x && p.x - reach < r.x + r.w && p.y + reach > r.y && p.y - reach < r.y + r.h,
    ),
  );
  check(
    `regular ${p.id} is clear of chasms`,
    !arena.traverse?.chasms.some(
      (r) => p.x + reach > r.x && p.x - reach < r.x + r.w && p.y + reach > r.y && p.y - reach < r.y + r.h,
    ),
  );
  check(`regular ${p.id} is not a collision solid`, !solids.some((r) => p.x === r.x && p.y === r.y));
}

console.log(failures === 0 ? '\nALL REGULAR PROGRAM CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
