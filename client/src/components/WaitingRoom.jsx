import React, { useState } from "react";
import { useGame } from "../hooks/GameContext";
import { avatarFallback } from "../lib/helpers";

// Lobby: share the code, everybody picks a franchise, host starts the game.
export default function WaitingRoom() {
  const { room, you, isHost, actions, toast } = useGame();
  const [copied, setCopied] = useState(false);
  const ready = room.players.filter((p) => p.teamId).length;
  const canStart = ready >= room.minPlayers && ready <= room.maxPlayers;

  const link = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy — select the code and copy it manually.", "error");
    }
  };

  return (
    <div id="team-selection-screen" className="screen">
      <div className="selection-container glass-card waiting-room">
        <div className="room-code-box">
          <span className="rc-label">ROOM CODE</span>
          <div className="rc-code" id="room-code-display">{room.code}</div>
          <div className="rc-actions">
            <button className="btn-small" onClick={() => copy(room.code, "code")}>
              {copied === "code" ? "✅ Copied" : "📋 Copy code"}
            </button>
            <button className="btn-small" onClick={() => copy(link, "link")}>
              {copied === "link" ? "✅ Copied" : "🔗 Copy invite link"}
            </button>
          </div>
        </div>

        <h2>SELECT YOUR FRANCHISE</h2>
        <p>
          Share the code with your friends — {room.minPlayers} to {room.maxPlayers} players. Every
          franchise you pick is yours for the whole auction.
        </p>

        <div className="teams-grid" id="selection-teams-grid">
          {room.teams.map((t) => {
            const mine = t.ownerId === you;
            const taken = t.ownerId && !mine;
            return (
              <button
                key={t.id}
                className={`selection-team-btn${mine ? " mine" : ""}${taken ? " taken" : ""}`}
                style={{ "--team-color": t.color }}
                disabled={!!taken}
                onClick={() => actions.selectTeam(t.id)}
              >
                <img
                  src={`/images/${t.id}.webp`}
                  onError={(e) => { e.currentTarget.src = avatarFallback(t.name, 128); }}
                  alt={t.name}
                />
                <div className="sel-team-name">{t.name}</div>
                <div className="sel-team-full">{t.full}</div>
                {t.ownerId && (
                  <div className={`owner-tag${mine ? " me" : ""}`}>{mine ? "⭐ YOU" : t.ownerName}</div>
                )}
              </button>
            );
          })}
        </div>

        <div className="lobby-players glass-panel">
          <div className="lp-head">
            <span>👥 Players in room</span>
            <span className={`lp-count${canStart ? " ok" : ""}`}>{ready}/{room.maxPlayers} ready</span>
          </div>
          <ul>
            {room.players.map((p) => {
              const team = room.teams.find((t) => t.id === p.teamId);
              return (
                <li key={p.id}>
                  <span className={`dot${p.connected ? "" : " off"}`} />
                  <span className="lp-name">
                    {p.name}{p.id === room.hostId ? " 👑" : ""}{p.id === you ? " (you)" : ""}
                  </span>
                  <span className={`lp-team${team ? ` team-pill ${team.id}-color` : ""}`}>
                    {team ? team.name : "choosing…"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="wr-actions">
          {isHost ? (
            <>
              <button
                id="start-game-btn" className="btn-primary glow-btn" disabled={!canStart}
                onClick={actions.startRetention}
              >
                {canStart ? "🏏 START — GO TO RETENTIONS" : `Need ${room.minPlayers}+ players with a franchise (${ready})`}
              </button>
            </>
          ) : (
            <p className="wr-wait">⏳ Waiting for the host (👑 {room.players.find((p) => p.id === room.hostId)?.name}) to start…</p>
          )}
          <button className="rp-link" onClick={actions.leaveRoom}>Leave room</button>
        </div>
      </div>
    </div>
  );
}
