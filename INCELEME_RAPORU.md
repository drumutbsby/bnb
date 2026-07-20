# Ben Bildim — İnceleme Raporu (Temmuz 2026)

> ✅ **Durum: Bu raporda listelenen tüm doğrulanmış bulgular (A1–A8 kod
> hataları, B1–B4 içerik hataları ve tekrarlar) bu dalın commit'lerinde
> düzeltilmiştir.** C bölümündeki geliştirme önerileri yol haritası olarak
> durmaktadır. Düzeltme sonrası havuz: **4.095 soru** (tekrarlar ayıklandı),
> tüm dosyalar şema + tekrar doğrulamasından ve tarayıcıda duman testinden geçti.

Bu rapor; ana oyun mantığı (`js/app.js`), yardımcı modüller + PWA katmanı ve
**3.968 sorunun tamamının** içerik doğruluğu üzerinde yapılan yeni bir denetim
turunun sonuçlarını içerir. ONERILER.md'de zaten kayıtlı olan bilinen konular
(açık broker hile senaryoları, hayalet odalar, native alert kullanımı vb.)
tekrar edilmemiştir. Kod bulgularının kritik olanları kaynak üzerinde ayrıca
elle doğrulanmıştır.

---

## A. Kod hataları (doğrulanmış)

### A1 🔴 YÜKSEK — Gün serisi mantığı yerel gün ile UTC gününü karıştırıyor
**Dosya:** `js/daily.js:14-15` (`dayNumber()` UTC, `todayStr()` yerel), `:24-35` (giriş serisi), `:88-103` (`recordDailyQuestion`), `js/app.js` (`pickDailyQuestion` UTC gününe göre soru seçer).

Gün değişimi kapısı **yerel** tarihe (`todayStr`) bakarken seri aritmetiği
**UTC** gün numarasına (`dayNumber`) bakıyor. Türkiye (UTC+3) için 00:00–03:00
arasında iki sayaç ayrışır:

- **Seri haksız sıfırlanıyor:** Oyuncu 1. gün 23:30'da, 2. gün 01:00'de oynarsa
  yerel tarih değişir ama `dn - last === 0` olur → art arda oynamasına rağmen
  giriş serisi ve Günün Sorusu serisi **1'e düşer**. (Ters senaryoda `dn-last===2`
  olup yine sıfırlanır.)
- **Günün Sorusu mükerrer XP:** Günde-tek-hak kilidi yerel geceyarısında
  açılır ama soru UTC gününe göre seçildiği için 03:00'e kadar **aynı soru**
  gelir. 23:50'de cevaplayan oyuncu 00:10'da aynı soruyu cevabını bilerek tekrar
  çözüp seri + XP'yi (400 + seri bonusu) ikinci kez alabilir.

**Düzeltme:** Tek gün tanımına geçin — `dayNumber()`'ı yerel güne çevirin:
`Math.floor((Date.now() - new Date().getTimezoneOffset()*60000) / 86400000)`
ve `pickDailyQuestion` dahil her yerde aynı yardımcıyı kullanın.
*(İki bağımsız inceleme ajanı bu hatayı ayrı ayrı buldu; elle doğrulandı.)*

### A2 🟠 ORTA — Hızlı Eşleş: geri tuşu aramayı iptal etmiyor
**Dosya:** `js/app.js:1219-1235` (`renderQuickMatch`).

2.2 sn'lik `setTimeout` hiçbir yerde temizlenmiyor ve geri tuşu (popstate)
akışına bağlı değil. Kullanıcı arama sırasında geri basıp ana sayfaya dönerse
zamanlayıcı yine tetiklenir: açık oda varsa kullanıcı ana sayfadayken
**istemediği bir odaya zorla sokulur**; oda yoksa "Oda Kur / Ana Sayfa"
butonları ana sayfa kartının içine yapıştırılır (DOM bozulması). Ayrıca
`subscribeRooms("+/state")` aboneliği açık kalır.

**Düzeltme:** timeout id'sini saklayıp `cleanup()` içinde `clearTimeout`;
callback başına `if (state.currentView !== "quick") return;` guard'ı; cleanup'ı
popstate akışına da bağlayın (League/Global'daki `cancelled` deseni gibi).

### A3 🟡 DÜŞÜK — Lig/Global: tarayıcı geri tuşuyla çıkışta abonelik sızıntısı
**Dosya:** `js/app.js:1134-1159` (league), `:1250-1279` (global), `:3396-3404` (popstate).

`done()` (unsub + timer temizliği) yalnızca ekran içi "‹ Geri" butonuna bağlı.
Tarayıcı geri tuşu `renderHome()`'a düştüğü için `subscribeHof`/`subscribeLeague`
handler'ları birikir; her yeniden ziyarette mükerrer boyama + bellek/trafik
büyümesi olur. **Düzeltme:** görünüm değişiminde çağrılan genel bir
`state.viewCleanup` mekanizması ekleyip league/global/quick temizliklerini oraya
kaydedin.

### A4 🟡 DÜŞÜK — "Hız Canavarı" rozeti bazı oyunlarda hiç kazanılamıyor
**Dosya:** `js/app.js:2777` (yedek init'te `fastMs` yok), `:2783`.

`tallyGameStat`'ın yedek init'i `{correct, questions, maxStreak, wrongStreak}`
ile kuruluyor — `fastMs` alanı yok. `gs.fastMs === 0` (undefined için false) ve
`el < undefined` (false) nedeniyle `fastMs` asla yazılmaz. Soru ortasında F5 /
arenaya göç gibi 0. soru render'ı görülmeden başlayan oyunlarda "Hız Canavarı"
(2 sn altı doğru) rozeti hiçbir hızda tetiklenemez. **Düzeltme:** yedek init'e
`fastMs: 0` ekleyin.

### A5 🟡 DÜŞÜK — Profil varsayılanlarında referans paylaşımı (aliasing)
**Dosya:** `js/profile.js:15-27`.

`DEFAULT` modül-tekil bir nesne ve `Object.assign({}, DEFAULT, stored)` sığ
kopya yapıyor: `history`, `badges`, `weekly` saklanan profilde yoksa DEFAULT'un
iç nesneleri **referansla** paylaşılır. `saveProfile` sessizce başarısız olan
ortamlarda (kota dolu, bazı gizli sekmeler) `recordGame`/`evaluateBadges`
doğrudan `DEFAULT.history`/`DEFAULT.badges`'i kirletir → "hayalet rozetler",
tutarsız melez profiller. **Düzeltme:** DEFAULT'u fabrika fonksiyonu yapın
(`const defaults = () => ({ ... })`).

### A6 🟡 DÜŞÜK — 3-2-1 geri sayım perdesi karta değil tüm ekrana çapalanıyor
**Dosya:** `css/styles.css:429-433`, `js/app.js:862-865`.

`.countdown-overlay { position:absolute; inset:0 }` ama `.card` (ve hiçbir
atası) `position` almıyor → perde viewport'a göre çözülür. Uzun soru
kartlarında sayfa kaydırılınca perdenin altında kalan soru metni geri sayım
bitmeden **okunabilir** (küçük ekran kullanıcısına ekstra okuma süresi
avantajı). **Düzeltme:** `.card { position: relative; }`.

### A7 🟡 DÜŞÜK — Yarım kalan Hayatta Kalma oyununda "Tekrar Dene" çalışmıyor
**Dosya:** `js/app.js:186-217` (`saveSoloState`/`resumeSolo`), `:1734`, `:2916-2919`.

`startSurvival` kategori bilgisini `state.survivalParams`'a yazar ama
`saveSoloState` yalnızca `soloParams`'ı kalıcılaştırır; `resumeSolo` da geri
yüklemez. Devam edilen bir survival oyununun sonunda "🔁 Tekrar Dene"
`survivalParams` undefined olduğu için doğrudan başlatamaz, kurulum ekranına
düşer. **Düzeltme:** `saveSoloState`'e `survivalParams` ekleyip `resumeSolo`'da
geri yükleyin.

### A8 🧹 TEMİZLİK — Depoda oyunla ilgisiz dosyalar
Kökteki `xds` (tkinter/istatistik aracı) ve `rss_uygulamasi` (Kivy RSS okuyucu)
Python betikleri oyunla ilgisiz; GitHub Pages'e de olduğu gibi yayınlanıyorlar.
Muhtemelen yanlışlıkla commit edildiler — silinmeleri önerilir.

---

## B. Soru içeriği — genel durum

3.968 sorunun tamamı incelendi (12 kategori). Yapısal sağlık çok iyi:
**cevap indeksi aralık dışı: 0, bozuk alan: 0**; 214 bayrak emojisinin tamamı
programatik olarak ülkesiyle eşleşti; 44 doğru/yanlış ve 22 yazılı-cevap
sorusunun hepsi doğru. `bilim`, `genel` ve `hayvanlar` kategorileri neredeyse
kusursuz çıktı. Bulgular ağırlıklı olarak şu üç kümede:

| Küme | Adet (yaklaşık) |
|---|---|
| İşaretli cevabı yanlış / iki şıkkı da doğru olan sorular | ~15 yüksek + ~25 orta |
| Dil/yazım/bozuk soru kökü | ~45 |
| Tekrar eden sorular (dosya içi + dosyalar arası) | ~40 çift |

### B1 🔴 İşaretli cevabı yanlış veya çift-doğru sorular (öncelikli düzeltme)

- **turkiye #326** "Türkiye'nin en batısındaki il?" → cevap **Edirne** işaretli
  ama şıklarda **Çanakkale** var; Türkiye'nin en batı ucu Gökçeada (Çanakkale).
  Dosyadaki diğer uç-nokta soruları (Iğdır/Sinop/Hatay) uç nokta mantığını
  kullandığından cevap Çanakkale olmalı. *(elle doğrulandı)*
- **sinema #58** "Şener Şen ve Cem Yılmaz'ın başrolde olduğu, Yavuz Turgul'un
  yönettiği 2005 filmi?" → cevap **Gönül Yarası** ama Cem Yılmaz o filmde yok;
  Şen+Yılmaz ikilisinin Turgul filmi **Av Mevsimi (2010)** — şıklarda o da var.
  *(elle doğrulandı)*
- **turkiye #214** Mengen sorusu: soru "aşçılık geleneği **dışında**" diyor,
  işaretli cevap yine "Aşçılık" — soru kendi cevabıyla çelişiyor.
- **turkiye #215** "Oltu kebabı" çeldiricisi cağ kebabının diğer adı (Oltu Cağ
  Kebabı) — iki şık aynı yemek; tanım da hatalı (ızgara kaburga değil).
- **cografya #158** "Hindistan'ın batısındaki deniz?" → "Arap Denizi" işaretli,
  çeldirici "Umman Denizi" aynı denizin diğer Türkçe adı — çift doğru.
- **cografya #167** "Hangisinin Ermenistan'la sınırı YOKTUR?" → cevap Van ama
  **Ağrı'nın da** Ermenistan sınırı yok — çift doğru.
- **sanat #326** Sait Faik Ödülü'nü ilk kazanan: cevap Haldun Taner (1956)
  verilmiş; ödül ilk 1955'te Sait Faik'e verildi ve aynı dosyadaki #170 bunu
  doğru söylüyor — hem olgusal hata hem iç çelişki.
- **tarih #23** Tanzimat Fermanı'nı okuyan "sadrazam": Mustafa Reşid Paşa o
  sırada Hariciye Nazırı'ydı; "sadrazam" ifadesi yanlış (#2098'deki eş soru
  doğru soruyor).
- **spor #31** "Fenerbahçe'nin efsanevi kalecisi" → Volkan Demirel işaretli ama
  çeldirici Rüştü Reçber de aynı tanıma uyuyor — belirsiz.
- **spor #178** Real Madrid'in 2016-18 üst üste kazandığı kupa → "Dünya Kulüpler
  Kupası" çeldiricisi de doğru (FIFA Kulüpler DK 2016-17-18); "tarihte ilk kez"
  ifadesi de hatalı (1956-60'ta 5 kez üst üste).
- **spor #232** "Kadınlar 400 m engelde 50 sn altına inen atlet" → öncül hatalı;
  50 sn altına hiç inilmedi (DR 50.37).
- **spor #238** Kadınlar yüksek atlama rekoru "1987'den beri Kostadinova" →
  güncel değil; Mahuchikh Temmuz 2024'te 2.10 ile kırdı.
- **emoji #36** 🤴🐸 → "Prenses ve Kurbağa" işaretli ama görsel birebir
  çeldirici "Kurbağa Prens"i anlatıyor (prenses için 👸 gerekirdi).
- **emoji #73** 🧊🐿️🌰 → "Ice Age" işaretli, çeldirici "Buzul Çağı" aynı film —
  çift doğru (resmî Türkçe ad "Buz Devri").
- **sinema #33** "Mads Mikkelsen'e Oscar kazandıran film" → Mikkelsen Oscar
  kazanmadı; ödül filme (Druk, En İyi Uluslararası Film) gitti.
- **sinema #278** En İyi Animasyon Oscar'ının ilk yılı "2001" işaretli; ödül
  Mart 2002'deki törende verildi ve aynı dosyadaki #184 "2002" diyor — çelişki.
- **hayvanlar #26 ↔ #140** Aslan grubu: bir soruda "Sürü" yanlış sayılıyor,
  diğerinde doğru cevap — iki soru birbiriyle çelişiyor.
- **teknoloji #109/#250** "Uber'in ilk CEO'su Travis Kalanick" → ilk CEO
  Ryan Graves'ti (çeldirici olarak şıklarda!); "ilk" ifadesi kaldırılmalı.
- **cografya #27** "Türkiye'nin en yüksek 2. dağı Süphan" → 2. zirve
  Uludoruk/Cilo'dur (4.135 m); Süphan ancak "en yüksek 2. volkan".
- **sinema #214** Yılmaz Güney "senaryosunu hapishanede yazdığı Umut (1970)" →
  Umut'un senaryosu hapiste yazılmadı (hapiste yazılanlar: Sürü, Düşman, Yol).

### B2 🚩 Bayrak kategorisi: emoji boyutunda ayırt edilemeyen çeldiriciler

Bayrak soruları emoji ile gösterildiği için, neredeyse özdeş bayrakların
birbirine çeldirici yapıldığı sorular **fiilen cevaplanamaz**:

- **Yüksek:** Çad↔Romanya (#33/#146), Monako↔Endonezya (#44/#55),
  Moldova↔Andorra(+Romanya) (#50/#203), Filistin↔Ürdün (#66/#72),
  Senegal↔Mali (#120/#144), Avustralya↔Yeni Zelanda (#131),
  Honduras/El Salvador/Nikaragua üçlüsü (#195-197), Kolombiya↔Ekvador (#97/#103).
- **Orta:** Hollanda↔Lüksemburg, Slovakya↔Slovenya↔Rusya, Katar↔Bahreyn,
  Irak/Yemen/Suriye/Mısır dörtlüsü, ABD↔Liberya↔Malezya, Fiji↔Tuvalu.

**Öneri:** bu çiftlerde çeldiriciyi benzemeyen bir ülkeyle değiştirin — ya da
bilinçli olarak ayrı bir "Uzman bayrak" zorluk moduna taşıyın.

Ayrıca dil/tutarlılık: "Rwanda→Ruanda", "Bhutan→Butan", "Malawi→Malavi",
"Cape Verde→Yeşil Burun Adaları", "Suriname→Surinam", "Svaziland→Esvatini";
#198-202/209'daki Porto Riko/Grönland/Aruba vb. bağımsız ülke değil — soru
kalıbı "hangi ülke/bölgeye aittir?" olmalı.

### B3 🟠 Diğer dikkat çeken içerik bulguları (seçme)

- **emoji:** Deyim/atasözü görselleri İngilizce kalıplardan çevrilmiş:
  🐘🪰 "Pireyi deve yapmak" (pire+deve değil fil+sinek), 🐕 "Yatan aslanın
  kuyruğu" (köpek≠aslan), 🐐🌉 "ayıya dayı" (keçi≠ayı), 👂🧱 "Yerin kulağı"
  (duvar görseli #95'te "Duvarın kulağı" cevabıyla çelişiyor); "Kunfu Panda"
  (işaretli cevapta yazım hatası, doğrusu Kung Fu Panda), "Ratatöy↔Ratatuy"
  tutarsızlığı, "Elma dalının dibine düşer" (standart atasözü "Armut dibine
  düşer"), 8 soruda bozuk soru kalıbı ("Bu emoji atasözünü anlatıyor?").
- **sinema:** "Uzay Kovboyu (Toy Story)" — filmin Türkçe adı "Oyuncak
  Hikayesi"; #186'da dördüncü şık "-" (boş dolgu); #41 ve #162'de soru başında
  anlamsız düzenleme artıkları ("'Cehennem Silahı' değil;" / "(Monster's Ball
  değil)"); "Karanlık Öyküler"→"Karanlık Üzerine Öyküler".
- **spor:** #315 "Recep Uslu değil;" artığı; Hakan Şükür golü iki soruda farklı
  (10.9 sn / 11. sn; FIFA kaydı 10.8); #59 sorunun cevabı soru metninde geçiyor.
- **tarih:** #55'te iki çeldirici aynı kişi (Ali Fethi Bey = Fethi Okyar);
  #205'te "Başkent" çeldiricisi Otlukbeli'nin diğer adı; #94 "Kralsız John" →
  "Yurtsuz John"; #206 ↔ #11 Yeniçeri Ocağı kuruluş dönemi tutarsız.
- **cografya:** #63 ve #302 bozuk/mantıksız soru kökleri; #348 Boğaz'ın kuzey
  çıkışında iki fener var, soru belirsiz; "gölere→göllere".
- **teknoloji:** #285 Pierre Omidyar "Fransız asıllı" değil İran asıllı;
  #295/#319 "Aerobreaking→aerobraking"; #315 "pekişmeli→pekiştirmeli öğrenme";
  #272 "Compaq Wozniak" uydurma isim; kurucu/CEO sorularında "ilk" ifadeleri
  belirsiz (#101, #107, #110, #126, #280).
- **sanat:** #42 "Sokakta" Yusuf Atılgan'ın değil; #345 Elhân-ı Şitâ yağmuru
  değil karı betimler; #347 "Kaldırımlar" adını sokak lambasından almaz;
  #262 "Baleriler→Balerinler"; #44/#18/#156/#260/#322 bozuk soru cümleleri.

### B4 🔁 Tekrar eden sorular

- **Dosya içi:** 15 çift (ör. bayrak Butan/Bhutan, bilim femur x2, teknoloji
  HTML açılımı x2 + IPv4 x4, emoji Titanic/Titanik, spor 2002 DK "3."/"Üçüncü").
- **Dosyalar arası:** ~23 çift (ör. H2O, Jüpiter, femur bilim↔genel; Van Gölü,
  Konya, Pamukkale cografya↔turkiye; 1071, Osman Bey genel↔tarih). Kategoriler
  aynı oyunda karışabildiği için aynı soru bir oyunda iki kez çıkabilir.
- **mc↔tf/text çakışmaları:** her dosyanın sonundaki doğru/yanlış-yazılı mini
  set, aynı dosyanın başındaki çoktan seçmeli soruları birebir tekrarlıyor.
- `js/questions.js:2`'deki şema yorumu güncel değil (tf/text/explain/visual
  alanlarını anlatmıyor).

**Öneri:** normalize edilmiş soru metni üzerinden tekilleştirme + oyun içinde
"bu oturumda çıkan sorular" kümesiyle çift göstermeyi engelleme (bkz. Ö1).

---

## C. Geliştirme ve popüler öneriler

Mevcut ONERILER.md yol haritasına (backend seçenekleri, hile önleme, hayalet
odalar…) ek olarak, bu turun bulgularından doğan ve pazarda karşılığı olan
öneriler:

### Ö1 — Soru bankası kalite altyapısı (bu raporun doğal devamı) ⭐
- `npm` gerektirmeyen küçük bir Node betiği: şema doğrulama, dosya içi +
  dosyalar arası **tekrar tespiti** (normalize metin), cevap indeksi kontrolü,
  bayrak-emoji↔cevap eşleşmesi. CI'da (Pages workflow'una ek job) her push'ta
  çalışsın — içerik regresyonu bir daha yaşanmaz.
- Oyun içine **"🚩 Soruyu bildir"** butonu (reveal ekranına küçük bir bayrak):
  bildirimler localStorage'da birikir, ayarlardan JSON olarak dışa aktarılır
  (veya `hof` benzeri bir MQTT konusuna yazılır). 4.000 soruluk bir havuzda
  topluluk düzeltmesi en ölçeklenebilir kalite mekanizmasıdır.

### Ö2 — Zorluk etiketi ve akıllı soru seçimi
Şemada `difficulty` alanı hiç yok (README "zorluk seviyeleri"nden bahsediyor ama
bu süre bazlı). Sorulara `easy/med/hard` etiketi ekleyip (i) oda kurarken
zorluk filtresi, (ii) Hayatta Kalma'da kademeli zorlaşan sorular, (iii) doğru
cevap oranına göre otomatik kalibrasyon (yerel istatistikle) mümkün olur.
Kahoot/Quizizz'in en çok kullanılan filtresi budur.

### Ö3 — Play Store'a çıkış (TWA)
ANDROID.md yol haritası hazır ve PWA gereksinimleri karşılanmış durumda.
Bubblewrap ile TWA paketi + Play Store kaydı, kurulum gerektirmeyen mimariyle
mükemmel uyumlu ("web'e her push uygulamaya yansır"). Görünürlük için en yüksek
kaldıraçlı adım.

### Ö4 — Turnuva / sezon modu 🏆
Haftalık lig zaten var; üstüne: (i) sezon sonu "podyum + ödül avatarı" ekranı,
(ii) çok odalı **turnuva braketi** (düello altyapısı mevcut — 4/8 odalık
eleme ağacına genellenebilir), (iii) "Günün Sorusu"nda arkadaşına meydan
okuma linki (davet ödülü mekanizması zaten kurulu). Rekabetçi döngü, geri
dönüş oranını en çok artıran mekanik.

### Ö5 — İçerik çeşitliliği: yeni soru tipleri
Mevcut mc/tf/text üçlüsüne pazarda popüler iki tip eklenebilir:
- **Sıralama** ("Bu olayları kronolojik sırala") — tarih/spor için ideal.
- **Görsel bölge** veya **eşleştirme** (4 öğeyi 4 karşılıkla eşle).
Her ikisi de mevcut reveal/puanlama akışına oturur.

### Ö6 — Küçük ama popüler cilalar
- Oyun sonunda **"en çok yanlış yapılan soru"** özeti (host ekranında) —
  Kahoot'un öğretmenlere en sevdirilen özelliği.
- Cevap dağılım çubukları zaten var; reveal'a **yüzde etiketi** eklenmesi.
- Günlük görevlere haftalık "büyük görev" katmanı.
- Ayarlara **ses seviyesi kaydırıcısı** (aç/kapat yerine).
- `bayrak` zor çiftleri için "Uzman Bayrak" kategorisi (B2'deki sorunları
  bilinçli zorluğa çevirir).

---

## D. Önerilen öncelik sırası

1. **A1** (gün serisi/Günün Sorusu UTC hatası) — kullanıcıya görünür, güven bozar.
2. **B1 listesi** (yanlış işaretli ~19 soru) + **B2 yüksek bayrak çiftleri** — hızlı, mekanik düzeltmeler.
3. **A2** (Hızlı Eşleş) ve **A4** (rozet) — küçük yamalar.
4. **Ö1** (soru lint + bildir butonu) — kaliteyi kalıcılaştırır.
5. **B4** tekilleştirme (Ö1'in betiğiyle otomatik bulunur).
6. **A3/A5/A6/A7/A8** temizlikleri.
7. **Ö2–Ö6** ürün geliştirmeleri.
