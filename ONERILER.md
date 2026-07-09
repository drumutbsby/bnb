# Ben Bildim — Sektör Standardı Değerlendirme ve Öneriler

Bu belge; oyunun çok boyutlu (hata, güvenlik, UX, erişilebilirlik, performans,
dayanıklılık) denetiminin sonuçlarını, bu turda **uygulanan** iyileştirmeleri ve
Kahoot/Quizizz gibi sektör liderlerine rakip olmak için **önerilen** sonraki
adımları içerir.

Denetim, birden çok bağımsız uzman ajanın kodu okuyup bulgu üretmesi ve her
bulgunun ayrı bir ajan tarafından gerçek kodla **çürütme testinden** geçirilmesi
(adversarial verify) yöntemiyle yapıldı. 84 uçtan uca (e2e) tarayıcı testi
yeşil.

---

## 1. Bu turda uygulananlar (tamamlandı ✅)

### Denetim düzeltmeleri (mantık/dayanıklılık)
- **XP/rozet farm'ı kapatıldı.** Her oyuna benzersiz `gameId` verilir; oyun sonu
  ekranında sayfa yenilenerek aynı oyunun XP/rozet/lig kaydı tekrar tekrar
  işlenemez (`recordLocalResult` + `localStorage["bnb_lastGame"]`).
- **Host soru sırasında yenilerse oyun kilitlenmiyor.** `resumeSession` artık
  `status==="question"` ise otomatik reveal zamanlayıcısını yeniden kurar.
- **Reveal/ended tekrarı sağlamlaştırıldı.** Yeniden bağlanmada retained state
  yeniden gelirse istatistikler çift sayılmaz, efekt/ses/konfeti bir kez oynar
  (`state.lastRevealIndex`).
- **"Kusursuz" rozeti** yalnızca **tüm** sorular oynanıp hepsi doğru bilindiğinde
  verilir (oyun ortasında katılıp kısmi istatistikle sahte kusursuz engellendi).
- **`requireApproval` (katılım onayı)** `team:"B"` ile atlatılamaz; "B" takımı
  yalnızca kabul edilmiş bir düellodan sonra geçerli.
- **Meydan okuma (challenge) guard'ları:** istenmemiş `challengeAccept`/`Decline`
  ile bir lobi düello moduna sokulup kilitlenemez.
- **`elapsed`** host tarafında `[0, süre limiti]` aralığına sıkıştırılır.
- **Oda kapanınca** state aboneliği bırakılır; aynı kod yeniden kullanılırsa
  yabancı odanın trafiği eski ekrana sızmaz.
- **Global/Lig ekranı:** bağlantı kurulmadan "Geri" basılırsa abonelik sızmaz.
- **QR** yalnızca oda kodu için bir kez üretilir (her state güncellemesinde değil).
- **Oda kurma sondası** 900ms → 500ms (algılanan "Oluşturuluyor..." gecikmesi
  azaldı).

### Sektör standardı (PWA + SEO + erişilebilirlik + dayanıklılık)
- **PWA:** `manifest.webmanifest`, ağ öncelikli **service worker** (`sw.js`),
  192/512/maskable + apple-touch ikonları → ana ekrana eklenebilir, çevrimdışı
  kabuk açılır.
- **SEO/paylaşım:** açıklama, OpenGraph/Twitter/Apple meta etiketleri (mutlak
  URL'li kart görseli).
- **Erişilebilirlik:** `:focus-visible` odak halkası, WCAG AA'ya uygun sarı şık
  kontrastı (#9c6600 ~4.9:1), 44px dokunma hedefleri (mute, kick, mini, avatar),
  `aria-label`'lar, bağlantı durumu için `aria-live` bandı, `prefers-reduced-motion`
  desteği, pinch-zoom yeniden serbest (WCAG 1.4.4).
- **Mobil:** `viewport-fit=cover` + güvenli alan (safe-area) dolgusu, `100dvh`,
  `touch-action: manipulation`, uzun metin sarması (kart taşmaz).
- **Dayanıklılık:** global hata yakalama + kullanıcıya nazik "Yenile" bildirimi,
  bağlantı kopukluğu bandı, **Wake Lock** (host ekranı uyumasın).

### İkinci doğrulama turunda eklenenler
- **Öğretici reveal:** Oyuncu artık cevap sonrası **doğru cevabı** (yeşil ✓) ve
  yanlışsa **kendi seçtiğini** (kırmızı ✗) görüyor — Kahoot/Quizizz'in öğrenme
  kapanışı. (En yüksek etkili UX boşluğuydu.)
- **Erişilebilirlik derinliği:** görünmez `<h1>` + belge başlık yapısı, ekran
  okuyucuya "Doğru/Yanlış + doğru cevap" duyurusu (`aria-live` bölgesi),
  kategori rozeti kontrastı (#d89e00→#9c6600), reveal "sönük" şık kontrastı
  (#9aa0a6→#6b7075) → tümü WCAG AA.
- **Service worker:** yalnızca başarılı (2xx, aynı köken) yanıtlar önbelleğe
  alınır; 404/500 çevrimdışı için saklanmaz.

> İki bağımsız denetim turu (toplam 90 ajan) yapıldı. İkinci tur, güncel koda
> karşı **32 doğrulanmış bulgu** üretti; **31'i "düşük", 1'i "orta"** önemde —
> yani tüm kritik/yüksek bulgular kapatılmış durumda. Kalan maddeler aşağıda.

---

## 2. Öneriler (önceliklendirilmiş)

Öneriler, mimarinin temel gerçeğiyle başlar: **oyun tamamen istemci-taraflı,
backend yok, herkese açık bir MQTT broker'ı kullanıyor.** Bu, "kurulumsuz/ücretsiz
canlıya alma" hedefi için mükemmel; ancak **kimlik doğrulama** ve **sunucu-taraflı
otorite** olmadığı için bazı bütünlük/hile açıkları *tasarım gereği* mevcuttur.

### A. Bütünlük ve hile önleme — *mimari karar gerektirir* 🔴

Açık broker'da herkes herhangi bir konuya yazabilir. Bu şu senaryolara kapı açar
(arkadaş grubu için düşük risk, halka açık/rekabetçi kullanımda yüksek risk):

| # | Açık | Etki | Backend'siz hafifletme |
|---|------|------|------------------------|
| A1 | `elapsed:0` gönderip tavan hız puanı | Hile ile kazanma | **Host-taraflı zamanlama**: host soru başladığında `qStartTs` tutar, süreyi `Date.now()-qStartTs` ile kendi hesaplar (istemci `elapsed`'ini alt-sınır olarak kullanır, ~1.5s ağ payı) |
| A2 | Başkasının `pid`'iyle cevap/joker gönderme | Rakibi yanlışa kilitleme, jokerini yakma | **Oyuncuya özel gizli token**: katılımda üretilir, her input mesajında gönderilir; host token'ı retained state'e **koymadan** bellekte doğrular |
| A3 | Sahte `state` yayını (`kicked`/`redirectTo`) | Herkesi atma/sahte arenaya taşıma | **İmzalı state (TOFU)**: host WebCrypto ile anahtar çifti üretir, public anahtar meta'ya konur ve oyuncular ilk gördüklerini "pinler"; imzasız/eşleşmeyen state yok sayılır |
| A4 | Atılan oyuncu yeni `pid` ile geri gelir | Moderasyon etkisiz | **Kalıcı cihaz kimliği** (`localStorage`), `kicked`'e hem pid hem did yazılır |
| A5 | Sahte retained state ile katılımı engelleme / Hızlı Eşleş'i kirletme | DoS | İyimser katılım + host "ack" el sıkışması (aşağıda B1 ile aynı mekanizma) |

**Tavsiye:** Oyun arkadaş grubu/sınıf içi eğlence olarak kalacaksa, A1–A2 (host
zamanlaması + token) düşük maliyetli ve UX'i bozmadan uygulanabilir; **varsayılan
"Katılım Onayı" modunu önermek** casual trolleri zaten keser. Oyun halka açık ya
da turnuva/rekabetçi olacaksa **gerçek çözüm hafif bir backend'dir**:
- **PartyKit** (Cloudflare, WebSocket odaları — bu mimariye en yakın),
- **Supabase Realtime** veya **Ably/Pusher** (ücretsiz katman),
- **Firebase Realtime DB/Firestore** (auth + sunucu kuralları).

Backend, otoriteyi sunucuya taşıyarak A1–A5'in tamamını kökten çözer.

### B. Dayanıklılık / kenar durumlar — *backend'siz uygulanabilir* 🟠

- **B1 — Katılım yarışı (hayalet oyuncu):** Host, oyuncunun `join`'i ulaşmadan
  "Başlat"a basarsa oyuncu tüm oyunu "oynar" ama cevapları yutulur ve sıralamada
  görünmez. **Çözüm:** oyuncu tarafı başarıyı hemen ilan etmesin; state'te kendi
  `pid`'ini `players` içinde görene dek beklesin, ~1.5s'de bir `join`'i tekrar
  göndersin, zaman aşımında "Oyun sensiz başladı, tekrar dene" göstersin.
- **B2 — Onay bekleyen oyuncu yenilerse:** `resumeSession` her zaman düz `join`
  gönderir; bekleyen oyuncu F5 yapınca kendini "katılmış" sanar, red bildirimini
  görmez. **Çözüm:** resume'da bekleme durumunu retained state'ten türet
  (`rejected` → red ekranı; `requireApproval && lobby && !players[pid]` →
  `joinRequest`).
- **B3 — `migrateToArena` çıkışsız bekleme:** arena state'i hiç gelmezse sonsuz
  spinner. **Çözüm:** ~12s zaman aşımı + "Ana Sayfa" butonu.
- **B4 — Hızlı Eşleş ölçeklenmesi:** `subscribeRooms("+/state")` broker'daki
  **tüm** odaların tam retained state'ini indirir (popülerleşince mobilde
  JSON.parse fırtınası). **Çözüm:** ayrı hafif `lobby/<code>` ilan konusu
  (`{status, playerCount, ts}`); oyun başlayınca temizlenir. Bu aynı zamanda A5
  DoS'unu da azaltır.
- **B5 — Hayalet odalar (tek "orta" bulgu) 🟠:** Host lobide çöker/sekmeyi
  kapatırsa retained `state` "lobby" olarak *sonsuza dek* kalır (MQTT LWT yok);
  Hızlı Eşleş oyuncuyu bu ölü odaya kilitler, düello göçünde de meydan okunan oda
  hiç temizlenmez. **Çözüm:** host retained state'e periyodik `heartbeatAt`
  timestamp'i koysun (lobide ~15s'de bir); Hızlı Eşleş ve `joinRoom`, `heartbeatAt`
  30s'den eskiyse odayı ölü sayıp elesin. (Kalıcı çözüm yine LWT/backend.) Bu
  bulgu B1/B4 ile aynı kök nedeni paylaşır.

### C. UX / cila 🟡

- **C1 — Native `alert`/`prompt`/`confirm` yerine oyun-içi modal/toast.** 20+
  yerde native diyalog var; bunlar ana iş parçacığını bloklar (gerçek zamanlı
  oyunda MQTT ping/mesajları durur), temayla uyumsuzdur ve bazı in-app tarayıcılarda
  (Instagram/Facebook WebView — QR linkinin sık açıldığı yer) **bastırılır**.
  Mevcut `.err-toast` stilini `showToast()`'a, `confirm`'ü Promise tabanlı mini
  modala genelleştir.
- **C2 — Konfeti:** dönme/yeniden boyutlanmada bozuluyor (resize listener yok) ve
  ekran değişince iptal edilemiyor. Listener + `cancel()` ekle, ekran geçişinde
  çağır.
- **C3 — İçerik derinliği:** Kahoot'un cazibesi içerik zenginliğinde. Soru
  bankasını genişlet (şu an 124 soru), zorluk etiketlerini dengele, görsel/emoji
  soru oranını artır; kullanıcıların soru setlerini **içe/dışa aktarması** (JSON)
  büyük katma değer.
- **C4 — Derin erişilebilirlik:** görünüm değişiminde odak yönetimi (yeni kartın
  başlığına odak taşı), form etiketlerini `for`/`id` ile bağla, geri sayım
  kaplamasını ekran okuyucudan gizle/duyur. Temel a11y katmanı kuruldu; bu adım
  gerçek VoiceOver/TalkBack turuyla tamamlanmalı.
- **C5 — Onboarding & tempo:** ilk kullanımda kısa "nasıl oynanır"; oda kurulum
  ekranını kademeli göster (varsayılanlarla "Hızlı Başlat"); cevap-sonrası
  bekleme ekranına canlı "kaç kişi cevapladı" göstergesi; oyuncuya "odadan ayrıl"
  yolu.
- **C6 — Temizlik/perf (düşük):** `patchLobby()` ölü kodu (her state'te tam
  yeniden çizim yerine yama); retained `kicked/rejected/requests` haritalarını
  sınırla (sınırsız büyüme); SW sürümünü dağıtımda otomatik değiştir (aksi halde
  yeni SW kurulmaz — ağ öncelikli olduğu için çevrimiçi etki yok); manifest'e
  `id`/`categories`/`screenshots` ekle.

### D. Büyüme / ürünleştirme (opsiyonel, uzun vade) ⚪

- Öğretmen/sunucu paneli (soru seti kütüphanesi, sınıf geçmişi).
- Çoklu dil (i18n) — şu an TR sabit.
- Gizlilik dostu analitik (oyun başına oturum, tamamlanma oranı).
- Ödül/sezon sistemi (haftalık lig zaten var; sezon sıfırlama + ödül).
- Erişilebilirlik sertifikası: gerçek ekran okuyucu (VoiceOver/TalkBack) turu.

---

## 3. Test altyapısı

Depoda kurulumsuz çalışan, `localStorage` tabanlı sahte MQTT stub'ı ile 9 uçtan
uca senaryo (Playwright, headless Chromium) bulunur — toplam **84 doğrulama**,
tümü yeşil. Senaryolar: oda kurma, çoklu katılım, cevaplama/reveal, jokerler,
takım düellosu, kick, karakterler, level/rozet, günlük görev, rematch, tema/ayar.

> Not: Testler service worker'ı bloklar (`serviceWorkers: 'block'`), çünkü SW
> gerçek `mqtt.esm.js`'i sunup sahte stub'ın enjeksiyonunu atlar. Bu yalnızca
> test ortamına özgüdür; canlıda SW doğru çalışır.

---

*Bu belge yaşayan bir yol haritasıdır. A/B/C bölümlerindeki maddeler doğrudan
issue/PR'a dönüştürülebilir.*
