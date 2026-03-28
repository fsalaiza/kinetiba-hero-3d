// Icon drawers — white/light on cream face textures

export function drawBars(ctx, s) {
  const m = s * 0.18;
  const heights = [0.35, 0.6, 0.42, 0.75, 0.55];
  const bw = s * 0.1;
  const gap = s * 0.03;
  const total = heights.length * bw + (heights.length - 1) * gap;
  const startX = (s - total) / 2;

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  heights.forEach((h, i) => {
    const bh = h * (s - m * 2) * 0.8;
    const x = startX + i * (bw + gap) + 2;
    const y = s - m - bh + 2;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 3);
    ctx.fill();
  });

  ctx.fillStyle = "rgba(255,255,255,1.0)";
  heights.forEach((h, i) => {
    const bh = h * (s - m * 2) * 0.8;
    const x = startX + i * (bw + gap);
    const y = s - m - bh;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 3);
    ctx.fill();
  });
}

export function drawLine(ctx, s) {
  const m = s * 0.18;
  const pts = [
    [0, 0.55], [0.22, 0.25], [0.45, 0.45], [0.68, 0.1], [1, 0.3],
  ];

  ctx.beginPath();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 6.6;
  pts.forEach(([px, py], i) => {
    const x = m + px * (s - m * 2) + 2;
    const y = m + py * (s - m * 2) + 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,1.0)";
  ctx.lineWidth = 5.7;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  pts.forEach(([px, py], i) => {
    const x = m + px * (s - m * 2);
    const y = m + py * (s - m * 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,1.0)";
  pts.forEach(([px, py]) => {
    const x = m + px * (s - m * 2);
    const y = m + py * (s - m * 2);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function drawGauge(ctx, s) {
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.28;
  const val = 0.72;

  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(cx + 2, cy + 2, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 13;
  ctx.stroke();

  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 13;
  ctx.stroke();

  ctx.globalAlpha = 1.0;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * val);
  ctx.strokeStyle = "rgba(255,255,255,1.0)";
  ctx.lineWidth = 13;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.globalAlpha = 1.0;
  ctx.fillStyle = "rgba(255,255,255,1.0)";
  ctx.font = `bold ${Math.floor(s * 0.14)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(Math.floor(val * 100) + "%", cx, cy);
  ctx.globalAlpha = 1;
}

export function drawGrid(ctx, s) {
  const m = s * 0.2;
  const gs = s - m * 2;
  const rows = 3;
  const cols = 3;

  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 4.1;
  for (let r = 0; r <= rows; r++) {
    const y = m + (r / rows) * gs + 1.5;
    ctx.beginPath(); ctx.moveTo(m + 1.5, y); ctx.lineTo(m + gs + 1.5, y); ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    const x = m + (c / cols) * gs + 1.5;
    ctx.beginPath(); ctx.moveTo(x, m + 1.5); ctx.lineTo(x, m + gs + 1.5); ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,1.0)";
  ctx.lineWidth = 3.3;
  for (let r = 0; r <= rows; r++) {
    const y = m + (r / rows) * gs;
    ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(m + gs, y); ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    const x = m + (c / cols) * gs;
    ctx.beginPath(); ctx.moveTo(x, m); ctx.lineTo(x, m + gs); ctx.stroke();
  }
}

export function drawChevron(ctx, s) {
  const cx = s / 2;
  const cy = s / 2;

  ctx.strokeStyle = "rgba(255,255,255,1.0)";
  ctx.lineWidth = 8.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  for (let offset of [-s * 0.08, s * 0.08]) {
    ctx.beginPath();
    ctx.moveTo(cx + offset - s * 0.08 + 2, cy - s * 0.14 + 2);
    ctx.lineTo(cx + offset + s * 0.06 + 2, cy + 2);
    ctx.lineTo(cx + offset - s * 0.08 + 2, cy + s * 0.14 + 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,1.0)";
  for (let offset of [-s * 0.08, s * 0.08]) {
    ctx.beginPath();
    ctx.moveTo(cx + offset - s * 0.08, cy - s * 0.14);
    ctx.lineTo(cx + offset + s * 0.06, cy);
    ctx.lineTo(cx + offset - s * 0.08, cy + s * 0.14);
    ctx.stroke();
  }
}

export function drawKPI(ctx, s) {
  const cx = s / 2;
  const cy = s / 2;

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#000";
  ctx.font = `bold ${Math.floor(s * 0.28)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("42", cx + 2, cy - s * 0.03 + 2);

  ctx.globalAlpha = 1.0;
  ctx.fillStyle = "rgba(255,255,255,1.0)";
  ctx.fillText("42", cx, cy - s * 0.03);

  ctx.globalAlpha = 0.4;
  ctx.font = `${Math.floor(s * 0.08)}px monospace`;
  ctx.fillText("MRR", cx, cy + s * 0.17);
  ctx.globalAlpha = 1;
}

export const ICON_DRAWERS = [drawBars, drawLine, drawGauge, drawGrid, drawChevron, drawKPI];
