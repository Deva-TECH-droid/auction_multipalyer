import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { io } from "socket.io-client";
import {
  playAuctionStartSequence, playHammerSound, playIPLTheme, playTeamTheme,
  playUnsoldSound, stopAudio,
} from "../lib/audio";

export const CATEGORY_LABEL = {
  "Grade A": "Grade A", "Grade B": "Grade B", Batting: "Batters", Bowling: "Bowlers", Fielding: "All-Rounders / Fielders",
};

const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

// ─── tiny localStorage helpers (a seat survives refresh / reconnect) ─────
const LS = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const newToken = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function GameProvider({ children }) {
  const [conn, setConn] = useState("connecting"); // connecting | online
  const [name, setNameState] = useState(() => LS.get("ipl.name") || "");
  const [room, setRoom] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [you, setYou] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [songBanner, setSongBanner] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const [pulse, setPulse] = useState(null);
  const [rejoining, setRejoining] = useState(!!LS.get("ipl.room"));
  const clockOffset = useRef(0); // server clock minus local clock

  const socketRef = useRef(null);
  const tokenRef = useRef(LS.get("ipl.token") || (() => { const t = newToken(); LS.set("ipl.token", t); return t; })());
  const live = useRef({});
  const toastId = useRef(0);
  const bannerTimer = useRef(null);

  const catalogById = useMemo(() => {
    const m = {};
    catalog.forEach((p) => { m[p.id] = p; });
    return m;
  }, [catalog]);

  const myTeam = useMemo(
    () => (room && you ? room.teams.find((t) => t.ownerId === you) || null : null),
    [room, you]
  );
  const isHost = !!(room && you && room.hostId === you);

  // latest values for socket handlers
  live.current = { room, catalogById, myTeam, you, name };

  // ─── toasts ────────────────────────────────────────────────────────────
  const toast = useCallback((msg, type = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-4), { id, msg, type, fading: false }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, fading: true } : x))), 3000);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3300);
  }, []);

  const showSongBanner = useCallback((teamId, teamName, playerName) => {
    playTeamTheme(teamId);
    setSongBanner({ teamId, teamName, playerName, key: Date.now() });
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setSongBanner(null), 5000);
  }, []);

  // ─── socket ────────────────────────────────────────────────────────────
  useEffect(() => {
    const url = import.meta.env.VITE_SERVER_URL || undefined; // same origin by default
    const socket = io(url, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConn("online");
      const code = LS.get("ipl.room");
      if (code) { setRejoining(true); socket.emit("room:rejoin", { code, token: tokenRef.current }); }
      else setRejoining(false);
    });
    socket.on("disconnect", () => setConn("connecting"));
    socket.on("connect_error", () => setConn("connecting"));

    socket.on("errorMsg", (m) => toast(m, "error"));

    socket.on("room:joined", ({ code, you: id }) => {
      LS.set("ipl.room", code);
      setYou(id);
    });
    socket.on("room:catalog", setCatalog);
    socket.on("room:state", (s) => {
      clockOffset.current = s.serverNow - Date.now();
      setRejoining(false);
      setRoom(s);
    });
    socket.on("room:gone", () => { LS.del("ipl.room"); setRejoining(false); setRoom(null); setYou(null); });
    socket.on("room:left", () => { LS.del("ipl.room"); setRoom(null); setYou(null); });

    socket.on("auction:event", (e) => {
      const { catalogById: byId, myTeam: mine, room: rm } = live.current;
      const byId2 = (id) => rm?.teams.find((t) => t.id === id)?.name || id.toUpperCase();
      switch (e.type) {
        case "retention":
          toast("🏏 Retention phase — pick up to 2 players, then lock.", "info");
          break;
        case "started":
          playAuctionStartSequence();
          toast("🔨 The auction is LIVE!", "gold");
          break;
        case "next":
          stopAudio(); // team anthem / intro music ends as soon as the next player comes up
          toast(`🏏 Now bidding: ${byId[e.playerId]?.name ?? "next player"}`, "info");
          break;
        case "bid":
          { const key = Date.now(); setPulse({ teamId: e.teamId, key }); setTimeout(() => setPulse((p) => (p && p.key === key ? null : p)), 800); }
          if (mine && e.teamId === mine.id) toast(`✅ Your bid: ₹${e.amount.toFixed(2)} Cr`, "success");
          else toast(`${e.teamName} bid ₹${e.amount.toFixed(2)} Cr`);
          break;
        case "sold":
          toast(
            `🔨 ${e.name} ${e.isRTM ? "RTM'd by" : "SOLD to"} ${e.teamName} — ₹${e.price.toFixed(2)} Cr`,
            "success"
          );
          playHammerSound();
          setTimeout(() => showSongBanner(e.teamId, e.teamName, e.name), 600);
          break;
        case "unsold":
          toast(`${e.name} went UNSOLD.`, "error");
          playUnsoldSound();
          break;
        case "rtm-offer":
          if (mine && mine.id === e.exTeamId) toast("⚡ You can use your RTM card!", "gold");
          break;
        case "rtm-used":
          toast(`⚡ ${byId2(e.exTeamId)} used RTM at ₹${e.price.toFixed(2)} Cr — ${byId2(e.winningTeamId)} can raise!`, "gold");
          break;
        case "rtm-raised":
          toast(`📈 ${e.teamName} raised to ₹${e.price.toFixed(2)} Cr — ${byId2(e.exTeamId)} must match or cancel.`, "gold");
          break;
        case "rtm-cancelled":
          toast(`${byId2(e.exTeamId)} cancelled RTM and keeps the card.`, "info");
          break;
        case "round2":
          toast(`🔁 Accelerated round — ${e.count} unsold players return!`, "gold");
          break;
        case "category":
          toast(`🔀 Host switched to: ${CATEGORY_LABEL[e.category] || e.category}`, "gold");
          break;
        case "intro-skipped":
          stopAudio();
          break;
        case "paused":
          toast("⏸ Auction paused by the host.", "info");
          break;
        case "resumed":
          toast("▶ Auction resumed.", "info");
          break;
        case "ended":
          toast(
            e.reason === "squads-complete"
              ? "✅ Every franchise has 15 players — auction finished!"
              : "🎉 Auction complete!",
            "gold"
          );
          playIPLTheme();
          break;
        case "results":
          stopAudio();
          setCelebrating(true);
          break;
        default:
      }
    });

    return () => { socket.disconnect(); };
  }, [toast, showSongBanner]);

  // ─── actions ───────────────────────────────────────────────────────────
  const emit = useCallback((ev, payload) => socketRef.current?.emit(ev, payload), []);

  const actions = useMemo(() => ({
    setName(n) { setNameState(n); LS.set("ipl.name", n); },
    createRoom: (n) => emit("room:create", { name: n, token: tokenRef.current }),
    joinRoom: (code, n) => emit("room:join", { code: code.trim().toUpperCase(), name: n, token: tokenRef.current }),
    leaveRoom: () => emit("room:leave"),
    selectTeam: (teamId) => emit("room:selectTeam", { teamId }),
    startRetention: () => emit("room:start"),
    setRetentions: (picks) => emit("retention:set", { picks }),
    lockRetentions: (locked) => emit("retention:lock", { locked }),
    startAuction: (force = false) => emit("auction:start", { force }),
    bid: (increment, expected) => emit("auction:bid", { increment, expected }),
    rtm: (use) => emit("auction:rtm", { use }),
    rtmRaise: (amount) => emit("auction:rtmRaise", { amount }),
    rtmFinal: (match) => emit("auction:rtmFinal", { match }),
    skip: () => emit("auction:skip"),
    pause: (paused) => emit("auction:pause", { paused }),
    endAuction: () => emit("auction:end"),
    setCategory: (category) => emit("auction:category", { category }),
    showResults: () => emit("auction:results"),
    setXI: (ids) => emit("xi:set", { ids }),
    logout() {
      stopAudio();
      LS.del("ipl.room");
      LS.del("ipl.name");
      window.location.href = window.location.pathname;
    },
  }), [emit]);

  const serverNow = useCallback(() => Date.now() + clockOffset.current, []);

  const value = {
    conn, name, room, catalog, catalogById, you, myTeam, isHost,
    toasts, songBanner, pulse, serverNow, actions, toast, celebrating, setCelebrating,
    rejoining,
  };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// Remaining ms until a server timestamp, refreshed ~5x per second.
export function useCountdown(endsAt) {
  const { serverNow } = useGame();
  const [ms, setMs] = useState(() => (endsAt ? Math.max(0, endsAt - serverNow()) : 0));
  useEffect(() => {
    if (!endsAt) { setMs(0); return undefined; }
    const tick = () => setMs(Math.max(0, endsAt - serverNow()));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [endsAt, serverNow]);
  return ms;
}