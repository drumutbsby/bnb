// ============================================================
//  FIREBASE AYARLARI  —  BURAYI DOLDURMAN GEREKİYOR
// ============================================================
//
//  1. https://console.firebase.google.com adresine git, ücretsiz
//     bir proje oluştur.
//  2. Sol menüden "Realtime Database" > "Veritabanı oluştur"a bas.
//     Konum seç, "Test modunda başlat" seçeneğini işaretle.
//  3. Proje ayarları (⚙️) > "Genel" sekmesinde, "Uygulamalarınız"
//     bölümünden web uygulaması (</>) ekle.
//  4. Sana verilen "firebaseConfig" nesnesini aşağıya YAPIŞTIR.
//
//  Ayrıntılı adımlar için README.md dosyasına bak.
// ============================================================

export const firebaseConfig = {
  apiKey: "BURAYA_API_KEY",
  authDomain: "BURAYA_PROJE.firebaseapp.com",
  databaseURL: "https://BURAYA_PROJE-default-rtdb.firebaseio.com",
  projectId: "BURAYA_PROJE",
  storageBucket: "BURAYA_PROJE.appspot.com",
  messagingSenderId: "BURAYA_SENDER_ID",
  appId: "BURAYA_APP_ID",
};
