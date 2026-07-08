// Ben Bildim — çok oyunculu bilgi yarışması (Kahoot tarzı)
// Gerçek zamanlı katman: kurulum gerektirmeyen MQTT (js/net.js).
// Model: HOST yetkilidir; oda durumunu yayınlar. Oyuncular yalnızca girdi gönderir.
import {
  isConfigured, whenConnected, subscribeInput, subscribeState,
  publishState, clearState, sendInput,
} from "./net.js";
import { CATEGORIES, CUSTOM_CATEGORY, QUESTIONS, buildQuestionSet } from "./questions.js";
import { unlock, sfx, isMuted, toggleMute } from "./sound.js";
import { confetti } from "./confetti.js";
import qrcode from "./vendor/qrcode.js";

const APP = document.getElementById("app");

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------
const COUNTDOWN_MS = 3000; // 3-2-1 geri sayımı
const DIFFICULTY = {
  kolay: { name: "Kolay", time: 30, factor: 0.8, emoji: "🟢", sub: "30 sn" },
  normal: { name: "Normal", time: 20, factor: 1.0, emoji: "🟡", sub: "20 sn" },
  zor: { name: "Zor", time: 12, factor: 1.3, emoji: "🔴", sub: "12 sn" },
};
const START_JOKERS = { fifty: 1, double: 1 };
const CUSTOM_KEY = "bnb_custom";

// ---------------------------------------------------------------------------
// Durum (state)
// ---------------------------------------------------------------------------
const state = {
  role: null, code: null, playerId: null, name: null,
  room: null, localQuestions: null,
  hostLocalStart: 0, playerLocalStart: 0,
  answeredIndex: -1, playerChoice: null, revealingIndex: -1,
  autoRevealTimer: null, stateUnsub: null, inputUnsub: null,
  currentView: null, lastRenderKey: null,
  inCountdown: false, cdToken: 0,
  setupDifficulty: "normal",
};

const OPTION_STYLES = [
  { color: "#e21b3c", shape: "▲" },
  { color: "#1368ce", shape: "◆" },
  { color: "#d89e00", shape: "●" },
  { color: "#26890c", shape: "■" },
];

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------
function genCode() {
  const chars = "ABCDEFGHJKLMNPRSTUVYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function uid() {
  return "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
function saveSession() {
  try {
    sessionStorage.setItem("bnb_session", JSON.stringify({
      role: state.role, code: state.code, playerId: state.playerId,
      name: state.name, localQuestions: state.localQuestions,
    }));
  } catch (e) {}
}
function clearSession() { try { sessionStorage.removeItem("bnb_session"); } catch (e) {} }
function loadSession() {
  try { return JSON.parse(sessionStorage.getItem("bnb_session")); } catch (e) { return null; }
}
function loadCustom() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || []; } catch (e) { return []; }
}
function saveCustom(list) {
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch (e) {}
}

// Yayınlanan oda durumu (cevaplar hariç)
function hostPublish() {
  const r = state.room;
  publishState(state.code, {
    meta: r.meta,
    players: r.players || {},
    publicQuestions: r.publicQuestions || {},
    reveal: r.reveal || {},
    fifty: r.fifty || {},
    doubles: r.doubles || {},
  });
}

function getStateOnce(code, timeoutMs = 3500) {
  return new Promise((resolve) => {
    let done = false;
    const unsub = subscribeState(code, (data) => {
      if (done) return; done = true; unsub(); resolve(data);
    });
    setTimeout(() => { if (!done) { done = true; unsub(); resolve(null); } }, timeoutMs);
  });
}

// ---------------------------------------------------------------------------
// HOST mantığı
// ---------------------------------------------------------------------------
async function createRoom(categories, count, difficultyKey, hostName) {
  state.role = "host";
  state.name = hostName;
  state.playerId = "host";
  await whenConnected();

  let code = genCode();
  for (let t = 0; t < 4; t++) {
    const existing = await getStateOnce(code, 900);
    if (!existing) break;
    code = genCode();
  }
  state.code = code;

  const diff = DIFFICULTY[difficultyKey] || DIFFICULTY.normal;
  const custom = categories.includes("ozel") ? loadCustom() : null;
  const qset = buildQuestionSet(categories, count, custom);
  state.localQuestions = qset;
  state.room = {
    meta: {
      hostName, status: "lobby", questionIndex: -1,
      totalQuestions: qset.length, timeLimit: diff.time,
      pointFactor: diff.factor, difficulty: difficultyKey,
      categories: categories && categories.length ? categories : ["hepsi"],
    },
    players: {}, publicQuestions: {}, reveal: {}, answers: {}, fifty: {}, doubles: {},
  };

  state.inputUnsub = subscribeInput(code, hostOnInput);
  hostPublish();
  saveSession();
  render();
}

function hostOnInput(msg) {
  if (!msg || !state.room || state.role !== "host") return;
  const room = state.room;
  if (msg.type === "join") {
    if (room.meta.status !== "lobby") return;
    if (!msg.pid || !msg.name) return;
    if (!room.players[msg.pid]) {
      room.players[msg.pid] = {
        name: String(msg.name).slice(0, 16), score: 0, streak: 0,
        lastGain: 0, lastCorrect: false, lastStreak: 0,
        jokers: { ...START_JOKERS },
      };
      sfx.join();
      hostPublish();
      render();
    }
  } else if (msg.type === "answer") {
    const i = msg.i;
    if (room.meta.status !== "question" || i !== room.meta.questionIndex) return;
    if (!room.players[msg.pid]) return;
    if (!room.answers) room.answers = {};
    if (!room.answers[i]) room.answers[i] = {};
    if (room.answers[i][msg.pid]) return;
    room.answers[i][msg.pid] = { choice: msg.choice, elapsed: Math.max(0, Number(msg.elapsed) || 0) };
    render();
    const total = Object.keys(room.players).length;
    const answered = Object.keys(room.answers[i]).length;
    if (total > 0 && answered >= total) maybeReveal(i);
  } else if (msg.type === "joker") {
    const i = msg.i;
    if (room.meta.status !== "question" || i !== room.meta.questionIndex) return;
    const p = room.players[msg.pid];
    if (!p) return;
    // Zaten cevaplamışsa joker kullanamaz
    if (room.answers && room.answers[i] && room.answers[i][msg.pid]) return;
    if (msg.kind === "double" && p.jokers && p.jokers.double > 0) {
      p.jokers.double = 0;
      if (!room.doubles[i]) room.doubles[i] = {};
      room.doubles[i][msg.pid] = true;
      hostPublish();
    } else if (msg.kind === "fifty" && p.jokers && p.jokers.fifty > 0) {
      p.jokers.fifty = 0;
      const correct = state.localQuestions[i].answer;
      const wrong = [0, 1, 2, 3].filter((x) => x !== correct);
      // İki yanlışı gizle (bir yanlış + doğru kalsın)
      for (let s = wrong.length - 1; s > 0; s--) {
        const j = Math.floor(Math.random() * (s + 1));
        [wrong[s], wrong[j]] = [wrong[j], wrong[s]];
      }
      const hide = wrong.slice(0, 2);
      if (!room.fifty[i]) room.fifty[i] = {};
      room.fifty[i][msg.pid] = hide;
      hostPublish();
    }
  }
}

function hostStartGame() {
  if (!state.room || Object.keys(state.room.players || {}).length === 0) {
    alert("En az bir oyuncunun katılması gerekiyor.");
    return;
  }
  hostShowQuestion(0);
}

function hostShowQuestion(i) {
  const q = state.localQuestions[i];
  state.revealingIndex = -1;
  clearTimeout(state.autoRevealTimer);

  if (!state.room.answers) state.room.answers = {};
  state.room.answers[i] = {};
  state.room.publicQuestions[i] = { q: q.q, options: q.options, category: q.category, visual: q.visual || null };
  state.room.meta.questionIndex = i;
  state.room.meta.status = "question";
  hostPublish();
  render();

  const limit = state.room.meta.timeLimit || 20;
  // Geri sayım süresi dahil otomatik reveal zamanlaması
  state.autoRevealTimer = setTimeout(() => maybeReveal(i), COUNTDOWN_MS + limit * 1000 + 800);
}

function maybeReveal(i) {
  if (state.revealingIndex === i) return;
  if (!state.room || state.room.meta.status !== "question" || state.room.meta.questionIndex !== i) return;
  if (state.inCountdown) return; // geri sayım bitmeden reveal yok
  state.revealingIndex = i;
  clearTimeout(state.autoRevealTimer);
  hostRevealQuestion(i);
}

function hostRevealQuestion(i) {
  const room = state.room;
  const q = state.localQuestions[i];
  const correct = q.answer;
  const timeLimit = room.meta.timeLimit || 20;
  const factor = room.meta.pointFactor || 1;
  const answers = (room.answers && room.answers[i]) || {};
  const doubles = (room.doubles && room.doubles[i]) || {};
  const players = room.players || {};
  const counts = [0, 0, 0, 0];

  for (const pid in players) {
    const a = answers[pid];
    const p = players[pid];
    let gained = 0, base = 0, streakBonus = 0, doubled = false;
    const isCorrect = a && a.choice === correct;
    if (a && typeof a.choice === "number" && counts[a.choice] !== undefined) counts[a.choice]++;
    if (isCorrect) {
      const frac = Math.min(1, a.elapsed / (timeLimit * 1000));
      base = Math.round((500 + Math.round(500 * (1 - frac))) * factor);
      p.streak = (p.streak || 0) + 1;
      streakBonus = p.streak >= 2 ? Math.min(p.streak - 1, 5) * 100 : 0;
      gained = base + streakBonus;
      if (doubles[pid]) { gained *= 2; doubled = true; }
    } else {
      p.streak = 0;
    }
    p.score = (p.score || 0) + gained;
    p.lastGain = gained;
    p.lastBase = base;
    p.lastStreakBonus = streakBonus;
    p.lastStreak = p.streak;
    p.lastDoubled = doubled;
    p.lastCorrect = !!isCorrect;
  }
  room.reveal[i] = { correct, counts };
  room.meta.status = "reveal";
  hostPublish();
  render();
}

function hostNext() {
  const i = state.room.meta.questionIndex;
  if (i + 1 < state.room.meta.totalQuestions) {
    hostShowQuestion(i + 1);
  } else {
    state.room.meta.status = "ended";
    hostPublish();
    render();
  }
}

function hostCloseRoom() {
  if (!confirm("Odayı kapatmak istediğine emin misin?")) return;
  clearTimeout(state.autoRevealTimer);
  clearState(state.code);
  clearSession();
  resetToHome();
}

// ---------------------------------------------------------------------------
// PLAYER mantığı
// ---------------------------------------------------------------------------
async function joinRoom(code, name) {
  code = code.trim().toUpperCase();
  try { await whenConnected(); }
  catch (e) { return { ok: false, error: e.message }; }

  const data = await getStateOnce(code);
  if (!data) return { ok: false, error: "Bu kodla bir oda bulunamadı." };
  if (data.meta && data.meta.status !== "lobby") {
    return { ok: false, error: "Bu oyun çoktan başlamış." };
  }

  state.role = "player";
  state.code = code;
  state.name = name.trim();
  state.playerId = uid();
  state.room = data;

  state.stateUnsub = subscribeState(code, playerOnState);
  sendInput(code, { type: "join", pid: state.playerId, name: state.name });
  sfx.join();
  saveSession();
  render();
  return { ok: true };
}

function playerOnState(data) {
  if (!data) {
    if (state.currentView !== "gone") {
      state.currentView = "gone"; state.lastRenderKey = "gone"; renderRoomGone();
    }
    return;
  }
  state.room = data;
  render();
}

function playerAnswer(choice) {
  const i = state.room.meta.questionIndex;
  if (state.answeredIndex === i || state.inCountdown) return;
  state.answeredIndex = i;
  state.playerChoice = choice;
  const elapsed = Date.now() - state.playerLocalStart;
  sendInput(state.code, { type: "answer", pid: state.playerId, i, choice, elapsed });
  sfx.click();
}

function playerJoker(kind) {
  const i = state.room.meta.questionIndex;
  if (state.answeredIndex === i || state.inCountdown) return;
  sendInput(state.code, { type: "joker", pid: state.playerId, kind, i });
  sfx.joker();
}

function myJokers() {
  const p = (state.room.players || {})[state.playerId];
  return (p && p.jokers) || { fifty: 0, double: 0 };
}
function myFiftyHidden(i) {
  const f = state.room.fifty && state.room.fifty[i];
  return (f && f[state.playerId]) || null;
}
function myDoubleActive(i) {
  const d = state.room.doubles && state.room.doubles[i];
  return !!(d && d[state.playerId]);
}

// ---------------------------------------------------------------------------
// Render — görünüm yönlendirme
// ---------------------------------------------------------------------------
function computeKey() {
  const m = state.room?.meta;
  if (!m) return "none";
  if (m.status === "lobby") return `${state.role}:lobby`;
  if (m.status === "ended") return `${state.role}:ended`;
  return `${state.role}:${m.status}:${m.questionIndex}`;
}

function render() {
  if (!state.room) return;
  const key = computeKey();
  if (state.currentView === "question" && key === state.lastRenderKey) { patchQuestion(); return; }
  if (state.currentView === "lobby" && key === state.lastRenderKey) { patchLobby(); return; }
  state.lastRenderKey = key;
  fullRender();
}

function fullRender() {
  const m = state.room.meta;
  const status = m.status;
  if (status === "lobby") {
    state.currentView = "lobby";
    state.role === "host" ? renderHostLobby() : renderPlayerLobby();
  } else if (status === "question") {
    state.currentView = "question";
    if (state.role === "player" && state.answeredIndex !== m.questionIndex) state.answeredIndex = -1;
    state.role === "host" ? renderHostQuestion() : renderPlayerQuestion();
  } else if (status === "reveal") {
    state.currentView = "reveal";
    state.role === "host" ? renderHostReveal() : renderPlayerReveal();
  } else if (status === "ended") {
    state.currentView = "ended";
    renderEnded();
  }
}

// ---------------------------------------------------------------------------
// Geri sayım (3-2-1)
// ---------------------------------------------------------------------------
function runCountdown(onDone) {
  state.inCountdown = true;
  const token = ++state.cdToken;
  const overlay = document.createElement("div");
  overlay.className = "countdown-overlay";
  overlay.innerHTML = `<div class="countdown-num" id="cdNum">3</div><div class="countdown-label">Hazır ol!</div>`;
  const card = APP.querySelector(".card");
  if (card) card.appendChild(overlay);

  let n = 3;
  sfx.countdown(3);
  const step = () => {
    if (token !== state.cdToken) return; // görünüm değişti, iptal
    n--;
    if (n > 0) {
      const el = document.getElementById("cdNum");
      if (el) { el.textContent = n; el.style.animation = "none"; void el.offsetWidth; el.style.animation = "cdpop .8s ease"; }
      sfx.countdown(n);
      setTimeout(step, 1000);
    } else {
      const el = document.getElementById("cdNum");
      if (el) el.textContent = "BAŞLA!";
      sfx.go();
      setTimeout(() => {
        if (token !== state.cdToken) return;
        overlay.remove();
        state.inCountdown = false;
        onDone();
      }, 700);
    }
  };
  setTimeout(step, 1000);
}

// ---------------------------------------------------------------------------
// Ekranlar
// ---------------------------------------------------------------------------
function renderHome() {
  state.currentView = "home";
  APP.innerHTML = `
    <div class="card center home">
      <div class="logo">Ben Bildim <span>🧠</span></div>
      <p class="tagline">Arkadaşlarınla bilgi yarışması! Oda kur, herkes telefonundan katılsın.</p>
      <button class="btn btn-primary btn-big" id="goHost">🎮 Oda Kur</button>
      <button class="btn btn-secondary btn-big" id="goJoin">🙋 Odaya Katıl</button>
    </div>`;
  document.getElementById("goHost").onclick = () => { sfx.click(); renderHostSetup(); };
  document.getElementById("goJoin").onclick = () => { sfx.click(); renderJoin(); };
}

function categoryChips() {
  const items = Object.entries(CATEGORIES).map(([key, c]) => `
    <label class="cat-chip">
      <input type="checkbox" value="${key}" checked>
      <span>${c.emoji} ${esc(c.name)}</span>
    </label>`);
  // Kendi Sorularım kategorisi (varsayılan kapalı)
  const customCount = loadCustom().length;
  items.push(`
    <label class="cat-chip">
      <input type="checkbox" value="ozel">
      <span>${CUSTOM_CATEGORY.emoji} ${esc(CUSTOM_CATEGORY.name)} (${customCount})</span>
    </label>`);
  return items.join("");
}

function renderHostSetup() {
  const diffs = Object.entries(DIFFICULTY).map(([key, d]) => `
    <div class="diff-chip ${state.setupDifficulty === key ? "active" : ""}" data-diff="${key}">
      <span class="diff-emoji">${d.emoji}</span>${esc(d.name)}
      <span class="diff-sub">${esc(d.sub)}</span>
    </div>`).join("");

  APP.innerHTML = `
    <div class="card">
      <button class="link-back" id="back">‹ Geri</button>
      <h2>Oda Kur</h2>
      <label class="field-label">Adın</label>
      <input class="input" id="hostName" placeholder="Sunucu adı" maxlength="16" value="Sunucu">

      <label class="field-label">Kategoriler</label>
      <div class="cat-grid">${categoryChips()}</div>
      <div class="cat-actions">
        <button class="mini-btn" id="selAll">Tümü</button>
        <button class="mini-btn" id="selNone">Hiçbiri</button>
        <button class="mini-btn" id="editCustom">✏️ Kendi Sorularım</button>
      </div>

      <label class="field-label">Zorluk</label>
      <div class="difficulty-grid">${diffs}</div>

      <label class="field-label">Soru sayısı: <b id="qcountLbl">10</b></label>
      <input type="range" id="qcount" min="5" max="20" value="10" step="1" class="range">

      <button class="btn btn-primary btn-big" id="create">Odayı Oluştur</button>
    </div>`;

  document.getElementById("back").onclick = renderHome;
  document.getElementById("qcount").oninput = (e) =>
    (document.getElementById("qcountLbl").textContent = e.target.value);
  const boxes = () => [...APP.querySelectorAll(".cat-chip input")];
  document.getElementById("selAll").onclick = () => boxes().forEach((b) => (b.checked = b.value !== "ozel" ? true : b.checked));
  document.getElementById("selNone").onclick = () => boxes().forEach((b) => (b.checked = false));
  document.getElementById("editCustom").onclick = () => renderCustomEditor();
  APP.querySelectorAll(".diff-chip").forEach((el) => {
    el.onclick = () => {
      state.setupDifficulty = el.dataset.diff;
      APP.querySelectorAll(".diff-chip").forEach((x) => x.classList.remove("active"));
      el.classList.add("active");
      sfx.click();
    };
  });

  document.getElementById("create").onclick = async () => {
    const name = document.getElementById("hostName").value.trim() || "Sunucu";
    const selected = boxes().filter((b) => b.checked).map((b) => b.value);
    if (selected.length === 0) { alert("En az bir kategori seç."); return; }
    if (selected.includes("ozel") && loadCustom().length === 0) {
      alert("Kendi Sorularım boş. Önce soru ekle ya da bu kategorinin seçimini kaldır.");
      return;
    }
    const count = parseInt(document.getElementById("qcount").value, 10);
    const btn = document.getElementById("create");
    btn.disabled = true; btn.textContent = "Oluşturuluyor...";
    try {
      await createRoom(selected, count, state.setupDifficulty, name);
    } catch (e) {
      alert("Oda oluşturulamadı: " + e.message);
      btn.disabled = false; btn.textContent = "Odayı Oluştur";
    }
  };
}

// ---- Kendi Sorularım editörü ----
function renderCustomEditor() {
  const list = loadCustom();
  const rows = list.map((q, idx) => `
    <div class="editor-q">
      <div class="eq-text">${idx + 1}. ${esc(q.q)}</div>
      <div class="eq-meta">
        <span>Doğru: ${esc(q.options[q.answer])}</span>
        <button class="mini-btn danger" data-del="${idx}">Sil</button>
      </div>
    </div>`).join("") || `<p class="muted small">Henüz soru yok. Aşağıdan ekle.</p>`;

  APP.innerHTML = `
    <div class="card">
      <button class="link-back" id="back">‹ Kuruluma Dön</button>
      <h2>✏️ Kendi Sorularım</h2>
      <p class="muted small">Kendi sorularını ekle; oda kurarken "Kendi Sorularım" kategorisini seç.</p>
      <div id="qlist">${rows}</div>

      <label class="field-label">Yeni soru</label>
      <input class="input" id="nq" placeholder="Soru metni" maxlength="120">
      ${[0,1,2,3].map((k) => `
        <div class="opt-row">
          <input type="radio" name="correct" value="${k}" ${k===0?"checked":""} title="Doğru şık">
          <input class="input" id="opt${k}" placeholder="Şık ${k+1}" maxlength="60">
        </div>`).join("")}
      <button class="btn btn-secondary" id="addq">Soru Ekle</button>

      <label class="field-label">Dışa/İçe aktar (JSON)</label>
      <textarea class="input" id="io" placeholder='[{"q":"...","options":["a","b","c","d"],"answer":0}]'>${list.length ? esc(JSON.stringify(list)) : ""}</textarea>
      <div class="share-actions">
        <button class="btn btn-secondary" id="importBtn">İçe Aktar</button>
      </div>
    </div>`;

  document.getElementById("back").onclick = renderHostSetup;
  APP.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => {
      const arr = loadCustom(); arr.splice(parseInt(b.dataset.del, 10), 1); saveCustom(arr); renderCustomEditor();
    };
  });
  document.getElementById("addq").onclick = () => {
    const q = document.getElementById("nq").value.trim();
    const opts = [0,1,2,3].map((k) => document.getElementById("opt"+k).value.trim());
    const ans = parseInt(APP.querySelector('input[name="correct"]:checked').value, 10);
    if (!q) { alert("Soru metni gir."); return; }
    if (opts.some((o) => !o)) { alert("4 şıkkı da doldur."); return; }
    const arr = loadCustom();
    arr.push({ q, options: opts, answer: ans });
    saveCustom(arr);
    sfx.correct();
    renderCustomEditor();
  };
  document.getElementById("importBtn").onclick = () => {
    try {
      const parsed = JSON.parse(document.getElementById("io").value);
      if (!Array.isArray(parsed)) throw new Error("Liste bekleniyor");
      const clean = parsed.filter((x) => x && x.q && Array.isArray(x.options) && x.options.length === 4 && typeof x.answer === "number");
      saveCustom(clean);
      alert(clean.length + " soru içe aktarıldı.");
      renderCustomEditor();
    } catch (e) { alert("Geçersiz JSON: " + e.message); }
  };
}

function renderJoin(prefillError, prefillCode) {
  APP.innerHTML = `
    <div class="card">
      <button class="link-back" id="back">‹ Geri</button>
      <h2>Odaya Katıl</h2>
      <label class="field-label">Oda Kodu</label>
      <input class="input code-input" id="code" placeholder="ABCD" maxlength="4" autocapitalize="characters" value="${esc(prefillCode || "")}">
      <label class="field-label">Adın</label>
      <input class="input" id="name" placeholder="Takma adın" maxlength="16">
      ${prefillError ? `<p class="error">${esc(prefillError)}</p>` : ""}
      <button class="btn btn-primary btn-big" id="join">Katıl</button>
    </div>`;
  document.getElementById("back").onclick = renderHome;
  const codeEl = document.getElementById("code");
  codeEl.oninput = () => (codeEl.value = codeEl.value.toUpperCase());
  const nameEl = document.getElementById("name");
  if (prefillCode) nameEl.focus();
  document.getElementById("join").onclick = async () => {
    const code = codeEl.value.trim();
    const name = nameEl.value.trim();
    if (code.length < 4) { alert("Oda kodunu gir."); return; }
    if (!name) { alert("Bir ad gir."); return; }
    const btn = document.getElementById("join");
    btn.disabled = true; btn.textContent = "Katılınıyor...";
    try {
      const res = await joinRoom(code, name);
      if (!res.ok) renderJoin(res.error, code);
    } catch (e) {
      renderJoin("Bağlanılamadı: " + e.message, code);
    }
  };
}

function playersList() {
  return Object.entries(state.room.players || {});
}

function shareUrl() {
  return location.origin + location.pathname + "?oda=" + state.code;
}

function renderHostLobby() {
  const players = playersList();
  const url = shareUrl();
  let qrSvg = "";
  try {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    qrSvg = qr.createSvgTag({ cellSize: 4, margin: 1, scalable: true });
  } catch (e) { qrSvg = ""; }

  APP.innerHTML = `
    <div class="card">
      <div class="lobby-head">
        <div>
          <div class="muted small">Oda Kodu</div>
          <div class="room-code">${esc(state.code)}</div>
        </div>
        <button class="mini-btn danger" id="close">Kapat</button>
      </div>
      <div class="share-box">
        ${qrSvg ? `<div class="qr-wrap">${qrSvg}</div>` : ""}
        <div class="muted small">QR'ı okut ya da linki paylaş — kodu otomatik dolar</div>
        <div class="share-actions">
          <button class="btn btn-secondary" id="copyLink">🔗 Linki Kopyala</button>
          <button class="btn btn-secondary" id="shareLink">📤 Paylaş</button>
        </div>
      </div>
      <div class="players-title">Katılanlar (<span id="pcount">${players.length}</span>)</div>
      <div class="players" id="playerList">${renderPlayerChips(players)}</div>
      <button class="btn btn-primary btn-big" id="start" ${players.length ? "" : "disabled"}>
        Başlat (${state.room.meta.totalQuestions} soru)
      </button>
    </div>`;
  document.getElementById("start").onclick = () => { sfx.click(); hostStartGame(); };
  document.getElementById("close").onclick = hostCloseRoom;
  document.getElementById("copyLink").onclick = async () => {
    try { await navigator.clipboard.writeText(url); document.getElementById("copyLink").textContent = "✓ Kopyalandı"; }
    catch (e) { prompt("Linki kopyala:", url); }
  };
  document.getElementById("shareLink").onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Ben Bildim", text: `Oda kodu: ${state.code}`, url }); } catch (e) {} }
    else { try { await navigator.clipboard.writeText(url); alert("Link kopyalandı: " + url); } catch (e) { prompt("Link:", url); } }
  };
}

function renderPlayerChips(players) {
  if (!players.length) return `<div class="muted small">Henüz kimse yok...</div>`;
  return players.map(([id, p]) => `<div class="player-chip">${esc(p.name)}</div>`).join("");
}

function patchLobby() {
  const players = playersList();
  const list = document.getElementById("playerList");
  const cnt = document.getElementById("pcount");
  if (list) list.innerHTML = renderPlayerChips(players);
  if (cnt) cnt.textContent = players.length;
  const start = document.getElementById("start");
  if (start && state.role === "host") start.disabled = players.length === 0;
}

function renderPlayerLobby() {
  APP.innerHTML = `
    <div class="card center">
      <div class="logo small">Ben Bildim 🧠</div>
      <div class="join-badge">✓ Katıldın</div>
      <p class="big-name">${esc(state.name)}</p>
      <div class="spinner"></div>
      <p class="muted">Sunucunun oyunu başlatması bekleniyor...</p>
      <div class="muted small">Oda: ${esc(state.code)}</div>
    </div>`;
}

function catBadge(catKey) {
  const c = CATEGORIES[catKey] || (catKey === "ozel" ? CUSTOM_CATEGORY : null);
  if (!c) return "";
  return `<span class="cat-badge" style="background:${c.color}">${c.emoji} ${esc(c.name)}</span>`;
}

function timerBarHTML() {
  return `
    <div class="timer-wrap">
      <div class="timer-num" id="timerNum">–</div>
      <div class="timer-bar"><div class="timer-fill" id="timerFill"></div></div>
    </div>`;
}

function visualHTML(pq) {
  return pq && pq.visual ? `<div class="visual-block">${esc(pq.visual)}</div>` : "";
}

function renderHostQuestion() {
  const m = state.room.meta;
  const i = m.questionIndex;
  const pq = state.room.publicQuestions[i];
  const players = playersList();
  const opts = pq.options.map((o, idx) => `
    <div class="opt opt-host" style="background:${OPTION_STYLES[idx].color}">
      <span class="opt-shape">${OPTION_STYLES[idx].shape}</span>
      <span class="opt-text">${esc(o)}</span>
    </div>`).join("");
  APP.innerHTML = `
    <div class="card question-card">
      <div class="q-top">
        <span class="q-progress">Soru ${i + 1}/${m.totalQuestions}</span>
        ${catBadge(pq.category)}
      </div>
      ${timerBarHTML()}
      ${visualHTML(pq)}
      <div class="q-text">${esc(pq.q)}</div>
      <div class="answered-count"><span id="answeredCount">0</span>/${players.length} yanıtladı</div>
      <div class="options">${opts}</div>
      <button class="btn btn-secondary" id="skip">Herkes yanıtladı, göster ›</button>
    </div>`;
  document.getElementById("skip").onclick = () => maybeReveal(i);
  runCountdown(() => {
    state.hostLocalStart = Date.now();
    sfx.whoosh();
    startTicker();
  });
}

function renderPlayerQuestion() {
  const m = state.room.meta;
  const i = m.questionIndex;
  const pq = state.room.publicQuestions[i];
  if (state.answeredIndex === i) { renderPlayerWaiting(pq, state.playerChoice); return; }

  const hidden = myFiftyHidden(i) || [];
  const jok = myJokers();
  const doubleOn = myDoubleActive(i);
  const opts = pq.options.map((o, idx) => `
    <button class="opt opt-btn ${hidden.includes(idx) ? "opt-hidden" : ""}" data-choice="${idx}" style="background:${OPTION_STYLES[idx].color}">
      <span class="opt-shape">${OPTION_STYLES[idx].shape}</span>
      <span class="opt-text">${esc(o)}</span>
    </button>`).join("");

  APP.innerHTML = `
    <div class="card question-card">
      <div class="q-top">
        <span class="q-progress">Soru ${i + 1}/${m.totalQuestions}</span>
        ${catBadge(pq.category)}
      </div>
      ${timerBarHTML()}
      ${visualHTML(pq)}
      <div class="q-text">${esc(pq.q)}</div>
      <div class="options">${opts}</div>
      <div class="jokers" id="jokers">
        <button class="joker-btn" id="jFifty" ${jok.fifty > 0 && !hidden.length ? "" : "disabled"}>➗ 50:50 (${jok.fifty})</button>
        <button class="joker-btn ${doubleOn ? "active" : ""}" id="jDouble" ${jok.double > 0 && !doubleOn ? "" : "disabled"}>✖️ Çift Puan (${doubleOn ? "aktif" : jok.double})</button>
      </div>
    </div>`;

  const bindOpts = () => APP.querySelectorAll(".opt-btn").forEach((b) => {
    b.onclick = () => {
      if (b.classList.contains("opt-hidden")) return;
      const choice = parseInt(b.dataset.choice, 10);
      playerAnswer(choice);
      renderPlayerWaiting(pq, choice);
    };
  });
  bindOpts();
  const jf = document.getElementById("jFifty");
  const jd = document.getElementById("jDouble");
  if (jf) jf.onclick = () => playerJoker("fifty");
  if (jd) jd.onclick = () => playerJoker("double");

  runCountdown(() => {
    state.playerLocalStart = Date.now();
    startTicker();
  });
}

function renderPlayerWaiting(pq, choice) {
  const chosen = choice != null ? OPTION_STYLES[choice] : null;
  const doubleOn = myDoubleActive(state.room.meta.questionIndex);
  APP.innerHTML = `
    <div class="card center question-card">
      ${timerBarHTML()}
      ${visualHTML(pq)}
      <div class="q-text small">${esc(pq.q)}</div>
      ${chosen ? `<div class="chosen" style="background:${chosen.color}">${chosen.shape}</div>` : ""}
      ${doubleOn ? `<div class="double-badge">✖️ Çift Puan aktif</div>` : ""}
      <div class="big-name">Cevabın alındı!</div>
      <p class="muted">Diğer oyuncular bekleniyor...</p>
    </div>`;
}

function patchQuestion() {
  if (state.role === "host") {
    const i = state.room.meta.questionIndex;
    const answers = (state.room.answers && state.room.answers[i]) || {};
    const el = document.getElementById("answeredCount");
    if (el) el.textContent = Object.keys(answers).length;
  } else {
    // Oyuncu: joker durumları (50:50 sonucu / çift puan) güncellenmiş olabilir
    const i = state.room.meta.questionIndex;
    if (state.answeredIndex !== i && !state.inCountdown) {
      const hidden = myFiftyHidden(i) || [];
      hidden.forEach((idx) => {
        const b = APP.querySelector(`.opt-btn[data-choice="${idx}"]`);
        if (b) b.classList.add("opt-hidden");
      });
      const jf = document.getElementById("jFifty");
      const jd = document.getElementById("jDouble");
      const jok = myJokers();
      if (jf) jf.disabled = !(jok.fifty > 0 && !hidden.length);
      if (jd) {
        const on = myDoubleActive(i);
        jd.classList.toggle("active", on);
        jd.textContent = `✖️ Çift Puan (${on ? "aktif" : jok.double})`;
        jd.disabled = !(jok.double > 0 && !on);
      }
    }
  }
}

let tickerRAF = null;
function startTicker() {
  if (tickerRAF) return;
  const loop = () => {
    tickerRAF = null;
    if (state.currentView !== "question" || state.inCountdown) return;
    const m = state.room?.meta;
    if (!m) return;
    const limit = m.timeLimit || 20;
    const startLocal = state.role === "host" ? state.hostLocalStart : state.playerLocalStart;
    if (!startLocal) { tickerRAF = requestAnimationFrame(loop); return; }
    const elapsed = (Date.now() - startLocal) / 1000;
    const remaining = Math.max(0, limit - elapsed);
    const num = document.getElementById("timerNum");
    const fill = document.getElementById("timerFill");
    if (num) num.textContent = Math.ceil(remaining);
    if (fill) {
      const pct = Math.max(0, Math.min(100, (remaining / limit) * 100));
      fill.style.width = pct + "%";
      fill.style.background = remaining < limit * 0.25 ? "#e21b3c" : "#26890c";
    }
    if (remaining <= 0 && state.role === "player" && state.answeredIndex !== m.questionIndex) {
      APP.querySelectorAll(".opt-btn").forEach((b) => (b.disabled = true));
    }
    tickerRAF = requestAnimationFrame(loop);
  };
  tickerRAF = requestAnimationFrame(loop);
}

function leaderboardHTML(limit) {
  const players = playersList().sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  const rows = players.slice(0, limit || players.length).map(([id, p], idx) => {
    const isMe = id === state.playerId;
    const fire = (p.streak || 0) >= 2 ? ` 🔥${p.streak}` : "";
    return `<div class="lb-row ${isMe ? "me" : ""}">
      <span class="lb-rank">${idx + 1}</span>
      <span class="lb-name">${esc(p.name)}${isMe ? " (sen)" : ""}${fire}</span>
      <span class="lb-score">${p.score || 0}</span>
    </div>`;
  }).join("");
  return `<div class="leaderboard">${rows || '<div class="muted small">—</div>'}</div>`;
}

function renderHostReveal() {
  const m = state.room.meta;
  const i = m.questionIndex;
  const q = state.localQuestions[i];
  const rev = (state.room.reveal && state.room.reveal[i]) || { correct: q.answer, counts: [0, 0, 0, 0] };
  const total = Math.max(1, rev.counts.reduce((a, b) => a + b, 0));
  const opts = q.options.map((o, idx) => {
    const isCorrect = idx === rev.correct;
    const pct = Math.round((rev.counts[idx] / total) * 100);
    return `<div class="opt reveal-opt ${isCorrect ? "correct" : "dim"}" style="background:${isCorrect ? "#26890c" : "#9aa0a6"}">
      <span class="opt-shape">${OPTION_STYLES[idx].shape}</span>
      <span class="opt-text">${esc(o)} ${isCorrect ? "✓" : ""}</span>
      <span class="opt-count">${rev.counts[idx]}</span>
      <span class="opt-bar" style="width:${pct}%"></span>
    </div>`;
  }).join("");
  const isLast = i + 1 >= m.totalQuestions;
  APP.innerHTML = `
    <div class="card">
      <div class="q-top"><span class="q-progress">Soru ${i + 1}/${m.totalQuestions}</span></div>
      ${visualHTML(state.room.publicQuestions[i])}
      <div class="q-text small">${esc(q.q)}</div>
      <div class="options reveal">${opts}</div>
      <div class="players-title">Skor Tablosu</div>
      ${leaderboardHTML(5)}
      <button class="btn btn-primary btn-big" id="next">${isLast ? "Sonuçları Göster 🏆" : "Sıradaki Soru ›"}</button>
    </div>`;
  document.getElementById("next").onclick = () => { sfx.click(); hostNext(); };
  sfx.whoosh();
}

function renderPlayerReveal() {
  const me = (state.room.players || {})[state.playerId] || {};
  const correct = me.lastCorrect;
  const gain = me.lastGain || 0;
  const streak = me.lastStreak || 0;
  const players = playersList().sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  const myRank = players.findIndex(([id]) => id === state.playerId) + 1;
  const breakdown = correct
    ? `<div class="gain-breakdown">${me.lastBase || 0} puan${me.lastStreakBonus ? ` + ${me.lastStreakBonus} seri` : ""}${me.lastDoubled ? " × 2 (çift puan)" : ""}</div>`
    : "";
  APP.innerHTML = `
    <div class="card center reveal-player ${correct ? "good" : "bad"}">
      <div class="reveal-icon">${correct ? "✓" : "✗"}</div>
      <div class="reveal-title">${correct ? "Doğru!" : "Yanlış"}</div>
      ${correct ? `<div class="gain">+${gain} puan</div>${breakdown}` : `<div class="gain muted">+0 puan</div>`}
      ${correct && streak >= 2 ? `<div class="streak-fire">🔥 ${streak} seri!</div>` : ""}
      <div class="rank-box">
        <div>Sıralaman</div>
        <div class="rank-num">${myRank}. / ${players.length}</div>
        <div class="muted small">Toplam: ${me.score || 0} puan</div>
      </div>
    </div>`;
  if (correct) { sfx.correct(); if (streak >= 2) setTimeout(() => sfx.streak(), 350); }
  else sfx.wrong();
}

function renderEnded() {
  const players = playersList().sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  const podium = players.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  const podiumHTML = podium.map(([id, p], idx) =>
    `<div class="podium-item p${idx}">
      <div class="medal">${medals[idx]}</div>
      <div class="podium-name">${esc(p.name)}</div>
      <div class="podium-score">${p.score || 0}</div>
    </div>`).join("");

  const winner = players[0];
  APP.innerHTML = `
    <div class="card center">
      <div class="logo small">🏆 Oyun Bitti!</div>
      ${winner ? `<p class="winner-line">Kazanan: <b>${esc(winner[1].name)}</b></p>` : ""}
      <div class="podium">${podiumHTML}</div>
      <div class="players-title">Tam Sıralama</div>
      ${leaderboardHTML()}
      ${state.role === "host"
        ? `<button class="btn btn-primary btn-big" id="again">Yeni Oyun</button>
           <button class="mini-btn danger" id="close">Odayı Kapat</button>`
        : `<p class="muted">Tekrar oynamak için sunucu yeni oyun başlatabilir.</p>`}
    </div>`;
  confetti(3000);
  sfx.fanfare();
  if (state.role === "host") {
    document.getElementById("again").onclick = () => {
      clearTimeout(state.autoRevealTimer);
      if (state.inputUnsub) state.inputUnsub();
      clearState(state.code);
      clearSession();
      state.role = "host";
      renderHostSetup();
    };
    document.getElementById("close").onclick = hostCloseRoom;
  }
}

function renderRoomGone() {
  APP.innerHTML = `
    <div class="card center">
      <div class="logo small">Ben Bildim 🧠</div>
      <h2>Oda kapandı</h2>
      <p class="muted">Bu oda artık mevcut değil.</p>
      <button class="btn btn-primary btn-big" id="home">Ana Sayfa</button>
    </div>`;
  document.getElementById("home").onclick = resetToHome;
}

function resetToHome() {
  clearTimeout(state.autoRevealTimer);
  if (state.stateUnsub) state.stateUnsub();
  if (state.inputUnsub) state.inputUnsub();
  clearSession();
  Object.assign(state, {
    role: null, code: null, playerId: null, name: null, room: null,
    localQuestions: null, stateUnsub: null, inputUnsub: null,
    currentView: null, lastRenderKey: null, answeredIndex: -1, revealingIndex: -1,
    inCountdown: false,
  });
  renderHome();
}

// ---------------------------------------------------------------------------
// Ses düğmesi + ilk dokunuşta sesi aç
// ---------------------------------------------------------------------------
function setupAudioUI() {
  const btn = document.getElementById("muteBtn");
  const refresh = () => { btn.textContent = isMuted() ? "🔇" : "🔊"; };
  refresh();
  btn.onclick = () => { toggleMute(); refresh(); if (!isMuted()) sfx.click(); };
  window.addEventListener("pointerdown", () => unlock(), { once: true });
}

// ---------------------------------------------------------------------------
// Başlangıç
// ---------------------------------------------------------------------------
async function resumeSession(saved) {
  state.role = saved.role;
  state.code = saved.code;
  state.playerId = saved.playerId;
  state.name = saved.name;
  state.localQuestions = saved.localQuestions || null;
  try { await whenConnected(); } catch (e) { clearSession(); renderHome(); return; }

  const data = await getStateOnce(saved.code);
  if (!data) { clearSession(); renderHome(); return; }
  state.room = data;

  if (saved.role === "host") {
    if (!state.localQuestions) { clearSession(); renderHome(); return; }
    if (!state.room.answers) state.room.answers = {};
    state.inputUnsub = subscribeInput(saved.code, hostOnInput);
    render();
  } else {
    state.stateUnsub = subscribeState(saved.code, playerOnState);
    sendInput(saved.code, { type: "join", pid: state.playerId, name: state.name });
    render();
  }
}

function boot() {
  setupAudioUI();
  if (!isConfigured) { renderHome(); return; }

  // ?oda=KOD ile gelen deep-link
  const params = new URLSearchParams(location.search);
  const deepCode = (params.get("oda") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);

  const saved = loadSession();
  if (saved && saved.code) { resumeSession(saved); return; }
  if (deepCode) { renderHome(); renderJoin(null, deepCode); return; }
  renderHome();
}

boot();
