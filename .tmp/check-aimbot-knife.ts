import { ARENAS } from '../src/game/arenas';
import { AIMBOT, PLAYER } from '../src/game/config';
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

// Walled arena with no cover, so the cone tests cannot fail on an unrelated pillar.
const arena =
  ARENAS.find((a) => a.pillars.length === 0 && !a.voids && !a.disc && a.walls !== 'open') ?? ARENAS[0];

type MeleeResult = {
  hit: boolean;
  kx: number;
  ky: number;
  mult: number;
  half: number;
  knock: number;
};

/** One swing at a stationary target placed at an absolute point, 24 frames of settle. */
function swing(program: number, tx: number, ty: number): MeleeResult {
  const w = new World('training', ['QA', 'TGT'], 0, arena, false, program);
  const p = w.players[0];
  const t = w.players[1];
  p.x = 400;
  p.y = 400;
  p.facing = 0;
  p.iframes = 999;
  p.energy = 100;
  t.x = tx;
  t.y = ty;
  t.alive = true;
  t.iframes = 0;
  t.hp = PLAYER.hp;
  t.kx = 0;
  t.ky = 0;
  const input = [
    { mx: 0, my: 0, held: 0, pressed: ACTION.SWING },
    { mx: 0, my: 0, held: 0, pressed: 0 },
  ];
  for (let i = 0; i < 24; i++) w.step(1 / 60, input);
  return {
    hit: t.hp < PLAYER.hp,
    kx: t.kx,
    ky: t.ky,
    mult: p.meleeReachMult,
    half: p.meleeHalfAngle,
    knock: p.meleeKnock,
  };
}

// --- Shape: the shared lash is untouched, Aim Bot's knife is longer and wider. ---

const probeShape = swing(PROGRAM_ID.PROBE, 460, 400);
const aimShape = swing(PROGRAM_ID.AIMBOT, 460, 400);
check('shared melee keeps its 180 degree arc', Math.abs(probeShape.half - Math.PI / 2) < 1e-6, probeShape.half.toFixed(3));
check('shared melee keeps its default reach', probeShape.mult === 1, String(probeShape.mult));
check('shared melee keeps its default shove', probeShape.knock === PLAYER.punchKnockback, String(probeShape.knock));
check('Aim Bot blade is longer', aimShape.mult === AIMBOT.meleeReachMult && aimShape.mult > 1, String(aimShape.mult));
check(
  'Aim Bot arc sweeps wider than 180 degrees',
  aimShape.half > Math.PI / 2 && Math.abs(aimShape.half - Math.PI / 2 * AIMBOT.meleeArcMult) < 1e-6,
  `${((aimShape.half * 2 * 180) / Math.PI).toFixed(1)} deg`,
);
check('Aim Bot knife shoves harder', aimShape.knock > PLAYER.punchKnockback, String(aimShape.knock));

// --- Reach: 100 units is outside the 72 + 22 body cone, inside 108 + 22. ---

const probeFar = swing(PROGRAM_ID.PROBE, 500, 400);
const aimFar = swing(PROGRAM_ID.AIMBOT, 500, 400);
check('a body at 100 units is outside the shared lash', !probeFar.hit);
check('the same body falls inside the knife', aimFar.hit);

// --- Arc: 106 degrees off facing is outside 90, inside Aim Bot's ~110 half-angle. ---

const wideX = 400 + Math.cos(1.85) * 60;
const wideY = 400 + Math.sin(1.85) * 60;
const probeWide = swing(PROGRAM_ID.PROBE, wideX, wideY);
const aimWide = swing(PROGRAM_ID.AIMBOT, wideX, wideY);
check('shared lash cannot reach past 90 degrees', !probeWide.hit);
check('the knife catches a body past 90 degrees', aimWide.hit);

// --- Shove: same close target, compare the knock the body carries. ---

const probeClose = swing(PROGRAM_ID.PROBE, 460, 400);
const aimClose = swing(PROGRAM_ID.AIMBOT, 460, 400);
const probeShove = Math.hypot(probeClose.kx, probeClose.ky);
const aimShove = Math.hypot(aimClose.kx, aimClose.ky);
check('both melees connect on a close body', probeClose.hit && aimClose.hit);
check(
  'the knife sends the body farther than the lash',
  aimShove > probeShove * 1.5,
  `${probeShove.toFixed(0)} -> ${aimShove.toFixed(0)}`,
);

console.log(failures === 0 ? '\nALL AIM BOT KNIFE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
