import React, { useCallback, useEffect, useState } from "react";
import { GameProvider, useGame } from "./hooks/GameContext";
import Login from "./components/Login";
import Intro from "./components/Intro";
import RoomPicker from "./components/RoomPicker";
import WaitingRoom from "./components/WaitingRoom";
import Retention from "./components/Retention";
import Dashboard from "./components/Dashboard";
import RetentionReveal from "./components/RetentionReveal/RetentionReveal";
import PurchaseAnnouncement from "./components/PurchaseAnnouncement/PurchaseAnnouncement";
import { SongBanner, Toasts } from "./components/Toasts";
import { isMuted, setMuted } from "./lib/audio";

function MuteButton() {
  const [m, setM] = useState(isMuted());
  return (
    <button
      className="mute-btn" title={m ? "Unmute" : "Mute sounds"}
      onClick={() => { setMuted(!m); setM(!m); }}
    >
      {m ? "🔇" : "🔊"}
    </button>
  );
}

function Shell() {
  const { name, room, rejoining, actions, isHost, purchaseAnnouncement, setPurchaseAnnouncement } = useGame();
  // Returning player with a saved room? Skip login + intro and rejoin directly.
  const [phase, setPhase] = useState(() => (name && rejoining ? "app" : "login"));
  const done = useCallback(() => setPhase("app"), []);

  const [showReveal, setShowReveal] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const [pendingForce, setPendingForce] = useState(false);

  useEffect(() => {
    if (phase === "login" && name && rejoining) setPhase("app");
  }, [phase, name, rejoining]);

  // Active reveal condition: server room is revealing retentions OR local preview is active
  const isRevealing = (room?.retentionRevealing && !revealDone) || showReveal;

  const handleRevealComplete = useCallback(() => {
    setShowReveal(false);
    setRevealDone(true);
    // DO NOT start auction until this retention reveal is completed:
    // When completed, host starts the auction on the server!
    if (isHost && room?.status === "retention") {
      actions.startAuction(pendingForce);
    }
  }, [isHost, room?.status, actions, pendingForce]);

  let screen;
  if (isRevealing) {
    screen = (
      <RetentionReveal
        room={room}
        onComplete={handleRevealComplete}
      />
    );
  } else if (phase === "login") {
    screen = <Login initialName={name} onSubmit={(n) => { actions.setName(n); setPhase("intro"); }} />;
  } else if (phase === "intro") {
    screen = <Intro onDone={done} />;
  } else if (!room) {
    screen = <RoomPicker />;
  } else if (room.status === "lobby") {
    screen = <WaitingRoom />;
  } else if (room.status === "retention") {
    screen = (
      <Retention
        onStartAuctionReveal={(force) => {
          setPendingForce(!!force);
          setRevealDone(false);
          setShowReveal(true);
        }}
      />
    );
  } else {
    screen = <Dashboard />;
  }

  return (
    <>
      {screen}
      {phase === "app" && <MuteButton />}
      <SongBanner />
      {purchaseAnnouncement && (
        <PurchaseAnnouncement
          purchase={purchaseAnnouncement}
          onDismiss={() => setPurchaseAnnouncement(null)}
        />
      )}
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
