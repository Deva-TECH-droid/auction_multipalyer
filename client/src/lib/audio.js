// Ported from the original script.js audio section. Files live in /public/sounds.
let currentAudio = null;
let muted = false;

const url = (file) => encodeURI(`/sounds/${file}`);

export function setMuted(m) {
  muted = m;
  if (m) { stopAudio(); stopCelebration(); }
}
export const isMuted = () => muted;

export function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

export function playAudio(file, volume = 0.5) {
  stopAudio();
  if (muted) return;
  currentAudio = new Audio(url(file));
  currentAudio.volume = volume;
  currentAudio.play().catch(() => {});
}

// Team anthem plays for 5 seconds only (or until the next player comes up).
export function playTeamTheme(teamId, ms = 5000) {
  playAudio(teamId === "dc" ? "dc (2).mp3" : `${teamId}.mp3`);
  const a = currentAudio;
  setTimeout(() => { if (a && currentAudio === a) stopAudio(); }, ms);
}
export function playIPLTheme() { playAudio("Ipl.mp3"); }

// IPL theme for the opening animation: plays only the first 10 seconds.
export function playIPLThemeFor(ms = 10000) {
  playAudio("Ipl.mp3", 0.6);
  const a = currentAudio;
  setTimeout(() => { if (a && currentAudio === a) stopAudio(); }, ms);
}
export function playHammerSound() {
  if (muted) return;
  const a = new Audio(url("hammer.mp3"));
  a.volume = 0.9;
  a.play().catch(() => {});
}
export function playUnsoldSound() { playAudio("E One.mp3", 0.8); }

export function playAuctionStartSequence() {
  if (muted) return;
  const people = new Audio(url("people.mp3"));
  people.volume = 0.5;
  people.play().catch(() => {});
  currentAudio = people;

  setTimeout(() => {
    if (currentAudio !== people) return;
    stopAudio();
    const viraj = new Audio(url("viraj.mp3"));
    viraj.volume = 0.8;
    viraj.play().catch(() => {});
    currentAudio = viraj;

    viraj.onended = () => {
      const clap = new Audio(url("clapping.mp3"));
      clap.volume = 0.6;
      clap.play().catch(() => {});
      currentAudio = clap;
      clap.onended = () => { if (currentAudio === clap) stopAudio(); };
    };
  }, 8000);
}

// ─── Winner celebration: crowd roar while suspense builds, then the team's FULL anthem ───
let celeAudio = [];
export function startCrowd() {
  stopAudio();
  if (muted) return;
  const crowd = new Audio(url("people.mp3"));
  crowd.loop = true;
  crowd._base = 0.5;
  crowd.volume = 0.5 * celeVolume;
  crowd.play().catch(() => {});
  celeAudio.push(crowd);
}
export function playWinnerTheme(teamId) {
  if (muted) return;
  const theme = new Audio(url(teamId === "dc" ? "dc (2).mp3" : `${teamId}.mp3`));
  theme._base = 0.9;
  theme.volume = 0.9 * celeVolume;
  theme.play().catch(() => {});
  const clap = new Audio(url("clapping.mp3"));
  clap.loop = true;
  clap._base = 0.35;
  clap.volume = 0.35 * celeVolume;
  clap.play().catch(() => {});
  celeAudio.push(theme, clap);
}
export function stopCelebration() {
  celeAudio.forEach((a) => { a.pause(); a.currentTime = 0; });
  celeAudio = [];
}

let celeVolume = 1;
export function setCelebrationVolume(v) {
  celeVolume = v;
  celeAudio.forEach((a) => { a.volume = Math.min(1, (a._base || 0.6) * v); });
}
export function pauseCelebration(paused) {
  celeAudio.forEach((a) => { if (paused) a.pause(); else a.play().catch(() => {}); });
}