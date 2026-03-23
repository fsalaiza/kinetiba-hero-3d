import * as THREE from "three";

// ============================================================
// Minimal Simplex 2D noise (public domain — Stefan Gustavson)
// ============================================================

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function buildPerm(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates shuffle with seed
  let s = seed | 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = ((s >>> 0) % (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  // Double the table to avoid index wrapping
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

function simplex2D(x, y, perm) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;

  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;

  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0, n1 = 0, n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    const g = GRAD2[perm[ii + perm[jj]] % 8];
    n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    const g = GRAD2[perm[ii + i1 + perm[jj + j1]] % 8];
    n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    const g = GRAD2[perm[ii + 1 + perm[jj + 1]] % 8];
    n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
  }

  // Scale to [-1, 1]
  return 70 * (n0 + n1 + n2);
}

// ============================================================
// Generate ceramic grain normal map
// ============================================================

export function generateCeramicNormalMap(size = 512, seed = 0) {
  const perm = buildPerm(seed * 7919 + 31);
  const strength = 0.4;

  // Build heightmap with multi-octave noise
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      let val = 0;
      // Octave 1: coarse grain (freq 80, amp 1.0)
      val += simplex2D(nx * 80, ny * 80, perm) * 1.0;
      // Octave 2: fine grain (freq 180, amp 0.4)
      val += simplex2D(nx * 180, ny * 180, perm) * 0.4;
      // Octave 3: micro-detail (freq 350, amp 0.15)
      val += simplex2D(nx * 350, ny * 350, perm) * 0.15;
      h[y * size + x] = val;
    }
  }

  // Compute normals from partial derivatives and write to canvas
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xp = (x + 1) % size;
      const xm = (x - 1 + size) % size;
      const yp = (y + 1) % size;
      const ym = (y - 1 + size) % size;

      const dx = h[y * size + xp] - h[y * size + xm];
      const dy = h[yp * size + x] - h[ym * size + x];

      const r = (-dx * strength * 0.5 + 0.5) * 255;
      const g = (-dy * strength * 0.5 + 0.5) * 255;

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, r));
      data[idx + 1] = Math.max(0, Math.min(255, g));
      data[idx + 2] = 255; // Z always up
      data[idx + 3] = 255; // Alpha
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}
