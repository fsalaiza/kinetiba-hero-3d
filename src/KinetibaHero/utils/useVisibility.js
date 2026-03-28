import { useRef, useEffect } from "react";

/**
 * Returns a ref (boolean) that tracks whether `targetRef` is visible
 * in the viewport via IntersectionObserver.
 */
export default function useVisibility(targetRef) {
  const isVisible = useRef(true);

  useEffect(() => {
    const el = targetRef?.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible.current = entry.isIntersecting;
      },
      { threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [targetRef]);

  return isVisible;
}
