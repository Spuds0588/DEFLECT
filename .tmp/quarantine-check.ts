/**
 * QUARANTINE split check.
 *
 * The device is four arenas now, entered and left through script_kitty's portal:
 * INTAKE -> HOLDING -> MAINBOARD -> ROUTER -> REBOOT. This probe verifies the arena
 * records, the campaign order, the first portal pull, the kitty arrival line, the
 * holding class, and the feed-room live starts.
 */
import { ARENAS, getArena, holdingCellLayout } from '../src/game/arenas';
import { CAMPAIGN_LEVELS, PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`PASS ${name}`);
  } else {
    failures++;
    console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
  }
}

const intake = getArena(14);
const holding = getArena(34);
const board = getArena(35);
const router = getArena(36);
check('four split quarantine arenas exist', [intake, holding, board, router].every((a) => !!a));
check(
  'each split arena has exactly one painted room',
  [intake, holding, board, router].every((a) => a.rooms?.length === 1),
  [intake, holding, board, router].map((a) => a.rooms?.length ?? 0).join(','),
);
check(
  'each split arena is a distinct device id',
  new Set([intake.id, holding.id, board.id, router.id]).size === 4,
);
check(
  'each split arena bounds match its room',
  [intake, holding, board, router].every((a) => {
    const r = a.rooms![0];
    return a.bounds.left === r.x && a.bounds.top === r.y && a.bounds.right === r.x + r.w && a.bounds.bottom === r.y + r.h;
  }),
);
check('arena ids resolve through the arena table', ARENAS[14] === intake && ARENAS[34] === holding && ARENAS[35] === board && ARENAS[36] === router);

const route = PLAYABLE_CAMPAIGN_LEVELS.map((level) => level.arenaId);
check(
  'campaign route is intake -> holding -> mainboard -> router -> reboot',
  route.length === 5 && route[0] === 14 && route[1] === 34 && route[2] === 35 && route[3] === 36 && route[4] === 1,
  route.join(' -> '),
);
check(
  'first four campaign beats share the build-root node',
  CAMPAIGN_LEVELS.slice(0, 4).every((level) => level.nodeId === 'build-root'),
);
check('intake and holding author no ingress ports', !intake.ingress && !holding.ingress);
check('mainboard authors two feeds', board.ingress?.length === 2, String(board.ingress?.length ?? 0));
check('router authors one feed', router.ingress?.length === 1, String(router.ingress?.length ?? 0));

const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'QA';
const idle = new Array(MAX_PLAYERS).fill(null);

// 1. Intake's orientation wakes the class; clearing it opens the right-wall portal.
const first = new World(
  'gauntlet', names, 0, intake, false, 0, 0, null, true, [], false, 'warden', 0, false, -1, false,
);
const intakeShapes = first.sentries.filter((s) => s.active && s.kind >= 4 && s.kind <= 6);
check('intake stages six dormant lock targets', intakeShapes.length === 6, String(intakeShapes.length));
check(
  'intake lock targets stay dormant during the lesson',
  intakeShapes.every((s) => s.shapeState === 0),
  intakeShapes.map((s) => s.shapeState).join(','),
);
first.skipTutorial();
let sawPortal = false;
for (let i = 0; i < 90; i++) first.step(SIM_DT, idle);
check('intake wakes its class after the Warden lesson', first.calibrationAwake && first.campaignBannerKind === 8);
check('intake does not portal before the class fight', first.campaignPortalT < 0 && first.campaignPhase === 'calibration');
check(
  'the Warden reacts before the system objective',
  first.tutorial?.current?.id === 'warden-shock' && first.tutorial?.current?.speaker === 'WARDEN',
  first.tutorial?.current?.id ?? 'no tutorial',
);
first.skipTutorial();
for (let i = 0; i < 90; i++) first.step(SIM_DT, idle);
for (const s of first.sentries) if (s.kind >= 4 && s.kind <= 6) s.active = false;
for (let i = 0; i < 240; i++) {
  first.step(SIM_DT, idle);
  if (first.campaignPortalT >= 0) sawPortal = true;
}
check('intake opens a portal after the awakened class is cleared', sawPortal);
check('intake clears through the portal', first.campaignPhase === 'cleared', first.campaignPhase);
check(
  'the pull carries the body across the room to the right wall',
  first.players[0].x > intake.bounds.right - 48,
  `${first.players[0].x.toFixed(1)} / right ${intake.bounds.right}`,
);
check('intake camp close does not need a white exit prop', !first.props.some((p) => p.portalExit));

// 2. Holding lands on kitty's first line and has the six-subject class.
const second = new World(
  'gauntlet', names, 0, holding, false, 0, 0, null, true, [], false, 'holding', 0, false, -1, false,
);
check(
  'holding opens on kitty saying the portal worked',
  second.tutorial?.current?.speaker === 'SCRIPT_KITTY' && second.tutorial?.current?.id === 'kitty-worked',
  second.tutorial?.current?.id ?? 'no tutorial',
);
const shapes = second.sentries.filter((s) => s.active && s.kind >= 4 && s.kind <= 6);
check('six calibration subjects stage in holding', shapes.length === 6, String(shapes.length));
const cells = holdingCellLayout(holding.rooms![0]);
check(
  'holding entry side is open, cell block stays back-right',
  cells.left > holding.bounds.left + 300 && cells.bottom < holding.bounds.bottom,
  `${cells.left.toFixed(0)} / ${cells.bottom}`,
);
check(
  'all subjects are inside holding and clear of the cell block',
  shapes.every(
    (s) =>
      s.x > holding.bounds.left &&
      s.x < holding.bounds.right &&
      s.y > holding.bounds.top &&
      s.y < holding.bounds.bottom &&
      !(s.x > cells.left && s.x < cells.left + cells.cellW * 3 && s.y > cells.top && s.y < cells.bottom),
  ),
);
second.skipTutorial();
let wokeAtOnce = 0;
let wokeShapeT: number[] = [];
for (let i = 0; i < 900; i++) {
  second.step(SIM_DT, idle);
  const woke = second.sentries.filter((s) => s.active && s.kind >= 4 && s.kind <= 6 && s.shapeState === 1);
  if (woke.length > 0) {
    wokeAtOnce = woke.length;
    wokeShapeT = woke.map((s) => s.shapeT);
    break;
  }
}
check(
  'holding wakes all six subjects on staggered clocks',
  wokeAtOnce === 6 && new Set(wokeShapeT.map((v) => v.toFixed(2))).size === 6,
  `${wokeAtOnce} woke: ${wokeShapeT.map((v) => v.toFixed(2)).join(',')}`,
);

// 3. Feed rooms open live, with their authored port counts and crates.
const third = new World(
  'gauntlet', names, 0, board, false, 0, 0, null, true,
  PLAYABLE_CAMPAIGN_LEVELS[2].dataCrates, false, 'assault', PLAYABLE_CAMPAIGN_LEVELS[2].clearKills, false, -1, false,
);
check('mainboard opens in live fire', third.campaignPhase === 'assault', third.campaignPhase);
check('mainboard counts two feeds', third.portTotal === 2, String(third.portTotal));
check('mainboard loads its data crates', third.dataTotal === PLAYABLE_CAMPAIGN_LEVELS[2].dataCrates.length, String(third.dataTotal));
check('mainboard slams shut the drill squad', !third.players[1].active);

const fourth = new World(
  'gauntlet', names, 0, router, false, 0, 0, null, true,
  PLAYABLE_CAMPAIGN_LEVELS[3].dataCrates, false, 'assault', PLAYABLE_CAMPAIGN_LEVELS[3].clearKills, false, -1, false,
);
check('router opens in live fire', fourth.campaignPhase === 'assault', fourth.campaignPhase);
check('router counts one feed', fourth.portTotal === 1, String(fourth.portTotal));
check('router loads its data crates', fourth.dataTotal === PLAYABLE_CAMPAIGN_LEVELS[3].dataCrates.length, String(fourth.dataTotal));

// 4. A hopped round enters on the next arena's left wall with a real throw.
const match = new World('match', names, 0, getArena(0));
match.beginRound(true);
check('a hopped round enters from the left wall', match.players[0].x < getArena(0).bounds.left + 70, `${match.players[0].x.toFixed(1)}`);
check('a hopped round leaves an entry portal clock', match.entryPortalT > 0, String(match.entryPortalT));
check('the portal throws the body east', match.players[0].kx > 0 && match.players[0].iframes >= 1, `${match.players[0].kx.toFixed(1)} / ${match.players[0].iframes.toFixed(2)}`);
const launchX = match.players[0].x;
for (let i = 0; i < 12; i++) match.step(SIM_DT, idle);
check('the thrown body keeps moving after entry', match.players[0].x > launchX + 30, `${launchX.toFixed(1)} -> ${match.players[0].x.toFixed(1)}`);

// 5. No authored hostile starts in the portal landing lane on any campaign node.
let laneHits = 0;
for (const level of PLAYABLE_CAMPAIGN_LEVELS) {
  const arena = getArena(level.arenaId);
  const w = new World(
    'gauntlet', names, 0, arena, false, 0, 0, null, true,
    level.dataCrates, false, level.intro, level.clearKills, false, level.boss ?? -1, false,
  );
  const laneRight = arena.bounds.left + 280;
  const laneHalf = 90;
  for (const s of w.sentries) {
    if (s.active && s.x < laneRight && Math.abs(s.y - (arena.bounds.top + arena.bounds.bottom) * 0.5) < laneHalf) laneHits++;
  }
  for (const v of w.viruses) {
    if (v.active && v.x < laneRight && Math.abs(v.y - (arena.bounds.top + arena.bounds.bottom) * 0.5) < laneHalf) laneHits++;
  }
  for (const ww of w.worms) {
    if (ww.active && ww.x < laneRight && Math.abs(ww.y - (arena.bounds.top + arena.bounds.bottom) * 0.5) < laneHalf) laneHits++;
  }
}
check('no campaign hostile spawns in the portal landing lane', laneHits === 0, String(laneHits));

console.log(failures === 0 ? '\nALL QUARANTINE SPLIT CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
