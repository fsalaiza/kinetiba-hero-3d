import React, { useState, useEffect } from "react";

export default function ScrollProgressBar({ scrollProgress }) {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth > 768 : false
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!isDesktop) return null;

  const visible = scrollProgress > 0;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 2,
        height: "100vh",
        zIndex: 10,
        background: "rgba(230,230,220,0.2)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "100%",
          height: `${scrollProgress * 100}%`,
          background: "rgba(230,230,220,0.7)",
          transition: "height 0.08s linear",
        }}
      />
    </div>
  );
}
