import React from "react";
import { monoFont, sansFont } from "../utils/constants";
import { sectionOpacity } from "../utils/scrollHelpers";
import CfdiVisual from "./CfdiVisual";

export default function ErpSection({ scrollProgress, sectionStyle }) {
  return (
    <div
      style={{
        ...sectionStyle,
        height: "120vh",
        justifyContent: "center",
        padding: "0 clamp(48px, 8vw, 120px)",
        gap: "clamp(32px, 5vw, 72px)",
        opacity: sectionOpacity(scrollProgress, 0.48, 0.84),
      }}
    >
      {/* Left: text */}
      <div style={{
        maxWidth: 400, flex: "0 1 400px",
        transform: `translateY(${scrollProgress >= 0.48 && scrollProgress <= 0.84 ? (scrollProgress - 0.66) * -40 : 0}px)`,
        transition: "transform 0.1s ease-out",
      }}>
        <h2 style={{
          color: "#eeeee4", fontSize: "clamp(32px, 5vw, 64px)",
          fontWeight: 800, fontFamily: sansFont,
          letterSpacing: "-0.02em", textTransform: "uppercase",
          margin: "0 0 16px 0", lineHeight: 1,
        }}>
          Kineti<br />ERP
        </h2>
        <p style={{
          color: "#9A998F", fontSize: "clamp(11px, 1.1vw, 13px)",
          fontFamily: monoFont, letterSpacing: "0.02em",
          lineHeight: 1.6, margin: "0 0 24px 0",
        }}>
          CFDI 4.0 integrado a tu operación. Sin doble captura.
        </p>
        {[
          "Multi-PAC integrado",
          "Compatible AdminPAQ",
          "100% validado SAT",
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

      {/* Right: CFDI visual */}
      <div style={{
        flex: "0 1 300px",
        maxWidth: 300,
        opacity: 0.9,
      }}>
        <CfdiVisual />
      </div>
    </div>
  );
}
