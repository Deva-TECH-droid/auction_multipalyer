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
 *   ended      -> every squad has 15+ players; owners set their Playing XI
 *   results    -> host reveals the 30-mark evaluation and the winner
 */
const crypto = require("crypto");
const { TEAMS_CONFIG, PLAYERS_DB, LAST_SEASON_MAP } = require("./data");
const { buildResults, quality, selectBalancedXI, teamPoints, buildTeamLeaderboard, computeBuys } = require("./scoring");
const { IPL_STATS } = require("./iplStats");

// Never let a placeholder like "Batsman 3" into a room.
const GENERIC_NAME = /^(batsman|batter|bowler|all-?rounder|wicket-?keeper|player)\s*\d+$/i;

// ─── Rules ─────────────────────────────────────────────────────────────
const MIN_PLAYERS = Number(process.env.MIN_PLAYERS) || 2;
const MAX_PLAYERS = 10;
const START_PURSE = 100; // crore
// TIMER_SCALE only exists so automated tests can run a full auction in seconds.
const T = Number(process.env.TIMER_SCALE) || 1;
const OPEN_TIMER_MS = 15000 * T; // first countdown for every player
const BID_TIMER_MS = 10000 * T; // countdown after each bid
const RTM_WINDOW_MS = 12000 * T; // time the previous franchise has to use RTM
const SOLD_PAUSE_MS = 3000 * T; // pause after SOLD / RTM (exactly 3 seconds before next player auction starts)
const UNSOLD_PAUSE_MS = 4500 * T; // pause after UNSOLD
// Opening ceremony (crowd 8s + announcer 77.6s + clapping 4s). Bidding starts only after it ends.
const INTRO_MS = 90000 * T;
const ALLOWED_INCREMENTS = [0.25, 0.5, 1];
const MAX_RETENTIONS = 2;
const MIN_RETENTION_PRICE = 15; // crore — a player can never be retained for less than this
const MIN_SQUAD = 15; // the auction finishes once every franchise has this many players
const MIN_BASE = Math.min(...PLAYERS_DB.map((p) => p.base)); // cheapest possible signing
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

function buildCatalog() {
  const seen = new Set();
  return PLAYERS_DB.filter((p) => {
    if (GENERIC_NAME.test(p.name.trim())) return false;
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  }).map((p, i) => ({
    ...p,
    id: i,
    lastTeam: LAST_SEASON_MAP[p.name] || null,
    stats: IPL_STATS[p.name] || null, // real IPL 2026 numbers only (null = not available)
  }));
}

// ─── Room ──────────────────────────────────────────────────────────────
class Room {
  constructor(code, io) {
    this.io = io;
    this.code = code;
    this.hostId = null;
    this.status = "lobby"; // lobby | retention | auction | ended | results
    this.results = null;
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
      xiSource: null, // "ai" | "manual"
      rtmCards: MAX_RETENTIONS, // 2 cards with 0 retentions · 1 with 1 · 0 with 2 (kept in sync with the retention picks)
    }));

    this.soldLog = []; // rail: { name, price, teamId, teamName, retention }
    this.sets = {}; // category -> [playerId] still to be auctioned
    this.currentSet = null; // category the auction is currently drawing players from
    this.round = 1;
    this.auction = this._idleAuction();

    this._timer = null; // bidding countdown / RTM window
    this._nextTimer = null; // pause between players
    this._hostTimer = null;
  }

  _idleAuction() {
    return {
      phase: "idle", // idle | intro | bidding | rtm | between | complete
      introEndsAt: null,
      paused: false,
      playerId: null,
      currentBid: 0,
      lastBidder: null,
      involvedTeams: [],
      contenders: [], // max 2 teams may bid on a player at one time (the "bidding war")
      outTeams: [], // teams that withdrew (went Out) on this player
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

  // After buying one more player at `amount`, can the team still fill its squad to 15
  // (every remaining slot at the cheapest base price)?
  reserveOk(team, amount) {
    const slotsAfter = Math.max(0, MIN_SQUAD - (team.purchased.length + 1));
    return round2(team.remaining - amount) >= round2(slotsAfter * MIN_BASE);
  }
  reserveNeeded(team) {
    return round2(Math.max(0, MIN_SQUAD - (team.purchased.length + 1)) * MIN_BASE);
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
  // RTM cards depend only on how many players the franchise retained:
  //   0 retained -> 2 cards · 1 retained -> 1 card · 2 retained -> 0 cards
  rtmCardsFor(team) {
    return Math.max(0, MAX_RETENTIONS - team.purchased.filter((p) => p.isRetention).length);
  }

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
      const price = round2(Number(pk.price));
      if (!Number.isFinite(price) || price < MIN_RETENTION_PRICE) {
        throw new Error(`Minimum retention price is ₹${MIN_RETENTION_PRICE} Cr (${p.name}). You can pay more, never less.`);
      }
      return { p, price };
    });
    const total = round2(clean.reduce((a, c) => a + c.price, 0));
    if (total > START_PURSE) throw new Error("Retention cost exceeds the purse.");
    const mustKeep = round2(Math.max(0, MIN_SQUAD - clean.length) * MIN_BASE);
    if (START_PURSE - total < mustKeep) {
      throw new Error(`Keep at least ₹${mustKeep.toFixed(2)} Cr in the purse to fill a 15-player squad.`);
    }

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
    team.rtmCards = this.rtmCardsFor(team); // live: shown on every screen while retentions are edited
    this.broadcast();
  }

  lockRetentions(playerId, locked) {
    if (this.status !== "retention") throw new Error("Retention phase is not active.");
    const m = this.members.get(playerId);
    if (!m) throw new Error("Not in this room.");
    m.retentionLocked = !!locked;
    this.broadcast();
  }

  startRetentionReveal(playerId, force = false) {
    if (!this.isHost(playerId)) throw new Error("Only the host can start the retention reveal.");
    if (this.status !== "retention") throw new Error("Retention phase is not active.");
    const waiting = [...this.members.values()].filter((m) => !m.retentionLocked);
    if (waiting.length && !force) {
      throw new Error(`Waiting for ${waiting.map((w) => w.name).join(", ")} to lock retentions.`);
    }
    this.retentionRevealing = true;
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
    this.retentionRevealing = false;
    for (const t of this.teams) t.rtmCards = this.rtmCardsFor(t); // final, authoritative count
    // Build the order: IPL-style sets (marquee grades first, then batters, bowlers, all-rounders)
    const pending = this.catalog.filter((p) => this.playerStatus.get(p.id) === "pending");
    this._buildSets(pending.map((p) => p.id));
    this.round = 1;
    this.status = "auction";
    this.auction = { ...this._idleAuction(), phase: "intro", introEndsAt: Date.now() + INTRO_MS };
    this.emit("auction:event", { type: "started" });
    this.broadcast();
    this._nextTimer = setTimeout(() => this._nextPlayer(), INTRO_MS);
  }

  // Group the given players into one shuffled list per category (Grade A, Grade B, Batting, ...).
  _buildSets(ids) {
    this.sets = {};
    for (const c of CATEGORY_ORDER) {
      this.sets[c] = shuffle(ids.filter((id) => this.cat(id).category === c));
    }
    this.currentSet = CATEGORY_ORDER.find((c) => this.sets[c].length) || null;
  }

  remainingCount() {
    return CATEGORY_ORDER.reduce((n, c) => n + (this.sets[c] || []).length, 0);
  }

  // Next player from the current category; when it is empty, move to the next category that has players.
  _takeNext() {
    let c = this.currentSet;
    if (!c || !(this.sets[c] || []).length) c = CATEGORY_ORDER.find((x) => (this.sets[x] || []).length);
    if (!c) return null;
    this.currentSet = c;
    return this.sets[c].shift();
  }

  // Host: stop drawing from the current category (finished or not) and continue with another one.
  // The player on the block finishes normally; the NEXT player comes from the chosen category.
  setCategory(playerId, category) {
    if (!this.isHost(playerId)) throw new Error("Only the host can switch the category.");
    if (this.status !== "auction") throw new Error("The auction is not live.");
    if (this.auction.phase === "complete") throw new Error("All squads are complete — press End Auction.");
    if (!CATEGORY_ORDER.includes(category)) throw new Error("Unknown category.");
    if (!(this.sets[category] || []).length) throw new Error("No players left in that category.");
    this.currentSet = category;
    this.emit("auction:event", { type: "category", category });
    this.broadcast();
  }

  _nextPlayer() {
    clearTimeout(this._timer);
    clearTimeout(this._nextTimer);
    if (this.status !== "auction") return;

    // Every franchise has its 15 players -> the auction is over.
    const owned = this.humanTeams();
    if (owned.length && owned.every((t) => t.purchased.length >= MIN_SQUAD)) {
      this.auction = { ...this._idleAuction(), phase: "complete" };
      this.emit("auction:event", { type: "squads-complete" });
      this.broadcast();
      return;
    }

    for (let id = this._takeNext(); id !== null; id = this._takeNext()) {
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
        this._buildSets(unsold.map((p) => p.id));
        this.emit("auction:event", { type: "round2", count: unsold.length });
        this._nextTimer = setTimeout(() => this._nextPlayer(), 2500 * T);
        this.auction = { ...this._idleAuction(), phase: "between" };
        this.broadcast();
        return;
      }
    }
    this._endAuction("pool-empty");
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
      (t) => this.reserveOk(t, round2(p.base + 0.25)) && !this.canAddPlayer(t, p)
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
    if (a.outTeams.includes(team.id)) throw new Error("You went Out on this player — you can't bid on him again.");
    if (!a.contenders.includes(team.id) && a.contenders.length >= 2) {
      const names = a.contenders.map((id) => this.team(id).name).join(" and ");
      throw new Error(`Bidding war between ${names} — you can bid only after one of them goes Out.`);
    }
    const player = this.cat(a.playerId);
    const problem = this.canAddPlayer(team, player);
    if (problem) throw new Error(problem);
    const amount = round2(a.currentBid + inc);
    if (team.remaining < amount) throw new Error("⚠️ Insufficient funds!");
    if (!this.reserveOk(team, amount)) {
      throw new Error(`Keep ₹${this.reserveNeeded(team).toFixed(2)} Cr aside to fill your squad to 15 players.`);
    }

    a.currentBid = amount;
    a.lastBidder = team.id;
    if (!a.involvedTeams.includes(team.id)) a.involvedTeams.push(team.id);
    if (!a.contenders.includes(team.id)) a.contenders.push(team.id);
    a.timerEndsAt = Date.now() + BID_TIMER_MS;
    a.timerTotalMs = BID_TIMER_MS;
    this._armBidTimer();
    this.emit("auction:event", { type: "bid", teamId: team.id, teamName: team.name, amount });
    this.broadcast();
  }

  // A team in the bidding war withdraws. Only the trailing team can go Out (the leader holds the bid).
  // That frees a slot, so a third team may now join the bidding.
  out(playerId) {
    const a = this.auction;
    if (this.status !== "auction" || a.phase !== "bidding") throw new Error("No player is up for bidding right now.");
    if (a.paused) throw new Error("Auction is paused by the host.");
    const team = this.teamOf(playerId);
    if (!team) throw new Error("You have no franchise.");
    if (!a.contenders.includes(team.id)) throw new Error("You are not in this bidding war.");
    if (a.lastBidder === team.id) throw new Error("You are the highest bidder — only the trailing team can go Out.");
    a.contenders = a.contenders.filter((id) => id !== team.id);
    a.outTeams.push(team.id);
    this.emit("auction:event", { type: "out", teamId: team.id, teamName: team.name });
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
      this.reserveOk(ex, a.currentBid) && !this.canAddPlayer(ex, player);

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
    if (spendCard) { const ex = this.team(a.rtm.exTeamId); ex.rtmCards = Math.max(0, ex.rtmCards - 1); }
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
    if (!this.reserveOk(team, raised)) {
      throw new Error(`Keep ₹${this.reserveNeeded(team).toFixed(2)} Cr aside to fill your squad to 15 players.`);
    }
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
      if (team.remaining < a.rtm.price || !this.reserveOk(team, a.rtm.price)) {
        throw new Error("⚠️ Not enough purse to match that price.");
      }
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
    this._endAuction("host");
  }

  _endAuction(reason = "host") {
    clearTimeout(this._timer);
    clearTimeout(this._nextTimer);
    this.status = "ended";
    this.auction = this._idleAuction();
    // AI: pick the strongest Playing XI for every franchise from the players it bought.
    for (const t of this.humanTeams()) this._aiPickXI(t);
    // AI: compute the 100-point team analysis leaderboard
    this._computeTeamAnalysis();
    this.emit("auction:event", { type: "ended", reason, ai: true });
    this.broadcast();
  }

  _computeTeamAnalysis() {
    const ownedTeams = this.humanTeams().map((t) => ({
      id: t.id, name: t.name, full: t.full,
      purchased: t.purchased,
      remaining: t.remaining,
    }));
    const catalog = this.catalogPayload();
    this.teamAnalysis = buildTeamLeaderboard(ownedTeams, catalog, 100);
  }

  // Rule-based "AI": searches the franchise's own squad for the XI that scores best on the 30-mark
  // evaluation (batting, spin, pace, overseas, balance, middle order) with max 4 overseas players.
  _aiPickXI(team) {
    const squad = team.purchased.map((p) => this.cat(p.playerId));
    team.playingEleven = selectBalancedXI(squad, MAX_OVERSEAS_XI);
    team.xiSource = "ai";
  }

  // Owner asks the AI to (re)select the best XI — editable again afterwards.
  aiXI(playerId) {
    if (this.status === "results") throw new Error("Results are final — the Playing XI is locked.");
    const team = this.teamOf(playerId);
    if (!team) throw new Error("You have no franchise.");
    if (!team.purchased.length) throw new Error("Buy some players first.");
    this._aiPickXI(team);
    this.broadcast();
  }

  // Top up a short XI with the franchise's best remaining players (max 4 overseas).
  _fillXI(team) {
    const xi = [...team.playingEleven];
    let overseas = xi.filter((id) => isOverseas(this.cat(id))).length;
    const rest = team.purchased
      .filter((p) => !xi.includes(p.playerId))
      .sort((a, b) => quality(this.cat(b.playerId).base) - quality(this.cat(a.playerId).base));
    for (const p of rest) {
      if (xi.length >= 11) break;
      if (p.country !== "India") {
        if (overseas >= MAX_OVERSEAS_XI) continue;
        overseas++;
      }
      xi.push(p.playerId);
    }
    team.playingEleven = xi;
  }

  // Host reveals the result: 30-mark evaluation of every franchise's Playing XI.
  showResults(playerId) {
    if (!this.isHost(playerId)) throw new Error("Only the host can reveal the result.");
    if (this.status !== "ended") throw new Error("The auction hasn't finished yet.");
    const teams = this.humanTeams();
    for (const t of teams) this._fillXI(t);
    this.results = buildResults(teams.map((t) => ({
      id: t.id, name: t.name, full: t.full, color: t.color,
      ownerName: this.members.get(t.ownerId)?.name || "—",
      remaining: t.remaining,
      xi: t.playingEleven.map((id) => this.cat(id)),
    })));
    // Recompute team analysis with final squads
    this._computeTeamAnalysis();
    this.status = "results";
    this.emit("auction:event", { type: "results", winnerTeamId: this.results.winnerTeamId });
    this.broadcast();
  }

  // ─── playing XI ──────────────────────────────────────────────────────
  setPlayingXI(playerId, ids) {
    if (this.status === "results") throw new Error("Results are final — the Playing XI is locked.");
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
    team.xiSource = "manual";
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
      retentionRevealing: !!this.retentionRevealing,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      results: this.results,
      teamAnalysis: this.teamAnalysis || null,
      limits: {
        minSquad: MIN_SQUAD, maxSquad: MAX_SQUAD, maxOverseasSquad: MAX_OVERSEAS_SQUAD,
        maxOverseasXI: MAX_OVERSEAS_XI, maxRetentions: MAX_RETENTIONS, minRetentionPrice: MIN_RETENTION_PRICE,
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
        xiSource: t.xiSource,
        points: teamPoints(t.purchased.map((p) => this.cat(p.playerId))),
        rtmCards: t.rtmCards,
        // Per-team buy analysis (available after auction ends)
        buys: (this.status === "ended" || this.status === "results")
          ? computeBuys(t.purchased.map((pu) => { const cat = this.cat(pu.playerId) || {}; return { ...cat, ...pu, catalogBase: cat.base || pu.base || 0.2 }; }).filter((p) => p.name))
          : null,
      })),
      auction: {
        phase: a.phase,
        introEndsAt: a.introEndsAt,
        paused: a.paused,
        playerId: a.playerId,
        currentBid: a.currentBid,
        lastBidder: a.lastBidder,
        involvedTeams: a.involvedTeams,
        contenders: a.contenders,
        outTeams: a.outTeams,
        timerEndsAt: a.timerEndsAt,
        timerTotalMs: a.timerTotalMs,
        remainingMs: a.remainingMs,
        rtm: a.rtm,
        round: this.round,
        queueRemaining: this.remainingCount(),
        currentSet: this.currentSet,
        sets: CATEGORY_ORDER.map((c) => ({ id: c, remaining: (this.sets[c] || []).length })),
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