import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CELL, PIECE_SIZE, GAP, LAYER_COLORS } from "../utils/constants";

export default function AccentLines({ explosionRef }) {
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
