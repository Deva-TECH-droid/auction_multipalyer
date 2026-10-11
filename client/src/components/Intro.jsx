import React, { useEffect, useState } from "react";
import { playIPLThemeFor } from "../lib/audio";

// Same timing as the original: 3.5s of animation, 1.2s fade-out.
export default function Intro({ onDone }) {
  const [fade, setFade] = useState(false);
  useEffect(() => {
    playIPLThemeFor(10000); // IPL theme: first 10 seconds only
  }, []);
  useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 3500);
    const t2 = setTimeout(onDone, 4700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  return (
    <div id="intro-screen" className={`screen${fade ? " fade-out" : ""}`}>
      <div className="intro-content">
        <div className="ring" style={{ animationDelay: "0s" }} />
        <div className="ring" style={{ animationDelay: "1.3s" }} />
        <div className="ring" style={{ animationDelay: "2.6s" }} />
        <img src="/images/ipl.webp" alt="IPL Logo" className="intro-logo" />
        <h1 className="intro-text">IPL 2026</h1>
        <p className="intro-subtitle">MEGA AUCTION · MULTIPLAYER</p>
      </div>
    </div>
  );
}