import express from 'express';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createRooms } from './rooms.js';

const { handleMessage, handleClose, startTicker, stats } = createRooms();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.argv.includes('--prod');
const PORT = Number(process.env.PORT) || 3000;

const app = express();
const server = http.createServer(app);

// --- Tarayıcı hata raporları: Render → Logs içinde "[istemci]" ile aranabilir ---
// IP başına dakikada 12, toplamda dakikada 120 rapor; gövde en fazla 4 KB.
const logHits = new Map();
let logTotal = 0;
let logWindow = Date.now();
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').slice(0, n);
app.post('/api/log', express.json({ limit: '4kb', type: () => true }), (req, res) => {
  res.status(204).end();
  const now = Date.now();
  if (now - logWindow > 60_000) {
    logHits.clear();
    logTotal = 0;
    logWindow = now;
  }
  const ip = req.ip;
  const n = (logHits.get(ip) ?? 0) + 1;
  logHits.set(ip, n);
  if (n > 12 || ++logTotal > 120 || !req.body || typeof req.body !== 'object') return;
  const b = req.body;
  const fields = ['v', 'ua', 'vp', 'touch', 'track', 'quality', 'pixelRatio', 'fps', 'gpu', 'mode', 'online'];
  const extra = fields.map((k) => (b[k] === undefined ? '' : `${k}=${clip(b[k], 120)}`)).filter(Boolean).join(' | ');
  console.error(`[istemci] ${clip(b.kind, 20)}: ${clip(b.msg, 300)} | ${extra}${b.stack ? ` | ${clip(b.stack, 700)}` : ''}`);
});

app.get('/health', (_req, res) => res.json({ ok: true, ...stats() }));

// --- WebSocket (oda/lobi/yarış) ---
// noServer: aynı HTTP sunucusundaki Vite HMR websocket'ine karışmamak için
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on('upgrade', (req, socket, head) => {
  if (req.url.split('?')[0] !== '/ws') return; // ?c=KOD / ?create=1: Cloudflare sürümüyle ortak istemci sorgusu, burada yok sayılır
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
wss.on('connection', (ws) => {
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', (data) => handleMessage(ws, data.toString()));
  ws.on('close', () => handleClose(ws));
  ws.on('error', () => {});
});
// Ölü bağlantıları yakala (telefon uykuya geçti, Wi-Fi koptu vb.)
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 10_000);
startTicker();

// --- Statik dosyalar / Vite ---
if (isProd) {
  const dist = path.join(root, 'dist');
  const { default: compression } = await import('compression');
  app.use(compression());
  // Vite'ın ürettiği dosya adları içerik hash'i taşıdığı için uzun süre önbelleğe alınabilir
  app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(dist, { maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root,
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.listen(PORT, () => {
  console.log(`\n  Turbo Tayfa ${isProd ? '(prod)' : '(dev)'} hazır:`);
  console.log(`  → Bu bilgisayar:  http://localhost:${PORT}`);
  // Aynı Wi-Fi'deki telefon/bilgisayarlar için yerel ağ adresleri
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  → Yerel ağ:       http://${a.address}:${PORT}`);
    }
  }
  console.log('');
});
