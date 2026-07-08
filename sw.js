// Service worker — uygulama kabuğunu önbelleğe alır (hızlı açılış + çevrimdışı kabuk).
// Oyun gerçek zamanlı olduğu için ağ önceliklidir; önbellek yalnızca yedek olarak kullanılır.
const VERSION = "bnb-v1";
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/net.js",
  "./js/questions.js",
  "./js/profile.js",
  "./js/achievements.js",
  "./js/daily.js",
  "./js/characters.js",
  "./js/sound.js",
  "./js/confetti.js",
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
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Ağ öncelikli, düşerse önbellek: her zaman en güncel kod, çevrimdışıysa kabuk yine açılır.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit || (e.request.mode === "navigate" ? caches.match("./index.html") : undefined))
      )
  );
});
