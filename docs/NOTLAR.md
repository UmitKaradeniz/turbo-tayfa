# Turbo Tayfa notları (gerekince oku)

## Sistemler (nerede, nasıl)
- **Eğim fiziği:** `SLOPE` (`src/config.js`); yokuşta hız sınırı düşer, inişte aşılır, tepe/tümsekte `crest` havalanma (`Kart.updateGround`). Pist tanımı: `control [x,z,y]`, `bank:[{f,deg}]`, `bumps:[{f,amp,period}]`, `hillReach`. Taşan yol (`y<0.1`, `noWater` yoksa) %10 yavaşlatır.
- **Grafik kalite:** `src/quality.js` (auto/low/medium/high; otomatik mod 6 kademe: low, lowplus, medlow, medium, highlow, high; `tt-auto` localStorage; ilk tahmin `gpuTier`), `src/autoQuality.js` (menüde ölçüm + yarış içi strike). `adaptResolution` (main.js) geri sayımda ve ilk 2 sn'de çözünürlük değiştirmez (donma sebebiydi). Teşhis: `?q=`, `?sky=0|1`, `?tex=0|1`, `?msaa=0`, `?bloom=0`, `?shadows=0`.
- **Araç sınıfları:** `src/vehicles.js` (hız/ivme/tutuş/ağırlık çarpanları), `settings.vehicle`, sunucuda `vehicle` mesajı. Her pistin kendi araç gövdesi var (`kartBody` → `Kart.setBodyOverride`, `kartModel.js` `specOf` ölçek 0.85×2); gövde dosyaları `public/models/karts/kart-<pist>.glb`, üretici `tools/gen_kart.py`.
- **Menü:** 4 adımlı sihirbaz (`src/ui/menu.js` `setStep`: karakter, araç, pist ve mod, hazır); alt çubuk `.wiz-bar`. Font: Baloo 2, `public/fonts` (self-host).
- **Sonuç tablosu:** `hud.showResults` ilk çağrıda çizer, sonrakilerde yerinde günceller (`data-id`, `.wait` "yükleniyor…").
- **Parçacıklar:** `src/effects.js`; duman/toz/çamur Kenney atlas sprite'ı (`public/fx/particles.png`), kıvılcım ve nitro alevi eski parlak yuvarlak nokta (`soft:'sharp'`). Item simgeleri: `src/itemIcons.js` (SVG).
- **Gökyüzü/doku:** `def.skyTex` (`public/sky`), `def.groundTex`/`roadTex` (`public/tex`), yalnız Orta/Yüksek kalitede.
- **Ses:** `src/audio.js` varyantlar (`VARIANTS`), müzik pist başına.

## Bilinen sınırlar
Gerçek telefonda ve iki gerçek cihazda test edilmedi. Önizleme paneli gizliyken animasyon/rAF ilerlemez. Botlar iniş hız bonusunu tam kullanmaz.

## Fikir listesi (sorulmadan başlama)
Çok bölgeli tek pist (liman→şehir→sahil→orman; mimari pist başına tek tema, büyük refaktör); Orman Geçidi pisti (çamur, kristalli mağara tüneli, çıkışta güneş patlaması beyazlaması); köprüde uçarak geçme; Çöl Kanyonu pisti; gamepad + erişilebilirlik ayarları; PWA; başarımlar; hava durumu; gökyüzü yansıması (PMREM); hareketli dinozorlar.

## Son değişiklikler
- v1.56.1 eğme ayarı satırı artık her cihazda görünür (isTouchDevice ile gizlenince bazı telefonlarda görünmüyordu)
- v1.56.0 eğme ile direksiyon (mobil): `src/tilt.js` (devicemotion, yerçekimi x-y açısı = telefonu direksiyon gibi çevirme; işaret/yön bağımsız; ölü bölge 4°, tam dönüş 30°; yarış başlayana kadar sürekli kalibrasyon `readInput(calibrate)`), ayar `tiltSteer` (varsayılan kapalı, Ayarlar > "Telefonu çevirerek direksiyon"), açıkken sol-sağ butonlar gizlenir (`#touch.tilt`), gaz yine otomatik; iOS izni ayar dokunuşunda istenir
- v1.55.0 MSAA yerine FXAA: orta/yüksek kalitede composer MSAA 0 + `fxaa` (postfx.js, OutputPass sonrası `FXAAShader`; çözünürlük uniform `syncFxaa`). Ölçüm (Radeon iGPU 1080p high): 32 → 59 FPS
- Gerçek GPU ölçümü: `node tools/dev/cdp-gpu-bench.mjs <pist> <q> "<ek sorgu>"...` (AMD Radeon iGPU, 1080p, high, palmCove): referans 32 FPS · gökyüzü etkisiz (55.1 vs 55.0) · composer MSAA 4x ~12 ms (msaa=0 → 51 FPS, msaa=2 → 35) · bloom ~2 ms · gölge ~3-5 ms · hepsi kapalı 66-71 FPS. `?fixres` dinamik çözünürlüğü kapatır
- v1.54.3 dinamik çözünürlük sakinleşti: ilk 6 sn bekle, 3 sn kalıcı <45 FPS → FPS oranına göre tek hamlede hedefe in (oran²~piksel), 6 sn bekleme, yarışta en çok 3 değişim, yukarı çıkış yok, taban 0.8
- v1.54.2 beyaz ekran parlaması: `adaptResolution` setSize'ı çizimden sonra yapıyordu (tuval temizlenir, boş kare görünür; masaüstünde yüksek pixelRatio ile ilk 10 sn art arda düşüş). Artık `ratioDirty` + `applyPixelRatio()` çizimden önce
- v1.54.1 geri sayım takılması: yarış müziği (43 MB PCM) `preloadMusic` ile pist seçilirken çözülür; `buildTrackNow` sonunda `renderer.compile` + `initTexture` (menüde ısınma). Ölçüm: `cdp-countdown.mjs` (yazılım GL kare süresi güvenilmez, `ev` içinde `decoded` olayı artık geri sayımda yok)
- v1.54.0 açılan köprü kaldırıldı (kullanıcı: görünüşü içinden geçiliyormuş gibi, güvenilmez); `bridge` tipi ve `makeBridge` silindi, Palmiye Koyu'nda 2 yengeç kaldı
- v1.53.0 açılan köprü tehlikesi (`hazards.js` tip `bridge`, `makeBridge`, zamana bağlı: uyarı 2 sn → kalkar → bekler → iner; kanat >0.5 rad iken dikdörtgen alanda `spinOut`; botlar kaçmaz; Palmiye Koyu f 0.93, grid arkasında; dev `__tt.hazards`). Gerçek 'uçarak geçme' yok. Paket C bitti
- v1.52.0 havada boost + kum tepesi rampası (`kart.js` `airTime`, `AIR_BOOST_MIN` 0.7 s, yalnız `def.airBoost` pistlerinde inişte `boost(0.5–1.2)` + olay `airBoost`; zon `dune` = `bounce` 13.5 + kum dokusu; Palmiye Koyu f 0.128 ve 0.628, yan şeritten kaçılır)
- v1.51.0 far ışığı süzmesi (`kart.js` `setBeams(k)`, tek birleşik koni mesh, ortak geometri/materyal; `main.js` loadTrack: `QUALITY.beams ? (def.beams ?? (def.night?1:0))`; `quality.js` `beams` yalnız medlow ve üstü; Gün Batımı `beams:0.6`)
- v1.50.0 seyirciler (`src/crowd.js` 3 InstancedMesh, kol sallama köşe gölgelendiricide; `decor.js` `ctx.crowdRow(i0,i1,lateral,{every,rows,rowGap,scale})`, `QUALITY.decor<0.5` yani Düşük'te yok; Palmiye Koyu + Gün Batımı + Neon Şehir start; `Q=medium node tools/dev/cdp-preview.mjs` kalite seçer)
- v1.49.0 Palmiye Koyu Gün Batımı (`tracks/palmCoveSunset.js` = palmCove + `sky/light/water`; `def.kit` donanımı ana pistten alır, `MUSIC_ALIAS` müzik, `light.cloud` bulut rengi; `rooms.js` TRACKS'e eklendi)
- v1.48.0 ahşap iskele zonu (`track.js` `ZONE_TYPES.boardwalk`, tahta dokusu `zoneTexture`, `audio.js` tıkırtı darbeleri `kart.surface==='boardwalk'`; Palmiye Koyu f 0.015–0.095)
- v1.47.0 yengeç tehlikesi (`hazards.js` skin `crab`, `cross` paramı, vuruşta spin yok yalnız %55 yavaşlama; model `tools/gen_crab.py` → `hazard/hazard-crab.glb`; Palmiye Koyu f 0.1/0.9/0.965). Paket C sırası: iskele zonu → Gün Batımı pisti → seyirciler → far ışığı → havada boost+`dune` → köprü
- v1.46.0 otomatik kalite: 6 kademeli merdiven, gevşek menü eşikleri (<47 FPS −1), 3 yarışta in/2 yarışta çık, tavan 3 gün, GPU ailesine göre ilk tahmin (Adreno/Mali/Apple)
- v1.45.1 Kapadokya kendi donanımı + aracı (`gen_kit_cappadocia.py` → `kits/cappadocia`, `gen_kart_cappadocia.py` → `karts/kart-cappadocia` "Balon Sepeti"; kopya yok)
- v1.45.0 Kapadokya pisti (`tracks/cappadocia.js`; propları `gen_props.py`: chimney_a/b/c, mesa, hot_air_balloon; önizleme `tools/dev/cdp-preview.mjs`)
- v1.44.0 podyum sahnesi (`src/ui/podium3d.js`: sonuç şeridinde 3B podyum, ilk 3 dans, dönen kupa, konfeti; ayrı küçük WebGL bağlamı, yalnız tablo açıkken çizer)
- v1.43.0 süs propları (`public/models/tayfa`, 6 pistin `decorate` sonunda; kullanılmayan: start_arch, chevron_sign, flag_pole)
- v1.60.0 botları en iyi cihaz sürer: istemci `ping` ile fps+rtt bildirir (`net.perf`), sunucu `chooseBotHost` yarış başında seçer (`room.botHostId`; oda mesajı ve `start`'ta `botHostId`), yarış ortasında yalnızca sürücü kopunca devreder; test `tools/dev/bot-host-test.mjs <port>`
- v1.59.0 Cloudflare seçeneği: `worker/index.js` + `wrangler.jsonc` (oda başına Durable Object), `server/rooms.js` artık `createRooms()` fabrikası (Node + Worker ortak), istemci `/ws?c=KOD|create=1`; Render değişmeden çalışır. Ayrıntı `docs/CLOUDFLARE.md` · v1.58.0 ağ teşhis sayacı (`net.statsInfo`, FPS göstergesi)
- v1.42.0 tehlike GLB'leri (`public/models/hazard`, `hazards.js` `HAZARD_MODEL`, yüklenmezse kodlu mesh yedek; volcano skin `lava`)
- v1.41.0 her pist kendi donanımı (kemer/bayrak/kule/bariyer/tribün: `public/models/kits/<pist>`, `assets.js` `setKit`)
- v1.40.0 her pist kendi araç modelini kullanır
- v1.38.7 item simgeleri SVG (D2) · v1.38.6 geri sayım donması giderildi · v1.38.5 podyum "yükleniyor" boyutu · v1.38.4 yapımcı yazısı sol üst · v1.38.3 nitro eski parlak görünüm · v1.38.2 sonuç tablosu yerinde güncellenir · v1.38.1 Baloo 2 · v1.38.0 adımlı hazırlık
- v1.37 araç sınıfları · v1.36 ses varyantları · v1.35 yol/zemin dokuları · v1.34 gökyüzü · v1.33 parçacık atlası · v1.32 drift öğretisi · v1.22–v1.31 pist başına dağ-bayır profilleri · v1.21 otomatik kalite · v1.20 eğim fiziği
