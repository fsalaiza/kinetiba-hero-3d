import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import {
  DECAL_SIZE, FACE_DEFS,
  SPECULAR_COLOR, SHEEN_COLOR, NORMAL_SCALE,
} from "../utils/constants";
import { createFaceTexture, generateRoughnessMap } from "../utils/generateTextures";
import { generateCeramicNormalMap } from "../utils/generateNormalMap";

export default function CubePiece({ position, gx, gy, gz, isMobile }) {
  const { nodes } = useGLTF('/models/cube_piece.glb');

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

  if (!geometry) return null;

  return (
    <group position={position}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#D4CFC4"
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
