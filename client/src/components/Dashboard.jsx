import React, { useState } from "react";
import { CATEGORY_LABEL, useGame } from "../hooks/GameContext";
import AuctionCard from "./AuctionCard";
import PlayerPool from "./PlayerPool";
import TeamsPanel from "./TeamsPanel";
import TeamModal from "./TeamModal";
import ResultsBoard, { EndedPanel } from "./Results";
import Celebration from "./Celebration";
import NewsModal from "./NewsModal";
import ScheduleModal from "./ScheduleModal";
import SquadsModal from "./SquadsModal";

// Main auction screen — same 3-column layout as the original #dashboard-screen.
export default function Dashboard() {
  const { room, you, myTeam, isHost, actions, toast, celebrating, setCelebrating, catalogById } = useGame();
  const [teamId, setTeamId] = useState(null);
  const [modal, setModal] = useState(null); // news | schedule | squads
  const [copied, setCopied] = useState(false);

  const a = room.auction;
  const live = room.status === "auction";
  const winner = room.results?.rankings.find((r) => r.teamId === room.results.winnerTeamId);
  const me = room.players.find((p) => p.id === you);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast(`Room code: ${room.code}`, "info"); }
  };

  const endAuction = () => {
    const done = a.phase === "complete";
    const msg = done
      ? "End the auction? AI will pick the strongest Playing XI for every team (you can edit it afterwards)."
      : "End the auction now? Remaining players stay unsold and AI will pick the strongest Playing XI from what each team has bought.";
    if (window.confirm(msg)) actions.endAuction();
  };

  const leave = () => {
    if (window.confirm("Leave the auction? Your franchise stays reserved — you can rejoin from this device with the same room code.")) {
      actions.logout();
    }
  };

  return (
    <div id="dashboard-screen" className="screen">
      <header className="top-bar">
        <div className="logo-area">
          <img src="/images/ipl.webp" className="header-logo" alt="IPL" />
          <div className="logo-mini">IPL 2026</div>
          <button className="room-chip" onClick={copyCode} title="Copy room code">
            {copied ? "✅ COPIED" : `ROOM ${room.code}`}
          </button>
        </div>

        <div className="sold-players-marquee">
          <div className="marquee-content" id="sold-players-rail">
            {room.soldLog.length === 0 && (
              <span className="sold-item-placeholder">🏏 Auction Live — Sold Players will appear here...</span>
            )}
            {room.soldLog.map((s, i) => (
              <span key={`${s.name}-${i}`} className={`sold-item ${s.teamId}-color`}>
                🔨 <strong>{s.name}</strong>
                <span style={{ color: "var(--gold)", margin: "0 4px" }}>₹{s.price.toFixed(2)} Cr</span>
                → {s.teamName}
                <span style={{ opacity: 0.4, margin: "0 15px" }}>|</span>
              </span>
            ))}
          </div>
        </div>

        <div className="user-profile">
          <button
            id="news-btn" className="btn-small" onClick={() => setModal("news")}
            style={{ background: "linear-gradient(135deg, rgba(0,229,255,0.1), rgba(0,229,255,0.05))", borderColor: "rgba(0,229,255,0.3)", color: "var(--accent)" }}
          >
            📰 IPL 2026 News
          </button>
          <span id="user-display">{me?.name}{myTeam ? ` (${myTeam.name})` : ""}</span>
          <button id="logout-btn" className="btn-small" onClick={leave}>Logout</button>
        </div>
      </header>

      <div className="content-grid">
        <PlayerPool />

        <section className="panel-stage">
          {live && <AuctionCard />}
          {room.status === "ended" && <EndedPanel onOpenTeam={setTeamId} />}
          {room.status === "results" && <ResultsBoard onOpenTeam={setTeamId} />}

          {isHost && live && (
            <div className="host-bar glass-panel">
              <span className="host-label">👑 HOST</span>
              {a.phase === "bidding" && (
                <button className="btn-small" onClick={() => actions.pause(!a.paused)}>
                  {a.paused ? "▶ Resume" : "⏸ Pause"}
                </button>
              )}
              {a.phase === "intro" && (
                <button className="btn-small" onClick={actions.skip}>⏭ Skip intro</button>
              )}
              {(a.phase === "bidding" || a.phase === "rtm") && (
                <button className="btn-small" onClick={actions.skip}>⏭ Force finalize</button>
              )}
              <button className={`btn-small danger${a.phase === "complete" ? " pulse-btn" : ""}`} onClick={endAuction}>⏹ End Auction{a.phase === "complete" ? " → AI picks XI" : ""}</button>
              {a.phase !== "complete" && (
              <div className="cat-switch">
                <span className="host-label">SWITCH GROUP</span>
                {a.sets.map((s) => (
                  <button
                    key={s.id}
                    className={`cat-btn${a.currentSet === s.id ? " active" : ""}`}
                    disabled={s.remaining === 0}
                    onClick={() => actions.setCategory(s.id)}
                    title={s.remaining === 0 ? "Group finished" : `${s.remaining} players left`}
                  >
                    {CATEGORY_LABEL[s.id] || s.id} <b>{s.remaining}</b>
                  </button>
                ))}
              </div>
              )}
              <span className="host-progress">{a.queueRemaining} left in queue</span>
            </div>
          )}
        </section>

        <TeamsPanel onOpenTeam={setTeamId} />
      </div>

      {celebrating && winner && <Celebration winner={winner} squad={winner.xi.map((id) => catalogById[id]).filter(Boolean)} onClose={() => setCelebrating(false)} />}
      {teamId && <TeamModal teamId={teamId} onClose={() => setTeamId(null)} />}
      {modal === "news" && (
        <NewsModal
          onClose={() => setModal(null)}
          onOpenSchedule={() => setModal("schedule")}
          onOpenSquads={() => setModal("squads")}
        />
      )}
      {modal === "schedule" && <ScheduleModal onClose={() => setModal(null)} />}
      {modal === "squads" && <SquadsModal onClose={() => setModal(null)} />}
    </div>
  );
}