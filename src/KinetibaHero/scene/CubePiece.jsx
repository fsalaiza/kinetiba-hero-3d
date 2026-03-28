import React, { useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  DECAL_SIZE, FACE_DEFS,
  SPECULAR_COLOR, SHEEN_COLOR, NORMAL_SCALE,
} from "../utils/constants";
import { createFaceTexture, generateRoughnessMap } from "../utils/generateTextures";
import { generateCeramicNormalMap } from "../utils/generateNormalMap";

export default function CubePiece({ position, gx, gy, gz, isMobile }) {
  const { nodes } = useGLTF('/models/cube_piece.glb');
  const groupRef = useRef();
  const meshRef = useRef();
  const matRef = useRef();

  // 6.3 — Hover glow state
  const [hovered, setHovered] = useState(false);

  // 6.4 — Click-to-rotate state
  const spinning = useRef(false);
  const spinAngle = useRef(0);
  const SPIN_DURATION = 0.6;

  const geometry = useMemo(() => {
    const meshNode = Object.values(nodes).find(n => n.isMesh);
    if (!meshNode) {
      console.warn('No mesh found in cube_piece.glb');
      return null;
    }
    return meshNode.geometry.clone();
  }, [nodes]);

  const roughnessMap = useMemo(() => generateRoughnessMap(), []);

  const ceramicNormalMap = useMemo(() => {
    const seed = (gx + 1) * 9 + (gy + 1) * 3 + (gz + 1);
    return generateCeramicNormalMap(512, seed);
  }, [gx, gy, gz]);

  const texSize = isMobile ? 256 : 512;

  const decals = useMemo(() => {
    return FACE_DEFS
      .filter(({ check }) => check(gx, gy, gz))
      .map(({ axis, idx, pos, rot }) => ({
        axis, pos, rot,
        texture: createFaceTexture(gx, gy, gz, idx, texSize),
      }));
  }, [gx, gy, gz, texSize]);

  // 6.3 + 6.4 — useFrame for hover glow lerp and click rotation
  useFrame((_, delta) => {
    // Hover glow: lerp emissiveIntensity
    if (matRef.current) {
      const target = hovered ? 0.08 : 0;
      matRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        matRef.current.emissiveIntensity,
        target,
        0.1
      );
    }

    // Click-to-rotate
    if (spinning.current && groupRef.current) {
      spinAngle.current += (Math.PI * 2 / SPIN_DURATION) * delta;
      if (spinAngle.current >= Math.PI * 2) {
        groupRef.current.rotation.z = 0;
        spinning.current = false;
        spinAngle.current = 0;
      } else {
        const t = spinAngle.current / (Math.PI * 2);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        groupRef.current.rotation.z = ease * Math.PI * 2;
      }
    }
  });

  if (!geometry) return null;

  return (
    <group ref={groupRef} position={position}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        castShadow
        receiveShadow
        onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        onClick={(e) => { e.stopPropagation(); spinning.current = true; spinAngle.current = 0; }}
      >
        <meshPhysicalMaterial
          ref={matRef}
          color="#D4CFC4"
          emissive="#D4CFC4"
          emissiveIntensity={0}
          roughness={0.72}
          roughnessMap={roughnessMap}
          normalMap={ceramicNormalMap}
          normalScale={NORMAL_SCALE}
          metalness={0.0}
          clearcoat={0.1}
          clearcoatRoughness={0.4}
          ior={1.45}
          specularIntensity={0.4}
          specularColor={SPECULAR_COLOR}
          sheen={0.05}
          sheenColor={SHEEN_COLOR}
          sheenRoughness={0.8}
          envMapIntensity={0.55}
        />
      </mesh>
      {decals.map(({ axis, pos, rot, texture }) => (
        <mesh key={axis} position={pos} rotation={rot}>
          <planeGeometry args={[DECAL_SIZE, DECAL_SIZE]} />
          <meshPhysicalMaterial
            map={texture}
            roughness={0.85}
            metalness={0.0}
            clearcoat={0}
            ior={1.45}
            specularIntensity={0.05}
            specularColor={SPECULAR_COLOR}
            envMapIntensity={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}
