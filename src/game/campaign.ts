/**
 * Campaign runtime data for the first playable node.
 *
 * `SECTORS` owns the route graph and `saves.ts` owns the slots; this module is the
 * bridge between them and `World`. A level names the node, the arena blockout and the
 * sector it belongs to. The script itself (sparring drill, breach, threat assault) lives
 * in `World`; every tuning number lives in the `CAMPAIGN` block in `config.ts`.
 */
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
}

export const CAMPAIGN_LEVELS: readonly CampaignLevel[] = [
  {
    id: 0,
    sector: 0,
    nodeId: 'build-root',
    name: 'BUILD ROOT',
    code: 'FIRST BOOT',
    arenaId: 0,
  },
];

/** The first authored level. Everything campaign-shaped starts here for now. */
export const FIRST_CAMPAIGN_LEVEL: CampaignLevel = CAMPAIGN_LEVELS[0];
