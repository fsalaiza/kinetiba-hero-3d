import React from "react";
import { monoFont, sansFont } from "../utils/constants";
import LocationGlitch from "./LocationGlitch";

export default function Overlay({ scrollProgress, reducedMotion }) {
  return (
    <div
      id="hero-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "clamp(24px, 4vw, 50px)",
      }}
    >
      {/* NAV */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            border: "1.5px solid rgba(230,230,220,0.4)",
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(4px)",
            background: "rgba(230,230,220,0.08)",
          }}>
            <span style={{ color: "#e6e6dc", fontSize: 14, fontWeight: 700, fontFamily: monoFont }}>K</span>
          </div>
          <span style={{
            color: "#e6e6dc", fontSize: "clamp(12px, 1.5vw, 15px)",
            fontWeight: 500, fontFamily: monoFont,
            letterSpacing: "0.15em", textTransform: "uppercase",
          }}>
            Kinetiba
          </span>
        </div>
        <div style={{
          border: "1px solid rgba(230,230,220,0.3)",
          borderRadius: 4, padding: "8px 20px",
          pointerEvents: "auto", cursor: "pointer",
          backdropFilter: "blur(4px)",
          background: "rgba(230,230,220,0.05)",
        }}>
          <span style={{
            color: "#e6e6dc", fontSize: "clamp(9px, 1.1vw, 12px)",
            fontFamily: monoFont, letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}>
            Contacto &rsaquo;
          </span>
        </div>
      </div>

      {/* MID */}
      <div style={{ position: "relative" }}>
        <LocationGlitch reducedMotion={reducedMotion} />
      </div>

      {/* BOTTOM */}
      <div>
        <ul style={{ display: "flex", gap: 10, marginBottom: 20, listStyle: "none", padding: 0, margin: "0 0 20px 0" }} aria-label="Indicadores visuales">
          {["⊞⊞⊞", "▦▦▦", "⫾⫿⫾"].map((icon, i) => (
            <li key={i} style={{
              border: "1px solid rgba(230,230,220,0.18)",
              borderRadius: 4, padding: "5px 10px",
              color: "#d4d4c8", fontSize: 10, fontFamily: monoFont,
            }} aria-hidden="true">
              {icon}
            </li>
          ))}
        </ul>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-end", flexWrap: "wrap", gap: 24,
        }}>
          <h1 style={{
            color: "#eeeee4", fontSize: "clamp(28px, 5vw, 64px)",
            fontWeight: 800, lineHeight: 0.95, margin: 0,
            letterSpacing: "-0.02em", textTransform: "uppercase",
            fontFamily: sansFont, maxWidth: "60%",
          }}>
            Tus datos.
            <br />
            Tu ventaja.
          </h1>
          <p style={{
            color: "#c8c8bc", fontSize: "clamp(9px, 1vw, 12px)",
            fontFamily: monoFont, lineHeight: 1.7,
            letterSpacing: "0.04em", textTransform: "uppercase",
            maxWidth: 380, margin: 0,
          }}>
            * Business Intelligence y ERP diseñados
            <br />
            para la PyME mexicana. A través de datos
            <br />
            en tiempo real, empoderamos negocios para
            <br />
            optimizar operaciones y crecer con impacto.
          </p>
        </div>
      </div>
    </div>
  );
}
