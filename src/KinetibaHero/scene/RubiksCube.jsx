import React, { useRef, useMemo, useCallback } from "react";
import { useGLTF } from "@react-three/drei";
import { CELL } from "../utils/constants";
import CubePiece from "./CubePiece";
import useScrollAnimation from "./useScrollAnimation";
import useFaceRotation from "./useFaceRotation";

export default function RubiksCube({ scrollRef }) {
  const outerRef = useRef();
  const mainRef = useRef();
  const pivotRef = useRef();
  const cubesRef = useRef([]);

  const isRotating = useFaceRotation(scrollRef, mainRef, pivotRef, cubesRef);
  useScrollAnimation(outerRef, cubesRef, isRotating);

  const grid = useMemo(() => {
    const arr = [];
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++)
          arr.push({ gx: x, gy: y, gz: z });
    return arr;
  }, []);

  const registerPiece = useCallback((mesh, gridData) => {
    if (!mesh) return;
    const existing = cubesRef.current.find((c) => c && c.grid === gridData);
    if (existing) {
      existing.mesh = mesh;
    } else {
      cubesRef.current.push({ mesh, grid: gridData });
    }
  }, []);

  return (
    <group ref={outerRef} scale={0.85}>
      <group ref={mainRef}>
        {grid.map((g, i) => (
          <group
            key={i}
            ref={(el) => registerPiece(el, g)}
            position={[g.gx * CELL, g.gy * CELL, g.gz * CELL]}
          >
            <CubePiece position={[0, 0, 0]} gx={g.gx} gy={g.gy} gz={g.gz} />
          </group>
        ))}
      </group>
      <group ref={pivotRef} />
    </group>
  );
}

useGLTF.preload('/models/cube_piece.glb');
