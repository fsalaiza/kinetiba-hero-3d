import React from "react";
import BiSection from "./BiSection";
import WhatsAppSection from "./WhatsAppSection";
import ErpSection from "./ErpSection";
import AgentSection from "./AgentSection";
import CtaSection from "./CtaSection";

const sectionStyle = {
  height: "100vh",
  display: "flex",
  alignItems: "center",
  position: "relative",
};

export default function ScrollSections({ scrollProgress, onCtaClick }) {
  return (
    <div id="scroll-container" style={{ position: "relative", zIndex: 3, pointerEvents: "none" }}>
      <div style={{ height: "100vh" }} />
      <div style={{ height: "60vh" }} />
      <BiSection scrollProgress={scrollProgress} sectionStyle={sectionStyle} />
      <WhatsAppSection scrollProgress={scrollProgress} sectionStyle={sectionStyle} />
      <ErpSection scrollProgress={scrollProgress} sectionStyle={sectionStyle} />
      <AgentSection scrollProgress={scrollProgress} sectionStyle={sectionStyle} />
      <CtaSection scrollProgress={scrollProgress} sectionStyle={sectionStyle} onCtaClick={onCtaClick} />
    </div>
  );
}
