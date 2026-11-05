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
  /** Keep the floor to the primitive family (worms) for this level. */
  primitivesOnly?: boolean;
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
    opening: { sentries: 3, viruses: 1, worms: 0 },
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
    opening: { sentries: 3, viruses: 1, worms: 1 },
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
    opening: { sentries: 4, viruses: 2, worms: 1 },
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
      'THE BLOB IS IN HERE. CLEAR THE FOLDER AND I WILL PULL THE PLUG.',
    ),
    clearKills: 0,
    opening: { sentries: 5, viruses: 3, worms: 1 },
    boss: MINIBOSS.BLOB,
    dataCrates: [],
  },
  {
    id: 10,
    sector: 5,
    nodeId: 'airport',
    name: 'AIRPORT',
    code: 'DEPARTURES',
    arenaId: 23,
    intro: 'assault',
    blurb: kitty(
      'airport',
      'AIRPORT. DEPARTURES IS CANCELLED. ARRIVALS IS A FIREFIGHT.',
      'THE INFECTION BOOKED A ONE-WAY FLIGHT. GROUND IT.',
    ),
    clearKills: 7,
    opening: { sentries: 4, viruses: 2, worms: 1 },
    dataCrates: [crate(23, PROP.DOC)],
  },
  {
    id: 11,
    sector: 5,
    nodeId: 'airport',
    name: 'AIR TRAFFIC',
    code: 'TOWER',
    arenaId: 33,
    intro: 'assault',
    blurb: kitty(
      'air-traffic',
      'AIR TRAFFIC CONTROL. EVERY BLIP ON THIS SCOPE IS A BAD PACKET.',
      'KEEP THE INFECTION OFF THE TOWER AND THE PLANES STAY UP.',
    ),
    clearKills: 7,
    opening: { sentries: 4, viruses: 2, worms: 1 },
    dataCrates: [crate(33, PROP.AUDIO)],
  },
  {
    id: 12,
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
    id: 13,
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
    id: 14,
    sector: 6,
    nodeId: 'orbit',
    name: 'SATELLITE',
    code: 'ORBIT',
    arenaId: 17,
    intro: 'assault',
    blurb: kitty(
      'satellite',
      'SATELLITE. THE VIEW IS GREAT. THE SOLAR WINGS ARE ON FIRE.',
      'THE INFECTION RODE AN UPLINK UP HERE. BURN IT OUT.',
    ),
    clearKills: 7,
    opening: { sentries: 4, viruses: 2, worms: 1 },
    dataCrates: [crate(17, PROP.DOC)],
  },
  {
    id: 15,
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
    id: 16,
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
    id: 17,
    sector: 7,
    nodeId: 'arcade',
    name: 'SPACE INVADERS',
    code: 'WAVE 01',
    arenaId: 24,
    intro: 'assault',
    blurb: kitty(
      'space-invaders',
      'SPACE INVADERS. THE FLEET IS THE FLOOR. THE INFECTION BROUGHT FRIENDS.',
      'CLEAR THE FORMATION. IT IS NOT A HIGH SCORE.',
    ),
    clearKills: 8,
    opening: { sentries: 4, viruses: 3, worms: 1 },
    dataCrates: [crate(24, PROP.DOC)],
  },
  {
    id: 18,
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
    id: 19,
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
    id: 20,
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
    id: 21,
    sector: 7,
    nodeId: 'arcade',
    name: 'TETRIS',
    code: 'LINE CLEAR',
    arenaId: 48,
    intro: 'assault',
    blurb: kitty(
      'tetris',
      'TETRIS. TEN COLUMNS WIDE AND THE INFECTION IS STACKING THE DECK.',
      'CLEAR THE LINES. I WILL HANDLE THE REST.',
    ),
    clearKills: 0,
    finale: true,
    opening: { sentries: 5, viruses: 3, worms: 1 },
    boss: MINIBOSS.STORM_CLOUD,
    dataCrates: [],
  },
];

/** Levels the live campaign can start and advance through. */
export const PLAYABLE_CAMPAIGN_LEVELS = CAMPAIGN_LEVELS.filter((level) => level.playable !== false);

/** The first authored level. Everything campaign-shaped starts here for now. */
export const FIRST_CAMPAIGN_LEVEL: CampaignLevel = PLAYABLE_CAMPAIGN_LEVELS[0] ?? CAMPAIGN_LEVELS[0];

/**
 * Linear today, branch-ready: every stop names its outgoing links explicitly. Consecutive
 * levels that share a `nodeId` are one stop, because the route plate is the network map
 * between levels, not a card between every arena in the same level.
 */
const routeStops: CampaignRouteStop[] = [];
for (let i = 0; i < PLAYABLE_CAMPAIGN_LEVELS.length; i++) {
  const level = PLAYABLE_CAMPAIGN_LEVELS[i];
  if (routeStops.length > 0 && routeStops[routeStops.length - 1].nodeId === level.nodeId) continue;
  routeStops.push({ level: i, nodeId: level.nodeId, label: level.name, lane: 0, links: [] });
}

export const CAMPAIGN_ROUTE: readonly CampaignRouteStop[] = routeStops.map((stop, index) => ({
  ...stop,
  links: index + 1 < routeStops.length ? [index + 1] : [],
}));
