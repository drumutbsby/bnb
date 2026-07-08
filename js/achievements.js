// Başarımlar (rozetler). test(profile, game) → kilidi açık mı?
// game: son oyunun özeti { won, team, correct, questions, perfect, fastMs, time }
export const ACHIEVEMENTS = [
  { id: "first_win", name: "İlk Zafer", emoji: "🥇", desc: "İlk oyununu kazan", test: (p) => p.wins >= 1 },
  { id: "games10", name: "Tiryaki", emoji: "🎮", desc: "10 oyun oyna", test: (p) => p.games >= 10 },
  { id: "wins10", name: "Şampiyon", emoji: "🏆", desc: "10 oyun kazan", test: (p) => p.wins >= 10 },
  { id: "games50", name: "Efsane Yolu", emoji: "🌟", desc: "50 oyun oyna", test: (p) => p.games >= 50 },
  { id: "perfect", name: "Kusursuz", emoji: "💯", desc: "Bir oyunda tüm soruları bil", test: (p, g) => !!(g && g.perfect) },
  { id: "speed", name: "Hız Canavarı", emoji: "⚡", desc: "2 sn'den hızlı doğru cevap", test: (p, g) => !!(g && g.fastMs > 0 && g.fastMs < 2000) },
  { id: "streak5", name: "Alev Aldı", emoji: "🔥", desc: "5 soruyu arka arkaya bil", test: (p) => p.bestStreak >= 5 },
  { id: "sharp", name: "Keskin Nişancı", emoji: "🎯", desc: "Bir oyunda %90+ doğru", test: (p, g) => !!(g && g.questions >= 5 && g.correct / g.questions >= 0.9) },
  { id: "team", name: "Takım Ruhu", emoji: "🤝", desc: "Bir takım düellosu kazan", test: (p, g) => !!(g && g.team && g.won) },
  { id: "expert", name: "Uzman", emoji: "🎓", desc: "Uzman rütbesine ulaş", test: (p) => p.xp >= 35000 },
  { id: "legend", name: "Efsane", emoji: "👑", desc: "Efsane rütbesine ulaş", test: (p) => p.xp >= 300000 },
];

// Yeni açılan rozetleri döndürür ve profile.badges'i günceller.
export function evaluateBadges(profile, game) {
  profile.badges = profile.badges || {};
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (!profile.badges[a.id] && a.test(profile, game || {})) {
      profile.badges[a.id] = (game && game.time) || 1;
      newly.push(a);
    }
  }
  return newly;
}
