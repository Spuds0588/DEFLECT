import { ARENAS } from '../src/game/arenas';
import { PLAYER } from '../src/game/config';
import { PROGRAM_ID } from '../src/game/programs';
import { World } from '../src/game/world';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`ok   ${name}${detail ? `  (${detail})` : ''}`);
  else {
    failures++;
    console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
  }
}

const arena = ARENAS.find((a) => a.id === 10);
check('SPACE CADET exists as arena 10', !!arena, arena?.name);
if (!arena) process.exit(1);
check('it is a tall cabinet', arena.bounds.bottom - arena.bounds.top > arena.bounds.right - arena.bounds.left);
check('it has posts and kickers', arena.bumpers?.length === 6 && arena.bumpers.some((b) => b.kind === 1));
check('it has a bottom drain', arena.voids?.some((v) => v.y + v.h >= arena.bounds.bottom));
check('its feed is the pinball feed', arena.pipes?.[0]?.feed === 'pinball');

const w = new World('gauntlet', ['QA'], 0, arena, true, PROGRAM_ID.PROBE) as World & {
  bumpBody: (body: unknown, radius: number) => void;
  bounceBumpers: (proj: unknown) => void;
  spawnProjectile: (p: unknown, ...args: unknown[]) => boolean;
  checkFall: (p: unknown) => void;
  firePipe: (pipe: unknown) => void;
};
const p = w.players[0];
check('runtime bumper flash pool matches the data', w.bumperFlash.length === arena.bumpers!.length);

const kicker = arena.bumpers!.find((b) => b.y === 1040)!;
p.x = kicker.x;
p.y = kicker.y;
p.vx = 0;
p.vy = 0;
p.kx = 0;
p.ky = 0;
w.bumpBody(p, PLAYER.radius);
check('a body is separated out of a kicker', Math.hypot(p.x - kicker.x, p.y - kicker.y) >= kicker.radius + PLAYER.radius);
check('the kicker leaves an outward launch', Math.hypot(p.kx, p.ky) > 500, String(Math.hypot(p.kx, p.ky)));

p.x = 300;
p.y = 1050;
p.facing = 0;
p.burstCd = 0;
p.burstLeft = 5;
p.autoFireT = 0;
w.spawnProjectile(p, 0, 4, 500, false, 5, 1, 0);
const shot = w.projectiles.find((proj) => proj.active && proj.owner === 0 && proj.type === 0);
check('a probe shot exists for the bumper test', !!shot);
if (shot) {
  shot.x = kicker.x - 30;
  shot.y = kicker.y;
  shot.vx = 500;
  shot.vy = 0;
  w.bounceBumpers(shot);
  check('a shot reflects off a round bumper', shot.active && shot.vx < 0, `${shot.vx.toFixed(0)}`);
}

const pipe = w.pipes[0];
check('the arcade pipe is mounted and live', !!pipe && pipe.active && pipe.feed === 1);
if (pipe) {
  pipe.shots = 0;
  w.firePipe(pipe);
  check('pipe beat 1 deploys a hostile file', w.props.some((b) => b.active && b.hazard));
  w.firePipe(pipe);
  const ball = w.projectiles.find((proj) => proj.active && proj.type === 14 && proj.owner === -1);
  check('pipe beat 2 deploys a hostile ball', !!ball);
  if (ball) {
    ball.x = arena.bounds.right - ball.radius + 1;
    ball.y = 500;
    ball.vx = 500;
    ball.vy = 0;
    (w as unknown as { bounceWalls: (p: unknown) => void }).bounceWalls(ball);
    check('the hostile ball bounces instead of dying on a wall', ball.active && ball.vx < 0);
  }
  w.firePipe(pipe);
  check('pipe beat 3 deploys a virus', w.viruses.some((v) => v.active));
  w.firePipe(pipe);
  check('pipe beat 4 deploys a sentry or a second virus', w.sentries.some((s) => s.active) || w.viruses.some((v) => v.active));
}

p.alive = true;
p.iframes = 0;
p.x = 640;
p.y = 1580;
w.checkFall(p);
check('a body over the drain starts a fall', p.fallT > 0);
for (let i = 0; i < 45 && p.alive; i++) w.step(1 / 60, [null]);
check('the drain kills the body', !p.alive);

console.log(failures === 0 ? '\nALL SPACE CADET CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
