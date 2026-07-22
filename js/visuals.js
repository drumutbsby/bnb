// Emoji görsellerini HER platformda güvenilir göster.
//
// Sorunlar:
//  - Windows hiçbir tarayıcıda ülke bayrağı emojisi çizmez ("🇫🇷" yerine "FR"
//    harfleri görünür — bayrak sorusunun cevabını da ele verir!).
//  - Yeni Unicode emojileri (🪸 🦤 🐦‍⬛ 🫖 ...) eski Windows/Android'de boş
//    kutu (tofu) ya da ayrık parçalar olarak görünür.
//
// Çözüm: destek canvas ile bir kez tespit edilir. Desteklenmeyen bayraklar
// gerçek bayrak görseline (flagcdn.com), desteklenmeyen emojiler Twemoji
// SVG'sine (jsDelivr) çevrilir. Destekleyen platformlarda (iOS/Android/macOS)
// yerel emoji korunur — hiç görüntü isteği yapılmaz. Service worker bu
// görselleri önbelleğe alır; bir kez görülen bayrak çevrimdışı da çalışır.

const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/";
const FLAG_BASE = "https://flagcdn.com/h120/"; // yükseklik-sabit: kareli/uzun bayraklar hizalı kalır

const FLAG_PAIR = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;
const EMOJI_ISH = /[\u200D\uFE0F]|\p{Extended_Pictographic}/u;

function escText(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --- Canvas tabanlı destek tespiti -----------------------------------------
let _ctx;
function getCtx() {
  if (_ctx !== undefined) return _ctx;
  try {
    const c = document.createElement("canvas");
    c.width = 28; c.height = 28;
    _ctx = c.getContext("2d", { willReadFrequently: true });
    if (_ctx) { _ctx.font = "22px sans-serif"; _ctx.textBaseline = "top"; }
  } catch { _ctx = null; }
  return _ctx;
}

function draw(text) {
  const x = getCtx();
  x.clearRect(0, 0, 28, 28);
  x.fillText(text, 0, 2);
  return x.getImageData(0, 0, 28, 28).data;
}

function samePixels(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function isBlank(d) {
  for (let i = 3; i < d.length; i += 4) if (d[i] > 8) return false;
  return true;
}

function hasColor(d) {
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 16) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (Math.abs(r - g) > 32 || Math.abs(r - b) > 32 || Math.abs(g - b) > 32) return true;
    }
  }
  return false;
}

// Bayrak desteği: gerçek bayraklar RENKLİDİR; Windows'un harf yedeği tek
// renklidir. Önce platform geneli (🇨🇭 İsviçre = kırmızı) hızlı kontrol,
// sonra bayrak başına kontrol (platform çoğunu bilip 🇽🇰 gibi yenilerini
// bilmeyebilir).
let _flagOk = null;
export function supportsFlags() {
  if (_flagOk !== null) return _flagOk;
  const x = getCtx();
  if (!x) return (_flagOk = true); // tespit yapılamıyorsa yerel emojiyi dene
  try { _flagOk = hasColor(draw("\u{1F1E8}\u{1F1ED}")); } catch { _flagOk = true; }
  return _flagOk;
}

const _flagCache = new Map();
export function supportsFlag(pair) {
  if (!supportsFlags()) return false; // platform hiç bayrak çizemiyor
  const hit = _flagCache.get(pair);
  if (hit !== undefined) return hit;
  const x = getCtx();
  let ok = true;
  if (x) { try { ok = hasColor(draw(pair)); } catch { ok = true; } }
  _flagCache.set(pair, ok);
  return ok;
}

// Tek emoji / ZWJ dizisi desteği.
//  - Boş ya da tofu (eksik glif kutusu) çiziliyorsa desteklenmiyor.
//  - ZWJ dizisi, parçaları birleştirmiyorsa (genişlik ayrışmamış hâliyle aynı)
//    desteklenmiyor (🐦‍⬛ eski sistemde 🐦+⬛ olarak ayrılır).
let _tofu = null;
const _emojiCache = new Map();
export function supportsEmoji(cluster) {
  const hit = _emojiCache.get(cluster);
  if (hit !== undefined) return hit;
  const x = getCtx();
  let ok = true;
  if (x) {
    try {
      if (cluster.includes("\u200D")) {
        const joined = x.measureText(cluster).width;
        const split = x.measureText(cluster.replace(/\u200D/g, "")).width;
        ok = joined < split * 0.85; // birleşmişse belirgin şekilde daralır
      } else {
        if (_tofu === null) _tofu = draw("\u0378"); // atanmamış kod noktası = tofu örneği
        const d = draw(cluster);
        ok = !isBlank(d) && !samePixels(d, _tofu);
      }
    } catch { ok = true; }
  }
  _emojiCache.set(cluster, ok);
  return ok;
}

// --- Yardımcılar -------------------------------------------------------------
// 🇫🇷 → "fr" (bölgesel göstergelerden ISO ülke kodu)
function flagCode(pair) {
  let out = "";
  for (const ch of pair) out += String.fromCharCode(ch.codePointAt(0) - 0x1F1E6 + 97);
  return /^[a-z]{2}$/.test(out) ? out : null;
}

// Twemoji dosya adı: kod noktaları '-' ile; ZWJ yoksa FE0F (VS16) atılır.
function twemojiFile(cluster) {
  let s = cluster;
  if (!s.includes("\u200D")) s = s.replace(/\uFE0F/g, "");
  const parts = [];
  for (const ch of s) parts.push(ch.codePointAt(0).toString(16));
  return parts.join("-");
}

// Metni görsel kümelere (grapheme cluster) ayır
function splitClusters(str) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter("tr", { granularity: "grapheme" });
    return [...seg.segment(str)].map((s) => s.segment);
  }
  // Yedek: bayrak çifti | (emoji + ton + VS16) ZWJ zinciri | tek karakter
  const re = /[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}[\u{1F3FB}-\u{1F3FF}]?\uFE0F?(?:\u200D\p{Extended_Pictographic}[\u{1F3FB}-\u{1F3FF}]?\uFE0F?)*|[\s\S]/gu;
  return str.match(re) || [];
}

// --- Ana API -----------------------------------------------------------------
// Bir "visual" metnini güvenli HTML'e çevirir: desteklenmeyen bayrak/emoji
// kümeleri <img> olur, gerisi kaçışlanmış düz metin kalır.
export function visualToHTML(visual) {
  let out = "";
  for (const cl of splitClusters(String(visual))) {
    if (FLAG_PAIR.test(cl)) {
      const cc = flagCode(cl);
      if (cc && !supportsFlag(cl)) {
        // alt="bayrak": görsel yüklenemezse ülke kodu harflerini sızdırma
        out += `<img class="flag-img" src="${FLAG_BASE}${cc}.png" alt="bayrak" draggable="false">`;
        continue;
      }
      out += escText(cl);
      continue;
    }
    if (EMOJI_ISH.test(cl) && !supportsEmoji(cl)) {
      const file = twemojiFile(cl);
      if (/^[0-9a-f-]+$/.test(file)) {
        out += `<img class="emoji-img" src="${TWEMOJI_BASE}${file}.svg" alt="${escText(cl)}" draggable="false">`;
        continue;
      }
    }
    out += escText(cl);
  }
  return out;
}
