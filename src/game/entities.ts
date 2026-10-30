import { BOLT, FISHER, MINE, CASCADING_ERROR, MAX_PROJECTILES, PLAYER, POWERUP, SENTRY, TRAIL_LEN, TRAINING, VIRUS, WORM } from './config';
import {
  PF,
  type Barrier,
  type CascadingError,
  type Drone,
  type Firewall,
  type Lure,
  type Net,
  type Pickup,
  type Player,
  type Projectile,
  type Sentry,
  type Virus,
  type Worm,
} from './types';

export function createPlayer(slot: number): Player {
  return {
    active: false,
    connected: false,
    slot,
    name: '',
    program: 0,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    facing: 0,
    prevFacing: 0,
    swingFacing: 0,
    swingDir: -1,
    swingKind: 0,
    hp: PLAYER.hp,
    maxHp: PLAYER.hp,
    energy: PLAYER.energyMax,
    burstLeft: BOLT.burstCount,
    burstCd: 0,
    stringLeft: 0,
    stringT: 0,
    score: 0,
    alive: false,
    thrall: false,
    dashT: 0,
    dashCd: 0,
    dashCharges: PLAYER.dashCharges,
    moveDirX: 1,
    moveDirY: 0,
    dashDirX: 1,
    dashDirY: 0,
    dashKind: 0,
    dashChargeT: 0,
    dashChargeHeld: false,
    chargeDashCd: 0,
    dashHitPlayers: 0,
    dashHitWorms: 0,
    dashHitViruses: 0,
    dashHitErrors: 0,
    dashHitSentries: 0,
    dashHitDrone: false,
    bashT: 0,
    bashFacing: 0,
    bashHitPlayers: 0,
    bashHitWorms: 0,
    bashHitViruses: 0,
    bashHitErrors: 0,
    bashHitSentries: 0,
    bashHitDrone: false,
    wedgeT: 0,
    wedgeDirX: 1,
    wedgeDirY: 0,
    wedgeHitPlayers: 0,
    wedgeHitWorms: 0,
    wedgeHitViruses: 0,
    wedgeHitErrors: 0,
    wedgeHitSentries: 0,
    wedgeHitDrone: false,
    broT: 0,
    broDur: 0,
    broX: 0,
    broY: 0,
    broDirX: 1,
    broDirY: 0,
    broS: 0,
    broHitPlayers: 0,
    broHitWorms: 0,
    broHitViruses: 0,
    broHitErrors: 0,
    broHitSentries: 0,
    broHitDrone: false,
    fanT: 0,
    fanDur: 0,
    fanX: 0,
    fanY: 0,
    fanTx: 1,
    fanTy: 0,
    fanHitPlayers: 0,
    fanHitWorms: 0,
    fanHitViruses: 0,
    fanHitErrors: 0,
    fanHitSentries: 0,
    fanHitDrone: false,
    iframes: 0,
    swingPhase: 0,
    swingT: 0,
    swingPct: 0,
    swingHit: false,
    laserChargeHeld: false,
    laserChargeT: 0,
    laserT: 0,
    laserCd: 0,
    laserTickT: 0,
    laserFacing: 0,
    netDrawing: false,
    netT: 0,
    netIndex: -1,
    chargeT: 0,
    chargeHeld: false,
    guardT: 0,
    guardCd: 0,
    bugKind: 0,
    bugCd: 0,
    powerupKind: -1,
    powerupT: 0,
    autoFireT: 0,
    ghostT: 0,
    wallT: 0,
    wallFacing: 0,
    slowT: 0,
    travelKind: 0,
    travelT: 0,
    travelDur: 0,
    travelDwell: 0,
    travelCd: 0,
    travelLatch: false,
    travelToX: 0,
    travelToY: 0,
    travelSwap: false,
    netPinT: 0,
    waveT: 0,
    waveCd: 0,
    comboStage: 0,
    comboT: 0,
    lockKind: 0,
    lockId: -1,
    lockT: 0,
    lockActive: false,
    lockFacing: 0,
    hitFlash: 0,
    respawnT: 0,
  };
}

export function createProjectile(): Projectile {
  return {
    active: false,
    serial: 0,
    type: 0,
    owner: -1,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    radius: 7,
    damage: 1,
    deflects: 0,
    bounces: 0,
    fuse: 0,
    grace: 0,
    armed: false,
    homing: false,
    pathAxis: 0,
    hitPlayers: 0,
    hitWorms: 0,
    hitViruses: 0,
    hitErrors: 0,
    hitSentries: 0,
    hitDrone: false,
    trailX: new Float32Array(TRAIL_LEN),
    trailY: new Float32Array(TRAIL_LEN),
    trailHead: 0,
    trailCount: 0,
  };
}

export function createProjectilePool(): Projectile[] {
  const pool: Projectile[] = new Array(MAX_PROJECTILES);
  for (let i = 0; i < pool.length; i++) pool[i] = createProjectile();
  return pool;
}

export function createNet(): Net {
  return {
    active: false,
    owner: 0,
    xs: new Float32Array(FISHER.netPoints),
    ys: new Float32Array(FISHER.netPoints),
    count: 0,
    length: 0,
    life: 0,
    phase: 0,
  };
}

export function createBarrier(): Barrier {
  return {
    active: false,
    owner: 0,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    nx: 1,
    ny: 0,
    life: 0,
    maxLife: 1,
    phase: 0,
  };
}

export function createLure(): Lure {
  return {
    active: false,
    owner: 0,
    x: 0,
    y: 0,
    life: 0,
    phase: 0,
  };
}

export function createPickup(): Pickup {
  return {
    active: false,
    kind: 0,
    x: 0,
    y: 0,
    phase: 0,
    life: 0,
  };
}

export function createPickupPool(): Pickup[] {
  const pool: Pickup[] = new Array(POWERUP.maxActive);
  for (let i = 0; i < pool.length; i++) pool[i] = createPickup();
  return pool;
}

export function createDrone(): Drone {
  return {
    active: false,
    x: 640,
    y: 360,
    prevX: 640,
    prevY: 360,
    vx: 0,
    vy: 0,
    hp: TRAINING.droneHp,
    maxHp: TRAINING.droneHp,
    rot: 0,
    fireTimer: 1.4,
    respawnT: 0,
    targetX: 640,
    targetY: 360,
    hitFlash: 0,
    radius: TRAINING.droneRadius,
    netPinT: 0,
  };
}

export function createWorm(): Worm {
  return {
    active: false,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    hp: WORM.hp,
    maxHp: WORM.hp,
    anchorX: 0,
    anchorY: 0,
    patrolX: 0,
    patrolY: 0,
    retargetT: 0,
    aggroT: 0,
    segCount: 0,
    segX: new Float32Array(WORM.maxSegments),
    segY: new Float32Array(WORM.maxSegments),
    segPrevX: new Float32Array(WORM.maxSegments),
    segPrevY: new Float32Array(WORM.maxSegments),
    segAngle: new Float32Array(WORM.maxSegments),
    touchCd: 0,
    hitFlash: 0,
    kx: 0,
    ky: 0,
    infected: false,
    phase: 0,
    spawnT: 0,
    pinT: 0,
  };
}

export function createVirus(): Virus {
  return {
    active: false,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    hp: VIRUS.hp,
    maxHp: VIRUS.hp,
    radius: VIRUS.radius,
    targetWorm: -1,
    targetPlayer: false,
    roamX: 0,
    roamY: 0,
    retargetT: 0,
    orbitSign: 1,
    phase: 0,
    contactCd: 0,
    hitFlash: 0,
    kx: 0,
    ky: 0,
    spawnT: 0,
    pinT: 0,
  };
}

export function createCascadingError(): CascadingError {
  return {
    active: false,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    originX: 0,
    originY: 0,
    targetX: 0,
    targetY: 0,
    growT: 0,
    hp: CASCADING_ERROR.hp,
    maxHp: CASCADING_ERROR.hp,
    hitFlash: 0,
    touchCd: 0,
    phase: 0,
    spawnT: 0,
  };
}

export function createSentry(): Sentry {
  return {
    active: false,
    kind: 0,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    hp: SENTRY.pulse.hp,
    maxHp: SENTRY.pulse.hp,
    radius: SENTRY.pulse.radius,
    fireT: 1.5,
    phase: 0,
    hitFlash: 0,
    orbitSign: 1,
    anchorX: 0,
    anchorY: 0,
    leash: 0,
    spawnT: 0,
    pinT: 0,
  };
}

export function createFirewall(): Firewall {
  return {
    active: false,
    axis: 0,
    pos: 0,
    prevPos: 0,
    dir: 1,
    warnT: 0,
    tickT: 0,
    age: 0,
  };
}

export function clearPlayerForSpawn(p: Player, x: number, y: number, facing: number): void {
  p.x = x;
  p.y = y;
  p.prevX = x;
  p.prevY = y;
  p.vx = 0;
  p.vy = 0;
  p.kx = 0;
  p.ky = 0;
  p.facing = facing;
  p.prevFacing = facing;
  p.swingFacing = facing;
  p.swingDir = -1;
  p.swingKind = 0;
  p.hp = p.maxHp;
  p.energy = PLAYER.energyMax;
  p.burstLeft = BOLT.burstCount;
  p.burstCd = 0;
  p.stringLeft = 0;
  p.stringT = 0;
  p.alive = true;
  p.dashT = 0;
  p.dashCd = 0;
  p.dashCharges = PLAYER.dashCharges;
  p.dashKind = 0;
  p.dashChargeT = 0;
  p.dashChargeHeld = false;
  p.chargeDashCd = 0;
  p.moveDirX = Math.cos(facing);
  p.moveDirY = Math.sin(facing);
  p.dashHitPlayers = 0;
  p.dashHitWorms = 0;
  p.dashHitViruses = 0;
  p.dashHitErrors = 0;
  p.dashHitSentries = 0;
  p.dashHitDrone = false;
  p.bashT = 0;
  p.bashFacing = facing;
  p.bashHitPlayers = 0;
  p.bashHitWorms = 0;
  p.bashHitViruses = 0;
  p.bashHitErrors = 0;
  p.bashHitSentries = 0;
  p.bashHitDrone = false;
  p.wedgeT = 0;
  p.wedgeDirX = Math.cos(facing);
  p.wedgeDirY = Math.sin(facing);
  p.wedgeHitPlayers = 0;
  p.wedgeHitWorms = 0;
  p.wedgeHitViruses = 0;
  p.wedgeHitErrors = 0;
  p.wedgeHitSentries = 0;
  p.wedgeHitDrone = false;
  p.broT = 0;
  p.broDur = 0;
  p.broX = x;
  p.broY = y;
  p.broDirX = Math.cos(facing);
  p.broDirY = Math.sin(facing);
  p.broS = 0;
  p.broHitPlayers = 0;
  p.broHitWorms = 0;
  p.broHitViruses = 0;
  p.broHitErrors = 0;
  p.broHitSentries = 0;
  p.broHitDrone = false;
  p.fanT = 0;
  p.fanDur = 0;
  p.fanX = x;
  p.fanY = y;
  p.fanTx = 1;
  p.fanTy = 0;
  p.fanHitPlayers = 0;
  p.fanHitWorms = 0;
  p.fanHitViruses = 0;
  p.fanHitErrors = 0;
  p.fanHitSentries = 0;
  p.fanHitDrone = false;
  p.iframes = 0;
  p.swingPhase = 0;
  p.swingT = 0;
  p.swingPct = 0;
  p.swingHit = false;
  p.laserChargeHeld = false;
  p.laserChargeT = 0;
  p.laserT = 0;
  p.laserCd = 0;
  p.laserTickT = 0;
  p.laserFacing = facing;
  p.netDrawing = false;
  p.netT = 0;
  p.netIndex = -1;
  p.chargeT = 0;
  p.chargeHeld = false;
  p.guardT = 0;
  p.guardCd = 0;
  p.ghostT = 0;
  p.wallT = 0;
  p.slowT = 0;
  p.travelKind = 0;
  p.travelT = 0;
  p.travelDur = 0;
  p.travelDwell = 0;
  p.travelCd = 0;
  p.travelLatch = false;
  p.travelToX = x;
  p.travelToY = y;
  p.travelSwap = false;
  p.bugCd = 0;
  p.powerupKind = -1;
  p.powerupT = 0;
  p.autoFireT = 0;
  p.waveT = 0;
  p.waveCd = 0;
  p.comboStage = 0;
  p.comboT = 0;
  p.lockKind = 0;
  p.lockId = -1;
  p.lockT = 0;
  p.lockActive = false;
  p.lockFacing = facing;
  p.hitFlash = 0;
  p.respawnT = 0;
}

export function playerFlags(p: Player): number {
  let flags = 0;
  if (p.alive) flags |= PF.ALIVE;
  if (p.dashT > 0) flags |= PF.DASHING;
  if (p.dashT > 0 && p.dashKind === 1) flags |= PF.CHARGE_DASHING;
  if (p.iframes > 0) flags |= PF.INVULN;
  if (p.swingPhase === 1) flags |= PF.SWING_STARTUP;
  else if (p.swingPhase === 2) flags |= PF.SWING_ACTIVE;
  else if (p.swingPhase === 3) flags |= p.swingHit ? PF.SWING_HIT : PF.SWING_RECOVERY;
  if (p.connected) flags |= PF.CONNECTED;
  if (p.swingDir < 0) flags |= PF.SWING_REVERSE;
  if (p.waveT > 0) flags |= PF.WAVE;
  else if (p.chargeT >= PLAYER.waveHoldTime) flags |= PF.CHARGE_READY;
  if (p.guardT > 0) flags |= PF.GUARD;
  if (p.lockActive) flags |= PF.LOCKED;
  if (p.laserChargeHeld) flags |= PF.LASER_CHARGING;
  if (p.laserT > 0) flags |= PF.LASER_FIRING;
  if (p.ghostT > 0) flags |= PF.GHOST;
  if (p.wallT > 0) flags |= PF.WALL;
  if (p.slowT > 0) flags |= PF.SLOW;
  return flags;
}

export function mineFusePct(p: Projectile): number {
  return Math.max(0, Math.min(1, p.fuse / MINE.life));
}
