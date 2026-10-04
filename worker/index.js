// Cloudflare Worker: statik oyun dosyaları (Workers Assets) + çok oyunculu odalar (Durable Object).
// Her oda kendi Durable Object'inde yaşar; mantık Node sunucusuyla ortaktır (server/rooms.js).
// Render'daki Node sunucusu (server/index.js) aynı kodla çalışmaya devam eder: geri dönüş yolu.
import { createRooms } from '../server/rooms.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').slice(0, n);

export class RoomDO {
  constructor(ctx) {
    this.ctx = ctx;
    this.game = null;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket bekleniyor', { status: 426 });
    this.game ??= createRooms({ code: request.headers.get('x-room-code') });
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    server.addEventListener('message', (e) => typeof e.data === 'string' && this.game.handleMessage(server, e.data));
    server.addEventListener('close', () => this.game.handleClose(server));
    server.addEventListener('error', () => {});
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket bekleniyor', { status: 426 });
      let code = (url.searchParams.get('c') ?? '').toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(code)) {
        if (!url.searchParams.has('create')) return new Response('Geçersiz oda kodu', { status: 400 });
        code = newCode();
      }
      const req = new Request(request);
      req.headers.set('x-room-code', code);
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(req);
    }

    if (url.pathname === '/health') return Response.json({ ok: true, platform: 'cloudflare' });

    // Tarayıcı hata raporları: `npx wrangler tail` içinde "[istemci]" ile aranabilir
    if (url.pathname === '/api/log' && request.method === 'POST') {
      try {
        const b = JSON.parse((await request.text()).slice(0, 4096));
        const fields = ['v', 'ua', 'vp', 'touch', 'track', 'quality', 'pixelRatio', 'fps', 'gpu', 'mode', 'online'];
        const extra = fields.map((k) => (b[k] === undefined ? '' : `${k}=${clip(b[k], 120)}`)).filter(Boolean).join(' | ');
        console.error(`[istemci] ${clip(b.kind, 20)}: ${clip(b.msg, 300)} | ${extra}${b.stack ? ` | ${clip(b.stack, 700)}` : ''}`);
      } catch {}
      return new Response(null, { status: 204 });
    }

    return env.ASSETS.fetch(request);
  },
};
