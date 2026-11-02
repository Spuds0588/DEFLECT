import { ARENAS } from '../src/game/arenas';
import { AIMBOT } from '../src/game/config';
import { PROGRAM_ID } from '../src/game/programs';
import { ACTION } from '../src/game/types';
import { World } from '../src/game/world';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`ok   ${name}${detail ? `  (${detail})` : ''}`);
    return;
  }
  failures++;
  console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
}

// Pick a clear, walled arena so the cone and lock tests do not fail on unrelated cover.
const arena =
  ARENAS.find((a) => a.pillars.length === 0 && !a.voids && !a.disc && a.walls !== 'open') ??
  ARENAS[0];

type AimWorld = World & {
  tryShoot: (p: unknown) => void;
  useBug: (p: unknown) => void;
  fireAimVolley: (p: unknown) => void;
  bounceWalls: (proj: unknown) => void;
};

const w = new World('training', ['QA', 'FAR'], 0, arena, false, PROGRAM_ID.AIMBOT) as AimWorld;
const p = w.players[0];
const input = [{ mx: 0, my: 0, held: 0, pressed: 0 }];
p.iframes = 999;
p.x = 400;
p.y = 400;
p.facing = 0;
p.autoFireT = 0;
p.energy = 100;

check('Aim Bot is program 12', PROGRAM_ID.AIMBOT === 12);
check('rail round is slow to reload', AIMBOT.attackCooldown >= 1.5, String(AIMBOT.attackCooldown));

w.tryShoot(p);
const rail = w.projectiles.find((proj) => proj.active && proj.type === 17);
check('ranged attack creates a type 17 rail round', !!rail);
check('rail round deals 8 damage', rail?.damage === 8, String(rail?.damage));
check('rail round is very fast', (rail ? Math.hypot(rail.vx, rail.vy) : 0) >= 3000, String(rail ? Math.hypot(rail.vx, rail.vy) : 0));
check('rail round has no practical flight limit', (rail?.fuse ?? 0) >= 19, String(rail?.fuse));
check('rail round has no bounce budget', rail?.bounces === 0);

if (rail) {
  rail.x = arena.bounds.left + 3;
  rail.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
  rail.vx = -100;
  rail.vy = 0;
  w.bounceWalls(rail);
  check('rail round dies on a wall instead of bouncing', !rail.active);
}

p.autoFireT = 0;
p.aimClip = 0;
p.aimSightT = 0;
p.bugCd = 0;
p.energy = 100;
w.useBug(p);
check('sight raises a visible laser for its window', p.aimSightT === AIMBOT.sightTime, String(p.aimSightT));
check('sight loads a three-shot clip', p.aimClip === 3, String(p.aimClip));
for (let i = 0; i < 3; i++) {
  p.autoFireT = 0;
  w.tryShoot(p);
}
check('all three clip shots fire', p.aimClip === 0, String(p.aimClip));
check('clip shots bypass the normal reload', p.autoFireT === AIMBOT.clipInterval, String(p.autoFireT));

// Long lock: 2000 units is outside the standard 1600 lock but inside Aim Bot's 2400.
const lw = new World('training', ['QA', 'FAR'], 0, arena, false, PROGRAM_ID.AIMBOT) as World & {
  tryShoot: (p: unknown) => void;
};
const lp = lw.players[0];
const far = lw.players[1];
// Find a clear lane through this arena's cover. The lock range is the thing under test,
// not whether CROSSROADS happens to put a switchblock between the two bodies.
const laneY = (() => {
  for (let y = arena.bounds.top + 80; y < arena.bounds.bottom - 80; y += 30) {
    if (!(lw as unknown as { lineBlocked: (x1: number, y1: number, x2: number, y2: number) => boolean }).lineBlocked(
      arena.bounds.left + 80,
      y,
      arena.bounds.right - 80,
      y,
    )) return y;
  }
  return (arena.bounds.top + arena.bounds.bottom) * 0.5;
})();
lp.x = arena.bounds.left + 80;
lp.y = laneY;
lp.facing = 0;
far.x = arena.bounds.right - 80;
far.y = laneY;
far.alive = true;
far.iframes = 0;
const lockInput = [{ mx: 0, my: 0, held: ACTION.LOCK, pressed: 0 }, null];
for (let i = 0; i < 15; i++) lw.step(1 / 60, lockInput);
check('long lock reaches a body 2000 units away', lp.lockActive && lp.lockId === 1, `${lp.lockActive}/${lp.lockId}`);
check('lock position is exposed for the camera', Math.abs(lp.lockTX - far.x) < 1, `${lp.lockTX}`);

// Six bodies in front, one volley: one crosshair each, then six direct 12-point hits.
const names = ['QA', 'A', 'B', 'C', 'D', 'E', 'F'];
const vw = new World('training', names, 0, arena, false, PROGRAM_ID.AIMBOT) as AimWorld;
const vp = vw.players[0];
vp.iframes = 999;
vp.x = 400;
vp.y = 450;
vp.facing = 0;
vp.energy = 100;
for (let i = 1; i <= 6; i++) {
  const t = vw.players[i];
  t.x = 620 + i * 55;
  t.y = 450;
  t.alive = true;
  t.iframes = 0;
}
vw.fireAimVolley(vp);
check('volley marks six targets', vw.aimMarks.filter((m) => m.active).length === 6, String(vw.aimMarks.filter((m) => m.active).length));
for (let i = 0; i < 61; i++) vw.step(1 / 60, input);
check(
  'volley resolves instantly at 12 damage',
  vw.players.slice(1, 7).every((t) => !t.alive || t.hp <= 0),
  vw.players.slice(1, 7).map((t) => `${t.hp.toFixed(1)}/${t.alive ? 'alive' : 'down'}`).join(' '),
);
check('volley leaves no projectile behind', vw.projectiles.every((proj) => proj.owner !== 0 || proj.type !== 17 || !proj.active));

console.log(failures === 0 ? '\nALL AIM BOT CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
