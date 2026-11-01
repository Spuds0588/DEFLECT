/**
 * Series rules for match-based modes. A “game” is one ordinary match (first to
 * ROUND.winsNeeded rounds); a series is a fixed number of games. Maps are random
 * from the eligible pool by default, or fixed to the setup arena for a custom run.
 *
 * This module is deliberately pure: map selection, length normalization and series
 * scoring do not depend on the DOM, the network or World state.
 */
import type { ArenaDef } from './arenas';

export const SERIES_LENGTHS = [1, 3, 5] as const;
export type SeriesMapRule = 'random' | 'fixed';

export function normalizeSeriesGames(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return (SERIES_LENGTHS as readonly number[]).includes(value) ? Math.floor(value) : 1;
}

export function normalizeSeriesMapRule(value: unknown): SeriesMapRule {
  return value === 'fixed' || value === 1 || value === '1' ? 'fixed' : 'random';
}

/**
 * Pick the next arena in a series. Random avoids the most recently played map
 * until the eligible pool is exhausted; fixed always uses the setup arena. The
 * caller owns `lastId` and passes the returned id back on the next game.
 */
export function pickSeriesArena(
  pool: readonly ArenaDef[],
  setupArenaId: number,
  rule: SeriesMapRule,
  lastArenaId: number,
  random: () => number = Math.random,
): ArenaDef | null {
  if (pool.length === 0) return null;
  if (rule === 'fixed') {
    return pool.find((a) => a.id === setupArenaId) ?? pool[0];
  }
  const candidates = pool.filter((a) => a.id !== lastArenaId);
  const choices = candidates.length > 0 ? candidates : pool;
  const index = Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)));
  return choices[index];
}

/** Highest game-win count, or -1 for a tie / no games. */
export function seriesWinner(wins: readonly number[]): number {
  let best = -1;
  let bestWins = 0;
  let tied = false;
  for (let i = 0; i < wins.length; i++) {
    const w = wins[i];
    if (w > bestWins) {
      best = i;
      bestWins = w;
      tied = false;
    } else if (w === bestWins && w > 0) {
      tied = true;
    }
  }
  return tied ? -1 : best;
}
