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

module.exports = { evaluateTeam, buildResults, profile, quality };