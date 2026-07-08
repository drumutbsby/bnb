# Ben Bildim 🧠 — Çok Oyunculu Bilgi Yarışması

Kahoot tarzı, çoktan seçmeli bir bilgi yarışması. Bir kişi **oda kurar**, herkes
kendi telefonundan **oda koduyla katılır**, sorular herkese aynı anda gelir, hızlı
ve doğru cevap veren çok puan alır, sonunda **skor tablosu** ve **podyum** gösterilir.

- ✅ **Kurulum yok** — hiçbir hesap, anahtar veya yapılandırma gerekmez
- 12 kategori, 120+ Türkçe soru — **görsel sorular** dahil (Bayraklar, Emoji Bilmece)
- **Kendi Sorularım**: kendi soru setini yaz, JSON ile içe/dışa aktar
- Gerçek zamanlı çok oyunculu (herkese açık MQTT-over-WebSocket üzerinden)
- **Oda kuran da oynayabilir**; hız bazlı puanlama, **seri bonusu**, **jokerler**
  (50:50, Çift Puan), **zorluk** seviyeleri, yanlışta ceza seçeneği
- **Takım düellosu**: iki oda birbirine meydan okur, takımlar yarışır; **katılım onayı**
- **Rütbe & rekorlar**: cihazda kalıcı profil, XP ile rütbe atlama, en iyi puan/seri
- **Atmosfer**: ses efektleri, 3-2-1 geri sayımı, konfeti; **QR kod** ile kolay katılım
- Derleme/bağımlılık yok — saf statik site, doğrudan GitHub Pages'te çalışır; mobil öncelikli

---

## 🚀 Canlıya alma (tek adım)

Bu repo, `.github/workflows/pages.yml` ile **otomatik** deploy edecek şekilde
ayarlıdır. Tek yapman gereken GitHub Pages'i açmak:

1. GitHub'da repoya git → **Settings → Pages**.
2. **Build and deployment → Source** kısmında **"GitHub Actions"** seç.
3. `main`'e (veya bu geliştirme dalına) her push'ta site otomatik yayınlanır.
   Adres: `https://<kullanıcı-adın>.github.io/bnb/`

> **Alternatif:** Settings → Pages → Source → *Deploy from a branch* → `main` /
> `/ (root)` da seçebilirsin; sonuç aynı.

Yayınlandıktan sonra: telefondan siteyi aç → **Oda Kur** → çıkan **4 haneli kodu**
arkadaşlarına söyle → onlar aynı siteden **Odaya Katıl** deyip kodu girsin → herkes
lobide görününce **Başlat**. Hepsi bu — başka hiçbir kurulum yok.

---

## 🎮 Nasıl Oynanır

- **Sunucu (host):** Oda kurar; kategori, soru sayısı ve süre seçer. Sorular ve doğru
  cevaplar sunucu ekranında gösterilir — bu ekranı herkesin görebileceği bir yere
  (TV/projeksiyon) yansıtmak en iyisidir.
- **Oyuncular:** Kendi telefonlarından kodla katılır, şıklara telefonlarından dokunur.
  Ne kadar hızlı doğru cevap → o kadar çok puan.
- **Puanlama:** Doğru cevap **500–1000** puan (hız bonusu dahil), yanlış/boş **0**.
- Her sorudan sonra skor tablosu, oyun sonunda podyum gösterilir.

---

## ⚙️ Nasıl çalışıyor? (teknik)

Oda mantığı **host-yetkili** bir modelle çalışır:

- Sunucu, oda durumunu (lobi, soru, sonuç, skorlar) herkese açık bir MQTT
  broker'ına *retained* mesaj olarak yayınlar. Bu sayede sonradan katılan oyuncular
  odanın güncel durumunu anında görür.
- Oyuncular yalnızca **girdi** (katıl / cevap) mesajı gönderir; puanlamayı ve akışı
  sunucu yürütür. Böylece cihazlar arasında saat farkı sorunu olmaz (her oyuncunun
  tepki süresi kendi cihazında ölçülür).

Varsayılan broker `wss://broker.emqx.io:8084/mqtt` (ücretsiz, herkese açık).
Kendi broker'ını kullanmak istersen tek satırı değiştirmen yeterli:
[`js/net.js`](js/net.js) içindeki `BROKER_URL`.

> Not: Herkese açık broker arkadaş grubu oyunları için gayet iyidir. Yoğun/kalıcı bir
> kullanım istersen kendi (ücretsiz) HiveMQ Cloud / EMQX Cloud broker'ını açıp
> `BROKER_URL`'i onunla değiştirebilirsin.

---

## 🗂️ Proje Yapısı

```
index.html            # Uygulama kabuğu
css/styles.css        # Stil (mobil öncelikli)
js/questions.js       # Soru bankası (kategoriler + sorular)
js/net.js             # Gerçek zamanlı katman (MQTT) — kurulumsuz
js/vendor/mqtt.esm.js # Vendor'lanmış MQTT istemcisi (harici CDN yok)
js/app.js             # Oyun mantığı (oda, akış, puanlama)
.github/workflows/pages.yml  # Otomatik GitHub Pages deploy
```

Yeni soru eklemek için `js/questions.js` içindeki ilgili kategoriye
`{ q, options, answer }` nesnesi ekle (`answer` = doğru şıkkın 0-tabanlı index'i).

---

## 💻 Yerelde deneme

Statik site olduğu için basit bir sunucu yeterli (ES modülleri `file://` ile çalışmaz):

```bash
python3 -m http.server 8000
# tarayıcıda: http://localhost:8000
```
