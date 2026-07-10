// Ses efektleri — Web Audio API ile üretilir (harici dosya/CDN yok).
// Mobil tarayıcılar sesi ilk kullanıcı dokunuşundan sonra açar; unlock() bunu sağlar.

let ctx = null;
let muted = false;
try { muted = localStorage.getItem("bnb_muted") === "1"; } catch (e) {}

function ensure() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { ctx = null; }
  }
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === "suspended") c.resume();
}

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem("bnb_muted", muted ? "1" : "0"); } catch (e) {}
  return muted;
}

// Tek bir ton çal (envelope'lu)
function tone(freq, start, dur, type = "sine", gain = 0.2) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function slide(f1, f2, start, dur, type = "sine", gain = 0.2) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f1, t0);
  osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  click() { tone(440, 0, 0.08, "triangle", 0.15); },
  join() { tone(660, 0, 0.1, "sine", 0.18); tone(880, 0.08, 0.12, "sine", 0.18); },
  whoosh() { slide(300, 900, 0, 0.25, "sawtooth", 0.12); },
  tick() { tone(1000, 0, 0.05, "square", 0.08); },
  countdown(n) {
    // 3-2-1 için giderek yükselen bip
    const base = 500 + (3 - n) * 120;
    tone(base, 0, 0.15, "triangle", 0.18);
  },
  go() { slide(600, 1200, 0, 0.3, "triangle", 0.2); },
  correct() {
    tone(660, 0, 0.12, "sine", 0.2);
    tone(880, 0.1, 0.12, "sine", 0.2);
    tone(1320, 0.2, 0.2, "sine", 0.2);
  },
  wrong() {
    tone(300, 0, 0.18, "sawtooth", 0.15);
    tone(200, 0.15, 0.25, "sawtooth", 0.15);
  },
  streak() {
    tone(880, 0, 0.08, "square", 0.15);
    tone(1100, 0.07, 0.08, "square", 0.15);
    tone(1400, 0.14, 0.12, "square", 0.15);
  },
  joker() { slide(900, 1500, 0, 0.18, "square", 0.14); },
  fanfare() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, i * 0.14, 0.3, "triangle", 0.2));
    tone(1047, 0.6, 0.5, "sine", 0.22);
  },
  // Reaction paketi sesleri (özgün, sentezlenmiş)
  airhorn() {
    for (let i = 0; i < 3; i++) {
      tone(440, i * 0.14, 0.11, "sawtooth", 0.18);
      tone(554, i * 0.14, 0.11, "square", 0.12);
    }
  },
  pop() { tone(700, 0, 0.05, "sine", 0.22); tone(1100, 0.05, 0.07, "sine", 0.18); },
  boing() { slide(700, 200, 0, 0.28, "sine", 0.18); },
  sad() {
    // "womp womp" — inen üçlü
    [415, 370, 311].forEach((f, i) => tone(f, i * 0.16, 0.22, "sawtooth", 0.14));
  },
};
