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

// Team Power Rating — same formula as the original updatePowerStats()
export function powerStats(xiIds, catalogById) {
  let batScore = 0;
  let bowlScore = 0;
  for (const id of xiIds) {
    const p = catalogById[id];
    if (!p) continue;
    const wk = p.stats.wkts !== "—" ? Number(p.stats.wkts) : 0;
    if (["Batsman", "Wicketkeeper"].includes(p.role)) {
      batScore += Math.min(100, p.stats.runs / 40 + parseFloat(p.stats.sr) / 1.5);
    } else if (p.role === "Bowler") {
      bowlScore += Math.min(100, wk / 1.2);
    } else {
      batScore += Math.min(50, p.stats.runs / 40);
      bowlScore += Math.min(50, wk / 1.2);
    }
  }
  const bat = Math.min(100, (batScore / 700) * 100);
  const bowl = Math.min(100, (bowlScore / 700) * 100);
  return { bat, bowl, balance: (bat + bowl) / 2 };
}

export const spentBy = (team) => team.purchased.reduce((a, p) => a + p.price, 0);
