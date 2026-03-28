import React from "react";
import { monoFont } from "../utils/constants";

const containerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "radial-gradient(ellipse at 50% 35%, #8a9684 0%, #7d8977 20%, #717e6e 42%, #667364 62%, #5c6a5b 80%, #535f52 100%)",
};

const logoBoxStyle = {
  width: 48,
  height: 48,
  border: "1.5px solid rgba(230,230,220,0.4)",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(230,230,220,0.08)",
  animation: "hero-fallback-pulse 1.8s ease-in-out infinite",
};

const labelStyle = {
  color: "rgba(230,230,220,0.6)",
  fontSize: 13,
  fontFamily: monoFont,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  marginTop: 16,
};

const keyframes = `
@keyframes hero-fallback-pulse {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}
`;

export default function HeroFallback() {
  return (
    <div style={containerStyle}>
      <style>{keyframes}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={logoBoxStyle}>
          <span
            style={{
              color: "#e6e6dc",
              fontSize: 22,
              fontWeight: 700,
              fontFamily: monoFont,
            }}
          >
            K
          </span>
        </div>
        <div style={labelStyle}>Kinetiba</div>
      </div>
    </div>
  );
}
