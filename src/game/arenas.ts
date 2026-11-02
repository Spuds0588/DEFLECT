import { ARENA, BROWSER, KEYPAD, SCANNER, type Bounds, type Rect } from './config';
import { PROP } from './types';
import type { RegularMood, RegularProgramId } from './regulars';

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

/** A tutorial room's visual identity. The floor is presentation; walls stay in `pillars`. */
export type ArenaRoomTheme = 'office' | 'holding' | 'board' | 'router' | 'console';

/** Console-room furniture set. Each department reads differently at a glance. */
export type ConsoleRoomVariant = 'flight' | 'dynamics' | 'guidance' | 'systems';

/**
 * One room in a connected tutorial arena. `x,y,w,h` is the room's footprint; a circle
 * uses the smaller of `w` and `h` as its diameter. Rooms only change presentation and
 * labels, never collision: chasms and pillars remain the geometry the sim reads.
 */
export interface ArenaRoomDef {
  shape: 'circle' | 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  theme: ArenaRoomTheme;
  /** Console rooms only: which department's furniture set to draw. Defaults to flight. */
  variant?: ConsoleRoomVariant;
  label: string;
  sub: string;
}

/** Shared geometry for the holding room's three-cell block. The renderer and the
 *  campaign's bar collision both read this, so the painted bars and the solid front
 *  cannot drift apart. */
export interface HoldingCellLayout {
  left: number;
  cellW: number;
  top: number;
  bottom: number;
}

export function holdingCellLayout(room: ArenaRoomDef): HoldingCellLayout {
  // The block takes a little under half the plate, so a scaled-up holding island gets
  // cells a body can move in instead of a shallow painted shelf.
  return {
    left: room.x + 18,
    cellW: (room.w - 36) / 3,
    top: room.y + 16,
    bottom: room.y + Math.round(room.h * 0.46),
  };
}

/** A bridge deck spanning a tutorial chasm. The `traverse` record owns its collision. */
export interface ArenaBridgeDef extends Rect {
  label?: string;
  /**
   * Retracted at the start: the deck is a solid barrier until the level extends it.
   * A bridge without this flag is walkable from the first frame. A retracted deck is
   * still a dash blocker, so it cannot be crossed until it is earned.
   */
  closed?: boolean;
}

/**
 * An enemy replicator, for a device where an open network port would be nonsense: a
 * satellite link, an offline box, anything without a standing connection. It is a
 * machine that prints copies of one threat family onto the floor, and it shares the
 * port's damage and close rules. It releases no bridge and never counts toward a
 * campaign port tally. Authored per arena, local content, never in a snapshot.
 */
export interface ArenaReplicatorDef {
  x: number;
  y: number;
  /** Chassis footprint, a square. */
  size: number;
  /** Hits the machine survives before it stops printing. */
  hp: number;
  /** The one family it copies: 0 sentry, 1 virus, 2 worm. */
  family: number;
  /** Seconds between copies while it is powered. */
  interval: number;
}

/**
 * One enemy ingress port. A red square that leaks square particles and emits threats
 * until it is damaged enough to close. Ports are authored per arena (never rolled), and
 * they are local content: campaign and infection only, never in a snapshot.
 */
export interface ArenaIngressDef {
  x: number;
  y: number;
  /** Side length of the square. */
  size: number;
  /** Hits the port survives before it closes. */
  hp: number;
  /** Threat family it emits: 0 sentry, 1 virus, 2 worm. */
  family: number;
  /** Seconds between emissions while open. */
  interval: number;
  /** Bridge index extended once every port sharing this index has closed. */
  bridge?: number;
}

/** One floating ordinary-program monitor in an arena. Decoration only; no body or collision. */
export interface ArenaRegularDef {
  id: RegularProgramId;
  x: number;
  y: number;
  /** Visual scale, defaults to 1. */
  scale?: number;
  /** Hover-bob phase offset so a row of heads does not move in lockstep. */
  phase?: number;
  /** Files tucked behind the monitor. They drop when the civilian flees or is lost. */
  carry?: number;
  /** Baseline expression for an unnamed civilian; threats override it with fear. */
  mood?: RegularMood;
}

/** The tutorial's final network port. Presentation only; the level script owns the exit. */
export interface ArenaPortDef {
  x: number;
  y: number;
  radius: number;
  label: string;
  sub: string;
}

/** Shared palettes so the arena, preview and renderer tell the same visual story. */
export const ROOM_THEME_COLORS: Record<ArenaRoomTheme, { floor: string; line: string; accent: string; deep: string }> = {
  office: { floor: '#23262d', line: 'rgba(226, 196, 142, 0.16)', accent: '#ffcf6a', deep: '#15171c' },
  holding: { floor: '#1d2027', line: 'rgba(255, 192, 110, 0.15)', accent: '#ffbd66', deep: '#11141a' },
  board: { floor: '#08231d', line: 'rgba(96, 255, 196, 0.15)', accent: '#63ffc4', deep: '#04110e' },
  router: { floor: '#151b27', line: 'rgba(110, 190, 255, 0.16)', accent: '#66c8ff', deep: '#0a0e16' },
  // 1968 mission control: phosphor green on graphite, amber for the live indicator.
  console: { floor: '#0b1a14', line: 'rgba(124, 232, 168, 0.14)', accent: '#8ef0c0', deep: '#04100a' },
};

/**
 * A compaction arm. It warns, then descends from the top edge to `stop` over `travel`
 * seconds, carrying every body it catches down with it and dropping them at the line.
 * It is deliberately slower than a player, so the dodge is to stay ahead of it, slide
 * around it, or dash past. The snapshot carries only its cycle clock; every peer derives
 * the plate position from this record.
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

/** One thumb-drive platform. The drive is a floor plate, not cover. */
export interface UsbDriveDef {
  /** Radial direction from the hub centre, radians. */
  angle: number;
  /** Length along the radial, from the inner edge to the tip. */
  length: number;
  /** Width across the drive. */
  width: number;
}

/**
 * Four retracting floor plates around a round hub. The hub and the plates are the only
 * floor; the gaps between them are a drop. The cycle is deterministic, so the renderer
 * and the world derive the same position from `usbT`; SnapshotHazards carries that clock
 * to guests.
 */
export interface ArenaUsbDef {
  hubRadius: number;
  drives: UsbDriveDef[];
  /** How far a drive's inner edge sits inside the hub while docked. */
  dockOverlap: number;
  /** Radial travel from the docked position to the out position. */
  extension: number;
  holdIn: number;
  extend: number;
  holdOut: number;
  retract: number;
  /** Current speed, units per second, while the plates are moving. */
  flowSpeed: number;
  /** Extra lane width on either side of a drive where the current catches bodies. */
  flowWidth: number;
}

export const USB_STATE = {
  docked: 0,
  extend: 1,
  out: 2,
  retract: 3,
} as const;

export interface UsbFlowVector {
  x: number;
  y: number;
}

/** One dating-app profile shown on the SWIPE RIGHT card stack. */
export interface ArenaSwipeProfileDef {
  emoji: string;
  name: string;
  detail: string;
  color: string;
}

/**
 * SWIPE RIGHT: a tall phone screen whose card stack swipes left and right. Each
 * swipe carries every body toward that wall. The match popup is a real raised
 * platform, so its rect is solid while it is up; one shared pair of clocks drives
 * both the swipe and the popup on every peer.
 */
export interface ArenaSwipeDef {
  profiles: ArenaSwipeProfileDef[];
  /** Seconds between swipe beats. */
  interval: number;
  /** Seconds the card and floor take to slide on each beat. */
  travel: number;
  /** Units every body and live shot is carried toward the wall. */
  shift: number;
  /** Signed horizontal direction for each successive beat. */
  directions: readonly number[];
  /** The match popup's collision footprint while raised. */
  popup: Rect;
  popupPeriod: number;
  /** Warning lead-in before the platform rises. */
  popupWarn: number;
  popupRise: number;
  popupHold: number;
  popupFall: number;
}

/** One solar wing. Its phase offsets the shared heat cycle. */
export interface ArenaSatellitePanelDef extends Rect {
  phase: number;
  label: string;
}

export interface ArenaSatelliteTelescopeDef {
  x: number;
  w: number;
  baseY: number;
  extension: number;
  phase: number;
  extend: number;
  hold: number;
  retract: number;
  rest: number;
}

export interface ArenaSatelliteSolarDef {
  /** Full rest-warn-hot cycle. */
  period: number;
  warn: number;
  hot: number;
  /** Seconds between damage ticks while a body is in a hot panel. */
  tick: number;
  damage: number;
}

export interface ArenaSatelliteMeteorDef {
  first: number;
  interval: number;
  count: number;
  /** Falling warning before the rock lands. */
  warn: number;
  /** Impact flash and collision window after it lands. */
  impact: number;
  radius: number;
  damage: number;
}

export interface ArenaSatelliteReentryDef {
  /** Thruster ignition warning after every capacitor is destroyed. */
  fuse: number;
  /** Seconds for the heat line to travel from the bottom lip to the top. */
  rise: number;
  /** Seconds between burn ticks while the line is live. */
  tick: number;
  damage: number;
  /** Extra burn at the top lip, so a late respawn cannot outlast the front. */
  hold: number;
  /** Cooldown before the arena resets after the burn. */
  reset: number;
}

/**
 * SATELLITE: a central hull with two solar wings on narrow bridges, a telescoping
 * bottom mast, top capacitors and an all-map reentry burn. It is host-authoritative
 * online; SnapshotHazards carries its clocks, live meteors and capacitor state.
 */
export interface ArenaSatelliteDef {
  /** Every walkable plate. Outside these rects is space, not floor. */
  floor: Rect[];
  panels: ArenaSatellitePanelDef[];
  telescope: ArenaSatelliteTelescopeDef;
  solar: ArenaSatelliteSolarDef;
  meteors: ArenaSatelliteMeteorDef;
  reentry: ArenaSatelliteReentryDef;
}

/** One staged separation on a ROCKET NAVIGATION launch. */
export interface ArenaRocketStageDef {
  /** 0..1 arc progress where the stage lets go. */
  at: number;
  label: string;
}

/**
 * ROCKET NAVIGATION: a launch-control floor under a rocket's telemetry display. The
 * arc is a real growing body/shot barrier; the rocket and stage debris are presentation.
 * Local-only because the host owns the growth clock.
 */
export interface ArenaRocketDef {
  /** Start of the trajectory, usually just outside the bottom lip. */
  launch: { x: number; y: number };
  /** Quadratic control point. */
  control: { x: number; y: number };
  /** End of the trajectory, usually just outside the top lip. */
  end: { x: number; y: number };
  /** Seconds from launch to a completed barrier. */
  duration: number;
  /** Number of collision blocks used to approximate the arc. */
  segments: number;
  /** Width of one collision block, in world units. */
  thickness: number;
  stages: ArenaRocketStageDef[];
}

/** One floor-mounted control bank on the WEAPON SYSTEMS status screen. */
export interface ArenaWeaponButtonDef extends Rect {
  label: string;
  /** 0 fire, 1 eject, 2 thrusters. Presentation and preview colour only. */
  kind: 0 | 1 | 2;
}


/**
 * WEAPON SYSTEMS jet silhouette: a side profile traced from real fighter geometry —
 * pointed nose, bubble canopy, swept wing, tail plane, swept vertical fin, intake and
 * exhaust nozzle. Coordinates are normalized: x runs 0 (nose) to 1 (tail), y is a
 * fraction of the jet box height from the centreline, negative upward.
 *
 * The arena and the arena picker both draw from this, so the drawing in the status
 * console and the thumbnail can never drift apart. Do not re-inline a polygon.
 */
export const FIGHTER_SIDE: readonly {
  name: 'wing' | 'stabilizer' | 'intake' | 'missile' | 'fin' | 'fuselage' | 'nozzle' | 'canopy';
  points: readonly (readonly [number, number])[];
  closed: boolean;
}[] = [
  // Far surfaces first, then the fuselage, then the glass and the hot end on top.
  {
    name: 'wing',
    closed: true,
    points: [
      [0.38, 0.026],
      [0.70, 0.126],
      [0.78, 0.132],
      [0.58, 0.036],
    ],
  },
  {
    name: 'stabilizer',
    closed: true,
    points: [
      [0.76, 0.004],
      [0.90, 0.058],
      [0.95, 0.056],
      [0.88, 0.016],
    ],
  },
  {
    name: 'intake',
    closed: true,
    points: [
      [0.38, 0.044],
      [0.42, 0.082],
      [0.52, 0.076],
      [0.54, 0.044],
    ],
  },
  {
    name: 'missile',
    closed: true,
    points: [
      [0.44, 0.06],
      [0.62, 0.108],
      [0.65, 0.1],
      [0.47, 0.054],
    ],
  },
  {
    name: 'fin',
    closed: true,
    points: [
      [0.64, -0.02],
      [0.70, -0.15],
      [0.78, -0.156],
      [0.82, -0.02],
    ],
  },
  {
    name: 'fuselage',
    closed: true,
    points: [
      [0.03, 0.012],
      [0.1, -0.002],
      [0.18, -0.014],
      [0.26, -0.022],
      [0.36, -0.024],
      [0.5, -0.02],
      [0.66, -0.018],
      [0.78, -0.014],
      [0.86, -0.024],
      [0.94, -0.03],
      [0.94, 0.02],
      [0.86, 0.026],
      [0.72, 0.03],
      [0.6, 0.034],
      [0.5, 0.038],
      [0.44, 0.052],
      [0.36, 0.05],
      [0.28, 0.032],
      [0.18, 0.024],
      [0.09, 0.018],
    ],
  },
  {
    name: 'nozzle',
    closed: true,
    points: [
      [0.88, -0.022],
      [0.96, -0.016],
      [0.96, 0.016],
      [0.88, 0.022],
    ],
  },
  {
    name: 'canopy',
    closed: true,
    points: [
      [0.25, -0.024],
      [0.29, -0.062],
      [0.34, -0.068],
      [0.4, -0.04],
      [0.36, -0.03],
      [0.28, -0.028],
    ],
  },
];

/**
 * WEAPON SYSTEMS: a fighter-jet status screen used as a local arena. This is a
 * cockpit display, not a second player kit; the buttons are cover and presentation.
 */
export interface ArenaWeaponDef {
  buttons: ArenaWeaponButtonDef[];
  /** Bounding box for the jet side-view drawing. */
  jet: Rect;
}

/** One spoken picture prompt on the SPEAK & FIND toy. */
export interface ArenaSeekPromptDef {
  text: string;
  /** Index into `ArenaSeekDef.cards`. */
  card: number;
}

/** A picture card printed on the toy's floor. Presentation only; never collision. */
export interface ArenaSeekCardDef extends Rect {
  label: string;
  mark: string;
  color: string;
}

/**
 * SPEAK & FIND: a bright children's talking toy. The prompt, speaker, picture cards
 * and magnifier are local presentation; the chunky letter keys are the static cover.
 */
export interface ArenaSeekDef {
  /** Prompt screen footprint. */
  display: Rect;
  prompts: ArenaSeekPromptDef[];
  cards: ArenaSeekCardDef[];
}

/** One named stop on the CAR NAVIGATION route. */
export interface ArenaCarStopDef {
  /** 0..1 route progress. */
  at: number;
  label: string;
}

/**
 * CAR NAVIGATION: a GPS/map display with a serpentine car route. The travelled
 * portion is a real growing barrier; the car, pins and map furniture are presentation.
 * Local-only because the host owns the route clock.
 */
export interface ArenaCarDef {
  /** Ordered serpentine polyline. The first and last points may sit outside the bounds. */
  route: Point2[];
  /** Seconds from route start to a completed barrier. */
  duration: number;
  /** Collision blocks sampled along the route. */
  segments: number;
  /** Width of one collision block, in world units. */
  thickness: number;
  stops: ArenaCarStopDef[];
}

/**
 * PONG: a CRT-shaped court with two automatic paddles and a live rally ball. The
 * ball is a real local hazard; the cabinet, scanlines and scoreboard are presentation.
 * Local-only because the rally clock and ball are not in Snapshot.
 */
/** One aircraft crossing the scope. It damages whatever body it flies through. */
export interface ArenaRadarPlaneDef {
  /** Data tag on the scope, e.g. 'AAL 112'. */
  tag: string;
  /** Entry bearing from the scope centre, radians. */
  bearing: number;
  /** Travel direction through the scope, radians in world space. */
  heading: number;
  /** Distance from the centre where the pass starts, so it enters off the plate. */
  entry: number;
  /** Distance travelled before the pass ends. */
  run: number;
  speed: number;
  /** Collision radius against bodies, not the drawn silhouette. */
  radius: number;
  /** Seconds between passes of this aircraft. */
  period: number;
  /** Seconds after the level starts before the first pass. */
  delay: number;
  /** 0 inbound, 1 outbound. Presentation only. */
  kind: number;
}

export interface ArenaRadarDef {
  /** Scope centre. The floor is a disc of `radius` around it. */
  cx: number;
  cy: number;
  radius: number;
  /** Seconds per sweep revolution. The sweep is a read, not a hazard. */
  sweepPeriod: number;
  damage: number;
  knockback: number;
  planes: ArenaRadarPlaneDef[];
}

export interface ArenaPongDef {
  /** The playable screen rectangle. The ball bounces inside its top and bottom. */
  court: Rect;
  ballRadius: number;
  paddleW: number;
  paddleH: number;
  /** Horizontal distance from a court side to that paddle's centre. */
  paddleInset: number;
  /** Maximum paddle travel per second while tracking the ball. */
  paddleSpeed: number;
  /** Serve speed, in world units per second. */
  speed: number;
  /** Speed cap after paddle and body returns. */
  maxSpeed: number;
  /** Delay after a point before the next serve. */
  serveDelay: number;
  /** Maximum return angle away from horizontal, radians. */
  bounceAngle: number;
  damage: number;
  enemyDamage: number;
  knockback: number;
}

/** One flight row on the airport split-flap board. Times cycle through the deck. */
export interface ArenaFlipRowDef {
  section: 'ARRIVALS' | 'DEPARTURES';
  times: string[];
  destination: string;
  gate: string;
  status: string;
}

/**
 * AIRPORT: a terminal floor whose arrivals/departures split-flap board is a real
 * hazard. The time tiles flip in a staggered wave and damage bodies standing on them.
 * The flight text and terminal furniture are presentation. Local-only because the
 * flip clock is not in SnapshotHazards.
 */
export interface ArenaFlipDef {
  board: Rect;
  rows: ArenaFlipRowDef[];
  headerH: number;
  rowH: number;
  /** Time tile footprint, starting at the board's left inset. */
  timeW: number;
  timeH: number;
  /** Seconds for one complete time-tile cycle. */
  period: number;
  /** Warning lead-in before the flap lands. */
  warn: number;
  /** Seconds the flap animation runs. */
  flap: number;
  /** Offset between adjacent rows, so the board flips as a wave. */
  stagger: number;
  damage: number;
  enemyDamage: number;
  knockback: number;
  /** Text banks side by side. Two fills a wide floor without giant cells. */
  banks?: number;
  /** Gap between banks, in world units. */
  bankGap?: number;
  /** Destinations every row cycles through. The row's own value is the opening entry. */
  destinations?: string[];
  gates?: string[];
  statuses?: string[];
}

/**
 * SPACE INVADERS: a local arcade floor. Players fight inside the invader formation
 * while a simulated cannon patrols the bottom and fires upward. The fleet is
 * presentation; the cannon, its shots and the bunkers are the local hazard/cover.
 */
export interface ArenaInvadersDef {
  /** Presentation-only formation of invader sprites. */
  fleet: Rect;
  rows: number;
  cols: number;
  cannon: {
    /** Starting centre. The simulated player moves along the bottom. */
    x: number;
    y: number;
    w: number;
    h: number;
    speed: number;
  };
  shotSpeed: number;
  shotRadius: number;
  /** Seconds between shots once the cannon is aligned with a target. */
  fireEvery: number;
  /** Aim-line lead-in before a ready cannon fires. */
  telegraph: number;
  damage: number;
  enemyDamage: number;
  knockback: number;
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
  /** Optional durable container HP; ordinary file boxes use `FILE_PROP.hp`. */
  hp?: number;
  /** A satellite capacitor: solid to its own damage path, never launched as debris. */
  capacitor?: boolean;
  /** Mounted hardware such as the SMOKE DETECTOR battery: never launched or moved. */
  fixed?: boolean;
}

/**
 * A destructible feed pipe. `x,y` is the mouth; the body runs back toward the wall.
 * `pinball` pipes use the arcade feed: a file, a bouncy ball, a virus, then a sentry.
 */
export interface ArenaPipeDef {
  x: number;
  y: number;
  angle: number;
  /** Stagger the first emission in seconds. */
  offset?: number;
  feed?: 'pinball';
}

/**
 * A round arena post. Kind 0 is a passive column that reflects shots and shoves bodies;
 * kind 1 is a lit bumper that launches bodies and speeds shots up. Post geometry is
 * data, while the feel values live in `SPACE_CADET` tuning.
 */
export interface ArenaBumperDef {
  x: number;
  y: number;
  radius: number;
  kind: 0 | 1;
}

/** A floor switch that triggers one firewall sweep, then rearms after a long cooldown. */
export interface ArenaFirewallSwitchDef {
  x: number;
  y: number;
  radius: number;
}

/**
 * One key on the phone-pad floor. The digit is drawn on the cap; the rect is the
 * exact body and projectile footprint while the key is down. `offset` is optional
 * and lets an authored key sit at a different point in the shared cycle.
 */
export interface ArenaKeypadKeyDef extends Rect {
  digit: string;
  offset?: number;
}

/**
 * A ten-key phone pad. Keys warn, slam, hold as solid cover, then rise. The layout is
 * arena data; the timing and crush damage live in `KEYPAD` tuning. A hosted match sends
 * the shared pad clock, so both peers derive the same caps from this record.
 */
export interface ArenaKeypadDef {
  x: number;
  y: number;
  w: number;
  h: number;
  keys: ArenaKeypadKeyDef[];
}

/**
 * A document bed under a read head. Pages load from the slot below the platen,
 * scan top to bottom, snap back, unload, and hand off to the next sheet. The
 * document labels are cosmetic; timing and hazard values live in `SCANNER`.
 * A hosted match sends the scan clock and page; damage stays on the host.
 */
export interface ArenaScannerDef extends Rect {
  documents: string[];
}

/**
 * A fax bed under a thermal print head. The head shuttles left and right across the
 * sheet, pauses at each edge, then returns. The page labels are cosmetic; the timing
 * and hazard values live on this record because the arena is local-only.
 */
export interface ArenaFaxDef extends Rect {
  documents: string[];
  /** Width of the moving head and its hot print bar. */
  headW: number;
  /** Travel speed in world units per second. */
  speed: number;
  /** Park time at each edge before the carriage reverses. */
  pause: number;
  damage: number;
  enemyDamage: number;
  knockback: number;
}

/** One live socket-to-socket circuit on the smart-plug board. */
export interface ArenaPlugArcDef {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/**
 * SMART PLUG: a power-board floor with four socket modules and a circuit ring
 * between them. The modules are static cover; the arcs are floor hazards that
 * follow a green-safe / red-live cycle. Local-only because the clock is not in
 * SnapshotHazards.
 */
export interface ArenaPlugDef {
  /** Socket-to-socket arcs. They are live together during the red phase. */
  arcs: ArenaPlugArcDef[];
  /** Green phase, red warning lead-in, live arc phase, and reset. */
  safe: number;
  warn: number;
  live: number;
  cool: number;
  /** Width of the damaging electric band around each arc's centre line. */
  arcWidth: number;
  damage: number;
  enemyDamage: number;
  knockback: number;
}

/** One smoke sensor pad set into the detector face. */
export interface ArenaSmokeSensorDef {
  x: number;
  y: number;
  radius: number;
}

/**
 * SMOKE DETECTOR: a round detector face with floor smoke sensors and a central
 * alarm siren. Stepping on a sensor arms a timed burst of expanding sound rings;
 * the fixed battery can be shot out to stop the alarm for the rest of the round.
 * Local-only because the alarm clock, waves and battery are not in Snapshot.
 */
export interface ArenaSmokeDef {
  sensors: ArenaSmokeSensorDef[];
  /** Fixed battery target. Bodies can step over it; shots stop on it. */
  battery: Rect;
  batteryHp: number;
  /** Seconds one sensor trigger keeps the siren running. */
  alarmTime: number;
  /** Quiet time after the siren stops before a sensor can arm it again. */
  sensorCooldown: number;
  /** Seconds between expanding sound rings while the siren is live. */
  waveEvery: number;
  waveSpeed: number;
  waveWidth: number;
  /** Rings retire after reaching this radius. */
  maxRadius: number;
  damage: number;
  enemyDamage: number;
  knockback: number;
}

/**
 * SMART WATCH: a large watch face with a live second-hand hazard. The hand sweeps
 * clockwise from twelve, hits each body once per revolution, and the four raised
 * complication cards are static cover. Local-only because the hand clock is not in
 * SnapshotHazards.
 */
export interface ArenaWatchDef {
  /** Screen and hand pivot area. Bounds remain the body/camera footprint. */
  face: Rect;
  handLength: number;
  handWidth: number;
  /** Angular speed in radians per second. */
  speed: number;
  damage: number;
  enemyDamage: number;
  knockback: number;
}

/**
 * One email preview. The layout is world-space cover inside the preview pane, so a
 * message change visibly rewrites the right side of the arena.
 */
export interface ArenaLaptopMessageDef {
  sender: string;
  subject: string;
  preview: string;
  layout: Rect[];
}

/**
 * Which screen the laptop chassis is showing. The variants share one record, one clock and
 * one cover list: mail scrolls an inbox beside a swapping preview, chat scrolls full-width
 * bubbles that alternate sides, sheet is a breakable cell grid.
 */
export type ArenaLaptopVariant = 'mail' | 'sheet' | 'chat';

/** One breakable spreadsheet cell, addressed by its authored grid position. */
export interface ArenaLaptopCellDef {
  col: number;
  row: number;
  /** Direct ranged hits needed to clear the cell. */
  hp: number;
}

/** Cell grid metrics and the intact cells that form the sheet's corridors. */
export interface ArenaLaptopSheetDef {
  origin: { x: number; y: number };
  cellW: number;
  cellH: number;
  /** Corridor width between two neighbouring cells. */
  gap: number;
  cols: number;
  rows: number;
  cells: ArenaLaptopCellDef[];
  /** Seconds the selection cursor holds one column before it steps right. */
  cursorEvery: number;
  /** Column labels for the header row, one per column. */
  columns: string[];
}

/**
 * BUSINESS LAPTOP: a screen chassis whose panes hold moving, solid cover. The inbox cards
 * and the active preview layout are dynamic solid cover; there is no separate hazard clock.
 * Local-only until the moving cover is carried in SnapshotHazards.
 */
export interface ArenaLaptopDef {
  /** Screen flavour. Absent means the mail inbox. */
  variant?: ArenaLaptopVariant;
  /** Visual screen bezel. Bounds remain the body/camera footprint. */
  screen: Rect;
  /** Left inbox (or chat bubble) pane. Cards only; the pane itself is not solid. */
  inbox: Rect;
  /** Right preview pane. Its message layouts are the dynamic cover. */
  preview: Rect;
  cards: number;
  cardH: number;
  cardGap: number;
  /** Upward card speed in world units per second. */
  speed: number;
  /** Seconds each message stays open before the next one replaces it. */
  messageEvery: number;
  messages: ArenaLaptopMessageDef[];
  /** Chat only: bubble width as a fraction of the inbox pane. Sides alternate per card. */
  bubbleW?: number;
  /** Sheet only: the cell grid, its breakable cells and the selection cursor clock. */
  sheet?: ArenaLaptopSheetDef;
}

/** One tab in the browser chrome. Width is data so the strip stays editable. */
export interface ArenaBrowserTabDef {
  label: string;
  w: number;
}

/** One solid forum element on a browser page. */
export interface ArenaBrowserElementDef extends Rect {
  title: string;
}

/** The link the cursor clicks to move deeper into the forum. */
export interface ArenaBrowserLinkDef extends Rect {
  label: string;
}

/** A complete forum page: URL, cover layout and the navigation link. */
export interface ArenaBrowserPageDef {
  title: string;
  url: string;
  elements: ArenaBrowserElementDef[];
  link: ArenaBrowserLinkDef;
}

/**
 * Browser-window presentation and page set. The chrome and scrollbar are ordinary
 * `pillars`; the active page's `elements` are pushed into the collision path as dynamic
 * cover. A hosted match sends the page index and cycle clock; the cursor, phase and
 * click are derived from them on every peer.
 */
export interface ArenaBrowserDef {
  chrome: Rect;
  page: Rect;
  tabs: ArenaBrowserTabDef[];
  activeTab: number;
  pages: ArenaBrowserPageDef[];
  scrollbar: Rect;
}

export const BROWSER_STATE = {
  dwell: 0,
  seek: 1,
  hover: 2,
  slam: 3,
  transition: 4,
} as const;

/** Seconds for one complete read, cursor trip, click and page swap. */
export function browserCycle(): number {
  return BROWSER.dwell + BROWSER.seek + BROWSER.hover + BROWSER.slam + BROWSER.transition;
}

/** Current page phase at `t` seconds into the browser cycle. Allocation-free. */
export function browserPhaseAt(t: number): number {
  const cycle = browserCycle();
  const phase = ((t % cycle) + cycle) % cycle;
  if (phase < BROWSER.dwell) return BROWSER_STATE.dwell;
  if (phase < BROWSER.dwell + BROWSER.seek) return BROWSER_STATE.seek;
  if (phase < BROWSER.dwell + BROWSER.seek + BROWSER.hover) return BROWSER_STATE.hover;
  if (phase < BROWSER.dwell + BROWSER.seek + BROWSER.hover + BROWSER.slam) return BROWSER_STATE.slam;
  return BROWSER_STATE.transition;
}

/** Reused cursor point; callers pass their own scratch to stay allocation-free. */
export interface Point2 {
  x: number;
  y: number;
}

/** Cursor position for a page at `t` seconds into the browser cycle. */
export function browserCursorAt(
  browser: ArenaBrowserDef,
  pageIndex: number,
  t: number,
  out: Point2,
): Point2 {
  const area = browser.page;
  const homeX = area.x + area.w * 0.5;
  const homeY = area.y + area.h * 0.34;
  const pages = browser.pages;
  if (pages.length === 0) {
    out.x = homeX;
    out.y = homeY;
    return out;
  }
  const page = pages[((pageIndex % pages.length) + pages.length) % pages.length];
  const linkX = page.link.x + page.link.w * 0.5;
  const linkY = page.link.y + page.link.h * 0.5;
  const phase = browserPhaseAt(t);
  let x = homeX;
  let y = homeY;
  if (phase === BROWSER_STATE.dwell) {
    x += Math.sin(t * 1.7) * 76;
    y += Math.cos(t * 1.3) * 28;
  } else if (phase === BROWSER_STATE.seek) {
    const k = Math.max(0, Math.min(1, (t - BROWSER.dwell) / Math.max(0.01, BROWSER.seek)));
    const eased = k * k * (3 - 2 * k);
    x = homeX + (linkX - homeX) * eased;
    y = homeY + (linkY - homeY) * eased;
  } else {
    x = linkX;
    y = linkY;
  }
  out.x = x;
  out.y = y;
  return out;
}

/** Remaining click flash at `t` seconds into the browser cycle. */
export function browserClickAt(t: number): number {
  const cycle = browserCycle();
  const local = ((t % cycle) + cycle) % cycle;
  const start = BROWSER.dwell + BROWSER.seek + BROWSER.hover;
  const end = start + BROWSER.slam;
  return local >= start && local < end ? end - local : 0;
}

export const SCANNER_STATE = {
  load: 0,
  warn: 1,
  down: 2,
  up: 3,
  unload: 4,
} as const;

/** Seconds for one full load, scan, return and unload cycle. */
export function scannerCycle(): number {
  return SCANNER.load + SCANNER.warn + SCANNER.down + SCANNER.up + SCANNER.unload;
}

/** Current page phase at `t` seconds into the scanner cycle. Allocation-free. */
export function scannerPhaseAt(t: number): number {
  const cycle = scannerCycle();
  const phase = ((t % cycle) + cycle) % cycle;
  if (phase < SCANNER.load) return SCANNER_STATE.load;
  if (phase < SCANNER.load + SCANNER.warn) return SCANNER_STATE.warn;
  if (phase < SCANNER.load + SCANNER.warn + SCANNER.down) return SCANNER_STATE.down;
  if (phase < SCANNER.load + SCANNER.warn + SCANNER.down + SCANNER.up) return SCANNER_STATE.up;
  return SCANNER_STATE.unload;
}

/** World y of the live read line, or -1 while the head is parked or swapping. */
export function scannerLaserY(scanner: ArenaScannerDef, t: number): number {
  const cycle = scannerCycle();
  const phase = ((t % cycle) + cycle) % cycle;
  const downStart = SCANNER.load + SCANNER.warn;
  if (phase < downStart) return -1;
  if (phase < downStart + SCANNER.down) {
    return scanner.y + scanner.h * ((phase - downStart) / SCANNER.down);
  }
  const upStart = downStart + SCANNER.down;
  if (phase < upStart + SCANNER.up) {
    return scanner.y + scanner.h * (1 - (phase - upStart) / SCANNER.up);
  }
  return -1;
}

export const FAX_STATE = {
  readyLeft: 0,
  printRight: 1,
  readyRight: 2,
  printLeft: 3,
} as const;

/** Seconds to cross the whole sheet at the current carriage speed. */
export function faxTravelTime(fax: ArenaFaxDef): number {
  return Math.max(0.001, (fax.w - fax.headW) / Math.max(1, fax.speed));
}

/** Seconds for one parked edge, one crossing, the other edge and the return. */
export function faxCycle(fax: ArenaFaxDef): number {
  return (faxTravelTime(fax) + Math.max(0, fax.pause)) * 2;
}

/** Current print-head phase at `t` seconds into the fax cycle. Allocation-free. */
export function faxPhaseAt(fax: ArenaFaxDef, t: number): number {
  const travel = faxTravelTime(fax);
  const pause = Math.max(0, fax.pause);
  const cycle = (travel + pause) * 2;
  const phase = ((t % cycle) + cycle) % cycle;
  if (phase < pause) return FAX_STATE.readyLeft;
  if (phase < pause + travel) return FAX_STATE.printRight;
  if (phase < pause * 2 + travel) return FAX_STATE.readyRight;
  return FAX_STATE.printLeft;
}

/** World x of the print head. Parked at an edge, it stays there for `pause`. */
export function faxHeadX(fax: ArenaFaxDef, t: number): number {
  const travel = faxTravelTime(fax);
  const pause = Math.max(0, fax.pause);
  const cycle = (travel + pause) * 2;
  const phase = ((t % cycle) + cycle) % cycle;
  const left = fax.x + fax.headW * 0.5;
  const right = fax.x + fax.w - fax.headW * 0.5;
  if (phase < pause) return left;
  if (phase < pause + travel) return left + (right - left) * ((phase - pause) / travel);
  if (phase < pause * 2 + travel) return right;
  return right - (right - left) * ((phase - pause * 2 - travel) / travel);
}

export const PLUG_STATE = {
  safe: 0,
  warn: 1,
  live: 2,
  cool: 3,
} as const;

/** Seconds for one full green, warning, live and reset cycle. */
export function plugCycle(plug: ArenaPlugDef): number {
  return Math.max(0.001, plug.safe + plug.warn + plug.live + plug.cool);
}

/** Current green/red circuit phase at `t` seconds into the plug cycle. */
export function plugPhaseAt(plug: ArenaPlugDef, t: number): number {
  const cycle = plugCycle(plug);
  const phase = ((t % cycle) + cycle) % cycle;
  if (phase < Math.max(0, plug.safe)) return PLUG_STATE.safe;
  if (phase < plug.safe + Math.max(0, plug.warn)) return PLUG_STATE.warn;
  if (phase < plug.safe + plug.warn + Math.max(0, plug.live)) return PLUG_STATE.live;
  return PLUG_STATE.cool;
}

/** World angle of the SMART WATCH second hand at `t` seconds. Starts at twelve. */
export function watchHandAngle(watch: ArenaWatchDef, t: number): number {
  return -Math.PI * 0.5 + t * watch.speed;
}

/** Top edge of inbox card `i` at `t` seconds. Cards scroll upward and wrap. */
export function laptopCardY(laptop: ArenaLaptopDef, i: number, t: number): number {
  const step = Math.max(1, laptop.cardH + laptop.cardGap);
  const span = step * Math.max(1, laptop.cards);
  const scroll = ((t * laptop.speed) % span + span) % span;
  return laptop.inbox.y + laptop.inbox.h - laptop.cardH - i * step - scroll;
}

/** World rect of one authored sheet cell. `out` is reused to avoid per-frame allocation. */
export function laptopCellRect(sheet: ArenaLaptopSheetDef, cell: ArenaLaptopCellDef, out: Rect): Rect {
  out.x = sheet.origin.x + cell.col * (sheet.cellW + sheet.gap);
  out.y = sheet.origin.y + cell.row * (sheet.cellH + sheet.gap);
  out.w = sheet.cellW;
  out.h = sheet.cellH;
  return out;
}

export const KEYPAD_STATE = {
  up: 0,
  warn: 1,
  slam: 2,
  down: 3,
  rise: 4,
} as const;

/**
 * An arena is pure geometry + presentation. Collision, spawns, prediction, rendering and
 * the host snapshot all read this one definition so a guest can never simulate a different map.
 */
export interface ArenaDef {
  /** QA sandbox: hidden from the arena picker and only reachable by an explicit hook. */
  qa?: boolean;
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
  /** Destructible feed pipes. Local content; hosted rooms skip this arena. */
  pipes?: ArenaPipeDef[];
  /** Round posts and pinball bumpers. Local content; hosted rooms skip this arena. */
  bumpers?: ArenaBumperDef[];
  /** One-shot firewall starter. Local content; hosted rooms skip this arena. */
  firewallSwitch?: ArenaFirewallSwitchDef;
  /** Ten-key floor. Local content; hosted rooms skip this arena. */
  keypad?: ArenaKeypadDef;
  /** Document scanner floor. Local content; hosted rooms skip this arena. */
  scanner?: ArenaScannerDef;
  /** Fax machine page and moving thermal print head. Local-only. */
  fax?: ArenaFaxDef;
  /** SMART PLUG socket modules and their green/red circuit ring. Local-only. */
  plug?: ArenaPlugDef;
  /** SMOKE DETECTOR sensors, siren waves and destructible battery. Local-only. */
  smoke?: ArenaSmokeDef;
  /** SMART WATCH face and sweeping second hand. Local-only. */
  watch?: ArenaWatchDef;
  /** BUSINESS LAPTOP email inbox and changing preview cover. Local-only. */
  laptop?: ArenaLaptopDef;
  /** Browser-window presentation. Its solid pieces are listed in `pillars`. */
  browser?: ArenaBrowserDef;
  /** Four retracting USB-drive floor plates. The shared phase travels in SnapshotHazards. */
  usb?: ArenaUsbDef;
  /** Swipe-card phone floor and its match-popup platform. */
  swipe?: ArenaSwipeDef;
  /** Satellite hull, solar wings, telescope and reentry hazard. Online-safe under D45. */
  satellite?: ArenaSatelliteDef;
  /** ROCKET NAVIGATION launch display and growing trajectory barrier. Local-only. */
  rocket?: ArenaRocketDef;
  /** WEAPON SYSTEMS fighter-jet status console. Local-only presentation. */
  weapon?: ArenaWeaponDef;
  /** SPEAK & FIND children's toy floor. Local-only presentation. */
  seek?: ArenaSeekDef;
  /** CAR NAVIGATION map and growing serpentine route barrier. Local-only. */
  car?: ArenaCarDef;
  /** PONG court and live rally ball. Local-only. */
  pong?: ArenaPongDef;
  /** Air traffic control scope: circular floor, slow sweep, aircraft as hazards. */
  radar?: ArenaRadarDef;
  /** AIRPORT split-flap board and its flipping time tiles. Local-only. */
  flip?: ArenaFlipDef;
  /** SPACE INVADERS simulated cannon and invader formation. Local-only. */
  invaders?: ArenaInvadersDef;
  /**
   * Separate floor plates. When present the plates are the only walkable floor: the space
   * between them is a real drop, so a body carried over an edge falls and de-rezzes.
   * Bridges are the crossings, and a `closed` bridge is a barrier until it extends.
   */
  islands?: readonly Rect[];
  /** Enemy ingress ports for campaign and infection. Local content; out of Snapshot. */
  ingress?: readonly ArenaIngressDef[];
  /** Enemy replicators for devices where an open port would not make sense. Local-only. */
  replicator?: readonly ArenaReplicatorDef[];
  /** Multi-deck floor content. Absent means a flat arena. */
  traverse?: ArenaTraversalDef;
  /** Tutorial room floors and labels. Presentation only; never collision. */
  rooms?: readonly ArenaRoomDef[];
  /** Tutorial bridge decks. The matching `traverse.bridges` entries are the walkable spans. */
  bridges?: readonly ArenaBridgeDef[];
  /** The tutorial's outbound port, drawn on the final room's wall. */
  port?: ArenaPortDef;
  /** Ordinary program carts. Presentation only; no bodies, collision or snapshot data. */
  regulars?: readonly ArenaRegularDef[];
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

const browserChrome: Rect = { x: 48, y: 48, w: 1846, h: 136 };
const browserPage: Rect = { x: 56, y: 192, w: 1830, h: 846 };
const browserScrollbar: Rect = { x: 1840, y: 200, w: 26, h: 800 };
const browserTabs: ArenaBrowserTabDef[] = [
  { label: 'INBOX (3)', w: 300 },
  { label: 'Q4 REVIEW', w: 300 },
  { label: 'BOARD MINUTES', w: 300 },
  { label: '+ NEW TAB', w: 240 },
];
const usbSpawns: SpawnPoint[] = [
  { x: 998, y: 808 },
  { x: 1132, y: 864 },
  { x: 1192, y: 998 },
  { x: 1132, y: 1132 },
  { x: 998, y: 1188 },
  { x: 864, y: 1132 },
  { x: 804, y: 998 },
  { x: 864, y: 864 },
];

// The three cockpit banks are both the visible controls and the arena's cover.
const weaponButtons: ArenaWeaponButtonDef[] = [
  { x: 1190, y: 214, w: 280, h: 132, label: 'FIRE WEAPONS', kind: 0 },
  { x: 1190, y: 420, w: 280, h: 132, label: 'EJECTOR SEAT', kind: 1 },
  { x: 1190, y: 626, w: 280, h: 132, label: 'THRUSTERS', kind: 2 },
];

// A serpentine GPS route. It crosses the arena once, so the finished wall divides the
// floor into a north and south half rather than fencing off a pocket.
const carRoute: Point2[] = [
  { x: 30, y: 880 },
  { x: 250, y: 940 },
  { x: 450, y: 800 },
  { x: 650, y: 740 },
  { x: 850, y: 860 },
  { x: 1050, y: 820 },
  { x: 1250, y: 660 },
  { x: 1450, y: 700 },
  { x: 1650, y: 520 },
  { x: 1830, y: 440 },
];

const seekCards: ArenaSeekCardDef[] = [
  { x: 410, y: 304, w: 240, h: 170, label: 'BOAT', mark: '🚤', color: '#4cc9f0' },
  { x: 770, y: 304, w: 240, h: 170, label: 'MOON', mark: '🌙', color: '#ffd166' },
  { x: 1130, y: 304, w: 240, h: 170, label: 'FROG', mark: '🐸', color: '#7bd88f' },
  { x: 410, y: 574, w: 240, h: 170, label: 'STAR', mark: '⭐', color: '#ffb86b' },
  { x: 770, y: 574, w: 240, h: 170, label: 'FISH', mark: '🐟', color: '#7ee0ff' },
  { x: 1130, y: 574, w: 240, h: 170, label: 'APPLE', mark: '🍎', color: '#ff6b73' },
];

const browserPages: ArenaBrowserPageDef[] = [
  {
    title: 'FORUM / INDEX',
    url: 'https://localhost/forum',
    elements: [
      { x: 180, y: 250, w: 420, h: 180, title: 'STICKY: READ THE RULES' },
      { x: 700, y: 250, w: 380, h: 160, title: 'THREAD: Q4 REVIEW' },
      { x: 1180, y: 270, w: 360, h: 180, title: 'THREAD: OFF-SITE' },
      { x: 700, y: 500, w: 380, h: 150, title: 'THREAD: BOARD MINUTES' },
    ],
    link: { x: 760, y: 800, w: 330, h: 70, label: 'OPEN THREAD' },
  },
  {
    title: 'FORUM / THREAD 404',
    url: 'https://localhost/forum/thread/404',
    elements: [
      { x: 210, y: 250, w: 360, h: 230, title: 'OP: ANON' },
      { x: 650, y: 260, w: 300, h: 160, title: 'REPLY 1' },
      { x: 1020, y: 250, w: 360, h: 230, title: 'REPLY 2' },
      { x: 650, y: 520, w: 300, h: 150, title: 'QUOTED POST' },
    ],
    link: { x: 820, y: 800, w: 280, h: 70, label: 'NEXT POST' },
  },
  {
    title: 'FORUM / POST 7',
    url: 'https://localhost/forum/thread/404?post=7',
    elements: [
      { x: 240, y: 300, w: 300, h: 180, title: 'ATTACHMENT' },
      { x: 650, y: 250, w: 340, h: 200, title: 'DELETED POST' },
      { x: 1080, y: 250, w: 340, h: 200, title: 'MOD NOTE' },
      { x: 650, y: 520, w: 340, h: 150, title: 'QUOTE CHAIN' },
    ],
    link: { x: 800, y: 800, w: 310, h: 70, label: 'VIEW NEXT' },
  },
  {
    title: 'FORUM / LOCKED',
    url: 'https://localhost/forum/thread/404?locked',
    elements: [
      { x: 250, y: 260, w: 380, h: 220, title: 'THREAD LOCKED' },
      { x: 760, y: 250, w: 340, h: 200, title: 'ARCHIVED' },
      { x: 1220, y: 280, w: 300, h: 200, title: 'REDACTED' },
    ],
    link: { x: 790, y: 800, w: 320, h: 70, label: 'RETURN TO INDEX' },
  },
];

/** Eighteen flights: nine arrivals in the left bank, nine departures in the right. */
function airportFlights(): ArenaFlipRowDef[] {
  const destinations = [
    'OSAKA', 'LISBON', 'NAIROBI', 'REYKJAVIK', 'SINGAPORE', 'SANTIAGO',
    'HELSINKI', 'MARRAKESH', 'AUCKLAND', 'MONTREAL', 'DOHA', 'PRAGUE',
    'HANOI', 'LAGOS', 'OSLO', 'CUSCO', 'TAIPEI', 'DENVER',
  ];
  const gates = ['A12', 'B04', 'C07', 'D02', 'E11', 'F08', 'G03', 'H09', 'A21', 'C14', 'B17', 'D06', 'E02', 'F12', 'G08', 'H04', 'B22', 'C19'];
  const statuses = ['ON TIME', 'BOARDING', 'DELAYED', 'GATE OPEN', 'FINAL CALL', 'ON TIME'];
  const times = ['09:10', '10:45', '11:20', '12:10', '13:05', '13:40', '14:15', '15:02', '15:38', '16:11', '16:47', '17:20', '17:55', '18:31', '19:04', '19:42', '20:15', '20:58'];
  return destinations.map((destination, i) => ({
    section: i < 9 ? 'ARRIVALS' : 'DEPARTURES',
    times: [times[i], times[(i + 3) % times.length], times[(i + 7) % times.length]],
    destination,
    gate: gates[i],
    status: statuses[i % statuses.length],
  }));
}

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
  {
    id: 9,
    name: 'NETWORK SWITCH',
    tagline: 'The pipes feed the fight. Cut them.',
    hudLabel: 'ARENA // NETWORK SWITCH',
    accent: '#6dffb0',
    accentSoft: 'rgba(109, 255, 176, 0.32)',
    accentFaint: 'rgba(109, 255, 176, 0.032)',
    signature: 3,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    // A rectangular switchboard with a central chip block and four cable lanes.
    pillars: [
      { x: 790, y: 360, w: 120, h: 96 },
      { x: 1090, y: 360, w: 120, h: 96 },
      { x: 790, y: 590, w: 120, h: 96 },
      { x: 1090, y: 590, w: 120, h: 96 },
      { x: 940, y: 290, w: 120, h: 80 },
      { x: 940, y: 676, w: 120, h: 80 },
    ],
    spawns: [
      { x: 995, y: 130 },
      { x: 1700, y: 240 },
      { x: 1760, y: 547 },
      { x: 1700, y: 854 },
      { x: 995, y: 964 },
      { x: 290, y: 854 },
      { x: 230, y: 547 },
      { x: 290, y: 240 },
    ],
    // Four feed mouths, two from each long wall, aimed into the switchboard. Their
    // bodies sit behind the mouth so the pipe reads as mounted through the frame.
    pipes: [
      { x: 420, y: 150, angle: 0.9, offset: 1.2 },
      { x: 1570, y: 150, angle: 2.25, offset: 5.4 },
      { x: 420, y: 944, angle: -0.9, offset: 9.6 },
      { x: 1570, y: 944, angle: -2.25, offset: 13.8 },
    ],
    // At the west end, off the spawn ring. One manual sweep, then a three-minute rearm.
    firewallSwitch: { x: 155, y: 547, radius: 46 },
  },
  {
    id: 10,
    name: 'SPACE CADET',
    tagline: 'Bumpers, posts and a hungry drain.',
    hudLabel: 'ARENA // SPACE CADET',
    accent: '#b79bff',
    accentSoft: 'rgba(183, 155, 255, 0.32)',
    accentFaint: 'rgba(183, 155, 255, 0.032)',
    signature: 2,
    // A cabinet, not a room: tall, narrow and read top-to-bottom like a pinball table.
    bounds: { left: 240, top: 40, right: 1040, bottom: 1720 },
    pillars: [],
    // Passive posts first, then the lit kickers above the drain. The three kickers face
    // into the open lane, so a body that crosses the lower third gets thrown back up.
    bumpers: [
      { x: 640, y: 430, radius: 54, kind: 0 },
      { x: 410, y: 720, radius: 42, kind: 0 },
      { x: 870, y: 760, radius: 42, kind: 0 },
      { x: 640, y: 1040, radius: 62, kind: 1 },
      { x: 400, y: 1100, radius: 50, kind: 1 },
      { x: 880, y: 1100, radius: 50, kind: 1 },
    ],
    // The drain sits below the kickers. It reaches the bottom lip, so a body carried
    // down the cabinet has nowhere to stand once it crosses the rim.
    voids: [{ x: 390, y: 1450, w: 500, h: 270 }],
    // The right-side feed runs down the cabinet wall and points left into the bumpers.
    pipes: [{ x: 1000, y: 600, angle: Math.PI, offset: 0.8, feed: 'pinball' }],
    spawns: [
      { x: 640, y: 140 },
      { x: 920, y: 300 },
      { x: 920, y: 900 },
      { x: 900, y: 1360 },
      { x: 320, y: 1360 },
      { x: 320, y: 900 },
      { x: 320, y: 300 },
      { x: 520, y: 540 },
    ],
  },
  {
    id: 11,
    name: 'KEYPAD',
    tagline: 'Ten keys. Mind the press.',
    hudLabel: 'ARENA // KEYPAD',
    accent: '#ffcf5c',
    accentSoft: 'rgba(255, 207, 92, 0.32)',
    accentFaint: 'rgba(255, 207, 92, 0.032)',
    signature: 1,
    // The keypad is the whole arena. Bounds equal the housing edge-to-edge; there is
    // no exterior floor, room or spawn gutter. Spawns stand on the pad's own bezel.
    bounds: { left: 48, top: 48, right: 2448, bottom: 2688 },
    pillars: [],
    // Portrait housing, with a slightly wide bottom key for the 0. The caps fill almost
    // the entire housing: one key fills most of the screen at normal camera zoom.
    keypad: {
      x: 48,
      y: 48,
      w: 2400,
      h: 2640,
      keys: [
        { digit: '1', x: 168, y: 222, w: 680, h: 528 },
        { digit: '2', x: 908, y: 222, w: 680, h: 528 },
        { digit: '3', x: 1648, y: 222, w: 680, h: 528 },
        { digit: '4', x: 168, y: 810, w: 680, h: 528 },
        { digit: '5', x: 908, y: 810, w: 680, h: 528 },
        { digit: '6', x: 1648, y: 810, w: 680, h: 528 },
        { digit: '7', x: 168, y: 1398, w: 680, h: 528 },
        { digit: '8', x: 908, y: 1398, w: 680, h: 528 },
        { digit: '9', x: 1648, y: 1398, w: 680, h: 528 },
        { digit: '0', x: 168, y: 1986, w: 2160, h: 528 },
      ],
    },
    spawns: [
      { x: 720, y: 118 },
      { x: 1680, y: 118 },
      { x: 2378, y: 928 },
      { x: 2378, y: 1808 },
      { x: 1680, y: 2618 },
      { x: 720, y: 2618 },
      { x: 118, y: 1808 },
      { x: 118, y: 928 },
    ],
  },
  {
    id: 12,
    name: 'DOCUMENT SCANNER',
    tagline: 'Read fast. Redact faster.',
    hudLabel: 'ARENA // DOCUMENT SCANNER',
    accent: '#d8e6ff',
    accentSoft: 'rgba(216, 230, 255, 0.32)',
    accentFaint: 'rgba(216, 230, 255, 0.032)',
    signature: 1,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    // Filing stacks frame the bed. They are ordinary cover, deliberately outside
    // the platen so the scan line remains a clean horizontal read.
    pillars: [
      { x: 150, y: 180, w: 110, h: 140 },
      { x: 1634, y: 180, w: 110, h: 140 },
      { x: 150, y: 726, w: 110, h: 140 },
      { x: 1634, y: 726, w: 110, h: 140 },
    ],
    // The page is the arena's centerpiece. The head starts at the top edge, reads
    // down, snaps back, then the sheet drops out and the next one rises in.
    scanner: {
      x: 320,
      y: 120,
      w: 1254,
      h: 758,
      documents: [
        'Q4 SYNERGY REVIEW',
        'BOARD MEMO 7B',
        'INCIDENT REPORT // REDACTED',
        'ACQUISITION TERMS',
        'COMPLIANCE AUDIT // DRAFT',
        'OFFSITE CONTINGENCY',
      ],
    },
    // Spawns sit outside the platen and clear of the filing stacks. The scan line
    // starts on its warning beat, so the opening spawn is never a free hit.
    spawns: [
      { x: 995, y: 90 },
      { x: 1780, y: 190 },
      { x: 1780, y: 547 },
      { x: 1780, y: 900 },
      { x: 995, y: 990 },
      { x: 280, y: 900 },
      { x: 280, y: 547 },
      { x: 280, y: 190 },
    ],
  },
  {
    id: 13,
    name: 'BROWSER',
    tagline: 'Forum pages, cover and one giant cursor.',
    hudLabel: 'ARENA // BROWSER',
    accent: '#59d8ff',
    accentSoft: 'rgba(89, 216, 255, 0.32)',
    accentFaint: 'rgba(89, 216, 255, 0.032)',
    signature: 1,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    // The chrome and scrollbar are ordinary static pillars. Each forum page's cards
    // are dynamic cover: the World swaps them when the cursor navigates, and the guest
    // rebuilds the same cards from the page index in Snapshot.
    pillars: [browserChrome, browserScrollbar],
    browser: {
      chrome: browserChrome,
      page: browserPage,
      tabs: browserTabs,
      activeTab: 1,
      pages: browserPages,
      scrollbar: browserScrollbar,
    },
    // Perimeter starts, outside the chrome and clear of every card.
    spawns: [
      { x: 995, y: 220 },
      { x: 1760, y: 230 },
      { x: 1780, y: 600 },
      { x: 1680, y: 930 },
      { x: 995, y: 970 },
      { x: 190, y: 930 },
      { x: 170, y: 560 },
      { x: 300, y: 225 },
    ],
  },
  {
    id: 14,
    name: 'QUARANTINE',
    tagline: 'Intake, holding, mainboard, uplink. Four islands. One way out.',
    hudLabel: 'ARENA // QUARANTINE',
    accent: '#ffcf6a',
    accentSoft: 'rgba(255, 207, 106, 0.32)',
    accentFaint: 'rgba(255, 207, 106, 0.032)',
    signature: 0,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    // Four separate plates, one room each. Cover is furniture first: intake desks, the
    // holding desk pair either side of the bridge aisle, board component banks and the
    // router's port banks. Nothing crosses a gap except the three bridge decks.
    pillars: [
      { x: 130, y: 130, w: 150, h: 56 },
      { x: 430, y: 130, w: 150, h: 56 },
      { x: 130, y: 320, w: 150, h: 56 },
      { x: 430, y: 320, w: 150, h: 56 },
      { x: 120, y: 900, w: 150, h: 54 },
      { x: 590, y: 900, w: 150, h: 54 },
      { x: 1160, y: 720, w: 110, h: 76 },
      { x: 1420, y: 780, w: 100, h: 70 },
      { x: 1700, y: 710, w: 120, h: 80 },
      { x: 1400, y: 930, w: 120, h: 60 },
      { x: 1160, y: 120, w: 110, h: 70 },
      { x: 1460, y: 130, w: 110, h: 66 },
      { x: 1160, y: 330, w: 120, h: 60 },
      { x: 1720, y: 320, w: 100, h: 60 },
    ],
    // All eight sit on the intake plate, clear of the desks. Spawn 6 is the campaign's
    // opening slot: the Warden lesson runs here before the first bridge crossing.
    spawns: [
      { x: 300, y: 240 },
      { x: 180, y: 200 },
      { x: 420, y: 200 },
      { x: 240, y: 250 },
      { x: 360, y: 250 },
      { x: 180, y: 400 },
      { x: 300, y: 400 },
      { x: 420, y: 400 },
    ],
    rooms: [
      {
        shape: 'rect',
        x: 48,
        y: 48,
        w: 810,
        h: 396,
        theme: 'office',
        label: 'INTAKE 01',
        sub: 'BOOKING // ORIENTATION',
      },
      {
        shape: 'rect',
        x: 48,
        y: 664,
        w: 810,
        h: 382,
        theme: 'holding',
        label: 'HOLDING 02',
        sub: 'CELL BLOCK // CONTAINMENT',
      },
      {
        shape: 'rect',
        x: 1084,
        y: 664,
        w: 858,
        h: 382,
        theme: 'board',
        label: 'MAINBOARD 03',
        sub: 'BUS 02 // DATA PLANE',
      },
      {
        shape: 'rect',
        x: 1084,
        y: 48,
        w: 858,
        h: 396,
        theme: 'router',
        label: 'ROUTER 04',
        sub: 'PORT 03 // UPLINK',
      },
    ],
    // A is the way in from intake. B starts retracted until the cell block is cleared,
    // and C stays shut until every port on the mainboard is closed.
    bridges: [
      { x: 330, y: 444, w: 150, h: 220, label: 'A' },
      { x: 858, y: 800, w: 226, h: 140, label: 'B', closed: true },
      { x: 1720, y: 444, w: 150, h: 220, label: 'C', closed: true },
    ],
    // Four plates over open void. There is no shared floor underneath: walking off an
    // island is a drop, and the bridge decks are the only crossings. The gaps are wider
    // than a dash, so a retracted deck cannot be skipped.
    islands: [
      { x: 48, y: 48, w: 810, h: 396 },
      { x: 48, y: 664, w: 810, h: 382 },
      { x: 1084, y: 664, w: 858, h: 382 },
      { x: 1084, y: 48, w: 858, h: 396 },
    ],
    // Two open ports on the mainboard and one on the router. The mainboard pair extends
    // bridge C; closing all three opens the white exit port on the router uplink. Every
    // damaging action closes one, so the health is set to survive a couple of engages
    // while the cadence keeps the plate busy: a port that is ignored refills the floor.
    ingress: [
      { x: 1240, y: 780, size: 78, hp: 20, family: 0, interval: 2.6, bridge: 2 },
      { x: 1780, y: 940, size: 78, hp: 20, family: 1, interval: 3, bridge: 2 },
      { x: 1250, y: 160, size: 78, hp: 26, family: 0, interval: 2.8 },
    ],
    port: {
      x: 1886,
      y: 210,
      radius: 38,
      label: 'NETWORK PORT',
      sub: 'WWW // OUTBOUND',
    },
    // Three civilians work the holding office. They are painted in the arena pass; the
    // campaign script hides them after the calibration class wakes. No bodies, no hits.
    regulars: [
      { id: 'ticket', x: 200, y: 820, scale: 0.82, phase: 0.4, carry: 1 },
      { id: 'patch', x: 660, y: 820, scale: 0.82, phase: 2.1 },
      { id: 'cache', x: 430, y: 880, scale: 0.78, phase: 4.2, carry: 2 },
    ],
    // The office gets breakable intake files. The board adds data packets; the router's
    // lit ports and two wall emitters are the last, busiest room before the exit.
    props: [
      { x: 200, y: 200, w: 38, h: 28, kind: PROP.DOC },
      { x: 560, y: 200, w: 38, h: 28, kind: PROP.ZIP },
      { x: 200, y: 400, w: 38, h: 28, kind: PROP.AUDIO },
      { x: 560, y: 400, w: 38, h: 28, kind: PROP.VIDEO },
      { x: 700, y: 950, w: 38, h: 28, kind: PROP.ZIP },
      { x: 1300, y: 850, w: 38, h: 28, kind: PROP.DOC },
      { x: 1650, y: 880, w: 42, h: 30, kind: PROP.AUDIO },
      { x: 1250, y: 1000, w: 36, h: 26, kind: PROP.VIDEO },
      { x: 1300, y: 220, w: 42, h: 30, kind: PROP.DOC },
      { x: 1800, y: 140, w: 42, h: 30, kind: PROP.ZIP },
    ],
    emitters: [
      { x: 1104, y: 250, angle: 0, offset: 0.2 },
      { x: 1104, y: 330, angle: 0, offset: 0.65 },
    ],
    bumpers: [
      { x: 1200, y: 900, radius: 28, kind: 0 },
      { x: 1620, y: 760, radius: 32, kind: 1 },
      { x: 1880, y: 1000, radius: 28, kind: 0 },
    ],
  },
  {
    id: 15,
    name: 'USB HUB',
    tagline: 'Four ports. Pull out. Reconnect.',
    hudLabel: 'ARENA // USB HUB',
    accent: '#67e8ff',
    accentSoft: 'rgba(103, 232, 255, 0.32)',
    accentFaint: 'rgba(103, 232, 255, 0.032)',
    signature: 2,
    // A square camera box around one round hub. The four drives and the hub are the
    // whole floor; the corners are a drop. Local-only until Snapshot carries the phase.
    bounds: { left: 48, top: 48, right: 1948, bottom: 1948 },
    walls: 'open',
    pillars: [],
    spawns: usbSpawns,
    usb: {
      hubRadius: 300,
      // East, south, west, north. All four share one phase.
      drives: [
        { angle: 0, length: 420, width: 240 },
        { angle: Math.PI / 2, length: 420, width: 240 },
        { angle: Math.PI, length: 420, width: 240 },
        { angle: -Math.PI / 2, length: 420, width: 240 },
      ],
      dockOverlap: 70,
      // 300 out leaves a 230-unit channel at the hub. A dash can cross while the
      // drives are travelling, but not once they are fully out: 230 > the 180-unit
      // dash. The inward current is the non-dash return route.
      extension: 300,
      // Live pass: a little more time on the separated islands, and quicker travel
      // between docked and out. The current still matches full inward walk pressure.
      holdIn: 2.8,
      extend: 1.15,
      holdOut: 3.3,
      retract: 1.15,
      flowSpeed: 95,
      flowWidth: 48,
    },
  },
  {
    id: 16,
    name: 'SWIPE RIGHT',
    tagline: 'Swipe. Shift. Match.',
    hudLabel: 'ARENA // SWIPE RIGHT',
    accent: '#ff4f8b',
    accentSoft: 'rgba(255, 79, 139, 0.32)',
    accentFaint: 'rgba(255, 79, 139, 0.032)',
    signature: 0,
    // A phone screen, not a room: one tall runway with the dating app painted over it.
    bounds: { left: 240, top: 48, right: 1240, bottom: 1848 },
    pillars: [],
    spawns: [
      { x: 740, y: 220 },
      { x: 1110, y: 420 },
      { x: 1130, y: 880 },
      { x: 1080, y: 1380 },
      { x: 740, y: 1640 },
      { x: 400, y: 1380 },
      { x: 350, y: 880 },
      { x: 390, y: 420 },
    ],
    swipe: {
      profiles: [
        { emoji: '🧑‍🚀', name: 'NOVA', detail: 'ORBITAL MECHANIC // 27', color: '#ffcf6a' },
        { emoji: '🧑‍🎤', name: 'RIOT', detail: 'LOUD ROOM // 24', color: '#ff7ac8' },
        { emoji: '🧑‍🍳', name: 'BASIL', detail: 'NIGHT KITCHEN // 31', color: '#8dffb0' },
        { emoji: '🧑‍💻', name: 'PATCH', detail: 'BUILD BREAKER // 29', color: '#67e8ff' },
        { emoji: '🧙', name: 'HEX', detail: 'SMALL SPELLS // 33', color: '#c39bff' },
        { emoji: '🧛', name: 'VELVET', detail: 'LATE SHIFT // 26', color: '#ff6b73' },
        { emoji: '🕵️', name: 'MOSS', detail: 'OPEN SECRETS // 30', color: '#b8ff3a' },
        { emoji: '🧜', name: 'CORAL', detail: 'DEEP END // 28', color: '#5aa8ff' },
      ],
      // Four seconds of card, then a fast floor swipe. The directions alternate so the
      // wall the room is compressed against changes instead of parking on one side.
      interval: 4.6,
      travel: 0.36,
      shift: 108,
      directions: [1, -1, 1, -1, 1, -1],
      // A central popup, inset from every spawn. Its side faces read as a raised slab;
      // the rect is the solid footprint while it is up.
      popup: { x: 400, y: 690, w: 680, h: 360 },
      popupPeriod: 20,
      popupWarn: 2.8,
      popupRise: 0.55,
      popupHold: 4.6,
      popupFall: 0.6,
    },
  },
  {
    id: 17,
    name: 'SATELLITE',
    tagline: 'Solar wings. Deep space. One bad reentry.',
    hudLabel: 'ARENA // SATELLITE',
    accent: '#ffb347',
    accentSoft: 'rgba(255, 179, 71, 0.34)',
    accentFaint: 'rgba(255, 179, 71, 0.035)',
    signature: 3,
    bounds: { left: 100, top: 70, right: 1180, bottom: 1850 },
    // Space outside these plates. The hull, two solar wings and their bridges are the
    // only places a body can stand; the rest is a real fall.
    walls: 'open',
    pillars: [],
    spawns: [
      { x: 640, y: 440 },
      { x: 500, y: 600 },
      { x: 780, y: 600 },
      { x: 500, y: 900 },
      { x: 780, y: 900 },
      { x: 500, y: 1200 },
      { x: 780, y: 1200 },
      { x: 820, y: 1520 },
    ],
    // A satellite link is not a standing connection, so the infection left a copier on
    // the hull instead: it prints pulse units that flood the network when the link is up.
    replicator: [{ x: 640, y: 1000, size: 84, hp: 24, family: 0, interval: 4 }],
    props: [
      { x: 480, y: 280, w: 64, h: 84, kind: 2, hp: 4, capacitor: true },
      { x: 608, y: 280, w: 64, h: 84, kind: 1, hp: 4, capacitor: true },
      { x: 736, y: 280, w: 64, h: 84, kind: 0, hp: 4, capacitor: true },
    ],
    satellite: {
      floor: [
        { x: 420, y: 180, w: 440, h: 1520 },
        { x: 160, y: 520, w: 240, h: 420 },
        { x: 920, y: 520, w: 240, h: 420 },
        { x: 360, y: 680, w: 60, h: 120 },
        { x: 860, y: 680, w: 60, h: 120 },
      ],
      panels: [
        { x: 160, y: 520, w: 240, h: 420, phase: 0, label: 'PORT ARRAY' },
        { x: 920, y: 520, w: 240, h: 420, phase: 8, label: 'STARBOARD ARRAY' },
      ],
      telescope: {
        x: 570,
        w: 140,
        baseY: 1700,
        extension: 300,
        phase: 2,
        extend: 3.2,
        hold: 4.4,
        retract: 3.2,
        rest: 5.2,
      },
      solar: { period: 16, warn: 3, hot: 5.2, tick: 0.9, damage: 1 },
      meteors: { first: 8, interval: 12.5, count: 7, warn: 0.9, impact: 0.55, radius: 48, damage: 1 },
      reentry: { fuse: 5, rise: 14, tick: 0.8, damage: 1, hold: 2.5, reset: 5 },
    },
  },
  {
    id: 18,
    name: 'ROCKET NAVIGATION',
    tagline: 'Speed, altitude, trajectory. The line stays.',
    hudLabel: 'ARENA // ROCKET NAVIGATION',
    accent: '#7cf7cc',
    accentSoft: 'rgba(124, 247, 204, 0.32)',
    accentFaint: 'rgba(124, 247, 204, 0.034)',
    signature: 2,
    bounds: { left: 80, top: 60, right: 1780, bottom: 1000 },
    pillars: [
      { x: 112, y: 112, w: 160, h: 84 },
      { x: 1552, y: 804, w: 156, h: 100 },
      { x: 612, y: 566, w: 118, h: 72 },
      { x: 1244, y: 700, w: 100, h: 82 },
    ],
    spawns: [
      { x: 206, y: 214 },
      { x: 702, y: 132 },
      { x: 1518, y: 192 },
      { x: 1626, y: 560 },
      { x: 1400, y: 910 },
      { x: 760, y: 888 },
      { x: 250, y: 702 },
      { x: 158, y: 462 },
    ],
    rocket: {
      launch: { x: 930, y: 1050 },
      control: { x: 260, y: 330 },
      end: { x: 1550, y: 40 },
      duration: 24,
      // The blocks overlap along the arc, so the wall is continuous rather than a row
      // of posts with walkable gaps between them. The arc's fastest end advances more
      // than 20 units per segment, so 128 blocks at 24 units stay overlapped at the top.
      segments: 128,
      thickness: 24,
      stages: [
        { at: 0.32, label: 'BOOSTER SEPARATION' },
        { at: 0.62, label: 'FAIRING JETTISON' },
      ],
    },
  },
  {
    id: 19,
    name: 'WEAPON SYSTEMS',
    tagline: 'Fire. Eject. Burn. Mind the console.',
    hudLabel: 'ARENA // WEAPON SYSTEMS',
    accent: '#ff6b5c',
    accentSoft: 'rgba(255, 107, 92, 0.32)',
    accentFaint: 'rgba(255, 107, 92, 0.034)',
    signature: 1,
    bounds: { left: 60, top: 60, right: 1780, bottom: 1000 },
    pillars: [
      ...weaponButtons,
      { x: 760, y: 790, w: 180, h: 70 },
      { x: 1010, y: 780, w: 140, h: 80 },
    ],
    spawns: [
      { x: 232, y: 174 },
      { x: 760, y: 138 },
      { x: 1580, y: 168 },
      { x: 1600, y: 804 },
      { x: 1080, y: 900 },
      { x: 620, y: 882 },
      { x: 224, y: 640 },
      { x: 168, y: 382 },
    ],
    weapon: {
      buttons: weaponButtons,
      jet: { x: 176, y: 244, w: 780, h: 500 },
    },
  },
  {
    id: 20,
    name: 'SPEAK & FIND',
    tagline: 'Say the word. Find the picture.',
    hudLabel: 'ARENA // SPEAK & FIND',
    accent: '#ff8ad4',
    accentSoft: 'rgba(255, 138, 212, 0.32)',
    accentFaint: 'rgba(255, 138, 212, 0.034)',
    signature: 2,
    bounds: { left: 80, top: 60, right: 1780, bottom: 1000 },
    // Four chunky letter keys frame the toy and double as the only static cover.
    pillars: [
      { x: 120, y: 180, w: 170, h: 100 },
      { x: 1500, y: 200, w: 160, h: 100 },
      { x: 120, y: 760, w: 160, h: 100 },
      { x: 1510, y: 760, w: 150, h: 100 },
    ],
    spawns: [
      { x: 236, y: 142 },
      { x: 760, y: 150 },
      { x: 1280, y: 140 },
      { x: 1660, y: 380 },
      { x: 1660, y: 900 },
      { x: 1240, y: 920 },
      { x: 700, y: 920 },
      { x: 230, y: 900 },
    ],
    seek: {
      display: { x: 650, y: 82, w: 460, h: 92 },
      cards: seekCards,
      prompts: [
        { text: 'FIND THE BOAT', card: 0 },
        { text: 'FIND THE MOON', card: 1 },
        { text: 'FIND THE FROG', card: 2 },
        { text: 'FIND THE STAR', card: 3 },
        { text: 'FIND THE FISH', card: 4 },
        { text: 'FIND THE APPLE', card: 5 },
      ],
    },
  },
  {
    id: 21,
    name: 'CAR NAVIGATION',
    tagline: 'Recalculating. The route stays.',
    hudLabel: 'ARENA // CAR NAVIGATION',
    accent: '#62d9ff',
    accentSoft: 'rgba(98, 217, 255, 0.32)',
    accentFaint: 'rgba(98, 217, 255, 0.034)',
    signature: 3,
    bounds: { left: 80, top: 60, right: 1780, bottom: 1000 },
    pillars: [
      { x: 120, y: 250, w: 150, h: 96 },
      { x: 610, y: 150, w: 160, h: 88 },
      { x: 1470, y: 180, w: 160, h: 96 },
      { x: 930, y: 900, w: 170, h: 72 },
      { x: 1540, y: 820, w: 140, h: 96 },
    ],
    spawns: [
      { x: 250, y: 140 },
      { x: 760, y: 128 },
      { x: 1260, y: 128 },
      { x: 1660, y: 280 },
      { x: 1700, y: 900 },
      { x: 1200, y: 930 },
      { x: 480, y: 930 },
      { x: 180, y: 620 },
    ],
    car: {
      route: carRoute,
      duration: 26,
      segments: 160,
      thickness: 26,
      stops: [
        { at: 0.22, label: 'PICKUP' },
        { at: 0.48, label: 'TOLL GATE' },
        { at: 0.74, label: 'SCENIC ROUTE' },
        { at: 0.96, label: 'DESTINATION' },
      ],
    },
  },
  {
    id: 22,
    name: 'PONG',
    tagline: 'Serve. Rally. Mind the ball.',
    hudLabel: 'ARENA // PONG',
    accent: '#a8ffb0',
    accentSoft: 'rgba(168, 255, 176, 0.32)',
    accentFaint: 'rgba(168, 255, 176, 0.034)',
    signature: 1,
    bounds: { left: 80, top: 60, right: 1780, bottom: 1000 },
    // The court is the arena: no static cover, only the live rally ball.
    pillars: [],
    spawns: [
      { x: 400, y: 240 },
      { x: 760, y: 230 },
      { x: 1100, y: 230 },
      { x: 1420, y: 240 },
      { x: 1450, y: 820 },
      { x: 1100, y: 860 },
      { x: 760, y: 860 },
      { x: 390, y: 820 },
    ],
    pong: {
      court: { x: 200, y: 150, w: 1460, h: 780 },
      ballRadius: 12,
      paddleW: 16,
      paddleH: 122,
      paddleInset: 30,
      paddleSpeed: 360,
      speed: 430,
      maxSpeed: 680,
      serveDelay: 0.85,
      bounceAngle: 0.6,
      damage: 1,
      enemyDamage: 3,
      knockback: 520,
    },
  },
  {
    id: 23,
    name: 'AIRPORT',
    tagline: 'Arrivals. Departures. Stand clear.',
    hudLabel: 'ARENA // AIRPORT',
    accent: '#ffc857',
    accentSoft: 'rgba(255, 200, 87, 0.32)',
    accentFaint: 'rgba(255, 200, 87, 0.034)',
    signature: 1,
    bounds: { left: 80, top: 60, right: 1780, bottom: 1000 },
    // The board is the floor. There is no terminal apron and no furniture to hide behind;
    // the rows are the terrain, and a row landing is the threat.
    pillars: [],
    spawns: [
      { x: 380, y: 180 },
      { x: 720, y: 270 },
      { x: 1180, y: 180 },
      { x: 1520, y: 270 },
      { x: 380, y: 860 },
      { x: 720, y: 940 },
      { x: 1180, y: 940 },
      { x: 1520, y: 860 },
    ],
    flip: {
      // The board fills the arena. Two banks of nine rows.
      board: { x: 90, y: 70, w: 1680, h: 920 },
      rows: airportFlights(),
      headerH: 70,
      rowH: 88,
      timeW: 150,
      timeH: 40,
      period: 7.6,
      warn: 1.2,
      flap: 0.38,
      // A wave across eighteen rows: fast enough to read as a board working, not a blur.
      stagger: 0.28,
      damage: 1,
      enemyDamage: 3,
      knockback: 460,
      banks: 2,
      bankGap: 24,
      // Every text field cycles through these decks, so no line is static.
      destinations: ['OSAKA', 'LISBON', 'NAIROBI', 'REYKJAVIK', 'SINGAPORE', 'SANTIAGO', 'HELSINKI', 'MARRAKESH'],
      gates: ['A12', 'B04', 'C07', 'D02', 'E11', 'F08', 'G03', 'H09'],
      statuses: ['ON TIME', 'BOARDING', 'DELAYED', 'GATE OPEN', 'FINAL CALL'],
    },
  },
  {
    id: 24,
    name: 'SPACE INVADERS',
    tagline: 'The fleet is the floor. The cannon is live.',
    hudLabel: 'ARENA // SPACE INVADERS',
    accent: '#83ff9b',
    accentSoft: 'rgba(131, 255, 155, 0.32)',
    accentFaint: 'rgba(131, 255, 155, 0.034)',
    signature: 3,
    bounds: { left: 80, top: 60, right: 1780, bottom: 1000 },
    // Three pixel bunkers between the fleet and the simulated player's cannon.
    pillars: [
      { x: 360, y: 740, w: 190, h: 54 },
      { x: 825, y: 740, w: 190, h: 54 },
      { x: 1290, y: 740, w: 190, h: 54 },
    ],
    spawns: [
      { x: 240, y: 170 },
      { x: 620, y: 140 },
      { x: 1080, y: 140 },
      { x: 1520, y: 180 },
      { x: 1600, y: 620 },
      { x: 1180, y: 680 },
      { x: 620, y: 680 },
      { x: 220, y: 620 },
    ],
    invaders: {
      fleet: { x: 170, y: 100, w: 1560, h: 520 },
      rows: 5,
      cols: 10,
      cannon: { x: 930, y: 920, w: 56, h: 32, speed: 300 },
      shotSpeed: 760,
      shotRadius: 6,
      fireEvery: 0.66,
      telegraph: 0.28,
      damage: 1,
      enemyDamage: 2,
      knockback: 420,
    },
  },
  {
    id: 25,
    name: 'FAX MACHINE',
    tagline: 'Transmission live. Mind the carriage.',
    hudLabel: 'ARENA // FAX MACHINE',
    accent: '#ffc35c',
    accentSoft: 'rgba(255, 195, 92, 0.32)',
    accentFaint: 'rgba(255, 195, 92, 0.034)',
    signature: 1,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    // Toner drums and paper stacks frame the sheet. They are ordinary static cover.
    pillars: [
      { x: 150, y: 180, w: 110, h: 140 },
      { x: 1634, y: 180, w: 110, h: 140 },
      { x: 150, y: 726, w: 110, h: 140 },
      { x: 1634, y: 726, w: 110, h: 140 },
    ],
    // The sheet is the arena. The head starts parked at the left edge, then makes
    // one pass to the right, parks, and comes back.
    fax: {
      x: 320,
      y: 120,
      w: 1254,
      h: 758,
      documents: [
        'TRANSMITTAL // 004',
        'PAGE 02 // ATTACHMENT',
        'ROUTING SLIP // URGENT',
        'FAX BACK // NO COVER',
      ],
      headW: 58,
      speed: 320,
      pause: 1,
      damage: 1,
      enemyDamage: 3,
      knockback: 620,
    },
    // Perimeter starts clear of the sheet and the corner stacks. The first pass
    // begins parked, so the opening spawn is never a free hit.
    spawns: [
      { x: 995, y: 90 },
      { x: 1780, y: 190 },
      { x: 1780, y: 547 },
      { x: 1780, y: 900 },
      { x: 995, y: 990 },
      { x: 280, y: 900 },
      { x: 280, y: 547 },
      { x: 280, y: 190 },
    ],
  },
  {
    id: 26,
    name: 'SMART PLUG',
    tagline: 'Green is safe. Red is live.',
    hudLabel: 'ARENA // SMART PLUG',
    accent: '#6dffa8',
    accentSoft: 'rgba(109, 255, 168, 0.32)',
    accentFaint: 'rgba(109, 255, 168, 0.034)',
    signature: 3,
    bounds: { left: 80, top: 60, right: 1780, bottom: 1000 },
    // Four dual-socket smart modules frame the circuit ring. Ordinary static cover.
    pillars: [
      { x: 190, y: 170, w: 160, h: 120 },
      { x: 1430, y: 170, w: 160, h: 120 },
      { x: 190, y: 710, w: 160, h: 120 },
      { x: 1430, y: 710, w: 160, h: 120 },
    ],
    // The ring is socket-to-socket: top, right, bottom, left. All four arcs arm
    // together on red, so the centre and the outside are the two safe pockets.
    plug: {
      arcs: [
        { ax: 350, ay: 230, bx: 1430, by: 230 },
        { ax: 1510, ay: 290, bx: 1510, by: 710 },
        { ax: 1430, ay: 770, bx: 350, by: 770 },
        { ax: 270, ay: 710, bx: 270, by: 290 },
      ],
      safe: 2.4,
      warn: 0.75,
      live: 1.65,
      cool: 1,
      arcWidth: 22,
      damage: 1,
      enemyDamage: 2,
      knockback: 680,
    },
    // Starts clear of the four modules and all four arcs. The opening seconds are
    // green, so an outside or centre spawn is never a free hit.
    spawns: [
      { x: 720, y: 130 },
      { x: 1180, y: 130 },
      { x: 1670, y: 500 },
      { x: 1180, y: 930 },
      { x: 720, y: 930 },
      { x: 135, y: 500 },
      { x: 900, y: 500 },
      { x: 1100, y: 500 },
    ],
  },
  {
    id: 27,
    name: 'SMOKE DETECTOR',
    tagline: 'Step light. Alarm loud.',
    hudLabel: 'ARENA // SMOKE DETECTOR',
    accent: '#ff6a5e',
    accentSoft: 'rgba(255, 106, 94, 0.32)',
    accentFaint: 'rgba(255, 106, 94, 0.034)',
    signature: 2,
    // A square camera plate with the round detector face inscribed inside it. The
    // disc has no holes and no arm; it is here so the rim is a real drop.
    bounds: { left: 495, top: 47, right: 1495, bottom: 1047 },
    walls: 'open',
    pillars: [],
    disc: {
      radius: 500,
      spin: 0,
      holes: [],
      arm: { pivot: 0, period: 1, sweep: 0, thickness: 1, push: 0, reach: 0 },
    },
    // Four floor sensors in a ring, clear of the eight spawn points. The battery sits
    // beside the central siren, so a player has to enter the alarm zone to shoot it.
    smoke: {
      sensors: [
        { x: 995, y: 300, radius: 42 },
        { x: 1260, y: 547, radius: 42 },
        { x: 995, y: 794, radius: 42 },
        { x: 730, y: 547, radius: 42 },
      ],
      battery: { x: 1090, y: 600, w: 72, h: 96 },
      batteryHp: 6,
      alarmTime: 5.2,
      sensorCooldown: 2.5,
      waveEvery: 0.78,
      waveSpeed: 390,
      waveWidth: 30,
      maxRadius: 580,
      damage: 1,
      enemyDamage: 2,
      knockback: 620,
    },
    spawns: [
      { x: 995, y: 107 },
      { x: 1306, y: 236 },
      { x: 1435, y: 547 },
      { x: 1306, y: 858 },
      { x: 995, y: 987 },
      { x: 684, y: 858 },
      { x: 555, y: 547 },
      { x: 684, y: 236 },
    ],
  },
  {
    id: 28,
    name: 'SMART WATCH',
    tagline: 'Every second counts.',
    hudLabel: 'ARENA // SMART WATCH',
    accent: '#ff8d5c',
    accentSoft: 'rgba(255, 141, 92, 0.32)',
    accentFaint: 'rgba(255, 141, 92, 0.034)',
    signature: 2,
    bounds: { left: 330, top: 60, right: 1670, bottom: 1000 },
    // Four raised complication cards. They are cover; the hand is a floor projection
    // and sweeps over them rather than stopping on geometry.
    pillars: [
      { x: 470, y: 180, w: 150, h: 104 },
      { x: 1380, y: 180, w: 150, h: 104 },
      { x: 470, y: 736, w: 150, h: 104 },
      { x: 1380, y: 736, w: 150, h: 104 },
    ],
    spawns: [
      { x: 620, y: 130 },
      { x: 900, y: 120 },
      { x: 1100, y: 120 },
      { x: 1380, y: 130 },
      { x: 1600, y: 530 },
      { x: 1380, y: 900 },
      { x: 620, y: 900 },
      { x: 400, y: 530 },
    ],
    watch: {
      face: { x: 380, y: 100, w: 1240, h: 860 },
      handLength: 418,
      handWidth: 18,
      speed: 1.05,
      damage: 1,
      enemyDamage: 2,
      knockback: 600,
    },
  },
  {
    id: 29,
    name: 'BUSINESS LAPTOP',
    tagline: 'The inbox never stops.',
    hudLabel: 'ARENA // BUSINESS LAPTOP',
    accent: '#8ac7ff',
    accentSoft: 'rgba(138, 199, 255, 0.32)',
    accentFaint: 'rgba(138, 199, 255, 0.034)',
    signature: 1,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    // The inbox and preview are dynamic cover. The screen frame is presentation.
    pillars: [],
    spawns: [
      { x: 260, y: 100 },
      { x: 720, y: 100 },
      { x: 1140, y: 100 },
      { x: 1560, y: 100 },
      { x: 1840, y: 570 },
      { x: 1540, y: 990 },
      { x: 960, y: 990 },
      { x: 350, y: 990 },
    ],
    laptop: {
      screen: { x: 80, y: 64, w: 1830, h: 966 },
      inbox: { x: 130, y: 140, w: 430, h: 800 },
      preview: { x: 610, y: 140, w: 1270, h: 800 },
      cards: 4,
      cardH: 104,
      cardGap: 16,
      speed: 34,
      messageEvery: 8,
      messages: [
        {
          sender: 'M. CHEN',
          subject: 'Q4 forecast — final',
          preview: 'Numbers attached. Please review before the call.',
          layout: [
            { x: 650, y: 210, w: 360, h: 200 },
            { x: 1040, y: 210, w: 360, h: 200 },
            { x: 650, y: 450, w: 750, h: 120 },
          ],
        },
        {
          sender: 'R. PATEL',
          subject: 'Re: launch checklist',
          preview: 'Three columns left. The middle one is still open.',
          layout: [
            { x: 650, y: 210, w: 220, h: 520 },
            { x: 920, y: 210, w: 220, h: 520 },
            { x: 1190, y: 210, w: 220, h: 520 },
          ],
        },
        {
          sender: 'OPS',
          subject: 'Weekly standup notes',
          preview: 'Four panels moved. Watch the bottom lane.',
          layout: [
            { x: 650, y: 220, w: 420, h: 180 },
            { x: 1110, y: 220, w: 420, h: 180 },
            { x: 860, y: 470, w: 420, h: 170 },
            { x: 650, y: 720, w: 740, h: 100 },
          ],
        },
        {
          sender: 'FINANCE',
          subject: 'Invoice attached',
          preview: 'The attachment is the cover. Mind the gap on the right.',
          layout: [
            { x: 650, y: 210, w: 520, h: 270 },
            { x: 1220, y: 210, w: 260, h: 440 },
            { x: 650, y: 540, w: 500, h: 240 },
          ],
        },
      ],
    },
  },
  {
    id: 30,
    name: 'SPREADSHEET',
    tagline: 'Every cell is cover. Every cell breaks.',
    hudLabel: 'ARENA // SPREADSHEET',
    accent: '#7fe3a6',
    accentSoft: 'rgba(127, 227, 166, 0.32)',
    accentFaint: 'rgba(127, 227, 166, 0.034)',
    signature: 1,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    // The sheet cells are dynamic cover, so the static pillar list stays empty.
    pillars: [],
    spawns: [
      { x: 260, y: 110 },
      { x: 700, y: 110 },
      { x: 1140, y: 110 },
      { x: 1580, y: 110 },
      { x: 260, y: 990 },
      { x: 700, y: 990 },
      { x: 1140, y: 990 },
      { x: 1580, y: 990 },
    ],
    laptop: {
      variant: 'sheet',
      screen: { x: 80, y: 64, w: 1830, h: 966 },
      // The grid pane; the cells themselves are the cover.
      inbox: { x: 150, y: 190, w: 1490, h: 730 },
      // Cell inspector. Presentation only; it never becomes solid.
      preview: { x: 1700, y: 190, w: 170, h: 730 },
      cards: 0,
      cardH: 0,
      cardGap: 0,
      speed: 0,
      messageEvery: 8,
      messages: [],
      sheet: {
        origin: { x: 150, y: 190 },
        cellW: 190,
        cellH: 130,
        gap: 70,
        cols: 6,
        rows: 4,
        cursorEvery: 0.55,
        columns: ['A', 'B', 'C', 'D', 'E', 'F'],
        // A staggered mask, so the corridors never line up into one straight run.
        cells: [
          { col: 0, row: 0, hp: 2 },
          { col: 1, row: 0, hp: 2 },
          { col: 3, row: 0, hp: 2 },
          { col: 4, row: 0, hp: 2 },
          { col: 5, row: 0, hp: 2 },
          { col: 0, row: 1, hp: 2 },
          { col: 1, row: 1, hp: 2 },
          { col: 4, row: 1, hp: 2 },
          { col: 5, row: 1, hp: 2 },
          { col: 0, row: 2, hp: 2 },
          { col: 2, row: 2, hp: 2 },
          { col: 3, row: 2, hp: 2 },
          { col: 5, row: 2, hp: 2 },
          { col: 1, row: 3, hp: 2 },
          { col: 2, row: 3, hp: 2 },
          { col: 3, row: 3, hp: 2 },
          { col: 4, row: 3, hp: 2 },
        ],
      },
    },
  },
  {
    id: 31,
    name: 'CHAT',
    tagline: 'The thread never stops.',
    hudLabel: 'ARENA // CHAT',
    accent: '#ff9ad5',
    accentSoft: 'rgba(255, 154, 213, 0.32)',
    accentFaint: 'rgba(255, 154, 213, 0.034)',
    signature: 1,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    pillars: [],
    spawns: [
      { x: 260, y: 100 },
      { x: 720, y: 100 },
      { x: 1140, y: 100 },
      { x: 1560, y: 100 },
      { x: 260, y: 990 },
      { x: 720, y: 990 },
      { x: 1140, y: 990 },
      { x: 1560, y: 990 },
    ],
    laptop: {
      variant: 'chat',
      screen: { x: 80, y: 64, w: 1830, h: 966 },
      // Bubble pane. Bubbles alternate sides, so one lane is always open.
      inbox: { x: 130, y: 150, w: 1690, h: 700 },
      // Composer strip. Presentation only.
      preview: { x: 130, y: 872, w: 1690, h: 110 },
      cards: 4,
      cardH: 118,
      cardGap: 26,
      speed: 52,
      messageEvery: 6,
      // Bubble labels and the pinned line. Chat moves cover with the bubbles, not a preview
      // layout, so every message carries an empty layout on purpose.
      messages: [
        { sender: 'OPS', subject: 'deploy window', preview: 'Moved to 14:00. Treat the lane as live.', layout: [] },
        { sender: 'MAYA', subject: 're: standup', preview: 'Two blockers left, both in the middle column.', layout: [] },
        { sender: 'BUILD BOT', subject: 'pipeline', preview: 'Green on main. Twelve minutes since last push.', layout: [] },
        { sender: 'SAM', subject: 'lunch?', preview: 'Bring the pager. The thread never sleeps.', layout: [] },
      ],
      bubbleW: 0.56,
    },
  },
  {
    id: 32,
    name: 'CAPCOM',
    tagline: 'Four consoles. One trajectory. Hold the room.',
    hudLabel: 'ARENA // CAPCOM',
    accent: '#7ce8a8',
    accentSoft: 'rgba(124, 232, 168, 0.32)',
    accentFaint: 'rgba(124, 232, 168, 0.034)',
    signature: 0,
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    // Four plates in a ring, one department each. Console banks are the cover, so the
    // furniture and the fiction are the same objects.
    // Each department lays its consoles out to suit its job. The four plates share the
    // ring, not the furniture: CAPCOM sits in two wide tiers facing the board, FIDO gets
    // plotting tables with an open plotting lane, GUIDO wraps a central gimbal, and EECOM
    // lines the walls with switchgear and leaves a service lane down the middle.
    pillars: [
      // CAPCOM: two tiers of wide flight desks, offset so the aisle dog-legs.
      { x: 110, y: 150, w: 300, h: 46 },
      { x: 500, y: 150, w: 250, h: 46 },
      { x: 110, y: 300, w: 220, h: 46 },
      { x: 470, y: 300, w: 280, h: 46 },
      // FIDO: three plotting tables, one long pair and one wide board below.
      { x: 150, y: 760, w: 200, h: 90 },
      { x: 500, y: 760, w: 200, h: 90 },
      { x: 300, y: 892, w: 240, h: 88 },
      // GUIDO: a central gyro pedestal with four navigation racks at the corners.
      { x: 1460, y: 190, w: 150, h: 120 },
      { x: 1160, y: 110, w: 90, h: 90 },
      { x: 1800, y: 110, w: 90, h: 90 },
      { x: 1160, y: 320, w: 90, h: 90 },
      { x: 1800, y: 320, w: 90, h: 90 },
      // EECOM: switchgear along both walls, breaker cabinets on the open side.
      { x: 1130, y: 720, w: 60, h: 270 },
      { x: 1870, y: 720, w: 60, h: 270 },
      { x: 1550, y: 700, w: 220, h: 56 },
      { x: 1550, y: 925, w: 220, h: 56 },
    ],
    // Two stations per plate, clear of the console banks.
    spawns: [
      { x: 380, y: 120 },
      { x: 380, y: 380 },
      { x: 380, y: 720 },
      { x: 380, y: 1010 },
      { x: 1430, y: 720 },
      { x: 1430, y: 1010 },
      { x: 1430, y: 120 },
      { x: 1430, y: 380 },
    ],
    // Teletype paper and tape reels: loose debris, same as any other arena's files.
    props: [
      { x: 330, y: 220, w: 38, h: 28, kind: PROP.DOC },
      { x: 700, y: 220, w: 38, h: 28, kind: PROP.AUDIO },
      { x: 330, y: 860, w: 38, h: 28, kind: PROP.ZIP },
      { x: 700, y: 860, w: 38, h: 28, kind: PROP.VIDEO },
      { x: 1380, y: 860, w: 38, h: 28, kind: PROP.DOC },
      { x: 1760, y: 860, w: 38, h: 28, kind: PROP.ZIP },
      { x: 1380, y: 220, w: 38, h: 28, kind: PROP.AUDIO },
      { x: 1760, y: 220, w: 38, h: 28, kind: PROP.VIDEO },
    ],
    islands: [
      { x: 48, y: 48, w: 810, h: 396 },
      { x: 48, y: 664, w: 810, h: 382 },
      { x: 1098, y: 664, w: 844, h: 382 },
      { x: 1098, y: 48, w: 844, h: 396 },
    ],
    rooms: [
      {
        shape: 'rect',
        x: 48,
        y: 48,
        w: 810,
        h: 396,
        theme: 'console',
        variant: 'flight',
        label: 'CAPCOM',
        sub: 'FLIGHT CONTROL // 1968',
      },
      {
        shape: 'rect',
        x: 48,
        y: 664,
        w: 810,
        h: 382,
        theme: 'console',
        variant: 'dynamics',
        label: 'FIDO',
        sub: 'FLIGHT DYNAMICS // TRAJECTORY',
      },
      {
        shape: 'rect',
        x: 1098,
        y: 664,
        w: 844,
        h: 382,
        theme: 'console',
        variant: 'systems',
        label: 'EECOM',
        sub: 'ELECTRICAL // ENVIRONMENTAL',
      },
      {
        shape: 'rect',
        x: 1098,
        y: 48,
        w: 844,
        h: 396,
        theme: 'console',
        variant: 'guidance',
        label: 'GUIDO',
        sub: 'GUIDANCE // NAVIGATION',
      },
    ],
    // A ring: all four decks are open, and the gaps are wider than a dash so the ring is
    // the only route between departments.
    bridges: [
      { x: 400, y: 444, w: 150, h: 220, label: 'A' },
      { x: 1440, y: 444, w: 150, h: 220, label: 'B' },
      { x: 858, y: 160, w: 240, h: 140, label: 'C' },
      { x: 858, y: 800, w: 240, h: 140, label: 'D' },
    ],
  },
  {
    id: 33,
    name: 'AIR TRAFFIC',
    tagline: 'Scope is live. Watch the traffic.',
    hudLabel: 'ARENA // AIR TRAFFIC',
    accent: '#7ef7c0',
    accentSoft: 'rgba(126, 247, 192, 0.32)',
    accentFaint: 'rgba(126, 247, 192, 0.034)',
    signature: 0,
    // The scope face is a disc, so the bounds are only the cabinet surround.
    bounds: { left: 48, top: 48, right: 1942, bottom: 1046 },
    // Console desks sit on the scope. Cover is furniture, not scenery.
    pillars: [
      { x: 720, y: 330, w: 140, h: 50 },
      { x: 1130, y: 330, w: 140, h: 50 },
      { x: 720, y: 720, w: 140, h: 50 },
      { x: 1130, y: 720, w: 140, h: 50 },
      { x: 830, y: 500, w: 130, h: 46 },
      { x: 1030, y: 560, w: 130, h: 46 },
    ],
    // Eight controller stations around the ring, inside the scope and clear of the desks.
    spawns: [
      { x: 1325, y: 547 },
      { x: 1228, y: 780 },
      { x: 995, y: 877 },
      { x: 762, y: 780 },
      { x: 665, y: 547 },
      { x: 762, y: 314 },
      { x: 1228, y: 314 },
      { x: 995, y: 217 },
    ],
    props: [
      { x: 900, y: 300, w: 34, h: 26, kind: PROP.DOC },
      { x: 1050, y: 760, w: 34, h: 26, kind: PROP.DOC },
      { x: 800, y: 640, w: 34, h: 26, kind: PROP.ZIP },
      { x: 1120, y: 430, w: 34, h: 26, kind: PROP.AUDIO },
    ],
    radar: {
      cx: 995,
      cy: 547,
      radius: 455,
      // Eleven seconds a revolution: slow enough to read, and it never damages.
      sweepPeriod: 11,
      damage: 1,
      knockback: 470,
      planes: [
        // The first pass runs dead through the centre, so the scope always shows traffic.
        { tag: 'AAL 112', bearing: 2.5, heading: 2.5 + Math.PI - 0.05, entry: 640, run: 1300, speed: 300, radius: 30, period: 9, delay: 2, kind: 0 },
        { tag: 'UAL 907', bearing: 0.5, heading: 0.5 + Math.PI + 0.22, entry: 660, run: 1300, speed: 340, radius: 28, period: 12, delay: 5, kind: 1 },
        { tag: 'DAL 41', bearing: 3.9, heading: 3.9 + Math.PI - 0.3, entry: 640, run: 1300, speed: 270, radius: 32, period: 14, delay: 8, kind: 0 },
        { tag: 'SWA 2216', bearing: 1.7, heading: 1.7 + Math.PI + 0.16, entry: 660, run: 1300, speed: 360, radius: 26, period: 17, delay: 11.5, kind: 1 },
        { tag: 'FDX 88', bearing: 5.2, heading: 5.2 + Math.PI - 0.26, entry: 650, run: 1300, speed: 320, radius: 30, period: 20, delay: 15, kind: 0 },
      ],
    },
  },

  {
    id: 90,
    qa: true,
    name: 'TEST RANGE',
    tagline: 'Empty floor. Only the boss to blame.',
    hudLabel: 'ARENA // TEST RANGE',
    accent: '#9fb3c8',
    accentSoft: 'rgba(159, 179, 200, 0.3)',
    accentFaint: 'rgba(159, 179, 200, 0.03)',
    signature: 1,
    // Deliberately huge and empty: no pillars, no fixtures, no voids, no hazards.
    // Boss scale and behaviour can be read here before geometry gets a vote.
    bounds: { left: 60, top: 60, right: 3540, bottom: 1980 },
    pillars: [],
    spawns: [
      { x: 600, y: 420 },
      { x: 1740, y: 300 },
      { x: 2900, y: 420 },
      { x: 3200, y: 1000 },
      { x: 2900, y: 1620 },
      { x: 1740, y: 1740 },
      { x: 600, y: 1620 },
      { x: 300, y: 1000 },
    ],
  },
];

/** 0..1 trajectory progress at `t` seconds after launch. */
export function rocketProgressAt(rocket: ArenaRocketDef, t: number): number {
  return Math.max(0, Math.min(1, t / Math.max(0.001, rocket.duration)));
}

/** Point on the quadratic launch arc. `out` is reused to avoid render allocation. */
export function rocketArcAt(rocket: ArenaRocketDef, k: number, out: Point2): Point2 {
  const p = Math.max(0, Math.min(1, k));
  const u = 1 - p;
  out.x = u * u * rocket.launch.x + 2 * u * p * rocket.control.x + p * p * rocket.end.x;
  out.y = u * u * rocket.launch.y + 2 * u * p * rocket.control.y + p * p * rocket.end.y;
  return out;
}

export const FLIP_STATE = {
  idle: 0,
  warn: 1,
  flap: 2,
} as const;

/** Local phase of one board row. Later rows lag, so a flap travels down the board. */
export function flipRowPhaseAt(flip: ArenaFlipDef, row: number, t: number): number {
  const period = Math.max(0.001, flip.period);
  return (((t - row * flip.stagger) % period) + period) % period;
}

/** 0 idle, 1 warning, 2 flap. */
export function flipRowStateAt(flip: ArenaFlipDef, row: number, t: number): number {
  const phase = flipRowPhaseAt(flip, row, t);
  if (phase < flip.warn) return FLIP_STATE.warn;
  if (phase < flip.warn + flip.flap) return FLIP_STATE.flap;
  return FLIP_STATE.idle;
}

/** 0..1 through the flap, or -1 while the row is idle or warning. */
export function flipRowFlapProgressAt(flip: ArenaFlipDef, row: number, t: number): number {
  const phase = flipRowPhaseAt(flip, row, t);
  if (phase < flip.warn || phase >= flip.warn + flip.flap) return -1;
  return (phase - flip.warn) / Math.max(0.001, flip.flap);
}

/** Current time string in the row's cycling split-flap deck. */
export function flipRowTimeAt(flip: ArenaFlipDef, row: number, t: number): string {
  const times = flip.rows[row]?.times;
  if (!times || times.length === 0) return '';
  const cycle = Math.floor((t - row * flip.stagger) / Math.max(0.001, flip.period));
  return times[((cycle % times.length) + times.length) % times.length];
}

/** The floor footprint of one flipping row: the whole bank band is the hazard. */
export function flipRowRectAt(flip: ArenaFlipDef, row: number, out: Rect): Rect {
  const inset = 10;
  const banks = Math.max(1, flip.banks ?? 1);
  const gap = flip.bankGap ?? 24;
  const perBank = Math.ceil(flip.rows.length / banks);
  const bank = Math.min(banks - 1, Math.floor(row / perBank));
  const local = row % perBank;
  const bankW = (flip.board.w - inset * 2 - gap * (banks - 1)) / banks;
  out.x = flip.board.x + inset + bank * (bankW + gap);
  out.y = flip.board.y + flip.headerH + local * flip.rowH;
  out.w = bankW;
  out.h = flip.rowH;
  return out;
}

/** The value a deck-driven text field shows at `t`. Every text field flips. */
export function flipFieldAt(
  flip: ArenaFlipDef,
  row: number,
  deck: string[] | undefined,
  fallback: string,
  t: number,
): string {
  if (!deck || deck.length === 0) return fallback;
  const cycle = Math.floor((t - row * flip.stagger) / Math.max(0.001, flip.period));
  return deck[(((row + cycle) % deck.length) + deck.length) % deck.length];
}

/** The floor footprint of one flipping time tile. */
export function flipTimeRectAt(flip: ArenaFlipDef, row: number, out: Rect): Rect {
  out.x = flip.board.x + 24;
  out.y = flip.board.y + flip.headerH + row * flip.rowH + (flip.rowH - flip.timeH) * 0.5;
  out.w = flip.timeW;
  out.h = flip.timeH;
  return out;
}

/** 0..1 route progress at `t` seconds after the car starts. */
export function carProgressAt(car: ArenaCarDef, t: number): number {
  return Math.max(0, Math.min(1, t / Math.max(0.001, car.duration)));
}

/** Point at normalized arc-length `k` along the serpentine route. */
export function carRouteAt(car: ArenaCarDef, k: number, out: Point2): Point2 {
  const route = car.route;
  if (route.length === 0) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  if (route.length === 1) {
    out.x = route[0].x;
    out.y = route[0].y;
    return out;
  }
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
  }
  let remaining = Math.max(0, Math.min(1, k)) * total;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (remaining <= length || i === route.length - 1) {
      const f = length > 0.0001 ? remaining / length : 0;
      out.x = a.x + dx * f;
      out.y = a.y + dy * f;
      return out;
    }
    remaining -= length;
  }
  out.x = route[route.length - 1].x;
  out.y = route[route.length - 1].y;
  return out;
}

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

/** Position of one key in the shared pad cycle, in seconds. Allocation-free. */
export function keypadKeyPhase(keypad: ArenaKeypadDef, index: number, t: number): number {
  const key = keypad.keys[index];
  if (!key) return 0;
  return (((t + (key.offset ?? index * KEYPAD.offsetStep)) % KEYPAD.period) + KEYPAD.period) % KEYPAD.period;
}

/** State of one key at `t` seconds into the shared pad cycle. Allocation-free. */
export function keypadKeyState(keypad: ArenaKeypadDef, index: number, t: number): number {
  const key = keypad.keys[index];
  if (!key) return KEYPAD_STATE.up;
  const phase = keypadKeyPhase(keypad, index, t);
  const slamStart = KEYPAD.warn;
  const slamEnd = slamStart + KEYPAD.slam;
  const downEnd = slamEnd + KEYPAD.down;
  const riseEnd = downEnd + KEYPAD.rise;
  if (phase < slamStart) return KEYPAD_STATE.warn;
  if (phase < slamEnd) return KEYPAD_STATE.slam;
  if (phase < downEnd) return KEYPAD_STATE.down;
  if (phase < riseEnd) return KEYPAD_STATE.rise;
  return KEYPAD_STATE.up;
}

/** Compactor presentation derived from its cycle clock. Allocation-free. */
export interface PusherPhase {
  warnT: number;
  y: number;
  active: boolean;
  flashT: number;
}

/**
 * The arm's warn timer, leading edge, active flag and stop flash at `t` seconds into
 * its cycle. The host sim and the guest view both read this, so a snapshot only needs
 * the clock.
 */
export function pusherPhaseAt(arena: ArenaDef, t: number, out: PusherPhase): PusherPhase {
  const top = arena.bounds.top;
  out.warnT = 0;
  out.y = top;
  out.active = false;
  out.flashT = 0;
  const cfg = arena.pushers;
  if (!cfg) return out;
  const phase = ((t % cfg.period) + cfg.period) % cfg.period;
  const start = cfg.warn;
  const end = start + cfg.travel;
  const back = end + cfg.retract;
  if (phase < start) out.warnT = start - phase;
  if (phase >= start && phase < end) {
    out.active = true;
    out.y = top + (cfg.stop - top) * ((phase - start) / cfg.travel);
  } else if (phase >= end && phase < back) {
    out.y = cfg.stop + (top - cfg.stop) * ((phase - end) / cfg.retract);
  }
  if (phase >= end && phase < end + 0.3) out.flashT = 0.3 - (phase - end);
  return out;
}

/** Seconds for one dock, extend, out, retract cycle. */
export function usbCycle(usb: ArenaUsbDef): number {
  return usb.holdIn + usb.extend + usb.holdOut + usb.retract;
}

/** Current phase of the hub cycle. Allocation-free. */
export function usbPhaseAt(usb: ArenaUsbDef, t: number): number {
  const cycle = usbCycle(usb);
  const phase = ((t % cycle) + cycle) % cycle;
  if (phase < usb.holdIn) return USB_STATE.docked;
  if (phase < usb.holdIn + usb.extend) return USB_STATE.extend;
  if (phase < usb.holdIn + usb.extend + usb.holdOut) return USB_STATE.out;
  return USB_STATE.retract;
}

/** Distance the drives have travelled away from the hub at `t` seconds. */
export function usbExtensionAt(usb: ArenaUsbDef, t: number): number {
  const cycle = usbCycle(usb);
  const phase = ((t % cycle) + cycle) % cycle;
  const extendStart = usb.holdIn;
  const outStart = extendStart + usb.extend;
  const outEnd = outStart + usb.holdOut;
  if (phase < extendStart) return 0;
  if (phase < outStart) {
    const k = (phase - extendStart) / Math.max(0.001, usb.extend);
    return (k * k * (3 - 2 * k)) * usb.extension;
  }
  if (phase < outEnd) return usb.extension;
  const k = (phase - outEnd) / Math.max(0.001, usb.retract);
  return (1 - k * k * (3 - 2 * k)) * usb.extension;
}

/** +1 while extending, -1 while retracting, 0 while parked. */
export function usbFlowDirAt(usb: ArenaUsbDef, t: number): number {
  const phase = usbPhaseAt(usb, t);
  return phase === USB_STATE.extend ? 1 : phase === USB_STATE.retract ? -1 : 0;
}

/** World centre of a USB hub arena. */
export function usbCenterX(arena: ArenaDef): number {
  return (arena.bounds.left + arena.bounds.right) * 0.5;
}

export function usbCenterY(arena: ArenaDef): number {
  return (arena.bounds.top + arena.bounds.bottom) * 0.5;
}

/** Writes one drive's current world rectangle. Allocation-free. */
export function usbDriveRect(arena: ArenaDef, index: number, t: number, out: Rect): Rect {
  const usb = arena.usb!;
  const drive = usb.drives[index];
  const travel = usbExtensionAt(usb, t);
  const inner = usb.hubRadius - usb.dockOverlap + travel;
  const cx = usbCenterX(arena);
  const cy = usbCenterY(arena);
  const ux = Math.cos(drive.angle);
  const uy = Math.sin(drive.angle);
  if (Math.abs(ux) >= Math.abs(uy)) {
    out.x = cx + (ux >= 0 ? inner : -inner - drive.length);
    out.y = cy - drive.width * 0.5;
    out.w = drive.length;
    out.h = drive.width;
  } else {
    out.x = cx - drive.width * 0.5;
    out.y = cy + (uy >= 0 ? inner : -inner - drive.length);
    out.w = drive.width;
    out.h = drive.length;
  }
  return out;
}

/** True when a world point is on the hub or one of the drives. */
export function usbFloorAt(arena: ArenaDef, x: number, y: number, t: number): boolean {
  const usb = arena.usb;
  if (!usb) return true;
  const dx = x - usbCenterX(arena);
  const dy = y - usbCenterY(arena);
  if (dx * dx + dy * dy <= usb.hubRadius * usb.hubRadius) return true;
  const travel = usbExtensionAt(usb, t);
  const inner = usb.hubRadius - usb.dockOverlap + travel;
  for (let i = 0; i < usb.drives.length; i++) {
    const drive = usb.drives[i];
    const ux = Math.cos(drive.angle);
    const uy = Math.sin(drive.angle);
    const along = dx * ux + dy * uy;
    const lateral = -dx * uy + dy * ux;
    if (along >= inner && along <= inner + drive.length && Math.abs(lateral) <= drive.width * 0.5) {
      return true;
    }
  }
  return false;
}

/**
 * Current vector at a point, or false outside the four drive lanes. The lane starts
 * just inside the hub so a body at the port is caught as the plate leaves.
 */
export function usbFlowAt(
  arena: ArenaDef,
  x: number,
  y: number,
  t: number,
  out: UsbFlowVector,
): boolean {
  const usb = arena.usb;
  if (!usb) return false;
  const dir = usbFlowDirAt(usb, t);
  if (dir === 0) return false;
  const dx = x - usbCenterX(arena);
  const dy = y - usbCenterY(arena);
  const travel = usbExtensionAt(usb, t);
  const inner = usb.hubRadius - usb.dockOverlap + travel;
  for (let i = 0; i < usb.drives.length; i++) {
    const drive = usb.drives[i];
    const ux = Math.cos(drive.angle);
    const uy = Math.sin(drive.angle);
    const along = dx * ux + dy * uy;
    const lateral = -dx * uy + dy * ux;
    if (along < inner - 48 || along > inner + drive.length + 48) continue;
    if (Math.abs(lateral) > drive.width * 0.5 + usb.flowWidth) continue;
    out.x = ux * dir;
    out.y = uy * dir;
    return true;
  }
  return false;
}

/** Which swipe beat is current. Beat 0 is the opening card. */
export function swipeIndexAt(swipe: ArenaSwipeDef, t: number): number {
  return Math.max(0, Math.floor(t / Math.max(0.001, swipe.interval)));
}

/** Seconds into the current swipe interval. */
export function swipePhaseAt(swipe: ArenaSwipeDef, t: number): number {
  const index = swipeIndexAt(swipe, t);
  return Math.max(0, t - index * swipe.interval);
}

/** 0..1 while a swipe is sliding, 0 when parked. */
export function swipeMoveProgressAt(swipe: ArenaSwipeDef, t: number): number {
  const index = swipeIndexAt(swipe, t);
  if (index <= 0) return 0;
  const phase = swipePhaseAt(swipe, t);
  return phase < swipe.travel ? Math.max(0, phase / Math.max(0.001, swipe.travel)) : 0;
}

/** Signed direction of the current swipe beat. Beat 0 is the parked opening card. */
export function swipeDirectionAt(swipe: ArenaSwipeDef, t: number): number {
  const dirs = swipe.directions;
  if (dirs.length === 0) return 1;
  // Beat 1 is the first physical swipe, so it reads the first authored direction.
  const beat = Math.max(0, swipeIndexAt(swipe, t) - 1);
  return dirs[beat % dirs.length] < 0 ? -1 : 1;
}

/** Current profile index, wrapping the authored deck. */
export function swipeProfileIndexAt(swipe: ArenaSwipeDef, t: number): number {
  const n = swipe.profiles.length;
  if (n === 0) return 0;
  return swipeIndexAt(swipe, t) % n;
}

/** Seconds into the popup's independent cycle. */
export function swipePopupPhaseAt(swipe: ArenaSwipeDef, t: number): number {
  return ((t % swipe.popupPeriod) + swipe.popupPeriod) % swipe.popupPeriod;
}

/** Warning strength (1 at the start of the warning, 0 once the platform moves). */
export function swipePopupWarnAt(swipe: ArenaSwipeDef, t: number): number {
  const phase = swipePopupPhaseAt(swipe, t);
  return phase < swipe.popupWarn ? 1 - phase / Math.max(0.001, swipe.popupWarn) : 0;
}

/** 0..1 raised height of the match popup. */
export function swipePopupHeightAt(swipe: ArenaSwipeDef, t: number): number {
  const phase = swipePopupPhaseAt(swipe, t);
  const riseStart = swipe.popupWarn;
  const riseEnd = riseStart + swipe.popupRise;
  const fallStart = riseEnd + swipe.popupHold;
  const fallEnd = fallStart + swipe.popupFall;
  if (phase < riseStart) return 0;
  if (phase < riseEnd) {
    const k = (phase - riseStart) / Math.max(0.001, swipe.popupRise);
    return k * k * (3 - 2 * k);
  }
  if (phase < fallStart) return 1;
  if (phase < fallEnd) {
    const k = (phase - fallStart) / Math.max(0.001, swipe.popupFall);
    return 1 - k * k * (3 - 2 * k);
  }
  return 0;
}

export function swipePopupActiveAt(swipe: ArenaSwipeDef, t: number): boolean {
  return swipePopupHeightAt(swipe, t) > 0.01;
}

export const SATELLITE_SOLAR_STATE = {
  rest: 0,
  warn: 1,
  hot: 2,
} as const;

/** Offset local time of one solar wing. */
export function satelliteSolarPhaseAt(
  sat: ArenaSatelliteDef,
  panel: ArenaSatellitePanelDef,
  t: number,
): number {
  const period = Math.max(0.001, sat.solar.period);
  return (((t + panel.phase) % period) + period) % period;
}

/** 0 rest, 1 warning, 2 hot. */
export function satelliteSolarStateAt(
  sat: ArenaSatelliteDef,
  panel: ArenaSatellitePanelDef,
  t: number,
): number {
  const phase = satelliteSolarPhaseAt(sat, panel, t);
  if (phase < sat.solar.warn) return SATELLITE_SOLAR_STATE.warn;
  if (phase < sat.solar.warn + sat.solar.hot) return SATELLITE_SOLAR_STATE.hot;
  return SATELLITE_SOLAR_STATE.rest;
}

/** 0..1 extension of the bottom telescope mast. */
export function satelliteTelescopeExtensionAt(
  telescope: ArenaSatelliteTelescopeDef,
  t: number,
): number {
  const cycle = telescope.extend + telescope.hold + telescope.retract + telescope.rest;
  let phase = ((t + telescope.phase) % cycle + cycle) % cycle;
  const extendEnd = telescope.extend;
  const holdEnd = extendEnd + telescope.hold;
  const retractEnd = holdEnd + telescope.retract;
  if (phase < extendEnd) {
    const k = phase / Math.max(0.001, telescope.extend);
    return k * k * (3 - 2 * k);
  }
  if (phase < holdEnd) return 1;
  if (phase < retractEnd) {
    const k = (phase - holdEnd) / Math.max(0.001, telescope.retract);
    return 1 - k * k * (3 - 2 * k);
  }
  return 0;
}

/** True when a world point is on the satellite's floor plates. */
export function satelliteFloorAt(arena: ArenaDef, x: number, y: number): boolean {
  const sat = arena.satellite;
  if (!sat) return true;
  for (let i = 0; i < sat.floor.length; i++) {
    const r = sat.floor[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

/** Writes the telescope mast's collision rectangle at `t` into `out`. */
export function satelliteTelescopeRectAt(
  sat: ArenaSatelliteDef,
  t: number,
  out: Rect,
): Rect {
  const ext = satelliteTelescopeExtensionAt(sat.telescope, t);
  const h = ext * sat.telescope.extension;
  out.x = sat.telescope.x;
  out.w = sat.telescope.w;
  out.y = sat.telescope.baseY - h;
  out.h = h;
  return out;
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

  // BUSINESS LAPTOP is a screen chassis; the sheet and chat screens draw their own panes.
  if (arena.laptop) {
    const lap = arena.laptop;
    const screen = lap.screen;
    if (lap.variant === 'sheet' && lap.sheet) {
      const sh = lap.sheet;
      ctx.fillStyle = '#060b0e';
      ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
      ctx.fillStyle = '#0a1a12';
      ctx.fillRect(mapX(screen.x), mapY(screen.y), screen.w * sx, screen.h * sy);
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(mapX(screen.x) + 0.5, mapY(screen.y) + 0.5, screen.w * sx - 1, screen.h * sy - 1);
      ctx.fillStyle = 'rgba(127, 227, 166, 0.3)';
      for (let i = 0; i < sh.cells.length; i++) {
        const cell = sh.cells[i];
        ctx.fillRect(
          mapX(sh.origin.x + cell.col * (sh.cellW + sh.gap)),
          mapY(sh.origin.y + cell.row * (sh.cellH + sh.gap)),
          Math.max(1, sh.cellW * sx),
          Math.max(1, sh.cellH * sy),
        );
      }
      ctx.fillStyle = 'rgba(220, 240, 250, 0.82)';
      ctx.font = '700 6px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPREADSHEET', mapX((bounds.left + bounds.right) * 0.5), mapY(bounds.bottom) - 4);
      return;
    }
    if (lap.variant === 'chat') {
      const bubble = Math.max(0.3, Math.min(1, lap.bubbleW ?? 0.58));
      ctx.fillStyle = '#060b0e';
      ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
      ctx.fillStyle = '#160d14';
      ctx.fillRect(mapX(screen.x), mapY(screen.y), screen.w * sx, screen.h * sy);
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(mapX(screen.x) + 0.5, mapY(screen.y) + 0.5, screen.w * sx - 1, screen.h * sy - 1);
      const bubbleW = Math.max(24, lap.inbox.w * bubble - 20) * sx;
      for (let i = 0; i < lap.cards; i++) {
        const y = laptopCardY(lap, i, 0);
        if (y + lap.cardH < lap.inbox.y || y > lap.inbox.y + lap.inbox.h) continue;
        const right = i % 2 === 0;
        const x = right ? mapX(lap.inbox.x + lap.inbox.w - 10) - bubbleW : mapX(lap.inbox.x + 10);
        ctx.fillStyle = right ? 'rgba(255, 154, 213, 0.3)' : 'rgba(160, 190, 255, 0.24)';
        ctx.fillRect(x, mapY(y), Math.max(1, bubbleW), Math.max(1, lap.cardH * sy));
      }
      ctx.fillStyle = 'rgba(220, 240, 250, 0.82)';
      ctx.font = '700 6px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CHAT', mapX((bounds.left + bounds.right) * 0.5), mapY(bounds.bottom) - 4);
      return;
    }
    ctx.fillStyle = '#060b0e';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.fillStyle = '#0a1218';
    ctx.fillRect(mapX(screen.x), mapY(screen.y), screen.w * sx, screen.h * sy);
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(mapX(screen.x) + 0.5, mapY(screen.y) + 0.5, screen.w * sx - 1, screen.h * sy - 1);
    ctx.fillStyle = '#101d24';
    ctx.fillRect(mapX(lap.inbox.x), mapY(lap.inbox.y), lap.inbox.w * sx, lap.inbox.h * sy);
    ctx.fillRect(mapX(lap.preview.x), mapY(lap.preview.y), lap.preview.w * sx, lap.preview.h * sy);
    ctx.strokeStyle = 'rgba(138, 199, 255, 0.3)';
    ctx.strokeRect(mapX(lap.inbox.x) + 0.5, mapY(lap.inbox.y) + 0.5, lap.inbox.w * sx - 1, lap.inbox.h * sy - 1);
    ctx.strokeRect(mapX(lap.preview.x) + 0.5, mapY(lap.preview.y) + 0.5, lap.preview.w * sx - 1, lap.preview.h * sy - 1);
    for (let i = 0; i < lap.cards; i++) {
      const y = laptopCardY(lap, i, 0);
      if (y + lap.cardH < lap.inbox.y || y > lap.inbox.y + lap.inbox.h) continue;
      ctx.fillStyle = 'rgba(138, 199, 255, 0.32)';
      ctx.fillRect(mapX(lap.inbox.x + 10), mapY(y), (lap.inbox.w - 20) * sx, lap.cardH * sy);
    }
    const layout = lap.messages[0]?.layout ?? [];
    ctx.fillStyle = 'rgba(255, 196, 120, 0.28)';
    for (let i = 0; i < layout.length; i++) {
      const r = layout[i];
      ctx.fillRect(mapX(r.x), mapY(r.y), Math.max(1, r.w * sx), Math.max(1, r.h * sy));
    }
    ctx.fillStyle = 'rgba(220, 240, 250, 0.82)';
    ctx.font = '700 6px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUSINESS LAPTOP', mapX((bounds.left + bounds.right) * 0.5), mapY(bounds.bottom) - 4);
    return;
  }

  // SMART WATCH is a rounded screen with four app cards and a live second hand.
  if (arena.watch) {
    const watch = arena.watch;
    const face = watch.face;
    const fx = mapX(face.x);
    const fy = mapY(face.y);
    const fw = face.w * sx;
    const fh = face.h * sy;
    const cx = mapX(face.x + face.w * 0.5);
    const cy = mapY(face.y + face.h * 0.5);
    ctx.fillStyle = '#080b0d';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.fillStyle = '#111920';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);
    ctx.strokeStyle = 'rgba(255, 141, 92, 0.2)';
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (Math.min(fw, fh) * i) / 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      ctx.fillStyle = '#1a2529';
      ctx.fillRect(mapX(r.x), mapY(r.y), r.w * sx, r.h * sy);
      ctx.strokeStyle = 'rgba(255, 190, 140, 0.35)';
      ctx.strokeRect(mapX(r.x) + 0.5, mapY(r.y) + 0.5, r.w * sx - 1, r.h * sy - 1);
    }
    const angle = -Math.PI * 0.5;
    ctx.strokeStyle = '#ff8d5c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * watch.handLength * Math.min(sx, sy), cy + Math.sin(angle) * watch.handLength * Math.min(sx, sy));
    ctx.stroke();
    ctx.fillStyle = '#ffb18a';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 220, 190, 0.8)';
    ctx.font = '700 6px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('10:09', cx, fy + 22);
    ctx.fillText('SMART WATCH', cx, fy + fh - 10);
    return;
  }

  // SMOKE DETECTOR is a round face with a siren and four sensor pads; the ring
  // preview is enough to read it before the menu card is opened.
  if (arena.smoke) {
    const smoke = arena.smoke;
    const disc = arena.disc;
    const cx = mapX((bounds.left + bounds.right) * 0.5);
    const cy = mapY((bounds.top + bounds.bottom) * 0.5);
    const rr = (disc?.radius ?? 500) * Math.min(sx, sy);
    ctx.fillStyle = '#080c0e';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.fillStyle = '#171d1f';
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let i = 1; i <= 3; i++) {
      ctx.strokeStyle = `rgba(255, 106, 94, ${0.12 * i})`;
      ctx.beginPath();
      ctx.arc(cx, cy, rr * (0.28 + i * 0.17), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < smoke.sensors.length; i++) {
      const s = smoke.sensors[i];
      ctx.fillStyle = '#0c1612';
      ctx.beginPath();
      ctx.arc(mapX(s.x), mapY(s.y), Math.max(2, s.radius * Math.min(sx, sy)), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff6a5e';
      ctx.stroke();
      ctx.fillStyle = '#ffb0a0';
      ctx.beginPath();
      ctx.arc(mapX(s.x), mapY(s.y), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff6a5e';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(3, 38 * Math.min(sx, sy)), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#162023';
    ctx.fillRect(mapX(smoke.battery.x), mapY(smoke.battery.y), smoke.battery.w * sx, smoke.battery.h * sy);
    ctx.strokeStyle = '#ffd08a';
    ctx.strokeRect(mapX(smoke.battery.x) + 0.5, mapY(smoke.battery.y) + 0.5, smoke.battery.w * sx - 1, smoke.battery.h * sy - 1);
    ctx.fillStyle = 'rgba(255, 220, 190, 0.8)';
    ctx.font = '700 6px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SMOKE // ALARM', cx, cy + rr + 8);
    return;
  }

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

  if (arena.satellite) {
    const sat = arena.satellite;
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    for (let i = 0; i < sat.floor.length; i++) {
      const r = sat.floor[i];
      ctx.fillStyle = i === 0 ? '#18212c' : '#0d2430';
      ctx.fillRect(mapX(r.x), mapY(r.y), Math.max(1, r.w * sx), Math.max(1, r.h * sy));
      ctx.strokeRect(mapX(r.x) + 0.5, mapY(r.y) + 0.5, Math.max(1, r.w * sx) - 1, Math.max(1, r.h * sy) - 1);
    }
    for (let i = 0; i < sat.panels.length; i++) {
      const p = sat.panels[i];
      ctx.fillStyle = 'rgba(72, 183, 255, 0.5)';
      ctx.fillRect(mapX(p.x + 8), mapY(p.y + 8), Math.max(1, (p.w - 16) * sx), Math.max(1, (p.h - 16) * sy));
      ctx.strokeStyle = arena.accent;
      ctx.strokeRect(mapX(p.x) + 0.5, mapY(p.y) + 0.5, Math.max(1, p.w * sx) - 1, Math.max(1, p.h * sy) - 1);
    }
    const tel = sat.telescope;
    ctx.fillStyle = '#ffd08a';
    ctx.fillRect(mapX(tel.x), mapY(tel.baseY - tel.extension), Math.max(2, tel.w * sx), Math.max(2, tel.extension * sy));
    for (let i = 0; i < (arena.props?.length ?? 0); i++) {
      const p = arena.props![i];
      ctx.fillStyle = p.capacitor ? '#ff8b4d' : '#ffd06a';
      ctx.fillRect(mapX(p.x), mapY(p.y), Math.max(1, p.w * sx), Math.max(1, p.h * sy));
    }
    return;
  }

  if (arena.rocket) {
    const rocket = arena.rocket;
    ctx.fillStyle = '#06141a';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX(bounds.left) + 0.5, mapY(bounds.top) + 0.5, previewW - 1, previewH - 1);
    const p = { x: 0, y: 0 };
    ctx.strokeStyle = 'rgba(124, 247, 204, 0.24)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      rocketArcAt(rocket, i / 24, p);
      if (i === 0) ctx.moveTo(mapX(p.x), mapY(p.y));
      else ctx.lineTo(mapX(p.x), mapY(p.y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const previewProgress = 0.62;
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      rocketArcAt(rocket, (i / 28) * previewProgress, p);
      if (i === 0) ctx.moveTo(mapX(p.x), mapY(p.y));
      else ctx.lineTo(mapX(p.x), mapY(p.y));
    }
    ctx.stroke();
    rocketArcAt(rocket, previewProgress, p);
    ctx.fillStyle = '#e7ffff';
    ctx.beginPath();
    ctx.arc(mapX(p.x), mapY(p.y), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = arena.accent;
    for (let i = 0; i < rocket.stages.length; i++) {
      if (previewProgress < rocket.stages[i].at) continue;
      rocketArcAt(rocket, rocket.stages[i].at, p);
      ctx.fillRect(mapX(p.x) - 2, mapY(p.y) - 2, 4, 4);
    }
    return;
  }

  if (arena.weapon) {
    const weapon = arena.weapon;
    ctx.fillStyle = '#160c0d';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX(bounds.left) + 0.5, mapY(bounds.top) + 0.5, previewW - 1, previewH - 1);
    const jet = weapon.jet;
    const jetCy = jet.y + jet.h * 0.48;
    for (let i = 0; i < FIGHTER_SIDE.length; i++) {
      const shape = FIGHTER_SIDE[i];
      ctx.beginPath();
      for (let p = 0; p < shape.points.length; p++) {
        const px = mapX(jet.x + shape.points[p][0] * jet.w);
        const py = mapY(jetCy + shape.points[p][1] * jet.h);
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      if (shape.closed) ctx.closePath();
      ctx.fillStyle = shape.name === 'canopy' ? 'rgba(120, 230, 250, 0.4)' : 'rgba(255, 160, 135, 0.24)';
      ctx.fill();
      if (shape.name === 'fuselage' || shape.name === 'fin' || shape.name === 'canopy') {
        ctx.strokeStyle = arena.accent;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    const colors = ['#ff5c4e', '#ffc857', '#63dcff'];
    for (let i = 0; i < weapon.buttons.length; i++) {
      const button = weapon.buttons[i];
      ctx.fillStyle = 'rgba(28, 10, 12, 0.92)';
      ctx.fillRect(mapX(button.x), mapY(button.y), button.w * sx, button.h * sy);
      ctx.strokeStyle = colors[button.kind];
      ctx.strokeRect(mapX(button.x) + 0.5, mapY(button.y) + 0.5, button.w * sx - 1, button.h * sy - 1);
      ctx.fillStyle = colors[button.kind];
      ctx.font = '700 7px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(button.kind === 0 ? 'FIRE' : button.kind === 1 ? 'EJECT' : 'THRUST', mapX(button.x + button.w * 0.5), mapY(button.y + button.h * 0.55));
    }
    return;
  }

  if (arena.car) {
    const car = arena.car;
    ctx.fillStyle = '#06151e';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX(bounds.left) + 0.5, mapY(bounds.top) + 0.5, previewW - 1, previewH - 1);
    ctx.strokeStyle = 'rgba(98, 217, 255, 0.12)';
    for (let x = bounds.left + 90; x < bounds.right; x += 90) {
      ctx.beginPath();
      ctx.moveTo(mapX(x), mapY(bounds.top));
      ctx.lineTo(mapX(x), mapY(bounds.bottom));
      ctx.stroke();
    }
    for (let y = bounds.top + 90; y < bounds.bottom; y += 90) {
      ctx.beginPath();
      ctx.moveTo(mapX(bounds.left), mapY(y));
      ctx.lineTo(mapX(bounds.right), mapY(y));
      ctx.stroke();
    }
    const p = { x: 0, y: 0 };
    ctx.strokeStyle = 'rgba(98, 217, 255, 0.26)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      carRouteAt(car, i / 32, p);
      if (i === 0) ctx.moveTo(mapX(p.x), mapY(p.y));
      else ctx.lineTo(mapX(p.x), mapY(p.y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const previewProgress = 0.58;
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      carRouteAt(car, (i / 36) * previewProgress, p);
      if (i === 0) ctx.moveTo(mapX(p.x), mapY(p.y));
      else ctx.lineTo(mapX(p.x), mapY(p.y));
    }
    ctx.stroke();
    carRouteAt(car, previewProgress, p);
    ctx.fillStyle = '#ffe38a';
    ctx.fillRect(mapX(p.x) - 3, mapY(p.y) - 2, 6, 4);
    for (let i = 0; i < car.stops.length; i++) {
      carRouteAt(car, car.stops[i].at, p);
      ctx.fillStyle = arena.accent;
      ctx.beginPath();
      ctx.arc(mapX(p.x), mapY(p.y), 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (arena.plug) {
    const plug = arena.plug;
    ctx.fillStyle = '#04100a';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.strokeStyle = 'rgba(109, 255, 168, 0.08)';
    ctx.lineWidth = 1;
    for (let x = bounds.left + 70; x < bounds.right; x += 90) {
      ctx.beginPath();
      ctx.moveTo(mapX(x), mapY(bounds.top));
      ctx.lineTo(mapX(x), mapY(bounds.bottom));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 74, 74, 0.72)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < plug.arcs.length; i++) {
      const arc = plug.arcs[i];
      ctx.beginPath();
      ctx.moveTo(mapX(arc.ax), mapY(arc.ay));
      ctx.lineTo(mapX(arc.bx), mapY(arc.by));
      ctx.stroke();
      ctx.fillStyle = '#ff8b7a';
      ctx.fillRect(mapX(arc.ax) - 2, mapY(arc.ay) - 2, 4, 4);
      ctx.fillRect(mapX(arc.bx) - 2, mapY(arc.by) - 2, 4, 4);
    }
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      ctx.fillStyle = '#101c16';
      ctx.fillRect(mapX(r.x), mapY(r.y), r.w * sx, r.h * sy);
      ctx.strokeStyle = 'rgba(178, 255, 207, 0.34)';
      ctx.strokeRect(mapX(r.x) + 0.5, mapY(r.y) + 0.5, r.w * sx - 1, r.h * sy - 1);
      ctx.fillStyle = '#ff5b52';
      ctx.beginPath();
      ctx.arc(mapX(r.x + r.w - 22), mapY(r.y + 22), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(207, 255, 224, 0.66)';
    ctx.font = '700 6px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GREEN = SAFE // RED = LIVE', mapX((bounds.left + bounds.right) * 0.5), mapY(bounds.bottom - 18));
    return;
  }

  if (arena.pong) {
    const pong = arena.pong;
    const court = pong.court;
    const cx = mapX(court.x);
    const cy = mapY(court.y);
    const cw = court.w * sx;
    const ch = court.h * sy;
    ctx.fillStyle = '#020a05';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.fillStyle = '#04170c';
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(cx + cw * 0.5, cy + 4);
    ctx.lineTo(cx + cw * 0.5, cy + ch - 4);
    ctx.stroke();
    ctx.setLineDash([]);
    const paddleW = Math.max(2, pong.paddleW * sx);
    const paddleH = Math.max(5, pong.paddleH * sy);
    const leftX = cx + pong.paddleInset * sx;
    const rightX = cx + cw - pong.paddleInset * sx;
    ctx.fillStyle = arena.accent;
    ctx.fillRect(leftX - paddleW * 0.5, cy + ch * 0.28, paddleW, paddleH);
    ctx.fillRect(rightX - paddleW * 0.5, cy + ch * 0.62, paddleW, paddleH);
    ctx.fillRect(cx + cw * 0.47, cy + ch * 0.47, 3, 3);
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('3', cx + cw * 0.28, cy + 12);
    ctx.fillText('5', cx + cw * 0.72, cy + 12);
    return;
  }

  if (arena.flip) {
    const flip = arena.flip;
    const board = flip.board;
    const bx = mapX(board.x);
    const by = mapY(board.y);
    const bw = board.w * sx;
    const bh = board.h * sy;
    ctx.fillStyle = '#0c1018';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.fillStyle = '#151b27';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = 'rgba(255, 200, 87, 0.24)';
    ctx.fillRect(bx + 3, by + 3, bw - 6, 10);
    for (let i = 0; i < flip.rows.length; i++) {
      const rowY = by + (flip.headerH + i * flip.rowH) * sy;
      ctx.fillStyle = '#0a0e15';
      ctx.fillRect(bx + 5, rowY + 2, Math.max(20, flip.timeW * sx), Math.max(4, flip.timeH * sy));
      ctx.fillStyle = i < 3 ? '#ffc857' : '#ff9d6a';
      ctx.fillRect(bx + 5, rowY + 2, Math.max(20, flip.timeW * sx), 2);
      ctx.fillStyle = 'rgba(255, 234, 184, 0.55)';
      ctx.fillRect(bx + flip.timeW * sx + 14, rowY + 5, bw * 0.34, 2);
      ctx.fillRect(bx + flip.timeW * sx + 14, rowY + 10, bw * 0.22, 2);
    }
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      ctx.fillStyle = '#2a2119';
      ctx.fillRect(mapX(r.x), mapY(r.y), r.w * sx, r.h * sy);
      ctx.strokeStyle = 'rgba(255, 200, 87, 0.35)';
      ctx.strokeRect(mapX(r.x) + 0.5, mapY(r.y) + 0.5, r.w * sx - 1, r.h * sy - 1);
    }
    return;
  }

  if (arena.invaders) {
    const inv = arena.invaders;
    const fleet = inv.fleet;
    ctx.fillStyle = '#02050a';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.fillStyle = 'rgba(131, 255, 155, 0.32)';
    for (let r = 0; r < inv.rows; r++) {
      for (let c = 0; c < inv.cols; c++) {
        const x = fleet.x + 34 + (c / Math.max(1, inv.cols - 1)) * (fleet.w - 68);
        const y = fleet.y + 34 + (r / Math.max(1, inv.rows - 1)) * (fleet.h - 68);
        ctx.fillRect(mapX(x), mapY(y), 3, 2);
        ctx.fillRect(mapX(x) + 2, mapY(y) + 2, 2, 2);
      }
    }
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      ctx.fillStyle = '#317d45';
      ctx.fillRect(mapX(r.x), mapY(r.y), r.w * sx, Math.max(2, r.h * sy));
    }
    const cannonX = mapX(inv.cannon.x);
    const cannonY = mapY(inv.cannon.y);
    ctx.fillStyle = '#eaffef';
    ctx.fillRect(cannonX - 3, cannonY - 3, 6, 4);
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cannonX, cannonY - 5);
    ctx.lineTo(cannonX, mapY(fleet.y + fleet.h));
    ctx.stroke();
    return;
  }

  if (arena.seek) {
    const seek = arena.seek;
    ctx.fillStyle = '#21121d';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX(bounds.left) + 0.5, mapY(bounds.top) + 0.5, previewW - 1, previewH - 1);
    const display = seek.display;
    ctx.fillStyle = '#071418';
    ctx.fillRect(mapX(display.x), mapY(display.y), display.w * sx, display.h * sy);
    ctx.strokeStyle = '#ffb84d';
    ctx.strokeRect(mapX(display.x) + 0.5, mapY(display.y) + 0.5, display.w * sx - 1, display.h * sy - 1);
    ctx.fillStyle = '#fff2c7';
    ctx.font = '700 7px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(seek.prompts[0]?.text ?? 'FIND', mapX(display.x + display.w * 0.5), mapY(display.y + display.h * 0.58));
    for (let i = 0; i < seek.cards.length; i++) {
      const card = seek.cards[i];
      ctx.fillStyle = '#111a20';
      ctx.fillRect(mapX(card.x), mapY(card.y), card.w * sx, card.h * sy);
      ctx.strokeStyle = card.color;
      ctx.lineWidth = i === 0 ? 1.5 : 1;
      ctx.strokeRect(mapX(card.x) + 0.5, mapY(card.y) + 0.5, card.w * sx - 1, card.h * sy - 1);
      ctx.fillStyle = card.color;
      ctx.font = '7px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      ctx.fillText(card.mark, mapX(card.x + card.w * 0.5), mapY(card.y + card.h * 0.72));
    }
    for (let i = 0; i < arena.pillars.length; i++) {
      const rect = arena.pillars[i];
      ctx.fillStyle = '#ffcf5a';
      ctx.fillRect(mapX(rect.x), mapY(rect.y), rect.w * sx, rect.h * sy);
      ctx.strokeStyle = '#ffe9a8';
      ctx.strokeRect(mapX(rect.x) + 0.5, mapY(rect.y) + 0.5, rect.w * sx - 1, rect.h * sy - 1);
    }
    return;
  }

  if (arena.swipe) {
    const swipe = arena.swipe;
    const cardX = mapX(bounds.left + (bounds.right - bounds.left) * 0.08);
    const cardY = mapY(bounds.top + (bounds.bottom - bounds.top) * 0.18);
    const cardW = Math.max(18, previewW * 0.84);
    const cardH = Math.max(28, previewH * 0.58);
    ctx.fillStyle = '#070910';
    ctx.fillRect(mapX(bounds.left), mapY(bounds.top), previewW, previewH);
    ctx.strokeStyle = swipe.profiles[0]?.color ?? arena.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mapX(bounds.left) + 1, mapY(bounds.top) + 1, previewW - 2, previewH - 2);
    ctx.fillStyle = '#151a24';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1);
    ctx.font = '700 22px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f7e9f2';
    ctx.fillText(swipe.profiles[0]?.emoji ?? '♥', cardX + cardW * 0.5, cardY + cardH * 0.42);
    ctx.fillStyle = arena.accent;
    ctx.fillRect(cardX + 8, cardY + cardH - 10, cardW - 16, 2);
    const pop = swipe.popup;
    ctx.fillStyle = 'rgba(255, 79, 139, 0.22)';
    ctx.fillRect(mapX(pop.x), mapY(pop.y), pop.w * sx, pop.h * sy);
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mapX(pop.x) + 0.5, mapY(pop.y) + 0.5, pop.w * sx - 1, pop.h * sy - 1);
    ctx.fillStyle = '#f7e9f2';
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.fillText("IT'S A MATCH", mapX(pop.x + pop.w * 0.5), mapY(pop.y + pop.h * 0.5));
    return;
  }

  if (arena.usb) {
    const usb = arena.usb;
    const cx = mapX((bounds.left + bounds.right) * 0.5);
    const cy = mapY((bounds.top + bounds.bottom) * 0.5);
    const rr = usb.hubRadius * Math.min(sx, sy);
    ctx.fillStyle = '#08131d';
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    ctx.stroke();
    const outT = usb.holdIn + usb.extend + usb.holdOut * 0.5;
    const r = { x: 0, y: 0, w: 0, h: 0 };
    for (let i = 0; i < usb.drives.length; i++) {
      usbDriveRect(arena, i, outT, r);
      const x = mapX(r.x);
      const y = mapY(r.y);
      const w = Math.max(2, r.w * sx);
      const h = Math.max(2, r.h * sy);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(103, 232, 255, 0.28)' : 'rgba(103, 232, 255, 0.2)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = arena.accent;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
    ctx.fillStyle = arena.accent;
    for (let i = 0; i < usb.drives.length; i++) {
      usbDriveRect(arena, i, outT, r);
      const x = mapX(r.x + r.w * 0.5);
      const y = mapY(r.y + r.h * 0.5);
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
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

  // Tutorial rooms are their own floor plates. The chasms and bridges drawn below cut
  // between them, so the picker shows the same three-room route as the arena.
  if (arena.rooms) {
    for (let i = 0; i < arena.rooms.length; i++) {
      const room = arena.rooms[i];
      const theme = ROOM_THEME_COLORS[room.theme];
      const rx = (room.w * sx) * 0.5;
      const ry = (room.h * sy) * 0.5;
      const cx = mapX(room.x + room.w * 0.5);
      const cy = mapY(room.y + room.h * 0.5);
      ctx.fillStyle = theme.floor;
      ctx.strokeStyle = theme.accent;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (room.shape === 'circle') ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
      else ctx.rect(cx - rx, cy - ry, Math.max(2, rx * 2), Math.max(2, ry * 2));
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Island decks read as lighter plates in the picker, so the route is visible.
  if (arena.bridges) {
    ctx.fillStyle = 'rgba(190, 235, 220, 0.42)';
    for (let i = 0; i < arena.bridges.length; i++) {
      const b = arena.bridges[i];
      ctx.fillRect(mapX(b.x), mapY(b.y), Math.max(1, b.w * sx), Math.max(1, b.h * sy));
    }
  }

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

  // Round furniture reads at thumbnail size as bright pips.
  if (arena.bumpers) {
    for (let i = 0; i < arena.bumpers.length; i++) {
      const b = arena.bumpers[i];
      ctx.beginPath();
      ctx.arc(mapX(b.x), mapY(b.y), Math.max(1.5, b.radius * Math.min(sx, sy)), 0, Math.PI * 2);
      ctx.fillStyle = b.kind === 1 ? arena.accent : 'rgba(170, 220, 255, 0.75)';
      ctx.fill();
    }
  }

  // The uplink port is a bright pip on the last room's wall.
  if (arena.port) {
    ctx.strokeStyle = '#66c8ff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(mapX(arena.port.x), mapY(arena.port.y), 3.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // The phone pad is its own silhouette, even in a tiny picker preview.
  if (arena.keypad) {
    const kp = arena.keypad;
    ctx.fillStyle = 'rgba(12, 17, 17, 0.92)';
    ctx.fillRect(mapX(kp.x), mapY(kp.y), kp.w * sx, kp.h * sy);
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX(kp.x) + 0.5, mapY(kp.y) + 0.5, kp.w * sx - 1, kp.h * sy - 1);
    for (let i = 0; i < kp.keys.length; i++) {
      const k = kp.keys[i];
      ctx.fillStyle = i % 3 === 1 ? 'rgba(255, 207, 92, 0.3)' : 'rgba(255, 207, 92, 0.16)';
      ctx.fillRect(mapX(k.x), mapY(k.y), Math.max(1, k.w * sx), Math.max(1, k.h * sy));
    }
  }

  // The fax is a pale sheet crossed by a moving vertical print bar.
  if (arena.fax) {
    const f = arena.fax;
    ctx.fillStyle = 'rgba(222, 232, 238, 0.18)';
    ctx.fillRect(mapX(f.x), mapY(f.y), f.w * sx, f.h * sy);
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX(f.x) + 0.5, mapY(f.y) + 0.5, f.w * sx - 1, f.h * sy - 1);
    ctx.fillStyle = 'rgba(222, 232, 238, 0.48)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(mapX(f.x) + 5, mapY(f.y) + 8 + i * 9, Math.max(4, (f.w * sx) * 0.46), 1);
    }
    const headX = mapX(f.x + f.w * 0.58);
    ctx.strokeStyle = '#ff9a58';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headX, mapY(f.y));
    ctx.lineTo(headX, mapY(f.y + f.h));
    ctx.stroke();
    ctx.fillStyle = '#2a2119';
    ctx.fillRect(headX - 4, mapY(f.y) - 3, 8, 3);
    ctx.fillRect(headX - 4, mapY(f.y + f.h), 8, 3);
    return;
  }

  // The scanner is a pale sheet with a hot read line even at thumbnail size.
  if (arena.scanner) {
    const s = arena.scanner;
    ctx.fillStyle = 'rgba(222, 232, 238, 0.18)';
    ctx.fillRect(mapX(s.x), mapY(s.y), s.w * sx, s.h * sy);
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX(s.x) + 0.5, mapY(s.y) + 0.5, s.w * sx - 1, s.h * sy - 1);
    ctx.fillStyle = 'rgba(222, 232, 238, 0.48)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(mapX(s.x) + 5, mapY(s.y) + 8 + i * 9, Math.max(4, (s.w * sx) * 0.46), 1);
    }
    ctx.strokeStyle = '#ff6a4d';
    ctx.beginPath();
    ctx.moveTo(mapX(s.x), mapY(s.y) + s.h * sy * 0.42);
    ctx.lineTo(mapX(s.x) + s.w * sx, mapY(s.y) + s.h * sy * 0.42);
    ctx.stroke();
  }

  // Browser chrome and forum cards read as a window even at thumbnail size.
  if (arena.browser) {
    const br = arena.browser;
    ctx.fillStyle = 'rgba(89, 216, 255, 0.16)';
    ctx.fillRect(mapX(br.chrome.x), mapY(br.chrome.y), br.chrome.w * sx, br.chrome.h * sy);
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mapX(br.chrome.x) + 0.5,
      mapY(br.chrome.y) + 0.5,
      br.chrome.w * sx - 1,
      br.chrome.h * sy - 1,
    );
    ctx.fillStyle = 'rgba(89, 216, 255, 0.42)';
    for (let i = 0; i < br.tabs.length; i++) {
      ctx.fillRect(mapX(br.chrome.x) + 5 + i * 13, mapY(br.chrome.y) + 4, 9, 3);
    }
    ctx.strokeStyle = arena.accent;
    ctx.beginPath();
    ctx.moveTo(mapX(br.chrome.x) + 5, mapY(br.chrome.y) + 11);
    ctx.lineTo(mapX(br.chrome.x + br.chrome.w) - 5, mapY(br.chrome.y) + 11);
    ctx.stroke();
    const first = br.pages[0];
    if (first) {
      ctx.fillStyle = 'rgba(89, 216, 255, 0.2)';
      for (let i = 0; i < first.elements.length; i++) {
        const p = first.elements[i];
        ctx.fillRect(mapX(p.x), mapY(p.y), Math.max(1, p.w * sx), Math.max(1, p.h * sy));
      }
    }
  }

  // Feed pipes and the firewall starter are the arena's readable fixtures.
  if (arena.pipes) {
    ctx.strokeStyle = arena.accent;
    ctx.fillStyle = arena.accent;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < arena.pipes.length; i++) {
      const p = arena.pipes[i];
      const px = mapX(p.x);
      const py = mapY(p.y);
      ctx.beginPath();
      ctx.moveTo(px - Math.cos(p.angle) * 7, py - Math.sin(p.angle) * 7);
      ctx.lineTo(px, py);
      ctx.stroke();
      if (p.feed === 'pinball') {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(mapX(bounds.right - 22), py);
        ctx.lineTo(mapX(bounds.right - 22), mapY(bounds.top + 150));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (arena.firewallSwitch) {
    ctx.strokeStyle = '#ff6a4d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mapX(arena.firewallSwitch.x), mapY(arena.firewallSwitch.y), 3.2, 0, Math.PI * 2);
    ctx.stroke();
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

