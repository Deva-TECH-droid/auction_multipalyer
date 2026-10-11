import React from "react";
import { useGame } from "../hooks/GameContext";
import { avatarFallback } from "../lib/helpers";

export function Toasts() {
  const { toasts } = useGame();
  return (
    <div id="toast-box">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}${t.fading ? " fade-out" : ""}`}>{t.msg}</div>
      ))}
    </div>
  );
}

// "🎵 Team Anthem playing for ..." pill (same markup as playTeamThemeWithBanner)
export function SongBanner() {
  const { songBanner, room } = useGame();
  const team = songBanner && room?.teams.find((t) => t.id === songBanner.teamId);
  const color = team?.color || "#fff";
  return (
    <div
      id="team-song-banner"
      className={`team-song-banner${songBanner ? " show" : ""}`}
      style={songBanner ? { borderLeft: `3px solid ${color}` } : undefined}
    >
      {songBanner && (
        <>
          <div className="song-wave"><span /><span /><span /><span /><span /></div>
          <img
            src={`/images/${songBanner.teamId}.webp`}
            onError={(e) => { e.currentTarget.src = avatarFallback(songBanner.teamName, 32); }}
            style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "contain", background: "rgba(255,255,255,0.1)" }}
            alt=""
          />
          <span style={{ color, fontWeight: 900 }}>{songBanner.teamName}</span>
          <span style={{ color: "var(--text-dim)", fontSize: "0.72rem", fontFamily: "var(--font-display)" }}>
            🎵 Team Anthem playing for {songBanner.playerName}
          </span>
        </>
      )}
    </div>
  );
}
