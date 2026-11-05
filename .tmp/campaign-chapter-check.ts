import { ARENAS } from '../src/game/arenas';
import { CAMPAIGN_ROUTE, PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS } from '../src/game/config';
import { World } from '../src/game/world';

if (PLAYABLE_CAMPAIGN_LEVELS.length !== 22) {
  throw new Error(`expected 22 levels, got ${PLAYABLE_CAMPAIGN_LEVELS.length}`);
}
if (CAMPAIGN_ROUTE.length !== 10) {
  throw new Error(`expected 10 chapter stops, got ${CAMPAIGN_ROUTE.length}`);
}
const finale = PLAYABLE_CAMPAIGN_LEVELS.filter((level) => level.finale);
if (finale.length !== 1 || finale[0].arenaId !== 48) {
  throw new Error(`expected TETRIS as the only finale, got ${finale.map((level) => level.name).join(', ')}`);
}
if (PLAYABLE_CAMPAIGN_LEVELS[9].finale) throw new Error('BUSINESS LAPTOP is still marked finale');

const newIds = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'P';
for (const id of newIds) {
  const level = PLAYABLE_CAMPAIGN_LEVELS.find((entry) => entry.id === id);
  if (!level) throw new Error(`missing level ${id}`);
  const arena = ARENAS.find((entry) => entry.id === level.arenaId);
  if (!arena) throw new Error(`missing arena ${level.arenaId} for ${level.name}`);
  if (!level.blurb || level.blurb.length < 2) throw new Error(`${level.name} has no arrival blurb`);
  for (const step of level.blurb) {
    if (step.speaker !== 'SCRIPT_KITTY') throw new Error(`${level.name} blurb is not kitty`);
    if (!step.line.trim()) throw new Error(`${level.name} has an empty blurb line`);
  }
  for (const data of level.dataCrates) {
    const b = arena.bounds;
    if (data.x < b.left || data.x > b.right || data.y < b.top || data.y > b.bottom) {
      throw new Error(`${level.name} crate is outside the arena`);
    }
    if (arena.pillars.some((p) => data.x >= p.x && data.x <= p.x + p.w && data.y >= p.y && data.y <= p.y + p.h)) {
      throw new Error(`${level.name} crate is inside cover`);
    }
  }

  const world = new World(
    'gauntlet',
    names,
    0,
    arena,
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
    false,
    level.opening ?? null,
    level.finale === true,
    0,
    level.blurb ?? null,
  );
  if (world.campaignPhase !== 'assault') throw new Error(`${level.name} did not open in assault`);
  if (world.tutorial?.current?.speaker !== 'SCRIPT_KITTY') throw new Error(`${level.name} did not start its blurb`);
  if (world.dataTotal !== level.dataCrates.length) throw new Error(`${level.name} did not load its crates`);
  if (level.boss === undefined) {
    let live = 0;
    for (const s of world.sentries) if (s.active) live++;
    for (const v of world.viruses) if (v.active) live++;
    for (const w of world.worms) if (w.active) live++;
    if (live < world.campaignKillsToClear) {
      throw new Error(`${level.name} opened with ${live} bodies for a ${world.campaignKillsToClear}-kill clear`);
    }
  }
  console.log(`${level.name}: ${world.campaignPhase}, bodies ${world.sentries.filter((s) => s.active).length}/${world.viruses.filter((v) => v.active).length}/${world.worms.filter((w) => w.active).length}, crates ${world.dataTotal}`);
}

console.log('campaign-chapter-check: OK (22 levels, 10 stops, kitty blurbs, live openings, TETRIS finale)');
