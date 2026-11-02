/**
 * QUARANTINE tutorial layout check.
 *
 * Verifies the campaign's first node boots into the new arena, the player starts in the
 * round intake room, the calibration class is staged in the mainboard room, and the two
 * bridges are the only body crossings between the rooms.
 */
import { ARENAS, arenaSolids, getArena } from '../src/game/arenas';
import { CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import type { InputFrame } from '../src/game/types';
import { World } from '../src/game/world';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
  }
}

const level = CAMPAIGN_LEVELS[0];
const arena = getArena(level.arenaId);
check('BUILD ROOT uses QUARANTINE', arena.id === 14 && arena.name === 'QUARANTINE', `${arena.id} ${arena.name}`);
check('arena index and id agree', ARENAS[14] === arena && arena.id === 14);
check('rooms are circle, rect, larger rect', !!arena.rooms && arena.rooms.length === 3 && arena.rooms[0].shape === 'circle' && arena.rooms[1].shape === 'rect' && arena.rooms[2].shape === 'rect');
check('third room is larger than second', !!arena.rooms && arena.rooms[2].w * arena.rooms[2].h > arena.rooms[1].w * arena.rooms[1].h);
check('two real bridge spans', !!arena.traverse && arena.traverse.bridges.length === 2);
check('four chasm halves', !!arena.traverse && arena.traverse.chasms.length === 4);
check('solids include each chasm', arenaSolids(arena).length === arena.pillars.length + (arena.traverse?.chasms.length ?? 0), `${arenaSolids(arena).length}`);

const names = new Array(MAX_PLAYERS).fill('');
names[0] = 'QA';
const world = new World(
  'gauntlet',
  names,
  0,
  arena,
  false,
  0,
  0,
  null,
  true,
  level.dataCrates,
  false,
  level.intro,
  level.clearKills,
);
const p = world.players[0];
check('campaign starts in the intake office', Math.abs(p.x - 310) < 1 && Math.abs(p.y - 547) < 1, `${p.x},${p.y}`);

const shapes = world.sentries.filter((s) => s.active && s.kind >= 4 && s.kind <= 6);
check('six calibration subjects', shapes.length === 6, String(shapes.length));
check(
  'all subjects staged in the mainboard room',
  shapes.every((s) => s.x > 730 && s.x < 1270 && s.y > 260 && s.y < 840),
  shapes.map((s) => `${s.kind}@${s.x.toFixed(0)},${s.y.toFixed(0)}`).join(' '),
);
check(
  'subjects are clear of cover',
  shapes.every(
    (s) =>
      !arena.pillars.some(
        (r) => s.x + s.radius > r.x && s.x - s.radius < r.x + r.w && s.y + s.radius > r.y && s.y - s.radius < r.y + r.h,
      ),
  ),
);
check(
  'subjects are inside the room, not over a chasm',
  shapes.every(
    (s) =>
      !arena.traverse?.chasms.some(
        (r) => s.x > r.x && s.x < r.x + r.w && s.y > r.y && s.y < r.y + r.h,
      ),
  ),
);

// The bridge at y 547 is the way east. Three seconds of held movement should put the
// player inside the mainboard room, not against the chasm lip.
world.skipTutorial();
const east: InputFrame = { mx: 1, my: 0, held: 0, pressed: 0 };
for (let i = 0; i < 180; i++) world.step(SIM_DT, [east]);
check('player crosses bridge A into the mainboard', p.x > 800 && p.y > 492 && p.y < 602, `${p.x.toFixed(0)},${p.y.toFixed(0)}`);

// Below the bridge the chasm is solid to bodies. Walk east from the office's south
// floor and confirm the lip stops the body instead of letting it fall or phase through.
const blocked = new World('gauntlet', ['QA'], 0, arena, false, 0);
const b = blocked.players[0];
b.x = 500;
b.y = 700;
for (let i = 0; i < 120; i++) blocked.step(SIM_DT, [east]);
check('chasm blocks a body outside the bridge', b.x < 545, `${b.x.toFixed(0)},${b.y.toFixed(0)}`);

// And the second bridge carries the same body into the router room.
blocked.players[0].x = 1200;
blocked.players[0].y = 547;
for (let i = 0; i < 180; i++) blocked.step(SIM_DT, [east]);
check('player crosses bridge B into the router', b.x > 1440, `${b.x.toFixed(0)},${b.y.toFixed(0)}`);

console.log(failures === 0 ? '\nALL QUARANTINE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
