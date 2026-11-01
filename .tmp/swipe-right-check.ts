import { ARENAS, swipePopupActiveAt } from '../src/game/arenas';
import { PLAYER } from '../src/game/config';
import { buildSnapshotHazards, NetView, parseSnapshot } from '../src/net/net';
import { World } from '../src/game/world';
import type { InputFrame } from '../src/game/types';

const arena = ARENAS.find((a) => a.name === 'SWIPE RIGHT');
if (!arena) throw new Error('SWIPE RIGHT missing');
if (arena.id !== 16) throw new Error(`SWIPE RIGHT has id ${arena.id}, expected 16`);
const swipe = arena.swipe;
if (!swipe) throw new Error('SWIPE RIGHT has no swipe record');
if (swipe.profiles.length < 4) throw new Error('profile deck is too small');

const zero: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
const world = new World('training', ['SWIPE'], 0, arena);
world.drone.active = false;
world.drone.respawnT = 1e9;
const p = world.players[0];
if (!p || !p.alive) throw new Error('training player did not spawn');

// A parked body is carried in the swipe direction on the first beat.
p.x = 740;
p.y = 500;
p.fallT = 0;
const startX = p.x;
for (let i = 0; i < 5 * 60; i++) world.step(1 / 60, [zero]);
if (world.swipeT < 4.9) throw new Error('swipe clock did not advance');
if (p.x < startX + 80) throw new Error(`swipe did not carry the player (${startX} -> ${p.x})`);
const carriedX = p.x;

// The popup is solid while it is raised, and a body caught under it is displaced out.
world.swipePopupT = swipe.popupWarn + 0.1;
p.x = 740;
p.y = 900;
world.step(1 / 60, [zero]);
if (!world.swipePopupSolid) throw new Error('match popup never became solid');
if (!swipePopupActiveAt(swipe, world.swipePopupT)) throw new Error('popup active helper disagrees');
const pop = swipe.popup;
const nearestX = Math.max(pop.x, Math.min(p.x, pop.x + pop.w));
const nearestY = Math.max(pop.y, Math.min(p.y, pop.y + pop.h));
const clearOfPopup = Math.hypot(p.x - nearestX, p.y - nearestY) >= PLAYER.radius - 0.01;
if (!clearOfPopup) throw new Error(`popup did not displace the body (${p.x}, ${p.y})`);

// The floor returns when the popup falls, and the solid is removed from collision.
world.swipePopupT = swipe.popupPeriod - 0.01;
world.step(1 / 60, [zero]);
if (world.swipePopupSolid) throw new Error('match popup stayed solid after its cycle');

// Snapshot shape: usb at 6, swipe clocks at 7/8, props at 9.
const hazards = buildSnapshotHazards(world);
if (!Array.isArray(hazards)) throw new Error('SWIPE hazards block missing');
if (Math.abs(Number(hazards[7]) - world.swipeT) > 0.011) throw new Error('snapshot swipe clock mismatch');
if (Math.abs(Number(hazards[8]) - world.swipePopupT) > 0.011) throw new Error('snapshot popup clock mismatch');
if (!Array.isArray(hazards[9])) throw new Error('snapshot props moved to the wrong index');

const packet = (block: unknown[]): unknown[] => [
  0,
  1,
  1,
  0,
  1,
  60,
  -1,
  -1,
  [],
  [],
  [],
  null,
  [],
  block,
];

// New wire shape reaches NetView, while the older USB clock/props shape stays readable.
const parsed = parseSnapshot(packet(hazards));
if (!parsed?.hazards) throw new Error('guest snapshot lost SWIPE hazards');
if (Math.abs(parsed.hazards.swipeT - world.swipeT) > 0.011) throw new Error('guest snapshot lost the swipe clock');
const view = new NetView(0, arena);
view.pushSnapshot(parsed);
view.present();
if (Math.abs(view.swipeT - world.swipeT) > 0.1) throw new Error('NetView did not expose the swipe clock');
if (Math.abs(view.swipePopupT - world.swipePopupT) > 0.1) throw new Error('NetView did not expose the popup clock');

const legacy = parseSnapshot(packet([0, 0, 0, 0, 0, 0, 12.34, []]));
if (!legacy?.hazards) throw new Error('legacy USB snapshot no longer parses');
if (Math.abs(legacy.hazards.usbT - 12.34) > 0.01) throw new Error('legacy USB clock was lost');
if (legacy.hazards.swipeT !== 0 || legacy.hazards.swipePopupT !== 0) {
  throw new Error('legacy snapshot invented SWIPE clocks');
}

console.log(
  JSON.stringify({
    arena: arena.name,
    id: arena.id,
    swipeT: world.swipeT,
    carried: carriedX - startX,
    popupSolid: pop.y,
    popupCleared: clearOfPopup,
    guestSwipeT: view.swipeT,
    guestPopupT: view.swipePopupT,
    legacyUsbT: legacy.hazards.usbT,
    profiles: swipe.profiles.length,
    arenas: ARENAS.length,
  }),
);
