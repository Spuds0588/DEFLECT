import assert from 'node:assert/strict';
import { ARENAS } from '../src/game/arenas';
import {
  SERIES_LENGTHS,
  normalizeSeriesGames,
  normalizeSeriesMapRule,
  pickSeriesArena,
  seriesWinner,
} from '../src/game/series';

assert.deepEqual([...SERIES_LENGTHS], [1, 3, 5]);
assert.equal(normalizeSeriesGames(3), 3);
assert.equal(normalizeSeriesGames(5), 5);
assert.equal(normalizeSeriesGames(2), 1);
assert.equal(normalizeSeriesGames(Number.NaN), 1);
assert.equal(normalizeSeriesMapRule('fixed'), 'fixed');
assert.equal(normalizeSeriesMapRule(1), 'fixed');
assert.equal(normalizeSeriesMapRule('random'), 'random');
assert.equal(normalizeSeriesMapRule(undefined), 'random');

const pool = ARENAS.slice(0, 3);
const fixed = pickSeriesArena(pool, pool[1].id, 'fixed', -1);
assert.equal(fixed?.id, pool[1].id);
const randomFirst = pickSeriesArena(pool, pool[0].id, 'random', -1, () => 0);
assert.equal(randomFirst?.id, pool[0].id);
const randomNext = pickSeriesArena(pool, pool[0].id, 'random', pool[0].id, () => 0);
assert.equal(randomNext?.id, pool[1].id);
assert.equal(pickSeriesArena([], 0, 'random', -1), null);

assert.equal(seriesWinner([0, 0, 0]), -1);
assert.equal(seriesWinner([1, 0, 0]), 0);
assert.equal(seriesWinner([1, 1, 0]), -1);
assert.equal(seriesWinner([3, 1, 0]), 0);
assert.equal(seriesWinner([2, 3, 1]), 1);

console.log('SERIES: lengths 1/3/5, random avoids last map, fixed honors setup arena, ties detected');
