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
  /** Time: a hot pink, held clear of the virus magenta and Kaboom's orange. */
  buffer: '#ff6ec7',
  /** Atomize: white, the one neutral outline in the roster. */
  atomize: '#ffffff',
  /** Ghost: cool steel grey, distinct from Atomize's pure white and the floor tones. */
  ghost: '#b9c4d0',
  lure: '#7dffd4',
} as const;

/** Atomize's three electron colours, cycled one per ranged shot. */
export const ATOM_BOLT_COLORS = ['#ffe14d', '#66ff9e', '#59c8ff'] as const;
/** The orbital shield balls are blue in every state, so a spent charge reads at a glance. */
export const ATOM_BALL_COLOR = '#59c8ff';

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

/**
 * One mark per breakable file box, indexed by `PROP` in types.ts. Monochrome marks only:
 * a colour emoji ignores fillStyle and would drop a bitmap into a vector arena.
 */
export const PROP_GLYPHS = ['▶', '▤', '▦', '♫'] as const;

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

/** One triangle with every corner rounded, built from three arcTo joins. */
function roundedTriangle(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
  round: number,
): void {
  ctx.moveTo((ax + bx) * 0.5, (ay + by) * 0.5);
  ctx.arcTo(bx, by, px, py, round);
  ctx.arcTo(px, py, ax, ay, round);
  ctx.arcTo(ax, ay, bx, by, round);
  ctx.closePath();
}

/**
 * Bad Lag's hourglass: two rounded triangles pointing at each other with their tips
 * overlapping, which is what gives the shape its pinched waist. Drawn as vector
 * geometry rather than a typed dingbat: U+29D7 falls back to a colour emoji on some
 * systems, which paints its own opaque tile over the core. This mark uses only the
 * caller's fill colour, so the core stays transparent.
 */
export function drawHourglassMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  const w = r * 0.58;
  const h = r * 0.82;
  // The tips cross the centre by this much. Without the overlap the neck reads as a
  // single touching point and the mark looks like a bowtie sticker, not a glass.
  const overlap = h * 0.18;
  const round = r * 0.17;
  ctx.beginPath();
  roundedTriangle(ctx, cx - w, cy - h, cx + w, cy - h, cx, cy + overlap, round);
  roundedTriangle(ctx, cx - w, cy + h, cx + w, cy + h, cx, cy - overlap, round);
  ctx.fill();
}

/**
 * Atomize's core: a filled nucleus inside three elliptical orbits. Drawn as vectors,
 * not the U+269B codepoint, so a host whose symbol font resolves the atom to a colour
 * emoji cannot paint an opaque tile into the core. Uses the caller's fill colour for
 * both the nucleus and the orbit strokes.
 */
export function drawAtomMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  const orbitX = r * 0.98;
  const orbitY = r * 0.34;
  ctx.save();
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.strokeStyle = ctx.fillStyle as string;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, orbitX, orbitY, (i * Math.PI) / 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Probe's core: a compass rose. A thin housing ring surrounds a four-point star, so
 * it reads as navigation hardware rather than as the old concentric target. The four
 * points are symmetric, which keeps it from reading as a facing arrow at the core.
 * Vector on every host, using only the caller's fill colour.
 */
export function drawCompassMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  const ring = r * 0.94;
  const outer = r * 0.67;
  const waist = r * 0.18;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.lineWidth = Math.max(1.05, r * 0.11);
  ctx.beginPath();
  ctx.arc(cx, cy, ring, 0, Math.PI * 2);
  ctx.stroke();
  // Four-point rose with concave sides. The waist is deliberately narrow so the tips
  // stay longer than a plus sign at the 11px core mark.
  ctx.beginPath();
  ctx.moveTo(cx, cy - outer);
  ctx.lineTo(cx + waist, cy - waist);
  ctx.lineTo(cx + outer, cy);
  ctx.lineTo(cx + waist, cy + waist);
  ctx.lineTo(cx, cy + outer);
  ctx.lineTo(cx - waist, cy + waist);
  ctx.lineTo(cx - outer, cy);
  ctx.lineTo(cx - waist, cy - waist);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Ghost's core: a closed eye, drawn as a downward lid arc with five short straight
 * lashes. It is vector so the mark stays monochrome and crisp at core size; the
 * glyph `◡` is only for text metadata. Uses the caller's fill colour as the stroke.
 */
export function drawGhostEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  const lidR = r * 0.64;
  // The lid curves down like a closed eye, not up like a smile. The arc is the
  // bottom half of its circle and the lashes hang outward below it.
  const lidY = cy - r * 0.2;
  const start = Math.PI * 0.14;
  const end = Math.PI * 0.86;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.lineWidth = Math.max(1.2, r * 0.13);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, lidY, lidR, start, end);
  ctx.stroke();
  // Lashes sit on the lid and point out along its normal, so the eye reads as closed
  // rather than as a plain smile. Five is enough at the 11px core mark; more turns to fuzz.
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = start + ((end - start) * (i + 0.5)) / 5;
    const lx = cx + Math.cos(a) * lidR;
    const ly = lidY + Math.sin(a) * lidR;
    const lash = r * (0.19 + (i === 2 ? 0.05 : 0));
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + Math.cos(a) * lash, ly + Math.sin(a) * lash);
  }
  ctx.stroke();
  ctx.restore();
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
  // Probe's compass is drawn rather than typed so the housing ring and rose keep the
  // exact same proportions at the core and on the select portrait.
  if (programId === 0) {
    drawCompassMark(ctx, cx, cy, r * fontScale);
    return;
  }
  // Bad Lag's term is vector on every host: the typed hourglass is an emoji on some
  // systems and would bring an opaque tile into the core.
  if (programId === 6) {
    drawHourglassMark(ctx, cx, cy, r * fontScale);
    return;
  }
  // Atomize's mark is the same atom on every host. It is drawn rather than typed so
  // the orbit strokes always use the program colour and the core stays transparent.
  if (programId === 7) {
    drawAtomMark(ctx, cx, cy, r * fontScale);
    return;
  }
  // Ghost's closed eye is a vector mark on every host, so the lid and lashes never
  // depend on a symbol font or a colour emoji.
  if (programId === 8) {
    drawGhostEye(ctx, cx, cy, r * fontScale);
    return;
  }
  if (programId === 5 && !hasSymbolFont(symbolFamily ?? '')) {
    drawBombMark(ctx, cx, cy, r * fontScale);
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
  // Bad Lag's hull is six round pips on a clock dial, not a polygon. The custom path
  // below owns the shape, so there are no sides for the frame pass to draw.
  if (programId === 6) return 0;
  // Atomize's hull is three overlapping ellipse orbits, split into six half-arcs.
  if (programId === 7) return 0;
  // Ghost's hull is three separate outward arcs, one per health segment.
  if (programId === 8) return 0;
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
  // Bad Lag's hull is a ring of clock faces, two per health segment, turning around
  // the body. Each clock is a small circle with a minute and an hour hand, so the
  // silhouette reads as time rather than as another polygon. The faces orbit at 0.78r
  // with a 0.17r radius, so their inner edge is 0.61r: just outside the core disc every
  // hull keeps clear. Hand angles differ per clock, so the ring reads as a set of
  // times instead of six identical dots.
  if (programId === 6) {
    const perSeg = 2;
    const count = segments * perSeg;
    const orbit = r * 0.78;
    const face = r * 0.17;
    for (let seg = 0; seg < freshSegments; seg++) {
      for (let k = 0; k < perSeg; k++) {
        const i = seg * perSeg + k;
        const a = spin + (i / count) * twoPi;
        const px = cx + Math.cos(a) * orbit;
        const py = cy + Math.sin(a) * orbit;
        ctx.moveTo(px + face, py);
        ctx.arc(px, py, face, 0, twoPi);
        // Minute hand, then a shorter hour hand at its own angle. Both turn with the
        // hull, so the clocks are alive instead of printed badges.
        const minute = spin * 1.6 + i * 0.9;
        const hour = minute + 1.9;
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(minute) * face * 0.68, py + Math.sin(minute) * face * 0.68);
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(hour) * face * 0.42, py + Math.sin(hour) * face * 0.42);
      }
    }
    return;
  }
  // Atomize's hull is three identical ellipses turned 60 degrees apart, the classic
  // atom. Each ellipse is split into two half-arcs, so three ovals make six health
  // segments. The inner edge sits at 0.55r, so the hull never reaches the core mark at
  // any health level; at full health the opaque disc hides the inner edge, and once the
  // disc shrinks the rings still clear the smaller mark. Do not flatten ry back toward
  // 0.4r: the ovals would then pass under the center mark at low health.
  if (programId === 7) {
    const rx = r * 0.98;
    const ry = r * 0.55;
    const perOrbit = 2;
    const gap = 0.07;
    for (let seg = 0; seg < freshSegments; seg++) {
      const orbit = Math.floor(seg / perOrbit);
      const half = seg % perOrbit;
      const rot = spin + orbit * (Math.PI / 3);
      const a0 = half * Math.PI + gap;
      const a1 = (half + 1) * Math.PI - gap;
      // Start each half on its own subpath, otherwise the ellipse joins the previous
      // arc with a chord across the body.
      const cosRot = Math.cos(rot);
      const sinRot = Math.sin(rot);
      const sa = Math.cos(a0);
      const sb = Math.sin(a0);
      ctx.moveTo(cx + cosRot * sa * rx - sinRot * sb * ry, cy + sinRot * sa * rx + cosRot * sb * ry);
      ctx.ellipse(cx, cy, rx, ry, rot, a0, a1);
    }
    return;
  }
  // Ghost's hull is three open arcs that curve outward, one health segment each. The
  // arc endpoints sit at 0.69r and the curve bulges to the hull radius, so the segments
  // read as the ghost's own shape and keep 0.18r of clear air inside the core mark.
  // Three 120-degree arcs leave a real gap between segments instead of a broken ring.
  if (programId === 8) {
    const inner = r * 0.69;
    const bulge = r * 1.34;
    const spread = 0.5;
    for (let seg = 0; seg < freshSegments; seg++) {
      const a = spin + seg * (twoPi / 3);
      const a0 = a - spread;
      const a1 = a + spread;
      ctx.moveTo(cx + Math.cos(a0) * inner, cy + Math.sin(a0) * inner);
      ctx.quadraticCurveTo(
        cx + Math.cos(a) * bulge,
        cy + Math.sin(a) * bulge,
        cx + Math.cos(a1) * inner,
        cy + Math.sin(a1) * inner,
      );
    }
    return;
  }
  // Kaboom's hull is three outward-pointing triangles, one health segment each, spaced
  // 120° apart so the set reads as a triangle made of triangles. The bases sit outside
  // the core disc (max 0.6r at full health) so no health segment ever crosses the
  // center mark: each blade is a short fin on the rim, not a wedge behind the bomb.
  if (programId === 5) {
    const baseR = r * 0.72;
    const halfAngle = 0.56;
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
