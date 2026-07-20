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

// Yerel takvim gününün numarası — todayStr ile AYNI gün tanımını kullanır.
// (UTC tabanlı sayım, TR'de 00:00-03:00 arasında seriyi haksız sıfırlıyor ve
// Günün Sorusu'nun 03:00'e kadar değişmemesine yol açıyordu.)
export function dayNumber() { return Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000); }
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

// ---------------------------------------------------------------------------
// Günün Sorusu — herkese aynı, günde tek hak. Doğru cevap = bonus XP + gün serisi.
// ---------------------------------------------------------------------------
export function dailyQuestionStatus() {
  const dq = loadProfile().dq || {};
  return {
    answeredToday: dq.date === todayStr(),
    correct: !!dq.correct,
    streak: dq.streak || 0,
    best: dq.best || 0,
  };
}

// Bugünkü cevabı kaydeder; XP verir; {already, xp, streak, best, correct} döndürür.
export function recordDailyQuestion(correct) {
  const p = loadProfile();
  const today = todayStr(); const dn = dayNumber();
  p.dq = p.dq || { date: "", correct: false, streak: 0, best: 0, lastDay: 0 };
  if (p.dq.date === today) {
    return { already: true, xp: 0, streak: p.dq.streak || 0, best: p.dq.best || 0, correct: !!p.dq.correct };
  }
  if (correct) {
    // Dün de doğru bildiysen seri büyür; değilse 1'den başlar.
    if (p.dq.lastDay && dn - p.dq.lastDay === 1 && p.dq.correct) p.dq.streak = (p.dq.streak || 0) + 1;
    else p.dq.streak = 1;
  } else {
    p.dq.streak = 0;
  }
  p.dq.date = today; p.dq.lastDay = dn; p.dq.correct = !!correct;
  if ((p.dq.streak || 0) > (p.dq.best || 0)) p.dq.best = p.dq.streak;
  // Katılım 60 XP; doğruya 400 + seri başına 100 (tavan 600 bonus).
  const xp = correct ? (400 + Math.min(600, (p.dq.streak - 1) * 100)) : 60;
  p.xp = (p.xp || 0) + xp;
  saveProfile(p);
  return { already: false, xp, streak: p.dq.streak || 0, best: p.dq.best || 0, correct: !!correct };
}

// ---------------------------------------------------------------------------
// Davet ödülü (en iyi çaba, yerel) — davet paylaşımı günde bir kez XP kazandırır.
// Sunucu olmadığı için gerçek "kim katıldı" takibi yapılmaz; paylaşım teşvik edilir.
// ---------------------------------------------------------------------------
export function inviteStatus() {
  const iv = loadProfile().invite || {};
  return { sharedToday: (iv.days || []).includes(dayNumber()), count: iv.count || 0 };
}

export function recordInviteShare() {
  const p = loadProfile();
  const dn = dayNumber();
  p.invite = p.invite || { days: [], count: 0 };
  if ((p.invite.days || []).includes(dn)) {
    return { already: true, xp: 0, count: p.invite.count || 0 };
  }
  p.invite.days = p.invite.days || [];
  p.invite.days.push(dn);
  if (p.invite.days.length > 90) p.invite.days = p.invite.days.slice(-90);
  p.invite.count = (p.invite.count || 0) + 1;
  const xp = 150;
  p.xp = (p.xp || 0) + xp;
  saveProfile(p);
  return { already: false, xp, count: p.invite.count };
}
