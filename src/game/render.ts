import type { AssaultPortal, Fragment } from './types';
import { AIMBOT, ATOMIZE, BOLT, BROWSER, BUFFER, BUG, CALIBRATION, CAMERA, CAMERA_ZOOM, CAMPAIGN, CASCADING_ERROR, COLORS, COMPRESS, COPYPASTA, EMITTER, FILE_PROP, FIREWALL, FISHER, GHOST, IDLE_HANDS, STARFISH, BLOB, STORM_CLOUD, KABOOM, KEYPAD, MAX_PLAYERS, MEGA_WORM, MINE, NETWORK, PINBALL, PLAYER, POWERUP, ROUND, SCANNER, SENTRY, SWEEP, TRAIL_LEN, TRAVEL, TRAVERSE, VIEW_H, VIEW_W, VIRUS, WEDGE, WORM } from './config';
import type { AimMark, BossIntro, CopyMark, InvaderShot } from './types';
import {
  discArmAngle,
  discArmLength,
  discArmPivotX,
  discArmPivotY,
  discCenterX,
  discCenterY,
  discHoleX,
  discHoleY,
  holdingCellLayout,
  keypadKeyPhase,
  KEYPAD_STATE,
  scannerLaserY,
  scannerPhaseAt,
  SCANNER_STATE,
  faxHeadX,
  faxHeadY,
  faxPhaseAt,
  faxRowAt,
  FAX_STATE,
  plugPhaseAt,
  PLUG_STATE,
  watchHandAngle,
  laptopCardY,
  laptopCellRect,
  satelliteSolarPhaseAt,
  satelliteSolarStateAt,
  satelliteTelescopeExtensionAt,
  SATELLITE_SOLAR_STATE,
  carProgressAt,
  carRouteAt,
  carRouteLength,
  flipRowFlapProgressAt,
  flipRowStateAt,
  flipRowTimeAt,
  flipFieldAt,
  FIGHTER_TOP,
  flipRowRectAt,
  FLIP_STATE,
  rocketArcAt,
  rocketProgressAt,
  swipeDirectionAt,
  swipeIndexAt,
  swipeMoveProgressAt,
  swipePhaseAt,
  swipePopupHeightAt,
  swipePopupWarnAt,
  usbCenterX,
  usbCenterY,
  usbDriveRect,
  usbExtensionAt,
  usbFlowDirAt,
  USB_STATE,
  usbPhaseAt,
  ROOM_THEME_COLORS,
  type ArenaDef,
  type ArenaFaxDef,
  type ArenaKeypadDef,
  type ArenaRoomDef,
  type ArenaScannerDef,
  type HoldingCellLayout,
} from './arenas';
import { Fx } from './fx';
import { ATOM_BALL_COLOR, ATOM_BOLT_COLORS, drawGhostEye, drawGlyph, drawHourglassMark, drawProgramMark, drawSymbol, pathFileIcon, pathPinballFlipper, pathProgramFrame, pathProgramHealth, PROP_GLYPHS, PROGRAM_COLORS, slotColor, slotGlyph, symbolFont, THREAT_COLORS } from './identity';
import { P_COLOR_DANGER, P_COLOR_DUST, P_COLOR_ICE, P_COLOR_TOXIN, particleColor } from './particles';
import { POWERUPS, POWERUP_KIND } from './powerups';
import { PROGRAM_ID, programDef } from './programs';
import { MINIBOSS } from './minibosses';
import { MEMORY } from './memory';
import { drawDroppedFiles, drawRegularProgram, regularFace, regularProgram, type RegularMood, type RegularProgramDef } from './regulars';
import { PROP, SRC, type Barrier, type CampaignPhase, type CascadingError, type Drone, type Firewall, type GameMode, type LaserEmitter, type Lure, type Net, type Phase, type Pickup, type Pipe, type Player, type Projectile, type Prop, type SatelliteMeteor, type Sentry, type SmokeWave, type Virus, type Worm } from './types';
import { CameraDirector, type CameraRig } from './camera';
import { beamReach } from './collision';

/** Reused sheet-cell rect for the SPREADSHEET draw path: one allocation, not one per cell. */
const laptopCellDraw = { x: 0, y: 0, w: 0, h: 0 };

/**
 * Idle Hands is a symbol boss, not a stroked anatomical hand. The variation selectors
 * request the text faces so the shared symbol stack can keep the marks monochrome;
 * the open palm stays upright and the pointing hand turns along the latched charge.
 */
const IDLE_HAND_OPEN = '✋\uFE0E';
const IDLE_HAND_POINT = '☝\uFE0E';
const IDLE_HAND_EYE = '👁\uFE0E';

export interface RenderState {
  /** Radar arena sweep clock, seconds since the level began. */
  radarT?: number;
  /** Gauntlet ingress bursts. Local-only, never snapshotted. */
  assaultPortals?: readonly AssaultPortal[];
  mode: GameMode;
  /** True only for a networked session; local modes always identify by program. */
  online: boolean;
  arena: ArenaDef;
  phase: Phase;
  phaseTimer: number;
  round: number;
  roundTimer: number;
  roundWinner: number;
  matchWinner: number;
  players: Player[];
  projectiles: Projectile[];
  drone: Drone | null;
  localSlot: number;
  /** Local gauntlet entities. Guests never receive these; absent means none. */
  worms?: readonly Worm[];
  viruses?: readonly Virus[];
  firewalls?: readonly Firewall[];
  /** Arena laser emitters. Local hazard content; absent on a guest view. */
  emitters?: readonly LaserEmitter[];
  errors?: readonly CascadingError[];
  sentries?: readonly Sentry[];
  pickups?: readonly Pickup[];
  /** Downed-player memory shards. PvE modes only. */
  fragments?: readonly Fragment[];
  /** Local Fisher webs, lure beacons and Wedge walls. Match snapshots never carry these. */
  nets?: readonly Net[];
  lures?: readonly Lure[];
  barriers?: readonly Barrier[];
  infection?: number;
  /** INFECTION run: the top-centred clear meter replaces the gauntlet warning strip. */
  infectionMode?: boolean;
  infectionProgress?: number;
  infectionKills?: number;
  infectionCleared?: boolean;
  infectionFailed?: boolean;
  infectionOver?: boolean;
  gauntletKills?: number;
  wave?: number;
  waveBannerT?: number;
  /** Frozen mini-boss entrance; absent outside a local boss reveal. */
  bossIntro?: BossIntro | null;
  gauntletOver?: boolean;
  gauntletTime?: number;
  /** Campaign script running on the gauntlet simulation. */
  campaign?: boolean;
  campaignPhase?: CampaignPhase;
  campaignBannerT?: number;
  campaignBannerDur?: number;
  /** 0 drill, 1 breach/inbound, 2 cleared, 3 failed, 4 calibration, 5 awake, 6 cell release. */
  campaignBannerKind?: number;
  /** Enemy ingress ports closed, and how many the arena authored. */
  portsClosed?: number;
  portTotal?: number;
  /** Campaign-only presentation state for the holding room. */
  campaignCiviliansLost?: boolean;
  campaignBarsFlashT?: number;
  campaignBarsOpen?: boolean;
  /** Exit portal is open, and seconds into its suction animation. */
  portalOpen?: boolean;
  portalT?: number;
  /** Left-wall entry portal clock after a portal hop. */
  entryPortalT?: number;
  /** Breakable file boxes. Live boxes travel in Snapshot; physics stays host-side. */
  props?: readonly Prop[];
  /** NETWORK SWITCH feed pipes. Local arena content. */
  pipes?: readonly Pipe[];
  firewallSwitchT?: number;
  firewallSwitchDwell?: number;
  firewallSwitchFlash?: number;
  /** Floor compactor: warning timer, the arm's leading edge, and the stop flash. */
  pusherWarnT?: number;
  pusherFlashT?: number;
  pusherY?: number;
  pusherActive?: boolean;
  /** Rotating platter phase. Absent freezes the disc at its authored resting pose. */
  discT?: number;
  /** USB drive cycle phase. The host clock is synced in SnapshotHazards. */
  usbT?: number;
  /** SWIPE RIGHT card clock and independent match-popup clock. */
  swipeT?: number;
  swipePopupT?: number;
  /** SATELLITE: solar/telescope clock, capsule state, meteors and reentry. */
  satelliteT?: number;
  satelliteState?: number;
  satelliteHeatY?: number;
  satelliteThrusterT?: number;
  satelliteReentryT?: number;
  satelliteMeteors?: readonly SatelliteMeteor[];
  /** ROCKET NAVIGATION launch clock and 0..1 trajectory progress. Local-only. */
  rocketT?: number;
  rocketProgress?: number;
  /** CAR NAVIGATION route clock and 0..1 progress. Local-only. */
  carT?: number;
  carProgress?: number;
  /** PONG rally state. Local-only. */
  pongBallX?: number;
  pongBallY?: number;
  pongBallActive?: boolean;
  pongLeftY?: number;
  pongRightY?: number;
  pongScoreLeft?: number;
  pongScoreRight?: number;
  pongScoreFlash?: number;
  pongScoreSide?: number;
  pongHitFlash?: number;
  /** AIRPORT board clock and per-row flap states. Local-only. */
  flipT?: number;
  flipStates?: ArrayLike<number>;
  /** SPACE INVADERS simulated cannon and local shots. */
  invaderCannonX?: number;
  invaderCannonFlash?: number;
  invaderAimT?: number;
  invaderShots?: readonly InvaderShot[];
  /** Phone-pad phase and per-key state. The shared clock travels in Snapshot. */
  keypadT?: number;
  keypadStates?: ArrayLike<number>;
  /** Document-scanner page clock and phase. Snapshot carries both. */
  scannerT?: number;
  scannerPage?: number;
  scannerPhase?: number;
  /** FAX MACHINE shuttle clock, page and current phase. Local-only. */
  faxT?: number;
  faxPage?: number;
  faxPhase?: number;
  /** SMART PLUG circuit clock and current green/red phase. Local-only. */
  plugT?: number;
  plugPhase?: number;
  /** SMOKE DETECTOR siren clock, sensor state and live alarm rings. Local-only. */
  smokeT?: number;
  smokeAlarm?: boolean;
  smokeAlarmT?: number;
  smokeCooldownT?: number;
  smokeWaves?: readonly SmokeWave[];
  /** SMART WATCH second-hand clock and current angle. Local-only. */
  watchT?: number;
  watchAngle?: number;
  /** BUSINESS LAPTOP inbox clock, active message and new-message flash. Local-only. */
  laptopT?: number;
  laptopMessage?: number;
  laptopFlashT?: number;
  /** SPREADSHEET cell health (0 means cleared) and the selection cursor column. Local-only. */
  laptopCellHp?: ArrayLike<number>;
  laptopCursor?: number;
  /** Forum browser page, cursor and click flash. Guests derive these from Snapshot. */
  browserPage?: number;
  browserPhase?: number;
  browserCursorX?: number;
  browserCursorY?: number;
  browserClickT?: number;
  /** Bad Lag's time dilation, in seconds of real time left, and who cast it. */
  timeSlowT?: number;
  timeSlowOwner?: number;
  /** Copy Pasta's growing redaction stacks. Local-only. */
  copyMarks?: readonly CopyMark[];
  /** Aim Bot's pending volley crosshairs. Local-only. */
  aimMarks?: readonly AimMark[];
  /** Round bumper flash timers. Local-only arena furniture. */
  bumperFlash?: ArrayLike<number>;
}

/** Presentation-only civilian state. It never enters World or a snapshot. */
interface CivilianActor {
  def: RegularProgramDef;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  scale: number;
  phase: number;
  baseMood: RegularMood;
  mood: RegularMood;
  carry: number;
  fleeing: boolean;
  gone: boolean;
  exitX: number;
  exitY: number;
  exitLeaves: boolean;
  dropT: number;
  dropX: number;
  dropY: number;
  dropCount: number;
}

const CIVILIAN_FLEE_RADIUS = 230;
const CIVILIAN_FLEE_SPEED = 82;
const CIVILIAN_DROP_LIFE = 2.8;
const CIVILIAN_EXIT_RADIUS = 20;

const FONT_TINY = '700 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_SMALL = '700 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_MID = '700 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_KEYPAD = '700 156px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_KEYPAD_LABEL = '700 24px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const INVADER_PATTERN = ['0011100', '0111110', '1111111', '1101011', '1010101'];

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
const FONT_PAGE_TITLE = '700 19px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Cached ASCII broom rows. Keyed by column count; built once per size, never per frame. */
const BROOM_HEAD_ROWS = new Map<number, string>();
const BROOM_TEETH_ROWS = new Map<number, string>();
const BROOM_WIDTHS = new Map<string, number>();

function broomHeadRow(cols: number): string {
  let row = BROOM_HEAD_ROWS.get(cols);
  if (row === undefined) {
    row = `/${'='.repeat(Math.max(1, cols - 2))}\\`;
    BROOM_HEAD_ROWS.set(cols, row);
  }
  return row;
}

/**
 * Width of a broom row in the current font, measured once per size and row length.
 * The rows are all `=` or `|`, so length plus font size identifies them.
 */
function broomRowWidth(ctx: CanvasRenderingContext2D, row: string, px: number): number {
  const key = px + '|' + row.length;
  let w = BROOM_WIDTHS.get(key);
  if (w === undefined) {
    ctx.font = symbolFont(px);
    w = Math.max(1, ctx.measureText(row).width);
    BROOM_WIDTHS.set(key, w);
  }
  return w;
}

function broomTeethRow(cols: number): string {
  let row = BROOM_TEETH_ROWS.get(cols);
  if (row === undefined) {
    row = '|'.repeat(cols);
    BROOM_TEETH_ROWS.set(cols, row);
  }
  return row;
}

/** One local camera. Split screen gives each local slot its own framing and zoom. */
interface CameraView {
  /** First local slot in this view's group; the pane's primary for spectate and lifts. */
  slot: number;
  /** Bitmask of local players in this group. One for a solo pane, several on a shared view. */
  localMask: number;
  x: number;
  y: number;
  w: number;
  h: number;
  camX: number;
  camY: number;
  zoom: number;
  ready: boolean;
  arena: number;
  wasAlive: boolean;
}

const MAX_VIEWS = 4;

function createCameraView(): CameraView {
  return {
    slot: 0,
    localMask: 0,
    x: 0,
    y: 0,
    w: VIEW_W,
    h: VIEW_H,
    camX: 0,
    camY: 0,
    zoom: CAMERA_ZOOM,
    ready: false,
    arena: -1,
    wasAlive: false,
  };
}

const TWO_PI = Math.PI * 2;
/** Readiness dock: three jobs, one circular slot each. Larger cells are the point. */
const DOCK_CELL = 60;
const DOCK_PAD = 8;
const DOCK_SLOT = 25;
const DOCK_W = DOCK_CELL * 3 + DOCK_PAD * 2;
const DOCK_H = 64;
const FIRST_TO = `FIRST TO ${ROUND.winsNeeded}`;
const LABEL_TRAINING = 'TRAINING';
const LABEL_DRONE = 'SPARRING DRONE';
const SPIN_TRAIL_LEN = 20;
const SPIN_TRAIL_LIFE = 0.42;
const SPIN_TRAIL_INTERVAL = 0.02;
const INTRO_LEN = 3.1;
/**
 * Jump-scare face. Wide O eyes and a mouth of sharp V teeth, drawn in monospace so
 * the columns hold at any size. Kept as text because the face is meant to read as
 * ASCII art, not as another program hull.
 */
const SCARE_FACE = [
  '  .-\"\"\"\"\"-.  ',
  ' /  O   O  \\ ',
  '|   .---.   |',
  '|   |\\/\\/|   |',
  ' \\  \'---\'  / ',
  '  \'-.....\'-  ',
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}

/**
 * Offline play is about the program, so the ring and core take its color and symbol.
 * Networked matches still use slot identity until kits are carried in the snapshot.
 */
function playerColor(state: RenderState, p: Player): string {
  if (p.thrall) return THREAT_COLORS.thrall;
  // A program's color, hull and kit are one identity. Only a networked guest, whose
  // program the snapshot cannot carry, falls back to the room slot palette.
  if (state.online) return slotColor(p.slot);
  return programDef(p.program).color;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private scale = 1;
  private offX = 0;
  private offY = 0;

  private floorGradient: CanvasGradient | null = null;
  private floorPattern: CanvasPattern | null = null;
  private floorPatternArena = -1;
  private lowHpGradient: CanvasGradient | null = null;
  private dustX = new Float32Array(56);
  private dustY = new Float32Array(56);
  private timerText = '0:00';
  private lastTimerSec = -1;
  private roundText = 'ROUND 1';
  private lastRoundText = -1;
  private killsText = 'KILLS 0';
  private infectionText = 'INFECT 0%';
  private threatText = '';
  private lastKills = -1;
  private lastInfection = -1;
  private lastThreatKey = -1;
  private trailX = new Float32Array(MAX_PLAYERS * SPIN_TRAIL_LEN);
  private trailY = new Float32Array(MAX_PLAYERS * SPIN_TRAIL_LEN);
  private trailBirth = new Float32Array(MAX_PLAYERS * SPIN_TRAIL_LEN).fill(-1);
  private trailHead = new Int32Array(MAX_PLAYERS);
  private trailLastT = new Float32Array(MAX_PLAYERS).fill(-999);
  private trailLastX = new Float32Array(MAX_PLAYERS);
  private trailLastY = new Float32Array(MAX_PLAYERS);
  private views: CameraView[] = [];
  private viewSlots = new Int32Array(MAX_VIEWS);
  /** Active local slots, in slot order, and their bitmask. */
  private localList = new Int32Array(MAX_VIEWS);
  private localCount = 0;
  private localMask = 0;
  private viewCount = 0;
  private lastViewCount = 0;
  /** One-shot flag for the sim: the local view count or grouping just changed. */
  private layoutChanged = false;
  private lastMasks = new Int32Array(MAX_VIEWS);
  /** Group id per local player, and the compaction map between group and view index. */
  private groupOf = new Int32Array(MAX_VIEWS);
  private groupRemap = new Int32Array(MAX_VIEWS);
  private groupMasks = new Int32Array(MAX_VIEWS);
  private groupW = 0;
  private groupH = 0;
  private director = new CameraDirector();
  private lastWave = -1;
  private lastCampaignKind = -1;
  /** One entrance rig per assembled boss, not one per frame. */
  private bossCueLive = false;
  private bossCueKind = -1;
  /** Campaign Mega Worm keeps the whole arena in frame until the boss dies. */
  private megaFightCue = false;
  /** Campaign-only presentation state for the holding room's scripted beats. */
  private campaignCiviliansLost = false;
  private campaignBarsFlashT = 0;
  private campaignBarsOpen = false;
  private campaignActive = false;
  /** Local civilian monitors and their presentation-only flight/drop state. */
  private civilians: CivilianActor[] = [];
  private civilianArenaId = -1;
  private civilianThreatX = 0;
  private civilianThreatY = 0;
  private civilianExitX = 0;
  private civilianExitY = 0;
  private civilianExitLeaves = false;
  /** Local slots to render as split panes. `null` is the normal single view. */
  private splitSlots: readonly number[] | null = null;
  /** Per-frame camera pull scratch: total weight and weighted offset from the anchor. */
  private camPullW = 0;
  private camPullX = 0;
  private camPullY = 0;
  private camSpread = 0;
  /** Spectate scratch, set by `findSpectateTarget` and consumed by `updateCamera`. */
  private spectateKind: number = SRC.NONE;
  private spectateId = -1;
  private spectateX = 0;
  private spectateY = 0;
  private lastRenderT = 0;
  private readonly rocketArcScratch = { x: 0, y: 0 };
  private readonly carRouteScratch = { x: 0, y: 0 };
  private introT = INTRO_LEN;
  private introActive = false;
  /** Island-hop portal wipe. Negative means idle; 0..0.9 is the closing/opening iris. */
  private hopT = -1;
  private hopLabel = '';
  private dustArena = -1;
  /** Per-slot trail used for the square dust a shove leaves behind. */
  private slideX = new Float32Array(MAX_PLAYERS);
  private slideY = new Float32Array(MAX_PLAYERS);
  private slideGap = new Float32Array(MAX_PLAYERS);
  private slideSeen = new Uint8Array(MAX_PLAYERS);
  private slideDustT = 0;
  /** Cadence for the dust a thrown broom head drags behind it. */
  private broomDustT = 0;
  /** Cadence for the sparks peeling off a live heavy beam. */
  private laserSparkT = 0;
  /** Rotating seed for Toxic's circular burst, so it needs no per-frame allocation. */
  private toxicSeed = 1;
  /** Toggled from Settings > Feedback. */
  showMinimap = true;
  /**
   * In-game canvas UI: match strip, wave banners, readiness docks and the minimap.
   * Settings > Feedback and the attract demo both switch this. Gameplay marks on the
   * avatar (health segments, lock reticle) are not UI and stay.
   */
  showUi = true;
  /** Touch layout: readiness moves to the top centre and the minimap gives way. */
  touchLayout = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    for (let i = 0; i < MAX_VIEWS; i++) this.views.push(createCameraView());
    this.resize();
  }

  /**
   * Local split screen. Each slot gets its own camera, zoom and viewport; one slot is
   * the normal full-screen view. Slots that are not active fall back to the primary.
   */
  setLocalSlots(slots: readonly number[] | null): void {
    this.splitSlots = slots && slots.length > 0 ? slots.slice(0, MAX_VIEWS) : null;
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.cssW && h === this.cssH && dpr === this.dpr) return;
    this.cssW = w;
    this.cssH = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));
    this.scale = Math.min(w / VIEW_W, h / VIEW_H);
    this.offX = (w - VIEW_W * this.scale) / 2;
    this.offY = (h - VIEW_H * this.scale) / 2;

    const ctx = this.ctx;
    const floor = ctx.createLinearGradient(0, 0, 0, VIEW_H * 2);
    floor.addColorStop(0, '#071018');
    floor.addColorStop(0.55, '#050b12');
    floor.addColorStop(1, '#04070c');
    this.floorGradient = floor;

    const vignette = ctx.createRadialGradient(640, 360, 240, 640, 360, 740);
    vignette.addColorStop(0, 'rgba(255, 40, 48, 0)');
    vignette.addColorStop(0.65, 'rgba(255, 30, 40, 0.15)');
    vignette.addColorStop(1, 'rgba(255, 20, 30, 0.55)');
    this.lowHpGradient = vignette;
  }

  /**
   * Island hop. The square mouth closes over the old arena, swaps it at the midpoint and
   * opens over the new one. The label rides the covered frame so the hop has a source.
   */
  beginPortalHop(label = 'SCRIPT_KITTY // PORTAL'): void {
    this.hopT = 0;
    this.hopLabel = label;
  }

  /** Console-to-arena load. Ground, cover, skeletons and rigs reveal in stages. */
  beginIntro(): void {
    this.introT = 0;
    this.introActive = true;
    this.civilians.length = 0;
    this.civilianArenaId = -1;
    this.director.clear();
    this.lastWave = -1;
    this.lastCampaignKind = -1;
    this.bossCueLive = false;
    this.bossCueKind = -1;
    this.megaFightCue = false;
    this.lastViewCount = 0;
    this.layoutChanged = false;
    this.lastMasks.fill(0);
    for (let i = 0; i < this.views.length; i++) {
      this.views[i].ready = false;
      this.views[i].wasAlive = false;
    }
  }

  /**
   * Plays a camera override: a boss entrance, a narrative beat, a pack dropping in
   * from off-screen. Rigs blend over the normal framing and hand control back when
   * they expire. See `CameraRig` for the fields.
   */
  playCameraRig(rig: CameraRig): void {
    this.director.play(rig);
  }

  /** True once after the split layout or pane grouping changes. The sim reads it to
   * dip into slow motion while the players' screen positions move. */
  consumeLayoutChange(): boolean {
    const changed = this.layoutChanged;
    this.layoutChanged = false;
    return changed;
  }

  render(state: RenderState, alpha: number, fx: Fx): void {
    this.resize();
    const ctx = this.ctx;
    const t = performance.now() * 0.001;
    const dt = Math.min(0.05, Math.max(0.001, t - this.lastRenderT));
    this.lastRenderT = t;
    this.campaignCiviliansLost = state.campaignCiviliansLost === true;
    this.campaignBarsFlashT = state.campaignBarsFlashT ?? 0;
    this.campaignBarsOpen = state.campaignBarsOpen === true;
    this.campaignActive = state.campaign === true;
    if (this.introActive) {
      this.introT += dt;
      if (this.introT >= INTRO_LEN) this.introActive = false;
    }
    const intro = this.introActive ? this.introT : INTRO_LEN;
    const introDone = intro >= INTRO_LEN;
    this.layoutViews(state);
    this.updateCameraCues(state);
    this.director.update(dt);
    this.updateCivilians(state, dt);

    // Effects that advance per-frame state run once, never once per pane. Drawing them
    // per pane would double the dust and trail samples in a split match.
    this.emitSlideDust(state, alpha, fx, dt);
    this.emitBroomDust(state, alpha, fx, dt);
    this.emitLaserSparks(state, alpha, fx, dt);
    this.emitToxicBurst(state, alpha, fx);
    this.updatePlayerTrails(state, t);
    this.updateTrails(state, alpha);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const base = this.dpr * this.scale;
    for (let vi = 0; vi < this.viewCount; vi++) {
      const view = this.views[vi];
      this.updateCamera(state, view, alpha, dt);

      // Clip the pane in virtual screen space, then set up its own world camera.
      ctx.setTransform(base, 0, 0, base, this.dpr * this.offX, this.dpr * this.offY);
      ctx.save();
      ctx.beginPath();
      ctx.rect(view.x, view.y, view.w, view.h);
      ctx.clip();
      const s = base * view.zoom;
      ctx.setTransform(
        s,
        0,
        0,
        s,
        this.dpr * (this.offX + view.x * this.scale) + fx.shakeX * this.scale * this.dpr,
        this.dpr * (this.offY + view.y * this.scale) + fx.shakeY * this.scale * this.dpr,
      );
      ctx.translate(-view.camX, -view.camY);
      if (fx.rotationShake !== 0) {
        // Pivot on the middle of this pane's visible world window, not world origin.
        const pivotX = view.camX + (view.w / view.zoom) * 0.5;
        const pivotY = view.camY + (view.h / view.zoom) * 0.5;
        ctx.translate(pivotX, pivotY);
        ctx.rotate(fx.rotationShake);
        ctx.translate(-pivotX, -pivotY);
      }

      this.drawArena(t, state.arena, intro, state.discT ?? 0, state.usbT ?? 0, state.swipeT ?? 0, state.swipePopupT ?? 0, state);
      this.drawFeedRun(state.arena, t);
      this.drawBumpers(state.arena, t, state.bumperFlash);
      if (state.arena.keypad) this.drawKeypad(state, t);
      if (state.arena.scanner) this.drawScanner(state, t);
      if (state.arena.fax) this.drawFax(state, t);
      if (state.arena.browser) this.drawBrowser(state);
      if (introDone) {
        if (state.props) this.drawProps(state.props);
        if (state.props) this.drawPorts(state.props, t);
        if (state.assaultPortals) this.drawAssaultPortals(state.assaultPortals, t);
        if (state.pipes) this.drawPipes(state.pipes, state.arena, t);
        if (state.arena.firewallSwitch) this.drawFirewallSwitch(state, t);
        if (state.arena.pushers) this.drawPusher(state);
        if (state.firewalls) this.drawFirewalls(state.firewalls, state.arena, alpha, t);
        if (state.emitters) this.drawEmitters(state, t);
        this.drawOrbitFields(state, t);
        this.drawPlayerTrails(state, t);
        this.drawTrails(state, alpha);
        this.drawProjectiles(state, alpha, t);
        if (state.worms) this.drawWorms(state.worms, alpha, t);
        if (state.viruses) this.drawViruses(state.viruses, alpha, t);
        if (state.sentries) this.drawSentries(state.sentries, alpha, t);
        if (state.errors) this.drawErrors(state.errors, alpha, t);
        if (state.pickups) this.drawPickups(state.pickups, alpha, t);
        if (state.fragments) this.drawFragments(state.fragments, alpha, t);
        this.drawGlueCages(state.players, alpha, t);
        if (state.nets) this.drawNets(state, alpha, t);
        if (state.barriers) this.drawBarriers(state.barriers, t);
        this.drawPinballArms(state, alpha, t);
        if (state.lures) this.drawLures(state.lures, t);
        this.drawGas(state, alpha, t);
        this.drawLasers(state, alpha, t);
        if (state.drone) this.drawDrone(state.drone, alpha, t);
      }
      const entryT =
        state.entryPortalT ?? (state.phase === 'countdown' && state.round > 1 ? 0.8 : 0);
      // The entry mouth is the connecting dot: draw it under the assembly intro too,
      // otherwise the player only sees the room after the portal clock has expired.
      if (entryT > 0) this.drawEntryPortal(state, t, entryT);
      this.drawPlayers(state, alpha, t, intro, view.localMask);
      if (introDone) {
        if (state.copyMarks) this.drawCopyMarks(state.copyMarks);
        if (state.aimMarks) this.drawAimMarks(state.aimMarks);
        this.drawJumpScares(state, t);
        for (let s = 0; s < state.players.length; s++) {
          if ((view.localMask & (1 << s)) === 0) continue;
          this.drawTravelProgress(state, s);
          this.drawLockReticle(state, s, t);
        }
        fx.particles.draw(ctx);
      }
      // A guest `NetView` has no World getters: derive the same right-wall portal from
      // the roundover phase and its countdown, so both peers draw one mouth.
      const exitOpen = state.portalOpen ?? (state.mode === 'match' && state.phase === 'roundover');
      const exitT = state.portalT ?? (state.mode === 'match' ? Math.max(0, 1.2 - state.phaseTimer) : 0);
      if (introDone && exitOpen) this.drawExitPortal(state, t, exitT);
      ctx.restore();

      // Screen-space pane HUD. Never panned or shaken, and clipped to the pane so a
      // split match keeps each dock on its own side of the divider.
      ctx.setTransform(base, 0, 0, base, this.dpr * this.offX, this.dpr * this.offY);
      ctx.save();
      ctx.beginPath();
      ctx.rect(view.x, view.y, view.w, view.h);
      ctx.clip();
      ctx.translate(view.x, view.y);
      let lowHp = false;
      for (let s = 0; s < state.players.length; s++) {
        if ((view.localMask & (1 << s)) === 0) continue;
        const p = state.players[s];
        if (p && p.alive && p.hp <= 1) {
          lowHp = true;
          break;
        }
      }
      if (introDone && lowHp && this.lowHpGradient) {
        // The warning is a border pulse, not a full-screen red veil. At one segment
        // the old 35% wash hid the fight under the hit the player was trying to read.
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, view.w, view.h);
        ctx.rect(18, 18, Math.max(0, view.w - 36), Math.max(0, view.h - 36));
        ctx.clip('evenodd');
        ctx.scale(view.w / VIEW_W, view.h / VIEW_H);
        ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.08;
        ctx.fillStyle = this.lowHpGradient;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.restore();
      }
      this.drawTravelOverlay(state, view);
      ctx.restore();
    }

    // Screen-space overlays shared by the whole frame.
    ctx.setTransform(base, 0, 0, base, this.dpr * this.offX, this.dpr * this.offY);
    // Time dilation: a pink edge wash marks the slow field even when nothing hostile
    // happens to be on screen. It sits under the hit flash so impacts stay readable.
    const slowT = state.timeSlowT ?? 0;
    if (slowT > 0 && introDone) {
      const fade = Math.min(1, slowT / 0.35);
      ctx.save();
      ctx.globalAlpha = 0.16 * fade;
      ctx.fillStyle = PROGRAM_COLORS.buffer;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 0.5 + 0.14 * Math.sin(t * 5);
      ctx.strokeStyle = PROGRAM_COLORS.buffer;
      ctx.lineWidth = 2.4;
      ctx.strokeRect(9, 9, VIEW_W - 18, VIEW_H - 18);
      ctx.restore();
    }
    if (this.viewCount > 1) {
      this.drawViewDivider(state);
      this.drawViewFrames(state);
    }

    // Impact flash is an edge cue, never a full-screen wash. A live fight can land
    // several hits in a row; covering the arena with additive white makes the fight
    // unreadable. Keep the colour and the setting, but confine them to a thin frame.
    if (Number.isFinite(fx.flash) && fx.flash > 0.002) {
      const scale = Number.isFinite(fx.flashScale) ? fx.flashScale : 0;
      const alpha = Math.max(0, Math.min(0.62, fx.flash * 0.55 * scale));
      if (alpha > 0.002) {
        const edge = 12;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fx.flashColor;
        ctx.fillRect(0, 0, VIEW_W, edge);
        ctx.fillRect(0, VIEW_H - edge, VIEW_W, edge);
        ctx.fillRect(0, edge, edge, VIEW_H - edge * 2);
        ctx.fillRect(VIEW_W - edge, edge, edge, VIEW_H - edge * 2);
        ctx.restore();
      }
    }

    if (introDone && this.showUi) this.drawHud(state, t);
    if (introDone) this.drawBossIntroTitle(state);
    // One readiness dock per local player at a screen corner, and one shared minimap.
    // The minimap sits top-center when there is more than one local, so it belongs to
    // the whole screen rather than to one pane.
    if (introDone && this.showUi) {
      this.drawReadinessDocks(state);
      if (this.showMinimap && !this.touchLayout) this.drawMinimap(state, t, this.localMask, this.localCount > 1);
    }
    this.drawPortalHop(dt);
  }

  /** Full-screen island-hop wipe. Drawn in virtual screen space over every pane. */
  private drawPortalHop(dt: number): void {
    if (this.hopT < 0) return;
    this.hopT += dt;
    const len = 0.9;
    if (this.hopT >= len) {
      this.hopT = -1;
      return;
    }
    const p = this.hopT / len;
    // Close over the old arena by 45%, then open onto the new one.
    const close = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
    const ease = close * close * (3 - 2 * close);
    const half = Math.max(10, (1 - ease) * 430 + 14);
    const cx = VIEW_W * 0.5;
    const cy = VIEW_H * 0.5;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#02050a';
    ctx.fillRect(0, 0, VIEW_W, Math.max(0, cy - half));
    ctx.fillRect(0, cy + half, VIEW_W, Math.max(0, VIEW_H - cy - half));
    ctx.fillRect(0, cy - half, Math.max(0, cx - half), half * 2);
    ctx.fillRect(cx + half, cy - half, Math.max(0, VIEW_W - cx - half), half * 2);
    // Square mouth rim and the particles being pulled in.
    ctx.globalAlpha = Math.min(1, 0.35 + close * 0.9);
    ctx.strokeStyle = '#bff4ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
    ctx.fillStyle = '#7fe6ff';
    for (let k = 0; k < 14; k++) {
      const a = k * 0.9 + p * 7;
      const d = half + 14 + ((k * 37 + p * 400) % 90);
      const size = 2 + (k % 3);
      ctx.fillRect(cx + Math.cos(a) * d - size * 0.5, cy + Math.sin(a) * d - size * 0.5, size, size);
    }
    if (close > 0.45) {
      ctx.globalAlpha = Math.min(1, (close - 0.45) * 2.4);
      ctx.fillStyle = '#eafcff';
      ctx.font = '600 15px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.hopLabel, cx, cy);
    }
    ctx.restore();
  }

  /**
   * The right-wall exit portal. One mouth for campaign clears and round hops: a square
   * on the right edge, a suction lane running back across the room, and square motes
   * accelerating into it. No gradients and no shadow blur.
   */
  private drawExitPortal(state: RenderState, t: number, pullT: number): void {
    const b = state.arena.bounds;
    const x = b.right - 36;
    const y = (b.top + b.bottom) * 0.5;
    const opening = Math.min(1, Math.max(0, pullT) / 0.3);
    const pulse = 0.5 + 0.5 * Math.sin(t * 5.4);
    const r = 44 + opening * 12 + pulse * 5;
    const ctx = this.ctx;
    ctx.save();

    // The mouth is a white square first, so it reads through the whole room.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.13 + opening * 0.18 + pulse * 0.08;
    ctx.fillStyle = '#dffbff';
    ctx.fillRect(x - r - 26, y - r - 26, (r + 26) * 2, (r + 26) * 2);
    ctx.globalAlpha = 0.42 + opening * 0.28;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - r * 1.36, y - r * 1.36, r * 2.72, r * 2.72);

    // Little white squares, not arrows: every mote is drawn as a clean block and
    // travels straight into the mouth across the whole arena height.
    const span = b.bottom - b.top;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 26; i++) {
      const laneY = b.top + 24 + ((i + 0.5) / 26) * (span - 48);
      const speed = 0.2 + (i % 5) * 0.028;
      const travel = (t * speed + i * 0.137) % 1;
      const start = b.left + 36;
      const end = x - r - 28;
      const px = start + (end - start) * travel;
      const size = 3 + (i % 4);
      ctx.globalAlpha = 0.38 + travel * 0.58;
      ctx.fillRect(px - size * 0.5, laneY - size * 0.5, size, size);
    }

    // Core: solid white with a pale cyan heart and a breathing rim.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#eafcff';
    ctx.fillRect(x - r - 7, y - r - 7, (r + 7) * 2, (r + 7) * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 0.66 + pulse * 0.2;
    ctx.strokeStyle = '#7fe6ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 0.5 + opening * 0.3;
    ctx.strokeStyle = '#eafcff';
    ctx.lineWidth = 2;
    const ring = r + 14 + pulse * 9;
    ctx.strokeRect(x - ring, y - ring, ring * 2, ring * 2);
    ctx.restore();
  }

  /** The left-wall entry portal. Bodies land in front of it after a hop. */
  private drawEntryPortal(state: RenderState, t: number, clock: number): void {
    const b = state.arena.bounds;
    const x = b.left + 36;
    const y = (b.top + b.bottom) * 0.5;
    const k = Math.min(1, Math.max(0, clock / 3));
    const pulse = 0.5 + 0.5 * Math.sin(t * 5.4);
    const r = 38 + k * 12 + pulse * 4;
    const ctx = this.ctx;
    ctx.save();

    // The landing mouth is the same white square as the exit, held open long enough
    // to be seen under the room's assembly animation.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 + k * 0.18;
    ctx.fillStyle = '#dffbff';
    ctx.fillRect(x - r - 24, y - r - 24, (r + 24) * 2, (r + 24) * 2);
    ctx.globalAlpha = 0.45 + k * 0.25;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);

    // Outward white squares: the room was thrown out of this mouth.
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + t * 0.35;
      const dist = r + 28 + ((i * 37 + t * 130) % 120) * k + 10;
      const size = 3 + (i % 3);
      ctx.globalAlpha = (0.32 + k * 0.4) * (1 - ((i * 37 + t * 130) % 120) / 150);
      ctx.fillRect(x + Math.cos(a) * dist - size * 0.5, y + Math.sin(a) * dist - size * 0.5, size, size);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#eafcff';
    ctx.fillRect(x - r - 7, y - r - 7, (r + 7) * 2, (r + 7) * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 0.7 + pulse * 0.2;
    ctx.strokeStyle = '#7fe6ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  /**
   * Feeds the camera director from game state. Waves glance at a pack dropping in from
   * off-screen; the campaign breach pushes in on the local player. Boss code can call
   * `playCameraRig` directly for a bespoke entrance.
   */
  private updateCameraCues(state: RenderState): void {
    if (state.campaign) {
      const kind = (state.campaignBannerT ?? 0) > 0 ? (state.campaignBannerKind ?? -1) : -1;
      if (kind !== this.lastCampaignKind) {
        this.lastCampaignKind = kind;
        if (kind === 1) {
          this.director.play({
            x: 0,
            y: 0,
            followSlot: state.localSlot,
            zoom: 1.08,
            hold: 0.9,
            blendIn: 0.45,
            blendOut: 0.8,
            weight: 0.8,
            priority: 3,
          });
        }
      }
    }
    // A staged mini-boss owns the camera for its frozen entrance. The rig follows the
    // live focus because the Mega Worm crosses the room while it swims in.
    const intro = state.bossIntro;
    if (intro) {
      // The Mega Worm entrance is a full-arena fly-past. Hold one wide frame on the
      // floor instead of chasing the head, so the player can read the lane it crosses.
      const mega = intro.kind === MINIBOSS.MEGA_WORM;
      const ab = state.arena.bounds;
      const centerX = (ab.left + ab.right) * 0.5;
      const centerY = (ab.top + ab.bottom) * 0.5;
      if (!this.bossCueLive || this.bossCueKind !== intro.kind) {
        this.bossCueLive = true;
        this.bossCueKind = intro.kind;
        this.director.play({
          x: mega ? centerX : intro.x,
          y: mega ? centerY : intro.y,
          followSlot: -1,
          zoom: mega ? CAMERA.megaArenaZoom : CAMERA.bossIntroZoom,
          hold: intro.duration + (mega ? 1.6 : 0.8),
          blendIn: 0.35,
          blendOut: 0.55,
          weight: 1,
          priority: 5,
        });
      } else if (!mega) {
        this.director.track(intro.x, intro.y, 5);
      }
    } else {
      // Non-staged bosses (Storm Cloud) keep the short combat cue.
      let boss: Worm | null = null;
      if (state.worms) {
        for (let i = 0; i < state.worms.length; i++) {
          const w = state.worms[i];
          if (!w.active || w.bossKind < 0 || w.armState || w.spawnT > 0) continue;
          boss = w;
          break;
        }
      }
      if (boss && state.campaign && boss.mega) {
        // A campaign Mega Worm fight stays wide for the whole encounter. Its passes are
        // fixed lanes, so the player needs the arena edge, not a close chase camera.
        if (!this.megaFightCue) {
          this.megaFightCue = true;
          const ab = state.arena.bounds;
          this.director.play({
            x: (ab.left + ab.right) * 0.5,
            y: (ab.top + ab.bottom) * 0.5,
            followSlot: -1,
            zoom: CAMERA.megaArenaZoom,
            hold: 100000,
            blendIn: 0.45,
            blendOut: 0.8,
            weight: 1,
            priority: 6,
          });
        }
      } else if (boss && (!this.bossCueLive || this.bossCueKind !== boss.bossKind)) {
        this.bossCueLive = true;
        this.bossCueKind = boss.bossKind;
        // Center between the head and the last plate so a long Mega Worm body reads as
        // one silhouette instead of the rig hanging on its face.
        let cueX = boss.x;
        let cueY = boss.y;
        if (boss.mega && boss.segCount > 0) {
          const tail = boss.segCount - 1;
          cueX = (boss.x + boss.segX[tail]) * 0.5;
          cueY = (boss.y + boss.segY[tail]) * 0.5;
        }
        this.director.play({
          x: cueX,
          y: cueY,
          followSlot: -1,
          zoom: CAMERA.bossIntroZoom,
          hold: 1.5,
          blendIn: 0.55,
          blendOut: 1.1,
          weight: 1,
          priority: 4,
        });
      } else if (!boss) {
        this.bossCueLive = false;
        this.bossCueKind = -1;
        if (this.megaFightCue) {
          this.megaFightCue = false;
          this.director.clear();
        }
      }
    }
    if (state.mode === 'gauntlet' && !state.campaign && state.sentries && (state.waveBannerT ?? 0) > 0) {
      const wave = state.wave ?? 0;
      if (wave !== this.lastWave) {
        this.lastWave = wave;
        const target = this.findWaveFocus(state);
        if (target >= 0) {
          const s = state.sentries[target];
          this.director.play({
            x: s.x,
            y: s.y,
            followSlot: -1,
            zoom: 0.94,
            hold: 0.55,
            blendIn: 0.3,
            blendOut: 0.6,
            weight: 0.5,
            priority: 1,
          });
        }
      }
    }
  }

  /** Nearest live sentry that is still outside the local view, else the nearest one. */
  private findWaveFocus(state: RenderState): number {
    const sentries = state.sentries;
    if (!sentries) return -1;
    const local = state.players[state.localSlot];
    if (!local) return -1;
    let best = -1;
    let bestD = Infinity;
    let bestEdge = -1;
    let bestEdgeD = Infinity;
    for (let i = 0; i < sentries.length; i++) {
      const s = sentries[i];
      if (!s.active) continue;
      const dx = s.x - local.x;
      const dy = s.y - local.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
      if (d > CAMERA.waveLookAhead * CAMERA.waveLookAhead && d < bestEdgeD) {
        bestEdgeD = d;
        bestEdge = i;
      }
    }
    return bestEdge >= 0 ? bestEdge : best;
  }

  /**
   * Builds the local panes. Everyone stays on one screen while the group fits at
   * `CAMERA.zoomMin`; only then do players split, and only into as many panes as the
   * groups need. A lone player across the arena adds one pane, not three. One pane is
   * full screen, two are side by side, three or four use a 2x2 grid.
   */
  private layoutViews(state: RenderState): void {
    // Active local slots in slot order. `splitSlots` is the QA hook today; a local
    // input-slot list will feed the same array.
    let localCount = 0;
    const wanted = this.splitSlots;
    if (wanted && wanted.length > 1) {
      for (let i = 0; i < wanted.length && localCount < MAX_VIEWS; i++) {
        const slot = wanted[i];
        if (slot >= 0 && slot < state.players.length && state.players[slot].active) {
          this.localList[localCount++] = slot;
        }
      }
    }
    if (localCount === 0) {
      this.localList[0] = state.localSlot;
      localCount = 1;
    }
    this.localCount = localCount;
    let mask = 0;
    for (let i = 0; i < localCount; i++) mask |= 1 << this.localList[i];
    this.localMask = mask;

    // Start with everyone in one group. Only split what does not fit one view at the
    // closest allowed zoom. Merging back uses a slightly stricter fit than staying
    // merged, so a group sitting on the threshold does not flicker between layouts.
    for (let i = 0; i < localCount; i++) this.groupOf[i] = 0;
    this.measureGroup(state, 0, localCount);
    // The single view may pull farther back than combat zoom before it gives up and
    // splits: `sharedZoomMin` is that extra floor. The group pad is part of the fit,
    // so the camera never puts an avatar on the pane edge to make the box fit.
    const pad = CAMERA.groupPad * 2;
    const minZoom = CAMERA_ZOOM * CAMERA.zoomMin;
    const sharedZoom = CAMERA_ZOOM * CAMERA.sharedZoomMin;
    const slack = this.lastViewCount > 1 ? -CAMERA.shareSlack : 0;
    const fullW = VIEW_W / sharedZoom - pad + slack;
    const fullH = VIEW_H / sharedZoom - pad + slack;
    let groupCount = 1;
    if (this.groupW > fullW || this.groupH > fullH) {
      const gap = CAMERA.splitGap;
      const paneZoom = minZoom * CAMERA.splitZoom;
      const paneW = (VIEW_W - gap) * 0.5 / paneZoom - pad;
      const paneH = VIEW_H / paneZoom - pad;
      groupCount = this.clusterLocalGroups(state, localCount, paneW, paneH);
      if (groupCount > 2) {
        // Three or four panes use the 2x2 grid, which is shorter than a side-by-side
        // pane. Re-cluster against the smaller box so no group is left clipped.
        const gridW = (VIEW_W - gap) * 0.5 / paneZoom - pad;
        const gridH = (VIEW_H - gap) * 0.5 / paneZoom - pad;
        groupCount = this.clusterLocalGroups(state, localCount, gridW, gridH);
      }
    }

    // Compact group ids so view i owns group i, and build each view's local mask.
    for (let i = 0; i < MAX_VIEWS; i++) this.groupRemap[i] = -1;
    let next = 0;
    for (let i = 0; i < localCount; i++) {
      const g = this.groupOf[i];
      if (this.groupRemap[g] < 0) this.groupRemap[g] = next++;
    }
    for (let i = 0; i < localCount; i++) this.groupOf[i] = this.groupRemap[this.groupOf[i]];
    groupCount = next;
    for (let g = 0; g < groupCount; g++) {
      let primary = -1;
      let groupMask = 0;
      for (let i = 0; i < localCount; i++) {
        if (this.groupOf[i] !== g) continue;
        const slot = this.localList[i];
        if (primary < 0) primary = slot;
        groupMask |= 1 << slot;
      }
      this.viewSlots[g] = primary;
      this.groupMasks[g] = groupMask;
    }

    const count = groupCount;
    const gap = CAMERA.splitGap;
    const prevCount = this.lastViewCount;
    for (let i = 0; i < count; i++) {
      const view = this.views[i];
      const slot = this.viewSlots[i];
      if (view.slot !== slot) {
        view.slot = slot;
        view.ready = false;
        view.wasAlive = false;
      }
      view.localMask = this.groupMasks[i];
      if (count === 1) {
        view.x = 0;
        view.y = 0;
        view.w = VIEW_W;
        view.h = VIEW_H;
      } else if (count === 2) {
        const w = (VIEW_W - gap) * 0.5;
        view.x = i === 0 ? 0 : w + gap;
        view.y = 0;
        view.w = w;
        view.h = VIEW_H;
      } else {
        const w = (VIEW_W - gap) * 0.5;
        const h = (VIEW_H - gap) * 0.5;
        view.x = (i % 2) === 0 ? 0 : w + gap;
        view.y = i < 2 ? 0 : h + gap;
        view.w = w;
        view.h = h;
      }
    }

    // Growing from a shared screen (or from fewer panes) starts the new panes on the
    // camera everyone was already looking at, then lets them pan apart. Without this a
    // fresh pane snaps across the arena the first time players separate.
    if (count > prevCount) {
      const from = this.views[0];
      for (let i = prevCount > 0 ? prevCount : 1; i < count; i++) {
        const view = this.views[i];
        view.camX = from.camX;
        view.camY = from.camY;
        view.zoom = from.zoom;
        view.arena = from.arena;
        view.ready = from.ready;
        view.wasAlive = from.wasAlive;
      }
    }
    let changed = prevCount > 0 && count !== prevCount;
    if (!changed && prevCount === count) {
      for (let i = 0; i < count; i++) {
        if (this.groupMasks[i] !== this.lastMasks[i]) {
          changed = true;
          break;
        }
      }
    }
    for (let i = 0; i < count; i++) this.lastMasks[i] = this.groupMasks[i];
    if (changed) this.layoutChanged = true;

    this.viewCount = count;
    this.lastViewCount = count;
  }

  /** Bounding box of one group, in world units. Used only for the fit tests. */
  private measureGroup(state: RenderState, group: number, count: number): void {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < count; i++) {
      if (this.groupOf[i] !== group) continue;
      const p = state.players[this.localList[i]];
      // A dead body is a spectator, not a subject for the framing fit. Counting a
      // corpse in a far corner would split the survivors' screen for nothing.
      if (!p || !p.active || !p.alive) continue;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    this.groupW = maxX >= minX ? maxX - minX : 0;
    this.groupH = maxY >= minY ? maxY - minY : 0;
  }

  /**
   * Splits the local players into the smallest number of groups whose boxes each fit a
   * plane of `fitW x fitH`. Recursively peels the farthest pair apart: a lone player
   * far from a tight trio becomes its own group and nothing else moves.
   */
  private clusterLocalGroups(state: RenderState, count: number, fitW: number, fitH: number): number {
    for (let i = 0; i < count; i++) this.groupOf[i] = 0;
    let groups = 1;
    let g = 0;
    while (g < groups && g < MAX_VIEWS) {
      this.measureGroup(state, g, count);
      if (this.groupW <= fitW && this.groupH <= fitH) {
        g++;
        continue;
      }
      let members = 0;
      for (let i = 0; i < count; i++) {
        if (this.groupOf[i] !== g) continue;
        const p = state.players[this.localList[i]];
        if (p && p.active && p.alive) members++;
      }
      if (members <= 1 || groups >= MAX_VIEWS) {
        g++;
        continue;
      }
      let ai = -1;
      let bi = -1;
      let bestD2 = -1;
      for (let i = 0; i < count; i++) {
        if (this.groupOf[i] !== g) continue;
        const a = state.players[this.localList[i]];
        if (!a || !a.active || !a.alive) continue;
        for (let j = i + 1; j < count; j++) {
          if (this.groupOf[j] !== g) continue;
          const b = state.players[this.localList[j]];
          if (!b || !b.active || !b.alive) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > bestD2) {
            bestD2 = d2;
            ai = i;
            bi = j;
          }
        }
      }
      if (ai < 0 || bi < 0) {
        g++;
        continue;
      }
      const ng = groups++;
      const a = state.players[this.localList[ai]];
      const b = state.players[this.localList[bi]];
      for (let i = 0; i < count; i++) {
        if (i === ai || this.groupOf[i] !== g) continue;
        const p = state.players[this.localList[i]];
        if (!p || !p.active || !p.alive) continue;
        const daX = p.x - a.x;
        const daY = p.y - a.y;
        const dbX = p.x - b.x;
        const dbY = p.y - b.y;
        if (dbX * dbX + dbY * dbY < daX * daX + daY * daY) this.groupOf[i] = ng;
      }
      // A co-located pair has no nearer seed; force the far seed into the new group.
      if (this.groupOf[bi] === g) this.groupOf[bi] = ng;
      // Loop on g again: the group just shrank and may still be too wide.
    }
    return groups;
  }

  /**
   * A colored outline per pane, in the primary local player's color. A split view over
   * a uniform floor can otherwise read as one camera with a seam; the outline makes
   * each window's bounds explicit even when both panes show similar geometry.
   */
  private drawViewFrames(state: RenderState): void {
    const ctx = this.ctx;
    for (let i = 0; i < this.viewCount; i++) {
      const view = this.views[i];
      const p = state.players[view.slot];
      const color = p ? playerColor(state, p) : state.arena.accent;
      ctx.save();
      // Dark underlay first so the color survives a bright bridge or a lit frame.
      ctx.strokeStyle = 'rgba(2, 6, 10, 0.92)';
      ctx.lineWidth = 5;
      ctx.strokeRect(view.x + 2.5, view.y + 2.5, view.w - 5, view.h - 5);
      ctx.globalAlpha = 0.82;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(view.x + 2.5, view.y + 2.5, view.w - 5, view.h - 5);
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1;
      ctx.strokeRect(view.x + 7.5, view.y + 7.5, view.w - 15, view.h - 15);
      ctx.restore();
    }
  }

  /** Thin line through the split gap, so two cameras read as two panes. */
  private drawViewDivider(state: RenderState): void {
    const ctx = this.ctx;
    const gap = CAMERA.splitGap;
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 10, 0.92)';
    if (this.viewCount === 2) {
      ctx.fillRect((VIEW_W - gap) * 0.5, 0, gap, VIEW_H);
    } else {
      ctx.fillRect((VIEW_W - gap) * 0.5, 0, gap, VIEW_H);
      ctx.fillRect(0, (VIEW_H - gap) * 0.5, VIEW_W, gap);
    }
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = state.arena.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (this.viewCount === 2) {
      const x = VIEW_W * 0.5 + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW_H);
    } else {
      const x = VIEW_W * 0.5 + 0.5;
      const y = VIEW_H * 0.5 + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIEW_H);
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW_W, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Weighted pull of one body on the camera. `updateCamera` resets the scratch each frame. */
  private addCameraFocus(x: number, y: number, anchorX: number, anchorY: number): void {
    const dx = x - anchorX;
    const dy = y - anchorY;
    const d = Math.hypot(dx, dy);
    if (d > CAMERA.focusRange) return;
    if (d > this.camSpread) this.camSpread = d;
    const w = 1 - d / CAMERA.focusRange;
    this.camPullW += w;
    this.camPullX += dx * w;
    this.camPullY += dy * w;
  }

  /**
   * Aim Bot's lock pull is intentionally not capped by `CAMERA.focusRange`. A legal
   * 2400-unit lock is longer than the normal group pull, and the whole point of the
   * scope is to keep both ends of that line on screen. The zoom floor does the rest.
   */
  private addAimLockFocus(x: number, y: number, anchorX: number, anchorY: number): void {
    const dx = x - anchorX;
    const dy = y - anchorY;
    const d = Math.hypot(dx, dy);
    if (d > this.camSpread) this.camSpread = d;
    this.camPullW += 1;
    this.camPullX += dx;
    this.camPullY += dy;
  }

  /**
   * While a local slot is dead, its camera follows the surviving squad first, then the
   * body that struck the killing blow, then the nearest living player. The killer can
   * be a player, a worm, a sentry, a cascading error or the training drone; a firewall
   * has no body to follow, so it falls through to the player fallback.
   */
  private findSpectateTarget(state: RenderState, local: Player): boolean {
    this.spectateKind = SRC.NONE;
    this.spectateId = -1;

    // Campaign drill partners are the only team-shaped group today. Team modes should
    // read a real team field here once one exists.
    if (state.campaign && state.campaignPhase === 'drill') {
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < state.players.length; i++) {
        const p = state.players[i];
        if (i === local.slot || !p.active || !p.alive || p.thrall) continue;
        const d = (p.x - local.x) * (p.x - local.x) + (p.y - local.y) * (p.y - local.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best >= 0) {
        this.spectateKind = SRC.PLAYER;
        this.spectateId = best;
        this.spectateX = state.players[best].x;
        this.spectateY = state.players[best].y;
        return true;
      }
    }

    const id = local.killerId;
    if (local.killerKind === SRC.PLAYER) {
      const p = id >= 0 && id < state.players.length ? state.players[id] : null;
      if (p && p.active && p.alive) {
        this.spectateKind = SRC.PLAYER;
        this.spectateId = id;
        this.spectateX = p.x;
        this.spectateY = p.y;
        return true;
      }
    } else if (local.killerKind === SRC.WORM) {
      const w = state.worms && id >= 0 ? state.worms[id] : null;
      if (w && w.active) {
        this.spectateKind = SRC.WORM;
        this.spectateId = id;
        this.spectateX = w.x;
        this.spectateY = w.y;
        return true;
      }
    } else if (local.killerKind === SRC.VIRUS) {
      const v = state.viruses && id >= 0 ? state.viruses[id] : null;
      if (v && v.active) {
        this.spectateKind = SRC.VIRUS;
        this.spectateId = id;
        this.spectateX = v.x;
        this.spectateY = v.y;
        return true;
      }
    } else if (local.killerKind === SRC.SENTRY) {
      const s = state.sentries && id >= 0 ? state.sentries[id] : null;
      if (s && s.active) {
        this.spectateKind = SRC.SENTRY;
        this.spectateId = id;
        this.spectateX = s.x;
        this.spectateY = s.y;
        return true;
      }
    } else if (local.killerKind === SRC.ERROR) {
      const e = state.errors && id >= 0 ? state.errors[id] : null;
      if (e && e.active) {
        this.spectateKind = SRC.ERROR;
        this.spectateId = id;
        this.spectateX = e.x;
        this.spectateY = e.y;
        return true;
      }
    } else if (local.killerKind === SRC.DRONE) {
      const d = state.drone;
      if (d && d.active) {
        this.spectateKind = SRC.DRONE;
        this.spectateId = 0;
        this.spectateX = d.x;
        this.spectateY = d.y;
        return true;
      }
    }

    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (i === local.slot || !p.active || !p.alive) continue;
      const d = (p.x - local.x) * (p.x - local.x) + (p.y - local.y) * (p.y - local.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      this.spectateKind = SRC.PLAYER;
      this.spectateId = best;
      this.spectateX = state.players[best].x;
      this.spectateY = state.players[best].y;
      return true;
    }
    return false;
  }

  private updateCamera(state: RenderState, view: CameraView, alpha: number, dt: number): void {
    const arena = state.arena;
    const b = arena.bounds;
    const local = state.players[view.slot];
    const aimView = !!local && local.active && local.program === PROGRAM_ID.AIMBOT;
    // A pad swap is a cut, not a pan. Snap on the half where the body changes plates.
    // A shared screen cuts when any of its players swaps, since they all share the frame.
    let padSwap = false;
    for (let s = 0; s < state.players.length; s++) {
      if ((view.localMask & (1 << s)) === 0) continue;
      const p = state.players[s];
      if (p && p.travelT > 0 && p.travelKind === TRAVEL.pad && p.travelSwap) {
        padSwap = true;
        break;
      }
    }
    let focusX = (b.left + b.right) * 0.5;
    let focusY = (b.top + b.bottom) * 0.5;
    let anchorX = focusX;
    let anchorY = focusY;
    let spectating = false;
    let leadAlive = false;
    let groupMinX = Infinity;
    let groupMinY = Infinity;
    let groupMaxX = -Infinity;
    let groupMaxY = -Infinity;
    this.camSpread = 0;

    // One camera per group. The anchor is the group's bounding-box centre, not the
    // mean: a tight pair plus one outlier then keeps both ends equally in frame.
    for (let s = 0; s < state.players.length; s++) {
      if ((view.localMask & (1 << s)) === 0) continue;
      const p = state.players[s];
      if (!p || !p.active || !p.alive) continue;
      const px = lerp(p.prevX, p.x, alpha);
      const py = lerp(p.prevY, p.y, alpha);
      if (px < groupMinX) groupMinX = px;
      if (py < groupMinY) groupMinY = py;
      if (px > groupMaxX) groupMaxX = px;
      if (py > groupMaxY) groupMaxY = py;
      leadAlive = true;
    }
    // A live mini-boss belongs in the frame even when it sits outside the normal
    // 640-unit focus pull. The Mega Worm's chain is longer than a screen, so leaving it
    // out puts the boss in a pane corner or off-screen while the camera hugs the squad.
    let bossFramed = false;
    let bossMinX = Infinity;
    let bossMinY = Infinity;
    let bossMaxX = -Infinity;
    let bossMaxY = -Infinity;
    const bossWorms = state.worms;
    if (bossWorms) {
      for (let i = 0; i < bossWorms.length; i++) {
        const w = bossWorms[i];
        if (!w.active || w.bossKind < 0 || w.armState) continue;
        bossFramed = true;
        // Frame the head, not the whole Mega Worm chain. At 3x the 13 plates span
        // roughly 2460 units, and fitting all of it would shrink the squad to dots.
        // The head is the subject; the trailing body may leave the pane.
        const rad = w.hitR;
        if (w.x - rad < bossMinX) bossMinX = w.x - rad;
        if (w.y - rad < bossMinY) bossMinY = w.y - rad;
        if (w.x + rad > bossMaxX) bossMaxX = w.x + rad;
        if (w.y + rad > bossMaxY) bossMaxY = w.y + rad;
      }
    }
    if (leadAlive && bossFramed) {
      // Frame the squad and the boss together. The combined box moves the anchor and
      // sets the fit zoom, so a boss arriving across the room is never just outside it.
      if (bossMinX < groupMinX) groupMinX = bossMinX;
      if (bossMinY < groupMinY) groupMinY = bossMinY;
      if (bossMaxX > groupMaxX) groupMaxX = bossMaxX;
      if (bossMaxY > groupMaxY) groupMaxY = bossMaxY;
    }
    if (leadAlive) {
      anchorX = (groupMinX + groupMaxX) * 0.5;
      anchorY = (groupMinY + groupMaxY) * 0.5;
      focusX = anchorX;
      focusY = anchorY;
      for (let s = 0; s < state.players.length; s++) {
        if ((view.localMask & (1 << s)) === 0) continue;
        const p = state.players[s];
        if (!p || !p.active || !p.alive) continue;
        const dx = lerp(p.prevX, p.x, alpha) - anchorX;
        const dy = lerp(p.prevY, p.y, alpha) - anchorY;
        const d = Math.hypot(dx, dy);
        if (d > this.camSpread) this.camSpread = d;
      }
      if (bossFramed) {
        // The boss head drives the pull-back too, so its silhouette is not treated as
        // one more threat inside the normal 640-unit focus band.
        const bx = Math.max(Math.abs(bossMinX - anchorX), Math.abs(bossMaxX - anchorX));
        const by = Math.max(Math.abs(bossMinY - anchorY), Math.abs(bossMaxY - anchorY));
        const bossSpread = Math.hypot(bx, by);
        if (bossSpread > this.camSpread) this.camSpread = bossSpread;
      }
    } else if (local && local.active && this.findSpectateTarget(state, local)) {
      anchorX = this.spectateX;
      anchorY = this.spectateY;
      focusX = anchorX;
      focusY = anchorY;
      spectating = true;
    } else if (local) {
      anchorX = local.x;
      anchorY = local.y;
      focusX = anchorX;
      focusY = anchorY;
    }

    // Nearby bodies lead the frame. The mean offset is damped so one threat behind the
    // player opens the view, while a brawl around them leaves the frame on the player.
    // A dead slot pulls around its spectate target instead of the corpse.
    if (local && local.active && (leadAlive || spectating)) {
      this.camPullW = 0;
      this.camPullX = 0;
      this.camPullY = 0;
      for (let i = 0; i < state.players.length; i++) {
        if ((view.localMask & (1 << i)) !== 0) continue;
        if (spectating && this.spectateKind === SRC.PLAYER && i === this.spectateId) continue;
        const p = state.players[i];
        if (!p.active || !p.alive) continue;
        this.addCameraFocus(p.x, p.y, anchorX, anchorY);
      }
      const drone = state.drone;
      if (drone && drone.active && !(spectating && this.spectateKind === SRC.DRONE)) {
        this.addCameraFocus(drone.x, drone.y, anchorX, anchorY);
      }
      const worms = state.worms;
      if (worms) {
        for (let i = 0; i < worms.length; i++) {
          const w = worms[i];
          if (!w.active) continue;
          if (spectating && this.spectateKind === SRC.WORM && i === this.spectateId) continue;
          this.addCameraFocus(w.x, w.y, anchorX, anchorY);
        }
      }
      const viruses = state.viruses;
      if (viruses) {
        for (let i = 0; i < viruses.length; i++) {
          const v = viruses[i];
          if (!v.active) continue;
          if (spectating && this.spectateKind === SRC.VIRUS && i === this.spectateId) continue;
          this.addCameraFocus(v.x, v.y, anchorX, anchorY);
        }
      }
      const sentries = state.sentries;
      if (sentries) {
        for (let i = 0; i < sentries.length; i++) {
          const s = sentries[i];
          if (!s.active) continue;
          if (spectating && this.spectateKind === SRC.SENTRY && i === this.spectateId) continue;
          this.addCameraFocus(s.x, s.y, anchorX, anchorY);
        }
      }
      const errors = state.errors;
      if (errors) {
        for (let i = 0; i < errors.length; i++) {
          const e = errors[i];
          if (!e.active) continue;
          if (spectating && this.spectateKind === SRC.ERROR && i === this.spectateId) continue;
          this.addCameraFocus(e.x, e.y, anchorX, anchorY);
        }
      }
      // Aim Bot's lock is the other half of the frame. Without this pull, a legal
      // 2400-unit lock would put the target outside the pane even at maximum zoom-out.
      if (aimView && local.lockActive) {
        this.addAimLockFocus(local.lockTX, local.lockTY, anchorX, anchorY);
      }
      if (this.camPullW > 0.001) {
        const pull = Math.min(1, this.camPullW * CAMERA.groupPull) * CAMERA.maxBias;
        focusX += (this.camPullX / this.camPullW) * pull;
        focusY += (this.camPullY / this.camPullW) * pull;
      }
    }

    // A rig overrides framing for a boss entrance, a narrative beat or a wave look-ahead.
    // It eases in, holds, and hands control back; a full blend may leave the avatar off
    // frame on purpose, which is why it stays opt-in and short.
    const rig = this.director.active ? this.director : null;
    // The boss entrance is a deliberate reveal and may undercut the combat floor.
    // Without this the fit clamp cancels most of its pull-back on a wide frame.
    const bossEntrance = !!rig && rig.zoom <= CAMERA.bossIntroZoom + 0.001;
    let rigZoom = 1;
    if (rig) {
      let rx = rig.x;
      let ry = rig.y;
      if (rig.followSlot >= 0) {
        const fp = state.players[rig.followSlot];
        if (fp && fp.active) {
          rx = lerp(fp.prevX, fp.x, alpha);
          ry = lerp(fp.prevY, fp.y, alpha);
        }
      }
      const look = rig.blend;
      focusX = lerp(focusX, rx, look);
      focusY = lerp(focusY, ry, look);
      const anchorBlend = Math.max(0, (look - 0.4) / 0.6);
      anchorX = lerp(anchorX, rx, anchorBlend);
      anchorY = lerp(anchorY, ry, anchorBlend);
      rigZoom = 1 + (rig.zoom - 1) * look;
    }

    // Zoom out when the focus group is spread, so both ends of the fight stay on screen.
    // The range is a multiplier of the base zoom: full view or split pane.
    const zoomBase = CAMERA_ZOOM * (this.viewCount > 1 ? CAMERA.splitZoom : 1);
    const spreadFrac = Math.min(1, this.camSpread / CAMERA.focusRange);
    let zoomTarget = zoomBase * (CAMERA.zoomMax + (CAMERA.zoomMin - CAMERA.zoomMax) * spreadFrac) * rigZoom;
    // Aim Bot sees the whole lane. The lower floor is what makes the long lock and the
    // six-target volley readable; every other program keeps the normal combat zoom.
    if (aimView) zoomTarget = Math.min(zoomTarget, CAMERA_ZOOM * AIMBOT.cameraZoom);

    // Never clip a group that fits. `layoutViews` already checked the fit at minimum
    // zoom; this is the exact cap for the box the camera is actually framing.
    if (leadAlive) {
      const pad = CAMERA.groupPad * 2;
      const boxW = Math.max(1, groupMaxX - groupMinX) + pad;
      const boxH = Math.max(1, groupMaxY - groupMinY) + pad;
      const fitZoom = Math.min(view.w / boxW, view.h / boxH);
      // A single shared view may pull back past combat zoom to keep the group together;
      // a split pane only needs the normal floor because the layout already sized it.
      // A boss needs a deeper floor than a player-only fight: the Mega Worm's chain can
      // exceed the arena width, and the normal combat floor would still clip it. The
      // entrance rig owns the frame while it runs, so it gets the entrance floor.
      const floor = zoomBase * (bossEntrance ? CAMERA.bossIntroZoom : bossFramed ? CAMERA.bossZoomMin : this.viewCount > 1 ? CAMERA.zoomMin : CAMERA.sharedZoomMin);
      if (fitZoom < zoomTarget) zoomTarget = Math.max(floor, fitZoom);
    }

    let targetX: number;
    let targetY: number;
    const viewW = view.w / zoomTarget;
    const viewH = view.h / zoomTarget;
    const spanX = b.right - b.left;
    const spanY = b.bottom - b.top;
    // On an open arena the frame may sit past the lip, so the drop is visible before
    // anyone steps on it. A flying boss needs the same look-past-the-lip space, or its
    // pass leaves the pane the moment it crosses the arena edge.
    const outerPad = Math.max(
      arena.walls === 'open' || arena.openShots ? CAMERA.voidMargin : 0,
      bossFramed ? CAMERA.bossVoidMargin : 0,
    );
    const camMinX = b.left - outerPad;
    const camMaxX = b.right - viewW + outerPad;
    const camMinY = b.top - outerPad;
    const camMaxY = b.bottom - viewH + outerPad;
    if (spanX + outerPad * 2 <= viewW) targetX = (b.left + b.right - viewW) * 0.5;
    else targetX = Math.max(camMinX, Math.min(camMaxX, focusX - viewW * 0.5));
    if (spanY + outerPad * 2 <= viewH) targetY = (b.top + b.bottom - viewH) * 0.5;
    else targetY = Math.max(camMinY, Math.min(camMaxY, focusY - viewH * 0.5));

    // The anchor never leaves the middle band of the view. Without this the pull could
    // push the player's own body toward the frame edge while it leads the fight.
    if (spanX > viewW) {
      const margin = viewW * CAMERA.edgeMargin;
      const minX = anchorX - (viewW - margin);
      const maxX = anchorX - margin;
      if (targetX < minX) targetX = minX;
      else if (targetX > maxX) targetX = maxX;
      targetX = Math.max(camMinX, Math.min(camMaxX, targetX));
    }
    if (spanY > viewH) {
      const margin = viewH * CAMERA.edgeMargin;
      const minY = anchorY - (viewH - margin);
      const maxY = anchorY - margin;
      if (targetY < minY) targetY = minY;
      else if (targetY > maxY) targetY = maxY;
      targetY = Math.max(camMinY, Math.min(camMaxY, targetY));
    }

    // Respawn is a cut too: the body reappears at a spawn, not where the spectate pane
    // was looking, so panning back would sweep the whole arena.
    const respawned = leadAlive && !view.wasAlive;
    if (padSwap || respawned || !view.ready || view.arena !== arena.id) {
      view.camX = targetX;
      view.camY = targetY;
      view.zoom = zoomTarget;
      view.ready = true;
      view.arena = arena.id;
    } else {
      const k = 1 - Math.exp(-CAMERA.follow * dt);
      view.camX += (targetX - view.camX) * k;
      view.camY += (targetY - view.camY) * k;
      const kz = 1 - Math.exp(-CAMERA.zoomFollow * dt);
      view.zoom += (zoomTarget - view.zoom) * kz;
    }
    view.wasAlive = leadAlive;
  }

  /**
   * Circuit traces, nodes and code glyphs baked into one repeating tile. Built once
   * per arena, never per frame; the arena keeps its own visual signature.
   */
  private ensureFloorPattern(arena: ArenaDef): void {
    if (this.floorPattern && this.floorPatternArena === arena.id) return;
    const tile = document.createElement('canvas');
    tile.width = 384;
    tile.height = 384;
    const c = tile.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 384, 384);
    c.strokeStyle = arena.accent;
    c.fillStyle = arena.accent;
    c.lineWidth = 1;

    // Sparse board traces with right-angle turns and small solder pads.
    c.globalAlpha = 0.14;
    for (let row = 0; row < 6; row++) {
      const y = 22 + row * 64;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(78, y);
      c.lineTo(78, y + 24);
      c.lineTo(168, y + 24);
      c.moveTo(256, y + 6);
      c.lineTo(256, y + 40);
      c.lineTo(330, y + 40);
      c.lineTo(330, y + 62);
      c.lineTo(384, y + 62);
      c.stroke();
      c.fillRect(77, y + 23, 3, 3);
      c.fillRect(329, y + 39, 3, 3);
    }
    c.globalAlpha = 0.1;
    for (let col = 0; col < 4; col++) {
      const x = 52 + col * 96;
      c.strokeRect(x, 116, 26, 18);
      c.beginPath();
      c.moveTo(x + 13, 116);
      c.lineTo(x + 13, 98);
      c.lineTo(x + 38, 98);
      c.stroke();
    }

    const glyphs = ['0xFF', '>>', '::', '##', '{}', '&&', '01', '//', '[]', 'λ', 'Σ', '∆'];
    c.font = '700 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let i = 0; i < glyphs.length; i++) {
      const x = 36 + ((i * 97) % 340);
      const y = 54 + ((i * 83) % 300);
      c.globalAlpha = 0.1 + (i % 3) * 0.012;
      c.fillText(glyphs[i], x, y);
    }
    this.floorPattern = this.ctx.createPattern(tile, 'repeat');
    this.floorPatternArena = arena.id;
  }

  /** Interior holes: the floor is missing, so the fill is dead black under a lit cut edge. */
  private drawVoids(arena: ArenaDef, alpha: number): void {
    const voids = arena.voids;
    if (!voids) return;
    const ctx = this.ctx;
    ctx.save();
    for (let i = 0; i < voids.length; i++) {
      const r = voids[i];
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#010309';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 0.16 * alpha;
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 8;
      ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
      ctx.globalAlpha = 0.6 * alpha;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      // A cut edge, not a shadow: a faint plate lip on the top side of the pit.
      ctx.globalAlpha = 0.35 * alpha;
      ctx.fillStyle = arena.accent;
      ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, 2);
    }
    ctx.restore();
  }

  /**
   * Breakable file boxes. A dark panel with a mark, one crack layer after the first hit,
   * a shake while the hit flash runs, and a drop-in fall when the compactor feeds one back.
   */
  private drawProps(props: readonly Prop[]): void {
    const ctx = this.ctx;
    for (let i = 0; i < props.length; i++) {
      const b = props[i];
      if (!b.active || b.capacitor || b.fixed) continue;
      const fall = b.dropT > 0 ? (b.dropT / FILE_PROP.dropT) * (b.dropT / FILE_PROP.dropT) * FILE_PROP.dropRise : 0;
      const shake = b.hitFlash > 0 ? (b.hitFlash / FILE_PROP.hitFlash) * 2 : 0;
      const x = b.x + (shake > 0 ? Math.sin(b.hitFlash * 140) * shake : 0);
      const y = b.y - fall;
      const hazard = b.hazard === true;
      const edge = hazard ? '#ff6a4d' : 'rgba(255, 194, 77, 0.8)';
      const mark = hazard ? '#ffd9c9' : 'rgba(255, 231, 178, 0.92)';
      ctx.save();
      if (fall > 0) {
        const shadow = 1 - fall / FILE_PROP.dropRise;
        ctx.globalAlpha = 0.24 * shadow;
        ctx.fillStyle = '#000';
        ctx.fillRect(b.x + 4, b.y + b.h - 3, b.w - 8, 5);
        ctx.globalAlpha = 1;
      }
      // A dashed, rounded outline says "light debris": it can be shoved and will move.
      ctx.beginPath();
      ctx.roundRect(x, y, b.w, b.h, 6);
      ctx.fillStyle = '#1a242e';
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, b.w - 6, b.h - 6, 4);
      ctx.fillStyle = hazard ? 'rgba(255, 74, 58, 0.24)' : 'rgba(255, 194, 77, 0.13)';
      ctx.fill();
      if (hazard) {
        ctx.strokeStyle = 'rgba(255, 90, 76, 0.35)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.roundRect(x - 2, y - 2, b.w + 4, b.h + 4, 7);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.roundRect(x + 0.5, y + 0.5, b.w - 1, b.h - 1, 6);
      ctx.strokeStyle = b.hitFlash > 0 ? '#fff4d4' : edge;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = mark;
      drawSymbol(ctx, PROP_GLYPHS[b.kind] ?? PROP_GLYPHS[1], x + b.w * 0.5, y + b.h * 0.5, 11);
      if (b.hp < FILE_PROP.hp) this.drawCracks(x + 1, y + 1, b.w - 2, b.h - 2, 1, 'rgba(4, 7, 11, 0.9)', i * 7 + b.kind);
      ctx.restore();
    }
  }

  /** The long right-wall feed body for the arcade cabinet. The mouth itself is a Pipe. */
  private drawFeedRun(arena: ArenaDef, t: number): void {
    const pipes = arena.pipes;
    if (!pipes) return;
    const ctx = this.ctx;
    for (let i = 0; i < pipes.length; i++) {
      const def = pipes[i];
      if (def.feed !== 'pinball') continue;
      const b = arena.bounds;
      const x = b.right - 22;
      const top = b.top + 150;
      const y = def.y;
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#111827';
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - 16, top, 32, Math.max(40, y - top), 12);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = arena.accentSoft;
      ctx.lineWidth = 1;
      for (let yy = top + 18; yy < y - 12; yy += 22) {
        ctx.beginPath();
        ctx.moveTo(x - 12, yy);
        ctx.lineTo(x + 12, yy);
        ctx.stroke();
      }
      // Elbow into the mouth, then a slow energy pulse down the run.
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#111827';
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(def.x, y - 16, b.right - def.x - 6, 32, 10);
      ctx.fill();
      ctx.stroke();
      const pulse = (t * 0.18 + i * 0.3) % 1;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = arena.accent;
      ctx.fillRect(x - 2, top + (y - top) * pulse, 4, 24);
      ctx.restore();
    }
  }

  /**
   * The ten-key floor. An up key is a recessed socket; a warning key lifts and glows;
   * a slammed/down key is a solid cap that blocks bodies and shots. The digit stays
   * readable in every state because it is the map's whole identity.
   */
  private drawKeypad(state: RenderState, t: number): void {
    const kp = state.arena.keypad;
    if (!kp) return;
    const ctx = this.ctx;
    const states = state.keypadStates;
    const padT = state.keypadT ?? t;
    ctx.save();

    // Housing. A dark recess around the caps makes the pad read as one object instead
    // of ten unrelated blocks dropped on the floor.
    ctx.globalAlpha = 0.98;
    ctx.fillStyle = '#070c10';
    ctx.fillRect(kp.x, kp.y, kp.w, kp.h);
    ctx.strokeStyle = state.arena.accentSoft;
    ctx.lineWidth = 2;
    ctx.strokeRect(kp.x + 0.5, kp.y + 0.5, kp.w - 1, kp.h - 1);
    ctx.globalAlpha = 0.56;
    ctx.strokeStyle = state.arena.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(kp.x + 8.5, kp.y + 8.5, kp.w - 17, kp.h - 17);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = FONT_KEYPAD_LABEL;
    ctx.fillStyle = 'rgba(255, 224, 142, 0.62)';
    ctx.fillText('10-KEY // FLOOR', kp.x + kp.w * 0.5, kp.y + 74);

    for (let i = 0; i < kp.keys.length; i++) {
      const key = kp.keys[i];
      const keyState = states?.[i] ?? KEYPAD_STATE.up;
      const x = key.x;
      const y = key.y;
      const w = key.w;
      const h = key.h;
      const s = Math.min(w / 250, h / 198);
      const keyPhase = keypadKeyPhase(kp, i, padT);

      // Socket under every cap, so an up key still has a visible footprint.
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#03070a';
      ctx.fillRect(x + 3 * s, y + 5 * s, w - 6 * s, h - 5 * s);
      ctx.strokeStyle = 'rgba(255, 207, 92, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3.5 * s, y + 5.5 * s, w - 7 * s, h - 6 * s);

      if (keyState === KEYPAD_STATE.up) {
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = 'rgba(255, 207, 92, 0.25)';
        ctx.fillRect(x + 15 * s, y + 15 * s, w - 30 * s, h - 30 * s);
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = '#ffe7a0';
        ctx.font = FONT_KEYPAD;
        ctx.fillText(key.digit, x + w * 0.5, y + h * 0.54);
        ctx.globalAlpha = 1;
        continue;
      }

      const warning = keyState === KEYPAD_STATE.warn;
      const slamming = keyState === KEYPAD_STATE.slam;
      const rising = keyState === KEYPAD_STATE.rise;
      // The cap travels through its slam and rise instead of snapping between poses;
      // the state still flips at the same sim boundary, so cover and damage are unchanged.
      const slamProgress = clamp01((keyPhase - KEYPAD.warn) / KEYPAD.slam);
      const riseProgress = clamp01(
        (keyPhase - KEYPAD.warn - KEYPAD.slam - KEYPAD.down) / KEYPAD.rise,
      );
      const capDepth = Math.max(10, h * 0.075);
      const lift = warning
        ? capDepth + Math.sin(t * 3 + i) * capDepth * 0.18
        : slamming
          ? capDepth * (1 - slamProgress)
          : rising
            ? capDepth * riseProgress
            : 0;
      const capY = y - lift;
      const hot = slamming || warning;

      // Cap body and its dark under-edge. The down face covers the socket exactly.
      ctx.globalAlpha = 1;
      ctx.fillStyle = slamming ? '#8a5a12' : warning ? '#3a2b12' : '#20251a';
      ctx.fillRect(x, capY, w, h);
      ctx.fillStyle = '#080d0f';
      ctx.fillRect(x, capY + h - 11 * s, w, 11 * s);

      // Recessed top face.
      ctx.fillStyle = slamming ? '#ffcf5c' : warning ? '#4b3716' : '#2a3020';
      ctx.fillRect(x + 8 * s, capY + 8 * s, w - 16 * s, h - 24 * s);
      ctx.strokeStyle = hot ? '#ffb04a' : rising ? 'rgba(255, 207, 92, 0.45)' : state.arena.accent;
      ctx.lineWidth = hot ? 3 : 2;
      ctx.globalAlpha = hot ? 0.95 : 0.8;
      ctx.strokeRect(x + 8.5 * s, capY + 8.5 * s, w - 17 * s, h - 25 * s);

      // Down caps are cover: the center panel, corner bolts and a hard bright rim.
      ctx.globalAlpha = 1;
      ctx.fillStyle = slamming ? '#1b1608' : '#171c12';
      ctx.fillRect(x + 19 * s, capY + 20 * s, w - 38 * s, h - 48 * s);
      ctx.strokeStyle = hot ? '#fff0b0' : 'rgba(255, 224, 142, 0.42)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 20.5 * s, capY + 21.5 * s, w - 41 * s, h - 50 * s);
      ctx.fillStyle = hot ? '#fff3bb' : 'rgba(255, 224, 142, 0.6)';
      for (let c = 0; c < 4; c++) {
        ctx.fillRect(
          x + (c < 2 ? 13 * s : w - 17 * s),
          capY + (c % 2 === 0 ? 13 * s : h - 17 * s),
          4 * s,
          4 * s,
        );
      }

      if (warning) {
        // A falling three-bar hazard mark, not a text label: readable at a glance while
        // the player is moving across the pad.
        ctx.fillStyle = '#ffb04a';
        for (let bar = 0; bar < 3; bar++) {
          const by = capY + 23 * s + bar * 9 * s + Math.sin(t * 2 + i + bar) * 2 * s;
          ctx.fillRect(x + w * 0.5 - 26 * s + bar * 8 * s, by, 52 * s - bar * 8 * s, 3 * s);
        }
      }

      ctx.globalAlpha = slamming ? 1 : 0.92;
      ctx.fillStyle = slamming ? '#100d05' : '#ffe7a0';
      ctx.font = FONT_KEYPAD;
      ctx.fillText(key.digit, x + w * 0.5, capY + h * 0.55);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /**
   * The document bed. Pages rise from a feed slot, sit under a glass platen, then
   * drop away. The read head is the arena hazard: it travels down the sheet and
   * snaps back up before the page swap. The clock/page travel in Snapshot; damage
   * stays host-side.
   */
  private drawScanner(state: RenderState, t: number): void {
    const sc = state.arena.scanner;
    if (!sc) return;
    const ctx = this.ctx;
    const clock = state.scannerT ?? 0;
    const phase = state.scannerPhase ?? scannerPhaseAt(clock);
    const cycle = SCANNER.load + SCANNER.warn + SCANNER.down + SCANNER.up + SCANNER.unload;
    const local = ((clock % cycle) + cycle) % cycle;
    let slide = 0;
    if (local < SCANNER.load) {
      slide = (1 - local / SCANNER.load) * sc.h;
    } else if (local > cycle - SCANNER.unload) {
      slide = ((local - (cycle - SCANNER.unload)) / SCANNER.unload) * sc.h;
    }
    const pageIndex = state.scannerPage ?? 0;
    const page = sc.documents.length > 0
      ? sc.documents[((pageIndex % sc.documents.length) + sc.documents.length) % sc.documents.length]
      : 'UNTITLED';

    ctx.save();
    // Heavy platen housing, with bolts at the corners.
    ctx.fillStyle = '#070d11';
    ctx.fillRect(sc.x - 34, sc.y - 38, sc.w + 68, sc.h + 76);
    ctx.strokeStyle = 'rgba(216, 230, 255, 0.32)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sc.x - 33.5, sc.y - 37.5, sc.w + 67, sc.h + 75);
    ctx.strokeStyle = 'rgba(216, 230, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sc.x - 23.5, sc.y - 27.5, sc.w + 47, sc.h + 55);
    ctx.fillStyle = 'rgba(216, 230, 255, 0.42)';
    for (let i = 0; i < 4; i++) {
      const bx = i % 2 === 0 ? sc.x - 23 : sc.x + sc.w + 18;
      const by = i < 2 ? sc.y - 24 : sc.y + sc.h + 17;
      ctx.fillRect(bx, by, 5, 5);
    }

    // Recessed glass and page. The clip is what makes load/unload read as a slot.
    ctx.fillStyle = '#0d1418';
    ctx.fillRect(sc.x - 10, sc.y - 10, sc.w + 20, sc.h + 20);
    ctx.save();
    ctx.beginPath();
    ctx.rect(sc.x, sc.y, sc.w, sc.h);
    ctx.clip();
    ctx.translate(0, slide);
    this.drawScannerPage(sc, page, pageIndex);
    ctx.restore();

    // Glass reflection and the feed slot below the platen.
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#d9f1ff';
    ctx.fillRect(sc.x, sc.y, sc.w, 3);
    ctx.fillRect(sc.x, sc.y, 3, sc.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#060b0e';
    ctx.fillRect(sc.x - 6, sc.y + sc.h + 8, sc.w + 12, 17);
    ctx.strokeStyle = 'rgba(216, 230, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sc.x - 5.5, sc.y + sc.h + 8.5, sc.w + 11, 16);
    ctx.fillStyle = 'rgba(216, 230, 255, 0.38)';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(sc.x + 31 + i * (sc.w - 62) * 0.2, sc.y + sc.h + 13, 24, 7);
    }

    const line = scannerLaserY(sc, clock);
    if (line >= 0) {
      const hot = phase === SCANNER_STATE.down || phase === SCANNER_STATE.up;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = THREAT_COLORS.firewall;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(sc.x + 7, line);
      ctx.lineTo(sc.x + sc.w - 7, line);
      ctx.globalAlpha = 0.1 * (hot ? 1 : 0.5);
      ctx.lineWidth = SCANNER.width + 20;
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = SCANNER.width;
      ctx.stroke();
      ctx.globalAlpha = 0.58;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = '#fff2d8';
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      // Carriage blocks make the beam read as a read head, not a free-floating line.
      ctx.fillStyle = THREAT_COLORS.firewall;
      ctx.fillRect(sc.x - 19, line - 13, 9, 26);
      ctx.fillRect(sc.x + sc.w + 10, line - 13, 9, 26);
    } else if (phase === SCANNER_STATE.warn) {
      const blink = 0.4 + 0.6 * Math.abs(Math.sin(t * 18));
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.18 * blink;
      ctx.strokeStyle = THREAT_COLORS.firewall;
      ctx.lineWidth = SCANNER.width + 10;
      ctx.beginPath();
      ctx.moveTo(sc.x + 7, sc.y + 3);
      ctx.lineTo(sc.x + sc.w - 7, sc.y + 3);
      ctx.stroke();
      ctx.globalAlpha = 0.7 * blink;
      ctx.lineWidth = 1;
      ctx.setLineDash([10, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Status is kept in the housing margins, clear of the page copy.
    let status = 'READY';
    if (phase === SCANNER_STATE.load) status = 'LOADING NEXT SHEET';
    else if (phase === SCANNER_STATE.warn) status = 'SCAN STARTING';
    else if (phase === SCANNER_STATE.down) status = 'READING DOWN';
    else if (phase === SCANNER_STATE.up) status = 'RETURNING';
    else if (phase === SCANNER_STATE.unload) status = 'UNLOADING';
    ctx.globalAlpha = 0.7;
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = state.arena.accent;
    ctx.fillText('PLATEN 02 // ' + status, sc.x - 4, sc.y - 17);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(216, 230, 255, 0.55)';
    ctx.fillText(`SHEET ${String(pageIndex + 1).padStart(2, '0')}`, sc.x + sc.w + 5, sc.y - 17);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** One page of simulated corporate paper. Text is fixed decoration, not content. */
  private drawScannerPage(sc: ArenaScannerDef, title: string, index: number): void {
    const ctx = this.ctx;
    const x = sc.x + 16;
    const y = sc.y + 16;
    const w = sc.w - 32;
    const h = sc.h - 32;
    const redacted = title.includes('REDACTED') || index % 3 === 1;

    ctx.save();
    ctx.fillStyle = '#d2dad8';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#b8c3c1';
    ctx.fillRect(x, y, w, 72);
    ctx.fillStyle = '#a4b0ae';
    ctx.fillRect(x, y + 72, w, 2);
    ctx.fillStyle = '#5d696b';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOCALHOST // INTERNAL REVIEW // NOT FOR DISTRIBUTION', x + 20, y + 22);
    ctx.fillStyle = '#1d282b';
    ctx.font = FONT_PAGE_TITLE;
    ctx.fillText(title, x + 20, y + 49);
    ctx.fillStyle = 'rgba(29, 40, 43, 0.52)';
    ctx.font = FONT_SMALL;
    ctx.fillText(`FILED ${String(index + 4).padStart(2, '0')} / REV 03:12 / COPY ${index % 3 + 1}`, x + 20, y + 67);

    // Fake body copy. Varying rule lengths keep every page from reading as a form.
    const bodyW = w - 40;
    for (let i = 0; i < 11; i++) {
      const lineY = y + 100 + i * 24;
      const lineW = bodyW * (0.56 + ((i * 37) % 44) * 0.01);
      if (redacted && (i === 3 || i === 6)) {
        ctx.fillStyle = '#111719';
        ctx.fillRect(x + 20, lineY - 3, lineW + 12, 8);
        ctx.fillStyle = 'rgba(190, 70, 58, 0.72)';
        ctx.font = FONT_SMALL;
        ctx.fillText('REDACTED', x + 24, lineY + 1);
        continue;
      }
      ctx.fillStyle = i % 4 === 0 ? '#8d999a' : '#aeb8b7';
      ctx.fillRect(x + 20, lineY, lineW, 2);
      if (i % 3 === 1) {
        ctx.fillStyle = 'rgba(94, 108, 108, 0.55)';
        ctx.fillRect(x + 20 + lineW + 12, lineY, Math.max(8, bodyW - lineW - 18), 2);
      }
    }

    // A revision stamp and a redaction bar make the b-story visible without a cutscene.
    ctx.save();
    ctx.translate(x + w - 106, y + h - 46);
    ctx.rotate(-0.06);
    ctx.strokeStyle = redacted ? 'rgba(155, 50, 42, 0.7)' : 'rgba(66, 91, 96, 0.58)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 90, 28);
    ctx.fillStyle = redacted ? 'rgba(155, 50, 42, 0.7)' : 'rgba(66, 91, 96, 0.58)';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'center';
    ctx.fillText(redacted ? 'REDACTED' : 'REVIEWED', 45, 15);
    ctx.restore();

    ctx.fillStyle = 'rgba(50, 63, 65, 0.52)';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.fillText(`SHEET ${String(index + 1).padStart(2, '0')} // COLD STORAGE`, x + 20, y + h - 20);
    ctx.textAlign = 'right';
    ctx.fillText('DO NOT ARCHIVE', x + w - 20, y + h - 20);
    ctx.restore();
  }

  /**
   * Fax bed: a pale incoming sheet under a compact thermal carriage. The head
   * traverses one row, feeds down a line, then traverses the next row in reverse.
   * Only the head itself is the arena hazard.
   */
  private drawFax(state: RenderState, t: number): void {
    const fx = state.arena.fax;
    if (!fx) return;
    const ctx = this.ctx;
    const clock = state.faxT ?? 0;
    const phase = state.faxPhase ?? faxPhaseAt(fx, clock);
    const headX = faxHeadX(fx, clock);
    const headY = faxHeadY(fx, clock);
    const row = faxRowAt(fx, clock);
    const pageIndex = state.faxPage ?? 0;
    const title = fx.documents.length > 0
      ? fx.documents[((pageIndex % fx.documents.length) + fx.documents.length) % fx.documents.length]
      : 'UNTITLED';
    const moving = phase === FAX_STATE.printRight || phase === FAX_STATE.printLeft;
    const dir = phase === FAX_STATE.printRight ? 1 : -1;
    const blink = 0.35 + 0.65 * Math.abs(Math.sin(t * 15));
    const halfW = fx.headW * 0.5;
    const halfH = fx.headH * 0.5;

    ctx.save();
    // Heavy fax chassis and a recessed paper slot.
    ctx.fillStyle = '#0b0c0e';
    ctx.fillRect(fx.x - 34, fx.y - 38, fx.w + 68, fx.h + 76);
    ctx.strokeStyle = 'rgba(255, 195, 92, 0.34)';
    ctx.lineWidth = 2;
    ctx.strokeRect(fx.x - 33.5, fx.y - 37.5, fx.w + 67, fx.h + 75);
    ctx.strokeStyle = 'rgba(255, 195, 92, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(fx.x - 23.5, fx.y - 27.5, fx.w + 47, fx.h + 55);
    ctx.fillStyle = 'rgba(255, 218, 150, 0.42)';
    for (let i = 0; i < 4; i++) {
      const bx = i % 2 === 0 ? fx.x - 23 : fx.x + fx.w + 18;
      const by = i < 2 ? fx.y - 24 : fx.y + fx.h + 17;
      ctx.fillRect(bx, by, 5, 5);
    }

    // Sheet and its clip. The sheet is a floor object, so it stays under the bodies.
    ctx.fillStyle = '#0d0f0f';
    ctx.fillRect(fx.x - 10, fx.y - 10, fx.w + 20, fx.h + 20);
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx.x, fx.y, fx.w, fx.h);
    ctx.clip();
    this.drawFaxPage(fx, title, pageIndex);
    ctx.restore();

    // Guides, feed rollers and the two rails the carriage runs on.
    ctx.fillStyle = '#060809';
    ctx.fillRect(fx.x - 6, fx.y + fx.h + 8, fx.w + 12, 17);
    ctx.strokeStyle = 'rgba(255, 195, 92, 0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(fx.x - 5.5, fx.y + fx.h + 8.5, fx.w + 11, 16);
    ctx.fillStyle = 'rgba(255, 195, 92, 0.38)';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(fx.x + 24 + i * (fx.w - 48) * 0.14, fx.y + fx.h + 13, 22, 7);
    }
    ctx.strokeStyle = 'rgba(255, 195, 92, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fx.x - 12, fx.y - 9);
    ctx.lineTo(fx.x + fx.w + 12, fx.y - 9);
    ctx.moveTo(fx.x - 12, fx.y + fx.h + 5);
    ctx.lineTo(fx.x + fx.w + 12, fx.y + fx.h + 5);
    ctx.stroke();

    // Rail marks at the edges show the current row without drawing a beam across it.
    ctx.fillStyle = 'rgba(255, 195, 92, 0.34)';
    ctx.fillRect(fx.x - 12, headY - 1, 14, 3);
    ctx.fillRect(fx.x + fx.w - 2, headY - 1, 14, 3);

    // Only this compact carriage is hot; the rest of the row is just paper.
    if (moving) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255, 154, 88, 0.18)';
      ctx.beginPath();
      ctx.ellipse(headX, headY, halfW + 17, halfH + 12, 0, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 244, 207, 0.12)';
      ctx.beginPath();
      ctx.ellipse(headX, headY, halfW + 6, halfH + 4, 0, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = moving ? '#ffad62' : '#5b4632';
    roundRect(ctx, headX - halfW, headY - halfH, fx.headW, fx.headH, 6);
    ctx.fill();
    ctx.strokeStyle = moving ? '#fff0c8' : 'rgba(255, 195, 92, 0.38)';
    ctx.lineWidth = moving ? 2 : 1;
    roundRect(ctx, headX - halfW + 0.5, headY - halfH + 0.5, fx.headW - 1, fx.headH - 1, 6);
    ctx.stroke();
    ctx.fillStyle = '#1a1410';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(headX - halfW + 5 + i * (fx.headW - 10) * 0.2, headY - halfH + 6, 4, 5);
    }
    ctx.fillStyle = moving ? '#fff4cf' : `rgba(255, 228, 177, ${0.18 + blink * 0.2})`;
    ctx.fillRect(headX - halfW + 8, headY + halfH - 4, fx.headW - 16, 3);

    // Status lives in the chassis margins, clear of the sheet copy.
    const rowLabel = `LINE ${String(row + 1).padStart(2, '0')}/${String(fx.rows).padStart(2, '0')}`;
    const status = moving ? (dir > 0 ? 'PRINTING RIGHT' : 'PRINTING LEFT') : 'LINE FEED // NEXT ROW';
    ctx.globalAlpha = 0.78;
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = state.arena.accent;
    ctx.fillText('FAX // TX 004', fx.x - 4, fx.y - 17);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 224, 177, 0.6)';
    ctx.fillText(`SHEET ${String(pageIndex + 1).padStart(2, '0')} // ${rowLabel} // ${status}`, fx.x + fx.w + 5, fx.y - 17);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** One incoming fax sheet. The printed copy is decorative, not game state. */
  private drawFaxPage(fx: ArenaFaxDef, title: string, index: number): void {
    const ctx = this.ctx;
    const x = fx.x + 16;
    const y = fx.y + 16;
    const w = fx.w - 32;
    const h = fx.h - 32;

    ctx.save();
    ctx.fillStyle = '#dedbcc';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#b7b19f';
    ctx.fillRect(x, y, w, 64);
    ctx.fillStyle = '#9f9988';
    ctx.fillRect(x, y + 64, w, 2);
    ctx.fillStyle = '#252b2a';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('INCOMING FAX // LOCALHOST // CHANNEL 04', x + 20, y + 19);
    ctx.fillStyle = '#1d2524';
    ctx.font = FONT_PAGE_TITLE;
    ctx.fillText(title, x + 20, y + 45);
    ctx.fillStyle = 'rgba(29, 37, 36, 0.58)';
    ctx.font = FONT_SMALL;
    ctx.fillText(`TX ${String(index + 4).padStart(3, '0')} / REV 02:14 / COPY ${index % 3 + 1}`, x + 20, y + 57);

    // Fax routing block and a fake transmission log.
    ctx.fillStyle = '#8d897b';
    ctx.font = FONT_SMALL;
    ctx.fillText('TO: LOCALHOST OPERATIONS', x + 20, y + 86);
    ctx.fillText('FROM: UNKNOWN SENDER', x + 20, y + 104);
    ctx.fillText('SUBJECT: PAPER JAM // URGENT', x + 20, y + 122);
    ctx.fillStyle = '#a19b89';
    ctx.fillRect(x + 20, y + 136, w - 40, 2);

    const bodyW = w - 40;
    for (let i = 0; i < 13; i++) {
      const lineY = y + 158 + i * 25;
      const lineW = bodyW * (0.48 + ((i * 31) % 48) * 0.01);
      ctx.fillStyle = i % 5 === 0 ? '#8f9388' : '#a9aa9c';
      ctx.fillRect(x + 20, lineY, lineW, 2);
      if (i % 4 === 1) {
        ctx.fillStyle = 'rgba(99, 108, 99, 0.55)';
        ctx.fillRect(x + 20 + lineW + 12, lineY, Math.max(8, bodyW - lineW - 18), 2);
      }
    }

    // A faint fax watermark and a receipt stamp.
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#1c2825';
    ctx.font = '900 152px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FAX', x + w * 0.5, y + h * 0.56);
    ctx.restore();
    ctx.save();
    ctx.translate(x + w - 118, y + h - 54);
    ctx.rotate(-0.06);
    ctx.strokeStyle = 'rgba(155, 88, 42, 0.72)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 104, 30);
    ctx.fillStyle = 'rgba(155, 88, 42, 0.72)';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'center';
    ctx.fillText(index % 2 === 0 ? 'RECEIVED' : 'RETRYING', 52, 16);
    ctx.restore();

    ctx.fillStyle = 'rgba(72, 79, 71, 0.55)';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.fillText(`SHEET ${String(index + 1).padStart(2, '0')} // THERMAL FEED`, x + 20, y + h - 20);
    ctx.textAlign = 'right';
    ctx.fillText('DO NOT REFAX', x + w - 20, y + h - 20);
    ctx.restore();
  }

  /**
   * Browser-window dressing: tab strip, URL bar, the active forum page and its cursor.
   * The chrome is static cover; the active page's cards and link are local simulation
   * state, so a hosted room never reaches this map.
   */
  private drawBrowser(state: RenderState): void {
    const b = state.arena.browser;
    if (!b || b.pages.length === 0) return;
    const ctx = this.ctx;
    const arena = state.arena;
    const page = b.page;
    const chrome = b.chrome;
    const pageIndex = ((state.browserPage ?? 0) % b.pages.length + b.pages.length) % b.pages.length;
    const forum = b.pages[pageIndex];

    ctx.save();
    // Page body. This intentionally covers the generic pillar fill below it; the
    // browser cards and chrome are redrawn with their own faces in this pass.
    ctx.fillStyle = '#091116';
    ctx.fillRect(page.x, page.y, page.w, page.h);
    ctx.strokeStyle = 'rgba(89, 216, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(page.x + 0.5, page.y + 0.5, page.w - 1, page.h - 1);
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = arena.accent;
    for (let i = 0; i < 15; i++) {
      const lineY = page.y + 52 + i * 48;
      ctx.fillRect(page.x + 36, lineY, page.w - 92, 1);
    }
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = 'rgba(200, 236, 246, 0.35)';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(forum.title, page.x + 36, page.y + 276);
    ctx.fillText(`PAGE ${pageIndex + 1} / ${b.pages.length} // CLICK TO NAVIGATE`, page.x + 36, page.y + 324);
    ctx.globalAlpha = 1;

    // Chrome band: tabs first, then the URL row.
    ctx.fillStyle = '#070c11';
    ctx.fillRect(chrome.x, chrome.y, chrome.w, chrome.h);
    ctx.fillStyle = 'rgba(89, 216, 255, 0.18)';
    ctx.fillRect(chrome.x, chrome.y + chrome.h - 2, chrome.w, 2);
    ctx.strokeStyle = 'rgba(89, 216, 255, 0.34)';
    ctx.lineWidth = 1;
    ctx.strokeRect(chrome.x + 0.5, chrome.y + 0.5, chrome.w - 1, chrome.h - 1);

    let tabX = chrome.x + 22;
    for (let i = 0; i < b.tabs.length; i++) {
      const tab = b.tabs[i];
      const active = i === b.activeTab;
      ctx.fillStyle = active ? '#1a2b35' : '#101820';
      ctx.fillRect(tabX, chrome.y + 12, tab.w, 43);
      ctx.strokeStyle = active ? 'rgba(89, 216, 255, 0.65)' : 'rgba(160, 200, 215, 0.18)';
      ctx.strokeRect(tabX + 0.5, chrome.y + 12.5, tab.w - 1, 42);
      if (active) {
        ctx.fillStyle = arena.accent;
        ctx.fillRect(tabX + 1, chrome.y + 51, tab.w - 2, 3);
      }
      ctx.fillStyle = active ? '#dff7ff' : 'rgba(184, 220, 232, 0.55)';
      ctx.font = FONT_SMALL;
      ctx.textAlign = 'left';
      ctx.fillText(tab.label, tabX + 14, chrome.y + 34);
      // Close mark on every tab; purely decorative, the strip is solid cover.
      ctx.fillStyle = active ? 'rgba(223, 247, 255, 0.62)' : 'rgba(184, 220, 232, 0.28)';
      ctx.fillText('x', tabX + tab.w - 18, chrome.y + 34);
      tabX += tab.w + 8;
    }
    if (tabX < chrome.x + chrome.w - 30) {
      ctx.fillStyle = 'rgba(89, 216, 255, 0.45)';
      ctx.fillRect(tabX + 8, chrome.y + 28, 9, 2);
      ctx.fillRect(tabX + 11.5, chrome.y + 24.5, 2, 9);
    }

    // URL row and its large navigation buttons.
    ctx.fillStyle = '#0b151c';
    ctx.fillRect(chrome.x + 22, chrome.y + 68, chrome.w - 44, 48);
    ctx.strokeStyle = 'rgba(160, 210, 225, 0.22)';
    ctx.strokeRect(chrome.x + 22.5, chrome.y + 68.5, chrome.w - 45, 47);
    ctx.fillStyle = 'rgba(89, 216, 255, 0.72)';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'center';
    ctx.fillText('‹', chrome.x + 48, chrome.y + 92);
    ctx.fillText('›', chrome.x + 78, chrome.y + 92);
    ctx.fillText('↻', chrome.x + 108, chrome.y + 92);
    ctx.fillStyle = '#dff7ff';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.fillText(forum.url, chrome.x + 132, chrome.y + 92);
    ctx.fillStyle = 'rgba(120, 210, 160, 0.85)';
    ctx.fillText('LOCK', chrome.x + chrome.w - 74, chrome.y + 92);

    // Forum cards: cover with a browser title bar and a close control.
    for (let i = 0; i < forum.elements.length; i++) {
      const p = forum.elements[i];
      ctx.fillStyle = 'rgba(4, 9, 12, 0.55)';
      ctx.fillRect(p.x + 5, p.y + 5, p.w, p.h);
      ctx.fillStyle = '#0e1a21';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(89, 216, 255, 0.52)' : 'rgba(160, 220, 232, 0.34)';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(89, 216, 255, 0.16)' : 'rgba(160, 220, 232, 0.1)';
      ctx.fillRect(p.x + 1, p.y + 1, p.w - 2, 30);
      ctx.fillStyle = '#cceff8';
      ctx.font = FONT_SMALL;
      ctx.textAlign = 'left';
      ctx.fillText(p.title, p.x + 12, p.y + 16);
      ctx.fillStyle = 'rgba(200, 236, 246, 0.5)';
      ctx.fillText('x', p.x + p.w - 16, p.y + 16);
      ctx.fillStyle = 'rgba(174, 213, 224, 0.18)';
      for (let line = 0; line < 4; line++) {
        ctx.fillRect(p.x + 16, p.y + 50 + line * 16, p.w - 32 - (line % 2) * 28, 2);
      }
      ctx.fillStyle = 'rgba(89, 216, 255, 0.48)';
      ctx.fillRect(p.x + p.w - 58, p.y + p.h - 24, 42, 12);
    }

    // Navigation link. The cursor aims at its centre before the page swaps.
    const link = forum.link;
    ctx.fillStyle = 'rgba(7, 17, 23, 0.94)';
    ctx.fillRect(link.x, link.y, link.w, link.h);
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(link.x + 0.5, link.y + 0.5, link.w - 1, link.h - 1);
    ctx.fillStyle = '#dff7ff';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'center';
    ctx.fillText(link.label, link.x + link.w * 0.5, link.y + 28);
    ctx.fillStyle = 'rgba(89, 216, 255, 0.72)';
    ctx.fillText('CLICK', link.x + link.w * 0.5, link.y + 50);

    // Big pointer. It idles over the page, then drops its click on the link.
    const cx = state.browserCursorX ?? page.x + page.w * 0.5;
    const cy = state.browserCursorY ?? page.y + page.h * 0.34;
    const click = state.browserClickT ?? 0;
    const phase = state.browserPhase ?? 0;
    ctx.save();
    ctx.translate(cx, cy);
    if (click > 0) ctx.scale(1, 0.88);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(8, 48);
    ctx.lineTo(20, 34);
    ctx.lineTo(35, 50);
    ctx.lineTo(44, 41);
    ctx.lineTo(29, 26);
    ctx.lineTo(48, 22);
    ctx.closePath();
    ctx.fillStyle = '#f3fbff';
    ctx.fill();
    ctx.strokeStyle = '#071015';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Telegraph the click around the pointer; the page swaps after the slam.
    if (phase === 2 || phase === 3 || click > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = arena.accent;
      ctx.globalAlpha = 0.45 + (click > 0 ? 0.4 : 0);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 54 + (click > 0 ? (1 - click / BROWSER.slam) * 52 : 0), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = arena.accent;
      ctx.beginPath();
      ctx.arc(cx, cy, 102, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Scrollbar lane on the right edge.
    const sb = b.scrollbar;
    ctx.fillStyle = '#060b0e';
    ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
    ctx.strokeStyle = 'rgba(89, 216, 255, 0.24)';
    ctx.strokeRect(sb.x + 0.5, sb.y + 0.5, sb.w - 1, sb.h - 1);
    ctx.fillStyle = 'rgba(89, 216, 255, 0.62)';
    ctx.fillRect(sb.x + 5, sb.y + 52, sb.w - 10, Math.min(190, sb.h * 0.28));

    ctx.globalAlpha = 0.72;
    ctx.fillStyle = arena.accent;
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.fillText(`BROWSER // ${forum.title}`, page.x + 4, page.y + page.h - 8);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(200, 236, 246, 0.55)';
    ctx.fillText(`${b.pages.length} PAGES // CLICK TO NAVIGATE`, page.x + page.w - 4, page.y + page.h - 8);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Round posts and lit kickers. Flash timers come from the local world. */
  private drawBumpers(arena: ArenaDef, t: number, flashes?: ArrayLike<number>): void {
    const bumpers = arena.bumpers;
    if (!bumpers) return;
    const ctx = this.ctx;
    for (let i = 0; i < bumpers.length; i++) {
      const b = bumpers[i];
      const live = b.kind === 1;
      const flash = flashes?.[i] ?? 0;
      const pulse = 0.72 + Math.sin(t * 3.4 + i) * 0.12;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = live ? 'rgba(183, 155, 255, 0.14)' : 'rgba(120, 160, 190, 0.12)';
      ctx.beginPath();
      ctx.arc(0, 0, b.radius + 13 + (live ? Math.sin(t * 3 + i) * 3 : 0), 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = live ? '#201b38' : '#141c26';
      ctx.strokeStyle = live ? arena.accent : 'rgba(150, 190, 220, 0.7)';
      ctx.lineWidth = live ? 4 : 3;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = live ? pulse : 0.4;
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius * 0.56, 0, TWO_PI);
      ctx.stroke();
      // Four bolts around the hub make the furniture read as a bumper, not a hole.
      ctx.globalAlpha = live ? 0.9 : 0.45;
      ctx.fillStyle = live ? arena.accent : '#c7e6ff';
      for (let k = 0; k < 4; k++) {
        const a = Math.PI * 0.25 + (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * b.radius * 0.62, Math.sin(a) * b.radius * 0.62, live ? 4 : 2.5, 0, TWO_PI);
        ctx.fill();
      }
      ctx.globalAlpha = live ? 0.95 : 0.65;
      ctx.beginPath();
      ctx.arc(0, 0, live ? 9 : 6, 0, TWO_PI);
      ctx.fill();
      if (flash > 0) {
        ctx.globalAlpha = Math.min(1, flash * 7);
        ctx.strokeStyle = '#f5edff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius + 7, 0, TWO_PI);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * NETWORK SWITCH feed pipes. The mouth faces the floor; the body runs back through the
   * wall. Health is read as ticks along the housing, so a destroyed pipe can never be
   * mistaken for a live feed.
   */
  private drawPipes(pipes: readonly Pipe[], arena: ArenaDef, t: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < pipes.length; i++) {
      const pipe = pipes[i];
      const live = pipe.active;
      ctx.save();
      ctx.translate(pipe.x, pipe.y);
      ctx.rotate(pipe.angle);
      ctx.globalAlpha = live ? 1 : 0.42;
      // Housing and elbow.
      ctx.fillStyle = live ? '#132a30' : '#101820';
      ctx.strokeStyle = live ? arena.accent : 'rgba(130, 160, 170, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-64, -15, 64, 30, 9);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = live ? 0.55 : 0.2;
      ctx.strokeStyle = live ? arena.accent : '#7d929a';
      ctx.lineWidth = 1;
      for (let k = -50; k < -6; k += 11) {
        ctx.beginPath();
        ctx.moveTo(k, -12);
        ctx.lineTo(k + 6, 12);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Mouth. A live pipe has a hot inner ring and a breathing intake halo.
      ctx.beginPath();
      ctx.arc(0, 0, pipe.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#071016';
      ctx.fill();
      ctx.strokeStyle = live ? arena.accent : '#566b73';
      ctx.lineWidth = 4;
      ctx.stroke();
      if (live) {
        const pulse = 0.62 + 0.28 * Math.sin(t * 5 + i);
        ctx.globalAlpha = 0.2 * pulse;
        ctx.strokeStyle = arena.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, pipe.radius + 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = arena.accent;
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
        // Health ticks on the housing.
        for (let h = 0; h < pipe.maxHp; h++) {
          ctx.globalAlpha = h < pipe.hp ? 0.95 : 0.2;
          ctx.fillStyle = h < pipe.hp ? arena.accent : '#77909a';
          ctx.fillRect(-55 + h * 8, 16, 5, 3);
        }
      } else {
        ctx.strokeStyle = '#ff5a4c';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(-9, -9);
        ctx.lineTo(9, 9);
        ctx.moveTo(9, -9);
        ctx.lineTo(-9, 9);
        ctx.stroke();
      }
      if (pipe.hitFlash > 0) {
        ctx.globalAlpha = Math.min(1, pipe.hitFlash * 4);
        ctx.strokeStyle = '#fff4d4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, pipe.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (pipe.catchFlash > 0) {
        ctx.globalAlpha = Math.min(1, pipe.catchFlash * 2);
        ctx.strokeStyle = '#d7fff0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, pipe.radius - 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** The west-end firewall starter: a plate, a hot lamp and a rearm ring. */
  private drawFirewallSwitch(state: RenderState, t: number): void {
    const s = state.arena.firewallSwitch;
    if (!s) return;
    const cooldown = Math.max(0, state.firewallSwitchT ?? 0);
    const ready = cooldown <= 0;
    const dwell = Math.max(0, Math.min(1, (state.firewallSwitchDwell ?? 0) / NETWORK.switchDwell));
    const flash = Math.max(0, state.firewallSwitchFlash ?? 0);
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(s.x, s.y);
    // Recessed plate.
    ctx.fillStyle = 'rgba(6, 18, 22, 0.9)';
    ctx.strokeStyle = ready ? '#ff6a4d' : 'rgba(160, 185, 190, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Hazard chevrons point along the sweep lane.
    ctx.globalAlpha = ready ? 0.7 + 0.2 * Math.sin(t * 6) : 0.2;
    ctx.strokeStyle = ready ? '#ff6a4d' : '#81969c';
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 12 - 5, -9);
      ctx.lineTo(k * 12, -2);
      ctx.lineTo(k * 12 + 5, -9);
      ctx.stroke();
    }
    // Lamp.
    ctx.globalAlpha = 1;
    ctx.fillStyle = ready ? '#ff6a4d' : '#314047';
    ctx.beginPath();
    ctx.arc(0, 8, 6, 0, Math.PI * 2);
    ctx.fill();
    if (ready) {
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 5);
      ctx.beginPath();
      ctx.arc(0, 8, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cooldown ring. A lit arc returns as the switch rearms.
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(8, 14, 18, 0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, s.radius - 7, 0, Math.PI * 2);
    ctx.stroke();
    if (cooldown > 0) {
      const pct = 1 - Math.min(1, cooldown / NETWORK.switchCooldown);
      ctx.strokeStyle = '#ff6a4d';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius - 7, -Math.PI * 0.5, -Math.PI * 0.5 + pct * Math.PI * 2);
      ctx.stroke();
    }
    if (dwell > 0) {
      ctx.strokeStyle = '#ffe8b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius - 13, -Math.PI * 0.5, -Math.PI * 0.5 + dwell * Math.PI * 2);
      ctx.stroke();
    }
    if (flash > 0) {
      ctx.globalAlpha = Math.min(1, flash * 2);
      ctx.strokeStyle = '#ff6a4d';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Damage cracks, drawn straight onto destructible plates and boxes. Stage 1 is a couple
   * of hairline splits, 2 adds branches, 3 is a shattered lattice. Deterministic from the
   * seed, so a box keeps the same crack pattern while it is alive.
   */
  private drawCracks(x: number, y: number, w: number, h: number, stage: number, color: string, seed: number): void {
    if (stage <= 0) return;
    const ctx = this.ctx;
    let s = (seed * 1664525 + 1013904223) | 0;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'square';
    const lines = stage === 1 ? 2 : stage === 2 ? 4 : 7;
    for (let i = 0; i < lines; i++) {
      s = (s * 1664525 + 1013904223) | 0;
      const ax = x + (((s >>> 8) & 1023) / 1023) * w;
      s = (s * 1664525 + 1013904223) | 0;
      const ay = y + (((s >>> 8) & 1023) / 1023) * h;
      s = (s * 1664525 + 1013904223) | 0;
      const bx = ax + (((s >>> 8) & 63) / 63 - 0.5) * (w * 0.8);
      s = (s * 1664525 + 1013904223) | 0;
      const by = ay + (((s >>> 8) & 63) / 63 - 0.5) * (h * 0.8);
      ctx.globalAlpha = stage === 1 ? 0.55 : stage === 2 ? 0.72 : 0.9;
      ctx.lineWidth = stage === 1 ? 1 : 1.4;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      if (stage >= 2) {
        // One short branch off the middle of each split.
        ctx.beginPath();
        ctx.moveTo((ax + bx) * 0.5, (ay + by) * 0.5);
        ctx.lineTo((ax + bx) * 0.5 + (by - ay) * 0.28, (ay + by) * 0.5 - (bx - ax) * 0.28);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * The compactor. A housing band along the top edge, then a thick plate that descends as
   * a moving wall. The plate narrows with the arena's trapezoid, so it always fills the
   * bin's cross-section and reads as solid boundry rather than a sweep line.
   */
  private drawPusher(state: RenderState): void {
    const cfg = state.arena.pushers;
    if (!cfg) return;
    const ctx = this.ctx;
    const b = state.arena.bounds;
    const accent = state.arena.accent;
    const warn = state.pusherWarnT ?? 0;
    const flash = state.pusherFlashT ?? 0;
    const front = state.pusherY ?? b.top;
    const band = cfg.band;
    const w = b.right - b.left;
    const slant = state.arena.slant ?? 0;
    const k = Math.max(0, Math.min(1, (front - b.top) / (b.bottom - b.top)));
    const inset = slant * (1 - k);
    const topInset = slant;
    ctx.save();

    // Housing along the top edge: the machine the plate comes out of. It is inset to the
    // trapezoid, so it never floats over the void beside the plate.
    ctx.fillStyle = 'rgba(12, 17, 23, 0.97)';
    ctx.fillRect(b.left + topInset, b.top, w - topInset * 2, band);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left + topInset + 1, b.top + 1, w - topInset * 2 - 2, band - 2);
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = accent;
    ctx.beginPath();
    for (let x = b.left + topInset; x < b.right - topInset; x += 64) {
      ctx.moveTo(x, b.top + band);
      ctx.lineTo(x + 32, b.top);
      ctx.lineTo(x + 50, b.top);
      ctx.lineTo(x + 18, b.top + band);
    }
    ctx.fill();

    const h = front - b.top;
    if (h > 1) {
      // Plate body, clipped to the bin's trapezoid at this depth.
      ctx.beginPath();
      ctx.moveTo(b.left + topInset, b.top);
      ctx.lineTo(b.right - topInset, b.top);
      ctx.lineTo(b.right - inset, front);
      ctx.lineTo(b.left + inset, front);
      ctx.closePath();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0a1016';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 194, 77, 0.03)';
      ctx.fillRect(b.left, b.top, w, h);
      // Diagonal hatching: machine steel, not empty screen.
      ctx.strokeStyle = 'rgba(140, 190, 210, 0.07)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let x = b.left - h; x < b.right + h; x += 34) {
        ctx.moveTo(x, front);
        ctx.lineTo(x + h, b.top);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120, 170, 190, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = b.left + 48; x < b.right; x += 96) {
        ctx.moveTo(x, b.top + band);
        ctx.lineTo(x, front);
      }
      ctx.stroke();
      // A hazard strip rides just behind the leading edge.
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(b.left, front - 26, w, 26);
      ctx.globalAlpha = 1;
      ctx.restore();

      // Leading edge: a hard bright lip, plus the plate's own thickness shadow.
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.left + inset, front);
      ctx.lineTo(b.right - inset, front);
      ctx.stroke();
      ctx.globalAlpha = 0.26;
      ctx.lineWidth = 18;
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#000';
      ctx.fillRect(b.left + inset, front, b.right - b.left - inset * 2, 5);
      ctx.globalAlpha = 1;
    }

    if (warn > 0) {
      const p = Math.min(1, 1 - warn / Math.max(0.01, cfg.warn));
      ctx.globalAlpha = 0.22 + 0.62 * Math.abs(Math.sin(warn * 9));
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3 + 7 * p;
      ctx.beginPath();
      ctx.moveTo(b.left, b.top + band);
      ctx.lineTo(b.right, b.top + band);
      ctx.stroke();
    }
    if (flash > 0) {
      ctx.globalAlpha = Math.min(1, flash / 0.3) * 0.45;
      ctx.fillStyle = accent;
      ctx.fillRect(b.left, front - 7, w, 14);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * SATELLITE: a dark orbital hull with solar wings on catwalks. The floor is a union
   * of authored plates, not the camera box; the solar heat, mast, showers and reentry
   * line are all derived from the same local clock the host simulation uses.
   */
  private drawSatelliteArena(state: RenderState | undefined, groundA: number, frameA: number): void {
    const sat = state?.arena.satellite;
    if (!state || !sat) return;
    const ctx = this.ctx;
    const b = state.arena.bounds;
    const t = state.satelliteT ?? 0;
    const reel = state.satelliteState ?? 0;
    const heatY = state.satelliteHeatY ?? b.bottom;

    ctx.save();
    ctx.globalAlpha = frameA;
    ctx.fillStyle = '#02040a';
    ctx.fillRect(b.left - 250, b.top - 250, b.right - b.left + 500, b.bottom - b.top + 500);
    // Sparse stars, fixed by index so the camera moves over them instead of twinkling.
    for (let i = 0; i < 72; i++) {
      const x = b.left - 180 + ((i * 137) % (b.right - b.left + 360));
      const y = b.top - 180 + ((i * 83) % (b.bottom - b.top + 360));
      ctx.fillStyle = i % 5 === 0 ? 'rgba(255, 216, 160, 0.72)' : 'rgba(178, 216, 255, 0.34)';
      ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = frameA * 0.22;
    ctx.fillStyle = '#1f6cff';
    ctx.beginPath();
    ctx.arc((b.left + b.right) * 0.5, b.bottom + 640, 620, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < sat.floor.length; i++) {
      const r = sat.floor[i];
      const hull = i === 0;
      ctx.save();
      ctx.globalAlpha = groundA;
      ctx.fillStyle = hull ? '#101922' : '#0a1620';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = hull ? 'rgba(255, 179, 71, 0.035)' : 'rgba(72, 183, 255, 0.035)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = hull ? 'rgba(255, 179, 71, 0.32)' : 'rgba(72, 183, 255, 0.28)';
      ctx.lineWidth = hull ? 2 : 1.5;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      // Plate joints and bolts.
      ctx.globalAlpha = groundA * 0.22;
      ctx.strokeStyle = '#b8d9e8';
      ctx.lineWidth = 1;
      if (hull) {
        for (let y = r.y + 80; y < r.y + r.h; y += 120) {
          ctx.beginPath();
          ctx.moveTo(r.x + 16, y + 0.5);
          ctx.lineTo(r.x + r.w - 16, y + 0.5);
          ctx.stroke();
        }
        for (let x = r.x + 80; x < r.x + r.w; x += 90) {
          ctx.beginPath();
          ctx.moveTo(x + 0.5, r.y + 12);
          ctx.lineTo(x + 0.5, r.y + r.h - 12);
          ctx.stroke();
        }
      } else if (!hull && r.w < 100) {
        for (let x = r.x + 12; x < r.x + r.w - 8; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x + 0.5, r.y + 6);
          ctx.lineTo(x + 0.5, r.y + r.h - 6);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Solar wings: blue cells when safe, amber warning stripes, white-hot when live.
    for (let i = 0; i < sat.panels.length; i++) {
      const panel = sat.panels[i];
      const solarState = satelliteSolarStateAt(sat, panel, t);
      const hot = solarState === SATELLITE_SOLAR_STATE.hot;
      const warn = solarState === SATELLITE_SOLAR_STATE.warn;
      const phase = satelliteSolarPhaseAt(sat, panel, t);
      const pulse = 0.5 + 0.5 * Math.sin(t * (hot ? 13 : warn ? 9 : 3) + i);
      ctx.save();
      ctx.globalAlpha = groundA;
      ctx.fillStyle = hot ? 'rgba(255, 89, 42, 0.34)' : warn ? 'rgba(255, 190, 55, 0.18)' : 'rgba(28, 91, 146, 0.44)';
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
      ctx.strokeStyle = hot ? '#ff6d35' : warn ? '#ffd25b' : '#48b7ff';
      ctx.lineWidth = hot ? 4 : 2;
      ctx.strokeRect(panel.x + 1, panel.y + 1, panel.w - 2, panel.h - 2);
      ctx.globalAlpha = groundA * (hot ? 0.36 : 0.24);
      ctx.lineWidth = 1;
      for (let x = panel.x + 16; x < panel.x + panel.w - 12; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, panel.y + 12);
        ctx.lineTo(x + 0.5, panel.y + panel.h - 12);
        ctx.stroke();
      }
      for (let y = panel.y + 18; y < panel.y + panel.h - 12; y += 34) {
        ctx.beginPath();
        ctx.moveTo(panel.x + 12, y + 0.5);
        ctx.lineTo(panel.x + panel.w - 12, y + 0.5);
        ctx.stroke();
      }
      if (warn) {
        ctx.globalAlpha = groundA * (0.26 + 0.34 * pulse);
        ctx.strokeStyle = '#ffd25b';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.strokeRect(panel.x + 5, panel.y + 5, panel.w - 10, panel.h - 10);
        ctx.setLineDash([]);
      }
      if (hot) {
        ctx.globalAlpha = groundA * (0.16 + 0.2 * pulse);
        ctx.fillStyle = '#ff6d35';
        ctx.fillRect(panel.x + 6, panel.y + 6, panel.w - 12, panel.h - 12);
        ctx.globalAlpha = groundA * (0.5 + 0.3 * pulse);
        ctx.strokeStyle = '#fff0b0';
        ctx.lineWidth = 2;
        ctx.strokeRect(panel.x + 9, panel.y + 9, panel.w - 18, panel.h - 18);
      }
      ctx.globalAlpha = groundA * 0.82;
      ctx.fillStyle = hot ? '#ffd3a1' : warn ? '#ffe6a6' : '#a9e5ff';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(panel.label, panel.x + panel.w * 0.5, panel.y + panel.h - 19);
      if (warn) ctx.fillText(`HEAT IN ${Math.max(0, sat.solar.warn - phase).toFixed(1)}`, panel.x + panel.w * 0.5, panel.y + 19);
      if (hot) ctx.fillText('SOLAR FLARE', panel.x + panel.w * 0.5, panel.y + 19);
      ctx.restore();
    }

    // Bottom telescope mast. It is cover, not a weapon.
    const ext = satelliteTelescopeExtensionAt(sat.telescope, t);
    if (ext > 0.01) {
      const tel = sat.telescope;
      const mastH = ext * tel.extension;
      const mastY = tel.baseY - mastH;
      ctx.save();
      ctx.globalAlpha = groundA;
      ctx.fillStyle = '#1a2732';
      ctx.fillRect(tel.x, mastY, tel.w, mastH);
      ctx.fillStyle = 'rgba(255, 179, 71, 0.12)';
      ctx.fillRect(tel.x + 8, mastY + 8, tel.w - 16, mastH - 16);
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2;
      ctx.strokeRect(tel.x + 1, mastY + 1, tel.w - 2, mastH - 2);
      ctx.globalAlpha = groundA * 0.34;
      for (let y = mastY + 24; y < tel.baseY - 14; y += 28) {
        ctx.strokeStyle = '#d8efff';
        ctx.beginPath();
        ctx.moveTo(tel.x + 10, y + 0.5);
        ctx.lineTo(tel.x + tel.w - 10, y + 0.5);
        ctx.stroke();
      }
      ctx.globalAlpha = groundA;
      ctx.fillStyle = '#0b1219';
      ctx.beginPath();
      ctx.ellipse(tel.x + tel.w * 0.5, mastY, tel.w * 0.52, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd08a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#5cd7ff';
      ctx.beginPath();
      ctx.ellipse(tel.x + tel.w * 0.5, mastY, tel.w * 0.3, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Mast base and service hatch.
    ctx.save();
    ctx.globalAlpha = frameA;
    ctx.fillStyle = '#18242f';
    ctx.fillRect(sat.telescope.x - 20, sat.telescope.baseY - 18, sat.telescope.w + 40, 18);
    ctx.strokeStyle = 'rgba(255, 179, 71, 0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sat.telescope.x - 20, sat.telescope.baseY - 18, sat.telescope.w + 40, 18);
    ctx.restore();

    // Top capacitor sockets and live canisters.
    const capDefs = state.arena.props ?? [];
    for (let i = 0; i < capDefs.length; i++) {
      const def = capDefs[i];
      if (!def.capacitor) continue;
      let live: Prop | null = null;
      if (state.props) for (let k = 0; k < state.props.length; k++) {
        const p = state.props[k];
        if (p.active && p.x === def.x && p.y === def.y) { live = p; break; }
      }
      ctx.save();
      ctx.globalAlpha = groundA;
      if (!live) {
        ctx.strokeStyle = 'rgba(255, 90, 70, 0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(def.x + 1, def.y + 1, def.w - 2, def.h - 2);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = live.hitFlash > 0 ? '#fff3d0' : '#24140c';
        roundRect(ctx, live.x, live.y, live.w, live.h, 7);
        ctx.fill();
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 2.4;
        roundRect(ctx, live.x + 1, live.y + 1, live.w - 2, live.h - 2, 6);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 179, 71, 0.2)';
        ctx.fillRect(live.x + 8, live.y + 9, live.w - 16, 8);
        ctx.fillRect(live.x + 8, live.y + 23, live.w - 16, 2);
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = k < live.hp ? '#ffcf72' : 'rgba(255, 207, 114, 0.16)';
          ctx.fillRect(live.x + 11 + k * 12, live.y + live.h - 15, 7, 5);
        }
        ctx.fillStyle = '#ff7d42';
        ctx.fillRect(live.x + live.w * 0.5 - 3, live.y + live.h - 30, 6, 9);
      }
      ctx.restore();
    }

    // Meteor warnings, falling rocks and impact rings.
    const meteors = state.satelliteMeteors ?? [];
    for (let i = 0; i < meteors.length; i++) {
      const m = meteors[i];
      if (!m.active) continue;
      if (m.t < sat.meteors.warn) {
        const k = Math.min(1, m.t / Math.max(0.001, sat.meteors.warn));
        ctx.save();
        ctx.globalAlpha = groundA * (0.25 + 0.65 * k);
        ctx.strokeStyle = '#ffcf72';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.arc(m.x, m.y, sat.meteors.radius * (0.7 + k * 0.3), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#b9a58a';
        ctx.beginPath();
        ctx.moveTo(m.x - 9, m.y - 180 - (1 - k) * 180);
        ctx.lineTo(m.x + 10, m.y - 205 - (1 - k) * 180);
        ctx.lineTo(m.x + 7, m.y - 174 - (1 - k) * 180);
        ctx.lineTo(m.x - 5, m.y - 164 - (1 - k) * 180);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 176, 88, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(m.x - 18, m.y - 160 - (1 - k) * 180);
        ctx.lineTo(m.x - 22, m.y - 250 - (1 - k) * 180);
        ctx.stroke();
        ctx.restore();
      } else {
        const k = Math.min(1, (m.t - sat.meteors.warn) / Math.max(0.001, sat.meteors.impact));
        ctx.save();
        ctx.globalAlpha = groundA * (1 - k);
        ctx.fillStyle = '#ff8b3d';
        ctx.beginPath();
        ctx.arc(m.x, m.y, sat.meteors.radius * (0.5 + k * 0.8), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff0b0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(m.x, m.y, sat.meteors.radius * (0.6 + k), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#c8b7a0';
        for (let d = 0; d < 5; d++) {
          const a = d * 1.256 + i;
          ctx.fillRect(m.x + Math.cos(a) * (18 + k * 38), m.y + Math.sin(a) * (12 + k * 30), 5, 4);
        }
        ctx.restore();
      }
    }

    // Thruster ignition and bottom-up reentry wash.
    if (reel >= 1) {
      const flame = 0.5 + 0.5 * Math.sin(t * 30);
      ctx.save();
      ctx.globalAlpha = frameA * (0.45 + 0.35 * flame);
      ctx.fillStyle = '#ff5d2e';
      for (let i = 0; i < 3; i++) {
        const fx = sat.telescope.x - 20 + i * 78;
        ctx.beginPath();
        ctx.moveTo(fx, sat.telescope.baseY - 18);
        ctx.lineTo(fx + 24, sat.telescope.baseY - 18);
        ctx.lineTo(fx + 12, sat.telescope.baseY + 150 + flame * 90);
        ctx.closePath();
        ctx.fill();
      }
      if (reel === 1) {
        ctx.globalAlpha = frameA * 0.8;
        ctx.fillStyle = '#ffcf72';
        ctx.font = '700 16px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`THRUSTERS ARMED // ${Math.max(0, state.satelliteThrusterT ?? 0).toFixed(1)}`, b.left + (b.right - b.left) * 0.5, b.bottom - 72);
      }
      if (reel >= 2) {
        const top = Math.max(b.top, heatY);
        ctx.globalAlpha = frameA * 0.3;
        ctx.fillStyle = '#ff3d22';
        ctx.fillRect(b.left - 200, top, b.right - b.left + 400, b.bottom - top + 220);
        ctx.globalAlpha = frameA * 0.8;
        ctx.strokeStyle = '#ffe7a0';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(b.left - 200, heatY);
        ctx.lineTo(b.right + 200, heatY);
        ctx.stroke();
        ctx.globalAlpha = frameA * 0.75;
        ctx.fillStyle = '#ffd08a';
        ctx.font = '700 15px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ATMOSPHERIC ENTRY // HEAT FRONT', b.left + (b.right - b.left) * 0.5, b.top + 28);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = frameA * 0.55;
    ctx.strokeStyle = state.arena.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([24, 14]);
    ctx.strokeRect(b.left + 12, b.top + 12, b.right - b.left - 24, b.bottom - b.top - 24);
    ctx.setLineDash([]);
    ctx.globalAlpha = frameA * 0.7;
    ctx.fillStyle = state.arena.accent;
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ORBITAL PLATFORM // SOLAR ARRAY', b.left + 26, b.top + 31);
    ctx.restore();
  }

  /**
   * SWIPE RIGHT: a phone screen as a floor. The deck is presentation only; the world
   * has already carried every body when a swipe beat lands. The match popup is drawn
   * as a raised slab, and its footprint is the same rect the host makes solid.
   */
  private drawSwipeArena(
    arena: ArenaDef,
    groundA: number,
    frameA: number,
    t: number,
    swipeT: number,
    popupT: number,
  ): void {
    const swipe = arena.swipe;
    if (!swipe) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const cx = (b.left + b.right) * 0.5;

    // The dark desk around the phone; the arena is the glass, not the whole desk.
    ctx.save();
    ctx.globalAlpha = frameA;
    ctx.fillStyle = '#03050a';
    ctx.fillRect(b.left - 240, b.top - 240, b.right - b.left + 480, b.bottom - b.top + 480);
    ctx.fillStyle = arena.accentFaint;
    ctx.fillRect(b.left - 240, b.top - 240, b.right - b.left + 480, b.bottom - b.top + 480);
    ctx.restore();

    // Glass, bezel and the faint scroll grid under the app card.
    ctx.save();
    ctx.globalAlpha = groundA;
    roundRect(ctx, b.left, b.top, b.right - b.left, b.bottom - b.top, 38);
    ctx.fillStyle = this.floorGradient ?? '#080b12';
    ctx.fill();
    ctx.fillStyle = arena.accentFaint;
    ctx.fill();
    ctx.globalAlpha = groundA * 0.34;
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1;
    for (let y = b.top + 84; y < b.bottom; y += 44) {
      ctx.beginPath();
      ctx.moveTo(b.left + 30, y + 0.5);
      ctx.lineTo(b.right - 30, y + 0.5);
      ctx.stroke();
    }
    ctx.restore();

    // A narrow header and the two edge controls make the screen read as an app.
    ctx.save();
    ctx.globalAlpha = frameA;
    ctx.fillStyle = '#070b12';
    ctx.fillRect(b.left + 22, b.top + 20, b.right - b.left - 44, 66);
    ctx.strokeStyle = arena.accentSoft;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(b.left + 22.5, b.top + 20.5, b.right - b.left - 45, 65);
    ctx.fillStyle = arena.accent;
    ctx.font = '700 22px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DEFLECT // MATCH', cx, b.top + 45);
    ctx.fillStyle = 'rgba(247, 233, 242, 0.5)';
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.fillText('SWIPE TO SHIFT THE FLOOR', cx, b.top + 65);
    ctx.restore();

    const n = swipe.profiles.length;
    const beat = swipeIndexAt(swipe, swipeT);
    const phase = swipePhaseAt(swipe, swipeT);
    const moving = beat > 0 && phase < swipe.travel;
    const dir = swipeDirectionAt(swipe, swipeT);
    const move = swipeMoveProgressAt(swipe, swipeT);
    const ease = move * move * (3 - 2 * move);
    const profileIndex = n > 0 ? (((moving ? beat - 1 : beat) % n) + n) % n : 0;
    const nextIndex = n > 0 ? (((moving ? beat : beat + 1) % n) + n) % n : 0;
    const profile = swipe.profiles[profileIndex];
    const next = swipe.profiles[nextIndex];

    const cardW = Math.min(640, b.right - b.left - 190);
    const cardH = Math.min(780, b.bottom - b.top - 410);
    const cardY = b.top + 238;
    const cardX = cx - cardW * 0.5 + (moving ? dir * 360 * ease : 0);
    const cardRot = moving ? dir * 0.1 * ease : 0;

    const drawCard = (x: number, y: number, rot: number, p: typeof profile, alpha: number): void => {
      if (!p) return;
      ctx.save();
      ctx.globalAlpha = alpha * groundA;
      ctx.translate(x + cardW * 0.5, y + cardH * 0.5);
      ctx.rotate(rot);
      ctx.translate(-cardW * 0.5, -cardH * 0.5);
      roundRect(ctx, 0, 0, cardW, cardH, 18);
      ctx.fillStyle = '#0b111b';
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = alpha * 0.72 * groundA;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Portrait field. The emoji is the person; no asset pipeline and no bitmap.
      ctx.globalAlpha = alpha * groundA;
      ctx.fillStyle = `${p.color}18`;
      ctx.fillRect(18, 18, cardW - 36, cardH - 178);
      ctx.strokeStyle = `${p.color}55`;
      ctx.lineWidth = 1;
      ctx.strokeRect(18.5, 18.5, cardW - 37, cardH - 179);
      ctx.font = '700 236px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff7fb';
      ctx.fillText(p.emoji, cardW * 0.5, cardH * 0.42);
      ctx.fillStyle = p.color;
      ctx.fillRect(38, cardH - 158, 42, 3);
      ctx.fillStyle = '#fff7fb';
      ctx.font = '800 35px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, 38, cardH - 115);
      ctx.fillStyle = 'rgba(247, 233, 242, 0.56)';
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText(p.detail, 38, cardH - 82);
      ctx.fillStyle = 'rgba(247, 233, 242, 0.28)';
      ctx.textAlign = 'right';
      ctx.fillText('SWIPE', cardW - 38, cardH - 82);
      ctx.restore();
    };

    // The next card peeks underneath, so a swiped card has somewhere to reveal.
    const behind = moving ? 0.3 : 0.2;
    drawCard(cx - cardW * 0.5 - dir * 42 * (moving ? 1 - ease : 0), cardY + 24, dir * 0.02, next, behind);
    drawCard(cardX, cardY, cardRot, profile, 1);

    if (moving) {
      ctx.save();
      ctx.globalAlpha = groundA * (0.35 + 0.65 * ease);
      ctx.translate(cx, cardY + cardH * 0.5);
      ctx.rotate(-dir * 0.16);
      ctx.strokeStyle = dir > 0 ? '#8dffb0' : '#ff5a73';
      ctx.lineWidth = 5;
      ctx.strokeRect(-108, -38, 216, 76);
      ctx.fillStyle = dir > 0 ? '#8dffb0' : '#ff5a73';
      ctx.font = '800 28px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dir > 0 ? 'LIKE' : 'NOPE', 0, 2);
      ctx.restore();
    }

    // The floor is moving with the card: bright arrows on the edge it is heading for.
    if (moving && ease > 0.05) {
      ctx.save();
      ctx.globalAlpha = groundA * (0.22 + ease * 0.7);
      ctx.fillStyle = dir > 0 ? '#8dffb0' : '#ff5a73';
      const edgeX = dir > 0 ? b.right - 28 : b.left + 28;
      for (let k = 0; k < 4; k++) {
        const y = b.top + 380 + k * 150 + ((t * 80) % 40);
        ctx.beginPath();
        ctx.moveTo(edgeX - dir * 10, y - 14);
        ctx.lineTo(edgeX + dir * 13, y);
        ctx.lineTo(edgeX - dir * 10, y + 14);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Match popup. The warning outline is drawn even while the slab is down; the slab
    // itself grows from the floor rect that is already solid in the host simulation.
    const pop = swipe.popup;
    const warn = swipePopupWarnAt(swipe, popupT);
    if (warn > 0) {
      ctx.save();
      ctx.globalAlpha = groundA * (0.25 + 0.5 * warn);
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([14, 10]);
      ctx.strokeRect(pop.x + 0.5, pop.y + 0.5, pop.w - 1, pop.h - 1);
      ctx.setLineDash([]);
      ctx.fillStyle = arena.accent;
      ctx.font = '800 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MATCH INCOMING', pop.x + pop.w * 0.5, pop.y - 16);
      ctx.restore();
    }
    const popH = swipePopupHeightAt(swipe, popupT);
    if (popH > 0.01) {
      const lift = 14 * (1 - popH);
      ctx.save();
      ctx.globalAlpha = groundA;
      // Side faces make the rect read as a raised slab, not a floor decal.
      ctx.fillStyle = '#240914';
      ctx.fillRect(pop.x, pop.y + pop.h - lift, pop.w, lift + 18);
      ctx.fillStyle = '#160810';
      ctx.fillRect(pop.x + 12, pop.y + pop.h - lift - 16, pop.w - 24, 24);
      ctx.fillStyle = '#0b0710';
      roundRect(ctx, pop.x, pop.y - lift, pop.w, pop.h + lift, 16);
      ctx.fill();
      ctx.fillStyle = `${arena.accent}26`;
      roundRect(ctx, pop.x + 4, pop.y - lift + 4, pop.w - 8, pop.h + lift - 8, 13);
      ctx.fill();
      ctx.strokeStyle = arena.accent;
      ctx.globalAlpha = groundA * (0.7 + 0.3 * popH);
      ctx.lineWidth = 2.5;
      roundRect(ctx, pop.x + 1, pop.y - lift + 1, pop.w - 2, pop.h + lift - 2, 15);
      ctx.stroke();
      ctx.globalAlpha = groundA;
      ctx.fillStyle = '#fff7fb';
      ctx.font = '800 46px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💞', pop.x + pop.w * 0.5, pop.y + pop.h * 0.3 - lift);
      ctx.fillStyle = arena.accent;
      ctx.font = '800 34px ui-monospace, monospace';
      ctx.fillText("IT'S A MATCH", pop.x + pop.w * 0.5, pop.y + pop.h * 0.56 - lift);
      ctx.fillStyle = 'rgba(247, 233, 242, 0.56)';
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.fillText('THIS ONE HAS A FLOOR PLAN', pop.x + pop.w * 0.5, pop.y + pop.h * 0.7 - lift);
      ctx.restore();
    }

    // Phone bezel and edge rails, drawn after the screen furniture so it masks the floor
    // at the lip. The open floor still ends here, so the rails are visual only.
    ctx.save();
    ctx.globalAlpha = frameA;
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 10;
    roundRect(ctx, b.left, b.top, b.right - b.left, b.bottom - b.top, 38);
    ctx.stroke();
    ctx.strokeStyle = '#dffbff';
    ctx.globalAlpha = frameA * 0.5;
    ctx.lineWidth = 1.5;
    roundRect(ctx, b.left + 8, b.top + 8, b.right - b.left - 16, b.bottom - b.top - 16, 30);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * The USB hub: a round board with four thumb drives that pull out along the cardinals.
   * The hub and the drives are the only floor; the dark ring between them is the drop.
   * Flow arrows show the current that runs while a drive is moving.
   */
  private drawUsbArena(arena: ArenaDef, groundA: number, frameA: number, usbT: number): void {
    const usb = arena.usb;
    if (!usb) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const cx = usbCenterX(arena);
    const cy = usbCenterY(arena);
    const phase = usbPhaseAt(usb, usbT);
    const travel = usbExtensionAt(usb, usbT);
    const pulse = 0.5 + 0.5 * Math.sin(usbT * 8.5);
    const driven = phase === USB_STATE.extend || phase === USB_STATE.retract;
    const flowDir = usbFlowDirAt(usb, usbT);

    // The empty board around the hardware. Fill the whole camera box so the outer lip
    // reads as a drop instead of the edge of a rectangular plate.
    ctx.save();
    ctx.globalAlpha = frameA;
    ctx.fillStyle = '#02060b';
    ctx.fillRect(b.left - 180, b.top - 180, b.right - b.left + 360, b.bottom - b.top + 360);
    ctx.fillStyle = arena.accentFaint;
    ctx.fillRect(b.left - 180, b.top - 180, b.right - b.left + 360, b.bottom - b.top + 360);
    ctx.restore();

    // Hub face.
    ctx.save();
    ctx.globalAlpha = groundA;
    ctx.fillStyle = this.floorGradient ?? '#050b12';
    ctx.beginPath();
    ctx.arc(cx, cy, usb.hubRadius, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = arena.accentFaint;
    ctx.beginPath();
    ctx.arc(cx, cy, usb.hubRadius, 0, TWO_PI);
    ctx.fill();
    if (this.floorPattern) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, usb.hubRadius, 0, TWO_PI);
      ctx.clip();
      ctx.globalAlpha = groundA * 0.55;
      ctx.fillStyle = this.floorPattern;
      ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
      ctx.restore();
    }
    // Concentric port tracks and a central controller square.
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.16 * groundA;
    ctx.lineWidth = 1.5;
    for (let r = 86; r < usb.hubRadius - 24; r += 62) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.65 * frameA;
    ctx.fillStyle = '#07141d';
    ctx.fillRect(cx - 74, cy - 74, 148, 148);
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - 74, cy - 74, 148, 148);
    ctx.globalAlpha = 0.24 * frameA;
    ctx.lineWidth = 5;
    ctx.strokeRect(cx - 65, cy - 65, 130, 130);
    ctx.globalAlpha = 0.85 * frameA;
    ctx.fillStyle = arena.accent;
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
    ctx.fillRect(cx - 30, cy - 2, 18, 4);
    ctx.fillRect(cx + 12, cy - 2, 18, 4);
    ctx.restore();

    // Static sockets on the hub rim: the drives leave four empty ports when out.
    ctx.save();
    ctx.globalAlpha = 0.7 * frameA;
    for (let i = 0; i < usb.drives.length; i++) {
      const drive = usb.drives[i];
      const ux = Math.cos(drive.angle);
      const uy = Math.sin(drive.angle);
      const nx = -uy;
      const ny = ux;
      const px = cx + ux * (usb.hubRadius - 20);
      const py = cy + uy * (usb.hubRadius - 20);
      const half = drive.width * 0.34;
      ctx.fillStyle = '#030a10';
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + nx * half, py + ny * half);
      ctx.lineTo(px + ux * 18 + nx * half, py + uy * 18 + ny * half);
      ctx.lineTo(px + ux * 18 - nx * half, py + uy * 18 - ny * half);
      ctx.lineTo(px - nx * half, py - ny * half);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Drives.
    const r = { x: 0, y: 0, w: 0, h: 0 };
    for (let i = 0; i < usb.drives.length; i++) {
      const drive = usb.drives[i];
      usbDriveRect(arena, i, usbT, r);
      const horizontal = Math.abs(Math.cos(drive.angle)) >= Math.abs(Math.sin(drive.angle));
      const ux = Math.cos(drive.angle);
      const uy = Math.sin(drive.angle);
      const innerX = horizontal ? (ux > 0 ? r.x : r.x + r.w) : r.x + r.w * 0.5;
      const innerY = horizontal ? r.y + r.h * 0.5 : (uy > 0 ? r.y : r.y + r.h);
      const outerX = horizontal ? (ux > 0 ? r.x + r.w : r.x) : r.x + r.w * 0.5;
      const outerY = horizontal ? r.y + r.h * 0.5 : (uy > 0 ? r.y + r.h : r.y);
      ctx.save();
      ctx.globalAlpha = groundA;
      ctx.fillStyle = '#0b202b';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(103, 232, 255, 0.08)' : 'rgba(103, 232, 255, 0.035)';
      ctx.fillRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
      // The connector end sits at the hub; the body has a thin metal shell and a cap.
      const connectorW = 38;
      ctx.fillStyle = '#071016';
      if (horizontal) {
        ctx.fillRect(ux > 0 ? r.x : r.x + r.w - connectorW, r.y + r.h * 0.3, connectorW, r.h * 0.4);
        ctx.strokeStyle = arena.accentSoft;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(ux > 0 ? r.x : r.x + r.w - connectorW, r.y + r.h * 0.3, connectorW, r.h * 0.4);
      } else {
        ctx.fillRect(r.x + r.w * 0.3, uy > 0 ? r.y : r.y + r.h - connectorW, r.w * 0.4, connectorW);
        ctx.strokeStyle = arena.accentSoft;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(r.x + r.w * 0.3, uy > 0 ? r.y : r.y + r.h - connectorW, r.w * 0.4, connectorW);
      }
      // Edge light and an LED / capacity pips, so each drive reads as hardware.
      ctx.globalAlpha = (0.62 + pulse * 0.2) * frameA;
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      ctx.globalAlpha = 0.45 * frameA;
      ctx.strokeStyle = '#dffbff';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
      ctx.globalAlpha = driven ? 0.65 + pulse * 0.3 : 0.35;
      ctx.fillStyle = arena.accent;
      const ledX = outerX + (horizontal ? -ux * 26 : 0);
      const ledY = outerY + (horizontal ? 0 : -uy * 26);
      ctx.beginPath();
      ctx.arc(ledX, ledY, 4.5, 0, TWO_PI);
      ctx.fill();
      // Small pips along the body.
      ctx.globalAlpha = 0.28 * frameA;
      for (let k = 0; k < 4; k++) {
        const t = 0.2 + k * 0.14;
        const px = innerX + (outerX - innerX) * t;
        const py = innerY + (outerY - innerY) * t;
        ctx.fillRect(px - 3, py - 3, 6, 6);
      }
      ctx.restore();

      // Flow chevrons on the moving drive. They point with the current: out on the
      // extension, back toward the hub on the retract.
      if (flowDir !== 0) {
        const from = usb.hubRadius - usb.dockOverlap + travel;
        const to = from + drive.length;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(drive.angle);
        ctx.strokeStyle = arena.accent;
        ctx.lineWidth = 2;
        for (let k = 0; k < 5; k++) {
          const along = from + 34 + k * 74 + ((usbT * usb.flowSpeed * 0.8) % 74);
          if (along > to - 24) continue;
          const dir = flowDir;
          ctx.globalAlpha = (0.2 + 0.22 * (k / 5)) * frameA;
          ctx.beginPath();
          ctx.moveTo(along - dir * 7, -10);
          ctx.lineTo(along + dir * 7, 0);
          ctx.lineTo(along - dir * 7, 10);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Round rim. The drives sit on top of it when docked.
    ctx.save();
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.12 * frameA;
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.arc(cx, cy, usb.hubRadius, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = (0.65 + pulse * 0.18) * frameA;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, usb.hubRadius - 2, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.55 * frameA;
    ctx.strokeStyle = '#eaffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, usb.hubRadius - 7, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();
  }

  /** BUSINESS LAPTOP: a mail window with a scrolling inbox and changing preview cover. */
  private drawLaptopArena(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const lap = arena?.laptop;
    if (!arena || !lap) return;
    // The sheet and chat screens share this record and its clocks; only the chrome and the
    // cover shapes differ, so each variant gets one draw path over the same world state.
    if (lap.variant === 'sheet') {
      this.drawLaptopSheet(state, groundA, frameA, t);
      return;
    }
    if (lap.variant === 'chat') {
      this.drawLaptopChat(state, groundA, frameA, t);
      return;
    }
    const ctx = this.ctx;
    const b = arena.bounds;
    const screen = lap.screen;
    const inbox = lap.inbox;
    const preview = lap.preview;
    const clock = state?.laptopT ?? t;
    const count = Math.max(1, lap.messages.length);
    const messageIndex = ((state?.laptopMessage ?? 0) % count + count) % count;
    const message = lap.messages[messageIndex];
    const flash = state?.laptopFlashT ?? 0;
    const labels = ['ATTACHMENT', 'THREAD', 'QUOTE', 'ACTION'];
    const step = Math.max(1, lap.cardH + lap.cardGap);
    const span = step * Math.max(1, lap.cards);
    const scroll = ((clock * lap.speed) % span + span) % span;

    ctx.save();
    ctx.fillStyle = '#020608';
    ctx.fillRect(b.left - 50, b.top - 50, b.right - b.left + 100, b.bottom - b.top + 100);
    ctx.globalAlpha = groundA;

    // Lid, screen and a thin workspace bezel.
    ctx.fillStyle = '#0b1115';
    roundRect(ctx, b.left, b.top, b.right - b.left, b.bottom - b.top, 34);
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 232, 238, 0.24)';
    ctx.lineWidth = 5;
    roundRect(ctx, b.left + 3, b.top + 3, b.right - b.left - 6, b.bottom - b.top - 6, 32);
    ctx.stroke();
    ctx.fillStyle = '#071017';
    roundRect(ctx, screen.x, screen.y, screen.w, screen.h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(138, 199, 255, 0.5)';
    ctx.lineWidth = 2;
    roundRect(ctx, screen.x + 1, screen.y + 1, screen.w - 2, screen.h - 2, 11);
    ctx.stroke();

    // Top menu bar: three window dots, the mail title and a live clock.
    ctx.fillStyle = '#0d1a22';
    ctx.fillRect(screen.x + 18, screen.y + 18, screen.w - 36, 44);
    ctx.strokeStyle = 'rgba(138, 199, 255, 0.18)';
    ctx.strokeRect(screen.x + 18.5, screen.y + 18.5, screen.w - 37, 43);
    const dots = ['#ff6d5e', '#ffc457', '#74d38a'];
    for (let i = 0; i < dots.length; i++) {
      ctx.fillStyle = dots[i];
      ctx.beginPath();
      ctx.arc(screen.x + 40 + i * 18, screen.y + 40, 5, 0, TWO_PI);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(220, 240, 250, 0.88)';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('MAIL', screen.x + 104, screen.y + 40);
    ctx.fillStyle = 'rgba(138, 199, 255, 0.62)';
    ctx.fillText('INBOX', screen.x + 152, screen.y + 40);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(200, 230, 242, 0.58)';
    ctx.fillText('MON 02 NOV // 10:09', screen.x + screen.w - 32, screen.y + 40);

    // Inbox pane and its scrolling message cards.
    ctx.fillStyle = '#0a141a';
    ctx.fillRect(inbox.x, inbox.y, inbox.w, inbox.h);
    ctx.strokeStyle = 'rgba(138, 199, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(inbox.x + 0.5, inbox.y + 0.5, inbox.w - 1, inbox.h - 1);
    ctx.fillStyle = 'rgba(138, 199, 255, 0.16)';
    ctx.fillRect(inbox.x + 1, inbox.y + 1, inbox.w - 2, 54);
    ctx.fillStyle = '#dceefa';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.fillText('INBOX', inbox.x + 18, inbox.y + 25);
    ctx.fillStyle = 'rgba(255, 196, 120, 0.9)';
    ctx.fillText('12 UNREAD', inbox.x + 18, inbox.y + 41);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(180, 215, 230, 0.48)';
    ctx.fillText('TODAY', inbox.x + inbox.w - 18, inbox.y + 32);

    ctx.save();
    ctx.beginPath();
    ctx.rect(inbox.x + 1, inbox.y + 56, inbox.w - 2, inbox.h - 57);
    ctx.clip();
    for (let i = 0; i < lap.cards; i++) {
      const y = laptopCardY(lap, i, clock);
      if (y + lap.cardH < inbox.y + 56 || y > inbox.y + inbox.h) continue;
      const card = lap.messages[(i + messageIndex) % count];
      const x = inbox.x + 10;
      const w = inbox.w - 20;
      ctx.fillStyle = i === 0 ? '#1c3441' : '#142530';
      roundRect(ctx, x, y, w, lap.cardH, 8);
      ctx.fill();
      ctx.strokeStyle = i === 0 ? 'rgba(138, 199, 255, 0.8)' : 'rgba(160, 205, 220, 0.22)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, x + 0.5, y + 0.5, w - 1, lap.cardH - 1, 8);
      ctx.stroke();
      ctx.fillStyle = i === 0 ? 'rgba(255, 196, 120, 0.9)' : 'rgba(138, 199, 255, 0.56)';
      ctx.beginPath();
      ctx.arc(x + 18, y + 20, 4, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#e4f4ff';
      ctx.font = FONT_SMALL;
      ctx.textAlign = 'left';
      ctx.fillText(card?.sender ?? 'SYSTEM', x + 30, y + 24);
      ctx.fillStyle = 'rgba(196, 224, 236, 0.54)';
      ctx.textAlign = 'right';
      ctx.fillText(i === 0 ? 'NOW' : `${10 - i}:0${8 - i}`, x + w - 14, y + 24);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#d8ecf7';
      ctx.fillText(card?.subject ?? 'Untitled message', x + 14, y + 50);
      ctx.fillStyle = 'rgba(178, 211, 224, 0.54)';
      ctx.fillText((card?.preview ?? '').slice(0, 42), x + 14, y + 72);
      ctx.fillStyle = 'rgba(138, 199, 255, 0.3)';
      ctx.fillRect(x + 14, y + 86, w - 28, 1);
      ctx.fillStyle = 'rgba(138, 199, 255, 0.6)';
      ctx.font = FONT_TINY;
      ctx.fillText(i === 0 ? 'UNREAD // OPEN' : 'MESSAGE', x + 14, y + 97);
    }
    ctx.restore();

    // Scrollbar thumb moves with the same clock as the cards.
    const trackX = inbox.x + inbox.w - 9;
    const trackY = inbox.y + 64;
    const trackH = inbox.h - 76;
    ctx.fillStyle = 'rgba(138, 199, 255, 0.08)';
    ctx.fillRect(trackX, trackY, 4, trackH);
    ctx.fillStyle = 'rgba(138, 199, 255, 0.5)';
    ctx.fillRect(trackX, trackY + ((scroll / span) * (trackH - 70)), 4, 70);

    // Preview pane. Its message content is the dynamic cover.
    ctx.fillStyle = '#0b151c';
    ctx.fillRect(preview.x, preview.y, preview.w, preview.h);
    ctx.strokeStyle = 'rgba(255, 196, 120, 0.3)';
    ctx.strokeRect(preview.x + 0.5, preview.y + 0.5, preview.w - 1, preview.h - 1);
    ctx.fillStyle = '#dceefa';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.fillText('MESSAGE PREVIEW', preview.x + 20, preview.y + 26);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 196, 120, 0.75)';
    ctx.fillText(`${messageIndex + 1} / ${count} // AUTO-OPEN`, preview.x + preview.w - 20, preview.y + 26);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(188, 220, 232, 0.46)';
    ctx.fillText(`FROM ${message?.sender ?? 'SYSTEM'}`, preview.x + 20, preview.y + 52);
    ctx.fillStyle = '#eef8ff';
    ctx.font = FONT_MID;
    ctx.fillText(message?.subject ?? 'No message', preview.x + 20, preview.y + 76);
    ctx.fillStyle = 'rgba(188, 220, 232, 0.4)';
    ctx.font = FONT_TINY;
    ctx.fillText(message?.preview ?? '', preview.x + 20, preview.y + 98);

    const layout = message?.layout ?? [];
    for (let i = 0; i < layout.length; i++) {
      const r = layout[i];
      ctx.fillStyle = 'rgba(2, 7, 10, 0.56)';
      roundRect(ctx, r.x + 5, r.y + 5, r.w, r.h, 7);
      ctx.fill();
      ctx.fillStyle = i % 2 === 0 ? '#182a32' : '#15242c';
      roundRect(ctx, r.x, r.y, r.w, r.h, 7);
      ctx.fill();
      ctx.strokeStyle = i === 0 ? 'rgba(255, 196, 120, 0.64)' : 'rgba(138, 199, 255, 0.34)';
      ctx.lineWidth = 2;
      roundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 7);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 196, 120, 0.78)';
      ctx.font = FONT_TINY;
      ctx.textAlign = 'left';
      ctx.fillText(labels[i % labels.length], r.x + 14, r.y + 20);
      ctx.fillStyle = 'rgba(205, 232, 242, 0.5)';
      for (let line = 0; line < Math.min(5, Math.floor((r.h - 34) / 18)); line++) {
        ctx.fillRect(r.x + 14, r.y + 36 + line * 18, Math.max(20, r.w - 28 - (line % 3) * 34), 2);
      }
      ctx.fillStyle = 'rgba(138, 199, 255, 0.42)';
      ctx.fillRect(r.x + 14, r.y + r.h - 18, Math.min(110, r.w - 28), 6);
    }

    if (flash > 0) {
      ctx.globalAlpha = Math.min(1, flash / 0.45) * groundA;
      ctx.fillStyle = 'rgba(255, 196, 120, 0.14)';
      ctx.fillRect(preview.x + 1, preview.y + 1, preview.w - 2, 48);
      ctx.fillStyle = '#ffd08a';
      ctx.font = FONT_SMALL;
      ctx.textAlign = 'left';
      ctx.fillText(`NEW MESSAGE // ${message?.sender ?? 'INBOX'}`, preview.x + 20, preview.y + 16);
      ctx.globalAlpha = groundA;
    }

    // Cycle progress, page count and bottom deck label.
    const progress = Math.max(0, Math.min(1, (clock % Math.max(0.5, lap.messageEvery)) / Math.max(0.5, lap.messageEvery)));
    ctx.fillStyle = 'rgba(138, 199, 255, 0.14)';
    ctx.fillRect(preview.x + 20, preview.y + preview.h - 18, preview.w - 40, 4);
    ctx.fillStyle = 'rgba(255, 196, 120, 0.8)';
    ctx.fillRect(preview.x + 20, preview.y + preview.h - 18, (preview.w - 40) * progress, 4);
    ctx.fillStyle = 'rgba(196, 224, 236, 0.46)';
    ctx.font = FONT_TINY;
    ctx.textAlign = 'left';
    ctx.fillText('BUSINESS LAPTOP // MAIL', b.left + 22, b.bottom - 16);
    ctx.textAlign = 'right';
    ctx.fillText('INBOX SCROLLS // PREVIEW REWRITES', b.right - 22, b.bottom - 16);

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(138, 199, 255, 0.72)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, b.left, b.top, b.right - b.left, b.bottom - b.top, 34);
    ctx.stroke();
    ctx.restore();
  }

  /** SPREADSHEET: a cell grid whose blocks are breakable cover. */
  private drawLaptopSheet(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const lap = arena?.laptop;
    const sheet = lap?.sheet;
    if (!arena || !lap || !sheet) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const screen = lap.screen;
    const inspector = lap.preview;
    const clock = state?.laptopT ?? t;
    const hp = state?.laptopCellHp;
    const cols = Math.max(1, sheet.cols);
    const cursor = state?.laptopCursor ?? Math.floor(clock / Math.max(0.15, sheet.cursorEvery)) % cols;
    const stepX = sheet.cellW + sheet.gap;
    const stepY = sheet.cellH + sheet.gap;
    const labels = ['TOTAL', 'MARGIN', 'RUNWAY', 'DELTA'];

    ctx.save();
    ctx.fillStyle = '#020608';
    ctx.fillRect(b.left - 50, b.top - 50, b.right - b.left + 100, b.bottom - b.top + 100);
    ctx.globalAlpha = groundA;

    ctx.fillStyle = '#0b1115';
    roundRect(ctx, b.left, b.top, b.right - b.left, b.bottom - b.top, 34);
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 232, 238, 0.24)';
    ctx.lineWidth = 5;
    roundRect(ctx, b.left + 3, b.top + 3, b.right - b.left - 6, b.bottom - b.top - 6, 32);
    ctx.stroke();
    ctx.fillStyle = '#07130d';
    roundRect(ctx, screen.x, screen.y, screen.w, screen.h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(127, 227, 166, 0.5)';
    ctx.lineWidth = 2;
    roundRect(ctx, screen.x + 1, screen.y + 1, screen.w - 2, screen.h - 2, 11);
    ctx.stroke();

    // Window bar: a sheet tab strip and the document clock.
    ctx.fillStyle = '#0d1f16';
    ctx.fillRect(screen.x + 18, screen.y + 18, screen.w - 36, 44);
    ctx.strokeStyle = 'rgba(127, 227, 166, 0.18)';
    ctx.strokeRect(screen.x + 18.5, screen.y + 18.5, screen.w - 37, 43);
    const dots = ['#ff6d5e', '#ffc457', '#74d38a'];
    for (let i = 0; i < dots.length; i++) {
      ctx.fillStyle = dots[i];
      ctx.beginPath();
      ctx.arc(screen.x + 40 + i * 18, screen.y + 40, 5, 0, TWO_PI);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(220, 245, 232, 0.88)';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SHEETS', screen.x + 104, screen.y + 40);
    ctx.fillStyle = 'rgba(127, 227, 166, 0.62)';
    ctx.fillText('Q4 MODEL', screen.x + 164, screen.y + 40);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(200, 240, 220, 0.58)';
    ctx.fillText('17 COLUMNS // 06 NOV', screen.x + screen.w - 32, screen.y + 40);

    // Formula bar and name box for the selection cursor.
    const barY = sheet.origin.y - 62;
    ctx.fillStyle = '#0b1712';
    ctx.fillRect(screen.x + 18, barY, screen.w - 36, 34);
    ctx.strokeStyle = 'rgba(127, 227, 166, 0.22)';
    ctx.strokeRect(screen.x + 18.5, barY + 0.5, screen.w - 37, 33);
    ctx.fillStyle = '#0c1a13';
    ctx.fillRect(screen.x + 26, barY + 4, 92, 26);
    ctx.fillStyle = '#bff3d5';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.fillText((sheet.columns[cursor] ?? 'A') + '1', screen.x + 40, barY + 17);
    ctx.fillStyle = 'rgba(190, 235, 214, 0.6)';
    ctx.font = FONT_TINY;
    ctx.fillText(
      'fx  =SUM(' + (sheet.columns[0] ?? 'A') + '1:' + (sheet.columns[cols - 1] ?? 'F') + sheet.rows + ')',
      screen.x + 138,
      barY + 17,
    );

    // Column headers and row numbers share the cell grid metrics.
    ctx.font = FONT_TINY;
    ctx.textAlign = 'center';
    for (let c = 0; c < cols; c++) {
      const x = sheet.origin.x + c * stepX;
      ctx.fillStyle = c === cursor ? 'rgba(127, 227, 166, 0.32)' : 'rgba(127, 227, 166, 0.12)';
      ctx.fillRect(x, sheet.origin.y - 30, sheet.cellW, 26);
      ctx.fillStyle = c === cursor ? '#e6fff2' : 'rgba(190, 235, 214, 0.72)';
      ctx.fillText(sheet.columns[c] ?? String(c + 1), x + sheet.cellW * 0.5, sheet.origin.y - 17);
    }
    for (let r = 0; r < sheet.rows; r++) {
      const y = sheet.origin.y + r * stepY;
      ctx.fillStyle = 'rgba(127, 227, 166, 0.12)';
      ctx.fillRect(sheet.origin.x - 34, y, 28, sheet.cellH);
      ctx.fillStyle = 'rgba(190, 235, 214, 0.6)';
      ctx.fillText(String(r + 1), sheet.origin.x - 20, y + sheet.cellH * 0.5);
    }

    // Cell blocks. A cleared cell leaves its lane open for the rest of the round.
    for (let i = 0; i < sheet.cells.length; i++) {
      const cell = sheet.cells[i];
      const r = laptopCellRect(sheet, cell, laptopCellDraw);
      const remaining = hp ? hp[i] : cell.hp;
      if (remaining <= 0) {
        ctx.strokeStyle = 'rgba(127, 227, 166, 0.18)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([7, 9]);
        ctx.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
        ctx.setLineDash([]);
        continue;
      }
      const cracked = remaining < cell.hp;
      ctx.fillStyle = cracked ? '#263620' : '#16281a';
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.fill();
      ctx.strokeStyle = cell.col === cursor ? 'rgba(127, 227, 166, 0.9)' : 'rgba(127, 227, 166, 0.34)';
      ctx.lineWidth = cell.col === cursor ? 2.5 : 1.5;
      roundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(127, 227, 166, 0.66)';
      ctx.font = FONT_TINY;
      ctx.textAlign = 'left';
      ctx.fillText((sheet.columns[cell.col] ?? 'A') + (cell.row + 1), r.x + 12, r.y + 18);
      ctx.fillStyle = cracked ? 'rgba(255, 170, 120, 0.9)' : 'rgba(232, 255, 242, 0.92)';
      ctx.font = FONT_MID;
      ctx.textAlign = 'center';
      ctx.fillText(String(120 + ((i * 97) % 870)), r.x + r.w * 0.5, r.y + r.h * 0.56);
      ctx.fillStyle = 'rgba(190, 235, 214, 0.42)';
      ctx.font = FONT_TINY;
      ctx.textAlign = 'left';
      ctx.fillText(labels[i % labels.length], r.x + 12, r.y + r.h - 14);
      if (cracked) {
        ctx.strokeStyle = 'rgba(255, 170, 120, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(r.x + r.w * 0.28, r.y + 20);
        ctx.lineTo(r.x + r.w * 0.42, r.y + r.h * 0.5);
        ctx.lineTo(r.x + r.w * 0.3, r.y + r.h - 18);
        ctx.stroke();
      }
    }

    // Inspector dock: the selected cell's reference and its cover state.
    ctx.fillStyle = '#0b1712';
    ctx.fillRect(inspector.x, inspector.y, inspector.w, inspector.h);
    ctx.strokeStyle = 'rgba(127, 227, 166, 0.26)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(inspector.x + 0.5, inspector.y + 0.5, inspector.w - 1, inspector.h - 1);
    ctx.fillStyle = '#dff8ea';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.fillText('CELL', inspector.x + 16, inspector.y + 26);
    ctx.fillStyle = 'rgba(127, 227, 166, 0.8)';
    ctx.fillText((sheet.columns[cursor] ?? 'A') + '1', inspector.x + 16, inspector.y + 52);
    ctx.fillStyle = 'rgba(190, 235, 214, 0.46)';
    ctx.font = FONT_TINY;
    ctx.fillText('TYPE  COVER', inspector.x + 16, inspector.y + 76);
    ctx.fillText('HITS  2', inspector.x + 16, inspector.y + 94);
    ctx.fillText('LANE  ' + (cursor % 2 === 0 ? 'OPEN' : 'HELD'), inspector.x + 16, inspector.y + 112);

    ctx.fillStyle = 'rgba(196, 232, 214, 0.46)';
    ctx.font = FONT_TINY;
    ctx.textAlign = 'left';
    ctx.fillText('SPREADSHEET // CELLS', b.left + 22, b.bottom - 16);
    ctx.textAlign = 'right';
    ctx.fillText('SHOTS CLEAR CELLS', b.right - 22, b.bottom - 16);

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(127, 227, 166, 0.72)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, b.left, b.top, b.right - b.left, b.bottom - b.top, 34);
    ctx.stroke();
    ctx.restore();
  }

  /** CHAT: bubbles rise and alternate sides, so the open lane zig-zags down the screen. */
  private drawLaptopChat(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const lap = arena?.laptop;
    if (!arena || !lap) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const screen = lap.screen;
    const inbox = lap.inbox;
    const composer = lap.preview;
    const clock = state?.laptopT ?? t;
    const count = Math.max(1, lap.messages.length);
    const active = (((state?.laptopMessage ?? 0) % count) + count) % count;
    const bubbleW = Math.max(24, inbox.w * Math.max(0.3, Math.min(1, lap.bubbleW ?? 0.58)) - 20);
    const typing = 1 + (Math.floor(clock * 2.2) % 3);

    ctx.save();
    ctx.fillStyle = '#020608';
    ctx.fillRect(b.left - 50, b.top - 50, b.right - b.left + 100, b.bottom - b.top + 100);
    ctx.globalAlpha = groundA;

    ctx.fillStyle = '#0b1115';
    roundRect(ctx, b.left, b.top, b.right - b.left, b.bottom - b.top, 34);
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 232, 238, 0.24)';
    ctx.lineWidth = 5;
    roundRect(ctx, b.left + 3, b.top + 3, b.right - b.left - 6, b.bottom - b.top - 6, 32);
    ctx.stroke();
    ctx.fillStyle = '#150d13';
    roundRect(ctx, screen.x, screen.y, screen.w, screen.h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 154, 213, 0.5)';
    ctx.lineWidth = 2;
    roundRect(ctx, screen.x + 1, screen.y + 1, screen.w - 2, screen.h - 2, 11);
    ctx.stroke();

    // Window bar: channel name and a live member count.
    ctx.fillStyle = '#1d1220';
    ctx.fillRect(screen.x + 18, screen.y + 18, screen.w - 36, 44);
    ctx.strokeStyle = 'rgba(255, 154, 213, 0.2)';
    ctx.strokeRect(screen.x + 18.5, screen.y + 18.5, screen.w - 37, 43);
    ctx.fillStyle = 'rgba(255, 226, 243, 0.9)';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHAT', screen.x + 30, screen.y + 40);
    ctx.fillStyle = 'rgba(255, 154, 213, 0.66)';
    ctx.fillText('# GENERAL', screen.x + 92, screen.y + 40);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 214, 236, 0.55)';
    ctx.fillText('8 ONLINE // 2 TYPING', screen.x + screen.w - 32, screen.y + 40);

    // The bubble pane. Bubbles are the moving cover and their lane alternates per card.
    ctx.fillStyle = '#120b10';
    ctx.fillRect(inbox.x, inbox.y, inbox.w, inbox.h);
    ctx.strokeStyle = 'rgba(255, 154, 213, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(inbox.x + 0.5, inbox.y + 0.5, inbox.w - 1, inbox.h - 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(inbox.x + 1, inbox.y + 1, inbox.w - 2, inbox.h - 2);
    ctx.clip();
    for (let i = 0; i < lap.cards; i++) {
      const y = laptopCardY(lap, i, clock);
      if (y + lap.cardH < inbox.y || y > inbox.y + inbox.h) continue;
      const right = i % 2 === 0;
      const x = right ? inbox.x + inbox.w - 10 - bubbleW : inbox.x + 10;
      const line = lap.messages[(i + active) % count];
      ctx.fillStyle = right ? 'rgba(255, 154, 213, 0.09)' : 'rgba(120, 170, 255, 0.09)';
      roundRect(ctx, x + 4, y + 4, bubbleW, lap.cardH, 14);
      ctx.fill();
      ctx.fillStyle = right ? '#241722' : '#141d2a';
      roundRect(ctx, x, y, bubbleW, lap.cardH, 14);
      ctx.fill();
      ctx.strokeStyle = right ? 'rgba(255, 154, 213, 0.55)' : 'rgba(130, 175, 255, 0.5)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, x + 0.5, y + 0.5, bubbleW - 1, lap.cardH - 1, 14);
      ctx.stroke();
      ctx.fillStyle = right ? '#ffc3e6' : '#bcd4ff';
      ctx.font = FONT_TINY;
      ctx.textAlign = 'left';
      ctx.fillText(line?.sender ?? 'SYSTEM', x + 16, y + 20);
      ctx.fillStyle = 'rgba(255, 226, 243, 0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(right ? 'NOW' : '2m', x + bubbleW - 16, y + 20);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 240, 250, 0.88)';
      ctx.font = FONT_SMALL;
      ctx.fillText(line?.subject ?? 'message', x + 16, y + 48);
      ctx.fillStyle = 'rgba(230, 214, 228, 0.6)';
      ctx.fillText((line?.preview ?? '').slice(0, 54), x + 16, y + 74);
      ctx.fillStyle = 'rgba(255, 154, 213, 0.32)';
      ctx.font = FONT_TINY;
      ctx.fillText(right ? 'READ' : 'DELIVERED', x + 16, y + lap.cardH - 14);
    }
    ctx.restore();

    // Composer strip: the pinned line, a typing indicator and the send bar.
    ctx.fillStyle = '#1a1118';
    ctx.fillRect(composer.x, composer.y, composer.w, composer.h);
    ctx.strokeStyle = 'rgba(255, 154, 213, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(composer.x + 0.5, composer.y + 0.5, composer.w - 1, composer.h - 1);
    ctx.fillStyle = '#ffc3e6';
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.fillText('PINNED // ' + (lap.messages[active]?.sender ?? 'SYSTEM'), composer.x + 20, composer.y + 28);
    ctx.fillStyle = 'rgba(240, 220, 235, 0.62)';
    ctx.font = FONT_TINY;
    ctx.fillText(lap.messages[active]?.preview ?? '', composer.x + 20, composer.y + 50);
    ctx.fillStyle = 'rgba(255, 154, 213, 0.14)';
    ctx.fillRect(composer.x + 20, composer.y + 68, composer.w - 40, 28);
    ctx.fillStyle = 'rgba(255, 226, 243, 0.7)';
    ctx.fillText('MESSAGE #GENERAL', composer.x + 34, composer.y + 82);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 196, 120, 0.85)';
    ctx.fillText('.'.repeat(typing), composer.x + composer.w - 34, composer.y + 82);

    ctx.fillStyle = 'rgba(240, 214, 232, 0.46)';
    ctx.font = FONT_TINY;
    ctx.textAlign = 'left';
    ctx.fillText('CHAT // #GENERAL', b.left + 22, b.bottom - 16);
    ctx.textAlign = 'right';
    ctx.fillText('BUBBLES ALTERNATE // KEEP MOVING', b.right - 22, b.bottom - 16);

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(255, 154, 213, 0.72)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, b.left, b.top, b.right - b.left, b.bottom - b.top, 34);
    ctx.stroke();
    ctx.restore();
  }

  /** SMART WATCH: a large watch face with a sweeping second-hand hazard. */
  private drawWatchArena(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const watch = arena?.watch;
    if (!arena || !watch) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const face = watch.face;
    const cx = face.x + face.w * 0.5;
    const cy = face.y + face.h * 0.5;
    const angle = state?.watchAngle ?? watchHandAngle(watch, state?.watchT ?? 0);
    const handX = cx + Math.cos(angle) * watch.handLength;
    const handY = cy + Math.sin(angle) * watch.handLength;
    const tailX = cx - Math.cos(angle) * 66;
    const tailY = cy - Math.sin(angle) * 66;
    const dialR = Math.min(face.w, face.h) * 0.34;
    const seconds = Math.floor((state?.watchT ?? t) % 60);
    const labels = ['HEART', 'WEATHER', 'MUSIC', 'TIMER'];
    const glyphs = ['♥', '☀', '♫', '⏱'];

    ctx.save();
    ctx.fillStyle = '#030506';
    ctx.fillRect(b.left - 40, b.top - 40, b.right - b.left + 80, b.bottom - b.top + 80);
    ctx.globalAlpha = groundA;

    // Watch case, rounded screen and raised bezel.
    ctx.fillStyle = '#11161b';
    roundRect(ctx, b.left, b.top, b.right - b.left, b.bottom - b.top, 58);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 235, 232, 0.26)';
    ctx.lineWidth = 8;
    roundRect(ctx, b.left + 4, b.top + 4, b.right - b.left - 8, b.bottom - b.top - 8, 54);
    ctx.stroke();
    ctx.fillStyle = '#080d11';
    roundRect(ctx, face.x, face.y, face.w, face.h, 46);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 141, 92, 0.62)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, face.x + 1, face.y + 1, face.w - 2, face.h - 2, 45);
    ctx.stroke();

    // Inner dial, minute ticks and a minute ring.
    ctx.save();
    roundRect(ctx, face.x + 8, face.y + 8, face.w - 16, face.h - 16, 40);
    ctx.clip();
    ctx.fillStyle = '#10171c';
    ctx.fillRect(face.x, face.y, face.w, face.h);
    ctx.strokeStyle = 'rgba(255, 178, 128, 0.16)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (dialR * i) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI * 0.5;
      const outer = dialR + 20;
      const inner = outer - (i % 5 === 0 ? 14 : 5);
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(255, 190, 142, 0.8)' : 'rgba(205, 224, 220, 0.34)';
      ctx.lineWidth = i % 5 === 0 ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
    }

    // Status bar and time readout, clear of the hand pivot.
    ctx.fillStyle = 'rgba(255, 190, 142, 0.8)';
    ctx.font = FONT_TINY;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('MON 02 NOV', face.x + 34, face.y + 34);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(205, 224, 220, 0.68)';
    ctx.fillText('78%  ♥ 84', face.x + face.w - 34, face.y + 34);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff1df';
    ctx.font = '700 68px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillText(`10:09:${String(seconds).padStart(2, '0')}`, cx, face.y + 112);
    ctx.fillStyle = 'rgba(255, 190, 142, 0.58)';
    ctx.font = FONT_TINY;
    ctx.fillText('SWEEP FACE // LIVE', cx, face.y + 142);

    // Four complication cards are the static cover and the watch-app language.
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      ctx.fillStyle = '#1b272d';
      roundRect(ctx, r.x, r.y, r.w, r.h, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 178, 128, 0.38)';
      ctx.lineWidth = 2;
      roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 17);
      ctx.stroke();
      ctx.fillStyle = '#ffb18a';
      ctx.font = '700 34px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(glyphs[i] ?? '●', r.x + r.w * 0.5, r.y + 42);
      ctx.fillStyle = 'rgba(231, 242, 238, 0.68)';
      ctx.font = FONT_TINY;
      ctx.fillText(labels[i] ?? 'APP', r.x + r.w * 0.5, r.y + r.h - 22);
    }

    // The second hand is a floor projection: cover does not stop it.
    ctx.strokeStyle = 'rgba(255, 94, 58, 0.14)';
    ctx.lineWidth = 38;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 141, 92, 0.34)';
    ctx.lineWidth = 17;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.strokeStyle = '#ffd0ad';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 141, 92, 0.6)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
    ctx.fillStyle = '#ff8d5c';
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe3c8';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8d5c';
    ctx.beginPath();
    ctx.arc(handX, handY, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Digital crown and side button on the right edge; presentation only.
    ctx.fillStyle = '#252d31';
    roundRect(ctx, b.right - 8, cy - 94, 28, 188, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230, 242, 236, 0.46)';
    ctx.lineWidth = 2;
    roundRect(ctx, b.right - 7, cy - 93, 26, 186, 11);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(8, 13, 17, 0.8)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(b.right + 1, cy - 77 + i * 20);
      ctx.lineTo(b.right + 17, cy - 77 + i * 20);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 141, 92, 0.75)';
    ctx.fillRect(b.right - 8, cy - 118, 28, 10);

    ctx.globalAlpha = groundA;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(255, 190, 142, 0.58)';
    ctx.fillText('SMART WATCH // SECOND HAND', b.left + 34, b.top + 32);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(205, 224, 220, 0.4)';
    ctx.fillText('ONE HIT PER REVOLUTION', b.right - 34, b.bottom - 30);

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(255, 141, 92, 0.7)';
    ctx.lineWidth = 3;
    roundRect(ctx, b.left, b.top, b.right - b.left, b.bottom - b.top, 58);
    ctx.stroke();
    ctx.restore();
  }

  /** SMOKE DETECTOR: a round detector face, four floor sensors, a siren and a battery. */
  private drawSmokeArena(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const smoke = arena?.smoke;
    const disc = arena?.disc;
    if (!arena || !smoke || !disc) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const cx = (b.left + b.right) * 0.5;
    const cy = (b.top + b.bottom) * 0.5;
    const radius = disc.radius;
    const alarm = state?.smokeAlarm ?? false;
    const alarmT = state?.smokeAlarmT ?? 0;
    const clock = state?.smokeT ?? t;
    const pulse = 0.5 + 0.5 * Math.abs(Math.sin(clock * 9));

    let batteryActive = true;
    let batteryHp = smoke.batteryHp;
    if (state?.props) {
      for (let i = 0; i < state.props.length; i++) {
        const p = state.props[i];
        if (!p.fixed || p.kind !== PROP.BATTERY) continue;
        batteryActive = p.active;
        batteryHp = p.hp;
        break;
      }
    }
    const live = alarm && batteryActive;

    ctx.save();
    ctx.fillStyle = '#030607';
    ctx.fillRect(b.left - 40, b.top - 40, b.right - b.left + 80, b.bottom - b.top + 80);
    ctx.globalAlpha = groundA;

    // The detector face is the whole floor. Everything outside the circular rim is a drop.
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#111719';
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 232, 228, 0.28)';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 5, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#151d1f';
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    // Concentric detector ridges and the radial vents around the siren.
    ctx.strokeStyle = 'rgba(202, 230, 220, 0.08)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 8; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (radius * i) / 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(202, 230, 220, 0.16)';
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * radius * 0.79, cy + Math.sin(a) * radius * 0.79);
      ctx.lineTo(cx + Math.cos(a) * radius * 0.91, cy + Math.sin(a) * radius * 0.91);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(202, 230, 220, 0.25)';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * radius * 0.84, cy + Math.sin(a) * radius * 0.84, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Four floor sensors. A body stepping on one arms the siren.
    for (let i = 0; i < smoke.sensors.length; i++) {
      const s = smoke.sensors[i];
      const col = !batteryActive ? '#65716d' : live ? '#ff6a5e' : '#8dffb0';
      ctx.fillStyle = '#0a1214';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(210, 236, 228, 0.32)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.globalAlpha = groundA * (live ? 0.45 + pulse * 0.45 : 0.65);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius - 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = groundA;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5 + (live ? pulse * 2 : 0), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(222, 240, 232, 0.72)';
      ctx.font = FONT_TINY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`SMOKE 0${i + 1}`, s.x, s.y + s.radius + 14);
    }

    // Expanding sound rings. The wave is the hazard; the siren is presentation.
    const waves = state?.smokeWaves ?? [];
    for (let i = 0; i < waves.length; i++) {
      const wave = waves[i];
      if (!wave.active) continue;
      const alpha = Math.max(0.06, 1 - wave.radius / smoke.maxRadius);
      ctx.strokeStyle = `rgba(255, 78, 62, ${alpha * 0.8})`;
      ctx.lineWidth = smoke.waveWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, wave.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 224, 199, ${alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, wave.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // The siren horn sits at the spindle and is the visual source of every ring.
    const hubR = 74;
    ctx.fillStyle = '#090f11';
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = live ? '#ff6a5e' : '#8dffb0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210, 236, 228, 0.24)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, 24 + i * 12, -0.7, 0.7);
      ctx.stroke();
    }
    ctx.fillStyle = live ? '#ff6a5e' : batteryActive ? '#8dffb0' : '#8a7468';
    ctx.beginPath();
    ctx.arc(cx, cy, 11 + (live ? pulse * 3 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(226, 244, 236, 0.82)';
    ctx.font = FONT_TINY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(live ? 'ALARM' : 'SIREN', cx, cy + 32);

    ctx.restore();

    // The fixed battery target. It is mounted beside the siren and can be shot out.
    const bat = smoke.battery;
    ctx.globalAlpha = groundA;
    ctx.save();
    ctx.translate(bat.x, bat.y);
    if (batteryActive) {
      ctx.fillStyle = '#1b1711';
      ctx.fillRect(-5, -5, bat.w + 10, bat.h + 10);
      ctx.fillStyle = '#d7a546';
      ctx.fillRect(0, 0, bat.w, bat.h);
      ctx.fillStyle = '#f0c56a';
      ctx.fillRect(8, 8, bat.w - 16, bat.h - 16);
      ctx.fillStyle = '#2b2318';
      ctx.fillRect(14, -5, 12, 7);
      ctx.fillRect(bat.w - 26, -5, 12, 7);
      ctx.fillStyle = '#1b1711';
      ctx.fillRect(14, 18, bat.w - 28, 12);
      ctx.fillStyle = '#fff0bd';
      ctx.font = FONT_TINY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BATTERY', bat.w * 0.5, bat.h * 0.59);
      ctx.fillStyle = '#20170d';
      ctx.fillRect(10, bat.h - 13, bat.w - 20, 5);
      ctx.fillStyle = '#ffe29a';
      ctx.fillRect(10, bat.h - 13, (bat.w - 20) * Math.max(0, batteryHp / smoke.batteryHp), 5);
      ctx.strokeStyle = 'rgba(255, 230, 171, 0.75)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0.5, 0.5, bat.w - 1, bat.h - 1);
    } else {
      ctx.strokeStyle = 'rgba(255, 106, 94, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.strokeRect(0.5, 0.5, bat.w - 1, bat.h - 1);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 190, 170, 0.58)';
      ctx.font = FONT_TINY;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NO POWER', bat.w * 0.5, bat.h * 0.5);
    }
    ctx.restore();

    ctx.globalAlpha = groundA;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = FONT_SMALL;
    ctx.fillStyle = !batteryActive ? '#ffb08e' : live ? '#ff6a5e' : '#8dffb0';
    ctx.fillText(
      !batteryActive ? 'BATTERY DEAD // ALARM DISABLED' : live ? `ALARM // LIVE ${Math.ceil(alarmT)}s` : 'STANDBY // SENSORS ARMED',
      cx,
      b.top + 26,
    );
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(214, 238, 230, 0.5)';
    ctx.fillText(
      !batteryActive ? 'ROUND SAFE // BATTERY DESTROYED' : live ? 'LEAVE THE RING // SHOOT THE BATTERY' : 'STEP ON A SENSOR TO ARM',
      cx,
      b.top + 43,
    );
    ctx.fillStyle = 'rgba(255, 106, 94, 0.42)';
    ctx.fillText('SMOKE DETECTOR // ROUND FLOOR', cx, b.bottom - 18);

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(255, 106, 94, 0.72)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * A round platter instead of a rectangular plate. The floor, its concentric tracks and
   * every hole turn with the disc; the read arm pivots outside the rim and sweeps across
   * the face. Nothing here simulates: the world owns the phase and the holes it tests.
   */
  private drawDiscArena(t: number, arena: ArenaDef, groundA: number, frameA: number, discT: number): void {
    const ctx = this.ctx;
    const disc = arena.disc;
    if (!disc) return;
    const cx = discCenterX(arena);
    const cy = discCenterY(arena);
    const r = disc.radius;
    const spin = discT * disc.spin;
    const b = arena.bounds;

    if (this.dustArena !== arena.id) {
      this.dustArena = arena.id;
      for (let i = 0; i < this.dustX.length; i++) {
        const a = (i / this.dustX.length) * TWO_PI + (i % 5) * 0.37;
        const d = Math.sqrt((i * 0.618) % 1) * (r - 18);
        this.dustX[i] = cx + Math.cos(a) * d;
        this.dustY[i] = cy + Math.sin(a) * d;
      }
    }

    // The well around the plate. A wide low glow separates the disc from empty space
    // without drawing a rectangular frame the pop-up picker would contradict.
    ctx.save();
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.05 * frameA;
    ctx.lineWidth = 84;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 30, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.16 * frameA;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([10, 16]);
    ctx.globalAlpha = 0.1 * frameA;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 42, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Plate face, clipped to the round lip. The board pattern still sits underneath,
    // but the platter's own servo tracks are what make the spin readable.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.clip();
    ctx.globalAlpha = groundA;
    ctx.fillStyle = this.floorGradient ?? '#050b12';
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    ctx.fillStyle = arena.accentFaint;
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    if (this.floorPattern) {
      ctx.globalAlpha = groundA * 0.7;
      ctx.fillStyle = this.floorPattern;
      ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    }
    // Static dust, then the rotating hardware.
    ctx.globalAlpha = 0.13 * groundA;
    ctx.fillStyle = 'rgba(175, 225, 245, 0.7)';
    for (let i = 0; i < this.dustX.length; i++) ctx.fillRect(this.dustX[i], this.dustY[i], 1.5, 1.5);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    // Concentric servo tracks.
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.13 * groundA;
    ctx.lineWidth = 1.4;
    for (let rr = 96; rr < r - 24; rr += 74) {
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, TWO_PI);
      ctx.stroke();
    }
    // Sector seams, with a heavier seam every quarter turn.
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TWO_PI;
      ctx.globalAlpha = (i % 6 === 0 ? 0.2 : 0.08) * groundA;
      ctx.lineWidth = i % 6 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 76, Math.sin(a) * 76);
      ctx.lineTo(Math.cos(a) * (r - 16), Math.sin(a) * (r - 16));
      ctx.stroke();
    }
    // Three bright platter arcs, so the rotation reads even when the holes are offscreen.
    ctx.globalAlpha = 0.2 * groundA;
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TWO_PI;
      ctx.beginPath();
      ctx.arc(0, 0, r - 54, a, a + 0.42);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Scan sweep, clipped by the plate once more so the band never crosses the rim.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.clip();
    const scanY = cy - r + ((t * 22) % (r * 2));
    ctx.globalAlpha = 0.045 * groundA;
    ctx.fillStyle = arena.accent;
    ctx.fillRect(cx - r, scanY, r * 2, 14);
    ctx.restore();

    // Holes. The same polar data the world tests, so what the eye reads is the floor.
    ctx.save();
    for (let i = 0; i < disc.holes.length; i++) {
      const hx = discHoleX(arena, i, discT);
      const hy = discHoleY(arena, i, discT);
      const hr = disc.holes[i].radius;
      ctx.globalAlpha = 0.28 * frameA;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(hx, hy, hr + 5, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = frameA;
      ctx.fillStyle = '#010309';
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, TWO_PI);
      ctx.fill();
      // Cut edge: a soft outer band, a hard lit rim, and a darker inner wall.
      ctx.strokeStyle = arena.accent;
      ctx.globalAlpha = 0.24 * frameA;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(hx, hy, hr + 1, 0, TWO_PI);
      ctx.stroke();
      ctx.globalAlpha = 0.75 * frameA;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, TWO_PI);
      ctx.stroke();
      ctx.globalAlpha = 0.2 * frameA;
      ctx.strokeStyle = '#eaffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hx, hy, hr - 4, Math.PI * 1.05, Math.PI * 1.8);
      ctx.stroke();
      // A notch at the lip reinforces "hole in a spinning plate".
      ctx.globalAlpha = 0.45 * frameA;
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx - hr - 1, hy);
      ctx.lineTo(hx - hr - 8, hy);
      ctx.moveTo(hx + hr + 1, hy);
      ctx.lineTo(hx + hr + 8, hy);
      ctx.stroke();
    }
    ctx.restore();

    // Spindle hub at the middle of the plate.
    ctx.save();
    ctx.globalAlpha = frameA;
    ctx.fillStyle = '#070d14';
    ctx.beginPath();
    ctx.arc(cx, cy, 62, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.3 * frameA;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.8 * frameA;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.45 * frameA;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.9 * frameA;
    ctx.fillStyle = arena.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, TWO_PI);
    ctx.fill();
    // Four bolts, fixed to the housing rather than the spinning plate.
    ctx.globalAlpha = 0.4 * frameA;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TWO_PI + Math.PI / 4;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44, 3, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();

    // Rim. Bright on the inside, with rotating ticks so the lip itself reads as moving.
    ctx.save();
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.14 * frameA;
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.9 * frameA;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, TWO_PI);
    ctx.stroke();
    ctx.strokeStyle = '#f2fbff';
    ctx.globalAlpha = 0.85 * frameA;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, 0, TWO_PI);
    ctx.stroke();
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.34 * frameA;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 14]);
    ctx.beginPath();
    ctx.arc(cx, cy, r - 22, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.globalAlpha = 0.5 * frameA;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TWO_PI;
      const inner = r - (i % 3 === 0 ? 22 : 13);
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * (r - 7), Math.sin(a) * (r - 7));
    }
    ctx.stroke();
    ctx.restore();

    this.drawReadArm(arena, discT, frameA);
  }

  /** The HDD read arm: a fixed pivot outside the rim, a beam across the plate, a head. */
  private drawReadArm(arena: ArenaDef, discT: number, alpha: number): void {
    const disc = arena.disc;
    if (!disc) return;
    const ctx = this.ctx;
    const px = discArmPivotX(arena);
    const py = discArmPivotY(arena);
    const a = discArmAngle(arena, discT);
    const len = discArmLength(arena);
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const tipX = px + ux * len;
    const tipY = py + uy * len;
    const thick = disc.arm.thickness;
    ctx.save();
    ctx.globalAlpha = 0.9 * alpha;

    // Housing and its sweep slot.
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.1 * alpha;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(px, py, len * 0.42, a - disc.arm.sweep - 0.1, a + disc.arm.sweep + 0.1);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0a131c';
    ctx.beginPath();
    ctx.arc(px, py, thick * 0.9, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.65 * alpha;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(px, py, thick * 0.9, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.9 * alpha;
    ctx.fillStyle = arena.accent;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, TWO_PI);
    ctx.fill();

    // Arm shadow, then the beam. The shadow makes it sit above the plate, not in it.
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.34 * alpha;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = thick + 12;
    ctx.beginPath();
    ctx.moveTo(px + 5, py + 10);
    ctx.lineTo(tipX + 5, tipY + 10);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#121d27';
    ctx.lineWidth = thick;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.globalAlpha = 0.4 * alpha;
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = thick - 12;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // Top light along one edge.
    ctx.globalAlpha = 0.8 * alpha;
    ctx.strokeStyle = '#eaf7ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - uy * thick * 0.34, py + ux * thick * 0.34);
    ctx.lineTo(tipX - uy * thick * 0.34, tipY + ux * thick * 0.34);
    ctx.stroke();

    // Read head near the tip, with a bright lens. This is the part that shoves.
    const hx = px + ux * len * 0.82;
    const hy = py + uy * len * 0.82;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0a121a';
    ctx.beginPath();
    ctx.arc(hx, hy, thick * 0.66, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.8 * alpha;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(hx, hy, thick * 0.66, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.95 * alpha;
    ctx.fillStyle = '#f2fbff';
    ctx.beginPath();
    ctx.arc(hx + ux * 4, hy + uy * 4, 3.4, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  /** ROCKET NAVIGATION: launch telemetry, a growing arc, and the wall it leaves behind. */
  private drawRocketArena(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
  ): void {
    const arena = state?.arena;
    const rocket = arena?.rocket;
    if (!arena || !rocket) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const progress = Math.max(
      0,
      Math.min(1, state?.rocketProgress ?? rocketProgressAt(rocket, state?.rocketT ?? 0)),
    );
    const point = this.rocketArcScratch;

    ctx.save();
    ctx.fillStyle = '#02080c';
    ctx.fillRect(b.left - 40, b.top - 40, b.right - b.left + 80, b.bottom - b.top + 80);
    ctx.globalAlpha = groundA;
    ctx.fillStyle = '#06141a';
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

    // Navigation grid: the room reads as a radar/telemetry table, not a hangar.
    ctx.strokeStyle = 'rgba(124, 247, 204, 0.08)';
    ctx.lineWidth = 1;
    for (let x = b.left + 64; x < b.right; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, b.top);
      ctx.lineTo(x, b.bottom);
      ctx.stroke();
    }
    for (let y = b.top + 64; y < b.bottom; y += 64) {
      ctx.beginPath();
      ctx.moveTo(b.left, y);
      ctx.lineTo(b.right, y);
      ctx.stroke();
    }

    // Atmosphere edge. The launch starts below the room and leaves this band behind.
    ctx.fillStyle = 'rgba(124, 247, 204, 0.035)';
    ctx.fillRect(b.left, b.top, b.right - b.left, 118);
    ctx.strokeStyle = 'rgba(124, 247, 204, 0.24)';
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(b.left, b.top + 118);
    ctx.lineTo(b.right, b.top + 118);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(124, 247, 204, 0.58)';
    ctx.fillText('ATMOSPHERE EXIT', b.left + 24, b.top + 96);

    // Full planned trajectory, then the flown portion. Both are dotted: the line is a
    // shot reflector, not a wall, so it must not read as solid.
    ctx.strokeStyle = 'rgba(124, 247, 204, 0.22)';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 12]);
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      rocketArcAt(rocket, i / 48, point);
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    if (progress > 0) {
      const steps = Math.max(2, Math.ceil(progress * 96));
      ctx.lineCap = 'round';
      // Dots, not a band: shots bounce along the route while bodies walk straight
      // through it. A faint halo keeps the reflector readable over the floor pattern.
      ctx.setLineDash([1.5, 13]);
      ctx.strokeStyle = 'rgba(124, 247, 204, 0.16)';
      ctx.lineWidth = 15;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        rocketArcAt(rocket, (i / steps) * progress, point);
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#7cf7cc';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
    }

    // Launch pad and gantry are beneath the spawn ring, so the rocket leaves from cover
    // rather than appearing in the middle of the fight.
    const padX = rocket.launch.x;
    const padY = b.bottom - 20;
    ctx.fillStyle = '#0b2229';
    ctx.fillRect(padX - 86, padY - 10, 172, 32);
    ctx.strokeStyle = 'rgba(124, 247, 204, 0.5)';
    ctx.strokeRect(padX - 86, padY - 10, 172, 32);
    ctx.fillStyle = 'rgba(124, 247, 204, 0.16)';
    ctx.fillRect(padX - 52, padY - 34, 20, 28);
    ctx.fillRect(padX + 32, padY - 34, 20, 28);

    // Rocket at the tip of the line. The tangent is sampled, so it banks with the arc.
    const tipK = progress;
    const tailK = Math.max(0, tipK - 0.012);
    rocketArcAt(rocket, tipK, point);
    const tipX = point.x;
    const tipY = point.y;
    rocketArcAt(rocket, tailK, point);
    const heading = Math.atan2(tipY - point.y, tipX - point.x);
    if (progress > 0) {
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(heading);
      const pulse = 0.65 + Math.sin(performance.now() * 0.018) * 0.2;
      ctx.fillStyle = `rgba(255, 190, 92, ${pulse})`;
      ctx.beginPath();
      ctx.moveTo(-7, -5);
      ctx.lineTo(-38 - Math.sin(performance.now() * 0.03) * 7, 0);
      ctx.lineTo(-7, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#dffbff';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -8);
      ctx.lineTo(-15, 0);
      ctx.lineTo(-10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7cf7cc';
      ctx.fillRect(-7, -10, 7, 20);
      ctx.restore();
    }

    // Spent stages drift off the line. They are cosmetic debris, never extra bodies.
    for (let i = 0; i < rocket.stages.length; i++) {
      const stage = rocket.stages[i];
      if (progress < stage.at) continue;
      const age = Math.min(1, (progress - stage.at) * 7);
      rocketArcAt(rocket, stage.at, point);
      const side = i % 2 === 0 ? -1 : 1;
      const drift = age * 74;
      ctx.save();
      ctx.globalAlpha = 1 - age * 0.8;
      ctx.translate(point.x + side * drift, point.y + (i === 0 ? drift * 0.45 : -drift * 0.35));
      ctx.rotate(side * age * 0.8);
      ctx.fillStyle = '#b8c9cc';
      ctx.fillRect(-17, -5, 34, 10);
      ctx.fillStyle = 'rgba(255, 190, 92, 0.75)';
      ctx.fillRect(-22, -7, 5, 14);
      ctx.restore();
    }

    // Telemetry is the arena's identity: speed, altitude and the line's state.
    this.drawRocketReadout(b.left + 42, b.top + 154, 'SPEED', `${Math.round(1400 + progress * 6200)} M/S`);
    this.drawRocketReadout(b.left + 42, b.top + 238, 'ALTITUDE', `${(progress * 148).toFixed(1)} KM`);
    this.drawRocketReadout(
      b.left + 42,
      b.top + 322,
      'TRAJECTORY',
      progress >= 1 ? 'BARRIER SEALED' : `${Math.round(progress * 100)}% LOCKED`,
    );

    // Cover consoles carry the launch-control fiction without becoming new systems.
    const labels = ['LAUNCH CONTROL', 'RANGE SAFETY', 'STAGE CACHE', 'TELEMETRY'];
    for (let i = 0; i < arena.pillars.length; i++) {
      const rect = arena.pillars[i];
      ctx.fillStyle = '#081c22';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = 'rgba(124, 247, 204, 0.46)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(124, 247, 204, 0.16)';
      ctx.fillRect(rect.x + 8, rect.y + 8, rect.w - 16, 7);
      ctx.fillStyle = 'rgba(214, 255, 247, 0.62)';
      ctx.font = FONT_TINY;
      ctx.textAlign = 'center';
      ctx.fillText(labels[i] ?? 'NAV RELAY', rect.x + rect.w * 0.5, rect.y + rect.h * 0.62);
    }

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(124, 247, 204, 0.62)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    ctx.restore();
  }

  private drawRocketReadout(x: number, y: number, label: string, value: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(3, 15, 19, 0.82)';
    ctx.fillRect(x, y, 202, 62);
    ctx.strokeStyle = 'rgba(124, 247, 204, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 202, 62);
    ctx.font = FONT_TINY;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(124, 247, 204, 0.58)';
    ctx.fillText(label, x + 10, y + 19);
    ctx.font = FONT_MID;
    ctx.fillStyle = '#d9fff7';
    ctx.fillText(value, x + 10, y + 44);
  }

  /** WEAPON SYSTEMS: a fighter-jet status display with three floor-mounted control banks. */
  private drawWeaponArena(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const weapon = arena?.weapon;
    if (!arena || !weapon) return;
    const ctx = this.ctx;
    const b = arena.bounds;

    ctx.save();
    ctx.fillStyle = '#080506';
    ctx.fillRect(b.left - 40, b.top - 40, b.right - b.left + 80, b.bottom - b.top + 80);
    ctx.globalAlpha = groundA;
    ctx.fillStyle = '#160c0d';
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

    // Instrument-grid floor and a cockpit frame.
    ctx.strokeStyle = 'rgba(255, 107, 92, 0.08)';
    ctx.lineWidth = 1;
    for (let x = b.left + 48; x < b.right; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, b.top);
      ctx.lineTo(x, b.bottom);
      ctx.stroke();
    }
    for (let y = b.top + 48; y < b.bottom; y += 48) {
      ctx.beginPath();
      ctx.moveTo(b.left, y);
      ctx.lineTo(b.right, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 107, 92, 0.05)';
    ctx.fillRect(b.left, b.top, 420, b.bottom - b.top);

    // Nose-up plan view, traced from FIGHTER_TOP so the console and the picker agree.
    const jet = weapon.jet;
    ctx.lineJoin = 'round';
    for (let i = 0; i < FIGHTER_TOP.length; i++) {
      const shape = FIGHTER_TOP[i];
      ctx.beginPath();
      for (let p = 0; p < shape.points.length; p++) {
        const px = jet.x + shape.points[p][0] * jet.w;
        const py = jet.y + shape.points[p][1] * jet.h;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      if (shape.closed) ctx.closePath();
      if (shape.name === 'canopy') {
        ctx.fillStyle = 'rgba(104, 220, 244, 0.5)';
        ctx.strokeStyle = 'rgba(190, 246, 255, 0.9)';
        ctx.lineWidth = 2;
      } else if (shape.name === 'nozzle') {
        ctx.fillStyle = 'rgba(255, 168, 84, 0.62)';
        ctx.strokeStyle = 'rgba(255, 214, 150, 0.8)';
        ctx.lineWidth = 2;
      } else if (shape.name === 'fuselage') {
        ctx.fillStyle = 'rgba(32, 23, 25, 0.96)';
        ctx.strokeStyle = 'rgba(255, 193, 153, 0.88)';
        ctx.lineWidth = 3;
      } else if (shape.name === 'wing' || shape.name === 'stabilizer') {
        ctx.fillStyle = 'rgba(58, 32, 30, 0.94)';
        ctx.strokeStyle = 'rgba(255, 170, 140, 0.6)';
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = 'rgba(44, 27, 27, 0.92)';
        ctx.strokeStyle = 'rgba(255, 170, 140, 0.5)';
        ctx.lineWidth = 2;
      }
      ctx.fill();
      ctx.stroke();
    }

    // Top-down panel detail: center spine, wing-root seams, hardpoints and exhaust.
    ctx.strokeStyle = 'rgba(255, 170, 140, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(jet.x + jet.w * 0.5, jet.y + jet.h * 0.08);
    ctx.lineTo(jet.x + jet.w * 0.5, jet.y + jet.h * 0.92);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(jet.x + jet.w * 0.41, jet.y + jet.h * 0.46);
    ctx.lineTo(jet.x + jet.w * 0.59, jet.y + jet.h * 0.46);
    ctx.moveTo(jet.x + jet.w * 0.43, jet.y + jet.h * 0.7);
    ctx.lineTo(jet.x + jet.w * 0.57, jet.y + jet.h * 0.7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 214, 170, 0.62)';
    for (const hardpoint of [0.24, 0.76]) {
      ctx.beginPath();
      ctx.arc(jet.x + jet.w * hardpoint, jet.y + jet.h * 0.52, 3, 0, TWO_PI);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 150, 80, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(jet.x + jet.w * 0.45, jet.y + jet.h * 0.96);
    ctx.lineTo(jet.x + jet.w * 0.43, jet.y + jet.h * 1.04);
    ctx.moveTo(jet.x + jet.w * 0.55, jet.y + jet.h * 0.96);
    ctx.lineTo(jet.x + jet.w * 0.57, jet.y + jet.h * 1.04);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 214, 170, 0.6)';
    ctx.font = FONT_TINY;
    ctx.textAlign = 'center';
    ctx.fillText('F-19 SPECTRE // TOP PROFILE', jet.x + jet.w * 0.5, jet.y + jet.h + 20);
    ctx.textAlign = 'left';

    // Status readout.
    ctx.font = FONT_MID;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd4c7';
    ctx.fillText('WEAPON SYSTEMS // F-19 SPECTRE', b.left + 42, b.top + 54);
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(255, 175, 154, 0.68)';
    ctx.fillText('STATUS: ARMED   //   LINK: STABLE', b.left + 42, b.top + 78);
    ctx.fillStyle = 'rgba(255, 107, 92, 0.12)';
    ctx.fillRect(b.left + 42, b.top + 96, 356, 122);
    ctx.strokeStyle = 'rgba(255, 107, 92, 0.34)';
    ctx.strokeRect(b.left + 42, b.top + 96, 356, 122);
    ctx.fillStyle = '#ffb6a4';
    ctx.font = FONT_SMALL;
    ctx.fillText('SPD   MACH 1.82', b.left + 58, b.top + 124);
    ctx.fillText('ALT   12,400 FT', b.left + 58, b.top + 148);
    ctx.fillText('THR   78% NOMINAL', b.left + 58, b.top + 172);
    ctx.fillText('ARM   GUN / MISSILE', b.left + 58, b.top + 196);

    // Target reticle over the jet's nose.
    const rx = jet.x + jet.w * 0.5;
    const ry = jet.y + jet.h * 0.07;
    ctx.strokeStyle = 'rgba(255, 220, 160, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rx, ry, 22, 0, TWO_PI);
    ctx.moveTo(rx - 34, ry);
    ctx.lineTo(rx - 12, ry);
    ctx.moveTo(rx + 12, ry);
    ctx.lineTo(rx + 34, ry);
    ctx.moveTo(rx, ry - 34);
    ctx.lineTo(rx, ry - 12);
    ctx.moveTo(rx, ry + 12);
    ctx.lineTo(rx, ry + 34);
    ctx.stroke();

    // The three big cockpit banks are also cover. Draw the non-button consoles first.
    for (let i = weapon.buttons.length; i < arena.pillars.length; i++) {
      const rect = arena.pillars[i];
      ctx.fillStyle = '#1b1011';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = 'rgba(255, 150, 130, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255, 170, 150, 0.38)';
      ctx.font = FONT_TINY;
      ctx.textAlign = 'center';
      ctx.fillText(i === weapon.buttons.length ? 'FCS CORE' : 'HYDRAULIC', rect.x + rect.w * 0.5, rect.y + rect.h * 0.58);
    }

    const buttonColors = ['#ff5c4e', '#ffc857', '#63dcff'];
    for (let i = 0; i < weapon.buttons.length; i++) {
      const button = weapon.buttons[i];
      const pulse = 0.62 + Math.sin(t * (button.kind === 1 ? 5.2 : 2.6) + i) * 0.18;
      const color = buttonColors[button.kind];
      ctx.fillStyle = 'rgba(28, 10, 12, 0.9)';
      ctx.fillRect(button.x, button.y, button.w, button.h);
      ctx.fillStyle = `rgba(${button.kind === 0 ? '255, 92, 78' : button.kind === 1 ? '255, 200, 87' : '99, 220, 255'}, ${0.14 + pulse * 0.1})`;
      ctx.fillRect(button.x + 7, button.y + 7, button.w - 14, button.h - 14);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.65 + pulse * 0.35;
      ctx.lineWidth = 3;
      ctx.strokeRect(button.x, button.y, button.w, button.h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.font = FONT_MID;
      ctx.textAlign = 'center';
      ctx.fillText(button.label, button.x + button.w * 0.5, button.y + button.h * 0.46);
      ctx.font = FONT_TINY;
      ctx.fillStyle = 'rgba(255, 240, 225, 0.72)';
      ctx.fillText(button.kind === 1 ? 'PULL // SAFE' : button.kind === 2 ? 'HOLD // BURN' : 'PRESS // FIRE', button.x + button.w * 0.5, button.y + button.h * 0.72);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(button.x + 14, button.y + 14, button.w - 28, button.h - 28);
    }

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(255, 107, 92, 0.68)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    ctx.restore();
  }

  /** SPEAK & FIND: a bright talking toy with picture cards and chunky letter keys. */
  private drawSeekArena(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const seek = arena?.seek;
    if (!arena || !seek) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const prompt = seek.prompts.length > 0 ? seek.prompts[Math.floor(t / 4.2) % seek.prompts.length] : null;

    ctx.save();
    ctx.fillStyle = '#0a070b';
    ctx.fillRect(b.left - 40, b.top - 40, b.right - b.left + 80, b.bottom - b.top + 80);
    ctx.globalAlpha = groundA;
    ctx.fillStyle = '#21121d';
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

    // Moulded plastic shell with a warm printed board underneath.
    ctx.fillStyle = '#3a1a2d';
    ctx.fillRect(b.left + 22, b.top + 18, b.right - b.left - 44, b.bottom - b.top - 36);
    ctx.fillStyle = '#4c2039';
    ctx.fillRect(b.left + 34, b.top + 28, b.right - b.left - 68, b.bottom - b.top - 56);
    ctx.strokeStyle = 'rgba(255, 206, 147, 0.4)';
    ctx.lineWidth = 5;
    ctx.strokeRect(b.left + 22, b.top + 18, b.right - b.left - 44, b.bottom - b.top - 36);
    ctx.globalAlpha = groundA * 0.4;
    ctx.fillStyle = '#ffb6de';
    for (let x = b.left + 54; x < b.right - 40; x += 58) {
      for (let y = b.top + 56; y < b.bottom - 32; y += 58) {
        ctx.fillRect(x, y, 3, 3);
      }
    }
    ctx.globalAlpha = groundA;

    ctx.font = FONT_MID;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffe1a8';
    ctx.fillText('SPEAK & FIND', b.left + 50, b.top + 52);
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(255, 216, 173, 0.58)';
    ctx.fillText('TALKING PICTURE BOARD // LEVEL 1', b.left + 50, b.top + 72);

    // Speaker grille, so the toy reads as something that talks back.
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.arc(b.left + 64 + j * 15, b.top + 104 + i * 15, 4, 0, TWO_PI);
        ctx.fillStyle = 'rgba(255, 212, 164, 0.34)';
        ctx.fill();
      }
    }

    // Prompt screen: the card prompt is the loudest object on the floor.
    const display = seek.display;
    ctx.fillStyle = '#071418';
    ctx.fillRect(display.x, display.y, display.w, display.h);
    ctx.strokeStyle = '#ffb84d';
    ctx.lineWidth = 4;
    ctx.strokeRect(display.x, display.y, display.w, display.h);
    ctx.fillStyle = 'rgba(255, 184, 77, 0.16)';
    ctx.fillRect(display.x + 10, display.y + 10, display.w - 20, display.h - 20);
    ctx.font = FONT_SMALL;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff2c7';
    ctx.fillText(prompt?.text ?? 'FIND THE PICTURE', display.x + display.w * 0.5, display.y + 40);
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(255, 226, 168, 0.6)';
    ctx.fillText('LISTEN  //  LOOK  //  TOUCH', display.x + display.w * 0.5, display.y + 66);

    // Picture cards. The prompted card gets a bright rim and a pulsing halo.
    for (let i = 0; i < seek.cards.length; i++) {
      const card = seek.cards[i];
      const hot = prompt?.card === i;
      if (hot) {
        const pulse = 0.5 + Math.sin(t * 5.5) * 0.2;
        ctx.strokeStyle = `rgba(255, 246, 195, ${0.34 + pulse * 0.3})`;
        ctx.lineWidth = 10;
        ctx.strokeRect(card.x - 8, card.y - 8, card.w + 16, card.h + 16);
      }
      ctx.fillStyle = '#111a20';
      ctx.fillRect(card.x, card.y, card.w, card.h);
      ctx.strokeStyle = card.color;
      ctx.lineWidth = hot ? 5 : 3;
      ctx.strokeRect(card.x, card.y, card.w, card.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.055)';
      ctx.fillRect(card.x + 10, card.y + 10, card.w - 20, card.h - 42);
      ctx.font = '48px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(card.mark, card.x + card.w * 0.5, card.y + card.h * 0.46);
      ctx.font = FONT_TINY;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = hot ? '#fff4c9' : 'rgba(230, 247, 255, 0.68)';
      ctx.fillText(card.label, card.x + card.w * 0.5, card.y + card.h - 18);
    }

    // The searching magnifier sweeps across the cards, never a game body.
    const sweep = (Math.sin(t * 0.75) + 1) * 0.5;
    const lensX = b.left + 420 + sweep * 850;
    const lensY = b.top + 520 + Math.sin(t * 1.2) * 70;
    ctx.strokeStyle = 'rgba(255, 230, 171, 0.78)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(lensX, lensY, 34, 0, TWO_PI);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(lensX + 25, lensY + 25);
    ctx.lineTo(lensX + 60, lensY + 60);
    ctx.stroke();

    // Four letter keys are static cover and the toy's physical controls.
    const keyLabels = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < arena.pillars.length; i++) {
      const rect = arena.pillars[i];
      ctx.fillStyle = '#ffcf5a';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(rect.x + 8, rect.y + 8, rect.w - 16, rect.h - 16);
      ctx.strokeStyle = 'rgba(80, 38, 24, 0.72)';
      ctx.lineWidth = 4;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.font = FONT_MID;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#5a2d1c';
      ctx.fillText(keyLabels[i] ?? '?', rect.x + rect.w * 0.5, rect.y + rect.h * 0.58);
      ctx.font = FONT_TINY;
      ctx.fillStyle = 'rgba(90, 45, 28, 0.62)';
      ctx.fillText('PRESS', rect.x + rect.w * 0.5, rect.y + rect.h - 12);
    }

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(255, 177, 220, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    ctx.restore();
  }

  /** CAR NAVIGATION: a map screen with a capped, receding route trail. */
  private drawCarArena(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const car = arena?.car;
    if (!arena || !car) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const progress = Math.max(0, Math.min(1, state?.carProgress ?? carProgressAt(car, state?.carT ?? 0)));
    const point = this.carRouteScratch;

    ctx.save();
    ctx.fillStyle = '#02080d';
    ctx.fillRect(b.left - 40, b.top - 40, b.right - b.left + 80, b.bottom - b.top + 80);
    ctx.globalAlpha = groundA;
    ctx.fillStyle = '#06151e';
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

    // The floor is a printed map: farmland west of the river, a street grid and city
    // blocks east of it. All of it is map paper; the only real geometry is the pillar
    // list (farms, then city blocks) and the advancing route barrier.
    const mapA = Math.min(1, groundA * 1.25);
    ctx.globalAlpha = mapA;
    ctx.fillStyle = 'rgba(122, 148, 160, 0.055)';
    ctx.fillRect(car.cityX, b.top, b.right - car.cityX, b.bottom - b.top);

    // Land parcels, each with a hedgerow outline.
    const fieldTones = ['rgba(62, 104, 74, 0.26)', 'rgba(80, 118, 84, 0.2)', 'rgba(54, 92, 70, 0.17)'];
    for (let i = 0; i < car.fields.length; i++) {
      const f = car.fields[i];
      ctx.fillStyle = fieldTones[f.tone % fieldTones.length];
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.strokeStyle = 'rgba(126, 182, 136, 0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1);
    }

    // Tree cover: one fixed golden-angle blob per cluster, so a copse reads as many
    // trees without per-tree state.
    ctx.fillStyle = 'rgba(70, 124, 86, 0.3)';
    for (let c = 0; c < car.woods.length; c++) {
      const grove = car.woods[c];
      for (let i = 0; i < 14; i++) {
        const a = i * 2.399963 + grove.x * 0.013;
        const rr = grove.r * Math.sqrt((i + 0.5) / 14);
        ctx.beginPath();
        ctx.arc(grove.x + Math.cos(a) * rr, grove.y + Math.sin(a) * rr, 6 + (i % 3) * 2, 0, TWO_PI);
        ctx.fill();
      }
    }

    // Country lanes: thin secondary roads, low contrast, never cover.
    ctx.strokeStyle = 'rgba(176, 202, 176, 0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.left, b.top + 260);
    ctx.lineTo(b.left + 260, b.top + 300);
    ctx.lineTo(b.left + 500, b.top + 230);
    ctx.lineTo(b.left + 720, b.top + 280);
    ctx.lineTo(car.cityX - 40, b.top + 240);
    ctx.moveTo(b.left + 40, b.top + 800);
    ctx.lineTo(b.left + 300, b.top + 690);
    ctx.lineTo(b.left + 520, b.top + 700);
    ctx.lineTo(b.left + 700, b.top + 770);
    ctx.lineTo(car.cityX - 30, b.top + 800);
    ctx.stroke();

    // River: one meandering band with a lighter core. The water is paper, not a body or
    // shot blocker, and the route crosses it on the bridge deck.
    const river = car.river;
    if (river.length > 1) {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(38, 92, 138, 0.62)';
      ctx.lineWidth = 34;
      ctx.beginPath();
      ctx.moveTo(river[0].x, river[0].y);
      for (let i = 1; i < river.length - 1; i++) {
        ctx.quadraticCurveTo(
          river[i].x,
          river[i].y,
          (river[i].x + river[i + 1].x) * 0.5,
          (river[i].y + river[i + 1].y) * 0.5,
        );
      }
      ctx.lineTo(river[river.length - 1].x, river[river.length - 1].y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(112, 178, 220, 0.24)';
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    ctx.fillStyle = '#16323d';
    ctx.fillRect(car.bridge.x, car.bridge.y, car.bridge.w, car.bridge.h);
    ctx.strokeStyle = 'rgba(196, 232, 240, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(car.bridge.x, car.bridge.y, car.bridge.w, car.bridge.h);
    for (let x = car.bridge.x + 12; x < car.bridge.x + car.bridge.w - 6; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, car.bridge.y + 3);
      ctx.lineTo(x, car.bridge.y + car.bridge.h - 3);
      ctx.stroke();
    }

    // City: street casing, then the pale street fill, then block paper between them.
    const grid = car.gridStep;
    ctx.strokeStyle = 'rgba(160, 194, 206, 0.1)';
    ctx.lineWidth = 9;
    for (let x = car.gridX; x <= b.right; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, car.gridY);
      ctx.lineTo(x, b.bottom);
      ctx.stroke();
    }
    for (let y = car.gridY; y <= b.bottom; y += grid) {
      ctx.beginPath();
      ctx.moveTo(car.gridX, y);
      ctx.lineTo(b.right, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(214, 238, 244, 0.15)';
    ctx.lineWidth = 2;
    for (let x = car.gridX; x <= b.right; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, car.gridY);
      ctx.lineTo(x, b.bottom);
      ctx.stroke();
    }
    for (let y = car.gridY; y <= b.bottom; y += grid) {
      ctx.beginPath();
      ctx.moveTo(car.gridX, y);
      ctx.lineTo(b.right, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(180, 204, 212, 0.045)';
    for (let x = car.gridX; x + grid <= b.right; x += grid) {
      for (let y = car.gridY; y + grid <= b.bottom; y += grid) {
        ctx.fillRect(x + 8, y + 8, grid - 16, grid - 16);
      }
    }

    // Civic park: a green block with a crossed path.
    const park = car.park;
    ctx.fillStyle = 'rgba(78, 142, 96, 0.32)';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.strokeStyle = 'rgba(150, 208, 156, 0.34)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(park.x + 0.5, park.y + 0.5, park.w - 1, park.h - 1);
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(park.x + park.w * 0.5, park.y + 6);
    ctx.lineTo(park.x + park.w * 0.5, park.y + park.h - 6);
    ctx.moveTo(park.x + 8, park.y + park.h * 0.5);
    ctx.lineTo(park.x + park.w - 8, park.y + park.h * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pillars are the map's buildings and the arena's only static cover. Farm buildings
    // come first; the city blocks that follow get a roof hatch.
    for (let i = 0; i < arena.pillars.length; i++) {
      const rect = arena.pillars[i];
      const farm = i < car.farmCount;
      if (farm) {
        ctx.fillStyle = '#143522';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = 'rgba(176, 220, 178, 0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        const hx = rect.x + rect.w * 0.5;
        const hy = rect.y + rect.h * 0.5;
        if (i === 2) {
          // Silo: cap ring and a chute line.
          ctx.strokeStyle = 'rgba(214, 240, 212, 0.42)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(hx, hy, Math.min(rect.w, rect.h) * 0.34, 0, TWO_PI);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(hx, rect.y + 6);
          ctx.lineTo(hx, rect.y + rect.h - 6);
          ctx.stroke();
        } else if (i === 3) {
          // Old mill: four sails off the hub.
          ctx.strokeStyle = 'rgba(214, 240, 212, 0.42)';
          ctx.lineWidth = 2;
          for (let s = 0; s < 4; s++) {
            const a = s * (Math.PI * 0.5) + 0.35;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(hx + Math.cos(a) * rect.w * 0.42, hy + Math.sin(a) * rect.h * 0.42);
            ctx.stroke();
          }
        } else {
          // Barn / farmhouse: ridge line and a dark door.
          ctx.fillStyle = 'rgba(196, 232, 190, 0.5)';
          ctx.fillRect(rect.x + 8, rect.y + 8, rect.w - 16, 4);
          ctx.fillStyle = '#0a1f14';
          ctx.fillRect(hx - 7, rect.y + rect.h - 18, 14, 18);
        }
      } else {
        ctx.fillStyle = '#17303c';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = 'rgba(98, 217, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = 'rgba(98, 217, 255, 0.16)';
        ctx.lineWidth = 1;
        for (let h = 10; h < rect.h + rect.w; h += 12) {
          const x1 = rect.x + Math.max(0, h - rect.h);
          const y1 = rect.y + Math.min(h, rect.h);
          const x2 = rect.x + Math.min(h, rect.w);
          const y2 = rect.y + Math.max(0, h - rect.w);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
      ctx.font = FONT_TINY;
      ctx.textAlign = 'center';
      ctx.fillStyle = farm ? 'rgba(214, 240, 206, 0.62)' : 'rgba(203, 240, 250, 0.62)';
      ctx.fillText(car.labels[i] ?? '', rect.x + rect.w * 0.5, rect.y + rect.h + 12);
    }

    // Map district names, a scale bar and a north arrow. These are the small print on a
    // real map screen; keep them low contrast so they never read as gameplay.
    ctx.font = FONT_TINY;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(186, 226, 190, 0.34)';
    ctx.fillText('CLOVER FIELDS', b.left + 26, b.top + 44);
    ctx.fillText('WYRE RIVER', car.cityX - 150, b.top + 566);
    ctx.fillStyle = 'rgba(188, 226, 238, 0.34)';
    ctx.fillText('GRID DISTRICT', car.gridX + 18, b.bottom - 26);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(168, 214, 172, 0.4)';
    ctx.fillText('CIVIC PARK', park.x + park.w * 0.5, park.y + park.h * 0.5 + 3);
    ctx.strokeStyle = 'rgba(190, 228, 236, 0.45)';
    ctx.lineWidth = 1.5;
    const scaleX = b.right - 216;
    const scaleY = b.bottom - 26;
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY);
    ctx.lineTo(scaleX + 120, scaleY);
    ctx.moveTo(scaleX, scaleY - 5);
    ctx.lineTo(scaleX, scaleY + 5);
    ctx.moveTo(scaleX + 60, scaleY - 4);
    ctx.lineTo(scaleX + 60, scaleY + 4);
    ctx.moveTo(scaleX + 120, scaleY - 5);
    ctx.lineTo(scaleX + 120, scaleY + 5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200, 234, 242, 0.5)';
    ctx.textAlign = 'left';
    ctx.fillText('500 m', scaleX + 132, scaleY + 4);
    const northX = b.right - 48;
    const northY = b.bottom - 70;
    ctx.strokeStyle = 'rgba(200, 234, 242, 0.5)';
    ctx.beginPath();
    ctx.moveTo(northX, northY + 18);
    ctx.lineTo(northX, northY - 14);
    ctx.moveTo(northX - 6, northY - 4);
    ctx.lineTo(northX, northY - 14);
    ctx.lineTo(northX + 6, northY - 4);
    ctx.stroke();
    ctx.fillText('N', northX + 8, northY - 12);

    // Planned route in a faint dashed stroke, then the driven portion as the wall.
    ctx.strokeStyle = 'rgba(98, 217, 255, 0.25)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      carRouteAt(car, i / 48, point);
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    if (progress > 0) {
      const trail = Math.min(progress, car.trailLength / Math.max(1, carRouteLength(car)));
      const start = Math.max(0, progress - trail);
      const span = progress - start;
      const steps = Math.max(2, Math.ceil(span * 96));
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(98, 217, 255, 0.18)';
      ctx.lineWidth = 26;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        carRouteAt(car, start + (i / steps) * span, point);
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#62d9ff';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    // Stops are map pins: they mark the route but never become pickups.
    for (let i = 0; i < car.stops.length; i++) {
      const stop = car.stops[i];
      const reached = progress >= stop.at;
      carRouteAt(car, stop.at, point);
      ctx.fillStyle = reached ? '#ffe38a' : 'rgba(255, 227, 138, 0.28)';
      ctx.beginPath();
      ctx.arc(point.x, point.y, reached ? 7 : 5, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 227, 138, 0.54)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 13, 0, TWO_PI);
      ctx.stroke();
      ctx.font = FONT_TINY;
      ctx.textAlign = 'center';
      ctx.fillStyle = reached ? '#ffe9ae' : 'rgba(255, 233, 174, 0.44)';
      ctx.fillText(stop.label, point.x, point.y - 20);
    }

    // Car at the tip, banked along the route tangent.
    if (progress > 0) {
      carRouteAt(car, progress, point);
      const tipX = point.x;
      const tipY = point.y;
      carRouteAt(car, Math.max(0, progress - 0.015), point);
      const heading = Math.atan2(tipY - point.y, tipX - point.x);
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(heading);
      ctx.fillStyle = 'rgba(2, 8, 13, 0.72)';
      ctx.fillRect(-20, -14, 40, 28);
      ctx.fillStyle = '#ffcf5a';
      ctx.fillRect(-17, -10, 34, 20);
      ctx.fillStyle = '#0b202a';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#fff6d2';
      ctx.fillRect(12, -7, 4, 5);
      ctx.fillRect(12, 3, 4, 5);
      ctx.fillStyle = '#ff6b5c';
      ctx.fillRect(-19, -7, 3, 4);
      ctx.fillRect(-19, 3, 3, 4);
      ctx.restore();
    }

    // GPS readout card. It is deliberately a map overlay, not a new HUD element.
    const readoutX = b.left + 42;
    const readoutY = b.top + 126;
    ctx.fillStyle = 'rgba(3, 15, 22, 0.9)';
    ctx.fillRect(readoutX, readoutY, 332, 176);
    ctx.strokeStyle = 'rgba(98, 217, 255, 0.42)';
    ctx.lineWidth = 2;
    ctx.strokeRect(readoutX, readoutY, 332, 176);
    ctx.font = FONT_MID;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d8f8ff';
    ctx.fillText('CAR NAVIGATION', readoutX + 16, readoutY + 30);
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(160, 235, 255, 0.58)';
    ctx.fillText('ROUTE 21 // COUNTRY > CITY', readoutX + 16, readoutY + 50);
    ctx.fillStyle = '#e8fbff';
    ctx.fillText(`SPEED   ${Math.round(34 + progress * 46)} KM/H`, readoutX + 16, readoutY + 78);
    ctx.fillText(`ETA     ${Math.max(0, Math.round((1 - progress) * car.duration))} SEC`, readoutX + 16, readoutY + 100);
    ctx.fillText(`ROUTE   ${Math.round(progress * 100)}% DRIVEN`, readoutX + 16, readoutY + 122);
    let nextStop = 'DESTINATION';
    for (let i = 0; i < car.stops.length; i++) {
      if (progress < car.stops[i].at) {
        nextStop = car.stops[i].label;
        break;
      }
    }
    ctx.fillStyle = '#ffe38a';
    ctx.fillText(`NEXT    ${nextStop}`, readoutX + 16, readoutY + 148);
    ctx.fillStyle = 'rgba(98, 217, 255, 0.18)';
    ctx.fillRect(readoutX + 16, readoutY + 158, 300, 5);
    ctx.fillStyle = '#62d9ff';
    ctx.fillRect(readoutX + 16, readoutY + 158, 300 * progress, 5);

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(98, 217, 255, 0.68)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    ctx.restore();
  }

  /** PONG: a phosphor CRT court with automatic paddles and a live rally ball. */
  /**
   * An air traffic control scope. The floor is a radar disc, the sweep is slow and
   * harmless, and the aircraft are real hazards: World resolves them from the same
   * clock this reads, so what is drawn is where the damage is.
   */
  private drawRadarArena(state: RenderState | undefined, groundA: number, frameA: number, t: number): void {
    const arena = state?.arena;
    const radar = arena?.radar;
    if (!arena || !radar) return;
    const ctx = this.ctx;
    const cx = radar.cx;
    const cy = radar.cy;
    const R = radar.radius;
    const clock = state?.radarT ?? t;
    const sweep = (clock / Math.max(0.001, radar.sweepPeriod)) * TWO_PI;

    ctx.save();
    ctx.fillStyle = '#01070a';
    ctx.fillRect(cx - R - 74, cy - R - 74, R * 2 + 148, R * 2 + 148);
    ctx.globalAlpha = groundA;
    ctx.fillStyle = '#020c08';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 26, 0, TWO_PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#03130c';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TWO_PI);
    ctx.fill();

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 4, 0, TWO_PI);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(126, 247, 192, 0.16)';
    ctx.lineWidth = 1.4;
    for (let ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (R * ring) / 3, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(126, 247, 192, 0.5)';
    for (let deg = 0; deg < 360; deg += 15) {
      const a = (deg * Math.PI) / 180;
      const long = deg % 90 === 0;
      const r0 = R - (long ? 26 : 14);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
      ctx.stroke();
    }

    const steps = 7;
    for (let i = steps; i >= 0; i--) {
      ctx.globalAlpha = 0.1 * (1 - i / steps);
      ctx.fillStyle = arena.accent;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R - 6, sweep - (i + 1) * 0.075, sweep - i * 0.075);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.44;
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * (R - 6), cy + Math.sin(sweep) * (R - 6));
    ctx.stroke();

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = arena.accent;
    ctx.font = '600 17px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SECTOR 4 // APPROACH', cx, cy - R * 0.42);
    ctx.globalAlpha = 0.26;
    ctx.font = '500 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    for (let ring = 1; ring <= 3; ring++) {
      ctx.fillText(String(ring * 20), cx + 26, cy - (R * ring) / 3);
    }

    for (let i = 0; i < radar.planes.length; i++) {
      const def = radar.planes[i];
      const lapDur = Math.max(def.period, def.run / def.speed + 1);
      const pt = clock - def.delay;
      if (pt < 0) continue;
      const lap = Math.floor(pt / lapDur);
      const k = (pt - lap * lapDur) * def.speed;
      if (k > def.run) continue;
      const ex = cx + Math.cos(def.bearing) * def.entry;
      const ey = cy + Math.sin(def.bearing) * def.entry;
      const hx = Math.cos(def.heading);
      const hy = Math.sin(def.heading);

      ctx.globalAlpha = 0.24;
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let s = 0; s <= 10; s++) {
        const kk = k - s * 26;
        if (kk < 0) break;
        const px = ex + hx * kk;
        const py = ey + hy * kk;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      const x = ex + hx * k;
      const y = ey + hy * k;
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = arena.accent;
      ctx.beginPath();
      ctx.arc(x, y, def.radius + 12, 0, TWO_PI);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(def.heading + Math.PI * 0.5);
      const s = Math.max(10, def.radius * 0.55);
      ctx.fillStyle = '#d9fff0';
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.9, s * 0.7);
      ctx.lineTo(0, s * 0.34);
      ctx.lineTo(-s * 0.9, s * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#bffbe0';
      ctx.font = '600 17px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.tag, x + def.radius + 16, y - 8);
      ctx.globalAlpha = 0.45;
      ctx.font = '500 13px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(def.kind === 0 ? 'INBOUND' : 'OUTBOUND', x + def.radius + 16, y + 10);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawPongArena(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const pong = arena?.pong;
    if (!arena || !pong) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const court = pong.court;
    const centerX = court.x + court.w * 0.5;
    const centerY = court.y + court.h * 0.5;
    const ballX = state?.pongBallX ?? centerX;
    const ballY = state?.pongBallY ?? centerY;
    const leftY = state?.pongLeftY ?? centerY;
    const rightY = state?.pongRightY ?? centerY;
    const leftScore = state?.pongScoreLeft ?? 0;
    const rightScore = state?.pongScoreRight ?? 0;
    const hitFlash = state?.pongHitFlash ?? 0;
    const pointFlash = state?.pongScoreFlash ?? 0;
    const pointSide = state?.pongScoreSide ?? 0;

    ctx.save();
    ctx.fillStyle = '#010503';
    ctx.fillRect(b.left - 40, b.top - 40, b.right - b.left + 80, b.bottom - b.top + 80);
    ctx.globalAlpha = groundA;
    ctx.fillStyle = '#031008';
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

    // Cabinet housing and the green CRT screen.
    ctx.fillStyle = '#071911';
    ctx.fillRect(court.x - 26, court.y - 26, court.w + 52, court.h + 52);
    ctx.strokeStyle = 'rgba(168, 255, 176, 0.34)';
    ctx.lineWidth = 4;
    ctx.strokeRect(court.x - 26, court.y - 26, court.w + 52, court.h + 52);
    ctx.fillStyle = '#020b05';
    ctx.fillRect(court.x, court.y, court.w, court.h);
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(court.x, court.y, court.w, court.h);
    ctx.strokeStyle = 'rgba(168, 255, 176, 0.18)';
    ctx.lineWidth = 1;
    for (let y = court.y + 8; y < court.y + court.h; y += 7) {
      ctx.beginPath();
      ctx.moveTo(court.x + 3, y);
      ctx.lineTo(court.x + court.w - 3, y);
      ctx.stroke();
    }

    // Cabinet labels, scoreboard and centre net.
    ctx.font = FONT_TINY;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(168, 255, 176, 0.58)';
    ctx.fillText('ATTRACT MODE // 1UP', b.left + 34, b.top + 30);
    ctx.textAlign = 'right';
    ctx.fillText('CREDIT 00', b.right - 34, b.top + 30);
    ctx.textAlign = 'center';
    ctx.font = '700 58px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = '#d9ffe2';
    ctx.fillText(String(leftScore), court.x + court.w * 0.28, court.y + 78);
    ctx.fillText(String(rightScore), court.x + court.w * 0.72, court.y + 78);
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(168, 255, 176, 0.48)';
    ctx.fillText('P1', court.x + court.w * 0.28, court.y + 104);
    ctx.fillText('P2', court.x + court.w * 0.72, court.y + 104);
    ctx.font = FONT_MID;
    ctx.fillStyle = 'rgba(217, 255, 226, 0.74)';
    ctx.fillText('PONG', centerX, court.y + 42);
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(168, 255, 176, 0.4)';
    ctx.fillText('RALLY // LIVE BALL', centerX, court.y + 60);

    ctx.strokeStyle = 'rgba(168, 255, 176, 0.52)';
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 18]);
    ctx.beginPath();
    ctx.moveTo(centerX, court.y + 124);
    ctx.lineTo(centerX, court.y + court.h - 24);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles are screen rails, not body cover: they return the ball and glow on contact.
    const leftX = court.x + pong.paddleInset;
    const rightX = court.x + court.w - pong.paddleInset;
    const paddleAlpha = hitFlash > 0 ? 0.72 + Math.min(0.28, hitFlash) : 0.24;
    ctx.fillStyle = `rgba(168, 255, 176, ${paddleAlpha})`;
    ctx.fillRect(leftX - pong.paddleW * 0.5, leftY - pong.paddleH * 0.5, pong.paddleW, pong.paddleH);
    ctx.fillRect(rightX - pong.paddleW * 0.5, rightY - pong.paddleH * 0.5, pong.paddleW, pong.paddleH);
    ctx.fillStyle = '#eaffef';
    ctx.fillRect(leftX - 2, leftY - pong.paddleH * 0.5, 4, pong.paddleH);
    ctx.fillRect(rightX - 2, rightY - pong.paddleH * 0.5, 4, pong.paddleH);
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(168, 255, 176, 0.52)';
    ctx.fillText('CPU', leftX, court.y + court.h - 10);
    ctx.fillText('CPU', rightX, court.y + court.h - 10);

    // The ball is deliberately a square: the old arcade silhouette, not a second body.
    if (state?.pongBallActive ?? true) {
      const size = pong.ballRadius * 2;
      ctx.fillStyle = hitFlash > 0 ? '#ffffff' : '#eaffef';
      ctx.fillRect(ballX - pong.ballRadius, ballY - pong.ballRadius, size, size);
      ctx.strokeStyle = 'rgba(168, 255, 176, 0.68)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ballX - pong.ballRadius - 3, ballY - pong.ballRadius - 3, size + 6, size + 6);
    } else {
      ctx.globalAlpha = groundA * 0.38;
      ctx.fillStyle = arena.accent;
      ctx.fillRect(centerX - pong.ballRadius, centerY - pong.ballRadius, pong.ballRadius * 2, pong.ballRadius * 2);
      ctx.globalAlpha = groundA;
      ctx.font = FONT_TINY;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(217, 255, 226, 0.5)';
      ctx.fillText('SERVE', centerX, centerY + 34);
    }

    if (pointFlash > 0) {
      ctx.globalAlpha = Math.min(1, pointFlash) * groundA;
      ctx.font = FONT_SMALL;
      ctx.fillStyle = '#f2fff4';
      ctx.fillText(pointSide === 0 ? 'P1 SCORES' : 'P2 SCORES', centerX, centerY - 42);
      ctx.globalAlpha = groundA;
    }

    ctx.font = FONT_TINY;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(168, 255, 176, 0.4)';
    ctx.fillText('INSERT COIN', centerX, court.y + court.h + 38);
    ctx.fillText('MOVE TO SURVIVE THE RALLY', centerX, court.y + court.h + 54);

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(168, 255, 176, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    ctx.restore();
  }

  /** AIRPORT: a terminal floor under a split-flap arrivals/departures board. */
  /** One split-flap text cell. `progress` is 0..1 through a flip, or -1 when idle. */
  private drawFlapCell(
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    progress: number,
    hot: boolean,
    size: number,
  ): void {
    const ctx = this.ctx;
    ctx.fillStyle = hot ? '#241708' : '#05070a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hot ? 'rgba(255, 196, 80, 0.9)' : 'rgba(255, 200, 87, 0.34)';
    ctx.lineWidth = hot ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    const chars = Math.max(1, text.length);
    const charW = (w - 16) / chars;
    const squeeze = progress >= 0 ? Math.max(0.12, Math.abs(Math.cos(Math.PI * progress))) : 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, w - 4, h - 4);
    ctx.clip();
    ctx.font = `700 ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < chars; c++) {
      const gx = x + 8 + charW * (c + 0.5);
      ctx.save();
      ctx.translate(gx, y + h * 0.55);
      ctx.scale(1, squeeze);
      ctx.fillStyle = hot ? '#ffe6a8' : '#ffe9bd';
      ctx.fillText(text.charAt(c), 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // The hinge line is what makes a flap read as a flap.
    ctx.strokeStyle = 'rgba(4, 7, 11, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + h * 0.5);
    ctx.lineTo(x + w - 4, y + h * 0.5);
    ctx.stroke();
    if (progress >= 0) {
      const sweepY = y + h * progress;
      ctx.fillStyle = 'rgba(255, 211, 111, 0.18)';
      ctx.fillRect(x + 3, sweepY - 3, w - 6, 6);
      ctx.strokeStyle = '#ffe5a3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 3, sweepY);
      ctx.lineTo(x + w - 3, sweepY);
      ctx.stroke();
    }
  }

  /** AIRPORT: the split-flap board is the whole floor, and every line flips and hurts. */
  private drawFlipArena(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const flip = arena?.flip;
    if (!arena || !flip) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const board = flip.board;
    const clock = state?.flipT ?? t;
    const banks = Math.max(1, flip.banks ?? 1);
    const perBank = Math.ceil(flip.rows.length / banks);
    const cellScratch = { x: 0, y: 0, w: 0, h: 0 };

    ctx.save();
    ctx.fillStyle = '#05070b';
    ctx.fillRect(b.left - 40, b.top - 40, b.right - b.left + 80, b.bottom - b.top + 80);

    // Housing fills the arena: there is no floor outside the board any more.
    ctx.globalAlpha = groundA;
    ctx.fillStyle = '#0a0f16';
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#171d29';
    ctx.fillRect(board.x, board.y, board.w, board.h);
    ctx.fillStyle = '#202838';
    ctx.fillRect(board.x, board.y, board.w, flip.headerH);

    ctx.font = FONT_MID;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe5a3';
    ctx.fillText('FLIGHT INFORMATION', board.x + 22, board.y + 26);
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(255, 227, 164, 0.62)';
    ctx.fillText('EVERY LINE FLIPS // STAND CLEAR OF A LANDING ROW', board.x + 22, board.y + 46);
    ctx.fillStyle = 'rgba(255, 200, 87, 0.18)';
    ctx.fillRect(board.x + 16, board.y + flip.headerH - 3, board.w - 32, 3);

    for (let i = 0; i < flip.rows.length; i++) {
      const row = flip.rows[i];
      const rect = flipRowRectAt(flip, i, cellScratch);
      const rowState = state?.flipStates?.[i] ?? flipRowStateAt(flip, i, clock);
      const flap = flipRowFlapProgressAt(flip, i, clock);
      const warning = rowState === FLIP_STATE.warn;
      const flapping = rowState === FLIP_STATE.flap;
      const pulse = 0.55 + Math.sin(t * 9) * 0.25;
      const rowY = rect.y + (flip.rowH - flip.timeH) * 0.5;

      // The whole bank band reads as the hazard on a warning or a flip.
      ctx.fillStyle = flapping
        ? `rgba(255, 170, 50, ${0.1 + pulse * 0.06})`
        : warning
          ? `rgba(255, 150, 40, ${0.05 + pulse * 0.04})`
          : i % 2 === 0
            ? 'rgba(255, 255, 255, 0.025)'
            : 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      if (warning || flapping) {
        ctx.strokeStyle = `rgba(255, 190, 65, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
      }
      ctx.strokeStyle = 'rgba(255, 200, 87, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rect.x, rect.y + rect.h);
      ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
      ctx.stroke();
      // Section stripe: arrivals on the left bank, departures on the right.
      ctx.fillStyle = row.section === 'ARRIVALS' ? 'rgba(255, 208, 112, 0.7)' : 'rgba(255, 164, 112, 0.7)';
      ctx.fillRect(rect.x + 2, rect.y + 6, 4, rect.h - 12);

      const timeText = flipRowTimeAt(flip, i, clock);
      const destText = flipFieldAt(flip, i, flip.destinations, row.destination, clock);
      const gateText = flipFieldAt(flip, i, flip.gates, row.gate, clock);
      const statusText = flipFieldAt(flip, i, flip.statuses, row.status, clock);
      const timeX = rect.x + 16;
      const destX = timeX + flip.timeW + 18;
      const destW = 250;
      const gateX = destX + destW + 16;
      const gateW = 120;
      const statusX = gateX + gateW + 16;
      const statusW = Math.max(110, rect.x + rect.w - 16 - statusX);
      // Fields ripple a beat behind the time tile, so a row reads as one machine working.
      const ripple = (offset: number) => (flap >= 0 ? Math.min(1, flap + offset) : -1);

      this.drawFlapCell(timeText, timeX, rowY, flip.timeW, flip.timeH, flap, flapping, 24);
      this.drawFlapCell(destText, destX, rowY, destW, flip.timeH, ripple(0.06), flapping, 22);
      this.drawFlapCell(gateText, gateX, rowY, gateW, flip.timeH, ripple(0.11), flapping, 22);
      this.drawFlapCell(statusText, statusX, rowY, statusW, flip.timeH, ripple(0.16), flapping, 18);
    }

    // Bank headers, drawn once above each column set.
    ctx.textAlign = 'left';
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(255, 227, 164, 0.5)';
    for (let bank = 0; bank < banks; bank++) {
      const first = bank * perBank;
      if (first >= flip.rows.length) break;
      const rect = flipRowRectAt(flip, first, cellScratch);
      const label = flip.rows[first].section;
      ctx.fillText(label, rect.x + 20, board.y + flip.headerH - 12);
    }

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(255, 200, 87, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    ctx.restore();
  }

  /** SPACE INVADERS: an arcade fleet floor with a simulated cannon below. */
  private drawInvadersArena(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const inv = arena?.invaders;
    if (!arena || !inv) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const fleet = inv.fleet;
    const cannonX = state?.invaderCannonX ?? inv.cannon.x;
    const flash = state?.invaderCannonFlash ?? 0;
    const aim = state?.invaderAimT ?? 0;
    const shots = state?.invaderShots ?? [];

    ctx.save();
    ctx.fillStyle = '#010307';
    ctx.fillRect(b.left - 40, b.top - 40, b.right - b.left + 80, b.bottom - b.top + 80);
    ctx.globalAlpha = groundA;
    ctx.fillStyle = '#030811';
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

    // Fixed star field. Deterministic, so it does not shimmer between frames.
    for (let i = 0; i < 130; i++) {
      const x = b.left + 24 + ((i * 137) % (b.right - b.left - 48));
      const y = b.top + 22 + ((i * 83) % (b.bottom - b.top - 44));
      const twinkle = 0.16 + ((i * 17) % 9) * 0.035 + Math.sin(t * 1.3 + i) * 0.04;
      ctx.fillStyle = `rgba(180, 220, 255, ${Math.max(0.06, twinkle)})`;
      ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }

    // The invader formation is the floor's painted backdrop. It never collides.
    const xStep = (fleet.w - 80) / Math.max(1, inv.cols - 1);
    const yStep = (fleet.h - 104) / Math.max(1, inv.rows - 1);
    for (let r = 0; r < inv.rows; r++) {
      for (let c = 0; c < inv.cols; c++) {
        const size = 33 - r * 2;
        const x = fleet.x + 40 + c * xStep + Math.sin(t * 1.1 + r * 0.7) * 5;
        const y = fleet.y + 52 + r * yStep + Math.cos(t * 0.85 + c * 0.4) * 3;
        const alpha = 0.16 + (inv.rows - r) * 0.025 + ((c + r) % 3) * 0.016;
        ctx.fillStyle = `rgba(131, 255, 155, ${alpha})`;
        for (let py = 0; py < INVADER_PATTERN.length; py++) {
          const row = INVADER_PATTERN[py];
          for (let px = 0; px < row.length; px++) {
            if (row.charAt(px) === '1') {
              ctx.fillRect(x - size * 0.5 + px * (size / 7), y - size * 0.4 + py * (size / 7), size / 7, size / 7);
            }
          }
        }
      }
    }

    // Bunkers are the static cover between the fleet and the cannon.
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      ctx.fillStyle = '#1c5b32';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#2d8a4c';
      ctx.fillRect(r.x + 8, r.y + 8, r.w - 16, 10);
      ctx.fillStyle = '#0a1d12';
      ctx.fillRect(r.x + r.w * 0.27, r.y + r.h * 0.42, r.w * 0.46, r.h * 0.3);
      ctx.strokeStyle = 'rgba(131, 255, 155, 0.36)';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }

    // A ready cannon paints a thin aim lane before it fires.
    if (aim > 0) {
      const alpha = 0.12 + Math.min(0.4, aim / Math.max(0.001, inv.telegraph) * 0.4);
      ctx.strokeStyle = `rgba(255, 98, 98, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 12]);
      ctx.beginPath();
      ctx.moveTo(cannonX, inv.cannon.y - inv.cannon.h * 0.5);
      ctx.lineTo(cannonX, b.top + 12);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Arcade-player cannon, moving along the bottom edge.
    const cannonY = inv.cannon.y;
    ctx.fillStyle = '#0b2818';
    ctx.fillRect(cannonX - inv.cannon.w * 0.5, cannonY - inv.cannon.h * 0.5, inv.cannon.w, inv.cannon.h);
    ctx.strokeStyle = '#83ff9b';
    ctx.lineWidth = 2;
    ctx.strokeRect(cannonX - inv.cannon.w * 0.5, cannonY - inv.cannon.h * 0.5, inv.cannon.w, inv.cannon.h);
    ctx.fillStyle = '#d8ffe0';
    ctx.fillRect(cannonX - 4, cannonY - inv.cannon.h * 0.85, 8, inv.cannon.h * 0.42);
    ctx.fillStyle = '#83ff9b';
    ctx.fillRect(cannonX - 18, cannonY + 4, 36, 5);
    if (flash > 0) {
      ctx.fillStyle = '#ff7a68';
      ctx.fillRect(cannonX - 5, cannonY - inv.cannon.h * 0.98, 10, 18);
      ctx.fillStyle = 'rgba(255, 224, 143, 0.7)';
      ctx.fillRect(cannonX - 11, cannonY - inv.cannon.h * 0.82, 22, 4);
    }

    // Local cannon shots. These are the actual hazard, not decoration.
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      if (!shot.active) continue;
      ctx.fillStyle = 'rgba(255, 94, 86, 0.28)';
      ctx.fillRect(shot.x - 5, shot.y - 12, 10, 24);
      ctx.fillStyle = '#ffb38a';
      ctx.fillRect(shot.x - 3, shot.y - 8, 6, 16);
      ctx.fillStyle = '#fff4cf';
      ctx.fillRect(shot.x - 1, shot.y - 5, 2, 10);
    }

    ctx.font = FONT_TINY;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(131, 255, 155, 0.54)';
    ctx.fillText('SCORE 0000', b.left + 24, b.top + 26);
    ctx.textAlign = 'right';
    ctx.fillText('HI 9999', b.right - 24, b.top + 26);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(131, 255, 155, 0.44)';
    ctx.fillText('INVADER FLEET // LIVE CANNON', b.left + (b.right - b.left) * 0.5, b.top + 26);
    ctx.fillStyle = 'rgba(255, 147, 128, 0.58)';
    ctx.fillText('THE ARCADE PLAYER SHOOTS BACK', b.left + (b.right - b.left) * 0.5, b.bottom - 22);

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(131, 255, 155, 0.68)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    ctx.restore();
  }

  /** SMART PLUG: four socket modules around a green-safe / red-live circuit ring. */
  private drawPlugArena(
    state: RenderState | undefined,
    groundA: number,
    frameA: number,
    t: number,
  ): void {
    const arena = state?.arena;
    const plug = arena?.plug;
    if (!arena || !plug) return;
    const ctx = this.ctx;
    const b = arena.bounds;
    const clock = state?.plugT ?? 0;
    const phase = state?.plugPhase ?? plugPhaseAt(plug, clock);
    const live = phase === PLUG_STATE.live;
    const warn = phase === PLUG_STATE.warn;
    const red = live || warn;
    const pulse = 0.5 + 0.5 * Math.abs(Math.sin(t * 11));
    const centerX = b.left + (b.right - b.left) * 0.5;
    const centerY = b.top + (b.bottom - b.top) * 0.5;

    ctx.save();
    ctx.fillStyle = '#020604';
    ctx.fillRect(b.left - 40, b.top - 40, b.right - b.left + 80, b.bottom - b.top + 80);
    ctx.globalAlpha = groundA;
    ctx.fillStyle = '#06100a';
    ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

    // Dark circuit board, fine grid and a faint high-voltage watermark.
    ctx.strokeStyle = 'rgba(109, 255, 168, 0.045)';
    ctx.lineWidth = 1;
    for (let x = b.left + 48; x < b.right; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, b.top + 20);
      ctx.lineTo(x, b.bottom - 20);
      ctx.stroke();
    }
    for (let y = b.top + 48; y < b.bottom; y += 64) {
      ctx.beginPath();
      ctx.moveTo(b.left + 20, y);
      ctx.lineTo(b.right - 20, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(109, 255, 168, 0.13)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left + 26, b.top + 26, b.right - b.left - 52, b.bottom - b.top - 52);
    ctx.save();
    ctx.globalAlpha = 0.035 * groundA;
    ctx.fillStyle = '#d8ffe6';
    ctx.font = '900 220px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('120V', centerX, centerY);
    ctx.restore();

    // Four socket modules. The ring starts at their inner faces.
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      const ledX = r.x + r.w - 26;
      const ledY = r.y + 27;
      const led = red ? '#ff5b52' : '#6dffa8';
      const ledGlow = red
        ? `rgba(255, 91, 82, ${0.12 + (warn ? pulse * 0.2 : 0.08)})`
        : 'rgba(109, 255, 168, 0.12)';

      ctx.globalAlpha = groundA;
      ctx.fillStyle = '#09110d';
      ctx.fillRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10);
      ctx.fillStyle = '#111f18';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(178, 255, 207, 0.32)';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#0a1711';
      ctx.fillRect(r.x + 10, r.y + 10, r.w - 20, r.h - 20);
      ctx.fillStyle = 'rgba(109, 255, 168, 0.1)';
      for (let v = 0; v < 4; v++) ctx.fillRect(r.x + 18, r.y + 62 + v * 12, 42, 4);
      ctx.fillStyle = 'rgba(178, 255, 207, 0.74)';
      ctx.font = FONT_TINY;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`PLUG 0${i + 1}`, r.x + 18, r.y + 31);
      ctx.fillStyle = ledGlow;
      ctx.beginPath();
      ctx.arc(ledX, ledY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = led;
      ctx.beginPath();
      ctx.arc(ledX, ledY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = red ? `rgba(255, 91, 82, ${0.5 + pulse * 0.4})` : 'rgba(109, 255, 168, 0.72)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ledX, ledY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = red ? '#ff9c8e' : '#9fffc0';
      ctx.font = FONT_TINY;
      ctx.textAlign = 'center';
      ctx.fillText(red ? 'LIVE' : 'SAFE', ledX, r.y + 50);
    }

    // The circuit itself. Safe is a green guide, warning is a red dashed preview,
    // and live is a jagged, layered arc between the two socket faces.
    for (let i = 0; i < plug.arcs.length; i++) {
      const arc = plug.arcs[i];
      const dx = arc.bx - arc.ax;
      const dy = arc.by - arc.ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      ctx.globalAlpha = groundA;
      if (live) {
        for (let pass = 0; pass < 3; pass++) {
          ctx.globalAlpha = groundA * (pass === 0 ? 0.16 : pass === 1 ? 0.56 : 1);
          ctx.strokeStyle = pass === 2 ? '#ffe7d2' : '#ff5548';
          ctx.lineWidth = pass === 0 ? plug.arcWidth + 20 : pass === 1 ? plug.arcWidth * 0.58 : 2.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let s = 0; s <= 24; s++) {
            const k = s / 24;
            const envelope = Math.sin(Math.PI * k);
            const jitter = (Math.sin(t * 43 + s * 2.6 + i * 1.7) + Math.sin(t * 67 + s * 1.1) * 0.55) * 6 * envelope;
            const x = arc.ax + dx * k + nx * jitter;
            const y = arc.ay + dy * k + ny * jitter;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = groundA;
        for (let s = 0; s < 4; s++) {
          const k = (t * 0.9 + s * 0.25 + i * 0.17) % 1;
          ctx.fillStyle = '#fff0c8';
          ctx.fillRect(arc.ax + dx * k - 2, arc.ay + dy * k - 2, 4, 4);
        }
      } else {
        ctx.strokeStyle = warn
          ? `rgba(255, 86, 74, ${0.35 + pulse * 0.45})`
          : 'rgba(109, 255, 168, 0.23)';
        ctx.lineWidth = warn ? 3 : 1.5;
        if (warn) ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(arc.ax, arc.ay);
        ctx.lineTo(arc.bx, arc.by);
        ctx.stroke();
        if (warn) ctx.setLineDash([]);
        if (!warn) {
          for (let s = 0; s < 4; s++) {
            const k = (t * 0.28 + s * 0.25 + i * 0.2) % 1;
            ctx.fillStyle = 'rgba(109, 255, 168, 0.6)';
            ctx.beginPath();
            ctx.arc(arc.ax + dx * k, arc.ay + dy * k, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // Socket plates sit on the module faces where each arc terminates.
    ctx.globalAlpha = groundA;
    for (let i = 0; i < plug.arcs.length; i++) {
      const arc = plug.arcs[i];
      const angle = Math.atan2(arc.by - arc.ay, arc.bx - arc.ax);
      for (let end = 0; end < 2; end++) {
        const x = end === 0 ? arc.ax : arc.bx;
        const y = end === 0 ? arc.ay : arc.by;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = '#020805';
        ctx.fillRect(-9, -14, 18, 28);
        ctx.strokeStyle = red ? 'rgba(255, 91, 82, 0.72)' : 'rgba(109, 255, 168, 0.48)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-9, -14, 18, 28);
        ctx.fillStyle = '#0a1711';
        ctx.fillRect(-5, -9, 10, 18);
        ctx.fillStyle = '#010403';
        ctx.fillRect(-3, -6, 2, 7);
        ctx.fillRect(1, -6, 2, 7);
        ctx.restore();
      }
    }

    // Status strip and the rule, in the top margin above the ring.
    ctx.globalAlpha = groundA;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = FONT_SMALL;
    ctx.fillStyle = red ? '#ff6a5e' : '#6dffa8';
    ctx.fillText(live ? 'RED // CIRCUIT LIVE' : warn ? 'RED // BRACE' : 'GREEN // SAFE', centerX, b.top + 26);
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(207, 255, 224, 0.52)';
    ctx.fillText('GREEN = CROSS  //  RED = WAIT', centerX, b.top + 43);
    ctx.fillStyle = 'rgba(109, 255, 168, 0.38)';
    ctx.fillText('4-PORT POWER BOARD // 60 HZ', centerX, b.bottom - 18);

    ctx.globalAlpha = frameA;
    ctx.strokeStyle = 'rgba(109, 255, 168, 0.68)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    ctx.restore();
  }

  private drawArena(
    t: number,
    arena: ArenaDef,
    intro = INTRO_LEN,
    discT = 0,
    usbT = 0,
    swipeT = 0,
    swipePopupT = 0,
    satelliteState?: RenderState,
  ): void {
    const ctx = this.ctx;
    const b = arena.bounds;
    this.ensureFloorPattern(arena);
    // Each layer compiles in on its own beat. Cover drops a few units into place,
    // so the arena reads as assembled rather than simply faded up.
    const groundA = intro >= INTRO_LEN ? 1 : Math.max(0, Math.min(1, intro / 0.9));
    const frameA = intro >= INTRO_LEN ? 1 : Math.max(0, Math.min(1, (intro - 0.7) / 0.75));
    const pillarA = intro >= INTRO_LEN ? 1 : Math.max(0, Math.min(1, (intro - 1.15) / 0.8));
    const pillarDrop = (1 - pillarA) * 30;
    if (arena.laptop) {
      this.drawLaptopArena(satelliteState, groundA, frameA, t);
      return;
    }
    if (arena.watch) {
      this.drawWatchArena(satelliteState, groundA, frameA, t);
      return;
    }
    if (arena.smoke) {
      this.drawSmokeArena(satelliteState, groundA, frameA, t);
      return;
    }
    if (arena.disc) {
      this.drawDiscArena(t, arena, groundA, frameA, discT);
      return;
    }
    if (arena.usb) {
      this.drawUsbArena(arena, groundA, frameA, usbT);
      return;
    }
    if (arena.swipe) {
      this.drawSwipeArena(arena, groundA, frameA, t, swipeT, swipePopupT);
      return;
    }
    if (arena.car) {
      this.drawCarArena(satelliteState, groundA, frameA, t);
      return;
    }
    if (arena.radar) {
      this.drawRadarArena(satelliteState, groundA, frameA, t);
      return;
    }
    if (arena.pong) {
      this.drawPongArena(satelliteState, groundA, frameA, t);
      return;
    }
    if (arena.flip) {
      this.drawFlipArena(satelliteState, groundA, frameA, t);
      return;
    }
    if (arena.invaders) {
      this.drawInvadersArena(satelliteState, groundA, frameA, t);
      return;
    }
    if (arena.plug) {
      this.drawPlugArena(satelliteState, groundA, frameA, t);
      return;
    }
    if (arena.seek) {
      this.drawSeekArena(satelliteState, groundA, frameA, t);
      return;
    }
    if (arena.rocket) {
      this.drawRocketArena(satelliteState, groundA, frameA);
      return;
    }
    if (arena.weapon) {
      this.drawWeaponArena(satelliteState, groundA, frameA, t);
      return;
    }
    if (arena.satellite) {
      this.drawSatelliteArena(satelliteState, groundA, frameA);
      return;
    }
    // A plate arena has no floor rectangle: the plates are the floor and the gap between
    // them is open void, so the ordinary ground/grid/border pass is skipped entirely.
    if (arena.islands) {
      this.drawIslandArena(arena, t, groundA, frameA, pillarA);
      return;
    }
    if (this.dustArena !== arena.id) {
      for (let i = 0; i < this.dustX.length; i++) {
        this.dustX[i] = b.left + Math.random() * (b.right - b.left);
        this.dustY[i] = b.top + Math.random() * (b.bottom - b.top);
      }
      this.dustArena = arena.id;
    }
    ctx.save();
    ctx.globalAlpha = groundA;
    ctx.fillStyle = this.floorGradient ?? '#050b12';
    ctx.fillRect(arena.bounds.left, arena.bounds.top, arena.bounds.right - arena.bounds.left, arena.bounds.bottom - arena.bounds.top);
    ctx.fillStyle = arena.accentFaint;
    ctx.fillRect(arena.bounds.left, arena.bounds.top, arena.bounds.right - arena.bounds.left, arena.bounds.bottom - arena.bounds.top);
    if (this.floorPattern) {
      ctx.fillStyle = this.floorPattern;
      ctx.globalAlpha = groundA * 0.85;
      ctx.fillRect(arena.bounds.left, arena.bounds.top, arena.bounds.right - arena.bounds.left, arena.bounds.bottom - arena.bounds.top);
      ctx.globalAlpha = groundA;
    }

    // Grid.
    ctx.beginPath();
    for (let x = arena.bounds.left + 48; x < arena.bounds.right; x += 48) {
      ctx.moveTo(x + 0.5, arena.bounds.top);
      ctx.lineTo(x + 0.5, arena.bounds.bottom);
    }
    for (let y = arena.bounds.top + 48; y < arena.bounds.bottom; y += 48) {
      ctx.moveTo(arena.bounds.left, y + 0.5);
      ctx.lineTo(arena.bounds.right, y + 0.5);
    }
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Static dust.
    ctx.fillStyle = 'rgba(150, 220, 240, 0.12)';
    for (let i = 0; i < this.dustX.length; i++) {
      ctx.fillRect(this.dustX[i], this.dustY[i], 1.5, 1.5);
    }

    // Slow scan sweep.
    const scanY = arena.bounds.top + ((t * 26) % (arena.bounds.bottom - arena.bounds.top));
    ctx.fillStyle = 'rgba(80, 220, 240, 0.035)';
    ctx.fillRect(arena.bounds.left, scanY, arena.bounds.right - arena.bounds.left, 16);
    ctx.restore();

    this.drawTraversal(arena, t, frameA);
    this.drawTutorialRooms(arena, t, frameA);
    this.drawRegularPrograms(arena, t, frameA);

    // Border. An open arena has no wall, so the lip is dashed and the grid outside it is
    // swallowed by the void. A shot-only open edge has no frame at all: GRID ZERO's
    // floor simply ends, and the boss crosses that bare edge.
    const openLip = arena.walls === 'open';
    ctx.save();
    ctx.strokeStyle = arena.accent;
    if (arena.openShots) {
      // Leave the plate edge bare. The floor fill is the only boundary; no bar, no
      // corner brackets, no inward chevrons that would read as a wall to shoot around.
    } else if (openLip) {
      ctx.globalAlpha = frameA;
      ctx.fillStyle = 'rgba(2, 5, 9, 0.94)';
      const voidW = CAMERA.voidMargin + 72;
      ctx.fillRect(b.left - voidW, b.top - voidW, b.right - b.left + voidW * 2, voidW);
      ctx.fillRect(b.left - voidW, b.bottom, b.right - b.left + voidW * 2, voidW);
      ctx.fillRect(b.left - voidW, b.top, voidW, b.bottom - b.top);
      ctx.fillRect(b.right, b.top, voidW, b.bottom - b.top);
      ctx.globalAlpha = 0.08 * frameA;
      ctx.lineWidth = 9;
      ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
      ctx.globalAlpha = 0.5 * frameA;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([30, 18]);
      ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
      ctx.globalAlpha = 0.26 * frameA;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 10]);
      ctx.strokeRect(b.left + 5.5, b.top + 5.5, b.right - b.left - 11, b.bottom - b.top - 11);
      ctx.setLineDash([]);
      // Inward chevrons, so the edge reads as "this way back" rather than a wall.
      ctx.globalAlpha = 0.4 * frameA;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = b.left + 96; x < b.right - 40; x += 128) {
        ctx.moveTo(x - 6, b.top + 3);
        ctx.lineTo(x, b.top + 13);
        ctx.lineTo(x + 6, b.top + 3);
        ctx.moveTo(x - 6, b.bottom - 3);
        ctx.lineTo(x, b.bottom - 13);
        ctx.lineTo(x + 6, b.bottom - 3);
      }
      for (let y = b.top + 96; y < b.bottom - 40; y += 128) {
        ctx.moveTo(b.left + 3, y - 6);
        ctx.lineTo(b.left + 13, y);
        ctx.lineTo(b.left + 3, y + 6);
        ctx.moveTo(b.right - 3, y - 6);
        ctx.lineTo(b.right - 13, y);
        ctx.lineTo(b.right - 3, y + 6);
      }
      ctx.stroke();
    } else {
      // A wall is a wall. Three passes so the boundry never reads like a soft floor edge:
      // a wide bleed, a thick solid body, then a bright white inner face.
      ctx.globalAlpha = 0.16 * frameA;
      ctx.lineWidth = 22;
      ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
      ctx.globalAlpha = 0.95 * frameA;
      ctx.lineWidth = 5;
      ctx.strokeRect(b.left + 2, b.top + 2, b.right - b.left - 4, b.bottom - b.top - 4);
      ctx.globalAlpha = 0.9 * frameA;
      ctx.strokeStyle = '#eaffff';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(b.left + 5.5, b.top + 5.5, b.right - b.left - 11, b.bottom - b.top - 11);
      ctx.strokeStyle = arena.accent;
      ctx.globalAlpha = 0.35 * frameA;
      ctx.lineWidth = 10;
      ctx.strokeRect(b.left + 10, b.top + 10, b.right - b.left - 20, b.bottom - b.top - 20);
      ctx.globalAlpha = 1;

      // Corner brackets.
      const len = 26;
      const pad = 8;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.left + pad, b.top + pad + len);
      ctx.lineTo(b.left + pad, b.top + pad);
      ctx.lineTo(b.left + pad + len, b.top + pad);
      ctx.moveTo(b.right - pad - len, b.top + pad);
      ctx.lineTo(b.right - pad, b.top + pad);
      ctx.lineTo(b.right - pad, b.top + pad + len);
      ctx.moveTo(b.left + pad, b.bottom - pad - len);
      ctx.lineTo(b.left + pad, b.bottom - pad);
      ctx.lineTo(b.left + pad + len, b.bottom - pad);
      ctx.moveTo(b.right - pad - len, b.bottom - pad);
      ctx.lineTo(b.right - pad, b.bottom - pad);
      ctx.lineTo(b.right - pad, b.bottom - pad - len);
      ctx.stroke();

      // Edge ticks.
      ctx.strokeStyle = 'rgba(90, 210, 230, 0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = b.left + 96; x < b.right - 40; x += 128) {
        ctx.moveTo(x, b.top);
        ctx.lineTo(x, b.top + 7);
        ctx.moveTo(x, b.bottom);
        ctx.lineTo(x, b.bottom - 7);
      }
      for (let y = b.top + 96; y < b.bottom - 40; y += 128) {
        ctx.moveTo(b.left, y);
        ctx.lineTo(b.left + 7, y);
        ctx.moveTo(b.right, y);
        ctx.lineTo(b.right - 7, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Floor holes sit under everything: a body over one is already falling.
    this.drawVoids(arena, frameA);

    // A trapezoid plate: the flanks outside the slant are void, so the floor reads narrow
    // at the top and full width at the bottom. It is a drop, not a wall.
    if (arena.slant) {
      const s = arena.slant;
      ctx.save();
      ctx.fillStyle = 'rgba(2, 5, 9, 0.97)';
      ctx.beginPath();
      ctx.moveTo(b.left - 260, b.top - 260);
      ctx.lineTo(b.left + s, b.top);
      ctx.lineTo(b.left, b.bottom);
      ctx.lineTo(b.left - 260, b.bottom + 260);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(b.right + 260, b.top - 260);
      ctx.lineTo(b.right - s, b.top);
      ctx.lineTo(b.right, b.bottom);
      ctx.lineTo(b.right + 260, b.bottom + 260);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = arena.accent;
      ctx.globalAlpha = 0.15 * frameA;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(b.left + s, b.top);
      ctx.lineTo(b.left, b.bottom);
      ctx.moveTo(b.right - s, b.top);
      ctx.lineTo(b.right, b.bottom);
      ctx.stroke();
      ctx.globalAlpha = 0.55 * frameA;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([30, 18]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Arena furniture.
    ctx.save();
    ctx.translate(0, -pillarDrop);
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      // Cover is a solid object, not floor texture: bright fill, inset panel, hard rim.
      ctx.globalAlpha = pillarA;
      ctx.fillStyle = COLORS.pillarFill;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = COLORS.pillarPanel;
      ctx.fillRect(r.x + 4, r.y + 4, Math.max(0, r.w - 8), Math.max(0, r.h - 8));
      ctx.globalAlpha = 0.22 * pillarA;
      ctx.strokeStyle = '#d9f8ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let hx = r.x + 10; hx < r.x + r.w - 8; hx += 14) {
        ctx.moveTo(hx, r.y + 8);
        ctx.lineTo(hx + 8, r.y + 8);
        ctx.moveTo(hx, r.y + r.h - 8);
        ctx.lineTo(hx + 8, r.y + r.h - 8);
      }
      ctx.stroke();
      // Cover is a blocker, so its rim is one of the brightest lines in the arena. The
      // soft outer band separates it from the floor; the hard rim says "cannot pass".
      ctx.globalAlpha = 0.18 * pillarA;
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 12;
      ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      ctx.globalAlpha = (0.92 + Math.sin(t * 1.6 + i) * 0.08) * pillarA;
      ctx.lineWidth = 3.4;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.globalAlpha = 0.55 * pillarA;
      ctx.strokeStyle = '#eaffff';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
      ctx.strokeStyle = arena.accent;
      ctx.globalAlpha = 0.32 * pillarA;
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 7, r.y + 7, Math.max(0, r.w - 14), Math.max(0, r.h - 14));
      ctx.beginPath();
      ctx.moveTo(r.x + 7, r.y + 7);
      ctx.lineTo(r.x + r.w - 7, r.y + r.h - 7);
      ctx.moveTo(r.x + r.w - 7, r.y + 7);
      ctx.lineTo(r.x + 7, r.y + r.h - 7);
      ctx.stroke();
      // Top edge catches the light so cover separates from the animated floor.
      ctx.globalAlpha = 0.95 * pillarA;
      ctx.strokeStyle = '#c9f7ff';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(r.x + 3, r.y + 2);
      ctx.lineTo(r.x + r.w - 3, r.y + 2);
      ctx.stroke();
      ctx.globalAlpha = pillarA;
      ctx.fillStyle = 'rgba(255, 168, 74, 0.8)';
      ctx.fillRect(r.x + r.w * 0.5 - 7, r.y + 4, 14, 2.4);
      ctx.fillRect(r.x + r.w * 0.5 - 7, r.y + r.h - 6, 14, 2.4);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Center floor marking: one shared ring plus a map-specific signature.
    ctx.save();
    ctx.globalAlpha = frameA;
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.14 * frameA;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const cx = (b.left + b.right) * 0.5;
    const cy = (b.top + b.bottom) * 0.5;
    ctx.arc(cx, cy, 54, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();
    if (!arena.traverse) this.drawArenaSignature(arena, t, frameA);
    if (arena.port) this.drawArenaPort(arena, t, frameA);
  }

  /**
   * Ingress ports: a red square leaking square particles, plus the white party port that
   * opens once every enemy port is closed. Health reads as a lit bar on the top edge, and
   * the closing beat collapses the frame into its own centre.
   */
  /** Gauntlet ingress bursts: a red square that opens on an edge, spews, and slams shut. */
  private drawAssaultPortals(portals: readonly AssaultPortal[], t: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < portals.length; i++) {
      const portal = portals[i];
      if (!portal.active) continue;
      const open = Math.min(1, portal.t / Math.max(0.001, portal.openDur));
      const emitEnd = portal.openDur + portal.emitDur;
      const closing = portal.t > emitEnd ? Math.min(1, (portal.t - emitEnd) / Math.max(0.001, portal.closeDur)) : 0;
      const scale = Math.max(0, Math.min(open, 1 - closing));
      const half = portal.half * (0.35 + scale * 0.65);
      const cx = portal.x;
      const cy = portal.y;
      const pulse = 0.6 + Math.sin(t * 14) * 0.3;

      ctx.save();
      ctx.globalAlpha = 0.22 * scale;
      ctx.fillStyle = 'rgba(255, 77, 77, 0.5)';
      ctx.fillRect(cx - half - 22, cy - half - 22, (half + 22) * 2, (half + 22) * 2);
      ctx.globalAlpha = scale;
      ctx.fillStyle = '#0a0305';
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
      // Inward chevrons: the mouth is pulling, not pushing.
      ctx.strokeStyle = `rgba(255, 120, 90, ${0.85 * scale})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let side = 0; side < 4; side++) {
        const a = (side * Math.PI) / 2 + Math.PI / 4;
        const r0 = half * 0.95;
        const r1 = half * 0.55;
        ctx.moveTo(cx + Math.cos(a - 0.22) * r0, cy + Math.sin(a - 0.22) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a + 0.22) * r0, cy + Math.sin(a + 0.22) * r0);
      }
      ctx.stroke();
      ctx.globalAlpha = scale;
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = Math.max(2, 5 * scale);
      ctx.strokeRect(cx - half + 1.5, cy - half + 1.5, half * 2 - 3, half * 2 - 3);
      // Corner brackets flash while the mouth is live.
      ctx.globalAlpha = 0.55 + pulse * 0.45;
      ctx.strokeStyle = '#ffd0b8';
      ctx.lineWidth = 3;
      const arm = Math.max(6, half * 0.34);
      ctx.beginPath();
      for (let side = 0; side < 4; side++) {
        const sx = side === 1 || side === 2 ? 1 : -1;
        const sy = side === 0 || side === 1 ? -1 : 1;
        ctx.moveTo(cx + sx * half - sx * arm, cy + sy * half);
        ctx.lineTo(cx + sx * half, cy + sy * half);
        ctx.lineTo(cx + sx * half, cy + sy * half - sy * arm);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawPorts(props: readonly Prop[], t: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < props.length; i++) {
      const b = props[i];
      if (!b.portal) continue;
      if (b.replicator) {
        this.drawReplicator(b, t);
        continue;
      }
      const closing = (b.portalCloseT ?? 0) > 0;
      if (!b.active && !closing) continue;
      const exit = b.portalExit === true;
      const close = closing ? Math.max(0, Math.min(1, (b.portalCloseT ?? 0) / 0.9)) : 1;
      const cx = b.x + b.w * 0.5;
      const cy = b.y + b.h * 0.5;
      const half = b.w * 0.5 * close;
      const color = exit ? '#eafcff' : '#ff4d4d';
      const soft = exit ? 'rgba(234, 252, 255, 0.36)' : 'rgba(255, 77, 77, 0.34)';
      const r = b.w * 0.5;
      ctx.save();
      // Halo: the port lights the floor around its own frame.
      ctx.globalAlpha = (exit ? 0.18 : 0.24) * close;
      ctx.fillStyle = soft;
      ctx.fillRect(cx - r - 18, cy - r - 18, (r + 18) * 2, (r + 18) * 2);
      // Square particles leak out of the mouth and drift back toward the rim.
      ctx.globalAlpha = (exit ? 0.55 : 0.85) * close;
      ctx.fillStyle = color;
      for (let k = 0; k < 10; k++) {
        const phase = (t * (0.45 + k * 0.09) + k * 0.37) % 1;
        const a = (k / 10) * Math.PI * 2 + t * 0.3;
        const dist = half * (0.45 + phase * 1.15);
        const size = 2 + (1 - phase) * 4;
        ctx.fillRect(cx + Math.cos(a) * dist - size * 0.5, cy + Math.sin(a) * dist - size * 0.5, size, size);
      }
      // Frame: thick bright square, dark mouth, rotating inner brackets.
      ctx.globalAlpha = close;
      ctx.fillStyle = '#0a0305';
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, 5 * close);
      ctx.strokeRect(cx - half + 1.5, cy - half + 1.5, half * 2 - 3, half * 2 - 3);
      ctx.globalAlpha = 0.5 * close;
      ctx.lineWidth = 1.5;
      const spin = t * 0.8;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a0 = spin + (k * Math.PI) / 2;
        const a1 = a0 + 0.45;
        ctx.moveTo(cx + Math.cos(a0) * half * 0.62, cy + Math.sin(a0) * half * 0.62);
        ctx.lineTo(cx + Math.cos(a1) * half * 0.62, cy + Math.sin(a1) * half * 0.62);
      }
      ctx.stroke();
      // Health: a lit bar across the top edge. The party port needs none.
      if (!exit && !closing) {
        const max = Math.max(1, b.portalMaxHp ?? b.hp);
        const hp = Math.max(0, Math.min(1, b.hp / max));
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(20, 6, 8, 0.9)';
        ctx.fillRect(cx - half, cy - half - 13, half * 2, 5);
        ctx.fillStyle = color;
        ctx.fillRect(cx - half, cy - half - 13, half * 2 * hp, 5);
      }
      ctx.restore();
    }
  }

  /**
   * A replicator: amber hardware with a travelling print bar and a slot laying copies of
   * one family onto the tray. It reads as a machine someone installed, not a connection.
   */
  private drawReplicator(b: Prop, t: number): void {
    const ctx = this.ctx;
    const closing = (b.portalCloseT ?? 0) > 0;
    if (!b.active && !closing) return;
    const close = closing ? Math.max(0, Math.min(1, (b.portalCloseT ?? 0) / 0.9)) : 1;
    const w = b.w * close;
    const h = b.h * close;
    const x = b.x + (b.w - w) * 0.5;
    const y = b.y + (b.h - h) * 0.5;
    const cx = x + w * 0.5;
    ctx.save();
    ctx.globalAlpha = close;
    ctx.fillStyle = '#120b04';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = Math.max(2, 3 * close);
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    // The print bar sweeps top to bottom; one pass is one copy.
    const scan = ((t * 0.55) % 1) * Math.max(1, h - 14) + 7;
    ctx.globalAlpha = 0.7 * close;
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(x + 5, y + scan, Math.max(1, w - 10), 2);
    // Print slot along the bottom edge.
    ctx.globalAlpha = 0.9 * close;
    ctx.fillStyle = '#05070a';
    ctx.fillRect(x + w * 0.18, y + h - 9, w * 0.64, 5);
    // Copies sliding out of the slot onto the tray.
    ctx.fillStyle = '#ff4d4d';
    for (let k = 0; k < 3; k++) {
      const phase = (t * 0.7 + k * 0.33) % 1;
      const size = 5 + phase * 3;
      const px = cx + (k - 1) * (w * 0.22) + Math.sin(t * 1.4 + k) * 2;
      const py = y + h - 4 + phase * 12;
      ctx.globalAlpha = (0.85 - phase * 0.6) * close;
      ctx.fillRect(px - size * 0.5, py, size, size);
    }
    if (!closing) {
      const max = Math.max(1, b.portalMaxHp ?? b.hp);
      const hp = Math.max(0, Math.min(1, b.hp / max));
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(20, 12, 4, 0.9)';
      ctx.fillRect(x, y - 13, w, 5);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(x, y - 13, w * hp, 5);
    }
    ctx.restore();
  }

  /**
   * Four plates over open void. Nothing is drawn between them, because there is nothing
   * between them: walking off a plate is a drop, and the three decks are the crossings.
   * Cover drops in on its own beat, as it does in every arena.
   */
  private drawIslandArena(arena: ArenaDef, t: number, groundA: number, frameA: number, pillarA: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = groundA;
    ctx.fillStyle = '#02050a';
    const m = 420;
    ctx.fillRect(
      arena.bounds.left - m,
      arena.bounds.top - m,
      arena.bounds.right - arena.bounds.left + m * 2,
      arena.bounds.bottom - arena.bounds.top + m * 2,
    );
    ctx.restore();

    const pillarDrop = (1 - pillarA) * 26;
    this.drawTutorialRooms(arena, t, frameA);
    this.drawRegularPrograms(arena, t, frameA);

    ctx.save();
    ctx.translate(0, -pillarDrop);
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      ctx.globalAlpha = pillarA;
      ctx.fillStyle = COLORS.pillarFill;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = COLORS.pillarPanel;
      ctx.fillRect(r.x + 4, r.y + 4, Math.max(0, r.w - 8), Math.max(0, r.h - 8));
      ctx.globalAlpha = 0.2 * pillarA;
      ctx.strokeStyle = '#d9f8ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let hx = r.x + 10; hx < r.x + r.w - 8; hx += 14) {
        ctx.moveTo(hx, r.y + 8);
        ctx.lineTo(hx + 8, r.y + 8);
      }
      ctx.stroke();
      // Cover is a blocker, so its rim is one of the brightest lines on a plate.
      ctx.globalAlpha = 0.85 * pillarA;
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }
    ctx.restore();

    if (arena.port) this.drawArenaPort(arena, t, frameA);
  }

  /**
   * The connected tutorial rooms. These are inset floor plates and place labels over the
   * arena's own floor; collision stays in `traverse` (the gaps) and `pillars`. The bridge
   * decks are drawn over the traversal deck so the crossing reads as one authored route.
   */
  private drawTutorialRooms(arena: ArenaDef, t: number, alpha: number): void {
    const rooms = arena.rooms;
    if (!rooms) return;
    const ctx = this.ctx;
    ctx.save();
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const theme = ROOM_THEME_COLORS[room.theme];
      const cx = room.x + room.w * 0.5;
      const cy = room.y + room.h * 0.5;
      const radius = Math.min(room.w, room.h) * 0.5;
      ctx.save();
      ctx.beginPath();
      if (room.shape === 'circle') ctx.arc(cx, cy, radius, 0, TWO_PI);
      else ctx.rect(room.x, room.y, room.w, room.h);
      ctx.clip();

      // A plate floats: cast its shadow first so the rim reads as a thick edge over the void.
      if (arena.islands) {
        ctx.globalAlpha = 0.55 * alpha;
        ctx.fillStyle = '#01030a';
        ctx.fillRect(room.x + 10, room.y + 18, room.w, room.h);
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = theme.floor;
      ctx.fillRect(room.x, room.y, room.w, room.h);

      // A finer working grid over the room floor. The shared arena grid is 48px; this
      // one is 24px, so each room reads at a tighter, more enclosed scale.
      ctx.globalAlpha = 0.7 * alpha;
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = room.x + 24; x < room.x + room.w; x += 24) {
        ctx.moveTo(x + 0.5, room.y);
        ctx.lineTo(x + 0.5, room.y + room.h);
      }
      for (let y = room.y + 24; y < room.y + room.h; y += 24) {
        ctx.moveTo(room.x, y + 0.5);
        ctx.lineTo(room.x + room.w, y + 0.5);
      }
      ctx.stroke();

      if (room.theme === 'office') this.drawOfficeRoom(room, cx, cy, radius, alpha);
      else if (room.theme === 'holding') this.drawHoldingRoom(room, t, alpha);
      else if (room.theme === 'board') this.drawBoardRoom(arena, room, alpha);
      else if (room.theme === 'console') this.drawConsoleRoom(room, t, alpha);
      else this.drawRouterRoom(room, t, alpha);
      ctx.restore();

      // Hard rim plus a dashed containment line. The rim is the room's silhouette; the
      // dash keeps it from reading as another solid wall.
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = arena.islands ? 5 : 3;
      ctx.beginPath();
      if (room.shape === 'circle') ctx.arc(cx, cy, radius - 2, 0, TWO_PI);
      else ctx.rect(room.x + 2, room.y + 2, room.w - 4, room.h - 4);
      ctx.stroke();
      ctx.globalAlpha = 0.32 * alpha;
      ctx.lineWidth = 1;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      if (room.shape === 'circle') ctx.arc(cx, cy, radius - 12, 0, TWO_PI);
      else ctx.rect(room.x + 12, room.y + 12, room.w - 24, room.h - 24);
      ctx.stroke();
      ctx.setLineDash([]);

      // Place label above the plate. This is a name, not an objective marker.
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '600 15px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = theme.accent;
      ctx.fillText(room.label, cx, room.y - 22);
      ctx.globalAlpha = 0.62 * alpha;
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#dff7ff';
      ctx.fillText(room.sub, cx, room.y - 7);
    }

    const bridges = arena.bridges;
    if (bridges) {
      for (let i = 0; i < bridges.length; i++) {
        const bridge = bridges[i];
        const vertical = bridge.h > bridge.w;
        const x = bridge.x;
        const y = bridge.y;
        const w = bridge.w;
        const h = bridge.h;
        const label = bridge.label ? `LINK ${bridge.label}` : 'LINK';
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#0c131b';
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 0.55 * alpha;
        ctx.strokeStyle = 'rgba(150, 210, 235, 0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (vertical) {
          for (let by = y + 12; by < y + h; by += 20) {
            ctx.moveTo(x + 10, by + 0.5);
            ctx.lineTo(x + w - 10, by + 0.5);
          }
        } else {
          for (let bx = x + 12; bx < x + w; bx += 20) {
            ctx.moveTo(bx + 0.5, y + 10);
            ctx.lineTo(bx + 0.5, y + h - 10);
          }
        }
        ctx.stroke();
        // Rails run along the long edges, so a vertical deck still reads as a walkway.
        ctx.globalAlpha = 0.9 * alpha;
        ctx.strokeStyle = arena.accent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (vertical) {
          ctx.moveTo(x + 8, y);
          ctx.lineTo(x + 8, y + h);
          ctx.moveTo(x + w - 8, y);
          ctx.lineTo(x + w - 8, y + h);
        } else {
          ctx.moveTo(x, y + 8);
          ctx.lineTo(x + w, y + 8);
          ctx.moveTo(x, y + h - 8);
          ctx.lineTo(x + w, y + h - 8);
        }
        ctx.stroke();
        // A data thread runs toward the port, so the bridge has a direction.
        ctx.globalAlpha = 0.72 * alpha;
        ctx.strokeStyle = '#d8fbff';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([16, 18]);
        ctx.lineDashOffset = -t * 54;
        ctx.beginPath();
        if (vertical) {
          ctx.moveTo(x + w * 0.5, y + 2);
          ctx.lineTo(x + w * 0.5, y + h - 2);
        } else {
          ctx.moveTo(x + 2, y + h * 0.5);
          ctx.lineTo(x + w - 2, y + h * 0.5);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        ctx.globalAlpha = 0.75 * alpha;
        ctx.strokeStyle = arena.accentSoft;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.globalAlpha = 0.65 * alpha;
        ctx.fillStyle = arena.accent;
        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, x + w * 0.5, y - 7);
      }
    }
    ctx.restore();
  }

  /** Intake floor: carpet seams, lamp cones and a walk line. The first lesson happens
   *  in the bare circle, before the holding office introduces the cell block. */
  private drawOfficeRoom(room: ArenaRoomDef, cx: number, cy: number, _radius: number, alpha: number): void {
    const ctx = this.ctx;
    const theme = ROOM_THEME_COLORS.office;
    const bottom = room.y + room.h;

    ctx.globalAlpha = 0.26 * alpha;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(cx + 30, cy);
    ctx.lineTo(room.x + room.w + 8, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Two warm pools from the ceiling fixtures over the desk rows.
    ctx.globalAlpha = 0.05 * alpha;
    ctx.fillStyle = '#ffd89a';
    for (let i = 0; i < 2; i++) {
      const lx = cx + (i === 0 ? -1 : 1) * 108;
      ctx.beginPath();
      ctx.moveTo(lx - 16, room.y + 46);
      ctx.lineTo(lx + 16, room.y + 46);
      ctx.lineTo(lx + 76, bottom - 66);
      ctx.lineTo(lx - 76, bottom - 66);
      ctx.closePath();
      ctx.fill();
    }

    // Booking counter along the back wall: three terminals, a rail and the shift file.
    // It is the precinct's signature, so the intake reads as a charge desk, not a room.
    const counterX = Math.round(cx - 150);
    const counterY = room.y + 22;
    ctx.globalAlpha = 0.55 * alpha;
    ctx.fillStyle = 'rgba(9, 13, 18, 0.82)';
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1.2;
    ctx.fillRect(counterX, counterY, 300, 26);
    ctx.strokeRect(counterX + 0.5, counterY + 0.5, 299, 25);
    for (let i = 0; i < 3; i++) {
      const mx = counterX + 40 + i * 90;
      ctx.globalAlpha = 0.5 * alpha;
      ctx.fillStyle = '#0d1a20';
      ctx.fillRect(mx, counterY - 16, 26, 14);
      ctx.globalAlpha = 0.55 * alpha;
      ctx.strokeStyle = theme.accent;
      ctx.strokeRect(mx + 0.5, counterY - 15.5, 25, 13);
    }

    // Chains: the intake is a holding pen, so the plate is chained off at both sides and
    // along the front lip. They are floor dressing, never collision.
    this.drawChainRun(room.x + 24, room.y + 52, room.x + 24, room.y + room.h - 52, 0.34 * alpha);
    this.drawChainRun(room.x + room.w - 24, room.y + 52, room.x + room.w - 24, room.y + room.h - 52, 0.34 * alpha);
    this.drawChainRun(room.x + 52, room.y + room.h - 28, room.x + room.w - 52, room.y + room.h - 28, 0.26 * alpha);
    this.drawChainRun(cx - 150, room.y + 12, cx - 150, room.y + 118, 0.28 * alpha);
    this.drawChainRun(cx + 150, room.y + 12, cx + 150, room.y + 118, 0.28 * alpha);

    ctx.globalAlpha = 0.17 * alpha;
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 28px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('INTAKE // 01', cx, cy - 58);

    // Loose intake paper. Cosmetic, deliberately smaller than a breakable prop.
    ctx.globalAlpha = 0.18 * alpha;
    ctx.fillStyle = '#e8edf2';
    for (let i = 0; i < 7; i++) {
      const px = room.x + 116 + ((i * 83) % 250);
      const py = room.y + 132 + ((i * 61) % 210);
      ctx.fillRect(px, py, 10, 7);
    }
  }

  /** A run of chain links. Alternating link orientation reads as chain at any angle. */
  private drawChainRun(x1: number, y1: number, x2: number, y2: number, alpha: number): void {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len;
    const uy = dy / len;
    const step = 13;
    const count = Math.floor(len / step);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#c2d2d8';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < count; i++) {
      const px = x1 + ux * (i * step + step * 0.5);
      const py = y1 + uy * (i * step + step * 0.5);
      const wide = i % 2 === 0;
      ctx.beginPath();
      ctx.ellipse(px, py, wide ? step * 0.3 : step * 0.46, wide ? step * 0.46 : step * 0.3, 0, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Holding office: a square floor with a three-cell block along the back wall. Script
   * Kitty waits in the middle cell. When the calibration class is cleared the bars flash
   * amber, retract, and the released threats take over the office floor.
   */
  private drawHoldingRoom(room: ArenaRoomDef, t: number, alpha: number): void {
    const ctx = this.ctx;
    const theme = ROOM_THEME_COLORS.holding;
    const layout = holdingCellLayout(room);
    const left = layout.left;
    const cellW = layout.cellW;
    const cellTop = layout.top;
    const cellBottom = layout.bottom;
    const cx = room.x + room.w * 0.5;
    // Kitty and her cell label follow the block, not the plate centre: the block sits on
    // the back-right so the intake bridge can land on open floor at the left.
    const cellMidX = left + cellW * 1.5;

    // Two office desks sit at the front of the room, clear of the cell block and the
    // central wake arc. They are visual furniture, not cover pillars.
    ctx.globalAlpha = 0.55 * alpha;
    ctx.fillStyle = 'rgba(8, 12, 17, 0.78)';
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 2; i++) {
      const dx = room.x + 42 + i * (room.w - 120);
      const dy = room.y + room.h - 70;
      ctx.fillRect(dx, dy, 78, 34);
      ctx.strokeRect(dx + 0.5, dy + 0.5, 77, 33);
      ctx.globalAlpha = 0.25 * alpha;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(dx + 10, dy + 8, 20, 2);
      ctx.fillRect(dx + 10, dy + 14, 12, 2);
      ctx.globalAlpha = 0.55 * alpha;
      ctx.fillStyle = 'rgba(8, 12, 17, 0.78)';
    }

    // Cell block: dark recesses, bunks and a small service label per cell.
    for (let i = 0; i < 3; i++) {
      const x = left + i * cellW;
      ctx.globalAlpha = 0.62 * alpha;
      ctx.fillStyle = theme.deep;
      ctx.fillRect(x + 2, cellTop, cellW - 4, cellBottom - cellTop);
      ctx.globalAlpha = 0.35 * alpha;
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2.5, cellTop + 0.5, cellW - 5, cellBottom - cellTop - 1);
      ctx.globalAlpha = 0.22 * alpha;
      ctx.fillStyle = '#a8c0cb';
      ctx.fillRect(x + 12, cellTop + 42, cellW - 24, 4);
      ctx.fillRect(x + 12, cellTop + 54, cellW - 32, 3);
      ctx.globalAlpha = 0.28 * alpha;
      ctx.fillStyle = theme.accent;
      ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`CELL 0${i + 1}`, x + cellW * 0.5, cellTop + 13);
    }

    // Kitty is inside the middle cell, drawn before the bars so the bars occlude her.
    drawRegularProgram(this.ctx, regularProgram('script-kitty'), cellMidX, cellBottom - 12, t, 0.66, alpha, 0.35);
    ctx.globalAlpha = 0.42 * alpha;
    ctx.fillStyle = theme.accent;
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('KITTY', cellMidX, cellBottom + 13);

    // Wave 2 waits behind the bars: the worm in the left cell, the virus pair in the
    // right. The real bodies exist already but are hidden from the normal threat pass;
    // these silhouettes are their caged presentation until the power-down releases them.
    if (this.campaignActive && !this.campaignBarsOpen) {
      this.drawHoldingCagedThreats(layout, t, alpha);
    }

    // The bars are the readable jail signal. A flash runs the whole block amber before
    // they retract; the cell frames stay so the room still reads as holding.
    const flash = this.campaignBarsFlashT > 0;
    const pulse = 0.55 + 0.45 * Math.sin(t * 26);
    const open = this.campaignBarsOpen;
    ctx.globalAlpha = (flash ? 0.85 + 0.15 * pulse : 0.58) * alpha;
    ctx.strokeStyle = flash ? '#ffd27a' : '#d5e5ea';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const x = left + i * cellW;
      ctx.strokeRect(x + 2, cellTop + 1, cellW - 4, cellBottom - cellTop - 2);
      ctx.beginPath();
      const barTop = open ? cellTop + 4 : cellTop + 5;
      const barBottom = open ? cellTop + 22 : cellBottom - 4;
      for (let bx = x + 10; bx <= x + cellW - 8; bx += 13) {
        ctx.moveTo(bx, barTop);
        ctx.lineTo(bx, barBottom);
      }
      if (!open) {
        ctx.moveTo(x + 6, cellTop + 38);
        ctx.lineTo(x + cellW - 6, cellTop + 38);
        ctx.moveTo(x + 6, cellTop + 72);
        ctx.lineTo(x + cellW - 6, cellTop + 72);
      }
      ctx.stroke();
    }

    // Floor stencil, set below the cell block so it does not compete with the bars.
    ctx.globalAlpha = 0.16 * alpha;
    ctx.fillStyle = theme.accent;
    ctx.font = '700 22px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('HOLDING // 02', cx, room.y + room.h - 26);
    ctx.globalAlpha = 0.28 * alpha;
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('CELL BLOCK // CONTAINMENT', cx, room.y + room.h - 12);
  }

  /** Painted wave-2 silhouettes behind the sealed cell bars. */
  private drawHoldingCagedThreats(layout: HoldingCellLayout, t: number, alpha: number): void {
    const ctx = this.ctx;
    ctx.save();
    // Worm: a short red chain with a dark eye, moving just enough to read as alive.
    const wx = layout.left + layout.cellW * 0.5;
    const wy = layout.top + 58;
    ctx.globalAlpha = 0.9 * alpha;
    ctx.fillStyle = THREAT_COLORS.worm;
    ctx.strokeStyle = 'rgba(17, 9, 12, 0.9)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const s = i === 0 ? 10 : 8 - i * 0.4;
      const x = wx + Math.sin(t * 1.8 + i * 0.65) * 2.5 - i * 1.5;
      const y = wy + i * 8 - 8;
      ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s);
      ctx.strokeRect(x - s * 0.5, y - s * 0.5, s, s);
    }
    ctx.fillStyle = '#241217';
    ctx.fillRect(wx - 3, wy - 10, 2, 2);
    ctx.fillRect(wx + 1, wy - 10, 2, 2);

    // Viruses: a pair of magenta diamonds in the right cell.
    const vx = layout.left + layout.cellW * 2.5;
    const vy = layout.top + 59;
    ctx.strokeStyle = 'rgba(34, 8, 30, 0.9)';
    for (let i = 0; i < 2; i++) {
      const x = vx + (i === 0 ? -15 : 15) + Math.sin(t * 1.5 + i * 2.1) * 2.5;
      const y = vy + (i === 0 ? -2 : 12) + Math.cos(t * 1.2 + i) * 2;
      const r = i === 0 ? 7 : 6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 1.2 + i * 0.9);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.72, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.72, 0);
      ctx.closePath();
      ctx.fillStyle = THREAT_COLORS.virus;
      ctx.globalAlpha = 0.9 * alpha;
      ctx.fill();
      ctx.globalAlpha = 0.65 * alpha;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /** Mainboard floor: copper traces, chip pads and a board stencil. */
  private drawBoardRoom(arena: ArenaDef, room: ArenaRoomDef, alpha: number): void {
    const ctx = this.ctx;
    const theme = ROOM_THEME_COLORS.board;
    const lanes = [0.18, 0.32, 0.68, 0.82];

    ctx.globalAlpha = 0.3 * alpha;
    ctx.strokeStyle = '#d58a4a';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < lanes.length; i++) {
      const y = room.y + room.h * lanes[i];
      const bend = i < 2 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(room.x + 14, y);
      ctx.lineTo(room.x + room.w * 0.28, y);
      ctx.lineTo(room.x + room.w * 0.28 + 26, y + bend * 24);
      ctx.lineTo(room.x + room.w - 14, y + bend * 24);
      ctx.stroke();
      // A via at each end and one at the bend.
      ctx.beginPath();
      ctx.arc(room.x + room.w * 0.28, y, 3, 0, TWO_PI);
      ctx.stroke();
    }

    // Pad rings sit outside the chip pillars so cover reads as a component.
    ctx.globalAlpha = 0.4 * alpha;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.3;
    for (let i = 0; i < arena.pillars.length; i++) {
      const p = arena.pillars[i];
      if (p.x < room.x || p.y < room.y || p.x + p.w > room.x + room.w || p.y + p.h > room.y + room.h) continue;
      ctx.strokeRect(p.x - 8, p.y - 8, p.w + 16, p.h + 16);
      ctx.beginPath();
      for (let tx = p.x - 4; tx <= p.x + p.w + 4; tx += 12) {
        ctx.moveTo(tx, p.y - 12);
        ctx.lineTo(tx, p.y - 8);
        ctx.moveTo(tx, p.y + p.h + 8);
        ctx.lineTo(tx, p.y + p.h + 12);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 0.14 * alpha;
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 26px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('MAINBOARD', room.x + room.w * 0.5, room.y + room.h * 0.5 + 9);
    ctx.globalAlpha = 0.3 * alpha;
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('BUS 02 // DATA PLANE', room.x + room.w * 0.5, room.y + room.h * 0.5 + 28);
  }

  /** Router floor: port banks, blinking link LEDs and an antenna arc. */
  private drawRouterRoom(room: ArenaRoomDef, t: number, alpha: number): void {
    const ctx = this.ctx;
    const theme = ROOM_THEME_COLORS.router;
    const cols = 10;

    ctx.globalAlpha = 0.5 * alpha;
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    for (let row = 0; row < 2; row++) {
      const py = row === 0 ? room.y + 20 : room.y + room.h - 34;
      for (let i = 0; i < cols; i++) {
        const px = room.x + 24 + i * 42;
        ctx.fillStyle = 'rgba(3, 7, 12, 0.9)';
        ctx.fillRect(px, py, 26, 14);
        ctx.globalAlpha = 0.42 * alpha;
        ctx.strokeRect(px + 0.5, py + 0.5, 25, 13);
        const lit = Math.sin(t * 2.4 + i * 0.9 + row * 1.7) > 0.2;
        ctx.globalAlpha = (lit ? 0.95 : 0.18) * alpha;
        ctx.fillStyle = lit ? '#7dffcf' : '#3b7f76';
        ctx.fillRect(px + 3, py + 3, 3, 3);
        ctx.globalAlpha = 0.5 * alpha;
      }
    }

    // Antenna sweep in the upper-right corner. It is only a place signal; no gameplay.
    ctx.globalAlpha = 0.22 * alpha;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(room.x + room.w - 58, room.y + 58, 24 + i * 18, -1.25, 0.45);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.14 * alpha;
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 26px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('ROUTER', room.x + room.w * 0.5, room.y + room.h * 0.5 + 9);
    ctx.globalAlpha = 0.3 * alpha;
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('PORT 03 // UPLINK', room.x + room.w * 0.5, room.y + room.h * 0.5 + 28);
  }

  /**
   * A 1968 mission-control floor: a bank of CRT stations along the back, a plotting board
   * with a live trajectory, and a mission clock. The department name comes from the room
   * label, so a new console department is a data entry, not a new draw function.
   */
  private drawConsoleRoom(room: ArenaRoomDef, t: number, alpha: number): void {
    const ctx = this.ctx;
    const theme = ROOM_THEME_COLORS.console;
    const cx = room.x + room.w * 0.5;

    // Console bank along the top edge. Each station is a housing, a CRT trace and knobs.
    const count = 5;
    const bankW = Math.min(room.w - 80, 620);
    const bankX = cx - bankW * 0.5;
    const screenW = bankW / count;
    for (let i = 0; i < count; i++) {
      const sx = bankX + i * screenW;
      const sy = room.y + 22;
      ctx.globalAlpha = 0.6 * alpha;
      ctx.fillStyle = 'rgba(8, 14, 12, 0.9)';
      ctx.fillRect(sx + 6, sy, screenW - 12, 74);
      ctx.globalAlpha = 0.5 * alpha;
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 6.5, sy + 0.5, screenW - 13, 73);
      // CRT face with a phosphor trace that drifts on its own phase.
      ctx.globalAlpha = 0.75 * alpha;
      ctx.fillStyle = '#04160f';
      ctx.fillRect(sx + 12, sy + 6, Math.max(4, screenW - 24), 40);
      ctx.globalAlpha = 0.5 * alpha;
      ctx.strokeStyle = theme.accent;
      ctx.beginPath();
      for (let k = 0; k <= 18; k++) {
        const px = sx + 14 + ((screenW - 28) * k) / 18;
        const py = sy + 26 - Math.sin(t * (1.1 + i * 0.17) + k * 0.55 + i) * 9;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // Knobs and a paper strip.
      ctx.globalAlpha = 0.4 * alpha;
      ctx.fillStyle = theme.accent;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(sx + 18 + k * 14, sy + 60, 3, 0, TWO_PI);
        ctx.fill();
      }
      ctx.globalAlpha = 0.22 * alpha;
      ctx.fillStyle = '#e8f6ee';
      ctx.fillRect(sx + screenW * 0.55, sy + 56, Math.max(6, screenW * 0.3), 10);
    }

    // Plotting board: a grid, a rising trajectory and a marker at the live point.
    const boardW = Math.min(260, room.w * 0.32);
    const boardX = room.x + room.w - boardW - 24;
    const boardY = room.y + 118;
    const boardH = Math.min(150, room.h * 0.4);
    ctx.globalAlpha = 0.5 * alpha;
    ctx.fillStyle = 'rgba(6, 20, 14, 0.85)';
    ctx.fillRect(boardX, boardY, boardW, boardH);
    ctx.globalAlpha = 0.32 * alpha;
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(boardX + 0.5, boardY + 0.5, boardW - 1, boardH - 1);
    ctx.beginPath();
    for (let gx = boardX + 16; gx < boardX + boardW - 8; gx += 24) {
      ctx.moveTo(gx + 0.5, boardY + 6);
      ctx.lineTo(gx + 0.5, boardY + boardH - 6);
    }
    for (let gy = boardY + 16; gy < boardY + boardH - 8; gy += 24) {
      ctx.moveTo(boardX + 6, gy + 0.5);
      ctx.lineTo(boardX + boardW - 6, gy + 0.5);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.75 * alpha;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) {
      const u = k / 20;
      const px = boardX + 18 + (boardW - 36) * u;
      const py = boardY + boardH - 18 - (boardH - 42) * Math.sin(u * Math.PI * 0.62);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    const live = (t * 0.22) % 1;
    const mx = boardX + 18 + (boardW - 36) * live;
    const my = boardY + boardH - 18 - (boardH - 42) * Math.sin(live * Math.PI * 0.62);
    ctx.globalAlpha = 0.9 * alpha;
    ctx.fillStyle = '#ffd27a';
    ctx.fillRect(mx - 2.5, my - 2.5, 5, 5);

    // Mission clock under the board.
    const secs = Math.floor(t) % 60;
    const mins = Math.floor(t / 60) % 60;
    ctx.globalAlpha = 0.36 * alpha;
    ctx.fillStyle = theme.accent;
    ctx.font = '700 20px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      `T+${mins > 9 ? '' : '0'}${mins}:${secs > 9 ? '' : '0'}${secs}`,
      boardX + boardW * 0.5,
      boardY + boardH + 26,
    );

    // Department stencil, low contrast so it never competes with the plate label.
    ctx.globalAlpha = 0.16 * alpha;
    ctx.font = '700 24px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(room.label.split(' ')[0], cx, room.y + room.h - 24);
  }

  /** The final uplink. It is a wall fixture until the campaign exit is scripted. */
  private drawArenaPort(arena: ArenaDef, t: number, alpha: number): void {
    const port = arena.port;
    if (!port) return;
    const ctx = this.ctx;
    const cx = port.x;
    const cy = port.y;
    const r = port.radius;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#040a10';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 12, 0, TWO_PI);
    ctx.fill();
    ctx.globalAlpha = 0.3 * alpha;
    ctx.strokeStyle = '#66c8ff';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.5 * alpha;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.68, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Three chevrons pointing out, so the port has a direction even without UI.
    ctx.globalAlpha = 0.9 * alpha;
    ctx.strokeStyle = '#d8fbff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = cx - 18 + i * 15;
      ctx.moveTo(x, cy - 9);
      ctx.lineTo(x + 9, cy);
      ctx.lineTo(x, cy + 9);
    }
    ctx.stroke();

    const pulse = 0.5 + Math.sin(t * 2.2) * 0.2;
    ctx.globalAlpha = pulse * alpha;
    ctx.fillStyle = '#a8f4ff';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, TWO_PI);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#66c8ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(port.label, cx, cy - r - 24);
    ctx.globalAlpha = 0.64 * alpha;
    ctx.fillStyle = '#dff7ff';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(port.sub, cx, cy - r - 10);
    ctx.restore();
  }

  /** Ordinary program monitors, painted before cover so a desk can occlude one. */
  private drawRegularPrograms(_arena: ArenaDef, t: number, alpha: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < this.civilians.length; i++) {
      const a = this.civilians[i];
      if (a.dropT > 0 && a.dropCount > 0) {
        const fade = Math.min(1, a.dropT / 0.5);
        drawDroppedFiles(ctx, a.dropX, a.dropY, t, alpha * fade, a.dropCount, a.phase);
      }
      if (a.gone) continue;
      drawRegularProgram(ctx, a.def, a.x, a.y, t, a.scale, alpha, a.phase, regularFace(a.def, a.mood), a.carry);
    }
  }

  /** Rebuild civilian actors only when the arena changes, never per tick. */
  private syncCivilians(arena: ArenaDef): void {
    if (arena.id === this.civilianArenaId) return;
    this.civilianArenaId = arena.id;
    this.civilians.length = 0;
    const regulars = arena.regulars;
    if (!regulars) return;
    for (let i = 0; i < regulars.length; i++) {
      const p = regulars[i];
      const mood = p.mood ?? 'calm';
      this.civilians.push({
        def: regularProgram(p.id),
        homeX: p.x,
        homeY: p.y,
        x: p.x,
        y: p.y,
        scale: p.scale ?? 1,
        phase: p.phase ?? i * 1.37,
        baseMood: mood,
        mood,
        carry: Math.max(0, Math.min(3, p.carry ?? 0)),
        fleeing: false,
        gone: false,
        exitX: p.x,
        exitY: p.y,
        exitLeaves: false,
        dropT: 0,
        dropX: p.x,
        dropY: p.y,
        dropCount: 0,
      });
    }
  }

  /**
   * Presentation-only civilian reaction. A nearby hostile makes an ordinary program
   * drop its files and head for the port, a pad/lift, or a room farther from the
   * threat. Nothing here changes collision, health, AI or the snapshot.
   */
  private updateCivilians(state: RenderState, dt: number): void {
    this.syncCivilians(state.arena);
    if (this.civilians.length === 0) return;
    const lost = state.campaignCiviliansLost === true;
    for (let i = 0; i < this.civilians.length; i++) {
      const a = this.civilians[i];
      if (a.dropT > 0) a.dropT = Math.max(0, a.dropT - dt);
      if (lost) {
        if (!a.gone) {
          a.gone = true;
          if (a.dropCount === 0) a.dropCount = a.carry;
          if (a.dropCount > 0) {
            a.dropX = a.x;
            a.dropY = a.y;
            a.dropT = CIVILIAN_DROP_LIFE;
          }
          a.carry = 0;
        }
        continue;
      }
      if (a.gone) continue;
      if (this.findCivilianThreat(state, a.x, a.y)) {
        if (!a.fleeing) {
          a.fleeing = true;
          a.mood = 'scared';
          if (a.carry > 0) {
            a.dropCount = a.carry;
            a.dropX = a.x;
            a.dropY = a.y;
            a.dropT = CIVILIAN_DROP_LIFE;
            a.carry = 0;
          }
          this.pickCivilianExit(state.arena, a.x, a.y);
          a.exitX = this.civilianExitX;
          a.exitY = this.civilianExitY;
          a.exitLeaves = this.civilianExitLeaves;
        }
        const dx = a.exitX - a.x;
        const dy = a.exitY - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= CIVILIAN_EXIT_RADIUS) {
          if (a.exitLeaves) a.gone = true;
          else {
            a.fleeing = false;
            a.homeX = a.exitX;
            a.homeY = a.exitY;
            a.mood = 'calm';
          }
          continue;
        }
        const step = Math.min(dist, CIVILIAN_FLEE_SPEED * dt);
        a.x += (dx / dist) * step;
        a.y += (dy / dist) * step;
      } else if (!a.fleeing) {
        a.mood = a.baseMood;
        const k = 1 - Math.exp(-2.8 * dt);
        a.x += (a.homeX - a.x) * k;
        a.y += (a.homeY - a.y) * k;
      }
    }
  }

  /** Finds the nearest live hostile within the civilian fear radius. */
  private findCivilianThreat(state: RenderState, x: number, y: number): boolean {
    let best = CIVILIAN_FLEE_RADIUS * CIVILIAN_FLEE_RADIUS;
    let bx = 0;
    let by = 0;
    let found = false;
    const worms = state.worms;
    if (worms) {
      for (let i = 0; i < worms.length; i++) {
        const w = worms[i];
        if (!w.active) continue;
        const dx = w.x - x;
        const dy = w.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < best) {
          best = d2;
          bx = w.x;
          by = w.y;
          found = true;
        }
      }
    }
    const viruses = state.viruses;
    if (viruses) {
      for (let i = 0; i < viruses.length; i++) {
        const v = viruses[i];
        if (!v.active) continue;
        const dx = v.x - x;
        const dy = v.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < best) {
          best = d2;
          bx = v.x;
          by = v.y;
          found = true;
        }
      }
    }
    const errors = state.errors;
    if (errors) {
      for (let i = 0; i < errors.length; i++) {
        const e = errors[i];
        if (!e.active) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < best) {
          best = d2;
          bx = e.x;
          by = e.y;
          found = true;
        }
      }
    }
    const sentries = state.sentries;
    if (sentries) {
      for (let i = 0; i < sentries.length; i++) {
        const s = sentries[i];
        if (!s.active) continue;
        // Dormant calibration subjects are set dressing, not a reason to flee.
        if (s.kind >= 4 && s.kind <= 6 && s.shapeState === 0) continue;
        const dx = s.x - x;
        const dy = s.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < best) {
          best = d2;
          bx = s.x;
          by = s.y;
          found = true;
        }
      }
    }
    this.civilianThreatX = bx;
    this.civilianThreatY = by;
    return found;
  }

  /** Picks the nearest authored escape route, or the room farthest from the threat. */
  private pickCivilianExit(arena: ArenaDef, x: number, y: number): void {
    const port = arena.port;
    if (port) {
      this.civilianExitX = port.x;
      this.civilianExitY = port.y;
      this.civilianExitLeaves = true;
      return;
    }
    const traverse = arena.traverse;
    if (traverse && traverse.pads.length > 0) {
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < traverse.pads.length; i++) {
        const p = traverse.pads[i];
        const dx = p.x - x;
        const dy = p.y - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best >= 0) {
        this.civilianExitX = traverse.pads[best].x;
        this.civilianExitY = traverse.pads[best].y;
        this.civilianExitLeaves = true;
        return;
      }
    }
    if (traverse && traverse.lifts.length > 0) {
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < traverse.lifts.length; i++) {
        const p = traverse.lifts[i];
        const dx = p.x - x;
        const dy = p.y - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best >= 0) {
        this.civilianExitX = traverse.lifts[best].x;
        this.civilianExitY = traverse.lifts[best].y;
        this.civilianExitLeaves = true;
        return;
      }
    }
    const rooms = arena.rooms;
    if (rooms && rooms.length > 0) {
      let best = 0;
      let bestScore = -1;
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const dx = room.x + room.w * 0.5 - this.civilianThreatX;
        const dy = room.y + room.h * 0.5 - this.civilianThreatY;
        const score = dx * dx + dy * dy;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      const room = rooms[best];
      this.civilianExitX = room.x + room.w * 0.5;
      this.civilianExitY = room.y + room.h * 0.5;
      this.civilianExitLeaves = false;
      return;
    }
    const b = arena.bounds;
    this.civilianExitX = x < (b.left + b.right) * 0.5 ? b.right - 24 : b.left + 24;
    this.civilianExitY = y < (b.top + b.bottom) * 0.5 ? b.bottom - 24 : b.top + 24;
    this.civilianExitLeaves = true;
  }

  /**
   * Multi-deck floor content. The chasms are drawn as open holes, the bridge as a solid
   * deck over one, and the pads and lift plates as the two shortcuts across.
   */
  private drawTraversal(arena: ArenaDef, t: number, alpha: number): void {
    const tr = arena.traverse;
    if (!tr) return;
    const ctx = this.ctx;

    // Raised deck: a lighter plate and a hard lip where it overlooks the trench.
    for (let i = 0; i < tr.upperDecks.length; i++) {
      const r = tr.upperDecks[i];
      ctx.save();
      ctx.globalAlpha = 0.055 * alpha;
      ctx.fillStyle = '#9ad4ff';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = arena.accentSoft;
      ctx.globalAlpha = 0.6 * alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + r.h);
      ctx.lineTo(r.x + r.w, r.y + r.h);
      ctx.stroke();
      ctx.globalAlpha = 0.2 * alpha;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = r.x + 18; x < r.x + r.w - 12; x += 46) {
        ctx.moveTo(x, r.y + r.h - 11);
        ctx.lineTo(x + 18, r.y + r.h - 11);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Trench: no floor, a recessed lip, nothing else. The avatar falls between decks
    // only through the pads and lift; walking off is blocked by the body collision.
    for (let i = 0; i < tr.chasms.length; i++) {
      const r = tr.chasms[i];
      ctx.save();
      ctx.fillStyle = '#02050a';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 0.45 * alpha;
      ctx.strokeStyle = arena.accentSoft;
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.globalAlpha = 0.38 * alpha;
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + 1);
      ctx.lineTo(r.x + r.w, r.y + 1);
      ctx.moveTo(r.x, r.y + r.h - 1);
      ctx.lineTo(r.x + r.w, r.y + r.h - 1);
      ctx.stroke();
      ctx.restore();
    }

    // Bridge: a solid plate with rails and ticks crawling toward the far deck.
    for (let i = 0; i < tr.bridges.length; i++) {
      const r = tr.bridges[i];
      const vertical = r.h >= r.w;
      ctx.save();
      ctx.fillStyle = 'rgba(9, 22, 35, 0.96)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(150, 212, 255, 0.05)';
      if (vertical) ctx.fillRect(r.x + 16, r.y, Math.max(0, r.w - 32), r.h);
      else ctx.fillRect(r.x, r.y + 16, r.w, Math.max(0, r.h - 32));
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.72 * alpha;
      ctx.beginPath();
      if (vertical) {
        ctx.moveTo(r.x + 1.5, r.y);
        ctx.lineTo(r.x + 1.5, r.y + r.h);
        ctx.moveTo(r.x + r.w - 1.5, r.y);
        ctx.lineTo(r.x + r.w - 1.5, r.y + r.h);
      } else {
        ctx.moveTo(r.x, r.y + 1.5);
        ctx.lineTo(r.x + r.w, r.y + 1.5);
        ctx.moveTo(r.x, r.y + r.h - 1.5);
        ctx.lineTo(r.x + r.w, r.y + r.h - 1.5);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.22 * alpha;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (vertical) {
        for (let y = r.y + 14; y < r.y + r.h - 8; y += 22) {
          ctx.moveTo(r.x + 10, y);
          ctx.lineTo(r.x + r.w - 10, y);
        }
      } else {
        for (let x = r.x + 14; x < r.x + r.w - 8; x += 22) {
          ctx.moveTo(x, r.y + 10);
          ctx.lineTo(x, r.y + r.h - 10);
        }
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6 * alpha;
      ctx.fillStyle = arena.accent;
      if (vertical) {
        const off = (t * 34) % 26;
        for (let y = r.y + 14 + off; y < r.y + r.h - 14; y += 26) {
          ctx.fillRect(r.x + r.w * 0.5 - 9, y, 18, 2.6);
        }
      } else {
        const off = (t * 34) % 26;
        for (let x = r.x + 14 + off; x < r.x + r.w - 14; x += 26) {
          ctx.fillRect(x, r.y + r.h * 0.5 - 5, 2.6, 18);
        }
      }
      ctx.restore();
    }

    // Paired teleporter plates. The centre arrow points at the mate, so two plates
    // with the same mark are a route even before the first ride.
    for (let i = 0; i < tr.pads.length; i++) {
      const pad = tr.pads[i];
      let mate = -1;
      for (let k = 0; k < tr.pads.length; k++) {
        if (k !== i && tr.pads[k].pair === pad.pair) {
          mate = k;
          break;
        }
      }
      const pulse = 0.58 + 0.42 * Math.sin(t * 2.2 + i * 1.7);
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.strokeStyle = arena.accent;
      ctx.globalAlpha = (0.3 + pulse * 0.34) * alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, pad.radius, 0, TWO_PI);
      ctx.stroke();
      ctx.globalAlpha = (0.14 + pulse * 0.16) * alpha;
      ctx.beginPath();
      ctx.arc(0, 0, pad.radius - 9, 0, TWO_PI);
      ctx.stroke();
      ctx.globalAlpha = (0.28 + pulse * 0.34) * alpha;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TWO_PI;
        ctx.moveTo(Math.cos(a) * (pad.radius - 17), Math.sin(a) * (pad.radius - 17));
        ctx.lineTo(Math.cos(a) * (pad.radius - 9), Math.sin(a) * (pad.radius - 9));
      }
      ctx.stroke();
      if (mate >= 0) {
        const angle = Math.atan2(tr.pads[mate].y - pad.y, tr.pads[mate].x - pad.x);
        ctx.rotate(angle);
        ctx.fillStyle = arena.accent;
        ctx.globalAlpha = (0.5 + pulse * 0.35) * alpha;
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(-4, -6);
        ctx.lineTo(-4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.35 * alpha;
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(-15, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Lift plates. Chevrons climb toward the linked deck so the two ends read as one shaft.
    for (let i = 0; i < tr.lifts.length; i++) {
      const lift = tr.lifts[i];
      const dest = tr.lifts[lift.link];
      const dir = dest && dest.y < lift.y ? -1 : 1;
      ctx.save();
      ctx.translate(lift.x, lift.y);
      ctx.fillStyle = 'rgba(9, 22, 35, 0.86)';
      ctx.beginPath();
      ctx.arc(0, 0, lift.radius, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = arena.accent;
      ctx.globalAlpha = 0.55 * alpha;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.globalAlpha = 0.2 * alpha;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, lift.radius - 9, 0, TWO_PI);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 2.4;
      for (let k = 0; k < 3; k++) {
        const phase = (t * 0.7 + k / 3) % 1;
        const yy = dir * ((1 - phase) * 22 - 8);
        ctx.globalAlpha = (0.18 + 0.3 * Math.sin(phase * Math.PI)) * alpha;
        ctx.beginPath();
        ctx.moveTo(-12, yy - dir * 6);
        ctx.lineTo(0, yy + dir * 4);
        ctx.lineTo(12, yy - dir * 6);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawArenaSignature(arena: ArenaDef, t: number, alpha = 1): void {
    const ctx = this.ctx;
    const b = arena.bounds;
    const cx = (b.left + b.right) * 0.5;
    const cy = (b.top + b.bottom) * 0.5;
    ctx.save();
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = (0.1 + Math.sin(t * 0.55) * 0.025) * alpha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (arena.signature === 0) {
      ctx.moveTo(cx - 120, cy - 120);
      ctx.lineTo(cx + 120, cy + 120);
      ctx.moveTo(cx + 120, cy - 120);
      ctx.lineTo(cx - 120, cy + 120);
      ctx.moveTo(cx, cy - 26);
      ctx.lineTo(cx + 26, cy);
      ctx.lineTo(cx, cy + 26);
      ctx.lineTo(cx - 26, cy);
      ctx.closePath();
    } else if (arena.signature === 1) {
      ctx.rect(cx - 86, cy - 86, 172, 172);
      for (let i = 0; i < 4; i++) {
        const x = cx + (i < 2 ? -86 : 86);
        const y = cy + (i % 2 === 0 ? -86 : 86);
        ctx.moveTo(x, y - 14);
        ctx.lineTo(x, y + 14);
        ctx.moveTo(x - 14, y);
        ctx.lineTo(x + 14, y);
      }
    } else if (arena.signature === 2) {
      ctx.arc(cx, cy, 96, 0, TWO_PI);
      ctx.moveTo(cx + 148, cy);
      ctx.arc(cx, cy, 148, 0, TWO_PI);
    } else {
      for (let i = 0; i < 3; i++) {
        const y = cy - 60 + i * 60;
        ctx.moveTo(cx - 120, y);
        ctx.lineTo(cx, y + 34);
        ctx.lineTo(cx + 120, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  private beamBlocked(arena: ArenaDef, axis: number, pos: number, along: number): boolean {
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      if (axis === 0) {
        if (pos > r.x && pos < r.x + r.w && along > r.y && along < r.y + r.h) return true;
      } else if (pos > r.y && pos < r.y + r.h && along > r.x && along < r.x + r.w) {
        return true;
      }
    }
    return false;
  }

  /** Sweeping line beam. Pillars cut the visible line exactly where they cut damage. */
  private drawFirewalls(firewalls: readonly Firewall[], arena: ArenaDef, alpha: number, t: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < firewalls.length; i++) {
      const f = firewalls[i];
      if (!f.active) continue;
      const pos = lerp(f.prevPos, f.pos, alpha);
      const start = f.axis === 0 ? arena.bounds.top : arena.bounds.left;
      const end = f.axis === 0 ? arena.bounds.bottom : arena.bounds.right;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = THREAT_COLORS.firewall;
      ctx.lineCap = 'butt';

      if (f.warnT > 0) {
        const blink = 0.45 + 0.55 * Math.abs(Math.sin(t * 16 + i));
        ctx.globalAlpha = 0.12 * blink;
        ctx.lineWidth = FIREWALL.width + 12;
        ctx.beginPath();
        if (f.axis === 0) {
          ctx.moveTo(pos, start);
          ctx.lineTo(pos, end);
        } else {
          ctx.moveTo(start, pos);
          ctx.lineTo(end, pos);
        }
        ctx.stroke();
        ctx.globalAlpha = 0.75 * blink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let along = start; along < end; along += 34) {
          const a2 = Math.min(end, along + 14);
          if (f.axis === 0) {
            ctx.moveTo(pos, along);
            ctx.lineTo(pos, a2);
          } else {
            ctx.moveTo(along, pos);
            ctx.lineTo(a2, pos);
          }
        }
        ctx.stroke();
        // Edge markers show which way the line is about to sweep.
        const edge = f.axis === 0
          ? f.dir > 0 ? arena.bounds.left + 8 : arena.bounds.right - 8
          : f.dir > 0 ? arena.bounds.top + 8 : arena.bounds.bottom - 8;
        ctx.globalAlpha = 0.9 * blink;
        ctx.fillStyle = THREAT_COLORS.firewall;
        const center = f.axis === 0
          ? (arena.bounds.top + arena.bounds.bottom) * 0.5
          : (arena.bounds.left + arena.bounds.right) * 0.5;
        if (f.axis === 0) ctx.fillRect(edge - 4, center - 18, 8, 36);
        else ctx.fillRect(center - 18, edge - 4, 36, 8);
        ctx.restore();
        continue;
      }

      const pulse = 0.62 + 0.28 * Math.sin(t * 22 + i * 2.1);
      ctx.beginPath();
      let drawing = false;
      for (let along = start; along <= end; along += 6) {
        const blocked = this.beamBlocked(arena, f.axis, f.pos, along);
        if (!blocked) {
          if (!drawing) {
            if (f.axis === 0) ctx.moveTo(pos, along);
            else ctx.moveTo(along, pos);
            drawing = true;
          }
        } else if (drawing) {
          if (f.axis === 0) ctx.lineTo(pos, along - 6);
          else ctx.lineTo(along - 6, pos);
          drawing = false;
        }
      }
      if (drawing) {
        if (f.axis === 0) ctx.lineTo(pos, end);
        else ctx.lineTo(end, pos);
      }
      ctx.globalAlpha = 0.1 * pulse;
      ctx.lineWidth = FIREWALL.width + 14;
      ctx.stroke();
      ctx.globalAlpha = 0.4 * pulse;
      ctx.lineWidth = FIREWALL.width;
      ctx.stroke();
      ctx.globalAlpha = 0.55 * pulse;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#fff3d6';
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Shared lunge telegraph for a virus or a small sentry. A dashed guide is the tell;
   * the live beat is a hot streak. Only active attacks reach this helper.
   */
  private drawLungeWarn(
    x: number,
    y: number,
    radius: number,
    dirX: number,
    dirY: number,
    elapsed: number,
    windup: number,
    active: number,
    color: string,
  ): void {
    if (elapsed >= windup + active) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(dirY, dirX));
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    if (elapsed < windup) {
      const t = Math.max(0, Math.min(1, elapsed / windup));
      ctx.globalAlpha = 0.32 + 0.38 * t;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(radius + 2, 0);
      ctx.lineTo(radius + 46, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      const tip = radius + 50;
      ctx.beginPath();
      ctx.moveTo(tip - 8, -6);
      ctx.lineTo(tip, 0);
      ctx.lineTo(tip - 8, 6);
      ctx.stroke();
      ctx.globalAlpha = 0.2 + 0.35 * t;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 7 + t * 3, -0.92, 0.92);
      ctx.stroke();
      ctx.globalAlpha = 0.05 + 0.1 * t;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(radius + 46, -10);
      ctx.lineTo(radius + 46, 10);
      ctx.closePath();
      ctx.fill();
    } else {
      const t = Math.max(0, Math.min(1, (elapsed - windup) / active));
      ctx.globalAlpha = 0.7 * (1 - t * 0.55);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-radius - 20, 0);
      ctx.lineTo(radius + 42, 0);
      ctx.stroke();
      ctx.globalAlpha *= 0.35;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.globalAlpha = 0.9 * (1 - t * 0.5);
      ctx.beginPath();
      ctx.arc(radius + 35, 0, 3.5, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawWorms(worms: readonly Worm[], alpha: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < worms.length; i++) {
      const w = worms[i];
      if (!w.active || w.held) continue;
      // `mega` is the body shape; a future mini-boss branches on `bossKind` here.
      if (w.bossKind === MINIBOSS.IDLE_HANDS) {
        this.drawIdleHand(w, alpha, t);
        continue;
      }
      if (w.bossKind === MINIBOSS.STARFISH) {
        if (w.armState) {
          if (!w.armState.attached) this.drawStarfishArm(w, alpha, t);
        } else {
          this.drawStarfish(w, alpha, t);
        }
        continue;
      }
      if (w.bossKind === MINIBOSS.BLOB) {
        this.drawBlob(w, alpha, t);
        continue;
      }
      if (w.bossKind === MINIBOSS.STORM_CLOUD) {
        this.drawStormCloud(w, alpha, t);
        continue;
      }
      if (w.mega) {
        this.drawMegaWorm(w, alpha, t);
        continue;
      }
      const base = w.infected ? THREAT_COLORS.virus : THREAT_COLORS.worm;
      const build = w.spawnT > 0 ? 1 - w.spawnT / WORM.spawnTime : 1;
      const builtSegments = 1 + Math.floor(build * w.segCount);

      for (let s = w.segCount - 1; s >= 0; s--) {
        if (s >= builtSegments) continue;
        const x = lerp(w.segPrevX[s], w.segX[s], alpha);
        const y = lerp(w.segPrevY[s], w.segY[s], alpha);
        // Compress leaves the chain smaller, so every segment and the head share one
        // body scale instead of only the jaw shrinking.
        const size = (10.5 - s * 0.22) * w.shrink;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(w.segAngle[s] + Math.PI * 0.25);
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = base;
        ctx.fillRect(-size - 3, -size - 3, size * 2 + 6, size * 2 + 6);
        ctx.globalAlpha = 0.72;
        ctx.fillRect(-size, -size, size * 2, size * 2);
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = base;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(-size, -size, size * 2, size * 2);
        ctx.globalAlpha = 0.9;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#12040a';
        ctx.fillRect(-size * 0.46, -size * 0.46, size * 0.92, size * 0.92);
        ctx.restore();
      }

      const hx = lerp(w.prevX, w.x, alpha);
      const hy = lerp(w.prevY, w.y, alpha);
      ctx.save();
      if (build < 1) {
        // Temporary assembly cage: the head is already here, the chain is still compiling.
        for (let k = 0; k < 4; k++) {
          const a = build * 7 + k * (Math.PI / 2);
          ctx.globalAlpha = (1 - build) * 0.55;
          ctx.strokeStyle = base;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(hx, hy, (WORM.headRadius + 14 + k * 4) * w.shrink, a, a + 0.5);
          ctx.stroke();
        }
      }
      ctx.translate(hx, hy);
      ctx.rotate(w.angle + Math.PI * 0.25);
      ctx.scale(0.45 + 0.55 * build, 0.45 + 0.55 * build);
      const r = WORM.headRadius * w.shrink;
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = base;
      ctx.fillRect(-r - 7, -r - 7, r * 2 + 14, r * 2 + 14);
      ctx.globalAlpha = 0.92;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = base;
      ctx.lineWidth = 2;
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      ctx.globalAlpha = 0.85;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#14030a';
      ctx.fillRect(-r * 0.56, -r * 0.56, r * 1.12, r * 1.12);
      ctx.fillStyle = '#ffe9e4';
      ctx.fillRect(-r * 0.44, -r * 0.2, r * 0.3, r * 0.3);
      ctx.fillRect(r * 0.14, -r * 0.2, r * 0.3, r * 0.3);
      if (w.infected) {
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 12 + w.phase);
        ctx.strokeStyle = THREAT_COLORS.virus;
        ctx.lineWidth = 1.4;
        ctx.rotate(t * 2.4);
        ctx.strokeRect(-r - 5, -r - 5, r * 2 + 10, r * 2 + 10);
      }
      if (w.hitFlash > 0) {
        ctx.globalAlpha = Math.min(0.9, w.hitFlash * 5);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-r - 3, -r - 3, r * 2 + 6, r * 2 + 6);
      }
      ctx.restore();

      // Bite jaws are drawn in world space on the committed direction, not on the
      // body's heading. The wind-up opens them; the live beat snaps them shut.
      if (w.biteT > 0) {
        const biteTotal = WORM.biteWindup + WORM.biteActive + WORM.biteRecovery;
        const biteElapsed = biteTotal - w.biteT;
        if (biteElapsed < WORM.biteWindup + WORM.biteActive) {
          const wind = Math.max(0, Math.min(1, biteElapsed / WORM.biteWindup));
          const snapping = biteElapsed >= WORM.biteWindup;
          const open = snapping
            ? Math.max(0, 1 - (biteElapsed - WORM.biteWindup) / WORM.biteActive)
            : 0.4 + 0.6 * wind;
          const reach = r + 6 + (snapping ? 10 : 8 + 10 * wind);
          const spread = snapping ? 2 + 2 * open : 8 + 10 * open;
          ctx.save();
          ctx.translate(hx, hy);
          ctx.rotate(Math.atan2(w.biteDirY, w.biteDirX));
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = base;
          ctx.fillStyle = base;
          ctx.lineWidth = snapping ? 2.6 : 1.8;
          ctx.globalAlpha = snapping ? 0.95 : 0.45 + 0.35 * wind;
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.45);
          ctx.lineTo(reach, -spread);
          ctx.lineTo(reach * 0.58, -1);
          ctx.closePath();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, r * 0.45);
          ctx.lineTo(reach, spread);
          ctx.lineTo(reach * 0.58, 1);
          ctx.closePath();
          ctx.stroke();
          if (snapping) {
            ctx.globalAlpha = 0.75;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(r * 0.2, 0);
            ctx.lineTo(reach - 2, 0);
            ctx.stroke();
          } else {
            ctx.globalAlpha = 0.28 + 0.3 * wind;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 5]);
            ctx.beginPath();
            ctx.moveTo(r + 2, 0);
            ctx.lineTo(r + 52, 0);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.restore();
        }
      }

    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }



  /**
   * Idle Hands. The slam is the read: the hand rears up, squashes vertically and flips
   * palm-out, then grows back down through the floor onto the telegraph ring, with dust
   * on the landing frame. A charge pins the hand into a finger point and shakes before
   * it fires; a deflected hand tumbles with its eye blown wide.
   */
  private drawIdleHand(w: Worm, alpha: number, t: number): void {
    const h = w.hand;
    if (!h) return;
    const ctx = this.ctx;
    // drawWorms sets additive blending for the whole worm pool. This hand is a
    // solid glyph, so it must render source-over or its layers bloom and flash.
    // Opt out locally, then restore the pool's blend mode on exit.
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const cfg = IDLE_HANDS;
    const accent = cfg.color;
    const x = lerp(w.prevX, w.x, alpha);
    const y = lerp(w.prevY, w.y, alpha);
    const r = w.hitR;
    const slam = cfg.slam;

    let lift = 0;
    let scaleY = 1;
    let flipped = false;
    let shakeX = 0;
    let shakeY = 0;
    let point = 0;
    let spin = 0;
    let introScale = 1;
    let introY = 0;
    let introScaleX = 1;
    let introFacing = 1;
    let introRot = 0;

    if (h.state === 1) {
      const u = Math.min(1, h.t / slam.windup);
      lift = slam.riseHeight * (0.35 + 0.65 * u);
      scaleY = 1 - 0.68 * u;
      flipped = u > 0.5;
    } else if (h.state === 2) {
      const u = Math.min(1, h.t / slam.drop);
      lift = slam.riseHeight * (1 - u);
      scaleY = 0.32 + 0.68 * u;
      flipped = u < 0.45;
    } else if (h.state === 3) {
      // Flat for the hold, then the rise-out. The pressed palm is the readable
      // "hit me now" frame; do not ease it up during the hold.
      const rise = h.t - slam.hold;
      const u = rise <= 0 ? 0 : Math.min(1, rise / slam.recover);
      scaleY = rise <= 0 ? 1 : 1 + 0.18 * (1 - u) * (1 - u);
    } else if (h.state === 4) {
      point = Math.min(1, h.t / cfg.charge.windup);
      shakeX = Math.sin(t * 66) * 4.5 * point;
      shakeY = Math.cos(t * 59) * 3.5 * point;
      scaleY = 1 + 0.1 * point;
    } else if (h.state === 5) {
      point = 1;
      scaleY = 0.86;
    } else if (h.state === 6) {
      spin = t * 16;
      scaleY = 0.82;
    } else if (h.state === 7) {
      // Hand-on-hand redirect: both palms tumble away for the stun window.
      spin = h.t * 18;
      scaleY = 0.86;
    }

    if (w.spawnT > 0) {
      const u = Math.max(0, Math.min(1, 1 - w.spawnT / Math.max(0.001, IDLE_HANDS.introTime)));
      const rise = Math.min(1, u / 0.55);
      const eased = rise * rise * (3 - 2 * rise);
      introY = (1 - eased) * r * 1.8;
      const bounce = u > 0.55 ? 1 + Math.sin(((u - 0.55) / 0.45) * Math.PI) * 0.22 : 1;
      introScale = Math.max(0.12, (0.2 + 0.8 * eased) * bounce);
      // One projected yaw through the entrance: front, edge-on, back, edge-on,
      // front again. The in-plane twist keeps the turn from reading as a flat flip.
      const yaw = u * TWO_PI;
      introScaleX = Math.cos(yaw);
      introFacing = introScaleX;
      introRot = Math.sin(yaw) * 0.16;
    }

    const pointing = point > 0.45;

    // Ground shadow: three concentric layers, smaller than the old single ellipse.
    // The inner layers are more opaque, so the hand reads as hovering rather than
    // as a flat sticker. The footprint stays under the palm.
    ctx.save();
    ctx.fillStyle = '#000000';
    const shadow = Math.max(0.32, 1 - lift / (slam.riseHeight * 2.2));
    const shadowR = r * 0.66 * shadow;
    for (let layer = 0; layer < 3; layer++) {
      ctx.globalAlpha = alpha * (0.16 + layer * 0.1);
      const scale = 1 - layer * 0.28;
      ctx.beginPath();
      ctx.arc(x, y + r * 0.82, shadowR * scale, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();

    // Telegraph ring on the ground, growing through the windup and the drop.
    if (h.state === 1 || h.state === 2) {
      const u = h.state === 1 ? Math.min(1, h.t / slam.windup) : 1;
      const ring = slam.aoe * (0.35 + 0.65 * u);
      ctx.save();
      ctx.globalAlpha = (0.18 + 0.34 * u) * alpha;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(h.slamX, h.slamY, ring, 0, TWO_PI);
      ctx.stroke();
      ctx.globalAlpha = (0.05 + 0.1 * u) * alpha;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(h.slamX, h.slamY, ring, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    // Charge trail: three hand ghosts behind the palm while it is flying.
    if (h.state === 5 || h.state === 6) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = symbolFont(r * 2.1);
      const trailGlyph = pointing ? IDLE_HAND_POINT : IDLE_HAND_OPEN;
      for (let k = 3; k >= 1; k--) {
        ctx.globalAlpha = 0.1 * k * alpha;
        ctx.fillStyle = h.state === 6 ? '#ffffff' : accent;
        const bx = x - h.dirX * k * r * 0.9;
        const by = y - h.dirY * k * r * 0.9;
        ctx.fillText(trailGlyph, bx, by);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x + shakeX, y - lift + shakeY + introY);
    // The open palm stays upright; the pointing hand turns its finger along the
    // latched charge direction. The deflected state adds its own tumble.
    const aim =
      pointing && Math.hypot(h.dirX, h.dirY) > 0.001
        ? Math.atan2(h.dirY, h.dirX) + Math.PI * 0.5
        : 0;
    ctx.rotate(aim + spin + introRot);
    ctx.scale(introScale * introScaleX, introScale * (flipped ? -scaleY : scaleY));

    // The palm and its digits are one text glyph, not a stroked plate. `✋` is the
    // open palm; `☝` replaces it while the hand commits to a point. Text-presentation
    // selectors keep the mark on the monochrome symbol path where the host has it.
    const handGlyph = pointing ? IDLE_HAND_POINT : IDLE_HAND_OPEN;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = symbolFont(r * 2.45);

    // The palm is entirely red. A dark-red under-pass keeps the silhouette on the
    // grid, but no bone plate or pale palm shows through the glyph.
    // `alpha` is the fixed-step interpolation factor, not an opacity fade: it swings
    // every frame, so multiplying the palm by it strobed the whole hand at the sim
    // rate. Body fills stay opaque; only trails, shadows and rings use `alpha`.
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#5c0f18';
    ctx.fillText(handGlyph, 0, 0);

    ctx.globalAlpha = 0.96;
    ctx.fillStyle = accent;
    ctx.fillText(handGlyph, 0, 0);

    // Palm eye: fixed, unanimated, and red. The opaque black socket is drawn first
    // so the hand cannot show through the glyph's transparent counters; the red
    // eye then sits on top at full opacity. Do not add a blink or width pulse.
    // The entrance hides it on the back half so the yaw reads as front/back.
    if (introFacing > 0.05) {
      ctx.save();
      ctx.translate(0, pointing ? r * 0.2 : r * 0.06);
      // The eye is the read, but it must not grow at the same rate as the palm:
      // a 3x hand gets roughly a 2.2x eye, keeping the glyph legible instead of
      // turning the palm into one giant pupil.
      const eyeSize = Math.min(r * 0.9, 84);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(0, 0, eyeSize * 0.62, eyeSize * 0.48, 0, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.font = symbolFont(eyeSize);
      ctx.fillText(IDLE_HAND_EYE, 0, 0);
      ctx.restore();
    }

    ctx.restore();

    // Punish window: while the palm is held flat, a slow ring pulse says the body
    // is stopped and open to fire. It is a cue, not a second hit ring.
    if (h.state === 3 && h.t < slam.hold) {
      ctx.save();
      ctx.globalAlpha = (0.14 + 0.09 * Math.sin(t * 7)) * alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y + r * 0.5, slam.aoe * 0.55, 0, TWO_PI);
      ctx.stroke();
      ctx.restore();
    }

    // Landing seam: a white ring under the palm on the frame it hits.
    if (h.state === 3 && h.t < slam.recover) {
      const u = Math.min(1, h.t / (slam.recover * 0.45));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - u) * 0.7 * alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y + r * 0.5, slam.aoe * (0.3 + 0.7 * u), 0, TWO_PI);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }


  /**
   * Starfish center. Five curved arms writhe on the rim, each drawn only while its
   * mask bit is set; a missing arm leaves a stump. The mouth is a ring of teeth that
   * opens for the suck and snaps shut on the chomp.
   */
  private drawStarfish(center: Worm, alpha: number, t: number): void {
    const st = center.starfish;
    if (!st) return;
    const ctx = this.ctx;
    const cfg = STARFISH;
    const x = lerp(center.prevX, center.x, alpha);
    const y = lerp(center.prevY, center.y, alpha);
    const r = center.hitR;
    const hurt = 1 - Math.max(0, center.hp) / Math.max(1, center.maxHp);
    const body = hurt > 0.6 ? '#d9588f' : cfg.color;
    const introT = Math.max(0.001, STARFISH.introTime);
    const introRaw = center.spawnT > 0 ? Math.max(0, Math.min(1, 1 - center.spawnT / introT)) : 1;
    // Hold the body overhead for a beat, then let gravity take it. The old
    // smoothstep came down quickly and slowed into the landing, which read as a
    // soft float. A squared fall keeps the arrival heavy and gives the room time
    // to read the silhouette before it hits.
    const hang = 0.18;
    const fall = Math.max(0, (introRaw - hang) / (1 - hang));
    const fallEase = fall * fall;
    const drop = (1 - fallEase) * 620;

    ctx.save();
    // drawWorms uses additive blending for the worm pool; that makes the Starfish's
    // dark mouth and overlapping arms flash and read as holes. Keep this boss solid.
    ctx.globalCompositeOperation = 'source-over';
    if (center.spawnT > 0) {
      ctx.globalAlpha = Math.min(1, fallEase * 1.4) * 0.4 * alpha;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 18, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.translate(x, y - drop);
    // The boss body is opaque: a translucent starfish let the floor grid read through
    // its arms and the whole silhouette sank into the background.
    ctx.globalAlpha = 1;

    // Arms. Each is a tapering curve that curls back toward the rim.
    for (let i = 0; i < cfg.arms; i++) {
      const a = st.spin + i * (Math.PI * 2 / cfg.arms);
      const alive = (st.armMask & (1 << i)) !== 0;
      if (!alive) {
        ctx.save();
        ctx.rotate(a);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#c24c85';
        ctx.fillRect(r * 0.8, -7, r * 0.3, 14);
        ctx.strokeStyle = '#5c1636';
        ctx.lineWidth = 2;
        ctx.strokeRect(r * 0.8, -7, r * 0.3, 14);
        ctx.restore();
        continue;
      }
      const whip = Math.sin(st.clock * 2.1 + i * 1.7) * 0.28;
      const curl = Math.sin(st.clock * 1.4 + i) * 0.5;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      const steps = 8;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const along = r * 0.7 + u * (cfg.armReach * 0.78);
        const side = Math.sin(u * Math.PI) * (cfg.armRadius * 1.6 * curl) + u * u * cfg.armRadius * whip;
        if (s === 0) ctx.moveTo(along, side);
        else ctx.lineTo(along, side);
      }
      for (let s = steps; s >= 0; s--) {
        const u = s / steps;
        const along = r * 0.7 + u * (cfg.armReach * 0.78);
        const side = Math.sin(u * Math.PI) * (cfg.armRadius * 1.6 * curl) + u * u * cfg.armRadius * whip;
        const width = (1 - u) * cfg.armRadius * cfg.armWidth + 2.5;
        ctx.lineTo(along, side + width);
      }
      ctx.closePath();
      ctx.fillStyle = '#ff9ecb';
      ctx.globalAlpha = 1;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      // Suckers: a short row of pale dots down each arm.
      ctx.fillStyle = cfg.core;
      for (let s = 1; s < 5; s++) {
        const u = s / 5;
        const along = r * 0.7 + u * (cfg.armReach * 0.78);
        const side = Math.sin(u * Math.PI) * (cfg.armRadius * 1.6 * curl) + u * u * cfg.armRadius * whip;
        ctx.globalAlpha = 0.5 * alpha;
        ctx.fillRect(along - 1.5, side + 2, 3, 3);
      }
      ctx.restore();
    }

    // Center disc: solid, bright, and the read that carries the boss at a glance.
    ctx.globalAlpha = 1;
    ctx.fillStyle = center.hitFlash > 0 ? '#ffffff' : '#8f2350';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TWO_PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TWO_PI);
    ctx.stroke();

    // Mouth: opens for the suck, snaps on the chomp.
    let open = 0;
    if (st.state === 1) open = Math.min(1, st.t / STARFISH.mouth.open);
    else if (st.state === 2) open = 1;
    else if (st.state === 3) open = Math.max(0, 1 - st.t / STARFISH.mouth.recover);
    const maw = r * (0.32 + 0.28 * open);
    ctx.globalAlpha = 0.95 * alpha;
    ctx.fillStyle = '#1c0510';
    ctx.beginPath();
    ctx.arc(0, 0, maw, 0, TWO_PI);
    ctx.fill();
    if (st.armCount === 0) {
      // Spinning phase: a hot rim and a rotation tick so the spin reads.
      ctx.globalAlpha = 0.5 * alpha;
      ctx.strokeStyle = cfg.core;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 7 + Math.sin(t * 8) * 2, 0, TWO_PI);
      ctx.stroke();
    }
    const teeth = 10;
    ctx.fillStyle = cfg.core;
    for (let i = 0; i < teeth; i++) {
      const a = st.spin * 1.4 + (i / teeth) * Math.PI * 2;
      const inner = maw + (open > 0 ? 2 : maw * 0.35);
      const outer = maw - r * 0.16;
      ctx.globalAlpha = 0.9 * alpha;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a + 0.16) * outer, Math.sin(a + 0.16) * outer);
      ctx.lineTo(Math.cos(a - 0.16) * outer, Math.sin(a - 0.16) * outer);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** A detached arm: a crawling curl with a hatch ring counting down to a new boss. */
  private drawStarfishArm(arm: Worm, alpha: number, t: number): void {
    const as = arm.armState;
    if (!as) return;
    const ctx = this.ctx;
    const cfg = STARFISH;
    const x = lerp(arm.prevX, arm.x, alpha);
    const y = lerp(arm.prevY, arm.y, alpha);
    const r = arm.hitR;
    const wiggle = Math.sin(t * 6 + as.phase) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(x, y);
    ctx.rotate(arm.angle + wiggle * 0.6);
    ctx.globalAlpha = 0.9 * alpha;
    ctx.globalAlpha = 1;
    ctx.fillStyle = arm.hitFlash > 0 ? '#ffffff' : '#ff9ecb';
    // Keep the same curved, tapering arm silhouette the attached arm uses. A
    // detached arm is still an arm, not a leaf or a boat.
    const curl = Math.sin(t * 1.4 + as.phase) * 0.5;
    const whip = Math.sin(t * 2.1 + as.phase) * 0.28;
    const base = -cfg.armReach * 0.3;
    const span = cfg.armReach * 0.78;
    const steps = 8;
    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const along = base + u * span;
      const side = Math.sin(u * Math.PI) * (cfg.armRadius * 1.6 * curl) + u * u * cfg.armRadius * whip;
      if (s === 0) ctx.moveTo(along, side);
      else ctx.lineTo(along, side);
    }
    for (let s = steps; s >= 0; s--) {
      const u = s / steps;
      const along = base + u * span;
      const side = Math.sin(u * Math.PI) * (cfg.armRadius * 1.6 * curl) + u * u * cfg.armRadius * whip;
      const width = (1 - u) * cfg.armRadius * 0.72 + 2.5;
      ctx.lineTo(along, side + width);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // Suckers down the detached arm.
    ctx.fillStyle = cfg.core;
    for (let s = 1; s < 5; s++) {
      const u = s / 5;
      const along = base + u * span;
      const side = Math.sin(u * Math.PI) * (cfg.armRadius * 1.6 * curl) + u * u * cfg.armRadius * whip;
      ctx.globalAlpha = 0.5 * alpha;
      ctx.fillRect(along - 1.5, side + 2, 3, 3);
    }
    // Ragged stump at the base.
    ctx.fillStyle = '#5c1636';
    ctx.globalAlpha = 1;
    ctx.fillRect(base - 6, -r * 0.65, 12, r * 1.3);
    ctx.restore();

    // Hatch ring: fills back up as the arm grows a new Starfish.
    const prog = Math.max(0, Math.min(1, 1 - as.hatchT / cfg.hatchTime));
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.85 * alpha;
    ctx.strokeStyle = cfg.core;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 13, -Math.PI * 0.5, -Math.PI * 0.5 + prog * Math.PI * 2);
    ctx.stroke();
    if (as.hatchT < 2 && Math.sin(t * 18) > 0) {
      ctx.globalAlpha = 0.5 * alpha;
      ctx.fillStyle = cfg.core;
      ctx.beginPath();
      ctx.arc(0, 0, r + 13, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }



  /** The file cage around a glued body. Seven files that must be torn off. */

  private drawJaggedBolt(x1: number, y1: number, x2: number, y2: number, amp: number, seed: number, segments: number): void {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const u = i / segments;
      const wobble = Math.sin(i * 12.9898 + seed) * amp;
      ctx.lineTo(x1 + dx * u + nx * wobble, y1 + dy * u + ny * wobble);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private drawStormCloud(w: Worm, alpha: number, t: number): void {
    const st = w.storm;
    if (!st) return;
    const cfg = STORM_CLOUD;
    const ctx = this.ctx;
    const x = lerp(w.prevX, w.x, alpha);
    const y = lerp(w.prevY, w.y, alpha);
    const r = w.hitR;
    const intro = w.spawnT > 0 ? 1 - w.spawnT / Math.max(0.001, cfg.introTime) : 1;

    // Ground shadow: the cloud is a body in the air, and the shadow sells the height.
    ctx.save();
    ctx.globalAlpha = 0.1 * alpha;
    ctx.fillStyle = cfg.color;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.9, r * 1.15 * intro, r * 0.26 * intro, 0, 0, TWO_PI);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    // The cloud is a pile of opaque squares. The old pass drew them with `lighter` at a
    // low alpha, so every overlap stacked into a brighter patch and the mass read as a
    // flat grid. Source-over with a solid fill hides the depth: you see the squares
    // that are on top, never how many sit under them.
    ctx.globalCompositeOperation = 'source-over';
    const cols = 7;
    const rows = 4;
    const layers = 3;
    // No whole-cloud scale: the entrance is per square, so the first block lands alone
    // and the mass builds by overlap instead of inflating from a dot.
    for (let layer = 0; layer < layers; layer++) {
      ctx.fillStyle = layer === 0 ? '#8497ab' : layer === 1 ? cfg.color : '#b3c6d8';
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const i = (layer * rows + row) * cols + col;
          const h1 = Math.abs(Math.sin(i * 12.9898 + 3.7) * 43758.5453) % 1;
          const h2 = Math.abs(Math.sin(i * 78.233 + 1.3) * 12345.6789) % 1;
          const h3 = Math.abs(Math.sin(i * 39.425 + 7.1) * 24634.6345) % 1;
          const h4 = Math.abs(Math.sin(i * 93.989 + 4.4) * 98123.4567) % 1;
          // Three loose offsets over the same 7x4 lattice: the layers overlap without
          // landing on each other, which is what turns the grid into a rough mass.
          const u = (col + 0.5) / cols - 0.5 + (layer - 1) * 0.035;
          const v = (row + 0.5) / rows - 0.5 + (layer - 1) * 0.022;
          // Elliptical envelope with a hashed edge, so a few squares sit proud of the
          // rim instead of the outline reading as a clean oval.
          const ell = (u / 0.56) ** 2 + (v / 0.4) ** 2;
          if (ell > 0.72 + h1 * 0.34) continue;
          const k = st.puff[i % st.puff.length];
          const px = u * r * 1.84 + (h2 - 0.5) * r * 0.07;
          const py = v * r * 1.06 + (h3 - 0.5) * r * 0.08 + Math.sin(st.clock * 1.7 + i * 0.7) * 2.4;
          const box = i === 0 ? r * 0.34 : r * (0.23 + h4 * 0.17) * k;
          // A loose per-square rotation: whole turns would read as a pattern, so the
          // range stays under a radian and drifts by layer.
          const rot = (h2 - 0.5) * 0.95 + (layer - 1) * 0.16;
          // Boss entrance: square 0 snaps in on its own, then the rest fly in from
          // scattered points and overlap until the 84-square lattice is whole. After
          // `intro` completes every square sits on its final slot, so the settled cloud
          // draws exactly as before.
          const born = i === 0 ? 0 : 0.18 + (0.62 * i) / (cols * rows * layers - 1) + h3 * 0.06;
          const gather = intro >= 1 ? 1 : Math.min(1, Math.max(0, (intro - born) / 0.28));
          if (gather <= 0) continue;
          const eased = 1 - Math.pow(1 - gather, 3);
          const fromX = i === 0 ? px : (h1 - 0.5) * r * 2.6;
          const fromY = i === 0 ? py : (h2 - 0.5) * r * 2.0;
          const drawX = fromX + (px - fromX) * eased;
          const drawY = fromY + (py - fromY) * eased;
          const side = box * (0.32 + 0.68 * eased);
          ctx.save();
          ctx.translate(drawX, drawY);
          ctx.rotate(rot * (0.35 + 0.65 * eased));
          ctx.globalAlpha = intro >= 1 ? 1 : Math.min(1, gather * 3);
          ctx.fillRect(-side * 0.5, -side * 0.5, side, side);
          // A darker seam, not a glow: it keeps the individual squares legible while
          // the fill stays fully opaque.
          ctx.globalAlpha *= 0.3;
          ctx.strokeStyle = row >= rows - 1 && layer === layers - 1 ? cfg.bolt : '#41536a';
          ctx.lineWidth = 1;
          ctx.strokeRect(-side * 0.5, -side * 0.5, side, side);
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = alpha;

    // Underside fringe: short rain strokes, so the cloud looks like it is raining even
    // between rows. It is decoration; the real drops are projectiles.
    const fringe = 0.55 + st.rainCd * 0.3;
    ctx.strokeStyle = cfg.rainColor;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 11; i++) {
      const u = i / 10 - 0.5;
      const fx = u * r * 1.5;
      const phase = (st.clock * 2.2 + i * 0.37) % 1;
      const fy = r * 0.6 + phase * r * 0.42;
      ctx.globalAlpha = (0.16 + 0.18 * (1 - phase)) * alpha * fringe * intro;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx - 2, fy + 10);
      ctx.stroke();
    }

    // Bolt tell: the aim line flickers wider as the windup closes.
    if (st.state === 1) {
      const u = 1 - st.boltT / Math.max(0.001, cfg.lightning.windup);
      const flicker = 0.45 + 0.55 * Math.abs(Math.sin(t * 26 + st.clock));
      ctx.strokeStyle = cfg.bolt;
      ctx.globalAlpha = 0.5 * flicker * alpha;
      ctx.lineWidth = 2.4 + u * 2.6;
      this.drawJaggedBolt(x, y + r * 0.7, st.boltX, st.boltY, 13 + u * 8, st.clock * 5, 7);
      ctx.globalAlpha = 0.85 * alpha;
      ctx.lineWidth = 1;
      this.drawJaggedBolt(x, y + r * 0.7, st.boltX, st.boltY, 13 + u * 8, st.clock * 5 + 2, 7);
      ctx.strokeStyle = cfg.rainColor;
      ctx.globalAlpha = 0.32 * alpha;
      ctx.beginPath();
      ctx.arc(st.boltX, st.boltY, 18 + Math.sin(t * 18) * 4, 0, TWO_PI);
      ctx.stroke();
    }

    // Flash after the strike leaves the cloud.
    if (st.flash > 0) {
      ctx.globalAlpha = (st.flash / 0.24) * 0.5 * alpha;
      ctx.fillStyle = cfg.bolt;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.35, r * 0.85, r * 0.4, 0, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawGlueCages(players: readonly Player[], alpha: number, t: number): void {
    const ctx = this.ctx;
    for (let k = 0; k < players.length; k++) {
      const p = players[k];
      if (!p.active || !p.alive || p.glueT <= 0) continue;
      const px = lerp(p.prevX, p.x, alpha);
      const py = lerp(p.prevY, p.y, alpha);
      for (let i = 0; i < 7; i++) {
        const a = t * 1.4 + (i / 7) * Math.PI * 2;
        this.drawFileIcon(px + Math.cos(a) * 26, py + Math.sin(a) * 26, Math.max(10, BLOB.rMax * 0.05), a, 0.85 * alpha);
      }
      ctx.save();
      ctx.globalAlpha = 0.3 * alpha;
      ctx.strokeStyle = BLOB.tint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 28, 0, TWO_PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** One file icon. Kept to rectangles and a folded corner so it stays cheap at scale. */
  private drawFileIcon(x: number, y: number, size: number, rot: number, alpha: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    const w = size;
    const h = size * 1.28;
    const fold = size * 0.3;
    ctx.fillStyle = BLOB.paper;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.5);
    ctx.lineTo(w * 0.5 - fold, -h * 0.5);
    ctx.lineTo(w * 0.5, -h * 0.5 + fold);
    ctx.lineTo(w * 0.5, h * 0.5);
    ctx.lineTo(-w * 0.5, h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = BLOB.ink;
    ctx.globalAlpha = alpha * 0.55;
    ctx.beginPath();
    ctx.moveTo(w * 0.5 - fold, -h * 0.5);
    ctx.lineTo(w * 0.5, -h * 0.5 + fold);
    ctx.lineTo(w * 0.5 - fold, -h * 0.5 + fold);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillRect(-w * 0.32, -h * 0.12, w * 0.64, Math.max(1, size * 0.07));
    ctx.fillRect(-w * 0.32, h * 0.02, w * 0.64, Math.max(1, size * 0.07));
    ctx.fillRect(-w * 0.32, h * 0.16, w * 0.4, Math.max(1, size * 0.07));
    // A dark ink edge separates overlapping plates; the paper fill itself is
    // opaque whenever the caller passes a full alpha.
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = BLOB.ink;
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
    ctx.restore();
  }

  /**
   * File blob. The rim is a curve through ten spring nodes, and icons sit inside it at
   * hashed angles and radii. Three reused depth layers draw the same icon index, so 96
   * logical files read as nearly 300 while only one icon list is ever walked.
   */
  private drawBlob(w: Worm, alpha: number, t: number): void {
    const st = w.blob;
    if (!st) return;
    const ctx = this.ctx;
    // drawWorms enables additive blending for the worm pool. File plates must be
    // opaque and read as stacked armor, so opt this boss out locally.
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const cfg = BLOB;
    const x = lerp(w.prevX, w.x, alpha);
    const y = lerp(w.prevY, w.y, alpha);
    const frac = Math.max(0, Math.min(1, w.hp / Math.max(1, w.maxHp)));
    const fullR = BLOB.rMin + (BLOB.rMax - BLOB.rMin) * Math.pow(frac, 0.55);
    const introT = Math.max(0.001, BLOB.introTime);
    const introRaw = w.spawnT > 0 ? Math.max(0, Math.min(1, 1 - w.spawnT / introT)) : 1;
    const introEase = introRaw * introRaw * (3 - 2 * introRaw);
    const introScale = 0.18 + 0.82 * introEase;
    const baseR = fullR * introScale;
    // Icon slots are packed against the full roster, not the live count. A hit removes
    // a slot; it never repacks the survivors into a new spiral.
    const layoutR = BLOB.rMax * introScale;
    const nodes = st.nodeR.length;
    let jumpLift = 0;
    let bodyScale = 1;
    if (st.state === 4) {
      bodyScale = 1 - 0.12 * Math.min(1, st.t / Math.max(0.001, BLOB.slam.windup));
    } else if (st.state === 5) {
      const u = Math.min(1, st.globT / Math.max(0.001, BLOB.slam.airTime));
      jumpLift = -Math.sin(u * Math.PI) * BLOB.slam.height;
      bodyScale = 1 + 0.08 * Math.sin(u * Math.PI);
    } else if (st.state === 6) {
      const u = Math.min(1, st.t / Math.max(0.001, BLOB.slam.recover));
      bodyScale = 1 - 0.16 * (1 - u) * (1 - u);
    }
    const drawY = y + jumpLift;

    const radiusAt = (angle: number): number => {
      const span = Math.PI * 2;
      const u = ((angle % span) + span) % span / (span / nodes);
      const i0 = Math.floor(u) % nodes;
      const i1 = (i0 + 1) % nodes;
      const f = u - Math.floor(u);
      const r0 = st.nodeR[i0];
      const r1 = st.nodeR[i1];
      const ease = f * f * (3 - 2 * f);
      return r0 + (r1 - r0) * ease;
    };

    // Body hull: a closed curve through the spring rim.
    ctx.save();
    ctx.translate(x, drawY);
    ctx.scale(bodyScale, bodyScale);
    // Solid backing under the paper. The old 0.16 tint let the floor and any arena
    // pattern read straight through the pile, which made the blob look like a ghost.
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1d4a60';
    ctx.beginPath();
    for (let i = 0; i <= nodes; i++) {
      const a = (i / nodes) * Math.PI * 2;
      const r = radiusAt(a) * introScale;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = cfg.tint;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Icons: one logical list, packed from the center outward in a sunflower
    // spiral. The plates are fully opaque and overlap like a haystack. This one
    // pass replaces the old three-shell stack (and its core cluster), so the
    // render cost drops from roughly 312 glyphs to 96.
    const live = Math.max(0, Math.min(cfg.icons, Math.ceil(w.hp)));
    const staged =
      introRaw < 0.22
        ? 1 + Math.floor((introRaw / 0.22) * 2)
        : 3 + Math.floor((live - 3) * Math.pow(Math.max(0, (introRaw - 0.22) / 0.78), 2.2));
    const drawCount = w.spawnT > 0 ? Math.min(live, Math.max(1, staged)) : live;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < drawCount; i++) {
      // Deterministic hash: no per-icon storage, no allocation. The divisor is the
      // full icon roster, so removing index 95 never moves index 94.
      const h1 = Math.sin((i + 1) * 12.9898 + st.shedSeed * 0.013) * 43758.5453;
      const h2 = Math.sin((i + 1) * 78.233 + 3.1) * 43758.5453;
      const h3 = Math.sin((i + 1) * 39.425 + 7.7) * 43758.5453;
      const fa = h1 - Math.floor(h1);
      const fr = h2 - Math.floor(h2);
      const fs = h3 - Math.floor(h3);
      // Fixed center-out slot: every icon owns the same angle and radius for the
      // whole fight. Low-health survivors are the central slots; hits only remove
      // the outer plates, so the shrinking hull still contains them.
      const u = Math.sqrt((i + 0.5) / Math.max(1, BLOB.icons));
      const a = i * golden + (fa - 0.5) * 0.22;
      const r = layoutR * u * 0.9;
      const ix = Math.cos(a) * r;
      const iy = Math.sin(a) * r * 0.94;
      const size = layoutR * (0.16 + fs * 0.04);
      this.drawFileIcon(x + ix * bodyScale, drawY + iy * bodyScale, size * bodyScale, a + (fr - 0.5) * 1.1, 1);
    }

    // Shed burst: icons knocked off by the last hit, falling out of the rim.
    if (st.shedT > 0) {
      const u = 1 - st.shedT / cfg.shedTime;
      for (let i = 0; i < st.shed; i++) {
        const h = Math.sin((i + 1) * 21.71 + st.shedSeed) * 43758.5453;
        const fa = h - Math.floor(h);
        const a = fa * Math.PI * 2;
        const speed = baseR * (0.9 + fa);
        const px = x + Math.cos(a) * (speed * u);
        const py = y + Math.sin(a) * (speed * u) + 120 * u * u;
        this.drawFileIcon(px, py, Math.max(10, baseR * 0.1), a + u * 4, (1 - u) * 0.9 * alpha);
      }
    }

    // Slam telegraph and touchdown: a readable ring on the ground while the body
    // is crouched or airborne, then a bright flash when it lands.
    if (st.state === 4 || st.state === 6) {
      const u = st.state === 4 ? Math.min(1, st.t / Math.max(0.001, BLOB.slam.windup)) : Math.min(1, st.t / Math.max(0.001, BLOB.slam.recover));
      ctx.save();
      ctx.globalAlpha = (st.state === 4 ? 0.2 + 0.35 * u : 0.45 * (1 - u)) * alpha;
      ctx.strokeStyle = cfg.tint;
      ctx.lineWidth = st.state === 4 ? 2 : 4;
      ctx.beginPath();
      ctx.arc(st.toX, st.toY, BLOB.slam.aoe * (st.state === 4 ? 0.4 + 0.6 * u : 0.8 + 0.2 * u), 0, TWO_PI);
      ctx.stroke();
      ctx.restore();
    }
    if (st.state === 5) {
      const u = Math.min(1, st.globT / Math.max(0.001, BLOB.slam.airTime));
      ctx.save();
      ctx.globalAlpha = 0.18 * (1 - u) * alpha;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(st.toX, st.toY, BLOB.slam.aoe * (0.35 + 0.45 * u), BLOB.slam.aoe * 0.14 * u, 0, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    // Toss: the glob is a small cluster of files in the air.
    if (st.state === 1 || st.state === 2) {
      const u = st.state === 1 ? 0 : Math.min(1, st.globT / cfg.flight);
      const gx = st.state === 1 ? x : lerp(st.fromX, st.toX, u);
      const gy = st.state === 1 ? y - baseR * 0.3 : lerp(st.fromY, st.toY, u) - Math.sin(u * Math.PI) * 170;
      const spin = t * 3;
      for (let i = 0; i < 9; i++) {
        const a = spin + (i / 9) * Math.PI * 2;
        const rr = baseR * 0.16 + (i % 3) * baseR * 0.06;
        this.drawFileIcon(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr, Math.max(10, baseR * 0.1), a, 0.9 * alpha);
      }
      if (st.state === 2) {
        ctx.save();
        ctx.globalAlpha = 0.25 * alpha;
        ctx.strokeStyle = cfg.tint;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(st.toX, st.toY, cfg.aoe, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /**
   * Mega Worm. There is no health bar: every plate carries its own damage, drawn as
   * cracks climbing out of its seams, and a plate that breaks leaves loose code drifting
   * where it used to sit. A promoted head flares its new eyes; the last plate grows legs.
   */
  private drawMegaWorm(w: Worm, alpha: number, t: number): void {
    const ctx = this.ctx;
    const base = THREAT_COLORS.worm;
    const build = w.spawnT > 0 ? 1 - w.spawnT / MEGA_WORM.spawnTime : 1;
    const nodes = w.segCount + 1;
    const builtNodes = Math.max(1, Math.ceil(Math.max(0, build) * nodes));

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Loose code: the closer the body is to fragmenting, the more debris drifts off it.
    const totalFrac = Math.min(1, Math.max(0, w.hp) / Math.max(1, w.maxHp));
    const stress = nodes * (1 - totalFrac);
    const debris = Math.min(22, Math.round(stress * 4));
    for (let k = 0; k < debris; k++) {
      const node = k % nodes;
      const seg = node - 1;
      const nx = node === 0 ? lerp(w.prevX, w.x, alpha) : lerp(w.segPrevX[seg], w.segX[seg], alpha);
      const ny = node === 0 ? lerp(w.prevY, w.y, alpha) : lerp(w.segPrevY[seg], w.segY[seg], alpha);
      const a = t * (0.7 + (k % 7) * 0.14) + k * 2.31;
      const orbit = 30 + (k % 5) * 16;
      const px = nx + Math.cos(a) * orbit;
      const py = ny + Math.sin(a * 1.17 + 0.6) * orbit * 0.62;
      const s = 2 + (k % 3);
      ctx.globalAlpha = 0.16 + 0.18 * (0.5 + 0.5 * Math.sin(t * 3.4 + k * 1.7));
      ctx.fillStyle = base;
      ctx.save();
      ctx.translate(px, py);
      this.traceMegaHex(s);
      ctx.fill();
      ctx.restore();
    }

    const hx = lerp(w.prevX, w.x, alpha);
    const hy = lerp(w.prevY, w.y, alpha);

    // A dark spine fills the seams under the plates, so a fast pass reads as one solid
    // body even where two hex frames meet at a shallow angle.
    if (w.segCount > 0) {
      const tail = w.segCount - 1;
      const tx = lerp(w.segPrevX[tail], w.segX[tail], alpha);
      const ty = lerp(w.segPrevY[tail], w.segY[tail], alpha);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = '#2a0712';
      ctx.lineWidth = w.segR * 1.7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = base;
      ctx.lineWidth = w.segR * 1.25;
      ctx.stroke();
      ctx.restore();
    }

    for (let k = nodes - 1; k >= 1; k--) {
      if (k >= builtNodes) continue;
      const seg = k - 1;
      const x = lerp(w.segPrevX[seg], w.segX[seg], alpha);
      const y = lerp(w.segPrevY[seg], w.segY[seg], alpha);
      const frac = totalFrac;
      const size = w.segR * (1 - Math.min(0.26, k * 0.004));
      this.drawMegaPlate(x, y, w.segAngle[seg], size, frac, base, t, k);
    }

    this.drawMegaPlate(hx, hy, w.angle, w.hitR, totalFrac, base, t, -1);

    // Eyes are the head read.
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(w.angle + Math.PI * 0.25);
    ctx.globalCompositeOperation = 'source-over';
    const er = w.hitR;
    ctx.fillStyle = '#14030a';
    this.traceMegaHex(er * 0.62);
    ctx.fill();
    ctx.fillStyle = '#ffe9e4';
    for (const ex of [-0.36, 0.36]) {
      ctx.save();
      ctx.translate(ex * er, -er * 0.14);
      this.traceMegaHex(er * 0.18);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // The entrance roar: a solid maw and expanding pressure rings after the swim-in.
    if (w.roarT > 0) {
      const u = 1 - w.roarT / Math.max(0.001, MEGA_WORM.entrance.roar);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(w.angle);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.92 * (1 - u * 0.25);
      ctx.fillStyle = '#120309';
      ctx.beginPath();
      ctx.moveTo(w.hitR * 0.2, 0);
      ctx.lineTo(w.hitR * 1.02, -w.hitR * 0.44);
      ctx.lineTo(w.hitR * 1.24, 0);
      ctx.lineTo(w.hitR * 1.02, w.hitR * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffd9cf';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const ring = w.hitR * (0.7 + k * 0.42 + u * 0.8);
        ctx.globalAlpha = (0.38 - k * 0.09) * (1 - u) * 1.6;
        ctx.strokeStyle = '#ffd9cf';
        ctx.lineWidth = 3 - k * 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, ring, -0.78, 0.78);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Trace a flat-topped hexagon centered on the current canvas origin. */
  private traceMegaHex(radius: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /** One boss plate: heavy hex frame, dark core and cracks that track its health. */
  private drawMegaPlate(
    x: number,
    y: number,
    angle: number,
    size: number,
    frac: number,
    base: string,
    t: number,
    index: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI * 0.25);
    ctx.globalAlpha = 0.1 + 0.1 * (1 - frac);
    ctx.fillStyle = base;
    this.traceMegaHex(size + 9);
    ctx.fill();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#1a0509';
    this.traceMegaHex(size);
    ctx.fill();
    ctx.globalAlpha = 0.5 + 0.45 * frac;
    ctx.strokeStyle = base;
    ctx.lineWidth = 3;
    this.traceMegaHex(size);
    ctx.stroke();
    ctx.globalAlpha = 0.28 + 0.3 * frac;
    ctx.lineWidth = 1.2;
    this.traceMegaHex(size * 0.68);
    ctx.stroke();

    if (frac < 0.999) {
      const cracks = Math.min(6, Math.ceil((1 - frac) * 6));
      ctx.globalAlpha = 0.45 + 0.45 * (1 - frac);
      ctx.strokeStyle = '#ffe9e4';
      ctx.lineWidth = 1.2 + (1 - frac) * 1.8;
      for (let c = 0; c < cracks; c++) {
        const seed = Math.sin((index + 5) * 12.9898 + c * 78.233) * 43758.5453;
        const r1 = seed - Math.floor(seed);
        const r2 = Math.abs(Math.sin(seed * 1.7));
        const a = index * 2.399 + c * 1.7 + (r1 - 0.5) * 0.5;
        const sx = Math.cos(a) * size * (0.82 + r2 * 0.16);
        const sy = Math.sin(a) * size * (0.82 + r2 * 0.16);
        const mx = Math.cos(a + 0.18) * size * (0.46 + r1 * 0.12);
        const my = Math.sin(a + 0.18) * size * (0.46 + r1 * 0.12);
        const ex = Math.cos(a - 0.12) * size * 0.16;
        const ey = Math.sin(a - 0.12) * size * 0.16;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(mx, my);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      // A plate near collapse shudders on its own.
      if (frac < 0.34) {
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 18 + index);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        this.traceMegaHex(size * 0.9);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawViruses(viruses: readonly Virus[], alpha: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = THREAT_COLORS.virus;
    ctx.fillStyle = THREAT_COLORS.virus;
    for (let i = 0; i < viruses.length; i++) {
      const v = viruses[i];
      if (!v.active || v.held) continue;
      const x = lerp(v.prevX, v.x, alpha);
      const y = lerp(v.prevY, v.y, alpha);
      const spin = t * 1.1 + v.phase;
      const build = v.spawnT > 0 ? 1 - v.spawnT / VIRUS.spawnTime : 1;
      ctx.save();
      if (build < 1) {
        ctx.globalAlpha = (1 - build) * 0.6;
        ctx.strokeStyle = THREAT_COLORS.virus;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        for (let k = 0; k < 4; k++) {
          const a = build * 5 + k * (Math.PI / 2);
          ctx.beginPath();
          ctx.arc(x, y, v.radius + 8 + k * 5, a, a + 0.7);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      ctx.translate(x, y);
      ctx.rotate(spin + (1 - build) * 2.4);
      ctx.scale(0.25 + 0.75 * build, 0.25 + 0.75 * build);
      const r = v.radius;
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = THREAT_COLORS.virus;
      ctx.beginPath();
      ctx.moveTo(0, -r - 7);
      ctx.lineTo(r + 7, 0);
      ctx.lineTo(0, r + 7);
      ctx.lineTo(-r - 7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = THREAT_COLORS.virus;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.rotate(-spin * 2.2);
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 1;
      ctx.strokeRect(-r * 0.46, -r * 0.46, r * 0.92, r * 0.92);
      ctx.globalAlpha = 0.95;
      ctx.fillRect(-1.8, -1.8, 3.6, 3.6);
      if (v.hitFlash > 0) {
        ctx.globalAlpha = Math.min(1, v.hitFlash * 6);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r + 5, 0, TWO_PI);
        ctx.stroke();
      }
      ctx.restore();

      // Fake density: these diamonds ride the same entity and never add hitboxes.
      for (let k = 0; k < v.swarm; k++) {
        const a = t * (1.25 + k * 0.09) + v.phase + k * 2.4;
        const orbit = v.radius * (2.5 + k * 0.6) + Math.sin(t * 2.1 + k) * 4;
        const sx = x + Math.cos(a) * orbit;
        const sy = y + Math.sin(a * 1.13 + 0.8) * orbit * 0.55;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(-t * 2.2 + k * 1.7 + v.phase);
        ctx.globalAlpha = 0.52 - k * 0.08;
        ctx.strokeStyle = THREAT_COLORS.virus;
        ctx.fillStyle = THREAT_COLORS.virus;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -v.radius * 0.62);
        ctx.lineTo(v.radius * 0.62, 0);
        ctx.lineTo(0, v.radius * 0.62);
        ctx.lineTo(-v.radius * 0.62, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
        ctx.restore();
      }

      if (v.chargeT > 0) {
        const chargeTotal = VIRUS.chargeWindup + VIRUS.chargeActive + VIRUS.chargeRecovery;
        this.drawLungeWarn(
          x,
          y,
          v.radius,
          v.chargeDirX,
          v.chargeDirY,
          chargeTotal - v.chargeT,
          VIRUS.chargeWindup,
          VIRUS.chargeActive,
          THREAT_COLORS.virus,
        );
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Hostile shooters: square, nested triplex, trapezoid missile pod and flock dart. */
  private drawSentries(sentries: readonly Sentry[], alpha: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < sentries.length; i++) {
      const s = sentries[i];
      if (!s.active) continue;
      const x = lerp(s.prevX, s.x, alpha);
      const y = lerp(s.prevY, s.y, alpha);
      const color =
        s.kind === 4
          ? THREAT_COLORS.shapeCircle
          : s.kind === 5 || s.kind === 7
            ? THREAT_COLORS.shapeTriangle
            : s.kind === 6 || s.kind === 8
              ? THREAT_COLORS.shapeRect
              : s.kind === 2
                ? THREAT_COLORS.homing
                : s.kind === 3
                  ? THREAT_COLORS.flock
                  : THREAT_COLORS.sentry;
      const angle = Math.atan2(s.vy, s.vx);
      const r = s.radius;
      const build = s.spawnT > 0 ? 1 - s.spawnT / SENTRY.spawnTime : 1;
      ctx.save();
      if (build < 1) {
        ctx.globalAlpha = (1 - build) * 0.6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 6]);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(build * 5 + s.phase);
        ctx.strokeRect(-r - 16, -r - 16, (r + 16) * 2, (r + 16) * 2);
        ctx.restore();
        ctx.setLineDash([]);
      }
      ctx.translate(x, y);
      ctx.rotate((1 - build) * 3.2);
      ctx.scale(0.2 + 0.8 * build, 0.2 + 0.8 * build);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;

      if (s.kind >= 4) {
        this.drawCalibrationShape(s, t, sentries);
      } else if (s.kind === 0) {
        ctx.rotate(t * 0.8 + s.phase);
        ctx.globalAlpha = 0.12;
        ctx.fillRect(-r - 5, -r - 5, (r + 5) * 2, (r + 5) * 2);
        ctx.globalAlpha = 0.86;
        ctx.lineWidth = 1.8;
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.strokeRect(-r * 0.52, -r * 0.52, r * 1.04, r * 1.04);
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-2.4, -2.4, 4.8, 4.8);
        ctx.rotate(-(t * 0.8 + s.phase));
        ctx.rotate(angle);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(r - 2, -2, 8, 4);
      } else if (s.kind === 1) {
        ctx.rotate(t * 0.45 + s.phase);
        ctx.globalAlpha = 0.13;
        ctx.fillRect(-r - 7, -r - 7, (r + 7) * 2, (r + 7) * 2);
        ctx.globalAlpha = 0.88;
        ctx.lineWidth = 1.8;
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.rotate(Math.PI * 0.25);
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.3;
        ctx.strokeRect(-r * 0.66, -r * 0.66, r * 1.32, r * 1.32);
        ctx.rotate(Math.PI * 0.25);
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = -Math.PI / 2 + k * (TWO_PI / 3);
          const px = Math.cos(a) * r * 0.44;
          const py = Math.sin(a) * r * 0.44;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (s.kind === 2) {
        ctx.rotate(angle);
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.moveTo(r + 8, 0);
        ctx.lineTo(-r - 5, -r - 5);
        ctx.lineTo(-r - 5, r + 5);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.72, -r * 0.78);
        ctx.lineTo(-r * 0.42, 0);
        ctx.lineTo(-r * 0.72, r * 0.78);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1;
        ctx.strokeRect(-r * 0.66, -r * 0.24, r * 0.5, r * 0.48);
        ctx.globalAlpha = 0.7;
        ctx.fillRect(-r * 1.15, -3, 6, 6);
      } else {
        ctx.rotate(angle);
        const flap = 0.78 + 0.22 * Math.sin(t * 11 + s.phase);
        ctx.globalAlpha = 0.13;
        ctx.fillRect(-r - 4, -r - 4, (r + 4) * 2, (r + 4) * 2);
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r, -r * flap);
        ctx.lineTo(-r * 0.42, 0);
        ctx.lineTo(-r, r * flap);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(r * 0.4, 0);
        ctx.lineTo(-r * 0.3, 0);
        ctx.stroke();
      }

      if (s.hitFlash > 0) {
        ctx.globalAlpha = Math.min(1, s.hitFlash * 6);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.4;
        ctx.strokeRect(-r - 4, -r - 4, (r + 4) * 2, (r + 4) * 2);
      }
      ctx.restore();

      if (s.ramT > 0) {
        const ramTotal = SENTRY.ram.windup + SENTRY.ram.active + SENTRY.ram.recovery;
        this.drawLungeWarn(
          x,
          y,
          s.radius,
          s.ramDirX,
          s.ramDirY,
          ramTotal - s.ramT,
          SENTRY.ram.windup,
          SENTRY.ram.active,
          color,
        );
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * Campaign calibration subjects. Dormant shapes are plain geometry; the eye is the
   * tell that the lesson is live. Parents spin to read as awake, children carry the
   * attack (a seeker shard, or a telegraphed echo lane).
   */
  private drawCalibrationShape(s: Sentry, t: number, sentries: readonly Sentry[]): void {
    const ctx = this.ctx;
    const r = s.radius;
    const awake = s.shapeState === 1 ? 1 - Math.max(0, s.shapeT) / CALIBRATION.wakeTime : s.shapeState === 0 ? 0 : 1;
    const color =
      s.kind === 4
        ? THREAT_COLORS.shapeCircle
        : s.kind === 5 || s.kind === 7
          ? THREAT_COLORS.shapeTriangle
          : THREAT_COLORS.shapeRect;

    if (s.kind === 7) {
      const a = Math.atan2(s.vy, s.vx);
      ctx.save();
      ctx.rotate(a);
      // A filled mini triangle with no tail: it reads as a member of the cloud, not
      // a homing missile. The jitter lives in the motion, not in a drawn trail.
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(r * 0.95, 0);
      ctx.lineTo(-r * 0.7, -r * 0.8);
      ctx.lineTo(-r * 0.35, 0);
      ctx.lineTo(-r * 0.7, r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (s.kind === 8) {
      const leader = sentries[s.shapeParent];
      const charging = leader?.active && leader.kind === 6 && leader.shapeState === 4;
      const fx = leader?.active && leader.kind === 6 ? leader.ramDirX : 1;
      const fy = leader?.active && leader.kind === 6 ? leader.ramDirY : 0;
      ctx.save();
      // No row line and no lane: the copies simply arrive, hover, then commit. Reading
      // the switch is the player's job; this pack does not announce its attacks yet.
      if (charging) {
        ctx.save();
        ctx.rotate(Math.atan2(fy, fx));
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = color;
        ctx.fillRect(-r * 2.8, -r * 0.3, r * 2.4, r * 0.6);
        ctx.restore();
        ctx.globalAlpha = 0.9;
      } else {
        ctx.globalAlpha = 0.85;
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-r * 0.8, -r * 0.55, r * 1.6, r * 1.1);
      ctx.globalAlpha = 0.3;
      ctx.fillRect(-r * 0.55, -r * 0.32, r * 1.1, r * 0.64);
      // Every clone carries the same red eye: the row is a set of live bodies, not
      // hollow afterimages.
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ff2e2e';
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1.1, r * 0.14), 0, TWO_PI);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Only the circle and triangle spin. The rectangle is a blocky row leader and
    // stays axis-aligned; its life comes from the float and the clones.
    const spin = awake <= 0 || s.kind === 6 ? 0 : (t * 1.9 + s.phase) * awake;
    ctx.save();
    ctx.rotate(spin);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = s.shapeState === 0 ? 0.6 : 0.92;
    ctx.lineWidth = 2;
    if (s.kind === 4) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TWO_PI);
      ctx.stroke();
      // A symmetric circle needs an inner mark to show that it is spinning.
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([r * 0.5, r * 0.45]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (s.kind === 5) {
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + k * (TWO_PI / 3);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.22;
      ctx.fill();
    } else {
      ctx.strokeRect(-r * 0.88, -r * 0.62, r * 1.76, r * 1.24);
      ctx.globalAlpha = 0.22;
      ctx.fillRect(-r * 0.88, -r * 0.62, r * 1.76, r * 1.24);
    }
    ctx.restore();

    if (s.shapeState === 0) {
      // Dormant: a dashed ring and a dark center, no eye yet.
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, r + 7, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }

    if (awake < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - awake) * 0.55;
      ctx.strokeStyle = '#e8ffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6 + awake * 22, 0, TWO_PI);
      ctx.stroke();
      ctx.restore();
    }

    // The eye opens upright even while the hull spins, so it stays a face, not a mark.
    // It is deliberately small and red: the subject is still an enemy, not a friendly UI dot.
    ctx.save();
    // A dark socket keeps the red readable on the red triangle as well as on blue and yellow.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#05080c';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.36, Math.max(0.7, r * 0.2 * awake), 0, 0, TWO_PI);
    ctx.fill();
    ctx.globalAlpha = 0.55 + 0.42 * awake;
    ctx.strokeStyle = '#ff2e2e';
    ctx.fillStyle = '#ff2e2e';
    ctx.lineWidth = Math.max(1.1, r * 0.075);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.38, Math.max(0.7, r * 0.22 * awake), 0, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.65 + 0.33 * awake;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.1, r * 0.095), 0, TWO_PI);
    ctx.fill();
    ctx.restore();

  }

  /** Cascading Error colony: yellow blocks with red warning glyphs that jitter as they take damage. */
  private drawErrors(errors: readonly CascadingError[], alpha: number, t: number): void {
    const ctx = this.ctx;
    const size = CASCADING_ERROR.blockSize;
    const half = size * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < errors.length; i++) {
      const e = errors[i];
      if (!e.active) continue;
      const x = lerp(e.prevX, e.x, alpha);
      const y = lerp(e.prevY, e.y, alpha);
      const hurt = 1 - Math.max(0, e.hp) / e.maxHp;
      const wobble = Math.sin(t * 7 + e.phase) * (1 + hurt * 3.4);
      const shiftX = wobble + (hurt > 0.4 ? Math.sin(t * 41 + e.phase * 3) * hurt * 2.6 : 0);
      const shiftY = Math.cos(t * 6.3 + e.phase) * (1 + hurt * 2.8);
      const build = e.spawnT > 0 ? 1 - e.spawnT / CASCADING_ERROR.spawnTime : 1;
      ctx.save();
      if (build < 1) {
        ctx.globalAlpha = (1 - build) * 0.65;
        ctx.strokeStyle = THREAT_COLORS.error;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - half - 12, y - half - 12, size + 24, size + 24);
      }
      ctx.translate(x + shiftX, y + shiftY);
      ctx.rotate(Math.sin(t * 1.7 + e.phase) * 0.06 + hurt * 0.2);
      ctx.scale(0.35 + 0.65 * build, 0.35 + 0.65 * build);

      ctx.globalAlpha = 0.14 + hurt * 0.1;
      ctx.fillStyle = THREAT_COLORS.error;
      ctx.fillRect(-half - 5, -half - 5, size + 10, size + 10);
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = THREAT_COLORS.firewall;
      ctx.fillRect(-half, -half, size, size);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = THREAT_COLORS.error;
      ctx.lineWidth = 1.8;
      ctx.strokeRect(-half, -half, size, size);

      // Data decay: a broken block sheds offset fragments instead of a clean outline.
      if (hurt > 0.25) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = THREAT_COLORS.error;
        const bits = hurt > 0.7 ? 4 : 2;
        for (let b = 0; b < bits; b++) {
          const bx = Math.sin(e.phase * 5 + b * 2.1) * (half + 3);
          const by = Math.cos(e.phase * 3 + b * 1.7) * (half + 3);
          ctx.fillRect(bx - 2.5, by - 2.5, 5, 5);
        }
      }

      // Warning glyph: red bar over a dot.
      ctx.rotate(-Math.sin(t * 1.7 + e.phase) * 0.06 - hurt * 0.2);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = THREAT_COLORS.errorInk;
      ctx.fillRect(-2.4, -half + 9, 4.8, size * 0.42);
      ctx.fillRect(-2.4, half - 10, 4.8, 4.8);

      if (e.hitFlash > 0) {
        ctx.globalAlpha = Math.min(1, e.hitFlash * 5);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.strokeRect(-half - 3, -half - 3, size + 6, size + 6);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * The orbiting-dot beam charge. Probe's heavy and the overcharge spin-up share it, so
   * the powerup reads as the same move at a smaller radius and a fraction of the time.
   */
  private drawBeamCharge(
    x: number,
    y: number,
    ring: number,
    charge: number,
    facing: number,
    color: string,
    t: number,
  ): void {
    const ctx = this.ctx;
    ctx.globalAlpha = 0.14 + charge * 0.2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, ring, 0, TWO_PI);
    ctx.stroke();

    // Charge progress runs around the ring from the back to the front.
    ctx.globalAlpha = 0.32 + charge * 0.45;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(x, y, ring, -Math.PI / 2, -Math.PI / 2 + TWO_PI * charge);
    ctx.stroke();

    // Two dots orbit from behind and meet at the muzzle point.
    const a1 = facing + Math.PI - charge * Math.PI;
    const a2 = facing - Math.PI + charge * Math.PI;
    for (let d = 0; d < 2; d++) {
      const a = d === 0 ? a1 : a2;
      const dx = x + Math.cos(a) * ring;
      const dy = y + Math.sin(a) * ring;
      ctx.globalAlpha = 0.25 + charge * 0.45;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(dx, dy, 5 + charge * 2, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dx, dy, 1.8, 0, TWO_PI);
      ctx.fill();
    }

    if (charge >= 1) {
      const mx = x + Math.cos(facing) * ring;
      const my = y + Math.sin(facing) * ring;
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 30);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(mx, my, 8 + Math.sin(t * 22) * 2, 0, TWO_PI);
      ctx.stroke();
    }
  }

  /**
   * Overcharge afterglow. A switched-off beam keeps a cooling shaft and its stop flare
   * for a few frames so a tap release does not read as a light being unplugged.
   */
  private drawBeamFade(state: RenderState, p: Player, alpha: number): void {
    const ctx = this.ctx;
    const fade = Math.max(0, Math.min(1, p.ocFadeT / POWERUP.overchargeFade));
    const x = lerp(p.prevX, p.x, alpha);
    const y = lerp(p.prevY, p.y, alpha);
    const ax = Math.cos(p.laserFacing);
    const ay = Math.sin(p.laserFacing);
    const origin = PLAYER.radius + 12;
    const reach = Math.max(
      origin + 8,
      beamReach(state.arena, state.barriers, state.pusherActive === true, state.pusherY ?? 0, x, y, ax, ay, PLAYER.laserRange),
    );
    const color = playerColor(state, p);
    const x0 = x + ax * PLAYER.radius;
    const y0 = y + ay * PLAYER.radius;
    const x1 = x + ax * reach;
    const y1 = y + ay * reach;
    const width = PLAYER.laserHalfWidth * 2;
    ctx.strokeStyle = color;
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 0.1 * fade;
    ctx.lineWidth = width + 30;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.globalAlpha = 0.3 * fade;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.6 * fade * fade;
    ctx.lineWidth = 3;
    ctx.stroke();
    // The stop point keeps a small star for the first part of the fade.
    if (fade > 0.35) {
      const k = (fade - 0.35) / 0.65;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55 * k;
      ctx.beginPath();
      ctx.arc(x1, y1, 5 + (1 - k) * 9, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.7 * k;
      ctx.beginPath();
      ctx.arc(x1, y1, 2.2, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Charged heavy beam. The drawn line stops exactly where cover stops the damage. */
  private drawLasers(state: RenderState, alpha: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'butt';
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active || !p.alive) continue;
      // Overcharge spin-up: the heavy beam charge, played fast. It runs before the
      // beam exists, so the instant-off powerup still has a readable start.
      if (p.ocChargeT > 0 && p.laserT <= 0 && !p.laserChargeHeld) {
        const x = lerp(p.prevX, p.x, alpha);
        const y = lerp(p.prevY, p.y, alpha);
        const charge = 1 - Math.max(0, p.ocChargeT) / POWERUP.overchargeSpinup;
        this.drawBeamCharge(
          x,
          y,
          PLAYER.radius + 9 + charge * 5,
          charge,
          p.laserFacing,
          playerColor(state, p),
          t,
        );
        continue;
      }
      if (p.laserChargeHeld) {
        // Atomize's heavy is a field, not a beam. Its wind-up is the atom opening up,
        // so the player sees the field coming instead of a beam muzzle.
        if (p.program === PROGRAM_ID.ATOMIZE && p.laserT <= 0) {
          const x = lerp(p.prevX, p.x, alpha);
          const y = lerp(p.prevY, p.y, alpha);
          const charge = Math.min(1, p.laserChargeT / PLAYER.laserChargeTime);
          const color = playerColor(state, p);
          const rx = 26 + charge * 14;
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.24 + charge * 0.4;
          ctx.lineWidth = 1.3 + charge * 0.8;
          for (let o = 0; o < 3; o++) {
            const rot = t * (1.4 + charge * 2) + (o * Math.PI) / 3;
            ctx.beginPath();
            ctx.ellipse(x, y, rx, rx * 0.34, rot, 0, TWO_PI);
            ctx.stroke();
          }
          ctx.globalAlpha = 0.3 + charge * 0.5;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, PLAYER.radius + 9, -Math.PI / 2, -Math.PI / 2 + TWO_PI * charge);
          ctx.stroke();
          if (charge >= 1) {
            ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 30);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(x, y, PLAYER.radius + 14 + Math.sin(t * 22) * 2, 0, TWO_PI);
            ctx.stroke();
          }
          continue;
        }
        // Ghost's heavy is an opening maw, not a beam. The scare arms at full charge;
        // the mouth and the contracting ring hold the beat before it does.
        if (p.program === PROGRAM_ID.GHOST) {
          const x = lerp(p.prevX, p.x, alpha);
          const y = lerp(p.prevY, p.y, alpha);
          const charge = Math.min(1, p.laserChargeT / GHOST.scareChargeTime);
          const color = playerColor(state, p);
          const open = 5 + charge * 11;
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.24 + charge * 0.5;
          ctx.lineWidth = 1.6 + charge * 1.2;
          ctx.beginPath();
          ctx.arc(x, y, PLAYER.radius + 13 - charge * 4, 0, TWO_PI);
          ctx.stroke();
          ctx.globalAlpha = 0.45 + charge * 0.45;
          ctx.beginPath();
          ctx.arc(x, y, PLAYER.radius + 8, Math.PI * 1.08, Math.PI * 1.92);
          ctx.moveTo(x - open, y + 9);
          ctx.quadraticCurveTo(x, y + 9 + open, x + open, y + 9);
          ctx.stroke();
          ctx.globalAlpha = 0.25 + charge * 0.4;
          ctx.lineWidth = 1.4;
          for (let fang = -1; fang <= 1; fang++) {
            const fx = x + fang * 10;
            ctx.beginPath();
            ctx.moveTo(fx - 3, y + 9);
            ctx.lineTo(fx + 3, y + 9);
            ctx.lineTo(fx, y + 9 + 5 + charge * 5);
            ctx.closePath();
            ctx.stroke();
          }
          continue;
        }
        // Compress's heavy is a radial squeeze, so its wind-up is a contracting ring
        // with ticks falling inward instead of a beam muzzle.
        if (p.program === PROGRAM_ID.COMPRESS) {
          const x = lerp(p.prevX, p.x, alpha);
          const y = lerp(p.prevY, p.y, alpha);
          const charge = Math.min(1, p.laserChargeT / COMPRESS.powerChargeTime);
          const color = playerColor(state, p);
          ctx.strokeStyle = color;
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.08 + charge * 0.12;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([5, 9]);
          ctx.beginPath();
          ctx.arc(x, y, COMPRESS.powerRadius, 0, TWO_PI);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.3 + charge * 0.55;
          ctx.lineWidth = 1.8 + charge * 1.4;
          ctx.beginPath();
          ctx.arc(x, y, PLAYER.radius + 34 - charge * 20, 0, TWO_PI);
          ctx.stroke();
          ctx.globalAlpha = 0.4 + charge * 0.5;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const a = t * 1.4 + (k * TWO_PI) / 8;
            const near = PLAYER.radius + 12;
            const far = near + 18 * (1 - charge) + 4;
            ctx.moveTo(x + Math.cos(a) * far, y + Math.sin(a) * far);
            ctx.lineTo(x + Math.cos(a) * near, y + Math.sin(a) * near);
          }
          ctx.stroke();
          continue;
        }
        // Wedge and Fisher have their own wind-up silhouettes; only Probe draws the
        // orbiting-dot beam charge. A live overcharge beam still renders.
        if (p.program !== PROGRAM_ID.PROBE && p.laserT <= 0) continue;
        const x = lerp(p.prevX, p.x, alpha);
        const y = lerp(p.prevY, p.y, alpha);
        const charge = Math.min(1, p.laserChargeT / PLAYER.laserChargeTime);
        this.drawBeamCharge(
          x,
          y,
          PLAYER.radius + 15 + charge * 4,
          charge,
          p.laserFacing,
          playerColor(state, p),
          t,
        );
        // A charge and a live beam can overlap: overcharge fires while the heavy is
        // winding up. Fall through to the beam instead of skipping it for the whole
        // charge, which is what hid the overcharge beam in the attract demo.
        if (p.laserT <= 0) continue;
      }
      if (p.laserT <= 0) {
        // Overcharge afterglow: the switched-off shaft cools for a few frames instead of
        // blinking out. It deals no damage; this is the draw only.
        if (p.ocFadeT > 0) this.drawBeamFade(state, p, alpha);
        continue;
      }
      // Toxic's power is a venom jet, drawn by drawGas, not the heavy beam.
      if (p.program === PROGRAM_ID.TOXIC) continue;

      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      const ax = Math.cos(p.laserFacing);
      const ay = Math.sin(p.laserFacing);
      const origin = PLAYER.radius + 12;
      // The drawing and the damage test share one reach, so the shaft visibly stops on
      // pillars, deployed walls, the compactor plate and a walled arena's bounds.
      const reach = Math.max(
        origin + 8,
        beamReach(state.arena, state.barriers, state.pusherActive === true, state.pusherY ?? 0, x, y, ax, ay, PLAYER.laserRange),
      );
      const flicker = 0.85 + 0.15 * Math.sin(t * 44 + i);
      const width = PLAYER.laserHalfWidth * 2;
      const color = playerColor(state, p);
      const x0 = x + ax * PLAYER.radius;
      const y0 = y + ay * PLAYER.radius;
      const x1 = x + ax * reach;
      const y1 = y + ay * reach;
      ctx.strokeStyle = color;

      // Stacked layers, widest and faintest first. The extra haze pass keeps the beam
      // reading as light rather than a painted bar, and the inner band adds a hot core
      // inside the program color instead of jumping straight from glow to white.
      ctx.globalAlpha = 0.055 * flicker;
      ctx.lineWidth = width + 78;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.globalAlpha = 0.1 * flicker;
      ctx.lineWidth = width + 46;
      ctx.stroke();
      ctx.globalAlpha = 0.2 * flicker;
      ctx.lineWidth = width + 22;
      ctx.stroke();
      ctx.globalAlpha = 0.34 * flicker;
      ctx.lineWidth = width + 8;
      ctx.stroke();
      ctx.globalAlpha = 0.66 * flicker;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.globalAlpha = 0.5 * flicker;
      ctx.lineWidth = width * 0.56;
      ctx.stroke();
      // A hot white band inside the program color, so the shaft has a gradient instead
      // of one flat fill with a thin line down the middle.
      ctx.globalAlpha = 0.2 * flicker;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = width * 0.78;
      ctx.stroke();
      ctx.globalAlpha = 0.92 * flicker;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Edge rails: two thin lines along the sides of the shaft, so the width reads even
      // against a bright floor.
      const nx = -ay;
      const ny = ax;
      const rail = PLAYER.laserHalfWidth + 1;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3 * flicker;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x0 + nx * rail, y0 + ny * rail);
      ctx.lineTo(x1 + nx * rail, y1 + ny * rail);
      ctx.moveTo(x0 - nx * rail, y0 - ny * rail);
      ctx.lineTo(x1 - nx * rail, y1 - ny * rail);
      ctx.stroke();

      // Energy pulses: short bright packets running down the shaft.
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.14 * flicker;
      ctx.lineWidth = width * 0.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let s = 0; s < 2; s++) {
        const along = (t * 430 + s * (reach / 2)) % reach;
        const a0 = Math.max(4, along - 110);
        const a1 = Math.min(reach, along);
        if (a1 <= a0) continue;
        ctx.moveTo(x + ax * a0, y + ay * a0);
        ctx.lineTo(x + ax * a1, y + ay * a1);
      }
      ctx.stroke();
      ctx.lineCap = 'butt';

      // Two counter-running streaks of light inside the beam.
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s < 7; s++) {
        const along = ((t * 330 + s * 97 + i * 53) % reach) + 20;
        const side = Math.sin(t * 30 + s * 2.3) * (PLAYER.laserHalfWidth + 7);
        ctx.moveTo(x + ax * along - ay * side, y + ay * along + ax * side);
        ctx.lineTo(x + ax * (along + 6) - ay * side, y + ay * (along + 6) + ax * side);
      }
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      for (let s = 0; s < 5; s++) {
        const along = reach - (((t * 470 + s * 131 + i * 71) % reach) + 18);
        const side = Math.cos(t * 26 + s * 1.7) * (PLAYER.laserHalfWidth * 0.55);
        ctx.moveTo(x + ax * along - ay * side, y + ay * along + ax * side);
        ctx.lineTo(x + ax * (along - 9) - ay * side, y + ay * (along - 9) + ax * side);
      }
      ctx.stroke();

      // Muzzle flare: a hot cap where the shaft leaves the avatar.
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      const muzzle = 0.6 + 0.4 * flicker;
      ctx.globalAlpha = 0.22 * muzzle;
      ctx.beginPath();
      ctx.arc(x0, y0, PLAYER.laserHalfWidth + 16, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(x0, y0, PLAYER.laserHalfWidth * 0.55, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(x0, y0, 6 + Math.sin(t * 40) * 1.4, 0, TWO_PI);
      ctx.fill();

      // Impact flare at the surface the shaft stopped on. A beam that meets nothing burns
      // out into a small taper instead, so the end never looks clipped.
      const hit = reach < PLAYER.laserRange;
      ctx.globalAlpha = (hit ? 0.85 : 0.3) * flicker;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x1, y1, hit ? PLAYER.laserHalfWidth * 0.7 : PLAYER.laserHalfWidth * 0.35, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = hit ? 0.95 : 0.4;
      ctx.beginPath();
      ctx.arc(x1, y1, hit ? 7 + Math.sin(t * 36) * 2 : 3, 0, TWO_PI);
      ctx.fill();
      if (hit) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        for (let s = 0; s < 8; s++) {
          const a = (s / 8) * TWO_PI + t * 1.8;
          const len = 10 + ((s * 7 + i * 3) % 9);
          ctx.moveTo(x1 + Math.cos(a) * 8, y1 + Math.sin(a) * 8);
          ctx.lineTo(x1 + Math.cos(a) * (8 + len), y1 + Math.sin(a) * (8 + len));
        }
        ctx.stroke();
      }
    }

    // Deflected shafts: a guard caught a heavy beam and glanced it away at the shield angle.
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active || p.beamReflectT <= 0) continue;
      const fade = Math.min(1, p.beamReflectT / PLAYER.laserReflectFlash);
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      const rx = Math.cos(p.beamReflectFacing);
      const ry = Math.sin(p.beamReflectFacing);
      const from = PLAYER.radius + 4;
      const to = Math.max(from + 12, p.beamReflectDist);
      const color = playerColor(state, p);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.22 * fade;
      ctx.lineWidth = PLAYER.laserHalfWidth * 2 + 30;
      ctx.beginPath();
      ctx.moveTo(x + rx * from, y + ry * from);
      ctx.lineTo(x + rx * to, y + ry * to);
      ctx.stroke();
      ctx.globalAlpha = 0.8 * fade;
      ctx.lineWidth = PLAYER.laserHalfWidth * 0.9;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.95 * fade;
      ctx.lineWidth = 3;
      ctx.stroke();
      // A star at the guard makes the catch read even when the shaft is short.
      ctx.globalAlpha = 0.9 * fade;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const flare = (1 - fade) * 14 + 8;
      ctx.moveTo(x, y - flare);
      ctx.lineTo(x + 2.4, y - 2.4);
      ctx.lineTo(x + flare, y);
      ctx.lineTo(x + 2.4, y + 2.4);
      ctx.lineTo(x, y + flare);
      ctx.lineTo(x - 2.4, y + 2.4);
      ctx.lineTo(x - flare, y);
      ctx.lineTo(x - 2.4, y - 2.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * Arena laser emitters: a wall housing, a converging gather, then a short red shaft.
   * The shaft is drawn to `beamDist`, so the picture and the damage stop on the same
   * surface. A caught beam stops at the guard, where the player's reflect star lands.
   */
  private drawEmitters(state: RenderState, t: number): void {
    const list = state.emitters;
    if (!list) return;
    const ctx = this.ctx;
    ctx.save();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);

      // The bracket is the emitter's body, not a free-floating orb. Two prongs frame a
      // red lens so the firing direction is readable even before the gather starts.
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#101820';
      ctx.fillRect(-18, -14, 20, 28);
      ctx.strokeStyle = 'rgba(255, 90, 76, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-18.5, -14.5, 21, 29);
      ctx.strokeStyle = 'rgba(255, 122, 100, 0.65)';
      ctx.beginPath();
      ctx.moveTo(-2, -12);
      ctx.lineTo(8, -8);
      ctx.moveTo(-2, 12);
      ctx.lineTo(8, 8);
      ctx.stroke();
      ctx.fillStyle = '#2a0d0c';
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = e.phase === 2 ? '#fff4ed' : '#ff5a4c';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = e.phase === 2 ? '#ffd9cf' : '#ff3b2e';
      ctx.beginPath();
      ctx.arc(0, 0, e.phase === 2 ? 4.6 : 2.6 + e.charge * 1.2, 0, TWO_PI);
      ctx.fill();

      // Gather. The dots walk inward as `charge` climbs, so the window reads as a
      // power-up rather than a second warning bar. The ring gives the lens a pulse.
      if (e.phase === 1) {
        const charge = Math.min(1, Math.max(0, e.charge));
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#ff4a34';
        ctx.globalAlpha = 0.14 + charge * 0.5;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 10 + (1 - charge) * 38, 0, TWO_PI);
        ctx.stroke();

        const dots = Math.max(4, EMITTER.gatherDots);
        for (let k = 0; k < dots; k++) {
          const spin = t * (0.7 + (k % 3) * 0.13) + k * 2.399;
          const radial = (1 - charge) * (44 + (k % 5) * 7) + 3;
          const px = Math.cos(spin) * radial;
          const py = Math.sin(spin) * radial;
          const size = 1.1 + charge * 2.1;
          ctx.globalAlpha = 0.35 + charge * 0.6;
          ctx.fillStyle = k % 3 === 0 ? '#ffd2c6' : '#ff3b2e';
          ctx.beginPath();
          ctx.arc(px, py, size, 0, TWO_PI);
          ctx.fill();
          if (k % 2 === 0) {
            // A short radial streak makes the dot read as "inbound", not "orbiting".
            ctx.globalAlpha = 0.18 + charge * 0.3;
            ctx.strokeStyle = '#ff5a4c';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px * 1.22, py * 1.22);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 0.55 + charge * 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 1.4 + charge * 2.2, 0, TWO_PI);
        ctx.fill();
      }

      if (e.phase === 2 && e.beamDist > 0) {
        const flicker = 0.82 + 0.18 * Math.sin(t * 58 + i * 2.1);
        const x0 = 8;
        const x1 = Math.max(x0 + 6, e.beamDist);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#ff3b2e';
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x1, 0);
        ctx.globalAlpha = 0.06 * flicker;
        ctx.lineWidth = EMITTER.halfWidth * 2 + 46;
        ctx.stroke();
        ctx.globalAlpha = 0.14 * flicker;
        ctx.lineWidth = EMITTER.halfWidth * 2 + 22;
        ctx.stroke();
        ctx.globalAlpha = 0.34 * flicker;
        ctx.lineWidth = EMITTER.halfWidth * 2 + 8;
        ctx.stroke();
        ctx.globalAlpha = 0.7 * flicker;
        ctx.lineWidth = EMITTER.halfWidth * 2;
        ctx.stroke();
        ctx.globalAlpha = 0.42 * flicker;
        ctx.lineWidth = EMITTER.halfWidth * 1.2;
        ctx.stroke();
        ctx.strokeStyle = '#fff1e8';
        ctx.globalAlpha = 0.55 * flicker;
        ctx.lineWidth = 5.6;
        ctx.stroke();
        ctx.globalAlpha = 0.95 * flicker;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Side rails: they give the shaft an edge against a bright floor, the same read
        // as the player heavy beam at this narrower width.
        ctx.strokeStyle = '#ff5a4c';
        ctx.globalAlpha = 0.45 * flicker;
        ctx.lineWidth = 1.1;
        const rail = EMITTER.halfWidth + 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, -rail);
        ctx.lineTo(x1, -rail);
        ctx.moveTo(x0, rail);
        ctx.lineTo(x1, rail);
        ctx.stroke();

        // Muzzle and impact. The impact sits where the damage line ended, so a beam
        // stopped by a pillar visibly burns against that pillar.
        ctx.fillStyle = '#ff5a4c';
        ctx.globalAlpha = 0.5 * flicker;
        ctx.beginPath();
        ctx.arc(x0, 0, EMITTER.halfWidth + 6, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.9 * flicker;
        ctx.beginPath();
        ctx.arc(x0, 0, 3.4, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#ff5a4c';
        ctx.globalAlpha = 0.75 * flicker;
        ctx.beginPath();
        ctx.arc(x1, 0, EMITTER.halfWidth * 0.7, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.9 * flicker;
        ctx.beginPath();
        ctx.arc(x1, 0, 5.4, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  /**
   * Side sparks while a heavy beam is live: little streaks peel off both edges of the
   * shaft and fade, plus a spray at the surface it stopped on. Emitted once per frame,
   * never once per split pane.
   */
  private emitLaserSparks(state: RenderState, alpha: number, fx: Fx, dt: number): void {
    this.laserSparkT -= dt;
    if (this.laserSparkT > 0) return;
    this.laserSparkT = 0.026;
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active || !p.alive || p.laserT <= 0) continue;
      if (p.program === PROGRAM_ID.TOXIC) continue;
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      const ax = Math.cos(p.laserFacing);
      const ay = Math.sin(p.laserFacing);
      const reach = Math.max(
        PLAYER.radius + 20,
        beamReach(state.arena, state.barriers, state.pusherActive === true, state.pusherY ?? 0, x, y, ax, ay, PLAYER.laserRange),
      );
      const sideX = -ay;
      const sideY = ax;
      // Two edge sparks at random points along the shaft.
      for (let k = 0; k < 2; k++) {
        const along = 34 + Math.random() * Math.max(1, reach - 60);
        const edge = PLAYER.laserHalfWidth + 2 + Math.random() * 10;
        const dir = Math.random() < 0.5 ? -1 : 1;
        const px = x + ax * along + sideX * edge * dir;
        const py = y + ay * along + sideY * edge * dir;
        const out = 50 + Math.random() * 140;
        fx.particles.spawn(
          0,
          px,
          py,
          sideX * out * dir + ax * (40 + Math.random() * 80),
          sideY * out * dir + ay * (40 + Math.random() * 80),
          0.1 + Math.random() * 0.18,
          1.2 + Math.random() * 1.8,
          p.slot,
          5,
        );
      }
      // Impact spray at the solid end, kicked back along the shaft.
      if (reach < PLAYER.laserRange) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        fx.particles.spawn(
          0,
          x + ax * reach,
          y + ay * reach,
          -ax * (90 + Math.random() * 90) + sideX * (60 + Math.random() * 90) * dir,
          -ay * (90 + Math.random() * 90) + sideY * (60 + Math.random() * 90) * dir,
          0.14 + Math.random() * 0.2,
          1.4 + Math.random() * 2,
          p.slot,
          4.5,
        );
      }
    }

    // Arena emitter shafts use their own red so the hazard is never mistaken for a
    // player's program color. Sparks peel off both rails, and the stopped end sprays.
    const emitters = state.emitters;
    if (emitters) {
      for (let i = 0; i < emitters.length; i++) {
        const e = emitters[i];
        if (e.phase !== 2 || e.beamDist <= 0) continue;
        const ax = Math.cos(e.angle);
        const ay = Math.sin(e.angle);
        const sideX = -ay;
        const sideY = ax;
        for (let k = 0; k < 3; k++) {
          const along = 14 + Math.random() * Math.max(1, e.beamDist - 24);
          const edge = EMITTER.halfWidth + 2 + Math.random() * 8;
          const dir = Math.random() < 0.5 ? -1 : 1;
          const out = 45 + Math.random() * 120;
          fx.particles.spawn(
            0,
            e.x + ax * along + sideX * edge * dir,
            e.y + ay * along + sideY * edge * dir,
            sideX * out * dir + ax * (35 + Math.random() * 60),
            sideY * out * dir + ay * (35 + Math.random() * 60),
            0.1 + Math.random() * 0.16,
            1.1 + Math.random() * 1.7,
            P_COLOR_DANGER,
            5,
          );
        }
        if (!e.caught && e.beamDist < EMITTER.range) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          fx.particles.spawn(
            0,
            e.x + ax * e.beamDist,
            e.y + ay * e.beamDist,
            -ax * (80 + Math.random() * 80) + sideX * (50 + Math.random() * 80) * dir,
            -ay * (80 + Math.random() * 80) + sideY * (50 + Math.random() * 80) * dir,
            0.14 + Math.random() * 0.18,
            1.3 + Math.random() * 1.8,
            P_COLOR_DANGER,
            4.5,
          );
        }
      }
    }
  }

  /** Advances each projectile's trail once per frame, never once per split pane. */
  private updateTrails(state: RenderState, alpha: number): void {
    for (let i = 0; i < state.projectiles.length; i++) {
      const p = state.projectiles[i];
      if (!p.active) continue;
      // The thrown broom head, venom needle, bombs, the hourglass and Ghost's mouth
      // are solid objects, not bolts: no motion tail. Their bodies are drawn with the
      // rest of the shapes.
      if (p.type === 6 || p.type === 7 || p.type === 8 || p.type === 9 || p.type === 10 || p.type === 12 || p.type === 13) continue;
      this.pushTrail(p, lerp(p.prevX, p.x, alpha), lerp(p.prevY, p.y, alpha));
    }
  }

  private drawTrails(state: RenderState, alpha: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < state.projectiles.length; i++) {
      const p = state.projectiles[i];
      if (!p.active) continue;
      const hostile = p.owner < 0 && p.type >= 3;
      const ownerPlayer = p.owner >= 0 ? state.players[p.owner] : null;
      const color = hostile
        ? p.type === 4 ? THREAT_COLORS.homing : THREAT_COLORS.sentry
        : ownerPlayer
          ? playerColor(state, ownerPlayer)
          : particleColor(P_COLOR_ICE);
      // Solid throws carry no motion tail; the hourglass and the chomping mouth are
      // two of them.
      if (p.type !== 6 && p.type !== 7 && p.type !== 8 && p.type !== 9 && p.type !== 10 && p.type !== 12) {
        if (p.trailCount >= 2) {
      // Hostile shots get a short tail so the screen does not fill with long lines.
      // Atomize's electron is the exception: its whole read is the white arc, so it keeps
      // a long trail even though the ball itself is a player shot.
      const count =
        p.type === 11
          ? Math.min(p.trailCount, 14)
          : p.type === 14 || p.type === 15
            ? Math.min(p.trailCount, 18)
            : p.type >= 3
              ? Math.min(p.trailCount, 5)
              : p.trailCount;
      const start = (p.trailHead - count + TRAIL_LEN) % TRAIL_LEN;
      ctx.beginPath();
      for (let k = 0; k < count; k++) {
        const idx = (start + k) % TRAIL_LEN;
        if (k === 0) ctx.moveTo(p.trailX[idx], p.trailY[idx]);
        else ctx.lineTo(p.trailX[idx], p.trailY[idx]);
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = hostile ? 0.2 : p.type === 1 ? 0.14 : p.type === 11 ? 0.22 : 0.16 + Math.min(0.16, p.deflects * 0.04);
      ctx.lineWidth = hostile ? 4 : p.type === 1 ? 5 : p.type === 11 ? 5 : 7;
      ctx.stroke();
      ctx.globalAlpha = hostile ? 0.55 : p.type === 1 ? 0.3 : p.type === 11 ? 0.62 : 0.45 + Math.min(0.25, p.deflects * 0.05);
      ctx.lineWidth = hostile ? 1.6 : p.type === 1 ? 2 : p.type === 11 ? 2.2 : 2.6;
      ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private pushTrail(p: Projectile, x: number, y: number): void {
    if (p.trailCount > 0) {
      const last = (p.trailHead - 1 + TRAIL_LEN) % TRAIL_LEN;
      const dx = x - p.trailX[last];
      const dy = y - p.trailY[last];
      if (dx * dx + dy * dy < 100) return;
    }
    p.trailX[p.trailHead] = x;
    p.trailY[p.trailHead] = y;
    p.trailHead = (p.trailHead + 1) % TRAIL_LEN;
    if (p.trailCount < TRAIL_LEN) p.trailCount++;
  }

  /** Fisher's webs: a live strand on the floor plus the line being paid out. */
  /**
   * Traces a scanned polyline as a smoothed curve. Quadratic midpoints keep a
   * freeform web readable through hard turns without overshooting the drawn shape.
   */
  private traceNet(
    xs: Float32Array,
    ys: Float32Array,
    count: number,
    tipX: number,
    tipY: number,
    hasTip: boolean,
  ): void {
    const ctx = this.ctx;
    if (count < 1) return;
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < count; i++) {
      const px = xs[i];
      const py = ys[i];
      const nx = i + 1 < count ? xs[i + 1] : hasTip ? tipX : px;
      const ny = i + 1 < count ? ys[i + 1] : hasTip ? tipY : py;
      ctx.quadraticCurveTo(px, py, (px + nx) * 0.5, (py + ny) * 0.5);
    }
    if (hasTip) ctx.lineTo(tipX, tipY);
    else ctx.lineTo(xs[count - 1], ys[count - 1]);
  }

  private drawNets(state: RenderState, alpha: number, t: number): void {
    const ctx = this.ctx;
    const nets = state.nets!;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PROGRAM_COLORS.fisher;

    for (let i = 0; i < nets.length; i++) {
      const net = nets[i];
      if (!net.active || net.count < 2) continue;
      const fade = Math.min(1, net.life / 0.45);
      const pulse = 0.7 + 0.3 * Math.sin(t * 6 + net.phase);

      ctx.globalAlpha = 0.12 * fade * pulse;
      ctx.lineWidth = FISHER.netWidth * 2 + 12;
      this.traceNet(net.xs, net.ys, net.count, 0, 0, false);
      ctx.stroke();

      ctx.globalAlpha = 0.86 * fade;
      ctx.lineWidth = 2.2;
      this.traceNet(net.xs, net.ys, net.count, 0, 0, false);
      ctx.stroke();

      // Cross-hatch ticks perpendicular to each strand, so a curve still reads as a net.
      ctx.globalAlpha = 0.44 * fade;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let s = 1; s < net.count; s++) {
        const ax = net.xs[s - 1];
        const ay = net.ys[s - 1];
        const bx = net.xs[s];
        const by = net.ys[s];
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const half = FISHER.netWidth * (s & 1 ? 0.95 : 0.55);
        ctx.moveTo(bx - nx * half, by - ny * half);
        ctx.lineTo(bx + nx * half, by + ny * half);
      }
      ctx.stroke();

      ctx.globalAlpha = 0.75 * fade;
      ctx.lineWidth = 1.4;
      for (let e = 0; e < 2; e++) {
        const idx = e === 0 ? 0 : net.count - 1;
        ctx.beginPath();
        ctx.arc(net.xs[idx], net.ys[idx], 6 + 2 * Math.sin(t * 7 + e), 0, TWO_PI);
        ctx.stroke();
      }
    }

    // The freeform trail in hand while Fisher is still drawing it.
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active || !p.alive || !p.netDrawing || p.netIndex < 0) continue;
      const net = nets[p.netIndex];
      if (!net || net.count < 1) continue;
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      const tipX = x - Math.cos(p.facing) * 16;
      const tipY = y - Math.sin(p.facing) * 16;
      ctx.strokeStyle = PROGRAM_COLORS.fisher;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.6;
      this.traceNet(net.xs, net.ys, net.count, tipX, tipY, true);
      ctx.stroke();

      // Marcher dots along the drawn shape sell the line being paid out.
      ctx.fillStyle = PROGRAM_COLORS.fisher;
      let walked = 0;
      for (let s = 1; s < net.count; s++) {
        const dx = net.xs[s] - net.xs[s - 1];
        const dy = net.ys[s] - net.ys[s - 1];
        const len = Math.hypot(dx, dy);
        if (len < 0.001) continue;
        for (let d = 0; d < len; d += 16) {
          const f = d / len;
          ctx.globalAlpha = 0.3 + 0.22 * Math.sin(walked * 0.2 + t * 9);
          ctx.fillRect(net.xs[s - 1] + dx * f - 1.2, net.ys[s - 1] + dy * f - 1.2, 2.4, 2.4);
          walked += 16;
        }
      }
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 4 + 2 * Math.sin(t * 12), 0, TWO_PI);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * Pinball's deployed flipper: a fixed base, a tapered bat and a life arc around the
   * pivot. The arm is drawn on the floor plane under the avatars, so a body standing
   * beside it still reads over the top.
   */
  private drawPinballArms(state: RenderState, _alpha: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active || !p.alive || p.armT <= 0) continue;
      const color = playerColor(state, p);
      const grow = Math.min(1, (p.armMax - p.armT) / 0.16);
      const fade = Math.min(1, p.armT / 0.55);
      const tipX = p.armX + Math.cos(p.armAngle) * PINBALL.armLength;
      const tipY = p.armY + Math.sin(p.armAngle) * PINBALL.armLength;
      const nx = -Math.sin(p.armAngle);
      const ny = Math.cos(p.armAngle);
      const baseW = 4.5 * grow;
      const tipW = 8.5 * grow;

      // Sweep arc: a faint track of where the bat travels, so the covered lane is
      // readable before the paddle reaches it.
      ctx.globalAlpha = 0.08 * fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.armX, p.armY, PINBALL.armLength, p.armBaseAngle - PINBALL.armArc, p.armBaseAngle + PINBALL.armArc);
      ctx.stroke();

      // Bat body: dark underlay, colour edge, bright inner line. It shares the health
      // hull's tapered paddle, so the deployed arm and the swing read as one device.
      ctx.beginPath();
      pathPinballFlipper(ctx, p.armX, p.armY, p.armAngle, PINBALL.armLength, baseW, tipW);
      ctx.globalAlpha = 0.9 * fade;
      ctx.fillStyle = 'rgba(4, 10, 16, 0.92)';
      ctx.fill();
      ctx.globalAlpha = 0.95 * fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.globalAlpha = 0.5 * fade;
      ctx.strokeStyle = '#e9f4ff';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(p.armX + nx * 1.6, p.armY + ny * 1.6);
      ctx.lineTo(tipX + nx * 2.2, tipY + ny * 2.2);
      ctx.stroke();

      // Paddle cap: a solid bright head, the part that does the work.
      ctx.globalAlpha = fade;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(tipX, tipY, tipW * 0.62, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#eef8ff';
      ctx.beginPath();
      ctx.arc(tipX, tipY, tipW * 0.26, 0, TWO_PI);
      ctx.fill();

      // Pivot housing and a life arc, the only timer on the arm.
      ctx.globalAlpha = 0.95 * fade;
      ctx.fillStyle = 'rgba(4, 10, 16, 0.95)';
      ctx.beginPath();
      ctx.arc(p.armX, p.armY, 11.5 * grow, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(p.armX, p.armY, 11.5 * grow, 0, TWO_PI);
      ctx.stroke();
      const life = Math.max(0, Math.min(1, p.armT / Math.max(0.001, p.armMax)));
      ctx.strokeStyle = '#e9f4ff';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(p.armX, p.armY, 16, -Math.PI * 0.5, -Math.PI * 0.5 + TWO_PI * life);
      ctx.stroke();

      // A tiny spark at the cap while the arm is live, so it never looks inert.
      ctx.globalAlpha = (0.35 + 0.3 * Math.sin(t * 9 + i)) * fade;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 13 + Math.sin(t * 9 + i) * 2, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Fisher's lure: a pulsing beacon, not a threat-coloured enemy. */
  /**
   * Wedge's wall: the same bracket silhouette as his dash, planted as a solid panel.
   * The open side always faces the owner so a glance reads which way it was deployed.
   */
  private drawBarriers(barriers: readonly Barrier[], t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PROGRAM_COLORS.wedge;
    ctx.fillStyle = PROGRAM_COLORS.wedge;
    ctx.lineCap = 'square';
    for (let i = 0; i < barriers.length; i++) {
      const wall = barriers[i];
      if (!wall.active) continue;
      const grow = Math.min(1, (wall.maxLife - wall.life) / 0.14);
      const fade = Math.min(1, wall.life / 0.4);
      const shake = wall.hitFlash > 0 ? Math.sin(wall.hitFlash * 150) * (wall.hitFlash / WEDGE.wallFlash) * 3 : 0;
      ctx.save();
      ctx.translate(wall.nx * shake, wall.ny * shake);
      const arm = 16 * grow;
      const ax = wall.x1 + wall.nx * arm;
      const ay = wall.y1 + wall.ny * arm;
      const bx = wall.x2 + wall.nx * arm;
      const by = wall.y2 + wall.ny * arm;

      // Faint pane between the bar and its arms.
      ctx.globalAlpha = 0.07 * fade * grow;
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.lineTo(bx, by);
      ctx.lineTo(ax, ay);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.lineTo(bx, by);

      ctx.globalAlpha = 0.16 * fade * grow;
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.globalAlpha = 0.92 * fade;
      ctx.lineWidth = WEDGE.wallThickness;
      ctx.stroke();
      ctx.globalAlpha = 0.8 * fade;
      ctx.strokeStyle = '#fff2d6';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = PROGRAM_COLORS.wedge;

      // Damage read: the plate darkens and splits where it has been hit. No health bar;
      // the cracks are the read, the way the hull segments are on a program.
      const hurt = 1 - wall.hp / Math.max(1, wall.maxHp);
      const stage = wall.hp < wall.maxHp ? 1 + Math.floor(hurt * 3) : 0;
      if (stage > 0) {
        const tx = wall.x2 - wall.x1;
        const ty = wall.y2 - wall.y1;
        const len = Math.hypot(tx, ty) || 1;
        const ux = tx / len;
        const uy = ty / len;
        ctx.globalAlpha = Math.min(1, 0.5 + 0.15 * stage) * fade;
        ctx.strokeStyle = '#3a1206';
        ctx.lineWidth = stage >= 3 ? 2.4 : 1.6;
        ctx.beginPath();
        for (let c = 0; c < stage; c++) {
          const f = 0.16 + 0.28 * c;
          const cx = wall.x1 + tx * f;
          const cy = wall.y1 + ty * f;
          const jag = 5 + c * 2;
          ctx.moveTo(cx - ux * 7 + wall.nx * jag, cy - uy * 7 + wall.ny * jag);
          ctx.lineTo(cx + ux * 10 - wall.nx * jag, cy + uy * 10 - wall.ny * jag);
        }
        ctx.stroke();
        ctx.strokeStyle = PROGRAM_COLORS.wedge;
      }

      // End caps blink while the wall is about to drop.
      if (wall.life < 0.8) {
        ctx.globalAlpha = (0.5 + 0.5 * Math.sin(t * 18)) * (1 - wall.life / 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax - wall.ny * 4, ay + wall.nx * 4);
        ctx.lineTo(ax + wall.ny * 4, ay - wall.nx * 4);
        ctx.moveTo(bx - wall.ny * 4, by + wall.nx * 4);
        ctx.lineTo(bx + wall.ny * 4, by - wall.nx * 4);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawLures(lures: readonly Lure[], t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PROGRAM_COLORS.lure;
    ctx.fillStyle = PROGRAM_COLORS.lure;
    for (let i = 0; i < lures.length; i++) {
      const lure = lures[i];
      if (!lure.active) continue;
      const fade = Math.min(1, lure.life / 0.5);
      const pulse = 0.5 + 0.5 * Math.sin(t * 5 + lure.phase);
      ctx.globalAlpha = 0.2 * fade * pulse;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(lure.x, lure.y, 18 + 5 * pulse, 0, TWO_PI);
      ctx.stroke();
      ctx.globalAlpha = 0.7 * fade;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(lure.x, lure.y, 24, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([3, 6]);
      ctx.globalAlpha = 0.28 * fade;
      ctx.beginPath();
      ctx.arc(lure.x, lure.y, 42 + 4 * pulse, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
      // Four inward ticks mark it as an attractor.
      ctx.globalAlpha = 0.75 * fade;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = t * 0.8 + k * (Math.PI / 2);
        const inner = 12;
        const outer = 19 + 3 * pulse;
        ctx.moveTo(lure.x + Math.cos(a) * outer, lure.y + Math.sin(a) * outer);
        ctx.lineTo(lure.x + Math.cos(a) * inner, lure.y + Math.sin(a) * inner);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.95 * fade;
      ctx.beginPath();
      ctx.moveTo(lure.x, lure.y - 5);
      ctx.lineTo(lure.x + 5, lure.y);
      ctx.lineTo(lure.x, lure.y + 5);
      ctx.lineTo(lure.x - 5, lure.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawProjectiles(state: RenderState, alpha: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < state.projectiles.length; i++) {
      const p = state.projectiles[i];
      if (!p.active) continue;
      // A bomb still waiting its turn in the power's spray is not on the field yet.
      if ((p.type === 8 || p.type === 9) && p.grace > 0) continue;
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      const hostile = p.owner < 0 && p.type >= 3;
      const ownerPlayer = p.owner >= 0 ? state.players[p.owner] : null;
      const ownerProgram = ownerPlayer ? ownerPlayer.program : -1;
      const color = hostile
        ? p.type === 4 ? THREAT_COLORS.homing : THREAT_COLORS.sentry
        : ownerPlayer
          ? playerColor(state, ownerPlayer)
          : particleColor(P_COLOR_ICE);
      if (p.type === 14 || p.type === 15) {
        // Pinball's ball: a chrome ring with the program's X stamp. The small ball
        // spins its stamp, while the super ball is a huge rolling weight with a heavy
        // outer glow. Heat ticks (bodies struck) brighten the core, so the escalating
        // damage is visible before the next hit lands.
        const big = p.type === 15;
        const r = p.radius * (big ? 1.05 : 1.2);
        const heat = Math.min(1, p.hits / 5);
        ctx.save();
        ctx.translate(x, y);
        // Motion streak behind the ball, in the owner's colour. A tapered wedge reads
        // as speed without the heavy rectangular smear a thick round line leaves.
        const trailLen = r * (big ? 2.5 : 1.9);
        const trailHalf = r * (big ? 0.5 : 0.32);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = color;
        ctx.globalAlpha = big ? 0.2 : 0.28;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.72);
        ctx.lineTo(-trailLen, -trailHalf);
        ctx.lineTo(-trailLen, trailHalf);
        ctx.lineTo(0, r * 0.72);
        ctx.closePath();
        ctx.fill();
        // Solid ball: the whole disc is filled with the owner's colour, with a darker
        // lower edge and a fixed top reflection. The highlight never spins with the shot,
        // so it reads as a light source above the table rather than a stamped mark.
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TWO_PI);
        ctx.fill();
        // Outer colour ring; thicker on the super ball so a large solid disc does not
        // blend into the additive trail behind it.
        ctx.globalAlpha = big ? 0.24 : 0.16;
        ctx.strokeStyle = color;
        ctx.lineWidth = big ? 7 : 4.5;
        ctx.beginPath();
        ctx.arc(0, 0, r + 1, 0, TWO_PI);
        ctx.stroke();
        // Shade the lower edge so the disc reads as a sphere, not a flat dot.
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = 'rgba(3, 9, 16, 0.9)';
        ctx.lineWidth = Math.max(1.4, r * 0.18);
        ctx.beginPath();
        ctx.arc(0, 0, r - Math.max(0.6, r * 0.09), Math.PI * 0.08, Math.PI * 0.92);
        ctx.stroke();
        // Top reflection: one soft wash and one tight glint. The pair sells the solid,
        // glossy ball at both projectile sizes.
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = big ? 0.2 : 0.17;
        ctx.beginPath();
        ctx.ellipse(-r * 0.2, -r * 0.36, r * 0.48, r * 0.28, -0.5, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = big ? 0.86 : 0.8;
        ctx.beginPath();
        ctx.ellipse(-r * 0.27, -r * 0.44, r * 0.24, r * 0.12, -0.5, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = 0.32;
        ctx.beginPath();
        ctx.ellipse(r * 0.3, -r * 0.3, r * 0.09, r * 0.05, -0.5, 0, TWO_PI);
        ctx.fill();
        if (heat > 0) {
          // Every body struck heats the rim and the reflection, so the damage ladder is
          // visible before the next bounce lands.
          ctx.globalAlpha = 0.2 + heat * 0.38;
          ctx.strokeStyle = '#ffd9a0';
          ctx.lineWidth = Math.max(1.4, r * 0.16);
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.08, 0, TWO_PI);
          ctx.stroke();
          ctx.globalAlpha = 0.6 + heat * 0.3;
          ctx.fillStyle = '#fff4df';
          ctx.beginPath();
          ctx.ellipse(-r * 0.27, -r * 0.44, r * 0.27, r * 0.15, -0.5, 0, TWO_PI);
          ctx.fill();
        }
        ctx.restore();
      } else if (p.type === 17) {
        // Aim Bot's rail round: a long copper-red tracer with a hard white tip. The
        // speed tail is deliberately much longer than the body, so a shot reads as a
        // line crossing the room instead of a slow orb.
        const angle = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.24;
        ctx.beginPath();
        ctx.moveTo(-p.radius, -p.radius * 0.5);
        ctx.lineTo(-58, -1.2);
        ctx.lineTo(-72, 0);
        ctx.lineTo(-58, 1.2);
        ctx.lineTo(-p.radius, p.radius * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-p.radius, 0);
        ctx.lineTo(-58, 0);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(8, 10, 14, 0.95)';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.8, p.radius, 0, 0, TWO_PI);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = '#fff2e8';
        ctx.beginPath();
        ctx.moveTo(p.radius * 1.8, 0);
        ctx.lineTo(p.radius * 0.4, -p.radius * 0.45);
        ctx.lineTo(p.radius * 0.4, p.radius * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.type === 16) {
        // Copy Pasta's file: a dark document with a folded corner and two text rules,
        // stamped in the owner's colour. Children draw smaller so the chain reads.
        const angle = Math.atan2(p.vy, p.vx);
        const r = p.radius * (p.variant > 0 ? 0.78 : 1);
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.globalAlpha = p.variant > 0 ? 0.82 : 1;
        ctx.fillStyle = 'rgba(4, 9, 14, 0.94)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        pathFileIcon(ctx, 0, 0, r * 0.9, r);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = -1; k <= 1; k++) {
          ctx.moveTo(-r * 0.52, k * r * 0.34);
          ctx.lineTo(r * 0.34, k * r * 0.34);
        }
        ctx.stroke();
        ctx.restore();
      } else if (p.type === 5) {
        const angle = Math.atan2(p.vy, p.vx);
        const len = 28 + Math.min(12, p.deflects * 3);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(len, 0);
        ctx.lineTo(-len * 0.45, -6);
        ctx.lineTo(-len * 0.45, 6);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(len, 0);
        ctx.lineTo(-len * 0.55, -3.4);
        ctx.lineTo(-len * 0.7, 0);
        ctx.lineTo(-len * 0.55, 3.4);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(len * 0.5, 0);
        ctx.lineTo(-len * 0.25, -1.2);
        ctx.lineTo(-len * 0.25, 1.2);
        ctx.closePath();
        ctx.fill();
        // Small barbs sell the two-damage pin as a harpoon, not a blast.
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(2, -3);
        ctx.lineTo(-6, -9);
        ctx.moveTo(2, 3);
        ctx.lineTo(-6, 9);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === 6) {
        // Thrown broom: head only, held upright like every other broom this program
        // draws. No handle, no motion tail, and it dies on geometry instead of bouncing.
        // The head is a touch wider than the collision radius so the extra reach reads;
        // the larger `half` also buys another binder and bristle column in the ASCII row.
        this.drawBroomText(x, y - 16, 20, 34, Math.PI / 2, 0.95, color);
      } else if (p.type === 12) {
        // Ghost's mouth: a wide maw with sharp triangles on both jaws. The jaw height
        // oscillates, so the throw visibly chomps as it travels. No motion tail.
        const angle = Math.atan2(p.vy, p.vx);
        const jaw = p.radius * (0.48 + 0.44 * Math.abs(Math.sin(t * 13 + p.serial * 1.7)));
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(x, y);
        ctx.rotate(angle);
        // Halo first, then the dark interior, so the teeth stay crisp instead of
        // washing into the additive bolt glow around it.
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.7, jaw * 1.8, 0, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(3, 9, 14, 0.92)';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.18, jaw, 0, 0, TWO_PI);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.2, jaw, 0, 0, TWO_PI);
        ctx.stroke();
        // Five teeth on each jaw. They point into the dark opening and scale with the
        // chomp, which is what separates the shape from a plain spiked ring.
        ctx.fillStyle = '#e9eef4';
        ctx.beginPath();
        for (let tooth = -2; tooth <= 2; tooth++) {
          const tx = tooth * p.radius * 0.42;
          const tw = p.radius * 0.15;
          const upper = -jaw * 0.72;
          const lower = jaw * 0.72;
          ctx.moveTo(tx - tw, upper);
          ctx.lineTo(tx + tw, upper);
          ctx.lineTo(tx, upper + jaw * 0.55);
          ctx.closePath();
          ctx.moveTo(tx - tw, lower);
          ctx.lineTo(tx + tw, lower);
          ctx.lineTo(tx, lower - jaw * 0.55);
          ctx.closePath();
        }
        ctx.fill();
        ctx.restore();
      } else if (p.type === 13) {
        // Compress's orb: a pressure sphere with a down-caret pressed into it. The
        // caret is the "one size down" mark and stays legible at the orb's size; the
        // orb is drawn as a solid object with no motion tail.
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 2.2, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, TWO_PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = Math.max(1.6, p.radius * 0.26);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-p.radius * 0.42, -p.radius * 0.24);
        ctx.lineTo(0, p.radius * 0.26);
        ctx.lineTo(p.radius * 0.42, -p.radius * 0.24);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === 10) {
        // Heavy hourglass: the program's own mark, spinning on its axis inside a soft
        // weight halo. No tail, no handle: it is one solid object in flight.
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 2.1, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = 0.96;
        ctx.rotate(p.spin);
        drawHourglassMark(ctx, 0, 0, p.radius * 1.35);
        ctx.restore();
      } else if (p.type === 7) {
        // Venom needle: a hypodermic, drawn with shapes. The typed dagger read as a
        // cross at this size and lost the syringe entirely.
        const angle = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.7, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
        this.drawSyringe(x, y, angle, p.radius, color);
      } else if (p.type === 8 || p.type === 9) {
        // Kaboom's shell: the bomb mark upright on the ground plane, a live fuse spark,
        // and, for a lobbed shell, a short arc lift plus its landing shadow.
        const prog = programDef(PROGRAM_ID.KABOOM);
        const arcPct = p.arcDur > 0 ? 1 - Math.max(0, Math.min(1, p.fuse / p.arcDur)) : 1;
        const lift = p.arcDur > 0 ? Math.sin(Math.PI * arcPct) * 54 : 0;
        const coreR = p.type === 9 ? p.radius * 1.5 : p.radius * 1.15;
        if (lift > 1) {
          ctx.globalAlpha = 0.24;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(x, y + 4, p.radius * 1.2, p.radius * 0.44, 0, 0, TWO_PI);
          ctx.fill();
        }
        ctx.save();
        ctx.translate(x, y - lift);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 1.6, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = 0.96;
        drawProgramMark(ctx, PROGRAM_ID.KABOOM, prog.glyph, prog.symbolFont, 0, 0, coreR, prog.coreScale);
        const spark = 0.5 + 0.5 * Math.sin(t * 22 + p.serial);
        ctx.fillStyle = '#fff6e0';
        ctx.fillRect(coreR * 0.55, -coreR * 1.3, 2 + spark * 2, 2 + spark * 2);
        ctx.restore();
      } else if (p.type === 11) {
        // Atomize's electron: a coloured ball with a white hot core. The motion trail
        // is drawn by drawTrails in the owner's white, so the arc is the white line.
        const ball = ATOM_BOLT_COLORS[((p.variant % 3) + 3) % 3];
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = ball;
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 2.6, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.9, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-1.2, -1.2, p.radius * 0.34, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 18) {
        // Rain drop: a teardrop with a thin streak above it. It has to read as a
        // shootable object, not as harmless weather, so the head is solid and bright.
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = STORM_CLOUD.rainColor;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(-1.1, -p.radius * 3.4, 2.2, p.radius * 2.4);
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.moveTo(0, -p.radius * 1.75);
        ctx.quadraticCurveTo(p.radius * 1.05, -p.radius * 0.1, 0, p.radius);
        ctx.quadraticCurveTo(-p.radius * 1.05, -p.radius * 0.1, 0, -p.radius * 1.75);
        ctx.fill();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#eaf7ff';
        ctx.beginPath();
        ctx.arc(-p.radius * 0.22, -p.radius * 0.18, p.radius * 0.3, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 19) {
        // Storm bolt: a jagged lance along its flight line, with a white core.
        const angle = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = STORM_CLOUD.bolt;
        ctx.lineJoin = 'miter';
        for (const pass of [0, 1]) {
          ctx.globalAlpha = pass === 0 ? 0.32 : 0.95;
          ctx.lineWidth = pass === 0 ? p.radius * 1.5 : p.radius * 0.45;
          ctx.beginPath();
          ctx.moveTo(p.radius * 1.5, 0);
          ctx.lineTo(p.radius * 0.2, -p.radius * 0.85);
          ctx.lineTo(-p.radius * 0.2, -p.radius * 0.2);
          ctx.lineTo(-p.radius * 1.8, -p.radius * 1.1);
          ctx.lineTo(-p.radius * 0.75, p.radius * 0.1);
          ctx.lineTo(-p.radius * 0.1, p.radius * 0.35);
          ctx.lineTo(p.radius * 1.5, 0);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.radius * 1.1, 0, p.radius * 0.28, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      } else if (p.type >= 3) {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        if (p.type === 4) {
          // Trapezoid missile pod, deliberately slower and fatter than a bolt.
          const body = p.radius * 1.45;
          const tail = p.radius * 1.2;
          ctx.globalAlpha = 0.16;
          ctx.beginPath();
          ctx.moveTo(body + 9, 0);
          ctx.lineTo(-tail - 6, -p.radius - 5);
          ctx.lineTo(-tail - 6, p.radius + 5);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.85;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(body, 0);
          ctx.lineTo(-tail * 0.6, -p.radius * 0.74);
          ctx.lineTo(-tail, 0);
          ctx.lineTo(-tail * 0.6, p.radius * 0.74);
          ctx.closePath();
          ctx.stroke();
          ctx.globalAlpha = 0.75 + 0.2 * Math.sin(t * 18 + p.serial);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(body * 0.7, 0);
          ctx.lineTo(-tail * 0.25, -2.4);
          ctx.lineTo(-tail * 0.25, 2.4);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.5;
          ctx.fillRect(-tail - 10, -3, 5, 6);
        } else {
          // Tiny hostile shot: a hard diamond, not another player-coloured bolt.
          ctx.globalAlpha = 0.2;
          ctx.fillRect(-p.radius - 4, -p.radius - 4, (p.radius + 4) * 2, (p.radius + 4) * 2);
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(p.radius + 2, 0);
          ctx.lineTo(0, p.radius);
          ctx.lineTo(-p.radius, 0);
          ctx.lineTo(0, -p.radius);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = '#fff4e8';
          ctx.fillRect(-1.4, -1.4, 2.8, 2.8);
        }
        ctx.restore();
      } else if (p.type === 0) {
        const speed = Math.hypot(p.vx, p.vy) || 1;
        const angle = Math.atan2(p.vy, p.vx);
        const len = 13 + Math.min(12, p.deflects * 2.5);
        const wid = 6 + Math.min(4, p.deflects * 1.2);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        if (ownerProgram === PROGRAM_ID.WEDGE) {
          // Squared bracket shards, not a round bolt.
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(len, 0);
          ctx.lineTo(len * 0.1, wid);
          ctx.lineTo(-len * 0.72, wid * 0.72);
          ctx.lineTo(-len * 0.72, -wid * 0.72);
          ctx.lineTo(len * 0.1, -wid);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.95;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(len * 0.76, 0);
          ctx.lineTo(len * 0.18, wid * 0.5);
          ctx.moveTo(len * 0.76, 0);
          ctx.lineTo(len * 0.18, -wid * 0.5);
          ctx.stroke();
        } else {
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.moveTo(len, 0);
          ctx.lineTo(0, wid);
          ctx.lineTo(-len * 0.9, 0);
          ctx.lineTo(0, -wid);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.95;
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = color;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(len * 0.65, 0);
          ctx.lineTo(0, wid * 0.34);
          ctx.lineTo(-len * 0.5, 0);
          ctx.lineTo(0, -wid * 0.34);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        void speed;
      } else if (p.type === 2) {
        const arming = p.grace > 0;
        const live = !p.armed && !arming;
        ctx.save();
        ctx.translate(x, y);
        if (live) {
          const slowPulse = 0.55 + 0.25 * Math.sin(t * 8 + p.serial);
          ctx.globalAlpha = 0.08 + 0.05 * slowPulse;
          ctx.fillStyle = '#ff54d8';
          ctx.beginPath();
          ctx.arc(0, 0, BUG.trapRadius, 0, TWO_PI);
          ctx.fill();
          ctx.globalAlpha = 0.25;
          ctx.strokeStyle = '#ff54d8';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 7]);
          ctx.beginPath();
          ctx.arc(0, 0, BUG.trapRadius, 0, TWO_PI);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = arming ? 0.45 + 0.3 * Math.abs(Math.sin(t * 18)) : live ? 0.9 : 0.7;
        ctx.strokeStyle = live ? '#ff54d8' : color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 2, 0, TWO_PI);
        ctx.stroke();
        ctx.beginPath();
        for (let s = 0; s < 4; s++) {
          const a = s * (Math.PI / 2) + Math.PI / 4 + (live ? 0 : t * 0.8);
          ctx.moveTo(Math.cos(a) * (p.radius - 3), Math.sin(a) * (p.radius - 3));
          ctx.lineTo(Math.cos(a) * (p.radius + 8), Math.sin(a) * (p.radius + 8));
        }
        ctx.stroke();
        ctx.globalAlpha = live ? 0.95 : 0.5 + 0.4 * Math.sin(t * 12 + p.serial);
        ctx.fillStyle = live ? '#ff54d8' : color;
        ctx.beginPath();
        ctx.arc(0, 0, 2.6, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      } else {
        const arming = p.grace > 0;
        const blink = 0.7 + 0.3 * Math.abs(Math.sin(t * 3 + p.serial));
        const pulse = 0.65 + 0.35 * Math.sin(t * 9 + p.serial);
        ctx.save();
        ctx.translate(x, y);

        // Trigger field: a faint ring shows the proximity radius once armed.
        if (!arming) {
          ctx.globalAlpha = 0.08 + 0.04 * pulse;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 6]);
          ctx.beginPath();
          ctx.arc(0, 0, MINE.triggerRadius, 0, TWO_PI);
          ctx.stroke();
          // The blast reaches much farther than the trip radius; show its edge faintly
          // so the larger area is readable before someone steps in.
          ctx.globalAlpha = 0.045 + 0.02 * pulse;
          ctx.beginPath();
          ctx.arc(0, 0, MINE.blastRadius, 0, TWO_PI);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.globalAlpha = arming ? 0.35 : blink;
        ctx.fillStyle = color;
        ctx.save();
        ctx.rotate(arming ? t * 9 : t * 1.4 + p.serial);
        ctx.beginPath();
        ctx.moveTo(0, -p.radius);
        ctx.lineTo(p.radius, 0);
        ctx.lineTo(0, p.radius);
        ctx.lineTo(-p.radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.globalAlpha = arming ? 0.9 : blink;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.save();
        ctx.rotate(-t * (arming ? 12 : 0.7));
        ctx.strokeRect(-p.radius - 5, -p.radius - 5, (p.radius + 5) * 2, (p.radius + 5) * 2);
        ctx.restore();

        // Core plus armed ring. There is no countdown: the mine lasts until triggered.
        ctx.fillStyle = arming ? color : '#ffffff';
        ctx.globalAlpha = arming ? 0.55 + 0.4 * Math.abs(Math.sin(t * 22)) : 0.95;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, TWO_PI);
        ctx.fill();
        ctx.strokeStyle = arming ? '#dff7ff' : '#ff7a3c';
        ctx.globalAlpha = arming ? 0.5 : 0.6 + 0.25 * Math.abs(Math.sin(t * 4 + p.serial));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 5, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Advances the charged-dash trail samples once per frame, never once per pane. */
  private updatePlayerTrails(state: RenderState, t: number): void {
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active || !p.alive || p.dashT <= 0 || p.dashKind !== 1) continue;
      const dx = p.x - this.trailLastX[p.slot];
      const dy = p.y - this.trailLastY[p.slot];
      if (t - this.trailLastT[p.slot] < SPIN_TRAIL_INTERVAL || dx * dx + dy * dy <= 9) continue;
      const index = p.slot * SPIN_TRAIL_LEN + this.trailHead[p.slot];
      this.trailX[index] = p.x;
      this.trailY[index] = p.y;
      this.trailBirth[index] = t;
      this.trailHead[p.slot] = (this.trailHead[p.slot] + 1) % SPIN_TRAIL_LEN;
      this.trailLastT[p.slot] = t;
      this.trailLastX[p.slot] = p.x;
      this.trailLastY[p.slot] = p.y;
    }
  }

  /** Fading squares mark the path of a charged triangle dash. */
  private drawPlayerTrails(state: RenderState, t: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active) continue;
      const base = p.slot * SPIN_TRAIL_LEN;
      const color = playerColor(state, p);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = color;
      for (let k = 0; k < SPIN_TRAIL_LEN; k++) {
        const index = base + k;
        const birth = this.trailBirth[index];
        if (birth < 0) continue;
        const age = t - birth;
        if (age < 0 || age > SPIN_TRAIL_LIFE) continue;
        const life = 1 - age / SPIN_TRAIL_LIFE;
        const size = 1 + 8 * life;
        ctx.globalAlpha = 0.22 * life;
        ctx.save();
        ctx.translate(this.trailX[index], this.trailY[index]);
        ctx.rotate(age * 4 + k * 0.6);
        ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  /** Aim Bot's long sight line. Locked targets get a crosshair at the endpoint. */
  private drawAimSight(p: Player, x: number, y: number, facing: number, color: string): void {
    const ctx = this.ctx;
    const locked = p.lockActive && (p.lockTX !== 0 || p.lockTY !== 0);
    const tx = locked ? p.lockTX : x + Math.cos(facing) * AIMBOT.sightRange;
    const ty = locked ? p.lockTY : y + Math.sin(facing) * AIMBOT.sightRange;
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const fade = Math.min(1, p.aimSightT * 1.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.22 * fade;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.moveTo(x + ux * (PLAYER.radius + 4), y + uy * (PLAYER.radius + 4));
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.85 * fade;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(tx, ty, 11, 0, TWO_PI);
    ctx.moveTo(tx - 18, ty);
    ctx.lineTo(tx - 5, ty);
    ctx.moveTo(tx + 5, ty);
    ctx.lineTo(tx + 18, ty);
    ctx.moveTo(tx, ty - 18);
    ctx.lineTo(tx, ty - 5);
    ctx.moveTo(tx, ty + 5);
    ctx.lineTo(tx, ty + 18);
    ctx.stroke();
    ctx.restore();
  }

  /** Pending volley crosshairs: red, fixed to the target until the shot lands. */
  private drawAimMarks(marks: readonly AimMark[]): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = PROGRAM_COLORS.aimbot;
    ctx.fillStyle = PROGRAM_COLORS.aimbot;
    ctx.lineWidth = 2;
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
      if (!mark.active) continue;
      const r = AIMBOT.volleyMarkRadius;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, r, 0, TWO_PI);
      ctx.stroke();
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(mark.x - r - 8, mark.y);
      ctx.lineTo(mark.x - r + 6, mark.y);
      ctx.moveTo(mark.x + r - 6, mark.y);
      ctx.lineTo(mark.x + r + 8, mark.y);
      ctx.moveTo(mark.x, mark.y - r - 8);
      ctx.lineTo(mark.x, mark.y - r + 6);
      ctx.moveTo(mark.x, mark.y + r - 6);
      ctx.lineTo(mark.x, mark.y + r + 8);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, 2, 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Local lock-on marker: translucent while acquiring, solid once locked. */
  private drawLockReticle(state: RenderState, slot: number, t: number): void {
    const p = state.players[slot];
    if (!p || !p.active || !p.alive || p.lockKind === 0) return;
    let tx = 0;
    let ty = 0;
    let radius = 16;
    if (p.lockKind === 1) {
      const target = state.players[p.lockId];
      if (!target || !target.active || !target.alive) return;
      tx = target.x;
      ty = target.y;
      radius = PLAYER.radius;
    } else if (p.lockKind === 2) {
      const target = state.worms?.[p.lockId];
      if (!target || !target.active) return;
      tx = target.x;
      ty = target.y;
      radius = WORM.headRadius;
    } else if (p.lockKind === 3) {
      const target = state.viruses?.[p.lockId];
      if (!target || !target.active) return;
      tx = target.x;
      ty = target.y;
      radius = target.radius;
    } else if (p.lockKind === 4) {
      if (!state.drone || !state.drone.active) return;
      tx = state.drone.x;
      ty = state.drone.y;
      radius = state.drone.radius;
    } else if (p.lockKind === 5) {
      const target = state.sentries?.[p.lockId];
      if (!target || !target.active) return;
      tx = target.x;
      ty = target.y;
      radius = target.radius + 3;
    } else if (p.lockKind === 6) {
      const target = state.errors?.[p.lockId];
      if (!target || !target.active) return;
      tx = target.x;
      ty = target.y;
      radius = CASCADING_ERROR.blockSize * 0.5;
    } else {
      return;
    }

    const ctx = this.ctx;
    const r = radius + 12;
    const arm = 6;
    const active = p.lockActive;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(t * 0.8);
    ctx.strokeStyle = active ? playerColor(state, p) : '#dff7ff';
    ctx.globalAlpha = active ? 0.9 : 0.3;
    ctx.lineWidth = active ? 1.8 : 1.1;
    if (!active) ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(-r, -r + arm);
    ctx.lineTo(-r, -r);
    ctx.lineTo(-r + arm, -r);
    ctx.moveTo(r - arm, -r);
    ctx.lineTo(r, -r);
    ctx.lineTo(r, -r + arm);
    ctx.moveTo(r, r - arm);
    ctx.lineTo(r, r);
    ctx.lineTo(r - arm, r);
    ctx.moveTo(-r + arm, r);
    ctx.lineTo(-r, r);
    ctx.lineTo(-r, r - arm);
    ctx.stroke();
    if (active) {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Square dust kicked up behind any body sliding out of a shove. It reads the rendered
   * motion instead of an event, so the local avatar, local bots and networked guests all
   * get the same trail without a new snapshot field.
   */
  private slidePuff(fx: Fx, x: number, y: number, ux: number, uy: number): void {
    const side = (Math.random() - 0.5) * PLAYER.radius * 1.5;
    const speed = 40 + Math.random() * 90;
    fx.particles.spawn(
      4,
      x - ux * (PLAYER.radius * 0.7) - uy * side,
      y - uy * (PLAYER.radius * 0.7) + ux * side,
      -ux * speed + uy * side * 1.6,
      -uy * speed - ux * side * 1.6,
      0.22 + Math.random() * 0.22,
      2.4 + Math.random() * 3.2,
      P_COLOR_DUST,
      4.5,
      2.5,
    );
  }

  /**
   * A thrown broom head drags a short puff of dust behind it: grey squares that fade and
   * drift, the same square dust the knockback slide kicks up. No line, so it never reads
   * as a handle or a bolt trail.
   */
  /**
   * Toxic's skill reads like the death burst: a steady spray of neon circles thrown in
   * every direction for as long as the cloud lives. Render-side only; the damage was
   * resolved when the skill fired.
   */
  private emitToxicBurst(state: RenderState, alpha: number, fx: Fx): void {
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active || !p.alive || p.toxT <= 0 || p.toxCone || p.toxDur <= 0) continue;
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      for (let e = 0; e < 3; e++) {
        const seed = this.toxicSeed++;
        const a = seed * 2.399 + p.slot * 0.7;
        const speed = 240 + (seed % 11) * 28;
        const size = 2.4 + (seed % 5) * 1.6;
        fx.particles.spawn(
          5,
          x + Math.cos(a) * 8,
          y + Math.sin(a) * 8,
          Math.cos(a) * speed,
          Math.sin(a) * speed,
          0.5 + (seed % 4) * 0.08,
          size,
          P_COLOR_TOXIN,
          1.1,
          0,
          0,
          0,
        );
      }
    }
  }

  private emitBroomDust(state: RenderState, alpha: number, fx: Fx, dt: number): void {
    this.broomDustT -= dt;
    if (this.broomDustT > 0) return;
    this.broomDustT = 0.035;
    const projectiles = state.projectiles;
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (!p.active || p.type !== 6) continue;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed < 30) continue;
      const inv = 1 / speed;
      const ux = p.vx * inv;
      const uy = p.vy * inv;
      const x = lerp(p.prevX, p.x, alpha) - ux * 18;
      const y = lerp(p.prevY, p.y, alpha) - uy * 18;
      const side = (Math.random() - 0.5) * 26;
      const drift = 20 + Math.random() * 60;
      fx.particles.spawn(
        4,
        x - uy * side,
        y + ux * side,
        -ux * drift + uy * side * 1.2,
        -uy * drift - ux * side * 1.2,
        0.18 + Math.random() * 0.2,
        2.2 + Math.random() * 3,
        P_COLOR_DUST,
        4.5,
        2.2,
      );
    }
  }

  private emitSlideDust(state: RenderState, alpha: number, fx: Fx, dt: number): void {
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active || !p.alive) {
        this.slideSeen[i] = 0;
        continue;
      }
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      if (this.slideSeen[i] === 0) {
        this.slideSeen[i] = 1;
        this.slideX[i] = x;
        this.slideY[i] = y;
        this.slideGap[i] = 0;
        continue;
      }
      const dx = x - this.slideX[i];
      const dy = y - this.slideY[i];
      this.slideX[i] = x;
      this.slideY[i] = y;
      const dist = Math.hypot(dx, dy);
      // A respawn or a camera jump is not a slide; a normal run must stay clean.
      if (dist > 140 || dist / dt < PLAYER.slideDustSpeed) {
        this.slideGap[i] = 0;
        continue;
      }
      const inv = 1 / dist;
      const ux = dx * inv;
      const uy = dy * inv;
      this.slideGap[i] += dist;
      while (this.slideGap[i] >= PLAYER.slideDustSpacing) {
        this.slideGap[i] -= PLAYER.slideDustSpacing;
        this.slidePuff(fx, x, y, ux, uy);
      }
    }

    // Hostile bodies are shoved too. They carry a real knock velocity, so the rate is
    // capped on a small timer instead of a per-entity trail.
    this.slideDustT -= dt;
    if (this.slideDustT > 0) return;
    this.slideDustT = 0.03;
    const min = PLAYER.slideDustSpeed;
    const min2 = min * min;
    const worms = state.worms;
    if (worms) {
      for (let i = 0; i < worms.length; i++) {
        const w = worms[i];
        if (!w.active || w.kx * w.kx + w.ky * w.ky < min2) continue;
        const m = Math.hypot(w.kx, w.ky) || 1;
        this.slidePuff(fx, w.x, w.y, w.kx / m, w.ky / m);
      }
    }
    const viruses = state.viruses;
    if (viruses) {
      for (let i = 0; i < viruses.length; i++) {
        const v = viruses[i];
        if (!v.active || v.kx * v.kx + v.ky * v.ky < min2) continue;
        const m = Math.hypot(v.kx, v.ky) || 1;
        this.slidePuff(fx, v.x, v.y, v.kx / m, v.ky / m);
      }
    }
    const sentries = state.sentries;
    if (sentries) {
      for (let i = 0; i < sentries.length; i++) {
        const s = sentries[i];
        if (!s.active || s.kx * s.kx + s.ky * s.ky < min2) continue;
        const m = Math.hypot(s.kx, s.ky) || 1;
        this.slidePuff(fx, s.x, s.y, s.kx / m, s.ky / m);
      }
    }
  }

  /**
   * Atomize's power field: one atom-shaped set of orbit lines around the caster. It is
   * drawn under the bodies so the captured shots and enemies remain the subject.
   */
  private drawOrbitFields(state: RenderState, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active || !p.alive || p.orbitT <= 0) continue;
      const x = p.x;
      const y = p.y;
      const fade = Math.min(1, p.orbitT / 0.18);
      const pulse = 0.5 + 0.5 * Math.sin(t * 6 + p.slot);
      ctx.strokeStyle = PROGRAM_COLORS.atomize;
      ctx.globalAlpha = (0.06 + 0.05 * pulse) * fade;
      ctx.fillStyle = PROGRAM_COLORS.atomize;
      ctx.beginPath();
      ctx.arc(x, y, ATOMIZE.powerOrbit, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = (0.2 + 0.14 * pulse) * fade;
      ctx.lineWidth = 1.3;
      for (let o = 0; o < 3; o++) {
        const rot = t * 0.7 * p.orbitDir + (o * Math.PI) / 3;
        ctx.beginPath();
        ctx.ellipse(x, y, ATOMIZE.powerOrbit, ATOMIZE.powerOrbit * 0.34, rot, 0, TWO_PI);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.42 * fade;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, ATOMIZE.powerOrbit, -Math.PI / 2 + t * p.orbitDir, -Math.PI / 2 + t * p.orbitDir + 1.1);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * The jump-scare face. It pops at the burst point, shakes for a beat and fades. Drawn
   * in world space so it scales with the arena camera; the dark outline keeps it legible
   * over bright floors and explosion particles.
   */
  private drawJumpScares(state: RenderState, t: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (p.scareFaceT <= 0) continue;
      const age = 1 - p.scareFaceT / GHOST.faceTime;
      const fade = Math.min(1, age * 9, p.scareFaceT * 4);
      if (fade <= 0) continue;
      const pop = 0.42 + 0.78 * Math.min(1, age * 4.5);
      const shakeX = Math.sin(t * 57 + p.slot) * 2.4 * (1 - age);
      const shakeY = Math.cos(t * 49 + p.slot) * 1.8 * (1 - age);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(p.scareFaceX + shakeX, p.scareFaceY - 8 + shakeY);
      ctx.scale(pop, pop);
      ctx.globalAlpha = fade * 0.3;
      ctx.fillStyle = PROGRAM_COLORS.ghost;
      ctx.beginPath();
      ctx.ellipse(0, 6, 118, 102, 0, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = fade;
      ctx.font = symbolFont(27);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(2, 7, 12, 0.92)';
      ctx.fillStyle = '#eef4fa';
      const lineH = 27;
      const top = -((SCARE_FACE.length - 1) * lineH) * 0.5;
      for (let line = 0; line < SCARE_FACE.length; line++) {
        ctx.strokeText(SCARE_FACE[line], 0, top + line * lineH);
        ctx.fillText(SCARE_FACE[line], 0, top + line * lineH);
      }
      ctx.restore();
    }
  }

  /**
   * Local-only cloak readout. A faint dark disc, a dashed outline and the closed-eye
   * core keep the avatar navigable without putting a bright body back on the field.
   * The armed jump-scare adds a pulsing warning ring and a very faint burst radius.
   */
  private drawCloakedPlayer(p: Player, x: number, y: number, facing: number, color: string, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = 'rgba(2, 7, 12, 0.86)';
    ctx.beginPath();
    ctx.arc(x, y, PLAYER.radius, 0, TWO_PI);
    ctx.fill();
    ctx.globalAlpha = 0.42 + 0.14 * Math.sin(t * 8 + p.slot);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -t * 18;
    ctx.beginPath();
    ctx.arc(x, y, PLAYER.radius + 4, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);
    if (p.scareT > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 18);
      ctx.globalAlpha = 0.55 + 0.3 * pulse;
      ctx.strokeStyle = '#eef4fa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER.radius + 13 + pulse * 3, 0, TWO_PI);
      ctx.stroke();
      // The armed radius is shown only to the owner. It is the one time the cloak is
      // allowed to reveal its footprint, because the player has to choose the moment.
      ctx.globalAlpha = 0.11;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 10]);
      ctx.beginPath();
      ctx.arc(x, y, GHOST.scareRadius, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.translate(x, y);
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = color;
    drawGhostEye(ctx, 0, 0, PLAYER.radius * 0.5);
    const nx = Math.cos(facing);
    const ny = Math.sin(facing);
    const tip = PLAYER.radius + 8;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(nx * tip, ny * tip);
    ctx.lineTo(nx * (tip - 7) - ny * 4, ny * (tip - 7) + nx * 4);
    ctx.lineTo(nx * (tip - 7) + ny * 4, ny * (tip - 7) - nx * 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Growing red file stacks, drawn over the body so the coverage is the timer. */
  private drawCopyMarks(marks: readonly CopyMark[]): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      if (!m.active) continue;
      const pulse = 0.78 + 0.22 * Math.sin(m.t * 18 + i);
      for (let k = 0; k < m.count; k++) {
        const col = k % 3;
        const row = Math.floor(k / 3);
        const ox = (col - 1) * 7.2;
        const oy = (row - 0.5) * 8.4;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#d92b2b';
        ctx.strokeStyle = '#ff9a9a';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        pathFileIcon(ctx, m.x + ox, m.y + oy, 3.1, 3.9);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 0.18 * pulse;
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 17 + m.count * 1.2, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPlayers(
    state: RenderState,
    alpha: number,
    t: number,
    intro = INTRO_LEN,
    localMask = 1 << state.localSlot,
  ): void {
    const ctx = this.ctx;
    if (intro < 1.85) {
      const a = Math.max(0, Math.min(1, (intro - 1.55) / 0.3));
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a * 0.55;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 5]);
      for (let i = 0; i < state.players.length; i++) {
        const p = state.players[i];
        if (!p.active) continue;
        const sx = lerp(p.prevX, p.x, alpha);
        const sy = lerp(p.prevY, p.y, alpha);
        ctx.strokeStyle = playerColor(state, p);
        ctx.beginPath();
        ctx.arc(sx, sy, PLAYER.radius, 0, TWO_PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx - 7, sy);
        ctx.lineTo(sx + 7, sy);
        ctx.moveTo(sx, sy - 7);
        ctx.lineTo(sx, sy + 7);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    const spinUp = intro >= INTRO_LEN ? 1 : Math.max(0, Math.min(1, (intro - 2.2) / 0.9));
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active) continue;
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      const facing = lerpAngle(p.prevFacing, p.facing, alpha);
      const color = playerColor(state, p);
      const isLocal = (localMask & (1 << p.slot)) !== 0;
      // Compress folds the whole avatar: hull, segments, mark and heading arrow all
      // read from one body radius, so a compressed body never draws a full-size hull
      // around a tiny core. The skill adds its own fold on top of any hits taken.
      const bodyR = PLAYER.radius * p.shrink * (p.shrinkT > 0 ? COMPRESS.skillScale : 1);

      // A dead body leaves no marker on the field. The death burst and the respawn
      // timer carry the state; a dashed ring with an X read as another interactable.
      if (!p.alive) continue;
      // Ghost's cloak: the local player keeps a faint shimmer so they can steer; every
      // other body is simply not on the field. An enemy cannot see what is not drawn.
      if (p.cloakT > 0) {
        if (isLocal) this.drawCloakedPlayer(p, x, y, facing, color, t);
        continue;
      }
      // Lift riders are hidden under the car transition. A pad rider is drawn in its
      // layer-by-layer unload/reload at the two plates instead.
      if (p.travelT > 0) {
        if (p.travelKind === TRAVEL.pad) this.drawPadTransit(state, p, t, localMask);
        continue;
      }

      // Aim Bot's sight line is drawn on the floor before the body, so the scope never
      // sits on top of the hull or the target. The line is only a read; it has no hitbox.
      if (isLocal && p.program === PROGRAM_ID.AIMBOT && p.aimSightT > 0) {
        this.drawAimSight(p, x, y, facing, color);
      }

      // Held guard: a tight 180 degree screen right against the body. It is the safe,
      // readable option; the tap swing stays the offensive one.
      if (p.guardT > 0) {
        const edge = facing - PLAYER.guardHalfAngle;
        const end = facing + PLAYER.guardHalfAngle;
        const guardFade = Math.min(1, p.guardT / 0.08);
        const radius = p.guardReach - 12;
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.1 * guardFade;
        ctx.beginPath();
        ctx.arc(x, y, radius, edge, end);
        ctx.arc(x, y, bodyR + 4, end, edge, true);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = (0.58 + 0.16 * Math.sin(t * 18)) * guardFade;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, y, radius, edge, end);
        ctx.stroke();
        // Burn the last of the guard down from the edges inward.
        const left = Math.max(0, Math.min(1, p.guardT / Math.max(0.001, p.guardMax)));
        ctx.globalAlpha = 0.7 * guardFade;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, edge + (end - edge) * (1 - left) * 0.5, end - (end - edge) * (1 - left) * 0.5);
        ctx.stroke();
        ctx.restore();
      }

      // Quick tap: a straight spiked lash whips across the forward arc. No shield
      // fill belongs on the tap; the guard is the separate hold action.
      if (p.swingPhase !== 0 && p.program === PROGRAM_ID.SWEEP) {
        this.drawBroomSwing(p, x, y, facing, color);
      } else if (p.swingPhase !== 0 && p.program === PROGRAM_ID.AIMBOT) {
        const whip = p.powerupT > 0 && p.powerupKind === POWERUP_KIND.WHIP;
        this.drawKnifeSwing(p, x, y, facing, color, whip);
      } else if (p.swingPhase !== 0 && p.program === PROGRAM_ID.PINBALL) {
        this.drawPinballSwing(p, x, y, facing, color);
      } else if (p.swingPhase !== 0) {
        const half = p.meleeHalfAngle;
        const dir = p.swingDir < 0 ? -1 : 1;
        const pct = Math.max(0, Math.min(1, p.swingPct));
        const whip = p.powerupT > 0 && p.powerupKind === POWERUP_KIND.WHIP;
        const reach = PLAYER.swingReach * p.meleeReachMult * (whip ? POWERUP.whipMultiplier : 1);
        const progress = p.swingPhase === 1 ? 0 : p.swingPhase === 2 ? 1 - pct : 1;
        const start = facing - dir * half * 0.96;
        const angle = start + dir * half * 1.92 * progress;
        const alpha = p.swingPhase === 2 ? 0.95 : p.swingPhase === 3 ? 0.3 : 0.55;
        const lashColor = whip ? '#ff3e63' : color;
        const inner = PLAYER.radius + 8;
        ctx.save();
        ctx.strokeStyle = lashColor;
        ctx.fillStyle = lashColor;
        ctx.lineCap = 'round';
        // Short ghost lashes behind the blade sell the speed without filling the arc.
        for (let s = 3; s >= 1; s--) {
          const ghost = angle - dir * s * 0.13;
          const ghostReach = reach * (1 - s * 0.035);
          ctx.globalAlpha = alpha * (0.06 + (3 - s) * 0.05);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(ghost) * inner, y + Math.sin(ghost) * inner);
          ctx.lineTo(x + Math.cos(ghost) * ghostReach, y + Math.sin(ghost) * ghostReach);
          ctx.stroke();
        }
        ctx.globalAlpha = alpha;
        ctx.lineWidth = whip ? 3 : 2.4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        ctx.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
        ctx.stroke();
        // Barbs are triangles on the line's leading edge, pointing the way the arc
        // is travelling. They are geometry, not a shield fill.
        const barbSize = whip ? 11 : 8;
        const tangent = angle + dir * (Math.PI / 2);
        for (let s = 0; s < 4; s++) {
          const r = inner + 8 + (reach - inner - 12) * (0.2 + s * 0.23);
          const bx = x + Math.cos(angle) * r;
          const by = y + Math.sin(angle) * r;
          ctx.beginPath();
          ctx.moveTo(bx - Math.cos(angle) * 3.2, by - Math.sin(angle) * 3.2);
          ctx.lineTo(bx + Math.cos(angle) * 3.2, by + Math.sin(angle) * 3.2);
          ctx.lineTo(bx + Math.cos(tangent) * barbSize, by + Math.sin(tangent) * barbSize);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Wedge: the triangle builds around him, then carries him through the room.
      if (p.program === PROGRAM_ID.WEDGE) {
        if (p.laserChargeHeld) {
          const charge = Math.min(1, p.laserChargeT / WEDGE.chargeTime);
          const grow = 0.38 + 0.62 * charge;
          const forward = WEDGE.chargeRadius * grow + 8;
          const back = 14 + 8 * grow;
          const half = WEDGE.chargeRadius * 0.62 * grow;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.laserFacing);
          ctx.strokeStyle = PROGRAM_COLORS.wedge;
          ctx.fillStyle = PROGRAM_COLORS.wedge;
          ctx.globalAlpha = 0.07 + 0.14 * charge;
          ctx.beginPath();
          ctx.moveTo(forward, 0);
          ctx.lineTo(-back, -half);
          ctx.lineTo(-back, half);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.55 + 0.38 * charge;
          ctx.lineWidth = 2.4;
          ctx.stroke();
          ctx.globalAlpha = 0.3 + 0.35 * charge;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(forward * 0.78, 0);
          ctx.stroke();
          ctx.restore();
        }
        if (p.wedgeT > 0) {
          const fade = Math.min(1, p.wedgeT / 0.14);
          const forward = WEDGE.chargeRadius + 10;
          const half = WEDGE.chargeRadius * 0.66;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.atan2(p.wedgeDirY, p.wedgeDirX));
          ctx.fillStyle = PROGRAM_COLORS.wedge;
          ctx.strokeStyle = PROGRAM_COLORS.wedge;
          ctx.globalAlpha = 0.16 * fade;
          ctx.beginPath();
          ctx.moveTo(forward, 0);
          ctx.lineTo(-22, -half);
          ctx.lineTo(-22, half);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.92 * fade;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.globalAlpha = 0.55 * fade;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(forward, 0);
          ctx.lineTo(-10, -half * 0.55);
          ctx.moveTo(forward, 0);
          ctx.lineTo(-10, half * 0.55);
          ctx.stroke();
          ctx.restore();
        }
        if (p.bashT > 0) {
          const reach = WEDGE.bashReach;
          const half = WEDGE.bashHalfWidth;
          const fade = Math.min(1, p.bashT / (WEDGE.bashTime * 0.7));
          const arm = 24;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.bashFacing);
          ctx.strokeStyle = PROGRAM_COLORS.wedge;
          ctx.fillStyle = PROGRAM_COLORS.wedge;
          ctx.globalAlpha = 0.1 * fade;
          ctx.beginPath();
          ctx.moveTo(reach, -half);
          ctx.lineTo(reach, half);
          ctx.lineTo(reach - arm, half);
          ctx.lineTo(reach - arm, half - 8);
          ctx.lineTo(reach - 8, half - 8);
          ctx.lineTo(reach - 8, -half + 8);
          ctx.lineTo(reach - arm, -half + 8);
          ctx.lineTo(reach - arm, -half);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.9 * fade;
          ctx.lineWidth = 3.2;
          ctx.lineCap = 'square';
          ctx.stroke();
          ctx.globalAlpha = 0.4 * fade;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(18, 0);
          ctx.lineTo(reach, 0);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Sweep: the giant broom builds at his side, then crosses the room. The two
      // split brooms from the skill live in the same block.
      if (p.program === PROGRAM_ID.SWEEP) {
        this.drawGiantBroom(p, color, t);
        this.drawFan(p, color, t);
      }

      // Charged triangle dash silhouette.
      if (p.dashT > 0 && p.dashKind === 1) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(p.dashDirY, p.dashDirX));
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(-17, -17);
        ctx.lineTo(-17, 17);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-8, -9);
        ctx.lineTo(-8, 9);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // Forward shield wave: a short crescent travelling away from the avatar.
      if (p.waveT > 0) {
        const progress = 1 - p.waveT / PLAYER.waveVisualTime;
        const dist = 24 + (PLAYER.waveRange - 24) * progress;
        const fade = Math.min(1, p.waveT / 0.08);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.18 * fade;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(x, y, dist, facing - 0.58, facing + 0.58);
        ctx.stroke();
        ctx.globalAlpha = 0.8 * fade;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(x, y, dist, facing - 0.58, facing + 0.58);
        ctx.stroke();
        ctx.globalAlpha = 0.35 * fade;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(22, dist - 12), facing - 0.5, facing + 0.5);
        ctx.stroke();
      }

      // Compress's sprint: the folded body wears a squeeze ring with four inward
      // chevrons, so the speed window reads even when the body is already small from
      // hits. Drawn before the hull so the ring never covers the health segments.
      if (p.shrinkT > 0) {
        const fade = Math.min(1, p.shrinkT / 0.25);
        const pulse = 0.5 + 0.5 * Math.sin(t * 16 + p.slot);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = color;
        ctx.globalAlpha = (0.24 + 0.26 * pulse) * fade;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x, y, bodyR + 8 + pulse * 3, 0, TWO_PI);
        ctx.stroke();
        ctx.globalAlpha = (0.35 + 0.35 * pulse) * fade;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = t * 3 + (k * Math.PI) / 2;
          const rx = x + Math.cos(a) * (bodyR + 16);
          const ry = y + Math.sin(a) * (bodyR + 16);
          ctx.moveTo(rx + Math.cos(a + 1.25) * 6, ry + Math.sin(a + 1.25) * 6);
          ctx.lineTo(rx, ry);
          ctx.lineTo(rx + Math.cos(a - 1.25) * 6, ry + Math.sin(a - 1.25) * 6);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Health outline is the program's silhouette (ring, diamond, hex), rotating slowly.
      // Local bots are player characters and carry the same hull and three segments.
      // Networked guests keep slot identity, and thralls are not player characters, so
      // neither draws a program hull yet.
      // Atomize carries six segments; every other program keeps the three defaults.
      const maxSegments = p.maxHp > 0 ? p.maxHp : PLAYER.hp;
      const freshSegments = Math.max(0, Math.min(maxSegments, Math.ceil(p.hp)));
      const hpFrac = Math.max(0, Math.min(1, p.hp / maxSegments));
      // Bots are player characters: same program hull, health segments and glow.
      // Networked guests keep slot identity, and thralls are not player characters.
      const showHull = isLocal || (!state.online && !p.thrall);
      if (showHull) {
        const spin = t * 0.22 + (1 - spinUp) * 18;
        const hullSpin = spin + (p.program === PROGRAM_ID.WEDGE ? Math.PI / 4 : 0);
        ctx.strokeStyle = p.hitFlash > 0 ? '#ffffff' : color;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';
        // Wedge's square has one frame-only corner; the thin rim keeps the full hull
        // readable behind the three health brackets without becoming a health segment.
        ctx.globalAlpha = 0.34;
        ctx.lineWidth = 1.4;
        pathProgramFrame(ctx, p.program, x, y, bodyR, hullSpin);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // Lost segments remain as ghosts at a readable alpha, so the program silhouette
        // never breaks apart. Too faint and the hull reads as a gap instead of damage.
        if (freshSegments < maxSegments) {
          ctx.globalAlpha = 0.42;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.6;
          pathProgramHealth(ctx, p.program, x, y, bodyR, hullSpin, maxSegments, maxSegments);
          ctx.stroke();
          ctx.strokeStyle = p.hitFlash > 0 ? '#ffffff' : color;
        }
        pathProgramHealth(ctx, p.program, x, y, bodyR, hullSpin, freshSegments, maxSegments);
        ctx.globalAlpha = 0.1;
        ctx.lineWidth = 12;
        ctx.stroke();
        ctx.globalAlpha = 0.32;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'miter';

        // A copy wears a dashed outer ring. It is a summon, not another room player,
        // so the shared hull is kept and only the outline says it is temporary.
        if (p.copyClone) {
          ctx.save();
          // The afterimage uses a sparser, fainter ring than the fighting copy.
          ctx.setLineDash(p.copyDecoy ? [2, 6] : [4, 5]);
          ctx.globalAlpha = p.copyDecoy ? 0.35 : 0.55;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(x, y, bodyR + 5, 0, TWO_PI);
          ctx.stroke();
          ctx.restore();
        }

        // Small heading arrow outside the outline. Local only: it is the player's own
        // facing cue, not a marker on every body.
        if (isLocal) {
          const nx = Math.cos(facing);
          const ny = Math.sin(facing);
          const tip = bodyR + 8;
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(x + nx * tip, y + ny * tip);
          ctx.lineTo(x + nx * (tip - 7) - ny * 4, y + ny * (tip - 7) + nx * 4);
          ctx.lineTo(x + nx * (tip - 7) + ny * 4, y + ny * (tip - 7) - nx * 4);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Player characters show their own damage in the core; networked guests keep a
      // stable core until the snapshot carries programs and health.
      const coreHp = showHull ? hpFrac : 1;
      const coreR = bodyR * (0.3 + 0.28 * coreHp) * (1 + 0.035 * Math.sin(t * 4 + p.slot));
      // Bad Lag has no dark core disc. His mark is a solid filled hourglass, so a disc
      // behind it reads as a black tile rather than as a nucleus: every other program
      // draws a stroked mark, where the disc is the negative space it sits in.
      if (p.program !== PROGRAM_ID.BUFFER) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = 'rgba(2, 7, 12, 0.88)';
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      }

      if (isLocal && hpFrac <= 0.34) {
        ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(t * 9 + p.slot));
        ctx.strokeStyle = '#ff6677';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let c = 0; c < 3; c++) {
          const ca = t * 0.6 + c * 2.1 + p.slot;
          ctx.moveTo(x + Math.cos(ca) * coreR * 0.25, y + Math.sin(ca) * coreR * 0.25);
          ctx.lineTo(x + Math.cos(ca + 0.2) * coreR * 0.95, y + Math.sin(ca + 0.2) * coreR * 0.95);
        }
        ctx.stroke();
      }

      ctx.globalAlpha = 0.88 + 0.12 * hpFrac;
      ctx.fillStyle = color;
      // Keep the mark legible at low health. The hull ghosts already carry the damage
      // read, so the core only needs a slight shrink, not a collapse into the disc.
      const symScale = 0.78 + 0.22 * coreHp;
      const jitterX = isLocal && hpFrac <= 0.34 ? Math.sin(t * 31 + p.slot) * 1.2 : 0;
      const jitterY = isLocal && hpFrac <= 0.34 ? Math.cos(t * 27 + p.slot) * 1.2 : 0;
      ctx.save();
      ctx.translate(x + jitterX, y + 1 + jitterY);
      ctx.scale(symScale, symScale);
      if (p.powerupT > 0 && p.powerupKind === POWERUP_KIND.OVERCHARGE) {
        // The centre symbol becomes a live bolt while overcharged.
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        ctx.moveTo(2, -10);
        ctx.lineTo(-4, 0);
        ctx.lineTo(2, 0);
        ctx.lineTo(-2, 10);
        ctx.lineTo(6, -1);
        ctx.lineTo(0, -1);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 0.5 + 0.38 * Math.abs(Math.sin(t * 16 + p.slot));
        ctx.strokeStyle = '#c39bff';
        ctx.lineWidth = 4;
        ctx.stroke();
      } else if (state.online) {
        // Networked matches still identify by slot until programs travel in the snapshot.
        drawGlyph(ctx, slotGlyph(p.slot), 0, 0, bodyR * 0.51);
      } else {
        const glyph = programDef(p.program);
        drawProgramMark(ctx, p.program, glyph.glyph, glyph.symbolFont, 0, 0, bodyR * (glyph.glyphRadius ?? 0.51), glyph.coreScale);
      }
      ctx.restore();

      // Atomize's shield charges: two blue balls sharing one orbit. They persist
      // until spent, so the count is the readout; no timer or bar belongs here.
      if (p.atomBalls > 0) {
        const count = p.atomBalls;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = ATOM_BALL_COLOR;
        ctx.globalAlpha = 0.1;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, ATOMIZE.ballOrbit, 0, TWO_PI);
        ctx.stroke();
        for (let b = 0; b < count; b++) {
          const a = p.atomBallA + (b / count) * TWO_PI;
          const bx = x + Math.cos(a) * ATOMIZE.ballOrbit;
          const by = y + Math.sin(a) * ATOMIZE.ballOrbit;
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = ATOM_BALL_COLOR;
          ctx.beginPath();
          ctx.arc(bx, by, ATOMIZE.ballRadius * 1.9, 0, TWO_PI);
          ctx.fill();
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.arc(bx, by, ATOMIZE.ballRadius * 0.72, 0, TWO_PI);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(bx - 1.2, by - 1.2, ATOMIZE.ballRadius * 0.27, 0, TWO_PI);
          ctx.fill();
        }
        ctx.restore();
      }

      if (p.atomFlashT > 0) {
        const f = Math.max(0, Math.min(1, p.atomFlashT / ATOMIZE.ballBlockFlash));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = f * 0.75;
        ctx.strokeStyle = ATOM_BALL_COLOR;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER.radius + 9 + (1 - f) * 16, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
      }

      if (p.poisonT > 0) {
        // Venom: one flashing skull above the body and a green rim. A status marker,
        // not a health pip, so it is allowed on bots and remotes too.
        const pulse = 0.5 + 0.5 * Math.sin(t * 9 + p.slot * 1.7);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.26 + 0.3 * pulse;
        ctx.strokeStyle = PROGRAM_COLORS.toxic;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER.radius + 5 + 2 * pulse, 0, TWO_PI);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.45 + 0.45 * pulse;
        ctx.fillStyle = PROGRAM_COLORS.toxic;
        drawSymbol(ctx, '☠', x, y - PLAYER.radius - 13, 8, 1);
        ctx.globalAlpha = 1;
      }

      if (p.fastT > 0) {
        // Fast-forward: a dashed chrono ring spinning at the burn rate. Local and bot
        // bodies alike, because the effect is on the body, not in a HUD panel.
        const pulse = 0.5 + 0.5 * Math.sin(t * 16 + p.slot * 2.1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.4 + 0.3 * pulse;
        ctx.strokeStyle = PROGRAM_COLORS.buffer;
        ctx.lineWidth = 2.4;
        ctx.setLineDash([5, 7]);
        ctx.lineDashOffset = -t * 42;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER.radius + 7, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
      }

      if (p.ghostT > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.52;
        ctx.fillStyle = 'rgba(2, 7, 12, 0.9)';
        ctx.beginPath();
        ctx.arc(x, y, PLAYER.radius - 3, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 12 + p.slot);
        ctx.strokeStyle = '#b9fbff';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.arc(x, y, PLAYER.radius + 3, 0, TWO_PI);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (p.dazeT > 0) {
        // Bite daze: a short, dizzy orbit of dots and a broken ring. The body keeps
        // its normal shape so the status is not mistaken for a shield or a cloak.
        const pulse = 0.5 + 0.5 * Math.sin(t * 12 + p.slot);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.4 + 0.25 * pulse;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([3, 6]);
        ctx.lineDashOffset = t * 26;
        ctx.beginPath();
        ctx.arc(x, y, PLAYER.radius + 6, 0, TWO_PI);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#eef4fa';
        for (let d = 0; d < 3; d++) {
          const a = t * 5.5 + (d / 3) * TWO_PI;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * 15, y - PLAYER.radius - 4 + Math.sin(a) * 5, 2.1, 0, TWO_PI);
          ctx.fill();
        }
        ctx.restore();
      }

      if (p.wallT > 0) {
        const wf = p.wallFacing;
        const wx = Math.cos(wf);
        const wy = Math.sin(wf);
        const ox = x + wx * BUG.wallOffset;
        const oy = y + wy * BUG.wallOffset;
        const half = BUG.wallLength * 0.5;
        const ax2 = ox - wy * half;
        const ay2 = oy + wx * half;
        const bx2 = ox + wy * half;
        const by2 = oy - wx * half;
        const fade = Math.min(1, p.wallT / 0.25);
        ctx.globalAlpha = (0.18 + 0.06 * Math.sin(t * 10)) * fade;
        ctx.strokeStyle = color;
        ctx.lineWidth = BUG.wallThickness + 8;
        ctx.beginPath();
        ctx.moveTo(ax2, ay2);
        ctx.lineTo(bx2, by2);
        ctx.stroke();
        ctx.globalAlpha = 0.85 * fade;
        ctx.lineWidth = BUG.wallThickness;
        ctx.stroke();
        ctx.globalAlpha = 0.9 * fade;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();

      void t;
    }
  }

  /**
   * Toxic's gas. The skill is a 360-degree burst, the power a forward cone; both are
   * drawn as a green haze of square motes that expands once and fades, so the cloud
   * reads as area denial rather than a projectile. Render-only: damage is already
   * resolved the frame it was used.
   */
  private drawGas(state: RenderState, alpha: number, t: number): void {
    const ctx = this.ctx;
    let drew = false;
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (p.toxT <= 0 || p.toxDur <= 0) continue;
      if (!drew) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = PROGRAM_COLORS.toxic;
        ctx.strokeStyle = PROGRAM_COLORS.toxic;
        drew = true;
      }
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      const k = Math.max(0, Math.min(1, 1 - p.toxT / p.toxDur));
      const fade = 1 - k;
      const grow = 0.34 + 0.66 * Math.sqrt(k);
      const span = p.toxRadius * grow;
      if (p.toxCone) {
        // The power is a jet, not a cloud: a narrow shaft the player steers while
        // rooted. Cover cuts the drawn stream exactly where it cuts the damage.
        const facing = p.facing;
        const half = 0.1;
        const fx = Math.cos(facing);
        const fy = Math.sin(facing);
        let reach = p.toxRadius;
        for (let d = 24; d < p.toxRadius; d += 25) {
          // The jet's damage still reads pillars only, so its drawn shaft must too; no
          // deployed walls or compactor plate in this test.
          if (beamReach(state.arena, null, false, 0, x, y, fx, fy, d) >= d) continue;
          reach = Math.max(60, d - 25);
          break;
        }
        const span = Math.min(reach, p.toxRadius * grow);
        const flicker = 0.9 + 0.1 * Math.sin(t * 26 + p.slot);
        ctx.globalAlpha = 0.14 * fade;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, span, facing - half * 1.6, facing + half * 1.6);
        ctx.closePath();
        ctx.fill();
        // Two offset spines sell a liquid stream better than concentric arcs.
        ctx.globalAlpha = 0.34 * fade * flicker;
        ctx.lineWidth = 1.4;
        for (let e = 0; e < 2; e++) {
          const side = (e === 0 ? -1 : 1) * half * 0.55;
          ctx.beginPath();
          for (let seg = 0; seg <= 6; seg++) {
            const dist = 16 + (span - 16) * (seg / 6);
            const drift = Math.sin(t * 20 + seg * 1.3 + p.slot + e * 2.1) * 2.2;
            const sx = x + Math.cos(facing + side) * dist - Math.sin(facing + side) * drift;
            const sy = y + Math.sin(facing + side) * dist + Math.cos(facing + side) * drift;
            if (seg === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 0.72 * fade * flicker;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let seg = 0; seg <= 6; seg++) {
          const dist = 16 + (span - 16) * (seg / 6);
          const drift = Math.sin(t * 22 + seg * 1.3 + p.slot) * 1.8;
          const sx = x + fx * dist - fy * drift;
          const sy = y + fy * dist + fx * drift;
          if (seg === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        // Motes ride the shaft outward and splash at the end.
        ctx.globalAlpha = 0.66 * fade;
        for (let d = 0; d < 26; d++) {
          const u = (d * 0.37 + k * 2.1) % 1;
          const dist = span * (0.1 + 0.9 * u);
          const fan = Math.sin(t * 17 + d * 1.7 + p.slot) * half * (0.35 + 0.9 * u);
          const a = facing + fan;
          const s = 1.8 + 2 * (0.5 + 0.5 * Math.sin(t * 9 + d * 2.3));
          ctx.fillRect(x + Math.cos(a) * dist - s * 0.5, y + Math.sin(a) * dist - s * 0.5, s, s);
        }
        ctx.globalAlpha = 0.45 * fade;
        for (let d = 0; d < 8; d++) {
          const a = facing + ((d / 7) * 2 - 1) * half * 2.6;
          const dist = span * (0.96 + 0.04 * Math.sin(t * 14 + d));
          const s = 2.2 + 1.6 * (0.5 + 0.5 * Math.sin(t * 12 + d * 2));
          ctx.fillRect(x + Math.cos(a) * dist - s * 0.5, y + Math.sin(a) * dist - s * 0.5, s, s);
        }
      } else {
        ctx.globalAlpha = 0.1 * fade;
        ctx.beginPath();
        ctx.arc(x, y, span, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = 0.46 * fade;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, span, 0, TWO_PI);
        ctx.stroke();
        ctx.globalAlpha = 0.3 * fade;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, span * 0.66, 0, TWO_PI);
        ctx.stroke();
        // The burst itself is a stream of green circles emitted by emitToxicBurst;
        // the rings only mark where the cloud currently reaches.
      }
    }
    if (drew) {
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  private drawDrone(d: Drone, alpha: number, t: number): void {
    if (!d.active) return;
    const ctx = this.ctx;
    const x = lerp(d.prevX, d.x, alpha);
    const y = lerp(d.prevY, d.y, alpha);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = particleColor(P_COLOR_ICE);
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.8;
    ctx.rotate(d.rot);
    ctx.strokeRect(-d.radius, -d.radius, d.radius * 2, d.radius * 2);
    ctx.rotate(-d.rot * 2.2);
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(-d.radius * 0.55, -d.radius * 0.55, d.radius * 1.1, d.radius * 1.1);
    ctx.rotate(d.rot * 1.2);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = particleColor(P_COLOR_ICE);
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, TWO_PI);
    ctx.fill();
    if (d.hitFlash > 0) {
      ctx.globalAlpha = Math.min(0.8, d.hitFlash * 4);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, d.radius + 5, 0, TWO_PI);
      ctx.stroke();
    }
    if (d.poisonT > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 9);
      ctx.globalAlpha = 0.45 + 0.45 * pulse;
      ctx.fillStyle = PROGRAM_COLORS.toxic;
      drawSymbol(ctx, '☠', 0, -d.radius - 12, 8, 1);
    }
    ctx.restore();

    void t;
  }


  /** Memory shard: a slow-spinning diamond over a soft well, fading over its last two seconds. */
  private drawFragments(fragments: readonly Fragment[], alpha: number, t: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < fragments.length; i++) {
      const f = fragments[i];
      if (!f.active) continue;
      const x = lerp(f.prevX, f.x, alpha);
      const y = lerp(f.prevY, f.y, alpha) + Math.sin(t * 2.4 + f.spin) * 4;
      const fade = 0.82 + 0.18 * Math.sin(t * 2.6 + f.spin);
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = 0.14 * fade;
      ctx.fillStyle = MEMORY.color;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = 0.7 * fade;
      ctx.strokeStyle = MEMORY.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 18 + Math.sin(t * 3 + f.spin) * 2, 0, TWO_PI);
      ctx.stroke();
      ctx.rotate(t * 1.6 + f.spin);
      ctx.globalAlpha = 0.95 * fade;
      ctx.fillStyle = MEMORY.color;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = MEMORY.core;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    void alpha;
  }

  /** Pickups are drawn in world space; their icon shape identifies the effect. */
  private drawPickups(pickups: readonly Pickup[], alpha: number, t: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < pickups.length; i++) {
      const pk = pickups[i];
      if (!pk.active) continue;
      const def = POWERUPS[pk.kind];
      if (!def) continue;
      const fade = pk.life < 3 ? 0.35 + 0.65 * Math.abs(Math.sin(pk.life * 7)) : 1;
      const bob = Math.sin(pk.phase * 2.4 + i) * 3;
      const x = pk.x;
      const y = pk.y + bob;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(x, y);
      ctx.globalAlpha = 0.12 * fade;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(0, 0, POWERUP.radius + 10, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.8;
      ctx.save();
      ctx.rotate(t * 0.7 + pk.phase);
      ctx.strokeRect(-POWERUP.radius * 0.75, -POWERUP.radius * 0.75, POWERUP.radius * 1.5, POWERUP.radius * 1.5);
      ctx.restore();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (pk.kind === POWERUP_KIND.RESTORE) {
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
      } else if (pk.kind === POWERUP_KIND.MACHINE_GUN) {
        for (let d = 0; d < 3; d++) {
          ctx.moveTo(-6 + d * 6, 4);
          ctx.lineTo(-6 + d * 6, -4);
        }
      } else if (pk.kind === POWERUP_KIND.SHOTGUN) {
        for (let d = -1; d <= 1; d++) {
          ctx.moveTo(-5, 5);
          ctx.lineTo(5, d * 5);
        }
      } else if (pk.kind === POWERUP_KIND.OVERCHARGE) {
        ctx.moveTo(3, -9);
        ctx.lineTo(-3, 0);
        ctx.lineTo(2, 0);
        ctx.lineTo(-2, 9);
        ctx.lineTo(5, -1);
        ctx.lineTo(0, -1);
        ctx.closePath();
      } else if (pk.kind === POWERUP_KIND.WHIP) {
        ctx.moveTo(-8, 6);
        ctx.quadraticCurveTo(-2, -8, 8, -4);
        ctx.moveTo(0, -3);
        ctx.lineTo(3, -7);
        ctx.lineTo(4, -1);
      } else {
        ctx.moveTo(-8, 6);
        ctx.lineTo(-3, 6);
        ctx.lineTo(-3, 0);
        ctx.lineTo(3, 0);
        ctx.lineTo(3, -6);
        ctx.lineTo(8, -6);
      }
      ctx.stroke();
      ctx.restore();
    }
    void alpha;
  }

  /** One shared circular slot behind every dock mark, so the three jobs read alike. */
  private drawReadinessCell(cx: number, cy: number, color: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, DOCK_SLOT, 0, TWO_PI);
    ctx.fill();
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, DOCK_SLOT, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Circular cooldown mask: the recovered part of the cell stays lit, and a dark wedge
   * covers the part still charging. A bright rim shows the sweep edge, so the state reads
   * as a dial instead of a faint arc around a small mark.
   */
  private drawReadinessMask(cx: number, cy: number, pct: number, color: string, r = DOCK_SLOT): void {
    if (pct >= 0.999) return;
    const ctx = this.ctx;
    const start = -Math.PI / 2;
    const clamped = Math.max(0, Math.min(1, pct));
    const ready = start + TWO_PI * clamped;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.clip();
    ctx.globalAlpha = 0.74;
    ctx.fillStyle = 'rgba(3, 10, 16, 1)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, ready, start + TWO_PI);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, ready);
    ctx.stroke();
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, ready, start + TWO_PI);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * One readiness dock per local player, placed in a screen corner: top-left for a solo
   * view, then top-right, bottom-left and bottom-right as more local players join. The
   * corners keep four docks clear of each other and of the shared minimap.
   */
  private drawReadinessDocks(state: RenderState): void {
    const count = this.localCount;
    const margin = 12;
    const w = DOCK_W;
    const h = DOCK_H;
    // A phone holds the action buttons at the bottom corners, so the local readiness
    // row moves to the top centre and the shared minimap is dropped for this layout.
    if (this.touchLayout) {
      const gap = 10;
      const total = count * w + Math.max(0, count - 1) * gap;
      const startX = (VIEW_W - total) * 0.5;
      for (let i = 0; i < count; i++) {
        const slot = this.localList[i];
        const p = state.players[slot];
        if (!p || !p.active || !p.alive) continue;
        this.drawReadiness(state, slot, startX + i * (w + gap), margin);
      }
      return;
    }
    for (let i = 0; i < count; i++) {
      const slot = this.localList[i];
      const p = state.players[slot];
      if (!p || !p.active || !p.alive) continue;
      let x = margin;
      let y = margin;
      if (count === 2) {
        x = i === 0 ? margin : VIEW_W - w - margin;
      } else if (count === 3) {
        if (i === 1) x = VIEW_W - w - margin;
        else if (i === 2) y = VIEW_H - h - margin;
      } else if (count >= 4) {
        x = (i % 2) === 0 ? margin : VIEW_W - w - margin;
        y = i < 2 ? margin : VIEW_H - h - margin;
      }
      this.drawReadiness(state, slot, x, y);
    }
  }

  /**
   * Local readiness dock. Health and energy stay on the avatar; dash, skill and the
   * power attack live here so they never sit between the avatar and an incoming shot.
   * The three slots are deliberately large: this is the couch-distance readout.
   */
  private drawReadiness(state: RenderState, slot: number, boxX = 12, boxY = 12): void {
    const p = state.players[slot];
    if (!p || !p.active || !p.alive) return;
    const ctx = this.ctx;
    const color = playerColor(state, p);
    const cell = DOCK_CELL;
    const pad = DOCK_PAD;
    const boxW = DOCK_W;
    const boxH = DOCK_H;
    const cy = boxY + boxH * 0.5;
    const first = boxX + pad + cell * 0.5;

    ctx.save();
    // Nearly opaque: world shots and grid lines must not bleed through the dock.
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(3, 10, 16, 0.94)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + 7);
    ctx.lineTo(boxX, boxY);
    ctx.lineTo(boxX + 7, boxY);
    ctx.moveTo(boxX + boxW - 7, boxY);
    ctx.lineTo(boxX + boxW, boxY);
    ctx.lineTo(boxX + boxW, boxY + 7);
    ctx.moveTo(boxX, boxY + boxH - 7);
    ctx.lineTo(boxX, boxY + boxH);
    ctx.lineTo(boxX + 7, boxY + boxH);
    ctx.moveTo(boxX + boxW - 7, boxY + boxH);
    ctx.lineTo(boxX + boxW, boxY + boxH);
    ctx.lineTo(boxX + boxW, boxY + boxH - 7);
    ctx.stroke();
    // Three identical circular slots, one per job, whatever the program. The marks are
    // drawn inside them at the same size, so the dock reads the same on every character.
    for (let i = 0; i < 3; i++) this.drawReadinessCell(first + cell * i, cy, color);

    // 1. Dash charges.
    const dashX = first;
    const dashPct = p.dashCharges >= p.dashMax ? 1 : 1 - Math.min(1, p.dashCd / PLAYER.dashCooldown);
    for (let c = 0; c < p.dashMax; c++) {
      const off = (c - (p.dashMax - 1) * 0.5) * (p.dashMax > 2 ? 10 : 12);
      const filled = c < p.dashCharges;
      ctx.strokeStyle = '#dff7ff';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(dashX - 10 + off, cy - 10);
      ctx.lineTo(dashX + off, cy);
      ctx.lineTo(dashX - 10 + off, cy + 10);
      if (filled) {
        // Wide dim pass under a narrow bright one: bolder without shadowBlur.
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 9;
        ctx.stroke();
      }
      ctx.globalAlpha = filled ? 1 : 0.22;
      ctx.lineWidth = filled ? 4.2 : 2.8;
      ctx.stroke();
    }
    ctx.lineJoin = 'miter';
    if (p.dashCharges < p.dashMax) this.drawReadinessMask(dashX, cy, dashPct, '#dff7ff');

    // 2. Skill (tap Y): a compact program mark with its own cooldown ring.
    const skillX = first + cell;
    const bugReady = p.bugCd <= 0;
    const bugPct = bugReady ? 1 : 1 - Math.min(1, p.bugCd / (BUG.cooldown[p.bugKind] ?? 6));
    ctx.save();
    ctx.translate(skillX, cy);
    ctx.scale(2.6, 2.6);
    ctx.globalAlpha = bugReady ? 1 : 0.34;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    if (p.bugKind === 0) {
      ctx.moveTo(0, -5.5);
      ctx.lineTo(5.5, 0);
      ctx.lineTo(0, 5.5);
      ctx.lineTo(-5.5, 0);
      ctx.closePath();
    } else if (p.bugKind === 1) {
      ctx.moveTo(-4.5, -4.5);
      ctx.lineTo(4.5, 4.5);
      ctx.moveTo(4.5, -4.5);
      ctx.lineTo(-4.5, 4.5);
    } else if (p.bugKind === 2) {
      ctx.moveTo(-5.5, 0);
      ctx.lineTo(5.5, 0);
      ctx.moveTo(-5.5, -4.5);
      ctx.lineTo(-5.5, 4.5);
    } else if (p.bugKind === 3) {
      ctx.setLineDash([2, 3]);
      ctx.arc(0, 0, 5, 0, TWO_PI);
    } else if (p.bugKind === 14) {
      // Copy: two offset documents. The heavy beside it is a redacted stack, so the
      // summon and the super never share one mark.
      ctx.rect(-6, -5.2, 7.2, 7.2);
      ctx.rect(-1.2, -1.6, 7.2, 7.2);
    } else if (p.bugKind === 4) {
      // Rear bracket: an open C with a split spine, so it cannot be read as a
      // closed plate. Mirrors the pair of prongs planted behind Wedge.
      ctx.moveTo(4.5, -6.5);
      ctx.lineTo(-5.5, -6.5);
      ctx.lineTo(-5.5, 6.5);
      ctx.lineTo(4.5, 6.5);
      ctx.moveTo(4.5, -6.5);
      ctx.lineTo(4.5, -1);
      ctx.moveTo(4.5, 1);
      ctx.lineTo(4.5, 6.5);
    } else if (p.bugKind === 6) {
      // Split brooms: two outward arrows with a clear centre gap.
      ctx.moveTo(-2, 0);
      ctx.lineTo(-6, 0);
      ctx.moveTo(-4, -3);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-4, 3);
      ctx.moveTo(2, 0);
      ctx.lineTo(6, 0);
      ctx.moveTo(4, -3);
      ctx.lineTo(6, 0);
      ctx.lineTo(4, 3);
    } else if (p.bugKind === 8) {
      // Lobbed shell: a bomb body with a lit fuse, not a blast ring.
      ctx.arc(0, 0.8, 4.4, 0, TWO_PI);
      ctx.moveTo(2.6, -2.6);
      ctx.lineTo(5, -5);
      ctx.moveTo(5, -5);
      ctx.lineTo(6.6, -4.4);
    } else if (p.bugKind === 9) {
      // Fast-forward: a double chevron, the universal "run it faster" mark. The
      // heavy beside it is an hourglass, so speed and dilation never share a mark.
      ctx.moveTo(-4.5, -5.5);
      ctx.lineTo(-0.5, 0);
      ctx.lineTo(-4.5, 5.5);
      ctx.moveTo(0.5, -5.5);
      ctx.lineTo(4.5, 0);
      ctx.lineTo(0.5, 5.5);
    } else if (p.bugKind === 10) {
      // Orbital shield: a nucleus with three balls around it. The heavy beside it is
      // an orbit ring, so the two atom ideas stay distinguishable at dock size.
      ctx.moveTo(2.2, 0);
      ctx.arc(0, 0, 2.2, 0, TWO_PI);
      for (let b = 0; b < 3; b++) {
        const a = (b / 3) * TWO_PI - Math.PI / 2;
        ctx.moveTo(Math.cos(a) * 4.7 + 1.5, Math.sin(a) * 4.7);
        ctx.arc(Math.cos(a) * 4.7, Math.sin(a) * 4.7, 1.5, 0, TWO_PI);
      }
    } else if (p.bugKind === 11) {
      // Cloak: the program's closed eye, with lashes, so the skill reads as the
      // invisibility and never as the bite or the jump-scare.
      ctx.arc(0, 0.2, 4.4, Math.PI * 0.16, Math.PI * 0.84);
      for (let lash = 0; lash < 3; lash++) {
        const a = Math.PI * (0.27 + lash * 0.23);
        const lx = Math.cos(a) * 4.4;
        const ly = 0.2 + Math.sin(a) * 4.4;
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + Math.cos(a) * 2, ly + Math.sin(a) * 2);
      }
    } else if (p.bugKind === 12) {
      // Size dash: a small box with speed ticks behind it. The heavy beside it is an
      // inward pressure ring, so the two Compress jobs never share one mark.
      ctx.moveTo(-1.2, -4.2);
      ctx.lineTo(4.6, -4.2);
      ctx.lineTo(4.6, 4.2);
      ctx.lineTo(-1.2, 4.2);
      ctx.closePath();
      ctx.moveTo(-6, -3);
      ctx.lineTo(-2.8, -3);
      ctx.moveTo(-6.4, 0);
      ctx.lineTo(-2.4, 0);
      ctx.moveTo(-6, 3);
      ctx.lineTo(-2.8, 3);
    } else if (p.bugKind === 13) {
      // Deployed flipper: a round pivot with a tapered bat, angled across the lane.
      // The heavy beside it is the huge ball, so the two jobs never share a mark.
      ctx.moveTo(-5.2, 4.6);
      ctx.lineTo(2.2, 0.2);
      ctx.lineTo(4.6, 4.2);
      ctx.moveTo(-5.2, 4.6);
      ctx.arc(-5.2, 4.6, 1.5, 0, TWO_PI);
    } else {
      // Lure beacon: a center pulse with two open arcs, no star. Probe's compass uses
      // a closed housing and a four-point rose, so the two marks stay distinct.
      ctx.moveTo(1.7, 0);
      ctx.arc(0, 0, 1.7, 0, TWO_PI);
      ctx.moveTo(Math.cos(-0.8) * 5, Math.sin(-0.8) * 5);
      ctx.arc(0, 0, 5, -0.8, 0.8);
      ctx.moveTo(Math.cos(Math.PI - 0.8) * 5, Math.sin(Math.PI - 0.8) * 5);
      ctx.arc(0, 0, 5, Math.PI - 0.8, Math.PI + 0.8);
    }
    if (bugReady) {
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    } else {
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
    if (!bugReady) this.drawReadinessMask(skillX, cy, bugPct, color);

    // 3. Power attack (hold Y): program-shaped heavy, with its cooldown ring.
    const heavyX = first + cell * 2;
    const heavyReady = p.laserCd <= 0 && p.laserT <= 0 && p.wedgeT <= 0 && p.broT <= 0 && p.orbitT <= 0;
    const heavyMax = p.program === PROGRAM_ID.WEDGE
      ? WEDGE.chargeCooldown
      : p.program === PROGRAM_ID.FISHER
        ? FISHER.netCooldown
        : p.program === PROGRAM_ID.SWEEP
          ? SWEEP.powerCooldown
          : p.program === PROGRAM_ID.KABOOM
            ? KABOOM.clusterCooldown
            : p.program === PROGRAM_ID.BUFFER
              ? BUFFER.slowCooldown
              : p.program === PROGRAM_ID.ATOMIZE
                ? ATOMIZE.powerCooldown
                : p.program === PROGRAM_ID.GHOST
                  ? GHOST.scareCooldown
                  : p.program === PROGRAM_ID.COMPRESS
                    ? COMPRESS.powerCooldown
                    : p.program === PROGRAM_ID.PINBALL
                      ? PINBALL.powerCooldown
                      : p.program === PROGRAM_ID.COPYPASTA
                        ? COPYPASTA.powerCooldown
                        : PLAYER.laserCooldown;
    const heavyColor = p.program === PROGRAM_ID.WEDGE
      ? PROGRAM_COLORS.wedge
      : p.program === PROGRAM_ID.FISHER
        ? PROGRAM_COLORS.fisher
        : p.program === PROGRAM_ID.SWEEP
          ? PROGRAM_COLORS.sweep
          : p.program === PROGRAM_ID.BUFFER
            ? PROGRAM_COLORS.buffer
            : p.program === PROGRAM_ID.ATOMIZE
              ? PROGRAM_COLORS.atomize
              : p.program === PROGRAM_ID.GHOST
                ? PROGRAM_COLORS.ghost
                : p.program === PROGRAM_ID.COMPRESS
                  ? PROGRAM_COLORS.compress
                  : p.program === PROGRAM_ID.PINBALL
                    ? PROGRAM_COLORS.pinball
                    : p.program === PROGRAM_ID.COPYPASTA
                      ? PROGRAM_COLORS.copy
                      : color;
    const heavyLive =
      p.laserT > 0 ||
      p.wedgeT > 0 ||
      p.broT > 0 ||
      p.orbitT > 0 ||
      ((state.timeSlowT ?? 0) > 0 && (state.timeSlowOwner ?? -1) === p.slot) ||
      p.scareT > 0 ||
      ((p.program === PROGRAM_ID.SWEEP ||
        p.program === PROGRAM_ID.KABOOM ||
        p.program === PROGRAM_ID.BUFFER ||
        p.program === PROGRAM_ID.ATOMIZE ||
        p.program === PROGRAM_ID.GHOST ||
        p.program === PROGRAM_ID.COMPRESS ||
        p.program === PROGRAM_ID.PINBALL ||
        p.program === PROGRAM_ID.COPYPASTA) &&
        p.laserChargeHeld);
    ctx.save();
    ctx.translate(heavyX, cy);
    ctx.scale(2.6, 2.6);
    ctx.globalAlpha = heavyLive ? 1 : heavyReady ? 1 : 0.34;
    ctx.strokeStyle = heavyColor;
    ctx.fillStyle = heavyColor;
    ctx.lineWidth = heavyLive ? 2.8 : 2.4;
    ctx.beginPath();
    if (p.program === PROGRAM_ID.WEDGE) {
      // Closed plate for the heavy; the skill beside it is an open bracket. The
      // faint fill keeps the two small marks apart at a glance.
      ctx.rect(-4.5, -4.5, 9, 9);
      const markAlpha = ctx.globalAlpha;
      ctx.globalAlpha = markAlpha * 0.24;
      ctx.fill();
      ctx.globalAlpha = markAlpha;
    } else if (p.program === PROGRAM_ID.FISHER) {
      ctx.moveTo(-4.5, -4.5);
      ctx.lineTo(4.5, 4.5);
      ctx.moveTo(-4.5, 4.5);
      ctx.lineTo(4.5, -4.5);
    } else if (p.program === PROGRAM_ID.SWEEP) {
      // Broom mark: a shaft with a three-strand fan. The skill beside it is two
      // outward arrows, so the two broom ideas never share one mark.
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 1.5);
      ctx.moveTo(-5, 1.5);
      ctx.lineTo(5, 1.5);
      ctx.moveTo(-4, 6);
      ctx.lineTo(0, 1.5);
      ctx.lineTo(4, 6);
    } else if (p.program === PROGRAM_ID.BUFFER) {
      // Dilation: an hourglass, two triangles meeting at a waist. The skill beside it
      // is a double chevron, so speed and time-stop never share one mark.
      ctx.moveTo(-5, -5.5);
      ctx.lineTo(5, -5.5);
      ctx.lineTo(0, 0);
      ctx.lineTo(5, 5.5);
      ctx.lineTo(-5, 5.5);
      ctx.lineTo(0, 0);
      ctx.closePath();
    } else if (p.program === PROGRAM_ID.KABOOM) {
      // Carpet: three shells over one blast line. The skill beside it is a single
      // shell with a fuse, so the two bomb ideas never share one mark.
      ctx.moveTo(-6, 5.4);
      ctx.lineTo(6, 5.4);
      for (let b = -1; b <= 1; b++) {
        ctx.moveTo(b * 4.2 + 1.7, -1.6);
        ctx.arc(b * 4.2, -1.6, 1.7, 0, TWO_PI);
      }
    } else if (p.program === PROGRAM_ID.ATOMIZE) {
      // Orbit field: one ring with a nucleus, not the three-ball shield mark.
      ctx.ellipse(0, 0, 6.4, 2.6, 0.62, 0, TWO_PI);
      ctx.moveTo(1.7, 0);
      ctx.arc(0, 0, 1.7, 0, TWO_PI);
    } else if (p.program === PROGRAM_ID.COMPRESS) {
      // Pressure burst: four inward arrows collapsing on the body. The skill beside it
      // is a small body with speed ticks, so fold and squeeze never share a mark.
      for (let k = 0; k < 4; k++) {
        const a = k * (Math.PI / 2) + Math.PI / 4;
        const c = Math.cos(a);
        const s = Math.sin(a);
        ctx.moveTo(c * 6.6 + s * 2.4, s * 6.6 - c * 2.4);
        ctx.lineTo(c * 2.4, s * 2.4);
        ctx.lineTo(c * 6.6 - s * 2.4, s * 6.6 + c * 2.4);
      }
    } else if (p.program === PROGRAM_ID.PINBALL) {
      // Giant ball: the circled X at full weight with two speed ticks behind it. The
      // skill beside it is the flipper bat, so the two jobs never share a mark.
      ctx.arc(0, 0, 5.8, 0, TWO_PI);
      ctx.moveTo(-3.3, -3.3);
      ctx.lineTo(3.3, 3.3);
      ctx.moveTo(3.3, -3.3);
      ctx.lineTo(-3.3, 3.3);
      ctx.moveTo(-8, -2.4);
      ctx.lineTo(-6.4, -2.4);
      ctx.moveTo(-8.4, 2.4);
      ctx.lineTo(-6.4, 2.4);
    } else if (p.program === PROGRAM_ID.COPYPASTA) {
      // Redaction: a document stack under a heavy bar. The skill beside it is the
      // offset copy stamp, so owning a copy and marking a crowd never read alike.
      ctx.rect(-5.6, -6, 7, 7);
      ctx.moveTo(-1.4, -2.6);
      ctx.rect(-1.4, -2.6, 7, 7);
      ctx.moveTo(-6.4, 3.4);
      ctx.lineTo(6.4, 3.4);
      ctx.moveTo(-6.4, 5.2);
      ctx.lineTo(2.2, 5.2);
    } else if (p.program === PROGRAM_ID.GHOST) {
      // Jump-scare: a wide open maw with a zigzag of teeth. The skill beside it is the
      // closed eye, so cloak and scare never share a mark.
      ctx.ellipse(0, 0, 6, 3.4, 0, 0, TWO_PI);
      ctx.moveTo(-4.8, -1.4);
      ctx.lineTo(-3, -3);
      ctx.lineTo(-1.2, -1.4);
      ctx.lineTo(0.6, -3);
      ctx.lineTo(2.4, -1.4);
      ctx.lineTo(4.2, -3);
      ctx.lineTo(4.8, -1.4);
      ctx.moveTo(-4.8, 1.4);
      ctx.lineTo(-3, 3);
      ctx.lineTo(-1.2, 1.4);
      ctx.lineTo(0.6, 3);
      ctx.lineTo(2.4, 1.4);
      ctx.lineTo(4.2, 3);
      ctx.lineTo(4.8, 1.4);
    } else {
      ctx.moveTo(0, -5.5);
      ctx.lineTo(0, 5.5);
    }
    if (heavyReady || heavyLive) {
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = heavyLive ? 6.5 : 6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = heavyLive ? 2.8 : 2.4;
      ctx.stroke();
    } else {
      ctx.stroke();
    }
    ctx.restore();
    if (!heavyReady && !heavyLive) {
      const cdPct = 1 - Math.min(1, p.laserCd / heavyMax);
      this.drawReadinessMask(heavyX, cy, cdPct, heavyColor);
    }

    ctx.restore();
  }

  /**
   * Toxic's needle: a hypodermic drawn from basic shapes, pointing +x. A typed `†`
   * read as a cross at projectile size, so the syringe is geometry: flange, plunger
   * rod, barrel with a venom window, hub and a thin sharp needle. Nothing here builds
   * strings or allocates; the whole thing is five paths at the current fill colour.
   */
  private drawSyringe(
    x: number,
    y: number,
    angle: number,
    r: number,
    color: string,
  ): void {
    const ctx = this.ctx;
    // Proportions are what make it read as a syringe at six units: a barrel you can
    // see, then a needle at least as long again. A short tip just reads as a pill.
    const s = Math.max(5, r * 1.05);
    const line = Math.max(1, s * 0.14);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Needle: a hairline out of the hub, long enough to be the point of the shape.
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.moveTo(s * 1.25, 0);
    ctx.lineTo(s * 3.6, 0);
    ctx.stroke();

    // Barrel: a dark glass fill inside a bright rounded rectangle.
    ctx.globalAlpha = 0.2;
    ctx.fillRect(-s * 1.25, -s * 0.62, s * 2.3, s * 1.24);
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.roundRect(-s * 1.25, -s * 0.62, s * 2.3, s * 1.24, s * 0.24);
    ctx.stroke();

    // Venom window: a bright load inside the barrel, so the body has weight.
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-s * 0.95, -s * 0.3, s * 1.6, s * 0.6);

    // Hub: a short taper from the barrel to the needle root.
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(s * 1.05, -s * 0.4);
    ctx.lineTo(s * 1.3, -s * 0.14);
    ctx.lineTo(s * 1.3, s * 0.14);
    ctx.lineTo(s * 1.05, s * 0.4);
    ctx.closePath();
    ctx.fill();

    // Plunger rod and its flange at the back: the other half of the silhouette.
    ctx.lineWidth = Math.max(1, s * 0.18);
    ctx.beginPath();
    ctx.moveTo(-s * 1.25, 0);
    ctx.lineTo(-s * 2.35, 0);
    ctx.moveTo(-s * 2.35, -s * 0.7);
    ctx.lineTo(-s * 2.35, s * 0.7);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draws the broom head the way the ASCII mark reads: a binder row `/=====\` over
   * dense rows of bristles `|||||||||`. Real characters, not stroked shapes, so the
   * kit and the program mark are the same object. Row strings are cached per column
   * count, so drawing allocates nothing after the first frame at a given size.
   *
   * (x, y) is the middle of the binder's back edge, `half` is half the head width and
   * `depth` is the whole head from binder to bristle tips. Bristles point +y in local
   * space; `angle` rotates that onto the push direction (PI/2 is straight down).
   */
  private drawBroomText(
    x: number,
    y: number,
    half: number,
    depth: number,
    angle: number,
    alpha: number,
    color: string,
    reveal = 1,
    revealDir = 1,
  ): void {
    if (half < 2 || depth < 4) return;
    const ctx = this.ctx;
    const headPx = depth * 0.34;
    const teethPx = depth * 0.22;
    // Monospace advance is about 0.6em; the bristle rows are set tighter (0.5em) so
    // the comb reads dense, like the `|||||||||` row in the mark.
    const headCols = Math.max(3, Math.round((half * 2) / (headPx * 0.6)));
    const teethCols = Math.max(4, Math.round((half * 2) / (teethPx * 0.5)));
    const head = broomHeadRow(headCols);
    const teeth = broomTeethRow(teethCols);
    ctx.save();
    ctx.translate(x, y);
    // Canonical block: binder on top, bristles below. `angle` turns that comb onto the
    // push direction; Math.PI / 2 is straight down, the avatar's resting hold.
    ctx.rotate(angle - Math.PI / 2);
    if (reveal < 1) {
      // Reveal from one edge in the facing direction instead of blooming from the
      // middle: dir +1 is left to right, dir -1 right to left.
      const w = half * 2 * reveal;
      ctx.beginPath();
      if (revealDir < 0) ctx.rect(half - w, 0, w, depth);
      else ctx.rect(-half, 0, w, depth);
      ctx.clip();
    }
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // Stretch each row so it spans the head exactly. Measured once per size, then a
    // cheap x-scale keeps the binder and the bristle rows flush at both ends.
    const headSx = (half * 2) / broomRowWidth(ctx, head, headPx);
    const teethSx = (half * 2) / broomRowWidth(ctx, teeth, teethPx);
    // Binder row, then two bristle rows. A wide, faint stroke is the glow pass.
    ctx.font = symbolFont(headPx);
    ctx.save();
    ctx.scale(headSx, 1);
    ctx.globalAlpha = alpha * 0.3;
    ctx.lineWidth = 3 / headSx;
    ctx.strokeText(head, 0, headPx * 0.5);
    ctx.globalAlpha = alpha;
    ctx.fillText(head, 0, headPx * 0.5);
    ctx.restore();
    ctx.font = symbolFont(teethPx);
    ctx.save();
    ctx.scale(teethSx, 1);
    for (let r = 0; r < 3; r++) {
      const rowY = headPx + teethPx * (0.5 + r);
      ctx.globalAlpha = alpha * 0.28;
      ctx.lineWidth = 2.2 / teethSx;
      ctx.strokeText(teeth, 0, rowY);
      ctx.globalAlpha = alpha;
      ctx.fillText(teeth, 0, rowY);
    }
    ctx.restore();
    ctx.restore();
  }

  /**
   * Aim Bot's melee: a combat knife, not the shared spiked lash. The blade is one
   * bowie outline (grip, cross guard, clipped spine, curved belly, fuller) riding the
   * same arc sweep, so the sniper's only crowd answer reads as a knife.
   */
  private drawKnifeSwing(p: Player, x: number, y: number, facing: number, color: string, whip: boolean): void {
    const ctx = this.ctx;
    const half = p.meleeHalfAngle;
    const dir = p.swingDir < 0 ? -1 : 1;
    const pct = Math.max(0, Math.min(1, p.swingPct));
    const reach = PLAYER.swingReach * p.meleeReachMult * (whip ? POWERUP.whipMultiplier : 1);
    const progress = p.swingPhase === 1 ? 0 : p.swingPhase === 2 ? 1 - pct : 1;
    const start = facing - dir * half * 0.96;
    const angle = start + dir * half * 1.92 * progress;
    const alpha = p.swingPhase === 2 ? 0.95 : p.swingPhase === 3 ? 0.3 : 0.55;
    const bladeColor = whip ? '#ff3e63' : color;
    const inner = PLAYER.radius + 8;
    const len = Math.max(20, reach - inner);
    const w = Math.max(4.5, len * 0.15);
    const grip = len * 0.2;
    const gripEnd = inner + grip;
    const bladeLen = len - grip;

    ctx.save();
    ctx.translate(x, y);
    // Thin ghost blades behind the live one sell the arc without filling it.
    for (let s = 3; s >= 1; s--) {
      const ghost = angle - dir * s * 0.13;
      ctx.save();
      ctx.rotate(ghost);
      ctx.globalAlpha = alpha * (0.05 + (3 - s) * 0.045);
      ctx.strokeStyle = bladeColor;
      ctx.lineWidth = 1.2;
      this.pathKnife(inner, bladeLen, w * 0.9);
      ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    // Grip against the body; the pommel bar keeps the near end readable.
    ctx.fillStyle = '#10141a';
    ctx.strokeStyle = bladeColor;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.rect(inner - 2, -w * 0.22, grip + 2, w * 0.44);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = bladeColor;
    ctx.fillRect(inner - 4, -w * 0.3, 2.5, w * 0.6);
    // Cross guard: a short flare where the grip meets the ricasso.
    ctx.beginPath();
    ctx.moveTo(gripEnd, -w * 0.9);
    ctx.lineTo(gripEnd + 5, -w * 0.52);
    ctx.lineTo(gripEnd + 5, w * 0.52);
    ctx.lineTo(gripEnd, w * 0.9);
    ctx.closePath();
    ctx.fill();
    // The blade itself: clipped spine, curved belly, translucent fill.
    this.pathKnife(gripEnd, bladeLen, w);
    ctx.globalAlpha = alpha * 0.18;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'miter';
    ctx.stroke();
    // Fuller groove, then a bright edge highlight along the belly.
    ctx.globalAlpha = alpha * 0.7;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gripEnd + bladeLen * 0.12, -w * 0.08);
    ctx.lineTo(gripEnd + bladeLen * 0.64, -w * 0.08);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.55;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(gripEnd + 4, w * 0.56);
    ctx.quadraticCurveTo(gripEnd + bladeLen * 0.58, w * 0.95, gripEnd + bladeLen * 0.94, w * 0.05);
    ctx.stroke();
    ctx.restore();
  }

  /** One bowie blade outline: straight spine, clipping point, curved belly. */
  private pathKnife(x0: number, len: number, w: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x0, -w * 0.58);
    ctx.lineTo(x0 + len * 0.72, -w * 0.58);
    // The clip drops the spine toward the edge before the tip.
    ctx.lineTo(x0 + len * 0.89, -w * 0.18);
    ctx.lineTo(x0 + len, 0);
    // Belly sweeps back from the point to the heel.
    ctx.quadraticCurveTo(x0 + len * 0.6, w * 0.96, x0, w * 0.58);
    ctx.closePath();
  }

  /**
   * Pinball's melee: the two flipper bats hinged at the body's sides snap shut across the
   * forward arc. They share the flipper outline with the health hull and the deployed
   * skill arm, so a swing reads as the table's own hardware instead of another lash.
   */
  private drawPinballSwing(p: Player, x: number, y: number, facing: number, color: string): void {
    const ctx = this.ctx;
    const whip = p.powerupT > 0 && p.powerupKind === POWERUP_KIND.WHIP;
    const lashColor = whip ? '#ff3e63' : color;
    const pct = Math.max(0, Math.min(1, p.swingPct));
    // World sets swingPct to 1 on the first active frame and drains it to 0, so this
    // opens on startup and snaps shut over the active window.
    const snap = p.swingPhase === 1 ? 0 : p.swingPhase === 2 ? 1 - pct : 1;
    const alpha = p.swingPhase === 2 ? 0.95 : p.swingPhase === 3 ? 0.3 : 0.55;
    const reach = PLAYER.swingReach * p.meleeReachMult * (whip ? POWERUP.whipMultiplier : 1);
    const pivotR = PLAYER.radius * 0.92;
    const batLen = Math.max(26, reach - PLAYER.radius * 0.55);
    const baseW = 4.8;
    const tipW = 9;
    const open = 1.12;
    const shut = 0.3;
    ctx.save();
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      const swingSide = side * Math.PI * 0.5;
      const pivotX = x + Math.cos(facing + swingSide) * pivotR;
      const pivotY = y + Math.sin(facing + swingSide) * pivotR;
      const angle = facing + side * (open + (shut - open) * snap);
      // Ghost bats mark the swept lane behind the live arm.
      for (let g = 2; g >= 1; g--) {
        const ghostSnap = Math.max(0, snap - g * 0.22);
        const ghostAngle = facing + side * (open + (shut - open) * ghostSnap);
        ctx.globalAlpha = alpha * (0.04 + (2 - g) * 0.05);
        ctx.strokeStyle = lashColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        pathPinballFlipper(ctx, pivotX, pivotY, ghostAngle, batLen, baseW * 0.9, tipW * 0.9);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(4, 10, 16, 0.92)';
      ctx.strokeStyle = lashColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      pathPinballFlipper(ctx, pivotX, pivotY, angle, batLen, baseW, tipW);
      ctx.fill();
      ctx.stroke();
      // Bright hinge edge and a white highlight along the paddle's leading face.
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = '#eef8ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(
        pivotX + Math.cos(angle) * 5 - Math.sin(angle) * 2,
        pivotY + Math.sin(angle) * 5 + Math.cos(angle) * 2,
      );
      ctx.lineTo(
        pivotX + Math.cos(angle) * (batLen - 2) - Math.sin(angle) * 3,
        pivotY + Math.sin(angle) * (batLen - 2) + Math.cos(angle) * 3,
      );
      ctx.stroke();
      // Pivot housing: the hinge that makes the bat read as a flipper.
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(4, 10, 16, 0.95)';
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 7.5, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = lashColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 7.5, 0, TWO_PI);
      ctx.stroke();
      ctx.fillStyle = '#eef8ff';
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 2.2, 0, TWO_PI);
      ctx.fill();
      // The live paddle flashes at the tip during the active window.
      if (p.swingPhase === 2) {
        const tipX = pivotX + Math.cos(angle) * (batLen + tipW * 0.55);
        const tipY = pivotY + Math.sin(angle) * (batLen + tipW * 0.55);
        const spark = 3.2 + Math.sin(p.swingT * 42 + side) * 1.1;
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = '#eef8ff';
        ctx.beginPath();
        ctx.arc(tipX, tipY, Math.max(1.8, spark), 0, TWO_PI);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Sweep's melee. The broom head is held out in front of the avatar, bristles up, and
   * strokes straight up and down across the lane instead of riding a curved arc. The
   * two diagonal combo hits alternate the direction of the stroke; the big third hit
   * spans a longer stroke with a wider head.
   */
  private drawBroomSwing(p: Player, x: number, y: number, facing: number, color: string): void {
    const pct = Math.max(0, Math.min(1, p.swingPct));
    const progress = p.swingPhase === 1 ? 0 : p.swingPhase === 2 ? 1 - pct : 1;
    const big = p.swingKind === 3;
    const reach = big ? SWEEP.bigReach : PLAYER.punchReach;
    const depth = big ? 46 : 24;
    const half = big ? 26 : 14;
    const span = reach * (big ? 0.95 : 0.6);
    const alpha = p.swingPhase === 2 ? 0.95 : p.swingPhase === 3 ? 0.3 : 0.55;
    // Hit one comes down, hit two comes back up, the payoff sweeps the full lane.
    const from = p.swingKind === 2 ? span : -span;
    const offset = from + (-from - from) * progress;
    const bx = x + Math.cos(facing) * reach * 0.8;
    const by = y + Math.sin(facing) * reach * 0.8 + offset;
    const ctx = this.ctx;
    this.drawBroomText(bx, by - depth * 0.5, half, depth, Math.PI / 2, alpha, color);
    // Square dust shaken off the bristles along the stroke.
    ctx.save();
    ctx.fillStyle = '#9aa7b4';
    for (let i = 0; i < 5; i++) {
      const trail = i * 0.16;
      const wobble = Math.sin(p.swingT * 42 + i * 2.1) * 3;
      ctx.globalAlpha = alpha * (0.34 - i * 0.055);
      ctx.fillRect(bx - half + (i / 4) * half * 2 + wobble, by + depth * 0.5 + trail * span * 0.5, 3.2, 3.2);
    }
    ctx.restore();
  }

  /**
   * Sweep's heavy. The head assembles at the top of the player's view, then drops about
   * two thirds of the way down the screen. While live it is a committed world position,
   * so panning the camera does not drag the broom with it.
   *
   * The charge shows a faint full-width ghost of the lane. On commit the bright head
   * materializes from the facing side, with a bright front riding the edge, and only
   * then does the stroke begin. That keeps the assembly readable without the head
   * popping in at full width on the cast frame.
   */
  private drawGiantBroom(p: Player, color: string, t: number): void {
    const charging = p.laserChargeHeld && p.broT <= 0;
    if (!charging && p.broT <= 0) return;
    const build = charging ? Math.max(0, Math.min(1, p.laserChargeT / SWEEP.powerChargeTime)) : 1;
    const cx = p.broX;
    const cy = p.broY + (charging ? 0 : p.broS);
    const half = SWEEP.powerSpan;
    const depth = SWEEP.powerWidth * 2;
    const reveal =
      charging || p.broRevealDur <= 0
        ? 1
        : Math.max(0, Math.min(1, 1 - p.broRevealT / p.broRevealDur));
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Bristles up, like the melee broom: the head is held over the lane and strokes.
    if (charging) {
      this.drawBroomText(cx, cy - depth * 0.5, half, depth, Math.PI / 2, 0.16 + 0.2 * build, color);
    } else if (p.broRevealT > 0) {
      // Ghost of the whole head, then the bright part that has already arrived.
      this.drawBroomText(cx, cy - depth * 0.5, half, depth, Math.PI / 2, 0.16, color);
      this.drawBroomText(
        cx,
        cy - depth * 0.5,
        half,
        depth,
        Math.PI / 2,
        0.96,
        color,
        reveal,
        p.broRevealDir,
      );
      const edgeX = p.broRevealDir > 0 ? -half + half * 2 * reveal : half - half * 2 * reveal;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(cx + edgeX - 1.5, cy - depth * 0.5, 3, depth);
      ctx.globalAlpha = 1;
    } else {
      this.drawBroomText(cx, cy - depth * 0.5, half, depth, Math.PI / 2, 0.96, color);
    }
    ctx.restore();
    // Dust shed from the bristle tips along the stroke.
    ctx.save();
    ctx.fillStyle = '#a7b1bb';
    const tips = cy + depth * 0.5;
    const dust = charging ? build : 1;
    for (let i = 0; i < 14; i++) {
      const k = (i / 13) * 2 - 1;
      const wobble = Math.sin(t * 9 + i * 1.7) * 7;
      ctx.globalAlpha = (0.15 + 0.22 * dust) * (1 - Math.abs(k) * 0.55);
      ctx.fillRect(cx + k * half + wobble, tips + 4 + (i % 3) * 6, 4, 4);
    }
    ctx.restore();
  }

  /** Sweep's skill: the two brooms splitting outward, plus the dust in the lane. */
  private drawFan(p: Player, color: string, t: number): void {
    if (p.fanT <= 0 || p.fanDur <= 0) return;
    const pct = Math.max(0, Math.min(1, 1 - p.fanT / p.fanDur));
    const spread = SWEEP.fanReach * pct;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      const bx = p.fanX + p.fanTx * spread * side;
      const by = p.fanY + p.fanTy * spread * side;
      const angle = Math.atan2(p.fanTy * side, p.fanTx * side);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(angle);
      ctx.restore();
      this.drawBroomText(bx, by - 16, 22, 32, Math.PI / 2, 0.9, color);
    }
    ctx.restore();
  }

  /**
   * Pad transit: the avatar unloads in layers at the source, then the same layers
   * rebuild at the mate. The hull goes first on the way out and last on the way in,
   * so the character reads as decompiling and recompiling rather than blinking.
   */
  private drawPadTransit(state: RenderState, p: Player, t: number, localMask = 1 << state.localSlot): void {
    if (p.travelDur <= 0) return;
    const pct = 1 - Math.max(0, Math.min(1, p.travelT / p.travelDur));
    const unload = pct < 0.5;
    const phase = unload ? pct * 2 : (pct - 0.5) * 2;
    const reveal = Math.max(0, Math.min(1, unload ? 1 - phase : phase));
    const x = p.x;
    const y = p.y;
    const color = playerColor(state, p);
    const isLocal = (localMask & (1 << p.slot)) !== 0;
    const hull = Math.max(0, Math.min(1, (reveal - 0.5) / 0.5));
    const core = Math.max(0, Math.min(1, (reveal - 0.2) / 0.6));
    const glyphA = Math.max(0, Math.min(1, reveal / 0.35));
    const ctx = this.ctx;
    ctx.save();

    if (hull > 0) {
      const spin = t * 0.22 + (p.program === PROGRAM_ID.WEDGE ? Math.PI / 4 : 0);
      ctx.strokeStyle = color;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.34 * hull;
      ctx.lineWidth = 1.4;
      pathProgramFrame(ctx, p.program, x, y, PLAYER.radius, spin);
      ctx.stroke();
      if (isLocal) {
        ctx.globalAlpha = hull;
        ctx.lineWidth = 2.6;
        const maxSegments = p.maxHp > 0 ? p.maxHp : PLAYER.hp;
        pathProgramHealth(ctx, p.program, x, y, PLAYER.radius, spin, maxSegments, maxSegments);
        ctx.stroke();
        ctx.globalAlpha = 0.32 * hull;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.globalAlpha = hull;
        ctx.lineWidth = 2.6;
        ctx.stroke();
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'miter';
    }

    if (core > 0) {
      ctx.globalAlpha = 0.82 * core;
      ctx.fillStyle = 'rgba(2, 7, 12, 0.88)';
      ctx.beginPath();
      ctx.arc(x, y, PLAYER.radius * 0.45, 0, TWO_PI);
      ctx.fill();
    }

    if (glyphA > 0) {
      ctx.globalAlpha = glyphA;
      ctx.fillStyle = color;
      if (state.online) {
        drawGlyph(ctx, slotGlyph(p.slot), x, y + 1, PLAYER.radius * 0.51);
      } else {
        const glyph = programDef(p.program);
        drawProgramMark(ctx, p.program, glyph.glyph, glyph.symbolFont, x, y + 1, PLAYER.radius * (glyph.glyphRadius ?? 0.51), glyph.coreScale);
      }
    }

    // Transfer scan: a ring that closes on the source and opens on the mate, plus a
    // single slice line so the loading order is visible frame by frame.
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.globalAlpha = unload ? 0.8 : 0.6;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, (PLAYER.radius + 7) * (0.16 + 0.95 * reveal), 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    const sliceY = y + PLAYER.radius - reveal * PLAYER.radius * 2;
    ctx.moveTo(x - PLAYER.radius - 10, sliceY);
    ctx.lineTo(x + PLAYER.radius + 10, sliceY);
    ctx.stroke();
    ctx.restore();
  }

  /** Fills around the local avatar while a pad or lift is waiting for the ride to arm. */
  private drawTravelProgress(state: RenderState, slot: number): void {
    const p = state.players[slot];
    if (!p || !p.active || !p.alive || p.travelT > 0 || p.travelDwell <= 0) return;
    const needed = p.travelKind === TRAVEL.lift ? TRAVERSE.liftDwell : TRAVERSE.padDwell;
    const pct = Math.max(0, Math.min(1, p.travelDwell / needed));
    const x = lerp(p.prevX, p.x, 1);
    const y = lerp(p.prevY, p.y, 1);
    const r = PLAYER.radius + TRAVERSE.dwellRing;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = state.arena.accent;
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.92;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI * 0.5, -Math.PI * 0.5 + TWO_PI * pct);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Screen-space ride transition. The lift shrinks a stack of deck outlines toward the
   * centre while the veil rises, which reads as the floor dropping away; the pad is a
   * short white ring flash. Both hide the body swap that already happened in the sim.
   */
  private drawTravelOverlay(state: RenderState, view: CameraView): void {
    // Only the lift is a full-screen transition; pad transit is drawn on the avatar
    // itself, so the unload and reload stay visible at both plates. On a shared screen
    // the first local player riding a lift owns the transition.
    let p: Player | null = null;
    for (let i = 0; i < state.players.length; i++) {
      if ((view.localMask & (1 << i)) === 0) continue;
      const q = state.players[i];
      if (q && q.travelT > 0 && q.travelDur > 0 && q.travelKind === TRAVEL.lift) {
        p = q;
        break;
      }
    }
    if (!p) return;
    const pct = 1 - Math.max(0, Math.min(1, p.travelT / p.travelDur));
    const ctx = this.ctx;
    const viewW = view.w;
    const viewH = view.h;
    const cx = viewW * 0.5;
    const cy = viewH * 0.5;
    ctx.save();
    const rise = Math.min(1, pct / 0.52);
    const fall = Math.max(0, (pct - 0.52) / 0.48);
    const veil = Math.min(0.94, rise * 1.1) * (1 - fall);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = state.arena.accent;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      const s = (1 - rise) * (0.94 - k * 0.15) + 0.05;
      const w = viewW * 0.94 * s;
      const h = viewH * 0.86 * s;
      ctx.globalAlpha = (0.4 - k * 0.06) * (1 - fall);
      ctx.strokeRect(cx - w * 0.5, cy - h * 0.5, w, h);
    }
    ctx.globalAlpha = 0.3 * (1 - fall);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const yy = ((i / 12 + pct * 1.6) % 1) * viewH;
      ctx.moveTo(cx - 26, yy);
      ctx.lineTo(cx + 26, yy);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#01040a';
    ctx.globalAlpha = veil;
    ctx.fillRect(0, 0, viewW, viewH);
    if (fall > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = state.arena.accent;
      ctx.globalAlpha = (1 - fall) * 0.7;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 40 + fall * 250, 0, TWO_PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Toggleable minimap. It shows cover, the local avatar, other players and local
   * gauntlet threats. No labels; the shapes already carry meaning.
   */
  private drawMinimap(state: RenderState, t: number, localMask: number, centered: boolean): void {
    const arena = state.arena;
    const b = arena.bounds;
    const spanX = Math.max(1, b.right - b.left);
    const spanY = Math.max(1, b.bottom - b.top);
    const w = 148;
    const h = Math.max(74, Math.min(116, w * (spanY / spanX)));
    // One map for the whole screen: lower-left for a solo view, top-center when local
    // players share the view or the view is split, so it does not belong to one pane.
    const x0 = centered ? (VIEW_W - w) * 0.5 : 12;
    const y0 = centered ? 12 : VIEW_H - h - 12;
    const sx = w / spanX;
    const sy = h / spanY;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = 'rgba(3, 10, 16, 0.78)';
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
    ctx.globalAlpha = 0.22;
    const disc = arena.disc;
    const discX = x0 + (discCenterX(arena) - b.left) * sx;
    const discY = y0 + (discCenterY(arena) - b.top) * sy;
    const discR = disc ? disc.radius * Math.min(sx, sy) : 0;
    if (disc) {
      // The round lip is the only edge on this map. A dashed inner arc keeps the drop
      // reading, without a rectangular frame the arena does not have.
      ctx.beginPath();
      ctx.arc(discX, discY, discR, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(discX, discY, discR - 3, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
      // The read arm at the current phase, so the map agrees with the plate.
      const aa = discArmAngle(arena, state.discT ?? 0);
      const apx = x0 + (discArmPivotX(arena) - b.left) * sx;
      const apy = y0 + (discArmPivotY(arena) - b.top) * sy;
      const alen = discArmLength(arena) * Math.min(sx, sy);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(apx, apy);
      ctx.lineTo(apx + Math.cos(aa) * alen, apy + Math.sin(aa) * alen);
      ctx.stroke();
    } else if (arena.openShots) {
      // An open-shot arena has no wall to draw on the map either.
    } else if (arena.walls === 'open') {
      // A broken inner rim on the map: the edge is a drop, not a wall.
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x0 + 5.5, y0 + 5.5, w - 11, h - 11);
      ctx.setLineDash([]);
    } else {
      ctx.strokeRect(x0 + 5.5, y0 + 5.5, w - 11, h - 11);
    }
    ctx.globalAlpha = 1;
    // Holes are the darkest thing on the map: a floor opening, not cover.
    if (disc) {
      ctx.fillStyle = '#010309';
      const dt = state.discT ?? 0;
      for (let i = 0; i < disc.holes.length; i++) {
        const hx = discHoleX(arena, i, dt);
        const hy = discHoleY(arena, i, dt);
        ctx.beginPath();
        ctx.arc(x0 + (hx - b.left) * sx, y0 + (hy - b.top) * sy, Math.max(1.3, disc.holes[i].radius * Math.min(sx, sy)), 0, TWO_PI);
        ctx.fill();
      }
    }
    if (arena.voids) {
      ctx.fillStyle = '#010309';
      for (let i = 0; i < arena.voids.length; i++) {
        const r = arena.voids[i];
        ctx.fillRect(x0 + (r.x - b.left) * sx, y0 + (r.y - b.top) * sy, Math.max(2, r.w * sx), Math.max(2, r.h * sy));
      }
    }
    // Cover: brighter than the floor so it still reads at thumbnail size.
    ctx.fillStyle = COLORS.pillarFill;
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      ctx.fillRect(x0 + (r.x - b.left) * sx, y0 + (r.y - b.top) * sy, Math.max(2, r.w * sx), Math.max(2, r.h * sy));
    }
    if (arena.keypad) {
      const kp = arena.keypad;
      for (let i = 0; i < kp.keys.length; i++) {
        const k = kp.keys[i];
        const st = state.keypadStates?.[i] ?? KEYPAD_STATE.up;
        const solid = st === KEYPAD_STATE.slam || st === KEYPAD_STATE.down || st === KEYPAD_STATE.rise;
        ctx.fillStyle = solid ? 'rgba(255, 207, 92, 0.68)' : 'rgba(255, 207, 92, 0.13)';
        ctx.fillRect(
          x0 + (k.x - b.left) * sx,
          y0 + (k.y - b.top) * sy,
          Math.max(1.5, k.w * sx),
          Math.max(1.5, k.h * sy),
        );
        ctx.strokeStyle = 'rgba(255, 207, 92, 0.32)';
        ctx.lineWidth = 0.7;
        ctx.strokeRect(
          x0 + (k.x - b.left) * sx + 0.5,
          y0 + (k.y - b.top) * sy + 0.5,
          Math.max(1, k.w * sx) - 1,
          Math.max(1, k.h * sy) - 1,
        );
      }
    }
    if (arena.scanner) {
      const s = arena.scanner;
      ctx.fillStyle = 'rgba(222, 232, 238, 0.2)';
      ctx.fillRect(x0 + (s.x - b.left) * sx, y0 + (s.y - b.top) * sy, s.w * sx, s.h * sy);
      ctx.strokeStyle = 'rgba(222, 232, 238, 0.4)';
      ctx.lineWidth = 0.7;
      ctx.strokeRect(
        x0 + (s.x - b.left) * sx + 0.5,
        y0 + (s.y - b.top) * sy + 0.5,
        s.w * sx - 1,
        s.h * sy - 1,
      );
      const ly = scannerLaserY(s, state.scannerT ?? 0);
      if (ly >= 0) {
        ctx.strokeStyle = THREAT_COLORS.firewall;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + (s.x - b.left) * sx, y0 + (ly - b.top) * sy);
        ctx.lineTo(x0 + (s.x + s.w - b.left) * sx, y0 + (ly - b.top) * sy);
        ctx.stroke();
      }
    }
    if (arena.browser) {
      const br = arena.browser;
      ctx.fillStyle = 'rgba(89, 216, 255, 0.24)';
      ctx.fillRect(
        x0 + (br.chrome.x - b.left) * sx,
        y0 + (br.chrome.y - b.top) * sy,
        br.chrome.w * sx,
        Math.max(2, br.chrome.h * sy),
      );
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x0 + (br.chrome.x + 6 - b.left) * sx, y0 + (br.chrome.y + br.chrome.h * 0.55 - b.top) * sy);
      ctx.lineTo(x0 + (br.chrome.x + br.chrome.w - 6 - b.left) * sx, y0 + (br.chrome.y + br.chrome.h * 0.55 - b.top) * sy);
      ctx.stroke();
      const page = br.pages[((state.browserPage ?? 0) % br.pages.length + br.pages.length) % br.pages.length];
      if (page) {
        ctx.fillStyle = 'rgba(89, 216, 255, 0.34)';
        for (let i = 0; i < page.elements.length; i++) {
          const r = page.elements[i];
          ctx.fillRect(
            x0 + (r.x - b.left) * sx,
            y0 + (r.y - b.top) * sy,
            Math.max(1, r.w * sx),
            Math.max(1, r.h * sy),
          );
        }
      }
    }
    if (arena.bumpers) {
      ctx.fillStyle = 'rgba(183, 155, 255, 0.75)';
      for (let i = 0; i < arena.bumpers.length; i++) {
        const b = arena.bumpers[i];
        ctx.beginPath();
        ctx.arc(
          x0 + (b.x - arena.bounds.left) * sx,
          y0 + (b.y - arena.bounds.top) * sy,
          Math.max(1.5, b.radius * Math.min(sx, sy)),
          0,
          TWO_PI,
        );
        ctx.fill();
      }
    }
    const tr = arena.traverse;
    if (tr) {
      ctx.fillStyle = '#02050a';
      for (let i = 0; i < tr.chasms.length; i++) {
        const r = tr.chasms[i];
        ctx.fillRect(x0 + (r.x - b.left) * sx, y0 + (r.y - b.top) * sy, Math.max(1, r.w * sx), Math.max(1, r.h * sy));
      }
      ctx.fillStyle = 'rgba(180, 226, 255, 0.55)';
      for (let i = 0; i < tr.bridges.length; i++) {
        const r = tr.bridges[i];
        ctx.fillRect(x0 + (r.x - b.left) * sx, y0 + (r.y - b.top) * sy, Math.max(1, r.w * sx), Math.max(1, r.h * sy));
      }
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 1;
      for (let i = 0; i < tr.pads.length; i++) {
        ctx.beginPath();
        ctx.arc(x0 + (tr.pads[i].x - b.left) * sx, y0 + (tr.pads[i].y - b.top) * sy, 2.4, 0, TWO_PI);
        ctx.stroke();
      }
      for (let i = 0; i < tr.lifts.length; i++) {
        ctx.strokeRect(x0 + (tr.lifts[i].x - b.left) * sx - 2, y0 + (tr.lifts[i].y - b.top) * sy - 2, 4, 4);
      }
    }
    if (state.pipes) {
      for (let i = 0; i < state.pipes.length; i++) {
        const pipe = state.pipes[i];
        ctx.fillStyle = pipe.active ? arena.accent : 'rgba(125, 143, 148, 0.45)';
        ctx.fillRect(x0 + (pipe.x - b.left) * sx - 2, y0 + (pipe.y - b.top) * sy - 2, 4, 4);
      }
    }
    if (arena.firewallSwitch) {
      ctx.strokeStyle = (state.firewallSwitchT ?? 0) <= 0 ? '#ff6a4d' : 'rgba(140, 160, 165, 0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(
        x0 + (arena.firewallSwitch.x - b.left) * sx,
        y0 + (arena.firewallSwitch.y - b.top) * sy,
        2.8,
        0,
        TWO_PI,
      );
      ctx.stroke();
    }
    // Emitters are a fixed hazard, so the minimap marks live fixtures as red wall studs.
    // Read the world list, not the arena data: a match carries no fixtures.
    if (state.emitters) {
      ctx.fillStyle = '#ff5a4c';
      for (let i = 0; i < state.emitters.length; i++) {
        const e = state.emitters[i];
        ctx.fillRect(x0 + (e.x - b.left) * sx - 1.5, y0 + (e.y - b.top) * sy - 1.5, 3, 3);
      }
    }
    if (state.firewalls) {
      ctx.strokeStyle = THREAT_COLORS.firewall;
      ctx.lineWidth = 2;
      for (let i = 0; i < state.firewalls.length; i++) {
        const f = state.firewalls[i];
        if (!f.active) continue;
        ctx.beginPath();
        if (f.axis === 0) {
          const mx = x0 + (f.pos - b.left) * sx;
          ctx.moveTo(mx, y0);
          ctx.lineTo(mx, y0 + h);
        } else {
          const my = y0 + (f.pos - b.top) * sy;
          ctx.moveTo(x0, my);
          ctx.lineTo(x0 + w, my);
        }
        ctx.stroke();
      }
    }
    if (state.worms) {
      ctx.fillStyle = THREAT_COLORS.worm;
      for (let i = 0; i < state.worms.length; i++) {
        const e = state.worms[i];
        if (e.active) ctx.fillRect(x0 + (e.x - b.left) * sx - 2, y0 + (e.y - b.top) * sy - 2, 4, 4);
      }
    }
    if (state.viruses) {
      ctx.fillStyle = THREAT_COLORS.virus;
      for (let i = 0; i < state.viruses.length; i++) {
        const e = state.viruses[i];
        if (e.active) ctx.fillRect(x0 + (e.x - b.left) * sx - 1.4, y0 + (e.y - b.top) * sy - 1.4, 2.8, 2.8);
      }
    }
    if (state.sentries) {
      for (let i = 0; i < state.sentries.length; i++) {
        const e = state.sentries[i];
        if (!e.active) continue;
        const mx = x0 + (e.x - b.left) * sx;
        const my = y0 + (e.y - b.top) * sy;
        // Calibration subjects keep their primary shape on the map, so the arena
        // preview and the minimap agree about what is in the room.
        if (e.kind === 4) {
          ctx.fillStyle = THREAT_COLORS.shapeCircle;
          ctx.beginPath();
          ctx.arc(mx, my, 2.8, 0, TWO_PI);
          ctx.fill();
        } else if (e.kind === 5 || e.kind === 7) {
          ctx.fillStyle = THREAT_COLORS.shapeTriangle;
          const rr = e.kind === 7 ? 1.4 : 2.9;
          ctx.beginPath();
          ctx.moveTo(mx, my - rr);
          ctx.lineTo(mx + rr, my + rr * 0.8);
          ctx.lineTo(mx - rr, my + rr * 0.8);
          ctx.closePath();
          ctx.fill();
        } else if (e.kind === 6 || e.kind === 8) {
          ctx.fillStyle = THREAT_COLORS.shapeRect;
          const rr = e.kind === 8 ? 2 : 3.6;
          ctx.fillRect(mx - rr * 0.5, my - rr * 0.5, rr, rr);
        } else {
          ctx.fillStyle = THREAT_COLORS.sentry;
          ctx.fillRect(mx - 2, my - 2, 4, 4);
        }
      }
    }
    if (state.errors) {
      ctx.fillStyle = THREAT_COLORS.error;
      for (let i = 0; i < state.errors.length; i++) {
        const e = state.errors[i];
        if (e.active) ctx.fillRect(x0 + (e.x - b.left) * sx - 1.7, y0 + (e.y - b.top) * sy - 1.7, 3.4, 3.4);
      }
    }
    if (state.drone && state.drone.active) {
      ctx.strokeStyle = particleColor(P_COLOR_ICE);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x0 + (state.drone.x - b.left) * sx, y0 + (state.drone.y - b.top) * sy, 2.8, 0, TWO_PI);
      ctx.stroke();
    }
    if (state.pickups) {
      for (let i = 0; i < state.pickups.length; i++) {
        const pk = state.pickups[i];
        if (!pk.active) continue;
        const def = POWERUPS[pk.kind];
        if (!def) continue;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(x0 + (pk.x - b.left) * sx, y0 + (pk.y - b.top) * sy, 2.2, 0, TWO_PI);
        ctx.fill();
      }
    }
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active || !p.alive) continue;
      const local = (localMask & (1 << i)) !== 0;
      const px = x0 + (p.x - b.left) * sx;
      const py = y0 + (p.y - b.top) * sy;
      ctx.fillStyle = playerColor(state, p);
      ctx.beginPath();
      ctx.arc(px, py, local ? 3.4 : 2.4, 0, TWO_PI);
      ctx.fill();
      if (local) {
        ctx.globalAlpha = 0.65 + 0.25 * Math.sin(t * 5);
        ctx.strokeStyle = playerColor(state, p);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(p.facing) * 8, py + Math.sin(p.facing) * 8);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  /**
   * INFECTION readout: a top-centred clear bar with the percentage and the run clock.
   * It is the one labelled meter in the game, because the whole mode is a race against
   * that number. The bottom edge stays free for the ordinary threat strip.
   */
  private drawInfectionHud(state: RenderState, t: number): void {
    const ctx = this.ctx;
    const progress = Math.max(0, Math.min(1, state.infectionProgress ?? 0));
    const seconds = Math.max(0, state.gauntletTime ?? 0);
    const whole = Math.floor(seconds);
    const clock = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${Math.floor(
      (seconds - whole) * 10,
    )}`;
    const pct = progress >= 1 ? 100 : Math.floor(progress * 100);
    const w = 300;
    const x = (VIEW_W - w) * 0.5;
    const y = 34;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(190, 226, 240, 0.62)';
    ctx.fillText('VIRUS CLEARED', VIEW_W * 0.5, y - 12);

    ctx.fillStyle = 'rgba(120, 170, 190, 0.16)';
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = THREAT_COLORS.virus;
    ctx.fillRect(x, y, w * progress, 5);
    if (progress > 0 && progress < 1) {
      // A breathing cap marks the leading edge; the bar is the only moving read at speed.
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + w * progress - 1, y - 1, 2, 7);
      ctx.globalAlpha = 1;
    }

    ctx.font = FONT_MID;
    ctx.fillStyle = progress >= 1 ? '#b8ffe0' : 'rgba(240, 250, 255, 0.94)';
    ctx.fillText(`${pct}%`, VIEW_W * 0.5, y + 20);
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(190, 226, 240, 0.55)';
    ctx.fillText(`TIME ${clock}`, VIEW_W * 0.5, y + 34);
    ctx.restore();
  }

  /** Quick boss title card, drawn above the arena HUD during the frozen entrance. */
  private drawBossIntroTitle(state: RenderState): void {
    const intro = state.bossIntro;
    if (!intro) return;
    const ctx = this.ctx;
    const fadeIn = Math.min(1, intro.t / 0.25);
    const fadeOut = Math.min(1, (intro.duration - intro.t) / 0.35);
    const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha * 0.68;
    ctx.fillStyle = 'rgba(3, 7, 12, 1)';
    ctx.fillRect(VIEW_W * 0.5 - 190, VIEW_H * 0.24 - 20, 380, 58);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = FONT_MID;
    ctx.fillStyle = '#ffd6e8';
    ctx.fillText(intro.label, VIEW_W * 0.5, VIEW_H * 0.24);
    ctx.font = FONT_TINY;
    ctx.fillStyle = 'rgba(255, 190, 220, 0.78)';
    ctx.fillText('SUB-AGENT // INBOUND', VIEW_W * 0.5, VIEW_H * 0.24 + 20);
    ctx.restore();
  }

  private drawHud(state: RenderState, t: number): void {
    const ctx = this.ctx;
    const players = state.players;
    if (state.infectionMode) this.drawInfectionHud(state, t);

    // The arena itself carries the identity. Text only appears for a script beat or
    // a wave change, which is transient information between fights.
    const campaignBanner = state.campaign === true && (state.campaignBannerT ?? 0) > 0;
    if (campaignBanner) {
      const bannerT = state.campaignBannerT ?? 0;
      const duration = Math.max(0.01, state.campaignBannerDur ?? 3);
      const fadeIn = Math.min(1, (duration - bannerT) / 0.3);
      const fadeOut = Math.min(1, bannerT / 0.6);
      const kind = state.campaignBannerKind ?? 0;
      const localColor = playerColor(state, state.players[state.localSlot]);
      const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
      ctx.save();
      // A soft plate keeps the beat legible when it lands over bright cover.
      ctx.globalAlpha = alpha * 0.62;
      ctx.fillStyle = 'rgba(3, 7, 12, 1)';
      ctx.fillRect(VIEW_W * 0.5 - 150, VIEW_H * 0.34 - 13, 300, 42);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = FONT_MID;
      if (kind === 1) {
        ctx.fillStyle = THREAT_COLORS.firewall;
        ctx.fillText('SYSTEM BREACH', VIEW_W * 0.5, VIEW_H * 0.34);
        ctx.font = FONT_TINY;
        ctx.fillStyle = 'rgba(255, 160, 110, 0.8)';
        ctx.fillText('HOSTILES INBOUND', VIEW_W * 0.5, VIEW_H * 0.34 + 16);
      } else if (kind === 2) {
        ctx.fillStyle = localColor;
        ctx.fillText('NODE CLEARED', VIEW_W * 0.5, VIEW_H * 0.34);
        ctx.font = FONT_TINY;
        ctx.fillStyle = 'rgba(190, 255, 200, 0.75)';
        ctx.fillText('ROUTE SECURED', VIEW_W * 0.5, VIEW_H * 0.34 + 16);
      } else if (kind === 3) {
        ctx.fillStyle = THREAT_COLORS.worm;
        ctx.fillText('SIGNAL LOST', VIEW_W * 0.5, VIEW_H * 0.34);
        ctx.font = FONT_TINY;
        ctx.fillStyle = 'rgba(255, 130, 140, 0.8)';
        ctx.fillText('RING BROKEN', VIEW_W * 0.5, VIEW_H * 0.34 + 16);
      } else if (kind === 4) {
        ctx.fillStyle = THREAT_COLORS.shapeCircle;
        ctx.fillText('CALIBRATION', VIEW_W * 0.5, VIEW_H * 0.34);
        ctx.font = FONT_TINY;
        ctx.fillStyle = 'rgba(190, 224, 255, 0.75)';
        ctx.fillText('SUBJECTS // DORMANT', VIEW_W * 0.5, VIEW_H * 0.34 + 16);
      } else if (kind === 5) {
        ctx.fillStyle = THREAT_COLORS.shapeTriangle;
        ctx.fillText('SUBJECTS AWAKE', VIEW_W * 0.5, VIEW_H * 0.34);
        ctx.font = FONT_TINY;
        ctx.fillStyle = 'rgba(255, 190, 190, 0.78)';
        ctx.fillText('WAVE 01 // SKILL CHECK', VIEW_W * 0.5, VIEW_H * 0.34 + 16);
      } else if (kind === 8) {
        ctx.fillStyle = THREAT_COLORS.shapeTriangle;
        ctx.fillText('PRIMITIVES AWAKE', VIEW_W * 0.5, VIEW_H * 0.34);
        ctx.font = FONT_TINY;
        ctx.fillStyle = 'rgba(255, 190, 190, 0.82)';
        ctx.fillText('DESTROY ALL AWAKENED PRIMITIVES', VIEW_W * 0.5, VIEW_H * 0.34 + 16);
      } else if (kind === 7) {
        ctx.fillStyle = THREAT_COLORS.worm;
        ctx.fillText('SOMETHING BIG', VIEW_W * 0.5, VIEW_H * 0.34);
        ctx.font = FONT_TINY;
        ctx.fillStyle = 'rgba(255, 200, 150, 0.85)';
        ctx.fillText('MEGA WORM // INBOUND', VIEW_W * 0.5, VIEW_H * 0.34 + 16);
      } else if (kind === 6) {
        ctx.fillStyle = '#ffd27a';
        ctx.fillText('CELL BLOCK POWER FAILURE', VIEW_W * 0.5, VIEW_H * 0.34);
        ctx.font = FONT_TINY;
        ctx.fillStyle = 'rgba(255, 190, 120, 0.8)';
        ctx.fillText('WAVE 02 // CONTAINMENT RELEASED', VIEW_W * 0.5, VIEW_H * 0.34 + 16);
      } else {
        ctx.fillStyle = localColor;
        ctx.fillText('SPARRING DRILL', VIEW_W * 0.5, VIEW_H * 0.34);
        ctx.font = FONT_TINY;
        ctx.fillStyle = 'rgba(220, 250, 255, 0.7)';
        ctx.fillText('DRILL SQUAD // LIVE FIRE', VIEW_W * 0.5, VIEW_H * 0.34 + 16);
      }
      ctx.restore();
    }
    if (state.mode === 'gauntlet' && (state.waveBannerT ?? 0) > 0 && !campaignBanner) {
      const bannerT = state.waveBannerT ?? 0;
      const fadeIn = Math.min(1, (3 - bannerT) / 0.35);
      const fadeOut = Math.min(1, bannerT / 0.8);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = FONT_MID;
      ctx.fillStyle = THREAT_COLORS.firewall;
      ctx.fillText(
        `${state.campaign ? 'BREACH WAVE' : 'WAVE'} ${state.wave ?? 1}`,
        VIEW_W * 0.5,
        VIEW_H * 0.34,
      );
      ctx.font = FONT_TINY;
      ctx.fillStyle = 'rgba(255, 190, 120, 0.72)';
      ctx.fillText(
        state.campaign ? 'THREAT DENSITY RISING' : 'SYSTEM PRESSURE RISING',
        VIEW_W * 0.5,
        VIEW_H * 0.34 + 16,
      );
      ctx.restore();
    }

    // Campaign objective: one pip per ingress port when the arena authors them, so the
    // strip reads "sources closed" instead of a kill tally. A portless node keeps kills.
    if (state.campaign && state.campaignPhase === 'assault') {
      const ports = state.portTotal ?? 0;
      const target = ports > 0 ? ports : CAMPAIGN.killsToClear;
      const done =
        ports > 0
          ? Math.max(0, Math.min(target, state.portsClosed ?? 0))
          : Math.max(0, Math.min(target, state.gauntletKills ?? 0));
      const pw = ports > 0 ? 9 : 5;
      const gap = 4;
      const total = target * pw + (target - 1) * gap;
      const startX = (VIEW_W - total) * 0.5;
      const y = VIEW_H - 16;
      for (let i = 0; i < target; i++) {
        ctx.fillStyle = i < done ? THREAT_COLORS.firewall : 'rgba(120, 170, 190, 0.16)';
        ctx.fillRect(startX + i * (pw + gap), y, pw, ports > 0 ? 3 : 2);
      }
    }

    // Scores stay as silhouettes, with no labels, timer or corner readouts.
    if (state.mode === 'match') {
      let total = 0;
      for (let i = 0; i < players.length; i++) if (players[i].active) total += ROUND.winsNeeded * 6 - 2 + 8;
      let pipX = (VIEW_W - total + 8) * 0.5;
      const pipY = VIEW_H - 16;
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p.active) continue;
        for (let s = 0; s < ROUND.winsNeeded; s++) {
          ctx.fillStyle = s < p.score ? (state.online ? slotColor(p.slot) : programDef(p.program).color) : 'rgba(120, 170, 190, 0.14)';
          ctx.fillRect(pipX, pipY, 4, 2);
          pipX += 6;
        }
        pipX += 8;
      }
    } else if (state.mode === 'gauntlet') {
      if (state.infectionMode) return;
      // The gauntlet's possession meter is a thin warning strip, not a labelled meter.
      const infection = Math.max(0, Math.min(1, state.infection ?? 0));
      if (infection <= 0.001) return;
      const w = 214;
      const x = (VIEW_W - w) * 0.5;
      const y = VIEW_H - 18;
      ctx.fillStyle = 'rgba(120, 170, 190, 0.16)';
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = THREAT_COLORS.virus;
      ctx.fillRect(x, y, w * infection, 3);
      if (infection > 0.7) {
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 12);
        ctx.fillStyle = THREAT_COLORS.virus;
        ctx.fillRect(x, y - 4, w * infection, 2);
        ctx.globalAlpha = 1;
      }
    }
  }

}
