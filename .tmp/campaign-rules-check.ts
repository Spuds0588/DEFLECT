import { TutorialRunner, WARDEN_TUTORIAL } from '../src/game/tutorial';
import { World } from '../src/game/world';
import { ARENAS } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';

// 1. The lesson waits for the hands, not the clock.
const t = new TutorialRunner(WARDEN_TUTORIAL);
const idle = { mx: 0, my: 0, held: 0, pressed: 0 };
for (let i = 0; i < 60 * 40; i++) t.update({ dt: 1 / 60, frame: idle, lockActive: false, reflected: false });
console.log('after 40s idle: done=', t.done, 'step=', t.current?.id, 'action=', t.current?.action);
if (t.done) throw new Error('tutorial advanced past a required action with no input');
if (t.current?.action !== 'move') throw new Error('tutorial did not reach the first action step');
for (let i = 0; i < 60 * 3; i++) t.update({ dt: 1 / 60, frame: { mx: 1, my: 0, held: 0, pressed: 0 }, lockActive: false, reflected: false });
console.log('after moving: step=', t.current?.id, '(expected dash)');
if (t.current?.id !== 'dash') throw new Error('tutorial did not advance after the move goal was met');

// 2. The live route is the four split quarantine rooms, then the first network.
const route = PLAYABLE_CAMPAIGN_LEVELS.map((level) => [level.arenaId, level.intro]);
console.log('route:', route.map(([id, intro]) => `${id}:${intro}`).join(' -> '));
if (PLAYABLE_CAMPAIGN_LEVELS.length !== 30) throw new Error(`expected thirty playable levels, got ${PLAYABLE_CAMPAIGN_LEVELS.length}`);
const expectedArenas = [14, 34, 35, 36, 1, 9, 12, 25, 28, 29, 23, 33, 32, 18, 17, 10, 22, 24, 45, 46, 47, 48, 42, 43, 44, 37, 38, 40, 41, 39];
if (route.some(([id], i) => id !== expectedArenas[i])) {
  throw new Error('campaign route does not match the authored level-2 sequence');
}

const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'P';
const build = (index: number, bots = 0) => {
  const level = PLAYABLE_CAMPAIGN_LEVELS[index];
  const arena = ARENAS.find((a) => a.id === level.arenaId)!;
  return new World(
    'gauntlet', names, 0, arena, false, 0, bots, bots > 0 ? [11, 10, 9] : null, true,
    level.dataCrates, false, level.intro, level.clearKills, false, level.boss ?? -1, false,
  );
};

// 3. Intake's Warden lesson wakes the class; the class, not the clock, opens the portal.
const intake = build(0);
if (intake.campaignPhase !== 'calibration') throw new Error('intake did not open in calibration');
if (!intake.tutorial || intake.tutorial.current?.id !== 'quarantine') throw new Error('intake is not running the Warden lesson');
if (intake.props.some((p) => p.portal && !p.portalExit)) throw new Error('intake spawned ingress ports');
intake.skipTutorial();
const intakeIdle = new Array(MAX_PLAYERS).fill(null);
for (let i = 0; i < 90; i++) intake.step(SIM_DT, intakeIdle);
if (!intake.calibrationAwake) throw new Error('intake did not wake the three subjects after the lesson');
if (intake.sentries.filter((s) => s.active && s.kind >= 4 && s.kind <= 6).length !== 3) {
  throw new Error('intake did not place exactly three subjects at the lock lesson');
}
if (intake.campaignPortalT >= 0) throw new Error('intake opened its portal before the subjects woke');
if (intake.tutorial?.current?.id !== 'warden-shock') throw new Error('intake skipped the Warden shock line');
intake.skipTutorial();
for (let i = 0; i < 90; i++) intake.step(SIM_DT, intakeIdle);
if (intake.campaignPortalT >= 0) throw new Error('intake opened its portal with the class still alive');
for (const s of intake.sentries) if (s.kind >= 4 && s.kind <= 6) s.active = false;
for (let i = 0; i < 900 && intake.campaignPhase !== 'cleared'; i++) intake.step(SIM_DT, intakeIdle);
if (intake.campaignPhase !== 'cleared') throw new Error(`intake portal did not clear (${intake.campaignPhase})`);

// 4. Holding lands on kitty's line and owns the six-subject class plus the cell wave.
const holding = build(1);
const arrival = holding.tutorial?.current;
if (arrival?.speaker !== 'SCRIPT_KITTY' || arrival?.id !== 'kitty-worked') throw new Error('holding did not open on kitty saying it worked');
const shapes = holding.sentries.filter((s) => s.active && s.kind >= 4 && s.kind <= 6);
if (shapes.length !== 6) throw new Error(`expected six calibration subjects, got ${shapes.length}`);
if (holding.worms.filter((w) => w.active && w.held).length !== 2) throw new Error('holding does not have its two held worm chains');
if (holding.viruses.filter((v) => v.active && v.held).length !== 8) throw new Error('holding does not have its eight held viruses');

// 5. Feed rooms open live with their authored port counts and no calibration class.
for (const index of [2, 3]) {
  const level = PLAYABLE_CAMPAIGN_LEVELS[index];
  const world = build(index);
  if (world.campaignPhase !== 'assault') throw new Error(`${level.name} did not open in assault`);
  if (world.portTotal !== (world.arena.ingress?.length ?? 0)) throw new Error(`${level.name} portTotal mismatch`);
  if (world.sentries.some((s) => s.active && s.kind >= 4 && s.kind <= 6)) throw new Error(`${level.name} spawned calibration shapes`);
  if (world.dataTotal !== level.dataCrates.length) throw new Error(`${level.name} did not load its crates`);
  console.log(`${level.name}: ports=${world.portTotal} crates=${world.dataTotal}`);
}

console.log('campaign-rules-check: OK (intake wakes its class, kitty arrival, 30-node route, live feed rooms)');
