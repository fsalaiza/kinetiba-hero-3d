import React from "react";
import { monoFont } from "../utils/constants";

export default function CfdiVisual() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 300,
        background: "rgba(230,230,220,0.06)",
        border: "1px solid rgba(230,230,220,0.12)",
        borderRadius: 12,
        padding: "clamp(16px, 2vw, 22px)",
        backdropFilter: "blur(8px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Sello decorativo superior */}
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          border: "2px solid rgba(139,154,107,0.15)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(139,154,107,0.3)" strokeWidth="1.5">
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>

      {/* Header factura */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
        }}
      >
        <div>
          <div
            style={{
              color: "#9A998F",
              fontSize: 9,
              fontFamily: monoFont,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Factura CFDI 4.0
          </div>
          <div
            style={{
              color: "#eeeee4",
              fontSize: "clamp(16px, 2vw, 22px)",
              fontWeight: 700,
              fontFamily: monoFont,
              letterSpacing: "-0.01em",
            }}
          >
            A-4721
          </div>
        </div>
        <div
          style={{
            background: "rgba(139,154,107,0.15)",
            color: "#8B9A6B",
            fontSize: 9,
            fontFamily: monoFont,
            letterSpacing: "0.08em",
            padding: "4px 10px",
            borderRadius: 4,
            textTransform: "uppercase",
          }}
        >
          Timbrada
        </div>
      </div>

      {/* Datos emisor */}
      <div
        style={{
          borderTop: "1px solid rgba(230,230,220,0.1)",
          paddingTop: 14,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            color: "#c8c8bc",
            fontSize: 11,
            fontFamily: monoFont,
            marginBottom: 8,
          }}
        >
          NewToner S.A. de C.V.
        </div>
        <div
          style={{
            color: "#8B8A80",
            fontSize: 9,
            fontFamily: monoFont,
            letterSpacing: "0.02em",
          }}
        >
          RFC: NTO-210315-XX0
        </div>
      </div>

      {/* Conceptos */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            color: "#9A998F",
            fontSize: 8,
            fontFamily: monoFont,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Conceptos
        </div>
        {[
          { desc: "Toner HP 85A", qty: "2", unit: "$1,240", total: "$2,480" },
          { desc: "Papel Bond A4 (caja)", qty: "5", unit: "$380", total: "$1,900" },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid rgba(230,230,220,0.06)",
            }}
          >
            <div>
              <div
                style={{
                  color: "#c8c8bc",
                  fontSize: 10,
                  fontFamily: monoFont,
                }}
              >
                {item.desc}
              </div>
              <div
                style={{
                  color: "#8B8A80",
                  fontSize: 9,
                  fontFamily: monoFont,
                }}
              >
                {item.qty} × {item.unit}
              </div>
            </div>
            <div
              style={{
                color: "#d4d4c8",
                fontSize: 10,
                fontFamily: monoFont,
                fontWeight: 600,
              }}
            >
              {item.total}
            </div>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div
        style={{
          background: "rgba(0,0,0,0.12)",
          borderRadius: 6,
          padding: "10px 12px",
        }}
      >
        {[
          { label: "Subtotal", value: "$4,380.00" },
          { label: "IVA (16%)", value: "$700.80" },
          { label: "Total", value: "$5,080.80", bold: true },
        ].map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "3px 0",
            }}
          >
            <span
              style={{
                color: row.bold ? "#eeeee4" : "#9A998F",
                fontSize: row.bold ? 12 : 10,
                fontFamily: monoFont,
                fontWeight: row.bold ? 700 : 400,
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                color: row.bold ? "#eeeee4" : "#d4d4c8",
                fontSize: row.bold ? 12 : 10,
                fontFamily: monoFont,
                fontWeight: row.bold ? 700 : 400,
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Footer: PACs */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {["Solución Factible", "SW Sapien"].map((pac, i) => (
          <div
            key={i}
            style={{
              color: "#6A8B5A",
              fontSize: 9,
              fontFamily: monoFont,
              letterSpacing: "0.04em",
              padding: "3px 8px",
              border: "1px solid rgba(106,139,90,0.25)",
              borderRadius: 3,
            }}
          >
            {pac}
          </div>
        ))}
      </div>
    </div>
  );
}
