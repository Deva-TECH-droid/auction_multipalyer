import React, { useState } from "react";
import { useGame } from "../hooks/GameContext";

export default function RoomPicker() {
  const { name, conn, rejoining, actions } = useGame();
  const initial = new URLSearchParams(window.location.search).get("room") || "";
  const [code, setCode] = useState(initial.toUpperCase().slice(0, 5));
  const online = conn === "online";

  return (
    <div id="room-screen" className="screen active">
      <div className="login-container glass-card room-picker">
        <div className="ipl-badge">🏏 WELCOME, {name.toUpperCase()}</div>
        <h1 className="logo-text rp-title">CHOOSE YOUR <span className="highlight">ARENA</span></h1>

        {rejoining ? (
          <p className="subtitle">Reconnecting to your room…</p>
        ) : (
          <>
            <p className="subtitle">Host a new auction or join your friends</p>
            <button className="btn-primary glow-btn" disabled={!online} onClick={() => actions.createRoom(name)}>
              {online ? "🏟️ CREATE AUCTION ROOM" : "Connecting to server…"}
            </button>

            <div className="rp-divider"><span>OR JOIN WITH A CODE</span></div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length === 5) actions.joinRoom(code, name);
              }}
            >
              <div className="input-group">
                <span className="input-icon">🔑</span>
                <input
                  type="text" id="room-code-input" placeholder="ROOM CODE" maxLength={5}
                  autoComplete="off" value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  className="code-input"
                />
              </div>
              <button type="submit" className="btn-primary glow-btn rp-join" disabled={!online || code.length !== 5}>
                ⚡ JOIN ROOM
              </button>
            </form>
          </>
        )}
        <button className="rp-link" onClick={actions.logout}>Not {name}? Change name</button>
      </div>
      <div className="bg-animation" />
    </div>
  );
}
