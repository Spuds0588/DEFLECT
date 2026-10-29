/**
 * Zero-asset audio. All cues are synthesized from oscillators and short noise bursts.
 * Digital/MIDI character is deliberate: square/triangle leads, fast envelopes, no reverb tails
 * beyond a short ping delay.
 */

type Wave = OscillatorType;

const STORAGE_MUTE = 'deflect.muted';
const STORAGE_MUSIC = 'deflect.music';
const STORAGE_VOLUME = 'deflect.volume';
const MASTER_LEVEL = 0.6;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private delaySend: GainNode | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  private musicPlaying = false;

  muted = false;
  musicWanted = true;
  volume = 0.8;

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
    } catch {
      this.muted = false;
      this.musicWanted = true;
    }
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
      musicBus.gain.value = 0.24;
      musicBus.connect(master);
      this.musicBus = musicBus;

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
    osc.connect(env).connect(dest ?? this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
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
    src.connect(filter).connect(env).connect(dest ?? this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  ui(): void {
    this.tone('square', 620, 760, 0.045, 0.05);
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

  startMusic(): void {
    if (this.musicPlaying || !this.musicWanted || !this.ctx || !this.musicBus) return;
    this.musicPlaying = true;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
    this.scheduleMusic();
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
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
    const stepDur = 0.125;
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      const s = this.musicStep % 32;
      const when = this.nextNoteTime - ctx.currentTime;
      if (when >= 0) {
        // Bass pulse on quarter notes.
        if (s % 4 === 0) {
          const bass = [55, 55, 43.65, 49][Math.floor(s / 8) % 4];
          this.tone('triangle', bass, bass, 0.3, 0.2, when, this.musicBus);
          this.tone('square', bass * 2, bass * 2, 0.12, 0.035, when, this.musicBus);
        }
        // Sparse digital arp.
        const arpSteps = [0, 3, 6, 10, 14, 19, 22, 27];
        if (arpSteps.includes(s)) {
          const notes = [220, 261.63, 329.63, 392, 440, 523.25];
          const n = notes[(s + Math.floor(this.musicStep / 32)) % notes.length];
          this.tone('square', n, n, 0.09, 0.028, when, this.musicBus);
        }
        // Hat tick.
        if (s % 2 === 0) {
          this.noise(0.03, 0.012, 8000, 6000, 'highpass', when, this.musicBus);
        }
      }
      this.nextNoteTime += stepDur;
      this.musicStep++;
    }
  }
}
