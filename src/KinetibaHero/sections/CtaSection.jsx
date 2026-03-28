import React from "react";
import { monoFont, sansFont } from "../utils/constants";
import { sectionOpacity } from "../utils/scrollHelpers";

const ctaStyleTag = `
.kba-cta-button {
  pointer-events: auto;
  background: rgba(230,230,220,0.12);
  border: 1.5px solid rgba(230,230,220,0.35);
  border-radius: 6px;
  padding: 14px 40px;
  color: #eeeee4;
  font-size: clamp(10px, 1.1vw, 13px);
  font-family: ${monoFont};
  letter-spacing: 0.15em;
  text-transform: uppercase;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: background 0.25s ease, border-color 0.25s ease, transform 0.2s ease;
}
.kba-cta-button:hover {
  background: rgba(230,230,220,0.22);
  border-color: rgba(230,230,220,0.55);
  transform: translateY(-1px);
}
.kba-cta-button:active {
  transform: translateY(0) scale(0.98);
}
`;

export default function CtaSection({ scrollProgress, sectionStyle }) {
  return (
    <div
      style={{
        ...sectionStyle,
        justifyContent: "center",
        flexDirection: "column",
        textAlign: "center",
        gap: 28,
        opacity: sectionOpacity(scrollProgress, 0.88, 1.0),
      }}
    >
      <style>{ctaStyleTag}</style>
      <h2 style={{
        color: "#eeeee4", fontSize: "clamp(24px, 4vw, 52px)",
        fontWeight: 800, fontFamily: sansFont,
        letterSpacing: "-0.02em", textTransform: "uppercase",
        margin: 0,
      }}>
        ¿Listo para decidir
        <br />
        con datos?
      </h2>
      <button
        className="kba-cta-button"
        aria-label="Solicitar demo de Kineti-BA por WhatsApp"
      >
        Solicita tu demo &rsaquo;
      </button>
    </div>
  );
}
