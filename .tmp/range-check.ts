/** TEST RANGE probe: the sandbox is huge, empty and hidden from menus. */
import { ARENAS } from '../src/game/arenas';

const fail = (m: string): never => {
  throw new Error(m);
};
const range = ARENAS.find((a) => a.qa) ?? fail('no QA arena in the registry');
if (!range.pillars || range.pillars.length !== 0) fail('the test range has pillars');
if (range.voids && range.voids.length) fail('the test range has floor voids');
if (range.emitters && range.emitters.length) fail('the test range has emitters');
if (range.pushers) fail('the test range has a compactor');
if (range.props && range.props.length) fail('the test range has props');
if (range.islands && range.islands.length) fail('the test range has islands');
const w = range.bounds.right - range.bounds.left;
const h = range.bounds.bottom - range.bounds.top;
if (w < 3000 || h < 1800) fail(`the range is only ${w}x${h}`);
if (range.spawns.length < 8) fail('the range has too few spawn points');
console.log('range-check: OK', JSON.stringify({ name: range.name, bounds: [w, h], spawns: range.spawns.length }));
