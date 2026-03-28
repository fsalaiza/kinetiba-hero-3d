import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import Scene from "./scene/Scene";
import Overlay from "./overlay/Overlay";
import ScrollSections from "./sections/ScrollSections";
import FrameStepHUD from "./ui/FrameStepHUD";
import { useScrollProgress } from "./utils/scrollHelpers";

export default function KinetibaHero() {
  const { progress, progressRef } = useScrollProgress();
  const [frameStepPx, setFrameStepPx] = useState(8);

  useEffect(() => {
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const onKeyDown = (e) => {
      if (e.key === "]" || e.key === "[") {
        e.preventDefault();
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight;
        if (maxScroll <= 0) return;
        const dir = e.key === "]" ? 1 : -1;
        const nextY = clamp(window.scrollY + dir * frameStepPx, 0, maxScroll);
        window.scrollTo({ top: nextY, behavior: "auto" });
        return;
      }

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setFrameStepPx((prev) => Math.min(64, prev + 1));
        return;
      }

      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setFrameStepPx((prev) => Math.max(1, prev - 1));
        return;
      }

      if (e.key === "0") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [frameStepPx]);

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
        camera={{ position: [6.5, 4.5, 6.5], fov: 36, near: 0.1, far: 100 }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.90,
        }}
        style={{ position: "fixed", inset: 0, zIndex: 1 }}
      >
        <Scene scrollRef={progressRef} />
      </Canvas>

      {/* Fixed hero overlay */}
      <Overlay scrollProgress={progress} />

      {/* Frame stepping HUD */}
      <FrameStepHUD progress={progress} frameStepPx={frameStepPx} />

      {/* Scrollable content sections */}
      <ScrollSections scrollProgress={progress} />
    </div>
  );
}
