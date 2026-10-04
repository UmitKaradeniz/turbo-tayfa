# Cloudflare'de yayın (Render'a geri dönüş yolu açık)

Aynı depo iki yerde çalışır; istemci kodu ikisinde de aynıdır (`/ws?c=KOD` ya da `/ws?create=1`).

| | Render (Node) | Cloudflare |
|---|---|---|
| Giriş | `server/index.js` (Express + ws) | `worker/index.js` (Worker) |
| Oda mantığı | `server/rooms.js` `createRooms()` tek örnek | aynı dosya, **oda başına bir Durable Object** (`RoomDO`) |
| Statik dosyalar | Express `dist/` | Workers Assets (`wrangler.jsonc`, `public/_headers` önbellek) |
| Dağıtım | `main`'e push → otomatik | `npm run build && npx wrangler deploy` ya da Workers Builds |

## Kurulum (bir kez)
1. `npx wrangler login` (tarayıcıda Cloudflare hesabına izin ver).
2. `npm run build && npx wrangler deploy` → `https://turbo-tayfa.<hesap>.workers.dev`.
3. İsteğe bağlı otomatik: Cloudflare paneli → Workers & Pages → turbo-tayfa → Settings → Builds → GitHub deposunu bağla (build: `npm ci && npm run build`, deploy: `npx wrangler deploy`).

## Geri dönüş
Render servisi silinmediği sürece değişiklik gerekmez: eski Render adresini kullan. Cloudflare'i kapatmak için Workers panelinden `turbo-tayfa`'yı sil. İki taraf birbirinden bağımsızdır (odalar paylaşılmaz; aynı odadaki herkes aynı adresi kullanmalı).

## Yerel test
`npx wrangler dev --port 8788 --local` ardından `node tools/dev/vehicle-protocol-test.mjs 8788` (Node için: `PORT=3112 node server/index.js --prod`, port 3112).

## Notlar
- Ücretsiz Workers planı günde 100 bin istek verir; WebSocket mesajları 20'de 1 sayılır. 8 kişilik bir oda yaklaşık 8 istek/sn sayılır (~3,5 saatlik yarış/gün). Çok oynanırsa Workers Paid (5 $/ay) gerekir.
- Oda belleği Durable Object'te yaşar; boş kalıp uyuyunca/yeniden başlayınca oda gider (Render ile aynı davranış).
- Teşhis: Ayarlar > "FPS göstergesi" açıkken çevrimiçi yarışta ping, durum yayını hızı, sunucu/ağ en büyük aralık görünür.
- Hata raporları: `npx wrangler tail` içinde "[istemci]".
