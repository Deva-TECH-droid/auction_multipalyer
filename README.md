# 🏏 IPL Mega Auction 2026 — Multiplayer (React + Vite)

Same look, animations and sounds as your `one_more_auction` game — now a live room-code
multiplayer auction for **7 to 10 friends**, built with React + Vite on the front and
Node + Socket.io on the back. No login/keys needed: type a name, create a room, share the code.

## Run it
```bash
npm run install:all          # installs server + client
npm run dev:server           # terminal 1 -> http://localhost:3000
npm run dev:client           # terminal 2 -> http://localhost:5173  (friends on same WiFi: http://<your-ip>:5173)
```
Production (one server serves everything):
```bash
npm run start                # builds React, then serves on :3000
```
Deploy on Render/Railway: build `npm run install:all && npm run build`, start `npm start --prefix server`.
If the client is hosted separately, set `VITE_SERVER_URL=https://your-server` when building.

Testing alone: `MIN_PLAYERS=2 npm run dev:server` lets you start with fewer players.

## How a game goes
1. Everyone enters a name. Host taps **Create Auction Room** → gets a 5-letter code (or invite link).
2. Friends **Join Room** with the code. Each picks a franchise (one owner per team).
3. Host starts (needs **7–10** players). **Retention phase**: each owner keeps up to 2 of last season's players at a price they set (deducted from ₹100 Cr). Everyone locks in.
4. Host starts the **auction**. Players come up automatically in sets (Grade A → B → Batting → Bowling → Fielding). 15s opening timer, resets to 10s on every bid. Bid +0.25 / +0.5 / SNAP +1 Cr.
5. **RTM**: if a player's previous franchise is owned by someone, they get 12s to match the winning bid (1 card each).
6. Unsold players return once in an **accelerated round**. Then results + ranking by Team Power Rating.
7. Anytime: tap a team to see its squad; owners build their **Playing XI** (drag or tap, max 4 overseas).

## Rules I added (server-enforced)
Purse can't go negative · max 25 players · max 8 overseas in squad · max 4 overseas in XI · highest bidder can't re-bid ·
stale bids rejected ("someone bid first") · players nobody can afford skip instantly ·
host: pause/resume, force-finalize, end auction · refresh/reconnect keeps your seat (same device) ·
host auto-transfers if the host drops for 20s · franchises without an owner don't bid.

## Structure
```
server/  index.js (sockets)  engine.js (all rules)  data.js (players)  test/simulate.js (bot test)
client/  src/components/*  src/hooks/GameContext.jsx (socket+state)  styles.css (your original CSS)  lobby.css (new bits)
```
`npm test` plays full 7-player auctions with bots against the real server.
