const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { RoomManager } = require("./engine");

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || true },
  pingInterval: 10000,
  pingTimeout: 15000,
});
const rooms = new RoomManager(io);

app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size }));

// In production the built React app is served by this same server.
const dist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const str = (v, max = 40) => (typeof v === "string" ? v.trim().slice(0, max) : "");

io.on("connection", (socket) => {
  // socket.data = { code, playerId }

  const fail = (err) => socket.emit("errorMsg", err?.message || String(err));

  // Resolve the room + player this socket belongs to, then run fn.
  const act = (fn) => {
    try {
      const room = rooms.get(socket.data.code);
      const player = room?.members.get(socket.data.playerId);
      if (!room || !player) throw new Error("You are not in a room.");
      fn(room, player);
    } catch (err) {
      fail(err);
    }
  };

  const enter = (room, member) => {
    socket.data.code = room.code;
    socket.data.playerId = member.id;
    member.socketId = socket.id; // latest socket wins (refresh / second tab)
    socket.join(room.code);
    socket.emit("room:joined", { code: room.code, you: member.id });
    socket.emit("room:catalog", room.catalogPayload());
    room.broadcast();
  };

  socket.on("room:create", (p = {}) => {
    try {
      const token = str(p.token, 80);
      if (!token) throw new Error("Missing player token.");
      const room = rooms.create();
      const member = room.join({ name: str(p.name, 20), token });
      enter(room, member);
    } catch (err) { fail(err); }
  });

  socket.on("room:join", (p = {}) => {
    try {
      const token = str(p.token, 80);
      if (!token) throw new Error("Missing player token.");
      const room = rooms.get(p.code);
      if (!room) throw new Error("Room not found. Check the code and try again.");
      const member = room.join({ name: str(p.name, 20), token });
      enter(room, member);
    } catch (err) { fail(err); }
  });

  // Reconnect after refresh / network drop. Seat, franchise and purse are kept.
  socket.on("room:rejoin", (p = {}) => {
    try {
      const room = rooms.get(p.code);
      if (!room) return socket.emit("room:gone");
      const member = room.rejoin(str(p.token, 80));
      enter(room, member);
    } catch (err) {
      socket.emit("room:gone");
    }
  });

  socket.on("room:leave", () => act((room, me) => {
    room.leave(me.id);
    socket.leave(room.code);
    socket.data = {};
    socket.emit("room:left");
    room.broadcast();
  }));

  socket.on("room:selectTeam", (p = {}) => act((room, me) => {
    room.selectTeam(me.id, str(p.teamId, 10));
    room.broadcast();
  }));

  socket.on("room:start", () => act((room, me) => room.startRetention(me.id)));

  socket.on("retention:set", (p = {}) => act((room, me) => room.setRetentions(me.id, p.picks)));
  socket.on("retention:lock", (p = {}) => act((room, me) => room.lockRetentions(me.id, !!p.locked)));

  socket.on("auction:start", (p = {}) => act((room, me) => room.startAuction(me.id, !!p.force)));
  socket.on("auction:bid", (p = {}) => act((room, me) => room.bid(me.id, p.increment, p.expected)));
  socket.on("auction:rtm", (p = {}) => act((room, me) => room.useRTM(me.id, !!p.use)));
  socket.on("auction:rtmRaise", (p = {}) => act((room, me) => room.rtmRaise(me.id, p.amount == null ? null : p.amount)));
  socket.on("auction:rtmFinal", (p = {}) => act((room, me) => room.rtmFinal(me.id, !!p.match)));
  socket.on("auction:skip", () => act((room, me) => room.skip(me.id)));
  socket.on("auction:pause", (p = {}) => act((room, me) => room.pause(me.id, !!p.paused)));
  socket.on("auction:end", () => act((room, me) => room.endAuction(me.id)));

  socket.on("xi:set", (p = {}) => act((room, me) => room.setPlayingXI(me.id, p.ids)));

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data?.code);
    if (!room) return;
    const member = room.members.get(socket.data.playerId);
    if (!member || member.socketId !== socket.id) return; // a newer socket already took over
    room.setDisconnected(member.id);
    room.broadcast();
  });
});

server.listen(PORT, () => {
  console.log(`IPL Auction server listening on :${PORT}`);
});

module.exports = { server, io, rooms };