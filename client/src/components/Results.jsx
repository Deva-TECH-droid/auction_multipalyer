import React, { useState } from "react";
import { useGame } from "../hooks/GameContext";

const COLS = [
  ["batting", "BAT"], ["spin", "SPIN"], ["pace", "FAST"],
  ["overseas", "OS"], ["balance", "BAL"], ["middle", "MID"],
];

// Shown when every franchise has 15 players: set the XI, then the host reveals the result.
export function EndedPanel({ onOpenTeam }) {
  const { room, myTeam, isHost, actions } = useGame();
  const owned = room.teams.filter((t) => t.ownerId);
  const min = room.limits.minSquad;
  return (
    <div id="ended-state" className="welcome-box glass-card results-box">
      <span className="cricket-icon">🏁</span>
      <h2>AUCTION FINISHED</h2>
      <p>
        The auction is over and <b>AI has picked the strongest Playing XI</b> for every franchise from its own players. You can still edit yours (or ask AI again) — the result is judged on it
        (batting, spin, pace, overseas, balance and middle order — 30 marks).
      </p>
      <ul className="squad-status">
        {owned.map((t) => (
          <li key={t.id}>
            <span className={`team-pill ${t.id}-color`}>{t.name}</span>
            <span className="ss-owner">{t.ownerName}</span>
            <span className={`ss-count${t.purchased.length >= min ? " ok" : ""}`}>{t.purchased.length} players</span>
            <span className="ss-xi">XI {t.playingEleven.length}/11</span>
          </li>
        ))}
      </ul>
      <div className="ended-actions">
        {myTeam && <button className="btn-small" onClick={() => onOpenTeam(myTeam.id)}>🏏 Set my Playing XI</button>}
        {isHost ? (
          <button id="show-result-btn" className="btn-primary glow-btn" onClick={actions.showResults}>🏆 SHOW RESULT</button>
        ) : (
          <p className="wr-wait">⏳ Waiting for the host to reveal the result…</p>
        )}
      </div>
    </div>
  );
}

// Final 30-mark scorecard.
export default function ResultsBoard({ onOpenTeam }) {
  const { room, myTeam, setCelebrating } = useGame();
  const [open, setOpen] = useState(null);
  const res = room.results;
  if (!res) return null;

  return (
    <div id="results-state" className="welcome-box glass-card results-box wide">
      <span className="cricket-icon">🏆</span>
      <h2>FINAL RESULT</h2>
      <p>Each Playing XI is marked out of 30 — 5 each for batting, spin, fast bowling, overseas players, team balance and middle order.</p>
      <button className="btn-small" onClick={() => setCelebrating(true)}>🎉 Replay celebration</button>

      <div className="table-scroll">
        <table className="points-table results-table">
          <thead>
            <tr>
              <th>#</th><th>Team</th><th>Owner</th>
              {COLS.map(([, l]) => <th key={l}>{l}</th>)}
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {res.rankings.map((r) => (
              <React.Fragment key={r.teamId}>
                <tr
                  className={`${r.rank === 1 ? "winner-row" : ""}${myTeam?.id === r.teamId ? " me-row" : ""}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => setOpen(open === r.teamId ? null : r.teamId)}
                >
                  <td>{r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}</td>
                  <td className="team-name-cell"><span className={`team-pill ${r.teamId}-color`}>{r.teamName}</span></td>
                  <td>{r.ownerName}</td>
                  {COLS.map(([k]) => <td key={k}>{r.marks[k].toFixed(1)}</td>)}
                  <td className="pts-cell">{r.total.toFixed(1)}</td>
                </tr>
                {open === r.teamId && (
                  <tr className="notes-row">
                    <td colSpan={3 + COLS.length + 1}>
                      <ul>
                        {COLS.map(([k, l]) => <li key={k}><b>{l}:</b> {r.notes[k]}</li>)}
                      </ul>
                      <button className="btn-small" onClick={() => onOpenTeam(r.teamId)}>View squad</button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="results-foot">Tap a row to see why each mark was given.</p>
    </div>
  );
}