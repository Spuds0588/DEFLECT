/**
 * Player identity system: a high-contrast neon ring color plus a unique geometric glyph.
 * Team modes later reuse the ring color for the team and keep the glyph per player.
 */

export interface Identity {
  hex: string;
  glyph: number;
  label: string;
}

export const PLAYER_IDENTITIES: readonly Identity[] = [
  { hex: '#2ee6ff', glyph: 0, label: 'cyan' },
  { hex: '#ff3ba7', glyph: 1, label: 'magenta' },
  { hex: '#b8ff3a', glyph: 2, label: 'lime' },
  { hex: '#ff8a2e', glyph: 3, label: 'orange' },
  { hex: '#a274ff', glyph: 4, label: 'violet' },
  { hex: '#ffd83d', glyph: 5, label: 'gold' },
  { hex: '#2bffb2', glyph: 6, label: 'mint' },
  { hex: '#e9f4ff', glyph: 7, label: 'ice' },
];

export function slotColor(slot: number): string {
  return PLAYER_IDENTITIES[((slot % PLAYER_IDENTITIES.length) + PLAYER_IDENTITIES.length) % PLAYER_IDENTITIES.length].hex;
}

export function slotGlyph(slot: number): number {
  return PLAYER_IDENTITIES[((slot % PLAYER_IDENTITIES.length) + PLAYER_IDENTITIES.length) % PLAYER_IDENTITIES.length].glyph;
}

/** Hostile palette. Kept here so threat colors never drift from the player palette. */
export const THREAT_COLORS = {
  worm: '#ff3b3b',
  virus: '#ff54d8',
  firewall: '#ffb02e',
  thrall: '#ff54d8',
  error: '#ffd23d',
  errorInk: '#ff2e2e',
} as const;

export const CALLSIGNS = [
  'VOLT',
  'NOVA',
  'ECHO',
  'GLITCH',
  'HEX',
  'BYTE',
  'NULL',
  'PIXEL',
  'VECTOR',
  'CIPHER',
  'FLUX',
  'ORBIT',
  'PRISM',
  'KILO',
  'ZETA',
  'RUNE',
] as const;

export function randomCallsign(): string {
  const i = Math.floor(Math.random() * CALLSIGNS.length);
  return CALLSIGNS[i];
}

export function sanitizeName(raw: string, fallback = 'GUEST'): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10);
  return cleaned || fallback;
}

/** Code-syntax symbols read as digital operators at a glance. One per slot. */
const PLAYER_SYMBOLS = ['$', '%', '&', '#', '@', 'π', 'Σ', '√'] as const;
const SYMBOL_FONT_LARGE = '700 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SYMBOL_FONT_SMALL = '700 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export function slotSymbol(slot: number): string {
  return PLAYER_SYMBOLS[((slot % PLAYER_SYMBOLS.length) + PLAYER_SYMBOLS.length) % PLAYER_SYMBOLS.length];
}

/**
 * Draws a glyph centered on (cx, cy) with radius r. Caller owns stroke/fill color,
 * line width is derived from r so glyphs stay legible at HUD sizes.
 */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  kind: number,
  cx: number,
  cy: number,
  r: number,
  _filled = false,
): void {
  ctx.save();
  ctx.font = r > 7 ? SYMBOL_FONT_LARGE : SYMBOL_FONT_SMALL;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(slotSymbol(kind), cx, cy + 1);
  ctx.restore();
}
