import { MAX_PLAYERS, NET, ROUND, SIM_DT } from './game/config';
import { ARENAS, drawArenaPreview, getArena } from './game/arenas';
import { BOT_NAMES, BOT_STYLE_LABELS, BOT_TIERS, BOT_TIER_LABELS, BotBrain, type BotTier } from './game/bot';
import { AudioEngine } from './game/audio';
import { Fx } from './game/fx';
import { Input, type MenuEdges } from './game/input';
import { Renderer, type RenderState } from './game/render';
import { ACTION, EV, type GameEvent, type InputFrame, type LobbyPlayer, type LobbyState, type Phase } from './game/types';
import { World } from './game/world';
import { GuestNet, HostNet, NetView, type Snapshot } from './net/net';
import { clearChildren, drawAvatar, el, toast } from './ui/dom';
import { randomCallsign, sanitizeName, slotColor } from './game/identity';

type Screen = 'title' | 'lobby' | 'game' | 'settings';
type SettingsTab = 'controls' | 'feedback' | 'audio' | 'system';
type Mode = 'none' | 'training' | 'host' | 'guest' | 'bots' | 'gauntlet';
type OverlayKind = 'none' | 'round' | 'match' | 'leave';

const canvas = el<HTMLCanvasElement>('arena');
const titleScreen = el('screen-title');
const settingsScreen = el('screen-settings');
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
const callsignInput = el<HTMLInputElement>('callsign');
const roomCodeInput = el<HTMLInputElement>('room-code');
const titleStatus = el('title-status');
const trainingBtn = el<HTMLButtonElement>('btn-training');
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
const arenaContinueLabel = el('arena-continue-label');
const arenaContinueBtn = el<HTMLButtonElement>('btn-arena-continue');
const botCountEl = el('bot-count');
const botTierEl = el('bot-tier');
const botStageLabel = el('bot-stage-label');
const tierStageLabel = el('tier-stage-label');
const botRoster = el('bot-roster');
const botBtn = el<HTMLButtonElement>('btn-bots');
const botRunBtn = el<HTMLButtonElement>('btn-bots-run');
const botStartLabel = el('bot-start-label');
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
const resetSettingsBtn = el<HTMLButtonElement>('btn-settings-reset');
const testFeedbackBtn = el<HTMLButtonElement>('btn-test-feedback');
const menuHub = el('menu-hub');
const menuSolo = el('menu-solo');
const menuArena = el('menu-arena');
const menuSoloBots = el('menu-solo-bots');
const menuSoloTier = el('menu-solo-tier');
const menuMulti = el('menu-multi');
const modeSoloBtn = el<HTMLButtonElement>('btn-mode-solo');
const modeMultiBtn = el<HTMLButtonElement>('btn-mode-multi');
const soloBackBtn = el<HTMLButtonElement>('btn-solo-back');
const multiBackBtn = el<HTMLButtonElement>('btn-multi-back');
const bootScreen = el('boot');
const bootLog = el('boot-log');
const bootStatus = el('boot-status');

const renderer = new Renderer(canvas);
const input = new Input(canvas);
const audio = new AudioEngine();
const fx = new Fx();

let screen: Screen = 'title';
let mode: Mode = 'none';
let world: World | null = null;
let hostNet: HostNet | null = null;
let guestNet: GuestNet | null = null;
let guestView: NetView | null = null;
let lobbyState: LobbyState | null = null;
let localSlot = 0;
let busy = false;
let overlayKind: OverlayKind = 'none';
type MenuStage = 'hub' | 'solo' | 'soloArena' | 'soloBots' | 'soloTier' | 'multi';
type SoloProgram = 'training' | 'gauntlet';
let menuStage: MenuStage = 'hub';
let soloProgram: SoloProgram = 'training';
let settingsTab: SettingsTab = 'controls';

const localFrame: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
let trainingInputs: (InputFrame | null)[] = [localFrame];
let stressInputs: InputFrame[] = [];
let botInputs: InputFrame[] = [];
let botBrains: (BotBrain | null)[] = [];
let arenaIndex = 0;
let botCount = 3;
let botTier: BotTier = 'veteran';
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
let lastCountdownText = '';
let lastBounceSound = 0;
let lastThreatSound = 0;
let lastLocalHp = -1;
let loading = false;
let loadingUntil = 0;
let bootShownAt = 0;
let bootLeaving = false;

// Boot -------------------------------------------------------------------------------------

function boot(): void {
  const stored = loadName();
  callsignInput.value = stored;
  loadArenaPrefs();
  loadSettings();
  updateMuteLabel();
  bindUi();
  renderArenaPicker();
  renderBotControls();
  showMenuStage('hub', false);
  parseInviteHash();
  refreshTitleButtons();
  registerServiceWorker();
  if (screen === 'title') focusMenuStage();

  const stressParam = Number(new URLSearchParams(location.search).get('stress') ?? '0');
  if (stressParam >= 2 && stressParam <= MAX_PLAYERS) {
    window.setTimeout(() => startStress(stressParam), 250);
  }

  requestAnimationFrame(loop);
  console.log('[DEFLECT-INIT] Build 0.1.9 ready. Max players:', MAX_PLAYERS);
}

function bindUi(): void {
  modeSoloBtn.addEventListener('click', () => showMenuStage('solo'));
  modeMultiBtn.addEventListener('click', () => showMenuStage('multi'));
  soloBackBtn.addEventListener('click', () => showMenuStage('hub'));
  multiBackBtn.addEventListener('click', () => showMenuStage('hub'));
  trainingBtn.addEventListener('click', () => openSoloArena('training'));
  gauntletBtn.addEventListener('click', () => openSoloArena('gauntlet'));
  el<HTMLButtonElement>('btn-arena-back').addEventListener('click', () => showMenuStage('solo'));
  el<HTMLButtonElement>('btn-bots-back').addEventListener('click', () => showMenuStage('soloArena'));
  el<HTMLButtonElement>('btn-tier-back').addEventListener('click', () => showMenuStage('soloBots'));
  arenaContinueBtn.addEventListener('click', () => {
    if (soloProgram === 'training') showMenuStage('soloBots');
    else startGauntlet();
  });
  createBtn.addEventListener('click', () => void createRoom());
  joinBtn.addEventListener('click', joinRoom);
  settingsMuteBtn.addEventListener('click', () => {
    toggleMute();
  });
  settingsBtn.addEventListener('click', openSettings);
  titleScreen.addEventListener('pointerover', (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('#screen-title button[data-nav]');
    if (!button || button.disabled || document.activeElement === button) return;
    resetNavFocus();
    button.classList.add('nav-focus');
    button.focus({ preventScroll: true });
  });
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
  testFeedbackBtn.addEventListener('click', () => {
    audio.hit();
    fx.triggerHitRotation();
    fx.handle({ kind: EV.HIT, slot: 0, x: 640, y: 360, power: 0, dirX: 1, dirY: 0 });
  });
  resetSettingsBtn.addEventListener('click', resetSettings);
  el<HTMLButtonElement>('btn-lobby-back').addEventListener('click', leaveLobby);
  readyBtn.addEventListener('click', toggleReady);
  startBtn.addEventListener('click', startHostMatch);
  copyBtn.addEventListener('click', () => void copyInvite());
  lobbyArenaBtn.addEventListener('click', cycleLobbyArena);
  botBtn.addEventListener('click', () => showMenuStage('soloTier'));
  botRunBtn.addEventListener('click', startTrainingBots);
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
  window.addEventListener('resize', () => renderer.resize());
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

function showMenuStage(stage: MenuStage, focus = true): void {
  menuStage = stage;
  menuHub.hidden = stage !== 'hub';
  menuSolo.hidden = stage !== 'solo';
  menuArena.hidden = stage !== 'soloArena';
  menuSoloBots.hidden = stage !== 'soloBots';
  menuSoloTier.hidden = stage !== 'soloTier';
  menuMulti.hidden = stage !== 'multi';
  if (stage === 'soloArena') updateSoloArenaCopy();
  resetNavFocus();
  if (focus) focusMenuStage();
}

function openSoloArena(program: SoloProgram): void {
  soloProgram = program;
  showMenuStage('soloArena');
}

function updateSoloArenaCopy(): void {
  const training = soloProgram === 'training';
  arenaStageLabel.textContent = `${training ? 'TRAINING' : 'GAUNTLET'} // SELECT ARENA`;
  arenaContinueLabel.textContent = training ? 'NEXT // OPPOSITION' : 'ENTER GAUNTLET';
}

function focusMenuStage(): void {
  if (menuStage === 'hub') {
    resetNavFocus();
    modeSoloBtn.classList.add('nav-focus');
    modeSoloBtn.focus({ preventScroll: true });
    return;
  }
  if (menuStage === 'solo') {
    resetNavFocus();
    trainingBtn.classList.add('nav-focus');
    trainingBtn.focus({ preventScroll: true });
    return;
  }
  if (menuStage === 'soloArena') {
    const card = arenaPicker.querySelector<HTMLButtonElement>('.console-arena-card.selected');
    resetNavFocus();
    (card ?? arenaContinueBtn).classList.add('nav-focus');
    (card ?? arenaContinueBtn).focus({ preventScroll: true });
    return;
  }
  if (menuStage === 'soloBots') {
    const card = botCountEl.querySelector<HTMLButtonElement>('.selected') ?? botBtn;
    resetNavFocus();
    card.classList.add('nav-focus');
    card.focus({ preventScroll: true });
    return;
  }
  if (menuStage === 'soloTier') {
    const card = botTierEl.querySelector<HTMLButtonElement>('.selected') ?? botRunBtn;
    resetNavFocus();
    card.classList.add('nav-focus');
    card.focus({ preventScroll: true });
    return;
  }
  resetNavFocus();
  createBtn.classList.add('nav-focus');
  createBtn.focus({ preventScroll: true });
}

function menuBack(): void {
  if (screen !== 'title') return;
  if (menuStage === 'soloTier') showMenuStage('soloBots');
  else if (menuStage === 'soloBots') showMenuStage('soloArena');
  else if (menuStage === 'soloArena') showMenuStage('solo');
  else if (menuStage !== 'hub') showMenuStage('hub');
}

// Arena & bot setup --------------------------------------------------------------------------

function loadArenaPrefs(): void {
  try {
    const savedArena = Number(localStorage.getItem('deflect.arena') ?? '0');
    if (Number.isFinite(savedArena)) arenaIndex = ((savedArena % ARENAS.length) + ARENAS.length) % ARENAS.length;
    const savedCount = Number(localStorage.getItem('deflect.botCount') ?? '3');
    if (savedCount >= 1 && savedCount <= 3) botCount = savedCount;
    const savedTier = localStorage.getItem('deflect.botTier');
    if (savedTier && (BOT_TIERS as readonly string[]).includes(savedTier)) botTier = savedTier as BotTier;
  } catch {
    /* storage disabled: use defaults */
  }
}

function loadSettings(): void {
  let rotation = 1;
  let flash = 1;
  let scanlines = true;
  let minimap = true;
  try {
    const rawRotation = localStorage.getItem('deflect.hitRotation');
    const savedRotation = rawRotation === null ? NaN : Number(rawRotation);
    if (Number.isFinite(savedRotation) && savedRotation >= 0 && savedRotation <= 1) rotation = savedRotation;
    const rawFlash = localStorage.getItem('deflect.flash');
    const savedFlash = rawFlash === null ? NaN : Number(rawFlash);
    if (Number.isFinite(savedFlash) && savedFlash >= 0 && savedFlash <= 1) flash = savedFlash;
    scanlines = localStorage.getItem('deflect.scanlines') !== '0';
    minimap = localStorage.getItem('deflect.minimap') !== '0';
  } catch {
    /* storage disabled: defaults */
  }
  applyHitRotation(rotation, false);
  applyFlash(flash, false);
  applyScanlines(scanlines, false);
  applyMinimap(minimap, false);
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

function resetSettings(): void {
  applyHitRotation(1, true);
  applyFlash(1, true);
  applyVolume(0.8, true);
  applyMusicVolume(0.65, true);
  applySfxVolume(0.9, true);
  applyMenuVolume(0.8, true);
  applyScanlines(true, true);
  applyMinimap(true, true);
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
  } catch {
    /* storage disabled */
  }
}

function selectArena(index: number): void {
  arenaIndex = ((index % ARENAS.length) + ARENAS.length) % ARENAS.length;
  persistArenaPrefs();
  renderArenaPicker();
  if (mode === 'host' && hostNet) {
    hostNet.setArena(arenaIndex);
    lobbyState = hostNet.getLobbyState();
    if (screen === 'lobby') renderLobby(lobbyState);
  }
}

function renderArenaPicker(): void {
  const keepFocus = arenaPicker.contains(document.activeElement);
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
    card.addEventListener('click', () => selectArena(i));
    arenaPicker.appendChild(card);
  }
  if (keepFocus) arenaPicker.querySelector<HTMLButtonElement>('.selected')?.focus({ preventScroll: true });
}

function renderBotControls(): void {
  const keepCount = botCountEl.contains(document.activeElement);
  const keepTier = botTierEl.contains(document.activeElement);
  clearChildren(botCountEl);
  const counts = [1, 2, 3];
  for (let i = 0; i < counts.length; i++) {
    const count = counts[i];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `console-choice${botCount === count ? ' selected' : ''}`;
    button.dataset.nav = '';
    button.textContent = count === 1 ? '1 V 1' : `1 V ${count}`;
    button.setAttribute('aria-pressed', String(botCount === count));
    button.addEventListener('click', () => setBotCount(count));
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
    button.addEventListener('click', () => setBotTier(tier));
    botTierEl.appendChild(button);
  }
  updateBotSummary();
  if (keepCount) botCountEl.querySelector<HTMLButtonElement>('.selected')?.focus();
  else if (keepTier) botTierEl.querySelector<HTMLButtonElement>('.selected')?.focus();
}

function setBotCount(count: number): void {
  botCount = Math.max(1, Math.min(3, count));
  persistArenaPrefs();
  renderBotControls();
}

function setBotTier(tier: BotTier): void {
  botTier = tier;
  persistArenaPrefs();
  renderBotControls();
}

function updateBotSummary(): void {
  botStageLabel.textContent = `TRAINING // BOT COUNT // ${botCount === 1 ? '1 V 1' : `1 V ${botCount}`}`;
  tierStageLabel.textContent = `TRAINING // DIFFICULTY // ${BOT_TIER_LABELS[botTier]}`;
  botStartLabel.textContent = `START ${botCount === 1 ? 'BOT DUEL' : `BOT ${botCount}`}`;
  botRoster.textContent = `STYLES // ${BOT_NAMES.slice(0, botCount)
    .map((name, i) => `${name} ${BOT_STYLE_LABELS[i]}`)
    .join(' / ')}`;
}

function cycleLobbyArena(): void {
  if (mode !== 'host' || !hostNet) return;
  arenaIndex = (arenaIndex + 1) % ARENAS.length;
  persistArenaPrefs();
  renderArenaPicker();
  hostNet.setArena(arenaIndex);
  lobbyState = hostNet.getLobbyState();
  renderLobby(lobbyState);
  toast(`ARENA // ${getArena(arenaIndex).name}`);
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
  input.poll();
  handleGamepad(input.readMenuEdges());

  const sampled = input.sample();
  localFrame.mx = sampled.mx;
  localFrame.my = sampled.my;
  localFrame.held = sampled.held;
  localFrame.pressed |= sampled.pressed;

  // A menu confirm (A) is also the dash button. Drop the first frame after entering
  // a match so selecting a mode never starts with an accidental dash.
  if (screen !== 'game' || !wasGame || overlayKind !== 'none' || loading) {
    localFrame.mx = 0;
    localFrame.my = 0;
    localFrame.held = 0;
    localFrame.pressed = 0;
  }

  updateLoadSequence(now);

  if (screen === 'game' && (world || guestView)) {
    if (!loading) stepSession(now, dt);
    const state: RenderState | null = guestView ?? world;
    if (state) {
      if (guestView) guestView.present();
      trackLocalHit(state);
      syncPhaseUi(state);
      fx.update(dt);
      renderer.render(state, Math.min(1, acc / SIM_DT), fx);
    }
  }

  updatePerf(dt);
  if (perfEl.hidden) {
    /* nothing */
  }
}

function trackLocalHit(state: RenderState): void {
  const local = state.players[state.localSlot];
  if (!local || !local.active) {
    lastLocalHp = -1;
    return;
  }
  if (lastLocalHp >= 0 && local.hp < lastLocalHp) fx.triggerHitRotation();
  lastLocalHp = local.hp;
}

function stepSession(now: number, dt: number): void {
  const t0 = performance.now();
  const pausedLocal =
    (mode === 'training' || mode === 'bots' || mode === 'gauntlet') && !stress && overlayKind === 'leave';

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
  } else if ((mode === 'training' || mode === 'gauntlet') && world && !pausedLocal) {
    if (stress) {
      buildStressInputs();
    } else {
      trainingInputs[0] = localFrame;
      // Training bots are practice partners, not round opponents. They write the
      // same InputFrame a human does and respawn with the player, forever.
      for (let i = 1; i < botBrains.length; i++) {
        const brain = botBrains[i];
        const frame = trainingInputs[i];
        if (brain && frame) brain.think(world, frame, SIM_DT);
      }
    }
    acc += dt;
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
    botInputs[0] = localFrame;
    acc += dt;
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

function startTraining(): void {
  if (busy) return;
  teardownSession();
  mode = 'training';
  localSlot = 0;
  const arena = getArena(arenaIndex);
  world = new World('training', [getCallsign()], 0, arena);
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
  world = new World('training', names, 0, arena);
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

function startGauntlet(): void {
  if (busy) return;
  teardownSession();
  mode = 'gauntlet';
  localSlot = 0;
  stress = false;
  const arena = getArena(arenaIndex);
  world = new World('gauntlet', [getCallsign()], 0, arena);
  trainingInputs = [localFrame];
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(arena.name);
  audio.unlock();
  audio.startMusic();
  console.log('[DEFLECT-STATE] Gauntlet start', arena.name);
}

function startBotMatch(): void {
  if (busy) return;
  teardownSession();
  mode = 'bots';
  localSlot = 0;
  stress = false;
  const arena = getArena(arenaIndex);
  const names = new Array(MAX_PLAYERS).fill('');
  names[0] = getCallsign();
  for (let i = 1; i <= botCount; i++) names[i] = BOT_NAMES[(i - 1) % BOT_NAMES.length];

  world = new World('match', names, 0, arena);
  botInputs = new Array(MAX_PLAYERS);
  for (let i = 0; i < MAX_PLAYERS; i++) botInputs[i] = { mx: 0, my: 0, held: 0, pressed: 0 };
  botBrains = new Array(MAX_PLAYERS).fill(null);
  for (let i = 1; i <= botCount; i++) {
    botBrains[i] = new BotBrain(i, botTier, i - 1, 0x51f15e + arena.id * 997 + i * 131);
  }
  botInputs[0] = localFrame;
  resetCounters();
  fx.reset();
  setScreen('game');
  beginLoadSequence(arena.name);
  audio.unlock();
  audio.startMusic();
  console.log('[DEFLECT-STATE] Bot match', botCount, botTier, arena.name);
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
  const arena = getArena(hostNet.getArenaIndex());
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
  for (let i = 1; i < botBrains.length; i++) botBrains[i]?.reset();
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
  showMenuStage('hub', false);
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
  localFrame.pressed = 0;
  fx.reset();
  audio.stopMusic();
  resetCounters();
  input.sample();
}

function resetCounters(): void {
  acc = 0;
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
}

// Screens & overlays ------------------------------------------------------------------------

function openSettings(): void {
  setScreen('settings');
  showSettingsTab(settingsTab);
  const back = el<HTMLButtonElement>('btn-settings-back');
  back.classList.add('nav-focus');
  back.focus({ preventScroll: true });
}

function setScreen(next: Screen): void {
  screen = next;
  titleScreen.classList.toggle('active', next === 'title');
  settingsScreen.classList.toggle('active', next === 'settings');
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
  if (next === 'title') focusMenuStage();
  else resetNavFocus();
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

function syncPhaseUi(state: RenderState): void {
  if (stress) {
    if (overlayKind !== 'leave') hideOverlayInternal();
    return;
  }
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
  resetNavFocus();
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
  if (mode === 'none' || overlayKind === 'leave') return;
  const local = mode === 'training' || mode === 'bots' || mode === 'gauntlet';
  const training = mode === 'training' && !stress;
  const botMatch = mode === 'bots';
  const gauntlet = mode === 'gauntlet';
  const paused = training || botMatch || gauntlet;
  setOverlay(
    'leave',
    paused ? 'SYSTEM // PAUSED' : 'SYSTEM // LIVE',
    training
      ? 'LEAVE TRAINING?'
      : botMatch
        ? 'LEAVE BOT MATCH?'
        : gauntlet
          ? 'EXIT GAUNTLET?'
          : local
            ? 'LEAVE STRESS RUN?'
            : 'LEAVE MATCH?',
    local
      ? 'The simulation will be destroyed. Nothing is saved.'
      : 'The match continues while this panel is open. Your operator will stand still.',
    [
      { label: 'STAY', onClick: closeLeave },
      { label: 'LEAVE', primary: true, onClick: () => leaveToTitle() },
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
    if (overlayKind === 'leave') closeLeave();
    else if (screen === 'title') menuBack();
    else if (screen === 'settings') setScreen('title');
    else if (screen === 'game') openLeave();
    else if (screen === 'lobby') leaveLobby();
    return;
  }
  if (screen !== 'game' || overlayKind !== 'none') {
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
  const menuOpen = screen !== 'game' || overlayKind !== 'none';
  if (menuOpen) {
    if (edges.up) moveNavDir(0, -1);
    else if (edges.down) moveNavDir(0, 1);
    else if (edges.left) moveNavDir(-1, 0);
    else if (edges.right) moveNavDir(1, 0);
    if (edges.confirm) activateNav();
    if (edges.back || edges.menu) {
      if (overlayKind === 'leave') closeLeave();
      else if (screen === 'title') menuBack();
      else if (screen === 'settings') setScreen('title');
      else if (screen === 'game') openLeave();
      else if (screen === 'lobby') leaveLobby();
    }
  } else if (edges.menu) {
    // B is the deflect button in-game, so only Start/View opens the menu here.
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

function moveNavDir(dx: number, dy: number): void {
  const items = navItems();
  if (items.length === 0) return;
  const active = document.activeElement as HTMLElement | null;
  let current = active && items.includes(active as HTMLButtonElement) ? (active as HTMLButtonElement) : null;
  if (!current) current = items.find((b) => b.classList.contains('nav-focus')) ?? null;
  if (!current) {
    const first = items[0];
    resetNavFocus();
    first.classList.add('nav-focus');
    first.focus({ preventScroll: true });
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
}

function activateNav(): void {
  const items = navItems();
  if (items.length === 0) return;
  const active = document.activeElement as HTMLElement | null;
  let target: HTMLButtonElement | undefined;
  if (active && items.includes(active as HTMLButtonElement)) target = active as HTMLButtonElement;
  else target = items.find((b) => b.classList.contains('nav-focus')) ?? items[0];
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
  settingsBtn.disabled = busy;
  trainingBtn.disabled = busy;
  createBtn.disabled = busy;
  joinBtn.disabled = busy || !isValidCode(roomCodeInput.value);
  botBtn.disabled = busy;
  gauntletBtn.disabled = busy;
}

function parseInviteHash(): void {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '')).toUpperCase();
  const code = normalizeCode(raw);
  if (isValidCode(code)) {
    roomCodeInput.value = code;
    setTitleStatus('INVITE CODE LOADED // PRESS JOIN');
    showMenuStage('multi');
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
    startTraining,
    startGauntlet,
    startBotMatch,
    startStress,
    selectArena,
    setBotTier,
    setBotCount,
    openLeave,
    closeLeave,
  };
}

boot();
