import { POWERUP } from './config';
import { POWERUP_COLORS } from './identity';

/**
 * Pickup content lives here, not in the simulation. Adding a new powerup means adding
 * an id, a definition, and its effect hook; the pickup pool, timer, renderer and audio
 * event all read this table.
 */
export const POWERUP_KIND = {
  RESTORE: 0,
  MACHINE_GUN: 1,
  SHOTGUN: 2,
  OVERCHARGE: 3,
  WHIP: 4,
  PATHFIND: 5,
} as const;

export type PowerupKind = (typeof POWERUP_KIND)[keyof typeof POWERUP_KIND];

export interface PowerupDef {
  kind: PowerupKind;
  label: string;
  color: string;
  /** 0 means instant, otherwise seconds the effect stays active. */
  duration: number;
  /** Relative spawn weight. Bigger numbers are more common. */
  weight: number;
}

export const POWERUPS: readonly PowerupDef[] = [
  {
    kind: POWERUP_KIND.RESTORE,
    label: 'RESTORE_STATUS',
    color: POWERUP_COLORS.restore,
    duration: 0,
    weight: 22,
  },
  {
    kind: POWERUP_KIND.MACHINE_GUN,
    label: 'MACHINE GUN',
    color: POWERUP_COLORS.machine,
    duration: POWERUP.duration,
    weight: 18,
  },
  {
    kind: POWERUP_KIND.SHOTGUN,
    label: 'SCATTER',
    color: POWERUP_COLORS.shotgun,
    duration: POWERUP.shotgunDuration,
    weight: 16,
  },
  {
    kind: POWERUP_KIND.OVERCHARGE,
    label: 'OVERCHARGE',
    color: POWERUP_COLORS.overcharge,
    duration: POWERUP.overchargeDuration,
    weight: 12,
  },
  {
    kind: POWERUP_KIND.WHIP,
    label: 'BARBED WHIP',
    color: POWERUP_COLORS.whip,
    duration: POWERUP.whipDuration,
    weight: 14,
  },
  {
    kind: POWERUP_KIND.PATHFIND,
    label: 'PATHFIND',
    color: POWERUP_COLORS.path,
    duration: POWERUP.pathDuration,
    weight: 18,
  },
];

/** Direct lookup by numeric id; ids are contiguous by design. */
export const POWERUP_BY_KIND: readonly PowerupDef[] = POWERUPS;

export function powerupDef(kind: number): PowerupDef {
  return POWERUP_BY_KIND[kind] ?? POWERUP_BY_KIND[0];
}

export function isTimedPowerup(kind: number): boolean {
  return kind > POWERUP_KIND.RESTORE && kind < POWERUP_BY_KIND.length;
}

/** Weighted roll over the table. Kept allocation-free for the sim tick. */
export function rollPowerup(roll: number): PowerupDef {
  let total = 0;
  for (let i = 0; i < POWERUPS.length; i++) total += POWERUPS[i].weight;
  let pick = roll * total;
  for (let i = 0; i < POWERUPS.length; i++) {
    pick -= POWERUPS[i].weight;
    if (pick <= 0) return POWERUPS[i];
  }
  return POWERUPS[POWERUPS.length - 1];
}
