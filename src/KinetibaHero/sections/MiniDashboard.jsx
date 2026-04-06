import React from "react";
import { monoFont } from "../utils/constants";

export default function MiniDashboard() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 340,
        background: "rgba(230,230,220,0.06)",
        border: "1px solid rgba(230,230,220,0.12)",
        borderRadius: 12,
        padding: "clamp(16px, 2vw, 24px)",
        backdropFilter: "blur(8px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <span
          style={{
            color: "#9A998F",
            fontSize: 10,
            fontFamily: monoFont,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Dashboard
        </span>
        <span
          style={{
            color: "#6A8B5A",
            fontSize: 10,
            fontFamily: monoFont,
            letterSpacing: "0.05em",
          }}
        >
          ● En vivo
        </span>
      </div>

      {/* KPI principal */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            color: "#9A998F",
            fontSize: 10,
            fontFamily: monoFont,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Ventas del mes
        </div>
        <div
          style={{
            color: "#eeeee4",
            fontSize: "clamp(28px, 3.5vw, 40px)",
            fontWeight: 800,
            fontFamily: monoFont,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          $847,320
        </div>
        <div
          style={{
            color: "#8B9A6B",
            fontSize: 12,
            fontFamily: monoFont,
            marginTop: 6,
          }}
        >
          ↑ 12.4% vs mes anterior
        </div>
      </div>

      {/* Barras */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            color: "#9A998F",
            fontSize: 9,
            fontFamily: monoFont,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Por sucursal
        </div>
        {[
          { label: "CDMX", value: 72, color: "#8B9A6B" },
          { label: "GDL", value: 48, color: "#6A7B8B" },
          { label: "MTY", value: 58, color: "#7B6A5A" },
          { label: "PUE", value: 35, color: "#5A6A7B" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  color: "#c8c8bc",
                  fontSize: 10,
                  fontFamily: monoFont,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  color: "#9A998F",
                  fontSize: 10,
                  fontFamily: monoFont,
                }}
              >
                {value}%
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: "rgba(230,230,220,0.08)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${value}%`,
                  background: color,
                  borderRadius: 2,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Mini línea de tendencia SVG */}
      <div>
        <div
          style={{
            color: "#9A998F",
            fontSize: 9,
            fontFamily: monoFont,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Tendencia 6 meses
        </div>
        <svg
          viewBox="0 0 280 60"
          width="100%"
          height="60"
          style={{ overflow: "visible" }}
        >
          {/* Grid lines */}
          {[0, 15, 30, 45, 60].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="280"
              y2={y}
              stroke="rgba(230,230,220,0.06)"
              strokeWidth="1"
            />
          ))}
          {/* Área */}
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B9A6B" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8B9A6B" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,50 L47,42 L93,48 L140,28 L187,32 L233,18 L280,22 L280,60 L0,60 Z"
            fill="url(#areaGrad)"
          />
          {/* Línea */}
          <path
            d="M0,50 L47,42 L93,48 L140,28 L187,32 L233,18 L280,22"
            fill="none"
            stroke="#8B9A6B"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Puntos */}
          {[
            [0, 50],
            [47, 42],
            [93, 48],
            [140, 28],
            [187, 32],
            [233, 18],
            [280, 22],
          ].map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="3"
              fill="#8B9A6B"
              stroke="#535f52"
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
