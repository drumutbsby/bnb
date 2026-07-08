// Günlük görevler + giriş (geri-gelme) serisi — cihazda kalıcı.
import { loadProfile, saveProfile } from "./profile.js";

const QUEST_POOL = [
  { id: "play3", text: "3 oyun oyna", goal: 3, xp: 300, metric: "games" },
  { id: "play5", text: "5 oyun oyna", goal: 5, xp: 500, metric: "games" },
  { id: "correct30", text: "30 doğru cevap ver", goal: 30, xp: 300, metric: "correct" },
  { id: "win1", text: "1 oyun kazan", goal: 1, xp: 400, metric: "wins" },
  { id: "perfect1", text: "1 kusursuz oyun yap", goal: 1, xp: 500, metric: "perfect" },
  { id: "streak3", text: "Bir oyunda 3'lü seri yap", goal: 3, xp: 250, metric: "streak" },
  { id: "duel1", text: "1 takım düellosu oyna", goal: 1, xp: 350, metric: "duel" },
];

function dayNumber() { return Math.floor(Date.now() / 86400000); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

// Bugünün görevlerini ve giriş serisini garantiye alır (gün değiştiyse yeniler).
export function ensureDaily() {
  const p = loadProfile();
  p.daily = p.daily || { date: "", quests: [], streak: 0, lastActiveDay: 0, log: [] };
  const today = todayStr();
  if (p.daily.date !== today) {
    const dn = dayNumber();
    // Güne göre deterministik 3 görev
    const pool = [...QUEST_POOL]; const picks = []; let seed = dn + 1;
    for (let k = 0; k < 3 && pool.length; k++) {
      seed = (seed * 9301 + 49297) % 233280;
      picks.push(pool.splice(seed % pool.length, 1)[0]);
    }
    p.daily.quests = picks.map((q) => ({ ...q, progress: 0, done: false, claimed: false }));
    // Giriş serisi
    const last = p.daily.lastActiveDay || 0;
    if (last && dn - last === 1) p.daily.streak = (p.daily.streak || 0) + 1;
    else p.daily.streak = 1;
    p.daily.lastActiveDay = dn;
    p.daily.date = today;
    p.daily.log = p.daily.log || [];
    if (p.daily.log[p.daily.log.length - 1] !== dn) {
      p.daily.log.push(dn); if (p.daily.log.length > 21) p.daily.log = p.daily.log.slice(-21);
    }
    saveProfile(p);
  }
  return p.daily;
}

// Oyun sonrası görev ilerlemesini işler; tamamlanan görevlerin XP'sini ekler; tamamlananları döndürür.
export function updateDailyAfterGame(game) {
  ensureDaily();
  const p = loadProfile();
  const d = p.daily;
  const inc = {
    games: 1, correct: game.correct || 0, wins: game.won ? 1 : 0,
    perfect: game.perfect ? 1 : 0, duel: game.team ? 1 : 0,
  };
  const completed = [];
  for (const q of d.quests) {
    if (q.done) continue;
    if (q.metric === "streak") {
      if ((game.maxStreak || 0) >= q.goal) q.progress = q.goal;
    } else {
      q.progress = Math.min(q.goal, (q.progress || 0) + (inc[q.metric] || 0));
    }
    if (q.progress >= q.goal && !q.done) {
      q.done = true;
      if (!q.claimed) { q.claimed = true; p.xp = (p.xp || 0) + q.xp; completed.push(q); }
    }
  }
  saveProfile(p);
  return completed;
}

export function loginStreak() { return (loadProfile().daily || {}).streak || 0; }
