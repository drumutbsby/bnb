# Ben Bildim 🧠 — Çok Oyunculu Bilgi Yarışması

Kahoot tarzı, çoktan seçmeli bir bilgi yarışması oyunu. Bir kişi **oda kurar**,
herkes kendi telefonundan **oda koduyla katılır**, sorular herkese aynı anda
gelir, hızlı ve doğru cevap veren çok puan alır, sonunda **skor tablosu** ve
**podyum** gösterilir.

- 10 kategori, 100+ Türkçe soru (Genel Kültür, Tarih, Coğrafya, Bilim, Spor,
  Sanat, Sinema & Müzik, Teknoloji, Türkiye, Hayvanlar)
- Gerçek zamanlı çok oyunculu (Firebase Realtime Database)
- Kurulum/derleme gerektirmeyen statik site → GitHub Pages'te yayınlanır
- Mobil öncelikli arayüz

---

## 🚀 Hızlı Başlangıç (2 adım)

### 1) Firebase'i kur (ücretsiz, ~5 dakika)

Oyunun çok oyunculu çalışması için gerçek zamanlı bir veritabanı gerekir. Ücretsiz
Firebase yeterli:

1. https://console.firebase.google.com adresine gir, **"Proje ekle"** ile yeni
   bir proje oluştur (Google Analytics'i kapatabilirsin).
2. Sol menüden **Build → Realtime Database → "Veritabanı oluştur"**a tıkla.
   Bir konum seç ve **"Test modunda başlat"** seçeneğini işaretle.
   > Test modu geliştirme için idealdir. Kuralları herkese açık okuma/yazmaya
   > ayarlar; yayın için ileride kısıtlamak istersen aşağıdaki nota bak.
3. Proje ayarları (⚙️ → **Proje ayarları**) → **Genel** sekmesi → aşağı in →
   **"Uygulamalarınız"** altında web simgesine (**</>**) tıkla, bir takma ad ver.
4. Sana gösterilen `firebaseConfig` nesnesini kopyala ve
   [`js/firebase-config.js`](js/firebase-config.js) dosyasındaki alanların yerine
   yapıştır. Örnek:

   ```js
   export const firebaseConfig = {
     apiKey: "AIza....",
     authDomain: "benbildim-xxxx.firebaseapp.com",
     databaseURL: "https://benbildim-xxxx-default-rtdb.firebaseio.com",
     projectId: "benbildim-xxxx",
     storageBucket: "benbildim-xxxx.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef",
   };
   ```

   > `databaseURL` alanının dolu olması önemlidir. Firebase konsolunda config'te
   > görünmüyorsa Realtime Database sayfasının üstündeki URL'yi kullan.

### 2) GitHub Pages'te yayınla

Bu repo, `.github/workflows/pages.yml` ile **otomatik** deploy edecek şekilde
ayarlı. Tek yapman gereken Pages'i açmak:

1. GitHub'da repoya git → **Settings → Pages**.
2. **Build and deployment → Source** kısmında **"GitHub Actions"** seç.
3. `main` (veya bu geliştirme dalı) her push edildiğinde site otomatik yayınlanır.
   Yayın adresi: `https://<kullanıcı-adın>.github.io/bnb/`

> **Alternatif (Actions kullanmadan):** Settings → Pages → Source → *Deploy from a
> branch* → `main` / `/ (root)` seçebilirsin. Site aynı şekilde yayınlanır.

Yayınlandıktan sonra: telefondan siteyi aç → **Oda Kur** → çıkan **4 haneli kodu**
arkadaşlarına söyle → onlar aynı siteden **Odaya Katıl** deyip kodu girsin → herkes
lobide görününce **Başlat**.

---

## 🎮 Nasıl Oynanır

- **Sunucu (host):** Oda kurar, kategori/soru sayısı/süre seçer. Sorular ve doğru
  cevaplar sunucu ekranında gösterilir; sunucu ekranını herkesin görebileceği bir
  yere (TV, projeksiyon) yansıtmak en iyisidir.
- **Oyuncular:** Kendi telefonlarından kodla katılır, şıklara telefonlarından
  dokunur. Ne kadar hızlı doğru cevap → o kadar çok puan.
- **Puanlama:** Doğru cevap **500–1000** puan (hız bonusu dahil), yanlış/boş **0**.
- Her sorudan sonra skor tablosu, oyun sonunda podyum gösterilir.

---

## 🗂️ Proje Yapısı

```
index.html            # Uygulama kabuğu
css/styles.css        # Stil (mobil öncelikli)
js/firebase-config.js # ⬅️ Firebase bilgilerini buraya gir
js/firebase.js        # Firebase başlatma
js/questions.js       # Soru bankası (kategoriler + sorular)
js/app.js             # Oyun mantığı (oda, akış, puanlama)
.github/workflows/pages.yml  # Otomatik GitHub Pages deploy
```

Yeni soru eklemek için `js/questions.js` içindeki ilgili kategoriye
`{ q, options, answer }` nesnesi ekle (`answer` = doğru şıkkın 0-tabanlı index'i).

---

## 🔒 Yayın için güvenlik notu (opsiyonel)

Test modu kuralları herkese açıktır. Herkese açık bir yayında kötüye kullanımı
sınırlamak için Realtime Database → **Kurallar** sekmesine şu tarz bir kural
koyabilirsin (sadece `rooms` altına, doğrulama olmadan okuma/yazma):

```json
{
  "rules": {
    "rooms": { ".read": true, ".write": true }
  }
}
```

Daha sıkı bir kurulum istersen Firebase Authentication (anonim giriş) eklenebilir.

---

## 💻 Yerelde deneme

Statik site olduğu için basit bir sunucu yeterli (ES modülleri `file://` ile
çalışmaz):

```bash
python3 -m http.server 8000
# tarayıcıda: http://localhost:8000
```

Not: Yerelde de oynamak için önce `js/firebase-config.js`'i doldurmuş olman gerekir.
