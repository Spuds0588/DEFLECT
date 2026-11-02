/**
 * Focused headless probe for the BROWSER arena. Not shipped.
 * Run with `npx tsx .tmp/browser-check.ts`.
 */
import { ARENAS, BROWSER_STATE, browserPhaseAt } from '../src/game/arenas';
import { SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';

const arena = ARENAS.find((a) => a.name === 'BROWSER');
if (!arena || !arena.browser) throw new Error('BROWSER arena missing');
const browser = arena.browser;
if (browser.pages.length !== 4) throw new Error(`expected four forum pages, got ${browser.pages.length}`);
if (browser.pages.some((p) => p.elements.length === 0)) throw new Error('a forum page has no cover');

const phases = new Set<number>();
for (let t = 0; t < 12; t += 0.01) phases.add(browserPhaseAt(t));
if (phases.size !== 5) throw new Error(`expected all five browser phases, got ${[...phases].join(',')}`);
if (BROWSER_STATE.slam !== 3) throw new Error('browser phase constants changed');

const w = new World('training', ['TEST'], 0, arena);
w.drone.active = false;
const p = w.players[0];
const link = browser.pages[0].link;
p.x = link.x + link.w * 0.5;
p.y = link.y + link.h * 0.5;
p.alive = true;
p.active = true;
p.iframes = 0;
const hp = p.hp;
let t = 0;
let hitAt = -1;
let clickAt = -1;
while (t < 7) {
  w.step(SIM_DT, [null]);
  // The training drone respawns on a timer; disable it every tick so the probe
  // isolates the browser cursor from its bolts.
  w.drone.active = false;
  t += SIM_DT;
  if (clickAt < 0 && w.browserClickT > 0) clickAt = t;
  if (hitAt < 0 && p.hp !== hp) hitAt = t;
}
if (clickAt < 0) throw new Error('browser click did not fire');
if (hitAt < 0) throw new Error('cursor click did not land near the link');
if (w.browserPage !== 1) throw new Error(`click did not advance the forum page; page ${w.browserPage}`);

const before = JSON.stringify(browser.pages[0].elements);
const after = JSON.stringify(browser.pages[1].elements);
if (before === after) throw new Error('forum page layouts are identical');

// A body placed inside the first card is pushed out by the active page cover.
const w2 = new World('training', ['TEST'], 0, arena);
w2.drone.active = false;
const p2 = w2.players[0];
const card = browser.pages[0].elements[0];
p2.x = card.x + card.w * 0.5;
p2.y = card.y + card.h * 0.5;
p2.alive = true;
p2.active = true;
for (let i = 0; i < 20; i++) {
  w2.step(SIM_DT, [null]);
  w2.drone.active = false;
}
const inside = p2.x > card.x && p2.x < card.x + card.w && p2.y > card.y && p2.y < card.y + card.h;
if (inside) throw new Error('browser card did not push the player out');

console.log(
  `BROWSER: ${browser.pages.length} pages, all five phases, click at ${clickAt.toFixed(2)}s, hit at ${hitAt.toFixed(2)}s, page ${w.browserPage}, cover pushes out`,
);
