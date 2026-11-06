/**
 * Campaign calibration probe: a companion must not pick a dormant primitive as a
 * hostile before the Warden wakes the class. Same sentry pool, same bot scan, no
 * special-case input.
 */
import { ARENAS } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { BotBrain } from '../src/game/bot';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};
const level = PLAYABLE_CAMPAIGN_LEVELS[0] ?? fail('level 0 is missing');
const arena = ARENAS.find((a) => a.id === level.arenaId) ?? fail('intake arena is missing');
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'HUMAN';
names[1] = 'BOT-1';
const world = new World(
  'gauntlet',
  names,
  0,
  arena,
  false,
  0,
  1,
  null,
  true,
  level.dataCrates,
  false,
  'warden',
  level.clearKills,
  false,
  -1,
  1,
) as any;
world.tutorial = null;
world.phase = 'practice';
world.campaignPhase = 'calibration';
world.spawnCalibrationShapes(3);
world.calibrationAwake = false;
const dormant = world.sentries.filter((s: any) => s.active);
if (dormant.length < 3) fail(`expected three calibration subjects, got ${dormant.length}`);
if (!dormant.every((s: any) => s.kind >= 4 && s.kind <= 6 && s.shapeState < 2)) {
  fail('calibration subjects are not in the dormant shape state');
}

const brain = new BotBrain(1, 'veteran', 0, 0x5151);
const frame = { mx: 0, my: 0, held: 0, pressed: 0 };
for (let i = 0; i < 30; i++) brain.think(world, frame, SIM_DT);
if ((brain as any).hostileKind !== -1) {
  fail(`companion targeted dormant primitive kind ${(brain as any).hostileKind}`);
}

world.wakeCalibration(true);
// `wakeCalibration` starts the opening animation; the brain's target gate opens at
// shapeState 2. Finish that transition directly instead of stepping the tutorial.
for (const s of world.sentries) if (s.active) s.shapeState = 2;
brain.reset();
for (let i = 0; i < 30; i++) brain.think(world, frame, SIM_DT);
if ((brain as any).hostileKind !== 2) {
  fail(`companion did not engage the awakened class (hostileKind ${(brain as any).hostileKind})`);
}

console.log('dormant-primitive-check: OK (no target before wake // sentry engaged after wake)');
