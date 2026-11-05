/**
 * Campaign route migration probe.
 *
 * v0.1.204 moved TETRIS into the arcade and made NETWORK BOARD the finale. A slot saved
 * against the old order stores the completed count, so every level from SNACK MACHINE
 * through the old NETWORK BOARD shifts one arena later; the request floor and the old
 * finale already line up with the new indices.
 *
 * Run with `npx tsx .tmp/campaign-save-migration-check.ts`.
 */
import { PLAYABLE_CAMPAIGN_LEVELS, migrateCampaignLevel } from '../src/game/campaign';
import { STORY_ROUTE_VERSION } from '../src/game/saves';

const current = (level: number, nodeId: string) =>
  migrateCampaignLevel(level, nodeId, STORY_ROUTE_VERSION);

const old = (level: number, nodeId = '') => migrateCampaignLevel(level, nodeId, 1);

// A current-route slot is never rewritten.
for (const level of [0, 21, 22, 26, 29]) {
  if (current(level, '') !== level) throw new Error(`route 2 slot ${level} was remapped`);
}

const expectedOld: Array<[level: number, nodeId: string, next: number, arena: number]> = [
  [21, 'food-court', 22, 42], // SNACK MACHINE, unchanged beat
  [22, 'food-court', 23, 43], // TOKEN DISPENSER
  [23, 'food-court', 24, 44], // SODA MACHINE
  [24, 'ai-core', 25, 37], // CPU BOARD
  [25, 'ai-core', 26, 38], // GPU BOARD
  [26, 'ai-core', 27, 40], // was NETWORK BOARD, now DISPATCH YARD
  [27, 'ai-core', 27, 40], // DISPATCH YARD already at its index
  [28, 'ai-core', 28, 41], // LOAD BALANCER already at its index
  [29, 'ai-core', 29, 39], // old TETRIS finale is now the NETWORK BOARD finale
  [30, 'ai-core', 29, 39], // completed route gets one shot at the new finale
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
if (old(21, 'arcade') !== 21) throw new Error('pre-food-court level 21 no longer resumes on TETRIS');
if (old(22, 'arcade') !== 22) throw new Error('pre-food-court completed slot does not resume on SNACK MACHINE');
if (PLAYABLE_CAMPAIGN_LEVELS[21].name !== 'TETRIS') throw new Error('index 21 is not TETRIS');
if (PLAYABLE_CAMPAIGN_LEVELS[22].name !== 'SNACK MACHINE') throw new Error('index 22 is not SNACK MACHINE');
if (PLAYABLE_CAMPAIGN_LEVELS[29].name !== 'NETWORK BOARD') throw new Error('index 29 is not NETWORK BOARD');

// The old finale index now carries the new finale, and TETRIS is a normal arcade assault.
if (!PLAYABLE_CAMPAIGN_LEVELS[29].finale) throw new Error('NETWORK BOARD is not the finale');
if (PLAYABLE_CAMPAIGN_LEVELS[21].finale || PLAYABLE_CAMPAIGN_LEVELS[21].boss !== undefined) {
  throw new Error('TETRIS is still authored as a boss finale');
}

console.log('old route:', expectedOld.map(([level, , next]) => `${level}->${next}`).join(' '));
console.log('campaign-save-migration-check: OK (21-26 shift, request floor/finale fixed, current slots untouched)');
