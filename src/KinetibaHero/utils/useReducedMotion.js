import { useState, useEffect } from "react";

/**
 * Detects prefers-reduced-motion media query.
 * Also accepts an explicit override prop (e.g. from host app).
 */
export default function useReducedMotion(forcedValue) {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof forcedValue === "boolean") return forcedValue;
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof forcedValue === "boolean") {
      setPrefersReduced(forcedValue);
      return;
    }
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setPrefersReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [forcedValue]);

  return prefersReduced;
}
