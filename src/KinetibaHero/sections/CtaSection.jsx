import React from "react";
import { monoFont, sansFont } from "../utils/constants";
import { sectionOpacity } from "../utils/scrollHelpers";

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
        style={{
          pointerEvents: "auto",
          background: "rgba(230,230,220,0.12)",
          border: "1.5px solid rgba(230,230,220,0.35)",
          borderRadius: 6, padding: "14px 40px",
          color: "#eeeee4", fontSize: "clamp(10px, 1.1vw, 13px)",
          fontFamily: monoFont, letterSpacing: "0.15em",
          textTransform: "uppercase", cursor: "pointer",
          backdropFilter: "blur(6px)",
          transition: "background 0.2s, border-color 0.2s",
        }}
        onMouseEnter={(e) => {
          e.target.style.background = "rgba(230,230,220,0.22)";
          e.target.style.borderColor = "rgba(230,230,220,0.55)";
        }}
        onMouseLeave={(e) => {
          e.target.style.background = "rgba(230,230,220,0.12)";
          e.target.style.borderColor = "rgba(230,230,220,0.35)";
        }}
      >
        Solicita tu demo &rsaquo;
      </button>
    </div>
  );
}
