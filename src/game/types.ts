import type { Rect } from './config';

export type Phase = 'countdown' | 'live' | 'roundover' | 'matchend' | 'practice';
export type GameMode = 'match' | 'training' | 'gauntlet';

export interface InputFrame {
  /** Movement / facing vector, magnitude <= 1. */
  mx: number;
  my: number;
  /** Action bits currently down. */
  held: number;
  /** Action bits pressed since the last simulation step. Consumed by World.step. */
  pressed: number;
}

/** Action bits shared by local input, network packets and world logic. */
export const ACTION = {
  SWING: 1,
  BOLT: 2,
  CANDLE: 4,
  DASH: 8,
  LOCK: 16,
} as const;

/** Player snapshot flags. Keep in sync with net.ts pack/unpack. */
export const PF = {
  ALIVE: 1,
  DASHING: 2,
  INVULN: 4,
  SWING_STARTUP: 8,
  SWING_ACTIVE: 16,
  SWING_HIT: 32,
  SWING_RECOVERY: 64,
  CONNECTED: 128,
  /** Set when the current swing is drawing right-to-left. */
  SWING_REVERSE: 256,
  /** Held long enough to release into a forward shield wave. */
  CHARGE_READY: 512,
  WAVE: 1024,
  CHARGE_DASHING: 2048,
  LOCKED: 4096,
  LASER_CHARGING: 8192,
  LASER_FIRING: 16384,
  /** Bug skill: ghost phasing active. */
  GHOST: 32768,
  /** Bug skill: frontal wall shield active. */
  WALL: 65536,
  /** Caught by a trap; movement is slowed. */
  SLOW: 131072,
  /** Held 180 degree deflect guard is up. */
  GUARD: 262144,
} as const;

export const EV = {
  SHOOT: 1,
  SWING: 2,
  DEFLECT: 3,
  BOUNCE: 4,
  EXPLODE: 5,
  HIT: 6,
  DASH: 7,
  ROUND_START: 8,
  ROUND_END: 9,
  MATCH_END: 10,
  PLANT_MINE: 11,
  DRONE_SHOOT: 12,
  ELIMINATED: 13,
  RESPAWN: 14,
  EAT: 15,
  VIRUS_SPLIT: 16,
  INFECT: 17,
  FIREWALL: 18,
  THRALL: 19,
  WORM_HIT: 20,
  VIRUS_HIT: 21,
  SHIELD_WAVE: 22,
  LASER: 23,
  ERROR_HIT: 24,
  ERROR_BREAK: 25,
  ERROR_SPAWN: 26,
  BUG: 27,
  SENTRY_HIT: 28,
  SENTRY_KILL: 29,
  SENTRY_SHOOT: 30,
  WORM_KILL: 31,
  VIRUS_KILL: 32,
  POWERUP: 33,
  HEAL: 34,
} as const;

export interface Player {
  active: boolean;
  connected: boolean;
  slot: number;
  name: string;

  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  /** Knockback velocity, decays independently of steering. */
  kx: number;
  ky: number;

  facing: number;
  prevFacing: number;
  swingFacing: number;
  /** 1 draws the deflect arc left-to-right; -1 reverses the next swing. */
  swingDir: number;

  hp: number;
  maxHp: number;
  energy: number;
  /** Fast-bolt shots left in the current burst. */
  burstLeft: number;
  /** Recharge remaining after the burst is emptied. */
  burstCd: number;
  score: number;
  alive: boolean;
  /** Local gauntlet-only: this body is a virus-controlled copy. */
  thrall: boolean;

  dashT: number;
  dashCd: number;
  /** Stored dodge charges. Two by default; both recharge on the same timer. */
  dashCharges: number;
  /** Last nonzero movement direction. Dash commits to this, not to lock facing. */
  moveDirX: number;
  moveDirY: number;
  dashDirX: number;
  dashDirY: number;
  /** 0 = normal dodge, 1 = charged triangle dash. */
  dashKind: number;
  dashChargeT: number;
  dashChargeHeld: boolean;
  chargeDashCd: number;
  dashHitPlayers: number;
  dashHitWorms: number;
  dashHitViruses: number;
  dashHitErrors: number;
  dashHitSentries: number;
  dashHitDrone: boolean;
  iframes: number;

  swingPhase: number; // 0 none, 1 startup, 2 active, 3 recovery
  swingT: number;
  swingPct: number;
  swingHit: boolean;

  /** Strong attack held this tick. A short tap uses the bug; a full charge fires the beam. */
  laserChargeHeld: boolean;
  laserChargeT: number;
  /** Remaining seconds of the charged beam. */
  laserT: number;
  laserCd: number;
  laserTickT: number;
  /** Facing committed when the beam begins. */
  laserFacing: number;
  /** Seconds the deflect button has been held; feeds the shield wave. */
  chargeT: number;
  /** Remaining seconds of the held 180 degree guard. */
  guardT: number;
  /** Short lockout after the guard breaks or is released. */
  guardCd: number;
  /** True while the deflect button is down, used to detect release. */
  chargeHeld: boolean;
  /** Remaining seconds of the forward shield-wave visual/active state. */
  waveT: number;
  /** Randomly assigned bug skill: 0 mine, 1 trap, 2 wall shield, 3 ghost. */
  bugKind: number;
  bugCd: number;
  /** Remaining seconds of ghost phasing. Attacks cancel it. */
  ghostT: number;
  /** Remaining seconds of the frontal wall shield. */
  wallT: number;
  /** Direction the wall was deployed. */
  wallFacing: number;
  /** Trap slow remaining (applies to movement speed). */
  slowT: number;
  /** Active pickup effect, -1 when none. See powerups.ts. */
  powerupKind: number;
  powerupT: number;
  /** Machine-gun auto-fire cooldown. */
  autoFireT: number;
  waveCd: number;
  /** 0 idle, 1 after the left swing, 2 after the right swing. */
  comboStage: number;
  comboT: number;

  /** 0 none, 1 player, 2 worm, 3 virus, 4 drone. */
  lockKind: number;
  lockId: number;
  lockT: number;
  lockActive: boolean;
  lockFacing: number;

  hitFlash: number;
  respawnT: number;
}

export interface Projectile {
  active: boolean;
  serial: number;
  /** 0 bolt, 1 mine, 2 trap, 3 hostile shot, 4 hostile homing missile. */
  type: 0 | 1 | 2 | 3 | 4;
  owner: number; // slot, -1 for drone
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  deflects: number;
  bounces: number;
  fuse: number;
  grace: number;
  armed: boolean;
  /** Pathfinding powerup bolt: axis-aligned target seeking. */
  homing: boolean;
  /** 0 horizontal, 1 vertical. */
  pathAxis: number;

  /** Renderer-owned trail ring buffer (also used by network views). */
  trailX: Float32Array;
  trailY: Float32Array;
  trailHead: number;
  trailCount: number;
}

export interface Drone {
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  rot: number;
  fireTimer: number;
  respawnT: number;
  targetX: number;
  targetY: number;
  hitFlash: number;
  radius: number;
}

export interface GameEvent {
  kind: number;
  slot: number;
  x: number;
  y: number;
  power: number;
  /** Hit direction for directional sparks. Zero means radial. */
  dirX: number;
  dirY: number;
}

export interface Worm {
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  segCount: number;
  segX: Float32Array;
  segY: Float32Array;
  segPrevX: Float32Array;
  segPrevY: Float32Array;
  segAngle: Float32Array;
  touchCd: number;
  hitFlash: number;
  kx: number;
  ky: number;
  infected: boolean;
  phase: number;
  /** Counts down while the chain assembles; movement is held until it reaches 0. */
  spawnT: number;
}

export interface Virus {
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  /** -1 targets the player; otherwise a worm index. */
  targetWorm: number;
  orbitSign: number;
  phase: number;
  contactCd: number;
  hitFlash: number;
  kx: number;
  ky: number;
  spawnT: number;
}

export interface Sentry {
  active: boolean;
  /** 0 pulse square, 1 nested triplex, 2 trapezoid homing pod, 3 flock dart. */
  kind: 0 | 1 | 2 | 3;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  radius: number;
  fireT: number;
  phase: number;
  hitFlash: number;
  orbitSign: number;
  spawnT: number;
}

export interface Firewall {
  active: boolean;
  /** 0 = vertical beam at x=pos, 1 = horizontal beam at y=pos. */
  axis: 0 | 1;
  pos: number;
  prevPos: number;
  dir: 1 | -1;
  warnT: number;
  tickT: number;
  age: number;
}

export interface CascadingError {
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Slide start point and target; the block eases from origin to target while growT lasts. */
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  growT: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
  touchCd: number;
  phase: number;
  spawnT: number;
}

export interface Pickup {
  active: boolean;
  kind: number;
  x: number;
  y: number;
  phase: number;
  life: number;
}

export interface LobbyPlayer {
  slot: number;
  name: string;
  ready: boolean;
  connected: boolean;
}

export interface LobbyState {
  code: string;
  hostSlot: number;
  canStart: boolean;
  players: LobbyPlayer[];
  arenaId: number;
}

export type Pillar = Rect;

export interface SessionPlayer {
  slot: number;
  name: string;
}
