#!/usr/bin/env node
/**
 * Generates the PWA icons as PNGs with zero dependencies.
 * Pure Node: rasterize supersampled shapes -> RGBA buffer -> PNG via zlib.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Draws the DEFLECT mark: dark virtual space, cyan identity ring, white vector diamond,
 * lime center dot. `inset` scales the mark for maskable safe zones.
 */
function drawIcon(size, inset) {
  const ss = 3;
  const S = size * ss;
  const canvas = new Uint8Array(S * S * 4);
  const cx = S / 2;
  const cy = S / 2;
  const mark = (S / 2) * inset;
  const ringR = mark * 0.62;
  const ringW = mark * 0.052;
  const glow = mark * 0.13;
  const diamond = mark * 0.34;
  const diamondW = mark * 0.033;
  const dotR = mark * 0.052;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      const d = Math.hypot(px, py);
      const radial = Math.max(0, 1 - d / (S * 0.62));

      let r = 4 + radial * 5;
      let g = 7 + radial * 15;
      let b = 12 + radial * 22;

      // Cyan ring with soft additive bloom.
      const ringD = Math.abs(d - ringR);
      const ring = 1 - smoothstep(ringW * 0.5, ringW * 0.5 + 1.4, ringD);
      const bloom = Math.exp(-(ringD * ringD) / (glow * glow * 0.5)) * 0.5;
      r += ring * 42 + bloom * 12;
      g += ring * 210 + bloom * 48;
      b += ring * 255 + bloom * 60;

      // Outer thin containment ring, barely visible.
      const thinD = Math.abs(d - mark * 0.93);
      const thin = 1 - smoothstep(0.6, 2.2, thinD);
      r += thin * 14;
      g += thin * 66;
      b += thin * 82;

      // Diamond outline.
      const diamondDist = Math.abs(Math.abs(px) + Math.abs(py) - diamond);
      const diamondMask = 1 - smoothstep(diamondW * 0.4, diamondW * 0.4 + 1.5, diamondDist);
      const diamondBloom = Math.exp(-(diamondDist * diamondDist) / (mark * 0.09 * (mark * 0.09))) * 0.35;
      r += diamondMask * 255 + diamondBloom * 40;
      g += diamondMask * 255 + diamondBloom * 80;
      b += diamondMask * 255 + diamondBloom * 95;

      // Center pulse.
      const dot = 1 - smoothstep(dotR, dotR + 1.6, d);
      r += dot * 40;
      g += dot * 255;
      b += dot * 140;

      const i = (y * S + x) * 4;
      canvas[i] = Math.min(255, r);
      canvas[i + 1] = Math.min(255, g);
      canvas[i + 2] = Math.min(255, b);
      canvas[i + 3] = 255;
    }
  }

  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const i = ((y * ss + sy) * S + (x * ss + sx)) * 4;
          r += canvas[i];
          g += canvas[i + 1];
          b += canvas[i + 2];
        }
      }
      const n = ss * ss;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return out;
}

mkdirSync(OUT, { recursive: true });

const targets = [
  { name: 'icon-192.png', size: 192, inset: 1 },
  { name: 'icon-512.png', size: 512, inset: 1 },
  { name: 'apple-touch-icon.png', size: 180, inset: 1 },
  { name: 'icon-maskable-512.png', size: 512, inset: 0.78 },
];

for (const target of targets) {
  const rgba = drawIcon(target.size, target.inset);
  const png = encodePng(target.size, target.size, rgba);
  writeFileSync(join(OUT, target.name), png);
  console.log(`wrote public/icons/${target.name} (${png.length} bytes)`);
}
