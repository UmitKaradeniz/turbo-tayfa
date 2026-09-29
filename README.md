# 🏁 Turbo Tayfa

Tarayıcıda çalışan, arkadaşlarınla oda koduyla birlikte oynayabildiğin 3D kart yarışı.
Tilki Fındık, penguen Buzi, panda Pofuduk ve tayfanın geri kalanıyla tropik adada ve
çam vadisinde yarış; drift at, mini-turbo kap, hindistan cevizi fırlat!

- 🌴 2 pist: **Palmiye Koyu** (tropik ada) ve **Çam Vadisi** (orman, göl, tepe)
- 🦊 8 karakter, en fazla 8 oyuncu; boş yerleri botlar doldurur
- 💨 Drift + 3 kademeli mini-turbo, roket kalkış
- 🎁 Itemler: Turbo Şişesi, Balon Kalkan, Hindistan Cevizi, Yağ Lekesi
- 🌐 Oda koduyla çevrimiçi oyun, kopunca otomatik yeniden bağlanma
- 💬 Lobide sohbet, yarışta emojiyle hızlı tepkiler (👏😂😡😱🔥👋)
- 👻 Zamana Karşı modu: en iyi turunun hayaletiyle yarış, pist başına rekorlar
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

- **Drift:** Virajda direksiyonu kırıp drift'e bas. Kıvılcımlar mavi → turuncu → mor
  oldukça bırakınca aldığın turbo uzar.
- **Roket kalkış:** Geri sayımda "BAŞLA!" yazısından hemen önce gaza bas.
- Grafik kalitesi: **Ayarlar**'dan ya da adrese `?q=low`, `?q=medium`, `?q=high` ekleyerek.

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
  tracks/          Pist tanımları (kontrol noktaları + tema + dekor)
  race.js          Tur, sıralama, checkpoint, bitiş
  items.js         Item kutuları ve itemler
  ai.js            Botlar
  net.js remote.js Sunucu bağlantısı, durum senkronu ve interpolasyon
  audio.js         Müzik, efektler, kodla üretilen motor sesi
  ui/              Menü, HUD, dokunmatik kontroller, mini harita
public/models      Kenney 3D modelleri (CC0)
public/audio       Ses ve müzikler (CC0)
tools/             Test aracı (sahte oyuncu)
```

### Yeni pist eklemek

1. `src/tracks/` altına `palmCove.js`'i örnek alarak yeni bir dosya aç:
   kontrol noktaları (`control`), tema renkleri, kullanılan modeller ve `decorate` fonksiyonu.
2. `src/tracks/index.js`'e ekle.
3. `server/rooms.js` içindeki `TRACKS` listesine kimliğini yaz.

Mimari bilinçli olarak basit: framework yok, veritabanı yok, hesap yok.

---

## Lisanslar

Kod bu projeye aittir. Kullanılan tüm 3D modeller, sesler, müzikler ve yazı tipleri
CC0 / OFL / MIT lisanslıdır; ayrıntılar [CREDITS.md](CREDITS.md) dosyasında.
