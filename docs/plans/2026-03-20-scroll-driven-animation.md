# Scroll-Driven Animation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add scroll-driven animation to KinetibaHero with 5 sections: hero, Kinetiba BI, close-up, Kineti-ERP, and CTA with explode effect.

**Architecture:** Fixed-position Canvas + Overlay over a 600vh scrollable div. A `useScrollProgress` hook provides both React state (for HTML opacity) and a ref (for R3F useFrame). Cube position, scale, rotation speed, and explode are driven by scroll progress mapped to 0.0–1.0 in 0.2 increments. All existing 3D (materials, textures, post-processing) remain untouched.

**Tech Stack:** React 19, Three.js, R3F, Drei, existing CRA setup. gsap installed per user request.

**Critical Rule:** NO rewriting from scratch. Edit the existing `src/KinetibaHero.jsx` only.

**Math note:** 6 × 100vh sections = 600vh total. maxScroll = 600vh − 100vh = 500vh. progress 0.2 = 100vh scroll — clean section boundaries. The spec said 500vh/5 sections, but 600vh is needed for the 0.2-increment math to align with 100vh sections.

---

### Task 1: Install gsap

**Step 1: Install dependency**

Run: `cd /Users/alfredosalaiza/kinetiba-hero-3d && npm install gsap`

---

### Task 2: Add `useState` to imports + `useScrollProgress` hook + `sectionOpacity` helper

**Files:**
- Modify: `src/KinetibaHero.jsx:12` (imports)
- Modify: `src/KinetibaHero.jsx:35` (after CONFIG, before texture generators)

**Step 1: Add `useState` to React imports**

Change line 12 from:
```js
import React, { useRef, useMemo, useEffect, useCallback } from "react";
```
to:
```js
import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
```

**Step 2: Add `useScrollProgress` hook and `sectionOpacity` helper after CONFIG block (after line 36)**

Insert after the `LAYER_COLORS` line and before the texture generators comment:

```js
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
```

**Verification:** Run dev server, check console for no errors. Page should look identical (hook not wired yet).

---

### Task 3: Modify `AccentLines` to accept `explosionRef` and fade during explode

**Files:**
- Modify: `src/KinetibaHero.jsx:412-442` (AccentLines component)

**Step 1: Update AccentLines signature and add useFrame fade**

Change the function signature from `function AccentLines()` to `function AccentLines({ explosionRef })`.

Add a `groupRef` and a `useFrame` hook inside AccentLines that reads `explosionRef.current` and lerps each child mesh's material opacity toward 0 as explosion increases.

Wrap the returned `<>{lines}</>` in `<group ref={groupRef}>{lines}</group>`.

Full replacement of AccentLines:

```js
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
```

**Verification:** No visible change yet (explosionRef not passed). Accent lines should still render at opacity 0.4.

---

### Task 4: Modify `RubiksCube` for scroll-driven behavior

**Files:**
- Modify: `src/KinetibaHero.jsx:448-611` (RubiksCube component)

This is the core change. Modifications:

**Step 1: Accept `scrollRef` prop and add new refs**

Change `function RubiksCube()` → `function RubiksCube({ scrollRef })`

Add after `const isRotating = useRef(false);`:
```js
const currentExplode = useRef(0);
const currentRotSpeed = useRef(0.10);
const rotYAccum = useRef(0);
const explosionRef = useRef(0);
```

**Step 2: Add scroll guard to `doFaceRotation`**

Change line 466-467 from:
```js
  const doFaceRotation = useCallback(() => {
    if (isRotating.current || !mainRef.current || !pivotRef.current) return;
```
to:
```js
  const doFaceRotation = useCallback(() => {
    if (scrollRef && scrollRef.current > 0.2) return;
    if (isRotating.current || !mainRef.current || !pivotRef.current) return;
```

Also update the dependency array from `}, []);` to `}, [scrollRef]);`.

**Step 3: Replace the existing `useFrame` (lines 568-574) with scroll-driven version**

Remove the entire existing useFrame block and replace with:

```js
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
```

**Step 4: Pass `explosionRef` to AccentLines in the JSX return**

Change `<AccentLines />` to `<AccentLines explosionRef={explosionRef} />`.

**Verification:** No visible change yet (scrollRef not passed from Scene). Cube should still rotate normally. Console should have no errors.

---

### Task 5: Modify `Scene` to accept and pass `scrollRef`

**Files:**
- Modify: `src/KinetibaHero.jsx:617-660` (Scene component)

**Step 1: Update Scene signature and pass scrollRef to RubiksCube**

Change `function Scene()` → `function Scene({ scrollRef })`

Change `<RubiksCube />` → `<RubiksCube scrollRef={scrollRef} />`

**Verification:** No visible change yet (scrollRef not passed from KinetibaHero).

---

### Task 6: Modify `Overlay` for scroll-controlled opacity

**Files:**
- Modify: `src/KinetibaHero.jsx:669-849` (Overlay component)

**Step 1: Accept `scrollProgress` prop and apply opacity + position:fixed**

Change `function Overlay()` → `function Overlay({ scrollProgress })`

In the root div style, change:
- `position: "absolute"` → `position: "fixed"`
- Add: `opacity: scrollProgress !== undefined ? Math.max(0, 1 - scrollProgress * 6) : 1`
- Add: `transition: "opacity 0.1s ease"`

The opacity formula `1 - scrollProgress * 6` means:
- At progress 0: opacity 1
- At progress 0.17: opacity ~0
- Fully gone before section 2 starts

**Verification:** No visible change yet (scrollProgress not passed from KinetibaHero). Overlay should remain visible.

---

### Task 7: Add `ScrollSections` component

**Files:**
- Modify: `src/KinetibaHero.jsx` — insert new component after Overlay, before MAIN EXPORT section

**Step 1: Add ScrollSections component**

Insert before the `// MAIN EXPORT` comment:

```js
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
```

**Verification:** Not visible yet (not rendered in KinetibaHero).

---

### Task 8: Restructure `KinetibaHero` export — wire everything together

**Files:**
- Modify: `src/KinetibaHero.jsx:855-883` (KinetibaHero export)

**Step 1: Rewrite KinetibaHero to use scroll hook and new layout structure**

Replace the entire `export default function KinetibaHero()` block with:

```js
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
            "radial-gradient(ellipse at 50% 40%, #939e8d 0%, #8a9484 18%, #818b7c 38%, #778070 58%, #6e7868 78%, #666f60 100%)",
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
```

Key changes from original:
- Root div: removed `width: 100%`, `height: 100vh`, `position: relative`, `overflow: hidden` → just `minHeight: 100vh`
- Background gradient moved to its own fixed div (zIndex: 0)
- Canvas: `position: absolute` → `position: fixed` (zIndex: 1)
- Overlay receives `scrollProgress` prop
- Scene receives `progressRef` (the ref, not the state)
- ScrollSections added at the end (relative positioned, creates the 600vh scrollable area)

**Verification:** Open browser at localhost:3002. Expected behavior:
1. Hero section: cube centered, rotating, face rotations every 4s, overlay visible
2. Scroll down 1 viewport: cube slides left, "Kinetiba BI" text appears right, overlay fades
3. Scroll 2 viewports: cube centers, scale increases to 1.3, tagline appears
4. Scroll 3 viewports: cube slides right, "Kineti-ERP" text appears left
5. Scroll 4 viewports: cube centers, pieces explode outward, accent lines fade, CTA appears

---

### Task 9: Commit

**Step 1: Commit all changes**

```bash
git add src/KinetibaHero.jsx package.json package-lock.json
git commit -m "feat: add scroll-driven animation with 5 sections and explode effect

- Fixed Canvas + Overlay layout with 600vh scrollable content
- useScrollProgress hook with ref for R3F useFrame and state for HTML
- Cube position, scale, rotation speed driven by scroll progress
- Face rotations disabled when scrolled past hero section
- Explode effect at 0.8-1.0: pieces move outward, accent lines fade
- 5 scroll sections: Hero, Kinetiba BI, Close-up, Kineti-ERP, CTA
- Section text appears/disappears with opacity transitions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Architecture Notes

### Data Flow
```
useScrollProgress() → { progress (state), progressRef (ref) }
                        │                    │
                        ├─ Overlay (opacity)  ├─ Canvas → Scene → RubiksCube (useFrame)
                        │                    │                     ├─ position.x
                        └─ ScrollSections    │                     ├─ scale
                           (section opacity) │                     ├─ rotation speed
                                             │                     ├─ explode → pieces
                                             │                     └─ explosionRef → AccentLines
                                             └─────────────────────────────────────┘
```

### Why ref + state?
- **State** (`progress`): Drives React re-renders for HTML elements (Overlay opacity, ScrollSections opacity). ~60 re-renders/sec is fine for simple style changes.
- **Ref** (`progressRef`): Read inside `useFrame` at 60fps without causing React re-renders. Essential for smooth 3D interpolation.

### Why 600vh not 500vh?
- 5 scroll segments of 0.2 progress each
- maxScroll = totalHeight − viewportHeight
- For 0.2 progress = exactly 100vh scroll: 500vh = totalHeight − 100vh → totalHeight = 600vh
- 6 sections × 100vh (first is hero spacer, remaining 5 have content)

### Explode math
- Each piece at grid position (gx, gy, gz) where values are -1, 0, or 1
- Direction = normalize(gx, gy, gz) — center piece (0,0,0) stays put
- Target position = gridBase + direction × explosionFactor
- explosionFactor lerps from 0 to 0.5 during scroll 0.8→1.0

### Rotation accumulator
- Original: `rotation.y = elapsed * 0.10` (constant speed, time-based)
- New: `rotYAccum += delta * currentRotSpeed` (accumulator, speed can change smoothly)
- Avoids rotation jumps when speed transitions between scroll sections
