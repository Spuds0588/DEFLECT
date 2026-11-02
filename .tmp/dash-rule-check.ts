/**
 * Dash collision contract:
 * - solid cover stops both dash kinds
 * - a floor gap does not stop a dash (the dodge is airborne)
 * - normal walking still collides with the gap
 * - the sealed campaign cell block stops a dash until release
 */
import { ARENAS, getArena } from '../src/game/arenas';
import { CAMPAIGN_LEVELS } from '../src/game/campaign';
import { PLAYER, SIM_DT, WEDGE, type Bounds, type Rect } from '../src/game/config';
import { createPlayer } from '../src/game/entities';
import { stepPlayerMotion } from '../src/game/movement';
import { PROGRAM_ID } from '../src/game/programs';
import { World } from '../src/game/world';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

const bounds: Bounds = { left: 0, top: 0, right: 800, bottom: 400 };
const pillar: Rect = { x: 100, y: 0, w: 40, h: 400 };
const gap: Rect = { x: 100, y: 0, w: 60, h: 400 };

function dashingPlayer(x: number, y: number): ReturnType<typeof createPlayer> {
  const p = createPlayer(0);
  p.x = x;
  p.y = y;
  p.vx = 0;
  p.vy = 0;
  p.kx = 0;
  p.ky = 0;
  p.dashT = 1;
  p.dashDirX = 1;
  p.dashDirY = 0;
  return p;
}

const intoPillar = dashingPlayer(70, 200);
for (let i = 0; i < 12; i++) {
  stepPlayerMotion(intoPillar, 0, 0, SIM_DT, [pillar], bounds, false, [pillar]);
  intoPillar.dashT = Math.max(0, intoPillar.dashT - SIM_DT);
}
check(
  'dash stops at solid cover',
  intoPillar.x <= 100 - PLAYER.radius + 0.01,
  `x=${intoPillar.x.toFixed(2)}`,
);

// A charged dash covers more than a body radius in one frame. A thin pillar must not
// let the substep resolve on its far side and pop the body through.
const thinPillar: Rect = { x: 100, y: 0, w: 12, h: 400 };
const intoThin = dashingPlayer(70, 200);
intoThin.dashKind = 1;
for (let i = 0; i < 12; i++) {
  stepPlayerMotion(intoThin, 0, 0, SIM_DT, [thinPillar], bounds, false, [thinPillar]);
  intoThin.dashT = Math.max(0, intoThin.dashT - SIM_DT);
}
check(
  'charged dash does not tunnel through a thin pillar',
  intoThin.x <= 100 - PLAYER.radius + 0.01,
  `x=${intoThin.x.toFixed(2)}`,
);

const overGap = dashingPlayer(70, 200);
for (let i = 0; i < 10; i++) {
  stepPlayerMotion(overGap, 0, 0, SIM_DT, [gap], bounds, false, []);
  overGap.dashT = Math.max(0, overGap.dashT - SIM_DT);
}
check('dash clears a floor gap', overGap.x > 160, `x=${overGap.x.toFixed(2)}`);

const walking = createPlayer(0);
walking.x = 70;
walking.y = 200;
walking.vx = 1200;
for (let i = 0; i < 8; i++) stepPlayerMotion(walking, 0, 0, SIM_DT, [gap], bounds);
check(
  'walking still stops at the gap',
  walking.x <= 100 - PLAYER.radius + 0.01,
  `x=${walking.x.toFixed(2)}`,
);

// The campaign's sealed cell block is a real body solid. A dash into it must stay on
// the office side; the release removes the block afterwards.
const level = CAMPAIGN_LEVELS[0];
const arena = getArena(level.arenaId);
const names = new Array(8).fill('');
names[0] = 'QA';
const world = new World(
  'gauntlet',
  names,
  0,
  arena,
  false,
  PROGRAM_ID.PROBE,
  0,
  null,
  true,
  level.dataCrates,
  false,
  level.intro,
  level.clearKills,
) as World & { tryDash: (p: unknown) => void };
world.skipTutorial();
const campaignPlayer = world.players[0];
campaignPlayer.x = 800;
campaignPlayer.y = 500;
campaignPlayer.moveDirX = 0;
campaignPlayer.moveDirY = -1;
campaignPlayer.iframes = 999;
world.tryDash(campaignPlayer);
const north = { mx: 0, my: -1, held: 0, pressed: 0 };
for (let i = 0; i < 20; i++) world.step(SIM_DT, [north]);
check(
  'sealed campaign bars stop a dash',
  campaignPlayer.y >= 454 + PLAYER.radius - 0.1,
  `y=${campaignPlayer.y.toFixed(2)}`,
);

// Wedge's deployed wall is a thin line. A charged dash aimed at its centre must stay on
// the approach side and not resolve onto the far side.
const wallWorld = new World('training', ['QA'], 0, ARENAS[0], false, PROGRAM_ID.PROBE) as World & {
  tryChargeDash: (p: unknown) => void;
};
const wallPlayer = wallWorld.players[0];
const wall = wallWorld.barriers[0];
wall.active = true;
wall.owner = 0;
wall.x1 = 1280;
wall.y1 = 650;
wall.x2 = 1280;
wall.y2 = 790;
wall.nx = 1;
wall.ny = 0;
wall.life = 100;
wall.maxLife = 100;
wall.phase = 0;
wall.hp = 1;
wall.maxHp = 1;
wall.hitFlash = 0;
const wallReach = PLAYER.radius + WEDGE.wallThickness * 0.5;
wallPlayer.x = 1280 + wallReach + 0.5;
wallPlayer.y = 720;
wallPlayer.moveDirX = -1;
wallPlayer.moveDirY = 0;
wallPlayer.dashT = 0;
wallPlayer.dashCharges = 2;
wallPlayer.chargeDashCd = 0;
wallPlayer.swingPhase = 0;
wallPlayer.iframes = 999;
wallWorld.tryChargeDash(wallPlayer);
const west = { mx: -1, my: 0, held: 0, pressed: 0 };
for (let i = 0; i < 4; i++) wallWorld.step(SIM_DT, [west]);
check(
  'charged dash does not cross a thin deployed wall',
  wallPlayer.x >= 1280 + wallReach - 0.1,
  `x=${wallPlayer.x.toFixed(2)}`,
);

console.log(failures === 0 ? '\nALL DASH RULE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
