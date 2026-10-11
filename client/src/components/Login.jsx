import React, { useState } from "react";

export default function Login({ initialName, onSubmit }) {
  const [name, setName] = useState(initialName || "");
  return (
    <div id="login-screen" className="screen active">
      <div className="login-container glass-card">
        <div className="ipl-badge">🏏 MULTIPLAYER AUCTION</div>
        <h1 className="logo-text">IPL MEGA<br />AUCTION <span className="highlight">2026</span></h1>
        <p className="subtitle">Experience the thrill of the hammer — with your friends</p>

        <form
          id="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(name.trim() || "Auctioneer");
          }}
        >
          <div className="input-group">
            <span className="input-icon">👤</span>
            <input
              type="text" id="username" placeholder="Auctioneer Name" required
              autoComplete="off" maxLength={20} value={name} onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary glow-btn">⚡ ENTER THE ARENA</button>
        </form>
        <p className="login-hint">2 to 10 friends · one room code · live bidding</p>
      </div>
      <div className="bg-animation" />
    </div>
  );
}