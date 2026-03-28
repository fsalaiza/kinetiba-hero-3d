import React, { useState, useRef, useEffect } from "react";
import { LOCATIONS, GLITCH_CHARS, GLITCH_CSS, monoFont } from "../utils/constants";

function makeNoiseDataURL() {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() > 0.5 ? 255 : 0;
    img.data[i] = img.data[i+1] = img.data[i+2] = v;
    img.data[i+3] = 40;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

function useScrambleText(target, active, duration = 450) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const resolved = Math.floor(t * target.length);
      let out = '';
      for (let i = 0; i < target.length; i++) {
        if (target[i] === ' ') { out += ' '; continue; }
        if (i < resolved) { out += target[i]; }
        else { out += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]; }
      }
      setDisplay(out);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, active, duration]);

  return display;
}

export default function LocationGlitch({ reducedMotion }) {
  const [idx, setIdx] = useState(0);
  const [glitching, setGlitching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const noiseRef = useRef(null);

  const nextIdx = (idx + 1) % LOCATIONS.length;
  const loc = LOCATIONS[idx];
  const nextLoc = LOCATIONS[nextIdx];

  const cityText = useScrambleText(
    resolving ? nextLoc.city : loc.city,
    resolving
  );
  const coordsText = useScrambleText(
    resolving ? nextLoc.coords : loc.coords,
    resolving
  );

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = GLITCH_CSS;
    document.head.appendChild(style);
    noiseRef.current = makeNoiseDataURL();
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    // When reduced motion is active, show static text — no glitch cycling
    if (reducedMotion) return;

    const interval = setInterval(() => {
      setGlitching(true);
      setResolving(true);
      setTimeout(() => {
        setIdx(prev => (prev + 1) % LOCATIONS.length);
        setGlitching(false);
        setResolving(false);
      }, 450);
    }, 5000);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  const glitchClass = (glitching && !reducedMotion) ? 'loc-glitch-active' : '';
  const noiseOverlay = glitching ? {
    position: 'absolute',
    inset: '-4px -8px',
    backgroundImage: noiseRef.current ? `url(${noiseRef.current})` : 'none',
    backgroundSize: '64px 64px',
    opacity: 0.35,
    pointerEvents: 'none',
    mixBlendMode: 'overlay',
  } : null;

  return (
    <>
      <div style={{ position: 'relative' }}>
        <div className={glitchClass} style={{
          color: "#d4d4c8", fontSize: "clamp(9px, 1vw, 12px)",
          fontFamily: monoFont, letterSpacing: "0.15em",
          textTransform: "uppercase", marginBottom: 12,
        }}>
          {cityText}
        </div>
        {noiseOverlay && <div style={noiseOverlay} />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginLeft: "calc(-1 * clamp(24px, 4vw, 50px))", marginRight: "calc(-1 * clamp(24px, 4vw, 50px))" }}>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, rgba(230,230,220,0.18) 0%, rgba(230,230,220,0.18) 25%, rgba(230,230,220,0) 42%, rgba(230,230,220,0) 58%, rgba(230,230,220,0) 70%, rgba(230,230,220,0.1) 100%)" }} />
        <div style={{
          color: "#c4c4b8", fontSize: "clamp(9px, 1vw, 12px)",
          fontFamily: monoFont, letterSpacing: "0.12em",
          textTransform: "uppercase", paddingLeft: 20,
          paddingRight: "clamp(24px, 4vw, 50px)", whiteSpace: "nowrap",
        }}>
          Scroll to discover ⌄
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <div className={glitchClass} style={{
          color: "#bbbcab", fontSize: "clamp(9px, 1vw, 11px)",
          fontFamily: monoFont, letterSpacing: "0.08em", marginTop: 10,
        }}>
          {coordsText}
        </div>
        {noiseOverlay && <div style={noiseOverlay} />}
      </div>
    </>
  );
}
