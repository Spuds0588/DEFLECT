import type { Rect } from './config';

export type Phase = 'countdown' | 'live' | 'roundover' | 'matchend' | 'practice';
export type GameMode = 'match' | 'training' | 'gauntlet';
/**
 * Campaign script inside a gauntlet-mode world. `cleared` and `failed` set
 * `gauntletOver`, which freezes the arena under the DOM result overlay.
 */
export type CampaignPhase =
  | 'none'
  | 'calibration'
  | 'release'
  | 'briefing'
  | 'drill'
  | 'breach'
  | 'assault'
  | 'exit'
  | 'finale'
  | 'cleared'
  | 'failed';

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
  /** Arena feed pipe: a hostile file box or its intake. */
  PIPE: 10,
  /** Air traffic control scope: an aircraft crossing the floor. */
  RADAR: 21,
  /** Phone-pad key slam. No body, so the death camera falls through. */
  KEYPAD: 11,
  /** Document-scanner read line. No body, so the death camera falls through. */
  SCANNER: 12,
  /** Browser cursor click slam. No body, so the death camera falls through. */
  BROWSER: 13,
  /** PONG rally ball. No body, so the death camera falls through. */
  PONG: 14,
  /** AIRPORT split-flap time tile. No body, so the death camera falls through. */
  FLIP: 15,
  /** SPACE INVADERS simulated arcade cannon. No body, so the death camera falls through. */
  ARCADE: 16,
  /** FAX MACHINE print head. No body, so the death camera falls through. */
  FAX: 17,
  /** SMART PLUG live circuit arc. No body, so the death camera falls through. */
  PLUG: 18,
  /** SMOKE DETECTOR alarm wave. No body, so the death camera falls through. */
  SMOKE: 19,
  /** SMART WATCH second hand. No body, so the death camera falls through. */
  WATCH: 20,
  /** DISPATCH / LOAD BALANCER request car. No body, so the death camera falls through. */
  REQUEST: 22,
  /** SNACK MACHINE / TOKEN DISPENSER falling item. */
  DISPENSER: 23,
  /** ARCADE RACING hazard car. */
  RACE: 24,
  /** FIGHTING GAME strike or fireball. */
  FIGHTER: 25,
  /** DUCK HUNTER falling bird or blast. */
  DUCK: 26,
  /** TETRIS landed block. */
  TETRIS: 27,
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
  /** Compress pressure: `power` is the new body scale; a burst passes 0. */
  COMPRESS: 42,
  /** A mini-boss let out its arrival cry; `power` is the body radius. */
  MEGA_CRY: 43,
  /** A campaign ingress port collapsed; `power` is its size. Local-only. */
  PORTAL_BREAK: 44,
  /** One Mega Worm body node or the head de-rezzed into red squares; `power` is the burst scale. */
  MEGA_DEATH: 45,
  /** A hit landed on the Mega Worm; `x`/`y` are the impact point. */
  MEGA_HIT: 46,
} as const;

/** Breakable file boxes. The renderer maps each to one glyph. */
export const PROP = {
  VIDEO: 0,
  DOC: 1,
  ZIP: 2,
  AUDIO: 3,
  BATTERY: 4,
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
  /** Pipe-fed file: hurts a body on contact instead of only being shoved. */
  hazard?: boolean;
  /** Remaining grace before this hostile file can hit again. */
  hurtCd?: number;
  /** SATELLITE capacitor: durable, never launched, and arms the thrusters when all break. */
  capacitor?: boolean;
  /** Mounted hardware: not loose debris, so it never moves or gets launched. */
  fixed?: boolean;
  /**
   * A campaign or infection ingress port. It is damageable, never moves, and emits a
   * threat family until it closes. Ports are local content: never in Snapshot.
   */
  portal?: boolean;
  /** Port family: 0 sentry, 1 virus, 2 worm. */
  portalFamily?: number;
  /** Seconds until the next emission. */
  portalT?: number;
  /** Seconds between emissions while the port is open. */
  portalInterval?: number;
  /** The white party port: the level exit. It is not a target and takes no damage. */
  portalExit?: boolean;
  /**
   * A replicator rather than an open port: it prints one family and shares the port
   * clock and damage path, but it is not a campaign objective.
   */
  replicator?: boolean;
  /** Health the port was authored with, for the damage ring. */
  portalMaxHp?: number;
  /**
   * Contact cooldown for sustained attacks (beam, broom, bracket, cloud). A per-frame
   * resolve would otherwise delete a port in a couple of ticks.
   */
  portalHitCd?: number;
}

/** One expanding alarm ring. Masks keep a body to one hit per ring. */
export interface SmokeWave {
  active: boolean;
  radius: number;
  hitPlayers: number;
  hitWorms: number;
  hitViruses: number;
  hitSentries: number;
  hitErrors: number;
  hitDrone: boolean;
}

/** One micro-meteor in a SATELLITE shower. Presentation and host damage share it. */
export interface InvaderShot {
  active: boolean;
  x: number;
  y: number;
  vy: number;
}

/**
 * One request car on a DISPATCH or LOAD BALANCER track. This is a local arena
 * hazard: it never enters `Snapshot` and a hosted room never selects the arena.
 * `s` is distance along the route, negative while the car waits outside the floor.
 */
export interface RequestCar {
  active: boolean;
  route: number;
  s: number;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  horizontal: boolean;
  hitPlayers: number;
}

/** A snack or token falling toward a collection tray. Local arena state. */
export interface ArcadeDrop {
  active: boolean;
  /** 0 snack, 1 token. */
  kind: number;
  variant: number;
  x: number;
  y: number;
  vy: number;
  r: number;
  spin: number;
  warnT: number;
  hitPlayers: number;
}

/** One hazard car on the ARCADE RACING oval. */
export interface ArcadeRaceCar {
  active: boolean;
  angle: number;
  /** 1 clockwise, -1 after a guard or lash reflect. */
  dir: number;
  hitPlayers: number;
  flashT: number;
}

/** A fighting-cabinet fireball. Local-only; guard and lash reverse it. */
export interface ArcadeShot {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  side: number;
  hitPlayers: number;
  flashT: number;
}

/** A DUCK HUNTER bird: flying, then falling after the shot. */
export interface ArcadeBird {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 flying, 1 falling. */
  state: number;
  shotT: number;
  hitPlayers: number;
  variant: number;
}

/** The active TETRIS piece, addressed in grid cells. */
export interface ArcadeTetrisPiece {
  active: boolean;
  shape: number;
  x: number;
  y: number;
  fallT: number;
}

/** Local-only state for the food-court and arcade arenas. Never enters Snapshot. */
export interface ArcadeRuntime {
  drops: ArcadeDrop[];
  dropT: number;
  dropPoint: number;
  dropFlashT: number;
  sodaCounts: number[];
  sodaT: number;
  sodaFlashT: number;
  raceCars: ArcadeRaceCar[];
  raceT: number;
  fighterT: number;
  fighterSide: number;
  /** 0 punch, 1 kick, 2 fireball. */
  fighterKind: number;
  fighterWarnT: number;
  fighterActiveT: number;
  fighterHitPlayers: number;
  fighterShots: ArcadeShot[];
  duckBirds: ArcadeBird[];
  duckT: number;
  duckShotT: number;
  duckTarget: number;
  tetrisGrid: Uint8Array;
  tetrisPiece: ArcadeTetrisPiece;
  tetrisT: number;
  tetrisClearT: number;
  tetrisClearRow: number;
}

export interface SatelliteMeteor {
  active: boolean;
  x: number;
  y: number;
  /** Time since the shower started: warning then impact. */
  t: number;
  hit: boolean;
}

/**
 * A destructible arena feed pipe. It cycles a hostile file and a threat into the floor;
 * its intake also reclaims loose files and small threats. Local content only.
 */
export interface Pipe {
  active: boolean;
  x: number;
  y: number;
  /** Aim of the mouth, radians. The body runs back opposite this angle into the wall. */
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  /** Countdown to the next emission. */
  fireT: number;
  /** Number of emissions so far; alternates file and threat. */
  shots: number;
  /** 0 standard feed, 1 pinball feed. */
  feed: number;
  hitFlash: number;
  /** Short glow after an intake swallow. */
  catchFlash: number;
  catchT: number;
  /** Tube mouth exit point, outside the arena. The tube is drawn from mouth to here. */
  outX: number;
  outY: number;
  /** Length and width of the visible transparent feed tube. */
  tubeLength: number;
  tubeWidth: number;
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
  /**
   * Local COPYPASTA summon: a second program body driven by the world's copy AI.
   * It is never a room slot, never networked, and never counted for round survival.
   */
  copyClone: boolean;
  /** Dash afterimage: an inert, targetable copy with a short life. */
  copyDecoy: boolean;
  /** Slot that cast the copy. -1 when this body is not a clone. */
  copyOwner: number;
  /** Seconds left on the copy's life. */
  copyT: number;

  dashT: number;
  dashCd: number;
  /** Stored dodge charges. Two by default; Pinball carries three. */
  dashCharges: number;
  /** Maximum stored charges for this program. Set when the program is assigned. */
  dashMax: number;
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
  /** Where the live beam stopped last tick. 0 means no beam-specific stop was recorded. */
  laserStopDist: number;
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
  /** Full length of the current guard, for the burn-down read. Pinball's is longer. */
  guardMax: number;
  /** Forward reach of the guard screen. Pinball's shield is wider. */
  guardReach: number;
  /** Short lockout after the guard breaks or is released. */
  guardCd: number;
  /**
   * Melee shape. Aim Bot's combat knife is longer, sweeps a wider arc and shoves
   * harder than the shared lash. Stored per body, like `guardReach`, so respawn,
   * the renderer and bot range checks all read one source.
   */
  meleeReachMult: number;
  meleeHalfAngle: number;
  meleeKnock: number;
  /** Perfect-parry window opened by a fresh guard or melee press. Local only. */
  parryT: number;

  /**
   * Pinball's deployed flipper arm. The base is a fixed world point captured at cast,
   * so leaving it behind is part of the skill. `armAngle` is the current paddle angle
   * and `armHitCd` gates the next body swat. Local-only, never in a snapshot.
   */
  armT: number;
  armMax: number;
  armX: number;
  armY: number;
  armBaseAngle: number;
  armAngle: number;
  armHitCd: number;
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
  /**
   * COMPRESS's pressure: the body scale left behind by shrink orbs and the burst,
   * from `COMPRESS.shrinkFloor` to 1. Local-only like every other program kit.
   */
  shrink: number;
  /** Remaining seconds of the small-and-fast skill. */
  shrinkT: number;
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
  /** Pipe intake ride: remaining seconds, duration, path endpoints and exit pipe index. */
  pipeTransitT: number;
  pipeTransitDur: number;
  pipeFromX: number;
  pipeFromY: number;
  pipeToX: number;
  pipeToY: number;
  pipeFromIndex: number;
  pipeToIndex: number;
  pipeCooldown: number;
  /**
   * Fisher's web holds this body in place. Refreshed every tick it is inside a web,
   * so a caught player, bot or thrall stays stuck until the web expires; a dash tears
   * through it, though solid cover still stops the body.
   */
  netPinT: number;
  /**
   * Bad Lag's fast-forward. Seconds of 2.5x movement, attack rate and cooldown burn.
   * Local-only like every program kit, so it never enters a snapshot.
   */
  fastT: number;
  /** Per-tick movement multiplier from time effects. 1 when nothing is warping time. */
  speedMult: number;
  /** Memory fragments collected this run: +1 segment, +20% speed, +25% damage each. */
  memory: number;
  /** One shard per player per run; a respawn does not earn another. */
  memoryDropped: boolean;
  /** File blob glue: root timer and attack presses needed to tear free. */
  glueT: number;
  glueHits: number;
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
  /** Aim Bot's visible sight and temporary clip. Local-only. */
  aimSightT: number;
  aimClip: number;
  /** Current lock position, used by the local sight and camera. Local-only. */
  lockTX: number;
  lockTY: number;
  /**
   * Last player slot this body locked on to, kept briefly so a melee hit still carries
   * the player's intent after updateLock drops lockActive during the swing.
   */
  lockIntentSlot: number;
  lockIntentT: number;

  hitFlash: number;
  respawnT: number;
}

/** One growing stack of red file icons left by COPYPASTA's redaction burst. */
export interface CopyMark {
  active: boolean;
  /** 0 player, 1 worm, 2 virus, 3 sentry, 4 cascading error. */
  kind: number;
  id: number;
  owner: number;
  t: number;
  count: number;
  x: number;
  y: number;
}

/** One red crosshair in Aim Bot's six-target volley. Local-only. */
export interface AimMark {
  active: boolean;
  /** 1 player, 2 worm, 3 virus, 4 drone, 5 sentry, 6 cascading error. */
  kind: number;
  id: number;
  owner: number;
  /** Seconds until this mark fires. */
  t: number;
  x: number;
  y: number;
}

export interface Projectile {
  active: boolean;
  serial: number;
  /**
   * 0 bolt, 1 mine, 2 trap, 3 hostile shot, 4 hostile homing missile, 5 Fisher spear,
   * 6 Sweep broom, 7 Toxic needle, 8 Kaboom bomb, 9 Kaboom lobbed bomb, 10 Bad Lag
   * hourglass, 11 Atomize electron, 12 Ghost bite, 13 Compress orb, 14 Pinball ball,
   * 15 Pinball super ball. Types 8/9 explode on contact and are never deflected, so
   * every `type >= 3` deflect branch must exclude them explicitly. Type 10 is a player
   * shot that passes through up to `BUFFER.shotHits` bodies; type 11 is a light seeking
   * ball that leaves from alternating hands; type 12 is a wide, slow mouth that stops
   * on the body and dazes it; type 13 is a pressure orb that shrinks and caps the
   * victim's health. Type 14 ricochets, speeds up per bounce or body, and escalates
   * 1-5 damage over five bodies. Type 15 is the huge super ball: walls bounce it,
   * bodies do not, and it rolls through cover. Type 17 is Aim Bot's rail round: no
   * practical flight limit, no bounce, and it dies on the first body or cover hit.
   * Type 20 is the Mega Worm's jagged side volley; once reflected it is an ordinary
   * player bolt with the usual deflection damage.
   */
  /** 16 is Copy Pasta's file; its `variant` is 0 for the parent and 1 for the child. */
  type: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
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
  /** Storm Cloud bolt: a caught one tears a bigger hole out of the cloud. */
  lightning: boolean;
  /** 0 horizontal, 1 vertical. */
  pathAxis: number;
  /**
   * Body hits so far. Hourglass stops at `BUFFER.shotHits`; Pinball uses it to escalate
   * damage and stops at `PINBALL.shotHits`. Marks also use `spin`/`spinDir` for rotation.
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

export interface BossIntro {
  kind: number;
  label: string;
  /** Seconds elapsed and total duration of the frozen entrance. */
  t: number;
  duration: number;
  /** Current camera focus in world space. */
  x: number;
  y: number;
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

/** Idle Hands: one floating hand. Three of these make the boss. */
export interface HandState {
  /** 0 hover, 1 slam windup, 2 slam drop, 3 slam recover, 4 charge windup, 5 charge dash, 6 deflected. */
  state: number;
  t: number;
  /** Attack cooldown and the short contact clock after a charge connects. */
  cd: number;
  hitCd: number;
  /** Players already hit by this slam or charge, one bit per slot. */
  hitMask: number;
  /** Latched charge direction, or the redirect direction once deflected. */
  dirX: number;
  dirY: number;
  /** Ground point the slam is committed to, and the point it drops from. */
  slamX: number;
  slamY: number;
  fromX: number;
  fromY: number;
  /** Palm eye flare and a per-hand bob phase. */
  eyeT: number;
  bob: number;
  /** Spawn group, so the palms read as one boss. */
  group: number;
}

/** The center of a Starfish boss. Arms are separate bodies, not segments. */
export interface StarfishState {
  /** Ties the center to its arm bodies across the worm pool. */
  group: number;
  /** Seconds since spawn: drives the spin and the arm whip. */
  clock: number;
  /** 0 idle, 1 mouth opening / suck, 2 chomp, 3 recover. */
  state: number;
  t: number;
  cd: number;
  /** Arms still attached. Detaching one opens the mouth. */
  armCount: number;
  /** Bit per arm index still attached, so the center can draw its stumps. */
  armMask: number;
  spin: number;
  spineCd: number;
}

/** One detached-or-attached Starfish arm. An undestroyed detached arm hatches a new boss. */
export interface StarfishArmState {
  group: number;
  index: number;
  attached: boolean;
  /** Seconds until this arm grows a whole new Starfish. */
  hatchT: number;
  spineCd: number;
  phase: number;
}

/**
 * The file blob's render and attack state. Icons are not simulated: `hp` is the live
 * icon count, and the renderer derives every icon position from the node springs.
 */
export interface BlobState {
  /** 0 idle, 1 toss windup, 2 glob in flight, 3 toss recover, 4 slam windup, 5 airborne, 6 slam recover. */
  state: number;
  t: number;
  cd: number;
  /** Glob/slam arc endpoints and progress. */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  globT: number;
  /** Shed burst: icons falling off after a hit, and the seed that spreads them. */
  shed: number;
  shedT: number;
  shedSeed: number;
  /** Skeleton: radial springs around the rim, one per node. */
  nodeR: Float32Array;
  nodeV: Float32Array;
  clock: number;
  contactCd: number;
}

/**
 * The storm cloud's attack state. The body is a hovering square mass; the rain and
 * the bolt live in the projectile pool so guard, lash and player fire already apply.
 */
export interface StormState {
  /** 0 hovering and raining, 1 charging a bolt. */
  state: number;
  t: number;
  clock: number;
  /** Rain: rows still to lay in the current burst and the clock between rows. */
  rowsLeft: number;
  rowT: number;
  /** 1 lays a row left to right, -1 right to left. Flips every burst. */
  rowDir: number;
  rainCd: number;
  rowIndex: number;
  /** Lightning: windup clock, cooldown, the latched strike point and the flash. */
  boltT: number;
  boltCd: number;
  boltX: number;
  boltY: number;
  flash: number;
  contactCd: number;
  /** Render-only puff scale per square, so the mass never pulses in lockstep. */
  puff: Float32Array;
}

export interface Worm {
  active: boolean;
  /** Campaign holding cell: present, frozen and invulnerable until the power-down. */
  held: boolean;
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
  /** COMPRESS pressure: visual body scale, 0.35..1. Worms have no other size field. */
  shrink: number;
  /** Fisher net snare: movement is held while this is above zero. */
  pinT: number;
  /** Telegraphed close bite: total timer, cooldown, committed direction and one-hit latch. */
  biteT: number;
  biteCd: number;
  biteHit: boolean;
  biteDirX: number;
  biteDirY: number;
  /** Ordinary worm dash: wind-up/active/recovery clock, cooldown and latched direction. */
  dashT: number;
  dashCd: number;
  dashHit: boolean;
  dashDirX: number;
  dashDirY: number;
  /** Parry stun; a stunned worm cannot steer, bite or dash. */
  stunT: number;
  /** Mega Worm only: recovery watchdog for a pass that failed to relaunch. */
  megaWatchT: number;
  /** Mini-boss registry id (`minibosses.ts`), -1 for an ordinary worm. */
  bossKind: number;
  /** Idle Hands bodies only; null on every other worm or boss. */
  hand: HandState | null;
  /** Starfish center state, and Starfish arm state. Never both on one body. */
  starfish: StarfishState | null;
  armState: StarfishArmState | null;
  /** File blob state; null on every other body. */
  blob: BlobState | null;
  /** Storm cloud state; null on every other body. */
  storm: StormState | null;
  /** Mega Worm: a boss chain whose nodes carry their own health. */
  mega: boolean;
  /** Mega Worm flight: 0 orbit, 1 committed pass, 2 climb-out. */
  flyPhase: number;
  /** Seconds in the current flight phase. */
  flyT: number;
  /** Seconds until the next pass is allowed. */
  flyCd: number;
  /** Committed pass direction. */
  flyDX: number;
  flyDY: number;
  /** Mega Worm offscreen entrance: seconds left, start angle and start radius. */
  entryT: number;
  entryA: number;
  entryR: number;
  /** Mega Worm post-entry roar hold; drawn as a maw/ring beat. */
  roarT: number;
  /** Index into the Mega Worm's fixed fly-by pattern; absent only before its first pass. */
  megaPass?: number;
  /** Low-health phase: one extra roar, then a faster pass cycle. */
  megaRage: boolean;
  /**
   * Mega Worm death choreography: -1 alive, 0 last crossing, 1 plates bursting,
   * 2 head spin, 3 finished. The boss stays active but harmless until the head goes.
   */
  megaDeath: number;
  /** Seconds inside the current death phase. */
  megaDeathT: number;
  /** Plates already burst, counted from the tail. */
  megaDeathSegs: number;
  /** Radians added to the head while it spins before the final explosion. */
  megaDeathSpin: number;
  /** Slot credited with the kill when the head finally bursts. */
  megaDeathBy: number;
  /** Seconds until the next jagged side volley during a fly-by. */
  volleyT: number;
  /** Per-node health. Index 0 is the head, index k is segment k-1. */
  segHp: Float32Array;
  segMaxHp: Float32Array;
  /** Collision radii, so one worm loop serves both body sizes. */
  hitR: number;
  segR: number;
  /** Body whip: remaining time, cooldown, sweep side, pivot, sweep pose, hit mask. */
  whipT: number;
  whipCd: number;
  whipDir: number;
  whipPivotX: number;
  whipPivotY: number;
  whipA: number;
  whipR: number;
  whipHit: number;
  /** One node left: legs, a fast body, a lunge bite and acid spit. */
  legs: boolean;
  acidT: number;
  /** A promoted or detached head flashes its new eyes. */
  eyeT: number;
}

export interface Virus {
  active: boolean;
  /** Campaign holding cell: present, frozen and invulnerable until the power-down. */
  held: boolean;
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
  /** Extra drawn diamonds in this virus's swarm group. They add no hitboxes. */
  swarm: number;
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
  /** Parry stun; a stunned sentry cannot move, fire or ram. */
  stunT: number;
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
  /** Fire warning: a thin red line before the beam becomes dangerous. */
  warnT: number;
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

/** A downed player's left-behind memory shard. PvE modes only. */
export interface Fragment {
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Seconds on the floor. Shards never expire; this only drives the idle pulse. */
  age: number;
  /** Bounds the drift bob so two shards never move in lockstep. */
  spin: number;
  fromSlot: number;
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
  /** 0 versus, 1 infection. Host-owned; guests read it. */
  mode: number;
  /** Games in the current series: 1, 3 or 5. Host-owned. */
  series: number;
  /** 0 random maps, 1 fixed to the setup arena. Host-owned. */
  mapRule: number;
}

export type Pillar = Rect;

export interface SessionPlayer {
  slot: number;
  name: string;
}

/**
 * A transient gauntlet ingress. It opens on an arena edge, emits a burst of queued
 * threats at its mouth, then closes. Local-only: never in SnapshotHazards.
 */
export interface AssaultPortal {
  active: boolean;
  x: number;
  y: number;
  half: number;
  /** Seconds since it opened. */
  t: number;
  openDur: number;
  /** How long the open mouth holds after releasing the whole group. */
  burstHold: number;
  closeDur: number;
  /** Requests assigned to this burst, and how many it has emitted. */
  count: number;
  emitted: number;
}
