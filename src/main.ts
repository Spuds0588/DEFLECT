import { MINIBOSS, MINIBOSSES } from './game/minibosses';
import { ATTRACT, AUTO_ATTACK, CAMERA, CAMPAIGN, HAPTICS, MAX_PLAYERS, NET, ROUND, SIM_DT } from './game/config';
import { FIRST_CAMPAIGN_LEVEL, PLAYABLE_CAMPAIGN_LEVELS } from './game/campaign';
import { ARENAS, drawArenaPreview, getArena, type ArenaDef } from './game/arenas';
import { LocalSeats, type LocalSeat } from './game/localplay';
import { BOT_NAMES, BOT_TIERS, BOT_TIER_LABELS, BotBrain, type BotTier } from './game/bot';
import { AudioEngine } from './game/audio';
import { Fx } from './game/fx';
import {
  formatGauntletTime,
  loadGauntletRuns,
  recordGauntletRun,
  saveGauntletRuns,
  type GauntletRun,
} from './game/gauntletRecords';
import { Haptics, type RumbleCue } from './game/haptics';
import {
  bestForArena,
  fastestBest,
  formatInfectionTime,
  loadInfectionBests,
  recordInfectionClear,
  saveInfectionBests,
  type InfectionBest,
} from './game/infectionRecords';
import { Input, type MenuEdges } from './game/input';
import { Renderer, type RenderState } from './game/render';
import { PROGRAM_ID, PROGRAMS, clampProgram, programDef } from './game/programs';
import { STORY_SLOT_COUNT, clearStorySlot, loadStorySlots, saveStoryProgress, type StorySave } from './game/saves';
import { drawCampaignRoad } from './game/road';
import {
  SERIES_LENGTHS,
  normalizeSeriesGames,
  normalizeSeriesMapRule,
  pickSeriesArena,
  seriesWinner,
  type SeriesMapRule,
} from './game/series';
import { SECTORS } from './game/sectors';
import { ACTION, EV, type GameEvent, type InputFrame, type LobbyPlayer, type LobbyState, type Phase } from './game/types';
import {
  SessionTracker,
  emptyDeflect,
  sessionShareText,
  type SessionEnvironment,
  type SessionOutcome,
  type SessionPlayerSeed,
  type SessionReport,
  type SessionResult,
} from './game/sessionReport';
import { CampaignDebugRecorder, type CampaignDebugView } from './game/campaignDebug';
import { World } from './game/world';
import { GuestNet, HostNet, NetView, type Snapshot } from './net/net';
import { clearChildren, drawAvatar, el, toast } from './ui/dom';
import { TouchControls } from './ui/touch';
import { drawProgramMark, drawSymbol, pathProgramFrame, pathProgramHealth, randomCallsign, sanitizeName, slotColor } from './game/identity';

type Screen = 'title' | 'lobby' | 'game' | 'settings' | 'howto';
type SettingsTab = 'feedback' | 'controls' | 'audio' | 'system';
type Mode = 'none' | 'training' | 'host' | 'guest' | 'bots' | 'local' | 'gauntlet' | 'campaign';
type OverlayKind = 'none' | 'round' | 'match' | 'leave' | 'runover';

/** Build stamp shared by the boot log and exported playtest logs. */
const BUILD = '0.1.198';
const PLAYTEST_ROUNDS_PER_MAP = 3;
const PLAYTEST_STORAGE_KEY = 'deflect.playtest.last';

interface PlaytestDeflectLog {
  guard: number;
  swing: number;
  beam: number;
  atom: number;
  net: number;
  arm: number;
  plow: number;
  broom: number;
  wave: number;
}

interface PlaytestPlayerLog {
  slot: number;
  name: string;
  program: string;
  hp: number;
  maxHp: number;
  score: number;
  shots: number;
  dashes: number;
  swings: number;
  deflects: number;
  skills: number;
  heavies: number;
  hits: number;
  damage: number;
  kills: number;
  deaths: number;
}

interface PlaytestRoundLog {
  arenaId: number;
  arenaName: string;
  round: number;
  duration: number;
  winner: number;
  winnerName: string;
  matchWinner: number;
  players: PlaytestPlayerLog[];
  deflect: PlaytestDeflectLog;
  fps: number;
  simMs: number;
}

interface PlaytestMapLog {
  arenaId: number;
  arenaName: string;
  rounds: PlaytestRoundLog[];
}

interface PlaytestSummary {
  rounds: number;
  seconds: number;
  wins: number;
  losses: number;
  draws: number;
  shots: number;
  swings: number;
  deflects: number;
  skills: number;
  heavies: number;
  damage: number;
  kills: number;
  deaths: number;
  avgFps: number;
}

interface PlaytestSessionLog {
  schema: number;
  build: string;
  startedAt: string;
  finishedAt: string | null;
  complete: boolean;
  mode: string;
  program: string;
  botCount: number;
  botTier: string;
  roundsPerMap: number;
  maps: PlaytestMapLog[];
  summary: PlaytestSummary;
}

interface PlaytestRoundDraft {
  log: PlaytestRoundLog;
  deflectBase: PlaytestDeflectLog;
}

const canvas = el<HTMLCanvasElement>('arena');
const titleScreen = el('screen-title');
const demoTitle = el('demo-title');
const settingsScreen = el('screen-settings');
const howtoScreen = el('screen-howto');
const howtoDeviceTitle = el('howto-device-title');
const howtoDeviceName = el('howto-device-name');
const howtoControlsPad = el('howto-controls-pad');
const howtoControlsKeys = el('howto-controls-keys');
const howtoControlsTouch = el('howto-controls-touch');
const howtoTouchNote = el('howto-touch-note');
const howtoPrograms = el('howto-programs');
const settingsMuteBtn = el<HTMLButtonElement>('btn-settings-mute');
const lobbyScreen = el('screen-lobby');
const gameUi = el('game-ui');
const overlay = el('overlay');
const overlayKicker = el('overlay-kicker');
const overlayTitle = el<HTMLHeadingElement>('overlay-title');
const overlaySub = el('overlay-sub');
const overlayActions = el('overlay-actions');
const tutorialEl = el('tutorial');
const tutorialMark = el('tutorial-mark');
const tutorialSpeaker = el('tutorial-speaker');
const tutorialStep = el('tutorial-step');
const tutorialLine = el('tutorial-line');
const tutorialPrompt = el('tutorial-prompt');
const tutorialSkipBtn = el<HTMLButtonElement>('tutorial-skip');
const countdownEl = el('countdown');

// Between-level route plate. It is a DOM layer, not a World entity, so the cleared
// simulation can sit frozen behind it and no resume state has to be invented.
const campaignRoadEl = document.createElement('div');
campaignRoadEl.className = 'campaign-road';
campaignRoadEl.hidden = true;
campaignRoadEl.innerHTML = `
  <div class="campaign-road-card">
    <p class="campaign-road-kicker">SCRIPT KITTY // ROUTE UPDATED</p>
    <h2 class="campaign-road-title">NETWORK BACKBONE</h2>
    <canvas class="campaign-road-canvas" width="960" height="340"></canvas>
    <p class="campaign-road-next"></p>
    <button class="campaign-road-continue" type="button">CONTINUE ROUTE</button>
  </div>`;
document.body.appendChild(campaignRoadEl);
const campaignRoadCanvas = campaignRoadEl.querySelector<HTMLCanvasElement>('.campaign-road-canvas')!;
const campaignRoadTitle = campaignRoadEl.querySelector<HTMLElement>('.campaign-road-title')!;
const campaignRoadNextLine = campaignRoadEl.querySelector<HTMLElement>('.campaign-road-next')!;
const campaignRoadContinueBtn = campaignRoadEl.querySelector<HTMLButtonElement>('.campaign-road-continue')!;
let campaignRoadAction: (() => void) | null = null;
let campaignRoadTimer = 0;
const countdownLabel = el('countdown-label');
const countdownValue = el<HTMLElement>('countdown-value');
const perfEl = el('perf');
const mpStatusEl = el('mp-status');
const mpRoleEl = el('mp-role');
const mpCodeEl = el('mp-code');
const mpPlayersEl = el('mp-players');
const mpRttEl = el('mp-rtt');
const mpSnapEl = el('mp-snap');
const mpDetailEl = el('mp-detail');
const settingsBtn = el<HTMLButtonElement>('btn-settings');
const howtoBtn = el<HTMLButtonElement>('btn-howto');
const howtoBackBtn = el<HTMLButtonElement>('btn-howto-back');
const callsignInput = el<HTMLInputElement>('callsign');
const roomCodeInput = el<HTMLInputElement>('room-code');
const titleStatus = el('title-status');
const trainingBtn = el<HTMLButtonElement>('btn-training');
const soloBotsBtn = el<HTMLButtonElement>('btn-solo-bots');
const createBtn = el<HTMLButtonElement>('btn-create');
const joinBtn = el<HTMLButtonElement>('btn-join');
const lobbyCodeEl = el('lobby-code');
const lobbyUrlEl = el('lobby-url');
const lobbyPlayersEl = el<HTMLUListElement>('lobby-players');
const lobbyCount = el('lobby-count');
const lobbyRole = el('lobby-role');
const lobbyStatus = el('lobby-status');
const lobbyLinkEl = el('lobby-link');
const readyBtn = el<HTMLButtonElement>('btn-ready');
const startBtn = el<HTMLButtonElement>('btn-start');
const copyBtn = el<HTMLButtonElement>('btn-copy');
const arenaPicker = el('arena-picker');
const arenaStageLabel = el('arena-stage-label');
const menuGauntlet = el('menu-gauntlet');
const gauntletStageLabel = el('gauntlet-stage-label');
const gauntletStartBtn = el<HTMLButtonElement>('btn-gauntlet-start');
const gauntletRecordsEl = el<HTMLOListElement>('gauntlet-records');
const gauntletBestValue = el('gauntlet-best');
const gauntletFriendlyBtn = el<HTMLButtonElement>('btn-gauntlet-friendly-fire');
const gauntletFriendlyValue = el('gauntlet-friendly-fire-value');
const gauntletRushBtn = el<HTMLButtonElement>('btn-gauntlet-rush');
const gauntletRushValue = el('gauntlet-rush-value');
const botCountEl = el('bot-count');
const botTierEl = el('bot-tier');
const botStageLabel = el('bot-stage-label');
const tierStageLabel = el('tier-stage-label');
const gauntletBtn = el<HTMLButtonElement>('btn-gauntlet');
const infectionBtn = el<HTMLButtonElement>('btn-solo-infection');
const infectionBestValue = el('infection-best');
const lobbyArenaBtn = el<HTMLButtonElement>('btn-arena-cycle');
const lobbyModeBtn = el<HTMLButtonElement>('btn-mode-cycle');
const lobbySeriesBtn = el<HTMLButtonElement>('btn-series-cycle');
const lobbyMapRuleBtn = el<HTMLButtonElement>('btn-map-rule-cycle');
const hitRotationInput = el<HTMLInputElement>('hit-rotation');
const hitRotationValue = el('hit-rotation-value');
const settingsTabs = el('settings-tabs');
const flashInput = el<HTMLInputElement>('flash-strength');
const flashValue = el('flash-strength-value');
const volumeInput = el<HTMLInputElement>('volume');
const volumeValue = el('volume-value');
const musicVolumeInput = el<HTMLInputElement>('music-volume');
const musicVolumeValue = el('music-volume-value');
const sfxVolumeInput = el<HTMLInputElement>('sfx-volume');
const sfxVolumeValue = el('sfx-volume-value');
const menuVolumeInput = el<HTMLInputElement>('menu-volume');
const menuVolumeValue = el('menu-volume-value');
const scanlinesBtn = el<HTMLButtonElement>('btn-scanlines');
const minimapBtn = el<HTMLButtonElement>('btn-minimap');
const uiBtn = el<HTMLButtonElement>('btn-ui');
const rumbleBtn = el<HTMLButtonElement>('btn-rumble');
const autoLockBtn = el<HTMLButtonElement>('btn-auto-lock');
const autoAttackBtn = el<HTMLButtonElement>('btn-auto-attack');
const resetSettingsBtn = el<HTMLButtonElement>('btn-settings-reset');
const testFeedbackBtn = el<HTMLButtonElement>('btn-test-feedback');
const menuHub = el('menu-hub');
const menuSoloProgram = el('menu-solo-program');
const programPicker = el('program-picker');
const programStageLabel = el('program-stage-label');
const programBackBtn = el<HTMLButtonElement>('btn-program-back');
const menuSolo = el('menu-solo');
const menuStory = el('menu-story');
const storyStageLabel = el('story-stage-label');
const storySlotsEl = el('story-slots');
const storyStatusLine = el('story-status');
const storyBackBtn = el<HTMLButtonElement>('btn-story-back');
const storyNewBtn = el<HTMLButtonElement>('btn-story-new');
const storyNewValue = el('story-new-value');
const storyRulesEl = el('story-rules');
const menuStoryBots = el('menu-story-bots');
const storyBotsLabel = el('story-bots-label');
const storyBotsBackBtn = el<HTMLButtonElement>('btn-story-bots-back');
const menuArena = el('menu-arena');
const menuSoloBots = el('menu-solo-bots');
const menuSoloTier = el('menu-solo-tier');
const menuSoloSeries = el('menu-solo-series');
const seriesBackBtn = el<HTMLButtonElement>('btn-series-back');
const seriesStageLabel = el('series-stage-label');
const seriesMapsBtn = el<HTMLButtonElement>('btn-series-maps');
const seriesGamesEl = el('series-games');
const menuMulti = el('menu-multi');
const menuOnline = el('menu-online');
const menuLocal = el('menu-local');
const campaignBotsEl = el('campaign-bots');
const campaignFriendlyBtn = el<HTMLButtonElement>('btn-campaign-friendly-fire');
const campaignFriendlyValue = el('campaign-friendly-fire-value');
const campaignSkipTutorialBtn = el<HTMLButtonElement>('btn-campaign-skip-tutorial');
const campaignSkipTutorialValue = el('campaign-skip-tutorial-value');
const soloCampaignBtn = el<HTMLButtonElement>('btn-solo-campaign');

const modeSoloBtn = el<HTMLButtonElement>('btn-mode-solo');
const modeMultiBtn = el<HTMLButtonElement>('btn-mode-multi');
const multiOnlineBtn = el<HTMLButtonElement>('btn-multi-online');
const localBtn = el<HTMLButtonElement>('btn-local');
const onlineBackBtn = el<HTMLButtonElement>('btn-online-back');
const localBackBtn = el<HTMLButtonElement>('btn-local-back');
const localStartBtn = el<HTMLButtonElement>('btn-local-start');
const localSeatsEl = el('local-seats');
const localArenaPickerEl = el('local-arena-picker');
const localStatusLine = el('local-status');
const localRushBtn = el<HTMLButtonElement>('btn-local-rush');
const localRushValue = el('local-rush-value');
const soloBackBtn = el<HTMLButtonElement>('btn-solo-back');
const multiBackBtn = el<HTMLButtonElement>('btn-multi-back');
const bootScreen = el('boot');
const bootLog = el('boot-log');
const bootStatus = el('boot-status');

const renderer = new Renderer(canvas);
const input = new Input(canvas);
/** Couch seats and their per-slot frames. P1 is always keyboard + mouse. */
const localSeats = new LocalSeats();
const localFrames: (InputFrame | null)[] = new Array(MAX_PLAYERS).fill(null);
const lastLocalSeatHp = new Float32Array(MAX_PLAYERS).fill(-1);
let localSeatSignature = '';
localSeats.onJoin = handleLocalJoin;
const audio = new AudioEngine();
const fx = new Fx();
const haptics = new Haptics(() => input.activePad());

let screen: Screen = 'title';
let mode: Mode = 'none';
/** QA self-play: bots drive every slot in a bot match, including slot 0. */
let autoplay = false;
/** QA-only boot flag: `?mega=1` lands the Mega Worm immediately. */
let megaBoot = false;
/** QA-only boot flag: `?hands=1` lands the Idle Hands pair immediately. */
let handsBoot = false;
/** QA-only boot flag: `?starfish=1` lands the Starfish immediately. */
let starfishBoot = false;
/** QA-only boot flag: `?blob=1` lands the File Blob immediately. */
let blobBoot = false;
/** QA-only boot flag: `?storm=1` lands the Storm Cloud immediately. */
let stormBoot = false;
let autoplayRestartAt = 0;
/**
 * Title-screen attract demo. `attract` is true while the bot-run gauntlet owns the
 * screen; `attractStartedAt` lets the next real input end it without the idle timer
 * immediately re-arming. `lastUserInputAt` is the hub's idle clock.
 */
let attract = false;
let attractStartedAt = 0;
let attractRestartAt = 0;
/** Kiosk rotation: 1, 2, 3 local pilots, then back to 1. */
let attractSquadIndex = 0;
/**
 * Kiosk boss rotation: every other session is a boss showcase, cycling the registry.
 * `attractSessionIndex` counts sessions, `attractBossIndex` picks the boss, so the loop
 * reads as fight -> boss -> fight -> boss rather than dumping a boss into every run.
 */
let attractSessionIndex = 0;
let attractBossIndex = 0;
/** True while this attract session still owes its showcase boss. */
let attractBossAlive = false;
const ATTRACT_BOSSES = [
  MINIBOSS.MEGA_WORM,
  MINIBOSS.IDLE_HANDS,
  MINIBOSS.STARFISH,
  MINIBOSS.BLOB,
  MINIBOSS.STORM_CLOUD,
] as const;
let lastUserInputAt = performance.now();
/** `?demo=true`: the attract pilot runs forever and ignores every wake input. */
let demo = false;
/** `?boss=1`: boss-review loop. Every attract session is a boss, cycling the registry. */
let bossDemo = false;
/** Saved Settings > Feedback choice for the canvas UI; the demo overrides it. */
let uiEnabled = true;
/** Remaining seconds of the local layout-change slow motion. */
let slowMoT = 0;
let world: World | null = null;
let hostNet: HostNet | null = null;
let guestNet: GuestNet | null = null;
let guestView: NetView | null = null;
let lobbyState: LobbyState | null = null;
let localSlot = 0;
let busy = false;
let overlayKind: OverlayKind = 'none';
type MenuStage =
  | 'hub'
  | 'soloProgram'
  | 'solo'
  | 'soloArena'
  | 'soloBots'
  | 'soloTier'
  | 'soloSeries'
  | 'gauntlet'
  | 'story'
  | 'storyBots'
  | 'local'
  | 'multi'
  | 'online';
type SoloProgram = 'training' | 'bots' | 'gauntlet' | 'campaign' | 'infection';
let menuStage: MenuStage = 'hub';
let soloProgram: SoloProgram = 'training';
let selectedProgram: number = PROGRAM_ID.PROBE;
let settingsTab: SettingsTab = 'feedback';
let gauntletRecords: GauntletRun[] = [];
let gauntletRecorded = false;
/** BOSS RUSH: a gauntlet ladder with no fodder, solo or local co-op. */
let bossRush = false;
let localBossRush = false;
/** INFECTION runs on the gauntlet simulation; this flag swaps the setup, HUD and results. */
let infectionRun = false;
let infectionRecorded = false;
let infectionBests: InfectionBest[] = [];
/** Campaign drill squad size (0-3). A NO BOTS run still drills against one instructor. */
let campaignBots = 0;
/** Menu-owned skip for every lesson in a campaign run; persisted locally. */
let campaignSkipTutorials = false;
/** Index into the playable campaign levels for the live node. */
let campaignLevelIndex = 0;
/** Save-slot index being set up on the campaign stage; -1 when none is selected. */
let storySlot = -1;
type StoryPrompt =
  | { kind: 'clear-confirm'; slot: number }
  | { kind: 'overwrite-pick' }
  | { kind: 'overwrite-confirm'; slot: number };
/** A save-slot action waiting for a target or confirmation. Null is the normal list. */
let storyPrompt: StoryPrompt | null = null;
/** Save slot of the live campaign run, and the run state a clear needs to persist. */
let campaignSlot = -1;
let campaignPlayers = 1;
let campaignSaved = false;
let campaignPlaySeconds = 0;
let lastCampaignPhase = '';
/** Memory stacks earned in the live campaign run, carried between nodes. */
let campaignMemory: number[] = new Array(MAX_PLAYERS).fill(0);
/** Bot slots lost for the rest of this campaign run, bit 1 = slot 1. */
let campaignBotDead = 0;
/** Bot slots lost in the current arena; a TPK retry restores these. */
let campaignDeadHere = 0;
/** The fail overlay belongs to a full-party wipe, so its retry revives current losses. */
let campaignRetryRevives = false;
/** Uncollected shards held at the last save point, restored on the next node. */
let campaignShards: { x: number; y: number }[] = [];
/** Island-hop transition: one portal wipe covers the arena swap. */
let portalHopAction: (() => void) | null = null;
let portalHopAt = 0;
/** A campaign clear has already been scored and saved for this node. */
let campaignClearHandled = false;
/** Wall-clock time for the round-end hop; 0 when this round is not hopping. */
let roundHopAt = 0;

const touchControlsEl = el('touch-controls');
const touchStickEl = el('touch-stick');
const touchStickKnob = el('touch-stick-knob');
const touchMenuBtn = el<HTMLButtonElement>('touch-menu');
const touchControls = new TouchControls(touchControlsEl, touchStickEl, touchStickKnob);
/** `?touch=1` forces the phone layout; `?touch=0` suppresses it. */
const touchParam = new URLSearchParams(location.search).get('touch');
const coarsePointer =
  typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
const touchMode = touchParam === '1' || (touchParam !== '0' && coarsePointer);
/** Auto-assists default on for a phone and off for a keyboard/pad session. */
let autoLock = touchMode;
let autoAttack = touchMode;
let touchVisible = false;

const localFrame: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
let trainingInputs: (InputFrame | null)[] = [localFrame];
let stressInputs: InputFrame[] = [];
let botInputs: InputFrame[] = [];
let botBrains: (BotBrain | null)[] = [];
let arenaIndex = 0;
let seriesGames = 1;
let seriesMapRule: SeriesMapRule = 'random';
let seriesRun = false;
let seriesGame = 1;
let seriesWins = new Array(MAX_PLAYERS).fill(0);
let seriesResultRecorded = false;
let seriesLastArenaId = -1;
let guestSeriesTotal = 1;
let guestSeriesGame = 1;
let botCount = 3;
let botTier: BotTier = 'veteran';
/** Training and VS BOTS keep separate difficulty picks; gauntlet/campaign use the training slot. */
const botTierPrefs: Record<'training' | 'bots', BotTier> = { training: 'veteran', bots: 'veteran' };
/** Local gauntlet/campaign run rule: enemy shots can damage other threat families. */
let friendlyFire = true;
let stress = false;
let stressBots = 0;
let stressTick = 0;

let playtestActive = false;
let playtestComplete = false;
let playtestMaps: PlaytestMapLog[] = [];
let playtestRound: PlaytestRoundDraft | null = null;
let playtestMapIndex = 0;
let playtestRoundsOnMap = 0;
let playtestAdvanceAt = 0;
let playtestStartedAt = '';
let playtestFinishedAt: string | null = null;
let playtestProgramId: number = PROGRAM_ID.PROBE;
let playtestBotTier: BotTier = 'veteran';
let playtestBotCount = 3;
/** Normal-play session capture behind the opt-in SHARE FEEDBACK action. */
let sessionLog: SessionTracker | null = null;
let sessionPerfAt = 0;
/** Local-only campaign QA capture, enabled by `?campaignDebug=1`. */
let campaignDebug: CampaignDebugRecorder | null = null;

let acc = 0;
let snapTimer = 0;
let fxCursor = 0;
let netCursor = 0;
let lastFrame = performance.now();
let fps = 60;
let frameMs = 16.7;
let simMs = 0;
let lastPhase: Phase | '' = '';
let lastRound = -1;
let lastRoundWinner = -2;
let lastMatchWinner = -2;
let goUntil = 0;
let perfTimer = 0;
let mpStatusAt = 0;
let howtoDevicePollAt = 0;
let lastCountdownText = '';
let lastBounceSound = 0;
let lastThreatSound = 0;
let lastLocalHp = -1;
/** Last own beam event, so a held overcharge beam cues once instead of every tick. */
let lastLaserRumbleAt = -Infinity;
let loading = false;
let loadingUntil = 0;
let bootShownAt = 0;
let bootLeaving = false;

// Boot -------------------------------------------------------------------------------------

function boot(): void {
  const stored = loadName();
  callsignInput.value = stored;
  loadArenaPrefs();
  loadCampaignPrefs();
  loadSettings();
  updateMuteLabel();
  bindUi();
  gauntletRecords = loadGauntletRuns();
  updateGauntletBestLabel();
  infectionBests = loadInfectionBests();
  updateInfectionBestLabel();
  renderProgramPicker();
  renderArenaPicker();
  renderBotControls();
  renderGauntletSetup();
  renderHowToPrograms();
  showMenuStage('hub');
  parseInviteHash();
  refreshTitleButtons();
  registerServiceWorker();

  const params = new URLSearchParams(location.search);
  const campaignDebugParam =
    params.get('campaignDebug') === '1' || params.get('campaigndebug') === '1';
  // `?ui=0` hides the canvas UI for a clean capture without changing the saved setting.
  const uiParam = params.get('ui');
  if (uiParam === '0' || uiParam === 'off' || uiParam === 'false') applyUi(false, false);
  // `?demo=true` is the kiosk/showfloor boot: the attract pilot, permanently,
  // with every wake input ignored and the centered DEFLECT_ wordmark. It owns
  // the page and takes precedence over the other boot hooks.
  const demoParam = params.get('demo');
  const demoMode = demoParam === '1' || demoParam === 'true';
  // QA-only boss review: `?boss=1` is the kiosk loop with a boss in every session, so the
  // whole registry can be watched without sitting through the ordinary sessions between.
  bossDemo = params.get('boss') === '1';
  const attractParam = params.get('attract') === '1';
  const stressParam = Number(params.get('stress') ?? '0');
  const autoplayParam = Number(params.get('autoplay') ?? '0');
  const playtestParam = params.get('playtest');
  const playtestMode = playtestParam === '1' || playtestParam === 'true';
  // QA-only split-screen hook: `?split=2` (with `?autoplay=N`) renders N local panes.
  // Local same-screen play has no input slots yet, so this is the visual test bed.
  const splitParam = Math.floor(Number(params.get('split') ?? '0'));
  if (splitParam >= 2) {
    const slots: number[] = [];
    for (let i = 0; i < Math.min(4, splitParam); i++) slots.push(i);
    renderer.setLocalSlots(slots);
  }
  const arenaParam = Number(params.get('arena') ?? '-1');
  if (arenaParam >= 0 && arenaParam < ARENAS.length) arenaIndex = arenaParam;
  // QA-only empty sandbox: `?range=1` boots on the test range.
  const rangeParam = params.get('range') === '1';
  if (rangeParam) {
    const rangeIndex = ARENAS.findIndex((entry) => entry.qa);
    if (rangeIndex >= 0) arenaIndex = rangeIndex;
  }
  // QA-only gauntlet hook: `?gauntlet=1&arena=5&bot=1` boots straight into a run and
  // lets a BotBrain drive the local player so the camera can be watched hands-off.
  const gauntletParam = Number(params.get('gauntlet') ?? '0');
  // QA-only boss hook: `?mega=1` boots a gauntlet run with the Mega Worm already up.
  megaBoot = params.get('mega') === '1';
  handsBoot = params.get('hands') === '1';
  starfishBoot = params.get('starfish') === '1';
  blobBoot = params.get('blob') === '1';
  stormBoot = params.get('storm') === '1';
  bossRush = params.get('bossrush') === '1';
  const infectionParam = params.get('infection') === '1';
  const gauntletBot = Number(params.get('bot') ?? '0') >= 1;
  if (campaignDebugParam) {
    campaignDebug = new CampaignDebugRecorder(canvas, BUILD, campaignDebugView);
    campaignDebug.start();
  }
  // QA-only inspection handle. Nothing in normal play reads it; it keeps split and
  // grouping tests scriptable without a separate debug build.
  if (params.get('debug') === '1') {
    (window as unknown as { __defl?: unknown }).__defl = {
      renderer,
      world: () => world,
      brains: () => botBrains,
      inputs: () => botInputs,
      slowMo: () => slowMoT,
      attract: () => attract,
      demo: () => demo,
      touch: () => touchVisible,
      assist: () => ({ autoLock, autoAttack, touchMode }),
      frame: () => localFrame,
      playtestLog: () => buildPlaytestLog(),
      playtestState: () => ({
        active: playtestActive,
        complete: playtestComplete,
        mapIndex: playtestMapIndex,
        roundsOnMap: playtestRoundsOnMap,
        advanceAt: playtestAdvanceAt,
      }),
      localSeats: () => ({
        mode,
        slots: localSeats.slots(),
        seats: localSeats.seats.map((s) => ({
          slot: s.slot,
          pad: s.padIndex,
          name: s.name,
          padName: s.padName,
          connected: s.connected,
        })),
      }),
      audio,
    };
  }
  if (demoMode || bossDemo) {
    window.setTimeout(() => startDemo(), 250);
  } else if (attractParam) {
    window.setTimeout(() => startAttract(), 250);
  } else if (stressParam >= 2 && stressParam <= MAX_PLAYERS) {
    window.setTimeout(() => startStress(stressParam), 250);
  } else if (infectionParam) {
    window.setTimeout(() => startInfection(gauntletBot), 250);
  } else if (gauntletParam >= 1 || bossRush || megaBoot || handsBoot || starfishBoot || blobBoot || stormBoot || rangeParam) {
    window.setTimeout(() => startGauntlet(gauntletBot), 250);
  } else if (playtestMode) {
    window.setTimeout(startPlaytest, 250);
  } else if (autoplayParam >= 1) {
    window.setTimeout(() => startAutoplay(autoplayParam), 250);
  }

  requestAnimationFrame(loop);
  console.log(`[DEFLECT-INIT] Build ${BUILD} ready. Max players:`, MAX_PLAYERS);
}

function bindUi(): void {
  // Any real input feeds the attract idle clock and ends a running demo. Hover is
  // deliberately not a wake input: a layout change can fire a synthetic pointermove
  // under a resting cursor, and that must not cut an attract demo short.
  window.addEventListener('keydown', noteUserActivity);
  window.addEventListener('pointerdown', noteUserActivity, { passive: true });
  window.addEventListener('pointermove', noteIdleMovement, { passive: true });
  window.addEventListener('wheel', noteUserActivity, { passive: true });
  modeSoloBtn.addEventListener('click', () => showMenuStage('solo'));
  modeMultiBtn.addEventListener('click', () => showMenuStage('multi'));
  multiOnlineBtn.addEventListener('click', () => showMenuStage('online'));
  localBtn.addEventListener('click', () => showMenuStage('local'));
  onlineBackBtn.addEventListener('click', () => showMenuStage('multi'));
  localBackBtn.addEventListener('click', () => showMenuStage('multi'));
  localStartBtn.addEventListener('click', () => {
    if (localBossRush) startLocalBossRush();
    else startLocalMatch();
  });
  tutorialSkipBtn.addEventListener('click', () => world?.skipTutorial());
  campaignRoadContinueBtn.addEventListener('click', () => continueCampaignRoad());
  programBackBtn.addEventListener('click', () => programStageBack());
  soloBackBtn.addEventListener('click', () => showMenuStage('hub'));
  multiBackBtn.addEventListener('click', () => showMenuStage('hub'));
  trainingBtn.addEventListener('click', () => openProgramSelect('training'));
  soloBotsBtn.addEventListener('click', () => openProgramSelect('bots'));
  gauntletBtn.addEventListener('click', () => openProgramSelect('gauntlet'));
  infectionBtn.addEventListener('click', () => openProgramSelect('infection'));
  soloCampaignBtn.addEventListener('click', openStory);
  storyBackBtn.addEventListener('click', storyBack);
  storyNewBtn.addEventListener('click', startNewStory);
  storyBotsBackBtn.addEventListener('click', () => showMenuStage('story'));
  el<HTMLButtonElement>('btn-arena-back').addEventListener('click', () => showMenuStage('soloProgram'));
  el<HTMLButtonElement>('btn-gauntlet-back').addEventListener('click', () => showMenuStage('soloArena'));
  gauntletStartBtn.addEventListener('click', () => startGauntlet());
  seriesBackBtn.addEventListener('click', () => showMenuStage('soloTier'));
  seriesMapsBtn.addEventListener('click', toggleSeriesMapRule);
  lobbySeriesBtn.addEventListener('click', cycleLobbySeries);
  lobbyMapRuleBtn.addEventListener('click', cycleLobbyMapRule);
  gauntletFriendlyBtn.addEventListener('click', toggleFriendlyFire);
  gauntletRushBtn.addEventListener('click', toggleBossRush);
  localRushBtn.addEventListener('click', toggleLocalBossRush);
  campaignFriendlyBtn.addEventListener('click', toggleFriendlyFire);
  campaignSkipTutorialBtn.addEventListener('click', toggleCampaignSkipTutorials);
  el<HTMLButtonElement>('btn-bots-back').addEventListener('click', () => showMenuStage('soloArena'));
  el<HTMLButtonElement>('btn-tier-back').addEventListener('click', () => showMenuStage('soloBots'));
  createBtn.addEventListener('click', () => void createRoom());
  joinBtn.addEventListener('click', joinRoom);
  settingsMuteBtn.addEventListener('click', () => {
    toggleMute();
  });
  settingsBtn.addEventListener('click', openSettings);
  howtoBtn.addEventListener('click', openHowToPlay);
  howtoBackBtn.addEventListener('click', () => setScreen('title'));
  // The pointer only hovers. Selection stays with the keyboard or pad until the
  // player actually clicks, so a resting cursor never marks an option for them.
  document.addEventListener('pointerdown', clearMenuSelection);
  // Hover feedback waits for a real pointer move. A stage that appears under a
  // resting cursor must not look pre-selected.
  document.addEventListener('pointermove', markPointerLive, { passive: true });
  el<HTMLButtonElement>('btn-settings-back').addEventListener('click', () => setScreen('title'));
  settingsTabs.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const tab = target?.closest<HTMLButtonElement>('[data-settings-tab]');
    if (tab) showSettingsTab(tab.dataset.settingsTab as SettingsTab);
  });
  hitRotationInput.addEventListener('input', () => {
    applyHitRotation(Number(hitRotationInput.value) / 100, true);
  });
  flashInput.addEventListener('input', () => {
    applyFlash(Number(flashInput.value) / 100, true);
  });
  volumeInput.addEventListener('input', () => {
    applyVolume(Number(volumeInput.value) / 100, true);
  });
  musicVolumeInput.addEventListener('input', () => {
    applyMusicVolume(Number(musicVolumeInput.value) / 100, true);
  });
  sfxVolumeInput.addEventListener('input', () => {
    applySfxVolume(Number(sfxVolumeInput.value) / 100, true);
  });
  menuVolumeInput.addEventListener('input', () => {
    applyMenuVolume(Number(menuVolumeInput.value) / 100, true);
  });
  scanlinesBtn.addEventListener('click', () => {
    applyScanlines(scanlinesBtn.getAttribute('aria-pressed') !== 'true', true);
  });
  minimapBtn.addEventListener('click', () => {
    applyMinimap(minimapBtn.getAttribute('aria-pressed') !== 'true', true);
  });
  uiBtn.addEventListener('click', () => {
    applyUi(uiBtn.getAttribute('aria-pressed') !== 'true', true);
  });
  rumbleBtn.addEventListener('click', () => {
    applyRumble(rumbleBtn.getAttribute('aria-pressed') !== 'true', true);
  });
  autoLockBtn.addEventListener('click', () => {
    applyAutoLock(autoLockBtn.getAttribute('aria-pressed') !== 'true', true);
  });
  autoAttackBtn.addEventListener('click', () => {
    applyAutoAttack(autoAttackBtn.getAttribute('aria-pressed') !== 'true', true);
  });
  touchMenuBtn.addEventListener('click', () => {
    if (screen === 'game' && overlayKind === 'none') openLeave();
  });
  testFeedbackBtn.addEventListener('click', () => {
    audio.hit();
    fx.triggerHitRotation();
    fx.handle({ kind: EV.HIT, slot: 0, x: 640, y: 360, power: 0, dirX: 1, dirY: 0 });
    // Settings is outside `playRumble`'s in-game gate, so this is the one place a
    // controller can prove its actuator works without taking a hit.
    haptics.play('hit');
  });
  resetSettingsBtn.addEventListener('click', resetSettings);
  el<HTMLButtonElement>('btn-lobby-back').addEventListener('click', leaveLobby);
  readyBtn.addEventListener('click', toggleReady);
  startBtn.addEventListener('click', startHostMatch);
  copyBtn.addEventListener('click', () => void copyInvite());
  lobbyArenaBtn.addEventListener('click', cycleLobbyArena);
  lobbyModeBtn.addEventListener('click', cycleLobbyMode);
  el<HTMLButtonElement>('btn-lobby-back').setAttribute('data-nav', '');

  callsignInput.addEventListener('input', () => {
    callsignInput.value = callsignInput.value.toUpperCase().slice(0, 10);
  });
  callsignInput.addEventListener('blur', () => {
    callsignInput.value = getCallsign();
  });
  callsignInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      getCallsign();
      callsignInput.blur();
    }
  });

  roomCodeInput.addEventListener('input', () => {
    roomCodeInput.value = normalizeCode(roomCodeInput.value);
    refreshTitleButtons();
  });
  roomCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      joinRoom();
    }
  });

  window.addEventListener('keydown', onUiKey);
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button')) {
      audio.unlock();
      audio.ui();
    }
  });
  window.addEventListener('resize', () => {
    renderer.resize();
  });
}

function unlockAudio(): void {
  audio.unlock();
  if (screen === 'game') {
    if (audio.musicWanted) audio.startMusic();
  } else {
    audio.startMenuMusic();
  }
}

// Boot transition ----------------------------------------------------------------------------

function beginLoadSequence(arenaName: string): void {
  const now = performance.now();
  loading = true;
  loadingUntil = now + 3000;
  bootShownAt = now;
  bootLeaving = false;
  bootScreen.hidden = false;
  bootScreen.classList.remove('leaving');
  bootStatus.textContent = `COMPILING ${arenaName}`;
  bootLog.textContent = `> MOUNT ARENA "${arenaName}"\n> LAY GROUND PLANE ......................... OK\n> DROP COVER GEOMETRY ...................... OK\n> ASSEMBLE OPERATOR RIGS ................... OK`;
  // Two animation frames let the title console paint once before the overlay fades in.
  requestAnimationFrame(() => bootScreen.classList.add('active'));
  renderer.beginIntro();
}

function updateLoadSequence(now: number): void {
  if (!loading) return;
  const elapsed = now - bootShownAt;
  if (elapsed > 1050 && !bootLeaving) {
    bootLeaving = true;
    bootScreen.classList.add('leaving');
  }
  if (elapsed > 1400 && bootScreen.classList.contains('active')) {
    bootScreen.classList.remove('active');
    bootScreen.hidden = true;
  }
  if (now >= loadingUntil) {
    loading = false;
    bootScreen.hidden = true;
    bootScreen.classList.remove('active', 'leaving');
  }
}

// Title menu stages --------------------------------------------------------------------------

function showMenuStage(stage: MenuStage): void {
  menuStage = stage;
  // The DEFLECT logo belongs to the hub. Every sub-stage gets that height back.
  titleScreen.classList.toggle('stage-open', stage !== 'hub');
  menuHub.hidden = stage !== 'hub';
  menuSoloProgram.hidden = stage !== 'soloProgram';
  menuSolo.hidden = stage !== 'solo';
  menuArena.hidden = stage !== 'soloArena';
  menuGauntlet.hidden = stage !== 'gauntlet';
  menuSoloBots.hidden = stage !== 'soloBots';
  menuSoloTier.hidden = stage !== 'soloTier';
  menuSoloSeries.hidden = stage !== 'soloSeries';
  menuStory.hidden = stage !== 'story';
  menuStoryBots.hidden = stage !== 'storyBots';
  menuLocal.hidden = stage !== 'local';
  menuMulti.hidden = stage !== 'multi';
  menuOnline.hidden = stage !== 'online';
  if (stage === 'soloProgram') renderProgramPicker();
  if (stage === 'soloArena') updateSoloArenaCopy();
  // Count and tier options depend on the mode: training can be solo, VS BOTS cannot.
  if (stage === 'soloBots' || stage === 'soloTier') renderBotControls();
  if (stage === 'soloSeries') renderSeriesSetup();
  if (stage === 'gauntlet') renderGauntletSetup();
  if (stage === 'story') renderStorySetup();
  if (stage === 'storyBots') renderStoryBots();
  if (stage === 'local') openLocalSetup();
  clearMenuSelection();
  // A taller TV-scale menu can put the next stage's first control above the fold.
  document.getElementById('screen-title')?.scrollTo({ top: 0 });
}

/** Mode first, then the program: SINGLE PLAYER > mode > program > that mode's setup. */
function openProgramSelect(program: SoloProgram): void {
  soloProgram = program;
  // Restore the tier for this mode instead of carrying VS BOTS' pick into training.
  botTier = botTierPrefs[program === 'bots' ? 'bots' : 'training'];
  // "NO BOTS" is a training-only choice; a versus match always needs an opponent.
  if (program !== 'training' && botCount < 1) botCount = 1;
  storyStatusLine.textContent = '';
  showMenuStage('soloProgram');
}

function updateProgramStageLabel(): void {
  programStageLabel.textContent =
    soloProgram === 'training'
      ? 'TRAINING // PROGRAM SELECT'
      : soloProgram === 'bots'
        ? 'VS BOTS // PROGRAM SELECT'
        : soloProgram === 'gauntlet'
          ? 'GAUNTLET // PROGRAM SELECT'
          : soloProgram === 'infection'
            ? 'INFECTION // PROGRAM SELECT'
            : 'CAMPAIGN // PLAYER SELECT';
}

function updateSoloArenaCopy(): void {
  const def = programDef(selectedProgram);
  const label =
    soloProgram === 'training'
      ? 'TRAINING'
      : soloProgram === 'bots'
        ? 'VS BOTS'
        : soloProgram === 'infection'
          ? 'INFECTION'
          : 'GAUNTLET';
  arenaStageLabel.textContent = `${label} // ${def.name} // SELECT ARENA`;
}

/** VS BOTS series setup. The default is random maps for a multi-game series; fixed
 * uses the arena already chosen in the picker. */
function renderSeriesSetup(): void {
  seriesStageLabel.textContent = 'VS BOTS // SERIES';
  seriesMapsBtn.textContent =
    seriesMapRule === 'random' ? 'MAPS: RANDOM' : `MAPS: FIXED // ${getArena(arenaIndex).name}`;
  seriesMapsBtn.setAttribute('aria-pressed', String(seriesMapRule === 'random'));
  clearChildren(seriesGamesEl);
  for (let i = 0; i < SERIES_LENGTHS.length; i++) {
    const games = SERIES_LENGTHS[i];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `console-choice${seriesGames === games ? ' selected' : ''}`;
    button.dataset.nav = '';
    button.textContent = games === 1 ? '1 GAME' : `${games} GAMES`;
    button.setAttribute('aria-pressed', String(seriesGames === games));
    button.addEventListener('click', () => startBotSeries(games));
    seriesGamesEl.appendChild(button);
  }
}

function toggleSeriesMapRule(): void {
  seriesMapRule = seriesMapRule === 'random' ? 'fixed' : 'random';
  persistArenaPrefs();
  renderSeriesSetup();
  toast(`MAPS // ${seriesMapRule === 'random' ? 'RANDOM' : 'FIXED'}`);
}

/** Clear any visible selection. A stage opens with nothing highlighted until real input. */
function clearMenuSelection(): void {
  resetNavFocus();
  document.body.classList.remove('pointer-live');
  const active = document.activeElement;
  if (active instanceof HTMLButtonElement) active.blur();
}

function markPointerLive(): void {
  document.body.classList.add('pointer-live');
}

function menuBack(): void {
  if (screen !== 'title') return;
  if (menuStage === 'story' && storyPrompt) {
    cancelStoryPrompt();
    return;
  }
  if (menuStage === 'soloSeries') showMenuStage('soloTier');
  else if (menuStage === 'soloTier') showMenuStage('soloBots');
  else if (menuStage === 'soloBots') showMenuStage('soloArena');
  else if (menuStage === 'gauntlet') showMenuStage('soloArena');
  else if (menuStage === 'soloArena') showMenuStage('soloProgram');
  else if (menuStage === 'storyBots') showMenuStage('story');
  else if (menuStage === 'story') showMenuStage('solo');
  else if (menuStage === 'soloProgram') showMenuStage(soloProgram === 'campaign' ? 'storyBots' : 'solo');
  else if (menuStage === 'solo') showMenuStage('hub');
  else if (menuStage === 'online') showMenuStage('multi');
  else if (menuStage === 'local') showMenuStage('multi');
  else if (menuStage !== 'hub') showMenuStage('hub');
}

// Arena & bot setup --------------------------------------------------------------------------

function loadArenaPrefs(): void {
  try {
    const savedArena = Number(localStorage.getItem('deflect.arena') ?? '0');
    if (Number.isFinite(savedArena)) arenaIndex = ((savedArena % ARENAS.length) + ARENAS.length) % ARENAS.length;
    const savedCount = Number(localStorage.getItem('deflect.botCount') ?? '3');
    if (savedCount >= 0 && savedCount <= 3) botCount = savedCount;
    seriesGames = normalizeSeriesGames(Number(localStorage.getItem('deflect.seriesGames') ?? '1'));
    seriesMapRule = normalizeSeriesMapRule(localStorage.getItem('deflect.seriesMapRule'));
    // Migrate the old shared tier key, then prefer the per-mode keys when present.
    const savedTier = localStorage.getItem('deflect.botTier');
    if (savedTier && (BOT_TIERS as readonly string[]).includes(savedTier)) {
      botTierPrefs.training = savedTier as BotTier;
      botTierPrefs.bots = savedTier as BotTier;
    }
    const savedTrainingTier = localStorage.getItem('deflect.botTier.training');
    if (savedTrainingTier && (BOT_TIERS as readonly string[]).includes(savedTrainingTier)) {
      botTierPrefs.training = savedTrainingTier as BotTier;
    }
    const savedBotsTier = localStorage.getItem('deflect.botTier.bots');
    if (savedBotsTier && (BOT_TIERS as readonly string[]).includes(savedBotsTier)) {
      botTierPrefs.bots = savedBotsTier as BotTier;
    }
    botTier = botTierPrefs.training;
    selectedProgram = clampProgram(Number(localStorage.getItem('deflect.program') ?? String(PROGRAM_ID.PROBE)));
    // Enemy crossfire is part of the sandbox by default; the run setup can turn it off.
    friendlyFire = localStorage.getItem('deflect.friendlyFire') !== '0';
  } catch {
    /* storage disabled: use defaults */
  }
}

function loadSettings(): void {
  let rotation = 1;
  let flash = 1;
  let scanlines = true;
  let minimap = true;
  let ui = true;
  let rumble = true;
  let autoLockOn = touchMode;
  let autoAttackOn = touchMode;
  try {
    const rawRotation = localStorage.getItem('deflect.hitRotation');
    const savedRotation = rawRotation === null ? NaN : Number(rawRotation);
    if (Number.isFinite(savedRotation) && savedRotation >= 0 && savedRotation <= 1) rotation = savedRotation;
    const rawFlash = localStorage.getItem('deflect.flash');
    const savedFlash = rawFlash === null ? NaN : Number(rawFlash);
    if (Number.isFinite(savedFlash) && savedFlash >= 0 && savedFlash <= 1) flash = savedFlash;
    scanlines = localStorage.getItem('deflect.scanlines') !== '0';
    minimap = localStorage.getItem('deflect.minimap') !== '0';
    ui = localStorage.getItem('deflect.ui') !== '0';
    rumble = localStorage.getItem('deflect.rumble') !== '0';
    // A phone starts with both assists on; a keyboard/pad session starts with them off
    // so the default one-stick feel is unchanged. An explicit save always wins.
    autoLockOn = localStorage.getItem('deflect.autoLock') === null ? touchMode : localStorage.getItem('deflect.autoLock') !== '0';
    autoAttackOn = localStorage.getItem('deflect.autoAttack') === null ? touchMode : localStorage.getItem('deflect.autoAttack') !== '0';
  } catch {
    /* storage disabled: defaults */
  }
  applyHitRotation(rotation, false);
  applyFlash(flash, false);
  applyScanlines(scanlines, false);
  applyMinimap(minimap, false);
  applyUi(ui, false);
  applyRumble(rumble, false);
  applyAutoLock(autoLockOn, false);
  applyAutoAttack(autoAttackOn, false);
  applyVolume(audio.volume, false);
  applyMusicVolume(audio.musicVolume, false);
  applySfxVolume(audio.sfxVolume, false);
  applyMenuVolume(audio.menuVolume, false);
}

function applyHitRotation(scale: number, persist: boolean): void {
  const clamped = Math.max(0, Math.min(1, scale));
  fx.rotationScale = clamped;
  hitRotationInput.value = String(Math.round(clamped * 100));
  hitRotationValue.textContent = `${Math.round(clamped * 100)}%`;
  if (!persist) return;
  try {
    localStorage.setItem('deflect.hitRotation', String(clamped));
  } catch {
    /* storage disabled */
  }
}

function applyFlash(scale: number, persist: boolean): void {
  const clamped = Math.max(0, Math.min(1, scale));
  fx.flashScale = clamped;
  flashInput.value = String(Math.round(clamped * 100));
  flashValue.textContent = `${Math.round(clamped * 100)}%`;
  if (!persist) return;
  try {
    localStorage.setItem('deflect.flash', String(clamped));
  } catch {
    /* storage disabled */
  }
}

function applyVolume(volume: number, persist: boolean): void {
  const clamped = Math.max(0, Math.min(1, volume));
  audio.volume = clamped;
  if (persist) audio.setVolume(clamped);
  volumeInput.value = String(Math.round(clamped * 100));
  volumeValue.textContent = `${Math.round(clamped * 100)}%`;
}

function applyMusicVolume(volume: number, persist: boolean): void {
  const clamped = Math.max(0, Math.min(1, volume));
  audio.musicVolume = clamped;
  if (persist) audio.setMusicVolume(clamped);
  musicVolumeInput.value = String(Math.round(clamped * 100));
  musicVolumeValue.textContent = `${Math.round(clamped * 100)}%`;
}

function applySfxVolume(volume: number, persist: boolean): void {
  const clamped = Math.max(0, Math.min(1, volume));
  audio.sfxVolume = clamped;
  if (persist) audio.setSfxVolume(clamped);
  sfxVolumeInput.value = String(Math.round(clamped * 100));
  sfxVolumeValue.textContent = `${Math.round(clamped * 100)}%`;
}

function applyMenuVolume(volume: number, persist: boolean): void {
  const clamped = Math.max(0, Math.min(1, volume));
  audio.menuVolume = clamped;
  if (persist) audio.setMenuVolume(clamped);
  menuVolumeInput.value = String(Math.round(clamped * 100));
  menuVolumeValue.textContent = `${Math.round(clamped * 100)}%`;
}

function applyScanlines(on: boolean, persist: boolean): void {
  document.body.classList.toggle('no-scanlines', !on);
  scanlinesBtn.textContent = `SCANLINES: ${on ? 'ON' : 'OFF'}`;
  scanlinesBtn.setAttribute('aria-pressed', String(on));
  if (!persist) return;
  try {
    localStorage.setItem('deflect.scanlines', on ? '1' : '0');
  } catch {
    /* storage disabled */
  }
}

function applyMinimap(on: boolean, persist: boolean): void {
  renderer.showMinimap = on;
  minimapBtn.textContent = `MINIMAP: ${on ? 'ON' : 'OFF'}`;
  minimapBtn.setAttribute('aria-pressed', String(on));
  if (!persist) return;
  try {
    localStorage.setItem('deflect.minimap', on ? '1' : '0');
  } catch {
    /* storage disabled */
  }
}

function applyUi(on: boolean, persist: boolean): void {
  uiEnabled = on;
  // The attract demo forces this off on its own; do not stomp it while it runs.
  if (!attract) renderer.showUi = on;
  uiBtn.textContent = `GAME UI: ${on ? 'ON' : 'OFF'}`;
  uiBtn.setAttribute('aria-pressed', String(on));
  if (!persist) return;
  try {
    localStorage.setItem('deflect.ui', on ? '1' : '0');
  } catch {
    /* storage disabled */
  }
}

function applyRumble(on: boolean, persist: boolean): void {
  haptics.setEnabled(on);
  rumbleBtn.textContent = `RUMBLE: ${on ? 'ON' : 'OFF'}`;
  rumbleBtn.setAttribute('aria-pressed', String(on));
  if (!persist) return;
  try {
    localStorage.setItem('deflect.rumble', on ? '1' : '0');
  } catch {
    /* storage disabled */
  }
}

function applyAutoLock(on: boolean, persist: boolean): void {
  autoLock = on;
  autoLockBtn.textContent = `AUTO LOCK: ${on ? 'ON' : 'OFF'}`;
  autoLockBtn.setAttribute('aria-pressed', String(on));
  if (!persist) return;
  try {
    localStorage.setItem('deflect.autoLock', on ? '1' : '0');
  } catch {
    /* storage disabled */
  }
}

function applyAutoAttack(on: boolean, persist: boolean): void {
  autoAttack = on;
  autoAttackBtn.textContent = `AUTO ATTACK: ${on ? 'ON' : 'OFF'}`;
  autoAttackBtn.setAttribute('aria-pressed', String(on));
  if (!persist) return;
  try {
    localStorage.setItem('deflect.autoAttack', on ? '1' : '0');
  } catch {
    /* storage disabled */
  }
}

function resetSettings(): void {
  applyHitRotation(1, true);
  applyFlash(1, true);
  applyVolume(0.8, true);
  applyMusicVolume(0.65, true);
  applySfxVolume(0.9, true);
  applyMenuVolume(0.8, true);
  applyScanlines(true, true);
  applyMinimap(true, true);
  applyUi(true, true);
  applyRumble(true, true);
  applyAutoLock(touchMode, true);
  applyAutoAttack(touchMode, true);
  toast('SETTINGS RESTORED TO DEFAULTS');
}

function showSettingsTab(tab: SettingsTab): void {
  settingsTab = tab;
  const tabs = settingsTabs.querySelectorAll<HTMLButtonElement>('[data-settings-tab]');
  for (let i = 0; i < tabs.length; i++) {
    const active = tabs[i].dataset.settingsTab === tab;
    tabs[i].classList.toggle('active', active);
    tabs[i].setAttribute('aria-selected', String(active));
  }
  const pages = document.querySelectorAll<HTMLElement>('[data-settings-page]');
  for (let i = 0; i < pages.length; i++) {
    pages[i].classList.toggle('active', pages[i].dataset.settingsPage === tab);
  }
}

function persistArenaPrefs(): void {
  try {
    localStorage.setItem('deflect.arena', String(arenaIndex));
    localStorage.setItem('deflect.botCount', String(botCount));
    localStorage.setItem('deflect.botTier', botTier);
    localStorage.setItem('deflect.botTier.training', botTierPrefs.training);
    localStorage.setItem('deflect.botTier.bots', botTierPrefs.bots);
    localStorage.setItem('deflect.seriesGames', String(seriesGames));
    localStorage.setItem('deflect.seriesMapRule', seriesMapRule);
    localStorage.setItem('deflect.program', String(selectedProgram));
    localStorage.setItem('deflect.friendlyFire', friendlyFire ? '1' : '0');
  } catch {
    /* storage disabled */
  }
}

function selectArena(index: number): void {
  arenaIndex = ((index % ARENAS.length) + ARENAS.length) % ARENAS.length;
  persistArenaPrefs();
  renderArenaPicker();
  if (mode === 'host' && hostNet) {
    const onlineIdx = onlineArenaIndex(arenaIndex);
    if (onlineIdx !== arenaIndex) toast(`${ARENAS[arenaIndex].name} IS LOCAL ONLY // ARENA KEPT`, 'warn');
    hostNet.setArena(onlineIdx);
    lobbyState = hostNet.getLobbyState();
    if (screen === 'lobby') renderLobby(lobbyState);
  }
}

/**
 * Compactor, keypad, scanner, browser, USB, SWIPE and SATELLITE clocks ride the
 * snapshot, and the host resolves every hazard hit. Feed pipes and the firewall switch
 * are different: they spawn local threats and a sweep the snapshot does not carry.
 * ROCKET NAVIGATION's barrier clock, WEAPON SYSTEMS' console display, PONG's rally ball,
 * AIRPORT's flip board, SPACE INVADERS' cannon, FAX MACHINE's print head, SMART PLUG's
 * circuit ring, SMOKE DETECTOR's alarm, SMART WATCH's second hand and BUSINESS LAPTOP's
 * scrolling inbox are local presentation too, so none may enter a hosted room until its
 * state is in Snapshot. The three SERVER BOARDS are local-only for the same reason: their
 * modules are ordinary cover, but the hazard pass is deliberately not network state yet.
 * DISPATCH YARD and LOAD BALANCER own local request traffic for the same reason. The
 * food-court and arcade row is local-only too: its drops, cars, fighters, birds and
 * falling Tetris cover have no snapshot fields.
 */
function isOnlineArena(a: ArenaDef): boolean {
  // Room arenas are tutorial staging: their chasms, props and fixture clocks are local
  // presentation/content, not a versus map. Keep them out of hosted rooms and series.
  return !a.server && !a.requests && !a.dispenser && !a.soda && !a.race && !a.fighter && !a.duck && !a.tetris && !a.pipes && !a.firewallSwitch && !a.rooms && !a.rocket && !a.weapon && !a.seek && !a.car && !a.pong && !a.flip && !a.invaders && !a.fax && !a.plug && !a.smoke && !a.watch && !a.laptop && !a.radar;
}

function onlineArenaIndex(index: number): number {
  const n = ARENAS.length;
  const start = ((index % n) + n) % n;
  if (isOnlineArena(ARENAS[start])) return start;
  for (let i = 1; i < n; i++) {
    const idx = (start + i) % n;
    if (isOnlineArena(ARENAS[idx])) return idx;
  }
  return start;
}

/** Reset the series-owned match bookkeeping before game one. */
function beginSeriesState(games: number, rule: SeriesMapRule, run: boolean): void {
  seriesGames = normalizeSeriesGames(games);
  seriesMapRule = rule;
  seriesRun = run && seriesGames > 1;
  seriesGame = 1;
  seriesWins.fill(0);
  seriesResultRecorded = false;
  seriesLastArenaId = -1;
}

/** Pick the next game's arena from the eligible pool, avoiding the last map. */
function chooseSeriesArena(online: boolean): ArenaDef {
  const pool = online ? ARENAS.filter(isOnlineArena) : ARENAS.slice();
  const arena = pickSeriesArena(pool, arenaIndex, seriesMapRule, seriesLastArenaId);
  if (!arena) return getArena(online ? onlineArenaIndex(arenaIndex) : arenaIndex);
  seriesLastArenaId = arena.id;
  return arena;
}

function startBotSeries(games: number): void {
  if (busy) return;
  beginSeriesState(games, seriesMapRule, games > 1);
  persistArenaPrefs();
  startBotMatch(false, true);
}

function startNextBotSeriesGame(): void {
  if (mode !== 'bots' || !seriesRun) return;
  seriesGame++;
  seriesResultRecorded = false;
  startBotMatch(false, true);
}

function returnToSeriesSetup(): void {
  teardownSession();
  soloProgram = 'bots';
  showMenuStage('soloSeries');
  setScreen('title');
  refreshTitleButtons();
  setTitleStatus('');
}

function seriesScoreLine(state: RenderState): string {
  const parts: string[] = [];
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    // At match end only the survivor may still be active; keep every named slot in the score.
    if (!p.name) continue;
    parts.push(`${p.name} ${seriesWins[i]}`);
  }
  return parts.join('  /  ');
}

function recordSeriesResult(state: RenderState): void {
  if (!seriesRun || seriesResultRecorded) return;
  seriesResultRecorded = true;
  if (state.matchWinner >= 0 && state.matchWinner < seriesWins.length) {
    seriesWins[state.matchWinner]++;
  }
}

function seriesNextMapLabel(): string {
  return seriesMapRule === 'random' ? 'RANDOM MAP' : `MAP ${getArena(arenaIndex).name}`;
}

function renderArenaPicker(): void {
  clearChildren(arenaPicker);
  for (let i = 0; i < ARENAS.length; i++) {
    const option = ARENAS[i];
    if (option.qa) continue;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `console-arena-card${i === arenaIndex ? ' selected' : ''}`;
    card.dataset.nav = '';
    card.title = option.tagline;
    card.setAttribute('aria-pressed', String(i === arenaIndex));
    card.setAttribute('aria-label', `${option.name}. ${option.tagline}`);

    const preview = document.createElement('canvas');
    preview.width = 240;
    preview.height = 120;
    preview.setAttribute('aria-hidden', 'true');
    drawArenaPreview(preview, option);

    const label = document.createElement('span');
    label.className = 'console-arena-label';
    label.textContent = `${String(i + 1).padStart(2, '0')}  ${option.name}`;
    card.append(preview, label);
    card.addEventListener('click', () => {
      selectArena(i);
      if (menuStage !== 'soloArena' || screen !== 'title') return;
      if (soloProgram === 'gauntlet') showMenuStage('gauntlet');
      else if (soloProgram === 'infection') startInfection();
      else showMenuStage('soloBots');
    });
    arenaPicker.appendChild(card);
  }
}

function selectProgram(index: number): void {
  selectedProgram = clampProgram(index);
  persistArenaPrefs();
  renderProgramPicker();
  updateBotSummary();
}

function renderProgramPicker(): void {
  updateProgramStageLabel();
  clearChildren(programPicker);
  for (let i = 0; i < PROGRAMS.length; i++) {
    const def = PROGRAMS[i];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `console-program-card${def.id === selectedProgram ? ' selected' : ''}`;
    card.dataset.nav = '';
    card.title = def.note;
    card.setAttribute('aria-pressed', String(def.id === selectedProgram));
    card.setAttribute('aria-label', `${def.name}. ${def.role}`);

    const portrait = document.createElement('canvas');
    portrait.width = 240;
    portrait.height = 240;
    portrait.setAttribute('aria-hidden', 'true');
    drawProgramPortrait(portrait, def.id);

    const name = document.createElement('span');
    name.className = 'console-program-name';
    name.textContent = def.name;
    const role = document.createElement('span');
    role.className = 'console-program-role';
    role.textContent = def.role;
    card.append(portrait, name, role);
    card.addEventListener('click', () => {
      selectProgram(def.id);
      if (menuStage !== 'soloProgram' || screen !== 'title') return;
      if (soloProgram === 'campaign') {
        if (storySlot < 0) {
          showMenuStage('story');
          return;
        }
        startNewCampaign();
        return;
      }
      showMenuStage('soloArena');
    });
    programPicker.appendChild(card);
  }
}

/** Procedural program portrait: the same shapes the arena uses, at poster size. */
function drawProgramPortrait(canvas: HTMLCanvasElement, programId: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const def = programDef(programId);
  const size = 240;
  const cx = size * 0.5;
  const cy = size * 0.52;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#04080e';
  ctx.fillRect(0, 0, size, size);

  // Faint circuit floor behind the program.
  ctx.strokeStyle = def.color;
  ctx.globalAlpha = 0.08;
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    const y = cy + i * 26;
    ctx.beginPath();
    ctx.moveTo(22, y);
    ctx.lineTo(size - 22, y);
    ctx.stroke();
  }
  for (let i = -2; i <= 2; i++) {
    const x = cx + i * 42;
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, size - 24);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = def.color;
  ctx.strokeRect(10.5, 10.5, size - 21, size - 21);
  ctx.beginPath();
  ctx.moveTo(10, 34);
  ctx.lineTo(34, 10);
  ctx.moveTo(size - 10, size - 34);
  ctx.lineTo(size - 34, size - 10);
  ctx.stroke();

  ctx.globalCompositeOperation = 'lighter';
  // The program's own health silhouette. Most are three segments; Atomize's six-arc
  // atomic hull needs its full pool or the portrait shows only half an atom.
  const ring = 74;
  const segments = def.healthSegments ?? 3;
  const spin = programId * 0.45 - Math.PI / 2 + (programId === PROGRAM_ID.WEDGE ? Math.PI / 4 : 0);
  ctx.strokeStyle = def.color;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  // Complete the four-corner hull behind Wedge's three health brackets.
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 1.4;
  pathProgramFrame(ctx, programId, cx, cy, ring, spin);
  ctx.stroke();
  ctx.globalAlpha = 0.1;
  pathProgramHealth(ctx, programId, cx, cy, ring, spin, segments, segments);
  ctx.globalAlpha = 0.1;
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';

  // Heading arrow, same language as the avatar.
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.moveTo(cx + ring + 20, cy);
  ctx.lineTo(cx + ring + 4, cy - 9);
  ctx.lineTo(cx + ring + 4, cy + 9);
  ctx.closePath();
  ctx.fill();

  // Center mark: the same glyph that sits at the avatar's core, at poster size.
  ctx.save();
  ctx.translate(cx, cy + 2);
  ctx.scale(4.4, 4.4);
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = def.color;
  // Wide multi-line marks use a larger poster footprint so their rows stay legible.
  // `coreScale` applies here too: the poster mark must keep the same clearance from
  // the health hull that the arena mark has, especially on the vector centers.
  drawProgramMark(
    ctx,
    programId,
    def.glyph,
    def.symbolFont,
    0,
    0,
    10 * ((def.glyphRadius ?? 0.51) / 0.51),
    def.coreScale,
  );
  ctx.restore();

  // Signature accent ticks below the mark so each card has a kit silhouette hint.
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (programId === PROGRAM_ID.WEDGE) {
    ctx.moveTo(cx - 26, cy + 42);
    ctx.lineTo(cx + 26, cy + 42);
    ctx.lineTo(cx + 26, cy + 32);
  } else if (programId === PROGRAM_ID.FISHER) {
    ctx.moveTo(cx - 28, cy + 36);
    ctx.lineTo(cx + 28, cy + 44);
    ctx.moveTo(cx - 28, cy + 44);
    ctx.lineTo(cx + 28, cy + 36);
  } else if (programId === PROGRAM_ID.SWEEP) {
    // Broom fan under the core mark.
    ctx.moveTo(cx - 22, cy + 46);
    ctx.lineTo(cx, cy + 34);
    ctx.lineTo(cx + 22, cy + 46);
    ctx.moveTo(cx - 10, cy + 46);
    ctx.lineTo(cx, cy + 34);
    ctx.lineTo(cx + 10, cy + 46);
  } else {
    ctx.moveTo(cx - 22, cy + 44);
    ctx.lineTo(cx - 8, cy + 44);
    ctx.moveTo(cx - 2, cy + 44);
    ctx.lineTo(cx + 12, cy + 44);
  }
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function updateGauntletBestLabel(): void {
  const best = gauntletRecords[0];
  gauntletBestValue.textContent = best ? `BEST W${best.wave}` : 'SCORED';
  gauntletBestValue.title = best
    ? `Best: wave ${best.wave}, ${formatGauntletTime(best.seconds)}, ${best.kills} kills`
    : 'No scored runs yet';
}

/**
 * Local run rule shared by gauntlet and campaign. On, hostile shots can damage rival
 * threat families; off, they pass through and only threaten players. Default on.
 */
function renderFriendlyFire(): void {
  const label = friendlyFire ? 'ON' : 'OFF';
  gauntletFriendlyBtn.setAttribute('aria-pressed', String(friendlyFire));
  gauntletFriendlyValue.textContent = label;
  campaignFriendlyBtn.setAttribute('aria-pressed', String(friendlyFire));
  campaignFriendlyValue.textContent = label;
}

function renderCampaignSkipTutorials(): void {
  const label = campaignSkipTutorials ? 'ON' : 'OFF';
  campaignSkipTutorialBtn.setAttribute('aria-pressed', String(campaignSkipTutorials));
  campaignSkipTutorialValue.textContent = label;
}

function toggleCampaignSkipTutorials(): void {
  campaignSkipTutorials = !campaignSkipTutorials;
  try {
    localStorage.setItem('deflect.campaignSkipTutorials', campaignSkipTutorials ? '1' : '0');
  } catch {
    /* storage disabled: the setting still applies to this session */
  }
  renderCampaignSkipTutorials();
  toast(`SKIP TUTORIALS // ${campaignSkipTutorials ? 'ON' : 'OFF'}`);
}

function toggleFriendlyFire(): void {
  friendlyFire = !friendlyFire;
  persistArenaPrefs();
  renderFriendlyFire();
  toast(`FRIENDLY FIRE // ${friendlyFire ? 'ON' : 'OFF'}`);
}

function renderGauntletSetup(): void {
  const arena = getArena(arenaIndex);
  const def = programDef(selectedProgram);
  gauntletStageLabel.textContent = bossRush
    ? `BOSS RUSH // ${def.name} // ${arena.name}`
    : `GAUNTLET // ${def.name} // ${arena.name}`;
  gauntletRushBtn.setAttribute('aria-pressed', String(bossRush));
  gauntletRushValue.textContent = bossRush ? 'ON' : 'OFF';
  renderFriendlyFire();
  renderGauntletRecords();
}

function toggleBossRush(): void {
  bossRush = !bossRush;
  renderGauntletSetup();
  toast(`BOSS RUSH // ${bossRush ? 'ON' : 'OFF'}`);
}

function toggleLocalBossRush(): void {
  localBossRush = !localBossRush;
  renderLocalSeats();
  toast(`LOCAL BOSS RUSH // ${localBossRush ? 'ON' : 'OFF'}`);
}

/**
 * Campaign entry. Slots come first: an empty slot starts a new run and continues to the
 * bot count and player select; a filled slot resumes the run stored on it. A completed
 * BUILD ROOT slot reports that the next levels are still coming soon.
 */
function openStory(): void {
  soloProgram = 'campaign';
  storySlot = -1;
  storyPrompt = null;
  storyStatusLine.textContent = '';
  showMenuStage('story');
}

function renderStorySetup(): void {
  loadCampaignPrefs();
  renderFriendlyFire();
  renderCampaignSkipTutorials();
  renderStorySlots();
}

function renderStoryBots(): void {
  loadCampaignPrefs();
  storyBotsLabel.textContent = storySlot >= 0 ? `CAMPAIGN // BOTS // SLOT ${storySlot + 1}` : 'CAMPAIGN // BOTS';
  renderCampaignBots();
}

function chooseCampaignBots(count: number): void {
  setCampaignBots(count);
  if (menuStage !== 'storyBots') return;
  showMenuStage('soloProgram');
}

/**
 * Campaign run lifecycle. Slots own the persistence; this module owns the live session.
 * BUILD ROOT is the only live level; REBOOT is authored but parked behind `playable: false`.
 * A save is written only when a level completes.
 */
function startNewCampaign(): void {
  campaignSlot = storySlot;
  campaignPlayers = 1;
  campaignLevelIndex = 0;
  campaignSaved = false;
  campaignPlaySeconds = 0;
  campaignMemory = new Array(MAX_PLAYERS).fill(0);
  campaignShards = [];
  campaignBotDead = 0;
  campaignDeadHere = 0;
  campaignRetryRevives = false;
  campaignDebug?.mark('new-campaign', `slot ${campaignSlot + 1}`);
  startCampaignLevel();
}

function resumeCampaign(index: number, save: StorySave): void {
  storySlot = index;
  campaignSlot = index;
  campaignPlayers = save.players;
  campaignBots = save.bots;
  selectedProgram = clampProgram(save.program);
  campaignSaved = false;
  campaignPlaySeconds = 0;
  campaignMemory = new Array(MAX_PLAYERS).fill(0);
  campaignBotDead = (save.deadBots ?? 0) & 0xfe;
  campaignDeadHere = 0;
  campaignRetryRevives = false;
  for (let i = 0; i < MAX_PLAYERS; i++) campaignMemory[i] = save.memory?.[i] ?? 0;
  campaignShards = save.shards ? save.shards.slice(0, MAX_PLAYERS) : [];
  // `level` is the number of completed levels, so it is also the next index.
  if (save.level >= PLAYABLE_CAMPAIGN_LEVELS.length) {
    campaignLevelIndex = 0;
    campaignSaved = true;
    storyStatusLine.textContent = 'CAMPAIGN COMPLETE // MORE LEVELS COMING SOON';
    toast('CAMPAIGN COMPLETE // MORE LEVELS COMING SOON', 'warn');
    renderStorySlots();
    return;
  }
  campaignLevelIndex = Math.max(0, save.level);
  campaignDebug?.mark('resume-campaign', `slot ${index + 1} // level ${save.level + 1}`);
  startCampaignLevel();
}

function startCampaignLevel(viaPortal = false, retrySameArena = false): void {
  if (busy) return;
  teardownSession();
  hideOverlayInternal();
  hideCampaignRoad();
  campaignClearHandled = false;
  // A retry keeps this arena's losses eligible for a later TPK restore; a fresh node
  // starts a new arena and only its own losses can come back.
  if (!retrySameArena) campaignDeadHere = 0;
  campaignRetryRevives = false;
  mode = 'campaign';
  localSlot = 0;
  stress = false;
  campaignLevelIndex = Math.max(0, Math.min(PLAYABLE_CAMPAIGN_LEVELS.length - 1, campaignLevelIndex));
  const level = PLAYABLE_CAMPAIGN_LEVELS[campaignLevelIndex];
  const arena = getArena(level.arenaId);
  // NO BOTS means no bots. The old clamp forced one companion into every campaign
  // node, including a run that had explicitly chosen zero.
  const drill = Math.max(0, Math.min(CAMPAIGN.maxDrillBots, campaignBots));
  const names = new Array(MAX_PLAYERS).fill('');
  names[0] = getCallsign();
  for (let i = 1; i <= drill; i++) names[i] = BOT_NAMES[(i - 1) % BOT_NAMES.length];
  const botPrograms = botProgramList(drill);
  world = new World(
    'gauntlet',
    names,
    0,
    arena,
    false,
    selectedProgram,
    drill,
    botPrograms,
    true,
    level.dataCrates,
    false,
    level.intro,
    level.clearKills,
    false,
    level.boss ?? -1,
    level.primitivesOnly === true,
    level.opening ?? null,
    level.finale === true,
    campaignBotDead,
  );
  world.friendlyFire = friendlyFire;
  for (let i = 0; i < MAX_PLAYERS; i++) world.setMemoryStacks(i, campaignMemory[i] ?? 0);
  world.restoreFragments(campaignShards);
  // The menu rule skips the lesson for the whole run. New tutorials created later
  // (holding's skill and heavy beats) are skipped by the live sync below.
  if (campaignSkipTutorials) world.skipTutorial();
  // A portal hop drops the squad on the new room's left wall. A fresh node keeps the
  // authored spawn so the player still starts where the room expects them.
  if (viaPortal) world.enterAtPortal(CAMPAIGN.campaignEntryThrowDelay);
  botInputs = new Array(MAX_PLAYERS);
  for (let i = 0; i < MAX_PLAYERS; i++) botInputs[i] = { mx: 0, my: 0, held: 0, pressed: 0 };
  botBrains = new Array(MAX_PLAYERS).fill(null);
  for (let i = 1; i <= drill; i++) {
    botBrains[i] = new BotBrain(i, botTierPrefs.training, i - 1, 0x51f15e + arena.id * 997 + i * 131);
  }
  botInputs[0] = localFrame;
  trainingInputs = botInputs;
  campaignSaved = false;
  campaignPlaySeconds = 0;
  resetCounters();
  lastCampaignPhase = '';
  fx.reset();
  setScreen('game');
  // A portal hop is its own load screen: the wipe opens on the assembled arena instead
  // of dropping the boot console over it. A fresh node from a menu still boots.
  if (viaPortal) {
    loading = false;
    bootScreen.hidden = true;
    bootScreen.classList.remove('active', 'leaving');
    renderer.beginIntro();
  } else {
    beginLoadSequence(`${level.name} // ${level.code}`);
  }
  audio.unlock();
  audio.startMusic();
  beginSessionLog();
  console.log(
    '[DEFLECT-STATE] Campaign node',
    level.name,
    'drill bots',
    drill,
    'friendly fire',
    friendlyFire ? 'on' : 'off',
    viaPortal ? 'VIA PORTAL' : '',
  );
  campaignDebug?.mark(
    'level-start',
    `${level.name} // ${level.code} // slot ${campaignSlot + 1} // ${drill} drill // ${
      viaPortal ? 'via portal' : 'fresh spawn'
    }`,
  );
}

/** Back to the save-slot stage, abandoning the live node. */
function returnToStory(): void {
  teardownSession();
  campaignSlot = -1;
  storySlot = -1;
  storyPrompt = null;
  soloProgram = 'campaign';
  showMenuStage('story');
  setScreen('title');
  busy = false;
  refreshTitleButtons();
  setTitleStatus('');
}

function programStageBack(): void {
  showMenuStage(soloProgram === 'campaign' ? 'storyBots' : 'solo');
}

function storySlotSummary(save: StorySave): { label: string; value: string } {
  const sector = SECTORS[save.sector];
  const where = sector ? sector.name : `CAMPAIGN ${save.sector + 1}`;
  const complete = save.level >= PLAYABLE_CAMPAIGN_LEVELS.length;
  return {
    label: complete ? `${where} // COMPLETE` : save.level > 0 ? `${where} // LV ${save.level}` : where,
    value: complete ? 'MORE LEVELS SOON' : `${save.players} PLAYER${save.players === 1 ? '' : 'S'}`,
  };
}

function storyBack(): void {
  if (storyPrompt) {
    cancelStoryPrompt();
    return;
  }
  showMenuStage('solo');
}

function cancelStoryPrompt(): void {
  storyPrompt = null;
  storyStatusLine.textContent = '';
  renderStorySlots();
}

function startNewStory(): void {
  const slots = loadStorySlots();
  const empty = slots.findIndex((save) => !save);
  if (empty >= 0) {
    storySlot = empty;
    storyPrompt = null;
    storyStatusLine.textContent = '';
    showMenuStage('storyBots');
    return;
  }
  storyPrompt = { kind: 'overwrite-pick' };
  renderStorySlots();
}

function storyPromptRow(slot: number, action: 'OVERWRITE' | 'USE'): HTMLButtonElement {
  const save = loadStorySlots()[slot];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'console-option';
  button.dataset.nav = '';
  const key = document.createElement('span');
  key.className = 'option-key option-key-wide';
  key.textContent = `SLOT ${slot + 1}`;
  const label = document.createElement('span');
  label.className = 'option-label';
  label.textContent = save ? storySlotSummary(save).label : 'EMPTY SLOT';
  const value = document.createElement('span');
  value.className = 'option-value';
  value.textContent = action;
  button.append(key, label, value);
  button.setAttribute(
    'aria-label',
    save
      ? `Slot ${slot + 1}, ${storySlotSummary(save).label}, ${action.toLowerCase()}`
      : `Slot ${slot + 1}, empty, start a new game`,
  );
  button.addEventListener('click', () => {
    if (!save) {
      storySlot = slot;
      storyPrompt = null;
      storyStatusLine.textContent = '';
      showMenuStage('storyBots');
      return;
    }
    storyPrompt = { kind: 'overwrite-confirm', slot };
    renderStorySlots();
  });
  return button;
}

function storyPromptCancel(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'console-option console-back';
  button.dataset.nav = '';
  button.innerHTML = '<span class="option-key">ESC</span><span class="option-label">CANCEL</span>';
  button.addEventListener('click', cancelStoryPrompt);
  return button;
}

function renderStorySlots(): void {
  const slots = loadStorySlots();
  clearChildren(storySlotsEl);
  storyNewBtn.hidden = storyPrompt !== null;
  storyRulesEl.hidden = storyPrompt !== null;
  storyNewValue.textContent = slots.some((save) => !save) ? 'FIRST OPEN SLOT' : 'OVERRIDE A SLOT';

  if (storyPrompt?.kind === 'overwrite-pick') {
    storyStageLabel.textContent = 'CAMPAIGN // OVERWRITE SAVE SLOT';
    storyStatusLine.textContent = 'ALL THREE SLOTS ARE FULL. CHOOSE THE SLOT THE NEW RUN WILL REPLACE.';
    for (let i = 0; i < STORY_SLOT_COUNT; i++) {
      storySlotsEl.appendChild(storyPromptRow(i, slots[i] ? 'OVERWRITE' : 'USE'));
    }
    storySlotsEl.appendChild(storyPromptCancel());
    clearMenuSelection();
    return;
  }

  if (storyPrompt?.kind === 'clear-confirm' || storyPrompt?.kind === 'overwrite-confirm') {
    const overwrite = storyPrompt.kind === 'overwrite-confirm';
    const slot = storyPrompt.slot;
    const save = slots[slot];
    const summary = save ? storySlotSummary(save) : null;
    storyStageLabel.textContent = overwrite ? 'CAMPAIGN // CONFIRM OVERWRITE' : 'CAMPAIGN // CONFIRM CLEAR';
    storyStatusLine.textContent = overwrite
      ? `SLOT ${slot + 1}${summary ? ` // ${summary.label}` : ''} WILL BE REPLACED BY A NEW RUN.`
      : `SLOT ${slot + 1}${summary ? ` // ${summary.label}` : ''} WILL BE DELETED.`;

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'console-option';
    confirm.dataset.nav = '';
    confirm.innerHTML = `<span class="option-key option-key-wide">SLOT ${slot + 1}</span><span class="option-label">${
      overwrite ? 'START NEW GAME' : 'DELETE THIS SAVE'
    }</span><span class="option-value">${overwrite ? 'REPLACE' : 'DELETE'}</span>`;
    confirm.addEventListener('click', () => {
      if (overwrite) {
        if (save) clearStorySlot(slot);
        storySlot = slot;
        storyPrompt = null;
        storyStatusLine.textContent = '';
        showMenuStage('storyBots');
        toast(`NEW CAMPAIGN // SLOT ${slot + 1}`, 'warn');
        return;
      }
      clearStorySlot(slot);
      storySlot = -1;
      storyPrompt = null;
      renderStorySlots();
      storyStatusLine.textContent = `SLOT ${slot + 1} CLEARED.`;
      toast(`SAVE SLOT ${slot + 1} CLEARED`, 'warn');
    });
    storySlotsEl.append(confirm, storyPromptCancel());
    clearMenuSelection();
    return;
  }

  storyStageLabel.textContent = 'CAMPAIGN // SAVE SLOTS';
  for (let i = 0; i < STORY_SLOT_COUNT; i++) {
    const save = slots[i];
    const row = document.createElement('div');
    row.className = 'story-slot-row';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'console-option story-slot-main';
    button.dataset.nav = '';

    const key = document.createElement('span');
    key.className = 'option-key option-key-wide';
    key.textContent = `SLOT ${i + 1}`;
    const label = document.createElement('span');
    label.className = 'option-label';
    const value = document.createElement('span');
    value.className = 'option-value';

    if (save) {
      const summary = storySlotSummary(save);
      label.textContent = summary.label;
      value.textContent = summary.value;
      button.setAttribute('aria-label', `Slot ${i + 1}, ${label.textContent}, ${value.textContent}, resume`);
    } else {
      label.textContent = 'EMPTY SLOT';
      value.textContent = 'START NEW GAME';
      button.setAttribute('aria-label', `Slot ${i + 1}, empty, start a new game`);
    }

    button.append(key, label, value);
    button.addEventListener('click', () => {
      if (save) {
        resumeCampaign(i, save);
        return;
      }
      storySlot = i;
      storyStatusLine.textContent = '';
      showMenuStage('storyBots');
    });
    row.appendChild(button);

    if (save) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'console-option story-slot-clear';
      clear.dataset.nav = '';
      clear.textContent = 'CLEAR';
      clear.setAttribute('aria-label', `Clear slot ${i + 1}, ${label.textContent}`);
      clear.addEventListener('click', () => {
        storyPrompt = { kind: 'clear-confirm', slot: i };
        renderStorySlots();
      });
      row.appendChild(clear);
    }

    storySlotsEl.appendChild(row);
  }
  clearMenuSelection();
}

function loadCampaignPrefs(): void {
  try {
    const saved = Number(localStorage.getItem('deflect.campaignBots') ?? '0');
    if (Number.isFinite(saved) && saved >= 0 && saved <= 3) campaignBots = Math.round(saved);
    campaignSkipTutorials = localStorage.getItem('deflect.campaignSkipTutorials') === '1';
  } catch {
    /* storage disabled: no companions and no stored skip rule */
  }
}

function setCampaignBots(count: number): void {
  campaignBots = Math.max(0, Math.min(3, count));
  try {
    localStorage.setItem('deflect.campaignBots', String(campaignBots));
  } catch {
    /* storage disabled */
  }
  renderCampaignBots();
}

/**
 * New-run bot count. Picking a count moves on to player select; bots take whatever
 * programs the human players leave unused.
 */
function renderCampaignBots(): void {
  if (campaignBotsEl.childElementCount === 0) {
    const labels = ['NO BOTS', '1 BOT', '2 BOTS', '3 BOTS'];
    for (let i = 0; i < labels.length; i++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'console-choice';
      button.dataset.nav = '';
      button.textContent = labels[i];
      button.addEventListener('click', () => chooseCampaignBots(i));
      campaignBotsEl.appendChild(button);
    }
  }
  const buttons = campaignBotsEl.querySelectorAll<HTMLButtonElement>('button');
  for (let i = 0; i < buttons.length; i++) {
    const selected = i === campaignBots;
    buttons[i].classList.toggle('selected', selected);
    buttons[i].setAttribute('aria-pressed', String(selected));
  }
}

function renderHowToPrograms(): void {
  clearChildren(howtoPrograms);
  for (let i = 0; i < PROGRAMS.length; i++) {
    const def = PROGRAMS[i];
    const card = document.createElement('div');
    card.className = 'howto-program';
    card.style.setProperty('--program-color', def.color);

    const glyph = document.createElement('span');
    glyph.className = 'howto-program-glyph';
    glyph.textContent = def.glyph;
    const name = document.createElement('b');
    name.textContent = def.name;
    const role = document.createElement('span');
    role.className = 'howto-program-role';
    role.textContent = def.role;
    const note = document.createElement('span');
    note.className = 'howto-program-note';
    note.textContent = def.note;

    card.append(glyph, name, role, note);
    howtoPrograms.appendChild(card);
  }
}

function renderGauntletRecords(): void {
  clearChildren(gauntletRecordsEl);
  const head = document.createElement('li');
  head.className = 'console-record-head';
  head.setAttribute('aria-hidden', 'true');
  const headings = ['RK', 'OPERATOR', 'WAVE', 'TIME', 'ARENA'];
  for (let i = 0; i < headings.length; i++) {
    const cell = document.createElement('span');
    cell.textContent = headings[i];
    head.appendChild(cell);
  }
  gauntletRecordsEl.appendChild(head);

  if (gauntletRecords.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'console-record-empty';
    empty.textContent = 'NO RUNS YET';
    gauntletRecordsEl.appendChild(empty);
    return;
  }

  for (let i = 0; i < gauntletRecords.length; i++) {
    const run = gauntletRecords[i];
    const row = document.createElement('li');
    const rank = document.createElement('span');
    rank.className = 'console-record-rank';
    rank.textContent = String(i + 1).padStart(2, '0');
    const name = document.createElement('span');
    name.className = 'console-record-name';
    name.textContent = run.name;
    const wave = document.createElement('span');
    wave.className = 'console-record-wave';
    wave.textContent = `W${run.wave}`;
    const time = document.createElement('span');
    time.className = 'console-record-time';
    time.textContent = formatGauntletTime(run.seconds);
    const arena = document.createElement('span');
    arena.className = 'console-record-arena';
    arena.textContent = getArena(run.arenaId).name;
    row.append(rank, name, wave, time, arena);
    gauntletRecordsEl.appendChild(row);
  }
}

function botCountLabel(count: number): string {
  if (count < 1) return 'NO BOTS';
  return count === 1 ? '1 V 1' : `1 V ${count}`;
}

function renderBotControls(): void {
  clearChildren(botCountEl);
  // Training can be a solo drone session; versus needs at least one opponent.
  const counts = soloProgram === 'training' ? [0, 1, 2, 3] : [1, 2, 3];
  for (let i = 0; i < counts.length; i++) {
    const count = counts[i];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `console-choice${botCount === count ? ' selected' : ''}`;
    button.dataset.nav = '';
    button.textContent = botCountLabel(count);
    button.setAttribute('aria-pressed', String(botCount === count));
    button.addEventListener('click', () => {
      setBotCount(count);
      if (menuStage === 'soloBots') showMenuStage('soloTier');
    });
    botCountEl.appendChild(button);
  }

  clearChildren(botTierEl);
  for (let i = 0; i < BOT_TIERS.length; i++) {
    const tier = BOT_TIERS[i];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `console-choice${botTier === tier ? ' selected' : ''}`;
    button.dataset.nav = '';
    button.textContent = BOT_TIER_LABELS[tier];
    button.setAttribute('aria-pressed', String(botTier === tier));
    button.addEventListener('click', () => {
      setBotTier(tier);
      if (menuStage !== 'soloTier') return;
      if (soloProgram === 'bots') showMenuStage('soloSeries');
      else startTrainingBots();
    });
    botTierEl.appendChild(button);
  }
  updateBotSummary();
}

function setBotCount(count: number): void {
  botCount = Math.max(0, Math.min(3, count));
  if (soloProgram !== 'training' && botCount === 0) botCount = 1;
  persistArenaPrefs();
  renderBotControls();
}

function setBotTier(tier: BotTier): void {
  botTier = tier;
  botTierPrefs[soloProgram === 'bots' ? 'bots' : 'training'] = tier;
  persistArenaPrefs();
  renderBotControls();
}

function updateBotSummary(): void {
  const def = programDef(selectedProgram);
  const label = soloProgram === 'bots' ? 'VS BOTS' : 'TRAINING';
  botStageLabel.textContent = `${label} // ${def.name} // BOT COUNT // ${botCountLabel(botCount)}`;
  tierStageLabel.textContent = `${label} // ${def.name} // DIFFICULTY // ${BOT_TIER_LABELS[botTier]}`;
}

function cycleLobbyArena(): void {
  if (mode !== 'host' || !hostNet) return;
  arenaIndex = onlineArenaIndex(arenaIndex + 1);
  persistArenaPrefs();
  renderArenaPicker();
  hostNet.setArena(arenaIndex);
  lobbyState = hostNet.getLobbyState();
  renderLobby(lobbyState);
  toast(`ARENA // ${getArena(arenaIndex).name}`);
}

function cycleLobbySeries(): void {
  if (mode !== 'host' || !hostNet || busy) return;
  const current = normalizeSeriesGames(hostNet.getLobbyState().series);
  const index = SERIES_LENGTHS.indexOf(current as (typeof SERIES_LENGTHS)[number]);
  const next = SERIES_LENGTHS[(index + 1) % SERIES_LENGTHS.length];
  hostNet.setSeries(next);
  lobbyState = hostNet.getLobbyState();
  seriesGames = next;
  renderLobby(lobbyState);
  toast(`SERIES // ${next} ${next === 1 ? 'GAME' : 'GAMES'}`);
}

function cycleLobbyMapRule(): void {
  if (mode !== 'host' || !hostNet || busy) return;
  const next = hostNet.getLobbyState().mapRule === 1 ? 0 : 1;
  hostNet.setMapRule(next);
  lobbyState = hostNet.getLobbyState();
  seriesMapRule = next === 1 ? 'fixed' : 'random';
  renderLobby(lobbyState);
  toast(`MAPS // ${seriesMapRule === 'random' ? 'RANDOM' : 'FIXED'}`);
}

/** Host-only room rule. Guests see the label; the host owns the choice. */
function cycleLobbyMode(): void {
  if (mode !== 'host' || !hostNet || busy) return;
  hostNet.setMode(hostNet.getMode() === 1 ? 0 : 1);
  lobbyState = hostNet.getLobbyState();
  renderLobby(lobbyState);
  toast(hostNet.getMode() === 1 ? 'MODE // INFECTION' : 'MODE // VERSUS');
}

// Touch layout and local assists ------------------------------------------------------------

/**
 * The touch layer only exists during a live local/guest game. It is input, not readout
 * UI, so GAME UI and `?ui=0` leave it alone. Menus, overlays, the attract demo and the
 * stress bench hide it, and hiding releases any held touch so a button cannot stick
 * across a screen change.
 */
function syncTouchUi(): void {
  const want =
    touchMode &&
    screen === 'game' &&
    (!!world || !!guestView) &&
    !attract &&
    !stress &&
    overlayKind === 'none' &&
    !loading;
  if (want !== touchVisible) {
    touchVisible = want;
    touchControls.setEnabled(want);
    document.body.classList.toggle('touch-ui', want);
  }
  renderer.touchLayout = want;
}

/**
 * Local input assistance. It writes ordinary lock and attack bits into the local
 * frame, so the host sim and a guest packet see the same input a human produces.
 * Auto-attack never overrides a manual action and never triggers an armed jump-scare.
 */
function applyInputAssist(frame: InputFrame): void {
  if (!autoLock && !autoAttack) return;
  if (screen !== 'game' || loading || overlayKind !== 'none') return;
  const state: RenderState | null = guestView ?? world;
  if (!state) return;
  const p = state.players[localSlot];
  if (!p || !p.active || !p.alive) return;

  if (autoLock || autoAttack) frame.held |= ACTION.LOCK;
  if (!autoAttack || !p.lockActive) return;
  // A held manual attack, guard, skill or dash owns the frame. The shield button is
  // also the melee button, so this is what keeps a raised guard from auto-firing.
  if ((frame.held & (ACTION.SWING | ACTION.BOLT | ACTION.CANDLE | ACTION.DASH)) !== 0) return;
  if (p.swingPhase !== 0 || p.dashT > 0 || p.guardT > 0 || p.guardCd > 0) return;
  if (p.scareT > 0 || p.laserChargeHeld || p.laserT > 0 || p.netDrawing || p.orbitT > 0) return;

  let tx = 0;
  let ty = 0;
  if (world) {
    if (!world.readLockTarget(p)) return;
    tx = world.assistTarget.x;
    ty = world.assistTarget.y;
  } else if (guestView && p.lockKind === 1) {
    // A snapshot only carries players. That is the whole target set online.
    const target = guestView.players[p.lockId];
    if (!target || !target.active || !target.alive) return;
    tx = target.x;
    ty = target.y;
  } else {
    return;
  }

  const dist = Math.hypot(tx - p.x, ty - p.y);
  if (dist <= AUTO_ATTACK.meleeRange) {
    frame.pressed |= ACTION.SWING;
  } else if (dist <= AUTO_ATTACK.rangedRange) {
    frame.held |= ACTION.BOLT;
  }
}

// Campaign debug view ------------------------------------------------------------------------

function activeCount(items: readonly { active: boolean }[] | null | undefined): number {
  if (!items) return 0;
  let count = 0;
  for (let i = 0; i < items.length; i++) if (items[i].active) count++;
  return count;
}

/** The stable subset of live state the campaign QA recorder may read. */
function campaignDebugView(): CampaignDebugView {
  const state = guestView ?? world;
  const campaign = mode === 'campaign' ? PLAYABLE_CAMPAIGN_LEVELS[campaignLevelIndex] ?? null : null;
  const player = state?.players[localSlot] ?? null;
  const warn = mode === 'campaign' && world ? world.campaignWarnStep : null;
  const runner = mode === 'campaign' && world ? world.tutorial : null;
  const step = warn ?? runner?.current ?? null;
  const tutorial = step
    ? {
        speaker: step.speaker,
        line: step.line,
        prompt: step.prompt ?? '',
        stepId: step.id,
        index: warn ? 1 : Math.min(runner!.index + 1, runner!.steps.length),
        total: warn ? 1 : runner!.steps.length,
        warn: !!warn,
        done: runner?.done ?? false,
      }
    : null;
  const counts = {
    players: activeCount(state?.players),
    bots: Math.max(0, activeCount(state?.players) - 1),
    projectiles: activeCount(world?.projectiles),
    worms: activeCount(world?.worms),
    viruses: activeCount(world?.viruses),
    sentries: activeCount(world?.sentries),
    errors: activeCount(world?.errors),
    firewalls: activeCount(world?.firewalls),
    props: activeCount(world?.props),
    pickups: activeCount(world?.pickups),
    fragments: activeCount(world?.fragments),
    barriers: activeCount(world?.barriers),
  };
  return {
    screen,
    mode,
    menuStage,
    overlay: overlayKind,
    loading,
    campaignLevel: campaign ? campaignLevelIndex + 1 : 0,
    campaignLevelName: campaign?.name ?? '',
    campaignNode: campaign?.nodeId ?? '',
    campaignPhase: mode === 'campaign' ? world?.campaignPhase ?? 'none' : 'none',
    phase: state?.phase ?? 'none',
    arenaId: state?.arena.id ?? -1,
    arenaName: state?.arena.name ?? '',
    program: programDef(player?.program ?? selectedProgram).name,
    tutorial,
    player: player
      ? {
          slot: player.slot,
          program: programDef(player.program).name,
          x: Number(player.x.toFixed(1)),
          y: Number(player.y.toFixed(1)),
          facing: Number(player.facing.toFixed(3)),
          hp: Number(player.hp.toFixed(2)),
          maxHp: player.maxHp,
          energy: Number(player.energy.toFixed(1)),
          alive: player.alive,
          active: player.active,
          travelT: Number(player.travelT.toFixed(2)),
          dashCharges: player.dashCharges,
          score: player.score,
        }
      : null,
    counts,
    campaign:
      world && campaign
        ? {
            slot: campaignSlot,
            level: campaignLevelIndex + 1,
            name: campaign.name,
            node: campaign.nodeId,
            phase: world.campaignPhase,
            playSeconds: Number(campaignPlaySeconds.toFixed(1)),
            saved: campaignSaved,
            kills: world.gauntletKills,
            killsToClear: world.campaignKillsToClear,
            exitReady: world.campaignExitReady,
            portalT: Number(world.campaignPortalT.toFixed(2)),
            portalOpen: world.portalOpen,
            calibrationAwake: world.calibrationAwake,
            barsOpen: world.campaignBarsOpen,
            civiliansLost: world.campaignCiviliansLost,
            dataKept: world.dataKept,
            dataTotal: world.dataTotal,
            damage: Number(world.campaignDamage.toFixed(1)),
            wave: world.wave,
            bannerKind: world.campaignBannerKind,
            bannerT: Number(world.campaignBannerT.toFixed(2)),
          }
        : null,
  };
}

// Loop -------------------------------------------------------------------------------------

function loop(now: number): void {
  requestAnimationFrame(loop);
  const rawDt = Math.max(0, (now - lastFrame) / 1000);
  lastFrame = now;
  const dt = Math.min(0.1, rawDt);
  frameMs += ((rawDt * 1000 || 16.7) - frameMs) * 0.08;
  if (rawDt > 0) fps += (1 / rawDt - fps) * 0.05;

  const wasGame = screen === 'game';
  syncTouchUi();
  updateMpStatus(now);
  input.poll();
  pollLocalSetup();
  const menuEdges = input.readMenuEdges();
  if (
    menuEdges.up ||
    menuEdges.down ||
    menuEdges.left ||
    menuEdges.right ||
    menuEdges.confirm ||
    menuEdges.back ||
    menuEdges.menu ||
    menuEdges.ui
  ) {
    noteUserActivity();
  }
  handleGamepad(menuEdges);
  if (screen === 'howto' && now >= howtoDevicePollAt) {
    howtoDevicePollAt = now + 500;
    syncHowToDevice();
  }

  const sampled = input.sample();
  const touchFrame = touchControls.sample();
  const touchMoved = touchControls.isStickActive && (touchFrame.mx !== 0 || touchFrame.my !== 0);
  if (
    sampled.pressed !== 0 ||
    sampled.held !== 0 ||
    sampled.mx !== 0 ||
    sampled.my !== 0 ||
    touchFrame.pressed !== 0 ||
    touchFrame.held !== 0 ||
    touchMoved
  ) {
    noteUserActivity();
  }
  localFrame.mx = sampled.mx;
  localFrame.my = sampled.my;
  localFrame.held = sampled.held;
  localFrame.pressed |= sampled.pressed;
  if (touchVisible && touchControls.isStickActive) {
    localFrame.mx = touchFrame.mx;
    localFrame.my = touchFrame.my;
  }
  if (touchVisible) {
    localFrame.held |= touchFrame.held;
    localFrame.pressed |= touchFrame.pressed;
  }

  // A menu confirm (A) is also the dash button. Drop the first frame after entering
  // a match so selecting a mode never starts with an accidental dash.
  if (screen !== 'game' || !wasGame || overlayKind !== 'none' || loading) {
    localFrame.mx = 0;
    localFrame.my = 0;
    localFrame.held = 0;
    localFrame.pressed = 0;
  }

  updateLoadSequence(now);
  updateIslandHop(now);
  updateRoundHop(now);
  if (screen === 'game' && !loading && overlayKind === 'none') applyInputAssist(localFrame);

  if (screen === 'game' && (world || guestView)) {
    if (!loading) stepSession(now, dt);
    const state: RenderState | null = guestView ?? world;
    if (state) {
      if (guestView) guestView.present();
      trackLocalHit(state);
      syncPhaseUi(state);
      syncTutorialUi();
      fx.update(dt);
      renderer.render(state, Math.min(1, acc / SIM_DT), fx);
      // A split/merge moves every local player's screen position at once. Give the
      // local sim a short dip while the cameras settle, but never slow a networked
      // match or the unattended stress run.
      const localMode =
        mode === 'training' || mode === 'bots' || mode === 'local' || mode === 'gauntlet' || mode === 'campaign';
      if (localMode && !stress) {
        if (renderer.consumeLayoutChange()) slowMoT = CAMERA.layoutSlowTime;
      } else {
        renderer.consumeLayoutChange();
      }
    }
  }

  // Title-screen attract demo: idle on the hub, then a bot-run gauntlet with no UI.
  updateAttract(now);

  // Unattended QA: keep a bot match cycling so rounds cannot park on the result overlay.
  if (autoplay && mode === 'bots' && world && world.phase === 'matchend') {
    if (autoplayRestartAt === 0) autoplayRestartAt = now + 3200;
    else if (now >= autoplayRestartAt) localRematch();
  }

  updatePlaytestAdvance(now);
  sampleSessionPerformance(now);

  updatePerf(dt);
  campaignDebug?.tick(localFrame, fps, frameMs, simMs);
}

function trackLocalHit(state: RenderState): void {
  if (mode === 'local') {
    let anyHit = false;
    for (const slot of localSeats.slots()) {
      const p = state.players[slot];
      if (!p || !p.active) {
        lastLocalSeatHp[slot] = -1;
        continue;
      }
      const prev = lastLocalSeatHp[slot];
      if (prev >= 0 && p.hp < prev) {
        anyHit = true;
        // Venom chips are below half a segment; only a real spent segment thumps.
        if (prev - p.hp >= 0.5) playRumble(p.hp <= 0 ? 'death' : 'hit', slot);
      }
      lastLocalSeatHp[slot] = p.hp;
    }
    if (anyHit) fx.triggerHitRotation();
    return;
  }
  const local = state.players[state.localSlot];
  if (!local || !local.active) {
    lastLocalHp = -1;
    return;
  }
  if (lastLocalHp >= 0 && local.hp < lastLocalHp) {
    fx.triggerHitRotation();
    // Venom chips are below half a segment; only a real spent segment thumps.
    if (lastLocalHp - local.hp >= 0.5) playRumble(local.hp <= 0 ? 'death' : 'hit');
  }
  lastLocalHp = local.hp;
}

/** The body that owns this screen's local camera; guest views carry the same fields. */
function localAvatar(): { x: number; y: number; alive: boolean } | null {
  const state = guestView ?? world;
  if (!state) return null;
  return state.players[localSlot] ?? null;
}

/** Haptics only while a live local match owns the screen. */
function playRumble(cue: RumbleCue, slot = localSlot): void {
  if (attract || stress || screen !== 'game' || overlayKind !== 'none' || loading) return;
  if (mode === 'local') {
    // P1 is the keyboard, so only the pad seats can rumble.
    if (slot > 0) localSeats.rumble(slot, cue);
    return;
  }
  haptics.play(cue);
}

function nearLocalExplosion(x: number, y: number): boolean {
  const local = localAvatar();
  if (!local || !local.alive) return false;
  const dx = x - local.x;
  const dy = y - local.y;
  return dx * dx + dy * dy <= HAPTICS.blastRadius * HAPTICS.blastRadius;
}

function stepSession(now: number, dt: number): void {
  const t0 = performance.now();
  const pausedLocal =
    (mode === 'training' || mode === 'bots' || mode === 'local' || mode === 'gauntlet' || mode === 'campaign') &&
    !stress &&
    overlayKind === 'leave';

  if (mode === 'host' && world && hostNet) {
    hostNet.inputs[0] = localFrame;
    hostNet.expireInputs(now);
    acc += dt;
    let steps = 0;
    while (acc >= SIM_DT && steps < 4) {
      world.step(SIM_DT, hostNet.inputs);
      acc -= SIM_DT;
      steps++;
    }
    if (steps > 0) processWorldEvents(world);
    simMs += (performance.now() - t0 - simMs) * 0.12;

    snapTimer += dt;
    const interval = 1 / NET.snapshotHz;
    if (snapTimer >= interval) {
      hostNet.broadcastSnapshot(world, netCursor);
      netCursor = world.eventCount;
      snapTimer %= interval;
      if (fxCursor === world.eventCount && netCursor === world.eventCount) {
        world.clearEvents();
        fxCursor = 0;
        netCursor = 0;
      }
    }
  } else if ((mode === 'training' || mode === 'gauntlet' || mode === 'campaign') && world && !pausedLocal) {
    if (stress) {
      buildStressInputs();
    } else {
      // Campaign time is live play only; the pause and the result overlay never count.
      if (mode === 'campaign' && overlayKind === 'none') campaignPlaySeconds += dt;
      if (autoplay && botBrains[0]) {
        botBrains[0].think(world, botInputs[0], SIM_DT);
        trainingInputs[0] = botInputs[0];
      } else {
        trainingInputs[0] = localFrame;
      }
      // Training and campaign bots are practice partners, not round opponents. They
      // write the same InputFrame a human does. The drill squad stops thinking once
      // the breach de-rezzes it.
      // Campaign companions stay live through calibration, the breach and the assault.
      // They only stop once the node is cleared or the run has failed.
      const drillLive =
        !world.campaign || (world.campaignPhase !== 'cleared' && world.campaignPhase !== 'failed');
      for (let i = 1; i < botBrains.length; i++) {
        const brain = botBrains[i];
        const frame = trainingInputs[i];
        if (brain && frame && drillLive) brain.think(world, frame, SIM_DT);
      }
    }
    acc += dt * (stress ? 1 : layoutSlowScale(dt));
    let steps = 0;
    while (acc >= SIM_DT && steps < 4) {
      world.step(SIM_DT, stress ? stressInputs : trainingInputs);
      acc -= SIM_DT;
      steps++;
    }
    simMs += (performance.now() - t0 - simMs) * 0.12;
    if (steps > 0) processWorldEvents(world);
    if (fxCursor === world.eventCount) {
      world.clearEvents();
      fxCursor = 0;
    }
  } else if (mode === 'local' && world && !pausedLocal) {
    localSeats.poll();
    const sig = localSeats.signature();
    if (sig !== localSeatSignature) {
      localSeatSignature = sig;
      renderer.setLocalSlots(localSeats.slots());
    }
    localSeats.writeFrames(localFrame, localFrames);
    acc += dt * layoutSlowScale(dt);
    let steps = 0;
    while (acc >= SIM_DT && steps < 4) {
      world.step(SIM_DT, localFrames);
      acc -= SIM_DT;
      steps++;
    }
    simMs += (performance.now() - t0 - simMs) * 0.12;
    if (steps > 0) processWorldEvents(world);
    if (fxCursor === world.eventCount) {
      world.clearEvents();
      fxCursor = 0;
    }
  } else if (mode === 'bots' && world && !pausedLocal) {
    if (autoplay) botBrains[0]?.think(world, botInputs[0], SIM_DT);
    else botInputs[0] = localFrame;
    acc += dt * layoutSlowScale(dt);
    let steps = 0;
    while (acc >= SIM_DT && steps < 4) {
      for (let i = 1; i < botBrains.length; i++) {
        const brain = botBrains[i];
        if (brain) brain.think(world, botInputs[i], SIM_DT);
      }
      world.step(SIM_DT, botInputs);
      acc -= SIM_DT;
      steps++;
    }
    simMs += (performance.now() - t0 - simMs) * 0.12;
    if (steps > 0) processWorldEvents(world);
    if (fxCursor === world.eventCount) {
      world.clearEvents();
      fxCursor = 0;
    }
  } else if (mode === 'guest' && guestNet) {
    acc += dt;
    let steps = 0;
    while (acc >= SIM_DT && steps < 4) {
      if (localFrame.pressed) guestLocalFeedback(localFrame.pressed);
      guestView?.predictStep(localFrame, SIM_DT);
      guestNet.sendInput(localFrame);
      localFrame.pressed = 0;
      acc -= SIM_DT;
      steps++;
    }
    if (steps > 0) simMs += (performance.now() - t0 - simMs) * 0.12;
  } else {
    acc = 0;
  }

  if (!stress) syncCountdownFlash(now);
}

function processWorldEvents(w: World): void {
  for (let i = fxCursor; i < w.eventCount; i++) handleGameEvent(w.events[i], false);
  fxCursor = w.eventCount;
}

function handleGameEvent(e: GameEvent, remote: boolean): void {
  campaignDebug?.event(e, remote);
  if (sessionLog) sessionLog.recordEvent(e);
  if (playtestActive && playtestRound && !remote) recordPlaytestEvent(e);
  fx.handle(e);
  const own = e.slot === localSlot || (mode === 'local' && localSeats.slots().includes(e.slot));
  // Haptics run before the guest's predicted-action sound skip, so a guest still
  // feels their own swing and dash. Hits are read from the local health change.
  if (own) {
    if (e.kind === EV.SWING || e.kind === EV.DASH) {
      playRumble('tap', e.slot);
    } else if (e.kind === EV.DEFLECT) {
      playRumble('guard', e.slot);
    } else if (e.kind === EV.LASER) {
      // An overcharge beam emits a LASER event on every refill tick. Only cue when a
      // new beam starts, not sixteen times a second while the trigger is held.
      const now = performance.now();
      if (now - lastLaserRumbleAt > 400) playRumble('heavy', e.slot);
      lastLaserRumbleAt = now;
    }
  }
  if (remote && own && (e.kind === EV.SHOOT || e.kind === EV.PLANT_MINE || e.kind === EV.SWING || e.kind === EV.DASH)) {
    return;
  }
  switch (e.kind) {
    case EV.SHOOT:
      audio.shootBolt();
      break;
    case EV.PLANT_MINE:
      audio.plantMine();
      break;
    case EV.SWING:
      audio.swing();
      break;
    case EV.DEFLECT:
      audio.deflect(e.power);
      break;
    case EV.SHIELD_WAVE:
      audio.shieldWave();
      break;
    case EV.BOUNCE: {
      const now = performance.now();
      if (now - lastBounceSound > 40) {
        audio.bounce();
        lastBounceSound = now;
      }
      break;
    }
    case EV.EXPLODE:
      audio.explode();
      if (nearLocalExplosion(e.x, e.y)) playRumble('blast');
      break;
    case EV.HIT:
      audio.hit();
      break;
    case EV.DASH:
      audio.dash();
      break;
    case EV.ELIMINATED:
      audio.eliminate();
      break;
    case EV.RESPAWN:
      audio.respawn();
      break;
    case EV.ROUND_START:
      audio.roundStart(e.power);
      break;
    case EV.ROUND_END:
      audio.roundEnd();
      break;
    case EV.MATCH_END:
      audio.victory();
      break;
    case EV.EAT: {
      const now = performance.now();
      if (now - lastThreatSound > 70) {
        lastThreatSound = now;
        audio.bounce();
      }
      break;
    }
    case EV.INFECT:
      audio.hit();
      break;
    case EV.FIREWALL:
      audio.dash();
      break;
    case EV.PUSHER:
      // The compactor: a heavy low hit, not the full explosion cue.
      audio.explode();
      break;
    case EV.TIME_WARP:
      audio.shieldWave();
      break;
    case EV.THRALL:
      audio.eliminate();
      break;
    case EV.MEGA_CRY:
      audio.megaCry();
      if (nearLocalExplosion(e.x, e.y)) playRumble('heavy');
      break;
    case EV.WORM_HIT:
    case EV.VIRUS_HIT:
    case EV.SENTRY_HIT: {
      const now = performance.now();
      if (now - lastThreatSound > 55) {
        lastThreatSound = now;
        audio.hit();
      }
      break;
    }
    case EV.MEGA_HIT: {
      const now = performance.now();
      if (now - lastThreatSound > 45) {
        lastThreatSound = now;
        audio.hit();
      }
      break;
    }
    case EV.PORTAL_BREAK:
      audio.eliminate();
      break;
    case EV.SENTRY_KILL:
    case EV.WORM_KILL:
    case EV.VIRUS_KILL:
      audio.explode();
      break;
    case EV.SENTRY_SHOOT: {
      const now = performance.now();
      if (now - lastThreatSound > 90) {
        lastThreatSound = now;
        audio.shootBolt();
      }
      break;
    }
    case EV.POWERUP:
      audio.pickup(e.power);
      break;
    case EV.HEAL:
      audio.heal();
      break;
    case EV.VIRUS_SPLIT:
      break;
    case EV.DRONE_SHOOT:
      break;
    default:
      break;
  }
}

function guestLocalFeedback(pressed: number): void {
  if (!guestView?.predictor.p.alive) return;
  if (pressed & ACTION.DASH) audio.dash();
  if (pressed & ACTION.SWING) audio.swing();
  if (pressed & ACTION.BOLT) audio.shootBolt();
  if (pressed & ACTION.CANDLE) audio.plantMine();
}

// Sessions ----------------------------------------------------------------------------------

/** Local bots take the programs the human did not pick, repeating if there are more bots. */
function botProgramList(count: number): number[] {
  const unused: number[] = [];
  for (let i = 0; i < PROGRAMS.length; i++) {
    if (PROGRAMS[i].id !== selectedProgram) unused.push(PROGRAMS[i].id);
  }
  const list: number[] = [];
  for (let slot = 1; slot <= count; slot++) {
    list[slot] = unused.length > 0 ? unused[(slot - 1) % unused.length] : PROGRAM_ID.PROBE;
  }
  return list;
}

// Session feedback ---------------------------------------------------------------------------

function sessionMode(): 'training' | 'bots' | 'local' | 'gauntlet' | 'infection' | 'campaign' | 'host' | 'guest' {
  if (mode === 'none') return 'training';
  if (mode === 'gauntlet') return infectionRun ? 'infection' : 'gauntlet';
  return mode;
}

/** Slots occupied by a human. Online rooms are all human; local runs use the couch seats. */
function sessionHumanSlots(): number[] {
  if (mode === 'local') return localSeats.slots();
  if (mode === 'host') {
    const slots: number[] = [];
    if (lobbyState) {
      for (let i = 0; i < lobbyState.players.length; i++) {
        const p = lobbyState.players[i];
        if (p.connected) slots.push(p.slot);
      }
    }
    return slots.length > 0 ? slots : [0];
  }
  if (mode === 'guest') {
    const slots: number[] = [];
    if (guestView) {
      for (let i = 0; i < guestView.names.length; i++) if (guestView.names[i]) slots.push(i);
    }
    return slots.length > 0 ? slots : [localSlot];
  }
  return [localSlot];
}

function sessionBotCount(): number {
  if (!world) return 0;
  const humans = sessionHumanSlots();
  let bots = 0;
  for (let i = 0; i < world.players.length; i++) {
    const p = world.players[i];
    if (p.active && !humans.includes(p.slot)) bots++;
  }
  return bots;
}

function sessionSeeds(): SessionPlayerSeed[] {
  const humans = sessionHumanSlots();
  const seen = new Set<number>();
  const seeds: SessionPlayerSeed[] = [];
  const add = (slot: number, program: string, human: boolean): void => {
    if (slot < 0 || slot >= MAX_PLAYERS || seen.has(slot)) return;
    seen.add(slot);
    seeds.push({ slot, program, human });
  };
  const state = guestView ?? world;
  if (state) {
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (p.active) add(p.slot, programDef(p.program).name, humans.includes(p.slot));
    }
  }
  // A guest starts with an empty view until the first snapshot. Seed the lobby roster now;
  // the next sync fills in the real slot/program data.
  for (let i = 0; i < humans.length; i++) add(humans[i], programDef(selectedProgram).name, true);
  return seeds;
}

function sessionProgramName(): string {
  const state = guestView ?? world;
  const local = state?.players[localSlot];
  return programDef(local?.program ?? selectedProgram).name;
}

/** Start a normal-play report. QA stress/demo runs never create one. */
function beginSessionLog(): void {
  const state = guestView ?? world;
  if (!state || attract || demo || stress) {
    sessionLog = null;
    return;
  }
  const humanPlayers = sessionHumanSlots().length;
  const bots = sessionBotCount();
  const series =
    mode === 'bots' || mode === 'host'
      ? seriesRun
        ? { game: seriesGame, total: seriesGames, mapRule: seriesMapRule }
        : null
      : mode === 'guest' && guestSeriesTotal > 1
        ? { game: guestSeriesGame, total: guestSeriesTotal, mapRule: 'host' }
        : null;
  const campaign = mode === 'campaign' ? PLAYABLE_CAMPAIGN_LEVELS[campaignLevelIndex] : null;
  sessionLog = new SessionTracker(
    BUILD,
    {
      mode: sessionMode(),
      arenaId: state.arena.id,
      arenaName: state.arena.name,
      program: sessionProgramName(),
      localSlot,
      humanPlayers,
      bots,
      botTier: bots > 0 ? BOT_TIER_LABELS[mode === 'campaign' ? botTierPrefs.training : botTier] : null,
      friendlyFire: mode === 'gauntlet' || mode === 'campaign' ? (infectionRun ? false : friendlyFire) : infectionRun ? false : null,
      autoLock,
      autoAttack,
      touch: touchMode,
      online: mode === 'host' || mode === 'guest',
      infection: infectionRun,
      series,
      campaign: campaign
        ? { slot: campaignSlot, level: campaignLevelIndex + 1, node: campaign.name }
        : null,
    },
    sessionSeeds(),
  );
  sessionLog.sample(fps, frameMs, simMs);
  sessionPerfAt = performance.now() + 1000;
}

function sessionResult(outcome: SessionOutcome, details: Partial<SessionResult> = {}): SessionResult {
  return {
    outcome,
    winnerSlot: null,
    matchWinner: null,
    seriesGame: null,
    seriesTotal: null,
    wave: null,
    kills: null,
    seconds: null,
    score: null,
    cleared: null,
    ...details,
  };
}

function sessionEnvironment(): SessionEnvironment {
  return {
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    dpr: Number((window.devicePixelRatio || 1).toFixed(2)),
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    touch: touchMode,
    reducedMotion:
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

function syncSessionPlayers(state: RenderState): void {
  if (!sessionLog) return;
  const rows: { slot: number; active: boolean; program: string; score: number }[] = [];
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (p.active) rows.push({ slot: p.slot, active: true, program: programDef(p.program).name, score: p.score });
  }
  sessionLog.syncPlayers(rows);
}

function buildSessionReport(result: SessionResult): SessionReport | null {
  if (!sessionLog) return null;
  const state = guestView ?? world;
  if (state) syncSessionPlayers(state);
  return sessionLog.build(result, sessionEnvironment());
}

function downloadSessionReport(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareSessionFeedback(result: SessionResult): Promise<void> {
  const report = buildSessionReport(result);
  if (!report) {
    toast('NO SESSION DATA TO SHARE', 'warn');
    return;
  }
  const json = JSON.stringify(report, null, 2);
  const text = sessionShareText(report);
  const fileName = `deflect-session-${report.build}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

  let file: File | null = null;
  try {
    file = new File([json], fileName, { type: 'application/json' });
  } catch {
    // File/Web Share is not available in every browser; fall through to a download.
  }
  if (file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'DEFLECT session feedback', text, files: [file] });
        toast('SESSION FEEDBACK SHARED');
        return;
      }
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return;
    }
  }

  downloadSessionReport(json, fileName);
  let copied = false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      // A blocked clipboard still leaves the downloaded JSON.
    }
  }
  toast(copied ? 'REPORT DOWNLOADED // SUMMARY COPIED' : 'SESSION REPORT DOWNLOADED', 'warn');
}

function sessionShareAction(result: SessionResult): OverlayAction | null {
  if (!sessionLog) return null;
  return { label: 'SHARE FEEDBACK', onClick: () => void shareSessionFeedback(result) };
}

function withSessionShare(actions: OverlayAction[], result: SessionResult): OverlayAction[] {
  const share = sessionShareAction(result);
  if (share) actions.push(share);
  return actions;
}

/** Record one match round. Runs only on a render frame; training/gauntlet runs use summary totals. */
function syncSessionRound(state: RenderState): void {
  if (!sessionLog || state.mode !== 'match') return;
  syncSessionPlayers(state);
  if (state.phase === 'live') {
    sessionLog.beginRound(
      state.arena.id,
      state.arena.name,
      state.round,
      world ? readPlaytestDeflect(world) : emptyDeflect(),
    );
  } else if (state.phase === 'roundover') {
    sessionLog.finishRound(
      Math.max(0, ROUND.timeLimit - state.roundTimer),
      state.roundWinner,
      state.matchWinner,
      world ? readPlaytestDeflect(world) : emptyDeflect(),
      fps,
      simMs,
    );
  }
}

function sampleSessionPerformance(now: number): void {
  if (!sessionLog || screen !== 'game' || loading || overlayKind !== 'none') return;
  if (now < sessionPerfAt) return;
  sessionPerfAt = now + 1000;
  sessionLog.sample(fps, frameMs, simMs);
}

/** Local couch setup: reset the seats and adopt whatever is already plugged in. */
function openLocalSetup(): void {
  localSeats.reset();
  localSeats.poll();
  localSeatSignature = localSeats.signature();
  input.keyboardOnly = false;
  renderLocalArenaPicker();
  renderLocalSeats();
}

/** Seat rows plus the start gate. Rebuilt only when the seat signature changes. */
function renderLocalSeats(): void {
  clearChildren(localSeatsEl);
  const row = (key: string, label: string, value: string, ready: boolean): void => {
    const line = document.createElement('div');
    line.className = `local-seat${ready ? ' ready' : ''}`;
    const k = document.createElement('span');
    k.className = 'local-seat-key';
    k.textContent = key;
    const l = document.createElement('span');
    l.className = 'local-seat-label';
    l.textContent = label;
    const v = document.createElement('b');
    v.textContent = value;
    line.append(k, l, v);
    localSeatsEl.appendChild(line);
  };
  row('P1', 'KEYBOARD + MOUSE', 'READY', true);
  for (const seat of localSeats.seats) {
    row(
      `P${seat.slot + 1}`,
      seat.connected ? seat.padName : 'CONTROLLER DISCONNECTED',
      seat.connected ? 'READY' : 'RECONNECT',
      seat.connected,
    );
  }
  for (const slot of localSeats.freeSlots()) {
    row(`P${slot + 1}`, 'OPEN SLOT', 'DROP IN WITH A PAD', false);
  }
  const players = localSeats.activeCount();
  localStartBtn.disabled = players < 2 || busy;
  const startValue = localStartBtn.querySelector('.option-value');
  if (startValue) startValue.textContent = localBossRush ? 'BOSS RUSH' : 'FIRST TO 3';
  localRushBtn.setAttribute('aria-pressed', String(localBossRush));
  localRushValue.textContent = localBossRush ? 'ON' : 'OFF';
  localStatusLine.textContent =
    players < 2
      ? 'CONNECT A CONTROLLER TO JOIN // P1 IS KEYBOARD + MOUSE'
      : localBossRush
        ? `${players} PLAYERS READY // BOSS LADDER, NO FODDER`
        : `${players} PLAYERS READY // DROP IN ANY TIME DURING THE MATCH`;
}

function renderLocalArenaPicker(): void {
  clearChildren(localArenaPickerEl);
  for (let i = 0; i < ARENAS.length; i++) {
    const option = ARENAS[i];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `console-arena-card${i === arenaIndex ? ' selected' : ''}`;
    card.dataset.nav = '';
    card.title = option.tagline;
    card.setAttribute('aria-pressed', String(i === arenaIndex));
    card.setAttribute('aria-label', `${option.name}. ${option.tagline}`);
    const preview = document.createElement('canvas');
    preview.width = 240;
    preview.height = 120;
    preview.setAttribute('aria-hidden', 'true');
    drawArenaPreview(preview, option);
    const label = document.createElement('span');
    label.className = 'console-arena-label';
    label.textContent = `${String(i + 1).padStart(2, '0')}  ${option.name}`;
    card.append(preview, label);
    card.addEventListener('click', () => {
      selectArena(i);
      if (menuStage === 'local' && screen === 'title') renderLocalArenaPicker();
    });
    localArenaPickerEl.appendChild(card);
  }
}

/** A controller plugged in while this stage is open appears without a refresh. */
function pollLocalSetup(): void {
  if (screen !== 'title' || menuStage !== 'local') return;
  localSeats.poll();
  const sig = localSeats.signature();
  if (sig === localSeatSignature) return;
  localSeatSignature = sig;
  renderLocalSeats();
}

/** Drop-in: a pad adopted mid-match activates its body in the live world. */
function handleLocalJoin(seat: LocalSeat): void {
  if (mode !== 'local' || !world) return;
  if (world.joinLocalPlayer(seat.slot, seat.name)) {
    renderer.setLocalSlots(localSeats.slots());
    localSeatSignature = localSeats.signature();
    toast(`${seat.name} JOINED // ${seat.padName}`, 'warn');
  }
}

function startLocalMatch(): void {
  if (busy) return;
  localSeats.poll();
  if (localSeats.activeCount() < 2) {
    localStatusLine.textContent = 'NEED ONE CONTROLLER // P1 IS KEYBOARD + MOUSE';
    return;
  }
  teardownSession();
  hideOverlayInternal();
  mode = 'local';
  localSlot = 0;
  stress = false;
  autoplay = false;
  const arena = getArena(arenaIndex);
  const names = new Array(MAX_PLAYERS).fill('');
  names[0] = getCallsign();
  for (const seat of localSeats.seats) names[seat.slot] = seat.name;
  // Slots 1-3 keep a distinct unused kit, so a pad that joins mid-match still has one.
  const programs = botProgramList(localSeats.maxSeats - 1);
  world = new World('match', names, 0, arena, false, selectedProgram, 0, programs);
  botInputs = [];
  botBrains = [];
  localSeats.writeFrames(localFrame, localFrames);
  trainingInputs = localFrames;
  input.keyboardOnly = true;
  localSeatSignature = localSeats.signature();
  renderer.setLocalSlots(localSeats.slots());
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(arena.name);
  audio.unlock();
  audio.startMusic();
  beginSessionLog();
  console.log(
    '[DEFLECT-STATE] Local match',
    localSeats.activeCount(),
    'players',
    arena.name,
    localSeats.seats.map((s) => s.name).join('/'),
  );
}

/**
 * BOSS RUSH, local co-op: the same ladder on the gauntlet simulation, with every
 * seated player active. It is not a networked mode; mini-boss bodies are not in
 * `Snapshot`, so online rooms stay versus-only.
 */
function startLocalBossRush(): void {
  if (busy) return;
  localSeats.poll();
  if (localSeats.activeCount() < 2) {
    localStatusLine.textContent = 'NEED ONE CONTROLLER // P1 IS KEYBOARD + MOUSE';
    return;
  }
  teardownSession();
  hideOverlayInternal();
  mode = 'local';
  localSlot = 0;
  stress = false;
  autoplay = false;
  const arena = getArena(arenaIndex);
  const names = new Array(MAX_PLAYERS).fill('');
  names[0] = getCallsign();
  for (const seat of localSeats.seats) names[seat.slot] = seat.name;
  const programs = botProgramList(localSeats.maxSeats - 1);
  world = new World(
    'gauntlet',
    names,
    0,
    arena,
    false,
    selectedProgram,
    0,
    programs,
    false,
    null,
    false,
    'none',
    0,
    true,
  );
  world.friendlyFire = friendlyFire;
  botInputs = [];
  botBrains = [];
  localSeats.writeFrames(localFrame, localFrames);
  trainingInputs = localFrames;
  input.keyboardOnly = true;
  localSeatSignature = localSeats.signature();
  renderer.setLocalSlots(localSeats.slots());
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(`BOSS RUSH // ${arena.name}`);
  audio.unlock();
  audio.startMusic();
  beginSessionLog();
  console.log('[DEFLECT-STATE] Local boss rush', localSeats.activeCount(), 'players', arena.name);
}

function startTraining(): void {
  if (busy) return;
  teardownSession();
  mode = 'training';
  localSlot = 0;
  const arena = getArena(arenaIndex);
  world = new World('training', [getCallsign()], 0, arena, false, selectedProgram);
  trainingInputs = [localFrame];
  stress = false;
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(arena.name);
  audio.unlock();
  audio.startMusic();
  beginSessionLog();
  console.log('[DEFLECT-STATE] Training start', arena.name);
}

function startTrainingBots(): void {
  if (busy) return;
  teardownSession();
  mode = 'training';
  localSlot = 0;
  stress = false;
  const arena = getArena(arenaIndex);
  const names = new Array(MAX_PLAYERS).fill('');
  names[0] = getCallsign();
  for (let i = 1; i <= botCount; i++) names[i] = BOT_NAMES[(i - 1) % BOT_NAMES.length];
  const botPrograms = botProgramList(botCount);
  world = new World('training', names, 0, arena, false, selectedProgram, botCount, botPrograms);
  botInputs = new Array(MAX_PLAYERS);
  for (let i = 0; i < MAX_PLAYERS; i++) botInputs[i] = { mx: 0, my: 0, held: 0, pressed: 0 };
  botBrains = new Array(MAX_PLAYERS).fill(null);
  for (let i = 1; i <= botCount; i++) {
    botBrains[i] = new BotBrain(i, botTier, i - 1, 0x51f15e + arena.id * 997 + i * 131);
  }
  botInputs[0] = localFrame;
  trainingInputs = botInputs;
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(arena.name);
  audio.unlock();
  audio.startMusic();
  beginSessionLog();
  console.log('[DEFLECT-STATE] Training bots', botCount, botTier, arena.name);
}

function startGauntlet(aiLocal = false): void {
  if (busy) return;
  teardownSession();
  hideOverlayInternal();
  mode = 'gauntlet';
  infectionRun = false;
  localSlot = 0;
  stress = false;
  autoplay = aiLocal;
  const arena = getArena(arenaIndex);
  world = new World(
    'gauntlet',
    [getCallsign()],
    0,
    arena,
    false,
    selectedProgram,
    0,
    null,
    false,
    null,
    false,
    'none',
    0,
    bossRush,
  );
  world.friendlyFire = friendlyFire;
  if (megaBoot || handsBoot || starfishBoot || blobBoot || stormBoot) {
    const lead = world.players[0];
    if (megaBoot) world.spawnMiniboss(MINIBOSS.MEGA_WORM, lead.x + 380, lead.y - 90);
    if (handsBoot) world.spawnMiniboss(MINIBOSS.IDLE_HANDS, lead.x + 380, lead.y - 90);
    if (starfishBoot) world.spawnMiniboss(MINIBOSS.STARFISH, lead.x + 380, lead.y - 90);
    if (blobBoot) world.spawnMiniboss(MINIBOSS.BLOB, lead.x + 380, lead.y - 90);
    if (stormBoot) world.spawnMiniboss(MINIBOSS.STORM_CLOUD, lead.x + 300, lead.y - 260);
  }
  trainingInputs = [localFrame];
  botInputs = new Array(MAX_PLAYERS);
  for (let i = 0; i < MAX_PLAYERS; i++) botInputs[i] = { mx: 0, my: 0, held: 0, pressed: 0 };
  botBrains = new Array(MAX_PLAYERS).fill(null);
  if (aiLocal) {
    botBrains[0] = new BotBrain(0, botTierPrefs.training, 0, 0x51f15e + arena.id * 983 + 29);
  }
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(arena.name);
  audio.unlock();
  audio.startMusic();
  beginSessionLog();
  console.log('[DEFLECT-STATE] Gauntlet start', arena.name, 'one life', aiLocal ? 'AUTOPILOT' : '', 'friendly fire', friendlyFire ? 'on' : 'off');
}

/**
 * INFECTION: a timed clean sweep on the gauntlet simulation. Operators launch from the
 * left while the colony streams in from the right; the clear meter and clock are the
 * whole read. Friendly fire is off so the swarm cannot thin itself out for a cheap time.
 */
function startInfection(aiLocal = false): void {
  if (busy) return;
  teardownSession();
  hideOverlayInternal();
  mode = 'gauntlet';
  infectionRun = true;
  localSlot = 0;
  stress = false;
  autoplay = aiLocal;
  const arena = getArena(arenaIndex);
  world = new World('gauntlet', [getCallsign()], 0, arena, false, selectedProgram, 0, null, false, null, true);
  world.friendlyFire = false;
  trainingInputs = [localFrame];
  botInputs = new Array(MAX_PLAYERS);
  for (let i = 0; i < MAX_PLAYERS; i++) botInputs[i] = { mx: 0, my: 0, held: 0, pressed: 0 };
  botBrains = new Array(MAX_PLAYERS).fill(null);
  if (aiLocal) {
    botBrains[0] = new BotBrain(0, botTierPrefs.training, 0, 0x51f15e + arena.id * 983 + 29);
  }
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(`INFECTION // ${arena.name}`);
  audio.unlock();
  audio.startMusic();
  beginSessionLog();
  console.log('[DEFLECT-STATE] Infection start', arena.name, aiLocal ? 'AUTOPILOT' : '');
}

/** Timestamp for the title idle clock. Any device counts. */
function noteUserActivity(): void {
  lastUserInputAt = performance.now();
}

/** Hover only restarts the idle clock; it never wakes a running demo. */
function noteIdleMovement(): void {
  if (!attract) lastUserInputAt = performance.now();
}

/**
 * `?demo=true`: a permanent, non-interactive attract loop for a display or a
 * capture. It reuses the attract pilot, refill and restart path; the only
 * differences are that no wake input ends it and the DEFLECT_ wordmark fades on
 * a 60 s cycle. This is a boot mode, not a pause or a menu state.
 */
function startDemo(): void {
  if (busy) return;
  demo = true;
  document.body.classList.add('demo');
  startAttract();
  if (!attract) {
    demo = false;
    document.body.classList.remove('demo');
    return;
  }
  demoTitle.hidden = false;
  // Restart the CSS cycle from frame zero on a fresh page boot.
  demoTitle.classList.remove('live');
  void demoTitle.offsetWidth;
  demoTitle.classList.add('live');
  console.log('[DEFLECT-DEMO] Kiosk loop active');
}

/**
 * Title-screen demo: a bot-run gauntlet several waves deep on a random program and
 * arena, with the canvas UI off. It is not a scored run, never records a result, and
 * any real input ends it. See ATTRACT in config.ts. `?demo=true` runs the same
 * pilot for good; see startDemo.
 */
function startAttract(): void {
  if (busy) return;
  attract = true;
  attractStartedAt = performance.now();
  attractRestartAt = 0;
  attractBossAlive = false;
  teardownSession();
  hideOverlayInternal();
  mode = 'gauntlet';
  localSlot = 0;
  stress = false;
  // The demo is unattended: the gauntlet step path reads `autoplay` to let every local
  // slot be driven by its BotBrain. The bots-mode rematch hook only fires in `mode === 'bots'`.
  autoplay = true;
  // Cycle the squad size so a kiosk loop shows a solo run, a duo and a trio. Three is
  // the crowded showcase, so it stays on compact solid arenas where the group fits one
  // pane without the camera splitting.
  const sizes = ATTRACT.squadSizes.length > 0 ? ATTRACT.squadSizes : [1];
  const squad = Math.max(1, Math.min(3, sizes[attractSquadIndex % sizes.length]));
  attractSquadIndex++;
  // Ordinary attract and the `?demo=1` kiosk show plain bot-vs-bot arena runs. Bosses are
  // deliberately out of the demo: an unfinished boss showcase reads worse than clean arena
  // play, and boss review comes back once the campaign is playing well. `?boss=1` remains
  // the explicit QA fast-forward for judging one boss on its own.
  const bossSession = bossDemo;
  attractSessionIndex++;
  const bossKind = bossSession ? ATTRACT_BOSSES[attractBossIndex++ % ATTRACT_BOSSES.length] : null;
  // Campaign arenas and tutorial room layouts are out of the demo too. They carry scripted
  // ingress, rooms and per-level dressing that only reads correctly inside a level, so the
  // kiosk stays on the standalone arenas and their independent versions.
  const campaignArenas = new Set(PLAYABLE_CAMPAIGN_LEVELS.map((l) => String(l.arenaId)));
  const arenaPool = ARENAS.filter((a) => {
    if (a.qa) return false;
    if (a.ingress || a.rooms) return false;
    if (campaignArenas.has(String(a.id)) || campaignArenas.has(a.name)) return false;
    const width = a.bounds.right - a.bounds.left;
    // Three local pilots need one camera pane, and a boss needs room for its silhouette.
    if (squad >= 3 && (a.walls === 'open' || width > ATTRACT.wideSquadArenaMax)) return false;
    if (bossSession && width < 1500) return false;
    return true;
  });
  // The boss-review boot holds every showcase on the QA test range: one huge open floor
  // with no cover, so boss movement, scale and the camera pull are judged on their own.
  // Ordinary attract and `?demo=1` keep the normal arena pool.
  const qaArena = bossDemo ? ARENAS.find((a) => a.qa) : undefined;
  const arena = qaArena ?? arenaPool[Math.floor(Math.random() * arenaPool.length)];
  const programPool = [...PROGRAMS];
  for (let i = programPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [programPool[i], programPool[j]] = [programPool[j], programPool[i]];
  }
  const programs = programPool.slice(0, squad).map((p) => p.id);
  const names = ['DEMO', 'LINK', 'RELAY'].slice(0, squad);
  world = new World('gauntlet', names, 0, arena, false, programs[0], 0, programs);
  world.seedAttractSquad(squad);
  world.seedAttractRun(bossKind === null ? ATTRACT.wave : ATTRACT.bossWave);
  if (bossKind !== null) {
    // Land the boss across the room from the squad, clamped inside the floor. The spawn
    // path still owns boss edge padding and the arrival portal.
    const b = arena.bounds;
    const lead = world.players[0];
    const side = lead.x < (b.left + b.right) / 2 ? 1 : -1;
    const bx = Math.max(b.left + 240, Math.min(b.right - 240, lead.x + side * (b.right - b.left) * 0.34));
    const by = Math.max(b.top + 200, Math.min(b.bottom - 200, lead.y - 120));
    world.spawnMiniboss(bossKind, bx, by);
    attractBossAlive = true;
  }
  botInputs = new Array(MAX_PLAYERS);
  for (let i = 0; i < MAX_PLAYERS; i++) botInputs[i] = { mx: 0, my: 0, held: 0, pressed: 0 };
  trainingInputs = botInputs;
  botBrains = new Array(MAX_PLAYERS).fill(null);
  for (let i = 0; i < squad; i++) {
    botBrains[i] = new BotBrain(i, 'digital', i, 0x51f15e + arena.id * 967 + i * 131);
  }
  const localSlots: number[] = [];
  for (let i = 0; i < squad; i++) localSlots.push(i);
  renderer.setLocalSlots(localSlots);
  resetCounters();
  fx.reset();
  renderer.showUi = false;
  setScreen('game');
  audio.unlock();
  audio.startMusic();
  console.log(
    '[DEFLECT-ATTRACT]',
    `${squad}P`,
    programs.map((p) => programDef(p).name).join(' / '),
    arena.name,
    bossKind === null ? 'wave' : bossDemo ? 'BOSS DEMO' : 'BOSS',
    bossKind === null ? ATTRACT.wave : MINIBOSSES.find((boss) => boss.id === bossKind)?.label ?? bossKind,
  );
}

function exitAttract(): void {
  if (!attract || demo) return;
  attract = false;
  attractRestartAt = 0;
  teardownSession();
  renderer.setLocalSlots([0]);
  renderer.showUi = uiEnabled;
  showMenuStage('hub');
  setScreen('title');
  busy = false;
  refreshTitleButtons();
  setTitleStatus('');
  lastUserInputAt = performance.now();
  console.log('[DEFLECT-ATTRACT] exit');
}

/**
 * Runs every frame. On the hub it arms the idle clock; during the demo it ends on the
 * first new input and restarts a fresh run when the bot's ring breaks.
 */
function updateAttract(now: number): void {
  if (attract) {
    if (!demo && lastUserInputAt > attractStartedAt) {
      exitAttract();
      return;
    }
    // A showcase ends with its boss, not with a long cleanup. Otherwise the kiosk
    // spends most of a boss session on an empty wave after the boss is already dead.
    if (world && attractBossAlive && !world.minibossAlive()) {
      attractBossAlive = false;
      attractRestartAt = now + ATTRACT.restart * 1000;
    }
    if (world && (world.gauntletOver || attractRestartAt !== 0)) {
      if (attractRestartAt === 0) attractRestartAt = now + ATTRACT.restart * 1000;
      else if (now >= attractRestartAt) {
        // startAttract guards on its own state; clear it so the restart is allowed.
        attract = false;
        startAttract();
      }
    }
    return;
  }
  if (demo) return;
  if (screen !== 'title' || busy || loading) return;
  if (now - lastUserInputAt >= ATTRACT.idle * 1000) startAttract();
}

function startAutoplay(count: number): void {
  if (busy) return;
  soloProgram = 'bots';
  botTier = botTierPrefs.bots;
  botCount = Math.max(1, Math.min(MAX_PLAYERS - 1, Math.floor(count)));
  startBotMatch(true);
  toast(`AUTOPLAY // ${botCount + 1} OPERATORS`);
}

// Playtest tour ------------------------------------------------------------------------------

/**
 * QA-only local playtest. `?playtest=1` starts a VS BOTS match, keeps each arena for
 * three completed rounds, then advances through the whole arena list. Every round is
 * logged to the console and localStorage; the completion panel downloads or copies the
 * JSON session. No network, no token, and no Snapshot fields are involved.
 */
function startPlaytest(): void {
  if (busy) return;
  playtestActive = true;
  playtestComplete = false;
  playtestMaps = [];
  playtestRound = null;
  playtestMapIndex = 0;
  playtestRoundsOnMap = 0;
  playtestAdvanceAt = 0;
  playtestStartedAt = new Date().toISOString();
  playtestFinishedAt = null;
  playtestProgramId = selectedProgram;
  playtestBotTier = botTierPrefs.bots;
  playtestBotCount = 3;
  botCount = playtestBotCount;
  botTier = playtestBotTier;
  console.info('[PLAYTEST] START', {
    build: BUILD,
    program: programDef(playtestProgramId).name,
    botTier: BOT_TIER_LABELS[playtestBotTier],
    botCount: playtestBotCount,
    roundsPerMap: PLAYTEST_ROUNDS_PER_MAP,
    maps: ARENAS.map((arena) => arena.name),
  });
  beginPlaytestMap(0);
}

function beginPlaytestMap(index: number): void {
  if (!playtestActive || playtestComplete) return;
  if (index < 0 || index >= ARENAS.length) {
    completePlaytest();
    return;
  }
  const arena = ARENAS[index];
  playtestMapIndex = index;
  playtestRoundsOnMap = 0;
  playtestRound = null;
  playtestAdvanceAt = 0;
  arenaIndex = arena.id;
  if (!playtestMaps[index]) {
    playtestMaps[index] = { arenaId: arena.id, arenaName: arena.name, rounds: [] };
  }
  startBotMatch(false);
  // The next world starts in countdown; clear the overlay/history latches so the
  // first live frame is not mistaken for the previous round.
  lastPhase = '';
  lastRound = -1;
  lastRoundWinner = -2;
  lastMatchWinner = -2;
  goUntil = 0;
  console.info(`[PLAYTEST] MAP ${index + 1}/${ARENAS.length} ${arena.name}`);
  toast(`PLAYTEST ${index + 1}/${ARENAS.length} // ${arena.name}`, 'warn');
}

function emptyPlaytestDeflect(): PlaytestDeflectLog {
  return { guard: 0, swing: 0, beam: 0, atom: 0, net: 0, arm: 0, plow: 0, broom: 0, wave: 0 };
}

function readPlaytestDeflect(w: World): PlaytestDeflectLog {
  const telemetry = w.deflectTelemetry;
  const sum = (values: Uint16Array): number => {
    let total = 0;
    for (let i = 0; i < values.length; i++) total += values[i];
    return total;
  };
  return {
    guard: sum(telemetry.guard),
    swing: sum(telemetry.swing),
    beam: sum(telemetry.beam),
    atom: sum(telemetry.atom),
    net: sum(telemetry.net),
    arm: sum(telemetry.arm),
    plow: sum(telemetry.plow),
    broom: sum(telemetry.broom),
    wave: sum(telemetry.wave),
  };
}

function diffPlaytestDeflect(now: PlaytestDeflectLog, base: PlaytestDeflectLog): PlaytestDeflectLog {
  return {
    guard: now.guard - base.guard,
    swing: now.swing - base.swing,
    beam: now.beam - base.beam,
    atom: now.atom - base.atom,
    net: now.net - base.net,
    arm: now.arm - base.arm,
    plow: now.plow - base.plow,
    broom: now.broom - base.broom,
    wave: now.wave - base.wave,
  };
}

function beginPlaytestRound(): void {
  if (!playtestActive || playtestComplete || playtestRound || !world) return;
  const w = world;
  const players: PlaytestPlayerLog[] = [];
  for (let i = 0; i < w.players.length; i++) {
    const p = w.players[i];
    if (!p.active) continue;
    players.push({
      slot: p.slot,
      name: p.name || `SLOT ${p.slot + 1}`,
      program: programDef(p.program).name,
      hp: p.hp,
      maxHp: p.maxHp,
      score: p.score,
      shots: 0,
      dashes: 0,
      swings: 0,
      deflects: 0,
      skills: 0,
      heavies: 0,
      hits: 0,
      damage: 0,
      kills: 0,
      deaths: 0,
    });
  }
  playtestRound = {
    log: {
      arenaId: w.arena.id,
      arenaName: w.arena.name,
      round: w.round,
      duration: 0,
      winner: -1,
      winnerName: '',
      matchWinner: -1,
      players,
      deflect: emptyPlaytestDeflect(),
      fps: 0,
      simMs: 0,
    },
    deflectBase: readPlaytestDeflect(w),
  };
}

function recordPlaytestEvent(e: GameEvent): void {
  const draft = playtestRound;
  if (!draft) return;
  const stats = draft.log.players.find((p) => p.slot === e.slot);
  if (stats) {
    switch (e.kind) {
      case EV.SHOOT:
        stats.shots++;
        break;
      case EV.DASH:
        stats.dashes++;
        break;
      case EV.SWING:
        stats.swings++;
        break;
      case EV.DEFLECT:
        stats.deflects++;
        break;
      case EV.BUG:
        // Probe's armed mine reports a trigger with power 4; that is not a cast.
        if (e.power !== 4) stats.skills++;
        break;
      case EV.LASER:
        stats.heavies++;
        break;
      case EV.HIT:
        stats.hits++;
        stats.damage += e.power;
        break;
    }
  }
  if (e.kind === EV.ELIMINATED && e.power >= 0) {
    const victim = draft.log.players.find((p) => p.slot === e.power);
    if (victim) victim.deaths++;
    if (stats && e.slot !== e.power) stats.kills++;
  }
}

function finishPlaytestRound(): void {
  const draft = playtestRound;
  if (!draft || !world) return;
  const w = world;
  const log = draft.log;
  log.duration = Number(Math.max(0, ROUND.timeLimit - w.roundTimer).toFixed(2));
  log.winner = w.roundWinner;
  log.winnerName = w.roundWinner >= 0 && w.players[w.roundWinner] ? w.players[w.roundWinner].name : 'DRAW';
  log.matchWinner = w.matchWinner;
  log.fps = Math.round(fps);
  log.simMs = Number(simMs.toFixed(3));
  for (let i = 0; i < log.players.length; i++) {
    const stats = log.players[i];
    const p = w.players[stats.slot];
    if (!p) continue;
    stats.hp = Number(p.hp.toFixed(2));
    stats.maxHp = p.maxHp;
    stats.score = p.score;
  }
  log.deflect = diffPlaytestDeflect(readPlaytestDeflect(w), draft.deflectBase);
  const map = playtestMaps[playtestMapIndex];
  if (map) map.rounds.push(log);
  playtestRound = null;
  playtestRoundsOnMap++;
  console.info(
    `[PLAYTEST] ${log.arenaName} R${log.round} ${log.winnerName} ${log.duration.toFixed(1)}s`,
    log,
  );
  persistPlaytestLog();
  if (playtestRoundsOnMap >= PLAYTEST_ROUNDS_PER_MAP) {
    playtestAdvanceAt = performance.now() + 2000;
    toast(`MAP COMPLETE // ${log.arenaName}`, 'warn');
  }
}

function summarizePlaytest(): PlaytestSummary {
  let rounds = 0;
  let seconds = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let shots = 0;
  let swings = 0;
  let deflects = 0;
  let skills = 0;
  let heavies = 0;
  let damage = 0;
  let kills = 0;
  let deaths = 0;
  let fpsTotal = 0;
  for (let m = 0; m < playtestMaps.length; m++) {
    const map = playtestMaps[m];
    for (let r = 0; r < map.rounds.length; r++) {
      const round = map.rounds[r];
      rounds++;
      seconds += round.duration;
      fpsTotal += round.fps;
      if (round.winner === 0) wins++;
      else if (round.winner >= 0) losses++;
      else draws++;
      for (let p = 0; p < round.players.length; p++) {
        const player = round.players[p];
        shots += player.shots;
        swings += player.swings;
        deflects += player.deflects;
        skills += player.skills;
        heavies += player.heavies;
        damage += player.damage;
        kills += player.kills;
        deaths += player.deaths;
      }
    }
  }
  return {
    rounds,
    seconds: Number(seconds.toFixed(1)),
    wins,
    losses,
    draws,
    shots,
    swings,
    deflects,
    skills,
    heavies,
    damage: Number(damage.toFixed(2)),
    kills,
    deaths,
    avgFps: rounds > 0 ? Number((fpsTotal / rounds).toFixed(1)) : 0,
  };
}

function buildPlaytestLog(): PlaytestSessionLog {
  return {
    schema: 1,
    build: BUILD,
    startedAt: playtestStartedAt,
    finishedAt: playtestFinishedAt,
    complete: playtestComplete,
    mode: 'bots',
    program: programDef(playtestProgramId).name,
    botCount: playtestBotCount,
    botTier: BOT_TIER_LABELS[playtestBotTier],
    roundsPerMap: PLAYTEST_ROUNDS_PER_MAP,
    maps: playtestMaps,
    summary: summarizePlaytest(),
  };
}

function persistPlaytestLog(): void {
  try {
    localStorage.setItem(PLAYTEST_STORAGE_KEY, JSON.stringify(buildPlaytestLog()));
  } catch {
    // Private browsing or a full quota must not interrupt the match.
  }
}

function downloadPlaytestLog(): void {
  const text = JSON.stringify(buildPlaytestLog(), null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `deflect-playtest-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('PLAYTEST LOG DOWNLOADED');
}

async function copyPlaytestLog(): Promise<void> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(buildPlaytestLog(), null, 2));
    toast('PLAYTEST LOG COPIED');
  } catch {
    toast('COULD NOT COPY LOG', 'warn');
  }
}

function completePlaytest(): void {
  if (playtestComplete) return;
  playtestComplete = true;
  playtestAdvanceAt = 0;
  playtestFinishedAt = new Date().toISOString();
  persistPlaytestLog();
  const log = buildPlaytestLog();
  console.info('[PLAYTEST] COMPLETE', log);
  const summary = log.summary;
  setOverlay(
    'runover',
    'PLAYTEST COMPLETE',
    `${summary.rounds} ROUNDS // ${log.maps.length} MAPS`,
    `${summary.wins}W ${summary.losses}L ${summary.draws}D // ${summary.deflects} CATCHES // ${summary.avgFps} FPS`,
    [
      { label: 'DOWNLOAD LOG', primary: true, onClick: downloadPlaytestLog },
      { label: 'COPY LOG', onClick: copyPlaytestLog },
      { label: 'TITLE', onClick: leaveToTitle },
    ],
  );
  toast('PLAYTEST COMPLETE // LOG READY', 'warn');
}

function updatePlaytestAdvance(now: number): void {
  if (!playtestActive || playtestComplete || playtestAdvanceAt === 0 || now < playtestAdvanceAt) return;
  if (overlayKind === 'leave' || loading) return;
  playtestAdvanceAt = 0;
  if (playtestMapIndex + 1 < ARENAS.length) beginPlaytestMap(playtestMapIndex + 1);
  else completePlaytest();
}

function clearPlaytestState(): void {
  playtestActive = false;
  playtestComplete = false;
  playtestMaps = [];
  playtestRound = null;
  playtestAdvanceAt = 0;
}

function startBotMatch(aiLocal = false, useSeriesRules = false): void {
  if (busy) return;
  if (botCount < 1) botCount = 1;
  if (!useSeriesRules) {
    seriesGames = 1;
    seriesRun = false;
    seriesGame = 1;
    seriesWins.fill(0);
    seriesResultRecorded = false;
    seriesLastArenaId = -1;
  }
  teardownSession();
  hideOverlayInternal();
  mode = 'bots';
  localSlot = 0;
  stress = false;
  autoplay = aiLocal;
  autoplayRestartAt = 0;
  const arena = useSeriesRules ? chooseSeriesArena(false) : getArena(arenaIndex);
  const names = new Array(MAX_PLAYERS).fill('');
  names[0] = getCallsign();
  for (let i = 1; i <= botCount; i++) names[i] = BOT_NAMES[(i - 1) % BOT_NAMES.length];

  const botPrograms = botProgramList(botCount);
  world = new World('match', names, 0, arena, false, selectedProgram, botCount, botPrograms);
  botInputs = new Array(MAX_PLAYERS);
  for (let i = 0; i < MAX_PLAYERS; i++) botInputs[i] = { mx: 0, my: 0, held: 0, pressed: 0 };
  botBrains = new Array(MAX_PLAYERS).fill(null);
  for (let i = 1; i <= botCount; i++) {
    botBrains[i] = new BotBrain(i, botTier, i - 1, 0x51f15e + arena.id * 997 + i * 131);
  }
  if (aiLocal) {
    botBrains[0] = new BotBrain(0, botTier, 0, 0x51f15e + arena.id * 991 + 17);
  } else {
    botInputs[0] = localFrame;
  }
  seriesResultRecorded = false;
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(arena.name);
  audio.unlock();
  audio.startMusic();
  beginSessionLog();
  console.log('[DEFLECT-STATE] Bot match', botCount, botTier, arena.name, aiLocal ? 'AUTOPLAY' : '');
}

async function createRoom(): Promise<void> {
  if (busy) return;
  teardownSession();
  const name = getCallsign();
  mode = 'host';
  busy = true;
  setScreen('lobby');
  lobbyState = null;
  renderLobby(null, null);
  setLobbyStatus('ALLOCATING ROOM...');
  refreshTitleButtons();

  const net = new HostNet(name, {
    onLobby: (state) => {
      lobbyState = state;
      if (screen === 'lobby') renderLobby(state);
    },
    onGuestLeft: (slot, guestName) => {
      if (world && screen === 'game') {
        world.removePlayer(slot);
        toast(`${guestName} DISCONNECTED`, 'warn');
        // Co-op infection keeps running while one operator remains; versus needs two.
        if (!infectionRun && world.activeCount() < 2) endMatchToLobby('MATCH ABANDONED // NOT ENOUGH OPERATORS');
      } else {
        toast(`${guestName} LEFT`, 'warn');
      }
    },
    onError: (message) => toast(message, 'warn'),
  });
  hostNet = net;

  try {
    const code = await net.start();
    if (hostNet !== net) return;
    net.setArena(onlineArenaIndex(arenaIndex));
    busy = false;
    lobbyState = net.getLobbyState();
    renderLobby(lobbyState);
    console.log('[DEFLECT-NET] Room ready:', code);
  } catch (err) {
    console.warn('[DEFLECT-NET] Room creation failed', err);
    if (hostNet === net) {
      teardownSession();
      setScreen('title');
      toast('COULD NOT CREATE ROOM // CHECK NETWORK', 'error');
    }
  } finally {
    busy = false;
    refreshTitleButtons();
  }
}

function joinRoom(): void {
  if (busy) return;
  const code = normalizeCode(roomCodeInput.value);
  if (!isValidCode(code)) {
    setTitleStatus('ENTER A 4-CHARACTER ROOM CODE', 'error');
    return;
  }
  teardownSession();
  mode = 'guest';
  busy = true;
  setScreen('lobby');
  lobbyState = null;
  localSlot = -1;
  renderLobby(null, code);
  setLobbyStatus('CONNECTING TO ROOM...');
  refreshTitleButtons();

  const net = new GuestNet(getCallsign(), {
    onLobby: (state) => {
      if (guestNet !== net) return;
      lobbyState = state;
      if (screen === 'game') {
        world = null;
        guestView = null;
        infectionRun = false;
        setScreen('lobby');
        audio.stopMusic();
        renderLobby(state);
        return;
      }
      renderLobby(state);
    },
    onJoined: (slot) => {
      if (guestNet !== net) return;
      localSlot = slot;
      busy = false;
      refreshTitleButtons();
      if (lobbyState && screen === 'lobby') renderLobby(lobbyState);
      setLobbyStatus(`CONNECTED AS OPERATOR ${slot + 1}`);
    },
    onStart: (arenaId, gameMode, seriesTotal, gameNumber) => {
      if (guestNet !== net) return;
      startGuestGame(arenaId, gameMode, seriesTotal, gameNumber);
    },
    onSnapshot: (snap: Snapshot) => {
      if (guestNet !== net || !guestView) return;
      guestView.pushSnapshot(snap);
      handleRemoteEvents(snap.events);
    },
    onHop: (arenaId) => {
      if (guestNet !== net || !guestView) return;
      beginIslandHop('SCRIPT_KITTY // HOP', () => startGuestHop(arenaId));
    },
    onRematch: () => {
      if (guestNet !== net || !guestView) return;
      guestView.resetPrediction();
      guestView.names = namesFromLobby();
      resetCounters();
      hideOverlayInternal();
      setScreen('game');
      audio.startMusic();
    },
    onClosed: (reason) => {
      if (guestNet !== net) return;
      toast(`${reason} // LEAVING ROOM`, 'warn');
      leaveToTitle();
    },
    onError: (message) => {
      if (guestNet !== net) return;
      busy = false;
      refreshTitleButtons();
      toast(message, 'error');
      teardownSession();
      setScreen('title');
      setTitleStatus(message, 'error');
    },
  });
  guestNet = net;
  net.connect(code);
}

function startGuestGame(arenaId: number, gameMode = 0, seriesTotal = 1, gameNumber = 1): void {
  if (!guestNet) return;
  localSlot = guestNet.slot >= 0 ? guestNet.slot : 0;
  const arena = getArena(arenaId);
  arenaIndex = arena.id;
  guestSeriesTotal = seriesTotal;
  guestSeriesGame = gameNumber;
  infectionRun = gameMode === 1;
  guestView = new NetView(localSlot, arena, infectionRun);
  guestView.names = namesFromLobby();
  hideOverlayInternal();
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(infectionRun ? `INFECTION // ${arena.name}` : arena.name);
  audio.unlock();
  audio.startMusic();
  beginSessionLog();
  console.log('[DEFLECT-STATE] Guest', infectionRun ? 'infection' : 'match', 'start, slot', localSlot, arena.name);
}

function startGuestHop(arenaId: number): void {
  if (!guestNet) return;
  const arena = getArena(arenaId);
  arenaIndex = arena.id;
  guestView = new NetView(localSlot, arena, false);
  guestView.names = namesFromLobby();
  guestView.resetPrediction();
  fx.reset();
  hideOverlayInternal();
  setScreen('game');
  audio.startMusic();
  lastPhase = '' as Phase;
  lastRound = -1;
  lastRoundWinner = -2;
  lastMatchWinner = -2;
  console.log('[DEFLECT-STATE] Guest hop to', arena.name);
}

function startHostMatch(): void {
  if (!hostNet || mode !== 'host') return;
  const state = hostNet.getLobbyState();
  const connected = state.players.filter((p) => p.connected);
  if (connected.length < 2) {
    setLobbyStatus('NEED AT LEAST TWO OPERATORS');
    return;
  }
  const names = new Array(MAX_PLAYERS).fill('');
  for (let i = 0; i < connected.length; i++) {
    const p = connected[i];
    names[p.slot] = p.name;
  }
  lobbyState = state;
  const infection = state.mode === 1;
  const mapRule = normalizeSeriesMapRule(state.mapRule);
  seriesGames = infection ? 1 : normalizeSeriesGames(state.series);
  seriesMapRule = infection ? 'random' : mapRule;
  arenaIndex = onlineArenaIndex(state.arenaId);
  beginSeriesState(seriesGames, seriesMapRule, !infection && seriesGames > 1);
  const arena = infection ? getArena(arenaIndex) : chooseSeriesArena(true);
  arenaIndex = arena.id;
  infectionRun = infection;
  world = infection
    ? new World('gauntlet', names, 0, arena, false, PROGRAM_ID.PROBE, 0, null, false, null, true)
    : new World('match', names, 0, arena);
  if (infection) world.friendlyFire = false;
  hostNet.inputs[0] = localFrame;
  hostNet.startMatch(arena.id, seriesGames, seriesMapRule === 'fixed' ? 1 : 0);
  localSlot = 0;
  stress = false;
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(infection ? `INFECTION // ${arena.name}` : arena.name);
  audio.unlock();
  audio.startMusic();
  beginSessionLog();
  console.log('[DEFLECT-STATE] Host', infection ? 'infection' : 'match', 'start with', connected.length, 'operators');
}

function hostNextSeriesGame(): void {
  if (mode !== 'host' || !hostNet || !seriesRun || seriesGame >= seriesGames) return;
  seriesGame++;
  seriesResultRecorded = false;
  const state = hostNet.getLobbyState();
  const names = new Array(MAX_PLAYERS).fill('');
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (p.connected) names[p.slot] = p.name;
  }
  const arena = chooseSeriesArena(true);
  world = new World('match', names, 0, arena);
  arenaIndex = arena.id;
  hostNet.inputs[0] = localFrame;
  hostNet.startNextMatch(arena.id);
  localSlot = 0;
  stress = false;
  hideOverlayInternal();
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(arena.name);
  audio.startMusic();
  beginSessionLog();
  toast(`GAME ${seriesGame}/${seriesGames} // ${arena.name}`);
}

function startStress(count: number): void {
  if (screen === 'game') return;
  teardownSession();
  stress = true;
  stressBots = count;
  stressTick = 0;
  mode = 'training';
  localSlot = 0;
  const names = new Array(MAX_PLAYERS).fill('');
  for (let i = 0; i < count; i++) names[i] = `BOT ${i + 1}`;
  world = new World('match', names, 0, getArena(arenaIndex));
  stressInputs = new Array(MAX_PLAYERS);
  for (let i = 0; i < MAX_PLAYERS; i++) stressInputs[i] = { mx: 0, my: 0, held: 0, pressed: 0 };
  resetCounters();
  fx.reset();
  setScreen('game');
  toast(`STRESS MODE // ${count} OPERATORS // F3 FOR TELEMETRY`, 'warn');
}

function buildStressInputs(): void {
  stressTick++;
  const t = stressTick;
  for (let i = 0; i < stressBots; i++) {
    const f = stressInputs[i];
    f.mx = Math.cos(t * 0.019 + i * 1.7) * 0.92;
    f.my = Math.sin(t * 0.023 + i * 0.9) * 0.92;
    f.held = 0;
    f.pressed = 0;
    if (t % 19 === 0) f.pressed |= ACTION.BOLT;
    if (t % 53 === 0) f.pressed |= ACTION.SWING;
    if (t % 89 === 0) f.pressed |= ACTION.DASH;
    if (world) {
      const p = world.players[i];
      p.energy = 100;
      p.hp = 99;
      p.maxHp = 99;
      // Keep bodies immune so projectiles stay alive and the scenario stays loaded.
      p.iframes = 0.5;
    }
  }
}

function handleRemoteEvents(events: GameEvent[]): void {
  for (let i = 0; i < events.length; i++) handleGameEvent(events[i], true);
}

function endMatchToLobby(message: string): void {
  if (!hostNet) return;
  world = null;
  infectionRun = false;
  seriesRun = false;
  guestSeriesTotal = 1;
  guestSeriesGame = 1;
  hostNet.setInMatch(false);
  setScreen('lobby');
  audio.stopMusic();
  lobbyState = hostNet.getLobbyState();
  renderLobby(lobbyState);
  toast(message, 'warn');
}

function returnToLobby(): void {
  if (mode !== 'host' || !hostNet) return;
  world = null;
  infectionRun = false;
  seriesRun = false;
  guestSeriesTotal = 1;
  guestSeriesGame = 1;
  hostNet.setInMatch(false);
  lobbyState = hostNet.getLobbyState();
  setScreen('lobby');
  renderLobby(lobbyState);
  audio.stopMusic();
  resetCounters();
}

function hostInfectionRetry(): void {
  if (mode !== 'host' || !hostNet) return;
  lobbyState = hostNet.getLobbyState();
  const names = namesFromLobby();
  const arena = getArena(arenaIndex);
  world = new World('gauntlet', names, 0, arena, false, PROGRAM_ID.PROBE, 0, null, false, null, true);
  world.friendlyFire = false;
  hostNet.inputs[0] = localFrame;
  hostNet.broadcastRematch();
  infectionRecorded = false;
  fxCursor = 0;
  netCursor = 0;
  lastPhase = '';
  lastRound = -1;
  lastRoundWinner = -2;
  lastMatchWinner = -2;
  goUntil = 0;
  fx.reset();
  hideOverlayInternal();
  setScreen('game');
  audio.startMusic();
  toast('INFECTION RESET');
}

function hostRematch(): void {
  if (mode !== 'host' || !world || !hostNet) return;
  world.clearEvents();
  world.resetMatch();
  hostNet.broadcastRematch();
  fxCursor = 0;
  netCursor = 0;
  lastPhase = '';
  lastRound = -1;
  lastRoundWinner = -2;
  lastMatchWinner = -2;
  goUntil = 0;
  fx.reset();
  hideOverlayInternal();
  setScreen('game');
  audio.startMusic();
  toast('REMATCH INITIALIZED');
}

function localRematch(): void {
  if ((mode !== 'bots' && mode !== 'local') || !world) return;
  world.clearEvents();
  world.resetMatch();
  for (let i = 0; i < botBrains.length; i++) botBrains[i]?.reset();
  autoplayRestartAt = 0;
  fxCursor = 0;
  netCursor = 0;
  lastPhase = '';
  lastRound = -1;
  lastRoundWinner = -2;
  lastMatchWinner = -2;
  goUntil = 0;
  fx.reset();
  hideOverlayInternal();
  setScreen('game');
  audio.startMusic();
  toast(mode === 'local' ? `${localSeats.activeCount()} PLAYER REMATCH` : 'SIMULATION RESET');
}

function toggleReady(): void {
  if (!guestNet || mode !== 'guest') return;
  if (!lobbyState) return;
  const me = lobbyState.players.find((p) => p.slot === localSlot);
  const next = !me?.ready;
  guestNet.setReady(next);
  readyBtn.textContent = next ? 'READY ✓' : 'READY';
  setLobbyStatus(next ? 'READY // WAITING FOR HOST' : 'SET READY WHEN PREPARED');
}

function leaveLobby(): void {
  audio.ui();
  if (mode === 'host') toast('ROOM CLOSED');
  leaveToTitle();
}

function leaveToTitle(): void {
  clearPlaytestState();
  teardownSession();
  seriesRun = false;
  guestSeriesTotal = 1;
  guestSeriesGame = 1;
  showMenuStage('hub');
  setScreen('title');
  busy = false;
  refreshTitleButtons();
  setTitleStatus('');
}

function teardownSession(): void {
  if (mode === 'local') {
    input.keyboardOnly = false;
    localSeats.reset();
    renderer.setLocalSlots([0]);
  }
  if (hostNet) {
    hostNet.close();
    hostNet = null;
  }
  if (guestNet) {
    guestNet.close();
    guestNet = null;
  }
  world = null;
  guestView = null;
  lobbyState = null;
  mode = 'none';
  sessionLog = null;
  sessionPerfAt = 0;
  infectionRun = false;
  stress = false;
  botBrains = [];
  botInputs = [];
  autoplay = false;
  autoplayRestartAt = 0;
  localFrame.pressed = 0;
  fx.reset();
  audio.stopMusic();
  resetCounters();
  input.sample();
}

/** Local layout-transition time scale: hold at 0.35, then ease back to normal. */
function layoutSlowScale(dt: number): number {
  if (slowMoT <= 0) return 1;
  slowMoT = Math.max(0, slowMoT - dt);
  const ease = Math.max(0.01, CAMERA.layoutSlowTime - CAMERA.layoutSlowHold);
  if (slowMoT >= ease) return CAMERA.layoutSlowScale;
  const p = slowMoT / ease;
  return CAMERA.layoutSlowScale + (1 - CAMERA.layoutSlowScale) * (1 - p);
}

function resetCounters(): void {
  acc = 0;
  slowMoT = 0;
  snapTimer = 0;
  fxCursor = 0;
  netCursor = 0;
  lastPhase = '';
  lastRound = -1;
  lastRoundWinner = -2;
  lastMatchWinner = -2;
  goUntil = 0;
  lastCountdownText = '';
  lastLocalHp = -1;
  lastLocalSeatHp.fill(-1);
  gauntletRecorded = false;
  infectionRecorded = false;
  lastCampaignPhase = '';
}

// Screens & overlays ------------------------------------------------------------------------

function openSettings(): void {
  setScreen('settings');
  showSettingsTab(settingsTab);
}

function openHowToPlay(): void {
  setScreen('howto');
  syncHowToDevice();
}

/**
 * The controls page shows one input device at a time. A connected pad wins the couch
 * layout; otherwise a phone gets the touch table and a desktop gets keyboard/mouse.
 */
function syncHowToDevice(): void {
  let padName = '';
  if (navigator.getGamepads) {
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (pad && pad.connected) {
        padName = pad.id.slice(0, 48);
        break;
      }
    }
  }
  const gamepad = padName.length > 0;
  const touch = !gamepad && touchMode;
  howtoControlsPad.hidden = !gamepad;
  howtoControlsKeys.hidden = gamepad || touch;
  howtoControlsTouch.hidden = !touch;
  howtoTouchNote.hidden = !touch;
  howtoDeviceTitle.textContent = gamepad ? 'GAMEPAD' : touch ? 'TOUCH' : 'KEYBOARD + MOUSE';
  howtoDeviceName.textContent = gamepad ? padName : touch ? 'ON-SCREEN CONTROLS' : 'DETECTED';
}

function setScreen(next: Screen): void {
  screen = next;
  titleScreen.classList.toggle('active', next === 'title');
  settingsScreen.classList.toggle('active', next === 'settings');
  howtoScreen.classList.toggle('active', next === 'howto');
  lobbyScreen.classList.toggle('active', next === 'lobby');
  gameUi.hidden = next !== 'game';
  document.body.classList.toggle('playing', next === 'game');
  countdownEl.hidden = true;
  if (next !== 'game') {
    overlay.hidden = true;
    overlayKind = 'none';
    lastPhase = '';
    lastRound = -1;
    loading = false;
    bootScreen.hidden = true;
    bootScreen.classList.remove('active', 'leaving');
  }
  // Menus get their own quieter loop. Entering a session stops it here so the match bed
  // owns the speakers; leaving returns to it. Both calls are no-ops before the first
  // gesture has created the AudioContext.
  if (next === 'game') audio.stopMusic();
  else audio.startMenuMusic();
  clearMenuSelection();
}

function syncCountdownFlash(now: number): void {
  const state: RenderState | null = guestView ?? world;
  if (stress || !state || screen !== 'game') {
    countdownEl.hidden = true;
    return;
  }
  if (overlayKind !== 'none') {
    countdownEl.hidden = true;
    return;
  }
  if (state.phase === 'countdown') {
    countdownEl.hidden = false;
    const n = Math.max(1, Math.ceil(state.phaseTimer));
    const text = String(n);
    if (text !== lastCountdownText) {
      lastCountdownText = text;
      countdownValue.textContent = text;
      countdownLabel.textContent = 'GET READY';
      countdownValue.style.animation = 'none';
      void countdownValue.offsetWidth;
      countdownValue.style.animation = '';
    }
    return;
  }
  if (goUntil > now) {
    countdownEl.hidden = false;
    if (lastCountdownText !== 'GO') {
      lastCountdownText = 'GO';
      countdownValue.textContent = 'GO';
      countdownLabel.textContent = 'ENGAGE';
    }
    return;
  }
  countdownEl.hidden = true;
}

/** Held after a death before the result overlay opens, so the aftermath is visible. */
const DEATH_HOLD_MS = 1100;
let deathHoldUntil = 0;

let tutorialUiKey = '';

/** Draws the live story box. Hidden by the pause/result overlay, never paused itself. */
function syncTutorialUi(): void {
  // A run-level skip also catches lessons created after the node starts, such as the
  // holding skill/heavy beats and the final briefing.
  if (campaignSkipTutorials && mode === 'campaign' && world?.tutorial && !world.tutorial.done) {
    world.skipTutorial();
  }
  const warn = mode === 'campaign' && world ? world.campaignWarnStep : null;
  const runner = mode === 'campaign' && world ? world.tutorial : null;
  const step = warn ?? runner?.current ?? null;
  const show = !!step && screen === 'game' && overlayKind === 'none' && !loading
    && (!!warn || (!!runner && !runner.done));
  if (!show || !step) {
    if (!tutorialEl.hidden) tutorialEl.hidden = true;
    tutorialUiKey = '';
    return;
  }
  const key = warn ? `warn:${world!.campaignWarnSerial}` : `${runner!.index}:${step.id}`;
  if (key === tutorialUiKey) return;
  tutorialUiKey = key;
  tutorialEl.hidden = false;
  tutorialMark.textContent = step.speaker === 'SCRIPT_KITTY' ? '🐱' : step.speaker === 'SYSTEM' ? '▸' : '👮';
  tutorialSpeaker.textContent =
    step.speaker === 'SCRIPT_KITTY' ? 'SCRIPT_KITTY' : step.speaker === 'SYSTEM' ? 'SYSTEM' : 'THE WARDEN';
  tutorialLine.textContent = step.line;
  tutorialPrompt.textContent = step.prompt ?? '';
  tutorialPrompt.hidden = !step.prompt;
  tutorialStep.textContent = warn
    ? '1/1'
    : `${Math.min(runner!.index + 1, runner!.steps.length)}/${runner!.steps.length}`;
}

function syncPhaseUi(state: RenderState): void {
  // The attract demo owns the screen: no result overlays and no run records.
  if (attract) {
    if (overlayKind !== 'none') hideOverlayInternal();
    return;
  }
  if (stress) {
    if (overlayKind !== 'leave') hideOverlayInternal();
    return;
  }
  if (sessionLog) syncSessionRound(state);
  if (playtestActive) {
    if (playtestComplete) return;
    if (state.phase === 'live' && !playtestRound) beginPlaytestRound();
    else if (state.phase === 'roundover' && playtestRound) finishPlaytestRound();
  }
  if (infectionRun) {
    if (!state.infectionOver) {
      deathHoldUntil = 0;
      return;
    }
    if (overlayKind === 'none') {
      if (deathHoldUntil === 0) deathHoldUntil = performance.now() + DEATH_HOLD_MS;
      if (performance.now() >= deathHoldUntil) showInfectionOverOverlay(state);
    }
    return;
  }
  if (mode === 'campaign' && world) {
    syncCampaignBotLosses(world);
    if (world.campaignPhase !== lastCampaignPhase) {
      const phase = world.campaignPhase;
      if (phase === 'breach') audio.roundStart(1);
      else if (phase === 'assault') audio.roundStart(2);
      else if (phase === 'cleared') audio.victory();
      else if (phase === 'failed') audio.roundEnd();
      lastCampaignPhase = phase;
    }
    const ending = world.campaignPhase === 'cleared' || world.campaignPhase === 'failed';
    if (!ending) {
      deathHoldUntil = 0;
    } else if (overlayKind === 'none') {
      // Let the last de-rez and the empty arena sit for a beat before the buttons land.
      // A portal clear has already spent its beat on the suction. Do not stack the
      // death hold on top of it; the wipe should follow the mouth immediately.
      if (deathHoldUntil === 0) {
        deathHoldUntil = performance.now() + (world.campaignPortalT >= 0 ? 260 : DEATH_HOLD_MS);
      }
      if (performance.now() >= deathHoldUntil) {
        if (world.campaignPhase === 'cleared') handleCampaignClear(world);
        else showCampaignFailOverlay(world);
      }
    }
    return;
  }
  if (state.mode === 'gauntlet' && state.gauntletOver) {
    if (overlayKind === 'none') {
      if (deathHoldUntil === 0) deathHoldUntil = performance.now() + DEATH_HOLD_MS;
      if (performance.now() >= deathHoldUntil) showGauntletOverOverlay(state);
    }
    return;
  }
  deathHoldUntil = 0;
  const phaseChanged =
    state.phase !== lastPhase ||
    state.round !== lastRound ||
    state.roundWinner !== lastRoundWinner ||
    state.matchWinner !== lastMatchWinner;

  if (phaseChanged) {
    roundHopAt = 0;
    if (state.phase === 'roundover') {
      showRoundOverlay(state);
      if (state.matchWinner < 0 && canHopRound()) roundHopAt = performance.now() + 900;
    } else if (state.phase === 'matchend') {
      showMatchOverlay(state);
    } else if (overlayKind === 'round' || overlayKind === 'match') {
      hideOverlayInternal();
    }
    if (lastPhase === 'countdown' && state.phase === 'live') {
      goUntil = performance.now() + 420;
      lastCountdownText = '';
    }
    lastPhase = state.phase;
    lastRound = state.round;
    lastRoundWinner = state.roundWinner;
    lastMatchWinner = state.matchWinner;
  }
}

function showRoundOverlay(state: RenderState): void {
  if (overlayKind === 'leave') return;
  const winner = state.roundWinner;
  const title = winner >= 0 ? `${nameOf(state, winner)} TAKES ROUND ${state.round}` : `ROUND ${state.round} DRAW`;
  const hop = state.matchWinner < 0 && canHopRound() ? ' // PORTAL OPENING' : '';
  const sub = `${scoreLine(state)} // ${state.matchWinner >= 0 ? 'MATCH POINT SECURED' : `FIRST TO ${ROUND.winsNeeded}`}${hop}`;
  setOverlay('round', 'ROUND COMPLETE', title, sub, []);
}

/** Rounds that open a portal: everything round-based, never a solo run or a guest. */
function canHopRound(): boolean {
  if (attract || demo || stress || playtestActive || infectionRun) return false;
  if (overlayKind === 'leave') return false;
  if (mode !== 'bots' && mode !== 'local' && mode !== 'host') return false;
  if (!world || world.phase !== 'roundover') return false;
  // Never open the next island over a dead party. A wipe resolves as a match end,
  // not as a portal transition that respawns everyone at the entry mouth.
  return world.aliveCount() > 0;
}

/** Next arena in the island route. Online rooms skip local-only devices. */
function nextHopArena(currentId: number, online: boolean): number {
  const pool = online ? ARENAS.filter(isOnlineArena) : ARENAS.slice();
  if (pool.length === 0) return currentId;
  let at = pool.findIndex((a) => a.id === currentId);
  if (at < 0) at = 0;
  return pool[(at + 1) % pool.length].id;
}

/** Carry the scoreline and round number into the freshly built arena world. */
function carryRoundInto(target: World, source: World): void {
  target.round = source.round + 1;
  target.roundWinner = -1;
  target.matchWinner = -1;
  for (let i = 0; i < MAX_PLAYERS; i++) target.players[i].score = source.players[i].score;
  target.beginRound(true);
  lastPhase = '' as Phase;
  lastRound = -1;
  lastRoundWinner = -2;
  lastMatchWinner = -2;
  hideOverlayInternal();
  fx.reset();
  setScreen('game');
  audio.startMusic();
}

function rebuildLocalRound(arenaId: number, old: World): void {
  const arena = getArena(arenaId);
  const names = new Array(MAX_PLAYERS).fill('');
  for (let i = 0; i < MAX_PLAYERS; i++) if (old.players[i].active) names[i] = old.players[i].name;
  if (mode === 'bots') {
    const count = Math.max(1, botCount);
    world = new World('match', names, 0, arena, false, selectedProgram, count, botProgramList(count));
    botInputs = new Array(MAX_PLAYERS);
    for (let i = 0; i < MAX_PLAYERS; i++) botInputs[i] = { mx: 0, my: 0, held: 0, pressed: 0 };
    botBrains = new Array(MAX_PLAYERS).fill(null);
    for (let i = 1; i <= count; i++) {
      botBrains[i] = new BotBrain(i, botTier, i - 1, 0x51f15e + arena.id * 997 + i * 131);
    }
    if (autoplay) botBrains[0] = new BotBrain(0, botTier, 0, 0x51f15e + arena.id * 991 + 17);
    else botInputs[0] = localFrame;
    trainingInputs = botInputs;
  } else {
    world = new World('match', names, 0, arena, false, selectedProgram, 0, botProgramList(localSeats.maxSeats - 1));
    botInputs = [];
    botBrains = [];
    localSeats.writeFrames(localFrame, localFrames);
    trainingInputs = localFrames;
    renderer.setLocalSlots(localSeats.slots());
  }
  arenaIndex = arena.id;
  seriesLastArenaId = arena.id;
  carryRoundInto(world, old);
  console.log('[DEFLECT-STATE] Round hop to', arena.name, 'round', world.round);
}

function rebuildHostRound(arenaId: number, old: World): void {
  if (!hostNet) return;
  const arena = getArena(arenaId);
  const state = hostNet.getLobbyState();
  const names = new Array(MAX_PLAYERS).fill('');
  for (let i = 0; i < MAX_PLAYERS; i++) if (old.players[i].active) names[i] = old.players[i].name;
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (p.connected) names[p.slot] = p.name;
  }
  world = new World('match', names, 0, arena);
  hostNet.inputs[0] = localFrame;
  hostNet.hopArena(arena.id);
  arenaIndex = arena.id;
  seriesLastArenaId = arena.id;
  carryRoundInto(world, old);
  console.log('[DEFLECT-STATE] Host round hop to', arena.name, 'round', world.round);
}

function hopMatchRound(): void {
  if (!world || !canHopRound()) return;
  const old = world;
  if (old.phase !== 'roundover' || old.matchWinner >= 0) return;
  const arenaId = nextHopArena(old.arena.id, mode === 'host');
  const label = `SCRIPT_KITTY // SUCKING OPERATORS // ${getArena(arenaId).name}`;
  beginIslandHop(label, () => {
    if (mode === 'host') rebuildHostRound(arenaId, old);
    else rebuildLocalRound(arenaId, old);
  });
}

/**
 * One island hop. The wipe closes over the old arena, the action swaps it at the
 * midpoint, and the opening half reveals the new device. Nothing queues behind it.
 */
function showCampaignRoad(
  clearedName: string,
  nextName: string,
  nextIndex: number,
  action: () => void,
): void {
  campaignRoadAction = action;
  campaignRoadTitle.textContent = `${clearedName} SECURED`;
  campaignRoadNextLine.textContent = `NEXT NODE REVEALED // ${nextName}`;
  drawCampaignRoad(campaignRoadCanvas, campaignLevelIndex, nextIndex);
  campaignRoadEl.hidden = false;
  window.clearTimeout(campaignRoadTimer);
  campaignRoadTimer = window.setTimeout(() => {
    if (!campaignRoadEl.hidden) continueCampaignRoad();
  }, CAMPAIGN.routeRevealTime * 1000);
}

function hideCampaignRoad(): void {
  window.clearTimeout(campaignRoadTimer);
  campaignRoadTimer = 0;
  campaignRoadEl.hidden = true;
  campaignRoadAction = null;
}

function continueCampaignRoad(): void {
  if (campaignRoadEl.hidden) return;
  const action = campaignRoadAction;
  hideCampaignRoad();
  action?.();
}

function beginIslandHop(label: string, action: () => void): void {
  if (portalHopAction) {
    action();
    return;
  }
  portalHopAction = action;
  portalHopAt = performance.now();
  roundHopAt = 0;
  renderer.beginPortalHop(label);
}

function updateIslandHop(now: number): void {
  if (!portalHopAction) return;
  if (now - portalHopAt < 400) return;
  const action = portalHopAction;
  portalHopAction = null;
  action();
}

function updateRoundHop(now: number): void {
  if (roundHopAt === 0 || now < roundHopAt) return;
  roundHopAt = 0;
  hopMatchRound();
}

function showGauntletOverOverlay(state: RenderState): void {
  if (overlayKind === 'leave' || overlayKind === 'runover') return;
  const wave = Math.max(1, state.wave ?? 1);
  const seconds = Math.max(0, state.gauntletTime ?? 0);
  const kills = Math.max(0, state.gauntletKills ?? 0);
  const rush = world?.bossRush === true;
  const cleared = rush && world?.bossRushCleared === true;
  const previousBest = gauntletRecords[0];
  const newBest =
    !previousBest ||
    wave > previousBest.wave ||
    (wave === previousBest.wave &&
      (seconds > previousBest.seconds ||
        (seconds === previousBest.seconds && kills > previousBest.kills)));

  let rank = 0;
  if (!rush && !gauntletRecorded) {
    const run: GauntletRun = {
      name: getCallsign(),
      arenaId: arenaIndex,
      wave,
      seconds,
      kills,
      at: Date.now(),
    };
    const result = recordGauntletRun(gauntletRecords, run);
    gauntletRecords = result.runs;
    rank = result.rank;
    gauntletRecorded = true;
    saveGauntletRuns(gauntletRecords);
    updateGauntletBestLabel();
    renderGauntletRecords();
  }

  const place = rank > 0 ? `RANK #${rank} OF ${gauntletRecords.length}` : 'OUTSIDE TOP 8';
  const resultLine = rush
    ? cleared
      ? 'LADDER CLEARED'
      : 'LADDER ABANDONED'
    : newBest
      ? 'NEW PERSONAL BEST'
      : place;
  const actions: OverlayAction[] = [
    { label: 'RETRY', primary: true, onClick: startGauntlet },
    { label: 'SETUP', onClick: returnToGauntletSetup },
    { label: 'TITLE', onClick: leaveToTitle },
  ];
  setOverlay(
    'runover',
    rush ? (cleared ? 'BOSS RUSH // CLEAR' : 'BOSS RUSH // LADDER BROKEN') : 'GAUNTLET // RING BROKEN',
    rush
      ? `BOSS ${Math.min(wave, world?.bossRushTotal ?? wave)} OF ${world?.bossRushTotal ?? wave} // ${formatGauntletTime(seconds)}`
      : `WAVE ${wave} // ${formatGauntletTime(seconds)}`,
    `${kills} KILLS // ${resultLine} // ${state.arena.name}`,
    withSessionShare(actions, sessionResult('ring-broken', { wave, seconds, kills })),
  );
}

function returnToGauntletSetup(): void {
  teardownSession();
  soloProgram = 'gauntlet';
  showMenuStage('gauntlet');
  setScreen('title');
  refreshTitleButtons();
  setTitleStatus('');
}

function showInfectionOverOverlay(state: RenderState): void {
  if (overlayKind === 'leave' || overlayKind === 'runover') return;
  const seconds = state.gauntletTime ?? 0;
  const kills = state.infectionKills ?? 0;
  const cleared = !!state.infectionCleared;
  const pct = Math.floor((state.infectionProgress ?? 0) * 100);

  let bestLine = '';
  if (cleared && mode !== 'guest') {
    if (!infectionRecorded) {
      const result = recordInfectionClear(infectionBests, {
        name: getCallsign(),
        arenaId: arenaIndex,
        seconds,
        kills,
        at: Date.now(),
      });
      infectionBests = result.bests;
      infectionRecorded = true;
      saveInfectionBests(infectionBests);
      updateInfectionBestLabel();
      bestLine = result.improved ? ' // NEW BEST' : '';
    }
    if (!bestLine) {
      const best = bestForArena(infectionBests, arenaIndex);
      if (best) bestLine = ` // BEST ${formatInfectionTime(best.seconds)}`;
    }
  }

  const actions =
    mode === 'host'
      ? [
          { label: 'RETRY', primary: true, onClick: hostInfectionRetry },
          { label: 'LOBBY', onClick: returnToLobby },
          { label: 'TITLE', onClick: leaveToTitle },
        ]
      : mode === 'guest'
        ? [{ label: 'LEAVE ROOM', primary: true, onClick: leaveToTitle }]
        : [
            { label: 'RETRY', primary: true, onClick: () => startInfection() },
            { label: 'ARENA', onClick: returnToInfectionSetup },
            { label: 'TITLE', onClick: leaveToTitle },
          ];
  setOverlay(
    'runover',
    cleared ? 'INFECTION // SYSTEM CLEAN' : 'INFECTION // SIGNAL LOST',
    cleared ? `CLEARED // ${formatInfectionTime(seconds)}` : 'RING BROKEN',
    cleared
      ? `${kills} VIRUSES // ${pct}% CLEARED${bestLine} // ${state.arena.name}`
      : `${pct}% CLEARED // ${kills} VIRUSES // ${state.arena.name}`,
    withSessionShare(
      actions,
      sessionResult(cleared ? 'infection-clear' : 'infection-failed', { cleared, seconds, kills }),
    ),
  );
}

function returnToInfectionSetup(): void {
  teardownSession();
  soloProgram = 'infection';
  showMenuStage('soloArena');
  setScreen('title');
  refreshTitleButtons();
  setTitleStatus('');
}

function updateInfectionBestLabel(): void {
  const best = fastestBest(infectionBests);
  infectionBestValue.textContent = best ? `BEST ${formatInfectionTime(best.seconds)}` : 'BEST --';
  infectionBestValue.title = best
    ? `Best: ${formatInfectionTime(best.seconds)} on ${getArena(best.arenaId).name}`
    : 'No clean sweeps yet';
}

function scoreCampaign(w: World): { score: number; clean: boolean } {
  const clean = w.dataTotal > 0 && w.dataKept === w.dataTotal;
  const timeDelta = CAMPAIGN.scoreParTime - campaignPlaySeconds;
  let score =
    w.gauntletKills * CAMPAIGN.scorePerKill +
    w.dataKept * CAMPAIGN.scorePerData +
    timeDelta * CAMPAIGN.scoreTimeRate -
    w.campaignDamage * CAMPAIGN.scorePerDamage;
  if (clean) score += CAMPAIGN.cleanSweepBonus;
  return { score: Math.max(0, Math.round(score)), clean };
}

/**
 * A campaign node is one arena in the ordered island route. A clear saves the slot and
 * immediately opens the next portal: there is no bridge and no result menu between
 * devices. Only the final node parks on an overlay, because the route ends there.
 */
function handleCampaignClear(w: World): void {
  if (overlayKind === 'leave' || overlayKind === 'runover' || campaignClearHandled) return;
  campaignClearHandled = true;
  const { score, clean } = scoreCampaign(w);
  const cleared = PLAYABLE_CAMPAIGN_LEVELS[campaignLevelIndex] ?? FIRST_CAMPAIGN_LEVEL;
  const next = PLAYABLE_CAMPAIGN_LEVELS[campaignLevelIndex + 1] ?? null;
  campaignDebug?.mark(
    'level-clear',
    `${cleared.name} // score ${score} // ${w.gauntletKills} kills // ${campaignPlaySeconds.toFixed(1)}s // ${
      clean ? 'clean sweep' : 'data or damage penalty'
    }`,
  );
  const complete = next === null;
  let bestLine = '';
  if (!campaignSaved && campaignSlot >= 0) {
    const prev = loadStorySlots()[campaignSlot];
    const bestScore = Math.max(prev?.bestScore ?? 0, score);
    const cleanSweeps = (prev?.cleanSweeps ?? 0) + (clean ? 1 : 0);
    // `level` is the completed count; no next level means the slot is complete.
    saveStoryProgress(campaignSlot, {
      program: selectedProgram,
      sector: next?.sector ?? cleared.sector,
      nodeId: next?.nodeId ?? cleared.nodeId,
      level: next ? campaignLevelIndex + 1 : PLAYABLE_CAMPAIGN_LEVELS.length,
      players: campaignPlayers,
      bots: campaignBots,
      playSeconds: Math.floor(campaignPlaySeconds),
      bestScore,
      cleanSweeps,
      memory: campaignMemory,
      shards: campaignShards,
      deadBots: campaignBotDead & 0xfe,
    });
    campaignSaved = true;
    bestLine = ` // BEST ${bestScore}`;
    if (complete) storyStatusLine.textContent = 'CAMPAIGN COMPLETE // MORE LEVELS COMING SOON';
  } else if (campaignSlot >= 0) {
    bestLine = ` // BEST ${loadStorySlots()[campaignSlot]?.bestScore ?? score}`;
  }
  if (next) {
    const advance = () => {
      beginIslandHop(`SCRIPT_KITTY // PORTAL TO ${next.name}`, () => {
        campaignLevelIndex += 1;
        startCampaignLevel(true);
        toast(`${cleared.name} SECURED // SCORE ${score}${clean ? ' // CLEAN SWEEP' : ''}`);
      });
    };
    // The route plate is the network map between levels, not a card between every
    // arena in the same level. The four BUILD ROOT rooms share one node, so they
    // portal straight on; crossing to a new node gets the map beat.
    if (cleared.nodeId !== next.nodeId) {
      showCampaignRoad(cleared.name, next.name, campaignLevelIndex + 1, advance);
    } else {
      advance();
    }
    return;
  }
  const dataLine = w.dataTotal > 0 ? `DATA ${w.dataKept}/${w.dataTotal}` : 'NO DATA AT RISK';
  setOverlay(
    'runover',
    `CAMPAIGN // LEVEL ${PLAYABLE_CAMPAIGN_LEVELS.length} CLEAR`,
    'MORE LEVELS COMING SOON',
    `${cleared.name} SECURED // ${w.gauntletKills} KILLS // ${formatGauntletTime(campaignPlaySeconds)} // ${
      w.campaignDamage
    } DAMAGE TAKEN // ${dataLine}${clean ? ' // CLEAN SWEEP' : ''} // SCORE ${score}${bestLine} // PROGRESS SAVED`,
    withSessionShare(
      [
        { label: 'STORY SLOTS', primary: true, onClick: returnToStory },
        { label: 'REPLAY', onClick: () => startCampaignLevel() },
      ],
      sessionResult('campaign-clear', { cleared: true, score, seconds: campaignPlaySeconds, kills: w.gauntletKills }),
    ),
  );
}

function showCampaignFailOverlay(w: World): void {
  if (overlayKind === 'leave' || overlayKind === 'runover') return;
  syncCampaignBotLosses(w);
  // A TPK retry restores only the companions that died in this arena. Bots lost in
  // an earlier arena stay lost for the run.
  const tpk = !w.players.some((p, i) => i > 0 && p.active && p.alive);
  campaignRetryRevives = tpk;
  campaignDebug?.mark(
    'level-failed',
    `${w.gauntletKills}/${w.campaignKillsToClear} kills // ${campaignPlaySeconds.toFixed(1)}s // ${
      (PLAYABLE_CAMPAIGN_LEVELS[campaignLevelIndex] ?? FIRST_CAMPAIGN_LEVEL).name
    } // ${tpk ? 'TPK' : 'retry'}`,
  );
  setOverlay(
    'runover',
    'CAMPAIGN // SIGNAL LOST',
    'RING BROKEN',
    `${w.gauntletKills} / ${w.campaignKillsToClear} THREATS DELETED // ${
      (PLAYABLE_CAMPAIGN_LEVELS[campaignLevelIndex] ?? FIRST_CAMPAIGN_LEVEL).name
    }`,
    withSessionShare(
      [
        { label: 'RETRY', primary: true, onClick: retryCampaignLevel },
        { label: 'SLOTS', onClick: returnToStory },
      ],
      sessionResult('campaign-failed', { cleared: false, seconds: campaignPlaySeconds, kills: w.gauntletKills }),
    ),
  );
}

function retryCampaignLevel(): void {
  if (campaignRetryRevives) campaignBotDead &= ~campaignDeadHere;
  campaignRetryRevives = false;
  // Keep `campaignDeadHere`: a bot lost in an earlier attempt in this arena is still
  // eligible if a later attempt ends in a TPK.
  startCampaignLevel(false, true);
}

/**
 * Folds a campaign bot's permanent death into the run mask. A bot that was already
 * dead when the node loaded is already in the mask, so it never counts as a loss here.
 */
function syncCampaignBotLosses(w: World): void {
  const lost = w.campaignBotsLost & ~campaignBotDead;
  if (lost === 0) return;
  campaignBotDead |= lost;
  campaignDeadHere |= lost;
  campaignDebug?.mark('bot-lost', `slots ${lost.toString(2)}`);
}

function showMatchOverlay(state: RenderState): void {
  if (overlayKind === 'leave') return;
  const winner = state.matchWinner;

  // A guest follows the host's series automatically; the next START hides this panel.
  if (mode === 'guest' && guestSeriesTotal > 1) {
    const final = guestSeriesGame >= guestSeriesTotal;
    setOverlay(
      'match',
      final ? 'SERIES COMPLETE' : 'GAME COMPLETE',
      final ? 'WAITING FOR HOST' : `GAME ${guestSeriesGame}/${guestSeriesTotal} COMPLETE`,
      final ? 'THE HOST HAS FINISHED THE SERIES // RETURN TO THE LOBBY' : 'THE HOST WILL START THE NEXT GAME',
      withSessionShare(
        [{ label: 'LEAVE ROOM', onClick: leaveToTitle }],
        sessionResult(final ? 'series-complete' : 'game-complete', {
          winnerSlot: winner,
          matchWinner: winner,
          seriesGame: guestSeriesGame,
          seriesTotal: guestSeriesTotal,
        }),
      ),
    );
    return;
  }

  if (seriesRun && (mode === 'bots' || mode === 'host')) {
    recordSeriesResult(state);
    const final = seriesGame >= seriesGames;
    const score = seriesScoreLine(state);
    const actions: OverlayAction[] = [];
    let title: string;
    let sub: string;
    if (final) {
      const champion = seriesWinner(seriesWins);
      title = champion >= 0 ? `${nameOf(state, champion)} WINS SERIES` : 'SERIES DRAW';
      sub = `${score} // GAME ${seriesGame}/${seriesGames} // ${seriesMapRule === 'random' ? 'RANDOM MAPS' : 'FIXED MAP'}`;
      if (mode === 'host') {
        actions.push({ label: 'RETURN TO LOBBY', primary: true, onClick: returnToLobby });
      } else {
        actions.push({ label: 'NEW SERIES', primary: true, onClick: () => startBotSeries(seriesGames) });
        actions.push({ label: 'CHANGE SETUP', onClick: returnToSeriesSetup });
      }
      actions.push({ label: 'TITLE', onClick: leaveToTitle });
    } else {
      title = winner >= 0 ? `${nameOf(state, winner)} TAKES GAME ${seriesGame}` : `GAME ${seriesGame} DRAW`;
      sub = `${score} // GAME ${seriesGame}/${seriesGames} // NEXT: ${seriesNextMapLabel()}`;
      if (mode === 'host') {
        actions.push({ label: 'NEXT GAME', primary: true, onClick: hostNextSeriesGame });
        actions.push({ label: 'RETURN TO LOBBY', onClick: returnToLobby });
      } else {
        actions.push({ label: 'NEXT GAME', primary: true, onClick: startNextBotSeriesGame });
        actions.push({ label: 'CHANGE SETUP', onClick: returnToSeriesSetup });
      }
    }
    setOverlay(
      'match',
      final ? 'SERIES COMPLETE' : 'GAME COMPLETE',
      title,
      sub,
      withSessionShare(
        actions,
        sessionResult(final ? 'series-complete' : 'game-complete', {
          winnerSlot: final ? seriesWinner(seriesWins) : winner,
          matchWinner: winner,
          seriesGame,
          seriesTotal: seriesGames,
        }),
      ),
    );
    return;
  }

  // A match reaches `matchend` with no winner only on a full-party wipe. Do not
  // dress that up as a completed match; the ring is broken, not won.
  const wiped = winner < 0;
  const title = wiped ? 'RING BROKEN' : `${nameOf(state, winner)} WINS`;
  const sub = wiped
    ? `ALL OPERATORS DOWN // ${scoreLine(state)}`
    : `${scoreLine(state)} // FIRST TO ${ROUND.winsNeeded}${
        mode === 'guest' ? ' // WAITING FOR HOST TO REMATCH' : ''
      }`;
  const actions: OverlayAction[] = [];
  if (mode === 'host') {
    actions.push({ label: 'REMATCH', primary: true, onClick: hostRematch });
    actions.push({ label: 'RETURN TO LOBBY', onClick: returnToLobby });
  } else if (mode === 'guest') {
    actions.push({ label: 'LEAVE ROOM', onClick: leaveToTitle });
  } else if (mode === 'bots' || mode === 'local') {
    actions.push({ label: 'REMATCH', primary: true, onClick: localRematch });
    actions.push({ label: 'RETURN TO TITLE', onClick: leaveToTitle });
  }
  setOverlay(
    'match',
    'MATCH COMPLETE',
    title,
    sub,
    withSessionShare(actions, sessionResult('match-complete', { winnerSlot: winner, matchWinner: winner })),
  );
}

interface OverlayAction {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

function setOverlay(kind: OverlayKind, kicker: string, title: string, sub: string, actions: OverlayAction[]): void {
  overlayKind = kind;
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  clearChildren(overlayActions);
  overlayActions.hidden = actions.length === 0;
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const btn = document.createElement('button');
    btn.className = `btn${action.primary ? ' btn-primary' : ''}`;
    btn.textContent = action.label;
    btn.dataset.nav = '';
    btn.addEventListener('click', () => action.onClick());
    overlayActions.appendChild(btn);
  }
  overlay.hidden = false;
  clearMenuSelection();
}

function hideOverlayInternal(): void {
  overlay.hidden = true;
  overlayKind = 'none';
  clearChildren(overlayActions);
}

function closeLeave(): void {
  if (overlayKind !== 'leave') return;
  hideOverlayInternal();
  lastPhase = '' as Phase;
  lastRound = -1;
  lastRoundWinner = -2;
  lastMatchWinner = -2;
}

function openLeave(): void {
  if (mode === 'none' || overlayKind === 'leave' || overlayKind === 'runover') return;
  const campaignRun = mode === 'campaign';
  const infection = infectionRun;
  const local = mode === 'training' || mode === 'bots' || mode === 'gauntlet' || campaignRun;
  const training = mode === 'training' && !stress;
  const botMatch = mode === 'bots';
  const gauntlet = mode === 'gauntlet';
  const paused = training || botMatch || mode === 'local' || gauntlet || campaignRun;
  setOverlay(
    'leave',
    paused ? 'SYSTEM // PAUSED' : 'SYSTEM // LIVE',
    training
      ? 'LEAVE TRAINING?'
      : botMatch
        ? 'LEAVE BOT MATCH?'
        : campaignRun
          ? 'EXIT NODE?'
          : infection
            ? 'EXIT INFECTION?'
            : gauntlet
              ? 'EXIT GAUNTLET?'
            : local
              ? 'LEAVE STRESS RUN?'
              : 'LEAVE MATCH?',
    campaignRun
      ? 'The run is only saved when a node is cleared.'
      : local
        ? 'The simulation will be destroyed. Nothing is saved.'
        : 'The match continues while this panel is open. Your operator will stand still.',
    withSessionShare(
      [
        { label: 'STAY', onClick: closeLeave },
        { label: 'LEAVE', primary: true, onClick: campaignRun ? returnToStory : leaveToTitle },
      ],
      sessionResult('left'),
    ),
  );
}

function nameOf(state: RenderState, slot: number): string {
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (p.active && p.slot === slot) return p.name || `P${slot + 1}`;
  }
  return `P${slot + 1}`;
}

function scoreLine(state: RenderState): string {
  const parts: string[] = [];
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (p.active) parts.push(`${p.name} ${p.score}`);
  }
  return parts.join('  /  ');
}

function setTitleStatus(message: string, tone: 'info' | 'error' = 'info'): void {
  titleStatus.textContent = message;
  titleStatus.classList.toggle('error', tone === 'error');
}

function setLobbyStatus(message: string): void {
  lobbyStatus.textContent = message;
}

// Lobby rendering ---------------------------------------------------------------------------

function renderLobby(state: LobbyState | null, connectingCode: string | null = null): void {
  const code = state?.code || connectingCode || '----';
  lobbyCodeEl.textContent = code || '----';
  const url = code && code !== '----' ? inviteLink(code) : '';
  lobbyUrlEl.textContent = url;
  copyBtn.disabled = !url;
  lobbyRole.textContent = mode === 'host' ? 'HOST' : mode === 'guest' ? `GUEST / P${Math.max(1, localSlot + 1)}` : '—';
  lobbyLinkEl.textContent = mpRttText();
  const lobbyArena = getArena(state?.arenaId ?? arenaIndex);
  lobbyArenaBtn.textContent = `ARENA: ${lobbyArena.name}`;
  lobbyArenaBtn.disabled = mode !== 'host' || busy;
  const lobbyMode = state?.mode ?? 0;
  lobbyModeBtn.textContent = `MODE: ${lobbyMode === 1 ? 'INFECTION' : 'VERSUS'}`;
  lobbyModeBtn.disabled = mode !== 'host' || busy;
  const lobbySeries = state?.series ?? seriesGames;
  const lobbyMapRule = (state?.mapRule ?? (seriesMapRule === 'fixed' ? 1 : 0)) === 1 ? 'fixed' : 'random';
  lobbySeriesBtn.textContent = `SERIES: ${lobbySeries === 1 ? '1 GAME' : `${lobbySeries} GAMES`}`;
  lobbySeriesBtn.disabled = mode !== 'host' || busy || lobbyMode === 1;
  lobbyMapRuleBtn.textContent = `MAPS: ${lobbyMapRule === 'random' ? 'RANDOM' : 'FIXED'}`;
  lobbyMapRuleBtn.disabled = mode !== 'host' || busy || lobbyMode === 1;

  const players = state?.players ?? [];
  lobbyCount.textContent = `${players.length} / ${MAX_PLAYERS}`;
  clearChildren(lobbyPlayersEl);
  if (players.length === 0) {
    const placeholder = document.createElement('li');
    placeholder.className = 'player-row';
    placeholder.style.setProperty('--player-color', slotColor(0));
    const meta = document.createElement('div');
    meta.className = 'player-meta';
    const name = document.createElement('div');
    name.className = 'player-name';
    name.textContent = busy ? 'SYNCING...' : 'WAITING...';
    const sub = document.createElement('div');
    sub.className = 'player-sub';
    sub.textContent = 'ROOM DATA';
    meta.append(name, sub);
    placeholder.appendChild(meta);
    lobbyPlayersEl.appendChild(placeholder);
  }
  for (let i = 0; i < players.length; i++) {
    lobbyPlayersEl.appendChild(makePlayerRow(players[i], state?.hostSlot ?? 0));
  }

  const me = players.find((p) => p.slot === localSlot);
  readyBtn.hidden = mode !== 'guest';
  readyBtn.disabled = mode !== 'guest' || busy || !state;
  readyBtn.textContent = me?.ready ? 'READY ✓' : 'READY';
  startBtn.hidden = mode !== 'host';
  startBtn.disabled = mode !== 'host' || busy || !state?.canStart;

  if (busy) {
    setLobbyStatus(mode === 'host' ? 'ALLOCATING ROOM...' : 'CONNECTING TO ROOM...');
  } else if (mode === 'host') {
    setLobbyStatus(
      state && state.canStart
        ? 'TWO OPERATORS READY // START ENABLED'
        : 'SHARE THE INVITE LINK // WAITING FOR OPERATORS',
    );
  } else if (mode === 'guest') {
    setLobbyStatus(me?.ready ? 'READY // WAITING FOR HOST' : 'SET READY WHEN PREPARED');
  }
}

function makePlayerRow(p: LobbyPlayer, hostSlot: number): HTMLLIElement {
  const li = document.createElement('li');
  li.className = `player-row${p.slot === localSlot ? ' is-you' : ''}`;
  li.style.setProperty('--player-color', slotColor(p.slot));

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'player-avatar';
  const cv = document.createElement('canvas');
  drawAvatar(cv, p.slot);
  avatarWrap.appendChild(cv);

  const meta = document.createElement('div');
  meta.className = 'player-meta';
  const name = document.createElement('div');
  name.className = 'player-name';
  name.textContent = `${p.name}${p.slot === localSlot ? ' (YOU)' : ''}`;
  const sub = document.createElement('div');
  sub.className = 'player-sub';
  sub.textContent = `SLOT ${p.slot + 1} · ${p.slot === hostSlot ? 'HOST' : 'GUEST'}`;
  meta.append(name, sub);

  const state = document.createElement('span');
  state.className = `player-state ${p.slot === hostSlot ? 'host' : p.ready ? 'ready' : ''}`;
  state.textContent = p.slot === hostSlot ? 'HOST' : p.ready ? 'READY' : 'STANDBY';

  li.append(avatarWrap, meta, state);
  return li;
}

async function copyInvite(): Promise<void> {
  const url = lobbyUrlEl.textContent ?? '';
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    toast('INVITE LINK COPIED');
  } catch {
    toast('COPY BLOCKED // SELECT THE LINK MANUALLY', 'warn');
  }
}

function inviteLink(code: string): string {
  return `${location.origin}${location.pathname}#${code}`;
}

function namesFromLobby(): string[] {
  const names = new Array(MAX_PLAYERS).fill('');
  if (lobbyState) {
    for (let i = 0; i < lobbyState.players.length; i++) {
      const p = lobbyState.players[i];
      names[p.slot] = p.name;
    }
  }
  return names;
}

// Utility UI --------------------------------------------------------------------------------

function updateMuteLabel(): void {
  const text = `SOUND: ${audio.muted ? 'OFF' : 'ON'}`;
  settingsMuteBtn.textContent = text;
  settingsMuteBtn.setAttribute('aria-pressed', String(audio.muted));
}

function toggleMute(): void {
  audio.unlock();
  const muted = audio.toggleMute();
  if (!muted && audio.musicWanted && screen === 'game') audio.startMusic();
  updateMuteLabel();
  toast(muted ? 'AUDIO MUTED' : 'AUDIO ONLINE');
}

function countActive(items: readonly { active: boolean }[]): number {
  let n = 0;
  for (let i = 0; i < items.length; i++) if (items[i].active) n++;
  return n;
}

function updatePerf(dt: number): void {
  if (perfEl.hidden) return;
  perfTimer += dt;
  if (perfTimer < 0.25) return;
  perfTimer = 0;
  const state: RenderState | null = guestView ?? world;
  let players = 0;
  let projectiles = 0;
  if (state) {
    for (let i = 0; i < state.players.length; i++) if (state.players[i].active) players++;
    for (let i = 0; i < state.projectiles.length; i++) if (state.projectiles[i].active) projectiles++;
  }
  perfEl.textContent = [
    `FPS ${fps.toFixed(0)}   FRAME ${frameMs.toFixed(1)}ms`,
    `SIM ${simMs.toFixed(2)}ms   PROJ ${projectiles}`,
    `PLAYERS ${players}   MODE ${mode.toUpperCase()}${stress ? ' STRESS' : ''}`,
    mode === 'gauntlet' && world
      ? `WAVE ${world.wave}   THREATS W${countActive(world.worms)} V${countActive(world.viruses)} F${countActive(world.firewalls)} E${countActive(world.errors)}   INFECT ${Math.round(world.infection * 100)}%`
      : '',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

function togglePerf(): void {
  perfEl.hidden = !perfEl.hidden;
  if (!perfEl.hidden) {
    perfTimer = 1;
    updatePerf(0);
  }
}

function mpRttText(): string {
  const status = mode === 'host' ? hostNet?.getStatus() : mode === 'guest' ? guestNet?.getStatus() : null;
  return status && status.rttMs >= 0 ? `${Math.round(status.rttMs)} MS` : '--';
}

/**
 * Online room telemetry: role, room code, connected operators, measured RTT and the
 * live snapshot cadence. It is local UI only; no field here is written to Snapshot.
 */
function updateMpStatus(now: number): void {
  hostNet?.pollStatus(now);
  guestNet?.pollStatus(now);
  if (lobbyLinkEl && screen === 'lobby' && (mode === 'host' || mode === 'guest')) {
    lobbyLinkEl.textContent = mpRttText();
  }

  const online = mode === 'host' || mode === 'guest';
  const status = mode === 'host' ? hostNet?.getStatus() : mode === 'guest' ? guestNet?.getStatus() : null;
  if (!online || !status || screen !== 'game' || loading || overlayKind !== 'none' || !uiEnabled) {
    mpStatusEl.hidden = true;
    return;
  }
  if (now < mpStatusAt) return;
  mpStatusAt = now + 250;
  const connected = lobbyState?.players.filter((p) => p.connected).length ?? status.players;
  const players = mode === 'host' ? status.players : Math.max(connected, status.slot + 1);
  mpStatusEl.hidden = false;
  mpRoleEl.textContent = `${status.role} // P${Math.max(1, status.slot + 1)}`;
  mpCodeEl.textContent = status.code || '----';
  mpPlayersEl.textContent = `${players} / ${status.capacity}`;
  mpRttEl.textContent = status.rttMs >= 0 ? `${Math.round(status.rttMs)} MS` : '--';
  mpSnapEl.textContent = status.snapshotHz > 0 ? `${Math.round(status.snapshotHz)} HZ` : '--';
  mpDetailEl.textContent = mode === 'host' ? 'HOST AUTHORITY // P2P' : 'CLIENT PREDICTION // P2P';
}

// Input routing -----------------------------------------------------------------------------

function onUiKey(e: KeyboardEvent): void {
  if (attract) {
    // The kiosk demo is unattended: keys are swallowed. The title attract demo
    // returns to the hub on the first real keypress.
    if (!demo) exitAttract();
    return;
  }
  const target = e.target as HTMLElement | null;
  const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  if (typing) {
    if (e.code === 'Escape') target?.blur();
    return;
  }
  if (e.code === 'F3') {
    e.preventDefault();
    togglePerf();
    return;
  }
  if (e.code === 'KeyM') {
    toggleMute();
    return;
  }
  if (e.code === 'Escape') {
    if (overlayKind === 'runover') return;
    if (overlayKind === 'leave') closeLeave();
    else if (screen === 'title') menuBack();
    else if (screen === 'settings' || screen === 'howto') setScreen('title');
    else if (screen === 'game') openLeave();
    else if (screen === 'lobby') leaveLobby();
    return;
  }
  if (screen !== 'game' || overlayKind !== 'none') {
    // With no default highlight there is no focused button to receive Enter/Space,
    // so the menu has to activate the current (or first) option itself.
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      activateNav();
      return;
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      moveNavDir(0, 1);
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      moveNavDir(0, -1);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      moveNavDir(1, 0);
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      moveNavDir(-1, 0);
    }
  }
}

function handleGamepad(edges: MenuEdges): void {
  // The attract demo answers to any input, but never opens a menu: the frame after the
  // input ends the demo and the title stage takes over.
  if (attract) return;
  const menuOpen = screen !== 'game' || overlayKind !== 'none';
  if (menuOpen) {
    if (edges.up) moveNavDir(0, -1);
    else if (edges.down) moveNavDir(0, 1);
    else if (edges.left) moveNavDir(-1, 0);
    else if (edges.right) moveNavDir(1, 0);
    if (edges.confirm) activateNav();
    // Select/View keeps its old back behavior in menus; in play it owns the
    // canvas UI instead, so it never opens the leave overlay by accident.
    if (edges.back || edges.menu || edges.ui) {
      if (overlayKind === 'runover') return;
      if (overlayKind === 'leave') closeLeave();
      else if (screen === 'title') menuBack();
      else if (screen === 'settings' || screen === 'howto') setScreen('title');
      else if (screen === 'game') openLeave();
      else if (screen === 'lobby') leaveLobby();
    }
  } else if (edges.ui) {
    // Session-only, like `?ui=0`: this does not rewrite the saved GAME UI choice.
    applyUi(!uiEnabled, false);
  } else if (edges.menu) {
    // B is the deflect button in-game, so Start is the only menu button here.
    openLeave();
  }
}

function navItems(): HTMLButtonElement[] {
  const scope = overlayKind !== 'none' ? overlay : document.querySelector<HTMLElement>('.screen.active');
  if (!scope) return [];
  const nodes = scope.querySelectorAll<HTMLButtonElement>('button[data-nav]');
  const out: HTMLButtonElement[] = [];
  for (const node of nodes) {
    if (!node.disabled && !node.hidden && node.getClientRects().length > 0) out.push(node);
  }
  return out;
}

function resetNavFocus(): void {
  const active = document.querySelectorAll('.nav-focus');
  for (let i = 0; i < active.length; i++) active[i].classList.remove('nav-focus');
}

function preferredNavItem(items: HTMLButtonElement[]): HTMLButtonElement {
  return (
    items.find((b) => b.classList.contains('selected')) ??
    items.find((b) => !b.classList.contains('console-back') && !b.classList.contains('btn-ghost')) ??
    items[0]
  );
}

function moveNavDir(dx: number, dy: number): void {
  const items = navItems();
  if (items.length === 0) return;
  const active = document.activeElement as HTMLElement | null;
  let current = active && items.includes(active as HTMLButtonElement) ? (active as HTMLButtonElement) : null;
  if (!current) current = items.find((b) => b.classList.contains('nav-focus')) ?? null;
  if (!current) {
    // The first nudge lands on the stage's real entry point, not its BACK row.
    const first = preferredNavItem(items);
    resetNavFocus();
    first.classList.add('nav-focus');
    first.focus({ preventScroll: true });
    first.scrollIntoView({ block: 'nearest' });
    return;
  }
  const from = current.getBoundingClientRect();
  const cx = from.left + from.width * 0.5;
  const cy = from.top + from.height * 0.5;
  const group = current.closest('[role="group"]');
  let best: HTMLButtonElement | null = null;
  let bestScore = Infinity;
  let groupBest: HTMLButtonElement | null = null;
  let groupScore = Infinity;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === current) continue;
    const r = item.getBoundingClientRect();
    const ix = r.left + r.width * 0.5;
    const iy = r.top + r.height * 0.5;
    const along = (ix - cx) * dx + (iy - cy) * dy;
    // Require real travel in the pressed direction and prefer the nearest row/column.
    if (along < 6) continue;
    const perp = Math.abs(dx !== 0 ? iy - cy : ix - cx);
    const score = along + perp * 1.8;
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
    // Inside a card grid, stay in the grid while a neighbour exists. This keeps
    // DOWN on a card from jumping to a wide RUN button underneath it.
    if (group && group.contains(item) && score < groupScore) {
      groupScore = score;
      groupBest = item;
    }
  }
  const target = groupBest ?? best;
  if (!target) return;
  resetNavFocus();
  target.classList.add('nav-focus');
  target.focus({ preventScroll: true });
  // Keep controller focus inside the viewport on a TV-sized menu without
  // yanking the page around when the next row is already visible.
  target.scrollIntoView({ block: 'nearest' });
}

function activateNav(): void {
  const items = navItems();
  if (items.length === 0) return;
  const active = document.activeElement as HTMLElement | null;
  let target: HTMLButtonElement | undefined;
  if (active && items.includes(active as HTMLButtonElement)) target = active as HTMLButtonElement;
  else target = items.find((b) => b.classList.contains('nav-focus'));
  // No cursor yet: use the stage's first real option. A screen whose only control is
  // a back row (How to Play) must not close on an accidental confirm.
  if (!target) target = items.find((b) => !b.classList.contains('console-back') && !b.classList.contains('btn-ghost'));
  if (!target) return;
  resetNavFocus();
  target.classList.add('nav-focus');
  target.click();
}

// Names & boot helpers ----------------------------------------------------------------------

function loadName(): string {
  try {
    const stored = localStorage.getItem('deflect.name');
    if (stored) return sanitizeName(stored, randomCallsign());
  } catch {
    /* storage disabled */
  }
  return randomCallsign();
}

function getCallsign(): string {
  const name = sanitizeName(callsignInput.value, randomCallsign());
  callsignInput.value = name;
  try {
    localStorage.setItem('deflect.name', name);
  } catch {
    /* storage disabled */
  }
  return name;
}

function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, NET.roomCodeLength);
}

function isValidCode(code: string): boolean {
  return code.length === NET.roomCodeLength && /^[A-HJ-NP-Z2-9]+$/.test(code);
}

function refreshTitleButtons(): void {
  modeSoloBtn.disabled = busy;
  modeMultiBtn.disabled = busy;
  multiOnlineBtn.disabled = busy;
  localBtn.disabled = busy;
  settingsBtn.disabled = busy;
  howtoBtn.disabled = busy;
  trainingBtn.disabled = busy;
  soloBotsBtn.disabled = busy;
  createBtn.disabled = busy;
  joinBtn.disabled = busy || !isValidCode(roomCodeInput.value);
  gauntletBtn.disabled = busy;
  infectionBtn.disabled = busy;
  gauntletStartBtn.disabled = busy;
  soloCampaignBtn.disabled = busy;
}

function parseInviteHash(): void {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '')).toUpperCase();
  const code = normalizeCode(raw);
  if (isValidCode(code)) {
    roomCodeInput.value = code;
    setTitleStatus('INVITE CODE LOADED // PRESS JOIN');
    showMenuStage('online');
    refreshTitleButtons();
  }
}

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[DEFLECT-WARN] Service worker registration failed', err);
    });
  });
}

if (import.meta.env.DEV) {
  // Local playtest/debug handle. Stripped from production builds.
  (window as unknown as { __deflect: unknown }).__deflect = {
    getScreen: () => screen,
    getMode: () => mode,
    getWorld: () => world,
    getGuestView: () => guestView,
    getLobby: () => lobbyState,
    getArenaIndex: () => arenaIndex,
    getBots: () => botBrains,
    getRenderer: () => renderer,
    startTraining,
    startTrainingBots,
    startGauntlet,
    startInfection,
    startCampaignLevel,
    getCampaign: () => ({
      slot: campaignSlot,
      level: campaignLevelIndex,
      players: campaignPlayers,
      bots: campaignBots,
      deadBots: campaignBotDead,
      saved: campaignSaved,
    }),
    setCampaignLevel: (index: number) => {
      campaignLevelIndex = Math.max(0, Math.min(PLAYABLE_CAMPAIGN_LEVELS.length - 1, Math.floor(index)));
    },
    startBotMatch,
    startAutoplay,
    startStress,
    selectArena,
    setBotTier,
    setBotCount,
    openLeave,
    closeLeave,
  };
}

boot();
