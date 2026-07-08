// Ben Bildim — çok oyunculu bilgi yarışması (Kahoot tarzı)
// Gerçek zamanlı katman: kurulum gerektirmeyen MQTT (js/net.js).
// Model: HOST yetkilidir; oda durumunu yayınlar. Oyuncular yalnızca girdi gönderir.
import {
  isConfigured, whenConnected, subscribeInput, subscribeState,
  publishState, clearState, sendInput, publishHof, subscribeHof, subscribeRooms,
  publishLeague, subscribeLeague,
} from "./net.js";
import { ensureDaily, updateDailyAfterGame, loginStreak } from "./daily.js";
import { CATEGORIES, CUSTOM_CATEGORY, QUESTIONS, buildQuestionSet } from "./questions.js";
import { unlock, sfx, isMuted, toggleMute } from "./sound.js";
import { confetti } from "./confetti.js";
import qrcode from "./vendor/qrcode.js";
import { loadProfile, setName, setAvatar, rankFor, rankProgress, recordGame, RANKS } from "./profile.js";
import { CHARACTERS, pickPhrase, CATEGORY_QUIPS } from "./characters.js";
import { ACHIEVEMENTS } from "./achievements.js";

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
const AVATARS = ["🙂","🦁","🐯","🐻","🦊","🐼","🐨","🐸","🐵","🦄","🐺","🐱","🐶","🐹","🐰","🦖","🐙","🐬","🦈","🦋","🐝","🐷","🐮","🐔","🐧","🐢","🐉","🦸","🥷","🤖","👽","👑"];
const THEMES = {
  mor:       { name: "Mor", emoji: "🟣", vars: { "--bg1": "#46178f", "--bg2": "#7c2fd6", "--primary": "#46178f", "--primary-d": "#35116e" } },
  okyanus:   { name: "Okyanus", emoji: "🔵", vars: { "--bg1": "#0b3d66", "--bg2": "#1368ce", "--primary": "#0b5cad", "--primary-d": "#083f78" } },
  orman:     { name: "Orman", emoji: "🟢", vars: { "--bg1": "#12572b", "--bg2": "#26890c", "--primary": "#1a7a2e", "--primary-d": "#0f5220" } },
  gunbatimi: { name: "Gün Batımı", emoji: "🟠", vars: { "--bg1": "#7a1f4b", "--bg2": "#e2691b", "--primary": "#c8106e", "--primary-d": "#8f0a4e" } },
  gece:      { name: "Gece", emoji: "⚫", vars: { "--bg1": "#0f1220", "--bg2": "#232946", "--primary": "#5a5fd6", "--primary-d": "#3b3f9e" } },
  altin:     { name: "Altın", emoji: "🟡", vars: { "--bg1": "#6b4e00", "--bg2": "#d89e00", "--primary": "#a67c00", "--primary-d": "#6b4e00" } },
  gokkusagi: { name: "Gökkuşağı", emoji: "🌈", vars: { "--bg1": "#8e2de2", "--bg2": "#e2691b", "--primary": "#c8106e", "--primary-d": "#8f0a4e" } },
};
// Kilitli avatarlar/temalar (rütbe/rozet/istatistikle açılır)
const AVATAR_LOCKS = {
  "🐉": { cond: (p) => p.xp >= 15000, hint: "Bilgili rütbesi (15.000 XP)" },
  "🦸": { cond: (p) => p.wins >= 10, hint: "10 galibiyet" },
  "🥷": { cond: (p) => p.bestStreak >= 5, hint: "5'li seri (Alev Aldı rozeti)" },
  "🤖": { cond: (p) => p.badges && p.badges.perfect, hint: "Kusursuz rozeti" },
  "👽": { cond: (p) => p.badges && p.badges.speed, hint: "Hız Canavarı rozeti" },
  "👑": { cond: (p) => p.xp >= 150000, hint: "Bilge rütbesi (150.000 XP)" },
};
const THEME_LOCKS = {
  altin: { cond: (p) => p.xp >= 75000, hint: "Usta rütbesi (75.000 XP)" },
  gokkusagi: { cond: (p) => Object.keys(p.badges || {}).length >= 8, hint: "8 rozet" },
};
function avatarUnlocked(a, p) { const l = AVATAR_LOCKS[a]; return !l || l.cond(p || loadProfile()); }
function themeUnlocked(k, p) { const l = THEME_LOCKS[k]; return !l || l.cond(p || loadProfile()); }
function weekId() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return d.getFullYear() + "-H" + wk;
}
function currentTheme() { try { return localStorage.getItem("bnb_theme") || "mor"; } catch (e) { return "mor"; } }
function applyTheme(key) {
  const t = THEMES[key] || THEMES.mor;
  const root = document.documentElement;
  for (const k in t.vars) root.style.setProperty(k, t.vars[k]);
  try { localStorage.setItem("bnb_theme", key); } catch (e) {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.vars["--bg1"]);
}
function tickEnabled() { try { return localStorage.getItem("bnb_tick") !== "0"; } catch (e) { return true; } }


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
    requests: r.requests || {},
    rejected: r.rejected || {},
    kicked: r.kicked || {},
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
async function createRoom(categories, count, difficultyKey, hostName, settings) {
  settings = settings || {};
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
  const hostPlays = settings.hostPlays !== false;
  const teamName = (settings.teamName || hostName || "Takım").slice(0, 20);
  state.room = {
    meta: {
      hostName, status: "lobby", questionIndex: -1,
      totalQuestions: qset.length, timeLimit: diff.time,
      pointFactor: diff.factor, difficulty: difficultyKey,
      categories: categories && categories.length ? categories : ["hepsi"],
      hostPlays,
      speedBonus: settings.speedBonus !== false,
      wrongPenalty: settings.wrongPenalty ? 250 : 0,
      teamName, teamAName: teamName, teamBName: null,
      requireApproval: !!settings.requireApproval,
      teamAvg: !!settings.teamAvg,
      teamMode: false,
    },
    players: {}, requests: {}, publicQuestions: {}, reveal: {}, answers: {}, fifty: {}, doubles: {},
  };
  // Oda kuran da oynayacaksa oyuncu listesine ekle (ev sahibi takım = A)
  if (hostPlays) {
    state.room.players["host"] = {
      name: hostName, score: 0, streak: 0, team: "A",
      avatar: (settings.avatar || loadProfile().avatar || "🙂"),
      lastGain: 0, lastCorrect: false, lastStreak: 0,
      jokers: { ...START_JOKERS },
    };
  }

  state.inputUnsub = subscribeInput(code, hostOnInput);
  hostPublish();
  saveSession();
  render();
}

function addPlayer(pid, name, team, avatar) {
  state.room.players[pid] = {
    name: String(name).slice(0, 16), score: 0, streak: 0, team: team || "A",
    avatar: avatar || "🙂",
    lastGain: 0, lastCorrect: false, lastStreak: 0,
    jokers: { ...START_JOKERS },
  };
}

function hostOnInput(msg) {
  if (!msg || !state.room || state.role !== "host") return;
  const room = state.room;
  if (msg.type === "join") {
    if (room.meta.status !== "lobby") return;
    if (!msg.pid || !msg.name) return;
    if (room.kicked && room.kicked[msg.pid]) return; // atılan geri giremez
    // Rakip takım (challenge kabulü sonrası taşınan) doğrudan eklenir
    const team = msg.team === "B" ? "B" : "A";
    // Onay gerekiyorsa ve ev sahibi takımsa: talep olarak al
    if (room.meta.requireApproval && team === "A") {
      if (!room.players[msg.pid] && !room.requests[msg.pid]) {
        room.requests[msg.pid] = { name: String(msg.name).slice(0, 16), avatar: msg.avatar || "🙂" };
        hostPublish(); render();
      }
      return;
    }
    if (!room.players[msg.pid]) {
      addPlayer(msg.pid, msg.name, team, msg.avatar);
      sfx.join();
      hostPublish();
      render();
    }
  } else if (msg.type === "joinRequest") {
    if (room.meta.status !== "lobby") return;
    if (!msg.pid || !msg.name) return;
    if (room.kicked && room.kicked[msg.pid]) return;
    if (!room.players[msg.pid] && !room.requests[msg.pid]) {
      room.requests[msg.pid] = { name: String(msg.name).slice(0, 16), avatar: msg.avatar || "🙂" };
      sfx.join();
      hostPublish(); render();
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
  } else if (msg.type === "challenge") {
    // Meydan okuma geldi (bu oda = meydan okunan taraf)
    if (room.meta.status !== "lobby" || room.meta.teamMode) return;
    room.meta.challengeFrom = { code: msg.code, teamName: msg.teamName || "Rakip" };
    sfx.join();
    hostPublish(); render();
  } else if (msg.type === "challengeAccept") {
    // Karşı taraf kabul etti (bu oda = meydan okuyan arena)
    if (room.meta.status !== "lobby") return;
    room.meta.teamMode = true;
    room.meta.teamAName = room.meta.teamName;
    room.meta.teamBName = msg.teamName || "Rakip Takım";
    room.meta.challengeStatus = null;
    delete room.meta.challengeTo;
    sfx.correct();
    hostPublish(); render();
  } else if (msg.type === "challengeDecline") {
    room.meta.challengeStatus = "declined";
    delete room.meta.challengeTo;
    hostPublish(); render();
  }
}

function hostStartGame() {
  const players = state.room.players || {};
  if (Object.keys(players).length === 0) {
    alert("En az bir oyuncunun katılması gerekiyor.");
    return;
  }
  if (state.room.meta.teamMode) {
    const teams = new Set(Object.values(players).map((p) => p.team || "A"));
    if (!teams.has("A") || !teams.has("B")) {
      alert("Düello için her iki takımda da oyuncu olmalı.");
      return;
    }
  }
  hostShowQuestion(0);
}

// ---- Meydan okuma / takım düellosu (lider aksiyonları) ----
async function hostSendChallenge() {
  const target = (prompt("Meydan okumak istediğin odanın kodu:") || "").trim().toUpperCase();
  if (!target) return;
  if (target === state.code) { alert("Kendine meydan okuyamazsın."); return; }
  const data = await getStateOnce(target, 2500);
  if (!data) { alert("O kodla bir oda bulunamadı."); return; }
  if (data.meta && (data.meta.status !== "lobby" || data.meta.teamMode)) { alert("O oda şu an müsait değil."); return; }
  sendInput(target, { type: "challenge", code: state.code, teamName: state.room.meta.teamName });
  state.room.meta.challengeStatus = "sent";
  state.room.meta.challengeTo = target;
  hostPublish(); render();
}

function hostAcceptChallenge() {
  const from = state.room.meta.challengeFrom;
  if (!from) return;
  const arena = from.code;
  const myTeam = state.room.meta.teamName;
  // Meydan okuyan arenaya kabul bildir
  sendInput(arena, { type: "challengeAccept", code: state.code, teamName: myTeam });
  // Üyeleri arenaya yönlendir
  state.room.meta.redirectTo = arena;
  state.room.meta.teamBName = myTeam;
  hostPublish();
  // Lider de arenaya (takım B) oyuncu olarak geçer
  migrateToArena(arena, myTeam);
}

function hostDeclineChallenge() {
  const from = state.room.meta.challengeFrom;
  if (from) sendInput(from.code, { type: "challengeDecline", code: state.code });
  delete state.room.meta.challengeFrom;
  hostPublish(); render();
}

// Rakip takımı (lider + üyeler) arenaya taşır
function migrateToArena(arenaCode, myTeamName) {
  if (state.migrating) return;
  state.migrating = true;
  if (state.stateUnsub) { state.stateUnsub(); state.stateUnsub = null; }
  if (state.inputUnsub) { state.inputUnsub(); state.inputUnsub = null; }
  clearTimeout(state.autoRevealTimer);

  state.role = "player";
  state.name = state.name || myTeamName || "Oyuncu";
  if (state.playerId === "host") state.playerId = uid(); // arena host'u ile çakışmasın
  state.code = arenaCode;
  state.localQuestions = null;
  state.room = null;
  state.currentView = null; state.lastRenderKey = null;
  state.answeredIndex = -1; state.revealingIndex = -1;
  state.pendingApproval = false;
  state.awaitingArena = true;

  renderMigrating();
  state.stateUnsub = subscribeState(arenaCode, playerOnState);
  sendInput(arenaCode, { type: "join", pid: state.playerId, name: state.name, team: "B", avatar: loadProfile().avatar || "🙂" });
  saveSession();
  state.migrating = false;
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
    const speedBonus = room.meta.speedBonus !== false;
    const penalty = room.meta.wrongPenalty || 0;
    if (a && typeof a.choice === "number" && counts[a.choice] !== undefined) counts[a.choice]++;
    if (isCorrect) {
      if (speedBonus) {
        const frac = Math.min(1, a.elapsed / (timeLimit * 1000));
        base = Math.round((500 + Math.round(500 * (1 - frac))) * factor);
      } else {
        base = Math.round(1000 * factor); // hız bonusu kapalı: sabit puan
      }
      p.streak = (p.streak || 0) + 1;
      streakBonus = p.streak >= 2 ? Math.min(p.streak - 1, 5) * 100 : 0;
      gained = base + streakBonus;
      if (doubles[pid]) { gained *= 2; doubled = true; }
    } else {
      p.streak = 0;
      // Yanlış işaretleyene ceza (yalnızca cevap verdiyse; boş bırakan ceza almaz)
      if (penalty && a) gained = -penalty;
    }
    p.score = Math.max(0, (p.score || 0) + gained);
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

// Lider: katılım talebini onayla / reddet
function approveRequest(pid) {
  const room = state.room;
  const req = room.requests && room.requests[pid];
  if (!req) return;
  addPlayer(pid, req.name, "A", req.avatar);
  delete room.requests[pid];
  sfx.join();
  hostPublish(); render();
}
function rejectRequest(pid) {
  const room = state.room;
  if (!room.requests || !room.requests[pid]) return;
  delete room.requests[pid];
  if (!room.rejected) room.rejected = {};
  room.rejected[pid] = true;
  hostPublish(); render();
}

// Lider: oyuncuyu odadan at
function hostKick(pid) {
  const room = state.room;
  if (!room.players[pid] || pid === "host") return;
  const nm = room.players[pid].name;
  if (!confirm(`${nm} oyuncusunu at?`)) return;
  delete room.players[pid];
  if (!room.kicked) room.kicked = {};
  room.kicked[pid] = true;
  hostPublish(); render();
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

  const av = loadProfile().avatar || "🙂";
  const needApproval = !!(data.meta && data.meta.requireApproval);
  state.pendingApproval = needApproval;
  state.stateUnsub = subscribeState(code, playerOnState);
  sendInput(code, needApproval
    ? { type: "joinRequest", pid: state.playerId, name: state.name, avatar: av }
    : { type: "join", pid: state.playerId, name: state.name, avatar: av });
  sfx.join();
  saveSession();
  if (needApproval) renderPendingApproval();
  else render();
  return { ok: true };
}

function playerOnState(data) {
  if (!data) {
    if (state.awaitingArena) { renderMigrating(); return; }
    if (state.currentView !== "gone") {
      state.currentView = "gone"; state.lastRenderKey = "gone"; renderRoomGone();
    }
    return;
  }
  // Challenge kabulü sonrası rakip takım arenaya taşınıyor
  if (data.meta && data.meta.redirectTo && !state.migrating && !state.awaitingArena) {
    migrateToArena(data.meta.redirectTo, data.meta.teamBName);
    return;
  }
  state.awaitingArena = false;
  // Odadan atıldıysa
  if (data.kicked && data.kicked[state.playerId]) {
    if (state.stateUnsub) state.stateUnsub();
    state.currentView = "kicked"; state.lastRenderKey = "kicked";
    renderKicked();
    return;
  }
  state.room = data;
  // Onay bekleyen oyuncu
  if (state.pendingApproval) {
    if (data.rejected && data.rejected[state.playerId]) {
      state.pendingApproval = false;
      if (state.stateUnsub) state.stateUnsub();
      renderRejected();
      return;
    }
    if (data.players && data.players[state.playerId]) {
      state.pendingApproval = false; // onaylandı
    } else {
      renderPendingApproval();
      return;
    }
  }
  render();
}

function playerAnswer(choice) {
  const i = state.room.meta.questionIndex;
  if (state.answeredIndex === i || state.inCountdown) return;
  state.answeredIndex = i;
  state.playerChoice = choice;
  const elapsed = Date.now() - state.playerLocalStart;
  state.lastElapsed = elapsed;
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
  // Lobide talep/meydan okuma değişimleri için her seferinde tam çiz
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
    state.lastTickSec = 99;
    if (state.answeredIndex !== m.questionIndex) state.answeredIndex = -1;
    // İlk soruda oyun-içi istatistikleri sıfırla
    if (m.questionIndex === 0 && !state.statsInit) {
      state.gameStats = { correct: 0, questions: 0, maxStreak: 0, wrongStreak: 0, fastMs: 0 };
      state.statsInit = true; state.recorded = false;
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
function profileChipHtml() {
  const p = loadProfile();
  const { cur, next, pct } = rankProgress(p.xp);
  const label = p.name ? esc(p.name) : "Misafir";
  return `
    <button class="profile-chip" id="profileChip">
      <span class="pc-rank">${cur.emoji}</span>
      <span class="pc-info">
        <span class="pc-name">${label}</span>
        <span class="pc-rankname">${esc(cur.name)}${next ? "" : " • MAX"}</span>
        <span class="pc-bar"><span class="pc-fill" style="width:${pct}%"></span></span>
      </span>
      <span class="pc-xp">${p.xp} XP</span>
    </button>`;
}

function dailyStripHtml() {
  const d = ensureDaily();
  const doneCount = d.quests.filter((q) => q.done).length;
  return `<button class="daily-strip" id="dailyStrip">
    <span class="ds-streak">🔥 ${d.streak} gün</span>
    <span class="ds-q">Günlük görevler: <b>${doneCount}/${d.quests.length}</b></span>
    <span class="ds-go">›</span>
  </button>`;
}

function renderHome() {
  state.currentView = "home";
  APP.innerHTML = `
    <div class="card center home">
      <div class="logo">Ben Bildim <span>🧠</span></div>
      ${profileChipHtml()}
      ${dailyStripHtml()}
      <button class="btn btn-primary btn-big" id="goHost">🎮 Oda Kur</button>
      <button class="btn btn-secondary btn-big" id="goJoin">🙋 Odaya Katıl</button>
      <button class="btn btn-secondary btn-big" id="quick">⚡ Hızlı Eşleş</button>
      <div class="home-links">
        <button class="btn-link" id="records">🏆 Rekorlarım</button>
        <button class="btn-link" id="league">🏅 Haftalık Lig</button>
        <button class="btn-link" id="global">🌍 Global</button>
        <button class="btn-link" id="settings">⚙️ Ayarlar</button>
      </div>
    </div>`;
  document.getElementById("goHost").onclick = () => { sfx.click(); renderHostSetup(); };
  document.getElementById("goJoin").onclick = () => { sfx.click(); renderJoin(); };
  document.getElementById("quick").onclick = () => { sfx.click(); renderQuickMatch(); };
  document.getElementById("records").onclick = () => { sfx.click(); renderProfile(); };
  document.getElementById("league").onclick = () => { sfx.click(); renderLeague(); };
  document.getElementById("global").onclick = () => { sfx.click(); renderGlobal(); };
  document.getElementById("settings").onclick = () => { sfx.click(); renderSettings(); };
  document.getElementById("profileChip").onclick = () => { sfx.click(); renderProfile(); };
  document.getElementById("dailyStrip").onclick = () => { sfx.click(); renderDaily(); };
}

function renderDaily() {
  state.currentView = "daily";
  const d = ensureDaily();
  const quests = d.quests.map((q) => {
    const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
    return `<div class="quest ${q.done ? "done" : ""}">
      <div class="quest-top"><span>${q.done ? "✅ " : ""}${esc(q.text)}</span><span class="quest-xp">+${q.xp} XP</span></div>
      <div class="quest-bar"><span style="width:${pct}%"></span></div>
      <div class="muted small">${Math.min(q.progress, q.goal)}/${q.goal}</div>
    </div>`;
  }).join("");
  // Son 7 günün takvimi
  const today = Math.floor(Date.now() / 86400000);
  const log = new Set(d.log || []);
  const days = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
  let cal = "";
  for (let i = 6; i >= 0; i--) {
    const dn = today - i;
    const active = log.has(dn);
    const dow = new Date(dn * 86400000).getDay(); // 0=Paz
    const label = days[(dow + 6) % 7];
    cal += `<div class="cal-day ${active ? "on" : ""}">${active ? "🔥" : "·"}<span>${label}</span></div>`;
  }
  APP.innerHTML = `
    <div class="card">
      <button class="link-back" id="back">‹ Geri</button>
      <h2>📅 Günlük</h2>
      <div class="streak-big">🔥 ${d.streak} günlük seri</div>
      <div class="cal-row">${cal}</div>
      <div class="players-title">Bugünün Görevleri</div>
      ${quests}
      <p class="muted small">Görevler tamamlanınca XP otomatik eklenir. Her gün yenilenir; her gün gel, serini büyüt!</p>
    </div>`;
  document.getElementById("back").onclick = renderHome;
}

function renderLeague() {
  state.currentView = "league";
  const wk = weekId();
  APP.innerHTML = `
    <div class="card">
      <button class="link-back" id="back">‹ Geri</button>
      <h2>🏅 Haftalık Lig</h2>
      <p class="muted small" id="leagueNote">Bu hafta (${esc(wk)}) en çok XP toplayanlar (topluluk · en iyi çaba). Bağlanılıyor...</p>
      <div id="leagueList"><div class="spinner"></div></div>
    </div>`;
  const entries = new Map();
  let unsub = null, rt = null;
  const done = () => { if (unsub) unsub(); clearTimeout(rt); };
  document.getElementById("back").onclick = () => { done(); renderHome(); };
  const paint = () => {
    const mine = loadProfile();
    const list = [...entries.values()].filter((e) => e && typeof e.xp === "number").sort((a, b) => b.xp - a.xp).slice(0, 50);
    const rows = list.map((e, i) => `
      <div class="lb-row ${e.name && e.name === mine.name ? "me" : ""}">
        <span class="lb-rank">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
        <span class="lb-name"><span class="lb-av">${esc(e.avatar || "🙂")}</span>${esc(e.name || "—")}</span>
        <span class="lb-score">${e.xp} XP</span>
      </div>`).join("") || `<div class="muted small">Bu hafta henüz kayıt yok. İlk sen ol!</div>`;
    const el = document.getElementById("leagueList"); if (el) el.innerHTML = rows;
    const note = document.getElementById("leagueNote");
    if (note) note.textContent = `Bu haftanın (${wk}) şampiyon adayları — ${list.length} oyuncu`;
  };
  const schedule = () => { clearTimeout(rt); rt = setTimeout(paint, 400); };
  whenConnected().then(() => {
    const pr = loadProfile();
    const myWeekXp = pr.weekly && pr.weekly.week === wk ? pr.weekly.xp : 0;
    try { publishLeague(wk, pr.deviceId, { name: pr.name || "Misafir", avatar: pr.avatar || "🙂", xp: myWeekXp, ts: Date.now() }); } catch (e) {}
    unsub = subscribeLeague(wk, (entry, id) => { entries.set(id, entry); schedule(); });
    setTimeout(() => { if (state.currentView === "league") paint(); }, 1500);
  }).catch(() => { const el = document.getElementById("leagueList"); if (el) el.innerHTML = `<div class="muted small">Sunucuya bağlanılamadı.</div>`; });
}

function renderSettings() {
  state.currentView = "settings";
  const cur = currentTheme();
  const prof = loadProfile();
  const themes = Object.entries(THEMES).map(([key, t]) => {
    const locked = !themeUnlocked(key, prof);
    return `<button type="button" class="theme-opt ${key === cur ? "sel" : ""} ${locked ? "locked" : ""}" data-theme="${key}" ${locked ? `data-locked="1" title="Kilitli: ${esc(THEME_LOCKS[key].hint)}"` : ""}>
      <span class="theme-sw" style="background:linear-gradient(135deg,${t.vars["--bg1"]},${t.vars["--bg2"]})"></span>
      ${t.emoji} ${esc(t.name)}${locked ? " 🔒" : ""}
    </button>`;
  }).join("");
  APP.innerHTML = `
    <div class="card">
      <button class="link-back" id="back">‹ Geri</button>
      <h2>⚙️ Ayarlar</h2>
      <label class="field-label">Tema</label>
      <div class="theme-grid">${themes}</div>
      <label class="field-label">Ses</label>
      <label class="toggle-chip"><input type="checkbox" id="setSound" ${isMuted() ? "" : "checked"}> <span>🔊 Ses efektleri</span></label>
      <label class="toggle-chip"><input type="checkbox" id="setTick" ${tickEnabled() ? "checked" : ""}> <span>⏱️ Son saniyelerde gerilim tıkırtısı</span></label>
    </div>`;
  document.getElementById("back").onclick = renderHome;
  APP.querySelectorAll(".theme-opt").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.locked) { alert("Bu tema kilitli: " + THEME_LOCKS[b.dataset.theme].hint); return; }
      applyTheme(b.dataset.theme);
      APP.querySelectorAll(".theme-opt").forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel");
      sfx.click();
    };
  });
  document.getElementById("setSound").onchange = (e) => { if (isMuted() === e.target.checked) toggleMute(); const mb = document.getElementById("muteBtn"); if (mb) mb.textContent = isMuted() ? "🔇" : "🔊"; };
  document.getElementById("setTick").onchange = (e) => { try { localStorage.setItem("bnb_tick", e.target.checked ? "1" : "0"); } catch (x) {} };
}

function renderQuickMatch() {
  let name = loadProfile().name;
  if (!name) { name = (prompt("Takma adın:") || "").trim(); if (!name) { renderHome(); return; } setName(name); }
  state.currentView = "quick";
  APP.innerHTML = `
    <div class="card center">
      <div class="logo small">⚡ Hızlı Eşleş</div>
      <div class="spinner"></div>
      <p class="muted" id="qmNote">Açık oda aranıyor...</p>
    </div>`;
  const rooms = new Map();
  let unsub = null, decided = false;
  const cleanup = () => { if (unsub) unsub(); };
  whenConnected().then(() => {
    unsub = subscribeRooms((code, data) => {
      if (!data || !data.meta) { rooms.delete(code); return; }
      const m = data.meta;
      const open = m.status === "lobby" && !m.redirectTo && !m.teamMode;
      if (open) rooms.set(code, data); else rooms.delete(code);
    });
    setTimeout(() => {
      if (decided) return; decided = true; cleanup();
      const codes = [...rooms.keys()];
      if (!codes.length) {
        const n = document.getElementById("qmNote");
        APP.querySelector(".spinner")?.remove();
        if (n) n.innerHTML = "Şu an açık oda yok 😕<br>Sen bir oda kurabilirsin!";
        const b = document.createElement("button"); b.className = "btn btn-primary btn-big"; b.textContent = "Oda Kur";
        b.onclick = renderHostSetup; APP.querySelector(".card").appendChild(b);
        const h = document.createElement("button"); h.className = "btn-link"; h.textContent = "Ana Sayfa"; h.onclick = renderHome;
        APP.querySelector(".card").appendChild(h);
        return;
      }
      const code = codes[Math.floor(Math.random() * codes.length)];
      const note = document.getElementById("qmNote"); if (note) note.textContent = `Odaya katılıyorsun: ${code}`;
      joinRoom(code, name).then((res) => { if (!res.ok) { renderJoin(res.error, code); } });
    }, 2200);
  }).catch(() => {
    const n = document.getElementById("qmNote"); if (n) n.textContent = "Sunucuya bağlanılamadı.";
  });
}

function renderGlobal() {
  state.currentView = "global";
  APP.innerHTML = `
    <div class="card">
      <button class="link-back" id="back">‹ Geri</button>
      <h2>🌍 Global Sıralama</h2>
      <p class="muted small" id="globalNote">Tüm zamanların en iyileri (topluluk · en iyi çaba). Bağlanılıyor...</p>
      <div id="globalList"><div class="spinner"></div></div>
    </div>`;
  const entries = new Map();
  let unsub = null, rt = null;
  const done = () => { if (unsub) unsub(); clearTimeout(rt); };
  document.getElementById("back").onclick = () => { done(); renderHome(); };

  const paint = () => {
    const mine = loadProfile();
    const list = [...entries.values()].filter((e) => e && typeof e.xp === "number").sort((a, b) => b.xp - a.xp).slice(0, 50);
    const rows = list.map((e, i) => `
      <div class="lb-row ${e.name && e.name === mine.name ? "me" : ""}">
        <span class="lb-rank">${i + 1}</span>
        <span class="lb-name"><span class="lb-av">${esc(e.avatar || "🙂")}</span>${esc(e.name || "—")} <span class="muted small">${esc(e.rank || "")}</span></span>
        <span class="lb-score">${e.xp} XP</span>
      </div>`).join("") || `<div class="muted small">Henüz kayıt yok. İlk oyununu oyna, listeye gir!</div>`;
    const gl = document.getElementById("globalList"); if (gl) gl.innerHTML = rows;
    const note = document.getElementById("globalNote");
    if (note) note.textContent = `Tüm zamanların en iyileri (topluluk · en iyi çaba) — ${list.length} oyuncu`;
  };
  const schedule = () => { clearTimeout(rt); rt = setTimeout(paint, 400); };

  whenConnected().then(() => {
    const pr = loadProfile();
    try { publishHof(pr.deviceId, { name: pr.name || "Misafir", avatar: pr.avatar || "🙂", xp: pr.xp, best: pr.bestScore, rank: rankFor(pr.xp).name, games: pr.games, ts: Date.now() }); } catch (e) {}
    unsub = subscribeHof((entry, id) => { entries.set(id, entry); schedule(); });
    setTimeout(() => { if (state.currentView === "global") paint(); }, 1500);
  }).catch(() => {
    const gl = document.getElementById("globalList");
    if (gl) gl.innerHTML = `<div class="muted small">Sunucuya bağlanılamadı.</div>`;
  });
}

function renderProfile() {
  state.currentView = "profile";
  const p = loadProfile();
  const { cur, next, pct } = rankProgress(p.xp);
  const acc = p.totalQuestions ? Math.round((p.totalCorrect / p.totalQuestions) * 100) : 0;
  const ladder = RANKS.map((r) => {
    const reached = p.xp >= r.min;
    const isCur = r === cur;
    return `<div class="rank-item ${isCur ? "cur" : ""} ${reached ? "reached" : ""}">
      <span>${r.emoji} ${esc(r.name)}</span><span class="muted small">${r.min} XP</span>
    </div>`;
  }).join("");
  const hist = (p.history || []).slice(0, 8).map((h) => `
    <div class="lb-row">
      <span class="lb-name">${h.won ? "🏆 " : ""}${h.team ? "Takım" : "Bireysel"} · ${h.rank}${h.players ? "/" + h.players : ""}</span>
      <span class="lb-score">${h.score}</span>
    </div>`).join("") || `<div class="muted small">Henüz oyun yok.</div>`;
  const badges = p.badges || {};
  const badgeCount = Object.keys(badges).length;
  const badgeGrid = ACHIEVEMENTS.map((a) => {
    const got = !!badges[a.id];
    return `<div class="badge-item ${got ? "got" : "locked"}" title="${esc(a.desc)}">
      <div class="badge-ico">${got ? a.emoji : "🔒"}</div>
      <div class="badge-nm">${esc(a.name)}</div>
      <div class="badge-dc">${esc(a.desc)}</div>
    </div>`;
  }).join("");

  APP.innerHTML = `
    <div class="card">
      <button class="link-back" id="back">‹ Geri</button>
      <div class="profile-head">
        <div class="ph-rank">${cur.emoji}</div>
        <div>
          <input class="input name-inline" id="pname" maxlength="16" placeholder="Takma adın" value="${esc(p.name)}">
          <div class="ph-rankname">${esc(cur.name)}${next ? ` → ${next.emoji} ${esc(next.name)}` : " • En yüksek rütbe"}</div>
        </div>
      </div>
      <div class="pc-bar big"><span class="pc-fill" style="width:${pct}%"></span></div>
      <div class="muted small center">${p.xp} XP${next ? ` — sonraki rütbeye ${next.min - p.xp} XP` : ""}</div>

      <div class="stat-grid">
        <div class="stat"><div class="stat-v">${p.games}</div><div class="stat-l">Oyun</div></div>
        <div class="stat"><div class="stat-v">${p.wins}</div><div class="stat-l">Kazanma</div></div>
        <div class="stat"><div class="stat-v">${p.bestScore}</div><div class="stat-l">En yüksek</div></div>
        <div class="stat"><div class="stat-v">🔥${p.bestStreak}</div><div class="stat-l">En iyi seri</div></div>
        <div class="stat"><div class="stat-v">%${acc}</div><div class="stat-l">Doğru oranı</div></div>
        <div class="stat"><div class="stat-v">${p.totalCorrect}</div><div class="stat-l">Doğru cevap</div></div>
      </div>

      <div class="players-title">Rozetler (${badgeCount}/${ACHIEVEMENTS.length})</div>
      <div class="badge-grid">${badgeGrid}</div>
      <div class="players-title">Rütbeler</div>
      <div class="rank-ladder">${ladder}</div>
      <div class="players-title">Son Oyunlar</div>
      <div class="leaderboard">${hist}</div>
      <button class="mini-btn danger" id="resetProf">Rekorları sıfırla</button>
    </div>`;
  document.getElementById("back").onclick = renderHome;
  document.getElementById("pname").onchange = (e) => setName(e.target.value.trim());
  document.getElementById("resetProf").onclick = () => {
    if (confirm("Tüm rekorların ve rütben sıfırlansın mı?")) {
      try { localStorage.removeItem("bnb_profile"); } catch (e) {}
      renderProfile();
    }
  };
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

function avatarPickerHtml() {
  const p = loadProfile();
  const cur = p.avatar || "🙂";
  return `<div class="avatar-picker" id="avpick">${AVATARS.map((a) => {
    const locked = !avatarUnlocked(a, p);
    const hint = locked ? AVATAR_LOCKS[a].hint : "";
    return `<button type="button" class="av-opt ${a === cur ? "sel" : ""} ${locked ? "locked" : ""}" data-av="${a}" ${locked ? `data-locked="1" title="Kilitli: ${esc(hint)}"` : ""}>${locked ? "🔒" : a}</button>`;
  }).join("")}</div>`;
}
function bindAvatarPicker() {
  const wrap = document.getElementById("avpick");
  if (!wrap) return;
  wrap.querySelectorAll(".av-opt").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.locked) { showCharacter("mc", "Bu avatar kilitli: " + (AVATAR_LOCKS[b.dataset.av].hint)); return; }
      setAvatar(b.dataset.av);
      wrap.querySelectorAll(".av-opt").forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel");
      sfx.click();
    };
  });
}

function renderHostSetup() {
  const prof = loadProfile();
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
      <input class="input" id="hostName" placeholder="Sunucu adı" maxlength="16" value="${esc(prof.name || "Sunucu")}">

      <label class="field-label">Avatarın</label>
      ${avatarPickerHtml()}

      <label class="field-label">Takım adı</label>
      <input class="input" id="teamName" placeholder="Takımının adı" maxlength="20" value="Takımım">

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

      <label class="field-label">Oyun Ayarları</label>
      <label class="toggle-chip"><input type="checkbox" id="setHostPlays" checked> <span>🙋 Ben de oynayacağım (oda kuran da cevaplasın)</span></label>
      <label class="toggle-chip"><input type="checkbox" id="setSpeedBonus" checked> <span>⚡ Hız bonusu (erken cevap = çok puan)</span></label>
      <label class="toggle-chip"><input type="checkbox" id="setWrongPenalty"> <span>➖ Yanlışta ceza (−250 puan)</span></label>
      <label class="toggle-chip"><input type="checkbox" id="setApproval"> <span>🛡️ Katılım onayı (lider onaylasın)</span></label>
      <label class="toggle-chip"><input type="checkbox" id="setTeamAvg"> <span>⚖️ Takım puanı ortalamayla (eşit olmayan takımlar için adil)</span></label>

      <div class="team-hint">💡 İki oda kurup liderler birbirine <b>meydan okursa</b> takımlar yarışır. Meydan okuma butonu lobide.</div>
      <button class="btn btn-primary btn-big" id="create">Odayı Oluştur</button>
    </div>`;

  document.getElementById("back").onclick = renderHome;
  bindAvatarPicker();
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
    const settings = {
      hostPlays: document.getElementById("setHostPlays").checked,
      speedBonus: document.getElementById("setSpeedBonus").checked,
      wrongPenalty: document.getElementById("setWrongPenalty").checked,
      requireApproval: document.getElementById("setApproval").checked,
      teamAvg: document.getElementById("setTeamAvg").checked,
      teamName: document.getElementById("teamName").value.trim(),
    };
    setName(name);
    const btn = document.getElementById("create");
    btn.disabled = true; btn.textContent = "Oluşturuluyor...";
    try {
      await createRoom(selected, count, state.setupDifficulty, name, settings);
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
      <input class="input" id="name" placeholder="Takma adın" maxlength="16" value="${esc(loadProfile().name || "")}">
      <label class="field-label">Avatarın</label>
      ${avatarPickerHtml()}
      ${prefillError ? `<p class="error">${esc(prefillError)}</p>` : ""}
      <button class="btn btn-primary btn-big" id="join">Katıl</button>
    </div>`;
  document.getElementById("back").onclick = renderHome;
  bindAvatarPicker();
  const codeEl = document.getElementById("code");
  codeEl.oninput = () => (codeEl.value = codeEl.value.toUpperCase());
  const nameEl = document.getElementById("name");
  if (prefillCode) nameEl.focus();
  document.getElementById("join").onclick = async () => {
    const code = codeEl.value.trim();
    const name = nameEl.value.trim();
    if (code.length < 4) { alert("Oda kodunu gir."); return; }
    if (!name) { alert("Bir ad gir."); return; }
    setName(name);
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

  const m = state.room.meta;
  const requests = Object.entries(state.room.requests || {});
  const requestsHtml = (m.requireApproval && requests.length) ? `
    <div class="players-title">Katılım talepleri (${requests.length})</div>
    <div class="requests">
      ${requests.map(([pid, r]) => `
        <div class="req-row">
          <span class="req-name">${esc(r.name)}</span>
          <span class="req-actions">
            <button class="mini-btn ok" data-approve="${pid}">✓ Onayla</button>
            <button class="mini-btn danger" data-reject="${pid}">✗</button>
          </span>
        </div>`).join("")}
    </div>` : "";

  // Meydan okuma durumu
  const incoming = m.challengeFrom;
  let challengeHtml = "";
  if (m.teamMode) {
    challengeHtml = `<div class="challenge-box pending">⚔️ Düello kuruldu: <b>${esc(m.teamAName)}</b> vs <b>${esc(m.teamBName)}</b></div>`;
  } else if (incoming) {
    challengeHtml = `
      <div class="challenge-box incoming">
        <div><b>${esc(incoming.teamName)}</b> takımı meydan okuyor! ⚔️</div>
        <div class="share-actions">
          <button class="btn btn-primary" id="accept">Kabul Et</button>
          <button class="btn btn-secondary" id="decline">Reddet</button>
        </div>
      </div>`;
  } else if (m.challengeStatus === "sent") {
    challengeHtml = `<div class="challenge-box pending">⏳ Meydan okuma gönderildi, yanıt bekleniyor...</div>`;
  } else if (m.challengeStatus === "declined") {
    challengeHtml = `
      <div class="challenge-box declined">Meydan okuma reddedildi.</div>
      <button class="btn btn-secondary" id="challengeBtn">⚔️ Tekrar Meydan Oku</button>`;
  } else {
    challengeHtml = `<button class="btn btn-secondary" id="challengeBtn">⚔️ Başka Takıma Meydan Oku</button>`;
  }

  APP.innerHTML = `
    <div class="card">
      <div class="lobby-head">
        <div>
          <div class="muted small">Oda Kodu · ${esc(m.teamName)}</div>
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
      ${requestsHtml}
      ${challengeHtml}
      <div class="players-title">Katılanlar (<span id="pcount">${players.length}</span>)</div>
      ${teamListHtml(players, m, true)}
      <button class="btn btn-primary btn-big" id="start" ${players.length ? "" : "disabled"}>
        ${m.teamMode ? "Düelloyu Başlat" : "Başlat"} (${m.totalQuestions} soru)
      </button>
    </div>`;
  document.getElementById("start").onclick = () => { sfx.click(); hostStartGame(); };
  document.getElementById("close").onclick = hostCloseRoom;
  APP.querySelectorAll("[data-approve]").forEach((b) => b.onclick = () => approveRequest(b.dataset.approve));
  APP.querySelectorAll("[data-reject]").forEach((b) => b.onclick = () => rejectRequest(b.dataset.reject));
  APP.querySelectorAll("[data-kick]").forEach((b) => b.onclick = () => hostKick(b.dataset.kick));
  const chBtn = document.getElementById("challengeBtn");
  if (chBtn) chBtn.onclick = hostSendChallenge;
  const accBtn = document.getElementById("accept");
  if (accBtn) accBtn.onclick = hostAcceptChallenge;
  const decBtn = document.getElementById("decline");
  if (decBtn) decBtn.onclick = hostDeclineChallenge;
  document.getElementById("copyLink").onclick = async () => {
    try { await navigator.clipboard.writeText(url); document.getElementById("copyLink").textContent = "✓ Kopyalandı"; }
    catch (e) { prompt("Linki kopyala:", url); }
  };
  document.getElementById("shareLink").onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Ben Bildim", text: `Oda kodu: ${state.code}`, url }); } catch (e) {} }
    else { try { await navigator.clipboard.writeText(url); alert("Link kopyalandı: " + url); } catch (e) { prompt("Link:", url); } }
  };
}

function renderPlayerChips(players, kickable) {
  if (!players.length) return `<div class="muted small">Henüz kimse yok...</div>`;
  return players.map(([id, p]) => `<div class="player-chip">
      <span class="pchip-av">${esc(p.avatar || "🙂")}</span>${esc(p.name)}
      ${kickable && id !== "host" ? `<button class="kick-btn" data-kick="${id}" title="At">×</button>` : ""}
    </div>`).join("");
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
  const m = state.room.meta || {};
  const me = (state.room.players || {})[state.playerId] || {};
  const teamName = m.teamMode ? (me.team === "B" ? m.teamBName : m.teamAName) : m.teamName;
  APP.innerHTML = `
    <div class="card center">
      <div class="logo small">Ben Bildim 🧠</div>
      <div class="join-badge">✓ Katıldın</div>
      <p class="big-name">${esc(state.name)}</p>
      ${teamName ? `<div class="team-badge team${me.team === "B" ? "B" : "A"}">Takım: ${esc(teamName)}</div>` : ""}
      <div class="spinner"></div>
      <p class="muted">${m.teamMode ? "Düellonun başlaması bekleniyor..." : "Sunucunun oyunu başlatması bekleniyor..."}</p>
      <div class="muted small">Oda: ${esc(state.code)}</div>
    </div>`;
}

function renderPendingApproval() {
  state.currentView = "pending";
  APP.innerHTML = `
    <div class="card center">
      <div class="logo small">Ben Bildim 🧠</div>
      <p class="big-name">${esc(state.name)}</p>
      <div class="spinner"></div>
      <p class="muted">Katılım talebin gönderildi.<br>Takım liderinin onayı bekleniyor...</p>
      <div class="muted small">Oda: ${esc(state.code)}</div>
      <button class="mini-btn" id="cancel">Vazgeç</button>
    </div>`;
  const c = document.getElementById("cancel");
  if (c) c.onclick = resetToHome;
}

function renderRejected() {
  state.currentView = "rejected";
  APP.innerHTML = `
    <div class="card center">
      <div class="logo small">Ben Bildim 🧠</div>
      <h2>Katılım reddedildi</h2>
      <p class="muted">Takım lideri katılımını onaylamadı.</p>
      <button class="btn btn-primary btn-big" id="home">Ana Sayfa</button>
    </div>`;
  document.getElementById("home").onclick = resetToHome;
}

function renderKicked() {
  APP.innerHTML = `
    <div class="card center">
      <div class="logo small">Ben Bildim 🧠</div>
      <h2>Odadan çıkarıldın</h2>
      <p class="muted">Takım lideri seni odadan çıkardı.</p>
      <button class="btn btn-primary btn-big" id="home">Ana Sayfa</button>
    </div>`;
  document.getElementById("home").onclick = resetToHome;
}

function renderMigrating() {
  state.currentView = "migrating";
  APP.innerHTML = `
    <div class="card center">
      <div class="logo small">⚔️ Düello!</div>
      <div class="spinner"></div>
      <p class="muted">Takımın arenaya geçiyor...</p>
    </div>`;
}

// Oyuncuları takımlara göre listele (lobi)
function teamListHtml(players, m, kickable) {
  if (!m.teamMode) {
    return `<div class="players" id="playerList">${renderPlayerChips(players, kickable)}</div>`;
  }
  const A = players.filter(([, p]) => (p.team || "A") === "A");
  const B = players.filter(([, p]) => p.team === "B");
  return `<div class="team-cols">
    <div class="team-col">
      <div class="team-h teamA">${esc(m.teamAName || "Takım A")} (${A.length})</div>
      ${renderPlayerChips(A, kickable)}
    </div>
    <div class="team-col">
      <div class="team-h teamB">${esc(m.teamBName || "Takım B")} (${B.length})</div>
      ${renderPlayerChips(B, kickable)}
    </div>
  </div>`;
}

// Takım toplam (veya ortalama) puanları
function teamTotals() {
  const sums = { A: 0, B: 0 }, counts = { A: 0, B: 0 };
  for (const [, p] of playersList()) {
    const team = p.team === "B" ? "B" : "A";
    sums[team] += p.score || 0;
    counts[team] += 1;
  }
  if (state.room.meta && state.room.meta.teamAvg) {
    return {
      A: counts.A ? Math.round(sums.A / counts.A) : 0,
      B: counts.B ? Math.round(sums.B / counts.B) : 0,
    };
  }
  return sums;
}

function teamScoreHtml() {
  const m = state.room.meta;
  const t = teamTotals();
  const aLead = t.A >= t.B;
  return `<div class="team-score">
    <div class="ts-side ${aLead ? "lead" : ""}">
      <div class="ts-name teamA">${esc(m.teamAName || "Takım A")}</div>
      <div class="ts-val">${t.A}</div>
    </div>
    <div class="ts-vs">VS</div>
    <div class="ts-side ${!aLead ? "lead" : ""}">
      <div class="ts-name teamB">${esc(m.teamBName || "Takım B")}</div>
      <div class="ts-val">${t.B}</div>
    </div>
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
  const hostPlays = m.hostPlays;
  const answered = hostPlays && state.answeredIndex === i;
  const hidden = hostPlays ? (myFiftyHidden(i) || []) : [];
  const jok = hostPlays ? myJokers() : { fifty: 0, double: 0 };
  const doubleOn = hostPlays ? myDoubleActive(i) : false;
  const alreadyAnswered = state.room.answers && state.room.answers[i]
    ? Object.keys(state.room.answers[i]).length : 0;

  const opts = pq.options.map((o, idx) => {
    if (hostPlays) {
      const chosen = answered && state.playerChoice === idx ? "opt-chosen" : "";
      return `<button class="opt opt-btn ${hidden.includes(idx) ? "opt-hidden" : ""} ${chosen}" data-choice="${idx}" style="background:${OPTION_STYLES[idx].color}" ${answered ? "disabled" : ""}>
        <span class="opt-shape">${OPTION_STYLES[idx].shape}</span>
        <span class="opt-text">${esc(o)}</span>
      </button>`;
    }
    return `<div class="opt opt-host" style="background:${OPTION_STYLES[idx].color}">
      <span class="opt-shape">${OPTION_STYLES[idx].shape}</span>
      <span class="opt-text">${esc(o)}</span>
    </div>`;
  }).join("");

  const jokersHtml = (hostPlays && !answered) ? `
    <div class="jokers" id="jokers">
      <button class="joker-btn" id="jFifty" ${jok.fifty > 0 && !hidden.length ? "" : "disabled"}>➗ 50:50 (${jok.fifty})</button>
      <button class="joker-btn ${doubleOn ? "active" : ""}" id="jDouble" ${jok.double > 0 && !doubleOn ? "" : "disabled"}>✖️ Çift Puan (${doubleOn ? "aktif" : jok.double})</button>
    </div>` : "";
  const answeredNote = (hostPlays && answered) ? `<div class="host-answered-note">✓ Cevabın alındı — diğerleri bekleniyor</div>` : "";

  APP.innerHTML = `
    <div class="card question-card">
      <div class="q-top">
        <span class="q-progress">Soru ${i + 1}/${m.totalQuestions}</span>
        ${catBadge(pq.category)}
      </div>
      ${timerBarHTML()}
      ${visualHTML(pq)}
      <div class="q-text">${esc(pq.q)}</div>
      <div class="answered-count"><span id="answeredCount">${alreadyAnswered}</span>/${players.length} yanıtladı</div>
      <div class="options">${opts}</div>
      ${jokersHtml}
      ${answeredNote}
      <button class="btn btn-secondary" id="skip">Herkes yanıtladı, göster ›</button>
    </div>`;

  if (hostPlays && !answered) {
    APP.querySelectorAll(".opt-btn").forEach((b) => {
      b.onclick = () => {
        if (b.classList.contains("opt-hidden")) return;
        hostAnswer(parseInt(b.dataset.choice, 10));
      };
    });
    const jf = document.getElementById("jFifty");
    const jd = document.getElementById("jDouble");
    if (jf) jf.onclick = () => hostSelfJoker("fifty");
    if (jd) jd.onclick = () => hostSelfJoker("double");
  }
  document.getElementById("skip").onclick = () => maybeReveal(i);
  runCountdown(() => {
    state.hostLocalStart = Date.now();
    sfx.whoosh();
    startTicker();
  });
}

// Oda kuran da oynadığında: kendi cevabını doğrudan (yetkili) işler
function hostAnswer(choice) {
  const m = state.room.meta;
  if (!m.hostPlays) return;
  const i = m.questionIndex;
  if (state.answeredIndex === i || state.inCountdown) return;
  const elapsed = Date.now() - state.hostLocalStart;
  state.lastElapsed = elapsed;
  state.answeredIndex = i;
  state.playerChoice = choice;
  // UI: seçili şıkkı işaretle, diğerlerini kilitle, jokerleri kaldır
  APP.querySelectorAll(".opt-btn").forEach((b) => {
    b.disabled = true;
    if (parseInt(b.dataset.choice, 10) === choice) b.classList.add("opt-chosen");
  });
  const jk = document.getElementById("jokers");
  if (jk) jk.remove();
  const card = APP.querySelector(".card");
  if (card && !card.querySelector(".host-answered-note")) {
    const note = document.createElement("div");
    note.className = "host-answered-note";
    note.textContent = "✓ Cevabın alındı — diğerleri bekleniyor";
    card.appendChild(note);
  }
  // Yetkili kayıt + herkes-yanıtladı kontrolü
  hostOnInput({ type: "answer", pid: "host", i, choice, elapsed });
}

function hostSelfJoker(kind) {
  const m = state.room.meta;
  if (!m.hostPlays) return;
  const i = m.questionIndex;
  if (state.answeredIndex === i || state.inCountdown) return;
  hostOnInput({ type: "joker", pid: "host", kind, i });
  sfx.joker();
  // Host kendi joker UI'sini güncelle
  const hidden = myFiftyHidden(i) || [];
  hidden.forEach((idx) => {
    const b = APP.querySelector(`.opt-btn[data-choice="${idx}"]`);
    if (b) b.classList.add("opt-hidden");
  });
  const jok = myJokers();
  const on = myDoubleActive(i);
  const jf = document.getElementById("jFifty");
  const jd = document.getElementById("jDouble");
  if (jf) jf.disabled = !(jok.fifty > 0 && !hidden.length);
  if (jd) { jd.classList.toggle("active", on); jd.textContent = `✖️ Çift Puan (${on ? "aktif" : jok.double})`; jd.disabled = !(jok.double > 0 && !on); }
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
    // Son 5 saniyede gerilim tıkırtısı
    const secLeft = Math.ceil(remaining);
    if (tickEnabled() && secLeft <= 5 && secLeft >= 1 && secLeft !== state.lastTickSec &&
        state.answeredIndex !== m.questionIndex) {
      state.lastTickSec = secLeft; sfx.tick();
    }
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
  const teamMode = state.room.meta && state.room.meta.teamMode;
  const players = playersList().sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  const rows = players.slice(0, limit || players.length).map(([id, p], idx) => {
    const isMe = id === state.playerId;
    const fire = (p.streak || 0) >= 2 ? ` 🔥${p.streak}` : "";
    const dot = teamMode ? `<span class="team-dot team${p.team === "B" ? "B" : "A"}"></span>` : "";
    return `<div class="lb-row ${isMe ? "me" : ""}">
      <span class="lb-rank">${idx + 1}</span>
      <span class="lb-name">${dot}<span class="lb-av">${esc(p.avatar || "🙂")}</span>${esc(p.name)}${isMe ? " (sen)" : ""}${fire}</span>
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
  const meHost = m.hostPlays ? state.room.players["host"] : null;
  let hostBanner = "";
  if (meHost) {
    if (meHost.lastCorrect) hostBanner = `<div class="host-result good">Senin cevabın: ✓ Doğru +${meHost.lastGain || 0}${(meHost.lastStreak || 0) >= 2 ? ` 🔥${meHost.lastStreak}` : ""}</div>`;
    else hostBanner = `<div class="host-result bad">Senin cevabın: ✗ Yanlış${(meHost.lastGain || 0) < 0 ? ` ${meHost.lastGain}` : ""}</div>`;
  }
  APP.innerHTML = `
    <div class="card">
      <div class="q-top"><span class="q-progress">Soru ${i + 1}/${m.totalQuestions}</span></div>
      ${visualHTML(state.room.publicQuestions[i])}
      <div class="q-text small">${esc(q.q)}</div>
      <div class="options reveal">${opts}</div>
      ${hostBanner}
      ${m.teamMode ? teamScoreHtml() : ""}
      <div class="players-title">Skor Tablosu</div>
      ${leaderboardHTML(5)}
      <button class="btn btn-primary btn-big" id="next">${isLast ? "Sonuçları Göster 🏆" : "Sıradaki Soru ›"}</button>
    </div>`;
  document.getElementById("next").onclick = () => { sfx.click(); hostNext(); };
  sfx.whoosh();
  if (meHost) tallyGameStat(meHost.lastCorrect, meHost.lastStreak || 0);
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
      ${correct ? `<div class="gain">+${gain} puan</div>${breakdown}` : (gain < 0 ? `<div class="gain" style="color:#e21b3c">${gain} puan</div>` : `<div class="gain muted">+0 puan</div>`)}
      ${correct && streak >= 2 ? `<div class="streak-fire">🔥 ${streak} seri!</div>` : ""}
      ${state.room.meta.teamMode ? teamScoreHtml() : `<div class="rank-box">
        <div>Sıralaman</div>
        <div class="rank-num">${myRank}. / ${players.length}</div>
        <div class="muted small">Toplam: ${me.score || 0} puan</div>
      </div>`}
    </div>`;
  if (correct) { sfx.correct(); if (streak >= 2) setTimeout(() => sfx.streak(), 350); }
  else sfx.wrong();
  tallyGameStat(correct, streak);
}

// Yerel oyuncunun oyun-içi istatistiğini biriktir (rekorlar + karakterler için)
function tallyGameStat(correct, streak) {
  if (!state.gameStats) state.gameStats = { correct: 0, questions: 0, maxStreak: 0, wrongStreak: 0 };
  const gs = state.gameStats;
  gs.questions += 1;
  if (correct) {
    gs.correct += 1; gs.wrongStreak = 0;
    const el = state.lastElapsed || 0;
    if (el > 0 && (gs.fastMs === 0 || el < gs.fastMs)) gs.fastMs = el;
  } else gs.wrongStreak += 1;
  if ((streak || 0) > gs.maxStreak) gs.maxStreak = streak;
  maybeShowCharacter(correct, streak || 0);
}

// Oyun aşamasına göre karakter göster (konuşma balonu)
let charTimer = null;
function showCharacter(id, phraseOverride) {
  const c = CHARACTERS[id];
  if (!c) return;
  const existing = document.getElementById("charPop");
  if (existing) existing.remove();
  clearTimeout(charTimer);
  const phrase = phraseOverride || pickPhrase(id, Math.floor(Math.random() * 999));
  const el = document.createElement("div");
  el.id = "charPop";
  el.className = "char-pop";
  el.innerHTML = `<div class="char-bubble">${esc(phrase)}</div><div class="char-emoji">${c.emoji}</div>`;
  document.body.appendChild(el);
  sfx.joker();
  charTimer = setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 3200);
}

function maybeShowCharacter(correct, streak) {
  const m = state.room.meta;
  const gs = state.gameStats || {};
  const limit = (m.timeLimit || 20) * 1000;
  const el = state.lastElapsed || 0;
  let id = null, phrase = null;
  if (correct && streak >= 3) id = "fire";
  else if (!correct && gs.wrongStreak >= 3) id = "nervous";
  else if (correct && el > 0 && el < 2500) id = "rocket";
  else if (correct && el >= limit * 0.85) id = "turtle";

  // Performans karakteri yoksa: ara sıra takım atışması / kategori esprisi
  if (!id && Math.random() < 0.45) {
    if (m.teamMode) {
      const t = teamTotals();
      const localPid = state.role === "host" ? "host" : state.playerId;
      const meP = (state.room.players || {})[localPid];
      const myTeam = meP && meP.team === "B" ? "B" : "A";
      const other = myTeam === "A" ? "B" : "A";
      if (t[myTeam] > t[other]) id = "taunt";
      else if (t[myTeam] < t[other]) id = "cheer";
    }
    if (!id) {
      const i = m.questionIndex;
      const cat = state.room.publicQuestions[i] && state.room.publicQuestions[i].category;
      const quips = CATEGORY_QUIPS[cat];
      if (quips && quips.length) { id = "mc"; phrase = quips[Math.floor(Math.random() * quips.length)]; }
    }
  }
  if (id) showCharacter(id, phrase);
}

// Rozet kazanıldı bildirimi
function showBadge(a) {
  const el = document.createElement("div");
  el.className = "badge-pop";
  el.innerHTML = `<div class="badge-emoji">${a.emoji}</div><div class="badge-txt"><div class="badge-t">🎖️ Rozet kazandın!</div><div class="badge-n">${esc(a.name)}</div></div>`;
  document.body.appendChild(el);
  sfx.streak();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 3200);
}

function renderEnded() {
  const m = state.room.meta;
  const players = playersList().sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  const podium = players.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  const podiumHTML = podium.map(([id, p], idx) =>
    `<div class="podium-item p${idx}">
      <div class="medal">${medals[idx]}</div>
      <div class="podium-name">${esc(p.name)}</div>
      <div class="podium-score">${p.score || 0}</div>
    </div>`).join("");

  let headerHtml;
  if (m.teamMode) {
    const t = teamTotals();
    const draw = t.A === t.B;
    const winTeam = t.A > t.B ? (m.teamAName || "Takım A") : (m.teamBName || "Takım B");
    headerHtml = `
      <div class="logo small">🏆 Düello Bitti!</div>
      <p class="winner-line">${draw ? "Berabere! 🤝" : `Kazanan takım: <b>${esc(winTeam)}</b> 🎉`}</p>
      ${teamScoreHtml()}`;
  } else {
    const winner = players[0];
    headerHtml = `
      <div class="logo small">🏆 Oyun Bitti!</div>
      ${winner ? `<p class="winner-line">Kazanan: <b>${esc(winner[1].name)}</b></p>` : ""}
      <div class="podium">${podiumHTML}</div>`;
  }

  // Yerel katılımcının rekorlarını güncelle + XP/rütbe özeti
  const xpSummary = recordLocalResult(m, players);

  APP.innerHTML = `
    <div class="card center">
      ${headerHtml}
      ${xpSummary}
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

// Oyun sonunda yerel oyuncunun rekorunu işler, XP/rütbe özeti HTML'i döndürür
function recordLocalResult(m, sortedPlayers) {
  const localPid = state.role === "host" ? (m.hostPlays ? "host" : null) : state.playerId;
  if (!localPid || state.recorded) return "";
  const meP = (state.room.players || {})[localPid];
  if (!meP) return "";
  state.recorded = true;
  const myRank = sortedPlayers.findIndex(([id]) => id === localPid) + 1;
  let won;
  if (m.teamMode) {
    const t = teamTotals();
    const myTeam = meP.team === "B" ? "B" : "A";
    won = t[myTeam] > t[myTeam === "A" ? "B" : "A"];
  } else {
    won = myRank === 1;
  }
  const gs = state.gameStats || { correct: 0, questions: 0, maxStreak: 0, fastMs: 0 };
  const perfect = gs.questions > 0 && gs.correct === gs.questions;
  const res = recordGame({
    score: meP.score || 0, won,
    streak: gs.maxStreak || 0, correct: gs.correct || 0, questions: gs.questions || 0,
    perfect, fastMs: gs.fastMs || 0,
    rank: myRank, players: sortedPlayers.length, team: !!m.teamMode, time: Date.now(),
  });
  // Günlük görevleri güncelle (tamamlananların XP'si eklenir)
  const dailyDone = updateDailyAfterGame({
    correct: gs.correct || 0, won, perfect, team: !!m.teamMode, maxStreak: gs.maxStreak || 0,
  });
  const questXp = dailyDone.reduce((s, q) => s + q.xp, 0);

  // Haftalık lig: bu haftanın XP toplamına ekle ve yayınla
  const wk = weekId();
  const pr = loadProfile();
  pr.weekly = pr.weekly && pr.weekly.week === wk ? pr.weekly : { week: wk, xp: 0 };
  pr.weekly.xp += (res.gainedXp || 0) + questXp;
  // profile.js saveProfile'a doğrudan erişimimiz yok; kalıcılık için localStorage'a yaz
  try { localStorage.setItem("bnb_profile", JSON.stringify(pr)); } catch (e) {}

  // Bildirimler: rozetler + tamamlanan görevler
  (res.newBadges || []).forEach((a, i) => setTimeout(() => showBadge(a), 1600 + i * 1400));
  dailyDone.forEach((q, i) => setTimeout(() => showBadge({ emoji: "✅", name: `Görev: ${q.text} (+${q.xp} XP)` }), 1600 + ((res.newBadges || []).length + i) * 1400));
  state.statsInit = false; // sonraki oyun için sıfırla

  // Global şöhret salonu + haftalık lig yayını (en iyi çaba)
  try {
    publishHof(pr.deviceId, {
      name: pr.name || "Misafir", avatar: pr.avatar || "🙂",
      xp: pr.xp, best: pr.bestScore, rank: rankFor(pr.xp).name, games: pr.games, ts: Date.now(),
    });
    publishLeague(wk, pr.deviceId, { name: pr.name || "Misafir", avatar: pr.avatar || "🙂", xp: pr.weekly.xp, ts: Date.now() });
  } catch (e) {}

  // Oyun sonu karakteri (yerel katılımcıya özel)
  let cid = null;
  if (won) cid = "crown";
  else if (gs.questions && gs.correct === gs.questions) cid = "prof";
  else if (gs.questions && gs.correct === 0) cid = "clown";
  else if (gs.questions && gs.correct / gs.questions >= 0.8) cid = "owl";
  if (cid) setTimeout(() => showCharacter(cid), 900);

  const { cur, next, pct } = rankProgress(pr.xp);
  return `
    <div class="xp-summary">
      <div class="xp-gain">+${res.gainedXp}${questXp ? ` (+${questXp} görev)` : ""} XP</div>
      ${res.leveledUp ? `<div class="levelup">🎉 Rütbe atladın: ${res.newRank.emoji} ${esc(res.newRank.name)}!</div>` : ""}
      <div class="xp-rank">${cur.emoji} ${esc(cur.name)}</div>
      <div class="pc-bar"><span class="pc-fill" style="width:${pct}%"></span></div>
      <div class="muted small">${pr.xp} XP${next ? ` — sonraki: ${next.emoji} ${esc(next.name)} (${next.min - pr.xp} XP)` : " • En yüksek rütbe"}</div>
    </div>`;
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
    inCountdown: false, pendingApproval: false, migrating: false, awaitingArena: false,
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
    sendInput(saved.code, { type: "join", pid: state.playerId, name: state.name, avatar: loadProfile().avatar || "🙂" });
    render();
  }
}

function boot() {
  applyTheme(currentTheme());
  ensureDaily();
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
