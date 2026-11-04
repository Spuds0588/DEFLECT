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
    // Holding-cell rules: worms only until the block opens. Viruses arrive in later nodes.
    primitivesOnly: true,
    // Spread through the tutorial rooms: the intake files, the board's packets and the
    // router's uplink crates. The clean-sweep pay is lost when any one is broken.
    // One plate each: the intake desks, the holding office and the two far islands.
    dataCrates: [
      { x: 342, y: -78, kind: PROP.DOC },
      { x: -32, y: 326, kind: PROP.ZIP },
      { x: 552, y: 806, kind: PROP.AUDIO },
      { x: 1752, y: 1076, kind: PROP.VIDEO },
      { x: 2128, y: 866, kind: PROP.DOC },
      { x: 1528, y: -4, kind: PROP.ZIP },
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
    playable: true,
    // Four fodder bodies, then the Mega Worm is the level's final encounter.
    clearKills: 4,
    boss: MINIBOSS.MEGA_WORM,
    dataCrates: [],
  },
];

/** Levels the live campaign can start and advance through. */
export const PLAYABLE_CAMPAIGN_LEVELS = CAMPAIGN_LEVELS.filter((level) => level.playable !== false);

/** The first authored level. Everything campaign-shaped starts here for now. */
export const FIRST_CAMPAIGN_LEVEL: CampaignLevel = PLAYABLE_CAMPAIGN_LEVELS[0] ?? CAMPAIGN_LEVELS[0];
