# Turbo Tayfa

Tarayıcıda çok oyunculu 3B kart yarışı. Vite + Three.js istemci, tek Node süreci (Express + ws) sunucu. Türkçe arayüz. GitHub `UmitKaradeniz/turbo-tayfa`, Render `main`'e her push'ta otomatik yayınlar. Ayrıntılı harita ve kararlar: `docs/NOTLAR.md` (gerekince oku, baştan sona okuma).

## Çalışma kuralları (token tasarrufu; Pro plan limiti dar)
- Yanıtlar Türkçe ve kısa: ne değişti, sürüm bağlantısı, geri dönüş etiketi, bir satır sınır. Uzun anlatma yok.
- Ekran görüntüsü almak son çare. Önce sayısal ölçüm (`window.__tt`, DOM değerleri, headless Chrome betikleri `tools/dev/`). Gerekirse işin başına en çok 1 görüntü, `scale ≤ 0.5`. Kullanıcı "test etme" derse yalnızca derleme + yükleme duman testi yap.
- Büyük dosyayı baştan sona okuma: önce Grep, sonra `Read` ile `offset/limit`. Komut çıktısını `| tail`, `| head`, `grep` ile kısalt.
- Plan modunda yalnızca **bu işin** planını yaz; `ExitPlanMode`'a tüm plan dosyasını değil kısa planı ver. Biten işleri plan dosyasından sil (plan dosyası her turda bağlama girer). Küçük işlerde (renk, metin, tek satır) plan modu gereksiz, doğrudan yap.
- Alt ajan (Agent) kullanma, kullanıcı açıkça istemedikçe.
- İş bitince `docs/NOTLAR.md` "Son değişiklikler" bölümüne tek satır ekle; böylece sonraki oturum kodu yeniden keşfetmez.

## Sürüm kuralı
Her ek/düzeltme ayrı sürüm: `bash tools/dev/release.sh <sürüm> "<başlık>" "<notlar>" "" <önceki_etiket>` (sürüm artırır, derler, commit, etiket, push, GitHub Release). Push `gh` kimliğiyle yapılır (Git Credential Manager takılabiliyor). Yalnızca dokümantasyon/araç değişikliği: sürüm çıkarma, commit mesajına `[skip render]` ekle.

## Varlık kuralları
Yalnızca CC0 ve CC-BY (ticari güvenli). `CREDITS.md` ve `README.md` güncel tutulur. Kenney dışı paketlerde indirmeden önce ad/boyut söyle. Sunucuda hesap/veritabanı yok (basit mimari).

## Test ve komutlar
- Geliştirme sunucusu: `preview_start turbo-tayfa` (port 3000, `npm run dev`). Tarayıcı paneli gizliyken `requestAnimationFrame` çalışmaz: gerçek ölçüm için `node tools/dev/cdp-countdown.mjs <pist> <cpuYavaşlatma>` (headless Chrome, uzun görev ve kare süreleri). Pist duman testi: `node tools/dev/cdp-tracks-smoke.mjs`. Sunucu protokol testi: sunucuyu `PORT=3111 node server/index.js` ile aç, `node tools/dev/vehicle-protocol-test.mjs 3111`.
- Dev'de `window.__tt` (karts, race, hud, track, fx, simulate(sn), player…). URL: `?q=low|medium|high` (kalite), `?nopause`. Panelde `q=low` kullan (medium yazılım çizimiyle çok yavaş).
- Dosya yazarken Windows yolları: Python'a `C:\...` ver, Git Bash'e `/c/...`.

## Mimari özeti
`src/main.js` (oyun döngüsü, menü-yarış akışı), `src/kart.js` (fizik), `src/kartModel.js` (model), `src/vehicles.js` (araç sınıfları), `src/track.js` + `src/tracks/*.js` (11 pist; `kartBody`, `control` y profili, `bank`, `bumps`, `zones`), `src/ai.js`, `src/items.js`, `src/hazards.js`, `src/effects.js`, `src/environment.js`, `src/audio.js`, `src/ui/{menu,hud,chat}.js` + css, `server/rooms.js` (oda protokolü).
