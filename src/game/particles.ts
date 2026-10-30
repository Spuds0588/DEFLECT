import { PROGRAM_COLORS, slotColor, THREAT_COLORS } from './identity';

export const P_COLOR_WHITE = -1;
export const P_COLOR_DANGER = -2;
export const P_COLOR_ICE = -3;
export const P_COLOR_WORM = -4;
export const P_COLOR_VIRUS = -5;
export const P_COLOR_FIREWALL = -6;
export const P_COLOR_DUST = -7;
export const P_COLOR_TOXIN = -8;
export const P_COLOR_BUFFER = -9;

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  drag: number;
  kind: number; // 0 spark line, 1 shard, 2 ring, 3 ghost, 4 dot
  color: number;
  rot: number;
  vrot: number;
}

const POOL = 640;

export function particleColor(color: number): string {
  if (color >= 0) return slotColor(color);
  if (color === P_COLOR_WHITE) return '#ffffff';
  if (color === P_COLOR_DANGER) return '#ff7a3c';
  if (color === P_COLOR_WORM) return THREAT_COLORS.worm;
  if (color === P_COLOR_VIRUS) return THREAT_COLORS.virus;
  if (color === P_COLOR_FIREWALL) return THREAT_COLORS.firewall;
  if (color === P_COLOR_DUST) return '#8d979e';
  if (color === P_COLOR_TOXIN) return PROGRAM_COLORS.toxic;
  if (color === P_COLOR_BUFFER) return PROGRAM_COLORS.buffer;
  return '#9fd7e8';
}

export class ParticleSystem {
  readonly pool: Particle[];
  private cursor = 0;

  constructor() {
    this.pool = new Array(POOL);
    for (let i = 0; i < POOL; i++) {
      this.pool[i] = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        max: 1,
        size: 1,
        grow: 0,
        drag: 0,
        kind: 0,
        color: 0,
        rot: 0,
        vrot: 0,
      };
    }
  }

  private take(): Particle {
    for (let i = 0; i < POOL; i++) {
      const idx = (this.cursor + i) % POOL;
      if (!this.pool[idx].active) {
        this.cursor = (idx + 1) % POOL;
        return this.pool[idx];
      }
    }
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % POOL;
    return p;
  }

  spawn(
    kind: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: number,
    drag = 0,
    grow = 0,
    rot = 0,
    vrot = 0,
  ): void {
    const p = this.take();
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.grow = grow;
    p.drag = drag;
    p.kind = kind;
    p.color = color;
    p.rot = rot;
    p.vrot = vrot;
  }

  burst(x: number, y: number, count: number, color: number, minSpeed: number, maxSpeed: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      this.spawn(
        0,
        x,
        y,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        0.18 + Math.random() * 0.24,
        1.4 + Math.random() * 1.4,
        color,
        3.2,
      );
    }
  }

  shards(x: number, y: number, count: number, color: number, minSpeed: number, maxSpeed: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      this.spawn(
        1,
        x,
        y,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        0.35 + Math.random() * 0.5,
        2 + Math.random() * 4,
        color,
        1.8,
        0,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 14,
      );
    }
  }

  cone(x: number, y: number, angle: number, count: number, color: number, speed: number, spread: number): void {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.5 + Math.random() * 0.8);
      this.spawn(0, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.14 + Math.random() * 0.18, 1.2 + Math.random() * 1.2, color, 4);
    }
  }

  ring(x: number, y: number, color: number, radius: number, grow: number, life: number): void {
    this.spawn(2, x, y, 0, 0, life, radius, color, 0, grow);
  }

  /**
   * Directional triangle spray. The cone points along the knockback vector, so a hit reads
   * as coming from the side the victim is being pushed away from.
   */
  impact(x: number, y: number, dirX: number, dirY: number, color: number, count: number): void {
    const base = dirX * dirX + dirY * dirY > 0.0001 ? Math.atan2(dirY, dirX) : Math.random() * Math.PI * 2;
    const sx = x - Math.cos(base) * 6;
    const sy = y - Math.sin(base) * 6;
    for (let i = 0; i < count; i++) {
      const a = base + (Math.random() - 0.5) * 1.9;
      const speed = 160 + Math.random() * 420;
      this.spawn(
        1,
        sx,
        sy,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        0.3 + Math.random() * 0.38,
        2.4 + Math.random() * 4,
        i % 3 === 0 ? P_COLOR_WHITE : color,
        2.2,
        0,
        Math.random() * Math.PI * 2,
        (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 12),
      );
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.size += p.grow * dt;
      p.rot += p.vrot * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      const t = Math.max(0, p.life / p.max);
      ctx.globalAlpha = t * t;
      ctx.strokeStyle = particleColor(p.color);
      ctx.fillStyle = ctx.strokeStyle;
      switch (p.kind) {
        case 0: {
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
          ctx.stroke();
          break;
        }
        case 1: {
          const s = p.size;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.moveTo(s, 0);
          ctx.lineTo(-s * 0.7, s * 0.8);
          ctx.lineTo(-s * 0.4, -s * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 2: {
          ctx.lineWidth = 1.5 + t * 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 3: {
          ctx.lineWidth = 2;
          ctx.globalAlpha = t * 0.35;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 5: {
          // Filled circle, used by Toxic's spray: the death-shard burst, but round.
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.6, p.size * (0.45 + 0.55 * t)), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        default: {
          ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
