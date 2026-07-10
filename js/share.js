// Paylaşılabilir sonuç kartı — oyun sonunda skoru markalı bir PNG'ye çizer ve
// Web Share API ile paylaşır (desteklenmezse indirir). Kendi kendine yeter:
// canvas ile üretilir, dış istek/bağımlılık yok, çevrimdışı çalışır.

function roundRect(x, rx, ry, w, h, r, fill) {
  x.beginPath();
  x.moveTo(rx + r, ry);
  x.arcTo(rx + w, ry, rx + w, ry + h, r);
  x.arcTo(rx + w, ry + h, rx, ry + h, r);
  x.arcTo(rx, ry + h, rx, ry, r);
  x.arcTo(rx, ry, rx + w, ry, r);
  x.closePath();
  x.fillStyle = fill;
  x.fill();
}

export async function makeResultCardBlob(o) {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  // Arka plan (marka moru)
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#5b23a8"); g.addColorStop(1, "#7a2fd6");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.textAlign = "center";
  // Logo
  x.fillStyle = "#fff"; x.font = "800 66px sans-serif";
  x.fillText("🧠 Ben Bildim", W / 2, 160);
  // Beyaz kart
  roundRect(x, 90, 220, W - 180, 820, 44, "#ffffff");
  // Avatar
  x.font = "170px sans-serif"; x.fillText(o.avatar || "🙂", W / 2, 470);
  // İsim
  x.fillStyle = "#2b2540"; x.font = "800 62px sans-serif";
  x.fillText((o.name || "Oyuncu").slice(0, 18), W / 2, 560);
  // Alt başlık (mod / kazanma)
  if (o.subtitle) { x.fillStyle = "#7a2fd6"; x.font = "700 46px sans-serif"; x.fillText(o.subtitle.slice(0, 28), W / 2, 640); }
  // Skor
  x.fillStyle = "#2b2540"; x.font = "900 210px sans-serif"; x.fillText(String(o.score || 0), W / 2, 880);
  x.fillStyle = "#8a8398"; x.font = "600 48px sans-serif"; x.fillText("puan", W / 2, 940);
  // İstatistik satırı
  x.fillStyle = "#2b2540"; x.font = "700 50px sans-serif";
  x.fillText(`✅ ${o.correct || 0}/${o.total || 0} doğru  ·  %${o.acc || 0} isabet`, W / 2, 1010);
  // Alt bilgi
  x.fillStyle = "#fff"; x.font = "700 48px sans-serif"; x.fillText("Sen de oyna 👇", W / 2, H - 150);
  x.font = "600 42px sans-serif"; x.fillStyle = "#e7dcff";
  x.fillText("drumutbsby.github.io/bnb", W / 2, H - 85);
  return await new Promise((res) => c.toBlob(res, "image/png"));
}

// Kartı paylaş: Web Share (dosya) → yoksa indir. true = başarılı/iptal.
export async function shareResultCard(o) {
  let blob;
  try { blob = await makeResultCardBlob(o); } catch (e) { return false; }
  if (!blob) return false;
  const file = new File([blob], "ben-bildim-sonuc.png", { type: "image/png" });
  const text = o.shareText || "Ben Bildim'de sonucum!";
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Ben Bildim", text });
      return true;
    } catch (e) { if (e && e.name === "AbortError") return true; /* diğer hatada indirmeye düş */ }
  }
  // Yedek: PNG indir
  try {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u; a.download = "ben-bildim-sonuc.png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
    return true;
  } catch (e) { return false; }
}
