/**
 * Campaign chapter threat roster.
 *
 * Level 1 is primitives and worms only; viruses unlock in level 2. ROAD TRIP (level 3)
 * adds no body. Spinners (level 4) and magic users (level 6) are scheduled but have no
 * approved kit, so the gate must keep them off the floor. Levels 5 and 7 add nothing.
 *
 * Run with `npx tsx .tmp/chapter-threats-check.ts`.
 */
import { ARENAS } from '../src/game/arenas';
import {
  CAMPAIGN_CHAPTERS,
  PLAYABLE_CAMPAIGN_LEVELS,
  campaignChapterForLevel,
  campaignPortFamily,
  campaignThreatAllowed,
  type CampaignLevel,
} from '../src/game/campaign';
import { MAX_PLAYERS } from '../src/game/config';
import { CALIBRATION_POWER_TUTORIAL } from '../src/game/tutorial';
import { World } from '../src/game/world';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures++;
}

// --- The authored rollout -------------------------------------------------------------
check('seven chapters are authored', CAMPAIGN_CHAPTERS.length === 7);
check('chapter 1 adds no new body', CAMPAIGN_CHAPTERS[0].introduces === null);
check('chapter 2 introduces viruses', CAMPAIGN_CHAPTERS[1].introduces === 'viruses');
check('chapter 3 adds no new body', CAMPAIGN_CHAPTERS[2].introduces === null);
check(
  'chapter 4 reserves spinners',
  CAMPAIGN_CHAPTERS[3].introduces === 'spinners' && CAMPAIGN_CHAPTERS[3].pending === true,
);
check('chapter 5 adds no new body', CAMPAIGN_CHAPTERS[4].introduces === null);
check(
  'chapter 6 reserves magic',
  CAMPAIGN_CHAPTERS[5].introduces === 'magic' && CAMPAIGN_CHAPTERS[5].pending === true,
);
check('chapter 7 adds no new body', CAMPAIGN_CHAPTERS[6].introduces === null);

check('level 1 is sentries and worms', campaignThreatAllowed(1, 'sentries') && campaignThreatAllowed(1, 'worms'));
check('level 1 has no viruses', !campaignThreatAllowed(1, 'viruses'));
check('level 2 unlocks viruses', campaignThreatAllowed(2, 'viruses'));
check('pending spinners never spawn', !campaignThreatAllowed(4, 'spinners'));
check('pending magic never spawns', !campaignThreatAllowed(6, 'magic'));
check('chapter 5 inherits the pool', campaignThreatAllowed(5, 'viruses'));
check('chapter 7 inherits the pool', campaignThreatAllowed(7, 'viruses'));
check(
  'no-roster worlds keep implemented families',
  campaignThreatAllowed(0, 'viruses') && !campaignThreatAllowed(0, 'magic'),
);

check(
  'chapter 1 route levels map to chapter 1',
  PLAYABLE_CAMPAIGN_LEVELS.filter((level) => campaignChapterForLevel(level) === 1).length === 5,
);
const roadLevels = PLAYABLE_CAMPAIGN_LEVELS.filter((level) => level.nodeId === 'road-trip');
check('ROAD TRIP is six levels', roadLevels.length === 6, String(roadLevels.length));
check(
  'ROAD TRIP maps to chapter 3',
  roadLevels.length === 6 && roadLevels.every((level) => campaignChapterForLevel(level) === 3),
);
for (const level of PLAYABLE_CAMPAIGN_LEVELS) {
  if (campaignChapterForLevel(level) !== 1 || !level.opening) continue;
  check(`${level.name} opening has no viruses`, level.opening.viruses === 0, String(level.opening.viruses));
}
check(
  'level 1 power lesson no longer names viruses',
  !CALIBRATION_POWER_TUTORIAL.some((step) => /virus/i.test(step.line)),
);

// --- Runtime: a chapter-1 feed room stays clean ---------------------------------------
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'QA';

function make(level: CampaignLevel): World {
  return new World(
    'gauntlet',
    names,
    0,
    ARENAS.find((arena) => arena.id === level.arenaId)!,
    false,
    0,
    0,
    null,
    true,
    level.dataCrates,
    false,
    level.intro,
    level.clearKills,
    false,
    level.boss ?? -1,
    campaignChapterForLevel(level),
    level.opening ?? null,
    level.finale === true,
  );
}

const mainboardLevel = PLAYABLE_CAMPAIGN_LEVELS.find((level) => level.arenaId === 35);
if (!mainboardLevel) throw new Error('MAINBOARD level is missing');
const mainboard = make(mainboardLevel);
check('MAINBOARD starts in assault', mainboard.campaignPhase === 'assault', mainboard.campaignPhase);
check('MAINBOARD loaded no live viruses', mainboard.viruses.every((virus) => !virus.active));
const mainboardPorts = mainboard.props.filter((prop) => prop.portal && !prop.portalExit);
check(
  'MAINBOARD virus feed is remapped to worms',
  mainboardPorts.some((prop) => prop.portalFamily === 2) &&
    !mainboardPorts.some((prop) => prop.portalFamily === 1),
  mainboardPorts.map((prop) => prop.portalFamily).join(','),
);
check('port family remap is chapter-scoped', campaignPortFamily(1, 1) === 2 && campaignPortFamily(2, 1) === 1);

// HOLDING opens with four held chains and no held viruses.
const holdingLevel = PLAYABLE_CAMPAIGN_LEVELS.find((level) => level.arenaId === 34);
if (!holdingLevel) throw new Error('HOLDING level is missing');
const holding = make(holdingLevel);
const heldWorms = holding.worms.filter((worm) => worm.active && worm.held).length;
const heldViruses = holding.viruses.filter((virus) => virus.active && virus.held).length;
check('HOLDING holds four chains', heldWorms === 4, String(heldWorms));
check('HOLDING holds no viruses', heldViruses === 0, String(heldViruses));

// Level 2 still carries its authored virus opening.
const switchLevel = PLAYABLE_CAMPAIGN_LEVELS.find((level) => level.arenaId === 9);
if (!switchLevel) throw new Error('NETWORK SWITCH level is missing');
const network = make(switchLevel);
check(
  'NETWORK SWITCH loads its virus opening',
  network.viruses.some((virus) => virus.active),
  String(network.viruses.filter((virus) => virus.active).length),
);

console.log(failures === 0 ? '\nchapter-threats-check: OK' : `\nchapter-threats-check: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
