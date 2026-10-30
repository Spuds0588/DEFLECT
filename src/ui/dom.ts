import { drawGlyph, slotColor, slotGlyph } from '../game/identity';

export function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

export function clearChildren(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Sizes a layout canvas to its CSS box at device pixel ratio and returns a context
 * already transformed into design units, so drawings stay crisp at any width and
 * label sizes are readable rather than baked into a fixed bitmap. Caller restores.
 */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  designW: number,
  designH: number,
): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const cssW = Math.max(240, Math.round(canvas.clientWidth || designW));
  const cssH = Math.round((cssW * designH) / designW);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.aspectRatio = `${designW} / ${designH}`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.save();
  const k = cssW / designW;
  ctx.scale(k, k);
  return ctx;
}

export function toast(message: string, tone: 'info' | 'warn' | 'error' = 'info'): void {
  const host = document.getElementById('toasts');
  if (!host) return;
  while (host.children.length >= 3) host.removeChild(host.firstChild!);
  const item = document.createElement('div');
  item.className = `toast ${tone === 'info' ? '' : tone}`.trim();
  item.textContent = message;
  host.appendChild(item);
  window.setTimeout(() => {
    item.classList.add('out');
    window.setTimeout(() => item.remove(), 280);
  }, 3200);
}

/** Draws a lobby-sized identity chip: glowing ring + the slot glyph. */
export function drawAvatar(canvas: HTMLCanvasElement, slot: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = 2;
  const size = 40;
  if (canvas.width !== size * dpr) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const color = slotColor(slot);
  const cx = size / 2;
  const cy = size / 2;
  const r = 13;

  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.95;
  drawGlyph(ctx, slotGlyph(slot), cx, cy, 5.2);
  ctx.globalAlpha = 1;
}
