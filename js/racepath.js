// 🏁 Yarış Patikası — oyuncu avatarlarını puan ya da sıra RAKAMI göstermeden,
// o eldeki sıralamalarına göre kıvrımlı bir patika üzerinde gösterir.
// Lider oyun ilerledikçe bitiş bayrağına yaklaşır; diğerleri sıralarına göre
// geriden gelir. Reveal ekranında avatarlar eski yerlerinden yeni yerlerine
// kayarak ilerler (CSS transition); soru ekranındaki mini şeritte sabittir.
import { visualToHTML } from "./visuals.js";

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Patika geometrisi: t ∈ [0,1] → viewBox (0 0 100 H) içinde nokta.
// Sinüs kıvrımı; mini şeritte genlik küçüktür.
function pt(t, H, amp) {
  const x = 7 + 86 * t;
  const y = H / 2 - amp * Math.sin(t * 4.7 + 2.8);
  return [x, y];
}

// Son gösterilen konumlar (pid → t) — reveal'da "eskiden yeniye kayma" için.
// Modül belleği yeterli: sayfa yenilenirse avatarlar direkt yeni yerinde başlar.
const mem = { key: null, t: {} };

// o: { players:[[id,p],...], meId, progress(0..1), teamMode, mini, animKey }
// animKey verilirse ve daha önce oynatılmadıysa avatarlar eski konumdan
// yenisine kayar; aynı key ile tekrar render edilirse sabit durur.
export function raceTrackHTML(o) {
  const list = [...o.players].sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
  const N = list.length;
  if (!N) return "";
  const H = o.mini ? 24 : 44;
  const amp = o.mini ? 6 : 15;
  const head = 0.14 + 0.78 * Math.max(0, Math.min(1, o.progress || 0));
  const gap = N > 1 ? Math.min(0.13, (head - 0.04) / (N - 1)) : 0;
  const targets = {};
  list.forEach(([id], r) => { targets[id] = Math.max(0.04, head - r * gap); });

  const animate = !!o.animKey && o.animKey !== mem.key;
  const startT = animate ? mem.t : targets;
  if (o.animKey) mem.key = o.animKey;
  mem.t = { ...mem.t, ...targets };

  let poly = "";
  for (let i = 0; i <= 40; i++) {
    const [x, y] = pt(i / 40, H, amp);
    poly += (i ? " " : "") + x.toFixed(1) + "," + y.toFixed(1);
  }
  const [fx, fy] = pt(1, H, amp);
  const avs = list.map(([id, p], r) => {
    const t0 = startT[id] != null ? startT[id] : 0.04;
    const [x0, y0] = pt(t0, H, amp);
    const [x1, y1] = pt(targets[id], H, amp);
    const cls = "race-av" +
      (id === o.meId ? " me" : "") +
      (o.teamMode ? ` team${p.team === "B" ? "B" : "A"}` : "");
    return `<div class="${cls}" style="left:${x0.toFixed(2)}%;top:${((y0 / H) * 100).toFixed(2)}%;z-index:${100 - r}" data-x="${x1.toFixed(2)}" data-y="${((y1 / H) * 100).toFixed(2)}">
      <span class="race-em">${visualToHTML(p.avatar || "🙂")}</span>
      ${o.mini ? "" : `<span class="race-nm">${esc(String(p.name || "").slice(0, 10))}</span>`}
    </div>`;
  }).join("");
  return `<div class="race-track${o.mini ? " race-mini" : ""}${N > 8 ? " race-crowd" : ""}" style="aspect-ratio:100/${H}" aria-hidden="true">
    <svg viewBox="0 0 100 ${H}" preserveAspectRatio="none">
      <polyline class="race-line" points="${poly}" fill="none" stroke="currentColor" stroke-width="${o.mini ? 2 : 2.6}" stroke-dasharray="4.5 3.5" stroke-linecap="round"/>
    </svg>
    <span class="race-flag" style="left:${fx.toFixed(2)}%;top:${((fy / H) * 100).toFixed(2)}%">🏁</span>
    ${avs}
  </div>`;
}

// innerHTML yerleştikten sonra çağrılır: avatarları hedef konumlarına kaydırır.
// Çift rAF: tarayıcı başlangıç konumunu boyasın ki transition tetiklensin.
export function raceTrackStart() {
  const els = document.querySelectorAll(".race-av[data-x]");
  if (!els.length) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    els.forEach((el) => {
      el.style.left = el.dataset.x + "%";
      el.style.top = el.dataset.y + "%";
    });
  }));
}
