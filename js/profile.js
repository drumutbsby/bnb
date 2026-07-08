// Kişisel profil, rekorlar ve rütbe (rank) sistemi — cihazda (localStorage) kalıcı.
const KEY = "bnb_profile";

export const RANKS = [
  { min: 0, name: "Çaylak", emoji: "🐣" },
  { min: 5000, name: "Meraklı", emoji: "🔎" },
  { min: 15000, name: "Bilgili", emoji: "📚" },
  { min: 35000, name: "Uzman", emoji: "🎓" },
  { min: 75000, name: "Usta", emoji: "🏅" },
  { min: 150000, name: "Bilge", emoji: "🦉" },
  { min: 300000, name: "Efsane", emoji: "👑" },
];

const DEFAULT = {
  name: "", xp: 0, games: 0, wins: 0,
  bestScore: 0, bestStreak: 0,
  totalCorrect: 0, totalQuestions: 0,
  history: [],
};

export function loadProfile() {
  try { return Object.assign({}, DEFAULT, JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch (e) { return { ...DEFAULT }; }
}
export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
}
export function setName(name) {
  const p = loadProfile();
  p.name = String(name || "").slice(0, 16);
  saveProfile(p);
}

export function rankFor(xp) {
  let r = RANKS[0];
  for (const t of RANKS) if (xp >= t.min) r = t;
  return r;
}
export function rankProgress(xp) {
  const cur = rankFor(xp);
  const idx = RANKS.indexOf(cur);
  const next = RANKS[idx + 1] || null;
  const pct = next ? Math.min(100, Math.round(((xp - cur.min) / (next.min - cur.min)) * 100)) : 100;
  return { cur, next, pct };
}

// Oyun bitince çağrılır; profili günceller, rütbe atlama bilgisini döndürür.
export function recordGame(result) {
  const p = loadProfile();
  const oldRank = rankFor(p.xp);
  const score = Math.max(0, result.score || 0);
  p.xp += score;
  p.games += 1;
  if (result.won) p.wins += 1;
  if (score > p.bestScore) p.bestScore = score;
  if ((result.streak || 0) > p.bestStreak) p.bestStreak = result.streak;
  p.totalCorrect += result.correct || 0;
  p.totalQuestions += result.questions || 0;
  p.history = p.history || [];
  p.history.unshift({
    t: result.time || 0, score,
    rank: result.rank || 0, players: result.players || 0,
    team: !!result.team, won: !!result.won,
  });
  if (p.history.length > 20) p.history.length = 20;
  const newRank = rankFor(p.xp);
  saveProfile(p);
  return {
    gainedXp: score,
    leveledUp: newRank !== oldRank,
    oldRank, newRank,
    profile: p,
  };
}
