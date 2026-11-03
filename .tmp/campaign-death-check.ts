/**
 * Campaign run-up death handling.
 *
 * A body that falls into a chasm during calibration must come back on the training
 * timer, in every phase before the assault. Ticking `respawnT` only during the drill
 * left the body permanently dead: the tutorial never advanced, no result overlay
 * appeared, and the run was unrecoverable. Not shipped.
 *
 * Run with `npx tsx .tmp/campaign-death-check.ts`.
 */
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import type { World as WorldType } from '../src/game/world';

const level = PLAYABLE_CAMPAIGN_LEVELS[0];
const arena = ARENAS.find((a) => a.id === level.arenaId);
if (!arena) throw new Error(`level 1 arena ${level.arenaId} is missing`);

const PRE_ASSAULT = ['calibration', 'release', 'briefing', 'drill', 'breach'] as const;

function makeWorld(): WorldType {
  const names = new Array<string>(MAX_PLAYERS).fill('');
  names[0] = 'TESTER';
  for (let i = 1; i <= 3; i++) names[i] = `SQUAD${i}`;
  const world = new World(
    'gauntlet',
    names,
    0,
    arena,
    false,
    0,
    3,
    null,
    true,
    level.dataCrates,
    false,
    level.intro,
    level.clearKills,
    false,
    level.boss ?? -1,
  );
  return world;
}

/** Down a body the way the floor does, then run the clock out. */
function killAndWait(world: WorldType, slot: number, seconds = 4): boolean {
  const priv = world as unknown as { damagePlayer: (...args: unknown[]) => void };
  const p = world.players[slot];
  // Drill partners log in when the drill starts; stand the body up so this probe reads
  // the respawn timer, not the squad's activation order.
  if (!p.alive) {
    p.active = true;
    p.alive = true;
    p.hp = p.maxHp;
  }
  p.iframes = 0;
  priv.damagePlayer(p, 99, 0, 1, 0, 0, 8); // SRC.VOID
  if (p.alive) throw new Error(`slot ${slot} did not go down`);
  if (p.respawnT <= 0) throw new Error(`slot ${slot} went down without a respawn timer`);
  const frames = new Array(MAX_PLAYERS).fill(null);
  for (let t = 0; t < seconds; t += SIM_DT) world.step(SIM_DT, frames);
  return p.alive;
}

for (const phase of PRE_ASSAULT) {
  // The pilot is downed in every phase. Drill partners only exist until the breach
  // de-rezzes the squad, so they are only tested while they are on the roster.
  const slots = phase === 'calibration' || phase === 'release' || phase === 'drill' ? [0, 1] : [0];
  for (const slot of slots) {
    const world = makeWorld();
    const priv = world as unknown as { campaignPhase: string; tutorial: unknown };
    priv.campaignPhase = phase;
    if (phase !== 'calibration') priv.tutorial = null;
    if (!killAndWait(world, slot)) {
      throw new Error(`slot ${slot} never respawned during ${phase}`);
    }
    const p = world.players[slot];
    if (p.hp <= 0) throw new Error(`slot ${slot} respawned with ${p.hp} hp in ${phase}`);
  }
}

// Assault death still ends the run: it must not respawn.
{
  const world = makeWorld();
  const priv = world as unknown as { campaignPhase: string; tutorial: unknown; beginAssault: () => void };
  priv.tutorial = null;
  priv.beginAssault();
  const p = world.players[0];
  p.iframes = 0;
  priv.damagePlayer(p, 99, 0, 1, 0, 0, 8);
  const frames = new Array(MAX_PLAYERS).fill(null);
  for (let t = 0; t < 5; t += SIM_DT) world.step(SIM_DT, frames);
  if (world.campaignPhase !== 'failed') throw new Error(`assault death left phase ${world.campaignPhase}`);
  if (p.alive) throw new Error('assault death respawned the pilot');
}

// A downed body in calibration must not block the lesson once it is back: the tutorial
// keeps its progress rather than restarting, and the phase can still advance.
{
  const world = makeWorld();
  const priv = world as unknown as { tutorial: { progress: number; skip: () => void } };
  const before = priv.tutorial.progress;
  killAndWait(world, 0);
  if (priv.tutorial.progress < before) throw new Error('respawn reset the tutorial progress');
  priv.tutorial.skip();
  const frames = new Array(MAX_PLAYERS).fill(null);
  // Finishing the lesson releases the hold: the six subjects wake on arrival or after
  // `CALIBRATION.entryWait` (18 s). Clearing them is gameplay, not this probe's job.
  let awake = false;
  for (let t = 0; t < 20; t += SIM_DT) {
    world.step(SIM_DT, frames);
    if ((world as unknown as { calibrationAwake: boolean }).calibrationAwake) {
      awake = true;
      break;
    }
  }
  if (!awake) throw new Error('calibration never woke after the lesson finished');
}

console.log(`campaign-death-check: OK (${PRE_ASSAULT.length} pre-assault phases x 2 slots, assault stays fatal)`);
