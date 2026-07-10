// Soru bankası — çok kategorili, çoktan seçmeli.
// Her soru: { q: soru metni, options: [4 şık], answer: doğru şıkkın index'i (0-3) }
//
// Sorular kategori dosyalarına bölünmüştür (js/questions/<kategori>.js) ve
// yalnızca oyunda seçilen kategoriler TALEP ANINDA (lazy) yüklenir. Böylece
// havuz büyüse de açılış hızlı kalır; her kategori dosyası tarayıcı/SW tarafından
// bir kez indirilip önbelleğe alınır.

export const CATEGORIES = {
  genel: { name: "Genel Kültür", emoji: "🧠", color: "#e21b3c" },
  tarih: { name: "Tarih", emoji: "🏛️", color: "#1368ce" },
  cografya: { name: "Coğrafya", emoji: "🌍", color: "#26890c" },
  bilim: { name: "Bilim & Doğa", emoji: "🔬", color: "#9c6600" },
  spor: { name: "Spor", emoji: "⚽", color: "#864cbf" },
  sanat: { name: "Sanat & Edebiyat", emoji: "🎨", color: "#0aa3a3" },
  sinema: { name: "Sinema & Müzik", emoji: "🎬", color: "#e2691b" },
  teknoloji: { name: "Teknoloji", emoji: "💻", color: "#5a5a5a" },
  turkiye: { name: "Türkiye", emoji: "🇹🇷", color: "#c8102e" },
  hayvanlar: { name: "Hayvanlar", emoji: "🦁", color: "#2d8f4e" },
  bayrak: { name: "Bayraklar", emoji: "🚩", color: "#b3261e" },
  emoji: { name: "Emoji Bilmece", emoji: "🧩", color: "#7c2fd6" },
};

// Kendi sorularını yazmak isteyenler için özel kategori (soruları localStorage'da tutulur)
export const CUSTOM_CATEGORY = { key: "ozel", name: "Kendi Sorularım", emoji: "✏️", color: "#e2691b" };

// Kategori -> tembel yükleyici (statik string import; buildless tarayıcıda çalışır).
const SHARDS = {
  genel: () => import("./questions/genel.js"),
  tarih: () => import("./questions/tarih.js"),
  cografya: () => import("./questions/cografya.js"),
  bilim: () => import("./questions/bilim.js"),
  spor: () => import("./questions/spor.js"),
  sanat: () => import("./questions/sanat.js"),
  sinema: () => import("./questions/sinema.js"),
  teknoloji: () => import("./questions/teknoloji.js"),
  turkiye: () => import("./questions/turkiye.js"),
  hayvanlar: () => import("./questions/hayvanlar.js"),
  bayrak: () => import("./questions/bayrak.js"),
  emoji: () => import("./questions/emoji.js"),
};

const _cache = {};
export async function loadCategory(key) {
  if (_cache[key]) return _cache[key];
  const loader = SHARDS[key];
  if (!loader) return [];
  try {
    const mod = await loader();
    _cache[key] = Array.isArray(mod.default) ? mod.default : [];
    return _cache[key];
  } catch (e) {
    return []; // Hatayı ÖNBELLEĞE ALMA: geçici ağ hatasından sonra tekrar denenebilsin.
  }
}

export function categoryKeys() { return Object.keys(SHARDS); }

// Seçilen kategorilerden rastgele `count` soru üretir (gerekli shard'ları yükler).
export async function buildQuestionSet(categoryKeys, count, customPool) {
  const keys = (!categoryKeys || categoryKeys.length === 0) ? Object.keys(SHARDS) : categoryKeys;
  const pool = [];
  for (const key of keys) {
    if (key === "ozel" && Array.isArray(customPool)) {
      for (const item of customPool) pool.push({ ...item, category: "ozel" });
    } else if (SHARDS[key]) {
      const arr = await loadCategory(key);
      for (const item of arr) pool.push({ ...item, category: key });
    }
  }
  // Karıştır (Fisher-Yates)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
