import * as THREE from "three";
import { ICON_DRAWERS } from "./iconDrawers";

function addGrain(ctx, w, h, intensity = 8) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * intensity;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
}

function drawFrame(ctx, size, fg) {
  const pad = size * 0.06;
  const rr = size * 0.05;
  const screwR = size * 0.02;
  const screwOff = size * 0.1;

  ctx.strokeStyle = fg;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(pad + rr, pad);
  ctx.lineTo(size - pad - rr, pad);
  ctx.quadraticCurveTo(size - pad, pad, size - pad, pad + rr);
  ctx.lineTo(size - pad, size - pad - rr);
  ctx.quadraticCurveTo(size - pad, size - pad, size - pad - rr, size - pad);
  ctx.lineTo(pad + rr, size - pad);
  ctx.quadraticCurveTo(pad, size - pad, pad, size - pad - rr);
  ctx.lineTo(pad, pad + rr);
  ctx.quadraticCurveTo(pad, pad, pad + rr, pad);
  ctx.stroke();

  ctx.globalAlpha = 0.4;
  ctx.fillStyle = fg;
  [
    [screwOff, screwOff],
    [size - screwOff, screwOff],
    [screwOff, size - screwOff],
    [size - screwOff, size - screwOff],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, screwR, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

export function createFaceTexture(gx, gy, gz, faceIdx, textureSize = 512) {
  const size = textureSize;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Cream/off-white base color
  const seed = (gx + 2) * 100 + (gy + 2) * 10 + (gz + 2) + faceIdx * 1000;
  const r = 228 + ((seed * 7) % 12) - 6;
  const g = 224 + ((seed * 11) % 12) - 6;
  const b = 216 + ((seed * 13) % 10) - 5;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  // Subtle grid pattern
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = `rgb(${r - 25},${g - 25},${b - 25})`;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < size; i += 24) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Much darker, more visible frame
  const fg = `rgb(${r - 70},${g - 70},${b - 70})`;
  drawFrame(ctx, size, fg);

  // Stronger inner shadow for depth
  const shadowGrad = ctx.createLinearGradient(0, 0, 0, size * 0.2);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.2)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(size * 0.06, size * 0.06, size * 0.88, size * 0.4);

  const iconIdx = (Math.abs(gx * 7 + gy * 13 + gz * 19) + faceIdx * 3) % ICON_DRAWERS.length;
  ICON_DRAWERS[iconIdx](ctx, size);

  addGrain(ctx, size, size, 15);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
}

export function generateRoughnessMap(width = 256, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const n1 = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 0.3;
      const n2 = Math.sin(x * 0.13 + 1.7) * Math.cos(y * 0.11 + 2.3) * 0.2;
      const n3 = (Math.random() - 0.5) * 0.15;
      const val = 0.65 + n1 + n2 + n3;
      const byte = Math.max(0, Math.min(255, Math.floor(val * 255)));
      data[i] = byte;
      data[i + 1] = byte;
      data[i + 2] = byte;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
