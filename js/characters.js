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
  taunt:   { emoji: "😏", name: "Rakip", phrases: ["Bizden korkun!", "Bu iş bizde 😏", "Rakip terliyor galiba...", "Fark açılıyor!"] },
  cheer:   { emoji: "💪", name: "Moral", phrases: ["Geri döneceğiz!", "Pes yok, bas gaza!", "Daha bitmedi 💪", "Toparlanma vakti!"] },
  mc:      { emoji: "🎙️", name: "Sunucu", phrases: ["Müthiş bir yarış!", "Nefesler tutuldu!", "İşte bu bir bilgi şöleni!"] },
};

// Kategoriye özel espriler (sunucu 🎙️ ağzından ara ara söylenir)
export const CATEGORY_QUIPS = {
  genel:     ["Genel kültür dediğin böyle olur!", "Her şeyden biraz!"],
  tarih:     ["Tarih tekerrürden ibarettir!", "Osmanlı bunu sevdi 👳", "Geçmişe yolculuk!"],
  cografya:  ["Haritayı ezberlemişsin!", "Nereye gitsek buluyorsun 🌍"],
  bilim:     ["Bilim konuşuyor! 🔬", "Einstein gurur duyardı"],
  spor:      ["Gooool! ⚽", "Şampiyonlar Ligi finali gibi!"],
  sanat:     ["Bir sanat eseri kadar zarif 🎨", "Perde kapanmadı daha!"],
  sinema:    ["Oscar buraya! 🎬", "Sahne senin!"],
  teknoloji: ["Yazılımcı ruhu 💻", "Sistemi hackledin resmen!"],
  turkiye:   ["Türkiye'yi avucunun içi gibi biliyorsun 🇹🇷", "Yerli ve milli bilgi!"],
  hayvanlar: ["Doğa belgeseli tadında 🦁", "Hayvan dostu!"],
  bayrak:    ["Bayrakları şıp diye tanıdın 🚩", "Dünya turuna hazırsın!"],
  emoji:     ["Emoji dedektifi! 🧩", "Çözdün bil bakalım!"],
  ozel:      ["Kendi sorun kendi cevabın 😄", "Ev sahibi avantajı!"],
};

export function pickPhrase(id, seed) {
  const c = CHARACTERS[id];
  if (!c) return "";
  return c.phrases[Math.abs(seed | 0) % c.phrases.length];
}
