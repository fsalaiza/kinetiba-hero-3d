/*
  Kinetiba Hero — R3F + Drei + Post-processing
  ==============================================
  Dependencies:
    npm install three @react-three/fiber @react-three/drei @react-three/postprocessing

  Usage:
    import KinetibaHero from './KinetibaHero'
    <KinetibaHero />
*/

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  RoundedBox,
  Environment,
  ContactShadows,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  N8AO,
} from "@react-three/postprocessing";
import * as THREE from "three";

// ============================================================
// CONFIG
// ============================================================
const PIECE_SIZE = 0.85;
const GAP = 0.14;
const CELL = PIECE_SIZE + GAP;
const BEVEL_RADIUS = 0.06;
const BEVEL_SEGMENTS = 4;

const LAYER_COLORS = ["#8B3A3A", "#3A5A8B", "#3A8B5A"];

// Ceramic material colors (pre-allocated to avoid re-creation per render)
const SPECULAR_COLOR = new THREE.Color('#F5F0E8');
const SHEEN_COLOR = new THREE.Color('#D4CFC4');

// ============================================================
// SCROLL PROGRESS HOOK
// ============================================================

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const p = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      progressRef.current = p;
      setProgress(p);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { progress, progressRef };
}

function sectionOpacity(scrollProgress, sectionStart, sectionEnd) {
  const fadeIn = 0.04;
  const fadeOut = 0.04;
  if (scrollProgress < sectionStart || scrollProgress > sectionEnd) return 0;
  if (scrollProgress < sectionStart + fadeIn)
    return (scrollProgress - sectionStart) / fadeIn;
  if (scrollProgress > sectionEnd - fadeOut)
    return (sectionEnd - scrollProgress) / fadeOut;
  return 1;
}

// ============================================================
// CANVAS TEXTURE GENERATORS
// ============================================================

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

  // Border frame
  ctx.strokeStyle = fg;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.3;
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

  // Corner screws
  ctx.globalAlpha = 0.3;
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

// Icon drawers — white/light on cream
function drawBars(ctx, s) {
  const m = s * 0.18;
  const heights = [0.35, 0.6, 0.42, 0.75, 0.55];
  const bw = s * 0.1;
  const gap = s * 0.03;
  const total = heights.length * bw + (heights.length - 1) * gap;
  const startX = (s - total) / 2;

  // Shadow under bars
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  heights.forEach((h, i) => {
    const bh = h * (s - m * 2) * 0.8;
    const x = startX + i * (bw + gap) + 2;
    const y = s - m - bh + 2;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 3);
    ctx.fill();
  });

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  heights.forEach((h, i) => {
    const bh = h * (s - m * 2) * 0.8;
    const x = startX + i * (bw + gap);
    const y = s - m - bh;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 3);
    ctx.fill();
  });
}

function drawLine(ctx, s) {
  const m = s * 0.18;
  const pts = [
    [0, 0.55],
    [0.22, 0.25],
    [0.45, 0.45],
    [0.68, 0.1],
    [1, 0.3],
  ];

  // Shadow line
  ctx.beginPath();
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 5.6;
  pts.forEach(([px, py], i) => {
    const x = m + px * (s - m * 2) + 2;
    const y = m + py * (s - m * 2) + 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Main line
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 4.9;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  pts.forEach(([px, py], i) => {
    const x = m + px * (s - m * 2);
    const y = m + py * (s - m * 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  pts.forEach(([px, py]) => {
    const x = m + px * (s - m * 2);
    const y = m + py * (s - m * 2);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGauge(ctx, s) {
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.28;
  const val = 0.72;

  // Track shadow
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.arc(cx + 2, cy + 2, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 11;
  ctx.stroke();

  // Track
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 11;
  ctx.stroke();

  // Value arc
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * val);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  ctx.stroke();

  // Text
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `bold ${Math.floor(s * 0.14)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(Math.floor(val * 100) + "%", cx, cy);
  ctx.globalAlpha = 1;
}

function drawGrid(ctx, s) {
  const m = s * 0.2;
  const gs = s - m * 2;
  const rows = 3;
  const cols = 3;

  // Shadow
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 3.5;
  for (let r = 0; r <= rows; r++) {
    const y = m + (r / rows) * gs + 1.5;
    ctx.beginPath();
    ctx.moveTo(m + 1.5, y);
    ctx.lineTo(m + gs + 1.5, y);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    const x = m + (c / cols) * gs + 1.5;
    ctx.beginPath();
    ctx.moveTo(x, m + 1.5);
    ctx.lineTo(x, m + gs + 1.5);
    ctx.stroke();
  }

  // Lines
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 2.8;
  for (let r = 0; r <= rows; r++) {
    const y = m + (r / rows) * gs;
    ctx.beginPath();
    ctx.moveTo(m, y);
    ctx.lineTo(m + gs, y);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    const x = m + (c / cols) * gs;
    ctx.beginPath();
    ctx.moveTo(x, m);
    ctx.lineTo(x, m + gs);
    ctx.stroke();
  }
}

function drawChevron(ctx, s) {
  const cx = s / 2;
  const cy = s / 2;

  // Double chevron >>
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Shadow
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  for (let offset of [-s * 0.08, s * 0.08]) {
    ctx.beginPath();
    ctx.moveTo(cx + offset - s * 0.08 + 2, cy - s * 0.14 + 2);
    ctx.lineTo(cx + offset + s * 0.06 + 2, cy + 2);
    ctx.lineTo(cx + offset - s * 0.08 + 2, cy + s * 0.14 + 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  for (let offset of [-s * 0.08, s * 0.08]) {
    ctx.beginPath();
    ctx.moveTo(cx + offset - s * 0.08, cy - s * 0.14);
    ctx.lineTo(cx + offset + s * 0.06, cy);
    ctx.lineTo(cx + offset - s * 0.08, cy + s * 0.14);
    ctx.stroke();
  }
}

function drawKPI(ctx, s) {
  const cx = s / 2;
  const cy = s / 2;

  // Shadow
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#000";
  ctx.font = `bold ${Math.floor(s * 0.28)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("42", cx + 2, cy - s * 0.03 + 2);

  // Number
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText("42", cx, cy - s * 0.03);

  // Label
  ctx.globalAlpha = 0.4;
  ctx.font = `${Math.floor(s * 0.08)}px monospace`;
  ctx.fillText("MRR", cx, cy + s * 0.17);
  ctx.globalAlpha = 1;
}

const ICON_DRAWERS = [drawBars, drawLine, drawGauge, drawGrid, drawChevron, drawKPI];

function createFaceTexture(gx, gy, gz, faceIdx) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Base sandstone with slight variation
  const seed = (gx + 2) * 100 + (gy + 2) * 10 + (gz + 2) + faceIdx * 1000;
  const r = 195 + ((seed * 7) % 10) - 5;
  const g = 189 + ((seed * 11) % 10) - 5;
  const b = 175 + ((seed * 13) % 8) - 4;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  // Subtle grid lines
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = `rgb(${r - 30},${g - 30},${b - 30})`;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < size; i += 24) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Frame + screws
  const fg = `rgb(${r - 40},${g - 40},${b - 40})`;
  drawFrame(ctx, size, fg);

  // Icon
  const iconIdx = (Math.abs(gx * 7 + gy * 13 + gz * 19) + faceIdx * 3) % ICON_DRAWERS.length;
  ICON_DRAWERS[iconIdx](ctx, size);

  // Sandstone grain
  addGrain(ctx, size, size, 14);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

// ============================================================
// PROCEDURAL ROUGHNESS MAP
// ============================================================

function generateRoughnessMap(width = 256, height = 256) {
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

// ============================================================
// CUBE PIECE COMPONENT — single cream material + plane decals
// ============================================================

const DECAL_SIZE = PIECE_SIZE * 0.88;
const DECAL_OFFSET = PIECE_SIZE / 2 + 0.002;

const FACE_DEFS = [
  { axis: "+x", check: (gx) => gx === 1,  idx: 0, pos: [DECAL_OFFSET, 0, 0],  rot: [0, Math.PI / 2, 0] },
  { axis: "-x", check: (gx) => gx === -1, idx: 1, pos: [-DECAL_OFFSET, 0, 0], rot: [0, -Math.PI / 2, 0] },
  { axis: "+y", check: (_,gy) => gy === 1,  idx: 2, pos: [0, DECAL_OFFSET, 0],  rot: [-Math.PI / 2, 0, 0] },
  { axis: "-y", check: (_,gy) => gy === -1, idx: 3, pos: [0, -DECAL_OFFSET, 0], rot: [Math.PI / 2, 0, 0] },
  { axis: "+z", check: (_,__,gz) => gz === 1,  idx: 4, pos: [0, 0, DECAL_OFFSET],  rot: [0, 0, 0] },
  { axis: "-z", check: (_,__,gz) => gz === -1, idx: 5, pos: [0, 0, -DECAL_OFFSET], rot: [0, Math.PI, 0] },
];

function CubePiece({ position, gx, gy, gz }) {
  const roughnessMap = useMemo(() => generateRoughnessMap(), []);

  const decals = useMemo(() => {
    return FACE_DEFS
      .filter(({ check }) => check(gx, gy, gz))
      .map(({ axis, idx, pos, rot }) => ({
        axis,
        pos,
        rot,
        texture: createFaceTexture(gx, gy, gz, idx),
      }));
  }, [gx, gy, gz]);

  return (
    <group position={position}>
      <RoundedBox
        args={[PIECE_SIZE, PIECE_SIZE, PIECE_SIZE]}
        radius={BEVEL_RADIUS}
        smoothness={BEVEL_SEGMENTS}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#BFB9AA"
          roughness={0.65}
          roughnessMap={roughnessMap}
          metalness={0.0}
          clearcoat={0.15}
          clearcoatRoughness={0.4}
          ior={1.45}
          specularIntensity={0.6}
          specularColor={SPECULAR_COLOR}
          sheen={0.05}
          sheenColor={SHEEN_COLOR}
          sheenRoughness={0.8}
          envMapIntensity={1.2}
        />
      </RoundedBox>
      {decals.map(({ axis, pos, rot, texture }) => (
        <mesh key={axis} position={pos} rotation={rot}>
          <planeGeometry args={[DECAL_SIZE, DECAL_SIZE]} />
          <meshPhysicalMaterial
            map={texture}
            roughness={0.6}
            metalness={0.0}
            clearcoat={0.12}
            clearcoatRoughness={0.45}
            ior={1.45}
            specularIntensity={0.5}
            specularColor={SPECULAR_COLOR}
            envMapIntensity={1.0}
          />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================
// ACCENT LINES BETWEEN LAYERS
// ============================================================

function AccentLines({ explosionRef }) {
  const groupRef = useRef();

  useFrame(() => {
    if (!groupRef.current || !explosionRef) return;
    const exp = explosionRef.current || 0;
    const targetOpacity = exp > 0.001 ? Math.max(0, 0.4 - exp * 2) : 0.4;
    groupRef.current.children.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.opacity = THREE.MathUtils.lerp(
          mesh.material.opacity,
          targetOpacity,
          0.06
        );
      }
    });
  });

  const lines = [];
  for (let y = -1; y <= 0; y++) {
    const yPos = (y + 0.5) * CELL + PIECE_SIZE / 2 + GAP * 0.25;
    const color = LAYER_COLORS[y + 1];
    const dist = CELL * 1.5 + 0.005;

    for (let side = 0; side < 4; side++) {
      const key = `line-${y}-${side}`;
      const rotation = side >= 2 ? [0, Math.PI / 2, 0] : [0, 0, 0];
      const pos =
        side === 0 ? [0, yPos, dist] :
        side === 1 ? [0, yPos, -dist] :
        side === 2 ? [dist, yPos, 0] :
        [-dist, yPos, 0];

      lines.push(
        <mesh key={key} position={pos} rotation={rotation}>
          <planeGeometry args={[CELL * 3 - GAP * 0.5, 0.02]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      );
    }
  }
  return <group ref={groupRef}>{lines}</group>;
}

// ============================================================
// RUBIK'S CUBE ASSEMBLY + ROTATION
// ============================================================

function RubiksCube({ scrollRef }) {
  const outerRef = useRef();
  const mainRef = useRef();
  const pivotRef = useRef();
  const cubesRef = useRef([]);
  const isRotating = useRef(false);
  const currentExplode = useRef(0);
  const currentRotSpeed = useRef(0.10);
  const rotYAccum = useRef(0);
  const explosionRef = useRef(0);

  // Generate grid positions
  const grid = useMemo(() => {
    const arr = [];
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++)
          arr.push({ gx: x, gy: y, gz: z });
    return arr;
  }, []);

  // Rubik face rotation
  const doFaceRotation = useCallback(() => {
    if (scrollRef && scrollRef.current > 0.2) return;
    if (isRotating.current || !mainRef.current || !pivotRef.current) return;
    isRotating.current = true;

    const axes = ["x", "y", "z"];
    const axis = axes[Math.floor(Math.random() * 3)];
    const layer = [-1, 0, 1][Math.floor(Math.random() * 3)];
    const dir = Math.random() > 0.5 ? 1 : -1;

    // Find pieces in this layer
    const piecesInLayer = [];
    cubesRef.current.forEach((c) => {
      if (!c || !c.mesh) return;
      const g = c.grid;
      const match =
        axis === "x" ? g.gx === layer :
        axis === "y" ? g.gy === layer :
        g.gz === layer;
      if (match) piecesInLayer.push(c);
    });

    if (piecesInLayer.length === 0) {
      isRotating.current = false;
      return;
    }

    const pivot = pivotRef.current;
    const main = mainRef.current;
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld(true);

    // Move pieces to pivot
    piecesInLayer.forEach((c) => {
      const wp = new THREE.Vector3();
      c.mesh.getWorldPosition(wp);
      const wq = new THREE.Quaternion();
      c.mesh.getWorldQuaternion(wq);
      main.remove(c.mesh);
      pivot.add(c.mesh);
      const lp = new THREE.Vector3();
      pivot.worldToLocal(lp.copy(wp));
      c.mesh.position.copy(lp);
      c.mesh.quaternion.copy(wq);
      const pq = new THREE.Quaternion();
      pivot.getWorldQuaternion(pq);
      c.mesh.quaternion.premultiply(pq.invert());
    });

    const target = (dir * Math.PI) / 2;
    const duration = 800;
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const angle = target * e;

      if (axis === "x") pivot.rotation.set(angle, 0, 0);
      else if (axis === "y") pivot.rotation.set(0, angle, 0);
      else pivot.rotation.set(0, 0, angle);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // Return pieces to main group
        piecesInLayer.forEach((c) => {
          const wp = new THREE.Vector3();
          c.mesh.getWorldPosition(wp);
          const wq = new THREE.Quaternion();
          c.mesh.getWorldQuaternion(wq);
          pivot.remove(c.mesh);
          main.add(c.mesh);
          const lp = new THREE.Vector3();
          main.worldToLocal(lp.copy(wp));
          c.mesh.position.copy(lp);
          const mq = new THREE.Quaternion();
          main.getWorldQuaternion(mq);
          c.mesh.quaternion.copy(wq).premultiply(mq.clone().invert());

          c.grid.gx = Math.round(c.mesh.position.x / CELL);
          c.grid.gy = Math.round(c.mesh.position.y / CELL);
          c.grid.gz = Math.round(c.mesh.position.z / CELL);
        });
        pivot.rotation.set(0, 0, 0);
        isRotating.current = false;
      }
    }
    tick();
  }, [scrollRef]);

  // Periodic face rotations
  useEffect(() => {
    const timer = setInterval(doFaceRotation, 4000);
    const initial = setTimeout(doFaceRotation, 2200);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
    };
  }, [doFaceRotation]);

  // Scroll-driven animation
  useFrame(({ clock }, delta) => {
    if (!outerRef.current) return;
    const t = scrollRef ? scrollRef.current : 0;
    const lerp = THREE.MathUtils.lerp;
    const lf = 0.06;

    // --- Position X ---
    let targetX = 0;
    if (t >= 0.2 && t < 0.4) targetX = -3;
    else if (t >= 0.6 && t < 0.8) targetX = 3;
    outerRef.current.position.x = lerp(outerRef.current.position.x, targetX, lf);

    // --- Scale ---
    let targetScale = 1.0;
    if (t >= 0.4 && t < 0.6) targetScale = 1.3;
    const s = lerp(outerRef.current.scale.x, targetScale, lf);
    outerRef.current.scale.set(s, s, s);

    // --- Rotation speed ---
    let tgtSpeed = 0.10;
    if (t >= 0.2 && t < 0.4) tgtSpeed = 0.08;
    else if (t >= 0.4 && t < 0.6) tgtSpeed = 0.02;
    else if (t >= 0.8) tgtSpeed = 0.05;
    currentRotSpeed.current = lerp(currentRotSpeed.current, tgtSpeed, lf);
    rotYAccum.current += delta * currentRotSpeed.current;

    outerRef.current.rotation.y = rotYAccum.current;
    outerRef.current.rotation.x =
      Math.sin(clock.getElapsedTime() * 0.16) * 0.07;
    outerRef.current.rotation.z =
      Math.sin(clock.getElapsedTime() * 0.12) * 0.025;

    // --- Explode ---
    let targetExplode = 0;
    if (t >= 0.8) {
      targetExplode = ((t - 0.8) / 0.2) * 0.5;
    }
    currentExplode.current = lerp(currentExplode.current, targetExplode, lf);
    explosionRef.current = currentExplode.current;

    // Apply piece positions when scrolled past hero
    if (t > 0.2 && !isRotating.current) {
      cubesRef.current.forEach((c) => {
        if (!c?.mesh) return;
        const { gx, gy, gz } = c.grid;
        const dir = new THREE.Vector3(gx, gy, gz);
        if (dir.length() > 0) dir.normalize();
        const target = new THREE.Vector3(
          gx * CELL + dir.x * currentExplode.current,
          gy * CELL + dir.y * currentExplode.current,
          gz * CELL + dir.z * currentExplode.current
        );
        c.mesh.position.lerp(target, lf);
      });
    }
  });

  // Register piece refs
  const registerPiece = useCallback((mesh, gridData) => {
    if (!mesh) return;
    const existing = cubesRef.current.find(
      (c) => c && c.grid === gridData
    );
    if (existing) {
      existing.mesh = mesh;
    } else {
      cubesRef.current.push({ mesh, grid: gridData });
    }
  }, []);

  return (
    <group ref={outerRef}>
      <group ref={mainRef}>
        {grid.map((g, i) => (
          <group
            key={i}
            ref={(el) => registerPiece(el, g)}
            position={[g.gx * CELL, g.gy * CELL, g.gz * CELL]}
          >
            <CubePiece
              position={[0, 0, 0]}
              gx={g.gx}
              gy={g.gy}
              gz={g.gz}
            />
          </group>
        ))}
        {/* <AccentLines explosionRef={explosionRef} /> */}
      </group>
      <group ref={pivotRef} />
    </group>
  );
}

// ============================================================
// SCENE (Canvas internals)
// ============================================================

function Scene({ scrollRef }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.3}
        color="#fff8ee"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.002}
      />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} color="#d4e8d4" />
      <directionalLight position={[0, -4, 8]} intensity={0.25} color="#ffeedd" />

      <RubiksCube scrollRef={scrollRef} />

      <ContactShadows
        position={[0, -2.1, 0]}
        opacity={0.55}
        scale={12}
        blur={1.8}
        far={3}
      />

      <Environment preset="studio" environmentIntensity={0.8} />

      <EffectComposer>
        <Bloom
          intensity={0.18}
          luminanceThreshold={0.88}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <N8AO
          aoRadius={0.25}
          intensity={3.0}
          distanceFalloff={0.3}
        />
        <Vignette offset={0.3} darkness={0.45} />
      </EffectComposer>
    </>
  );
}

// ============================================================
// OVERLAY UI
// ============================================================

const monoFont = "'SF Mono', 'Fira Code', 'Cascadia Code', monospace";
const sansFont = "'SF Pro Display', -apple-system, 'Helvetica Neue', sans-serif";

function Overlay({ scrollProgress }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2,
        pointerEvents: "none",
        opacity: scrollProgress !== undefined ? Math.max(0, 1 - scrollProgress * 6) : 1,
        transition: "opacity 0.1s ease",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "clamp(24px, 4vw, 50px)",
      }}
    >
      {/* NAV */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34, height: 34,
              border: "1.5px solid rgba(230,230,220,0.4)",
              borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(4px)",
              background: "rgba(230,230,220,0.08)",
            }}
          >
            <span style={{ color: "#e6e6dc", fontSize: 14, fontWeight: 700, fontFamily: monoFont }}>K</span>
          </div>
          <span
            style={{
              color: "#e6e6dc",
              fontSize: "clamp(12px, 1.5vw, 15px)",
              fontWeight: 500,
              fontFamily: monoFont,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Kinetiba
          </span>
        </div>
        <div
          style={{
            border: "1px solid rgba(230,230,220,0.3)",
            borderRadius: 4,
            padding: "8px 20px",
            pointerEvents: "auto",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            background: "rgba(230,230,220,0.05)",
          }}
        >
          <span
            style={{
              color: "#e6e6dc",
              fontSize: "clamp(9px, 1.1vw, 12px)",
              fontFamily: monoFont,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Contacto &rsaquo;
          </span>
        </div>
      </div>

      {/* MID */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            color: "#d4d4c8",
            fontSize: "clamp(9px, 1vw, 12px)",
            fontFamily: monoFont,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          CDMX — México
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginLeft: "calc(-1 * clamp(24px, 4vw, 50px))", marginRight: "calc(-1 * clamp(24px, 4vw, 50px))" }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, rgba(230,230,220,0.18) 0%, rgba(230,230,220,0.18) 25%, rgba(230,230,220,0) 45%, rgba(230,230,220,0) 55%, rgba(230,230,220,0.18) 75%, rgba(230,230,220,0.18) 100%)" }} />
          <div
            style={{
              color: "#c4c4b8",
              fontSize: "clamp(9px, 1vw, 12px)",
              fontFamily: monoFont,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              paddingLeft: 20,
              paddingRight: "clamp(24px, 4vw, 50px)",
              whiteSpace: "nowrap",
            }}
          >
            Scroll to discover ⌄
          </div>
        </div>
        <div
          style={{
            color: "#bbbcab",
            fontSize: "clamp(9px, 1vw, 11px)",
            fontFamily: monoFont,
            letterSpacing: "0.08em",
            marginTop: 10,
          }}
        >
          ↕ 19.4326 ··· -99.1332
        </div>
      </div>

      {/* BOTTOM */}
      <div>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {["⊞⊞⊞", "▦▦▦", "⫾⫿⫾"].map((icon, i) => (
            <div
              key={i}
              style={{
                border: "1px solid rgba(230,230,220,0.18)",
                borderRadius: 4,
                padding: "5px 10px",
                color: "#d4d4c8",
                fontSize: 10,
                fontFamily: monoFont,
              }}
            >
              {icon}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          <h1
            style={{
              color: "#eeeee4",
              fontSize: "clamp(28px, 5vw, 64px)",
              fontWeight: 800,
              lineHeight: 0.95,
              margin: 0,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              fontFamily: sansFont,
              maxWidth: "60%",
            }}
          >
            Tus datos.
            <br />
            Tu ventaja.
          </h1>
          <p
            style={{
              color: "#c8c8bc",
              fontSize: "clamp(9px, 1vw, 12px)",
              fontFamily: monoFont,
              lineHeight: 1.7,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              maxWidth: 380,
              margin: 0,
            }}
          >
            * Business Intelligence y ERP diseñados
            <br />
            para la PyME mexicana. A través de datos
            <br />
            en tiempo real, empoderamos negocios para
            <br />
            optimizar operaciones y crecer con impacto.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SCROLL SECTIONS
// ============================================================

function ScrollSections({ scrollProgress }) {
  const sectionStyle = {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    position: "relative",
  };

  return (
    <div
      style={{
        position: "relative",
        zIndex: 3,
        pointerEvents: "none",
      }}
    >
      {/* Section 1: Hero spacer */}
      <div style={{ height: "100vh" }} />

      {/* Section 2: Kinetiba BI (0.2–0.4) */}
      <div
        style={{
          ...sectionStyle,
          justifyContent: "flex-end",
          padding: "0 clamp(48px, 8vw, 120px)",
          opacity: sectionOpacity(scrollProgress, 0.2, 0.4),
        }}
      >
        <div style={{ maxWidth: 500 }}>
          <h2
            style={{
              color: "#eeeee4",
              fontSize: "clamp(28px, 4vw, 52px)",
              fontWeight: 800,
              fontFamily: sansFont,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              margin: "0 0 8px 0",
            }}
          >
            Kinetiba BI
          </h2>
          <p
            style={{
              color: "#c8c8bc",
              fontSize: "clamp(11px, 1.2vw, 14px)",
              fontFamily: monoFont,
              letterSpacing: "0.06em",
              margin: "0 0 24px 0",
            }}
          >
            Business Intelligence en tiempo real
          </p>
          {[
            "996K transacciones procesadas",
            "10 dashboards configurables",
            "Alertas por WhatsApp",
            "Desde $299 MXN/mes",
          ].map((item, i) => (
            <div
              key={i}
              style={{
                color: "#d4d4c8",
                fontSize: "clamp(10px, 1.1vw, 13px)",
                fontFamily: monoFont,
                letterSpacing: "0.04em",
                padding: "8px 0",
                borderBottom: "1px solid rgba(230,230,220,0.1)",
              }}
            >
              → {item}
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Close-up (0.4–0.6) */}
      <div
        style={{
          ...sectionStyle,
          justifyContent: "center",
          flexDirection: "column",
          textAlign: "center",
          opacity: sectionOpacity(scrollProgress, 0.4, 0.6),
        }}
      >
        <p
          style={{
            color: "#eeeee4",
            fontSize: "clamp(18px, 3vw, 40px)",
            fontWeight: 300,
            fontFamily: sansFont,
            fontStyle: "italic",
            letterSpacing: "-0.01em",
            margin: 0,
            maxWidth: 600,
            lineHeight: 1.3,
          }}
        >
          Cada cara, un KPI.
          <br />
          Cada dato, una decisión.
        </p>
      </div>

      {/* Section 4: Kineti-ERP (0.6–0.8) */}
      <div
        style={{
          ...sectionStyle,
          justifyContent: "flex-start",
          padding: "0 clamp(48px, 8vw, 120px)",
          opacity: sectionOpacity(scrollProgress, 0.6, 0.8),
        }}
      >
        <div style={{ maxWidth: 500 }}>
          <h2
            style={{
              color: "#eeeee4",
              fontSize: "clamp(28px, 4vw, 52px)",
              fontWeight: 800,
              fontFamily: sansFont,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              margin: "0 0 8px 0",
            }}
          >
            Kineti-ERP
          </h2>
          <p
            style={{
              color: "#c8c8bc",
              fontSize: "clamp(11px, 1.2vw, 14px)",
              fontFamily: monoFont,
              letterSpacing: "0.06em",
              margin: "0 0 24px 0",
            }}
          >
            Facturación CFDI 4.0 integrada
          </p>
          {[
            "Multi-PAC (Solución Factible, SW Sapien)",
            "Compatible con AdminPAQ",
            "100% validado vs SAT",
            "Sellado local con CSD",
          ].map((item, i) => (
            <div
              key={i}
              style={{
                color: "#d4d4c8",
                fontSize: "clamp(10px, 1.1vw, 13px)",
                fontFamily: monoFont,
                letterSpacing: "0.04em",
                padding: "8px 0",
                borderBottom: "1px solid rgba(230,230,220,0.1)",
              }}
            >
              → {item}
            </div>
          ))}
        </div>
      </div>

      {/* Section 5: CTA Final (0.8–1.0) */}
      <div
        style={{
          ...sectionStyle,
          justifyContent: "center",
          flexDirection: "column",
          textAlign: "center",
          gap: 28,
          opacity: sectionOpacity(scrollProgress, 0.8, 1.0),
        }}
      >
        <h2
          style={{
            color: "#eeeee4",
            fontSize: "clamp(24px, 4vw, 52px)",
            fontWeight: 800,
            fontFamily: sansFont,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          ¿Listo para decidir
          <br />
          con datos?
        </h2>
        <button
          style={{
            pointerEvents: "auto",
            background: "rgba(230,230,220,0.12)",
            border: "1.5px solid rgba(230,230,220,0.35)",
            borderRadius: 6,
            padding: "14px 40px",
            color: "#eeeee4",
            fontSize: "clamp(10px, 1.1vw, 13px)",
            fontFamily: monoFont,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
            transition: "background 0.2s, border-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.background = "rgba(230,230,220,0.22)";
            e.target.style.borderColor = "rgba(230,230,220,0.55)";
          }}
          onMouseLeave={(e) => {
            e.target.style.background = "rgba(230,230,220,0.12)";
            e.target.style.borderColor = "rgba(230,230,220,0.35)";
          }}
        >
          Solicita tu demo &rsaquo;
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN EXPORT
// ============================================================

export default function KinetibaHero() {
  const { progress, progressRef } = useScrollProgress();

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Fixed background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background:
            "radial-gradient(ellipse at 50% 35%, #8a9684 0%, #7d8977 20%, #717e6e 42%, #667364 62%, #5c6a5b 80%, #535f52 100%)",
        }}
      />

      {/* Fixed 3D Canvas */}
      <Canvas
        camera={{ position: [5.8, 4.0, 5.8], fov: 36, near: 0.1, far: 100 }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ position: "fixed", inset: 0, zIndex: 1 }}
      >
        <Scene scrollRef={progressRef} />
      </Canvas>

      {/* Fixed hero overlay — fades on scroll */}
      <Overlay scrollProgress={progress} />

      {/* Scrollable content sections */}
      <ScrollSections scrollProgress={progress} />
    </div>
  );
}
