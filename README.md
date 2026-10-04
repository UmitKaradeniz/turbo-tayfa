# 🏁 Turbo Tayfa

Tarayıcıda çalışan, arkadaşlarınla oda koduyla birlikte oynayabildiğin 3D kart yarışı.
Tilki Fındık, penguen Buzi, panda Pofuduk ve tayfanın geri kalanıyla tropik adada ve
çam vadisinde yarış; drift at, mini-turbo kap, hindistan cevizi fırlat!

- 🌴 4 pist: **Palmiye Koyu** (tropik ada), **Çam Vadisi** (orman, göl, tepe), **Kar Zirvesi** (kış dağı, kar yağışı) ve **Neon Şehir** (gece, liman, neon tabelalar)
- 🦊 8 karakter, en fazla 8 oyuncu; boş yerleri botlar doldurur
- 💨 Drift + 3 kademeli mini-turbo, roket kalkış
- 🛤️ Pist başına kısayol: hız tahtalı **kum yolu** (Palmiye Koyu), dereyi aşan **rampa** (Çam Vadisi), **buz geçidi** (Kar Zirvesi), kanalı aşan **servis yolu** (Neon Şehir)
- 🎁 Itemler: Turbo Şişesi, Balon Kalkan, Hindistan Cevizi, Yağ Lekesi
- 🌐 Oda koduyla çevrimiçi oyun, kopunca otomatik yeniden bağlanma
- 💬 Lobide sohbet, yarışta emojiyle hızlı tepkiler (👏😂😡😱🔥👋)
- 🎁 **Item simgeleri:** HUD yuvası ve rulet şeridinde düz vektör, iki tonlu gölgeli simgeler (`src/itemIcons.js`, SVG; her çözünürlükte keskin)
- 🏁 **Canlı sonuç tablosu:** yarışçılar bitirdikçe tablo yeniden çizilmez; bitmeyenin süresi "yükleniyor…" gösterir, bitince yalnızca o hücre süreye döner ve satırlar yerinde sıralanır
- 🪜 **Adım adım yarış hazırlığı:** 1 Karakter → 2 Araç → 3 Pist ve mod → 4 Hazır (pilotlar, sohbet, YARIŞA BAŞLA); altta sabit ileri/geri çubuğu, telefonda iç içe kaydırma yok; çevrimiçi odada da aynı adımlar (misafirde pist adımı kilitli)
- 🔤 **Okunaklı arayüz:** tüm yazılar Türkçe harflerle (ş ğ ı İ ç ö ü) uyumlu **Baloo 2** fontuyla ve oyunla birlikte kendi sunucumuzdan yüklenir (Google'a bağımlı değil); "Karakterini seç" kartında 24 karakterin hepsi görünür
- 🚗 **Haritaya özel araçlar:** her pistin kendi araç tasarımı var (pist tanımında `kartBody`, `public/models/karts/kart-<pist>.glb`); araç sınıfı seçimi hız, ivme, tutuş ve ağırlığı belirler
- 🏎️ **Araç sınıfları:** karakterden bağımsız 5 araç (Dengeli, Çevik, Roket, Ağır, Atak); hız, ivme, tutuş ve ağırlık farklı, seçim ekranında çubuklarla gösterilir; botlar da farklı sınıflarla yarışır, çevrimiçide herkesin aracı herkese görünür
- 🌋 **Volkan Adası:** lav denizi, kül püsküren yanardağ, zamanlı gayzerler, yavaşlatan kızgın zemin ve lav nehrini aşan kısayol
- 🎈 **Kapadokya:** gün doğumunda peribacaları arasından geçen kumtaşı vadisi; gökyüzünde sıcak hava balonları, kanyon kenarına tırmanış, yuvarlanan kayalar, toz hortumları ve hız şeritleri
- 🦖 **Dinozor Vadisi:** devasa dinozorların arasında tarih öncesi vadi; yamaçtan yuvarlanan kayalar, ayak darbeleri, zorunlu bataklık ve yarığı aşan kısayol; 15 m'lik **Dev Sırt** tırmanışı, dik iniş, yatık viraj ve atlatan dinozor izi tümsekleri
- ✨ **Parçacıklar:** duman, toz ve çamur Kenney Particle Pack (CC0) dokularıyla çiziliyor (`public/fx/particles.png`); nitro alevi ve kıvılcımlar parlak (HDR) yuvarlak noktalarla çiziliyor, bloom ile parlıyor.
- ☁️ **Gerçek gökyüzü:** 8 pistte Poly Haven (CC0) gökyüzü; güneş pistin ışık yönüne döndürülür, ufuk sis rengine karışır. Orta/Yüksek kalitede; Düşük'te eski gradyan gökyüzü (hız için). Tanı: adrese `?sky=1` / `?sky=0`.
- 🧱 **Yüzey detayı:** yollara asfalt normal haritası (Orta/Yüksek), araziye dünya koordinatlı çim/kum/kar/çakıl/kaya detay dokusu (sadece Yüksek); ambientCG (CC0). Tanı: adrese `?tex=1` / `?tex=0`.
- 🔊 **Ses çeşitliliği:** çarpma, duvar, isabet ve menü tıklama/seçme sesleri 3–4 farklı varyanttan rastgele çalar (hafif perde oynaması ile).
- 💡 **Drift öğretisi:** ilk yarışlarda başlangıçta, drift çok kısa bırakılınca ve ilk nitro kazanılınca kısa ipucu çıkar (nitro kazanılınca susar); dokunmatikte DRIFT butonu nabız atar. Mobil dikey ekran uyarısı üstte ve yarı saydamdır.
- ⛰️ **Eğim fiziği (tüm pistler):** yokuşta hız düşer, inişte hız sınırı aşılır (tek yerde: `SLOPE` in `src/config.js`); pist tanımına `bank` (yatık viraj), `bumps` (tümsek dizisi) ve `hillReach` eklenebilir Palmiye Koyu: yatık virajlar + kumul dalgaları. Çam Vadisi: 14 m zirve, yatık inişler, kök tümsekleri. Kar Zirvesi: 6 yatık viraj + kar tümsekleri. Neon Şehir: şehir tepeleri + yatık virajlar. Volkan Adası: krater kenarı + yuvarlanan kayalar. Ay Yolu: 4 büyük atlayış tümseği + yatık virajlar. Oyuncak Odası: yatak/yastık tepeleri. Şeker Diyarı: şeker tepeleri + tümsekler. Lunapark: hız treni profili. Hayalet Mezarlığı: kilise tepesi + mezar tümsekleri.
- 👻 **Hayalet Mezarlığı:** sisli gece, mezar taşları, oyulmuş balkabakları; yolu kesen hayaletler, yeşil ruh sütunları ve mezar toprağı yolu
- 🎡 **Lunapark:** hız treni halkaları, tezgâhlar, konfeti fıskiyeleri ve ray boşluğunu aşan kısayol
- 🍭 **Şeker Diyarı:** dev kekler, donutlar, lolipoplar; çikolata yol, pembe şeker fıskiyeleri ve çikolata nehrini aşan kısayol
- 🧸 **Oyuncak Odası:** dev bir odada kanepeler, kitaplıklar, blok kuleleri; yolu kesen dev plaj topları ve kutulardan geçen kısayol
- 🌙 **Ay Yolu:** düşük yerçekimi, gökyüzünde Dünya, zamanlı meteorlar ve krater çukurunu aşan kısayol
- 🏆 **Turbo Kupası / Büyük Kupa:** 4 ya da 13 pist art arda, her yarışta sıraya göre puan (tek oyunculu ve çevrimiçi)
- 👻 Zamana Karşı modu: en iyi turunun hayaletiyle yarış, pist başına rekorlar
- 🪵 Hareketli tehlikeler: yuvarlanan kütükler (Çam Vadisi), çığ topları (Kar Zirvesi), yolu kesen trafik (Neon Şehir), dev plaj topları (Oyuncak Odası)
- 🌿 Pistlere özgü zeminler: bataklık (Çam Vadisi), buz ve derin kar (Kar Zirvesi), sığ su (Palmiye), ıslak asfalt ve neon hız şeritleri (Neon), halı ve trambolin (Oyuncak Odası), bal (Şeker Diyarı), trambolin ve hız şeritleri (Lunapark, Ay)
- 🎵 Her pistin kendi müziği var (Palmiye, Çam, Kar, Neon, Volkan, Ay); müzik yalnızca girilen pist için yüklenir
- 🐾 24 sürücü: yarış sahası 8 kişidir (sen + 7 rakip), rakipleri menüdeki 🔀 düğmesiyle değiştirirsin
- 🤖 Kişilikli botlar: agresif, temiz, kurnaz, dengeli, uykucu, geveze
- 📱 Klavye ve dokunmatik kontroller, düşük/orta/yüksek grafik kalitesi

---

## Yerelde çalıştırma

Gerekli: [Node.js](https://nodejs.org) 20 veya üstü.

```bash
npm install
npm run dev
```

Tarayıcıda **http://localhost:3000** adresini aç. Tek komut hem oyunu hem de çok
oyunculu sunucuyu başlatır.

Port doluysa başka port ver: `PORT=4000 npm run dev` (Windows PowerShell'de: `$env:PORT=4000; npm run dev`).

### Aynı Wi-Fi'deki arkadaşlarla oynamak

`npm run dev` çalışınca konsolda şöyle bir satır görürsün:

```
→ Yerel ağ:       http://192.168.1.23:3000
```

Arkadaşların telefon ya da bilgisayarlarından bu adresi açsın. Biri **Oda Kur**'a
bassın, diğerleri **Odaya Katıl**'a oda kodunu yazsın (ya da oda sahibinin
paylaştığı linki açsın). Windows güvenlik duvarı sorarsa Node.js'e **özel ağ**
izni ver.

### Tek başına çok oyunculu test

İkinci bir terminalde, odaya katılıp tur atan bir "test pilotu" çalıştırabilirsin:

```bash
npm run fake -- ODAKODU http://localhost:3000 Robot
```

### Production modunda çalıştırmak

```bash
npm run build
npm start
```

---

## İnternette yayınlamak (Render, ücretsiz)

Repo zaten bir **Render Blueprint** (`render.yaml`) içeriyor: Frankfurt bölgesi,
ücretsiz plan, otomatik build.

1. [render.com](https://render.com)'da GitHub hesabınla giriş yap.
2. **New → Blueprint**'e tıkla, bu repoyu (`turbo-tayfa`) seç.
3. **Apply**'a bas. İlk build birkaç dakika sürer.
4. Bitince oyunun adresi `https://turbo-tayfa-xxxx.onrender.com` gibi bir şey olur.

Bundan sonra `main` dalına her push'ta Render otomatik yeniden deploy eder.

**Ücretsiz planın kısıtları**

- 15 dakika kimse bağlı değilse sunucu uyur. Oyun akşamı ilk açan kişi ~1 dakika
  "yükleniyor" bekler; sonra herkes için hızlıdır. Yarış sırasındaki trafik
  sunucuyu uyanık tutar.
- Odalar sunucu belleğinde tutulur; sunucu uyursa ya da yeniden deploy edilirse
  açık odalar kapanır (yeni oda kurmak yeterli).
- Aylık 750 saat ücretsiz çalışma süresi var; birkaç arkadaşın oynaması için fazlasıyla yeterli.

## Sürümler ve geri alma

Her yeni özellik GitHub'da ayrı bir **sürüm** (etiket + Release) olarak saklanır:
[Releases](https://github.com/UmitKaradeniz/turbo-tayfa/releases). Yeni bir sürüm sorun
çıkarırsa eski, çalışan sürüme şöyle dönebilirsin:

**Render'dan (en hızlısı, kod değişmez):**
1. Render panelinde servisi aç → **Manual Deploy → Deploy a specific commit**.
2. Releases sayfasında dönmek istediğin sürümün commit'ini seç (örn. `v1.0.2`) ve deploy et.
3. Not: `main`'e yeni bir push gelirse Render yine en son sürümü deploy eder.

**Kodu da geri almak istersen:**

```bash
git fetch --tags
git revert --no-edit v1.0.2..HEAD   # v1.0.2'den sonraki değişiklikleri geri alan yeni commit'ler
git push
```

(Sadece yerelde eski sürümü denemek için: `git checkout v1.0.2`, dönmek için `git checkout main`.)

## Hata raporları

Oyuncunun tarayıcısında oluşan hatalar (yakalanmamış JS hatası, WebGL kaybı, uzun süre düşük FPS) otomatik olarak
sunucuya gönderilir ve sunucu loguna yazılır. Render'da servis → **Logs** → arama kutusuna `[istemci]` yaz.
Her satırda hata metni, sürüm, tarayıcı, ekran kartı (GPU), pist, kalite ve FPS bulunur. Kişisel veri (IP, isim,
oda kodu) kaydedilmez; oturum başına en fazla 8 rapor gider, sunucu IP başına dakikada 12 raporu kabul eder.

## Arkadaşlarla paylaşma

1. Oyunun adresini aç, takma adını yaz, **Oda Kur**'a bas.
2. Lobide oda kodunun yanındaki 🔗 butonuyla davet linkini kopyala/paylaş
   (link `…/?oda=KOD` şeklindedir, açan kişinin karşısına kod dolu gelir).
3. Herkes karakterini seçip **HAZIRIM**'a bassın. Oda sahibi pisti, tur sayısını ve
   bot zorluğunu seçip **YARIŞI BAŞLAT**'a basar.
4. Telefondan oynayanlar sağ üstteki ⛶ butonuyla tam ekrana geçip telefonu yatay tutsun.

İpucu: Bağlantısı kopan oyuncu 60 saniye içinde otomatik geri döner; sayfayı yenilese bile
yarışa kaldığı yerden devam eder.

---

## Kontroller

| | Klavye | Dokunmatik |
|---|---|---|
| Gaz / fren-geri | W / S (ok tuşları) | otomatik gaz / FREN |
| Direksiyon | A / D (ok tuşları) | ◀ ▶ |
| Drift | Space veya Shift | DRIFT |
| Item kullan | E (S basılıyken geriye atar) | ITEM |
| Son checkpoint'e dön | R | — |
| Duraklat | Esc / P | ❚❚ |
| Emoji tepkisi | 1 – 6 | üstteki emoji çubuğu |
| Sohbet mesajı (çevrimiçi) | Enter | lobideki sohbet paneli |

- **Zamana Karşı:** Hızlı Yarış → Mod: *Zamana Karşı*. Bot ve item yok; en iyi turun
  yarı saydam bir hayalet olarak seninle yarışır. Rekorlar bu tarayıcıda saklanır.

- **Turbo Kupası / Büyük Kupa:** Hızlı Yarış / oda lobisi → Mod: *Kupa* (Palmiye Koyu → Çam Vadisi → Kar Zirvesi → Neon Şehir) ya da *Büyük Kupa* (tüm pistler, Volkan Adası, Ay Yolu, Oyuncak Odası, Şeker Diyarı, Lunapark, Hayalet Mezarlığı, Dinozor Vadisi ve Kapadokya dahil). Puanlar 15-12-10-8-6-4-2-1; her yarış sonunda puan tablosu çıkar, çevrimiçide **Sonraki Pist**'i oda sahibi başlatır. En çok puanı toplayan kupayı kazanır.
- **Volkan Adası:** Yolda zamanlı **gayzerler** var: halka kızarıp yanıp sönünce kor fışkırır, içindeki kart savrulur; halkanın yanından geç. Parlayan **kızgın zemin çatlakları** kartı yavaşlatır (turbo varken yavaşlatmaz). Kısayol lav nehrini rampayla aşar; yetmezse lava düşüp girişe dönersin.
- **Ay Yolu:** Yerçekimi yaklaşık yarıya iner; kart süzülür, rampalardan uzağa uçar, havadayken direksiyon az etki eder. Zamanlı **meteorlar**: yolda kırmızı uyarı halkası büyür, sonra meteor düşer ve halkadaki kart savrulur. Kısayol krater çukurunu rampayla aşar (yeterli hız gerekir); turbo tahtaları ve item kutuları var.
- **Oyuncak Odası:** Yolda zamanlı **dev plaj topları** var: çizgili uyarı şeridi yanıp sönünce top yolu bir yandan öbür yana yuvarlanır, çarptığı kart savrulur. Kısayol oyuncak sandığını rampayla aşar.
- **Şeker Diyarı:** Yolda zamanlı **pembe şeker fıskiyeleri** var (Volkan'daki gayzerlerle aynı mantık: halka parlayınca fışkırır, içindeki kart savrulur). Kısayol çikolata nehrini rampayla aşar.
- **Lunapark:** Yolda zamanlı **konfeti fıskiyeleri** var (mavi halka parlayınca fışkırır, içindeki kart savrulur). Kısayol ray boşluğunu rampayla aşar.
- **Zeminler:** Yolda rengi farklı şeritler var. *Çamur/su/bal/halı/derin kar* kartı yavaşlatır (turbo varken yavaşlatmaz), *buz* ve *ıslak asfalt* tutuşu azaltır (kart kayar), *ok işaretli şerit* turbo verir, *halkalı pedler* kartı havaya fırlatır. Botlar yavaşlatan zeminlerden mümkünse kaçınır.
- **Yuvarlanan tehlikeler:** Yolda çizgili turuncu bir uyarı şeridi yanıp sönerse birazdan o şeritten kütük / kar topu / araba / top geçer; çarptığı kart savrulur. Önce hızlan ya da şeritten önce bekle.
- **Drift:** Virajda direksiyonu kırıp drift'e bas. Kıvılcımlar mavi → turuncu → mor
  oldukça bırakınca aldığın turbo uzar.
- **Kısayollar:** Haritada sarı kesik çizgi olarak görünür. *Palmiye Koyu:* firketeyi kesen kum yolu kartı yavaşlatır (turbo varken yavaşlatmaz); ortadaki sarı **hız tahtasına** girersen turbo alırsın, yolun ortasında item kutuları da var. *Kar Zirvesi:* doğu tırmanışını atlayıp zirveye çıkan sıkışmış kar yolu; buz tahtaları turbo verir. *Neon Şehir:* binaların arasından geçen servis yolu; ortada kanalı aşan rampa var (Çam Vadisi'ndeki gibi yeterli hız gerekir). *Çam Vadisi:* inişteki S virajlarını kesen toprak yolda rampadan yeterli hızla (≈ 75 km/sa üstü) çıkarsan dereyi uçarak geçersin; yetmezse dereye düşüp kısayolun girişine dönersin. Botlar da kişiliklerine göre (kurnaz/agresif sık, temiz/uykucu nadiren) kısayolu kullanır.
- **Roket kalkış:** Geri sayımda "BAŞLA!" yazısından hemen önce gaza bas.
- Grafik kalitesi: varsayılan **Otomatik**. İlk açılışta ana menüde ~5 sn kare süresi ölçülür (yükleme takılmaları ve 30 FPS'e kilitli ekranlar sonucu bozmaz), sonra yarışlarda gerçek performansa bakılır: iki ayrı yarışta çözünürlük uzun süre düşük kalırsa bir kademe iner, art arda 4 yarış tam FPS'le geçerse bir kademe çıkar (bir sonraki açılışta uygulanır). Elle **Düşük/Orta/Yüksek** seçersen hiç değişmez; adrese `?q=low`, `?q=medium`, `?q=high` ekleyerek de zorlanabilir. Mantık: `src/autoQuality.js`.

---

## Proje yapısı

```
server/            Tek Node süreci: statik dosyalar + WebSocket oda sunucusu
  index.js         Express, Vite (dev) / dist (prod), WebSocket
  rooms.js         Oda, lobi, yarış, item/isabet doğrulaması
src/
  main.js          Oyun akışı: menü → yarış → sonuç, tek/çok oyunculu
  kart.js          Arcade kart fiziği (drift, turbo, savrulma, kalkan)
  track.js         Orta çizgiden pist, zemin ve sınır üretimi
  shortcut.js      Kısayollar: kendi yolu, kum/toprak, rampa + dere, hız tahtası
  city.js          Neon Şehir: bina yerleşimi, neon tabelalar, sokak lambaları
  props.js         Modül parçalarından kulübe / kır evi kuran yardımcılar
  tracks/          Pist tanımları (kontrol noktaları + tema + dekor)
  race.js          Tur, sıralama, checkpoint, bitiş
  items.js         Item kutuları ve itemler
  ai.js            Botlar
  net.js remote.js Sunucu bağlantısı, durum senkronu ve interpolasyon
  audio.js         Müzik, efektler, kodla üretilen motor sesi
  ui/              Menü, HUD, dokunmatik kontroller, mini harita
public/models      Kenney 3D modelleri (CC0); pist başına yüklenir: nature, racing, city, holiday, pirate, fantasy
public/audio       Ses ve müzikler (CC0)
tools/             Test aracı (sahte oyuncu)
```

### Yeni pist eklemek

1. `src/tracks/` altına `palmCove.js`'i örnek alarak yeni bir dosya aç:
   kontrol noktaları (`control`), tema renkleri, kullanılan modeller ve `decorate` fonksiyonu.
2. `src/tracks/index.js`'e ekle.
3. `server/rooms.js` içindeki `TRACKS` listesine kimliğini yaz.
4. Gece / kış için tanımda `night: true`, `snow: true` ve `light: {...}` alanları var (bkz. `nightCity.js`, `snowPeak.js`).
5. Menü ve sonuç ekranı `public/previews/<kimlik>.jpg` görselini gösterir. Yeni pist için: `npm run dev`, tarayıcı konsolunda kamerayı ayarla (`__tt.camera`, `__tt.rig.update = () => {}`) ve `__tt.snapshot()` ile 640×360 JPEG al (`data:` ön eki hariç base64'ü dosyaya yaz). Dört pistin görseli start çizgisinin arkasından alındı.
6. İsteğe bağlı kısayol: pist tanımına `shortcuts: [...]` ekle (bkz. `palmCove.js` / `pineValley.js`).

Mimari bilinçli olarak basit: framework yok, veritabanı yok, hesap yok.

---

## Lisanslar

Kod bu projeye aittir. Kullanılan tüm 3D modeller, sesler, müzikler ve yazı tipleri
CC0 / OFL / MIT lisanslıdır; ayrıntılar [CREDITS.md](CREDITS.md) dosyasında.
