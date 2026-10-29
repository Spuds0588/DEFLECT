import { drawGlyph, slotColor, slotGlyph } from '../game/identity';

export function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

export function clearChildren(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
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
