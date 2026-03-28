import React, { useState, useEffect, useRef, Suspense } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import HeroContext from "./HeroContext";
import { useHeroContext } from "./HeroContext";
import Scene from "./scene/Scene";
import Overlay from "./overlay/Overlay";
import ScrollSections from "./sections/ScrollSections";
import FrameStepHUD from "./ui/FrameStepHUD";
import HeroFallback from "./ui/HeroFallback";
import { useScrollProgress } from "./utils/scrollHelpers";
import useReducedMotion from "./utils/useReducedMotion";
import useVisibility from "./utils/useVisibility";

const isMobile = typeof navigator !== "undefined"
  ? /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  : false;

const canvasDpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

// --- Compound sub-components ---

function Root({ children, reducedMotion: reducedMotionProp }) {
  const { progress, progressRef } = useScrollProgress();
  const [frameStepPx, setFrameStepPx] = useState(8);
  const reducedMotion = useReducedMotion(reducedMotionProp);

  useEffect(() => {
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const onKeyDown = (e) => {
      if (e.key === "]" || e.key === "[") {
        e.preventDefault();
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (maxScroll <= 0) return;
        const dir = e.key === "]" ? 1 : -1;
        window.scrollTo({ top: clamp(window.scrollY + dir * frameStepPx, 0, maxScroll), behavior: "auto" });
        return;
      }
      if (e.key === "=" || e.key === "+") { e.preventDefault(); setFrameStepPx((p) => Math.min(64, p + 1)); return; }
      if (e.key === "-" || e.key === "_") { e.preventDefault(); setFrameStepPx((p) => Math.max(1, p - 1)); return; }
      if (e.key === "0") { e.preventDefault(); window.scrollTo({ top: 0, behavior: "auto" }); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [frameStepPx]);

  return (
    <HeroContext.Provider value={{ progress, progressRef, frameStepPx, reducedMotion, isMobile }}>
      <div style={{ minHeight: "100vh" }}>
        {/* Fixed background */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 0,
          background: "radial-gradient(ellipse at 50% 35%, #8a9684 0%, #7d8977 20%, #717e6e 42%, #667364 62%, #5c6a5b 80%, #535f52 100%)",
        }} />
        {children}
      </div>
    </HeroContext.Provider>
  );
}

function HeroCanvas() {
  const { progressRef, reducedMotion, isMobile: mobile } = useHeroContext();
  const canvasContainerRef = useRef(null);
  const isVisible = useVisibility(canvasContainerRef);

  return (
    <div ref={canvasContainerRef} style={{ position: "fixed", inset: 0, zIndex: 1 }}>
      <Suspense fallback={<HeroFallback />}>
        <Canvas
          camera={{ position: [6.5, 4.5, 6.5], fov: 36, near: 0.1, far: 100 }}
          shadows
          dpr={canvasDpr}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.90 }}
          style={{ width: "100%", height: "100%" }}
        >
          <Scene
            scrollRef={progressRef}
            isVisible={isVisible}
            reducedMotion={reducedMotion}
            isMobile={mobile}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}

function HeroOverlay() {
  const { progress, reducedMotion } = useHeroContext();
  return <Overlay scrollProgress={progress} reducedMotion={reducedMotion} />;
}

function HeroSections() {
  const { progress, frameStepPx } = useHeroContext();
  return (
    <>
      <FrameStepHUD progress={progress} frameStepPx={frameStepPx} />
      <ScrollSections scrollProgress={progress} />
    </>
  );
}

// --- Default all-in-one component (backward compat) ---

export default function KinetibaHero({ reducedMotion } = {}) {
  return (
    <Root reducedMotion={reducedMotion}>
      <HeroCanvas />
      <HeroOverlay />
      <HeroSections />
    </Root>
  );
}

// Attach compound sub-components
KinetibaHero.Root = Root;
KinetibaHero.Canvas = HeroCanvas;
KinetibaHero.Overlay = HeroOverlay;
KinetibaHero.Sections = HeroSections;
