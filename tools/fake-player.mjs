// Test aracı: bir odaya "sahte oyuncu" olarak katılır, hazır olur ve yarış
// başlayınca pistin orta çizgisini takip ederek tur atar.
// Kullanım:  npm run fake -- ODAKODU [sunucu-adresi] [isim]
// Örnek:     npm run fake -- ABCDE http://localhost:3000 Robot

import * as THREE from 'three';
import WebSocket from 'ws';
import palmCove from '../src/tracks/palmCove.js';

const [code, base = 'http://localhost:3000', name = 'Test Pilotu'] = process.argv.slice(2);
if (!code) {
  console.log('Kullanım: npm run fake -- ODAKODU [http://localhost:3000] [isim]');
  process.exit(1);
}

// Pist orta çizgisi: istemcidekiyle aynı hesap (src/track.js)
const curve = new THREE.CatmullRomCurve3(palmCove.control.map(([x, z, y]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
const count = Math.round(curve.getLength() / 2.5);
const points = curve.getSpacedPoints(count).slice(0, count);

const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws');
let offset = 0;
let myId = null;
let driveTimer = null;
const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const serverNow = () => Date.now() + offset;

ws.on('open', () => {
  send({ type: 'ping', t: Date.now() });
  send({ type: 'join', code: code.toUpperCase(), name, character: 'monkey' });
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw);
  switch (msg.type) {
    case 'pong':
      offset = msg.server - (msg.t + (Date.now() - msg.t) / 2);
      break;
    case 'welcome':
      myId = msg.id;
      console.log(`✓ Odaya katıldı: ${msg.code} (id ${myId})`);
      send({ type: 'ready', ready: true });
      break;
    case 'error':
      console.log('✗', msg.msg);
      process.exit(1);
      break;
    case 'room': {
      const list = msg.players.map((p) => `${p.name}${p.ready ? '✓' : ''}`).join(', ');
      console.log(`  oda: ${msg.phase} · ${list}`);
      if (msg.phase === 'lobby' && !msg.players.find((p) => p.id === myId)?.ready) send({ type: 'ready', ready: true });
      break;
    }
    case 'start':
      console.log(`▶ Yarış başlıyor (${msg.laps} tur)`);
      drive(msg);
      break;
    case 'finish':
      console.log(`🏁 ${msg.id === myId ? 'BEN' : msg.id} bitirdi: ${msg.place}. (${msg.time.toFixed(2)} s)`);
      break;
    case 'raceOver':
      console.log('Yarış bitti. Lobiye dönülüyor…');
      clearInterval(driveTimer);
      setTimeout(() => send({ type: 'backToLobby' }), 3000);
      break;
  }
});

ws.on('close', () => {
  console.log('Bağlantı kapandı.');
  process.exit(0);
});

function drive({ goAt, laps }) {
  clearInterval(driveTimer);
  const speed = 26; // m/s (~94 km/sa)
  const lane = 3;
  let progress = -8; // başlangıç çizgisinin biraz gerisi
  let finished = false;
  let last = Date.now();
  driveTimer = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    if (serverNow() >= goAt && !finished) progress += (speed * dt) / 2.5;
    const i = Math.floor(progress);
    const t = progress - i;
    const a = points[((i % count) + count) % count];
    const b = points[(((i + 1) % count) + count) % count];
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const right = new THREE.Vector3(dir.x, 0, dir.z).normalize().cross(new THREE.Vector3(0, 1, 0));
    const p = a.clone().lerp(b, t).addScaledVector(right, lane);
    const moving = serverNow() >= goAt && !finished;
    send({
      type: 'state',
      s: {
        t: Math.round(serverNow()),
        p: [p.x, p.y, p.z],
        h: Math.atan2(dir.x, dir.z),
        v: moving ? [dir.x * speed, 0, dir.z * speed] : [0, 0, 0],
        st: 0,
        dd: 0,
        dt: 0,
        pr: progress,
        l: Math.max(0, Math.floor(progress / count)),
      },
    });
    if (!finished && progress >= laps * count) {
      finished = true;
      send({ type: 'finish', time: (serverNow() - goAt) / 1000 });
    }
  }, 50);
}
