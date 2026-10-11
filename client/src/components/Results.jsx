import React, { useMemo } from "react";
import { useGame } from "../hooks/GameContext";
import { powerStats } from "../lib/helpers";

// Shown in the centre stage once the auction is over: final ranking by Team Power Rating.
export default function Results({ onOpenTeam }) {
  const { room, catalogById, myTeam } = useGame();

  const rows = useMemo(() => {
    return room.teams
      .filter((t) => t.ownerId)
      .map((t) => {
        const pw = powerStats(t.playingEleven, catalogById);
        const spent = t.purchased.reduce((a, p) => a + p.price, 0);
        const best = [...t.purchased].sort((a, b) => b.price - a.price)[0];
        return { t, pw, spent, best };
      })
      .sort((a, b) => b.pw.balance - a.pw.balance);
  }, [room.teams, catalogById]);

  return (
    <div id="results-state" className="welcome-box glass-card results-box">
      <span className="cricket-icon">🏆</span>
      <h2>AUCTION COMPLETE</h2>
      <p>Final standings by Team Power Rating (best Playing XI). Tap a team to view its squad or tweak the XI.</p>
      <table className="points-table results-table">
        <thead>
          <tr><th>#</th><th>Team</th><th>Owner</th><th>Squad</th><th>Spent</th><th>Rating</th></tr>
        </thead>
        <tbody>
          {rows.map(({ t, pw, spent }, i) => (
            <tr key={t.id} onClick={() => onOpenTeam(t.id)} style={{ cursor: "pointer" }} className={myTeam?.id === t.id ? "me-row" : ""}>
              <td>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
              <td className="team-name-cell"><span className={`team-pill ${t.id}-color`}>{t.name}</span></td>
              <td>{t.ownerName}</td>
              <td>{t.purchased.length}</td>
              <td>₹{spent.toFixed(2)} Cr</td>
              <td className="pts-cell">{pw.balance.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
