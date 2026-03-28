import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CELL } from "../utils/constants";
import { setupScrollTriggers } from "./scrollTriggers";

export default function useScrollAnimation(outerRef, cubesRef, isRotating) {
  const rotYAccum = useRef(0);
  const explosionRef = useRef(0);

  const scrollState = useRef({
    targetX: 0, targetScale: 1.0, targetRotSpeed: 0.10,
    targetExplode: 0, targetFlatten: 0,
    cubeX: 0, cubeScale: 1.0, rotSpeed: 0.10,
    explode: 0, flatten: 0,
  });

  useEffect(() => {
    const ctx = setupScrollTriggers(scrollState.current);
    return () => ctx?.revert();
  }, []);

  useFrame(({ clock }, delta) => {
    if (!outerRef.current) return;
    const st = scrollState.current;
    const lf = 0.02;

    st.cubeX += (st.targetX - st.cubeX) * lf;
    st.cubeScale += (st.targetScale - st.cubeScale) * lf;
    st.rotSpeed += (st.targetRotSpeed - st.rotSpeed) * lf;
    st.explode += (st.targetExplode - st.explode) * lf;
    st.flatten += (st.targetFlatten - st.flatten) * lf;

    outerRef.current.position.x = st.cubeX;
    const s = st.cubeScale;
    outerRef.current.scale.set(s, s, s);

    const orbitalInfluence = Math.max(0.15, 1 - st.flatten * 1.5);
    rotYAccum.current += delta * st.rotSpeed * orbitalInfluence;
    outerRef.current.rotation.y = rotYAccum.current;
    outerRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.16) * 0.07;
    outerRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.12) * 0.025;

    explosionRef.current = st.explode;
    if (!isRotating.current) {
      const effectiveExplode = st.explode * Math.max(0, 1 - st.flatten * 2);
      cubesRef.current.forEach((c) => {
        if (!c?.mesh) return;
        const { gx, gy, gz } = c.grid;
        const dir = new THREE.Vector3(gx, gy, gz);
        if (dir.length() > 0) dir.normalize();
        const target = new THREE.Vector3(
          gx * CELL + dir.x * effectiveExplode,
          gy * CELL + gy * st.flatten * 0.07 + dir.y * effectiveExplode,
          gz * CELL + dir.z * effectiveExplode
        );
        c.mesh.position.lerp(target, 0.08);
      });
    }
  });

  return { scrollState, explosionRef };
}
