import React, { useMemo, useState } from "react";
import { useGame } from "../hooks/GameContext";
import { getFlag, getRoleShort, getRoleTagClass } from "../lib/helpers";
import PlayerAvatar from "./PlayerAvatar";

const FILTERS = [
  ["all", "All"], ["Grade A", "Grade A"], ["Grade B", "Grade B"],
  ["Batting", "Batting"], ["Bowling", "Bowling"], ["Fielding", "Fielding"],
];

// Left panel: player pool (view-only — the server runs the order) + top paid players.
export default function PlayerPool() {
  const { room, catalog } = useGame();
  const [filter, setFilter] = useState("all");

  const soldIds = useMemo(() => new Set(room.teams.flatMap((t) => t.purchased.map((p) => p.playerId))), [room.teams]);
  const unsold = useMemo(() => new Set(room.unsoldIds), [room.unsoldIds]);
  const onBlock = room.auction.playerId;

  const top = useMemo(() => {
    const all = [];
    room.teams.forEach((t) => t.purchased.forEach((p) => all.push({ name: p.name, price: p.price, teamName: t.name })));
    return all.sort((x, y) => y.price - x.price).slice(0, 3);
  }, [room.teams]);

  const list = catalog.filter((p) => filter === "all" || p.category === filter);

  return (
    <section className="panel-players glass-panel">
      <h3><span>👥</span> Player Pool (<span id="player-count">{soldIds.size}/{catalog.length}</span>)</h3>

      <div className="filter-bar">
        {FILTERS.map(([id, label]) => (
          <button key={id} className={`filter-btn${filter === id ? " active" : ""}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <div id="top-three-players" className="top-three-section">
        <h4 className="section-title">🏆 Top Paid Players</h4>
        <div id="top-three-list" className="top-three-grid">
          {top.length === 0 && <div className="top-player-placeholder">Auction in progress...</div>}
          {top.map((p, i) => (
            <div key={p.name} className={`top-player-card ${["gold", "silver", "bronze"][i]}`}>
              <div className={`rank-badge rank-${i + 1}`}>{p.name.charAt(0)}</div>
              <div className="top-player-info">
                <span className="top-player-name">{p.name}</span>
                <span className="top-player-team">{p.teamName}</span>
              </div>
              <div className="top-player-price">₹{p.price.toFixed(2)} Cr</div>
            </div>
          ))}
        </div>
      </div>

      <ul id="players-list" className="scrollable-list">
        {list.map((p) => (
          <li
            key={p.id}
            className={`player-item${soldIds.has(p.id) ? " sold" : ""}${unsold.has(p.id) ? " unsold" : ""}${onBlock === p.id ? " on-block" : ""}`}
          >
            <PlayerAvatar name={p.name} size={36} />
            <div className="player-item-info">
              <div className="player-item-name">{p.name}</div>
              <div className="player-item-meta">{getFlag(p.country)} {p.country} · ₹{p.base} Cr{unsold.has(p.id) ? " · unsold" : ""}</div>
            </div>
            <span className={`player-role-tag ${getRoleTagClass(p.role)}`}>{getRoleShort(p.role)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}