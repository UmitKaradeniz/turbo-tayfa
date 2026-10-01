import { buildStreetLamps } from '../city.js';

// "Hayalet Mezarlığı" — sisli bir gecede, mezar taşlarının, sarkık ağaçların ve oyulmuş balkabaklarının arasından
// geçen pist. Yolu kesen hayaletler, mezardan fışkıran yeşil ruh sütunları ve toprak bir mezar yolu var.
// Kontrol noktaları: [x, z, yükseklik].

const PINES = ['halloween/tree_dead_large', 'halloween/tree_dead_medium', 'halloween/tree_dead_small', 'halloween/tree_pine_orange_large', 'halloween/tree_pine_orange_medium', 'halloween/tree_pine_yellow_large', 'halloween/tree_pine_yellow_medium', 'graveyard/pine', 'graveyard/pine-crooked'];
const STONES = ['graveyard/gravestone-bevel', 'graveyard/gravestone-broken', 'graveyard/gravestone-cross', 'graveyard/gravestone-cross-large', 'graveyard/gravestone-decorative', 'graveyard/gravestone-roof', 'graveyard/gravestone-round', 'graveyard/gravestone-wide', 'graveyard/cross', 'graveyard/cross-wood', 'halloween/gravestone', 'halloween/grave_A', 'halloween/grave_B', 'halloween/gravemarker_A', 'halloween/gravemarker_B'];
const PUMPKINS = ['graveyard/pumpkin-carved', 'graveyard/pumpkin-tall-carved', 'halloween/pumpkin_orange_jackolantern', 'halloween/pumpkin_yellow_jackolantern'];

export default {
  id: 'graveyard',
  name: 'Hayalet Mezarlığı',
  meta: 'Gece · sis · hayalet',
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5,
  terrainSize: 760,
  shoreMargin: () => 85,
  outer: 'mountains',
  baseHeight: 0,
  ponds: [],
  noWater: true,
  night: true,
  palette: { base: 0x3b4a3e, shore: 0x2a3430, patch: 0x4a3a5c, patchDark: 0x35293f, shoulder: 0x46514a, cliff: 0x3a2f55 },
  roadStyle: { base: '#4a4152', blotchDark: '24,18,32', blotchLight: '120,104,146', line: '#c9b8ff', curbs: [0xc9b8ff, 0x4a2f7a] },
  dust: [0.5, 0.5, 0.6],
  sky: { top: 0x080414, horizon: 0x4a3377, fog: 0x1e1638 },
  water: { shallow: 0x2a2347, deep: 0x120c24 },
  light: { hemiSky: 0x8a78d8, hemiGround: 0x22302a, hemi: 1.0, sun: 0xb9c6ff, sunI: 1.7, sunDir: [-0.4, 0.6, 0.35], glow: 0xcfd8ff, fogNear: 70, fogFar: 380 },
  control: [
    [-30, 150, 1], // başlangıç
    [70, 160, 1.5],
    [160, 130, 2.4],
    [212, 60, 4.5], // kilise tepesine tırmanış
    [215, -25, 9.5], // kilise tepesi
    [175, -95, 6.5],
    [105, -135, 3.5],
    [30, -125, 1.8],
    [-30, -90, 1.3], // vadi tabanı (bataklık)
    [-95, -95, 1], // kısayol girişi
    [-170, -90, 1.2],
    [-232, -12, 2],
    [-200, 70, 2.4], // kısayol çıkışı
    [-130, 125, 1.6],
  ],

  // Zemin bölgeleri: gevşek mezar toprağı (yavaşlatır) ve mor hız şeridi
  hillReach: 110,
  // Dağ-bayır: kilise tepesi (control), inişte ve batı kıvrımında yatık yol, mezar toprağı tümsekleri
  bank: [{ f: [0.38, 0.46], deg: 7 }, { f: [0.7, 0.78], deg: 6 }],
  bumps: [{ f: [0.865, 0.925], amp: 0.4, period: 20 }],

  zones: [
    { type: 'mud', f: [0.505, 0.545], lateral: [-8, 8] },
    { type: 'boost', f: [0.36, 0.375], lateral: [-2.6, 2.6], color: '#b58cff' },
  ],

  // Hayaletler yolu kesip geçer; mezardan yeşil ruh sütunları fışkırır
  hazards: [
    { type: 'ball', skin: 'ghost', ballRadius: 2.2, f: 0.09, period: 11, offset: 3, dir: 1 },
    { type: 'ball', skin: 'ghost', ballRadius: 2.2, f: 0.4, period: 12, offset: 7, dir: -1 },
    { type: 'ball', skin: 'ghost', ballRadius: 2.2, f: 0.9, period: 11, offset: 1, dir: 1 },
    ...[0.2, 0.28, 0.58, 0.68, 0.94].map((f, k) => ({
      type: 'geyser',
      f,
      lateral: k % 2 ? 3.5 : -3.5,
      radius: 4.2,
      period: 7 + (k % 3) * 0.5,
      offset: (k * 2.1) % 7,
      colors: { ring: [0.35, 1.5, 0.55], column: [0.45, 1.7, 0.7], ember: [0.9, 2.5, 1.1], hot: [1.6, 2.7, 1.2], smoke: [0.62, 0.9, 0.7] },
    })),
  ],

  // Kısayol: açık mezarlardan geçen toprak yol; ortasında mezar çukurunu aşan rampa var.
  shortcuts: [
    {
      id: 'graveLeap',
      name: 'Mezar Atlayışı',
      points: [[-95, -95], [-118, -70], [-140, -35], [-160, 5], [-182, 40], [-200, 70]],
      halfWidth: 4.4,
      surface: 'dirt',
      speed: 0.88,
      color: 0x514a3c,
      pads: [{ f: 0.15 }, { f: 0.85 }],
      jump: { at: [-150, -15], ramp: 12, height: 2.4, gap: 12, depth: 5.5, landing: 14, drop: 0.7, rampColor: 0x7a5cc8, water: 0x0d1a12, fallText: 'Açık mezara düştün! ⚰️' },
      boxes: { at: 'landing', lateral: [-2, 2] },
      edge: { keys: ['graveyard/gravestone-wide', 'graveyard/gravestone-round', 'graveyard/rocks-tall', 'halloween/gravemarker_A'], step: 6, scale: [6, 9] },
      botChance: 0.5,
      botMinSpeed: 22,
    },
  ],

  models: [
    'racing/barrierRed', 'racing/barrierWhite', 'racing/overheadLights', 'racing/flagCheckers', 'racing/bannerTowerRed', 'racing/bannerTowerGreen',
    ...['character-ghost', 'character-keeper', 'character-skeleton', 'character-vampire', 'character-zombie', 'crypt', 'crypt-large', 'crypt-small', 'cross', 'cross-wood', 'column-large', 'coffin', 'coffin-old', 'fire-basket', 'gravestone-bevel', 'gravestone-broken', 'gravestone-cross', 'gravestone-cross-large', 'gravestone-decorative', 'gravestone-roof', 'gravestone-round', 'gravestone-wide', 'grave', 'lightpost-single', 'lightpost-double', 'lantern-candle', 'pine', 'pine-crooked', 'pumpkin', 'pumpkin-carved', 'pumpkin-tall-carved', 'rocks', 'rocks-tall', 'urn-round', 'hay-bale', 'altar-stone', 'trunk', 'stone-wall', 'shovel-dirt', 'debris', 'candle-multiple'].map((k) => `graveyard/${k}`),
    ...['arch', 'arch_gate', 'bench', 'bench_decorated', 'bone_A', 'candle_triple', 'coffin', 'coffin_decorated', 'crypt', 'fence', 'fence_gate', 'fence_pillar', 'grave_A', 'grave_B', 'gravemarker_A', 'gravemarker_B', 'gravestone', 'lantern_standing', 'post_lantern', 'pumpkin_orange_jackolantern', 'pumpkin_yellow_jackolantern', 'pumpkin_orange', 'pumpkin_yellow', 'ribcage', 'shrine_candles', 'skull', 'skull_candle', 'tree_dead_large', 'tree_dead_medium', 'tree_dead_small', 'tree_dead_large_decorated', 'tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_orange_small', 'tree_pine_yellow_large', 'tree_pine_yellow_medium', 'tree_pine_yellow_small', 'plaque_candles', 'pillar', 'post_skull'].map((k) => `halloween/${k}`),
  ],

  decorate(ctx) {
    const { track, rng } = ctx;
    const hw = this.halfWidth;
    const edge = track.edge;
    const terrain = track.terrain;
    const probe = ctx.along(0, 30);
    const outerSide = track.insideLoop(probe.x, probe.z) ? -1 : 1;
    const innerSide = -outerSide;
    const half = terrain.size / 2 - 8;

    // Oyulmuş balkabakları, fener ve mum ışıkları içten parlar
    ctx.tint({ emissive: 0xff7a1a, intensity: 0.5 }, 'graveyard/pumpkin-carved', 'graveyard/pumpkin-tall-carved', 'halloween/pumpkin_orange_jackolantern', 'halloween/pumpkin_yellow_jackolantern', 'graveyard/fire-basket', 'graveyard/lantern-candle', 'graveyard/candle-multiple', 'halloween/candle_triple', 'halloween/lantern_standing', 'halloween/post_lantern', 'halloween/shrine_candles', 'halloween/skull_candle', 'halloween/plaque_candles');
    ctx.tint({ emissive: 0x7affc0, intensity: 0.5 }, 'graveyard/character-ghost');

    // --- Başlangıç alanı ---
    const gantry = ctx.along(0, 0);
    ctx.place('racing/overheadLights', gantry.x, gantry.z, gantry.acrossY, (2 * (hw + 1) + 3) / 1.26, track.centerline[0].y - 0.15);
    for (const s of [-1, 1]) {
      const f = ctx.along(1, s * (hw + 3));
      ctx.place('racing/flagCheckers', f.x, f.z, f.faceTrackY, 7);
    }
    for (const s of [-1, 1]) {
      const g = ctx.along(-3, s * (hw + 7));
      ctx.place('halloween/arch_gate', g.x, g.z, g.faceTrackY, 7);
    }
    for (let k = -26; k <= 26; k += 8) {
      if (Math.abs(k) < 4) continue;
      const b = ctx.along(k, innerSide * (edge + 2.5));
      ctx.place(k % 16 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
    }
    // Seyirci kalabalığı: iskelet, zombi, vampir, hayalet, bekçi
    const crowd = ['graveyard/character-skeleton', 'graveyard/character-zombie', 'graveyard/character-vampire', 'graveyard/character-ghost', 'graveyard/character-keeper'];
    for (let k = -20; k <= 24; k += 5) {
      const c = ctx.along(k, outerSide * (edge + 6 + (k % 10 ? 0 : 2)));
      ctx.place(crowd[((k + 20) / 5) % 5 | 0], c.x, c.z, c.faceTrackY, 4.6);
      ctx.reserve(c.x, c.z, 2.5);
    }
    for (const sc of track.shortcuts) {
      for (const s of [4, sc.length - 4]) {
        for (const side of [-1, 1]) {
          const b = ctx.shortcutAt(sc, s, side * (sc.halfAt(s) + 3));
          ctx.place(s < 10 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
        }
      }
      for (const s of [sc.jump.rampA - 6, sc.jump.rampA + 2, sc.jump.pitB + 2]) {
        for (const side of [-1, 1]) {
          const f = ctx.shortcutAt(sc, s, side * (sc.halfWidth + 1.8));
          ctx.place('graveyard/fire-basket', f.x, f.z, 0, 4);
        }
      }
    }

    // Yol boyunca ateş sepetleri ve balkabakları
    for (let i = 10; i < track.count; i += 20) {
      const side = (i / 20) % 2 ? 1 : -1;
      const c = ctx.along(i, side * (edge + 1.8));
      if (track.shortcutClearance(c.x, c.z) < 4) continue;
      ctx.place(i % 40 ? PUMPKINS[Math.floor(rng() * PUMPKINS.length)] : 'graveyard/fire-basket', c.x, c.z, c.faceTrackY, 3 + rng() * 1);
    }
    buildStreetLamps(ctx, { every: 20, skip: (i) => i < 8 });

    // --- Mezarlık: çakışma denetimli serpiştirme ---
    const taken = [];
    const put = (keys, [a, b], fp, dMin, dMax, count) => {
      let placed = 0;
      for (let tries = 0; placed < count * ctx.density && tries < count * 120; tries++) {
        const x = (rng() * 2 - 1) * half;
        const z = (rng() * 2 - 1) * half;
        const d = terrain.roadDistAt(x, z);
        if (d < dMin || d > dMax) continue;
        if (track.shortcutClearance(x, z) < 10) continue;
        const s = a + rng() * (b - a);
        const r = fp * s;
        if (taken.some(([tx, tz, tr]) => (x - tx) ** 2 + (z - tz) ** 2 < (r + tr) ** 2)) continue;
        taken.push([x, z, r]);
        ctx.reserve(x, z, r);
        ctx.place(keys[Math.floor(rng() * keys.length)], x, z, rng() * Math.PI * 2, s);
        placed++;
      }
    };
    const off = edge + 5;
    put(['graveyard/crypt', 'graveyard/crypt-large', 'graveyard/crypt-small', 'halloween/crypt'], [8, 12], 1.1, off + 14, 130, 7);
    put(STONES, [5, 8], 0.7, off, 120, 80);
    put(PINES, [8, 13], 0.35, off + 2, 130, 70);
    put(PUMPKINS, [4, 7], 0.5, off, 110, 28);
    put(['graveyard/coffin', 'graveyard/coffin-old', 'halloween/coffin', 'halloween/coffin_decorated', 'graveyard/altar-stone', 'halloween/shrine_candles'], [6, 9], 0.9, off + 6, 120, 10);
    put(['graveyard/character-skeleton', 'graveyard/character-zombie', 'graveyard/character-ghost', 'graveyard/character-vampire'], [5, 7], 0.6, off + 4, 120, 14);
    put(['graveyard/rocks', 'graveyard/rocks-tall', 'graveyard/hay-bale', 'graveyard/urn-round', 'halloween/skull', 'halloween/ribcage', 'halloween/bone_A'], [4, 8], 0.5, off, 110, 36);
  },
};
