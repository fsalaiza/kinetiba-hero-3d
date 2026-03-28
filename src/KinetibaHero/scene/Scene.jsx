import React from "react";
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

export default function Scene({ scrollRef, isVisible, reducedMotion, isMobile }) {
  const aoRadius = isMobile ? 0.15 : 0.25;
  const aoIntensity = isMobile ? 1.5 : 2.0;

  return (
    <>
      <ambientLight intensity={0.45} color="#fff5e6" />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.0}
        color="#fff8ee"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.002}
      />
      <directionalLight position={[-6, 4, -4]} intensity={0.25} color="#d4e8d4" />
      <directionalLight position={[0, -4, 8]} intensity={0.25} color="#ffeedd" />
      {/* D2C rim light — subtle backlight for edge separation */}
      <directionalLight position={[0, 2, -8]} intensity={0.2} color="#e8e0d8" />

      <RubiksCube
        scrollRef={scrollRef}
        isVisible={isVisible}
        reducedMotion={reducedMotion}
        isMobile={isMobile}
      />

      <ContactShadows
        position={[0, -2.1, 0]}
        opacity={0.65}
        scale={12}
        blur={1.5}
        far={3}
      />

      <Environment files="/hdri/studio_small_09_1k.hdr" environmentIntensity={0.55} />

      {reducedMotion ? (
        <EffectComposer>
          <Vignette offset={0.3} darkness={0.45} />
        </EffectComposer>
      ) : (
        <EffectComposer>
          <Bloom
            intensity={0.18}
            luminanceThreshold={0.82}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <N8AO
            aoRadius={aoRadius}
            intensity={aoIntensity}
            distanceFalloff={0.3}
          />
          <Vignette offset={0.3} darkness={0.45} />
          <SMAA />
        </EffectComposer>
      )}
    </>
  );
}
