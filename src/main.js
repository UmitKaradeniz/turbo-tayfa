import * as THREE from 'three';
import { PHYSICS_HZ, KART } from './config.js';
import { QUALITY } from './quality.js';
import { settings, DIFFICULTY } from './settings.js';
import { readInput } from './input.js';
import { loadModels, hasModels } from './assets.js';
import { initErrorReports, setReportContext, reportIssue } from './report.js';
import { Kart, resolveKartCollisions } from './kart.js';
import { CHARACTERS, KART_MODELS } from './kartModel.js';
import { CameraRig } from './cameraRig.js';
import { buildTrack, trackOutline } from './track.js';
import { buildDecor } from './decor.js';
import { createEnvironment } from './environment.js';
import { createKartEffects } from './effects.js';
import { createPostFX } from './postfx.js';
import { createStartLights } from './startLights.js';
import { Race } from './race.js';
import { createDriver, driveInput, botEmote } from './ai.js';
import { createEmoteBubbles } from './emotes.js';
import { recordOf, submitTotal, createGhostRecorder, createGhost } from './records.js';
import { createChat } from './ui/chat.js';
import { Net } from './net.js';
import { RemoteBuffer, encodeState, applyRemoteState, INTERP_DELAY } from './remote.js';
import { createHud } from './ui/hud.js';
import { createMenu } from './ui/menu.js';
import { createMinimap } from './ui/minimap.js';
import { createNameplates } from './ui/nameplates.js';
import { renderPortraits, renderIcons } from './ui/portraits.js';
import { createTouchControls, isTouchDevice } from './ui/touch.js';
import { createItemSystem } from './items.js';
import { ITEM_ICON_MODELS } from './itemModels.js';
import { play, playMusic, updateEngine, applyVolumes } from './audio.js';
import { TRACKS, TRACK_IDS } from './tracks/index.js';

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: !QUALITY.bloom, powerPreference: 'high-performance' });
const basePixelRatio = Math.min(window.devicePixelRatio, QUALITY.pixelRatio);
let pixelRatio = basePixelRatio;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = QUALITY.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

// Ekran kartı adı (FPS göstergesinde; sürücüye özgü sorunları ayırt etmek için)
const gpuName = (() => {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return name.replace(/^ANGLE \(|\)$/g, '').replace(/Direct3D.*$/, '').replace(/\s*\(0x[0-9a-f]+\)/i, '').trim().slice(0, 60);
})();

// Hata raporları (sunucu loguna): yakalanmamış hatalar, WebGL kaybı, düşük FPS
let lastFps = 0;
initErrorReports();
setReportContext(() => ({ track: trackDef?.id, quality: QUALITY.name, pixelRatio: pixelRatio.toFixed(2), fps: Math.round(lastFps), gpu: gpuName, mode: timeTrial ? 'timeTrial' : race ? 'race' : 'menu', online: !!online }));
renderer.domElement.addEventListener('webglcontextlost', () => reportIssue('webgl', 'context lost'));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.3, 1500);
const postfx = createPostFX(renderer, scene, camera, QUALITY);

// --- Yükleme: karakterler + seçili pistin modelleri (diğer pistler seçilince yüklenir) ---
const loadingBar = document.querySelector('#loading .bar > div');
const firstModels = [...new Set([...KART_MODELS, ...(TRACKS[settings.track] ?? TRACKS.palmCove).models])];
await loadModels(firstModels, (p) => (loadingBar.style.width = `${Math.round(p * 100)}%`));

const env = createEnvironment(scene, QUALITY);
const fx = createKartEffects(scene, QUALITY);
const nameplates = createNameplates(scene);

// Tüm karakterler sahnede; menüde gridde bekler, yarışta oyuncu ya da bot olur
const karts = CHARACTERS.map((c) => {
  const kart = new Kart(c);
  kart.active = true; // çevrimiçide bağlantısı kopan oyuncunun kartı pasifleşir
  scene.add(kart.object);
  return kart;
});
const kartOf = (id) => karts.find((k) => k.character.id === id) ?? karts[0];

// --- Arayüz ---
const portraits = renderPortraits(renderer, CHARACTERS);
const itemIcons = renderIcons(renderer, ITEM_ICON_MODELS);
const hud = createHud({ portraits, minimap: null, itemIcons });
const touch = createTouchControls();
const net = new Net();

// Menüdeki pist küçük resimleri (sadece orta çizgiden)
const trackCards = TRACK_IDS.map((id) => {
  const def = TRACKS[id];
  const outline = trackOutline(def);
  const thumb = createMinimap(outline, 72);
  thumb.draw([]);
  return { id, name: def.name, meta: `${Math.round(outline.length)} m · ${def.meta}`, thumb: thumb.canvas.toDataURL() };
});

const chat = createChat({
  colorOf: (id) => CHARACTERS.find((c) => c.id === id)?.color ?? '#ffffff',
  onSend: (text) => online && net.send({ type: 'chat', text }),
  onEmote: (e) => sendEmote(player, e),
});
const emotes = createEmoteBubbles(scene);

const menu = createMenu({
  records: recordOf,
  chatPanel: chat.panel,
  characters: CHARACTERS,
  portraits,
  tracks: trackCards,
  handlers: {
    screen: (name) => setMenuView(name),
    character: (id) => {
      focus = kartOf(id);
      focus.model.play('gesture-positive');
      setTimeout(() => focus.model.play('idle'), 1400);
      play('ui_select');
      if (online) net.send({ type: 'character', character: id });
    },
    track: (id) => loadTrack(id),
    start: (config) => startOfflineRace(config),
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    restart: () => startOfflineRace(lastConfig),
    toMenu: () => (online ? leaveRoom() : toMenu()),
    settingsChanged: applySettings,
    // Çevrimiçi
    host: () => {
      online = newOnline();
      net.send({ type: 'create', name: playerName(), character: settings.character });
    },
    join: (code) => {
      online = newOnline();
      net.send({ type: 'join', code, name: playerName(), character: settings.character });
    },
    leaveRoom: () => leaveRoom(),
    lobbyButton: (action) => {
      if (action === 'start') net.send({ type: 'start', trackCount: track.count });
      else net.send({ type: 'ready', ready: action === 'ready' });
    },
    roomSettings: (patch) => net.send({ type: 'settings', ...patch }),
    toLobby: () => backToLobby(),
  },
});

// Butonlarda tık sesi
document.addEventListener('click', (e) => {
  if (e.target.closest('.tt-btn, .tt-seg button, .tt-track, #hud-pause')) play('ui_click', { volume: 0.6 });
});

const rig = new CameraRig(camera);
const debug = document.getElementById('debug');
function applySettings() {
  rig.shakeEnabled = settings.shake;
  debug.style.display = settings.showFps ? 'block' : 'none';
  applyVolumes();
}
applySettings();
const playerName = () => settings.name || 'Pilot';

// --- Pist: seçilen pisti kur (eskisini kaldır) ---
let trackDef = null;
let track = null;
let decor = null;
let startLights = null;
let items = null;
let minimap = null;

// Pisti kurar; modelleri henüz inmediyse önce indirir (üstte küçük bir "yükleniyor" etiketi).
// Dönen söz, pist kurulunca çözülür; yarış başlatan kodlar bunu bekler.
let wantedDef = null;
let trackReady = Promise.resolve();
let pendingLoads = 0;
function loadTrack(id) {
  const def = TRACKS[id] ?? TRACKS.palmCove;
  wantedDef = def;
  // Modeller hazırsa ve bekleyen yükleme yoksa hemen (eşzamanlı) kur
  if (!pendingLoads && hasModels(def.models)) {
    buildTrackNow(def);
    return trackReady;
  }
  pendingLoads++;
  trackReady = trackReady.then(buildWanted).finally(() => pendingLoads--);
  return trackReady;
}

async function buildWanted() {
  const def = wantedDef;
  if (!def || trackDef === def) return;
  if (!hasModels(def.models)) {
    const busy = document.getElementById('busy');
    busy?.classList.add('show');
    try {
      await loadModels(def.models);
    } catch (err) {
      reportIssue('models', `${def.id}: ${err?.message ?? err}`);
    }
    busy?.classList.remove('show');
    if (wantedDef !== def) return; // bu arada başka pist seçildi
  }
  buildTrackNow(def);
}

function buildTrackNow(def) {
  if (trackDef === def) return;
  if (track) {
    scene.remove(track.group, decor);
    track.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        for (const m of [o.material].flat()) {
          m.map?.dispose();
          m.dispose();
        }
      }
    });
    decor.traverse((o) => o.isInstancedMesh && o.dispose());
    items.dispose();
  }
  trackDef = def;
  track = buildTrack(def);
  scene.add(track.group);
  decor = buildDecor(track, (ctx) => def.decorate(ctx), QUALITY.decor);
  scene.add(decor);
  env.setTrack(def, track.terrain);
  fx.setDust(def.dust);
  startLights = createStartLights(decor);
  items = createItemSystem({
    scene,
    track,
    isOwned,
    idOf: (kart) => (online ? online.idByKart.get(kart) : kart.character.id),
    kartById: (kid) => (online ? online.kartById.get(kid) : kartOf(kid)),
    // Tek oyunculuda her şey zaten yerelde uygulandı; çevrimiçide diğerlerine duyur
    send: (msg) => online && net.send(msg),
    onRoll: (kart, item) => {
      if (kart !== player) return;
      play('item_box');
      hud.itemRoulette(item, 1.1, () => play('roulette', { volume: 0.35 }), () => play('item_land'));
    },
    // İsabet: vuran bot sevinir, vurulan bot kızar (kişiliğe göre)
    onHit: (victim, owner, result) => {
      if (result !== 'hit') return;
      if (owner && owner !== victim) botReact(owner, 'hitOther', 300);
      botReact(victim, 'gotHit', 500);
    },
    onUse: (kart, item) => {
      if (kart === player) hud.setItem(null);
      const vol = kart === player ? 1 : nearVolume(kart);
      if (vol > 0) play({ turbo: 'turbo', shield: 'shield', coconut: 'throw', oil: 'oil' }[item], { volume: vol });
    },
  });
  minimap = createMinimap(track);
  hud.setMinimap(minimap);
  if (!race) placeOnGrid(karts);
  if (window.__tt) Object.assign(window.__tt, { track, items });
}

// Oyuncuya yakın olayların sesi (uzaktakiler duyulmaz)
function nearVolume(kart) {
  if (!player) return 0;
  const d = kart.position.distanceTo(player.position);
  return d > 45 ? 0 : 0.8 * (1 - d / 45);
}

// --- Oyun durumu ---
let race = null;
let player = null;
let focus = kartOf(settings.character);
let drivers = new Map();
let timeTrial = false; // Zamana Karşı modu (tek oyunculu, botsuz, itemsiz)
let ghost = null; // rekor turun hayaleti
let lastTotalRecord = false;
const recorder = createGhostRecorder();
const emoteCooldown = new Map(); // kart → son tepki zamanı
let lastConfig = null;
let paused = false; // sadece tek oyunculuda oyunu dondurur
let pauseOpen = false;
let resultsTimer = 0;
let menuView = 'main';
let displayNames = new Map(); // kart → sonuç ekranında görünen ad
const NO_INPUT = { throttle: 0, brake: 0, steer: 0, drift: false };

// Çevrimiçi durum (null = tek oyunculu)
let online = null;
function newOnline() {
  return {
    room: null,
    isHost: false,
    goAt: 0,
    owned: new Set(), // bu cihazın fiziğini çalıştırdığı kartlar
    kartById: new Map(),
    idByKart: new Map(),
    buffers: new Map(),
    sendAcc: 0,
    raceOver: false,
    lobbyShown: false,
  };
}
const isOwned = (kart) => !online || online.owned.has(kart);

let startPress = null; // geri sayımda gaza ilk basılan an (başlangıç turbosu için)

function placeOnGrid(order) {
  order.forEach((kart, k) => {
    const slot = track.gridSlot(k);
    kart.reset(slot.position, slot.heading);
    kart.updateGround(track);
    kart.prevPosition.copy(kart.position);
    kart.updateVisual(1, 1);
    kart.model.play('idle');
    kart.active = true;
  });
}

// Menüde kamera kartın etrafında döner; geniş ekranda kart sağa kaydırılır (sol panel boş kalsın)
function setMenuView(name) {
  menuView = name;
  updateViewOffset();
}
// Hedef kaydırma oranı (ekran boyutuna göre); her karede yumuşakça yaklaşılır
const viewOffset = { x: 0, y: 0, tx: 0, ty: 0 };
function updateViewOffset() {
  const narrow = window.innerWidth <= 820;
  viewOffset.tx = race || narrow || menuView !== 'main' ? 0 : -0.2;
  viewOffset.ty = race || !narrow ? 0 : menuView === 'main' ? 0.18 : 0.3;
}
function applyViewOffset(dt) {
  const k = 1 - Math.exp(-4 * dt);
  viewOffset.x += (viewOffset.tx - viewOffset.x) * k;
  viewOffset.y += (viewOffset.ty - viewOffset.y) * k;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (Math.abs(viewOffset.x) < 1e-3 && Math.abs(viewOffset.y) < 1e-3) camera.clearViewOffset();
  else camera.setViewOffset(w, h, viewOffset.x * w, viewOffset.y * h, w, h);
}

// Yarış bitti ya da çıkıldı: kartları gride dizip menü kamerasına dön
function endRaceLocal() {
  race = null;
  paused = false;
  pauseOpen = false;
  menu.hidePause();
  hud.show(false);
  hud.reset();
  startLights.off();
  nameplates.clear();
  items.reset();
  items.setEnabled(true);
  emotes.clear();
  chat.setRacing(false);
  ghost?.dispose();
  ghost = null;
  timeTrial = false;
  hud.setTimeTrial(false);
  menu.refreshRecords();
  touch.show(false);
  playMusic('menu');
  placeOnGrid(karts);
  focus = kartOf(settings.character);
  rig.transition('orbit', 1.5);
}

function toMenu() {
  endRaceLocal();
  menu.showMain();
  setMenuView('main');
}

// --- Yarış kurulumu (tek oyunculu ve çevrimiçi ortak) ---
function setupRace(order, laps) {
  resultsTimer = 0;
  paused = false;
  pauseOpen = false;
  hud.reset();
  hud.show(true);
  hud.setOnline(!!online);
  startLights.off();
  items.reset();
  items.setEnabled(!timeTrial);
  hud.setTimeTrial(timeTrial);
  emotes.clear();
  chat.setRacing(true);
  startPress = null;
  lastTotalRecord = false;
  race = new Race(track, order, { laps, isOwned });
  playMusic('race');
  touch.show(isTouchDevice);
  if (isTouchDevice && innerHeight > innerWidth) menu.toast('Daha geniş görüş için telefonu yatay çevir ↻');
  updateViewOffset();
  if (rig.mode === 'chase') rig.snapTo(player);
  else rig.transition('chase', 2.2);

  const r = race;
  race.on('countdown', (n) => {
    hud.countdown(n);
    startLights.countdown(n);
    play('countdown');
  });
  race.on('go', () => {
    hud.go();
    startLights.go();
    play('go');
    // Başlangıç turbosu: gaza "BAŞLA"dan hemen önce (son 0.6 s) basan roket gibi çıkar
    if (startPress !== null && startPress >= -0.6) {
      player.boost(KART.startBoost);
      hud.boostBanner('ROKET KALKIŞ!');
      play('start_boost');
    }
    for (const kart of order) {
      if (kart !== player && isOwned(kart) && Math.random() < (drivers.get(kart)?.skill ?? 0.9) - 0.45) kart.boost(KART.startBoost);
      botReact(kart, 'go', Math.random() * 1500);
    }
    recorder.startLap();
  });
  race.on('lap', (e, time) => {
    if (e.kart !== player) return;
    const best = e.lapTimes.length > 1 && Math.min(...e.lapTimes) === time;
    // Kişisel tur rekoru mu? (rekorsa hayalet olarak saklanır)
    const record = recorder.finishLap(trackDef.id, player.character.id, time);
    hud.lapToast(e.lapsDone, time, best, record);
    if (e.lapsDone < race.laps) play('lap');
  });
  race.on('finalLap', (e) => {
    if (e.kart === player) {
      hud.finalLap();
      play('final_lap', { volume: 0.8 });
    }
  });
  race.on('finish', (e, place) => {
    e.kart.model.play('dance');
    // Çevrimiçi: kendi (ya da bizim sürdüğümüz bot) bitişimizi sunucuya bildir
    if (online && online.owned.has(e.kart) && e.serverPlace === null) {
      const id = online.idByKart.get(e.kart);
      net.send({ type: 'finish', id, time: e.finishTime });
    }
    if (place === 1) botReact(e.kart, 'win', 600);
    if (e.kart === player) {
      if (resultsTimer === 0) {
        lastTotalRecord = submitTotal(trackDef.id, race.laps, e.finishTime);
        hud.finish(timeTrial ? (lastTotalRecord ? 1 : 2) : place);
        playMusic(null);
        play(place <= 3 ? 'finish_win' : 'finish');
        hud.wrongWay(false);
        resultsTimer = 2.5; // biraz kutlama, sonra sonuç tablosu
      }
    } else if (resultsTimer < 0 && r === race) {
      showResults(); // tablo açıkken yeni bitirenleri ekle
    }
  });
  race.on('wrongWay', (e, wrong) => {
    if (e.kart === player) hud.wrongWay(wrong);
  });
}

async function startOfflineRace(config) {
  await loadTrack(settings.track); // pist modelleri inmediyse bekle
  lastConfig = config;
  player = kartOf(config.character);
  timeTrial = config.mode === 'timeTrial';
  const bots = karts.filter((k) => k !== player);
  // Oyuncu ortalarda (5.) başlar; önünde geçilecek rakipler olsun. Zamana Karşı: tek başına
  const order = timeTrial ? [player] : [...bots.slice(0, 4), player, ...bots.slice(4)];
  placeOnGrid(karts);
  placeOnGrid(order);
  if (timeTrial) for (const k of bots) k.active = false;
  const skill = DIFFICULTY[config.difficulty]?.skill ?? DIFFICULTY.normal.skill;
  drivers = new Map(order.map((k, i) => [k, createDriver(i + 1 + Math.random() * 100, k === player ? [0.97, 0.97] : skill, k.character.personality)]));
  displayNames = new Map(karts.map((k) => [k, k === player && settings.name ? settings.name : k.character.name]));
  ghost?.dispose();
  ghost = null;
  const rec = recordOf(trackDef.id);
  if (timeTrial && rec?.ghost) ghost = createGhost(scene, CHARACTERS.find((c) => c.id === rec.ghost.char) ?? player.character, rec.ghost);
  setupRace(order, config.laps);
  if (timeTrial && !rec?.ghost) menu.toast('İlk turunu at: en iyi turun hayalet olarak kaydedilecek 👻');
}

function showResults() {
  if (timeTrial) {
    const e = race.entryOf(player);
    const rec = recordOf(trackDef.id);
    hud.showTimeTrialResults({
      track: trackDef.name,
      laps: e.lapTimes,
      total: e.finishTime,
      bestTotal: rec?.totals?.[race.laps] ?? e.finishTime,
      bestLap: rec?.bestLap ?? Math.min(...e.lapTimes),
      newTotal: lastTotalRecord,
      newLap: rec?.bestLap != null && e.lapTimes.includes(rec.bestLap),
    });
    return;
  }
  const standings = race.standings();
  const me = standings.findIndex((e) => e.kart === player) + 1;
  hud.showResults(
    standings.map((e) => ({ id: e.kart.character.id, name: displayNames.get(e.kart) ?? e.kart.character.name, time: e.finishTime, me: e.kart === player })),
    `${trackDef.name} · ${race.laps} tur · ${me}. oldun${lastTotalRecord ? ' · 🏆 yeni rekor' : ''}`,
  );
}

// Duraklatma: tek oyunculuda oyunu dondurur; çevrimiçide sadece menüyü açar
function setPaused(value) {
  if (!race || hud.resultsOpen) return;
  pauseOpen = value;
  paused = value && !online;
  if (value) menu.showPause();
  else menu.hidePause();
}

window.addEventListener('keydown', (e) => {
  if ((e.code === 'Escape' || e.code === 'KeyP') && race && !hud.resultsOpen) setPaused(!pauseOpen);
});
// Sekme arka plana geçince tek oyunculu yarışı duraklat
const autoPause = !new URLSearchParams(location.search).has('nopause'); // ?nopause: test için kapat
document.addEventListener('visibilitychange', () => {
  if (autoPause && document.hidden && race && !pauseOpen && !online) setPaused(true);
});

// ===================== Çevrimiçi =====================

function leaveRoom() {
  net.leave();
  online = null;
  menu.setOnline(null);
  chat.setOnline(false);
  chat.clear();
  if (race) endRaceLocal();
  menu.showMain();
  setMenuView('main');
}

function backToLobby() {
  if (!online) return;
  net.send({ type: 'backToLobby' });
  endRaceLocal();
  menu.showLobby();
}

async function startOnlineRace(msg) {
  if (!race && online?.goAt === msg.goAt) return; // aynı başlangıç zaten kuruluyor
  // Yeniden bağlanınca sunucu aynı yarışı tekrar gönderir: zaten içindeysek yok say
  if (race && online.goAt === msg.goAt) {
    for (const [i, f] of (msg.finishes ?? []).entries()) {
      const kart = online.kartById.get(f.id);
      if (kart) race.applyFinish(kart, f.time, i + 1);
    }
    return;
  }
  online.goAt = msg.goAt; // ikinci 'start' gelirse tekrar başlamasın (aşağıdaki bekleme sırasında)
  await loadTrack(msg.track);
  if (!online || online.goAt !== msg.goAt) return;
  online.raceOver = false;
  online.kartById.clear();
  online.idByKart.clear();
  online.buffers.clear();
  const order = msg.entrants.map((e) => {
    const kart = kartOf(e.character);
    online.kartById.set(e.id, kart);
    online.idByKart.set(kart, e.id);
    online.buffers.set(kart, new RemoteBuffer());
    return kart;
  });
  player = online.kartById.get(net.id);
  online.isHost = online.room?.hostId === net.id;
  online.owned = new Set([player]);
  if (online.isHost) msg.entrants.filter((e) => e.bot).forEach((e) => online.owned.add(online.kartById.get(e.id)));

  placeOnGrid(order);
  const skill = DIFFICULTY[msg.difficulty]?.skill ?? DIFFICULTY.normal.skill;
  drivers = new Map(order.map((k, i) => [k, createDriver(i + 1 + (msg.goAt % 1000), skill, k.character.personality)]));
  displayNames = new Map();
  nameplates.clear();
  for (const e of msg.entrants) {
    const kart = online.kartById.get(e.id);
    displayNames.set(kart, e.bot ? kart.character.name : e.name);
    nameplates.set(kart, e.bot ? kart.character.name : e.name, e.bot);
  }

  menu.hideAll();
  menu.hidePause();
  setupRace(order, msg.laps);
  // Geri sayımı herkeste aynı anda bitecek şekilde sunucu saatine hizala
  race.clock = (net.serverNow() - msg.goAt) / 1000;

  // Sayfa yenilenip geri dönüldüyse kaldığımız yerden devam
  if (msg.resume) {
    applyRemoteState(player, msg.resume, track);
    race.restore(player, msg.resume.pr, msg.resume.l);
    rig.snapTo(player);
  }
  // Botlar da son bilinen konumlarından devam etsin (oda sahibi geri dönünce gride ışınlanmasınlar)
  for (const { id, s } of msg.bots ?? []) {
    const kart = online.kartById.get(id);
    if (!kart || !s) continue;
    applyRemoteState(kart, s, track);
    race.restore(kart, s.pr, s.l);
  }
  for (const [i, f] of (msg.finishes ?? []).entries()) {
    const kart = online.kartById.get(f.id);
    if (kart) race.applyFinish(kart, f.time, i + 1);
  }
}

net.on('welcome', (msg) => {
  if (msg.resumed) menu.toast('Tekrar bağlandın!');
});

net.on('room', (msg) => {
  if (!online) online = newOnline();
  online.room = msg;
  menu.setOnline(msg, net.id);
  chat.setOnline(true);
  // Oda sahibi pisti değiştirdiyse lobide hazırla (yarış başlarken beklemesin)
  if (!race && msg.settings?.track) loadTrack(msg.settings.track);
  // Sunucu karakterimizi değiştirdiyse (başkası almıştı) önizlemeyi güncelle
  const mine = msg.players.find((p) => p.id === net.id);
  if (!race && mine) focus = kartOf(mine.character);
  const nowHost = msg.hostId === net.id;

  // Oda sahibi değişti ve yeni sahip biziz: botları devral
  if (race && nowHost && !online.isHost) {
    online.isHost = true;
    for (const [id, kart] of online.kartById) {
      if (id.startsWith('bot-')) {
        kart.prevPosition.copy(kart.position);
        online.owned.add(kart);
      }
    }
    menu.toast('Oda sahibi oldun; botları artık sen sürüyorsun.');
  }
  online.isHost = nowHost;

  if (!race && !online.lobbyShown && msg.phase !== 'racing') {
    online.lobbyShown = true;
    menu.showLobby();
  }
});

net.on('start', (msg) => startOnlineRace(msg));

net.on('states', (msg) => {
  if (!online || !race) return;
  for (const { id, s } of msg.list) {
    const kart = online.kartById.get(id);
    if (kart && !online.owned.has(kart)) online.buffers.get(kart)?.push(s);
  }
});

// Diğer cihazlardan item olayları
for (const type of ['item', 'box']) net.on(type, (msg) => race && items.receive(msg));
net.on('hit', (msg) => {
  if (!race || !online) return;
  items.receive(msg);
  const kart = online.kartById.get(msg.target);
  if (kart) fx.event(kart, 'hit');
  // Bizim sürdüğümüz bot başkasını vurduysa sevinsin
  const owner = online.kartById.get(String(msg.id).split(':')[0]);
  if (owner && owner !== kart) botReact(owner, 'hitOther', 300);
});

net.on('chat', (msg) => chat.add(msg));
net.on('chatHistory', (msg) => chat.setHistory(msg.list));
net.on('emote', (msg) => {
  const kart = online?.kartById.get(msg.id);
  if (race && kart) emotes.show(kart, msg.e);
});

net.on('finish', (msg) => {
  if (!online || !race) return;
  const kart = online.kartById.get(msg.id);
  if (kart) race.applyFinish(kart, msg.time, msg.place);
});

net.on('raceOver', () => {
  if (!online || !race) return;
  online.raceOver = true;
  race.finish();
  if (!hud.resultsOpen) {
    resultsTimer = -1;
    showResults();
  }
});

net.on('error', (msg) => {
  menu.toast(msg.msg);
  // Odaya giremediysek çevrimiçi moddan çık
  if (['no-room', 'in-race', 'full', 'no-resume'].includes(msg.code)) {
    const wasRacing = !!race && !!online;
    net.leave();
    online = null;
    menu.setOnline(null);
    if (wasRacing) toMenu();
  }
});

net.on('disconnect', () => {
  if (online) menu.toast('Bağlantı koptu, yeniden bağlanılıyor…');
});

// Durum gönderimi (20 Hz): kendi kartımız + oda sahibiysek botlar
function sendStates(dt) {
  online.sendAcc += dt;
  if (online.sendAcc < 0.05 || !race.started) return;
  online.sendAcc = 0;
  const t = net.serverNow();
  const msg = { type: 'state', s: encodeState(player, race.entryOf(player), t) };
  if (online.isHost) {
    msg.bots = [];
    for (const kart of online.owned) {
      if (kart !== player) msg.bots.push({ id: online.idByKart.get(kart), s: encodeState(kart, race.entryOf(kart), t) });
    }
  }
  net.sendVolatile(msg);
}

// Uzak kartları interpolasyonla konumlandır
function updateRemoteKarts() {
  const renderTime = net.serverNow() - INTERP_DELAY;
  for (const kart of karts) {
    if (online.owned.has(kart)) {
      kart.active = true;
      continue;
    }
    const buf = online.buffers.get(kart);
    const s = buf?.sample(renderTime);
    if (s) {
      applyRemoteState(kart, s, track);
      // Uzak kartın ilerlemesi kendi bildirdiği değerdir (sıralama herkeste tutarlı olsun)
      if (race.entryOf(kart)?.finishTime === null) race.restore(kart, s.pr, s.l);
    }
    // Uzun süre veri gelmezse (oyuncu koptu) kartı gizle
    kart.active = !!s && !buf.stale;
  }
}

// --- Başlangıç: menü ---
loadTrack(settings.track);
playMusic('menu');
rig.mode = 'orbit';
rig.update(1, focus, true);
updateViewOffset();
applyViewOffset(10);
if (import.meta.env.DEV) {
  window.__tt = { THREE, renderer, scene, camera, rig, karts, track, env, hud, menu, net, items, get race() { return race; }, get player() { return player; }, get online() { return online; } };
}

// Tüm shader'ları önceden derle, ilk karede takılma olmasın
renderer.compile(scene, camera);
// Açılış ekranı en az 2.4 s görünsün (logo animasyonu ve yapımcı yazısı için)
setTimeout(() => document.getElementById('loading').classList.add('done'), Math.max(0, 2400 - performance.now()));
menu.showMain();

// Sayfa yenilendiyse ve bir odadaysak geri bağlan; davet linkiyle geldiyse katılma penceresini aç
const session = net.session;
const invite = new URLSearchParams(location.search).get('oda');
if (session) {
  online = newOnline();
  net.code = session.code;
  net.token = session.token;
  net.connect();
  menu.toast('Odaya yeniden bağlanılıyor…');
} else if (invite) {
  menu.openJoin(invite.toUpperCase().slice(0, 5));
}

// --- Döngü: fizik sabit 60 Hz, çizim ekranın hızında ---
const STEP = 1 / PHYSICS_HZ;
let accumulator = 0;
let last = performance.now();
let resetHeld = false;
let itemHeld = false;
let fpsFrames = 0;
let fpsTime = 0;

let autopilot = false; // geliştirme: oyuncu kartını otopilot sürsün
const positionOf = (kart) => race.positionOf(kart);
const progressOf = (kart) => (race.entryOf(kart)?.progress ?? 0) / (track.count * race.laps);
function kartInput(kart, playerInput, activeKarts) {
  if (!race.started) return NO_INPUT;
  if (kart === player && race.entryOf(kart).finishTime === null && !autopilot) return pauseOpen ? NO_INPUT : playerInput;
  const input = driveInput(drivers.get(kart), kart, track, STEP, { items, karts: activeKarts, positionOf, progressOf });
  if (input.useItem) items.use(kart, input.backward);
  return input;
}

// Kısayola giriş bildirimi ve atlama çukuruna (dere) düşen kartı geri alma
let playerOnShortcut = false;
function checkShortcutEvents(kart) {
  if (kart === player && race.started) {
    if (kart.onShortcut && !playerOnShortcut) hud.toast('KISAYOL! ⚡');
    playerOnShortcut = kart.onShortcut;
  }
  if (!race.started || race.entryOf(kart)?.finishTime !== null) return;
  const pit = track.inPit(kart.position);
  kart.fallTime = pit ? kart.fallTime + STEP : 0;
  if (pit) kart.fallShortcut = pit;
  if (kart.fallTime > 0.25) {
    // Dereye düşen kart kısayolun girişinin biraz gerisine döner (checkpoint ileride olabilir)
    const p = race.respawnPoint(kart, kart.fallShortcut ? kart.fallShortcut.entryIndex - 14 : null);
    kart.reset(p.position, p.heading);
    kart.updateGround(track);
    if (kart === player) {
      hud.toast('Dereye düştün! 💦', 'warn');
      rig.shake(0.5);
      play('hit', { volume: 0.6 });
    }
  }
}

function raceStep(input) {
  const activeKarts = karts.filter((k) => k.active);
  for (const kart of karts) {
    if (!isOwned(kart) || !kart.active) continue; // pasif: Zamana Karşı'da yarışta olmayan kartlar
    const impact = kart.step(STEP, kartInput(kart, input, activeKarts), track);
    checkShortcutEvents(kart);
    if (kart === player && impact > 3) {
      rig.shake(Math.min(0.8, impact / 20));
      fx.impact(kart.position, kart.wallNormal, impact);
      play('wall', { volume: Math.min(1, impact / 15) });
    }
  }
  resolveKartCollisions(
    activeKarts,
    (a, b, strength) => {
      if ((a === player || b === player) && strength > 3) {
        rig.shake(Math.min(0.5, strength / 25));
        play('bump', { volume: Math.min(1, strength / 12) });
      }
    },
    isOwned,
  );
  if (race.started) items.update(STEP, activeKarts, positionOf);
  if (race.started && race.entryOf(player)?.finishTime === null) recorder.sample(player, STEP);
  race.update(STEP);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (race && online) updateRemoteKarts();

  let throttle = 0;
  if (race && !paused) {
    const input = readInput();
    throttle = input.throttle;
    // R: son checkpoint'e dön (tuşa basıldığı anda bir kez)
    if (input.reset && !resetHeld && race.started && race.entryOf(player).finishTime === null) {
      const p = race.respawnPoint(player);
      player.reset(p.position, p.heading);
      player.updateGround(track);
    }
    resetHeld = input.reset;

    // E: item kullan (basıldığı anda bir kez); fren basılıysa geriye atar
    if (input.item && !itemHeld && race.started && !pauseOpen) items.use(player, input.brake > 0);
    itemHeld = input.item;
    // Başlangıç turbosu için gaza ilk basılan an
    if (!race.started && startPress === null && input.throttle > 0) startPress = race.clock;

    accumulator += dt;
    while (accumulator >= STEP) {
      raceStep(input);
      accumulator -= STEP;
    }
    if (online) sendStates(dt);
  }

  const alpha = race && !paused ? accumulator / STEP : 1;
  for (const kart of karts) {
    if (isOwned(kart) || !race) kart.updateVisual(alpha, paused ? 0 : dt);
    else kart.updateVisual(1, dt);
    if (race && !paused && kart.active) {
      fx.kart(kart, dt);
      fx.boostFlame(kart, dt);
    }
    for (const ev of kart.events) {
      fx.event(kart, ev);
      kartSound(kart, ev);
    }
    kart.events.length = 0;
  }
  if (race) items.animate(dt, karts);
  emotes.update(paused ? 0 : dt);
  if (ghost && race) {
    const e = race.entryOf(player);
    ghost.update(race.started && e.finishTime === null ? race.clock - e.lapStart : -1, paused ? 0 : dt);
  }
  const target = race ? player : focus;
  applyViewOffset(dt);
  rig.update(paused ? 0 : dt, target);
  // Kameranın dibindeki rakip kart görüşü kapatmasın; bağlantısı kopan kart gizlenir
  for (const kart of karts) {
    kart.object.visible = kart.active && (kart === target || kart.object.position.distanceToSquared(camera.position) > 3.2 * 3.2);
  }
  nameplates.update(camera, player);
  env.update(dt, target.object.position, camera);
  fx.update(paused ? 0 : dt, camera, renderer.domElement.height);

  if (race) updateHud(dt);
  // Motor sesi sadece yarışta; dokunmatik kontroller duraklatma/sonuç ekranında gizli
  updateEngine(race && !paused ? player : null, throttle, KART.maxSpeed);
  if (isTouchDevice && race) touch.show(!pauseOpen && !hud.resultsOpen);

  postfx.render();

  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    const ping = online && net.connected ? ` · ${Math.round(net.rtt)} ms` : '';
    const fps = fpsFrames / fpsTime;
    lastFps = fps;
    const flags = `${QUALITY.bloom ? 'bloom' : 'bloom yok'} · msaa ${QUALITY.bloom ? QUALITY.msaa : 'yok'}`;
    debug.textContent = `${Math.round(fps)} FPS · ${QUALITY.name} · ${flags} · x${pixelRatio.toFixed(2)}${ping} · ${gpuName}`;
    adaptResolution(fps);
    fpsFrames = 0;
    fpsTime = 0;
  }
  requestAnimationFrame(frame);
}

// Hızlı tepki: kartın üstünde baloncuk, çevrimiçide diğerlerine de gider
function sendEmote(kart, e) {
  if (!race || !kart) return;
  const now = performance.now();
  if (now - (emoteCooldown.get(kart) ?? 0) < 800) return;
  emoteCooldown.set(kart, now);
  emotes.show(kart, e);
  if (kart === player) play('ui_select', { volume: 0.5 });
  if (online) net.send({ type: 'emote', e, id: kart === player ? undefined : online.idByKart.get(kart) });
}

// Botlar kişiliklerine göre olaylara emojiyle tepki verir (sadece bizim sürdüğümüz botlar)
function botReact(kart, event, delay = 0) {
  if (!kart || kart === player || !isOwned(kart) || timeTrial) return;
  const driver = drivers.get(kart);
  if (!driver) return;
  const e = botEmote(driver, event);
  if (e < 0) return;
  const r = race;
  setTimeout(() => r === race && sendEmote(kart, e), delay);
}

// Kart olay sesleri (oyuncu ya da yakındaki kartlar)
function kartSound(kart, ev) {
  const vol = kart === player ? 1 : nearVolume(kart);
  if (vol <= 0) return;
  if (ev.startsWith('miniTurbo')) play('mini_turbo', { volume: vol * 0.8, rate: 0.9 + Number(ev.slice(-1)) * 0.12 });
  else if (ev === 'hit') {
    play('hit', { volume: vol });
    play('spin', { volume: vol * 0.7 });
  } else if (ev === 'blocked') play('shield_pop', { volume: vol });
  else if (ev === 'pad') play('turbo', { volume: vol * 0.7 });
}

// Dinamik çözünürlük: FPS düşükse piksel oranını azalt, yüksekse geri artır.
// Yavaş kalınan seviyenin üstüne bir daha çıkılmaz (tavan) → sürekli gidip gelme olmaz.
let slowTime = 0;
let fastTime = 0;
let ratioCeiling = basePixelRatio;
function adaptResolution(fps) {
  if (!race || paused || document.hidden) return;
  slowTime = fps < 48 ? slowTime + 0.5 : 0;
  fastTime = fps > 58 ? fastTime + 0.5 : 0;
  let next = pixelRatio;
  if (slowTime >= 2 && pixelRatio > 0.6) {
    if (pixelRatio <= 0.9) reportIssue('perf', 'düşük FPS: çözünürlük 0.9 altına indi');
    ratioCeiling = Math.min(ratioCeiling, pixelRatio - 0.05);
    next = Math.max(0.6, pixelRatio - 0.15);
  } else if (fastTime >= 8 && pixelRatio < ratioCeiling) next = Math.min(ratioCeiling, pixelRatio + 0.1);
  if (Math.abs(next - pixelRatio) > 1e-3) {
    pixelRatio = next;
    slowTime = fastTime = 0;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    postfx.setPixelRatio(pixelRatio);
  }
}

function updateHud(dt) {
  const entry = race.entryOf(player);
  const activeKarts = karts.filter((k) => k.active);
  hud.setPosition(race.positionOf(player), karts.length);
  hud.setLap(Math.min(race.laps, Math.max(1, entry.lapsDone + 1)), race.laps);
  hud.setTime(entry.finishTime ?? Math.max(0, race.clock));
  const speed = Math.abs(player.speed);
  hud.setSpeed(speed * 3.6, speed / KART.maxSpeed, player.boostTime > 0);
  minimap.draw(activeKarts.map((k) => ({ x: k.position.x, z: k.position.z, color: k.character.color, me: k === player })));
  if (resultsTimer > 0 && !paused) {
    resultsTimer -= dt;
    if (resultsTimer <= 0) {
      resultsTimer = -1;
      showResults();
    }
  }
}

requestAnimationFrame(frame);

// Geliştirme: yarışı otopilotla hızlıca ilerlet (test için)
if (import.meta.env.DEV) {
  window.__tt.autopilot = (on) => (autopilot = on);
  window.__tt.readInput = readInput;
  window.__tt.postfx = postfx;
  Object.assign(window.__tt, { emotes, chat, recordOf });
  Object.defineProperties(window.__tt, { ghost: { get: () => ghost }, drivers: { get: () => drivers } });
  window.__tt.freeze = (on) => (paused = on); // menü açmadan dondur (ekran görüntüsü için)
  window.__tt.simulate = (seconds) => {
    setPaused(false);
    for (let t = 0; t < seconds; t += STEP) {
      if (online) updateRemoteKarts();
      const before = autopilot;
      autopilot = true;
      raceStep(NO_INPUT);
      autopilot = before;
      if (online) sendStates(STEP);
      if (resultsTimer > 0) updateHud(STEP);
    }
    for (const kart of karts) kart.updateVisual(1, STEP);
    rig.update(3, player);
    updateHud(0);
  };
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postfx.setSize(window.innerWidth, window.innerHeight);
  updateViewOffset();
});
