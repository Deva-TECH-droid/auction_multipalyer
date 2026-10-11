/*
 * REAL IPL 2026 season stats (tournament finished 31 May 2026; RCB beat GT in the final).
 * Only numbers that were published by the sources below are listed — nothing is estimated.
 * Players that are not in this file simply show "IPL 2026 stats not available" in the game.
 *
 * Sources: Herald Goa Orange-Cap table (Mat/Runs/HS/Avg/SR), Business Standard (Kohli 675 runs, avg 56.25),
 *          Tribune India / SA Cricket Mag / Citizen (Purple-Cap & South African players' season figures).
 *
 * Fields: mat, runs, hs, avg, sr (batting) · wkts, eco, bowlAvg, best (bowling). null = not published.
 * To add more players, append an entry keyed by the EXACT name used in data.js.
 */
const S = (o) => ({ season: "IPL 2026", mat: null, runs: null, hs: null, avg: null, sr: null, wkts: null, eco: null, bowlAvg: null, best: null, ...o });

const IPL_STATS = {
  // ── batting ──
  "Shubman Gill":      S({ mat: 16, runs: 732, hs: "104", avg: 45.75, sr: 163.02 }),
  "Sai Sudharsan":     S({ mat: 17, runs: 722, hs: "100", avg: 45.13, sr: 157.98 }),
  "Heinrich Klaasen":  S({ mat: 15, runs: 624, hs: "69", avg: 48.0, sr: 160.0 }),
  "Ishan Kishan":      S({ mat: 15, runs: 602, hs: "91", avg: 40.13, sr: 182.42 }),
  "Virat Kohli":       S({ mat: 16, runs: 675, hs: "105*", avg: 56.25 }),
  "K.L. Rahul":        S({ mat: 14, runs: 593, hs: "152*", avg: 45.62, sr: 174.41 }),
  "Abhishek Sharma":   S({ mat: 15, runs: 563, hs: "135*", avg: 40.21, sr: 204.72 }),
  "Mitchell Marsh":    S({ mat: 13, runs: 563, hs: "111", avg: 43.31, sr: 163.18 }),
  "Dhruv Jurel":       S({ mat: 16, runs: 515, hs: "81*", avg: 36.79, sr: 154.65 }),
  "David Miller":      S({ runs: 211, hs: "51", avg: 35.17, sr: 154.01 }),
  // ── bowling ──
  "Kagiso Rabada":     S({ mat: 17, wkts: 29, eco: 9.68, bowlAvg: 21.58, best: "3/25" }),
  "Bhuvneshwar Kumar": S({ mat: 16, wkts: 28, eco: 7.95, bowlAvg: 17.89, best: "4/23" }),
  "Jofra Archer":      S({ mat: 16, wkts: 25, eco: 9.31, bowlAvg: 22.36, best: "3/17" }),
  "Rashid Khan":       S({ wkts: 21 }),
  "Nandre Burger":     S({ mat: 13, wkts: 14, eco: 10.11, bowlAvg: 31.42, best: "2/21" }),
  "Lungi Ngidi":       S({ mat: 12, wkts: 13, eco: 8.22, bowlAvg: 26.15, best: "3/27" }),
  "Corbin Bosch":      S({ mat: 6, runs: 50, sr: 161.29, wkts: 12, eco: 9.66, bowlAvg: 16.25, best: "4/26" }),
  "Marco Jansen":      S({ mat: 13, runs: 51, wkts: 9, eco: 10.2, bowlAvg: 53.66, best: "2/33" }),
};

module.exports = { IPL_STATS };