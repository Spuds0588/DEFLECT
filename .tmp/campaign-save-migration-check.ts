/**
 * Campaign route migration probe.
 *
 * v2 moved TETRIS into the arcade and made NETWORK BOARD the finale. v3 inserts the
 * six-level ROAD TRIP before AIRPORT, so old slots from AIRPORT onward shift six levels.
 * A slot keeps the arena it was facing; a completed old route gets one final run at the
 * new NETWORK BOARD.
 *
 * Run with `npx tsx .tmp/campaign-save-migration-check.ts`.
 */
import { PLAYABLE_CAMPAIGN_LEVELS, migrateCampaignLevel } from '../src/game/campaign';
import { STORY_ROUTE_VERSION } from '../src/game/saves';

const current = (level: number, nodeId: string) =>
  migrateCampaignLevel(level, nodeId, STORY_ROUTE_VERSION);
const v2 = (level: number, nodeId = '') => migrateCampaignLevel(level, nodeId, 2);
const old = (level: number, nodeId = '') => migrateCampaignLevel(level, nodeId, 1);

// A current-route slot is never rewritten.
for (const level of [0, 9, 10, 15, 16, 27, 28, 35]) {
  if (current(level, '') !== level) throw new Error(`route 3 slot ${level} was remapped`);
}

// v2 slots: AIRPORT and everything after it shifts by six. A completed old route lands
// on the new NETWORK BOARD rather than off the end of the table.
const expectedV2: Array<[level: number, nodeId: string, next: number, arena: number]> = [
  [0, '', 0, 14],
  [9, 'business-laptop', 9, 29],
  [10, 'airport', 16, 23],
  [21, 'arcade', 27, 48],
  [22, 'food-court', 28, 42],
  [29, 'ai-core', 35, 39],
  [30, 'ai-core', 35, 39],
];
for (const [level, nodeId, next, arena] of expectedV2) {
  const mapped = v2(level, nodeId);
  if (mapped !== next) throw new Error(`v2 level ${level} mapped to ${mapped}, expected ${next}`);
  const levelDef = PLAYABLE_CAMPAIGN_LEVELS[mapped];
  if (!levelDef || levelDef.arenaId !== arena) {
    throw new Error(`v2 level ${level} resumed on ${levelDef?.name} (${levelDef?.arenaId}), expected arena ${arena}`);
  }
}

// v1 slots first take the v2 food-court shift, then the v3 road-trip shift.
const expectedOld: Array<[level: number, nodeId: string, next: number, arena: number]> = [
  [21, 'food-court', 28, 42], // SNACK MACHINE
  [22, 'food-court', 29, 43], // TOKEN DISPENSER
  [23, 'food-court', 30, 44], // SODA MACHINE
  [24, 'ai-core', 31, 37], // CPU BOARD
  [25, 'ai-core', 32, 38], // GPU BOARD
  [26, 'ai-core', 33, 40], // was NETWORK BOARD, now DISPATCH YARD
  [27, 'ai-core', 33, 40], // DISPATCH YARD already at its index
  [28, 'ai-core', 34, 41], // LOAD BALANCER
  [29, 'ai-core', 35, 39], // NETWORK BOARD
  [30, 'ai-core', 35, 39], // completed route gets one shot at the finale
];
for (const [level, nodeId, next, arena] of expectedOld) {
  const mapped = old(level, nodeId);
  if (mapped !== next) throw new Error(`old level ${level} mapped to ${mapped}, expected ${next}`);
  const levelDef = PLAYABLE_CAMPAIGN_LEVELS[mapped];
  if (!levelDef || levelDef.arenaId !== arena) {
    throw new Error(`old level ${level} resumed on ${levelDef?.name} (${levelDef?.arenaId}), expected arena ${arena}`);
  }
}

// Pre-food-court saves: 21 was the TETRIS finale and 22 was the completed campaign.
if (old(21, 'arcade') !== 27) throw new Error('pre-food-court level 21 no longer resumes on TETRIS');
if (old(22, 'arcade') !== 28) throw new Error('pre-food-court completed slot does not resume on SNACK MACHINE');
if (PLAYABLE_CAMPAIGN_LEVELS[27].name !== 'TETRIS') throw new Error('index 27 is not TETRIS');
if (PLAYABLE_CAMPAIGN_LEVELS[28].name !== 'SNACK MACHINE') throw new Error('index 28 is not SNACK MACHINE');
if (PLAYABLE_CAMPAIGN_LEVELS[35].name !== 'NETWORK BOARD') throw new Error('index 35 is not NETWORK BOARD');

// The old finale index now carries the new finale, and TETRIS is a normal arcade assault.
if (!PLAYABLE_CAMPAIGN_LEVELS[35].finale) throw new Error('NETWORK BOARD is not the finale');
if (PLAYABLE_CAMPAIGN_LEVELS[27].finale || PLAYABLE_CAMPAIGN_LEVELS[27].boss !== undefined) {
  throw new Error('TETRIS is still authored as a boss finale');
}

console.log('v2 route:', expectedV2.map(([level, , next]) => `${level}->${next}`).join(' '));
console.log('v1 route:', expectedOld.map(([level, , next]) => `${level}->${next}`).join(' '));
console.log('campaign-save-migration-check: OK (v2/v1 slots shift past ROAD TRIP, current slots untouched)');
