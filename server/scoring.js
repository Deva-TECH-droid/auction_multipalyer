/*
 * Final result evaluation — 30 marks per team, decided with pure logic (no randomness).
 *
 *   Batting        5   average batting strength of the best 6 batters in the XI
 *   Spin bowling   5   best 2 spinners in the XI
 *   Fast bowling   5   best 3 pace bowlers in the XI
 *   Overseas       5   quality of the (up to 4) overseas players in the XI
 *   Team balance   5   keeper, 5+ bowling options, 6 batters, an all-rounder, full XI
 *   Middle order   5   best 3 middle-order batters (positions 4-6) in the XI
 *
 * Player quality comes from the player's base price (a fixed star-rating, not what he was
 * sold for): 2.0 Cr -> 1.00, 1.0 Cr -> 0.61, 0.5 Cr -> 0.42, 0.2 Cr -> 0.30.
 *
 * AI TEAM ANALYSIS (100-point scale):
 *   Batting Power         15   depth & quality of top-order + middle-order batters
 *   Bowling Attack        15   overall bowling quality (spin + pace combined)
 *   All-Rounders          12   depth & quality of genuine all-rounders
 *   Wicketkeeping         10   quality of keeper(s)
 *   Fielding/Athleticism  10   fielding impact from dynamic fielders
 *   Overseas Utilization  10   how well the 4 overseas slots are used
 *   Team Balance           8   structural balance (roles, positions)
 *   Squad Depth            8   bench strength beyond the Playing XI
 *   Captain Strength       7   captain's leadership & performance profile
 *   Budget Efficiency      5   value for money (quality per crore spent)
 */

const SPIN = new Set([
  "Rashid Khan", "Yuzvendra Chahal", "Kuldeep Yadav", "Varun Chakravarthy", "Ravi Bishnoi", "Adam Zampa",
  "Maheesh Theekshana", "Noor Ahmad", "Sunil Narine", "Ravindra Jadeja", "Axar Patel", "Washington Sundar",
  "Krunal Pandya", "Wanindu Hasaranga", "Moeen Ali", "Glenn Maxwell", "Rahul Tewatia", "Abhishek Sharma",
  "Liam Livingstone", "Shadab Khan", "Imad Wasim", "Abrar Ahmed", "Rahul Chahar", "Piyush Chawla", "Jayant Yadav", "Mayank Markande", "Karn Sharma",
  "Murugan Ashwin", "Tabraiz Shamsi", "Keshav Maharaj", "Mitchell Santner", "Ish Sodhi", "Adil Rashid",
  "Liam Dawson", "Akeal Hosein", "Mujeeb Ur Rahman", "Allah Ghazanfar", "Mohammad Nabi", "Mehidy Hasan Miraz",
  "Shakib Al Hasan", "Sikandar Raza", "Deepak Hooda", "Kamindu Mendis", "Matthew Short",
]);

const MIDDLE = new Set([
  "Suryakumar Yadav", "Shreyas Iyer", "Rishabh Pant", "MS Dhoni", "Hardik Pandya", "Heinrich Klaasen",
  "David Miller", "Tim David", "Shimron Hetmyer", "Nicholas Pooran", "Rinku Singh", "Tilak Varma", "Riyan Parag",
  "Liam Livingstone", "Glenn Maxwell", "Marcus Stoinis", "Andre Russell", "Steve Smith", "Kane Williamson",
  "Aiden Markram", "Rovman Powell", "Sherfane Rutherford", "Shivam Dube", "Dewald Brevis", "Tristan Stubbs",
  "Jitesh Sharma", "Dhruv Jurel", "Sarfaraz Khan", "Manish Pandey", "Karun Nair", "Marnus Labuschagne",
  "Glenn Phillips", "Mark Chapman", "Rassie van der Dussen", "Rahul Tewatia", "Ben Stokes", "Moeen Ali",
  "Sam Curran", "Venkatesh Iyer", "Nitish Kumar Reddy", "Charith Asalanka", "Dasun Shanaka", "Angelo Mathews",
  "Sikandar Raza", "Daryl Mitchell", "Jason Holder", "Romario Shepherd", "Deepak Hooda", "Vijay Shankar",
  "Dinesh Karthik", "Rahul Tripathi", "Ajinkya Rahane", "Cameron Green", "Mitchell Marsh", "Jimmy Neesham",
  "Najibullah Zadran", "Sam Billings", "Alex Carey", "Matthew Wade", "Shai Hope",
]);

// Premium fielders — known for exceptional ground fielding and catching
const ELITE_FIELDERS = new Set([
  "Suryakumar Yadav", "Virat Kohli", "Hardik Pandya", "Ravindra Jadeja", "AB de Villiers",
  "Shreyas Iyer", "Shubman Gill", "Yashasvi Jaiswal", "Riyan Parag", "Sai Sudharsan",
  "Faf du Plessis", "David Warner", "Travis Head", "Mitchell Marsh", "Glenn Maxwell",
  "Ben Stokes", "Jos Buttler", "Sam Curran", "Liam Livingstone", "Will Jacks",
  "KL Rahul", "K.L. Rahul", "Axar Patel", "Washington Sundar", "Pat Cummins",
  "Abhishek Sharma", "Nitish Kumar Reddy", "Tilak Varma", "Rinku Singh",
]);

// Quality captain profile — players known for strong leadership + performance
const CAPTAIN_QUALITY = {
  "Rohit Sharma": 0.95, "Virat Kohli": 0.93, "MS Dhoni": 0.97, "Pat Cummins": 0.90,
  "Hardik Pandya": 0.88, "Ravindra Jadeja": 0.85, "Jasprit Bumrah": 0.82,
  "Shubman Gill": 0.84, "Shreyas Iyer": 0.85, "Axar Patel": 0.83,
  "K.L. Rahul": 0.84, "Rishabh Pant": 0.87, "Jos Buttler": 0.88,
  "Kane Williamson": 0.89, "Ben Stokes": 0.92, "Faf du Plessis": 0.86,
  "David Warner": 0.85, "Travis Head": 0.80, "Riyan Parag": 0.76,
  "Sanju Samson": 0.78, "Heinrich Klaasen": 0.82, "Travis Head": 0.80,
  "Ruturaj Gaikwad": 0.80, "Yashasvi Jaiswal": 0.76, "Suryakumar Yadav": 0.80,
};

const quality = (base) => 0.3 + (0.7 * (base - 0.2)) / 1.8;

// Everything the evaluator needs to know about one player.
function profile(p) {
  const q = quality(p.base);
  let bat = 0;
  let bowl = 0;
  if (p.role === "Batsman" || p.role === "Wicketkeeper") bat = q;
  else if (p.role === "All-Rounder") { bat = 0.85 * q; bowl = 0.85 * q; }
  else { bowl = q; bat = 0.2 * q; }
  const bowlType = bowl >= 0.3 ? (SPIN.has(p.name) ? "spin" : "pace") : null;
  const middle = p.role !== "Bowler" && (MIDDLE.has(p.name) || p.role === "All-Rounder");
  return { ...p, q, bat, bowl, bowlType, middle, overseas: p.country !== "India" };
}

const r2 = (n) => Math.round(n * 100) / 100;
const topN = (arr, key, n) => [...arr].sort((a, b) => b[key] - a[key]).slice(0, n);
const names = (arr) => arr.map((p) => p.name).join(", ") || "—";

function evaluateTeam(xiPlayers) {
  const xi = xiPlayers.map(profile);

  // 1. Batting — best 6 batting strengths (missing slots count as 0)
  const top6 = topN(xi.filter((p) => p.bat > 0), "bat", 6);
  const batting = (top6.reduce((a, p) => a + p.bat, 0) / 6) * 5;

  // 2. Spin — best 2 spinners
  const spinners = topN(xi.filter((p) => p.bowlType === "spin"), "bowl", 2);
  const spin = (spinners.reduce((a, p) => a + p.bowl, 0) / 2) * 5;

  // 3. Pace — best 3 fast bowlers
  const pacers = topN(xi.filter((p) => p.bowlType === "pace"), "bowl", 3);
  const pace = (pacers.reduce((a, p) => a + p.bowl, 0) / 3) * 5;

  // 4. Overseas — the (max 4) overseas players, judged by their best skill
  const os = xi.filter((p) => p.overseas).map((p) => ({ ...p, best: Math.max(p.bat, p.bowl) }));
  const osTop = topN(os, "best", 4);
  const overseas = (osTop.reduce((a, p) => a + p.best, 0) / 4) * 5;

  // 5. Balance — start from 5 and deduct for structural holes
  const keepers = xi.filter((p) => p.role === "Wicketkeeper").length;
  const bowlOptions = xi.filter((p) => p.bowl >= 0.3).length;
  const batters = xi.filter((p) => p.bat >= 0.5).length;
  const allRounders = xi.filter((p) => p.role === "All-Rounder").length;
  let balance = 5;
  const issues = [];
  if (keepers < 1) { balance -= 1.5; issues.push("no wicketkeeper"); }
  if (bowlOptions < 5) { balance -= (5 - bowlOptions) * 0.8; issues.push(`only ${bowlOptions} bowling options`); }
  if (batters < 6) { balance -= (6 - batters) * 0.5; issues.push(`only ${batters} real batters`); }
  if (allRounders < 1) { balance -= 0.8; issues.push("no all-rounder"); }
  if (xi.length < 11) { balance -= (11 - xi.length) * 0.6; issues.push(`XI has ${xi.length} players`); }
  balance = Math.max(0, balance);

  // 6. Middle order — best 3 middle-order batters
  const mids = topN(xi.filter((p) => p.middle && p.bat > 0), "bat", 3);
  const middle = (mids.reduce((a, p) => a + p.bat, 0) / 3) * 5;

  const marks = {
    batting: r2(Math.min(5, batting)), spin: r2(Math.min(5, spin)), pace: r2(Math.min(5, pace)),
    overseas: r2(Math.min(5, overseas)), balance: r2(balance), middle: r2(Math.min(5, middle)),
  };
  const total = r2(Object.values(marks).reduce((a, b) => a + b, 0));

  const notes = {
    batting: `Top batters: ${names(top6)}`,
    spin: spinners.length ? `Spinners: ${names(spinners)}` : "No spinner in the XI",
    pace: pacers.length ? `Pace: ${names(pacers)}` : "No fast bowler in the XI",
    overseas: osTop.length ? `Overseas: ${names(osTop)}` : "No overseas player in the XI",
    balance: issues.length ? `Weak spots: ${issues.join(", ")}` : "Well balanced XI",
    middle: mids.length ? `Middle order: ${names(mids)}` : "No middle-order batter in the XI",
  };
  return { marks, total, notes };
}

// Results for every owned franchise, best first.
//   teams: [{ id, name, full, color, ownerName, remaining, xi: [catalog players] }]
function buildResults(teams) {
  const rows = teams.map((t) => {
    const ev = evaluateTeam(t.xi);
    return {
      teamId: t.id, teamName: t.name, teamFull: t.full, ownerName: t.ownerName,
      remaining: t.remaining, xi: t.xi.map((p) => p.id), ...ev,
    };
  });
  rows.sort((a, b) => b.total - a.total || b.marks.batting - a.marks.batting || b.remaining - a.remaining);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rankings: rows, winnerTeamId: rows[0]?.teamId || null };
}

// The strongest Playing XI a squad can field: greedy start (best players first, max `maxOverseas`
// overseas), then repeatedly apply the single best swap that raises the 30-mark score
// (ties broken by raw player quality). Deterministic — same squad, same XI.
function selectBestXI(players, maxOverseas = 4) {
  if (players.length <= 11) return players.map((p) => p.id);
  const os = (p) => p.country !== "India";
  const value = (xi) => evaluateTeam(xi).total * 1000 + xi.reduce((a, p) => a + quality(p.base), 0);
  const sorted = [...players].sort((a, b) => quality(b.base) - quality(a.base) || a.name.localeCompare(b.name));
  let xi = [];
  let overseas = 0;
  for (const p of sorted) {
    if (xi.length >= 11) break;
    if (os(p)) { if (overseas >= maxOverseas) continue; overseas++; }
    xi.push(p);
  }
  let best = value(xi);
  for (let pass = 0; pass < 60; pass++) {
    let move = null;
    for (let i = 0; i < xi.length; i++) {
      for (const cand of sorted) {
        if (xi.includes(cand)) continue;
        const osCount = xi.filter((p, k) => k !== i && os(p)).length + (os(cand) ? 1 : 0);
        if (osCount > maxOverseas) continue;
        const trial = xi.slice(); trial[i] = cand;
        const v = value(trial);
        if (v > best + 1e-9 && (!move || v > move.v)) move = { v, trial };
      }
    }
    if (!move) break;
    xi = move.trial; best = move.v;
  }
  return xi.map((p) => p.id);
}

module.exports = { evaluateTeam, buildResults, profile, quality, selectBestXI };

// ════════════════════════════════════════════════════════════════════════════
//  TEAM POINTS — grade + real IPL 2026 performance (never invented)
//    Grade A player = 10 pts · Grade B = 6 pts · every other player = 1 pt
//    Performance (only where real IPL 2026 stats exist in iplStats.js):
//      1 pt per 30 runs · 1 pt per wicket · +2 if S.R. ≥ 150 with 200+ runs
//      +2 if economy ≤ 8.5 with 10+ wickets
//    Players without published IPL 2026 stats earn grade points only.
// ════════════════════════════════════════════════════════════════════════════
const GRADE_POINTS = { "Grade A": 10, "Grade B": 6 };

function playerPoints(p) {
  const grade = GRADE_POINTS[p.category] || 1;
  const s = p.stats;
  let perf = 0;
  if (s) {
    if (s.runs) perf += s.runs / 30;
    if (s.wkts) perf += s.wkts;
    if (s.sr && s.runs >= 200 && s.sr >= 150) perf += 2;
    if (s.eco && s.wkts >= 10 && s.eco <= 8.5) perf += 2;
  }
  return { grade, perf: r2(perf) };
}

// players: catalog entries of everyone the franchise owns (retained + bought)
function teamPoints(players) {
  let gradePts = 0, perfPts = 0, gradeA = 0, gradeB = 0;
  for (const p of players) {
    const pp = playerPoints(p);
    gradePts += pp.grade; perfPts += pp.perf;
    if (p.category === "Grade A") gradeA++;
    if (p.category === "Grade B") gradeB++;
  }
  return { total: r2(gradePts + perfPts), grade: r2(gradePts), perf: r2(perfPts), gradeA, gradeB };
}

// ════════════════════════════════════════════════════════════════════════════
//  AI BALANCED PLAYING XI (returned in BATTING ORDER)
//    1-3  openers / top-order batters      4-6  middle order (+ keeper allowed anywhere up to 7)
//    6-7  all-rounders (at least 2)        8-11 specialist bowlers, at least 2 of them spinners
//    max 4 overseas · only players from the squad passed in
// ════════════════════════════════════════════════════════════════════════════
function selectBalancedXI(players, maxOverseas = 4) {
  const P = players.map(profile);
  const grp = (p) => (p.role === "All-Rounder" ? "ar" : p.role === "Bowler" ? "bowl" : "bat");
  const val = (p) => {
    const g = grp(p);
    if (g === "bat") return p.bat + (p.middle ? 0 : 0.02);
    if (g === "ar") return 0.5 * (p.bat + p.bowl) + 0.1 * Math.min(p.bat, p.bowl);
    return p.bowl;
  };
  const byVal = (a, b) => val(b) - val(a) || a.name.localeCompare(b.name);
  const G = { bat: P.filter((p) => grp(p) === "bat"), ar: P.filter((p) => grp(p) === "ar"), bowl: P.filter((p) => grp(p) === "bowl") };

  if (P.length <= 11) return orderXI(P).map((p) => p.id);

  // How many of each kind: 5 batters · 2 all-rounders · 4 bowlers (shift when the squad lacks a kind)
  let nAR = Math.min(2, G.ar.length);
  let nBowl = Math.min(G.bowl.length, 4 + (2 - nAR));
  let nBat = 11 - nAR - nBowl;
  if (nBat > G.bat.length) {
    let need = nBat - G.bat.length;
    nBat = G.bat.length;
    const moreAR = Math.min(need, G.ar.length - nAR); nAR += moreAR; need -= moreAR;
    nBowl += Math.min(need, G.bowl.length - nBowl);
  }
  const target = { bat: nBat, ar: nAR, bowl: nBowl };

  const chosen = [];
  let os = 0;
  const count = (g) => chosen.filter((p) => grp(p) === g).length;
  const canAdd = (p) => !chosen.includes(p) && (!p.overseas || os < maxOverseas);
  const add = (p) => { chosen.push(p); if (p.overseas) os++; };

  // 1) a wicketkeeper (best one)  2) two spinners (specialist bowlers)
  for (const w of G.bat.filter((p) => p.role === "Wicketkeeper").sort(byVal)) {
    if (target.bat > 0 && canAdd(w)) { add(w); break; }
  }
  const spinners = G.bowl.filter((p) => p.bowlType === "spin").sort(byVal);
  for (const s of spinners) {
    if (count("bowl") >= Math.min(2, target.bowl)) break;
    if (canAdd(s)) add(s);
  }
  // 3) best remaining players overall, respecting the group targets and the overseas cap
  for (const p of [...P].sort(byVal)) {
    if (chosen.length >= 11) break;
    if (count(grp(p)) < target[grp(p)] && canAdd(p)) add(p);
  }
  // 4) still short (overseas cap / thin squad)? take the best available of any kind
  for (const p of [...P].sort(byVal)) {
    if (chosen.length >= 11) break;
    if (canAdd(p)) add(p);
  }

  // Local search: swap players of the SAME kind while the XI scores better (balance rules stay intact)
  const hasWK = G.bat.some((p) => p.role === "Wicketkeeper");
  const spinWanted = Math.min(2, target.bowl, spinners.length);
  const valid = (xi) =>
    xi.filter((p) => p.overseas).length <= maxOverseas &&
    (!hasWK || xi.some((p) => p.role === "Wicketkeeper")) &&
    xi.filter((p) => p.role === "Bowler" && p.bowlType === "spin").length >= spinWanted;
  const score = (xi) => evaluateTeam(xi).total * 1000 + xi.reduce((a, p) => a + val(p), 0);
  let xi = chosen;
  let best = score(xi);
  for (let pass = 0; pass < 40; pass++) {
    let move = null;
    for (let i = 0; i < xi.length; i++) {
      for (const cand of P) {
        if (xi.includes(cand) || grp(cand) !== grp(xi[i])) continue;
        const trial = xi.slice(); trial[i] = cand;
        if (!valid(trial)) continue;
        const v = score(trial);
        if (v > best + 1e-9 && (!move || v > move.v)) move = { v, trial };
      }
    }
    if (!move) break;
    xi = move.trial; best = move.v;
  }
  return orderXI(xi).map((p) => p.id);
}

// Batting order: top 3 = top-order batters, then middle order, then all-rounders (6-7), then bowlers.
function orderXI(xi) {
  const grp = (p) => (p.role === "All-Rounder" ? "ar" : p.role === "Bowler" ? "bowl" : "bat");
  const bats = xi.filter((p) => grp(p) === "bat").sort((a, b) => Number(a.middle) - Number(b.middle) || b.bat - a.bat);
  const ars = xi.filter((p) => grp(p) === "ar").sort((a, b) => b.bat - a.bat);
  const bowls = xi.filter((p) => grp(p) === "bowl").sort((a, b) => b.bat - a.bat || b.bowl - a.bowl);
  return [...bats, ...ars, ...bowls];
}

module.exports.teamPoints = teamPoints;
module.exports.playerPoints = playerPoints;
module.exports.selectBalancedXI = selectBalancedXI;

// ════════════════════════════════════════════════════════════════════════════
//  AI TEAM ANALYSIS — 100-point comprehensive squad rating
//    Called after the auction ends or on-demand.
//    Returns: { score, breakdown, strengths, weaknesses, bestBuy, stealBuy, worstBuy }
// ════════════════════════════════════════════════════════════════════════════

/**
 * Analyse a franchise's entire squad (purchased players with catalog data merged).
 * @param {Object} params
 * @param {string} params.teamId
 * @param {string} params.teamName
 * @param {string} params.teamFull
 * @param {Array}  params.purchased   — team.purchased entries (playerId, name, role, country, price, isRTM, isRetention)
 * @param {Array}  params.catalog     — full catalog array so we can look up base price / category
 * @param {number} params.remaining   — leftover budget
 * @param {number} params.startPurse  — original budget (e.g. 100 Cr)
 * @returns analysis object
 */
function analyseTeam({ teamId, teamName, teamFull, purchased, catalog, remaining, startPurse = 100 }) {
  // Merge purchase records with catalog data
  const catMap = new Map(catalog.map((p) => [p.id, p]));
  const squad = purchased.map((pu) => {
    const cat = catMap.get(pu.playerId) || {};
    return { ...cat, ...pu, catalogBase: cat.base || pu.base || 0.2 };
  }).filter((p) => p.name);

  const total = squad.length;
  if (total === 0) return _emptyAnalysis(teamId, teamName, teamFull);

  // ── 1. Batting Power (15 pts) ─────────────────────────────────────────
  const batters = squad.filter((p) => p.role === "Batsman" || p.role === "Wicketkeeper" || p.role === "All-Rounder");
  const pureBatters = squad.filter((p) => p.role === "Batsman" || p.role === "Wicketkeeper");
  const batQuality = batters.map((p) => {
    const q = quality(p.catalogBase);
    return p.role === "All-Rounder" ? 0.75 * q : q;
  });
  batQuality.sort((a, b) => b - a);
  const top8Bat = batQuality.slice(0, 8);
  const batScore = Math.min(15, (top8Bat.reduce((a, b) => a + b, 0) / 8) * 15);
  const batExplain = [];
  const gradABat = squad.filter((p) => (p.category === "Grade A" || p.category === "Grade B") && (p.role === "Batsman" || p.role === "Wicketkeeper" || p.role === "All-Rounder"));
  if (gradABat.length >= 2) batExplain.push(`${gradABat.length} marquee bat/AR players`);
  if (pureBatters.length < 4) batExplain.push("thin batting depth");
  else if (pureBatters.length >= 6) batExplain.push("excellent batting depth (6+ batters)");

  // ── 2. Bowling Attack (15 pts) ────────────────────────────────────────
  const bowlers = squad.filter((p) => p.role === "Bowler" || p.role === "All-Rounder");
  const pureBowlers = squad.filter((p) => p.role === "Bowler");
  const bowlQuality = bowlers.map((p) => {
    const q = quality(p.catalogBase);
    return p.role === "All-Rounder" ? 0.7 * q : q;
  });
  bowlQuality.sort((a, b) => b - a);
  const top6Bowl = bowlQuality.slice(0, 6);
  const bowlScore = Math.min(15, (top6Bowl.reduce((a, b) => a + b, 0) / 6) * 15);
  const spinnerCount = squad.filter((p) => SPIN.has(p.name)).length;
  const pacerCount = pureBowlers.filter((p) => !SPIN.has(p.name)).length;
  const bowlExplain = [];
  if (spinnerCount >= 2 && pacerCount >= 2) bowlExplain.push("well-rounded attack (spin + pace)");
  if (spinnerCount === 0) bowlExplain.push("no specialist spinner");
  if (pacerCount === 0) bowlExplain.push("no specialist pacer");
  if (squad.some((p) => ["Jasprit Bumrah", "Rashid Khan", "Pat Cummins", "Mitchell Starc"].includes(p.name))) {
    bowlExplain.push("world-class bowling spearhead");
  }

  // ── 3. All-Rounders (12 pts) ───────────────────────────────────────────
  const allRounders = squad.filter((p) => p.role === "All-Rounder");
  const arQuality = allRounders.map((p) => quality(p.catalogBase));
  arQuality.sort((a, b) => b - a);
  const top3AR = arQuality.slice(0, 3);
  const arScore = Math.min(12, (top3AR.length === 0 ? 0 : (top3AR.reduce((a, b) => a + b, 0) / 3) * 12));
  const arExplain = [];
  if (allRounders.length === 0) arExplain.push("no all-rounders — major gap");
  else if (allRounders.length === 1) arExplain.push("only 1 all-rounder — risky");
  else if (allRounders.length >= 3) arExplain.push(`${allRounders.length} genuine all-rounders`);

  // ── 4. Wicketkeeping (10 pts) ─────────────────────────────────────────
  const keepers = squad.filter((p) => p.role === "Wicketkeeper");
  const keeperQuality = keepers.map((p) => quality(p.catalogBase));
  keeperQuality.sort((a, b) => b - a);
  const wkScore = Math.min(10, keeperQuality.length === 0 ? 0 : keeperQuality[0] * 10 + (keeperQuality[1] ? keeperQuality[1] * 2 : 0));
  const wkExplain = [];
  if (keepers.length === 0) wkExplain.push("no wicketkeeper — critical gap");
  else if (keepers.length >= 2) wkExplain.push("good keeper depth");
  const eliteKeepers = keepers.filter((p) => ["MS Dhoni", "Rishabh Pant", "K.L. Rahul", "Heinrich Klaasen", "Jos Buttler", "Sanju Samson"].includes(p.name));
  if (eliteKeepers.length > 0) wkExplain.push(`world-class keeper: ${eliteKeepers.map((p) => p.name).join(", ")}`);

  // ── 5. Fielding/Athleticism (10 pts) ─────────────────────────────────
  const eliteFieldersInSquad = squad.filter((p) => ELITE_FIELDERS.has(p.name));
  const fieldScore = Math.min(10, (eliteFieldersInSquad.length / 5) * 10);
  const fieldExplain = [];
  if (eliteFieldersInSquad.length >= 5) fieldExplain.push("outstanding fielding unit");
  else if (eliteFieldersInSquad.length >= 3) fieldExplain.push("good fielding depth");
  else fieldExplain.push("average fielding quality");

  // ── 6. Overseas Utilization (10 pts) ─────────────────────────────────
  const overseasPlayers = squad.filter((p) => p.country !== "India");
  const osQuality = overseasPlayers.map((p) => quality(p.catalogBase));
  osQuality.sort((a, b) => b - a);
  const top4OS = osQuality.slice(0, 4);
  const osScore = Math.min(10, top4OS.length === 0 ? 0 : (top4OS.reduce((a, b) => a + b, 0) / 4) * 10);
  const osExplain = [];
  if (overseasPlayers.length < 4) osExplain.push(`only ${overseasPlayers.length} overseas players — slots underused`);
  else if (overseasPlayers.length >= 4) osExplain.push(`${overseasPlayers.length} overseas players — good variety`);
  const eliteOS = overseasPlayers.filter((p) => quality(p.catalogBase) >= 0.85);
  if (eliteOS.length >= 2) osExplain.push(`premium OS players: ${eliteOS.slice(0, 2).map((p) => p.name).join(", ")}`);

  // ── 7. Team Balance (8 pts) ───────────────────────────────────────────
  let balanceScore = 8;
  const balExplain = [];
  if (keepers.length < 1) { balanceScore -= 2; balExplain.push("no keeper (-2)"); }
  if (allRounders.length < 2) { balanceScore -= 1.5; balExplain.push("< 2 all-rounders (-1.5)"); }
  if (pureBatters.length < 4) { balanceScore -= 1.5; balExplain.push("< 4 specialist batters (-1.5)"); }
  if (pureBowlers.length < 4) { balanceScore -= 1.5; balExplain.push("< 4 specialist bowlers (-1.5)"); }
  if (spinnerCount < 1) { balanceScore -= 0.5; balExplain.push("no spinner (-0.5)"); }
  if (balExplain.length === 0) balExplain.push("excellent structural balance");
  balanceScore = Math.max(0, balanceScore);

  // ── 8. Squad Depth (8 pts) ─────────────────────────────────────────────
  const depthScore = Math.min(8, total >= 15 ? 8 : (total / 15) * 8);
  const depthExplain = [];
  if (total >= 18) depthExplain.push(`deep squad (${total} players)`);
  else if (total >= 15) depthExplain.push(`adequate squad (${total} players)`);
  else depthExplain.push(`thin squad — only ${total} players`);

  // ── 9. Captain Strength (7 pts) ────────────────────────────────────────
  // Find likely captain — highest-quality Grade A/B player or first purchased
  const sortedByQuality = [...squad].sort((a, b) => quality(b.catalogBase) - quality(a.catalogBase));
  const likelyCaptain = sortedByQuality[0];
  const captainQ = likelyCaptain ? (CAPTAIN_QUALITY[likelyCaptain.name] || quality(likelyCaptain.catalogBase)) : 0.5;
  const captainScore = Math.min(7, captainQ * 7);
  const capExplain = [];
  if (likelyCaptain) {
    capExplain.push(`lead player: ${likelyCaptain.name}`);
    if (CAPTAIN_QUALITY[likelyCaptain.name]) capExplain.push("proven IPL leader");
  }

  // ── 10. Budget Efficiency (5 pts) ────────────────────────────────────
  const spent = startPurse - remaining;
  const totalSquadQuality = squad.reduce((a, p) => a + quality(p.catalogBase), 0);
  const valuePerCrore = spent > 0 ? totalSquadQuality / spent : 0;
  // Benchmark: 0.03 quality/Cr is decent, 0.05+ is excellent
  const efficiencyScore = Math.min(5, (valuePerCrore / 0.05) * 5);
  const effExplain = [];
  if (valuePerCrore >= 0.05) effExplain.push("excellent value for money");
  else if (valuePerCrore >= 0.03) effExplain.push("fair budget efficiency");
  else effExplain.push("overpaid relative to quality");

  // ── Final score ────────────────────────────────────────────────────────
  const rawScore = batScore + bowlScore + arScore + wkScore + fieldScore + osScore + balanceScore + depthScore + captainScore + efficiencyScore;
  const score = Math.round(Math.min(100, rawScore));

  const breakdown = {
    batting:     { score: r2(batScore),      max: 15, label: "Batting Power",         explain: batExplain,    whyPoints: _whyPoints(batScore, 15, batExplain),  whyDeducted: _whyDeducted(batScore, 15, pureBatters.length < 4 ? ["thin batting depth"] : []) },
    bowling:     { score: r2(bowlScore),     max: 15, label: "Bowling Attack",         explain: bowlExplain,   whyPoints: _whyPoints(bowlScore, 15, bowlExplain), whyDeducted: _whyDeducted(bowlScore, 15, spinnerCount === 0 ? ["no specialist spinner"] : pacerCount === 0 ? ["no specialist pacer"] : []) },
    allRounders: { score: r2(arScore),       max: 12, label: "All-Rounders",           explain: arExplain,     whyPoints: _whyPoints(arScore, 12, arExplain),    whyDeducted: _whyDeducted(arScore, 12, allRounders.length < 2 ? ["insufficient all-rounder depth"] : []) },
    wicketkeeping:{ score: r2(wkScore),      max: 10, label: "Wicketkeeping",          explain: wkExplain,     whyPoints: _whyPoints(wkScore, 10, wkExplain),    whyDeducted: _whyDeducted(wkScore, 10, keepers.length === 0 ? ["no wicketkeeper"] : []) },
    fielding:    { score: r2(fieldScore),    max: 10, label: "Fielding",               explain: fieldExplain,  whyPoints: _whyPoints(fieldScore, 10, fieldExplain), whyDeducted: _whyDeducted(fieldScore, 10, eliteFieldersInSquad.length < 3 ? ["few elite fielders"] : []) },
    overseas:    { score: r2(osScore),       max: 10, label: "Overseas Utilization",   explain: osExplain,     whyPoints: _whyPoints(osScore, 10, osExplain),    whyDeducted: _whyDeducted(osScore, 10, overseasPlayers.length < 4 ? ["overseas slots underused"] : []) },
    balance:     { score: r2(balanceScore),  max: 8,  label: "Team Balance",           explain: balExplain,    whyPoints: _whyPoints(balanceScore, 8, balExplain.filter((s) => !s.includes("("))), whyDeducted: balExplain.filter((s) => s.includes("(-")) },
    depth:       { score: r2(depthScore),    max: 8,  label: "Squad Depth",            explain: depthExplain,  whyPoints: _whyPoints(depthScore, 8, depthExplain), whyDeducted: _whyDeducted(depthScore, 8, total < 15 ? [`only ${total} players`] : []) },
    captain:     { score: r2(captainScore),  max: 7,  label: "Captain Strength",       explain: capExplain,    whyPoints: _whyPoints(captainScore, 7, capExplain), whyDeducted: [] },
    efficiency:  { score: r2(efficiencyScore),max: 5, label: "Budget Efficiency",      explain: effExplain,    whyPoints: _whyPoints(efficiencyScore, 5, effExplain), whyDeducted: valuePerCrore < 0.03 ? ["overpaid for quality received"] : [] },
  };

  // ── Strengths & Weaknesses ────────────────────────────────────────────
  const sortedAreas = Object.entries(breakdown).sort((a, b) => (b[1].score / b[1].max) - (a[1].score / a[1].max));
  const strengths = sortedAreas.slice(0, 3).map(([k, v]) => `${v.label}: ${v.score}/${v.max} — ${v.explain[0] || "strong"}`);
  const weaknesses = sortedAreas.slice(-3).reverse().map(([k, v]) => `${v.label}: ${v.score}/${v.max} — ${v.explain[0] || "needs improvement"}`);

  // ── Best Buy / Steal Buy / Worst Buy ──────────────────────────────────
  const { bestBuy, stealBuy, worstBuy } = computeBuys(squad);

  return {
    teamId, teamName, teamFull, score,
    breakdown, strengths, weaknesses,
    bestBuy, stealBuy, worstBuy,
    squadSize: total, remaining,
  };
}

function _whyPoints(score, max, reasons) {
  if (score >= max * 0.85) return [`Full marks awarded — ${reasons[0] || "excellent in this area"}`];
  if (score >= max * 0.6) return [`Good score — ${reasons[0] || "solid performance in this area"}`];
  return reasons.slice(0, 2);
}

function _whyDeducted(score, max, reasons) {
  if (score >= max * 0.85 || reasons.length === 0) return [];
  const deducted = r2(max - score);
  return reasons.map((r) => `-${deducted} pts: ${r}`);
}

/**
 * Identify best buy (highest quality per crore), steal (biggest quality vs price gap),
 * and worst buy (most overpaid) in a squad.
 */
function computeBuys(squad) {
  if (squad.length === 0) return { bestBuy: null, stealBuy: null, worstBuy: null };

  // Filter out retentions (they have fixed prices unrelated to auction value)
  const auctioned = squad.filter((p) => !p.isRetention && p.price > 0);
  const all = squad;

  // Quality score for each player
  const withValue = all.map((p) => {
    const q = quality(p.catalogBase || p.base || 0.2);
    const paid = p.price || 0.2;
    const expectedPrice = p.catalogBase * 8; // rough market value (8x base = typical IPL multiple)
    const valueRatio = q / Math.max(paid, 0.2); // quality per crore
    const bargainScore = expectedPrice > 0 ? (expectedPrice - paid) / expectedPrice : 0; // how much below expected
    return { ...p, q, paid, valueRatio, bargainScore };
  });

  // Best Buy = highest absolute quality in the squad
  const bestBuy = [...withValue].sort((a, b) => b.q - a.q)[0] || null;

  // Steal Buy = biggest positive bargain (high quality, low price relative to worth)
  const steals = withValue.filter((p) => !p.isRetention);
  const stealBuy = steals.length > 0 ? [...steals].sort((a, b) => b.bargainScore * b.q - a.bargainScore * a.q)[0] : withValue[0] || null;

  // Worst Buy = most overpaid relative to quality (only auctioned players)
  const worstCandidates = auctioned.length > 0 ? auctioned : all;
  const worstBuy = worstCandidates.length > 0 ? [...worstCandidates].sort((a, b) => {
    const aOver = a.price / Math.max(quality(a.catalogBase || 0.2), 0.01);
    const bOver = b.price / Math.max(quality(b.catalogBase || 0.2), 0.01);
    return bOver - aOver;
  })[0] : null;

  const fmt = (p) => p ? {
    name: p.name, role: p.role, country: p.country,
    price: p.price, quality: r2(p.q || quality(p.catalogBase || p.base || 0.2)),
    reason: _buyReason(p),
  } : null;

  return {
    bestBuy: fmt(bestBuy),
    stealBuy: fmt(stealBuy),
    worstBuy: fmt(worstBuy),
  };
}

function _buyReason(p) {
  const q = p.q || quality(p.catalogBase || p.base || 0.2);
  const paid = p.price || 0;
  if (p.isRetention) return `retained at ₹${paid.toFixed(2)} Cr — franchise priority`;
  if (q >= 0.9 && paid <= 5) return `world-class player at ₹${paid.toFixed(2)} Cr — exceptional steal`;
  if (q >= 0.85) return `elite quality (q=${r2(q)}) at ₹${paid.toFixed(2)} Cr`;
  if (paid > 15 && q < 0.7) return `₹${paid.toFixed(2)} Cr is steep for this quality profile`;
  if (paid > 10 && q < 0.6) return `significantly overpaid at ₹${paid.toFixed(2)} Cr`;
  return `₹${paid.toFixed(2)} Cr — fair market price`;
}

/**
 * Build the AI leaderboard: analyse all owned franchises and rank them.
 * @param {Array} ownedTeams  — each: { id, name, full, color, purchased, remaining }
 * @param {Array} catalog     — full catalog
 * @param {number} startPurse
 * @returns { leaderboard: [...], strongest: teamId }
 */
function buildTeamLeaderboard(ownedTeams, catalog, startPurse = 100) {
  const analyses = ownedTeams.map((t) =>
    analyseTeam({ teamId: t.id, teamName: t.name, teamFull: t.full, purchased: t.purchased, catalog, remaining: t.remaining, startPurse })
  );
  analyses.sort((a, b) => b.score - a.score);
  analyses.forEach((a, i) => { a.rank = i + 1; });
  return { leaderboard: analyses, strongest: analyses[0]?.teamId || null };
}

function _emptyAnalysis(teamId, teamName, teamFull) {
  return {
    teamId, teamName, teamFull, score: 0,
    breakdown: {}, strengths: [], weaknesses: ["No players purchased yet"],
    bestBuy: null, stealBuy: null, worstBuy: null,
    squadSize: 0, remaining: 0,
  };
}

module.exports.analyseTeam = analyseTeam;
module.exports.buildTeamLeaderboard = buildTeamLeaderboard;
module.exports.computeBuys = computeBuys;