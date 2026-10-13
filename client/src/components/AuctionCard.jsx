import React, { useState } from "react";
import PlayerAvatar from "./PlayerAvatar";
import { CATEGORY_LABEL, useCountdown, useGame } from "../hooks/GameContext";
import { avatarFallback, getFlag, roleColor } from "../lib/helpers";

const show = (v, d) => (v === null || v === undefined ? "—" : d !== undefined && typeof v === "number" ? v.toFixed(d) : v);
const STAT_FIELDS = [
  ["Mat", "mat"], ["Runs", "runs", 0], ["Avg", "avg", 2], ["S.R.", "sr", 2],
  ["H.S.", "hs"], ["Wkts", "wkts"], ["Eco", "eco", 2], ["Best", "best"],
];

// The live auction card — same markup/classes as the original #auction-card.
export default function AuctionCard() {
  const { room, catalogById, myTeam, actions } = useGame();
  const a = room.auction;
  const player = a.playerId != null ? catalogById[a.playerId] : null;

  const bidMs = useCountdown(a.phase === "bidding" && !a.paused ? a.timerEndsAt : null);
  const rtmMs = useCountdown(a.phase === "rtm" ? a.rtm?.endsAt : null);
  const introMs = useCountdown(a.phase === "intro" ? a.introEndsAt : null);

  if (!player) {
    return (
      <div id="welcome-state" className="welcome-box glass-card">
        <span className="cricket-icon">🏏</span>
        <h2>{a.phase === "between" ? "ACCELERATED ROUND" : "ARENA READY"}</h2>
        <p>
          {a.phase === "intro"
            ? `🎙️ The auction begins after the opening ceremony… bidding starts in ${Math.ceil(introMs / 1000)}s`
            : a.phase === "between"
            ? "Unsold players are coming back to the block for one more chance…"
            : "The hammer is waiting. The first player goes up for bidding any second."}
        </p>
      </div>
    );
  }

  const prevTeam = player.lastTeam ? room.teams.find((t) => t.id === player.lastTeam) : null;
  const leader = a.lastBidder ? room.teams.find((t) => t.id === a.lastBidder) : null;
  const buyer = room.teams.find((t) => t.purchased.some((p) => p.playerId === player.id));
  const buyerEntry = buyer?.purchased.find((p) => p.playerId === player.id);
  const isRetained = !!buyerEntry?.isRetention;

  let stamp = null;
  if (a.phase === "between") {
    stamp = buyer && !isRetained ? (buyerEntry.isRTM ? "RTM" : "SOLD") : "UNSOLD";
  }

  // Bidder line under the price
  let bidderText = "Opening Bid";
  if (a.phase === "between" && buyer) bidderText = `${buyer.name} · ${buyer.ownerName}${buyerEntry.isRTM ? " (RTM)" : ""}`;
  else if (a.phase === "between") bidderText = "No bids";
  else if (leader) bidderText = `${leader.name} · ${leader.ownerName}`;

  // Timer ring (original: 163 circumference, 15s scale, red <=5, gold <=8)
  const secs = a.paused
    ? Math.ceil((a.remainingMs || 0) / 1000)
    : a.phase === "bidding" ? Math.ceil(bidMs / 1000) : 0;
  const ringOffset = Math.max(0, 163 - (secs / 15) * 163);
  const ringColor = secs <= 5 ? "var(--crimson)" : secs <= 8 ? "var(--gold)" : "var(--accent)";

  // Can I bid? (server re-validates everything)
  const bidding = a.phase === "bidding" && !a.paused;
  const isLeader = !!myTeam && a.lastBidder === myTeam.id;
  const squadFull = !!myTeam && myTeam.purchased.length >= room.limits.maxSquad;
  const overseasFull =
    !!myTeam && player.country !== "India" &&
    myTeam.purchased.filter((p) => p.country !== "India").length >= room.limits.maxOverseasSquad;
  let hint = "";
  if (!myTeam) hint = "You are spectating — no franchise.";
  else if (a.paused) hint = "⏸ Paused by the host";
  else if (a.phase === "rtm") hint = "⚡ RTM decision in progress…";
  else if (a.phase === "between") hint = "";
  else if (isLeader) hint = "🏆 You're the highest bidder";
  else if (squadFull) hint = "Your squad is full (25).";
  else if (overseasFull) hint = "Overseas limit reached (8).";

  const bidBtn = (inc, label, extra = {}) => {
    const afford = !!myTeam && myTeam.remaining >= +(a.currentBid + inc).toFixed(2);
    return (
      <button
        className="btn-bid"
        disabled={!myTeam || !bidding || isLeader || squadFull || overseasFull || !afford}
        title={!afford && myTeam ? "Not enough purse" : undefined}
        onClick={() => actions.bid(inc, a.currentBid)}
        {...extra}
      >
        {label}
      </button>
    );
  };

  const rtm = a.phase === "rtm" ? a.rtm : null;
  const displayBid = rtm ? rtm.price : buyerEntry ? buyerEntry.price : a.currentBid;

  const wikiUrl = `https://en.wikipedia.org/wiki/Special:FilePath/${player.name.replace(/\s+/g, "_")}.jpg`;
  const war = a.involvedTeams.length >= 2 ? a.involvedTeams.map((id) => room.teams.find((t) => t.id === id)) : [];

  return (
    <div id="auction-card" className="auction-card-wrapper" key={player.id}>
      <div className="card-inner glass-card">
        <div className="card-header">
          <span className="player-role-badge" id="card-role" style={{ color: roleColor(player.role) }}>
            {player.role.toUpperCase()}
          </span>
          {room.auction.round === 2 && <span className="round-tag">🔁 ACCELERATED</span>}
          {player.category && <span className="round-tag set-tag">{CATEGORY_LABEL[player.category] || player.category}</span>}
        </div>

        <div className="player-visual">
          <PlayerAvatar name={player.name} size={100} className="player-img" />
        </div>

        <h2 id="card-name" className="glitch-text">{player.name}</h2>

        <div className="player-info-row">
          <span className="country-badge" id="card-country-badge">
            <span id="card-country">{getFlag(player.country)}</span> <span id="card-country-name">{player.country}</span>
          </span>
        </div>

        <div className="ipl-history">
          <span className="ih-label">IPL 2026 TEAM</span>
          {prevTeam ? (
            <span className="ih-team">
              <img src={`/images/${prevTeam.id}.webp`} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              {prevTeam.full}
            </span>
          ) : (
            <span className="ih-none">Not in any IPL 2026 squad</span>
          )}
        </div>

        <div className="performance-stats glass-panel">
          <div className="stats-season">
            {player.stats ? "📊 IPL 2026 SEASON" : "📊 IPL 2026 stats not available for this player"}
          </div>
          {player.stats && STAT_FIELDS.map(([label, key, d]) => (
            <div className="p-stat" key={key}>
              <span className="p-label">{label}</span>
              <span className="p-val">{show(player.stats[key], d)}</span>
            </div>
          ))}
        </div>

        <div className="stats-grid">
          <div className="stat-box">
            <span className="label">Base Price</span>
            <span className="value" id="card-base-price">₹{player.base} Cr</span>
          </div>
          <div className="stat-box big-box">
            <span className="label">Current Bid</span>
            <span className="value highlight-text" id="card-current-bid">₹{displayBid.toFixed(2)} Cr</span>
            <span className="sub-value" id="card-bidder">{bidderText}</span>
          </div>
          <div className="stat-box">
            <span className="label">Timer</span>
            <div className="timer-ring">
              <svg width="60" height="60">
                <circle className="ring-bg" cx="30" cy="30" r="26" />
                <circle
                  className="ring-progress" id="timer-ring-circle" cx="30" cy="30" r="26"
                  style={{ strokeDashoffset: ringOffset, stroke: ringColor }}
                />
              </svg>
              <span id="card-timer">{secs}</span>
            </div>
          </div>
        </div>

        {war.length > 0 && (
          <div id="bidding-war-section" className="bidding-war-panel">
            <h4 className="war-title">⚔️ Bidding War</h4>
            <div id="war-chips-container" className="war-chips">
              {war.map((t) => {
                const lead = a.lastBidder === t.id;
                return (
                  <div key={t.id} className={`war-chip${lead ? " active" : ""}`}>
                    <img
                      src={`/images/${t.id}.webp`} className="war-team-logo" alt={t.name}
                      onError={(e) => { e.currentTarget.src = avatarFallback(t.name, 32); }}
                    />
                    <div className="war-team-info">
                      <span className="war-team-name">{t.name} {lead ? "🏆" : ""}</span>
                      <span className="war-team-budget">₹{t.remaining.toFixed(2)} Cr left</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bid-controls" id="bid-controls-area">
          {bidBtn(0.25, "BID +₹0.25 Cr")}
          {bidBtn(0.5, "BID +₹0.5 Cr")}
          {bidBtn(1, "⚡ SNAP BID +₹1 Cr", {
            style: {
              gridColumn: "span 2", background: "rgba(255,215,0,0.1)",
              borderColor: "rgba(255,215,0,0.4)", color: "var(--gold)",
            },
          })}
        </div>
        {hint && <div className="bid-hint">{hint}</div>}

        {rtm && <RtmBanner rtm={rtm} room={room} myTeam={myTeam} actions={actions} ms={rtmMs} />}

        {stamp && (
          <div
            key={`${player.id}-${stamp}`}
            id="status-stamp"
            className={`status-stamp ${stamp}`}
            style={{
              color: stamp === "UNSOLD" ? "var(--crimson)" : "var(--accent3)",
              borderColor: stamp === "UNSOLD" ? "var(--crimson)" : "var(--accent3)",
            }}
          >
            {stamp}
          </div>
        )}
      </div>
    </div>
  );
}

// Right To Match: decide -> (winner may raise) -> final match / cancel.
function RtmBanner({ rtm, room, myTeam, actions, ms }) {
  const ex = room.teams.find((t) => t.id === rtm.exTeamId);
  const winner = room.teams.find((t) => t.id === rtm.winningTeamId);
  const [raise, setRaise] = useState(() => (rtm.price + 1).toFixed(2));
  const secs = Math.ceil(ms / 1000);
  const isEx = myTeam?.id === ex.id;
  const isWinner = myTeam?.id === winner.id;
  const p = `₹${rtm.price.toFixed(2)} Cr`;

  let text;
  let actionsUI = null;
  if (rtm.stage === "decide") {
    text = isEx
      ? `${winner.name} won at ${p} — ${ex.name} can RTM! (${ex.rtmCards} left)`
      : `${winner.name} won at ${p} — waiting for ${ex.name} (${ex.ownerName}) to decide…`;
    if (isEx) {
      actionsUI = (
        <>
          <button id="rtm-card-use-btn" className="rtm-card-btn rtm-card-use" onClick={() => actions.rtm(true)}>⚡ USE RTM</button>
          <button id="rtm-card-decline-btn" className="rtm-card-btn rtm-card-decline" onClick={() => actions.rtm(false)}>✕ PASS</button>
        </>
      );
    }
  } else if (rtm.stage === "raise") {
    text = isWinner
      ? `${ex.name} used RTM at ${p}. Raise the price to keep ${"the player"} — or let them have him.`
      : `${ex.name} used RTM at ${p} — waiting for ${winner.name} (${winner.ownerName}) to raise or stand pat…`;
    if (isWinner) {
      const val = Number(raise);
      const bad = !Number.isFinite(val) || val <= rtm.price || val > myTeam.remaining;
      actionsUI = (
        <>
          <span className="rtm-raise-input">
            ₹<input type="number" step="0.25" min={rtm.price + 0.25} value={raise} onChange={(e) => setRaise(e.target.value)} /> Cr
          </span>
          <button className="rtm-card-btn rtm-card-use" disabled={bad} onClick={() => actions.rtmRaise(val)}>📈 RAISE</button>
          <button className="rtm-card-btn rtm-card-decline" onClick={() => actions.rtmRaise(null)}>✕ NO RAISE</button>
        </>
      );
    }
  } else {
    text = isEx
      ? `${winner.name} raised to ${p}. Match it with your RTM card, or cancel and keep the card.`
      : `${winner.name} raised to ${p} — waiting for ${ex.name} (${ex.ownerName}) to match or cancel…`;
    if (isEx) {
      const afford = ex.remaining >= rtm.price;
      actionsUI = (
        <>
          <button className="rtm-card-btn rtm-card-use" disabled={!afford} title={afford ? "" : "Not enough purse"} onClick={() => actions.rtmFinal(true)}>
            ⚡ MATCH {p}
          </button>
          <button className="rtm-card-btn rtm-card-decline" onClick={() => actions.rtmFinal(false)}>✕ CANCEL (keep RTM)</button>
        </>
      );
    }
  }

  return (
    <div id="rtm-inline-banner" className="rtm-inline-banner">
      <div className="rtm-banner-left">
        <span className="rtm-banner-icon">⚡</span>
        <div className="rtm-banner-text">
          <span className="rtm-banner-title">RIGHT TO MATCH · {secs}s</span>
          <span className="rtm-banner-sub" id="rtm-banner-sub">{text}</span>
        </div>
      </div>
      {actionsUI && <div className="rtm-banner-actions">{actionsUI}</div>}
    </div>
  );
}