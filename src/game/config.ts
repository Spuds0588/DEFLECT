/**
 * Every tunable gameplay number lives here. See AGENTS.md §6.
 * Units are virtual pixels (1280x720 space) and seconds unless noted.
 */

export const VIEW_W = 1280;
export const VIEW_H = 720;
/** World units per screen pixel. Higher = closer camera. */
export const CAMERA_ZOOM = 1.28;

/**
 * Follow-camera framing. The local avatar is the anchor; nearby bodies pull the view
 * toward the fight so a threat at the player's back does not sit off-screen.
 */
export const CAMERA = {
  /** Only bodies inside this radius of the anchor pull the view. */
  focusRange: 640,
  /** Full pull moves the frame this fraction of the group's mean offset. */
  maxBias: 0.5,
  /** Group weight counted as a full pull; a body at half range is already most of it. */
  groupPull: 1.7,
  /** The anchor never enters the outer 30% of the view, whatever the pull. */
  edgeMargin: 0.3,
  /** Follow rate, 1/s. Lower is calmer; the old fixed follow was 9. */
  follow: 6.2,
  /**
   * Dynamic zoom, expressed as a multiplier of the view's base zoom. A tight fight sits
   * at `zoomMax`; a group spread across the whole focus range pulls back to `zoomMin`.
   * Tune these two first when the framing feels too close or too wide.
   */
  zoomMin: 0.88,
  zoomMax: 1.03,
  /**
   * Extra pull-back allowed while local players still share one screen. The camera
   * drops to this before it splits a pane, so a group across a wide arena stays
   * together until the frame can no longer hold everyone.
   */
  sharedZoomMin: 0.68,
  /** Zoom rate, 1/s. Slower than the pan so the frame does not breathe. */
  zoomFollow: 3.4,
  /** Split-screen panes start pulled back so each local player keeps context. */
  splitZoom: 0.8,
  /** Gap between split panes, in virtual pixels. */
  splitGap: 4,
  /**
   * Local players stay on one screen while their whole group fits a view at `zoomMin`.
   * `groupPad` is the world-space margin kept around the group; `shareSlack` is the
   * hysteresis band, so a group at the fit limit does not flicker between layouts.
   */
  groupPad: 60,
  shareSlack: 70,
  /**
   * A wave look-ahead only glances at a sentry pack at least this far from the local
   * player, so the rig reads as an entrance from off-screen instead of a pan to
   * something already in frame.
   */
  waveLookAhead: 380,
  /**
   * Slow-motion when the local view count or grouping changes. The transition moves a
   * player's screen position; a full second at the slow scale gives the eye time to find
   * the avatar before a shot lands. The first `layoutSlowHold` seconds sit at the slow
   * scale, then it eases back to normal over the rest of `layoutSlowTime`.
   */
  layoutSlowTime: 1.3,
  layoutSlowHold: 1,
  layoutSlowScale: 0.35,
} as const;

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
  /** Bigger avatars make the code-symbol core and rotating health ring readable. 10% over the old 20. */
  radius: 22,
  speed: 248,
  /** Velocity smoothing rate. Higher = snappier. */
  accel: 20,
  swingSlow: 0.55,
  whiffSlow: 0.5,
  /** Three segments of the avatar ring. One segment goes dark per hit. */
  hp: 3,
  energyMax: 100,
  energyRegen: 18,
  dashSpeed: 1200,
  dashTime: 0.15,
  dashIframes: 0.1,
  dashCooldown: 1.8,
  /** Two stored dodges, each recharging on the same timer. */
  dashCharges: 2,
  /** One tick of anticipation; the hitbox is live on the next fixed step. */
  swingStartup: 0.006,
  /** Generous active window; press timing and catch distance grade the return. */
  swingActive: 0.24,
  /** Quick taps should string together; the old 0.18 s whiff tail felt sticky. */
  swingWhiffRecovery: 0.12,
  /** Max return-angle error on an early or far-edge catch. */
  deflectMaxAngle: 0.24,
  /** Early catches lose a little of the return speed. */
  deflectEarlySpeed: 0.84,
  swingHitRecovery: 0.08,
  /** Half of a 180 degree sector. Deflect is intentionally forgiving. */
  swingHalfAngle: Math.PI / 2,
  /** Keep the deflect band tight around the avatar, not out at arm's length. */
  swingReach: 52,
  /** The quick lash also shoves anything hostile inside this close arc. */
  punchReach: 72,
  punchDamage: 1,
  punchKnockback: 560,
  /** A tap is offense; the shield arms only after this short hold. */
  guardStartDelay: 0.08,
  /** Held guard: a 180 degree shield that eats every shot in front for one second. */
  guardDuration: 1,
  guardCooldown: 0.28,
  guardReleaseCooldown: 0.12,
  /** Each caught shot burns guard time, so a shield that eats a barrage breaks early. */
  guardReflectCost: 0.11,
  guardReach: 58,
  guardHalfAngle: Math.PI / 2,
  /** Tap three times to fire the forward shield wave. */
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
  lockRange: 1600,
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
  /** Fast repeat so a held beam visibly chews through a target instead of plinking. */
  laserTick: 0.14,
  /** Half-width of the beam for collision; the drawn glow is wider. */
  laserHalfWidth: 22,
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
  /** Slide dust only shears off a body moving faster than this, so a normal run stays clean. */
  slideDustSpeed: 470,
  /** World units of travel between square dust puffs while a body is sliding. */
  slideDustSpacing: 12,
} as const;

/**
 * Floor traversal. Pads and lifts are floor content, not a new movement mode: the body
 * must be standing still on the plate for the dwell timer, then the ride owns it.
 */
export const TRAVERSE = {
  /** Standing still on a paired pad for this long sends you to its mate. */
  padDwell: 0.32,
  /** Pad transit. Half is the unload at the source, half the reload at the mate. */
  padRide: 0.36,
  /** Standing still on a lift plate this long calls the car. */
  liftDwell: 0.55,
  /** The car's travel time. The screen transition runs for the same window. */
  liftRide: 1.55,
  /** Applies after any ride. An arrival plate also needs a step off before it re-arms. */
  cooldown: 0.35,
  /** Bodies moving faster than this are crossing a plate, not waiting on it. */
  dwellSpeed: 70,
  /** Progress ring radius, measured outward from the hull so it clears the health segments. */
  dwellRing: 16,
} as const;

/** Player travel state kind. Kept as numbers so it can live on the reused player record. */
export const TRAVEL = {
  none: 0,
  pad: 1,
  lift: 2,
} as const;

/** Fast close-range bolt. A near-continuous five-shot stream with a short recharge. */
export const BOLT = {
  radius: 7,
  speed: 860,
  /** Low enough that the five-shot stream can be held, not just tapped. */
  cost: 3,
  damage: 1,
  maxBounces: 1,
  ttl: 0.45,
  burstCount: 5,
  burstCooldown: 0.2,
  /** Holding weak attack keeps the baseline stream coming at this interval. */
  autoInterval: 0.1,
  deflectMult: 1.4,
  maxSpeed: 2800,
  /** Training bots and thralls fire slower than a human so their shots can be read and reflected. */
  enemySpeedMult: 0.8,
  spawnOffset: 26,
  knockback: 680,
} as const;

/** Program kits. Every number for Wedge and Fisher lives here. */
export const WEDGE = {
  /** Three quick shots in a string, slightly slower than the baseline bolt. */
  shotCount: 3,
  shotCost: 3,
  shotDamage: 1,
  shotSpeed: 730,
  shotTtl: 0.4,
  shotInterval: 0.075,
  attackCooldown: 0.52,
  /** Dodge opens a bracket in front, shoves the target back, then recoils the player. */
  bashTime: 0.22,
  bashReach: 86,
  bashHalfWidth: 54,
  bashDamage: 1,
  /** The bracket is displacement first: a caught body keeps sliding well past the swing. */
  bashKnockback: 2350,
  bashRecoil: 300,
  /** Hold strong to form the red triangle, then plow forward while it is live. */
  chargeTime: 0.8,
  chargeDuration: 0.5,
  chargeCost: 55,
  chargeCooldown: 5,
  chargeSpeed: 690,
  chargeRadius: 68,
  chargeDamage: 1,
  chargeKnockback: 2650,
  chargeIframes: 0.64,
  /**
   * Bug: a static bracket wall planted behind him. Solid to bodies and shots, so it
   * closes the lane he just left instead of being another shove.
   */
  wallLife: 4.6,
  wallOffset: 58,
  wallHalfLength: 46,
  wallThickness: 12,
} as const;

export const FISHER = {
  /** A piercing spear. Slower cadence, two damage, stops only on geometry. */
  spearCost: 7,
  spearDamage: 2,
  spearSpeed: 780,
  spearTtl: 0.7,
  spearRadius: 5,
  spearKnockback: 440,
  /** If the target is already close to cover, the spear staples it there briefly. */
  spearPin: 1.4,
  spearPinRange: 54,
  attackCooldown: 0.48,
  /**
   * Hold strong to draw a freeform web behind the player, then release to deploy it.
   * The line is sampled as he moves, so curves and hard turns are part of the shape.
   * A deployed web reflects shots and holds anything that touches it until it expires;
   * it does no damage.
   */
  netCost: 50,
  netCooldown: 5,
  netDrawTime: 2.4,
  netMinLength: 44,
  netMaxLength: 420,
  netWidth: 15,
  netLife: 6,
  /** Polyline budget per web. Sampled at `netPointSpacing` world units. */
  netPoints: 40,
  netPointSpacing: 11,
  /**
   * Corner-preserving smoothing on deploy. A bend gentler than this cosine is rounded
   * out; a sharper turn keeps its hard corner so a deliberate hinge still traps.
   */
  netCornerCos: 0.45,
  /** Re-applied every tick a body is inside the web, so a victim stays held. */
  netHold: 0.12,
  netReflectMult: 1.25,
  /** Bug: a beacon that pulls sentries, viruses and worms toward it. */
  lureCost: 30,
  lureCooldown: 8,
  lureLife: 4.2,
  lureRadius: 300,
} as const;

/**
 * SWEEP.EXE: an ASCII broom pushed around the room. Melee is a three-hit broom combo,
 * ranged is a dust-trailing broom throw, the heavy draws a giant broom then sweeps it
 * across the arena, and the skill splits two brooms outward to clear a lane.
 */
export const SWEEP = {
  /** Ranged: a thrown broom head. Wide and slow, and it dies on geometry, no ricochet. */
  shotCost: 9,
  shotDamage: 2,
  shotSpeed: 500,
  shotTtl: 0.9,
  shotRadius: 15,
  /** A broom head is heavy: this is the biggest shove of any ranged attack. */
  shotKnockback: 1200,
  attackCooldown: 0.5,
  /** Melee combo: two diagonal pushes, then a bigger forward broom. */
  comboWindow: 0.56,
  comboDamage: 1,
  comboKnockback: 760,
  /** The third hit is the payoff: longer reach, two damage, a much bigger slide. */
  bigReach: 96,
  bigDamage: 2,
  bigKnockback: 1150,
  /**
   * Power: a giant broom head assembles in front of the player, sweeps up, then comes
   * back down through the same lane. One up-and-down pass, no net pull toward the caster.
   */
  powerCost: 55,
  powerChargeTime: 0.85,
  powerCooldown: 6,
  powerDuration: 0.9,
  /** How far above its start line the head rises before the return stroke. */
  powerRise: (VIEW_H / CAMERA_ZOOM) * 0.5,
  /** How far in front of the player the head is generated. */
  powerFront: 110,
  /** Half the visible width. Four fifths of the camera window: leaves an escape lane. */
  powerSpan: (VIEW_W / CAMERA_ZOOM) * 0.4,
  /** Half-thickness of the live bristle row, measured below the head plate. */
  powerWidth: 46,
  /** Slide held on bodies under the live broom so they ride the stroke with it. */
  powerCarry: 620,
  powerDamage: 2,
  powerKnockback: 1450,
  /** Skill: two brooms start together in front and split outward to clear a lane. */
  fanLife: 0.62,
  fanReach: 250,
  fanWidth: 40,
  fanDamage: 1,
  fanKnockback: 1100,
  /** Cooldown for the split-broom skill. The tap also pays `BUG.cost` of energy. */
  fanCooldown: 6,
} as const;

/**
 * TOXIC.EXE: the roster's poison specialist. Its needle and gas attacks carry a timed
 * venom; the direct damage is deliberately small so the damage-over-time is the point.
 */
export const TOXIC = {
  /** Ranged: a cheap needle dart. Low direct damage; the venom is the payload. */
  needleCost: 8,
  needleDamage: 1,
  needleSpeed: 880,
  needleTtl: 0.62,
  needleRadius: 6,
  needleKnockback: 300,
  attackCooldown: 0.34,
  /**
   * Venom: 3.5 s of ticks every 0.75 s. The tick is a third of a health segment, so a
   * full poison is roughly one segment and a half: pressure, not an execution.
   */
  poisonTime: 3.5,
  poisonTick: 0.75,
  poisonDamage: 0.34,
  /** Skill: a 360-degree spray that poisons everything close. */
  sprayRadius: 190,
  sprayDamage: 0.5,
  sprayCooldown: 6,
  sprayLife: 0.7,
  /**
   * Power: a rooted, aimable jet of venom. Charge, then hold the line for a fixed
   * burst: the body cannot move, but the stick still steers the stream. Damage is
   * paid in ticks, so brushing the jet is a warning and standing in it is not.
   */
  streamCost: 55,
  streamRange: 560,
  streamHalfAngle: 0.16,
  streamTime: 1.25,
  streamTick: 0.2,
  streamDamage: 0.3,
  streamTurnRate: 2.4,
  streamCooldown: 7,
  streamChargeTime: 0.8,
} as const;

/**
 * KABOOM.EXE: a slow bomb thrower. The ranged shell drifts in with a deliberately
 * small blast, the skill lobs one heavy shell that lands at `lobRange`, and the power
 * carpets a shallow rectangle ahead with five overlapping blasts. Every bomb damages
 * through area only: there is no direct-hit bonus, so cover that cuts the blast cuts
 * the damage.
 */
export const KABOOM = {
  /** Ranged: one slow shell per throw, no stream. */
  bombCost: 16,
  bombDamage: 1,
  /** Projectile hit radius and the blast it leaves behind. */
  bombRadius: 9,
  bombBlast: 52,
  bombSpeed: 250,
  bombTtl: 1.9,
  bombKnockback: 520,
  attackCooldown: 0.9,
  /** Skill: a heavy shell thrown in an arc, timed so it lands at `lobRange`. */
  lobTime: 0.62,
  lobRange: 300,
  lobRadius: 14,
  lobDamage: 2,
  lobBlast: 116,
  lobKnockback: 900,
  /** Power: five shells in a shallow row, each blast overlapping the next. */
  clusterCost: 55,
  clusterChargeTime: 0.85,
  clusterCooldown: 8,
  clusterCount: 5,
  clusterRange: 300,
  /** Half-angle of the fan, so five shells land in a row about 150 units wide. */
  clusterSpread: 0.24,
  clusterTime: 0.6,
  /** Seconds between shells in the power's spray, left to right. */
  clusterStagger: 0.07,
  clusterRadius: 8,
  clusterDamage: 1,
  clusterBlast: 66,
  clusterKnockback: 620,
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
  triggerRadius: 52,
  /** Small enough to read as a trap, not a room-clearing bomb. */
  blastRadius: 82,
  blastDamage: 1,
  knockback: 760,
} as const;

/**
 * Signature bug skill on the strong-attack tap. Programs own their bug now:
 * Probe 0 mine, Wedge 4 rear bracket, Fisher 5 lure. Kinds 1-3 remain implemented
 * prototypes for future programs. Hold still charges the program's heavy attack.
 */
export const BUG = {
  cost: 35,
  /** A static wall is stronger than a shove, so its slot in the table is longer. */
  cooldown: [4.5, 5, 7, 8, 9, 8, 6, 7, 7.5],
  trapRadius: 62,
  trapDuration: 2.2,
  trapSlow: 0.42,
  wallDuration: 2.8,
  wallLength: 62,
  wallOffset: 34,
  wallThickness: 7,
  ghostDuration: 2.4,
} as const;

/** Local pickup loop. Definitions and weights live in `powerups.ts`. */
export const POWERUP = {
  /** Ambient pickups are rare; most should come from a kill. */
  firstSpawn: 24,
  spawnInterval: 42,
  maxActive: 2,
  radius: 14,
  life: 22,
  pickupPadding: 5,
  /** Kill drops. Small enemies roll rarely, heavy silhouettes roll generously. */
  dropChance: 0.04,
  eliteDropChance: 0.25,
  dropCooldown: 5.5,
  dropRadiusMin: 36,
  dropRadiusMax: 92,
  /** Ambient spawn scatter, kept away from the player so it asks for a decision. */
  spawnRadiusMin: 160,
  spawnRadiusMax: 340,
  /** Timed effects; restore is instant. */
  duration: 15,
  shotgunDuration: 13,
  overchargeDuration: 11,
  whipDuration: 12,
  pathDuration: 15,
  /** Machine gun: hold weak attack for a stream of short bolts. */
  machineInterval: 0.08,
  machineTtl: 0.3,
  machineCost: 1,
  machineSpread: 0.055,
  machineRadius: 5,
  /** Shotgun: five short-range pellets in a fan. */
  shotgunPellets: 5,
  shotgunSpread: 0.24,
  shotgunTtl: 0.24,
  shotgunCost: 12,
  shotgunCooldown: 0.55,
  /** Pathfinding: axis-aligned bolts that reroute toward a target. */
  pathTtl: 1.25,
  pathCost: 10,
  pathAxisSnap: 12,
  pathRadius: 6,
  /** Barbed whip: reflect reach and damage multiplier. */
  whipMultiplier: 4,
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
  droneBoltSpeed: 450,
  droneBoltTtl: 4.5,
  droneRespawn: 2.2,
  playerRespawn: 1.6,
} as const;

/**
 * CAMPAIGN: the first authored node (`campaign.ts`). The level opens with a sparring
 * drill against the run's bot squad, then a breach warning clears the room and wakes
 * the threat sandbox. Threat pacing reuses the gauntlet spawners; these numbers only
 * set the opening beat and the win condition.
 */
export const CAMPAIGN = {
  /** Drill length before the breach warning. */
  drillTime: 18,
  drillBannerTime: 3.4,
  /** Warning window with no live threats; the squad de-rezzes on the first frame. */
  breachTime: 3.4,
  breachBannerTime: 3.2,
  clearBannerTime: 3.0,
  failBannerTime: 2.2,
  /** A NO BOTS run still drills against one instructor. */
  minDrillBots: 1,
  maxDrillBots: 3,
  /** The squad forms an arc this far from the player, spread across this many radians. */
  drillRing: 250,
  drillSpread: 0.72,
  /** Worms are already unlocked when the assault starts, then a new wave every interval. */
  waveStart: 3,
  waveSeconds: 14,
  /** Threat kills needed to clear the node. */
  killsToClear: 10,
  /** First worm arrives this long after the breach. */
  openingWormDelay: 6,
  /** A campaign node keeps a tighter cadence than the endless sandbox. */
  sentryInterval: 14,
  wormInterval: 14,
} as const;

export const GAUNTLET = {
  /** Only used by the headless practice/bench path; a scored run ends on death. */
  playerRespawn: 1.3,
  /** Seconds per wave. A normal run sees many small steps, not a fast difficulty spike. */
  waveDuration: 30,
  /** Wave where the slow interval taper reaches its floor. Long on purpose. */
  fullPressureWave: 120,

  /** Threat families arrive one at a time instead of all at once. */
  wormWave: 3,
  virusWave: 6,
  triplexWave: 9,
  errorWave: 12,
  homingWave: 15,
  flockWave: 18,

  wormSpawnDelay: 8,
  wormInterval: 34,
  wormMinInterval: 14,
  maxWorms: 2,
  /** Add one live worm every this many waves after the family unlocks. */
  wormCapStep: 20,

  virusSpawnDelay: 10,
  virusInterval: 34,
  virusMinInterval: 13,
  virusCluster: 4,
  virusClusterStart: 2,
  virusClusterStep: 14,
  maxViruses: 10,
  virusCapBase: 4,
  virusCapStep: 10,
  /** Retry delay when every virus is dead and a new cluster is due. */
  virusRetry: 5,

  /** Firewalls wait for a damage-triggered switch; no automatic sweeps in the sandbox. */
  autoFirewalls: false,
  firewallSpawnDelay: 10,
  firewallInterval: 16,
  maxFirewalls: 3,
  infectionPerTouch: 0.08,
  infectionDecay: 0.015,
  /** Meter value after a thrall spawns, so the next copy is not instant. */
  infectionReset: 0.3,
} as const;

/** Segmented red worm. It is blocked by cover, but eats projectiles and viruses. */
export const WORM = {
  /** Assembly time before the chain starts moving. */
  spawnTime: 1.05,
  speed: 74,
  turnRate: 2.1,
  headRadius: 16,
  segmentRadius: 10,
  segments: 7,
  maxSegments: 12,
  spacing: 15,
  /** Enter this radius and the worm leaves its patch to defend it. */
  aggroRadius: 310,
  aggroTime: 5.5,
  territoryRadius: 230,
  patrolRadius: 150,
  patrolSpeedMult: 0.72,
  retargetMin: 2.2,
  retargetMax: 4.8,
  /** A longer meal makes a heavier, slower chain. */
  lengthSlow: 0.045,
  minSpeedMult: 0.62,
  hp: 5,
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
/**
 * Hostile shooter family. One pool, four silhouettes:
 * 0 pulse square, 1 nested triplex (shotgun), 2 trapezoid homing pod, 3 flock dart.
 */
export const SENTRY = {
  max: 5,
  /** Drop-in animation before the turret wakes up. */
  spawnTime: 0.7,
  spawnDelay: 9,
  interval: 30,
  minInterval: 9,
  /** First packs land sooner so the wide arenas are not empty at the start. */
  openingInterval: 24,
  /** Live shooters at wave 1, then +1 every capStep waves. */
  startCap: 2,
  capStep: 9,
  /** Waves that use the close opening pack and the longer first-shot delay. */
  openingWaves: 3,
  /** The opening pack orbits inside the camera window instead of at the far edge. */
  spawnViewX: 0.3,
  spawnViewY: 0.24,
  spawnMargin: 150,
  /** Opening silhouettes land first, then wait this long before their first shot. */
  openingFireMin: 5.5,
  openingFireMax: 7.5,
  /** The opening pair fires more slowly until the heavier families begin to arrive. */
  openingCadenceMult: 2.4,
  flockSize: 3,
  /** One silhouette lands at a time instead of an entire pack at once. */
  packStagger: 1.3,
  /** Common hit feedback. */
  knockDrag: 8,
  pulse: {
    radius: 18,
    hp: 2,
    speed: 82,
    keepMin: 200,
    keepMax: 340,
    strafe: 0.5,
    fireMin: 1.9,
    fireMax: 2.8,
    range: 380,
    boltSpeed: 365,
    boltTtl: 1.15,
    leash: 160,
  },
  triplex: {
    radius: 23,
    hp: 4,
    speed: 46,
    keepMin: 260,
    keepMax: 430,
    strafe: 0.18,
    fireMin: 3.2,
    fireMax: 4.4,
    range: 460,
    boltSpeed: 320,
    boltTtl: 1.45,
    leash: 100,
  },
  homing: {
    radius: 21,
    hp: 3,
    speed: 30,
    keepMin: 380,
    keepMax: 560,
    strafe: 0.1,
    fireMin: 4.2,
    fireMax: 5.4,
    range: 640,
    leash: 120,
  },
  flock: {
    radius: 10,
    hp: 1,
    speed: 138,
    keepMin: 150,
    keepMax: 280,
    strafe: 1.25,
    fireMin: 2.4,
    fireMax: 3.4,
    range: 300,
    boltSpeed: 290,
    boltTtl: 0.95,
    leash: 250,
  },
  /** Small direct shots and tight shotgun pellets. */
  boltRadius: 5,
  boltDamage: 1,
  missileRadius: 10,
  missileSpeed: 130,
  missileTurn: 2.2,
  missileTtl: 6.5,
} as const;

export const VIRUS = {
  spawnTime: 0.55,
  radius: 10,
  speed: 96,
  accel: 4,
  hp: 1,
  contactCooldown: 0.9,
  knockDrag: 9,
  splitInterval: 20,
  splitMinInterval: 10,
  orbit: 140,
  separation: 32,
  /** Lower score weighting makes an uninfected worm the preferred host. */
  targetWormBias: 0.55,
  /** Only chase a player who comes this close; otherwise spread across the sector. */
  huntRadius: 310,
  wormHuntRadius: 560,
  roamMin: 160,
  roamMax: 380,
  retargetMin: 2.4,
  retargetMax: 4.6,
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
  spawnTime: 0.45,
  spawnDelay: 8,
  /** Delay after the last block dies before a new root can appear. */
  reseedDelay: 30,
  growthInterval: 4,
  growthMinInterval: 2,
  blockSize: 30,
  cell: 36,
  maxBlocks: 14,
  /** The first colony starts small and grows its block cap over many waves. */
  startBlocks: 4,
  blockCapStep: 6,
  /** Three fast bolts, or three mine blasts, to clear one block. */
  hp: 3,
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
  /** Player damage per tick. Enemy factions take a heavier burn. */
  damage: 1,
  enemyDamage: 3,
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
  pillarFill: '#173247',
  pillarPanel: '#1e4159',
  pillarEdge: 'rgba(118, 230, 248, 0.8)',
  text: '#d7f6ff',
  textDim: 'rgba(160, 220, 235, 0.55)',
  danger: '#ff5a3c',
  neutral: '#bfe9ff',
  white: '#ffffff',
} as const;
