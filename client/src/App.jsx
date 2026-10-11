import React, { useCallback, useEffect, useState } from "react";
import { GameProvider, useGame } from "./hooks/GameContext";
import Login from "./components/Login";
import Intro from "./components/Intro";
import RoomPicker from "./components/RoomPicker";
import WaitingRoom from "./components/WaitingRoom";
import Retention from "./components/Retention";
import Dashboard from "./components/Dashboard";
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
  const { name, room, rejoining, actions } = useGame();
  // Returning player with a saved room? Skip login + intro and rejoin directly.
  const [phase, setPhase] = useState(() => (name && rejoining ? "app" : "login"));
  const done = useCallback(() => setPhase("app"), []);

  useEffect(() => {
    if (phase === "login" && name && rejoining) setPhase("app");
  }, [phase, name, rejoining]);

  let screen;
  if (phase === "login") {
    screen = <Login initialName={name} onSubmit={(n) => { actions.setName(n); setPhase("intro"); }} />;
  } else if (phase === "intro") {
    screen = <Intro onDone={done} />;
  } else if (!room) {
    screen = <RoomPicker />;
  } else if (room.status === "lobby") {
    screen = <WaitingRoom />;
  } else if (room.status === "retention") {
    screen = <Retention />;
  } else {
    screen = <Dashboard />;
  }

  return (
    <>
      {screen}
      {phase === "app" && <MuteButton />}
      <SongBanner />
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
