import { ARENAS, usbCenterX, usbCenterY, usbDriveRect, usbExtensionAt, usbFloorAt, usbFlowAt } from '../src/game/arenas';
import { PLAYER } from '../src/game/config';
import { buildSnapshotHazards, NetView, parseSnapshot } from '../src/net/net';
import { World } from '../src/game/world';
import type { InputFrame } from '../src/game/types';

const index = ARENAS.findIndex((a) => a.name === 'USB HUB');
if (index < 0) throw new Error('USB HUB missing');
const arena = ARENAS[index];
const usb = arena.usb;
if (!usb) throw new Error('USB HUB has no usb record');
const cx = usbCenterX(arena);
const cy = usbCenterY(arena);
const rect = { x: 0, y: 0, w: 0, h: 0 };
const flow = { x: 0, y: 0 };

const docked = 0;
const out = usb.holdIn + usb.extend + usb.holdOut * 0.5;
usbDriveRect(arena, 0, docked, rect);
const dockInner = rect.x;
usbDriveRect(arena, 0, out, rect);
const outInner = rect.x;
if (Math.abs(usbExtensionAt(usb, docked)) > 0.01) throw new Error('drives do not start docked');
if (usbExtensionAt(usb, out) < usb.extension - 0.01) throw new Error('drives do not reach full extension');
if (outInner <= dockInner + 100) throw new Error('drive did not travel far enough');

const maxGap = outInner - cx - usb.hubRadius;
const dashReach = PLAYER.dashSpeed * PLAYER.dashTime;
if (maxGap <= dashReach) throw new Error(`full-out gap ${maxGap} is still dashable (${dashReach})`);

const point = (x: number, y: number): boolean => usbFloorAt(arena, x, y, out);
if (!point(cx, cy)) throw new Error('hub centre is not floor');
if (usbFloorAt(arena, cx + 360, cy, out)) throw new Error('out gap is still floor');
if (!usbFloorAt(arena, cx + 560, cy, out)) throw new Error('out drive is not floor');

const extendAt = usb.holdIn + usb.extend * 0.5;
if (!usbFlowAt(arena, cx + 560, cy, extendAt, flow) || flow.x <= 0.1) {
  throw new Error('outward current missing');
}
const retractAt = usb.holdIn + usb.extend + usb.holdOut + usb.retract * 0.5;
if (!usbFlowAt(arena, cx + 560, cy, retractAt, flow) || flow.x >= -0.1) {
  throw new Error('inward current missing');
}

const zero: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
const world = new World('training', ['CHECK'], 0, arena);
world.drone.active = false;
world.drone.respawnT = 1e9;
const p = world.players[0];
if (!p || !p.alive) throw new Error('training player did not spawn');
// Put the body on the east drive, then let the extension carry it outward.
p.x = cx + 360;
p.y = cy;
p.fallT = 0;
const beforeX = p.x;
for (let i = 0; i < 5 * 60; i++) world.step(1 / 60, [zero]);
if (world.usbT < 4.9) throw new Error('usb clock did not advance');
if (p.x <= beforeX) throw new Error('drive did not carry the player outward');

// The new full-out gap is beyond the dash. A dash from the hub edge falls into it.
p.x = cx + 280;
p.y = cy;
p.fallT = 0;
p.dashT = 0.15;
p.dashKind = 0;
p.dashDirX = 1;
p.dashDirY = 0;
p.vx = 0;
p.vy = 0;
p.kx = 0;
p.ky = 0;
for (let i = 0; i < 20; i++) world.step(1 / 60, [zero]);
if (p.fallT <= 0) throw new Error('full-out gap accepted a dash');

// Before the drives reach full extension, the same dash still clears the shorter gap.
const partial = new World('training', ['DASH'], 0, arena);
partial.drone.active = false;
partial.drone.respawnT = 1e9;
for (let i = 0; i < Math.ceil((usb.holdIn + usb.extend * 0.5) * 60); i++) partial.step(1 / 60, [zero]);
const dp = partial.players[0];
dp.x = cx + 280;
dp.y = cy;
dp.fallT = 0;
dp.dashT = 0.15;
dp.dashKind = 0;
dp.dashDirX = 1;
dp.dashDirY = 0;
dp.vx = 0;
dp.vy = 0;
dp.kx = 0;
dp.ky = 0;
for (let i = 0; i < 12; i++) partial.step(1 / 60, [zero]);
if (dp.fallT > 0 || !usbFloorAt(arena, dp.x, dp.y, partial.usbT)) {
  throw new Error('partial gap did not accept a dash');
}

// A body standing in the open gap falls. Clear the ride/current first.
p.x = cx + 360;
p.y = cy;
p.fallT = 0;
p.vx = 0;
p.vy = 0;
p.kx = 0;
p.ky = 0;
world.step(1 / 60, [zero]);
if (p.fallT <= 0) throw new Error('walking into the gap did not start a fall');

// The host snapshot carries the authoritative drive clock at the hazards index.
const hazards = buildSnapshotHazards(world);
if (!Array.isArray(hazards)) throw new Error('USB hazards block missing');
if (Math.abs(Number(hazards[6]) - world.usbT) > 0.011) throw new Error('snapshot USB clock mismatch');
if (!Array.isArray(hazards[7])) throw new Error('snapshot props moved to the wrong index');

// Guest-side parse and view: the clock at hazards[6] must land on NetView.usbT.
const parsed = parseSnapshot([
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
  [0, 0, 0, 0, 0, 0, 12.34, []],
]);
if (!parsed || !parsed.hazards) throw new Error('guest snapshot parse lost hazards');
if (Math.abs(parsed.hazards.usbT - 12.34) > 0.01) throw new Error('guest snapshot lost the USB clock');
const view = new NetView(0, arena);
view.pushSnapshot(parsed);
view.present();
if (Math.abs(view.usbT - 12.34) > 0.01) throw new Error('NetView did not expose the USB clock');

// Both local threat modes construct and step on the moving floor. The infection path
// is the important one: it has no usable right-edge floor and seeds the east drive.
const gauntlet = new World('gauntlet', ['GAUNT'], 0, arena);
for (let i = 0; i < 120; i++) gauntlet.step(1 / 60, [zero]);
const infection = new World('gauntlet', ['INF'], 0, arena, false, 0, 0, null, false, null, true);
for (let i = 0; i < 120; i++) infection.step(1 / 60, [zero]);
if (infection.usbT < 1.9) throw new Error('infection did not run the USB clock');
if (!infection.viruses.some((v) => v.active)) throw new Error('infection lost its opening colony');

console.log(JSON.stringify({
  arena: arena.name,
  id: arena.id,
  dockInner,
  outInner,
  extension: usb.extension,
  gap: maxGap,
  dashReach,
  fullOutDashable: maxGap <= dashReach,
  outward: true,
  inward: true,
  carried: true,
  falls: true,
  snapshotUsbT: hazards[6],
  guestUsbT: view.usbT,
  usbT: world.usbT,
  gauntletT: gauntlet.usbT,
  infectionT: infection.usbT,
}));
