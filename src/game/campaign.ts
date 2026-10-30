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
  /**
   * Data crates on the arena. They are the level's clean-sweep objective: break one and
   * the score loses its preservation pay. Spawned on the breach, never in snapshots.
   */
  dataCrates: readonly CampaignDataCrate[];
}

export const CAMPAIGN_LEVELS: readonly CampaignLevel[] = [
  {
    id: 0,
    sector: 0,
    nodeId: 'build-root',
    name: 'BUILD ROOT',
    code: 'FIRST BOOT',
    arenaId: 0,
    // Placed in the open lanes of CROSSROADS, clear of its four pillars.
    dataCrates: [
      { x: 398, y: 300, kind: PROP.DOC },
      { x: 1540, y: 300, kind: PROP.ZIP },
      { x: 398, y: 800, kind: PROP.AUDIO },
      { x: 1540, y: 800, kind: PROP.VIDEO },
      { x: 974, y: 532, kind: PROP.DOC },
      { x: 974, y: 120, kind: PROP.ZIP },
    ],
  },
];

/** The first authored level. Everything campaign-shaped starts here for now. */
export const FIRST_CAMPAIGN_LEVEL: CampaignLevel = CAMPAIGN_LEVELS[0];
