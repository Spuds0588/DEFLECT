import { ARENA, type Bounds, type Rect } from './config';

export interface SpawnPoint {
  x: number;
  y: number;
}

/** A paired teleporter plate. `pair` groups two plates into one link. */
export interface ArenaPadDef {
  x: number;
  y: number;
  radius: number;
  pair: number;
}

/** A lift plate. `link` is the index of the plate at the other deck. */
export interface ArenaLiftDef {
  x: number;
  y: number;
  radius: number;
  link: number;
}

/**
 * Optional floor traversal. The chasms are real body-blockers: bodies walk the bridge
 * around them, projectiles fly over them. Pads and lifts are the other two routes across.
 * Everything here is geometry + presentation, like the rest of the arena record.
 */
export interface ArenaTraversalDef {
  /** Open floor gaps. Bodies cannot enter; shots cross them. */
  chasms: Rect[];
  /** Deck plates drawn across a gap. Walkable because the chasm leaves that span open. */
  bridges: Rect[];
  /** Raised deck treatment. Purely visual; the pads and lifts make the deck change real. */
  upperDecks: Rect[];
  pads: ArenaPadDef[];
  lifts: ArenaLiftDef[];
}

/**
 * An arena is pure geometry + presentation. Collision, spawns, prediction, rendering and
 * the host snapshot all read this one definition so a guest can never simulate a different map.
 */
export interface ArenaDef {
  id: number;
  name: string;
  tagline: string;
  hudLabel: string;
  accent: string;
  accentSoft: string;
  accentFaint: string;
  /** Visual floor signature: 0 cross, 1 square, 2 rings, 3 chevrons. */
  signature: number;
  /** World-space playable rectangle. A compact arena can be exactly one viewport. */
  bounds: Bounds;
  pillars: Rect[];
  /** Ordered around the perimeter. Spawn selection spreads evenly for any player count. */
  spawns: SpawnPoint[];
  /**
   * Outer wall. `solid` (the default) is the old behavior: the bounds are a hard wall.
   * `open` means the floor simply ends: a body carried over the lip falls and de-rezzes,
   * shots die at the edge instead of ricocheting, and a shove becomes a kill.
   */
  walls?: 'solid' | 'open';
  /** Multi-deck floor content. Absent means a flat arena. */
  traverse?: ArenaTraversalDef;
}

const perimeterSpawns: SpawnPoint[] = [
  { x: 995, y: 131 },
  { x: 1651, y: 195 },
  { x: 1747, y: 547 },
  { x: 1651, y: 931 },
  { x: 995, y: 963 },
  { x: 339, y: 931 },
  { x: 243, y: 547 },
  { x: 339, y: 195 },
];

export const ARENAS: readonly ArenaDef[] = [
  {
    id: 0,
    name: 'CROSSROADS',
    tagline: 'Four gates. One center.',
    hudLabel: 'ARENA // CROSSROADS',
    accent: '#2ee6ff',
    accentSoft: 'rgba(46, 230, 255, 0.34)',
    accentFaint: 'rgba(46, 230, 255, 0.035)',
    signature: 0,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    pillars: [
      { x: 931, y: 211, w: 128, h: 208 },
      { x: 931, y: 675, w: 128, h: 208 },
      { x: 627, y: 483, w: 208, h: 128 },
      { x: 1155, y: 483, w: 208, h: 128 },
    ],
    spawns: perimeterSpawns,
  },
  {
    id: 1,
    name: 'GRID ZERO',
    tagline: 'Classic pillars. Clean sightlines.',
    hudLabel: 'ARENA // GRID ZERO',
    accent: '#ff3ba7',
    accentSoft: 'rgba(255, 59, 167, 0.32)',
    accentFaint: 'rgba(255, 59, 167, 0.032)',
    signature: 1,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    pillars: [
      { x: 323, y: 179, w: 134, h: 134 },
      { x: 1533, y: 179, w: 134, h: 134 },
      { x: 323, y: 781, w: 134, h: 134 },
      { x: 1533, y: 781, w: 134, h: 134 },
      { x: 931, y: 483, w: 128, h: 128 },
    ],
    spawns: [
      { x: 995, y: 115 },
      { x: 1731, y: 227 },
      { x: 1747, y: 547 },
      { x: 1731, y: 867 },
      { x: 995, y: 979 },
      { x: 259, y: 867 },
      { x: 243, y: 547 },
      { x: 259, y: 227 },
    ],
  },
  {
    id: 2,
    name: 'THE RING',
    tagline: 'Hold the middle or break the wall.',
    hudLabel: 'ARENA // THE RING',
    accent: '#b8ff3a',
    accentSoft: 'rgba(184, 255, 58, 0.3)',
    accentFaint: 'rgba(184, 255, 58, 0.03)',
    signature: 2,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    // A hollow square with a gate at the middle of every side. The narrow side gates
    // are 96px, still more than twice the avatar diameter, so nobody gets wall-stuck.
    pillars: [
      { x: 579, y: 323, w: 352, h: 70 },
      { x: 1059, y: 323, w: 352, h: 70 },
      { x: 579, y: 701, w: 352, h: 70 },
      { x: 1059, y: 701, w: 352, h: 70 },
      { x: 579, y: 394, w: 70, h: 122 },
      { x: 579, y: 611, w: 70, h: 90 },
      { x: 1341, y: 394, w: 70, h: 122 },
      { x: 1341, y: 611, w: 70, h: 90 },
    ],
    spawns: [
      { x: 995, y: 147 },
      { x: 1699, y: 259 },
      { x: 1747, y: 547 },
      { x: 1699, y: 835 },
      { x: 995, y: 947 },
      { x: 291, y: 835 },
      { x: 243, y: 547 },
      { x: 291, y: 259 },
    ],
  },
  {
    id: 3,
    name: 'SWITCHBACK',
    tagline: 'Staggered lanes. Long ricochets.',
    hudLabel: 'ARENA // SWITCHBACK',
    accent: '#ff8a2e',
    accentSoft: 'rgba(255, 138, 46, 0.32)',
    accentFaint: 'rgba(255, 138, 46, 0.034)',
    signature: 3,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    pillars: [
      { x: 451, y: 179, w: 96, h: 384 },
      { x: 803, y: 531, w: 96, h: 384 },
      { x: 1187, y: 179, w: 96, h: 384 },
      { x: 1539, y: 531, w: 96, h: 384 },
    ],
    spawns: [
      { x: 995, y: 115 },
      { x: 1763, y: 195 },
      { x: 1763, y: 547 },
      { x: 1763, y: 931 },
      { x: 995, y: 979 },
      { x: 227, y: 931 },
      { x: 227, y: 547 },
      { x: 227, y: 195 },
    ],
  },
  {
    id: 4,
    name: 'MAINFRAME',
    tagline: 'Four districts. One system.',
    hudLabel: 'ARENA // MAINFRAME',
    accent: '#7bffcf',
    accentSoft: 'rgba(123, 255, 207, 0.32)',
    accentFaint: 'rgba(123, 255, 207, 0.03)',
    signature: 1,
    bounds: { left: 48, top: 48, right: 2512, bottom: 1392 },
    // Four linked combat districts. The camera shows one district at a time, so a fight
    // can move between a cross lane, pillar cover, a gate ring and a ricochet alley.
    pillars: [
      // NORTHWEST: CROSSROADS gates.
      { x: 600, y: 180, w: 80, h: 130 },
      { x: 600, y: 470, w: 80, h: 130 },
      { x: 410, y: 350, w: 130, h: 80 },
      { x: 740, y: 350, w: 130, h: 80 },
      // NORTHEAST: GRID ZERO pillars.
      { x: 1680, y: 160, w: 84, h: 84 },
      { x: 2076, y: 160, w: 84, h: 84 },
      { x: 1680, y: 596, w: 84, h: 84 },
      { x: 2076, y: 596, w: 84, h: 84 },
      { x: 1880, y: 380, w: 80, h: 80 },
      // SOUTHWEST: THE RING, shifted down.
      { x: 380, y: 940, w: 220, h: 44 },
      { x: 680, y: 940, w: 220, h: 44 },
      { x: 380, y: 1176, w: 220, h: 44 },
      { x: 680, y: 1176, w: 220, h: 44 },
      { x: 380, y: 984, w: 44, h: 76 },
      { x: 380, y: 1120, w: 44, h: 56 },
      { x: 856, y: 984, w: 44, h: 76 },
      { x: 856, y: 1120, w: 44, h: 56 },
      // SOUTHEAST: SWITCHBACK bars, shifted down.
      { x: 1640, y: 900, w: 60, h: 240 },
      { x: 1860, y: 1120, w: 60, h: 240 },
      { x: 2100, y: 900, w: 60, h: 240 },
      { x: 2320, y: 1120, w: 60, h: 240 },
      // Central bus spine: splits the four approaches without closing them.
      { x: 1180, y: 600, w: 60, h: 240 },
      { x: 1320, y: 600, w: 60, h: 240 },
    ],
    spawns: [
      { x: 1280, y: 120 },
      { x: 2330, y: 260 },
      { x: 2440, y: 720 },
      { x: 2440, y: 1240 },
      { x: 1280, y: 1320 },
      { x: 230, y: 1240 },
      { x: 120, y: 720 },
      { x: 230, y: 260 },
    ],
  },
  {
    id: 5,
    name: 'TRANSIT',
    tagline: 'Bridge, pad or lift. Pick a lane.',
    hudLabel: 'ARENA // TRANSIT',
    accent: '#5aa8ff',
    accentSoft: 'rgba(90, 168, 255, 0.32)',
    accentFaint: 'rgba(90, 168, 255, 0.03)',
    signature: 3,
    bounds: { left: 48, top: 48, right: 2352, bottom: 1232 },
    // Two decks over a service trench. The trench splits into two blockers with one
    // walkable span left open for the bridge, so the only ground route is the deck.
    pillars: [
      // Upper deck.
      { x: 700, y: 120, w: 120, h: 140 },
      { x: 700, y: 340, w: 120, h: 100 },
      { x: 1450, y: 140, w: 160, h: 130 },
      { x: 2150, y: 150, w: 110, h: 110 },
      // Lower deck.
      { x: 400, y: 1000, w: 120, h: 100 },
      { x: 820, y: 950, w: 130, h: 100 },
      { x: 1450, y: 860, w: 140, h: 110 },
      { x: 1900, y: 1080, w: 150, h: 100 },
    ],
    spawns: [
      { x: 1090, y: 1180 },
      { x: 1600, y: 1180 },
      { x: 2250, y: 1180 },
      { x: 2250, y: 900 },
      { x: 1090, y: 820 },
      { x: 600, y: 1180 },
      { x: 120, y: 1180 },
      { x: 120, y: 820 },
    ],
    traverse: {
      chasms: [
        { x: 48, y: 500, w: 1042, h: 260 },
        { x: 1230, y: 500, w: 1122, h: 260 },
      ],
      bridges: [{ x: 1090, y: 500, w: 140, h: 260 }],
      upperDecks: [{ x: 48, y: 48, w: 2304, h: 452 }],
      // Paired pads on the west end: the fast crossing, with a short materialize lock.
      pads: [
        { x: 330, y: 930, radius: 46, pair: 0 },
        { x: 330, y: 330, radius: 46, pair: 0 },
      ],
      // Lift on the east end: slower than a pad, but it puts you on the deck behind cover.
      lifts: [
        { x: 1980, y: 950, radius: 62, link: 1 },
        { x: 1980, y: 320, radius: 62, link: 0 },
      ],
    },
  },
  {
    id: 6,
    name: 'THE LEDGE',
    tagline: 'No walls. Mind the drop.',
    hudLabel: 'ARENA // THE LEDGE',
    accent: '#c08bff',
    accentSoft: 'rgba(192, 139, 255, 0.32)',
    accentFaint: 'rgba(192, 139, 255, 0.03)',
    signature: 2,
    // Same span as the walled arenas so the camera behaves the same, but nothing stops
    // a body at the edge: the floor ends and the drop does the killing.
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    walls: 'open',
    pillars: [
      { x: 700, y: 330, w: 150, h: 130 },
      { x: 1090, y: 470, w: 160, h: 160 },
      { x: 700, y: 690, w: 150, h: 130 },
      { x: 1380, y: 250, w: 110, h: 190 },
      { x: 1380, y: 760, w: 110, h: 190 },
      { x: 330, y: 520, w: 110, h: 190 },
    ],
    // An inset ring. A spawn at the lip would be a free kill for anyone who arrives first.
    spawns: [
      { x: 995, y: 230 },
      { x: 1560, y: 320 },
      { x: 1760, y: 547 },
      { x: 1560, y: 790 },
      { x: 995, y: 880 },
      { x: 430, y: 790 },
      { x: 230, y: 547 },
      { x: 430, y: 320 },
    ],
  },
];

export function getArena(index: number): ArenaDef {
  const n = ARENAS.length;
  return ARENAS[((index % n) + n) % n];
}

export function arenaIndexById(id: number): number {
  for (let i = 0; i < ARENAS.length; i++) if (ARENAS[i].id === id) return i;
  return 0;
}

/**
 * Everything a body collides with: cover plus the floor gaps of a multi-deck arena.
 * Projectiles keep using `arena.pillars` alone because they fly over a trench.
 * Built once per arena, shared by the world, the guest predictor and bot pathing.
 */
const SOLIDS: (readonly Rect[])[] = [];

export function arenaSolids(arena: ArenaDef): readonly Rect[] {
  let solids = SOLIDS[arena.id];
  if (!solids) {
    const list = arena.pillars.slice();
    if (arena.traverse) {
      for (let i = 0; i < arena.traverse.chasms.length; i++) list.push(arena.traverse.chasms[i]);
    }
    solids = list;
    SOLIDS[arena.id] = solids;
  }
  return solids;
}

/**
 * Miniature arena diagram for the title-screen picker. The canvas is sized by CSS;
 * internal resolution is fixed and drawn at 4x for crisp edges.
 */
export function drawArenaPreview(canvas: HTMLCanvasElement, arena: ArenaDef): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = 240;
  const H = 120;
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#04080e';
  ctx.fillRect(0, 0, W, H);

  const pad = 6;
  const bounds = arena.bounds;
  const sx = (W - pad * 2) / (bounds.right - bounds.left);
  const sy = (H - pad * 2) / (bounds.bottom - bounds.top);
  const mapX = (x: number): number => pad + (x - bounds.left) * sx;
  const mapY = (y: number): number => pad + (y - bounds.top) * sy;

  const previewW = (bounds.right - bounds.left) * sx;
  const previewH = (bounds.bottom - bounds.top) * sy;
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = arena.accent;
  ctx.lineWidth = 1;
  if (arena.walls === 'open') {
    // A broken lip reads as "the floor ends here" even at thumbnail size.
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.setLineDash([]);
  } else {
    ctx.strokeRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
  }
  ctx.globalAlpha = 1;

  // Multi-deck floor: raised deck tint, open trench, deck plate, then the transit plates.
  if (arena.traverse) {
    const tr = arena.traverse;
    ctx.fillStyle = 'rgba(90, 168, 255, 0.16)';
    for (let i = 0; i < tr.upperDecks.length; i++) {
      const r = tr.upperDecks[i];
      ctx.fillRect(mapX(r.x), mapY(r.y), r.w * sx, r.h * sy);
    }
    ctx.fillStyle = '#02050a';
    for (let i = 0; i < tr.chasms.length; i++) {
      const r = tr.chasms[i];
      ctx.fillRect(mapX(r.x), mapY(r.y), r.w * sx, r.h * sy);
    }
    ctx.fillStyle = 'rgba(180, 226, 255, 0.4)';
    for (let i = 0; i < tr.bridges.length; i++) {
      const r = tr.bridges[i];
      ctx.fillRect(mapX(r.x), mapY(r.y), Math.max(1, r.w * sx), r.h * sy);
    }
    ctx.strokeStyle = arena.accent;
    for (let i = 0; i < tr.pads.length; i++) {
      ctx.beginPath();
      ctx.arc(mapX(tr.pads[i].x), mapY(tr.pads[i].y), 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < tr.lifts.length; i++) {
      const px = mapX(tr.lifts[i].x);
      const py = mapY(tr.lifts[i].y);
      ctx.strokeRect(px - 3, py - 3, 6, 6);
    }
  }

  ctx.fillStyle = '#08121d';
  ctx.strokeStyle = arena.accentSoft;
  ctx.lineWidth = 1;
  for (let i = 0; i < arena.pillars.length; i++) {
    const r = arena.pillars[i];
    const x = mapX(r.x);
    const y = mapY(r.y);
    const w = r.w * sx;
    const h = r.h * sy;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  const cx = mapX((bounds.left + bounds.right) * 0.5);
  const cy = mapY((bounds.top + bounds.bottom) * 0.5);
  ctx.strokeStyle = arena.accent;
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  if (arena.signature === 0) {
    ctx.moveTo(cx - 18, cy - 18);
    ctx.lineTo(cx + 18, cy + 18);
    ctx.moveTo(cx + 18, cy - 18);
    ctx.lineTo(cx - 18, cy + 18);
  } else if (arena.signature === 1) {
    ctx.rect(cx - 12, cy - 12, 24, 24);
  } else if (arena.signature === 2) {
    ctx.arc(cx, cy, 19, 0, Math.PI * 2);
    ctx.moveTo(cx + 33, cy);
    ctx.arc(cx, cy, 33, 0, Math.PI * 2);
  } else {
    for (let i = 0; i < 3; i++) {
      const y = cy - 16 + i * 12;
      ctx.moveTo(cx - 22, y);
      ctx.lineTo(cx, y + 9);
      ctx.lineTo(cx + 22, y);
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

