import { ATTRACT, AUTO_ATTACK, CAMERA, CAMPAIGN, HAPTICS, MAX_PLAYERS, NET, ROUND, SIM_DT } from './game/config';
import { CAMPAIGN_LEVELS, FIRST_CAMPAIGN_LEVEL } from './game/campaign';
import { ARENAS, drawArenaPreview, getArena } from './game/arenas';
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
import { Input, type MenuEdges } from './game/input';
import { Renderer, type RenderState } from './game/render';
import { PROGRAM_ID, PROGRAMS, clampProgram, programDef } from './game/programs';
import { STORY_SLOT_COUNT, loadStorySlots, saveStoryProgress, type StorySave } from './game/saves';
import { SECTORS } from './game/sectors';
import { ACTION, EV, type GameEvent, type InputFrame, type LobbyPlayer, type LobbyState, type Phase } from './game/types';
import { World } from './game/world';
import { GuestNet, HostNet, NetView, type Snapshot } from './net/net';
import { clearChildren, drawAvatar, el, toast } from './ui/dom';
import { TouchControls } from './ui/touch';
import { drawProgramMark, drawSymbol, pathProgramFrame, pathProgramHealth, randomCallsign, sanitizeName, slotColor } from './game/identity';

type Screen = 'title' | 'lobby' | 'game' | 'settings' | 'howto';
type SettingsTab = 'feedback' | 'controls' | 'audio' | 'system';
type Mode = 'none' | 'training' | 'host' | 'guest' | 'bots' | 'gauntlet' | 'campaign';
type OverlayKind = 'none' | 'round' | 'match' | 'leave' | 'runover';

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
const countdownEl = el('countdown');
const countdownLabel = el('countdown-label');
const countdownValue = el<HTMLElement>('countdown-value');
const perfEl = el('perf');
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
const botCountEl = el('bot-count');
const botTierEl = el('bot-tier');
const botStageLabel = el('bot-stage-label');
const tierStageLabel = el('tier-stage-label');
const gauntletBtn = el<HTMLButtonElement>('btn-gauntlet');
const lobbyArenaBtn = el<HTMLButtonElement>('btn-arena-cycle');
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
const storySlotsEl = el('story-slots');
const storyStatusLine = el('story-status');
const storyBackBtn = el<HTMLButtonElement>('btn-story-back');
const menuStoryBots = el('menu-story-bots');
const storyBotsLabel = el('story-bots-label');
const storyBotsBackBtn = el<HTMLButtonElement>('btn-story-bots-back');
const menuArena = el('menu-arena');
const menuSoloBots = el('menu-solo-bots');
const menuSoloTier = el('menu-solo-tier');
const menuMulti = el('menu-multi');
const menuOnline = el('menu-online');
const menuLocal = el('menu-local');
const campaignBotsEl = el('campaign-bots');
const campaignFriendlyBtn = el<HTMLButtonElement>('btn-campaign-friendly-fire');
const campaignFriendlyValue = el('campaign-friendly-fire-value');
const soloCampaignBtn = el<HTMLButtonElement>('btn-solo-campaign');

const modeSoloBtn = el<HTMLButtonElement>('btn-mode-solo');
const modeMultiBtn = el<HTMLButtonElement>('btn-mode-multi');
const multiOnlineBtn = el<HTMLButtonElement>('btn-multi-online');
const localBtn = el<HTMLButtonElement>('btn-local');
const onlineBackBtn = el<HTMLButtonElement>('btn-online-back');
const localBackBtn = el<HTMLButtonElement>('btn-local-back');
const localArenaBtn = el<HTMLButtonElement>('btn-local-arena');
const localGauntletBtn = el<HTMLButtonElement>('btn-local-gauntlet');
const localStatusLine = el('local-status');
const soloBackBtn = el<HTMLButtonElement>('btn-solo-back');
const multiBackBtn = el<HTMLButtonElement>('btn-multi-back');
const bootScreen = el('boot');
const bootLog = el('boot-log');
const bootStatus = el('boot-status');

const renderer = new Renderer(canvas);
const input = new Input(canvas);
const audio = new AudioEngine();
const fx = new Fx();
const haptics = new Haptics(() => input.activePad());

let screen: Screen = 'title';
let mode: Mode = 'none';
/** QA self-play: bots drive every slot in a bot match, including slot 0. */
let autoplay = false;
let autoplayRestartAt = 0;
/**
 * Title-screen attract demo. `attract` is true while the bot-run gauntlet owns the
 * screen; `attractStartedAt` lets the next real input end it without the idle timer
 * immediately re-arming. `lastUserInputAt` is the hub's idle clock.
 */
let attract = false;
let attractStartedAt = 0;
let attractRestartAt = 0;
let lastUserInputAt = performance.now();
/** `?demo=true`: the attract pilot runs forever and ignores every wake input. */
let demo = false;
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
  | 'gauntlet'
  | 'story'
  | 'storyBots'
  | 'local'
  | 'multi'
  | 'online';
type SoloProgram = 'training' | 'bots' | 'gauntlet' | 'campaign';
let menuStage: MenuStage = 'hub';
let soloProgram: SoloProgram = 'training';
let selectedProgram: number = PROGRAM_ID.PROBE;
let settingsTab: SettingsTab = 'feedback';
let gauntletRecords: GauntletRun[] = [];
let gauntletRecorded = false;
/** Campaign drill squad size (0-3). A NO BOTS run still drills against one instructor. */
let campaignBots = 0;
/** Save-slot index being set up on the campaign stage; -1 when none is selected. */
let storySlot = -1;
/** Save slot of the live campaign run, and the run state a clear needs to persist. */
let campaignSlot = -1;
let campaignPlayers = 1;
let campaignSaved = false;
let campaignPlaySeconds = 0;
let lastCampaignPhase = '';

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
let botCount = 3;
let botTier: BotTier = 'veteran';
/** Training and VS BOTS keep separate difficulty picks; gauntlet/campaign use the training slot. */
const botTierPrefs: Record<'training' | 'bots', BotTier> = { training: 'veteran', bots: 'veteran' };
/** Local gauntlet/campaign run rule: enemy shots can damage other threat families. */
let friendlyFire = true;
let stress = false;
let stressBots = 0;
let stressTick = 0;

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
  // `?ui=0` hides the canvas UI for a clean capture without changing the saved setting.
  const uiParam = params.get('ui');
  if (uiParam === '0' || uiParam === 'off' || uiParam === 'false') applyUi(false, false);
  // `?demo=true` is the kiosk/showfloor boot: the attract pilot, permanently,
  // with every wake input ignored and a centered GAUNTLET title card. It owns
  // the page and takes precedence over the other boot hooks.
  const demoParam = params.get('demo');
  const demoMode = demoParam === '1' || demoParam === 'true';
  const attractParam = params.get('attract') === '1';
  const stressParam = Number(params.get('stress') ?? '0');
  const autoplayParam = Number(params.get('autoplay') ?? '0');
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
  // QA-only gauntlet hook: `?gauntlet=1&arena=5&bot=1` boots straight into a run and
  // lets a BotBrain drive the local player so the camera can be watched hands-off.
  const gauntletParam = Number(params.get('gauntlet') ?? '0');
  const gauntletBot = Number(params.get('bot') ?? '0') >= 1;
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
    };
  }
  if (demoMode) {
    window.setTimeout(() => startDemo(), 250);
  } else if (attractParam) {
    window.setTimeout(() => startAttract(), 250);
  } else if (stressParam >= 2 && stressParam <= MAX_PLAYERS) {
    window.setTimeout(() => startStress(stressParam), 250);
  } else if (gauntletParam >= 1) {
    window.setTimeout(() => startGauntlet(gauntletBot), 250);
  } else if (autoplayParam >= 1) {
    window.setTimeout(() => startAutoplay(autoplayParam), 250);
  }

  requestAnimationFrame(loop);
  console.log('[DEFLECT-INIT] Build 0.1.61 ready. Max players:', MAX_PLAYERS);
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
  localArenaBtn.addEventListener('click', () => {
    localStatusLine.textContent = 'LOCAL ARENA // NOT WIRED YET. THE SETUP SCREEN COMES FIRST.';
  });
  localGauntletBtn.addEventListener('click', () => {
    localStatusLine.textContent = 'LOCAL GAUNTLET // NOT WIRED YET. THE SETUP SCREEN COMES FIRST.';
  });
  programBackBtn.addEventListener('click', () => programStageBack());
  soloBackBtn.addEventListener('click', () => showMenuStage('hub'));
  multiBackBtn.addEventListener('click', () => showMenuStage('hub'));
  trainingBtn.addEventListener('click', () => openProgramSelect('training'));
  soloBotsBtn.addEventListener('click', () => openProgramSelect('bots'));
  gauntletBtn.addEventListener('click', () => openProgramSelect('gauntlet'));
  soloCampaignBtn.addEventListener('click', openStory);
  storyBackBtn.addEventListener('click', () => showMenuStage('solo'));
  storyBotsBackBtn.addEventListener('click', () => showMenuStage('story'));
  el<HTMLButtonElement>('btn-arena-back').addEventListener('click', () => showMenuStage('soloProgram'));
  el<HTMLButtonElement>('btn-gauntlet-back').addEventListener('click', () => showMenuStage('soloArena'));
  gauntletStartBtn.addEventListener('click', () => startGauntlet());
  gauntletFriendlyBtn.addEventListener('click', toggleFriendlyFire);
  campaignFriendlyBtn.addEventListener('click', toggleFriendlyFire);
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
  if (screen === 'game' && audio.musicWanted) audio.startMusic();
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
  menuStory.hidden = stage !== 'story';
  menuStoryBots.hidden = stage !== 'storyBots';
  menuLocal.hidden = stage !== 'local';
  menuMulti.hidden = stage !== 'multi';
  menuOnline.hidden = stage !== 'online';
  if (stage === 'soloProgram') renderProgramPicker();
  if (stage === 'soloArena') updateSoloArenaCopy();
  // Count and tier options depend on the mode: training can be solo, VS BOTS cannot.
  if (stage === 'soloBots' || stage === 'soloTier') renderBotControls();
  if (stage === 'gauntlet') renderGauntletSetup();
  if (stage === 'story') renderStorySetup();
  if (stage === 'storyBots') renderStoryBots();
  if (stage === 'local') localStatusLine.textContent = '';
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
          : 'CAMPAIGN // PLAYER SELECT';
}

function updateSoloArenaCopy(): void {
  const def = programDef(selectedProgram);
  const label = soloProgram === 'training' ? 'TRAINING' : soloProgram === 'bots' ? 'VS BOTS' : 'GAUNTLET';
  arenaStageLabel.textContent = `${label} // ${def.name} // SELECT ARENA`;
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
  if (menuStage === 'soloTier') showMenuStage('soloBots');
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
 * Compactor arenas are local content. The slam is host-side world state and the match
 * snapshot carries no pusher timer, so a guest would be shoved by nothing. Keep them out
 * of hosted rooms and let training, VS BOTS and the gauntlet use them.
 */
function onlineArenaIndex(index: number): number {
  const n = ARENAS.length;
  const start = ((index % n) + n) % n;
  if (!ARENAS[start].pushers) return start;
  for (let i = 1; i < n; i++) {
    const idx = (start + i) % n;
    if (!ARENAS[idx].pushers) return idx;
  }
  return start;
}

function renderArenaPicker(): void {
  clearChildren(arenaPicker);
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
      if (menuStage !== 'soloArena' || screen !== 'title') return;
      if (soloProgram === 'gauntlet') showMenuStage('gauntlet');
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

function toggleFriendlyFire(): void {
  friendlyFire = !friendlyFire;
  persistArenaPrefs();
  renderFriendlyFire();
  toast(`FRIENDLY FIRE // ${friendlyFire ? 'ON' : 'OFF'}`);
}

function renderGauntletSetup(): void {
  const arena = getArena(arenaIndex);
  const def = programDef(selectedProgram);
  gauntletStageLabel.textContent = `GAUNTLET // ${def.name} // ${arena.name}`;
  renderFriendlyFire();
  renderGauntletRecords();
}

/**
 * Campaign entry. Slots come first: an empty slot starts a new run and continues to the
 * bot count and player select; a filled slot resumes the run stored on it. Nothing is
 * playable yet, so a resume press only reports that.
 */
function openStory(): void {
  soloProgram = 'campaign';
  storySlot = -1;
  storyStatusLine.textContent = '';
  showMenuStage('story');
}

function renderStorySetup(): void {
  renderFriendlyFire();
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
 * The first node is the only authored level today, so a cleared save replays it until
 * the next node ships. A save is written only when a level completes.
 */
function startNewCampaign(): void {
  campaignSlot = storySlot;
  campaignPlayers = 1;
  campaignSaved = false;
  campaignPlaySeconds = 0;
  startCampaignLevel();
}

function resumeCampaign(index: number, save: StorySave): void {
  campaignSlot = index;
  campaignPlayers = save.players;
  campaignBots = save.bots;
  selectedProgram = clampProgram(save.program);
  campaignSaved = false;
  campaignPlaySeconds = 0;
  startCampaignLevel();
  if (save.level >= CAMPAIGN_LEVELS.length) {
    toast('NEXT NODE NOT BUILT // REPLAYING BUILD ROOT', 'warn');
  }
}

function startCampaignLevel(): void {
  if (busy) return;
  teardownSession();
  hideOverlayInternal();
  mode = 'campaign';
  localSlot = 0;
  stress = false;
  const level = FIRST_CAMPAIGN_LEVEL;
  const arena = getArena(level.arenaId);
  const drill = Math.max(
    CAMPAIGN.minDrillBots,
    Math.min(CAMPAIGN.maxDrillBots, campaignBots > 0 ? campaignBots : CAMPAIGN.minDrillBots),
  );
  const names = new Array(MAX_PLAYERS).fill('');
  names[0] = getCallsign();
  for (let i = 1; i <= drill; i++) names[i] = BOT_NAMES[(i - 1) % BOT_NAMES.length];
  const botPrograms = botProgramList(drill);
  world = new World('gauntlet', names, 0, arena, false, selectedProgram, drill, botPrograms, true, level.dataCrates);
  world.friendlyFire = friendlyFire;
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
  lastCampaignPhase = 'drill';
  fx.reset();
  setScreen('game');
  beginLoadSequence(`${level.name} // ${level.code}`);
  audio.unlock();
  audio.startMusic();
  console.log('[DEFLECT-STATE] Campaign node', level.name, 'drill bots', drill, 'friendly fire', friendlyFire ? 'on' : 'off');
}

/** Back to the save-slot stage, abandoning the live node. */
function returnToStory(): void {
  teardownSession();
  campaignSlot = -1;
  storySlot = -1;
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

function renderStorySlots(): void {
  const slots = loadStorySlots();
  clearChildren(storySlotsEl);
  for (let i = 0; i < STORY_SLOT_COUNT; i++) {
    const save = slots[i];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'console-option';
    button.dataset.nav = '';

    const key = document.createElement('span');
    key.className = 'option-key option-key-wide';
    key.textContent = `SLOT ${i + 1}`;
    const label = document.createElement('span');
    label.className = 'option-label';
    const value = document.createElement('span');
    value.className = 'option-value';

    if (save) {
      const sector = SECTORS[save.sector];
      const where = sector ? sector.name : `CAMPAIGN ${save.sector + 1}`;
      label.textContent = save.level > 0 ? `${where} // LV ${save.level}` : where;
      value.textContent = `${save.players} PLAYER${save.players === 1 ? '' : 'S'}`;
      button.setAttribute('aria-label', `Slot ${i + 1}, ${label.textContent}, ${value.textContent}, resume`);
    } else {
      label.textContent = 'START NEW GAME';
      button.setAttribute('aria-label', `Slot ${i + 1}, start a new game`);
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
    storySlotsEl.appendChild(button);
  }
}

function loadCampaignPrefs(): void {
  try {
    const saved = Number(localStorage.getItem('deflect.campaignBots') ?? '0');
    if (Number.isFinite(saved) && saved >= 0 && saved <= 3) campaignBots = Math.round(saved);
  } catch {
    /* storage disabled: no companions */
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
      if (soloProgram === 'bots') startBotMatch();
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
  input.poll();
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
  if (screen === 'game' && !loading && overlayKind === 'none') applyInputAssist(localFrame);

  if (screen === 'game' && (world || guestView)) {
    if (!loading) stepSession(now, dt);
    const state: RenderState | null = guestView ?? world;
    if (state) {
      if (guestView) guestView.present();
      trackLocalHit(state);
      syncPhaseUi(state);
      fx.update(dt);
      renderer.render(state, Math.min(1, acc / SIM_DT), fx);
      // A split/merge moves every local player's screen position at once. Give the
      // local sim a short dip while the cameras settle, but never slow a networked
      // match or the unattended stress run.
      const localMode = mode === 'training' || mode === 'bots' || mode === 'gauntlet' || mode === 'campaign';
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

  updatePerf(dt);
}

function trackLocalHit(state: RenderState): void {
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
function playRumble(cue: RumbleCue): void {
  if (attract || stress || screen !== 'game' || overlayKind !== 'none' || loading) return;
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
    (mode === 'training' || mode === 'bots' || mode === 'gauntlet' || mode === 'campaign') &&
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
      const drillLive = !world.campaign || world.campaignPhase === 'drill';
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
  fx.handle(e);
  const own = e.slot === localSlot;
  // Haptics run before the guest's predicted-action sound skip, so a guest still
  // feels their own swing and dash. Hits are read from the local health change.
  if (own) {
    if (e.kind === EV.SWING || e.kind === EV.DASH) {
      playRumble('tap');
    } else if (e.kind === EV.DEFLECT) {
      playRumble('guard');
    } else if (e.kind === EV.LASER) {
      // An overcharge beam emits a LASER event on every refill tick. Only cue when a
      // new beam starts, not sixteen times a second while the trigger is held.
      const now = performance.now();
      if (now - lastLaserRumbleAt > 400) playRumble('heavy');
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
  console.log('[DEFLECT-STATE] Training bots', botCount, botTier, arena.name);
}

function startGauntlet(aiLocal = false): void {
  if (busy) return;
  teardownSession();
  hideOverlayInternal();
  mode = 'gauntlet';
  localSlot = 0;
  stress = false;
  autoplay = aiLocal;
  const arena = getArena(arenaIndex);
  world = new World('gauntlet', [getCallsign()], 0, arena, false, selectedProgram);
  world.friendlyFire = friendlyFire;
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
  console.log('[DEFLECT-STATE] Gauntlet start', arena.name, 'one life', aiLocal ? 'AUTOPILOT' : '', 'friendly fire', friendlyFire ? 'on' : 'off');
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
 * differences are that no wake input ends it and a GAUNTLET title card fades on
 * a 30 s cycle. This is a boot mode, not a pause or a menu state.
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
  teardownSession();
  hideOverlayInternal();
  mode = 'gauntlet';
  localSlot = 0;
  stress = false;
  // The demo is unattended: the gauntlet step path reads `autoplay` to let slot 0 be
  // driven by its BotBrain. The bots-mode rematch hook only fires in `mode === 'bots'`.
  autoplay = true;
  const program = PROGRAMS[Math.floor(Math.random() * PROGRAMS.length)].id;
  const arena = ARENAS[Math.floor(Math.random() * ARENAS.length)];
  world = new World('gauntlet', ['DEMO'], 0, arena, false, program);
  world.seedAttractRun(ATTRACT.wave);
  trainingInputs = [localFrame];
  botInputs = new Array(MAX_PLAYERS);
  for (let i = 0; i < MAX_PLAYERS; i++) botInputs[i] = { mx: 0, my: 0, held: 0, pressed: 0 };
  botBrains = new Array(MAX_PLAYERS).fill(null);
  botBrains[0] = new BotBrain(0, 'digital', 0, 0x51f15e + arena.id * 967 + 11);
  resetCounters();
  fx.reset();
  renderer.showUi = false;
  setScreen('game');
  audio.unlock();
  audio.startMusic();
  console.log('[DEFLECT-ATTRACT]', programDef(program).name, arena.name, 'wave', ATTRACT.wave);
}

function exitAttract(): void {
  if (!attract || demo) return;
  attract = false;
  attractRestartAt = 0;
  teardownSession();
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
    if (world && world.gauntletOver) {
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

function startBotMatch(aiLocal = false): void {
  if (busy) return;
  if (botCount < 1) botCount = 1;
  teardownSession();
  mode = 'bots';
  localSlot = 0;
  stress = false;
  autoplay = aiLocal;
  autoplayRestartAt = 0;
  const arena = getArena(arenaIndex);
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
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(arena.name);
  audio.unlock();
  audio.startMusic();
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
        if (world.activeCount() < 2) endMatchToLobby('MATCH ABANDONED // NOT ENOUGH OPERATORS');
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
    net.setArena(arenaIndex);
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
    onStart: (arenaId) => {
      if (guestNet !== net) return;
      startGuestGame(arenaId);
    },
    onSnapshot: (snap: Snapshot) => {
      if (guestNet !== net || !guestView) return;
      guestView.pushSnapshot(snap);
      handleRemoteEvents(snap.events);
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

function startGuestGame(arenaId: number): void {
  if (!guestNet) return;
  localSlot = guestNet.slot >= 0 ? guestNet.slot : 0;
  const arena = getArena(arenaId);
  arenaIndex = arena.id;
  guestView = new NetView(localSlot, arena);
  guestView.names = namesFromLobby();
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(arena.name);
  audio.unlock();
  audio.startMusic();
  console.log('[DEFLECT-STATE] Guest match start, slot', localSlot, arena.name);
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
  const arena = getArena(onlineArenaIndex(hostNet.getArenaIndex()));
  arenaIndex = arena.id;
  world = new World('match', names, 0, arena);
  hostNet.inputs[0] = localFrame;
  hostNet.startMatch(arena.id);
  localSlot = 0;
  stress = false;
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(arena.name);
  audio.unlock();
  audio.startMusic();
  console.log('[DEFLECT-STATE] Host match start with', connected.length, 'operators');
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
  hostNet.setInMatch(false);
  lobbyState = hostNet.getLobbyState();
  setScreen('lobby');
  renderLobby(lobbyState);
  audio.stopMusic();
  resetCounters();
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
  if (mode !== 'bots' || !world) return;
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
  toast('SIMULATION RESET');
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
  teardownSession();
  showMenuStage('hub');
  setScreen('title');
  busy = false;
  refreshTitleButtons();
  setTitleStatus('');
}

function teardownSession(): void {
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
  gauntletRecorded = false;
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
  if (mode === 'campaign' && world) {
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
      if (deathHoldUntil === 0) deathHoldUntil = performance.now() + DEATH_HOLD_MS;
      if (performance.now() >= deathHoldUntil) {
        if (world.campaignPhase === 'cleared') showCampaignClearOverlay(world);
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
    if (state.phase === 'roundover') {
      showRoundOverlay(state);
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
  const sub = `${scoreLine(state)} // ${state.matchWinner >= 0 ? 'MATCH POINT SECURED' : `FIRST TO ${ROUND.winsNeeded}`}`;
  setOverlay('round', 'ROUND COMPLETE', title, sub, []);
}

function showGauntletOverOverlay(state: RenderState): void {
  if (overlayKind === 'leave' || overlayKind === 'runover') return;
  const wave = Math.max(1, state.wave ?? 1);
  const seconds = Math.max(0, state.gauntletTime ?? 0);
  const kills = Math.max(0, state.gauntletKills ?? 0);
  const previousBest = gauntletRecords[0];
  const newBest =
    !previousBest ||
    wave > previousBest.wave ||
    (wave === previousBest.wave &&
      (seconds > previousBest.seconds ||
        (seconds === previousBest.seconds && kills > previousBest.kills)));

  let rank = 0;
  if (!gauntletRecorded) {
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
  const resultLine = newBest ? 'NEW PERSONAL BEST' : place;
  const actions: OverlayAction[] = [
    { label: 'RETRY', primary: true, onClick: startGauntlet },
    { label: 'SETUP', onClick: returnToGauntletSetup },
    { label: 'TITLE', onClick: leaveToTitle },
  ];
  setOverlay(
    'runover',
    'GAUNTLET // RING BROKEN',
    `WAVE ${wave} // ${formatGauntletTime(seconds)}`,
    `${kills} KILLS // ${resultLine} // ${state.arena.name}`,
    actions,
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

function showCampaignClearOverlay(w: World): void {
  if (overlayKind === 'leave' || overlayKind === 'runover') return;
  const { score, clean } = scoreCampaign(w);
  let bestLine = '';
  if (!campaignSaved && campaignSlot >= 0) {
    const level = FIRST_CAMPAIGN_LEVEL;
    const prev = loadStorySlots()[campaignSlot];
    const bestScore = Math.max(prev?.bestScore ?? 0, score);
    const cleanSweeps = (prev?.cleanSweeps ?? 0) + (clean ? 1 : 0);
    saveStoryProgress(campaignSlot, {
      program: selectedProgram,
      sector: level.sector,
      nodeId: level.nodeId,
      level: 1,
      players: campaignPlayers,
      bots: campaignBots,
      playSeconds: Math.floor(campaignPlaySeconds),
      bestScore,
      cleanSweeps,
    });
    campaignSaved = true;
    bestLine = ` // BEST ${bestScore}`;
  } else if (campaignSlot >= 0) {
    bestLine = ` // BEST ${loadStorySlots()[campaignSlot]?.bestScore ?? score}`;
  }
  const dataLine = w.dataTotal > 0 ? `DATA ${w.dataKept}/${w.dataTotal}` : 'NO DATA AT RISK';
  setOverlay(
    'runover',
    'CAMPAIGN // NODE CLEARED',
    'BUILD ROOT SECURED',
    `${w.gauntletKills} KILLS // ${formatGauntletTime(campaignPlaySeconds)} // ${w.campaignDamage} DAMAGE TAKEN // ${dataLine}${
      clean ? ' // CLEAN SWEEP' : ''
    } // SCORE ${score}${bestLine}`,
    [
      { label: 'CONTINUE', primary: true, onClick: returnToStory },
      { label: 'REPLAY', onClick: startCampaignLevel },
    ],
  );
}

function showCampaignFailOverlay(w: World): void {
  if (overlayKind === 'leave' || overlayKind === 'runover') return;
  setOverlay(
    'runover',
    'CAMPAIGN // SIGNAL LOST',
    'RING BROKEN',
    `${w.gauntletKills} / ${CAMPAIGN.killsToClear} THREATS DELETED // ${FIRST_CAMPAIGN_LEVEL.name}`,
    [
      { label: 'RETRY', primary: true, onClick: startCampaignLevel },
      { label: 'SLOTS', onClick: returnToStory },
    ],
  );
}

function showMatchOverlay(state: RenderState): void {
  if (overlayKind === 'leave') return;
  const winner = state.matchWinner;
  const title = winner >= 0 ? `${nameOf(state, winner)} WINS` : 'MATCH COMPLETE';
  const sub = `${scoreLine(state)} // FIRST TO ${ROUND.winsNeeded}${
    mode === 'guest' ? ' // WAITING FOR HOST TO REMATCH' : ''
  }`;
  const actions: OverlayAction[] = [];
  if (mode === 'host') {
    actions.push({ label: 'REMATCH', primary: true, onClick: hostRematch });
    actions.push({ label: 'RETURN TO LOBBY', onClick: returnToLobby });
  } else if (mode === 'guest') {
    actions.push({ label: 'LEAVE ROOM', onClick: leaveToTitle });
  } else if (mode === 'bots') {
    actions.push({ label: 'REMATCH', primary: true, onClick: localRematch });
    actions.push({ label: 'RETURN TO TITLE', onClick: leaveToTitle });
  }
  setOverlay('match', 'MATCH COMPLETE', title, sub, actions);
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
  const local = mode === 'training' || mode === 'bots' || mode === 'gauntlet' || campaignRun;
  const training = mode === 'training' && !stress;
  const botMatch = mode === 'bots';
  const gauntlet = mode === 'gauntlet';
  const paused = training || botMatch || gauntlet || campaignRun;
  setOverlay(
    'leave',
    paused ? 'SYSTEM // PAUSED' : 'SYSTEM // LIVE',
    training
      ? 'LEAVE TRAINING?'
      : botMatch
        ? 'LEAVE BOT MATCH?'
        : campaignRun
          ? 'EXIT NODE?'
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
    [
      { label: 'STAY', onClick: closeLeave },
      { label: 'LEAVE', primary: true, onClick: campaignRun ? returnToStory : leaveToTitle },
    ],
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
  const lobbyArena = getArena(state?.arenaId ?? arenaIndex);
  lobbyArenaBtn.textContent = `ARENA: ${lobbyArena.name}`;
  lobbyArenaBtn.disabled = mode !== 'host' || busy;

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
    startCampaignLevel,
    getCampaign: () => ({ slot: campaignSlot, players: campaignPlayers, bots: campaignBots, saved: campaignSaved }),
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
