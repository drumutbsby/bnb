// Gerçek zamanlı katman — kurulum GEREKTİRMEZ.
// Herkese açık ücretsiz MQTT-over-WebSocket broker'ları kullanır; hesap/anahtar yok.
// Model: HOST yetkilidir. Oda durumunu tek bir "state" konusuna (retained) yayınlar;
// oyuncular yalnızca "input" konusuna (katıl / cevap) mesaj gönderir.
//
// Bağlantı stratejisi:
//  1) TÜM brokerlara aynı anda bağlanılır (paralel yarış) — tek tek denemekten
//     çok daha hızlı ve tek broker'ın çökmesine/engellenmesine dayanıklı.
//  2) Kısa bir öncelik penceresi içinde bağlananlardan EN DÜŞÜK indeksli olan
//     seçilir; herkes aynı sırayı tercih ettiğinden cihazlar ortak broker'da buluşur.
//  3) Davet linki/QR host'un broker'ını taşır (?b=N) → katılan doğrudan oraya bağlanır.
//  4) Kod elle girildiyse oda TÜM brokerlarda aranır (findRoom) ve bulunan broker'a geçilir.
import mqtt from "./vendor/mqtt.esm.js";

// Sıralı tercih listesi (hepsi wss; HTTPS sayfası için zorunlu).
// mqtt.eclipseprojects.io 443 portunu kullanır: 8084/8884 gibi portları engelleyen
// kısıtlı ağlarda (okul/iş/otel/bazı mobil operatörler) çoğu zaman tek çalışan yoldur.
export const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://mqtt.eclipseprojects.io:443/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];
export const BROKER_URL = BROKERS[0]; // geriye dönük uyumluluk
const PREFIX = "benbildim/v1";

export const isConfigured = true; // her zaman hazır, kurulum yok

let client = null;      // seçilen (kazanan) istemci
let activeIdx = -1;     // seçilen broker indeksi (geçiş sırasında hedef indeks)
let pinnedIdx = null;   // deep-link/oturum ile sabitlenen broker
let raceCands = null;   // yarış sürüyorsa: index -> aday istemci
let graceTimer = null;
const pendingPubs = []; // bağlantı kurulmadan önce istenen publish'ler
const handlers = {};    // topic -> Set(handler)
const statusCbs = new Set();

const GRACE_MS = 1200;  // ilk bağlanandan sonra daha öncelikli broker'ı bekleme süresi

function newId() {
  return "bb_" + Math.random().toString(16).slice(2) + Date.now().toString(36);
}

function emitStatus(s) {
  for (const cb of [...statusCbs]) { try { cb(s); } catch { /* yut */ } }
}

function mkClient(url) {
  return mqtt.connect(url, {
    clientId: newId(),
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 8000,
    keepalive: 30,
  });
}

// Gelen mesajı abone olan tüm handler'lara dağıt
function dispatch(topic, payload) {
  const raw = payload ? payload.toString() : "";
  let data = null;
  if (raw !== "") { try { data = JSON.parse(raw); } catch { data = null; } }
  for (const filter in handlers) {
    if (filter === topic || topicMatch(filter, topic)) {
      for (const h of [...handlers[filter]]) h(data, raw, topic);
    }
  }
}

function ensureNet() {
  if (client || raceCands) return;
  startRace(pinnedIdx != null ? [pinnedIdx] : BROKERS.map((_, i) => i));
}

function startRace(indices) {
  raceCands = {};
  const best = Math.min(...indices);
  const up = new Set(); // bağlanmayı başaran aday indeksleri
  for (const i of indices) {
    const c = mkClient(BROKERS[i]);
    raceCands[i] = c;
    c.on("error", () => { /* kaybedenler sessizce kendi kendine yeniden dener */ });
    c.on("connect", () => {
      if (client === c) return; // seçilen istemcinin yeniden bağlanması — yarışla ilgisi yok
      if (!raceCands || raceCands[i] !== c) { try { c.end(true); } catch { /* yut */ } return; }
      up.add(i);
      if (i === best) pick(i); // en öncelikli broker bağlandı → hemen seç
      else if (!graceTimer) graceTimer = setTimeout(() => pick(Math.min(...up)), GRACE_MS);
    });
  }
  // Hiçbiri bağlanamazsa adaylar reconnectPeriod ile sonsuza dek dener;
  // ilk bağlanan kazanır — kalıcı bir "pes etme" durumu yoktur.
}

function pick(i) {
  if (!raceCands) return;
  clearTimeout(graceTimer); graceTimer = null;
  const c = raceCands[i];
  for (const k in raceCands) {
    if (+k !== i) { try { raceCands[k].end(true); } catch { /* yut */ } }
  }
  raceCands = null;
  adopt(i, c);
}

function adopt(i, c) {
  client = c; activeIdx = i;
  c.on("message", dispatch);
  c.on("reconnect", () => emitStatus("connecting"));
  c.on("offline", () => emitStatus("offline"));
  c.on("close", () => { if (client === c) emitStatus("offline"); });
  c.on("error", () => { if (client === c) emitStatus("error"); });
  // Yeniden bağlanınca da abonelikleri ve bekleyen mesajları tazele
  c.on("connect", () => { if (client === c) { resync(); emitStatus("connected"); } });
  resync();
  emitStatus("connected");
}

// Aktif istemcide tüm abonelikleri kur ve bekleyen publish'leri gönder
function resync() {
  if (!client) return;
  for (const topic in handlers) client.subscribe(topic, { qos: 0 });
  while (pendingPubs.length) {
    const [t, m, o] = pendingPubs.shift();
    client.publish(t, m, o);
  }
}

// Belirli bir broker'a geç (oda başka broker'da bulunduğunda)
function switchTo(i) {
  const old = client;
  client = null; activeIdx = i; // hedef indeks; adopt tamamlayınca kesinleşir
  if (old) { old.removeListener("message", dispatch); try { old.end(true); } catch { /* yut */ } }
  emitStatus("connecting");
  startRace([i]);
}

// Broker'ı sabitle: davet linkindeki ?b=N ya da kayıtlı oturumdan gelir.
// Katılan, host ile AYNI broker'a bağlanır — farklı ağlarda farklı broker'a
// düşüp buluşamama sorununu önler.
export function pinBroker(i) {
  if (!Number.isInteger(i) || i < 0 || i >= BROKERS.length) return;
  pinnedIdx = i;
  if (client) {
    if (activeIdx !== i) switchTo(i);
  } else if (raceCands) {
    for (const k in raceCands) { try { raceCands[k].end(true); } catch { /* yut */ } }
    raceCands = null; clearTimeout(graceTimer); graceTimer = null;
    startRace([i]);
  }
  // henüz hiç bağlantı yoksa: ilk ensureNet çağrısı sabitlenen broker ile başlar
}

export function activeBrokerIndex() {
  return activeIdx >= 0 ? activeIdx : 0;
}

export function connect() { // geriye dönük uyumluluk
  ensureNet();
  return client;
}

// MQTT joker karakter eşleşmesi (+ tek seviye, # kalan tümü)
function topicMatch(filter, topic) {
  if (filter.indexOf("+") < 0 && filter.indexOf("#") < 0) return false;
  const f = filter.split("/"), t = topic.split("/");
  for (let i = 0; i < f.length; i++) {
    if (f[i] === "#") return true;
    if (f[i] === "+") { if (t[i] === undefined) return false; continue; }
    if (f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}

export function whenConnected(timeoutMs = 15000) {
  ensureNet();
  return new Promise((resolve, reject) => {
    if (client && client.connected) return resolve();
    let done = false;
    const fin = (f) => { if (done) return; done = true; clearTimeout(t); statusCbs.delete(onS); f(); };
    const onS = (s) => { if (s === "connected") fin(resolve); };
    statusCbs.add(onS);
    const t = setTimeout(() => fin(() => reject(new Error(
      "Sunucuya bağlanılamadı. İnternet bağlantını kontrol et; okul/iş/otel Wi-Fi'ındaysan mobil veriyle dene."
    ))), timeoutMs);
  });
}

export function connectionState() {
  return client && client.connected ? "connected" : "connecting";
}
export function onStatus(cb) {
  statusCbs.add(cb);
  return () => statusCbs.delete(cb);
}

function pub(topic, msg, opts) {
  ensureNet();
  if (client && client.connected) client.publish(topic, msg, opts);
  else pendingPubs.push([topic, msg, opts]); // bağlanınca resync gönderir
}

function sub(topic, handler) {
  ensureNet();
  if (!handlers[topic]) {
    handlers[topic] = new Set();
    if (client) client.subscribe(topic, { qos: 0 });
  }
  handlers[topic].add(handler);
  return () => {
    const set = handlers[topic];
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) { delete handlers[topic]; if (client) client.unsubscribe(topic); }
  };
}

// --- Konu (topic) adları ---
const stateTopic = (code) => `${PREFIX}/${code}/state`;
const inputTopic = (code) => `${PREFIX}/${code}/in`;

// --- Oda arama: retained state'i TÜM brokerlarda paralel ara ---
// Aktif broker'da varsa anında döner (mevcut bağlantı üzerinden, en hızlı yol).
// Başka broker'da bulunursa oraya otomatik geçilir; bulunamazsa null döner.
function probeBroker(i, topic, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    if (i === activeIdx && client) {
      const unsub = sub(topic, (data) => {
        if (done) return; done = true; unsub(); resolve(data ? { i, data } : null);
      });
      setTimeout(() => { if (!done) { done = true; unsub(); resolve(null); } }, timeoutMs);
      return;
    }
    const c = mkClient(BROKERS[i]);
    const finish = (v) => { if (done) return; done = true; try { c.end(true); } catch { /* yut */ } resolve(v); };
    c.on("error", () => { /* yut — zaman aşımı null döndürür */ });
    c.on("connect", () => c.subscribe(topic, { qos: 0 }));
    c.on("message", (t, payload) => {
      if (t !== topic) return;
      const raw = payload ? payload.toString() : "";
      let data = null;
      if (raw !== "") { try { data = JSON.parse(raw); } catch { data = null; } }
      if (data) finish({ i, data });
    });
    setTimeout(() => finish(null), timeoutMs);
  });
}

export function findRoom(code, timeoutMs = 4000) {
  ensureNet();
  const topic = stateTopic(code);
  return new Promise((resolve) => {
    let done = false, pending = BROKERS.length;
    BROKERS.forEach((_, i) => {
      probeBroker(i, topic, timeoutMs).then((r) => {
        pending--;
        if (done) return;
        if (r && r.data) {
          done = true;
          if (r.i !== activeIdx) pinBroker(r.i); // odanın olduğu broker'a geç
          resolve(r.data);
        } else if (pending === 0) { done = true; resolve(null); }
      });
    });
  });
}

// --- Host API ---
export function publishState(code, state) {
  pub(stateTopic(code), JSON.stringify(state), { retain: true, qos: 0 });
}
export function clearState(code) {
  // boş retained mesaj = retained temizle (odayı kapat)
  pub(stateTopic(code), "", { retain: true, qos: 0 });
}
export function subscribeInput(code, cb) { return sub(inputTopic(code), cb); }

// --- Oyuncu API ---
export function sendInput(code, msg) {
  pub(inputTopic(code), JSON.stringify(msg), { qos: 0 });
}
export function subscribeState(code, cb) { return sub(stateTopic(code), cb); }

// Hızlı eşleşme: açık odaları keşfet (tüm state konularını dinle)
export function subscribeRooms(cb) {
  return sub(`${PREFIX}/+/state`, (data, raw, topic) => {
    const parts = (topic || "").split("/");
    const code = parts[parts.length - 2];
    cb(code, data);
  });
}

// --- Global "Şöhret Salonu" (Hall of Fame) — en iyi çaba, retained ---
const hofTopic = (id) => `${PREFIX}/hof/${id}`;
export function publishHof(id, entry) {
  pub(hofTopic(id), JSON.stringify(entry), { retain: true, qos: 0 });
}
// hof/# altındaki tüm retained girdileri toplar; her mesaj için cb(entry, id)
export function subscribeHof(cb) {
  return sub(`${PREFIX}/hof/#`, (data, raw, topic) => {
    const id = (topic || "").split("/").pop();
    if (data) cb(data, id);
  });
}

// --- Haftalık lig (en iyi çaba, retained; hafta anahtarı app tarafından verilir) ---
export function publishLeague(week, id, entry) {
  pub(`${PREFIX}/league/${week}/${id}`, JSON.stringify(entry), { retain: true, qos: 0 });
}
export function subscribeLeague(week, cb) {
  return sub(`${PREFIX}/league/${week}/#`, (data, raw, topic) => {
    const id = (topic || "").split("/").pop();
    if (data) cb(data, id);
  });
}
