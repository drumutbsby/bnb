# Ben Bildim — Android'e Taşıma Yol Haritası

Oyun zaten bir **PWA** (manifest + service worker + ikonlar + çevrimdışı solo/macera).
Bu, Android'e giden en kısa yolun hazır olduğu anlamına gelir. Üç seçenek var;
öncelik sırasıyla:

---

## Seçenek 1 — TWA (Trusted Web Activity) ile Play Store *(önerilen)*

Mevcut siteyi Chrome tabanlı, **tam ekran, adres çubuksuz** bir Android
uygulaması olarak paketler. Google'ın resmî yöntemi; Kahoot dahil pek çok ürün
web sürümünü böyle taşır.

**Neden bu:** Kod değişikliği ~sıfır; web'e her push otomatik olarak uygulamaya
da yansır (mağazaya yeniden yükleme gerekmez — bu, backend'siz mimarimizle
mükemmel uyumlu).

### Adımlar

1. **PWA hazırlığı** *(bu depoda tamamlandı ✅)*
   - `manifest.webmanifest`: `id`, `categories`, `orientation`, maskable ikonlar ✅
   - Service worker: uygulama kabuğu + tüm soru shard'ları ön-önbellekte ✅
   - HTTPS: GitHub Pages ✅

2. **Digital Asset Links** — *tek dış bağımlılık*
   - Site kökünde şu dosya yayınlanmalı:
     `https://drumutbsby.github.io/.well-known/assetlinks.json`
   - ⚠️ Dikkat: origin `drumutbsby.github.io` olduğu için bu dosya **bnb
     deposuna değil**, `drumutbsby/drumutbsby.github.io` adlı **kullanıcı sitesi
     deposunun köküne** konmalı (`.well-known/assetlinks.json`).
   - İçerik şablonu (SHA-256 parmak izi, imza anahtarından gelir; Bubblewrap
     üretir):
     ```json
     [{
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "io.github.drumutbsby.benbildim",
         "sha256_cert_fingerprints": ["<İMZA-ANAHTARI-SHA256>"]
       }
     }]
     ```

3. **Paketleme (Bubblewrap CLI)** — Node kurulu bir makinede:
   ```bash
   npm i -g @bubblewrap/cli
   bubblewrap init --manifest https://drumutbsby.github.io/bnb/manifest.webmanifest
   #  → paket adı: io.github.drumutbsby.benbildim, imza anahtarı üretilir
   bubblewrap build
   #  → app-release-signed.apk + app-release-bundle.aab
   ```
   Alternatif: [PWABuilder.com](https://www.pwabuilder.com) — aynı işi web
   arayüzüyle yapar, teknik bilgi gerektirmez.

4. **Play Console**
   - Geliştirici hesabı: **25 $ (tek seferlik)**.
   - Yeni uygulama → `.aab` yükle (önce **kapalı test** parkuru).
   - ⚠️ **Kişisel hesaplar için Google şartı:** üretime geçmeden önce belirli
     sayıda test kullanıcısıyla (güncel şart ~12 kişi) **14 gün kapalı test**
     gerekir — arkadaş grubunla karşılanabilir; güncel sayıyı Play Console
     doğrular.
   - Mağaza kaydı: 512px ikon ✅, 1024×500 tanıtım görseli, en az 2 telefon
     ekran görüntüsü, kısa/uzun açıklama (TR), kategori: *Oyunlar > Bilgi*.
   - **Veri güvenliği formu + gizlilik politikası URL'si** (zorunlu). Bu oyun
     hesap tutmaz; veriler cihazda (localStorage). Tek paylaşım: çok oyunculu
     modda takma ad + skorlar açık MQTT broker'ından geçer — formda "geçici
     olarak iletilen, saklanmayan kullanıcı adı" olarak beyan edilmeli.
     Basit bir gizlilik sayfası bu depoda `gizlilik.html` olarak yayınlanabilir.
   - Hedef API düzeyi: Bubblewrap güncel şablonu Play'in istediği API
     seviyesini hedefler (her yıl yükselir; build sırasında otomatik).

5. **İçerik derecelendirme (IARC)** — anket doldurulur; bu oyun "herkes"
   derecesi alır (şiddet/kumar yok).

### TWA öncesi yapılmasını önerdiğim oyun-içi işler
- **Android geri tuşu:** Uygulama tek sayfa ve tarayıcı geçmişi kullanmıyor;
  TWA'da geri tuşu doğrudan **uygulamadan çıkarır**. Her ekran geçişinde
  `history.pushState` + `popstate` işleyicisi eklenmeli (geri = önceki ekran,
  ana ekranda geri = çık). *(Orta boy iş; mağaza kalitesi için önemli.)*
- Mağaza görselleri: mevcut ekran görüntüleri + 1024×500 banner üretimi.

---

## Seçenek 2 — Capacitor (WebView sarmalayıcı)

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Ben Bildim" io.github.drumutbsby.benbildim
npx cap add android && npx cap sync && npx cap open android
```

- Varlıklar **APK içine gömülür** → domain/asset-links gerekmez, tamamen
  çevrimdışı kurulur; MQTT yine çalışır.
- **Yerel eklentiler** açılır: titreşim (haptics), yerel bildirim, paylaş,
  ekranı uyanık tut, durum çubuğu rengi.
- Eksi: her güncelleme için mağazaya yeni sürüm yüklemek gerekir (web'in
  "push et, herkes güncel" avantajı kaybolur). Android Studio gerekir.

**Ne zaman tercih edilir:** Yerel özellik (bildirim, titreşim) veya mağaza
bağımsız tam çevrimdışı dağıtım istenirse.

---

## Seçenek 3 — Doğrudan APK dağıtımı (mağazasız)

Bubblewrap/Capacitor çıktısı `.apk` dosyasını GitHub Releases'e koy;
kullanıcılar "bilinmeyen kaynak" izniyle kurar. Maliyet 0, şart 0 — ama
görünürlük ve otomatik güncelleme yok. Hızlı arkadaş-grubu dağıtımı için uygun.

---

## Karşılaştırma

| | TWA (önerilen) | Capacitor | Doğrudan APK |
|---|---|---|---|
| Kod değişikliği | ~0 (geri tuşu önerilir) | Az | ~0 |
| Web güncellemesi otomatik yansır | ✅ | ❌ | ❌ |
| Tam çevrimdışı kurulum | ❌ (ilk açılış çevrimiçi) | ✅ | ✅/❌ |
| Yerel API (bildirim, titreşim) | Sınırlı | ✅ | Sarmalayıcıya bağlı |
| Play Store | ✅ | ✅ | ❌ |
| Maliyet | 25 $ (tek sefer) | 25 $ | 0 |

## Önerilen sıra
1. Geri tuşu (history) desteğini ekle — TWA kalitesi için.
2. `gizlilik.html` yayınla; `assetlinks.json` için kullanıcı-sitesi deposunu hazırla.
3. Bubblewrap ile paketle → Play kapalı test → üretim.
4. İleride yerel bildirim/titreşim istenirse Capacitor'a geçiş değerlendirilir.
