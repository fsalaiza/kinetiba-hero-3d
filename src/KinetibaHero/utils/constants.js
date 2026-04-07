import * as THREE from "three";

// ============================================================
// CUBE GEOMETRY
// ============================================================
export const PIECE_SIZE = 0.85;
export const GAP = 0.14;
export const CELL = PIECE_SIZE + GAP;
export const BEVEL_RADIUS = 0.06;
export const BEVEL_SEGMENTS = 4;

export const LAYER_COLORS = ["#8B3A3A", "#3A5A8B", "#3A8B5A"];

// Ceramic material colors (pre-allocated to avoid re-creation per render)
export const SPECULAR_COLOR = new THREE.Color('#F5F0E8');
export const SHEEN_COLOR = new THREE.Color('#E2DDD5');
export const NORMAL_SCALE = new THREE.Vector2(0.25, 0.25);

// Decal positioning
export const DECAL_SIZE = PIECE_SIZE * 0.72;
export const DECAL_OFFSET = PIECE_SIZE / 2 - 0.013;

export const FACE_DEFS = [
  { axis: "+x", check: (gx) => gx === 1,  idx: 0, pos: [DECAL_OFFSET, 0, 0],  rot: [0, Math.PI / 2, 0] },
  { axis: "-x", check: (gx) => gx === -1, idx: 1, pos: [-DECAL_OFFSET, 0, 0], rot: [0, -Math.PI / 2, 0] },
  { axis: "+y", check: (_,gy) => gy === 1,  idx: 2, pos: [0, DECAL_OFFSET, 0],  rot: [-Math.PI / 2, 0, 0] },
  { axis: "-y", check: (_,gy) => gy === -1, idx: 3, pos: [0, -DECAL_OFFSET, 0], rot: [Math.PI / 2, 0, 0] },
  { axis: "+z", check: (_,__,gz) => gz === 1,  idx: 4, pos: [0, 0, DECAL_OFFSET],  rot: [0, 0, 0] },
  { axis: "-z", check: (_,__,gz) => gz === -1, idx: 5, pos: [0, 0, -DECAL_OFFSET], rot: [0, Math.PI, 0] },
];

// ============================================================
// TYPOGRAPHY
// ============================================================
export const monoFont = "'SF Mono', 'Fira Code', 'Cascadia Code', monospace";
export const sansFont = "'SF Pro Display', -apple-system, 'Helvetica Neue', sans-serif";

// ============================================================
// LOCATIONS (for glitch rotation)
// ============================================================
export const LOCATIONS = [
  { city: "CDMX — México", coords: "↕ 19.4326  · · ·  -99.1332" },
  { city: "GDL — Guadalajara", coords: "↕ 20.6597  · · ·  -103.3496" },
];

// ============================================================
// GLITCH
// ============================================================
export const GLITCH_CHARS = '█▓░▒▀▄■□▪▫▬▮▯┃┫┣━┳┻╋';

export const GLITCH_CSS = `
@keyframes glitch-clip {
  0%   { clip-path: inset(0 0 85% 0); transform: translateX(-3px); }
  10%  { clip-path: inset(15% 0 65% 0); transform: translateX(2px); }
  20%  { clip-path: inset(40% 0 30% 0); transform: translateX(-2px); }
  30%  { clip-path: inset(60% 0 15% 0); transform: translateX(3px); }
  40%  { clip-path: inset(25% 0 50% 0); transform: translateX(-1px); }
  50%  { clip-path: inset(75% 0 5% 0); transform: translateX(2px); }
  60%  { clip-path: inset(10% 0 70% 0); transform: translateX(-3px); }
  70%  { clip-path: inset(50% 0 25% 0); transform: translateX(1px); }
  80%  { clip-path: inset(80% 0 0% 0); transform: translateX(-2px); }
  90%  { clip-path: inset(5% 0 90% 0); transform: translateX(2px); }
  100% { clip-path: inset(0 0 0 0); transform: translateX(0); }
}
@keyframes glitch-flicker {
  0%, 20%, 40%, 60%, 80%, 100% { opacity: 1; }
  10%, 30%, 50%, 70%, 90% { opacity: 0.7; }
  15%, 55% { opacity: 0.3; }
}
@keyframes glitch-rgb {
  0%   { text-shadow: 2px 0 #ff000040, -2px 0 #00ffff40; }
  25%  { text-shadow: -2px 1px #ff000050, 2px -1px #00ffff50; }
  50%  { text-shadow: 1px -1px #ff000040, -1px 1px #00ffff40; }
  75%  { text-shadow: -3px 0 #ff000050, 3px 0 #00ffff50; }
  100% { text-shadow: 0 0 transparent, 0 0 transparent; }
}
.loc-glitch-active {
  animation: glitch-clip 0.15s steps(2) 3, glitch-flicker 0.45s linear, glitch-rgb 0.45s linear;
}
`;
