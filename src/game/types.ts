import type { Rect } from './config';

export type Phase = 'countdown' | 'live' | 'roundover' | 'matchend' | 'practice';
export type GameMode = 'match' | 'training' | 'gauntlet';
/**
 * Campaign script inside a gauntlet-mode world. `cleared` and `failed` set
 * `gauntletOver`, which freezes the arena under the DOM result overlay.
 */
export type CampaignPhase = 'none' | 'calibration' | 'drill' | 'breach' | 'assault' | 'cleared' | 'failed';

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
  /** Edge action: move the held lock to the next/previous valid target. */
  LOCK_NEXT: 32,
  LOCK_PREV: 64,
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

/**
 * Attacker families for the death camera. `killerKind` on a player names the last
 * body that damaged them; only local simulations fill it, so a guest's snapshot
 * leaves it at `NONE`.
 */
export const SRC = {
  NONE: 0,
  PLAYER: 1,
  WORM: 2,
  VIRUS: 3,
  SENTRY: 4,
  ERROR: 5,
  FIREWALL: 6,
  DRONE: 7,
  /** No body: the floor ended. The death camera falls through to the nearest player. */
  VOID: 8,
  /** Arena laser emitter. No body, so the death camera falls through like a firewall. */
  EMITTER: 9,
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
  /** A floor compactor slammed; everything in the arena took a downward shove. */
  PUSHER: 35,
  PROP_HIT: 36,
  PROP_BREAK: 37,
  /** A deployed Wedge wall ran out of health and broke. */
  WALL_BREAK: 38,
  /** Bad Lag's hourglass burst: `power` 1 fast-forward, 0 time dilation. */
  TIME_WARP: 39,
  /** A projectile reached its TTL without touching a body or cover. */
  DISSOLVE: 40,
  /** Overcharge beam switched off: embers along the shaft and a puff at its stop. */
  BEAM_END: 41,
} as const;

/** Breakable file boxes. The renderer maps each to one glyph. */
export const PROP = {
  VIDEO: 0,
  DOC: 1,
  ZIP: 2,
  AUDIO: 3,
} as const;

export interface Prop {
  active: boolean;
  kind: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  hitFlash: number;
  /** Remaining drop-in animation. Above zero the box is falling and cannot be hit. */
  dropT: number;
  /** Light debris velocity: boxes are pushed, launched and batted around, never walls. */
  vx: number;
  vy: number;
  /** Target velocity. The box eases toward it, so a shove ramps in instead of snapping. */
  tx: number;
  ty: number;
}

export interface Player {
  active: boolean;
  connected: boolean;
  slot: number;
  name: string;
  /** Program roster id. See `PROGRAMS`; Probe 0 through Ghost 8. */
  program: number;

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
  /** Last attacker family (see `SRC`) and its slot or pool index, for the death camera. */
  killerKind: number;
  killerId: number;
  /** Ghost bite daze: seconds left of the slowed, wobbling state. */
  dazeT: number;
  /** Toxic venom: seconds left, time to the next tick, and the slot that applied it. */
  poisonT: number;
  poisonTickT: number;
  poisonSrc: number;
  /** Gas cloud visual: remaining time, total duration, radius, and skill-vs-cone shape. */
  toxT: number;
  toxDur: number;
  toxRadius: number;
  toxCone: boolean;
  /** Fast-bolt shots left in the current burst. */
  burstLeft: number;
  /** Recharge remaining after the burst is emptied. */
  burstCd: number;
  /** Wedge's three-shot string: shots left and the gap before the next one. */
  stringLeft: number;
  stringT: number;
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
  /** Wedge bracket bash visual and per-bash hit masks. */
  bashT: number;
  bashFacing: number;
  bashHitPlayers: number;
  bashHitWorms: number;
  bashHitViruses: number;
  bashHitErrors: number;
  bashHitSentries: number;
  bashHitDrone: boolean;
  /** Wedge charge plow: remaining active time and committed direction. */
  wedgeT: number;
  wedgeDirX: number;
  wedgeDirY: number;
  wedgeHitPlayers: number;
  wedgeHitWorms: number;
  wedgeHitViruses: number;
  wedgeHitErrors: number;
  wedgeHitSentries: number;
  wedgeHitDrone: boolean;
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
  /**
   * Overcharge ranged fire: seconds left in the short spin-up before the beam exists,
   * and seconds left of the cooling afterglow after it switches off. Both local only;
   * the powerup never enters a snapshot.
   */
  ocChargeT: number;
  ocFadeT: number;
  /**
   * A raised guard caught the heavy beam: seconds of reflected flash left, the direction
   * the reflected shaft travels, and how far it reaches back to the caster. Local only.
   */
  beamReflectT: number;
  beamReflectFacing: number;
  beamReflectDist: number;
  /** Fisher net deployment: drawing state, elapsed draw, and tether origin. */
  netDrawing: boolean;
  netT: number;
  /** Net slot owned by an in-progress draw; -1 when nothing is in hand. */
  netIndex: number;
  /** Seconds the deflect button has been held; feeds the shield wave. */
  chargeT: number;
  /** Remaining seconds of the fall grace: over the void, about to drop. */
  fallT: number;
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
  /**
   * GHOST's cloak: seconds of invisibility left. Unlike the legacy `ghostT` skill,
   * attacking does not drop it. While it runs, hit tests and enemy senses skip the
   * body. Local-only like every other program kit.
   */
  cloakT: number;
  /** GHOST's jump-scare window: seconds left to press melee and detonate the AOE. */
  scareT: number;
  /** Jump-scare face visual: seconds left and the point where the burst fired. */
  scareFaceT: number;
  scareFaceX: number;
  scareFaceY: number;
  /** Remaining seconds of the frontal wall shield. */
  wallT: number;
  /** Direction the wall was deployed. */
  wallFacing: number;
  /** Trap slow remaining (applies to movement speed). */
  slowT: number;
  /**
   * Floor traversal. `travelKind` names the plate being waited on or ridden (TRAVEL),
   * `travelT` is the remaining ride, `travelDwell` is the wait so far, and
   * `travelLatch` forces one step off an arrival plate before it can arm again.
   */
  travelKind: number;
  travelT: number;
  travelDur: number;
  travelDwell: number;
  travelCd: number;
  travelLatch: boolean;
  /** Pad ride endpoint. The body stays at the source until the unload finishes. */
  travelToX: number;
  travelToY: number;
  travelSwap: boolean;
  /**
   * Fisher's web holds this body in place. Refreshed every tick it is inside a web,
   * so a caught player, bot or thrall stays stuck until the web expires; a dash tears
   * through it because a dodge phases geometry.
   */
  netPinT: number;
  /**
   * Bad Lag's fast-forward. Seconds of 2.5x movement, attack rate and cooldown burn.
   * Local-only like every program kit, so it never enters a snapshot.
   */
  fastT: number;
  /** Per-tick movement multiplier from time effects. 1 when nothing is warping time. */
  speedMult: number;
  /** Active pickup effect, -1 when none. See powerups.ts. */
  powerupKind: number;
  powerupT: number;
  /** Machine-gun auto-fire cooldown. */
  autoFireT: number;
  waveCd: number;
  /** 0 idle, 1 after the left swing, 2 after the right swing. */
  comboStage: number;
  comboT: number;

  /** Sweep's broom combo: 0 shared lash, 1 diagonal from the left, 2 diagonal from the right, 3 big forward broom. */
  swingKind: number;
  /**
   * Sweep's giant broom heavy. The broom travels along the committed facing from
   * `broS` (behind the cast point) to +reach, and shoves the bodies it crosses.
   */
  broT: number;
  broDur: number;
  broX: number;
  broY: number;
  broDirX: number;
  broDirY: number;
  /** Current signed forward offset of the broom line from the cast point. */
  broS: number;
  /** Seconds left in the directional materialize beat before the stroke starts. */
  broRevealT: number;
  broRevealDur: number;
  /** -1 materializes right to left, 1 left to right. Latched when the heavy fires. */
  broRevealDir: number;
  broHitPlayers: number;
  broHitWorms: number;
  broHitViruses: number;
  broHitErrors: number;
  broHitSentries: number;
  broHitDrone: boolean;
  /** Sweep's split-broom skill: remaining time, lane centre and tangent axis. */
  fanT: number;
  fanDur: number;
  fanX: number;
  fanY: number;
  fanTx: number;
  fanTy: number;
  fanHitPlayers: number;
  fanHitWorms: number;
  fanHitViruses: number;
  fanHitErrors: number;
  fanHitSentries: number;
  fanHitDrone: boolean;

  /** Atomize's ranged fire alternates hands. 1 spawns right, -1 left. */
  atomSide: number;
  /** Orbital shield charges left and the shared rotation angle of the three balls. */
  atomBalls: number;
  atomBallA: number;
  /** Brief blue pop after a ball eats a hit. */
  atomFlashT: number;
  /** Atomize's orbit field: remaining time, total time and spin direction. */
  orbitT: number;
  orbitDur: number;
  orbitDir: number;

  /** 0 none, 1 player, 2 worm, 3 virus, 4 drone, 5 sentry, 6 cascading error. */
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
  /**
   * 0 bolt, 1 mine, 2 trap, 3 hostile shot, 4 hostile homing missile, 5 Fisher spear,
   * 6 Sweep broom, 7 Toxic needle, 8 Kaboom bomb, 9 Kaboom lobbed bomb, 10 Bad Lag
   * hourglass, 11 Atomize electron, 12 Ghost bite. Types 8/9 explode on contact and
   * are never deflected, so every `type >= 3` deflect branch must exclude them
   * explicitly. Type 10 is a player shot that passes through up to `BUFFER.shotHits`
   * bodies; type 11 is a light seeking ball that leaves from alternating hands;
   * type 12 is a wide, slow mouth that stops on the body and dazes it.
   */
  type: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
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
  /** Bombs only: radius and shove of the blast when the shell detonates. 0 otherwise. */
  blastRadius: number;
  blastKnockback: number;
  /** Arcing bombs only: flight time, used by the renderer to lift the sprite. 0 otherwise. */
  arcDur: number;
  /** Pathfinding powerup bolt: axis-aligned target seeking. */
  homing: boolean;
  /** 0 horizontal, 1 vertical. */
  pathAxis: number;
  /**
   * Hourglass state: bodies struck so far (stops at `BUFFER.shotHits`), current mark
   * rotation and the direction it spins. Each body struck flips `spinDir`.
   */
  hits: number;
  spin: number;
  spinDir: number;
  /** Atomize electron colour: 0 yellow, 1 green, 2 blue. */
  variant: number;
  /**
   * Orbit field capture. `orbOwner` is the Atomize slot holding this shot, or -1.
   * While captured the projectile ignores normal flight and is placed on the orbit.
   */
  orbOwner: number;
  orbA: number;
  orbR: number;
  orbDir: number;
  /** Piercing spear hit masks, so one throw damages each hostile once. */
  hitPlayers: number;
  hitWorms: number;
  hitViruses: number;
  hitErrors: number;
  hitSentries: number;
  hitDrone: boolean;

  /** Local-only attacker attribution for hostile shots, used by the death camera. */
  srcKind?: number;
  srcId?: number;

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
  /** Fisher's web holds the drone still, refreshed while it is caught. */
  netPinT: number;
  /** Toxic venom: seconds left and time to the next tick. */
  poisonT: number;
  poisonTickT: number;
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
  /** Territory center. Worms patrol this patch instead of beelining to the player. */
  anchorX: number;
  anchorY: number;
  patrolX: number;
  patrolY: number;
  retargetT: number;
  /** Time left before a provoked worm loses interest and returns to its patch. */
  aggroT: number;
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
  /** Fisher net snare: movement is held while this is above zero. */
  pinT: number;
  /** Telegraphed close bite: total timer, cooldown, committed direction and one-hit latch. */
  biteT: number;
  biteCd: number;
  biteHit: boolean;
  biteDirX: number;
  biteDirY: number;
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
  /** -1 targets the player or a roam point; otherwise a worm index. */
  targetWorm: number;
  /** False means this virus is spreading to a roam point, not chasing a player. */
  targetPlayer: boolean;
  roamX: number;
  roamY: number;
  retargetT: number;
  orbitSign: number;
  phase: number;
  contactCd: number;
  hitFlash: number;
  kx: number;
  ky: number;
  spawnT: number;
  /** Fisher net snare: movement is held while this is above zero. */
  pinT: number;
  /** Atomize orbit capture: owner slot (-1 none), angle, radius, direction and hit cooldown. */
  orbitOwner: number;
  orbitA: number;
  orbitR: number;
  orbitDir: number;
  orbitHitCd: number;
  /** Telegraphed player charge: total timer, cooldown, committed direction and one-hit latch. */
  chargeT: number;
  chargeCd: number;
  chargeHit: boolean;
  chargeDirX: number;
  chargeDirY: number;
}

export interface Sentry {
  active: boolean;
  /**
   * 0 pulse square, 1 nested triplex, 2 trapezoid homing pod, 3 flock dart,
   * 4 calibration circle, 5 calibration triangle, 6 calibration rectangle,
   * 7 triangle shard, 8 rectangle echo.
   */
  kind: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
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
  /** Sentries guard a landing zone instead of following the player across the map. */
  anchorX: number;
  anchorY: number;
  leash: number;
  spawnT: number;
  /** Fisher net snare: movement is held while this is above zero. */
  pinT: number;
  /** Atomize orbit capture: owner slot (-1 none), angle, radius, direction and hit cooldown. */
  orbitOwner: number;
  orbitA: number;
  orbitR: number;
  orbitDir: number;
  orbitHitCd: number;
  /** Small silhouettes only: telegraphed ram, cooldown, committed direction and one-hit latch. */
  ramT: number;
  ramCd: number;
  ramHit: boolean;
  ramDirX: number;
  ramDirY: number;
  /**
   * Campaign calibration shapes. 0 dormant, 1 waking, 2 active, 3 windup,
   * 4 committed attack. Ordinary sentries leave this at 2.
   */
  shapeState: number;
  /** Timer inside the current shape state: wake progress, windup or dash time. */
  shapeT: number;
  /** Seconds until the next shape attack. */
  shapeAtkCd: number;
  /** Parent pool index for a shard/echo, -1 for a parent shape. */
  shapeParent: number;
  /** Remaining lifetime of an ephemeral shard/echo. */
  shapeLife: number;
  /** Bounces left on a circle dash; unused by the other shapes. */
  shapeBounces: number;
  /** Attack wave latch for a parent shape. */
  shapeCount: number;
}

export interface LaserEmitter {
  x: number;
  y: number;
  /** Firing direction. 0 points right, PI/2 points down. */
  angle: number;
  /** Phase offset in cycles (0..1), so a period change keeps the pairing staggered. */
  offset: number;
  /** 0 idle, 1 gathering, 2 firing. */
  phase: number;
  /** 0..1 gather progress; 1 while the beam is live. */
  charge: number;
  /** Distance from the lens to the first solid surface. */
  beamDist: number;
  /** A guard caught this beam; the shaft stops at the shield. */
  caught: boolean;
  /** A guard already reflected this pass, so the shaft never hits twice. */
  spent: boolean;
  /** One bit per slot already burned by this pass. */
  hitPlayers: number;
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

/**
 * Wedge's deployed wall. A static bracket segment behind him: solid to bodies and
 * shots, so it can close a lane without being a free projectile delete.
 */
export interface Barrier {
  active: boolean;
  owner: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Unit normal, pointing from the wall back toward its owner. */
  nx: number;
  ny: number;
  life: number;
  maxLife: number;
  phase: number;
  /** Structural health. Shots, lashes and blasts chip it; at zero the wall breaks. */
  hp: number;
  maxHp: number;
  /** Damage shake timer, shared with props and any destructible environment. */
  hitFlash: number;
}

/** Fisher's deployed web. A line segment that reflects shots and snares hostiles. */
/**
 * Fisher's deployed web. A freeform polyline sampled while it is drawn, so it can curve
 * and turn hard. It reflects shots and holds anything that touches it until it expires.
 */
export interface Net {
  active: boolean;
  owner: number;
  xs: Float32Array;
  ys: Float32Array;
  count: number;
  /** Total drawn length, used for the minimum length and the point budget. */
  length: number;
  life: number;
  phase: number;
}

/** Fisher's lure bug. Hostiles are drawn to it while it is live. */
export interface Lure {
  active: boolean;
  owner: number;
  x: number;
  y: number;
  life: number;
  phase: number;
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
