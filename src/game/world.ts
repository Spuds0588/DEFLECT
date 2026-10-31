import {
  ATTRACT,
  ATOMIZE,
  BOLT,
  BUFFER,
  BUG,
  CAMERA_ZOOM,
  CAMPAIGN,
  CALIBRATION,
  CASCADING_ERROR,
  EMITTER,
  FISHER,
  GHOST,
  MINE,
  SWEEP,
  FIREWALL,
  FALL,
  WEDGE,
  GAUNTLET,
  KABOOM,
  FILE_PROP,
  MAX_EVENTS,
  MAX_PLAYERS,
  PLAYER,
  POWERUP,
  ROUND,
  SENTRY,
  TOXIC,
  THRALL,
  TRAINING,
  TRAVEL,
  TRAVERSE,
  VIEW_H,
  VIEW_W,
  VIRUS,
  WORM,
  type Rect,
} from './config';
import { ARENAS, arenaSolids, type ArenaDef } from './arenas';
import type { CampaignDataCrate } from './campaign';
import { beamReach, circleRect, hitScratch } from './collision';
import {
  clearPlayerForSpawn,
  createBarrier,
  createCascadingError,
  createDrone,
  createFirewall,
  createLure,
  createNet,
  createPickupPool,
  createPlayer,
  createProjectilePool,
  createSentry,
  createVirus,
  createWorm,
} from './entities';
import { PROGRAM_ID, clampProgram, programDef } from './programs';
import { computeSpawns, stepPlayerMotion } from './movement';
import { POWERUP_KIND, isTimedPowerup, powerupDef, rollPowerup } from './powerups';
import { Rng } from './rng';
import {
  ACTION,
  EV,
  SRC,
  type Barrier,
  type CampaignPhase,
  type CascadingError,
  type Drone,
  type Firewall,
  type GameEvent,
  type GameMode,
  type InputFrame,
  type LaserEmitter,
  type Lure,
  type Net,
  type Phase,
  type Pickup,
  type Player,
  type Projectile,
  type Prop,
  type Sentry,
  type Virus,
  type Worm,
} from './types';

const SWING_COS = Math.cos(PLAYER.swingHalfAngle);
const EVENT_CAPACITY = MAX_EVENTS * 2;
/** Any of the four action buttons fires an armed jump-scare instead of its normal job. */
const SCARE_TRIGGER_ACTIONS = ACTION.BOLT | ACTION.SWING | ACTION.CANDLE | ACTION.DASH;

/**
 * True while a body cannot be hit or seen. The legacy ghost skill and Ghost's cloak
 * share the same hit-test gate; Ghost's super adds a separate armed window on top.
 */
function phased(p: Player): boolean {
  return p.ghostT > 0 || p.cloakT > 0;
}

/**
 * Authoritative simulation. Hosted locally for training and by the room host online.
 * No allocations inside step(); see AGENTS.md §3.
 */
export class World {
  readonly mode: GameMode;
  /** Local simulation: identity always comes from the program, never the slot. */
  readonly online = false;
  readonly arena: ArenaDef;
  /** Cover plus floor gaps. Bodies collide with this; shots only respect cover. */
  private readonly solids: readonly Rect[];
  /** Breakable file boxes. Local content; the snapshot never carries them. */
  readonly props: Prop[];
  readonly selectedProgram: number;
  readonly players: Player[];
  readonly projectiles: Projectile[];
  readonly drone: Drone;
  readonly worms: Worm[];
  readonly viruses: Virus[];
  readonly firewalls: Firewall[];
  /** Arena laser emitters. Local hazard content; hosted matches never arm them. */
  readonly emitters: LaserEmitter[];
  readonly errors: CascadingError[];
  readonly sentries: Sentry[];
  readonly pickups: Pickup[];
  /** Local-only Fisher webs, lure beacons and Wedge walls. Never enter a match snapshot. */
  readonly nets: Net[];
  readonly lures: Lure[];
  readonly barriers: Barrier[];
  /** Reused smoothing scratch, so deploying a web allocates nothing. */
  private readonly netScratchX = new Float32Array(FISHER.netPoints);
  private readonly netScratchY = new Float32Array(FISHER.netPoints);
  infection = 0;
  gauntletKills = 0;
  /** True after a scored gauntlet run has ended; the simulation holds the last frame. */
  gauntletOver = false;
  /**
   * Local run rule for gauntlet and campaign. On, hostile fire can damage rival threat
   * families (the crossfire the docs call friendly fire). Off, a hostile shot passes
   * through worms, viruses and error blocks and only threatens players. Set once when
   * the run is created; never part of a snapshot.
   */
  friendlyFire = true;
  /** Internal bench/headless path: endless respawns and max threat caps. Not exposed in the UI. */
  readonly gauntletPractice: boolean;
  /**
   * Campaign script running on the gauntlet simulation: sparring drill, breach warning,
   * then the threat assault. Local-only like the rest of the sandbox.
   */
  readonly campaign: boolean;
  campaignPhase: CampaignPhase = 'none';
  /** Calibration shapes have woken; they no longer accept a dormant hit. */
  calibrationAwake = false;
  /** Seconds inside the current campaign phase. */
  campaignT = 0;
  campaignBannerT = 0;
  /** Starting length of the current campaign banner, for the renderer fade. */
  campaignBannerDur = 0;
  /** 0 drill, 1 breach/inbound, 2 cleared, 3 failed. Fixed labels live in the renderer. */
  campaignBannerKind = 0;
  /** Escalation wave in gauntlet mode. Purely local presentation + spawn pacing. */
  wave = 1;
  waveBannerT = 0;
  /**
   * Title-screen attract demo. Presentation only: it keeps the room topped up to the
   * live caps so the demo never thins out. Never set for a scored run, a campaign node
   * or a hosted match, and it does not touch the run record.
   */
  attractMode = false;
  private attractRefillT = 0;

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
  /** Shared clock for arena emitters. `offset` per emitter staggers the beams. */
  private emitterT = 0;
  /** Kiosk only: how many local squad bodies the attract run opened (1-3). */
  private attractSquad = 1;
  private sentrySpawnT: number = SENTRY.spawnDelay;
  private sentryPack = 0;
  /** Sentry packs land one silhouette at a time instead of all at once. */
  private sentryQueue = new Int8Array(12);
  private sentryQueueCount = 0;
  private sentryQueueIndex = 0;
  private sentryQueueT = 0;
  private sentryQueueX = 0;
  private sentryQueueY = 0;
  private errorSpawnT: number = CASCADING_ERROR.spawnDelay;
  private errorGrowT: number = CASCADING_ERROR.growthInterval;
  private virusSplitT: number = VIRUS.splitInterval;
  private virusSeeded = false;
  private powerupSpawnT: number = POWERUP.firstSpawn;
  private powerupDropT = 0;
  private pathTargetX = 0;
  private pathTargetY = 0;
  private pathFound = false;
  private pathBest2 = 0;
  private gauntletT = 0;
  /**
   * Bad Lag's time dilation: seconds left and the slot that cast it. Public for the
   * renderer's field tint. Local-only, never part of a snapshot.
   */
  timeSlowT = 0;
  /** Slot that cast the dilation; the renderer marks their dock as live. */
  timeSlowOwner = -1;
  /** Local bot match: slots 1..botSlots are AI, not network guests. */
  private botSlots = 0;
  /** Scratch for the current lock target, so target reads never allocate. */
  private lockTX = 0;
  private lockTY = 0;
  /** Scratch for one lock-cycle step. */
  private cyclePlayer: Player | null = null;
  private cycleBase = 0;
  private cycleForward = true;
  private cycleFound = false;
  private cycleBestDelta = 0;
  private cycleBestKind = 0;
  private cycleBestId = -1;
  private cycleWrapDelta = 0;
  private cycleWrapKind = 0;
  private cycleWrapId = -1;
  private thrallFrame: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
  private thrallShootT = 0;
  private thrallSwingT = 0;
  private thrallDashT = 0;
  /** Open-wall arena: the bounds are a lip, not a wall. Anything past it de-rezzes. */
  private readonly openWalls: boolean;
  /** Compactor cycle time, in seconds since this cycle began. Public for the renderer. */
  pusherT = 0;
  /** Seconds of warning left before the arm moves; 0 outside the warning window. */
  pusherWarnT = 0;
  /** World y of the arm's leading edge. Public for the renderer. */
  pusherY = 0;
  /** True while the arm is descending. Public for the renderer. */
  pusherActive = false;
  /** Brief flash when the arm reaches its stop line; the renderer fades it out. */
  pusherFlashT = 0;
  /** Countdown to the next file box dropping into a compacted arena. */
  propDropT = FILE_PROP.dropEvery;
  /** Campaign score telemetry: crates authored, crates still standing, damage taken. */
  dataTotal = 0;
  dataKept = 0;
  campaignDamage = 0;
  /** Authored data crates for this level. Spawned on the breach, never in snapshots. */
  private readonly levelData: readonly CampaignDataCrate[];

  private get centerX(): number {
    return (this.arena.bounds.left + this.arena.bounds.right) * 0.5;
  }

  private get centerY(): number {
    return (this.arena.bounds.top + this.arena.bounds.bottom) * 0.5;
  }

  constructor(
    mode: GameMode,
    names: string[],
    localSlot = 0,
    arena: ArenaDef = ARENAS[0],
    gauntletPractice = false,
    program: number = PROGRAM_ID.PROBE,
    botSlots = 0,
    botPrograms: readonly number[] | null = null,
    campaign = false,
    levelData: readonly CampaignDataCrate[] | null = null,
  ) {
    this.mode = mode;
    this.campaign = campaign;
    this.levelData = levelData ?? [];
    this.botSlots = Math.max(0, Math.min(MAX_PLAYERS - 1, botSlots));
    this.arena = arena;
    this.solids = arenaSolids(arena);
    this.openWalls = arena.walls === 'open';
    this.pusherY = arena.bounds.top;
    this.gauntletPractice = gauntletPractice;
    this.localSlot = localSlot;
    this.selectedProgram = clampProgram(program);
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
    // The sentry pool carries the gauntlet shooters and the campaign calibration
    // shapes (parents, shards and echo copies). The live wave cap still uses SENTRY.max;
    // the larger pool is only there so the tutorial can field its swarm without
    // evicting the assault slots.
    this.sentries = new Array(SENTRY.pool);
    for (let i = 0; i < this.sentries.length; i++) this.sentries[i] = createSentry();
    this.pickups = createPickupPool();
    this.nets = new Array(2);
    for (let i = 0; i < this.nets.length; i++) this.nets[i] = createNet();
    this.lures = new Array(2);
    for (let i = 0; i < this.lures.length; i++) this.lures[i] = createLure();
    this.barriers = new Array(4);
    for (let i = 0; i < this.barriers.length; i++) this.barriers[i] = createBarrier();
    this.props = [];
    const propDefs = arena.props;
    if (propDefs) {
      for (let i = 0; i < propDefs.length; i++) {
        const d = propDefs[i];
        this.props.push({
          active: true,
          kind: d.kind,
          x: d.x,
          y: d.y,
          w: d.w,
          h: d.h,
          hp: FILE_PROP.hp,
          hitFlash: 0,
          dropT: 0,
          vx: 0,
          vy: 0,
          tx: 0,
          ty: 0,
        });
      }
    }
    // A compactor arena needs boxes to feed back in after each stroke. They are preallocated
    // and parked inactive so the cycle never allocates.
    if (arena.pushers) {
      for (let i = 0; i < FILE_PROP.spare; i++) {
        this.props.push({
          active: false,
          kind: i % 4,
          x: 0,
          y: 0,
          w: 42,
          h: 30,
          hp: FILE_PROP.hp,
          hitFlash: 0,
          dropT: 0,
          vx: 0,
          vy: 0,
          tx: 0,
          ty: 0,
        });
      }
    }
    // Matches never build the fixtures at all. A host and guest would otherwise draw
    // different arenas when a map carries local hazard hardware.
    this.emitters = [];
    const emitterDefs = mode === 'match' ? null : arena.emitters;
    if (emitterDefs) {
      for (let i = 0; i < emitterDefs.length; i++) {
        const d = emitterDefs[i];
        this.emitters.push({
          x: d.x,
          y: d.y,
          angle: d.angle,
          offset: d.offset ?? 0,
          phase: 0,
          charge: 0,
          beamDist: 0,
          caught: false,
          spent: false,
          hitPlayers: 0,
        });
      }
    }
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
    // Programs own their signature bug. Slot 0 is the selected local program; local bots
    // take the programs the human left unused, while online opponents stay Probe until
    // the net protocol carries kits.
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = this.players[i];
      const botProgram = botPrograms && botPrograms[i] !== undefined ? botPrograms[i] : null;
      p.program = i === 0 ? this.selectedProgram : botProgram !== null ? clampProgram(botProgram) : PROGRAM_ID.PROBE;
      const def = programDef(p.program);
      p.bugKind = def.bugKind;
      // Atomize is the one program with a six-segment hull. Spawn and respawn both
      // read maxHp, so setting it with the program is enough to carry the larger pool.
      p.maxHp = def.healthSegments ?? PLAYER.hp;
    }

    if (mode === 'training') {
      this.phase = 'practice';
      let active = 0;
      for (let i = 0; i < this.players.length; i++) if (this.players[i].active) active++;
      computeSpawns(Math.max(1, active), arena, this.spawnX, this.spawnY);
      const left = arena.spawns[6];
      this.spawnX[0] = left.x;
      this.spawnY[0] = left.y;
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        if (!p.active) continue;
        const sx = i === 0 ? left.x : this.spawnX[i];
        const sy = i === 0 ? left.y : this.spawnY[i];
        this.spawnX[i] = sx;
        this.spawnY[i] = sy;
        clearPlayerForSpawn(p, sx, sy, Math.atan2(this.centerY - sy, this.centerX - sx));
      }
      // Solo training keeps the sparring drone. Bot practice replaces it so the room
      // is about the opposition, not accidental crossfire.
      if (active <= 1) this.spawnDrone(true);
    } else if (mode === 'gauntlet') {
      this.phase = 'practice';
      if (campaign) this.setupCampaign();
      else this.setupGauntlet();
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
    this.timeSlowT = 0;
    this.timeSlowOwner = -1;
    this.gauntletOver = false;
    this.wave = 1;
    this.waveBannerT = 0;
    this.wormSpawnT = GAUNTLET.wormSpawnDelay;
    this.virusSpawnT = GAUNTLET.virusSpawnDelay;
    this.firewallSpawnT = GAUNTLET.firewallSpawnDelay;
    this.emitterT = 0;
    for (let i = 0; i < this.emitters.length; i++) {
      const e = this.emitters[i];
      e.phase = 0;
      e.charge = 0;
      e.beamDist = 0;
      e.caught = false;
      e.spent = false;
      e.hitPlayers = 0;
    }
    this.sentrySpawnT = SENTRY.spawnDelay;
    this.sentryPack = 0;
    this.sentryQueueCount = 0;
    this.sentryQueueIndex = 0;
    this.sentryQueueT = 0;
    this.errorSpawnT = CASCADING_ERROR.spawnDelay;
    this.errorGrowT = CASCADING_ERROR.growthInterval;
    this.virusSplitT = VIRUS.splitInterval;
    this.virusSeeded = false;
    this.powerupSpawnT = POWERUP.firstSpawn;
    this.powerupDropT = 0;
    for (let i = 0; i < this.pickups.length; i++) this.pickups[i].active = false;
    for (let i = 0; i < this.nets.length; i++) this.nets[i].active = false;
    for (let i = 0; i < this.lures.length; i++) this.lures[i].active = false;
    for (let i = 0; i < this.barriers.length; i++) this.barriers[i].active = false;
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

  /**
   * First campaign node. The level opens on a calibration prologue: six dormant
   * geometric subjects that wake together, then the sparring drill, breach and assault.
   * The subjects are local-only; the host/guest snapshot has no campaign state.
   */
  private setupCampaign(): void {
    this.setupGauntlet();
    this.campaignPhase = 'calibration';
    this.calibrationAwake = false;
    this.campaignT = 0;
    this.campaignBannerKind = 4;
    this.campaignBannerT = CALIBRATION.bannerTime;
    this.campaignBannerDur = CALIBRATION.bannerTime;
    this.wave = CAMPAIGN.waveStart;
    this.waveBannerT = 0;
    // Bots stay parked until the calibration subjects are cleared. The drill squad
    // then logs in on the existing ring with the player, before the breach removes it.
    this.spawnCalibrationShapes();
  }

  /** Starts the sparring drill once the calibration subjects are gone. */
  private beginDrill(): void {
    this.campaignPhase = 'drill';
    this.calibrationAwake = false;
    this.campaignT = 0;
    this.campaignBannerKind = 0;
    this.campaignBannerT = CAMPAIGN.drillBannerTime;
    this.campaignBannerDur = CAMPAIGN.drillBannerTime;
    this.clearTrainingShapes();
    for (let i = 0; i < this.projectiles.length; i++) this.projectiles[i].active = false;

    const player = this.players[0];
    // A calibration knockdown should not carry into the drill. This is a checkpoint,
    // not a free respawn during the live fire that follows.
    player.alive = true;
    player.hp = player.maxHp;
    player.energy = PLAYER.energyMax;
    player.iframes = Math.max(player.iframes, 0.9);
    player.respawnT = 0;
    player.thrall = false;
    this.infection = 0;

    let count = 0;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (i > 0 && i <= this.botSlots && p.name) {
        p.active = true;
        p.connected = true;
        p.thrall = false;
      }
      if (p.active) count++;
    }
    computeSpawns(Math.max(1, count), this.arena, this.spawnX, this.spawnY);
    this.spawnX[0] = player.x;
    this.spawnY[0] = player.y;
    for (let i = 1; i <= this.botSlots; i++) {
      const p = this.players[i];
      if (!p.active) continue;
      this.drillSlotPos(i - 1, player);
      const sx = this.spawnTmpX[i - 1];
      const sy = this.spawnTmpY[i - 1];
      clearPlayerForSpawn(p, sx, sy, Math.atan2(player.y - sy, player.x - sx));
    }
  }

  /** Six calibration subjects, two of each primary, laid out in front of the player. */
  private spawnCalibrationShapes(): void {
    const player = this.players[0];
    const base = Math.atan2(this.centerY - player.y, this.centerX - player.x);
    const kinds = [4, 5, 6, 4, 5, 6] as const;
    for (let i = 0; i < kinds.length; i++) {
      const kind = kinds[i];
      // A single arc of six, not two tight rows: adjacent bodies stay clear of each
      // other at this spacing, so none falls back to a spawn point in the player's lap
      // and wakes the class before the dormant beat has been read.
      const angle = base + (i - (kinds.length - 1) * 0.5) * CALIBRATION.layoutSpread;
      const baseDist = CALIBRATION.layoutRadius + (i % 2) * CALIBRATION.layoutLift;
      let x = player.x + Math.cos(angle) * baseDist;
      let y = player.y + Math.sin(angle) * baseDist;
      let clear = false;
      for (let attempt = 0; attempt < 12; attempt++) {
        const step = attempt === 0 ? 0 : (attempt % 2 === 0 ? -1 : 1) * Math.ceil(attempt / 2) * 38;
        const spread = attempt === 0 ? 0 : ((attempt % 3) - 1) * 0.13;
        const cx = player.x + Math.cos(angle + spread) * (baseDist + step);
        const cy = player.y + Math.sin(angle + spread) * (baseDist + step);
        if (!this.pointClearOfCover(cx, cy, this.calibrationRadius(kind) + 8)) continue;
        let overlaps = false;
        for (let j = 0; j < this.sentries.length; j++) {
          const other = this.sentries[j];
          if (!other.active || other.kind < 4 || other.kind > 6) continue;
          if (Math.hypot(cx - other.x, cy - other.y) < this.calibrationRadius(kind) + other.radius + 24) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;
        x = cx;
        y = cy;
        clear = true;
        break;
      }
      if (!clear) {
        // A packed corner still gets the subject somewhere legal rather than dropping it.
        for (let s = 0; s < this.arena.spawns.length; s++) {
          const spot = this.arena.spawns[(s + i) % this.arena.spawns.length];
          if (this.pointClearOfCover(spot.x, spot.y, this.calibrationRadius(kind) + 8)) {
            x = spot.x;
            y = spot.y;
            break;
          }
        }
      }
      this.spawnCalibrationShape(kind, x, y);
    }
  }

  private calibrationRadius(kind: 4 | 5 | 6): number {
    return kind === 4 ? CALIBRATION.circle.radius : kind === 5 ? CALIBRATION.triangle.radius : CALIBRATION.rect.radius;
  }

  private calibrationHp(kind: 4 | 5 | 6): number {
    return kind === 4 ? CALIBRATION.circle.hp : kind === 5 ? CALIBRATION.triangle.hp : CALIBRATION.rect.hp;
  }

  /** Puts one dormant subject into the sentry pool, so every player weapon can damage it. */
  private spawnCalibrationShape(kind: 4 | 5 | 6, x: number, y: number): number {
    const slot = this.freeSentrySlot();
    if (slot < 0) return -1;
    const s = this.sentries[slot];
    const hp = this.calibrationHp(kind);
    s.active = true;
    s.kind = kind;
    s.x = s.prevX = x;
    s.y = s.prevY = y;
    s.vx = 0;
    s.vy = 0;
    s.kx = 0;
    s.ky = 0;
    s.hp = s.maxHp = hp;
    s.radius = this.calibrationRadius(kind);
    s.fireT = 0;
    s.phase = this.rng.range(0, Math.PI * 2);
    s.hitFlash = 0;
    s.orbitSign = 1;
    s.anchorX = x;
    s.anchorY = y;
    s.leash = 0;
    s.spawnT = 0;
    s.pinT = 0;
    s.orbitOwner = -1;
    // The calibration primaries park the orbit fields; the triangle reuses them as its
    // wandering heading, standoff ring and turn direction.
    s.orbitA = this.rng.range(0, Math.PI * 2);
    s.orbitR = CALIBRATION.triangle.floatRing * this.rng.range(0.85, 1.18);
    s.orbitDir = this.rng.range(0, 1) < 0.5 ? -1 : 1;
    s.orbitHitCd = 0;
    s.ramT = 0;
    s.ramCd = 0;
    s.ramHit = false;
    s.ramDirX = 1;
    s.ramDirY = 0;
    s.shapeState = 0;
    s.shapeT = 0;
    s.shapeAtkCd = 0;
    s.shapeParent = -1;
    s.shapeLife = 0;
    s.shapeBounces = 0;
    s.shapeCount = 0;
    return slot;
  }

  private freeSentrySlot(): number {
    for (let i = 0; i < this.sentries.length; i++) if (!this.sentries[i].active) return i;
    return -1;
  }

  private trainingParentsActive(): boolean {
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active && s.kind >= 4 && s.kind <= 6) return true;
    }
    return false;
  }

  private clearTrainingShapes(): void {
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active && s.kind >= 4) s.active = false;
    }
  }

  private clearShapeChildren(parentIndex: number): void {
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active && s.shapeParent === parentIndex) s.active = false;
    }
  }

  /** Opens every dormant eye together and starts the spin. */
  private wakeCalibration(): void {
    if (this.calibrationAwake) return;
    this.calibrationAwake = true;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active || s.kind < 4 || s.kind > 6 || s.shapeState !== 0) continue;
      s.shapeState = 1;
      s.shapeT = CALIBRATION.wakeTime;
      s.shapeAtkCd = 0;
      s.ramT = 0;
      s.ramDirX = 0;
      s.ramDirY = 0;
    }
    this.campaignBannerKind = 5;
    this.campaignBannerT = CALIBRATION.wakeBannerTime;
    this.campaignBannerDur = CALIBRATION.wakeBannerTime;
  }

  /**
   * One tick of the calibration subjects. They are ordinary sentry-pool bodies so every
   * player weapon already hits them, but they run their own script: wake together, spin,
   * then show one primary's attack. The gauntlet AI stays off until the drill.
   */
  private updateTrainingShapes(dt: number): void {
    const p = this.players[0];
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      s.prevX = s.x;
      s.prevY = s.y;
      if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt);
      if (s.kind >= 7) {
        this.updateShapeChild(s, dt, p);
        continue;
      }
      if (s.shapeState === 0) continue;
      if (s.shapeState === 1) {
        s.shapeT -= dt;
        if (s.shapeT <= 0) {
          s.shapeState = 2;
          s.shapeAtkCd = 0.55 + this.rng.range(0, 0.5);
        }
        continue;
      }
      if (s.kind === 4) this.updateCircleSubject(s, dt, p);
      else if (s.kind === 5) this.updateTriangleSubject(s, dt, p);
      else if (s.kind === 6) this.updateRectSubject(s, dt, p);
    }
  }

  /** Blue circle: wind up, then a committed dash that bounces off walls and cover. */
  private updateCircleSubject(s: Sentry, dt: number, p: Player): void {
    const cfg = CALIBRATION.circle;
    if (s.shapeState === 3) {
      s.shapeT -= dt;
      if (s.shapeT <= 0) {
        s.shapeState = 4;
        s.shapeT = cfg.dashTime;
        s.shapeBounces = cfg.bounces;
        s.shapeCount = 0;
        s.vx = s.ramDirX * cfg.dashSpeed;
        s.vy = s.ramDirY * cfg.dashSpeed;
        this.emit(EV.SENTRY_SHOOT, -1, s.x, s.y, Math.atan2(s.ramDirY, s.ramDirX));
      }
      return;
    }
    if (s.shapeState === 4) {
      s.shapeT -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (this.bounceShape(s)) {
        s.shapeBounces--;
        if (s.shapeBounces <= 0) {
          s.shapeState = 2;
          s.vx = 0;
          s.vy = 0;
          s.shapeAtkCd = cfg.cooldown;
          return;
        }
      }
      this.shapeTouchPlayer(s, p, cfg.damage, cfg.knockback);
      if (s.shapeT <= 0) {
        s.shapeState = 2;
        s.vx = 0;
        s.vy = 0;
        s.shapeAtkCd = cfg.cooldown;
      }
      return;
    }
    // Idle: close to a comfortable dash range, then aim. It does not lead the target.
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantX = p.alive && dist > 190 ? dx / dist : 0;
    const wantY = p.alive && dist > 190 ? dy / dist : 0;
    const k = 1 - Math.exp(-2.2 * dt);
    s.vx += (wantX * 74 - s.vx) * k;
    s.vy += (wantY * 74 - s.vy) * k;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    this.pushOutOfCover(s, s.radius);
    s.shapeAtkCd -= dt;
    if (s.shapeAtkCd > 0 || !p.alive || p.cloakT > 0 || dist > 540) return;
    if (this.lineBlocked(s.x, s.y, p.x, p.y)) return;
    s.shapeState = 3;
    s.shapeT = cfg.windup;
    s.ramDirX = dx / dist;
    s.ramDirY = dy / dist;
    s.vx = 0;
    s.vy = 0;
  }

  /**
   * Red triangle: the parent drifts around the fight and releases waves of tiny seekers.
   * It is the watchful mother behind the swarm, never a stationary turret.
   */
  private updateTriangleSubject(s: Sentry, dt: number, p: Player): void {
    const cfg = CALIBRATION.triangle;
    const self = this.sentries.indexOf(s);
    // The parent floats the whole time. Its heading wanders on a slow sine, it keeps a
    // loose band around the player, and it turns off a wall before the clamp catches it,
    // so it drifts around the room instead of orbiting one anchor or grinding an edge.
    // A pinned float still reads as a stationary target once the fight moves away.
    s.phase += dt;
    s.orbitA += Math.sin(s.phase * cfg.floatTurn + s.orbitDir * 1.3) * cfg.floatTurnRate * s.orbitDir * dt;
    const b = this.arena.bounds;
    const margin = cfg.floatMargin;
    const cosA = Math.cos(s.orbitA);
    const sinA = Math.sin(s.orbitA);
    // Turn the heading inward near a lip. Reflecting the wander angle is smooth because
    // the body's velocity eases toward the new direction, unlike a hard positional kick.
    if (s.x < b.left + margin && cosA < 0) s.orbitA = Math.PI - s.orbitA;
    else if (s.x > b.right - margin && cosA > 0) s.orbitA = Math.PI - s.orbitA;
    if (s.y < b.top + margin && sinA < 0) s.orbitA = -s.orbitA;
    else if (s.y > b.bottom - margin && sinA > 0) s.orbitA = -s.orbitA;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Keep a loose band around the fight by turning the heading itself, not by adding an
    // opposing vector: two canceling vectors just park the body at the band edge. Too far
    // eases back in, too close gives ground. The band is wide on purpose, because this
    // body watches the attack, it does not lead it.
    if (p.alive) {
      let homeA = Number.NaN;
      if (dist > s.orbitR * 1.35) homeA = Math.atan2(dy, dx);
      else if (dist < s.orbitR * 0.6) homeA = Math.atan2(-dy, -dx);
      if (!Number.isNaN(homeA)) {
        const da = Math.atan2(Math.sin(homeA - s.orbitA), Math.cos(homeA - s.orbitA));
        s.orbitA += da * (1 - Math.exp(-1.4 * dt));
      }
    }
    const wantX = Math.cos(s.orbitA) * cfg.floatSpeed;
    const wantY = Math.sin(s.orbitA) * cfg.floatSpeed;
    const fk = 1 - Math.exp(-2 * dt);
    s.vx += (wantX - s.vx) * fk;
    s.vy += (wantY - s.vy) * fk;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (!this.openWalls) {
      s.x = Math.max(b.left + s.radius, Math.min(b.right - s.radius, s.x));
      s.y = Math.max(b.top + s.radius, Math.min(b.bottom - s.radius, s.y));
    }
    this.pushOutOfCover(s, s.radius);
    let live = 0;
    for (let i = 0; i < this.sentries.length; i++) {
      const child = this.sentries[i];
      if (child.active && child.shapeParent === self) live++;
    }
    if (live > 0) return;
    s.shapeAtkCd -= dt;
    if (s.shapeAtkCd > 0 || !p.alive) return;
    s.shapeAtkCd = cfg.spawnDelay;
    const around = Math.atan2(this.centerY - s.y, this.centerX - s.x);
    for (let i = 0; i < cfg.shards; i++) {
      const a = around + (i / cfg.shards) * Math.PI * 2;
      const dist = s.radius + 16 + (i % 3) * 6;
      const x = s.x + Math.cos(a) * dist;
      const y = s.y + Math.sin(a) * dist;
      if (!this.pointClearOfCover(x, y, cfg.shardRadius)) continue;
      this.spawnShapeChild(self, 7, x, y, a, i);
    }
    this.emit(EV.SENTRY_SHOOT, -1, s.x, s.y, Math.atan2(p.y - s.y, p.x - s.x));
  }

  /**
   * Yellow rectangle: a row leader. It sweeps side to side while advancing, grows a
   * row of linked copies on alternating sides, then the whole row charges together.
   * Copies are not independent attackers until that charge; they hold their slot.
   */
  private updateRectSubject(s: Sentry, dt: number, p: Player): void {
    const cfg = CALIBRATION.rect;
    const self = this.sentries.indexOf(s);
    s.phase += dt;
    if (s.shapeState === 4) {
      s.shapeT -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (!this.openWalls) {
        s.x = Math.max(this.arena.bounds.left + s.radius, Math.min(this.arena.bounds.right - s.radius, s.x));
        s.y = Math.max(this.arena.bounds.top + s.radius, Math.min(this.arena.bounds.bottom - s.radius, s.y));
      }
      for (let i = 0; i < this.solids.length; i++) {
        if (circleRect(s.x, s.y, s.radius, this.solids[i], hitScratch)) {
          s.shapeState = 2;
          s.shapeAtkCd = cfg.cooldown;
          s.x = hitScratch.px;
          s.y = hitScratch.py;
          return;
        }
      }
      this.shapeTouchPlayer(s, p, cfg.echoDamage, cfg.echoKnockback);
      if (s.shapeT <= 0) {
        s.shapeState = 2;
        s.shapeAtkCd = cfg.cooldown;
      }
      return;
    }
    if (s.shapeState === 3) {
      s.shapeT -= dt;
      if (s.shapeT <= 0) {
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        s.shapeState = 4;
        s.shapeT = cfg.echoLife;
        s.shapeCount = 0;
        s.ramDirX = dx / d;
        s.ramDirY = dy / d;
        s.vx = s.ramDirX * cfg.echoSpeed;
        s.vy = s.ramDirY * cfg.echoSpeed;
        this.emit(EV.SENTRY_SHOOT, -1, s.x, s.y, Math.atan2(s.ramDirY, s.ramDirX));
      }
      return;
    }

    // Hover and close very slowly, with a light vertical float. No spin, no sweep:
    // this silhouette is a block, and it should read as one before it clones.
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const advance = p.alive && dist > 220 ? cfg.advanceSpeed : p.alive ? -cfg.advanceSpeed * 0.45 : 0;
    const bob = Math.sin(s.phase * cfg.bobRate) * cfg.bobSpeed;
    const k = 1 - Math.exp(-3.2 * dt);
    s.vx += (ux * advance - s.vx) * k;
    s.vy += (uy * advance + bob - s.vy) * k;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    this.pushOutOfCover(s, s.radius);
    if (!this.openWalls) {
      s.x = Math.max(this.arena.bounds.left + s.radius, Math.min(this.arena.bounds.right - s.radius, s.x));
      s.y = Math.max(this.arena.bounds.top + s.radius, Math.min(this.arena.bounds.bottom - s.radius, s.y));
    }
    // Keep the row's forward axis on the player even while it sweeps sideways.
    s.ramDirX = ux;
    s.ramDirY = uy;

    let live = 0;
    for (let i = 0; i < this.sentries.length; i++) {
      const child = this.sentries[i];
      if (child.active && child.shapeParent === self) live++;
    }
    s.shapeAtkCd -= dt;
    if (s.shapeAtkCd > 0 || !p.alive) return;

    if (live < cfg.echoes) {
      // Alternate sides so the row grows outward from the leader, not one shoulder.
      // Walk the slots in order and take the first clear one; a wall on one flank
      // should not stall the whole row.
      // Clones appear directly left and right of the block, not on a rotated axis.
      const slots = [-1, 1, -2, 2];
      let spawned = false;
      for (let si = 0; si < slots.length && !spawned; si++) {
        const slot = slots[si];
        let used = false;
        for (let j = 0; j < this.sentries.length; j++) {
          const child = this.sentries[j];
          if (child.active && child.shapeParent === self && child.shapeBounces === slot) {
            used = true;
            break;
          }
        }
        if (used) continue;
        const x = s.x + slot * cfg.echoOffset;
        const y = s.y;
        if (!this.pointClearOfCover(x, y, cfg.echoRadius)) continue;
        this.spawnShapeChild(self, 8, x, y, Math.atan2(uy, ux), slot);
        this.emit(EV.SENTRY_SHOOT, -1, x, y, Math.atan2(uy, ux));
        spawned = true;
      }
      // The last copy gets a longer beat to ease into its slot before the charge tell.
      s.shapeAtkCd = spawned && live + 1 >= cfg.echoes ? 0.55 : 0.3;
      return;
    }

    // Row full and linked: settle it, then commit the whole formation forward.
    s.shapeState = 3;
    s.shapeT = cfg.echoWindup;
    s.vx = 0;
    s.vy = 0;
    for (let i = 0; i < this.sentries.length; i++) {
      const child = this.sentries[i];
      if (child.active && child.shapeParent === self) child.vx = child.vy = 0;
    }
  }

  /** A shard or an echo. Shards seek; echoes commit to a straight lane. */
  private updateShapeChild(s: Sentry, dt: number, p: Player): void {
    if (s.kind === 7) {
      const cfg = CALIBRATION.triangle;
      s.shapeLife -= dt;
      if (s.shapeLife <= 0) {
        s.active = false;
        return;
      }
      // A swarm, not a volley: each shard orbits the player on its own radius and
      // phase, with a high-frequency jitter on the point it chases. The lag from that
      // moving target is what makes the cloud churn instead of flying straight in.
      s.phase += dt;
      if (s.shapeAtkCd > 0) s.shapeAtkCd = Math.max(0, s.shapeAtkCd - dt);
      const swirl = s.phase * 2.2 * s.orbitDir + s.orbitA;
      const radius = s.orbitR + Math.sin(s.phase * 6.1 + s.orbitA * 3) * 9;
      const jitterX = Math.sin(s.phase * 19 + s.orbitA * 5) * 12;
      const jitterY = Math.cos(s.phase * 23 + s.orbitA * 7) * 12;
      const tx = p.x + Math.cos(swirl) * radius + jitterX;
      const ty = p.y + Math.sin(swirl) * radius + jitterY;
      const dx = tx - s.x;
      const dy = ty - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = 1 - Math.exp(-11 * dt);
      s.vx += ((dx / d) * cfg.shardSpeed - s.vx) * k;
      s.vy += ((dy / d) * cfg.shardSpeed - s.vy) * k;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.pushOutOfCover(s, s.radius);
      const pdx = p.x - s.x;
      const pdy = p.y - s.y;
      if (s.shapeAtkCd <= 0 && p.alive && p.cloakT <= 0 && p.iframes <= 0) {
        const rr = s.radius + PLAYER.radius + 2;
        if (pdx * pdx + pdy * pdy <= rr * rr && !this.lineBlocked(s.x, s.y, p.x, p.y)) {
          const pd = Math.hypot(pdx, pdy) || 1;
          // A bite does not delete the swarm member: it recoils, keeps orbiting and
          // can bite again after a beat. The cloud stays on screen for its full life.
          s.shapeAtkCd = 1.15;
          this.damagePlayer(p, cfg.shardDamage, -1, pdx / pd, pdy / pd, cfg.shardKnockback, SRC.SENTRY, this.sentries.indexOf(s));
          s.x -= (pdx / pd) * 22;
          s.y -= (pdy / pd) * 22;
        }
      }
      return;
    }

    // Row copy (8): holds a slot beside the leader while it sweeps, then charges as
    // one formation. It has no independent tell or path of its own.
    const cfg = CALIBRATION.rect;
    const leader = this.sentries[s.shapeParent];
    if (!leader || !leader.active || leader.kind !== 6) {
      s.active = false;
      return;
    }
    if (leader.shapeState === 4) {
      if (s.shapeState !== 4) {
        s.shapeState = 4;
        s.shapeLife = cfg.echoLife;
        s.shapeCount = 0;
      }
      s.shapeLife -= dt;
      if (s.shapeLife <= 0) {
        s.active = false;
        return;
      }
      s.vx = leader.ramDirX * cfg.echoSpeed;
      s.vy = leader.ramDirY * cfg.echoSpeed;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (
        !this.openWalls &&
        (s.x < this.arena.bounds.left + s.radius ||
          s.x > this.arena.bounds.right - s.radius ||
          s.y < this.arena.bounds.top + s.radius ||
          s.y > this.arena.bounds.bottom - s.radius)
      ) {
        s.active = false;
        return;
      }
      for (let i = 0; i < this.solids.length; i++) {
        if (circleRect(s.x, s.y, s.radius, this.solids[i], hitScratch)) {
          s.active = false;
          return;
        }
      }
      if (s.shapeCount === 0 && p.alive && p.cloakT <= 0 && p.iframes <= 0) {
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const rr = s.radius + PLAYER.radius + 2;
        if (dx * dx + dy * dy <= rr * rr) {
          const d = Math.hypot(dx, dy) || 1;
          s.shapeCount = 1;
          this.damagePlayer(p, cfg.echoDamage, -1, dx / d, dy / d, cfg.echoKnockback, SRC.SENTRY, this.sentries.indexOf(s));
          s.active = false;
        }
      }
      return;
    }

    // Linked row: hold a slot directly to the leader's left or right, floating on
    // the same light bob. Copies never rotate and never hold a diagonal axis.
    s.shapeState = 2;
    s.phase += dt;
    const tx = leader.x + s.shapeBounces * cfg.echoOffset;
    const ty = leader.y + Math.sin(s.phase * cfg.bobRate + s.orbitA) * (cfg.bobSpeed * 0.32);
    if (leader.shapeState === 3) {
      s.vx = 0;
      s.vy = 0;
      return;
    }
    const dx = tx - s.x;
    const dy = ty - s.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = 1 - Math.exp(-8 * dt);
    s.vx += ((dx / d) * Math.min(310, d * 5) - s.vx) * k;
    s.vy += ((dy / d) * Math.min(310, d * 5) - s.vy) * k;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    this.pushOutOfCover(s, s.radius);
  }

  /** Reflects a committed shape off the bounds and cover. Returns true on a bounce. */
  private bounceShape(s: Sentry): boolean {
    const b = this.arena.bounds;
    let bounced = false;
    if (!this.openWalls) {
      if (s.x < b.left + s.radius && s.vx < 0) {
        s.x = b.left + s.radius;
        s.vx = -s.vx;
        bounced = true;
      } else if (s.x > b.right - s.radius && s.vx > 0) {
        s.x = b.right - s.radius;
        s.vx = -s.vx;
        bounced = true;
      }
      if (s.y < b.top + s.radius && s.vy < 0) {
        s.y = b.top + s.radius;
        s.vy = -s.vy;
        bounced = true;
      } else if (s.y > b.bottom - s.radius && s.vy > 0) {
        s.y = b.bottom - s.radius;
        s.vy = -s.vy;
        bounced = true;
      }
    }
    for (let i = 0; i < this.solids.length; i++) {
      if (!circleRect(s.x, s.y, s.radius, this.solids[i], hitScratch)) continue;
      s.x = hitScratch.px;
      s.y = hitScratch.py;
      const vn = s.vx * hitScratch.nx + s.vy * hitScratch.ny;
      if (vn < 0) {
        s.vx -= 2 * vn * hitScratch.nx;
        s.vy -= 2 * vn * hitScratch.ny;
        bounced = true;
      }
    }
    if (bounced) this.emit(EV.BOUNCE, -1, s.x, s.y, 1);
    return bounced;
  }

  /** Damages the local player once per committed attack, never through cover. */
  private shapeTouchPlayer(s: Sentry, p: Player, damage: number, knockback: number): void {
    if (s.shapeCount > 0 || !p.alive || p.cloakT > 0 || p.iframes > 0) return;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const rr = s.radius + PLAYER.radius + 2;
    if (dx * dx + dy * dy > rr * rr) return;
    if (this.lineBlocked(s.x, s.y, p.x, p.y)) return;
    const d = Math.hypot(dx, dy) || 1;
    s.shapeCount = 1;
    this.damagePlayer(p, damage, -1, dx / d, dy / d, knockback, SRC.SENTRY, this.sentries.indexOf(s));
  }

  private spawnShapeChild(parent: number, kind: 7 | 8, x: number, y: number, angle: number, seed = 0): number {
    const slot = this.freeSentrySlot();
    if (slot < 0) return -1;
    const s = this.sentries[slot];
    const tri = CALIBRATION.triangle;
    const rect = CALIBRATION.rect;
    s.active = true;
    s.kind = kind;
    s.x = s.prevX = x;
    s.y = s.prevY = y;
    s.vx = 0;
    s.vy = 0;
    s.kx = 0;
    s.ky = 0;
    s.hp = s.maxHp = kind === 7 ? tri.shardHp : rect.echoHp;
    s.radius = kind === 7 ? tri.shardRadius : rect.echoRadius;
    s.fireT = 0;
    s.phase = this.rng.range(0, Math.PI * 2);
    s.hitFlash = 0;
    s.orbitSign = 1;
    s.anchorX = x;
    s.anchorY = y;
    s.leash = 0;
    s.spawnT = 0;
    s.pinT = 0;
    s.orbitOwner = -1;
    // Shards use the orbit fields as their swarm slot; echoes leave them parked.
    s.orbitA = kind === 7 ? (seed / Math.max(1, CALIBRATION.triangle.shards)) * Math.PI * 2 : seed * 1.7;
    s.orbitR = kind === 7 ? 38 + (seed % 4) * 14 : 0;
    s.orbitDir = seed % 2 === 0 ? 1 : -1;
    s.orbitHitCd = 0;
    s.ramT = 0;
    s.ramCd = 0;
    s.ramHit = false;
    s.ramDirX = Math.cos(angle);
    s.ramDirY = Math.sin(angle);
    s.shapeParent = parent;
    s.shapeState = 2;
    s.shapeT = 0;
    // Shards form the cloud before they are allowed to bite; row copies wait for the
    // leader's charge and have no timer of their own.
    s.shapeAtkCd = kind === 7 ? 0.55 : 0;
    s.shapeLife = kind === 7 ? tri.shardLife : 0;
    s.shapeBounces = kind === 8 ? seed : 0;
    s.shapeCount = 0;
    return slot;
  }

  /**
   * Drill formation slot `k`: an arc facing arena centre, `drillRing` out from the player.
   * Candidates walk outward until one clears cover; the arena ring stays the fallback.
   */
  private drillSlotPos(k: number, leader: Player): void {
    const n = Math.max(1, this.botSlots);
    const base = Math.atan2(this.centerY - leader.y, this.centerX - leader.x);
    const a = base + (k - (n - 1) * 0.5) * CAMPAIGN.drillSpread;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const minSep = PLAYER.radius * 2.2;
    let x = leader.x + cos * minSep * 2;
    let y = leader.y + sin * minSep * 2;
    // Outward arcs first, then tighter rings for a small island or a corner spawn.
    for (let attempt = 0; attempt < 6; attempt++) {
      const step = attempt === 0 ? 0 : attempt === 1 ? 58 : attempt === 2 ? 116 : attempt === 3 ? -90 : attempt === 4 ? -140 : -175;
      const r = CAMPAIGN.drillRing + step;
      if (r < minSep) continue;
      const cx = leader.x + cos * r;
      const cy = leader.y + sin * r;
      if (Math.hypot(cx - leader.x, cy - leader.y) < minSep) continue;
      if (!this.pointClearOfCover(cx, cy, PLAYER.radius + 8)) continue;
      x = cx;
      y = cy;
      this.spawnTmpX[k] = x;
      this.spawnTmpY[k] = y;
      return;
    }
    // Last resort: the nearest arena spawn that is clear and not on top of the leader.
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.arena.spawns.length; i++) {
      const s = this.arena.spawns[i];
      const d = Math.hypot(s.x - leader.x, s.y - leader.y);
      if (d < minSep || d >= best) continue;
      if (!this.pointClearOfCover(s.x, s.y, PLAYER.radius + 8)) continue;
      best = d;
      x = s.x;
      y = s.y;
    }
    this.spawnTmpX[k] = x;
    this.spawnTmpY[k] = y;
  }

  /** Advances the campaign script. The threat simulation waits for the assault phase. */
  private updateCampaign(dt: number): void {
    if (this.campaignBannerT > 0) this.campaignBannerT = Math.max(0, this.campaignBannerT - dt);
    if (this.campaignPhase === 'calibration') {
      this.campaignT += dt;
      if (!this.calibrationAwake) {
        const player = this.players[0];
        let nearSubject = false;
        if (player.alive) {
          for (let i = 0; i < this.sentries.length; i++) {
            const s = this.sentries[i];
            if (!s.active || s.kind < 4 || s.kind > 6 || s.shapeState !== 0) continue;
            if (Math.hypot(s.x - player.x, s.y - player.y) <= CALIBRATION.wakeRadius) {
              nearSubject = true;
              break;
            }
          }
        }
        if (nearSubject || this.campaignT >= CALIBRATION.wakeDelay) this.wakeCalibration();
      }
      if (this.calibrationAwake && !this.trainingParentsActive()) this.beginDrill();
      return;
    }
    if (this.campaignPhase === 'drill') {
      this.campaignT += dt;
      if (this.campaignT >= CAMPAIGN.drillTime) this.beginBreach();
      return;
    }
    if (this.campaignPhase === 'breach') {
      this.campaignT += dt;
      if (this.campaignT >= CAMPAIGN.breachTime) this.beginAssault();
      return;
    }
    if (this.campaignPhase === 'assault') {
      this.campaignT += dt;
      if (this.gauntletKills >= CAMPAIGN.killsToClear) this.clearCampaign();
    }
  }

  /** Adds the level's authored data crates to the floor, once, on the breach beat. */
  private spawnCampaignData(): void {
    if (this.dataTotal > 0) return;
    for (let i = 0; i < this.levelData.length; i++) {
      const d = this.levelData[i];
      this.props.push({
        active: true,
        kind: d.kind,
        x: d.x,
        y: d.y,
        w: 42,
        h: 30,
        hp: FILE_PROP.hp,
        hitFlash: 0,
        dropT: 0,
        vx: 0,
        vy: 0,
        tx: 0,
        ty: 0,
      });
    }
    this.dataTotal = this.levelData.length;
  }

  private beginBreach(): void {
    this.campaignPhase = 'breach';
    this.campaignT = 0;
    // The room's data loads with the assault: the drill is a spar, not a data hazard.
    this.spawnCampaignData();
    this.campaignBannerKind = 1;
    this.campaignBannerT = CAMPAIGN.breachBannerTime;
    this.campaignBannerDur = CAMPAIGN.breachBannerTime;
    // The drill squad logs off on the breach beat so the incoming hostiles own the room.
    for (let i = 1; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active) continue;
      this.emit(EV.ELIMINATED, 0, p.x, p.y, p.slot);
      p.active = false;
      p.alive = false;
    }
    for (let i = 0; i < this.projectiles.length; i++) this.projectiles[i].active = false;
    const p = this.players[0];
    // A knockdown on the last drill frame must not leave the player dead for the breach.
    p.alive = true;
    p.respawnT = 0;
    p.hp = p.maxHp;
    p.energy = PLAYER.energyMax;
    p.iframes = 1;
    this.infection = 0;
  }

  private beginAssault(): void {
    this.campaignPhase = 'assault';
    this.campaignT = 0;
    this.campaignBannerT = 0;
    this.gauntletT = 0;
    this.gauntletKills = 0;
    this.wave = CAMPAIGN.waveStart;
    this.waveBannerT = 2.4;
    this.wormSpawnT = CAMPAIGN.openingWormDelay;
    // Land the opening pack on the breach beat instead of waiting out the timer.
    this.spawnSentryPack();
    this.sentrySpawnT = CAMPAIGN.sentryInterval;
  }

  private clearCampaign(): void {
    if (this.campaignPhase === 'cleared' || this.campaignPhase === 'failed') return;
    let kept = 0;
    for (let i = 0; i < this.props.length; i++) if (this.props[i].active) kept++;
    this.dataKept = kept;
    this.campaignPhase = 'cleared';
    this.campaignBannerKind = 2;
    this.campaignBannerT = CAMPAIGN.clearBannerTime;
    this.campaignBannerDur = CAMPAIGN.clearBannerTime;
    this.gauntletOver = true; // freeze the arena under the DOM result overlay
    this.emit(EV.MATCH_END, 0, this.players[0].x, this.players[0].y, 1);
  }

  /** Seconds survived in the current gauntlet run; frozen once the run ends. */
  get gauntletTime(): number {
    return this.gauntletT;
  }

  /** 0 at wave 1, 1 at fullPressureWave. The bench's practice path always runs at full pressure. */
  private gauntletPressure(): number {
    if (this.gauntletPractice) return 1;
    const span = Math.max(1, GAUNTLET.fullPressureWave - 1);
    return Math.min(1, Math.max(0, (this.wave - 1) / span));
  }

  private gauntletInterval(max: number, min: number): number {
    return max + (min - max) * this.gauntletPressure();
  }

  private wormLimit(): number {
    if (this.gauntletPractice) return GAUNTLET.maxWorms;
    return Math.min(
      GAUNTLET.maxWorms,
      1 + Math.floor(Math.max(0, this.wave - GAUNTLET.wormWave) / GAUNTLET.wormCapStep),
    );
  }

  private virusLimit(): number {
    if (this.gauntletPractice) return GAUNTLET.maxViruses;
    return Math.min(
      GAUNTLET.maxViruses,
      GAUNTLET.virusCapBase +
        Math.floor(Math.max(0, this.wave - GAUNTLET.virusWave) / GAUNTLET.virusCapStep),
    );
  }

  private virusClusterCount(): number {
    if (this.gauntletPractice) return GAUNTLET.virusCluster;
    return Math.min(
      GAUNTLET.virusCluster,
      GAUNTLET.virusClusterStart +
        Math.floor(Math.max(0, this.wave - GAUNTLET.virusWave) / GAUNTLET.virusClusterStep),
    );
  }

  private sentryLimit(): number {
    if (this.gauntletPractice) return SENTRY.max;
    return Math.min(
      SENTRY.max,
      SENTRY.startCap + Math.floor(Math.max(0, this.wave - 1) / SENTRY.capStep),
    );
  }

  private errorLimit(): number {
    if (this.gauntletPractice) return CASCADING_ERROR.maxBlocks;
    return Math.min(
      CASCADING_ERROR.maxBlocks,
      CASCADING_ERROR.startBlocks +
        Math.floor(Math.max(0, this.wave - GAUNTLET.errorWave) / CASCADING_ERROR.blockCapStep),
    );
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
    // A scored gauntlet death freezes the arena under the results overlay. Practice
    // keeps the old endless-respawn behavior. The attract demo has no overlay, so its
    // death aftermath keeps running until the pilot starts the next run; a still frame
    // for the whole restart delay read as a paused game.
    if (this.mode === 'gauntlet' && this.gauntletOver && !this.attractMode) {
      this.clearPressed(inputs);
      return;
    }
    if (this.campaign) this.updateCampaign(dt);
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

    // Bad Lag's dilation runs on the real clock: five seconds is five seconds even
    // while the field is slowing everything inside it.
    if (this.timeSlowT > 0) {
      this.timeSlowT = Math.max(0, this.timeSlowT - dt);
      if (this.timeSlowT === 0) this.timeSlowOwner = -1;
    }

    const canAct = this.phase === 'live' || this.phase === 'practice';
    if (this.mode === 'gauntlet') this.driveThrall(dt);
    if (this.arena.pushers && canAct) this.tickPusher(dt);
    // The calibration prologue owns the room. Arena hazards wait for the drill, so a
    // stray beam cannot delete a trainee before the subjects have even opened their eyes.
    const calibrationHold = this.campaign && this.campaignPhase === 'calibration';
    if (this.emitters.length > 0 && canAct && !calibrationHold) this.updateEmitters(dt);

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active) continue;
      if (!p.alive) {
        // The campaign drill is practice: both the player and the squad come back.
        if (this.campaign && this.campaignPhase === 'drill') {
          p.respawnT -= dt;
          if (p.respawnT <= 0) this.respawnTrainingPlayer(p);
          continue;
        }
        if (this.mode === 'gauntlet' && p.slot > 0) {
          // Kiosk squadmates are local bodies, not enemy thralls: bring them back on
          // the training timer so a three-player display keeps its group on screen.
          if (this.attractMode && p.slot < this.attractSquad) {
            p.respawnT -= dt;
            if (p.respawnT <= 0) this.respawnTrainingPlayer(p);
            continue;
          }
          p.active = false;
          p.thrall = false;
          continue;
        }
        if (this.mode === 'training' || (this.mode === 'gauntlet' && this.gauntletPractice)) {
          p.respawnT -= dt;
          if (p.respawnT <= 0) this.respawnTrainingPlayer(p);
        }
        continue;
      }

      p.prevX = p.x;
      p.prevY = p.y;
      p.prevFacing = p.facing;

      // Time effects. Fast-forward burns every per-player timer and attack at 2.5x;
      // a slowed body (Bad Lag's dilation, everyone but the caster) runs at 0.3x.
      // Both effects run on the real clock, so their own timers tick on raw `dt`.
      const fast = p.fastT > 0;
      const chilled = this.timeSlowT > 0 && p.slot !== this.timeSlowOwner;
      const timeScale = (fast ? BUFFER.fastScale : 1) * (chilled ? BUFFER.slowScale : 1);
      // Walking is scaled here; dashes and plows keep their committed distance.
      p.speedMult = timeScale;
      if (p.fastT > 0) p.fastT = Math.max(0, p.fastT - dt);
      // Per-player dt for cooldowns, attack rate and swing animations.
      const pdt = dt * timeScale;

      // A ride owns the body: no steering, no attacks, no damage until the car or
      // the pad lets go. The position was already moved to the far plate.
      if (p.travelCd > 0) p.travelCd = Math.max(0, p.travelCd - dt);
      if (p.travelT > 0) {
        this.tickTravel(p, dt);
        continue;
      }

      // Over the void: the body hangs for a beat instead of vanishing on the lip. It is
      // still steerable at reduced speed against a slight outward pull, so a quick stick
      // back toward the floor can save it. No attacks, no knockback.
      if (p.fallT > 0) {
        p.fallT = Math.max(0, p.fallT - dt);
        const fin = inputs[p.slot] ?? null;
        const hole = this.voidAt(p.x, p.y);
        let pullX = 0;
        let pullY = 0;
        if (hole) {
          const hx = hole.x + hole.w * 0.5 - p.x;
          const hy = hole.y + hole.h * 0.5 - p.y;
          const hd = Math.hypot(hx, hy) || 1;
          pullX = (hx / hd) * FALL.pull;
          pullY = (hy / hd) * FALL.pull;
        } else {
          const ox = p.x - this.centerX;
          const oy = p.y - this.centerY;
          const od = Math.hypot(ox, oy) || 1;
          pullX = (ox / od) * FALL.pull;
          pullY = (oy / od) * FALL.pull;
        }
        const mx = fin ? fin.mx : 0;
        const my = fin ? fin.my : 0;
        p.x += (mx * PLAYER.speed * FALL.control + pullX) * dt;
        p.y += (my * PLAYER.speed * FALL.control + pullY) * dt;
        p.vx = 0;
        p.vy = 0;
        p.kx = 0;
        p.ky = 0;
        if (!this.offFloor(p.x, p.y)) {
          // Pulled it back over the lip. The body lands with its feet under it.
          p.fallT = 0;
        } else if (p.fallT === 0) {
          this.fallPlayer(p);
        }
        continue;
      }

      if (p.dashT > 0) p.dashT = Math.max(0, p.dashT - dt);
      if (p.dashCd > 0) {
        p.dashCd = Math.max(0, p.dashCd - pdt);
        if (p.dashCd === 0 && p.dashCharges < PLAYER.dashCharges) {
          p.dashCharges++;
          if (p.dashCharges < PLAYER.dashCharges) p.dashCd = PLAYER.dashCooldown;
        }
      }
      if (p.guardCd > 0) p.guardCd = Math.max(0, p.guardCd - pdt);
      if (p.chargeDashCd > 0) p.chargeDashCd = Math.max(0, p.chargeDashCd - pdt);
      if (p.laserCd > 0) p.laserCd = Math.max(0, p.laserCd - pdt);
      if (p.beamReflectT > 0) p.beamReflectT = Math.max(0, p.beamReflectT - dt);
      // Gas/stream visual lifetime. Damage resolved on use; this only retires the draw.
      if (p.toxT > 0) p.toxT = Math.max(0, p.toxT - dt);
      this.tickPlayerPoison(p, dt);
      if (p.laserT > 0) {
        p.laserT = Math.max(0, p.laserT - pdt);
        p.laserTickT -= pdt;
        if (p.laserTickT <= 0) {
          p.laserTickT += PLAYER.laserTick;
          this.applyLaserDamage(p);
        }
        if (p.laserT === 0) p.laserCd = PLAYER.laserCooldown;
      }
      if (p.burstCd > 0) {
        p.burstCd = Math.max(0, p.burstCd - pdt);
        if (p.burstCd === 0) p.burstLeft = BOLT.burstCount;
      }
      if (p.iframes > 0) p.iframes = Math.max(0, p.iframes - dt);
      if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
      if (p.waveT > 0) p.waveT = Math.max(0, p.waveT - dt);
      if (p.waveCd > 0) p.waveCd = Math.max(0, p.waveCd - pdt);
      if (p.bugCd > 0) p.bugCd = Math.max(0, p.bugCd - pdt);
      if (p.autoFireT > 0) p.autoFireT = Math.max(0, p.autoFireT - pdt);
      if (p.bashT > 0) p.bashT = Math.max(0, p.bashT - dt);
      if (p.wedgeT > 0) p.wedgeT = Math.max(0, p.wedgeT - dt);
      if (p.stringT > 0) p.stringT = Math.max(0, p.stringT - pdt);
      if (p.stringLeft > 0 && p.stringT <= 0) this.fireWedgeStringShot(p);
      if (p.powerupT > 0) {
        p.powerupT = Math.max(0, p.powerupT - dt);
        if (p.powerupT === 0) {
          if (p.powerupKind === POWERUP_KIND.OVERCHARGE && p.laserT > 0) {
            p.laserT = 0;
            p.laserTickT = 0;
          }
          p.powerupKind = -1;
        }
      }
      if (p.ghostT > 0) p.ghostT = Math.max(0, p.ghostT - dt);
      if (p.cloakT > 0) p.cloakT = Math.max(0, p.cloakT - dt);
      if (p.dazeT > 0) p.dazeT = Math.max(0, p.dazeT - dt);
      if (p.scareT > 0) p.scareT = Math.max(0, p.scareT - dt);
      if (p.scareFaceT > 0) p.scareFaceT = Math.max(0, p.scareFaceT - dt);
      if (p.wallT > 0) p.wallT = Math.max(0, p.wallT - dt);
      if (p.slowT > 0) p.slowT = Math.max(0, p.slowT - dt);
      if (p.netPinT > 0) p.netPinT = Math.max(0, p.netPinT - dt);
      if (p.comboT > 0) {
        p.comboT = Math.max(0, p.comboT - dt);
        if (p.comboT === 0) p.comboStage = 0;
      }
      this.tickSwing(p, pdt);

      const input = this.mode === 'gauntlet' && p.thrall ? this.thrallFrame : (inputs[p.slot] ?? null);
      // Remember the last real stick direction. A dash commits to it even when lock is
      // holding facing on a target, so strafing past an enemy and dashing goes sideways.
      if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
        p.moveDirX = input.mx;
        p.moveDirY = input.my;
      }
      // An armed jump-scare answers any action press, not just melee. Consume the
      // press so the same button cannot also fire, swing, dash or start a skill.
      if (p.scareT > 0 && canAct && input && (input.pressed & SCARE_TRIGGER_ACTIONS) !== 0) {
        this.fireJumpScare(p);
        input.pressed &= ~SCARE_TRIGGER_ACTIONS;
        input.held &= ~SCARE_TRIGGER_ACTIONS;
      }
      const overcharged = p.powerupKind === POWERUP_KIND.OVERCHARGE && p.powerupT > 0;
      // Fisher is not rooted by the net wind-up: he has to move to draw the web out.
      let laserBusy =
        (p.laserT > 0 && !overcharged) ||
        p.wedgeT > 0 ||
        p.broT > 0 ||
        (p.laserChargeHeld && p.program !== PROGRAM_ID.FISHER);
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
        if (p.program === PROGRAM_ID.FISHER) {
          // The net is drawn by movement, not by rooting. Hold to pay out the line,
          // release to detach it as a shield and snare.
          if (canAct && heavyHeld) {
            p.laserChargeT += pdt;
            if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
              p.facing = Math.atan2(input.my, input.mx);
            }
            p.laserFacing = p.facing;
            if (!p.netDrawing && p.laserChargeT >= PLAYER.heavyTapMax) this.startNetDraw(p);
            if (p.netDrawing) {
              p.netT += dt;
              // The web is drawn by moving: every step samples the trail behind him, so
              // a curve or a hard turn is part of the shape instead of a straight line.
              this.sampleNet(p);
              if (p.netT >= FISHER.netDrawTime) this.detachNet(p);
            }
          } else {
            if (p.netDrawing) this.detachNet(p);
            else if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) this.useBug(p);
            p.laserChargeHeld = false;
            p.laserChargeT = 0;
            p.chargeT = 0;
            p.chargeHeld = false;
          }
        } else if (p.program === PROGRAM_ID.SWEEP) {
          // Sweep draws the giant broom while the button is held, then commits it. Like
          // Wedge's plow it auto-fires at full charge instead of asking for a release.
          if (canAct && heavyHeld) {
            p.laserChargeT += pdt;
            if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
              p.facing = Math.atan2(input.my, input.mx);
            }
            p.laserFacing = p.facing;
            this.placeBroom(p);
            if (p.laserChargeT >= SWEEP.powerChargeTime) this.fireBroomSweep(p);
          } else if (p.laserChargeT >= SWEEP.powerChargeTime) {
            // Released on the same tick the charge completed: commit it instead of
            // treating the release as a cancel.
            this.fireBroomSweep(p);
          } else {
            if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) this.useBug(p);
            p.laserChargeHeld = false;
            p.laserChargeT = 0;
            p.chargeT = 0;
            p.chargeHeld = false;
          }
        } else if (p.program === PROGRAM_ID.TOXIC) {
          // The gas cone auto-fires at full charge, like the other committed heavies.
          if (canAct && heavyHeld) {
            p.laserChargeT += pdt;
            if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
              p.facing = Math.atan2(input.my, input.mx);
            }
            p.laserFacing = p.facing;
            if (p.laserChargeT >= TOXIC.streamChargeTime) this.startToxicStream(p);
          } else if (p.laserChargeT >= TOXIC.streamChargeTime) {
            this.startToxicStream(p);
          } else {
            if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) this.useBug(p);
            p.laserChargeHeld = false;
            p.laserChargeT = 0;
            p.chargeT = 0;
            p.chargeHeld = false;
          }
        } else if (p.program === PROGRAM_ID.KABOOM) {
          // The charge builds the carpet, then commits it. Release at full charge still
          // fires, so the heavy never swallows a completed wind-up.
          if (canAct && heavyHeld) {
            p.laserChargeT += pdt;
            if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
              p.facing = Math.atan2(input.my, input.mx);
            }
            p.laserFacing = p.facing;
            if (p.laserChargeT >= KABOOM.clusterChargeTime) this.throwBombCluster(p);
          } else if (p.laserChargeT >= KABOOM.clusterChargeTime) {
            this.throwBombCluster(p);
          } else {
            if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) this.useBug(p);
            p.laserChargeHeld = false;
            p.laserChargeT = 0;
            p.chargeT = 0;
            p.chargeHeld = false;
          }
        } else if (p.program === PROGRAM_ID.GHOST) {
          // The scare arms itself at full charge, then waits for a melee press. The body
          // stays free to move and attack while it is armed; only the cloak timer runs.
          if (canAct && heavyHeld) {
            p.laserChargeT += pdt;
            p.laserFacing = p.facing;
            if (p.laserChargeT >= GHOST.scareChargeTime) this.startJumpScare(p);
          } else if (p.laserChargeT >= GHOST.scareChargeTime) {
            this.startJumpScare(p);
          } else {
            if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) this.useBug(p);
            p.laserChargeHeld = false;
            p.laserChargeT = 0;
            p.chargeT = 0;
            p.chargeHeld = false;
          }
        } else if (p.program === PROGRAM_ID.BUFFER) {
          // The dilation commits itself at full charge, like the other heavies.
          if (canAct && heavyHeld) {
            p.laserChargeT += pdt;
            if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
              p.facing = Math.atan2(input.my, input.mx);
            }
            p.laserFacing = p.facing;
            if (p.laserChargeT >= BUFFER.slowChargeTime) this.startTimeSlow(p);
          } else if (p.laserChargeT >= BUFFER.slowChargeTime) {
            this.startTimeSlow(p);
          } else {
            if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) this.useBug(p);
            p.laserChargeHeld = false;
            p.laserChargeT = 0;
            p.chargeT = 0;
            p.chargeHeld = false;
          }
        } else if (p.program === PROGRAM_ID.WEDGE) {
          // Wedge plants the red triangle, then commits to a straight plow. The charge
          // auto-fires; the player never has to guess the release window.
          if (canAct && heavyHeld) {
            p.laserChargeT += pdt;
            if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
              p.facing = Math.atan2(input.my, input.mx);
            }
            p.laserFacing = p.facing;
            if (p.laserChargeT >= WEDGE.chargeTime) this.fireWedgeCharge(p);
          } else {
            if (canAct && p.laserChargeT >= WEDGE.chargeTime) this.fireWedgeCharge(p);
            else if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) this.useBug(p);
            p.laserChargeHeld = false;
            p.laserChargeT = 0;
            p.chargeT = 0;
            p.chargeHeld = false;
          }
        } else if (canAct && heavyHeld) {
          p.laserChargeT += pdt;
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
        if (p.program === PROGRAM_ID.TOXIC) {
          // The jet is aimable while rooted. It turns faster than the heavy beam so a
          // water-like stream can be walked onto a moving body, but it is still limited
          // so a flick cannot wash the whole screen in venom.
          if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
            let delta = Math.atan2(input.my, input.mx) - p.facing;
            delta = Math.atan2(Math.sin(delta), Math.cos(delta));
            const maxTurn = TOXIC.streamTurnRate * dt;
            p.facing += Math.max(-maxTurn, Math.min(maxTurn, delta));
          }
          p.laserFacing = p.facing;
          p.laserTickT -= pdt;
          if (p.laserTickT <= 0) {
            p.laserTickT += TOXIC.streamTick;
            this.applyToxicStream(p);
          }
        } else if (overcharged) {
          // The overcharge beam is an instant-on weak attack: facing follows the stick
          // directly, and the beam can be switched off on the next frame.
          p.laserFacing = p.facing;
        } else if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
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
          // A tap is offense; the shield arms only after a short hold. This keeps the
          // combo from getting a free 1 s guard every time it swings.
          this.handleDeflectPress(p);
        }
        if (heldSwing) {
          p.chargeT += dt;
          if (p.guardT <= 0 && p.guardCd <= 0 && p.chargeT >= PLAYER.guardStartDelay) {
            p.guardT = PLAYER.guardDuration;
          }
          if (p.guardT > 0) {
            p.guardT = Math.max(0, p.guardT - dt);
            if (p.guardT === 0) p.guardCd = PLAYER.guardCooldown;
          }
        } else {
          if (p.guardT > 0) {
            p.guardT = 0;
            p.guardCd = Math.max(p.guardCd, PLAYER.guardReleaseCooldown);
          }
          p.chargeT = 0;
        }
        p.chargeHeld = heldSwing;
        const heldDash = (input.held & ACTION.DASH) !== 0;
        if (input.pressed & ACTION.DASH) {
          p.dashChargeT = 0;
          this.tryDash(p);
        }
        if (heldDash) p.dashChargeT += pdt;
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
        if (input.pressed & ACTION.BOLT) {
          if (overcharged) this.startOverchargeBeam(p);
          else this.tryShoot(p);
        }
        if (input.pressed & ACTION.CANDLE) {
          if (
            p.laserCd <= 0 &&
            p.orbitT <= 0 &&
            p.energy >= this.heavyCost(p) &&
            p.swingPhase === 0 &&
            p.dashT <= 0 &&
            p.wedgeT <= 0 &&
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

      // Overcharge: holding weak attack keeps the beam alive; releasing it stops on the
      // next tick. The normal charged beam still owns `laserT` outside this powerup.
      if (overcharged && !p.laserChargeHeld && p.wedgeT <= 0) {
        if (canAct && input && (input.held & ACTION.BOLT) !== 0 && p.swingPhase === 0 && p.dashT <= 0) {
          if (p.laserT <= 0) this.emit(EV.LASER, p.slot, p.x, p.y, p.facing);
          p.laserT = Math.max(p.laserT, 0.06);
          p.laserFacing = p.facing;
        } else if (p.laserT > 0) {
          p.laserT = 0;
          p.laserTickT = 0;
        }
      }

      const autoFireKind = p.powerupT > 0 ? p.powerupKind : -1;
      const heavyLock =
        p.wedgeT > 0 ||
        p.broT > 0 ||
        (p.laserChargeHeld && (p.program === PROGRAM_ID.WEDGE || p.program === PROGRAM_ID.SWEEP));
      if (
        canAct &&
        input &&
        (input.held & ACTION.BOLT) !== 0 &&
        (autoFireKind === -1 || autoFireKind === POWERUP_KIND.MACHINE_GUN) &&
        !heavyLock &&
        p.swingPhase === 0 &&
        p.dashT <= 0
      ) {
        if (p.autoFireT <= 0) this.tryShoot(p);
      }

      // Held guard covers the entire forward 180 degrees and reflects every shot.
      if (p.guardT > 0) this.resolveGuard(p);

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
        this.solids,
        this.arena.bounds,
        this.openWalls,
      );
      if (this.openWalls || this.arena.voids) {
        this.checkFall(p);
        if (!p.alive) continue;
      }
      this.resolveBarrier(p);
      this.resolveNets(p);
      if (p.dashT > 0 && p.dashKind === 1) this.resolveChargeDash(p);
      if (p.wedgeT > 0) this.resolveWedgeCharge(p);
      if (p.broT > 0) this.tickBroomSweep(p, dt);
      if (p.fanT > 0) this.tickFan(p, dt);
      if (p.bashT > 0) this.resolveBracket(p);
      // Atomize's shield balls keep orbiting while the body moves, attacks or rides.
      if (p.atomBalls > 0) this.tickAtomBalls(p, pdt);
      this.checkTravel(p, canAct, dt);
    }

    // The orbit field moves bodies and captured shots before projectile and threat AI
    // run, so a captured body never gets a second move (or a shot) on the same tick.
    this.tickOrbit(dt);
    this.updateProps(dt);

    if (this.mode === 'training' || this.mode === 'gauntlet') this.updatePickups(dt);
    // Threats are the other half of the dilation: the whole hostile simulation slows.
    const threatDt = this.timeSlowT > 0 ? dt * BUFFER.slowScale : dt;
    this.updateDrone(threatDt);
    this.updateNets(dt);
    this.updateLures(dt);
    this.updateBarriers(dt);
    // The calibration prologue runs before the normal gauntlet threat loop. Its
    // shapes and their shards/echoes live in the sentry pool, but use their own
    // movement and attack timers until the drill starts.
    if (this.campaign && this.campaignPhase === 'calibration') this.updateTrainingShapes(threatDt);
    this.updateProjectiles(dt);
    // Campaign threats stay parked until the breach warning hands the room over.
    if (this.mode === 'gauntlet' && (!this.campaign || this.campaignPhase === 'assault')) {
      this.updateGauntlet(threatDt);
    }

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

  /** One tick of a ride. Lift bodies are already on the far plate; pads swap at half. */
  private tickTravel(p: Player, dt: number): void {
    p.iframes = Math.max(p.iframes, 0.05);
    p.vx = 0;
    p.vy = 0;
    p.kx = 0;
    p.ky = 0;
    p.travelT = Math.max(0, p.travelT - dt);
    // The pad unloads the avatar in layers at the source, then reloads it at the mate.
    // The swap lands exactly where the unload finishes, so no frame shows a pop.
    if (p.travelKind === TRAVEL.pad && !p.travelSwap && p.travelT <= p.travelDur * 0.5) {
      p.travelSwap = true;
      p.x = p.travelToX;
      p.y = p.travelToY;
      p.prevX = p.x;
      p.prevY = p.y;
    }
    if (p.travelT > 0) return;
    p.travelKind = TRAVEL.none;
    p.travelDur = 0;
    p.travelSwap = false;
    p.travelLatch = true;
    p.travelCd = TRAVERSE.cooldown;
    p.iframes = Math.max(p.iframes, 0.25);
  }

  /**
   * Pads and lifts arm on a standing body, not on touch. A moving player crosses a plate
   * without noticing; a waiting one sees the progress ring fill. An arrival plate stays
   * latched until the body steps off, so the return trip is always a choice.
   */
  private checkTravel(p: Player, canAct: boolean, dt: number): void {
    const tr = this.arena.traverse;
    if (!tr || !canAct) {
      p.travelDwell = 0;
      p.travelKind = TRAVEL.none;
      return;
    }

    let pad = -1;
    let lift = -1;
    for (let i = 0; i < tr.pads.length; i++) {
      const dx = p.x - tr.pads[i].x;
      const dy = p.y - tr.pads[i].y;
      if (dx * dx + dy * dy <= tr.pads[i].radius * tr.pads[i].radius) {
        pad = i;
        break;
      }
    }
    if (pad < 0) {
      for (let i = 0; i < tr.lifts.length; i++) {
        const dx = p.x - tr.lifts[i].x;
        const dy = p.y - tr.lifts[i].y;
        if (dx * dx + dy * dy <= tr.lifts[i].radius * tr.lifts[i].radius) {
          lift = i;
          break;
        }
      }
    }
    if (pad < 0 && lift < 0) {
      p.travelDwell = 0;
      p.travelKind = TRAVEL.none;
      p.travelLatch = false;
      return;
    }
    if (p.travelLatch || p.travelCd > 0) {
      p.travelDwell = 0;
      return;
    }

    const busy =
      p.swingPhase !== 0 ||
      p.dashT > 0 ||
      p.wedgeT > 0 ||
      p.bashT > 0 ||
      p.waveT > 0 ||
      p.laserT > 0 ||
      p.laserChargeHeld ||
      p.netDrawing;
    if (busy || p.vx * p.vx + p.vy * p.vy > TRAVERSE.dwellSpeed * TRAVERSE.dwellSpeed) {
      p.travelDwell = 0;
      return;
    }

    let toX = p.x;
    let toY = p.y;
    let ride = 0;
    let kind: number = TRAVEL.none;
    if (pad >= 0) {
      let mate = -1;
      for (let i = 0; i < tr.pads.length; i++) {
        if (i !== pad && tr.pads[i].pair === tr.pads[pad].pair) {
          mate = i;
          break;
        }
      }
      if (mate < 0) return;
      toX = tr.pads[mate].x;
      toY = tr.pads[mate].y;
      ride = TRAVERSE.padRide;
      kind = TRAVEL.pad;
    } else {
      const dest = tr.lifts[tr.lifts[lift].link];
      if (!dest) return;
      toX = dest.x;
      toY = dest.y;
      ride = TRAVERSE.liftRide;
      kind = TRAVEL.lift;
    }

    p.travelKind = kind;
    p.travelDwell += dt;
    const needed = kind === TRAVEL.lift ? TRAVERSE.liftDwell : TRAVERSE.padDwell;
    if (p.travelDwell < needed) return;

    // Commit. The body crosses immediately; the renderer's transition covers the cut.
    p.travelDwell = 0;
    p.travelT = ride;
    p.travelDur = ride;
    p.travelLatch = true;
    p.travelToX = toX;
    p.travelToY = toY;
    p.travelSwap = false;
    if (kind === TRAVEL.lift) {
      p.x = toX;
      p.y = toY;
      p.prevX = toX;
      p.prevY = toY;
    } else {
      // Pads keep the body at the source while it unloads; tickTravel swaps at half.
      p.prevX = p.x;
      p.prevY = p.y;
    }
    p.vx = 0;
    p.vy = 0;
    p.kx = 0;
    p.ky = 0;
    p.iframes = Math.max(p.iframes, ride + 0.25);
    p.swingPhase = 0;
    p.swingT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    p.dashChargeHeld = false;
    p.dashT = 0;
    p.wedgeT = 0;
    p.bashT = 0;
    p.laserT = 0;
    p.laserChargeT = 0;
    p.laserChargeHeld = false;
    p.guardT = 0;
    p.waveT = 0;
    p.netDrawing = false;
    p.moveDirX = Math.cos(p.facing);
    p.moveDirY = Math.sin(p.facing);
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
    if (p.dashT > 0 || p.dashCharges <= 0 || p.swingPhase !== 0) return;
    const dir = Math.atan2(p.moveDirY, p.moveDirX);
    const overcharged = p.powerupKind === POWERUP_KIND.OVERCHARGE && p.powerupT > 0;
    p.dashT = PLAYER.dashTime * (overcharged ? 3 : 1);
    if (p.dashCd <= 0) p.dashCd = PLAYER.dashCooldown;
    p.dashCharges--;
    p.dashKind = 0;
    p.dashDirX = Math.cos(dir);
    p.dashDirY = Math.sin(dir);
    p.iframes = Math.max(p.iframes, PLAYER.dashIframes);
    if (p.program === PROGRAM_ID.WEDGE) {
      // The bracket is both shield and shove: it snaps open in front, then the
      // recoil kicks Wedge the other way instead of letting him drift.
      this.startBracket(p, dir);
      p.kx -= p.dashDirX * WEDGE.bashRecoil;
      p.ky -= p.dashDirY * WEDGE.bashRecoil;
    }
    this.emit(EV.DASH, p.slot, p.x, p.y, dir);
  }

  private tryChargeDash(p: Player): void {
    if (p.chargeDashCd > 0 || p.dashT > 0 || p.swingPhase !== 0 || p.dashCharges <= 0) return;
    const dir = Math.atan2(p.moveDirY, p.moveDirX);
    p.dashT = PLAYER.chargeDashTime;
    if (p.dashCd <= 0) p.dashCd = PLAYER.dashCooldown;
    p.dashCharges--;
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
    // An armed jump-scare turns the next melee press into the AOE burst instead of a lash.
    if (p.scareT > 0 && this.fireJumpScare(p)) return;
    p.ghostT = 0;
    if (p.program === PROGRAM_ID.SWEEP) {
      // Three-hit broom combo: a diagonal push from each side, then the big forward
      // sweep that ends the chain. The shield stays the separate hold action.
      let kind = 1;
      let dir = 1;
      if (p.comboT > 0 && p.comboStage === 1) {
        kind = 2;
        dir = -1;
      } else if (p.comboT > 0 && p.comboStage === 2) {
        kind = 3;
        dir = 0;
      }
      if (!this.trySwing(p, dir, kind)) return;
      p.comboStage = kind;
      p.comboT = SWEEP.comboWindow;
      return;
    }
    // Every quick press is a lash: left, right, left, right. The shield is the
    // hold, never a third tap, so the two actions stay readable.
    const dir = p.comboStage === 1 && p.comboT > 0 ? -1 : 1;
    if (!this.trySwing(p, dir)) return;
    p.comboStage = dir === -1 ? 2 : 1;
    p.comboT = PLAYER.comboWindow;
  }

  private trySwing(p: Player, dir: number, kind = 0): boolean {
    if (p.swingPhase !== 0 || p.dashT > 0 || p.waveT > 0) return false;
    p.swingPhase = 1;
    p.swingT = PLAYER.swingStartup;
    p.swingPct = 1;
    p.swingHit = false;
    p.swingFacing = p.facing;
    p.swingDir = dir;
    p.swingKind = kind;
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

    const whip = p.powerupT > 0 && p.powerupKind === POWERUP_KIND.WHIP;
    const whipMult = whip ? POWERUP.whipMultiplier : 1;
    const range = PLAYER.waveRange * whipMult;
    const halfWidth = PLAYER.waveHalfWidth;
    const waveDamage = PLAYER.waveDamage * whipMult;
    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.iframes > 0) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const forward = dx * dirX + dy * dirY;
      const lateral = Math.abs(dx * dirY - dy * dirX);
      if (forward < 0 || forward > range + PLAYER.radius || lateral > halfWidth + PLAYER.radius) continue;
      if (this.lineBlocked(p.x, p.y, target.x, target.y)) continue;
      this.damagePlayer(target, waveDamage, p.slot, dirX, dirY, PLAYER.waveKnockback);
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
        this.damageDrone(waveDamage, p.slot);
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
        this.damageWorm(w, waveDamage, p.slot, dirX, dirY, PLAYER.waveKnockback);
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
        this.damageVirus(v, waveDamage, p.slot, dirX, dirY, PLAYER.waveKnockback);
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
        this.damageSentry(s, waveDamage, p.slot, dirX, dirY, PLAYER.waveKnockback);
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
        this.damageError(e, waveDamage, p.slot, dirX, dirY);
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
      proj.homing = false;
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

  /** Overcharge weak attack: no charge, no cooldown, no root. */
  private startOverchargeBeam(p: Player): void {
    p.ghostT = 0;
    p.laserT = 0.06;
    p.laserTickT = PLAYER.laserTick;
    p.laserFacing = p.facing;
    p.chargeT = 0;
    p.chargeHeld = false;
    this.emit(EV.LASER, p.slot, p.x, p.y, p.laserFacing);
    this.applyLaserDamage(p);
  }

  /** Commits the charged beam. The player is rooted for the full firing window. */
  private fireLaser(p: Player): void {
    p.ghostT = 0;
    // Atomize's heavy is a field, not a beam. It pays its own cost and never roots.
    if (p.program === PROGRAM_ID.ATOMIZE) {
      this.startOrbitPower(p);
      return;
    }
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

  /** Distance the beam travels before a solid surface ends it. */
  private laserReach(p: Player): number {
    return beamReach(
      this.arena,
      this.barriers,
      this.pusherActive,
      this.pusherY,
      p.x,
      p.y,
      Math.cos(p.laserFacing),
      Math.sin(p.laserFacing),
      PLAYER.laserRange,
    );
  }

  /**
   * A raised guard catches the heavy beam and glances it away. The reflected shaft leaves
   * at `PLAYER.laserReflectAngle` off the incoming line (30-45 degrees), so it never goes
   * back to the caster but can still cut a body standing beside or behind the guard. The
   * catch ends a charged heavy into its cooldown; the caster is untouched.
   */
  private reflectLaser(p: Player, reach: number): number {
    const dirX = Math.cos(p.laserFacing);
    const dirY = Math.sin(p.laserFacing);
    for (let i = 0; i < this.players.length; i++) {
      const guard = this.players[i];
      if (guard === p || !guard.active || !guard.alive || guard.guardT <= 0) continue;
      const gx = guard.x - p.x;
      const gy = guard.y - p.y;
      const forward = gx * dirX + gy * dirY;
      if (forward <= 0 || forward >= reach) continue;
      // The shaft is thick, so a guard a little off the centre line still catches it.
      if (Math.abs(gy * dirX - gx * dirY) > PLAYER.laserHalfWidth + PLAYER.radius) continue;
      // The shield covers the front half-plane: the guard has to be facing the caster.
      if (-(dirX * Math.cos(guard.facing) + dirY * Math.sin(guard.facing)) <= 0.05) continue;
      if (this.lineBlocked(p.x, p.y, guard.x, guard.y)) continue;

      // Glance, not return: rotate the incoming line by the shield angle, toward the side
      // the guard was standing on. The caster sits ~145 degrees off this line, so the
      // deflected shaft can never hit its owner.
      const lateral = gy * dirX - gx * dirY;
      const side = lateral < -0.001 ? -1 : 1;
      const out = p.laserFacing + side * PLAYER.laserReflectAngle;
      const rx = Math.cos(out);
      const ry = Math.sin(out);
      const reflectReach = beamReach(
        this.arena,
        this.barriers,
        this.pusherActive,
        this.pusherY,
        guard.x,
        guard.y,
        rx,
        ry,
        PLAYER.laserReflectRange,
      );

      guard.beamReflectT = PLAYER.laserReflectFlash;
      guard.beamReflectFacing = out;
      guard.beamReflectDist = reflectReach;
      this.emit(EV.DEFLECT, guard.slot, guard.x, guard.y, 1, rx, ry);

      // One pass of the deflected shaft, skipping both the guard and the caster.
      this.damageBeamLine(guard.slot, guard.x, guard.y, rx, ry, reflectReach, guard.slot, p.slot);

      // A charged heavy is cut short and goes on its full cooldown. An overcharge tick
      // beam is only 0.06 s, so it is already spent.
      if (p.laserT > 0.5) {
        p.laserT = 0;
        p.laserTickT = 0;
        p.laserCd = PLAYER.laserCooldown;
      }
      return forward;
    }
    return reach;
  }

  /** Beam hit test: inside the narrow corridor, in front, and short of the solid end. */
  private beamLineHits(
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    reach: number,
    x: number,
    y: number,
    radius: number,
  ): boolean {
    const px = x - ox;
    const py = y - oy;
    const forward = px * dx + py * dy;
    if (forward < 0 || forward > reach) return false;
    const lateral = Math.abs(py * dx - px * dy);
    if (lateral > PLAYER.laserHalfWidth + radius) return false;
    return !this.lineBlocked(ox, oy, x, y);
  }

  /**
   * One pass of a beam line. Every body in the corridor takes a tick or, for a reflected
   * shaft, the single hit of the glance. `skipA`/`skipB` are slot indices to leave alone
   * (slots are array indices), used to keep a reflection off its guard and its caster.
   */
  private damageBeamLine(
    ownerSlot: number,
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    reach: number,
    skipA: number,
    skipB: number,
    damage: number = PLAYER.laserDamage,
    force: number = PLAYER.laserKnockback,
  ): void {
    for (let i = 0; i < this.players.length; i++) {
      if (i === skipA || i === skipB) continue;
      const target = this.players[i];
      if (!target.active || !target.alive || target.iframes > 0 || phased(target)) continue;
      if (!this.beamLineHits(ox, oy, dx, dy, reach, target.x, target.y, PLAYER.radius)) continue;
      this.damagePlayer(target, damage, ownerSlot, dx, dy, force);
    }

    if (this.mode === 'training' && this.drone.active && this.beamLineHits(ox, oy, dx, dy, reach, this.drone.x, this.drone.y, this.drone.radius)) {
      this.damageDrone(damage, ownerSlot);
    }

    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      // The whole chain is a target. Checking only the head made beams that crossed a
      // worm's body look like they passed through without damage.
      let hit = this.beamLineHits(ox, oy, dx, dy, reach, w.x, w.y, WORM.headRadius);
      if (!hit) {
        for (let s = 0; s < w.segCount; s++) {
          if (this.beamLineHits(ox, oy, dx, dy, reach, w.segX[s], w.segY[s], WORM.segmentRadius)) {
            hit = true;
            break;
          }
        }
      }
      if (!hit) continue;
      this.damageWorm(w, damage, ownerSlot, dx, dy);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || !this.beamLineHits(ox, oy, dx, dy, reach, v.x, v.y, v.radius)) continue;
      this.damageVirus(v, damage, ownerSlot, dx, dy, force * 0.4);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active || !this.beamLineHits(ox, oy, dx, dy, reach, s.x, s.y, s.radius)) continue;
      this.damageSentry(s, damage, ownerSlot, dx, dy, force);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active || !this.beamLineHits(ox, oy, dx, dy, reach, e.x, e.y, CASCADING_ERROR.blockSize * 0.5)) continue;
      this.damageError(e, damage, ownerSlot, dx, dy);
    }
  }

  /** Every hostile in the line takes a tick. The beam deliberately does not stop at the first. */
  private applyLaserDamage(p: Player): void {
    const dirX = Math.cos(p.laserFacing);
    const dirY = Math.sin(p.laserFacing);
    const solidReach = this.laserReach(p);
    const reach = this.reflectLaser(p, solidReach);
    // A guard caught the beam: its line ends there and the deflected shaft was already
    // resolved by the reflection.
    if (reach < solidReach) return;
    this.damageBeamLine(p.slot, p.x, p.y, dirX, dirY, reach, p.slot, -1);
  }

  /**
   * Arena emitters run on one shared clock. Each one gathers, flashes its beam for a
   * fraction of a second, then rests. `offset` makes a pair alternate instead of firing
   * together, so a boss lane is a rhythm rather than a wall of light. Hosted matches
   * never arm them: the snapshot carries no emitter state.
   */
  private updateEmitters(dt: number): void {
    if (this.mode === 'match') return;
    this.emitterT += dt;
    const gather = EMITTER.gather;
    const live = gather + EMITTER.duration;
    for (let i = 0; i < this.emitters.length; i++) {
      const e = this.emitters[i];
      let cycle = (this.emitterT + e.offset * EMITTER.period) % EMITTER.period;
      if (cycle < 0) cycle += EMITTER.period;
      if (cycle < gather) {
        // The gather is a visible promise: the dots converge for the whole window so
        // both the lens and the firing direction are readable before the flash.
        e.phase = 1;
        e.charge = cycle / gather;
      } else if (cycle < live) {
        if (e.phase !== 2) this.fireEmitter(e);
        // A deployed wall or a moving compactor can enter the lane during the flash.
        // Keep the drawn shaft and the damage line on the current surface.
        else if (!e.caught) e.beamDist = this.emitterReach(e);
        e.phase = 2;
        e.charge = 1;
        if (!e.spent) this.resolveEmitterBeam(e);
      } else {
        e.phase = 0;
        e.charge = 0;
        e.caught = false;
        e.spent = false;
        e.beamDist = 0;
        e.hitPlayers = 0;
      }
    }
  }

  /** Surface distance from one emitter lens, shared by the fire and live-refresh paths. */
  private emitterReach(e: LaserEmitter): number {
    return beamReach(
      this.arena,
      this.barriers,
      this.pusherActive,
      this.pusherY,
      e.x,
      e.y,
      Math.cos(e.angle),
      Math.sin(e.angle),
      EMITTER.range,
    );
  }

  /** Snapshot the surface distance on the frame the beam goes live. */
  private fireEmitter(e: LaserEmitter): void {
    e.phase = 2;
    e.charge = 1;
    e.caught = false;
    e.spent = false;
    e.hitPlayers = 0;
    e.beamDist = this.emitterReach(e);
  }

  /**
   * One live pass. A raised guard in the corridor catches the shaft and returns it along
   * its own facing, so target lock can send the reflected beam at an enemy. The guard is
   * skipped by its own return, exactly like a player-heavy reflection.
   */
  private resolveEmitterBeam(e: LaserEmitter): void {
    const ax = Math.cos(e.angle);
    const ay = Math.sin(e.angle);
    let guard: Player | null = null;
    let guardDist = Infinity;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.guardT <= 0 || p.iframes > 0 || p.travelT > 0 || phased(p)) continue;
      const gx = p.x - e.x;
      const gy = p.y - e.y;
      const forward = gx * ax + gy * ay;
      if (forward <= 0 || forward >= e.beamDist) continue;
      if (Math.abs(gy * ax - gx * ay) > EMITTER.halfWidth + PLAYER.radius) continue;
      // The shield covers the front half-plane, so the guard has to face the lens.
      if (-(ax * Math.cos(p.facing) + ay * Math.sin(p.facing)) <= 0.05) continue;
      if (this.lineBlocked(e.x, e.y, p.x, p.y)) continue;
      if (forward < guardDist) {
        guard = p;
        guardDist = forward;
      }
    }

    if (guard) {
      // Bodies between the lens and the shield still eat the direct pass. The guard is
      // skipped: the catch is the shield, not a hit that happens to land on its frame.
      this.damageEmitterLine(e, ax, ay, guardDist, guard.slot);
      e.caught = true;
      e.spent = true;
      e.beamDist = guardDist;

      // Lock holds `facing` on the enemy, so a locked guard returns the shaft straight at
      // it. Without a lock this is the shield's own facing: back down the beam.
      const out = guard.facing;
      const rx = Math.cos(out);
      const ry = Math.sin(out);
      const reflectReach = beamReach(
        this.arena,
        this.barriers,
        this.pusherActive,
        this.pusherY,
        guard.x,
        guard.y,
        rx,
        ry,
        EMITTER.reflectRange,
      );
      guard.beamReflectT = PLAYER.laserReflectFlash;
      guard.beamReflectFacing = out;
      guard.beamReflectDist = reflectReach;
      this.emit(EV.DEFLECT, guard.slot, guard.x, guard.y, 2, rx, ry);
      this.damageBeamLine(
        guard.slot,
        guard.x,
        guard.y,
        rx,
        ry,
        reflectReach,
        guard.slot,
        -1,
        EMITTER.reflectDamage,
        EMITTER.reflectKnockback,
      );
      return;
    }

    this.damageEmitterLine(e, ax, ay, e.beamDist);
  }

  /** Every player in the emitter corridor, once per pass. Cover cuts the line. */
  private damageEmitterLine(e: LaserEmitter, ax: number, ay: number, reach: number, skipSlot = -1): void {
    for (let i = 0; i < this.players.length; i++) {
      if (i === skipSlot) continue;
      const p = this.players[i];
      if (!p.active || !p.alive || p.iframes > 0 || p.travelT > 0 || phased(p)) continue;
      const bit = 1 << p.slot;
      if ((e.hitPlayers & bit) !== 0) continue;
      const px = p.x - e.x;
      const py = p.y - e.y;
      const forward = px * ax + py * ay;
      if (forward < 0 || forward > reach) continue;
      if (Math.abs(py * ax - px * ay) > EMITTER.halfWidth + PLAYER.radius) continue;
      if (this.lineBlocked(e.x, e.y, p.x, p.y)) continue;
      e.hitPlayers |= bit;
      this.damagePlayer(p, EMITTER.damage, -1, ax, ay, EMITTER.knockback, SRC.EMITTER);
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
    let valid = this.lockTargetPos(p);
    if (valid) {
      tx = this.lockTX;
      ty = this.lockTY;
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
      for (let i = 0; i < this.sentries.length; i++) {
        const target = this.sentries[i];
        if (!target.active) continue;
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= best || this.lineBlocked(p.x, p.y, target.x, target.y)) continue;
        best = d2;
        p.lockKind = 5;
        p.lockId = i;
        tx = target.x;
        ty = target.y;
      }
      for (let i = 0; i < this.errors.length; i++) {
        const target = this.errors[i];
        if (!target.active) continue;
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= best || this.lineBlocked(p.x, p.y, target.x, target.y)) continue;
        best = d2;
        p.lockKind = 6;
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
      if (p.lockKind !== 0) valid = true;
    }
    // Right bumper / right stick steps around the available ring of targets. The
    // newest target is used immediately instead of restarting the acquisition delay.
    if (valid && p.lockKind !== 0) {
      const pressed = input ? input.pressed : 0;
      const next = (pressed & ACTION.LOCK_NEXT) !== 0;
      const prev = (pressed & ACTION.LOCK_PREV) !== 0;
      if (next !== prev) {
        this.cycleLock(p, next, tx, ty);
        if (this.lockTargetPos(p)) {
          tx = this.lockTX;
          ty = this.lockTY;
        }
      }
    }

    p.lockActive = p.lockKind !== 0 && p.lockT >= PLAYER.lockAcquire;
    if (p.lockActive) {
      p.lockFacing = Math.atan2(ty - p.y, tx - p.x);
      p.facing = p.lockFacing;
    }
  }

  /**
   * Local input assist reads the current lock target into this reusable point. It is
   * not simulation state: nothing here enters a snapshot, and the input layer owns the
   * actual lock bit. Returns false if the target is gone.
   */
  readonly assistTarget = { x: 0, y: 0 };
  readLockTarget(p: Player): boolean {
    if (!this.lockTargetPos(p)) return false;
    this.assistTarget.x = this.lockTX;
    this.assistTarget.y = this.lockTY;
    return true;
  }

  /** Reads the current lock target into lockTX/lockTY. Returns false if it is gone. */
  private lockTargetPos(p: Player): boolean {
    if (p.lockKind === 1) {
      const target = this.players[p.lockId];
      if (target && target.active && target.alive) {
        this.lockTX = target.x;
        this.lockTY = target.y;
        return true;
      }
    } else if (p.lockKind === 2) {
      const target = this.worms[p.lockId];
      if (target && target.active) {
        this.lockTX = target.x;
        this.lockTY = target.y;
        return true;
      }
    } else if (p.lockKind === 3) {
      const target = this.viruses[p.lockId];
      if (target && target.active) {
        this.lockTX = target.x;
        this.lockTY = target.y;
        return true;
      }
    } else if (p.lockKind === 4) {
      if (this.drone.active) {
        this.lockTX = this.drone.x;
        this.lockTY = this.drone.y;
        return true;
      }
    } else if (p.lockKind === 5) {
      const target = this.sentries[p.lockId];
      if (target && target.active) {
        this.lockTX = target.x;
        this.lockTY = target.y;
        return true;
      }
    } else if (p.lockKind === 6) {
      const target = this.errors[p.lockId];
      if (target && target.active) {
        this.lockTX = target.x;
        this.lockTY = target.y;
        return true;
      }
    }
    return false;
  }

  /**
   * Steps the held lock to the next or previous valid target in angular order around
   * the player. Range and line of sight use the same rules as acquisition, and the
   * current target is skipped so one press always moves.
   */
  private cycleLock(p: Player, forward: boolean, fromX: number, fromY: number): void {
    this.cyclePlayer = p;
    this.cycleForward = forward;
    this.cycleBase = Math.atan2(fromY - p.y, fromX - p.x);
    this.cycleFound = false;
    this.cycleBestDelta = 0;
    this.cycleBestKind = 0;
    this.cycleBestId = -1;
    this.cycleWrapDelta = forward ? -Math.PI - 1 : Math.PI + 1;
    this.cycleWrapKind = 0;
    this.cycleWrapId = -1;

    for (let i = 0; i < this.players.length; i++) {
      const t = this.players[i];
      if (t === p || !t.active || !t.alive) continue;
      this.offerCycle(1, i, t.x, t.y);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const t = this.worms[i];
      if (t.active) this.offerCycle(2, i, t.x, t.y);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const t = this.viruses[i];
      if (t.active) this.offerCycle(3, i, t.x, t.y);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const t = this.sentries[i];
      if (t.active) this.offerCycle(5, i, t.x, t.y);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const t = this.errors[i];
      if (t.active) this.offerCycle(6, i, t.x, t.y);
    }
    if (this.mode === 'training' && this.drone.active) this.offerCycle(4, 0, this.drone.x, this.drone.y);

    const kind = this.cycleFound ? this.cycleBestKind : this.cycleWrapKind;
    const id = this.cycleFound ? this.cycleBestId : this.cycleWrapId;
    this.cyclePlayer = null;
    if (kind === 0) return;
    p.lockKind = kind;
    p.lockId = id;
  }

  private offerCycle(kind: number, id: number, x: number, y: number): void {
    const p = this.cyclePlayer;
    if (!p) return;
    if (kind === p.lockKind && id === p.lockId) return;
    const dx = x - p.x;
    const dy = y - p.y;
    const maxD2 = PLAYER.lockRange * PLAYER.lockRange;
    if (dx * dx + dy * dy > maxD2) return;
    if (this.lineBlocked(p.x, p.y, x, y)) return;
    let delta = Math.atan2(dy, dx) - this.cycleBase;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta <= -Math.PI) delta += Math.PI * 2;

    if (this.cycleForward) {
      if (delta > 0.0005) {
        if (!this.cycleFound || delta < this.cycleBestDelta) {
          this.cycleFound = true;
          this.cycleBestDelta = delta;
          this.cycleBestKind = kind;
          this.cycleBestId = id;
        }
      } else if (delta > this.cycleWrapDelta) {
        // Nothing ahead: wrap to the closest target behind, so one press still moves.
        this.cycleWrapDelta = delta;
        this.cycleWrapKind = kind;
        this.cycleWrapId = id;
      }
    } else if (delta < -0.0005) {
      if (!this.cycleFound || delta > this.cycleBestDelta) {
        this.cycleFound = true;
        this.cycleBestDelta = delta;
        this.cycleBestKind = kind;
        this.cycleBestId = id;
      }
    } else if (delta < this.cycleWrapDelta) {
      this.cycleWrapDelta = delta;
      this.cycleWrapKind = kind;
      this.cycleWrapId = id;
    }
  }

  private tryShoot(p: Player): void {
    if (p.swingPhase !== 0 || p.dashT > 0) return;
    p.ghostT = 0;
    const kind = p.powerupT > 0 ? p.powerupKind : -1;

    if (kind === POWERUP_KIND.MACHINE_GUN) {
      if (p.autoFireT > 0 || p.energy < POWERUP.machineCost) return;
      const spread = this.rng.range(-POWERUP.machineSpread, POWERUP.machineSpread);
      if (!this.spawnProjectile(p, spread, POWERUP.machineTtl, BOLT.speed, false, POWERUP.machineRadius)) return;
      p.energy -= POWERUP.machineCost;
      p.autoFireT = POWERUP.machineInterval;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (kind === POWERUP_KIND.SHOTGUN) {
      if (p.burstCd > 0 || p.energy < POWERUP.shotgunCost) return;
      let fired = 0;
      const half = (POWERUP.shotgunPellets - 1) * 0.5;
      for (let i = 0; i < POWERUP.shotgunPellets; i++) {
        const offset = (i - half) * POWERUP.shotgunSpread;
        if (this.spawnProjectile(p, offset, POWERUP.shotgunTtl, BOLT.speed * 1.12)) fired++;
      }
      if (fired === 0) return;
      p.energy -= POWERUP.shotgunCost;
      p.burstCd = POWERUP.shotgunCooldown;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (kind === POWERUP_KIND.PATHFIND) {
      if (p.energy < POWERUP.pathCost) return;
      if (!this.spawnProjectile(p, 0, POWERUP.pathTtl, BOLT.speed, true, POWERUP.pathRadius)) return;
      p.energy -= POWERUP.pathCost;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (p.program === PROGRAM_ID.WEDGE) {
      // Three quick bracket shards in a string. The string owns its cadence; holding
      // the button starts a new string only after the old one has finished.
      if (p.stringLeft > 0 || p.burstCd > 0) return;
      if (p.energy < WEDGE.shotCost) return;
      p.stringLeft = WEDGE.shotCount;
      p.stringT = 0;
      this.fireWedgeStringShot(p);
      return;
    }

    if (p.program === PROGRAM_ID.SWEEP) {
      // One broom per throw, slower than a bolt stream, and it shoves hard on contact.
      if (p.autoFireT > 0 || p.energy < SWEEP.shotCost) return;
      if (!this.spawnProjectile(
        p,
        0,
        SWEEP.shotTtl,
        SWEEP.shotSpeed,
        false,
        SWEEP.shotRadius,
        SWEEP.shotDamage,
        6,
      )) return;
      p.energy -= SWEEP.shotCost;
      p.autoFireT = SWEEP.attackCooldown;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (p.program === PROGRAM_ID.KABOOM) {
      // One slow shell per throw. No stream: the blast is the payoff, so a miss costs
      // the whole beat instead of one shard from a burst.
      if (p.autoFireT > 0 || p.energy < KABOOM.bombCost) return;
      if (!this.spawnProjectile(
        p,
        0,
        KABOOM.bombTtl,
        KABOOM.bombSpeed,
        false,
        KABOOM.bombRadius,
        KABOOM.bombDamage,
        8,
        KABOOM.bombBlast,
        KABOOM.bombKnockback,
      )) return;
      p.energy -= KABOOM.bombCost;
      p.autoFireT = KABOOM.attackCooldown;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (p.program === PROGRAM_ID.BUFFER) {
      // One heavy hourglass per throw. It is slow and wide, and it passes through a
      // short chain of bodies instead of stopping on the first one.
      if (p.autoFireT > 0 || p.energy < BUFFER.shotCost) return;
      if (!this.spawnProjectile(
        p,
        0,
        BUFFER.shotTtl,
        BUFFER.shotSpeed,
        false,
        BUFFER.shotRadius,
        BUFFER.shotDamage,
        10,
      )) return;
      p.energy -= BUFFER.shotCost;
      p.autoFireT = BUFFER.attackCooldown;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (p.program === PROGRAM_ID.ATOMIZE) {
      // Alternating hands, one light electron per throw. It leaves inward across the
      // body, then the seek turns it back toward a target: the white trail draws the arc.
      if (p.autoFireT > 0 || p.energy < ATOMIZE.shotCost) return;
      const side = p.atomSide;
      p.atomSide = -side;
      if (!this.spawnProjectile(
        p,
        -side * ATOMIZE.shotArcAngle,
        ATOMIZE.shotTtl,
        ATOMIZE.shotSpeed,
        true,
        ATOMIZE.shotRadius,
        ATOMIZE.shotDamage,
        11,
        0,
        0,
        0,
        0,
        side * ATOMIZE.shotHand,
      )) {
        p.atomSide = side;
        return;
      }
      p.energy -= ATOMIZE.shotCost;
      p.autoFireT = ATOMIZE.attackCooldown;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (p.program === PROGRAM_ID.TOXIC) {
      // A cheap needle stream. The direct hit is small; the venom is the payload.
      if (p.autoFireT > 0 || p.energy < TOXIC.needleCost) return;
      if (!this.spawnProjectile(
        p,
        0,
        TOXIC.needleTtl,
        TOXIC.needleSpeed,
        false,
        TOXIC.needleRadius,
        TOXIC.needleDamage,
        7,
      )) return;
      p.energy -= TOXIC.needleCost;
      p.autoFireT = TOXIC.attackCooldown;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (p.program === PROGRAM_ID.GHOST) {
      // One wide chomping mouth per throw. Slower than a bolt and easy to read, but
      // it hits for two and leaves the victim dazed and heavy on their feet.
      if (p.autoFireT > 0 || p.energy < GHOST.shotCost) return;
      if (!this.spawnProjectile(
        p,
        0,
        GHOST.shotTtl,
        GHOST.shotSpeed,
        false,
        GHOST.shotRadius,
        GHOST.shotDamage,
        12,
      )) return;
      p.energy -= GHOST.shotCost;
      p.autoFireT = GHOST.attackCooldown;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (p.program === PROGRAM_ID.FISHER) {
      if (p.autoFireT > 0 || p.energy < FISHER.spearCost) return;
      if (!this.spawnProjectile(
        p,
        0,
        FISHER.spearTtl,
        FISHER.spearSpeed,
        false,
        FISHER.spearRadius,
        FISHER.spearDamage,
        5,
      )) return;
      p.energy -= FISHER.spearCost;
      p.autoFireT = FISHER.attackCooldown;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (p.burstCd > 0 || p.burstLeft <= 0) return;
    if (p.energy < BOLT.cost) return;
    if (!this.spawnProjectile(p)) return;
    p.energy -= BOLT.cost;
    p.burstLeft--;
    p.autoFireT = BOLT.autoInterval;
    if (p.burstLeft <= 0) p.burstCd = BOLT.burstCooldown;
    this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
  }

  private heavyCost(p: Player): number {
    if (p.program === PROGRAM_ID.WEDGE) return WEDGE.chargeCost;
    if (p.program === PROGRAM_ID.FISHER) return FISHER.netCost;
    if (p.program === PROGRAM_ID.SWEEP) return SWEEP.powerCost;
    if (p.program === PROGRAM_ID.TOXIC) return TOXIC.streamCost;
    if (p.program === PROGRAM_ID.KABOOM) return KABOOM.clusterCost;
    if (p.program === PROGRAM_ID.BUFFER) return BUFFER.slowCost;
    if (p.program === PROGRAM_ID.ATOMIZE) return ATOMIZE.powerCost;
    if (p.program === PROGRAM_ID.GHOST) return GHOST.scareCost;
    return PLAYER.laserCost;
  }

  /** One shard of Wedge's three-shot string. The string owns its own cadence. */
  private fireWedgeStringShot(p: Player): void {
    if (!p.alive || p.energy < WEDGE.shotCost) {
      p.stringLeft = 0;
      return;
    }
    if (!this.spawnProjectile(
      p,
      0,
      WEDGE.shotTtl,
      WEDGE.shotSpeed,
      false,
      BOLT.radius,
      WEDGE.shotDamage,
    )) {
      p.stringLeft = 0;
      return;
    }
    p.energy -= WEDGE.shotCost;
    p.stringLeft--;
    p.stringT = WEDGE.shotInterval;
    if (p.stringLeft === 0) p.burstCd = WEDGE.attackCooldown;
    this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
  }

  /**
   * Plants Wedge's wall one body-length behind him, across his facing. The wall is a
   * segment plus thickness: solid to bodies, reflective to shots.
   */
  private deployBarrier(p: Player): boolean {
    let wall: Barrier | null = null;
    for (let i = 0; i < this.barriers.length; i++) {
      if (!this.barriers[i].active) {
        wall = this.barriers[i];
        break;
      }
    }
    if (!wall) {
      // The pool is full: recycle the oldest so one player cannot stack a maze.
      wall = this.barriers[0];
      for (let i = 1; i < this.barriers.length; i++) {
        if (this.barriers[i].life < wall.life) wall = this.barriers[i];
      }
    }

    const fx = Math.cos(p.facing);
    const fy = Math.sin(p.facing);
    const cx = p.x - fx * WEDGE.wallOffset;
    const cy = p.y - fy * WEDGE.wallOffset;
    // Tangent is perpendicular to facing; the bracket arms point back at Wedge.
    const tx = -fy;
    const ty = fx;
    const half = WEDGE.wallHalfLength;
    const x1 = cx - tx * half;
    const y1 = cy - ty * half;
    const x2 = cx + tx * half;
    const y2 = cy + ty * half;

    // Keep the whole wall inside the playfield and out of cover.
    const inset = WEDGE.wallThickness * 0.5 + 2;
    const b = this.arena.bounds;
    if (
      x1 < b.left + inset ||
      x1 > b.right - inset ||
      x2 < b.left + inset ||
      x2 > b.right - inset ||
      y1 < b.top + inset ||
      y1 > b.bottom - inset ||
      y2 < b.top + inset ||
      y2 > b.bottom - inset
    ) {
      return false;
    }
    const probe = WEDGE.wallThickness * 0.5 + PLAYER.radius * 0.35;
    for (let i = 0; i < this.solids.length; i++) {
      const pillar = this.solids[i];
      if (circleRect(cx, cy, probe, pillar, hitScratch)) return false;
      if (circleRect(x1, y1, probe, pillar, hitScratch)) return false;
      if (circleRect(x2, y2, probe, pillar, hitScratch)) return false;
    }

    wall.active = true;
    wall.owner = p.slot;
    wall.x1 = x1;
    wall.y1 = y1;
    wall.x2 = x2;
    wall.y2 = y2;
    wall.nx = fx;
    wall.ny = fy;
    wall.life = WEDGE.wallLife;
    wall.maxLife = WEDGE.wallLife;
    wall.hp = WEDGE.wallHp;
    wall.maxHp = WEDGE.wallHp;
    wall.hitFlash = 0;
    wall.phase = this.rng.range(0, Math.PI * 2);
    return true;
  }

  private updateBarriers(dt: number): void {
    for (let i = 0; i < this.barriers.length; i++) {
      const wall = this.barriers[i];
      if (!wall.active) continue;
      if (wall.hitFlash > 0) wall.hitFlash = Math.max(0, wall.hitFlash - dt);
      wall.life -= dt;
      if (wall.life <= 0) {
        wall.life = 0;
        wall.active = false;
      }
    }
  }

  /**
   * Chips a deployed wall. Shots, lashes and blasts all feed this one path, so the shake,
   * the crack stages and the break moment stay in step with its health.
   */
  private damageBarrier(wall: Barrier, amount: number): void {
    if (!wall.active) return;
    wall.hp -= amount;
    wall.hitFlash = WEDGE.wallFlash;
    if (wall.hp > 0) return;
    wall.hp = 0;
    wall.active = false;
    this.emit(
      EV.WALL_BREAK,
      wall.owner,
      (wall.x1 + wall.x2) * 0.5,
      (wall.y1 + wall.y2) * 0.5,
      WEDGE.wallHalfLength * 2,
      wall.nx,
      wall.ny,
    );
  }

  /** Pushes a body out of a deployed wall. Dodges still phase through it. */
  private resolveBarrier(p: Player): void {
    if (p.dashT > 0) return;
    const r = PLAYER.radius;
    const rr = r + WEDGE.wallThickness * 0.5;
    for (let i = 0; i < this.barriers.length; i++) {
      const wall = this.barriers[i];
      if (!wall.active) continue;
      const vx = wall.x2 - wall.x1;
      const vy = wall.y2 - wall.y1;
      const len2 = vx * vx + vy * vy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - wall.x1) * vx + (p.y - wall.y1) * vy) / len2)) : 0;
      const px = wall.x1 + vx * t;
      const py = wall.y1 + vy * t;
      const dx = p.x - px;
      const dy = p.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 > rr * rr) continue;
      const side = dx * wall.nx + dy * wall.ny >= 0 ? 1 : -1;
      const nx = wall.nx * side;
      const ny = wall.ny * side;
      p.x = px + nx * (rr + 0.01);
      p.y = py + ny * (rr + 0.01);
      const vn = p.vx * nx + p.vy * ny;
      if (vn < 0) {
        p.vx -= vn * nx;
        p.vy -= vn * ny;
      }
    }
  }

  /** Opens Wedge's bracket for the dodge bash. */
  private startBracket(p: Player, facing: number): void {
    p.bashT = WEDGE.bashTime;
    p.bashFacing = facing;
    p.bashHitPlayers = 0;
    p.bashHitWorms = 0;
    p.bashHitViruses = 0;
    p.bashHitErrors = 0;
    p.bashHitSentries = 0;
    p.bashHitDrone = false;
    p.ghostT = 0;
  }

  /** Damage and reflection inside the open bracket. The shape is a directional wall. */
  private resolveBracket(p: Player): void {
    const reach = WEDGE.bashReach;
    const halfWidth = WEDGE.bashHalfWidth;
    const damage = WEDGE.bashDamage;
    const force = WEDGE.bashKnockback;
    const cos = Math.cos(p.bashFacing);
    const sin = Math.sin(p.bashFacing);

    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.iframes > 0) continue;
      const bit = 1 << target.slot;
      if ((p.bashHitPlayers & bit) !== 0) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const forward = dx * cos + dy * sin;
      const lateral = Math.abs(dx * sin - dy * cos);
      if (forward < 0 || forward > reach + PLAYER.radius || lateral > halfWidth + PLAYER.radius) continue;
      if (this.lineBlocked(p.x, p.y, target.x, target.y)) continue;
      p.bashHitPlayers |= bit;
      this.damagePlayer(target, damage, p.slot, cos, sin, force);
    }

    if (this.mode === 'training' && this.drone.active && !p.bashHitDrone) {
      const dx = this.drone.x - p.x;
      const dy = this.drone.y - p.y;
      const forward = dx * cos + dy * sin;
      const lateral = Math.abs(dx * sin - dy * cos);
      if (
        forward >= 0 &&
        forward <= reach + this.drone.radius &&
        lateral <= halfWidth + this.drone.radius &&
        !this.lineBlocked(p.x, p.y, this.drone.x, this.drone.y)
      ) {
        p.bashHitDrone = true;
        this.damageDrone(damage, p.slot);
      }
    }

    if (this.mode === 'gauntlet') {
      for (let i = 0; i < this.sentries.length; i++) {
        const s = this.sentries[i];
        if (!s.active) continue;
        const bit = 1 << i;
        if ((p.bashHitSentries & bit) !== 0) continue;
        const dx = s.x - p.x;
        const dy = s.y - p.y;
        const forward = dx * cos + dy * sin;
        const lateral = Math.abs(dx * sin - dy * cos);
        if (forward < 0 || forward > reach + s.radius || lateral > halfWidth + s.radius) continue;
        if (this.lineBlocked(p.x, p.y, s.x, s.y)) continue;
        p.bashHitSentries |= bit;
        this.damageSentry(s, damage, p.slot, cos, sin, force);
      }
      for (let i = 0; i < this.viruses.length; i++) {
        const v = this.viruses[i];
        if (!v.active) continue;
        const bit = 1 << i;
        if ((p.bashHitViruses & bit) !== 0) continue;
        const dx = v.x - p.x;
        const dy = v.y - p.y;
        const forward = dx * cos + dy * sin;
        const lateral = Math.abs(dx * sin - dy * cos);
        if (forward < 0 || forward > reach + v.radius || lateral > halfWidth + v.radius) continue;
        if (this.lineBlocked(p.x, p.y, v.x, v.y)) continue;
        p.bashHitViruses |= bit;
        this.damageVirus(v, damage, p.slot, cos, sin, force);
      }
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (!w.active) continue;
        const bit = 1 << i;
        if ((p.bashHitWorms & bit) !== 0) continue;
        let hitX = w.x;
        let hitY = w.y;
        let touching = false;
        for (let s = -1; s < w.segCount && !touching; s++) {
          const tx = s < 0 ? w.x : w.segX[s];
          const ty = s < 0 ? w.y : w.segY[s];
          const radius = s < 0 ? WORM.headRadius : WORM.segmentRadius;
          const dx = tx - p.x;
          const dy = ty - p.y;
          const forward = dx * cos + dy * sin;
          const lateral = Math.abs(dx * sin - dy * cos);
          if (forward < 0 || forward > reach + radius || lateral > halfWidth + radius) continue;
          if (this.lineBlocked(p.x, p.y, tx, ty)) continue;
          touching = true;
          hitX = tx;
          hitY = ty;
        }
        if (!touching) continue;
        p.bashHitWorms |= bit;
        this.damageWorm(w, damage, p.slot, cos, sin, force);
        void hitX;
        void hitY;
      }
      for (let i = 0; i < this.errors.length; i++) {
        const e = this.errors[i];
        if (!e.active) continue;
        const bit = 1 << i;
        if ((p.bashHitErrors & bit) !== 0) continue;
        const radius = CASCADING_ERROR.blockSize * 0.5;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const forward = dx * cos + dy * sin;
        const lateral = Math.abs(dx * sin - dy * cos);
        if (forward < 0 || forward > reach + radius || lateral > halfWidth + radius) continue;
        if (this.lineBlocked(p.x, p.y, e.x, e.y)) continue;
        p.bashHitErrors |= bit;
        this.damageError(e, damage, p.slot, cos, sin);
      }
    }

    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.owner === p.slot || proj.type === 1 || proj.type === 2) continue;
      if (proj.type === 8 || proj.type === 9) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      const forward = dx * cos + dy * sin;
      const lateral = Math.abs(dx * sin - dy * cos);
      if (forward < 0 || forward > reach + proj.radius || lateral > halfWidth + proj.radius) continue;
      if (this.lineBlocked(p.x, p.y, proj.x, proj.y)) continue;
      const wasMissile = proj.type === 4;
      if (proj.type >= 3) proj.type = 0;
      proj.homing = false;
      const speed = Math.min(
        BOLT.maxSpeed,
        Math.max(Math.hypot(proj.vx, proj.vy), wasMissile ? BOLT.speed : 0) * BOLT.deflectMult,
      );
      proj.vx = cos * speed;
      proj.vy = sin * speed;
      proj.owner = p.slot;
      proj.deflects++;
      proj.damage = BOLT.damage + proj.deflects;
      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      p.swingHit = true;
      this.emit(EV.DEFLECT, p.slot, proj.x, proj.y, proj.deflects);
    }
  }

  /** Commits Wedge's triangle plow. It runs forward and cannot steer. */
  private fireWedgeCharge(p: Player): void {
    if (!p.alive || p.energy < WEDGE.chargeCost) {
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      return;
    }
    p.energy = Math.max(0, p.energy - WEDGE.chargeCost);
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    p.wedgeT = WEDGE.chargeDuration;
    p.wedgeDirX = Math.cos(p.facing);
    p.wedgeDirY = Math.sin(p.facing);
    p.wedgeHitPlayers = 0;
    p.wedgeHitWorms = 0;
    p.wedgeHitViruses = 0;
    p.wedgeHitErrors = 0;
    p.wedgeHitSentries = 0;
    p.wedgeHitDrone = false;
    p.iframes = Math.max(p.iframes, WEDGE.chargeIframes);
    p.laserCd = WEDGE.chargeCooldown;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    p.comboStage = 0;
    p.comboT = 0;
    this.emit(EV.LASER, p.slot, p.x, p.y, p.facing);
  }

  /** The plow shoves bodies and shots sideways out of the triangle as it crosses. */
  private resolveWedgeCharge(p: Player): void {
    const fx = p.wedgeDirX;
    const fy = p.wedgeDirY;
    const radius = WEDGE.chargeRadius;

    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.iframes > 0) continue;
      const bit = 1 << target.slot;
      if ((p.wedgeHitPlayers & bit) !== 0) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const rr = radius + PLAYER.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      p.wedgeHitPlayers |= bit;
      const side = fx * dy - fy * dx >= 0 ? 1 : -1;
      this.damagePlayer(target, WEDGE.chargeDamage, p.slot, -fy * side, fx * side, WEDGE.chargeKnockback);
    }

    if (this.mode === 'training' && this.drone.active && !p.wedgeHitDrone) {
      const dx = this.drone.x - p.x;
      const dy = this.drone.y - p.y;
      const rr = radius + this.drone.radius;
      if (dx * dx + dy * dy <= rr * rr) {
        p.wedgeHitDrone = true;
        this.damageDrone(WEDGE.chargeDamage, p.slot);
      }
    }

    if (this.mode === 'gauntlet') {
      for (let i = 0; i < this.sentries.length; i++) {
        const s = this.sentries[i];
        if (!s.active) continue;
        const bit = 1 << i;
        if ((p.wedgeHitSentries & bit) !== 0) continue;
        const dx = s.x - p.x;
        const dy = s.y - p.y;
        const rr = radius + s.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        p.wedgeHitSentries |= bit;
        const side = fx * dy - fy * dx >= 0 ? 1 : -1;
        this.damageSentry(s, WEDGE.chargeDamage, p.slot, -fy * side, fx * side, WEDGE.chargeKnockback);
      }
      for (let i = 0; i < this.viruses.length; i++) {
        const v = this.viruses[i];
        if (!v.active) continue;
        const bit = 1 << i;
        if ((p.wedgeHitViruses & bit) !== 0) continue;
        const dx = v.x - p.x;
        const dy = v.y - p.y;
        const rr = radius + v.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        p.wedgeHitViruses |= bit;
        const side = fx * dy - fy * dx >= 0 ? 1 : -1;
        this.damageVirus(v, WEDGE.chargeDamage, p.slot, -fy * side, fx * side, WEDGE.chargeKnockback * 0.7);
      }
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (!w.active) continue;
        const bit = 1 << i;
        if ((p.wedgeHitWorms & bit) !== 0) continue;
        let touching = false;
        let hx = w.x - p.x;
        let hy = w.y - p.y;
        if (hx * hx + hy * hy <= (radius + WORM.headRadius) * (radius + WORM.headRadius)) touching = true;
        if (!touching) {
          for (let s = 0; s < w.segCount; s++) {
            hx = w.segX[s] - p.x;
            hy = w.segY[s] - p.y;
            const rr = radius + WORM.segmentRadius;
            if (hx * hx + hy * hy <= rr * rr) {
              touching = true;
              break;
            }
          }
        }
        if (!touching) continue;
        p.wedgeHitWorms |= bit;
        const side = fx * hy - fy * hx >= 0 ? 1 : -1;
        this.damageWorm(w, WEDGE.chargeDamage, p.slot, -fy * side, fx * side, WEDGE.chargeKnockback);
      }
      for (let i = 0; i < this.errors.length; i++) {
        const e = this.errors[i];
        if (!e.active) continue;
        const bit = 1 << i;
        if ((p.wedgeHitErrors & bit) !== 0) continue;
        const errR = CASCADING_ERROR.blockSize * 0.5;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const rr = radius + errR;
        if (dx * dx + dy * dy > rr * rr) continue;
        p.wedgeHitErrors |= bit;
        this.damageError(e, WEDGE.chargeDamage, p.slot, -fy, fx);
      }
    }

    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.owner === p.slot || proj.type === 1 || proj.type === 2) continue;
      if (proj.type === 8 || proj.type === 9) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      const rr = radius + proj.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      const side = fx * dy - fy * dx >= 0 ? 1 : -1;
      const wasMissile = proj.type === 4;
      if (proj.type >= 3) proj.type = 0;
      proj.homing = false;
      const speed = Math.min(
        BOLT.maxSpeed,
        Math.max(Math.hypot(proj.vx, proj.vy), wasMissile ? BOLT.speed : 0) * BOLT.deflectMult,
      );
      proj.vx = -fy * side * speed;
      proj.vy = fx * side * speed;
      proj.owner = p.slot;
      proj.deflects++;
      proj.damage = BOLT.damage + proj.deflects;
      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      this.emit(EV.DEFLECT, p.slot, proj.x, proj.y, proj.deflects);
    }
  }

  /**
   * Sweep's heavy: the giant broom head assembles at the top of the player's view, then
   * drops two thirds of the way down it, carrying and damaging every body it passes.
   * The cast point is the camera window the renderer shows, so the head really does
   * enter from the screen edge instead of from behind the avatar.
   */
  private fireBroomSweep(p: Player): void {
    if (!p.alive) {
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      return;
    }
    // The charge start already checked the cost. Refusing again here meant a heavy
    // that finished charging could silently vanish on release, so pay what is there
    // and always commit the sweep.
    p.energy = Math.max(0, p.energy - SWEEP.powerCost);
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    p.broT = SWEEP.powerDuration;
    p.broDur = SWEEP.powerDuration;
    this.placeBroom(p);
    p.broDirX = 0;
    p.broDirY = 1;
    p.broS = 0;
    // The head materializes from the side the avatar is facing before the stroke. It
    // is latched here so holding the heavy and then steering cannot flip the reveal
    // halfway through the cast.
    p.broRevealT = SWEEP.powerRevealTime;
    p.broRevealDur = SWEEP.powerRevealTime;
    p.broRevealDir = Math.cos(p.facing) < -0.15 ? -1 : 1;
    p.broHitPlayers = 0;
    p.broHitWorms = 0;
    p.broHitViruses = 0;
    p.broHitErrors = 0;
    p.broHitSentries = 0;
    p.broHitDrone = false;
    // Cooldown starts when the sweep ends, not when it begins.
    p.laserCd = 0;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    p.comboStage = 0;
    p.comboT = 0;
    this.emit(EV.LASER, p.slot, p.x, p.y, p.facing);
  }

  /**
   * The giant broom is generated just in front of the player and keeps that lane for the
   * whole stroke. Recomputed while charging so the assembly preview and the committed
   * sweep start in the same place.
   */
  private placeBroom(p: Player): void {
    p.broX = p.x + Math.cos(p.facing) * SWEEP.powerFront;
    p.broY = p.y + Math.sin(p.facing) * SWEEP.powerFront;
  }

  private tickBroomSweep(p: Player, dt: number): void {
    // The materialize beat owns the first slice of the commitment. It shoves bodies
    // aside but deals no damage; the stroke and its damage start once the whole head
    // is on the lane, so a body caught in the reveal has one read before the hit.
    if (p.broRevealT > 0) {
      p.broRevealT = Math.max(0, p.broRevealT - dt);
      p.broS = 0;
      const reveal = p.broRevealDur > 0 ? 1 - p.broRevealT / p.broRevealDur : 1;
      this.resolveBroomReveal(p, reveal);
      return;
    }
    p.broT = Math.max(0, p.broT - dt);
    const pct = p.broDur > 0 ? 1 - p.broT / p.broDur : 1;
    // One big stroke: up for the first half, then down through the same lane twice as
    // far, so the return clears the ground below the player as well as the rise above.
    p.broS =
      pct < 0.5
        ? -SWEEP.powerRise * (pct / 0.5)
        : -SWEEP.powerRise + SWEEP.powerRise * 2 * ((pct - 0.5) / 0.5);
    this.resolveBroomSweep(p);
    if (p.broT > 0) return;
    p.laserCd = SWEEP.powerCooldown;
    p.broHitPlayers = 0;
    p.broHitWorms = 0;
    p.broHitViruses = 0;
    p.broHitErrors = 0;
    p.broHitSentries = 0;
    p.broHitDrone = false;
  }

  /**
   * The head appearing is physical: every body under the part of the lane that is
   * already visible is shoved out toward the reveal front. It deals no damage. The
   * stroke's own resolve begins only after this beat, which is what makes the reveal
   * readable as an assembly instead of an instant wide hit.
   */
  private resolveBroomReveal(p: Player, reveal: number): void {
    const half = SWEEP.powerSpan;
    const width = SWEEP.powerWidth;
    const r = Math.max(0, Math.min(1, reveal));
    const dir = p.broRevealDir;
    // dir +1 grows from the left edge to the right, dir -1 the other way. `edge` is
    // the world-x offset of the bright front from the lane centre.
    const edge = dir > 0 ? -half + half * 2 * r : half - half * 2 * r;
    const visible = (x: number, y: number, radius: number): boolean => {
      if (!this.broomReaches(p, x, y, radius, 0, 1, half, width)) return false;
      const dx = x - p.broX;
      return dir > 0 ? dx <= edge : dx >= edge;
    };
    const kx = dir * SWEEP.powerRevealPush;

    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.travelT > 0) continue;
      if (!visible(target.x, target.y, PLAYER.radius)) continue;
      // A shove, not a hit: no damage, no hit flash, and iframes do not matter.
      target.kx = kx;
      target.ky = 0;
    }

    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active || !visible(s.x, s.y, s.radius)) continue;
      s.kx = kx;
      s.ky = 0;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || !visible(v.x, v.y, v.radius)) continue;
      v.kx = kx;
      v.ky = 0;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      let touching = visible(w.x, w.y, WORM.headRadius);
      for (let s = 0; s < w.segCount && !touching; s++) {
        if (visible(w.segX[s], w.segY[s], WORM.segmentRadius)) touching = true;
      }
      if (!touching) continue;
      w.kx = kx;
      w.ky = 0;
    }
  }

  /**
   * The live broom is one wide bristle row travelling down the view. Damage lands once
   * per body per cast; every body still under the row keeps a downward slide so it
   * rides the broom to the bottom instead of being flicked out of it on the first hit.
   */
  private resolveBroomSweep(p: Player): void {
    const fx = p.broDirX;
    const fy = p.broDirY;
    const half = SWEEP.powerSpan;
    const width = SWEEP.powerWidth;
    // The stroke direction, not the band axis: the rise pushes up, the return pushes
    // down, so a body caught on the way up is carried back with the head.
    const pct = p.broDur > 0 ? 1 - p.broT / p.broDur : 1;
    const sy = pct < 0.5 ? -1 : 1;

    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.travelT > 0) continue;
      if (!this.broomReaches(p, target.x, target.y, PLAYER.radius, fx, fy, half, width)) continue;
      const bit = 1 << target.slot;
      if ((p.broHitPlayers & bit) !== 0) {
        target.kx = 0;
        target.ky = sy * SWEEP.powerCarry;
        continue;
      }
      if (target.iframes > 0) continue;
      p.broHitPlayers |= bit;
      this.damagePlayer(target, SWEEP.powerDamage, p.slot, 0, sy, SWEEP.powerKnockback);
    }

    if (this.mode === 'training' && this.drone.active && !p.broHitDrone) {
      if (this.broomReaches(p, this.drone.x, this.drone.y, this.drone.radius, fx, fy, half, width)) {
        p.broHitDrone = true;
        this.damageDrone(SWEEP.powerDamage, p.slot);
      }
    }

    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      if (!this.broomReaches(p, s.x, s.y, s.radius, fx, fy, half, width)) continue;
      const bit = 1 << i;
      if ((p.broHitSentries & bit) !== 0) {
        s.kx = 0;
        s.ky = sy * SWEEP.powerCarry;
        continue;
      }
      p.broHitSentries |= bit;
      this.damageSentry(s, SWEEP.powerDamage, p.slot, 0, sy, SWEEP.powerKnockback);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      if (!this.broomReaches(p, v.x, v.y, v.radius, fx, fy, half, width)) continue;
      const bit = 1 << i;
      if ((p.broHitViruses & bit) !== 0) {
        v.kx = 0;
        v.ky = sy * SWEEP.powerCarry;
        continue;
      }
      p.broHitViruses |= bit;
      this.damageVirus(v, SWEEP.powerDamage, p.slot, 0, sy, SWEEP.powerKnockback);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      let touchX = 0;
      let touchY = 0;
      let touching = this.broomReaches(p, w.x, w.y, WORM.headRadius, fx, fy, half, width);
      if (touching) {
        touchX = w.x;
        touchY = w.y;
      }
      for (let s = 0; s < w.segCount && !touching; s++) {
        if (!this.broomReaches(p, w.segX[s], w.segY[s], WORM.segmentRadius, fx, fy, half, width)) continue;
        touching = true;
        touchX = w.segX[s];
        touchY = w.segY[s];
      }
      if (!touching) continue;
      const bit = 1 << i;
      if ((p.broHitWorms & bit) !== 0) {
        w.kx = 0;
        w.ky = sy * SWEEP.powerCarry;
        continue;
      }
      p.broHitWorms |= bit;
      this.damageWorm(w, SWEEP.powerDamage, p.slot, 0, sy, SWEEP.powerKnockback);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const bit = 1 << i;
      if ((p.broHitErrors & bit) !== 0) continue;
      const radius = CASCADING_ERROR.blockSize * 0.5;
      if (!this.broomReaches(p, e.x, e.y, radius, fx, fy, half, width)) continue;
      p.broHitErrors |= bit;
      this.damageError(e, SWEEP.powerDamage, p.slot, 0, sy);
    }
  }

  /** True when a body sits under the live broom line and cover does not cut the hit. */
  private broomReaches(
    p: Player,
    x: number,
    y: number,
    radius: number,
    fx: number,
    fy: number,
    half: number,
    width: number,
  ): boolean {
    const dx = x - p.broX;
    const dy = y - p.broY;
    const forward = dx * fx + dy * fy;
    if (Math.abs(forward - p.broS) > width + radius) return false;
    const lateral = -dx * fy + dy * fx;
    if (Math.abs(lateral) > half + radius) return false;
    // Cover blocks the contact point on the broom, not the broom's center.
    const cx = p.broX + fx * p.broS - fy * lateral;
    const cy = p.broY + fy * p.broS + fx * lateral;
    return !this.lineBlocked(cx, cy, x, y);
  }

  /**
   * Sweep's skill: two brooms start together ahead of him and split along the tangent,
   * shoving bodies out of the lane and leaving a clear path in front.
   */
  private startFan(p: Player): void {
    const fx = Math.cos(p.facing);
    const fy = Math.sin(p.facing);
    p.fanT = SWEEP.fanLife;
    p.fanDur = SWEEP.fanLife;
    p.fanX = p.x + fx * 58;
    p.fanY = p.y + fy * 58;
    p.fanTx = -fy;
    p.fanTy = fx;
    p.fanHitPlayers = 0;
    p.fanHitWorms = 0;
    p.fanHitViruses = 0;
    p.fanHitErrors = 0;
    p.fanHitSentries = 0;
    p.fanHitDrone = false;
  }

  private tickFan(p: Player, dt: number): void {
    p.fanT = Math.max(0, p.fanT - dt);
    const pct = p.fanDur > 0 ? 1 - p.fanT / p.fanDur : 1;
    this.resolveFan(p, SWEEP.fanReach * pct);
    if (p.fanT > 0) return;
    p.fanHitPlayers = 0;
    p.fanHitWorms = 0;
    p.fanHitViruses = 0;
    p.fanHitErrors = 0;
    p.fanHitSentries = 0;
    p.fanHitDrone = false;
  }

  private resolveFan(p: Player, spread: number): void {
    const tx = p.fanTx;
    const ty = p.fanTy;
    const reach = SWEEP.fanWidth;
    for (let side = -1; side <= 1; side += 2) {
      const bx = p.fanX + tx * spread * side;
      const by = p.fanY + ty * spread * side;
      const shoveX = tx * side;
      const shoveY = ty * side;

      for (let i = 0; i < this.players.length; i++) {
        const target = this.players[i];
        if (target === p || !target.active || !target.alive || target.iframes > 0) continue;
        const bit = 1 << target.slot;
        if ((p.fanHitPlayers & bit) !== 0) continue;
        if (!this.fanReaches(bx, by, target.x, target.y, PLAYER.radius, reach)) continue;
        p.fanHitPlayers |= bit;
        this.damagePlayer(target, SWEEP.fanDamage, p.slot, shoveX, shoveY, SWEEP.fanKnockback);
      }

      if (this.mode === 'training' && this.drone.active && !p.fanHitDrone) {
        if (this.fanReaches(bx, by, this.drone.x, this.drone.y, this.drone.radius, reach)) {
          p.fanHitDrone = true;
          this.damageDrone(SWEEP.fanDamage, p.slot);
        }
      }

      if (this.mode !== 'gauntlet') continue;
      for (let i = 0; i < this.sentries.length; i++) {
        const s = this.sentries[i];
        if (!s.active) continue;
        const bit = 1 << i;
        if ((p.fanHitSentries & bit) !== 0) continue;
        if (!this.fanReaches(bx, by, s.x, s.y, s.radius, reach)) continue;
        p.fanHitSentries |= bit;
        this.damageSentry(s, SWEEP.fanDamage, p.slot, shoveX, shoveY, SWEEP.fanKnockback);
      }
      for (let i = 0; i < this.viruses.length; i++) {
        const v = this.viruses[i];
        if (!v.active) continue;
        const bit = 1 << i;
        if ((p.fanHitViruses & bit) !== 0) continue;
        if (!this.fanReaches(bx, by, v.x, v.y, v.radius, reach)) continue;
        p.fanHitViruses |= bit;
        this.damageVirus(v, SWEEP.fanDamage, p.slot, shoveX, shoveY, SWEEP.fanKnockback);
      }
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (!w.active) continue;
        const bit = 1 << i;
        if ((p.fanHitWorms & bit) !== 0) continue;
        let touching = this.fanReaches(bx, by, w.x, w.y, WORM.headRadius, reach);
        for (let s = 0; s < w.segCount && !touching; s++) {
          touching = this.fanReaches(bx, by, w.segX[s], w.segY[s], WORM.segmentRadius, reach);
        }
        if (!touching) continue;
        p.fanHitWorms |= bit;
        this.damageWorm(w, SWEEP.fanDamage, p.slot, shoveX, shoveY, SWEEP.fanKnockback);
      }
      for (let i = 0; i < this.errors.length; i++) {
        const e = this.errors[i];
        if (!e.active) continue;
        const bit = 1 << i;
        if ((p.fanHitErrors & bit) !== 0) continue;
        const radius = CASCADING_ERROR.blockSize * 0.5;
        if (!this.fanReaches(bx, by, e.x, e.y, radius, reach)) continue;
        p.fanHitErrors |= bit;
        this.damageError(e, SWEEP.fanDamage, p.slot, shoveX, shoveY);
      }
    }
  }

  private fanReaches(bx: number, by: number, x: number, y: number, radius: number, reach: number): boolean {
    const dx = x - bx;
    const dy = y - by;
    const rr = reach + radius;
    if (dx * dx + dy * dy > rr * rr) return false;
    return !this.lineBlocked(bx, by, x, y);
  }

  /** Applies the venom. A hit refreshes the whole duration instead of stacking ticks. */
  private poisonPlayer(p: Player, sourceSlot: number): void {
    p.poisonT = TOXIC.poisonTime;
    p.poisonTickT = TOXIC.poisonTick;
    p.poisonSrc = sourceSlot;
  }

  private poisonDrone(d: Drone): void {
    d.poisonT = TOXIC.poisonTime;
    d.poisonTickT = TOXIC.poisonTick;
  }

  private tickPlayerPoison(p: Player, dt: number): void {
    if (p.poisonT <= 0) return;
    p.poisonT = Math.max(0, p.poisonT - dt);
    p.poisonTickT -= dt;
    if (p.poisonTickT > 0) return;
    p.poisonTickT += TOXIC.poisonTick;
    this.damagePlayer(p, TOXIC.poisonDamage, p.poisonSrc, 0, -1, 0, SRC.PLAYER, p.poisonSrc);
  }

  private tickDronePoison(d: Drone, dt: number): void {
    if (d.poisonT <= 0) return;
    d.poisonT = Math.max(0, d.poisonT - dt);
    d.poisonTickT -= dt;
    if (d.poisonTickT > 0) return;
    d.poisonTickT += TOXIC.poisonTick;
    this.damageDrone(TOXIC.poisonDamage, 0);
  }

  /**
   * Toxic's skill: a 360-degree gas burst. Every body inside the cloud takes a little
   * damage and the venom, with cover cutting the cloud like any other line of sight.
   */
  private startToxicSpray(p: Player): void {
    p.toxT = TOXIC.sprayLife;
    p.toxDur = TOXIC.sprayLife;
    p.toxRadius = TOXIC.sprayRadius;
    p.toxCone = false;
    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.travelT > 0) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      if (dx * dx + dy * dy > (TOXIC.sprayRadius + PLAYER.radius) ** 2) continue;
      if (this.lineBlocked(p.x, p.y, target.x, target.y)) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.damagePlayer(target, TOXIC.sprayDamage, p.slot, dx / d, dy / d, TOXIC.needleKnockback);
      this.poisonPlayer(target, p.slot);
    }
    if (this.mode === 'training' && this.drone.active) {
      const dx = this.drone.x - p.x;
      const dy = this.drone.y - p.y;
      if (dx * dx + dy * dy <= (TOXIC.sprayRadius + this.drone.radius) ** 2 && !this.lineBlocked(p.x, p.y, this.drone.x, this.drone.y)) {
        this.damageDrone(TOXIC.sprayDamage, p.slot);
        this.poisonDrone(this.drone);
      }
    }
    this.damageGauntletInCloud(p, TOXIC.sprayRadius, TOXIC.sprayDamage, false);
  }

  /**
   * Toxic's power: a committed jet. Charging ends here; the body is rooted for
   * `streamTime`, the stick still steers, and venom is paid out in ticks by
   * `applyToxicStream` instead of one burst on the firing frame.
   */
  private startToxicStream(p: Player): void {
    if (!p.alive) {
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      return;
    }
    p.energy = Math.max(0, p.energy - TOXIC.streamCost);
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    p.laserT = TOXIC.streamTime;
    p.laserTickT = TOXIC.streamTick;
    p.laserFacing = p.facing;
    p.toxT = TOXIC.streamTime;
    p.toxDur = TOXIC.streamTime;
    p.toxRadius = TOXIC.streamRange;
    p.toxCone = true;
    p.laserCd = TOXIC.streamCooldown;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    this.emit(EV.LASER, p.slot, p.x, p.y, p.facing);
    this.applyToxicStream(p);
  }

  /** One damage tick of the jet. Every body in the narrow line takes venom again. */
  private applyToxicStream(p: Player): void {
    const half = TOXIC.streamHalfAngle;
    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.travelT > 0) continue;
      if (!this.inToxicLine(p, target.x, target.y, PLAYER.radius, half)) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      this.damagePlayer(target, TOXIC.streamDamage, p.slot, dx / d, dy / d, TOXIC.needleKnockback * 0.25);
      this.poisonPlayer(target, p.slot);
    }
    if (this.mode === 'training' && this.drone.active && this.inToxicLine(p, this.drone.x, this.drone.y, this.drone.radius, half)) {
      this.damageDrone(TOXIC.streamDamage, p.slot);
      this.poisonDrone(this.drone);
    }
    if (this.mode === 'gauntlet') this.damageGauntletInCloud(p, TOXIC.streamRange, TOXIC.streamDamage, true, half);
  }

  private inToxicLine(
    p: Player,
    x: number,
    y: number,
    radius: number,
    half: number,
    range: number = TOXIC.streamRange,
  ): boolean {
    const dx = x - p.x;
    const dy = y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range + radius) return false;
    if (dist > 1) {
      const fx = Math.cos(p.facing);
      const fy = Math.sin(p.facing);
      if ((dx * fx + dy * fy) / dist < Math.cos(half)) return false;
    }
    return !this.lineBlocked(p.x, p.y, x, y);
  }

  /**
   * Gas hurts the local threat families too. Venom on those bodies is a later pass;
   * the cloud still damages them so the kit is usable in the gauntlet.
   */
  private damageGauntletInCloud(
    p: Player,
    radius: number,
    amount: number,
    cone: boolean,
    half = 0.42,
  ): void {
    if (this.mode !== 'gauntlet') return;
    const reaches = (x: number, y: number, r: number): boolean =>
      cone ? this.inToxicLine(p, x, y, r, half, radius) : this.inToxicSpray(p, x, y, r, radius);
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active && reaches(s.x, s.y, s.radius)) this.damageSentry(s, amount, p.slot, 0, 0, 0);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (v.active && reaches(v.x, v.y, v.radius)) this.damageVirus(v, amount, p.slot, 0, 0, 0);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      let hit = reaches(w.x, w.y, WORM.headRadius);
      for (let s = 0; s < w.segCount && !hit; s++) hit = reaches(w.segX[s], w.segY[s], WORM.segmentRadius);
      if (hit) this.damageWorm(w, amount, p.slot, 0, 0, 0);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (e.active && reaches(e.x, e.y, CASCADING_ERROR.blockSize * 0.5)) this.damageError(e, amount, p.slot, 0, 0);
    }
  }

  private inToxicSpray(p: Player, x: number, y: number, radius: number, spray: number): boolean {
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy > (spray + radius) ** 2) return false;
    return !this.lineBlocked(p.x, p.y, x, y);
  }

  private startNetDraw(p: Player): void {
    let index = -1;
    for (let i = 0; i < this.nets.length; i++) {
      if (!this.nets[i].active && this.nets[i].count === 0) {
        index = i;
        break;
      }
    }
    if (index < 0) {
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      return;
    }
    const net = this.nets[index];
    net.owner = p.slot;
    net.count = 1;
    net.length = 0;
    net.life = 0;
    net.phase = this.rng.range(0, Math.PI * 2);
    net.xs[0] = p.x - Math.cos(p.facing) * 22;
    net.ys[0] = p.y - Math.sin(p.facing) * 22;
    p.netDrawing = true;
    p.netT = 0;
    p.netIndex = index;
  }

  /** Appends the player's current position once he has moved far enough from the tip. */
  private sampleNet(p: Player): void {
    if (p.netIndex < 0) return;
    const net = this.nets[p.netIndex];
    if (!net) return;
    if (net.count >= FISHER.netPoints || net.length >= FISHER.netMaxLength) return;
    const px = net.xs[net.count - 1];
    const py = net.ys[net.count - 1];
    const dx = p.x - px;
    const dy = p.y - py;
    const d = Math.hypot(dx, dy);
    if (d < FISHER.netPointSpacing) return;
    net.xs[net.count] = p.x;
    net.ys[net.count] = p.y;
    net.count++;
    net.length += d;
  }

  /** Releases a claimed, in-progress web back to the pool. */
  private releaseNetDraft(p: Player): void {
    if (p.netIndex < 0) return;
    const net = this.nets[p.netIndex];
    if (net && !net.active) {
      net.count = 0;
      net.length = 0;
    }
    p.netIndex = -1;
    p.netDrawing = false;
    p.netT = 0;
  }

  /** Drops the drawn web. The cost is paid on release; nothing is charged for a stub. */
  private detachNet(p: Player): void {
    if (!p.netDrawing) return;
    const index = p.netIndex;
    p.netDrawing = false;
    p.netT = 0;
    p.netIndex = -1;
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    p.laserFacing = p.facing;
    const net = index >= 0 ? this.nets[index] : null;
    if (!net) return;
    if (net.count < 2 || net.length < FISHER.netMinLength || p.energy < FISHER.netCost) {
      net.count = 0;
      net.length = 0;
      p.laserCd = Math.max(p.laserCd, 0.8);
      return;
    }

    p.energy = Math.max(0, p.energy - FISHER.netCost);
    p.laserCd = FISHER.netCooldown;
    this.smoothNet(net);
    net.active = true;
    net.life = FISHER.netLife;
    const mid = net.count >> 1;
    this.emit(EV.SHIELD_WAVE, p.slot, net.xs[mid], net.ys[mid], p.facing);
  }

  /**
   * Rounds out a drawn curve once, on deploy, so the stored collision shape matches the
   * smooth line the renderer traces. A hard turn keeps its corner: the point's turn is
   * tested against `netCornerCos` before it is blended with its neighbours.
   */
  private smoothNet(net: Net): void {
    const n = net.count;
    if (n < 3) return;
    const sx = this.netScratchX;
    const sy = this.netScratchY;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        sx[i] = net.xs[i];
        sy[i] = net.ys[i];
      }
      for (let i = 1; i < n - 1; i++) {
        const ax = sx[i] - sx[i - 1];
        const ay = sy[i] - sy[i - 1];
        const bx = sx[i + 1] - sx[i];
        const by = sy[i + 1] - sy[i];
        const la = Math.hypot(ax, ay);
        const lb = Math.hypot(bx, by);
        if (la < 0.001 || lb < 0.001) continue;
        if ((ax * bx + ay * by) / (la * lb) <= FISHER.netCornerCos) continue;
        net.xs[i] = (sx[i - 1] + 2 * sx[i] + sx[i + 1]) * 0.25;
        net.ys[i] = (sy[i - 1] + 2 * sy[i] + sy[i + 1]) * 0.25;
      }
    }
  }

  /**
   * A deployed web holds whatever touches it: hostiles pin in place and player bodies
   * are pushed out and stopped. It does no damage, and it lasts until `netLife` runs out.
   */
  private updateNets(dt: number): void {
    for (let i = 0; i < this.nets.length; i++) {
      const net = this.nets[i];
      if (!net.active) continue;
      net.life -= dt;
      net.phase += dt;
      if (net.life <= 0) {
        net.active = false;
        net.count = 0;
        net.length = 0;
        continue;
      }

      for (let s = 0; s < this.sentries.length; s++) {
        const sentry = this.sentries[s];
        if (!sentry.active) continue;
        if (!this.netReaches(net, sentry.x, sentry.y, sentry.radius)) continue;
        sentry.pinT = Math.max(sentry.pinT, FISHER.netHold);
      }
      for (let s = 0; s < this.viruses.length; s++) {
        const virus = this.viruses[s];
        if (!virus.active) continue;
        if (!this.netReaches(net, virus.x, virus.y, virus.radius)) continue;
        virus.pinT = Math.max(virus.pinT, FISHER.netHold);
      }
      if (this.drone.active && this.netReaches(net, this.drone.x, this.drone.y, this.drone.radius)) {
        this.drone.netPinT = FISHER.netHold;
      }
      for (let s = 0; s < this.worms.length; s++) {
        const worm = this.worms[s];
        if (!worm.active) continue;
        let touching = this.netReaches(net, worm.x, worm.y, WORM.headRadius);
        if (!touching) {
          for (let g = 0; g < worm.segCount; g++) {
            if (this.netReaches(net, worm.segX[g], worm.segY[g], WORM.segmentRadius)) {
              touching = true;
              break;
            }
          }
        }
        if (!touching) continue;
        worm.pinT = Math.max(worm.pinT, FISHER.netHold);
      }
    }
  }

  /**
   * Bodies are caught, not bounced: a player, bot or thrall inside the web is held where
   * it touched until the web expires. Fisher is exempt from his own web, and a dodge or
   * his plow tears straight through because those moves phase geometry.
   */
  private resolveNets(p: Player): void {
    if (p.dashT > 0 || p.wedgeT > 0) return;
    const r = PLAYER.radius;
    for (let i = 0; i < this.nets.length; i++) {
      const net = this.nets[i];
      if (!net.active || net.owner === p.slot) continue;
      if (!this.netReaches(net, p.x, p.y, r)) continue;
      p.netPinT = FISHER.netHold;
      p.vx = 0;
      p.vy = 0;
      p.kx = 0;
      p.ky = 0;
    }
  }

  private netReaches(net: Net, x: number, y: number, radius: number): boolean {
    const rr = FISHER.netWidth + radius;
    const rr2 = rr * rr;
    for (let s = 1; s < net.count; s++) {
      const ax = net.xs[s - 1];
      const ay = net.ys[s - 1];
      const vx = net.xs[s] - ax;
      const vy = net.ys[s] - ay;
      const len2 = vx * vx + vy * vy;
      const t = len2 > 0.0001 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2)) : 0;
      const dx = x - (ax + vx * t);
      const dy = y - (ay + vy * t);
      if (dx * dx + dy * dy <= rr2) return true;
    }
    return false;
  }

  /** Shots reflect off the nearest strand of the web, whatever shape it was drawn in. */
  private netBlocksProjectile(proj: Projectile): boolean {
    for (let i = 0; i < this.nets.length; i++) {
      const net = this.nets[i];
      if (!net.active || proj.owner === net.owner || proj.type === 1 || proj.type === 2) continue;
      if (proj.type === 8 || proj.type === 9) continue;
      const rr = FISHER.netWidth + proj.radius;
      const rr2 = rr * rr;
      let hit = false;
      let hx = 0;
      let hy = 0;
      let nx = 0;
      let ny = 0;
      let nearest = rr2;
      for (let s = 1; s < net.count; s++) {
        const ax = net.xs[s - 1];
        const ay = net.ys[s - 1];
        const vx = net.xs[s] - ax;
        const vy = net.ys[s] - ay;
        const len2 = vx * vx + vy * vy;
        if (len2 < 0.0001) continue;
        const t = Math.max(0, Math.min(1, ((proj.x - ax) * vx + (proj.y - ay) * vy) / len2));
        const px = ax + vx * t;
        const py = ay + vy * t;
        const dx = proj.x - px;
        const dy = proj.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 > rr2 || d2 >= nearest) continue;
        nearest = d2;
        const len = Math.sqrt(len2);
        nx = -vy / len;
        ny = vx / len;
        hx = px;
        hy = py;
        hit = true;
      }
      if (!hit) continue;

      const side = (proj.x - hx) * nx + (proj.y - hy) * ny;
      const vn = proj.vx * nx + proj.vy * ny;
      const wasMissile = proj.type === 4;
      if (proj.type >= 3) proj.type = 0;
      proj.homing = false;
      proj.vx -= 2 * vn * nx;
      proj.vy -= 2 * vn * ny;
      const speed = Math.min(
        BOLT.maxSpeed,
        Math.max(Math.hypot(proj.vx, proj.vy), wasMissile ? BOLT.speed : 0) * FISHER.netReflectMult,
      );
      const mag = Math.hypot(proj.vx, proj.vy) || 1;
      proj.vx = (proj.vx / mag) * speed;
      proj.vy = (proj.vy / mag) * speed;
      const push = side >= 0 ? 1 : -1;
      proj.x += nx * push * (FISHER.netWidth + proj.radius + 2);
      proj.y += ny * push * (FISHER.netWidth + proj.radius + 2);
      proj.owner = net.owner;
      proj.deflects++;
      proj.damage = BOLT.damage + proj.deflects;
      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      this.emit(EV.DEFLECT, net.owner, proj.x, proj.y, proj.deflects);
      return true;
    }
    return false;
  }

  private spawnLure(p: Player): void {
    let lure: Lure | null = null;
    for (let i = 0; i < this.lures.length; i++) {
      if (!this.lures[i].active) {
        lure = this.lures[i];
        break;
      }
    }
    if (!lure) return;
    lure.active = true;
    lure.owner = p.slot;
    lure.x = p.x;
    lure.y = p.y;
    lure.life = FISHER.lureLife;
    lure.phase = this.rng.range(0, Math.PI * 2);
  }

  private updateLures(dt: number): void {
    for (let i = 0; i < this.lures.length; i++) {
      const lure = this.lures[i];
      if (!lure.active) continue;
      lure.life -= dt;
      lure.phase += dt;
      if (lure.life <= 0) lure.active = false;
    }
  }

  /**
   * Nearest live lure inside its attraction radius, or -1. Local bots read it as a
   * decoy and pass their own slot so their beacon does not pull them off the chase.
   */
  nearestLureIndex(x: number, y: number, ignoreOwner = -1): number {
    let best = -1;
    let bestD2 = FISHER.lureRadius * FISHER.lureRadius;
    for (let i = 0; i < this.lures.length; i++) {
      const lure = this.lures[i];
      if (!lure.active || lure.owner === ignoreOwner) continue;
      const dx = lure.x - x;
      const dy = lure.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    return best;
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
    } else if (p.bugKind === 3) {
      p.ghostT = BUG.ghostDuration;
    } else if (p.bugKind === 6) {
      this.startFan(p);
    } else if (p.bugKind === 7) {
      this.startToxicSpray(p);
    } else if (p.bugKind === 8) {
      this.throwSkillBomb(p);
    } else if (p.bugKind === 9) {
      this.startFastForward(p);
    } else if (p.bugKind === 10) {
      // Three balls are a commitment, not a refresh: a second tap while any survive
      // is refused and the energy handed back.
      if (p.atomBalls > 0) {
        p.bugCd = 0;
        p.energy = Math.min(PLAYER.energyMax, p.energy + BUG.cost);
        return;
      }
      this.startAtomBalls(p);
    } else if (p.bugKind === 11) {
      this.startGhostCloak(p);
    } else if (p.bugKind === 4) {
      // Wedge's signature bug: a static bracket wall behind him. Refuse a wall that
      // would land inside cover and hand the energy back rather than eat the button.
      if (!this.deployBarrier(p)) {
        p.bugCd = 0;
        p.energy = Math.min(PLAYER.energyMax, p.energy + BUG.cost);
        return;
      }
    } else {
      this.spawnLure(p);
    }
    this.emit(EV.BUG, p.slot, p.x, p.y, p.bugKind, Math.cos(p.facing), Math.sin(p.facing));
  }

  /**
   * Ghost's skill: drop out of the room for a few seconds. Attacks do not break the
   * cloak, so the player can reposition and shoot from cover; the body is skipped by
   * damage, projectile and enemy-sense tests for the full window.
   */
  private startGhostCloak(p: Player): void {
    p.cloakT = Math.max(p.cloakT, GHOST.cloakTime);
    p.swingPhase = 0;
    p.swingT = 0;
    p.swingPct = 0;
    p.guardT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
  }

  /**
   * Ghost's heavy: re-cloak and arm the jump-scare. The melee button fires the burst;
   * releasing the heavy early is the cloak skill instead. The armed body can still
   * move, shoot and pick up items.
   */
  private startJumpScare(p: Player): void {
    if (p.laserCd > 0) return;
    if (p.energy < GHOST.scareCost) {
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      p.chargeT = 0;
      p.chargeHeld = false;
      return;
    }
    p.energy -= GHOST.scareCost;
    p.laserCd = GHOST.scareCooldown;
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    p.swingPhase = 0;
    p.swingT = 0;
    p.swingPct = 0;
    p.guardT = 0;
    p.cloakT = Math.max(p.cloakT, GHOST.scareWindow);
    p.scareT = GHOST.scareWindow;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    this.emit(EV.BUG, p.slot, p.x, p.y, p.bugKind, Math.cos(p.facing), Math.sin(p.facing));
  }

  /**
   * Jump-scare burst: the cloak drops, a radial blast damages everything around the
   * body, every survivor caught inside the ring is thrown out of it, and the ASCII face
   * is stamped at the burst point for the renderer. ExplodeBlast already respects cover
   * and skips the caster, so the scare cannot hit its own owner.
   */
  private fireJumpScare(p: Player): boolean {
    if (p.scareT <= 0) return false;
    p.scareT = 0;
    p.cloakT = 0;
    p.scareFaceT = GHOST.faceTime;
    p.scareFaceX = p.x;
    p.scareFaceY = p.y;
    p.swingPhase = 0;
    p.swingT = 0;
    p.swingPct = 0;
    this.explodeBlast(
      p.x,
      p.y,
      GHOST.scareRadius,
      GHOST.scareDamage,
      p.slot,
      GHOST.scareKnockback,
    );
    this.evictJumpScare(p);
    return true;
  }

  /**
   * The scare is an eviction, not just a hit: every body still standing inside the ring
   * is thrown clear of its edge. A knock impulse travels `v0 / drag` units before it
   * dies, so each family gets exactly the outward speed that covers the gap left plus
   * `scareClearance`; a body already moving outward only gets the shortfall, and cover
   * still cuts the wave. Rooted cascading-error blocks are the one family that does not
   * move: the colony is floor geometry, not a body with a knock channel.
   */
  private evictJumpScare(p: Player): void {
    const radius = GHOST.scareRadius;
    const clear = GHOST.scareClearance;
    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (!target.active || !target.alive || target.slot === p.slot) continue;
      // A ride owns the body; a shockwave does not get to unload a pad or lift.
      if (target.travelT > 0) continue;
      this.shoveClearOfBlast(target, p.x, p.y, radius, clear, PLAYER.knockDrag, PLAYER.radius);
    }
    if (this.mode !== 'gauntlet' || p.slot === 1) return;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      // A dormant calibration subject is a lesson, not a body: it wakes instead.
      if (s.kind >= 4 && this.campaignPhase === 'calibration' && s.shapeState === 0) continue;
      this.shoveClearOfBlast(s, p.x, p.y, radius, clear, SENTRY.knockDrag, s.radius);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      this.shoveClearOfBlast(w, p.x, p.y, radius, clear, WORM.knockDrag, WORM.headRadius);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      this.shoveClearOfBlast(v, p.x, p.y, radius, clear, VIRUS.knockDrag, v.radius);
    }
  }

  /**
   * Raises a body's outward knock velocity until it carries the body clear of a blast.
   * `need` is the distance left to the ring edge plus the clearance; the impulse that
   * covers it is `need * drag`, because a decaying knock travels `v0 / drag` in total.
   */
  private shoveClearOfBlast(
    body: { x: number; y: number; kx: number; ky: number },
    x: number,
    y: number,
    radius: number,
    clearance: number,
    drag: number,
    bodyRadius: number,
  ): void {
    const dx = body.x - x;
    const dy = body.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > radius + bodyRadius) return;
    if (this.lineBlocked(x, y, body.x, body.y)) return;
    const need = radius + clearance - dist;
    if (need <= 0) return;
    const nx = dist > 0.001 ? dx / dist : 1;
    const ny = dist > 0.001 ? dy / dist : 0;
    const want = need * drag;
    const outward = body.kx * nx + body.ky * ny;
    if (outward >= want) return;
    const add = want - Math.max(0, outward);
    body.kx += nx * add;
    body.ky += ny * add;
  }

  /**
   * Atomize's skill: three blue balls take up an orbit around the body. They have no
   * timer; each one is spent either on the first hostile it touches or on the first
   * full hit the avatar takes. The mark is the same in the arena and the readiness dock.
   */
  private startAtomBalls(p: Player): void {
    p.atomBalls = ATOMIZE.ballCount;
    p.atomBallA = p.facing;
    p.atomFlashT = 0;
  }

  /**
   * Rotates the shield balls and resolves their one-shot contact damage. A ball is
   * consumed by the first body it touches; if it hits nothing it waits forever. This
   * runs before the orbit field so a ball can still be spent while the heavy is live.
   */
  private tickAtomBalls(p: Player, dt: number): void {
    p.atomFlashT = Math.max(0, p.atomFlashT - dt);
    if (p.atomBalls <= 0) return;
    const fast = p.fastT > 0 ? BUFFER.fastScale : 1;
    p.atomBallA += ATOMIZE.ballSpin * fast * dt;
    const count = p.atomBalls;
    for (let i = 0; i < count; i++) {
      const a = p.atomBallA + (i / count) * Math.PI * 2;
      const bx = p.x + Math.cos(a) * ATOMIZE.ballOrbit;
      const by = p.y + Math.sin(a) * ATOMIZE.ballOrbit;

      for (let j = 0; j < this.players.length; j++) {
        const target = this.players[j];
        if (target === p || !target.active || !target.alive || target.travelT > 0) continue;
        if (target.iframes > 0 || phased(target)) continue;
        const dx = target.x - bx;
        const dy = target.y - by;
        const rr = ATOMIZE.ballRadius + PLAYER.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        const d = Math.hypot(dx, dy) || 1;
        this.damagePlayer(target, ATOMIZE.ballDamage, p.slot, dx / d, dy / d, ATOMIZE.ballKnockback);
        this.consumeAtomBall(p);
        return;
      }

      if (this.mode === 'training' && this.drone.active) {
        const dx = this.drone.x - bx;
        const dy = this.drone.y - by;
        const rr = ATOMIZE.ballRadius + this.drone.radius;
        if (dx * dx + dy * dy <= rr * rr) {
          const d = Math.hypot(dx, dy) || 1;
          this.damageDrone(ATOMIZE.ballDamage, p.slot);
          this.emit(EV.SENTRY_HIT, p.slot, bx, by, ATOMIZE.ballDamage, dx / d, dy / d);
          this.consumeAtomBall(p);
          return;
        }
      }

      if (this.mode !== 'gauntlet') continue;
      for (let j = 0; j < this.sentries.length; j++) {
        const s = this.sentries[j];
        if (!s.active || s.spawnT > 0) continue;
        const dx = s.x - bx;
        const dy = s.y - by;
        const rr = ATOMIZE.ballRadius + s.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        const d = Math.hypot(dx, dy) || 1;
        this.damageSentry(s, ATOMIZE.ballDamage, p.slot, dx / d, dy / d, ATOMIZE.ballKnockback);
        this.consumeAtomBall(p);
        return;
      }
      for (let j = 0; j < this.viruses.length; j++) {
        const v = this.viruses[j];
        if (!v.active || v.spawnT > 0) continue;
        const dx = v.x - bx;
        const dy = v.y - by;
        const rr = ATOMIZE.ballRadius + v.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        const d = Math.hypot(dx, dy) || 1;
        this.damageVirus(v, ATOMIZE.ballDamage, p.slot, dx / d, dy / d, ATOMIZE.ballKnockback);
        this.consumeAtomBall(p);
        return;
      }
      for (let j = 0; j < this.errors.length; j++) {
        const e = this.errors[j];
        if (!e.active) continue;
        const dx = e.x - bx;
        const dy = e.y - by;
        const rr = ATOMIZE.ballRadius + CASCADING_ERROR.blockSize * 0.5;
        if (dx * dx + dy * dy > rr * rr) continue;
        const d = Math.hypot(dx, dy) || 1;
        this.damageError(e, ATOMIZE.ballDamage, p.slot, dx / d, dy / d);
        this.consumeAtomBall(p);
        return;
      }
      for (let j = 0; j < this.worms.length; j++) {
        const w = this.worms[j];
        if (!w.active) continue;
        let hit = false;
        let hx = w.x;
        let hy = w.y;
        let hr = WORM.headRadius;
        if ((w.x - bx) ** 2 + (w.y - by) ** 2 <= (ATOMIZE.ballRadius + hr) ** 2) {
          hit = true;
        } else {
          for (let s = 0; s < w.segCount; s++) {
            const rr = ATOMIZE.ballRadius + WORM.segmentRadius;
            if ((w.segX[s] - bx) ** 2 + (w.segY[s] - by) ** 2 > rr * rr) continue;
            hit = true;
            hx = w.segX[s];
            hy = w.segY[s];
            hr = WORM.segmentRadius;
            break;
          }
        }
        if (!hit) continue;
        const dx = hx - bx;
        const dy = hy - by;
        const d = Math.hypot(dx, dy) || 1;
        this.damageWorm(w, ATOMIZE.ballDamage, p.slot, dx / d, dy / d, ATOMIZE.ballKnockback);
        this.consumeAtomBall(p);
        return;
      }
    }
  }

  private consumeAtomBall(p: Player): void {
    p.atomBalls = Math.max(0, p.atomBalls - 1);
    p.atomFlashT = ATOMIZE.ballBlockFlash;
    this.emit(EV.DEFLECT, p.slot, p.x, p.y, 2);
  }

  /** Atomize's heavy: a moving orbit field, not a beam. The caster keeps their feet. */
  private startOrbitPower(p: Player): void {
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    if (!p.alive) return;
    p.energy = Math.max(0, p.energy - ATOMIZE.powerCost);
    p.orbitT = ATOMIZE.powerDuration;
    p.orbitDur = ATOMIZE.powerDuration;
    p.orbitDir = Math.cos(p.facing) < 0 ? -1 : 1;
    p.laserCd = 0;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    this.emit(EV.LASER, p.slot, p.x, p.y, p.facing);
  }

  /**
   * The orbit field: light shots and the small gauntlet bodies (sentries, viruses)
   * inside `ATOMIZE.powerGrab` are pulled onto a ring around the caster, spun, and
   * used as weapons. The caster moves freely; captured bodies follow the moving field.
   * Projectiles keep their old owner slot rewritten to the caster, so contact damage
   * is attributed to Atomize and the caster cannot be hit by their own orbit.
   */
  private tickOrbit(dt: number): void {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.orbitT <= 0) continue;
      if (!p.active || !p.alive) {
        p.orbitT = 0;
        p.orbitDur = 0;
        this.releaseOrbit(p.slot);
        continue;
      }
      p.orbitT = Math.max(0, p.orbitT - dt);
      if (p.orbitT <= 0) {
        p.orbitDur = 0;
        this.releaseOrbit(p.slot);
        p.laserCd = ATOMIZE.powerCooldown;
        continue;
      }
      this.captureOrbit(p);
      this.updateOrbit(p, dt);
    }
    this.releaseOrphanedOrbits();
  }

  private captureOrbit(p: Player): void {
    const grab2 = ATOMIZE.powerGrab * ATOMIZE.powerGrab;
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.orbOwner >= 0 || proj.owner === p.slot) continue;
      // Mines and traps are planted objects, and bombs detonate rather than orbit.
      if (proj.type === 1 || proj.type === 2 || proj.type === 8 || proj.type === 9) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > grab2) continue;
      if (this.lineBlocked(p.x, p.y, proj.x, proj.y)) continue;
      proj.orbOwner = p.slot;
      proj.owner = p.slot;
      // Hostile fire becomes a plain bolt on capture. A thrown homing missile would
      // otherwise retarget the caster the moment it leaves the field.
      if (proj.type === 3 || proj.type === 4) proj.type = 0;
      proj.orbA = Math.atan2(dy, dx);
      proj.orbR = Math.max(ATOMIZE.powerOrbit * 0.42, Math.min(ATOMIZE.powerOrbit * 1.25, Math.sqrt(d2)));
      proj.orbDir = p.orbitDir;
      proj.homing = false;
      proj.vx = 0;
      proj.vy = 0;
      proj.hitPlayers = 0;
      proj.hitWorms = 0;
      proj.hitViruses = 0;
      proj.hitErrors = 0;
      proj.hitSentries = 0;
      proj.hitDrone = false;
      proj.fuse = Math.max(proj.fuse, ATOMIZE.powerReleaseTtl);
    }

    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active || s.orbitOwner >= 0 || s.spawnT > 0) continue;
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > grab2) continue;
      if (this.lineBlocked(p.x, p.y, s.x, s.y)) continue;
      s.orbitOwner = p.slot;
      s.orbitA = Math.atan2(dy, dx);
      s.orbitR = Math.max(ATOMIZE.powerOrbit * 0.4, Math.min(ATOMIZE.powerGrab, Math.sqrt(d2)));
      s.orbitDir = p.orbitDir;
      s.orbitHitCd = 0;
      s.vx = 0;
      s.vy = 0;
      s.kx = 0;
      s.ky = 0;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || v.orbitOwner >= 0 || v.spawnT > 0) continue;
      const dx = v.x - p.x;
      const dy = v.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > grab2) continue;
      if (this.lineBlocked(p.x, p.y, v.x, v.y)) continue;
      v.orbitOwner = p.slot;
      v.orbitA = Math.atan2(dy, dx);
      v.orbitR = Math.max(ATOMIZE.powerOrbit * 0.4, Math.min(ATOMIZE.powerGrab, Math.sqrt(d2)));
      v.orbitDir = p.orbitDir;
      v.orbitHitCd = 0;
      v.vx = 0;
      v.vy = 0;
      v.kx = 0;
      v.ky = 0;
      v.contactCd = Math.max(v.contactCd, ATOMIZE.powerContactCooldown);
    }
  }

  private updateOrbit(p: Player, dt: number): void {
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.orbOwner !== p.slot) continue;
      const lane = (proj.serial % 5) / 4;
      const targetR = ATOMIZE.powerOrbit * (0.48 + 0.36 * lane);
      proj.orbR += (targetR - proj.orbR) * (1 - Math.exp(-ATOMIZE.powerPull * 2 * dt));
      proj.orbA += proj.orbDir * ATOMIZE.powerProjectileSpin * dt;
      proj.prevX = proj.x;
      proj.prevY = proj.y;
      proj.x = p.x + Math.cos(proj.orbA) * proj.orbR;
      proj.y = p.y + Math.sin(proj.orbA) * proj.orbR;
      const tangent = proj.orbA + proj.orbDir * (Math.PI / 2);
      proj.vx = Math.cos(tangent) * ATOMIZE.powerRelease;
      proj.vy = Math.sin(tangent) * ATOMIZE.powerRelease;
      if (this.orbitHitsCover(proj.x, proj.y, proj.radius)) {
        proj.active = false;
        this.emit(EV.BOUNCE, p.slot, proj.x, proj.y, 1);
        continue;
      }
      if (proj.active) this.projectileHits(proj);
      if (proj.active && this.mode === 'gauntlet') this.projectileHitsGauntlet(proj);
    }

    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active || s.orbitOwner !== p.slot) continue;
      const weight = ATOMIZE.sentryWeight[s.kind] ?? 1;
      s.orbitHitCd = Math.max(0, s.orbitHitCd - dt);
      s.orbitA += s.orbitDir * (ATOMIZE.powerSpin / weight) * dt;
      const targetR = ATOMIZE.powerOrbit * Math.max(0.62, Math.min(1.16, 0.82 + 0.28 / weight));
      s.orbitR += (targetR - s.orbitR) * (1 - Math.exp(-(ATOMIZE.powerPull / weight) * dt));
      s.prevX = s.x;
      s.prevY = s.y;
      s.x = p.x + Math.cos(s.orbitA) * s.orbitR;
      s.y = p.y + Math.sin(s.orbitA) * s.orbitR;
      s.vx = 0;
      s.vy = 0;
      s.kx = 0;
      s.ky = 0;
      if (s.orbitHitCd <= 0 && this.orbitHitsCover(s.x, s.y, s.radius)) {
        this.damageSentry(s, ATOMIZE.powerContactDamage, p.slot, 0, 0, 0);
        s.orbitA += Math.PI * 0.7;
        s.orbitR = Math.max(30, s.orbitR * 0.62);
        s.orbitDir = -s.orbitDir;
        s.orbitHitCd = ATOMIZE.powerContactCooldown;
        continue;
      }
      if (s.orbitHitCd <= 0) this.resolveOrbitBodyContacts(p, s, weight);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || v.orbitOwner !== p.slot) continue;
      const weight = ATOMIZE.virusWeight;
      v.orbitHitCd = Math.max(0, v.orbitHitCd - dt);
      v.orbitA += v.orbitDir * (ATOMIZE.powerSpin / weight) * dt;
      const targetR = ATOMIZE.powerOrbit * Math.max(0.62, Math.min(1.16, 0.82 + 0.28 / weight));
      v.orbitR += (targetR - v.orbitR) * (1 - Math.exp(-(ATOMIZE.powerPull / weight) * dt));
      v.prevX = v.x;
      v.prevY = v.y;
      v.x = p.x + Math.cos(v.orbitA) * v.orbitR;
      v.y = p.y + Math.sin(v.orbitA) * v.orbitR;
      v.vx = 0;
      v.vy = 0;
      v.kx = 0;
      v.ky = 0;
      if (v.orbitHitCd <= 0 && this.orbitHitsCover(v.x, v.y, v.radius)) {
        this.damageVirus(v, ATOMIZE.powerContactDamage, p.slot, 0, 0, 0);
        v.orbitA += Math.PI * 0.7;
        v.orbitR = Math.max(30, v.orbitR * 0.62);
        v.orbitDir = -v.orbitDir;
        v.orbitHitCd = ATOMIZE.powerContactCooldown;
        continue;
      }
      if (v.orbitHitCd <= 0) this.resolveOrbitBodyContacts(p, v, weight);
    }
  }

  /** Every body in an orbit is a projectile in its own right: it hurts what it hits. */
  private resolveOrbitBodyContacts(p: Player, body: Sentry | Virus, weight: number): void {
    const isSentry = (body as Sentry).kind !== undefined;
    const force = ATOMIZE.powerContactKnockback / weight;
    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.travelT > 0) continue;
      if (target.iframes > 0 || phased(target)) continue;
      const dx = target.x - body.x;
      const dy = target.y - body.y;
      const rr = body.radius + PLAYER.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.damagePlayer(target, ATOMIZE.powerContactDamage, p.slot, dx / d, dy / d, force);
      body.orbitHitCd = ATOMIZE.powerContactCooldown;
      if (isSentry) this.damageSentry(body as Sentry, ATOMIZE.powerContactDamage, p.slot, -dx / d, -dy / d, force * 0.3);
      else this.damageVirus(body as Virus, ATOMIZE.powerContactDamage, p.slot, -dx / d, -dy / d, force * 0.3);
      return;
    }
    // Sentries and viruses thrown into their own family still trade damage.
    for (let i = 0; i < this.sentries.length; i++) {
      const other = this.sentries[i];
      if (other === body || !other.active || other.orbitOwner >= 0) continue;
      const dx = other.x - body.x;
      const dy = other.y - body.y;
      const rr = other.radius + body.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.damageSentry(other, ATOMIZE.powerContactDamage, p.slot, dx / d, dy / d, force);
      body.orbitHitCd = ATOMIZE.powerContactCooldown;
      if (isSentry) this.damageSentry(body as Sentry, ATOMIZE.powerContactDamage, p.slot, -dx / d, -dy / d, force * 0.3);
      else this.damageVirus(body as Virus, ATOMIZE.powerContactDamage, p.slot, -dx / d, -dy / d, force * 0.3);
      return;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const other = this.viruses[i];
      if (other === body || !other.active || other.orbitOwner >= 0) continue;
      const dx = other.x - body.x;
      const dy = other.y - body.y;
      const rr = other.radius + body.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.damageVirus(other, ATOMIZE.powerContactDamage, p.slot, dx / d, dy / d, force);
      body.orbitHitCd = ATOMIZE.powerContactCooldown;
      if (isSentry) this.damageSentry(body as Sentry, ATOMIZE.powerContactDamage, p.slot, -dx / d, -dy / d, force * 0.3);
      else this.damageVirus(body as Virus, ATOMIZE.powerContactDamage, p.slot, -dx / d, -dy / d, force * 0.3);
      return;
    }
  }

  private orbitHitsCover(x: number, y: number, radius: number): boolean {
    for (let i = 0; i < this.arena.pillars.length; i++) {
      if (circleRect(x, y, radius, this.arena.pillars[i], hitScratch)) return true;
    }
    return false;
  }

  /** The field ending is a throw, not a fade: tangent plus a little randomness. */
  private releaseOrbit(owner: number): void {
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.orbOwner !== owner) continue;
      proj.orbOwner = -1;
      const angle = proj.orbA + proj.orbDir * (Math.PI / 2) + this.rng.range(-ATOMIZE.powerReleaseSpread, ATOMIZE.powerReleaseSpread);
      proj.vx = Math.cos(angle) * ATOMIZE.powerRelease;
      proj.vy = Math.sin(angle) * ATOMIZE.powerRelease;
      proj.fuse = ATOMIZE.powerReleaseTtl;
      proj.grace = 0;
      proj.prevX = proj.x;
      proj.prevY = proj.y;
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active || s.orbitOwner !== owner) continue;
      const weight = ATOMIZE.sentryWeight[s.kind] ?? 1;
      const angle = s.orbitA + s.orbitDir * (Math.PI / 2) + this.rng.range(-ATOMIZE.powerReleaseSpread, ATOMIZE.powerReleaseSpread);
      s.orbitOwner = -1;
      s.orbitHitCd = 0;
      s.kx = Math.cos(angle) * (ATOMIZE.powerThrow / weight);
      s.ky = Math.sin(angle) * (ATOMIZE.powerThrow / weight);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || v.orbitOwner !== owner) continue;
      const weight = ATOMIZE.virusWeight;
      const angle = v.orbitA + v.orbitDir * (Math.PI / 2) + this.rng.range(-ATOMIZE.powerReleaseSpread, ATOMIZE.powerReleaseSpread);
      v.orbitOwner = -1;
      v.orbitHitCd = 0;
      v.kx = Math.cos(angle) * (ATOMIZE.powerThrow / weight);
      v.ky = Math.sin(angle) * (ATOMIZE.powerThrow / weight);
    }
  }

  /** Deaths, round resets and pad rides can orphan a capture without the field ending. */
  private releaseOrphanedOrbits(): void {
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.orbOwner < 0) continue;
      const owner = this.players[proj.orbOwner];
      if (owner && owner.active && owner.alive && owner.orbitT > 0) continue;
      this.releaseOrbit(proj.orbOwner);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active || s.orbitOwner < 0) continue;
      const owner = this.players[s.orbitOwner];
      if (owner && owner.active && owner.alive && owner.orbitT > 0) continue;
      s.orbitOwner = -1;
      s.orbitHitCd = 0;
      s.kx = 0;
      s.ky = 0;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || v.orbitOwner < 0) continue;
      const owner = this.players[v.orbitOwner];
      if (owner && owner.active && owner.alive && owner.orbitT > 0) continue;
      v.orbitOwner = -1;
      v.orbitHitCd = 0;
      v.kx = 0;
      v.ky = 0;
    }
  }

  /**
   * Bad Lag's skill: burn a couple of seconds in fast-forward. This body, and only this
   * body, runs its movement, attack rate and every cooldown at 2.5x. The effect runs
   * on the real clock, so the skill has a fixed duration however many shots it fits.
   */
  private startFastForward(p: Player): void {
    p.fastT = BUFFER.fastTime;
    this.emit(EV.TIME_WARP, p.slot, p.x, p.y, 1);
  }

  /**
   * Bad Lag's power: an hourglass burst that dilates the room. Every other body and
   * every hostile projectile runs at 0.3x for five real seconds; the caster keeps
   * their own clock, so the window is theirs to spend.
   */
  private startTimeSlow(p: Player): void {
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    if (!p.alive) return;
    p.energy = Math.max(0, p.energy - BUFFER.slowCost);
    this.timeSlowT = BUFFER.slowTime;
    this.timeSlowOwner = p.slot;
    p.laserCd = BUFFER.slowCooldown;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    this.emit(EV.TIME_WARP, p.slot, p.x, p.y, 0);
  }

  /**
   * Kaboom's skill: one heavy shell thrown in an arc. It flies over cover, lands at
   * `lobRange`, and detonates on the landing frame or on the first body it meets.
   */
  private throwSkillBomb(p: Player): void {
    if (!p.alive) return;
    const speed = KABOOM.lobRange / KABOOM.lobTime;
    const fired = this.spawnProjectile(
      p,
      0,
      KABOOM.lobTime,
      speed,
      false,
      KABOOM.lobRadius,
      KABOOM.lobDamage,
      9,
      KABOOM.lobBlast,
      KABOOM.lobKnockback,
      KABOOM.lobTime,
    );
    if (!fired) {
      // Muzzle inside cover: hand the skill back instead of eating the button.
      p.bugCd = 0;
      p.energy = Math.min(PLAYER.energyMax, p.energy + BUG.cost);
      return;
    }
    this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
  }

  /**
   * Kaboom's power: five shells thrown as one short spray, left to right. Each shell
   * waits its turn at the muzzle (`launchDelay`), so the row reads as a continuous
   * string of bombs instead of five orbs appearing on the same frame.
   */
  private throwBombCluster(p: Player): void {
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    if (!p.alive) return;
    const count = KABOOM.clusterCount;
    let fired = 0;
    for (let i = 0; i < count; i++) {
      const lane = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
      if (this.spawnProjectile(
        p,
        lane * KABOOM.clusterSpread,
        KABOOM.clusterTime,
        KABOOM.clusterRange / KABOOM.clusterTime,
        false,
        KABOOM.clusterRadius,
        KABOOM.clusterDamage,
        9,
        KABOOM.clusterBlast,
        KABOOM.clusterKnockback,
        KABOOM.clusterTime,
        i * KABOOM.clusterStagger,
      )) fired++;
    }
    if (fired === 0) return;
    p.energy = Math.max(0, p.energy - KABOOM.clusterCost);
    p.laserCd = KABOOM.clusterCooldown;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    p.comboStage = 0;
    p.comboT = 0;
    this.emit(EV.LASER, p.slot, p.x, p.y, p.facing);
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
    proj.homing = false;
    proj.pathAxis = 0;
    proj.hitPlayers = 0;
    proj.hitWorms = 0;
    proj.hitViruses = 0;
    proj.hitErrors = 0;
    proj.hitSentries = 0;
    proj.hitDrone = false;
    proj.trailHead = 0;
    proj.trailCount = 0;
    proj.variant = 0;
    proj.orbOwner = -1;
    proj.orbA = 0;
    proj.orbR = 0;
    proj.orbDir = 1;
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
    proj.homing = false;
    proj.pathAxis = 0;
    proj.hitPlayers = 0;
    proj.hitWorms = 0;
    proj.hitViruses = 0;
    proj.hitErrors = 0;
    proj.hitSentries = 0;
    proj.hitDrone = false;
    proj.trailHead = 0;
    proj.trailCount = 0;
    proj.variant = 0;
    proj.orbOwner = -1;
    proj.orbA = 0;
    proj.orbR = 0;
    proj.orbDir = 1;
  }

  private spawnProjectile(
    p: Player,
    angleOffset = 0,
    ttl: number = BOLT.ttl,
    speed: number = BOLT.speed,
    homing = false,
    radius: number = BOLT.radius,
    damage: number = BOLT.damage,
    type: Projectile['type'] = 0,
    blastRadius = 0,
    blastKnockback = 0,
    arcDur = 0,
    launchDelay = 0,
    handOffset = 0,
  ): boolean {
    let proj: Projectile | null = null;
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) {
        proj = this.projectiles[i];
        break;
      }
    }
    if (!proj) return false;

    const angle = p.facing + angleOffset;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // Enemy-controlled kits (training/bot-match AI and the gauntlet thrall) shoot slower than a human.
    const aiOwned = p.thrall || (p.slot !== this.localSlot && (this.mode === 'training' || p.slot <= this.botSlots));
    const enemyScale = aiOwned ? BOLT.enemySpeedMult : 1;
    // A side arm offset puts Atomize's alternating shots on different hands without
    // changing any other program's muzzle. Positive is the avatar's right.
    const x = p.x + c * BOLT.spawnOffset - s * handOffset;
    const y = p.y + s * BOLT.spawnOffset + c * handOffset;
    for (let i = 0; i < this.arena.pillars.length; i++) {
      // A muzzle inside geometry would immediately ricochet back into the shooter.
      // Fail the shot instead of spawning a bolt that cannot escape.
      if (circleRect(x, y, radius, this.arena.pillars[i], hitScratch)) return false;
    }

    proj.active = true;
    proj.serial = ++this.serial;
    proj.type = type;
    proj.owner = p.slot;
    proj.x = x;
    proj.y = y;
    proj.prevX = x;
    proj.prevY = y;
    proj.vx = c * speed * enemyScale;
    proj.vy = s * speed * enemyScale;
    proj.radius = radius;
    proj.damage = damage;
    proj.deflects = 0;
    proj.bounces = 0;
    proj.fuse = ttl;
    proj.grace = launchDelay;
    proj.armed = false;
    proj.homing = homing;
    proj.pathAxis = 0;
    proj.hitPlayers = 0;
    proj.hitWorms = 0;
    proj.hitViruses = 0;
    proj.hitErrors = 0;
    proj.hitSentries = 0;
    proj.hitDrone = false;
    proj.blastRadius = blastRadius;
    proj.blastKnockback = blastKnockback;
    proj.arcDur = arcDur;
    proj.hits = 0;
    proj.spin = this.rng.range(0, Math.PI * 2);
    proj.spinDir = 1;
    // Atomize's electron cycles yellow, green, blue. Other shots keep variant 0.
    proj.variant = type === 11 ? (proj.serial - 1) % 3 : 0;
    proj.orbOwner = -1;
    proj.orbA = 0;
    proj.orbR = 0;
    proj.orbDir = 1;
    proj.trailHead = 0;
    proj.trailCount = 0;
    return true;
  }

  /** Held guard: a 180 degree screen in front of the avatar. Every shot in it returns. */
  private resolveGuard(p: Player): void {
    const nx = Math.cos(p.facing);
    const ny = Math.sin(p.facing);
    const whip = p.powerupT > 0 && p.powerupKind === POWERUP_KIND.WHIP;
    const whipMult = whip ? POWERUP.whipMultiplier : 1;
    for (let i = 0; i < this.projectiles.length; i++) {
      if (p.guardT <= 0) break;
      const proj = this.projectiles[i];
      if (!proj.active || proj.type === 1 || proj.type === 2 || proj.owner === p.slot) continue;
      // A shot held in an Atomize orbit is not in flight; it cannot be guarded.
      if (proj.orbOwner >= 0) continue;
      // Bombs are shells, not shots: a guard cannot send one back.
      if (proj.type === 8 || proj.type === 9) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > PLAYER.guardReach + proj.radius) continue;
      // Front half-plane only. A shot from behind still has to be dodged or turned into.
      if (dx * nx + dy * ny < -proj.radius) continue;
      const vn = proj.vx * nx + proj.vy * ny;
      if (vn >= 0) continue;
      const wasMissile = proj.type === 4;
      if (proj.type >= 3) proj.type = 0;
      proj.homing = false;
      const oldSpeed = Math.max(Math.hypot(proj.vx, proj.vy), wasMissile ? BOLT.speed : 0);
      const speed = Math.min(BOLT.maxSpeed, oldSpeed * BOLT.deflectMult);
      if (p.lockActive) {
        // Lock-on makes the shield a return-to-sender tool: nearly all of the
        // incoming angle is flattened toward the locked target.
        let off = Math.atan2(proj.vy, proj.vx) - p.facing;
        off = Math.atan2(Math.sin(off), Math.cos(off));
        const angle = p.facing + off * 0.02;
        proj.vx = Math.cos(angle) * speed;
        proj.vy = Math.sin(angle) * speed;
      } else {
        proj.vx -= 2 * vn * nx;
        proj.vy -= 2 * vn * ny;
        const mag = Math.hypot(proj.vx, proj.vy) || 1;
        proj.vx = (proj.vx / mag) * speed;
        proj.vy = (proj.vy / mag) * speed;
      }
      if (dist > 0.001) {
        proj.x = p.x + (dx / dist) * (PLAYER.guardReach + proj.radius + 1);
        proj.y = p.y + (dy / dist) * (PLAYER.guardReach + proj.radius + 1);
      }
      proj.owner = p.slot;
      proj.deflects++;
      proj.damage = (BOLT.damage + proj.deflects) * whipMult;
      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      p.swingHit = true;
      p.guardT = Math.max(0, p.guardT - PLAYER.guardReflectCost);
      if (p.guardT === 0) p.guardCd = PLAYER.guardCooldown;
      this.emit(EV.DEFLECT, p.slot, proj.x, proj.y, proj.deflects);
    }
  }

  private resolveSwing(p: Player): void {
    if (p.swingHit) return;
    const whip = p.powerupT > 0 && p.powerupKind === POWERUP_KIND.WHIP;
    const whipMult = whip ? POWERUP.whipMultiplier : 1;
    // The big third broom hit is a slab: it deflects along its whole drawn shaft.
    const reach = (p.program === PROGRAM_ID.SWEEP && p.swingKind === 3 ? SWEEP.bigReach : PLAYER.swingReach) * whipMult;
    const cos = Math.cos(p.swingFacing);
    const sin = Math.sin(p.swingFacing);
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.orbOwner >= 0) continue;
      if (proj.type === 8 || proj.type === 9) continue;
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
      proj.homing = false;
      const oldSpeed = Math.max(Math.hypot(proj.vx, proj.vy), wasMissile ? BOLT.speed : 0);
      // Catch it at the last moment for a straight return. Catching at the far edge
      // still reflects, but the racket clips it and sends it off at an angle.
      const contact = PLAYER.radius + proj.radius;
      const distanceEarly = Math.max(0, Math.min(1, (dist - contact) / Math.max(1, reach - contact)));
      // Timing is half the grade. A press at the very start of the active window still
      // catches the bolt, but sends it wide; a press near contact returns it straight.
      const timingEarly = Math.max(0, Math.min(1, p.swingT / PLAYER.swingActive));
      // The big broom is a flat slab: it returns the shot dead ahead instead of
      // grading the catch angle like the spiked lash.
      const early = p.swingKind === 3 ? 0 : Math.min(1, distanceEarly * 0.62 + timingEarly * 0.38);
      const returnAngle = p.swingFacing + (p.swingDir < 0 ? -1 : 1) * PLAYER.deflectMaxAngle * early;
      const speedScale = PLAYER.deflectEarlySpeed + (1 - PLAYER.deflectEarlySpeed) * (1 - early);
      const speed = Math.min(BOLT.maxSpeed, oldSpeed * BOLT.deflectMult * speedScale);
      proj.vx = Math.cos(returnAngle) * speed;
      proj.vy = Math.sin(returnAngle) * speed;
      proj.owner = p.slot;
      proj.deflects++;
      proj.damage = (BOLT.damage + proj.deflects) * whipMult;

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
      // A captured shot is driven by the orbit field, not by flight or its own fuse.
      if (proj.orbOwner >= 0) continue;
      proj.prevX = proj.x;
      proj.prevY = proj.y;

      // Time dilation: a hostile shot, or one fired by a slowed body, crawls with its
      // owner. The caster's own fire keeps full speed.
      const pdt =
        this.timeSlowT > 0 &&
        (proj.owner < 0 ? proj.type >= 3 : proj.owner !== this.timeSlowOwner)
          ? dt * BUFFER.slowScale
          : dt;

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

      if (proj.type === 8 || proj.type === 9) {
        // Bombs do not damage on touch: they detonate and the blast does the work, so
        // cover that cuts the blast cuts the damage too. The lobbed shell ignores
        // pillars in flight, because it is in the air until it lands.
        // A bomb can also wait its turn at the muzzle: the power's carpet is released
        // as a string, and the delay is carried in `grace` before the fuse starts.
        if (proj.grace > 0) {
          proj.grace = Math.max(0, proj.grace - pdt);
          continue;
        }
        proj.fuse -= pdt;
        if (proj.fuse <= 0) {
          this.detonateBomb(proj);
          continue;
        }
        const bombSpeed = Math.hypot(proj.vx, proj.vy);
        const bombSteps = Math.max(1, Math.min(20, Math.ceil((bombSpeed * pdt) / 6)));
        const bombDt = pdt / bombSteps;
        for (let s = 0; s < bombSteps; s++) {
          proj.x += proj.vx * bombDt;
          proj.y += proj.vy * bombDt;
          this.bounceWalls(proj);
          if (!proj.active) break;
          if (this.propHit(proj)) break;
          if (proj.type === 8) {
            this.bouncePillars(proj);
            if (!proj.active) break;
          }
          this.bounceBarriers(proj);
          if (!proj.active) break;
          this.netBlocksProjectile(proj);
          if (this.wallBlocksProjectile(proj)) break;
          if (this.bombTouchesBody(proj)) break;
        }
        if (!proj.active || this.bombTouchesBody(proj)) this.detonateBomb(proj);
        continue;
      }

      if (proj.grace > 0) proj.grace = Math.max(0, proj.grace - pdt);
      proj.fuse -= pdt;
      if (proj.fuse <= 0) {
        // It reached its own range, not a body or a wall. Leave a shard fizzle where
        // the shape ran out instead of blinking it off the field.
        this.emit(EV.DISSOLVE, proj.owner, proj.x, proj.y, proj.type);
        proj.active = false;
        continue;
      }

      // The hourglass spins on its own axis. Bodies reverse it: `hourglassStruck`
      // flips `spinDir`, so a hit visibly kicks the mark the other way.
      if (proj.type === 10) proj.spin += proj.spinDir * BUFFER.spinRate * pdt;

      // `homing` also flags Atomize's seeking ball, but only a plain bolt takes the
      // pathfinder powerup's right-angle search.
      if (proj.homing && proj.type === 0) this.steerPathBolt(proj);
      // Atomize's electron bends toward a target in front of it. The arc is the kit's
      // read, so the turn is limited and the original throw angle still matters.
      if (proj.type === 11 && proj.homing) this.steerAtomBolt(proj, pdt);

      // Hostile homing missile: slow, obvious, and turn-limited so a dash or cover beats it.
      if (proj.type === 4) {
        const target = this.players[0];
        // A cloak breaks the missile's lock; it flies on and has to be dodged or shot.
        if (target.alive && target.cloakT <= 0) {
          const desired = Math.atan2(target.y - proj.y, target.x - proj.x);
          let delta = desired - Math.atan2(proj.vy, proj.vx);
          delta = Math.atan2(Math.sin(delta), Math.cos(delta));
          const maxTurn = SENTRY.missileTurn * pdt;
          const angle = Math.atan2(proj.vy, proj.vx) + Math.max(-maxTurn, Math.min(maxTurn, delta));
          proj.vx = Math.cos(angle) * SENTRY.missileSpeed;
          proj.vy = Math.sin(angle) * SENTRY.missileSpeed;
        }
      }

      const speed = Math.hypot(proj.vx, proj.vy);
      const steps = Math.max(1, Math.min(20, Math.ceil((speed * pdt) / 6)));
      const sdt = pdt / steps;
      for (let s = 0; s < steps; s++) {
        proj.x += proj.vx * sdt;
        proj.y += proj.vy * sdt;
        this.bounceWalls(proj);
        if (!proj.active) break;
        if (this.propHit(proj)) break;
        this.bouncePillars(proj);
        if (!proj.active) break;
        this.bounceBarriers(proj);
        if (!proj.active) break;
        if (this.netBlocksProjectile(proj)) break;
        if (this.wallBlocksProjectile(proj)) break;
        if (this.projectileHits(proj)) break;
        if (this.mode === 'gauntlet' && this.projectileHitsGauntlet(proj)) break;
      }
    }
  }

  /**
   * Nearest target in the electron's forward cone, written into the shared scratch
   * fields. Cover blocks the seek, so an orb cannot curve through a wall.
   */
  private findAtomTarget(proj: Projectile): boolean {
    const aim = Math.atan2(proj.vy, proj.vx);
    const fx = Math.cos(aim);
    const fy = Math.sin(aim);
    const range2 = ATOMIZE.shotSeekRange * ATOMIZE.shotSeekRange;
    this.pathFound = false;
    this.pathBest2 = Infinity;
    const consider = (x: number, y: number): void => {
      const dx = x - proj.x;
      const dy = y - proj.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= range2 || d2 >= this.pathBest2) return;
      const d = Math.sqrt(d2) || 1;
      if ((dx * fx + dy * fy) / d < ATOMIZE.shotSeekDot) return;
      if (this.lineBlocked(proj.x, proj.y, x, y)) return;
      this.pathBest2 = d2;
      this.pathTargetX = x;
      this.pathTargetY = y;
      this.pathFound = true;
    };
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.slot === proj.owner || !p.active || !p.alive || phased(p)) continue;
      consider(p.x, p.y);
    }
    if (this.mode === 'training' && this.drone.active) consider(this.drone.x, this.drone.y);
    if (this.mode === 'gauntlet') {
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (w.active) consider(w.x, w.y);
      }
      for (let i = 0; i < this.viruses.length; i++) {
        const v = this.viruses[i];
        if (v.active) consider(v.x, v.y);
      }
      for (let i = 0; i < this.sentries.length; i++) {
        const s = this.sentries[i];
        if (s.active) consider(s.x, s.y);
      }
      for (let i = 0; i < this.errors.length; i++) {
        const e = this.errors[i];
        if (e.active) consider(e.x, e.y);
      }
    }
    return this.pathFound;
  }

  private steerAtomBolt(proj: Projectile, dt: number): void {
    if (!this.findAtomTarget(proj)) return;
    const desired = Math.atan2(this.pathTargetY - proj.y, this.pathTargetX - proj.x);
    const current = Math.atan2(proj.vy, proj.vx);
    let delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
    const maxTurn = ATOMIZE.shotTurn * dt;
    const angle = current + Math.max(-maxTurn, Math.min(maxTurn, delta));
    const speed = Math.hypot(proj.vx, proj.vy);
    proj.vx = Math.cos(angle) * speed;
    proj.vy = Math.sin(angle) * speed;
  }

  /** Writes the nearest valid target into the path scratch fields. */
  private considerPathTarget(proj: Projectile, x: number, y: number): void {
    const dx = x - proj.x;
    const dy = y - proj.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= this.pathBest2) return;
    this.pathBest2 = d2;
    this.pathTargetX = x;
    this.pathTargetY = y;
    this.pathFound = true;
  }

  private findPathTarget(proj: Projectile): boolean {
    this.pathFound = false;
    this.pathBest2 = Infinity;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (i === proj.owner || !p.active || !p.alive || phased(p)) continue;
      this.considerPathTarget(proj, p.x, p.y);
    }
    if (this.mode === 'training' && this.drone.active) {
      this.considerPathTarget(proj, this.drone.x, this.drone.y);
    }
    if (this.mode === 'gauntlet') {
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (w.active) this.considerPathTarget(proj, w.x, w.y);
      }
      for (let i = 0; i < this.viruses.length; i++) {
        const v = this.viruses[i];
        if (v.active) this.considerPathTarget(proj, v.x, v.y);
      }
      for (let i = 0; i < this.sentries.length; i++) {
        const s = this.sentries[i];
        if (s.active) this.considerPathTarget(proj, s.x, s.y);
      }
      for (let i = 0; i < this.errors.length; i++) {
        const e = this.errors[i];
        if (e.active) this.considerPathTarget(proj, e.x, e.y);
      }
    }
    return this.pathFound;
  }

  /**
   * Pathfinder bolts travel on one axis at a time. When the current axis is
   * aligned with the target, they take a right-angle turn onto the other one.
   */
  private steerPathBolt(proj: Projectile): void {
    if (!this.findPathTarget(proj)) return;
    const dx = this.pathTargetX - proj.x;
    const dy = this.pathTargetY - proj.y;
    const snap = POWERUP.pathAxisSnap;
    if (proj.pathAxis === 0 && Math.abs(dx) < snap) proj.pathAxis = 1;
    else if (proj.pathAxis === 1 && Math.abs(dy) < snap) proj.pathAxis = 0;
    const speed = Math.max(BOLT.speed * 0.8, Math.hypot(proj.vx, proj.vy));
    if (proj.pathAxis === 0) {
      proj.vx = (dx >= 0 ? 1 : -1) * speed;
      proj.vy = 0;
    } else {
      proj.vx = 0;
      proj.vy = (dy >= 0 ? 1 : -1) * speed;
    }
  }

  private bounceWalls(proj: Projectile): void {
    if (this.openWalls) {
      const b = this.arena.bounds;
      const r = proj.radius;
      if (proj.x > b.left + r && proj.x < b.right - r && proj.y > b.top + r && proj.y < b.bottom - r) return;
      // There is no wall to hit, so nothing ricochets: the shot falls into the void. A
      // committed shape keeps its geometry death, which is what makes a bomb detonate
      // at the lip instead of disappearing.
      if (proj.type === 5 || proj.type === 6 || proj.type === 8 || proj.type === 9 || proj.type === 10 || proj.type === 12) {
        this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 1);
      }
      proj.active = false;
      return;
    }
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
    if (proj.type === 5 || proj.type === 6 || proj.type === 8 || proj.type === 9 || proj.type === 10 || proj.type === 12) {
      // Spear, thrown broom, hourglass, Ghost's mouth and every bomb are committed
      // lines, not ricochets. They die on geometry; the bomb branch turns that into a
      // detonation.
      proj.active = false;
      this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 1);
      return;
    }
    if (proj.owner < 0 && proj.type >= 3) {
      // Low-tier hostile fire disperses on geometry. Bouncing is a stronger-enemy trait.
      proj.active = false;
      this.emit(EV.SENTRY_HIT, -1, proj.x, proj.y, 0, -proj.vx, -proj.vy);
      return;
    }
    this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 0);
    proj.armed = true;
    proj.bounces++;
    if (proj.bounces > BOLT.maxBounces) proj.active = false;
  }

  /** Deployed walls are real geometry: shots reflect off them like a pillar, and chip them. */
  private bounceBarriers(proj: Projectile): void {
    // The lobbed shell is airborne until it lands, so it clears a waist-high wall.
    if (proj.type === 9) return;
    for (let i = 0; i < this.barriers.length; i++) {
      const wall = this.barriers[i];
      if (!wall.active) continue;
      const vx = wall.x2 - wall.x1;
      const vy = wall.y2 - wall.y1;
      const len2 = vx * vx + vy * vy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((proj.x - wall.x1) * vx + (proj.y - wall.y1) * vy) / len2)) : 0;
      const px = wall.x1 + vx * t;
      const py = wall.y1 + vy * t;
      const dx = proj.x - px;
      const dy = proj.y - py;
      const rr = WEDGE.wallThickness * 0.5 + proj.radius;
      if (dx * dx + dy * dy > rr * rr) continue;

      const heavy = proj.type === 5 || proj.type === 6 || proj.type === 8 || proj.type === 10 || proj.type === 12;
      this.damageBarrier(wall, heavy ? 2 : 1);

      const side = (dx * wall.nx + dy * wall.ny) >= 0 ? 1 : -1;
      const nx = wall.nx * side;
      const ny = wall.ny * side;
      proj.x = px + nx * (rr + 0.5);
      proj.y = py + ny * (rr + 0.5);
      if (heavy) {
        proj.active = false;
        this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 1);
        return;
      }
      if (proj.owner < 0 && proj.type >= 3) {
        proj.active = false;
        this.emit(EV.SENTRY_HIT, -1, proj.x, proj.y, 0, nx, ny);
        return;
      }
      const vn = proj.vx * nx + proj.vy * ny;
      if (vn < 0) {
        proj.vx -= 2 * vn * nx;
        proj.vy -= 2 * vn * ny;
      }
      this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 0);
      proj.armed = true;
      proj.bounces++;
      if (proj.bounces > BOLT.maxBounces) proj.active = false;
      return;
    }
  }

  private bouncePillars(proj: Projectile): void {
    for (let i = 0; i < this.arena.pillars.length; i++) {
      if (!circleRect(proj.x, proj.y, proj.radius, this.arena.pillars[i], hitScratch)) continue;
      if (proj.type === 5 || proj.type === 6 || proj.type === 8 || proj.type === 10 || proj.type === 12) {
        proj.active = false;
        this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 1);
        return;
      }
      if (proj.owner < 0 && proj.type >= 3) {
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
      if (!p.active || !p.alive || p.iframes > 0 || phased(p)) continue;
      // Your own fire can never damage you, even after a wall bounce arms it.
      if (proj.owner === p.slot) continue;
      if (proj.type === 1 && proj.owner === p.slot && proj.grace > 0) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      const rr = proj.radius + PLAYER.radius;
      if (dx * dx + dy * dy > rr * rr) continue;

      if (proj.type === 1) {
        this.explodeMine(proj, proj.owner);
        return true;
      }
      // A hostile bolt has no owner slot, so it carries the sentry or drone that
      // fired it. Player shots are attributed by owner slot.
      const hitKind = proj.owner >= 0 ? SRC.PLAYER : proj.srcKind ?? SRC.NONE;
      const hitId = proj.owner >= 0 ? proj.owner : proj.srcId ?? -1;
      const speed = Math.hypot(proj.vx, proj.vy) || 1;
      if (proj.type === 5) {
        // Spear: damage each player once and keep travelling.
        const bit = 1 << p.slot;
        if ((proj.hitPlayers & bit) !== 0) continue;
        proj.hitPlayers |= bit;
        this.damagePlayer(p, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed, FISHER.spearKnockback, hitKind, hitId);
        continue;
      }
      if (proj.type === 6) {
        // Broom: a heavy throw, so it stops on the body and slides it well back.
        this.damagePlayer(p, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed, SWEEP.shotKnockback, hitKind, hitId);
        proj.active = false;
        return true;
      }
      if (proj.type === 7) {
        // Needle: light damage, then the venom keeps working.
        this.damagePlayer(p, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed, TOXIC.needleKnockback, hitKind, hitId);
        this.poisonPlayer(p, proj.owner);
        proj.active = false;
        return true;
      }
      if (proj.type === 12) {
        // Ghost's bite: a heavy, wide mouth. It stops on the body, hits for two and
        // leaves a short daze that slows the victim's feet and wobbles their read.
        this.damagePlayer(p, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed, GHOST.shotKnockback, hitKind, hitId);
        p.dazeT = Math.max(p.dazeT, GHOST.shotDaze);
        proj.active = false;
        return true;
      }
      if (proj.type === 10) {
        // Hourglass: one pass per body, shove it, flip the spin and keep flying. It
        // de-rezzes on the last allowed body, so it reads as a heavy chain, not a
        // piercing spear that crosses the whole room.
        const bit = 1 << p.slot;
        if ((proj.hitPlayers & bit) !== 0) continue;
        proj.hitPlayers |= bit;
        this.damagePlayer(p, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed, BUFFER.shotKnockback, hitKind, hitId);
        this.hourglassStruck(proj);
        if (!proj.active) return true;
        continue;
      }
      this.damagePlayer(p, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed, BOLT.knockback, hitKind, hitId);
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
          return true;
        } else if (proj.type === 5) {
          if (!proj.hitDrone) {
            proj.hitDrone = true;
            this.damageDrone(proj.damage, proj.owner);
          }
          return false;
        } else if (proj.type === 7) {
          this.damageDrone(proj.damage, proj.owner);
          this.poisonDrone(this.drone);
          proj.active = false;
          return true;
        } else {
          this.damageDrone(proj.damage, proj.owner);
          proj.active = false;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Open-wall arenas: the lip is the edge of the floor. A body whose centre crosses it
   * is gone, so a shove that carries someone over the line is a kill, not a nudge.
   */
  private checkFall(p: Player): void {
    const b = this.arena.bounds;
    const pastLip = p.x < b.left || p.x > b.right || p.y < b.top || p.y > b.bottom;
    // A dash is airborne, so a short hole can be jumped. Land inside one and the fall
    // starts then, which is the point of a hole.
    if (!pastLip && p.dashT > 0) return;
    if (!pastLip && !this.offFloor(p.x, p.y)) return;
    if (p.fallT > 0) return;
    p.fallT = FALL.grace;
    p.vx = 0;
    p.vy = 0;
    p.kx = 0;
    p.ky = 0;
  }

  /** Off the plate: past the lip, outside a trapezoid slant, or over a floor hole. */
  private offFloor(x: number, y: number): boolean {
    const b = this.arena.bounds;
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) return true;
    const slant = this.arena.slant;
    if (slant) {
      const k = (y - b.top) / (b.bottom - b.top);
      const inset = slant * (1 - Math.max(0, Math.min(1, k)));
      if (x < b.left + inset || x > b.right - inset) return true;
    }
    return this.inVoid(x, y);
  }

  private inVoid(x: number, y: number): boolean {
    return this.voidAt(x, y) !== null;
  }

  /** The hole under a point, or null. Returns the arena's rect, never a copy. */
  private voidAt(x: number, y: number): Rect | null {
    const voids = this.arena.voids;
    if (!voids) return null;
    for (let i = 0; i < voids.length; i++) {
      const r = voids[i];
      if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return r;
    }
    return null;
  }

  private fallPlayer(p: Player): void {
    if (!p.alive || p.travelT > 0) return;
    // Invulnerability does not buy a floor: a dash or a hit-stun cannot save the body.
    // The kill reuses the ordinary death path, so rounds, scores and the campaign fail
    // all behave exactly as they do for a normal hit.
    p.iframes = 0;
    p.ghostT = 0;
    p.cloakT = 0;
    p.scareT = 0;
    p.hp = 1;
    p.kx = 0;
    p.ky = 0;
    this.damagePlayer(p, 1, -1, 0, -1, 0, SRC.VOID, -1);
    p.kx = 0;
    p.ky = 0;
  }

  /**
   * A file box takes one hit and cracks, two and it de-rezzes into shards. Boxes are
   * floor debris: bodies step over them, shots and lashes stop on them.
   */
  private damageProp(b: Prop, amount: number, x: number, y: number): void {
    if (!b.active) return;
    b.hp -= amount;
    b.hitFlash = FILE_PROP.hitFlash;
    this.emit(EV.PROP_HIT, 0, x, y, amount);
    if (b.hp > 0) return;
    b.active = false;
    this.emit(EV.PROP_BREAK, 0, b.x + b.w * 0.5, b.y + b.h * 0.5, b.w + b.h * 0.5);
  }

  /** Shots stop on a file box and chip it. Returns true when the projectile was spent. */
  private propHit(proj: Projectile): boolean {
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.active || b.dropT > 0) continue;
      if (!circleRect(proj.x, proj.y, proj.radius, b, hitScratch)) continue;
      this.launchProp(b, proj.vx, proj.vy, FILE_PROP.shotPush);
      this.damageProp(b, Math.max(1, proj.damage), proj.x, proj.y);
      proj.active = false;
      return true;
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
    sourceKind: number = SRC.PLAYER,
    sourceId = -1,
  ): void {
    if (!p.alive || p.iframes > 0 || phased(p) || p.travelT > 0) return;
    // Atomize spends one shield ball per real hit, before health or campaign damage is
    // recorded. A chip tick (venom) is not a hit, and the floor is never shielded.
    if (p.atomBalls > 0 && amount >= 1 && sourceKind !== SRC.VOID) {
      p.atomBalls--;
      p.atomFlashT = ATOMIZE.ballBlockFlash;
      p.kx += dirX * force * 0.25;
      p.ky += dirY * force * 0.25;
      this.emit(EV.DEFLECT, p.slot, p.x, p.y, 2);
      return;
    }
    if (this.campaign && p.slot === this.localSlot) this.campaignDamage += amount;
    // The death camera reads this: who last touched the body, by family and pool index.
    p.killerKind = sourceKind;
    p.killerId = sourceId >= 0 ? sourceId : sourceSlot;
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
      // A web still being drawn is dropped with the body; an in-flight one stays.
      this.releaseNetDraft(p);
      p.wedgeT = 0;
      p.bashT = 0;
      p.broT = 0;
      p.broRevealT = 0;
      p.fanT = 0;
      p.orbitT = 0;
      p.orbitDur = 0;
      p.atomBalls = 0;
      p.atomFlashT = 0;
      p.cloakT = 0;
      p.scareT = 0;
      p.swingKind = 0;
      p.stringLeft = 0;
      p.stringT = 0;
      p.comboStage = 0;
      p.comboT = 0;
      p.lockActive = false;
      p.lockKind = 0;
      p.lockId = -1;
      if (this.campaign) {
        // Drill bots are sparring partners, not threat kills; they log back in.
        if (p.slot > 0) {
          p.respawnT = TRAINING.playerRespawn;
          this.emit(EV.ELIMINATED, sourceSlot, p.x, p.y, p.slot);
          return;
        }
        if (this.campaignPhase === 'assault') {
          this.campaignPhase = 'failed';
          this.campaignBannerKind = 3;
          this.campaignBannerT = CAMPAIGN.failBannerTime;
          this.campaignBannerDur = CAMPAIGN.failBannerTime;
          this.gauntletOver = true;
          this.emit(EV.ELIMINATED, sourceSlot, p.x, p.y, p.slot);
          return;
        }
        // Drill knockdown: the body waits out the training timer and comes back.
        p.respawnT = TRAINING.playerRespawn;
        this.emit(EV.ELIMINATED, sourceSlot, p.x, p.y, p.slot);
        return;
      }
      if (this.mode === 'gauntlet' && p.slot > 0) {
        if (this.attractMode && p.slot < this.attractSquad) {
          p.respawnT = TRAINING.playerRespawn;
          this.emit(EV.ELIMINATED, sourceSlot, p.x, p.y, p.slot);
          return;
        }
        p.active = false;
        p.thrall = false;
        this.gauntletKills++;
        this.dropPickupFromKill(p.x, p.y, true);
        this.emit(EV.ELIMINATED, sourceSlot, p.x, p.y, p.slot);
        return;
      }
      if (this.mode === 'gauntlet' && !this.gauntletPractice && p.slot === 0) {
        this.gauntletOver = true;
        p.respawnT = 0;
        this.emit(EV.ELIMINATED, sourceSlot, p.x, p.y, p.slot);
        return;
      }
      if (this.mode === 'training' && p.slot > 0) {
        this.dropPickupFromKill(p.x, p.y, false);
      }
      p.respawnT = this.mode === 'gauntlet' ? GAUNTLET.playerRespawn : TRAINING.playerRespawn;
      this.emit(EV.ELIMINATED, sourceSlot, p.x, p.y, p.slot);
    }
  }

  private respawnTrainingPlayer(p: Player): void {
    let sx = this.spawnX[p.slot];
    let sy = this.spawnY[p.slot];
    // A drill partner comes back on the sparring arc, not across the arena.
    if (this.campaign && this.campaignPhase === 'drill' && p.slot > 0) {
      this.drillSlotPos(p.slot - 1, this.players[0]);
      sx = this.spawnTmpX[p.slot - 1];
      sy = this.spawnTmpY[p.slot - 1];
    }
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
      if (p.slot === proj.owner || !p.active || !p.alive || p.iframes > 0 || phased(p)) continue;
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
      if (p.slot === proj.owner || !p.active || !p.alive || p.iframes > 0 || phased(p)) continue;
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
      if (p.slot === proj.owner || !p.active || !p.alive || phased(p)) continue;
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

  /**
   * One blast, shared by mines and bombs. Cover is real: a body behind a pillar takes
   * nothing, which is why a lobbed bomb landing behind cover does not clear it.
   */
  private explodeBlast(
    x: number,
    y: number,
    radius: number,
    damage: number,
    sourceSlot: number,
    knockback: number,
  ): void {
    this.emit(EV.EXPLODE, sourceSlot, x, y, radius);

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.slot === sourceSlot) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + PLAYER.radius) continue;
      if (this.lineBlocked(x, y, p.x, p.y)) continue;
      const nx = dist > 0.001 ? dx / dist : 1;
      const ny = dist > 0.001 ? dy / dist : 0;
      const falloff = 1 - 0.6 * Math.min(1, dist / radius);
      this.damagePlayer(p, damage, sourceSlot, nx, ny, knockback * falloff);
    }

    if (this.mode === 'training' && this.drone.active) {
      const dist = Math.hypot(this.drone.x - x, this.drone.y - y);
      if (dist <= radius + this.drone.radius && !this.lineBlocked(x, y, this.drone.x, this.drone.y)) {
        this.damageDrone(damage, sourceSlot);
      }
    }

    if (this.mode === 'gauntlet' && sourceSlot !== 1) {
      for (let i = 0; i < this.sentries.length; i++) {
        const s = this.sentries[i];
        if (!s.active) continue;
        const dx = s.x - x;
        const dy = s.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist > radius + s.radius) continue;
        if (this.lineBlocked(x, y, s.x, s.y)) continue;
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        this.damageSentry(s, damage, sourceSlot, nx, ny);
      }
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (!w.active) continue;
        const dx = w.x - x;
        const dy = w.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist > radius + WORM.headRadius) continue;
        if (this.lineBlocked(x, y, w.x, w.y)) continue;
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        this.damageWorm(w, damage, sourceSlot, nx, ny);
      }
      for (let i = 0; i < this.viruses.length; i++) {
        const v = this.viruses[i];
        if (!v.active) continue;
        const dx = v.x - x;
        const dy = v.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist > radius + v.radius) continue;
        if (this.lineBlocked(x, y, v.x, v.y)) continue;
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        this.damageVirus(v, damage, sourceSlot, nx, ny);
      }
      for (let i = 0; i < this.errors.length; i++) {
        const e = this.errors[i];
        if (!e.active) continue;
        const blockR = CASCADING_ERROR.blockSize * 0.5;
        const dx = e.x - x;
        const dy = e.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist > radius + blockR) continue;
        if (this.lineBlocked(x, y, e.x, e.y)) continue;
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        this.damageError(e, damage, sourceSlot, nx, ny);
      }
    }

    // A deployed wall is solid to a blast as well. It is the one destructible object that
    // a bomb reliably breaks, because the whole radius lands on the same segment.
    for (let i = 0; i < this.barriers.length; i++) {
      const wall = this.barriers[i];
      if (!wall.active) continue;
      const vx = wall.x2 - wall.x1;
      const vy = wall.y2 - wall.y1;
      const len2 = vx * vx + vy * vy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - wall.x1) * vx + (y - wall.y1) * vy) / len2)) : 0;
      const dx = x - (wall.x1 + vx * t);
      const dy = y - (wall.y1 + vy * t);
      const rr = radius + WEDGE.wallThickness * 0.5;
      if (dx * dx + dy * dy > rr * rr) continue;
      this.damageBarrier(wall, 2);
    }

    // Loose file boxes catch the blast: they crack and get thrown, they do not vanish.
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.active || b.dropT > 0) continue;
      const bx = b.x + b.w * 0.5;
      const by = b.y + b.h * 0.5;
      const dx = bx - x;
      const dy = by - y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + Math.max(b.w, b.h) * 0.5) continue;
      const nx = dist > 0.001 ? dx / dist : 1;
      const ny = dist > 0.001 ? dy / dist : 0;
      this.launchProp(b, nx, ny, FILE_PROP.launchSpeed * 0.8);
      this.damageProp(b, 1, bx, by);
    }
  }

  private explodeMine(proj: Projectile, sourceSlot: number): void {
    if (!proj.active) return;
    proj.active = false;
    this.explodeBlast(proj.x, proj.y, MINE.blastRadius, MINE.blastDamage, sourceSlot, MINE.knockback);
  }

  /** A bomb shell carries its own blast; a second call on the same shell does nothing. */
  private detonateBomb(proj: Projectile): void {
    const radius = proj.blastRadius;
    if (radius <= 0) return;
    const damage = proj.damage;
    const knockback = proj.blastKnockback;
    const owner = proj.owner;
    const x = proj.x;
    const y = proj.y;
    proj.active = false;
    proj.blastRadius = 0;
    this.explodeBlast(x, y, radius, damage, owner, knockback);
  }

  /**
   * Touch test for bombs. It does no damage: a bomb only needs to know that it has
   * arrived so the blast can resolve once against everything in radius.
   */
  private bombTouchesBody(proj: Projectile): boolean {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.slot === proj.owner || p.iframes > 0 || phased(p)) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      const rr = proj.radius + PLAYER.radius;
      if (dx * dx + dy * dy <= rr * rr) return true;
    }
    if (this.mode === 'training' && this.drone.active) {
      const dx = proj.x - this.drone.x;
      const dy = proj.y - this.drone.y;
      const rr = proj.radius + this.drone.radius;
      if (dx * dx + dy * dy <= rr * rr) return true;
    }
    if (this.mode !== 'gauntlet' || proj.owner === 1) return false;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const dx = proj.x - s.x;
      const dy = proj.y - s.y;
      const rr = proj.radius + s.radius;
      if (dx * dx + dy * dy <= rr * rr) return true;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const dx = proj.x - v.x;
      const dy = proj.y - v.y;
      const rr = proj.radius + v.radius;
      if (dx * dx + dy * dy <= rr * rr) return true;
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const dx = proj.x - e.x;
      const dy = proj.y - e.y;
      const rr = proj.radius + CASCADING_ERROR.blockSize * 0.5;
      if (dx * dx + dy * dy <= rr * rr) return true;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const hdx = proj.x - w.x;
      const hdy = proj.y - w.y;
      const hr = proj.radius + WORM.headRadius;
      if (hdx * hdx + hdy * hdy <= hr * hr) return true;
      for (let s = 0; s < w.segCount; s++) {
        const sdx = proj.x - w.segX[s];
        const sdy = proj.y - w.segY[s];
        const sr = proj.radius + WORM.segmentRadius;
        if (sdx * sdx + sdy * sdy <= sr * sr) return true;
      }
    }
    return false;
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
    // Bot practice replaces the sparring drone; a second body in the room means the
    // drone stays gone instead of respawning behind the bots.
    let activePlayers = 0;
    for (let i = 0; i < this.players.length; i++) if (this.players[i].active) activePlayers++;
    if (activePlayers > 1) return;
    const d = this.drone;
    if (!d.active) {
      d.respawnT -= dt;
      if (d.respawnT <= 0) this.spawnDrone(false);
      return;
    }
    this.tickDronePoison(d, dt);
    d.prevX = d.x;
    d.prevY = d.y;
    d.rot += dt * 1.5;
    if (d.hitFlash > 0) d.hitFlash = Math.max(0, d.hitFlash - dt);
    // Caught in Fisher's web: no drift, no shots, until the web expires.
    if (d.netPinT > 0) {
      d.netPinT = Math.max(0, d.netPinT - dt);
      d.vx = 0;
      d.vy = 0;
      return;
    }

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
    for (let i = 0; i < this.solids.length; i++) {
      if (circleRect(d.x, d.y, d.radius, this.solids[i], hitScratch)) {
        d.x = hitScratch.px;
        d.y = hitScratch.py;
        this.pickDroneTarget();
      }
    }

    d.fireTimer -= dt;
    if (d.fireTimer <= 0) {
      const target = this.players[0];
      if (target && target.alive && target.cloakT <= 0) {
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
      for (let i = 0; i < this.solids.length; i++) {
        const rect = this.solids[i];
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
    d.netPinT = 0;
    this.pickDroneTarget();
    const initialSpawn = this.arena.spawns[2];
    // pickDroneTarget already chose a point clear of cover and floor gaps, so respawns
    // use it instead of a raw random point that could land in a trench.
    d.x = initial ? initialSpawn.x : d.targetX;
    d.y = initial ? initialSpawn.y : d.targetY;
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
    proj.srcKind = SRC.DRONE;
    proj.srcId = 0;
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
    proj.homing = false;
    proj.pathAxis = 0;
    proj.trailHead = 0;
    proj.trailCount = 0;
    proj.variant = 0;
    proj.orbOwner = -1;
    proj.orbA = 0;
    proj.orbR = 0;
    proj.orbDir = 1;
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
    if (!t.active || !t.alive || !t.thrall || !target.alive || target.cloakT > 0) return;

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

  /**
   * Pickup loop. Definitions and weights live in powerups.ts; this only owns placement,
   * collection, and the duration timer. Adding content should not require touching it.
   */
  private updatePickups(dt: number): void {
    const p = this.players[0];
    this.powerupSpawnT -= dt;
    if (this.powerupDropT > 0) this.powerupDropT = Math.max(0, this.powerupDropT - dt);
    let activeCount = 0;
    for (let i = 0; i < this.pickups.length; i++) if (this.pickups[i].active) activeCount++;
    if (activeCount < POWERUP.maxActive && this.powerupSpawnT <= 0 && p.alive) {
      this.spawnPickup(p.x, p.y, POWERUP.spawnRadiusMin, POWERUP.spawnRadiusMax);
      this.powerupSpawnT = POWERUP.spawnInterval;
    }

    for (let i = 0; i < this.pickups.length; i++) {
      const pickup = this.pickups[i];
      if (!pickup.active) continue;
      pickup.phase += dt;
      pickup.life -= dt;
      if (pickup.life <= 0) {
        pickup.active = false;
        continue;
      }
      for (let s = 0; s < this.players.length; s++) {
        const target = this.players[s];
        if (!target.active || !target.alive) continue;
        const dx = target.x - pickup.x;
        const dy = target.y - pickup.y;
        const rr = PLAYER.radius + POWERUP.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        pickup.active = false;
        this.collectPickup(target, pickup);
        break;
      }
    }
  }

  private spawnPickup(originX: number, originY: number, minDist: number, maxDist: number): void {
    let slot: Pickup | null = null;
    for (let i = 0; i < this.pickups.length; i++) {
      if (!this.pickups[i].active) {
        slot = this.pickups[i];
        break;
      }
    }
    if (!slot) return;
    const pad = POWERUP.pickupPadding;
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const dist = this.rng.range(minDist, maxDist);
      const x = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, originX + Math.cos(angle) * dist));
      const y = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, originY + Math.sin(angle) * dist));
      let blocked = false;
      for (let i = 0; i < this.solids.length; i++) {
        if (circleRect(x, y, POWERUP.radius + 6, this.solids[i], hitScratch)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const def = rollPowerup(this.rng.next());
      slot.active = true;
      slot.kind = def.kind;
      slot.x = x;
      slot.y = y;
      slot.phase = this.rng.range(0, Math.PI * 2);
      slot.life = POWERUP.life;
      return;
    }
  }

  /** Kill drops are the main pickup faucet. Ambient spawns are only a safety net. */
  private dropPickupFromKill(x: number, y: number, elite: boolean): void {
    if (this.mode !== 'gauntlet' && this.mode !== 'training') return;
    if (this.powerupDropT > 0) return;
    let activeCount = 0;
    for (let i = 0; i < this.pickups.length; i++) if (this.pickups[i].active) activeCount++;
    if (activeCount >= POWERUP.maxActive) return;
    const chance = elite ? POWERUP.eliteDropChance : POWERUP.dropChance;
    if (this.rng.next() > chance) return;
    this.spawnPickup(x, y, POWERUP.dropRadiusMin, POWERUP.dropRadiusMax);
    this.powerupDropT = POWERUP.dropCooldown;
  }

  private collectPickup(p: Player, pickup: Pickup): void {
    const def = powerupDef(pickup.kind);
    if (isTimedPowerup(pickup.kind)) {
      if (p.powerupKind === POWERUP_KIND.OVERCHARGE && p.laserT > 0) {
        p.laserT = 0;
        p.laserTickT = 0;
      }
      p.powerupKind = pickup.kind;
      p.powerupT = def.duration;
      p.autoFireT = 0;
    } else {
      const before = p.hp;
      p.hp = p.maxHp;
      p.slowT = 0;
      if (this.mode === 'gauntlet') this.infection = 0;
      this.emit(EV.HEAL, p.slot, p.x, p.y, Math.max(0, p.hp - before));
    }
    this.emit(EV.POWERUP, p.slot, pickup.x, pickup.y, pickup.kind);
  }

  /**
   * Attract-mode setup: jump the endless sandbox to a deep wave and land one of each
   * threat family so the demo opens on a live fight instead of an empty room. This is
   * presentation only; it is never used by a scored run, a campaign node or a hosted
   * match, and it does not touch the run record.
   */
  seedAttractRun(wave: number): void {
    if (this.mode !== 'gauntlet' || this.campaign) return;
    const target = Math.max(GAUNTLET.wormWave, Math.floor(wave));
    this.gauntletT = (target - 1) * GAUNTLET.waveDuration + 1;
    this.wave = target;
    this.waveBannerT = 0;
    this.attractMode = true;
    this.attractRefillT = ATTRACT.refill;
    // Fill the room to the live caps. A single opening pack reads as an empty level on
    // a wide arena, and the demo exists to show the fight, not the walk to it.
    this.fillAttractRoom();
    this.spawnErrorColony();
    for (let i = 1; i < this.errorLimit(); i++) this.growError();
    // Leave the next normal drops a beat away, so the demo does not double up on frame one.
    this.sentrySpawnT = SENTRY.interval * 0.6;
    this.wormSpawnT = GAUNTLET.wormInterval * 0.7;
    this.virusSpawnT = GAUNTLET.virusInterval * 0.7;
    this.errorSpawnT = CASCADING_ERROR.reseedDelay;
  }

  /**
   * Kiosk only: open 1-3 local squad bodies on the same screen. `setupGauntlet` parks
   * extra slots because a scored run is solo; the display loop reintroduces them here
   * as a tight cluster around the leader so the camera does not split them. Their
   * brains are ordinary local BotBrains, driven by main.ts.
   */
  seedAttractSquad(count: number): void {
    if (this.mode !== 'gauntlet' || this.campaign) return;
    const n = Math.max(1, Math.min(3, Math.floor(count)));
    this.attractSquad = n;
    if (n <= 1) return;
    const leader = this.players[0];
    const base = Math.atan2(this.centerY - leader.y, this.centerX - leader.x);
    const px = -Math.sin(base);
    const py = Math.cos(base);
    const b = this.arena.bounds;
    for (let i = 1; i < n; i++) {
      const p = this.players[i];
      p.active = true;
      p.connected = true;
      p.thrall = false;
      const side = i % 2 === 0 ? -1 : 1;
      const rank = Math.ceil(i / 2);
      let sx = leader.x + px * side * rank * 62 + Math.cos(base) * 26;
      let sy = leader.y + py * side * rank * 62 + Math.sin(base) * 26;
      sx = Math.max(b.left + PLAYER.radius + 16, Math.min(b.right - PLAYER.radius - 16, sx));
      sy = Math.max(b.top + 24, Math.min(b.bottom - 24, sy));
      if (!this.pointClearOfCover(sx, sy, PLAYER.radius + 6)) {
        sx = leader.x + Math.cos(base) * (34 + rank * 56);
        sy = leader.y + Math.sin(base) * (34 + rank * 56);
      }
      if (!this.pointClearOfCover(sx, sy, PLAYER.radius + 6)) {
        sx = leader.x;
        sy = leader.y;
      }
      this.spawnX[i] = sx;
      this.spawnY[i] = sy;
      clearPlayerForSpawn(p, sx, sy, base);
    }
  }

  /**
   * Demo-only top-up: fills sentries, worms and viruses to the current wave caps around
   * the local player, in the camera window. Reuses the normal spawn paths so the demo
   * still shows assembly, sound and the ordinary threat simulation.
   */
  private fillAttractRoom(): void {
    const p = this.players[0];
    if (!p || !p.active || !p.alive) return;

    let sentries = 0;
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) sentries++;
    let guard = 0;
    while (sentries < this.sentryLimit() && guard++ < 20) {
      const angle = this.rng.range(0, Math.PI * 2);
      const dist = this.rng.range(260, 460);
      const kind = (this.rng.next() * 3) | 0;
      // A failed anchor is usually a chasm or a packed corner; try another angle
      // instead of giving up on the whole pack.
      if (this.spawnSentry(kind as 0 | 1 | 2 | 3, p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist * 0.62)) sentries++;
    }

    let worms = 0;
    for (let i = 0; i < this.worms.length; i++) if (this.worms[i].active) worms++;
    guard = 0;
    while (worms < this.wormLimit() && guard++ < 4) {
      this.spawnWorm();
      worms++;
    }

    let viruses = 0;
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) viruses++;
    guard = 0;
    while (viruses < this.virusLimit() && guard++ < 16) {
      const angle = this.rng.range(0, Math.PI * 2);
      const dist = this.rng.range(230, 470);
      if (this.spawnVirus(p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist)) viruses++;
    }
  }

  private updateGauntlet(dt: number): void {
    this.gauntletT += dt;
    // A campaign node runs a short, authored ramp instead of the endless sandbox wave.
    const nextWave = this.campaign
      ? CAMPAIGN.waveStart + Math.floor(this.campaignT / CAMPAIGN.waveSeconds)
      : 1 + Math.floor(this.gauntletT / GAUNTLET.waveDuration);
    if (nextWave !== this.wave) {
      this.wave = nextWave;
      this.waveBannerT = 2.4;
      // Waves tighten the timers; they do not force a synchronized burst of every threat.
      // Keeping the existing countdowns prevents a wall of silhouettes landing together.
    }
    if (this.waveBannerT > 0) this.waveBannerT = Math.max(0, this.waveBannerT - dt);
    this.infection = Math.max(0, this.infection - GAUNTLET.infectionDecay * dt);

    // Attract demo only: keep the room at the live caps. A normal run earns its density
    // from the wave timers; the demo has no player to pace against and would thin out.
    if (this.attractMode) {
      this.attractRefillT -= dt;
      if (this.attractRefillT <= 0) {
        this.attractRefillT = ATTRACT.refill;
        this.fillAttractRoom();
      }
    }

    if (this.wave >= GAUNTLET.wormWave) {
      let wormCount = 0;
      for (let i = 0; i < this.worms.length; i++) if (this.worms[i].active) wormCount++;
      if (wormCount < this.wormLimit()) {
        this.wormSpawnT -= dt;
        if (this.wormSpawnT <= 0) {
          this.spawnWorm();
          this.wormSpawnT = this.campaign
            ? CAMPAIGN.wormInterval
            : this.gauntletInterval(GAUNTLET.wormInterval, GAUNTLET.wormMinInterval);
        }
      }
    }

    if (this.wave >= GAUNTLET.virusWave) {
      let virusCount = 0;
      for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) virusCount++;
      if (virusCount === 0) {
        // The first cluster waits the full unlock delay. A retry after a wipe is short.
        if (this.virusSeeded && this.virusSpawnT > GAUNTLET.virusRetry) {
          this.virusSpawnT = GAUNTLET.virusRetry;
        }
        this.virusSpawnT -= dt;
        if (this.virusSpawnT <= 0) {
          this.spawnVirusCluster();
          this.virusSeeded = true;
          this.virusSpawnT = this.gauntletInterval(GAUNTLET.virusInterval, GAUNTLET.virusMinInterval);
          virusCount = this.virusClusterCount();
        }
      }

      this.virusSplitT -= dt;
      if (this.virusSplitT <= 0) {
        this.virusSplitT = this.gauntletInterval(VIRUS.splitInterval, VIRUS.splitMinInterval);
        if (virusCount < this.virusLimit()) this.splitVirus();
      }
    }

    this.drainSentryQueue(dt);
    let sentryCount = 0;
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) sentryCount++;
    if (sentryCount < this.sentryLimit() && this.sentryQueueCount === 0) {
      this.sentrySpawnT -= dt;
      if (this.sentrySpawnT <= 0) {
        this.spawnSentryPack();
        const nextInterval =
          !this.gauntletPractice && this.wave <= SENTRY.openingWaves
            ? SENTRY.openingInterval
            : SENTRY.interval;
        this.sentrySpawnT = this.campaign
          ? CAMPAIGN.sentryInterval
          : this.gauntletInterval(nextInterval, SENTRY.minInterval);
      }
    }

    // Firewalls are off until a destructible switch wakes one. The beam is a set-piece,
    // not ambient pressure on every wave.
    if (GAUNTLET.autoFirewalls) {
      let firewallCount = 0;
      for (let i = 0; i < this.firewalls.length; i++) if (this.firewalls[i].active) firewallCount++;
      if (firewallCount < GAUNTLET.maxFirewalls) {
        this.firewallSpawnT -= dt;
        if (this.firewallSpawnT <= 0) {
          this.spawnFirewall();
          this.firewallSpawnT = GAUNTLET.firewallInterval;
        }
      }
    }

    for (let i = 0; i < this.worms.length; i++) if (this.worms[i].active) this.updateWorm(this.worms[i], dt);
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) this.updateVirus(this.viruses[i], dt);
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) this.updateSentry(this.sentries[i], dt);
    for (let i = 0; i < this.firewalls.length; i++) if (this.firewalls[i].active) this.updateFirewall(this.firewalls[i], dt);
    this.updateErrors(dt);
    if (this.openWalls || this.arena.voids) this.cullVoidThreats();
  }

  /**
   * A threat carried over the lip is deleted by the drop. The kill goes through the
   * normal damage path so it still counts toward the clear, drops its pickup and fires
   * the same de-rez burst as a projectile kill.
   */
  private cullVoidThreats(): void {
    const b = this.arena.bounds;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      if (this.offFloor(w.x, w.y)) this.damageWorm(w, 9999, 0, 0, 0);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      if (this.offFloor(v.x, v.y)) this.damageVirus(v, 9999, 0, 0, 0);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      if (this.offFloor(s.x, s.y)) this.damageSentry(s, 9999, 0, 0, 0);
    }
  }

  /**
   * The compaction arm. It warns, then physically descends from the top edge to its stop
   * line, carrying whatever it catches down with it. It is slower than a player, so the
   * dodge is to stay below the front, step around the hole, or dash ahead of it.
   */
  private tickPusher(dt: number): void {
    const cfg = this.arena.pushers;
    if (!cfg) return;
    if (this.pusherFlashT > 0) this.pusherFlashT = Math.max(0, this.pusherFlashT - dt);
    this.pusherT += dt;
    const t = this.pusherT;
    const top = this.arena.bounds.top;
    const start = cfg.warn;
    const end = cfg.warn + cfg.travel;
    const back = end + cfg.retract;
    this.pusherWarnT = t < start ? start - t : 0;
    const wasActive = this.pusherActive;
    this.pusherActive = t >= start && t < end;
    if (this.pusherActive) {
      if (!wasActive) this.emit(EV.PUSHER, 0, this.centerX, top, 1);
      const k = (t - start) / cfg.travel;
      this.pusherY = top + (cfg.stop - top) * k;
      this.carryWithArm(cfg.thickness, cfg.push);
      return;
    }
    if (wasActive) this.pusherFlashT = 0.3;
    if (t >= back) {
      this.pusherY = top;
    } else if (t >= end) {
      // Rise back up over `retract`, so the arm is visibly out of the way before boxes drop.
      const k = (t - end) / cfg.retract;
      this.pusherY = cfg.stop + (top - cfg.stop) * k;
    } else {
      this.pusherY = top;
    }
    if (t >= cfg.period) {
      this.pusherT = 0;
      this.pusherWarnT = 0;
      this.pusherY = top;
      this.pusherActive = false;
    }
  }

  /** File boxes: light debris physics, the drop-in fall, and the refill between strokes. */
  private updateProps(dt: number): void {
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt);
      if (b.dropT > 0) {
        b.dropT = Math.max(0, b.dropT - dt);
        continue;
      }
      if (!b.active) continue;
      this.stepProp(b, dt);
    }
    this.separateProps();
    const cfg = this.arena.pushers;
    if (!cfg) return;
    // Feed boxes in only while the arm is parked at the top, never on top of a body.
    if (this.pusherT < cfg.warn + cfg.travel + cfg.retract) return;
    this.propDropT -= dt;
    if (this.propDropT > 0) return;
    this.propDropT = FILE_PROP.dropEvery;
    this.dropFileBox();
  }

  /**
   * One tick of light debris: drift and drag, the edge, cover, bodies and a raised guard.
   * Boxes are never solid architecture; they only ever move, so this stays cheap.
   */
  private stepProp(b: Prop, dt: number): void {
    const bnd = this.arena.bounds;
    if (b.vx !== 0 || b.vy !== 0 || b.tx !== 0 || b.ty !== 0) {
      // The target velocity eases out; the actual velocity ramps toward it, so a hit
      // accelerates the box over a few frames and it glides to a stop.
      const f = Math.exp(-FILE_PROP.drag * dt);
      b.tx *= f;
      b.ty *= f;
      const a = FILE_PROP.accel * dt;
      b.vx += Math.max(-a, Math.min(a, b.tx - b.vx));
      b.vy += Math.max(-a, Math.min(a, b.ty - b.vy));
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (Math.abs(b.vx) < FILE_PROP.restSpeed && Math.abs(b.tx) < FILE_PROP.restSpeed) b.vx = 0;
      if (Math.abs(b.vy) < FILE_PROP.restSpeed && Math.abs(b.ty) < FILE_PROP.restSpeed) b.vy = 0;
    }
    const cx = b.x + b.w * 0.5;
    const cy = b.y + b.h * 0.5;
    if ((this.openWalls || this.arena.voids || this.arena.slant) && this.offFloor(cx, cy)) {
      b.active = false;
      this.emit(EV.PROP_BREAK, 0, cx, cy, b.w + b.h);
      return;
    }
    if (b.x < bnd.left) {
      b.x = bnd.left;
      b.vx = Math.abs(b.vx) * 0.35;
      b.tx = b.vx;
    } else if (b.x + b.w > bnd.right) {
      b.x = bnd.right - b.w;
      b.vx = -Math.abs(b.vx) * 0.35;
      b.tx = b.vx;
    }
    if (b.y < bnd.top) {
      b.y = bnd.top;
      b.vy = Math.abs(b.vy) * 0.35;
      b.ty = b.vy;
    } else if (b.y + b.h > bnd.bottom) {
      b.y = bnd.bottom - b.h;
      b.vy = -Math.abs(b.vy) * 0.35;
      b.ty = b.vy;
    }
    for (let i = 0; i < this.arena.pillars.length; i++) {
      if (!circleRect(cx, cy, Math.max(b.w, b.h) * 0.46, this.arena.pillars[i], hitScratch)) continue;
      b.x += hitScratch.px - cx;
      b.y += hitScratch.py - cy;
      const vn = b.vx * hitScratch.nx + b.vy * hitScratch.ny;
      if (vn < 0) {
        b.vx -= vn * hitScratch.nx;
        b.vy -= vn * hitScratch.ny;
        b.tx = b.vx;
        b.ty = b.vy;
      }
    }
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.travelT > 0) continue;
      // A raised guard bats a box back the way it came instead of letting it land.
      if (p.guardT > 0) {
        const gx = cx - p.x;
        const gy = cy - p.y;
        const gd = Math.hypot(gx, gy);
        const reach = PLAYER.guardReach + Math.max(b.w, b.h) * 0.5;
        if (gd < reach && gx * Math.cos(p.facing) + gy * Math.sin(p.facing) > 0) {
          b.tx = Math.cos(p.facing) * FILE_PROP.guardPush;
          b.ty = Math.sin(p.facing) * FILE_PROP.guardPush;
          b.hitFlash = FILE_PROP.hitFlash;
          continue;
        }
      }
      const nearX = Math.max(b.x, Math.min(p.x, b.x + b.w));
      const nearY = Math.max(b.y, Math.min(p.y, b.y + b.h));
      let dx = p.x - nearX;
      let dy = p.y - nearY;
      let d = Math.hypot(dx, dy);
      if (d >= PLAYER.radius) continue;
      if (d < 0.001) {
        dx = p.x - cx;
        dy = p.y - cy;
        d = Math.hypot(dx, dy) || 1;
      }
      const ux = -dx / d;
      const uy = -dy / d;
      const overlap = PLAYER.radius - d;
      b.x += ux * overlap;
      b.y += uy * overlap;
      if (b.vx * ux + b.vy * uy < FILE_PROP.bumpSpeed) {
        const speed = Math.min(FILE_PROP.maxSpeed, Math.max(FILE_PROP.bumpSpeed, Math.hypot(p.vx, p.vy) * 1.4));
        b.tx = ux * speed;
        b.ty = uy * speed;
      }
    }
  }

  /** Boxes are light but not ghosts: they shove each other apart instead of stacking. */
  private separateProps(): void {
    for (let i = 0; i < this.props.length; i++) {
      const a = this.props[i];
      if (!a.active || a.dropT > 0) continue;
      for (let j = i + 1; j < this.props.length; j++) {
        const c = this.props[j];
        if (!c.active || c.dropT > 0) continue;
        const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
        if (ox <= 0) continue;
        const oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
        if (oy <= 0) continue;
        if (ox < oy) {
          const s = a.x < c.x ? -0.5 : 0.5;
          a.x += ox * s;
          c.x -= ox * s;
        } else {
          const s = a.y < c.y ? -0.5 : 0.5;
          a.y += oy * s;
          c.y -= oy * s;
        }
      }
    }
  }

  /** Send a box flying. Hits launch, they do not delete: the damage is a separate path. */
  private launchProp(b: Prop, nx: number, ny: number, speed: number): void {
    const mag = Math.hypot(nx, ny);
    if (mag < 0.001) return;
    const s = Math.min(speed, FILE_PROP.maxSpeed) / mag;
    b.tx = nx * s;
    b.ty = ny * s;
  }

  /** Drop one parked box into the wide part of the bin. No allocation, no snapshot fields. */
  private dropFileBox(): void {
    const b = this.arena.bounds;
    let slot: Prop | null = null;
    for (let i = 0; i < this.props.length; i++) {
      if (!this.props[i].active) {
        slot = this.props[i];
        break;
      }
    }
    if (!slot) return;
    const y = b.top + 180 + this.rng.range(0, 150);
    const k = (y - b.top) / (b.bottom - b.top);
    const inset = (this.arena.slant ?? 0) * (1 - k) + 90;
    const span = b.right - b.left - inset * 2 - slot.w;
    if (span <= 0) return;
    const x = b.left + inset + this.rng.range(0, span);
    if (this.inVoid(x + slot.w * 0.5, y + slot.h * 0.5)) return;
    for (let i = 0; i < this.arena.pillars.length; i++) {
      const r = this.arena.pillars[i];
      if (x + slot.w > r.x && x < r.x + r.w && y + slot.h > r.y && y < r.y + r.h) return;
    }
    slot.active = true;
    slot.kind = (this.rng.range(0, 4) | 0) % 4;
    slot.x = x;
    slot.y = y;
    slot.hp = FILE_PROP.hp;
    slot.hitFlash = 0;
    slot.dropT = FILE_PROP.dropT;
    slot.vx = 0;
    slot.vy = 0;
    slot.tx = 0;
    slot.ty = 0;
  }

  /**
   * Clamp anything the arm's leading face has reached to just below it and carry it down.
   * A body pressed onto the bottom ledge is pinned instead of shoved, so the side ground
   * keeps its promise: only the hole takes a body the arm brings it to.
   */
  private carryWithArm(_thickness: number, _push: number): void {
    const front = this.pusherY;
    const bottom = this.arena.bounds.bottom;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.travelT > 0) continue;
      if (p.y > front + PLAYER.radius) continue;
      // Glue the body to the plate's face instead of kicking it: the wall is solid, so it
      // moves at the plate's speed and only the hole or the bottom pin gets a say.
      p.y = Math.min(bottom - PLAYER.radius, front + PLAYER.radius);
      p.ky = 0;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      if (w.y > front + WORM.headRadius) continue;
      w.y = Math.min(bottom - WORM.headRadius, front + WORM.headRadius);
      w.ky = 0;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || v.y > front + v.radius) continue;
      v.y = Math.min(bottom - v.radius, front + v.radius);
      v.ky = 0;
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active || s.y > front + s.radius) continue;
      s.y = Math.min(bottom - s.radius, front + s.radius);
      s.ky = 0;
    }
    // Loose file boxes are swept along too; one that ends over the hole is gone.
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.active || b.dropT > 0 || b.y > front) continue;
      b.y = Math.min(bottom - b.h, front);
      b.vy = 0;
      b.ty = 0;
      if (this.inVoid(b.x + b.w * 0.5, b.y + b.h * 0.5)) {
        b.active = false;
        this.emit(EV.PROP_BREAK, 0, b.x + b.w * 0.5, b.y + b.h * 0.5, b.w + b.h * 0.5);
      }
    }
  }

  /**
   * Queue one pack. The silhouettes land one at a time over the next few seconds so a
   * new wave never dumps a full firing squad into the room on the same frame.
   */
  private spawnSentryPack(): void {
    // Touch down in a ring around the player, not at the far spawn. The enlarged
    // arenas are wider than a screen; spawning at the far edge delayed all shooting.
    const p = this.players[0];
    const angle = this.rng.range(0, Math.PI * 2);
    // Use the camera window, not a fixed radius: a vertical 480-unit offset is
    // off-screen even though it is "close" on a wide arena.
    const spreadX = (VIEW_W / CAMERA_ZOOM) * SENTRY.spawnViewX;
    const spreadY = (VIEW_H / CAMERA_ZOOM) * SENTRY.spawnViewY;
    const margin = SENTRY.spawnMargin;
    this.sentryQueueX = Math.max(
      this.arena.bounds.left + margin,
      Math.min(this.arena.bounds.right - margin, p.x + Math.cos(angle) * spreadX),
    );
    this.sentryQueueY = Math.max(
      this.arena.bounds.top + margin,
      Math.min(this.arena.bounds.bottom - margin, p.y + Math.sin(angle) * spreadY),
    );
    const pack = this.sentryPack++;
    let n = 0;
    if (!this.gauntletPractice && this.wave <= SENTRY.openingWaves) {
      // Two pulse squares open the run and then hold the same small firing line.
      // One lone square on a wide arena read as an empty level.
      n = this.pushQueue(0, 2, n);
    } else if (!this.gauntletPractice && this.wave < GAUNTLET.triplexWave) {
      n = this.pushQueue(0, 1, n);
    } else if (!this.gauntletPractice && this.wave < GAUNTLET.homingWave) {
      n = this.pushQueue((pack & 1) === 0 ? 0 : 1, 1, n);
    } else if (!this.gauntletPractice && this.wave < GAUNTLET.flockWave) {
      const lane = pack % 3;
      n = this.pushQueue(lane === 0 ? 0 : lane === 1 ? 1 : 2, 1, n);
    } else {
      const lane = pack & 3;
      if (lane === 0) n = this.pushQueue(0, 1, n);
      else if (lane === 1) n = this.pushQueue(1, 1, n);
      else if (lane === 2) n = this.pushQueue(2, 1, n);
      else n = this.pushQueue(3, SENTRY.flockSize, n);
    }
    this.sentryQueueCount = n;
    this.sentryQueueIndex = 0;
    this.sentryQueueT = 0;
  }

  private pushQueue(kind: number, count: number, at: number): number {
    let n = at;
    for (let i = 0; i < count && n < this.sentryQueue.length; i++) this.sentryQueue[n++] = kind;
    return n;
  }

  /** Drops one queued silhouette every packStagger seconds. */
  private drainSentryQueue(dt: number): void {
    if (this.sentryQueueIndex >= this.sentryQueueCount) return;
    let active = 0;
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) active++;
    if (active >= this.sentryLimit()) {
      // A pack can be larger than the remaining slots. Land what fits, then stop;
      // otherwise a four-silhouette pack pushes the live count past the wave cap.
      this.sentryQueueCount = 0;
      this.sentryQueueIndex = 0;
      return;
    }
    this.sentryQueueT -= dt;
    if (this.sentryQueueT > 0) return;
    this.sentryQueueT = SENTRY.packStagger;
    const kind = this.sentryQueue[this.sentryQueueIndex++] as 0 | 1 | 2 | 3;
    this.spawnSentry(kind, this.sentryQueueX, this.sentryQueueY);
    if (this.sentryQueueIndex >= this.sentryQueueCount) {
      this.sentryQueueIndex = 0;
      this.sentryQueueCount = 0;
    }
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
    let leash: number = SENTRY.pulse.leash;
    if (kind === 1) {
      radius = SENTRY.triplex.radius;
      hp = SENTRY.triplex.hp;
      leash = SENTRY.triplex.leash;
    } else if (kind === 2) {
      radius = SENTRY.homing.radius;
      hp = SENTRY.homing.hp;
      leash = SENTRY.homing.leash;
    } else if (kind === 3) {
      radius = SENTRY.flock.radius;
      hp = SENTRY.flock.hp;
      leash = SENTRY.flock.leash;
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
    s.anchorX = x;
    s.anchorY = y;
    s.leash = leash;
    s.fireT = this.gauntletPractice
      ? this.rng.range(0.9, 2.2)
      : this.wave <= SENTRY.openingWaves
        ? this.rng.range(SENTRY.openingFireMin, SENTRY.openingFireMax)
        : this.rng.range(0.9, 2.2);
    s.phase = this.rng.range(0, Math.PI * 2);
    s.hitFlash = 0;
    s.orbitSign = this.rng.next() < 0.5 ? -1 : 1;
    s.spawnT = SENTRY.spawnTime;
    s.pinT = 0;
    s.orbitOwner = -1;
    s.orbitA = 0;
    s.orbitR = 0;
    s.orbitDir = 1;
    s.orbitHitCd = 0;
    s.ramT = 0;
    s.ramCd = this.rng.range(0.9, SENTRY.ram.cooldown);
    s.ramHit = false;
    s.ramDirX = 1;
    s.ramDirY = 0;
    return true;
  }

  private sentryClear(x: number, y: number, radius: number): boolean {
    if (!this.pointClearOfCover(x, y, radius)) return false;
    const p = this.players[0];
    return !p.alive || Math.hypot(x - p.x, y - p.y) > 240;
  }

  private pointClearOfCover(x: number, y: number, radius: number): boolean {
    if (
      x < this.arena.bounds.left + radius ||
      x > this.arena.bounds.right - radius ||
      y < this.arena.bounds.top + radius ||
      y > this.arena.bounds.bottom - radius
    ) {
      return false;
    }
    // Nothing spawns over a hole: threats, patrol points and pickups all use this test.
    if (this.inVoid(x, y)) return false;
    for (let i = 0; i < this.solids.length; i++) {
      if (circleRect(x, y, radius + 4, this.solids[i], hitScratch)) return false;
    }
    return true;
  }

  /** Fly, keep a range band, and fire. Cover blocks both shots and movement. */
  private updateSentry(s: Sentry, dt: number): void {
    s.prevX = s.x;
    s.prevY = s.y;
    s.phase += dt;
    if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt);
    if (s.ramCd > 0) s.ramCd = Math.max(0, s.ramCd - dt);
    // Held in Atomize's orbit: the field owns position and firing until it releases.
    if (s.orbitOwner >= 0) {
      s.ramT = 0;
      return;
    }
    if (s.spawnT > 0) {
      s.spawnT = Math.max(0, s.spawnT - dt);
      s.ramT = 0;
      s.vx = 0;
      s.vy = 0;
      return;
    }
    if (s.pinT > 0) {
      s.pinT = Math.max(0, s.pinT - dt);
      s.ramT = 0;
      s.vx = 0;
      s.vy = 0;
      return;
    }

    const p = this.players[0];
    if (s.ramT > 0) {
      this.updateSentryRam(s, dt, p);
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

    // A cloaked player is not a visible target. The sentry falls back to its landing
    // zone unless a lure is still pulling it, so the cloak buys real reposition time.
    const pVisible = p.alive && p.cloakT <= 0;
    // Fisher's lure overshadows the player while it is live. Sentries aim at the
    // beacon, which buys the Fisher space even if they keep firing.
    const lureIndex = this.nearestLureIndex(s.x, s.y);
    const lure = lureIndex >= 0 ? this.lures[lureIndex] : null;
    const tx = lure ? lure.x : pVisible ? p.x : s.anchorX;
    const ty = lure ? lure.y : pVisible ? p.y : s.anchorY;
    const dx = tx - s.x;
    const dy = ty - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const anchorDx = s.anchorX - s.x;
    const anchorDy = s.anchorY - s.y;
    const anchorDist = Math.hypot(anchorDx, anchorDy);
    const anchorUx = anchorDist > 1 ? anchorDx / anchorDist : 0;
    const anchorUy = anchorDist > 1 ? anchorDy / anchorDist : 0;
    // Sentries hold their landing zone. They engage only inside the leash + weapon
    // range; outside that they drift back to the anchor instead of following the player.
    const engaged = (pVisible || lure !== null) && dist < s.leash + range;

    // Only the small silhouettes answer a player in their face with a ram. The heavy
    // triplex and homing pods keep their shooting role and their distance band.
    // One ram commits at a time: a three-dart flock must not stack three melee hits on
    // the same frame, which would delete a full health bar before the tell resolved.
    const canRam = s.kind === 0 || s.kind === 3;
    let ramBusy = false;
    if (canRam) {
      for (let i = 0; i < this.sentries.length; i++) {
        const other = this.sentries[i];
        if (other !== s && other.active && other.ramT > 0) {
          ramBusy = true;
          break;
        }
      }
    }
    if (
      canRam &&
      !ramBusy &&
      s.ramT <= 0 &&
      s.ramCd <= 0 &&
      pVisible &&
      !lure &&
      p.alive &&
      dist <= SENTRY.ram.range &&
      !this.lineBlocked(s.x, s.y, p.x, p.y)
    ) {
      const ramTotal = SENTRY.ram.windup + SENTRY.ram.active + SENTRY.ram.recovery;
      s.ramT = ramTotal;
      s.ramCd = SENTRY.ram.cooldown;
      s.ramHit = false;
      s.ramDirX = ux;
      s.ramDirY = uy;
      s.fireT = Math.max(s.fireT, ramTotal + 0.25);
      this.updateSentryRam(s, dt, p);
      return;
    }

    let desiredX = 0;
    let desiredY = 0;
    if (engaged) {
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
    } else if (anchorDist > 36) {
      desiredX = anchorUx;
      desiredY = anchorUy;
    } else {
      desiredX = Math.cos(s.phase * 0.42 * s.orbitSign) * 0.18;
      desiredY = Math.sin(s.phase * 0.37 * s.orbitSign) * 0.18;
    }
    if (anchorDist > s.leash) {
      desiredX += anchorUx * 2.4;
      desiredY += anchorUy * 2.4;
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
    // Sentries hold a landing zone and are leashed, so the clamp only matters for a
    // shove. On an open arena the drop is allowed to take them.
    if (!this.openWalls) {
      s.x = Math.max(this.arena.bounds.left + s.radius, Math.min(this.arena.bounds.right - s.radius, s.x));
      s.y = Math.max(this.arena.bounds.top + s.radius, Math.min(this.arena.bounds.bottom - s.radius, s.y));
    }
    this.pushOutOfCover(s, s.radius);

    if (!pVisible && !lure) return;
    s.fireT -= dt;
    if (s.fireT > 0 || dist > range) return;
    if (this.lineBlocked(s.x, s.y, tx, ty)) {
      s.fireT = 0.35;
      return;
    }
    const aim = Math.atan2(dy, dx);
    const srcId = this.sentries.indexOf(s);
    if (s.kind === 0) {
      this.spawnHostileProjectile(s.x, s.y, aim, SENTRY.pulse.boltSpeed, SENTRY.boltRadius, SENTRY.boltDamage, 3, SENTRY.pulse.boltTtl, srcId);
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
          SENTRY.triplex.boltTtl,
          srcId,
        );
      }
    } else if (s.kind === 2) {
      this.spawnHostileProjectile(s.x, s.y, aim, SENTRY.missileSpeed, SENTRY.missileRadius, SENTRY.boltDamage, 4, SENTRY.missileTtl, srcId);
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
          SENTRY.flock.boltTtl,
          srcId,
        );
      }
    }
    s.fireT =
      this.rng.range(fireMin, fireMax) *
      (!this.gauntletPractice && this.wave <= SENTRY.openingWaves ? SENTRY.openingCadenceMult : 1);
  }

  /**
   * Small sentry ram: wind-up, one committed dash, then a recovery beat. It never
   * fires during the attack, and cover ends both the travel and the hit.
   */
  private updateSentryRam(s: Sentry, dt: number, p: Player): void {
    const total = SENTRY.ram.windup + SENTRY.ram.active + SENTRY.ram.recovery;
    const elapsed = total - s.ramT;
    if (elapsed < SENTRY.ram.windup) {
      s.vx = 0;
      s.vy = 0;
    } else if (elapsed < SENTRY.ram.windup + SENTRY.ram.active) {
      s.vx = s.ramDirX * SENTRY.ram.speed;
      s.vy = s.ramDirY * SENTRY.ram.speed;
    } else {
      s.vx = 0;
      s.vy = 0;
    }
    s.x += (s.vx + s.kx) * dt;
    s.y += (s.vy + s.ky) * dt;
    s.kx *= Math.exp(-SENTRY.knockDrag * dt);
    s.ky *= Math.exp(-SENTRY.knockDrag * dt);
    if (!this.openWalls) {
      s.x = Math.max(this.arena.bounds.left + s.radius, Math.min(this.arena.bounds.right - s.radius, s.x));
      s.y = Math.max(this.arena.bounds.top + s.radius, Math.min(this.arena.bounds.bottom - s.radius, s.y));
    }
    this.pushOutOfCover(s, s.radius);

    if (
      elapsed >= SENTRY.ram.windup &&
      elapsed < SENTRY.ram.windup + SENTRY.ram.active &&
      !s.ramHit &&
      p.alive &&
      p.cloakT <= 0 &&
      p.iframes <= 0
    ) {
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const rr = s.radius + PLAYER.radius + 4;
      if (dx * dx + dy * dy <= rr * rr && !this.lineBlocked(s.x, s.y, p.x, p.y)) {
        const d = Math.hypot(dx, dy) || 1;
        s.ramHit = true;
        this.damagePlayer(
          p,
          SENTRY.ram.damage,
          -1,
          dx / d,
          dy / d,
          SENTRY.ram.knockback,
          SRC.SENTRY,
          this.sentries.indexOf(s),
        );
      }
    }
    s.ramT = Math.max(0, s.ramT - dt);
  }

  /** True collision with cover, used by worms and sentries. */
  private pushOutOfCover(body: { x: number; y: number; vx: number; vy: number }, radius: number): void {
    for (let i = 0; i < this.solids.length; i++) {
      if (!circleRect(body.x, body.y, radius, this.solids[i], hitScratch)) continue;
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
    srcId = -1,
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
    proj.srcKind = SRC.SENTRY;
    proj.srcId = srcId;
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
    proj.homing = false;
    proj.pathAxis = 0;
    proj.hitPlayers = 0;
    proj.hitWorms = 0;
    proj.hitViruses = 0;
    proj.hitErrors = 0;
    proj.hitSentries = 0;
    proj.hitDrone = false;
    proj.trailHead = 0;
    proj.trailCount = 0;
    proj.variant = 0;
    proj.orbOwner = -1;
    proj.orbA = 0;
    proj.orbR = 0;
    proj.orbDir = 1;
    this.emit(EV.SENTRY_SHOOT, -1, x, y, angle);
  }

  private damageSentry(s: Sentry, amount: number, sourceSlot: number, dirX: number, dirY: number, force = 0): void {
    if (!s.active) return;
    // A dormant calibration subject absorbs the first hit and wakes the class. The
    // prologue is a scripted reveal, so shooting one starts the test instead of
    // deleting it before the eye opens.
    if (s.kind >= 4 && this.campaignPhase === 'calibration' && s.shapeState === 0) {
      s.hitFlash = 0.18;
      this.wakeCalibration();
      return;
    }
    s.hp -= amount;
    s.hitFlash = 0.18;
    s.kx += dirX * force;
    s.ky += dirY * force;
    this.emit(EV.SENTRY_HIT, sourceSlot, s.x, s.y, amount, dirX, dirY);
    if (s.hp > 0) return;
    s.active = false;
    s.orbitOwner = -1;
    // A parent takes its echoes and shards with it. They are affordances of the
    // subject, not a second enemy that outlives it.
    if (s.shapeParent < 0 && s.kind >= 4 && s.kind <= 6) this.clearShapeChildren(this.sentries.indexOf(s));
    if (sourceSlot === 0 && !(this.campaignPhase === 'calibration' && s.kind >= 4)) {
      this.gauntletKills++;
      this.dropPickupFromKill(s.x, s.y, s.kind !== 0);
    }
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

      if (!player.active || !player.alive || player.cloakT > 0 || player.iframes > 0 || e.touchCd > 0 || e.spawnT > 0) continue;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const rr = half + PLAYER.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      const d = Math.hypot(dx, dy) || 1;
      e.touchCd = CASCADING_ERROR.touchCooldown;
      this.damagePlayer(player, CASCADING_ERROR.touchDamage, -1, dx / d, dy / d, CASCADING_ERROR.knockback, SRC.ERROR, i);
    }

    if (active === 0) {
      if (!this.gauntletPractice && this.wave < GAUNTLET.errorWave) return;
      this.errorSpawnT -= dt;
      if (this.errorSpawnT <= 0) this.spawnErrorColony();
      return;
    }

    this.errorGrowT -= dt;
    if (this.errorGrowT <= 0) {
      this.errorGrowT = this.gauntletInterval(
        CASCADING_ERROR.growthInterval,
        CASCADING_ERROR.growthMinInterval,
      );
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
    for (let i = 0; i < this.solids.length; i++) {
      if (circleRect(x, y, r, this.solids[i], hitScratch)) return false;
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
    this.errorGrowT = this.gauntletInterval(
      CASCADING_ERROR.growthInterval,
      CASCADING_ERROR.growthMinInterval,
    );
    this.emit(EV.ERROR_SPAWN, -1, x, y, CASCADING_ERROR.blockSize);
  }

  private growError(): void {
    let active = 0;
    for (let i = 0; i < this.errors.length; i++) if (this.errors[i].active) active++;
    if (active >= this.errorLimit()) return;

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
    if (sourceSlot === 0) {
      this.gauntletKills++;
      this.dropPickupFromKill(e.x, e.y, false);
    }
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
    const spawn = this.arena.spawns[this.wormAnchorIndex()];
    w.active = true;
    w.x = spawn.x;
    w.y = spawn.y;
    w.prevX = w.x;
    w.prevY = w.y;
    w.anchorX = spawn.x;
    w.anchorY = spawn.y;
    w.patrolX = spawn.x;
    w.patrolY = spawn.y;
    w.retargetT = 0;
    w.aggroT = 0;
    w.angle = Math.atan2(this.centerY - w.y, this.centerX - w.x);
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
    w.pinT = 0;
    w.biteT = 0;
    w.biteCd = WORM.biteCooldown * 0.5;
    w.biteHit = false;
    w.biteDirX = Math.cos(w.angle);
    w.biteDirY = Math.sin(w.angle);
    this.pickWormPatrol(w);
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

  private wormAnchorIndex(): number {
    const p = this.players[0];
    let best = 0;
    let bestD = -1;
    for (let i = 0; i < 4; i++) {
      const index = Math.floor(this.rng.next() * this.arena.spawns.length);
      const s = this.arena.spawns[index];
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      const d = dx * dx + dy * dy;
      if (d > bestD) {
        best = index;
        bestD = d;
      }
      if (d > 520 * 520) return index;
    }
    return bestD > 420 * 420 ? best : this.farSpawnIndex();
  }

  private pickWormPatrol(w: Worm): void {
    const pad = WORM.headRadius + 8;
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const dist = this.rng.range(24, WORM.patrolRadius);
      const x = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, w.anchorX + Math.cos(angle) * dist));
      const y = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, w.anchorY + Math.sin(angle) * dist));
      if (!this.pointClearOfCover(x, y, pad)) continue;
      w.patrolX = x;
      w.patrolY = y;
      w.retargetT = this.rng.range(WORM.retargetMin, WORM.retargetMax);
      return;
    }
    w.patrolX = w.anchorX;
    w.patrolY = w.anchorY;
    w.retargetT = this.rng.range(WORM.retargetMin, WORM.retargetMax);
  }

  private updateWorm(w: Worm, dt: number): void {
    w.prevX = w.x;
    w.prevY = w.y;
    w.phase += dt;
    if (w.hitFlash > 0) w.hitFlash = Math.max(0, w.hitFlash - dt);
    if (w.touchCd > 0) w.touchCd = Math.max(0, w.touchCd - dt);
    if (w.biteCd > 0) w.biteCd = Math.max(0, w.biteCd - dt);
    if (w.biteT > 0) w.biteT = Math.max(0, w.biteT - dt);
    if (w.spawnT > 0) {
      w.spawnT = Math.max(0, w.spawnT - dt);
      w.vx = 0;
      w.vy = 0;
      return;
    }
    if (w.pinT > 0) {
      w.pinT = Math.max(0, w.pinT - dt);
      w.vx = 0;
      w.vy = 0;
      return;
    }

    const p = this.players[0];
    const lureIndex = this.nearestLureIndex(w.x, w.y);
    const lure = lureIndex >= 0 ? this.lures[lureIndex] : null;
    const pdx = p.x - w.x;
    const pdy = p.y - w.y;
    const aggroSq = WORM.aggroRadius * WORM.aggroRadius;
    if (w.infected || lure) {
      w.aggroT = WORM.aggroTime;
    } else if (p.alive && p.cloakT <= 0 && pdx * pdx + pdy * pdy < aggroSq) {
      w.aggroT = WORM.aggroTime;
    } else {
      w.aggroT = Math.max(0, w.aggroT - dt);
    }
    w.retargetT -= dt;

    // A close player is answered with a committed bite. The wind-up is the tell; the
    // direction is latched so a dash or a step sideways can still beat it.
    const biteDistSq = pdx * pdx + pdy * pdy;
    if (
      w.biteT <= 0 &&
      w.biteCd <= 0 &&
      w.aggroT > 0 &&
      p.alive &&
      p.cloakT <= 0 &&
      biteDistSq <= WORM.biteRange * WORM.biteRange &&
      !this.lineBlocked(w.x, w.y, p.x, p.y)
    ) {
      const d = Math.sqrt(biteDistSq) || 1;
      w.biteT = WORM.biteWindup + WORM.biteActive + WORM.biteRecovery;
      w.biteCd = WORM.biteCooldown;
      w.biteHit = false;
      w.biteDirX = pdx / d;
      w.biteDirY = pdy / d;
      w.vx = 0;
      w.vy = 0;
    }
    const biteElapsed =
      w.biteT > 0 ? WORM.biteWindup + WORM.biteActive + WORM.biteRecovery - w.biteT : -1;

    const anchorDx = w.anchorX - w.x;
    const anchorDy = w.anchorY - w.y;
    const anchorDist = Math.hypot(anchorDx, anchorDy);
    let tx = w.patrolX;
    let ty = w.patrolY;
    if (lure) {
      tx = lure.x;
      ty = lure.y;
    } else if (w.aggroT > 0 && p.alive && p.cloakT <= 0) {
      tx = p.x;
      ty = p.y;
    } else if (anchorDist > WORM.territoryRadius) {
      tx = w.anchorX;
      ty = w.anchorY;
    } else {
      const patrolDx = w.patrolX - w.x;
      const patrolDy = w.patrolY - w.y;
      if (w.retargetT <= 0 || patrolDx * patrolDx + patrolDy * patrolDy < 24 * 24) {
        this.pickWormPatrol(w);
        tx = w.patrolX;
        ty = w.patrolY;
      }
    }

    if (w.biteT > 0) {
      const biteTurn = WORM.biteTurnRate * dt;
      const biteAngle = Math.atan2(w.biteDirY, w.biteDirX);
      let faceDiff = biteAngle - w.angle;
      while (faceDiff > Math.PI) faceDiff -= Math.PI * 2;
      while (faceDiff < -Math.PI) faceDiff += Math.PI * 2;
      w.angle += Math.max(-biteTurn, Math.min(biteTurn, faceDiff));
      if (biteElapsed < WORM.biteWindup) {
        w.vx = 0;
        w.vy = 0;
      } else if (biteElapsed < WORM.biteWindup + WORM.biteActive) {
        w.vx = w.biteDirX * WORM.biteLunge;
        w.vy = w.biteDirY * WORM.biteLunge;
      } else {
        w.vx = 0;
        w.vy = 0;
      }
    } else {
      const desired =
        Math.atan2(ty - w.y, tx - w.x) +
        Math.sin(w.phase * WORM.seekWobbleFreq + w.y * 0.01) * WORM.seekWobbleAmp;
      let diff = desired - w.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = WORM.turnRate * dt;
      w.angle += Math.max(-turn, Math.min(turn, diff));
      const growSlow = Math.max(
        WORM.minSpeedMult,
        1 - (w.segCount - WORM.segments) * WORM.lengthSlow,
      );
      const speed =
        WORM.speed *
        growSlow *
        (w.infected ? WORM.infectedSpeedMult : 1) *
        (w.aggroT > 0 ? 1 : WORM.patrolSpeedMult);
      w.vx = Math.cos(w.angle) * speed;
      w.vy = Math.sin(w.angle) * speed;
    }
    w.x += (w.vx + w.kx) * dt;
    w.y += (w.vy + w.ky) * dt;
    w.kx *= Math.exp(-WORM.knockDrag * dt);
    w.ky *= Math.exp(-WORM.knockDrag * dt);
    if (!this.openWalls) {
      const pad = WORM.headRadius + WORM.wallPad;
      w.x = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, w.x));
      w.y = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, w.y));
    }
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
      for (let p = 0; p < this.solids.length; p++) {
        if (!circleRect(w.segX[i], w.segY[i], WORM.segmentRadius, this.solids[p], hitScratch)) continue;
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

    const biteReach = WORM.headRadius + PLAYER.radius + WORM.biteReach;
    if (
      biteElapsed >= WORM.biteWindup &&
      biteElapsed < WORM.biteWindup + WORM.biteActive &&
      !w.biteHit &&
      p.alive &&
      p.cloakT <= 0
    ) {
      const bdx = p.x - w.x;
      const bdy = p.y - w.y;
      const forward = bdx * w.biteDirX + bdy * w.biteDirY;
      if (
        forward > 0 &&
        bdx * bdx + bdy * bdy <= biteReach * biteReach &&
        !this.lineBlocked(w.x, w.y, p.x, p.y)
      ) {
        const d = Math.hypot(bdx, bdy) || 1;
        w.biteHit = true;
        w.aggroT = WORM.aggroTime;
        w.touchCd = WORM.touchCooldown;
        this.damagePlayer(
          p,
          WORM.biteDamage,
          -1,
          bdx / d,
          bdy / d,
          WORM.biteKnockback,
          SRC.WORM,
          this.worms.indexOf(w),
        );
      }
    }

    if (w.biteT <= 0 && p.alive && p.cloakT <= 0 && w.touchCd <= 0) {
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
        this.damagePlayer(p, WORM.touchDamage, -1, hdx / d, hdy / d, WORM.knockback, SRC.WORM, this.worms.indexOf(w));
        w.aggroT = WORM.aggroTime;
        w.touchCd = WORM.touchCooldown;
      }
    }
  }

  private damageWorm(w: Worm, amount: number, sourceSlot: number, dirX: number, dirY: number, force = 0): void {
    if (!w.active) return;
    w.hp -= amount;
    w.hitFlash = 0.2;
    // Only the player provokes a worm. Crossfire between rival factions should not
    // turn every worm into a player-seeking missile.
    if (sourceSlot === 0) w.aggroT = WORM.aggroTime;
    w.kx += dirX * force;
    w.ky += dirY * force;
    this.emit(EV.WORM_HIT, sourceSlot, w.x, w.y, amount, dirX, dirY);
    if (w.hp <= 0) {
      w.active = false;
      if (sourceSlot === 0) {
        this.gauntletKills++;
        this.dropPickupFromKill(w.x, w.y, true);
      }
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
    v.targetPlayer = false;
    v.roamX = v.x;
    v.roamY = v.y;
    v.retargetT = 0;
    v.orbitSign = this.rng.next() < 0.5 ? -1 : 1;
    v.phase = this.rng.range(0, Math.PI * 2);
    v.contactCd = this.rng.range(0, 0.5);
    v.hitFlash = 0;
    v.spawnT = VIRUS.spawnTime;
    v.pinT = 0;
    v.orbitOwner = -1;
    v.orbitA = 0;
    v.orbitR = 0;
    v.orbitDir = 1;
    v.orbitHitCd = 0;
    v.chargeT = 0;
    v.chargeCd = this.rng.range(0.8, VIRUS.chargeCooldown);
    v.chargeHit = false;
    v.chargeDirX = 1;
    v.chargeDirY = 0;
    this.nudgeVirusFromCover(v);
    this.pickVirusRoam(v);
    return v;
  }

  private pickVirusRoam(v: Virus): void {
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const dist = this.rng.range(VIRUS.roamMin, VIRUS.roamMax);
      const x = Math.max(
        this.arena.bounds.left + VIRUS.radius + 6,
        Math.min(this.arena.bounds.right - VIRUS.radius - 6, v.x + Math.cos(angle) * dist),
      );
      const y = Math.max(
        this.arena.bounds.top + VIRUS.radius + 6,
        Math.min(this.arena.bounds.bottom - VIRUS.radius - 6, v.y + Math.sin(angle) * dist),
      );
      if (!this.pointClearOfCover(x, y, VIRUS.radius + 2)) continue;
      v.roamX = x;
      v.roamY = y;
      v.retargetT = this.rng.range(VIRUS.retargetMin, VIRUS.retargetMax);
      return;
    }
    v.roamX = v.x;
    v.roamY = v.y;
    v.retargetT = this.rng.range(VIRUS.retargetMin, VIRUS.retargetMax);
  }

  private nudgeVirusFromCover(v: Virus): void {
    for (let i = 0; i < this.solids.length; i++) {
      if (circleRect(v.x, v.y, v.radius, this.solids[i], hitScratch)) {
        v.x = hitScratch.px;
        v.y = hitScratch.py;
      }
    }
  }

  private spawnVirusCluster(): void {
    const anchor = this.arena.spawns[this.farSpawnIndex()];
    const count = this.virusClusterCount();
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const a =
        (i / count) * Math.PI * 2 +
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
    if (v.chargeCd > 0) v.chargeCd = Math.max(0, v.chargeCd - dt);
    if (v.chargeT > 0) v.chargeT = Math.max(0, v.chargeT - dt);
    // Held in Atomize's orbit: the field owns position until it releases. A charge
    // cannot resume after the field drops the body.
    if (v.orbitOwner >= 0) {
      v.chargeT = 0;
      return;
    }
    if (v.spawnT > 0) {
      v.spawnT = Math.max(0, v.spawnT - dt);
      v.chargeT = 0;
      v.vx = 0;
      v.vy = 0;
      return;
    }
    if (v.pinT > 0) {
      v.pinT = Math.max(0, v.pinT - dt);
      v.chargeT = 0;
      v.vx = 0;
      v.vy = 0;
      return;
    }
    const p = this.players[0];
    let targetWorm = -1;
    let targetPlayer = false;
    let lureTarget = false;
    let bestScore = Infinity;
    let tx = v.roamX;
    let ty = v.roamY;
    if (p.alive && p.cloakT <= 0) {
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < VIRUS.huntRadius * VIRUS.huntRadius) {
        bestScore = d2;
        targetPlayer = true;
        tx = p.x;
        ty = p.y;
      }
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || w.infected) continue;
      const dx = w.x - v.x;
      const dy = w.y - v.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > VIRUS.wormHuntRadius * VIRUS.wormHuntRadius) continue;
      const score = d2 * VIRUS.targetWormBias;
      if (score < bestScore) {
        bestScore = score;
        targetWorm = i;
        targetPlayer = false;
        tx = w.x;
        ty = w.y;
      }
    }
    const lureIndex = this.nearestLureIndex(v.x, v.y);
    if (lureIndex >= 0) {
      const lure = this.lures[lureIndex];
      targetWorm = -1;
      targetPlayer = false;
      lureTarget = true;
      tx = lure.x;
      ty = lure.y;
    }
    v.targetWorm = targetWorm;
    v.targetPlayer = targetPlayer;

    // A virus that has the player in front of it commits to one charge. The glow is
    // the tell; the direction is latched so a dash or an orbit can still slip it.
    const chargeTotal = VIRUS.chargeWindup + VIRUS.chargeActive + VIRUS.chargeRecovery;
    const pcx = p.x - v.x;
    const pcy = p.y - v.y;
    const pcDist = Math.hypot(pcx, pcy) || 1;
    if (
      v.chargeT <= 0 &&
      v.chargeCd <= 0 &&
      targetPlayer &&
      p.alive &&
      p.cloakT <= 0 &&
      pcDist >= VIRUS.chargeMinRange &&
      pcDist <= VIRUS.chargeRange &&
      !this.lineBlocked(v.x, v.y, p.x, p.y)
    ) {
      v.chargeT = chargeTotal;
      v.chargeCd = VIRUS.chargeCooldown;
      v.chargeHit = false;
      v.chargeDirX = pcx / pcDist;
      v.chargeDirY = pcy / pcDist;
    }
    const chargeElapsed = v.chargeT > 0 ? chargeTotal - v.chargeT : -1;

    v.retargetT -= dt;
    if (!lureTarget && !targetPlayer && targetWorm < 0) {
      const rdx = v.roamX - v.x;
      const rdy = v.roamY - v.y;
      if (v.retargetT <= 0 || rdx * rdx + rdy * rdy < 30 * 30) this.pickVirusRoam(v);
      tx = v.roamX;
      ty = v.roamY;
    }

    const dx = tx - v.x;
    const dy = ty - v.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    let desiredX = ux;
    let desiredY = uy;
    if (
      targetPlayer &&
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
    if (v.chargeT > 0) {
      if (chargeElapsed < VIRUS.chargeWindup) {
        v.vx = 0;
        v.vy = 0;
      } else if (chargeElapsed < VIRUS.chargeWindup + VIRUS.chargeActive) {
        v.vx = v.chargeDirX * VIRUS.chargeSpeed;
        v.vy = v.chargeDirY * VIRUS.chargeSpeed;
      } else {
        v.vx = 0;
        v.vy = 0;
      }
    } else {
      const dm = Math.hypot(desiredX, desiredY) || 1;
      desiredX /= dm;
      desiredY /= dm;
      const k = 1 - Math.exp(-VIRUS.accel * dt);
      v.vx += (desiredX * VIRUS.speed - v.vx) * k;
      v.vy += (desiredY * VIRUS.speed - v.vy) * k;
    }
    v.x += (v.vx + v.kx) * dt;
    v.y += (v.vy + v.ky) * dt;
    v.kx *= Math.exp(-VIRUS.knockDrag * dt);
    v.ky *= Math.exp(-VIRUS.knockDrag * dt);
    // A walled arena keeps the colony inside. An open one lets a shove carry it out.
    if (!this.openWalls) {
      v.x = Math.max(this.arena.bounds.left + v.radius, Math.min(this.arena.bounds.right - v.radius, v.x));
      v.y = Math.max(this.arena.bounds.top + v.radius, Math.min(this.arena.bounds.bottom - v.radius, v.y));
    }
    this.nudgeVirusFromCover(v);

    if (
      v.chargeT > 0 &&
      chargeElapsed >= VIRUS.chargeWindup &&
      chargeElapsed < VIRUS.chargeWindup + VIRUS.chargeActive &&
      !v.chargeHit &&
      p.alive &&
      p.cloakT <= 0 &&
      p.iframes <= 0
    ) {
      const cdx = p.x - v.x;
      const cdy = p.y - v.y;
      const rr = v.radius + PLAYER.radius + 4;
      if (cdx * cdx + cdy * cdy <= rr * rr && !this.lineBlocked(v.x, v.y, p.x, p.y)) {
        const d = Math.hypot(cdx, cdy) || 1;
        v.chargeHit = true;
        v.contactCd = VIRUS.contactCooldown;
        this.damagePlayer(
          p,
          VIRUS.chargeDamage,
          -1,
          cdx / d,
          cdy / d,
          VIRUS.chargeKnockback,
          SRC.VIRUS,
          this.viruses.indexOf(v),
        );
        this.addInfection(GAUNTLET.infectionPerTouch, p.x, p.y);
      }
    }

    if (p.alive && p.cloakT <= 0 && p.iframes <= 0 && v.contactCd <= 0) {
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
      for (let i = 0; i < this.solids.length; i++) {
        if (circleRect(sx, sy, PLAYER.radius, this.solids[i], hitScratch)) {
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
      this.damagePlayer(p, FIREWALL.damage, -1, nx * sign, ny * sign, FIREWALL.knockback, SRC.FIREWALL, this.firewalls.indexOf(f));
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
      if (hit) this.damageWorm(w, FIREWALL.enemyDamage, -1, nx, ny);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (v.active && this.beamHits(f, v.x, v.y, v.radius)) {
        this.damageVirus(v, FIREWALL.enemyDamage, -1, nx, ny);
      }
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active && this.beamHits(f, s.x, s.y, s.radius)) {
        this.damageSentry(s, FIREWALL.enemyDamage, -1, nx, ny);
      }
    }
    // The sweep burns the error blocks too; the factions are not allies.
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (e.active && this.beamHits(f, e.x, e.y, CASCADING_ERROR.blockSize * 0.5)) {
        this.damageError(e, FIREWALL.enemyDamage, -1, nx, ny);
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
      v.orbitOwner = -1;
      if (sourceSlot === 0) {
        this.gauntletKills++;
        this.dropPickupFromKill(v.x, v.y, false);
      }
      this.emit(EV.VIRUS_KILL, sourceSlot, v.x, v.y, v.radius * 4, dirX, dirY);
    }
  }

  /** One body struck by an hourglass: flip the spin, spend a pass, report the death. */
  private hourglassStruck(proj: Projectile): boolean {
    proj.hits++;
    proj.spinDir = -proj.spinDir;
    this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 0);
    if (proj.hits >= BUFFER.shotHits) proj.active = false;
    return !proj.active;
  }

  /**
   * Hourglass pass over the gauntlet roster. Each family uses the spear's hit masks, so
   * one shell damages a body once and keeps flying until its passes are spent. A worm
   * swallows the shell, which is the one body that can end the pass early.
   */
  private hourglassHitsGauntlet(proj: Projectile): boolean {
    const speed = Math.hypot(proj.vx, proj.vy) || 1;
    const ux = proj.vx / speed;
    const uy = proj.vy / speed;

    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const bit = 1 << i;
      if ((proj.hitErrors & bit) !== 0) continue;
      const rr = proj.radius + CASCADING_ERROR.blockSize * 0.5;
      const dx = proj.x - e.x;
      const dy = proj.y - e.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      proj.hitErrors |= bit;
      this.damageError(e, proj.damage, proj.owner, ux, uy);
      if (this.hourglassStruck(proj)) return true;
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const bit = 1 << i;
      if ((proj.hitSentries & bit) !== 0) continue;
      const rr = proj.radius + s.radius;
      const dx = proj.x - s.x;
      const dy = proj.y - s.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      proj.hitSentries |= bit;
      this.damageSentry(s, proj.damage, proj.owner, ux, uy, BUFFER.shotKnockback);
      if (this.hourglassStruck(proj)) return true;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const bit = 1 << i;
      if ((proj.hitViruses & bit) !== 0) continue;
      const rr = proj.radius + v.radius;
      const dx = proj.x - v.x;
      const dy = proj.y - v.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      proj.hitViruses |= bit;
      this.damageVirus(v, proj.damage, proj.owner, ux, uy, BUFFER.shotKnockback);
      if (this.hourglassStruck(proj)) return true;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const bit = 1 << i;
      if ((proj.hitWorms & bit) !== 0) continue;
      const hdx = proj.x - w.x;
      const hdy = proj.y - w.y;
      const hr = proj.radius + WORM.headRadius;
      if (hdx * hdx + hdy * hdy > hr * hr) continue;
      // A worm swallows the shell instead of being pierced by it.
      this.eatProjectile(proj, w);
      return true;
    }
    return false;
  }

  private projectileHitsGauntlet(proj: Projectile): boolean {
    if (proj.type === 10) return this.hourglassHitsGauntlet(proj);
    if (proj.type === 5) {
      this.spearHitsGauntlet(proj);
      return false;
    }
    // Enemy fire is not a friendly-fire-free laser tag beam. A missed sentry shot can
    // chew through a worm, a virus, or an error block. Sentries ignore their own pack,
    // because a projectile has no source silhouette to exclude safely. The run can
    // turn the crossfire off, in which case enemy fire only threatens players.
    const hostile = proj.owner < 0 && proj.type >= 3;
    // The infested thrall lives on slot 1, so its shots are enemy fire too.
    if ((hostile || proj.owner === 1) && !this.friendlyFire) return false;

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
      if (hostile) break;
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
        if (proj.type === 1) {
          this.explodeMine(proj, proj.owner);
        } else if (hostile) {
          const speed = Math.hypot(proj.vx, proj.vy) || 1;
          this.damageWorm(w, proj.damage, -1, proj.vx / speed, proj.vy / speed);
          proj.active = false;
        } else {
          this.eatProjectile(proj, w);
        }
        return true;
      }
    }
    return false;
  }

  /** Spear pass: every hostile on the line takes damage once, then the spear keeps going. */
  private spearHitsGauntlet(proj: Projectile): void {
    const speed = Math.hypot(proj.vx, proj.vy) || 1;
    const ux = proj.vx / speed;
    const uy = proj.vy / speed;

    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const bit = 1 << i;
      if ((proj.hitErrors & bit) !== 0) continue;
      const rr = proj.radius + CASCADING_ERROR.blockSize * 0.5;
      const dx = proj.x - e.x;
      const dy = proj.y - e.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      proj.hitErrors |= bit;
      this.damageError(e, proj.damage, proj.owner, ux, uy);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const bit = 1 << i;
      if ((proj.hitSentries & bit) !== 0) continue;
      const rr = proj.radius + s.radius;
      const dx = proj.x - s.x;
      const dy = proj.y - s.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      proj.hitSentries |= bit;
      this.damageSentry(s, proj.damage, proj.owner, ux, uy, FISHER.spearKnockback);
      if (s.active && this.nearCoverAhead(s.x, s.y, ux, uy, FISHER.spearPinRange)) s.pinT = FISHER.spearPin;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const bit = 1 << i;
      if ((proj.hitViruses & bit) !== 0) continue;
      const rr = proj.radius + v.radius;
      const dx = proj.x - v.x;
      const dy = proj.y - v.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      proj.hitViruses |= bit;
      this.damageVirus(v, proj.damage, proj.owner, ux, uy, FISHER.spearKnockback * 0.6);
      if (v.active && this.nearCoverAhead(v.x, v.y, ux, uy, FISHER.spearPinRange)) v.pinT = FISHER.spearPin;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const bit = 1 << i;
      if ((proj.hitWorms & bit) !== 0) continue;
      let hitX = w.x;
      let hitY = w.y;
      let touching = false;
      const hr = proj.radius + WORM.headRadius;
      if ((proj.x - w.x) * (proj.x - w.x) + (proj.y - w.y) * (proj.y - w.y) <= hr * hr) {
        touching = true;
      } else {
        for (let s = 0; s < w.segCount; s++) {
          const sr = proj.radius + WORM.segmentRadius;
          const dx = proj.x - w.segX[s];
          const dy = proj.y - w.segY[s];
          if (dx * dx + dy * dy > sr * sr) continue;
          touching = true;
          hitX = w.segX[s];
          hitY = w.segY[s];
          break;
        }
      }
      if (!touching) continue;
      proj.hitWorms |= bit;
      this.damageWorm(w, proj.damage, proj.owner, ux, uy, FISHER.spearKnockback);
      if (w.active && this.nearCoverAhead(hitX, hitY, ux, uy, FISHER.spearPinRange)) w.pinT = FISHER.spearPin;
    }
  }

  /** True when cover or an arena wall sits just ahead of a point. */
  private nearCoverAhead(x: number, y: number, ux: number, uy: number, range: number): boolean {
    const aheadX = x + ux * range;
    const aheadY = y + uy * range;
    if (
      aheadX < this.arena.bounds.left ||
      aheadX > this.arena.bounds.right ||
      aheadY < this.arena.bounds.top ||
      aheadY > this.arena.bounds.bottom
    ) {
      return true;
    }
    return this.lineBlocked(x, y, aheadX, aheadY);
  }

  /** Close-range punch layered onto the deflect swing. Projectiles keep priority. */
  private resolveSwingContact(p: Player): void {
    if (p.swingHit) return;
    const cos = Math.cos(p.swingFacing);
    const sin = Math.sin(p.swingFacing);
    const whip = p.powerupT > 0 && p.powerupKind === POWERUP_KIND.WHIP;
    const whipMult = whip ? POWERUP.whipMultiplier : 1;
    const broomBig = p.program === PROGRAM_ID.SWEEP && p.swingKind === 3;
    const broomDiag = p.program === PROGRAM_ID.SWEEP && p.swingKind !== 0 && !broomBig;
    const reach = (broomBig ? SWEEP.bigReach : PLAYER.punchReach) * whipMult;
    const damage = (broomBig ? SWEEP.bigDamage : PLAYER.punchDamage) * whipMult;
    const baseForce = broomBig ? SWEEP.bigKnockback : broomDiag ? SWEEP.comboKnockback : PLAYER.punchKnockback;
    const force = (p.thrall ? PLAYER.thrallSwingKnockback : baseForce) * (whip ? 1.8 : 1);
    // A sweep shoves sideways, not straight away. The two tap directions throw
    // targets opposite ways, so the lash reads as a physical arc rather than a shove.
    const sweepDir = p.swingDir < 0 ? -1 : 1;
    let shoveX = -sin * sweepDir;
    let shoveY = cos * sweepDir;
    if (broomBig) {
      // The big third hit is a forward push, not a sideways lash.
      shoveX = cos;
      shoveY = sin;
    } else if (broomDiag) {
      // Small broom hits throw on a diagonal: mostly across the arc, partly forward.
      shoveX = -sin * sweepDir * 0.86 + cos * 0.5;
      shoveY = cos * sweepDir * 0.86 + sin * 0.5;
      const mag = Math.hypot(shoveX, shoveY) || 1;
      shoveX /= mag;
      shoveY /= mag;
    }

    // A deployed wall is solid: a lash chips the plate instead of reaching a body behind it.
    for (let i = 0; i < this.barriers.length; i++) {
      const wall = this.barriers[i];
      if (!wall.active) continue;
      const vx = wall.x2 - wall.x1;
      const vy = wall.y2 - wall.y1;
      const len2 = vx * vx + vy * vy;
      const wt = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - wall.x1) * vx + (p.y - wall.y1) * vy) / len2)) : 0;
      const wdx = wall.x1 + vx * wt - p.x;
      const wdy = wall.y1 + vy * wt - p.y;
      const wd = Math.hypot(wdx, wdy);
      if (wd > reach + WEDGE.wallThickness * 0.5 || wd < 0.001) continue;
      if ((wdx / wd) * cos + (wdy / wd) * sin < SWING_COS) continue;
      this.damageBarrier(wall, 1);
      this.markSwingHit(p);
      return;
    }

    // A file box in the arc eats the swing: it is debris, not cover, but a lash still
    // has to connect with it before it reaches a body behind it.
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.active || b.dropT > 0) continue;
      const dx = b.x + b.w * 0.5 - p.x;
      const dy = b.y + b.h * 0.5 - p.y;
      const d = Math.hypot(dx, dy);
      if (d > reach + Math.max(b.w, b.h) * 0.5 || d < 0.001) continue;
      if ((dx / d) * cos + (dy / d) * sin < SWING_COS) continue;
      // A lash launches the box first; the damage is a chip, so one hit never deletes it.
      this.launchProp(b, shoveX, shoveY, FILE_PROP.launchSpeed);
      this.damageProp(b, damage, b.x + b.w * 0.5, b.y + b.h * 0.5);
      this.markSwingHit(p);
      return;
    }

    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target === p || !target.active || !target.alive || target.iframes > 0) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > reach + PLAYER.radius || d < 0.001) continue;
      if ((dx / d) * cos + (dy / d) * sin < SWING_COS) continue;
      this.damagePlayer(target, damage, p.slot, shoveX, shoveY, force);
      this.markSwingHit(p);
      return;
    }

    if (this.mode === 'training' && this.drone.active) {
      const dx = this.drone.x - p.x;
      const dy = this.drone.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= reach + this.drone.radius && d > 0.001 && (dx / d) * cos + (dy / d) * sin >= SWING_COS) {
        this.damageDrone(damage, p.slot);
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
      this.damageSentry(s, damage, p.slot, shoveX, shoveY, force);
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
      this.damageVirus(v, damage, p.slot, shoveX, shoveY, force);
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
      this.damageWorm(w, damage, p.slot, shoveX, shoveY, force);
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
      this.damageError(e, damage, p.slot, shoveX, shoveY);
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
