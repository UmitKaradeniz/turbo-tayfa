// Not: Node 22 ve Cloudflare Workers'ta ortak `crypto` (Web Crypto) kullanılır; bu dosya iki ortamda da çalışır.

// Oda / lobi / yarış yönetimi. Bellekte; veritabanı yok. `createRooms()` kendi oda tablosunu taşır:
// Node'da tek örnek (server/index.js), Cloudflare'de oda başına bir Durable Object (worker/index.js).
//
// Mesajlar JSON: { type, ... }. İstemci → sunucu:
//   create {name, character, vehicle}  join {code, name, character, vehicle}
//   resume {code, token}              character {character}   vehicle {vehicle}   look {paint, trail}
//   settings {laps, difficulty, track, mode}   ready {ready}
//   start {trackCount | trackCounts}  nextRace (kupa)   state {s: {...}, bots: [{id, s}]}
//   finish {id, time}                 backToLobby
//   item {kind, id, owner, p, v}      hit {id, target}      box {i}
//   chat {text}                       emote {e, id?}
//   leave                             ping {t}
// Sunucu → istemci:
//   welcome {id, token, code}         room {...}           error {msg}
//   start {goAt, laps, difficulty, entrants}              states {list}
//   finish {id, time, place}          raceOver {cup}       pong {t, server}

const MAX_PLAYERS = 8;
const CHARACTERS = [
  'fox', 'penguin', 'panda', 'tiger', 'bunny', 'monkey', 'koala', 'parrot',
  'cat', 'dog', 'lion', 'elephant', 'giraffe', 'cow', 'pig', 'hog', 'chick', 'crab', 'deer', 'bee', 'caterpillar', 'polar', 'beaver', 'fish',
]; // istemcideki src/kartModel.js ile aynı kimlikler
const TRACKS = ['palmCove', 'pineValley', 'snowPeak', 'nightCity', 'volcano', 'moon', 'toyRoom', 'candyLand', 'funfair', 'graveyard', 'dinoValley', 'cappadocia', 'palmCoveSunset'];
// Turbo Kupası setleri (istemcideki src/tracks/index.js ile aynı olmalı)
const CUP_SETS = { cup: ['palmCove', 'pineValley', 'snowPeak', 'nightCity'], bigCup: TRACKS };
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışan 0/O, 1/I yok
const COUNTDOWN_MS = 3600 + 1500; // istemci geri sayımı + kamera geçişi payı
const RECONNECT_GRACE_MS = 60_000;
const STATE_HZ = 20;
const MIN_LAP_SECONDS = 12; // bundan hızlı tur = hile/hata
const MAX_PROGRESS_RATE = 40; // örnek/saniye, üstü reddedilir (kısayollar ilerlemeyi hızlandırır)
const RESULTS_TIMEOUT_MS = 45_000; // ilk bitiren + bu süre → yarış biter

export function createRooms(opts = {}) {
const fixedCode = opts.code ? String(opts.code).toUpperCase() : null; // Cloudflare: oda kodunu Worker belirler
const rooms = new Map();
let timer = null;

const now = () => Date.now();
const cleanName = (s) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, 14) || 'Pilot';

function newCode() {
  if (fixedCode) return rooms.has(fixedCode) ? null : fixedCode;
  for (;;) {
    let code = '';
    for (let i = 0; i < 5; i++) code += CODE_ALPHABET[crypto.getRandomValues(new Uint32Array(1))[0] % CODE_ALPHABET.length];
    if (!rooms.has(code)) return code;
  }
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, exceptId = null) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) {
    if (p.id !== exceptId && p.ws?.readyState === 1) p.ws.send(data);
  }
}

function roomView(room) {
  return {
    type: 'room',
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    settings: room.settings,
    cup: room.cup ? { round: room.cup.round, total: room.cup.tracks.length } : null,
    botHostId: room.phase === 'racing' ? room.botHostId ?? null : null,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      character: p.character,
      vehicle: p.vehicle,
      paint: p.paint,
      trail: p.trail,
      ready: p.ready,
      connected: !!p.ws,
    })),
  };
}

const syncRoom = (room) => broadcast(room, roomView(room));

function freeCharacter(room, wanted, exceptId) {
  const taken = new Set([...room.players.values()].filter((p) => p.id !== exceptId).map((p) => p.character));
  if (CHARACTERS.includes(wanted) && !taken.has(wanted)) return wanted;
  return CHARACTERS.find((c) => !taken.has(c));
}

const VEHICLES = ['balanced', 'agile', 'rocket', 'heavy', 'sprint'];
const cleanVehicle = (v) => (VEHICLES.includes(v) ? v : null); // null = istemci karakterin varsayılan aracını kullanır

// Kozmetik (boya/iz): yalnızca bilinen kimlikler kabul edilir; 'stock'/'classic' = varsayılan
const PAINTS = ['stock', 'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal', 'black', 'pearl', 'silver', 'gold', 'rainbow'];
const TRAILS = ['classic', 'violet', 'toxic', 'ice', 'candy', 'gold', 'ghost', 'rainbow'];
const cleanPaint = (v) => (PAINTS.includes(v) ? v : 'stock');
const cleanTrail = (v) => (TRAILS.includes(v) ? v : 'classic');

function addPlayer(room, ws, name, character, vehicle, look) {
  const p = {
    id: crypto.randomUUID().slice(0, 8),
    token: crypto.randomUUID(),
    name: cleanName(name),
    character: freeCharacter(room, character, null),
    vehicle: cleanVehicle(vehicle),
    paint: cleanPaint(look?.paint),
    trail: cleanTrail(look?.trail),
    ready: false,
    ws,
    leftAt: 0,
    lastSeen: now(),
    // yarış durumu (sunucu doğrulaması için)
    lastState: null,
    progress: null,
    progressAt: 0,
    finished: false,
  };
  room.players.set(p.id, p);
  ws.player = p;
  ws.room = room;
  send(ws, { type: 'welcome', id: p.id, token: p.token, code: room.code });
  return p;
}

// --- Sohbet ---
const CHAT_HISTORY = 30;
const EMOTE_COUNT = 6;
const cleanText = (s) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 120);

function pushChat(room, entry) {
  room.chat ??= [];
  room.chat.push(entry);
  if (room.chat.length > CHAT_HISTORY) room.chat.shift();
  broadcast(room, { type: 'chat', ...entry });
}

function systemChat(room, text) {
  pushChat(room, { id: null, name: null, text, sys: true, t: now() });
}

// Kısa sürede çok mesaj atmayı engelle (5 mesaj / 5 saniye)
function chatAllowed(p) {
  const t = now();
  p.chatTimes = (p.chatTimes ?? []).filter((x) => t - x < 5000);
  if (p.chatTimes.length >= 5) return false;
  p.chatTimes.push(t);
  return true;
}

function pickHost(room) {
  const next = [...room.players.values()].find((p) => p.ws);
  room.hostId = next?.id ?? null;
}

function removePlayer(room, p) {
  room.players.delete(p.id);
  if (room.players.size > 0) systemChat(room, `${p.name} odadan ayrıldı`);
  if (room.hostId === p.id) pickHost(room);
  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }
  if (room.phase === 'racing') {
    if (room.botHostId === p.id) room.botHostId = chooseBotHost(room, null);
    checkRaceOver(room);
  }
  syncRoom(room);
}

// --- Yarış ---
// Botları kimin cihazı sürsün? İstemcilerin bildirdiği FPS + ping'e göre en iyisi; yarış başlarken seçilir,
// yarış ortasında yalnızca bot sürücüsü ayrılırsa devredilir (sürekli el değiştirme botları sıçratır).
function perfScore(p) {
  const fps = p.perf?.fps > 0 ? Math.min(60, p.perf.fps) : 40;
  const rtt = Number.isFinite(p.perf?.rtt) ? p.perf.rtt : 80;
  return fps - rtt / 4;
}

function chooseBotHost(room, keepId) {
  const cands = [...room.players.values()].filter((p) => p.ws);
  if (!cands.length) return null;
  const best = cands.reduce((a, b) => (perfScore(b) > perfScore(a) ? b : a));
  const cur = cands.find((p) => p.id === keepId);
  // Mevcut aday yeterince iyiyse ya da fark küçükse değişmez
  if (cur && (perfScore(cur) >= 40 || perfScore(best) - perfScore(cur) < 12)) return cur.id;
  return best.id;
}

function startRace(room, trackCount) {
  room.botHostId = chooseBotHost(room, room.hostId);
  room.trackCount = trackCount;
  const humans = [...room.players.values()].filter((p) => p.ws);
  // İnsanlar karışık sırayla önde, botlar arkada
  const order = humans.sort(() => Math.random() - 0.5);
  const taken = new Set(order.map((p) => p.character));
  // Sahada her zaman 8 sürücü olur: insanlar + kalan yerler rastgele botlarla dolar
  // Kupada botlar tüm yarışlar boyunca aynı kalır (puan tablosu tutarlı olsun)
  let botChars = room.cup?.botChars;
  if (!botChars) {
    const pool = CHARACTERS.filter((c) => !taken.has(c)).sort(() => Math.random() - 0.5);
    botChars = pool.slice(0, Math.max(0, MAX_PLAYERS - order.length));
    if (room.cup) room.cup.botChars = botChars;
  }
  const bots = botChars.filter((c) => !taken.has(c)).map((c) => ({ id: `bot-${c}`, character: c }));
  room.entrants = [
    ...order.map((p) => ({ id: p.id, character: p.character, vehicle: p.vehicle, paint: p.paint, trail: p.trail, name: p.name, bot: false })),
    ...bots.map((b) => ({ id: b.id, character: b.character, name: null, bot: true })),
  ];
  room.botState = new Map(); // bot id → {state, progress, finished}
  room.things = new Map(); // item id → {kind, t, consumed}
  room.lastItemAt = new Map();
  room.finishOrder = [];
  room.firstFinishAt = 0;
  room.phase = 'racing';
  room.goAt = now() + COUNTDOWN_MS;
  for (const p of room.players.values()) {
    p.ready = false;
    p.lastState = null;
    p.progress = null;
    p.finished = false;
  }
  broadcast(room, { type: 'start', goAt: room.goAt, laps: room.settings.laps, difficulty: room.settings.difficulty, track: room.settings.track, entrants: room.entrants, botHostId: room.botHostId });
  syncRoom(room);
}

// İlerleme makul mü? (ışınlanma / aşırı hız)
function acceptProgress(holder, progress, t) {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return false;
  if (holder.progress === null) {
    holder.progress = progress;
    holder.progressAt = t;
    return true;
  }
  const dt = Math.max(0.05, (t - holder.progressAt) / 1000);
  const rate = (progress - holder.progress) / dt;
  if (rate > MAX_PROGRESS_RATE) return false;
  holder.progress = progress;
  holder.progressAt = t;
  return true;
}

// Bu oyuncu bu kartı (kendisi ya da oda sahibiyse bot) yönetebilir mi?
function controls(room, p, kartId) {
  if (kartId === p.id) return true;
  return room.botHostId === p.id && room.entrants?.some((e) => e.id === kartId && e.bot);
}

function recordFinish(room, id, time) {
  if (room.finishOrder.some((f) => f.id === id)) return;
  const minTime = MIN_LAP_SECONDS * room.settings.laps;
  if (!(time >= minTime)) return; // imkansız derecede hızlı
  // Sunucunun gördüğü süreyle de karşılaştır (istemci saati biraz sapabilir)
  const serverTime = (now() - room.goAt) / 1000;
  if (Math.abs(serverTime - time) > 5) time = serverTime;
  room.finishOrder.push({ id, time });
  if (!room.firstFinishAt) room.firstFinishAt = now();
  broadcast(room, { type: 'finish', id, time, place: room.finishOrder.length });
  checkRaceOver(room);
}

function checkRaceOver(room) {
  if (room.phase !== 'racing') return;
  const humansLeft = [...room.players.values()].filter((p) => p.ws && !room.finishOrder.some((f) => f.id === p.id));
  const timedOut = room.firstFinishAt && now() - room.firstFinishAt > RESULTS_TIMEOUT_MS;
  if (humansLeft.length === 0 || timedOut) {
    room.phase = 'results';
    broadcast(room, { type: 'raceOver', cup: room.cup ? scoreCupRound(room) : null });
    syncRoom(room);
  }
}

// --- Kupa: 4 pist sırayla, her yarışta sıraya göre puan ---
const CUP_POINTS = [15, 12, 10, 8, 6, 4, 2, 1];

function progressOfEntrant(room, e) {
  if (e.bot) return room.botState.get(e.id)?.progress ?? 0;
  return room.players.get(e.id)?.progress ?? 0;
}

// Bitirenler bitiş sırasıyla, bitirmeyenler ilerlemeye göre; puanlar karaktere yazılır
function scoreCupRound(room) {
  const cup = room.cup;
  const done = room.finishOrder.map((f) => room.entrants.find((e) => e.id === f.id)).filter(Boolean);
  const rest = room.entrants.filter((e) => !done.includes(e)).sort((a, b) => progressOfEntrant(room, b) - progressOfEntrant(room, a));
  const order = [...done, ...rest];
  order.forEach((e, i) => {
    const pts = CUP_POINTS[i] ?? 0;
    cup.points[e.character] = (cup.points[e.character] ?? 0) + pts;
    cup.lastPlace[e.character] = i + 1;
    cup.lastPts[e.character] = pts;
  });
  cup.final = cup.round >= cup.tracks.length - 1;
  const standings = order
    .map((e) => ({ character: e.character, name: e.bot ? null : e.name, place: cup.lastPlace[e.character], pts: cup.lastPts[e.character], total: cup.points[e.character] }))
    .sort((a, b) => b.total - a.total || a.place - b.place);
  return { round: cup.round, total: cup.tracks.length, final: cup.final, standings };
}

// --- Mesaj işleme ---
function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (!msg || typeof msg.type !== 'string') return;
  const p = ws.player;
  const room = ws.room;
  if (p) p.lastSeen = now();

  switch (msg.type) {
    case 'ping':
      // İstemci FPS ve ping'ini bildirir (bot sürücüsü seçimi için)
      if (p && Number.isFinite(msg.fps) && Number.isFinite(msg.rtt)) p.perf = { fps: Math.max(0, Math.min(240, msg.fps)), rtt: Math.max(0, Math.min(5000, msg.rtt)) };
      send(ws, { type: 'pong', t: msg.t, server: now() });
      return;

    case 'create': {
      if (p) return;
      const code = newCode();
      if (!code) return;
      const r = { code, hostId: null, phase: 'lobby', settings: { laps: 3, difficulty: 'normal', track: 'palmCove', mode: 'race' }, players: new Map(), emptySince: 0 };
      rooms.set(code, r);
      if (fixedCode && !timer) startTicker(); // Cloudflare: ticker oda varken çalışır, oda bitince durur (DO uyuyabilsin)
      const me = addPlayer(r, ws, msg.name, msg.character, msg.vehicle, msg.look);
      r.hostId = me.id;
      syncRoom(r);
      return;
    }

    case 'join': {
      if (p) return;
      const r = rooms.get(String(msg.code ?? '').toUpperCase());
      if (!r) return send(ws, { type: 'error', code: 'no-room', msg: 'Bu kodla bir oda bulunamadı.' });
      if (r.phase !== 'lobby') return send(ws, { type: 'error', code: 'in-race', msg: 'Bu odada yarış sürüyor. Bitince tekrar dene.' });
      if (r.players.size >= MAX_PLAYERS) return send(ws, { type: 'error', code: 'full', msg: 'Oda dolu (en fazla 8 oyuncu).' });
      const joined = addPlayer(r, ws, msg.name, msg.character, msg.vehicle, msg.look);
      if (!r.hostId) pickHost(r);
      send(ws, { type: 'chatHistory', list: r.chat ?? [] });
      systemChat(r, `${joined.name} odaya katıldı`);
      syncRoom(r);
      return;
    }

    case 'resume': {
      // Bağlantı koptuktan sonra aynı oyuncu olarak geri dön
      const r = rooms.get(String(msg.code ?? '').toUpperCase());
      const old = r && [...r.players.values()].find((x) => x.token === msg.token);
      if (!old) return send(ws, { type: 'error', code: 'no-resume', msg: 'Oturum süresi doldu.' });
      if (old.ws && old.ws !== ws) old.ws.close();
      old.ws = ws;
      old.leftAt = 0;
      old.lastSeen = now();
      ws.player = old;
      ws.room = r;
      if (!r.hostId) pickHost(r);
      send(ws, { type: 'welcome', id: old.id, token: old.token, code: r.code, resumed: true });
      send(ws, { type: 'chatHistory', list: r.chat ?? [] });
      syncRoom(r); // önce oda (kim sahip), sonra yarış bilgisi
      if (r.phase === 'racing') {
        send(ws, {
          type: 'start',
          goAt: r.goAt,
          laps: r.settings.laps,
          difficulty: r.settings.difficulty,
          track: r.settings.track,
          entrants: r.entrants,
          botHostId: r.botHostId,
          resume: old.lastState,
          bots: [...r.botState].filter(([, b]) => b.state).map(([id, b]) => ({ id, s: b.state })),
          finishes: r.finishOrder,
        });
      }
      return;
    }
  }

  if (!p || !room) return;

  switch (msg.type) {
    case 'character':
      if (room.phase !== 'lobby') return;
      p.character = freeCharacter(room, msg.character, p.id);
      syncRoom(room);
      return;

    case 'vehicle':
      if (room.phase !== 'lobby') return;
      p.vehicle = cleanVehicle(msg.vehicle);
      syncRoom(room);
      return;

    case 'look': // her aşamada kabul; sonraki yarışın başlangıcında diğerlerine gider
      p.paint = cleanPaint(msg.paint);
      p.trail = cleanTrail(msg.trail);
      syncRoom(room);
      return;

    case 'name':
      p.name = cleanName(msg.name);
      syncRoom(room);
      return;

    case 'settings':
      if (room.hostId !== p.id || room.phase !== 'lobby') return;
      if ([1, 3, 5].includes(msg.laps)) room.settings.laps = msg.laps;
      if (['easy', 'normal', 'hard'].includes(msg.difficulty)) room.settings.difficulty = msg.difficulty;
      if (TRACKS.includes(msg.track)) room.settings.track = msg.track;
      if (['race', 'cup', 'bigCup'].includes(msg.mode)) room.settings.mode = msg.mode;
      syncRoom(room);
      return;

    case 'ready':
      p.ready = !!msg.ready;
      syncRoom(room);
      return;

    case 'start': {
      if (room.hostId !== p.id || room.phase !== 'lobby') return;
      const others = [...room.players.values()].filter((x) => x.ws && x.id !== p.id);
      if (others.some((x) => !x.ready)) return send(ws, { type: 'error', code: 'not-ready', msg: 'Herkes hazır olmadan başlatılamaz.' });
      const okCount = (n) => Number.isFinite(n) && n > 50 && n < 5000;
      if (CUP_SETS[room.settings.mode]) {
        // Kupa: setteki her pistin örnek sayısı baştan gelir (sonraki pistler için ilerleme doğrulaması)
        const tracks = CUP_SETS[room.settings.mode];
        const counts = {};
        for (const id of tracks) {
          counts[id] = Number(msg.trackCounts?.[id]);
          if (!okCount(counts[id])) return;
        }
        room.cup = { round: 0, tracks, counts, points: {}, lastPlace: {}, lastPts: {}, final: false };
        room.settings.track = tracks[0];
        startRace(room, counts[tracks[0]]);
        return;
      }
      const count = Number(msg.trackCount);
      if (!okCount(count)) return;
      room.cup = null;
      startRace(room, count);
      return;
    }

    case 'nextRace': {
      // Kupa: oda sahibi sonuç ekranından sıradaki pisti başlatır
      if (room.hostId !== p.id || room.phase !== 'results' || !room.cup || room.cup.final) return;
      room.cup.round++;
      room.settings.track = room.cup.tracks[room.cup.round];
      startRace(room, room.cup.counts[room.settings.track]);
      return;
    }

    case 'state': {
      if (room.phase !== 'racing' || !msg.s) return;
      const t = now();
      if (acceptProgress(p, msg.s.pr, t)) p.lastState = msg.s;
      // Botları sadece bot sürücüsü (en iyi cihaz) gönderebilir
      if (room.botHostId === p.id && Array.isArray(msg.bots)) {
        for (const b of msg.bots.slice(0, MAX_PLAYERS)) {
          if (!room.entrants.some((e) => e.id === b.id && e.bot)) continue;
          let holder = room.botState.get(b.id);
          if (!holder) room.botState.set(b.id, (holder = { progress: null, progressAt: 0, state: null }));
          if (acceptProgress(holder, b.s?.pr, t)) holder.state = b.s;
        }
      }
      return;
    }

    // --- Itemler ---
    case 'item': {
      // Fırlatılan hindistan cevizi / bırakılan yağ lekesi: diğerlerine duyur
      if (room.phase !== 'racing' || !['coconut', 'oil'].includes(msg.kind)) return;
      const owner = String(msg.owner ?? '');
      if (!controls(room, p, owner)) return;
      const id = String(msg.id ?? '');
      if (!id.startsWith(owner + ':') || id.length > 40 || room.things.has(id)) return;
      const t = now();
      if (t - (room.lastItemAt.get(owner) ?? 0) < 700) return; // item yağmuru yok
      room.lastItemAt.set(owner, t);
      room.things.set(id, { kind: msg.kind, t, consumed: false });
      const vec = (a) => (Array.isArray(a) && a.length === 3 && a.every(Number.isFinite) ? a : [0, 0, 0]);
      broadcast(room, { type: 'item', kind: msg.kind, id, owner, p: vec(msg.p), v: vec(msg.v) }, p.id);
      return;
    }

    case 'hit': {
      // Vurulan kartın cihazı isabeti bildirir; item gerçekten var ve tüketilmemiş olmalı
      if (room.phase !== 'racing') return;
      const target = String(msg.target ?? '');
      if (!controls(room, p, target)) return;
      const thing = room.things.get(String(msg.id));
      if (!thing || thing.consumed || now() - thing.t > 30_000) return;
      thing.consumed = true;
      broadcast(room, { type: 'hit', id: String(msg.id), target }, p.id);
      return;
    }

    case 'box':
      if (room.phase === 'racing' && Number.isInteger(msg.i) && msg.i >= 0 && msg.i < 64) broadcast(room, { type: 'box', i: msg.i }, p.id);
      return;

    // --- Sohbet ve hızlı tepkiler ---
    case 'chat': {
      const text = cleanText(msg.text);
      if (!text) return;
      if (!chatAllowed(p)) return send(ws, { type: 'error', code: 'chat-rate', msg: 'Biraz yavaş, mesajlar çok hızlı gidiyor.' });
      pushChat(room, { id: p.id, name: p.name, character: p.character, text, t: now() });
      return;
    }

    case 'emote': {
      // Oyuncunun kendisi ya da oda sahibiyse botlar adına
      const id = String(msg.id ?? p.id);
      if (!Number.isInteger(msg.e) || msg.e < 0 || msg.e >= EMOTE_COUNT || !controls(room, p, id)) return;
      room.lastEmoteAt ??= new Map();
      const t = now();
      if (t - (room.lastEmoteAt.get(id) ?? 0) < 700) return;
      room.lastEmoteAt.set(id, t);
      broadcast(room, { type: 'emote', id, e: msg.e }, p.id);
      return;
    }

    case 'finish': {
      if (room.phase !== 'racing') return;
      const id = msg.id ?? p.id;
      const isMe = id === p.id;
      const isBot = room.botHostId === p.id && room.entrants.some((e) => e.id === id && e.bot);
      if (!isMe && !isBot) return;
      // Sunucunun takip ettiği ilerleme tur sayısına ulaşmış olmalı
      const holder = isMe ? p : room.botState.get(id);
      const needed = room.trackCount * room.settings.laps;
      if (!holder || holder.progress === null || holder.progress < needed - 5) return;
      recordFinish(room, id, Number(msg.time));
      return;
    }

    case 'backToLobby':
      if (room.phase === 'results' || (room.phase === 'racing' && room.hostId === p.id)) {
        room.phase = 'lobby';
        room.cup = null;
        syncRoom(room);
      }
      return;

    case 'leave':
      ws.player = null;
      ws.room = null;
      removePlayer(room, p);
      return;
  }
}

function handleClose(ws) {
  const p = ws.player;
  const room = ws.room;
  if (!p || !room || p.ws !== ws) return;
  p.ws = null;
  p.leftAt = now();
  if (room.phase === 'racing' && room.botHostId === p.id) room.botHostId = chooseBotHost(room, null); // bağlantısı kopan botları sürmeyi bırakır
  if (room.hostId === p.id) {
    // Kısa kopmalarda (sayfa yenileme, anlık ağ kaybı) sahipliği hemen devretme
    setTimeout(() => {
      if (!p.ws && room.hostId === p.id && rooms.has(room.code)) {
        pickHost(room);
        syncRoom(room);
      }
    }, 4000);
  }
  syncRoom(room);
  if (room.phase === 'racing') checkRaceOver(room);
}

// Periyodik: durum yayını + zaman aşımları
function startTicker() {
  if (timer) return;
  timer = setInterval(() => {
    const t = now();
    if (fixedCode && rooms.size === 0) {
      clearInterval(timer);
      timer = null;
      return;
    }
    for (const room of rooms.values()) {
      if (room.phase === 'racing') {
        const list = [];
        for (const p of room.players.values()) if (p.lastState && p.ws) list.push({ id: p.id, s: p.lastState });
        for (const [id, b] of room.botState) if (b.state) list.push({ id, s: b.state });
        if (list.length) broadcast(room, { type: 'states', server: t, list });
        for (const [id, th] of room.things) if (t - th.t > 30_000) room.things.delete(id);
        checkRaceOver(room);
      }
      // Sessiz kalan (telefon uyudu, ağ koptu) bağlantıları kapat; istemci 5 sn'de bir ping atar
      for (const p of room.players.values()) if (p.ws && t - p.lastSeen > 45_000) p.ws.close();
      // Uzun süredir kopuk oyuncuları çıkar
      for (const p of [...room.players.values()]) {
        if (!p.ws && p.leftAt && t - p.leftAt > (room.phase === 'lobby' ? 15_000 : RECONNECT_GRACE_MS)) removePlayer(room, p);
      }
    }
  }, 1000 / STATE_HZ);
}

const stats = () => ({ rooms: rooms.size, players: [...rooms.values()].reduce((n, r) => n + r.players.size, 0) });

return { handleMessage, handleClose, startTicker, stats, isEmpty: () => rooms.size === 0 };
}
