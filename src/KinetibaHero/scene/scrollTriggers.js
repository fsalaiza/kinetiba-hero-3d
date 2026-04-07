import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function setupScrollTriggers(scrollState) {
  const st = scrollState;
  const sections = document.querySelectorAll('#scroll-container > div');
  if (!sections.length) return null;

  // Cube centered in the hero — protagonist layout
  st.targetX = 0;

  return gsap.context(() => {
    // [S1] ZOOM-IN — cube zooms in, overlay fades fast
    gsap.to(st, {
      targetScale: 2.0, targetRotSpeed: 0, targetFlatten: 0.5,
      scrollTrigger: { trigger: sections[1], start: 'top bottom', end: 'center center', scrub: 0.5, ease: 'power2.inOut' },
    });
    gsap.to('#hero-overlay', {
      opacity: 0,
      scrollTrigger: { trigger: sections[1], start: 'top 80%', end: 'top 40%', scrub: 0.5, ease: 'power2.inOut' },
    });

    // [S2] BI — cube moves right, smaller, slight explode, pinned
    gsap.to(st, {
      targetScale: 1.3, targetX: 3, targetExplode: 0.3, targetRotSpeed: 0.1, targetFlatten: 0.7,
      scrollTrigger: { trigger: sections[2], start: 'top bottom', end: 'bottom top', scrub: 0.5, ease: 'power2.inOut' },
    });
    ScrollTrigger.create({
      trigger: sections[2], start: 'center center', end: '+=180%', pin: true, pinSpacing: false,
    });

    // [S3] WHATSAPP — cube moves left, smaller, no pin
    gsap.to(st, {
      targetScale: 0.75, targetX: -5.5, targetExplode: 0, targetRotSpeed: 0, targetFlatten: 0,
      scrollTrigger: { trigger: sections[3], start: 'top bottom', end: 'bottom top', scrub: 0.5, ease: 'power2.inOut' },
    });

    // [S4] ERP — cube center-right, larger, fast rotation, pinned
    gsap.to(st, {
      targetScale: 1.5, targetX: -3, targetExplode: 0, targetRotSpeed: 0.5, targetFlatten: 0,
      scrollTrigger: { trigger: sections[4], start: 'top bottom', end: 'bottom top', scrub: 0.5, ease: 'power2.inOut' },
    });
    ScrollTrigger.create({
      trigger: sections[4], start: 'center center', end: '+=180%', pin: true, pinSpacing: false,
    });

    // [S5] AGENTES — cube moves right, medium size
    gsap.to(st, {
      targetScale: 1.2, targetX: 3, targetExplode: 0, targetRotSpeed: 0.15, targetFlatten: 0,
      scrollTrigger: { trigger: sections[5], start: 'top bottom', end: 'bottom top', scrub: 0.5, ease: 'power2.inOut' },
    });

    // [S6] CTA — cube centers, dramatic burst/explode, stops rotating
    gsap.to(st, {
      targetScale: 1.0, targetX: 0, targetExplode: 3.5, targetRotSpeed: 0, targetFlatten: 0,
      scrollTrigger: { trigger: sections[6], start: 'top bottom', end: 'bottom top', scrub: 0.5, ease: 'power2.inOut' },
    });
  });
}
