import React from "react";
import { monoFont, sansFont } from "../utils/constants";
import { sectionOpacity } from "../utils/scrollHelpers";

export default function ErpSection({ scrollProgress, sectionStyle }) {
  return (
    <div
      style={{
        ...sectionStyle,
        height: "120vh",
        justifyContent: "flex-end",
        padding: "0 clamp(48px, 8vw, 120px)",
        opacity: sectionOpacity(scrollProgress, 0.52, 0.88),
      }}
    >
      <div style={{
        maxWidth: 500,
        transform: `translateY(${scrollProgress >= 0.52 && scrollProgress <= 0.88 ? (scrollProgress - 0.70) * -40 : 0}px)`,
        transition: "transform 0.08s linear",
      }}>
        <h2 style={{
          color: "#eeeee4", fontSize: "clamp(28px, 4vw, 52px)",
          fontWeight: 800, fontFamily: sansFont,
          letterSpacing: "-0.02em", textTransform: "uppercase",
          margin: "0 0 8px 0",
        }}>
          Kineti-ERP
        </h2>
        <p style={{
          color: "#c8c8bc", fontSize: "clamp(11px, 1.2vw, 14px)",
          fontFamily: monoFont, letterSpacing: "0.06em",
          margin: "0 0 24px 0",
        }}>
          Facturación CFDI 4.0 integrada
        </p>
        {[
          "Multi-PAC (Solución Factible, SW Sapien)",
          "Compatible con AdminPAQ",
          "100% validado vs SAT",
          "Sellado local con CSD",
        ].map((item, i) => (
          <div key={i} style={{
            color: "#d4d4c8", fontSize: "clamp(10px, 1.1vw, 13px)",
            fontFamily: monoFont, letterSpacing: "0.04em",
            padding: "8px 0",
            borderBottom: "1px solid rgba(230,230,220,0.1)",
          }}>
            → {item}
          </div>
        ))}
      </div>
    </div>
  );
}
