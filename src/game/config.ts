/**
 * Every tunable gameplay number lives here. See AGENTS.md §6.
 * Units are virtual pixels (1280x720 space) and seconds unless noted.
 */

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const ARENA = {
  left: 48,
  right: 1232,
  top: 48,
  bottom: 672,
};

export const MAX_PLAYERS = 8;
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
export const MAX_PROJECTILES = 96;
export const MAX_EVENTS = 64;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const PLAYER = {
  /** Bigger avatars make the code-symbol core and rotating health ring readable. */
  radius: 20,
  speed: 248,
  /** Velocity smoothing rate. Higher = snappier. */
  accel: 20,
  swingSlow: 0.55,
  whiffSlow: 0.5,
  /** Three segments of the avatar ring. One segment goes dark per hit. */
  hp: 3,
  energyMax: 100,
  energyRegen: 15,
  dashSpeed: 1200,
  dashTime: 0.15,
  dashIframes: 0.1,
  dashCooldown: 1.8,
  /** One tick of anticipation; the hitbox is live on the next fixed step. */
  swingStartup: 0.006,
  swingActive: 0.09,
  swingWhiffRecovery: 0.18,
  swingHitRecovery: 0.08,
  /** Half of a 120 degree sector. */
  swingHalfAngle: Math.PI / 3,
  /** Keep the deflect band tight around the avatar, not out at arm's length. */
  swingReach: 52,
  /** The deflect swing also punches anything hostile inside this close arc. */
  punchReach: 72,
  punchDamage: 1,
  punchKnockback: 560,
  /** Hold the deflect button this long, then release, to fire the forward shield wave. */
  waveHoldTime: 0.3,
  waveRange: 160,
  waveHalfWidth: 48,
  waveDamage: 1,
  waveKnockback: 900,
  waveLunge: 260,
  waveVisualTime: 0.2,
  waveCooldown: 0.45,
  /** Taps inside this window chain left -> right -> forward wave. */
  comboWindow: 0.62,
  /** Lock-on reticle: candidate is transparent, then becomes solid after this hold. */
  lockRange: 1000,
  lockAcquire: 0.12,
  /** Hold the strong-attack button to charge the beam. Release before this cancels. */
  laserChargeTime: 0.9,
  /** Release sooner than this and the press uses the player's random bug instead of the beam. */
  heavyTapMax: 0.16,
  laserDuration: 3,
  /** Cooldown begins when the beam ends, not when it starts. */
  laserCooldown: 5,
  laserCost: 60,
  laserDamage: 1,
  laserTick: 0.5,
  /** Half-width of the beam for collision; the drawn glow is wider. */
  laserHalfWidth: 12,
  /** Radians per second while the beam is live. Sweeping is possible, but deliberate. */
  laserTurnRate: 0.55,
  laserRange: 3000,
  laserKnockback: 120,
  /** Hold dash after the normal dodge to build the triangle charge. */
  dashChargeTime: 0.45,
  chargeDashTime: 0.3,
  chargeDashSpeed: 1120,
  chargeDashDamage: 1,
  chargeDashKnockback: 900,
  chargeDashHitRadius: 36,
  chargeDashIframes: 0.34,
  chargeDashCooldown: 0.8,
  /** A thrall's melee hit is deliberately heavy: being caught should read instantly. */
  thrallSwingKnockback: 800,
  knockDrag: 7,
  hitFlash: 0.18,
} as const;

/** Fast close-range burst bolt. Three quick shots, then a short recharge. */
export const BOLT = {
  radius: 7,
  speed: 860,
  cost: 15,
  damage: 1,
  maxBounces: 1,
  ttl: 0.45,
  burstCount: 3,
  burstCooldown: 0.45,
  deflectMult: 1.4,
  maxSpeed: 2800,
  spawnOffset: 26,
  knockback: 680,
} as const;

/**
 * Timed proximity mine. The old heavy bomb was replaced after the designer called it
 * overpowered: the mine cannot be thrown across the map, must be armed, and gives
 * opponents time to read and avoid it.
 */
export const MINE = {
  radius: 9,
  cost: 35,
  /** Seconds before the trigger goes live. */
  armTime: 0.55,
  /** Maximum armed lifetime before it self-detonates. */
  life: 2.8,
  triggerRadius: 58,
  blastRadius: 105,
  blastDamage: 1,
  knockback: 760,
} as const;

/**
 * Random per-player "bug" skill on the strong-attack tap. Hold still charges the laser.
 * Kind order: 0 mine, 1 trap, 2 wall shield, 3 ghost.
 */
export const BUG = {
  cost: 35,
  cooldown: [4.5, 5, 7, 8],
  trapRadius: 62,
  trapDuration: 2.2,
  trapSlow: 0.42,
  wallDuration: 2.8,
  wallLength: 62,
  wallOffset: 34,
  wallThickness: 7,
  ghostDuration: 2.4,
} as const;

export const ROUND = {
  winsNeeded: 3,
  countdown: 1.8,
  roundEndHold: 2.4,
  timeLimit: 90,
} as const;

export const TRAINING = {
  droneHp: 4,
  droneRadius: 18,
  droneSpeed: 58,
  droneFireMin: 2.1,
  droneFireMax: 3.4,
  droneBoltSpeed: 520,
  droneBoltTtl: 4.5,
  droneRespawn: 2.2,
  playerRespawn: 1.6,
} as const;

export const GAUNTLET = {
  playerRespawn: 1.3,
  /** Seconds per escalation wave. Every wave spawns threats sooner. */
  waveDuration: 30,
  /** Seconds shaved off each threat interval per wave. */
  waveSpawnRamp: 1.4,
  /** Floor so late waves stay playable rather than a solid wall of threats. */
  waveMinInterval: 5.5,
  wormSpawnDelay: 2.5,
  wormInterval: 15,
  maxWorms: 3,
  virusSpawnDelay: 4.5,
  virusInterval: 12,
  virusCluster: 6,
  maxViruses: 16,
  firewallSpawnDelay: 8,
  firewallInterval: 14,
  maxFirewalls: 3,
  infectionPerTouch: 0.08,
  infectionDecay: 0.015,
  /** Meter value after a thrall spawns, so the next copy is not instant. */
  infectionReset: 0.3,
  /** Retry delay when every virus is dead and a new cluster is due. */
  virusRetry: 3,
} as const;

/** Segmented red worm. It phases through cover, eats projectiles and viruses. */
export const WORM = {
  speed: 78,
  turnRate: 2.1,
  headRadius: 16,
  segmentRadius: 10,
  segments: 7,
  maxSegments: 12,
  spacing: 15,
  hp: 8,
  touchDamage: 1,
  touchCooldown: 0.8,
  knockback: 720,
  knockDrag: 7,
  infectedSpeedMult: 1.35,
  growthPerProjectile: 1,
  growthPerVirus: 2,
  healPerMeal: 0.5,
  seekWobbleAmp: 0.38,
  seekWobbleFreq: 2.2,
  followRate: 16,
  wallPad: 4,
} as const;

/** Floating diamond swarm that replicates and infects what it touches. */
export const VIRUS = {
  radius: 10,
  speed: 96,
  accel: 4,
  hp: 2,
  contactCooldown: 0.9,
  knockDrag: 9,
  splitInterval: 9,
  orbit: 110,
  separation: 32,
  targetWormBias: 0.7,
  orbitBand: 54,
  orbitRadial: 0.009,
  separationPush: 1.5,
  wobbleAmp: 0.18,
  wobbleFreqX: 2.7,
  wobbleFreqY: 2.3,
  clusterRadiusMin: 18,
  clusterRadiusMax: 62,
  clusterAngleJitter: 0.35,
  splitOffset: 18,
} as const;

/** Cascading Error: a spreading field of yellow/red blocks in the gauntlet. */
export const CASCADING_ERROR = {
  spawnDelay: 11,
  /** Delay after the last block dies before a new root can appear. */
  reseedDelay: 16,
  growthInterval: 1.4,
  blockSize: 30,
  cell: 36,
  maxBlocks: 28,
  /** Four fast bolts, or four mine blasts, to clear one block. */
  hp: 4,
  growTime: 0.3,
  touchDamage: 1,
  touchCooldown: 0.9,
  knockback: 620,
  seedJitter: 90,
} as const;

/** Virus-owned copy of the local player. Steering numbers for its InputFrame controller. */
export const THRALL = {
  spawnOffset: 150,
  spawnIframes: 1.1,
  spawnShootDelay: 0.6,
  spawnSwingDelay: 0.4,
  spawnDashDelay: 1.4,
  moveSpeed: 0.92,
  closeRange: 60,
  closeSpeed: 0.25,
  strafeRangeMin: 130,
  strafeRangeMax: 380,
  strafeAmount: 0.65,
  orbitRate: 1.7,
  orbitPhase: 1.3,
  swingRange: 86,
  swingCooldown: 0.65,
  candleRangeMin: 120,
  candleRangeMax: 300,
  candleCooldown: 2.6,
  boltRangeMin: 120,
  boltRangeMax: 340,
  boltCooldown: 0.85,
  dashRange: 340,
  dashCooldown: 2.2,
} as const;

/** Sweeping line beam. Pillars cut its damage and its visible line. */
export const FIREWALL = {
  width: 22,
  speed: 72,
  warn: 1.3,
  tick: 0.45,
  damage: 1,
  knockback: 780,
} as const;

export const NET = {
  snapshotHz: 30,
  interpDelay: 0.065,
  inputTimeout: 0.6,
  roomPrefix: 'defl-arena-v1-',
  roomCodeLength: 4,
  /** Send a guest input packet every fixed step. */
  inputHz: 60,
  lobbyBroadcastMs: 250,
} as const;

export const TRAIL_LEN = 12;

export const COLORS = {
  bg: '#05070c',
  grid: 'rgba(52, 132, 164, 0.13)',
  frame: '#1c8ea6',
  frameSoft: 'rgba(38, 166, 190, 0.28)',
  pillarFill: '#08121d',
  pillarEdge: 'rgba(74, 210, 232, 0.55)',
  text: '#d7f6ff',
  textDim: 'rgba(160, 220, 235, 0.55)',
  danger: '#ff5a3c',
  neutral: '#bfe9ff',
  white: '#ffffff',
} as const;
