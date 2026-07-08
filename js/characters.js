// Oyun aşamalarında beliren karakterler (konuşma balonlu tepkiler).
export const CHARACTERS = {
  fire:    { emoji: "🔥", name: "Alev Adam", phrases: ["Durdurulamıyorsun!", "Yangın çıkardın! 🔥", "Bu ne hız bu ne bilgi!"] },
  nervous: { emoji: "😰", name: "Tedirgin Kadın", phrases: ["Aman aman... toparlan!", "Nefes al, düzelir 😅", "Panik yok, panik yok..."] },
  prof:    { emoji: "👨‍🏫", name: "Profesör", phrases: ["Kusursuz! Bir dâhiyle karşı karşıyayım.", "Bunu derste örnek göstereceğim.", "Alnından öperim evlat!"] },
  clown:   { emoji: "🤡", name: "Palyaço", phrases: ["Bugün şans küstü galiba!", "Olsun, gülmek de güzel 🤡", "Bir dahakine kesin!"] },
  owl:     { emoji: "🦉", name: "Bilge Baykuş", phrases: ["Bilgelik seninle.", "Sakin ve isabetli, güzel.", "Baykuş onayını verdi."] },
  rocket:  { emoji: "🚀", name: "Roket", phrases: ["Işık hızı!", "Parmakların mı yandı?", "Vınnn! 🚀"] },
  turtle:  { emoji: "🐢", name: "Kaplumbağa", phrases: ["Acelen ne, yavaş yavaş...", "Emin adım güzel ama biraz hızlan 🐢"] },
  crown:   { emoji: "👑", name: "Kral", phrases: ["Arenanın kralı sensin!", "Taç senin!", "Zafer senin oldu 👑"] },
};

export function pickPhrase(id, seed) {
  const c = CHARACTERS[id];
  if (!c) return "";
  return c.phrases[Math.abs(seed | 0) % c.phrases.length];
}
