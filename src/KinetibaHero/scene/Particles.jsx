import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function Particles({ scrollRef, count = 200, reducedMotion }) {
  const meshRef = useRef();
  const velocities = useMemo(() => {
    const v = [];
    for (let i = 0; i < count; i++) v.push(0.02 + Math.random() * 0.04);
    return v;
  }, [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);

  useFrame((state, delta) => {
    if (!meshRef.current || reducedMotion) return;
    const progress = scrollRef?.current ?? 0;
    const positions = meshRef.current.geometry.attributes.position.array;
    const parallaxY = progress * 2;

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] += velocities[i] * delta * 60;
      if (positions[i * 3 + 1] > 8) positions[i * 3 + 1] = -8;
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;
    meshRef.current.position.y = -parallaxY * 0.3;
  });

  return (
    <points ref={meshRef} geometry={geometry}>
      <pointsMaterial
        size={0.04}
        color="#e6e6dc"
        transparent
        opacity={0.08}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
