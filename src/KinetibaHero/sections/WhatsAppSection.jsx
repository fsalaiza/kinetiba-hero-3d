import React from "react";
import { monoFont, sansFont } from "../utils/constants";
import { sectionOpacity } from "../utils/scrollHelpers";

function PhoneMockup() {
  return (
    <div style={{
      width: 280, maxWidth: 280, flex: "0 0 280px",
      background: "#5E6150", borderRadius: 28,
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 60px rgba(0,0,0,0.3)",
      overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid rgba(0,0,0,0.15)", background: "#565949",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: "#4A4D3E",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <span style={{ color: "#D4CFC4", fontSize: 13, fontWeight: 700, fontFamily: monoFont }}>K</span>
        </div>
        <div>
          <div style={{ color: "#D4CFC4", fontSize: 13, fontFamily: sansFont, fontWeight: 600 }}>Kinetiba Bot</div>
          <div style={{ color: "#8B8A80", fontSize: 10, fontFamily: monoFont }}>en línea</div>
        </div>
      </div>

      {/* Chat */}
      <div style={{
        flex: 1, padding: "12px 10px", display: "flex",
        flexDirection: "column", gap: 8, background: "#4A4D3E",
      }}>
        <UserBubble text="¿Cuánto vendimos este mes?" time="14:32" />
        <BotBubble
          label="Ventas marzo 2026:"
          amount="$847,320" delta="↑ 12%" deltaColor="#8B9A6B"
          detail="vs $756,536 feb · 4 sucursales" time="14:32"
        />
        <UserBubble text="¿Y la sucursal GDL?" time="14:33" />
        <BotBubble
          label="GDL · Marzo 2026"
          amount="$312,480" delta="↓ 3%" deltaColor="#C4886B"
          detail="37% del total · ticket prom $1,240" time="14:33"
        />
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 10px 12px", borderTop: "1px solid rgba(0,0,0,0.15)", background: "#565949" }}>
        <div style={{
          background: "#4A4D3E", borderRadius: 20, padding: "8px 14px",
          color: "#8B8A80", fontSize: 11, fontFamily: monoFont,
        }}>
          Escribe un mensaje...
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text, time }) {
  return (
    <div style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
      <div style={{ background: "#5A6148", borderRadius: "14px 14px 4px 14px", padding: "8px 12px" }}>
        <div style={{ color: "#D4CFC4", fontSize: 12, fontFamily: sansFont, lineHeight: 1.4 }}>{text}</div>
        <div style={{ color: "#8B8A80", fontSize: 9, fontFamily: monoFont, textAlign: "right", marginTop: 3 }}>{time}</div>
      </div>
    </div>
  );
}

function BotBubble({ label, amount, delta, deltaColor, detail, time }) {
  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "85%" }}>
      <div style={{ background: "#3E4033", borderRadius: "14px 14px 14px 4px", padding: "8px 12px" }}>
        <div style={{ color: "#9A998F", fontSize: 11, fontFamily: monoFont, marginBottom: 6 }}>{label}</div>
        <div style={{
          background: "rgba(0,0,0,0.15)", borderRadius: 8,
          padding: "8px 10px", marginBottom: 4,
        }}>
          <span style={{ color: "#D4CFC4", fontSize: 20, fontWeight: 700, fontFamily: monoFont }}>{amount}</span>
          <span style={{ color: deltaColor, fontSize: 12, fontFamily: monoFont, marginLeft: 8 }}>{delta}</span>
        </div>
        <div style={{ color: "#8B8A80", fontSize: 10, fontFamily: monoFont }}>{detail}</div>
        <div style={{ color: "#8B8A80", fontSize: 9, fontFamily: monoFont, textAlign: "right", marginTop: 3 }}>{time}</div>
      </div>
    </div>
  );
}

export default function WhatsAppSection({ scrollProgress, sectionStyle }) {
  return (
    <div
      style={{
        ...sectionStyle,
        justifyContent: "center",
        padding: "0 clamp(48px, 8vw, 120px)",
        gap: "clamp(32px, 5vw, 80px)",
        opacity: sectionOpacity(scrollProgress, 0.35, 0.55),
      }}
    >
      <div style={{
        maxWidth: 400, flex: "0 1 400px",
        transform: `translateY(${scrollProgress >= 0.35 && scrollProgress <= 0.55 ? (scrollProgress - 0.45) * -40 : 0}px)`,
        transition: "transform 0.08s linear",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B9A6B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span style={{ color: "#8B8A80", fontSize: 10, fontFamily: monoFont, letterSpacing: "0.3em", textTransform: "uppercase" }}>
            WhatsApp
          </span>
        </div>
        <h2 style={{
          color: "#eeeee4", fontSize: "clamp(24px, 3.5vw, 44px)",
          fontWeight: 800, fontFamily: sansFont,
          letterSpacing: "-0.02em", lineHeight: 1.05, margin: "0 0 16px 0",
        }}>
          Pregúntale<br />a tu negocio
        </h2>
        <p style={{
          color: "#9A998F", fontSize: "clamp(11px, 1.1vw, 13px)",
          fontFamily: monoFont, lineHeight: 1.7,
          letterSpacing: "0.02em", margin: "0 0 20px 0",
        }}>
          Tu equipo pregunta por WhatsApp. Kinetiba responde con datos reales de tu operación. Sin apps, sin dashboards, sin capacitación.
        </p>
        {["→ Text-to-SQL", "→ Reportes semanales"].map((tag, i) => (
          <div key={i} style={{
            color: "#d4d4c8", fontSize: "clamp(10px, 1vw, 12px)",
            fontFamily: monoFont, letterSpacing: "0.04em",
            padding: "6px 0", borderBottom: "1px solid rgba(230,230,220,0.08)",
          }}>
            {tag}
          </div>
        ))}
      </div>
      <PhoneMockup />
    </div>
  );
}
