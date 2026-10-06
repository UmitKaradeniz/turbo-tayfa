import * as THREE from 'three';
import { PHYSICS_HZ, KART } from './config.js';
import { QUALITY } from './quality.js';
import { createAutoTuner } from './autoQuality.js';
import { settings, saveSettings, DIFFICULTY } from './settings.js';
import { readInput } from './input.js';
import { loadModels, hasModels, kitModels, setKit } from './assets.js';
import { initErrorReports, setReportContext, reportIssue } from './report.js';
import { Kart, resolveKartCollisions } from './kart.js';
import { CHARACTERS, KART_MODELS, pickRivals } from './kartModel.js';
import { defaultVehicleFor, vehicleOf } from './vehicles.js';
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
import { tipOnce } from './tips.js';
import { recordOf, submitTotal, createGhostRecorder, createDeltaTracker, createGhost } from './records.js';
import { awardRace, setTrackTotal, recordCupWin } from './progress.js';
import { dailyDone } from './daily.js';
import { activeCosmetics, tickCosmetics } from './cosmetics.js';
import { createChat } from './ui/chat.js';
import { Net } from './net.js';
import { RemoteBuffer, encodeState, applyRemoteState, INTERP_DELAY } from './remote.js';
import { createHud } from './ui/hud.js';
import { createMenu } from './ui/menu.js';
import { createMinimap } from './ui/minimap.js';
import { createNameplates } from './ui/nameplates.js';
import { createHazards, hazardModelKeys } from './hazards.js';
import { createVolcanoShow } from './volcano.js';
import { renderPortraits, renderHeads } from './ui/portraits.js';
import { PODIUM_MODELS } from './ui/podium3d.js';
import { createTouchControls, isTouchDevice } from './ui/touch.js';
import { initTilt } from './tilt.js';
import { createItemSystem } from './items.js';
import { ITEM_ICONS } from './itemIcons.js';
import { play, playMusic, preloadMusic, updateEngine, applyVolumes } from './audio.js';
import { TRACKS, TRACK_IDS, CUP_SETS } from './tracks/index.js';

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: !QUALITY.composer && QUALITY.msaa > 0, powerPreference: 'high-performance' });
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
let fpsAvg = 0; // sunucuya bildirilen düzleştirilmiş FPS
initErrorReports();
setReportContext(() => ({ track: trackDef?.id, quality: QUALITY.name + (QUALITY.auto ? '(auto)' : ''), pixelRatio: pixelRatio.toFixed(2), fps: Math.round(lastFps), gpu: gpuName, mode: timeTrial ? 'timeTrial' : race ? 'race' : 'menu', online: !!online }));
renderer.domElement.addEventListener('webglcontextlost', () => reportIssue('webgl', 'context lost'));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.3, 1500);
const postfx = createPostFX(renderer, scene, camera, QUALITY);
// Otomatik kalite: sadece ana menüde, açık pencere/oda yokken sayfayı yeni seviyeyle yeniden başlatabilir
const autoTuner = QUALITY.auto ? createAutoTuner({ canReload: () => !race && !online && !document.querySelector('.tt-modal.show') }) : null;

// --- Yükleme: karakterler + seçili pistin modelleri (diğer pistler seçilince yüklenir) ---
const loadingBar = document.querySelector('#loading .bar > div');
// Pistin modelleri + haritaya özel araç gövdesi
const modelsOf = (def) => [...def.models, ...(def.kartBody ? [def.kartBody] : []), ...kitModels(def.kit ?? def.id), ...hazardModelKeys(def)];
const firstModels = [...new Set([...KART_MODELS, ...PODIUM_MODELS,...modelsOf(TRACKS[settings.track] ?? TRACKS.palmCove)])];
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
// Boya ve iz: kendi kartında seçimin; çevrimiçide diğer oyuncuların kartında onların seçimi (botlar standart)
const remoteLooks = new Map(); // kart → {paint, trail}; yalnız çevrimiçi yarışta dolu
const syncCosmetics = (mine) => {
  const c = activeCosmetics();
  for (const k of karts) {
    const l = k === mine ? c : remoteLooks.get(k);
    k.model.setPaint(l?.paint ?? 'stock');
    k.trail = l?.trail ?? 'classic';
  }
};
const lookMsg = () => {
  const c = activeCosmetics();
  return { paint: c.paint, trail: c.trail };
};
// Seçilen araç yalnız oyuncunun (menüde odaktaki) kartına uygulanır; diğerleri karakterin varsayılan aracını kullanır
const syncVehicles = (mine) => {
  for (const k of karts) k.setVehicle(k === mine ? vehicleOf(settings.vehicle, k.character) : defaultVehicleFor(k.character));
  syncCosmetics(mine);
};
// Kadro 24 kişi; sahada her zaman en çok 8 sürücü var. Sahada olmayanlar pasif (gizli) kalır.
const setField = (list) => {
  for (const k of karts) k.active = list.includes(k);
};
let menuRivals = pickRivals(settings.character).map(kartOf); // menüde görünen rakipler
let booted = false; // menü kurulurken (henüz pist yokken) sahne işlemleri atlanır

// --- Arayüz ---
const portraits = renderPortraits(renderer, CHARACTERS);
const heads = renderHeads(renderer, CHARACTERS); // mini harita kafaları
const hud = createHud({ portraits, minimap: null, itemIcons: ITEM_ICONS });
const touch = createTouchControls();
initTilt();
const net = new Net();
net.perf = () => (fpsAvg > 0 ? { fps: Math.round(fpsAvg), rtt: Math.round(net.rtt) } : null);

// Pist önizlemesi: oyundan alınmış kare (public/previews/<kimlik>.jpg)
const previewOf = (id) => `/previews/${id}.jpg`;

// Menüdeki pist küçük resimleri (sadece orta çizgiden)
const trackCounts = {}; // pist → orta çizgi örnek sayısı (kupada sunucu ilerleme doğrulaması için)
setTrackTotal(TRACK_IDS.length);
const trackCards = TRACK_IDS.map((id) => {
  const def = TRACKS[id];
  const outline = trackOutline(def);
  trackCounts[id] = outline.centerline.length;
  const thumb = createMinimap(outline, { size: 72, theme: 'plain', shortcuts: 'dash' });
  thumb.draw([]);
  return { id, name: def.name, meta: `${Math.round(outline.length)} m · ${def.meta}`, thumb: thumb.canvas.toDataURL(), preview: previewOf(id) };
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
    rivals: (ids) => {
      menuRivals = ids.map(kartOf);
      if (booted && !race && track) showMenuField();
    },
    screen: (name) => setMenuView(name),
    cosmetic: () => {
      syncCosmetics(focus); // Garaj'da boya/iz seçimi: odaktaki kartta canlı önizleme
      if (online) net.send({ type: 'look', ...lookMsg() });
    },
    character: (id) => {
      focus = kartOf(id);
      syncVehicles(focus);
      if (track) showMenuField();
      focus.model.play('gesture-positive');
      setTimeout(() => focus.model.play('idle'), 1400);
      play('ui_select');
      if (online) net.send({ type: 'character', character: id });
    },
    vehicle: (id) => {
      syncVehicles(focus);
      play('ui_select');
      if (online) net.send({ type: 'vehicle', vehicle: id });
    },
    track: (id) => loadTrack(id),
    start: (config) => {
      cup = null; // yeni başlatma her zaman yeni kupa
      return startOfflineRace(config);
    },
    nextRace: () => nextRace(),
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    restart: () => startOfflineRace(lastConfig),
    toMenu: () => (online ? leaveRoom() : toMenu()),
    settingsChanged: applySettings,
    // Çevrimiçi
    host: () => {
      online = newOnline();
      slowConnectHint();
      net.send({ type: 'create', name: playerName(), character: settings.character, vehicle: settings.vehicle || null, look: lookMsg() });
    },
    join: (code) => {
      online = newOnline();
      slowConnectHint();
      net.send({ type: 'join', code, name: playerName(), character: settings.character, vehicle: settings.vehicle || null, look: lookMsg() });
    },
    leaveRoom: () => leaveRoom(),
    lobbyButton: (action) => {
      if (action === 'start') net.send({ type: 'start', trackCount: track.count, trackCounts });
      else net.send({ type: 'ready', ready: action === 'ready' });
    },
    roomSettings: (patch) => net.send({ type: 'settings', ...patch }),
    toLobby: () => backToLobby(),
  },
});

// Butonlarda tık sesi
document.addEventListener('click', (e) => {
  if (e.target.closest('.tt-btn, .tt-seg button, .tt-track, #hud-pause, #hud-fs')) play('ui_click', { volume: 0.6 });
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
let hazards = null;
let volcanoShow = null;
let volcanoGlow = null;
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
  if (!pendingLoads && hasModels(modelsOf(def))) {
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
  const need = modelsOf(def);
  if (!hasModels(need)) {
    const busy = document.getElementById('busy');
    busy?.classList.add('show');
    try {
      await loadModels(need);
    } catch (err) {
      reportIssue('models', `${def.id}: ${err?.message ?? err}`);
    }
    busy?.classList.remove('show');
    if (wantedDef !== def) return; // bu arada başka pist seçildi
  }
  buildTrackNow(def);
}

// Dokuları GPU'ya kare başına ~3 ms'lik dilimlerle gönder (hepsini birden göndermek menüde takılma yapıyordu)
let texUploadGen = 0;
function uploadTexturesGradually(list) {
  const gen = ++texUploadGen;
  const step = () => {
    if (gen !== texUploadGen) return; // başka pist kuruldu
    const t0 = performance.now();
    while (list.length && performance.now() - t0 < 3) renderer.initTexture(list.pop());
    if (list.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Pist kurulum süresi ölçümü: aşama adı → ms (window.__tt.lastBuild; çok yavaşsa sunucu loguna da yazılır)
let buildMarks = null;
const mark = (name) => {
  const t = performance.now();
  buildMarks.phases[name] = Math.round(t - buildMarks.t);
  buildMarks.t = t;
};

function buildTrackNow(def) {
  if (trackDef === def) return;
  buildMarks = { id: def.id, start: performance.now(), t: performance.now(), phases: {} };
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
    hazards?.dispose();
  }
  trackDef = def;
  setKit(def.kit ?? def.id); // haritaya özel donanım (kemer, bayrak, kule, bariyer, tribün)
  for (const k of karts) k.setBodyOverride(def.kartBody ?? null); // haritaya özel araç (yoksa seçilen araç sınıfının gövdesi)
  const beams = QUALITY.beams ? (def.beams ?? (def.night ? 1 : 0)) : 0; // far ışığı süzmesi (gece pistleri, gün batımı)
  for (const k of karts) k.setBeams(beams);
  mark('temizlik');
  track = buildTrack(def, { detailRoad: QUALITY.detailRoad, detailGround: QUALITY.detailGround });
  scene.add(track.group);
  mark('pist');
  decor = buildDecor(track, (ctx) => def.decorate(ctx), QUALITY.decor);
  scene.add(decor);
  mark('dekor');
  env.setTrack(def, track.terrain);
  fx.setDust(def.dust);
  startLights = createStartLights(decor);
  mark('ortam');
  preloadMusic(def.id); // müzik çözümü geri sayımda değil, pist seçilirken olsun
  hazards = createHazards({ scene, track, fx, quality: QUALITY });
  volcanoShow = def.volcano ? createVolcanoShow({ fx, def, quality: QUALITY }) : null;
  volcanoGlow = null;
  decor.traverse((o) => {
    if (o.userData?.glow) volcanoGlow = o.userData.glow;
  });
  items = createItemSystem({
    scene,
    track,
    fx,
    isOwned,
    idOf: (kart) => (online ? online.idByKart.get(kart) : kart.character.id),
    kartById: (kid) => (online ? online.kartById.get(kid) : kartOf(kid)),
    // Tek oyunculuda her şey zaten yerelde uygulandı; çevrimiçide diğerlerine duyur
    send: (msg) => online && net.send(msg),
    onRoll: (kart, item, uses = 1) => {
      if (kart !== player) return;
      play('item_box');
      hud.setItemCount(uses);
      if (uses > 1) raceStats.gold++;
      // İlk kez: kısa ipucu (altın kutu / eşyayı nasıl kullanırım)
      if (uses > 1 ? tipOnce('gold') : tipOnce('item')) {
        setTimeout(() => race && !paused && hud.coach(uses > 1 ? '✨ Altın kutu: eşyayı 2 kez kullanırsın!' : isTouchDevice ? '📦 Eşyayı ITEM düğmesiyle kullan!' : '📦 Eşyayı E ya da F ile kullan!', 3500), 1400);
      }
      hud.itemRoulette(item, 1.1, () => play('roulette', { volume: 0.35 }), () => play('item_land'));
    },
    // İsabet: vuran bot sevinir, vurulan bot kızar (kişiliğe göre)
    onHit: (victim, owner, result) => {
      if (result !== 'hit') return;
      if (owner === player && victim !== player) raceStats.hits++;
      if (owner && owner !== victim) botReact(owner, 'hitOther', 300);
      botReact(victim, 'gotHit', 500);
    },
    onUse: (kart, item, left = 0) => {
      if (kart === player) hud.setItem(left ? item : null, left);
      const vol = kart === player ? 1 : nearVolume(kart);
      if (vol > 0) play({ turbo: 'turbo', shield: 'shield', coconut: 'throw', oil: 'oil', gull: 'item_land', parrot: 'throw' }[item], { volume: vol });
    },
    // Martı damlayı bıraktı (hit: leke yedi, değilse kalkan engelledi)
    onGull: (kart, hit) => {
      if (kart === player) {
        if (hit) {
          hud.toast('MARTI! 🐦 Görüşün kapandı', 'warn');
          rig.shake(0.5);
          play('hit', { volume: 0.7 });
        } else {
          hud.toast('Kalkan martıyı savdı! 🛡️');
          play('shield_pop');
        }
      } else play(hit ? 'hit' : 'shield_pop', { volume: nearVolume(kart) * 0.6 });
    },
    // Papağan hedefe vardı: 'stolen' çaldı · 'empty' boş eldi · 'blocked' kalkan engelledi (hedefin cihazında)
    onSteal: (thief, target, result) => {
      if (target === player) {
        if (result === 'stolen') hud.setItem(null);
        hud.toast(result === 'stolen' ? 'Papağan eşyanı çaldı! 🦜' : result === 'blocked' ? 'Kalkan papağanı kovdu! 🛡️' : 'Papağan eli boş döndü 🦜', result === 'stolen' ? 'warn' : '');
        if (result === 'stolen') play('hit', { volume: 0.5 });
      } else if (thief === player && result === 'blocked') hud.toast('Papağan kalkana takıldı 🛡️');
    },
    // Hırsız çalınan eşyayı aldı
    onLoot: (thief, item, uses) => {
      if (thief !== player) return;
      hud.itemRoulette(item, 0.7, null, () => play('item_land'));
      hud.setItemCount(uses);
      hud.toast('Papağan eşya getirdi! 🦜');
    },
    onNoTarget: (kart) => {
      if (kart === player) hud.toast('Önünde kimse yok!', 'warn');
    },
  });
  mark('oyun nesneleri');
  minimap = createMinimap(track, { heads, theme: 'glass', shortcuts: 'dash' });
  hud.setMinimap(minimap);
  if (!race) showMenuField();
  mark('harita');
  if (booted) {
    // Yeni pistin shader'ları ve dokuları menüde GPU'ya yüklensin, ilk yarış karesinde (geri sayım) değil
    // Shader derlemesi sürücüde paralel (ana iş parçacığını tutmaz); dokular kare başına küçük dilimlerle yüklenir
    renderer.compileAsync(scene, camera).catch(() => {});
    const textures = new Set();
    scene.traverse((o) => {
      for (const m of [o.material].flat()) if (m) for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'alphaMap']) if (m[k]?.isTexture) textures.add(m[k]);
    });
    uploadTexturesGradually([...textures]);
  }
  mark('shader+doku');
  buildMarks.total = Math.round(performance.now() - buildMarks.start);
  if (window.__tt) Object.assign(window.__tt, { track, items, lastBuild: buildMarks });
  if (buildMarks.total > 700) reportIssue('perf', `pist kurulumu yavaş: ${def.id} ${buildMarks.total}ms ${JSON.stringify(buildMarks.phases)}`);
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
syncVehicles(focus);
let drivers = new Map();
let timeTrial = false; // Zamana Karşı modu (tek oyunculu, botsuz, itemsiz)
let elimMode = false; // Eleme modu (tek oyunculu): her 15 sn son sıra elenir
const ELIM = { grace: 20, interval: 15 };
let ghost = null; // rekor turun hayaleti
let lastTotalRecord = false;
// Turbo Puan: yarış boyu sayaçlar, bitişte verilen ödül ve sonuç ekranında gösterildi mi
const humanKarts = new Set(); // çevrimiçi gerçek oyuncuların kartları (mini haritada beyaz halka)
let raceStats = { shortcuts: 0, gold: 0, lapRecords: 0, hits: 0, mt3: 0 };
let raceReward = null;
let rewardShown = false;
const recorder = createGhostRecorder();
const delta = createDeltaTracker();
const emoteCooldown = new Map(); // kart → son tepki zamanı
let lastConfig = null;
let paused = false; // sadece tek oyunculuda oyunu dondurur
let pauseOpen = false;
let resultsTimer = 0;
let cup = null; // tek oyunculu kupa: { round, tracks, points: Map(karakter → puan), done }
const CUP_POINTS = [15, 12, 10, 8, 6, 4, 2, 1]; // sunucudakiyle aynı
let menuView = 'main';
let displayNames = new Map(); // kart → sonuç ekranında görünen ad
const NO_INPUT = { throttle: 0, brake: 0, steer: 0, drift: false };

// Çevrimiçi durum (null = tek oyunculu)
let online = null;
function newOnline() {
  return {
    room: null,
    isHost: false,
    isBotHost: false, // botları bu cihaz mı sürüyor (sunucu FPS/ping'e göre seçer)
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

// Menü sahnesi: seçili karakter ve rakipleri gride dizilir, diğerleri gizli
function showMenuField() {
  const field = [focus, ...menuRivals.filter((k) => k !== focus)].slice(0, 8);
  setField(field);
  placeOnGrid(field);
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
  // Yatay telefon (kısa ekran): panel solda, sahne sağda; dikey kaydırma yok
  const compact = window.innerHeight <= 520 && window.innerWidth > window.innerHeight;
  viewOffset.tx = race ? 0 : compact ? -0.24 : narrow || (menuView !== 'main' && menuView !== 'garage') ? 0 : -0.2;
  viewOffset.ty = race || !narrow || compact ? 0 : menuView === 'main' ? 0.18 : 0.3;
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
  hud.setBotHost(null);
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
  elimMode = false;
  hud.setTimeTrial(false);
  menu.refreshRecords();
  touch.show(false);
  playMusic('menu');
  focus = kartOf(settings.character);
  syncVehicles(focus);
  showMenuField();
  rig.transition('orbit', 1.5);
}

function toMenu() {
  cup = null;
  endRaceLocal();
  menu.showMain();
  setMenuView('main');
}

// --- Yarış kurulumu (tek oyunculu ve çevrimiçi ortak) ---
function setupRace(order, laps, opts = {}) {
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
  hud.setElimMode(!!opts.elimination);
  emotes.clear();
  chat.setRacing(true);
  lastTotalRecord = false;
  raceStats = { shortcuts: 0, gold: 0, lapRecords: 0, hits: 0, mt3: 0 };
  raceReward = null;
  rewardShown = false;
  hazards.reset();
  race = new Race(track, order, { laps, isOwned, elimination: opts.elimination ?? null });
  autoTuner?.raceReset();
  playMusic('race', trackDef.id);
  touch.show(isTouchDevice);
  if (isTouchDevice && innerHeight > innerWidth) menu.toast('Daha geniş görüş için telefonu yatay çevirebilirsin ↻', { top: true });
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
    driftCoachOnGo();
    // Başlangıç turbosu: "BAŞLA" anında herkese verilir (zamanlama gerekmez); ekranda yazı yok, "BAŞLA!" bandı yeterli
    play('start_boost');
    for (const kart of order) {
      if (isOwned(kart)) kart.boost(KART.startBoost);
      botReact(kart, 'go', Math.random() * 1500);
    }
    recorder.startLap();
    delta.startLap(trackDef.id);
  });
  race.on('lap', (e, time) => {
    if (e.kart !== player) return;
    const best = e.lapTimes.length > 1 && Math.min(...e.lapTimes) === time;
    // Kişisel tur rekoru mu? (rekorsa hayalet olarak saklanır)
    const record = recorder.finishLap(trackDef.id, player.character.id, time);
    delta.startLap(trackDef.id); // yeni rekor turu bir sonraki tur için ölçüt olur
    if (record) raceStats.lapRecords++;
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
        lastTotalRecord = elimMode ? false : submitTotal(trackDef.id, race.laps, e.finishTime);
        const daily = !online && !timeTrial && !elimMode && lastConfig?.daily && lastConfig.track === trackDef.id ? lastConfig.daily : null;
        const dailyOk = daily ? dailyDone(daily, { place, ...raceStats }) : false;
        raceReward = awardRace({ place, racers: order.length, timeTrial, newRecord: lastTotalRecord, trackId: trackDef.id, online: !!online, humans: online ? Math.max(0, humanKarts.size - 1) : 0, dailyKey: daily?.key, dailyOk, ...raceStats });
        raceReward.dailyMiss = daily && !dailyOk ? daily.text : null;
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
  race.on('eliminated', (e, place) => {
    const kart = e.kart;
    fx.event(kart, 'hit');
    fx.event(kart, 'airBoost');
    kart.active = false;
    play('hit', { volume: kart === player ? 1 : nearVolume(kart) });
    hud.elimBanner(displayNames.get(kart) ?? kart.character.name, kart === player);
    if (kart === player) {
      rig.shake(0.8);
      if (resultsTimer === 0) {
        raceReward = awardRace({ place, racers: order.length, timeTrial: false, newRecord: false, trackId: trackDef.id, online: false, humans: 0, ...raceStats });
        raceReward.dailyMiss = null;
        playMusic(null);
        play('finish');
        resultsTimer = 2.5;
      }
    } else if (resultsTimer < 0 && r === race) {
      showResults();
    }
  });
  race.on('wrongWay', (e, wrong) => {
    if (e.kart === player) hud.wrongWay(wrong);
  });
}

async function startOfflineRace(config) {
  // Kupa: 4 pist sabit sırayla; biten kupadan sonra "tekrar" yeni kupa başlatır
  if (CUP_SETS[config.mode]) {
    if (!cup || cup.done || cup.mode !== config.mode) cup = { mode: config.mode, round: 0, tracks: [...CUP_SETS[config.mode]], points: new Map(), done: false };
  } else cup = null;
  await loadTrack(cup ? cup.tracks[cup.round] : config.track ?? settings.track); // pist modelleri inmediyse bekle
  lastConfig = config;
  player = kartOf(config.character);
  syncVehicles(player);
  syncCosmetics(player);
  timeTrial = config.mode === 'timeTrial';
  elimMode = config.mode === 'elimination';
  const bots = (config.rivals ?? pickRivals(config.character)).map(kartOf).filter((k) => k !== player).slice(0, 7);
  // Oyuncu ortalarda (5.) başlar; önünde geçilecek rakipler olsun. Zamana Karşı: tek başına
  const order = timeTrial ? [player] : [...bots.slice(0, 4), player, ...bots.slice(4)];
  setField(order);
  placeOnGrid(order);
  const skill = DIFFICULTY[config.difficulty]?.skill ?? DIFFICULTY.normal.skill;
  drivers = new Map(order.map((k, i) => [k, createDriver(i + 1 + Math.random() * 100, k === player ? [0.97, 0.97] : skill, k.character.personality)]));
  displayNames = new Map(karts.map((k) => [k, k === player && settings.name ? settings.name : k.character.name]));
  ghost?.dispose();
  ghost = null;
  const rec = recordOf(trackDef.id);
  if (timeTrial && rec?.ghost) ghost = createGhost(scene, CHARACTERS.find((c) => c.id === rec.ghost.char) ?? player.character, rec.ghost, trackDef.kartBody);
  if (elimMode) menu.toast('💥 Eleme: her 15 saniyede son sıradaki elenir. Son kalan kazanır!');
  setupRace(order, elimMode ? 999 : config.laps, elimMode ? { elimination: ELIM } : {});
  if (timeTrial && !rec?.ghost) menu.toast('İlk turunu at: en iyi turun hayalet olarak kaydedilecek 👻');
}

function showResults() {
  renderResults();
  if (raceReward && !rewardShown) {
    rewardShown = true;
    hud.showReward(raceReward);
    if (raceReward.dailyMiss) menu.toast(`📅 Günlük hedef tutmadı: ${raceReward.dailyMiss}. Tekrar dene!`);
  }
}

function renderResults() {
  autoTuner?.raceFinish();
  if (timeTrial) {
    const e = race.entryOf(player);
    const rec = recordOf(trackDef.id);
    hud.showTimeTrialResults({
      track: trackDef.name,
      preview: previewOf(trackDef.id),
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
  if (elimMode) {
    return hud.showResults(
      standings.map((e) => ({ id: e.kart.character.id, name: displayNames.get(e.kart) ?? e.kart.character.name, time: e.finishTime, me: e.kart === player })),
      `${trackDef.name} · 💥 Eleme · ${me}. oldun`,
      previewOf(trackDef.id),
    );
  }
  const cupView = online ? onlineCupView(standings, me) : cup ? offlineCupView(standings, me) : null;
  if (cupView) return hud.showResults(cupView.rows, cupView.subtitle, previewOf(trackDef.id), cupView.opts);
  hud.showResults(
    standings.map((e) => ({ id: e.kart.character.id, name: displayNames.get(e.kart) ?? e.kart.character.name, time: e.finishTime, me: e.kart === player })),
    `${trackDef.name} · ${race.laps} tur · ${me}. oldun${lastTotalRecord ? ' · 🏆 yeni rekor' : ''}`,
    previewOf(trackDef.id),
  );
}

// --- Kupa ---
const characterName = (id) => CHARACTERS.find((c) => c.id === id)?.name ?? id;
const cupRow = (id, name, me, total, pts) => ({ id, name, me, right: `${total} puan`, sub: pts ? `+${pts}` : '' });

// Kupa kazanma başarımı (kupa başına bir kez)
let cupWinPaid = null;
function payCupWin(key, mode) {
  if (cupWinPaid === key) return;
  cupWinPaid = key;
  announceBadges(recordCupWin(mode === 'bigCup' ? 'bigCup' : 'cup'));
}
function announceBadges({ fresh }) {
  fresh.forEach((a, i) => setTimeout(() => menu.toast(`${a.icon} Başarım: ${a.name} (+${a.tp} TP)`), i * 900));
}

// Tek oyunculu: kupa puan tablosu (bitmemiş yarışçılar anlık sıraya göre geçici puan alır)
function offlineCupView(standings, me) {
  const final = cup.round >= cup.tracks.length - 1;
  const rows = standings
    .map((e, i) => {
      const id = e.kart.character.id;
      const pts = CUP_POINTS[i] ?? 0;
      return { e, i, pts, total: (cup.points.get(id) ?? 0) + pts };
    })
    .sort((a, b) => b.total - a.total || a.i - b.i)
    .map((r) => cupRow(r.e.kart.character.id, displayNames.get(r.e.kart) ?? r.e.kart.character.name, r.e.kart === player, r.total, r.pts));
  if (final) cup.done = true;
  const running = standings.filter((e) => e.finishTime === null).length;
  if (final && !running && rows[0].me) payCupWin(cup, cup.mode);
  const place = `${trackDef.name} · ${me}. oldun${running ? ' · diğerleri hâlâ yarışıyor' : ''}`;
  return {
    rows,
    subtitle: final ? (rows[0].me ? '🏆 Kupayı sen kazandın!' : `🏆 Kupanın sahibi: ${rows[0].name}`) + (running ? ' (puanlar güncelleniyor)' : '') : place,
    opts: { title: final ? 'Kupa Bitti!' : `Pist ${cup.round + 1}/${cup.tracks.length} bitti`, next: final ? null : 'go', restartLabel: '🏆 Yeni Kupa' },
  };
}

// Çevrimiçi: sunucu yarış bitince puanları gönderir; o zamana kadar bekleme durumu
function onlineCupView(standings, me) {
  const info = online.room?.cup;
  if (!info) return null;
  const c = online.cup;
  if (!c) {
    const rows = standings.map((e) => ({ id: e.kart.character.id, name: displayNames.get(e.kart) ?? e.kart.character.name, time: e.finishTime, me: e.kart === player }));
    return { rows, subtitle: `${trackDef.name} · ${me}. oldun`, opts: { title: `Pist ${info.round + 1}/${info.total}`, next: 'wait', waitText: 'Diğerleri bitiriyor…' } };
  }
  const rows = c.standings.map((s) => cupRow(s.character, s.name ?? characterName(s.character), s.character === player.character.id, s.total, s.pts));
  if (c.final && rows[0].me) payCupWin(c, online.room?.settings?.mode);
  const place = `${trackDef.name} · ${me}. oldun`;
  return {
    rows,
    subtitle: c.final ? (rows[0].me ? '🏆 Kupayı sen kazandın!' : `🏆 Kupanın sahibi: ${rows[0].name}`) : place,
    opts: {
      title: c.final ? 'Kupa Bitti!' : `Pist ${c.round + 1}/${c.total} bitti`,
      next: c.final ? null : online.isHost ? 'go' : 'wait',
      waitText: 'Oda sahibi sonraki pisti başlatacak…',
    },
  };
}

function nextRace() {
  if (online) return net.send({ type: 'nextRace' });
  if (!cup || !race) return;
  race.standings().forEach((e, i) => cup.points.set(e.kart.character.id, (cup.points.get(e.kart.character.id) ?? 0) + (CUP_POINTS[i] ?? 0)));
  cup.round++;
  endRaceLocal(); // eski pistin yarışını bırak; yeni pist yüklenirken eski fizik çalışmasın
  startOfflineRace(lastConfig);
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
  remoteLooks.clear();
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
  menu.showLobby(5); // yarıştan sonra doğrudan son adım (pilotlar, sohbet, hazırım)
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
  if (race) endRaceLocal(); // kupada sonuç ekranından sıradaki pist: eski yarışı bırak
  await loadTrack(msg.track);
  if (!online || online.goAt !== msg.goAt) return;
  online.raceOver = false;
  online.cup = null;
  online.kartById.clear();
  online.idByKart.clear();
  online.buffers.clear();
  remoteLooks.clear();
  const order = msg.entrants.map((e) => {
    const kart = kartOf(e.character);
    if (!e.bot) remoteLooks.set(kart, { paint: e.paint, trail: e.trail });
    kart.setVehicle(vehicleOf(e.vehicle, kart.character)); // botlarda e.vehicle yok → karakterin varsayılanı
    online.kartById.set(e.id, kart);
    online.idByKart.set(kart, e.id);
    online.buffers.set(kart, new RemoteBuffer());
    return kart;
  });
  player = online.kartById.get(net.id);
  syncCosmetics(player);
  online.isHost = online.room?.hostId === net.id;
  online.isBotHost = msg.botHostId ? msg.botHostId === net.id : online.isHost;
  online.botHostId = msg.botHostId ?? online.room?.hostId ?? null;
  refreshBotHostBadge();
  online.owned = new Set([player]);
  if (online.isBotHost) msg.entrants.filter((e) => e.bot).forEach((e) => online.owned.add(online.kartById.get(e.id)));

  setField(order);
  placeOnGrid(order);
  const skill = DIFFICULTY[msg.difficulty]?.skill ?? DIFFICULTY.normal.skill;
  drivers = new Map(order.map((k, i) => [k, createDriver(i + 1 + (msg.goAt % 1000), skill, k.character.personality)]));
  displayNames = new Map();
  nameplates.clear();
  humanKarts.clear();
  for (const e of msg.entrants) {
    const kart = online.kartById.get(e.id);
    displayNames.set(kart, e.bot ? kart.character.name : e.name);
    if (!e.bot) {
      nameplates.set(kart, e.name); // sadece gerçek oyuncuların üstünde isim yazar
      humanKarts.add(kart);
    }
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

// Çevrimiçi yarışta botları kimin cihazının sürdüğünü küçük bir etiketle göster
function refreshBotHostBadge() {
  if (!online || !race || !online.botHostId) return hud.setBotHost(null);
  if (online.botHostId === net.id) return hud.setBotHost('🤖 Botları senin cihazın sürüyor', true);
  const name = online.room?.players.find((p) => p.id === online.botHostId)?.name;
  hud.setBotHost(name ? `🤖 Botlar: ${name} cihazında` : null);
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
  if (!race && mine && focus !== kartOf(mine.character)) {
    focus = kartOf(mine.character);
    syncVehicles(focus);
    if (track) showMenuField();
  }
  const nowHost = msg.hostId === net.id;

  // Bot sürücüsü değişti: biz olduysak botları devral, bırakıldıysak uzaktan gelen duruma dön
  if (race && msg.phase === 'racing' && msg.botHostId !== undefined) {
    const nowBotHost = msg.botHostId === net.id;
    if (nowBotHost && !online.isBotHost) {
      for (const [id, kart] of online.kartById) {
        if (id.startsWith('bot-')) {
          kart.prevPosition.copy(kart.position);
          online.owned.add(kart);
        }
      }
      menu.toast('Botları artık senin cihazın sürüyor.');
    } else if (!nowBotHost && online.isBotHost) {
      for (const [id, kart] of online.kartById) if (id.startsWith('bot-')) online.owned.delete(kart);
    }
    online.isBotHost = nowBotHost;
    online.botHostId = msg.botHostId;
    refreshBotHostBadge();
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

net.on('raceOver', (msg) => {
  if (!online || !race) return;
  online.raceOver = true;
  online.cup = msg.cup ?? null; // kupa puanları
  race.finish();
  if (!hud.resultsOpen) {
    resultsTimer = -1;
    showResults();
  } else if (online.cup) showResults(); // açık tabloyu kupa puanlarıyla yenile
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

// Bağlantı birkaç saniyeden uzun sürerse (sunucu uyanıyor olabilir) kullanıcıya bildir
function slowConnectHint() {
  setTimeout(() => {
    if (online && !net.id) menu.toast('Sunucuya bağlanılıyor… (ilk bağlantı biraz sürebilir)');
  }, 4000);
}

// Sunucuya hiç bağlanılamadıysa sessiz kalma (Oda Kur / Katıl "basınca bir şey olmuyor" görünürdü)
let connectToastAt = 0;
net.on('connectfail', () => {
  if (!online || performance.now() - connectToastAt < 8000) return;
  connectToastAt = performance.now();
  menu.toast('Sunucuya bağlanılamıyor, tekrar deneniyor…');
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
  if (online.isBotHost) {
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
booted = true;
loadTrack(settings.track);
playMusic('menu');
rig.mode = 'orbit';
rig.update(1, focus, true);
updateViewOffset();
applyViewOffset(10);
if (import.meta.env.DEV) {
  window.__tt = { THREE, renderer, scene, camera, rig, karts, track, env, hud, menu, net, items, QUALITY, autoTuner, fx, get race() { return race; }, get hazards() { return hazards; }, get player() { return player; }, get online() { return online; } };
}

// Tüm shader'ları önceden derle, ilk karede takılma olmasın
renderer.compile(scene, camera);
// Açılış ekranı en az 2.4 s görünsün (logo animasyonu ve yapımcı yazısı için)
setTimeout(() => document.getElementById('loading').classList.add('done'), Math.max(0, 2400 - performance.now()));
autoTuner?.markReady(Math.max(performance.now(), 2400));
menu.showMain();

// Sayfa yenilendiyse ve bir odadaysak geri bağlan; davet linkiyle geldiyse katılma penceresini aç
const session = net.session;
const invite = new URLSearchParams(location.search).get('oda');
if (session) {
  online = newOnline();
  net.code = session.code;
  net.token = session.token;
  net.hostIdx = session.host ?? null;
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
  const input = driveInput(drivers.get(kart), kart, track, STEP, { items, karts: activeKarts, positionOf, progressOf, hazards });
  if (input.useItem) items.use(kart, input.backward);
  return input;
}

// Kısayola giriş bildirimi ve atlama çukuruna (dere) düşen kartı geri alma
let playerOnShortcut = false;
function checkShortcutEvents(kart) {
  if (kart === player && race.started) {
    if (kart.onShortcut && !playerOnShortcut) {
      hud.toast('KISAYOL! ⚡');
      raceStats.shortcuts++;
      if (tipOnce('shortcut')) setTimeout(() => race && !paused && hud.coach('⚡ Kestirmeler yolu kısaltır, Turbo Puan da getirir!', 3500), 1500);
    }
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
      hud.toast(kart.fallShortcut?.def.jump?.fallText ?? 'Dereye düştün! 💦', 'warn');
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
  if (race.started) hazards.update(race.clock, STEP, activeKarts, isOwned);
  if (race.started && race.entryOf(player)?.finishTime === null) recorder.sample(player, STEP);
  race.update(STEP);
}

let lastDrawAt = 0;
function frame(now) {
  // FPS sınırı (pil/ısı için): hedef aralığa gelmeden kareyi atla; fizik birikimi dt ile telafi edilir
  if (QUALITY.fpsCap && now - lastDrawAt < 1000 / QUALITY.fpsCap - 2) {
    requestAnimationFrame(frame);
    return;
  }
  lastDrawAt = now;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tickCosmetics(now / 1000);

  if (race && online) updateRemoteKarts();

  let throttle = 0;
  if (race && !paused) {
    const input = readInput(!race.started);
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

    accumulator += dt;
    while (accumulator >= STEP) {
      raceStep(input);
      accumulator -= STEP;
    }
    if (online) sendStates(dt);
  }

  const alpha = race && !paused ? accumulator / STEP : 1;
  for (const kart of karts) {
    if (!kart.active) continue;
    if (isOwned(kart) || !race) kart.updateVisual(alpha, paused ? 0 : dt);
    else kart.updateVisual(1, dt);
    if (race && !paused && kart.active) {
      fx.kart(kart, dt);
      fx.boostFlame(kart, dt);
    }
    for (const ev of kart.events) {
      fx.event(kart, ev);
      kartSound(kart, ev);
      if (kart === player) driftCoach(ev);
      if (kart === player && ev === 'miniTurbo3' && race?.started) raceStats.mt3++;
    }
    if (kart === player && kart.drifting && driftPulse) setDriftPulse(false);
    kart.events.length = 0;
  }
  if (race) items.animate(dt, karts);
  const showTime = race ? race.clock : now / 1000;
  hazards?.animate(now / 1000);
  if (volcanoShow && !paused) volcanoShow.update(showTime, dt, volcanoGlow);
  emotes.update(paused ? 0 : dt);
  if (ghost && race) {
    const e = race.entryOf(player);
    ghost.update(race.started && e.finishTime === null ? race.clock - e.lapStart : -1, paused ? 0 : dt);
  }
  // Eleme: elenince kalan yarışı lider kartın arkasından izle
  const target = race ? (elimMode && race.entryOf(player)?.eliminated ? race.standings()[0].kart : player) : focus;
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

  applyPixelRatio();
  postfx.render();

  if (autoTuner && !race) autoTuner.menuFrame(dt, now, !paused && !online && !document.querySelector('.tt-modal.show'));
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    const ns = online && net.connected ? net.statsInfo() : null;
    const ping = online && net.connected ? ` · ${Math.round(net.rtt)} ms${ns ? ` · yayın ${ns.hz}/sn (sunucu ≤${ns.srvMax} ağ ≤${ns.arrMax} ms)` : ''}` : '';
    const fps = fpsFrames / fpsTime;
    lastFps = fps;
    fpsAvg = fpsAvg ? fpsAvg * 0.85 + fps * 0.15 : fps;
    const flags = `${QUALITY.bloom ? 'bloom' : 'bloom yok'} · AA ${QUALITY.aa}${QUALITY.sharpen ? ' +keskin' : ''}`;
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

// Drift öğretisi: oyuncular driftle nitro kazanmayı bilmiyor. İlk yarışlarda başlangıçta, kısa bırakınca ve
// ilk nitro kazanılınca kısa ipucu çıkar; nitro kazanılınca (driftLearned) bir daha çıkmaz.
let driftPulse = false;
let lastDriftHint = -1e9;
function setDriftPulse(on) {
  driftPulse = on;
  document.querySelector('#touch .drift')?.classList.toggle('hint', on);
}
function driftCoachOnGo() {
  if (settings.driftLearned || settings.driftTips >= 3 || timeTrial) return;
  saveSettings({ driftTips: settings.driftTips + 1 });
  hud.coach(isTouchDevice ? '🔥 Virajda DRIFT butonunu basılı tut, bırakınca NİTRO!' : '🔥 Virajda Space ya da Shift tuşunu basılı tut, bırakınca NİTRO!', 5500);
  if (isTouchDevice) setDriftPulse(true);
}
function driftCoach(ev) {
  if (settings.driftLearned) return;
  if (ev.startsWith('miniTurbo')) {
    saveSettings({ driftLearned: true });
    setDriftPulse(false);
    hud.coach('✨ Nitro kazandın! Drift ne kadar uzun sürerse nitro o kadar güçlü', 4500);
  } else if (ev === 'driftShort' && settings.driftShortTips < 3 && performance.now() - lastDriftHint > 20000) {
    lastDriftHint = performance.now();
    saveSettings({ driftShortTips: settings.driftShortTips + 1 });
    hud.coach('Biraz daha uzun tut: kıvılcım mavi olunca bırak = nitro!', 4500);
  }
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
  else if (ev === 'pad' || ev === 'airBoost') play('turbo', { volume: vol * 0.7, ...(ev === 'airBoost' && { rate: 1.15 }) });
  else if (ev === 'bounce') play('item_land', { volume: vol * 0.8, rate: 1.3 });
}

// Dinamik çözünürlük: FPS kalıcı olarak düşükse piksel oranını azalt. Her değişim render hedeflerini yeniden kurar (kısa takılma),
// bu yüzden seyrek ve büyük adımla yapılır: 3 sn kalıcı düşüş → FPS oranına göre tek hamlede hedefe in, 6 sn bekle, yarışta en çok 3 kez.
// Yukarı çıkış yok (gidip gelme yaratırdı); kalıcı yavaşlıkta kalite seviyesini autoQuality sonraki yarışlar için düşürür.
const RATIO_FLOOR = 0.8;
let slowTime = 0;
let slowSum = 0;
let ratioCooldown = 0;
let ratioChanges = 0;
let ratioRace = null;
const fixedRes = !QUALITY.dynRes || new URLSearchParams(location.search).has('fixres'); // tanı/ölçüm: dinamik çözünürlük kapalı
function adaptResolution(fps) {
  if (fixedRes) return;
  // Geri sayımda ve "BAŞLA"dan sonraki ilk 6 sn'de ayar yapma: doku/shader ısınması FPS'i geçici düşürür
  if (!race || paused || document.hidden || !race.started || race.clock < 6) {
    slowTime = slowSum = 0;
    return;
  }
  if (ratioRace !== race) {
    ratioRace = race;
    ratioChanges = 0;
    ratioCooldown = 0;
  }
  autoTuner?.raceSample(fps, pixelRatio, basePixelRatio);
  if (ratioCooldown > 0) {
    ratioCooldown -= 0.5;
    slowTime = slowSum = 0;
    return;
  }
  if (fps < 45) {
    slowTime += 0.5;
    slowSum += fps;
  } else slowTime = slowSum = 0;
  const floor = Math.min(RATIO_FLOOR, basePixelRatio);
  if (slowTime >= 3 && ratioChanges < 3 && pixelRatio > floor + 0.05) {
    const avg = slowSum / (slowTime * 2); // 0.5 sn'lik örnekler
    // Piksel sayısı ~ oran²: hedef 55 FPS'e orantıyla in, 0.05'e yuvarla
    const target = Math.round((pixelRatio * Math.sqrt(Math.min(1, avg / 55)) * 0.97) / 0.05) * 0.05;
    const next = Math.max(floor, Math.min(pixelRatio - 0.1, target));
    if (pixelRatio <= 1) reportIssue('perf', 'düşük FPS: çözünürlük 1.0 altına indi');
    pixelRatio = next;
    ratioChanges++;
    ratioCooldown = 6;
    slowTime = slowSum = 0;
    ratioDirty = true; // uygulama bir sonraki karede, çizimden ÖNCE (aşağıda)
  }
}

// Çizimden sonra setSize yapmak tuvali temizler ve sunulmadan önce boş (beyaz) kare görünür: yalnızca çizimden önce uygula.
let ratioDirty = false;
function applyPixelRatio() {
  if (!ratioDirty) return;
  ratioDirty = false;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  postfx.setPixelRatio(pixelRatio);
}

function updateHud(dt) {
  const entry = race.entryOf(player);
  const activeKarts = karts.filter((k) => k.active);
  hud.setPosition(race.positionOf(player), elimMode && entry.eliminated ? race.entries.length : activeKarts.length);
  hud.setLap(Math.min(race.laps, Math.max(1, entry.lapsDone + 1)), race.laps);
  hud.setTime(entry.finishTime ?? Math.max(0, race.clock));
  hud.setSplat(player.gullTime);
  if (elimMode) {
    const alive = race.entries.filter((e) => e.finishTime === null).length;
    hud.setElim(race.state === 'racing' && alive > 1 ? { left: race.elim.nextAt - race.clock, alive, danger: !entry.eliminated && race.positionOf(player) === alive } : null);
  }
  hud.setDelta(timeTrial && race.started && entry.finishTime === null ? delta.update(player, race.clock - entry.lapStart) : null);
  const speed = Math.abs(player.speed);
  hud.setSpeed(speed * 3.6, speed / KART.maxSpeed, player.boostTime > 0);
  minimap.draw(activeKarts.map((k) => ({ x: k.position.x, z: k.position.z, id: k.character.id, color: k.character.color, me: k === player, human: k !== player && humanKarts.has(k), place: race.positionOf(k) })), performance.now() / 1000);
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
  Object.assign(window.__tt, { emotes, chat, recordOf, nameplates });
  Object.defineProperties(window.__tt, { ghost: { get: () => ghost }, drivers: { get: () => drivers }, hazards: { get: () => hazards } });
  window.__tt.freeze = (on) => (paused = on); // menü açmadan dondur (ekran görüntüsü için)
  // Pist önizleme görüntüsü üretmek için (public/previews): sahneyi şu anki kamerayla çizip w×h JPEG döner
  window.__tt.snapshot = (w = 640, h = 360, q = 0.82) => {
    postfx.render();
    const src = renderer.domElement;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    let sw = src.width;
    let sh = src.height;
    if (sw / sh > w / h) sw = sh * (w / h);
    else sh = sw / (w / h);
    c.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, w, h);
    return c.toDataURL('image/jpeg', q);
  };
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
