// Reaction paketi — reveal ekranında bağlama özel, 2-3 sn ÖZGÜN animasyonlu
// tepkiler (telifsiz emoji + metin + hareket). Popüler meme'lerin *hissini*
// yakalar ama telif riski taşımaz; kendi kendine yeter, çevrimdışı çalışır.
//
// Her tepki: { tags, emoji, text, anim, sfx? }
//  tags : "correct" | "wrong" | "combo" | "streak" | "first"
//  anim : pop | zoom | shake | drop | rain
//  sfx  : sound.js'teki bir ses adı (yalnız "hype" anlarında; sıradan
//         doğru/yanlış için reveal'ın kendi sesi çalar)
export const REACTIONS = [
  // Doğru (görsel; ses reveal'dan gelir)
  { tags: ["correct"], emoji: "🎉", text: "EFSANE!", anim: "pop" },
  { tags: ["correct"], emoji: "🔥", text: "KRAL!", anim: "pop" },
  { tags: ["correct"], emoji: "💯", text: "BOOM!", anim: "zoom" },
  { tags: ["correct"], emoji: "🎯", text: "TAM İSABET!", anim: "pop" },
  { tags: ["correct"], emoji: "🧠", text: "DAHİ!", anim: "pop" },
  { tags: ["correct"], emoji: "😎", text: "KOLAYDI!", anim: "zoom" },
  { tags: ["correct"], emoji: "🏆", text: "ŞAMPİYON!", anim: "pop" },
  // Yanlış (komik "fail" tepkileri + womp womp)
  { tags: ["wrong"], emoji: "💀", text: "IIH!", anim: "shake", sfx: "sad" },
  { tags: ["wrong"], emoji: "😬", text: "OLMADI!", anim: "shake", sfx: "boing" },
  { tags: ["wrong"], emoji: "🤡", text: "CAAN!", anim: "shake", sfx: "sad" },
  { tags: ["wrong"], emoji: "📉", text: "EYVAH!", anim: "drop", sfx: "boing" },
  { tags: ["wrong"], emoji: "🫠", text: "ERİDİN!", anim: "drop", sfx: "sad" },
  { tags: ["wrong"], emoji: "🙈", text: "GÖRMEDİM!", anim: "shake", sfx: "boing" },
  // Combo (hype)
  { tags: ["combo"], emoji: "🔥🔥", text: "COMBO!", anim: "zoom", sfx: "airhorn" },
  { tags: ["combo"], emoji: "⚡", text: "DURDURULAMAZ!", anim: "zoom", sfx: "airhorn" },
  { tags: ["combo"], emoji: "🚀", text: "ROKET GİBİ!", anim: "zoom", sfx: "airhorn" },
  // Seri kilometre taşı
  { tags: ["streak"], emoji: "👑", text: "SERİ CANAVARI!", anim: "rain", sfx: "airhorn" },
  { tags: ["streak"], emoji: "🐐", text: "EFSANEVİ SERİ!", anim: "rain", sfx: "airhorn" },
  // İlk doğru cevaplayan (çok oyunculu)
  { tags: ["first"], emoji: "⚡", text: "İLK SEN!", anim: "zoom", sfx: "streak" },
  { tags: ["first"], emoji: "🥇", text: "EN HIZLI!", anim: "pop", sfx: "streak" },
];

export function pickReaction(tag) {
  const pool = REACTIONS.filter((r) => r.tags.includes(tag));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
