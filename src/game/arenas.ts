import { ARENA, type Bounds, type Rect } from './config';
import { PROP } from './types';

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
 * A compaction arm. It warns, then descends from the top edge to `stop` over `travel`
 * seconds, carrying every body it catches down with it and dropping them at the line.
 * It is deliberately slower than a player, so the dodge is to stay ahead of it, slide
 * around it, or dash past. Local content; hosted rooms skip arenas that have one.
 */
export interface ArenaPusherDef {
  /** Full cycle: warn + travel + rest. */
  period: number;
  /** Warning lead-in before the arm starts moving. */
  warn: number;
  /** Seconds the arm takes to travel from the top edge to `stop`. */
  travel: number;
  /** Seconds the arm takes to rise back to the top after a stroke. */
  retract: number;
  /** World y the arm's leading edge stops at. Keep it inside the floor. */
  stop: number;
  /** Depth of the plate, and the band it carries bodies in. */
  thickness: number;
  /** Downward velocity left on a body once the arm lets it go. */
  push: number;
  /** Height of the housing band drawn along the top edge. */
  band: number;
}

/**
 * A wall-mounted laser emitter. It gathers for a beat, then fires a straight beam that
 * stops on cover and can be caught by a raised guard. Local content: hosted rooms leave
 * them idle, because the snapshot carries no emitter state.
 */
export interface ArenaEmitterDef {
  x: number;
  y: number;
  /** 0 points right, PI/2 points down. The beam leaves the lens along this angle. */
  angle: number;
  /** Phase offset in cycles (0..1). Two emitters at 0 and 0.5 alternate. */
  offset?: number;
}

/**
 * One hole cut through a rotating platter. Authored in the platter's own frame, so the
 * hole travels with the disc as it turns. Polar placement keeps the layout readable
 * and keeps the data independent of the platter's radius.
 */
export interface DiscHoleDef {
  /** Angle in the disc's local frame, radians. */
  a: number;
  /** Distance from the spindle, in world units. */
  r: number;
  /** Hole radius. */
  radius: number;
}

/**
 * The read arm. It pivots just outside the platter and sweeps across the face, shoving
 * whatever it catches. It is a floor hazard, not cover: shots pass over it.
 */
export interface DiscArmDef {
  /** Angle of the pivot around the spindle, radians. */
  pivot: number;
  /** Seconds for one full sweep there and back. */
  period: number;
  /** Half the arc the arm sweeps, radians. */
  sweep: number;
  /** Arm thickness, in world units. */
  thickness: number;
  /** Shove velocity left on a body the arm catches. */
  push: number;
  /** Arm length as a fraction of the platter radius, measured from the pivot. */
  reach: number;
}

/**
 * A rotating disc floor. The plate is round: outside it is a drop, and the holes turn
 * with the disc. Local hazard content like the laser emitters, so hosted matches keep
 * the plate and its holes but do not spin it. Never moves into `Snapshot`.
 */
export interface DiscDef {
  /** Platter radius. Bounds should be a square that contains it. */
  radius: number;
  /** Platter rotation, radians per second. */
  spin: number;
  holes: DiscHoleDef[];
  arm: DiscArmDef;
}

/**
 * A breakable file box. Bodies step over it; shots and lashes delete it in one or two
 * hits. Kind is a `PROP` id, which picks the mark on the box.
 */
export interface ArenaPropDef {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: number;
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
  /**
   * Interior holes in the floor. A body whose centre ends over one falls; a dash is
   * airborne, so a short gap can be jumped. Shots fly over them like a trench.
   */
  voids?: Rect[];
  /**
   * Open arena silhouette: the side edges pull in by this many units at the top, so the
   * plate is a trapezoid narrow at the top and full width at the bottom. Outside the
   * slant is the same drop as past the lip; it is not a wall.
   */
  slant?: number;
  /** Timed compactor plate. Absent means the floor is quiet. */
  pushers?: ArenaPusherDef;
  /** Wall-mounted laser emitters. Local content like powerups; no snapshot fields. */
  emitters?: ArenaEmitterDef[];
  /** Breakable file boxes. Local content like powerups; no snapshot fields. */
  props?: ArenaPropDef[];
  /** Multi-deck floor content. Absent means a flat arena. */
  traverse?: ArenaTraversalDef;
  /** A round spinning platter with a read arm. Implies an open drop around the rim. */
  disc?: DiscDef;
}

/** Eight points around the disc, inset far enough that a spawn is never on the lip. */
const discSpawns: SpawnPoint[] = [
  { x: 995, y: 188 },
  { x: 1391, y: 352 },
  { x: 1555, y: 748 },
  { x: 1391, y: 1144 },
  { x: 995, y: 1308 },
  { x: 599, y: 1144 },
  { x: 435, y: 748 },
  { x: 599, y: 352 },
];

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
    // Mounted on the central blocks, firing out along the two cross lanes. The north
    // block's west face and the south block's east face put each beam in open floor.
    emitters: [
      { x: 923, y: 315, angle: Math.PI, offset: 0 },
      { x: 1067, y: 779, angle: 0, offset: 0.5 },
    ],
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
    // Beams down the ring's top and bottom gates. The side gates hold the spawn pair,
    // so firing through them would sweep a player standing on their own spawn; the
    // vertical lane keeps the middle hot without camping either start point.
    emitters: [
      { x: 995, y: 56, angle: Math.PI / 2, offset: 0 },
      { x: 995, y: 1038, angle: -Math.PI / 2, offset: 0.5 },
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
    // One emitter on each side of the central bus, firing down the long mid-map lanes.
    // Boss rooms get a readable crossfire instead of a beam through a spawn point.
    emitters: [
      { x: 1172, y: 664, angle: Math.PI, offset: 0 },
      { x: 1388, y: 776, angle: 0, offset: 0.5 },
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
  {
    id: 7,
    name: 'RECYCLING BIN',
    tagline: 'No walls. One hole. The compactor decides.',
    hudLabel: 'ARENA // RECYCLING BIN',
    accent: '#ffc24d',
    accentSoft: 'rgba(255, 194, 77, 0.32)',
    accentFaint: 'rgba(255, 194, 77, 0.032)',
    signature: 1,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    walls: 'open',
    // The bin is a trapezoid: narrow at the top where the arm comes down, full width at
    // the bottom so the side ledges are the only ground the arm cannot clear.
    slant: 430,
    // The hole is the middle of the bottom edge. It reaches past the lip so the arm has
    // somewhere to push the room into, and the left and right ledges are survival ground.
    voids: [{ x: 695, y: 786, w: 600, h: 262 }],
    // 30 s cycle: 2.6 s warning, a 7.5 s stroke (98 u/s, well under a player's 248) that
    // stops on the hole's leading edge, then a slow 5 s climb back. Stopping at the rim is
    // the point: the plate closes the bin down to the hole and no further.
    // No cover at all, or the arm would pin bodies against it instead of pushing them.
    pushers: { period: 30, warn: 2.6, travel: 7.5, retract: 5, stop: 786, thickness: 130, push: 260, band: 104 },
    pillars: [],
    spawns: [
      { x: 995, y: 300 },
      { x: 1400, y: 360 },
      { x: 1660, y: 560 },
      { x: 1500, y: 760 },
      { x: 995, y: 720 },
      { x: 490, y: 760 },
      { x: 330, y: 560 },
      { x: 590, y: 360 },
    ],
    // Loose file boxes. They are debris, not cover: bodies walk over them, shots stop on
    // them, and two hits delete one. More drop in between compactor strokes.
    props: [
      { x: 855, y: 360, w: 42, h: 30, kind: PROP.VIDEO },
      { x: 1085, y: 380, w: 42, h: 30, kind: PROP.DOC },
      { x: 820, y: 640, w: 42, h: 30, kind: PROP.ZIP },
      { x: 1120, y: 640, w: 42, h: 30, kind: PROP.AUDIO },
      { x: 600, y: 560, w: 42, h: 30, kind: PROP.DOC },
      { x: 1290, y: 560, w: 42, h: 30, kind: PROP.VIDEO },
      { x: 960, y: 300, w: 42, h: 30, kind: PROP.ZIP },
    ],
  },
  {
    id: 8,
    name: 'DISK PLATTER',
    tagline: 'It spins. The arm reads. Mind the gaps.',
    hudLabel: 'ARENA // DISK PLATTER',
    accent: '#cfe3f5',
    accentSoft: 'rgba(207, 227, 245, 0.32)',
    accentFaint: 'rgba(207, 227, 245, 0.03)',
    signature: 2,
    // A square plate for the camera, with the round floor inscribed inside it. The
    // corners are void: the platter is the only ground.
    bounds: { left: 295, top: 48, right: 1695, bottom: 1448 },
    walls: 'open',
    pillars: [],
    spawns: discSpawns,
    disc: {
      radius: 690,
      // A slow platter turn, visible in the tracks and the drifting holes without
      // dragging a body's feet out from under it.
      spin: 0.075,
      // Deliberately irregular spacing: the layout reads as a damaged platter, not a
      // ring of identical portholes. All of it is data, so host and guest agree.
      holes: [
        { a: 0.15, r: 380, radius: 48 },
        { a: 0.95, r: 505, radius: 38 },
        { a: 1.62, r: 300, radius: 56 },
        { a: 2.55, r: 500, radius: 42 },
        { a: 2.95, r: 395, radius: 50 },
        { a: 3.62, r: 520, radius: 38 },
        { a: 4.28, r: 310, radius: 54 },
        { a: 4.96, r: 505, radius: 44 },
        { a: 5.64, r: 385, radius: 52 },
      ],
      // Pivot sits just outside the rim. The arm crosses the spindle at rest and
      // sweeps well past the holes, so it can rake a body toward one.
      arm: { pivot: 0.35, period: 11.5, sweep: 0.55, thickness: 44, push: 360, reach: 1.06 },
    },
  },
];

export function discCenterX(arena: ArenaDef): number {
  return (arena.bounds.left + arena.bounds.right) * 0.5;
}

export function discCenterY(arena: ArenaDef): number {
  return (arena.bounds.top + arena.bounds.bottom) * 0.5;
}

/** World angle of one hole at `discT` seconds into the spin. */
export function discHoleAngle(disc: DiscDef, index: number, discT: number): number {
  return disc.holes[index].a + discT * disc.spin;
}

export function discHoleX(arena: ArenaDef, index: number, discT: number): number {
  return discCenterX(arena) + Math.cos(discHoleAngle(arena.disc!, index, discT)) * arena.disc!.holes[index].r;
}

export function discHoleY(arena: ArenaDef, index: number, discT: number): number {
  return discCenterY(arena) + Math.sin(discHoleAngle(arena.disc!, index, discT)) * arena.disc!.holes[index].r;
}

/** World angle of the read arm. It points at the spindle at rest, then sweeps aside. */
export function discArmAngle(arena: ArenaDef, discT: number): number {
  const arm = arena.disc!.arm;
  return arm.pivot + Math.PI + Math.sin((discT * Math.PI * 2) / arm.period) * arm.sweep;
}

export function discArmPivotX(arena: ArenaDef): number {
  const disc = arena.disc!;
  return discCenterX(arena) + Math.cos(disc.arm.pivot) * (disc.radius + disc.arm.thickness * 0.9);
}

export function discArmPivotY(arena: ArenaDef): number {
  const disc = arena.disc!;
  return discCenterY(arena) + Math.sin(disc.arm.pivot) * (disc.radius + disc.arm.thickness * 0.9);
}

export function discArmLength(arena: ArenaDef): number {
  return arena.disc!.radius * arena.disc!.arm.reach;
}

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

  // A disc arena has no rectangular lip to draw. The plate, its holes and the read
  // arm are the whole floor signature, even at thumbnail size.
  if (arena.disc) {
    const disc = arena.disc;
    const cx = mapX((bounds.left + bounds.right) * 0.5);
    const cy = mapY((bounds.top + bounds.bottom) * 0.5);
    const rr = disc.radius * Math.min(sx, sy);
    ctx.fillStyle = '#08121d';
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#010309';
    const previewPhase = 0.45;
    for (let i = 0; i < disc.holes.length; i++) {
      const a = disc.holes[i].a + previewPhase * disc.spin;
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(a) * disc.holes[i].r * sx,
        cy + Math.sin(a) * disc.holes[i].r * sy,
        Math.max(1.5, disc.holes[i].radius * Math.min(sx, sy)),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    // Arm at rest, pointing across the spindle, at the same phase as the holes.
    const armAngle = discArmAngle(arena, previewPhase);
    const pivotX = mapX(discArmPivotX(arena));
    const pivotY = mapY(discArmPivotY(arena));
    const len = discArmLength(arena) * Math.min(sx, sy);
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX + Math.cos(armAngle) * len, pivotY + Math.sin(armAngle) * len);
    ctx.stroke();
    ctx.fillStyle = arena.accent;
    ctx.fillRect(pivotX - 2, pivotY - 2, 4, 4);
    ctx.fillStyle = '#04080e';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

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

  // Floor holes read as black squares with a lit lip, even at thumbnail size.
  if (arena.voids) {
    ctx.fillStyle = '#010309';
    for (let i = 0; i < arena.voids.length; i++) {
      const r = arena.voids[i];
      ctx.fillRect(mapX(r.x), mapY(r.y), Math.max(2, r.w * sx), Math.max(2, r.h * sy));
    }
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    for (let i = 0; i < arena.voids.length; i++) {
      const r = arena.voids[i];
      ctx.strokeRect(mapX(r.x) + 0.5, mapY(r.y) + 0.5, Math.max(2, r.w * sx) - 1, Math.max(2, r.h * sy) - 1);
    }
    ctx.globalAlpha = 1;
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

  // Emitters are the one arena fixture a player must spot before the fight starts.
  if (arena.emitters) {
    ctx.fillStyle = '#ff5a4c';
    ctx.strokeStyle = '#ff5a4c';
    ctx.lineWidth = 1;
    for (let i = 0; i < arena.emitters.length; i++) {
      const e = arena.emitters[i];
      const ex = mapX(e.x);
      const ey = mapY(e.y);
      ctx.beginPath();
      ctx.arc(ex, ey, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(e.angle) * 7, ey + Math.sin(e.angle) * 7);
      ctx.stroke();
    }
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

