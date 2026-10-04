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
Çöl Kanyonu pisti; gamepad + erişilebilirlik ayarları; PWA; başarımlar; hava durumu; gökyüzü yansıması (PMREM); hareketli dinozorlar.

## Son değişiklikler
- v1.46.0 otomatik kalite: 6 kademeli merdiven, gevşek menü eşikleri (<47 FPS −1), 3 yarışta in/2 yarışta çık, tavan 3 gün, GPU ailesine göre ilk tahmin (Adreno/Mali/Apple)
- v1.45.1 Kapadokya kendi donanımı + aracı (`gen_kit_cappadocia.py` → `kits/cappadocia`, `gen_kart_cappadocia.py` → `karts/kart-cappadocia` "Balon Sepeti"; kopya yok)
- v1.45.0 Kapadokya pisti (`tracks/cappadocia.js`; propları `gen_props.py`: chimney_a/b/c, mesa, hot_air_balloon; önizleme `tools/dev/cdp-preview.mjs`)
- v1.44.0 podyum sahnesi (`src/ui/podium3d.js`: sonuç şeridinde 3B podyum, ilk 3 dans, dönen kupa, konfeti; ayrı küçük WebGL bağlamı, yalnız tablo açıkken çizer)
- v1.43.0 süs propları (`public/models/tayfa`, 6 pistin `decorate` sonunda; kullanılmayan: start_arch, chevron_sign, flag_pole)
- v1.42.0 tehlike GLB'leri (`public/models/hazard`, `hazards.js` `HAZARD_MODEL`, yüklenmezse kodlu mesh yedek; volcano skin `lava`)
- v1.41.0 her pist kendi donanımı (kemer/bayrak/kule/bariyer/tribün: `public/models/kits/<pist>`, `assets.js` `setKit`)
- v1.40.0 her pist kendi araç modelini kullanır
- v1.38.7 item simgeleri SVG (D2) · v1.38.6 geri sayım donması giderildi · v1.38.5 podyum "yükleniyor" boyutu · v1.38.4 yapımcı yazısı sol üst · v1.38.3 nitro eski parlak görünüm · v1.38.2 sonuç tablosu yerinde güncellenir · v1.38.1 Baloo 2 · v1.38.0 adımlı hazırlık
- v1.37 araç sınıfları · v1.36 ses varyantları · v1.35 yol/zemin dokuları · v1.34 gökyüzü · v1.33 parçacık atlası · v1.32 drift öğretisi · v1.22–v1.31 pist başına dağ-bayır profilleri · v1.21 otomatik kalite · v1.20 eğim fiziği
