/**
 * Focused headless probe for the KEYPAD arena. Not shipped.
 * Run with `npx tsx .tmp/keypad-check.ts`.
 */
import { ARENAS, KEYPAD_STATE, keypadKeyPhase, keypadKeyState } from '../src/game/arenas';
import { KEYPAD, PLAYER, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';

const arena = ARENAS.find((a) => a.name === 'KEYPAD');
if (!arena || !arena.keypad) throw new Error('KEYPAD arena missing');
const kp = arena.keypad;
const b = arena.bounds;
if (kp.keys.length !== 10) throw new Error(`expected 10 keys, got ${kp.keys.length}`);

// The housing is the whole playable arena: no exterior floor or spawn gutter.
if (kp.x !== b.left || kp.y !== b.top || kp.x + kp.w !== b.right || kp.y + kp.h !== b.bottom) {
  throw new Error(`bounds ${b.left},${b.top},${b.right},${b.bottom} are not the keypad edge-to-edge`);
}
if (kp.w < 2200 || kp.h < 2400) throw new Error(`pad is not massive: ${kp.w}x${kp.h}`);
const minKeyW = Math.min(...kp.keys.map((k) => k.w));
const minKeyH = Math.min(...kp.keys.map((k) => k.h));
if (minKeyW < 600 || minKeyH < 480) {
  throw new Error(`key caps are not massive relative to a ${PLAYER.radius * 2}-unit body: ${minKeyW}x${minKeyH}`);
}

const spawnSeen = new Set<string>();
for (const s of arena.spawns) {
  const id = `${s.x},${s.y}`;
  if (spawnSeen.has(id)) throw new Error(`duplicate spawn ${id}`);
  spawnSeen.add(id);
  if (
    s.x - PLAYER.radius < b.left ||
    s.x + PLAYER.radius > b.right ||
    s.y - PLAYER.radius < b.top ||
    s.y + PLAYER.radius > b.bottom
  ) {
    throw new Error(`spawn ${id} is outside the bounds`);
  }
  for (const k of kp.keys) {
    const nx = Math.max(k.x, Math.min(s.x, k.x + k.w));
    const ny = Math.max(k.y, Math.min(s.y, k.y + k.h));
    if (Math.hypot(s.x - nx, s.y - ny) < PLAYER.radius + 4) {
      throw new Error(`spawn ${id} overlaps key ${k.digit}`);
    }
  }
}
if (spawnSeen.size !== 8) throw new Error(`expected 8 spawns, got ${spawnSeen.size}`);

const seen = new Set<number>();
for (let t = 0; t < KEYPAD.period * 1.2; t += 0.01) {
  for (let i = 0; i < kp.keys.length; i++) {
    const phase = keypadKeyPhase(kp, i, t);
    if (phase < 0 || phase >= KEYPAD.period) throw new Error(`key ${i} phase out of range: ${phase}`);
    seen.add(keypadKeyState(kp, i, t));
  }
}
if (seen.size !== 5) throw new Error(`expected all five key states, got ${[...seen].join(',')}`);
if (
  KEYPAD.period < 28 ||
  KEYPAD.warn < 3.8 ||
  KEYPAD.slam < 1.1 ||
  KEYPAD.rise < 1.4 ||
  KEYPAD.offsetStep < 2.8
) {
  throw new Error(
    `key press is too fast: period ${KEYPAD.period}, warn ${KEYPAD.warn}, slam ${KEYPAD.slam}, ` +
      `rise ${KEYPAD.rise}, offset ${KEYPAD.offsetStep}`,
  );
}

const w = new World('training', ['TEST'], 0, arena);
w.drone.active = false;
const p = w.players[0];
const key = kp.keys[0];
p.x = key.x + key.w * 0.5;
p.y = key.y + key.h * 0.5;
p.alive = true;
p.active = true;
p.iframes = 0;

let t = 0;
while (t < KEYPAD.warn + 1.5 && p.alive) {
  w.step(SIM_DT, [null]);
  t += SIM_DT;
}
if (p.alive) throw new Error(`expected key 0 slam to crush the body; survived ${t.toFixed(2)}s`);
if (Math.abs(t - KEYPAD.warn) > 0.12) {
  throw new Error(`expected a crush near the ${KEYPAD.warn}s warning end, got ${t.toFixed(2)}s`);
}
console.log(
  `KEYPAD: ${kp.keys.length} keys, ${kp.w}x${kp.h} pad = bounds, ` +
    `keys ${minKeyW}x${minKeyH}, 8 bezel spawns clear, all states seen, ` +
    `${KEYPAD.warn}s warning, ${KEYPAD.slam}s sink, crush at ${t.toFixed(2)}s`,
);
