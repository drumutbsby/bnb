// Gerçek zamanlı katman — kurulum GEREKTİRMEZ.
// Herkese açık ücretsiz bir MQTT-over-WebSocket broker'ı kullanır; hesap/anahtar yok.
// Model: HOST yetkilidir. Oda durumunu tek bir "state" konusuna (retained) yayınlar;
// oyuncular yalnızca "input" konusuna (katıl / cevap) mesaj gönderir.
import mqtt from "./vendor/mqtt.esm.js";

// İstersen burayı kendi broker'ınla değiştirebilirsin (wss zorunlu, HTTPS sayfası için).
export const BROKER_URL = "wss://broker.emqx.io:8084/mqtt";
const PREFIX = "benbildim/v1";

export const isConfigured = true; // her zaman hazır, kurulum yok

let client = null;
const handlers = {}; // topic -> Set(handler)

function newId() {
  return "bb_" + Math.random().toString(16).slice(2) + Date.now().toString(36);
}

export function connect() {
  if (client) return client;
  client = mqtt.connect(BROKER_URL, {
    clientId: newId(),
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 8000,
    keepalive: 30,
  });
  client.on("message", (topic, payload) => {
    const raw = payload ? payload.toString() : "";
    let data = null;
    if (raw !== "") { try { data = JSON.parse(raw); } catch { data = null; } }
    const set = handlers[topic];
    if (set) for (const h of [...set]) h(data, raw);
  });
  return client;
}

export function whenConnected(timeoutMs = 10000) {
  const c = connect();
  return new Promise((resolve, reject) => {
    if (c.connected) return resolve();
    let done = false;
    const t = setTimeout(() => {
      if (done) return; done = true;
      reject(new Error("Sunucuya bağlanılamadı (ağ/broker erişimi)."));
    }, timeoutMs);
    c.once("connect", () => { if (done) return; done = true; clearTimeout(t); resolve(); });
  });
}

export function connectionState() {
  return client && client.connected ? "connected" : "connecting";
}
export function onStatus(cb) {
  const c = connect();
  c.on("connect", () => cb("connected"));
  c.on("reconnect", () => cb("connecting"));
  c.on("offline", () => cb("offline"));
  c.on("error", () => cb("error"));
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
