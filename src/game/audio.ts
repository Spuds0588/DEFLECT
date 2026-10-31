/**
 * Zero-asset audio. All cues are synthesized from oscillators and short noise bursts.
 * Digital/MIDI character is deliberate: square/triangle leads, fast envelopes, no reverb tails
 * beyond a short ping delay.
 */

type Wave = OscillatorType;

const STORAGE_MUTE = 'deflect.muted';
const STORAGE_MUSIC = 'deflect.music';
const STORAGE_VOLUME = 'deflect.volume';
const STORAGE_MUSIC_VOLUME = 'deflect.musicVolume';
const STORAGE_SFX_VOLUME = 'deflect.sfxVolume';
const STORAGE_MENU_VOLUME = 'deflect.menuVolume';
const MASTER_LEVEL = 0.6;
/**
 * Music sits on its own bus so the soundtrack never fights the combat cues.
 * The per-voice gains below are written against this level: at 0.24 the chord bed
 * peaked near -59 dBFS and was inaudible on laptop speakers next to a -28 dB bolt.
 */
const MUSIC_BUS_LEVEL = 0.5;

/** Chill lofi-house loop. Notes are MIDI numbers; the synth does the rest. */
const MUSIC_BPM = 82;
const MUSIC_STEP = 60 / MUSIC_BPM / 4;
const MUSIC_LOOP = 64;
const MUSIC_CHORDS: readonly (readonly number[])[] = [
  [60, 64, 67, 71], // Cmaj7
  [57, 60, 64, 67], // Am7
  [50, 53, 57, 60], // Dm7
  [55, 59, 62, 65], // G7
];
const MUSIC_BASS = [36, 33, 38, 31] as const; // C2, A1, D2, G1

/**
 * Menu bed: the same changes, slower and sparser, with no drums and a long held pad.
 * It plays under the title/settings/lobby screens and is trimmed below the match loop
 * so entering a session always feels like the music steps forward.
 */
const MUSIC_MENU_BPM = 62;
const MUSIC_MENU_STEP = 60 / MUSIC_MENU_BPM / 4;
const MENU_BUS_TRIM = 0.6;

type MusicMode = 'match' | 'menu';

function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private menuBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private vinylBuffer: AudioBuffer | null = null;
  private vinylSource: AudioBufferSourceNode | null = null;
  private vinylGain: GainNode | null = null;
  private delaySend: GainNode | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  private musicPlaying = false;
  private musicMode: MusicMode = 'match';
  private musicTrim = 1;

  muted = false;
  musicWanted = true;
  volume = 0.8;
  /** Independent channel levels so the soundtrack never has to share a slider with hits. */
  musicVolume = 0.65;
  sfxVolume = 0.9;
  menuVolume = 0.8;

  constructor() {
    try {
      this.muted = localStorage.getItem(STORAGE_MUTE) === '1';
      const music = localStorage.getItem(STORAGE_MUSIC);
      this.musicWanted = music === null ? true : music === '1';
      const rawVolume = localStorage.getItem(STORAGE_VOLUME);
      if (rawVolume !== null) {
        const vol = Number(rawVolume);
        if (Number.isFinite(vol)) this.volume = Math.max(0, Math.min(1, vol));
      }
      this.musicVolume = this.readLevel(STORAGE_MUSIC_VOLUME, this.musicVolume);
      this.sfxVolume = this.readLevel(STORAGE_SFX_VOLUME, this.sfxVolume);
      this.menuVolume = this.readLevel(STORAGE_MENU_VOLUME, this.menuVolume);
    } catch {
      this.muted = false;
      this.musicWanted = true;
    }
  }

  private readLevel(key: string, fallback: number): number {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  }

  /** Master gain follows volume and mute; 0 is silent without tearing down the graph. */
  private applyMaster(): void {
    if (!this.master || !this.ctx) return;
    const level = this.muted ? 0 : MASTER_LEVEL * this.volume;
    this.master.gain.setTargetAtTime(level, this.ctx.currentTime, 0.02);
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    try {
      localStorage.setItem(STORAGE_VOLUME, String(this.volume));
    } catch {
      /* storage can be unavailable */
    }
    this.applyMaster();
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    try {
      localStorage.setItem(STORAGE_MUSIC_VOLUME, String(this.musicVolume));
    } catch {
      /* storage can be unavailable */
    }
    this.applyBusLevels();
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    try {
      localStorage.setItem(STORAGE_SFX_VOLUME, String(this.sfxVolume));
    } catch {
      /* storage can be unavailable */
    }
    this.applyBusLevels();
  }

  setMenuVolume(volume: number): void {
    this.menuVolume = Math.max(0, Math.min(1, volume));
    try {
      localStorage.setItem(STORAGE_MENU_VOLUME, String(this.menuVolume));
    } catch {
      /* storage can be unavailable */
    }
    this.applyBusLevels();
  }

  private applyBusLevels(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicBus?.gain.setTargetAtTime(MUSIC_BUS_LEVEL * this.musicVolume * this.musicTrim, now, 0.02);
    this.sfxBus?.gain.setTargetAtTime(0.9 * this.sfxVolume, now, 0.02);
    this.menuBus?.gain.setTargetAtTime(0.8 * this.menuVolume, now, 0.02);
  }

  /** Must be called from a user gesture before any sound can play. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : MASTER_LEVEL * this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      master.connect(comp).connect(ctx.destination);
      this.master = master;

      const musicBus = ctx.createGain();
      musicBus.gain.value = MUSIC_BUS_LEVEL * this.musicVolume * this.musicTrim;
      // Warm the whole music bed. Combat cues keep their sharper digital edge.
      const musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 7000;
      musicFilter.Q.value = 0.4;
      musicBus.connect(musicFilter).connect(master);
      this.musicBus = musicBus;

      const sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9 * this.sfxVolume;
      sfxBus.connect(master);
      this.sfxBus = sfxBus;

      const menuBus = ctx.createGain();
      menuBus.gain.value = 0.8 * this.menuVolume;
      menuBus.connect(master);
      this.menuBus = menuBus;

      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.11;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.22;
      const send = ctx.createGain();
      send.gain.value = 0.35;
      delay.connect(feedback).connect(delay);
      delay.connect(master);
      this.delaySend = send;
      send.connect(delay);

      const len = Math.floor(ctx.sampleRate * 0.6);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;

      // Sparse crackle over a quiet noise floor, looped under the music.
      const vinylLen = Math.floor(ctx.sampleRate * 2);
      const vinyl = ctx.createBuffer(1, vinylLen, ctx.sampleRate);
      const vdata = vinyl.getChannelData(0);
      for (let i = 0; i < vinylLen; i++) vdata[i] = (Math.random() * 2 - 1) * 0.035;
      for (let c = 0; c < 90; c++) {
        const at = Math.floor(Math.random() * vinylLen);
        const amp = 0.25 + Math.random() * 0.5;
        for (let j = 0; j < 10 && at + j < vinylLen; j++) {
          vdata[at + j] += (Math.random() * 2 - 1) * amp * (1 - j / 10);
        }
      }
      // Crossfade the seam so the two-second loop does not tick.
      const seam = Math.floor(ctx.sampleRate * 0.02);
      for (let i = 0; i < seam; i++) {
        const t = i / seam;
        vdata[vinylLen - seam + i] = vdata[vinylLen - seam + i] * (1 - t) + vdata[i] * t;
      }
      this.vinylBuffer = vinyl;
    }

    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(STORAGE_MUTE, muted ? '1' : '0');
    } catch {
      /* storage can be unavailable in private mode */
    }
    this.applyMaster();
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private tone(
    type: Wave,
    f0: number,
    f1: number,
    dur: number,
    gain: number,
    when = 0,
    dest: AudioNode | null = null,
  ): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(dest ?? this.sfxBus ?? this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /**
   * Sustained voice for the music bed. `tone()` decays exponentially across the whole
   * note, which is right for cues but leaves the chords as half-second stabs: the loop
   * then has no body for laptop speakers (they roll off below ~200 Hz) to carry.
   * Quick attack, held level, short tail.
   */
  private pad(type: Wave, f: number, gain: number, hold: number, when = 0, dest: AudioNode | null = null): void {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f), t);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(Math.max(0.0002, gain), t + 0.03);
    env.gain.setValueAtTime(Math.max(0.0002, gain), t + hold);
    env.gain.exponentialRampToValueAtTime(0.0001, t + hold + 0.38);
    osc.connect(env).connect(dest ?? this.musicBus ?? this.master!);
    osc.start(t);
    osc.stop(t + hold + 0.42);
  }

  private noise(
    dur: number,
    gain: number,
    f0: number,
    f1: number,
    type: BiquadFilterType,
    when = 0,
    dest: AudioNode | null = null,
  ): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || !this.noiseBuffer) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    filter.Q.value = type === 'bandpass' ? 1.4 : 0.7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(env).connect(dest ?? this.sfxBus ?? this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  ui(): void {
    this.tone('square', 620, 760, 0.045, 0.05, 0, this.menuBus);
  }

  shootBolt(): void {
    this.tone('square', 880, 180, 0.085, 0.09);
    this.noise(0.035, 0.03, 4200, 1200, 'highpass');
  }

  plantMine(): void {
    this.tone('square', 190, 120, 0.06, 0.06);
    this.noise(0.05, 0.035, 2400, 700, 'bandpass');
  }

  swing(): void {
    this.noise(0.11, 0.09, 1700, 320, 'bandpass');
    this.tone('triangle', 320, 120, 0.09, 0.045);
  }

  deflect(rally: number): void {
    const base = 660 * Math.pow(1.059, Math.min(12, rally) * 2);
    this.tone('square', base, base * 2.2, 0.08, 0.11, 0, this.delaySend);
    this.tone('triangle', base * 2, base * 3, 0.12, 0.06);
    this.noise(0.04, 0.05, 5200, 2400, 'bandpass', 0, this.delaySend);
  }

  shieldWave(): void {
    this.tone('sawtooth', 190, 520, 0.22, 0.09, 0, this.delaySend);
    this.tone('square', 380, 980, 0.18, 0.05, 0.03);
    this.noise(0.2, 0.1, 2300, 420, 'bandpass');
  }

  bounce(): void {
    this.tone('triangle', 300, 240, 0.035, 0.04);
  }

  explode(): void {
    this.noise(0.42, 0.32, 1200, 55, 'lowpass');
    this.tone('sine', 120, 34, 0.38, 0.28);
    this.tone('sawtooth', 90, 45, 0.2, 0.08);
  }

  hit(): void {
    this.tone('sawtooth', 220, 55, 0.16, 0.16);
    this.noise(0.1, 0.1, 2600, 500, 'bandpass');
  }

  dash(): void {
    this.noise(0.16, 0.1, 1400, 220, 'bandpass');
    this.tone('triangle', 500, 180, 0.1, 0.04);
  }

  eliminate(): void {
    this.tone('square', 380, 170, 0.12, 0.11);
    this.tone('square', 190, 60, 0.22, 0.1, 0.08);
    this.noise(0.25, 0.14, 1800, 80, 'lowpass');
  }

  respawn(): void {
    this.tone('triangle', 380, 760, 0.1, 0.06);
    this.tone('triangle', 760, 1120, 0.1, 0.05, 0.07);
  }

  pickup(kind: number): void {
    const base = 520 + kind * 70;
    this.tone('square', base, base * 1.5, 0.08, 0.08);
    this.tone('triangle', base * 1.5, base * 2.1, 0.12, 0.05, 0.06);
  }

  heal(): void {
    this.tone('triangle', 420, 840, 0.16, 0.07);
    this.tone('square', 630, 1260, 0.12, 0.04, 0.07);
  }

  roundStart(round: number): void {
    const root = 392 * Math.pow(1.03, Math.min(8, round));
    [0, 4, 7, 12].forEach((semi, i) => {
      const f = root * Math.pow(2, semi / 12);
      this.tone('square', f, f, 0.11, 0.06, i * 0.075);
    });
  }

  roundEnd(): void {
    this.tone('triangle', 660, 660, 0.12, 0.06);
    this.tone('triangle', 440, 440, 0.2, 0.06, 0.11);
  }

  victory(): void {
    [0, 4, 7, 12, 16].forEach((semi, i) => {
      const f = 523.25 * Math.pow(2, semi / 12);
      this.tone('square', f, f, 0.16, 0.055, i * 0.11);
    });
  }

  // --- Music -------------------------------------------------------------------------------

  /** Match loop. Called by every session start; a mode change restarts the scheduler. */
  startMusic(mode: MusicMode = 'match'): void {
    if (!this.musicWanted || !this.ctx || !this.musicBus) return;
    const modeChanged = this.musicMode !== mode;
    if (this.musicPlaying && !modeChanged) return;
    this.musicMode = mode;
    this.musicTrim = mode === 'menu' ? MENU_BUS_TRIM : 1;
    this.applyBusLevels();
    if (this.musicPlaying) this.stopMusic();
    this.musicPlaying = true;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
    this.startVinyl();
    this.scheduleMusic();
  }

  /** Quieter loop for the menus. Same graph and scheduler, different pattern and trim. */
  startMenuMusic(): void {
    this.startMusic('menu');
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.stopVinyl();
  }

  private startVinyl(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.vinylBuffer || this.vinylSource) return;
    const src = ctx.createBufferSource();
    src.buffer = this.vinylBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.6);
    src.connect(filter).connect(gain).connect(this.musicBus);
    src.start();
    this.vinylSource = src;
    this.vinylGain = gain;
  }

  private stopVinyl(): void {
    const src = this.vinylSource;
    const gain = this.vinylGain;
    this.vinylSource = null;
    this.vinylGain = null;
    if (!src) return;
    const ctx = this.ctx;
    try {
      if (ctx && gain) {
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0.0001, now, 0.06);
        src.stop(now + 0.3);
      } else {
        src.stop();
      }
    } catch {
      /* already stopped */
    }
  }

  setMusicEnabled(on: boolean): void {
    this.musicWanted = on;
    try {
      localStorage.setItem(STORAGE_MUSIC, on ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!on) this.stopMusic();
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicPlaying || !this.musicBus) return;
    const stepDur = this.musicMode === 'menu' ? MUSIC_MENU_STEP : MUSIC_STEP;
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      const s = this.musicStep % MUSIC_LOOP;
      const bar = Math.floor(s / 16) % 4;
      const beat = s % 16;
      const when = this.nextNoteTime - ctx.currentTime;
      const swing = beat % 4 === 2 ? 0.028 : 0;
      if (when >= 0 && this.musicMode === 'menu') {
        this.scheduleMenuStep(bar, beat, s, when);
      } else if (when >= 0) {
        // Soft four-on-the-floor kick: strong on 1 and 3, lighter on 2 and 4.
        if (beat % 4 === 0) {
          const accent = beat === 0 || beat === 8 ? 1 : 0.8;
          this.tone('sine', 115, 43, 0.28, 0.3 * accent, when, this.musicBus);
          this.noise(0.02, 0.03 * accent, 700, 250, 'lowpass', when, this.musicBus);
        }
        // Clap on 2 and 4.
        if (beat === 4 || beat === 12) {
          this.noise(0.13, 0.11, 2100, 850, 'bandpass', when, this.musicBus);
          this.tone('triangle', 185, 150, 0.07, 0.055, when, this.musicBus);
        }
        // Swung closed hats, plus a longer open hat on the backbeat.
        if (s % 2 === 0) {
          const open = s % 8 === 6;
          this.noise(
            open ? 0.14 : 0.03,
            open ? 0.07 : 0.05 + (beat === 0 ? 0.01 : 0),
            8500,
            open ? 6000 : 7000,
            'highpass',
            when + swing,
            this.musicBus,
          );
        }
        // Rhodes-style seventh chords: a long hit on the downbeat and a soft re-hit.
        if (beat === 0 || beat === 10) {
          const chord = MUSIC_CHORDS[bar];
          const hold = beat === 0 ? 1.5 : 0.62;
          const gain = beat === 0 ? 0.085 : 0.05;
          for (let i = 0; i < chord.length; i++) {
            const f = midiToHz(chord[i]);
            this.pad('triangle', f, gain, hold, when + 0.008, this.musicBus);
            this.pad('sine', f * 2, gain * 0.32, hold * 0.5, when + 0.012, this.musicBus);
          }
        }
        // Warm bass root, with a short octave lift late in the bar.
        const root = midiToHz(MUSIC_BASS[bar]);
        if (beat === 0) {
          this.pad('sine', root, 0.26, 1.0, when, this.musicBus);
          this.tone('triangle', root * 2, root * 2, 0.3, 0.055, when + 0.01, this.musicBus);
        } else if (beat === 8) {
          this.pad('sine', root, 0.2, 0.5, when, this.musicBus);
        } else if (beat === 14) {
          this.tone('triangle', root * 2, root * 2, 0.22, 0.05, when, this.musicBus);
        }
      }
      this.nextNoteTime += stepDur;
      this.musicStep++;
    }
  }

  /** Sparse menu bar: one held pad per bar, a soft bell, no drums. */
  private scheduleMenuStep(bar: number, beat: number, step: number, when: number): void {
    const chord = MUSIC_CHORDS[bar];
    if (beat === 0) {
      const root = midiToHz(MUSIC_BASS[bar]);
      for (let i = 0; i < chord.length; i++) {
        const f = midiToHz(chord[i]);
        this.pad('triangle', f, 0.13, 2.9, when + 0.01, this.musicBus);
        this.pad('sine', f * 2, 0.042, 1.4, when + 0.014, this.musicBus);
      }
      this.pad('sine', root, 0.2, 2.6, when, this.musicBus);
      this.pad('triangle', root * 1.5, 0.12, 1.1, when + 0.02, this.musicBus);
    }
    // One soft bell per bar keeps the screen from going dead between changes.
    if (step % 16 === 6 || step % 16 === 14) {
      const top = midiToHz(chord[chord.length - 1] + 12);
      this.tone('triangle', top, top, 1.1, 0.06, when, this.musicBus);
    }
    if (beat % 4 === 2) {
      this.noise(0.05, 0.03, 7000, 5200, 'highpass', when, this.musicBus);
    }
  }
}
