import React from "react";

const SECTIONS = ["BI", "WA", "ERP", "AGT", "CTA"];

const navStyles = `
.kba-nav-dots { position: fixed; right: clamp(16px, 2vw, 28px); bottom: 50%; transform: translateY(50%); z-index: 10; display: flex; flex-direction: column; gap: 12px; pointer-events: auto; }
.kba-nav-dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid rgba(230,230,220,0.3); background: transparent; transition: all 0.2s ease; }
.kba-nav-dot:hover { border-color: rgba(230,230,220,0.6); }
.kba-nav-dot.active { background: rgba(230,230,220,0.7); border-color: rgba(230,230,220,0.7); }

.kba-nav-icons { position: fixed; left: clamp(16px, 2vw, 28px); bottom: clamp(16px, 2vw, 28px); z-index: 10; display: flex; gap: 10px; align-items: center; pointer-events: auto; }
.kba-nav-icon { width: 28px; height: 28px; border-radius: 4px; border: 1px solid rgba(230,230,220,0.15); background: rgba(230,230,220,0.05); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); transition: all 0.2s ease; }
.kba-nav-icon.active { border-color: rgba(230,230,220,0.4); background: rgba(230,230,220,0.12); }
.kba-nav-icon span { color: rgba(230,230,220,0.5); font-size: 8px; font-family: monospace; font-weight: 600; letter-spacing: 0.05em; }
.kba-nav-icon.active span { color: rgba(230,230,220,0.85); }
`;

function getActiveSection(p) {
  if (p < 0.15) return -1;
  if (p < 0.34) return 0;  // BI
  if (p < 0.50) return 1;  // WA
  if (p < 0.84) return 2;  // ERP
  if (p < 0.86) return 3;  // AGT
  return 4;                  // CTA
}

export default function SectionNav({ scrollProgress }) {
  const active = getActiveSection(scrollProgress);
  return (
    <>
      <style>{navStyles}</style>
      <div className="kba-nav-dots" style={{ opacity: active >= 0 ? 1 : 0, transition: "opacity 0.3s" }}>
        {SECTIONS.map((_, i) => <button key={i} className={`kba-nav-dot${active === i ? " active" : ""}`} aria-label={`Sección ${SECTIONS[i]}`} />)}
      </div>
      <div className="kba-nav-icons" style={{ opacity: active >= 0 ? 1 : 0, transition: "opacity 0.3s" }}>
        {SECTIONS.map((label, i) => (
          <div key={i} className={`kba-nav-icon${active === i ? " active" : ""}`}><span>{label}</span></div>
        ))}
      </div>
    </>
  );
}
