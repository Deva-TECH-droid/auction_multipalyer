import React from "react";
import Modal from "./Modal";

// Content copied from the original news modal.
export default function NewsModal({ onClose, onOpenSchedule, onOpenSquads }) {
  return (
    <Modal
      id="news-modal"
      onClose={onClose}
      title={<>📰 <span className="highlight">IPL 2026</span> — LATEST UPDATES</>}
      className="news-modal-inner"
    >
      <div>
        {/* Hero: LSG Jersey Reveal */}
        <div className="news-hero">
          <div className="news-hero-content">
            <span className="news-tag">🔴 BREAKING</span>
            <h3>LSG New Identity: Bold Red & Blue Unveiled!</h3>
            <p>Lucknow Super Giants have rebranded with a striking new logo and jersey for the 2026 season — marking a fresh era under new captaincy.</p>
          </div>
          <div className="video-container">
            <iframe
              src="https://www.youtube.com/embed/LdaBS3V8rLdt_EwLi"
              title="LSG New Jersey Reveal 2026"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen>
            </iframe>
          </div>
        </div>

        {/* News Grid Row 1 */}
        <div className="news-cards-grid">

          <div className="news-card">
            <span className="news-date">📅 MARCH 2026</span>
            <h4>Season Kickoff</h4>
            <p>IPL 2026 is scheduled to begin on <strong>March 28, 2026</strong> with the blockbuster opener RCB vs SRH in Bengaluru. The league stage runs through May, with playoffs in the final week.</p>
          </div>

          <div className="news-card">
            <span className="news-date">🏟️ FORMAT</span>
            <h4>74 Matches, 10 Teams</h4>
            <p>All 10 franchises return with the same double round-robin format. Two virtual groups, top 4 teams advance to playoffs. The final is tentatively set for <strong>late May 2026</strong>.</p>
          </div>

          <div className="news-card">
            <span className="news-date">💰 AUCTION</span>
            <h4>Mega Auction Complete</h4>
            <p>The IPL 2026 Mega Auction witnessed record bids. <strong>Rishabh Pant (₹27 Cr)</strong> to LSG and <strong>Shreyas Iyer (₹15 Cr)</strong> to PBKS were among the biggest moves.</p>
          </div>

          <div className="news-card">
            <span className="news-date">🎓 COACHING</span>
            <h4>New Coaches Across Teams</h4>
            <div className="badge-row" style={{ marginBottom: "10px" }}>
              <span className="news-badge">PBKS: Ricky Ponting</span>
              <span className="news-badge">DC: Hemang Badani</span>
              <span className="news-badge">RR: Rahul Dravid</span>
              <span className="news-badge">MI: Mahela Returns</span>
              <span className="news-badge">KKR: Abhishek Nayar</span>
              <span className="news-badge">SRH: Daniel Vettori</span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>All 10 franchises have finalized support staff heading into the season.</p>
          </div>

          <div className="news-card" style={{ gridColumn: "span 2" }}>
            <span className="news-date">📊 POINTS TABLE — 2026 PREDICTIONS</span>
            <h4>Pre-Season Strength Ratings</h4>
            <table className="points-table" style={{ marginTop: "10px" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>Captain</th>
                  <th>Star Player</th>
                  <th>Strength</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>1</td><td className="team-name-cell">MI</td><td>Hardik Pandya</td><td>Jasprit Bumrah</td><td className="pts-cell">⭐⭐⭐⭐⭐</td></tr>
                <tr><td>2</td><td className="team-name-cell">CSK</td><td>Ruturaj Gaikwad</td><td>Noor Ahmad</td><td className="pts-cell">⭐⭐⭐⭐⭐</td></tr>
                <tr><td>3</td><td className="team-name-cell">KKR</td><td>Ajinkya Rahane</td><td>Varun Chakravarthy</td><td className="pts-cell">⭐⭐⭐⭐½</td></tr>
                <tr><td>4</td><td className="team-name-cell">SRH</td><td>Pat Cummins</td><td>Travis Head</td><td className="pts-cell">⭐⭐⭐⭐½</td></tr>
                <tr className="qualify-line"><td>5</td><td className="team-name-cell">RR</td><td>Riyan Parag</td><td>Yashasvi Jaiswal</td><td className="pts-cell">⭐⭐⭐⭐</td></tr>
                <tr><td>6</td><td className="team-name-cell">RCB</td><td>Virat Kohli</td><td>Virat Kohli</td><td className="pts-cell">⭐⭐⭐⭐</td></tr>
                <tr><td>7</td><td className="team-name-cell">GT</td><td>Shubman Gill</td><td>Rashid Khan</td><td className="pts-cell">⭐⭐⭐½</td></tr>
                <tr><td>8</td><td className="team-name-cell">DC</td><td>Axar Patel</td><td>Kuldeep Yadav</td><td className="pts-cell">⭐⭐⭐½</td></tr>
                <tr><td>9</td><td className="team-name-cell">LSG</td><td>Rishabh Pant</td><td>Mohammed Shami</td><td className="pts-cell">⭐⭐⭐</td></tr>
                <tr><td>10</td><td className="team-name-cell">PBKS</td><td>Shreyas Iyer</td><td>Arshdeep Singh</td><td className="pts-cell">⭐⭐⭐</td></tr>
              </tbody>
            </table>
            <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "6px" }}>* Dotted line = predicted qualification boundary</p>
          </div>

          <div className="news-card">
            <span className="news-date">🔥 BIGGEST DEALS</span>
            <h4>Top 5 Auction Buys</h4>
            <table style={{ width: "100%", fontFamily: "var(--font-display)", fontSize: "0.83rem", marginTop: "8px" }}><tbody>
              <tr style={{ color: "var(--text-dim)" }}>
                <th style={{ textAlign: "left", paddingBottom: "6px", fontWeight: "600", fontSize: "0.72rem" }}>Player</th>
                <th style={{ textAlign: "left", paddingBottom: "6px", fontWeight: "600", fontSize: "0.72rem" }}>Team</th>
                <th style={{ textAlign: "right", paddingBottom: "6px", fontWeight: "600", fontSize: "0.72rem" }}>Price</th>
              </tr>
              <tr><td style={{ padding: "4px 0" }}>Rishabh Pant</td><td style={{ color: "var(--text-dim)" }}>LSG</td><td style={{ textAlign: "right", color: "var(--gold)", fontFamily: "var(--font-heading)", fontWeight: "700" }}>₹27 Cr</td></tr>
              <tr><td style={{ padding: "4px 0" }}>Cameron Green</td><td style={{ color: "var(--text-dim)" }}>KKR</td><td style={{ textAlign: "right", color: "var(--gold)", fontFamily: "var(--font-heading)", fontWeight: "700" }}>₹25.2 Cr</td></tr>
              <tr><td style={{ padding: "4px 0" }}>Nicholas Pooran</td><td style={{ color: "var(--text-dim)" }}>LSG</td><td style={{ textAlign: "right", color: "var(--gold)", fontFamily: "var(--font-heading)", fontWeight: "700" }}>₹21 Cr</td></tr>
              <tr><td style={{ padding: "4px 0" }}>Matheesha Pathirana</td><td style={{ color: "var(--text-dim)" }}>KKR</td><td style={{ textAlign: "right", color: "var(--gold)", fontFamily: "var(--font-heading)", fontWeight: "700" }}>₹18 Cr</td></tr>
              <tr><td style={{ padding: "4px 0" }}>Liam Livingstone</td><td style={{ color: "var(--text-dim)" }}>SRH</td><td style={{ textAlign: "right", color: "var(--gold)", fontFamily: "var(--font-heading)", fontWeight: "700" }}>₹13 Cr</td></tr>
            </tbody></table>
          </div>

          <div className="news-card">
            <span className="news-date">🔄 MAJOR TRADES</span>
            <h4>Key Player Movements</h4>
            <div style={{ fontSize: "0.85rem", lineHeight: "1.8", marginTop: "6px" }}>
              <div>🔄 <strong>Sanju Samson</strong> → CSK</div>
              <div>🔄 <strong>Ravindra Jadeja</strong> → RR</div>
              <div>🔄 <strong>Sam Curran</strong> → RR</div>
              <div>🔄 <strong>Ishan Kishan</strong> → MI (Return)</div>
              <div>🆕 <strong>Rahul Dravid</strong> → RR Head Coach</div>
              <div>🆕 <strong>Ricky Ponting</strong> → PBKS Head Coach</div>
            </div>
          </div>

        </div>
        {/* Action Buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button id="open-schedule-btn" className="news-action-btn schedule-btn" onClick={onOpenSchedule}>
            🏏 VIEW IPL 2026 FIXTURES
          </button>
          <button id="open-squads-btn" className="news-action-btn squads-btn" onClick={onOpenSquads}>
            🛡️ VIEW FINALIZED SQUADS
          </button>
        </div>
      </div>
    </Modal>
  );
}
