import React, { useState } from "react";
import { useGame } from "../hooks/GameContext";

const SCORE_COLOR = (score) => {
  if (score >= 80) return "#00ff88";
  if (score >= 65) return "#ffd700";
  if (score >= 50) return "#ff9100";
  return "#ff4444";
};

const SCORE_GRADE = (score) => {
  if (score >= 85) return "S";
  if (score >= 75) return "A";
  if (score >= 65) return "B";
  if (score >= 55) return "C";
  return "D";
};

const MEDAL = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

function RadialScore({ score, max = 100, size = 80, color }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, score / max);
  const offset = circumference * (1 - pct);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        style={{ fill: color, fontSize: size * 0.22, fontWeight: 700, transform: `rotate(90deg)`, transformOrigin: "50% 50%", fontFamily: "var(--font-heading)" }}>
        {score}
      </text>
    </svg>
  );
}

function BreakdownBar({ label, score, max, whyPoints, whyDeducted }) {
  const [open, setOpen] = useState(false);
  const pct = (score / max) * 100;
  const color = pct >= 80 ? "#00ff88" : pct >= 60 ? "#ffd700" : pct >= 40 ? "#ff9100" : "#ff4444";
  return (
    <div className="ai-breakdown-row" onClick={() => setOpen(!open)} style={{ cursor: "pointer" }}>
      <div className="ai-bd-header">
        <span className="ai-bd-label">{label}</span>
        <span className="ai-bd-score" style={{ color }}>{score}/{max}</span>
      </div>
      <div className="ai-bd-bar-track">
        <div className="ai-bd-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {open && (
        <div className="ai-bd-detail">
          {whyPoints?.length > 0 && (
            <div className="ai-bd-positive">
              {whyPoints.map((r, i) => <div key={i}>✅ {r}</div>)}
            </div>
          )}
          {whyDeducted?.length > 0 && (
            <div className="ai-bd-negative">
              {whyDeducted.map((r, i) => <div key={i}>❌ {r}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BuyCard({ label, emoji, player, cardClass }) {
  if (!player) return null;
  return (
    <div className={`buy-card ${cardClass}`}>
      <div className="buy-card-label">{emoji} {label}</div>
      <div className="buy-card-name">{player.name}</div>
      <div className="buy-card-meta">
        {player.role} · {player.country}
      </div>
      <div className="buy-card-price">₹{(player.price || 0).toFixed(2)} Cr</div>
      <div className="buy-card-reason">{player.reason}</div>
    </div>
  );
}

function TeamAnalysisDetail({ analysis, teamColor }) {
  const { breakdown, strengths, weaknesses, bestBuy, stealBuy, worstBuy } = analysis;
  if (!breakdown) return null;
  return (
    <div className="ai-team-detail">
      <div className="ai-sw-grid">
        <div className="ai-strengths">
          <h4>💪 Strengths</h4>
          {strengths.map((s, i) => <div key={i} className="ai-sw-item ai-strength">✅ {s}</div>)}
        </div>
        <div className="ai-weaknesses">
          <h4>⚠️ Weaknesses</h4>
          {weaknesses.map((w, i) => <div key={i} className="ai-sw-item ai-weakness">⚠️ {w}</div>)}
        </div>
      </div>

      <h4 style={{ margin: "16px 0 8px", color: "var(--accent)" }}>📊 Category Breakdown</h4>
      <div className="ai-breakdown-grid">
        {Object.entries(breakdown).map(([key, bd]) => (
          <BreakdownBar key={key} label={bd.label} score={bd.score} max={bd.max} whyPoints={bd.whyPoints} whyDeducted={bd.whyDeducted} />
        ))}
      </div>

      <h4 style={{ margin: "16px 0 8px", color: "var(--gold)" }}>🛒 Transfer Market Verdicts</h4>
      <div className="buy-cards-grid">
        <BuyCard label="Best Buy" emoji="⭐" player={bestBuy} cardClass="best-buy" />
        <BuyCard label="Steal Buy" emoji="🔥" player={stealBuy} cardClass="steal-buy" />
        <BuyCard label="Worst Buy" emoji="💸" player={worstBuy} cardClass="worst-buy" />
      </div>
    </div>
  );
}

export default function TeamAnalysisPanel() {
  const { room } = useGame();
  const ta = room?.teamAnalysis;
  const [expanded, setExpanded] = useState(null);

  if (!ta?.leaderboard?.length) {
    return (
      <div className="ai-analysis-placeholder glass-card">
        <span style={{ fontSize: "2rem" }}>🤖</span>
        <h3>AI Team Analysis</h3>
        <p>Available after the auction ends. The AI will rate every team out of 100 based on batting power, bowling attack, all-rounders, wicketkeeping, fielding, overseas utilization, team balance, squad depth, captain strength, and budget efficiency.</p>
      </div>
    );
  }

  const strongest = ta.leaderboard[0];

  return (
    <div className="ai-analysis-panel">
      <div className="ai-header">
        <h2>🤖 AI Team Analysis</h2>
        <p className="ai-subtitle">All teams rated out of 100 across 10 performance dimensions</p>
        {strongest && (
          <div className="ai-strongest-banner" style={{ borderColor: "var(--gold)" }}>
            🏆 Strongest Team: <strong style={{ color: "var(--gold)" }}>{strongest.teamFull}</strong>
            <span className="ai-score-badge" style={{ background: SCORE_COLOR(strongest.score) }}>
              {strongest.score}/100
            </span>
          </div>
        )}
      </div>

      <div className="ai-leaderboard">
        {ta.leaderboard.map((analysis, idx) => {
          const color = SCORE_COLOR(analysis.score);
          const grade = SCORE_GRADE(analysis.score);
          const isExpanded = expanded === analysis.teamId;
          const teamConfig = room.teams.find((t) => t.id === analysis.teamId);
          const teamColor = teamConfig?.color || "#fff";

          return (
            <div key={analysis.teamId} className={`ai-team-card glass-panel ${isExpanded ? "expanded" : ""}`}
              style={{ borderLeft: `4px solid ${teamColor}` }}>
              <div className="ai-team-header" onClick={() => setExpanded(isExpanded ? null : analysis.teamId)}>
                <div className="ai-team-rank">
                  <span className="ai-medal">{MEDAL[idx] || `#${idx + 1}`}</span>
                </div>
                <div className="ai-team-identity">
                  <span className="ai-team-name" style={{ color: teamColor }}>{analysis.teamFull}</span>
                  <span className="ai-team-meta">{analysis.squadSize} players · ₹{(analysis.remaining || 0).toFixed(1)} Cr left</span>
                </div>
                <div className="ai-team-score-area">
                  <RadialScore score={analysis.score} color={color} size={72} />
                  <span className="ai-grade-badge" style={{ background: color }}>{grade}</span>
                </div>
                <div className="ai-team-quick-buys">
                  {analysis.bestBuy && (
                    <div className="ai-quick-buy best">⭐ <span>{analysis.bestBuy.name}</span></div>
                  )}
                  {analysis.stealBuy && analysis.stealBuy.name !== analysis.bestBuy?.name && (
                    <div className="ai-quick-buy steal">🔥 <span>{analysis.stealBuy.name}</span></div>
                  )}
                  {analysis.worstBuy && (
                    <div className="ai-quick-buy worst">💸 <span>{analysis.worstBuy.name}</span></div>
                  )}
                </div>
                <button className="ai-expand-btn">{isExpanded ? "▲ Collapse" : "▼ Full Analysis"}</button>
              </div>

              {isExpanded && (
                <TeamAnalysisDetail analysis={analysis} teamColor={teamColor} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
