/**
 * Campaign runtime data for the first playable node.
 *
 * `SECTORS` owns the route graph and `saves.ts` owns the slots; this module links them
 * to `World`. A level names the node, the arena blockout and the sector it belongs to.
 * Levels are an ordered route: a clear opens script_kitty's portal to the next arena,
 * never a bridge. The script itself (sparring drill, breach, threat assault) lives in
 * `World`; every tuning number lives in the `CAMPAIGN` block in `config.ts`.
 */
import { MINIBOSS } from './minibosses';
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
  label: string;
  lane: number;
  links: readonly number[];
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
    clearKills: 0,
    finale: true,
    opening: { sentries: 5, viruses: 3, worms: 1 },
    boss: MINIBOSS.BLOB,
    dataCrates: [],
  },
];

/** Levels the live campaign can start and advance through. */
export const PLAYABLE_CAMPAIGN_LEVELS = CAMPAIGN_LEVELS.filter((level) => level.playable !== false);

/** The first authored level. Everything campaign-shaped starts here for now. */
export const FIRST_CAMPAIGN_LEVEL: CampaignLevel = PLAYABLE_CAMPAIGN_LEVELS[0] ?? CAMPAIGN_LEVELS[0];

/** Linear today, branch-ready: every stop names its outgoing links explicitly. */
export const CAMPAIGN_ROUTE: readonly CampaignRouteStop[] = PLAYABLE_CAMPAIGN_LEVELS.map((level, index) => ({
  level: index,
  label: level.name,
  lane: 0,
  links: index + 1 < PLAYABLE_CAMPAIGN_LEVELS.length ? [index + 1] : [],
}));
