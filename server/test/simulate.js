/*
 * End-to-end simulation: boots the real server, connects N bot players over
 * socket.io, plays a full auction (retention, bidding, RTM, XI) and asserts invariants.
 *   node test/simulate.js            -> 7 players
 *   BOTS=10 node test/simulate.js    -> 10 players
 */
process.env.PORT = process.env.PORT || "3999";
process.env.TIMER_SCALE = process.env.TIMER_SCALE || "0.01";
process.env.MIN_PLAYERS = "7";
const assert = require("assert");
const { io } = require("socket.io-client");
const { server } = require("../index");

const N = Number(process.env.BOTS || 7);
const URL = `http://localhost:${process.env.PORT}`;
const TEAM_IDS = ["csk", "mi", "rcb", "kkr", "gt", "lsg", "rr", "srh", "dc", "pbks"];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeBot(i) {
  const bot = {
    i, name: `Bot${i + 1}`, token: `tok-${i}-${Math.random()}`,
    socket: io(URL, { transports: ["websocket"] }),
    state: null, catalog: null, code: null, you: null, errors: [], events: [],
  };
  bot.socket.on("room:state", (s) => { bot.state = s; });
  bot.socket.on("room:catalog", (c) => { bot.catalog = c; });
  bot.socket.on("room:joined", ({ code, you }) => { bot.code = code; bot.you = you; });
  bot.socket.on("errorMsg", (m) => bot.errors.push(m));
  bot.socket.on("auction:event", (e) => bot.events.push(e));
  return bot;
}
const emit = (bot, ev, p) => bot.socket.emit(ev, p);
const myTeam = (bot) => bot.state.teams.find((t) => t.ownerId === bot.you);

(async () => {
  const bots = Array.from({ length: N }, (_, i) => makeBot(i));
  await Promise.all(bots.map((b) => new Promise((r) => b.socket.on("connect", r))));

  // ---- lobby ----
  emit(bots[0], "room:create", { name: bots[0].name, token: bots[0].token });
  await wait(150);
  const code = bots[0].code;
  assert(/^[A-Z2-9]{5}$/.test(code), "room code format " + code);
  for (const b of bots.slice(1)) emit(b, "room:join", { code: code.toLowerCase(), name: b.name, token: b.token });
  await wait(250);
  assert.equal(bots[0].state.players.length, N, "all bots joined");

  // wrong code
  const lost = makeBot(99);
  await new Promise((r) => lost.socket.on("connect", r));
  emit(lost, "room:join", { code: "ZZZZZ", name: "x", token: "t" });
  await wait(100);
  assert(lost.errors.some((e) => /not found/i.test(e)), "bad code rejected");
  lost.socket.close();

  // cannot start before 7 have franchises
  emit(bots[0], "room:start");
  await wait(100);
  assert(bots[0].errors.some((e) => /Need 7-10/.test(e)), "start blocked below minimum");

  bots.forEach((b, i) => emit(b, "room:selectTeam", { teamId: TEAM_IDS[i] }));
  await wait(200);
  // franchise already taken
  emit(bots[1], "room:selectTeam", { teamId: TEAM_IDS[0] });
  await wait(100);
  assert(bots[1].errors.some((e) => /already taken/.test(e)), "duplicate franchise rejected");

  // non-host can't start
  emit(bots[1], "room:start");
  await wait(100);
  assert(bots[1].errors.some((e) => /Only the host/.test(e)), "non-host cannot start");

  if (N === 10) {
    const extra = makeBot(50);
    await new Promise((r) => extra.socket.on("connect", r));
    emit(extra, "room:join", { code, name: "Extra", token: "extra-token" });
    await wait(100);
    assert(extra.errors.some((e) => /Room is full/.test(e)), "11th player rejected");
    extra.socket.close();
  }
  emit(bots[0], "room:start");
  await wait(200);
  assert.equal(bots[0].state.status, "retention");

  // ---- retention ----
  for (const b of bots) {
    const team = myTeam(b);
    const cands = b.catalog.filter((p) => p.lastTeam === team.id).slice(0, 3);
    assert(cands.length >= 2, `${team.id} has 2026 squad players to retain`);
    // over-limit must be rejected
    if (cands.length === 3) {
      emit(b, "retention:set", { picks: cands.map((c) => ({ playerId: c.id, price: c.base })) });
      await wait(30);
      assert(b.errors.some((e) => /up to 2/.test(e)), "3 retentions rejected");
    }
    // someone else's player must be rejected
    const foreign = b.catalog.find((p) => p.lastTeam && p.lastTeam !== team.id);
    emit(b, "retention:set", { picks: [{ playerId: foreign.id, price: 5 }] });
    await wait(30);
    assert(b.errors.some((e) => /not with/.test(e)), "foreign retention rejected");
    // below the ₹15 Cr minimum must be rejected (and nothing saved)
    emit(b, "retention:set", { picks: [{ playerId: cands[0].id, price: 14.75 }] });
    await wait(30);
    assert(b.errors.some((e) => /Minimum retention price is ₹15/.test(e)), "retention below 15 Cr rejected");
    emit(b, "retention:set", { picks: cands.slice(0, 2).map((c, k) => ({ playerId: c.id, price: 15 + k * 2.5 })) });
  }
  await wait(200);
  for (const b of bots) {
    const t = myTeam(b);
    const spent = t.purchased.filter((p) => p.isRetention).reduce((a, p) => a + p.price, 0);
    assert(Math.abs(t.remaining - (100 - spent)) < 1e-9, `purse after retention ${t.id}`);
  }
  // can't start auction until locked
  emit(bots[0], "auction:start", {});
  await wait(100);
  assert(bots[0].errors.some((e) => /Waiting for/.test(e)), "auction waits for locks");
  bots.forEach((b) => emit(b, "retention:lock", { locked: true }));
  await wait(150);

  // ---- auction ----
  const retainedIds = new Set(bots.flatMap((b) => myTeam(b).purchased.map((p) => p.playerId)));
  emit(bots[0], "auction:start", {});
  await wait(150);
  assert.equal(bots[0].state.status, "auction");

  let bidsPlaced = 0, rtmUsed = 0, rtmOffers = 0, raises = 0, finals = 0;
  const loop = setInterval(() => {
    for (const b of bots) {
      const s = b.state;
      if (!s || s.status !== "auction") continue;
      const a = s.auction;
      const mine = myTeam(b);
      if (a.phase === "rtm" && a.rtm) {
        const r = a.rtm;
        if (r.stage === "decide" && r.exTeamId === mine.id) {
          rtmOffers++;
          const use = Math.random() < 0.6;
          emit(b, "auction:rtm", { use });
        } else if (r.stage === "raise" && r.winningTeamId === mine.id) {
          raises++;
          emit(b, "auction:rtmRaise", { amount: Math.random() < 0.6 ? r.price + 1 : null });
        } else if (r.stage === "final" && r.exTeamId === mine.id) {
          finals++;
          emit(b, "auction:rtmFinal", { match: Math.random() < 0.5 });
        }
        continue;
      }
      if (a.phase !== "bidding" || a.paused) continue;
      // bid with ~35% probability each tick, within a personal max
      if (Math.random() < 0.35 && a.lastBidder !== mine.id) {
        const p = b.catalog[a.playerId];
        const max = p.base * (1 + ((b.i * 7 + a.playerId) % 6));
        const inc = [0.25, 0.5, 1][Math.floor(Math.random() * 3)];
        if (a.currentBid + inc <= max) { emit(b, "auction:bid", { increment: inc, expected: a.currentBid }); bidsPlaced++; }
      }
    }
  }, 8);

  // exercise pause / resume once mid-auction
  // bidding must not start before the opening ceremony ends
  assert.equal(bots[0].state.auction.phase, "intro", "intro plays first");
  assert(bots[0].state.auction.playerId === null, "no player up during intro");
  while (bots[0].state.auction.phase === "intro") await wait(50);
  await wait(100);
  // (timers are scaled down, so retry until the pause lands during a bidding phase)
  for (let k = 0; k < 40 && !bots[0].state.auction.paused; k++) {
    emit(bots[0], "auction:pause", { paused: true });
    await wait(25);
  }
  const pausedState = bots[0].state.auction;
  assert(pausedState.paused && pausedState.timerEndsAt === null && pausedState.remainingMs >= 0, "paused freezes timer");
  const frozenBid = pausedState.currentBid;
  emit(bots[1], "auction:pause", { paused: false });
  await wait(60);
  assert(bots[1].errors.some((e) => /Only the host/.test(e)), "non-host cannot resume");
  await wait(150);
  assert.equal(bots[0].state.auction.currentBid, frozenBid, "no bids accepted while paused");
  emit(bots[0], "auction:pause", { paused: false });

  // ---- host switches the group: next player must come from the chosen category ----
  emit(bots[1], "auction:category", { category: "Bowling" });
  await wait(60);
  assert(bots[1].errors.some((e) => /Only the host/.test(e)), "non-host cannot switch category");
  emit(bots[0], "auction:category", { category: "Nonsense" });
  await wait(60);
  assert(bots[0].errors.some((e) => /Unknown category/.test(e)), "unknown category rejected");
  const before = bots[0].events.length;
  emit(bots[0], "auction:category", { category: "Bowling" });
  let nextEv = null;
  for (let k = 0; k < 200 && !nextEv; k++) {
    await wait(25);
    nextEv = bots[0].events.slice(before).find((e) => e.type === "next");
  }
  assert(nextEv, "a new player started after the switch");
  assert.equal(bots[0].catalog[nextEv.playerId].category, "Bowling", "next player is from the chosen group");
  assert.equal(bots[0].state.auction.currentSet, "Bowling");
  assert(bots[0].state.auction.sets.length === 5, "state lists every group with its remaining count");

  const t0 = Date.now();
  while (bots[0].state.status !== "ended" && Date.now() - t0 < 120000) await wait(100);
  clearInterval(loop);
  assert.equal(bots[0].state.status, "ended", "auction ended in time");

  // ---- invariants ----
  const s = bots[0].state;
  const seen = new Set();
  for (const t of s.teams) {
    const spent = t.purchased.reduce((a, p) => a + p.price, 0);
    assert(Math.abs(t.remaining - (100 - spent)) < 1e-6, `purse math ${t.id}`);
    assert(t.remaining >= -1e-9, `purse never negative ${t.id}`);
    assert(t.purchased.length <= 25, `squad cap ${t.id}`);
    assert(t.purchased.filter((p) => p.country !== "India").length <= 8, `overseas cap ${t.id}`);
    if (t.ownerId) {
      assert(t.playingEleven.length <= 11 && t.playingEleven.length > 0, `XI auto-filled ${t.id}`);
      assert(t.playingEleven.filter((id) => bots[0].catalog[id].country !== "India").length <= 4, `XI overseas ${t.id}`);
    } else {
      assert.equal(t.purchased.length, 0, "unowned team buys nothing");
    }
    for (const p of t.purchased) {
      assert(!seen.has(p.playerId), `player ${p.name} bought twice`);
      seen.add(p.playerId);
    }
  }
  for (const id of retainedIds) assert(seen.has(id), "retained players kept");
  const sold = bots[0].events.filter((e) => e.type === "sold");
  const rtmSold = sold.filter((e) => e.isRTM);
  assert(sold.length + retainedIds.size === seen.size, "sold events match squads");
  assert(bots.every((b) => b.state.code === code), "everyone in same room");

  // XI editing: valid + overseas-limit + foreign player
  const b = bots[2];
  const t = myTeam(b);
  const overseasOwned = t.purchased.filter((p) => p.country !== "India").map((p) => p.playerId);
  emit(b, "xi:set", { ids: t.purchased.slice(0, 3).map((p) => p.playerId) });
  await wait(80);
  assert.equal(myTeam(b).playingEleven.length, Math.min(3, t.purchased.length), "xi set");
  emit(b, "xi:set", { ids: [0, 1, 2].map((_, i) => bots[3].state.teams.find((x) => x.ownerId === bots[3].you).purchased[i]?.playerId) });
  await wait(80);
  assert(b.errors.some((e) => /not in your squad/.test(e)), "foreign XI player rejected");
  if (overseasOwned.length >= 5) {
    emit(b, "xi:set", { ids: overseasOwned.slice(0, 5) });
    await wait(80);
    assert(b.errors.some((e) => /Max 4 overseas/.test(e)), "5 overseas in XI rejected");
  }

  // ---- finish: every squad should have 15 (when the auction ended by itself) ----
  const endedEv = bots[0].events.find((e) => e.type === "ended");
  if (endedEv.reason === "squads-complete") {
    assert(s.teams.filter((t) => t.ownerId).every((t) => t.purchased.length >= 15), "all squads have 15+");
  }

  // ---- result reveal: host only, 30-mark evaluation, winner = rank 1 ----
  emit(bots[1], "auction:results");
  await wait(80);
  assert(bots[1].errors.some((e) => /Only the host/.test(e)), "non-host cannot reveal results");
  emit(bots[0], "auction:results");
  await wait(150);
  const res = bots[0].state.results;
  assert.equal(bots[0].state.status, "results");
  assert.equal(res.rankings.length, N, "one ranking row per owner");
  for (const r of res.rankings) {
    const sum = Object.values(r.marks).reduce((a, b) => a + b, 0);
    assert(Math.abs(sum - r.total) < 0.02 && r.total <= 30 && r.total >= 0, "marks add up to <= 30");
    assert(Object.values(r.marks).every((m) => m >= 0 && m <= 5), "each category within 0-5");
    const sq = bots[0].state.teams.find((t) => t.id === r.teamId).purchased;
    const indian = sq.filter((p) => p.country === "India").length;
    const overseas = sq.length - indian;
    assert.equal(r.xi.length, Math.min(11, indian + Math.min(4, overseas)), "XI filled as far as the 4-overseas rule allows");
  }
  assert.equal(res.winnerTeamId, res.rankings[0].teamId);
  assert(res.rankings.every((r, i, a) => i === 0 || a[i - 1].total >= r.total), "sorted best first");
  emit(bots[2], "xi:set", { ids: [] });
  await wait(80);
  assert(bots[2].errors.some((e) => /locked/.test(e)), "XI locked after results");
  console.log("winner:", res.rankings[0].teamName, res.rankings[0].ownerName, res.rankings[0].total + "/30");

  // ---- reconnect keeps seat ----
  const old = bots[4];
  const keep = { team: myTeam(old).id, purse: myTeam(old).remaining };
  old.socket.close();
  await wait(100);
  assert.equal(bots[0].state.players.find((p) => p.id === old.you).connected, false, "disconnect flagged");
  const re = makeBot(4);
  re.token = old.token;
  await new Promise((r) => re.socket.on("connect", r));
  emit(re, "room:rejoin", { code, token: old.token });
  await wait(150);
  assert.equal(re.you, old.you, "same seat after rejoin");
  assert.equal(myTeam(re).id, keep.team);
  assert.equal(myTeam(re).remaining, keep.purse);
  assert.equal(re.state.players.find((p) => p.id === re.you).connected, true);

  console.log(`PASS  players=${N} sold=${sold.length} rtmOffers=${rtmOffers} rtmSold=${rtmSold.length} unsold-left=${s.unsoldIds.length} bids=${bidsPlaced} raises=${raises} finals=${finals}`);
  bots.forEach((x) => x.socket.close()); re.socket.close();
  server.close(); process.exit(0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });