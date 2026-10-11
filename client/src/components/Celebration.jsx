import React, { useEffect, useRef, useState } from "react";
import { pauseCelebration, playWinnerTheme, setCelebrationVolume, startCrowd, stopCelebration } from "../lib/audio";
import PlayerAvatar from "./PlayerAvatar";

// Bright accent colour per franchise (the official colours of GT/KKR/LSG are too dark for glow).
export const GLOW = {
  csk: "#FFD400", mi: "#2E9BFF", rcb: "#FF3B3B", kkr: "#A66BFF", gt: "#4FC3F7",
  lsg: "#5BB8FF", rr: "#FF4FA3", srh: "#FF8A2B", dc: "#2D9CFF", pbks: "#FF3B47",
};

const MARK_LABELS = [
  ["batting", "Batting"], ["spin", "Spin"], ["pace", "Pace"],
  ["overseas", "Overseas"], ["balance", "Balance"], ["middle", "Middle order"],
];

// Fireworks + confetti on a full-screen canvas.
function useFireworks(canvasRef, color, active) {
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !active) return undefined;
    const ctx = cv.getContext("2d");
    let w = (cv.width = window.innerWidth);
    let h = (cv.height = window.innerHeight);
    const onResize = () => { w = cv.width = window.innerWidth; h = cv.height = window.innerHeight; };
    window.addEventListener("resize", onResize);

    const palette = [color, "#ffffff", "#FFD700", color, "#ff6ec7"];
    let sparks = [];
    let confetti = [];
    let raf;
    let last = performance.now();
    let nextBurst = 0;

    const burst = (x, y) => {
      const c = palette[Math.floor(Math.random() * palette.length)];
      const n = 70 + Math.floor(Math.random() * 40);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const sp = 2 + Math.random() * 5.5;
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.008 + Math.random() * 0.012, c, r: 1.5 + Math.random() * 2 });
      }
    };
    const dropConfetti = () => {
      for (let i = 0; i < 3; i++) {
        confetti.push({
          x: Math.random() * w, y: -20, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 8, h: 10 + Math.random() * 10,
          c: palette[Math.floor(Math.random() * palette.length)],
        });
      }
    };

    const frame = (t) => {
      const dt = Math.min(2, (t - last) / 16.67);
      last = t;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      if (t > nextBurst) {
        burst(w * (0.1 + Math.random() * 0.8), h * (0.12 + Math.random() * 0.4));
        nextBurst = t + 380 + Math.random() * 520;
      }
      dropConfetti();

      sparks = sparks.filter((p) => p.life > 0);
      for (const p of sparks) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.07 * dt; p.vx *= 0.992; p.life -= p.decay * dt;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      confetti = confetti.filter((c) => c.y < h + 30);
      for (const c of confetti) {
        c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
        ctx.save(); ctx.globalAlpha = 0.9; ctx.translate(c.x, c.y); ctx.rotate(c.rot);
        ctx.fillStyle = c.c; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [canvasRef, color, active]);
}

export default function Celebration({ winner, squad = [], onClose }) {
  const [stage, setStage] = useState("suspense"); // suspense -> reveal
  const [paused, setPaused] = useState(false);
  const [vol, setVol] = useState(1);
  const canvasRef = useRef(null);
  const glow = GLOW[winner.teamId] || "#FFD700";
  const logo = `/images/${winner.teamId}.webp`;

  useFireworks(canvasRef, glow, stage === "reveal");

  useEffect(() => {
    startCrowd(); // crowd shouting while the suspense builds
    const t = setTimeout(() => { setStage("reveal"); playWinnerTheme(winner.teamId); }, 3800);
    return () => { clearTimeout(t); stopCelebration(); };
  }, [winner.teamId]);

  const letters = "CHAMPIONS".split("");
  const faces = ["front", "back", "right", "left", "top", "bottom"];

  return (
    <div className={`cele-root ${stage}`} style={{ "--glow": glow }}>
      <canvas ref={canvasRef} className="cele-canvas" />
      <div className="cele-beams" />
      <div className="cele-floor" />

      {stage === "suspense" ? (
        <div className="cele-suspense">
          <div className="cele-drum">AND THE WINNER IS</div>
          <div className="cele-dots"><span>●</span><span>●</span><span>●</span></div>
        </div>
      ) : (
        <>
          <div className="cele-flash" />
          <div className="cele-stage">
            <div className="cele-scene">
              <div className="cele-orbit">
                {Array.from({ length: 14 }).map((_, i) => (
                  <span key={i} className="cele-star" style={{ "--a": `${(360 / 14) * i}deg` }}>{i % 2 ? "⭐" : "🏏"}</span>
                ))}
              </div>
              <div className="cele-cube">
                {faces.map((f) => (
                  <div key={f} className={`cele-face ${f}`}>
                    <img src={logo} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  </div>
                ))}
              </div>
              <div className="cele-trophy">🏆</div>
            </div>

            <h1 className="cele-title" aria-label="Champions">
              {letters.map((l, i) => (
                <span key={i} style={{ animationDelay: `${0.25 + i * 0.08}s` }}>{l}</span>
              ))}
            </h1>

            <div className="cele-team">{winner.teamFull}</div>
            <div className="cele-owner">👑 {winner.ownerName} 👑</div>
            <div className="cele-score">{winner.total.toFixed(1)}<small> / 30</small></div>

            <div className="cele-marks">
              {MARK_LABELS.map(([k, label]) => (
                <div key={k} className="cele-mark">
                  <span>{label}</span>
                  <div className="cele-bar"><i style={{ width: `${(winner.marks[k] / 5) * 100}%` }} /></div>
                  <b>{winner.marks[k].toFixed(1)}</b>
                </div>
              ))}
            </div>

            {squad.length > 0 && (
              <div className="cele-squad">
                {squad.map((p) => (
                  <div key={p.id} className="cele-player">
                    <PlayerAvatar name={p.name} size={54} />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="cele-btn" onClick={onClose}>📊 VIEW FULL SCORECARD</button>
          </div>
        </>
      )}
      <div className="cele-audio">
        <button onClick={() => { pauseCelebration(!paused); setPaused(!paused); }} title={paused ? "Play" : "Pause"}>{paused ? "▶" : "⏸"}</button>
        <button onClick={() => { const v = vol === 0 ? 1 : 0; setVol(v); setCelebrationVolume(v); }} title="Mute">{vol === 0 ? "🔇" : "🔊"}</button>
        <input type="range" min="0" max="1" step="0.05" value={vol} onChange={(e) => { const v = Number(e.target.value); setVol(v); setCelebrationVolume(v); }} />
      </div>
      {stage === "suspense" && <button className="cele-skip" onClick={() => { setStage("reveal"); playWinnerTheme(winner.teamId); }}>skip ▶</button>}
    </div>
  );
}