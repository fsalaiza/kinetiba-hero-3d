// Icon drawers — white embossed on cream face textures
// Emboss effect: subtle shadow (down-right, alpha 0.12) + white icon (alpha 0.92)

const SHADOW_COLOR = "rgba(0,0,0,0.12)";
const ICON_COLOR = "rgba(255,255,255,0.92)";
const SHADOW_OFFSET = 2;

export function drawBars(ctx, s) {
  const m = s * 0.18;
  const heights = [0.35, 0.6, 0.42, 0.75, 0.55];
  const bw = s * 0.1;
  const gap = s * 0.03;
  const total = heights.length * bw + (heights.length - 1) * gap;
  const startX = (s - total) / 2;

  // Shadow
  ctx.fillStyle = SHADOW_COLOR;
  heights.forEach((h, i) => {
    const bh = h * (s - m * 2) * 0.8;
    const x = startX + i * (bw + gap) + SHADOW_OFFSET;
    const y = s - m - bh + SHADOW_OFFSET;
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 3); ctx.fill();
  });
  // Icon
  ctx.fillStyle = ICON_COLOR;
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

  // Shadow
  ctx.beginPath();
  ctx.strokeStyle = SHADOW_COLOR; ctx.lineWidth = 7;
  pts.forEach(([px, py], i) => { const [x, y] = map([px, py], SHADOW_OFFSET, SHADOW_OFFSET); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.stroke();

  // Icon
  ctx.beginPath();
  ctx.strokeStyle = ICON_COLOR; ctx.lineWidth = 6;
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  pts.forEach(([px, py], i) => { const [x, y] = map([px, py]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.stroke();

  ctx.fillStyle = ICON_COLOR;
  pts.forEach(([px, py]) => { const [x, y] = map([px, py]); ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill(); });
}

export function drawGauge(ctx, s) {
  const cx = s / 2, cy = s / 2, r = s * 0.28, val = 0.72;

  // Shadow
  ctx.globalAlpha = 0.12;
  ctx.beginPath(); ctx.arc(cx + SHADOW_OFFSET, cy + SHADOW_OFFSET, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#000"; ctx.lineWidth = 14; ctx.stroke();

  // Track
  ctx.globalAlpha = 0.1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 14; ctx.stroke();

  // Value arc
  ctx.globalAlpha = 0.92;
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * val);
  ctx.strokeStyle = ICON_COLOR; ctx.lineWidth = 14; ctx.lineCap = "round"; ctx.stroke();

  // Text
  ctx.fillStyle = ICON_COLOR;
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
  drawLines(SHADOW_COLOR, 4.5, SHADOW_OFFSET, SHADOW_OFFSET);
  drawLines(ICON_COLOR, 3.8, 0, 0);
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
  draw(SHADOW_COLOR, SHADOW_OFFSET, SHADOW_OFFSET);
  draw(ICON_COLOR, 0, 0);
}

export function drawKPI(ctx, s) {
  const cx = s / 2, cy = s / 2;
  ctx.font = `bold ${Math.floor(s * 0.28)}px monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.12; ctx.fillStyle = "#000";
  ctx.fillText("42", cx + SHADOW_OFFSET, cy - s * 0.03 + SHADOW_OFFSET);
  ctx.globalAlpha = 0.92; ctx.fillStyle = ICON_COLOR;
  ctx.fillText("42", cx, cy - s * 0.03);
  ctx.globalAlpha = 0.5; ctx.font = `${Math.floor(s * 0.08)}px monospace`;
  ctx.fillStyle = ICON_COLOR;
  ctx.fillText("MRR", cx, cy + s * 0.17);
  ctx.globalAlpha = 1;
}

export const ICON_DRAWERS = [drawBars, drawLine, drawGauge, drawGrid, drawChevron, drawKPI];
