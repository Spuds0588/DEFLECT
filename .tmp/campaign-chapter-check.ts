import { ARENAS } from '../src/game/arenas';
import {
  CAMPAIGN_ROUTE,
  PLAYABLE_CAMPAIGN_LEVELS,
  campaignChapterForLevel,
} from '../src/game/campaign';
import { MAX_PLAYERS } from '../src/game/config';
import { SECTORS } from '../src/game/sectors';
import { World } from '../src/game/world';

if (PLAYABLE_CAMPAIGN_LEVELS.length !== 36) {
  throw new Error(`expected 36 levels, got ${PLAYABLE_CAMPAIGN_LEVELS.length}`);
}
if (CAMPAIGN_ROUTE.length !== 36) {
  throw new Error(`expected 36 per-level route stops, got ${CAMPAIGN_ROUTE.length}`);
}
if (PLAYABLE_CAMPAIGN_LEVELS.some((level, index) =>
  CAMPAIGN_ROUTE[index]?.level !== index ||
  CAMPAIGN_ROUTE[index]?.nodeId !== level.nodeId ||
  CAMPAIGN_ROUTE[index]?.label !== level.name
)) {
  throw new Error('route stops do not mirror the playable level order');
}
for (let i = 0; i < CAMPAIGN_ROUTE.length; i++) {
  const expected = i + 1 < CAMPAIGN_ROUTE.length ? [i + 1] : [];
  if (CAMPAIGN_ROUTE[i].links.join(',') !== expected.join(',')) {
    throw new Error(`route stop ${i} has links ${CAMPAIGN_ROUTE[i].links.join(',')}`);
  }
}
const expectedArenas = [
  14, 34, 35, 36, 1, 9, 12, 25, 28, 29,
  0, 21, 52, 49, 50, 51,
  23, 33,
  32, 18, 17,
  10, 22, 24, 45, 46, 47, 48,
  42, 43, 44,
  37, 38, 40, 41, 39,
];
const actualArenas = PLAYABLE_CAMPAIGN_LEVELS.map((level) => level.arenaId);
if (actualArenas.join(',') !== expectedArenas.join(',')) {
  throw new Error(`campaign route is ${actualArenas.join(',')}`);
}
const roadTripAt = PLAYABLE_CAMPAIGN_LEVELS.findIndex((level) => level.nodeId === 'road-trip');
if (roadTripAt < 0 || CAMPAIGN_ROUTE[roadTripAt].nodeId !== 'road-trip') {
  throw new Error('the road trip is not its own route stop');
}
for (const nodeId of ['arcade', 'food-court', 'ai-core']) {
  const at = PLAYABLE_CAMPAIGN_LEVELS.findIndex((level) => level.nodeId === nodeId);
  if (at < 0 || CAMPAIGN_ROUTE[at].nodeId !== nodeId) throw new Error(`${nodeId} has no route stop`);
}
if (!SECTORS[8] || SECTORS[8].name !== 'KISSINGFACE' || SECTORS[8].entry !== 'cpu' || SECTORS[8].exit !== 'network') {
  throw new Error('KISSINGFACE is not the authored sector 8 route');
}
if (!SECTORS[9] || SECTORS[9].name !== 'ROAD TRIP' || SECTORS[9].entry !== 'crossroads' || SECTORS[9].exit !== 'crosswalk') {
  throw new Error('ROAD TRIP is not the authored sector 9 route');
}
if (PLAYABLE_CAMPAIGN_LEVELS[10].sector !== 9) {
  throw new Error('CROSSROADS does not point at the ROAD TRIP sector');
}
if (PLAYABLE_CAMPAIGN_LEVELS[30].sector !== 7 || PLAYABLE_CAMPAIGN_LEVELS[31].sector !== 8) {
  throw new Error('food court and KISSINGFACE levels point at the wrong sectors');
}
const finale = PLAYABLE_CAMPAIGN_LEVELS.filter((level) => level.finale);
if (finale.length !== 1 || finale[0].arenaId !== 39 || finale[0].name !== 'NETWORK BOARD') {
  throw new Error(`expected NETWORK BOARD as the only finale, got ${finale.map((level) => level.name).join(', ')}`);
}
const tetris = PLAYABLE_CAMPAIGN_LEVELS.find((level) => level.arenaId === 48);
if (!tetris || tetris.boss !== undefined || tetris.finale) throw new Error('TETRIS is not a normal arcade assault');
if (PLAYABLE_CAMPAIGN_LEVELS[35].boss === undefined) throw new Error('NETWORK BOARD does not carry the USER finale');
if (PLAYABLE_CAMPAIGN_LEVELS[9].finale) throw new Error('BUSINESS LAPTOP is still marked finale');

const newIds = Array.from({ length: 26 }, (_, index) => index + 10);
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
    campaignChapterForLevel(level),
    level.opening ?? null,
    level.finale === true,
    0,
    level.blurb ?? null,
  );
  if (world.campaignPhase !== 'assault') throw new Error(`${level.name} did not open in assault`);
  if (world.tutorial?.current?.speaker !== 'SCRIPT_KITTY') throw new Error(`${level.name} did not start its blurb`);
  if (world.dataTotal !== level.dataCrates.length) throw new Error(`${level.name} did not load its crates`);
  if (world.friendlyFire) throw new Error(`${level.name} opened with campaign friendly fire on`);
  if (level.intro === 'assault' && level.boss === undefined && world.portTotal <= 0) {
    throw new Error(`${level.name} has no ingress port or fallback spawner`);
  }
  if (world.portTotal > 0) {
    for (const b of world.props) {
      if (!b.portal) continue;
      const inside = arena.pillars.some((r) => b.x + b.w > r.x && b.x < r.x + r.w && b.y + b.h > r.y && b.y < r.y + r.h);
      if (inside) throw new Error(`${level.name} has a port buried in cover`);
    }
  }
  if (level.boss === undefined) {
    let live = 0;
    for (const s of world.sentries) if (s.active) live++;
    for (const v of world.viruses) if (v.active) live++;
    for (const w of world.worms) if (w.active) live++;
    if (world.portTotal <= 0 && live < world.campaignKillsToClear) {
      throw new Error(`${level.name} opened with ${live} bodies and no port for a ${world.campaignKillsToClear}-kill clear`);
    }
  }
  console.log(`${level.name}: ${world.campaignPhase}, bodies ${world.sentries.filter((s) => s.active).length}/${world.viruses.filter((v) => v.active).length}/${world.worms.filter((w) => w.active).length}, ports ${world.portTotal}, crates ${world.dataTotal}`);
}

console.log('campaign-chapter-check: OK (36 levels, 36 route stops, every assault has a spawner, ROAD TRIP before AIRPORT, NETWORK BOARD finale)');
