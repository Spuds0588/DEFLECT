import {
  BOLT,
  BUG,
  CASCADING_ERROR,
  MINE,
  FIREWALL,
  GAUNTLET,
  MAX_EVENTS,
  MAX_PLAYERS,
  PLAYER,
  ROUND,
  SENTRY,
  THRALL,
  TRAINING,
  VIRUS,
  WORM,
} from './config';
import { ARENAS, type ArenaDef } from './arenas';
import { circleRect, hitScratch } from './collision';
import {
  clearPlayerForSpawn,
  createCascadingError,
  createDrone,
  createFirewall,
  createPlayer,
  createProjectilePool,
  createSentry,
  createVirus,
  createWorm,
} from './entities';
import { computeSpawns, stepPlayerMotion } from './movement';
import { Rng } from './rng';
import {
  ACTION,
  EV,
  type CascadingError,
  type Drone,
  type Firewall,
  type GameEvent,
  type GameMode,
  type InputFrame,
  type Phase,
  type Player,
  type Projectile,
  type Sentry,
  type Virus,
  type Worm,
} from './types';

const SWING_COS = Math.cos(PLAYER.swingHalfAngle);
const EVENT_CAPACITY = MAX_EVENTS * 2;

/**
 * Authoritative simulation. Hosted locally for training and by the room host online.
 * No allocations inside step(); see AGENTS.md §3.
 */
export class World {
  readonly mode: GameMode;
  readonly arena: ArenaDef;
  readonly players: Player[];
  readonly projectiles: Projectile[];
  readonly drone: Drone;
  readonly worms: Worm[];
  readonly viruses: Virus[];
  readonly firewalls: Firewall[];
  readonly errors: CascadingError[];
  readonly sentries: Sentry[];
  infection = 0;
  gauntletKills = 0;
  /** Escalation wave in gauntlet mode. Purely local presentation + spawn pacing. */
  wave = 1;
  waveBannerT = 0;

  phase: Phase;
  phaseTimer = 0;
  round = 1;
  roundTimer = 0;
  roundWinner = -1;
  matchWinner = -1;
  localSlot: number;

  readonly events: GameEvent[];
  eventCount = 0;

  private serial = 0;
  private rng = new Rng(0xd3f1ec7);
  private spawnX = new Float32Array(MAX_PLAYERS);
  private spawnY = new Float32Array(MAX_PLAYERS);
  private spawnTmpX = new Float32Array(MAX_PLAYERS);
  private spawnTmpY = new Float32Array(MAX_PLAYERS);
  private wormSpawnT: number = GAUNTLET.wormSpawnDelay;
  private virusSpawnT: number = GAUNTLET.virusSpawnDelay;
  private firewallSpawnT: number = GAUNTLET.firewallSpawnDelay;
  private sentrySpawnT: number = SENTRY.spawnDelay;
  private sentryPack = 0;
  private errorSpawnT: number = CASCADING_ERROR.spawnDelay;
  private errorGrowT: number = CASCADING_ERROR.growthInterval;
  private virusSplitT: number = VIRUS.splitInterval;
  private gauntletT = 0;
  private thrallFrame: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
  private thrallShootT = 0;
  private thrallSwingT = 0;
  private thrallDashT = 0;

  private get centerX(): number {
    return (this.arena.bounds.left + this.arena.bounds.right) * 0.5;
  }

  private get centerY(): number {
    return (this.arena.bounds.top + this.arena.bounds.bottom) * 0.5;
  }

  constructor(mode: GameMode, names: string[], localSlot = 0, arena: ArenaDef = ARENAS[0]) {
    this.mode = mode;
    this.arena = arena;
    this.localSlot = localSlot;
    this.players = new Array(MAX_PLAYERS);
    for (let i = 0; i < MAX_PLAYERS; i++) this.players[i] = createPlayer(i);
    this.projectiles = createProjectilePool();
    this.drone = createDrone();
    this.worms = new Array(GAUNTLET.maxWorms);
    for (let i = 0; i < this.worms.length; i++) this.worms[i] = createWorm();
    this.viruses = new Array(GAUNTLET.maxViruses);
    for (let i = 0; i < this.viruses.length; i++) this.viruses[i] = createVirus();
    this.firewalls = new Array(GAUNTLET.maxFirewalls);
    for (let i = 0; i < this.firewalls.length; i++) this.firewalls[i] = createFirewall();
    this.errors = new Array(CASCADING_ERROR.maxBlocks);
    for (let i = 0; i < this.errors.length; i++) this.errors[i] = createCascadingError();
    this.sentries = new Array(SENTRY.max);
    for (let i = 0; i < this.sentries.length; i++) this.sentries[i] = createSentry();
    this.events = new Array(EVENT_CAPACITY);
    for (let i = 0; i < EVENT_CAPACITY; i++) this.events[i] = { kind: 0, slot: 0, x: 0, y: 0, power: 0, dirX: 0, dirY: 0 };

    for (let i = 0; i < MAX_PLAYERS; i++) {
      const name = names[i];
      if (name) {
        const p = this.players[i];
        p.active = true;
        p.connected = true;
        p.name = name;
        p.score = 0;
      }
    }
    // Each operator gets one random bug for the session. No loadout choice.
    for (let i = 0; i < MAX_PLAYERS; i++) {
      this.players[i].bugKind = Math.floor(this.rng.next() * 4);
    }

    if (mode === 'training') {
      this.phase = 'practice';
      const p = this.players[0];
      computeSpawns(1, arena, this.spawnX, this.spawnY);
      const left = arena.spawns[6];
      this.spawnX[0] = left.x;
      this.spawnY[0] = left.y;
      clearPlayerForSpawn(p, left.x, left.y, 0);
      this.spawnDrone(true);
    } else if (mode === 'gauntlet') {
      this.phase = 'practice';
      this.setupGauntlet();
    } else {
      this.phase = 'countdown';
      this.beginRound();
    }
  }

  private setupGauntlet(): void {
    const p = this.players[0];
    const left = this.arena.spawns[6];
    this.spawnX[0] = left.x;
    this.spawnY[0] = left.y;
    clearPlayerForSpawn(p, left.x, left.y, 0);
    p.thrall = false;
    this.infection = 0;
    this.gauntletKills = 0;
    this.gauntletT = 0;
    this.wave = 1;
    this.waveBannerT = 0;
    this.wormSpawnT = GAUNTLET.wormSpawnDelay;
    this.virusSpawnT = GAUNTLET.virusSpawnDelay;
    this.firewallSpawnT = GAUNTLET.firewallSpawnDelay;
    this.sentrySpawnT = SENTRY.spawnDelay;
    this.sentryPack = 0;
    this.errorSpawnT = CASCADING_ERROR.spawnDelay;
    this.errorGrowT = CASCADING_ERROR.growthInterval;
    this.virusSplitT = VIRUS.splitInterval;
    for (let i = 0; i < this.worms.length; i++) this.worms[i].active = false;
    for (let i = 0; i < this.viruses.length; i++) this.viruses[i].active = false;
    for (let i = 0; i < this.firewalls.length; i++) this.firewalls[i].active = false;
    for (let i = 0; i < this.errors.length; i++) this.errors[i].active = false;
    for (let i = 0; i < this.sentries.length; i++) this.sentries[i].active = false;
    for (let i = 1; i < this.players.length; i++) {
      this.players[i].active = false;
      this.players[i].alive = false;
    }
  }

  activeCount(): number {
    let n = 0;
    for (let i = 0; i < this.players.length; i++) if (this.players[i].active) n++;
    return n;
  }

  aliveCount(): number {
    let n = 0;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.active && p.alive) n++;
    }
    return n;
  }

  setName(slot: number, name: string): void {
    if (slot >= 0 && slot < MAX_PLAYERS) this.players[slot].name = name;
  }

  removePlayer(slot: number): void {
    if (slot < 0 || slot >= MAX_PLAYERS) return;
    const p = this.players[slot];
    p.active = false;
    p.connected = false;
    p.alive = false;
  }

  resetMatch(): void {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      p.score = 0;
      if (!p.active) p.alive = false;
    }
    this.round = 1;
    this.matchWinner = -1;
    this.roundWinner = -1;
    this.beginRound();
  }

  beginRound(): void {
    const active = this.activeCount();
    if (active === 0) return;
    computeSpawns(active, this.arena, this.spawnTmpX, this.spawnTmpY);
    let index = 0;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active) continue;
      this.spawnX[p.slot] = this.spawnTmpX[index];
      this.spawnY[p.slot] = this.spawnTmpY[index];
      index++;
    }
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active) continue;
      const sx = this.spawnX[p.slot];
      const sy = this.spawnY[p.slot];
      const facing = Math.atan2(this.centerY - sy, this.centerX - sx);
      clearPlayerForSpawn(p, sx, sy, facing);
    }
    for (let i = 0; i < this.projectiles.length; i++) this.projectiles[i].active = false;
    this.phase = 'countdown';
    this.phaseTimer = ROUND.countdown;
    this.roundTimer = ROUND.timeLimit;
    this.roundWinner = -1;
    this.emit(EV.ROUND_START, -1, this.centerX, this.centerY, this.round);
  }

  /** Advances the simulation one fixed step. Consumes `pressed` bits from the provided frames. */
  step(dt: number, inputs: (InputFrame | null)[]): void {
    if (this.mode === 'match') {
      if (this.phase === 'matchend') {
        this.clearPressed(inputs);
        return;
      }
      if (this.phase === 'roundover') {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          if (this.matchWinner >= 0) {
            this.phase = 'matchend';
            this.phaseTimer = 0;
            this.emit(EV.MATCH_END, this.matchWinner, this.centerX, this.centerY, this.matchWinner);
          } else {
            this.round++;
            this.beginRound();
          }
        }
        this.clearPressed(inputs);
        return;
      }
      if (this.phase === 'countdown') {
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phase = 'live';
          this.phaseTimer = 0;
          this.roundTimer = ROUND.timeLimit;
        }
      } else if (this.phase === 'live') {
        this.roundTimer = Math.max(0, this.roundTimer - dt);
      }
    } else {
      this.phase = 'practice';
    }

    const canAct = this.phase === 'live' || this.phase === 'practice';
    if (this.mode === 'gauntlet') this.driveThrall(dt);

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active) continue;
      if (!p.alive) {
        if (this.mode === 'gauntlet' && p.slot > 0) {
          p.active = false;
          p.thrall = false;
          continue;
        }
        if (this.mode === 'training' || this.mode === 'gauntlet') {
          p.respawnT -= dt;
          if (p.respawnT <= 0) this.respawnTrainingPlayer(p);
        }
        continue;
      }

      p.prevX = p.x;
      p.prevY = p.y;
      p.prevFacing = p.facing;

      if (p.dashT > 0) p.dashT = Math.max(0, p.dashT - dt);
      if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
      if (p.chargeDashCd > 0) p.chargeDashCd = Math.max(0, p.chargeDashCd - dt);
      if (p.laserCd > 0) p.laserCd = Math.max(0, p.laserCd - dt);
      if (p.laserT > 0) {
        p.laserT = Math.max(0, p.laserT - dt);
        p.laserTickT -= dt;
        if (p.laserTickT <= 0) {
          p.laserTickT += PLAYER.laserTick;
          this.applyLaserDamage(p);
        }
        if (p.laserT === 0) p.laserCd = PLAYER.laserCooldown;
      }
      if (p.burstCd > 0) {
        p.burstCd = Math.max(0, p.burstCd - dt);
        if (p.burstCd === 0) p.burstLeft = BOLT.burstCount;
      }
      if (p.iframes > 0) p.iframes = Math.max(0, p.iframes - dt);
      if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.waveT > 0) p.waveT = Math.max(0, p.waveT - dt);
      if (p.waveCd > 0) p.waveCd = Math.max(0, p.waveCd - dt);
      if (p.bugCd > 0) p.bugCd = Math.max(0, p.bugCd - dt);
      if (p.ghostT > 0) p.ghostT = Math.max(0, p.ghostT - dt);
      if (p.wallT > 0) p.wallT = Math.max(0, p.wallT - dt);
      if (p.slowT > 0) p.slowT = Math.max(0, p.slowT - dt);
      if (p.comboT > 0) {
        p.comboT = Math.max(0, p.comboT - dt);
        if (p.comboT === 0) p.comboStage = 0;
      }
      this.tickSwing(p, dt);

      const input = this.mode === 'gauntlet' && p.thrall ? this.thrallFrame : (inputs[p.slot] ?? null);
      // Remember the last real stick direction. A dash commits to it even when lock is
      // holding facing on a target, so strafing past an enemy and dashing goes sideways.
      if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
        p.moveDirX = input.mx;
        p.moveDirY = input.my;
      }
      let laserBusy = p.laserT > 0 || p.laserChargeHeld;
      this.updateLock(p, laserBusy ? null : canAct ? input : null, canAct, dt);
      // Facing must follow the stick before the action snapshot is taken, otherwise a
      // dash/swing started while turning would use last frame's facing.
      if (
        input &&
        !laserBusy &&
        !p.lockActive &&
        input.mx * input.mx + input.my * input.my > 0.0025 &&
        p.swingPhase === 0 &&
        p.dashT <= 0
      ) {
        p.facing = Math.atan2(input.my, input.mx);
      }

      // Heavy attack: a tap plants a proximity mine; holding builds the beam charge and
      // releasing after the charge fires it. Either state roots the player.
      const heavyHeld = !!input && canAct && (input.held & ACTION.CANDLE) !== 0;
      if (p.laserChargeHeld) {
        if (canAct && heavyHeld) {
          p.laserChargeT += dt;
          // Rooted feet, free aim: the beam can be swept while charging.
          if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
            p.facing = Math.atan2(input.my, input.mx);
          }
          p.laserFacing = p.facing;
          // The beam commits itself the moment the charge completes. The player does
          // not have to release the button; that would add an unreadable extra beat.
          if (p.laserChargeT >= PLAYER.laserChargeTime) this.fireLaser(p);
        } else {
          if (canAct && p.laserChargeT >= PLAYER.laserChargeTime) {
            this.fireLaser(p);
          } else if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) {
            this.useBug(p);
          }
          p.laserChargeHeld = false;
          p.laserChargeT = 0;
          p.chargeT = 0;
          p.chargeHeld = false;
          if (p.laserT > 0) laserBusy = true;
        }
      } else if (p.laserT > 0) {
        if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
          // A live beam sweeps slowly. Wide aim snaps would make a 3 s beam feel like a
          // whip and undercut the commitment of choosing the firing line first.
          let delta = Math.atan2(input.my, input.mx) - p.laserFacing;
          delta = Math.atan2(Math.sin(delta), Math.cos(delta));
          const maxTurn = PLAYER.laserTurnRate * dt;
          p.laserFacing += Math.max(-maxTurn, Math.min(maxTurn, delta));
          p.facing = p.laserFacing;
        }
        p.laserFacing = p.facing;
      } else if (canAct && input) {
        const heldSwing = (input.held & ACTION.SWING) !== 0;
        if (input.pressed & ACTION.SWING) {
          p.chargeT = 0;
          this.handleDeflectPress(p);
        }
        if (heldSwing) {
          p.chargeT += dt;
        } else {
          if (
            p.chargeHeld &&
            p.chargeT >= PLAYER.waveHoldTime &&
            p.waveCd <= 0 &&
            p.waveT <= 0 &&
            p.swingPhase === 0
          ) {
            this.fireShieldWave(p);
          }
          p.chargeT = 0;
        }
        p.chargeHeld = heldSwing;
        const heldDash = (input.held & ACTION.DASH) !== 0;
        if (input.pressed & ACTION.DASH) {
          p.dashChargeT = 0;
          this.tryDash(p);
        }
        if (heldDash) p.dashChargeT += dt;
        else {
          if (
            p.dashChargeHeld &&
            p.dashChargeT >= PLAYER.dashChargeTime &&
            p.chargeDashCd <= 0
          ) {
            this.tryChargeDash(p);
          }
          p.dashChargeT = 0;
        }
        p.dashChargeHeld = heldDash;
        if (input.pressed & ACTION.BOLT) this.tryShoot(p);
        if (input.pressed & ACTION.CANDLE) {
          if (
            p.laserCd <= 0 &&
            p.energy >= PLAYER.laserCost &&
            p.swingPhase === 0 &&
            p.dashT <= 0 &&
            p.waveT <= 0
          ) {
            p.laserChargeHeld = true;
            p.laserChargeT = 0;
            p.laserFacing = p.facing;
            p.ghostT = 0;
            p.chargeT = 0;
            p.chargeHeld = false;
            p.comboStage = 0;
            p.comboT = 0;
            p.lockActive = false;
            p.lockKind = 0;
            p.lockId = -1;
            laserBusy = true;
          } else {
            this.useBug(p);
          }
        }
      } else {
        p.chargeT = 0;
        p.chargeHeld = false;
        p.dashChargeHeld = false;
      }

      if (p.swingPhase === 2) {
        this.resolveSwing(p);
        if (p.swingPhase === 2) this.resolveSwingContact(p);
      }

      p.energy = Math.min(PLAYER.energyMax, p.energy + PLAYER.energyRegen * dt);
      stepPlayerMotion(
        p,
        laserBusy || !input ? 0 : input.mx,
        laserBusy || !input ? 0 : input.my,
        dt,
        this.arena.pillars,
        this.arena.bounds,
      );
      if (p.dashT > 0 && p.dashKind === 1) this.resolveChargeDash(p);
    }

    this.updateDrone(dt);
    this.updateProjectiles(dt);
    if (this.mode === 'gauntlet') this.updateGauntlet(dt);

    if (this.mode === 'match' && this.phase === 'live') {
      const active = this.activeCount();
      if (active >= 2) {
        const alive = this.aliveCount();
        if (alive <= 1) {
          let survivor = -1;
          for (let i = 0; i < this.players.length; i++) {
            const p = this.players[i];
            if (p.active && p.alive) survivor = p.slot;
          }
          this.finishRound(survivor);
        } else if (this.roundTimer <= 0) {
          this.finishRound(-1);
        }
      }
    }

    this.clearPressed(inputs);
  }

  clearEvents(): void {
    this.eventCount = 0;
  }

  private clearPressed(inputs: (InputFrame | null)[]): void {
    for (let i = 0; i < inputs.length; i++) {
      const f = inputs[i];
      if (f) f.pressed = 0;
    }
  }

  private finishRound(winnerSlot: number): void {
    this.roundWinner = winnerSlot;
    this.phase = 'roundover';
    this.phaseTimer = ROUND.roundEndHold;
    if (winnerSlot >= 0) {
      const winner = this.players[winnerSlot];
      winner.score++;
      if (winner.score >= ROUND.winsNeeded) this.matchWinner = winnerSlot;
    }
    this.emit(EV.ROUND_END, winnerSlot, this.centerX, this.centerY, this.round);
  }

  private tickSwing(p: Player, dt: number): void {
    if (p.swingPhase === 0) return;
    p.swingT -= dt;
    if (p.swingPhase === 1) {
      p.swingPct = Math.max(0, p.swingT / PLAYER.swingStartup);
      if (p.swingT <= 0) {
        p.swingPhase = 2;
        p.swingT = PLAYER.swingActive;
        p.swingPct = 1;
      }
    } else if (p.swingPhase === 2) {
      p.swingPct = Math.max(0, p.swingT / PLAYER.swingActive);
      if (p.swingT <= 0) {
        p.swingPhase = 3;
        p.swingT = p.swingHit ? PLAYER.swingHitRecovery : PLAYER.swingWhiffRecovery;
        p.swingPct = 1;
      }
    } else {
      p.swingPct = Math.max(0, p.swingT / (p.swingHit ? PLAYER.swingHitRecovery : PLAYER.swingWhiffRecovery));
      if (p.swingT <= 0) {
        p.swingPhase = 0;
        p.swingT = 0;
        p.swingPct = 0;
        p.swingHit = false;
      }
    }
  }

  private tryDash(p: Player): void {
    if (p.dashT > 0 || p.dashCd > 0 || p.swingPhase !== 0) return;
    const dir = Math.atan2(p.moveDirY, p.moveDirX);
    p.dashT = PLAYER.dashTime;
    p.dashCd = PLAYER.dashCooldown;
    p.dashKind = 0;
    p.dashDirX = Math.cos(dir);
    p.dashDirY = Math.sin(dir);
    p.iframes = Math.max(p.iframes, PLAYER.dashIframes);
    this.emit(EV.DASH, p.slot, p.x, p.y, dir);
  }

  private tryChargeDash(p: Player): void {
    if (p.chargeDashCd > 0 || p.dashT > 0 || p.swingPhase !== 0) return;
    const dir = Math.atan2(p.moveDirY, p.moveDirX);
    p.dashT = PLAYER.chargeDashTime;
    p.dashCd = PLAYER.dashCooldown;
    p.chargeDashCd = PLAYER.chargeDashCooldown;
    p.dashKind = 1;
    p.dashDirX = Math.cos(dir);
    p.dashDirY = Math.sin(dir);
    p.iframes = Math.max(p.iframes, PLAYER.chargeDashIframes);
    p.dashHitPlayers = 0;
    p.dashHitWorms = 0;
    p.dashHitViruses = 0;
    p.dashHitErrors = 0;
    p.dashHitSentries = 0;
    p.dashHitDrone = false;
    this.emit(EV.DASH, p.slot, p.x, p.y, dir);
  }

  private handleDeflectPress(p: Player): void {
    p.ghostT = 0;
    if (p.comboStage === 2 && p.comboT > 0) {
      if (p.waveCd <= 0 && p.swingPhase === 0) this.fireShieldWave(p);
      return;
    }
    const dir = p.comboStage === 1 && p.comboT > 0 ? -1 : 1;
    if (!this.trySwing(p, dir)) return;
    p.comboStage = dir === -1 ? 2 : 1;
    p.comboT = PLAYER.comboWindow;
  }

  private trySwing(p: Player, dir: number): boolean {
    if (p.swingPhase !== 0 || p.dashT > 0 || p.waveT > 0) return false;
    p.swingPhase = 1;
    p.swingT = PLAYER.swingStartup;
    p.swingPct = 1;
    p.swingHit = false;
    p.swingFacing = p.facing;
    p.swingDir = dir;
    this.emit(EV.SWING, p.slot, p.x, p.y, p.facing);
    return true;
  }

  /** Forward shield wave: short corridor, straight reflection, heavy shove. */
  private fireShieldWave(p: Player): void {
    const dirX = Math.cos(p.facing);
    const dirY = Math.sin(p.facing);
    p.waveT = PLAYER.waveVisualTime;
    p.waveCd = PLAYER.waveCooldown;
    p.chargeT = 0;
    p.comboStage = 0;
    p.comboT = 0;
    p.kx += dirX * PLAYER.waveLunge;
    p.ky += dirY * PLAYER.waveLunge;
    this.emit(EV.SHIELD_WAVE, p.slot, p.x, p.y, p.facing);

    const range = PLAYER.waveRange;
    const halfWidth = PLAYER.waveHalfWidth;
    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.iframes > 0) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const forward = dx * dirX + dy * dirY;
      const lateral = Math.abs(dx * dirY - dy * dirX);
      if (forward < 0 || forward > range + PLAYER.radius || lateral > halfWidth + PLAYER.radius) continue;
      if (this.lineBlocked(p.x, p.y, target.x, target.y)) continue;
      this.damagePlayer(target, PLAYER.waveDamage, p.slot, dirX, dirY, PLAYER.waveKnockback);
    }

    if (this.mode === 'training' && this.drone.active) {
      const dx = this.drone.x - p.x;
      const dy = this.drone.y - p.y;
      const forward = dx * dirX + dy * dirY;
      const lateral = Math.abs(dx * dirY - dy * dirX);
      if (
        forward >= 0 &&
        forward <= range + this.drone.radius &&
        lateral <= halfWidth + this.drone.radius &&
        !this.lineBlocked(p.x, p.y, this.drone.x, this.drone.y)
      ) {
        this.damageDrone(PLAYER.waveDamage, p.slot);
      }
    }

    if (this.mode === 'gauntlet') {
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (!w.active) continue;
        const dx = w.x - p.x;
        const dy = w.y - p.y;
        const forward = dx * dirX + dy * dirY;
        const lateral = Math.abs(dx * dirY - dy * dirX);
        if (forward < 0 || forward > range + WORM.headRadius || lateral > halfWidth + WORM.headRadius) continue;
        if (this.lineBlocked(p.x, p.y, w.x, w.y)) continue;
        this.damageWorm(w, PLAYER.waveDamage, p.slot, dirX, dirY, PLAYER.waveKnockback);
      }
      for (let i = 0; i < this.viruses.length; i++) {
        const v = this.viruses[i];
        if (!v.active) continue;
        const dx = v.x - p.x;
        const dy = v.y - p.y;
        const forward = dx * dirX + dy * dirY;
        const lateral = Math.abs(dx * dirY - dy * dirX);
        if (forward < 0 || forward > range + v.radius || lateral > halfWidth + v.radius) continue;
        if (this.lineBlocked(p.x, p.y, v.x, v.y)) continue;
        this.damageVirus(v, PLAYER.waveDamage, p.slot, dirX, dirY, PLAYER.waveKnockback);
      }
      for (let i = 0; i < this.sentries.length; i++) {
        const s = this.sentries[i];
        if (!s.active) continue;
        const dx = s.x - p.x;
        const dy = s.y - p.y;
        const forward = dx * dirX + dy * dirY;
        const lateral = Math.abs(dx * dirY - dy * dirX);
        if (forward < 0 || forward > range + s.radius || lateral > halfWidth + s.radius) continue;
        if (this.lineBlocked(p.x, p.y, s.x, s.y)) continue;
        this.damageSentry(s, PLAYER.waveDamage, p.slot, dirX, dirY, PLAYER.waveKnockback);
      }
      for (let i = 0; i < this.errors.length; i++) {
        const e = this.errors[i];
        if (!e.active) continue;
        const radius = CASCADING_ERROR.blockSize * 0.5;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const forward = dx * dirX + dy * dirY;
        const lateral = Math.abs(dx * dirY - dy * dirX);
        if (forward < 0 || forward > range + radius || lateral > halfWidth + radius) continue;
        if (this.lineBlocked(p.x, p.y, e.x, e.y)) continue;
        this.damageError(e, PLAYER.waveDamage, p.slot, dirX, dirY);
      }
    }

    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      const forward = dx * dirX + dy * dirY;
      const lateral = Math.abs(dx * dirY - dy * dirX);
      if (forward < 0 || forward > range + proj.radius || lateral > halfWidth + proj.radius) continue;
      if (proj.vx * dirX + proj.vy * dirY >= 0) continue;
      if (this.lineBlocked(p.x, p.y, proj.x, proj.y)) continue;
      if (proj.type === 1) {
        this.explodeMine(proj, proj.owner);
        continue;
      }
      const wasMissile = proj.type === 4;
      if (proj.type >= 3) proj.type = 0;
      const speed = Math.min(
        BOLT.maxSpeed,
        Math.max(Math.hypot(proj.vx, proj.vy), wasMissile ? BOLT.speed : 0) * BOLT.deflectMult,
      );
      proj.vx = dirX * speed;
      proj.vy = dirY * speed;
      proj.owner = p.slot;
      proj.deflects++;
      proj.damage = BOLT.damage + proj.deflects;
      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      this.emit(EV.DEFLECT, p.slot, proj.x, proj.y, proj.deflects);
    }
  }

  /** Commits the charged beam. The player is rooted for the full firing window. */
  private fireLaser(p: Player): void {
    p.ghostT = 0;
    p.energy = Math.max(0, p.energy - PLAYER.laserCost);
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.laserT = PLAYER.laserDuration;
    p.laserTickT = PLAYER.laserTick;
    p.laserFacing = p.facing;
    p.chargeT = 0;
    p.chargeHeld = false;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    this.emit(EV.LASER, p.slot, p.x, p.y, p.laserFacing);
    this.applyLaserDamage(p);
  }

  /** Beam hit test: inside the narrow corridor, in front, and not behind cover. */
  private laserHits(p: Player, x: number, y: number, radius: number): boolean {
    const cos = Math.cos(p.laserFacing);
    const sin = Math.sin(p.laserFacing);
    const dx = x - p.x;
    const dy = y - p.y;
    const forward = dx * cos + dy * sin;
    if (forward < 0 || forward > PLAYER.laserRange) return false;
    const lateral = Math.abs(dy * cos - dx * sin);
    if (lateral > PLAYER.laserHalfWidth + radius) return false;
    return !this.lineBlocked(p.x, p.y, x, y);
  }

  /** Every hostile in the line takes a tick. The beam deliberately does not stop at the first. */
  private applyLaserDamage(p: Player): void {
    const dirX = Math.cos(p.laserFacing);
    const dirY = Math.sin(p.laserFacing);
    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.iframes > 0 || target.ghostT > 0) continue;
      if (!this.laserHits(p, target.x, target.y, PLAYER.radius)) continue;
      this.damagePlayer(target, PLAYER.laserDamage, p.slot, dirX, dirY, PLAYER.laserKnockback);
    }

    if (this.mode === 'training' && this.drone.active && this.laserHits(p, this.drone.x, this.drone.y, this.drone.radius)) {
      this.damageDrone(PLAYER.laserDamage, p.slot);
    }

    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      // The whole chain is a target. Checking only the head made beams that crossed a
      // worm's body look like they passed through without damage.
      let hit = this.laserHits(p, w.x, w.y, WORM.headRadius);
      if (!hit) {
        for (let s = 0; s < w.segCount; s++) {
          if (this.laserHits(p, w.segX[s], w.segY[s], WORM.segmentRadius)) {
            hit = true;
            break;
          }
        }
      }
      if (!hit) continue;
      this.damageWorm(w, PLAYER.laserDamage, p.slot, dirX, dirY);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || !this.laserHits(p, v.x, v.y, v.radius)) continue;
      this.damageVirus(v, PLAYER.laserDamage, p.slot, dirX, dirY, PLAYER.laserKnockback * 0.4);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active || !this.laserHits(p, s.x, s.y, s.radius)) continue;
      this.damageSentry(s, PLAYER.laserDamage, p.slot, dirX, dirY, PLAYER.laserKnockback);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active || !this.laserHits(p, e.x, e.y, CASCADING_ERROR.blockSize * 0.5)) continue;
      this.damageError(e, PLAYER.laserDamage, p.slot, dirX, dirY);
    }
  }

  private updateLock(p: Player, input: InputFrame | null, canAct: boolean, dt: number): void {
    const held = !!input && canAct && p.alive && (input.held & ACTION.LOCK) !== 0;
    if (!held) {
      p.lockKind = 0;
      p.lockId = -1;
      p.lockT = 0;
      p.lockActive = false;
      return;
    }
    p.lockT += dt;
    let tx = 0;
    let ty = 0;
    let valid = false;
    if (p.lockKind === 1) {
      const target = this.players[p.lockId];
      if (target && target.active && target.alive) {
        tx = target.x;
        ty = target.y;
        valid = true;
      }
    } else if (p.lockKind === 2) {
      const target = this.worms[p.lockId];
      if (target && target.active) {
        tx = target.x;
        ty = target.y;
        valid = true;
      }
    } else if (p.lockKind === 3) {
      const target = this.viruses[p.lockId];
      if (target && target.active) {
        tx = target.x;
        ty = target.y;
        valid = true;
      }
    } else if (p.lockKind === 4) {
      if (this.drone.active) {
        tx = this.drone.x;
        ty = this.drone.y;
        valid = true;
      }
    }
    const maxD2 = PLAYER.lockRange * PLAYER.lockRange;
    if (valid) {
      const dx = tx - p.x;
      const dy = ty - p.y;
      if (dx * dx + dy * dy > maxD2 || this.lineBlocked(p.x, p.y, tx, ty)) valid = false;
    }
    if (!valid) {
      p.lockKind = 0;
      p.lockId = -1;
      p.lockT = 0;
      let best = maxD2;
      for (let i = 0; i < this.players.length; i++) {
        const target = this.players[i];
        if (target === p || !target.active || !target.alive) continue;
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= best || this.lineBlocked(p.x, p.y, target.x, target.y)) continue;
        best = d2;
        p.lockKind = 1;
        p.lockId = i;
        tx = target.x;
        ty = target.y;
      }
      for (let i = 0; i < this.worms.length; i++) {
        const target = this.worms[i];
        if (!target.active) continue;
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= best || this.lineBlocked(p.x, p.y, target.x, target.y)) continue;
        best = d2;
        p.lockKind = 2;
        p.lockId = i;
        tx = target.x;
        ty = target.y;
      }
      for (let i = 0; i < this.viruses.length; i++) {
        const target = this.viruses[i];
        if (!target.active) continue;
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= best || this.lineBlocked(p.x, p.y, target.x, target.y)) continue;
        best = d2;
        p.lockKind = 3;
        p.lockId = i;
        tx = target.x;
        ty = target.y;
      }
      if (this.mode === 'training' && this.drone.active) {
        const dx = this.drone.x - p.x;
        const dy = this.drone.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < best && !this.lineBlocked(p.x, p.y, this.drone.x, this.drone.y)) {
          p.lockKind = 4;
          p.lockId = 0;
          tx = this.drone.x;
          ty = this.drone.y;
        }
      }
    }
    p.lockActive = p.lockKind !== 0 && p.lockT >= PLAYER.lockAcquire;
    if (p.lockActive) {
      p.lockFacing = Math.atan2(ty - p.y, tx - p.x);
      p.facing = p.lockFacing;
    }
  }

  private tryShoot(p: Player): void {
    if (p.swingPhase !== 0 || p.dashT > 0) return;
    p.ghostT = 0;
    if (p.burstCd > 0 || p.burstLeft <= 0) return;
    if (p.energy < BOLT.cost) return;
    if (!this.spawnProjectile(p)) return;
    p.energy -= BOLT.cost;
    p.burstLeft--;
    if (p.burstLeft <= 0) p.burstCd = BOLT.burstCooldown;
    this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
  }

  /** Fires the randomly assigned bug on the strong-attack tap. */
  private useBug(p: Player): void {
    if (p.swingPhase !== 0 || p.dashT > 0) return;
    if (p.bugCd > 0 || p.energy < BUG.cost) return;
    p.ghostT = 0;
    p.bugCd = BUG.cooldown[p.bugKind] ?? 6;
    p.energy -= BUG.cost;
    if (p.bugKind === 0) {
      this.plantMine(p);
    } else if (p.bugKind === 1) {
      this.plantTrap(p);
    } else if (p.bugKind === 2) {
      p.wallT = BUG.wallDuration;
      p.wallFacing = p.facing;
    } else {
      p.ghostT = BUG.ghostDuration;
    }
    this.emit(EV.BUG, p.slot, p.x, p.y, p.bugKind, Math.cos(p.facing), Math.sin(p.facing));
  }

  /** Drops a timed proximity mine at the player's feet. No throw, no travel. */
  private plantMine(p: Player): void {
    let proj: Projectile | null = null;
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) {
        proj = this.projectiles[i];
        break;
      }
    }
    if (!proj) return;

    proj.active = true;
    proj.serial = ++this.serial;
    proj.type = 1;
    proj.owner = p.slot;
    proj.x = p.x;
    proj.y = p.y;
    proj.prevX = p.x;
    proj.prevY = p.y;
    proj.vx = 0;
    proj.vy = 0;
    proj.radius = MINE.radius;
    proj.damage = MINE.blastDamage;
    proj.deflects = 0;
    proj.bounces = 0;
    proj.fuse = MINE.life;
    proj.grace = MINE.armTime;
    proj.armed = false;
    proj.trailHead = 0;
    proj.trailCount = 0;
    this.emit(EV.PLANT_MINE, p.slot, p.x, p.y, p.facing);
  }

  /** Sticky slow field. Distinct from the damage mine: it controls space. */
  private plantTrap(p: Player): void {
    let proj: Projectile | null = null;
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) {
        proj = this.projectiles[i];
        break;
      }
    }
    if (!proj) return;
    proj.active = true;
    proj.serial = ++this.serial;
    proj.type = 2;
    proj.owner = p.slot;
    proj.x = p.x;
    proj.y = p.y;
    proj.prevX = p.x;
    proj.prevY = p.y;
    proj.vx = 0;
    proj.vy = 0;
    proj.radius = 8;
    proj.damage = 0;
    proj.deflects = 0;
    proj.bounces = 0;
    proj.fuse = 8;
    proj.grace = 0.35;
    proj.armed = false;
    proj.trailHead = 0;
    proj.trailCount = 0;
  }

  private spawnProjectile(p: Player): boolean {
    let proj: Projectile | null = null;
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) {
        proj = this.projectiles[i];
        break;
      }
    }
    if (!proj) return false;

    const speed = BOLT.speed;
    const radius = BOLT.radius;
    const c = Math.cos(p.facing);
    const s = Math.sin(p.facing);
    const x = p.x + c * BOLT.spawnOffset;
    const y = p.y + s * BOLT.spawnOffset;
    for (let i = 0; i < this.arena.pillars.length; i++) {
      // A muzzle inside geometry would immediately ricochet back into the shooter.
      // Fail the shot instead of spawning a bolt that cannot escape.
      if (circleRect(x, y, radius, this.arena.pillars[i], hitScratch)) return false;
    }

    proj.active = true;
    proj.serial = ++this.serial;
    proj.type = 0;
    proj.owner = p.slot;
    proj.x = x;
    proj.y = y;
    proj.prevX = x;
    proj.prevY = y;
    proj.vx = c * speed;
    proj.vy = s * speed;
    proj.radius = radius;
    proj.damage = BOLT.damage;
    proj.deflects = 0;
    proj.bounces = 0;
    proj.fuse = BOLT.ttl;
    proj.grace = 0;
    proj.armed = false;
    proj.trailHead = 0;
    proj.trailCount = 0;
    return true;
  }

  private resolveSwing(p: Player): void {
    if (p.swingHit) return;
    const reach = PLAYER.swingReach;
    const cos = Math.cos(p.swingFacing);
    const sin = Math.sin(p.swingFacing);
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      const distSq = dx * dx + dy * dy;
      const maxDist = reach + proj.radius;
      if (distSq > maxDist * maxDist || distSq < 1e-4) continue;
      const dist = Math.sqrt(distSq);
      const dot = (dx / dist) * cos + (dy / dist) * sin;
      if (dot < SWING_COS) continue;
      if (proj.type === 1) {
        this.explodeMine(proj, proj.owner);
        this.markSwingHit(p);
        return;
      }      const wasMissile = proj.type === 4;
      if (proj.type >= 3) proj.type = 0;
      const oldSpeed = Math.max(Math.hypot(proj.vx, proj.vy), wasMissile ? BOLT.speed : 0);
      // Catch it at the last moment for a straight return. Catching at the far edge
      // still reflects, but the racket clips it and sends it off at an angle.
      const contact = PLAYER.radius + proj.radius;
      const distanceEarly = Math.max(0, Math.min(1, (dist - contact) / Math.max(1, reach - contact)));
      // Timing is half the grade. A press at the very start of the active window still
      // catches the bolt, but sends it wide; a press near contact returns it straight.
      const timingEarly = Math.max(0, Math.min(1, p.swingT / PLAYER.swingActive));
      const early = Math.min(1, distanceEarly * 0.62 + timingEarly * 0.38);
      const returnAngle = p.swingFacing + (p.swingDir < 0 ? -1 : 1) * PLAYER.deflectMaxAngle * early;
      const speedScale = PLAYER.deflectEarlySpeed + (1 - PLAYER.deflectEarlySpeed) * (1 - early);
      const speed = Math.min(BOLT.maxSpeed, oldSpeed * BOLT.deflectMult * speedScale);
      proj.vx = Math.cos(returnAngle) * speed;
      proj.vy = Math.sin(returnAngle) * speed;
      proj.owner = p.slot;
      proj.deflects++;
      proj.damage = BOLT.damage + proj.deflects;

      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      this.emit(EV.DEFLECT, p.slot, proj.x, proj.y, proj.deflects);
      this.markSwingHit(p);
      return;
    }
  }

  private markSwingHit(p: Player): void {
    // Keep the active sweep running to completion; the shorter hit recovery starts after it.
    p.swingHit = true;
  }

  private updateProjectiles(dt: number): void {
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active) continue;
      proj.prevX = proj.x;
      proj.prevY = proj.y;

      if (proj.type === 1) {
        // Mines never travel. They arm, wait for a hostile in range, then detonate
        // on a timer if nothing walks into them.
        if (proj.grace > 0) {
          proj.grace = Math.max(0, proj.grace - dt);
          if (proj.grace === 0) proj.armed = true;
          continue;
        }
        proj.fuse -= dt;
        if (this.mineTriggered(proj)) {
          this.explodeMine(proj, proj.owner);
          continue;
        }
        if (proj.fuse <= 0) this.explodeMine(proj, proj.owner);
        continue;
      }

      if (proj.type === 2) {
        // Trap: arm, then latch onto the first hostile that steps in and leave a
        // short slow field. It never damages, so it buys space instead of a kill.
        if (proj.grace > 0) {
          proj.grace = Math.max(0, proj.grace - dt);
          if (proj.grace === 0) proj.armed = true;
          continue;
        }
        proj.fuse -= dt;
        if (proj.fuse <= 0) {
          proj.active = false;
          continue;
        }
        if (proj.armed) {
          if (this.trapTriggered(proj)) {
            proj.armed = false;
            proj.fuse = BUG.trapDuration;
            this.emit(EV.BUG, proj.owner, proj.x, proj.y, 4);
          }
          continue;
        }
        this.applyTrapSlow(proj);
        continue;
      }

      if (proj.grace > 0) proj.grace = Math.max(0, proj.grace - dt);
      proj.fuse -= dt;
      if (proj.fuse <= 0) {
        proj.active = false;
        continue;
      }

      // Hostile homing missile: slow, obvious, and turn-limited so a dash or cover beats it.
      if (proj.type === 4) {
        const target = this.players[0];
        if (target.alive) {
          const desired = Math.atan2(target.y - proj.y, target.x - proj.x);
          let delta = desired - Math.atan2(proj.vy, proj.vx);
          delta = Math.atan2(Math.sin(delta), Math.cos(delta));
          const maxTurn = SENTRY.missileTurn * dt;
          const angle = Math.atan2(proj.vy, proj.vx) + Math.max(-maxTurn, Math.min(maxTurn, delta));
          proj.vx = Math.cos(angle) * SENTRY.missileSpeed;
          proj.vy = Math.sin(angle) * SENTRY.missileSpeed;
        }
      }

      const speed = Math.hypot(proj.vx, proj.vy);
      const steps = Math.max(1, Math.min(20, Math.ceil((speed * dt) / 6)));
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        proj.x += proj.vx * sdt;
        proj.y += proj.vy * sdt;
        this.bounceWalls(proj);
        if (!proj.active) break;
        this.bouncePillars(proj);
        if (!proj.active) break;
        if (this.wallBlocksProjectile(proj)) break;
        if (this.projectileHits(proj)) break;
        if (this.mode === 'gauntlet' && this.projectileHitsGauntlet(proj)) break;
      }
    }
  }

  private bounceWalls(proj: Projectile): void {
    let bounced = false;
    const r = proj.radius;
    if (proj.x < this.arena.bounds.left + r) {
      proj.x = this.arena.bounds.left + r;
      proj.vx = Math.abs(proj.vx);
      bounced = true;
    } else if (proj.x > this.arena.bounds.right - r) {
      proj.x = this.arena.bounds.right - r;
      proj.vx = -Math.abs(proj.vx);
      bounced = true;
    }
    if (proj.y < this.arena.bounds.top + r) {
      proj.y = this.arena.bounds.top + r;
      proj.vy = Math.abs(proj.vy);
      bounced = true;
    } else if (proj.y > this.arena.bounds.bottom - r) {
      proj.y = this.arena.bounds.bottom - r;
      proj.vy = -Math.abs(proj.vy);
      bounced = true;
    }
    if (!bounced) return;
    if (proj.type === 4) {
      // Missiles pop on hard geometry. Cover is a real answer to them.
      proj.active = false;
      this.emit(EV.SENTRY_HIT, -1, proj.x, proj.y, 0, -proj.vx, -proj.vy);
      return;
    }
    this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 0);
    proj.armed = true;
    proj.bounces++;
    if (proj.bounces > BOLT.maxBounces) proj.active = false;
  }

  private bouncePillars(proj: Projectile): void {
    for (let i = 0; i < this.arena.pillars.length; i++) {
      if (!circleRect(proj.x, proj.y, proj.radius, this.arena.pillars[i], hitScratch)) continue;
      if (proj.type === 4) {
        proj.active = false;
        this.emit(EV.SENTRY_HIT, -1, proj.x, proj.y, 0, hitScratch.nx, hitScratch.ny);
        return;
      }
      proj.x = hitScratch.px;
      proj.y = hitScratch.py;
      const vn = proj.vx * hitScratch.nx + proj.vy * hitScratch.ny;
      if (vn < 0) {
        proj.vx -= 2 * vn * hitScratch.nx;
        proj.vy -= 2 * vn * hitScratch.ny;
      }
      this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 0);
      proj.armed = true;
      proj.bounces++;
      if (proj.bounces > BOLT.maxBounces) proj.active = false;
      return;
    }
  }

  private projectileHits(proj: Projectile): boolean {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.iframes > 0 || p.ghostT > 0) continue;
      if (proj.owner === p.slot && !proj.armed) continue;
      if (proj.type === 1 && proj.owner === p.slot && proj.grace > 0) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      const rr = proj.radius + PLAYER.radius;
      if (dx * dx + dy * dy > rr * rr) continue;

      if (proj.type === 1) {
        this.explodeMine(proj, proj.owner);
        return true;
      }
      const speed = Math.hypot(proj.vx, proj.vy) || 1;
      this.damagePlayer(p, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed, BOLT.knockback);
      proj.active = false;
      return true;
    }

    if (this.mode === 'training' && this.drone.active && proj.owner !== -1) {
      const dx = proj.x - this.drone.x;
      const dy = proj.y - this.drone.y;
      const rr = proj.radius + this.drone.radius;
      if (dx * dx + dy * dy <= rr * rr) {
        if (proj.type === 1) {
          this.explodeMine(proj, proj.owner);
        } else {
          this.damageDrone(proj.damage, proj.owner);
          proj.active = false;
        }
        return true;
      }
    }
    return false;
  }

  private damagePlayer(
    p: Player,
    amount: number,
    sourceSlot: number,
    dirX: number,
    dirY: number,
    force: number,
  ): void {
    if (!p.alive || p.iframes > 0 || p.ghostT > 0) return;
    p.hp -= amount;
    p.hitFlash = PLAYER.hitFlash;
    p.kx += dirX * force;
    p.ky += dirY * force;
    this.emit(EV.HIT, sourceSlot, p.x, p.y, amount, dirX, dirY);
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      p.swingPhase = 0;
      p.swingT = 0;
      p.swingPct = 0;
      p.chargeT = 0;
      p.chargeHeld = false;
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      p.laserT = 0;
      p.waveT = 0;
      p.comboStage = 0;
      p.comboT = 0;
      p.lockActive = false;
      p.lockKind = 0;
      p.lockId = -1;
      if (this.mode === 'gauntlet' && p.slot > 0) {
        p.active = false;
        p.thrall = false;
        this.gauntletKills++;
        this.emit(EV.ELIMINATED, sourceSlot, p.x, p.y, p.slot);
        return;
      }
      p.respawnT = this.mode === 'gauntlet' ? GAUNTLET.playerRespawn : TRAINING.playerRespawn;
      this.emit(EV.ELIMINATED, sourceSlot, p.x, p.y, p.slot);
    }
  }

  private respawnTrainingPlayer(p: Player): void {
    const sx = this.spawnX[p.slot];
    const sy = this.spawnY[p.slot];
    clearPlayerForSpawn(p, sx, sy, Math.atan2(this.centerY - sy, this.centerX - sx));
    p.thrall = false;
    if (this.mode === 'gauntlet') p.iframes = 0.9;
    this.emit(EV.RESPAWN, p.slot, sx, sy, 0);
  }

  /** True when a pillar intersects the line between two points. Used by blast cover. */
  private lineBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    for (let i = 0; i < this.arena.pillars.length; i++) {
      const r = this.arena.pillars[i];
      let tmin = 0;
      let tmax = 1;
      if (Math.abs(dx) < 1e-6) {
        if (x1 < r.x || x1 > r.x + r.w) continue;
      } else {
        let t1 = (r.x - x1) / dx;
        let t2 = (r.x + r.w - x1) / dx;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }
      if (Math.abs(dy) < 1e-6) {
        if (y1 < r.y || y1 > r.y + r.h) continue;
      } else {
        let t1 = (r.y - y1) / dy;
        let t2 = (r.y + r.h - y1) / dy;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }
      return true;
    }
    return false;
  }

  /** Armed mine trigger. Cover blocks the proximity read, same as the blast. */
  private mineTriggered(proj: Projectile): boolean {
    if (!proj.armed) return false;
    const reach = MINE.triggerRadius;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.slot === proj.owner || !p.active || !p.alive || p.iframes > 0 || p.ghostT > 0) continue;
      const dx = p.x - proj.x;
      const dy = p.y - proj.y;
      const rr = reach + PLAYER.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (this.lineBlocked(proj.x, proj.y, p.x, p.y)) continue;
      return true;
    }
    if (this.mode === 'training' && this.drone.active) {
      const dx = this.drone.x - proj.x;
      const dy = this.drone.y - proj.y;
      const rr = reach + this.drone.radius;
      if (dx * dx + dy * dy <= rr * rr && !this.lineBlocked(proj.x, proj.y, this.drone.x, this.drone.y)) return true;
    }
    if (this.mode !== 'gauntlet') return false;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const dx = w.x - proj.x;
      const dy = w.y - proj.y;
      const rr = reach + WORM.headRadius;
      if (dx * dx + dy * dy <= rr * rr && !this.lineBlocked(proj.x, proj.y, w.x, w.y)) return true;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const dx = v.x - proj.x;
      const dy = v.y - proj.y;
      const rr = reach + v.radius;
      if (dx * dx + dy * dy <= rr * rr && !this.lineBlocked(proj.x, proj.y, v.x, v.y)) return true;
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const dx = s.x - proj.x;
      const dy = s.y - proj.y;
      const rr = reach + s.radius;
      if (dx * dx + dy * dy <= rr * rr && !this.lineBlocked(proj.x, proj.y, s.x, s.y)) return true;
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const dx = e.x - proj.x;
      const dy = e.y - proj.y;
      const rr = reach + CASCADING_ERROR.blockSize * 0.5;
      if (dx * dx + dy * dy <= rr * rr && !this.lineBlocked(proj.x, proj.y, e.x, e.y)) return true;
    }
    return false;
  }

  private trapTriggered(proj: Projectile): boolean {
    if (!proj.armed) return false;
    const reach = BUG.trapRadius;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.slot === proj.owner || !p.active || !p.alive || p.iframes > 0 || p.ghostT > 0) continue;
      const dx = p.x - proj.x;
      const dy = p.y - proj.y;
      const rr = reach + PLAYER.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (this.lineBlocked(proj.x, proj.y, p.x, p.y)) continue;
      return true;
    }
    return false;
  }

  private applyTrapSlow(proj: Projectile): void {
    const reach = BUG.trapRadius;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.slot === proj.owner || !p.active || !p.alive || p.ghostT > 0) continue;
      const dx = p.x - proj.x;
      const dy = p.y - proj.y;
      const rr = reach + PLAYER.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (this.lineBlocked(proj.x, proj.y, p.x, p.y)) continue;
      p.slowT = Math.max(p.slowT, 0.2);
    }
  }

  /** Frontal wall shields eat hostile projectiles. They do not stop players. */
  private wallBlocksProjectile(proj: Projectile): boolean {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.wallT <= 0 || proj.owner === p.slot) continue;
      const dx = Math.cos(p.wallFacing);
      const dy = Math.sin(p.wallFacing);
      const ox = p.x + dx * BUG.wallOffset;
      const oy = p.y + dy * BUG.wallOffset;
      const half = BUG.wallLength * 0.5;
      const ax = ox - dy * half;
      const ay = oy + dx * half;
      const bx = ox + dy * half;
      const by = oy - dx * half;
      const vx = bx - ax;
      const vy = by - ay;
      const len2 = vx * vx + vy * vy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((proj.x - ax) * vx + (proj.y - ay) * vy) / len2)) : 0;
      const px = ax + vx * t;
      const py = ay + vy * t;
      const ddx = proj.x - px;
      const ddy = proj.y - py;
      const rr = BUG.wallThickness * 0.5 + proj.radius;
      if (ddx * ddx + ddy * ddy <= rr * rr) {
        proj.active = false;
        this.emit(EV.BOUNCE, p.slot, proj.x, proj.y, 1);
        return true;
      }
    }
    return false;
  }

  private explodeMine(proj: Projectile, sourceSlot: number): void {
    if (!proj.active) return;
    proj.active = false;
    const x = proj.x;
    const y = proj.y;
    this.emit(EV.EXPLODE, sourceSlot, x, y, MINE.blastRadius);

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.slot === sourceSlot) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist > MINE.blastRadius + PLAYER.radius) continue;
      if (this.lineBlocked(x, y, p.x, p.y)) continue;
      const nx = dist > 0.001 ? dx / dist : 1;
      const ny = dist > 0.001 ? dy / dist : 0;
      const falloff = 1 - 0.6 * Math.min(1, dist / MINE.blastRadius);
      this.damagePlayer(p, MINE.blastDamage, sourceSlot, nx, ny, MINE.knockback * falloff);
    }

    if (this.mode === 'training' && this.drone.active) {
      const dist = Math.hypot(this.drone.x - x, this.drone.y - y);
      if (dist <= MINE.blastRadius + this.drone.radius && !this.lineBlocked(x, y, this.drone.x, this.drone.y)) {
        this.damageDrone(MINE.blastDamage, sourceSlot);
      }
    }

    if (this.mode === 'gauntlet' && sourceSlot !== 1) {
      for (let i = 0; i < this.sentries.length; i++) {
        const s = this.sentries[i];
        if (!s.active) continue;
        const dx = s.x - x;
        const dy = s.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist > MINE.blastRadius + s.radius) continue;
        if (this.lineBlocked(x, y, s.x, s.y)) continue;
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        this.damageSentry(s, MINE.blastDamage, sourceSlot, nx, ny);
      }
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (!w.active) continue;
        const dx = w.x - x;
        const dy = w.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist > MINE.blastRadius + WORM.headRadius) continue;
        if (this.lineBlocked(x, y, w.x, w.y)) continue;
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        this.damageWorm(w, MINE.blastDamage, sourceSlot, nx, ny);
      }
      for (let i = 0; i < this.viruses.length; i++) {
        const v = this.viruses[i];
        if (!v.active) continue;
        const dx = v.x - x;
        const dy = v.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist > MINE.blastRadius + v.radius) continue;
        if (this.lineBlocked(x, y, v.x, v.y)) continue;
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        this.damageVirus(v, MINE.blastDamage, sourceSlot, nx, ny);
      }
      for (let i = 0; i < this.errors.length; i++) {
        const e = this.errors[i];
        if (!e.active) continue;
        const radius = CASCADING_ERROR.blockSize * 0.5;
        const dx = e.x - x;
        const dy = e.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist > MINE.blastRadius + radius) continue;
        if (this.lineBlocked(x, y, e.x, e.y)) continue;
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        this.damageError(e, MINE.blastDamage, sourceSlot, nx, ny);
      }
    }
  }

  private damageDrone(amount: number, sourceSlot: number): void {
    const d = this.drone;
    if (!d.active) return;
    d.hp -= amount;
    d.hitFlash = 0.2;
    this.emit(EV.HIT, sourceSlot, d.x, d.y, amount);
    if (d.hp <= 0) {
      d.active = false;
      d.respawnT = TRAINING.droneRespawn;
      this.emit(EV.EXPLODE, -1, d.x, d.y, 90);
    }
  }

  private updateDrone(dt: number): void {
    if (this.mode !== 'training') return;
    const d = this.drone;
    if (!d.active) {
      d.respawnT -= dt;
      if (d.respawnT <= 0) this.spawnDrone(false);
      return;
    }
    d.prevX = d.x;
    d.prevY = d.y;
    d.rot += dt * 1.5;
    if (d.hitFlash > 0) d.hitFlash = Math.max(0, d.hitFlash - dt);

    const tx = d.targetX - d.x;
    const ty = d.targetY - d.y;
    const dist = Math.hypot(tx, ty);
    if (dist < 40) this.pickDroneTarget();
    const desiredX = dist > 0.001 ? (tx / dist) * TRAINING.droneSpeed : 0;
    const desiredY = dist > 0.001 ? (ty / dist) * TRAINING.droneSpeed : 0;
    const k = Math.min(1, 3 * dt);
    d.vx += (desiredX - d.vx) * k;
    d.vy += (desiredY - d.vy) * k;
    d.x += d.vx * dt;
    d.y += d.vy * dt;

    const pad = d.radius + 10;
    d.x = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, d.x));
    d.y = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, d.y));
    for (let i = 0; i < this.arena.pillars.length; i++) {
      if (circleRect(d.x, d.y, d.radius, this.arena.pillars[i], hitScratch)) {
        d.x = hitScratch.px;
        d.y = hitScratch.py;
        this.pickDroneTarget();
      }
    }

    d.fireTimer -= dt;
    if (d.fireTimer <= 0) {
      const target = this.players[0];
      if (target && target.alive) {
        const angle = Math.atan2(target.y - d.y, target.x - d.x) + this.rng.range(-0.05, 0.05);
        this.spawnDroneBolt(d.x + Math.cos(angle) * (d.radius + 12), d.y + Math.sin(angle) * (d.radius + 12), angle);
        this.emit(EV.DRONE_SHOOT, -1, d.x, d.y, angle);
      }
      d.fireTimer = this.rng.range(TRAINING.droneFireMin, TRAINING.droneFireMax);
    }
  }

  private pickDroneTarget(): void {
    const d = this.drone;
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = this.rng.range(this.arena.bounds.left + 120, this.arena.bounds.right - 120);
      const y = this.rng.range(this.arena.bounds.top + 120, this.arena.bounds.bottom - 120);
      let blocked = false;
      for (let i = 0; i < this.arena.pillars.length; i++) {
        const rect = this.arena.pillars[i];
        if (
          x > rect.x - 70 &&
          x < rect.x + rect.w + 70 &&
          y > rect.y - 70 &&
          y < rect.y + rect.h + 70
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const p = this.players[0];
      if (p && Math.hypot(x - p.x, y - p.y) < 190) continue;
      d.targetX = x;
      d.targetY = y;
      return;
    }
    const fallback = this.arena.spawns[2];
    d.targetX = fallback.x;
    d.targetY = fallback.y;
  }

  private spawnDrone(initial: boolean): void {
    const d = this.drone;
    d.active = true;
    d.hp = d.maxHp;
    d.rot = 0;
    d.vx = 0;
    d.vy = 0;
    d.hitFlash = 0;
    this.pickDroneTarget();
    const initialSpawn = this.arena.spawns[2];
    d.x = initial ? initialSpawn.x : this.rng.range(this.arena.bounds.left + 150, this.arena.bounds.right - 150);
    d.y = initial ? initialSpawn.y : this.rng.range(this.arena.bounds.top + 120, this.arena.bounds.bottom - 120);
    d.prevX = d.x;
    d.prevY = d.y;
    d.x = Math.max(this.arena.bounds.left + d.radius, Math.min(this.arena.bounds.right - d.radius, d.x));
    d.y = Math.max(this.arena.bounds.top + d.radius, Math.min(this.arena.bounds.bottom - d.radius, d.y));
    d.fireTimer = this.rng.range(1.1, 2);
    if (!initial) this.emit(EV.RESPAWN, -1, d.x, d.y, 1);
  }

  private spawnDroneBolt(x: number, y: number, angle: number): void {
    let proj: Projectile | null = null;
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) {
        proj = this.projectiles[i];
        break;
      }
    }
    if (!proj) return;
    proj.active = true;
    proj.serial = ++this.serial;
    proj.type = 0;
    proj.owner = -1;
    proj.x = x;
    proj.y = y;
    proj.prevX = x;
    proj.prevY = y;
    proj.vx = Math.cos(angle) * TRAINING.droneBoltSpeed;
    proj.vy = Math.sin(angle) * TRAINING.droneBoltSpeed;
    proj.radius = BOLT.radius;
    proj.damage = 1;
    proj.deflects = 0;
    proj.bounces = 1;
    proj.fuse = TRAINING.droneBoltTtl;
    proj.grace = 0;
    proj.armed = true;
    proj.trailHead = 0;
    proj.trailCount = 0;
  }


  // Gauntlet ---------------------------------------------------------------------------------

  /**
   * A virus-owned thrall is not a network player. It writes the same InputFrame a human does,
   * so it is bound by one-stick facing, swing locks, dash cooldown and energy.
   */
  private driveThrall(dt: number): void {
    const f = this.thrallFrame;
    f.mx = 0;
    f.my = 0;
    f.held = 0;
    f.pressed = 0;
    const t = this.players[1];
    const target = this.players[0];
    if (!t.active || !t.alive || !t.thrall || !target.alive) return;

    this.thrallShootT = Math.max(0, this.thrallShootT - dt);
    this.thrallSwingT = Math.max(0, this.thrallSwingT - dt);
    this.thrallDashT = Math.max(0, this.thrallDashT - dt);

    const dx = target.x - t.x;
    const dy = target.y - t.y;
    const dist = Math.hypot(dx, dy) || 1;
    const aim = Math.atan2(dy, dx);
    const orbit = Math.sin(this.gauntletT * THRALL.orbitRate + THRALL.orbitPhase) * THRALL.strafeAmount;
    let moveAngle = aim;
    if (dist > THRALL.strafeRangeMin && dist < THRALL.strafeRangeMax) moveAngle = aim + orbit;

    let action = 0;
    if (dist < THRALL.swingRange && this.thrallSwingT <= 0) {
      action = ACTION.SWING;
      moveAngle = aim;
      this.thrallSwingT = THRALL.swingCooldown;
    } else if (
      dist > THRALL.boltRangeMin &&
      dist < THRALL.boltRangeMax &&
      this.thrallShootT <= 0 &&
      t.burstCd <= 0 &&
      t.burstLeft > 0 &&
      t.energy >= BOLT.cost
    ) {
      action = ACTION.BOLT;
      moveAngle = aim;
      this.thrallShootT = THRALL.boltCooldown;
    } else if (dist > THRALL.dashRange && this.thrallDashT <= 0) {
      action = ACTION.DASH;
      moveAngle = aim;
      this.thrallDashT = THRALL.dashCooldown;
    }

    const speed = dist < THRALL.closeRange ? THRALL.closeSpeed : THRALL.moveSpeed;
    f.mx = Math.cos(moveAngle) * speed;
    f.my = Math.sin(moveAngle) * speed;
    if (action !== 0) f.pressed = action;
  }

  private updateGauntlet(dt: number): void {
    this.gauntletT += dt;
    const nextWave = 1 + Math.floor(this.gauntletT / GAUNTLET.waveDuration);
    if (nextWave !== this.wave) {
      this.wave = nextWave;
      this.waveBannerT = 3;
      // A new wave arrives early instead of waiting out the old timer.
      if (this.wormSpawnT > 1.4) this.wormSpawnT = 1.4;
      if (this.virusSpawnT > 1.4) this.virusSpawnT = 1.4;
      if (this.firewallSpawnT > 2.2) this.firewallSpawnT = 2.2;
      if (this.sentrySpawnT > 2.2) this.sentrySpawnT = 2.2;
      if (this.errorSpawnT > 2.2) this.errorSpawnT = 2.2;
    }
    if (this.waveBannerT > 0) this.waveBannerT = Math.max(0, this.waveBannerT - dt);
    const ramp = (this.wave - 1) * GAUNTLET.waveSpawnRamp;
    this.infection = Math.max(0, this.infection - GAUNTLET.infectionDecay * dt);

    let wormCount = 0;
    for (let i = 0; i < this.worms.length; i++) if (this.worms[i].active) wormCount++;
    if (wormCount < GAUNTLET.maxWorms) {
      this.wormSpawnT -= dt;
      if (this.wormSpawnT <= 0) {
        this.spawnWorm();
        this.wormSpawnT = Math.max(GAUNTLET.waveMinInterval, GAUNTLET.wormInterval - ramp);
      }
    }

    let virusCount = 0;
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) virusCount++;
    if (virusCount === 0) {
      if (this.virusSpawnT > GAUNTLET.virusRetry) this.virusSpawnT = GAUNTLET.virusRetry;
      this.virusSpawnT -= dt;
      if (this.virusSpawnT <= 0) {
        this.spawnVirusCluster();
        this.virusSpawnT = Math.max(GAUNTLET.waveMinInterval, GAUNTLET.virusInterval - ramp);
        virusCount = GAUNTLET.virusCluster;
      }
    }

    this.virusSplitT -= dt;
    if (this.virusSplitT <= 0) {
      this.virusSplitT = VIRUS.splitInterval;
      if (virusCount < GAUNTLET.maxViruses) this.splitVirus();
    }

    let sentryCount = 0;
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) sentryCount++;
    if (sentryCount < SENTRY.max) {
      this.sentrySpawnT -= dt;
      if (this.sentrySpawnT <= 0) {
        this.spawnSentryPack();
        this.sentrySpawnT = Math.max(SENTRY.minInterval, SENTRY.interval - ramp * 0.8);
      }
    }

    let firewallCount = 0;
    for (let i = 0; i < this.firewalls.length; i++) if (this.firewalls[i].active) firewallCount++;
    if (firewallCount < GAUNTLET.maxFirewalls) {
      this.firewallSpawnT -= dt;
      if (this.firewallSpawnT <= 0) {
        this.spawnFirewall();
        this.firewallSpawnT = Math.max(GAUNTLET.waveMinInterval, GAUNTLET.firewallInterval - ramp);
      }
    }

    for (let i = 0; i < this.worms.length; i++) if (this.worms[i].active) this.updateWorm(this.worms[i], dt);
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) this.updateVirus(this.viruses[i], dt);
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) this.updateSentry(this.sentries[i], dt);
    for (let i = 0; i < this.firewalls.length; i++) if (this.firewalls[i].active) this.updateFirewall(this.firewalls[i], dt);
    this.updateErrors(dt);
  }

  /** One mixed pack, so every hostile silhouette appears early enough to fight. */
  private spawnSentryPack(): void {
    // Touch down in a ring around the player, not at the far spawn. The enlarged
    // arenas are wider than a screen; spawning at the far edge delayed all shooting.
    const p = this.players[0];
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(480, 700);
    const margin = 150;
    const anchorX = Math.max(this.arena.bounds.left + margin, Math.min(this.arena.bounds.right - margin, p.x + Math.cos(angle) * dist));
    const anchorY = Math.max(this.arena.bounds.top + margin, Math.min(this.arena.bounds.bottom - margin, p.y + Math.sin(angle) * dist));
    // Stagger the silhouettes: pulses first, then the shotgun and flock, then the
    // homing pod. A full mixed pack is saved for later waves.
    const pack = this.sentryPack++;
    if (pack === 0) {
      for (let i = 0; i < SENTRY.initialPulses; i++) this.spawnSentry(0, anchorX, anchorY);
      return;
    }
    if (pack === 1) {
      this.spawnSentry(1, anchorX, anchorY);
      let flock = 0;
      while (flock < SENTRY.flockSize && this.spawnSentry(3, anchorX, anchorY)) flock++;
      return;
    }
    if (pack === 2) {
      this.spawnSentry(2, anchorX, anchorY);
      this.spawnSentry(0, anchorX, anchorY);
      return;
    }
    const pulseCount = 1 + Math.min(2, Math.floor(this.wave / 2));
    for (let i = 0; i < pulseCount; i++) this.spawnSentry(0, anchorX, anchorY);
    this.spawnSentry(1, anchorX, anchorY);
    let flock = 0;
    while (flock < SENTRY.flockSize && this.spawnSentry(3, anchorX, anchorY)) flock++;
    this.spawnSentry(2, anchorX, anchorY);
  }

  private spawnSentry(kind: 0 | 1 | 2 | 3, anchorX: number, anchorY: number): boolean {
    let s: Sentry | null = null;
    for (let i = 0; i < this.sentries.length; i++) {
      if (!this.sentries[i].active) {
        s = this.sentries[i];
        break;
      }
    }
    if (!s) return false;

    let radius: number = SENTRY.pulse.radius;
    let hp: number = SENTRY.pulse.hp;
    if (kind === 1) {
      radius = SENTRY.triplex.radius;
      hp = SENTRY.triplex.hp;
    } else if (kind === 2) {
      radius = SENTRY.homing.radius;
      hp = SENTRY.homing.hp;
    } else if (kind === 3) {
      radius = SENTRY.flock.radius;
      hp = SENTRY.flock.hp;
    }

    let x = anchorX;
    let y = anchorY;
    let clear = false;
    for (let attempt = 0; attempt < 14; attempt++) {
      x = anchorX + this.rng.range(-150, 150);
      y = anchorY + this.rng.range(-110, 110);
      if (this.sentryClear(x, y, radius)) {
        clear = true;
        break;
      }
    }
    if (!clear) return false;

    s.active = true;
    s.kind = kind;
    s.x = s.prevX = x;
    s.y = s.prevY = y;
    s.vx = 0;
    s.vy = 0;
    s.kx = 0;
    s.ky = 0;
    s.hp = s.maxHp = hp;
    s.radius = radius;
    s.fireT = this.rng.range(0.9, 2.2);
    s.phase = this.rng.range(0, Math.PI * 2);
    s.hitFlash = 0;
    s.orbitSign = this.rng.next() < 0.5 ? -1 : 1;
    s.spawnT = SENTRY.spawnTime;
    return true;
  }

  private sentryClear(x: number, y: number, radius: number): boolean {
    if (
      x < this.arena.bounds.left + radius ||
      x > this.arena.bounds.right - radius ||
      y < this.arena.bounds.top + radius ||
      y > this.arena.bounds.bottom - radius
    ) {
      return false;
    }
    for (let i = 0; i < this.arena.pillars.length; i++) {
      if (circleRect(x, y, radius + 4, this.arena.pillars[i], hitScratch)) return false;
    }
    const p = this.players[0];
    return !p.alive || Math.hypot(x - p.x, y - p.y) > 240;
  }

  /** Fly, keep a range band, and fire. Cover blocks both shots and movement. */
  private updateSentry(s: Sentry, dt: number): void {
    s.prevX = s.x;
    s.prevY = s.y;
    s.phase += dt;
    if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt);
    if (s.spawnT > 0) {
      s.spawnT = Math.max(0, s.spawnT - dt);
      s.vx = 0;
      s.vy = 0;
      return;
    }

    let speed: number = SENTRY.pulse.speed;
    let keepMin: number = SENTRY.pulse.keepMin;
    let keepMax: number = SENTRY.pulse.keepMax;
    let strafe: number = SENTRY.pulse.strafe;
    let range: number = SENTRY.pulse.range;
    let fireMin: number = SENTRY.pulse.fireMin;
    let fireMax: number = SENTRY.pulse.fireMax;
    if (s.kind === 1) {
      speed = SENTRY.triplex.speed;
      keepMin = SENTRY.triplex.keepMin;
      keepMax = SENTRY.triplex.keepMax;
      strafe = SENTRY.triplex.strafe;
      range = SENTRY.triplex.range;
      fireMin = SENTRY.triplex.fireMin;
      fireMax = SENTRY.triplex.fireMax;
    } else if (s.kind === 2) {
      speed = SENTRY.homing.speed;
      keepMin = SENTRY.homing.keepMin;
      keepMax = SENTRY.homing.keepMax;
      strafe = SENTRY.homing.strafe;
      range = SENTRY.homing.range;
      fireMin = SENTRY.homing.fireMin;
      fireMax = SENTRY.homing.fireMax;
    } else if (s.kind === 3) {
      speed = SENTRY.flock.speed;
      keepMin = SENTRY.flock.keepMin;
      keepMax = SENTRY.flock.keepMax;
      strafe = SENTRY.flock.strafe;
      range = SENTRY.flock.range;
      fireMin = SENTRY.flock.fireMin;
      fireMax = SENTRY.flock.fireMax;
    }

    const p = this.players[0];
    const tx = p.alive ? p.x : this.centerX;
    const ty = p.alive ? p.y : this.centerY;
    const dx = tx - s.x;
    const dy = ty - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    let desiredX = 0;
    let desiredY = 0;
    if (dist < keepMin) {
      desiredX -= ux;
      desiredY -= uy;
    } else if (dist > keepMax) {
      desiredX += ux;
      desiredY += uy;
    }
    desiredX += -uy * strafe * s.orbitSign;
    desiredY += ux * strafe * s.orbitSign;
    if (s.kind === 3) {
      desiredX += Math.sin(s.phase * 3.4 + s.orbitSign) * 0.45;
      desiredY += Math.cos(s.phase * 3.1) * 0.45;
    }
    const dm = Math.hypot(desiredX, desiredY) || 1;
    desiredX /= dm;
    desiredY /= dm;
    const accel = s.kind === 3 ? 7 : 2.5;
    const k = 1 - Math.exp(-accel * dt);
    s.vx += (desiredX * speed - s.vx) * k;
    s.vy += (desiredY * speed - s.vy) * k;
    s.x += (s.vx + s.kx) * dt;
    s.y += (s.vy + s.ky) * dt;
    s.kx *= Math.exp(-SENTRY.knockDrag * dt);
    s.ky *= Math.exp(-SENTRY.knockDrag * dt);
    s.x = Math.max(this.arena.bounds.left + s.radius, Math.min(this.arena.bounds.right - s.radius, s.x));
    s.y = Math.max(this.arena.bounds.top + s.radius, Math.min(this.arena.bounds.bottom - s.radius, s.y));
    this.pushOutOfCover(s, s.radius);

    if (!p.alive) return;
    s.fireT -= dt;
    if (s.fireT > 0 || dist > range) return;
    if (this.lineBlocked(s.x, s.y, p.x, p.y)) {
      s.fireT = 0.35;
      return;
    }
    const aim = Math.atan2(dy, dx);
    if (s.kind === 0) {
      this.spawnHostileProjectile(s.x, s.y, aim, SENTRY.pulse.boltSpeed, SENTRY.boltRadius, SENTRY.boltDamage, 3, SENTRY.boltTtl);
    } else if (s.kind === 1) {
      for (let b = -2; b <= 2; b++) {
        this.spawnHostileProjectile(
          s.x,
          s.y,
          aim + b * 0.13,
          SENTRY.triplex.boltSpeed,
          SENTRY.boltRadius + 1,
          SENTRY.boltDamage,
          3,
          SENTRY.boltTtl,
        );
      }
    } else if (s.kind === 2) {
      this.spawnHostileProjectile(s.x, s.y, aim, SENTRY.missileSpeed, SENTRY.missileRadius, SENTRY.boltDamage, 4, SENTRY.missileTtl);
    } else {
      for (let b = -1; b <= 1; b++) {
        this.spawnHostileProjectile(
          s.x,
          s.y,
          aim + b * 0.1,
          SENTRY.flock.boltSpeed,
          SENTRY.boltRadius - 1,
          SENTRY.boltDamage,
          3,
          SENTRY.boltTtl,
        );
      }
    }
    s.fireT = this.rng.range(fireMin, fireMax);
  }

  /** True collision with cover, used by worms and sentries. */
  private pushOutOfCover(body: { x: number; y: number; vx: number; vy: number }, radius: number): void {
    for (let i = 0; i < this.arena.pillars.length; i++) {
      if (!circleRect(body.x, body.y, radius, this.arena.pillars[i], hitScratch)) continue;
      body.x = hitScratch.px;
      body.y = hitScratch.py;
      const vn = body.vx * hitScratch.nx + body.vy * hitScratch.ny;
      if (vn < 0) {
        body.vx -= vn * hitScratch.nx;
        body.vy -= vn * hitScratch.ny;
      }
    }
  }

  private spawnHostileProjectile(
    x: number,
    y: number,
    angle: number,
    speed: number,
    radius: number,
    damage: number,
    type: 3 | 4,
    ttl: number,
  ): void {
    let proj: Projectile | null = null;
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) {
        proj = this.projectiles[i];
        break;
      }
    }
    if (!proj) return;
    proj.active = true;
    proj.serial = ++this.serial;
    proj.type = type;
    proj.owner = -1;
    proj.x = proj.prevX = x;
    proj.y = proj.prevY = y;
    proj.vx = Math.cos(angle) * speed;
    proj.vy = Math.sin(angle) * speed;
    proj.radius = radius;
    proj.damage = damage;
    proj.deflects = 0;
    proj.bounces = 0;
    proj.fuse = ttl;
    proj.grace = 0;
    proj.armed = true;
    proj.trailHead = 0;
    proj.trailCount = 0;
    this.emit(EV.SENTRY_SHOOT, -1, x, y, angle);
  }

  private damageSentry(s: Sentry, amount: number, sourceSlot: number, dirX: number, dirY: number, force = 0): void {
    if (!s.active) return;
    s.hp -= amount;
    s.hitFlash = 0.18;
    s.kx += dirX * force;
    s.ky += dirY * force;
    this.emit(EV.SENTRY_HIT, sourceSlot, s.x, s.y, amount, dirX, dirY);
    if (s.hp > 0) return;
    s.active = false;
    if (sourceSlot === 0) this.gauntletKills++;
    this.emit(EV.SENTRY_KILL, sourceSlot, s.x, s.y, s.radius * 4);
  }

  /** One spreading colony of yellow warning blocks. Rooted blocks never move after sliding in. */
  private updateErrors(dt: number): void {
    const player = this.players[0];
    const half = CASCADING_ERROR.blockSize * 0.5;
    let active = 0;

    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      active++;
      e.prevX = e.x;
      e.prevY = e.y;
      e.phase += dt;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.touchCd > 0) e.touchCd = Math.max(0, e.touchCd - dt);
      if (e.spawnT > 0) e.spawnT = Math.max(0, e.spawnT - dt);
      if (e.growT > 0) {
        e.growT = Math.max(0, e.growT - dt);
        const t = 1 - e.growT / CASCADING_ERROR.growTime;
        e.x = e.originX + (e.targetX - e.originX) * t;
        e.y = e.originY + (e.targetY - e.originY) * t;
      }

      if (!player.active || !player.alive || player.iframes > 0 || e.touchCd > 0 || e.spawnT > 0) continue;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const rr = half + PLAYER.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      const d = Math.hypot(dx, dy) || 1;
      e.touchCd = CASCADING_ERROR.touchCooldown;
      this.damagePlayer(player, CASCADING_ERROR.touchDamage, -1, dx / d, dy / d, CASCADING_ERROR.knockback);
    }

    if (active === 0) {
      this.errorSpawnT -= dt;
      if (this.errorSpawnT <= 0) this.spawnErrorColony();
      return;
    }

    this.errorGrowT -= dt;
    if (this.errorGrowT <= 0) {
      this.errorGrowT = CASCADING_ERROR.growthInterval;
      this.growError();
    }
  }

  private errorFree(x: number, y: number): boolean {
    const r = CASCADING_ERROR.blockSize * 0.44;
    if (
      x < this.arena.bounds.left + CASCADING_ERROR.blockSize ||
      x > this.arena.bounds.right - CASCADING_ERROR.blockSize ||
      y < this.arena.bounds.top + CASCADING_ERROR.blockSize ||
      y > this.arena.bounds.bottom - CASCADING_ERROR.blockSize
    ) {
      return false;
    }
    for (let i = 0; i < this.arena.pillars.length; i++) {
      if (circleRect(x, y, r, this.arena.pillars[i], hitScratch)) return false;
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy < (CASCADING_ERROR.cell * 0.74) ** 2) return false;
    }
    return true;
  }

  private firstFreeError(): CascadingError | null {
    for (let i = 0; i < this.errors.length; i++) if (!this.errors[i].active) return this.errors[i];
    return null;
  }

  private spawnErrorColony(): void {
    const e = this.firstFreeError();
    if (!e) return;
    const anchor = this.arena.spawns[this.farSpawnIndex()];
    let x = anchor.x;
    let y = anchor.y;
    for (let attempt = 0; attempt < 12; attempt++) {
      x = anchor.x + this.rng.range(-CASCADING_ERROR.seedJitter, CASCADING_ERROR.seedJitter);
      y = anchor.y + this.rng.range(-CASCADING_ERROR.seedJitter, CASCADING_ERROR.seedJitter);
      if (this.errorFree(x, y)) break;
    }
    if (!this.errorFree(x, y)) {
      x = (this.arena.bounds.left + this.arena.bounds.right) * 0.5;
      y = (this.arena.bounds.top + this.arena.bounds.bottom) * 0.5;
      if (!this.errorFree(x, y)) return;
    }
    e.active = true;
    e.x = e.prevX = x;
    e.y = e.prevY = y;
    e.originX = e.targetX = x;
    e.originY = e.targetY = y;
    e.growT = 0;
    e.hp = e.maxHp = CASCADING_ERROR.hp;
    e.hitFlash = 0;
    e.touchCd = 0;
    e.phase = this.rng.range(0, Math.PI * 2);
    e.spawnT = CASCADING_ERROR.spawnTime;
    this.errorSpawnT = CASCADING_ERROR.reseedDelay;
    this.errorGrowT = CASCADING_ERROR.growthInterval;
    this.emit(EV.ERROR_SPAWN, -1, x, y, CASCADING_ERROR.blockSize);
  }

  private growError(): void {
    let parent: CascadingError | null = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const index = Math.floor(this.rng.next() * this.errors.length);
      const candidate = this.errors[index];
      if (!candidate.active) continue;
      if (!parent || this.rng.next() < 0.5) parent = candidate;
    }
    if (!parent) return;
    const child = this.firstFreeError();
    if (!child) return;

    const start = Math.floor(this.rng.next() * 4);
    for (let d = 0; d < 4; d++) {
      const dir = (start + d) & 3;
      const tx = parent.x + (dir === 0 ? CASCADING_ERROR.cell : dir === 1 ? -CASCADING_ERROR.cell : 0);
      const ty = parent.y + (dir === 2 ? CASCADING_ERROR.cell : dir === 3 ? -CASCADING_ERROR.cell : 0);
      if (!this.errorFree(tx, ty)) continue;
      child.active = true;
      child.x = child.prevX = parent.x;
      child.y = child.prevY = parent.y;
      child.originX = parent.x;
      child.originY = parent.y;
      child.targetX = tx;
      child.targetY = ty;
      child.growT = CASCADING_ERROR.growTime;
      child.hp = child.maxHp = CASCADING_ERROR.hp;
      child.hitFlash = 0;
      child.touchCd = 0;
      child.phase = this.rng.range(0, Math.PI * 2);
      child.spawnT = CASCADING_ERROR.spawnTime;
      this.emit(EV.ERROR_SPAWN, -1, tx, ty, CASCADING_ERROR.blockSize);
      return;
    }
  }

  private damageError(e: CascadingError, amount: number, sourceSlot: number, dirX: number, dirY: number): void {
    if (!e.active) return;
    e.hp -= amount;
    e.hitFlash = 0.2;
    this.emit(EV.ERROR_HIT, sourceSlot, e.x, e.y, amount, dirX, dirY);
    if (e.hp > 0) return;
    e.active = false;
    if (sourceSlot === 0) this.gauntletKills++;
    this.emit(EV.ERROR_BREAK, sourceSlot, e.x, e.y, CASCADING_ERROR.blockSize);
  }

  private farSpawnIndex(): number {
    const p = this.players[0];
    if (!p.alive) return 2;
    let best = 0;
    let bestD = -1;
    for (let i = 0; i < this.arena.spawns.length; i++) {
      const s = this.arena.spawns[i];
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      const d = dx * dx + dy * dy;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private spawnWorm(): void {
    let w: Worm | null = null;
    for (let i = 0; i < this.worms.length; i++) {
      if (!this.worms[i].active) {
        w = this.worms[i];
        break;
      }
    }
    if (!w) return;
    const p = this.players[0];
    const spawn = this.arena.spawns[this.farSpawnIndex()];
    w.active = true;
    w.x = spawn.x;
    w.y = spawn.y;
    w.prevX = w.x;
    w.prevY = w.y;
    w.angle = Math.atan2((p.alive ? p.y : this.centerY) - w.y, (p.alive ? p.x : this.centerX) - w.x);
    w.vx = 0;
    w.vy = 0;
    w.kx = 0;
    w.ky = 0;
    w.hp = WORM.hp;
    w.maxHp = WORM.hp;
    w.segCount = WORM.segments;
    w.touchCd = 0;
    w.hitFlash = 0;
    w.infected = false;
    w.phase = this.rng.range(0, Math.PI * 2);
    w.spawnT = WORM.spawnTime;
    const ca = Math.cos(w.angle);
    const sa = Math.sin(w.angle);
    for (let i = 0; i < WORM.maxSegments; i++) {
      const x = w.x - ca * WORM.spacing * (i + 1);
      const y = w.y - sa * WORM.spacing * (i + 1);
      const cx = Math.max(this.arena.bounds.left + WORM.segmentRadius, Math.min(this.arena.bounds.right - WORM.segmentRadius, x));
      const cy = Math.max(this.arena.bounds.top + WORM.segmentRadius, Math.min(this.arena.bounds.bottom - WORM.segmentRadius, y));
      w.segX[i] = cx;
      w.segY[i] = cy;
      w.segPrevX[i] = cx;
      w.segPrevY[i] = cy;
      w.segAngle[i] = w.angle;
    }
  }

  private updateWorm(w: Worm, dt: number): void {
    w.prevX = w.x;
    w.prevY = w.y;
    w.phase += dt;
    if (w.hitFlash > 0) w.hitFlash = Math.max(0, w.hitFlash - dt);
    if (w.touchCd > 0) w.touchCd = Math.max(0, w.touchCd - dt);
    if (w.spawnT > 0) {
      w.spawnT = Math.max(0, w.spawnT - dt);
      w.vx = 0;
      w.vy = 0;
      return;
    }

    const p = this.players[0];
    const tx = p.alive ? p.x : this.centerX;
    const ty = p.alive ? p.y : this.centerY;
    const desired =
      Math.atan2(ty - w.y, tx - w.x) +
      Math.sin(w.phase * WORM.seekWobbleFreq + w.y * 0.01) * WORM.seekWobbleAmp;
    let diff = desired - w.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = WORM.turnRate * dt;
    w.angle += Math.max(-turn, Math.min(turn, diff));
    const speed = WORM.speed * (w.infected ? WORM.infectedSpeedMult : 1);
    w.vx = Math.cos(w.angle) * speed;
    w.vy = Math.sin(w.angle) * speed;
    w.x += (w.vx + w.kx) * dt;
    w.y += (w.vy + w.ky) * dt;
    w.kx *= Math.exp(-WORM.knockDrag * dt);
    w.ky *= Math.exp(-WORM.knockDrag * dt);
    const pad = WORM.headRadius + WORM.wallPad;
    w.x = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, w.x));
    w.y = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, w.y));
    // Worms are not one of the cover-phasing threats. Their chain is pushed out of
    // geometry exactly like a player body, so cover is real against them.
    this.pushOutOfCover(w, WORM.headRadius);

    for (let i = 0; i < w.segCount; i++) {
      w.segPrevX[i] = w.segX[i];
      w.segPrevY[i] = w.segY[i];
      const ax = i === 0 ? w.x : w.segX[i - 1];
      const ay = i === 0 ? w.y : w.segY[i - 1];
      const dx = ax - w.segX[i];
      const dy = ay - w.segY[i];
      const d = Math.hypot(dx, dy);
      if (d > 0.001) {
        const targetX = ax - (dx / d) * WORM.spacing;
        const targetY = ay - (dy / d) * WORM.spacing;
        const k = Math.min(1, WORM.followRate * dt);
        w.segX[i] += (targetX - w.segX[i]) * k;
        w.segY[i] += (targetY - w.segY[i]) * k;
        w.segAngle[i] = Math.atan2(ay - w.segY[i], ax - w.segX[i]);
      }
      w.segX[i] = Math.max(this.arena.bounds.left + WORM.segmentRadius, Math.min(this.arena.bounds.right - WORM.segmentRadius, w.segX[i]));
      w.segY[i] = Math.max(this.arena.bounds.top + WORM.segmentRadius, Math.min(this.arena.bounds.bottom - WORM.segmentRadius, w.segY[i]));
      for (let p = 0; p < this.arena.pillars.length; p++) {
        if (!circleRect(w.segX[i], w.segY[i], WORM.segmentRadius, this.arena.pillars[p], hitScratch)) continue;
        w.segX[i] = hitScratch.px;
        w.segY[i] = hitScratch.py;
      }
    }

    // A worm swallows anything it crosses: projectiles feed it, viruses grow its length.
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const hdx = v.x - w.x;
      const hdy = v.y - w.y;
      const hr = WORM.headRadius + v.radius;
      let eaten = hdx * hdx + hdy * hdy <= hr * hr;
      if (!eaten) {
        for (let s = 0; s < w.segCount; s++) {
          const sdx = v.x - w.segX[s];
          const sdy = v.y - w.segY[s];
          const sr = WORM.segmentRadius + v.radius;
          if (sdx * sdx + sdy * sdy <= sr * sr) {
            eaten = true;
            break;
          }
        }
      }
      if (eaten) {
        v.active = false;
        this.growWorm(w, WORM.growthPerVirus);
        this.emit(EV.EAT, -1, v.x, v.y, w.segCount);
      }
    }

    if (p.alive && w.touchCd <= 0) {
      let hit = false;
      let hdx = p.x - w.x;
      let hdy = p.y - w.y;
      const hr = WORM.headRadius + PLAYER.radius;
      if (hdx * hdx + hdy * hdy <= hr * hr) hit = true;
      if (!hit) {
        for (let i = 0; i < w.segCount; i++) {
          const dx = p.x - w.segX[i];
          const dy = p.y - w.segY[i];
          const rr = WORM.segmentRadius + PLAYER.radius;
          if (dx * dx + dy * dy <= rr * rr) {
            hit = true;
            hdx = dx;
            hdy = dy;
            break;
          }
        }
      }
      if (hit) {
        const d = Math.hypot(hdx, hdy) || 1;
        this.damagePlayer(p, WORM.touchDamage, -1, hdx / d, hdy / d, WORM.knockback);
        w.touchCd = WORM.touchCooldown;
      }
    }
  }

  private damageWorm(w: Worm, amount: number, sourceSlot: number, dirX: number, dirY: number, force = 0): void {
    if (!w.active) return;
    w.hp -= amount;
    w.hitFlash = 0.2;
    w.kx += dirX * force;
    w.ky += dirY * force;
    this.emit(EV.WORM_HIT, sourceSlot, w.x, w.y, amount, dirX, dirY);
    if (w.hp <= 0) {
      w.active = false;
      if (sourceSlot === 0) this.gauntletKills++;
      this.emit(EV.WORM_KILL, sourceSlot, w.x, w.y, 90 + w.segCount * 12, dirX, dirY);
    }
  }

  private growWorm(w: Worm, amount: number): void {
    for (let i = 0; i < amount && w.segCount < WORM.maxSegments; i++) {
      const tail = w.segCount - 1;
      const sx = tail >= 0 ? w.segX[tail] : w.x;
      const sy = tail >= 0 ? w.segY[tail] : w.y;
      w.segX[w.segCount] = sx;
      w.segY[w.segCount] = sy;
      w.segPrevX[w.segCount] = sx;
      w.segPrevY[w.segCount] = sy;
      w.segAngle[w.segCount] = w.angle;
      w.segCount++;
    }
    w.hp = Math.min(w.maxHp, w.hp + WORM.healPerMeal);
  }

  private eatProjectile(proj: Projectile, w: Worm): void {
    const x = proj.x;
    const y = proj.y;
    proj.active = false;
    this.growWorm(w, WORM.growthPerProjectile);
    this.emit(EV.EAT, -1, x, y, w.segCount);
  }

  private spawnVirus(x: number, y: number): Virus | null {
    let v: Virus | null = null;
    for (let i = 0; i < this.viruses.length; i++) {
      if (!this.viruses[i].active) {
        v = this.viruses[i];
        break;
      }
    }
    if (!v) return null;
    v.active = true;
    v.x = Math.max(this.arena.bounds.left + VIRUS.radius, Math.min(this.arena.bounds.right - VIRUS.radius, x));
    v.y = Math.max(this.arena.bounds.top + VIRUS.radius, Math.min(this.arena.bounds.bottom - VIRUS.radius, y));
    v.prevX = v.x;
    v.prevY = v.y;
    const a = this.rng.range(0, Math.PI * 2);
    v.vx = Math.cos(a) * VIRUS.speed * 0.4;
    v.vy = Math.sin(a) * VIRUS.speed * 0.4;
    v.kx = 0;
    v.ky = 0;
    v.hp = VIRUS.hp;
    v.maxHp = VIRUS.hp;
    v.radius = VIRUS.radius;
    v.targetWorm = -1;
    v.orbitSign = this.rng.next() < 0.5 ? -1 : 1;
    v.phase = this.rng.range(0, Math.PI * 2);
    v.contactCd = this.rng.range(0, 0.5);
    v.hitFlash = 0;
    v.spawnT = VIRUS.spawnTime;
    this.nudgeVirusFromCover(v);
    return v;
  }

  private nudgeVirusFromCover(v: Virus): void {
    for (let i = 0; i < this.arena.pillars.length; i++) {
      if (circleRect(v.x, v.y, v.radius, this.arena.pillars[i], hitScratch)) {
        v.x = hitScratch.px;
        v.y = hitScratch.py;
      }
    }
  }

  private spawnVirusCluster(): void {
    const anchor = this.arena.spawns[this.farSpawnIndex()];
    let spawned = 0;
    for (let i = 0; i < GAUNTLET.virusCluster; i++) {
      const a =
        (i / GAUNTLET.virusCluster) * Math.PI * 2 +
        this.rng.range(-VIRUS.clusterAngleJitter, VIRUS.clusterAngleJitter);
      const r = this.rng.range(VIRUS.clusterRadiusMin, VIRUS.clusterRadiusMax);
      if (this.spawnVirus(anchor.x + Math.cos(a) * r, anchor.y + Math.sin(a) * r)) spawned++;
    }
    if (spawned > 0) this.emit(EV.VIRUS_SPLIT, -1, anchor.x, anchor.y, spawned);
  }

  private splitVirus(): void {
    let parent: Virus | null = null;
    for (let i = 0; i < this.viruses.length; i++) {
      if (this.viruses[i].active) {
        parent = this.viruses[i];
        break;
      }
    }
    if (!parent) return;
    const child = this.spawnVirus(
      parent.x + this.rng.range(-VIRUS.splitOffset, VIRUS.splitOffset),
      parent.y + this.rng.range(-VIRUS.splitOffset, VIRUS.splitOffset),
    );
    if (child) this.emit(EV.VIRUS_SPLIT, -1, child.x, child.y, 1);
  }

  private updateVirus(v: Virus, dt: number): void {
    v.prevX = v.x;
    v.prevY = v.y;
    v.phase += dt;
    if (v.hitFlash > 0) v.hitFlash = Math.max(0, v.hitFlash - dt);
    if (v.contactCd > 0) v.contactCd = Math.max(0, v.contactCd - dt);
    if (v.spawnT > 0) {
      v.spawnT = Math.max(0, v.spawnT - dt);
      v.vx = 0;
      v.vy = 0;
      return;
    }

    const p = this.players[0];
    let targetWorm = -1;
    let bestScore = Infinity;
    let tx = p.alive ? p.x : this.centerX;
    let ty = p.alive ? p.y : this.centerY;
    if (p.alive) {
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      bestScore = dx * dx + dy * dy;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || w.infected) continue;
      const dx = w.x - v.x;
      const dy = w.y - v.y;
      const score = (dx * dx + dy * dy) * VIRUS.targetWormBias;
      if (score < bestScore) {
        bestScore = score;
        targetWorm = i;
        tx = w.x;
        ty = w.y;
      }
    }
    v.targetWorm = targetWorm;

    const dx = tx - v.x;
    const dy = ty - v.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    let desiredX = ux;
    let desiredY = uy;
    if (
      targetWorm < 0 &&
      p.alive &&
      dist < VIRUS.orbit + VIRUS.orbitBand &&
      dist > VIRUS.orbit - VIRUS.orbitBand
    ) {
      const radial = (dist - VIRUS.orbit) * VIRUS.orbitRadial;
      desiredX = -uy * v.orbitSign + ux * radial;
      desiredY = ux * v.orbitSign + uy * radial;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const o = this.viruses[i];
      if (o === v || !o.active) continue;
      const sdx = v.x - o.x;
      const sdy = v.y - o.y;
      const d2 = sdx * sdx + sdy * sdy;
      if (d2 > VIRUS.separation * VIRUS.separation || d2 < 1) continue;
      const d = Math.sqrt(d2);
      const push = (VIRUS.separation - d) / VIRUS.separation;
      desiredX += (sdx / d) * push * VIRUS.separationPush;
      desiredY += (sdy / d) * push * VIRUS.separationPush;
    }
    desiredX += Math.sin(v.phase * VIRUS.wobbleFreqX) * VIRUS.wobbleAmp;
    desiredY += Math.cos(v.phase * VIRUS.wobbleFreqY) * VIRUS.wobbleAmp;
    const dm = Math.hypot(desiredX, desiredY) || 1;
    desiredX /= dm;
    desiredY /= dm;
    const k = 1 - Math.exp(-VIRUS.accel * dt);
    v.vx += (desiredX * VIRUS.speed - v.vx) * k;
    v.vy += (desiredY * VIRUS.speed - v.vy) * k;
    v.x += (v.vx + v.kx) * dt;
    v.y += (v.vy + v.ky) * dt;
    v.kx *= Math.exp(-VIRUS.knockDrag * dt);
    v.ky *= Math.exp(-VIRUS.knockDrag * dt);
    v.x = Math.max(this.arena.bounds.left + v.radius, Math.min(this.arena.bounds.right - v.radius, v.x));
    v.y = Math.max(this.arena.bounds.top + v.radius, Math.min(this.arena.bounds.bottom - v.radius, v.y));
    this.nudgeVirusFromCover(v);

    if (p.alive && p.iframes <= 0 && v.contactCd <= 0) {
      const pdx = p.x - v.x;
      const pdy = p.y - v.y;
      const rr = v.radius + PLAYER.radius;
      if (pdx * pdx + pdy * pdy <= rr * rr) {
        v.contactCd = VIRUS.contactCooldown;
        this.addInfection(GAUNTLET.infectionPerTouch, p.x, p.y);
      }
    }

    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || w.infected) continue;
      let hit = false;
      const hr = v.radius + WORM.headRadius;
      const hdx = w.x - v.x;
      const hdy = w.y - v.y;
      if (hdx * hdx + hdy * hdy <= hr * hr) hit = true;
      if (!hit) {
        for (let s = 0; s < w.segCount; s++) {
          const sdx = w.segX[s] - v.x;
          const sdy = w.segY[s] - v.y;
          const sr = v.radius + WORM.segmentRadius;
          if (sdx * sdx + sdy * sdy <= sr * sr) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        this.infectWorm(w);
        v.active = false;
        return;
      }
    }
  }

  private addInfection(amount: number, x: number, y: number): void {
    const thrall = this.players[1];
    const already = thrall.active && thrall.alive;
    this.infection = Math.min(already ? 0.98 : 1, this.infection + amount);
    this.emit(EV.INFECT, -1, x, y, this.infection);
    if (!already && this.infection >= 1) {
      this.infection = GAUNTLET.infectionReset;
      this.spawnThrall();
    }
  }

  private infectWorm(w: Worm): void {
    if (w.infected) return;
    w.infected = true;
    w.hp = w.maxHp;
    w.hitFlash = 0.25;
    this.emit(EV.INFECT, -1, w.x, w.y, 1);
  }

  private spawnThrall(): boolean {
    const t = this.players[1];
    if (t.active && t.alive) return false;
    const p = this.players[0];
    // The infection copies its host at close range. Spawning at a far arena corner would
    // leave a thrall grinding against cover instead of joining the fight.
    const offX = p.x < this.centerX ? THRALL.spawnOffset : -THRALL.spawnOffset;
    const offY = p.y < this.centerY ? THRALL.spawnOffset : -THRALL.spawnOffset;
    let sx = p.x + offX;
    let sy = p.y;
    let clear = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt === 1) {
        sx = p.x - offX;
        sy = p.y;
      } else if (attempt === 2) {
        sx = p.x;
        sy = p.y + offY;
      } else if (attempt === 3) {
        sx = p.x;
        sy = p.y - offY;
      }
      sx = Math.max(this.arena.bounds.left + PLAYER.radius, Math.min(this.arena.bounds.right - PLAYER.radius, sx));
      sy = Math.max(this.arena.bounds.top + PLAYER.radius, Math.min(this.arena.bounds.bottom - PLAYER.radius, sy));
      clear = true;
      for (let i = 0; i < this.arena.pillars.length; i++) {
        if (circleRect(sx, sy, PLAYER.radius, this.arena.pillars[i], hitScratch)) {
          clear = false;
          break;
        }
      }
      if (clear) break;
    }
    clearPlayerForSpawn(t, sx, sy, Math.atan2(p.y - sy, p.x - sx));
    t.active = true;
    t.connected = true;
    t.thrall = true;
    t.name = 'THRALL';
    t.score = 0;
    t.iframes = THRALL.spawnIframes;
    this.thrallShootT = THRALL.spawnShootDelay;
    this.thrallSwingT = THRALL.spawnSwingDelay;
    this.thrallDashT = THRALL.spawnDashDelay;
    this.emit(EV.THRALL, 1, sx, sy, 1);
    return true;
  }

  private spawnFirewall(): void {
    let f: Firewall | null = null;
    for (let i = 0; i < this.firewalls.length; i++) {
      if (!this.firewalls[i].active) {
        f = this.firewalls[i];
        break;
      }
    }
    if (!f) return;
    f.active = true;
    f.axis = this.rng.next() < 0.5 ? 0 : 1;
    f.dir = this.rng.next() < 0.5 ? 1 : -1;
    f.warnT = FIREWALL.warn;
    f.tickT = 0;
    f.age = 0;
    const half = FIREWALL.width * 0.5;
    if (f.axis === 0) f.pos = f.dir > 0 ? this.arena.bounds.left + half : this.arena.bounds.right - half;
    else f.pos = f.dir > 0 ? this.arena.bounds.top + half : this.arena.bounds.bottom - half;
    f.prevPos = f.pos;
    this.emit(EV.FIREWALL, -1, f.axis === 0 ? f.pos : this.centerX, f.axis === 0 ? this.centerY : f.pos, f.axis);
  }

  private updateFirewall(f: Firewall, dt: number): void {
    f.age += dt;
    if (f.warnT > 0) {
      f.warnT -= dt;
      return;
    }
    f.prevPos = f.pos;
    f.pos += f.dir * FIREWALL.speed * dt;
    const expired =
      f.axis === 0
        ? f.pos < this.arena.bounds.left - FIREWALL.width || f.pos > this.arena.bounds.right + FIREWALL.width
        : f.pos < this.arena.bounds.top - FIREWALL.width || f.pos > this.arena.bounds.bottom + FIREWALL.width;
    if (expired) {
      f.active = false;
      return;
    }
    f.tickT -= dt;
    if (f.tickT <= 0) {
      f.tickT = FIREWALL.tick;
      this.burnFirewall(f);
    }
  }

  private firewallBlocked(axis: 0 | 1, pos: number, along: number): boolean {
    for (let i = 0; i < this.arena.pillars.length; i++) {
      const r = this.arena.pillars[i];
      if (axis === 0) {
        if (pos > r.x && pos < r.x + r.w && along > r.y && along < r.y + r.h) return true;
      } else if (pos > r.y && pos < r.y + r.h && along > r.x && along < r.x + r.w) {
        return true;
      }
    }
    return false;
  }

  private beamHits(f: Firewall, x: number, y: number, radius: number): boolean {
    const across = f.axis === 0 ? x : y;
    if (Math.abs(across - f.pos) > FIREWALL.width * 0.5 + radius) return false;
    const along = f.axis === 0 ? y : x;
    return !this.firewallBlocked(f.axis, f.pos, along);
  }

  private burnFirewall(f: Firewall): void {
    const nx = f.axis === 0 ? 1 : 0;
    const ny = f.axis === 0 ? 0 : 1;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive) continue;
      if (!this.beamHits(f, p.x, p.y, PLAYER.radius)) continue;
      const sign = (f.axis === 0 ? p.x - f.pos : p.y - f.pos) >= 0 ? 1 : -1;
      this.damagePlayer(p, FIREWALL.damage, -1, nx * sign, ny * sign, FIREWALL.knockback);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      let hit = this.beamHits(f, w.x, w.y, WORM.headRadius);
      if (!hit) {
        for (let s = 0; s < w.segCount; s++) {
          if (this.beamHits(f, w.segX[s], w.segY[s], WORM.segmentRadius)) {
            hit = true;
            break;
          }
        }
      }
      if (hit) this.damageWorm(w, FIREWALL.damage, -1, nx, ny);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (v.active && this.beamHits(f, v.x, v.y, v.radius)) {
        this.damageVirus(v, VIRUS.hp, -1, nx, ny);
      }
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active && this.beamHits(f, s.x, s.y, s.radius)) {
        this.damageSentry(s, FIREWALL.damage, -1, nx, ny);
      }
    }
    // The sweep burns the error blocks too; the factions are not allies.
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (e.active && this.beamHits(f, e.x, e.y, CASCADING_ERROR.blockSize * 0.5)) {
        this.damageError(e, FIREWALL.damage, -1, nx, ny);
      }
    }
  }

  private damageVirus(v: Virus, amount: number, sourceSlot: number, dirX: number, dirY: number, force = 0): void {
    if (!v.active) return;
    v.hp -= amount;
    v.hitFlash = 0.18;
    v.kx += dirX * force;
    v.ky += dirY * force;
    this.emit(EV.VIRUS_HIT, sourceSlot, v.x, v.y, amount, dirX, dirY);
    if (v.hp <= 0) {
      v.active = false;
      if (sourceSlot === 0) this.gauntletKills++;
      this.emit(EV.VIRUS_KILL, sourceSlot, v.x, v.y, v.radius * 4, dirX, dirY);
    }
  }

  private projectileHitsGauntlet(proj: Projectile): boolean {
    // Enemy fire passes through the rest of the gauntlet factions. It only threatens
    // players, so shooters cannot delete their own pack or clear error colonies for you.
    if (proj.owner < 0 && proj.type >= 3) return false;

    // Player bolts can shoot down hostile shots and homing missiles. This is the
    // intended answer when a missile is too close to swat or too far to outrun.
    if (proj.owner >= 0 && proj.type === 0) {
      for (let i = 0; i < this.projectiles.length; i++) {
        const other = this.projectiles[i];
        if (other === proj || !other.active || other.owner !== -1 || other.type < 3) continue;
        const dx = other.x - proj.x;
        const dy = other.y - proj.y;
        const rr = other.radius + proj.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        other.active = false;
        proj.active = false;
        const speed = Math.hypot(other.vx, other.vy) || 1;
        this.emit(EV.SENTRY_HIT, proj.owner, other.x, other.y, 0, -other.vx / speed, -other.vy / speed);
        return true;
      }
    }

    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const dx = proj.x - e.x;
      const dy = proj.y - e.y;
      const rr = proj.radius + CASCADING_ERROR.blockSize * 0.5;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (proj.type === 1) {
        this.explodeMine(proj, proj.owner);
      } else {
        const speed = Math.hypot(proj.vx, proj.vy) || 1;
        this.damageError(e, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed);
        proj.active = false;
      }
      return true;
    }

    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const dx = proj.x - s.x;
      const dy = proj.y - s.y;
      const rr = proj.radius + s.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (proj.type === 1) {
        this.explodeMine(proj, proj.owner);
      } else {
        const speed = Math.hypot(proj.vx, proj.vy) || 1;
        this.damageSentry(s, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed);
        proj.active = false;
      }
      return true;
    }

    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      // A thrall's bolts are part of the infection and pass through its own swarm.
      if (proj.owner === 1) break;
      const dx = proj.x - v.x;
      const dy = proj.y - v.y;
      const rr = proj.radius + v.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (proj.type === 1) {
        this.explodeMine(proj, proj.owner);
      } else {
        const speed = Math.hypot(proj.vx, proj.vy) || 1;
        this.damageVirus(v, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed);
        proj.active = false;
      }
      return true;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const hdx = proj.x - w.x;
      const hdy = proj.y - w.y;
      const hr = proj.radius + WORM.headRadius;
      if (hdx * hdx + hdy * hdy <= hr * hr) {
        if (proj.type === 1) {
          this.explodeMine(proj, proj.owner);
        } else {
          const speed = Math.hypot(proj.vx, proj.vy) || 1;
          this.damageWorm(w, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed);
          proj.active = false;
        }
        return true;
      }
      for (let s = 0; s < w.segCount; s++) {
        const sdx = proj.x - w.segX[s];
        const sdy = proj.y - w.segY[s];
        const sr = proj.radius + WORM.segmentRadius;
        if (sdx * sdx + sdy * sdy > sr * sr) continue;
        if (proj.type === 1) this.explodeMine(proj, proj.owner);
        else this.eatProjectile(proj, w);
        return true;
      }
    }
    return false;
  }

  /** Close-range punch layered onto the deflect swing. Projectiles keep priority. */
  private resolveSwingContact(p: Player): void {
    if (p.swingHit) return;
    const cos = Math.cos(p.swingFacing);
    const sin = Math.sin(p.swingFacing);
    const reach = PLAYER.punchReach;
    const force = p.thrall ? PLAYER.thrallSwingKnockback : PLAYER.punchKnockback;

    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.iframes > 0) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > reach + PLAYER.radius || d < 0.001) continue;
      if ((dx / d) * cos + (dy / d) * sin < SWING_COS) continue;
      this.damagePlayer(target, PLAYER.punchDamage, p.slot, dx / d, dy / d, force);
      this.markSwingHit(p);
      return;
    }

    if (this.mode === 'training' && this.drone.active) {
      const dx = this.drone.x - p.x;
      const dy = this.drone.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= reach + this.drone.radius && d > 0.001 && (dx / d) * cos + (dy / d) * sin >= SWING_COS) {
        this.damageDrone(PLAYER.punchDamage, p.slot);
        this.markSwingHit(p);
        return;
      }
    }

    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > reach + s.radius || d < 0.001) continue;
      if ((dx / d) * cos + (dy / d) * sin < SWING_COS) continue;
      this.damageSentry(s, PLAYER.punchDamage, p.slot, dx / d, dy / d, force);
      this.markSwingHit(p);
      return;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const dx = v.x - p.x;
      const dy = v.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > reach + v.radius || d < 0.001) continue;
      if ((dx / d) * cos + (dy / d) * sin < SWING_COS) continue;
      this.damageVirus(v, PLAYER.punchDamage, p.slot, dx / d, dy / d, force);
      this.markSwingHit(p);
      return;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const dx = w.x - p.x;
      const dy = w.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > reach + WORM.headRadius || d < 0.001) continue;
      if ((dx / d) * cos + (dy / d) * sin < SWING_COS) continue;
      this.damageWorm(w, PLAYER.punchDamage, p.slot, dx / d, dy / d, force);
      this.markSwingHit(p);
      return;
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const radius = CASCADING_ERROR.blockSize * 0.5;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > reach + radius || d < 0.001) continue;
      if ((dx / d) * cos + (dy / d) * sin < SWING_COS) continue;
      this.damageError(e, PLAYER.punchDamage, p.slot, dx / d, dy / d);
      this.markSwingHit(p);
      return;
    }
  }

  /** Charged triangle dash: damages each hostile it passes through, once per dash. */
  private resolveChargeDash(p: Player): void {
    const hitR = PLAYER.chargeDashHitRadius;
    const fx = p.dashDirX;
    const fy = p.dashDirY;

    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.iframes > 0) continue;
      const bit = 1 << target.slot;
      if ((p.dashHitPlayers & bit) !== 0) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      if (dx * dx + dy * dy > (hitR + PLAYER.radius) * (hitR + PLAYER.radius)) continue;
      p.dashHitPlayers |= bit;
      this.damagePlayer(target, PLAYER.chargeDashDamage, p.slot, fx, fy, PLAYER.chargeDashKnockback);
    }

    if (this.mode === 'training' && this.drone.active && !p.dashHitDrone) {
      const dx = this.drone.x - p.x;
      const dy = this.drone.y - p.y;
      if (dx * dx + dy * dy <= (hitR + this.drone.radius) * (hitR + this.drone.radius)) {
        p.dashHitDrone = true;
        this.damageDrone(PLAYER.chargeDashDamage, p.slot);
      }
    }

    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const bit = 1 << i;
      if ((p.dashHitSentries & bit) !== 0) continue;
      const rr = hitR + s.radius;
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      p.dashHitSentries |= bit;
      this.damageSentry(s, PLAYER.chargeDashDamage, p.slot, fx, fy, PLAYER.chargeDashKnockback);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const bit = 1 << i;
      if ((p.dashHitWorms & bit) !== 0) continue;
      const rr = hitR + WORM.headRadius;
      let touching = (w.x - p.x) * (w.x - p.x) + (w.y - p.y) * (w.y - p.y) <= rr * rr;
      if (!touching) {
        const sr = hitR + WORM.segmentRadius;
        for (let s = 0; s < w.segCount; s++) {
          const dx = w.segX[s] - p.x;
          const dy = w.segY[s] - p.y;
          if (dx * dx + dy * dy <= sr * sr) {
            touching = true;
            break;
          }
        }
      }
      if (!touching) continue;
      p.dashHitWorms |= bit;
      this.damageWorm(w, PLAYER.chargeDashDamage, p.slot, fx, fy, PLAYER.chargeDashKnockback);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const bit = 1 << i;
      if ((p.dashHitViruses & bit) !== 0) continue;
      const rr = hitR + v.radius;
      const dx = v.x - p.x;
      const dy = v.y - p.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      p.dashHitViruses |= bit;
      this.damageVirus(v, PLAYER.chargeDashDamage, p.slot, fx, fy, PLAYER.chargeDashKnockback);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const bit = 1 << i;
      if ((p.dashHitErrors & bit) !== 0) continue;
      const radius = CASCADING_ERROR.blockSize * 0.5;
      const rr = hitR + radius;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      p.dashHitErrors |= bit;
      this.damageError(e, PLAYER.chargeDashDamage, p.slot, fx, fy);
    }
  }

  private emit(kind: number, slot: number, x: number, y: number, power: number, dirX = 0, dirY = 0): void {
    if (this.eventCount >= this.events.length) return;
    const e = this.events[this.eventCount++];
    e.kind = kind;
    e.slot = slot;
    e.x = x;
    e.y = y;
    e.power = power;
    e.dirX = dirX;
    e.dirY = dirY;
  }
}
