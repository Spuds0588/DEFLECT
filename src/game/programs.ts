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
  TOXIC: 4,
  KABOOM: 5,
  BUFFER: 6,
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
  /**
   * Optional font family for `glyph`. Wingdings is used by Kaboom's bomb (`M`). When
   * the family is missing, `drawProgramMark` falls back to a drawn bomb.
   */
  symbolFont?: string;
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
     * Clean mark: an eight-spoke burst. The core is too small for the two-row broom
     * picture to survive; it turns to mush inside the octagon, while this mark keeps
     * eight distinct spokes. The kit itself now draws literal ASCII brooms, so the
     * center only has to say "clean".
     */
    glyph: '✷',
    coreScale: 1.06,
    bugKind: 6,
  },
  {
    id: PROGRAM_ID.TOXIC,
    name: 'TOXIC.EXE',
    role: 'VENOM',
    note: 'NEEDLE DARTS // VENOM SPRAY // GAS CONE',
    color: PROGRAM_COLORS.toxic,
    /** Skull mark. Poisoned bodies flash the same skull so the status has one symbol. */
    glyph: '☠',
    coreScale: 1.0,
    bugKind: 7,
  },
  {
    id: PROGRAM_ID.KABOOM,
    name: 'KABOOM.EXE',
    role: 'BOMBER',
    note: 'SLOW BOMBS // LOB // BLAST ROW',
    color: PROGRAM_COLORS.kaboom,
    /**
     * Wingdings 'M' is the bomb. The font is checked at draw time; a host without
     * Wingdings gets the vector bomb so the core never reads as a letter.
     */
    glyph: 'M',
    symbolFont: 'Wingdings',
    // The hull fins start at 0.72r, so the bomb keeps clear air around it instead of
    // crowding the health segments.
    coreScale: 0.86,
    bugKind: 8,
  },
  {
    id: PROGRAM_ID.BUFFER,
    name: 'BUFFER_OVERFLOW.EXE',
    role: 'TIME',
    note: 'HOURGLASS THROW // FAST-FORWARD // TIME DILATION',
    color: PROGRAM_COLORS.buffer,
    /**
     * Hourglass. The arena never draws this codepoint: `drawProgramMark` swaps in a
     * vector hourglass so a system whose U+29D7 resolves to an emoji cannot drop an
     * opaque tile into the core. The glyph stays here for text and card metadata.
     */
    glyph: '⧗',
    // The hourglass shrinks away from the clock ring so neither hull nor core crowds
    // the other: the mark is half the height of a full-health hull, with real air.
    coreScale: 0.84,
    bugKind: 9,
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
