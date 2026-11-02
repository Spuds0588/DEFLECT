import { IDLE_HANDS, MEGA_WORM, STARFISH } from './config';

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
} as const;

export type MinibossBody = 'segmented-worm' | 'idle-hands' | 'starfish';

export interface MinibossDef {
  id: number;
  key: string;
  label: string;
  /** Tuning block the body reads. */
  tuning: typeof MEGA_WORM | typeof IDLE_HANDS | typeof STARFISH;
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
];

export function minibossDef(id: number): MinibossDef | null {
  for (let i = 0; i < MINIBOSSES.length; i++) if (MINIBOSSES[i].id === id) return MINIBOSSES[i];
  return null;
}
