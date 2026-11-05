import { pack, unpack } from 'peerjs-js-binarypack';
import { ARENAS, browserClickAt, browserCursorAt, browserCycle, browserPhaseAt, getArena, keypadKeyState, KEYPAD_STATE, pusherPhaseAt, scannerPhaseAt, type PusherPhase } from '../src/game/arenas';
import { SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';
import { buildSnapshotHazards, LocalPredictor, NetView, parseSnapshot, type Snapshot } from '../src/net/net';
import { PF } from '../src/game/types';
import { PLAYER } from '../src/game/config';

const names = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
const inputs = new Array(8).fill(null);

function makeWorld(arenaId: number): World {
  return new World('match', names, 0, getArena(arenaId));
}

function stepWorld(world: World, seconds: number): void {
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) world.step(SIM_DT, inputs);
}

function fakeSnapshot(hazard: unknown[] | null): Snapshot | null {
  const raw = [
    1, // MSG.SNAPSHOT
    1,
    1, // live
    0,
    1,
    90,
    -1,
    -1,
    [],
    [],
    [],
    null,
    [],
    hazard,
  ];
  return parseSnapshot(raw);
}

const armScratch: PusherPhase = { warnT: 0, y: 0, active: false, flashT: 0 };
const cursorScratch = { x: 0, y: 0 };
let failures = 0;

function fail(message: string): void {
  failures++;
  console.log(`FAIL ${message}`);
}

for (const id of [7, 11, 12, 13]) {
  const arena = getArena(id);
  const world = makeWorld(id);
  let maxHazardBytes = 0;
  let maxProps = 0;
  let sawPusherActive = false;
  let sawSolidKey = false;
  let sawBrowserAdvance = false;
  const firstPage = world.browserPage;
  let maxPusherError = 0;

  for (let i = 0; i < 60 * 45; i++) {
    world.step(SIM_DT, inputs);

    const hazard = buildSnapshotHazards(world);
    if (!hazard) {
      fail(`${arena.name} produced no hazard block`);
      break;
    }
    const bytes = pack(hazard).byteLength;
    if (bytes > maxHazardBytes) maxHazardBytes = bytes;
    const props = hazard[9] as number[][];
    if (props.length > maxProps) maxProps = props.length;

    if (arena.pushers) {
      pusherPhaseAt(arena, world.pusherT, armScratch);
      maxPusherError = Math.max(
        maxPusherError,
        Math.abs(armScratch.y - world.pusherY),
        armScratch.active === world.pusherActive ? 0 : 99,
      );
      if (world.pusherActive) sawPusherActive = true;
    }

    if (arena.keypad) {
      for (let k = 0; k < arena.keypad.keys.length; k++) {
        const derived = keypadKeyState(arena.keypad, k, world.keypadT);
        if (derived !== world.keypadStates[k]) fail(`${arena.name} key ${k} state mismatch`);
        if (derived === KEYPAD_STATE.slam || derived === KEYPAD_STATE.down || derived === KEYPAD_STATE.rise) {
          sawSolidKey = true;
        }
      }
    }

    if (arena.scanner) {
      if (scannerPhaseAt(world.scannerT) !== world.scannerPhase) fail(`${arena.name} scanner phase mismatch`);
    }

    if (arena.browser) {
      const phase = browserPhaseAt(world.browserT);
      if (phase !== world.browserPhase) fail(`${arena.name} browser phase mismatch`);
      browserCursorAt(arena.browser, world.browserPage, world.browserT, cursorScratch);
      if (Math.abs(cursorScratch.x - world.browserCursorX) > 0.01 || Math.abs(cursorScratch.y - world.browserCursorY) > 0.01) {
        fail(`${arena.name} browser cursor mismatch`);
      }
      if (Math.abs(browserClickAt(world.browserT) - world.browserClickT) > 0.02) {
        fail(`${arena.name} browser click timer mismatch`);
      }
      if (world.browserPage !== firstPage) sawBrowserAdvance = true;
    }

    if (i % 30 === 0) {
      const snap = fakeSnapshot(hazard);
      if (!snap || !snap.hazards) {
        fail(`${arena.name} snapshot parse lost hazards`);
        break;
      }
      if (Math.abs(snap.hazards.pusherT - world.pusherT) > 0.011) fail(`${arena.name} pusher clock lost`);
      if (snap.hazards.browserPage !== world.browserPage) fail(`${arena.name} browser page lost`);
      if (snap.hazards.scannerPage !== world.scannerPage) fail(`${arena.name} scanner page lost`);
      if (snap.hazards.props.length !== props.length) fail(`${arena.name} prop count lost`);
    }
  }

  if (arena.pushers && !sawPusherActive) fail(`${arena.name} never saw the arm active`);
  if (arena.pushers && maxPusherError > 0.05) fail(`${arena.name} pusher derivation error ${maxPusherError.toFixed(3)}`);
  if (arena.keypad && !sawSolidKey) fail(`${arena.name} never saw a solid key`);
  if (arena.browser && !sawBrowserAdvance) fail(`${arena.name} never advanced pages`);

  // NetView mirror: one real parsed snapshot, then present().
  const hazard = buildSnapshotHazards(world)!;
  const snap = fakeSnapshot(hazard)!;
  const view = new NetView(0, arena);
  view.pushSnapshot(snap);
  view.present();
  if (arena.pushers) {
    pusherPhaseAt(arena, view.pusherT, armScratch);
    if (view.pusherActive !== armScratch.active) fail(`${arena.name} NetView pusher active mismatch`);
    if (Math.abs(view.pusherY - armScratch.y) > 0.01) fail(`${arena.name} NetView pusher y mismatch`);
  }
  if (arena.keypad) {
    for (let k = 0; k < arena.keypad.keys.length; k++) {
      if (view.keypadStates[k] !== keypadKeyState(arena.keypad, k, view.keypadT)) fail(`${arena.name} NetView key ${k} mismatch`);
    }
  }
  if (arena.scanner && view.scannerPhase !== scannerPhaseAt(view.scannerT)) fail(`${arena.name} NetView scanner phase mismatch`);
  if (arena.browser && view.browserPage !== world.browserPage) fail(`${arena.name} NetView browser page mismatch`);
  if (arena.browser) {
    browserCursorAt(arena.browser, view.browserPage, view.browserT, cursorScratch);
    if (Math.abs(view.browserCursorX - cursorScratch.x) > 0.01 || Math.abs(view.browserCursorY - cursorScratch.y) > 0.01) {
      fail(`${arena.name} NetView cursor mismatch`);
    }
    if (Math.abs(view.browserClickT - browserClickAt(view.browserT)) > 0.01) fail(`${arena.name} NetView click mismatch`);
  }
  if (arena.pushers) {
    let active = 0;
    for (const b of view.props) if (b.active) active++;
    let hostActive = 0;
    for (const b of world.props) if (b.active) hostActive++;
    if (active !== hostActive) fail(`${arena.name} NetView props ${active} vs ${hostActive}`);
  }

  console.log(
    `${arena.name}: max hazard ${maxHazardBytes} B packed, ${maxProps} props, ` +
      `pusher active=${sawPusherActive}, solidKey=${sawSolidKey}, browserAdvance=${sawBrowserAdvance}`,
  );
}

// Prediction checks: a keypad cap blocks a body, and the compactor carries one down.
{
  const arena = getArena(11);
  const keypad = arena.keypad!;
  let solidT = -1;
  for (let t = 0; t < 20; t += 0.01) {
    if (keypadKeyState(keypad, 0, t) === KEYPAD_STATE.down) {
      solidT = t;
      break;
    }
  }
  if (solidT < 0) fail('KEYPAD found no down state for prediction test');
  else {
    const key = keypad.keys[0];
    const cx = key.x + key.w * 0.5;
    const cy = key.y + key.h * 0.5;
    const model = new LocalPredictor(0, arena);
    model.adopt([0, PF.ALIVE, cx, cy, 0, 3, 80, 0, 0, -1, 0, 0, 0]);
    model.setHazards(0, solidT, 0);
    model.step({ held: 0, pressed: 0, mx: 0, my: 0 }, SIM_DT);
    if (Math.hypot(model.p.x - cx, model.p.y - cy) < 1) fail('KEYPAD prediction did not push a body out of a down cap');
  }

  const bin = getArena(7);
  const armT = bin.pushers!.warn + bin.pushers!.travel * 0.5;
  const arm = pusherPhaseAt(bin, armT, armScratch);
  const model = new LocalPredictor(0, bin);
  model.adopt([0, PF.ALIVE, 995, 300, 0, 3, 80, 0, 0, -1, 0, 0, 0]);
  model.setHazards(armT, 0, 0);
  model.step({ held: 0, pressed: 0, mx: 0, my: 0 }, SIM_DT);
  const carried = Math.min(bin.bounds.bottom - PLAYER.radius, arm.y + PLAYER.radius);
  if (Math.abs(model.p.y - carried) > 0.5) fail(`RECYCLING BIN prediction carry ${model.p.y.toFixed(1)} vs ${carried.toFixed(1)}`);
}

// 8P / 48-projectile baseline packet with and without the heaviest hazard block.
const world = makeWorld(7);
stepWorld(world, 8);
world.projectiles.forEach((p, i) => {
  if (i >= 48) return;
  p.active = true;
  p.serial = i + 1;
  p.type = i % 3;
  p.owner = i % 8;
  p.x = 200 + (i % 12) * 120;
  p.y = 200 + Math.floor(i / 12) * 160;
  p.vx = 300;
  p.vy = -120;
  p.radius = 6;
  p.deflects = 0;
  p.fuse = 1.2;
  p.grace = 0;
  p.armed = true;
});
const hazardBlock = buildSnapshotHazards(world);
const basePacket = [1, 700, 1, 12, 1, 80, -1, -1, [], [], [], null, []];
const fullPacket = [...basePacket, hazardBlock];
const baseBytes = pack(basePacket).byteLength;
const fullBytes = pack(fullPacket).byteLength;
const wired = unpack(pack(fullPacket)) as unknown[];
const wiredSnap = parseSnapshot(wired);
if (!wiredSnap?.hazards) fail('BinaryPack round-trip lost the hazard block');
else if (wiredSnap.hazards.props.length !== (hazardBlock as unknown[])[9]!.length) fail('BinaryPack round-trip lost props');
console.log(`packet delta at 48 projectiles: +${fullBytes - baseBytes} B (${pack(hazardBlock).byteLength} B hazard block)`);

console.log(failures === 0 ? 'PASS' : `FAILURES ${failures}`);
process.exitCode = failures === 0 ? 0 : 1;
