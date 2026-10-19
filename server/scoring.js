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