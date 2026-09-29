import express from 'express';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { handleMessage, handleClose, startTicker, stats } from './rooms.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.argv.includes('--prod');
const PORT = Number(process.env.PORT) || 3000;

const app = express();
const server = http.createServer(app);

app.get('/health', (_req, res) => res.json({ ok: true, ...stats() }));

// --- WebSocket (oda/lobi/yarış) ---
// noServer: aynı HTTP sunucusundaki Vite HMR websocket'ine karışmamak için
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') return;
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
