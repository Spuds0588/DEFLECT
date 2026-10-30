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

/**
 * Program accents. Offline, the avatar's outline and core take its program hue, so the
 * three roster entries sit at clearly different points on the wheel: cyan, amber, indigo.
 * Wedge stays out of the threat reds and yellows; Fisher stays clear of Probe's cyan.
 */
export const PROGRAM_COLORS = {
  probe: '#2ee6ff',
  wedge: '#ffb63c',
  fisher: '#8a7dff',
  sweep: '#b8ff3a',
  toxic: '#3dff6e',
  kaboom: '#ff5a3d',
  lure: '#7dffd4',
} as const;

/** Hostile palette. Kept here so threat colors never drift from the player palette. */
/** Pickup and active-powerup palette. Kept beside the identity colors so contrast is controlled. */
export const POWERUP_COLORS = {
  restore: '#5dffb0',
  machine: '#ffd54a',
  shotgun: '#ff9a3d',
  overcharge: '#c39bff',
  whip: '#ff4d6d',
  path: '#63e8ff',
} as const;

export const THREAT_COLORS = {
  worm: '#ff3b3b',
  virus: '#ff54d8',
  firewall: '#ffb02e',
  thrall: '#ff54d8',
  error: '#ffd23d',
  errorInk: '#ff2e2e',
  sentry: '#ff7a3d',
  homing: '#ff4f6d',
  flock: '#ffb03a',
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
/**
 * Mono first so ASCII marks keep their columns, then symbol fonts so dingbats and
 * wingdings-style marks resolve to a real glyph instead of a missing-glyph box.
 * Canvas falls back per character, so one stack serves both.
 */
const SYMBOL_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Segoe UI Symbol', 'Noto Sans Symbols 2', 'Apple Symbols', 'Noto Sans Symbols', Wingdings, Webdings, monospace";
/** Measured advance per em, cached per line so draw() never measures text per frame. */
const SYMBOL_ADVANCE = new Map<string, number>();
const SYMBOL_SIZE_LARGE = 22;
const SYMBOL_SIZE_SMALL = 11;
/** Multi-line ASCII marks are split once, not on every frame. */
const SYMBOL_LINES = new Map<string, string[]>();
/** Font strings are cached by half-pixel size; draw() must not build strings per frame. */
const SYMBOL_FONT_CACHE = new Map<number, string>();

export function symbolFont(px: number, family = ''): string {
  const size = Math.round(px * 2) / 2;
  // A program may name its own symbol family (Wingdings for Kaboom's bomb). Cache
  // those separately from the shared stack so the hot path still builds no strings.
  if (family) return `700 ${size}px ${family}`;
  let font = SYMBOL_FONT_CACHE.get(size);
  if (font === undefined) {
    font = `700 ${size}px ${SYMBOL_FONT}`;
    SYMBOL_FONT_CACHE.set(size, font);
  }
  return font;
}

/**
 * True when a named symbol font is actually installed in this browser.
 * `document.fonts.check` alone is not enough: Chrome reports true for a system
 * family it cannot resolve. So the family's glyph advances are compared with a
 * definitely-missing family; identical metrics mean the name fell back.
 */
const FONT_READY = new Map<string, boolean>();
const MISSING_FONT = '__deflect_missing_font__';
let probeCtx: CanvasRenderingContext2D | null = null;

function probeAdvance(family: string): number {
  if (typeof document === 'undefined') return 0;
  if (!probeCtx) probeCtx = document.createElement('canvas').getContext('2d');
  if (!probeCtx) return 0;
  probeCtx.font = `100px ${family}`;
  const m = probeCtx.measureText('M').width;
  const z = probeCtx.measureText('Z').width;
  const pua = probeCtx.measureText('\uF04D').width;
  return m * 31 + z * 17 + pua;
}

export function hasSymbolFont(family: string): boolean {
  if (!family) return false;
  const hit = FONT_READY.get(family);
  if (hit !== undefined) return hit;
  let ready = false;
  try {
    ready = typeof document !== 'undefined' && document.fonts.check(`16px ${family}`);
    if (ready) ready = probeAdvance(family) !== probeAdvance(MISSING_FONT);
  } catch {
    ready = false;
  }
  FONT_READY.set(family, ready);
  return ready;
}

/**
 * A vector bomb, used for Kaboom when Wingdings is not installed. A typed 'M' in a
 * missing family would read as a letter, so the core falls back to a drawn shell:
 * a round body, a lit fuse and a spark, all in the caller's current fill color.
 */
export function drawBombMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const bodyR = r * 0.64;
  const bodyY = cy + r * 0.14;
  ctx.beginPath();
  ctx.arc(cx, bodyY, bodyR, 0, Math.PI * 2);
  ctx.fill();
  // A bright inner rim keeps the sphere from reading as a flat dot at the small
  // projectile size. Never punch destination-out here: callers draw additively and
  // that would erase the world behind the bomb.
  ctx.save();
  ctx.globalAlpha *= 0.55;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(cx, bodyY, bodyR * 0.7, -2.5, -0.8);
  ctx.stroke();
  ctx.restore();
  // Fuse: a short kinked stem out of the top-right shoulder.
  ctx.lineWidth = Math.max(1.2, r * 0.2);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + bodyR * 0.52, bodyY - bodyR * 0.62);
  ctx.lineTo(cx + bodyR * 0.92, bodyY - bodyR * 1.02);
  ctx.lineTo(cx + r * 1.02, bodyY - bodyR * 0.88);
  ctx.stroke();
  // Spark: a hard square, matching the digital dust and shard language.
  ctx.fillRect(cx + r * 0.9, bodyY - bodyR * 1.28, Math.max(2, r * 0.26), Math.max(2, r * 0.26));
}

/** Draws a program's core mark, including Kaboom's missing-font fallback. */
export function drawProgramMark(
  ctx: CanvasRenderingContext2D,
  programId: number,
  glyph: string,
  symbolFamily: string | undefined,
  cx: number,
  cy: number,
  r: number,
  fontScale = 1,
): void {
  if (programId === 5 && !hasSymbolFont(symbolFamily ?? '')) {
    drawBombMark(ctx, cx, cy, r);
    return;
  }
  drawSymbol(ctx, glyph, cx, cy, r, fontScale, symbolFamily);
}

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
  drawSymbol(ctx, slotSymbol(kind), cx, cy, r);
}

/**
 * Health outlines are a program silhouette, not a shared circle: Probe scans with a ring,
 * Wedge holds a hard diamond, Fisher carries a hex reel. Segments are equal perimeter
 * slices with a real gap, so a lost segment reads at a glance.
 */
export function programHullSides(programId: number): number {
  if (programId === 1) return 4;
  if (programId === 2) return 6;
  // Sweep's octagon keeps three equal perimeter segments clean; a pentagon cut
  // through its corners and read as arbitrary chunks.
  if (programId === 3) return 8;
  // Toxic's six-point star has twelve equal edges, so three segments of four edges
  // each fall exactly on two points apiece.
  if (programId === 4) return 12;
  // Kaboom is three separate outward-pointing triangles; the custom path lives below.
  if (programId === 5) return 3;
  return 0;
}

/**
 * Builds the fresh health segments of a program outline as one path. Circles use arcs;
 * a square uses one bracket per corner, because equal perimeter slices cut through its
 * corners and read as arbitrary chunks. Other polygons keep equal perimeter slices.
 * The caller strokes the path three times (glow, mid, core) and owns color and alpha.
 */
export function pathProgramHealth(
  ctx: CanvasRenderingContext2D,
  programId: number,
  cx: number,
  cy: number,
  r: number,
  spin: number,
  freshSegments: number,
  segments: number,
): void {
  const twoPi = Math.PI * 2;
  const sides = programHullSides(programId);
  ctx.beginPath();
  // Kaboom's hull is three outward-pointing triangles, one health segment each, spaced
  // 120° apart so the set reads as a triangle made of triangles. Each base sits behind
  // the core disc and only the point clears it, so the segments read as three fins.
  if (programId === 5) {
    const baseR = r * 0.46;
    const halfAngle = 0.95;
    for (let seg = 0; seg < freshSegments; seg++) {
      const a = spin + seg * (twoPi / 3);
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(
        cx + Math.cos(a - halfAngle) * baseR,
        cy + Math.sin(a - halfAngle) * baseR,
      );
      ctx.lineTo(
        cx + Math.cos(a + halfAngle) * baseR,
        cy + Math.sin(a + halfAngle) * baseR,
      );
      ctx.closePath();
    }
    return;
  }
  // Toxic's hull is a pointed star rather than a regular polygon. Every edge is the
  // same length by symmetry, so equal perimeter slices are exact: three runs of four
  // edges, each covering two points.
  if (programId === 4) {
    const points = sides;
    const innerR = r * 0.52;
    const step = twoPi / points;
    const perSeg = Math.max(1, Math.floor(points / segments));
    // Trim almost a full edge end so the three segments read as separate arcs. At 0.05
    // the gaps were sub-pixel and the full-health star looked unbroken.
    const trim = 0.5;
    for (let s = 0; s < freshSegments; s++) {
      const first = s * perSeg;
      for (let e = 0; e < perSeg; e++) {
        const i0 = first + e;
        const i1 = i0 + 1;
        const a0 = spin + i0 * step;
        const a1 = spin + i1 * step;
        const r0 = i0 % 2 === 0 ? r : innerR;
        const r1 = i1 % 2 === 0 ? r : innerR;
        const x0 = cx + Math.cos(a0) * r0;
        const y0 = cy + Math.sin(a0) * r0;
        const x1 = cx + Math.cos(a1) * r1;
        const y1 = cy + Math.sin(a1) * r1;
        const t0 = e === 0 ? trim : 0;
        const t1 = e === perSeg - 1 ? 1 - trim : 1;
        const sx = x0 + (x1 - x0) * t0;
        const sy = y0 + (y1 - y0) * t0;
        const ex = x0 + (x1 - x0) * t1;
        const ey = y0 + (y1 - y0) * t1;
        if (e === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
        ctx.lineTo(ex, ey);
      }
    }
    return;
  }
  if (sides === 0) {
    const gap = 0.32;
    const span = (twoPi - gap * segments) / segments;
    for (let s = 0; s < freshSegments; s++) {
      const a0 = spin + s * (span + gap) + gap / 2;
      ctx.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
      ctx.arc(cx, cy, r, a0, a0 + span);
    }
    return;
  }

  const side = 2 * r * Math.sin(Math.PI / sides);
  if (sides === 4) {
    // Three health segments cannot divide four corners evenly. Draw three matching
    // corner brackets and let `pathProgramFrame` keep the fourth corner as thin frame.
    const arm = side * 0.34;
    const t = arm / side;
    const quarter = Math.PI / 2;
    for (let s = 0; s < freshSegments; s++) {
      const a = spin + s * quarter;
      const aPrev = a - quarter;
      const aNext = a + quarter;
      const vx = Math.cos(a) * r;
      const vy = Math.sin(a) * r;
      const px = vx + (Math.cos(aPrev) * r - vx) * t;
      const py = vy + (Math.sin(aPrev) * r - vy) * t;
      const nx = vx + (Math.cos(aNext) * r - vx) * t;
      const ny = vy + (Math.sin(aNext) * r - vy) * t;
      ctx.moveTo(cx + px, cy + py);
      ctx.lineTo(cx + vx, cy + vy);
      ctx.lineTo(cx + nx, cy + ny);
    }
    return;
  }

  const perim = side * sides;
  const gap = 0.055;
  const steps = 24;
  for (let s = 0; s < freshSegments; s++) {
    const from = (s / segments + gap) * perim;
    const to = ((s + 1) / segments - gap) * perim;
    for (let k = 0; k <= steps; k++) {
      const d = from + (to - from) * (k / steps);
      const raw = d / side;
      const idx = Math.floor(raw);
      const local = raw - idx;
      const a0 = spin + (idx * twoPi) / sides;
      const a1 = spin + ((idx + 1) * twoPi) / sides;
      const x0 = cx + Math.cos(a0) * r;
      const y0 = cy + Math.sin(a0) * r;
      const px = x0 + (cx + Math.cos(a1) * r - x0) * local;
      const py = y0 + (cy + Math.sin(a1) * r - y0) * local;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
}

/**
 * The thin structural rim for a four-corner hull. Wedge has three health brackets on a
 * four-corner diamond, so one corner is frame only; the rim keeps the silhouette closed
 * at every health level and must be drawn below the health strokes, never through them.
 */
export function pathProgramFrame(
  ctx: CanvasRenderingContext2D,
  programId: number,
  cx: number,
  cy: number,
  r: number,
  spin: number,
): void {
  // Kaboom has one triangle per health segment, so there is no frame-only corner and no
  // rim to draw: the three blades are the whole hull at every health level.
  if (programId === 5) return;
  if (programHullSides(programId) !== 4) return;
  const quarter = Math.PI / 2;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = spin + i * quarter;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  // The fourth corner gets a short frame-weight tab, not a full health bracket: the
  // square reads as four corners without pretending the fourth is another segment.
  const t = 0.2;
  const a = spin + 3 * quarter;
  const aPrev = a - quarter;
  const aNext = a + quarter;
  const vx = Math.cos(a) * r;
  const vy = Math.sin(a) * r;
  const px = vx + (Math.cos(aPrev) * r - vx) * t;
  const py = vy + (Math.sin(aPrev) * r - vy) * t;
  const nx = vx + (Math.cos(aNext) * r - vx) * t;
  const ny = vy + (Math.sin(aNext) * r - vy) * t;
  ctx.moveTo(cx + px, cy + py);
  ctx.lineTo(cx + vx, cy + vy);
  ctx.lineTo(cx + nx, cy + ny);
}

function widestLine(lines: string[]): string {
  let best = lines[0];
  for (let i = 1; i < lines.length; i++) if (lines[i].length > best.length) best = lines[i];
  return best;
}

/** Width of `text` in ems at any size. Measured once per line, never per frame. */
function emAdvance(ctx: CanvasRenderingContext2D, text: string, family = ''): number {
  const key = family ? `${family}|${text}` : text;
  const hit = SYMBOL_ADVANCE.get(key);
  if (hit !== undefined) return hit;
  ctx.save();
  ctx.font = symbolFont(100, family);
  const advance = ctx.measureText(text).width / 100;
  ctx.restore();
  SYMBOL_ADVANCE.set(key, advance);
  return advance;
}

/**
 * Draws a center mark. `fontScale` grows or shrinks the mark for a tight hull; a
 * multi-character string or multi-line ASCII picture is still scaled to fit the same
 * footprint, so a scaled mark cannot grow past its core. The mark width is measured
 * against the symbol font stack, so a wide dingbat or emoji is scaled down instead of
 * spilling through the health segments.
 */
export function drawSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: string,
  cx: number,
  cy: number,
  r: number,
  fontScale = 1,
  fontFamily = '',
): void {
  let lines = SYMBOL_LINES.get(symbol);
  if (!lines) {
    // Accept pasted ASCII art with a shared indentation: strip blank padding lines,
    // the common leading columns and trailing spaces once, so the picture stays
    // centered in the core and the select portrait.
    const raw = symbol.split(/\r?\n/);
    let first = 0;
    let last = raw.length - 1;
    while (first <= last && !raw[first].trim()) first++;
    while (last >= first && !raw[last].trim()) last--;
    if (first > last) {
      first = 0;
      last = 0;
    }
    let indent = Infinity;
    for (let i = first; i <= last; i++) {
      if (!raw[i].trim()) continue;
      let n = 0;
      while (n < raw[i].length && raw[i][n] === ' ') n++;
      if (n < indent) indent = n;
    }
    if (!Number.isFinite(indent)) indent = 0;
    lines = [];
    for (let i = first; i <= last; i++) {
      let line = raw[i].slice(indent);
      let end = line.length;
      while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t')) end--;
      lines.push(end === line.length ? line : line.slice(0, end));
    }
    SYMBOL_LINES.set(symbol, lines);
  }
  let longest = 1;
  for (let i = 0; i < lines.length; i++) if (lines[i].length > longest) longest = lines[i].length;

  const base = (r > 7 ? SYMBOL_SIZE_LARGE : SYMBOL_SIZE_SMALL) * (fontScale > 0 ? fontScale : 1);
  const multi = lines.length > 1;
  // Monospace advance is about 0.6em. Fit both the width and the line count inside
  // the same footprint as one glyph; a single glyph keeps its scaled font size.
  // A multi-line picture is wider by nature, so it gets a slightly tighter width
  // budget and closer rows: a wide ASCII mark must not cross the health hull.
  const advance = emAdvance(ctx, widestLine(lines), fontFamily);
  const widthFit = (r * (multi ? 1.78 : 2.15)) / Math.max(0.2, advance);
  const rowGap = multi ? 0.8 : 1.05;
  const heightFit = (r * 2.05) / (lines.length * rowGap);
  const single = !multi && longest <= 1;
  const scale = single
    ? Math.min(1, widthFit / base)
    : Math.max(0.12, Math.min(1, widthFit / base, heightFit / base));

  ctx.save();
  ctx.translate(cx, cy + 1);
  ctx.scale(scale, scale);
  ctx.font = symbolFont(base, fontFamily);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineH = base * rowGap;
  const top = -((lines.length - 1) * lineH) * 0.5;
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 0, top + i * lineH);
  ctx.restore();
}
