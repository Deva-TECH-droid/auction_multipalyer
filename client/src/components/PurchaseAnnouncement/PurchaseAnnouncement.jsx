import React, { useEffect, useState, useRef } from "react";
import { TEAMS_CONFIG } from "../../data/staticData";
import { useGame } from "../../hooks/GameContext";
import PlayerAvatar from "../PlayerAvatar";
import { playSoldAnnouncementSound } from "../../lib/audio";
import "./purchaseAnnouncement.css";

// Exactly 3 seconds: completes and smoothly dismisses right before next player auction starts
const ANNOUNCEMENT_DURATION_MS = 2900;
const DISMISS_FADE_MS = 300;

export default function PurchaseAnnouncement({ purchase, onDismiss }) {
  const { room, catalogById } = useGame() || {};
  const [isClosing, setIsClosing] = useState(false);
  const soundPlayedRef = useRef(null);

  const teamId = purchase?.teamId || "csk";
  const teamConfig = TEAMS_CONFIG.find((t) => t.id === teamId) || {
    id: teamId,
    name: purchase?.teamName || teamId.toUpperCase(),
    full: purchase?.teamName || teamId.toUpperCase(),
    color: "#ffd700",
  };

  const playerObj = catalogById?.[purchase?.playerId] || {
    name: purchase?.name || "Player",
    role: "Player",
    country: "India",
  };

  // Play exciting sold audio fanfare once per unique purchase
  useEffect(() => {
    if (!purchase?.key) return;
    if (soundPlayedRef.current !== purchase.key) {
      soundPlayedRef.current = purchase.key;
      playSoldAnnouncementSound(teamId);
    }
  }, [purchase?.key, teamId]);

  // Exactly 5.0 seconds timer for cinematic announcement presentation
  useEffect(() => {
    if (!purchase) return;
    setIsClosing(false);

    // Start smooth exit transition at 4.6 seconds
    const exitTimer = setTimeout(() => {
      setIsClosing(true);
    }, ANNOUNCEMENT_DURATION_MS - DISMISS_FADE_MS);

    // Completely dismiss at exactly 5.0 seconds
    const finishTimer = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, ANNOUNCEMENT_DURATION_MS);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [purchase?.key, onDismiss]);

  if (!purchase) return null;

  const teamFullName = teamConfig.full.toUpperCase();
  const playerName = (purchase.name || playerObj.name || "").toUpperCase();
  const formattedPrice = Number.isInteger(purchase.price)
    ? purchase.price
    : purchase.price.toFixed(2);

  return (
    <div
      className={`purchase-announcement-overlay${isClosing ? " closing" : ""}`}
      style={{
        "--pa-team-color": teamConfig.color,
        "--pa-team-glow": `${teamConfig.color}66`,
      }}
      onClick={() => {
        setIsClosing(true);
        setTimeout(() => { if (onDismiss) onDismiss(); }, 250);
      }}
    >
      {/* Dynamic Stadium Beams */}
      <div className="pa-light-beam left" />
      <div className="pa-light-beam right" />

      {/* Floating Ambient Sparks */}
      <div className="pa-ambient-sparks">
        <span className="pa-spark" style={{ width: 6, height: 6, left: "20%", animationDelay: "0s" }} />
        <span className="pa-spark" style={{ width: 8, height: 8, left: "45%", animationDelay: "1.2s" }} />
        <span className="pa-spark" style={{ width: 5, height: 5, left: "75%", animationDelay: "0.6s" }} />
        <span className="pa-spark" style={{ width: 7, height: 7, left: "85%", animationDelay: "2.1s" }} />
      </div>

      {/* Central Cinematic Showcase Card */}
      <div className="pa-card" onClick={(e) => e.stopPropagation()}>
        {/* SOLD! Stamp */}
        <div className={`pa-sold-stamp${purchase.isRTM ? " rtm" : ""}`}>
          {purchase.isRTM ? "⚡ RTM MATCHED!" : "SOLD! 🏏"}
        </div>

        {/* Purchasing Team Banner */}
        <div className="pa-team-strap">
          <div className="pa-team-logo-ring">
            <img
              src={`/images/${teamId}.webp`}
              alt={teamConfig.name}
              className="pa-team-logo"
            />
          </div>
          <h2 className="pa-team-headline">
            {teamFullName} {purchase.isRTM ? "SECURE" : "BUY"}
          </h2>
        </div>

        {/* Player Photo & Details */}
        <div className="pa-player-section">
          <div className="pa-avatar-glow-ring">
            <PlayerAvatar
              name={purchase.name || playerObj.name}
              size={110}
              className="pa-avatar-img"
            />
          </div>

          <h1 className="pa-player-name">{playerName}</h1>

          <div className="pa-player-subinfo">
            <span className="pa-pill">🏏 {playerObj.role || "Player"}</span>
            <span className="pa-pill">🌍 {playerObj.country || "India"}</span>
          </div>
        </div>

        {/* Big Golden Price Tag */}
        <div className="pa-price-badge">
          <h3 className="pa-price-text">
            <span>FOR </span>₹{formattedPrice} <span>CRORE</span>
          </h3>
        </div>

        {/* 5-Second Countdown Progress Bar */}
        <div className="pa-timer-bar-wrap">
          <div className="pa-timer-bar-fill" />
        </div>
      </div>
    </div>
  );
}
