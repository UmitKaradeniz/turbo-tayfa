# Turbo Tayfa — Credits

Oyunda kullanılan tüm üçüncü taraf assetler ve lisansları. Orijinal lisans
dosyaları `public/models/LICENSE-*.txt` altında duruyor.

## 3D modeller

Hepsi **Kenney** ([kenney.nl](https://www.kenney.nl)) tarafından hazırlandı ve
**Creative Commons CC0 1.0** ([lisans metni](https://creativecommons.org/publicdomain/zero/1.0/))
ile yayımlandı: ticari kullanım dahil serbest, atıf zorunlu değil. Yine de teşekkür ediyoruz. ❤️

| Paket | Sürüm | Kaynak | Lisans | Oyunda kullanılan modeller | Nerede |
|---|---|---|---|---|---|
| Car Kit | 3.1 | https://kenney.nl/assets/car-kit | CC0 1.0 | `kart-oobi`, `kart-oodi`, `kart-ooli`, `kart-oopi`, `kart-oozi` (+ `Textures/colormap.png`) | Oyuncu kartları (Kenney'in kasklı sürücüsü gizlenip yerine Cube Pets hayvanı oturtuldu) |
| Cube Pets | 2.0 | https://kenney.nl/assets/cube-pets | CC0 1.0 | `animal-fox`, `animal-penguin`, `animal-panda`, `animal-tiger`, `animal-bunny`, `animal-monkey`, `animal-koala`, `animal-parrot` (+ `Textures/colormap.png`) | Sürücü karakterler (animasyonlarıyla) |
| Racing Kit | 2.0 | https://kenney.nl/assets/racing-kit | CC0 1.0 | `barrierRed`, `barrierWhite`, `overheadLights`, `flagCheckers`, `grandStandCovered`, `bannerTowerRed`, `bannerTowerGreen`, `lightPostModern`, `billboard`, `tent`, `tentClosedLong` (+ projede duran ama henüz kullanılmayan `flagRed`, `flagGreen`, `grandStandCoveredRound`, `pitsGarage`, `pylon`) | Pist bariyerleri, başlangıç kapısı, tribünler, bayrak kuleleri, reklam panoları |
| Nature Kit | 2.1 | https://kenney.nl/assets/nature-kit | CC0 1.0 | `tree_palmTall`, `tree_palmBend`, `tree_palmShort`, `tree_palmDetailedTall`, `tree_palmDetailedShort`, `rock_largeA/B/C`, `rock_tallA`, `plant_bushLarge`, `plant_bush`, `grass_large`, `grass`, `flower_redA`, `flower_yellowA`, `platform_beach`, `canoe`, `tent_detailedOpen`, `campfire_stones`, `log`, `statue_head`; Çam Vadisi için `tree_pineTallA/B`, `tree_pineRoundA/C`, `tree_pineDefaultA`, `tree_cone`, `tree_detailed`, `rock_tallB`, `stump_round`, `log_stack`, `mushroom_red`, `mushroom_redGroup`, `flower_purpleA`, `tent_smallOpen`, `statue_obelisk` (+ henüz kullanılmayan `rock_smallA`) | Ada ve orman dekoru: palmiyeler, kayalar, bitkiler, iskeleler, kamp alanı, taş kafalar |

Not: Racing Kit reklam panolarındaki "TANKCO" logosu Kenney'in paket içindeki hayali markasıdır.

## Ses ve müzik

Orijinal lisans dosyaları `public/audio/LICENSE-*.txt` altında. Her ses OGG olarak ve
eski iOS Safari için ffmpeg ile üretilmiş MP3 kopyasıyla birlikte duruyor.

| Ses | Yazar | Kaynak | Lisans | Oyunda |
|---|---|---|---|---|
| Joyfully (loop) | MintoDog | https://opengameart.org/content/joyfully | CC0 1.0 | Yarış müziği (`music_race`) |
| Feel Good Island Loop | AntumDeluge (Brandon Morris'in eserinden) | https://opengameart.org/content/feel-good-island-loop | CC0 1.0 (sayfada OGA-BY 3.0 ile çift lisans; CC0 seçildi) | Menü/lobi müziği (`music_menu`) |
| Interface Sounds | Kenney | https://kenney.nl/assets/interface-sounds | CC0 1.0 | Arayüz tıklama/seçim, item kutusu, rulet, tur, kalkan patlaması |
| Impact Sounds | Kenney | https://kenney.nl/assets/impact-sounds | CC0 1.0 | Duvar/kart çarpması, isabet, yağ lekesi |
| Digital Audio | Kenney | https://kenney.nl/assets/digital-audio | CC0 1.0 | Geri sayım, BAŞLA, turbo, mini-turbo, roket kalkış, kalkan, fırlatma, savrulma |
| Music Jingles (Steel serisi) | Kenney | https://kenney.nl/assets/music-jingles | CC0 1.0 | Son tur ve bitiş jingle'ları |

Motor ve drift kayma sesleri dosya değildir; tarayıcıda WebAudio ile kodla üretilir (`src/audio.js`).

## Prosedürel içerik (bu projede üretildi)

- Asfalt dokusu, başlangıç çizgisi / grid çıkartması, bordür renkleri: kodla üretilen canvas dokuları (`src/track.js`)
- Ada zemini, deniz shader'ı, gökyüzü ve bulutlar: kodla üretildi (`src/track.js`, `src/environment.js`)
- Pist rotaları "Palmiye Koyu" ve "Çam Vadisi": özgün tasarım (`src/tracks/`)
- Item görselleri (Turbo Şişesi, Hindistan Cevizi, "?" item kutusu, Balon Kalkan, Yağ Lekesi): Kenney paketlerinde karşılığı olmadığı için kodla üretilen düşük poligonlu modeller ve canvas dokuları (`src/itemModels.js`)
- Karakter portreleri ve item ikonları: oyun içinde 3D modellerden çiziliyor (`src/ui/portraits.js`)

## Yazı tipleri

Google Fonts üzerinden yükleniyor; ikisi de **SIL Open Font License 1.1** (ticari kullanım serbest).

| Yazı tipi | Tasarımcı | Kaynak | Kullanım |
|---|---|---|---|
| Lilita One | Juan Montoreano | https://fonts.google.com/specimen/Lilita+One | Başlıklar, sıra, geri sayım |
| Nunito | Vernon Adams, Cyreal, Jacques Le Bailly | https://fonts.google.com/specimen/Nunito | Arayüz metinleri |

## Kütüphaneler

| Kütüphane | Lisans |
|---|---|
| [three.js](https://threejs.org) (GLTFLoader, EffectComposer, UnrealBloomPass, OutputPass, RoundedBoxGeometry dahil) | MIT |
| [Express](https://expressjs.com) | MIT |
| [ws](https://github.com/websockets/ws) | MIT |
| [Vite](https://vitejs.dev) | MIT |


## Yordamsal (kendi ürettiğimiz) içerik

Kar Zirvesi ve Neon Şehir pistlerindeki binalar, pencere/neon dokuları, sokak lambaları, kardan adamlar, kar yağışı ve yıldızlı gökyüzü kod ile üretilir (src/city.js, src/props.js, src/environment.js); harici dosya kullanılmaz. Ağaç ve kaya modelleri mevcut Kenney Nature Kit paketindendir (CC0).
