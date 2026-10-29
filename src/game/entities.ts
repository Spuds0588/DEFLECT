import { BOLT, MINE, CASCADING_ERROR, MAX_PROJECTILES, PLAYER, SENTRY, TRAIL_LEN, TRAINING, VIRUS, WORM } from './config';
import {
  PF,
  type CascadingError,
  type Drone,
  type Firewall,
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
    hp: PLAYER.hp,
    maxHp: PLAYER.hp,
    energy: PLAYER.energyMax,
    burstLeft: BOLT.burstCount,
    burstCd: 0,
    score: 0,
    alive: false,
    thrall: false,
    dashT: 0,
    dashCd: 0,
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
    chargeT: 0,
    chargeHeld: false,
    bugKind: 0,
    bugCd: 0,
    ghostT: 0,
    wallT: 0,
    wallFacing: 0,
    slowT: 0,
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
    orbitSign: 1,
    phase: 0,
    contactCd: 0,
    hitFlash: 0,
    kx: 0,
    ky: 0,
    spawnT: 0,
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
    spawnT: 0,
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
  p.hp = p.maxHp;
  p.energy = PLAYER.energyMax;
  p.burstLeft = BOLT.burstCount;
  p.burstCd = 0;
  p.alive = true;
  p.dashT = 0;
  p.dashCd = 0;
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
  p.chargeT = 0;
  p.chargeHeld = false;
  p.ghostT = 0;
  p.wallT = 0;
  p.slowT = 0;
  p.bugCd = 0;
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
