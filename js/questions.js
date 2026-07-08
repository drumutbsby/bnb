// Soru bankası — çok kategorili, çoktan seçmeli.
// Her soru: { q: soru metni, options: [4 şık], answer: doğru şıkkın index'i (0-3) }

export const CATEGORIES = {
  genel: { name: "Genel Kültür", emoji: "🧠", color: "#e21b3c" },
  tarih: { name: "Tarih", emoji: "🏛️", color: "#1368ce" },
  cografya: { name: "Coğrafya", emoji: "🌍", color: "#26890c" },
  bilim: { name: "Bilim & Doğa", emoji: "🔬", color: "#d89e00" },
  spor: { name: "Spor", emoji: "⚽", color: "#864cbf" },
  sanat: { name: "Sanat & Edebiyat", emoji: "🎨", color: "#0aa3a3" },
  sinema: { name: "Sinema & Müzik", emoji: "🎬", color: "#e2691b" },
  teknoloji: { name: "Teknoloji", emoji: "💻", color: "#5a5a5a" },
  turkiye: { name: "Türkiye", emoji: "🇹🇷", color: "#c8102e" },
  hayvanlar: { name: "Hayvanlar", emoji: "🦁", color: "#2d8f4e" },
  bayrak: { name: "Bayraklar", emoji: "🚩", color: "#b3261e" },
  emoji: { name: "Emoji Bilmece", emoji: "🧩", color: "#7c2fd6" },
};

// Kendi sorularını yazmak isteyenler için özel kategori (soruları localStorage'da tutulur)
export const CUSTOM_CATEGORY = { key: "ozel", name: "Kendi Sorularım", emoji: "✏️", color: "#e2691b" };

export const QUESTIONS = {
  genel: [
    { q: "Bir yılda kaç ay vardır?", options: ["10", "11", "12", "13"], answer: 2 },
    { q: "Gökkuşağında kaç renk bulunur?", options: ["5", "6", "7", "8"], answer: 2 },
    { q: "Satranç tahtasında kaç kare vardır?", options: ["48", "56", "64", "72"], answer: 2 },
    { q: "Bir futbol takımı sahada kaç oyuncuyla başlar?", options: ["9", "10", "11", "12"], answer: 2 },
    { q: "İnsan vücudunda kaç kemik bulunur?", options: ["186", "206", "226", "246"], answer: 1 },
    { q: "Trafik lambasında 'dur' anlamına gelen renk hangisidir?", options: ["Yeşil", "Sarı", "Kırmızı", "Mavi"], answer: 2 },
    { q: "Bir haftada kaç gün vardır?", options: ["5", "6", "7", "8"], answer: 2 },
    { q: "Aşağıdakilerden hangisi bir asal sayıdır?", options: ["9", "15", "21", "7"], answer: 3 },
    { q: "Bir düzine kaç adettir?", options: ["6", "10", "12", "20"], answer: 2 },
    { q: "Olimpiyat bayrağında kaç halka vardır?", options: ["3", "4", "5", "6"], answer: 2 },
  ],
  tarih: [
    { q: "Türkiye Cumhuriyeti hangi yıl ilan edilmiştir?", options: ["1920", "1922", "1923", "1930"], answer: 2 },
    { q: "İstanbul'un fethi hangi yılda gerçekleşti?", options: ["1453", "1492", "1071", "1520"], answer: 0 },
    { q: "Osmanlı Devleti'nin kurucusu kimdir?", options: ["Orhan Bey", "Osman Bey", "Fatih Sultan Mehmet", "Ertuğrul Gazi"], answer: 1 },
    { q: "Mustafa Kemal Atatürk hangi yıl doğmuştur?", options: ["1871", "1881", "1891", "1901"], answer: 1 },
    { q: "Kurtuluş Savaşı'nı başlatan Samsun'a çıkış tarihi nedir?", options: ["19 Mayıs 1919", "23 Nisan 1920", "29 Ekim 1923", "30 Ağustos 1922"], answer: 0 },
    { q: "II. Dünya Savaşı hangi yıl sona ermiştir?", options: ["1939", "1943", "1945", "1948"], answer: 2 },
    { q: "Mısır'daki ünlü piramitler hangi uygarlığa aittir?", options: ["Roma", "Yunan", "Antik Mısır", "Pers"], answer: 2 },
    { q: "Türkiye Büyük Millet Meclisi hangi tarihte açılmıştır?", options: ["23 Nisan 1920", "19 Mayıs 1919", "29 Ekim 1923", "10 Kasım 1938"], answer: 0 },
    { q: "Malazgirt Savaşı hangi yılda yapılmıştır?", options: ["1071", "1176", "1299", "1453"], answer: 0 },
    { q: "Atatürk hangi yıl vefat etmiştir?", options: ["1935", "1938", "1940", "1945"], answer: 1 },
  ],
  cografya: [
    { q: "Türkiye'nin başkenti neresidir?", options: ["İstanbul", "İzmir", "Ankara", "Bursa"], answer: 2 },
    { q: "Dünyanın en yüksek dağı hangisidir?", options: ["K2", "Everest", "Ağrı Dağı", "Kilimanjaro"], answer: 1 },
    { q: "Türkiye'nin en büyük gölü hangisidir?", options: ["Tuz Gölü", "Beyşehir Gölü", "Van Gölü", "İznik Gölü"], answer: 2 },
    { q: "En büyük okyanus hangisidir?", options: ["Atlas", "Hint", "Pasifik", "Arktik"], answer: 2 },
    { q: "Fransa'nın başkenti neresidir?", options: ["Londra", "Berlin", "Paris", "Roma"], answer: 2 },
    { q: "Dünyada kaç kıta vardır?", options: ["5", "6", "7", "8"], answer: 2 },
    { q: "Türkiye'nin en yüksek dağı hangisidir?", options: ["Erciyes", "Ağrı Dağı", "Uludağ", "Kaçkar"], answer: 1 },
    { q: "Sahra Çölü hangi kıtadadır?", options: ["Asya", "Afrika", "Avustralya", "Güney Amerika"], answer: 1 },
    { q: "Japonya'nın başkenti neresidir?", options: ["Seul", "Pekin", "Tokyo", "Bangkok"], answer: 2 },
    { q: "Türkiye kaç coğrafi bölgeye ayrılır?", options: ["5", "6", "7", "8"], answer: 2 },
  ],
  bilim: [
    { q: "Suyun kimyasal formülü nedir?", options: ["CO2", "H2O", "O2", "NaCl"], answer: 1 },
    { q: "Güneş sistemindeki en büyük gezegen hangisidir?", options: ["Dünya", "Satürn", "Jüpiter", "Mars"], answer: 2 },
    { q: "Kanı vücuda pompalayan organ hangisidir?", options: ["Akciğer", "Kalp", "Böbrek", "Karaciğer"], answer: 1 },
    { q: "Işık yaklaşık olarak saniyede kaç km hızla hareket eder?", options: ["3.000", "30.000", "300.000", "3.000.000"], answer: 2 },
    { q: "Periyodik cetvelde 'O' harfi hangi elementi temsil eder?", options: ["Altın", "Oksijen", "Osmiyum", "Karbon"], answer: 1 },
    { q: "Bitkiler besin üretmek için hangi süreci kullanır?", options: ["Solunum", "Fotosentez", "Sindirim", "Dolaşım"], answer: 1 },
    { q: "Dünyanın tek doğal uydusu nedir?", options: ["Güneş", "Ay", "Mars", "Venüs"], answer: 1 },
    { q: "Yerçekimini formülleştiren bilim insanı kimdir?", options: ["Einstein", "Newton", "Galileo", "Tesla"], answer: 1 },
    { q: "İnsan vücudunda oksijeni taşıyan hücreler hangileridir?", options: ["Beyaz kan hücreleri", "Kırmızı kan hücreleri", "Sinir hücreleri", "Kas hücreleri"], answer: 1 },
    { q: "E=mc² denklemi hangi bilim insanına aittir?", options: ["Newton", "Einstein", "Bohr", "Hawking"], answer: 1 },
  ],
  spor: [
    { q: "2018 FIFA Dünya Kupası'nı hangi ülke kazandı?", options: ["Almanya", "Brezilya", "Fransa", "Hırvatistan"], answer: 2 },
    { q: "Basketbolda bir potadan yapılan normal atış kaç sayıdır?", options: ["1", "2", "3", "4"], answer: 1 },
    { q: "Bir voleybol takımı sahada kaç oyuncuyla oynar?", options: ["5", "6", "7", "11"], answer: 1 },
    { q: "Tenis turnuvası Wimbledon hangi ülkede düzenlenir?", options: ["ABD", "Fransa", "İngiltere", "Avustralya"], answer: 2 },
    { q: "Formula 1'de yarışlar hangi araçla yapılır?", options: ["Motosiklet", "Tek koltuklu yarış arabası", "Kamyon", "Bisiklet"], answer: 1 },
    { q: "Olimpiyat Oyunları kaç yılda bir düzenlenir?", options: ["2", "3", "4", "5"], answer: 2 },
    { q: "Futbolda bir maç normal süresi kaç dakikadır?", options: ["60", "80", "90", "120"], answer: 2 },
    { q: "Galatasaray, Fenerbahçe ve Beşiktaş hangi şehrin takımlarıdır?", options: ["Ankara", "İzmir", "İstanbul", "Bursa"], answer: 2 },
    { q: "Yüzmede en hızlı stil hangisidir?", options: ["Kurbağalama", "Sırtüstü", "Serbest (kroul)", "Kelebek"], answer: 2 },
    { q: "Boksta bir raunt kaç dakika sürer (profesyonel)?", options: ["1", "3", "5", "10"], answer: 1 },
  ],
  sanat: [
    { q: "Mona Lisa tablosunu kim yapmıştır?", options: ["Van Gogh", "Picasso", "Leonardo da Vinci", "Michelangelo"], answer: 2 },
    { q: "'İstiklal Marşı'nın şairi kimdir?", options: ["Nazım Hikmet", "Mehmet Akif Ersoy", "Yahya Kemal", "Tevfik Fikret"], answer: 1 },
    { q: "'Yıldızlı Gece' tablosu hangi ressama aittir?", options: ["Van Gogh", "Monet", "Dali", "Rembrandt"], answer: 0 },
    { q: "'Romeo ve Juliet' oyununu kim yazmıştır?", options: ["Tolstoy", "Shakespeare", "Dostoyevski", "Molière"], answer: 1 },
    { q: "Nobel Edebiyat Ödülü kazanan ilk Türk yazar kimdir?", options: ["Yaşar Kemal", "Orhan Pamuk", "Nazım Hikmet", "Sabahattin Ali"], answer: 1 },
    { q: "'Harry Potter' serisinin yazarı kimdir?", options: ["J.R.R. Tolkien", "J.K. Rowling", "George R.R. Martin", "Roald Dahl"], answer: 1 },
    { q: "Bir piyanoda kaç tuş vardır?", options: ["76", "88", "96", "108"], answer: 1 },
    { q: "'Suç ve Ceza' romanının yazarı kimdir?", options: ["Tolstoy", "Çehov", "Dostoyevski", "Gogol"], answer: 2 },
    { q: "'Düşünen Adam' heykelini kim yapmıştır?", options: ["Rodin", "Michelangelo", "Donatello", "Bernini"], answer: 0 },
    { q: "Senfoni orkestrasını yöneten kişiye ne denir?", options: ["Solist", "Şef", "Besteci", "Virtüöz"], answer: 1 },
  ],
  sinema: [
    { q: "'Titanic' filminin yönetmeni kimdir?", options: ["Steven Spielberg", "James Cameron", "Christopher Nolan", "Ridley Scott"], answer: 1 },
    { q: "Oscar ödülleri hangi ülkede verilir?", options: ["İngiltere", "Fransa", "ABD", "İtalya"], answer: 2 },
    { q: "'The Lion King' hangi tür bir filmdir?", options: ["Animasyon", "Belgesel", "Korku", "Western"], answer: 0 },
    { q: "Bir gitarda genellikle kaç tel bulunur?", options: ["4", "5", "6", "7"], answer: 2 },
    { q: "'Inception' ve 'Interstellar' filmlerinin yönetmeni kimdir?", options: ["Tarantino", "Christopher Nolan", "Scorsese", "Fincher"], answer: 1 },
    { q: "Michael Jackson hangi ünvanla anılır?", options: ["Rock Kralı", "Pop'un Kralı", "Caz Kralı", "Blues Kralı"], answer: 1 },
    { q: "'Star Wars' evreninde ışın kılıcını kullananlara ne denir?", options: ["Sith", "Jedi", "Wookiee", "Ewok"], answer: 1 },
    { q: "Bir davulda ritmi tutan temel enstrüman grubuna ne denir?", options: ["Yaylılar", "Perküsyon", "Üflemeliler", "Klavye"], answer: 1 },
    { q: "Türkiye'nin en çok bilinen yıllık film festivali hangi şehirde yapılır?", options: ["Ankara", "İzmir", "Antalya", "Bursa"], answer: 2 },
    { q: "'Matrix' filminde başrol oyuncusu kimdir?", options: ["Brad Pitt", "Keanu Reeves", "Tom Cruise", "Will Smith"], answer: 1 },
  ],
  teknoloji: [
    { q: "'WWW' (World Wide Web) kısaltmasındaki ilk W ne anlama gelir?", options: ["Wide", "World", "Web", "Windows"], answer: 1 },
    { q: "Apple şirketinin kurucularından biri kimdir?", options: ["Bill Gates", "Steve Jobs", "Mark Zuckerberg", "Elon Musk"], answer: 1 },
    { q: "Bilgisayarın 'beyni' olarak bilinen parça hangisidir?", options: ["RAM", "İşlemci (CPU)", "Ekran kartı", "Sabit disk"], answer: 1 },
    { q: "Microsoft şirketini kim kurmuştur?", options: ["Steve Jobs", "Bill Gates", "Larry Page", "Jeff Bezos"], answer: 1 },
    { q: "Web sayfaları oluşturmak için kullanılan temel işaretleme dili hangisidir?", options: ["Python", "HTML", "Java", "C++"], answer: 1 },
    { q: "İnsansız hava araçlarına yaygın olarak ne ad verilir?", options: ["Robot", "Drone", "Uydu", "Radar"], answer: 1 },
    { q: "'Bit' ve 'byte' hangi alanla ilgilidir?", options: ["Tıp", "Bilişim", "Müzik", "Spor"], answer: 1 },
    { q: "1 kilobayt yaklaşık kaç bayttır?", options: ["10", "100", "1000", "1.000.000"], answer: 2 },
    { q: "Android işletim sistemi hangi şirkete aittir?", options: ["Apple", "Microsoft", "Google", "Samsung"], answer: 2 },
    { q: "İnternette bir adresin başında sıkça görülen güvenli protokol hangisidir?", options: ["FTP", "HTTPS", "SMTP", "POP3"], answer: 1 },
  ],
  turkiye: [
    { q: "Türkiye'nin en kalabalık şehri hangisidir?", options: ["Ankara", "İzmir", "İstanbul", "Bursa"], answer: 2 },
    { q: "Türk bayrağında hangi iki sembol bulunur?", options: ["Yıldız ve güneş", "Ay ve yıldız", "Kartal ve ay", "Aslan ve yıldız"], answer: 1 },
    { q: "Türkiye'nin para birimi nedir?", options: ["Dolar", "Euro", "Lira", "Dinar"], answer: 2 },
    { q: "Boğaziçi Köprüsü hangi şehirdedir?", options: ["İzmir", "İstanbul", "Çanakkale", "Kocaeli"], answer: 1 },
    { q: "Kapadokya hangi ilimizin sınırları içinde en çok bilinir?", options: ["Nevşehir", "Konya", "Kayseri", "Niğde"], answer: 0 },
    { q: "Türkiye'nin en uzun nehri hangisidir?", options: ["Fırat", "Dicle", "Kızılırmak", "Sakarya"], answer: 2 },
    { q: "Pamukkale'nin ünlü beyaz travertenleri hangi ildedir?", options: ["Antalya", "Denizli", "Muğla", "Aydın"], answer: 1 },
    { q: "Anıtkabir hangi şehirdedir?", options: ["İstanbul", "İzmir", "Ankara", "Bursa"], answer: 2 },
    { q: "Efes Antik Kenti hangi ilimizdedir?", options: ["İzmir", "Muğla", "Antalya", "Aydın"], answer: 0 },
    { q: "Türkiye hangi iki kıtada topraklara sahiptir?", options: ["Asya-Afrika", "Avrupa-Asya", "Avrupa-Afrika", "Asya-Amerika"], answer: 1 },
  ],
  hayvanlar: [
    { q: "Karada yaşayan en hızlı hayvan hangisidir?", options: ["Aslan", "Çita", "At", "Ceylan"], answer: 1 },
    { q: "Dünyanın en büyük hayvanı hangisidir?", options: ["Fil", "Mavi balina", "Zürafa", "Beyaz köpekbalığı"], answer: 1 },
    { q: "Bir örümceğin kaç bacağı vardır?", options: ["6", "8", "10", "12"], answer: 1 },
    { q: "Bal üreten böcek hangisidir?", options: ["Karınca", "Arı", "Sinek", "Kelebek"], answer: 1 },
    { q: "Kanguru hangi ülkeyle özdeşleşmiştir?", options: ["Brezilya", "Avustralya", "Hindistan", "Kenya"], answer: 1 },
    { q: "Penguenler ağırlıklı olarak nerede yaşar?", options: ["Sahra", "Amazon", "Antarktika", "Himalayalar"], answer: 2 },
    { q: "Karada yaşayan en büyük hayvan hangisidir?", options: ["Gergedan", "Fil", "Su aygırı", "Zürafa"], answer: 1 },
    { q: "Balıklar suyun altında hangi organ sayesinde nefes alır?", options: ["Akciğer", "Solungaç", "Deri", "Yüzgeç"], answer: 1 },
    { q: "Aşağıdakilerden hangisi bir memeli hayvandır?", options: ["Yunus", "Köpekbalığı", "Timsah", "Kurbağa"], answer: 0 },
    { q: "Boynu en uzun olan kara hayvanı hangisidir?", options: ["Deve", "Zürafa", "At", "Lama"], answer: 1 },
  ],
  bayrak: [
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇫🇷", options: ["İtalya", "Fransa", "Hollanda", "Rusya"], answer: 1 },
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇯🇵", options: ["Güney Kore", "Çin", "Japonya", "Bangladeş"], answer: 2 },
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇧🇷", options: ["Brezilya", "Arjantin", "Portekiz", "Meksika"], answer: 0 },
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇩🇪", options: ["Belçika", "Almanya", "Avusturya", "İspanya"], answer: 1 },
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇹🇷", options: ["Tunus", "Türkiye", "Azerbaycan", "Fas"], answer: 1 },
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇮🇹", options: ["İrlanda", "Macaristan", "İtalya", "Meksika"], answer: 2 },
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇬🇧", options: ["ABD", "Avustralya", "Birleşik Krallık", "Yeni Zelanda"], answer: 2 },
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇪🇸", options: ["İspanya", "Portekiz", "İtalya", "Kolombiya"], answer: 0 },
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇬🇷", options: ["İsrail", "Yunanistan", "Finlandiya", "Uruguay"], answer: 1 },
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇨🇦", options: ["Kanada", "İngiltere", "Danimarka", "İsviçre"], answer: 0 },
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇸🇪", options: ["Norveç", "İsveç", "Finlandiya", "Danimarka"], answer: 1 },
    { q: "Bu bayrak hangi ülkeye ait?", visual: "🇨🇭", options: ["Danimarka", "Avusturya", "İsviçre", "Polonya"], answer: 2 },
  ],
  emoji: [
    { q: "Bu emojiler hangi filmi anlatıyor?", visual: "🦁👑", options: ["Tarzan", "Aslan Kral", "Madagaskar", "Jungle Book"], answer: 1 },
    { q: "Bu emojiler hangi filmi anlatıyor?", visual: "❄️⛄👸", options: ["Sindirella", "Karlar Ülkesi", "Buz Devri", "Rapunzel"], answer: 1 },
    { q: "Bu emojiler hangi filmi anlatıyor?", visual: "🚢🧊💔", options: ["Titanic", "Deniz Feneri", "Kutup Ekspresi", "Kaptan Phillips"], answer: 0 },
    { q: "Bu emojiler hangi süper kahramanı anlatıyor?", visual: "🕷️🧑", options: ["Batman", "Örümcek Adam", "Süpermen", "Kaptan Amerika"], answer: 1 },
    { q: "Bu emojiler hangi filmi anlatıyor?", visual: "🦖🏞️", options: ["Kong", "Jurassic Park", "Godzilla", "Avatar"], answer: 1 },
    { q: "Bu emojiler hangi seriyi anlatıyor?", visual: "🧙‍♂️⚡🤓", options: ["Yüzüklerin Efendisi", "Harry Potter", "Narnia", "Percy Jackson"], answer: 1 },
    { q: "Bu emojiler hangi filmi anlatıyor?", visual: "🐠🔍", options: ["Deniz Filmi", "Kayıp Balık Nemo", "Küçük Deniz Kızı", "Shark Tale"], answer: 1 },
    { q: "Bu emojiler hangi süper kahramanı anlatıyor?", visual: "🦇🦸", options: ["Batman", "Kara Şahin", "Örümcek Adam", "Kanatlı Adam"], answer: 0 },
    { q: "Bu emojiler hangi filmi anlatıyor?", visual: "👽📞🏠", options: ["Uzaylılar", "E.T.", "İstila", "Süpernova"], answer: 1 },
    { q: "Bu emojiler hangi filmi anlatıyor?", visual: "🧞‍♂️🪔", options: ["Sinbad", "Alaaddin", "Herkül", "Pinokyo"], answer: 1 },
    { q: "Bu emojiler hangi filmi anlatıyor?", visual: "🍫🏭", options: ["Şeker Dünyası", "Charlie'nin Çikolata Fabrikası", "Ratatouille", "Şirinler"], answer: 1 },
    { q: "Bu emojiler hangi filmi anlatıyor?", visual: "🤖🚮🌍", options: ["Transformers", "WALL-E", "Terminatör", "Big Hero 6"], answer: 1 },
  ],
};

// Belirli kategorilerden karışık soru seti üretir.
// customPool: "ozel" kategorisi seçilirse kullanılacak (host'un kendi soruları).
export function buildQuestionSet(categoryKeys, count, customPool) {
  let pool = [];
  const keys = (!categoryKeys || categoryKeys.length === 0)
    ? Object.keys(QUESTIONS)
    : categoryKeys;
  for (const key of keys) {
    if (key === "ozel" && Array.isArray(customPool)) {
      for (const item of customPool) pool.push({ ...item, category: "ozel" });
    } else if (QUESTIONS[key]) {
      for (const item of QUESTIONS[key]) {
        pool.push({ ...item, category: key });
      }
    }
  }
  // Karıştır (Fisher-Yates)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
