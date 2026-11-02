/**
 * Focused headless probe for the DOCUMENT SCANNER arena. Not shipped.
 * Run with `npx tsx .tmp/scanner-check.ts`.
 */
import {
  ARENAS,
  SCANNER_STATE,
  scannerLaserY,
  scannerPhaseAt,
} from '../src/game/arenas';
import { SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';

const arena = ARENAS.find((a) => a.name === 'DOCUMENT SCANNER');
if (!arena || !arena.scanner) throw new Error('DOCUMENT SCANNER arena missing');
const scanner = arena.scanner;
if (scanner.documents.length < 2) throw new Error('expected a document stack');

const phases = new Set<number>();
let lowest = Infinity;
let highest = -Infinity;
for (let t = 0; t < 10; t += 0.01) {
  phases.add(scannerPhaseAt(t));
  const y = scannerLaserY(scanner, t);
  if (y >= 0) {
    lowest = Math.min(lowest, y);
    highest = Math.max(highest, y);
  }
}
if (phases.size !== 5) throw new Error(`expected all five scanner phases, got ${[...phases].join(',')}`);
if (lowest < scanner.y - 1 || highest > scanner.y + scanner.h + 1) {
  throw new Error(`laser left the bed: ${lowest.toFixed(1)}..${highest.toFixed(1)}`);
}

const w = new World('training', ['TEST'], 0, arena);
const p = w.players[0];
p.x = scanner.x + scanner.w * 0.5;
p.y = scanner.y + scanner.h * 0.5;
p.alive = true;
p.active = true;
p.iframes = 0;
const hp = p.hp;
let t = 0;
while (t < 5 && p.hp === hp) {
  w.step(SIM_DT, [null]);
  t += SIM_DT;
}
if (p.hp !== hp - 1) throw new Error(`expected one scan hit, hp ${p.hp} from ${hp}`);
if (p.alive === false) throw new Error('one scan hit should not be lethal');

console.log(
  `SCANNER: ${scanner.documents.length} documents, all phases seen, line ${lowest.toFixed(0)}..${highest.toFixed(0)}, first hit at ${t.toFixed(2)}s`,
);
