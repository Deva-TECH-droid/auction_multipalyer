import React, { useState } from "react";
import { useGame } from "../hooks/GameContext";
import Modal from "./Modal";
import TeamInfoModal from "./TeamInfoModal";
import { avatarFallback } from "../lib/helpers";

// Retention phase: each owner keeps up to 2 of last season's players for their own franchise.
export default function Retention() {
  const { room, you, myTeam, isHost, catalog, actions, toast } = useGame();
  const [editing, setEditing] = useState(false);
  const [infoTeam, setInfoTeam] = useState(null);

  const me = room.players.find((p) => p.id === you);
  const locked = !!me?.retentionLocked;
  const lockedCount = room.players.filter((p) => p.retentionLocked).length;
  const allLocked = lockedCount === room.players.length;
  const max = room.limits.maxRetentions;

  const startAuction = () => {
    if (!allLocked) {
      const names = room.players.filter((p) => !p.retentionLocked).map((p) => p.name).join(", ");
      if (!window.confirm(`${names} haven't locked retentions yet. Start the auction anyway?`)) return;
      actions.startAuction(true);
    } else {
      actions.startAuction(false);
    }
  };

  return (
    <div id="retention-screen" className="screen">
      <header className="top-bar glass-panel">
        <div className="logo-mini">🏏 RETENTION PHASE · {room.code}</div>
        <div className="ret-actions">
          <span className="ret-progress">🔒 {lockedCount}/{room.players.length} locked</span>
          <button
            className="btn-small"
            onClick={() => actions.lockRetentions(!locked)}
          >
            {locked ? "✏️ Edit my retentions" : "🔒 Lock my retentions"}
          </button>
          {isHost && (
            <button id="finish-retention-btn" className="btn-primary" onClick={startAuction}>
              Start Auction &rarr;
            </button>
          )}
        </div>
      </header>

      <div className="section-header">
        <h2>SELECT RETENTIONS</h2>
        <p>
          Each franchise can retain up to {max} players from last season. The price you set is
          deducted from your ₹100 Cr purse.{" "}
          {!isHost && "The host starts the auction once everyone has locked in."}
        </p>
      </div>

      <div className="retention-container">
        <div className="teams-grid" id="retention-teams-grid">
          {room.teams.map((t) => {
            const retained = t.purchased.filter((p) => p.isRetention);
            const isMine = myTeam?.id === t.id;
            const owner = room.players.find((p) => p.id === t.ownerId);
            return (
              <div
                key={t.id}
                className={`retention-card team-${t.id}${isMine ? " mine" : ""}${t.ownerId ? "" : " unowned"}`}
                onClick={() => { if (isMine && !locked) setEditing(true); else if (isMine) toast("Unlock to edit your retentions.", "info"); }}
              >
                <div className="team-header" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <img
                    src={`/images/${t.id}.webp`}
                    onError={(e) => { e.currentTarget.src = avatarFallback(t.name); }}
                    className="team-logo-sm" alt={t.name}
                  />
                  <div>
                    <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.9rem", letterSpacing: 1 }}>
                      {t.name}{isMine ? " ⭐" : ""}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      {t.ownerId ? `${t.ownerName}${owner?.retentionLocked ? " · 🔒" : ""}` : "No owner — players go to the pool"}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", fontFamily: "var(--font-heading)", color: "var(--accent3)", fontSize: "0.82rem" }}>
                    ₹{t.remaining.toFixed(2)} Cr
                  </div>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: 8 }}>
                  Retained: {retained.length}/{max}
                </div>
                <div className="retention-player-preview">
                  {retained.length === 0 ? (
                    <span style={{ color: "var(--text-dim)", fontStyle: "italic", fontSize: "0.8rem" }}>
                      {t.ownerId ? "No retentions yet" : "—"}
                    </span>
                  ) : (
                    retained.map((p) => (
                      <div className="retained-item" key={p.playerId}>✅ {p.name} — ₹{p.price} Cr</div>
                    ))
                  )}
                </div>
                {isMine && !locked && <div className="ret-hint">Tap to choose retentions</div>}
                <button className="team-info-btn" onClick={(e) => { e.stopPropagation(); setInfoTeam(t); }}>ℹ Info</button>
              </div>
            );
          })}
        </div>
      </div>

      {editing && myTeam && (
        <RetentionModal
          team={myTeam} catalog={catalog} max={max}
          onClose={() => setEditing(false)}
          onSave={(picks) => { actions.setRetentions(picks); setEditing(false); }}
          toast={toast}
        />
      )}
      {infoTeam && <TeamInfoModal team={infoTeam} onClose={() => setInfoTeam(null)} />}
    </div>
  );
}

function RetentionModal({ team, catalog, max, onClose, onSave, toast }) {
  const candidates = catalog.filter((p) => p.lastTeam === team.id);
  const [sel, setSel] = useState(() => {
    const m = {};
    team.purchased.filter((p) => p.isRetention).forEach((p) => { m[p.playerId] = p.price; });
    return m;
  });

  const toggle = (p) => {
    setSel((s) => {
      const n = { ...s };
      if (n[p.id] !== undefined) delete n[p.id];
      else if (Object.keys(n).length >= max) { toast(`Can only retain ${max} player(s)!`, "error"); return s; }
      else n[p.id] = p.base;
      return n;
    });
  };
  const total = Object.values(sel).reduce((a, b) => a + Number(b || 0), 0);

  return (
    <div id="retention-modal" className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content glass-card">
        <div className="modal-header">
          <h2 id="ret-modal-team-name">Retain for {team.full}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p className="info-text">
            Select up to {max} players from your previous season roster. Their salary will be deducted from your ₹100 Cr purse.
          </p>
          <ul className="scrollable-list retention-candidates-list" style={{ height: 300 }}>
            {candidates.length === 0 && (
              <li style={{ textAlign: "center", padding: 20, color: "var(--text-dim)", fontStyle: "italic" }}>
                No eligible players from last season.
              </li>
            )}
            {candidates.map((p) => {
              const on = sel[p.id] !== undefined;
              return (
                <li key={p.id} className={`candidate-item${on ? " selected" : ""}`}>
                  <input type="checkbox" id={`ret-cb-${p.id}`} checked={on} onChange={() => toggle(p)} />
                  <label htmlFor={`ret-cb-${p.id}`} style={{ flex: 1, cursor: "pointer" }}>
                    <strong>{p.name}</strong>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginLeft: 6 }}>{p.role} · {p.country}</span>
                  </label>
                  <span className="candidate-cost">
                    ₹
                    <input
                      type="number" step="0.25" min={p.base} disabled={!on}
                      value={on ? sel[p.id] : p.base}
                      onChange={(e) => setSel((s) => ({ ...s, [p.id]: e.target.value }))}
                      style={{
                        width: 60, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)",
                        color: "#fff", borderRadius: 5, padding: "2px 6px", fontSize: "0.85rem",
                      }}
                    />{" "}
                    Cr
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="modal-footer">
            <span className="ret-total">Total: ₹{total.toFixed(2)} Cr</span>
            <button
              id="save-retention-btn"
              onClick={() => onSave(Object.entries(sel).map(([playerId, price]) => ({ playerId: Number(playerId), price: Number(price) })))}
            >
              💾 SAVE RETENTIONS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
