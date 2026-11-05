import type { AssaultPortal, BossIntro, Fragment } from './types';
import { MEMORY } from './memory';
import {
  AIMBOT,
  ATTRACT,
  ATOMIZE,
  BOLT,
  BUFFER,
  BUG,
  CAMERA_ZOOM,
  CAMPAIGN,
  CALIBRATION,
  COMPRESS,
  COPYPASTA,
  CASCADING_ERROR,
  EMITTER,
  FISHER,
  GHOST,
  INFECTION,
  MINE,
  NETWORK,
  SPACE_CADET,
  SWEEP,
  FIREWALL,
  FALL,
  WEDGE,
  BOSS_RUSH,
  GAUNTLET,
  KABOOM,
  KEYPAD,
  SCANNER,
  BROWSER,
  FILE_PROP,
  MAX_EVENTS,
  MAX_PLAYERS,
  PINBALL,
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
  MEGA_WORM,
  IDLE_HANDS,
  STARFISH,
  BLOB,
  STORM_CLOUD,
  USER,
  type Rect,
} from './config';
import {
  ARENAS,
  arenaSolids,
  TETROMINO_SHAPES,
  trafficZoneAt,
  discArmAngle,
  discArmLength,
  discArmPivotX,
  discArmPivotY,
  discHoleX,
  discHoleY,
  holdingCellLayout,
  keypadKeyState,
  KEYPAD_STATE,
  browserCycle,
  browserCursorAt,
  browserPhaseAt,
  BROWSER_STATE,
  scannerCycle,
  scannerLaserY,
  scannerPhaseAt,
  SCANNER_STATE,
  faxCycle,
  faxHeadX,
  faxHeadY,
  faxPhaseAt,
  faxRowAt,
  FAX_STATE,
  plugCycle,
  plugPhaseAt,
  PLUG_STATE,
  watchHandAngle,
  laptopCardY,
  laptopCellRect,
  type ArenaLaptopDef,
  type ArenaSmokeDef,
  type ArenaWatchDef,
  usbDriveRect,
  usbExtensionAt,
  usbFloorAt,
  usbFlowAt,
  satelliteFloorAt,
  satelliteSolarStateAt,
  satelliteTelescopeRectAt,
  SATELLITE_SOLAR_STATE,
  serverHeatStateAt,
  serverHeatZoneRects,
  SERVER_HEAT_STATE,
  carRouteAt,
  carProgressAt,
  carRouteLength,
  flipRowRectAt,
  flipTimeRectAt,
  flipRowStateAt,
  FLIP_STATE,
  rocketArcAt,
  rocketProgressAt,
  swipeDirectionAt,
  swipeIndexAt,
  swipePhaseAt,
  swipePopupActiveAt,
  type ArenaBrowserDef,
  type ArenaDef,
  type ArenaFaxDef,
  type ArenaKeypadDef,
  type ArenaPlugArcDef,
  type ArenaPlugDef,
  type ArenaPropDef,
  type ArenaSatelliteDef,
  type ArenaCarDef,
  type ArenaFlipDef,
  type ArenaInvadersDef,
  type ArenaPongDef,
  type ArenaRequestDef,
  type ArenaRocketDef,
  type ArenaScannerDef,
  type ArenaSwipeDef,
  type ArenaUsbDef,
  type DiscDef,
} from './arenas';
import type { CampaignDataCrate, CampaignIntro, CampaignOpening } from './campaign';
import {
  CALIBRATION_POWER_TUTORIAL,
  CALIBRATION_SKILL_TUTORIAL,
  CAMPAIGN_FINALE,
  INTAKE_CLEAR,
  INTAKE_WAKE,
  KITTY_TUTORIAL,
  KITTY_NETWORK,
  KITTY_FIRST_HOP,
  TutorialRunner,
  WARDEN_TUTORIAL, BOSS_INBOUND, type TutorialStep } from './tutorial';
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
import { BOSS_RUSH_ORDER, MINIBOSS, minibossDef } from './minibosses';
import { computeSpawns, stepPlayerMotion } from './movement';
import { POWERUP_KIND, isTimedPowerup, powerupDef, rollPowerup } from './powerups';
import { Rng } from './rng';
import {
  ACTION,
  EV,
  PROP,
  SRC,
  type AimMark,
  type ArcadeBird,
  type ArcadeDrop,
  type ArcadeRaceCar,
  type ArcadeRuntime,
  type ArcadeShot,
  type Barrier,
  type CampaignPhase,
  type CascadingError,
  type CopyMark,
  type Drone,
  type Firewall,
  type GameEvent,
  type GameMode,
  type InputFrame,
  type LaserEmitter,
  type Lure,
  type Net,
  type Phase,
  type SatelliteMeteor,
  type InvaderShot,
  type Pipe,
  type Pickup,
  type Player,
  type Projectile,
  type Prop,
  type RequestCar,
  type CarRadioRuntime,
  type TrafficPhoto,
  type TrafficRuntime,
  type Sentry,
  type SmokeWave,
  type Virus,
  type Worm,
} from './types';

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

/** The sealed cell block in a tutorial holding room. The block is one body solid while
 *  the bars are powered; its back and sides are as solid as the front, so a body cannot
 *  walk around the painted bars into the cells. */
function campaignCellBarRects(arena: ArenaDef): Rect[] {
  const room = arena.rooms?.find((candidate) => candidate.theme === 'holding');
  if (!room) return [];
  const layout = holdingCellLayout(room);
  return [
    {
      x: layout.left,
      y: layout.top,
      w: layout.cellW * layout.cellCount,
      h: layout.bottom - layout.top,
    },
  ];
}

/**
 * Authoritative simulation. Hosted locally for training and by the room host online.
 * No allocations inside step(); see AGENTS.md §3.
 */
export class World {
  /** Gauntlet ingress bursts. Local-only and transient: edge portals, not campaign ports. */
  readonly assaultPortals: AssaultPortal[] = [
    { active: false, x: 0, y: 0, half: 44, t: 0, openDur: 0.3, burstHold: 0.2, closeDur: 0.5, count: 0, emitted: 0 },
    { active: false, x: 0, y: 0, half: 44, t: 0, openDur: 0.3, burstHold: 0.2, closeDur: 0.5, count: 0, emitted: 0 },
    { active: false, x: 0, y: 0, half: 44, t: 0, openDur: 0.3, burstHold: 0.2, closeDur: 0.5, count: 0, emitted: 0 },
  ];
  /** Pending gauntlet arrivals: 0 sentry, 1 worm, 2 virus, 3 mini-boss, 4 cascading error. */
  private assaultFamily: number[] = new Array(32).fill(0);
  private assaultKind: number[] = new Array(32).fill(0);
  private assaultQueueCount = 0;
  private assaultQueueIndex = 0;
  private assaultCooldown = 0;
  /** Air traffic control scope. Local-only: it never enters a snapshot. */
  radar: NonNullable<ArenaDef['radar']> | null = null;
  radarT = 0;
  private radarLap: number[] = [];
  private radarHitPlayers: number[] = [];
  private radarHitWorms: number[] = [];
  private radarHitViruses: number[] = [];
  private radarHitSentries: number[] = [];
  private radarHitErrors: number[] = [];
  readonly mode: GameMode;
  /** Local simulation: identity always comes from the program, never the slot. */
  readonly online = false;
  readonly arena: ArenaDef;
  /** Cover plus floor gaps. Bodies collide with this; shots only respect cover. */
  private solids: readonly Rect[] = [];
  /** Cover only: a dash clears floor gaps, but these still stop the body. */
  private dashSolids: Rect[] = [];
  /** Campaign cell-block collision while the block is sealed. Removed on release. */
  private campaignBarSolids: Rect[] = [];
  /** Breakable file boxes. Live boxes travel in Snapshot; physics stays host-side. */
  readonly props: Prop[];
  /** Destructible feed pipes. Local-only, like the floor fixtures they sit beside. */
  readonly pipes: Pipe[];
  /** Flash timers for round kickers. Local-only, read by the renderer. */
  readonly bumperFlash: Float32Array;
  /** Rearm clock for the Network Switch firewall starter. */
  firewallSwitchT = 0;
  firewallSwitchDwell = 0;
  firewallSwitchFlash = 0;
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
  /**
   * INFECTION run: a local timed clear on the gauntlet simulation. Like the campaign, it
   * keeps the `gauntlet` mode string so no threat, camera or network branch forks.
   */
  readonly infectionMode: boolean;
  /** Viruses deleted by the local player this run. */
  infectionKills = 0;
  /** True once the last virus is gone; `gauntletOver` freezes the cleared arena. */
  infectionCleared = false;
  /** True when the ring broke before the swarm was cleared. */
  infectionFailed = false;
  private infectionStarted = false;
  private infectionGrowT: number = INFECTION.growInterval;
  /** True after a scored gauntlet run has ended; the simulation holds the last frame. */
  gauntletOver = false;
  /**
   * BOSS RUSH: a gauntlet-mode ladder that walks the mini-boss registry once with no
   * fodder. It reuses the gauntlet simulation, entrance beats and threat pools, and it
   * stays local content: nothing here is in `Snapshot`.
   */
  readonly bossRush: boolean;
  /** True once the last boss of the ladder is down; the run freezes cleared. */
  bossRushCleared = false;
  /** 0-based ladder cursor: the boss on the floor, or the next one up. */
  private bossRushIndex = 0;
  private bossRushLive = false;
  private bossRushGapT = 0;
  /**
   * Local run rule for gauntlet and campaign. On, hostile fire can damage rival threat
   * families (the crossfire the docs call friendly fire). Off, a hostile shot passes
   * through worms, viruses and error blocks and only threatens players. Set once when
   * the run is created; never part of a snapshot.
   */
  friendlyFire = true;
  /**
   * Campaign companions the player deliberately attacked while locked on them, as a
   * slot bitmask. A companion stays an ally until that intent signal lands; a stray
   * shot or splash never flips it. Local-only, like the rest of the campaign run.
   */
  campaignAllyAggro = 0;
  /**
   * Campaign companions lost for the rest of the run, as a slot bitmask. A dead bot is
   * not brought back on a later arena or a resume; only a TPK retry restores the bots
   * that died in the arena being retried.
   */
  campaignBotsLost = 0;
  /** Internal bench/headless path: endless respawns and max threat caps. Not exposed in the UI. */
  /** One shard per player slot; PvE drops only. Local content, never in `Snapshot`. */
  readonly fragments: Fragment[] = Array.from({ length: MAX_PLAYERS }, () => ({
    active: false,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    age: 0,
    spin: 0,
    fromSlot: -1,
  }));

  readonly gauntletPractice: boolean;
  /**
   * Campaign script running on the gauntlet simulation: sparring drill, breach warning,
   * then the threat assault. Local-only like the rest of the sandbox.
   */
  readonly campaign: boolean;
  readonly campaignIntro: CampaignIntro;
  /** Threats needed to clear the assault; a lesson node may shorten it. */
  campaignKillsToClear: number;
  /** Mini-boss that ends the node, or -1 for a port/kill clear. */
  campaignBoss: number;
  private campaignBossSpawned = false;
  /** Bodies already on the floor when a feed room's assault starts. */
  private campaignOpening: CampaignOpening | null = null;
  /** This node is the authored route's end, so a boss clear plays the finale. */
  private campaignFinale = false;
  /** script_kitty's landing line for this node; narration only. */
  private readonly campaignBlurb: readonly TutorialStep[] | null;
  /** True once the calibration class has been placed in this world. */
  private campaignShapesSpawned = false;
  /** Holding's live skill briefing has been handed to the player. */
  private campaignSkillLessonTaught = false;
  /** True once the mini-boss has been announced; the spawn waits out the warning. */
  private campaignBossWarned = false;
  /** Seconds left before the announced mini-boss arrives. */
  private campaignBossWarnT = 0;
  /** Kitty's warning line, shown over play until the body arrives. Local presentation. */
  campaignWarnStep: TutorialStep | null = null;
  /** Bumped on each announcement so the DOM box refreshes even for the same line. */
  campaignWarnSerial = 0;
  /** The node's onboarding lesson. Null when the node opens straight into play. */
  tutorial: TutorialRunner | null = null;
  campaignPhase: CampaignPhase = 'none';
  /** Beat between the last lesson and the subjects waking or the breach starting. */
  private tutorialGrace = 0;
  private tutorialFinished = false;
  private tutorialCatchSeen = 0;
  private tutorialBoltT = 0;
  /** Calibration shapes have woken; they no longer accept a dormant hit. */
  calibrationAwake = false;
  /** The holding-room civilians have been lost. Presentation-only; never in a snapshot. */
  campaignCiviliansLost = false;
  /** Countdown for the bars' release flash, read by the tutorial-room renderer. */
  campaignBarsFlashT = 0;
  /** The holding cells have opened; the bars render retracted. */
  campaignBarsOpen = false;
  private campaignCivilianLossT = 0;
  /** After the Warden lesson, wait for the player to reach holding before waking the class. */
  private campaignHoldingWait = 0;
  /** Seconds inside the current campaign phase. */
  campaignT = 0;
  campaignBannerT = 0;
  /** Starting length of the current campaign banner, for the renderer fade. */
  campaignBannerDur = 0;
  /** 0 drill, 1 breach/inbound, 2 cleared, 3 failed, 4 calibration, 5 awake, 6 cell release. */
  campaignBannerKind = 0;
  /** Solver inputs kept apart from the removable gates and cell bars. */
  private baseSolids: readonly Rect[] = [];
  private baseDashSolids: readonly Rect[] = [];
  /** Enemy ingress ports closed this run, and how many the arena authored. */
  portsClosed = 0;
  portTotal = 0;
  /** Every enemy port is closed, so the right-wall exit portal is opening. */
  campaignExitReady = false;
  /** Seconds into the campaign portal pull; negative means idle. */
  campaignPortalT = -1;
  /** Quiet lead-in: the camera can show the whole floor before the mouth pulls. */
  private campaignPortalLead = 0;
  /** Grace after the last live body/port before the exit portal is allowed to open. */
  private campaignClearWait = 0;
  /** Seconds left on the left-wall entry portal after a hop. Presentation only. */
  entryPortalT = 0;
  /** Delay before the portal throw arms, so the impulse lands after the wipe opens. */
  private entryThrowT = 0;
  private entryThrowPending = false;

  /** Exit portal is live: campaign pull or match roundover. Read by the renderer. */
  get portalOpen(): boolean {
    return this.campaignPortalT >= 0 || this.campaignPortalLead > 0 || (this.mode === 'match' && this.phase === 'roundover');
  }

  /** Seconds into the live exit portal's animation. */
  get portalT(): number {
    return this.campaignPortalT >= 0 ? this.campaignPortalT : this.roundHopT;
  }
  /** Escalation wave in gauntlet mode. Purely local presentation + spawn pacing. */
  wave = 1;
  waveBannerT = 0;
  /** Frozen entrance cut-in; local presentation state, never networked. */
  bossIntro: BossIntro | null = null;
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
  /** Seconds into the round-end portal pull. Host-owned simulation state. */
  private roundHopT = 0;
  localSlot: number;

  readonly events: GameEvent[];
  eventCount = 0;

  /**
   * QA-only catch telemetry. Local to this World and never serialized into Snapshot.
   * Balance harnesses read it to separate shield/lash catches from deflects owned by
   * a program's kit (beam, atom ball, net, pinball arm, plow, broom, legacy wave).
   */
  readonly deflectTelemetry = {
    guard: new Uint16Array(MAX_PLAYERS),
    swing: new Uint16Array(MAX_PLAYERS),
    beam: new Uint16Array(MAX_PLAYERS),
    atom: new Uint16Array(MAX_PLAYERS),
    net: new Uint16Array(MAX_PLAYERS),
    arm: new Uint16Array(MAX_PLAYERS),
    plow: new Uint16Array(MAX_PLAYERS),
    broom: new Uint16Array(MAX_PLAYERS),
    wave: new Uint16Array(MAX_PLAYERS),
  };

  private serial = 0;
  private rng = new Rng(0xd3f1ec7);
  private spawnX = new Float32Array(MAX_PLAYERS);
  private spawnY = new Float32Array(MAX_PLAYERS);
  private spawnTmpX = new Float32Array(MAX_PLAYERS);
  private spawnTmpY = new Float32Array(MAX_PLAYERS);
  private wormSpawnT: number = GAUNTLET.wormSpawnDelay;
  /** Last wave each mini-boss gate fired on; one boss per gate entry. */
  private bossGateWave: number[] = new Array(GAUNTLET.bossSchedule.length).fill(-1);
  /** Idle Hands spawn group counter, so the palms read as one boss. */
  private handGroup = 0;
  /** Starfish group counter: one center plus its five arm bodies. */
  private starfishGroup = 0;
  private virusSpawnT: number = GAUNTLET.virusSpawnDelay;
  private firewallSpawnT: number = GAUNTLET.firewallSpawnDelay;
  /** Shared clock for arena emitters. `offset` per emitter staggers the beams. */
  private emitterT = 0;
  /** Kiosk only: how many local squad bodies the attract run opened (1-3). */
  private attractSquad = 1;
  private sentrySpawnT: number = SENTRY.spawnDelay;
  private sentryPack = 0;
  /** Sentry packs land one silhouette at a time instead of all at once. */
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
  /** COPYPASTA's summon writes the same frame a human or bot does. */
  private copyFrame: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
  /** A dash afterimage takes no actions; its shared frame stays empty. */
  private copyDecoyFrame: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
  private copyShootT = 0;
  private copySwingT = 0;
  private copyDashT = 0;
  private copyPhase = 0;
  /** Growing redaction stacks on marked bodies. Local-only, never in a snapshot. */
  readonly copyMarks: CopyMark[] = Array.from({ length: 16 }, () => ({
    active: false,
    kind: 0,
    id: -1,
    owner: -1,
    t: 0,
    count: 0,
    x: 0,
    y: 0,
  }));
  /** Aim Bot's red crosshairs. Local-only, never in a snapshot. */
  readonly aimMarks: AimMark[] = Array.from({ length: AIMBOT.volleyTargets }, () => ({
    active: false,
    kind: 0,
    id: -1,
    owner: -1,
    t: 0,
    x: 0,
    y: 0,
  }));
  /** Open-wall arena: the bounds are a lip, not a wall. Anything past it de-rezzes. */
  private readonly openWalls: boolean;
  /**
   * No outer wall for shots and beams. The body floor still clamps, but the Mega Worm
   * can be hit while it is staged outside the plate.
   */
  private readonly openShots: boolean;
  /** Compactor cycle time, in seconds since this cycle began. Public for the renderer. */
  pusherT = 0;
  /** Seconds of warning left before the arm moves; 0 outside the warning window. */
  pusherWarnT = 0;
  /** Phone-pad floor layout. Timing stays host-side; the shared clock travels in Snapshot. */
  readonly keypad: ArenaKeypadDef | null;
  /** Shared phase for all ten keys. Public for the renderer. */
  keypadT = 0;
  /** Current KEYPAD_STATE for each key. Public for the renderer. */
  readonly keypadStates: Uint8Array;
  private readonly keypadPrevStates: Uint8Array;
  /** Reused point for worm segment pushes; keeps the pad out of the allocation path. */
  private readonly keypadBodyScratch = { x: 0, y: 0 };
  /** Document-scanner bed. Snapshot carries its clock and page. */
  readonly scanner: ArenaScannerDef | null;
  /** Page cycle clock, page index and current phase. Public for the renderer. */
  scannerT = 0;
  scannerPage = 0;
  scannerPhase: number = SCANNER_STATE.load;
  /** Fax sheet and compact row print head. Local-only. */
  readonly fax: ArenaFaxDef | null;
  faxT = 0;
  faxPage = 0;
  faxRow = 0;
  faxPhase: number = FAX_STATE.readyLeft;
  /** SMART PLUG circuit ring. Local-only; the green/red clock is not in SnapshotHazards. */
  readonly plug: ArenaPlugDef | null;
  plugT = 0;
  plugPhase: number = PLUG_STATE.safe;
  /** SMOKE DETECTOR face, sensors, siren and destructible battery. Local-only. */
  readonly smoke: ArenaSmokeDef | null;
  readonly smokeBattery: Prop | null = null;
  smokeT = 0;
  smokeAlarm = false;
  smokeAlarmT = 0;
  smokeCooldownT = 0;
  readonly  smokeWaves: SmokeWave[] = [];
  private smokeWaveT = 0;
  private smokeHitNx = 0;
  private smokeHitNy = 0;
  /** SMART WATCH face and sweeping second hand. Local-only. */
  readonly watch: ArenaWatchDef | null;
  watchT = 0;
  watchAngle = -Math.PI * 0.5;
  private watchTurn = 0;
  private watchHitPlayers = 0;
  private watchHitWorms = 0;
  private watchHitViruses = 0;
  private watchHitSentries = 0;
  private watchHitErrors = 0;
  private watchHitDrone = false;
  private watchHitNx = 0;
  private watchHitNy = 0;
  /** BUSINESS LAPTOP inbox and message preview. Local-only. */
  readonly laptop: ArenaLaptopDef | null;
  laptopT = 0;
  laptopMessage = 0;
  laptopFlashT = 0;
  /** Live inbox cards. Their y positions are refreshed from the shared clock. */
  readonly laptopCards: Rect[] = [];
  /** SPREADSHEET breakable cells, parallel to `laptop.sheet.cells`. Local-only. */
  readonly laptopCellRects: Rect[] = [];
  readonly laptopCellHp: number[] = [];
  /** SPREADSHEET selection cursor column. Presentation only, never collision. */
  laptopCursor = 0;
  /** Inbox cards plus the active message layout, used for body and shot collision. */
  laptopSolids: Rect[] = [];
  private laptopMessageT = 0;
  private readonly laptopBodyScratch = { x: 0, y: 0 };
  /** Forum browser. Snapshot carries the page and cycle clock; damage stays host-side. */
  readonly browser: ArenaBrowserDef | null;
  /** Active forum page and the clock driving its cursor and click. */
  browserPage = 0;
  browserT = 0;
  browserPhase: number = BROWSER_STATE.dwell;
  /** Large cursor and the current click flash, in world coordinates. */
  browserCursorX = 0;
  browserCursorY = 0;
  browserClickT = 0;
  /** Active page cover. Swapped when the cursor navigates. */
  browserSolids: Rect[] = [];
  private browserClickDone = false;
  private readonly browserBodyScratch = { x: 0, y: 0 };
  private readonly browserCursor = { x: 0, y: 0 };
  /** One bit per body family already read by the current pass. Local-only. */
  private scannerHitPlayers = 0;
  private scannerHitWorms = 0;
  private scannerHitViruses = 0;
  private scannerHitSentries = 0;
  private scannerHitErrors = 0;
  private scannerHitDrone = false;
  /** One bit per body family already hit by the current fax pass. Local-only. */
  private faxHitPlayers = 0;
  private faxHitWorms = 0;
  private faxHitViruses = 0;
  private faxHitSentries = 0;
  private faxHitErrors = 0;
  private faxHitDrone = false;
  /** One bit per body family already hit by the current red circuit pulse. */
  private plugHitPlayers = 0;
  private plugHitWorms = 0;
  private plugHitViruses = 0;
  private plugHitSentries = 0;
  private plugHitErrors = 0;
  private plugHitDrone = false;
  private plugHitNx = 0;
  private plugHitNy = 0;
  /** World y of the arm's leading edge. Public for the renderer. */
  pusherY = 0;
  /** True while the arm is descending. Public for the renderer. */
  pusherActive = false;
  /** Brief flash when the arm reaches its stop line; the renderer fades it out. */
  pusherFlashT = 0;
  /**
   * Platter rotation in seconds. Public for the renderer so the holes and the read arm
   * draw exactly where the simulation tests them. Frozen in hosted matches, because the
   * snapshot carries no disc phase.
   */
  discT = 0;
  /** USB hub layout. The shared `usbT` clock travels in SnapshotHazards online. */
  readonly usb: ArenaUsbDef | null;
  /** Shared drive cycle clock. Public for the renderer and bot safety checks. */
  usbT = 0;
  /** Current drive rectangles, rebuilt every tick from `usbT`. */
  readonly usbRects: Rect[] = [];
  private readonly usbDX = new Float32Array(4);
  private readonly usbDY = new Float32Array(4);
  private readonly usbFlowVec = { x: 0, y: 0 };
  /** SWIPE RIGHT layout. Both clocks travel in SnapshotHazards online. */
  readonly swipe: ArenaSwipeDef | null;
  /** Time since the opening card. The swipe beat index is derived from this. */
  swipeT = 0;
  /** Independent match-popup cycle clock. */
  swipePopupT = 0;
  /** Raised match-popup collision while it is up. Public for tests and bot safety. */
  swipePopupSolid: Rect | null = null;
  /** SATELLITE layout. Host-authoritative online; its clocks and live meteors travel in SnapshotHazards. */
  readonly satellite: ArenaSatelliteDef | null;
  /** ROCKET NAVIGATION layout and its growing trajectory wall. Local-only. */
  readonly rocket: ArenaRocketDef | null;
  /** Seconds since launch. Reset at the start of every round. */
  rocketT = 0;
  /** 0..1 arc progress. The renderer and the collision blocks share it. */
  rocketProgress = 0;
  /** Preallocated blocks that approximate the curved trajectory wall. */
  private readonly rocketBarrierRects: Rect[] = [];
  private readonly rocketScratch = { x: 0, y: 0 };
  /** CAR NAVIGATION layout and its capped, moving route trail. Local-only. */
  readonly car: ArenaCarDef | null;
  /** Seconds since the car started. Reset at the start of every round. */
  carT = 0;
  /** 0..1 route progress. The renderer and the collision blocks share it. */
  carProgress = 0;
  private readonly carBarrierRects: Rect[] = [];
  private readonly carScratch = { x: 0, y: 0 };
  /** PONG court and rally ball. Local-only; the snapshot does not carry a rally. */
  readonly pong: ArenaPongDef | null;
  pongBallX = 0;
  pongBallY = 0;
  pongBallVx = 0;
  pongBallVy = 0;
  pongBallActive = false;
  pongLeftY = 0;
  pongRightY = 0;
  pongScoreLeft = 0;
  pongScoreRight = 0;
  /** Delay before the next serve, in seconds. */
  pongServeT = 0;
  /** Point flash timer and 0 left / 1 right scorer. */
  pongScoreFlash = 0;
  pongScoreSide = 0;
  /** Brief paddle/body/wall glow after a return. */
  pongHitFlash = 0;
  private pongServeIndex = 0;
  private pongHitNx = 1;
  private pongHitNy = 0;
  /** DISPATCH / LOAD BALANCER request trains. Local-only; hosted rooms skip the arena. */
  readonly requests: ArenaRequestDef | null;
  /** Live request cars. Preallocated; a train is a short chain of these. */
  readonly requestCars: RequestCar[] = [];
  /** Seconds until the next train enters. */
  requestT = 0;
  /** Authored lane the next train will take, for the signal and renderer. */
  requestNextRoute = 0;
  private requestRouteIndex = 0;
  /** Food-court and arcade hazards. Local-only; never part of a snapshot. */
  readonly arcade: ArcadeRuntime | null;
  /** Traffic camera, traffic light and crosswalk host runtime; SnapshotHazards carries it online. */
  readonly traffic: TrafficRuntime | null;
  /** Car-radio dials, tuner needle and station clock; SnapshotHazards carries it online. */
  readonly radio: CarRadioRuntime | null;
  private readonly trafficPoint = { x: 0, y: 0 };
  /** GPU-board thermal cycle clock. Local-only; never part of a snapshot. */
  serverHeatT = 0;
  private serverHeatTickT = 0;
  private readonly serverHeatAreas: Rect[] = [];
  private sodaStaticPillars: Rect[] = [];
  private tetrisStaticPillars: Rect[] = [];
  private sodaRectScratch: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** AIRPORT split-flap board. Local-only; time tiles resolve as floor hazards. */
  readonly flip: ArenaFlipDef | null;
  flipT = 0;
  /** Current FLIP_STATE per board row. Public for the renderer and tests. */
  readonly flipStates: Uint8Array;
  private readonly flipPrevStates: Uint8Array;
  private readonly flipCellScratch: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** SPACE INVADERS simulated cannon and local shots. */
  readonly invaders: ArenaInvadersDef | null;
  invaderT = 0;
  invaderCannonX = 0;
  /** Cooldown before the next cannon shot; 0 means ready. */
  invaderFireT = 0;
  /** Time left in the visible aim-line lead-in. */
  invaderAimT = 0;
  invaderCannonFlash = 0;
  readonly invaderShots: InvaderShot[] = [];
  /** Shared solar/telescope clock, seconds into the run. */
  satelliteT = 0;
  /** Countdown to the next meteor shower. */
  satelliteMeteorT = 0;
  /** 0 idle, 1 thruster fuse, 2 reentry burn, 3 waiting to reset. */
  satelliteState = 0;
  /** Seconds left before the thrusters light. */
  satelliteThrusterT = 0;
  /** Seconds into the bottom-up burn. */
  satelliteReentryT = 0;
  /** Heat front, from the bottom lip upward. Public for the renderer. */
  satelliteHeatY = 0;
  /** Cooldown after the burn, before the arena resets. */
  satelliteResetT = 0;
  /** Preallocated meteor impacts. */
  readonly satelliteMeteors: SatelliteMeteor[] = [];
  /** Capsule containers that arm the thrusters when all of them break. */
  readonly satelliteCapsules: Prop[] = [];
  readonly satelliteTelescopeRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly satelliteCapDefs: ArenaPropDef[] = [];
  private satelliteSolarTickT = 0;
  private satelliteBurnTickT = 0;
  private satelliteTelescopePrev = 0;
  /** Current world angle of the read arm, from its pivot. Public for the renderer. */
  armAngle = 0;
  /** Read-arm pivot, fixed for the life of the arena. Public for the renderer. */
  armPivotX = 0;
  armPivotY = 0;
  /** Scratch for one arm contact: positional separation and the shove left behind. */
  private armMoveX = 0;
  private armMoveY = 0;
  private armShoveX = 0;
  private armShoveY = 0;
  /** Disc holes, returned as a rect so the existing fall pull can aim at one. */
  private discHoleScratch: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Scratch for the pinball arm: the nearest point on the paddle and a redirect target. */
  private pinNearX = 0;
  private pinNearY = 0;
  private pinAimX = 0;
  private pinAimY = 0;
  private pinAimBest2 = 0;
  private pinAimFound = false;
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

  /** Level rule: only the primitive family may spawn until the holding cell opens. */
  campaignPrimitivesOnly = false;

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
    infectionMode = false,
    campaignIntro: CampaignIntro = 'none',
    campaignClearKills = 0,
    bossRush = false,
    campaignBoss = -1,
    primitivesOnly = false,
    campaignOpening: CampaignOpening | null = null,
    campaignFinale = false,
    campaignDeadBots = 0,
    campaignBlurb: readonly TutorialStep[] | null = null,
  ) {
    this.mode = mode;
    this.campaignIntro = campaignIntro;
    this.campaignKillsToClear = campaignClearKills > 0 ? campaignClearKills : CAMPAIGN.killsToClear;
    this.campaign = campaign;
    this.infectionMode = infectionMode;
    this.bossRush = bossRush;
    this.campaignBoss = campaignBoss;
    this.campaignPrimitivesOnly = primitivesOnly;
    this.campaignOpening = campaignOpening;
    this.campaignFinale = campaignFinale;
    this.campaignBlurb = campaignBlurb;
    this.levelData = levelData ?? [];
    this.botSlots = Math.max(0, Math.min(MAX_PLAYERS - 1, botSlots));
    this.campaignBotsLost = campaignDeadBots & 0xfe;
    // Dynamic cover (soda stacks, Tetris blocks) mutates `pillars`. Give this World
    // its own list; the arena records in ARENAS are shared by every match and preview.
    this.arena =
      arena.soda || arena.tetris || arena.crosswalk
        ? { ...arena, pillars: arena.pillars.slice(), spawns: arena.spawns.slice() }
        : arena;
    this.radar = arena.radar ?? null;
    this.resetRadar();
    this.rocket = arena.rocket ?? null;
    if (this.rocket) {
      for (let i = 0; i < this.rocket.segments; i++) {
        this.rocketBarrierRects.push({ x: 0, y: 0, w: 0, h: 0 });
      }
    }
    this.car = arena.car ?? null;
    if (this.car) {
      for (let i = 0; i < this.car.segments; i++) {
        this.carBarrierRects.push({ x: 0, y: 0, w: 0, h: 0 });
      }
    }
    this.pong = arena.pong ?? null;
    if (this.pong) this.resetPong();
    this.requests = arena.requests ?? null;
    if (this.requests) {
      for (let i = 0; i < 24; i++) {
        this.requestCars.push({
          active: false,
          route: 0,
          s: 0,
          x: 0,
          y: 0,
          dirX: 1,
          dirY: 0,
          horizontal: true,
          hitPlayers: 0,
        });
      }
      this.resetRequests();
    }
    // Dynamic cover needs a per-World pillar list. `arenaSolids` is keyed by arena id,
    // so a shared global cache would hand one match another match's soda stack.
    this.sodaStaticPillars = this.arena.soda ? this.arena.pillars.slice() : [];
    this.tetrisStaticPillars = this.arena.tetris ? this.arena.pillars.slice() : [];
    this.arcade = this.makeArcadeRuntime();
    this.traffic = this.makeTrafficRuntime();
    this.radio = this.makeRadioRuntime();
    const serverHeatDef = this.arena.server;
    if (serverHeatDef?.heat) {
      for (let i = 0; i < serverHeatDef.modules.length; i++) {
        if (serverHeatDef.modules[i].kind === 'card') this.serverHeatAreas.push({ x: 0, y: 0, w: 0, h: 0 });
      }
      this.resetServerHeat();
    }
    this.flip = arena.flip ?? null;
    this.flipStates = new Uint8Array(this.flip?.rows.length ?? 0);
    this.flipPrevStates = new Uint8Array(this.flipStates.length);
    this.refreshFlipStates();
    this.flipPrevStates.set(this.flipStates);
    this.invaders = arena.invaders ?? null;
    if (this.invaders) {
      for (let i = 0; i < 10; i++) this.invaderShots.push({ active: false, x: 0, y: 0, vy: 0 });
      this.resetInvaders();
    }
    // The rocket arc is shot-only: it never blocks a body or a dash. The car route is
    // still real geometry and keeps its body collision.
    const routeBarrierRects = [...this.carBarrierRects];
    const staticSolids =
      arena.soda || arena.tetris || arena.crosswalk
        ? [...this.arena.pillars, ...routeBarrierRects]
        : routeBarrierRects.length > 0
          ? [...arenaSolids(this.arena), ...routeBarrierRects]
          : arenaSolids(this.arena);
    this.baseSolids = staticSolids;
    this.baseDashSolids = [...this.arena.pillars, ...routeBarrierRects];
    this.campaignBarSolids = campaign ? campaignCellBarRects(arena) : [];
    this.rebuildSolids();
    this.keypad = arena.keypad ?? null;
    this.keypadStates = new Uint8Array(this.keypad?.keys.length ?? 0);
    this.keypadPrevStates = new Uint8Array(this.keypadStates.length);
    this.refreshKeypadStates();
    this.keypadPrevStates.set(this.keypadStates);
    this.scanner = arena.scanner ?? null;
    this.scannerPhase = this.scanner ? scannerPhaseAt(0) : SCANNER_STATE.load;
    this.fax = arena.fax ?? null;
    this.faxPhase = this.fax ? faxPhaseAt(this.fax, 0) : FAX_STATE.readyLeft;
    this.plug = arena.plug ?? null;
    this.plugPhase = this.plug ? plugPhaseAt(this.plug, 0) : PLUG_STATE.safe;
    this.smoke = arena.smoke ?? null;
    this.watch = arena.watch ?? null;
    this.watchAngle = this.watch ? watchHandAngle(this.watch, 0) : -Math.PI * 0.5;
    this.laptop = arena.laptop ?? null;
    if (this.laptop) {
      for (let i = 0; i < this.laptop.cards; i++) {
        this.laptopCards.push({ x: this.laptop.inbox.x + 10, y: 0, w: this.laptop.inbox.w - 20, h: this.laptop.cardH });
      }
      const cells = this.laptop.sheet?.cells ?? [];
      for (let i = 0; i < cells.length; i++) {
        this.laptopCellRects.push({ x: 0, y: 0, w: 0, h: 0 });
        this.laptopCellHp.push(0);
      }
      this.resetLaptop();
    }
    this.browser = arena.browser ?? null;
    this.resetBrowser();
    this.bumperFlash = new Float32Array(arena.bumpers?.length ?? 0);
    this.openWalls = arena.walls === 'open';
    this.openShots = arena.openShots === true;
    this.pusherY = arena.bounds.top;
    if (arena.disc) {
      this.armPivotX = discArmPivotX(arena);
      this.armPivotY = discArmPivotY(arena);
      this.armAngle = discArmAngle(arena, 0);
    }
    this.usb = arena.usb ?? null;
    if (this.usb) {
      for (let i = 0; i < this.usb.drives.length; i++) this.usbRects.push({ x: 0, y: 0, w: 0, h: 0 });
      this.refreshUsb(0);
    }
    this.swipe = arena.swipe ?? null;
    this.satellite = arena.satellite ?? null;
    this.gauntletPractice = gauntletPractice;
    this.localSlot = localSlot;
    this.selectedProgram = clampProgram(program);
    this.players = new Array(MAX_PLAYERS);
    for (let i = 0; i < MAX_PLAYERS; i++) this.players[i] = createPlayer(i);
    this.projectiles = createProjectilePool();
    this.drone = createDrone();
    this.worms = new Array(
      GAUNTLET.maxWorms +
        MEGA_WORM.slots +
        IDLE_HANDS.hands +
        STARFISH.slots +
        BLOB.slots +
        STORM_CLOUD.slots +
        USER.slots,
    );
    for (let i = 0; i < this.worms.length; i++) this.worms[i] = createWorm();
    // INFECTION floods the floor, so that run owns a larger pool. Every other local mode
    // and every hosted match keep the gauntlet-sized pool.
    this.viruses = new Array(infectionMode ? INFECTION.maxViruses : GAUNTLET.maxViruses);
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
          hp: d.hp ?? FILE_PROP.hp,
          hitFlash: 0,
          dropT: 0,
          vx: 0,
          vy: 0,
          tx: 0,
          ty: 0,
          capacitor: d.capacitor === true,
          fixed: d.fixed === true,
        });
      }
    }
    if (this.smoke) {
      const smoke = this.smoke;
      const battery: Prop = {
        active: true,
        kind: PROP.BATTERY,
        x: smoke.battery.x,
        y: smoke.battery.y,
        w: smoke.battery.w,
        h: smoke.battery.h,
        hp: smoke.batteryHp,
        hitFlash: 0,
        dropT: 0,
        vx: 0,
        vy: 0,
        tx: 0,
        ty: 0,
        fixed: true,
      };
      this.smokeBattery = battery;
      this.props.push(battery);
      for (let i = 0; i < 8; i++) {
        this.smokeWaves.push({
          active: false,
          radius: 0,
          hitPlayers: 0,
          hitWorms: 0,
          hitViruses: 0,
          hitSentries: 0,
          hitErrors: 0,
          hitDrone: false,
        });
      }
    }
    if (this.satellite) {
      this.satelliteMeteorT = this.satellite.meteors.first;
      this.satelliteHeatY = arena.bounds.bottom;
      for (let i = 0; i < this.props.length; i++) {
        const b = this.props[i];
        if (!b.capacitor) continue;
        this.satelliteCapsules.push(b);
        const d = arena.props?.[i];
        if (d) this.satelliteCapDefs.push(d);
      }
      for (let i = 0; i < this.satellite.meteors.count; i++) {
        this.satelliteMeteors.push({ active: false, x: 0, y: 0, t: 0, hit: false });
      }
      this.solids = [...this.solids, this.satelliteTelescopeRect];
      this.dashSolids = [...this.dashSolids, this.satelliteTelescopeRect];
      this.satelliteTelescopeRect.y = arena.bounds.bottom + 200;
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
          warnT: 0,
          charge: 0,
          beamDist: 0,
          caught: false,
          spent: false,
          hitPlayers: 0,
        });
      }
    }
    // Feed pipes and their hostile file pool are local fixtures. A hosted room skips
    // this arena entirely, so neither side has to carry fixture state in a snapshot.
    this.pipes = [];
    if (mode !== 'match' && arena.pipes) {
      for (let i = 0; i < arena.pipes.length; i++) {
        const d = arena.pipes[i];
        this.pipes.push({
          active: true,
          x: d.x,
          y: d.y,
          angle: d.angle,
          radius: NETWORK.pipeRadius,
          hp: NETWORK.pipeHp,
          maxHp: NETWORK.pipeHp,
          fireT: (d.feed === 'pinball' ? SPACE_CADET.pipeFirst : NETWORK.pipeFirst) + (d.offset ?? 0),
          shots: 0,
          feed: d.feed === 'pinball' ? 1 : 0,
          hitFlash: 0,
          catchFlash: 0,
          catchT: 0,
          outX: d.x - Math.cos(d.angle) * NETWORK.tubeLength,
          outY: d.y - Math.sin(d.angle) * NETWORK.tubeLength,
          tubeLength: NETWORK.tubeLength,
          tubeWidth: NETWORK.tubeWidth,
        });
      }
      for (let i = 0; i < NETWORK.filePool; i++) {
        this.props.push({
          active: false,
          kind: i % 4,
          x: 0,
          y: 0,
          w: 38,
          h: 27,
          hp: 1,
          hitFlash: 0,
          dropT: 0,
          vx: 0,
          vy: 0,
          tx: 0,
          ty: 0,
          hazard: false,
          hurtCd: 0,
        });
      }
    }
    this.events = new Array(EVENT_CAPACITY);
    for (let i = 0; i < EVENT_CAPACITY; i++) this.events[i] = { kind: 0, slot: 0, x: 0, y: 0, power: 0, dirX: 0, dirY: 0 };
    // Players and pools exist now, so the first cover rebuild can safely push a body
    // out of a stack that would otherwise overlap its spawn.
    if (this.arcade) this.resetArcade();
    if (this.traffic) this.resetTraffic();
    if (this.radio) this.resetRadio();

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
      // Atomize and Compress use six-segment hulls. Spawn and respawn both read
      // maxHp, so setting it with the program is enough to carry the larger pool.
      p.maxHp = def.healthSegments ?? PLAYER.hp;
      // Pinball carries a third dodge charge and a wider, longer shield. These are
      // stored on the body so respawn, the dock and the guard share one source.
      p.dashMax = p.program === PROGRAM_ID.PINBALL ? PINBALL.dashCharges : PLAYER.dashCharges;
      p.dashCharges = p.dashMax;
      p.guardMax = PLAYER.guardDuration * (p.program === PROGRAM_ID.PINBALL ? PINBALL.guardDurationMult : 1);
      p.guardReach = PLAYER.guardReach * (p.program === PROGRAM_ID.PINBALL ? PINBALL.guardReachMult : 1);
      // Aim Bot has no crowd clear, so the sniper's melee is a combat knife: a longer,
      // wider and harder-shoving sweep than the shared lash. The renderer and every
      // body cone check read these caps, so respawn keeps the same blade.
      const aimBlade = p.program === PROGRAM_ID.AIMBOT;
      p.meleeReachMult = aimBlade ? AIMBOT.meleeReachMult : 1;
      p.meleeHalfAngle = PLAYER.swingHalfAngle * (aimBlade ? AIMBOT.meleeArcMult : 1);
      p.meleeKnock = PLAYER.punchKnockback * (aimBlade ? AIMBOT.meleeKnockMult : 1);
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
      else if (infectionMode) this.setupInfection();
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
    if (this.bossRush) {
      // Local co-op: every seated player enters, spaced like a training squad. A solo
      // rush takes the same path with one body.
      let active = 0;
      for (let i = 0; i < this.players.length; i++) if (this.players[i].active) active++;
      computeSpawns(Math.max(1, active), this.arena, this.spawnX, this.spawnY);
      this.spawnX[0] = left.x;
      this.spawnY[0] = left.y;
      for (let i = 0; i < this.players.length; i++) {
        const body = this.players[i];
        if (!body.active) continue;
        const sx = i === 0 ? left.x : this.spawnX[i];
        const sy = i === 0 ? left.y : this.spawnY[i];
        this.spawnX[i] = sx;
        this.spawnY[i] = sy;
        clearPlayerForSpawn(body, sx, sy, Math.atan2(this.centerY - sy, this.centerX - sx));
        body.thrall = false;
      }
    } else {
      clearPlayerForSpawn(p, left.x, left.y, 0);
      p.thrall = false;
    }
    this.infection = 0;
    this.gauntletKills = 0;
    this.gauntletT = 0;
    this.timeSlowT = 0;
    this.timeSlowOwner = -1;
    this.gauntletOver = false;
    this.firewallSwitchT = 0;
    this.firewallSwitchDwell = 0;
    this.firewallSwitchFlash = 0;
    if (this.usb) this.resetUsb();
    if (this.swipe) this.resetSwipe();
    if (this.satellite) this.resetSatellite();
    if (this.requests) this.resetRequests();
    if (this.arcade) this.resetArcade();
    if (this.traffic) this.resetTraffic();
    if (this.radio) this.resetRadio();
    this.resetServerHeat();
    for (let i = 0; i < this.pipes.length; i++) {
      const pipe = this.pipes[i];
      pipe.active = true;
      pipe.hp = pipe.maxHp;
      pipe.shots = 0;
      pipe.feed = this.arena.pipes?.[i]?.feed === 'pinball' ? 1 : 0;
      pipe.fireT = (pipe.feed === 1 ? SPACE_CADET.pipeFirst : NETWORK.pipeFirst) + (this.arena.pipes?.[i]?.offset ?? 0);
      pipe.hitFlash = 0;
      pipe.catchFlash = 0;
      pipe.catchT = 0;
    }
    this.wave = 1;
    this.waveBannerT = 0;
    this.wormSpawnT = GAUNTLET.wormSpawnDelay;
    this.virusSpawnT = GAUNTLET.virusSpawnDelay;
    this.firewallSpawnT = GAUNTLET.firewallSpawnDelay;
    this.emitterT = 0;
    for (let i = 0; i < this.emitters.length; i++) {
      const e = this.emitters[i];
      e.phase = 0;
      e.warnT = 0;
      e.charge = 0;
      e.beamDist = 0;
      e.caught = false;
      e.spent = false;
      e.hitPlayers = 0;
    }
    this.sentrySpawnT = SENTRY.spawnDelay;
    this.sentryPack = 0;
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
    if (!this.bossRush) {
      for (let i = 1; i < this.players.length; i++) {
        this.players[i].active = false;
        this.players[i].alive = false;
      }
    }
    this.bossRushIndex = 0;
    this.bossRushLive = false;
    this.bossRushGapT = BOSS_RUSH.firstDelay;
    this.bossRushCleared = false;
    // A campaign node authors ports instead (D58); a sandbox arena may carry a replicator.
    // A rush is a boss test bed, so it does not seed arena fodder of its own.
    if (!this.campaign && !this.bossRush) this.spawnArenaReplicators();
  }

  /**
   * INFECTION: the floor starts flooded and the colony keeps budding. Clear every virus
   * for the fastest time; the ring breaking ends the attempt. No worms, sentries, error
   * blocks or pickups, so a best time is about the swarm and the player. Arena hazards
   * still run: they are part of the route.
   */
  private setupInfection(): void {
    // Gauntlet setup parks slots 1+ because a solo run is one body. Infection is also a
    // co-op mode, so remember the connected guests before that reset and put them back.
    const roster: number[] = [];
    for (let i = 1; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.active && p.connected && p.name) roster.push(i);
    }
    this.setupGauntlet();
    for (let i = 0; i < roster.length; i++) {
      const p = this.players[roster[i]];
      p.active = true;
      p.connected = true;
      p.alive = true;
      p.hp = p.maxHp;
      p.thrall = false;
    }

    const active: Player[] = [];
    for (let i = 0; i < this.players.length; i++) if (this.players[i].active) active.push(this.players[i]);
    // A single left-side launch line. Everyone enters together, facing the colony;
    // no operator starts behind the swarm or on the far side of the room.
    const b = this.arena.bounds;
    const usb = this.arena.usb;
    const leftX = usb
      ? this.centerX - usb.hubRadius * 0.52
      : b.left + Math.max(64, (b.right - b.left) * INFECTION.leftSpawnFrac);
    const rowSpan = usb
      ? usb.hubRadius * 1.12
      : Math.min((b.bottom - b.top) * 0.54, Math.max(0, active.length - 1) * 78);
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const sy = this.centerY - rowSpan * 0.5 + (active.length === 1 ? 0 : (rowSpan * i) / (active.length - 1));
      this.spawnX[p.slot] = leftX;
      this.spawnY[p.slot] = sy;
      clearPlayerForSpawn(p, leftX, sy, Math.atan2(this.centerY - sy, this.centerX - leftX));
    }

    this.infectionKills = 0;
    this.infectionCleared = false;
    this.infectionFailed = false;
    this.infectionStarted = false;
    this.infectionGrowT = INFECTION.growInterval;
    this.infection = 0;
    this.wave = 1;
    this.waveBannerT = 0;

    // The colony enters from the right edge in a vertical queue. The players see the
    // tide arrive from one side instead of a ring closing around them. USB HUB has no
    // right-edge floor, so its opening swarm loads onto the east drive in a small grid.
    let spawned = 0;
    const rows = Math.max(1, INFECTION.startViruses);
    if (usb) {
      const east = this.usbRects[0];
      for (let i = 0; i < rows; i++) {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = east.x + east.w - 28 - col * 42;
        const y = east.y + 34 + row * 34;
        if (this.spawnVirus(x, y, false, false)) spawned++;
      }
    } else {
      for (let i = 0; i < rows; i++) {
        const y = b.top + 80 + ((i + 0.5) / rows) * (b.bottom - b.top - 160);
        if (this.spawnVirus(b.right - 120, y)) spawned++;
      }
    }
    // A failed spawn is only possible on a degenerate arena; the run still starts and
    // the first growth beat seeds the colony.
    this.infectionStarted = spawned > 0;
  }

  /**
   * First campaign node. INTAKE opens on the Warden lesson and places three dormant
   * subjects at target lock; HOLDING lands on an already-awake six-subject class. The
   * subjects are local-only; the host/guest snapshot has no campaign state.
   */
  private setupCampaign(): void {
    this.setupGauntlet();
    this.activateCampaignBots();
    this.spawnCampaignPorts();
    this.calibrationAwake = false;
    this.campaignT = 0;
    this.wave = CAMPAIGN.waveStart;
    this.waveBannerT = 0;
    this.campaignCiviliansLost = false;
    this.campaignBarsFlashT = 0;
    this.campaignBarsOpen = false;
    this.campaignCivilianLossT = 0;
    this.campaignHoldingWait = 0;
    this.campaignBossSpawned = false;
    this.campaignBossWarned = false;
    this.campaignBossWarnT = 0;
    this.campaignClearWait = 0;
    this.campaignWarnStep = null;
    this.campaignShapesSpawned = false;
    this.campaignSkillLessonTaught = false;
    // The kitty node is live fire under the briefing. Kitty talks over the fight; the
    // player never gets a quiet head start to walk the ports while she is still typing.
    if (this.campaignIntro === 'kitty') {
      this.campaignPhase = 'assault';
      this.tutorial = new TutorialRunner(KITTY_TUTORIAL);
      this.tutorialCatchSeen = this.tutorialCatchTotal();
      this.campaignBannerT = 0;
      this.beginAssault();
      return;
    }
    // A feed-room node opens in live fire. The port sweep is the whole fight, so there is
    // no calibration class or sparring beat. The squad stays loaded through every phase.
    if (this.campaignIntro === 'assault') {
      // Kitty gets one landing beat over live fire. It is narration, so it never
      // gates the breach or the clear; it only tells the player where they woke up.
      this.tutorial = this.campaignBlurb ? new TutorialRunner(this.campaignBlurb) : null;
      this.tutorialCatchSeen = this.tutorialCatchTotal();
      this.beginAssault();
      return;
    }
    this.campaignPhase = 'calibration';
    this.tutorial =
      this.campaignIntro === 'warden'
        ? new TutorialRunner(WARDEN_TUTORIAL)
        : this.campaignIntro === 'holding'
          ? new TutorialRunner(KITTY_FIRST_HOP)
          : null;
    this.tutorialCatchSeen = this.tutorialCatchTotal();
    this.campaignBannerKind = 4;
    this.campaignBannerT = CALIBRATION.bannerTime;
    this.campaignBannerDur = CALIBRATION.bannerTime;
    // Bots stay parked until the calibration subjects are cleared. The drill squad
    // then logs in on the existing ring with the player, before the breach removes it.
    // Intake does not place its three subjects until the target-lock lesson asks for a
    // subject to lock; loading them at setup gave the player five idle targets first.
    if (this.arena.rooms?.some((room) => room.theme === 'holding')) {
      this.spawnCalibrationShapes(6);
      // Wave 2 is already alive in the cells. These are the same bodies release wakes;
      // nothing is spawned on the power-down beat.
      this.spawnHeldCellThreats();
      // Holding is the escalation: its class is already awake and moving when the
      // player lands. `keepTutorial` leaves Kitty's arrival line in the box; the
      // skill briefing follows it once that line finishes.
      this.wakeCalibration(true);
    }
  }

  /**
   * The level's ingress ports. Ports join the same prop pool the file boxes use, so a
   * shot or a lash that already damages a box damages a port; they are fixed, so they
   * never slide. Every port is live from the first frame: the level opens populated and
   * the ports keep feeding it until they are closed. Local content, never a snapshot.
   */
  private spawnCampaignPorts(): void {
    this.portsClosed = 0;
    this.campaignExitReady = false;
    const ingress = this.arena.ingress;
    this.portTotal = ingress?.length ?? 0;
    if (!ingress) return;
    for (let i = 0; i < ingress.length; i++) {
      const p = ingress[i];
      // A port authored inside cover is unshootable: its square sits in a pillar, so no
      // ranged line reaches it and the sweep can never be finished. Nudge it onto the
      // nearest clear floor square rather than trusting the authored point blindly.
      const spot = this.clearPortSpot(p.x, p.y, p.size);
      this.props.push({
        active: true,
        kind: 0,
        x: spot.x - p.size * 0.5,
        y: spot.y - p.size * 0.5,
        w: p.size,
        h: p.size,
        hp: p.hp,
        hitFlash: 0,
        dropT: 0,
        vx: 0,
        vy: 0,
        tx: 0,
        ty: 0,
        fixed: true,
        portal: true,
        portalFamily: p.family,
        portalInterval: p.interval,
        // Stagger the first emission so two ports never fire on the same frame.
        portalT: 1.4 + i * 0.9,
        portalExit: false,
        portalMaxHp: p.hp,
      });
    }
  }

  /**
   * Enemy replicators. A device with no believable open port gets a machine that prints
   * copies of one family instead. It shares the port clock, the damage path and the close
   * beat, but it releases no bridge and is never part of a campaign port tally.
   */
  /**
   * The centre of a port that is not buried in cover. A port inside a pillar can never be
   * shot, which makes its level unwinnable; content should place them in the open, and
   * this keeps a bad placement from shipping as a dead end. Returns the authored point
   * when it is already clear.
   */
  private clearPortSpot(x: number, y: number, size: number): { x: number; y: number } {
    const half = size * 0.5;
    const clear = (px: number, py: number): boolean => {
      for (let i = 0; i < this.arena.pillars.length; i++) {
        const r = this.arena.pillars[i];
        if (px + half > r.x && px - half < r.x + r.w && py + half > r.y && py - half < r.y + r.h) return false;
      }
      return true;
    };
    if (clear(x, y)) return { x, y };
    const step = 40;
    for (let ring = 1; ring <= 8; ring++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const px = x + Math.cos(a) * step * ring;
        const py = y + Math.sin(a) * step * ring;
        if (px - half < this.arena.bounds.left || px + half > this.arena.bounds.right) continue;
        if (py - half < this.arena.bounds.top || py + half > this.arena.bounds.bottom) continue;
        if (clear(px, py)) return { x: px, y: py };
      }
    }
    return { x, y };
  }

  private spawnArenaReplicators(): void {
    // A restart rebuilds the floor: drop any replicator left from the previous run.
    for (let i = this.props.length - 1; i >= 0; i--) {
      if (this.props[i].replicator) this.props.splice(i, 1);
    }
    const list = this.arena.replicator;
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      this.props.push({
        active: true,
        kind: 0,
        x: r.x - r.size * 0.5,
        y: r.y - r.size * 0.5,
        w: r.size,
        h: r.size,
        hp: r.hp,
        hitFlash: 0,
        dropT: 0,
        vx: 0,
        vy: 0,
        tx: 0,
        ty: 0,
        fixed: true,
        portal: true,
        replicator: true,
        portalFamily: r.family,
        portalInterval: r.interval,
        // Give the player a beat before the first copy lands.
        portalT: 2.2 + i * 0.9,
        portalExit: false,
        portalMaxHp: r.hp,
      });
    }
  }

  /** Port clock: emits its family until the port is destroyed. */
  private updatePortals(dt: number): void {
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.portal || b.portalExit) continue;
      if (!b.active) continue;
      if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt);
      if (b.portalHitCd !== undefined && b.portalHitCd > 0) {
        b.portalHitCd = Math.max(0, b.portalHitCd - dt);
      }
      b.portalT = (b.portalT ?? 0) - dt;
      if (b.portalT > 0) continue;
      b.portalT = b.portalInterval ?? 6;
      this.emitPortThreat(b);
    }
  }

  /** One threat steps out of a port. A full family cap just skips the beat. */
  private emitPortThreat(b: Prop): void {
    const r = Math.max(b.w, b.h) * 0.5;
    const base = this.rng.range(0, Math.PI * 2);
    let x = b.x + b.w * 0.5;
    let y = b.y + b.h * 0.5;
    let clear = false;
    // Try the rim at three radii before giving up. A single jittered point failed
    // whenever the player held the only clear lane, which read as a dead source.
    for (let ring = 0; ring < 3 && !clear; ring++) {
      const dist = r + 30 + ring * 58;
      for (let k = 0; k < 6; k++) {
        const a = base + (k / 6) * Math.PI * 2;
        x = b.x + b.w * 0.5 + Math.cos(a) * dist;
        y = b.y + b.h * 0.5 + Math.sin(a) * dist;
        if (!this.sentryClear(x, y, SENTRY.pulse.radius)) continue;
        clear = true;
        break;
      }
    }
    if (!clear) return;
    const fam = b.portalFamily ?? 0;
    if (fam === 1) {
      let live = 0;
      for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) live++;
      if (!this.campaignPrimitivesOnly && live < this.virusLimit()) this.spawnVirus(x, y);
    } else if (fam === 2) {
      let live = 0;
      for (let i = 0; i < this.worms.length; i++) if (this.worms[i].active && this.worms[i].bossKind < 0) live++;
      if (live < this.wormLimit()) this.spawnWorm(x, y);
    } else {
      let live = 0;
      for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) live++;
      if (live < this.sentryLimit()) this.spawnSentry(0, x, y);
    }
    // A short emissive blip so the port reads as the source even from across a gap.
    this.emit(EV.PROP_HIT, 0, x, y, 1);
  }

  /** A port reaches zero: remove it at once and let the red-square burst own the death. */
  private closePort(b: Prop, x: number, y: number): void {
    b.active = false;
    b.hp = 0;
    b.hazard = false;
    // The burst is the death read. Nothing shrinks or lingers after this frame.
    this.emit(EV.PORTAL_BREAK, 0, x, y, Math.max(b.w, b.h));
    // A replicator is not a network port: it never counts toward the campaign tally, so
    // closing one cannot open the exit by itself.
    if (b.replicator) return;
    this.portsClosed++;
  }

  /**
   * A campaign room is clear only when every authored feed is down and every hostile
   * body is gone. A closed port can still have its last squad on the floor; opening the
   * exit at the last hit yanked players out mid-fight.
   */
  private campaignFloorClear(): boolean {
    if (this.portTotal > 0 && this.portsClosed < this.portTotal) return false;
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) return false;
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) return false;
    for (let i = 0; i < this.worms.length; i++) {
      if (this.worms[i].active && !this.worms[i].held) return false;
    }
    for (let i = 0; i < this.errors.length; i++) if (this.errors[i].active) return false;
    return true;
  }

  /**
   * Two seconds of quiet after the last live port or body. The final de-rez and the
   * port collapse get to finish before the exit mouth opens; without the hold the
   * suction yanked the room out from under the death animation.
   */
  private campaignClearHold(dt: number, clear: boolean): boolean {
    if (!clear) {
      this.campaignClearWait = 0;
      return false;
    }
    this.campaignClearWait += dt;
    return this.campaignClearWait >= CAMPAIGN.clearDelay;
  }

  /**
   * Opens the right-wall exit portal and starts the pull. This is the only campaign
   * exit: the room closes into a white square on its right side, every body is dragged
   * into it without collision, and the level clears when the pull finishes.
   */
  private beginCampaignPortal(): void {
    if (this.campaignPortalT >= 0 || this.campaignPhase === 'cleared' || this.campaignPhase === 'failed') return;
    this.campaignPortalT = 0;
    this.campaignPortalLead = CAMPAIGN.portalLead;
    this.campaignExitReady = true;
  }

  /**
   * Load the campaign squad beside the player. Bots are ordinary local bodies, and one
   * that is selected must be on the floor from the first frame of every campaign node,
   * not parked at the origin until the old drill beat. A NO BOTS run leaves slots 1+
   * inactive.
   */
  private activateCampaignBots(): void {
    const leader = this.players[0];
    for (let i = 1; i <= this.botSlots; i++) {
      if ((this.campaignBotsLost & (1 << i)) !== 0) continue;
      const p = this.players[i];
      p.active = true;
      p.connected = true;
      p.alive = true;
      p.thrall = false;
      p.hp = p.maxHp;
      p.energy = PLAYER.energyMax;
      p.respawnT = 0;
      this.drillSlotPos(i - 1, leader);
      const sx = this.spawnTmpX[i - 1];
      const sy = this.spawnTmpY[i - 1];
      clearPlayerForSpawn(p, sx, sy, Math.atan2(leader.y - sy, leader.x - sx));
    }
  }

  /**
   * The room is clear, but the story gets the last word before the pull. This is a live
   * narration beat over the quiet floor, never a pause in the simulation.
   */
  private beginCampaignExit(steps: readonly TutorialStep[], finale = false): void {
    this.campaignPhase = finale ? 'finale' : 'exit';
    this.campaignT = 0;
    this.campaignClearWait = 0;
    this.campaignBannerT = 0;
    this.tutorial = new TutorialRunner(steps);
    this.tutorialFinished = false;
    this.tutorialGrace = 0;
    this.tutorialCatchSeen = this.tutorialCatchTotal();
  }

  /**
   * Strong, short suction. Positions are written directly, so pillars, cell bars and
   * any other body collider are irrelevant: a body in a corner crosses the whole room
   * and lands in the portal. The step consumes no other simulation while this runs.
   */
  private tickCampaignPortal(dt: number): void {
    this.campaignPortalT += dt;
    const t = this.campaignPortalT;
    // A short open beat shows the mouth before the yank, then the pull is immediate.
    if (t < CAMPAIGN.portalOpenTime) return;
    const pull = t - CAMPAIGN.portalOpenTime;
    const targetX = this.arena.bounds.right - 36;
    const targetY = this.centerY;
    const k = Math.min(1, dt * (6 + pull * 18));
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive) continue;
      p.x += (targetX - p.x) * k;
      p.y += (targetY - p.y) * k;
      p.prevX = p.x;
      p.prevY = p.y;
      p.vx = 0;
      p.vy = 0;
      p.kx = 0;
      p.ky = 0;
      p.dashT = 0;
      p.wedgeT = 0;
      p.swingPhase = 0;
      p.swingT = 0;
      p.swingPct = 0;
      p.chargeT = 0;
      p.chargeHeld = false;
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      p.laserT = 0;
      p.guardT = 0;
      p.ocChargeT = 0;
      p.ocFadeT = 0;
    }
    if (t >= CAMPAIGN.portalPullTime) this.clearCampaign();
  }

  /**
   * A feed room opens with the level's authored opening squad plus its ports. The
   * opening is data on the level, not a room-name branch, so a node that wants a full
   * floor gets one immediately and a boss node is not left empty.
   */
  private seedAssaultFloor(): void {
    // A plate arena posts a squad on every plate beyond intake. A flat device posts the
    // same squad in every painted room beyond intake: the rooms are presentation, but
    // they are still the level's authored beats and the right places to meet a squad.
    const zones: { cx: number; cy: number }[] = [];
    const islands = this.arena.islands;
    if (islands) {
      for (let i = 1; i < islands.length; i++) {
        zones.push({ cx: islands[i].x + islands[i].w * 0.42, cy: islands[i].y + islands[i].h * 0.5 });
      }
    } else if (this.arena.rooms) {
      // A split room is the whole arena now, so it seeds itself instead of every room
      // after intake. A combined tutorial floor still skips its opening room.
      const start = this.arena.rooms.length > 1 ? 1 : 0;
      for (let i = start; i < this.arena.rooms.length; i++) {
        const room = this.arena.rooms[i];
        zones.push({ cx: room.x + room.w * 0.42, cy: room.y + room.h * 0.5 });
      }
    } else {
      // A single open arena (GRID ZERO) has neither islands nor painted rooms. Seed
      // around its working centre so its authored opening squad still lands on frame
      // one instead of waiting for the feed portals to fill the floor.
      const b = this.arena.bounds;
      const spawn = this.arena.spawns[0];
      zones.push({ cx: spawn?.x ?? (b.left + b.right) * 0.5, cy: spawn?.y ?? (b.top + b.bottom) * 0.5 });
    }
    const opening = this.campaignOpening;
    const sentryCount = opening?.sentries ?? 1;
    const virusCount = opening?.viruses ?? 0;
    const wormCount = opening?.worms ?? 0;
    for (let i = 0; i < zones.length; i++) {
      const { cx, cy } = zones[i];
      const spot = this.clearPortSpot(cx, cy, 80);
      // Sentries ring the room's working centre so they read as a squad, not a stack.
      for (let n = 0; n < sentryCount; n++) {
        if (this.sentryLiveCount() >= this.sentryPoolSize()) break;
        const angle = -Math.PI * 0.5 + (n - (sentryCount - 1) * 0.5) * 0.72;
        const dist = 78 + n * 22;
        let px = spot.x + Math.cos(angle) * dist;
        let py = spot.y + Math.sin(angle) * dist;
        if (!this.pointClearOfCover(px, py, 34)) {
          px = spot.x;
          py = spot.y;
        }
        this.spawnSentry(0, px, py);
      }
      for (let n = 0; n < virusCount; n++) {
        const angle = Math.PI * 0.5 + (n - (virusCount - 1) * 0.5) * 1.1;
        const dist = 96 + n * 30;
        let px = spot.x + Math.cos(angle) * dist;
        let py = spot.y + Math.sin(angle) * dist;
        if (!this.pointClearOfCover(px, py, 26)) {
          px = spot.x;
          py = spot.y;
        }
        this.spawnVirus(px, py);
      }
      for (let n = 0; n < wormCount; n++) {
        const angle = Math.PI + (n - (wormCount - 1) * 0.5) * 0.9;
        const dist = 118 + n * 30;
        let px = spot.x + Math.cos(angle) * dist;
        let py = spot.y + Math.sin(angle) * dist;
        if (!this.pointClearOfCover(px, py, 34)) {
          px = spot.x;
          py = spot.y;
        }
        this.spawnWorm(px, py);
      }
    }
  }

  /** Sentry pool size, used by the opening squad without reading a private array. */
  private sentryPoolSize(): number {
    return this.sentries.length;
  }

  private sentryLiveCount(): number {
    let live = 0;
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) live++;
    return live;
  }

  private virusLiveCount(): number {
    let live = 0;
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) live++;
    return live;
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
      if (i > 0 && i <= this.botSlots && p.name && (this.campaignBotsLost & (1 << i)) === 0) {
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

  /** Wave 1 is down. The cell block loses power and the already-held wave-2 bodies
   *  are released for the heavy lesson. */
  private beginCellRelease(): void {
    this.campaignPhase = 'release';
    this.calibrationAwake = false;
    this.campaignT = 0;
    this.openCampaignCellBars();
    this.campaignBarsOpen = true;
    this.campaignBarsFlashT = 2.8;
    this.campaignBannerKind = 6;
    this.campaignBannerT = 2.6;
    this.campaignBannerDur = 2.6;
    this.clearTrainingShapes();
    for (let i = 0; i < this.projectiles.length; i++) this.projectiles[i].active = false;
    if (!this.campaignCiviliansLost) {
      this.campaignCivilianLossT = 0;
      this.loseCampaignCivilians();
    }
    if (this.campaignIntro === 'warden' || this.campaignIntro === 'holding') {
      this.tutorial = new TutorialRunner(CALIBRATION_POWER_TUTORIAL);
      this.tutorialFinished = false;
      this.tutorialGrace = 0;
    }
    // The release is a scripted cut, not a cheap hit: give the player a beat to see the
    // bars go before the first virus can touch them.
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].active) this.players[i].iframes = Math.max(this.players[i].iframes, 1.2);
    }
    this.releaseHeldCellThreats();
  }

  /**
   * Wave 2 is created with the level, not on the release frame. The bodies sit in
   * their cells with `held` set: AI, damage and targeting are skipped until the bars
   * lose power. The renderer draws the caged silhouettes in the same cells.
   */
  private spawnHeldCellThreats(): void {
    const room = this.arena.rooms?.find((candidate) => candidate.theme === 'holding');
    const cells = room ? holdingCellLayout(room) : null;
    if (!cells) {
      const player = this.players[0];
      this.spawnWorm(player.x, player.y - 40, true);
      this.spawnVirus(player.x - 90, player.y, true);
      this.spawnVirus(player.x + 90, player.y, true);
      return;
    }
    // Two full chains and eight viruses. The cell wave used to be three bodies, so the
    // bars opened onto a nearly empty block; this is a breakout, not a trickle.
    for (let k = 0; k < 2; k++) {
      const cell = k === 0 ? 0 : cells.cellCount - 1;
      const worm = this.spawnWorm(cells.left + cells.cellW * (cell + 0.5), cells.top + 52, true);
      if (!worm) continue;
      // Face up so the chain runs down the cell behind the painted caged silhouette.
      worm.angle = -Math.PI / 2;
      worm.biteDirX = 0;
      worm.biteDirY = -1;
      const ca = Math.cos(worm.angle);
      const sa = Math.sin(worm.angle);
      for (let i = 0; i < WORM.maxSegments; i++) {
        const sx = worm.x - ca * WORM.spacing * (i + 1);
        const sy = worm.y - sa * WORM.spacing * (i + 1);
        worm.segX[i] = sx;
        worm.segY[i] = sy;
        worm.segPrevX[i] = sx;
        worm.segPrevY[i] = sy;
        worm.segAngle[i] = worm.angle;
      }
    }
    for (let k = 1; k <= 8; k++) {
      const cell = k % cells.cellCount;
      this.spawnVirus(cells.left + cells.cellW * (cell + 0.5), cells.top + 52 + (k % 3) * 17, true);
    }
  }

  /** Wakes the existing wave-2 bodies; it never creates replacements. */
  private releaseHeldCellThreats(): void {
    const room = this.arena.rooms?.find((candidate) => candidate.theme === 'holding');
    const cells = room ? holdingCellLayout(room) : null;
    const b = this.arena.bounds;
    // The open floor south of the shallow cell row is the release lane. Every body gets
    // a waypoint there, so none of them stay behind the bars as a stationary target.
    const exitX = cells ? cells.left + cells.cellW * cells.cellCount * 0.5 : this.centerX;
    const exitY = cells ? Math.min(b.bottom - 72, cells.bottom + 210) : b.bottom - 160;
    let index = 0;
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || !v.held) continue;
      v.held = false;
      v.spawnT = 0;
      v.prevX = v.x;
      v.prevY = v.y;
      v.vx = 0;
      v.vy = 0;
      v.chargeT = 0;
      v.pinT = 0;
      v.contactCd = 0.4;
      v.targetWorm = -1;
      v.targetPlayer = false;
      v.roamX = exitX + (index - 3.5) * 54;
      v.roamY = exitY + (index % 2) * 28;
      v.retargetT = CAMPAIGN.holdingEmergeTime;
      index++;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || !w.held) continue;
      w.held = false;
      w.spawnT = 0;
      w.prevX = w.x;
      w.prevY = w.y;
      w.vx = 0;
      w.vy = 0;
      w.aggroT = 0;
      w.biteT = 0;
      w.biteCd = WORM.biteCooldown * 0.5;
      w.pinT = 0;
      w.anchorX = exitX + (index % 2 === 0 ? -70 : 70);
      w.anchorY = exitY;
      w.patrolX = w.anchorX;
      w.patrolY = w.anchorY;
      w.retargetT = CAMPAIGN.holdingEmergeTime;
      index++;
    }
  }

  /** Removes the sealed cell-block solid on the power-down beat. */
  private openCampaignCellBars(): void {
    if (this.campaignBarSolids.length === 0) return;
    this.campaignBarSolids = [];
    this.rebuildSolids();
  }

  /**
   * Rebuilds the body solver after the cell bars change. This runs on a milestone, not
   * per tick, so the movement loop still reads one flat array. A walkable deck is part
   * of the arena floor; it is never a gate and is never added here.
   */
  private rebuildSolids(): void {
    this.solids = [...this.baseSolids, ...this.campaignBarSolids];
    this.dashSolids = [...this.baseDashSolids, ...this.campaignBarSolids];
  }

  /**
   * Places the calibration class. Intake asks for three (one of each primary) at the
   * lock lesson; holding asks for the full six in front of its cell block.
   */
  private spawnCalibrationShapes(count = 6): void {
    const total = Math.max(1, Math.min(6, count));
    const kinds: (4 | 5 | 6)[] = total === 3 ? [4, 5, 6] : [4, 5, 6, 4, 5, 6];
    const focus = total >= 6 ? this.arena.rooms?.find((room) => room.theme === 'holding') : undefined;
    if (focus) {
      // The holding room gets a fixed two-column class formation. The centre lane stays
      // clear for the player entering from the bridge, and all six remain in front of the
      // sealed cell block instead of falling back to arena spawns elsewhere.
      const columns = [focus.x + focus.w * 0.24, focus.x + focus.w * 0.76];
      const rows = [
        focus.y + focus.h * 0.52,
        focus.y + focus.h * 0.70,
        focus.y + focus.h * 0.88,
      ];
      for (let i = 0; i < total; i++) {
        this.spawnCalibrationShape(kinds[i], columns[i % 2], rows[i % 3]);
      }
      this.campaignShapesSpawned = true;
      return;
    }

    const player = this.players[0];
    const base = Math.atan2(this.centerY - player.y, this.centerX - player.x);
    for (let i = 0; i < total; i++) {
      const kind = kinds[i];
      const angle = base + (i - (total - 1) * 0.5) * CALIBRATION.layoutSpread;
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
    this.campaignShapesSpawned = true;
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

  /**
   * While any subject is still assembling/opening, the whole class is untouchable.
   * A held burst otherwise deletes each subject the instant its eye opens, so the
   * player never sees the class fight back. One gate for all six keeps the reveal
   * whole and guarantees every subject is awake before damage can land.
   */
  private calibrationWakeInProgress(): boolean {
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active && s.kind >= 4 && s.kind <= 6 && s.shapeState === 1) return true;
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
  private wakeCalibration(keepTutorial = false): void {
    if (this.calibrationAwake) return;
    // A skipped lock lesson can reach the wake without the class existing. Spawn it
    // here so the wake never produces an empty arena that instantly counts as clear.
    if (!this.campaignShapesSpawned && !this.trainingParentsActive()) {
      this.spawnCalibrationShapes(this.campaignIntro === 'warden' ? 3 : 6);
    }
    this.calibrationAwake = true;
    let order = 0;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active || s.kind < 4 || s.kind > 6 || s.shapeState !== 0) continue;
      s.shapeState = 1;
      // One silhouette at a time. The player gets a clean look at each pattern
      // before the next subject joins, instead of six attacks landing together.
      s.shapeT = CALIBRATION.wakeTime + order * CALIBRATION.wakeStagger;
      order++;
      s.shapeAtkCd = 0;
      s.ramT = 0;
      s.ramDirX = 0;
      s.ramDirY = 0;
    }
    this.campaignBannerKind = this.campaignIntro === 'warden' ? 8 : 5;
    this.campaignBannerT = CALIBRATION.wakeBannerTime;
    this.campaignBannerDur = CALIBRATION.wakeBannerTime;
    // The class wakes in the holding office and turns on the civilian workers. Give
    // them a visible chase before the loss burst so the room reads as an attack, not
    // as scenery disappearing. Intake has its own shocked-Warden beat instead.
    this.campaignHoldingWait = 0;
    this.campaignCivilianLossT = this.campaignIntro === 'holding' ? 8.5 : 0.65;
    if (!keepTutorial && this.campaignIntro === 'warden') {
      this.tutorial = new TutorialRunner(INTAKE_WAKE);
      this.tutorialFinished = false;
      this.tutorialGrace = 0;
    } else if (!keepTutorial && this.campaignIntro === 'holding') {
      this.tutorial = new TutorialRunner(CALIBRATION_SKILL_TUTORIAL);
      this.tutorialFinished = false;
      this.tutorialGrace = 0;
    }
  }

  /** Hides the holding-office civilians after the class wakes and marks the loss with a
   *  short burst at each cart. They stay decorative: no bodies, hits or snapshot rows. */
  private loseCampaignCivilians(): void {
    if (this.campaignCiviliansLost) return;
    this.campaignCiviliansLost = true;
    const regulars = this.arena.regulars;
    if (!regulars) return;
    for (let i = 0; i < regulars.length; i++) {
      const p = regulars[i];
      this.emit(EV.EXPLODE, -1, p.x, p.y, 70);
    }
  }

  /**
   * One tick of the calibration subjects. They are ordinary sentry-pool bodies so every
   * player weapon already hits them, but they run their own script: wake together, spin,
   * then show one primary's attack. The gauntlet AI stays off until the drill.
   */
  private updateTrainingShapes(dt: number): void {
    // The holding class is awake during Kitty's short arrival beat. It can chase and
    // fire, but the beat itself cannot spend the player's health before control lands.
    if (this.campaignIntro === 'holding' && this.tutorial && !this.tutorial.done) {
      for (let i = 0; i < this.players.length; i++) {
        if (this.players[i].active) this.players[i].iframes = Math.max(this.players[i].iframes, 0.2);
      }
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      s.prevX = s.x;
      s.prevY = s.y;
      if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt);
      if (s.kind >= 7) {
        this.updateShapeChild(s, dt, this.threatTarget(s.x, s.y));
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
      if (s.kind === 4) this.updateCircleSubject(s, dt, this.threatTarget(s.x, s.y));
      else if (s.kind === 5) this.updateTriangleSubject(s, dt, this.threatTarget(s.x, s.y));
      else if (s.kind === 6) this.updateRectSubject(s, dt, this.threatTarget(s.x, s.y));
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
   * Red triangle: the parent drifts around the fight and fires a slow fan of fire
   * missiles. It is a readable ranged subject, never a swarm spawner.
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
    s.shapeAtkCd -= dt;
    if (s.shapeAtkCd > 0 || !p.alive || p.cloakT > 0) return;
    s.shapeAtkCd = cfg.cooldown;
    // The triangle used to release a cloud of tiny seeker bodies. A short, readable
    // fan of slow fire missiles is the whole attack now: each one is a normal hostile
    // projectile, so the guard and the lash can send it back without chasing a swarm.
    const aim = Math.atan2(p.y - s.y, p.x - s.x);
    const shots = Math.max(1, cfg.volley);
    for (let i = 0; i < shots; i++) {
      const offset = (i - (shots - 1) * 0.5) * cfg.volleySpread;
      const angle = aim + offset;
      const x = s.x + Math.cos(angle) * (s.radius + 18);
      const y = s.y + Math.sin(angle) * (s.radius + 18);
      this.spawnHostileProjectile(
        x,
        y,
        angle,
        cfg.missileSpeed,
        cfg.missileRadius,
        cfg.missileDamage,
        3,
        cfg.missileLife,
        self,
        1,
      );
    }
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
  private updateCampaign(dt: number, inputs: (InputFrame | null)[]): void {
    if (this.campaignPortalLead > 0) {
      this.campaignPortalLead = Math.max(0, this.campaignPortalLead - dt);
      return;
    }
    // The portal owns the room once it starts. No collision, hit or hazard tick runs
    // under the pull; updateCampaign is the only thing the step consumes.
    if (this.campaignPortalT >= 0) {
      this.tickCampaignPortal(dt);
      return;
    }
    if (this.campaignBannerT > 0) this.campaignBannerT = Math.max(0, this.campaignBannerT - dt);
    if (this.campaignBarsFlashT > 0) this.campaignBarsFlashT = Math.max(0, this.campaignBarsFlashT - dt);
    if (this.campaignCivilianLossT > 0) {
      this.campaignCivilianLossT = Math.max(0, this.campaignCivilianLossT - dt);
      if (this.campaignCivilianLossT <= 0) this.loseCampaignCivilians();
    }
    this.updateTutorial(dt, inputs[0] ?? null);
    if (this.campaignPhase === 'calibration') {
      this.campaignT += dt;
      // Holding's Kitty arrival line runs over an already-live class. Once it closes,
      // hand the skill briefing over without asking the player to perform it.
      if (
        this.campaignIntro === 'holding' &&
        this.calibrationAwake &&
        !this.campaignSkillLessonTaught &&
        this.tutorial?.done &&
        this.tutorialGrace <= 0
      ) {
        this.tutorial = new TutorialRunner(CALIBRATION_SKILL_TUTORIAL);
        this.tutorialFinished = false;
        this.tutorialGrace = 0;
        this.campaignSkillLessonTaught = true;
      }
      if (this.tutorial) {
        // The Warden holds the subjects dormant until the orientation is finished, so
        // the lesson is never interrupted by the pack waking on the old six-second timer.
        if (!this.tutorial.done) return;
        if (this.tutorialGrace > 0) {
          this.tutorialGrace = Math.max(0, this.tutorialGrace - dt);
          return;
        }
        if (!this.calibrationAwake) {
          const holding = this.arena.rooms?.find((room) => room.theme === 'holding');
          // Intake has no holding room. Its orientation ends by waking the six
          // subjects in front of the player, not by opening the portal over them.
          if (!holding) {
            this.wakeCalibration();
            return;
          }
          const player = this.players[0];
          const inHolding = player.x >= holding.x && player.x <= holding.x + holding.w && player.y >= holding.y && player.y <= holding.y + holding.h;
          if (this.campaignHoldingWait <= 0) this.campaignHoldingWait = CALIBRATION.entryWait;
          this.campaignHoldingWait = Math.max(0, this.campaignHoldingWait - dt);
          if (inHolding || this.campaignHoldingWait <= 0) this.wakeCalibration();
        }
      } else if (!this.calibrationAwake) {
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
      if (
        this.campaignClearHold(
          dt,
          this.calibrationAwake &&
            !this.trainingParentsActive() &&
            (!this.tutorial || this.tutorial.done),
        )
      ) {
        // Intake's fight is the whole orientation: Kitty gets one line in before the
        // first portal. HOLDING still runs the cell release and its second wave.
        if (this.campaignIntro === 'warden') this.beginCampaignExit(INTAKE_CLEAR);
        else this.beginCellRelease();
      }
      return;
    }
    if (this.campaignPhase === 'exit' || this.campaignPhase === 'finale') {
      this.campaignT += dt;
      if (this.tutorial && !this.tutorial.done) return;
      if (this.tutorialGrace > 0) {
        this.tutorialGrace = Math.max(0, this.tutorialGrace - dt);
        return;
      }
      this.beginCampaignPortal();
      return;
    }
    if (this.campaignPhase === 'release') {
      this.campaignT += dt;
      if (
        this.campaignClearHold(
          dt,
          this.campaignT > 0.9 &&
            !this.campaignThreatsActive() &&
            (!this.tutorial || this.tutorial.done),
        )
      ) {
        // The cell wave is down. HOLDING gets Kitty's network handoff before the pull;
        // a combined node keeps the old drill path for a future authored room.
        if (this.campaignIntro === 'holding') this.beginCampaignExit(KITTY_NETWORK);
        else this.beginDrill();
      }
      return;
    }
    if (this.campaignPhase === 'briefing') {
      this.campaignT += dt;
      if (this.tutorial && !this.tutorial.done) return;
      if (this.tutorialGrace > 0) {
        this.tutorialGrace = Math.max(0, this.tutorialGrace - dt);
        return;
      }
      this.beginBreach();
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
      if (this.campaignBoss >= 0) {
        // Boss node: every feed and every body is the run-up. Only then does the worm
        // arrive, and only its death clears the node. No wave spawner runs beside it.
        if (!this.campaignBossSpawned && this.campaignFloorClear()) {
          if (!this.campaignBossWarned) {
            // The floor is quiet: Kitty calls it, the card names it, and the body takes
            // its time entering. The warning is presentation only.
            this.campaignBossWarned = true;
            this.campaignBossWarnT = CAMPAIGN.bossWarnTime;
            this.campaignBannerKind = 7;
            this.campaignBannerT = CAMPAIGN.bossWarnBannerTime;
            this.campaignBannerDur = CAMPAIGN.bossWarnBannerTime;
            this.campaignWarnStep = BOSS_INBOUND[0] ?? null;
            this.campaignWarnSerial++;
            this.emit(EV.MEGA_CRY, -1, this.centerX, this.centerY, 1);
          } else {
            this.campaignBossWarnT = Math.max(0, this.campaignBossWarnT - dt);
            if (this.campaignBossWarnT <= 0) {
              this.campaignBossSpawned = true;
              this.campaignWarnStep = null;
              this.spawnMiniboss(this.campaignBoss, this.centerX + 260, this.centerY - 80);
            }
          }
        }
        if (
          this.campaignBossSpawned &&
          !this.bossIntro &&
          this.minibossLiveCount(this.campaignBoss) === 0
        ) {
          // The boss's own death burst plays out before the result overlay. This is
          // also the only path that clears a boss node, so a port or fodder kill can
          // never end the fight. The final node gets Kitty's send-off first.
          if (this.campaignClearHold(dt, true)) {
            if (this.campaignFinale) this.beginCampaignExit(CAMPAIGN_FINALE, true);
            else this.beginCampaignExit(KITTY_NETWORK);
          }
        } else {
          this.campaignClearWait = 0;
        }
        return;
      }
      if (this.portTotal > 0) {
        if (this.campaignClearHold(dt, this.campaignFloorClear())) this.beginCampaignPortal();
      } else if (
        this.campaignClearHold(dt, this.gauntletKills >= this.campaignKillsToClear)
      ) {
        this.clearCampaign();
      }
    }
  }

  /** Move only the threat families the cell release put on the floor. The normal
   *  gauntlet wave timers stay parked until the assault. */
  private updateCampaignThreats(dt: number): void {
    for (let i = 0; i < this.viruses.length; i++) {
      if (this.viruses[i].active && !this.viruses[i].held) this.updateVirus(this.viruses[i], dt);
    }
    for (let i = 0; i < this.worms.length; i++) {
      if (this.worms[i].active && !this.worms[i].held) this.updateWorm(this.worms[i], dt);
    }
  }

  private campaignThreatsActive(): boolean {
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active && !this.viruses[i].held) return true;
    for (let i = 0; i < this.worms.length; i++) if (this.worms[i].active && !this.worms[i].held) return true;
    return false;
  }

  /**
   * Drives the onboarding lesson. A reflect step arms one slow, harmless test shot every
   * couple of seconds; every other step reads the ordinary frame, so the lesson never
   * grants an action the player does not have.
   */
  private updateTutorial(dt: number, frame: InputFrame | null): void {
    const runner = this.tutorial;
    if (!runner || runner.done) return;
    const player = this.players[0];
    // Intake's three subjects arrive exactly when the lock lesson asks for a target.
    if (
      this.campaignPhase === 'calibration' &&
      this.campaignIntro === 'warden' &&
      !this.campaignShapesSpawned &&
      runner.current?.action === 'lock'
    ) {
      this.spawnCalibrationShapes(3);
    }
    if (runner.current?.action === 'reflect' || runner.current?.action === 'reflect-lock') {
      this.tutorialBoltT -= dt;
      if (this.tutorialBoltT <= 0) {
        this.spawnTutorialBolt();
        // Faster cadence keeps a three-catch lesson from feeling like a waiting room.
        this.tutorialBoltT = 1.35;
      }
    }
    const catches = this.tutorialCatchTotal();
    const reflected = catches > this.tutorialCatchSeen;
    this.tutorialCatchSeen = catches;
    runner.update({
      dt,
      frame,
      lockActive: player.alive && player.lockActive,
      reflected,
    });
    if (runner.done) this.finishTutorial();
  }

  private tutorialCatchTotal(): number {
    const t = this.deflectTelemetry;
    return (
      t.guard[0] +
      t.swing[0] +
      t.beam[0] +
      t.atom[0] +
      t.net[0] +
      t.arm[0] +
      t.plow[0] +
      t.broom[0] +
      t.wave[0]
    );
  }

  private finishTutorial(): void {
    if (this.tutorialFinished) return;
    this.tutorialFinished = true;
    this.tutorialGrace = 1.15;
    this.tutorialBoltT = 0;
  }

  /** Skips the rest of the lesson. The level still continues in the same order. */
  skipTutorial(): void {
    if (!this.tutorial || this.tutorial.done) return;
    // Skipping before the lock lesson must still arm the class the lesson would have
    // placed, or the skipped calibration has no floor to clear.
    if (
      this.campaignPhase === 'calibration' &&
      !this.campaignShapesSpawned &&
      !this.trainingParentsActive()
    ) {
      this.spawnCalibrationShapes(this.campaignIntro === 'warden' ? 3 : 6);
    }
    this.tutorial.skip();
    this.finishTutorial();
    // A skipped holding lesson must not sit out the entry wait before waking the
    // class. One short tick lets the normal calibration branch open the subjects.
    if (this.campaignHoldingWait <= 0) this.campaignHoldingWait = 0.01;
  }

  /** One slow hostile shot that cannot spend a health segment, for the reflect lesson. */
  private spawnTutorialBolt(): void {
    const p = this.players[0];
    if (!p.alive) return;
    let proj: Projectile | null = null;
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) {
        proj = this.projectiles[i];
        break;
      }
    }
    if (!proj) return;

    // Find a clear lane first. A test shot eaten by a pillar would leave the lesson
    // waiting with nothing to catch.
    const b = this.arena.bounds;
    const base = this.rng.range(0, Math.PI * 2);
    let ox = 0;
    let oy = 0;
    let found = false;
    for (let i = 0; i < 8; i++) {
      const a = base + (i / 8) * Math.PI * 2;
      const x = p.x + Math.cos(a) * 360;
      const y = p.y + Math.sin(a) * 360;
      if (x < b.left + 40 || x > b.right - 40 || y < b.top + 40 || y > b.bottom - 40) continue;
      if (!this.pointClearOfCover(x, y, 9)) continue;
      if (this.lineBlocked(x, y, p.x, p.y)) continue;
      ox = x;
      oy = y;
      found = true;
      break;
    }
    if (!found) return;
    const angle = Math.atan2(p.y - oy, p.x - ox);

    proj.active = true;
    proj.serial = ++this.serial;
    proj.type = 3;
    proj.owner = -1;
    proj.srcKind = SRC.NONE;
    proj.srcId = -1;
    proj.x = ox;
    proj.y = oy;
    proj.prevX = ox;
    proj.prevY = oy;
    proj.vx = Math.cos(angle) * 250;
    proj.vy = Math.sin(angle) * 250;
    proj.radius = 7;
    // Harmless on purpose: this shot teaches the catch, it does not grade it.
    proj.damage = 0;
    proj.deflects = 0;
    proj.bounces = 0;
    proj.fuse = 7;
    proj.grace = 0;
    proj.armed = false;
    proj.blastRadius = 0;
    proj.blastKnockback = 0;
    proj.arcDur = 0;
    proj.homing = false;
    proj.pathAxis = 0;
    proj.hits = 0;
    proj.spin = 0;
    proj.spinDir = 1;
    proj.variant = 0;
    proj.orbOwner = -1;
    proj.orbA = 0;
    proj.orbR = 0;
    proj.orbDir = 1;
    proj.hitPlayers = 0;
    proj.hitWorms = 0;
    proj.hitViruses = 0;
    proj.hitErrors = 0;
    proj.hitSentries = 0;
    proj.hitDrone = false;
    proj.trailHead = 0;
    proj.trailCount = 0;
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
    // The squad stays on the floor. A selected bot is a companion for the whole run,
    // not a drill prop that de-rezzes when the first hostile arrives.
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
    // A boss node uses the high live caps so its six corner feeders can actually fill
    // the room. The automatic gauntlet wave ramp stays off for every campaign node.
    this.wave = this.campaignBoss >= 0 ? MEGA_WORM.wave : CAMPAIGN.waveStart;
    this.waveBannerT = this.campaignBoss >= 0 ? 0 : 2.4;
    this.wormSpawnT = CAMPAIGN.openingWormDelay;
    // A node that opens straight into live fire still loads its crates.
    this.spawnCampaignData();
    // Every node opens with its authored squad, boss included. Waiting on the ports
    // left the first half-minute of the final arena empty.
    this.seedAssaultFloor();
    if (this.campaignBoss < 0) {
      this.spawnSentryPack();
      this.sentrySpawnT = CAMPAIGN.sentryInterval;
    }
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

  /** 1-based boss number for the HUD and the result plate. */
  get bossRushStage(): number {
    return Math.min(BOSS_RUSH_ORDER.length, this.bossRushIndex + 1);
  }

  get bossRushTotal(): number {
    return BOSS_RUSH_ORDER.length;
  }

  /**
   * BOSS RUSH: one mini-boss from the registry ladder at a time, no fodder, no wave
   * ramp. The gap between kills is breathing room and the boss entrance beat, not a
   * second spawn timer. Local content: the renderer and menus read this, snapshots do not.
   */
  private updateBossRush(dt: number): void {
    if (this.gauntletOver) return;
    const order = BOSS_RUSH_ORDER;
    if (this.bossRushLive) {
      const kind = order[this.bossRushIndex];
      if (kind !== undefined && this.minibossLiveCount(kind) > 0) return;
      // Leftover parts (Starfish arms, a split hand) are retired rather than carried
      // into the next fight, where they would read as a second boss.
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (w.active && w.bossKind === kind) w.active = false;
      }
      this.bossRushLive = false;
      this.bossRushIndex++;
      this.bossRushGapT = BOSS_RUSH.gap;
    }
    if (this.bossRushIndex >= order.length) {
      this.bossRushCleared = true;
      this.gauntletOver = true;
      return;
    }
    if (this.bossRushGapT > 0) {
      this.bossRushGapT = Math.max(0, this.bossRushGapT - dt);
      return;
    }
    let target = this.players[0];
    for (let i = 0; i < this.players.length; i++) {
      const body = this.players[i];
      if (body.active && body.alive) {
        target = body;
        break;
      }
    }
    if (!target || !target.alive) return;
    this.wave = this.bossRushIndex + 1;
    this.spawnMiniboss(order[this.bossRushIndex], target.x + 340, target.y - 60);
    this.bossRushLive = true;
  }

  /**
   * 0..1 of the swarm cleared. `kills / (kills + live)` means a fresh bud pushes the
   * meter down, and only a floor with nothing left on it reaches 100%.
   */
  get infectionProgress(): number {
    if (this.infectionCleared) return 1;
    let alive = 0;
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) alive++;
    const total = this.infectionKills + alive;
    if (total === 0) return 0;
    // A failed run can end with an empty floor (a hazard or a shove finished the
    // colony); it still never reads 100%, because 100% is reserved for the clear.
    return Math.min(0.99, this.infectionKills / total);
  }

  /** The run is decided: either the floor is clean or the ring broke. */
  get infectionOver(): boolean {
    return this.infectionCleared || this.infectionFailed;
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
    if (this.infectionMode) return INFECTION.maxViruses;
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
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.active && !p.copyClone) n++;
    }
    return n;
  }

  aliveCount(): number {
    let n = 0;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.active && p.alive && !p.copyClone) n++;
    }
    return n;
  }

  /** True once the player deliberately attacked this campaign companion. */
  campaignAllyHostile(slot: number): boolean {
    return this.campaign && slot > 0 && (this.campaignAllyAggro & (1 << slot)) !== 0;
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
    // If the departing body was the last active runner, the co-op attempt is over
    // even though no virus landed the final blow.
    if (this.infectionMode && !this.infectionOver && this.aliveCount() === 0) {
      this.infectionFailed = true;
      this.gauntletOver = true;
    }
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
    this.roundHopT = 0;
    this.beginRound();
  }

  /**
   * Couch drop-in. A pad claims a slot that was empty when the match was created.
   * The kit was already assigned in the constructor from `botPrograms`, so this only
   * activates the body and, mid-round, places it at the arena point farthest from
   * the live field rather than dropping it on top of a fight.
   */
  joinLocalPlayer(slot: number, name: string): boolean {
    const p = this.players[slot];
    if (!p || p.active) return false;
    p.active = true;
    p.connected = true;
    p.name = name;
    p.score = 0;
    p.thrall = false;
    p.copyClone = false;
    if (this.mode === 'match' && (this.phase === 'live' || this.phase === 'countdown' || this.phase === 'roundover')) {
      const spawn = this.farthestSpawn();
      this.spawnX[slot] = spawn.x;
      this.spawnY[slot] = spawn.y;
      const facing = Math.atan2(this.centerY - spawn.y, this.centerX - spawn.x);
      clearPlayerForSpawn(p, spawn.x, spawn.y, facing);
    }
    return true;
  }

  /** Reply spawn point with the largest distance to any active body. */
  private farthestSpawn(): { x: number; y: number } {
    const spawns = this.arena.spawns;
    let best: { x: number; y: number } = spawns[0] ?? { x: this.centerX, y: this.centerY };
    let bestD = -1;
    for (let i = 0; i < spawns.length; i++) {
      const s = spawns[i];
      let nearest = Infinity;
      for (let j = 0; j < this.players.length; j++) {
        const p = this.players[j];
        if (!p.active) continue;
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const d = dx * dx + dy * dy;
        if (d < nearest) nearest = d;
      }
      if (nearest > bestD) {
        bestD = nearest;
        best = s;
      }
    }
    return best;
  }

  beginRound(fromPortal = false): void {
    this.roundHopT = 0;
    this.clearCopyClones();
    this.clearAimMarks();
    if (this.keypad) this.resetKeypad();
    if (this.scanner) this.resetScanner();
    if (this.fax) this.resetFax();
    if (this.plug) this.resetPlug();
    if (this.smoke) this.resetSmoke();
    if (this.watch) this.resetWatch();
    if (this.laptop) this.resetLaptop();
    if (this.browser) this.resetBrowser();
    if (this.usb) this.resetUsb();
    if (this.swipe) this.resetSwipe();
    if (this.satellite) this.resetSatellite();
    if (this.rocket) this.resetRocket();
    if (this.car) this.resetCar();
    if (this.pong) this.resetPong();
    if (this.requests) this.resetRequests();
    if (this.arcade) this.resetArcade();
    if (this.traffic) this.resetTraffic();
    if (this.radio) this.resetRadio();
    this.resetServerHeat();
    if (this.flip) this.resetFlip();
    if (this.invaders) this.resetInvaders();
    const active = this.activeCount();
    if (active === 0) return;
    computeSpawns(active, this.arena, this.spawnTmpX, this.spawnTmpY);
    let index = 0;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || p.copyClone) continue;
      this.spawnX[p.slot] = this.spawnTmpX[index];
      this.spawnY[p.slot] = this.spawnTmpY[index];
      index++;
    }
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || p.copyClone) continue;
      const sx = this.spawnX[p.slot];
      const sy = this.spawnY[p.slot];
      const facing = Math.atan2(this.centerY - sy, this.centerX - sx);
      clearPlayerForSpawn(p, sx, sy, facing);
    }
    for (let i = 0; i < this.projectiles.length; i++) this.projectiles[i].active = false;
    // A hopped round starts on the new arena's left wall, not on its authored ring.
    if (fromPortal) this.enterAtPortal();
    this.phase = 'countdown';
    this.phaseTimer = ROUND.countdown;
    this.roundTimer = ROUND.timeLimit;
    this.roundWinner = -1;
    this.emit(EV.ROUND_START, -1, this.centerX, this.centerY, this.round);
  }

  /**
   * Places every live body on the left-wall entry portal. Used after a campaign hop and
   * by a hopped round, so the wipe opens on the room being entered rather than on a
   * spawn ring behind the player.
   */
  enterAtPortal(throwDelay = CAMPAIGN.portalThrowDelay): void {
    const b = this.arena.bounds;
    const active: Player[] = [];
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.active) active.push(p);
    }
    // Start under the mouth, not in front of it, and carry a decaying eastward impulse.
    // The campaign passes a longer delay so the body is visible in the entry square
    // before the throw; a round hop keeps the short default. Input still steers once
    // the throw is live, and entry protection covers the delay and the flight.
    const x = b.left + 36;
    const span = Math.min((b.bottom - b.top) * 0.5, Math.max(0, active.length - 1) * 62);
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const y = this.centerY - span * 0.5 + (active.length === 1 ? 0 : (span * i) / (active.length - 1));
      clearPlayerForSpawn(p, x, y, 0);
      p.iframes = Math.max(p.iframes, CAMPAIGN.portalEntryIframes);
    }
    this.entryThrowT = Math.max(0, throwDelay);
    this.entryThrowPending = true;
    this.entryPortalT = 3.4;
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
    // A staged boss entrance owns the room until its camera beat and reveal finish.
    // The Mega Worm is the exception: the squad keeps its feet and can move while the
    // body crosses the arena. The simulation below runs with the boss's own update
    // gated by `bossIntro`, so the entrance is not advanced twice.
    const megaEntrance = this.bossIntro?.kind === MINIBOSS.MEGA_WORM;
    if (this.bossIntro) {
      this.updateBossIntro(dt);
      if (!megaEntrance) {
        this.clearPressed(inputs);
        return;
      }
    }
    if (this.entryPortalT > 0) this.entryPortalT = Math.max(0, this.entryPortalT - dt);
    if (this.entryThrowPending) {
      this.entryThrowT = Math.max(0, this.entryThrowT - dt);
      if (this.entryThrowT <= 0) {
        this.entryThrowPending = false;
        for (let i = 0; i < this.players.length; i++) {
          const p = this.players[i];
          if (!p.active || !p.alive || p.travelT > 0) continue;
          p.kx = CAMPAIGN.portalThrowSpeed;
          p.ky = 0;
          p.iframes = Math.max(p.iframes, CAMPAIGN.portalEntryIframes);
        }
      }
    }
    if (this.campaign) this.updateCampaign(dt, inputs);
    // The campaign portal is a scripted exit: it owns the body until the room clears.
    if (this.campaign && this.campaignPortalT >= 0) {
      this.clearPressed(inputs);
      return;
    }
    if (this.mode === 'match') {
      if (this.phase === 'matchend') {
        this.clearPressed(inputs);
        return;
      }
      if (this.phase === 'roundover') {
        this.phaseTimer -= dt;
        this.tickRoundHopPull(dt);
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
    this.updateCopyClone(dt);
    if (this.arena.pushers && canAct) this.tickPusher(dt);
    // The pad clock travels in Snapshot. Advance it before the bodies move so a key
    // that starts its slam this frame resolves against the position the players were
    // standing on when the warning ended.
    if (this.keypad && canAct) this.tickKeypad(dt);
    // The browser page and its cursor are local state. Advance them before bodies move,
    // so a page swap is already reflected in this frame's cover.
    if (this.browser && canAct) this.tickBrowser(dt);
    // The inbox cards move and the preview layout swaps on the same beat; both are
    // collision cover, so refresh them before player movement.
    if (this.laptop && canAct) this.tickLaptop(dt);
    // A hosted match keeps the plate still: the snapshot has no disc phase, so a guest
    // could not agree with the host about which hole is underfoot. Local modes spin.
    if (this.arena.disc && canAct && this.mode !== 'match') this.tickDisc(dt);
    if (this.usb && canAct) this.tickUsb(dt);
    if (this.swipe && canAct) this.tickSwipe(dt);
    if (this.satellite && canAct) this.tickSatellite(dt);
    if (this.rocket && canAct) this.tickRocket(dt);
    if (this.car && canAct) this.tickCar(dt);
    if (this.pong && canAct) this.tickPong(dt);
    if (this.requests && canAct) this.tickRequests(dt);
    if (this.arcade && canAct) this.tickArcade(dt);
    if (this.traffic && canAct) this.tickTraffic(dt);
    if (this.radio && canAct) this.tickRadio(dt);
    if (this.arena.server?.heat && canAct) this.tickServerHeat(dt);
    if (this.radar && canAct) this.tickRadar(dt);
    if (this.flip && canAct) this.tickFlip(dt);
    if (this.invaders && canAct) this.tickInvaders(dt);
    if (this.plug && canAct) this.tickPlug(dt);
    if (this.smoke && canAct) this.tickSmoke(dt);
    if (this.watch && canAct) this.tickWatch(dt);
    for (let i = 0; i < this.bumperFlash.length; i++) {
      if (this.bumperFlash[i] > 0) this.bumperFlash[i] = Math.max(0, this.bumperFlash[i] - dt);
    }
    // The calibration prologue owns the room. Arena hazards wait for the drill, so a
    // stray beam cannot delete a trainee before the subjects have even opened their eyes.
    const calibrationHold = this.campaign && this.campaignPhase === 'calibration';
    if (this.emitters.length > 0 && canAct && !calibrationHold) this.updateEmitters(dt);

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active) continue;
      if (!p.alive) {
        // A copy is a temporary summon, not a match body: it never respawns and never
        // holds a round open after its owner goes down.
        if (p.copyClone) {
          this.despawnCopyClone(p);
          continue;
        }
        // The campaign's run-up is practice: both the player and the squad come back.
        // This timer ticks in every live campaign phase. Ticking it only during the drill
        // left a body that fell into a chasm during calibration permanently dead: the
        // lesson waited on an input it could never receive and the run had no overlay to
        // leave from. It also keeps ticking through the assault, so a body downed during
        // the breach is not stranded when the assault begins; a downed local player ends
        // the run on that same frame, which stops the timer.
        if (this.campaign && this.campaignPhase !== 'failed' && this.campaignPhase !== 'cleared') {
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
      if (this.usb) this.applyUsbPlayer(p, dt);

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
      // The feed tube owns the body while it travels between mouths.
      if (p.pipeTransitT > 0) continue;

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
        if (p.dashCd === 0 && p.dashCharges < p.dashMax) {
          p.dashCharges++;
          if (p.dashCharges < p.dashMax) p.dashCd = PLAYER.dashCooldown;
        }
      }
      if (p.guardCd > 0) p.guardCd = Math.max(0, p.guardCd - pdt);
      if (p.chargeDashCd > 0) p.chargeDashCd = Math.max(0, p.chargeDashCd - pdt);
      if (p.laserCd > 0) p.laserCd = Math.max(0, p.laserCd - pdt);
      if (p.beamReflectT > 0) p.beamReflectT = Math.max(0, p.beamReflectT - dt);
      if (p.ocFadeT > 0) p.ocFadeT = Math.max(0, p.ocFadeT - dt);
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
          if (p.powerupKind === POWERUP_KIND.OVERCHARGE) {
            p.laserT = 0;
            p.laserTickT = 0;
            p.ocChargeT = 0;
            p.ocFadeT = 0;
          }
          p.powerupKind = -1;
        }
      }
      if (p.ghostT > 0) p.ghostT = Math.max(0, p.ghostT - dt);
      if (p.cloakT > 0) p.cloakT = Math.max(0, p.cloakT - dt);
      if (p.aimSightT > 0) {
        p.aimSightT = Math.max(0, p.aimSightT - dt);
        // The clip belongs to the sight window, not to the slot forever.
        if (p.aimSightT === 0) p.aimClip = 0;
      }
      if (p.dazeT > 0) p.dazeT = Math.max(0, p.dazeT - dt);
      if (p.parryT > 0) p.parryT = Math.max(0, p.parryT - dt);
      if (p.pipeCooldown > 0) p.pipeCooldown = Math.max(0, p.pipeCooldown - dt);
      if (p.shrinkT > 0) p.shrinkT = Math.max(0, p.shrinkT - dt);
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

      const input = this.mode === 'gauntlet' && p.thrall
        ? this.thrallFrame
        : p.copyDecoy
          ? this.copyDecoyFrame
          : p.copyClone
            ? this.copyFrame
            : (inputs[p.slot] ?? null);
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
        } else if (p.program === PROGRAM_ID.COMPRESS) {
          // The pressure burst commits at full charge, like the other heavies. It is
          // centred on the body, so the charge only sets the moment, not a direction.
          if (canAct && heavyHeld) {
            p.laserChargeT += pdt;
            if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
              p.facing = Math.atan2(input.my, input.mx);
            }
            p.laserFacing = p.facing;
            if (p.laserChargeT >= COMPRESS.powerChargeTime) this.fireCompressBurst(p);
          } else if (p.laserChargeT >= COMPRESS.powerChargeTime) {
            this.fireCompressBurst(p);
          } else {
            if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) this.useBug(p);
            p.laserChargeHeld = false;
            p.laserChargeT = 0;
            p.chargeT = 0;
            p.chargeHeld = false;
          }
        } else if (p.program === PROGRAM_ID.PINBALL) {
          // The giant ball commits at full charge. It leaves along facing and then
          // belongs to the walls; the player cannot steer it once it is rolling.
          if (canAct && heavyHeld) {
            p.laserChargeT += pdt;
            if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
              p.facing = Math.atan2(input.my, input.mx);
            }
            p.laserFacing = p.facing;
            if (p.laserChargeT >= PINBALL.powerChargeTime) this.firePinballSuper(p);
          } else if (p.laserChargeT >= PINBALL.powerChargeTime) {
            this.firePinballSuper(p);
          } else {
            if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) this.useBug(p);
            p.laserChargeHeld = false;
            p.laserChargeT = 0;
            p.chargeT = 0;
            p.chargeHeld = false;
          }
        } else if (p.program === PROGRAM_ID.AIMBOT) {
          // The volley paints up to six crosshairs, then fires them in one quick row.
          if (canAct && heavyHeld) {
            p.laserChargeT += pdt;
            if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
              p.facing = Math.atan2(input.my, input.mx);
            }
            p.laserFacing = p.facing;
            if (p.laserChargeT >= AIMBOT.volleyChargeTime) this.fireAimVolley(p);
          } else if (p.laserChargeT >= AIMBOT.volleyChargeTime) {
            this.fireAimVolley(p);
          } else {
            if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) this.useBug(p);
            p.laserChargeHeld = false;
            p.laserChargeT = 0;
            p.chargeT = 0;
            p.chargeHeld = false;
          }
        } else if (p.program === PROGRAM_ID.COPYPASTA) {
          // The redaction commits at full charge, like the other area heavies. It is
          // centred on the caster; the charge only buys the moment and the aim.
          if (canAct && heavyHeld) {
            p.laserChargeT += pdt;
            if (input && input.mx * input.mx + input.my * input.my > 0.0025) {
              p.facing = Math.atan2(input.my, input.mx);
            }
            p.laserFacing = p.facing;
            if (p.laserChargeT >= COPYPASTA.powerChargeTime) this.fireCopyRedaction(p);
          } else if (p.laserChargeT >= COPYPASTA.powerChargeTime) {
            this.fireCopyRedaction(p);
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
          // Probe's beam is a held channel. It starts at full charge, but the release
          // branch below cuts it instead of committing it, so he can cancel and dodge.
          if (p.laserChargeT >= PLAYER.laserChargeTime) this.fireLaser(p);
        } else {
          if (canAct && p.laserChargeT <= PLAYER.heavyTapMax) this.useBug(p);
          // Releasing before full charge cancels the wind-up and never fires.
          else if (p.laserT > 0) laserBusy = true;
          p.laserChargeHeld = false;
          p.laserChargeT = 0;
          p.chargeT = 0;
          p.chargeHeld = false;
          if (p.laserT > 0) laserBusy = true;
        }
      } else if (p.laserT > 0) {
        // Probe's beam is a commitment, not a prison: releasing the heavy button cuts
        // it short and starts the full cooldown so the body can move again.
        if (
          p.program === PROGRAM_ID.PROBE &&
          !overcharged &&
          canAct &&
          (!input || (input.held & ACTION.CANDLE) === 0)
        ) {
          p.laserT = 0;
          p.laserTickT = 0;
          p.laserCd = PLAYER.laserCooldown;
          p.chargeT = 0;
          p.chargeHeld = false;
          p.laserChargeHeld = false;
        } else if (p.program === PROGRAM_ID.TOXIC) {
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
            p.guardT = p.guardMax;
            p.parryT = PLAYER.parryWindow;
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
          // Overcharge answers the held-trigger block below, not this press: its spin-up
          // owns the start, so a tap cannot skip the wind-up frame.
          if (!overcharged) this.tryShoot(p);
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
        const holdingBeam =
          canAct && input && (input.held & ACTION.BOLT) !== 0 && p.swingPhase === 0 && p.dashT <= 0;
        if (holdingBeam) {
          p.laserFacing = p.facing;
          p.ocFadeT = 0;
          if (p.laserT > 0) {
            p.laserT = Math.max(p.laserT, 0.06);
          } else {
            // A short spin-up, the heavy charge animation played fast. The beam only
            // exists after it, so the instant powerup still has a readable start.
            if (p.ocChargeT <= 0) p.ocChargeT = POWERUP.overchargeSpinup;
            p.ocChargeT = Math.max(0, p.ocChargeT - dt);
            if (p.ocChargeT === 0) this.startOverchargeBeam(p);
          }
        } else {
          p.ocChargeT = 0;
          if (p.laserT > 0) {
            // The overcharge beam can be switched off on any frame. Stamp the stop so the
            // renderer and FX can cool it down instead of blinking it out of existence.
            // A charged heavy that happens to be live is not this beam: it just ends, as
            // it always has, because the overcharge block owns the trigger here.
            const overchargeBeam = p.laserT <= 0.12;
            const dirX = Math.cos(p.laserFacing);
            const dirY = Math.sin(p.laserFacing);
            const reach = overchargeBeam ? this.laserReach(p) : 0;
            p.laserT = 0;
            p.laserTickT = 0;
            if (overchargeBeam) {
              p.ocFadeT = POWERUP.overchargeFade;
              this.emit(
                EV.BEAM_END,
                p.slot,
                p.x + dirX * PLAYER.radius,
                p.y + dirY * PLAYER.radius,
                reach,
                dirX,
                dirY,
              );
            }
          }
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
        this.dashSolids,
      );
      if (this.keypad) this.resolveKeypadPlayer(p);
      if (this.browser) this.resolveBrowserPlayer(p);
      if (this.laptop) this.resolveLaptopPlayer(p);
      if (this.openWalls || this.arena.voids || this.arena.islands || this.arena.disc || this.satellite) {
        this.checkFall(p);
        if (!p.alive) continue;
      }
      this.bumpBody(p, PLAYER.radius * p.shrink);
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
    if (this.mode !== 'match') this.updateFragments(dt);
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
    this.updateCopyMarks(dt);
    this.updateAimMarks(dt);
    // Flippers resolve after the shots move, so the paddle swats what is actually in
    // front of it this frame instead of last frame's position.
    this.updatePinballArms(dt);
    // Campaign threats stay parked until the breach warning hands the room over.
    if (
      this.mode === 'gauntlet' &&
      (!this.campaign || this.campaignPhase === 'assault') &&
      !this.bossIntro
    ) {
      this.updateGauntlet(threatDt);
    } else if (this.campaign && this.campaignPhase === 'release') {
      this.updateCampaignThreats(threatDt);
    }
    // The read head runs after the bodies have moved, so a dash that crosses the
    // line this frame is already airborne when the scan resolves.
    if (this.scanner && canAct && !calibrationHold) this.tickScanner(dt);
    if (this.fax && canAct && !calibrationHold) this.tickFax(dt);
    if (this.browser) this.pushThreatsOffBrowser();
    if (this.laptop) this.pushThreatsOffLaptop();
    if (this.keypad) this.pushThreatsOffKeypad();
    this.bumpThreats();
    // Keep the roaming families on the plate without saving them from the arm: this
    // clamps the rim only, so a hole still takes them. Run after every family update.
    if (this.arena.disc) this.containDiscThreats();

    if (this.mode === 'match' && this.phase === 'live') {
      const active = this.activeCount();
      if (active >= 2) {
        const alive = this.aliveCount();
        if (alive <= 1) {
          let survivor = -1;
          for (let i = 0; i < this.players.length; i++) {
            const p = this.players[i];
            if (p.active && p.alive && !p.copyClone) survivor = p.slot;
          }
          // A wipe is a result, not a round transition. `finishRound(-1)` would
          // leave the round open for the island hop, which rebuilds the next arena
          // and throws the respawned party out of its entry portal.
          if (survivor < 0) this.finishMatchWipe();
          else this.finishRound(survivor);
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

  /** No body survived the round: end the match instead of opening the next island hop. */
  private finishMatchWipe(): void {
    this.roundWinner = -1;
    this.phase = 'matchend';
    this.phaseTimer = 0;
    this.roundHopT = 0;
    this.emit(EV.ROUND_END, -1, this.centerX, this.centerY, this.round);
    this.emit(EV.MATCH_END, -1, this.centerX, this.centerY, -1);
  }

  private finishRound(winnerSlot: number): void {
    this.roundWinner = winnerSlot;
    this.phase = 'roundover';
    this.phaseTimer = ROUND.roundEndHold;
    this.roundHopT = 0;
    if (winnerSlot >= 0) {
      const winner = this.players[winnerSlot];
      winner.score++;
      if (winner.score >= ROUND.winsNeeded) this.matchWinner = winnerSlot;
    }
    this.emit(EV.ROUND_END, winnerSlot, this.centerX, this.centerY, this.round);
  }

  /**
   * Round-end island hop: the portal opens at the arena centre and drags every standing
   * body into it. The host owns the pull; guests read the same positions from snapshots,
   * and the next arena is built when the hop finishes. Positional only, no damage.
   */
  private tickRoundHopPull(dt: number): void {
    if (this.mode !== 'match') return;
    this.roundHopT += dt;
    // The round portal sits on the right wall, so the next arena can throw the room
    // in from its left wall. The pull is direct and ignores cover.
    const targetX = this.arena.bounds.right - 36;
    const targetY = this.centerY;
    const k = Math.min(1, dt * (5 + this.roundHopT * 14));
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive) continue;
      p.x += (targetX - p.x) * k;
      p.y += (targetY - p.y) * k;
      p.prevX = p.x;
      p.prevY = p.y;
      p.vx = 0;
      p.vy = 0;
      p.kx = 0;
      p.ky = 0;
      p.dashT = 0;
      p.wedgeT = 0;
      p.swingPhase = 0;
    }
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
    if (p.program === PROGRAM_ID.COPYPASTA && !p.copyClone) this.spawnDashDecoy(p);
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
    if (p.glueT > 0) {
      this.chipGlue(p);
      return false;
    }
    if (p.swingPhase !== 0 || p.dashT > 0 || p.waveT > 0) return false;
    p.swingPhase = 1;
    p.swingT = PLAYER.swingStartup;
    p.swingPct = 1;
    p.swingHit = false;
    p.swingFacing = p.facing;
    p.swingDir = dir;
    p.swingKind = kind;
    p.parryT = PLAYER.parryWindow;
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
        if (forward < 0 || forward > range + w.hitR || lateral > halfWidth + w.hitR) continue;
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
      proj.fuse = BOLT.reflectTtl;
      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      this.deflectTelemetry.wave[p.slot]++;
      this.emit(EV.DEFLECT, p.slot, proj.x, proj.y, proj.deflects);
    }
  }

  /** Overcharge weak attack: the beam itself has no cost, no cooldown and no root. */
  private startOverchargeBeam(p: Player): void {
    p.ghostT = 0;
    p.ocChargeT = 0;
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
    p.laserStopDist = 0;
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
    const solidReach = beamReach(
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
    const browserReach = this.browser
      ? this.browserRayReach(p.x, p.y, Math.cos(p.laserFacing), Math.sin(p.laserFacing), PLAYER.laserRange)
      : PLAYER.laserRange;
    const laptopReach = this.laptop
      ? this.laptopRayReach(p.x, p.y, Math.cos(p.laserFacing), Math.sin(p.laserFacing), PLAYER.laserRange)
      : PLAYER.laserRange;
    return Math.min(
      solidReach,
      this.keypadRayReach(p.x, p.y, Math.cos(p.laserFacing), Math.sin(p.laserFacing), PLAYER.laserRange),
      browserReach,
      laptopReach,
    );
  }

  /**
   * First point where the heavy beam meets the Mega Worm. The body is a chain of
   * overlapping circles, so every node is tested; the smallest entry wins.
   */
  private megaBeamReach(ox: number, oy: number, dx: number, dy: number, max: number): number {
    let best = max;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || !w.mega) continue;
      const t = this.megaBeamEntry(w, ox, oy, dx, dy, best, PLAYER.laserHalfWidth);
      if (t < best) best = t;
    }
    return best;
  }

  /** Ray entry into one Mega Worm body, with the head treated as the first node. */
  private megaBeamEntry(
    w: Worm,
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    max: number,
    pad: number,
  ): number {
    let best = max;
    const head = this.rayCircleEntry(ox, oy, dx, dy, w.x, w.y, w.hitR + pad);
    if (head < best) best = head;
    for (let s = 0; s < w.segCount; s++) {
      const t = this.rayCircleEntry(ox, oy, dx, dy, w.segX[s], w.segY[s], w.segR + pad);
      if (t < best) best = t;
    }
    return best;
  }

  /** Distance along a unit ray to a circle, or Infinity when the ray misses. */
  private rayCircleEntry(ox: number, oy: number, dx: number, dy: number, cx: number, cy: number, r: number): number {
    const fx = ox - cx;
    const fy = oy - cy;
    const c = fx * fx + fy * fy - r * r;
    if (c <= 0) return 0;
    const b = fx * dx + fy * dy;
    const disc = b * b - c;
    if (disc < 0) return Infinity;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : Infinity;
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
      this.deflectTelemetry.beam[guard.slot]++;
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
      let hitX = w.x;
      let hitY = w.y;
      let hit = false;
      if (w.mega) {
        // The beam stops at the body's near edge, which can be short of every node
        // centre. Test the entry point, not just the plate centres, or a beam that
        // visibly stops on the worm would deal no damage at all.
        const t = this.megaBeamEntry(w, ox, oy, dx, dy, reach, PLAYER.laserHalfWidth);
        if (t <= reach + 0.001) {
          hit = true;
          hitX = ox + dx * t;
          hitY = oy + dy * t;
        }
      } else {
        hit = this.beamLineHits(ox, oy, dx, dy, reach, w.x, w.y, w.hitR);
        if (!hit) {
          for (let s = 0; s < w.segCount; s++) {
            if (this.beamLineHits(ox, oy, dx, dy, reach, w.segX[s], w.segY[s], w.segR)) {
              hit = true;
              hitX = w.segX[s];
              hitY = w.segY[s];
              break;
            }
          }
        }
      }
      if (!hit) continue;
      this.damageWorm(w, damage, ownerSlot, dx, dy, force, hitX, hitY);
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
    // Anything that damages a body closes a port. The beam ticks, so the shared contact
    // cooldown keeps a single pass from deleting a source outright.
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.active || !b.portal || b.portalExit) continue;
      if ((b.portalHitCd ?? 0) > 0) continue;
      const bx = b.x + b.w * 0.5;
      const by = b.y + b.h * 0.5;
      if (!this.beamLineHits(ox, oy, dx, dy, reach, bx, by, Math.max(b.w, b.h) * 0.5)) continue;
      b.portalHitCd = 0.3;
      this.damageProp(b, damage, bx, by);
    }
  }

  /** Every hostile in the line takes a tick. The beam deliberately does not stop at the first. */
  private applyLaserDamage(p: Player): void {
    const dirX = Math.cos(p.laserFacing);
    const dirY = Math.sin(p.laserFacing);
    const solidReach = this.laserReach(p);
    const bossReach = this.megaBeamReach(p.x, p.y, dirX, dirY, solidReach);
    const blockedReach = Math.min(solidReach, bossReach);
    p.laserStopDist = blockedReach;
    const reach = this.reflectLaser(p, blockedReach);
    // A guard caught the beam: its line ends there and the deflected shaft was already
    // resolved by the reflection.
    if (reach < blockedReach) {
      p.laserStopDist = reach;
      return;
    }
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
    const warnStart = Math.max(0, gather - EMITTER.warn);
    const live = gather + EMITTER.duration;
    for (let i = 0; i < this.emitters.length; i++) {
      const e = this.emitters[i];
      let cycle = (this.emitterT + e.offset * EMITTER.period) % EMITTER.period;
      if (cycle < 0) cycle += EMITTER.period;
      if (cycle < warnStart) {
        // The gather is a visible promise: the dots converge for the whole window so
        // both the lens and the firing direction are readable before the flash.
        e.phase = 1;
        e.charge = cycle / gather;
        e.warnT = 0;
      } else if (cycle < gather) {
        // The last half-second is a thin red lane, drawn across the whole floor even
        // when the lens is offscreen. This is the dodge window, not the damage frame.
        e.phase = 3;
        e.charge = 1;
        e.warnT = (gather - cycle) / Math.max(0.001, EMITTER.warn);
        e.beamDist = this.emitterReach(e);
      } else if (cycle < live) {
        if (e.phase !== 2) this.fireEmitter(e);
        // A deployed wall or a moving compactor can enter the lane during the flash.
        // Keep the drawn shaft and the damage line on the current surface.
        else if (!e.caught) e.beamDist = this.emitterReach(e);
        e.phase = 2;
        e.warnT = 0;
        e.charge = 1;
        if (!e.spent) this.resolveEmitterBeam(e);
      } else {
        e.phase = 0;
        e.warnT = 0;
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
    e.warnT = 0;
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
      this.deflectTelemetry.beam[guard.slot]++;
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
    // A swing, dash or heavy drops lockActive while it runs. Keep the last locked player
    // for a short window so the hit that lands still carries the lock intent.
    if (p.lockIntentT > 0) p.lockIntentT = Math.max(0, p.lockIntentT - dt);
    if (p.lockActive && p.lockKind === 1) {
      p.lockIntentSlot = p.lockId;
      p.lockIntentT = PLAYER.lockIntentWindow;
    }
    const held = !!input && canAct && p.alive && (input.held & ACTION.LOCK) !== 0;
    if (!held) {
      p.lockKind = 0;
      p.lockId = -1;
      p.lockT = 0;
      p.lockActive = false;
      p.lockTX = p.x;
      p.lockTY = p.y;
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
    const lockRange = this.playerLockRange(p);
    const maxD2 = lockRange * lockRange;
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
        if (target === p || target.copyClone || !target.active || !target.alive) continue;
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
        if (!target.active || target.held) continue;
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
        if (!target.active || target.held) continue;
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
      // Enemy ingress ports and replicators are valid lock targets. The lock point is
      // the centre of the square, not its top-left corner, so facing and auto-attack
      // point at the device rather than the wall beside it.
      for (let i = 0; i < this.props.length; i++) {
        const target = this.props[i];
        if (!target.active || !target.portal || target.portalExit || target.hp <= 0) continue;
        const cx = target.x + target.w * 0.5;
        const cy = target.y + target.h * 0.5;
        const dx = cx - p.x;
        const dy = cy - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= best || this.lineBlocked(p.x, p.y, cx, cy)) continue;
        best = d2;
        p.lockKind = 7;
        p.lockId = i;
        tx = cx;
        ty = cy;
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
    if (p.lockActive && p.lockKind === 1) {
      p.lockIntentSlot = p.lockId;
      p.lockIntentT = PLAYER.lockIntentWindow;
    }
    if (p.lockActive) {
      p.lockTX = tx;
      p.lockTY = ty;
      p.lockFacing = Math.atan2(ty - p.y, tx - p.x);
      p.facing = p.lockFacing;
    } else {
      p.lockTX = p.x;
      p.lockTY = p.y;
    }
  }

  /** Aim Bot can hold a lock far beyond the standard single-screen range. */
  private playerLockRange(p: Player): number {
    return p.program === PROGRAM_ID.AIMBOT ? AIMBOT.lockRange : PLAYER.lockRange;
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
      if (target && target.active && !target.held) {
        this.lockTX = target.x;
        this.lockTY = target.y;
        return true;
      }
    } else if (p.lockKind === 3) {
      const target = this.viruses[p.lockId];
      if (target && target.active && !target.held) {
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
    } else if (p.lockKind === 7) {
      const target = this.props[p.lockId];
      if (target && target.active && target.portal && !target.portalExit && target.hp > 0) {
        this.lockTX = target.x + target.w * 0.5;
        this.lockTY = target.y + target.h * 0.5;
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
      if (t === p || t.copyClone || !t.active || !t.alive) continue;
      this.offerCycle(1, i, t.x, t.y);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const t = this.worms[i];
      if (t.active && !t.held) this.offerCycle(2, i, t.x, t.y);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const t = this.viruses[i];
      if (t.active && !t.held) this.offerCycle(3, i, t.x, t.y);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const t = this.sentries[i];
      if (t.active) this.offerCycle(5, i, t.x, t.y);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const t = this.errors[i];
      if (t.active) this.offerCycle(6, i, t.x, t.y);
    }
    for (let i = 0; i < this.props.length; i++) {
      const t = this.props[i];
      if (t.active && t.portal && !t.portalExit && t.hp > 0) {
        this.offerCycle(7, i, t.x + t.w * 0.5, t.y + t.h * 0.5);
      }
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
    const lockRange = this.playerLockRange(p);
    const maxD2 = lockRange * lockRange;
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

    if (p.program === PROGRAM_ID.COMPRESS) {
      // One pressure orb per throw. Slower than a bolt, and its payoff is the squeeze
      // left on the victim, not a burst of direct damage.
      if (p.autoFireT > 0 || p.energy < COMPRESS.orbCost) return;
      if (!this.spawnProjectile(
        p,
        0,
        COMPRESS.orbTtl,
        COMPRESS.orbSpeed,
        false,
        COMPRESS.orbRadius,
        COMPRESS.orbDamage,
        13,
      )) return;
      p.energy -= COMPRESS.orbCost;
      p.autoFireT = COMPRESS.attackCooldown;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (p.program === PROGRAM_ID.AIMBOT) {
      // One rail round. The clip bypasses the normal long reload for three shots, but
      // the round itself is the whole commitment: extreme speed, 5 damage, no bounce.
      const clip = p.aimSightT > 0 && p.aimClip > 0;
      if (!clip && p.autoFireT > 0) return;
      if (p.energy < AIMBOT.shotCost) return;
      if (!this.spawnProjectile(
        p,
        0,
        AIMBOT.shotTtl,
        AIMBOT.shotSpeed,
        false,
        AIMBOT.shotRadius,
        AIMBOT.shotDamage,
        17,
      )) return;
      p.energy -= AIMBOT.shotCost;
      if (clip) {
        p.aimClip--;
        p.autoFireT = AIMBOT.clipInterval;
      } else {
        p.autoFireT = AIMBOT.attackCooldown;
      }
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (p.program === PROGRAM_ID.PINBALL) {
      // One long-lived ricochet ball. It starts at one damage and gets hotter with every
      // body it strikes, so the first throw is a probe and the fifth is a finisher.
      if (p.autoFireT > 0 || p.energy < PINBALL.shotCost) return;
      if (!this.spawnProjectile(
        p,
        0,
        PINBALL.shotTtl,
        PINBALL.shotSpeed,
        false,
        PINBALL.shotRadius,
        PINBALL.shotDamage,
        14,
      )) return;
      p.energy -= PINBALL.shotCost;
      p.autoFireT = PINBALL.attackCooldown;
      this.emit(EV.SHOOT, p.slot, p.x, p.y, p.facing);
      return;
    }

    if (p.program === PROGRAM_ID.COPYPASTA) {
      // One file per throw. On a body it tears into two children, so a single shot
      // rewards a tight enemy cluster without turning into a projectile hose.
      if (p.autoFireT > 0 || p.energy < COPYPASTA.shotCost) return;
      if (!this.spawnProjectile(
        p,
        0,
        COPYPASTA.shotTtl,
        COPYPASTA.shotSpeed,
        false,
        COPYPASTA.shotRadius,
        COPYPASTA.shotDamage,
        16,
      )) return;
      p.energy -= COPYPASTA.shotCost;
      p.autoFireT = COPYPASTA.attackCooldown;
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
    if (p.program === PROGRAM_ID.COMPRESS) return COMPRESS.powerCost;
    if (p.program === PROGRAM_ID.PINBALL) return PINBALL.powerCost;
    if (p.program === PROGRAM_ID.COPYPASTA) return COPYPASTA.powerCost;
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

  /** Pushes a body out of a deployed wall. A dash stops at the wall too. */
  private resolveBarrier(p: Player): void {
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
      // A dash can cross the thin wall's centreline in one frame. Choose the side it
      // came from, not the side its final centre landed on, so it cannot pop through.
      const approach = p.dashDirX * wall.nx + p.dashDirY * wall.ny;
      const side =
        p.dashT > 0 && Math.abs(approach) > 0.001
          ? approach > 0
            ? -1
            : 1
          : dx * wall.nx + dy * wall.ny >= 0
            ? 1
            : -1;
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
          const radius = s < 0 ? w.hitR : w.segR;
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
        this.damageWorm(w, damage, p.slot, cos, sin, force, hitX, hitY);
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
      // Wedge's bracket is a damaging super, so it closes a port inside the wall shape.
      for (let i = 0; i < this.props.length; i++) {
        const b = this.props[i];
        if (!b.active || !b.portal || b.portalExit) continue;
        if ((b.portalHitCd ?? 0) > 0) continue;
        const bx = b.x + b.w * 0.5;
        const by = b.y + b.h * 0.5;
        const radius = Math.max(b.w, b.h) * 0.5;
        const dx = bx - p.x;
        const dy = by - p.y;
        const forward = dx * cos + dy * sin;
        const lateral = Math.abs(dx * sin - dy * cos);
        if (forward < 0 || forward > reach + radius || lateral > halfWidth + radius) continue;
        if (this.lineBlocked(p.x, p.y, bx, by)) continue;
        b.portalHitCd = 0.3;
        this.damageProp(b, damage, bx, by);
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
      proj.fuse = BOLT.reflectTtl;
      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      p.swingHit = true;
      this.deflectTelemetry.plow[p.slot]++;
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
        if (hx * hx + hy * hy <= (radius + w.hitR) * (radius + w.hitR)) touching = true;
        if (!touching) {
          for (let s = 0; s < w.segCount; s++) {
            hx = w.segX[s] - p.x;
            hy = w.segY[s] - p.y;
            const rr = radius + w.segR;
            if (hx * hx + hy * hy <= rr * rr) {
              touching = true;
              break;
            }
          }
        }
        if (!touching) continue;
        p.wedgeHitWorms |= bit;
        const side = fx * hy - fy * hx >= 0 ? 1 : -1;
        this.damageWorm(w, WEDGE.chargeDamage, p.slot, -fy * side, fx * side, WEDGE.chargeKnockback, p.x + hx, p.y + hy);
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

    // The plow is a damaging super: a port caught in the hull is a target too.
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.active || !b.portal || b.portalExit) continue;
      if ((b.portalHitCd ?? 0) > 0) continue;
      const bx = b.x + b.w * 0.5;
      const by = b.y + b.h * 0.5;
      const rr = radius + Math.max(b.w, b.h) * 0.5;
      const dx = bx - p.x;
      const dy = by - p.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      b.portalHitCd = 0.3;
      this.damageProp(b, WEDGE.chargeDamage, bx, by);
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
      proj.fuse = BOLT.reflectTtl;
      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      this.deflectTelemetry.broom[p.slot]++;
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
      let touching = visible(w.x, w.y, w.hitR);
      for (let s = 0; s < w.segCount && !touching; s++) {
        if (visible(w.segX[s], w.segY[s], w.segR)) touching = true;
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

    // Sweep's super is a damaging stroke, so a port under the head takes it too. The
    // stroke resolves every tick, so the shared contact cooldown gates the ticks.
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.active || !b.portal || b.portalExit) continue;
      if ((b.portalHitCd ?? 0) > 0) continue;
      const bx = b.x + b.w * 0.5;
      const by = b.y + b.h * 0.5;
      if (!this.broomReaches(p, bx, by, Math.max(b.w, b.h) * 0.5, fx, fy, half, width)) continue;
      b.portalHitCd = 0.3;
      this.damageProp(b, SWEEP.powerDamage, bx, by);
    }

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
      let touching = this.broomReaches(p, w.x, w.y, w.hitR, fx, fy, half, width);
      if (touching) {
        touchX = w.x;
        touchY = w.y;
      }
      for (let s = 0; s < w.segCount && !touching; s++) {
        if (!this.broomReaches(p, w.segX[s], w.segY[s], w.segR, fx, fy, half, width)) continue;
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
      this.damageWorm(w, SWEEP.powerDamage, p.slot, 0, sy, SWEEP.powerKnockback, touchX, touchY);
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

      // The split brooms are a damaging skill; each lane closes a port it crosses.
      for (let i = 0; i < this.props.length; i++) {
        const b = this.props[i];
        if (!b.active || !b.portal || b.portalExit) continue;
        if ((b.portalHitCd ?? 0) > 0) continue;
        const px = b.x + b.w * 0.5;
        const py = b.y + b.h * 0.5;
        if (!this.fanReaches(bx, by, px, py, Math.max(b.w, b.h) * 0.5, reach)) continue;
        b.portalHitCd = 0.3;
        this.damageProp(b, SWEEP.fanDamage, px, py);
      }

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
        let touching = this.fanReaches(bx, by, w.x, w.y, w.hitR, reach);
        let hitX = w.x;
        let hitY = w.y;
        for (let s = 0; s < w.segCount && !touching; s++) {
          touching = this.fanReaches(bx, by, w.segX[s], w.segY[s], w.segR, reach);
          if (touching) {
            hitX = w.segX[s];
            hitY = w.segY[s];
          }
        }
        if (!touching) continue;
        p.fanHitWorms |= bit;
        this.damageWorm(w, SWEEP.fanDamage, p.slot, shoveX, shoveY, SWEEP.fanKnockback, hitX, hitY);
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
      let hit = reaches(w.x, w.y, w.hitR);
      let hitX = w.x;
      let hitY = w.y;
      for (let s = 0; s < w.segCount && !hit; s++) {
        hit = reaches(w.segX[s], w.segY[s], w.segR);
        if (hit) {
          hitX = w.segX[s];
          hitY = w.segY[s];
        }
      }
      if (hit) this.damageWorm(w, amount, p.slot, 0, 0, 0, hitX, hitY);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (e.active && reaches(e.x, e.y, CASCADING_ERROR.blockSize * 0.5)) this.damageError(e, amount, p.slot, 0, 0);
    }
    // The spray and the jet are damaging skills, so they close a port they cover.
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.active || !b.portal || b.portalExit) continue;
      if ((b.portalHitCd ?? 0) > 0) continue;
      const bx = b.x + b.w * 0.5;
      const by = b.y + b.h * 0.5;
      if (!reaches(bx, by, Math.max(b.w, b.h) * 0.5)) continue;
      b.portalHitCd = 0.3;
      this.damageProp(b, amount, bx, by);
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
        let touching = this.netReaches(net, worm.x, worm.y, worm.hitR);
        if (!touching) {
          for (let g = 0; g < worm.segCount; g++) {
            if (this.netReaches(net, worm.segX[g], worm.segY[g], worm.segR)) {
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
    // Only walls turn the super ball; a web is not a wall.
    if (proj.type === 15) return false;
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
      proj.fuse = BOLT.reflectTtl;
      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      this.deflectTelemetry.net[net.owner]++;
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
    } else if (p.bugKind === 12) {
      this.startCompressSprint(p);
    } else if (p.bugKind === 13) {
      this.startPinballArm(p);
    } else if (p.bugKind === 14) {
      // The copy needs a free body. A refused cast hands the energy back instead of
      // eating the button while another copy is still on the floor.
      if (!this.spawnCopyClone(p)) {
        p.bugCd = 0;
        p.energy = Math.min(PLAYER.energyMax, p.energy + BUG.cost);
        return;
      }
    } else if (p.bugKind === 15) {
      this.startAimSight(p);
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
      this.shoveClearOfBlast(w, p.x, p.y, radius, clear, WORM.knockDrag, w.hitR);
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
   * Pinball's skill: plant a flipper arm on the floor in front of him for a long window.
   * The arm sweeps back and forth, punts hostile fire toward the nearest other enemy and
   * swats bodies with a heavy knock. It stays where it was planted, so choosing the spot
   * is the skill; walking away leaves it working the lane behind him.
   */
  private startPinballArm(p: Player): void {
    p.armT = PINBALL.armLife;
    p.armMax = PINBALL.armLife;
    p.armX = p.x + Math.cos(p.facing) * PINBALL.armOffset;
    p.armY = p.y + Math.sin(p.facing) * PINBALL.armOffset;
    p.armBaseAngle = p.facing;
    p.armAngle = p.facing;
    p.armHitCd = 0;
    p.swingPhase = 0;
    p.swingT = 0;
    p.swingPct = 0;
    p.guardT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
  }

  /**
   * Pinball's heavy: one huge ball. It bounces off arena walls only, rolls through
   * bodies and cover, and damages each body once with a heavy shove. It is not a
   * projectile the player can steer; committing the line is the whole attack.
   */
  private firePinballSuper(p: Player): void {
    if (p.laserCd > 0) {
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      p.chargeT = 0;
      p.chargeHeld = false;
      return;
    }
    if (p.energy < PINBALL.powerCost) {
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      p.chargeT = 0;
      p.chargeHeld = false;
      return;
    }
    if (!this.spawnProjectile(
      p,
      0,
      PINBALL.powerTtl,
      PINBALL.powerSpeed,
      false,
      PINBALL.powerRadius,
      PINBALL.powerDamage,
      15,
    )) {
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      p.chargeT = 0;
      p.chargeHeld = false;
      return;
    }
    p.energy -= PINBALL.powerCost;
    p.laserCd = PINBALL.powerCooldown;
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    this.emit(EV.LASER, p.slot, p.x, p.y, p.facing);
  }

  /**
   * Aim Bot's skill: paint the long sight line and load a three-round clip. The clip
   * bypasses the normal slow reload; each round still pays energy and fires a real
   * projectile, so cover and range matter until the shot lands.
   */
  private startAimSight(p: Player): void {
    p.aimSightT = AIMBOT.sightTime;
    p.aimClip = AIMBOT.clipSize;
    p.autoFireT = 0;
  }

  /**
   * Aim Bot's heavy: mark up to six visible bodies in a forward cone, then fire one
   * 12-point shot at each in a rapid sequence. The crosshairs are the tell and the
   * damage is direct; no projectile is spawned for the volley.
   */
  private fireAimVolley(p: Player): void {
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    if (!p.alive || p.laserCd > 0) return;
    if (p.energy < AIMBOT.volleyCost) return;
    const dirX = Math.cos(p.facing);
    const dirY = Math.sin(p.facing);
    const cosHalf = Math.cos(AIMBOT.volleyHalfAngle);
    const range2 = AIMBOT.volleyRange * AIMBOT.volleyRange;
    const picks: { kind: number; id: number; x: number; y: number; d2: number }[] = [];
    const consider = (kind: number, id: number, x: number, y: number): void => {
      const dx = x - p.x;
      const dy = y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > range2 || d2 < 1) return;
      const dist = Math.sqrt(d2);
      if ((dx * dirX + dy * dirY) / dist < cosHalf) return;
      if (this.lineBlocked(p.x, p.y, x, y)) return;
      picks.push({ kind, id, x, y, d2 });
    };
    for (let i = 0; i < this.players.length; i++) {
      const t = this.players[i];
      if (t === p || t.copyClone || t.thrall || !t.active || !t.alive || t.cloakT > 0) continue;
      consider(1, i, t.x, t.y);
    }
    for (let i = 0; i < this.worms.length; i++) {
      if (this.worms[i].active) consider(2, i, this.worms[i].x, this.worms[i].y);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      if (this.viruses[i].active) consider(3, i, this.viruses[i].x, this.viruses[i].y);
    }
    if (this.mode === 'training' && this.drone.active) consider(4, 0, this.drone.x, this.drone.y);
    if (this.mode === 'gauntlet') {
      for (let i = 0; i < this.sentries.length; i++) {
        if (this.sentries[i].active) consider(5, i, this.sentries[i].x, this.sentries[i].y);
      }
      for (let i = 0; i < this.errors.length; i++) {
        if (this.errors[i].active) consider(6, i, this.errors[i].x, this.errors[i].y);
      }
    }
    if (picks.length === 0) return;
    picks.sort((a, b) => a.d2 - b.d2);
    const count = Math.min(AIMBOT.volleyTargets, picks.length, this.aimMarks.length);
    for (let i = 0; i < this.aimMarks.length; i++) this.aimMarks[i].active = false;
    for (let i = 0; i < count; i++) {
      const mark = this.aimMarks[i];
      const pick = picks[i];
      mark.active = true;
      mark.kind = pick.kind;
      mark.id = pick.id;
      mark.owner = p.slot;
      mark.t = AIMBOT.volleyTelegraph + i * AIMBOT.volleyStagger;
      mark.x = pick.x;
      mark.y = pick.y;
    }
    p.energy = Math.max(0, p.energy - AIMBOT.volleyCost);
    p.laserCd = AIMBOT.volleyCooldown;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    this.emit(EV.LASER, p.slot, p.x, p.y, p.facing);
  }

  private clearAimMarks(): void {
    for (let i = 0; i < this.aimMarks.length; i++) this.aimMarks[i].active = false;
  }

  /** Advance the crosshair beat and resolve each marked shot once. */
  private updateAimMarks(dt: number): void {
    for (let i = 0; i < this.aimMarks.length; i++) {
      const mark = this.aimMarks[i];
      if (!mark.active) continue;
      let tx = mark.x;
      let ty = mark.y;
      let live = true;
      if (mark.kind === 1) {
        const t = this.players[mark.id];
        live = !!t && t.active && t.alive;
        if (live) {
          tx = t.x;
          ty = t.y;
        }
      } else if (mark.kind === 2) {
        const t = this.worms[mark.id];
        live = !!t && t.active;
        if (live) {
          tx = t.x;
          ty = t.y;
        }
      } else if (mark.kind === 3) {
        const t = this.viruses[mark.id];
        live = !!t && t.active;
        if (live) {
          tx = t.x;
          ty = t.y;
        }
      } else if (mark.kind === 4) {
        live = this.drone.active;
        if (live) {
          tx = this.drone.x;
          ty = this.drone.y;
        }
      } else if (mark.kind === 5) {
        const t = this.sentries[mark.id];
        live = !!t && t.active;
        if (live) {
          tx = t.x;
          ty = t.y;
        }
      } else {
        const t = this.errors[mark.id];
        live = !!t && t.active;
        if (live) {
          tx = t.x;
          ty = t.y;
        }
      }
      if (!live) {
        mark.active = false;
        continue;
      }
      mark.x = tx;
      mark.y = ty;
      mark.t -= dt;
      if (mark.t > 0) continue;
      const owner = this.players[mark.owner];
      if (!owner || !owner.active || !owner.alive) {
        mark.active = false;
        continue;
      }
      if (this.lineBlocked(owner.x, owner.y, tx, ty)) {
        mark.active = false;
        continue;
      }
      this.fireAimMark(mark, owner);
      mark.active = false;
      this.emit(EV.SHOOT, owner.slot, owner.x, owner.y, Math.atan2(ty - owner.y, tx - owner.x));
    }
  }

  /** Apply one instant volley hit to the marked body. */
  private fireAimMark(mark: AimMark, owner: Player): void {
    const dx = mark.x - owner.x;
    const dy = mark.y - owner.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    if (mark.kind === 1) {
      const t = this.players[mark.id];
      if (!t || !t.active || !t.alive || t === owner) return;
      this.damagePlayer(t, AIMBOT.volleyDamage, owner.slot, ux, uy, AIMBOT.volleyKnockback);
    } else if (mark.kind === 2) {
      const t = this.worms[mark.id];
      if (t && t.active) this.damageWorm(t, AIMBOT.volleyDamage, owner.slot, ux, uy, AIMBOT.volleyKnockback);
    } else if (mark.kind === 3) {
      const t = this.viruses[mark.id];
      if (t && t.active) this.damageVirus(t, AIMBOT.volleyDamage, owner.slot, ux, uy, AIMBOT.volleyKnockback);
    } else if (mark.kind === 4) {
      if (this.drone.active) this.damageDrone(AIMBOT.volleyDamage, owner.slot);
    } else if (mark.kind === 5) {
      const t = this.sentries[mark.id];
      if (t && t.active) this.damageSentry(t, AIMBOT.volleyDamage, owner.slot, ux, uy, AIMBOT.volleyKnockback);
    } else {
      const t = this.errors[mark.id];
      if (t && t.active) this.damageError(t, AIMBOT.volleyDamage, owner.slot, ux, uy);
    }
  }

  /** Advance every deployed pinball arm and resolve its swept paddle. */
  private updatePinballArms(dt: number): void {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || p.armT <= 0) continue;
      p.armT = Math.max(0, p.armT - dt);
      if (!p.alive) {
        p.armT = 0;
        continue;
      }
      const age = p.armMax - p.armT;
      p.armAngle = p.armBaseAngle + Math.sin(age * PINBALL.armSwingRate) * PINBALL.armArc;
      if (p.armHitCd > 0) p.armHitCd = Math.max(0, p.armHitCd - dt);
      this.resolvePinballArm(p);
    }
  }

  /**
   * The deployed flipper. It punts hostile fire toward the nearest other enemy and swats
   * one body at a time on a short cooldown. Projectiles are the priority: the arm is a
   * return-to-sender tool first, a body shove second.
   */
  private resolvePinballArm(p: Player): void {
    const half = PINBALL.armWidth * 0.5;

    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.orbOwner >= 0) continue;
      if (proj.owner === p.slot || proj.type === 1 || proj.type === 2) continue;
      if (proj.type === 15) continue;
      if (!this.armTouches(p, proj.x, proj.y, proj.radius)) continue;

      let angle: number;
      if (this.setPinballAim(p, proj.x, proj.y, -1, -1, -1, -1, -1)) {
        angle = Math.atan2(this.pinAimY - proj.y, this.pinAimX - proj.x);
      } else {
        angle = Math.atan2(proj.y - p.armY, proj.x - p.armX);
      }
      const speed = proj.type === 8 || proj.type === 9 ? 620 : PINBALL.armProjectileSpeed;
      proj.vx = Math.cos(angle) * speed;
      proj.vy = Math.sin(angle) * speed;
      proj.owner = p.slot;
      proj.deflects++;
      proj.homing = false;
      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      proj.hitPlayers = 0;
      proj.hitWorms = 0;
      proj.hitViruses = 0;
      proj.hitErrors = 0;
      proj.hitSentries = 0;
      proj.hitDrone = false;
      // Bombs keep their shell identity; every other shot returns as a plain bolt.
      if (proj.type !== 8 && proj.type !== 9) {
        proj.type = 0;
        proj.damage = BOLT.damage + proj.deflects;
        proj.fuse = BOLT.reflectTtl;
      } else {
        proj.damage = Math.max(1, proj.damage);
      }
      // Separate it from the paddle so the same shot cannot be caught every frame.
      let nx = proj.x - this.pinNearX;
      let ny = proj.y - this.pinNearY;
      const nd = Math.hypot(nx, ny);
      if (nd < 0.001) {
        nx = Math.cos(angle);
        ny = Math.sin(angle);
      } else {
        nx /= nd;
        ny /= nd;
      }
      proj.x = this.pinNearX + nx * (half + proj.radius + 2);
      proj.y = this.pinNearY + ny * (half + proj.radius + 2);
      this.deflectTelemetry.arm[p.slot]++;
      this.emit(EV.DEFLECT, p.slot, proj.x, proj.y, proj.deflects);
    }

    if (p.armHitCd > 0) return;
    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target.slot === p.slot || !target.active || !target.alive) continue;
      if (target.iframes > 0 || phased(target) || target.travelT > 0) continue;
      if (!this.armTouches(p, target.x, target.y, PLAYER.radius * target.shrink)) continue;
      const ux = this.pinballBodyAim(p, target.x, target.y, target.slot, -1, -1, -1, -1);
      this.damagePlayer(
        target,
        PINBALL.armDamage,
        p.slot,
        ux,
        this.pinAimY,
        PINBALL.armKnockback,
      );
      this.swatPinballArm(p);
      return;
    }
    if (this.mode === 'training' && this.drone.active) {
      const d = this.drone;
      if (this.armTouches(p, d.x, d.y, d.radius)) {
        this.pinballBodyAim(p, d.x, d.y, -1, -1, -1, -1, -1);
        this.damageDrone(PINBALL.armDamage, p.slot);
        this.swatPinballArm(p);
        return;
      }
    }
    if (this.mode !== 'gauntlet' || p.slot === 1) return;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      if (!this.armTouches(p, s.x, s.y, s.radius)) continue;
      const ux = this.pinballBodyAim(p, s.x, s.y, -1, -1, -1, i, -1);
      this.damageSentry(s, PINBALL.armDamage, p.slot, ux, this.pinAimY, PINBALL.armKnockback);
      this.swatPinballArm(p);
      return;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      if (!this.armTouches(p, w.x, w.y, w.hitR)) continue;
      const ux = this.pinballBodyAim(p, w.x, w.y, -1, i, -1, -1, -1);
      this.damageWorm(w, PINBALL.armDamage, p.slot, ux, this.pinAimY, PINBALL.armKnockback);
      this.swatPinballArm(p);
      return;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      if (!this.armTouches(p, v.x, v.y, v.radius)) continue;
      const ux = this.pinballBodyAim(p, v.x, v.y, -1, -1, i, -1, -1);
      this.damageVirus(v, PINBALL.armDamage, p.slot, ux, this.pinAimY, PINBALL.armKnockback);
      this.swatPinballArm(p);
      return;
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      if (!this.armTouches(p, e.x, e.y, CASCADING_ERROR.blockSize * 0.5)) continue;
      const ux = this.pinballBodyAim(p, e.x, e.y, -1, -1, -1, -1, i);
      this.damageError(e, PINBALL.armDamage, p.slot, ux, this.pinAimY);
      this.swatPinballArm(p);
      return;
    }
  }

  /** Set the body-swat direction toward the nearest other enemy and return its x part. */
  private pinballBodyAim(
    p: Player,
    x: number,
    y: number,
    skipSlot: number,
    skipWorm: number,
    skipVirus: number,
    skipSentry: number,
    skipError: number,
  ): number {
    if (this.setPinballAim(p, x, y, skipSlot, skipWorm, skipVirus, skipSentry, skipError)) {
      const dx = this.pinAimX - x;
      const dy = this.pinAimY - y;
      const d = Math.hypot(dx, dy) || 1;
      this.pinAimY = dy / d;
      return dx / d;
    }
    // No other enemy: shove it straight away from the paddle base instead.
    const dx = x - p.armX;
    const dy = y - p.armY;
    const d = Math.hypot(dx, dy) || 1;
    this.pinAimY = dy / d;
    return dx / d;
  }

  /** Finish one body swat: start the cooldown and stamp a deflect flash on the paddle. */
  private swatPinballArm(p: Player): void {
    p.armHitCd = PINBALL.armHitCooldown;
    this.deflectTelemetry.arm[p.slot]++;
    this.emit(EV.DEFLECT, p.slot, p.armX, p.armY, 1);
  }

  /** True when a circle overlaps the flipper blade; writes the nearest point to scratch. */
  private armTouches(p: Player, x: number, y: number, radius: number): boolean {
    const vx = Math.cos(p.armAngle) * PINBALL.armLength;
    const vy = Math.sin(p.armAngle) * PINBALL.armLength;
    const len2 = vx * vx + vy * vy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - p.armX) * vx + (y - p.armY) * vy) / len2)) : 0;
    this.pinNearX = p.armX + vx * t;
    this.pinNearY = p.armY + vy * t;
    const dx = x - this.pinNearX;
    const dy = y - this.pinNearY;
    const rr = PINBALL.armWidth * 0.5 + radius;
    return dx * dx + dy * dy <= rr * rr;
  }

  /**
   * Nearest live enemy of the arm owner, written into the pinAim scratch. Bodies pass
   * their own index so the swat looks at the *other* enemies, not at itself.
   */
  private setPinballAim(
    owner: Player,
    x: number,
    y: number,
    skipSlot: number,
    skipWorm: number,
    skipVirus: number,
    skipSentry: number,
    skipError: number,
  ): boolean {
    this.pinAimFound = false;
    this.pinAimBest2 = Infinity;
    const consider = (tx: number, ty: number): void => {
      const dx = tx - x;
      const dy = ty - y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= this.pinAimBest2) return;
      this.pinAimBest2 = d2;
      this.pinAimX = tx;
      this.pinAimY = ty;
      this.pinAimFound = true;
    };
    for (let i = 0; i < this.players.length; i++) {
      const target = this.players[i];
      if (target.slot === owner.slot || target.slot === skipSlot) continue;
      if (!target.active || !target.alive || phased(target)) continue;
      consider(target.x, target.y);
    }
    if (this.mode === 'training' && this.drone.active) consider(this.drone.x, this.drone.y);
    if (this.mode === 'gauntlet') {
      for (let i = 0; i < this.sentries.length; i++) {
        if (i === skipSentry) continue;
        const s = this.sentries[i];
        if (s.active) consider(s.x, s.y);
      }
      for (let i = 0; i < this.worms.length; i++) {
        if (i === skipWorm) continue;
        const w = this.worms[i];
        if (w.active) consider(w.x, w.y);
      }
      for (let i = 0; i < this.viruses.length; i++) {
        if (i === skipVirus) continue;
        const v = this.viruses[i];
        if (v.active) consider(v.x, v.y);
      }
      for (let i = 0; i < this.errors.length; i++) {
        if (i === skipError) continue;
        const e = this.errors[i];
        if (e.active) consider(e.x, e.y);
      }
    }
    return this.pinAimFound;
  }

  /**
   * Compress's skill: fold the body down and run. It is a speed window, not a dodge:
   * the avatar still shoots, swings and dashes, and nothing about it grants iframes.
   * The body keeps the persistent shrink it has been hit with, then folds further.
   */
  private startCompressSprint(p: Player): void {
    p.shrinkT = Math.max(p.shrinkT, COMPRESS.skillTime);
    p.swingPhase = 0;
    p.swingT = 0;
    p.swingPct = 0;
    p.guardT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
  }

  /** Health cap after one pressure step: 10% of the pool or one point, whichever is bigger. */
  private compressedCap(maxHp: number): number {
    return Math.max(1, maxHp - Math.max(maxHp * COMPRESS.hpCut, COMPRESS.hpCutFloor));
  }

  /** One pressure orb hit on a player: a step smaller and a lower segment cap. */
  private compressPlayerHit(p: Player, sourceSlot: number): void {
    if (!p.alive) return;
    p.shrink = Math.max(COMPRESS.shrinkFloor, p.shrink * (1 - COMPRESS.shrinkStep));
    p.maxHp = this.compressedCap(p.maxHp);
    p.hp = Math.min(p.hp, p.maxHp);
    this.emit(EV.COMPRESS, sourceSlot, p.x, p.y, p.shrink);
  }

  private compressSentryHit(s: Sentry, sourceSlot: number): void {
    if (!s.active) return;
    s.maxHp = this.compressedCap(s.maxHp);
    s.hp = Math.min(s.hp, s.maxHp);
    s.radius = Math.max(6, s.radius * (1 - COMPRESS.shrinkStep));
    this.emit(EV.COMPRESS, sourceSlot, s.x, s.y, s.radius);
  }

  private compressVirusHit(v: Virus, sourceSlot: number): void {
    if (!v.active) return;
    v.maxHp = this.compressedCap(v.maxHp);
    v.hp = Math.min(v.hp, v.maxHp);
    v.radius = Math.max(5, v.radius * (1 - COMPRESS.shrinkStep));
    this.emit(EV.COMPRESS, sourceSlot, v.x, v.y, v.radius);
  }

  private compressWormHit(w: Worm, sourceSlot: number): void {
    if (!w.active) return;
    w.maxHp = this.compressedCap(w.maxHp);
    w.hp = Math.min(w.hp, w.maxHp);
    w.shrink = Math.max(COMPRESS.shrinkFloor, w.shrink * (1 - COMPRESS.shrinkStep));
    this.emit(EV.COMPRESS, sourceSlot, w.x, w.y, w.shrink);
  }

  private compressErrorHit(e: CascadingError, sourceSlot: number): void {
    if (!e.active) return;
    e.maxHp = this.compressedCap(e.maxHp);
    e.hp = Math.min(e.hp, e.maxHp);
    this.emit(EV.COMPRESS, sourceSlot, e.x, e.y, 0);
  }

  /**
   * Compress's heavy: a radial pressure burst centred on the body. Every body inside
   * the ring is folded to half its size and half its health cap; anything already down
   * to its last point is crushed outright. Cover cuts the wave, a ride owns the body,
   * and a dormant calibration subject is left asleep. There is no damage on survivors:
   * the shrink and the capped pool are the whole payload.
   */
  private fireCompressBurst(p: Player): void {
    p.energy = Math.max(0, p.energy - COMPRESS.powerCost);
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.laserCd = COMPRESS.powerCooldown;
    p.chargeT = 0;
    p.chargeHeld = false;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    p.swingPhase = 0;
    p.swingT = 0;
    p.swingPct = 0;
    const radius = COMPRESS.powerRadius;
    const half = COMPRESS.powerScale;
    this.emit(EV.LASER, p.slot, p.x, p.y, p.facing);
    this.emit(EV.COMPRESS, p.slot, p.x, p.y, 0);

    for (let i = 0; i < this.players.length; i++) {
      const t = this.players[i];
      if (t === p || !t.active || !t.alive) continue;
      if (t.iframes > 0 || phased(t) || t.travelT > 0) continue;
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (this.lineBlocked(p.x, p.y, t.x, t.y)) continue;
      if (t.hp <= 1) {
        const d = Math.hypot(dx, dy) || 1;
        this.damagePlayer(t, t.hp + 1, p.slot, dx / d, dy / d, 0);
        continue;
      }
      t.hp *= half;
      t.maxHp = Math.max(1, Math.round(t.maxHp * half));
      t.hp = Math.min(t.hp, t.maxHp);
      t.shrink = Math.max(COMPRESS.shrinkFloor, t.shrink * half);
      t.hitFlash = PLAYER.hitFlash;
      this.emit(EV.COMPRESS, p.slot, t.x, t.y, t.shrink);
    }

    // The sparring drone is a training body, not a gauntlet one.
    if (this.drone.active) {
      const dx = this.drone.x - p.x;
      const dy = this.drone.y - p.y;
      if (dx * dx + dy * dy <= radius * radius && !this.lineBlocked(p.x, p.y, this.drone.x, this.drone.y)) {
        this.drone.hp *= half;
        this.drone.maxHp = Math.max(1, this.drone.maxHp * half);
        this.drone.hp = Math.min(this.drone.hp, this.drone.maxHp);
        this.drone.radius = Math.max(6, this.drone.radius * half);
        this.emit(EV.COMPRESS, p.slot, this.drone.x, this.drone.y, this.drone.radius);
      }
    }

    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      if (s.kind >= 4 && this.campaignPhase === 'calibration' && s.shapeState === 0) continue;
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (this.lineBlocked(p.x, p.y, s.x, s.y)) continue;
      if (s.hp <= 1) {
        const d = Math.hypot(dx, dy) || 1;
        this.damageSentry(s, s.hp + 1, p.slot, dx / d, dy / d);
        continue;
      }
      s.hp *= half;
      s.maxHp = Math.max(1, s.maxHp * half);
      s.hp = Math.min(s.hp, s.maxHp);
      s.radius = Math.max(6, s.radius * half);
      this.emit(EV.COMPRESS, p.slot, s.x, s.y, s.radius);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const dx = v.x - p.x;
      const dy = v.y - p.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (this.lineBlocked(p.x, p.y, v.x, v.y)) continue;
      if (v.hp <= 1) {
        const d = Math.hypot(dx, dy) || 1;
        this.damageVirus(v, v.hp + 1, p.slot, dx / d, dy / d);
        continue;
      }
      v.hp *= half;
      v.maxHp = Math.max(1, v.maxHp * half);
      v.hp = Math.min(v.hp, v.maxHp);
      v.radius = Math.max(5, v.radius * half);
      this.emit(EV.COMPRESS, p.slot, v.x, v.y, v.radius);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const dx = w.x - p.x;
      const dy = w.y - p.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (this.lineBlocked(p.x, p.y, w.x, w.y)) continue;
      if (w.hp <= 1) {
        const d = Math.hypot(dx, dy) || 1;
        this.damageWorm(w, w.hp + 1, p.slot, dx / d, dy / d);
        continue;
      }
      w.hp *= half;
      w.maxHp = Math.max(1, w.maxHp * half);
      w.hp = Math.min(w.hp, w.maxHp);
      w.shrink = Math.max(COMPRESS.shrinkFloor, w.shrink * half);
      this.emit(EV.COMPRESS, p.slot, w.x, w.y, w.shrink);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (this.lineBlocked(p.x, p.y, e.x, e.y)) continue;
      if (e.hp <= 1) {
        const d = Math.hypot(dx, dy) || 1;
        this.damageError(e, e.hp + 1, p.slot, dx / d, dy / d);
        continue;
      }
      e.hp *= half;
      e.maxHp = Math.max(1, e.maxHp * half);
      e.hp = Math.min(e.hp, e.maxHp);
      this.emit(EV.COMPRESS, p.slot, e.x, e.y, 0);
    }
  }

  /**
   * Atomize's skill: two blue balls take up an orbit around the body. They have no
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
        let hr = w.hitR;
        if ((w.x - bx) ** 2 + (w.y - by) ** 2 <= (ATOMIZE.ballRadius + hr) ** 2) {
          hit = true;
        } else {
          for (let s = 0; s < w.segCount; s++) {
            const rr = ATOMIZE.ballRadius + w.segR;
            if ((w.segX[s] - bx) ** 2 + (w.segY[s] - by) ** 2 > rr * rr) continue;
            hit = true;
            hx = w.segX[s];
            hy = w.segY[s];
            hr = w.segR;
            break;
          }
        }
        if (!hit) continue;
        const dx = hx - bx;
        const dy = hy - by;
        const d = Math.hypot(dx, dy) || 1;
        this.damageWorm(w, ATOMIZE.ballDamage, p.slot, dx / d, dy / d, ATOMIZE.ballKnockback, hx, hy);
        this.consumeAtomBall(p);
        return;
      }
    }
  }

  private consumeAtomBall(p: Player): void {
    p.atomBalls = Math.max(0, p.atomBalls - 1);
    p.atomFlashT = ATOMIZE.ballBlockFlash;
    this.deflectTelemetry.atom[p.slot]++;
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

  /** Drops a persistent trap mine at the player's feet. No throw, no travel. */
  private plantMine(p: Player): void {
    // Mines now last until triggered, so cap the owner's live traps. The oldest one
    // retires when a fourth is planted, keeping the shared projectile pool finite.
    let owned = 0;
    let oldest: Projectile | null = null;
    for (let i = 0; i < this.projectiles.length; i++) {
      const other = this.projectiles[i];
      if (!other.active || other.type !== 1 || other.owner !== p.slot) continue;
      owned++;
      if (!oldest || other.serial < oldest.serial) oldest = other;
    }
    if (owned >= MINE.maxActive && oldest) oldest.active = false;

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
    // No fuse: the mine arms and then waits until a hostile steps into it.
    proj.fuse = 0;
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
    if (p.glueT > 0) {
      this.chipGlue(p);
      return false;
    }
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
    proj.lightning = false;
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
      // Bombs are shells, not shots: a guard cannot send one back. The super ball is
      // a rolling weight, too large and too committed to turn.
      if (proj.type === 8 || proj.type === 9 || proj.type === 15) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > p.guardReach + proj.radius) continue;
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
        proj.x = p.x + (dx / dist) * (p.guardReach + proj.radius + 1);
        proj.y = p.y + (dy / dist) * (p.guardReach + proj.radius + 1);
      }
      proj.owner = p.slot;
      proj.deflects++;
      proj.damage = (BOLT.damage + proj.deflects) * whipMult;
      proj.fuse = BOLT.reflectTtl;
      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      p.swingHit = true;
      p.guardT = Math.max(0, p.guardT - PLAYER.guardReflectCost);
      if (p.guardT === 0) p.guardCd = PLAYER.guardCooldown;
      this.deflectTelemetry.guard[p.slot]++;
      this.emit(EV.DEFLECT, p.slot, proj.x, proj.y, proj.deflects);
    }
  }

  private resolveSwing(p: Player): void {
    if (p.swingHit) return;
    const whip = p.powerupT > 0 && p.powerupKind === POWERUP_KIND.WHIP;
    const whipMult = whip ? POWERUP.whipMultiplier : 1;
    // The big third broom hit is a slab: it deflects along its whole drawn shaft.
    const reach =
      (p.program === PROGRAM_ID.SWEEP && p.swingKind === 3 ? SWEEP.bigReach : PLAYER.swingReach * p.meleeReachMult) * whipMult;
    const arcCos = Math.cos(p.meleeHalfAngle);
    const cos = Math.cos(p.swingFacing);
    const sin = Math.sin(p.swingFacing);
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active || proj.orbOwner >= 0) continue;
      if (proj.type === 8 || proj.type === 9 || proj.type === 15) continue;
      const dx = proj.x - p.x;
      const dy = proj.y - p.y;
      const distSq = dx * dx + dy * dy;
      const maxDist = reach + proj.radius;
      if (distSq > maxDist * maxDist || distSq < 1e-4) continue;
      const dist = Math.sqrt(distSq);
      const dot = (dx / dist) * cos + (dy / dist) * sin;
      if (dot < arcCos) continue;
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
      proj.fuse = BOLT.reflectTtl;

      proj.bounces = 0;
      proj.armed = false;
      proj.grace = 0;
      this.deflectTelemetry.swing[p.slot]++;
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
        // Mines never travel. They arm and then wait until a hostile steps in; there
        // is no timed detonation. The owner's live count is capped in plantMine.
        if (proj.grace > 0) {
          proj.grace = Math.max(0, proj.grace - dt);
          if (proj.grace === 0) proj.armed = true;
          continue;
        }
        if (this.mineTriggered(proj)) this.explodeMine(proj, proj.owner);
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
          if (this.pipeHit(proj)) break;
          if (proj.type === 8) {
            this.bouncePillars(proj);
            if (!proj.active) break;
          }
          this.bounceBumpers(proj);
          if (!proj.active) break;
          this.bounceBarriers(proj);
          if (!proj.active) break;
          if (this.keypadCoverAt(proj.x, proj.y, proj.radius)) {
            this.detonateBomb(proj);
            break;
          }
          if (this.browserCoverAt(proj.x, proj.y, proj.radius)) {
            this.detonateBomb(proj);
            break;
          }
          if (this.laptopCoverAt(proj.x, proj.y, proj.radius)) {
            this.detonateBomb(proj);
            break;
          }
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
        // The super ball is a rolling weight: it smashes through debris instead of
        // stopping on a file box like a bolt.
        if (proj.type !== 15 && this.propHit(proj)) break;
        if (this.pipeHit(proj)) break;
        this.bouncePillars(proj);
        if (!proj.active) break;
        this.bounceBumpers(proj);
        if (!proj.active) break;
        this.bounceBarriers(proj);
        if (!proj.active) break;
        if (this.keypadStopsProjectile(proj)) break;
        if (this.browserStopsProjectile(proj)) break;
        if (this.laptopStopsProjectile(proj)) break;
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

  /** Bounce count cap. Pinball's ball lives for many rails; the super ball never caps. */
  private bounceCap(proj: Projectile): number {
    if (proj.type === 15) return Infinity;
    if (proj.type === 14) return PINBALL.maxBounces;
    return BOLT.maxBounces;
  }

  /**
   * Shared bounce bookkeeping. Every wall, pillar and barrier hit burns one bounce and
   * raises the ball's speed a notch, so a long rally is visibly faster than the throw.
   */
  private noteBounce(proj: Projectile): void {
    proj.bounces++;
    if (proj.bounces > this.bounceCap(proj)) {
      proj.active = false;
      return;
    }
    if (proj.type !== 14) return;
    const speed = Math.hypot(proj.vx, proj.vy);
    if (speed <= 0.001) return;
    const next = Math.min(PINBALL.shotSpeedMax, speed * PINBALL.shotBounceGain);
    proj.vx = (proj.vx / speed) * next;
    proj.vy = (proj.vy / speed) * next;
  }

  private bounceWalls(proj: Projectile): void {
    // No outer wall for shots: GRID ZERO lets fire leave the plate and reach the Mega
    // Worm while it is still outside. Bodies stay clamped by stepPlayerMotion.
    if (this.openShots) return;
    if (this.openWalls) {
      const b = this.arena.bounds;
      const r = proj.radius;
      const disc = this.arena.disc;
      if (disc) {
        const dx = proj.x - this.centerX;
        const dy = proj.y - this.centerY;
        if (dx * dx + dy * dy <= (disc.radius - r) * (disc.radius - r)) return;
      } else if (proj.x > b.left + r && proj.x < b.right - r && proj.y > b.top + r && proj.y < b.bottom - r) return;
      // There is no wall to hit, so nothing ricochets: the shot falls into the void. A
      // committed shape keeps its geometry death, which is what makes a bomb detonate
      // at the lip instead of disappearing.
      if (proj.type === 5 || proj.type === 6 || proj.type === 8 || proj.type === 9 || proj.type === 10 || proj.type === 12 || proj.type === 17) {
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
    if (proj.type === 5 || proj.type === 6 || proj.type === 8 || proj.type === 9 || proj.type === 10 || proj.type === 12 || proj.type === 17) {
      // Spear, thrown broom, hourglass, Ghost's mouth and every bomb are committed
      // lines, not ricochets. They die on geometry; the bomb branch turns that into a
      // detonation.
      proj.active = false;
      this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 1);
      return;
    }
    if (proj.owner < 0 && proj.type >= 3 && proj.type !== 14) {
      // Low-tier hostile fire disperses on geometry. Bouncing is a stronger-enemy trait;
      // the arcade feed's live ball is allowed to keep its rally.
      proj.active = false;
      this.emit(EV.SENTRY_HIT, -1, proj.x, proj.y, 0, -proj.vx, -proj.vy);
      return;
    }
    this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 0);
    proj.armed = true;
    this.noteBounce(proj);
  }

  /** Deployed walls are real geometry: shots reflect off them like a pillar, and chip them. */
  private bounceBarriers(proj: Projectile): void {
    // The lobbed shell is airborne until it lands, so it clears a waist-high wall. The
    // super ball is a rolling weight, not a shot: it passes through a planted wall.
    if (proj.type === 9 || proj.type === 15) return;
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

      const heavy = proj.type === 5 || proj.type === 6 || proj.type === 8 || proj.type === 10 || proj.type === 12 || proj.type === 17;
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
      if (proj.owner < 0 && proj.type >= 3 && proj.type !== 14) {
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
      this.noteBounce(proj);
      return;
    }
  }

  private bouncePillars(proj: Projectile): void {
    // Walls only: the super ball rolls through cover instead of ricocheting off it.
    if (proj.type === 15) return;
    for (let i = 0; i < this.arena.pillars.length; i++) {
      if (this.bounceCoverRect(proj, this.arena.pillars[i])) return;
    }
    // A raised match popup is temporary cover, not arena geometry. Shots still see it
    // while it stands, so the card cannot be used as a free firing slit.
    if (this.swipePopupSolid && this.bounceCoverRect(proj, this.swipePopupSolid)) return;
    if (this.satelliteTelescopeRect.h > 0 && this.bounceCoverRect(proj, this.satelliteTelescopeRect)) return;
    if (this.bounceRocketPath(proj)) return;
    for (let i = 0; i < this.carBarrierRects.length; i++) {
      const r = this.carBarrierRects[i];
      if (r.h > 0 && this.bounceCoverRect(proj, r)) return;
    }
  }

  /**
   * ROCKET NAVIGATION's flown arc is a shot-only reflector. Bodies, dashes, bots and
   * waves pass under it; every ordinary shot bounces instead of dying on cover. Hostile
   * fire is kept alive on purpose, so the lane becomes a growing crossfire over a round.
   * Mines, traps, bombs, the super ball and the rail round keep their own rules.
   */
  private bounceRocketPath(proj: Projectile): boolean {
    if (
      proj.type === 1 ||
      proj.type === 2 ||
      proj.type === 8 ||
      proj.type === 9 ||
      proj.type === 15 ||
      proj.type === 17
    ) {
      return false;
    }
    for (let i = 0; i < this.rocketBarrierRects.length; i++) {
      const r = this.rocketBarrierRects[i];
      if (r.h <= 0 || !circleRect(proj.x, proj.y, proj.radius, r, hitScratch)) continue;
      proj.x = hitScratch.px;
      proj.y = hitScratch.py;
      const vn = proj.vx * hitScratch.nx + proj.vy * hitScratch.ny;
      if (vn < 0) {
        proj.vx -= 2 * vn * hitScratch.nx;
        proj.vy -= 2 * vn * hitScratch.ny;
      }
      this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 0);
      proj.armed = true;
      this.noteBounce(proj);
      return true;
    }
    return false;
  }

  /** Shared shot/cover response for static pillars and the temporary swipe popup. */
  private bounceCoverRect(proj: Projectile, rect: Rect): boolean {
    if (!circleRect(proj.x, proj.y, proj.radius, rect, hitScratch)) return false;
    if (proj.type === 5 || proj.type === 6 || proj.type === 8 || proj.type === 10 || proj.type === 12 || proj.type === 17) {
      proj.active = false;
      this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 1);
      return true;
    }
    if (proj.owner < 0 && proj.type >= 3 && proj.type !== 14) {
      proj.active = false;
      this.emit(EV.SENTRY_HIT, -1, proj.x, proj.y, 0, hitScratch.nx, hitScratch.ny);
      return true;
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
    this.noteBounce(proj);
    return true;
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
      // A compressed body is genuinely smaller: the hitbox follows the drawn hull, so
      // the shrink is a real benefit and not only a visual.
      const rr = proj.radius + PLAYER.radius * p.shrink;
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
      if (proj.type === 17) {
        // Aim Bot's rail round: one body, one heavy hit, no pass-through and no bounce.
        this.damagePlayer(p, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed, AIMBOT.shotKnockback, hitKind, hitId);
        proj.active = false;
        return true;
      }
      if (proj.type === 14) {
        // Pinball: one pass per body. Damage is the current charge, then the ball gets
        // hotter and faster for the next body; the fifth body is the last.
        const bit = 1 << p.slot;
        if ((proj.hitPlayers & bit) !== 0) continue;
        proj.hitPlayers |= bit;
        this.damagePlayer(p, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed, PINBALL.shotKnockback, hitKind, hitId);
        if (this.pinballStruck(proj)) return true;
        continue;
      }
      if (proj.type === 15) {
        // The super ball rolls over bodies. One hit per body, no stop and no bounce.
        const bit = 1 << p.slot;
        if ((proj.hitPlayers & bit) !== 0) continue;
        proj.hitPlayers |= bit;
        this.damagePlayer(p, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed, PINBALL.powerKnockback, hitKind, hitId);
        continue;
      }
      if (proj.type === 16) {
        // A file tears on impact and throws two smaller files out of the body. The
        // children carry variant 1, so the chain stops there.
        this.damagePlayer(
          p,
          proj.damage,
          proj.owner,
          proj.vx / speed,
          proj.vy / speed,
          proj.variant > 0 ? COPYPASTA.splitKnockback : COPYPASTA.shotKnockback,
          hitKind,
          hitId,
        );
        this.splitCopyShot(proj);
        proj.active = false;
        return true;
      }
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
      if (proj.type === 13) {
        // Compress's orb: a light hit that leaves the victim permanently smaller and
        // shortens their health cap. It still stops on the body like a bolt.
        this.damagePlayer(p, proj.damage, proj.owner, proj.vx / speed, proj.vy / speed, COMPRESS.orbKnockback, hitKind, hitId);
        this.compressPlayerHit(p, proj.owner);
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
        } else if (proj.type === 14 || proj.type === 15) {
          // Both ball types pass through the drone. Pinball heats up and keeps rolling;
          // the super ball simply rolls on after its one hit.
          if (!proj.hitDrone) {
            proj.hitDrone = true;
            this.damageDrone(proj.damage, proj.owner);
            if (proj.type === 14) this.pinballStruck(proj);
          }
          return false;
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
          if (proj.type === 16) this.splitCopyShot(proj);
          if (proj.type === 13 && this.drone.active) {
            this.drone.maxHp = this.compressedCap(this.drone.maxHp);
            this.drone.hp = Math.min(this.drone.hp, this.drone.maxHp);
            this.drone.radius = Math.max(6, this.drone.radius * (1 - COMPRESS.shrinkStep));
            this.emit(EV.COMPRESS, proj.owner, this.drone.x, this.drone.y, this.drone.radius);
          }
          proj.active = false;
          return true;
        }
      }
    }
    return false;
  }

  /** Rebuild the four drive rectangles from the shared USB clock. */
  private refreshUsb(t: number): void {
    const usb = this.usb;
    if (!usb) return;
    this.usbT = t;
    for (let i = 0; i < this.usbRects.length; i++) usbDriveRect(this.arena, i, t, this.usbRects[i]);
  }

  /** Start every local round with the drives docked. */
  private resetUsb(): void {
    if (!this.usb) return;
    this.usbDX.fill(0);
    this.usbDY.fill(0);
    this.refreshUsb(0);
  }

  /** Advance the shared cycle and retain each drive's per-tick ride delta. */
  private tickUsb(dt: number): void {
    const usb = this.usb;
    if (!usb) return;
    const previous = usbExtensionAt(usb, this.usbT);
    this.usbT += dt;
    const next = usbExtensionAt(usb, this.usbT);
    const travel = next - previous;
    for (let i = 0; i < usb.drives.length; i++) {
      const angle = usb.drives[i].angle;
      this.usbDX[i] = Math.cos(angle) * travel;
      this.usbDY[i] = Math.sin(angle) * travel;
      usbDriveRect(this.arena, i, this.usbT, this.usbRects[i]);
    }
  }

  /**
   * Carry a body with its plate, then add the active current. The current is a direct
   * position drift rather than knockback: the player can still steer against it.
   */
  private shiftUsbBody(body: { x: number; y: number }, dt: number, flow: boolean): boolean {
    const usb = this.usb;
    if (!usb) return false;
    let moved = false;
    for (let i = 0; i < this.usbRects.length; i++) {
      const r = this.usbRects[i];
      if (body.x <= r.x || body.x >= r.x + r.w || body.y <= r.y || body.y >= r.y + r.h) continue;
      body.x += this.usbDX[i];
      body.y += this.usbDY[i];
      moved = true;
      break;
    }
    if (flow && usbFlowAt(this.arena, body.x, body.y, this.usbT, this.usbFlowVec)) {
      body.x += this.usbFlowVec.x * usb.flowSpeed * dt;
      body.y += this.usbFlowVec.y * usb.flowSpeed * dt;
      moved = true;
    }
    return moved;
  }

  /** The player's ride and current. A dash owns its own committed line. */
  private applyUsbPlayer(p: Player, dt: number): void {
    if (p.dashT > 0 || p.fallT > 0 || p.travelT > 0) return;
    this.shiftUsbBody(p, dt, true);
  }

  /** Push every local threat family with the same plate motion and current. */
  private applyUsbThreats(dt: number): void {
    if (!this.usb) return;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || w.held) continue;
      const px = w.x;
      const py = w.y;
      if (!this.shiftUsbBody(w, dt, true)) continue;
      const dx = w.x - px;
      const dy = w.y - py;
      for (let s = 0; s < w.segCount; s++) {
        w.segX[s] += dx;
        w.segY[s] += dy;
      }
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (v.active && !v.held && v.spawnT <= 0) this.shiftUsbBody(v, dt, true);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active) this.shiftUsbBody(s, dt, true);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (e.active) this.shiftUsbBody(e, dt, true);
    }
    if (this.drone.active) this.shiftUsbBody(this.drone, dt, true);
  }

  /** Clear both swipe clocks and drop any raised popup at the start of a round. */
  private resetSwipe(): void {
    this.swipeT = 0;
    this.swipePopupT = 0;
    this.syncSwipePopup();
  }

  /**
   * Advance the card deck and the popup cycle. The host applies the floor carry here;
   * guests derive the card, popup pose and warning from the synced clocks and receive
   * the resulting body positions in the snapshot.
   */
  private tickSwipe(dt: number): void {
    const swipe = this.swipe;
    if (!swipe) return;
    this.swipeT += dt;
    this.swipePopupT += dt;
    const index = swipeIndexAt(swipe, this.swipeT);
    const phase = swipePhaseAt(swipe, this.swipeT);
    if (index > 0 && phase < swipe.travel) {
      const dir = swipeDirectionAt(swipe, this.swipeT);
      const amount = dir * swipe.shift * Math.min(1, dt / Math.max(0.001, swipe.travel));
      this.shiftSwipeBodies(amount);
    }
    this.syncSwipePopup();
  }

  /** Carry every live body and shot with the phone floor. */
  private shiftSwipeBodies(dx: number): void {
    if (!this.swipe) return;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.travelT > 0 || p.fallT > 0) continue;
      this.shiftSwipeBody(p, dx, PLAYER.radius * p.shrink);
    }
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (!proj.active) continue;
      proj.x += dx;
      proj.prevX += dx;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || w.held) continue;
      const beforeX = w.x;
      const beforeY = w.y;
      this.shiftSwipeBody(w, dx, w.segR);
      const moveX = w.x - beforeX;
      const moveY = w.y - beforeY;
      for (let s = 0; s < w.segCount; s++) {
        w.segX[s] += moveX;
        w.segY[s] += moveY;
      }
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (v.active && !v.held && v.spawnT <= 0) this.shiftSwipeBody(v, dx, v.radius);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active) this.shiftSwipeBody(s, dx, s.radius);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (e.active) e.x += dx;
    }
    if (this.drone.active) this.shiftSwipeBody(this.drone, dx, this.drone.radius);
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (b.active) b.x += dx;
    }
  }

  /** Move one body with the floor, then keep it inside the phone/solid edges. */
  private shiftSwipeBody(body: { x: number; y: number; prevX?: number }, dx: number, radius: number): void {
    body.x += dx;
    if (body.prevX !== undefined) body.prevX += dx;
    const b = this.arena.bounds;
    body.x = Math.max(b.left + radius, Math.min(b.right - radius, body.x));
    for (let i = 0; i < this.solids.length; i++) {
      if (!circleRect(body.x, body.y, radius, this.solids[i], hitScratch)) continue;
      body.x = hitScratch.px;
      body.y = hitScratch.py;
    }
  }

  /** Add or remove the raised match platform from body and shot collision. */
  private syncSwipePopup(): void {
    const swipe = this.swipe;
    if (!swipe) return;
    const active = swipePopupActiveAt(swipe, this.swipePopupT);
    if (active && !this.swipePopupSolid) {
      const solid = { ...swipe.popup };
      this.swipePopupSolid = solid;
      this.solids = [...this.solids, solid];
      this.dashSolids = [...this.dashSolids, solid];
      this.pushBodiesOutOfSwipePopup(solid);
    } else if (!active && this.swipePopupSolid) {
      const solid = this.swipePopupSolid;
      this.swipePopupSolid = null;
      this.solids = this.solids.filter((r) => r !== solid);
      this.dashSolids = this.dashSolids.filter((r) => r !== solid);
    }
  }

  /** A popup that rises under a body displaces it instead of trapping it in cover. */
  private pushBodiesOutOfSwipePopup(solid: Rect): void {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive) continue;
      if (!circleRect(p.x, p.y, PLAYER.radius * p.shrink, solid, hitScratch)) continue;
      p.x = hitScratch.px;
      p.y = hitScratch.py;
      p.vx = 0;
      p.vy = 0;
      p.kx = 0;
      p.ky = 0;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      if (!circleRect(w.x, w.y, w.segR, solid, hitScratch)) continue;
      const mx = hitScratch.px - w.x;
      const my = hitScratch.py - w.y;
      w.x = hitScratch.px;
      w.y = hitScratch.py;
      for (let s = 0; s < w.segCount; s++) {
        w.segX[s] += mx;
        w.segY[s] += my;
      }
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      if (!circleRect(v.x, v.y, v.radius, solid, hitScratch)) continue;
      v.x = hitScratch.px;
      v.y = hitScratch.py;
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      if (!circleRect(s.x, s.y, s.radius, solid, hitScratch)) continue;
      s.x = hitScratch.px;
      s.y = hitScratch.py;
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      if (!circleRect(e.x, e.y, CASCADING_ERROR.blockSize * 0.5, solid, hitScratch)) continue;
      e.x = hitScratch.px;
      e.y = hitScratch.py;
    }
    if (this.drone.active && circleRect(this.drone.x, this.drone.y, this.drone.radius, solid, hitScratch)) {
      this.drone.x = hitScratch.px;
      this.drone.y = hitScratch.py;
    }
  }

  /** Reset the solar/telescope/meteor clocks and restore every capacitor. */
  private resetSatellite(): void {
    const sat = this.satellite;
    if (!sat) return;
    this.satelliteT = 0;
    this.satelliteMeteorT = sat.meteors.first;
    this.satelliteState = 0;
    this.satelliteThrusterT = 0;
    this.satelliteReentryT = 0;
    this.satelliteResetT = 0;
    this.satelliteHeatY = this.arena.bounds.bottom;
    this.satelliteSolarTickT = 0;
    this.satelliteBurnTickT = 0;
    this.satelliteTelescopePrev = 0;
    this.satelliteTelescopeRect.x = 0;
    this.satelliteTelescopeRect.y = this.arena.bounds.bottom + 200;
    this.satelliteTelescopeRect.w = 0;
    this.satelliteTelescopeRect.h = 0;
    for (let i = 0; i < sat.meteors.count; i++) {
      const m = this.satelliteMeteors[i];
      if (!m) continue;
      m.active = false;
      m.t = 0;
      m.hit = false;
    }
    for (let i = 0; i < this.satelliteCapsules.length; i++) {
      const b = this.satelliteCapsules[i];
      const d = this.satelliteCapDefs[i];
      if (!d) continue;
      b.active = true;
      b.kind = d.kind;
      b.x = d.x;
      b.y = d.y;
      b.w = d.w;
      b.h = d.h;
      b.hp = d.hp ?? FILE_PROP.hp;
      b.hitFlash = 0;
      b.dropT = 0;
      b.vx = 0;
      b.vy = 0;
      b.tx = 0;
      b.ty = 0;
      b.hazard = false;
      b.hurtCd = 0;
      b.capacitor = true;
    }
  }

  /** Reset the launch arc before a new round. */
  private resetRocket(): void {
    this.rocketT = 0;
    this.rocketProgress = 0;
    this.refreshRocketBarrier();
  }

  /** Reset the car route before a new round. */
  private resetCar(): void {
    this.carT = 0;
    this.carProgress = 0;
    this.refreshCarBarrier();
  }

  /** Advance the route and rebuild the collision blocks that approximate it. */
  private tickCar(dt: number): void {
    const car = this.car;
    if (!car) return;
    this.carT += dt;
    this.carProgress = carProgressAt(car, this.carT);
    this.refreshCarBarrier();
  }

  /**
   * The rendered route and the body/shot wall share one progress value. Only the most
   * recent `trailLength` of road stays live; older blocks are zeroed instead of removed,
   * so the solid list stays fixed and the wall cannot grow into a full-map divider.
   */
  private refreshCarBarrier(): void {
    const car = this.car;
    if (!car) return;
    const active = Math.ceil(this.carProgress * car.segments);
    const total = carRouteLength(car);
    const trail = Math.max(0, car.trailLength) / Math.max(1, total);
    const first = Math.floor(Math.max(0, this.carProgress - trail) * car.segments);
    const half = car.thickness * 0.5;
    for (let i = 0; i < this.carBarrierRects.length; i++) {
      const rect = this.carBarrierRects[i];
      if (i < first || i >= active) {
        rect.x = 0;
        rect.y = 0;
        rect.w = 0;
        rect.h = 0;
        continue;
      }
      carRouteAt(car, (i + 1) / car.segments, this.carScratch);
      rect.x = this.carScratch.x - half;
      rect.y = this.carScratch.y - half;
      rect.w = car.thickness;
      rect.h = car.thickness;
    }
  }

  /** Reset the PONG scoreboard, paddles and serve clock. */
  /** Reset the scope clock and every per-pass hit mask. */
  private resetRadar(): void {
    this.radarT = 0;
    const count = this.radar?.planes.length ?? 0;
    this.radarLap = new Array(count).fill(-1);
    this.radarHitPlayers = new Array(count).fill(0);
    this.radarHitWorms = new Array(count).fill(0);
    this.radarHitViruses = new Array(count).fill(0);
    this.radarHitSentries = new Array(count).fill(0);
    this.radarHitErrors = new Array(count).fill(0);
  }

  /**
   * Advance the air traffic scope. Planes are straight-line passes on a fixed clock, so
   * the state is fully derivable: the renderer draws the same positions from radarT.
   * One hit per plane per pass, per body.
   */
  private tickRadar(dt: number): void {
    const radar = this.radar;
    if (!radar) return;
    this.radarT += dt;
    for (let i = 0; i < radar.planes.length; i++) {
      const def = radar.planes[i];
      const lapDur = Math.max(def.period, def.run / def.speed + 1);
      const pt = this.radarT - def.delay;
      if (pt < 0) continue;
      const lap = Math.floor(pt / lapDur);
      if (this.radarLap[i] !== lap) {
        this.radarLap[i] = lap;
        this.radarHitPlayers[i] = 0;
        this.radarHitWorms[i] = 0;
        this.radarHitViruses[i] = 0;
        this.radarHitSentries[i] = 0;
        this.radarHitErrors[i] = 0;
      }
      const k = (pt - lap * lapDur) * def.speed;
      if (k > def.run) continue;
      const ex = radar.cx + Math.cos(def.bearing) * def.entry;
      const ey = radar.cy + Math.sin(def.bearing) * def.entry;
      const x = ex + Math.cos(def.heading) * k;
      const y = ey + Math.sin(def.heading) * k;

      for (let pi = 0; pi < this.players.length; pi++) {
        const p = this.players[pi];
        if (!p.active || !p.alive || p.dashT > 0 || phased(p) || p.iframes > 0) continue;
        if (this.radarHitPlayers[i] & (1 << pi)) continue;
        const dx = p.x - x;
        const dy = p.y - y;
        const reach = def.radius + PLAYER.radius * p.shrink;
        if (dx * dx + dy * dy > reach * reach) continue;
        this.radarHitPlayers[i] |= 1 << pi;
        const d = Math.hypot(dx, dy) || 1;
        this.damagePlayer(p, radar.damage, -1, dx / d, dy / d, radar.knockback, SRC.RADAR, -1);
      }

      if (this.mode === 'training' && this.drone.active) {
        const dx = this.drone.x - x;
        const dy = this.drone.y - y;
        const reach = def.radius + this.drone.radius;
        if (dx * dx + dy * dy <= reach * reach && !(this.radarHitSentries[i] & 1)) {
          this.radarHitSentries[i] |= 1;
          this.damageDrone(radar.damage, -1);
        }
      }
      if (this.mode !== 'gauntlet') continue;

      for (let wi = 0; wi < this.worms.length; wi++) {
        const w = this.worms[wi];
        if (!w.active || this.radarHitWorms[i] & (1 << wi)) continue;
        let hit = false;
        let hx = 0;
        let hy = 0;
        const dxh = w.x - x;
        const dyh = w.y - y;
        const reachH = def.radius + w.hitR;
        if (dxh * dxh + dyh * dyh <= reachH * reachH) {
          hit = true;
          hx = dxh;
          hy = dyh;
        }
        for (let s = 0; s < w.segCount && !hit; s++) {
          const dxs = w.segX[s] - x;
          const dys = w.segY[s] - y;
          const reachS = def.radius + w.segR;
          if (dxs * dxs + dys * dys <= reachS * reachS) {
            hit = true;
            hx = dxs;
            hy = dys;
          }
        }
        if (!hit) continue;
        this.radarHitWorms[i] |= 1 << wi;
        const d = Math.hypot(hx, hy) || 1;
        this.damageWorm(w, radar.damage, -1, hx / d, hy / d, 0, x + hx, y + hy);
      }
      for (let vi = 0; vi < this.viruses.length; vi++) {
        const v = this.viruses[vi];
        if (!v.active || this.radarHitViruses[i] & (1 << vi)) continue;
        const dx = v.x - x;
        const dy = v.y - y;
        const reach = def.radius + v.radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        this.radarHitViruses[i] |= 1 << vi;
        const d = Math.hypot(dx, dy) || 1;
        this.damageVirus(v, radar.damage, -1, dx / d, dy / d, radar.knockback);
      }
      for (let si = 0; si < this.sentries.length; si++) {
        const s = this.sentries[si];
        if (!s.active || this.radarHitSentries[i] & (1 << si)) continue;
        const dx = s.x - x;
        const dy = s.y - y;
        const reach = def.radius + s.radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        this.radarHitSentries[i] |= 1 << si;
        const d = Math.hypot(dx, dy) || 1;
        this.damageSentry(s, radar.damage, -1, dx / d, dy / d, radar.knockback);
      }
      for (let ei = 0; ei < this.errors.length; ei++) {
        const e = this.errors[ei];
        if (!e.active || this.radarHitErrors[i] & (1 << ei)) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        const reach = def.radius + CASCADING_ERROR.blockSize * 0.5;
        if (dx * dx + dy * dy > reach * reach) continue;
        this.radarHitErrors[i] |= 1 << ei;
        const d = Math.hypot(dx, dy) || 1;
        this.damageError(e, radar.damage, -1, dx / d, dy / d);
      }
    }
  }

  /** Reset the request traffic on every round and gauntlet start. */
  private resetRequests(): void {
    const def = this.requests;
    if (!def) return;
    this.requestT = def.firstDelay;
    this.requestRouteIndex = 0;
    this.requestNextRoute = def.pattern.length > 0 ? def.pattern[0] : 0;
    for (let i = 0; i < this.requestCars.length; i++) {
      const car = this.requestCars[i];
      car.active = false;
      car.route = 0;
      car.s = 0;
      car.x = 0;
      car.y = 0;
      car.dirX = 1;
      car.dirY = 0;
      car.horizontal = true;
      car.hitPlayers = 0;
    }
  }

  /** Put the GPU thermal cycle back to its opening state. */
  private resetServerHeat(): void {
    this.serverHeatT = 0;
    this.serverHeatTickT = 0;
    const srv = this.arena.server;
    if (srv?.heat) serverHeatZoneRects(srv, this.serverHeatAreas);
  }

  /**
   * Advance the GPU thermal cycle. Each accelerator card owns a padded skirt; while
   * the card is hot, every body standing on that skirt takes the shared tick. The
   * clock is local-only and never enters a snapshot.
   */
  private tickServerHeat(dt: number): void {
    const srv = this.arena.server;
    const heat = srv?.heat;
    if (!srv || !heat) return;
    this.serverHeatT += dt;
    this.serverHeatTickT -= dt;
    if (this.serverHeatTickT > 0) return;
    let hot = false;
    for (let i = 0; i < this.serverHeatAreas.length; i++) {
      if (serverHeatStateAt(heat, i, this.serverHeatT) !== SERVER_HEAT_STATE.hot) continue;
      hot = true;
      this.damageServerHeatRect(this.serverHeatAreas[i], heat.damage);
    }
    if (hot) this.serverHeatTickT = Math.max(0.1, heat.tick);
  }

  /** A hot card burns every body on its skirt. The card itself stays solid cover. */
  private damageServerHeatRect(rect: Rect, damage: number): void {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive) continue;
      if (p.x < rect.x || p.x > rect.x + rect.w || p.y < rect.y || p.y > rect.y + rect.h) continue;
      this.damagePlayer(p, damage, -1, 0, 0, 0, SRC.SERVER_HEAT, -1);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || w.held) continue;
      if (w.x < rect.x || w.x > rect.x + rect.w || w.y < rect.y || w.y > rect.y + rect.h) continue;
      this.damageWorm(w, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || v.held) continue;
      if (v.x < rect.x || v.x > rect.x + rect.w || v.y < rect.y || v.y > rect.y + rect.h) continue;
      this.damageVirus(v, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      if (s.x < rect.x || s.x > rect.x + rect.w || s.y < rect.y || s.y > rect.y + rect.h) continue;
      this.damageSentry(s, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      if (e.x < rect.x || e.x > rect.x + rect.w || e.y < rect.y || e.y > rect.y + rect.h) continue;
      this.damageError(e, damage, -1, 0, 0);
    }
    if (this.drone.active && this.drone.x >= rect.x && this.drone.x <= rect.x + rect.w && this.drone.y >= rect.y && this.drone.y <= rect.y + rect.h) {
      this.damageDrone(damage, -1);
    }
  }

  /** Advance the switch signal, launch the next chain and move every live car. */
  private tickRequests(dt: number): void {
    const def = this.requests;
    if (!def) return;
    this.requestT -= dt;
    if (this.requestT <= 0) {
      this.spawnRequestTrain();
      this.requestT += Math.max(0.1, def.interval);
      if (this.requestT <= 0) this.requestT = Math.max(0.1, def.interval);
    }
    for (let i = 0; i < this.requestCars.length; i++) {
      const car = this.requestCars[i];
      if (!car.active) continue;
      car.s += def.speed * dt;
      const total = this.requestCarAt(car);
      if (car.s > total + def.carW) {
        car.active = false;
        continue;
      }
      if (car.s < 0) continue;
      this.hitRequestPlayers(car, def);
    }
  }

  /** One car at a distance `s` along its entry -> switch -> lane -> exit route. */
  private requestCarAt(car: RequestCar): number {
    const def = this.requests;
    if (!def) return 0;
    const lane = def.lanes.length > 0 ? def.lanes[car.route % def.lanes.length] : def.hub.y;
    const approach = Math.max(1, def.hub.x - def.entry.x);
    const laneRun = Math.abs(lane - def.hub.y);
    const outbound = Math.max(1, def.exitX - def.hub.x);
    if (car.s < 0) {
      car.x = def.entry.x + car.s;
      car.y = def.hub.y;
      car.dirX = 1;
      car.dirY = 0;
      car.horizontal = true;
    } else if (car.s < approach) {
      car.x = def.entry.x + car.s;
      car.y = def.hub.y;
      car.dirX = 1;
      car.dirY = 0;
      car.horizontal = true;
    } else if (car.s < approach + laneRun) {
      car.x = def.hub.x;
      car.y = def.hub.y + Math.sign(lane - def.hub.y) * (car.s - approach);
      car.dirX = 0;
      car.dirY = Math.sign(lane - def.hub.y);
      car.horizontal = false;
    } else {
      car.x = def.hub.x + (car.s - approach - laneRun);
      car.y = lane;
      car.dirX = 1;
      car.dirY = 0;
      car.horizontal = true;
    }
    return approach + laneRun + outbound;
  }

  /** Put one authored request chain on the track. Cars enter nose-to-tail. */
  private spawnRequestTrain(): void {
    const def = this.requests;
    if (!def || def.lanes.length === 0) return;
    const route = this.requestNextRoute % def.lanes.length;
    for (let i = 0; i < def.cars; i++) {
      let car: RequestCar | null = null;
      for (let n = 0; n < this.requestCars.length; n++) {
        if (!this.requestCars[n].active) {
          car = this.requestCars[n];
          break;
        }
      }
      if (!car) break;
      car.active = true;
      car.route = route;
      car.s = -i * def.carGap;
      car.hitPlayers = 0;
      this.requestCarAt(car);
    }
    const pattern = def.pattern;
    this.requestRouteIndex = (this.requestRouteIndex + 1) % Math.max(1, pattern.length);
    this.requestNextRoute = pattern.length > 0 ? pattern[this.requestRouteIndex] ?? 0 : 0;
  }

  /** A request car hits once and shoves the body off the rail, not along the train. */
  private hitRequestPlayers(car: RequestCar, def: ArenaRequestDef): void {
    const halfW = (car.horizontal ? def.carW : def.carH) * 0.5;
    const halfH = (car.horizontal ? def.carH : def.carW) * 0.5;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.iframes > 0 || p.travelT > 0 || phased(p)) continue;
      const bit = 1 << p.slot;
      if (car.hitPlayers & bit) continue;
      const radius = PLAYER.radius * p.shrink;
      const closestX = Math.max(car.x - halfW, Math.min(p.x, car.x + halfW));
      const closestY = Math.max(car.y - halfH, Math.min(p.y, car.y + halfH));
      const dx = p.x - closestX;
      const dy = p.y - closestY;
      if (dx * dx + dy * dy > radius * radius) continue;
      car.hitPlayers |= bit;
      // The car's travel vector runs along the rail, so using it as knockback keeps a
      // head-on body in front of the train. Shove across the rail instead: the body is
      // damaged once and lands clear of the remaining cars.
      let pushX = 0;
      let pushY = 0;
      if (car.horizontal) {
        pushY = p.y <= car.y ? -1 : 1;
      } else {
        pushX = p.x <= car.x ? -1 : 1;
      }
      this.damagePlayer(
        p,
        def.damage,
        -1,
        pushX,
        pushY,
        def.knockback,
        SRC.REQUEST,
        -1,
      );
      // A three-car train takes ~0.74 s to clear one body; one train is one hit.
      p.iframes = Math.max(p.iframes, 0.9);
    }
  }

  /** Build the car-radio runtime once. The dial arrays are preallocated. */
  private makeRadioRuntime(): CarRadioRuntime | null {
    const def = this.arena.radio;
    if (!def) return null;
    const dialAngle = new Float32Array(def.dials.length);
    for (let i = 0; i < def.dials.length; i++) dialAngle[i] = def.dials[i].phase;
    const start = def.slider.path[0] ?? { x: 0, y: 0 };
    return {
      dialAngle,
      sliderT: 0,
      sliderDir: 1,
      sliderX: start.x,
      sliderY: start.y,
      sliderHitPlayers: 0,
      station: 0,
      stationT: 0,
      stationWarnT: 0,
      stationFlashT: 0,
      wavePhase: 0,
    };
  }

  /** Put the radio back on its first station and first tuner pass. */
  private resetRadio(): void {
    const def = this.arena.radio;
    const radio = this.radio;
    if (!def || !radio) return;
    for (let i = 0; i < def.dials.length; i++) radio.dialAngle[i] = def.dials[i].phase;
    radio.sliderT = 0;
    radio.sliderDir = 1;
    const start = def.slider.path[0] ?? { x: 0, y: 0 };
    radio.sliderX = start.x;
    radio.sliderY = start.y;
    radio.sliderHitPlayers = 0;
    radio.station = 0;
    radio.stationT = 0;
    radio.stationWarnT = 0;
    radio.stationFlashT = 0;
    radio.wavePhase = 0;
  }

  /**
   * Advance the radio. The tuner needle is the hazard: a vertical line that crosses
   * the faceplate and shoves one body per pass. The station clock only changes the
   * local waveform, never a snapshot field.
   */
  private tickRadio(dt: number): void {
    const def = this.arena.radio;
    const radio = this.radio;
    if (!def || !radio) return;
    for (let i = 0; i < def.dials.length; i++) {
      radio.dialAngle[i] += def.dials[i].rate * dt;
    }
    radio.wavePhase += dt * (1.4 + radio.station * 0.35);
    radio.stationT += dt;
    const remaining = Math.max(0, def.stationTime - radio.stationT);
    radio.stationWarnT = remaining <= def.warn ? remaining : 0;
    if (radio.stationT >= def.stationTime) {
      radio.stationT = 0;
      radio.station = (radio.station + 1) % Math.max(1, def.stations.length);
      radio.stationWarnT = 0;
      radio.stationFlashT = 0.55;
    }
    radio.stationFlashT = Math.max(0, radio.stationFlashT - dt);

    const a = def.slider.path[0];
    const b = def.slider.path[def.slider.path.length - 1];
    if (!a || !b) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0.001) return;
    radio.sliderT += ((def.slider.speed * radio.sliderDir) / len) * dt;
    if (radio.sliderT >= 1) {
      radio.sliderT = 1;
      radio.sliderDir = -1;
      radio.sliderHitPlayers = 0;
    } else if (radio.sliderT <= 0) {
      radio.sliderT = 0;
      radio.sliderDir = 1;
      radio.sliderHitPlayers = 0;
    }
    radio.sliderX = a.x + dx * radio.sliderT;
    radio.sliderY = a.y + dy * radio.sliderT;

    const halfW = def.slider.width * 0.5;
    const halfL = def.slider.length * 0.5;
    const ux = dx / len;
    const uy = dy / len;
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      if (!player.active || !player.alive) continue;
      const bit = 1 << player.slot;
      if ((radio.sliderHitPlayers & bit) !== 0) continue;
      const reach = PLAYER.radius * player.shrink;
      const qx = Math.max(-halfW, Math.min(halfW, player.x - radio.sliderX));
      const qy = Math.max(-halfL, Math.min(halfL, player.y - radio.sliderY));
      const ox = player.x - (radio.sliderX + qx);
      const oy = player.y - (radio.sliderY + qy);
      if (ox * ox + oy * oy > reach * reach) continue;
      radio.sliderHitPlayers |= bit;
      this.damagePlayer(
        player,
        def.slider.damage,
        -1,
        ux * radio.sliderDir,
        uy * radio.sliderDir,
        def.slider.knockback,
        SRC.CAR_RADIO,
        -1,
      );
    }
  }

  /** Build the traffic fixtures once. Arrays are preallocated; ticks only mutate. */
  private makeTrafficRuntime(): TrafficRuntime | null {
    const camera = this.arena.camera;
    const light = this.arena.light;
    const crosswalk = this.arena.crosswalk;
    if (!camera && !light && !crosswalk) return null;
    const photos: TrafficPhoto[] = [];
    for (let i = 0; i < 8; i++) {
      photos.push({ active: false, path: 0, seg: 0, x: 0, y: 0, angle: 0, hitPlayers: 0 });
    }
    const zoneCount = light?.zones.length ?? 0;
    const zoneX = new Float32Array(zoneCount);
    const zoneY = new Float32Array(zoneCount);
    if (light) {
      for (let i = 0; i < zoneCount; i++) {
        trafficZoneAt(light.zones[i].path, light.speed, light.zones[i].offset, 0, this.trafficPoint);
        zoneX[i] = this.trafficPoint.x;
        zoneY[i] = this.trafficPoint.y;
      }
    }
    // A crosswalk starts on its stop layout. The two layouts are authored apart, so the
    // World owns the active one and rebuilds solids when the sign swaps.
    if (crosswalk) this.arena.pillars = crosswalk.stop.map((rect) => ({ ...rect }));
    return {
      photos,
      photoT: camera?.interval ?? 0,
      photoPath: 0,
      cameraFlashT: 0,
      cameraPending: false,
      pipeFlash: new Float32Array(camera?.pipes.length ?? 0),
      lightClock: 0,
      lightStage: 0,
      lightStageT: 0,
      lightWarnT: light?.warn ?? 0,
      lightActive: false,
      lightTickT: 0,
      zoneX,
      zoneY,
      crosswalkWalk: false,
      crosswalkT: 0,
      crosswalkWarnT: 0,
      crosswalkFlashT: 0,
    };
  }

  /** Put the traffic fixtures back to their opening state. */
  private resetTraffic(): void {
    const traffic = this.traffic;
    if (!traffic) return;
    const camera = this.arena.camera;
    const light = this.arena.light;
    for (let i = 0; i < traffic.photos.length; i++) traffic.photos[i].active = false;
    traffic.photoT = camera?.interval ?? 0;
    traffic.photoPath = 0;
    traffic.cameraFlashT = 0;
    traffic.cameraPending = false;
    traffic.pipeFlash.fill(0);
    traffic.lightClock = 0;
    traffic.lightStage = 0;
    traffic.lightStageT = 0;
    traffic.lightWarnT = light?.warn ?? 0;
    traffic.lightActive = false;
    traffic.lightTickT = 0;
    if (light) {
      for (let i = 0; i < light.zones.length; i++) {
        trafficZoneAt(light.zones[i].path, light.speed, light.zones[i].offset, 0, this.trafficPoint);
        traffic.zoneX[i] = this.trafficPoint.x;
        traffic.zoneY[i] = this.trafficPoint.y;
      }
    }
    traffic.crosswalkT = 0;
    traffic.crosswalkWarnT = 0;
    traffic.crosswalkFlashT = 0;
    if (this.arena.crosswalk) this.setCrosswalkLayout(false, true);
  }

  /** One traffic photo leaves the lens along the next authored route. */
  private launchTrafficPhoto(): void {
    const traffic = this.traffic;
    const camera = this.arena.camera;
    if (!traffic || !camera || camera.paths.length === 0) return;
    const pathIndex = traffic.photoPath % camera.paths.length;
    const path = camera.paths[pathIndex];
    traffic.photoPath++;
    traffic.photoT = Math.max(0.1, camera.interval);
    for (let i = 0; i < traffic.photos.length; i++) {
      const photo = traffic.photos[i];
      if (photo.active) continue;
      photo.active = true;
      photo.path = pathIndex;
      photo.seg = 0;
      photo.x = path[0].x;
      photo.y = path[0].y;
      photo.angle = path.length > 1 ? Math.atan2(path[1].y - path[0].y, path[1].x - path[0].x) : 0;
      photo.hitPlayers = 0;
      return;
    }
  }

  /**
   * Advance the traffic fixtures. Photos follow authored routes and de-rez into their
   * pipe; the light stage moves one circle at a time; the crosswalk swaps its cover.
   * The host publishes the authoritative view in SnapshotHazards.traffic.
   */
  private tickTraffic(dt: number): void {
    const traffic = this.traffic;
    if (!traffic) return;
    const camera = this.arena.camera;
    if (camera) {
      for (let i = 0; i < traffic.pipeFlash.length; i++) {
        traffic.pipeFlash[i] = Math.max(0, traffic.pipeFlash[i] - dt);
      }
      if (traffic.cameraFlashT > 0) {
        traffic.cameraFlashT = Math.max(0, traffic.cameraFlashT - dt);
        if (traffic.cameraFlashT <= 0 && traffic.cameraPending) {
          traffic.cameraPending = false;
          this.launchTrafficPhoto();
        }
      } else {
        traffic.photoT -= dt;
        if (traffic.photoT <= 0) {
          traffic.cameraFlashT = Math.max(0.05, camera.warn);
          traffic.cameraPending = true;
        }
      }
      for (let i = 0; i < traffic.photos.length; i++) {
        const photo = traffic.photos[i];
        if (!photo.active) continue;
        const path = camera.paths[photo.path];
        if (!path || path.length < 2) {
          photo.active = false;
          continue;
        }
        let remaining = camera.speed * dt;
        while (remaining > 0 && photo.seg < path.length - 1) {
          const target = path[photo.seg + 1];
          const dx = target.x - photo.x;
          const dy = target.y - photo.y;
          const len = Math.hypot(dx, dy);
          if (len <= remaining || len <= 0.001) {
            photo.x = target.x;
            photo.y = target.y;
            photo.seg++;
            remaining -= len;
          } else {
            photo.x += (dx / len) * remaining;
            photo.y += (dy / len) * remaining;
            photo.angle = Math.atan2(dy, dx);
            remaining = 0;
          }
        }
        if (photo.seg >= path.length - 1) {
          photo.active = false;
          const pipe = photo.path % traffic.pipeFlash.length;
          if (traffic.pipeFlash.length > 0) traffic.pipeFlash[pipe] = 0.45;
          continue;
        }
        for (let p = 0; p < this.players.length; p++) {
          const player = this.players[p];
          if (!player.active || !player.alive) continue;
          const bit = 1 << player.slot;
          if ((photo.hitPlayers & bit) !== 0) continue;
          const dx = player.x - photo.x;
          const dy = player.y - photo.y;
          const reach = camera.radius + PLAYER.radius * player.shrink;
          if (dx * dx + dy * dy > reach * reach) continue;
          photo.hitPlayers |= bit;
          const d = Math.hypot(dx, dy);
          this.damagePlayer(
            player,
            camera.damage,
            -1,
            d > 0.001 ? dx / d : 1,
            d > 0.001 ? dy / d : 0,
            camera.knockback,
            SRC.TRAFFIC_CAMERA,
            -1,
          );
        }
      }
    }

    const light = this.arena.light;
    if (light && light.zones.length > 0 && light.stages.length > 0) {
      traffic.lightClock += dt;
      traffic.lightStageT += dt;
      let stage = light.stages[traffic.lightStage % light.stages.length];
      if (traffic.lightStageT >= Math.max(0.05, stage.duration)) {
        traffic.lightStage = (traffic.lightStage + 1) % light.stages.length;
        traffic.lightStageT = 0;
        traffic.lightTickT = 0;
        stage = light.stages[traffic.lightStage];
      }
      for (let i = 0; i < light.zones.length; i++) {
        const zone = light.zones[i];
        trafficZoneAt(zone.path, light.speed, zone.offset, traffic.lightClock, this.trafficPoint);
        traffic.zoneX[i] = this.trafficPoint.x;
        traffic.zoneY[i] = this.trafficPoint.y;
      }
      traffic.lightWarnT = Math.max(0, light.warn - traffic.lightStageT);
      traffic.lightActive = traffic.lightStageT >= light.warn;
      if (traffic.lightActive) {
        traffic.lightTickT -= dt;
        if (traffic.lightTickT <= 0) {
          traffic.lightTickT = Math.max(0.1, light.tick);
          const zone = light.zones[stage.zone];
          if (zone) {
            const x = traffic.zoneX[stage.zone];
            const y = traffic.zoneY[stage.zone];
            for (let p = 0; p < this.players.length; p++) {
              const player = this.players[p];
              if (!player.active || !player.alive) continue;
              const dx = player.x - x;
              const dy = player.y - y;
              if (dx * dx + dy * dy > zone.radius * zone.radius) continue;
              const d = Math.hypot(dx, dy);
              this.damagePlayer(
                player,
                light.damage,
                -1,
                d > 0.001 ? dx / d : 0,
                d > 0.001 ? dy / d : 0,
                light.knockback,
                SRC.TRAFFIC_LIGHT,
                -1,
              );
            }
          }
        }
      }
    }

    const crosswalk = this.arena.crosswalk;
    if (crosswalk) {
      traffic.crosswalkT += dt;
      const period = Math.max(0.5, crosswalk.period);
      const walkTime = Math.max(0, Math.min(period, crosswalk.walkTime));
      const stopTime = Math.max(0.05, period - walkTime);
      const phase = traffic.crosswalkT % period;
      const walk = phase >= stopTime;
      const remaining = walk ? period - phase : stopTime - phase;
      traffic.crosswalkWarnT = remaining <= crosswalk.warn ? Math.max(0, remaining) : 0;
      traffic.crosswalkFlashT = Math.max(0, traffic.crosswalkFlashT - dt);
      if (walk !== traffic.crosswalkWalk) {
        traffic.crosswalkFlashT = 0.35;
        this.setCrosswalkLayout(walk, false);
      }
    }
  }

  /** Swap the crosswalk's solid layout and eject any body the new cover landed on. */
  private setCrosswalkLayout(walk: boolean, force: boolean): void {
    const crosswalk = this.arena.crosswalk;
    const traffic = this.traffic;
    if (!crosswalk || !traffic) return;
    if (!force && traffic.crosswalkWalk === walk) return;
    traffic.crosswalkWalk = walk;
    this.arena.pillars = (walk ? crosswalk.walk : crosswalk.stop).map((rect) => ({ ...rect }));
    this.baseSolids = [...this.arena.pillars];
    this.baseDashSolids = [...this.arena.pillars];
    this.rebuildSolids();
    this.pushPlayersOutOfArcade();
  }

  /** Build the local arcade runtime once. Arrays are preallocated; ticks only mutate. */
  private makeArcadeRuntime(): ArcadeRuntime | null {
    const arena = this.arena;
    if (!arena.dispenser && !arena.soda && !arena.race && !arena.fighter && !arena.duck && !arena.tetris) {
      return null;
    }
    const drops: ArcadeDrop[] = [];
    for (let i = 0; i < 14; i++) {
      drops.push({
        active: false,
        kind: 0,
        variant: 0,
        x: 0,
        y: 0,
        vy: 0,
        r: 0,
        spin: 0,
        warnT: 0,
        hitPlayers: 0,
      });
    }
    const raceCars: ArcadeRaceCar[] = [];
    for (let i = 0; i < 12; i++) {
      raceCars.push({ active: false, angle: 0, dir: 1, hitPlayers: 0, flashT: 0 });
    }
    const fighterShots: ArcadeShot[] = [];
    for (let i = 0; i < 8; i++) {
      fighterShots.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, side: 0, hitPlayers: 0, flashT: 0 });
    }
    const duckBirds: ArcadeBird[] = [];
    for (let i = 0; i < 8; i++) {
      duckBirds.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, state: 0, shotT: 0, hitPlayers: 0, variant: 0 });
    }
    const cols = arena.tetris?.cols ?? 0;
    const rows = arena.tetris?.rows ?? 0;
    return {
      drops,
      dropT: 0.8,
      dropPoint: 0,
      dropFlashT: 0,
      sodaCounts: (arena.soda?.stacks ?? []).map((stack) => stack.cans),
      sodaT: 2.4,
      sodaFlashT: 0,
      raceCars,
      raceT: 0,
      fighterT: 1.2,
      fighterSide: 0,
      fighterKind: 0,
      fighterWarnT: 0,
      fighterActiveT: 0,
      fighterHitPlayers: 0,
      fighterShots,
      duckBirds,
      duckT: 0.7,
      duckShotT: 2.2,
      duckTarget: -1,
      tetrisGrid: new Uint8Array(cols * rows),
      tetrisPiece: { active: false, shape: 0, x: 0, y: 0, fallT: 0 },
      tetrisT: 0,
      tetrisClearT: 0,
      tetrisClearRow: -1,
    };
  }

  /** Put the arcade run back to its opening state. Cover is rebuilt from the arena data. */
  private resetArcade(): void {
    const arcade = this.arcade;
    if (!arcade) return;
    for (let i = 0; i < arcade.drops.length; i++) {
      const drop = arcade.drops[i];
      drop.active = false;
      drop.hitPlayers = 0;
    }
    arcade.dropT = this.arena.dispenser?.warn ?? 0.8;
    arcade.dropPoint = 0;
    arcade.dropFlashT = 0;
    const stacks = this.arena.soda?.stacks ?? [];
    for (let i = 0; i < stacks.length; i++) arcade.sodaCounts[i] = stacks[i].cans;
    arcade.sodaT = this.arena.soda?.interval ?? 2.4;
    arcade.sodaFlashT = 0;
    const race = this.arena.race;
    for (let i = 0; i < arcade.raceCars.length; i++) {
      const car = arcade.raceCars[i];
      car.active = !!race && i < race.cars;
      car.angle = race ? (i / Math.max(1, race.cars)) * Math.PI * 2 : 0;
      car.dir = 1;
      car.hitPlayers = 0;
      car.flashT = 0;
    }
    arcade.raceT = 0;
    arcade.fighterT = 1.2;
    arcade.fighterSide = 0;
    arcade.fighterKind = 0;
    arcade.fighterWarnT = 0;
    arcade.fighterActiveT = 0;
    arcade.fighterHitPlayers = 0;
    for (let i = 0; i < arcade.fighterShots.length; i++) {
      arcade.fighterShots[i].active = false;
      arcade.fighterShots[i].hitPlayers = 0;
    }
    for (let i = 0; i < arcade.duckBirds.length; i++) {
      arcade.duckBirds[i].active = false;
      arcade.duckBirds[i].state = 0;
      arcade.duckBirds[i].hitPlayers = 0;
    }
    arcade.duckT = 0.7;
    arcade.duckShotT = 2.2;
    arcade.duckTarget = -1;
    arcade.tetrisGrid.fill(0);
    arcade.tetrisPiece.active = false;
    arcade.tetrisT = 0;
    arcade.tetrisClearT = 0;
    arcade.tetrisClearRow = -1;
    if (this.arena.tetris) this.startTetrisPiece();
    this.rebuildArcadeSolids();
  }

  private tickArcade(dt: number): void {
    const arcade = this.arcade;
    if (!arcade) return;
    arcade.dropFlashT = Math.max(0, arcade.dropFlashT - dt);
    arcade.sodaFlashT = Math.max(0, arcade.sodaFlashT - dt);
    if (this.arena.dispenser) this.tickDispenser(dt);
    if (this.arena.soda) this.tickSoda(dt);
    if (this.arena.race) this.tickRace(dt);
    if (this.arena.fighter) this.tickFighter(dt);
    if (this.arena.duck) this.tickDuck(dt);
    if (this.arena.tetris) this.tickTetris(dt);
  }

  /** A guard or the live lash catches something in front of the body. */
  private arcadeCatch(p: Player, dirX: number, dirY: number): boolean {
    if (p.guardT <= 0 && p.swingPhase !== 2) return false;
    return Math.cos(p.facing) * dirX + Math.sin(p.facing) * dirY > -0.1;
  }

  private arcadeHit(
    p: Player,
    amount: number,
    x: number,
    y: number,
    knockback: number,
    sourceKind: number,
    sourceId: number,
    iframes = 0.5,
  ): void {
    if (!p.active || !p.alive || p.iframes > 0 || p.travelT > 0 || phased(p)) return;
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy) || 1;
    this.damagePlayer(p, amount, -1, dx / d, dy / d, knockback, sourceKind, sourceId);
    p.iframes = Math.max(p.iframes, iframes);
  }

  private tickDispenser(dt: number): void {
    const arcade = this.arcade;
    const def = this.arena.dispenser;
    if (!arcade || !def) return;
    arcade.dropT -= dt;
    if (arcade.dropT <= 0) {
      this.spawnArcadeDrop();
      arcade.dropT += Math.max(0.35, def.interval);
    }
    for (let i = 0; i < arcade.drops.length; i++) {
      const drop = arcade.drops[i];
      if (!drop.active) continue;
      drop.spin += dt * 7;
      if (drop.warnT > 0) {
        drop.warnT = Math.max(0, drop.warnT - dt);
        if (drop.warnT === 0) drop.vy = def.fallSpeed;
        continue;
      }
      drop.y += drop.vy * dt;
      if (drop.y + drop.r >= def.tray.y + 8) {
        drop.active = false;
        arcade.dropFlashT = 0.3;
        continue;
      }
      for (let pi = 0; pi < this.players.length; pi++) {
        const p = this.players[pi];
        if (!p.active || !p.alive || p.iframes > 0 || p.travelT > 0 || phased(p)) continue;
        const bit = 1 << p.slot;
        if (drop.hitPlayers & bit) continue;
        const reach = drop.r + PLAYER.radius * p.shrink;
        const dx = p.x - drop.x;
        const dy = p.y - drop.y;
        if (dx * dx + dy * dy > reach * reach) continue;
        drop.hitPlayers |= bit;
        drop.active = false;
        this.arcadeHit(p, def.damage, drop.x, drop.y, def.knockback, SRC.DISPENSER, i, 0.55);
        break;
      }
    }
  }

  private spawnArcadeDrop(): void {
    const arcade = this.arcade;
    const def = this.arena.dispenser;
    if (!arcade || !def || def.points.length === 0) return;
    let drop: ArcadeDrop | null = null;
    for (let i = 0; i < arcade.drops.length; i++) {
      if (!arcade.drops[i].active) {
        drop = arcade.drops[i];
        break;
      }
    }
    if (!drop) return;
    const point = def.points[arcade.dropPoint % def.points.length];
    arcade.dropPoint = (arcade.dropPoint + 1) % def.points.length;
    drop.active = true;
    drop.kind = def.kind === 'snack' ? 0 : 1;
    drop.variant = this.rng.int(0, Math.max(1, def.variants.length));
    drop.x = point.x;
    drop.y = point.y;
    drop.vy = 0;
    drop.r = def.radius;
    drop.spin = this.rng.range(0, Math.PI * 2);
    drop.warnT = def.warn;
    drop.hitPlayers = 0;
  }

  private tickSoda(dt: number): void {
    const arcade = this.arcade;
    const def = this.arena.soda;
    if (!arcade || !def) return;
    arcade.sodaT -= dt;
    if (arcade.sodaT > 0) return;
    arcade.sodaT += Math.max(0.6, def.interval);
    for (let i = 0; i < arcade.sodaCounts.length; i++) {
      if (arcade.sodaCounts[i] <= 0) continue;
      arcade.sodaCounts[i]--;
      arcade.sodaFlashT = 0.4;
      this.rebuildArcadeSolids();
      break;
    }
  }

  private tickRace(dt: number): void {
    const arcade = this.arcade;
    const def = this.arena.race;
    if (!arcade || !def) return;
    arcade.raceT += dt;
    const angular = def.speed / Math.max(1, (def.rx + def.ry) * 0.5);
    for (let ci = 0; ci < arcade.raceCars.length; ci++) {
      const car = arcade.raceCars[ci];
      if (!car.active) continue;
      car.flashT = Math.max(0, car.flashT - dt);
      car.angle += car.dir * angular * dt;
      const x = def.center.x + Math.cos(car.angle) * def.rx;
      const y = def.center.y + Math.sin(car.angle) * def.ry;
      const dirX = -Math.sin(car.angle) * car.dir;
      const dirY = Math.cos(car.angle) * car.dir;
      const reach = def.carW * 0.5 + PLAYER.radius;
      for (let pi = 0; pi < this.players.length; pi++) {
        const p = this.players[pi];
        if (!p.active || !p.alive || p.travelT > 0 || phased(p)) continue;
        const bit = 1 << p.slot;
        const dx = p.x - x;
        const dy = p.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > reach * reach) {
          if (d2 > (reach + 40) * (reach + 40)) car.hitPlayers &= ~bit;
          continue;
        }
        if (this.arcadeCatch(p, dirX, dirY)) {
          car.dir *= -1;
          car.hitPlayers = 0;
          car.flashT = 0.25;
          p.iframes = Math.max(p.iframes, 0.25);
          this.emit(EV.DEFLECT, p.slot, x, y, 1, -dirX, -dirY);
          continue;
        }
        if (p.iframes > 0 || car.hitPlayers & bit) continue;
        car.hitPlayers |= bit;
        this.arcadeHit(p, def.damage, x, y, def.knockback, SRC.RACE, ci, 0.7);
      }
    }
  }

  private tickFighter(dt: number): void {
    const arcade = this.arcade;
    const def = this.arena.fighter;
    if (!arcade || !def) return;
    for (let i = 0; i < arcade.fighterShots.length; i++) {
      const shot = arcade.fighterShots[i];
      if (!shot.active) continue;
      shot.flashT = Math.max(0, shot.flashT - dt);
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (shot.x < this.arena.bounds.left - 40 || shot.x > this.arena.bounds.right + 40) {
        shot.active = false;
        continue;
      }
      for (let pi = 0; pi < this.players.length; pi++) {
        const p = this.players[pi];
        if (!p.active || !p.alive || p.iframes > 0 || p.travelT > 0 || phased(p)) continue;
        const bit = 1 << p.slot;
        if (shot.hitPlayers & bit) continue;
        const reach = shot.r + PLAYER.radius * p.shrink;
        const dx = p.x - shot.x;
        const dy = p.y - shot.y;
        if (dx * dx + dy * dy > reach * reach) continue;
        const travel = Math.sign(shot.vx) || 1;
        if (this.arcadeCatch(p, travel, 0)) {
          shot.vx *= -1;
          shot.hitPlayers = 0;
          shot.flashT = 0.25;
          p.iframes = Math.max(p.iframes, 0.25);
          this.emit(EV.DEFLECT, p.slot, shot.x, shot.y, 1, -travel, 0);
          continue;
        }
        shot.hitPlayers |= bit;
        shot.active = false;
        this.arcadeHit(p, def.damage, shot.x, shot.y, def.knockback, SRC.FIGHTER, i, 0.6);
        break;
      }
    }
    if (arcade.fighterWarnT > 0) {
      arcade.fighterWarnT -= dt;
      if (arcade.fighterWarnT <= 0) {
        arcade.fighterActiveT = def.active;
        arcade.fighterHitPlayers = 0;
        if (arcade.fighterKind === 2) this.spawnFighterShot();
      }
      return;
    }
    if (arcade.fighterActiveT > 0) {
      arcade.fighterActiveT = Math.max(0, arcade.fighterActiveT - dt);
      if (arcade.fighterKind !== 2) this.hitFighterMelee();
      return;
    }
    arcade.fighterT -= dt;
    if (arcade.fighterT > 0) return;
    arcade.fighterT += Math.max(1.0, def.interval);
    arcade.fighterSide = arcade.fighterSide === 0 ? 1 : 0;
    arcade.fighterKind = (arcade.fighterKind + 1) % 3;
    arcade.fighterWarnT = def.warn;
  }

  private spawnFighterShot(): void {
    const arcade = this.arcade;
    const def = this.arena.fighter;
    if (!arcade || !def) return;
    let shot: ArcadeShot | null = null;
    for (let i = 0; i < arcade.fighterShots.length; i++) {
      if (!arcade.fighterShots[i].active) {
        shot = arcade.fighterShots[i];
        break;
      }
    }
    if (!shot) return;
    const left = arcade.fighterSide === 0;
    shot.active = true;
    shot.x = left ? def.left.x + 54 : def.right.x - 54;
    shot.y = def.left.y;
    shot.vx = left ? def.fireballSpeed : -def.fireballSpeed;
    shot.vy = 0;
    shot.r = def.fireballRadius;
    shot.side = arcade.fighterSide;
    shot.hitPlayers = 0;
    shot.flashT = 0;
  }

  private hitFighterMelee(): void {
    const arcade = this.arcade;
    const def = this.arena.fighter;
    if (!arcade || !def) return;
    const left = arcade.fighterSide === 0;
    const originX = left ? def.left.x : def.right.x;
    const dirX = left ? 1 : -1;
    const x1 = left ? originX + 34 : originX - 34 - def.reach;
    for (let pi = 0; pi < this.players.length; pi++) {
      const p = this.players[pi];
      if (!p.active || !p.alive || p.iframes > 0 || p.travelT > 0 || phased(p)) continue;
      const bit = 1 << p.slot;
      if (arcade.fighterHitPlayers & bit) continue;
      const cy = def.left.y;
      if (p.y < cy - 54 || p.y > cy + 54) continue;
      if (p.x < x1 || p.x > x1 + def.reach) continue;
      if (this.arcadeCatch(p, dirX, 0)) {
        arcade.fighterHitPlayers |= bit;
        p.iframes = Math.max(p.iframes, 0.25);
        this.emit(EV.DEFLECT, p.slot, p.x, p.y, 1, -dirX, 0);
        continue;
      }
      arcade.fighterHitPlayers |= bit;
      this.arcadeHit(p, def.damage, originX, cy, def.knockback, SRC.FIGHTER, 1, 0.55);
    }
  }

  private tickDuck(dt: number): void {
    const arcade = this.arcade;
    const def = this.arena.duck;
    if (!arcade || !def) return;
    arcade.duckT -= dt;
    if (arcade.duckT <= 0) {
      this.spawnDuckBird();
      arcade.duckT += Math.max(0.7, def.interval);
    }
    arcade.duckShotT -= dt;
    if (arcade.duckShotT <= 0) {
      arcade.duckShotT = Math.max(1.0, def.interval * 1.5);
      for (let i = 0; i < arcade.duckBirds.length; i++) {
        const bird = arcade.duckBirds[i];
        if (!bird.active || bird.state !== 0 || bird.shotT > 0) continue;
        bird.shotT = def.warn;
        arcade.duckTarget = i;
        break;
      }
    }
    for (let i = 0; i < arcade.duckBirds.length; i++) {
      const bird = arcade.duckBirds[i];
      if (!bird.active) continue;
      if (bird.state === 0) {
        bird.x += bird.vx * dt;
        if (bird.x < def.sky.x - 50 || bird.x > def.sky.x + def.sky.w + 50) {
          bird.active = false;
          if (arcade.duckTarget === i) arcade.duckTarget = -1;
          continue;
        }
        if (bird.shotT > 0) {
          bird.shotT -= dt;
          if (bird.shotT <= 0) {
            bird.shotT = 0;
            bird.state = 1;
            bird.vy = def.fallSpeed;
            arcade.duckTarget = -1;
            this.blastDuck(bird, i, def.aoeRadius, def.damage, def.knockback);
          }
        }
        continue;
      }
      bird.y += bird.vy * dt;
      bird.x += bird.vx * 0.15 * dt;
      if (bird.y > def.trayY) {
        bird.active = false;
        continue;
      }
      for (let pi = 0; pi < this.players.length; pi++) {
        const p = this.players[pi];
        if (!p.active || !p.alive || p.iframes > 0 || p.travelT > 0 || phased(p)) continue;
        const bit = 1 << p.slot;
        if (bird.hitPlayers & bit) continue;
        const reach = 18 + PLAYER.radius * p.shrink;
        const dx = p.x - bird.x;
        const dy = p.y - bird.y;
        if (dx * dx + dy * dy > reach * reach) continue;
        bird.hitPlayers |= bit;
        bird.active = false;
        this.arcadeHit(p, def.damage, bird.x, bird.y, def.knockback, SRC.DUCK, i, 0.6);
        break;
      }
    }
  }

  private spawnDuckBird(): void {
    const arcade = this.arcade;
    const def = this.arena.duck;
    if (!arcade || !def) return;
    let bird: ArcadeBird | null = null;
    for (let i = 0; i < arcade.duckBirds.length; i++) {
      if (!arcade.duckBirds[i].active) {
        bird = arcade.duckBirds[i];
        break;
      }
    }
    if (!bird) return;
    const fromLeft = this.rng.next() < 0.5;
    bird.active = true;
    bird.x = fromLeft ? def.sky.x - 28 : def.sky.x + def.sky.w + 28;
    bird.y = def.sky.y + 28 + this.rng.range(0, Math.max(1, def.sky.h - 56));
    bird.vx = (fromLeft ? 1 : -1) * def.speed;
    bird.vy = 0;
    bird.state = 0;
    bird.shotT = 0;
    bird.hitPlayers = 0;
    bird.variant = this.rng.int(0, 3);
  }

  private blastDuck(bird: ArcadeBird, id: number, radius: number, damage: number, knockback: number): void {
    for (let pi = 0; pi < this.players.length; pi++) {
      const p = this.players[pi];
      if (!p.active || !p.alive || p.iframes > 0 || p.travelT > 0 || phased(p)) continue;
      const dx = p.x - bird.x;
      const dy = p.y - bird.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      this.arcadeHit(p, damage, bird.x, bird.y, knockback, SRC.DUCK, id, 0.6);
    }
  }

  private startTetrisPiece(): void {
    const arcade = this.arcade;
    const def = this.arena.tetris;
    if (!arcade || !def) return;
    arcade.tetrisPiece.active = true;
    arcade.tetrisPiece.shape = this.rng.int(0, TETROMINO_SHAPES.length);
    arcade.tetrisPiece.x = Math.floor((def.cols - 4) * 0.5);
    arcade.tetrisPiece.y = 0;
    arcade.tetrisPiece.fallT = def.fallInterval;
  }

  private tetrisPieceCanFall(): boolean {
    const arcade = this.arcade;
    const def = this.arena.tetris;
    if (!arcade || !def) return false;
    const piece = arcade.tetrisPiece;
    const shape = TETROMINO_SHAPES[piece.shape % TETROMINO_SHAPES.length];
    for (let i = 0; i < shape.length; i++) {
      const x = piece.x + shape[i][0];
      const y = piece.y + shape[i][1] + 1;
      if (x < 0 || x >= def.cols || y >= def.rows) return false;
      if (y >= 0 && arcade.tetrisGrid[y * def.cols + x] !== 0) return false;
    }
    return true;
  }

  private tickTetris(dt: number): void {
    const arcade = this.arcade;
    const def = this.arena.tetris;
    if (!arcade || !def) return;
    if (arcade.tetrisClearT > 0) {
      arcade.tetrisClearT = Math.max(0, arcade.tetrisClearT - dt);
      return;
    }
    if (arcade.tetrisT > 0) {
      arcade.tetrisT = Math.max(0, arcade.tetrisT - dt);
      if (arcade.tetrisT > 0) return;
      this.startTetrisPiece();
      return;
    }
    const piece = arcade.tetrisPiece;
    if (!piece.active) {
      this.startTetrisPiece();
      return;
    }
    piece.fallT -= dt;
    if (piece.fallT > 0) return;
    piece.fallT += Math.max(0.12, def.fallInterval);
    if (this.tetrisPieceCanFall()) {
      piece.y++;
      return;
    }
    // The piece has landed. Its cells become ordinary cover for bodies and shots.
    piece.active = false;
    const shape = TETROMINO_SHAPES[piece.shape % TETROMINO_SHAPES.length];
    for (let i = 0; i < shape.length; i++) {
      const x = piece.x + shape[i][0];
      const y = piece.y + shape[i][1];
      if (x < 0 || x >= def.cols || y < 0 || y >= def.rows) continue;
      arcade.tetrisGrid[y * def.cols + x] = piece.shape + 1;
    }
    arcade.tetrisClearRow = this.clearTetrisRows();
    this.rebuildArcadeSolids();
    if (arcade.tetrisClearRow >= 0) arcade.tetrisClearT = def.clearFlash;
    arcade.tetrisT = arcade.tetrisClearRow >= 0 ? def.clearFlash : 0.35;
  }

  /** Clear every full row, shift the stack down, and return the first cleared row. */
  private clearTetrisRows(): number {
    const arcade = this.arcade;
    const def = this.arena.tetris;
    if (!arcade || !def) return -1;
    let first = -1;
    let y = def.rows - 1;
    while (y >= 0) {
      let full = true;
      for (let x = 0; x < def.cols; x++) {
        if (arcade.tetrisGrid[y * def.cols + x] === 0) {
          full = false;
          break;
        }
      }
      if (!full) {
        y--;
        continue;
      }
      if (first < 0) first = y;
      for (let row = y; row > 0; row--) {
        for (let x = 0; x < def.cols; x++) {
          arcade.tetrisGrid[row * def.cols + x] = arcade.tetrisGrid[(row - 1) * def.cols + x];
        }
      }
      for (let x = 0; x < def.cols; x++) arcade.tetrisGrid[x] = 0;
    }
    return first;
  }

  /** Rebuild the dynamic cover and refresh the body solver in one place. */
  private rebuildArcadeSolids(): void {
    const arcade = this.arcade;
    if (!arcade) return;
    const def = this.arena.tetris;
    if (this.arena.soda) {
      const sodas = this.arena.soda.stacks;
      const rects: Rect[] = [];
      for (let i = 0; i < sodas.length; i++) {
        const count = arcade.sodaCounts[i] ?? 0;
        if (count <= 0) continue;
        const step = sodas[i].h / sodas[i].cans;
        const y = sodas[i].y + (sodas[i].cans - count) * step;
        this.sodaRectScratch.x = sodas[i].x;
        this.sodaRectScratch.y = y;
        this.sodaRectScratch.w = sodas[i].w;
        this.sodaRectScratch.h = step * count;
        rects.push({ x: this.sodaRectScratch.x, y: this.sodaRectScratch.y, w: this.sodaRectScratch.w, h: this.sodaRectScratch.h });
      }
      this.arena.pillars = [...this.sodaStaticPillars, ...rects];
    } else if (def) {
      const rects: Rect[] = [];
      const cellW = def.well.w / def.cols;
      const cellH = def.well.h / def.rows;
      for (let y = 0; y < def.rows; y++) {
        for (let x = 0; x < def.cols; x++) {
          if (arcade.tetrisGrid[y * def.cols + x] === 0) continue;
          rects.push({ x: def.well.x + x * cellW, y: def.well.y + y * cellH, w: cellW, h: cellH });
        }
      }
      this.arena.pillars = [...this.tetrisStaticPillars, ...rects];
    } else {
      return;
    }
    this.baseSolids = [...this.arena.pillars];
    this.baseDashSolids = [...this.arena.pillars];
    this.rebuildSolids();
    this.pushPlayersOutOfArcade();
  }

  private pushPlayersOutOfArcade(): void {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive) continue;
      const radius = PLAYER.radius * p.shrink;
      for (let s = 0; s < this.solids.length; s++) {
        if (!circleRect(p.x, p.y, radius, this.solids[s], hitScratch)) continue;
        p.x = hitScratch.px;
        p.y = hitScratch.py;
        p.vx = 0;
        p.vy = 0;
      }
    }
  }

  private resetPong(): void {
    const pong = this.pong;
    if (!pong) return;
    const cx = pong.court.x + pong.court.w * 0.5;
    const cy = pong.court.y + pong.court.h * 0.5;
    this.pongBallX = cx;
    this.pongBallY = cy;
    this.pongBallVx = 0;
    this.pongBallVy = 0;
    this.pongBallActive = false;
    this.pongLeftY = cy;
    this.pongRightY = cy;
    this.pongScoreLeft = 0;
    this.pongScoreRight = 0;
    this.pongServeT = pong.serveDelay;
    this.pongScoreFlash = 0;
    this.pongScoreSide = 0;
    this.pongHitFlash = 0;
    this.pongServeIndex = 0;
  }

  /** Put a new ball into play. Serves alternate sides and tilt so the rally can move. */
  private servePong(): void {
    const pong = this.pong;
    if (!pong) return;
    const direction = (this.pongServeIndex & 1) === 0 ? 1 : -1;
    const tilt = this.pongServeIndex % 4 < 2 ? 0.52 : -0.52;
    this.pongBallX = pong.court.x + pong.court.w * 0.5;
    this.pongBallY = pong.court.y + pong.court.h * 0.5;
    this.pongBallVx = Math.cos(tilt) * pong.speed * direction;
    this.pongBallVy = Math.sin(tilt) * pong.speed;
    this.pongBallActive = true;
    this.pongServeT = 0;
    this.pongHitFlash = 0;
    this.pongServeIndex++;
  }

  /**
   * One PONG rally tick. The ball is a local hazard: paddles return it, walls bounce
   * it, and a body caught on the line takes one hit and becomes a return surface.
   */
  private tickPong(dt: number): void {
    const pong = this.pong;
    if (!pong) return;
    if (this.pongScoreFlash > 0) this.pongScoreFlash = Math.max(0, this.pongScoreFlash - dt);
    if (this.pongHitFlash > 0) this.pongHitFlash = Math.max(0, this.pongHitFlash - dt);
    if (!this.pongBallActive) {
      this.pongServeT -= dt;
      if (this.pongServeT <= 0) this.servePong();
      return;
    }

    const court = pong.court;
    const r = pong.ballRadius;
    const paddleStep = pong.paddleSpeed * dt;
    const minPaddleY = court.y + pong.paddleH * 0.5 + 10;
    const maxPaddleY = court.y + court.h - pong.paddleH * 0.5 - 10;
    const targetY = Math.max(minPaddleY, Math.min(maxPaddleY, this.pongBallY));
    const leftDelta = targetY - this.pongLeftY;
    const rightDelta = targetY - this.pongRightY;
    this.pongLeftY += Math.max(-paddleStep, Math.min(paddleStep, leftDelta));
    this.pongRightY += Math.max(-paddleStep, Math.min(paddleStep, rightDelta));

    this.pongBallX += this.pongBallVx * dt;
    this.pongBallY += this.pongBallVy * dt;
    if (this.pongBallY - r < court.y) {
      this.pongBallY = court.y + r;
      this.pongBallVy = Math.abs(this.pongBallVy);
      this.pongHitFlash = 0.16;
    } else if (this.pongBallY + r > court.y + court.h) {
      this.pongBallY = court.y + court.h - r;
      this.pongBallVy = -Math.abs(this.pongBallVy);
      this.pongHitFlash = 0.16;
    }

    const leftX = court.x + pong.paddleInset;
    const rightX = court.x + court.w - pong.paddleInset;
    const leftFace = leftX + pong.paddleW * 0.5 + r;
    const rightFace = rightX - pong.paddleW * 0.5 - r;
    let returned = false;
    if (
      this.pongBallVx < 0 &&
      this.pongBallX <= leftFace &&
      this.pongBallX >= court.x &&
      Math.abs(this.pongBallY - this.pongLeftY) <= pong.paddleH * 0.5 + r
    ) {
      this.pongBallX = leftFace;
      const relative = Math.max(-1, Math.min(1, (this.pongBallY - this.pongLeftY) / (pong.paddleH * 0.5)));
      const angle = relative * pong.bounceAngle;
      const speed = Math.min(pong.maxSpeed, Math.hypot(this.pongBallVx, this.pongBallVy) * 1.045);
      this.pongBallVx = Math.cos(angle) * speed;
      this.pongBallVy = Math.sin(angle) * speed;
      this.pongHitFlash = 0.22;
      this.emit(EV.BOUNCE, -1, this.pongBallX, this.pongBallY, 0);
      returned = true;
    } else if (
      this.pongBallVx > 0 &&
      this.pongBallX >= rightFace &&
      this.pongBallX <= court.x + court.w &&
      Math.abs(this.pongBallY - this.pongRightY) <= pong.paddleH * 0.5 + r
    ) {
      this.pongBallX = rightFace;
      const relative = Math.max(-1, Math.min(1, (this.pongBallY - this.pongRightY) / (pong.paddleH * 0.5)));
      const angle = relative * pong.bounceAngle;
      const speed = Math.min(pong.maxSpeed, Math.hypot(this.pongBallVx, this.pongBallVy) * 1.045);
      this.pongBallVx = -Math.cos(angle) * speed;
      this.pongBallVy = Math.sin(angle) * speed;
      this.pongHitFlash = 0.22;
      this.emit(EV.BOUNCE, -1, this.pongBallX, this.pongBallY, 0);
      returned = true;
    }

    this.pongHitBodies();
    if (returned) return;

    if (this.pongBallX + r < court.x) {
      this.pongScoreRight++;
      this.pongScoreSide = 1;
      this.pongScoreFlash = 1.1;
      this.pongBallActive = false;
      this.pongServeT = pong.serveDelay;
      this.pongBallX = court.x + court.w * 0.5;
      this.pongBallY = court.y + court.h * 0.5;
    } else if (this.pongBallX - r > court.x + court.w) {
      this.pongScoreLeft++;
      this.pongScoreSide = 0;
      this.pongScoreFlash = 1.1;
      this.pongBallActive = false;
      this.pongServeT = pong.serveDelay;
      this.pongBallX = court.x + court.w * 0.5;
      this.pongBallY = court.y + court.h * 0.5;
    }
  }

  /** Resolve the ball against every live body. A hit reflects and marks the return normal. */
  private pongHitBodies(): void {
    const pong = this.pong;
    if (!pong) return;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.dashT > 0 || phased(p) || p.iframes > 0) continue;
      if (!this.pongBounceOff(p.x, p.y, PLAYER.radius * p.shrink)) continue;
      this.damagePlayer(p, pong.damage, -1, this.pongHitNx, this.pongHitNy, pong.knockback, SRC.PONG, -1);
    }
    if (this.mode === 'training' && this.drone.active && this.pongBounceOff(this.drone.x, this.drone.y, this.drone.radius)) {
      this.damageDrone(pong.enemyDamage, -1);
    }
    if (this.mode !== 'gauntlet') return;

    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      let hit = this.pongBounceOff(w.x, w.y, w.hitR);
      for (let s = 0; s < w.segCount && !hit; s++) {
        hit = this.pongBounceOff(w.segX[s], w.segY[s], w.segR);
      }
      if (hit) this.damageWorm(w, pong.enemyDamage, -1, this.pongHitNx, this.pongHitNy);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      if (!this.pongBounceOff(v.x, v.y, v.radius)) continue;
      this.damageVirus(v, pong.enemyDamage, -1, this.pongHitNx, this.pongHitNy, pong.knockback);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      if (!this.pongBounceOff(s.x, s.y, s.radius)) continue;
      this.damageSentry(s, pong.enemyDamage, -1, this.pongHitNx, this.pongHitNy, pong.knockback);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      if (!this.pongBounceOff(e.x, e.y, CASCADING_ERROR.blockSize * 0.5)) continue;
      this.damageError(e, pong.enemyDamage, -1, this.pongHitNx, this.pongHitNy);
    }
  }

  /** Reflect the ball off a circular body and remember the outward normal for knockback. */
  private pongBounceOff(x: number, y: number, radius: number): boolean {
    const pong = this.pong;
    if (!pong) return false;
    const min = pong.ballRadius + radius;
    const dx = this.pongBallX - x;
    const dy = this.pongBallY - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > min * min) return false;
    const d = Math.sqrt(d2);
    const nx = d > 0.001 ? dx / d : this.pongBallVx >= 0 ? 1 : -1;
    const ny = d > 0.001 ? dy / d : this.pongBallVy >= 0 ? 1 : -1;
    this.pongHitNx = nx;
    this.pongHitNy = ny;
    this.pongBallX = x + nx * min;
    this.pongBallY = y + ny * min;
    const dot = this.pongBallVx * nx + this.pongBallVy * ny;
    if (dot < 0) {
      this.pongBallVx -= 2 * dot * nx;
      this.pongBallVy -= 2 * dot * ny;
    }
    this.pongHitFlash = 0.22;
    return true;
  }

  /** Reset the airport board to its opening warning frame. */
  private resetFlip(): void {
    if (!this.flip) return;
    this.flipT = 0;
    this.refreshFlipStates();
    this.flipPrevStates.set(this.flipStates);
  }

  private refreshFlipStates(): void {
    const flip = this.flip;
    if (!flip) return;
    for (let i = 0; i < flip.rows.length; i++) {
      this.flipStates[i] = flipRowStateAt(flip, i, this.flipT);
    }
  }

  /** Advance the board and resolve each row on the frame its flap lands. */
  private tickFlip(dt: number): void {
    const flip = this.flip;
    if (!flip) return;
    this.flipPrevStates.set(this.flipStates);
    this.flipT += dt;
    for (let i = 0; i < flip.rows.length; i++) {
      const next = flipRowStateAt(flip, i, this.flipT);
      this.flipStates[i] = next;
      if (next === FLIP_STATE.flap && this.flipPrevStates[i] !== FLIP_STATE.flap) this.slamFlipRow(i);
    }
  }

  /** A row lands: every text cell in the bank flips, so the whole band is the hazard. */
  private slamFlipRow(row: number): void {
    const flip = this.flip;
    if (!flip) return;
    const cell = flipRowRectAt(flip, row, this.flipCellScratch);
    const cx = cell.x + cell.w * 0.5;
    const cy = cell.y + cell.h * 0.5;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.dashT > 0 || phased(p)) continue;
      if (!circleRect(p.x, p.y, PLAYER.radius * p.shrink, cell, hitScratch)) continue;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      this.damagePlayer(p, flip.damage, -1, dx / d, dy / d, flip.knockback, SRC.FLIP, row);
    }
    if (this.mode === 'training' && this.drone.active) {
      if (circleRect(this.drone.x, this.drone.y, this.drone.radius, cell, hitScratch)) {
        this.damageDrone(flip.enemyDamage, -1);
      }
    }
    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      let hit = circleRect(w.x, w.y, w.hitR, cell, hitScratch);
      for (let s = 0; s < w.segCount && !hit; s++) {
        hit = circleRect(w.segX[s], w.segY[s], w.segR, cell, hitScratch);
      }
      if (hit) this.damageWorm(w, flip.enemyDamage, -1, 0, -1);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || !circleRect(v.x, v.y, v.radius, cell, hitScratch)) continue;
      this.damageVirus(v, flip.enemyDamage, -1, 0, -1);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active || !circleRect(s.x, s.y, s.radius, cell, hitScratch)) continue;
      this.damageSentry(s, flip.enemyDamage, -1, 0, -1);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active || !circleRect(e.x, e.y, CASCADING_ERROR.blockSize * 0.5, cell, hitScratch)) continue;
      this.damageError(e, flip.enemyDamage, -1, 0, -1);
    }
  }

  /** Reset the simulated cannon and clear its local shots. */
  private resetInvaders(): void {
    const inv = this.invaders;
    if (!inv) return;
    this.invaderT = 0;
    this.invaderCannonX = inv.cannon.x;
    this.invaderFireT = 1.2;
    this.invaderAimT = 0;
    this.invaderCannonFlash = 0;
    for (let i = 0; i < this.invaderShots.length; i++) this.invaderShots[i].active = false;
  }

  /** Choose the nearest horizontal body, so the simulated player sweeps the fleet. */
  private invaderTargetX(): number {
    const inv = this.invaders;
    if (!inv) return this.centerX;
    let bestX = this.centerX;
    let bestD = Infinity;
    const consider = (x: number): void => {
      const d = Math.abs(x - this.invaderCannonX);
      if (d < bestD) {
        bestD = d;
        bestX = x;
      }
    };
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.active && p.alive) consider(p.x);
    }
    if (this.mode === 'training' && this.drone.active) consider(this.drone.x);
    if (this.mode === 'gauntlet') {
      for (let i = 0; i < this.worms.length; i++) if (this.worms[i].active) consider(this.worms[i].x);
      for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) consider(this.viruses[i].x);
      for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) consider(this.sentries[i].x);
      for (let i = 0; i < this.errors.length; i++) if (this.errors[i].active) consider(this.errors[i].x);
    }
    return bestX;
  }

  /** Move the cannon, fire when aligned, and resolve its upward shots. */
  private tickInvaders(dt: number): void {
    const inv = this.invaders;
    if (!inv) return;
    this.invaderT += dt;
    if (this.invaderCannonFlash > 0) this.invaderCannonFlash = Math.max(0, this.invaderCannonFlash - dt);
    if (this.invaderAimT > 0) this.invaderAimT = Math.max(0, this.invaderAimT - dt);
    const targetX = this.invaderTargetX();
    const left = this.arena.bounds.left + inv.cannon.w * 0.5 + 18;
    const right = this.arena.bounds.right - inv.cannon.w * 0.5 - 18;
    const step = inv.cannon.speed * dt;
    const delta = Math.max(-step, Math.min(step, targetX - this.invaderCannonX));
    this.invaderCannonX = Math.max(left, Math.min(right, this.invaderCannonX + delta));
    this.invaderFireT = Math.max(0, this.invaderFireT - dt);
    const aligned = Math.abs(this.invaderCannonX - targetX) < 58;
    if (aligned && this.invaderFireT <= 0) {
      this.fireInvaderShot();
      this.invaderFireT = inv.fireEvery;
      this.invaderAimT = 0;
    } else if (aligned) {
      this.invaderAimT = Math.max(this.invaderAimT, Math.max(0, inv.telegraph - this.invaderFireT));
    }
    this.updateInvaderShots(dt);
  }

  private fireInvaderShot(): void {
    const inv = this.invaders;
    if (!inv) return;
    for (let i = 0; i < this.invaderShots.length; i++) {
      const shot = this.invaderShots[i];
      if (shot.active) continue;
      shot.active = true;
      shot.x = this.invaderCannonX;
      shot.y = inv.cannon.y - inv.cannon.h * 0.5;
      shot.vy = -inv.shotSpeed;
      this.invaderCannonFlash = 0.14;
      return;
    }
  }

  /** Circle-circle test for the local cannon shot. Bodies have no w/h rect. */
  private invaderShotHitsBody(shot: InvaderShot, x: number, y: number, radius: number): boolean {
    const inv = this.invaders;
    if (!inv) return false;
    const reach = inv.shotRadius + radius;
    const dx = shot.x - x;
    const dy = shot.y - y;
    return dx * dx + dy * dy <= reach * reach;
  }

  private updateInvaderShots(dt: number): void {
    const inv = this.invaders;
    if (!inv) return;
    for (let i = 0; i < this.invaderShots.length; i++) {
      const shot = this.invaderShots[i];
      if (!shot.active) continue;
      shot.y += shot.vy * dt;
      if (shot.y < this.arena.bounds.top) {
        shot.active = false;
        continue;
      }
      let blocked = false;
      for (let j = 0; j < this.arena.pillars.length; j++) {
        if (circleRect(shot.x, shot.y, inv.shotRadius, this.arena.pillars[j], hitScratch)) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        shot.active = false;
        this.emit(EV.BOUNCE, -1, shot.x, shot.y, 1);
        continue;
      }
      let hit = false;
      for (let j = 0; j < this.players.length; j++) {
        const p = this.players[j];
        if (!p.active || !p.alive || p.dashT > 0 || phased(p)) continue;
        if (!this.invaderShotHitsBody(shot, p.x, p.y, PLAYER.radius * p.shrink)) continue;
        this.damagePlayer(p, inv.damage, -1, 0, -1, inv.knockback, SRC.ARCADE, -1);
        shot.active = false;
        hit = true;
        break;
      }
      if (hit) continue;
      if (this.mode === 'training' && this.drone.active) {
        if (this.invaderShotHitsBody(shot, this.drone.x, this.drone.y, this.drone.radius)) {
          this.damageDrone(inv.enemyDamage, -1);
          shot.active = false;
          continue;
        }
      }
      if (this.mode !== 'gauntlet') continue;
      for (let j = 0; j < this.worms.length && !hit; j++) {
        const w = this.worms[j];
        if (!w.active) continue;
        let touched = this.invaderShotHitsBody(shot, w.x, w.y, w.hitR);
        for (let s = 0; s < w.segCount && !touched; s++) {
          touched = this.invaderShotHitsBody(shot, w.segX[s], w.segY[s], w.segR);
        }
        if (!touched) continue;
        this.damageWorm(w, inv.enemyDamage, -1, 0, -1);
        shot.active = false;
        hit = true;
      }
      if (hit) continue;
      for (let j = 0; j < this.viruses.length; j++) {
        const v = this.viruses[j];
        if (!v.active || !this.invaderShotHitsBody(shot, v.x, v.y, v.radius)) continue;
        this.damageVirus(v, inv.enemyDamage, -1, 0, -1);
        shot.active = false;
        hit = true;
        break;
      }
      if (hit) continue;
      for (let j = 0; j < this.sentries.length; j++) {
        const s = this.sentries[j];
        if (!s.active || !this.invaderShotHitsBody(shot, s.x, s.y, s.radius)) continue;
        this.damageSentry(s, inv.enemyDamage, -1, 0, -1);
        shot.active = false;
        hit = true;
        break;
      }
      if (hit) continue;
      for (let j = 0; j < this.errors.length; j++) {
        const e = this.errors[j];
        if (!e.active || !this.invaderShotHitsBody(shot, e.x, e.y, CASCADING_ERROR.blockSize * 0.5)) continue;
        this.damageError(e, inv.enemyDamage, -1, 0, -1);
        shot.active = false;
        break;
      }
    }
  }

  /** Advance the launch and rebuild the collision blocks that approximate the arc. */
  private tickRocket(dt: number): void {
    const rocket = this.rocket;
    if (!rocket) return;
    this.rocketT += dt;
    this.rocketProgress = rocketProgressAt(rocket, this.rocketT);
    this.refreshRocketBarrier();
  }

  /**
   * The rendered dotted line and the shot reflector share one progress value. The blocks
   * are only read by projectiles; inactive blocks are zeroed, allocation-free.
   */
  private refreshRocketBarrier(): void {
    const rocket = this.rocket;
    if (!rocket) return;
    const active = Math.ceil(this.rocketProgress * rocket.segments);
    const half = rocket.thickness * 0.5;
    for (let i = 0; i < this.rocketBarrierRects.length; i++) {
      const rect = this.rocketBarrierRects[i];
      if (i >= active) {
        rect.x = 0;
        rect.y = 0;
        rect.w = 0;
        rect.h = 0;
        continue;
      }
      rocketArcAt(rocket, (i + 1) / rocket.segments, this.rocketScratch);
      rect.x = this.rocketScratch.x - half;
      rect.y = this.rocketScratch.y - half;
      rect.w = rocket.thickness;
      rect.h = rocket.thickness;
    }
  }

  /** Advance solar heat, the telescope, the shower and the reentry one step. */
  private tickSatellite(dt: number): void {
    const sat = this.satellite;
    if (!sat) return;
    this.satelliteT += dt;
    this.updateSatelliteTelescope();
    this.updateSatelliteMeteors(dt);
    if (this.satelliteState <= 1) this.updateSatelliteSolar(dt);

    if (this.satelliteState === 0) {
      this.satelliteMeteorT -= dt;
      if (this.satelliteMeteorT <= 0) {
        this.startSatelliteShower();
        this.satelliteMeteorT = sat.meteors.interval;
      }
      let liveCaps = 0;
      for (let i = 0; i < this.satelliteCapsules.length; i++) {
        if (this.satelliteCapsules[i].active) liveCaps++;
      }
      if (this.satelliteCapsules.length > 0 && liveCaps === 0) {
        this.satelliteState = 1;
        this.satelliteThrusterT = sat.reentry.fuse;
        this.emit(EV.EXPLODE, -1, this.centerX, this.arena.bounds.bottom - 80, 180);
      }
    } else if (this.satelliteState === 1) {
      this.satelliteThrusterT -= dt;
      if (this.satelliteThrusterT <= 0) {
        this.satelliteState = 2;
        this.satelliteReentryT = 0;
        this.satelliteHeatY = this.arena.bounds.bottom;
        this.satelliteBurnTickT = 0;
      }
    } else if (this.satelliteState === 2) {
      this.satelliteReentryT += dt;
      const rise = Math.max(0.001, sat.reentry.rise);
      const k = Math.min(1, this.satelliteReentryT / rise);
      this.satelliteHeatY = this.arena.bounds.bottom - (this.arena.bounds.bottom - this.arena.bounds.top) * k;
      this.satelliteBurnTickT -= dt;
      if (this.satelliteBurnTickT <= 0) {
        this.satelliteBurnTickT = sat.reentry.tick;
        this.damageSatelliteBelow(this.satelliteHeatY, sat.reentry.damage);
      }
      // Hold the front on the top lip until every live body has been burned. The
      // short hold lets an iframe tick expire and also guarantees a reset if a
      // training respawn lands under the front.
      if (k >= 1 && (this.satelliteAllDead() || this.satelliteReentryT >= rise + sat.reentry.hold)) {
        this.satelliteState = 3;
        this.satelliteResetT = sat.reentry.reset;
      }
    } else if (this.satelliteState === 3) {
      this.satelliteResetT -= dt;
      if (this.satelliteResetT <= 0) this.resetSatellite();
    }
  }

  /** Grow/retract the bottom mast and lift a body the rising barrel catches. */
  private updateSatelliteTelescope(): void {
    const sat = this.satellite;
    if (!sat) return;
    const prev = this.satelliteTelescopePrev;
    satelliteTelescopeRectAt(sat, this.satelliteT, this.satelliteTelescopeRect);
    const r = this.satelliteTelescopeRect;
    if (r.h > prev + 0.01) {
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        if (!p.active || !p.alive || p.travelT > 0 || p.fallT > 0) continue;
        this.liftOutOfRect(p, PLAYER.radius * p.shrink, r);
      }
      if (this.drone.active) this.liftOutOfRect(this.drone, this.drone.radius, r);
    }
    this.satelliteTelescopePrev = r.h;
  }

  private liftOutOfRect(body: { x: number; y: number }, radius: number, r: Rect): void {
    if (body.x + radius < r.x || body.x - radius > r.x + r.w || body.y + radius < r.y || body.y - radius > r.y + r.h) return;
    body.y = r.y - radius;
  }

  /** A body inside one hot wing takes the shared solar tick. */
  private updateSatelliteSolar(dt: number): void {
    const sat = this.satellite;
    if (!sat) return;
    this.satelliteSolarTickT -= dt;
    if (this.satelliteSolarTickT > 0) return;
    let hot = false;
    for (let i = 0; i < sat.panels.length; i++) {
      const panel = sat.panels[i];
      if (satelliteSolarStateAt(sat, panel, this.satelliteT) !== SATELLITE_SOLAR_STATE.hot) continue;
      hot = true;
      this.damageSatelliteRect(panel, sat.solar.damage);
    }
    if (hot) this.satelliteSolarTickT = sat.solar.tick;
  }

  private startSatelliteShower(): void {
    const sat = this.satellite;
    if (!sat) return;
    let launched = 0;
    for (let i = 0; i < this.satelliteMeteors.length && launched < sat.meteors.count; i++) {
      const m = this.satelliteMeteors[i];
      if (m.active) continue;
      const floor = sat.floor[Math.floor(this.rng.range(0, sat.floor.length)) % sat.floor.length];
      m.active = true;
      m.x = floor.x + 24 + this.rng.range(0, Math.max(1, floor.w - 48));
      m.y = floor.y + 24 + this.rng.range(0, Math.max(1, floor.h - 48));
      m.t = 0;
      m.hit = false;
      launched++;
    }
  }

  private updateSatelliteMeteors(dt: number): void {
    const sat = this.satellite;
    if (!sat) return;
    for (let i = 0; i < this.satelliteMeteors.length; i++) {
      const m = this.satelliteMeteors[i];
      if (!m.active) continue;
      m.t += dt;
      if (!m.hit && m.t >= sat.meteors.warn) {
        m.hit = true;
        this.damageSatelliteCircle(m.x, m.y, sat.meteors.radius, sat.meteors.damage);
        this.emit(EV.EXPLODE, -1, m.x, m.y, sat.meteors.radius * 2);
      }
      if (m.t >= sat.meteors.warn + sat.meteors.impact) m.active = false;
    }
  }

  private damageSatelliteRect(rect: Rect, damage: number): void {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive) continue;
      if (p.x < rect.x || p.x > rect.x + rect.w || p.y < rect.y || p.y > rect.y + rect.h) continue;
      this.damagePlayer(p, damage, -1, 0, 0, 0, SRC.NONE, -1);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || w.held) continue;
      if (w.x < rect.x || w.x > rect.x + rect.w || w.y < rect.y || w.y > rect.y + rect.h) continue;
      this.damageWorm(w, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || v.held) continue;
      if (v.x < rect.x || v.x > rect.x + rect.w || v.y < rect.y || v.y > rect.y + rect.h) continue;
      this.damageVirus(v, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      if (s.x < rect.x || s.x > rect.x + rect.w || s.y < rect.y || s.y > rect.y + rect.h) continue;
      this.damageSentry(s, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      if (e.x < rect.x || e.x > rect.x + rect.w || e.y < rect.y || e.y > rect.y + rect.h) continue;
      this.damageError(e, damage, -1, 0, 0);
    }
    if (this.drone.active && this.drone.x >= rect.x && this.drone.x <= rect.x + rect.w && this.drone.y >= rect.y && this.drone.y <= rect.y + rect.h) {
      this.damageDrone(damage, -1);
    }
  }

  private damageSatelliteCircle(x: number, y: number, radius: number, damage: number): void {
    const r2 = radius * radius;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive) continue;
      const rr = radius + PLAYER.radius * p.shrink;
      if ((p.x - x) ** 2 + (p.y - y) ** 2 <= rr * rr) this.damagePlayer(p, damage, -1, 0, 0, 0, SRC.NONE, -1);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || w.held) continue;
      const rr = radius + w.segR;
      if ((w.x - x) ** 2 + (w.y - y) ** 2 <= rr * rr) this.damageWorm(w, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || v.held) continue;
      const rr = radius + v.radius;
      if ((v.x - x) ** 2 + (v.y - y) ** 2 <= rr * rr) this.damageVirus(v, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const rr = radius + s.radius;
      if ((s.x - x) ** 2 + (s.y - y) ** 2 <= rr * rr) this.damageSentry(s, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const rr = radius + CASCADING_ERROR.blockSize * 0.5;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 <= rr * rr) this.damageError(e, damage, -1, 0, 0);
    }
    if (this.drone.active) {
      const rr = radius + this.drone.radius;
      if ((this.drone.x - x) ** 2 + (this.drone.y - y) ** 2 <= rr * rr) this.damageDrone(damage, -1);
    }
  }

  /** The reentry line burns bodies at or below its current height. */
  private damageSatelliteBelow(y: number, damage: number): void {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.active && p.alive && p.y >= y) this.damagePlayer(p, damage, -1, 0, 0, 0, SRC.NONE, -1);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (w.active && !w.held && w.y >= y) this.damageWorm(w, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (v.active && !v.held && v.y >= y) this.damageVirus(v, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active && s.y >= y) this.damageSentry(s, damage, -1, 0, 0, 0);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (e.active && e.y >= y) this.damageError(e, damage, -1, 0, 0);
    }
    if (this.drone.active && this.drone.y >= y) this.damageDrone(damage, -1);
  }

  private satelliteAllDead(): boolean {
    for (let i = 0; i < this.players.length; i++) if (this.players[i].active && this.players[i].alive) return false;
    for (let i = 0; i < this.worms.length; i++) if (this.worms[i].active) return false;
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) return false;
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) return false;
    for (let i = 0; i < this.errors.length; i++) if (this.errors[i].active) return false;
    return !this.drone.active;
  }

  /**
   * Open-wall arenas: the lip is the edge of the floor. A body whose centre crosses it
   * is gone, so a shove that carries someone over the line is a kill, not a nudge.
   */
  private checkFall(p: Player): void {
    const b = this.arena.bounds;
    // A disc's lip is its rim, not the square camera bounds. Either one starts the hang.
    let pastLip = p.x < b.left || p.x > b.right || p.y < b.top || p.y > b.bottom;
    const disc = this.arena.disc;
    if (!pastLip && disc) {
      const dx = p.x - this.centerX;
      const dy = p.y - this.centerY;
      pastLip = dx * dx + dy * dy > disc.radius * disc.radius;
    }
    // The hub's gaps are interior floor holes. A dash is airborne over them; a walk
    // that ends over one starts the ordinary hang-and-fall.
    if (!pastLip && this.usb && p.dashT <= 0 && !usbFloorAt(this.arena, p.x, p.y, this.usbT)) {
      pastLip = true;
    }
    if (!pastLip && this.satellite && p.dashT <= 0 && !satelliteFloorAt(this.arena, p.x, p.y)) {
      pastLip = true;
    }
    // A dash is airborne, so a short hole can be jumped. Land inside one and the fall
    // starts then, which is the point of a hole.
    if (!pastLip && (p.dashT > 0 || !this.inVoid(p.x, p.y))) return;
    if (p.fallT > 0) return;
    p.fallT = FALL.grace;
    p.vx = 0;
    p.vy = 0;
    p.kx = 0;
    p.ky = 0;
  }

  /** Off the plate: past the lip, outside a trapezoid slant, a disc rim, or a floor hole. */
  offFloor(x: number, y: number): boolean {
    const b = this.arena.bounds;
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) return true;
    const disc = this.arena.disc;
    if (disc) {
      const dx = x - this.centerX;
      const dy = y - this.centerY;
      if (dx * dx + dy * dy > disc.radius * disc.radius) return true;
    }
    if (this.usb && !usbFloorAt(this.arena, x, y, this.usbT)) return true;
    if (this.satellite && !satelliteFloorAt(this.arena, x, y)) return true;
    const slant = this.arena.slant;
    if (slant) {
      const k = (y - b.top) / (b.bottom - b.top);
      const inset = slant * (1 - Math.max(0, Math.min(1, k)));
      if (x < b.left + inset || x > b.right - inset) return true;
    }
    return this.inVoid(x, y);
  }

  private inVoid(x: number, y: number): boolean {
    const radar = this.arena.radar;
    if (radar) {
      const rdx = x - radar.cx;
      const rdy = y - radar.cy;
      return rdx * rdx + rdy * rdy > radar.radius * radar.radius;
    }
    if (this.voidAt(x, y) !== null) return true;
    const islands = this.arena.islands;
    if (!islands) return false;
    // A plate arena has no floor between the plates. Off a plate a body is falling, and
    // an authored deck is the only other footing. Decks are always walkable: a bridge is
    // floor, never a gate that a level has to open first.
    for (let i = 0; i < islands.length; i++) {
      const r = islands[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return false;
    }
    const bridges = this.arena.bridges;
    if (bridges) {
      for (let i = 0; i < bridges.length; i++) {
        const b = bridges[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return false;
      }
    }
    return true;
  }

  /** The hole under a point, or null. Returns an arena rect or the disc scratch. */
  private voidAt(x: number, y: number): Rect | null {
    const voids = this.arena.voids;
    if (voids) {
      for (let i = 0; i < voids.length; i++) {
        const r = voids[i];
        if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return r;
      }
    }
    const disc = this.arena.disc;
    if (disc) {
      for (let i = 0; i < disc.holes.length; i++) {
        const h = disc.holes[i];
        const hx = discHoleX(this.arena, i, this.discT);
        const hy = discHoleY(this.arena, i, this.discT);
        const dx = x - hx;
        const dy = y - hy;
        if (dx * dx + dy * dy >= h.radius * h.radius) continue;
        const s = this.discHoleScratch;
        s.x = hx - h.radius;
        s.y = hy - h.radius;
        s.w = h.radius * 2;
        s.h = h.radius * 2;
        return s;
      }
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
    // A party port is scenery: never a target, never takes a hit.
    if (b.portalExit) return;
    // A port disappears instead of shattering, and stops counting damage once dead.
    if (b.portal) {
      if (b.hp <= 0) return;
      b.hp -= amount;
      b.hitFlash = FILE_PROP.hitFlash;
      this.emit(EV.PROP_HIT, 0, x, y, amount);
      if (b.hp <= 0) this.closePort(b, x, y);
      return;
    }
    b.hp -= amount;
    b.hitFlash = FILE_PROP.hitFlash;
    this.emit(EV.PROP_HIT, 0, x, y, amount);
    if (b.hp > 0) return;
    b.active = false;
    b.hazard = false;
    this.emit(EV.PROP_BREAK, 0, b.x + b.w * 0.5, b.y + b.h * 0.5, b.w + b.h * 0.5);
  }

  /**
   * NETWORK SWITCH feed pipes. Each live pipe alternates a hostile file and a threat;
   * its intake also pulls loose files and small threats into the mouth. Destroying the
   * pipe stops that emitter and its intake for the rest of the run.
   */
  private updateNetwork(dt: number): void {
    this.tickPipeTransit(dt);
    for (let i = 0; i < this.pipes.length; i++) {
      const pipe = this.pipes[i];
      if (pipe.hitFlash > 0) pipe.hitFlash = Math.max(0, pipe.hitFlash - dt);
      if (pipe.catchFlash > 0) pipe.catchFlash = Math.max(0, pipe.catchFlash - dt);
      if (pipe.catchT > 0) pipe.catchT = Math.max(0, pipe.catchT - dt);
      if (!pipe.active) continue;
      pipe.fireT -= dt;
      if (pipe.fireT <= 0) {
        pipe.fireT = pipe.feed === 1 ? SPACE_CADET.pipeInterval : NETWORK.pipeInterval;
        this.firePipe(pipe);
      }
      this.catchAtPipe(pipe, dt, i);
    }
    this.updateFirewallSwitch(dt);
  }

  /**
   * A body caught by a feed mouth is carried out through the tube, off the floor, then
   * returned through a different mouth. The ride is presentation, but it also keeps the
   * body untouchable until it lands, so it cannot be shot inside the pipe.
   */
  private tickPipeTransit(dt: number): void {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.pipeTransitT <= 0) continue;
      p.pipeTransitT = Math.max(0, p.pipeTransitT - dt);
      p.iframes = Math.max(p.iframes, 0.12);
      p.vx = 0;
      p.vy = 0;
      p.kx = 0;
      p.ky = 0;
      const k = 1 - p.pipeTransitT / Math.max(0.001, p.pipeTransitDur);
      const from = this.pipes[p.pipeFromIndex];
      const to = this.pipes[p.pipeToIndex];
      if (k < 0.45) {
        const t = k / 0.45;
        const ax = from ? from.outX : p.pipeFromX;
        const ay = from ? from.outY : p.pipeFromY;
        p.x = p.pipeFromX + (ax - p.pipeFromX) * t;
        p.y = p.pipeFromY + (ay - p.pipeFromY) * t;
      } else {
        const t = (k - 0.45) / 0.55;
        const ax = to ? to.outX : p.pipeToX;
        const ay = to ? to.outY : p.pipeToY;
        p.x = ax + (p.pipeToX - ax) * t;
        p.y = ay + (p.pipeToY - ay) * t;
      }
      p.prevX = p.x;
      p.prevY = p.y;
      if (p.pipeTransitT > 0) continue;
      p.pipeTransitDur = 0;
      p.pipeFromIndex = -1;
      p.pipeToIndex = -1;
      p.pipeCooldown = NETWORK.playerTransitCooldown;
      p.iframes = Math.max(p.iframes, 0.45);
      this.emit(EV.RESPAWN, p.slot, p.x, p.y, 1);
    }
  }

  /** Pick another mouth and hand the player to the tube ride. */
  private catchPlayerAtPipe(pipe: Pipe, pipeIndex: number): boolean {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.travelT > 0 || p.pipeTransitT > 0 || p.pipeCooldown > 0) continue;
      const dx = p.x - pipe.x;
      const dy = p.y - pipe.y;
      if (dx * dx + dy * dy > (pipe.radius * 0.92) ** 2) continue;
      let exit = pipeIndex;
      let seen = 0;
      for (let n = 0; n < this.pipes.length; n++) {
        if (n === pipeIndex || !this.pipes[n].active) continue;
        seen++;
        if (this.rng.next() < 1 / seen) exit = n;
      }
      const target = this.pipes[exit];
      p.pipeTransitT = NETWORK.playerTransit;
      p.pipeTransitDur = NETWORK.playerTransit;
      p.pipeFromX = pipe.x;
      p.pipeFromY = pipe.y;
      p.pipeToX = target.x;
      p.pipeToY = target.y;
      p.pipeFromIndex = pipeIndex;
      p.pipeToIndex = exit;
      p.pipeCooldown = NETWORK.playerTransitCooldown + NETWORK.playerTransit;
      p.iframes = Math.max(p.iframes, NETWORK.playerTransit + 0.25);
      p.guardT = 0;
      p.chargeT = 0;
      p.swingPhase = 0;
      p.swingT = 0;
      p.swingPct = 0;
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      p.laserT = 0;
      pipe.catchFlash = 0.5;
      pipe.catchT = NETWORK.catchCooldown + NETWORK.playerTransit;
      this.emit(EV.PROP_BREAK, -1, pipe.x, pipe.y, pipe.radius * 1.5);
      return true;
    }
    return false;
  }

  private firePipe(pipe: Pipe): void {
    const dx = Math.cos(pipe.angle);
    const dy = Math.sin(pipe.angle);
    pipe.shots++;
    // The arcade feed is a four-beat loop: a file, a live ball, a virus, then a sentry.
    // It is still one pipe fixture; only the payload schedule changes.
    if (pipe.feed === 1) {
      const x = pipe.x + dx * 48;
      const y = pipe.y + dy * 48;
      if (pipe.shots % 4 === 1) {
        this.spawnPipeFile(pipe, dx, dy);
      } else if (pipe.shots % 4 === 2) {
        this.spawnPipeBall(pipe, dx, dy);
      } else if (pipe.shots % 4 === 3) {
        this.spawnVirus(x, y);
      } else if (!this.spawnSentry(0, x, y)) {
        this.spawnVirus(x, y);
      }
      pipe.catchT = 1.4;
      pipe.catchFlash = 0.3;
      return;
    }
    // The first beat is always a file; the next is an enemy. That makes the pipe's
    // job readable before the room gets busy.
    if (pipe.shots % 2 === 1) {
      this.spawnPipeFile(pipe, dx, dy);
    } else {
      const x = pipe.x + dx * 48;
      const y = pipe.y + dy * 48;
      let spawned = false;
      if (!this.infectionMode && this.wave >= 9 && pipe.shots % 6 === 0) {
        spawned = this.spawnSentry(0, x, y);
      }
      if (!spawned) this.spawnVirus(x, y);
    }
    pipe.catchT = 1.4;
    pipe.catchFlash = 0.3;
  }

  private spawnPipeFile(pipe: Pipe, dx: number, dy: number): void {
    let hazards = 0;
    let slot: Prop | null = null;
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (b.active && b.hazard) hazards++;
      if (!b.active && !slot) slot = b;
    }
    if (!slot || hazards >= NETWORK.maxFiles) return;
    const b = this.arena.bounds;
    const w = 38;
    const h = 27;
    slot.active = true;
    slot.kind = (pipe.shots + this.props.indexOf(slot)) % 4;
    slot.w = w;
    slot.h = h;
    slot.x = Math.max(b.left + 4, Math.min(b.right - w - 4, pipe.x + dx * 34 - w * 0.5));
    slot.y = Math.max(b.top + 4, Math.min(b.bottom - h - 4, pipe.y + dy * 34 - h * 0.5));
    slot.hp = 1;
    slot.hitFlash = 0;
    slot.dropT = 0;
    slot.vx = dx * NETWORK.fileSpeed;
    slot.vy = dy * NETWORK.fileSpeed;
    slot.tx = slot.vx;
    slot.ty = slot.vy;
    slot.hazard = true;
    slot.hurtCd = 0;
  }

  /** A live ball from the arcade feed. It belongs to the pipe, so it can hurt anyone. */
  private spawnPipeBall(pipe: Pipe, dx: number, dy: number): void {
    let proj: Projectile | null = null;
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) {
        proj = this.projectiles[i];
        break;
      }
    }
    if (!proj) return;
    const angle = pipe.angle + this.rng.range(-0.28, 0.28);
    const x = pipe.x + dx * 48;
    const y = pipe.y + dy * 48;
    proj.active = true;
    proj.serial = ++this.serial;
    proj.type = 14;
    proj.owner = -1;
    proj.srcKind = SRC.PIPE;
    proj.srcId = 0;
    proj.x = x;
    proj.y = y;
    proj.prevX = x;
    proj.prevY = y;
    proj.vx = Math.cos(angle) * SPACE_CADET.pipeBallSpeed;
    proj.vy = Math.sin(angle) * SPACE_CADET.pipeBallSpeed;
    proj.radius = SPACE_CADET.pipeBallRadius;
    proj.damage = SPACE_CADET.pipeBallDamage;
    proj.deflects = 0;
    proj.bounces = 0;
    proj.fuse = SPACE_CADET.pipeBallTtl;
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
    proj.blastRadius = 0;
    proj.blastKnockback = 0;
    proj.arcDur = 0;
    proj.hits = 0;
    proj.spin = this.rng.range(0, Math.PI * 2);
    proj.spinDir = 1;
    proj.variant = 0;
    proj.orbOwner = -1;
    proj.orbA = 0;
    proj.orbR = 0;
    proj.orbDir = 1;
    proj.trailHead = 0;
    proj.trailCount = 0;
  }

  private catchAtPipe(pipe: Pipe, dt: number, pipeIndex: number): void {
    if (pipe.catchT > 0) return;
    // A player is a body too. Send them out of a different mouth so the pipe is a
    // shortcut across the switchboard, not a pit that deletes the run.
    if (this.catchPlayerAtPipe(pipe, pipeIndex)) return;
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.active || b.dropT > 0) continue;
      const cx = b.x + b.w * 0.5;
      const cy = b.y + b.h * 0.5;
      let dx = pipe.x - cx;
      let dy = pipe.y - cy;
      const d = Math.hypot(dx, dy);
      if (d > NETWORK.catchRadius || d < 0.001) continue;
      dx /= d;
      dy /= d;
      b.tx = dx * NETWORK.catchPull;
      b.ty = dy * NETWORK.catchPull;
      if (d < pipe.radius * 0.85) {
        b.active = false;
        b.hazard = false;
        pipe.catchFlash = 0.42;
        pipe.catchT = NETWORK.catchCooldown;
        this.emit(EV.PROP_BREAK, 0, cx, cy, b.w + b.h);
      }
    }
    // The infection colony is the run's score, so pipes do not eat it. In a normal
    // gauntlet a small threat that wanders into a mouth is reclaimed without a kill.
    if (this.infectionMode) return;
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      let dx = pipe.x - v.x;
      let dy = pipe.y - v.y;
      const d = Math.hypot(dx, dy);
      if (d > NETWORK.catchRadius || d < 0.001) continue;
      dx /= d;
      dy /= d;
      v.x += dx * NETWORK.catchPull * dt;
      v.y += dy * NETWORK.catchPull * dt;
      if (d < pipe.radius * 0.8) {
        v.active = false;
        v.orbitOwner = -1;
        pipe.catchFlash = 0.42;
        pipe.catchT = NETWORK.catchCooldown;
        this.emit(EV.VIRUS_KILL, -1, v.x, v.y, v.radius * 4, dx, dy);
      }
    }
  }

  private updateFirewallSwitch(dt: number): void {
    const s = this.arena.firewallSwitch;
    if (!s || this.infectionMode) return;
    if (this.firewallSwitchT > 0) this.firewallSwitchT = Math.max(0, this.firewallSwitchT - dt);
    if (this.firewallSwitchFlash > 0) this.firewallSwitchFlash = Math.max(0, this.firewallSwitchFlash - dt);
    let onPad = false;
    if (this.firewallSwitchT <= 0) {
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        if (!p.active || !p.alive || p.travelT > 0) continue;
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        if (dx * dx + dy * dy <= (s.radius + PLAYER.radius * 0.5) ** 2) {
          onPad = true;
          break;
        }
      }
    }
    if (!onPad) {
      this.firewallSwitchDwell = 0;
      return;
    }
    this.firewallSwitchDwell += dt;
    if (this.firewallSwitchDwell < NETWORK.switchDwell) return;
    this.firewallSwitchDwell = 0;
    let activeFirewalls = 0;
    for (let i = 0; i < this.firewalls.length; i++) if (this.firewalls[i].active) activeFirewalls++;
    if (activeFirewalls > 0) return;
    // The switch is on the west wall; the sweep starts at the opposite wall so the
    // operator has the length of the room to read it and get clear.
    if (this.spawnFirewall(0, -1)) {
      this.firewallSwitchT = NETWORK.switchCooldown;
      this.firewallSwitchFlash = NETWORK.switchFlash;
    }
  }

  private damagePipe(pipe: Pipe, amount: number, x: number, y: number): void {
    if (!pipe.active) return;
    pipe.hp -= amount;
    pipe.hitFlash = 0.22;
    this.emit(EV.PROP_HIT, 0, x, y, amount);
    if (pipe.hp > 0) return;
    pipe.active = false;
    this.emit(EV.PROP_BREAK, 0, pipe.x, pipe.y, pipe.radius * 2.6);
  }

  /** Round posts and kickers. Shared body response; projectiles use `bounceBumpers`. */
  private bumpBody(
    body: { x: number; y: number; vx: number; vy: number; kx: number; ky: number },
    radius: number,
  ): void {
    const bumpers = this.arena.bumpers;
    if (!bumpers) return;
    for (let i = 0; i < bumpers.length; i++) {
      const b = bumpers[i];
      const dx = body.x - b.x;
      const dy = body.y - b.y;
      const min = b.radius + radius;
      if (dx * dx + dy * dy >= min * min) continue;
      const d = Math.hypot(dx, dy);
      // A body spawned exactly on the hub has no normal. Use its motion, or push up.
      let nx = 0;
      let ny = -1;
      if (d > 0.0001) {
        nx = dx / d;
        ny = dy / d;
      } else if (Math.hypot(body.vx, body.vy) > 0.0001) {
        const vd = Math.hypot(body.vx, body.vy);
        nx = -body.vx / vd;
        ny = -body.vy / vd;
      }
      body.x = b.x + nx * (min + 0.5);
      body.y = b.y + ny * (min + 0.5);
      if (b.kind === 1) {
        body.kx += nx * SPACE_CADET.bumperLaunch;
        body.ky += ny * SPACE_CADET.bumperLaunch;
      } else {
        const vn = body.vx * nx + body.vy * ny;
        if (vn < 0) {
          body.vx -= 2 * vn * nx;
          body.vy -= 2 * vn * ny;
        }
        body.kx += nx * SPACE_CADET.postPush;
        body.ky += ny * SPACE_CADET.postPush;
      }
      this.bumperFlash[i] = SPACE_CADET.bumperFlash;
    }
  }

  /** Apply the same round furniture to every local threat that can be shoved. */
  private bumpThreats(): void {
    if (!this.arena.bumpers) return;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (w.active) this.bumpBody(w, w.hitR);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (v.active) this.bumpBody(v, v.radius);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active) this.bumpBody(s, s.radius);
    }
  }

  /** Bumper hit for a shot. Posts deflect; kickers add speed. Committed shapes die. */
  private bounceBumpers(proj: Projectile): void {
    const bumpers = this.arena.bumpers;
    if (!bumpers) return;
    for (let i = 0; i < bumpers.length; i++) {
      const b = bumpers[i];
      const dx = proj.x - b.x;
      const dy = proj.y - b.y;
      const min = b.radius + proj.radius;
      if (dx * dx + dy * dy >= min * min) continue;
      if (
        proj.type === 5 ||
        proj.type === 6 ||
        proj.type === 8 ||
        proj.type === 9 ||
        proj.type === 10 ||
        proj.type === 12 ||
        proj.type === 17
      ) {
        proj.active = false;
        this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 1);
        return;
      }
      if (proj.owner < 0 && proj.type >= 3 && proj.type !== 14) {
        proj.active = false;
        this.emit(EV.SENTRY_HIT, -1, proj.x, proj.y, 0, -proj.vx, -proj.vy);
        return;
      }
      const d = Math.hypot(dx, dy);
      let nx = 0;
      let ny = -1;
      if (d > 0.0001) {
        nx = dx / d;
        ny = dy / d;
      } else if (Math.hypot(proj.vx, proj.vy) > 0.0001) {
        const vd = Math.hypot(proj.vx, proj.vy);
        nx = -proj.vx / vd;
        ny = -proj.vy / vd;
      }
      proj.x = b.x + nx * (min + 0.5);
      proj.y = b.y + ny * (min + 0.5);
      const vn = proj.vx * nx + proj.vy * ny;
      if (vn < 0) {
        proj.vx -= 2 * vn * nx;
        proj.vy -= 2 * vn * ny;
      }
      if (b.kind === 1) {
        const speed = Math.hypot(proj.vx, proj.vy);
        if (speed > 0.001) {
          const next = Math.min(SPACE_CADET.shotSpeedMax, speed * SPACE_CADET.bumperShotGain);
          proj.vx = (proj.vx / speed) * next;
          proj.vy = (proj.vy / speed) * next;
        }
      }
      this.bumperFlash[i] = SPACE_CADET.bumperFlash;
      this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 0);
      proj.armed = true;
      this.noteBounce(proj);
      return;
    }
  }

  /** Player shots stop on a live pipe and chip it; hostile fire passes over it. */
  private pipeHit(proj: Projectile): boolean {
    if (proj.owner < 0) return false;
    for (let i = 0; i < this.pipes.length; i++) {
      const pipe = this.pipes[i];
      if (!pipe.active) continue;
      const dx = proj.x - pipe.x;
      const dy = proj.y - pipe.y;
      const rr = pipe.radius + proj.radius;
      if (dx * dx + dy * dy > rr * rr) continue;
      this.damagePipe(pipe, Math.max(1, proj.damage), proj.x, proj.y);
      proj.active = false;
      return true;
    }
    return false;
  }

  /** Shots stop on a file box and chip it. Returns true when the projectile was spent. */
  private propHit(proj: Projectile): boolean {
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.active || b.dropT > 0) continue;
      if (!circleRect(proj.x, proj.y, proj.radius, b, hitScratch)) continue;
      // A mounted port is not debris: the shot stops on it instead of shoving it.
      if (!b.fixed) this.launchProp(b, proj.vx, proj.vy, FILE_PROP.shotPush);
      this.damageProp(b, Math.max(1, proj.damage), proj.x, proj.y);
      proj.active = false;
      return true;
    }
    return false;
  }

  /**
   * A guard or a fresh swing timed against an enemy dash is a parry. Perfect timing
   * stuns the attacker; a late block still shoves both bodies apart but deals no damage
   * and stuns nobody. This is checked before health, so a parry can never chip a segment.
   */
  private tryParryDash(
    p: Player,
    sourceKind: number,
    sourceId: number,
    dirX: number,
    dirY: number,
    force: number,
  ): boolean {
    let target: Worm | Sentry | null = null;
    let active = false;
    if (sourceKind === SRC.WORM && sourceId >= 0) {
      const w = this.worms[sourceId];
      if (w && w.active && w.dashT > 0) {
        const elapsed = WORM.dashWindup + WORM.dashActive + WORM.dashRecovery - w.dashT;
        active = elapsed >= WORM.dashWindup && elapsed < WORM.dashWindup + WORM.dashActive;
        target = w;
      }
    } else if (sourceKind === SRC.SENTRY && sourceId >= 0) {
      const s = this.sentries[sourceId];
      if (s && s.active && s.ramT > 0) {
        const total = SENTRY.ram.windup + SENTRY.ram.active + SENTRY.ram.recovery;
        const elapsed = total - s.ramT;
        active = elapsed >= SENTRY.ram.windup && elapsed < SENTRY.ram.windup + SENTRY.ram.active;
        target = s;
      }
    }
    if (!active || !target) return false;
    const facingAttacker = -(Math.cos(p.facing) * dirX + Math.sin(p.facing) * dirY);
    const perfect = p.parryT > 0 && facingAttacker > 0.05;
    // A held guard or an active lash counts as the late block. The parry window is the
    // only way to earn the stun; a late block still avoids the hit and separates both.
    const blocking = perfect || p.guardT > 0 || p.swingPhase === 1;
    if (!blocking) return false;
    p.parryT = 0;
    if (perfect) {
      target.stunT = PLAYER.parryStun;
      target.kx -= dirX * PLAYER.parryKnockback;
      target.ky -= dirY * PLAYER.parryKnockback;
      if (sourceKind === SRC.WORM) (target as Worm).dashT = 0;
      p.iframes = Math.max(p.iframes, 0.22);
      this.emit(EV.DEFLECT, p.slot, p.x, p.y, 3, -dirX, -dirY);
    } else {
      p.kx += dirX * force * 0.55;
      p.ky += dirY * force * 0.55;
      target.kx -= dirX * force * 0.35;
      target.ky -= dirY * force * 0.35;
      p.iframes = Math.max(p.iframes, 0.12);
      this.emit(EV.DEFLECT, p.slot, p.x, p.y, 1, -dirX, -dirY);
    }
    return true;
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
    amount = this.memoryDamage(sourceSlot, amount);
    if (!p.alive || p.iframes > 0 || phased(p) || p.travelT > 0) return;
    // Campaign companions are allies. Their own fire passes through the party unless
    // that specific companion has been turned, and it never damages another bot.
    if (this.campaign && sourceSlot > 0 && p.slot !== sourceSlot) {
      if (p.slot > 0 || !this.campaignAllyHostile(sourceSlot)) return;
    }
    if (this.tryParryDash(p, sourceKind, sourceId, dirX, dirY, force)) return;
    // Atomize spends one shield ball per real hit, before health or campaign damage is
    // recorded. A chip tick (venom) is not a hit, and the floor is never shielded.
    if (p.atomBalls > 0 && amount >= 1 && sourceKind !== SRC.VOID) {
      p.atomBalls--;
      p.atomFlashT = ATOMIZE.ballBlockFlash;
      p.kx += dirX * force * 0.25;
      p.ky += dirY * force * 0.25;
      this.deflectTelemetry.atom[p.slot]++;
      this.emit(EV.DEFLECT, p.slot, p.x, p.y, 2);
      return;
    }
    if (this.campaign && p.slot === this.localSlot) this.campaignDamage += amount;
    // The death camera reads this: who last touched the body, by family and pool index.
    p.killerKind = sourceKind;
    p.killerId = sourceId >= 0 ? sourceId : sourceSlot;
    p.hp -= amount;
    // Companion intent: the player must damage this bot while locked on it. A stray
    // shot, splash or lock on a different body does not turn an ally.
    if (this.campaign && p.slot > 0 && amount > 0 && sourceSlot >= 0 && sourceSlot < this.players.length) {
      const attacker = this.players[sourceSlot];
      const lockedOn =
        !!attacker &&
        ((attacker.lockActive && attacker.lockKind === 1 && attacker.lockId === p.slot) ||
          (attacker.lockIntentT > 0 && attacker.lockIntentSlot === p.slot));
      if (lockedOn) this.campaignAllyAggro |= 1 << p.slot;
    }
    p.hitFlash = PLAYER.hitFlash;
    p.kx += dirX * force;
    p.ky += dirY * force;
    this.emit(EV.HIT, sourceSlot, p.x, p.y, amount, dirX, dirY);
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      // A summon is not a gauntlet kill, a pickup source, or a round body. It simply
      // de-rezzes, including when a dash afterimage absorbs its one hit.
      if (p.copyClone) {
        this.despawnCopyClone(p);
        return;
      }
      this.dropMemoryFragment(p);
      p.swingPhase = 0;
      p.swingT = 0;
      p.swingPct = 0;
      p.chargeT = 0;
      p.chargeHeld = false;
      p.laserChargeHeld = false;
      p.laserChargeT = 0;
      p.laserT = 0;
      p.ocChargeT = 0;
      p.ocFadeT = 0;
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
      p.shrinkT = 0;
      p.laserT = 0;
      p.ocChargeT = 0;
      p.ocFadeT = 0;
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
        // A companion is gone for the rest of the run. Do not start the training
        // respawn timer: leaving the body dead-but-active would revive it next tick.
        if (p.slot > 0) {
          p.active = false;
          p.thrall = false;
          p.respawnT = 0;
          this.campaignBotsLost |= 1 << p.slot;
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
      if (this.infectionMode) {
        // Co-op infection: a downed body stays on the roster as a spectator. Only the
        // last standing runner ends the attempt, and one death never deactivates a guest.
        let standing = 0;
        for (let i = 0; i < this.players.length; i++) {
          const other = this.players[i];
          if (other.active && other.alive) standing++;
        }
        if (standing === 0) {
          this.infectionFailed = true;
          this.gauntletOver = true;
        }
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
      if (this.mode === 'gauntlet' && !this.gauntletPractice && !this.bossRush && p.slot === 0) {
        if (this.infectionMode) this.infectionFailed = true;
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


  // --- Memory fragments ----------------------------------------------------
  //
  // A downed player leaves one shard. Picking it up is permanent for the run:
  // +1 health segment, +20% walking speed and +25% outgoing damage per stack, up
  // to three. Match mode never drops one; this is the reward for a PvE betrayal.

  /** One shard per body per run. Respawning does not earn another. */
  private dropMemoryFragment(p: Player): void {
    if (this.mode === 'match' || this.attractMode) return;
    if (p.thrall || p.copyClone || p.memoryDropped) return;
    let f: Fragment | null = null;
    for (let i = 0; i < this.fragments.length; i++) {
      if (!this.fragments[i].active) {
        f = this.fragments[i];
        break;
      }
    }
    if (!f) return;
    p.memoryDropped = true;
    f.active = true;
    f.x = p.x;
    f.y = p.y;
    f.prevX = p.x;
    f.prevY = p.y;
    f.age = 0;
    f.spin = this.rng.range(0, Math.PI * 2);
    f.fromSlot = p.slot;
    this.emit(EV.POWERUP, p.slot, p.x, p.y, -1);
  }

  private updateFragments(dt: number): void {
    // A total wipe clears the floor. Retrying from the last save point restores
    // whatever shards that save carried; nothing dropped during the failed run does.
    if (this.gauntletOver) {
      let standing = 0;
      for (let k = 0; k < this.players.length; k++) {
        const body = this.players[k];
        if (body.active && body.alive && !body.thrall) standing++;
      }
      if (standing === 0) {
        for (let k = 0; k < this.fragments.length; k++) this.fragments[k].active = false;
        return;
      }
    }
    for (let i = 0; i < this.fragments.length; i++) {
      const f = this.fragments[i];
      if (!f.active) continue;
      f.prevX = f.x;
      f.prevY = f.y;
      f.age += dt;
      // Drift toward the nearest living body that still has room for a stack.
      let best: Player | null = null;
      let bestD = MEMORY.magnetRadius * MEMORY.magnetRadius;
      for (let k = 0; k < this.players.length; k++) {
        const p = this.players[k];
        if (!p.active || !p.alive || p.thrall || p.copyClone) continue;
        if (p.memory >= MEMORY.maxStacks) continue;
        const dx = p.x - f.x;
        const dy = p.y - f.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (best) {
        const dx = best.x - f.x;
        const dy = best.y - f.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d <= MEMORY.pickupRadius) {
          this.takeMemory(best, f);
          continue;
        }
        const step = Math.min(d, MEMORY.magnetSpeed * dt) / d;
        f.x += dx * step;
        f.y += dy * step;
      }
    }
  }

  /** Normalized shard positions for a save point. */
  saveShards(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    const left = this.arena.bounds.left;
    const top = this.arena.bounds.top;
    const wide = Math.max(1, this.arena.bounds.right - left);
    const high = Math.max(1, this.arena.bounds.bottom - top);
    for (let i = 0; i < this.fragments.length; i++) {
      const f = this.fragments[i];
      if (!f.active) continue;
      out.push({ x: (f.x - left) / wide, y: (f.y - top) / high });
    }
    return out;
  }

  /** Re-place saved shards in this arena, scaled from their saved fractions. */
  restoreFragments(shards: readonly { x: number; y: number }[]): void {
    const left = this.arena.bounds.left;
    const top = this.arena.bounds.top;
    const wide = this.arena.bounds.right - left;
    const high = this.arena.bounds.bottom - top;
    let slot = 0;
    for (let i = 0; i < shards.length && slot < this.fragments.length; i++) {
      const s = shards[i];
      if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) continue;
      const f = this.fragments[slot++];
      f.active = true;
      f.age = 0;
      f.spin = 0.7 + slot * 1.3;
      f.fromSlot = -1;
      f.x = f.prevX = left + Math.max(0, Math.min(1, s.x)) * wide;
      f.y = f.prevY = top + Math.max(0, Math.min(1, s.y)) * high;
    }
  }

  private takeMemory(p: Player, f: Fragment): void {
    if (p.memory >= MEMORY.maxStacks) return;
    p.memory++;
    p.maxHp += MEMORY.hpPerStack;
    p.hp = Math.min(p.maxHp, p.hp + MEMORY.hpPerStack);
    f.active = false;
    this.emit(EV.POWERUP, p.slot, p.x, p.y, -1);
  }

  /** Re-apply the run's stacks to a fresh body, after a respawn or a level load. */
  private applyMemoryHealth(p: Player, heal: boolean): void {
    if (p.memory <= 0) return;
    p.maxHp = (programDef(p.program).healthSegments ?? PLAYER.hp) + p.memory;
    if (heal) p.hp = p.maxHp;
    else p.hp = Math.min(p.maxHp, p.hp + p.memory);
  }

  /** Campaign carry-over: the run's stacks are restored when the next node builds. */
  setMemoryStacks(slot: number, stacks: number): void {
    if (slot < 0 || slot >= this.players.length) return;
    const p = this.players[slot];
    p.memory = Math.max(0, Math.min(MEMORY.maxStacks, Math.floor(stacks)));
    this.applyMemoryHealth(p, true);
  }

  /** Outgoing damage scale. Enemy hits (slot -1) and copies never scale. */
  private memoryDamage(sourceSlot: number, amount: number): number {
    if (sourceSlot < 0) return amount;
    const p = this.players[sourceSlot];
    if (!p || p.memory <= 0 || p.copyClone) return amount;
    return amount * (1 + MEMORY.damagePerStack * p.memory);
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
    this.applyMemoryHealth(p, true);
    p.glueT = 0;
    p.glueHits = 0;
    p.thrall = false;
    if (this.mode === 'gauntlet') p.iframes = 0.9;
    this.emit(EV.RESPAWN, p.slot, sx, sy, 0);
  }

  /** Recompute each key from the shared clock. Allocation-free. */
  private refreshKeypadStates(): void {
    const kp = this.keypad;
    if (!kp) return;
    for (let i = 0; i < kp.keys.length; i++) this.keypadStates[i] = keypadKeyState(kp, i, this.keypadT);
  }

  private resetBrowser(): void {
    const b = this.browser;
    if (!b) return;
    this.browserPage = 0;
    this.browserT = 0;
    this.browserPhase = BROWSER_STATE.dwell;
    this.browserClickDone = false;
    this.browserClickT = 0;
    this.browserSolids = b.pages.length > 0 ? b.pages[0].elements : [];
    browserCursorAt(b, this.browserPage, this.browserT, this.browserCursor);
    this.browserCursorX = this.browserCursor.x;
    this.browserCursorY = this.browserCursor.y;
  }

  private advanceBrowserPage(): void {
    const b = this.browser;
    if (!b || b.pages.length === 0) return;
    this.browserPage = (this.browserPage + 1) % b.pages.length;
    const page = b.pages[this.browserPage];
    this.browserSolids = page.elements;
    this.browserT = 0;
    this.browserPhase = BROWSER_STATE.dwell;
    this.browserClickDone = false;
    this.browserClickT = 0;
    browserCursorAt(b, this.browserPage, this.browserT, this.browserCursor);
    this.browserCursorX = this.browserCursor.x;
    this.browserCursorY = this.browserCursor.y;
  }

  private tickBrowser(dt: number): void {
    const b = this.browser;
    if (!b || b.pages.length === 0) return;
    this.browserT += dt;
    const cycle = browserCycle();
    let wrapped = false;
    while (this.browserT >= cycle) {
      this.browserT -= cycle;
      wrapped = true;
    }
    if (wrapped) this.advanceBrowserPage();

    const phase = browserPhaseAt(this.browserT);
    if (phase !== this.browserPhase) {
      this.browserPhase = phase;
      if (phase === BROWSER_STATE.slam && !this.browserClickDone) {
        this.browserClickDone = true;
        this.browserClickT = BROWSER.slam;
        this.burnBrowserClick();
      }
    }
    this.updateBrowserCursor();
    if (this.browserClickT > 0) this.browserClickT = Math.max(0, this.browserClickT - dt);
  }

  /** The cursor idles over the page, then travels to the link for its click. */
  private updateBrowserCursor(): void {
    const b = this.browser;
    if (!b || b.pages.length === 0) return;
    browserCursorAt(b, this.browserPage, this.browserT, this.browserCursor);
    this.browserCursorX = this.browserCursor.x;
    this.browserCursorY = this.browserCursor.y;
  }

  /** One click per page. A dash or cloak clears the slam just like every other hazard. */
  private burnBrowserClick(): void {
    const b = this.browser;
    if (!b || b.pages.length === 0) return;
    const link = b.pages[this.browserPage].link;
    const cx = link.x + link.w * 0.5;
    const cy = link.y + link.h * 0.5;
    const r = BROWSER.clickRadius;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.dashT > 0 || phased(p)) continue;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d = Math.hypot(dx, dy);
      if (d > r + PLAYER.radius * p.shrink) continue;
      this.damagePlayer(p, BROWSER.clickDamage, -1, dx / (d || 1), dy / (d || 1), BROWSER.knockback, SRC.BROWSER, -1);
    }
    if (this.mode === 'training' && this.drone.active) {
      if (Math.hypot(this.drone.x - cx, this.drone.y - cy) <= r + this.drone.radius) {
        this.damageDrone(BROWSER.enemyDamage, -1);
      }
    }
    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active && Math.hypot(s.x - cx, s.y - cy) <= r + s.radius) {
        this.damageSentry(s, BROWSER.enemyDamage, -1, 0, 0);
      }
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (v.active && Math.hypot(v.x - cx, v.y - cy) <= r + v.radius) {
        this.damageVirus(v, BROWSER.enemyDamage, -1, 0, 0);
      }
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      if (Math.hypot(e.x - cx, e.y - cy) <= r + CASCADING_ERROR.blockSize * 0.5) {
        this.damageError(e, BROWSER.enemyDamage, -1, 0, 0);
      }
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      let hit = Math.hypot(w.x - cx, w.y - cy) <= r + w.hitR;
      for (let s = 0; s < w.segCount && !hit; s++) {
        hit = Math.hypot(w.segX[s] - cx, w.segY[s] - cy) <= r + w.segR;
      }
      if (hit) this.damageWorm(w, BROWSER.enemyDamage, -1, 0, 0);
    }
  }

  private browserCoverAt(x: number, y: number, radius: number): boolean {
    for (let i = 0; i < this.browserSolids.length; i++) {
      if (circleRect(x, y, radius, this.browserSolids[i], hitScratch)) return true;
    }
    return false;
  }

  private resolveBrowserPlayer(p: Player): void {
    if (!this.browser) return;
    const radius = PLAYER.radius * p.shrink;
    for (let i = 0; i < this.browserSolids.length; i++) {
      if (!circleRect(p.x, p.y, radius, this.browserSolids[i], hitScratch)) continue;
      p.x = hitScratch.px;
      p.y = hitScratch.py;
      const vn = p.vx * hitScratch.nx + p.vy * hitScratch.ny;
      if (vn < 0) {
        p.vx -= vn * hitScratch.nx;
        p.vy -= vn * hitScratch.ny;
      }
    }
  }

  private pushBodyOutOfBrowser(body: { x: number; y: number }, radius: number): void {
    if (!this.browser) return;
    for (let i = 0; i < this.browserSolids.length; i++) {
      if (!circleRect(body.x, body.y, radius, this.browserSolids[i], hitScratch)) continue;
      body.x = hitScratch.px;
      body.y = hitScratch.py;
    }
  }

  private pushThreatsOffBrowser(): void {
    if (!this.browser) return;
    if (this.mode === 'training' && this.drone.active) this.pushBodyOutOfBrowser(this.drone, this.drone.radius);
    for (let i = 0; i < this.sentries.length; i++) {
      if (this.sentries[i].active) this.pushBodyOutOfBrowser(this.sentries[i], this.sentries[i].radius);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      if (this.viruses[i].active) this.pushBodyOutOfBrowser(this.viruses[i], this.viruses[i].radius);
    }
    for (let i = 0; i < this.errors.length; i++) {
      if (this.errors[i].active) this.pushBodyOutOfBrowser(this.errors[i], CASCADING_ERROR.blockSize * 0.5);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      this.pushBodyOutOfBrowser(w, w.hitR);
      for (let s = 0; s < w.segCount; s++) {
        const body = this.browserBodyScratch;
        body.x = w.segX[s];
        body.y = w.segY[s];
        this.pushBodyOutOfBrowser(body, WORM.segmentRadius);
        w.segX[s] = body.x;
        w.segY[s] = body.y;
      }
    }
  }

  private browserStopsProjectile(proj: Projectile): boolean {
    if (!this.browserCoverAt(proj.x, proj.y, proj.radius)) return false;
    proj.active = false;
    this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 1);
    return true;
  }

  private browserRayReach(ox: number, oy: number, dx: number, dy: number, max: number): number {
    if (!this.browser) return max;
    let best = max;
    for (let i = 0; i < this.browserSolids.length; i++) {
      const r = this.browserSolids[i];
      let tmin = 0;
      let tmax = best;
      if (Math.abs(dx) < 1e-6) {
        if (ox < r.x || ox > r.x + r.w) continue;
      } else {
        let t1 = (r.x - ox) / dx;
        let t2 = (r.x + r.w - ox) / dx;
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
        if (oy < r.y || oy > r.y + r.h) continue;
      } else {
        let t1 = (r.y - oy) / dy;
        let t2 = (r.y + r.h - oy) / dy;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }
      if (tmin >= 0 && tmin < best) best = tmin;
    }
    return best;
  }

  private browserLineBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    return this.browserRayReach(x1, y1, x2 - x1, y2 - y1, 1) < 1;
  }

  private resetKeypad(): void {
    if (!this.keypad) return;
    this.keypadT = 0;
    this.refreshKeypadStates();
    this.keypadPrevStates.set(this.keypadStates);
  }

  /** Advance the pad and resolve only the frame a key starts its downward slam. */
  private tickKeypad(dt: number): void {
    const kp = this.keypad;
    if (!kp) return;
    this.keypadPrevStates.set(this.keypadStates);
    this.keypadT += dt;
    for (let i = 0; i < kp.keys.length; i++) {
      const next = keypadKeyState(kp, i, this.keypadT);
      this.keypadStates[i] = next;
      if (next === KEYPAD_STATE.slam && this.keypadPrevStates[i] !== KEYPAD_STATE.slam) {
        this.crushUnderKey(i);
      }
    }
  }

  private resetScanner(): void {
    this.scannerT = 0;
    this.scannerPage = 0;
    this.scannerPhase = SCANNER_STATE.load;
    this.clearScannerHits();
  }

  private clearScannerHits(): void {
    this.scannerHitPlayers = 0;
    this.scannerHitWorms = 0;
    this.scannerHitViruses = 0;
    this.scannerHitSentries = 0;
    this.scannerHitErrors = 0;
    this.scannerHitDrone = false;
  }

  /** Advance the document cycle, then resolve the read line against live bodies. */
  private tickScanner(dt: number): void {
    const sc = this.scanner;
    if (!sc) return;
    const cycle = scannerCycle();
    this.scannerT += dt;
    let wrapped = false;
    while (this.scannerT >= cycle) {
      this.scannerT -= cycle;
      wrapped = true;
    }
    if (wrapped) {
      const pages = Math.max(1, sc.documents.length);
      this.scannerPage = (this.scannerPage + 1) % pages;
      this.clearScannerHits();
    }
    const phase = scannerPhaseAt(this.scannerT);
    if (phase !== this.scannerPhase) {
      this.scannerPhase = phase;
      if (phase === SCANNER_STATE.down || phase === SCANNER_STATE.up) this.clearScannerHits();
    }
    this.burnScanner();
  }

  private scannerHits(
    x: number,
    y: number,
    radius: number,
    sc: ArenaScannerDef,
    line: number,
    half: number,
  ): boolean {
    if (x < sc.x - radius || x > sc.x + sc.w + radius) return false;
    return Math.abs(y - line) <= half + radius;
  }

  /**
   * One damage tick per pass per body. The line is thin and moving, so a standing
   * body is caught once; a dodge reads as a hop because the dash is airborne.
   */
  private burnScanner(): void {
    const sc = this.scanner;
    if (!sc) return;
    const line = scannerLaserY(sc, this.scannerT);
    if (line < 0) return;
    const half = SCANNER.width * 0.5;
    const dirY = this.scannerPhase === SCANNER_STATE.up ? -1 : 1;

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.dashT > 0 || phased(p)) continue;
      const bit = 1 << p.slot;
      if (this.scannerHitPlayers & bit) continue;
      if (!this.scannerHits(p.x, p.y, PLAYER.radius * p.shrink, sc, line, half)) continue;
      this.scannerHitPlayers |= bit;
      this.damagePlayer(p, SCANNER.damage, -1, 0, dirY, SCANNER.knockback, SRC.SCANNER, -1);
    }

    if (this.mode === 'training' && this.drone.active && !this.scannerHitDrone) {
      if (this.scannerHits(this.drone.x, this.drone.y, this.drone.radius, sc, line, half)) {
        this.scannerHitDrone = true;
        this.damageDrone(SCANNER.enemyDamage, -1);
      }
    }
    if (this.mode !== 'gauntlet') return;

    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const bit = 1 << i;
      if (this.scannerHitWorms & bit) continue;
      let hit = this.scannerHits(w.x, w.y, w.hitR, sc, line, half);
      for (let s = 0; s < w.segCount && !hit; s++) {
        hit = this.scannerHits(w.segX[s], w.segY[s], w.segR, sc, line, half);
      }
      if (!hit) continue;
      this.scannerHitWorms |= bit;
      this.damageWorm(w, SCANNER.enemyDamage, -1, 0, dirY);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const bit = 1 << i;
      if (this.scannerHitViruses & bit) continue;
      if (!this.scannerHits(v.x, v.y, v.radius, sc, line, half)) continue;
      this.scannerHitViruses |= bit;
      this.damageVirus(v, SCANNER.enemyDamage, -1, 0, dirY);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const bit = 1 << i;
      if (this.scannerHitSentries & bit) continue;
      if (!this.scannerHits(s.x, s.y, s.radius, sc, line, half)) continue;
      this.scannerHitSentries |= bit;
      this.damageSentry(s, SCANNER.enemyDamage, -1, 0, dirY);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const bit = 1 << i;
      if (this.scannerHitErrors & bit) continue;
      if (!this.scannerHits(e.x, e.y, CASCADING_ERROR.blockSize * 0.5, sc, line, half)) continue;
      this.scannerHitErrors |= bit;
      this.damageError(e, SCANNER.enemyDamage, -1, 0, dirY);
    }
  }

  private resetFax(): void {
    this.faxT = 0;
    this.faxPage = 0;
    this.faxRow = 0;
    this.faxPhase = this.fax ? faxPhaseAt(this.fax, 0) : FAX_STATE.readyLeft;
    this.clearFaxHits();
  }

  private clearFaxHits(): void {
    this.faxHitPlayers = 0;
    this.faxHitWorms = 0;
    this.faxHitViruses = 0;
    this.faxHitSentries = 0;
    this.faxHitErrors = 0;
    this.faxHitDrone = false;
  }

  /** Advance the carriage, step down rows and swap sheets at the end of a sheet, then burn. */
  private tickFax(dt: number): void {
    const fx = this.fax;
    if (!fx) return;
    const cycle = faxCycle(fx);
    this.faxT += dt;
    let wrapped = false;
    while (this.faxT >= cycle) {
      this.faxT -= cycle;
      wrapped = true;
    }
    if (wrapped) {
      const pages = Math.max(1, fx.documents.length);
      this.faxPage = (this.faxPage + 1) % pages;
      this.faxRow = 0;
      this.clearFaxHits();
    }
    const row = faxRowAt(fx, this.faxT);
    if (row !== this.faxRow) {
      this.faxRow = row;
      this.clearFaxHits();
    }
    const phase = faxPhaseAt(fx, this.faxT);
    if (phase !== this.faxPhase) this.faxPhase = phase;
    if (phase === FAX_STATE.printRight || phase === FAX_STATE.printLeft) this.burnFax();
  }

  private faxHits(
    x: number,
    y: number,
    radius: number,
    fx: ArenaFaxDef,
    headX: number,
    headY: number,
    halfW: number,
    halfH: number,
  ): boolean {
    return Math.abs(x - headX) <= halfW + radius && Math.abs(y - headY) <= halfH + radius;
  }

  /**
   * The compact head resolves after the bodies move, exactly like the scanner line.
   * One hit per row per body keeps the carriage readable instead of melting a target
   * that stands beside it for several frames.
   */
  private burnFax(): void {
    const fx = this.fax;
    if (!fx) return;
    const headX = faxHeadX(fx, this.faxT);
    const headY = faxHeadY(fx, this.faxT);
    const halfW = fx.headW * 0.5;
    const halfH = fx.headH * 0.5;
    const dirX = this.faxPhase === FAX_STATE.printRight ? 1 : -1;

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.dashT > 0 || phased(p)) continue;
      const bit = 1 << p.slot;
      if (this.faxHitPlayers & bit) continue;
      if (!this.faxHits(p.x, p.y, PLAYER.radius * p.shrink, fx, headX, headY, halfW, halfH)) continue;
      this.faxHitPlayers |= bit;
      this.damagePlayer(p, fx.damage, -1, dirX, 0, fx.knockback, SRC.FAX, -1);
    }

    if (this.mode === 'training' && this.drone.active && !this.faxHitDrone) {
      if (this.faxHits(this.drone.x, this.drone.y, this.drone.radius, fx, headX, headY, halfW, halfH)) {
        this.faxHitDrone = true;
        this.damageDrone(fx.enemyDamage, -1);
      }
    }
    if (this.mode !== 'gauntlet') return;

    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const bit = 1 << i;
      if (this.faxHitWorms & bit) continue;
      let hit = this.faxHits(w.x, w.y, w.hitR, fx, headX, headY, halfW, halfH);
      for (let s = 0; s < w.segCount && !hit; s++) {
        hit = this.faxHits(w.segX[s], w.segY[s], w.segR, fx, headX, headY, halfW, halfH);
      }
      if (!hit) continue;
      this.faxHitWorms |= bit;
      this.damageWorm(w, fx.enemyDamage, -1, dirX, 0);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const bit = 1 << i;
      if (this.faxHitViruses & bit) continue;
      if (!this.faxHits(v.x, v.y, v.radius, fx, headX, headY, halfW, halfH)) continue;
      this.faxHitViruses |= bit;
      this.damageVirus(v, fx.enemyDamage, -1, dirX, 0);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const bit = 1 << i;
      if (this.faxHitSentries & bit) continue;
      if (!this.faxHits(s.x, s.y, s.radius, fx, headX, headY, halfW, halfH)) continue;
      this.faxHitSentries |= bit;
      this.damageSentry(s, fx.enemyDamage, -1, dirX, 0);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const bit = 1 << i;
      if (this.faxHitErrors & bit) continue;
      if (!this.faxHits(e.x, e.y, CASCADING_ERROR.blockSize * 0.5, fx, headX, headY, halfW, halfH)) continue;
      this.faxHitErrors |= bit;
      this.damageError(e, fx.enemyDamage, -1, 0, dirX);
    }
  }

  private resetPlug(): void {
    this.plugT = 0;
    this.plugPhase = this.plug ? plugPhaseAt(this.plug, 0) : PLUG_STATE.safe;
    this.clearPlugHits();
  }

  private clearPlugHits(): void {
    this.plugHitPlayers = 0;
    this.plugHitWorms = 0;
    this.plugHitViruses = 0;
    this.plugHitSentries = 0;
    this.plugHitErrors = 0;
    this.plugHitDrone = false;
  }

  /** Advance the green/red clock and resolve the ring while it is live. */
  private tickPlug(dt: number): void {
    const plug = this.plug;
    if (!plug) return;
    const cycle = plugCycle(plug);
    this.plugT += dt;
    while (this.plugT >= cycle) this.plugT -= cycle;
    const phase = plugPhaseAt(plug, this.plugT);
    if (phase !== this.plugPhase) {
      this.plugPhase = phase;
      if (phase === PLUG_STATE.live) this.clearPlugHits();
    }
    if (phase === PLUG_STATE.live) this.burnPlug();
  }

  /** Closest-point test for one socket-to-socket arc. Stores the push normal. */
  private plugArcHit(
    arc: ArenaPlugArcDef,
    x: number,
    y: number,
    radius: number,
    width: number,
  ): boolean {
    const dx = arc.bx - arc.ax;
    const dy = arc.by - arc.ay;
    const length2 = dx * dx + dy * dy;
    const t = length2 > 0.0001
      ? Math.max(0, Math.min(1, ((x - arc.ax) * dx + (y - arc.ay) * dy) / length2))
      : 0;
    const px = arc.ax + dx * t;
    const py = arc.ay + dy * t;
    const ox = x - px;
    const oy = y - py;
    const reach = width * 0.5 + radius;
    if (ox * ox + oy * oy > reach * reach) return false;
    const d = Math.hypot(ox, oy);
    if (d > 0.001) {
      this.plugHitNx = ox / d;
      this.plugHitNy = oy / d;
    } else {
      const length = Math.sqrt(length2) || 1;
      this.plugHitNx = -dy / length;
      this.plugHitNy = dx / length;
    }
    return true;
  }

  /** One hit per body per red pulse, across all four arcs. */
  private burnPlug(): void {
    const plug = this.plug;
    if (!plug) return;

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.dashT > 0 || phased(p)) continue;
      const bit = 1 << p.slot;
      if (this.plugHitPlayers & bit) continue;
      let hit = false;
      for (let a = 0; a < plug.arcs.length && !hit; a++) {
        hit = this.plugArcHit(plug.arcs[a], p.x, p.y, PLAYER.radius * p.shrink, plug.arcWidth);
      }
      if (!hit) continue;
      this.plugHitPlayers |= bit;
      this.damagePlayer(p, plug.damage, -1, this.plugHitNx, this.plugHitNy, plug.knockback, SRC.PLUG, -1);
    }

    if (this.mode === 'training' && this.drone.active && !this.plugHitDrone) {
      for (let a = 0; a < plug.arcs.length; a++) {
        if (!this.plugArcHit(plug.arcs[a], this.drone.x, this.drone.y, this.drone.radius, plug.arcWidth)) continue;
        this.plugHitDrone = true;
        this.damageDrone(plug.enemyDamage, -1);
        break;
      }
    }
    if (this.mode !== 'gauntlet') return;

    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const bit = 1 << i;
      if (this.plugHitWorms & bit) continue;
      let hit = false;
      for (let a = 0; a < plug.arcs.length && !hit; a++) {
        const arc = plug.arcs[a];
        hit = this.plugArcHit(arc, w.x, w.y, w.hitR, plug.arcWidth);
        for (let s = 0; s < w.segCount && !hit; s++) {
          hit = this.plugArcHit(arc, w.segX[s], w.segY[s], w.segR, plug.arcWidth);
        }
      }
      if (!hit) continue;
      this.plugHitWorms |= bit;
      this.damageWorm(w, plug.enemyDamage, -1, this.plugHitNx, this.plugHitNy, plug.knockback);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const bit = 1 << i;
      if (this.plugHitViruses & bit) continue;
      let hit = false;
      for (let a = 0; a < plug.arcs.length && !hit; a++) {
        hit = this.plugArcHit(plug.arcs[a], v.x, v.y, v.radius, plug.arcWidth);
      }
      if (!hit) continue;
      this.plugHitViruses |= bit;
      this.damageVirus(v, plug.enemyDamage, -1, this.plugHitNx, this.plugHitNy, plug.knockback);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const bit = 1 << i;
      if (this.plugHitSentries & bit) continue;
      let hit = false;
      for (let a = 0; a < plug.arcs.length && !hit; a++) {
        hit = this.plugArcHit(plug.arcs[a], s.x, s.y, s.radius, plug.arcWidth);
      }
      if (!hit) continue;
      this.plugHitSentries |= bit;
      this.damageSentry(s, plug.enemyDamage, -1, this.plugHitNx, this.plugHitNy, plug.knockback);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const bit = 1 << i;
      if (this.plugHitErrors & bit) continue;
      let hit = false;
      for (let a = 0; a < plug.arcs.length && !hit; a++) {
        hit = this.plugArcHit(plug.arcs[a], e.x, e.y, CASCADING_ERROR.blockSize * 0.5, plug.arcWidth);
      }
      if (!hit) continue;
      this.plugHitErrors |= bit;
      this.damageError(e, plug.enemyDamage, -1, this.plugHitNx, this.plugHitNy);
    }
  }

  private resetSmoke(): void {
    const smoke = this.smoke;
    if (!smoke) return;
    this.smokeT = 0;
    this.smokeAlarm = false;
    this.smokeAlarmT = 0;
    this.smokeCooldownT = 0;
    this.smokeWaveT = 0;
    this.clearSmokeWaves();
    const battery = this.smokeBattery;
    if (battery) {
      battery.active = true;
      battery.hp = smoke.batteryHp;
      battery.hitFlash = 0;
      battery.fixed = true;
    }
  }

  private clearSmokeWaves(): void {
    for (let i = 0; i < this.smokeWaves.length; i++) this.smokeWaves[i].active = false;
  }

  /** Advance the siren, rings and fixed battery, then look for a fresh sensor press. */
  private tickSmoke(dt: number): void {
    const smoke = this.smoke;
    if (!smoke) return;
    this.smokeT += dt;
    if (this.smokeCooldownT > 0) this.smokeCooldownT = Math.max(0, this.smokeCooldownT - dt);

    const battery = this.smokeBattery;
    if (battery && !battery.active) {
      if (this.smokeAlarm) {
        this.smokeAlarm = false;
        this.clearSmokeWaves();
      }
    } else if (this.smokeAlarm) {
      this.smokeAlarmT = Math.max(0, this.smokeAlarmT - dt);
      this.smokeWaveT -= dt;
      if (this.smokeWaveT <= 0) {
        if (this.spawnSmokeWave()) this.smokeWaveT = smoke.waveEvery;
        else this.smokeWaveT = 0.1;
      }
      if (this.smokeAlarmT <= 0) {
        this.smokeAlarm = false;
        this.smokeCooldownT = smoke.sensorCooldown;
      }
    }

    for (let i = 0; i < this.smokeWaves.length; i++) {
      const wave = this.smokeWaves[i];
      if (!wave.active) continue;
      wave.radius += smoke.waveSpeed * dt;
      if (wave.radius - smoke.waveWidth * 0.5 > smoke.maxRadius) {
        wave.active = false;
        continue;
      }
      this.burnSmokeWave(wave);
    }

    if (!this.smokeAlarm && this.smokeCooldownT <= 0 && (!battery || battery.active)) {
      this.checkSmokeSensors();
    }
  }

  private resetWatch(): void {
    this.watchT = 0;
    this.watchAngle = this.watch ? watchHandAngle(this.watch, 0) : -Math.PI * 0.5;
    this.watchTurn = 0;
    this.watchHitPlayers = 0;
    this.watchHitWorms = 0;
    this.watchHitViruses = 0;
    this.watchHitSentries = 0;
    this.watchHitErrors = 0;
    this.watchHitDrone = false;
  }

  /** Advance the second hand and clear the per-revolution hit masks on wrap. */
  private tickWatch(dt: number): void {
    const watch = this.watch;
    if (!watch) return;
    this.watchT += dt;
    this.watchAngle = watchHandAngle(watch, this.watchT);
    const turn = Math.floor((watch.speed * this.watchT) / (Math.PI * 2));
    if (turn !== this.watchTurn) {
      this.watchTurn = turn;
      this.watchHitPlayers = 0;
      this.watchHitWorms = 0;
      this.watchHitViruses = 0;
      this.watchHitSentries = 0;
      this.watchHitErrors = 0;
      this.watchHitDrone = false;
    }
    this.burnWatch();
  }

  /** Nearest point on the forward hand segment. Stores the perpendicular shove. */
  private watchHits(x: number, y: number, radius: number): boolean {
    const watch = this.watch;
    if (!watch) return false;
    const cx = this.centerX;
    const cy = this.centerY;
    const dx = Math.cos(this.watchAngle) * watch.handLength;
    const dy = Math.sin(this.watchAngle) * watch.handLength;
    const length2 = dx * dx + dy * dy;
    const t = length2 > 0.0001
      ? Math.max(0, Math.min(1, ((x - cx) * dx + (y - cy) * dy) / length2))
      : 0;
    const px = cx + dx * t;
    const py = cy + dy * t;
    const ox = x - px;
    const oy = y - py;
    const reach = watch.handWidth * 0.5 + radius;
    if (ox * ox + oy * oy > reach * reach) return false;
    const d = Math.hypot(ox, oy);
    if (d > 0.001) {
      this.watchHitNx = ox / d;
      this.watchHitNy = oy / d;
    } else {
      this.watchHitNx = -Math.sin(this.watchAngle);
      this.watchHitNy = Math.cos(this.watchAngle);
    }
    return true;
  }

  /** The hand damages each body once per revolution. */
  private burnWatch(): void {
    const watch = this.watch;
    if (!watch) return;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.dashT > 0 || phased(p)) continue;
      const bit = 1 << p.slot;
      if (this.watchHitPlayers & bit) continue;
      if (!this.watchHits(p.x, p.y, PLAYER.radius * p.shrink)) continue;
      this.watchHitPlayers |= bit;
      this.damagePlayer(p, watch.damage, -1, this.watchHitNx, this.watchHitNy, watch.knockback, SRC.WATCH, -1);
    }
    if (this.mode === 'training' && this.drone.active && !this.watchHitDrone) {
      if (this.watchHits(this.drone.x, this.drone.y, this.drone.radius)) {
        this.watchHitDrone = true;
        this.damageDrone(watch.enemyDamage, -1);
      }
    }
    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const bit = 1 << i;
      if (this.watchHitWorms & bit) continue;
      let hit = this.watchHits(w.x, w.y, w.hitR);
      for (let s = 0; s < w.segCount && !hit; s++) hit = this.watchHits(w.segX[s], w.segY[s], w.segR);
      if (!hit) continue;
      this.watchHitWorms |= bit;
      this.damageWorm(w, watch.enemyDamage, -1, this.watchHitNx, this.watchHitNy, watch.knockback);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const bit = 1 << i;
      if (this.watchHitViruses & bit) continue;
      if (!this.watchHits(v.x, v.y, v.radius)) continue;
      this.watchHitViruses |= bit;
      this.damageVirus(v, watch.enemyDamage, -1, this.watchHitNx, this.watchHitNy, watch.knockback);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const bit = 1 << i;
      if (this.watchHitSentries & bit) continue;
      if (!this.watchHits(s.x, s.y, s.radius)) continue;
      this.watchHitSentries |= bit;
      this.damageSentry(s, watch.enemyDamage, -1, this.watchHitNx, this.watchHitNy, watch.knockback);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const bit = 1 << i;
      if (this.watchHitErrors & bit) continue;
      if (!this.watchHits(e.x, e.y, CASCADING_ERROR.blockSize * 0.5)) continue;
      this.watchHitErrors |= bit;
      this.damageError(e, watch.enemyDamage, -1, this.watchHitNx, this.watchHitNy);
    }
  }

  private resetLaptop(): void {
    const lap = this.laptop;
    if (!lap) return;
    this.laptopT = 0;
    this.laptopMessage = 0;
    this.laptopMessageT = 0;
    this.laptopFlashT = 0;
    this.laptopCursor = 0;
    // A sheet always starts the round on its authored grid with every cell intact.
    const sheet = lap.sheet;
    if (sheet) {
      for (let i = 0; i < sheet.cells.length; i++) {
        const cell = sheet.cells[i];
        laptopCellRect(sheet, cell, this.laptopCellRects[i]);
        this.laptopCellHp[i] = Math.max(1, cell.hp);
      }
    }
    this.refreshLaptopCards();
    this.rebuildLaptopSolids();
  }

  /** Cards, the open preview layout and every intact sheet cell in one cover list. */
  private rebuildLaptopSolids(): void {
    const lap = this.laptop;
    if (!lap) return;
    const layout = lap.messages[this.laptopMessage]?.layout ?? [];
    this.laptopSolids = this.laptopCards.concat(layout, this.laptopCellRects);
  }

  /** Move the inbox cards from the shared clock. Off-pane cards are collisionless. */
  private refreshLaptopCards(): void {
    const lap = this.laptop;
    if (!lap) return;
    // CHAT alternates bubble sides so one lane stays open; MAIL keeps one narrow column.
    const bubble = lap.variant === 'chat' ? Math.max(0.3, Math.min(1, lap.bubbleW ?? 0.58)) : 1;
    const w = Math.max(24, lap.inbox.w * bubble - 20);
    for (let i = 0; i < this.laptopCards.length; i++) {
      const card = this.laptopCards[i];
      const y = laptopCardY(lap, i, this.laptopT);
      card.x = bubble < 1 && i % 2 === 0 ? lap.inbox.x + lap.inbox.w - 10 - w : lap.inbox.x + 10;
      card.y = y;
      card.w = w;
      // A card is only solid while it is fully inside the pane. A clipped card above the
      // top edge is invisible mid-wrap, so it must not keep blocking a spawn row.
      const inside = y >= lap.inbox.y && y + lap.cardH <= lap.inbox.y + lap.inbox.h;
      card.h = inside ? lap.cardH : 0;
    }
  }

  /** Swap the active preview cover. Only called on a message boundary. */
  private setLaptopMessage(index: number): void {
    const lap = this.laptop;
    if (!lap || lap.messages.length === 0) return;
    this.laptopMessage = ((index % lap.messages.length) + lap.messages.length) % lap.messages.length;
    this.laptopFlashT = 1.2;
    this.rebuildLaptopSolids();
  }

  private tickLaptop(dt: number): void {
    const lap = this.laptop;
    if (!lap) return;
    this.laptopT += dt;
    if (lap.sheet) {
      const every = Math.max(0.15, lap.sheet.cursorEvery);
      this.laptopCursor = Math.floor(this.laptopT / every) % Math.max(1, lap.sheet.cols);
    }
    // A sheet has no preview messages, so its message clock has nothing to advance.
    if (lap.messages.length > 0) {
      this.laptopMessageT += dt;
      const every = Math.max(0.5, lap.messageEvery);
      if (this.laptopMessageT >= every) {
        const advances = Math.floor(this.laptopMessageT / every);
        this.laptopMessageT -= advances * every;
        this.setLaptopMessage(this.laptopMessage + advances);
      }
    }
    if (this.laptopFlashT > 0) this.laptopFlashT = Math.max(0, this.laptopFlashT - dt);
    this.refreshLaptopCards();
  }

  private laptopCoverAt(x: number, y: number, radius: number): boolean {
    for (let i = 0; i < this.laptopSolids.length; i++) {
      const r = this.laptopSolids[i];
      if (r.w <= 0 || r.h <= 0) continue;
      if (circleRect(x, y, radius, r, hitScratch)) return true;
    }
    return false;
  }

  private resolveLaptopPlayer(p: Player): void {
    if (!this.laptop) return;
    const radius = PLAYER.radius * p.shrink;
    for (let i = 0; i < this.laptopSolids.length; i++) {
      const r = this.laptopSolids[i];
      if (r.w <= 0 || r.h <= 0) continue;
      if (!circleRect(p.x, p.y, radius, r, hitScratch)) continue;
      p.x = hitScratch.px;
      p.y = hitScratch.py;
      const vn = p.vx * hitScratch.nx + p.vy * hitScratch.ny;
      if (vn < 0) {
        p.vx -= vn * hitScratch.nx;
        p.vy -= vn * hitScratch.ny;
      }
    }
  }

  private pushBodyOutOfLaptop(body: { x: number; y: number }, radius: number): void {
    if (!this.laptop) return;
    for (let i = 0; i < this.laptopSolids.length; i++) {
      const r = this.laptopSolids[i];
      if (r.w <= 0 || r.h <= 0) continue;
      if (!circleRect(body.x, body.y, radius, r, hitScratch)) continue;
      body.x = hitScratch.px;
      body.y = hitScratch.py;
    }
  }

  private pushThreatsOffLaptop(): void {
    if (!this.laptop) return;
    if (this.mode === 'training' && this.drone.active) this.pushBodyOutOfLaptop(this.drone, this.drone.radius);
    for (let i = 0; i < this.sentries.length; i++) {
      if (this.sentries[i].active) this.pushBodyOutOfLaptop(this.sentries[i], this.sentries[i].radius);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      if (this.viruses[i].active) this.pushBodyOutOfLaptop(this.viruses[i], this.viruses[i].radius);
    }
    for (let i = 0; i < this.errors.length; i++) {
      if (this.errors[i].active) this.pushBodyOutOfLaptop(this.errors[i], CASCADING_ERROR.blockSize * 0.5);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      this.pushBodyOutOfLaptop(w, w.hitR);
      for (let s = 0; s < w.segCount; s++) {
        const body = this.laptopBodyScratch;
        body.x = w.segX[s];
        body.y = w.segY[s];
        this.pushBodyOutOfLaptop(body, WORM.segmentRadius);
        w.segX[s] = body.x;
        w.segY[s] = body.y;
      }
    }
  }

  /**
   * A direct ranged shot landing on a sheet cell spends one of its hits. A cleared cell
   * collapses its cover for the rest of the round. Bombs and the heavy beam stop on cover
   * without chipping it; only the ranged hit path breaks cells.
   */
  private damageLaptopCell(proj: Projectile): boolean {
    for (let i = 0; i < this.laptopCellRects.length; i++) {
      const r = this.laptopCellRects[i];
      if (r.w <= 0 || r.h <= 0) continue;
      if (!circleRect(proj.x, proj.y, proj.radius, r, hitScratch)) continue;
      this.laptopCellHp[i] -= 1;
      if (this.laptopCellHp[i] <= 0) {
        this.laptopCellHp[i] = 0;
        r.w = 0;
        r.h = 0;
      }
      return true;
    }
    return false;
  }

  private laptopStopsProjectile(proj: Projectile): boolean {
    // Sheet cells are breakable, so they take the hit before the general cover block.
    if (this.laptopCellRects.length > 0 && this.damageLaptopCell(proj)) {
      proj.active = false;
      this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 1);
      return true;
    }
    if (!this.laptopCoverAt(proj.x, proj.y, proj.radius)) return false;
    proj.active = false;
    this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 1);
    return true;
  }

  private laptopRayReach(ox: number, oy: number, dx: number, dy: number, max: number): number {
    if (!this.laptop) return max;
    let best = max;
    for (let i = 0; i < this.laptopSolids.length; i++) {
      const r = this.laptopSolids[i];
      if (r.w <= 0 || r.h <= 0) continue;
      let tmin = 0;
      let tmax = best;
      if (Math.abs(dx) < 1e-6) {
        if (ox < r.x || ox > r.x + r.w) continue;
      } else {
        let t1 = (r.x - ox) / dx;
        let t2 = (r.x + r.w - ox) / dx;
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
        if (oy < r.y || oy > r.y + r.h) continue;
      } else {
        let t1 = (r.y - oy) / dy;
        let t2 = (r.y + r.h - oy) / dy;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }
      if (tmin >= 0 && tmin < best) best = tmin;
    }
    return best;
  }

  private smokeSensorTouches(x: number, y: number): boolean {
    const smoke = this.smoke;
    if (!smoke) return false;
    for (let i = 0; i < smoke.sensors.length; i++) {
      const s = smoke.sensors[i];
      const dx = x - s.x;
      const dy = y - s.y;
      if (dx * dx + dy * dy <= s.radius * s.radius) return true;
    }
    return false;
  }

  /** A live body standing on any sensor pad starts one timed siren burst. */
  private checkSmokeSensors(): void {
    let pressed = false;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive) continue;
      if (this.smokeSensorTouches(p.x, p.y)) {
        pressed = true;
        break;
      }
    }
    if (!pressed && this.mode === 'training' && this.drone.active) {
      pressed = this.smokeSensorTouches(this.drone.x, this.drone.y);
    }
    if (!pressed && this.mode === 'gauntlet') {
      for (let i = 0; i < this.worms.length && !pressed; i++) {
        if (this.worms[i].active) pressed = this.smokeSensorTouches(this.worms[i].x, this.worms[i].y);
      }
      for (let i = 0; i < this.viruses.length && !pressed; i++) {
        if (this.viruses[i].active) pressed = this.smokeSensorTouches(this.viruses[i].x, this.viruses[i].y);
      }
      for (let i = 0; i < this.sentries.length && !pressed; i++) {
        if (this.sentries[i].active) pressed = this.smokeSensorTouches(this.sentries[i].x, this.sentries[i].y);
      }
      for (let i = 0; i < this.errors.length && !pressed; i++) {
        if (this.errors[i].active) pressed = this.smokeSensorTouches(this.errors[i].x, this.errors[i].y);
      }
    }
    if (pressed) {
      const smoke = this.smoke;
      if (!smoke) return;
      this.smokeAlarm = true;
      this.smokeAlarmT = smoke.alarmTime;
      this.smokeWaveT = 0;
      this.clearSmokeWaves();
    }
  }

  private spawnSmokeWave(): boolean {
    for (let i = 0; i < this.smokeWaves.length; i++) {
      const wave = this.smokeWaves[i];
      if (wave.active) continue;
      wave.active = true;
      wave.radius = 0;
      wave.hitPlayers = 0;
      wave.hitWorms = 0;
      wave.hitViruses = 0;
      wave.hitSentries = 0;
      wave.hitErrors = 0;
      wave.hitDrone = false;
      return true;
    }
    return false;
  }

  private smokeRingHits(waveRadius: number, width: number, radius: number, distance: number): boolean {
    const inner = waveRadius - width * 0.5;
    const outer = waveRadius + width * 0.5;
    return distance + radius >= inner && distance - radius <= outer;
  }

  /** One expanding siren ring damages each body at most once. */
  private burnSmokeWave(wave: SmokeWave): void {
    const smoke = this.smoke;
    if (!smoke) return;
    const cx = this.centerX;
    const cy = this.centerY;

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.dashT > 0 || phased(p)) continue;
      const bit = 1 << p.slot;
      if (wave.hitPlayers & bit) continue;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const distance = Math.hypot(dx, dy);
      if (!this.smokeRingHits(wave.radius, smoke.waveWidth, PLAYER.radius * p.shrink, distance)) continue;
      wave.hitPlayers |= bit;
      this.smokeHitNx = distance > 0.001 ? dx / distance : 1;
      this.smokeHitNy = distance > 0.001 ? dy / distance : 0;
      this.damagePlayer(p, smoke.damage, -1, this.smokeHitNx, this.smokeHitNy, smoke.knockback, SRC.SMOKE, -1);
    }

    if (this.mode === 'training' && this.drone.active && !wave.hitDrone) {
      const dx = this.drone.x - cx;
      const dy = this.drone.y - cy;
      const distance = Math.hypot(dx, dy);
      if (this.smokeRingHits(wave.radius, smoke.waveWidth, this.drone.radius, distance)) {
        wave.hitDrone = true;
        this.damageDrone(smoke.enemyDamage, -1);
      }
    }
    if (this.mode !== 'gauntlet') return;

    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const bit = 1 << i;
      if (wave.hitWorms & bit) continue;
      let hit = false;
      let hx = w.x;
      let hy = w.y;
      for (let s = -1; s < w.segCount && !hit; s++) {
        const tx = s < 0 ? w.x : w.segX[s];
        const ty = s < 0 ? w.y : w.segY[s];
        const radius = s < 0 ? w.hitR : w.segR;
        const dx = tx - cx;
        const dy = ty - cy;
        const distance = Math.hypot(dx, dy);
        if (!this.smokeRingHits(wave.radius, smoke.waveWidth, radius, distance)) continue;
        hit = true;
        hx = tx;
        hy = ty;
      }
      if (!hit) continue;
      wave.hitWorms |= bit;
      const dx = hx - cx;
      const dy = hy - cy;
      const distance = Math.hypot(dx, dy) || 1;
      this.damageWorm(w, smoke.enemyDamage, -1, dx / distance, dy / distance, smoke.knockback);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      const bit = 1 << i;
      if (wave.hitViruses & bit) continue;
      const dx = v.x - cx;
      const dy = v.y - cy;
      const distance = Math.hypot(dx, dy);
      if (!this.smokeRingHits(wave.radius, smoke.waveWidth, v.radius, distance)) continue;
      wave.hitViruses |= bit;
      this.damageVirus(v, smoke.enemyDamage, -1, distance > 0.001 ? dx / distance : 1, distance > 0.001 ? dy / distance : 0, smoke.knockback);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      const bit = 1 << i;
      if (wave.hitSentries & bit) continue;
      const dx = s.x - cx;
      const dy = s.y - cy;
      const distance = Math.hypot(dx, dy);
      if (!this.smokeRingHits(wave.radius, smoke.waveWidth, s.radius, distance)) continue;
      wave.hitSentries |= bit;
      this.damageSentry(s, smoke.enemyDamage, -1, distance > 0.001 ? dx / distance : 1, distance > 0.001 ? dy / distance : 0, smoke.knockback);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      const bit = 1 << i;
      if (wave.hitErrors & bit) continue;
      const dx = e.x - cx;
      const dy = e.y - cy;
      const distance = Math.hypot(dx, dy);
      if (!this.smokeRingHits(wave.radius, smoke.waveWidth, CASCADING_ERROR.blockSize * 0.5, distance)) continue;
      wave.hitErrors |= bit;
      this.damageError(e, smoke.enemyDamage, -1, distance > 0.001 ? dx / distance : 1, distance > 0.001 ? dy / distance : 0);
    }
  }

  private keypadStateSolid(state: number): boolean {
    return state === KEYPAD_STATE.slam || state === KEYPAD_STATE.down || state === KEYPAD_STATE.rise;
  }

  /** A key cap is harmless in the air, then deletes whatever is under it on the slam. */
  private crushUnderKey(index: number): void {
    const kp = this.keypad;
    if (!kp) return;
    const key = kp.keys[index];
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive) continue;
      if (!circleRect(p.x, p.y, PLAYER.radius * p.shrink, key, hitScratch)) continue;
      this.damagePlayer(p, KEYPAD.playerDamage, -1, 0, -1, KEYPAD.knockback, SRC.KEYPAD, index);
    }
    if (this.mode === 'training' && this.drone.active && circleRect(this.drone.x, this.drone.y, this.drone.radius, key, hitScratch)) {
      this.damageDrone(KEYPAD.threatDamage, -1);
    }
    if (this.mode !== 'gauntlet') return;
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active && circleRect(s.x, s.y, s.radius, key, hitScratch)) {
        this.damageSentry(s, KEYPAD.threatDamage, -1, 0, -1);
      }
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (v.active && circleRect(v.x, v.y, v.radius, key, hitScratch)) {
        this.damageVirus(v, KEYPAD.threatDamage, -1, 0, -1);
      }
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (!e.active) continue;
      if (circleRect(e.x, e.y, CASCADING_ERROR.blockSize * 0.5, key, hitScratch)) {
        this.damageError(e, KEYPAD.threatDamage, -1, 0, -1);
      }
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      let hit = circleRect(w.x, w.y, w.hitR, key, hitScratch);
      for (let s = 0; s < w.segCount && !hit; s++) {
        hit = circleRect(w.segX[s], w.segY[s], w.segR, key, hitScratch);
      }
      if (hit) this.damageWorm(w, KEYPAD.threatDamage, -1, 0, -1);
    }
  }

  /** Push a body out of the solid footprint of a down key. */
  private pushBodyOutOfKeypad(body: { x: number; y: number }, radius: number): void {
    const kp = this.keypad;
    if (!kp) return;
    for (let i = 0; i < kp.keys.length; i++) {
      if (!this.keypadStateSolid(this.keypadStates[i])) continue;
      if (!circleRect(body.x, body.y, radius, kp.keys[i], hitScratch)) continue;
      body.x = hitScratch.px;
      body.y = hitScratch.py;
    }
  }

  /** The player cannot stand inside a key that is already down, even mid-dash. */
  private resolveKeypadPlayer(p: Player): void {
    const kp = this.keypad;
    if (!kp) return;
    const radius = PLAYER.radius * p.shrink;
    for (let i = 0; i < kp.keys.length; i++) {
      if (!this.keypadStateSolid(this.keypadStates[i])) continue;
      if (!circleRect(p.x, p.y, radius, kp.keys[i], hitScratch)) continue;
      p.x = hitScratch.px;
      p.y = hitScratch.py;
      const vn = p.vx * hitScratch.nx + p.vy * hitScratch.ny;
      if (vn < 0) {
        p.vx -= vn * hitScratch.nx;
        p.vy -= vn * hitScratch.ny;
      }
    }
  }

  /** Down caps are cover for threats too, unless they were already crushed on the slam. */
  private pushThreatsOffKeypad(): void {
    const kp = this.keypad;
    if (!kp) return;
    if (this.mode === 'training' && this.drone.active) this.pushBodyOutOfKeypad(this.drone, this.drone.radius);
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active) this.pushBodyOutOfKeypad(s, s.radius);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (v.active) this.pushBodyOutOfKeypad(v, v.radius);
    }
    for (let i = 0; i < this.errors.length; i++) {
      const e = this.errors[i];
      if (e.active) this.pushBodyOutOfKeypad(e, CASCADING_ERROR.blockSize * 0.5);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      this.pushBodyOutOfKeypad(w, w.hitR);
      for (let s = 0; s < w.segCount; s++) {
        const body = this.keypadBodyScratch;
        body.x = w.segX[s];
        body.y = w.segY[s];
        this.pushBodyOutOfKeypad(body, WORM.segmentRadius);
        w.segX[s] = body.x;
        w.segY[s] = body.y;
      }
    }
  }

  /** True while a shot or bomb is inside a cap that is currently solid cover. */
  private keypadCoverAt(x: number, y: number, radius: number): boolean {
    const kp = this.keypad;
    if (!kp) return false;
    for (let i = 0; i < kp.keys.length; i++) {
      if (!this.keypadStateSolid(this.keypadStates[i])) continue;
      if (circleRect(x, y, radius, kp.keys[i], hitScratch)) return true;
    }
    return false;
  }

  private keypadStopsProjectile(proj: Projectile): boolean {
    if (!this.keypadCoverAt(proj.x, proj.y, proj.radius)) return false;
    proj.active = false;
    this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 1);
    return true;
  }

  /** Ray distance to the first solid key cap. Used by beams and line-of-sight tests. */
  private keypadRayReach(ox: number, oy: number, dx: number, dy: number, max: number): number {
    const kp = this.keypad;
    if (!kp) return max;
    let best = max;
    for (let i = 0; i < kp.keys.length; i++) {
      if (!this.keypadStateSolid(this.keypadStates[i])) continue;
      const r = kp.keys[i];
      let tmin = 0;
      let tmax = best;
      if (Math.abs(dx) < 1e-6) {
        if (ox < r.x || ox > r.x + r.w) continue;
      } else {
        let t1 = (r.x - ox) / dx;
        let t2 = (r.x + r.w - ox) / dx;
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
        if (oy < r.y || oy > r.y + r.h) continue;
      } else {
        let t1 = (r.y - oy) / dy;
        let t2 = (r.y + r.h - oy) / dy;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }
      if (tmin >= 0 && tmin < best) best = tmin;
    }
    return best;
  }

  private keypadLineBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    return this.keypadRayReach(x1, y1, x2 - x1, y2 - y1, 1) < 1;
  }

  /** True when a pillar intersects the line between two points. Used by blast cover. */
  private lineBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    if (this.browser && this.browserLineBlocked(x1, y1, x2, y2)) return true;
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
    if (this.keypadLineBlocked(x1, y1, x2, y2)) return true;
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
      const rr = reach + w.hitR;
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
    if (proj.type === 15) return false;
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
        // A boss body can be thousands of units long, so a blast that lands on the chain
        // counts, not only one that lands on the head circle.
        let hitX = w.x;
        let hitY = w.y;
        let touching = Math.hypot(w.x - x, w.y - y) <= radius + w.hitR;
        for (let s = 0; s < w.segCount && !touching; s++) {
          if (Math.hypot(w.segX[s] - x, w.segY[s] - y) <= radius + w.segR) {
            touching = true;
            hitX = w.segX[s];
            hitY = w.segY[s];
          }
        }
        if (!touching) continue;
        // Mini-bosses fly over cover and past the lip. A floor line-of-sight test fails
        // on every off-map pass, so explosions never reached the Mega Worm at all.
        if (w.bossKind < 0 && this.lineBlocked(x, y, hitX, hitY)) continue;
        const dx = hitX - x;
        const dy = hitY - y;
        const dist = Math.hypot(dx, dy);
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        this.damageWorm(w, damage, sourceSlot, nx, ny, 0, hitX, hitY);
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

    // Feed pipes are fixtures, not bodies: a player blast chips them like a shot.
    if (sourceSlot >= 0) {
      for (let i = 0; i < this.pipes.length; i++) {
        const pipe = this.pipes[i];
        if (!pipe.active) continue;
        const dx = pipe.x - x;
        const dy = pipe.y - y;
        if (dx * dx + dy * dy > (radius + pipe.radius) ** 2) continue;
        this.damagePipe(pipe, NETWORK.pipeBlastDamage, pipe.x, pipe.y);
      }
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
      if (!b.fixed) this.launchProp(b, nx, ny, FILE_PROP.launchSpeed * 0.8);
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
      const rr = proj.radius + PLAYER.radius * p.shrink;
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
      if (w.mega) {
        if (this.megaBodyHit(w, proj.x, proj.y, proj.radius)) return true;
        continue;
      }
      const hdx = proj.x - w.x;
      const hdy = proj.y - w.y;
      const hr = proj.radius + w.hitR;
      if (hdx * hdx + hdy * hdy <= hr * hr) return true;
      for (let s = 0; s < w.segCount; s++) {
        const sdx = proj.x - w.segX[s];
        const sdy = proj.y - w.segY[s];
        const sr = proj.radius + w.segR;
        if (sdx * sdx + sdy * sdy <= sr * sr) return true;
      }
    }
    return false;
  }

  private damageDrone(amount: number, sourceSlot: number): void {
    amount = this.memoryDamage(sourceSlot, amount);
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
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].active && !this.players[i].copyClone) activePlayers++;
    }
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
    if (this.arena.disc) {
      const dx = d.x - this.centerX;
      const dy = d.y - this.centerY;
      const dist = Math.hypot(dx, dy);
      const max = this.arena.disc.radius - pad;
      if (dist > max) {
        d.x = this.centerX + (dx / dist) * max;
        d.y = this.centerY + (dy / dist) * max;
        this.pickDroneTarget();
      }
    } else {
      d.x = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, d.x));
      d.y = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, d.y));
    }
    for (let i = 0; i < this.solids.length; i++) {
      if (circleRect(d.x, d.y, d.radius, this.solids[i], hitScratch)) {
        d.x = hitScratch.px;
        d.y = hitScratch.py;
        this.pickDroneTarget();
      }
    }

    d.fireTimer -= dt;
    if (d.fireTimer <= 0) {
      const target = this.threatTarget(d.x, d.y);
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
      // A disc, USB or satellite arena's outer corners are void; never send the drone to one.
      if ((this.arena.disc || this.arena.usb || this.arena.satellite) && this.offFloor(x, y)) continue;
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
    if (this.arena.disc) {
      const dx = d.x - this.centerX;
      const dy = d.y - this.centerY;
      const dist = Math.hypot(dx, dy);
      const max = this.arena.disc.radius - d.radius - 4;
      if (dist > max) {
        d.x = this.centerX + (dx / dist) * max;
        d.y = this.centerY + (dy / dist) * max;
      }
    } else {
      d.x = Math.max(this.arena.bounds.left + d.radius, Math.min(this.arena.bounds.right - d.radius, d.x));
      d.y = Math.max(this.arena.bounds.top + d.radius, Math.min(this.arena.bounds.bottom - d.radius, d.y));
    }
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

  // Copy Pasta -------------------------------------------------------------------------------

  private clearCopyClones(): void {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].copyClone) this.despawnCopyClone(this.players[i]);
    }
  }

  private despawnCopyClone(p: Player): void {
    p.active = false;
    p.connected = false;
    p.alive = false;
    p.copyClone = false;
    p.copyDecoy = false;
    p.copyOwner = -1;
    p.copyT = 0;
  }

  /**
   * Copies the caster into the last open slot. The copy is a real Player body, so it
   * obeys the same movement, swing lock, dash charges and energy costs as a human; it
   * is excluded from room counts and round survival because it is a summon, not a slot.
   */
  private spawnCopyClone(p: Player): boolean {
    if (!p.alive || p.copyClone) return false;
    const slot = MAX_PLAYERS - 1;
    if (slot === p.slot) return false;
    const clone = this.players[slot];
    if (clone.active) return false;
    const sx = p.x - Math.cos(p.facing) * 34;
    const sy = p.y - Math.sin(p.facing) * 34;
    clearPlayerForSpawn(clone, sx, sy, p.facing);
    clone.active = true;
    clone.connected = true;
    clone.alive = true;
    clone.copyClone = true;
    clone.copyDecoy = false;
    clone.copyOwner = p.slot;
    clone.copyT = COPYPASTA.cloneLife;
    clone.program = p.program;
    clone.bugKind = p.bugKind;
    clone.name = 'COPY';
    clone.hp = COPYPASTA.cloneHp;
    clone.maxHp = COPYPASTA.cloneHp;
    clone.dashMax = PLAYER.dashCharges;
    clone.dashCharges = PLAYER.dashCharges;
    clone.iframes = 0.35;
    this.copyShootT = 0.25;
    this.copySwingT = 0;
    this.copyDashT = 0;
    this.emit(EV.BUG, p.slot, sx, sy, p.bugKind, Math.cos(p.facing), Math.sin(p.facing));
    return true;
  }

  /**
   * A dash leaves an inert copy at the takeoff point. It occupies a free summon slot
   * below the skill copy's reserved last slot, takes one hit, and never writes input.
   */
  private spawnDashDecoy(p: Player): boolean {
    if (!p.alive) return false;
    let slot = -1;
    for (let i = 1; i < MAX_PLAYERS - 1; i++) {
      if (!this.players[i].active) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return false;
    const decoy = this.players[slot];
    clearPlayerForSpawn(decoy, p.x, p.y, p.facing);
    decoy.active = true;
    decoy.connected = false;
    decoy.alive = true;
    decoy.copyClone = true;
    decoy.copyDecoy = true;
    decoy.copyOwner = p.slot;
    decoy.copyT = COPYPASTA.dashDecoyLife;
    decoy.program = p.program;
    decoy.bugKind = p.bugKind;
    decoy.name = 'COPY';
    decoy.maxHp = p.maxHp;
    decoy.hp = Math.min(COPYPASTA.dashDecoyHp, p.maxHp);
    decoy.dashMax = 0;
    decoy.dashCharges = 0;
    decoy.energy = 0;
    decoy.iframes = 0.12;
    return true;
  }

  /**
   * The copy's pilot. It hunts the nearest hostile threat in gauntlet modes and the
   * nearest other program in bot matches, then holds a ranged band and closes for the
   * shared lash. With nothing to fight it trails its owner instead of standing still.
   */
  private updateCopyClone(dt: number): void {
    for (let i = 0; i < this.players.length; i++) {
      const decoy = this.players[i];
      if (!decoy.active || !decoy.copyClone || !decoy.copyDecoy) continue;
      if (!decoy.alive) {
        this.despawnCopyClone(decoy);
        continue;
      }
      decoy.copyT -= dt;
      const owner = this.players[decoy.copyOwner];
      if (decoy.copyT <= 0 || !owner || !owner.active || !owner.alive) {
        this.despawnCopyClone(decoy);
      }
    }

    const f = this.copyFrame;
    f.mx = 0;
    f.my = 0;
    f.held = 0;
    f.pressed = 0;
    let clone: Player | null = null;
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].active && this.players[i].copyClone && !this.players[i].copyDecoy) {
        clone = this.players[i];
        break;
      }
    }
    if (!clone) return;
    if (!clone.alive) {
      this.despawnCopyClone(clone);
      return;
    }
    clone.copyT -= dt;
    const owner = this.players[clone.copyOwner];
    if (clone.copyT <= 0 || !owner || !owner.active || !owner.alive) {
      this.despawnCopyClone(clone);
      return;
    }
    this.copyPhase += dt;
    this.copyShootT = Math.max(0, this.copyShootT - dt);
    this.copySwingT = Math.max(0, this.copySwingT - dt);
    this.copyDashT = Math.max(0, this.copyDashT - dt);

    let tx = owner.x;
    let ty = owner.y;
    let found = false;
    let best = Infinity;
    if (this.mode === 'gauntlet') {
      // The virus thrall is a hostile player body, not a squadmate, so it is a copy
      // target even though the rest of the gauntlet player list is friendly.
      for (let i = 0; i < this.players.length; i++) {
        const t = this.players[i];
        if (!t.thrall || !t.active || !t.alive || t.copyClone) continue;
        const d2 = (t.x - clone.x) * (t.x - clone.x) + (t.y - clone.y) * (t.y - clone.y);
        if (d2 < best) {
          best = d2;
          tx = t.x;
          ty = t.y;
          found = true;
        }
      }
      for (let i = 0; i < this.sentries.length; i++) {
        const s = this.sentries[i];
        if (!s.active) continue;
        const d2 = (s.x - clone.x) * (s.x - clone.x) + (s.y - clone.y) * (s.y - clone.y);
        if (d2 < best) {
          best = d2;
          tx = s.x;
          ty = s.y;
          found = true;
        }
      }
      for (let i = 0; i < this.viruses.length; i++) {
        const v = this.viruses[i];
        if (!v.active) continue;
        const d2 = (v.x - clone.x) * (v.x - clone.x) + (v.y - clone.y) * (v.y - clone.y);
        if (d2 < best) {
          best = d2;
          tx = v.x;
          ty = v.y;
          found = true;
        }
      }
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (!w.active) continue;
        const d2 = (w.x - clone.x) * (w.x - clone.x) + (w.y - clone.y) * (w.y - clone.y);
        if (d2 < best) {
          best = d2;
          tx = w.x;
          ty = w.y;
          found = true;
        }
      }
      for (let i = 0; i < this.errors.length; i++) {
        const e = this.errors[i];
        if (!e.active) continue;
        const d2 = (e.x - clone.x) * (e.x - clone.x) + (e.y - clone.y) * (e.y - clone.y);
        if (d2 < best) {
          best = d2;
          tx = e.x;
          ty = e.y;
          found = true;
        }
      }
    } else {
      for (let i = 0; i < this.players.length; i++) {
        const t = this.players[i];
        if (!t.active || !t.alive || t.copyClone || t.slot === clone.slot || t.slot === clone.copyOwner) continue;
        if (t.cloakT > 0) continue;
        const d2 = (t.x - clone.x) * (t.x - clone.x) + (t.y - clone.y) * (t.y - clone.y);
        if (d2 < best) {
          best = d2;
          tx = t.x;
          ty = t.y;
          found = true;
        }
      }
    }

    let moveAngle: number;
    if (!found) {
      // Trail the owner off one shoulder. A copy with no target should still read as
      // part of the pair, not as a body parked in the middle of the floor.
      const side = clone.slot % 2 === 0 ? 1 : -1;
      tx = owner.x - Math.cos(owner.facing) * 62 - Math.sin(owner.facing) * 34 * side;
      ty = owner.y - Math.sin(owner.facing) * 62 + Math.cos(owner.facing) * 34 * side;
      const dx = tx - clone.x;
      const dy = ty - clone.y;
      moveAngle = Math.hypot(dx, dy) > 24 ? Math.atan2(dy, dx) : owner.facing;
    } else {
      const dx = tx - clone.x;
      const dy = ty - clone.y;
      const dist = Math.hypot(dx, dy) || 1;
      const aim = Math.atan2(dy, dx);
      moveAngle = aim;
      if (dist < COPYPASTA.cloneMelee && this.copySwingT <= 0) {
        f.pressed = ACTION.SWING;
        this.copySwingT = 0.55;
        moveAngle = aim;
      } else if (
        dist < COPYPASTA.cloneRange &&
        this.copyShootT <= 0 &&
        clone.autoFireT <= 0 &&
        clone.energy >= COPYPASTA.shotCost
      ) {
        f.pressed = ACTION.BOLT;
        this.copyShootT = COPYPASTA.attackCooldown;
        moveAngle = aim;
      } else if (dist > 360 && this.copyDashT <= 0 && clone.dashCharges > 0 && clone.dashCd <= 0) {
        f.pressed = ACTION.DASH;
        this.copyDashT = 1.2;
        moveAngle = aim;
      }
      // Hold a band instead of standing nose to nose: strafe around the target while
      // the next file is charging, and walk in only when it is too far to throw.
      if (dist > 95 && dist < 250) moveAngle = aim + Math.sin(this.copyPhase * 2.6 + clone.slot) * COPYPASTA.cloneOrbit;
    }
    const speed = found && best < 80 * 80 ? 0.45 : COPYPASTA.cloneSpeed;
    f.mx = Math.cos(moveAngle) * speed;
    f.my = Math.sin(moveAngle) * speed;
  }

  /**
   * The redaction super: every enemy in the burst gets a stack of red files that grows
   * over `markTime`, then the stack detonates. Cover blocks the application, not the
   * chase afterward; once a body is marked, the damage follows it around.
   */
  private fireCopyRedaction(p: Player): void {
    p.laserChargeHeld = false;
    p.laserChargeT = 0;
    p.chargeT = 0;
    p.chargeHeld = false;
    if (!p.alive || p.laserCd > 0) return;
    if (p.energy < COPYPASTA.powerCost) return;
    p.energy -= COPYPASTA.powerCost;
    p.laserCd = COPYPASTA.powerCooldown;
    p.lockActive = false;
    p.lockKind = 0;
    p.lockId = -1;
    p.comboStage = 0;
    p.comboT = 0;
    const r2 = COPYPASTA.markRadius * COPYPASTA.markRadius;
    for (let i = 0; i < this.players.length; i++) {
      const t = this.players[i];
      if (t === p || !t.active || !t.alive || t.copyClone) continue;
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      if (dx * dx + dy * dy > r2) continue;
      if (this.lineBlocked(p.x, p.y, t.x, t.y)) continue;
      this.addCopyMark(0, t.slot, p.slot, t.x, t.y);
    }
    if (this.mode === 'gauntlet') {
      for (let i = 0; i < this.sentries.length; i++) {
        const s = this.sentries[i];
        if (!s.active) continue;
        const dx = s.x - p.x;
        const dy = s.y - p.y;
        if (dx * dx + dy * dy > r2 || this.lineBlocked(p.x, p.y, s.x, s.y)) continue;
        this.addCopyMark(3, i, p.slot, s.x, s.y);
      }
      for (let i = 0; i < this.viruses.length; i++) {
        const v = this.viruses[i];
        if (!v.active) continue;
        const dx = v.x - p.x;
        const dy = v.y - p.y;
        if (dx * dx + dy * dy > r2 || this.lineBlocked(p.x, p.y, v.x, v.y)) continue;
        this.addCopyMark(2, i, p.slot, v.x, v.y);
      }
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (!w.active) continue;
        const dx = w.x - p.x;
        const dy = w.y - p.y;
        if (dx * dx + dy * dy > r2 || this.lineBlocked(p.x, p.y, w.x, w.y)) continue;
        this.addCopyMark(1, i, p.slot, w.x, w.y);
      }
      for (let i = 0; i < this.errors.length; i++) {
        const e = this.errors[i];
        if (!e.active) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy > r2 || this.lineBlocked(p.x, p.y, e.x, e.y)) continue;
        this.addCopyMark(4, i, p.slot, e.x, e.y);
      }
    }
    this.emit(EV.LASER, p.slot, p.x, p.y, p.facing);
  }

  private addCopyMark(kind: number, id: number, owner: number, x: number, y: number): void {
    for (let i = 0; i < this.copyMarks.length; i++) {
      const mark = this.copyMarks[i];
      if (mark.active) continue;
      mark.active = true;
      mark.kind = kind;
      mark.id = id;
      mark.owner = owner;
      mark.t = COPYPASTA.markTime;
      mark.count = 1;
      mark.x = x;
      mark.y = y;
      return;
    }
  }

  private updateCopyMarks(dt: number): void {
    for (let i = 0; i < this.copyMarks.length; i++) {
      const mark = this.copyMarks[i];
      if (!mark.active) continue;
      mark.t -= dt;
      let tx = mark.x;
      let ty = mark.y;
      let live = true;
      if (mark.kind === 0) {
        const p = this.players[mark.id];
        live = !!p && p.active && p.alive;
        if (live) {
          tx = p.x;
          ty = p.y;
        }
      } else if (mark.kind === 1) {
        const w = this.worms[mark.id];
        live = !!w && w.active;
        if (live) {
          tx = w.x;
          ty = w.y;
        }
      } else if (mark.kind === 2) {
        const v = this.viruses[mark.id];
        live = !!v && v.active;
        if (live) {
          tx = v.x;
          ty = v.y;
        }
      } else if (mark.kind === 3) {
        const s = this.sentries[mark.id];
        live = !!s && s.active;
        if (live) {
          tx = s.x;
          ty = s.y;
        }
      } else {
        const e = this.errors[mark.id];
        live = !!e && e.active;
        if (live) {
          tx = e.x;
          ty = e.y;
        }
      }
      if (!live) {
        mark.active = false;
        continue;
      }
      mark.x = tx;
      mark.y = ty;
      const progress = 1 - Math.max(0, mark.t) / COPYPASTA.markTime;
      mark.count = Math.max(1, Math.min(COPYPASTA.markIcons, 1 + Math.floor(progress * (COPYPASTA.markIcons - 1))));
      if (mark.t > 0) continue;
      mark.active = false;
      const src = this.players[mark.owner];
      let ux = 1;
      let uy = 0;
      if (src) {
        const dx = tx - src.x;
        const dy = ty - src.y;
        const d = Math.hypot(dx, dy) || 1;
        ux = dx / d;
        uy = dy / d;
      }
      if (mark.kind === 0) {
        const p = this.players[mark.id];
        if (p.active && p.alive) {
          this.damagePlayer(p, COPYPASTA.markPlayerDamage, mark.owner, ux, uy, COPYPASTA.markKnockback);
        }
      } else if (mark.kind === 1) {
        const w = this.worms[mark.id];
        if (w.active) this.damageWorm(w, COPYPASTA.markThreatDamage, mark.owner, ux, uy, COPYPASTA.markKnockback);
      } else if (mark.kind === 2) {
        const v = this.viruses[mark.id];
        if (v.active) this.damageVirus(v, COPYPASTA.markThreatDamage, mark.owner, ux, uy, COPYPASTA.markKnockback);
      } else if (mark.kind === 3) {
        const s = this.sentries[mark.id];
        if (s.active) this.damageSentry(s, COPYPASTA.markThreatDamage, mark.owner, ux, uy, COPYPASTA.markKnockback);
      } else {
        const e = this.errors[mark.id];
        if (e.active) this.damageError(e, COPYPASTA.markThreatDamage, mark.owner, ux, uy);
      }
      this.emit(EV.EXPLODE, mark.owner, tx, ty, 64);
    }
  }

  /** One file tears into a short fan. Only the parent splits; children die on impact. */
  private splitCopyShot(proj: Projectile): void {
    if (proj.variant >= 1) return;
    const speed = Math.hypot(proj.vx, proj.vy);
    const base = Math.atan2(proj.vy, proj.vx);
    for (let i = 0; i < COPYPASTA.splitCount; i++) {
      const lane = COPYPASTA.splitCount > 1 ? (i / (COPYPASTA.splitCount - 1)) * 2 - 1 : 0;
      this.spawnCopyShard(proj, base + lane * COPYPASTA.splitSpread, speed * COPYPASTA.splitSpeedMult);
    }
    this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 0);
  }

  private spawnCopyShard(source: Projectile, angle: number, speed: number): void {
    let proj: Projectile | null = null;
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) {
        proj = this.projectiles[i];
        break;
      }
    }
    if (!proj) return;
    // Clear the body that just tore: at 6 units the children spawned inside the
    // victim's hitbox and immediately re-hit it, which made every file a guaranteed
    // 3-damage burst instead of a chain. The extra reach is the seam the split reads on.
    const x = source.x + Math.cos(angle) * (source.radius + 26);
    const y = source.y + Math.sin(angle) * (source.radius + 26);
    proj.active = true;
    proj.serial = ++this.serial;
    proj.type = 16;
    proj.owner = source.owner;
    proj.x = x;
    proj.y = y;
    proj.prevX = x;
    proj.prevY = y;
    proj.vx = Math.cos(angle) * speed;
    proj.vy = Math.sin(angle) * speed;
    proj.radius = source.radius * 0.72;
    proj.damage = COPYPASTA.splitDamage;
    proj.deflects = 0;
    proj.bounces = 0;
    proj.fuse = COPYPASTA.splitTtl;
    proj.grace = 0;
    proj.armed = true;
    proj.blastRadius = 0;
    proj.blastKnockback = 0;
    proj.arcDur = 0;
    proj.hits = 0;
    proj.spin = 0;
    proj.spinDir = 1;
    proj.variant = 1;
    proj.orbOwner = -1;
    proj.orbA = 0;
    proj.orbR = 0;
    proj.orbDir = 1;
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
  }

  /**
   * Pickup loop. Definitions and weights live in powerups.ts; this only owns placement,
   * collection, and the duration timer. Adding content should not require touching it.
   */
  private updatePickups(dt: number): void {
    // A best time must not depend on a random powerup roll.
    if (this.infectionMode) return;
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
      // A pickup on a hole or past a lip is unreachable, and on the platter the hole can
      // drift away from it. Keep the drop on solid floor.
      if (this.offFloor(x, y)) continue;
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
   * Attract-mode setup: jump the endless sandbox to a deep wave and queue one of each
   * threat family for the opening edge bursts. The kiosk shows the same arrival rule as
   * a played gauntlet, so the room starts empty and the portals fill it. This is
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
    // Fill the room through the ingress queue. A single opening pack reads as an empty
    // level on a wide arena, and the demo exists to show the fight, not the walk to it.
    this.fillAttractRoom();
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
   * Demo-only top-up: queues each missing family through the same edge ingress as a
   * played gauntlet. The kiosk must not materialize threats around the squad; every
   * arrival has to read from a portal mouth. Error blocks are one colony arrival, then
   * the colony's own growth owns the rest of its cap.
   */
  private fillAttractRoom(): void {
    const p = this.players[0];
    if (!p || !p.active || !p.alive) return;

    let sentries = this.assaultQueued(0);
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) sentries++;
    const sentryNeed = Math.max(0, this.sentryLimit() - sentries);
    for (let i = 0; i < sentryNeed; i++) {
      // A portal burst can carry every silhouette; the normal pack picker still owns
      // pacing in a scored run, this top-up only restores the demo's density.
      this.queueAssault(0, i % 4, 1);
    }

    let worms = this.assaultQueued(1);
    for (let i = 0; i < this.worms.length; i++) {
      if (this.worms[i].active && this.worms[i].bossKind < 0) worms++;
    }
    const wormNeed = Math.max(0, this.wormLimit() - worms);
    for (let i = 0; i < wormNeed; i++) this.queueAssault(1, 0, 1);

    let viruses = this.assaultQueued(2);
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) viruses++;
    const virusNeed = Math.max(0, this.virusLimit() - viruses);
    for (let i = 0; i < virusNeed; i++) this.queueAssault(2, 0, 1);

    // An error colony is one arrival, then it grows outward on its own clock. Queueing
    // one block per cap slot would turn growth into a second spawner.
    let errors = this.assaultQueued(4);
    for (let i = 0; i < this.errors.length; i++) if (this.errors[i].active) errors++;
    if (errors === 0) {
      const burst = Math.min(GAUNTLET.errorBurst, this.errorLimit());
      if (burst > 0) this.queueAssault(4, 0, burst);
    }
  }

  /**
   * INFECTION loop. The swarm hunts across the whole arena and buds on a timer, and the
   * run ends the moment the last body is gone. Progress is derived from kills and live
   * bodies, so a split visibly sets the clear meter back instead of hiding the loss.
   */
  private updateInfection(dt: number): void {
    let alive = 0;
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) alive++;

    if (this.infectionStarted && alive === 0 && !this.infectionFailed) {
      this.infectionCleared = true;
      this.gauntletOver = true;
      return;
    }

    this.infectionGrowT -= dt;
    if (this.infectionGrowT <= 0) {
      this.infectionGrowT = INFECTION.growInterval;
      if (alive < this.virusLimit()) this.splitVirus();
    }

    for (let i = 0; i < this.viruses.length; i++) {
      if (this.viruses[i].active) this.updateVirus(this.viruses[i], dt);
    }
    if (this.usb) this.applyUsbThreats(dt);
    if (this.openWalls || this.arena.voids || this.arena.islands || this.arena.disc || this.satellite) {
      this.cullVoidThreats();
    }
  }

  private updateGauntlet(dt: number): void {
    this.gauntletT += dt;
    // Campaign rooms run only the bodies they authored. The gauntlet's wave ramp and
    // automatic packs would add a second, invisible spawner behind the ports (and keep
    // feeding the boss fight after the room was supposedly cleared).
    if (this.campaign) {
      if (this.waveBannerT > 0) this.waveBannerT = Math.max(0, this.waveBannerT - dt);
      if (this.portTotal > 0) this.updatePortals(dt);
      for (let i = 0; i < this.worms.length; i++) if (this.worms[i].active) this.updateWorm(this.worms[i], dt);
      this.separateIdleHands();
      for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) this.updateVirus(this.viruses[i], dt);
      for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) this.updateSentry(this.sentries[i], dt);
      for (let i = 0; i < this.firewalls.length; i++) if (this.firewalls[i].active) this.updateFirewall(this.firewalls[i], dt);
      this.updateErrors(dt);
      // NETWORK SWITCH is a campaign node too; its feed tubes and firewall starter must
      // keep running after the room becomes an authored assault.
      if (this.pipes.length > 0) this.updateNetwork(dt);
      return;
    }
    // The rush owns its own clock: no wave ramp, no assault queue, no network fixtures.
    if (this.bossRush) {
      this.updateBossRush(dt);
      return;
    }
    // Pipes feed both the normal sandbox and infection; the firewall starter is a
    // gauntlet-only set piece because infection has no firewall update pass.
    this.updateNetwork(dt);
    if (this.portTotal > 0) this.updatePortals(dt);
    if (this.infectionMode) {
      this.updateInfection(dt);
      return;
    }
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

    // Mini-boss gates. The schedule is data, so a harder level or a later wave can ask
    // for any registered mini-boss. Every gate uses the same edge ingress as the other
    // families: a boss is announced by a portal on the rim, never beside a body.
    // Attract starts at wave 72, which is the File Blob's repeat gate; the kiosk is
    // deliberately boss-free, and `?boss=1` spawns its chosen showcase directly.
    if (!this.campaign && !this.infectionMode && !this.gauntletPractice && !this.attractMode) {
      for (let i = 0; i < GAUNTLET.bossSchedule.length; i++) {
        const gate = GAUNTLET.bossSchedule[i];
        const since = this.wave - gate.wave;
        if (since < 0 || since % gate.repeatStep !== 0) continue;
        if (this.bossGateWave[i] === this.wave) continue;
        if (this.minibossLiveCount(gate.kind) > 0) continue;
        this.bossGateWave[i] = this.wave;
        this.queueAssault(3, gate.kind, 1);
      }
    }

    if (this.wave >= GAUNTLET.wormWave) {
      let wormCount = 0;
      for (let i = 0; i < this.worms.length; i++) {
        if (this.worms[i].active && this.worms[i].bossKind < 0) wormCount++;
      }
      if (wormCount < this.wormLimit()) {
        this.wormSpawnT -= dt;
        if (this.wormSpawnT <= 0) {
          this.queueAssault(1, 0, 1);
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
          this.queueAssault(2, 0, this.virusClusterCount());
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

    this.tickAssault(dt);
    let sentryCount = 0;
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) sentryCount++;
    if (sentryCount < this.sentryLimit() && this.assaultQueueCount === 0) {
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
    this.separateIdleHands();
    for (let i = 0; i < this.viruses.length; i++) if (this.viruses[i].active) this.updateVirus(this.viruses[i], dt);
    for (let i = 0; i < this.sentries.length; i++) if (this.sentries[i].active) this.updateSentry(this.sentries[i], dt);
    for (let i = 0; i < this.firewalls.length; i++) if (this.firewalls[i].active) this.updateFirewall(this.firewalls[i], dt);
    this.updateErrors(dt);
    if (this.usb) this.applyUsbThreats(dt);
    if (this.openWalls || this.arena.voids || this.arena.islands || this.arena.disc || this.satellite) {
      this.cullVoidThreats();
    }
  }

  /**
   * Keep a roaming family on the platter. The compactor's arena walls do this with the
   * rect clamp; a disc has no rect wall, so the rim is the bound. Holes are not handled
   * here: those still take a body, which is what makes the arm dangerous.
   */
  private containDiscThreats(): void {
    const disc = this.arena.disc;
    if (!disc) return;
    const cx = this.centerX;
    const cy = this.centerY;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      this.clampToDisc(w, w.hitR, cx, cy, disc.radius);
      for (let s = 0; s < w.segCount; s++) {
        let dx = w.segX[s] - cx;
        let dy = w.segY[s] - cy;
        const d = Math.hypot(dx, dy);
        const max = disc.radius - WORM.segmentRadius;
        if (d <= max || d < 1e-6) continue;
        dx /= d;
        dy /= d;
        w.segX[s] = cx + dx * max;
        w.segY[s] = cy + dy * max;
      }
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      // A pooled arrival is still outside the rim while it glides in.
      if (v.active && v.spawnT <= 0) this.clampToDisc(v, v.radius, cx, cy, disc.radius);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (s.active) this.clampToDisc(s, s.radius, cx, cy, disc.radius);
    }
  }

  /** Pulls one body centre back inside the rim and drops the outward velocity. */
  private clampToDisc(body: { x: number; y: number; kx: number; ky: number }, r: number, cx: number, cy: number, radius: number): void {
    let dx = body.x - cx;
    let dy = body.y - cy;
    const d = Math.hypot(dx, dy);
    const max = Math.max(1, radius - r - 4);
    if (d <= max) return;
    dx /= d || 1;
    dy /= d || 1;
    body.x = cx + dx * max;
    body.y = cy + dy * max;
    const out = body.kx * dx + body.ky * dy;
    if (out > 0) {
      body.kx -= out * dx;
      body.ky -= out * dy;
    }
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
      // Mini-boss bodies are not floor threats: they hover, fly over holes and past the
      // lip, and the floor cull would delete a whole boss mid-fight (Starfish over a
      // QUARANTINE void was the latest case). Environmental hazards still damage them
      // through their own paths; only the floor rule is skipped.
      if (w.bossKind >= 0) continue;
      if (this.offFloor(w.x, w.y)) this.damageWorm(w, 9999, 0, 0, 0);
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active || v.spawnT > 0) continue;
      if (this.offFloor(v.x, v.y)) this.damageVirus(v, 9999, 0, 0, 0);
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      if (this.offFloor(s.x, s.y)) this.damageSentry(s, 9999, 0, 0, 0);
    }
  }

  /**
   * The platter's read arm. It swings across the face on a slow sine, so a body in its
   * path is carried along the tangent and left with a shove. The arm never damages; the
   * fall does. Holes turn with the disc, so the safe route keeps changing underfoot.
   */
  private tickDisc(dt: number): void {
    const disc = this.arena.disc;
    if (!disc) return;
    const prev = this.armAngle;
    this.discT += dt;
    this.armAngle = discArmAngle(this.arena, this.discT);
    const dAng = this.armAngle - prev;
    if (Math.abs(dAng) < 1e-7) return;
    this.carryWithReader(disc, dAng);
  }

  /**
   * Test one body against the read arm. On contact, writes the separation and the shove
   * into the scratch fields. The arm is a line, so this stays cheap for every body.
   */
  private readerHit(x: number, y: number, radius: number, disc: DiscDef, dAng: number): boolean {
    const len = discArmLength(this.arena);
    const ux = Math.cos(this.armAngle);
    const uy = Math.sin(this.armAngle);
    const rx = x - this.armPivotX;
    const ry = y - this.armPivotY;
    let t = rx * ux + ry * uy;
    if (t < 0) t = 0;
    else if (t > len) t = len;
    let dx = x - (this.armPivotX + ux * t);
    let dy = y - (this.armPivotY + uy * t);
    let d = Math.hypot(dx, dy);
    const min = disc.arm.thickness * 0.5 + radius;
    if (d >= min) return false;
    if (d < 1e-4) {
      // Dead centre on the arm: push to the side the arm is sweeping away from.
      dx = -uy;
      dy = ux;
      d = 1;
    }
    const nx = dx / d;
    const ny = dy / d;
    this.armMoveX = nx * (min - d - 0.5) - uy * dAng * t;
    this.armMoveY = ny * (min - d - 0.5) + ux * dAng * t;
    // The tangential shove is a velocity, not another positional nudge, so the body
    // keeps travelling after the arm releases it.
    const side = dAng >= 0 ? 1 : -1;
    this.armShoveX = -uy * side * disc.arm.push;
    this.armShoveY = ux * side * disc.arm.push;
    return true;
  }

  /** Carries players, worms, viruses and sentries with one arm pass. */
  private carryWithReader(disc: DiscDef, dAng: number): void {
    const pr = PLAYER.radius;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.travelT > 0 || p.fallT > 0) continue;
      if (!this.readerHit(p.x, p.y, pr, disc, dAng)) continue;
      p.x += this.armMoveX;
      p.y += this.armMoveY;
      p.kx = this.armShoveX;
      p.ky = this.armShoveY;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      if (!this.readerHit(w.x, w.y, w.hitR, disc, dAng)) continue;
      w.x += this.armMoveX;
      w.y += this.armMoveY;
      w.kx = this.armShoveX;
      w.ky = this.armShoveY;
    }
    for (let i = 0; i < this.viruses.length; i++) {
      const v = this.viruses[i];
      if (!v.active) continue;
      if (!this.readerHit(v.x, v.y, v.radius, disc, dAng)) continue;
      v.x += this.armMoveX;
      v.y += this.armMoveY;
      v.kx = this.armShoveX;
      v.ky = this.armShoveY;
    }
    for (let i = 0; i < this.sentries.length; i++) {
      const s = this.sentries[i];
      if (!s.active) continue;
      if (!this.readerHit(s.x, s.y, s.radius, disc, dAng)) continue;
      s.x += this.armMoveX;
      s.y += this.armMoveY;
      s.kx = this.armShoveX;
      s.ky = this.armShoveY;
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
      if (b.hurtCd && b.hurtCd > 0) b.hurtCd = Math.max(0, b.hurtCd - dt);
      if (b.dropT > 0) {
        b.dropT = Math.max(0, b.dropT - dt);
        continue;
      }
      if (!b.active || b.fixed) continue;
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
    if ((this.openWalls || this.arena.voids || this.arena.islands || this.arena.slant || this.arena.disc || this.satellite) && this.offFloor(cx, cy)) {
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
        const reach = p.guardReach + Math.max(b.w, b.h) * 0.5;
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
      if (b.hazard && (b.hurtCd ?? 0) <= 0) {
        b.hurtCd = NETWORK.fileHurtCooldown;
        b.hitFlash = FILE_PROP.hitFlash;
        this.damagePlayer(p, NETWORK.fileDamage, -1, -ux, -uy, NETWORK.fileKnockback, SRC.PIPE, this.props.indexOf(b));
      }
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
      if (!a.active || a.dropT > 0 || a.fixed) continue;
      for (let j = i + 1; j < this.props.length; j++) {
        const c = this.props[j];
        if (!c.active || c.dropT > 0 || c.fixed) continue;
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
    // Capacitors and mounted hardware are not loose debris: a lash damages them in place.
    if (b.capacitor || b.fixed) return;
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
      if (w.y > front + w.hitR) continue;
      w.y = Math.min(bottom - w.hitR, front + w.hitR);
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

  /** Queued arrivals in one family; the kiosk top-up uses this so it never overfills. */
  private assaultQueued(family: number): number {
    let n = 0;
    for (let i = this.assaultQueueIndex; i < this.assaultQueueCount; i++) {
      if (this.assaultFamily[i] === family) n++;
    }
    return n;
  }

  /** Queue one family member for the next edge burst. */
  private queueAssault(family: number, kind: number, count: number): void {
    for (let i = 0; i < count && this.assaultQueueCount < this.assaultFamily.length; i++) {
      this.assaultFamily[this.assaultQueueCount] = family;
      this.assaultKind[this.assaultQueueCount] = kind;
      this.assaultQueueCount++;
    }
  }

  /**
   * Pick an ingress point on an arena edge, as far from the player as the floor allows.
   * Edge arrivals are the point: a body can read which side is live instead of being
   * handed a squad in its own footprint. Returns null when no edge point is clear enough.
   */
  private assaultPoint(): { x: number; y: number } | null {
    const cfg = GAUNTLET.assault;
    const b = this.arena.bounds;
    const p = this.players[0];
    const inset = cfg.edgeInset;
    let bestX = 0;
    let bestY = 0;
    let bestD = -1;
    for (let edge = 0; edge < 4; edge++) {
      for (let attempt = 0; attempt < 6; attempt++) {
        let x = 0;
        let y = 0;
        if (edge === 0) {
          x = this.rng.range(b.left + inset, b.right - inset);
          y = b.top + inset;
        } else if (edge === 1) {
          x = this.rng.range(b.left + inset, b.right - inset);
          y = b.bottom - inset;
        } else if (edge === 2) {
          x = b.left + inset;
          y = this.rng.range(b.top + inset, b.bottom - inset);
        } else {
          x = b.right - inset;
          y = this.rng.range(b.top + inset, b.bottom - inset);
        }
        if (!this.pointClearOfCover(x, y, cfg.half + 14)) continue;
        const d = p.alive ? Math.hypot(x - p.x, y - p.y) : Infinity;
        if (d < cfg.playerClear) continue;
        if (d > bestD) {
          bestD = d;
          bestX = x;
          bestY = y;
        }
      }
    }
    return bestD < 0 ? null : { x: bestX, y: bestY };
  }

  /** Spawn one queued request at an edge portal, fanned across its mouth. */
  private emitAssault(portal: AssaultPortal): void {
    if (this.assaultQueueIndex >= this.assaultQueueCount) return;
    const family = this.assaultFamily[this.assaultQueueIndex];
    const kind = this.assaultKind[this.assaultQueueIndex];
    const lane = portal.emitted;
    this.assaultQueueIndex++;
    portal.emitted++;
    const b = this.arena.bounds;
    let ux = (b.left + b.right) * 0.5 - portal.x;
    let uy = (b.top + b.bottom) * 0.5 - portal.y;
    const len = Math.hypot(ux, uy) || 1;
    ux /= len;
    uy /= len;
    const fan = portal.count > 1
      ? ((lane + 0.5) / portal.count - 0.5) * portal.half * 2.4
      : 0;
    const inward = 20 + (lane % 2) * 10;
    const jitter = family === 4 ? 2 : GAUNTLET.assault.spread;
    const x = portal.x + ux * inward - uy * fan + this.rng.range(-jitter, jitter);
    const y = portal.y + uy * inward + ux * fan + this.rng.range(-jitter, jitter);
    if (family === 0) this.spawnSentry(kind as 0 | 1 | 2 | 3, x, y, true);
    else if (family === 1) this.spawnWorm(x, y);
    else if (family === 2) this.spawnVirus(x, y);
    else if (family === 3) this.spawnMiniboss(kind, x, y);
    else if (family === 4) this.spawnErrorAt(x, y);
    this.emit(EV.PROP_HIT, 0, portal.x, portal.y, 1);
  }

  /** Advance open portals and open one when the queue has arrivals waiting. */
  private tickAssault(dt: number): void {
    let live = 0;
    for (let i = 0; i < this.assaultPortals.length; i++) {
      const portal = this.assaultPortals[i];
      if (!portal.active) continue;
      live++;
      portal.t += dt;
      // The whole group leaves together. A portal is a burst, not a dispenser.
      if (portal.t >= portal.openDur && portal.emitted < portal.count) {
        while (portal.emitted < portal.count && this.assaultQueueIndex < this.assaultQueueCount) {
          this.emitAssault(portal);
        }
      }
      if (portal.t >= portal.openDur + portal.burstHold + portal.closeDur) {
        portal.active = false;
        live--;
      }
    }

    if (this.assaultQueueIndex >= this.assaultQueueCount) {
      this.assaultQueueCount = 0;
      this.assaultQueueIndex = 0;
      return;
    }
    if (this.assaultCooldown > 0) {
      this.assaultCooldown = Math.max(0, this.assaultCooldown - dt);
      return;
    }
    const cfg = GAUNTLET.assault;
    if (live >= cfg.maxPortals) return;
    let slot: AssaultPortal | null = null;
    for (let i = 0; i < this.assaultPortals.length; i++) {
      if (!this.assaultPortals[i].active) {
        slot = this.assaultPortals[i];
        break;
      }
    }
    if (!slot) return;
    const point = this.assaultPoint();
    if (!point) return;
    const batch = Math.min(cfg.burstMax, this.assaultQueueCount - this.assaultQueueIndex);
    slot.active = true;
    slot.x = point.x;
    slot.y = point.y;
    slot.half = cfg.half;
    slot.t = 0;
    slot.openDur = cfg.openTime;
    slot.burstHold = cfg.burstHold;
    slot.closeDur = cfg.closeTime;
    slot.count = batch;
    slot.emitted = 0;
    this.assaultCooldown = cfg.cooldown;
  }

  /**
   * Queue one pack for an edge ingress burst. The silhouettes arrive together at the
   * portal mouth, so a new wave never dumps a firing squad around the player.
   */
  private spawnSentryPack(): void {
    const room = Math.max(0, this.sentryLimit() - this.sentryLiveCount());
    if (room <= 0) return;
    const group = Math.min(2, room);
    const pack = this.sentryPack++;
    if (!this.gauntletPractice && this.wave <= SENTRY.openingWaves) {
      // Two pulse squares open the run, so a wide arena does not read as empty.
      this.queueAssault(0, 0, group);
    } else if (!this.gauntletPractice && this.wave < GAUNTLET.triplexWave) {
      this.queueAssault(0, 0, group);
    } else if (!this.gauntletPractice && this.wave < GAUNTLET.homingWave) {
      this.queueAssault(0, (pack & 1) === 0 ? 0 : 1, group);
    } else if (!this.gauntletPractice && this.wave < GAUNTLET.flockWave) {
      const lane = pack % 3;
      this.queueAssault(0, lane === 0 ? 0 : lane === 1 ? 1 : 2, group);
    } else {
      const lane = pack & 3;
      if (lane === 3) this.queueAssault(0, 3, Math.min(SENTRY.flockSize, room));
      else this.queueAssault(0, lane, group);
    }
  }

  private spawnSentry(kind: 0 | 1 | 2 | 3, anchorX: number, anchorY: number, burst = false): boolean {
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
      x = anchorX + this.rng.range(burst ? -24 : -150, burst ? 24 : 150);
      y = anchorY + this.rng.range(burst ? -24 : -110, burst ? 24 : 110);
      if (this.sentryClear(x, y, radius, burst ? 110 : 240)) {
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
    s.stunT = 0;
    return true;
  }

  private sentryClear(x: number, y: number, radius: number, playerClear = 240): boolean {
    if (!this.pointClearOfCover(x, y, radius)) return false;
    const p = this.players[0];
    return !p.alive || Math.hypot(x - p.x, y - p.y) > playerClear;
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
    // Nothing spawns over a hole or off an open floor: threats, patrol points and
    // pickups all use this test.
    if (this.offFloor(x, y)) return false;
    for (let i = 0; i < this.solids.length; i++) {
      if (circleRect(x, y, radius + 4, this.solids[i], hitScratch)) return false;
    }
    return true;
  }

  /**
   * Nearest body a gauntlet threat will attack. An afterimage is a valid target; the
   * fighting copy is not, so a summon cannot pull the room off the player.
   */
  private threatTarget(x: number, y: number): Player {
    let best = this.players[0];
    let bestD2 = Infinity;
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.cloakT > 0 || p.thrall || p.travelT > 0) continue;
      if (p.copyClone && !p.copyDecoy) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = p;
      }
    }
    return best;
  }

  /** Fly, keep a range band, and fire. Cover blocks both shots and movement. */
  private updateSentry(s: Sentry, dt: number): void {
    s.prevX = s.x;
    s.prevY = s.y;
    s.phase += dt;
    if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt);
    if (s.stunT > 0) {
      s.stunT = Math.max(0, s.stunT - dt);
      s.ramT = 0;
      s.vx = 0;
      s.vy = 0;
      s.x += s.kx * dt;
      s.y += s.ky * dt;
      s.kx *= Math.exp(-WORM.knockDrag * dt);
      s.ky *= Math.exp(-WORM.knockDrag * dt);
      return;
    }
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

    const p = this.threatTarget(s.x, s.y);
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
    type: 3 | 4 | 18 | 19 | 20,
    ttl: number,
    srcId = -1,
    variant = 0,
    srcKind: number = SRC.SENTRY,
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
    proj.srcKind = srcKind;
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
    proj.variant = variant;
    proj.orbOwner = -1;
    proj.orbA = 0;
    proj.orbR = 0;
    proj.orbDir = 1;
    proj.lightning = type === 19;
    this.emit(EV.SENTRY_SHOOT, -1, x, y, angle);
  }

  private damageSentry(s: Sentry, amount: number, sourceSlot: number, dirX: number, dirY: number, force = 0): void {
    amount = this.memoryDamage(sourceSlot, amount);
    if (!s.active) return;
    // A dormant or still-opening calibration subject absorbs every hit. The Warden's
    // orientation itself asks the player to fire, so waking on that first hit cut the
    // lesson short and let a held burst clear the class before it could fight. The
    // campaign script owns the wake; damage only lands after every eye is open.
    if (
      s.kind >= 4 &&
      s.kind <= 6 &&
      this.campaignPhase === 'calibration' &&
      (s.shapeState <= 1 || this.calibrationWakeInProgress())
    ) {
      s.hitFlash = 0.18;
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
      if (this.errorSpawnT <= 0) {
        // Campaign levels author a direct colony. Every wave arrival, including the
        // kiosk's, comes out of an edge portal instead.
        if (this.campaign) this.spawnErrorColony();
        else this.queueErrorColony();
      }
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
    if (this.offFloor(x, y)) return false;
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

  /** Queue a cascading-error colony for the next edge burst. */
  private queueErrorColony(): void {
    this.errorSpawnT = CASCADING_ERROR.reseedDelay;
    this.queueAssault(4, 0, Math.max(1, Math.min(GAUNTLET.errorBurst, this.errorLimit())));
  }

  /**
   * Direct seed for authored campaign levels. The gauntlet and kiosk queue
   * `queueErrorColony`, so their first blocks come out of an edge portal instead.
   */
  private spawnErrorColony(): void {
    const anchor = this.arena.spawns[this.farSpawnIndex()];
    let x = anchor.x;
    let y = anchor.y;
    for (let attempt = 0; attempt < 12; attempt++) {
      x = anchor.x + this.rng.range(-CASCADING_ERROR.seedJitter, CASCADING_ERROR.seedJitter);
      y = anchor.y + this.rng.range(-CASCADING_ERROR.seedJitter, CASCADING_ERROR.seedJitter);
      if (this.errorFree(x, y)) break;
    }
    if (!this.spawnErrorAt(x, y)) return;
    this.errorSpawnT = CASCADING_ERROR.reseedDelay;
    this.errorGrowT = this.gauntletInterval(
      CASCADING_ERROR.growthInterval,
      CASCADING_ERROR.growthMinInterval,
    );
  }

  /** Place one error block at an ingress point. Never falls back to the arena centre. */
  private spawnErrorAt(x: number, y: number): boolean {
    const e = this.firstFreeError();
    if (!e) return false;
    let px = x;
    let py = y;
    if (!this.errorFree(px, py)) {
      let clear = false;
      for (let attempt = 0; attempt < 16; attempt++) {
        const angle = (attempt / 16) * Math.PI * 2;
        const dist = CASCADING_ERROR.cell * (0.55 + Math.floor(attempt / 8) * 0.55);
        px = x + Math.cos(angle) * dist;
        py = y + Math.sin(angle) * dist;
        if (this.errorFree(px, py)) {
          clear = true;
          break;
        }
      }
      if (!clear) return false;
    }
    e.active = true;
    e.x = e.prevX = px;
    e.y = e.prevY = py;
    e.originX = e.targetX = px;
    e.originY = e.targetY = py;
    e.growT = 0;
    e.hp = e.maxHp = CASCADING_ERROR.hp;
    e.hitFlash = 0;
    e.touchCd = 0;
    e.phase = this.rng.range(0, Math.PI * 2);
    e.spawnT = CASCADING_ERROR.spawnTime;
    this.errorGrowT = this.gauntletInterval(
      CASCADING_ERROR.growthInterval,
      CASCADING_ERROR.growthMinInterval,
    );
    this.emit(EV.ERROR_SPAWN, -1, px, py, CASCADING_ERROR.blockSize);
    return true;
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
    amount = this.memoryDamage(sourceSlot, amount);
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

  private spawnWorm(x?: number, y?: number, held = false): Worm | null {
    let w: Worm | null = null;
    for (let i = 0; i < this.worms.length; i++) {
      if (!this.worms[i].active) {
        w = this.worms[i];
        break;
      }
    }
    if (!w) return null;
    const spawn = x !== undefined && y !== undefined ? { x, y } : this.arena.spawns[this.wormAnchorIndex()];
    w.active = true;
    w.mega = false;
    w.bossKind = -1;
    w.hand = null;
    w.starfish = null;
    w.armState = null;
    w.blob = null;
    w.storm = null;
    w.user = null;
    w.held = held;
    // A pooled slot may have carried a boss. Reset the radii with the body, or a normal
    // worm inherits a 138-unit hit circle from the Mega Worm that last used the slot.
    w.hitR = WORM.headRadius;
    w.segR = WORM.segmentRadius;
    w.legs = false;
    w.eyeT = 0;
    w.whipT = 0;
    w.acidT = 0;
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
    w.spawnT = held ? 0 : WORM.spawnTime;
    w.pinT = 0;
    w.biteT = 0;
    w.biteCd = WORM.biteCooldown * 0.5;
    w.biteHit = false;
    w.biteDirX = Math.cos(w.angle);
    w.biteDirY = Math.sin(w.angle);
    w.dashT = 0;
    w.dashCd = 0;
    w.dashHit = false;
    w.dashDirX = Math.cos(w.angle);
    w.dashDirY = Math.sin(w.angle);
    w.stunT = 0;
    if (held) {
      w.patrolX = w.x;
      w.patrolY = w.y;
      w.retargetT = 0;
    } else {
      this.pickWormPatrol(w);
    }
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
      w.segHp[i] = WORM.segmentHp;
      w.segMaxHp[i] = WORM.segmentHp;
    }
    return w;
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



  // --- Idle Hands ----------------------------------------------------------
  //
  // Three floating palms are one boss. They live in the worm pool as boss bodies with
  // no chain (`segCount` 0), so every weapon, blast, beam and bot scan that already
  // walks `world.worms` reaches them without a second collision system.

  /** The palms spawn on a ring around the ingress point; `hands` is tuning. */
  private spawnIdleHands(x: number, y: number): Worm | null {
    const cfg = IDLE_HANDS;
    const group = ++this.handGroup;
    const base = this.rng.range(0, Math.PI * 2);
    let first: Worm | null = null;
    for (let k = 0; k < cfg.hands; k++) {
      let w: Worm | null = null;
      for (let i = 0; i < this.worms.length; i++) {
        if (!this.worms[i].active) {
          w = this.worms[i];
          break;
        }
      }
      if (!w) break;
      const a = base + (k / cfg.hands) * Math.PI * 2;
      // The arrival ring scales with the body, so two 126-radius hands
      // do not spawn inside each other. Keep it wide but front/side only: the
      // hands are a floor fight, not an overhead canopy.
      const front = Math.max(0, Math.sin(a));
      const side = Math.cos(a) >= 0 ? 1 : -1;
      const sx = x + (front > 0 ? Math.cos(a) : side) * 390;
      const sy = y + cfg.spawnYOffset + front * cfg.spawnRingY;
      w.active = true;
      w.mega = false;
      w.bossKind = MINIBOSS.IDLE_HANDS;
      w.held = false;
      w.hitR = cfg.radius;
      w.segR = cfg.radius * 0.6;
      w.segCount = 0;
      w.shrink = 1;
      w.x = Math.max(this.arena.bounds.left + cfg.radius * 0.5, Math.min(this.arena.bounds.right - cfg.radius * 0.5, sx));
      w.y = Math.max(this.arena.bounds.top + cfg.radius * 0.5, Math.min(this.arena.bounds.bottom - cfg.radius * 0.5, sy));
      w.prevX = w.x;
      w.prevY = w.y;
      w.vx = 0;
      w.vy = 0;
      w.kx = 0;
      w.ky = 0;
      w.angle = Math.atan2(this.centerY - w.y, this.centerX - w.x);
      w.phase = this.rng.range(0, Math.PI * 2);
      w.hp = cfg.hp;
      w.maxHp = cfg.hp;
      w.spawnT = cfg.introTime;
      w.hitFlash = 0;
      w.touchCd = 0;
      w.pinT = 0;
      w.infected = false;
      w.biteT = 0;
      w.legs = false;
      w.eyeT = 0;
      w.whipT = 0;
      w.acidT = 0;
      w.anchorX = w.x;
      w.anchorY = w.y;
      w.hand = {
        state: 0,
        t: 0,
        cd: 1.1 + k * 0.45,
        hitCd: 0,
        hitMask: 0,
        dirX: Math.cos(w.angle),
        dirY: Math.sin(w.angle),
        slamX: w.x,
        slamY: w.y,
        fromX: w.x,
        fromY: w.y,
        eyeT: 1.2,
        bob: this.rng.range(0, Math.PI * 2),
        group,
      };
      if (!first) first = w;
    }
    this.emit(EV.PROP_BREAK, -1, x, y, 40);
    return first;
  }

  private updateIdleHand(w: Worm, dt: number): void {
    const cfg = IDLE_HANDS;
    const h = w.hand;
    if (!h) return;
    w.prevX = w.x;
    w.prevY = w.y;
    w.phase += dt;
    if (w.hitFlash > 0) w.hitFlash = Math.max(0, w.hitFlash - dt);
    if (w.eyeT > 0) w.eyeT = Math.max(0, w.eyeT - dt);
    if (h.cd > 0) h.cd = Math.max(0, h.cd - dt);
    if (h.hitCd > 0) h.hitCd = Math.max(0, h.hitCd - dt);
    if (h.eyeT > 0) h.eyeT = Math.max(0, h.eyeT - dt);
    if (w.kx !== 0 || w.ky !== 0) {
      w.x += w.kx * dt;
      w.y += w.ky * dt;
      w.kx *= Math.exp(-cfg.knockDrag * dt);
      w.ky *= Math.exp(-cfg.knockDrag * dt);
    }
    if (w.spawnT > 0) {
      w.spawnT = Math.max(0, w.spawnT - dt);
      return;
    }
    if (w.pinT > 0) {
      w.pinT = Math.max(0, w.pinT - dt);
      return;
    }

    const p = this.threatTarget(w.x, w.y);
    const pdx = p.x - w.x;
    const pdy = p.y - w.y;
    const dist = Math.hypot(pdx, pdy) || 1;
    h.t += dt;

    if (h.state === 7) {
      // A redirected hand has slammed into its partner. Both hands spin away
      // under their knock velocity and cannot act until the lockout ends.
      if (h.t >= cfg.charge.stunTime) {
        h.state = 0;
        h.t = 0;
        h.cd = cfg.charge.cooldown * 0.5;
      }
    } else if (h.state === 0) {
      // Hover at a working distance: close in on a far player, give ground when crowded.
      const orbit = Math.min(cfg.orbitMax, Math.max(cfg.orbitMin, dist));
      const ang = Math.atan2(w.y - p.y, w.x - p.x) + Math.sin(w.phase * 0.42 + h.bob) * 0.22;
      // A hand behind the player is steered to the nearest side; a front hand stays
      // in the lower half. This keeps the palm from sitting over the player's sprite
      // and gives every tell a clear silhouette to track.
      const front = Math.max(0, Math.sin(ang));
      const side = Math.cos(ang) >= 0 ? 1 : -1;
      const tx = p.x + (front > 0 ? Math.cos(ang) : side) * orbit;
      const ty = p.y + orbit * (cfg.orbitYSide + front * cfg.orbitYFront);
      const dx = tx - w.x;
      const dy = ty - w.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = Math.min(cfg.driftSpeed, d * 2.2);
      w.x += (dx / d) * speed * dt;
      w.y += (dy / d) * speed * dt;
      w.angle = Math.atan2(p.y - w.y, p.x - w.x);
      if (h.cd <= 0 && p.alive && p.cloakT <= 0) {
        const canSlam = dist <= cfg.slam.range;
        const canCharge = dist <= cfg.charge.range && !this.lineBlocked(w.x, w.y, p.x, p.y);
        if (canSlam || canCharge) {
          if (canSlam && (!canCharge || this.rng.next() < 0.6)) {
            // The ground point is latched at the start of the tell, so stepping out
            // of the ring is the counterplay.
            h.state = 1;
            h.t = 0;
            h.slamX = p.x;
            h.slamY = p.y;
            h.eyeT = cfg.slam.windup + cfg.slam.drop;
          } else {
            h.state = 4;
            h.t = 0;
            h.dirX = pdx / dist;
            h.dirY = pdy / dist;
            h.hitMask = 0;
            h.eyeT = cfg.charge.windup;
          }
        }
      }
    } else if (h.state === 1) {
      if (h.t >= cfg.slam.windup) {
        h.state = 2;
        h.t = 0;
        h.fromX = w.x;
        h.fromY = w.y;
      }
    } else if (h.state === 2) {
      const u = Math.min(1, h.t / cfg.slam.drop);
      w.x = h.fromX + (h.slamX - h.fromX) * u;
      w.y = h.fromY + (h.slamY - h.fromY) * u;
      if (u >= 1) {
        h.state = 3;
        h.t = 0;
        this.slamImpact(w);
      }
    } else if (h.state === 3) {
      // Palm-down hold first, then the rise-out. The hold is the punish window: the
      // body is stopped and fully hittable, so a slam gives the player something to
      // shoot instead of snapping back to hover the moment it lands.
      if (h.t >= cfg.slam.hold + cfg.slam.recover) {
        h.state = 0;
        h.t = 0;
        h.cd = cfg.slam.cooldown;
      }
    } else if (h.state === 4) {
      w.angle = Math.atan2(h.dirY, h.dirX);
      if (h.t >= cfg.charge.windup) {
        h.state = 5;
        h.t = 0;
        h.hitMask = 0;
      }
    } else if (h.state === 5) {
      w.x += h.dirX * cfg.charge.speed * dt;
      w.y += h.dirY * cfg.charge.speed * dt;
      w.angle = Math.atan2(h.dirY, h.dirX);
      if (h.hitCd <= 0) {
        for (let i = 0; i < this.players.length; i++) {
          const other = this.players[i];
          if (!other.active || !other.alive || other.cloakT > 0) continue;
          if ((h.hitMask & (1 << i)) !== 0) continue;
          const dx = other.x - w.x;
          const dy = other.y - w.y;
          const rr = w.hitR + PLAYER.radius;
          if (dx * dx + dy * dy > rr * rr) continue;
          const d = Math.hypot(dx, dy) || 1;
          h.hitMask |= 1 << i;
          h.hitCd = cfg.contactCooldown;
          this.damagePlayer(
            other,
            cfg.charge.damage,
            -1,
            dx / d,
            dy / d,
            cfg.charge.knockback,
            SRC.WORM,
            this.worms.indexOf(w),
          );
        }
      }
      if (h.t >= cfg.charge.dashTime) {
        h.state = 0;
        h.t = 0;
        h.cd = cfg.charge.cooldown;
      }
    } else if (h.state === 6) {
      w.x += h.dirX * cfg.charge.deflectSpeed * dt;
      w.y += h.dirY * cfg.charge.deflectSpeed * dt;
      for (let i = 0; i < this.worms.length; i++) {
        const other = this.worms[i];
        if (other === w || !other.active || other.bossKind !== w.bossKind) continue;
        const dx = other.x - w.x;
        const dy = other.y - w.y;
        const rr = w.hitR + other.hitR;
        if (dx * dx + dy * dy > rr * rr) continue;
        const d = Math.hypot(dx, dy) || 1;
        const nx = dx / d;
        const ny = dy / d;
        // The redirected hand is the weapon: the partner takes the big hit.
        this.damageHand(other, cfg.charge.deflectDamage, 0, nx, ny, 600);
        this.damageHand(w, 3, 0, -nx, -ny, 0);
        this.emit(EV.EXPLODE, -1, w.x, w.y, 70);
        // Both bodies recoil apart and spin for the stun window instead of one
        // simply resetting to hover. This is the boss's real punish window.
        if (other.active && other.hand) {
          other.hand.state = 7;
          other.hand.t = 0;
          other.kx += nx * cfg.charge.stunKnockback;
          other.ky += ny * cfg.charge.stunKnockback;
        }
        if (w.active) {
          h.state = 7;
          h.t = 0;
          w.kx -= nx * cfg.charge.stunKnockback;
          w.ky -= ny * cfg.charge.stunKnockback;
        }
        break;
      }
      if (w.active && h.state === 6 && h.t >= cfg.charge.deflectLife) {
        h.state = 0;
        h.t = 0;
        h.cd = cfg.charge.cooldown * 0.5;
      }
    }

    // Floating bodies ignore cover; the arena wall still stops them, and a charge
    // that meets it ends there rather than grinding along the edge.
    const pad = this.bossEdgePad(w);
    const bx = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, w.x));
    const by = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, w.y));
    if ((h.state === 5 || h.state === 6) && (bx !== w.x || by !== w.y)) {
      const wasCharge = h.state === 5;
      h.state = 0;
      h.t = 0;
      h.cd = wasCharge ? cfg.charge.cooldown : 0.8;
    }
    w.x = bx;
    w.y = by;
  }

  /**
   * Keep the pair from collapsing into one silhouette while they hover. Attack states
   * are exempt: a slam is a committed path, and the charge redirect needs two bodies
   * to meet. The margin is wider than two hitboxes because the palm glyph reads wider
   * than its collision circle.
   */
  private separateIdleHands(): void {
    const min = IDLE_HANDS.separation;
    const minSq = min * min;
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < this.worms.length; i++) {
        const a = this.worms[i];
        if (!a.active || a.bossKind !== MINIBOSS.IDLE_HANDS || !a.hand || a.spawnT > 0) continue;
        if (a.hand.state !== 0 && a.hand.state !== 3) continue;
        for (let j = i + 1; j < this.worms.length; j++) {
          const b = this.worms[j];
          if (!b.active || b.bossKind !== MINIBOSS.IDLE_HANDS || !b.hand || b.spawnT > 0) continue;
          if (b.hand.state !== 0 && b.hand.state !== 3) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= minSq) continue;
          let d = Math.sqrt(d2);
          let nx = 0;
          let ny = 0;
          if (d > 0.001) {
            nx = dx / d;
            ny = dy / d;
          } else {
            // Exact overlap has no normal. Give each hand its own deterministic
            // escape direction so the first frame cannot leave them stacked.
            const angle = a.phase + i * 2.399963;
            nx = Math.cos(angle);
            ny = Math.sin(angle);
            d = 0.001;
          }
          const push = (min - d) * 0.5;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    // A pair near a wall can be pushed past the arena lip; keep the hover bodies in
    // bounds after the pass, just as their normal movement does.
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || w.bossKind !== MINIBOSS.IDLE_HANDS || !w.hand || w.spawnT > 0) continue;
      const pad = this.bossEdgePad(w);
      w.x = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, w.x));
      w.y = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, w.y));
    }
  }

  /** The landing frame: dust, a shove, and damage inside the telegraph ring. */
  private slamImpact(w: Worm): void {
    const cfg = IDLE_HANDS.slam;
    this.emit(EV.PROP_BREAK, -1, w.x, w.y, Math.round(cfg.aoe * 0.75));
    this.emit(EV.WORM_HIT, -1, w.x, w.y, 2, 0, 0);
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.cloakT > 0) continue;
      const dx = p.x - w.x;
      const dy = p.y - w.y;
      if (dx * dx + dy * dy > cfg.aoe * cfg.aoe) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.damagePlayer(p, cfg.damage, -1, dx / d, dy / d, cfg.knockback, SRC.WORM, this.worms.indexOf(w));
    }
  }

  /**
   * A hand takes damage like any body, except while it is mid-charge: a dash that
   * reaches it redirects it instead, and a redirected hand is what hits its partner.
   */
  private damageHand(w: Worm, amount: number, sourceSlot: number, dirX: number, dirY: number, force: number): void {
    const h = w.hand;
    if (!h || !w.active) return;
    const p = sourceSlot >= 0 ? this.players[sourceSlot] : null;
    if (p && h.state === 5 && p.dashKind > 0 && p.dashT > 0) {
      h.state = 6;
      h.t = 0;
      h.dirX = p.dashDirX;
      h.dirY = p.dashDirY;
      h.hitCd = 0;
      w.hitFlash = 0.22;
      this.emit(EV.DEFLECT, sourceSlot, w.x, w.y, 3, h.dirX, h.dirY);
      return;
    }
    w.hp -= amount;
    w.hitFlash = 0.2;
    if (sourceSlot >= 0) w.aggroT = 2;
    if (force > 0) {
      w.kx += dirX * force * 0.22;
      w.ky += dirY * force * 0.22;
    }
    this.emit(EV.WORM_HIT, sourceSlot, w.x, w.y, amount, dirX, dirY);
    if (w.hp > 0) return;
    w.active = false;
    w.hand = null;
    const last = !this.worms.some((other) => other !== w && other.active && other.bossKind === w.bossKind);
    this.emit(EV.WORM_KILL, sourceSlot, w.x, w.y, last ? 220 : 90, dirX, dirY);
    if (sourceSlot === 0) {
      this.gauntletKills++;
      this.dropPickupFromKill(w.x, w.y, true);
    }
  }


  // --- Starfish ------------------------------------------------------------
  //
  // One center plus five arm bodies. Arms are separate pool entries so every weapon
  // can hit them directly; detaching one opens the mouth, and an arm left alive for
  // `hatchTime` grows a whole new Starfish.

  private starfishCenter(group: number): Worm | null {
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (w.active && !w.armState && w.starfish && w.starfish.group === group) return w;
    }
    return null;
  }

  private starfishLiveCenters(): number {
    let n = 0;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (w.active && w.bossKind === MINIBOSS.STARFISH && w.starfish) n++;
    }
    return n;
  }

  private spawnStarfish(x: number, y: number, intro = false): Worm | null {
    const cfg = STARFISH;
    const center = this.spawnWorm(x, y);
    if (!center) return null;
    const group = ++this.starfishGroup;
    center.bossKind = MINIBOSS.STARFISH;
    center.mega = false;
    center.segCount = 0;
    center.hand = null;
    center.armState = null;
    center.hitR = cfg.radius;
    center.segR = cfg.radius * 0.6;
    center.hp = center.maxHp = cfg.hp;
    center.spawnT = intro ? cfg.introTime : cfg.spawnTime;
    center.starfish = {
      group,
      clock: 0,
      state: 0,
      t: 0,
      cd: cfg.mouth.cooldown,
      armCount: 0,
      armMask: 0,
      spin: this.rng.range(0, Math.PI * 2),
      spineCd: cfg.angry.spineInterval,
    };
    let made = 0;
    for (let k = 0; k < cfg.arms; k++) {
      const a = (k / cfg.arms) * Math.PI * 2;
      const arm = this.spawnWorm(center.x + Math.cos(a) * cfg.armReach, center.y + Math.sin(a) * cfg.armReach);
      if (!arm) break;
      arm.bossKind = MINIBOSS.STARFISH;
      arm.mega = false;
      arm.segCount = 0;
      arm.hand = null;
      arm.starfish = null;
      arm.hitR = cfg.armRadius;
      arm.segR = cfg.armRadius * 0.7;
      arm.hp = arm.maxHp = cfg.armHp;
      arm.spawnT = intro ? cfg.introTime : cfg.spawnTime * 0.55;
      arm.angle = a + Math.PI * 0.5;
      arm.armState = {
        group,
        index: k,
        attached: true,
        hatchT: cfg.hatchTime,
        spineCd: cfg.spineInterval * (0.6 + k * 0.12),
        phase: this.rng.range(0, Math.PI * 2),
      };
      made++;
    }
    center.starfish.armCount = made;
    center.starfish.armMask = (1 << made) - 1;
    this.emit(EV.PROP_BREAK, 0, center.x, center.y, 70);
    return center;
  }

  /**
   * The center owns its own motion. It is a boss body, not the generic chain worm, so
   * it never runs `pushOutOfCover`: pillars and fixtures are crossed, the way the Mega
   * Worm crosses them. Only the arena bounds (with the boss overhang pad) clamp it.
   * `updateWorm` dispatches here before the shared cover resolve; keep it that way.
   */
  private updateStarfish(center: Worm, dt: number): void {
    const cfg = STARFISH;
    const st = center.starfish;
    if (!st) return;
    center.prevX = center.x;
    center.prevY = center.y;
    center.phase += dt;
    st.clock += dt;
    if (center.hitFlash > 0) center.hitFlash = Math.max(0, center.hitFlash - dt);
    if (center.spawnT > 0) {
      center.spawnT = Math.max(0, center.spawnT - dt);
      return;
    }
    const angry = st.armCount === 0;
    st.spin += dt * (angry ? cfg.angry.spin : cfg.armOrbit);
    const p = this.threatTarget(center.x, center.y);
    center.angle = Math.atan2(p.y - center.y, p.x - center.x);
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 260) {
      center.x += (dx / d) * 42 * dt;
      center.y += (dy / d) * 42 * dt;
    }
    center.x += Math.cos(st.clock * 0.9) * 10 * dt;
    center.y += Math.sin(st.clock * 1.1) * 10 * dt;
    const pad = this.bossEdgePad(center);
    center.x = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, center.x));
    center.y = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, center.y));

    // Attached arms ride the spin; the center owns their pose.
    for (let i = 0; i < this.worms.length; i++) {
      const arm = this.worms[i];
      const as = arm.armState;
      if (!arm.active || !as || as.group !== st.group || !as.attached) continue;
      const a = st.spin + as.index * (Math.PI * 2 / cfg.arms) + Math.sin(st.clock * 1.5 + as.index) * 0.15;
      arm.prevX = arm.x;
      arm.prevY = arm.y;
      arm.x = center.x + Math.cos(a) * cfg.armReach;
      arm.y = center.y + Math.sin(a) * cfg.armReach;
      arm.angle = a + Math.PI * 0.5;
      if (arm.hitFlash > 0) arm.hitFlash = Math.max(0, arm.hitFlash - dt);
    }

    // Mouth: opens once an arm is gone. Suck first, then chomp.
    if (st.armCount < cfg.arms) {
      st.cd = Math.max(0, st.cd - dt);
      if (st.state === 0) {
        if (st.cd <= 0) {
          st.state = 1;
          st.t = 0;
          this.emit(EV.WORM_HIT, -1, center.x, center.y, 3, 0, 0);
        }
      } else if (st.state === 1) {
        st.t += dt;
        const pull = angry ? cfg.angry.pull : cfg.mouth.pull;
        const reach = (angry ? cfg.angry.chompRadius : cfg.mouth.radius) * 2.6;
        for (let i = 0; i < this.players.length; i++) {
          const body = this.players[i];
          if (!body.active || !body.alive || body.dashT > 0 || body.thrall) continue;
          const bx = center.x - body.x;
          const by = center.y - body.y;
          const bd = Math.hypot(bx, by) || 1;
          if (bd > reach || bd < 34) continue;
          body.x += (bx / bd) * pull * dt;
          body.y += (by / bd) * pull * dt;
        }
        if (st.t >= cfg.mouth.open + (angry ? cfg.mouth.suck * 0.7 : cfg.mouth.suck)) {
          st.state = 2;
          st.t = 0;
          this.starfishChomp(center);
        }
      } else if (st.state === 2) {
        st.t += dt;
        if (st.t >= cfg.mouth.chomp) {
          st.state = 3;
          st.t = 0;
        }
      } else {
        st.t += dt;
        if (st.t >= cfg.mouth.recover) {
          st.state = 0;
          st.t = 0;
          st.cd = angry ? cfg.angry.cooldown : cfg.mouth.cooldown;
        }
      }
    }

    // No arms left: the center spins and sprays spines in every direction.
    if (angry) {
      st.spineCd -= dt;
      if (st.spineCd <= 0) {
        st.spineCd = cfg.angry.spineInterval;
        const n = cfg.angry.spineCount;
        const base = st.spin;
        for (let i = 0; i < n; i++) {
          this.spawnSpine(center.x, center.y, base + (i / n) * Math.PI * 2);
        }
      }
    }
  }

  private starfishChomp(center: Worm): void {
    const st = center.starfish;
    if (!st) return;
    const cfg = STARFISH;
    const angry = st.armCount === 0;
    const radius = angry ? cfg.angry.chompRadius : cfg.mouth.radius;
    const damage = angry ? cfg.angry.chompDamage : cfg.mouth.damage;
    this.emit(EV.EXPLODE, -1, center.x, center.y, radius * 0.8);
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.thrall) continue;
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.damagePlayer(p, damage, -1, dx / d, dy / d, cfg.mouth.knockback, SRC.WORM, this.worms.indexOf(center));
    }
  }

  /** Attached arms are posed by the center; a detached arm crawls. Neither path resolves
   * cover, so a torn-off arm keeps its line rather than being shoved around a pillar. */
  private updateStarfishArm(arm: Worm, dt: number): void {
    const cfg = STARFISH;
    const as = arm.armState;
    if (!as) return;
    if (arm.hitFlash > 0) arm.hitFlash = Math.max(0, arm.hitFlash - dt);
    as.phase += dt;
    if (arm.spawnT > 0) {
      arm.spawnT = Math.max(0, arm.spawnT - dt);
      return;
    }
    if (as.attached) {
      as.spineCd -= dt;
      if (as.spineCd <= 0) {
        as.spineCd = cfg.spineInterval * (0.8 + this.rng.next() * 0.4);
        const p = this.threatTarget(arm.x, arm.y);
        if (p.alive && p.cloakT <= 0) {
          const base = Math.atan2(p.y - arm.y, p.x - arm.x);
          const half = (cfg.spineCount - 1) * 0.5;
          for (let i = 0; i < cfg.spineCount; i++) {
            this.spawnSpine(arm.x, arm.y, base + (i - half) * cfg.spineSpread);
          }
        }
      }
      return;
    }
    // Detached: crawl away from the nearest body while the hatch timer runs.
    arm.prevX = arm.x;
    arm.prevY = arm.y;
    const p = this.threatTarget(arm.x, arm.y);
    const dx = arm.x - p.x;
    const dy = arm.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    arm.x += (dx / d) * cfg.crawlSpeed * dt;
    arm.y += (dy / d) * cfg.crawlSpeed * dt;
    arm.angle += Math.sin(as.phase * 3) * 0.9 * dt;
    const pad = this.bossEdgePad(arm);
    arm.x = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, arm.x));
    arm.y = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, arm.y));
    as.hatchT -= dt;
    if (as.hatchT > 0) return;
    if (this.starfishLiveCenters() >= cfg.maxLive) {
      as.hatchT = cfg.hatchTime * 0.5;
      return;
    }
    const nx = arm.x;
    const ny = arm.y;
    if (this.spawnStarfish(nx, ny)) {
      arm.active = false;
      arm.armState = null;
      this.emit(EV.EXPLODE, -1, nx, ny, 90);
    } else {
      as.hatchT = 1;
    }
  }

  private spawnSpine(x: number, y: number, angle: number): void {
    const cfg = STARFISH;
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
    proj.type = 3;
    proj.owner = -1;
    proj.srcKind = SRC.WORM;
    proj.srcId = -1;
    proj.x = proj.prevX = x;
    proj.y = proj.prevY = y;
    proj.vx = Math.cos(angle) * cfg.spineSpeed;
    proj.vy = Math.sin(angle) * cfg.spineSpeed;
    proj.radius = cfg.spineRadius;
    proj.damage = cfg.spineDamage;
    proj.deflects = 0;
    proj.bounces = 0;
    proj.fuse = cfg.spineLife;
    proj.grace = 0;
    proj.armed = true;
    proj.blastRadius = 0;
    proj.blastKnockback = 0;
    proj.arcDur = 0;
    proj.homing = false;
    proj.pathAxis = 0;
    proj.hits = 0;
    proj.spin = this.rng.range(0, Math.PI * 2);
    proj.spinDir = 1;
    proj.variant = 0;
    proj.orbOwner = -1;
    proj.orbA = 0;
    proj.orbR = 0;
    proj.orbDir = 1;
    proj.hitPlayers = 0;
    proj.hitWorms = 0;
    proj.hitViruses = 0;
    proj.hitErrors = 0;
    proj.hitSentries = 0;
    proj.hitDrone = false;
    this.emit(EV.SENTRY_SHOOT, -1, x, y, angle);
  }

  /** Attached arm: strip it off. Detached arm: it has to be destroyed or it hatches. */
  private damageStarfishArm(arm: Worm, amount: number, sourceSlot: number, dirX: number, dirY: number, force: number): void {
    const cfg = STARFISH;
    const as = arm.armState;
    if (!as || !arm.active) return;
    arm.hp -= amount;
    arm.hitFlash = 0.2;
    if (force > 0) {
      arm.kx += dirX * force * 0.2;
      arm.ky += dirY * force * 0.2;
    }
    this.emit(EV.WORM_HIT, sourceSlot, arm.x, arm.y, amount, dirX, dirY);
    if (arm.hp > 0) return;
    if (as.attached) {
      as.attached = false;
      arm.hp = arm.maxHp = cfg.armDetachedHp;
      as.hatchT = cfg.hatchTime;
      as.spineCd = 999;
      arm.kx += dirX * 140;
      arm.ky += dirY * 140;
      const center = this.starfishCenter(as.group);
      const st = center ? center.starfish : null;
      if (st) {
        st.armCount = Math.max(0, st.armCount - 1);
        st.armMask &= ~(1 << as.index);
      }
      this.emit(EV.WORM_HIT, sourceSlot, arm.x, arm.y, 5, dirX, dirY);
      return;
    }
    arm.active = false;
    arm.armState = null;
    this.emit(EV.WORM_KILL, sourceSlot, arm.x, arm.y, 80, dirX, dirY);
    if (sourceSlot === 0) {
      this.gauntletKills++;
      this.dropPickupFromKill(arm.x, arm.y, true);
    }
  }

  private damageStarfish(center: Worm, amount: number, sourceSlot: number, dirX: number, dirY: number, force: number): void {
    const cfg = STARFISH;
    const st = center.starfish;
    if (!st || !center.active) return;
    // Plated while any arm holds on: the arms are the fight.
    if (st.armCount > 0) amount *= cfg.armorMult;
    center.hp -= amount;
    center.hitFlash = 0.2;
    this.emit(EV.WORM_HIT, sourceSlot, center.x, center.y, amount, dirX, dirY);
    if (center.hp > 0) return;
    center.active = false;
    center.starfish = null;
    for (let i = 0; i < this.worms.length; i++) {
      const arm = this.worms[i];
      if (!arm.active || !arm.armState || arm.armState.group !== st.group) continue;
      arm.active = false;
      arm.armState = null;
    }
    this.emit(EV.WORM_KILL, sourceSlot, center.x, center.y, 260, dirX, dirY);
    if (sourceSlot === 0) {
      this.gauntletKills++;
      this.dropPickupFromKill(center.x, center.y, true);
    }
  }


  // --- File blob -----------------------------------------------------------
  //
  // One big body whose health is a count of file icons. Icons are never simulated:
  // `hp` is the live count, the rim is ten spring nodes, and the renderer derives
  // every icon position from those nodes plus a hash of the icon index.

  private blobRadius(w: Worm): number {
    const frac = Math.max(0, Math.min(1, w.hp / Math.max(1, w.maxHp)));
    return BLOB.rMin + (BLOB.rMax - BLOB.rMin) * Math.pow(frac, 0.55);
  }

  private spawnBlob(x: number, y: number): Worm | null {
    const w = this.spawnWorm(x, y);
    if (!w) return null;
    const n = BLOB.nodes;
    const nodeR = new Float32Array(n);
    const nodeV = new Float32Array(n);
    for (let i = 0; i < n; i++) nodeR[i] = BLOB.rMax;
    w.bossKind = MINIBOSS.BLOB;
    w.mega = false;
    w.segCount = 0;
    w.hand = null;
    w.starfish = null;
    w.armState = null;
    w.hitR = BLOB.rMax;
    w.segR = BLOB.rMax * 0.8;
    w.hp = w.maxHp = BLOB.icons;
    w.spawnT = BLOB.introTime;
    w.blob = {
      state: 0,
      t: 0,
      cd: 1.2,
      fromX: x,
      fromY: y,
      toX: x,
      toY: y,
      globT: 0,
      shed: 0,
      shedT: 0,
      shedSeed: this.rng.range(0, 1000),
      nodeR,
      nodeV,
      clock: 0,
      contactCd: 0,
    };
    this.emit(EV.PROP_BREAK, 0, x, y, 90);
    return w;
  }

  private updateBlob(w: Worm, dt: number): void {
    const st = w.blob;
    if (!st) return;
    w.prevX = w.x;
    w.prevY = w.y;
    st.clock += dt;
    if (w.spawnT > 0) {
      w.spawnT = Math.max(0, w.spawnT - dt);
      return;
    }
    if (w.hitFlash > 0) w.hitFlash = Math.max(0, w.hitFlash - dt);
    if (st.shedT > 0) st.shedT = Math.max(0, st.shedT - dt);
    const r = this.blobRadius(w);
    w.hitR = r;
    w.segR = r * 0.8;

    // Rim springs: each node sags toward the current radius, then settles.
    for (let i = 0; i < st.nodeR.length; i++) {
      const rest = r * (1 + Math.sin(st.clock * 2.3 + i * 1.7) * 0.05);
      st.nodeV[i] += (rest - st.nodeR[i]) * BLOB.spring * dt;
      st.nodeV[i] *= Math.exp(-BLOB.damp * dt);
      st.nodeR[i] += st.nodeV[i] * dt;
    }

    const p = this.threatTarget(w.x, w.y);
    const dx = p.x - w.x;
    const dy = p.y - w.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (st.contactCd > 0) st.contactCd = Math.max(0, st.contactCd - dt);
    if (st.state === 0) {
      if (dist > r + 8) {
        w.x += (dx / dist) * BLOB.speed * dt;
        w.y += (dy / dist) * BLOB.speed * dt;
      }
      if (st.contactCd <= 0 && dist < r + PLAYER.radius && p.alive) {
        st.contactCd = BLOB.contactCooldown;
        this.damagePlayer(p, BLOB.contactDamage, -1, dx / dist, dy / dist, BLOB.contactKnockback, SRC.WORM, this.worms.indexOf(w));
      }
      st.cd -= dt;
      if (st.cd <= 0 && p.alive) {
        const pad = this.bossEdgePad(w);
        const tx = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, p.x));
        const ty = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, p.y));
        if (dist <= BLOB.slam.range) {
          // A close runner gets a committed high jump rather than another lob.
          st.state = 4;
          st.t = 0;
          st.globT = 0;
          st.fromX = w.x;
          st.fromY = w.y;
          st.toX = tx;
          st.toY = ty;
        } else if (dist <= BLOB.tossRange) {
          st.state = 1;
          st.t = 0;
          st.toX = p.x;
          st.toY = p.y;
          st.fromX = w.x;
          st.fromY = w.y;
        }
      }
    } else if (st.state === 1) {
      st.t += dt;
      if (st.t >= BLOB.windup) {
        st.state = 2;
        st.t = 0;
        st.globT = 0;
      }
    } else if (st.state === 2) {
      st.globT += dt;
      if (st.globT >= BLOB.flight) {
        st.state = 3;
        st.t = 0;
        this.blobLand(w, st.toX, st.toY);
      }
    } else if (st.state === 3) {
      st.t += dt;
      if (st.t >= BLOB.recover) {
        st.state = 0;
        st.t = 0;
        st.cd = BLOB.cooldown;
      }
    } else if (st.state === 4) {
      st.t += dt;
      if (st.t >= BLOB.slam.windup) {
        st.state = 5;
        st.t = 0;
        st.globT = 0;
      }
    } else if (st.state === 5) {
      st.globT += dt;
      const u = Math.min(1, st.globT / Math.max(0.001, BLOB.slam.airTime));
      w.x = st.fromX + (st.toX - st.fromX) * u;
      w.y = st.fromY + (st.toY - st.fromY) * u;
      if (st.globT >= BLOB.slam.airTime) {
        w.x = st.toX;
        w.y = st.toY;
        st.state = 6;
        st.t = 0;
        this.blobSlam(w);
      }
    } else {
      st.t += dt;
      if (st.t >= BLOB.slam.recover) {
        st.state = 0;
        st.t = 0;
        st.cd = BLOB.slam.cooldown;
      }
    }

    // Ghost's cloak phases a glued body out; nothing else clears it early.
    for (let i = 0; i < this.players.length; i++) {
      const body = this.players[i];
      if (body.glueT > 0 && body.cloakT > 0) {
        body.glueT = 0;
        body.glueHits = 0;
      }
      if (body.glueT > 0) body.glueT = Math.max(0, body.glueT - dt);
    }

    const pad = this.bossEdgePad(w);
    w.x = Math.max(this.arena.bounds.left + pad, Math.min(this.arena.bounds.right - pad, w.x));
    w.y = Math.max(this.arena.bounds.top + pad, Math.min(this.arena.bounds.bottom - pad, w.y));
  }

  /** High jump landing: a radial body check with a heavier shove than the glob. */
  private blobSlam(w: Worm): void {
    const cfg = BLOB.slam;
    this.emit(EV.PROP_BREAK, -1, w.x, w.y, 180);
    this.emit(EV.EXPLODE, -1, w.x, w.y, cfg.aoe);
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.thrall || p.travelT > 0) continue;
      const dx = p.x - w.x;
      const dy = p.y - w.y;
      const reach = cfg.aoe + PLAYER.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.damagePlayer(p, cfg.damage, -1, dx / d, dy / d, cfg.knockback, SRC.WORM, this.worms.indexOf(w));
      if (p.alive) this.emit(EV.WORM_HIT, -1, p.x, p.y, 2, 0, 0);
    }
  }

  /** The tossed glob lands: damage plus a file cage that has to be shot or swung off. */
  private blobLand(w: Worm, x: number, y: number): void {
    const st = w.blob;
    if (!st) return;
    this.emit(EV.PROP_BREAK, -1, x, y, 90);
    this.emit(EV.EXPLODE, -1, x, y, 60);
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.thrall || p.travelT > 0) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy > BLOB.aoe * BLOB.aoe) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.damagePlayer(p, BLOB.tossDamage, -1, dx / d, dy / d, BLOB.glueKnockback, SRC.WORM, this.worms.indexOf(w));
      if (!p.alive) continue;
      p.glueT = BLOB.glueTime;
      p.glueHits = BLOB.glueHits;
      p.dashT = 0;
      p.dashKind = 0;
      this.emit(EV.WORM_HIT, -1, p.x, p.y, 2, 0, 0);
    }
  }

  /** One attack press tears a file off the cage. Three presses and the body is free. */
  private chipGlue(p: Player): void {
    if (p.glueT <= 0) return;
    p.glueHits--;
    this.emit(EV.PROP_BREAK, p.slot, p.x, p.y, 26);
    if (p.glueHits <= 0) {
      p.glueT = 0;
      p.glueHits = 0;
    }
  }

  private damageBlob(w: Worm, amount: number, sourceSlot: number, dirX: number, dirY: number): void {
    const st = w.blob;
    if (!st || !w.active) return;
    // One icon per point of health: a hit sheds exactly what it takes off.
    w.hp -= amount;
    w.hitFlash = 0.18;
    st.shed = Math.max(1, Math.min(10, Math.round(amount)));
    st.shedT = BLOB.shedTime;
    st.shedSeed = this.rng.range(0, 1000);
    for (let i = 0; i < st.nodeV.length; i++) {
      const a = (i / st.nodeV.length) * Math.PI * 2;
      st.nodeV[i] += Math.cos(a) * (dirX || 0) * 90 + this.rng.range(-40, 40);
    }
    this.emit(EV.WORM_HIT, sourceSlot, w.x, w.y, amount, dirX, dirY);
    if (w.hp > 0) return;
    w.hp = 0;
    w.active = false;
    w.blob = null;
    this.emit(EV.WORM_KILL, sourceSlot, w.x, w.y, 240, dirX, dirY);
    if (sourceSlot === 0) {
      this.gauntletKills++;
      this.dropPickupFromKill(w.x, w.y, true);
    }
  }


  // --- Storm Cloud ---------------------------------------------------------
  //
  // A weather body that owns the top of the arena. It rains alternating rows under
  // itself and winds up a bolt; the rain can be shot out of the sky, and a caught
  // bolt is the real punish. It stays high so a player cannot stand on the cloud,
  // and slides out from under anyone who closes in.

  private spawnStormCloud(x: number, y: number): Worm | null {
    const cfg = STORM_CLOUD;
    const w = this.spawnWorm(x, y);
    if (!w) return null;
    // One breathing scale per rendered square (three 7x4 layers).
    const puff = new Float32Array(84);
    for (let i = 0; i < puff.length; i++) puff[i] = this.rng.range(0.82, 1.18);
    w.bossKind = MINIBOSS.STORM_CLOUD;
    w.mega = false;
    w.segCount = 0;
    w.hand = null;
    w.starfish = null;
    w.armState = null;
    w.blob = null;
    w.hitR = cfg.radius;
    w.segR = cfg.radius * 0.7;
    w.hp = w.maxHp = cfg.hp;
    // Every spawn assembles, not only the scripted entrance: the renderer reads `spawnT`
    // as gather progress and the intro keeps it alive for its own duration.
    w.spawnT = cfg.introTime;
    w.x = Math.max(this.arena.bounds.left + cfg.radius * 0.6, Math.min(this.arena.bounds.right - cfg.radius * 0.6, x));
    // Land in the ceiling band, not off the top of the screen: the whole cloud reads
    w.y = this.arena.bounds.top + cfg.hoverTop;
    w.prevX = w.x;
    w.prevY = w.y;
    w.angle = Math.PI * 0.5;
    w.storm = {
      state: 0,
      t: 0,
      clock: 0,
      rowsLeft: 0,
      rowT: 0,
      rowDir: 1,
      rainCd: 0.65,
      rowIndex: 0,
      boltT: 0,
      boltCd: cfg.lightning.cooldown * 0.65,
      boltX: w.x,
      boltY: w.y + cfg.radius,
      flash: 0,
      contactCd: 0,
      puff,
    };
    this.emit(EV.PROP_BREAK, 0, w.x, w.y, 120);
    return w;
  }

  private updateStormCloud(w: Worm, dt: number): void {
    const cfg = STORM_CLOUD;
    const st = w.storm;
    if (!st) return;
    w.prevX = w.x;
    w.prevY = w.y;
    st.clock += dt;
    if (w.hitFlash > 0) w.hitFlash = Math.max(0, w.hitFlash - dt);
    if (st.flash > 0) st.flash = Math.max(0, st.flash - dt);
    if (w.spawnT > 0) {
      w.spawnT = Math.max(0, w.spawnT - dt);
      return;
    }
    if (w.pinT > 0) w.pinT = Math.max(0, w.pinT - dt);

    const p = this.threatTarget(w.x, w.y);
    const r = w.hitR;
    const dx = p.x - w.x;
    const dy = p.y - w.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Home is a ceiling band. Track the body slowly while it is far, and slide out
    // from underneath once it closes: the top of the map is the boss's ground.
    const homeY = this.arena.bounds.top + cfg.hoverTop + Math.sin(st.clock * 0.8) * cfg.hoverBob;
    const crowded = p.alive && Math.abs(dx) < cfg.repelRadius && p.y > w.y - r;
    const drift = crowded
      ? (dx === 0 ? 1 : -Math.sign(dx)) * cfg.repelSpeed
      : p.alive
        ? Math.max(-cfg.trackSpeed, Math.min(cfg.trackSpeed, dx * 0.9))
        : Math.cos(st.clock * 0.6) * cfg.trackSpeed * 0.4;
    w.x += drift * dt;
    w.y += Math.max(-cfg.repelSpeed, Math.min(cfg.repelSpeed, (homeY - w.y) * 2.6)) * dt;
    // No arena clamp: like the Mega Worm, the body is a flying boss and may overhang or
    // leave the floor entirely. Only its own ceiling band holds it, because that band is
    // its ground. The band is relative to `hoverTop`, not to a radius fraction, so a much
    // larger body can sit with its underside at the same height instead of being pushed
    // down into the arena.
    const bandTop = this.arena.bounds.top + cfg.hoverTop;
    w.y = Math.max(bandTop - cfg.hoverBob, Math.min(bandTop + cfg.hoverBob, w.y));
    w.angle = Math.PI * 0.5;

    if (st.contactCd > 0) st.contactCd = Math.max(0, st.contactCd - dt);
    if (st.contactCd <= 0 && p.alive && dist < r * 0.86 + PLAYER.radius) {
      st.contactCd = cfg.contactCooldown;
      this.damagePlayer(p, cfg.contactDamage, -1, dx / dist, dy / dist, cfg.contactKnockback, SRC.WORM, this.worms.indexOf(w));
    }

    // Rain: a burst of rows, laid across the lane under the cloud. Each burst flips
    // direction, and every other row is offset by half a gap so the drops do not
    // stack into one predictable comb.
    st.rainCd -= dt;
    if (st.rowsLeft <= 0 && st.rainCd <= 0) {
      st.rowsLeft = cfg.rain.rows;
      st.rowDir = -st.rowDir;
      st.rowT = 0;
      st.rainCd = cfg.rain.cycle;
    }
    if (st.rowsLeft > 0) {
      st.rowT -= dt;
      if (st.rowT <= 0) {
        st.rowT = cfg.rain.rowGap;
        st.rowIndex++;
        const n = cfg.rain.count;
        const span = cfg.rain.width;
        const offset = (st.rowIndex % 2) * (span / (n * 2));
        for (let i = 0; i < n; i++) {
          const u = n === 1 ? 0.5 : i / (n - 1);
          const across = st.rowDir > 0 ? u : 1 - u;
          const sx = w.x - span * 0.5 + across * span + offset;
          this.spawnHostileProjectile(
            sx + this.rng.range(-5, 5),
            w.y + r + 8,
            Math.PI * 0.5 + this.rng.range(-cfg.rain.drift, cfg.rain.drift),
            cfg.rain.speed + this.rng.range(-16, 16),
            cfg.rain.radius,
            cfg.rain.damage,
            18,
            cfg.rain.ttl,
            this.worms.indexOf(w),
          );
        }
        st.rowsLeft--;
      }
    }

    // Lightning: one telegraphed bolt on a long clock. The strike point follows the
    // body for the first half of the tell, then latches so a dash can beat it.
    if (st.state === 0) {
      st.boltCd = Math.max(0, st.boltCd - dt);
      if (st.boltCd <= 0 && p.alive && p.cloakT <= 0) {
        st.state = 1;
        st.t = 0;
        st.boltT = cfg.lightning.windup;
        st.boltX = p.x;
        st.boltY = p.y;
        this.emit(EV.SENTRY_SHOOT, -1, w.x, w.y, Math.PI * 0.5);
      }
    } else {
      st.boltT = Math.max(0, st.boltT - dt);
      if (st.boltT > cfg.lightning.windup * 0.45 && p.alive) {
        st.boltX = p.x;
        st.boltY = p.y;
      }
      if (st.boltT <= 0) {
        st.state = 0;
        st.boltCd = cfg.lightning.cooldown;
        st.flash = 0.24;
        const sx = w.x;
        const sy = w.y + r + 10;
        const angle = Math.atan2(st.boltY - sy, st.boltX - sx);
        this.spawnHostileProjectile(
          sx,
          sy,
          angle,
          cfg.lightning.speed,
          cfg.lightning.radius,
          cfg.lightning.damage,
          19,
          cfg.lightning.ttl,
          this.worms.indexOf(w),
        );
        this.emit(EV.EXPLODE, -1, sx, sy, 46);
      }
    }
  }

  private damageStormCloud(w: Worm, amount: number, sourceSlot: number, dirX: number, dirY: number): void {
    const st = w.storm;
    if (!st || !w.active) return;
    w.hp -= amount;
    w.hitFlash = 0.16;
    st.flash = Math.max(st.flash, 0.12);
    this.emit(EV.WORM_HIT, sourceSlot, w.x, w.y, amount, dirX, dirY);
    if (w.hp > 0) return;
    w.hp = 0;
    w.active = false;
    w.storm = null;
    this.emit(EV.WORM_KILL, sourceSlot, w.x, w.y, 280, dirX, dirY);
    if (sourceSlot === 0) {
      this.gauntletKills++;
      this.dropPickupFromKill(w.x, w.y, true);
    }
  }

  // --- USER finale ---------------------------------------------------------
  //
  // One giant body pinned to the ceiling. Every attack it owns is expressed through
  // the existing hostile projectile pool, so the player's guard, lash and ranged kit
  // already answer it. The two fists slam the floor and burst into reflectable rings;
  // the eyes throw a converging fan; the portals drop the gauntlet families; the
  // fly-over is a staged Mega Worm silhouette that strafes the top of the arena.

  private spawnUser(_x?: number, _y?: number): Worm | null {
    const cfg = USER;
    const b = this.arena.bounds;
    const w = this.spawnWorm(this.centerX, b.top + cfg.hoverY);
    if (!w) return null;
    w.bossKind = MINIBOSS.USER;
    w.mega = false;
    w.segCount = 0;
    w.hand = null;
    w.starfish = null;
    w.armState = null;
    w.blob = null;
    w.storm = null;
    w.hitR = cfg.radius;
    w.segR = cfg.radius * 0.7;
    w.hp = w.maxHp = cfg.hp;
    // The entrance assembles the body from the top of the frame. Holding spawnT also
    // keeps it inert for the intro beat, like the Storm Cloud.
    w.spawnT = cfg.introTime;
    w.x = this.centerX;
    w.y = b.top + cfg.hoverY;
    w.prevX = w.x;
    w.prevY = w.y;
    w.angle = Math.PI * 0.5;
    w.user = {
      state: 0,
      t: 0,
      cd: 0.85,
      clock: 0,
      flash: 0,
      contactCd: 0,
      handCd: 0.9,
      eyeCd: 2.4,
      portalCd: 5.4,
      flyCd: 8.6,
      fistX: w.x,
      fistY: w.y,
      fist2X: w.x,
      fist2Y: w.y,
      eyeX: w.x,
      eyeY: w.y,
      fired: false,
      flyX: w.x,
      flyY: w.y,
      flyAngle: 0,
      flyDir: 1,
      flyVolleys: 0,
      portalX: new Float32Array(8),
      portalY: new Float32Array(8),
      portalCount: 0,
    };
    this.emit(EV.PROP_BREAK, 0, w.x, w.y, 180);
    this.emit(EV.MEGA_CRY, -1, w.x, w.y, cfg.radius);
    return w;
  }

  private updateUser(w: Worm, dt: number): void {
    const cfg = USER;
    const st = w.user;
    if (!st) return;
    w.prevX = w.x;
    w.prevY = w.y;
    st.clock += dt;
    if (w.hitFlash > 0) w.hitFlash = Math.max(0, w.hitFlash - dt);
    if (st.flash > 0) st.flash = Math.max(0, st.flash - dt);
    if (st.contactCd > 0) st.contactCd = Math.max(0, st.contactCd - dt);
    if (w.spawnT > 0) {
      w.spawnT = Math.max(0, w.spawnT - dt);
      return;
    }
    if (w.pinT > 0) w.pinT = Math.max(0, w.pinT - dt);

    const b = this.arena.bounds;
    const p = this.threatTarget(w.x, w.y);
    // The body is a backdrop that breathes, not a chaser. It drifts across the ceiling
    // and keeps its underside at roughly the same height above the floor.
    const homeX = this.centerX + Math.sin(st.clock * 0.22) * cfg.drift;
    const homeY = b.top + cfg.hoverY + Math.sin(st.clock * 0.72) * cfg.bob;
    w.x += (homeX - w.x) * Math.min(1, dt * 2.2);
    w.y += (homeY - w.y) * Math.min(1, dt * 2.2);
    w.angle = Math.PI * 0.5;

    if (p.alive && p.cloakT <= 0 && st.contactCd <= 0) {
      const dx = p.x - w.x;
      const dy = p.y - w.y;
      const reach = w.hitR * 0.92 + PLAYER.radius;
      if (dx * dx + dy * dy <= reach * reach) {
        const d = Math.hypot(dx, dy) || 1;
        st.contactCd = cfg.contactCooldown;
        this.damagePlayer(
          p,
          cfg.contactDamage,
          -1,
          dx / d,
          dy / d,
          cfg.contactKnockback,
          SRC.WORM,
          this.worms.indexOf(w),
        );
      }
    }

    st.handCd = Math.max(0, st.handCd - dt);
    st.eyeCd = Math.max(0, st.eyeCd - dt);
    st.portalCd = Math.max(0, st.portalCd - dt);
    st.flyCd = Math.max(0, st.flyCd - dt);

    if (st.state === 0) {
      st.cd -= dt;
      if (st.cd > 0) return;
      if (st.handCd <= 0) {
        this.userBeginFists(w, st, p);
        return;
      }
      if (st.eyeCd <= 0) {
        this.userBeginEyes(w, st, p);
        return;
      }
      if (st.portalCd <= 0) {
        this.userBeginPortals(w, st);
        return;
      }
      if (st.flyCd <= 0) {
        this.userBeginFlyby(w, st);
        return;
      }
      st.cd = 0.25;
      return;
    }

    st.t += dt;
    const h = cfg.hands;
    const e = cfg.eyes;
    const f = cfg.flyby;
    if (st.state === 1) {
      // The tell tracks the player for the first half, then commits. The two palms
      // land either side of that latched point, so a strafe can split the gap.
      if (p.alive && st.t < h.windup * 0.6) {
        this.userAimFists(st, p.x, p.y);
      }
      if (st.t >= h.windup) {
        this.userFistImpact(w, st);
        st.state = 2;
        st.t = 0;
      }
    } else if (st.state === 2) {
      if (st.t >= h.active) {
        st.state = 3;
        st.t = 0;
      }
    } else if (st.state === 3) {
      if (st.t >= h.recover) {
        st.handCd = h.cooldown;
        st.state = 0;
        st.t = 0;
        st.cd = cfg.attackGap;
      }
    } else if (st.state === 4) {
      if (p.alive && st.t < e.windup * 0.55) {
        st.eyeX = p.x;
        st.eyeY = p.y;
      }
      if (st.t >= e.windup) {
        this.userEyeFire(w, st);
        st.state = 5;
        st.t = 0;
      }
    } else if (st.state === 5) {
      if (st.t >= e.active) {
        st.state = 6;
        st.t = 0;
      }
    } else if (st.state === 6) {
      if (st.t >= e.recover) {
        st.eyeCd = e.cooldown;
        st.state = 0;
        st.t = 0;
        st.cd = cfg.attackGap;
      }
    } else if (st.state === 7) {
      if (st.t >= cfg.portals.windup) {
        this.userPortalBurst(w, st);
        st.state = 8;
        st.t = 0;
      }
    } else if (st.state === 8) {
      if (st.t >= 0.55) {
        st.state = 9;
        st.t = 0;
      }
    } else if (st.state === 9) {
      if (st.t >= cfg.portals.recover) {
        st.portalCd = cfg.portals.cooldown;
        st.state = 0;
        st.t = 0;
        st.cd = cfg.attackGap;
      }
    } else if (st.state === 10) {
      if (st.t >= f.windup) {
        st.state = 11;
        st.t = 0;
        st.flyVolleys = 0;
      }
    } else if (st.state === 11) {
      this.userFlyby(w, st, dt);
      if (st.t >= f.duration) {
        st.state = 12;
        st.t = 0;
      }
    } else if (st.state === 12) {
      if (st.t >= f.recover) {
        st.flyCd = f.cooldown;
        st.state = 0;
        st.t = 0;
        st.cd = cfg.attackGap;
      }
    }
  }

  private userAimFists(st: NonNullable<Worm['user']>, px: number, py: number): void {
    const h = USER.hands;
    const b = this.arena.bounds;
    const pad = h.aoe * 0.7;
    st.fistX = Math.max(b.left + pad, Math.min(b.right - pad, px - h.offset));
    st.fist2X = Math.max(b.left + pad, Math.min(b.right - pad, px + h.offset));
    st.fistY = Math.max(b.top + pad, Math.min(b.bottom - pad, py));
    st.fist2Y = st.fistY;
  }

  private userBeginFists(w: Worm, st: NonNullable<Worm['user']>, p: Player): void {
    const b = this.arena.bounds;
    const px = p.alive ? p.x : this.centerX;
    const py = p.alive ? p.y : b.top + (b.bottom - b.top) * 0.66;
    this.userAimFists(st, px, py);
    st.state = 1;
    st.t = 0;
    st.fired = false;
    this.emit(EV.SENTRY_SHOOT, -1, w.x, w.y, Math.PI * 0.5);
  }

  private userFistImpact(w: Worm, st: NonNullable<Worm['user']>): void {
    if (st.fired) return;
    st.fired = true;
    const h = USER.hands;
    const srcId = this.worms.indexOf(w);
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (!p.active || !p.alive || p.thrall || p.travelT > 0) continue;
      const d1 = Math.hypot(p.x - st.fistX, p.y - st.fistY);
      const d2 = Math.hypot(p.x - st.fist2X, p.y - st.fist2Y);
      if (d1 > h.aoe && d2 > h.aoe) continue;
      const nearX = d1 <= d2 ? st.fistX : st.fist2X;
      const nearY = d1 <= d2 ? st.fistY : st.fist2Y;
      const dx = p.x - nearX;
      const dy = p.y - nearY;
      const d = Math.hypot(dx, dy) || 1;
      this.damagePlayer(p, h.damage, -1, dx / d, dy / d, h.knockback, SRC.WORM, srcId);
      if (p.alive) this.emit(EV.WORM_HIT, -1, p.x, p.y, 2, dx / d, dy / d);
    }
    st.flash = 0.3;
    for (let side = 0; side < 2; side++) {
      const fx = side === 0 ? st.fistX : st.fist2X;
      const fy = side === 0 ? st.fistY : st.fist2Y;
      this.emit(EV.EXPLODE, -1, fx, fy, 170);
      const phase = side === 0 ? 0 : Math.PI / h.shockCount;
      for (let i = 0; i < h.shockCount; i++) {
        const angle = (i / h.shockCount) * Math.PI * 2 + phase;
        this.spawnHostileProjectile(
          fx + Math.cos(angle) * 26,
          fy + Math.sin(angle) * 26,
          angle,
          h.shockSpeed,
          h.shockRadius,
          h.shockDamage,
          3,
          h.shockTtl,
          srcId,
          0,
          SRC.WORM,
        );
      }
    }
  }

  private userBeginEyes(w: Worm, st: NonNullable<Worm['user']>, p: Player): void {
    st.state = 4;
    st.t = 0;
    st.fired = false;
    st.eyeX = p.alive ? p.x : this.centerX;
    st.eyeY = p.alive ? p.y : w.y + w.hitR;
  }

  private userEyeFire(w: Worm, st: NonNullable<Worm['user']>): void {
    if (st.fired) return;
    st.fired = true;
    const e = USER.eyes;
    const srcId = this.worms.indexOf(w);
    const eyeY = w.y - w.hitR * 0.14;
    const eyeOff = w.hitR * 0.33;
    for (let side = -1; side <= 1; side += 2) {
      const sx = w.x + side * eyeOff;
      const sy = eyeY;
      const base = Math.atan2(st.eyeY - sy, st.eyeX - sx);
      for (let i = 0; i < e.count; i++) {
        const u = e.count === 1 ? 0.5 : i / (e.count - 1);
        const angle = base + (u - 0.5) * e.spread;
        this.spawnHostileProjectile(
          sx,
          sy,
          angle,
          e.speed,
          e.radius,
          e.damage,
          20,
          e.ttl,
          srcId,
          0,
          SRC.WORM,
        );
      }
      this.emit(EV.EXPLODE, -1, sx, sy, 54);
    }
    st.flash = 0.24;
  }

  private userBeginPortals(w: Worm, st: NonNullable<Worm['user']>): void {
    const cfg = USER.portals;
    const b = this.arena.bounds;
    const slots = cfg.sentries + cfg.viruses + cfg.worms;
    st.state = 7;
    st.t = 0;
    st.fired = false;
    st.portalCount = 0;
    const span = (b.right - b.left) * 0.62;
    for (let i = 0; i < slots; i++) {
      const u = slots === 1 ? 0.5 : i / (slots - 1);
      const baseX = this.centerX + (u - 0.5) * span;
      let x = baseX;
      let y = w.y + w.hitR * 0.72 + (i % 2) * 46;
      // Find a clear pocket under the body; a portal ring painted inside a tower
      // would drop its body into cover.
      for (let attempt = 0; attempt < 6; attempt++) {
        x = Math.max(b.left + 90, Math.min(b.right - 90, baseX));
        y = Math.max(b.top + 260, Math.min(b.bottom - 280, w.y + w.hitR * 0.72 + (i % 2) * 46 - attempt * 54));
        if (this.pointClearOfCover(x, y, 74)) break;
      }
      st.portalX[i] = x;
      st.portalY[i] = y;
      st.portalCount++;
    }
    this.emit(EV.SENTRY_SHOOT, -1, w.x, w.y, Math.PI * 0.5);
  }

  private userPortalBurst(w: Worm, st: NonNullable<Worm['user']>): void {
    if (st.fired) return;
    st.fired = true;
    const cfg = USER.portals;
    let index = 0;
    for (let i = 0; i < cfg.sentries && index < st.portalCount; i++, index++) {
      const kind = (i % 2 === 0 ? 0 : 1) as 0 | 1;
      this.spawnSentry(kind, st.portalX[index], st.portalY[index], true);
      this.emit(EV.PROP_BREAK, -1, st.portalX[index], st.portalY[index], 80);
    }
    for (let i = 0; i < cfg.viruses && index < st.portalCount; i++, index++) {
      this.spawnVirus(st.portalX[index], st.portalY[index], false, false);
      this.emit(EV.PROP_BREAK, -1, st.portalX[index], st.portalY[index], 60);
    }
    for (let i = 0; i < cfg.worms && index < st.portalCount; i++, index++) {
      this.spawnWorm(st.portalX[index], st.portalY[index]);
      this.emit(EV.PROP_BREAK, -1, st.portalX[index], st.portalY[index], 90);
    }
    st.flash = 0.3;
    this.emit(EV.MEGA_CRY, -1, w.x, w.y, 160);
  }

  private userBeginFlyby(w: Worm, st: NonNullable<Worm['user']>): void {
    const b = this.arena.bounds;
    st.state = 10;
    st.t = 0;
    st.fired = false;
    st.flyVolleys = 0;
    st.flyDir = this.rng.next() < 0.5 ? 1 : -1;
    st.flyX = st.flyDir > 0 ? b.left - 500 : b.right + 500;
    st.flyY = b.top + USER.hoverY;
    st.flyAngle = st.flyDir > 0 ? 0 : Math.PI;
    this.emit(EV.MEGA_CRY, -1, w.x, w.y, 220);
  }

  private userFlyby(w: Worm, st: NonNullable<Worm['user']>, _dt: number): void {
    const f = USER.flyby;
    const b = this.arena.bounds;
    const u = Math.max(0, Math.min(1, st.t / f.duration));
    const span = b.right - b.left + 1000;
    st.flyX = st.flyDir > 0 ? b.left - 500 + span * u : b.right + 500 - span * u;
    st.flyY = b.top + USER.hoverY + Math.sin(u * Math.PI) * 90;
    st.flyAngle = st.flyDir > 0 ? 0 : Math.PI;
    // Two strafing volleys per pass, from the head. They are ordinary bolts, so they
    // are caught by the same guard and lash as everything else.
    const nextAt = st.flyVolleys === 0 ? 0.28 : 0.62;
    if (st.flyVolleys < f.volleyCount && u >= nextAt) {
      st.flyVolleys++;
      const target = this.threatTarget(st.flyX, st.flyY);
      const base = Math.atan2(target.y - st.flyY, target.x - st.flyX);
      for (let i = 0; i < f.volley; i++) {
        const offset = (i - (f.volley - 1) * 0.5) * f.spread;
        this.spawnHostileProjectile(
          st.flyX,
          st.flyY + 40,
          base + offset,
          f.speed,
          f.radius,
          f.damage,
          3,
          f.ttl,
          this.worms.indexOf(w),
          0,
          SRC.WORM,
        );
      }
      this.emit(EV.EXPLODE, -1, st.flyX, st.flyY, 80);
    }
  }

  private damageUser(
    w: Worm,
    amount: number,
    sourceSlot: number,
    dirX: number,
    dirY: number,
    hitX: number,
    hitY: number,
  ): void {
    const st = w.user;
    if (!st || !w.active) return;
    w.hp -= amount;
    w.hitFlash = 0.2;
    st.flash = Math.max(st.flash, 0.1);
    const hx = Number.isFinite(hitX) ? hitX : w.x;
    const hy = Number.isFinite(hitY) ? hitY : w.y;
    this.emit(EV.WORM_HIT, sourceSlot, hx, hy, amount, dirX, dirY);
    if (w.hp > 0) return;
    w.hp = 0;
    w.active = false;
    w.user = null;
    this.emit(EV.WORM_KILL, sourceSlot, w.x, w.y, 620, dirX, dirY);
    if (sourceSlot === 0) {
      this.gauntletKills++;
      this.dropPickupFromKill(w.x, w.y, true);
    }
  }

  // --- Mega Worm -----------------------------------------------------------
  //
  // The boss is still a Worm: it lives in the same pool, so bots, projectiles,
  // melee sweeps, blasts and arena hazards already target it. What changes is that
  // every plate on the chain carries its own health, and a plate that breaks either
  // promotes a new head or tears the chain in two.

  private megaNodeX(w: Worm, node: number): number {
    return node === 0 ? w.x : w.segX[node - 1];
  }

  private megaNodeY(w: Worm, node: number): number {
    return node === 0 ? w.y : w.segY[node - 1];
  }

  /** Two jagged bolts peel off opposite sides of the body during a straight pass. */
  private fireMegaVolley(w: Worm): void {
    const cfg = MEGA_WORM.flyby.volley;
    // Fire from the head shoulder, not a tail plate buried offscreen. The two bolts are
    // the read that says the fly-by is attacking, and they are reflectable back at it.
    const node = 0;
    const ox = this.megaNodeX(w, node);
    const oy = this.megaNodeY(w, node);
    const srcId = this.worms.indexOf(w);
    for (let side = -1; side <= 1; side += 2) {
      const normal = w.angle + side * Math.PI * 0.5;
      const aim = normal + this.rng.range(-cfg.spread, cfg.spread);
      const sx = ox + Math.cos(normal) * w.segR * 0.72;
      const sy = oy + Math.sin(normal) * w.segR * 0.72;
      this.spawnHostileProjectile(sx, sy, aim, cfg.speed, cfg.radius, cfg.damage, 20, cfg.ttl, srcId, 0, SRC.WORM);
    }
  }

  /**
   * The Mega Worm's body is one straight capsule, not a row of independent circles.
   * Its head keeps the larger radius; the rest is a single line to the tail plate.
   */
  private megaBodyHit(w: Worm, x: number, y: number, pad: number): boolean {
    const hdx = x - w.x;
    const hdy = y - w.y;
    if (hdx * hdx + hdy * hdy <= (w.hitR + pad) ** 2) return true;
    // Plates already burst no longer eat shots; the live capsule shrinks with the tail.
    const segs = w.megaDeath >= 1 ? Math.max(0, w.segCount - w.megaDeathSegs) : w.segCount;
    if (segs <= 0) return false;
    const tail = segs - 1;
    return this.pointSegmentDistance2(x, y, w.x, w.y, w.segX[tail], w.segY[tail]) <= (w.segR + pad) ** 2;
  }

  /** Squared distance from a point to a line segment. */
  private pointSegmentDistance2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2)) : 0;
    const dx = px - (ax + abx * t);
    const dy = py - (ay + aby * t);
    return dx * dx + dy * dy;
  }


  /**
   * Boss bodies clamp against half their radius, not the whole body: a silhouette that
   * needs to be big may sit through an arena wall instead of being squeezed into the
   * playfield. Half the body stays inside, so it is still hittable and its attacks still
   * land in the arena. Ordinary worms, players, pickups and projectiles keep full-radius
   * clamping; this is a mini-boss rule, not a global one.
   */
  private bossEdgePad(w: Worm): number {
    return w.hitR * 0.5;
  }

  /** True while any mini-boss body is on the floor. Presentation polls this. */
  minibossAlive(): boolean {
    return this.minibossLiveCount() > 0;
  }

  /** Live bodies of one mini-boss kind; -1 counts every mini-boss on the floor. */
  private minibossLiveCount(kind = -1): number {
    let live = 0;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || w.bossKind < 0) continue;
      // Starfish arms are part of one boss, not extra bosses on the floor.
      if (w.armState) continue;
      if (kind >= 0 && w.bossKind !== kind) continue;
      live++;
    }
    return live;
  }

  /**
   * Idle Hands, Starfish and File Blob are smaller-arena bosses; edge ingress can load
   * them offscreen. Anchor them around the nearest live player instead. Hands ring the
   * player, the other two sit a short distance toward the arena center. Mega Worm and
   * Storm Cloud keep their own staging points.
   */
  private bossNearPlayer(body: string, x?: number, y?: number): { x: number; y: number } {
    const p = this.threatTarget(x ?? this.centerX, y ?? this.centerY);
    if (!p || !p.alive) return { x: x ?? this.centerX, y: y ?? this.centerY };
    if (body === 'idle-hands') return { x: p.x, y: p.y };
    let dx = this.centerX - p.x;
    let dy = this.centerY - p.y;
    if (Math.hypot(dx, dy) < 1) {
      dx = (x ?? this.centerX) - p.x;
      dy = (y ?? this.centerY) - p.y;
    }
    if (Math.hypot(dx, dy) < 1) {
      dx = 1;
      dy = 0;
    }
    const d = Math.hypot(dx, dy);
    const distance = body === 'blob' ? 360 : 440;
    const pad = body === 'blob' ? BLOB.rMax : STARFISH.armReach + STARFISH.armRadius;
    const b = this.arena.bounds;
    return {
      x: Math.max(b.left + pad, Math.min(b.right - pad, p.x + (dx / d) * distance)),
      y: Math.max(b.top + pad, Math.min(b.bottom - pad, p.y + (dy / d) * distance)),
    };
  }

  /**
   * The single entry point for mini-bosses. Anything that can spawn a threat can spawn one
   * of these by id; the wave gate and any scripted level call this, not a bespoke method.
   */
  spawnMiniboss(kind: number, x?: number, y?: number): Worm | null {
    const def = minibossDef(kind);
    if (!def) return null;
    let boss: Worm | null = null;
    if (def.body === 'segmented-worm') boss = this.spawnMegaWorm(x, y, kind);
    else if (def.body === 'idle-hands') {
      const p = this.bossNearPlayer('idle-hands', x, y);
      boss = this.spawnIdleHands(p.x, p.y);
    } else if (def.body === 'starfish') {
      const p = this.bossNearPlayer('starfish', x, y);
      boss = this.spawnStarfish(p.x, p.y, true);
    } else if (def.body === 'blob') {
      const p = this.bossNearPlayer('blob', x, y);
      boss = this.spawnBlob(p.x, p.y);
    } else if (def.body === 'storm-cloud') {
      boss = this.spawnStormCloud(x ?? this.centerX, (y ?? this.centerY) - 180);
    } else if (def.body === 'user') {
      // The finale owns the whole top of the arena, so its staged position is authored
      // by the body, not by the caller's hint.
      boss = this.spawnUser(x, y);
    }
    // Every staged boss owns the room for its entrance beat, including the storm,
    // which assembles from a single square while the camera holds on it.
    if (boss && this.mode === 'gauntlet' && !this.attractMode) {
      this.beginBossIntro(kind, boss);
    }
    return boss;
  }

  /** Start the frozen entrance beat for one of the staged bosses. */
  private beginBossIntro(kind: number, boss: Worm): void {
    if (this.bossIntro) return;
    const def = minibossDef(kind);
    if (!def) return;
    const duration =
      kind === MINIBOSS.MEGA_WORM
        ? MEGA_WORM.entrance.time + MEGA_WORM.entrance.roar + 0.5
        : kind === MINIBOSS.BLOB
          ? BLOB.introTime
          : kind === MINIBOSS.IDLE_HANDS
            ? IDLE_HANDS.introTime
            : kind === MINIBOSS.STORM_CLOUD
              ? STORM_CLOUD.introTime
              : kind === MINIBOSS.USER
                ? USER.introTime
                : STARFISH.introTime;
    // The storm's entrance is drawn from `spawnT`: hold the body on its assembly clock
    // for the whole beat, so the last square lands as the title card clears.
    if (kind === MINIBOSS.STORM_CLOUD || kind === MINIBOSS.USER) boss.spawnT = duration;
    this.bossIntro = { kind, label: def.label, t: 0, duration, x: boss.x, y: boss.y };
  }

  /**
   * The entrance owns the simulation clock: only the boss reveal advances, and the
   * camera reads `bossIntro` from the world. Inputs are cleared by `step`.
   */
  private updateBossIntro(dt: number): void {
    const intro = this.bossIntro;
    if (!intro) return;
    intro.t = Math.min(intro.duration, intro.t + dt);
    let focus: Worm | null = null;
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active || w.bossKind !== intro.kind || w.armState) continue;
      if (!focus) focus = w;
      if (w.spawnT > 0) w.spawnT = Math.max(0, w.spawnT - dt);
      sx += w.x;
      sy += w.y;
      count++;
    }
    if (focus) {
      if (intro.kind === MINIBOSS.MEGA_WORM) {
        if (focus.entryT > 0) this.updateMegaEntrance(focus, dt, false);
        else if (focus.roarT > 0) focus.roarT = Math.max(0, focus.roarT - dt);
        this.followMegaChain(focus, dt);
        intro.x = focus.x;
        intro.y = focus.y;
      } else if (count > 0) {
        intro.x = sx / count;
        intro.y = sy / count;
      }
    }
    if (intro.t >= intro.duration) {
      for (let i = 0; i < this.worms.length; i++) {
        const w = this.worms[i];
        if (!w.active || w.bossKind !== intro.kind) continue;
        w.spawnT = 0;
        if (w.mega) {
          w.entryT = 0;
          w.roarT = 0;
        }
      }
      this.bossIntro = null;
    }
  }

  /** Land a boss. Its plates are strung out behind the head along its facing. */
  private spawnMegaWorm(x?: number, y?: number, kind: number = MINIBOSS.MEGA_WORM): Worm | null {
    let w: Worm | null = null;
    for (let i = 0; i < this.worms.length; i++) {
      if (!this.worms[i].active) {
        w = this.worms[i];
        break;
      }
    }
    if (!w) return null;
    const b = this.arena.bounds;
    const maxHalf = Math.max(b.right - b.left, b.bottom - b.top) * 0.5;
    const hintX = x ?? this.centerX;
    const hintY = y ?? this.centerY;
    let hintA = Math.atan2(hintY - this.centerY, hintX - this.centerX);
    if (Math.hypot(hintX - this.centerX, hintY - this.centerY) < 1) hintA = this.rng.range(0, Math.PI * 2);
    w.active = true;
    w.mega = true;
    w.bossKind = kind;
    w.held = false;
    w.hitR = MEGA_WORM.headRadius;
    w.segR = MEGA_WORM.segmentRadius;
    w.shrink = 1;
    // Start the head outside the floor. The entrance route below brings it around
    // the arena and over the fight instead of dropping it into the player's lap.
    w.entryA = hintA;
    w.entryR = maxHalf + MEGA_WORM.headRadius + MEGA_WORM.entrance.offscreen;
    w.entryT = MEGA_WORM.entrance.time;
    w.x = this.centerX + Math.cos(hintA) * w.entryR;
    w.y = this.centerY + Math.sin(hintA) * w.entryR;
    w.prevX = w.x;
    w.prevY = w.y;
    w.vx = 0;
    w.vy = 0;
    w.kx = 0;
    w.ky = 0;
    w.angle = Math.atan2(this.centerY - w.y, this.centerX - w.x);
    w.flyPhase = 0;
    w.flyT = 0;
    w.flyCd = MEGA_WORM.entrance.handoff;
    w.flyDX = Math.cos(w.angle);
    w.flyDY = Math.sin(w.angle);
    w.roarT = 0;
    w.megaPass = 0;
    w.megaRage = false;
    w.megaDeath = -1;
    w.megaDeathT = 0;
    w.megaDeathSegs = 0;
    w.megaDeathSpin = 0;
    w.megaDeathBy = -1;
    w.megaWatchT = 0;
    w.volleyT = 0.4;
    w.anchorX = w.x;
    w.anchorY = w.y;
    w.patrolX = w.x;
    w.patrolY = w.y;
    w.aggroT = 0;
    w.segCount = MEGA_WORM.segments;
    w.spawnT = 0;
    w.touchCd = 0;
    w.hitFlash = 0;
    w.infected = false;
    w.phase = this.rng.range(0, Math.PI * 2);
    w.pinT = 0;
    w.legs = false;
    w.eyeT = 1.4;
    // One rigid straight body: every plate sits behind the head on its heading. The
    // boss is offscreen for its entrance and for every staged pass, so the full length
    // never has to fold into the room.
    const nodes = MEGA_WORM.maxSegments + 1;
    for (let i = 0; i < nodes - 1; i++) {
      const sx = w.x - Math.cos(w.angle) * MEGA_WORM.spacing * (i + 1);
      const sy = w.y - Math.sin(w.angle) * MEGA_WORM.spacing * (i + 1);
      w.segX[i] = sx;
      w.segY[i] = sy;
      w.segPrevX[i] = sx;
      w.segPrevY[i] = sy;
      w.segAngle[i] = w.angle;
    }
    // One pool for the whole silhouette. The plate count is presentation now.
    w.maxHp = MEGA_WORM.headHp + w.segCount * MEGA_WORM.hpPerSegment;
    w.hp = w.maxHp;
    this.emit(EV.PROP_BREAK, 0, w.x, w.y, 64);
    return w;
  }

  /**
   * One pool, one boss. A hit anywhere on the body removes health from the same total;
   * plates never break, promote or detach. The straight-line body is a sponge, not a
   * segmented creature, so where a shot lands only changes the spark position.
   */
  private damageMegaWorm(
    w: Worm,
    amount: number,
    sourceSlot: number,
    dirX: number,
    dirY: number,
    force: number,
    hitX: number,
    hitY: number,
  ): void {
    if (!w.active || w.megaDeath >= 0) return;
    w.hp -= amount;
    w.hitFlash = 0.22;
    if (sourceSlot >= 0) w.aggroT = MEGA_WORM.aggroTime;
    // A hit sparks, but it never shoves the flight line: the Worm is a straight-line
    // body, so damage must not turn a pass into a drift.
    const hx = Number.isFinite(hitX) ? hitX : w.x;
    const hy = Number.isFinite(hitY) ? hitY : w.y;
    this.emit(EV.MEGA_HIT, sourceSlot, hx, hy, amount, dirX, dirY);
    if (w.hp <= 0) {
      this.beginMegaDeath(w, sourceSlot);
      return;
    }
    // The low-health turn is one extra scream, then every staged pass is quicker.
    // The threshold is data so a future boss can keep the same rule at a new HP pool.
    if (!w.megaRage && w.hp <= w.maxHp * MEGA_WORM.flyby.rageAt) {
      w.megaRage = true;
      w.roarT = MEGA_WORM.entrance.roar;
      this.emit(EV.MEGA_CRY, -1, w.x, w.y, w.hitR);
    }
  }

  /**
   * Lethal hit starts the death choreography instead of deleting the whole body. The
   * boss stays active but harmless so the camera and campaign clear wait for the head.
   */
  private beginMegaDeath(w: Worm, sourceSlot: number): void {
    if (w.megaDeath >= 0) return;
    w.hp = 0;
    w.megaDeath = 0;
    w.megaDeathT = 0;
    w.megaDeathSegs = 0;
    w.megaDeathSpin = 0;
    w.megaDeathBy = sourceSlot;
    w.aggroT = 0;
    w.touchCd = 999;
    w.volleyT = 999;
    // Continue a crossing already in progress. If the body is parked off-map or already
    // at the far lip, stage one last lane so the player still gets a full flyover.
    if (w.flyPhase !== 0 || w.entryT > 0 || w.spawnT > 0 || this.megaDeathAtFarRim(w)) {
      this.stageMegaPass(w);
      w.spawnT = 0;
      w.entryT = 0;
      w.flyPhase = 0;
      this.beginMegaPass(w);
      w.touchCd = 999;
      w.volleyT = 999;
      w.prevX = w.x;
      w.prevY = w.y;
    }
    this.emit(EV.MEGA_CRY, -1, w.x, w.y, w.hitR);
  }

  /** True when the head has reached the far rim of its current straight lane. */
  private megaDeathAtFarRim(w: Worm): boolean {
    const b = this.arena.bounds;
    const ux = Math.cos(w.angle);
    const uy = Math.sin(w.angle);
    const lip = w.hitR * 0.55;
    if (Math.abs(ux) >= Math.abs(uy)) {
      return ux >= 0 ? w.x >= b.right - lip : w.x <= b.left + lip;
    }
    return uy >= 0 ? w.y >= b.bottom - lip : w.y <= b.top + lip;
  }

  /**
   * Death choreography: one last crossing, then the plates burst from the tail
   * forward. The head is last: it spins in place before its final explosion.
   */
  private updateMegaDeath(w: Worm, dt: number): void {
    w.prevX = w.x;
    w.prevY = w.y;
    w.phase += dt;
    if (w.hitFlash > 0) w.hitFlash = Math.max(0, w.hitFlash - dt);
    if (w.megaDeath === 0) {
      const speed = MEGA_WORM.death.speed;
      w.vx = Math.cos(w.angle) * speed;
      w.vy = Math.sin(w.angle) * speed;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      this.followMegaChain(w, dt);
      if (this.megaDeathAtFarRim(w)) {
        w.vx = 0;
        w.vy = 0;
        w.megaDeath = 1;
        w.megaDeathT = 0;
      }
      return;
    }
    if (w.megaDeath === 1) {
      w.vx = 0;
      w.vy = 0;
      w.megaDeathT += dt;
      const interval = MEGA_WORM.death.segmentInterval;
      while (w.megaDeathSegs < w.segCount && w.megaDeathT >= interval) {
        w.megaDeathT -= interval;
        const seg = w.segCount - 1 - w.megaDeathSegs;
        const x = w.segX[seg];
        const y = w.segY[seg];
        w.megaDeathSegs++;
        this.emit(EV.MEGA_DEATH, w.megaDeathBy, x, y, MEGA_WORM.death.segmentBurst, 0, 0);
      }
      if (w.megaDeathSegs >= w.segCount) {
        w.megaDeath = 2;
        w.megaDeathT = 0;
        w.megaDeathSpin = 0;
      }
      return;
    }
    if (w.megaDeath === 2) {
      w.vx = 0;
      w.vy = 0;
      w.megaDeathT += dt;
      w.megaDeathSpin += dt * MEGA_WORM.death.headSpinRate;
      if (w.megaDeathT >= MEGA_WORM.death.headSpinTime) this.finishMegaDeath(w);
    }
  }

  private finishMegaDeath(w: Worm): void {
    const sourceSlot = w.megaDeathBy;
    this.emit(EV.WORM_KILL, sourceSlot, w.x, w.y, 220, 0, 0);
    this.emit(EV.MEGA_DEATH, sourceSlot, w.x, w.y, MEGA_WORM.death.headBurst, 0, 0);
    this.emit(EV.MEGA_CRY, sourceSlot, w.x, w.y, w.hitR);
    w.active = false;
    w.segCount = 0;
    w.megaDeath = 3;
    w.vx = 0;
    w.vy = 0;
    if (sourceSlot === 0) {
      this.gauntletKills++;
      this.dropPickupFromKill(w.x, w.y, true);
    }
  }

  private updateMegaWorm(w: Worm, dt: number): void {
    // The entrance cut owns the body. `step` deliberately keeps the squad live during
    // this beat, but the worm must not advance twice through the normal threat loop.
    if (this.bossIntro?.kind === MINIBOSS.MEGA_WORM) return;
    if (w.megaDeath >= 0) {
      this.updateMegaDeath(w, dt);
      return;
    }
    w.prevX = w.x;
    w.prevY = w.y;
    w.phase += dt;
    if (w.hitFlash > 0) w.hitFlash = Math.max(0, w.hitFlash - dt);
    if (w.touchCd > 0) w.touchCd = Math.max(0, w.touchCd - dt);
    if (w.eyeT > 0) w.eyeT = Math.max(0, w.eyeT - dt);
    if (w.flyCd > 0) w.flyCd = Math.max(0, w.flyCd - dt);
    if (w.spawnT > 0) {
      w.spawnT = Math.max(0, w.spawnT - dt);
      w.vx = 0;
      w.vy = 0;
      this.followMegaChain(w, dt);
      return;
    }
    if (w.spawnT <= 0 && w.flyPhase === 2) this.beginMegaPass(w);
    // Recovery watchdog: a pass that somehow stops advancing is restaged instead of
    // leaving the boss parked offscreen for the rest of the fight.
    if (
      (w.flyPhase === 0 && Math.abs(w.vx) + Math.abs(w.vy) < 0.01) ||
      (w.flyPhase === 2 && w.spawnT <= 0)
    ) {
      w.megaWatchT += dt;
      if (w.megaWatchT > 0.65) {
        w.megaWatchT = 0;
        this.stageMegaPass(w);
        w.spawnT = 0;
        this.beginMegaPass(w);
        return;
      }
    } else {
      w.megaWatchT = 0;
    }
    if (w.pinT > 0) {
      w.pinT = Math.max(0, w.pinT - dt);
      w.vx = 0;
      w.vy = 0;
      this.followMegaChain(w, dt);
      return;
    }

    if (w.entryT > 0) {
      this.updateMegaEntrance(w, dt);
      return;
    }
    const p = this.threatTarget(w.x, w.y);
    const dist = Math.hypot(p.x - w.x, p.y - w.y);
    if (p.alive && p.cloakT <= 0 && dist < MEGA_WORM.aggroRadius) {
      w.aggroT = MEGA_WORM.aggroTime;
    } else {
      w.aggroT = Math.max(0, w.aggroT - dt);
    }

    const fly = MEGA_WORM.flyby;
    // Continuous flight: one long straight run, then a wide turn outside the arena that
    // curls back over the player. The body trails the head, so the turn bends the chain
    // instead of swinging a rigid stick through it.
    if (w.flyPhase === 0) {
      w.flyT += dt;
      // One straight pass along the latched line. The pattern never changes; only the speed
      // does, ramping with the segments already lost so the last third arrives much faster.
      const missing = 1 - Math.max(0, Math.min(1, w.hp / Math.max(1, w.maxHp)));
      const speed = fly.speed * (1 + missing * fly.rageSpeed + (w.megaRage ? fly.rageBoost : 0));
      w.vx = Math.cos(w.angle) * speed;
      w.vy = Math.sin(w.angle) * speed;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      this.followMegaChain(w, dt);
      w.volleyT -= dt;
      if (w.volleyT <= 0 && w.flyT > 0.18) {
        this.fireMegaVolley(w);
        w.volleyT = fly.volley.interval;
      }
      // Contact is the whole attack: the body is a sponge that flies over the floor.
      this.megaTouch(w, p);
      const past = (w.x - w.anchorX) * Math.cos(w.angle) + (w.y - w.anchorY) * Math.sin(w.angle);
      if (past > fly.exitRange) {
        w.flyPhase = 1;
        w.flyT = 0;
      }
      return;
    }
    if (w.flyPhase === 1) {
      // Run clear of the floor, then leave. The body is parked beyond the lip and comes back
      // on a fresh line, which is what lines the next pass up instead of a wide turn.
      w.flyT += dt;
      const missing = 1 - Math.max(0, Math.min(1, w.hp / Math.max(1, w.maxHp)));
      const leaveSpeed =
        fly.speed * (1 + missing * fly.rageSpeed + (w.megaRage ? fly.rageBoost : 0));
      w.vx = Math.cos(w.angle) * leaveSpeed;
      w.vy = Math.sin(w.angle) * leaveSpeed;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      this.followMegaChain(w, dt);
      if (w.flyT >= fly.leaveTime) this.stageMegaPass(w);
      return;
    }
  }

  /**
   * Park the head offscreen on the next fixed fly-by lane. Every pass crosses a lane
   * the player can read from the arena floor; the worm never aims at a body. Four
   * lanes alternate horizontal and vertical approaches.
   */
  private stageMegaPass(w: Worm): void {
    const cfg = MEGA_WORM.flyby;
    const b = this.arena.bounds;
    const spanX = b.right - b.left;
    const spanY = b.bottom - b.top;
    const lanes = [
      { fx: 0.5, fy: 0.5, angle: 0 },
      { fx: 0.5, fy: 0.28, angle: Math.PI },
      { fx: 0.26, fy: 0.5, angle: -Math.PI / 2 },
      { fx: 0.74, fy: 0.5, angle: Math.PI / 2 },
    ];
    const lane = lanes[(w.megaPass ?? 0) % lanes.length];
    w.megaPass = (w.megaPass ?? 0) + 1;
    w.anchorX = b.left + spanX * lane.fx;
    w.anchorY = b.top + spanY * lane.fy;
    w.x = w.anchorX - Math.cos(lane.angle) * cfg.entryDistance;
    w.y = w.anchorY - Math.sin(lane.angle) * cfg.entryDistance;
    w.vx = 0;
    w.vy = 0;
    w.kx = 0;
    w.ky = 0;
    w.angle = lane.angle;
    w.aggroT = MEGA_WORM.aggroTime;
    w.spawnT = w.megaRage ? cfg.rageRepeatDelay : cfg.repeatDelay;
    w.volleyT = 0.3;
    w.flyPhase = 2;
    w.flyT = 0;
    w.megaWatchT = 0;
    w.touchCd = w.spawnT;
    for (let i = 0; i < w.segCount; i++) {
      w.segX[i] = w.x - Math.cos(w.angle) * MEGA_WORM.spacing * (i + 1);
      w.segY[i] = w.y - Math.sin(w.angle) * MEGA_WORM.spacing * (i + 1);
      w.segPrevX[i] = w.segX[i];
      w.segPrevY[i] = w.segY[i];
      w.segAngle[i] = w.angle;
    }
  }

  /**
   * The entrance is intentionally outside the normal orbit: one long, readable arc that
   * starts beyond the arena lip, sweeps around it and closes over the floor. It has no
   * bite, whip or acid; the first combat pass starts only after the handoff.
   */
  private updateMegaEntrance(w: Worm, dt: number, allowTouch = true): void {
    const cfg = MEGA_WORM.entrance;
    // Campaign staging: one slow, harmless fly-past over the arena while the worm
    // roars. The body crosses the whole width instead of circling the player, and the
    // first combat lane is staged only after the entrance beat ends.
    if (this.campaign && this.bossIntro?.kind === MINIBOSS.MEGA_WORM) {
      w.entryT = Math.max(0, w.entryT - dt);
      const raw = 1 - w.entryT / cfg.time;
      const b = this.arena.bounds;
      const off = cfg.offscreen;
      w.x = b.left - off + (b.right - b.left + off * 2) * raw;
      w.y = b.top + (b.bottom - b.top) * 0.46;
      w.prevX = w.x;
      w.prevY = w.y;
      w.angle = 0;
      w.vx = (b.right - b.left + off * 2) / cfg.time;
      w.vy = 0;
      if (w.roarT > 0) w.roarT = Math.max(0, w.roarT - dt);
      if (w.roarT <= 0 && raw > 0.18) {
        w.roarT = cfg.roar;
        this.emit(EV.MEGA_CRY, -1, w.x, w.y, w.hitR);
      }
      this.followMegaChain(w, dt);
      if (w.entryT <= 0) {
        w.entryT = 0;
        w.vx = 0;
        w.vy = 0;
        this.stageMegaPass(w);
      }
      return;
    }
    w.entryT = Math.max(0, w.entryT - dt);
    const elapsed = cfg.time - w.entryT;
    const raw = Math.min(1, elapsed / cfg.time);
    const eased = raw * raw * (3 - 2 * raw);
    const half = Math.max(this.arena.bounds.right - this.arena.bounds.left, this.arena.bounds.bottom - this.arena.bounds.top) * 0.5;
    const angle = w.entryA + cfg.sweep * (0.08 + 0.92 * eased);
    const radius = w.entryR + (half * cfg.endRadiusMult - w.entryR) * eased;
    this.steerMega(
      w,
      this.centerX + Math.cos(angle) * radius,
      this.centerY + Math.sin(angle) * radius,
      cfg.speed,
      cfg.turnRate,
      dt,
    );
    w.x += (w.vx + w.kx) * dt;
    w.y += (w.vy + w.ky) * dt;
    w.kx *= Math.exp(-MEGA_WORM.knockDrag * dt);
    w.ky *= Math.exp(-MEGA_WORM.knockDrag * dt);
    this.followMegaChain(w, dt);
    if (allowTouch) this.megaTouch(w, this.threatTarget(w.x, w.y));
    if (w.entryT <= 0) {
      w.entryT = 0;
      // The lap ends in a bird cry: the event owns the audio and the screen shake, the
      // roar timer owns the maw/ring beat that was already here.
      this.emit(EV.MEGA_CRY, -1, w.x, w.y, w.hitR);
      w.roarT = cfg.roar;
      // The first straight run leaves from the entrance; later passes teleport off-map.
      const target = this.threatTarget(w.x, w.y);
      this.latchMegaTarget(w, target);
      this.beginMegaPass(w);
    }
  }

  /** Turn the head toward a point and cruise at a fixed speed. */
  private steerMega(w: Worm, tx: number, ty: number, speed: number, turnRate: number, dt: number): void {
    this.faceMega(w, Math.atan2(ty - w.y, tx - w.x), turnRate, dt);
    w.vx = Math.cos(w.angle) * speed;
    w.vy = Math.sin(w.angle) * speed;
  }

  /** Angular approach with a hard per-frame turn cap, so a pass is readable. */
  private faceMega(w: Worm, desired: number, turnRate: number, dt: number): void {
    let diff = desired - w.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = turnRate * dt;
    w.angle += Math.max(-turn, Math.min(turn, diff));
  }

  /**
   * Every plate hangs straight behind the head on the locked heading. There is no follow
   * lag and no coil: the silhouette is one rigid line, and a pass reads as a single body
   * crossing the room instead of a snake turning. Plates still ignore cover and the
   * arena lip, which is why the body can be staged off the map.
   */
  private followMegaChain(w: Worm, _dt: number): void {
    const ux = Math.cos(w.angle);
    const uy = Math.sin(w.angle);
    for (let i = 0; i < w.segCount; i++) {
      w.segPrevX[i] = w.segX[i];
      w.segPrevY[i] = w.segY[i];
      // Exact placement, no follow lag: the body is one rigid line, so every plate
      // keeps its authored overlap even while the head is crossing at speed.
      w.segX[i] = w.x - ux * MEGA_WORM.spacing * (i + 1);
      w.segY[i] = w.y - uy * MEGA_WORM.spacing * (i + 1);
      w.segAngle[i] = w.angle;
    }
  }

  /** Remember the position the boss last detected; passes aim at this, not at the player now. */
  private latchMegaTarget(w: Worm, p: Player): void {
    if (p && p.alive && p.cloakT <= 0) {
      w.anchorX = p.x;
      w.anchorY = p.y;
    }
  }

  /** Begin the straight run along the current heading; the turn sets that heading. */
  private beginMegaPass(w: Worm): void {
    w.angle = Math.atan2(w.anchorY - w.y, w.anchorX - w.x);
    w.flyDX = Math.cos(w.angle);
    w.flyDY = Math.sin(w.angle);
    w.flyPhase = 0;
    w.flyT = 0;
    w.touchCd = Math.min(w.touchCd, 0.15);
    w.aggroT = MEGA_WORM.aggroTime;
    w.volleyT = 0.3;
    this.followMegaChain(w, 0);
  }

  private megaTouch(w: Worm, p: Player): void {
    if (w.megaDeath >= 0 || !p.alive || p.cloakT > 0 || w.touchCd > 0) return;
    // Contact uses the same capsule as fire: head circle plus one body line. No loop
    // over thirteen plates, and no seam a body can slip through.
    let hit = false;
    let hx = p.x - w.x;
    let hy = p.y - w.y;
    if (hx * hx + hy * hy <= (w.hitR + PLAYER.radius) ** 2) {
      hit = true;
    } else if (w.segCount > 0) {
      const tail = w.segCount - 1;
      const ax = w.x;
      const ay = w.y;
      const abx = w.segX[tail] - ax;
      const aby = w.segY[tail] - ay;
      const len2 = abx * abx + aby * aby;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - ax) * abx + (p.y - ay) * aby) / len2)) : 0;
      hx = p.x - (ax + abx * t);
      hy = p.y - (ay + aby * t);
      if (hx * hx + hy * hy <= (w.segR + PLAYER.radius) ** 2) hit = true;
    }
    if (!hit) return;
    const d = Math.hypot(hx, hy) || 1;
    w.touchCd = MEGA_WORM.touchCooldown;
    this.damagePlayer(
      p,
      MEGA_WORM.touchDamage,
      -1,
      hx / d,
      hy / d,
      MEGA_WORM.knockback,
      SRC.WORM,
      this.worms.indexOf(w),
    );
  }

  private updateWorm(w: Worm, dt: number): void {
    if (w.bossKind === MINIBOSS.IDLE_HANDS) {
      this.updateIdleHand(w, dt);
      return;
    }
    if (w.bossKind === MINIBOSS.STARFISH) {
      if (w.armState) this.updateStarfishArm(w, dt);
      else this.updateStarfish(w, dt);
      return;
    }
    if (w.bossKind === MINIBOSS.BLOB) {
      this.updateBlob(w, dt);
      return;
    }
    if (w.bossKind === MINIBOSS.STORM_CLOUD) {
      this.updateStormCloud(w, dt);
      return;
    }
    if (w.bossKind === MINIBOSS.USER) {
      this.updateUser(w, dt);
      return;
    }
    if (w.mega) {
      this.updateMegaWorm(w, dt);
      return;
    }
    w.prevX = w.x;
    w.prevY = w.y;
    w.phase += dt;
    if (w.hitFlash > 0) w.hitFlash = Math.max(0, w.hitFlash - dt);
    if (w.touchCd > 0) w.touchCd = Math.max(0, w.touchCd - dt);
    if (w.biteCd > 0) w.biteCd = Math.max(0, w.biteCd - dt);
    if (w.biteT > 0) w.biteT = Math.max(0, w.biteT - dt);
    if (w.dashCd > 0) w.dashCd = Math.max(0, w.dashCd - dt);
    if (w.dashT > 0) w.dashT = Math.max(0, w.dashT - dt);
    if (w.stunT > 0) {
      // A parried dash leaves the worm in a committed stun: no steering, bite or dash.
      w.stunT = Math.max(0, w.stunT - dt);
      w.vx = 0;
      w.vy = 0;
      w.x += w.kx * dt;
      w.y += w.ky * dt;
      w.kx *= Math.exp(-WORM.knockDrag * dt);
      w.ky *= Math.exp(-WORM.knockDrag * dt);
      return;
    }
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

    const p = this.threatTarget(w.x, w.y);
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
    // A worm outside bite range and inside its dash band commits to a straight lunge.
    // The wind-up and the latched line are the counterplay; cover still stops it.
    if (
      w.dashT <= 0 &&
      w.dashCd <= 0 &&
      w.biteT <= 0 &&
      w.aggroT > 0 &&
      p.alive &&
      p.cloakT <= 0 &&
      biteDistSq >= WORM.dashMinRange * WORM.dashMinRange &&
      biteDistSq <= WORM.dashRange * WORM.dashRange &&
      !this.lineBlocked(w.x, w.y, p.x, p.y)
    ) {
      const d = Math.sqrt(biteDistSq) || 1;
      w.dashT = WORM.dashWindup + WORM.dashActive + WORM.dashRecovery;
      w.dashCd = WORM.dashCooldown;
      w.dashHit = false;
      w.dashDirX = pdx / d;
      w.dashDirY = pdy / d;
    }
    const dashElapsed =
      w.dashT > 0 ? WORM.dashWindup + WORM.dashActive + WORM.dashRecovery - w.dashT : -1;
    if (
      w.dashT > 0 &&
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

    if (w.dashT > 0) {
      w.angle = Math.atan2(w.dashDirY, w.dashDirX);
      if (dashElapsed < WORM.dashWindup) {
        w.vx = 0;
        w.vy = 0;
      } else if (dashElapsed < WORM.dashWindup + WORM.dashActive) {
        w.vx = w.dashDirX * WORM.dashSpeed;
        w.vy = w.dashDirY * WORM.dashSpeed;
      } else {
        w.vx = 0;
        w.vy = 0;
      }
    } else if (w.biteT > 0) {
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
    this.pushOutOfCover(w, w.hitR);

    // Dash contact. A guard or a timed lash is resolved in `tryParryDash`, before any
    // health is spent, so a perfect parry stops the lunge and stuns the worm.
    if (
      dashElapsed >= WORM.dashWindup &&
      dashElapsed < WORM.dashWindup + WORM.dashActive &&
      !w.dashHit &&
      p.alive &&
      p.cloakT <= 0
    ) {
      const bdx = p.x - w.x;
      const bdy = p.y - w.y;
      const reach = WORM.headRadius + PLAYER.radius;
      if (bdx * bdx + bdy * bdy <= reach * reach) {
        const d = Math.hypot(bdx, bdy) || 1;
        w.dashHit = true;
        w.aggroT = WORM.aggroTime;
        this.damagePlayer(
          p,
          WORM.dashDamage,
          -1,
          bdx / d,
          bdy / d,
          WORM.dashKnockback,
          SRC.WORM,
          this.worms.indexOf(w),
        );
      }
    }

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
      w.segX[i] = Math.max(this.arena.bounds.left + w.segR, Math.min(this.arena.bounds.right - w.segR, w.segX[i]));
      w.segY[i] = Math.max(this.arena.bounds.top + w.segR, Math.min(this.arena.bounds.bottom - w.segR, w.segY[i]));
      for (let p = 0; p < this.solids.length; p++) {
        if (!circleRect(w.segX[i], w.segY[i], w.segR, this.solids[p], hitScratch)) continue;
        w.segX[i] = hitScratch.px;
        w.segY[i] = hitScratch.py;
      }
    }

    // Viruses are still a meal and grow the chain. Player shots now spend the body node
    // they strike instead of feeding the worm for free.
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

  /**
   * Finds which body node a hit actually landed on. `-1` means the head. Callers that
   * have an impact point pass it through; callers without one default to the head.
   */
  private wormBodyAt(w: Worm, x: number, y: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return -1;
    let best = (w.x - x) * (w.x - x) + (w.y - y) * (w.y - y);
    let body = -1;
    for (let s = 0; s < w.segCount; s++) {
      const dx = w.segX[s] - x;
      const dy = w.segY[s] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        body = s;
      }
    }
    return body;
  }

  private ordinaryWormCount(): number {
    let live = 0;
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (w.active && w.bossKind < 0 && !w.mega) live++;
    }
    return live;
  }

  /**
   * Severs one standard worm at `cut`. The head side keeps the original head and every
   * body node before the cut. The rear side promotes its old tail to a new head and
   * trails the remaining nodes behind it, so the two pieces leave in opposite
   * directions. A short rear piece is simply truncated; a full split is capped.
   */
  private splitWorm(
    w: Worm,
    cut: number,
    sourceSlot: number,
    dirX: number,
    dirY: number,
    force: number,
  ): boolean {
    const oldCount = w.segCount;
    if (cut < 0 || cut >= oldCount) return false;
    const rearBody = oldCount - cut - 2;
    const tail = oldCount - 1;
    const headX = w.segX[tail];
    const headY = w.segY[tail];
    const prevX = tail > 0 ? w.segX[tail - 1] : w.x;
    const prevY = tail > 0 ? w.segY[tail - 1] : w.y;
    let child: Worm | null = null;
    if (rearBody >= 1 && this.ordinaryWormCount() < WORM.splitCap) {
      child = this.spawnWorm(headX, headY);
    }
    if (child) {
      const angle = Math.atan2(headY - prevY, headX - prevX);
      child.x = headX;
      child.y = headY;
      child.prevX = headX;
      child.prevY = headY;
      child.angle = angle;
      child.vx = 0;
      child.vy = 0;
      child.kx = dirX * force * 0.5;
      child.ky = dirY * force * 0.5;
      child.hp = WORM.hp;
      child.maxHp = WORM.hp;
      child.spawnT = 0;
      child.hitFlash = 0.2;
      child.eyeT = WORM.splitEye;
      child.infected = w.infected;
      child.shrink = w.shrink;
      child.segCount = rearBody;
      for (let j = 0; j < rearBody; j++) {
        const src = tail - 1 - j;
        const sx = w.segX[src];
        const sy = w.segY[src];
        child.segX[j] = sx;
        child.segY[j] = sy;
        child.segPrevX[j] = sx;
        child.segPrevY[j] = sy;
        child.segHp[j] = w.segHp[src] > 0 ? w.segHp[src] : WORM.segmentHp;
        child.segMaxHp[j] = w.segMaxHp[src] > 0 ? w.segMaxHp[src] : WORM.segmentHp;
      }
      for (let j = 0; j < rearBody; j++) {
        const ax = j === 0 ? child.x : child.segX[j - 1];
        const ay = j === 0 ? child.y : child.segY[j - 1];
        child.segAngle[j] = Math.atan2(ay - child.segY[j], ax - child.segX[j]);
      }
      child.anchorX = headX;
      child.anchorY = headY;
      child.patrolX = headX;
      child.patrolY = headY;
      child.retargetT = 0;
      this.pickWormPatrol(child);
      child.biteDirX = Math.cos(angle);
      child.biteDirY = Math.sin(angle);
      child.dashDirX = child.biteDirX;
      child.dashDirY = child.biteDirY;
      child.aggroT = sourceSlot === 0 || child.infected ? WORM.aggroTime : 0;
    }
    w.segCount = cut;
    for (let i = cut; i < oldCount; i++) {
      w.segHp[i] = 0;
      w.segMaxHp[i] = 0;
    }
    return child !== null;
  }

  private damageWorm(
    w: Worm,
    amount: number,
    sourceSlot: number,
    dirX: number,
    dirY: number,
    force = 0,
    hitX = NaN,
    hitY = NaN,
  ): void {
    amount = this.memoryDamage(sourceSlot, amount);
    if (!w.active || w.held) return;
    if (w.bossKind === MINIBOSS.IDLE_HANDS) {
      this.damageHand(w, amount, sourceSlot, dirX, dirY, force);
      return;
    }
    if (w.bossKind === MINIBOSS.STARFISH) {
      if (w.armState) this.damageStarfishArm(w, amount, sourceSlot, dirX, dirY, force);
      else this.damageStarfish(w, amount, sourceSlot, dirX, dirY, force);
      return;
    }
    if (w.bossKind === MINIBOSS.BLOB) {
      this.damageBlob(w, amount, sourceSlot, dirX, dirY);
      return;
    }
    if (w.bossKind === MINIBOSS.STORM_CLOUD) {
      this.damageStormCloud(w, amount, sourceSlot, dirX, dirY);
      return;
    }
    if (w.bossKind === MINIBOSS.USER) {
      this.damageUser(w, amount, sourceSlot, dirX, dirY, hitX, hitY);
      return;
    }
    if (w.mega) {
      this.damageMegaWorm(w, amount, sourceSlot, dirX, dirY, force, hitX, hitY);
      return;
    }
    // A standard worm's chain is made of separate targets. Body hits spend the node's
    // small pool; destroying one severs the chain before the head takes any damage.
    // Head hits use the existing one-pool health and end the whole worm.
    const body = this.wormBodyAt(w, hitX, hitY);
    if (body >= 0) {
      const max = w.segMaxHp[body] > 0 ? w.segMaxHp[body] : WORM.segmentHp;
      if (w.segMaxHp[body] <= 0) w.segMaxHp[body] = max;
      w.segHp[body] -= amount;
      w.hitFlash = 0.2;
      if (sourceSlot === 0) w.aggroT = WORM.aggroTime;
      w.kx += dirX * force;
      w.ky += dirY * force;
      const hx = Number.isFinite(hitX) ? hitX : w.segX[body];
      const hy = Number.isFinite(hitY) ? hitY : w.segY[body];
      this.emit(EV.WORM_HIT, sourceSlot, hx, hy, amount, dirX, dirY);
      if (w.segHp[body] > 0) return;
      const made = this.splitWorm(w, body, sourceSlot, dirX, dirY, force);
      this.emit(EV.WORM_SPLIT, sourceSlot, hx, hy, made ? 1 : 0, dirX, dirY);
      return;
    }
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
      w.segHp[w.segCount] = WORM.segmentHp;
      w.segMaxHp[w.segCount] = WORM.segmentHp;
      w.segCount++;
    }
    w.hp = Math.min(w.maxHp, w.hp + WORM.healPerMeal);
  }

  private spawnVirus(x: number, y: number, held = false, edge = true): Virus | null {
    // Holding-cell rule: a primitives-only node never seeds a virus, from any path.
    if (this.campaignPrimitivesOnly) return null;
    let v: Virus | null = null;
    for (let i = 0; i < this.viruses.length; i++) {
      if (!this.viruses[i].active) {
        v = this.viruses[i];
        break;
      }
    }
    if (!v) return null;
    v.active = true;
    v.held = held;
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
    v.spawnT = held ? 0 : VIRUS.spawnTime;
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
    v.swarm = 0;
    if (this.infectionMode) {
      // Reuse the pooled slot as a one-way arrival. The hub has no right lip with floor,
      // so arrivals queue at the east drive tip instead and the opening grid stays put.
      if (edge) {
        if (this.usb) {
          const east = this.usbRects[0];
          v.x = east.x + east.w + v.radius + 8;
          v.y = Math.max(east.y + v.radius + 8, Math.min(east.y + east.h - v.radius - 8, y));
          v.vx = -VIRUS.speed * INFECTION.entrySpeedMult;
          v.vy = this.rng.range(-INFECTION.entryJitter, INFECTION.entryJitter);
        } else {
          v.x = this.arena.bounds.right + v.radius + 8;
          v.vx = -VIRUS.speed * INFECTION.entrySpeedMult;
          v.vy = this.rng.range(-INFECTION.entryJitter, INFECTION.entryJitter);
        }
        v.prevX = v.x;
        v.spawnT = VIRUS.spawnTime;
        v.swarm = this.rng.next() < INFECTION.swarmChance ? 2 : 0;
      } else {
        v.vx = 0;
        v.vy = 0;
      }
    }
    if (held) {
      v.vx = 0;
      v.vy = 0;
    } else {
      this.nudgeVirusFromCover(v);
      this.pickVirusRoam(v);
    }
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
      // The pooled arrival glide. Generic spawns leave vx/vy at zero and still hold.
      v.x += v.vx * dt;
      v.y += v.vy * dt;
      v.chargeT = 0;
      return;
    }
    if (v.pinT > 0) {
      v.pinT = Math.max(0, v.pinT - dt);
      v.chargeT = 0;
      v.vx = 0;
      v.vy = 0;
      return;
    }
    // Infection hunts the nearest visible runner. Every other threat family uses the
    // same ranking, so a dash afterimage can pull the colony away for its short life.
    const p = this.threatTarget(v.x, v.y);
    let targetWorm = -1;
    let targetPlayer = false;
    let lureTarget = false;
    let bestScore = Infinity;
    let tx = v.roamX;
    let ty = v.roamY;
    // An infection colony is not a wanderer: it sees the player across the whole floor.
    const huntRadius = this.infectionMode ? INFECTION.huntRadius : VIRUS.huntRadius;
    if (p.alive && p.cloakT <= 0) {
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < huntRadius * huntRadius) {
        bestScore = d2;
        targetPlayer = true;
        tx = p.x;
        ty = p.y;
      }
    }
    // A worm is only a better meal than the nearest runner, never than a teammate who
    // happens to be closer. The biases still apply exactly as in the solo sandbox.
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      // Mini-bosses are not hosts: infecting one used to reset its health to full mid-fight.
      if (!w.active || w.infected || w.bossKind >= 0) continue;
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
      !this.infectionMode &&
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
      !this.infectionMode &&
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
      const speed = this.infectionMode ? VIRUS.speed * INFECTION.speedMult : VIRUS.speed;
      const k = 1 - Math.exp(-VIRUS.accel * dt);
      v.vx += (desiredX * speed - v.vx) * k;
      v.vy += (desiredY * speed - v.vy) * k;
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

    if (this.infectionMode) {
      // A flood cannot all commit the single-target charge at once, so the swarm bites
      // on contact instead. Every live teammate is a valid victim; the shared grace
      // keeps sixteen bodies from stacking three hits into one frame.
      if (v.contactCd <= 0) {
        for (let i = 0; i < this.players.length; i++) {
          const other = this.players[i];
          if (!other.active || !other.alive || other.cloakT > 0 || other.iframes > 0) continue;
          const pdx = other.x - v.x;
          const pdy = other.y - v.y;
          const rr = v.radius + PLAYER.radius;
          if (pdx * pdx + pdy * pdy > rr * rr) continue;
          v.contactCd = VIRUS.contactCooldown;
          const d = Math.hypot(pdx, pdy) || 1;
          this.damagePlayer(
            other,
            INFECTION.contactDamage,
            -1,
            pdx / d,
            pdy / d,
            INFECTION.contactKnockback,
            SRC.VIRUS,
            this.viruses.indexOf(v),
          );
          other.iframes = Math.max(other.iframes, INFECTION.hitGrace);
          break;
        }
      }
    } else if (p.alive && p.cloakT <= 0 && p.iframes <= 0 && v.contactCd <= 0) {
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
      // A converted worm is a thrall, so `infectWorm` refills health. Never route a boss
      // there: it healed the Mega Worm to full and made the fight unwinnable.
      if (!w.active || w.infected || w.bossKind >= 0) continue;
      let hit = false;
      const hr = v.radius + w.hitR;
      const hdx = w.x - v.x;
      const hdy = w.y - v.y;
      if (hdx * hdx + hdy * hdy <= hr * hr) hit = true;
      if (!hit) {
        for (let s = 0; s < w.segCount; s++) {
          const sdx = w.segX[s] - v.x;
          const sdy = w.segY[s] - v.y;
          const sr = v.radius + w.segR;
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
    // Infection is a swarm-clearing speed run, not the gauntlet's possession meter:
    // there is no thrall to spawn and no meter to fill.
    if (this.infectionMode) return;
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

  private spawnFirewall(forceAxis?: 0 | 1, forceDir?: 1 | -1): boolean {
    let f: Firewall | null = null;
    for (let i = 0; i < this.firewalls.length; i++) {
      if (!this.firewalls[i].active) {
        f = this.firewalls[i];
        break;
      }
    }
    if (!f) return false;
    f.active = true;
    f.axis = forceAxis ?? (this.rng.next() < 0.5 ? 0 : 1);
    f.dir = forceDir ?? (this.rng.next() < 0.5 ? 1 : -1);
    f.warnT = FIREWALL.warn;
    f.tickT = 0;
    f.age = 0;
    const half = FIREWALL.width * 0.5;
    if (f.axis === 0) f.pos = f.dir > 0 ? this.arena.bounds.left + half : this.arena.bounds.right - half;
    else f.pos = f.dir > 0 ? this.arena.bounds.top + half : this.arena.bounds.bottom - half;
    f.prevPos = f.pos;
    this.emit(EV.FIREWALL, -1, f.axis === 0 ? f.pos : this.centerX, f.axis === 0 ? this.centerY : f.pos, f.axis);
    return true;
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
      let hit = this.beamHits(f, w.x, w.y, w.hitR);
      let hitX = w.x;
      let hitY = w.y;
      if (!hit) {
        for (let s = 0; s < w.segCount; s++) {
          if (this.beamHits(f, w.segX[s], w.segY[s], w.segR)) {
            hit = true;
            hitX = w.segX[s];
            hitY = w.segY[s];
            break;
          }
        }
      }
      if (hit) this.damageWorm(w, FIREWALL.enemyDamage, -1, nx, ny, 0, hitX, hitY);
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
    amount = this.memoryDamage(sourceSlot, amount);
    if (!v.active || v.held) return;
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
        if (this.infectionMode) this.infectionKills++;
        else this.dropPickupFromKill(v.x, v.y, false);
      }
      this.emit(EV.VIRUS_KILL, sourceSlot, v.x, v.y, v.radius * 4, dirX, dirY);
    }
  }

  /**
   * One body struck by a pinball: heat up the next hit, add speed, and retire the ball
   * after the fifth body. Returns true when the ball is spent.
   */
  private pinballStruck(proj: Projectile): boolean {
    proj.hits++;
    const speed = Math.hypot(proj.vx, proj.vy);
    if (speed > 0.001) {
      const next = Math.min(PINBALL.shotSpeedMax, speed * PINBALL.shotHitGain);
      proj.vx = (proj.vx / speed) * next;
      proj.vy = (proj.vy / speed) * next;
    }
    this.emit(EV.BOUNCE, proj.owner, proj.x, proj.y, 0);
    if (proj.hits >= PINBALL.shotHits) {
      proj.active = false;
      return true;
    }
    proj.damage = Math.min(PINBALL.shotMaxDamage, proj.hits + 1);
    return false;
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
   * one shell damages a body once and keeps flying until its passes are spent. A standard
   * worm body node is a solid hit now; it does not swallow the shell.
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
      const hr = proj.radius + w.hitR;
      let touching = hdx * hdx + hdy * hdy <= hr * hr;
      for (let s = 0; s < w.segCount && !touching; s++) {
        const sr = proj.radius + w.segR;
        const sdx = proj.x - w.segX[s];
        const sdy = proj.y - w.segY[s];
        touching = sdx * sdx + sdy * sdy <= sr * sr;
      }
      if (!touching) continue;
      // Every body node takes the shell now. The old swallow rule made body hits free
      // food and left the head as the only meaningful target.
      this.damageWorm(w, proj.damage, proj.owner, ux, uy, 0, proj.x, proj.y);
      if (!w.mega) proj.active = false;
      return true;
    }
    return false;
  }

  /**
   * Pinball pass over the gauntlet roster. It uses the shared hit masks, so one ball
   * damages each body once, heats up on every hit and retires after the fifth.
   */
  private pinballHitsGauntlet(proj: Projectile): boolean {
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
      if (this.pinballStruck(proj)) return true;
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
      this.damageSentry(s, proj.damage, proj.owner, ux, uy, PINBALL.shotKnockback);
      if (this.pinballStruck(proj)) return true;
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
      this.damageVirus(v, proj.damage, proj.owner, ux, uy, PINBALL.shotKnockback);
      if (this.pinballStruck(proj)) return true;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const bit = 1 << i;
      if ((proj.hitWorms & bit) !== 0) continue;
      const hdx = proj.x - w.x;
      const hdy = proj.y - w.y;
      const hr = proj.radius + w.hitR;
      let touching = hdx * hdx + hdy * hdy <= hr * hr;
      for (let s = 0; s < w.segCount && !touching; s++) {
        const sr = proj.radius + w.segR;
        const sdx = proj.x - w.segX[s];
        const sdy = proj.y - w.segY[s];
        touching = sdx * sdx + sdy * sdy <= sr * sr;
      }
      if (!touching) continue;
      proj.hitWorms |= bit;
      this.damageWorm(w, proj.damage, proj.owner, ux, uy, PINBALL.shotKnockback, proj.x, proj.y);
      if (this.pinballStruck(proj)) return true;
    }
    return false;
  }

  /**
   * Super ball pass over the gauntlet roster. One hit per body, no deactivation, no
   * bounce; walls are the only thing that turns it.
   */
  private superHitsGauntlet(proj: Projectile): boolean {
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
      this.damageSentry(s, proj.damage, proj.owner, ux, uy, PINBALL.powerKnockback);
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
      this.damageVirus(v, proj.damage, proj.owner, ux, uy, PINBALL.powerKnockback);
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      const bit = 1 << i;
      if ((proj.hitWorms & bit) !== 0) continue;
      const hdx = proj.x - w.x;
      const hdy = proj.y - w.y;
      const hr = proj.radius + w.hitR;
      let touching = hdx * hdx + hdy * hdy <= hr * hr;
      for (let s = 0; s < w.segCount && !touching; s++) {
        const sr = proj.radius + w.segR;
        const sdx = proj.x - w.segX[s];
        const sdy = proj.y - w.segY[s];
        touching = sdx * sdx + sdy * sdy <= sr * sr;
      }
      if (!touching) continue;
      proj.hitWorms |= bit;
      this.damageWorm(w, proj.damage, proj.owner, ux, uy, PINBALL.powerKnockback, proj.x, proj.y);
    }
    return false;
  }

  private projectileHitsGauntlet(proj: Projectile): boolean {
    if (proj.type === 14) return this.pinballHitsGauntlet(proj);
    if (proj.type === 15) return this.superHitsGauntlet(proj);
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
        if (proj.type === 13) this.compressErrorHit(e, proj.owner);
        if (proj.type === 16) this.splitCopyShot(proj);
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
        if (proj.type === 13) this.compressSentryHit(s, proj.owner);
        if (proj.type === 16) this.splitCopyShot(proj);
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
        if (proj.type === 13) this.compressVirusHit(v, proj.owner);
        if (proj.type === 16) this.splitCopyShot(proj);
        proj.active = false;
      }
      return true;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      if (w.mega) {
        if (!this.megaBodyHit(w, proj.x, proj.y, proj.radius)) continue;
        if (proj.type === 1) {
          this.explodeMine(proj, proj.owner);
        } else {
          const speed = Math.hypot(proj.vx, proj.vy) || 1;
          const stormStrike = proj.lightning && proj.owner >= 0 ? STORM_CLOUD.lightning.reflectDamage : proj.damage;
          this.damageWorm(w, stormStrike, proj.owner, proj.vx / speed, proj.vy / speed, 0, proj.x, proj.y);
          if (proj.type === 13) this.compressWormHit(w, proj.owner);
          if (proj.type === 16) this.splitCopyShot(proj);
          proj.active = false;
        }
        return true;
      }
      const hdx = proj.x - w.x;
      const hdy = proj.y - w.y;
      const hr = proj.radius + w.hitR;
      if (hdx * hdx + hdy * hdy <= hr * hr) {
        if (proj.type === 1) {
          this.explodeMine(proj, proj.owner);
        } else {
          const speed = Math.hypot(proj.vx, proj.vy) || 1;
          const stormStrike = proj.lightning && proj.owner >= 0 ? STORM_CLOUD.lightning.reflectDamage : proj.damage;
          this.damageWorm(w, stormStrike, proj.owner, proj.vx / speed, proj.vy / speed, 0, proj.x, proj.y);
          if (proj.type === 13) this.compressWormHit(w, proj.owner);
          if (proj.type === 16) this.splitCopyShot(proj);
          proj.active = false;
        }
        return true;
      }
      for (let s = 0; s < w.segCount; s++) {
        const sdx = proj.x - w.segX[s];
        const sdy = proj.y - w.segY[s];
        const sr = proj.radius + w.segR;
        if (sdx * sdx + sdy * sdy > sr * sr) continue;
        if (proj.type === 1) {
          this.explodeMine(proj, proj.owner);
        } else {
          const speed = Math.hypot(proj.vx, proj.vy) || 1;
          const stormStrike = proj.lightning && proj.owner >= 0 ? STORM_CLOUD.lightning.reflectDamage : proj.damage;
          this.damageWorm(w, stormStrike, hostile ? -1 : proj.owner, proj.vx / speed, proj.vy / speed, 0, proj.x, proj.y);
          proj.active = false;
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
      if (w.mega) {
        // The spear tests the one capsule rather than every plate. Do not pin a flying
        // boss against the missing outer wall.
        if (!this.megaBodyHit(w, proj.x, proj.y, proj.radius)) continue;
        proj.hitWorms |= bit;
        this.damageWorm(w, proj.damage, proj.owner, ux, uy, FISHER.spearKnockback);
        continue;
      }
      let hitX = w.x;
      let hitY = w.y;
      let touching = false;
      const hr = proj.radius + w.hitR;
      if ((proj.x - w.x) * (proj.x - w.x) + (proj.y - w.y) * (proj.y - w.y) <= hr * hr) {
        touching = true;
      } else {
        for (let s = 0; s < w.segCount; s++) {
          const sr = proj.radius + w.segR;
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
      this.damageWorm(w, proj.damage, proj.owner, ux, uy, FISHER.spearKnockback, hitX, hitY);
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
    const reach = (broomBig ? SWEEP.bigReach : PLAYER.punchReach * p.meleeReachMult) * whipMult;
    const arcCos = Math.cos(p.meleeHalfAngle);
    const damage = (broomBig ? SWEEP.bigDamage : PLAYER.punchDamage) * whipMult;
    const baseForce = broomBig ? SWEEP.bigKnockback : broomDiag ? SWEEP.comboKnockback : p.meleeKnock;
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
      if ((wdx / wd) * cos + (wdy / wd) * sin < arcCos) continue;
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
      if ((dx / d) * cos + (dy / d) * sin < arcCos) continue;
      // A lash launches the box first; the damage is a chip, so one hit never deletes it.
      // A mounted port is not debris, so the lash only chips it.
      if (!b.fixed) this.launchProp(b, shoveX, shoveY, FILE_PROP.launchSpeed);
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
      if ((dx / d) * cos + (dy / d) * sin < arcCos) continue;
      this.damagePlayer(target, damage, p.slot, shoveX, shoveY, force);
      this.markSwingHit(p);
      return;
    }

    if (this.mode === 'training' && this.drone.active) {
      const dx = this.drone.x - p.x;
      const dy = this.drone.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= reach + this.drone.radius && d > 0.001 && (dx / d) * cos + (dy / d) * sin >= arcCos) {
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
      if ((dx / d) * cos + (dy / d) * sin < arcCos) continue;
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
      if ((dx / d) * cos + (dy / d) * sin < arcCos) continue;
      this.damageVirus(v, damage, p.slot, shoveX, shoveY, force);
      this.markSwingHit(p);
      return;
    }
    for (let i = 0; i < this.worms.length; i++) {
      const w = this.worms[i];
      if (!w.active) continue;
      let hitX = w.x;
      let hitY = w.y;
      let dx = w.x - p.x;
      let dy = w.y - p.y;
      let d = Math.hypot(dx, dy);
      let touching = d > 0.001 && d <= reach + w.hitR && (dx / d) * cos + (dy / d) * sin >= arcCos;
      if (!touching) {
        for (let s = 0; s < w.segCount; s++) {
          dx = w.segX[s] - p.x;
          dy = w.segY[s] - p.y;
          d = Math.hypot(dx, dy);
          if (d < 0.001 || d > reach + w.segR) continue;
          if ((dx / d) * cos + (dy / d) * sin < arcCos) continue;
          touching = true;
          hitX = w.segX[s];
          hitY = w.segY[s];
          break;
        }
      }
      if (!touching) continue;
      this.damageWorm(w, damage, p.slot, shoveX, shoveY, force, hitX, hitY);
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
      if ((dx / d) * cos + (dy / d) * sin < arcCos) continue;
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

    // The charged dash damages what it crosses, including a port.
    for (let i = 0; i < this.props.length; i++) {
      const b = this.props[i];
      if (!b.active || !b.portal || b.portalExit) continue;
      if ((b.portalHitCd ?? 0) > 0) continue;
      const bx = b.x + b.w * 0.5;
      const by = b.y + b.h * 0.5;
      const rr = hitR + Math.max(b.w, b.h) * 0.5;
      const dx = bx - p.x;
      const dy = by - p.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      b.portalHitCd = 0.3;
      this.damageProp(b, PLAYER.chargeDashDamage, bx, by);
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
      const rr = hitR + w.hitR;
      let hitX = w.x;
      let hitY = w.y;
      let touching = (w.x - p.x) * (w.x - p.x) + (w.y - p.y) * (w.y - p.y) <= rr * rr;
      if (!touching) {
        const sr = hitR + w.segR;
        for (let s = 0; s < w.segCount; s++) {
          const dx = w.segX[s] - p.x;
          const dy = w.segY[s] - p.y;
          if (dx * dx + dy * dy <= sr * sr) {
            touching = true;
            hitX = w.segX[s];
            hitY = w.segY[s];
            break;
          }
        }
      }
      if (!touching) continue;
      p.dashHitWorms |= bit;
      this.damageWorm(w, PLAYER.chargeDashDamage, p.slot, fx, fy, PLAYER.chargeDashKnockback, hitX, hitY);
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
