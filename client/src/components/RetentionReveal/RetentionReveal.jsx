import React, { useEffect, useRef, useState, useCallback } from "react";
import { TEAMS_CONFIG, TEAM_DETAILS } from "../../data/staticData";
import { useGame } from "../../hooks/GameContext";
import PlayerAvatar from "../PlayerAvatar";
import { isMuted } from "../../lib/audio";
import "./retentionReveal.css";

// Audio anthem file mapping
const getAnthemFile = (teamId) => (teamId === "dc" ? "dc (2).mp3" : `${teamId}.mp3`);

// Pacing per playing team
const REVEAL_DURATION_MS = 8000;

export default function RetentionReveal({ room, onComplete }) {
  const { catalogById } = useGame() || {};
  const audioRef = useRef(null);

  // 1. Identify playing teams (only teams with real human owners in this room)
  const allTeams = room?.teams || [];
  const playingTeams = allTeams.filter((t) => !!t.ownerId);
  const unownedTeams = allTeams.filter((t) => !t.ownerId);

  // If no teams are claimed yet (edge-case/testing), fallback to the first 2 teams
  const displayTeams = playingTeams.length > 0 ? playingTeams : allTeams.slice(0, 2);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  // Current screen state: either one of the playing teams, or the unowned teams screen
  const isUnownedScreen = currentIdx === displayTeams.length;
  const currentTeam = !isUnownedScreen ? displayTeams[currentIdx] : null;
  const currentTeamId = currentTeam?.id || "csk";

  const teamConfig = TEAMS_CONFIG.find((t) => t.id === currentTeamId) || {
    id: currentTeamId,
    name: currentTeamId.toUpperCase(),
    full: currentTeamId.toUpperCase(),
    color: "#ffd700",
  };
  const teamDetails = TEAM_DETAILS[currentTeamId] || {};

  // STRICT REAL RETENTION DATA:
  // Shows ONLY what the human owner of this franchise actually retained!
  const actualRetained = currentTeam?.purchased?.filter((p) => p.isRetention) || [];

  // Play anthem for the current team
  const playTeamAnthem = useCallback((teamId) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (isMuted() || !teamId) return;

    try {
      const audio = new Audio(`/sounds/${getAnthemFile(teamId)}`);
      audio.volume = 0.8;
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch {
      // Audio autoplay fallback
    }
  }, []);

  const stopAnthem = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  // Finish reveal sequence and launch live auction
  const finishSequence = useCallback(() => {
    stopAnthem();
    setIsClosing(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 500);
  }, [stopAnthem, onComplete]);

  // Handle music whenever current team changes
  useEffect(() => {
    if (isUnownedScreen || isClosing) {
      stopAnthem();
    } else if (currentTeamId) {
      playTeamAnthem(currentTeamId);
    }
    return () => {
      stopAnthem();
    };
  }, [currentTeamId, isUnownedScreen, isClosing, playTeamAnthem, stopAnthem]);

  // Jump to specific team or unowned screen
  const goToScreen = (idx) => {
    if (idx > displayTeams.length) {
      finishSequence();
      return;
    }
    setCurrentIdx(idx);
    setProgress(0);
  };

  const handleNext = () => {
    goToScreen(currentIdx + 1);
  };

  // Automated progression timer with progress bar
  useEffect(() => {
    if (isClosing || isPaused) return;

    const intervalTime = 100;
    const increment = 100 / (REVEAL_DURATION_MS / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIdx < displayTeams.length) {
            setCurrentIdx((idx) => idx + 1);
            return 0;
          } else {
            finishSequence();
            return 100;
          }
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentIdx, displayTeams.length, isClosing, isPaused, finishSequence]);

  return (
    <div
      className={`retention-reveal-overlay${isClosing ? " closing" : ""}`}
      style={{
        "--team-primary": teamConfig.color,
        "--team-bg-glow": `${teamConfig.color}22`,
        "--team-glow": teamConfig.color,
      }}
    >
      {/* Subtle floating particles in background */}
      <div className="reveal-bg-particles">
        <div className="reveal-bg-particle" style={{ width: 120, height: 120, top: "15%", left: "10%" }} />
        <div className="reveal-bg-particle" style={{ width: 180, height: 180, top: "60%", right: "8%" }} />
        <div className="reveal-bg-particle" style={{ width: 90, height: 90, bottom: "10%", left: "30%" }} />
      </div>

      {/* ─── Top Navigation Bar ─── */}
      <header className="reveal-nav-bar">
        <div className="reveal-brand-badge">
          <img src="/images/ipl.webp" alt="IPL Logo" className="reveal-ipl-logo" />
          <div className="reveal-brand-meta">
            <span className="reveal-brand-title">IPL 2026 AUCTION</span>
            <span className="reveal-brand-sub">🔴 RETENTION REVEAL</span>
          </div>
        </div>

        {/* Stepper with ONLY playing teams */}
        <div className="reveal-teams-stepper">
          {displayTeams.map((t, idx) => {
            const isActive = idx === currentIdx;
            const retCount = t.purchased?.filter((p) => p.isRetention)?.length || 0;
            return (
              <button
                key={t.id}
                className={`reveal-stepper-btn${isActive ? " active" : ""}`}
                onClick={() => goToScreen(idx)}
                title={`${t.name} (Owner: ${t.ownerName})`}
              >
                <img src={`/images/${t.id}.webp`} alt={t.name} className="reveal-stepper-logo" />
                <span>{t.name}</span>
                <span className="reveal-stepper-owner">({t.ownerName || "Owner"})</span>
                {retCount > 0 && <span className="reveal-stepper-badge">{retCount}</span>}
              </button>
            );
          })}

          {unownedTeams.length > 0 && (
            <button
              className={`reveal-stepper-btn reveal-unowned-btn${isUnownedScreen ? " active" : ""}`}
              onClick={() => goToScreen(displayTeams.length)}
              title={`${unownedTeams.length} unowned franchises are not playing`}
            >
              <span>ℹ {unownedTeams.length} Not Playing</span>
            </button>
          )}
        </div>

        {/* Control Buttons */}
        <div className="reveal-nav-controls">
          <button
            className="reveal-ctrl-btn"
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? "Resume reveal" : "Pause reveal"}
          >
            {isPaused ? "▶ RESUME" : "⏸ PAUSE"}
          </button>
          <button
            className="reveal-ctrl-btn"
            onClick={handleNext}
            title="Next team"
          >
            NEXT &rarr;
          </button>
          <button
            className="reveal-ctrl-btn reveal-start-now-btn"
            onClick={finishSequence}
            title="Start live auction immediately"
          >
            ⚡ START AUCTION
          </button>
        </div>
      </header>

      {/* ─── Main Presentation Stage ─── */}
      <main className="reveal-main-stage">
        {!isUnownedScreen ? (
          // ─── Playing Team Presentation ───
          <>
            <div className="reveal-franchise-hero">
              <div className="reveal-hero-logo-wrap">
                <img
                  src={`/images/${currentTeamId}.webp`}
                  alt={teamConfig.name}
                  className="reveal-hero-logo"
                />
              </div>

              <span className="reveal-hero-step-label">
                FRANCHISE {currentIdx + 1} OF {displayTeams.length} · {teamConfig.name}
              </span>

              <h1 className="reveal-hero-name">
                {teamConfig.full}
              </h1>

              <div className="reveal-hero-meta-row">
                <span className="reveal-hero-pill">
                  👤 Franchise Owner: <b>{currentTeam?.ownerName || "Owner"}</b>
                </span>
                <span className="reveal-hero-pill">
                  💰 Remaining Purse: <b>₹{(currentTeam?.remaining ?? 100).toFixed(2)} Cr</b>
                </span>
                <span className="reveal-hero-pill">
                  ⚡ RTM Cards: <b>{currentTeam?.rtmCards ?? 2}</b>
                </span>
                <div className="reveal-sound-indicator">
                  <div className="sound-wave-bars">
                    <span className="sound-bar" />
                    <span className="sound-bar" />
                    <span className="sound-bar" />
                  </div>
                  <span>PLAYING ANTHEM</span>
                </div>
              </div>
            </div>

            {/* Retained Players Display */}
            {actualRetained.length > 0 ? (
              <div className="reveal-cards-container">
                {actualRetained.map((player, pIdx) => (
                  <div key={player.playerId || pIdx} className="reveal-player-card">
                    <div className="reveal-card-header">
                      <span className="reveal-retention-pill">RETENTION #{pIdx + 1}</span>
                      <span className="reveal-card-team-label">{teamConfig.name} RETAINED</span>
                    </div>

                    <div className="reveal-card-body">
                      <div className="reveal-avatar-ring">
                        <PlayerAvatar name={player.name} size={76} className="reveal-avatar-img" />
                      </div>

                      <div className="reveal-player-info">
                        <h2 className="reveal-player-name-text">{player.name}</h2>
                        <div className="reveal-player-tags">
                          <span className="reveal-role-tag">🏏 {player.role || "Player"}</span>
                          <span className="reveal-country-tag">🌍 {player.country || "India"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="reveal-card-price-box">
                      <span className="reveal-price-lbl">RETENTION PRICE</span>
                      <div className="reveal-price-amt">
                        ₹{player.price} <span>CRORE</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Playing team opted for 0 retentions
              <div className="reveal-zero-players-card">
                <div className="reveal-zero-icon">⚪</div>
                <h2 className="reveal-zero-title">
                  {teamConfig.name} ({currentTeam?.ownerName}) HAS NOT RETAINED ANY PLAYER
                </h2>
                <p className="reveal-zero-desc">
                  This franchise has opted for a 100% clean-slate auction strategy. All previous players
                  return to the mega auction pool.
                </p>
                <div className="reveal-zero-perks">
                  <div className="reveal-zero-perk-box">
                    <span className="reveal-perk-num">₹100.00 Cr</span>
                    <span className="reveal-perk-txt">Full Purse Available</span>
                  </div>
                  <div className="reveal-zero-perk-box">
                    <span className="reveal-perk-num">2 CARDS</span>
                    <span className="reveal-perk-txt">Max RTM Privileges</span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          // ─── Unowned Franchises Screen (Not Playing) ───
          <div className="reveal-unowned-stage">
            <span className="reveal-unowned-header-badge">UNOWNED FRANCHISES NOTICE</span>
            <h1 className="reveal-unowned-title">
              {unownedTeams.length} FRANCHISES NOT PLAYING
            </h1>
            <p className="reveal-unowned-desc">
              Only franchises selected by human players participate in this auction.
              All players from unowned franchises will enter the open Mega Auction pool.
            </p>

            <div className="reveal-unowned-grid">
              {unownedTeams.map((t) => (
                <div key={t.id} className="reveal-unowned-card">
                  <img src={`/images/${t.id}.webp`} alt={t.name} className="reveal-unowned-logo" />
                  <div className="reveal-unowned-info">
                    <span className="reveal-unowned-name">{t.name}</span>
                    <span className="reveal-unowned-status">NOT PLAYING</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="reveal-ctrl-btn reveal-start-now-btn"
              style={{ marginTop: 16, padding: "12px 28px", fontSize: "0.95rem" }}
              onClick={finishSequence}
            >
              START LIVE AUCTION NOW &rarr;
            </button>
          </div>
        )}
      </main>

      {/* ─── Bottom Footer Bar ─── */}
      <footer className="reveal-footer-bar">
        {/* Subtle Progress Bar */}
        <div
          className="reveal-auto-progress-bar"
          style={{ width: `${progress}%` }}
        />

        <div className="reveal-footer-left">
          <span className="reveal-footer-pill">IPL 2026</span>
          <span>
            {!isUnownedScreen
              ? `Showing Retentions for ${teamConfig.full} (${currentTeam?.ownerName})`
              : `${unownedTeams.length} Unowned Franchises Not Playing`}
          </span>
        </div>

        <div className="reveal-footer-right">
          <span>{isPaused ? "⏸ PAUSED" : "▶ AUTO ADVANCING"}</span>
          <span>•</span>
          <span>AUCTION STARTS AFTER REVEAL</span>
        </div>
      </footer>
    </div>
  );
}
