import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Environment,
  ContactShadows,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  N8AO,
  SMAA,
} from "@react-three/postprocessing";
import RubiksCube from "./RubiksCube";
import { getCameraOrbit } from "../utils/scrollHelpers";

export default function Scene({ scrollRef, isVisible, reducedMotion, isMobile }) {
  const cameraTargetRef = useRef({ x: 6.5, y: 4.5, z: 6.5 });
  const aoRadius = isMobile ? 0.15 : 0.25;
  const aoIntensity = isMobile ? 1.5 : 2.0;

  // Camera orbit based on scroll
  useFrame(({ camera }) => {
    if (reducedMotion) return;
    const progress = scrollRef?.current ?? 0;
    const { theta, phi, radius } = getCameraOrbit(progress);
    const targetX = radius * Math.sin(phi) * Math.cos(theta);
    const targetY = radius * Math.cos(phi);
    const targetZ = radius * Math.sin(phi) * Math.sin(theta);
    camera.position.x += (targetX - camera.position.x) * 0.03;
    camera.position.y += (targetY - camera.position.y) * 0.03;
    camera.position.z += (targetZ - camera.position.z) * 0.03;
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      {/* Studio lighting setup - product photography style */}
      <ambientLight intensity={0.15} color="#e8e4dc" />
      
      {/* Key light - main illumination from top-right */}
      <directionalLight
        position={[5, 8, 4]}
        intensity={1.8}
        color="#fff8ee"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.001}
        shadow-radius={4}
      />
      
      {/* Fill light - soft from left */}
      <directionalLight position={[-6, 3, -2]} intensity={0.5} color="#d8e4d8" />
      
      {/* Rim light - edge separation from back */}
      <directionalLight position={[0, 3, -8]} intensity={0.8} color="#e8e0d8" />
      
      {/* Bottom fill - subtle warm bounce */}
      <directionalLight position={[2, -5, 3]} intensity={0.3} color="#f0e8d8" />

      <RubiksCube
        scrollRef={scrollRef}
        isVisible={isVisible}
        reducedMotion={reducedMotion}
        isMobile={isMobile}
      />

      <ContactShadows
        position={[0, -2.1, 0]}
        opacity={0.4}
        scale={12}
        blur={2.5}
        far={3}
        color="#2a2a28"
      />

      <Environment files="/hdri/studio_small_09_1k.hdr" environmentIntensity={0.75} />

      {reducedMotion ? (
        <EffectComposer multisampling={0}>
          <Vignette offset={0.35} darkness={0.5} />
        </EffectComposer>
      ) : (
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.1}
            luminanceThreshold={1.0}
            luminanceSmoothing={0.92}
            mipmapBlur
          />
          <N8AO
            aoRadius={aoRadius}
            intensity={aoIntensity}
            distanceFalloff={0.35}
          />
          <Vignette offset={0.35} darkness={0.5} />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}
