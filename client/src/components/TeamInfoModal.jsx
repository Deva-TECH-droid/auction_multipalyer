import React from "react";
import Modal from "./Modal";
import { TEAM_DETAILS } from "../data/staticData";

export default function TeamInfoModal({ team, onClose }) {
  const d = TEAM_DETAILS[team.id];
  if (!d) return null;
  return (
    <Modal id="team-info-modal" title={team.full} onClose={onClose}>
      <div className="info-grid">
        <div className="info-item"><span className="info-label">Head Coach</span><span className="info-value">{d.coach}</span></div>
        <div className="info-item"><span className="info-label">Assistant Coach</span><span className="info-value">{d.assistant}</span></div>
        <div className="info-item"><span className="info-label">Batting Coach</span><span className="info-value">{d.batting}</span></div>
        <div className="info-item"><span className="info-label">Bowling Coach</span><span className="info-value">{d.bowling}</span></div>
        <div className="info-item" style={{ gridColumn: "span 2" }}><span className="info-label">Owner</span><span className="info-value">{d.owner}</span></div>
        <div className="info-item" style={{ gridColumn: "span 2" }}>
          <span className="info-label">IPL Championship Years</span>
          <div className="history-list">
            {d.wins.length === 0 ? (
              <div className="info-value" style={{ color: "var(--text-dim)" }}>No IPL titles yet</div>
            ) : (
              <>
                <div className="history-item">🏆 {d.wins.join("  ·  ")}</div>
                <div style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginTop: 4 }}>
                  {d.wins.length} Championship{d.wins.length > 1 ? "s" : ""}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
