import React from "react";
import { monoFont, sansFont } from "../utils/constants";
import { sectionOpacity } from "../utils/scrollHelpers";

export default function BiSection({ scrollProgress, sectionStyle }) {
  return (
    <div
      style={{
        ...sectionStyle,
        justifyContent: "flex-start",
        padding: "0 clamp(48px, 8vw, 120px)",
        opacity: sectionOpacity(scrollProgress, 0.20, 0.38),
      }}
    >
      <div style={{
        maxWidth: 500,
        transform: `translateY(${scrollProgress >= 0.20 && scrollProgress <= 0.38 ? (scrollProgress - 0.29) * -40 : 0}px)`,
        transition: "transform 0.08s linear",
      }}>
        <h2 style={{
          color: "#eeeee4", fontSize: "clamp(28px, 4vw, 52px)",
          fontWeight: 800, fontFamily: sansFont,
          letterSpacing: "-0.02em", textTransform: "uppercase",
          margin: "0 0 8px 0",
        }}>
          Kinetiba BI
        </h2>
        <p style={{
          color: "#c8c8bc", fontSize: "clamp(11px, 1.2vw, 14px)",
          fontFamily: monoFont, letterSpacing: "0.06em",
          margin: "0 0 24px 0",
        }}>
          Business Intelligence en tiempo real
        </p>
        {[
          "996K transacciones procesadas",
          "10 dashboards configurables",
          "Alertas por WhatsApp",
          "Desde $299 MXN/mes",
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
