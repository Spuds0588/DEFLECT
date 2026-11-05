import { BLOB, IDLE_HANDS, MEGA_WORM, STARFISH, STORM_CLOUD, USER } from './config';

/**
 * Mini-boss registry. A mini-boss is an ordinary gauntlet arrival with boss-scale
 * state, delivered through the same ingress family as any other threat. Add a boss
 * by adding an entry here, a tuning block, and a spawn branch in `World.spawnMiniboss`;
 * do not add a second arrival path for it.
 */
export const MINIBOSS = {
  MEGA_WORM: 0,
  IDLE_HANDS: 1,
  STARFISH: 2,
  BLOB: 3,
  STORM_CLOUD: 4,
  USER: 5,
} as const;

export type MinibossBody = 'segmented-worm' | 'idle-hands' | 'starfish' | 'blob' | 'storm-cloud' | 'user';

export interface MinibossDef {
  id: number;
  key: string;
  label: string;
  /** Tuning block the body reads. */
  tuning:
    | typeof MEGA_WORM
    | typeof IDLE_HANDS
    | typeof STARFISH
    | typeof BLOB
    | typeof STORM_CLOUD
    | typeof USER;
  /** Which body builder and renderer this boss uses. */
  body: MinibossBody;
}

export const MINIBOSSES: readonly MinibossDef[] = [
  {
    id: MINIBOSS.MEGA_WORM,
    key: 'mega-worm',
    label: 'MEGA WORM',
    tuning: MEGA_WORM,
    body: 'segmented-worm',
  },
  {
    id: MINIBOSS.IDLE_HANDS,
    key: 'idle-hands',
    label: 'IDLE HANDS',
    tuning: IDLE_HANDS,
    body: 'idle-hands',
  },
  {
    id: MINIBOSS.STARFISH,
    key: 'starfish',
    label: 'STARFISH',
    tuning: STARFISH,
    body: 'starfish',
  },
  {
    id: MINIBOSS.BLOB,
    key: 'blob',
    label: 'FILE BLOB',
    tuning: BLOB,
    body: 'blob',
  },
  {
    id: MINIBOSS.STORM_CLOUD,
    key: 'storm-cloud',
    label: 'STORM CLOUD',
    tuning: STORM_CLOUD,
    body: 'storm-cloud',
  },
  {
    id: MINIBOSS.USER,
    key: 'user',
    label: 'USER',
    tuning: USER,
    body: 'user',
  },
];

/**
 * BOSS RUSH ladder: registry order, walked once. USER is deliberately excluded: it is
 * the authored campaign finale, staged for the full width of NETWORK BOARD, not a
 * gauntlet ladder round. The campaign spawns it through `spawnMiniboss` directly.
 */
export const BOSS_RUSH_ORDER: readonly number[] = MINIBOSSES.filter(
  (d) => d.id !== MINIBOSS.USER,
).map((d) => d.id);

export function minibossDef(id: number): MinibossDef | null {
  for (let i = 0; i < MINIBOSSES.length; i++) if (MINIBOSSES[i].id === id) return MINIBOSSES[i];
  return null;
}
