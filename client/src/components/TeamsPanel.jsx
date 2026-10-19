
import React from "react";
import { useGame } from "../hooks/GameContext";
import { avatarFallback } from "../lib/helpers";
 
// Right panel: all 10 franchises with live purse + squad size.
export default function TeamsPanel({ onOpenTeam }) {
  const { room, myTeam, pulse } = useGame();
  return (
    <section className="panel-teams">
      <div className="teams-grid" id="teams-grid">
        {room.teams.map((t) => {
          const isUser = myTeam?.id === t.id;
          const pulsing = pulse && pulse.teamId === t.id;
          return (
            <div
              key={t.id}
              id={`team-card-${t.id}`}
              className={`team-card team-${t.id}${t.ownerId ? "" : " unowned"}${pulsing ? " pulse" : ""}`}
              style={{ "--team-color": t.color }}
              onClick={() => onOpenTeam(t.id)}
            >
              {isUser && <span className="user-team-badge">⭐ YOU</span>}
              <div className="team-card-header">
                <img
                  src={`/images/${t.id}.webp`}
                  onError={(e) => { e.currentTarget.src = avatarFallback(t.name); }}
                  alt={t.name} className="team-logo-sm"
                />
                <div>
                  <div className="team-card-name">{t.name}</div>
                  <div className="team-card-full">{t.ownerName || "— no owner —"}</div>
                </div>
              </div>
              <div className="team-purse">₹{t.remaining.toFixed(2)} Cr left</div>
              <div className="purse-bar"><i style={{ width: `${Math.max(0, Math.min(100, t.remaining))}%` }} /></div>
              <div className="team-squad-count">
                👥 <b className={t.purchased.length >= room.limits.minSquad ? "squad-ok" : ""}>{t.purchased.length}</b>/{room.limits.minSquad}
                {" · ✈ "}{t.purchased.filter((p) => p.country !== "India").length}
                {t.rtmCards > 0 && t.ownerId ? " · ⚡RTM" : ""}
              </div>
              {t.ownerId && <div className="team-points">⭐ {t.points.total} pts <small>A×{t.points.gradeA} B×{t.points.gradeB}</small></div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
 
