// Ses: müzik (menü / yarış), olay efektleri ve kodla üretilen motor + kayma sesi.
// Tarayıcılar sesi ancak bir kullanıcı etkileşiminden sonra açtığı için
// AudioContext ilk tıklama/tuşta başlatılır.

import { settings } from './settings.js';

const SOUNDS = [
  'ui_click', 'ui_select', 'ui_back', 'countdown', 'go', 'item_box', 'roulette', 'item_land', 'turbo', 'mini_turbo',
  'start_boost', 'shield', 'shield_pop', 'throw', 'oil', 'hit', 'spin', 'wall', 'bump', 'lap', 'final_lap',
  'finish_win', 'finish',
];
const MUSIC = { menu: 'music_menu', race: 'music_race' };
// Pist başına yarış müziği (dosya: music_<pist>); listede olmayan pist genel yarış müziğini çalar
const TRACK_MUSIC = new Set(['palmCove', 'pineValley', 'snowPeak', 'nightCity', 'volcano', 'moon', 'toyRoom', 'candyLand', 'funfair', 'graveyard', 'dinoValley']);

const ext = (() => {
  const a = document.createElement('audio');
  return a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
})();

let ctx = null;
let master;
let sfxGain;
let musicGain;
const buffers = new Map();
const loading = new Map();
let music = { name: null, source: null, gain: null };
let wantedMusic = null;
let wantedTrack = null;
let engine = null;

function load(name) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name));
  if (!loading.has(name)) {
    loading.set(
      name,
      fetch(`/audio/${name}.${ext}`)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buf) => {
          buffers.set(name, buf);
          return buf;
        })
        .catch(() => null),
    );
  }
  return loading.get(name);
}

function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.connect(master);
  musicGain = ctx.createGain();
  musicGain.connect(master);
  applyVolumes();
  // Kısa efektleri önceden yükle, müziği gerektiğinde
  SOUNDS.forEach(load);
  if (wantedMusic) playMusic(wantedMusic, wantedTrack);
}
for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else ctx.resume();
});

export function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  sfxGain.gain.setTargetAtTime(settings.sfxVolume, t, 0.05);
  musicGain.gain.setTargetAtTime(settings.musicVolume * 0.55, t, 0.05);
}

// Tek seferlik efekt. rate: perde (1 = normal)
export function play(name, { volume = 1, rate = 1 } = {}) {
  if (!ctx || ctx.state !== 'running') return;
  const buf = buffers.get(name);
  if (!buf) {
    load(name);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(sfxGain);
  src.start();
}

// Müzik: 'menu' | 'race' | null (race için pist kimliği verilirse o pistin müziği). Eskisi yavaşça kısılır, yenisi açılır.
export function playMusic(which, trackId = null) {
  wantedMusic = which;
  wantedTrack = trackId;
  if (!ctx) return;
  const name = which === 'race' && TRACK_MUSIC.has(trackId) ? `music_${trackId}` : which ? MUSIC[which] : null;
  if (music.name === name) return;
  const old = music;
  if (old.source) {
    old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    old.source.stop(ctx.currentTime + 2);
  }
  music = { name, source: null, gain: null };
  if (!name) return;
  load(name).then((buf) => {
    if (!buf || music.name !== name || music.source) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
    src.connect(g).connect(musicGain);
    src.start();
    music.source = src;
    music.gain = g;
  });
}

// Motor + kayma sesi (oyuncunun kartı için). Kodla üretilir, dosya gerekmez.
function createEngine() {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(sfxGain);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.8; // düşük rezonans: tiz ıslık yok
  filter.connect(out);

  const o1 = ctx.createOscillator();
  o1.type = 'sawtooth';
  const o2 = ctx.createOscillator();
  o2.type = 'square';
  const g2 = ctx.createGain();
  g2.gain.value = 0.35;
  o1.connect(filter);
  o2.connect(g2).connect(filter);
  // Hafif titreşim (motor pıtırtısı)
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 18;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 3;
  lfo.connect(lfoGain);
  lfoGain.connect(o1.frequency);
  lfoGain.connect(o2.frequency);

  // Kayma sesi: bant geçiren filtreden geçen gürültü
  const noise = ctx.createBufferSource();
  const len = ctx.sampleRate * 2;
  const nb = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noise.buffer = nb;
  noise.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1800;
  band.Q.value = 1.2;
  const skid = ctx.createGain();
  skid.gain.value = 0;
  noise.connect(band).connect(skid).connect(sfxGain);

  for (const n of [o1, o2, lfo, noise]) n.start();
  return { out, filter, o1, o2, skid, band };
}

// Her karede: kart durumuna göre motor/kayma sesini güncelle (kart null → sustur)
export function updateEngine(kart, throttle, maxSpeed) {
  if (!ctx || ctx.state !== 'running') return;
  if (!engine) engine = createEngine();
  const t = ctx.currentTime;
  if (!kart) {
    engine.out.gain.setTargetAtTime(0, t, 0.15);
    engine.skid.gain.setTargetAtTime(0, t, 0.1);
    return;
  }
  const ratio = Math.min(1.35, Math.abs(kart.speed) / maxSpeed);
  const boost = kart.boostTime > 0 ? 1 : 0;
  const base = 48 + ratio * 95 + boost * 25;
  engine.o1.frequency.setTargetAtTime(base, t, 0.06);
  engine.o2.frequency.setTargetAtTime(base * 0.5, t, 0.06);
  engine.filter.frequency.setTargetAtTime(380 + ratio * 650 + throttle * 120 + boost * 300, t, 0.08);
  engine.out.gain.setTargetAtTime(0.018 + throttle * 0.016 + ratio * 0.02, t, 0.1);
  // Drift ya da kumda kayma
  const sliding = kart.drifting ? 0.12 : (kart.surface === 'sand' || kart.surface === 'dirt') && ratio > 0.2 ? 0.05 : 0;
  engine.skid.gain.setTargetAtTime(sliding, t, 0.06);
  engine.band.frequency.setTargetAtTime(kart.drifting ? 1900 + ratio * 600 : 700, t, 0.1);
}
