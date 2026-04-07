import React from "react";
import { monoFont, sansFont } from "../utils/constants";

const heroCTAStyles = `
.kba-hero-cta {
  pointer-events: auto;
  display: inline-block;
  background: rgba(230,230,220,0.12);
  border: 1.5px solid rgba(230,230,220,0.35);
  border-radius: 6px;
  padding: 14px 36px;
  color: #eeeee4;
  font-size: clamp(10px, 1.1vw, 13px);
  font-family: ${monoFont};
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-decoration: none;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: background 0.25s ease, border-color 0.25s ease, transform 0.2s ease;
}
.kba-hero-cta:hover {
  background: rgba(230,230,220,0.22);
  border-color: rgba(230,230,220,0.55);
  transform: translateY(-1px);
}
.kba-hero-cta:active {
  transform: translateY(0) scale(0.98);
}
`;

export default function Overlay({ scrollProgress, reducedMotion, onCtaClick }) {
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
      <style>{heroCTAStyles}</style>

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

      {/* HERO CONTENT — headline dominates, cube sits behind/beside */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        maxWidth: "42%",
        gap: "clamp(16px, 2.5vw, 32px)",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Backdrop gradient para contraste del texto — más sutil */}
        <div
          style={{
            position: "absolute",
            inset: "clamp(-24px, -3vw, -50px)",
            background: "linear-gradient(to right, rgba(60,68,58,0.4) 0%, rgba(60,68,58,0.15) 50%, transparent 100%)",
            borderRadius: "0 12px 12px 0",
            zIndex: -1,
            pointerEvents: "none",
          }}
        />
        <h1 style={{
          color: "#eeeee4",
          fontSize: "clamp(36px, 5.5vw, 72px)",
          fontWeight: 800,
          lineHeight: 0.95,
          margin: 0,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          fontFamily: sansFont,
        }}>
          Tus datos.
          <br />
          Tu ventaja.
        </h1>
        <p style={{
          color: "#c8c8bc",
          fontSize: "clamp(10px, 1.05vw, 13px)",
          fontFamily: monoFont,
          lineHeight: 1.7,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          maxWidth: 420,
          margin: 0,
        }}>
          Business Intelligence y ERP diseñados para la PyME mexicana.
          Datos en tiempo real para optimizar operaciones y crecer con impacto.
        </p>
        <a
          className="kba-hero-cta"
          href="https://wa.me/5213331704724?text=Hola%2C%20me%20interesa%20Kinetiba"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (onCtaClick) {
              e.preventDefault();
              onCtaClick();
            }
          }}
        >
          Solicita tu demo &rsaquo;
        </a>
      </div>

      {/* BOTTOM — scroll hint */}
      <div style={{
        display: "flex", alignItems: "center", gap: 0,
        marginLeft: "calc(-1 * clamp(24px, 4vw, 50px))",
        marginRight: "calc(-1 * clamp(24px, 4vw, 50px))",
      }}>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, rgba(230,230,220,0.18) 0%, rgba(230,230,220,0.18) 25%, rgba(230,230,220,0) 50%, rgba(230,230,220,0) 70%, rgba(230,230,220,0.1) 100%)" }} />
        <div style={{
          color: "#c4c4b8", fontSize: "clamp(9px, 1vw, 12px)",
          fontFamily: monoFont, letterSpacing: "0.12em",
          textTransform: "uppercase", paddingLeft: 20,
          paddingRight: "clamp(24px, 4vw, 50px)", whiteSpace: "nowrap",
        }}>
          Scroll to discover ⌄
        </div>
      </div>
    </div>
  );
}
