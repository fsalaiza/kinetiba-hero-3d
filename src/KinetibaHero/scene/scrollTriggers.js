import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function setupScrollTriggers(scrollState) {
  const st = scrollState;
  const sections = document.querySelectorAll('#scroll-container > div');
  if (!sections.length) return null;

  // Offset cube to the right in the hero so it doesn't block the headline
  st.targetX = 2.0;

  return gsap.context(() => {
    // [S1] ZOOM-IN
    gsap.to(st, {
      targetScale: 2.0, targetRotSpeed: 0, targetFlatten: 0.5,
      scrollTrigger: { trigger: sections[1], start: 'top bottom', end: 'center center', scrub: 1 },
    });
    gsap.to('#hero-overlay', {
      opacity: 0,
      scrollTrigger: { trigger: sections[1], start: 'top bottom', end: 'top center', scrub: 1 },
    });

    // [S2] BI
    gsap.to(st, {
      targetScale: 1.3, targetX: 3, targetExplode: 0.2, targetRotSpeed: 0.1, targetFlatten: 0.7,
      scrollTrigger: { trigger: sections[2], start: 'top 120%', end: 'bottom center', scrub: 1 },
    });
    ScrollTrigger.create({
      trigger: sections[2], start: 'center center', end: '+=150%', pin: true, pinSpacing: true,
    });

    // [S3] WHATSAPP
    gsap.to(st, {
      targetScale: 0.75, targetX: -5.5, targetExplode: 0, targetRotSpeed: 0, targetFlatten: 0,
      scrollTrigger: { trigger: sections[3], start: 'top 160%', end: 'center center', scrub: 1 },
    });

    // [S4] ERP
    gsap.to(st, {
      targetScale: 1.5, targetX: -3, targetExplode: 0, targetRotSpeed: 0.5, targetFlatten: 0,
      scrollTrigger: { trigger: sections[4], start: 'top bottom', end: 'bottom center', scrub: 1 },
    });
    ScrollTrigger.create({
      trigger: sections[4], start: 'top 20%', end: '+=150%', pin: true, pinSpacing: true,
    });

    // [S5] CTA
    gsap.to(st, {
      targetScale: 1.0, targetX: 0, targetExplode: 0.7, targetRotSpeed: 0, targetFlatten: 0,
      scrollTrigger: { trigger: sections[5], start: 'top bottom', end: 'center center', scrub: 1 },
    });
  });
}
