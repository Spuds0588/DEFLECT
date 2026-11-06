/**
 * Campaign runtime data.
 *
 * `SECTORS` owns the route graph and `saves.ts` owns the slots; this module links them
 * to `World`. A level names the node, the arena blockout and the sector it belongs to.
 * Levels are an ordered route: a clear opens script_kitty's portal to the next arena,
 * never a bridge. The script itself (sparring drill, breach, threat assault) lives in
 * `World`; every tuning number lives in the `CAMPAIGN` block in `config.ts`.
 */
import { ARENAS } from './arenas';
import { MINIBOSS } from './minibosses';
import { STORY_ROUTE_VERSION } from './saves';
import type { TutorialStep } from './tutorial';
import { PROP } from './types';

/** A data crate the level asks the player to preserve. Local-only, spawned on the breach. */
export interface CampaignDataCrate {
  x: number;
  y: number;
  kind: number;
}

/** Immediate bodies placed on an assault floor before the first port emission. */
export interface CampaignOpening {
  sentries: number;
  viruses: number;
  worms: number;
}

export interface CampaignLevel {
  id: number;
  /** Index into `SECTORS`. */
  sector: number;
  nodeId: string;
  /** Node label from the sector blueprint. */
  name: string;
  /** Short mode line shown on the intro and the slot readout. */
  code: string;
  /** Existing arena blockout used by this node. */
  arenaId: number;
  /** Which onboarding lesson opens the node, if any. */
  intro: CampaignIntro;
  /** script_kitty's landing line. Narration only; it never gates the fight. */
  blurb?: readonly TutorialStep[];
  /** Threats deleted to clear the assault. 0 uses `CAMPAIGN.killsToClear`. */
  clearKills: number;
  /** False keeps an authored level out of the live campaign route until it ships. */
  playable?: boolean;
  /** Bodies already fighting when the assault starts, instead of waiting on the ports. */
  opening?: CampaignOpening;
  /** This node ends the authored route with the scripted finale and result card. */
  finale?: boolean;
  /**
   * Mini-boss that ends the level. It arrives after the assault kills are met and the
   * level clears when that boss leaves the floor; a level with a boss ignores the port
   * sweep and the bare kill count.
   */
  boss?: number;
  /**
   * Data crates on the arena. They are the level's clean-sweep objective: break one and
   * the score loses its preservation pay. Spawned on the breach, never in snapshots.
   */
  dataCrates: readonly CampaignDataCrate[];
}

export type CampaignIntro = 'none' | 'warden' | 'holding' | 'assault' | 'kitty';

/**
 * The campaign introduces one threat family per chapter. Chapters 3, 5 and 7 add no
 * new body, so those fights are about surviving the mix that is already unlocked.
 */
export type CampaignThreatFamily = 'sentries' | 'worms' | 'viruses' | 'spinners' | 'magic';

export interface CampaignChapterDef {
  /** 1-based chapter index used by the route's seven themed stops. */
  id: number;
  label: string;
  /** Campaign node ids that belong to this chapter. */
  nodeIds: readonly string[];
  /** The family this chapter introduces, or null when it adds no new enemy. */
  introduces: CampaignThreatFamily | null;
  /** The family is scheduled but has no approved kit yet, so it cannot spawn. */
  pending?: boolean;
}

/**
 * The rollout the campaign is authored around. `spinners` and `magic` are reserved
 * slots: the chapters exist before the kits do, so the gate must never invent them.
 */
export const CAMPAIGN_CHAPTERS: readonly CampaignChapterDef[] = [
  {
    id: 1,
    label: 'BUILD ROOT',
    nodeIds: ['build-root', 'script-kitty'],
    introduces: null,
  },
  {
    id: 2,
    label: 'OFFICE LAN',
    nodeIds: ['network-switch', 'document-scanner', 'fax-machine', 'smart-watch', 'business-laptop'],
    introduces: 'viruses',
  },
  {
    id: 3,
    label: 'ROAD TRIP',
    nodeIds: ['road-trip'],
    introduces: null,
  },
  {
    id: 4,
    label: 'AIRPORT',
    nodeIds: ['airport'],
    introduces: 'spinners',
    pending: true,
  },
  {
    id: 5,
    label: 'SPACE',
    nodeIds: ['orbit'],
    introduces: null,
  },
  {
    id: 6,
    label: 'ARCADE // FOOD COURT',
    nodeIds: ['arcade', 'food-court'],
    introduces: 'magic',
    pending: true,
  },
  {
    id: 7,
    label: 'KISSINGFACE',
    nodeIds: ['ai-core'],
    introduces: null,
  },
];

/** Families with a shipped spawner. A scheduled-but-pending family joins this list. */
const IMPLEMENTED_THREAT_FAMILIES: readonly CampaignThreatFamily[] = [
  'sentries',
  'worms',
  'viruses',
];

/** Chapter that first introduces a family. The opening pair is the baseline. */
const THREAT_INTRODUCED_IN: Record<CampaignThreatFamily, number> = {
  sentries: 1,
  worms: 1,
  viruses: 2,
  spinners: 4,
  magic: 6,
};

export function campaignChapterForNode(nodeId: string): number {
  for (let i = 0; i < CAMPAIGN_CHAPTERS.length; i++) {
    if (CAMPAIGN_CHAPTERS[i].nodeIds.includes(nodeId)) return CAMPAIGN_CHAPTERS[i].id;
  }
  // A new route node inherits the latest chapter until it is authored into the table.
  return CAMPAIGN_CHAPTERS[CAMPAIGN_CHAPTERS.length - 1].id;
}

export function campaignChapterForLevel(level: CampaignLevel): number {
  return campaignChapterForNode(level.nodeId);
}

/**
 * Chapter 0 is the no-roster case (gauntlet, infection and legacy probes): every
 * implemented family is legal. A campaign passes its 1-based chapter index.
 */
export function campaignThreatAllowed(chapter: number, family: CampaignThreatFamily): boolean {
  if (!IMPLEMENTED_THREAT_FAMILIES.includes(family)) return false;
  if (chapter <= 0) return true;
  return chapter >= THREAT_INTRODUCED_IN[family];
}

/**
 * A port authored for a family the chapter has not introduced yet feeds the nearest
 * legal family instead of becoming a dead source the player still has to close.
 */
export function campaignPortFamily(chapter: number, family: number): number {
  if (chapter <= 0) return family;
  if (family === 1 && !campaignThreatAllowed(chapter, 'viruses')) return 2;
  if (family === 2 && !campaignThreatAllowed(chapter, 'worms')) return 0;
  return family;
}

/**
 * A stop on the between-level route plate. The route is data so a future branch can
 * add a second outgoing link without changing the transition or the save format.
 * `lane` is the vertical lane; a branch is simply another stop with its own lane.
 */
export interface CampaignRouteStop {
  level: number;
  nodeId: string;
  label: string;
  lane: number;
  links: readonly number[];
}

/** A short two-beat script_kitty landing line for a live-fire node. */
function kitty(id: string, ...lines: string[]): readonly TutorialStep[] {
  return lines.map((line, index) => ({
    id: `${id}-${index + 1}`,
    speaker: 'SCRIPT_KITTY' as const,
    line,
    readTime: index === 0 ? 3.4 : 3.8,
  }));
}

/** A crate on a guaranteed-clear spawn pad instead of a hand-guessed open-space point. */
function crate(arenaId: number, kind: number): CampaignDataCrate {
  const arena = ARENAS.find((entry) => entry.id === arenaId);
  const spawn = arena?.spawns[2] ?? arena?.spawns[0];
  return { x: spawn?.x ?? 0, y: spawn?.y ?? 0, kind };
}

export const CAMPAIGN_LEVELS: readonly CampaignLevel[] = [
  {
    id: 0,
    sector: 0,
    nodeId: 'build-root',
    name: 'BUILD ROOT // INTAKE',
    code: 'ORIENTATION',
    arenaId: 14,
    intro: 'warden',
    clearKills: 0,
    // The Warden lesson is the whole beat. The first portal opens when it ends.
    dataCrates: [],
  },
  {
    id: 1,
    sector: 0,
    nodeId: 'build-root',
    name: 'BUILD ROOT // HOLDING',
    code: 'CONTAINMENT',
    arenaId: 34,
    intro: 'holding',
    clearKills: 0,
    // The six calibration subjects and the cell release; no ports, no data crates.
    dataCrates: [],
  },
  {
    id: 2,
    sector: 0,
    nodeId: 'build-root',
    name: 'BUILD ROOT // MAINBOARD',
    code: 'DATA PLANE',
    arenaId: 35,
    intro: 'assault',
    blurb: kitty(
      'mainboard',
      "MAINBOARD. THE BUILDING'S DATA PLANE, AND SOMEONE LEFT THE COVER OFF.",
      'THE INFECTION IS IN THE TRACES. FOLLOW THEM AND BURN THEM OUT.',
    ),
    clearKills: 8,
    opening: { sentries: 3, viruses: 0, worms: 1 },
    dataCrates: [
      { x: 1250, y: 620, kind: PROP.DOC },
      { x: 1700, y: 680, kind: PROP.AUDIO },
    ],
  },
  {
    id: 3,
    sector: 0,
    nodeId: 'build-root',
    name: 'BUILD ROOT // ROUTER',
    code: 'UPLINK',
    arenaId: 36,
    intro: 'assault',
    blurb: kitty(
      'router',
      'ROUTER. EVERY PACKET IN QUARANTINE HAS TO COME THROUGH THIS ROOM.',
      'THE INFECTION OPENED A FEED. CLOSE IT BEFORE IT ROUTES AROUND US.',
    ),
    clearKills: 6,
    opening: { sentries: 3, viruses: 0, worms: 1 },
    dataCrates: [
      { x: 1240, y: 400, kind: PROP.ZIP },
      { x: 1760, y: 900, kind: PROP.VIDEO },
    ],
  },
  {
    id: 4,
    sector: 0,
    nodeId: 'script-kitty',
    name: 'REBOOT',
    code: 'REMEMBER',
    arenaId: 1,
    intro: 'kitty',
    playable: true,
    // Six corner feeds fill the arena; a full opening squad fights from the first
    // frame. The Mega Worm arrives only after every port and every body is gone, then
    // its death opens the scripted finale portal.
    clearKills: 0,
    opening: { sentries: 4, viruses: 0, worms: 1 },
    boss: MINIBOSS.MEGA_WORM,
    dataCrates: [],
  },
  {
    id: 5,
    sector: 1,
    nodeId: 'network-switch',
    name: 'NETWORK SWITCH',
    code: 'BACKBONE',
    arenaId: 9,
    intro: 'assault',
    blurb: kitty(
      'network-switch',
      'NETWORK SWITCH. THE BACKBONE OF THE WHOLE FLOOR, AND IT IS SWEATING.',
      'THE INFECTION LOVES A CHOKEPOINT. SO DO I. CLEAR THE ROOM.',
    ),
    clearKills: 9,
    opening: { sentries: 3, viruses: 2, worms: 1 },
    dataCrates: [{ x: 780, y: 540, kind: PROP.DOC }],
  },
  {
    id: 6,
    sector: 1,
    nodeId: 'document-scanner',
    name: 'DOCUMENT SCANNER',
    code: 'READ LINE',
    arenaId: 12,
    intro: 'assault',
    blurb: kitty(
      'document-scanner',
      'DOCUMENT SCANNER. SOMEONE LEFT A FOUR-HUNDRED-PAGE CONTRACT ON THE GLASS.',
      'THE INFECTION IS HIDING IN THE FINE PRINT. TRY NOT TO READ IT.',
    ),
    clearKills: 9,
    opening: { sentries: 3, viruses: 2, worms: 1 },
    dataCrates: [{ x: 900, y: 760, kind: PROP.ZIP }],
  },
  {
    id: 7,
    sector: 2,
    nodeId: 'fax-machine',
    name: 'FAX MACHINE',
    code: 'PRINT QUEUE',
    arenaId: 25,
    intro: 'assault',
    blurb: kitty(
      'fax-machine',
      'FAX MACHINE. YES, REALLY. THE INFECTION FOUND THE ONE DEVICE NOBODY PATCHES.',
      'WATCH THE PRINT HEAD. IT STILL BELIEVES IN PAPER.',
    ),
    clearKills: 10,
    opening: { sentries: 4, viruses: 2, worms: 1 },
    dataCrates: [{ x: 1040, y: 620, kind: PROP.AUDIO }],
  },
  {
    id: 8,
    sector: 2,
    nodeId: 'smart-watch',
    name: 'SMART WATCH',
    code: 'SECOND HAND',
    arenaId: 28,
    intro: 'assault',
    blurb: kitty(
      'smart-watch',
      "SMART WATCH. YOU ARE FIGHTING ON SOMEONE'S WRIST.",
      'IT IS COUNTING YOUR STEPS. GIVE IT A BAD DAY.',
    ),
    clearKills: 10,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [{ x: 960, y: 700, kind: PROP.VIDEO }],
  },
  {
    id: 9,
    sector: 2,
    nodeId: 'business-laptop',
    name: 'BUSINESS LAPTOP',
    code: 'HOST FILE',
    arenaId: 29,
    intro: 'assault',
    blurb: kitty(
      'business-laptop',
      'BUSINESS LAPTOP. EVERY MISSING EMAIL IN THE COMPANY LIVES IN THIS INBOX.',
      'THE INFECTION KEEPS A HOST FILE HERE. CLEAR THE FOLDER AND I WILL PULL THE PLUG.',
    ),
    clearKills: 8,
    opening: { sentries: 5, viruses: 3, worms: 1 },
    dataCrates: [],
  },
  {
    id: 10,
    sector: 9,
    nodeId: 'road-trip',
    name: 'CROSSROADS',
    code: 'CITY GRID',
    arenaId: 0,
    intro: 'assault',
    blurb: kitty(
      'crossroads',
      'CROSSROADS. KITTY PULLS THE OFFICE CAR OUT OF THE GARAGE AND INTO A DEAD INTERSECTION.',
      'THE CITY GRID IS STILL RUNNING. FOLLOW THE SIGNALS TO THE AIRPORT.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(0, PROP.DOC)],
  },
  {
    id: 11,
    sector: 9,
    nodeId: 'road-trip',
    name: 'CAR NAVIGATION',
    code: 'ROUTE 01',
    arenaId: 21,
    intro: 'assault',
    blurb: kitty(
      'car-navigation',
      'CAR NAVIGATION. THE DASHBOARD MAP IS INFECTED, BUT IT STILL KNOWS THE WAY OUT.',
      'KEEP THE ARROW AHEAD OF YOU. THE ROUTE IS THE ONLY CLEAR LINE.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(21, PROP.DOC)],
  },
  {
    id: 12,
    sector: 9,
    nodeId: 'road-trip',
    name: 'CAR RADIO',
    code: 'DEAD AIR',
    arenaId: 52,
    intro: 'assault',
    blurb: kitty(
      'car-radio',
      'CAR RADIO. FOUR STATIONS, ONE SIGNAL, AND EVERY ONE OF THEM IS PLAYING THE INFECTION.',
      'TUNE OUT THE NOISE. WATCH THE SWEEP.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(52, PROP.AUDIO)],
  },
  {
    id: 13,
    sector: 9,
    nodeId: 'road-trip',
    name: 'TRAFFIC CAMERA',
    code: 'RED LIGHT',
    arenaId: 49,
    intro: 'assault',
    blurb: kitty(
      'traffic-camera',
      'TRAFFIC CAMERA. EVERY LENS IN THE CITY IS WATCHING THIS CAR.',
      'MOVE THROUGH THE FRAMES BEFORE THE NEXT FILE LANDS.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(49, PROP.ZIP)],
  },
  {
    id: 14,
    sector: 9,
    nodeId: 'road-trip',
    name: 'TRAFFIC LIGHT',
    code: 'SIGNAL CYCLE',
    arenaId: 50,
    intro: 'assault',
    blurb: kitty(
      'traffic-light',
      'TRAFFIC LIGHT. THE INTERSECTION IS STUCK ON RED, AND THE FLOOR IS TAKING TURNS.',
      'READ THE SIGNAL. CROSS ON YOUR COLOR.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(50, PROP.VIDEO)],
  },
  {
    id: 15,
    sector: 9,
    nodeId: 'road-trip',
    name: 'CROSSWALK SIGN',
    code: "WALK / DON'T WALK",
    arenaId: 51,
    intro: 'assault',
    blurb: kitty(
      'crosswalk-sign',
      'CROSSWALK SIGN. THE AIRPORT IS ACROSS THE STREET, AND THE SIGN IS NOT MAKING IT EASY.',
      'WATCH THE WALK LIGHT. THE FLOOR MOVES WITH THE SIGN.',
    ),
    clearKills: 9,
    opening: { sentries: 4, viruses: 4, worms: 1 },
    dataCrates: [crate(51, PROP.DOC)],
  },
  {
    id: 16,
    sector: 5,
    nodeId: 'airport',
    name: 'AIRPORT',
    code: 'DEPARTURES',
    arenaId: 23,
    intro: 'assault',
    blurb: kitty(
      'airport',
      'AIRPORT. DEPARTURES IS CANCELLED. ARRIVALS IS A FIREFIGHT.',
      'A FILE BLOB IS HOLDING THE DEPARTURES BOARD HOSTAGE. GROUND IT.',
    ),
    clearKills: 0,
    opening: { sentries: 4, viruses: 2, worms: 1 },
    boss: MINIBOSS.BLOB,
    dataCrates: [],
  },
  {
    id: 17,
    sector: 5,
    nodeId: 'airport',
    name: 'AIR TRAFFIC',
    code: 'TOWER',
    arenaId: 33,
    intro: 'assault',
    blurb: kitty(
      'air-traffic',
      'AIR TRAFFIC CONTROL. EVERY BLIP ON THIS SCOPE IS A BAD PACKET.',
      'A STORM CELL IS PARKED OVER THE TOWER. KEEP IT OFF THE PLANES.',
    ),
    clearKills: 0,
    opening: { sentries: 4, viruses: 2, worms: 1 },
    boss: MINIBOSS.STORM_CLOUD,
    dataCrates: [],
  },
  {
    id: 18,
    sector: 6,
    nodeId: 'orbit',
    name: 'CAPCOM',
    code: 'FLIGHT LOOP',
    arenaId: 32,
    intro: 'assault',
    blurb: kitty(
      'capcom',
      'CAPCOM. MISSION CONTROL, 1968. SOMEONE IS STILL CALLING HOUSTON.',
      'THE INFECTION IS IN THE FLIGHT PLAN. SCRUB THE LAUNCH.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(32, PROP.ZIP)],
  },
  {
    id: 19,
    sector: 6,
    nodeId: 'orbit',
    name: 'ROCKET NAVIGATION',
    code: 'LAUNCH WINDOW',
    arenaId: 18,
    intro: 'assault',
    blurb: kitty(
      'rocket-navigation',
      'ROCKET NAVIGATION. THE INFECTION IS TRYING TO LEAVE THE NETWORK THE HARD WAY.',
      'RIDE THE ARC. CUT IT OFF AT THE PAD.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(18, PROP.VIDEO)],
  },
  {
    id: 20,
    sector: 6,
    nodeId: 'orbit',
    name: 'SATELLITE',
    code: 'ORBIT',
    arenaId: 17,
    intro: 'assault',
    blurb: kitty(
      'satellite',
      'SATELLITE. THE VIEW IS GREAT. THE SOLAR WINGS ARE ON FIRE.',
      'A PAIR OF HANDS IS WORKING THE SOLAR WINGS. CUT THEM OFF.',
    ),
    clearKills: 0,
    opening: { sentries: 4, viruses: 2, worms: 1 },
    boss: MINIBOSS.IDLE_HANDS,
    dataCrates: [],
  },
  {
    id: 21,
    sector: 7,
    nodeId: 'arcade',
    name: 'SPACE CADET',
    code: 'TILT',
    arenaId: 10,
    intro: 'assault',
    blurb: kitty(
      'space-cadet',
      'SPACE CADET. A PINBALL TABLE IN THE ARCADE ROW. THE INFECTION HAS MULTIBALL.',
      'KEEP THE BALL OFF THE DRAIN AND THE BUGS OFF THE TABLE.',
    ),
    clearKills: 7,
    opening: { sentries: 4, viruses: 2, worms: 1 },
    dataCrates: [crate(10, PROP.AUDIO)],
  },
  {
    id: 22,
    sector: 7,
    nodeId: 'arcade',
    name: 'PONG',
    code: 'SERVE',
    arenaId: 22,
    intro: 'assault',
    blurb: kitty(
      'pong',
      'PONG. TWO PADDLES, ONE BALL, NO MERCY.',
      'THE INFECTION IS PLAYING BOTH SIDES. BREAK THE RALLY.',
    ),
    clearKills: 7,
    opening: { sentries: 4, viruses: 2, worms: 1 },
    dataCrates: [crate(22, PROP.ZIP)],
  },
  {
    id: 23,
    sector: 7,
    nodeId: 'arcade',
    name: 'SPACE INVADERS',
    code: 'WAVE 01',
    arenaId: 24,
    intro: 'assault',
    blurb: kitty(
      'space-invaders',
      'SPACE INVADERS. THE FLEET IS THE FLOOR. THE INFECTION BROUGHT FRIENDS.',
      'SOMETHING WITH FIVE ARMS IS HATCHING IN THE FORMATION.',
    ),
    clearKills: 0,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    boss: MINIBOSS.STARFISH,
    dataCrates: [],
  },
  {
    id: 24,
    sector: 7,
    nodeId: 'arcade',
    name: 'ARCADE RACING',
    code: 'LAP 01',
    arenaId: 45,
    intro: 'assault',
    blurb: kitty(
      'arcade-racing',
      'ARCADE RACING. FIVE CARS, NO BRAKES, AND THE INFECTION IS IN THE LEAD.',
      'MIND THE RAIL. THE CARS DO NOT.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(45, PROP.AUDIO)],
  },
  {
    id: 25,
    sector: 7,
    nodeId: 'arcade',
    name: 'FIGHTING GAME',
    code: 'ROUND 01',
    arenaId: 46,
    intro: 'assault',
    blurb: kitty(
      'fighting-game',
      'FIGHTING GAME. TWO CABINETS, ONE LANE, ZERO SPORTSMANSHIP.',
      'THE INFECTION HAS A COMBO. REFLECT IT.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(46, PROP.VIDEO)],
  },
  {
    id: 26,
    sector: 7,
    nodeId: 'arcade',
    name: 'DUCK HUNTER',
    code: 'MARKED BIRD',
    arenaId: 47,
    intro: 'assault',
    blurb: kitty(
      'duck-hunter',
      'DUCK HUNTER. THE DUCKS ARE FINE. THE INFECTION IS THE ONE SHOOTING.',
      'WATCH THE MARKED BIRD. THEN WATCH THE SKY.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(47, PROP.DOC)],
  },
  {
    id: 27,
    sector: 7,
    nodeId: 'arcade',
    name: 'TETRIS',
    code: 'LINE CLEAR',
    arenaId: 48,
    intro: 'assault',
    blurb: kitty(
      'tetris-arcade',
      'TETRIS. TEN COLUMNS WIDE AND THE INFECTION IS STACKING THE DECK.',
      'THE STACK IS COVER. CLEAR THE LINES BEFORE IT REACHES THE CEILING.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(48, PROP.AUDIO)],
  },
  {
    id: 28,
    sector: 7,
    nodeId: 'food-court',
    name: 'SNACK MACHINE',
    code: 'CHUTE 03',
    arenaId: 42,
    intro: 'assault',
    blurb: kitty(
      'snack-machine',
      'SNACK MACHINE. THE INFECTION ORDERED EVERYTHING AND PAID IN BUGS.',
      'WATCH THE CHUTE. THE PACKET DROPS LIKE A BRICK.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(42, PROP.DOC)],
  },
  {
    id: 29,
    sector: 7,
    nodeId: 'food-court',
    name: 'TOKEN DISPENSER',
    code: 'COIN DROP',
    arenaId: 43,
    intro: 'assault',
    blurb: kitty(
      'token-dispenser',
      'TOKEN DISPENSER. THE HOUSE ALWAYS WINS, EVEN WHEN THE HOUSE IS INFECTED.',
      'KEEP OFF THE TRAY. THE COILS ARE STILL PAYING OUT.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(43, PROP.ZIP)],
  },
  {
    id: 30,
    sector: 7,
    nodeId: 'food-court',
    name: 'SODA MACHINE',
    code: 'CHILLER',
    arenaId: 44,
    intro: 'assault',
    blurb: kitty(
      'soda-machine',
      'SODA MACHINE. THE COOLER IS THE ONLY COVER LEFT IN THE FOOD COURT.',
      'IT IS ALSO EMPTYING. MIND THE SHELVES.',
    ),
    clearKills: 9,
    opening: { sentries: 5, viruses: 3, worms: 1 },
    dataCrates: [crate(44, PROP.AUDIO)],
  },
  {
    id: 31,
    sector: 8,
    nodeId: 'ai-core',
    name: 'CPU BOARD',
    code: 'CORE COMPLEX',
    arenaId: 37,
    intro: 'assault',
    blurb: kitty(
      'cpu-board',
      'CPU BOARD. EVERY CORE IS BUSY, AND NONE OF THEM ARE OURS.',
      'THE INFECTION IS ARBITRATING THE FLOOR. BREAK THE BUS.',
    ),
    clearKills: 9,
    opening: { sentries: 5, viruses: 3, worms: 1 },
    dataCrates: [crate(37, PROP.ZIP)],
  },
  {
    id: 32,
    sector: 8,
    nodeId: 'ai-core',
    name: 'GPU BOARD',
    code: 'HOT AISLE',
    arenaId: 38,
    intro: 'assault',
    blurb: kitty(
      'gpu-board',
      'GPU BOARD. FOUR ACCELERATORS AND A COOLING SYSTEM THAT GAVE UP.',
      'THE CARDS WARN BEFORE THEY BURN. KEEP MOVING.',
    ),
    clearKills: 9,
    opening: { sentries: 5, viruses: 3, worms: 1 },
    dataCrates: [crate(38, PROP.VIDEO)],
  },
  {
    id: 33,
    sector: 8,
    nodeId: 'ai-core',
    name: 'DISPATCH YARD',
    code: 'REQUEST LINE',
    arenaId: 40,
    intro: 'assault',
    blurb: kitty(
      'dispatch-yard',
      'DISPATCH YARD. THREE PLATFORMS, THREE CARS, ONE VERY IMPATIENT SCHEDULE.',
      'WATCH THE SIGNAL. THE TRAIN DOES NOT STOP FOR YOU.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(40, PROP.DOC)],
  },
  {
    id: 34,
    sector: 8,
    nodeId: 'ai-core',
    name: 'LOAD BALANCER',
    code: 'ROUND ROBIN',
    arenaId: 41,
    intro: 'assault',
    blurb: kitty(
      'load-balancer',
      'LOAD BALANCER. EVERY REQUEST FINDS A LANE. MAKE SURE IT IS NOT YOURS.',
      'THE ROTOR IS FAIR. THE TRAINS ARE NOT.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(41, PROP.ZIP)],
  },
  {
    id: 35,
    sector: 8,
    nodeId: 'ai-core',
    name: 'NETWORK BOARD',
    code: 'FABRIC // FINAL',
    arenaId: 39,
    intro: 'assault',
    blurb: kitty(
      'network-board-final',
      'NETWORK BOARD. THE LAST MOTHERBOARD BETWEEN THE INFECTION AND THE OPEN NETWORK.',
      'THE USER IS HOLDING THE BACKBONE. CUT IT OUT.',
    ),
    clearKills: 0,
    finale: true,
    opening: { sentries: 5, viruses: 3, worms: 1 },
    boss: MINIBOSS.USER,
    dataCrates: [],
  },
];

/** Levels the live campaign can start and advance through. */
export const PLAYABLE_CAMPAIGN_LEVELS = CAMPAIGN_LEVELS.filter((level) => level.playable !== false);

/**
 * Map a slot authored against an older route onto the current level order. `level` is the
 * completed count, so it is also the next level index. Route v2 moved TETRIS into the
 * arcade and made NETWORK BOARD the finale; route v3 inserts the six-level ROAD TRIP
 * before AIRPORT. A slot keeps the arena it was facing, and a completed old route gets
 * one final run at the new NETWORK BOARD.
 */
export function migrateCampaignLevel(level: number, nodeId: string, routeVersion: number): number {
  let next = Math.max(0, Math.min(PLAYABLE_CAMPAIGN_LEVELS.length, Math.floor(level)));
  if (routeVersion >= STORY_ROUTE_VERSION) return next;
  if (routeVersion < 2) {
    // Pre-food-court slots: level 21 was the TETRIS finale, level 22 was a completed run.
    const arcadeFinale = nodeId === 'arcade' && (next === 21 || next === 22);
    if (!arcadeFinale && next >= 21 && next <= 26) next += 1;
  }
  if (routeVersion < 3 && next >= 10) next += 6;
  return Math.min(next, PLAYABLE_CAMPAIGN_LEVELS.length - 1);
}

/** The first authored level. Everything campaign-shaped starts here for now. */
export const FIRST_CAMPAIGN_LEVEL: CampaignLevel = PLAYABLE_CAMPAIGN_LEVELS[0] ?? CAMPAIGN_LEVELS[0];

/**
 * Linear today, branch-ready: every playable arena is one stop with explicit outgoing
 * links. Keeping the route granular lets the between-level plate draw the devices in
 * the current network instead of collapsing several arenas into one chapter dot.
 */
const routeStops: CampaignRouteStop[] = PLAYABLE_CAMPAIGN_LEVELS.map((level, index) => ({
  level: index,
  nodeId: level.nodeId,
  label: level.name,
  lane: 0,
  links: index + 1 < PLAYABLE_CAMPAIGN_LEVELS.length ? [index + 1] : [],
}));

export const CAMPAIGN_ROUTE: readonly CampaignRouteStop[] = routeStops;
