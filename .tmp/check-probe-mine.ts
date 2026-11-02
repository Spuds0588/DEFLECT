/** Checks Probe's persistent trap mine and release-canceled heavy beam. */
import { ARENAS } from '../src/game/arenas';
import { MINE, PLAYER, SIM_DT } from '../src/game/config';
import { PROGRAM_ID } from '../src/game/programs';
import { ACTION, type InputFrame } from '../src/game/types';
import { World } from '../src/game/world';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const idle: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
function frame(held = 0): InputFrame {
  return { mx: 0, my: 0, held, pressed: 0 };
}
function mineCount(w: World, owner: number): number {
  return w.projectiles.filter((p) => p.active && p.type === 1 && p.owner === owner).length;
}

console.log('Probe trap mine + heavy cancel probe');

// Three active bodies so one can trip the mine while another sits inside the larger
// blast but outside the old 82-unit radius. p0 is the local Probe.
const w = new World('training', ['QA', 'TRIGGER', 'BLAST'], 0, ARENAS[0], false, PROGRAM_ID.PROBE);
const p0 = w.players[0];
const trigger = w.players[1];
const blast = w.players[2];
for (const p of [p0, trigger, blast]) {
  p.active = true;
  p.alive = true;
  p.hp = p.maxHp;
  p.laserT = 0;
  p.laserChargeHeld = false;
  p.guardT = 0;
}
p0.x = 500;
p0.y = 500;
trigger.x = 540;
trigger.y = 500;
blast.x = 600;
blast.y = 500;

const priv = w as unknown as {
  plantMine(player: typeof p0): void;
};

priv.plantMine(p0);
let mine = w.projectiles.find((p) => p.active && p.type === 1 && p.owner === p0.slot);
check('planting creates an armed trap', !!mine && mine.fuse === 0, mine ? `fuse ${mine.fuse}` : 'no mine');

const triggerHp = trigger.hp;
const blastHp = blast.hp;
for (let i = 0; i < 60 && mine?.active; i++) w.step(SIM_DT, [idle, idle, idle]);
check('the trap detonates when stepped on', !!mine && !mine.active);
check('the trigger body takes the blast', trigger.hp < triggerHp, `hp ${trigger.hp}/${triggerHp}`);
check(
  'a body 100 units away is inside the enlarged blast',
  blast.hp < blastHp,
  `blast radius ${MINE.blastRadius}, hp ${blast.hp}/${blastHp}`,
);

// Persistence: move the bodies away, plant one, and leave it alone past the old 2.8 s life.
trigger.x = 1500;
trigger.y = 900;
blast.x = 1600;
blast.y = 900;
p0.x = 500;
p0.y = 500;
priv.plantMine(p0);
mine = w.projectiles.find((p) => p.active && p.type === 1 && p.owner === p0.slot);
for (let i = 0; i < 300; i++) w.step(SIM_DT, [idle, idle, idle]);
check(
  'an untriggered trap outlives the old timed mine',
  !!mine && mine.active,
  `active ${mine?.active}, fuse ${mine?.fuse}`,
);

// A fourth plant retires the oldest trap instead of exhausting the shared projectile pool.
priv.plantMine(p0);
priv.plantMine(p0);
priv.plantMine(p0);
check(
  'the live trap count is capped',
  mineCount(w, p0.slot) === MINE.maxActive,
  `got ${mineCount(w, p0.slot)}, cap ${MINE.maxActive}`,
);

// Heavy beam: charge to auto-fire, then release to cut it short. Releasing while the
// beam is live must end the root and start the full cooldown.
const beamWorld = new World('training', ['QA', 'TARGET'], 0, ARENAS[0], false, PROGRAM_ID.PROBE);
const beamP = beamWorld.players[0];
const target = beamWorld.players[1];
beamP.active = true;
beamP.alive = true;
beamP.energy = 100;
beamP.laserCd = 0;
beamP.laserT = 0;
beamP.laserChargeHeld = true;
beamP.laserChargeT = 0;
beamP.laserFacing = 0;
target.x = 1500;
target.y = 900;

for (let i = 0; i < 30 && beamP.laserT <= 0; i++) {
  beamWorld.step(SIM_DT, [frame(ACTION.CANDLE), idle]);
}
check('the shortened charge auto-fires the beam', beamP.laserT > 0, `laserT ${beamP.laserT}`);

beamWorld.step(SIM_DT, [idle, idle]);
check('releasing the heavy cuts the beam', beamP.laserT === 0, `laserT ${beamP.laserT}`);
check(
  'cutting the beam starts the full cooldown',
  beamP.laserCd > 0 && beamP.laserCd <= PLAYER.laserCooldown,
  `cooldown ${beamP.laserCd}`,
);
check(
  'the beam no longer roots the body after release',
  beamP.laserChargeHeld === false && !beamWorld.players[0].laserChargeHeld,
);
check('the shorter warm-up is configured', PLAYER.laserChargeTime === 0.45, `got ${PLAYER.laserChargeTime}`);

console.log(`\n${pass}/${pass + fail} checks passed`);
if (fail > 0) process.exitCode = 1;
