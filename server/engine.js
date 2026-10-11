/*
 * IPL Mega Auction 2026 — multiplayer room engine.
 *
 * The server is the single source of truth. Clients only send intents
 * (bid, use RTM, pick team, ...) and render whatever state comes back.
 *
 * Room lifecycle:
 *   lobby      -> players join with the room code and pick a franchise
 *   retention  -> every owner retains up to 2 of last season's players
 *   auction    -> live bidding (15s opening timer, resets to 10s on each bid)
 *   ended      -> results + Playing XI editing
 */
const crypto = require("crypto");
const { TEAMS_CONFIG, PLAYERS_DB, LAST_SEASON_MAP } = require("./data");

// ─── Rules ─────────────────────────────────────────────────────────────
const MIN_PLAYERS = Number(process.env.MIN_PLAYERS) || 2;
const MAX_PLAYERS = 10;
const START_PURSE = 100; // crore
// TIMER_SCALE only exists so automated tests can run a full auction in seconds.
const T = Number(process.env.TIMER_SCALE) || 1;
const OPEN_TIMER_MS = 15000 * T; // first countdown for every player
const BID_TIMER_MS = 10000 * T; // countdown after each bid
const RTM_WINDOW_MS = 12000 * T; // time the previous franchise has to use RTM
const SOLD_PAUSE_MS = 5500 * T; // pause after SOLD / RTM
const UNSOLD_PAUSE_MS = 4500 * T; // pause after UNSOLD
// Opening ceremony (crowd 8s + announcer 77.6s + clapping 4s). Bidding starts only after it ends.
const INTRO_MS = 90000 * T;
const ALLOWED_INCREMENTS = [0.25, 0.5, 1];
const MAX_RETENTIONS = 2;
const MAX_SQUAD = 25;
const MAX_OVERSEAS_SQUAD = 8;
const MAX_OVERSEAS_XI = 4;
const CATEGORY_ORDER = ["Grade A", "Grade B", "Batting", "Bowling", "Fielding"];
const HOST_GRACE_MS = 20000;
const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000;

const round2 = (n) => Math.round(n * 100) / 100;
const isOverseas = (p) => p.country !== "India";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Same stat generator as the original single-player game (generated once per room
// so every client sees identical numbers).
function generateStats(role) {
  const r = (n) => Math.floor(Math.random() * n);
  const f = (n, add, d = 1) => (Math.random() * n + add).toFixed(d);
  const matches = r(100) + 20;
  if (role === "Bowler") {
    return {
      matches, runs: r(400) + 50, avg: f(15, 5), sr: f(50, 60), hs: r(35) + 5,
      wkts: r(120) + 20, eco: f(2, 6.5, 2), best: `${r(4) + 2}/${r(30) + 10}`,
    };
  }
  if (role === "All-Rounder") {
    return {
      matches, runs: r(2000) + 500, avg: f(20, 20), sr: f(40, 120), hs: r(60) + 40,
      wkts: r(60) + 10, eco: f(2, 7, 2), best: `${r(3) + 1}/${r(25) + 10}`,
    };
  }
  return {
    matches, runs: r(4000) + 1000, avg: f(30, 25), sr: f(40, 120), hs: r(80) + 60,
    wkts: "—", eco: "—", best: "—",
  };
}

function buildCatalog() {
  const seen = new Set();
  return PLAYERS_DB.filter((p) => {
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  }).map((p, i) => ({
    ...p,
    id: i,
    lastTeam: LAST_SEASON_MAP[p.name] || null,
    stats: generateStats(p.role),
  }));
}

// ─── Room ──────────────────────────────────────────────────────────────
class Room {
  constructor(code, io) {
    this.io = io;
    this.code = code;
    this.hostId = null;
    this.status = "lobby"; // lobby | retention | auction | ended
    this.createdAt = Date.now();
    this.emptySince = null;

    this.members = new Map(); // playerId -> { id, name, token, teamId, connected, retentionLocked }
    this.tokens = new Map(); // secret token -> playerId

    this.catalog = buildCatalog();
    this.playerStatus = new Map(this.catalog.map((p) => [p.id, "pending"])); // pending | sold | unsold

    this.teams = TEAMS_CONFIG.map((t) => ({
      id: t.id, name: t.name, full: t.full, color: t.color,
      remaining: START_PURSE,
      ownerId: null,
      purchased: [], // { playerId, name, role, country, price, isRTM, isRetention }
      playingEleven: [], // playerIds
      rtmCards: 1,
    }));

    this.soldLog = []; // rail: { name, price, teamId, teamName, retention }
    this.queue = [];
    this.round = 1;
    this.auction = this._idleAuction();

    this._timer = null; // bidding countdown / RTM window
    this._nextTimer = null; // pause between players
    this._hostTimer = null;
  }

  _idleAuction() {
    return {
      phase: "idle", // idle | intro | bidding | rtm | between
      introEndsAt: null,
      paused: false,
      playerId: null,
      currentBid: 0,
      lastBidder: null,
      involvedTeams: [],
      timerEndsAt: null,
      timerTotalMs: OPEN_TIMER_MS,
      remainingMs: null, // only while paused
      rtm: null, // { exTeamId, winningTeamId, price, endsAt }
    };
  }

  // ─── helpers ─────────────────────────────────────────────────────────
  team(id) { return this.teams.find((t) => t.id === id); }
  teamOf(playerId) { return this.teams.find((t) => t.ownerId === playerId); }
  cat(id) { return this.catalog[id]; }
  emit(event, payload) { this.io.to(this.code).emit(event, payload); }
  broadcast() { this.emit("room:state", this.publicState()); }
  isHost(playerId) { return this.hostId === playerId; }

  overseasCount(team) {
    return team.purchased.filter((p) => p.country !== "India").length;
  }

  // Can this team legally take one more player of this nationality?
  canAddPlayer(team, player) {
    if (team.purchased.length >= MAX_SQUAD) return "Squad is full (25 players max).";
    if (isOverseas(player) && this.overseasCount(team) >= MAX_OVERSEAS_SQUAD) {
      return "Overseas limit reached (8 max in squad).";
    }
    return null;
  }

  humanTeams() { return this.teams.filter((t) => t.ownerId); }

  // ─── members ─────────────────────────────────────────────────────────
  join({ name, token }) {
    const existingId = this.tokens.get(token);
    if (existingId) {
      const m = this.members.get(existingId);
      m.connected = true;
      if (name) m.name = name;
      this._cancelHostGrace(m.id);
      this.emptySince = null;
      return m;
    }
    if (this.status !== "lobby") throw new Error("Auction already started — only existing players can rejoin.");
    if (this.members.size >= MAX_PLAYERS) throw new Error(`Room is full (max ${MAX_PLAYERS}).`);
    const id = crypto.randomBytes(4).toString("hex");
    const m = {
      id, token, name: (name || "Player").trim().slice(0, 20) || "Player",
      teamId: null, connected: true, retentionLocked: false,
    };
    this.members.set(id, m);
    this.tokens.set(token, id);
    if (!this.hostId) this.hostId = id;
    this.emptySince = null;
    return m;
  }

  rejoin(token) {
    const id = this.tokens.get(token);
    if (!id) throw new Error("You are not part of this room.");
    const m = this.members.get(id);
    m.connected = true;
    this._cancelHostGrace(id);
    this.emptySince = null;
    return m;
  }

  leave(playerId) {
    if (this.status !== "lobby") throw new Error("You can't leave once the auction has started.");
    const m = this.members.get(playerId);
    if (!m) return;
    const t = this.teamOf(playerId);
    if (t) t.ownerId = null;
    this.members.delete(playerId);
    this.tokens.delete(m.token);
    if (this.hostId === playerId) this._reassignHost();
  }

  setDisconnected(playerId) {
    const m = this.members.get(playerId);
    if (!m) return;
    m.connected = false;
    if (![...this.members.values()].some((x) => x.connected)) this.emptySince = Date.now();
    if (this.hostId === playerId) {
      clearTimeout(this._hostTimer);
      this._hostTimer = setTimeout(() => {
        const h = this.members.get(this.hostId);
        if (h && !h.connected) {
          this._reassignHost();
          this.broadcast();
        }
      }, HOST_GRACE_MS);
    }
  }

  _cancelHostGrace(playerId) {
    if (this.hostId === playerId) clearTimeout(this._hostTimer);
  }

  _reassignHost() {
    const next = [...this.members.values()].find((m) => m.connected) || [...this.members.values()][0];
    this.hostId = next ? next.id : null;
  }

  // ─── lobby ───────────────────────────────────────────────────────────
  selectTeam(playerId, teamId) {
    if (this.status !== "lobby") throw new Error("Franchises are locked once the game starts.");
    const m = this.members.get(playerId);
    const team = this.team(teamId);
    if (!m || !team) throw new Error("Invalid team.");
    if (team.ownerId && team.ownerId !== playerId) throw new Error(`${team.name} is already taken.`);
    const prev = this.teamOf(playerId);
    if (prev) prev.ownerId = null;
    team.ownerId = playerId;
    m.teamId = teamId;
  }

  readyCount() {
    return [...this.members.values()].filter((m) => m.teamId).length;
  }

  startRetention(playerId) {
    if (!this.isHost(playerId)) throw new Error("Only the host can start the game.");
    if (this.status !== "lobby") throw new Error("Game already started.");
    const n = this.readyCount();
    if (n < MIN_PLAYERS || n > MAX_PLAYERS) {
      throw new Error(`Need ${MIN_PLAYERS}-${MAX_PLAYERS} players with a franchise (currently ${n}).`);
    }
    // Anyone who joined but never picked a franchise is removed.
    for (const m of [...this.members.values()]) {
      if (!m.teamId) { this.members.delete(m.id); this.tokens.delete(m.token); }
    }
    this.status = "retention";
    this.emit("auction:event", { type: "retention" });
    this.broadcast();
  }

  // ─── retention ───────────────────────────────────────────────────────
  retentionCandidates(teamId) {
    return this.catalog.filter((p) => p.lastTeam === teamId);
  }

  setRetentions(playerId, picks) {
    if (this.status !== "retention") throw new Error("Retention phase is not active.");
    const m = this.members.get(playerId);
    const team = this.teamOf(playerId);
    if (!m || !team) throw new Error("You have no franchise.");
    if (m.retentionLocked) throw new Error("Unlock your retentions before editing.");
    if (!Array.isArray(picks)) throw new Error("Invalid retention list.");
    if (picks.length > MAX_RETENTIONS) throw new Error(`You can retain up to ${MAX_RETENTIONS} players.`);

    const seen = new Set();
    const clean = picks.map((pk) => {
      const p = this.cat(Number(pk.playerId));
      if (!p) throw new Error("Unknown player.");
      if (p.lastTeam !== team.id) throw new Error(`${p.name} was not with ${team.name} last season.`);
      if (seen.has(p.id)) throw new Error("Duplicate player in retention list.");
      seen.add(p.id);
      let price = round2(Number(pk.price));
      if (!Number.isFinite(price) || price < p.base) price = p.base;
      return { p, price };
    });
    const total = round2(clean.reduce((a, c) => a + c.price, 0));
    if (total > START_PURSE) throw new Error("Retention cost exceeds the purse.");

    // revert previous retentions for this team
    for (const old of team.purchased.filter((x) => x.isRetention)) {
      this.playerStatus.set(old.playerId, "pending");
    }
    team.purchased = team.purchased.filter((x) => !x.isRetention);
    this.soldLog = this.soldLog.filter((s) => !(s.retention && s.teamId === team.id));

    for (const { p, price } of clean) {
      team.purchased.push({
        playerId: p.id, name: p.name, role: p.role, country: p.country,
        price, isRTM: false, isRetention: true,
      });
      this.playerStatus.set(p.id, "sold");
      this.soldLog.push({ name: p.name, price, teamId: team.id, teamName: team.name, retention: true });
    }
    team.remaining = round2(START_PURSE - total);
    this.broadcast();
  }

  lockRetentions(playerId, locked) {
    if (this.status !== "retention") throw new Error("Retention phase is not active.");
    const m = this.members.get(playerId);
    if (!m) throw new Error("Not in this room.");
    m.retentionLocked = !!locked;
    this.broadcast();
  }

  // ─── auction flow ────────────────────────────────────────────────────
  startAuction(playerId, force = false) {
    if (!this.isHost(playerId)) throw new Error("Only the host can start the auction.");
    if (this.status !== "retention") throw new Error("Retention phase is not active.");
    const waiting = [...this.members.values()].filter((m) => !m.retentionLocked);
    if (waiting.length && !force) {
      throw new Error(`Waiting for ${waiting.map((w) => w.name).join(", ")} to lock retentions.`);
    }
    // Build the order: IPL-style sets (marquee grades first, then batters, bowlers, all-rounders)
    const pending = this.catalog.filter((p) => this.playerStatus.get(p.id) === "pending");
    this.queue = [];
    for (const c of CATEGORY_ORDER) {
      this.queue.push(...shuffle(pending.filter((p) => p.category === c)).map((p) => p.id));
    }
    this.round = 1;
    this.status = "auction";
    this.auction = { ...this._idleAuction(), phase: "intro", introEndsAt: Date.now() + INTRO_MS };
    this.emit("auction:event", { type: "started" });
    this.broadcast();
    this._nextTimer = setTimeout(() => this._nextPlayer(), INTRO_MS);
  }

  _nextPlayer() {
    clearTimeout(this._timer);
    clearTimeout(this._nextTimer);
    if (this.status !== "auction") return;

    while (this.queue.length) {
      const id = this.queue.shift();
      if (this.playerStatus.get(id) !== "pending") continue;
      this._startPlayer(id);
      return;
    }

    // Accelerated round: unsold players come back once.
    if (this.round === 1) {
      const unsold = this.catalog.filter((p) => this.playerStatus.get(p.id) === "unsold");
      if (unsold.length) {
        this.round = 2;
        unsold.forEach((p) => this.playerStatus.set(p.id, "pending"));
        this.queue = shuffle(unsold.map((p) => p.id));
        this.emit("auction:event", { type: "round2", count: unsold.length });
        this._nextTimer = setTimeout(() => this._nextPlayer(), 2500 * T);
        this.auction = { ...this._idleAuction(), phase: "between" };
        this.broadcast();
        return;
      }
    }
    this._endAuction();
  }

  _startPlayer(id) {
    const p = this.cat(id);
    this.auction = {
      ...this._idleAuction(),
      phase: "bidding",
      playerId: id,
      currentBid: p.base,
      timerEndsAt: Date.now() + OPEN_TIMER_MS,
      timerTotalMs: OPEN_TIMER_MS,
    };
    // Nobody can afford / take this player? Don't waste 15 seconds.
    const canAnyone = this.humanTeams().some(
      (t) => t.remaining >= round2(p.base + 0.25) && !this.canAddPlayer(t, p)
    );
    if (!canAnyone) {
      this.auction.timerEndsAt = Date.now() + 2000 * T;
    }
    this._armBidTimer();
    this.emit("auction:event", { type: "next", playerId: id, round: this.round });
    this.broadcast();
  }

  _armBidTimer() {
    clearTimeout(this._timer);
    const ms = Math.max(0, this.auction.timerEndsAt - Date.now());
    this._timer = setTimeout(() => this._closeBidding(), ms);
  }

  bid(playerId, increment, expected) {
    const a = this.auction;
    if (this.status !== "auction" || a.phase !== "bidding") throw new Error("No player is up for bidding right now.");
    if (a.paused) throw new Error("Auction is paused by the host.");
    const team = this.teamOf(playerId);
    if (!team) throw new Error("You have no franchise.");
    const inc = Number(increment);
    if (!ALLOWED_INCREMENTS.includes(inc)) throw new Error("Invalid bid increment.");
    if (expected != null && round2(Number(expected)) !== round2(a.currentBid)) {
      throw new Error(`Someone bid first — price is now ₹${a.currentBid.toFixed(2)} Cr.`);
    }
    if (a.lastBidder === team.id) throw new Error("You are already the highest bidder.");
    const player = this.cat(a.playerId);
    const problem = this.canAddPlayer(team, player);
    if (problem) throw new Error(problem);
    const amount = round2(a.currentBid + inc);
    if (team.remaining < amount) throw new Error("⚠️ Insufficient funds!");

    a.currentBid = amount;
    a.lastBidder = team.id;
    if (!a.involvedTeams.includes(team.id)) a.involvedTeams.push(team.id);
    a.timerEndsAt = Date.now() + BID_TIMER_MS;
    a.timerTotalMs = BID_TIMER_MS;
    this._armBidTimer();
    this.emit("auction:event", { type: "bid", teamId: team.id, teamName: team.name, amount });
    this.broadcast();
  }

  _closeBidding() {
    const a = this.auction;
    if (this.status !== "auction" || a.phase !== "bidding") return;
    clearTimeout(this._timer);
    const player = this.cat(a.playerId);

    if (!a.lastBidder) {
      this.playerStatus.set(player.id, "unsold");
      this.emit("auction:event", { type: "unsold", playerId: player.id, name: player.name });
      a.phase = "between";
      a.timerEndsAt = null;
      this.broadcast();
      this._nextTimer = setTimeout(() => this._nextPlayer(), UNSOLD_PAUSE_MS);
      return;
    }

    // Right To Match: previous franchise (if a human owns it) may match the winning bid.
    const ex = player.lastTeam ? this.team(player.lastTeam) : null;
    const winner = this.team(a.lastBidder);
    const exOwner = ex && ex.ownerId ? this.members.get(ex.ownerId) : null;
    const eligible =
      ex && exOwner && exOwner.connected && ex.id !== winner.id && ex.rtmCards > 0 &&
      ex.remaining >= a.currentBid && !this.canAddPlayer(ex, player);

    if (eligible) {
      a.phase = "rtm";
      a.timerEndsAt = null;
      a.rtm = {
        exTeamId: ex.id, winningTeamId: winner.id,
        stage: "decide", // decide (ex-team) -> raise (winner) -> final (ex-team)
        basePrice: a.currentBid, price: a.currentBid,
        endsAt: 0,
      };
      this._armRtm();
      this.emit("auction:event", { type: "rtm-offer", exTeamId: ex.id, price: a.currentBid });
      this.broadcast();
    } else {
      this._finalizeSold(player, winner, a.currentBid, false);
    }
  }

  // ─── Right To Match (IPL style) ─────────────────────────────────────
  //  1. decide: previous franchise says "use RTM" or "pass" at the winning price.
  //  2. raise : the winning franchise may raise the price once (any amount above it).
  //  3. final : previous franchise matches the raised price (card is spent) or cancels
  //             (winner gets the player at the raised price and the RTM card is KEPT).
  _armRtm() {
    const a = this.auction;
    clearTimeout(this._timer);
    a.rtm.endsAt = Date.now() + RTM_WINDOW_MS;
    this._timer = setTimeout(() => this._rtmTimeout(), RTM_WINDOW_MS);
  }

  // Nobody answered in time (or host forced it).
  _rtmTimeout() {
    const a = this.auction;
    if (a.phase !== "rtm" || !a.rtm) return;
    const { stage, exTeamId, winningTeamId, price } = a.rtm;
    if (stage === "raise") return this._rtmEnd(this.team(exTeamId), price, true); // no raise -> ex-team gets it
    return this._rtmEnd(this.team(winningTeamId), price, false); // pass / cancel -> winner gets it
  }

  // Settle the RTM: `team` gets the player at `price`. `spendCard` = ex-team matched.
  _rtmEnd(team, price, spendCard) {
    const a = this.auction;
    clearTimeout(this._timer);
    const player = this.cat(a.playerId);
    if (spendCard) this.team(a.rtm.exTeamId).rtmCards--;
    a.rtm = null;
    this._finalizeSold(player, team, price, spendCard);
  }

  useRTM(playerId, use) {
    const a = this.auction;
    if (a.phase !== "rtm" || !a.rtm || a.rtm.stage !== "decide") throw new Error("There is no RTM decision pending.");
    const team = this.teamOf(playerId);
    if (!team || team.id !== a.rtm.exTeamId) throw new Error("Only the previous franchise can decide RTM.");
    if (!use) return this._rtmEnd(this.team(a.rtm.winningTeamId), a.rtm.price, false);
    a.rtm.stage = "raise";
    this._armRtm();
    this.emit("auction:event", {
      type: "rtm-used", exTeamId: a.rtm.exTeamId, winningTeamId: a.rtm.winningTeamId, price: a.rtm.price,
    });
    this.broadcast();
  }

  // Winning franchise: raise the price (amount) or stand pat (amount = null).
  rtmRaise(playerId, amount) {
    const a = this.auction;
    if (a.phase !== "rtm" || !a.rtm || a.rtm.stage !== "raise") throw new Error("You can't raise right now.");
    const team = this.teamOf(playerId);
    if (!team || team.id !== a.rtm.winningTeamId) throw new Error("Only the winning franchise can raise.");
    if (amount == null) return this._rtmEnd(this.team(a.rtm.exTeamId), a.rtm.price, true);
    const raised = round2(Number(amount));
    if (!Number.isFinite(raised) || raised <= a.rtm.price) {
      throw new Error(`Raise must be higher than ₹${a.rtm.price.toFixed(2)} Cr.`);
    }
    if (team.remaining < raised) throw new Error("⚠️ Insufficient funds for that raise!");
    a.rtm.price = raised;
    a.rtm.stage = "final";
    this._armRtm();
    this.emit("auction:event", {
      type: "rtm-raised", teamId: team.id, teamName: team.name, exTeamId: a.rtm.exTeamId, price: raised,
    });
    this.broadcast();
  }

  // Previous franchise: match the raised price (spends the card) or cancel (keeps the card).
  rtmFinal(playerId, match) {
    const a = this.auction;
    if (a.phase !== "rtm" || !a.rtm || a.rtm.stage !== "final") throw new Error("There is no RTM decision pending.");
    const team = this.teamOf(playerId);
    if (!team || team.id !== a.rtm.exTeamId) throw new Error("Only the previous franchise can decide.");
    if (match) {
      if (team.remaining < a.rtm.price) throw new Error("⚠️ Not enough purse to match that price.");
      return this._rtmEnd(team, a.rtm.price, true);
    }
    this.emit("auction:event", { type: "rtm-cancelled", exTeamId: team.id });
    return this._rtmEnd(this.team(a.rtm.winningTeamId), a.rtm.price, false);
  }

  _finalizeSold(player, team, price, isRTM) {
    const a = this.auction;
    team.remaining = round2(team.remaining - price);
    team.purchased.push({
      playerId: player.id, name: player.name, role: player.role, country: player.country,
      price, isRTM, isRetention: false,
    });
    this.playerStatus.set(player.id, "sold");
    this.soldLog.push({ name: player.name, price, teamId: team.id, teamName: team.name, retention: false });
    a.phase = "between";
    a.timerEndsAt = null;
    this.emit("auction:event", {
      type: "sold", playerId: player.id, name: player.name,
      teamId: team.id, teamName: team.name, price, isRTM,
    });
    this.broadcast();
    this._nextTimer = setTimeout(() => this._nextPlayer(), SOLD_PAUSE_MS);
  }

  // ─── host controls ───────────────────────────────────────────────────
  skip(playerId) {
    if (!this.isHost(playerId)) throw new Error("Only the host can skip.");
    const a = this.auction;
    if (this.status !== "auction") return;
    if (a.phase === "intro") {
      clearTimeout(this._nextTimer);
      this.emit("auction:event", { type: "intro-skipped" });
      return this._nextPlayer();
    }
    if (a.phase === "rtm") return this._rtmTimeout();
    if (a.phase === "bidding") {
      a.paused = false;
      this._closeBidding();
    }
  }

  pause(playerId, paused) {
    if (!this.isHost(playerId)) throw new Error("Only the host can pause.");
    const a = this.auction;
    if (this.status !== "auction" || a.phase !== "bidding") throw new Error("Nothing to pause right now.");
    if (paused && !a.paused) {
      clearTimeout(this._timer);
      a.paused = true;
      a.remainingMs = Math.max(0, a.timerEndsAt - Date.now());
      a.timerEndsAt = null;
    } else if (!paused && a.paused) {
      a.paused = false;
      a.timerEndsAt = Date.now() + (a.remainingMs ?? BID_TIMER_MS);
      a.remainingMs = null;
      this._armBidTimer();
    }
    this.emit("auction:event", { type: paused ? "paused" : "resumed" });
    this.broadcast();
  }

  endAuction(playerId) {
    if (!this.isHost(playerId)) throw new Error("Only the host can end the auction.");
    if (this.status !== "auction") throw new Error("Auction is not live.");
    this._endAuction();
  }

  _endAuction() {
    clearTimeout(this._timer);
    clearTimeout(this._nextTimer);
    this.status = "ended";
    this.auction = this._idleAuction();
    // Auto-pick a best XI for any franchise that didn't set one (max 4 overseas).
    for (const t of this.humanTeams()) {
      if (t.playingEleven.length === 0) t.playingEleven = this._autoXI(t);
    }
    this.emit("auction:event", { type: "ended" });
    this.broadcast();
  }

  _autoXI(team) {
    const sorted = [...team.purchased].sort((a, b) => b.price - a.price);
    const xi = [];
    let overseas = 0;
    for (const p of sorted) {
      if (xi.length >= 11) break;
      if (p.country !== "India") {
        if (overseas >= MAX_OVERSEAS_XI) continue;
        overseas++;
      }
      xi.push(p.playerId);
    }
    return xi;
  }

  // ─── playing XI ──────────────────────────────────────────────────────
  setPlayingXI(playerId, ids) {
    const team = this.teamOf(playerId);
    if (!team) throw new Error("You have no franchise.");
    if (!Array.isArray(ids)) throw new Error("Invalid Playing XI.");
    const unique = [...new Set(ids.map(Number))];
    if (unique.length > 11) throw new Error("Playing XI is full!");
    const owned = new Set(team.purchased.map((p) => p.playerId));
    if (!unique.every((id) => owned.has(id))) throw new Error("That player is not in your squad.");
    const overseas = unique.filter((id) => isOverseas(this.cat(id))).length;
    if (overseas > MAX_OVERSEAS_XI) throw new Error(`Max ${MAX_OVERSEAS_XI} overseas players in Playing XI!`);
    team.playingEleven = unique;
    this.broadcast();
  }

  // ─── serialization ───────────────────────────────────────────────────
  catalogPayload() {
    return this.catalog.map((p) => ({
      id: p.id, name: p.name, country: p.country, role: p.role,
      base: p.base, category: p.category, lastTeam: p.lastTeam, stats: p.stats,
    }));
  }

  publicState() {
    const a = this.auction;
    const unsoldIds = [];
    for (const [id, st] of this.playerStatus) if (st === "unsold") unsoldIds.push(id);
    return {
      serverNow: Date.now(),
      code: this.code,
      status: this.status,
      hostId: this.hostId,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      limits: {
        maxSquad: MAX_SQUAD, maxOverseasSquad: MAX_OVERSEAS_SQUAD,
        maxOverseasXI: MAX_OVERSEAS_XI, maxRetentions: MAX_RETENTIONS,
        increments: ALLOWED_INCREMENTS,
      },
      players: [...this.members.values()].map((m) => ({
        id: m.id, name: m.name, teamId: m.teamId, connected: m.connected,
        retentionLocked: m.retentionLocked,
      })),
      teams: this.teams.map((t) => ({
        id: t.id, name: t.name, full: t.full, color: t.color,
        remaining: t.remaining,
        ownerId: t.ownerId,
        ownerName: t.ownerId ? this.members.get(t.ownerId)?.name : null,
        purchased: t.purchased,
        playingEleven: t.playingEleven,
        rtmCards: t.rtmCards,
      })),
      auction: {
        phase: a.phase,
        introEndsAt: a.introEndsAt,
        paused: a.paused,
        playerId: a.playerId,
        currentBid: a.currentBid,
        lastBidder: a.lastBidder,
        involvedTeams: a.involvedTeams,
        timerEndsAt: a.timerEndsAt,
        timerTotalMs: a.timerTotalMs,
        remainingMs: a.remainingMs,
        rtm: a.rtm,
        round: this.round,
        queueRemaining: this.queue.length,
      },
      soldLog: this.soldLog,
      unsoldIds,
    };
  }

  dispose() {
    clearTimeout(this._timer);
    clearTimeout(this._nextTimer);
    clearTimeout(this._hostTimer);
  }
}

// ─── Room manager ──────────────────────────────────────────────────────
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this._sweep = setInterval(() => this.sweep(), 60 * 1000);
    this._sweep.unref?.();
  }

  create() {
    let code;
    do {
      code = Array.from({ length: 5 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join("");
    } while (this.rooms.has(code));
    const room = new Room(code, this.io);
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(String(code || "").trim().toUpperCase());
  }

  sweep() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = { RoomManager, Room, MIN_PLAYERS, MAX_PLAYERS };