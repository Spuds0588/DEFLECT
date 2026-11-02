import { ARENAS, laptopCardY, laptopCellRect } from '../src/game/arenas';
import { PLAYER, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';

const fail = (message: string): never => {
  throw new Error(message);
};

const sheetArena = ARENAS.find((arena) => arena.id === 30) ?? fail('SPREADSHEET is not arena 30');
const chatArena = ARENAS.find((arena) => arena.id === 31) ?? fail('CHAT is not arena 31');
if (sheetArena.name !== 'SPREADSHEET') fail('SPREADSHEET is not arena 30');
if (chatArena.name !== 'CHAT') fail('CHAT is not arena 31');

// --- SPREADSHEET ---------------------------------------------------------------
const sheetDef = sheetArena.laptop?.sheet ?? fail('SPREADSHEET has no sheet grid');
if (sheetArena.laptop?.variant !== 'sheet') fail('SPREADSHEET is not the sheet variant');
if (sheetDef.cells.length !== 17) fail(`expected 17 cells, got ${sheetDef.cells.length}`);
if (sheetDef.columns.length !== sheetDef.cols) fail('column labels do not match the grid');
const cellRect = { x: 0, y: 0, w: 0, h: 0 };
for (const cell of sheetDef.cells) {
  if (cell.col < 0 || cell.col >= sheetDef.cols) fail('cell column outside the grid');
  if (cell.row < 0 || cell.row >= sheetDef.rows) fail('cell row outside the grid');
  laptopCellRect(sheetDef, cell, cellRect);
  if (!(cellRect.w === sheetDef.cellW && cellRect.h === sheetDef.cellH)) fail('cell rect is not the cell size');
  const screen = sheetArena.laptop!.screen;
  if (cellRect.x < screen.x || cellRect.x + cellRect.w > screen.x + screen.w) fail('cell escapes the screen');
  if (cellRect.y < screen.y || cellRect.y + cellRect.h > screen.y + screen.h) fail('cell escapes the screen');
}
// Two adjacent cells must leave a real corridor between them.
if (sheetDef.gap < PLAYER.radius * 3) fail(`corridor ${sheetDef.gap} is too narrow for a body`);

const sheetWorld = new World('training', ['SPREADSHEET'], 0, sheetArena);
sheetWorld.drone.active = false;
sheetWorld.drone.respawnT = 1e9;
if (sheetWorld.laptopSolids.length !== 17) fail(`expected 17 cell solids, got ${sheetWorld.laptopSolids.length}`);
for (const spawn of sheetArena.spawns) {
  for (const solid of sheetWorld.laptopSolids) {
    if (solid.w <= 0 || solid.h <= 0) continue;
    const nx = Math.max(solid.x, Math.min(spawn.x, solid.x + solid.w));
    const ny = Math.max(solid.y, Math.min(spawn.y, solid.y + solid.h));
    if (Math.hypot(spawn.x - nx, spawn.y - ny) < PLAYER.radius) fail(`spawn ${spawn.x},${spawn.y} starts inside a cell`);
  }
}
// A direct shot spends one cell hit, then clears it.
const firstCell = sheetDef.cells[0];
laptopCellRect(sheetDef, firstCell, cellRect);
const shot = {
  x: cellRect.x + cellRect.w * 0.5,
  y: cellRect.y + cellRect.h * 0.5,
  radius: 6,
  owner: 0,
  active: true,
} as any;
const damage = (sheetWorld as any).damageLaptopCell.bind(sheetWorld);
if (!damage(shot)) fail('a shot inside a cell did not register');
if (sheetWorld.laptopCellHp[0] !== 1) fail(`cell did not take one hit, hp ${sheetWorld.laptopCellHp[0]}`);
if (sheetWorld.laptopSolids[0].w <= 0) fail('a damaged cell should still block');
if (!damage(shot)) fail('the second shot did not register');
if (sheetWorld.laptopCellHp[0] !== 0) fail('cell did not clear after two hits');
if (sheetWorld.laptopSolids[0].w !== 0 || sheetWorld.laptopSolids[0].h !== 0) fail('a cleared cell still blocks');
if (damage(shot)) fail('a cleared cell still takes hits');
if ((sheetWorld as any).laptopCoverAt(cellRect.x + cellRect.w * 0.5, cellRect.y + cellRect.h * 0.5, 6)) {
  fail('a cleared cell still reports cover');
}
laptopCellRect(sheetDef, sheetDef.cells[1], cellRect);
if (!(sheetWorld as any).laptopCoverAt(cellRect.x + cellRect.w * 0.5, cellRect.y + cellRect.h * 0.5, 6)) {
  fail('an intact neighbouring cell stopped covering its own square');
}
// The cursor walks the columns on its own clock.
for (let t = 0; t < sheetDef.cursorEvery * 2.2; t += SIM_DT) sheetWorld.step(SIM_DT, [null]);
if (sheetWorld.laptopCursor !== 2) fail(`cursor did not advance, got ${sheetWorld.laptopCursor}`);
if (buildSnapshotHazards(sheetWorld) !== null) fail('SPREADSHEET leaked into SnapshotHazards');
sheetWorld.beginRound();
if (sheetWorld.laptopCellHp[0] !== 2) fail('round reset did not restore cell health');
if (sheetWorld.laptopSolids[0].w <= 0) fail('round reset did not restore cell cover');
if (sheetWorld.laptopCursor !== 0) fail('round reset did not rewind the cursor');

// --- CHAT ----------------------------------------------------------------------
const chatLap = chatArena.laptop ?? fail('CHAT has no laptop record');
if (chatLap.variant !== 'chat') fail('CHAT is not the chat variant');
if (chatLap.messages.length !== 8) fail('CHAT expects eight bubble lines');
if (chatLap.cards !== 8) fail('CHAT expects eight bubbles on the conveyor');
if (chatLap.messages.some((message) => message.layout.length > 0)) fail('CHAT messages must not add preview cover');
if (chatLap.cardGap < PLAYER.radius * 3) fail(`chat gap ${chatLap.cardGap} is too narrow for bodies`);
const bubble = chatLap.bubbleW ?? 0.58;
if (!(bubble > 0.3 && bubble < 1)) fail('chat bubbles must leave an open lane');

const chatWorld = new World('training', ['CHAT'], 0, chatArena);
chatWorld.drone.active = false;
chatWorld.drone.respawnT = 1e9;
if (chatWorld.laptopSolids.length !== chatLap.cards) fail(`expected ${chatLap.cards} bubbles, got ${chatWorld.laptopSolids.length}`);
if (!(chatWorld.laptopSolids[0].x > chatWorld.laptopSolids[1].x)) fail('chat bubbles do not alternate sides');
const firstBubbleY = chatWorld.laptopSolids[0].y;
for (let t = 0; t < 1; t += SIM_DT) chatWorld.step(SIM_DT, [null]);
if (!(chatWorld.laptopSolids[0].y < firstBubbleY)) fail('chat bubbles did not rise');
// Spawns stay clear of the bubbles across a full scroll cycle.
for (let t = 0; t < 14; t += 0.5) {
  for (const spawn of chatArena.spawns) {
    for (const solid of chatWorld.laptopSolids) {
      if (solid.w <= 0 || solid.h <= 0) continue;
      const nx = Math.max(solid.x, Math.min(spawn.x, solid.x + solid.w));
      const ny = Math.max(solid.y, Math.min(spawn.y, solid.y + solid.h));
      if (Math.hypot(spawn.x - nx, spawn.y - ny) < PLAYER.radius) {
        fail(`spawn ${spawn.x},${spawn.y} is inside a bubble at t=${t.toFixed(1)}`);
      }
    }
  }
  for (let s = 0; s < 15; s++) chatWorld.step(SIM_DT, [null]);
}
if (buildSnapshotHazards(chatWorld) !== null) fail('CHAT leaked into SnapshotHazards');
if (!(laptopCardY(chatLap, 0, 0) > laptopCardY(chatLap, 0, 1))) fail('chat card clock does not travel upward');
// Each bubble wraps below the pane on its own; a wrap must never happen on-screen or move the
// whole list at once.
const chatTop = chatLap.inbox.y;
const chatBottom = chatTop + chatLap.inbox.h;
const chatStep = chatLap.cardH + chatLap.cardGap;
const chatCycle = (chatStep * chatLap.cards) / chatLap.speed;
for (let i = 0; i < chatLap.cards; i++) {
  let prev = laptopCardY(chatLap, i, 0);
  let wraps = 0;
  for (let t = SIM_DT; t <= chatCycle + SIM_DT; t += SIM_DT) {
    const y = laptopCardY(chatLap, i, t);
    const dy = y - prev;
    if (dy > 0.001) {
      wraps += 1;
      if (!(prev + chatLap.cardH <= chatTop && y >= chatBottom)) {
        fail(`bubble ${i} wrapped on-screen at t=${t.toFixed(2)}`);
      }
    }
    prev = y;
  }
  if (wraps !== 1) fail(`bubble ${i} wrapped ${wraps} times in one cycle`);
}
// Visible bubbles keep the authored gap all the way through the cycle.
for (let t = 0; t < chatCycle; t += 1) {
  const tops: number[] = [];
  for (let i = 0; i < chatLap.cards; i++) {
    const y = laptopCardY(chatLap, i, t);
    if (y >= chatTop && y + chatLap.cardH <= chatBottom) tops.push(y);
  }
  tops.sort((a, b) => a - b);
  for (let i = 1; i < tops.length; i++) {
    if (tops[i] - (tops[i - 1] + chatLap.cardH) < chatLap.cardGap - 0.01) {
      fail(`visible bubbles crowd each other at t=${t.toFixed(1)}`);
    }
  }
}

console.log(
  JSON.stringify({
    arenas: ARENAS.length,
    sheet: { id: sheetArena.id, cells: sheetDef.cells.length, gap: sheetDef.gap, cellHp: sheetWorld.laptopCellHp[0] },
    chat: { id: chatArena.id, cards: chatLap.cards, bubbleW: bubble },
    hazards: 0,
  }),
);
