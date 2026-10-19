import React, { useState } from "react";
import { useGame } from "../hooks/GameContext";
import { getRoleShort, powerStats } from "../lib/helpers";
import PlayerAvatar from "./PlayerAvatar";

// Team details: squad pool, drag-and-drop Playing XI (owner only) and power rating.
export default function TeamModal({ teamId, onClose }) {
  const { room, catalogById, myTeam, actions, toast } = useGame();
  const team = room.teams.find((t) => t.id === teamId);
  const [over, setOver] = useState(null);
  if (!team) return null;

  const editable = myTeam?.id === team.id && room.status !== "results";
  const xi = team.playingEleven;
  const squad = team.purchased.filter((p) => !xi.includes(p.playerId));
  const xiPlayers = xi.map((id) => team.purchased.find((p) => p.playerId === id)).filter(Boolean);
  const overseasXI = xiPlayers.filter((p) => p.country !== "India").length;
  const pw = powerStats(xi, catalogById);
  const max = room.limits.maxOverseasXI;

  const addToXI = (pid) => {
    if (!editable || xi.includes(pid)) return;
    if (xi.length >= 11) return toast("Playing XI is full!", "error");
    const p = team.purchased.find((x) => x.playerId === pid);
    if (p && p.country !== "India" && overseasXI >= max) return toast(`Max ${max} overseas players in Playing XI!`, "error");
    actions.setXI([...xi, pid]);
  };
  const removeFromXI = (pid) => {
    if (!editable) return;
    actions.setXI(xi.filter((id) => id !== pid));
  };

  const onDrop = (e, target) => {
    e.preventDefault();
    setOver(null);
    const pid = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (Number.isNaN(pid)) return;
    if (target === "p11") addToXI(pid); else removeFromXI(pid);
  };
  const zone = (name) => ({
    onDragOver: (e) => { if (editable) { e.preventDefault(); setOver(name); } },
    onDragLeave: () => setOver((o) => (o === name ? null : o)),
    onDrop: (e) => onDrop(e, name),
  });

  const posLabel = (i) => (i < 3 ? "Top order" : i < 5 ? "Middle order" : i < 7 ? "All-rounder / WK" : "Bowler");
  const card = (p, inXI, idx) => (
    <div
      key={p.playerId}
      className={`draggable-player${inXI ? " p11-card" : ""}`}
      draggable={editable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(p.playerId))}
      onClick={() => (inXI ? removeFromXI(p.playerId) : addToXI(p.playerId))}
      title={editable ? (inXI ? "Click or drag to move back to squad" : "Click or drag into Playing XI") : undefined}
      style={editable ? undefined : { cursor: "default" }}
    >
      {inXI ? <span className="pos-badge" title={posLabel(idx)}>{idx + 1}</span> : <span className="drag-icon">⠿</span>}
      <PlayerAvatar name={p.name} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {p.name}{p.isRetention ? " ⓡ" : ""}{p.isRTM ? " ⚡" : ""}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
          {getRoleShort(p.role)}{p.country !== "India" ? " · ✈ OS" : ""}
        </div>
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--gold)", fontFamily: "var(--font-heading)", flexShrink: 0 }}>
        ₹{p.price.toFixed(2)}
      </div>
    </div>
  );

  return (
    <div id="team-modal" className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content glass-card" style={{ maxWidth: 750 }}>
        <div className="modal-header">
          <h2 id="modal-team-name">{team.full}{team.ownerName ? ` — ${team.ownerName}` : ""}</h2>
          <button id="close-modal" className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="modal-stats">
            <div>Budget Remaining: <span id="modal-budget" className="highlight">₹{team.remaining.toFixed(2)} Cr</span></div>
            <div>Squad Size: <span id="modal-squad-size">{team.purchased.length}</span> players</div>
            {team.ownerId && <div>RTM cards: <span className="highlight">{team.rtmCards}</span></div>}
            <div title="Grade A = 10, Grade B = 6, others = 1, plus real IPL 2026 performance">
              Team Points: <span className="highlight">{team.points.total}</span>
              <small className="pts-detail"> (A×{team.points.gradeA} · B×{team.points.gradeB} · grade {team.points.grade} + IPL {team.points.perf})</small>
            </div>
          </div>

          <div className="team-management-grid">
            <div className="squad-column">
              <h3>Squad Pool</h3>
              <ul id="modal-player-list" className={`purchased-list-modal dropzone${over === "squad" ? " drag-over" : ""}`} {...zone("squad")}>
                {squad.map((p) => card(p, false))}
              </ul>
            </div>
            <div className="playing11-column">
              <h3>Playing XI (<span id="p11-count">{xi.length}</span>/11) <small className="order-note">batting order</small></h3>
              <div className="xi-legend">1–3 top order · 4–6 middle order · 6–7 all-rounders / keeper · 8–11 bowlers (2+ spinners)</div>
              <div id="playing-11-list" className={`playing-11-grid dropzone${over === "p11" ? " drag-over" : ""}`} {...zone("p11")}>
                {xiPlayers.map((p, i) => card(p, true, i))}
              </div>
              {editable && (
                <div className="xi-ai-row">
                  <span className="xi-source">{team.xiSource === "ai" ? "🤖 AI-picked XI" : team.xiSource === "manual" ? "✏️ Edited by you" : "No XI yet"}</span>
                  <button className="btn-small" onClick={actions.aiXI}>🤖 Let AI pick the best XI</button>
                </div>
              )}
              <div className="xi-meta">✈ Overseas in XI: {overseasXI}/{max}{editable ? " · drag or tap players to edit your XI" : ""}</div>

              <div className="team-power-stats glass-panel">
                <h4>Team Power Rating</h4>
                <div className="power-bars">
                  <div className="power-row"><span>Batting</span><div className="progress-bar"><div id="power-bat" style={{ width: `${pw.bat}%` }} /></div></div>
                  <div className="power-row"><span>Bowling</span><div className="progress-bar"><div id="power-bowl" style={{ width: `${pw.bowl}%` }} /></div></div>
                  <div className="power-row"><span>Balance</span><div className="progress-bar"><div id="power-bal" style={{ width: `${pw.balance}%` }} /></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}