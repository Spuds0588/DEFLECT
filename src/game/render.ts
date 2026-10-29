import { BUG, CAMERA_ZOOM, MINE, CASCADING_ERROR, COLORS, FIREWALL, MAX_PLAYERS, PLAYER, ROUND, SENTRY, TRAIL_LEN, VIEW_H, VIEW_W, VIRUS, WORM } from './config';
import type { ArenaDef } from './arenas';
import { Fx } from './fx';
import { drawGlyph, slotColor, slotGlyph, THREAT_COLORS } from './identity';
import { P_COLOR_ICE, particleColor } from './particles';
import type { CascadingError, Drone, Firewall, GameMode, Phase, Player, Projectile, Sentry, Virus, Worm } from './types';

export interface RenderState {
  mode: GameMode;
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
  errors?: readonly CascadingError[];
  sentries?: readonly Sentry[];
  infection?: number;
  gauntletKills?: number;
  wave?: number;
  waveBannerT?: number;
}

const FONT_TINY = '700 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_SMALL = '700 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_MID = '700 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const TWO_PI = Math.PI * 2;
const HEALTH_GAP = 0.32;
const HEALTH_SPAN = (TWO_PI - HEALTH_GAP * PLAYER.hp) / PLAYER.hp;
const FIRST_TO = `FIRST TO ${ROUND.winsNeeded}`;
const LABEL_TRAINING = 'TRAINING';
const LABEL_DRONE = 'SPARRING DRONE';
const SPIN_TRAIL_LEN = 20;
const SPIN_TRAIL_LIFE = 0.42;
const SPIN_TRAIL_INTERVAL = 0.02;
const INTRO_LEN = 3.1;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
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
  private camX = 0;
  private camY = 0;
  private camReady = false;
  private camArena = -1;
  private lastRenderT = 0;
  private introT = INTRO_LEN;
  private introActive = false;
  private dustArena = -1;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    this.resize();
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
    this.camReady = false;
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
    this.updateCamera(state, alpha, dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const sx = this.dpr * this.scale * CAMERA_ZOOM;
    ctx.setTransform(
      sx,
      0,
      0,
      sx,
      this.dpr * this.offX + fx.shakeX * this.scale * this.dpr,
      this.dpr * this.offY + fx.shakeY * this.scale * this.dpr,
    );
    ctx.translate(-this.camX, -this.camY);
    if (fx.rotationShake !== 0) {
      // Pivot on the middle of the visible camera window, not world origin.
      const pivotX = this.camX + VIEW_W / CAMERA_ZOOM * 0.5;
      const pivotY = this.camY + VIEW_H / CAMERA_ZOOM * 0.5;
      ctx.translate(pivotX, pivotY);
      ctx.rotate(fx.rotationShake);
      ctx.translate(-pivotX, -pivotY);
    }

    this.drawArena(t, state.arena, intro);
    if (introDone) {
      if (state.firewalls) this.drawFirewalls(state.firewalls, state.arena, alpha, t);
      this.drawPlayerTrails(state, t);
      this.drawTrails(state, alpha);
      this.drawProjectiles(state, alpha, t);
      if (state.worms) this.drawWorms(state.worms, alpha, t);
      if (state.viruses) this.drawViruses(state.viruses, alpha, t);
      if (state.sentries) this.drawSentries(state.sentries, alpha, t);
      if (state.errors) this.drawErrors(state.errors, alpha, t);
      this.drawLasers(state, alpha, t);
      if (state.drone) this.drawDrone(state.drone, alpha, t);
    }
    this.drawPlayers(state, alpha, t, intro);
    if (introDone) {
      this.drawLockReticle(state, t);
      fx.particles.draw(ctx);
    }

    // Screen-space overlays and HUD are never panned or shaken.
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.offX, this.dpr * this.offY);

    // Impact flash.
    if (fx.flash > 0.002) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.5, fx.flash * 0.55 * fx.flashScale);
      ctx.fillStyle = fx.flashColor;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.restore();
    }

    // Local low-health vignette.
    if (state.mode === 'match' || state.mode === 'training' || state.mode === 'gauntlet') {
      const local = state.players[state.localSlot];
      if (local && local.alive && local.hp <= 1 && this.lowHpGradient) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.08;
        ctx.fillStyle = this.lowHpGradient;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.restore();
      }
    }

    if (introDone) this.drawHud(state, t);
  }

  private updateCamera(state: RenderState, alpha: number, dt: number): void {
    const arena = state.arena;
    const b = arena.bounds;
    const local = state.players[state.localSlot];
    let focusX = (b.left + b.right) * 0.5;
    let focusY = (b.top + b.bottom) * 0.5;
    if (local && local.active) {
      focusX = lerp(local.prevX, local.x, alpha);
      focusY = lerp(local.prevY, local.y, alpha);
    }

    let targetX: number;
    let targetY: number;
    const viewW = VIEW_W / CAMERA_ZOOM;
    const viewH = VIEW_H / CAMERA_ZOOM;
    const spanX = b.right - b.left;
    const spanY = b.bottom - b.top;
    if (spanX <= viewW) targetX = (b.left + b.right - viewW) * 0.5;
    else targetX = Math.max(b.left, Math.min(b.right - viewW, focusX - viewW * 0.5));
    if (spanY <= viewH) targetY = (b.top + b.bottom - viewH) * 0.5;
    else targetY = Math.max(b.top, Math.min(b.bottom - viewH, focusY - viewH * 0.5));

    if (!this.camReady || this.camArena !== arena.id) {
      this.camX = targetX;
      this.camY = targetY;
      this.camReady = true;
      this.camArena = arena.id;
      return;
    }
    const k = 1 - Math.exp(-9 * dt);
    this.camX += (targetX - this.camX) * k;
    this.camY += (targetY - this.camY) * k;
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

    // Border glow.
    ctx.save();
    ctx.globalAlpha = frameA;
    ctx.strokeStyle = arena.accent;
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 9;
    ctx.strokeRect(arena.bounds.left, arena.bounds.top, arena.bounds.right - arena.bounds.left, arena.bounds.bottom - arena.bounds.top);
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(arena.bounds.left, arena.bounds.top, arena.bounds.right - arena.bounds.left, arena.bounds.bottom - arena.bounds.top);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.strokeRect(arena.bounds.left + 3.5, arena.bounds.top + 3.5, arena.bounds.right - arena.bounds.left - 7, arena.bounds.bottom - arena.bounds.top - 7);
    ctx.globalAlpha = 1;

    // Corner brackets.
    const len = 26;
    const pad = 8;
    ctx.strokeStyle = arena.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(arena.bounds.left + pad, arena.bounds.top + pad + len);
    ctx.lineTo(arena.bounds.left + pad, arena.bounds.top + pad);
    ctx.lineTo(arena.bounds.left + pad + len, arena.bounds.top + pad);
    ctx.moveTo(arena.bounds.right - pad - len, arena.bounds.top + pad);
    ctx.lineTo(arena.bounds.right - pad, arena.bounds.top + pad);
    ctx.lineTo(arena.bounds.right - pad, arena.bounds.top + pad + len);
    ctx.moveTo(arena.bounds.left + pad, arena.bounds.bottom - pad - len);
    ctx.lineTo(arena.bounds.left + pad, arena.bounds.bottom - pad);
    ctx.lineTo(arena.bounds.left + pad + len, arena.bounds.bottom - pad);
    ctx.moveTo(arena.bounds.right - pad - len, arena.bounds.bottom - pad);
    ctx.lineTo(arena.bounds.right - pad, arena.bounds.bottom - pad);
    ctx.lineTo(arena.bounds.right - pad, arena.bounds.bottom - pad - len);
    ctx.stroke();

    // Edge ticks.
    ctx.strokeStyle = 'rgba(90, 210, 230, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = arena.bounds.left + 96; x < arena.bounds.right - 40; x += 128) {
      ctx.moveTo(x, arena.bounds.top);
      ctx.lineTo(x, arena.bounds.top + 7);
      ctx.moveTo(x, arena.bounds.bottom);
      ctx.lineTo(x, arena.bounds.bottom - 7);
    }
    for (let y = arena.bounds.top + 96; y < arena.bounds.bottom - 40; y += 128) {
      ctx.moveTo(arena.bounds.left, y);
      ctx.lineTo(arena.bounds.left + 7, y);
      ctx.moveTo(arena.bounds.right, y);
      ctx.lineTo(arena.bounds.right - 7, y);
    }
    ctx.stroke();
    ctx.restore();

    // Arena furniture.
    ctx.save();
    ctx.translate(0, -pillarDrop);
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      ctx.fillStyle = COLORS.pillarFill;
      ctx.globalAlpha = pillarA * 0.9;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = arena.accent;
      ctx.globalAlpha = (0.4 + Math.sin(t * 1.6 + i) * 0.09) * pillarA;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.globalAlpha = 0.12 * pillarA;
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 7, r.y + 7, r.w - 14, r.h - 14);
      ctx.beginPath();
      ctx.moveTo(r.x + 7, r.y + 7);
      ctx.lineTo(r.x + r.w - 7, r.y + r.h - 7);
      ctx.moveTo(r.x + r.w - 7, r.y + 7);
      ctx.lineTo(r.x + 7, r.y + r.h - 7);
      ctx.stroke();
      ctx.globalAlpha = pillarA;
      // Warm accent marks a hard edge without implying a hazard.
      ctx.fillStyle = 'rgba(255, 138, 46, 0.55)';
      ctx.fillRect(r.x + r.w * 0.5 - 6, r.y + 3, 12, 2);
      ctx.fillRect(r.x + r.w * 0.5 - 6, r.y + r.h - 5, 12, 2);
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
    this.drawArenaSignature(arena, t, frameA);
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

      const pips = Math.max(1, Math.ceil(w.maxHp));
      const pipW = 3;
      const total = pips * pipW + (pips - 1);
      for (let h = 0; h < pips; h++) {
        ctx.globalAlpha = h < w.hp ? 0.9 : 0.16;
        ctx.fillStyle = base;
        ctx.fillRect(hx - total / 2 + h * (pipW + 1), hy + r + 8, pipW, 2);
      }
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
        const x = lerp(p.prevX, p.x, alpha);
        const y = lerp(p.prevY, p.y, alpha);
        const charge = Math.min(1, p.laserChargeT / PLAYER.laserChargeTime);
        const color = slotColor(p.slot);
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
        continue;
      }
      if (p.laserT <= 0) continue;

      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      const ax = Math.cos(p.laserFacing);
      const ay = Math.sin(p.laserFacing);
      const origin = PLAYER.radius + 12;
      let reach: number = PLAYER.laserRange;
      for (let d = 24; d < PLAYER.laserRange; d += 25) {
        if (this.beamClear(state.arena, x, y, x + ax * d, y + ay * d)) continue;
        reach = d - 25;
        break;
      }
      reach = Math.max(origin + 8, reach);
      const flicker = 0.85 + 0.15 * Math.sin(t * 44 + i);
      const width = PLAYER.laserHalfWidth * 2;
      ctx.strokeStyle = slotColor(p.slot);
      ctx.globalAlpha = 0.12 * flicker;
      ctx.lineWidth = width + 26;
      ctx.beginPath();
      ctx.moveTo(x + ax * PLAYER.radius, y + ay * PLAYER.radius);
      ctx.lineTo(x + ax * reach, y + ay * reach);
      ctx.stroke();
      ctx.globalAlpha = 0.3 * flicker;
      ctx.lineWidth = width + 10;
      ctx.stroke();
      ctx.globalAlpha = 0.62 * flicker;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Sparks crawling along the beam.
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = slotColor(p.slot);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s < 7; s++) {
        const along = ((t * 330 + s * 97 + i * 53) % reach) + 20;
        const side = Math.sin(t * 30 + s * 2.3) * (PLAYER.laserHalfWidth + 7);
        ctx.moveTo(x + ax * along - ay * side, y + ay * along + ax * side);
        ctx.lineTo(x + ax * (along + 6) - ay * side, y + ay * (along + 6) + ax * side);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** True when nothing in the arena blocks the segment. Used only for beam visuals. */
  private beamClear(arena: ArenaDef, ax: number, ay: number, bx: number, by: number): boolean {
    for (let i = 0; i < arena.pillars.length; i++) {
      const r = arena.pillars[i];
      // Cheap reject, then a coarse segment-vs-rect test against the expanded pillar.
      if (Math.max(ax, bx) < r.x || Math.min(ax, bx) > r.x + r.w) continue;
      if (Math.max(ay, by) < r.y || Math.min(ay, by) > r.y + r.h) continue;
      for (let s = 0; s <= 16; s++) {
        const px = ax + ((bx - ax) * s) / 16;
        const py = ay + ((by - ay) * s) / 16;
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return false;
      }
    }
    return true;
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
      const color = hostile
        ? p.type === 4 ? THREAT_COLORS.homing : THREAT_COLORS.sentry
        : p.owner >= 0
          ? slotColor(p.owner)
          : particleColor(P_COLOR_ICE);
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      this.pushTrail(p, x, y);
      if (p.trailCount < 2) continue;
      // Hostile shots get a short tail so the screen does not fill with long lines.
      const count = p.type >= 3 ? Math.min(p.trailCount, 5) : p.trailCount;
      const start = (p.trailHead - count + TRAIL_LEN) % TRAIL_LEN;
      ctx.beginPath();
      for (let k = 0; k < count; k++) {
        const idx = (start + k) % TRAIL_LEN;
        if (k === 0) ctx.moveTo(p.trailX[idx], p.trailY[idx]);
        else ctx.lineTo(p.trailX[idx], p.trailY[idx]);
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = hostile ? 0.2 : p.type === 1 ? 0.14 : 0.16 + Math.min(0.16, p.deflects * 0.04);
      ctx.lineWidth = hostile ? 4 : p.type === 1 ? 5 : 7;
      ctx.stroke();
      ctx.globalAlpha = hostile ? 0.55 : p.type === 1 ? 0.3 : 0.45 + Math.min(0.25, p.deflects * 0.05);
      ctx.lineWidth = hostile ? 1.6 : p.type === 1 ? 2 : 2.6;
      ctx.stroke();
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

  private drawProjectiles(state: RenderState, alpha: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < state.projectiles.length; i++) {
      const p = state.projectiles[i];
      if (!p.active) continue;
      const x = lerp(p.prevX, p.x, alpha);
      const y = lerp(p.prevY, p.y, alpha);
      const hostile = p.owner < 0 && p.type >= 3;
      const color = hostile
        ? p.type === 4 ? THREAT_COLORS.homing : THREAT_COLORS.sentry
        : p.owner >= 0
          ? slotColor(p.owner)
          : particleColor(P_COLOR_ICE);
      if (p.type >= 3) {
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

  /** Fading squares mark the path of a charged triangle dash. */
  private drawPlayerTrails(state: RenderState, t: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (!p.active) continue;
      const base = p.slot * SPIN_TRAIL_LEN;
      const moving = p.alive && p.dashT > 0 && p.dashKind === 1;
      if (moving) {
        const dx = p.x - this.trailLastX[p.slot];
        const dy = p.y - this.trailLastY[p.slot];
        if (t - this.trailLastT[p.slot] >= SPIN_TRAIL_INTERVAL && dx * dx + dy * dy > 9) {
          const index = base + this.trailHead[p.slot];
          this.trailX[index] = p.x;
          this.trailY[index] = p.y;
          this.trailBirth[index] = t;
          this.trailHead[p.slot] = (this.trailHead[p.slot] + 1) % SPIN_TRAIL_LEN;
          this.trailLastT[p.slot] = t;
          this.trailLastX[p.slot] = p.x;
          this.trailLastY[p.slot] = p.y;
        }
      }
      const color = p.thrall ? THREAT_COLORS.thrall : slotColor(p.slot);
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
  private drawLockReticle(state: RenderState, t: number): void {
    const p = state.players[state.localSlot];
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
    ctx.strokeStyle = active ? slotColor(p.slot) : '#dff7ff';
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

  private drawPlayers(state: RenderState, alpha: number, t: number, intro = INTRO_LEN): void {
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
        ctx.strokeStyle = p.thrall ? THREAT_COLORS.thrall : slotColor(p.slot);
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
      const color = p.thrall ? THREAT_COLORS.thrall : slotColor(p.slot);
      const isLocal = p.slot === state.localSlot;

      if (!p.alive) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(x, y, PLAYER.radius, 0, TWO_PI);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x - 7, y - 7);
        ctx.lineTo(x + 7, y + 7);
        ctx.moveTo(x + 7, y - 7);
        ctx.lineTo(x - 7, y + 7);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      // Deflect shield: a 120-degree arc centered on facing. Each swing draws the arc
      // across the cone from one edge, then the next swing reverses like a real weapon.
      if (p.swingPhase !== 0) {
        const half = PLAYER.swingHalfAngle;
        const dir = p.swingDir < 0 ? -1 : 1;
        const pct = Math.max(0, Math.min(1, p.swingPct));
        const extend = p.swingPhase === 1 ? 0.55 + 0.45 * (1 - pct) : 1;
        const outer = 24 + (PLAYER.swingReach - 24) * extend;
        const start = facing - dir * half;
        const active = p.swingPhase === 2;
        // Start mostly open so the tap reads instantly; the remaining sweep is the tell.
        let sweep = 0.55;
        if (active) sweep = 0.55 + 0.45 * (1 - pct);
        const end = start + dir * half * 2 * sweep;

        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = active ? 0.16 : p.swingPhase === 3 ? 0.05 : 0.09;
        ctx.beginPath();
        ctx.arc(x, y, outer, start, end, dir < 0);
        ctx.arc(x, y, 22, end, start, dir > 0);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = active ? 0.85 : p.swingPhase === 3 ? 0.18 : 0.4;
        ctx.strokeStyle = color;
        ctx.lineWidth = active ? 2.5 : 1.2;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.arc(x, y, outer, start, end, dir < 0);
        ctx.stroke();
        if (active) {
          // Boundary lines show the swept sector; the leading lip is brighter.
          ctx.globalAlpha = 0.4;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(start) * 22, y + Math.sin(start) * 22);
          ctx.lineTo(x + Math.cos(start) * outer, y + Math.sin(start) * outer);
          ctx.moveTo(x + Math.cos(end) * 22, y + Math.sin(end) * 22);
          ctx.lineTo(x + Math.cos(end) * outer, y + Math.sin(end) * outer);
          ctx.stroke();
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(x, y, outer - 1, end - dir * 0.13, end, dir < 0);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Floating readiness pips behind the avatar: dash on one side, bug on the other.
      const iconR = PLAYER.radius + 16;
      const bugAng = facing + 2.45;
      const dashAng = facing - 2.45;
      const bugX = x + Math.cos(bugAng) * iconR;
      const bugY = y + Math.sin(bugAng) * iconR;
      const dashX = x + Math.cos(dashAng) * iconR;
      const dashY = y + Math.sin(dashAng) * iconR;
      const bugReady = p.bugCd <= 0;
      const bugPct = bugReady ? 1 : 1 - Math.min(1, p.bugCd / (BUG.cooldown[p.bugKind] ?? 6));
      const dashReady = p.dashCd <= 0;
      const dashPct = dashReady ? 1 : 1 - Math.min(1, p.dashCd / PLAYER.dashCooldown);
      ctx.save();
      ctx.globalAlpha = bugReady ? 0.8 : 0.22;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      if (p.bugKind === 0) {
        ctx.moveTo(bugX, bugY - 5);
        ctx.lineTo(bugX + 5, bugY);
        ctx.lineTo(bugX, bugY + 5);
        ctx.lineTo(bugX - 5, bugY);
        ctx.closePath();
      } else if (p.bugKind === 1) {
        ctx.moveTo(bugX - 5, bugY - 5);
        ctx.lineTo(bugX + 5, bugY + 5);
        ctx.moveTo(bugX + 5, bugY - 5);
        ctx.lineTo(bugX - 5, bugY + 5);
      } else if (p.bugKind === 2) {
        ctx.rect(bugX - 6, bugY - 1.6, 12, 3.2);
        ctx.moveTo(bugX - 15, bugY - 4);
        ctx.lineTo(bugX - 15, bugY + 4);
      } else {
        ctx.setLineDash([2, 3]);
        ctx.arc(bugX, bugY, 5, 0, TWO_PI);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (!bugReady) {
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bugX, bugY, 8, -Math.PI / 2, -Math.PI / 2 + TWO_PI * bugPct);
        ctx.stroke();
      }

      ctx.globalAlpha = dashReady ? 0.65 : 0.18;
      ctx.strokeStyle = '#dff7ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(dashX - 4, dashY - 5);
      ctx.lineTo(dashX, dashY);
      ctx.lineTo(dashX + 4, dashY - 5);
      ctx.stroke();
      if (!dashReady) {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(dashX, dashY, 8, -Math.PI / 2, -Math.PI / 2 + TWO_PI * dashPct);
        ctx.stroke();
      }
      // Beam readiness sits beside the bug icon. It is a separate cooldown from the bug
      // because tapping and holding the same button are different jobs.
      const beamAng = facing + 2.95;
      const beamX = x + Math.cos(beamAng) * iconR;
      const beamY = y + Math.sin(beamAng) * iconR;
      const beamReady = p.laserCd <= 0 && p.laserT <= 0;
      ctx.globalAlpha = p.laserT > 0 ? 0.95 : beamReady ? 0.7 : 0.2;
      ctx.strokeStyle = color;
      ctx.lineWidth = p.laserT > 0 ? 2.4 : 1.4;
      ctx.beginPath();
      ctx.moveTo(beamX, beamY - 5);
      ctx.lineTo(beamX, beamY + 5);
      ctx.stroke();
      if (!beamReady && p.laserT <= 0) {
        const cdPct = 1 - Math.min(1, p.laserCd / PLAYER.laserCooldown);
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(beamX, beamY, 8, -Math.PI / 2, -Math.PI / 2 + TWO_PI * cdPct);
        ctx.stroke();
      }

      // Burst ammo floats directly behind the avatar: three dots, one per quick shot.
      const burstAng = facing + Math.PI;
      const burstX = x + Math.cos(burstAng) * iconR;
      const burstY = y + Math.sin(burstAng) * iconR;
      const burstNX = -Math.sin(burstAng);
      const burstNY = Math.cos(burstAng);
      for (let b = 0; b < 3; b++) {
        const off = (b - 1) * 5;
        ctx.globalAlpha = b < p.burstLeft ? 0.9 : 0.18;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(burstX + burstNX * off, burstY + burstNY * off, 1.7, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

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

      if (p.chargeT > 0.06 && p.waveT <= 0) {
        const pct = Math.min(1, p.chargeT / PLAYER.waveHoldTime);
        const ready = pct >= 1;
        ctx.strokeStyle = color;
        ctx.globalAlpha = ready ? 0.55 + 0.22 * Math.sin(t * 14) : 0.28;
        ctx.lineWidth = ready ? 3 : 2;
        if (ready) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(x, y, PLAYER.radius + 13, -Math.PI / 2, -Math.PI / 2 + TWO_PI * pct);
        ctx.stroke();
        if (ready) ctx.setLineDash([]);
      }

      // Health ring is the outermost player circle. It rotates slowly and each lost
      // segment leaves a real gap, so vulnerability reads across the arena.
      const freshSegments = Math.max(0, Math.min(PLAYER.hp, Math.ceil(p.hp)));
      const hpFrac = Math.max(0, Math.min(1, p.hp / PLAYER.hp));
      const spin = t * 0.22 + (1 - spinUp) * 18;
      ctx.strokeStyle = p.hitFlash > 0 ? '#ffffff' : color;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      for (let h = 0; h < PLAYER.hp; h++) {
        if (h >= freshSegments) continue;
        const a0 = -Math.PI / 2 + spin + h * (HEALTH_SPAN + HEALTH_GAP) + HEALTH_GAP / 2;
        ctx.moveTo(x + Math.cos(a0) * PLAYER.radius, y + Math.sin(a0) * PLAYER.radius);
        ctx.arc(x, y, PLAYER.radius, a0, a0 + HEALTH_SPAN);
      }
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

      // Small heading arrow outside the health ring. No extra full rings around the body.
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

      // Energy is a short arc at the back of the avatar, not another full ring.
      const energyPct = Math.max(0, Math.min(1, p.energy / PLAYER.energyMax));
      const energyStart = facing + Math.PI - 0.55;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, PLAYER.radius - 4, energyStart, energyStart + 1.1 * energyPct);
      ctx.stroke();

      // Vulnerable core: shrinks and destabilizes as segments are lost.
      const coreR = PLAYER.radius * (0.3 + 0.28 * hpFrac) * (1 + 0.035 * Math.sin(t * 4 + p.slot));
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = 'rgba(2, 7, 12, 0.88)';
      ctx.beginPath();
      ctx.arc(x, y, coreR, 0, TWO_PI);
      ctx.fill();
      ctx.restore();

      if (hpFrac <= 0.34) {
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
      const symScale = 0.6 + 0.4 * hpFrac;
      const jitterX = hpFrac <= 0.34 ? Math.sin(t * 31 + p.slot) * 1.2 : 0;
      const jitterY = hpFrac <= 0.34 ? Math.cos(t * 27 + p.slot) * 1.2 : 0;
      ctx.save();
      ctx.translate(x + jitterX, y + 1 + jitterY);
      ctx.scale(symScale, symScale);
      drawGlyph(ctx, slotGlyph(p.slot), 0, 0, 10.2);
      ctx.restore();

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
    ctx.restore();

    const pipW = 4;
    const gap = 2;
    const total = d.maxHp * pipW + (d.maxHp - 1) * gap;
    for (let i = 0; i < d.maxHp; i++) {
      ctx.fillStyle = i < d.hp ? particleColor(P_COLOR_ICE) : 'rgba(120, 170, 190, 0.16)';
      ctx.fillRect(x - total / 2 + i * (pipW + gap), y + d.radius + 8, pipW, 2);
    }
    void t;
  }

  private drawHud(state: RenderState, t: number): void {
    const ctx = this.ctx;
    const players = state.players;

    // The arena itself carries the identity. Text only appears for a wave change,
    // which is transient information between waves.
    if (state.mode === 'gauntlet' && (state.waveBannerT ?? 0) > 0) {
      const bannerT = state.waveBannerT ?? 0;
      const fadeIn = Math.min(1, (3 - bannerT) / 0.35);
      const fadeOut = Math.min(1, bannerT / 0.8);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = FONT_MID;
      ctx.fillStyle = THREAT_COLORS.firewall;
      ctx.fillText(`WAVE ${state.wave ?? 1}`, VIEW_W * 0.5, VIEW_H * 0.34);
      ctx.font = FONT_TINY;
      ctx.fillStyle = 'rgba(255, 190, 120, 0.72)';
      ctx.fillText('SYSTEM PRESSURE RISING', VIEW_W * 0.5, VIEW_H * 0.34 + 16);
      ctx.restore();
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
          ctx.fillStyle = s < p.score ? slotColor(p.slot) : 'rgba(120, 170, 190, 0.14)';
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
