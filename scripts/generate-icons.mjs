/**
 * Generates the PWA raster icons (public/icon-192.png, icon-512.png,
 * apple-touch-icon.png) with zero dependencies.
 *
 * Run:  node scripts/generate-icons.mjs
 *
 * The painter works in normalized [0..1] space with signed-distance antialiasing,
 * so every size renders identically (mirrors public/icon.svg).
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public');

// ── Minimal PNG encoder ─────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ── Painter (normalized coordinates, SDF antialiasing) ─────────────────────
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (edge, x) => clamp(0.5 + (edge - x), 0, 1); // 1px soft edge

// Rounded-rect SDF (robust):
function sdBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(ox * ox + oy * oy) - r;
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function paint(size) {
  const buf = Buffer.alloc(size * size * 4);
  const put = (x, y, r, g, b, a) => {
    const i = (y * size + x) * 4;
    const na = a + buf[i + 3] * (1 - a);
    if (na <= 0) return;
    buf[i] = Math.round((r * a + buf[i] * buf[i + 3] * (1 - a)) / na);
    buf[i + 1] = Math.round((g * a + buf[i + 1] * buf[i + 3] * (1 - a)) / na);
    buf[i + 2] = Math.round((b * a + buf[i + 2] * buf[i + 3] * (1 - a)) / na);
    buf[i + 3] = Math.round(na * 255);
  };
  const px = (n) => n * size;
  const fill = (x0, y0, x1, y1, r, color) => {
    const aa = 1.5 / size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size;
        const v = (y + 0.5) / size;
        const d = sdBox(u, v, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, r);
        const a = smooth(-d / size + aa, 0) * 255;
        if (a > 0) put(x, y, ...color, a / 255);
      }
    }
  };
  const disc = (cx, cy, r, color) => {
    const aa = 1.5 / size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size;
        const v = (y + 0.5) / size;
        const d = sdCircle(u, v, cx, cy, r);
        const a = smooth(-d / size + aa, 0) * 255;
        if (a > 0) put(x, y, ...color, a / 255);
      }
    }
  };

  const CYAN = [124, 210, 241];
  const DARK = [0, 53, 67];
  const DARKER = [14, 58, 71];
  const MID = [92, 179, 209];
  const LIGHT = [228, 226, 225];

  // Background rounded square (full-bleed for 'any'; maskable-safe shape kept inside).
  fill(0, 0, 1, 1, 0.21, CYAN);
  // Interlocking blocks
  fill(0.172, 0.172, 0.582, 0.582, 0.082, DARK);
  fill(0.52, 0.52, 0.844, 0.844, 0.07, DARKER);
  fill(0.309, 0.309, 0.559, 0.559, 0.055, MID);
  disc(0.781, 0.219, 0.059, LIGHT);

  return encodePng(size, buf);
}

mkdirSync(OUT, { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(OUT, name), paint(size));
  console.log(`wrote public/${name} (${size}x${size})`);
}
