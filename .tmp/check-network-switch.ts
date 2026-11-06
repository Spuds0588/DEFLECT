import { ARENAS } from '../src/game/arenas';
import { NETWORK } from '../src/game/config';
import { World } from '../src/game/world';
import type { Prop } from '../src/game/types';

const arena = ARENAS.find((a) => a.name === 'NETWORK SWITCH')!;
const input = [{ mx: 0, my: 0, held: 0, pressed: 0 }];
let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`ok   ${name}${detail ? `  (${detail})` : ''}`);
    return;
  }
  failures++;
  console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
}

type NetWorld = World & {
  updateNetwork: (dt: number) => void;
  damagePipe: (p: object, n: number, x: number, y: number) => void;
  pipeHit: (proj: object) => boolean;
};

const w = new World('gauntlet', ['QA'], 0, arena, false, 0, 0, null, false, null) as NetWorld;
const hazardCount = (): number => w.props.filter((b) => b.active && b.hazard).length;
const pipe = w.pipes[0];

check('arena has four pipes', w.pipes.length === 4, String(w.pipes.length));
check('arena has a firewall switch', !!arena.firewallSwitch);
check('pipes start live and healthy', w.pipes.every((p) => p.active && p.hp === p.maxHp));
check('no hostile files before the first beat', hazardCount() === 0);

// The first pipe offset is 1.2 s; its first file leaves at 4.6 s.
w.players[0].iframes = 999;
for (let i = 0; i < 330; i++) w.step(1 / 60, input);
check('pipe feeds a hostile file', hazardCount() >= 1, String(hazardCount()));
const fed = w.props.find((b) => b.active && b.hazard);
check('fed file is a hazard', !!fed?.hazard);

// Direct contact through the real prop path.
if (fed) {
  w.players[0].iframes = 0;
  w.players[0].hp = 3;
  fed.x = w.players[0].x;
  fed.y = w.players[0].y;
  fed.vx = 0;
  fed.vy = 0;
  fed.tx = 0;
  fed.ty = 0;
  fed.hurtCd = 0;
  w.step(1 / 60, input);
  check('hostile file spends a health segment', w.players[0].hp < 3, String(w.players[0].hp));
  w.players[0].iframes = 999;
}

// A file at the mouth is reclaimed by the intake.
const catchWorld = new World('gauntlet', ['QA'], 0, arena, false, 0, 0, null, false, null) as NetWorld;
const cp = catchWorld.pipes[0];
const cb = catchWorld.props.find((b) => !b.active) as Prop;
cb.active = true;
cb.hazard = true;
cb.x = cp.x - 20;
cb.y = cp.y;
cb.w = 38;
cb.h = 27;
cb.hp = 1;
cb.dropT = 0;
cp.catchT = 0;
catchWorld.players[0].iframes = 999;
(catchWorld as NetWorld).updateNetwork(0.1);
check('pipe catches a loose file', !cb.active, String(cb.active));

// Pipe shots chip it; enough shots destroy it and stop that feed.
const hp = pipe.hp;
const shot = { owner: 0, x: pipe.x, y: pipe.y, radius: 4, damage: 2, active: true };
const hit = w.pipeHit(shot);
check('player shot hits a pipe', hit && pipe.hp < hp, `${pipe.hp}/${pipe.maxHp}`);
const before = hazardCount();
for (const p of w.pipes) w.damagePipe(p, 99, p.x, p.y);
check('all pipes can be destroyed', w.pipes.every((p) => !p.active));
for (let i = 0; i < 900; i++) w.step(1 / 60, input);
check('destroyed pipes stop feeding files', hazardCount() <= before, `${before} -> ${hazardCount()}`);

// Firewall starter: standing on the pad does nothing; a dash into it arms the sweep.
const sw = new World('gauntlet', ['QA'], 0, arena, false, 0, 0, null, false, null) as NetWorld;
const pad = arena.firewallSwitch!;
sw.players[0].iframes = 999;
sw.players[0].x = pad.x;
sw.players[0].y = pad.y;
for (let i = 0; i < 120; i++) sw.step(1 / 60, input);
check('standing on the switch does nothing', sw.firewalls.every((f) => !f.active));

sw.players[0].dashT = 0.2;
sw.updateNetwork(1 / 60);
const activeBefore = sw.firewalls.filter((f) => f.active).length;
check('dashing into the plate starts a firewall sweep', activeBefore === 1, String(activeBefore));
check('switch enters its long cooldown', sw.firewallSwitchT > NETWORK.switchCooldown - 3, sw.firewallSwitchT.toFixed(1));
sw.firewalls.forEach((f) => (f.active = false));
sw.step(1 / 60, input);
check('switch will not refire while cooling down', sw.firewalls.every((f) => !f.active));

console.log(failures === 0 ? '\nALL NETWORK SWITCH CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
