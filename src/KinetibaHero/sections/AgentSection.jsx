import React from "react";
import { monoFont, sansFont } from "../utils/constants";
import { sectionOpacity } from "../utils/scrollHelpers";

function NetworkVisual() {
  return (
    <div style={{ width: 200, height: 200, flex: "0 0 200px" }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        {[
          [100, 40], [50, 90], [150, 90], [80, 150], [130, 150],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="4" fill="rgba(230,230,220,0.15)" />
            <circle cx={cx} cy={cy} r="2.5" fill="rgba(230,230,220,0.6)" />
          </g>
        ))}
        {[
          [[100, 40], [50, 90]], [[100, 40], [150, 90]],
          [[50, 90], [80, 150]], [[150, 90], [130, 150]],
          [[80, 150], [130, 150]],
        ].map(([a, b], i) => (
          <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="rgba(230,230,220,0.12)" strokeWidth="1" />
        ))}
        <circle cx="100" cy="100" r="6" fill="rgba(230,230,220,0.2)" />
        <circle cx="100" cy="100" r="3.5" fill="rgba(230,230,220,0.7)" />
      </svg>
    </div>
  );
}

export default function AgentSection({ scrollProgress, sectionStyle }) {
  return (
    <div style={{
      ...sectionStyle,
      justifyContent: "center",
      padding: "0 clamp(48px, 8vw, 120px)",
      gap: "clamp(32px, 5vw, 72px)",
      opacity: sectionOpacity(scrollProgress, 0.60, 0.82),
    }}>
      <div style={{
        maxWidth: 400, flex: "0 1 400px",
        transform: `translateY(${scrollProgress >= 0.60 && scrollProgress <= 0.82 ? (scrollProgress - 0.71) * -40 : 0}px)`,
        transition: "transform 0.08s linear",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B9A6B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
          <span style={{ color: "#8B8A80", fontSize: 10, fontFamily: monoFont, letterSpacing: "0.3em", textTransform: "uppercase" }}>Agentes</span>
        </div>
        <h2 style={{
          color: "#eeeee4", fontSize: "clamp(32px, 5vw, 64px)",
          fontWeight: 800, fontFamily: sansFont,
          letterSpacing: "-0.02em", lineHeight: 1, margin: "0 0 16px 0",
        }}>
          Inteligencia<br />agéntica
        </h2>
        <p style={{
          color: "#9A998F", fontSize: "clamp(11px, 1.1vw, 13px)",
          fontFamily: monoFont, lineHeight: 1.6,
          letterSpacing: "0.02em", margin: "0 0 20px 0",
        }}>
          Agentes que aprenden de tu operación y actúan solos.
        </p>
        {["Automatización inteligente", "Decisiones basadas en datos", "Escalable sin intervención"].map((item, i) => (
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
      <NetworkVisual />
    </div>
  );
}
