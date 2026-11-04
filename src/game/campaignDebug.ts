import { ACTION, EV, type GameEvent, type InputFrame } from './types';

/**
 * Local campaign QA capture.
 *
 * This is deliberately outside `World`: it observes the same state and events the
 * renderer already reads, never writes simulation state, and only starts when the
 * page is opened with `?campaignDebug=1`. A recording survives a reload in
 * localStorage. The Vite dev server also receives compact reports and periodic
 * screenshots through a local-only endpoint, written under `.tmp/campaign-debug/`;
 * nothing is sent to a remote service or through `Snapshot`.
 */

export const CAMPAIGN_DEBUG_STORAGE_KEY = 'deflect.campaignDebug.last';
export const CAMPAIGN_DEBUG_PREVIOUS_KEY = 'deflect.campaignDebug.prev';

const SAMPLE_CAMPAIGN_MS = 500;
const SAMPLE_MENU_MS = 1000;
const PERSIST_MS = 4000;
const SNAPSHOT_GAP_MS = 650;
const AUTO_SNAPSHOT_MS = 10_000;
const REMOTE_REPORT_MS = 5_000;
const CAPTURE_ENDPOINT = '/__defl/campaign-capture';
const VISUAL_GAP_MS = 500;
const MAX_SAMPLES = 2400;
const MAX_EVENTS = 4000;
const MAX_MILESTONES = 500;
const MAX_SNAPSHOTS = 12;
const MAX_ERRORS = 40;
const SNAPSHOT_WIDTH = 900;
const STORAGE_SOFT_LIMIT = 4_500_000;

const ACTION_NAMES: ReadonlyArray<readonly [number, string]> = [
  [ACTION.SWING, 'melee'],
  [ACTION.BOLT, 'ranged'],
  [ACTION.CANDLE, 'skill/heavy'],
  [ACTION.DASH, 'dash'],
  [ACTION.LOCK, 'lock'],
  [ACTION.LOCK_NEXT, 'lock-next'],
  [ACTION.LOCK_PREV, 'lock-prev'],
];

const EVENT_NAMES = new Map<number, string>();
for (const [name, kind] of Object.entries(EV)) EVENT_NAMES.set(kind as number, name);

const SETTING_KEYS = [
  'deflect.flash',
  'deflect.hitRotation',
  'deflect.scanlines',
  'deflect.minimap',
  'deflect.ui',
  'deflect.rumble',
  'deflect.autoLock',
  'deflect.autoAttack',
  'deflect.friendlyFire',
  'deflect.botTier.training',
  'deflect.players',
  'deflect.bots',
] as const;

export interface CampaignDebugTutorial {
  speaker: string;
  line: string;
  prompt: string;
  stepId: string;
  index: number;
  total: number;
  warn: boolean;
  done: boolean;
}

export interface CampaignDebugPlayer {
  slot: number;
  program: string;
  x: number;
  y: number;
  facing: number;
  hp: number;
  maxHp: number;
  energy: number;
  alive: boolean;
  active: boolean;
  travelT: number;
  dashCharges: number;
  score: number;
}

export interface CampaignDebugCounts {
  players: number;
  bots: number;
  projectiles: number;
  worms: number;
  viruses: number;
  sentries: number;
  errors: number;
  firewalls: number;
  props: number;
  pickups: number;
  fragments: number;
  barriers: number;
}

export interface CampaignDebugCampaign {
  slot: number;
  level: number;
  name: string;
  node: string;
  phase: string;
  playSeconds: number;
  saved: boolean;
  kills: number;
  killsToClear: number;
  exitReady: boolean;
  portalT: number;
  portalOpen: boolean;
  calibrationAwake: boolean;
  barsOpen: boolean;
  civiliansLost: boolean;
  dataKept: number;
  dataTotal: number;
  damage: number;
  wave: number;
  bannerKind: number;
  bannerT: number;
}

export interface CampaignDebugInput {
  mx: number;
  my: number;
  held: number;
  pressed: number;
  heldActions: string[];
  pressedActions: string[];
}

export interface CampaignDebugView {
  screen: string;
  mode: string;
  menuStage: string;
  overlay: string;
  loading: boolean;
  campaignLevel: number;
  campaignLevelName: string;
  campaignNode: string;
  campaignPhase: string;
  phase: string;
  arenaId: number;
  arenaName: string;
  program: string;
  tutorial: CampaignDebugTutorial | null;
  player: CampaignDebugPlayer | null;
  counts: CampaignDebugCounts;
  campaign: CampaignDebugCampaign | null;
}

export interface CampaignDebugVisual {
  width: number;
  height: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  colors: number;
  white: boolean;
  black: boolean;
  flat: boolean;
}

export interface CampaignDebugSample {
  t: number;
  screen: string;
  mode: string;
  menuStage: string;
  overlay: string;
  loading: boolean;
  level: number;
  levelName: string;
  campaignPhase: string;
  phase: string;
  arena: string;
  player: CampaignDebugPlayer | null;
  counts: CampaignDebugCounts;
  tutorial: CampaignDebugTutorial | null;
  campaign: CampaignDebugCampaign | null;
  input: CampaignDebugInput;
  fps: number;
  frameMs: number;
  simMs: number;
  visual: CampaignDebugVisual | null;
}

export interface CampaignDebugEvent {
  t: number;
  kind: number;
  name: string;
  slot: number;
  x: number;
  y: number;
  power: number;
  dirX: number;
  dirY: number;
  remote: boolean;
}

export interface CampaignDebugMilestone {
  t: number;
  reason: string;
  detail: string | null;
  level: number;
  phase: string;
  campaignPhase: string;
  tutorial: string | null;
  hp: number | null;
}

export interface CampaignDebugSnapshot {
  t: number;
  reason: string;
  width: number;
  height: number;
  dataUrl: string;
}

export interface CampaignDebugError {
  t: number;
  type: string;
  message: string;
  stack: string;
  source: string;
  line: number;
  column: number;
}

export interface CampaignDebugPerformance {
  samples: number;
  avgFps: number;
  minFps: number;
  avgFrameMs: number;
  maxFrameMs: number;
  avgSimMs: number;
  maxSimMs: number;
}

export interface CampaignDebugSource {
  url: string;
  userAgent: string;
  viewportW: number;
  viewportH: number;
  dpr: number;
  canvasW: number;
  canvasH: number;
  screenW: number;
  screenH: number;
  hardwareConcurrency: number | null;
  language: string;
  platform: string;
  touch: boolean;
  reducedMotion: boolean;
  visibility: string;
}

export interface CampaignDebugReport {
  schema: 1;
  kind: 'campaign-debug';
  build: string;
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  exportedAt: string | null;
  complete: boolean;
  source: CampaignDebugSource;
  settings: Record<string, string | null>;
  final: CampaignDebugView | null;
  summary: {
    samples: number;
    events: number;
    milestones: number;
    snapshots: number;
    errors: number;
    visualAlerts: number;
    perf: CampaignDebugPerformance;
  };
  samples: CampaignDebugSample[];
  events: CampaignDebugEvent[];
  milestones: CampaignDebugMilestone[];
  snapshots: CampaignDebugSnapshot[];
  errors: CampaignDebugError[];
}

export interface CampaignDebugApi {
  report: () => CampaignDebugReport;
  download: () => void;
  snapshot: (reason?: string) => void;
  mark: (reason: string, detail?: string) => void;
  stop: () => void;
  storageKey: string;
  previousKey: string;
}

interface LastState {
  screen: string;
  mode: string;
  level: number;
  campaignPhase: string;
  tutorial: string;
  overlay: string;
  alive: boolean;
  exitReady: boolean;
  calibrationAwake: boolean;
  barsOpen: boolean;
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function namesFor(bits: number): string[] {
  const names: string[] = [];
  for (let i = 0; i < ACTION_NAMES.length; i++) {
    const [bit, name] = ACTION_NAMES[i];
    if ((bits & bit) !== 0) names.push(name);
  }
  return names;
}

function inputState(frame: InputFrame): CampaignDebugInput {
  return {
    mx: round(frame.mx, 3),
    my: round(frame.my, 3),
    held: frame.held,
    pressed: frame.pressed,
    heldActions: namesFor(frame.held),
    pressedActions: namesFor(frame.pressed),
  };
}

function errorText(value: unknown): string {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readSettings(): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (let i = 0; i < SETTING_KEYS.length; i++) {
    const key = SETTING_KEYS[i];
    try {
      result[key] = localStorage.getItem(key);
    } catch {
      result[key] = null;
    }
  }
  return result;
}

/**
 * The recorder observes campaign state at 2 Hz, keeps a small before/after frame
 * ring, and persists a compact report even if the tab crashes. F8 takes a snapshot;
 * F9 downloads the complete JSON. Capture is intentionally silent: there is no HUD
 * over the arena, so a playtest sees the game itself.
 */
export class CampaignDebugRecorder {
  private readonly startedAtMs = performance.now();
  private readonly startedAt = new Date().toISOString();
  private readonly sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  private readonly samples: CampaignDebugSample[] = [];
  private readonly events: CampaignDebugEvent[] = [];
  private readonly milestones: CampaignDebugMilestone[] = [];
  private readonly snapshots: CampaignDebugSnapshot[] = [];
  private readonly errors: CampaignDebugError[] = [];
  private readonly source: CampaignDebugSource;
  private lastView: CampaignDebugView | null = null;
  private lastVisual: CampaignDebugVisual | null = null;
  private lastState: LastState | null = null;
  private lastSampleAt = 0;
  private lastPersistAt = 0;
  private lastVisualAt = 0;
  private lastSnapshotAt = 0;
  private lastAutoSnapshotAt = 0;
  private lastRemoteAt = 0;
  private remoteBusy = false;
  private remoteForcePending = false;
  private lastAlertAt = 0;
  private visualAlerts = 0;
  private perfSamples = 0;
  private fpsTotal = 0;
  private minFps = Infinity;
  private frameTotal = 0;
  private maxFrameMs = 0;
  private simTotal = 0;
  private maxSimMs = 0;
  private installed = false;
  private endedAt: string | null = null;
  private hud: HTMLDivElement | null = null;
  private hudClock: HTMLSpanElement | null = null;
  private hudState: HTMLDivElement | null = null;
  private hudDetail: HTMLDivElement | null = null;
  private captureCanvas: HTMLCanvasElement | null = null;
  private visualCanvas: HTMLCanvasElement | null = null;
  private readonly originalConsoleError = console.error.bind(console);

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly build: string,
    private readonly readView: () => CampaignDebugView,
  ) {
    this.source = this.readSource();
  }

  start(): void {
    if (this.installed) return;
    this.installed = true;
    try {
      const previous = localStorage.getItem(CAMPAIGN_DEBUG_STORAGE_KEY);
      if (previous) localStorage.setItem(CAMPAIGN_DEBUG_PREVIOUS_KEY, previous);
    } catch {
      // Storage can be unavailable; the in-memory report still works.
    }
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onUnhandledRejection);
    this.canvas.addEventListener('contextlost', this.onContextLost as EventListener);
    console.error = this.onConsoleError;
    // A previous hot reload could leave the old debug panel in the document. Capture
    // is silent now, so remove it rather than letting stale DOM cover the game.
    document.getElementById('campaign-debug')?.remove();
    this.hud = null;
    this.hudClock = null;
    this.hudState = null;
    this.hudDetail = null;
    (window as unknown as { __campaignDebug?: unknown }).__campaignDebug = this.api();
    this.mark('recording-start', `Build ${this.build} // campaign QA capture`);
    this.persist(true);
  }

  stop(): void {
    if (this.endedAt) return;
    this.endedAt = new Date().toISOString();
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('error', this.onWindowError);
    window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
    this.canvas.removeEventListener('contextlost', this.onContextLost as EventListener);
    if (console.error === this.onConsoleError) console.error = this.originalConsoleError;
    this.mark('recording-stop');
    this.persist(true);
    this.syncRemote(true);
  }

  tick(frame: InputFrame, fps: number, frameMs: number, simMs: number): void {
    const view = this.readView();
    this.lastView = view;
    const campaignLive = view.screen === 'game' && view.mode === 'campaign' && !view.loading;
    if (campaignLive) {
      this.perfSamples++;
      this.fpsTotal += Number.isFinite(fps) ? fps : 0;
      this.minFps = Math.min(this.minFps, Number.isFinite(fps) ? fps : 0);
      this.frameTotal += Number.isFinite(frameMs) ? frameMs : 0;
      this.maxFrameMs = Math.max(this.maxFrameMs, Number.isFinite(frameMs) ? frameMs : 0);
      this.simTotal += Number.isFinite(simMs) ? simMs : 0;
      this.maxSimMs = Math.max(this.maxSimMs, Number.isFinite(simMs) ? simMs : 0);
    }

    const now = performance.now();
    if (campaignLive && now - this.lastAutoSnapshotAt >= AUTO_SNAPSHOT_MS) {
      this.lastAutoSnapshotAt = now;
      this.snapshot('auto', true);
    }
    const interval = campaignLive ? SAMPLE_CAMPAIGN_MS : SAMPLE_MENU_MS;
    if (now - this.lastSampleAt >= interval) {
      this.lastSampleAt = now;
      this.detectTransitions(view);
      const visual = campaignLive ? this.readVisual() : null;
      this.lastVisual = visual;
      this.samples.push(this.makeSample(view, frame, fps, frameMs, simMs, visual));
      if (this.samples.length > MAX_SAMPLES) this.samples.shift();
      if (campaignLive && visual) this.checkVisual(visual);
      this.updateHud(view);
      this.persist();
    }
    if (campaignLive) this.syncRemote();
  }

  event(event: GameEvent, remote: boolean): void {
    const view = this.lastView;
    if (!view || view.mode !== 'campaign') return;
    const name = EVENT_NAMES.get(event.kind) ?? String(event.kind);
    this.events.push({
      t: round(this.elapsed()),
      kind: event.kind,
      name,
      slot: event.slot,
      x: round(event.x, 1),
      y: round(event.y, 1),
      power: round(event.power, 2),
      dirX: round(event.dirX, 3),
      dirY: round(event.dirY, 3),
      remote,
    });
    if (this.events.length > MAX_EVENTS) this.events.shift();
    if (event.kind === EV.HIT || event.kind === EV.EXPLODE || event.kind === EV.ELIMINATED || event.kind === EV.MEGA_CRY) {
      this.snapshot(`event:${name}`, false);
    }
    // Enemy eliminations use slot -1 (and other players use their own slot); only the
    // local player's elimination belongs under a player-death label.
    const localSlot = this.lastView?.player?.slot ?? -1;
    if (event.kind === EV.ELIMINATED && event.slot >= 0 && event.slot === localSlot) {
      this.mark('player-eliminated', `kind=${name} slot=${event.slot} power=${event.power}`);
    }
  }

  mark(reason: string, detail = ''): void {
    const view = this.lastView;
    this.milestones.push({
      t: round(this.elapsed()),
      reason,
      detail: detail ? detail.slice(0, 500) : null,
      level: view?.campaignLevel ?? 0,
      phase: view?.phase ?? '',
      campaignPhase: view?.campaignPhase ?? '',
      tutorial: view?.tutorial?.stepId ?? null,
      hp: view?.player ? round(view.player.hp, 2) : null,
    });
    if (this.milestones.length > MAX_MILESTONES) this.milestones.shift();
    this.updateHud(view);
    this.persist();
    if (reason === 'campaign-end' || reason === 'recording-stop') this.syncRemote(true);
  }

  snapshot(reason = 'manual', force = true): void {
    const now = performance.now();
    if (!force && now - this.lastSnapshotAt < SNAPSHOT_GAP_MS) return;
    this.lastSnapshotAt = now;
    try {
      const width = this.canvas.width;
      const height = this.canvas.height;
      if (width < 8 || height < 8) return;
      if (!this.captureCanvas) this.captureCanvas = document.createElement('canvas');
      const target = this.captureCanvas;
      const scale = Math.min(1, SNAPSHOT_WIDTH / width);
      target.width = Math.max(1, Math.round(width * scale));
      target.height = Math.max(1, Math.round(height * scale));
      const ctx = target.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(this.canvas, 0, 0, target.width, target.height);
      const dataUrl = target.toDataURL('image/jpeg', 0.62);
      if (!dataUrl.startsWith('data:image/')) return;
      const shot: CampaignDebugSnapshot = {
        t: round(this.elapsed()),
        reason,
        width: target.width,
        height: target.height,
        dataUrl,
      };
      this.snapshots.push(shot);
      if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.shift();
      if (this.lastView?.mode === 'campaign') this.uploadScreenshot(shot);
      this.persist();
    } catch {
      // A lost or tainted canvas must not break the run.
    }
  }

  private uploadScreenshot(shot: CampaignDebugSnapshot): void {
    if (!import.meta.env.DEV) return;
    void fetch(CAPTURE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'screenshot', sessionId: this.sessionId, snapshot: shot }),
    }).catch(() => {
      // The capture sink is best-effort; play must never wait for it.
    });
  }

  private syncRemote(force = false): void {
    if (!import.meta.env.DEV) return;
    const now = performance.now();
    if (!force && now - this.lastRemoteAt < REMOTE_REPORT_MS) return;
    if (this.remoteBusy) {
      if (force) this.remoteForcePending = true;
      return;
    }
    this.lastRemoteAt = now;
    this.remoteBusy = true;
    const report = this.report(null);
    const snapshots = report.snapshots.map(({ dataUrl: _dataUrl, ...meta }) => meta);
    void fetch(CAPTURE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'report',
        sessionId: this.sessionId,
        report: { ...report, snapshots },
      }),
    })
      .catch(() => {
        // Keep the local localStorage copy; the dev sink may not be running.
      })
      .finally(() => {
        this.remoteBusy = false;
        if (this.remoteForcePending) {
          this.remoteForcePending = false;
          this.syncRemote(true);
        }
      });
  }

  download(): void {
    this.persist(true);
    this.syncRemote(true);
    const report = this.report(new Date().toISOString());
    const text = JSON.stringify(report, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `deflect-campaign-debug-${this.build}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.setHudStatus('LOG DOWNLOADED');
  }

  api(): CampaignDebugApi {
    return {
      report: () => this.report(null),
      download: () => this.download(),
      snapshot: (reason = 'manual') => this.snapshot(reason, true),
      mark: (reason, detail = '') => this.mark(reason, detail),
      stop: () => this.stop(),
      storageKey: CAMPAIGN_DEBUG_STORAGE_KEY,
      previousKey: CAMPAIGN_DEBUG_PREVIOUS_KEY,
    };
  }

  private readSource(): CampaignDebugSource {
    return {
      url: location.href,
      userAgent: navigator.userAgent,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      dpr: round(window.devicePixelRatio || 1, 2),
      canvasW: this.canvas.width,
      canvasH: this.canvas.height,
      screenW: window.screen?.width ?? 0,
      screenH: window.screen?.height ?? 0,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      language: navigator.language,
      platform: navigator.platform,
      touch: typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
      reducedMotion:
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      visibility: document.visibilityState,
    };
  }

  private elapsed(): number {
    return Math.max(0, (performance.now() - this.startedAtMs) / 1000);
  }

  private makeSample(
    view: CampaignDebugView,
    frame: InputFrame,
    fps: number,
    frameMs: number,
    simMs: number,
    visual: CampaignDebugVisual | null,
  ): CampaignDebugSample {
    return {
      t: round(this.elapsed()),
      screen: view.screen,
      mode: view.mode,
      menuStage: view.menuStage,
      overlay: view.overlay,
      loading: view.loading,
      level: view.campaignLevel,
      levelName: view.campaignLevelName,
      campaignPhase: view.campaignPhase,
      phase: view.phase,
      arena: view.arenaName,
      player: view.player,
      counts: view.counts,
      tutorial: view.tutorial,
      campaign: view.campaign,
      input: inputState(frame),
      fps: round(fps, 1),
      frameMs: round(frameMs, 2),
      simMs: round(simMs, 3),
      visual,
    };
  }

  private detectTransitions(view: CampaignDebugView): void {
    const tutorial = view.tutorial ? (view.tutorial.warn ? 'warn' : view.tutorial.stepId) : 'none';
    const current: LastState = {
      screen: view.screen,
      mode: view.mode,
      level: view.campaignLevel,
      campaignPhase: view.campaignPhase,
      tutorial,
      overlay: view.overlay,
      alive: view.player?.alive ?? false,
      exitReady: view.campaign?.exitReady ?? false,
      calibrationAwake: view.campaign?.calibrationAwake ?? false,
      barsOpen: view.campaign?.barsOpen ?? false,
    };
    const previous = this.lastState;
    this.lastState = current;
    if (!previous) {
      this.mark(view.mode === 'campaign' ? 'campaign-start' : 'session-start', `${view.screen} // ${view.mode}`);
      if (view.mode === 'campaign') this.snapshot('campaign-start');
      return;
    }
    if (previous.mode !== current.mode) {
      this.mark('mode', `${previous.mode} -> ${current.mode}`);
      if (current.mode === 'campaign') this.snapshot('campaign-start');
      if (previous.mode === 'campaign') this.mark('campaign-end');
    }
    if (previous.level !== current.level) {
      this.mark('level', `${previous.level} -> ${current.level} // ${view.campaignLevelName}`);
      this.snapshot('level-change');
    }
    if (previous.campaignPhase !== current.campaignPhase) {
      this.mark('campaign-phase', `${previous.campaignPhase} -> ${current.campaignPhase}`);
      this.snapshot(`phase:${current.campaignPhase}`);
    }
    if (previous.tutorial !== current.tutorial) {
      this.mark(
        'tutorial-step',
        view.tutorial ? `${view.tutorial.speaker}: ${view.tutorial.line}` : 'none',
      );
    }
    if (previous.overlay !== current.overlay) {
      this.mark('overlay', `${previous.overlay} -> ${current.overlay}`);
      if (current.overlay !== 'none') this.snapshot(`overlay:${current.overlay}`);
    }
    if (previous.alive && !current.alive) {
      this.mark('player-death');
      this.snapshot('player-death');
    }
    if (!previous.exitReady && current.exitReady) {
      this.mark('portal-open');
      this.snapshot('portal-open');
    }
    if (!previous.calibrationAwake && current.calibrationAwake) {
      this.mark('calibration-wake');
      this.snapshot('calibration-wake');
    }
    if (!previous.barsOpen && current.barsOpen) {
      this.mark('cells-open');
      this.snapshot('cells-open');
    }
  }

  private readVisual(): CampaignDebugVisual | null {
    if (this.canvas.width < 8 || this.canvas.height < 8) return null;
    if (!this.visualCanvas) {
      this.visualCanvas = document.createElement('canvas');
      this.visualCanvas.width = 32;
      this.visualCanvas.height = 18;
    }
    try {
      const ctx = this.visualCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.clearRect(0, 0, 32, 18);
      ctx.drawImage(this.canvas, 0, 0, 32, 18);
      const data = ctx.getImageData(0, 0, 32, 18).data;
      const colors = new Set<number>();
      let total = 0;
      let totalSq = 0;
      let min = 1;
      let max = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        const lum = (r + g + b) / 3;
        total += lum;
        totalSq += lum * lum;
        if (lum < min) min = lum;
        if (lum > max) max = lum;
        colors.add(((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4));
      }
      const mean = total / pixels;
      const variance = Math.max(0, totalSq / pixels - mean * mean);
      const std = Math.sqrt(variance);
      return {
        width: 32,
        height: 18,
        mean: round(mean, 4),
        std: round(std, 4),
        min: round(min, 4),
        max: round(max, 4),
        colors: colors.size,
        white: min > 0.9 && mean > 0.94,
        black: max < 0.03,
        flat: std < 0.008,
      };
    } catch {
      return null;
    }
  }

  private checkVisual(visual: CampaignDebugVisual): void {
    if (!visual.white && !visual.black && !visual.flat) return;
    const now = performance.now();
    if (now - this.lastAlertAt < 3500) return;
    this.lastAlertAt = now;
    this.visualAlerts++;
    const kind = visual.white ? 'white' : visual.black ? 'black' : 'flat';
    this.mark(
      `visual-${kind}`,
      `mean=${visual.mean} std=${visual.std} min=${visual.min} max=${visual.max} colors=${visual.colors}`,
    );
    this.snapshot(`visual-${kind}`);
  }

  private updateHud(view: CampaignDebugView | null): void {
    if (!this.hud || !view) return;
    if (this.hudClock) this.hudClock.textContent = `${formatClock(this.elapsed())} // ${this.errors.length} ERR`;
    if (!this.hudState || !this.hudDetail) return;
    if (view.screen === 'game' && view.mode === 'campaign') {
      const player = view.player;
      const counts = view.counts;
      this.hudState.textContent = `L${view.campaignLevel || '?'} ${view.campaignPhase || '—'} // ${
        view.overlay === 'none' ? 'LIVE' : view.overlay.toUpperCase()
      }`;
      const hp = player ? `HP ${round(player.hp, 1)}/${player.maxHp}` : 'HP --';
      const line = view.tutorial ? `${view.tutorial.speaker}: ${view.tutorial.line}` : 'NO STORY LINE';
      this.hudDetail.textContent = `${hp} // S${counts.sentries} W${counts.worms} V${counts.viruses} P${counts.projectiles}\n${line.slice(0, 110)}`;
    } else {
      this.hudState.textContent = `${view.screen.toUpperCase()} // ${view.mode.toUpperCase()}`;
      this.hudDetail.textContent = 'OPEN CAMPAIGN FROM THE MENU. AUTO CAPTURE // F8 SNAPSHOT / F9 LOG.';
    }
  }

  private setHudStatus(text: string): void {
    if (this.hudClock) this.hudClock.textContent = text;
  }

  private buildHud(): void {
    if (this.hud) return;
    const hud = document.createElement('div');
    hud.id = 'campaign-debug';
    hud.className = 'campaign-debug';
    hud.innerHTML = `
      <div class="campaign-debug-head">
        <span class="campaign-debug-dot" aria-hidden="true"></span>
        <span>CAMPAIGN DEBUG</span>
        <span class="campaign-debug-clock" data-cd="clock">00:00 // 0 ERR</span>
      </div>
      <div class="campaign-debug-state" data-cd="state">WAITING</div>        <div class="campaign-debug-detail" data-cd="detail">OPEN CAMPAIGN FROM THE MENU. AUTO CAPTURE // F8 SNAPSHOT / F9 LOG.</div>
      <div class="campaign-debug-actions">
        <button type="button" data-cd="snap">SNAP F8</button>
        <button type="button" data-cd="download">LOG F9</button>
        <button type="button" data-cd="hide">HIDE</button>
      </div>
    `;
    document.body.appendChild(hud);
    this.hud = hud;
    this.hudClock = hud.querySelector<HTMLSpanElement>('[data-cd="clock"]');
    this.hudState = hud.querySelector<HTMLDivElement>('[data-cd="state"]');
    this.hudDetail = hud.querySelector<HTMLDivElement>('[data-cd="detail"]');
    hud.querySelector<HTMLButtonElement>('[data-cd="snap"]')?.addEventListener('click', () =>
      this.snapshot('manual-button', true),
    );
    hud.querySelector<HTMLButtonElement>('[data-cd="download"]')?.addEventListener('click', () => this.download());
    const hide = hud.querySelector<HTMLButtonElement>('[data-cd="hide"]');
    hide?.addEventListener('click', () => {
      hud.classList.toggle('campaign-debug-collapsed');
      hide.textContent = hud.classList.contains('campaign-debug-collapsed') ? 'SHOW' : 'HIDE';
    });
  }

  private onKey = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.key === 'F8') {
      event.preventDefault();
      this.snapshot('manual-f8', true);
    } else if (event.key === 'F9') {
      event.preventDefault();
      this.download();
    }
  };

  private onWindowError = (event: ErrorEvent): void => {
    const error = event.error as Error | undefined;
    this.addError(
      'window',
      event.message || 'window error',
      error?.stack ?? '',
      event.filename,
      event.lineno,
      event.colno,
    );
  };

  private onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    this.addError('unhandled-rejection', errorText(event.reason), '', '', 0, 0);
  };

  private onContextLost = (): void => {
    this.addError('canvas-context-lost', 'The canvas context was lost.');
  };

  private onConsoleError = (...args: unknown[]): void => {
    this.originalConsoleError(...args);
    this.addError('console', args.map((arg) => errorText(arg)).join(' '), '', '', 0, 0);
  };

  private addError(
    type: string,
    message: string,
    stack = '',
    source = '',
    line = 0,
    column = 0,
  ): void {
    this.errors.push({
      t: round(this.elapsed()),
      type,
      message: message.slice(0, 2000),
      stack: stack.slice(0, 8000),
      source: source.slice(0, 500),
      line,
      column,
    });
    if (this.errors.length > MAX_ERRORS) this.errors.shift();
    this.mark(`error:${type}`, message.slice(0, 300));
    this.snapshot(`error:${type}`, true);
    this.persist(true);
  }

  private persist(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastPersistAt < PERSIST_MS) return;
    this.lastPersistAt = now;
    try {
      localStorage.setItem(CAMPAIGN_DEBUG_STORAGE_KEY, this.serializeForStorage());
    } catch {
      try {
        this.snapshots.splice(0, Math.max(0, this.snapshots.length - 3));
        localStorage.setItem(CAMPAIGN_DEBUG_STORAGE_KEY, this.serializeForStorage());
      } catch {
        this.snapshots.length = 0;
        try {
          localStorage.setItem(CAMPAIGN_DEBUG_STORAGE_KEY, this.serializeForStorage());
        } catch {
          // The in-memory report is still downloadable with F9.
        }
      }
    }
  }

  private serializeForStorage(): string {
    let json = JSON.stringify(this.report(null));
    if (json.length > STORAGE_SOFT_LIMIT) {
      this.snapshots.splice(0, Math.max(0, this.snapshots.length - 4));
      json = JSON.stringify(this.report(null));
    }
    if (json.length > STORAGE_SOFT_LIMIT) {
      this.samples.splice(0, Math.max(0, this.samples.length - 1200));
      json = JSON.stringify(this.report(null));
    }
    return json;
  }

  private performance(): CampaignDebugPerformance {
    if (this.perfSamples === 0) {
      return {
        samples: 0,
        avgFps: 0,
        minFps: 0,
        avgFrameMs: 0,
        maxFrameMs: 0,
        avgSimMs: 0,
        maxSimMs: 0,
      };
    }
    return {
      samples: this.perfSamples,
      avgFps: round(this.fpsTotal / this.perfSamples, 1),
      minFps: round(this.minFps, 1),
      avgFrameMs: round(this.frameTotal / this.perfSamples, 2),
      maxFrameMs: round(this.maxFrameMs, 2),
      avgSimMs: round(this.simTotal / this.perfSamples, 3),
      maxSimMs: round(this.maxSimMs, 3),
    };
  }

  report(exportedAt: string | null): CampaignDebugReport {
    return {
      schema: 1,
      kind: 'campaign-debug',
      build: this.build,
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      exportedAt,
      complete: this.endedAt !== null,
      source: {
        ...this.source,
        url: location.href,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        dpr: round(window.devicePixelRatio || 1, 2),
        canvasW: this.canvas.width,
        canvasH: this.canvas.height,
        visibility: document.visibilityState,
      },
      settings: readSettings(),
      final: this.lastView,
      summary: {
        samples: this.samples.length,
        events: this.events.length,
        milestones: this.milestones.length,
        snapshots: this.snapshots.length,
        errors: this.errors.length,
        visualAlerts: this.visualAlerts,
        perf: this.performance(),
      },
      samples: this.samples.map((sample) => ({ ...sample })),
      events: this.events.map((event) => ({ ...event })),
      milestones: this.milestones.map((milestone) => ({ ...milestone })),
      snapshots: this.snapshots.map((snapshot) => ({ ...snapshot })),
      errors: this.errors.map((error) => ({ ...error })),
    };
  }
}
