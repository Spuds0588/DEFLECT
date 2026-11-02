import { MEGA_WORM } from './config';

/**
 * Mini-boss registry. A mini-boss is an ordinary gauntlet arrival with boss-scale
 * state, delivered through the same ingress family as any other threat. Add a boss
 * by adding an entry here, a tuning block, and a spawn branch in `World.spawnMiniboss`;
 * do not add a second arrival path for it.
 */
export const MINIBOSS = {
  MEGA_WORM: 0,
} as const;

export interface MinibossDef {
  id: number;
  key: string;
  label: string;
  /** Tuning block the body reads. */
  tuning: typeof MEGA_WORM;
  /** True while this boss uses the segmented worm body (`Worm` with per-plate health). */
  segmentedWorm: boolean;
}

export const MINIBOSSES: readonly MinibossDef[] = [
  {
    id: MINIBOSS.MEGA_WORM,
    key: 'mega-worm',
    label: 'MEGA WORM',
    tuning: MEGA_WORM,
    segmentedWorm: true,
  },
];

export function minibossDef(id: number): MinibossDef | null {
  for (let i = 0; i < MINIBOSSES.length; i++) if (MINIBOSSES[i].id === id) return MINIBOSSES[i];
  return null;
}
