// Macera (kampanya) modu — hikâyeli, patika tabanlı tek kişilik yolculuk.
// Tüm görseller gömülü SVG (kendi kendine yeten, dış bağımlılık/istek yok — CSP dostu).
// Not: SVG'ler yalnızca bu dosyada, güvenilir; render'da innerHTML ile basılır.

// ---------------------------------------------------------------------------
// SVG sahneler — bölüm giriş ekranı ve ara sahne (cutscene) arka planı.
// Aynı anda ekranda tek sahne olduğu için gradient id çakışması olmaz;
// yine de güvenli olsun diye her sahne kendi id'sini kullanır.
// ---------------------------------------------------------------------------
export const SCENES = {
  koy: `<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Köy manzarası">
    <defs><linearGradient id="sk-koy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec9ff"/><stop offset="1" stop-color="#eaf6ff"/></linearGradient></defs>
    <rect width="320" height="160" fill="url(#sk-koy)"/>
    <circle cx="264" cy="36" r="19" fill="#ffd21e"/>
    <path d="M0 118 Q80 92 165 114 T320 108 V160 H0 Z" fill="#7bc86c"/>
    <path d="M0 138 Q120 120 320 136 V160 H0 Z" fill="#5aa64f"/>
    <g><rect x="58" y="96" width="36" height="28" fill="#ecd7ab"/><path d="M53 96 L76 78 L99 96 Z" fill="#c0392b"/><rect x="70" y="106" width="11" height="18" fill="#7a5230"/></g>
    <g><rect x="150" y="102" width="32" height="24" fill="#f2e3b6"/><path d="M145 102 L166 86 L187 102 Z" fill="#2d6cb0"/><rect x="161" y="110" width="10" height="16" fill="#7a5230"/></g>
    <g><rect x="228" y="104" width="28" height="22" fill="#ecd7ab"/><path d="M223 104 L242 90 L261 104 Z" fill="#864cbf"/></g>
  </svg>`,
  orman: `<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Orman manzarası">
    <defs><linearGradient id="sk-orm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe6c0"/><stop offset="1" stop-color="#e9f7ea"/></linearGradient></defs>
    <rect width="320" height="160" fill="url(#sk-orm)"/>
    <path d="M0 130 H320 V160 H0 Z" fill="#3c8b3a"/>
    <g fill="#2f7d3a">
      <g><rect x="42" y="96" width="8" height="34" fill="#6b4a25"/><path d="M46 40 L74 100 L18 100 Z"/><path d="M46 62 L70 110 L22 110 Z"/></g>
      <g><rect x="146" y="86" width="9" height="44" fill="#6b4a25"/><path d="M150 30 L184 96 L116 96 Z"/><path d="M150 56 L178 108 L122 108 Z"/></g>
      <g><rect x="252" y="98" width="8" height="32" fill="#6b4a25"/><path d="M256 48 L282 102 L230 102 Z"/></g>
    </g>
    <circle cx="286" cy="34" r="15" fill="#ffe680"/>
  </svg>`,
  dag: `<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dağ manzarası">
    <defs><linearGradient id="sk-dag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb8d6"/><stop offset="1" stop-color="#e7eef7"/></linearGradient></defs>
    <rect width="320" height="160" fill="url(#sk-dag)"/>
    <path d="M-10 150 L70 60 L130 150 Z" fill="#6b7f9e"/>
    <path d="M50 66 L70 60 L92 78 L80 84 L70 78 L62 84 Z" fill="#fff"/>
    <path d="M90 150 L180 40 L270 150 Z" fill="#556b8c"/>
    <path d="M158 62 L180 40 L204 66 L190 74 L180 66 L170 74 Z" fill="#fff"/>
    <path d="M220 150 L300 80 L340 150 Z" fill="#6b7f9e"/>
    <path d="M0 150 H320 V160 H0 Z" fill="#465b78"/>
  </svg>`,
  antik: `<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Antik şehir">
    <defs><linearGradient id="sk-ant" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd59e"/><stop offset="1" stop-color="#fff2e0"/></linearGradient></defs>
    <rect width="320" height="160" fill="url(#sk-ant)"/>
    <circle cx="160" cy="40" r="22" fill="#ff9d5c"/>
    <rect x="40" y="40" width="240" height="14" fill="#e8dcc0"/>
    <path d="M36 40 L160 16 L284 40 Z" fill="#d9c9a3"/>
    <g fill="#efe6cf">
      <rect x="56" y="58" width="16" height="72"/><rect x="96" y="58" width="16" height="72"/>
      <rect x="136" y="58" width="16" height="72"/><rect x="176" y="58" width="16" height="72"/>
      <rect x="216" y="58" width="16" height="72"/><rect x="248" y="58" width="16" height="72"/>
    </g>
    <rect x="40" y="130" width="240" height="12" fill="#d9c9a3"/>
  </svg>`,
  kasaba: `<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Renkli kasaba">
    <defs><linearGradient id="sk-kas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc6e0"/><stop offset="1" stop-color="#fff0f6"/></linearGradient></defs>
    <rect width="320" height="160" fill="url(#sk-kas)"/>
    <g>
      <rect x="30" y="70" width="40" height="60" fill="#e21b3c"/><path d="M26 70 L50 48 L74 70 Z" fill="#a01329"/>
      <rect x="82" y="54" width="40" height="76" fill="#1368ce"/><path d="M78 54 L102 34 L126 54 Z" fill="#0d4a91"/>
      <rect x="134" y="78" width="40" height="52" fill="#f0a500"/><path d="M130 78 L154 58 L178 78 Z" fill="#b87c00"/>
      <rect x="186" y="60" width="40" height="70" fill="#26890c"/><path d="M182 60 L206 40 L230 60 Z" fill="#1a6608"/>
      <rect x="238" y="74" width="42" height="56" fill="#864cbf"/><path d="M234 74 L259 54 L284 74 Z" fill="#5f3690"/>
    </g>
    <rect x="0" y="130" width="320" height="30" fill="#c98fb0"/>
  </svg>`,
  kale: `<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Kale">
    <defs><linearGradient id="sk-kal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2a63"/><stop offset="1" stop-color="#7a5bb0"/></linearGradient></defs>
    <rect width="320" height="160" fill="url(#sk-kal)"/>
    <circle cx="250" cy="40" r="26" fill="#ffe9a8"/>
    <g fill="#2b2540">
      <rect x="60" y="70" width="200" height="70"/>
      <rect x="48" y="52" width="26" height="88"/><rect x="246" y="52" width="26" height="88"/>
      <rect x="146" y="40" width="28" height="100"/>
      <g fill="#2b2540"><rect x="48" y="46" width="6" height="10"/><rect x="60" y="46" width="6" height="10"/><rect x="66" y="46" width="6" height="10"/><rect x="246" y="46" width="6" height="10"/><rect x="258" y="46" width="6" height="10"/><rect x="266" y="46" width="6" height="10"/><rect x="146" y="34" width="6" height="10"/><rect x="158" y="34" width="6" height="10"/><rect x="168" y="34" width="6" height="10"/></g>
    </g>
    <rect x="150" y="96" width="20" height="44" fill="#ffb545"/>
    <path d="M150 96 a10 10 0 0 1 20 0 Z" fill="#ffb545"/>
  </svg>`,
  zafer: `<svg viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Zafer">
    <defs><linearGradient id="sk-zaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#fff6d8"/></linearGradient></defs>
    <rect width="320" height="160" fill="url(#sk-zaf)"/>
    <g>
      <path d="M160 24 l14 30 33 4 -24 23 6 33 -29 -16 -29 16 6 -33 -24 -23 33 -4 Z" fill="#ffcf33" stroke="#e0a800" stroke-width="3"/>
    </g>
    <g fill="#e21b3c"><rect x="40" y="40" width="8" height="24"/><rect x="272" y="40" width="8" height="24"/></g>
    <g fill="#1368ce"><rect x="80" y="30" width="8" height="20"/><rect x="232" y="30" width="8" height="20"/></g>
    <path d="M0 132 H320 V160 H0 Z" fill="#f0c419"/>
  </svg>`,
};

// ---------------------------------------------------------------------------
// Resimli sorular — her biri gömülü SVG içerir. { q, options, answer, image }
// ---------------------------------------------------------------------------
const IMG = {
  flagTR: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bayrak">
    <rect width="240" height="140" fill="#e30a17"/>
    <circle cx="95" cy="70" r="34" fill="#fff"/><circle cx="105" cy="70" r="27" fill="#e30a17"/>
    <path d="M150 70 l-24 -8 15 20 0 -24 -15 20 24 -8" fill="#fff"/>
  </svg>`,
  hexagon: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Şekil">
    <rect width="240" height="140" fill="#eef1f7"/>
    <polygon points="120,24 178,57 178,113 120,146 62,113 62,57" fill="#1368ce" transform="translate(0,-8)"/>
  </svg>`,
  triangle: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Şekil">
    <rect width="240" height="140" fill="#eef1f7"/>
    <polygon points="120,26 196,116 44,116" fill="#26890c"/>
  </svg>`,
  colorMix: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Renk karışımı">
    <rect width="240" height="140" fill="#fafafa"/>
    <circle cx="98" cy="70" r="42" fill="#e21b3c" fill-opacity="0.85"/>
    <circle cx="142" cy="70" r="42" fill="#1368ce" fill-opacity="0.75"/>
  </svg>`,
  barChart: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sütun grafiği">
    <rect width="240" height="140" fill="#f7f7fb"/>
    <line x1="30" y1="118" x2="220" y2="118" stroke="#999" stroke-width="2"/>
    <rect x="46" y="78" width="30" height="40" fill="#e21b3c"/><text x="61" y="132" font-size="14" text-anchor="middle" fill="#333">A</text>
    <rect x="96" y="58" width="30" height="60" fill="#1368ce"/><text x="111" y="132" font-size="14" text-anchor="middle" fill="#333">B</text>
    <rect x="146" y="34" width="30" height="84" fill="#26890c"/><text x="161" y="132" font-size="14" text-anchor="middle" fill="#333">C</text>
    <rect x="196" y="92" width="24" height="26" fill="#f0a500"/><text x="208" y="132" font-size="14" text-anchor="middle" fill="#333">D</text>
  </svg>`,
  mountains: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dağlar">
    <rect width="240" height="140" fill="#dfe8f3"/>
    <polygon points="20,124 66,70 112,124" fill="#7f93b0"/>
    <polygon points="80,124 140,34 200,124" fill="#4f6489"/>
    <polygon points="150,124 196,74 240,124" fill="#7f93b0"/>
    <polygon points="128,54 140,34 153,56 145,60 140,52 135,60" fill="#fff"/>
  </svg>`,
  clock3: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Saat">
    <rect width="240" height="140" fill="#f2f4f8"/>
    <circle cx="120" cy="70" r="48" fill="#fff" stroke="#2b2540" stroke-width="4"/>
    <line x1="120" y1="70" x2="120" y2="38" stroke="#2b2540" stroke-width="4"/>
    <line x1="120" y1="70" x2="156" y2="70" stroke="#2b2540" stroke-width="4"/>
    <circle cx="120" cy="70" r="4" fill="#2b2540"/>
  </svg>`,
  romanColumns: `<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sütunlar">
    <rect width="240" height="140" fill="#fbf3e2"/>
    <rect x="30" y="20" width="180" height="12" fill="#d9c9a3"/>
    <g fill="#efe6cf"><rect x="44" y="34" width="18" height="82"/><rect x="86" y="34" width="18" height="82"/><rect x="128" y="34" width="18" height="82"/><rect x="170" y="34" width="18" height="82"/></g>
    <rect x="30" y="116" width="180" height="10" fill="#d9c9a3"/>
  </svg>`,
};

// Kısa yardımcı: resimli soru nesnesi
const imgQ = (image, q, options, answer, category) => ({ q, options, answer, image, category, isImage: true });

// ---------------------------------------------------------------------------
// Kampanya — bölümler (patika). Her bölüm: anlatı + kategori + resimli sorular.
// Metin soruları çalışma anında ilgili kategori bankasından çekilir; resimli
// sorular buradaki authored setten eklenir.
// ---------------------------------------------------------------------------
export const CAMPAIGN = {
  id: "bilgelik-yolculugu",
  title: "Bilgelik Yolculuğu",
  subtitle: "Bilgini kuşan, diyar diyar gez, kaleye ulaş.",
  stages: [
    {
      key: "koy", name: "Başlangıç Köyü", emoji: "🏡", scene: SCENES.koy, category: "genel",
      qCount: 4, passRatio: 0.5,
      intro: "Yolculuğun sabah sisiyle başlıyor. Küçük köyün meydanında yaşlı bir bilge seni durdurur: “Bilgeliğe giden yol buradan geçer. Hazır mısın, gezgin?”",
      outro: "Köylüler bilgeliğine hayran kaldı! Sana yol azığı ve bir harita verdiler. Patika ormana doğru uzanıyor…",
      images: [
        imgQ(IMG.flagTR, "Yandaki bayrak hangi ülkeye aittir?", ["Türkiye", "Tunus", "Japonya", "Çin"], 0, "genel"),
        imgQ(IMG.clock3, "Yandaki saat kaçı gösteriyor?", ["12:00", "3:00", "6:15", "9:30"], 1, "genel"),
      ],
    },
    {
      key: "orman", name: "Fısıltılı Orman", emoji: "🌲", scene: SCENES.orman, category: "bilim",
      qCount: 4, passRatio: 0.5,
      intro: "Ağaçların arasından geçerken yapraklar sana bilmeceler fısıldar. Ormanın kalbine ulaşmak için doğanın dilini çözmelisin.",
      outro: "Orman yol verdi! Bir baykuş omzuna kondu ve seni dağların eteğine kadar uğurladı.",
      images: [
        imgQ(IMG.hexagon, "Yandaki şeklin kaç kenarı vardır?", ["5", "6", "7", "8"], 1, "bilim"),
        imgQ(IMG.colorMix, "Kırmızı ile mavi karışınca hangi renk oluşur?", ["Yeşil", "Turuncu", "Mor", "Kahverengi"], 2, "bilim"),
      ],
    },
    {
      key: "dag", name: "Sisli Dağlar", emoji: "🏔️", scene: SCENES.dag, category: "cografya",
      qCount: 4, passRatio: 0.5,
      intro: "Rüzgâr sert, sis yoğun. Zirveye tırmanmak için yön bulma ve coğrafya bilgin sınanacak.",
      outro: "Zirveye ulaştın! Aşağıda antik bir şehrin kalıntıları belirdi. Tarih seni çağırıyor…",
      images: [
        imgQ(IMG.mountains, "Grafikte/görselde en yüksek dağ hangisidir?", ["Soldaki", "Ortadaki", "Sağdaki", "Hepsi eşit"], 1, "cografya"),
        imgQ(IMG.barChart, "Sütun grafiğinde en yüksek değer hangisidir?", ["A", "B", "C", "D"], 2, "cografya"),
      ],
    },
    {
      key: "antik", name: "Antik Şehir", emoji: "🏛️", scene: SCENES.antik, category: "tarih",
      qCount: 4, passRatio: 0.5,
      intro: "Mermer sütunların gölgesinde geçmişin sırları yatıyor. Şehrin kapısını ancak tarih bilgisiyle açabilirsin.",
      outro: "Antik kapı gıcırdayarak açıldı! Yolun renkli bir kasabaya çıkıyor.",
      images: [
        imgQ(IMG.romanColumns, "Görseldeki yapıda kaç sütun vardır?", ["3", "4", "5", "6"], 1, "tarih"),
        imgQ(IMG.triangle, "Yandaki şekil hangisidir?", ["Kare", "Üçgen", "Daire", "Beşgen"], 1, "genel"),
      ],
    },
    {
      key: "kasaba", name: "Renkli Kasaba", emoji: "🎨", scene: SCENES.kasaba, category: "sanat",
      qCount: 4, passRatio: 0.5,
      intro: "Kasabanın rengârenk evleri arasında sanat ve kültür kokusu var. Sokak sokak gez, ustaların sorularını yanıtla.",
      outro: "Kasaba halkı seni bir şölenle uğurladı! Tepede son durak görünüyor: Bilgelik Kalesi.",
      images: [
        imgQ(IMG.colorMix, "Ressamın paletinde kırmızı + mavi = ?", ["Mor", "Yeşil", "Gri", "Sarı"], 0, "sanat"),
      ],
    },
    {
      key: "kale", name: "Bilgelik Kalesi", emoji: "🏰", scene: SCENES.kale, category: "hepsi",
      qCount: 5, passRatio: 0.6, final: true,
      intro: "İşte son durak: Bilgelik Kalesi. Kapıdaki muhafız gülümser: “Buraya kadar geldin gezgin. Şimdi tüm öğrendiklerini göster.”",
      outro: "Kale kapıları ardına dek açıldı! Bilgelik Yolculuğu’nu tamamladın. Adın gezginler arasında efsane oldu. 🏆",
      images: [
        imgQ(IMG.flagTR, "Bu bayrak hangi ülkenindir?", ["Türkiye", "KKTC", "Tunus", "Azerbaycan"], 0, "genel"),
        imgQ(IMG.hexagon, "Bu çokgenin adı nedir?", ["Beşgen", "Altıgen", "Yedigen", "Sekizgen"], 1, "bilim"),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// İlerleme kaydı (localStorage): { cleared: en yüksek geçilen bölüm indeksi (-1 yok),
//   stars: { stageKey: 1..3 } }
// ---------------------------------------------------------------------------
const KEY = "bnb_campaign";
export function loadCampaignProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && typeof p.cleared === "number") return { cleared: p.cleared, stars: p.stars || {} };
  } catch (e) {}
  return { cleared: -1, stars: {} };
}
export function saveCampaignProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify({ cleared: p.cleared, stars: p.stars || {} })); } catch (e) {}
}
// Doğruluk oranından yıldız (1..3)
export function starsFor(ratio) { return ratio >= 0.95 ? 3 : ratio >= 0.7 ? 2 : 1; }
