import { ATOMIZE, BOLT, BUFFER, BUG, CAMERA, CAMERA_ZOOM, CAMPAIGN, EMITTER, FILE_PROP, GHOST, KABOOM, MINE, CASCADING_ERROR, COLORS, FIREWALL, FISHER, MAX_PLAYERS, PLAYER, POWERUP, ROUND, SENTRY, SWEEP, TRAIL_LEN, TRAVEL, TRAVERSE, VIEW_H, VIEW_W, VIRUS, WEDGE, WORM } from './config';
import type { ArenaDef } from './arenas';
import { Fx } from './fx';
import { ATOM_BALL_COLOR, ATOM_BOLT_COLORS, drawGhostEye, drawGlyph, drawHourglassMark, drawProgramMark, drawSymbol, pathProgramFrame, pathProgramHealth, PROP_GLYPHS, PROGRAM_COLORS, slotColor, slotGlyph, symbolFont, THREAT_COLORS } from './identity';
import { P_COLOR_DANGER, P_COLOR_DUST, P_COLOR_ICE, P_COLOR_TOXIN, particleColor } from './particles';
import { POWERUPS, POWERUP_KIND } from './powerups';
import { PROGRAM_ID, programDef } from './programs';
import { SRC, type Barrier, type CampaignPhase, type CascadingError, type Drone, type Firewall, type GameMode, type LaserEmitter, type Lure, type Net, type Phase, type Pickup, type Player, type Projectile, type Prop, type Sentry, type Virus, type Worm } from './types';
import { CameraDirector, type CameraRig } from './camera';
import { beamReach } from './collision';

export interface RenderState {
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
  /** Local Fisher webs, lure beacons and Wedge walls. Match snapshots never carry these. */
  nets?: readonly Net[];
  lures?: readonly Lure[];
  barriers?: readonly Barrier[];
  infection?: number;
  gauntletKills?: number;
  wave?: number;
  waveBannerT?: number;
  gauntletOver?: boolean;
  gauntletTime?: number;
  /** Campaign script running on the gauntlet simulation. */
  campaign?: boolean;
  campaignPhase?: CampaignPhase;
  campaignBannerT?: number;
  campaignBannerDur?: number;
  /** 0 drill, 1 breach/inbound, 2 cleared, 3 failed. */
  campaignBannerKind?: number;
  /** Breakable file boxes. Local content; guests never receive these. */
  props?: readonly Prop[];
  /** Floor compactor: warning timer, the arm's leading edge, and the stop flash. */
  pusherWarnT?: number;
  pusherFlashT?: number;
  pusherY?: number;
  pusherActive?: boolean;
  /** Bad Lag's time dilation, in seconds of real time left, and who cast it. */
  timeSlowT?: number;
  timeSlowOwner?: number;
}

const FONT_TINY = '700 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_SMALL = '700 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_MID = '700 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

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
  private introT = INTRO_LEN;
  private introActive = false;
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

  /** Console-to-arena load. Ground, cover, skeletons and rigs reveal in stages. */
  beginIntro(): void {
    this.introT = 0;
    this.introActive = true;
    this.director.clear();
    this.lastWave = -1;
    this.lastCampaignKind = -1;
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
    if (this.introActive) {
      this.introT += dt;
      if (this.introT >= INTRO_LEN) this.introActive = false;
    }
    const intro = this.introActive ? this.introT : INTRO_LEN;
    const introDone = intro >= INTRO_LEN;
    this.layoutViews(state);
    this.updateCameraCues(state);
    this.director.update(dt);

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

      this.drawArena(t, state.arena, intro);
      if (introDone) {
        if (state.props) this.drawProps(state.props);
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
        if (state.nets) this.drawNets(state, alpha, t);
        if (state.barriers) this.drawBarriers(state.barriers, t);
        if (state.lures) this.drawLures(state.lures, t);
        this.drawGas(state, alpha, t);
        this.drawLasers(state, alpha, t);
        if (state.drone) this.drawDrone(state.drone, alpha, t);
      }
      this.drawPlayers(state, alpha, t, intro, view.localMask);
      if (introDone) {
        this.drawJumpScares(state, t);
        for (let s = 0; s < state.players.length; s++) {
          if ((view.localMask & (1 << s)) === 0) continue;
          this.drawTravelProgress(state, s);
          this.drawLockReticle(state, s, t);
        }
        fx.particles.draw(ctx);
      }
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
        ctx.save();
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

    if (fx.flash > 0.002) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.5, fx.flash * 0.55 * fx.flashScale);
      ctx.fillStyle = fx.flashColor;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.restore();
    }

    if (introDone && this.showUi) this.drawHud(state, t);
    // One readiness dock per local player at a screen corner, and one shared minimap.
    // The minimap sits top-center when there is more than one local, so it belongs to
    // the whole screen rather than to one pane.
    if (introDone && this.showUi) {
      this.drawReadinessDocks(state);
      if (this.showMinimap && !this.touchLayout) this.drawMinimap(state, t, this.localMask, this.localCount > 1);
    }
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

    // Never clip a group that fits. `layoutViews` already checked the fit at minimum
    // zoom; this is the exact cap for the box the camera is actually framing.
    if (leadAlive) {
      const pad = CAMERA.groupPad * 2;
      const boxW = Math.max(1, groupMaxX - groupMinX) + pad;
      const boxH = Math.max(1, groupMaxY - groupMinY) + pad;
      const fitZoom = Math.min(view.w / boxW, view.h / boxH);
      // A single shared view may pull back past combat zoom to keep the group together;
      // a split pane only needs the normal floor because the layout already sized it.
      const floor = zoomBase * (this.viewCount > 1 ? CAMERA.zoomMin : CAMERA.sharedZoomMin);
      if (fitZoom < zoomTarget) zoomTarget = Math.max(floor, fitZoom);
    }

    let targetX: number;
    let targetY: number;
    const viewW = view.w / zoomTarget;
    const viewH = view.h / zoomTarget;
    const spanX = b.right - b.left;
    const spanY = b.bottom - b.top;
    // On an open arena the frame may sit past the lip, so the drop is visible before
    // anyone steps on it. Walled arenas keep the old hard clamp.
    const outerPad = arena.walls === 'open' ? CAMERA.voidMargin : 0;
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
      if (!b.active) continue;
      const fall = b.dropT > 0 ? (b.dropT / FILE_PROP.dropT) * (b.dropT / FILE_PROP.dropT) * FILE_PROP.dropRise : 0;
      const shake = b.hitFlash > 0 ? (b.hitFlash / FILE_PROP.hitFlash) * 2 : 0;
      const x = b.x + (shake > 0 ? Math.sin(b.hitFlash * 140) * shake : 0);
      const y = b.y - fall;
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
      ctx.fillStyle = 'rgba(255, 194, 77, 0.13)';
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + 0.5, y + 0.5, b.w - 1, b.h - 1, 6);
      ctx.strokeStyle = b.hitFlash > 0 ? '#fff4d4' : 'rgba(255, 194, 77, 0.8)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 231, 178, 0.92)';
      drawSymbol(ctx, PROP_GLYPHS[b.kind] ?? PROP_GLYPHS[1], x + b.w * 0.5, y + b.h * 0.5, 11);
      if (b.hp < FILE_PROP.hp) this.drawCracks(x + 1, y + 1, b.w - 2, b.h - 2, 1, 'rgba(4, 7, 11, 0.9)', i * 7 + b.kind);
      ctx.restore();
    }
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

  private drawArena(t: number, arena: ArenaDef, intro = INTRO_LEN): void {
    const ctx = this.ctx;
    const b = arena.bounds;
    this.ensureFloorPattern(arena);
    // Each layer compiles in on its own beat. Cover drops a few units into place,
    // so the arena reads as assembled rather than simply faded up.
    const groundA = intro >= INTRO_LEN ? 1 : Math.max(0, Math.min(1, intro / 0.9));
    const frameA = intro >= INTRO_LEN ? 1 : Math.max(0, Math.min(1, (intro - 0.7) / 0.75));
    const pillarA = intro >= INTRO_LEN ? 1 : Math.max(0, Math.min(1, (intro - 1.15) / 0.8));
    const pillarDrop = (1 - pillarA) * 30;
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

    // Border. An open arena has no wall, so the lip is dashed and the grid outside it is
    // swallowed by the void. Corner brackets are dropped: nothing here stops a body.
    const openLip = arena.walls === 'open';
    ctx.save();
    ctx.strokeStyle = arena.accent;
    if (openLip) {
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

  private drawWorms(worms: readonly Worm[], alpha: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < worms.length; i++) {
      const w = worms[i];
      if (!w.active) continue;
      const base = w.infected ? THREAT_COLORS.virus : THREAT_COLORS.worm;
      const build = w.spawnT > 0 ? 1 - w.spawnT / WORM.spawnTime : 1;
      const builtSegments = 1 + Math.floor(build * w.segCount);

      for (let s = w.segCount - 1; s >= 0; s--) {
        if (s >= builtSegments) continue;
        const x = lerp(w.segPrevX[s], w.segX[s], alpha);
        const y = lerp(w.segPrevY[s], w.segY[s], alpha);
        const size = 10.5 - s * 0.22;
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
          ctx.arc(hx, hy, WORM.headRadius + 14 + k * 4, a, a + 0.5);
          ctx.stroke();
        }
      }
      ctx.translate(hx, hy);
      ctx.rotate(w.angle + Math.PI * 0.25);
      ctx.scale(0.45 + 0.55 * build, 0.45 + 0.55 * build);
      const r = WORM.headRadius;
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

    }
    ctx.globalAlpha = 1;
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
      if (!v.active) continue;
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
      const color = s.kind === 2 ? THREAT_COLORS.homing : s.kind === 3 ? THREAT_COLORS.flock : THREAT_COLORS.sentry;
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

      if (s.kind === 0) {
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
    }
    ctx.globalAlpha = 1;
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

  /** Charged heavy beam. The drawn line stops exactly where cover stops the damage. */
  private drawLasers(state: RenderState, alpha: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'butt';
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active || !p.alive) continue;
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
        // Wedge and Fisher have their own wind-up silhouettes; only Probe draws the
        // orbiting-dot beam charge. A live overcharge beam still renders.
        if (p.program !== PROGRAM_ID.PROBE && p.laserT <= 0) continue;
        const x = lerp(p.prevX, p.x, alpha);
        const y = lerp(p.prevY, p.y, alpha);
        const charge = Math.min(1, p.laserChargeT / PLAYER.laserChargeTime);
        const color = playerColor(state, p);
        const ring = PLAYER.radius + 15 + charge * 4;
        const facing = p.laserFacing;
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
        // A charge and a live beam can overlap: overcharge fires while the heavy is
        // winding up. Fall through to the beam instead of skipping it for the whole
        // charge, which is what hid the overcharge beam in the attract demo.
        if (p.laserT <= 0) continue;
      }
      if (p.laserT <= 0) continue;
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
      if (p.type === 6 || p.type === 7 || p.type === 8 || p.type === 9 || p.type === 10 || p.type === 12) continue;
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
      const count = p.type === 11 ? Math.min(p.trailCount, 14) : p.type >= 3 ? Math.min(p.trailCount, 5) : p.trailCount;
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
      if (p.type === 5) {
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
        const blink = p.fuse < 0.55 ? 0.4 + 0.6 * Math.abs(Math.sin(t * 24)) : 0.8;
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

        // Core plus countdown arc. Arming runs a tight ring; live mines show time left.
        ctx.fillStyle = arming ? color : '#ffffff';
        ctx.globalAlpha = arming ? 0.55 + 0.4 * Math.abs(Math.sin(t * 22)) : 0.95;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, TWO_PI);
        ctx.fill();
        const fusePct = Math.max(0, Math.min(1, p.fuse / MINE.life));
        ctx.strokeStyle = arming ? '#dff7ff' : '#ff7a3c';
        ctx.globalAlpha = arming ? 0.5 : 0.9;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 5, -Math.PI / 2, -Math.PI / 2 + TWO_PI * fusePct);
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

      // Held guard: a tight 180 degree screen right against the body. It is the safe,
      // readable option; the tap swing stays the offensive one.
      if (p.guardT > 0) {
        const edge = facing - PLAYER.guardHalfAngle;
        const end = facing + PLAYER.guardHalfAngle;
        const guardFade = Math.min(1, p.guardT / 0.08);
        const radius = PLAYER.guardReach - 12;
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.1 * guardFade;
        ctx.beginPath();
        ctx.arc(x, y, radius, edge, end);
        ctx.arc(x, y, PLAYER.radius + 4, end, edge, true);
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
        const left = Math.max(0, Math.min(1, p.guardT / PLAYER.guardDuration));
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
      } else if (p.swingPhase !== 0) {
        const half = PLAYER.swingHalfAngle;
        const dir = p.swingDir < 0 ? -1 : 1;
        const pct = Math.max(0, Math.min(1, p.swingPct));
        const whip = p.powerupT > 0 && p.powerupKind === POWERUP_KIND.WHIP;
        const reach = PLAYER.swingReach * (whip ? POWERUP.whipMultiplier : 1);
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
        pathProgramFrame(ctx, p.program, x, y, PLAYER.radius, hullSpin);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // Lost segments remain as ghosts at a readable alpha, so the program silhouette
        // never breaks apart. Too faint and the hull reads as a gap instead of damage.
        if (freshSegments < maxSegments) {
          ctx.globalAlpha = 0.42;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.6;
          pathProgramHealth(ctx, p.program, x, y, PLAYER.radius, hullSpin, maxSegments, maxSegments);
          ctx.stroke();
          ctx.strokeStyle = p.hitFlash > 0 ? '#ffffff' : color;
        }
        pathProgramHealth(ctx, p.program, x, y, PLAYER.radius, hullSpin, freshSegments, maxSegments);
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

        // Small heading arrow outside the outline. Local only: it is the player's own
        // facing cue, not a marker on every body.
        if (isLocal) {
          const nx = Math.cos(facing);
          const ny = Math.sin(facing);
          const tip = PLAYER.radius + 8;
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
      const coreR = PLAYER.radius * (0.3 + 0.28 * coreHp) * (1 + 0.035 * Math.sin(t * 4 + p.slot));
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
        drawGlyph(ctx, slotGlyph(p.slot), 0, 0, PLAYER.radius * 0.51);
      } else {
        const glyph = programDef(p.program);
        drawProgramMark(ctx, p.program, glyph.glyph, glyph.symbolFont, 0, 0, PLAYER.radius * (glyph.glyphRadius ?? 0.51), glyph.coreScale);
      }
      ctx.restore();

      // Atomize's shield charges: three blue balls sharing one orbit. They persist
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
    const dashPct = p.dashCharges >= PLAYER.dashCharges ? 1 : 1 - Math.min(1, p.dashCd / PLAYER.dashCooldown);
    for (let c = 0; c < PLAYER.dashCharges; c++) {
      const off = (c - (PLAYER.dashCharges - 1) * 0.5) * 12;
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
    if (p.dashCharges < PLAYER.dashCharges) this.drawReadinessMask(dashX, cy, dashPct, '#dff7ff');

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
        p.program === PROGRAM_ID.GHOST) &&
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
    if (arena.walls === 'open') {
      // A broken inner rim on the map: the edge is a drop, not a wall.
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x0 + 5.5, y0 + 5.5, w - 11, h - 11);
      ctx.setLineDash([]);
    } else {
      ctx.strokeRect(x0 + 5.5, y0 + 5.5, w - 11, h - 11);
    }
    ctx.globalAlpha = 1;
    // Holes are the darkest thing on the map: a floor opening, not cover.
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
      ctx.fillStyle = THREAT_COLORS.sentry;
      for (let i = 0; i < state.sentries.length; i++) {
        const e = state.sentries[i];
        if (e.active) ctx.fillRect(x0 + (e.x - b.left) * sx - 2, y0 + (e.y - b.top) * sy - 2, 4, 4);
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

  private drawHud(state: RenderState, t: number): void {
    const ctx = this.ctx;
    const players = state.players;

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

    // Campaign objective: one pip per threat delete, no label.
    if (state.campaign && state.campaignPhase === 'assault') {
      const target = CAMPAIGN.killsToClear;
      const kills = Math.max(0, Math.min(target, state.gauntletKills ?? 0));
      const pw = 5;
      const gap = 4;
      const total = target * pw + (target - 1) * gap;
      const startX = (VIEW_W - total) * 0.5;
      const y = VIEW_H - 16;
      for (let i = 0; i < target; i++) {
        ctx.fillStyle = i < kills ? THREAT_COLORS.firewall : 'rgba(120, 170, 190, 0.16)';
        ctx.fillRect(startX + i * (pw + gap), y, pw, 2);
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
      // Infection is a thin warning strip, not a labelled meter.
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
