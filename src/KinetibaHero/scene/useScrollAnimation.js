import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CELL } from "../utils/constants";

gsap.registerPlugin(ScrollTrigger);

export default function useScrollAnimation(outerRef, cubesRef, isRotating) {
  const rotYAccum = useRef(0);
  const explosionRef = useRef(0);

  const scrollState = useRef({
    targetX: 0,
    targetScale: 1.0,
    targetRotSpeed: 0.10,
    targetExplode: 0,
    targetFlatten: 0,
    cubeX: 0,
    cubeScale: 1.0,
    rotSpeed: 0.10,
    explode: 0,
    flatten: 0,
  });

  useEffect(() => {
    const st = scrollState.current;
    const sections = document.querySelectorAll('#scroll-container > div');
    if (!sections.length) return;

    const ctx = gsap.context(() => {
      // [S1] ZOOM-IN
      gsap.to(st, {
        targetScale: 2.0,
        targetRotSpeed: 0,
        targetFlatten: 0.5,
        scrollTrigger: {
          trigger: sections[1],
          start: 'top bottom',
          end: 'center center',
          scrub: 1,
        },
      });

      gsap.to('#hero-overlay', {
        opacity: 0,
        scrollTrigger: {
          trigger: sections[1],
          start: 'top bottom',
          end: 'top center',
          scrub: 1,
        },
      });

      // [S2] BI
      gsap.to(st, {
        targetScale: 1.3,
        targetX: 3,
        targetExplode: 0.2,
        targetRotSpeed: 0.1,
        targetFlatten: 0.7,
        scrollTrigger: {
          trigger: sections[2],
          start: 'top 150%',
          end: 'bottom center',
          scrub: 1,
        },
      });

      ScrollTrigger.create({
        trigger: sections[2],
        start: 'center center',
        end: '+=150%',
        pin: true,
        pinSpacing: true,
      });

      // [S3] WHATSAPP
      gsap.to(st, {
        targetScale: 0.75,
        targetX: -5.5,
        targetExplode: 0,
        targetRotSpeed: 0,
        targetFlatten: 0,
        scrollTrigger: {
          trigger: sections[3],
          start: 'top 180%',
          end: 'center center',
          scrub: 1,
        },
      });

      // [S4] ERP
      gsap.to(st, {
        targetScale: 1.5,
        targetX: -3,
        targetExplode: 0,
        targetRotSpeed: 0.5,
        targetFlatten: 0,
        scrollTrigger: {
          trigger: sections[4],
          start: 'top bottom',
          end: 'bottom center',
          scrub: 1,
        },
      });

      ScrollTrigger.create({
        trigger: sections[4],
        start: 'top 20%',
        end: '+=150%',
        pin: true,
        pinSpacing: true,
      });

      // [S5] CTA
      gsap.to(st, {
        targetScale: 1.0,
        targetX: 0,
        targetExplode: 0.7,
        targetRotSpeed: 0,
        targetFlatten: 0,
        scrollTrigger: {
          trigger: sections[5],
          start: 'top bottom',
          end: 'center center',
          scrub: 1,
        },
      });
    });

    return () => ctx.revert();
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
