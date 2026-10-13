
// Ported 1:1 from the original script.js helpers.

export function getFlag(country) {
  const map = {
    India: "🇮🇳", Australia: "🇦🇺", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    "South Africa": "🇿🇦", "New Zealand": "🇳🇿", "West Indies": "🌴",
    Afghanistan: "🇦🇫", "Sri Lanka": "🇱🇰", Bangladesh: "🇧🇩",
    Pakistan: "🇵🇰", Zimbabwe: "🇿🇼",
  };
  return map[country] || "🏳️";
}

export function getRoleTagClass(role) {
  if (role === "Batsman") return "role-tag-bat";
  if (role === "Bowler") return "role-tag-bowl";
  if (role === "Wicketkeeper") return "role-tag-wk";
  return "role-tag-ar";
}

export function getRoleShort(role) {
  if (role === "Batsman") return "BAT";
  if (role === "Bowler") return "BOWL";
  if (role === "Wicketkeeper") return "WK";
  return "AR";
}

export function roleColor(role) {
  return role === "Batsman" ? "var(--accent2)"
    : role === "Bowler" ? "var(--accent)"
    : role === "Wicketkeeper" ? "var(--gold)" : "var(--accent3)";
}

export const cr = (n) => `₹${Number(n).toFixed(2)} Cr`;

export const avatarFallback = (name, size = 64) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=${size}`;

// Team Power Rating (display only) — based on each player's role and star rating (base price),
// never on invented statistics. The official 30-mark result is computed on the server.
const quality = (base) => 0.3 + (0.7 * (base - 0.2)) / 1.8;
export function powerStats(xiIds, catalogById) {
  const bats = [];
  const bowls = [];
  for (const id of xiIds) {
    const p = catalogById[id];
    if (!p) continue;
    const q = quality(p.base);
    if (p.role === "Batsman" || p.role === "Wicketkeeper") bats.push(q);
    else if (p.role === "All-Rounder") { bats.push(0.85 * q); bowls.push(0.85 * q); }
    else { bowls.push(q); bats.push(0.2 * q); }
  }
  const top = (a, n) => [...a].sort((x, y) => y - x).slice(0, n).reduce((x, y) => x + y, 0) / n;
  const bat = Math.min(100, top(bats, 6) * 100);
  const bowl = Math.min(100, top(bowls, 5) * 100);
  return { bat, bowl, balance: (bat + bowl) / 2 };
}

export const spentBy = (team) => team.purchased.reduce((a, p) => a + p.price, 0);