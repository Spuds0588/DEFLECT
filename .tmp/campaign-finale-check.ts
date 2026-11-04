/**
 * Level 1 opening and closing beats.
 *
 * Intake must place only three subjects (one of each primary) at the lock lesson, then
 * give Kitty her exit line before the portal. The final node must start with its authored
 * squad, clear through the Mega Worm, play the finale lines and only then pull the squad.
 *
 * Run with `npx tsx .tmp/campaign-finale-check.ts`.
 */
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { getArena } from '../src/game/arenas';
import { World } from '../src/game/world';

const fail = (m: string): never => {
  throw new Error(m);
};

const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'FINALE';
const idle = new Array(MAX_PLAYERS).fill(null);
const intakeLevel = PLAYABLE_CAMPAIGN_LEVELS[0];
const bossLevel = PLAYABLE_CAMPAIGN_LEVELS.find((level) => level.finale === true) ?? fail('no finale level');

function make(level: (typeof PLAYABLE_CAMPAIGN_LEVELS)[number]): World {
  return new World(
    'gauntlet',
    names,
    0,
    getArena(level.arenaId),
    false,
    0,
    0,
    null,
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
}

// --- Intake: no class until the lock lesson, three subjects, Kitty exit ---------------
{
  const world = make(intakeLevel);
  const before = world.sentries.filter((s) => s.active && s.kind >= 4 && s.kind <= 6);
  if (before.length !== 0) fail(`intake loaded ${before.length} subjects before the lock lesson`);

  world.skipTutorial();
  for (let i = 0; i < 120 && !world.calibrationAwake; i++) world.step(SIM_DT, idle);
  const shapes = world.sentries.filter((s) => s.active && s.kind >= 4 && s.kind <= 6);
  if (!world.calibrationAwake) fail('intake class never woke after the Warden lesson');
  if (shapes.length !== 3) fail(`intake placed ${shapes.length} subjects, expected 3`);
  if (new Set(shapes.map((s) => s.kind)).size !== 3) fail('intake subjects are not one of each primary');
  world.skipTutorial();
  for (const s of world.sentries) if (s.kind >= 4 && s.kind <= 6) s.active = false;

  let sawExit = false;
  for (let i = 0; i < 600 && !sawExit; i++) {
    world.step(SIM_DT, idle);
    sawExit = world.campaignPhase === 'exit';
  }
  if (!sawExit) fail(`intake never reached the Kitty exit phase (${world.campaignPhase})`);
  if (world.tutorial?.current?.id !== 'intake-kitty') {
    fail(`intake exit line is ${world.tutorial?.current?.id ?? 'missing'}`);
  }
  world.skipTutorial();
  for (let i = 0; i < 360 && world.campaignPhase !== 'cleared'; i++) world.step(SIM_DT, idle);
  if (world.campaignPhase !== 'cleared') fail(`intake did not clear after the exit beat (${world.campaignPhase})`);
  if (world.players[0].x < getArena(intakeLevel.arenaId).bounds.right - 60) {
    fail('intake portal did not pull the body to the right wall');
  }
  console.log('intake: three subjects // Kitty exit // portal clear');
}

// --- Final node: opening squad, Mega clear, finale narration, then pull ----------------
{
  if (!bossLevel.opening) fail('finale level has no authored opening squad');
  if (!bossLevel.finale) fail('finale level is not marked finale');
  const world = make(bossLevel);
  const priv = world as any;
  priv.tutorial = null;
  priv.campaignPhase = 'assault';
  priv.beginAssault();
  const sentries = world.sentries.filter((s) => s.active).length;
  const viruses = world.viruses.filter((v) => v.active).length;
  const worms = world.worms.filter((w) => w.active).length;
  if (sentries !== bossLevel.opening.sentries || viruses !== bossLevel.opening.viruses || worms !== bossLevel.opening.worms) {
    fail(`finale opening ${sentries}/${viruses}/${worms}, expected ${bossLevel.opening.sentries}/${bossLevel.opening.viruses}/${bossLevel.opening.worms}`);
  }

  // The run-up is over: all feeds and fodder are gone, and the Mega Worm is the last body.
  for (const p of world.props) p.active = false;
  for (const s of world.sentries) s.active = false;
  for (const v of world.viruses) v.active = false;
  for (const w of world.worms) w.active = false;
  for (const e of world.errors) e.active = false;
  priv.portsClosed = world.portTotal;
  priv.campaignBossSpawned = true;
  priv.campaignBossWarned = true;
  priv.bossIntro = null;

  let sawFinale = false;
  for (let i = 0; i < 300 && !sawFinale; i++) {
    world.step(SIM_DT, idle);
    sawFinale = world.campaignPhase === 'finale';
  }
  if (!sawFinale) fail(`finale did not start after the Mega clear (${world.campaignPhase})`);
  if (world.tutorial?.current?.id !== 'finale-found') {
    fail(`finale line is ${world.tutorial?.current?.id ?? 'missing'}`);
  }
  world.skipTutorial();
  for (let i = 0; i < 360 && world.campaignPhase !== 'cleared'; i++) world.step(SIM_DT, idle);
  if (world.campaignPhase !== 'cleared') fail(`finale did not clear after the pull (${world.campaignPhase})`);
  if (!world.gauntletOver) fail('finale cleared without freezing the arena under the result card');
  console.log('finale: opening squad // Mega clear // Kitty trail // portal result');
}

console.log('campaign-finale-check: OK');
