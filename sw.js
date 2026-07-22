// Service worker — uygulama kabuğunu önbelleğe alır (hızlı açılış + çevrimdışı kabuk).
// Oyun gerçek zamanlı olduğu için ağ önceliklidir; önbellek yalnızca yedek olarak kullanılır.
const VERSION = "bnb-v12";
// Bayrak/Twemoji görselleri (js/visuals.js): değişmez içerik, ayrı kalıcı önbellek
const IMG_CACHE = "bnb-img-v1";
const IMG_HOSTS = ["flagcdn.com", "cdn.jsdelivr.net"];
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/net.js",
  "./js/visuals.js",
  "./js/racepath.js",
  "./js/questions.js",
  "./js/profile.js",
  "./js/achievements.js",
  "./js/daily.js",
  "./js/characters.js",
  "./js/sound.js",
  "./js/confetti.js",
  "./js/campaign.js",
  "./js/reactions.js",
  "./js/share.js",
  // Soru shard'ları: çevrimdışı solo/macera için tümü önden önbelleğe alınır (~1 MB)
  "./js/questions/genel.js",
  "./js/questions/tarih.js",
  "./js/questions/cografya.js",
  "./js/questions/bilim.js",
  "./js/questions/spor.js",
  "./js/questions/sanat.js",
  "./js/questions/sinema.js",
  "./js/questions/teknoloji.js",
  "./js/questions/turkiye.js",
  "./js/questions/hayvanlar.js",
  "./js/questions/bayrak.js",
  "./js/questions/emoji.js",
  "./js/vendor/mqtt.esm.js",
  "./js/vendor/qrcode.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Bayrak/emoji görselleri: önbellek öncelikli (değişmezler) — bir kez
  // görülen bayrak çevrimdışı da çalışır.
  if (IMG_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(IMG_CACHE).then((c) =>
        c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
          if (res && (res.ok || res.type === "opaque")) c.put(e.request, res.clone()).catch(() => {});
          return res;
        }))
      )
    );
    return;
  }
  if (url.origin !== location.origin) return;
  // Ağ öncelikli, düşerse önbellek: her zaman en güncel kod, çevrimdışıysa kabuk yine açılır.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Yalnızca başarılı, aynı-köken (basic) yanıtları önbelleğe al —
        // 404/500 gibi hatalı yanıtlar çevrimdışı için saklanmasın.
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit || (e.request.mode === "navigate" ? caches.match("./index.html") : undefined))
      )
  );
});
