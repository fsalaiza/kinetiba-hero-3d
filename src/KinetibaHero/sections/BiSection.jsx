import React from "react";
import { monoFont, sansFont } from "../utils/constants";
import { sectionOpacity } from "../utils/scrollHelpers";
import MiniDashboard from "./MiniDashboard";

export default function BiSection({ scrollProgress, sectionStyle }) {
  return (
    <div
      style={{
        ...sectionStyle,
        justifyContent: "center",
        padding: "0 clamp(48px, 8vw, 120px)",
        gap: "clamp(32px, 5vw, 72px)",
        opacity: sectionOpacity(scrollProgress, 0.16, 0.34),
      }}
    >
      {/* Left: text */}
      <div style={{
        maxWidth: 400, flex: "0 1 400px",
        transform: `translateY(${scrollProgress >= 0.15 && scrollProgress <= 0.34 ? (scrollProgress - 0.25) * -40 : 0}px)`,
        transition: "transform 0.12s ease-out, opacity 0.3s ease",
      }}>
        <h2 style={{
          color: "#eeeee4", fontSize: "clamp(32px, 5vw, 64px)",
          fontWeight: 800, fontFamily: sansFont,
          letterSpacing: "-0.02em", textTransform: "uppercase",
          margin: "0 0 16px 0", lineHeight: 1,
        }}>
          Kinetiba<br />BI
        </h2>
        <p style={{
          color: "#9A998F", fontSize: "clamp(11px, 1.1vw, 13px)",
          fontFamily: monoFont, letterSpacing: "0.02em",
          lineHeight: 1.6, margin: "0 0 24px 0",
        }}>
          Datos en tiempo real. Sin SQL, sin dashboards.
        </p>
        {[
          "Lectura en lenguaje natural",
          "Alertas por WhatsApp",
          "ERP conectado en 3 minutos",
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

      {/* Right: Mini Dashboard visual */}
      <div style={{
        flex: "0 1 340px",
        maxWidth: 340,
        opacity: 0.9,
      }}>
        <MiniDashboard />
      </div>
    </div>
  );
}
