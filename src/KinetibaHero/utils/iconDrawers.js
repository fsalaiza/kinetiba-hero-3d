// Icon drawers — white/light on cream face textures

export function drawBars(ctx, s) {
  const m = s * 0.18;
  const heights = [0.35, 0.6, 0.42, 0.75, 0.55];
  const bw = s * 0.1;
  const gap = s * 0.03;
  const total = heights.length * bw + (heights.length - 1) * gap;
  const startX = (s - total) / 2;

  // Darker shadow for contrast
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  heights.forEach((h, i) => {
    const bh = h * (s - m * 2) * 0.8;
    const x = startX + i * (bw + gap) + 2;
    const y = s - m - bh + 2;
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 3); ctx.fill();
  });
  // Brighter white for the bars
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  heights.forEach((h, i) => {
    const bh = h * (s - m * 2) * 0.8;
    const x = startX + i * (bw + gap);
    const y = s - m - bh;
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 3); ctx.fill();
  });
}

export function drawLine(ctx, s) {
  const m = s * 0.18;
  const pts = [[0, 0.55], [0.22, 0.25], [0.45, 0.45], [0.68, 0.1], [1, 0.3]];
  const map = ([px, py], dx = 0, dy = 0) => [m + px * (s - m * 2) + dx, m + py * (s - m * 2) + dy];

  ctx.beginPath();
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 7;
  pts.forEach(([px, py], i) => { const [x, y] = map([px, py], 2, 2); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 6;
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  pts.forEach(([px, py], i) => { const [x, y] = map([px, py]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  pts.forEach(([px, py]) => { const [x, y] = map([px, py]); ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill(); });
}

export function drawGauge(ctx, s) {
  const cx = s / 2, cy = s / 2, r = s * 0.28, val = 0.72;
  ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.arc(cx + 2, cy + 2, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#000"; ctx.lineWidth = 14; ctx.stroke();
  ctx.globalAlpha = 0.15;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 14; ctx.stroke();
  ctx.globalAlpha = 0.95;
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * val);
  ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 14; ctx.lineCap = "round"; ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `bold ${Math.floor(s * 0.14)}px monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(Math.floor(val * 100) + "%", cx, cy);
  ctx.globalAlpha = 1;
}

export function drawGrid(ctx, s) {
  const m = s * 0.2, gs = s - m * 2, rows = 3, cols = 3;
  const drawLines = (style, lw, dx, dy) => {
    ctx.strokeStyle = style; ctx.lineWidth = lw;
    for (let r = 0; r <= rows; r++) {
      const y = m + (r / rows) * gs + dy;
      ctx.beginPath(); ctx.moveTo(m + dx, y); ctx.lineTo(m + gs + dx, y); ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      const x = m + (c / cols) * gs + dx;
      ctx.beginPath(); ctx.moveTo(x, m + dy); ctx.lineTo(x, m + gs + dy); ctx.stroke();
    }
  };
  drawLines("rgba(0,0,0,0.35)", 4.5, 1.5, 1.5);
  drawLines("rgba(255,255,255,0.95)", 3.8, 0, 0);
}

export function drawChevron(ctx, s) {
  const cx = s / 2, cy = s / 2;
  ctx.lineWidth = 8.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const draw = (style, dx, dy) => {
    ctx.strokeStyle = style;
    for (const offset of [-s * 0.08, s * 0.08]) {
      ctx.beginPath();
      ctx.moveTo(cx + offset - s * 0.08 + dx, cy - s * 0.14 + dy);
      ctx.lineTo(cx + offset + s * 0.06 + dx, cy + dy);
      ctx.lineTo(cx + offset - s * 0.08 + dx, cy + s * 0.14 + dy);
      ctx.stroke();
    }
  };
  draw("rgba(0,0,0,0.35)", 2, 2);
  draw("rgba(255,255,255,0.95)", 0, 0);
}

export function drawKPI(ctx, s) {
  const cx = s / 2, cy = s / 2;
  ctx.font = `bold ${Math.floor(s * 0.28)}px monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.35; ctx.fillStyle = "#000";
  ctx.fillText("42", cx + 2, cy - s * 0.03 + 2);
  ctx.globalAlpha = 0.95; ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText("42", cx, cy - s * 0.03);
  ctx.globalAlpha = 0.5; ctx.font = `${Math.floor(s * 0.08)}px monospace`;
  ctx.fillText("MRR", cx, cy + s * 0.17);
  ctx.globalAlpha = 1;
}

export const ICON_DRAWERS = [drawBars, drawLine, drawGauge, drawGrid, drawChevron, drawKPI];
