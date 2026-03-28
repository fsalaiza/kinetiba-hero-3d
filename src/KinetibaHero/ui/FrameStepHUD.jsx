import React from "react";
import { monoFont } from "../utils/constants";

export default function FrameStepHUD({ progress, frameStepPx }) {
  return (
    <div
      style={{
        position: "fixed",
        right: 14,
        bottom: 14,
        zIndex: 20,
        pointerEvents: "none",
        background: "rgba(0,0,0,0.4)",
        color: "#f0f0e8",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 8,
        padding: "8px 10px",
        fontFamily: monoFont,
        fontSize: 10,
        letterSpacing: "0.04em",
        lineHeight: 1.5,
        textTransform: "uppercase",
      }}
    >
      <div>{`Progress: ${(progress * 100).toFixed(2)}%`}</div>
      <div>{`Step: ${frameStepPx}px`}</div>
      <div>[ / ] prev-next</div>
      <div>- / + step size</div>
    </div>
  );
}
