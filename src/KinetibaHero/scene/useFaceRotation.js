import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { CELL } from "../utils/constants";

export default function useFaceRotation(scrollRef, mainRef, pivotRef, cubesRef, reducedMotion) {
  const isRotating = useRef(false);

  const doFaceRotation = useCallback(() => {
    const scrollProgress = scrollRef?.current || 0;
    if (scrollProgress > 0.02 && !(scrollProgress > 0.70 && scrollProgress < 0.92)) return;
    if (isRotating.current || !mainRef.current || !pivotRef.current) return;
    isRotating.current = true;

    const axes = ["x", "y", "z"];
    const axis = axes[Math.floor(Math.random() * 3)];
    const layer = [-1, 0, 1][Math.floor(Math.random() * 3)];
    const dir = Math.random() > 0.5 ? 1 : -1;

    const piecesInLayer = [];
    cubesRef.current.forEach((c) => {
      if (!c || !c.mesh) return;
      const g = c.grid;
      const match =
        axis === "x" ? g.gx === layer :
        axis === "y" ? g.gy === layer :
        g.gz === layer;
      if (match) piecesInLayer.push(c);
    });

    if (piecesInLayer.length === 0) {
      isRotating.current = false;
      return;
    }

    const pivot = pivotRef.current;
    const main = mainRef.current;
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld(true);

    piecesInLayer.forEach((c) => {
      const wp = new THREE.Vector3();
      c.mesh.getWorldPosition(wp);
      const wq = new THREE.Quaternion();
      c.mesh.getWorldQuaternion(wq);
      main.remove(c.mesh);
      pivot.add(c.mesh);
      const lp = new THREE.Vector3();
      pivot.worldToLocal(lp.copy(wp));
      c.mesh.position.copy(lp);
      c.mesh.quaternion.copy(wq);
      const pq = new THREE.Quaternion();
      pivot.getWorldQuaternion(pq);
      c.mesh.quaternion.premultiply(pq.invert());
    });

    const target = (dir * Math.PI) / 2;
    const duration = 800;
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const angle = target * e;

      if (axis === "x") pivot.rotation.set(angle, 0, 0);
      else if (axis === "y") pivot.rotation.set(0, angle, 0);
      else pivot.rotation.set(0, 0, angle);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        piecesInLayer.forEach((c) => {
          const wp = new THREE.Vector3();
          c.mesh.getWorldPosition(wp);
          const wq = new THREE.Quaternion();
          c.mesh.getWorldQuaternion(wq);
          pivot.remove(c.mesh);
          main.add(c.mesh);
          const lp = new THREE.Vector3();
          main.worldToLocal(lp.copy(wp));
          c.mesh.position.copy(lp);
          const mq = new THREE.Quaternion();
          main.getWorldQuaternion(mq);
          c.mesh.quaternion.copy(wq).premultiply(mq.clone().invert());

          c.grid.gx = Math.round(c.mesh.position.x / CELL);
          c.grid.gy = Math.round(c.mesh.position.y / CELL);
          c.grid.gz = Math.round(c.mesh.position.z / CELL);
        });
        pivot.rotation.set(0, 0, 0);
        isRotating.current = false;
      }
    }
    tick();
  }, [scrollRef, mainRef, pivotRef, cubesRef]);

  useEffect(() => {
    // When reduced motion is active, disable face rotation entirely
    if (reducedMotion) return;

    let timer = null;
    let currentMs = 4000;
    const initial = setTimeout(doFaceRotation, 2200);
    const schedule = () => {
      const p = scrollRef?.current || 0;
      const inERP = p > 0.66 && p < 0.88;
      const desired = inERP ? 1200 : 4000;
      if (desired !== currentMs) currentMs = desired;
      timer = setTimeout(() => {
        doFaceRotation();
        schedule();
      }, currentMs);
    };
    schedule();
    return () => {
      clearTimeout(timer);
      clearTimeout(initial);
    };
  }, [doFaceRotation, scrollRef, reducedMotion]);

  return isRotating;
}
