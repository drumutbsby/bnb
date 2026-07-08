// Ben Bildim — çok oyunculu bilgi yarışması (Kahoot tarzı)
// Gerçek zamanlı katman: kurulum gerektirmeyen MQTT (js/net.js).
// Model: HOST yetkilidir; oda durumunu yayınlar. Oyuncular yalnızca girdi gönderir.
import {
  isConfigured, whenConnected, subscribeInput, subscribeState,
  publishState, clearState, sendInput, onStatus,
} from "./net.js";
import { CATEGORIES, QUESTIONS, buildQuestionSet } from "./questions.js";

const APP = document.getElementById("app");

// ---------------------------------------------------------------------------
// Durum (state)
// ---------------------------------------------------------------------------
const state = {
  role: null,            // 'host' | 'player'
  code: null,
  playerId: null,
  name: null,
  room: null,            // yetkili (host) veya son alınan (oyuncu) oda nesnesi
  localQuestions: null,  // sadece host: cevaplarıyla birlikte tam soru seti
  hostLocalStart: 0,
  playerLocalStart: 0,
  answeredIndex: -1,
  playerChoice: null,
  revealingIndex: -1,
  autoRevealTimer: null,
  stateUnsub: null,
  inputUnsub: null,
  currentView: null,
  lastRenderKey: null,
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

// Yayınlanan oda durumu (cevaplar hariç — sızıntı/gereksiz veri olmasın)
function hostPublish() {
  const r = state.room;
  publishState(state.code, {
    meta: r.meta,
    players: r.players || {},
    publicQuestions: r.publicQuestions || {},
    reveal: r.reveal || {},
  });
}

// Retained oda durumunu tek seferlik oku (yoksa null)
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
async function createRoom(categories, count, timeLimit, hostName) {
  state.role = "host";
  state.name = hostName;
  state.playerId = "host";
  await whenConnected();

  // Kod çakışması olmasın diye hızlı bir kontrol
  let code = genCode();
  for (let t = 0; t < 4; t++) {
    const existing = await getStateOnce(code, 900);
    if (!existing) break;
    code = genCode();
  }
  state.code = code;

  const qset = buildQuestionSet(categories, count);
  state.localQuestions = qset;
  state.room = {
    meta: {
      hostName, status: "lobby", questionIndex: -1,
      totalQuestions: qset.length, timeLimit,
      categories: categories && categories.length ? categories : ["hepsi"],
    },
    players: {}, publicQuestions: {}, reveal: {}, answers: {},
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
        name: String(msg.name).slice(0, 16), score: 0, lastGain: 0, lastCorrect: false,
      };
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
    room.answers[i][msg.pid] = {
      choice: msg.choice, elapsed: Math.max(0, Number(msg.elapsed) || 0),
    };
    render();
    const total = Object.keys(room.players).length;
    const answered = Object.keys(room.answers[i]).length;
    if (total > 0 && answered >= total) maybeReveal(i);
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
  state.hostLocalStart = Date.now();
  state.revealingIndex = -1;
  clearTimeout(state.autoRevealTimer);

  if (!state.room.answers) state.room.answers = {};
  state.room.answers[i] = {};
  state.room.publicQuestions[i] = { q: q.q, options: q.options, category: q.category };
  state.room.meta.questionIndex = i;
  state.room.meta.status = "question";
  hostPublish();
  render();

  const limit = state.room.meta.timeLimit || 20;
  state.autoRevealTimer = setTimeout(() => maybeReveal(i), limit * 1000 + 800);
}

function maybeReveal(i) {
  if (state.revealingIndex === i) return;
  if (!state.room || state.room.meta.status !== "question" || state.room.meta.questionIndex !== i) return;
  state.revealingIndex = i;
  clearTimeout(state.autoRevealTimer);
  hostRevealQuestion(i);
}

function hostRevealQuestion(i) {
  const room = state.room;
  const q = state.localQuestions[i];
  const correct = q.answer;
  const timeLimit = room.meta.timeLimit || 20;
  const answers = (room.answers && room.answers[i]) || {};
  const players = room.players || {};
  const counts = [0, 0, 0, 0];

  for (const pid in players) {
    const a = answers[pid];
    let gained = 0;
    if (a && typeof a.choice === "number") {
      if (counts[a.choice] !== undefined) counts[a.choice]++;
      if (a.choice === correct) {
        const frac = Math.min(1, a.elapsed / (timeLimit * 1000));
        gained = 500 + Math.round(500 * (1 - frac));
      }
    }
    players[pid].score = (players[pid].score || 0) + gained;
    players[pid].lastGain = gained;
    players[pid].lastCorrect = a ? a.choice === correct : false;
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
  if (state.answeredIndex === i) return;
  state.answeredIndex = i;
  state.playerChoice = choice;
  const elapsed = Date.now() - state.playerLocalStart;
  sendInput(state.code, { type: "answer", pid: state.playerId, i, choice, elapsed });
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
    if (state.role === "player") {
      state.playerLocalStart = Date.now();
      if (state.answeredIndex !== m.questionIndex) state.answeredIndex = -1;
    }
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
  document.getElementById("goHost").onclick = renderHostSetup;
  document.getElementById("goJoin").onclick = () => renderJoin();
}

function renderHostSetup() {
  const cats = Object.entries(CATEGORIES).map(([key, c]) => `
    <label class="cat-chip">
      <input type="checkbox" value="${key}" checked>
      <span>${c.emoji} ${esc(c.name)}</span>
    </label>`).join("");

  APP.innerHTML = `
    <div class="card">
      <button class="link-back" id="back">‹ Geri</button>
      <h2>Oda Kur</h2>
      <label class="field-label">Adın</label>
      <input class="input" id="hostName" placeholder="Sunucu adı" maxlength="16" value="Sunucu">

      <label class="field-label">Kategoriler</label>
      <div class="cat-grid">${cats}</div>
      <div class="cat-actions">
        <button class="mini-btn" id="selAll">Tümü</button>
        <button class="mini-btn" id="selNone">Hiçbiri</button>
      </div>

      <label class="field-label">Soru sayısı: <b id="qcountLbl">10</b></label>
      <input type="range" id="qcount" min="5" max="20" value="10" step="1" class="range">

      <label class="field-label">Soru başına süre: <b id="tlLbl">20</b> sn</label>
      <input type="range" id="tl" min="10" max="40" value="20" step="5" class="range">

      <button class="btn btn-primary btn-big" id="create">Odayı Oluştur</button>
    </div>`;

  document.getElementById("back").onclick = renderHome;
  document.getElementById("qcount").oninput = (e) =>
    (document.getElementById("qcountLbl").textContent = e.target.value);
  document.getElementById("tl").oninput = (e) =>
    (document.getElementById("tlLbl").textContent = e.target.value);
  const boxes = () => [...APP.querySelectorAll(".cat-chip input")];
  document.getElementById("selAll").onclick = () => boxes().forEach((b) => (b.checked = true));
  document.getElementById("selNone").onclick = () => boxes().forEach((b) => (b.checked = false));

  document.getElementById("create").onclick = async () => {
    const name = document.getElementById("hostName").value.trim() || "Sunucu";
    const selected = boxes().filter((b) => b.checked).map((b) => b.value);
    if (selected.length === 0) { alert("En az bir kategori seç."); return; }
    const count = parseInt(document.getElementById("qcount").value, 10);
    const tl = parseInt(document.getElementById("tl").value, 10);
    const btn = document.getElementById("create");
    btn.disabled = true; btn.textContent = "Oluşturuluyor...";
    try {
      await createRoom(selected, count, tl, name);
    } catch (e) {
      alert("Oda oluşturulamadı: " + e.message);
      btn.disabled = false; btn.textContent = "Odayı Oluştur";
    }
  };
}

function renderJoin(prefillError) {
  APP.innerHTML = `
    <div class="card">
      <button class="link-back" id="back">‹ Geri</button>
      <h2>Odaya Katıl</h2>
      <label class="field-label">Oda Kodu</label>
      <input class="input code-input" id="code" placeholder="ABCD" maxlength="4" autocapitalize="characters">
      <label class="field-label">Adın</label>
      <input class="input" id="name" placeholder="Takma adın" maxlength="16">
      ${prefillError ? `<p class="error">${esc(prefillError)}</p>` : ""}
      <button class="btn btn-primary btn-big" id="join">Katıl</button>
    </div>`;
  document.getElementById("back").onclick = renderHome;
  const codeEl = document.getElementById("code");
  codeEl.oninput = () => (codeEl.value = codeEl.value.toUpperCase());
  document.getElementById("join").onclick = async () => {
    const code = codeEl.value.trim();
    const name = document.getElementById("name").value.trim();
    if (code.length < 4) { alert("Oda kodunu gir."); return; }
    if (!name) { alert("Bir ad gir."); return; }
    const btn = document.getElementById("join");
    btn.disabled = true; btn.textContent = "Katılınıyor...";
    try {
      const res = await joinRoom(code, name);
      if (!res.ok) renderJoin(res.error);
    } catch (e) {
      renderJoin("Bağlanılamadı: " + e.message);
    }
  };
}

function playersList() {
  const players = state.room.players || {};
  return Object.entries(players);
}

function renderHostLobby() {
  const players = playersList();
  APP.innerHTML = `
    <div class="card">
      <div class="lobby-head">
        <div>
          <div class="muted small">Oda Kodu</div>
          <div class="room-code">${esc(state.code)}</div>
        </div>
        <button class="mini-btn danger" id="close">Kapat</button>
      </div>
      <p class="muted">Oyuncular bu siteden <b>Odaya Katıl</b> deyip bu kodu girsin.</p>
      <div class="players-title">Katılanlar (<span id="pcount">${players.length}</span>)</div>
      <div class="players" id="playerList">${renderPlayerChips(players)}</div>
      <button class="btn btn-primary btn-big" id="start" ${players.length ? "" : "disabled"}>
        Başlat (${state.room.meta.totalQuestions} soru)
      </button>
    </div>`;
  document.getElementById("start").onclick = hostStartGame;
  document.getElementById("close").onclick = hostCloseRoom;
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
  const c = CATEGORIES[catKey];
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
      <div class="q-text">${esc(pq.q)}</div>
      <div class="answered-count"><span id="answeredCount">0</span>/${players.length} yanıtladı</div>
      <div class="options">${opts}</div>
      <button class="btn btn-secondary" id="skip">Herkes yanıtladı, göster ›</button>
    </div>`;
  document.getElementById("skip").onclick = () => maybeReveal(i);
  startTicker();
}

function renderPlayerQuestion() {
  const m = state.room.meta;
  const i = m.questionIndex;
  const pq = state.room.publicQuestions[i];
  if (state.answeredIndex === i) { renderPlayerWaiting(pq, state.playerChoice); startTicker(); return; }
  const opts = pq.options.map((o, idx) => `
    <button class="opt opt-btn" data-choice="${idx}" style="background:${OPTION_STYLES[idx].color}">
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
      <div class="q-text">${esc(pq.q)}</div>
      <div class="options">${opts}</div>
    </div>`;
  APP.querySelectorAll(".opt-btn").forEach((b) => {
    b.onclick = () => {
      const choice = parseInt(b.dataset.choice, 10);
      playerAnswer(choice);
      renderPlayerWaiting(pq, choice);
    };
  });
  startTicker();
}

function renderPlayerWaiting(pq, choice) {
  const chosen = choice != null ? OPTION_STYLES[choice] : null;
  APP.innerHTML = `
    <div class="card center question-card">
      ${timerBarHTML()}
      <div class="q-text small">${esc(pq.q)}</div>
      ${chosen ? `<div class="chosen" style="background:${chosen.color}">${chosen.shape}</div>` : ""}
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
  }
}

let tickerRAF = null;
function startTicker() {
  if (tickerRAF) return;
  const loop = () => {
    tickerRAF = null;
    if (state.currentView !== "question") return;
    const m = state.room?.meta;
    if (!m) return;
    const limit = m.timeLimit || 20;
    const startLocal = state.role === "host" ? state.hostLocalStart : state.playerLocalStart;
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
    return `<div class="lb-row ${isMe ? "me" : ""}">
      <span class="lb-rank">${idx + 1}</span>
      <span class="lb-name">${esc(p.name)}${isMe ? " (sen)" : ""}</span>
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
      <div class="q-text small">${esc(q.q)}</div>
      <div class="options reveal">${opts}</div>
      <div class="players-title">Skor Tablosu</div>
      ${leaderboardHTML(5)}
      <button class="btn btn-primary btn-big" id="next">${isLast ? "Sonuçları Göster 🏆" : "Sıradaki Soru ›"}</button>
    </div>`;
  document.getElementById("next").onclick = hostNext;
}

function renderPlayerReveal() {
  const me = (state.room.players || {})[state.playerId] || {};
  const correct = me.lastCorrect;
  const gain = me.lastGain || 0;
  const players = playersList().sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  const myRank = players.findIndex(([id]) => id === state.playerId) + 1;
  APP.innerHTML = `
    <div class="card center reveal-player ${correct ? "good" : "bad"}">
      <div class="reveal-icon">${correct ? "✓" : "✗"}</div>
      <div class="reveal-title">${correct ? "Doğru!" : "Yanlış"}</div>
      ${correct ? `<div class="gain">+${gain} puan</div>` : `<div class="gain muted">+0 puan</div>`}
      <div class="rank-box">
        <div>Sıralaman</div>
        <div class="rank-num">${myRank}. / ${players.length}</div>
        <div class="muted small">Toplam: ${me.score || 0} puan</div>
      </div>
    </div>`;
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
  });
  renderHome();
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
  // Bağlantı arka planda kurulur; kurulum gerektirmez.
  if (!isConfigured) { renderHome(); return; }
  const saved = loadSession();
  if (saved && saved.code) { resumeSession(saved); return; }
  renderHome();
}

boot();
