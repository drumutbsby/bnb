// Gerçek zamanlı katman — kurulum GEREKTİRMEZ.
// Herkese açık ücretsiz MQTT-over-WebSocket broker'ları kullanır; hesap/anahtar yok.
// Model: HOST yetkilidir. Oda durumunu tek bir "state" konusuna (retained) yayınlar;
// oyuncular yalnızca "input" konusuna (katıl / cevap) mesaj gönderir.
import mqtt from "./vendor/mqtt.esm.js";

// Sıralı yedekli (failover) broker listesi — hepsi wss (HTTPS sayfası için zorunlu).
// Bir broker erişilemezse otomatik olarak bir sonrakine geçilir. TÜM istemciler
// aynı sırayı denediğinden, ulaşılabilen ilk broker'da buluşurlar; böylece host ve
// oyuncular deterministik biçimde aynı broker'a bağlanır. İstersen kendi broker'ını
// listenin başına ekleyebilirsin.
export const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];
export const BROKER_URL = BROKERS[0]; // geriye dönük uyumluluk
const PREFIX = "benbildim/v1";

export const isConfigured = true; // her zaman hazır, kurulum yok

let client = null;
let brokerIndex = 0;
let everConnected = false; // herhangi bir broker'a en az bir kez bağlanıldı mı
let failoverDone = false;  // tüm brokerlar bir tur denendi mi (sonsuz döngüyü önler)
const handlers = {};       // topic -> Set(handler)
const statusCbs = new Set();

function newId() {
  return "bb_" + Math.random().toString(16).slice(2) + Date.now().toString(36);
}

function emitStatus(s) {
  for (const cb of [...statusCbs]) { try { cb(s); } catch { /* yut */ } }
}

// Belirtilen indeksteki broker için yeni bir istemci oluşturur ve olayları bağlar.
function spawnClient(index) {
  brokerIndex = index % BROKERS.length;
  const url = BROKERS[brokerIndex];
  const c = mqtt.connect(url, {
    clientId: newId(),
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 8000,
    keepalive: 30,
  });
  let advanced = false;

  const goNext = () => {
    if (advanced || everConnected || failoverDone) return;
    advanced = true;
    tryNext(c);
  };

  // İlk bağlantı bu broker'da makul sürede kurulamazsa bir sonrakine geç.
  const failTimer = (everConnected || failoverDone) ? null : setTimeout(goNext, 6000);

  c.on("connect", () => {
    everConnected = true;
    if (failTimer) clearTimeout(failTimer);
    // Yeni istemcide (failover sonrası) mevcut abonelikleri yeniden kur.
    for (const topic in handlers) c.subscribe(topic, { qos: 0 });
    emitStatus("connected");
  });
  c.on("reconnect", () => emitStatus("connecting"));
  c.on("offline", () => emitStatus("offline"));
  c.on("error", () => { emitStatus("error"); if (failTimer) clearTimeout(failTimer); goNext(); });
  c.on("close", () => { if (!everConnected) goNext(); });

  c.on("message", (topic, payload) => {
    const raw = payload ? payload.toString() : "";
    let data = null;
    if (raw !== "") { try { data = JSON.parse(raw); } catch { data = null; } }
    for (const filter in handlers) {
      if (filter === topic || topicMatch(filter, topic)) {
        for (const h of [...handlers[filter]]) h(data, raw, topic);
      }
    }
  });
  return c;
}

// Bir sonraki broker'a geç; tüm brokerlar denendiyse ilkine dönüp
// yeniden bağlanmayı mqtt.js'in kendi mekanizmasına bırak.
function tryNext(oldClient) {
  try { oldClient.end(true); } catch { /* yut */ }
  const next = brokerIndex + 1;
  if (next >= BROKERS.length) {
    failoverDone = true; // artık istemci değiştirmeyi bırak, native reconnect devralsın
    client = spawnClient(0);
  } else {
    client = spawnClient(next);
  }
}

export function connect() {
  if (client) return client;
  client = spawnClient(0);
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

export function whenConnected(timeoutMs = 18000) {
  const c = connect();
  return new Promise((resolve, reject) => {
    if (c.connected) return resolve();
    let done = false;
    const finish = (fn) => { if (done) return; done = true; clearTimeout(t); statusCbs.delete(onConn); fn(); };
    const onConn = (s) => { if (s === "connected") finish(resolve); };
    statusCbs.add(onConn);
    const t = setTimeout(() => finish(() => reject(new Error("Sunucuya bağlanılamadı (ağ/broker erişimi)."))), timeoutMs);
  });
}

export function connectionState() {
  return client && client.connected ? "connected" : "connecting";
}
export function onStatus(cb) {
  statusCbs.add(cb);
  connect();
  cb(client && client.connected ? "connected" : "connecting");
  return () => statusCbs.delete(cb);
}

function sub(topic, handler) {
  const c = connect();
  if (!handlers[topic]) { handlers[topic] = new Set(); c.subscribe(topic, { qos: 0 }); }
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

// --- Host API ---
export function publishState(code, state) {
  connect().publish(stateTopic(code), JSON.stringify(state), { retain: true, qos: 0 });
}
export function clearState(code) {
  // boş retained mesaj = retained temizle (odayı kapat)
  connect().publish(stateTopic(code), "", { retain: true, qos: 0 });
}
export function subscribeInput(code, cb) { return sub(inputTopic(code), cb); }

// --- Oyuncu API ---
export function sendInput(code, msg) {
  connect().publish(inputTopic(code), JSON.stringify(msg), { qos: 0 });
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
  connect().publish(hofTopic(id), JSON.stringify(entry), { retain: true, qos: 0 });
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
  connect().publish(`${PREFIX}/league/${week}/${id}`, JSON.stringify(entry), { retain: true, qos: 0 });
}
export function subscribeLeague(week, cb) {
  return sub(`${PREFIX}/league/${week}/#`, (data, raw, topic) => {
    const id = (topic || "").split("/").pop();
    if (data) cb(data, id);
  });
}
