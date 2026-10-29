import { ARENA, type Bounds, type Rect } from './config';

export interface SpawnPoint {
  x: number;
  y: number;
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
}

const perimeterSpawns: SpawnPoint[] = [
  { x: 640, y: 100 },
  { x: 1050, y: 140 },
  { x: 1110, y: 360 },
  { x: 1050, y: 600 },
  { x: 640, y: 620 },
  { x: 230, y: 600 },
  { x: 170, y: 360 },
  { x: 230, y: 140 },
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
    bounds: ARENA,
    pillars: [
      { x: 600, y: 150, w: 80, h: 130 },
      { x: 600, y: 440, w: 80, h: 130 },
      { x: 410, y: 320, w: 130, h: 80 },
      { x: 740, y: 320, w: 130, h: 80 },
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
    bounds: ARENA,
    pillars: [
      { x: 220, y: 130, w: 84, h: 84 },
      { x: 976, y: 130, w: 84, h: 84 },
      { x: 220, y: 506, w: 84, h: 84 },
      { x: 976, y: 506, w: 84, h: 84 },
      { x: 600, y: 320, w: 80, h: 80 },
    ],
    spawns: [
      { x: 640, y: 90 },
      { x: 1100, y: 160 },
      { x: 1110, y: 360 },
      { x: 1100, y: 560 },
      { x: 640, y: 630 },
      { x: 180, y: 560 },
      { x: 170, y: 360 },
      { x: 180, y: 160 },
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
    bounds: ARENA,
    // A hollow square with a gate at the middle of every side. The narrow side gates
    // are 60px, still more than twice the avatar diameter, so nobody gets wall-stuck.
    pillars: [
      { x: 380, y: 220, w: 220, h: 44 },
      { x: 680, y: 220, w: 220, h: 44 },
      { x: 380, y: 456, w: 220, h: 44 },
      { x: 680, y: 456, w: 220, h: 44 },
      { x: 380, y: 264, w: 44, h: 76 },
      { x: 380, y: 400, w: 44, h: 56 },
      { x: 856, y: 264, w: 44, h: 76 },
      { x: 856, y: 400, w: 44, h: 56 },
    ],
    spawns: [
      { x: 640, y: 110 },
      { x: 1080, y: 180 },
      { x: 1110, y: 360 },
      { x: 1080, y: 540 },
      { x: 640, y: 610 },
      { x: 200, y: 540 },
      { x: 170, y: 360 },
      { x: 200, y: 180 },
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
    bounds: ARENA,
    pillars: [
      { x: 300, y: 130, w: 60, h: 240 },
      { x: 520, y: 350, w: 60, h: 240 },
      { x: 760, y: 130, w: 60, h: 240 },
      { x: 980, y: 350, w: 60, h: 240 },
    ],
    spawns: [
      { x: 640, y: 90 },
      { x: 1120, y: 140 },
      { x: 1120, y: 360 },
      { x: 1120, y: 600 },
      { x: 640, y: 630 },
      { x: 160, y: 600 },
      { x: 160, y: 360 },
      { x: 160, y: 140 },
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
      { x: 2330, y: 1240 },
      { x: 1280, y: 1320 },
      { x: 230, y: 1240 },
      { x: 120, y: 720 },
      { x: 230, y: 260 },
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

  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = arena.accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX(bounds.left), mapY(bounds.top), (bounds.right - bounds.left) * sx, (bounds.bottom - bounds.top) * sy);
  ctx.globalAlpha = 1;

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

