/**
 * Program roster. A program is the avatar's kit: weak attack, dodge identity,
 * strong-attack shape and signature bug. Keep descriptions here so the title
 * console and the settings screen can share one source of truth.
 */
import { PROGRAM_COLORS } from './identity';

export const PROGRAM_ID = {
  PROBE: 0,
  WEDGE: 1,
  FISHER: 2,
  SWEEP: 3,
} as const;

export interface ProgramDef {
  id: number;
  name: string;
  role: string;
  note: string;
  color: string;
  /**
   * Center mark. A single glyph keeps full size unless `coreScale` shrinks it for a
   * tight hull; text-character combos, dingbats/wingdings and multi-line ASCII pictures
   * are allowed and are measured against the symbol font stack, then scaled to fit the
   * core and the select portrait. Example: a bulldozer made from o|`|o:( or a two-line
   * picture. Prefer direction-neutral art at the core, and check the mark at full and
   * one-segment health so it never touches the bright hull.
   */
  glyph: string;
  /** Core mark scale. Tight hulls need a smaller mark so it clears the health segments. */
  coreScale: number;
  /**
   * Mark radius as a fraction of `PLAYER.radius`. Defaults to 0.51, the dark core disc.
   * A wide multi-line ASCII mark needs a larger footprint to stay legible; it may use
   * the empty space out to the hull as long as it never touches the health segments.
   */
  glyphRadius?: number;
  bugKind: number;
}

export const PROGRAMS: readonly ProgramDef[] = [
  {
    id: PROGRAM_ID.PROBE,
    name: 'PROBE.EXE',
    role: 'BALANCED',
    note: 'FIVE-SHOT BURST // CHARGED BEAM // PROXIMITY MINE',
    color: PROGRAM_COLORS.probe,
    glyph: '◎',
    coreScale: 1.12,
    bugKind: 0,
  },
  {
    id: PROGRAM_ID.WEDGE,
    name: 'WEDGE.EXE',
    role: 'BRAWLER',
    note: 'THREE-SHOT STRING // BRACKET DASH // CHARGE PLOW // STATIC WALL',
    color: PROGRAM_COLORS.wedge,
    /** A plate, not a triangle: any pointing glyph reads as facing. */
    glyph: '▣',
    // The diamond's sides sit at cos(45°) * radius, the tightest core of the roster.
    coreScale: 0.88,
    bugKind: 4,
  },
  {
    id: PROGRAM_ID.FISHER,
    name: 'FISHER.EXE',
    role: 'CONTROL',
    note: 'PIERCING SPEAR // WEB NET // LURE BEACON',
    color: PROGRAM_COLORS.fisher,
    glyph: '≈',
    coreScale: 1.1,
    bugKind: 5,
  },
  {
    id: PROGRAM_ID.SWEEP,
    name: 'SWEEP.EXE',
    role: 'SHOVE',
    note: 'BROOM COMBO // GIANT SWEEP // SPLIT BROOMS',
    color: PROGRAM_COLORS.sweep,
    /**
     * Clean mark: a four-point sparkle. The only literal Unicode broom is a colour
     * emoji, which would break the one-hue silhouette, so the core says "clean" and
     * the kit carries the broom itself. Direction neutral and legible at core size.
     */
    glyph: '✦',
    coreScale: 1.06,
    bugKind: 6,
  },
];

export function programDef(id: number): ProgramDef {
  for (let i = 0; i < PROGRAMS.length; i++) {
    if (PROGRAMS[i].id === id) return PROGRAMS[i];
  }
  return PROGRAMS[0];
}

export function programName(id: number): string {
  return programDef(id).name;
}

export function clampProgram(id: number): number {
  if (!Number.isFinite(id)) return PROGRAM_ID.PROBE;
  if (id < 0 || id >= PROGRAMS.length) return PROGRAM_ID.PROBE;
  return Math.floor(id);
}
