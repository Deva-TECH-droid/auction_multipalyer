import React, { useState } from "react";
import Modal from "./Modal";
import { IPL_2026_SQUADS, TEAMS_CONFIG, TEAM_DETAILS } from "../data/staticData";
import { avatarFallback } from "../lib/helpers";

const GROUPS = [
  { id: "batter", label: "🏏 Batters" },
  { id: "wk", label: "🧤 Wicketkeepers" },
  { id: "allrounder", label: "🔄 All-Rounders" },
  { id: "bowler", label: "⚡ Bowlers" },
];

export default function SquadsModal({ onClose }) {
  const ids = Object.keys(IPL_2026_SQUADS);
  const [active, setActive] = useState(ids[0]);
  const players = IPL_2026_SQUADS[active] || [];
  const details = TEAM_DETAILS[active];
  const cfg = TEAMS_CONFIG.find((t) => t.id === active);

  return (
    <Modal
      id="squads-modal" onClose={onClose}
      title={<><span className="highlight">IPL 2026</span> — FINALIZED SQUADS</>}
      wide={980} style={{ maxHeight: "92vh", overflowY: "auto" }}
    >
      <div className="squad-filter-bar" id="squad-filter-bar">
        {ids.map((id) => (
          <button
            key={id} className={`squad-filter-btn${active === id ? " active" : ""}`}
            onClick={() => setActive(id)}
          >
            {TEAMS_CONFIG.find((t) => t.id === id)?.name || id.toUpperCase()}
          </button>
        ))}
      </div>
      <div id="squad-display-area" className="glass-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 16 }}>
          <img
            src={`/images/${active}.webp`}
            onError={(e) => { e.currentTarget.src = avatarFallback(cfg?.name || active, 64); }}
            style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} alt=""
          />
          <div>
            <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.1rem", fontWeight: 900, letterSpacing: 2 }}>
              {cfg?.full || active.toUpperCase()}
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginTop: 2 }}>
              Coach: {details?.coach || "—"} · Owner: {details?.owner?.split(",")[0] || "—"}
            </div>
          </div>
        </div>

        {GROUPS.map((g) => {
          const inGroup = players
            .filter((p) => p.role === g.id)
            .sort((a, b) => (b.isCaptain ? 1 : 0) - (a.isCaptain ? 1 : 0) || (b.isViceCaptain ? 1 : 0) - (a.isViceCaptain ? 1 : 0));
          if (!inGroup.length) return null;
          return (
            <div className="squad-role-group" key={g.id}>
              <div className="squad-role-title">{g.label} ({inGroup.length})</div>
              <div className="squad-role-grid">
                {inGroup.map((p) => (
                  <div key={p.name} className={`squad-card${p.isCaptain || p.isViceCaptain ? " leadership-highlight" : ""}`}>
                    <div className="squad-player-info">
                      <div className="squad-player-name">
                        {p.name}
                        {p.isCaptain && <span style={{ color: "var(--gold)", fontSize: "0.75rem", fontFamily: "var(--font-heading)" }}> (C)</span>}
                        {!p.isCaptain && p.isViceCaptain && <span style={{ color: "#c0c0c0", fontSize: "0.75rem", fontFamily: "var(--font-heading)" }}> (VC)</span>}
                      </div>
                      <div className="squad-player-meta">{p.price}</div>
                    </div>
                    <span className={`role-badge role-${p.role}`}>
                      {p.role === "allrounder" ? "AR" : p.role.substring(0, 4).toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
