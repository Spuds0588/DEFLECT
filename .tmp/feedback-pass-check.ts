import { ARENAS } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, PLAYER, WORM } from '../src/game/config';
import { SRC } from '../src/game/types';
import { TutorialRunner, WARDEN_TUTORIAL } from '../src/game/tutorial';
import { World } from '../src/game/world';
import type { InputFrame } from '../src/game/types';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'QA';
const buildCampaign = (index: number, bots: number): World => {
  const level = PLAYABLE_CAMPAIGN_LEVELS[index];
  const arena = ARENAS.find((a) => a.id === level.arenaId)!;
  for (let i = 1; i < names.length; i++) names[i] = i <= bots ? `BOT${i}` : '';
  return new World(
    'gauntlet',
    names,
    0,
    arena,
    false,
    0,
    bots,
    bots > 0 ? [11, 10, 9] : null,
    true,
    level.dataCrates,
    false,
    level.intro,
    level.clearKills,
    false,
    level.boss ?? -1,
    level.primitivesOnly === true,
    level.opening ?? null,
    level.finale === true,
  );
};

const squad = buildCampaign(5, 2);
check('campaign loads selected bots', squad.players[1].active && squad.players[2].active);
check(
  'campaign bots start beside the player',
  Math.hypot(squad.players[1].x - squad.players[0].x, squad.players[1].y - squad.players[0].y) < 340,
);
check('third bot stays offline', !squad.players[3].active);
const solo = buildCampaign(5, 0);
check('NO BOTS really means none', solo.players.every((p, i) => i === 0 || !p.active));

const parryWorld = new World('training', ['QA'], 0, ARENAS[0], false, 0);
(parryWorld as unknown as { drone: { active: boolean } }).drone.active = false;
const p = parryWorld.players[0];
p.x = parryWorld.arena.spawns[0].x;
p.y = parryWorld.arena.spawns[0].y;
p.facing = 0;
p.iframes = 0;
p.hp = p.maxHp;
const worm = parryWorld.worms[0];
worm.active = true;
worm.x = p.x + 100;
worm.y = p.y;
worm.hp = 10;
worm.maxHp = 10;
worm.aggroT = 1;
worm.dashT = WORM.dashRecovery + 0.02;
worm.stunT = 0;
worm.kx = 0;
worm.ky = 0;
p.parryT = PLAYER.parryWindow;
const before = p.hp;
(parryWorld as unknown as {
  damagePlayer: (body: typeof p, amount: number, slot: number, dx: number, dy: number, force: number, kind: number, id: number) => void;
}).damagePlayer(p, 1, -1, -1, 0, 900, SRC.WORM, 0);
check('perfect parry stuns the worm', worm.stunT > 0.9, String(worm.stunT));
check('perfect parry deals no player damage', p.hp === before);
check('perfect parry cancels the lunge', worm.dashT === 0);

worm.dashT = WORM.dashRecovery + 0.02;
worm.stunT = 0;
worm.kx = 0;
p.parryT = 0;
p.guardT = 0.5;
p.iframes = 0;
p.kx = 0;
p.hp = p.maxHp;
const hp2 = p.hp;
(parryWorld as unknown as {
  damagePlayer: (body: typeof p, amount: number, slot: number, dx: number, dy: number, force: number, kind: number, id: number) => void;
}).damagePlayer(p, 1, -1, -1, 0, 900, SRC.WORM, 0);
check('late block pushes both bodies', Math.abs(p.kx) > 0 && Math.abs(worm.kx) > 0);
check('late block does not stun', worm.stunT === 0);
check('late block takes no damage', p.hp === hp2);

const networkArena = ARENAS.find((a) => a.id === 9)!;
const pipes = new World('gauntlet', ['QA'], 0, networkArena, false, 0);
const rider = pipes.players[0];
const pipe = pipes.pipes[0];
rider.x = pipe.x;
rider.y = pipe.y;
rider.iframes = 0;
rider.pipeCooldown = 0;
pipe.catchT = 0;
(pipes as unknown as { updateNetwork: (dt: number) => void }).updateNetwork(1 / 60);
check('pipe captures a player', rider.pipeTransitT > 0, String(rider.pipeTransitT));
check('pipe chooses another mouth', rider.pipeFromIndex !== rider.pipeToIndex);
(pipes as unknown as { tickPipeTransit: (dt: number) => void }).tickPipeTransit(2);
check('pipe ride lands and starts cooldown', rider.pipeTransitT === 0 && rider.pipeCooldown > 0);

const emitterArena = ARENAS.find((a) => (a.emitters?.length ?? 0) > 0)!;
const emitterWorld = new World('gauntlet', ['QA'], 0, emitterArena, false, 0);
emitterWorld.players[0].iframes = 999;
let warned = false;
for (let i = 0; i < 420; i++) {
  const input: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
  emitterWorld.step(1 / 60, [input]);
  if (emitterWorld.emitters.some((e) => e.phase === 3 && e.warnT > 0)) warned = true;
}
check('emitter shows a warning phase before fire', warned);

const runner = new TutorialRunner(WARDEN_TUTORIAL);
const reflectIndex = WARDEN_TUTORIAL.findIndex((s) => s.action === 'reflect');
runner.index = reflectIndex;
const idle: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
runner.update({ dt: 0.1, frame: idle, lockActive: false, reflected: false });
check('reflection practice needs three catches', runner.current?.action === 'reflect');
runner.update({ dt: 0.1, frame: idle, lockActive: false, reflected: true });
check('first catch advances to the locked lesson', runner.current?.action === 'reflect-lock');
runner.update({ dt: 0.1, frame: idle, lockActive: false, reflected: true });
check('locked catches require a lock', runner.current?.action === 'reflect-lock');
runner.update({ dt: 0.1, frame: idle, lockActive: true, reflected: true });
check('locked catch advances the lesson', runner.current?.id !== 'reflect-lock');

console.log(failures === 0 ? 'feedback-pass-check: OK' : `feedback-pass-check: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
