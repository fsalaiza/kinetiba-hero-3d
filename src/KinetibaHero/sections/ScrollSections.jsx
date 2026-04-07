import React from "react";
import BiSection from "./BiSection";
import WhatsAppSection from "./WhatsAppSection";
import ErpSection from "./ErpSection";
import CtaSection from "./CtaSection";

const sectionStyle = {
  height: "100vh",
  display: "flex",
  alignItems: "center",
  position: "relative",
};

export default function ScrollSections({ scrollProgress, onCtaClick }) {
  return (
    <div
      id="scroll-container"
      style={{
        position: "relative",
        zIndex: 3,
        pointerEvents: "none",
      }}
    >
      {/* [S0] HERO */}
      <div style={{ height: "100vh" }} />

      {/* [S1] ZOOM-IN */}
      <div style={{ height: "60vh" }} />

      {/* [S2] BI */}
      <BiSection scrollProgress={scrollProgress} sectionStyle={sectionStyle} />

      {/* [S3] WHATSAPP */}
      <WhatsAppSection scrollProgress={scrollProgress} sectionStyle={sectionStyle} />

      {/* [S4] ERP */}
      <ErpSection scrollProgress={scrollProgress} sectionStyle={sectionStyle} />

      {/* [S5] CTA */}
      <CtaSection scrollProgress={scrollProgress} sectionStyle={sectionStyle} onCtaClick={onCtaClick} />
    </div>
  );
}
