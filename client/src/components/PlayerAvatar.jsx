import React, { useState } from "react";

// One avatar used everywhere (auction card, squads, pool, results).
// Order: Wikipedia photo -> initials image -> local initials circle (works fully offline).
export const initialsUrl = (name, size = 96) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d1826&color=00e5ff&size=${size}&bold=true`;
export const wikiUrl = (name) =>
  `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(name.replace(/\s+/g, "_"))}.jpg?width=200`;
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export default function PlayerAvatar({ name, size = 34, className = "" }) {
  const [step, setStep] = useState(0); // 0 wiki, 1 initials image, 2 local initials
  if (step >= 2) {
    return (
      <span className={`pavatar pavatar-text ${className}`} style={{ width: size, height: size, fontSize: size * 0.38 }} title={name}>
        {initials(name)}
      </span>
    );
  }
  return (
    <img
      className={`pavatar ${className}`}
      style={{ width: size, height: size }}
      src={step === 0 ? wikiUrl(name) : initialsUrl(name, size * 2)}
      onError={() => setStep(step + 1)}
      alt=""
      title={name}
      loading="lazy"
    />
  );
}