/**
 * Campaign runtime data for the first playable node.
 *
 * `SECTORS` owns the route graph and `saves.ts` owns the slots; this module is the
 * bridge between them and `World`. A level names the node, the arena blockout and the
 * sector it belongs to. The script itself (sparring drill, breach, threat assault) lives
 * in `World`; every tuning number lives in the `CAMPAIGN` block in `config.ts`.
 */
import { PROP } from './types';

/** A data crate the level asks the player to preserve. Local-only, spawned on the breach. */
export interface CampaignDataCrate {
  x: number;
  y: number;
  kind: number;
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
  /** False keeps an authored level out of the live campaign route until it ships. */
  playable?: boolean;
  /**
   * Data crates on the arena. They are the level's clean-sweep objective: break one and
   * the score loses its preservation pay. Spawned on the breach, never in snapshots.
   */
  dataCrates: readonly CampaignDataCrate[];
}

export type CampaignIntro = 'none' | 'warden' | 'kitty';

export const CAMPAIGN_LEVELS: readonly CampaignLevel[] = [
  {
    id: 0,
    sector: 0,
    nodeId: 'build-root',
    name: 'BUILD ROOT',
    code: 'FIRST BOOT',
    arenaId: 14,
    intro: 'warden',
    clearKills: 10,
    // Spread through the tutorial rooms: the intake files, the board's packets and the
    // router's uplink crates. The clean-sweep pay is lost when any one is broken.
    // One plate each: the intake desks, the holding office and the two far islands.
    dataCrates: [
      { x: 560, y: 130, kind: PROP.DOC },
      { x: 310, y: 400, kind: PROP.ZIP },
      { x: 700, y: 720, kind: PROP.AUDIO },
      { x: 1500, y: 900, kind: PROP.VIDEO },
      { x: 1750, y: 760, kind: PROP.DOC },
      { x: 1350, y: 180, kind: PROP.ZIP },
    ],
  },
  {
    id: 1,
    sector: 0,
    nodeId: 'script-kitty',
    name: 'REBOOT',
    code: 'REMEMBER',
    arenaId: 1,
    intro: 'kitty',
    // Parked until the campaign route continues past BUILD ROOT.
    playable: false,
    // A short live-fire check after the lesson, not a full assault.
    clearKills: 4,
    dataCrates: [],
  },
];

/** Levels the live campaign can start and advance through. */
export const PLAYABLE_CAMPAIGN_LEVELS = CAMPAIGN_LEVELS.filter((level) => level.playable !== false);

/** The first authored level. Everything campaign-shaped starts here for now. */
export const FIRST_CAMPAIGN_LEVEL: CampaignLevel = PLAYABLE_CAMPAIGN_LEVELS[0] ?? CAMPAIGN_LEVELS[0];
