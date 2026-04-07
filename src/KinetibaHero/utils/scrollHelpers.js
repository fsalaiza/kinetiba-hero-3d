import { useState, useRef, useEffect } from "react";

export function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const p = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      progressRef.current = p;
      setProgress(p);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { progress, progressRef };
}

export function sectionOpacity(scrollProgress, sectionStart, sectionEnd) {
  const fadeIn = 0.04;
  const fadeOut = 0.04;
  if (scrollProgress < sectionStart || scrollProgress > sectionEnd) return 0;
  if (scrollProgress < sectionStart + fadeIn)
    return (scrollProgress - sectionStart) / fadeIn;
  if (scrollProgress > sectionEnd - fadeOut)
    return (sectionEnd - scrollProgress) / fadeOut;
  return 1;
}

/**
 * Computes camera orbit parameters based on scroll progress.
 * Returns { theta, phi, radius } for spherical camera positioning.
 */
export function getCameraOrbit(scrollProgress) {
  // D2C-style dramatic camera orbit with zoom and rotation
  const theta = Math.PI * 0.25 + scrollProgress * Math.PI * 0.5;
  const phi = Math.PI * 0.35 - Math.sin(scrollProgress * Math.PI) * 0.15;
  const radius = 10 - scrollProgress * 4;
  return { theta, phi, radius };
}
