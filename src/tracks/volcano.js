import { buildStreetLamps } from '../city.js';
import { buildVolcano } from '../volcano.js';

// "Volkan Adası" — ortasında kül püsküren bir yanardağ olan, lav denizinin ortasındaki kara ada.
// Yol yanardağın etrafında döner. Tehlikeler: yolda zamanlı gayzerler (uyarı halkası, sonra kor patlaması),
// yavaşlatan kızgın zemin çatlakları ve lav nehrini aşan bir kısayol.
// Kontrol noktaları: [x, z, yükseklik].

export default {
  id: 'volcano',
  name: 'Volkan Adası',
  kartBody: 'karts/kart-volcano', // haritaya özel araç gövdesi (tools/gen_kart.py)
  meta: 'Lav · kül · gayzer',
  groundTex: { tex: 'gravel', rock: 'rock', scale: 0.11, strength: 1.1 }, // ambientCG (CC0) detay dokusu; sadece Yüksek kalite
  roadTex: 'asphalt_n', // yol normal haritası (ambientCG, CC0); Orta/Yüksek kalite
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5,
  terrainSize: 640,
  shoreMargin: (t) => 70 - 14 * Math.cos(t * Math.PI * 2 * 3),
  ponds: [{ x: -221, z: 80, r: 28 }, { x: 59, z: -220, r: 26 }], // lav gölleri
  palette: { base: 0x4a3b35, shore: 0x281c19, patch: 0x5e372a, patchDark: 0x382420, shoulder: 0x54443c },
  dust: [0.42, 0.34, 0.3],
  ash: true,
  embers: true,
  noClouds: true,
  sky: { top: 0x32121a, horizon: 0xff6f30, fog: 0x5b2419 },
  skyTex: { id: 'wasteland_clouds_puresky', az: 0.6228, mix: 0.55, dim: 0.6 }, // Poly Haven (CC0) gökyüzü; Düşük kalitede kapalı
  water: { lava: true, shallow: 0xffa624, deep: 0xc42a08 },
  light: { hemiSky: 0xff9d78, hemiGround: 0x3a1a14, hemi: 0.95, sun: 0xff9a55, sunI: 2.1, sunDir: [-0.5, 0.32, 0.6], glow: 0xff7a30, fogNear: 90, fogFar: 500 },
  volcano: { x: 0, z: 0, radius: 68, height: 75, y: -1.5, period: 12 },
  control: [
    [-26, 147.7, 1], // başlangıç
    [-91.3, 108.8, 1],
    [-161.6, 58.8, 1.5],
    [-147.7, -26, 3], // krater yamacına tırmanış
    [-91.7, -64.2, 5],
    [-73.1, -117, 8],
    [-23.4, -166.4, 11],
    [41.3, -144.2, 12.5], // krater kenarı (zirve)
    [69.4, -95.5, 10], // kalderaya iniş
    [111.1, -74.9, 6], // kısayol girişi
    [159.5, -28.1, 2.5],
    [135.2, 36.2, 1.5],
    [85.8, 72, 1], // kısayol çıkışı
    [65.7, 123.6, 1],
    [28.1, 159.5, 1],
  ],

  hillReach: 110,
  // Dağ-bayır: krater kenarı ve iniş virajlarında yol içe yatar
  bank: [{ f: [0.14, 0.18], deg: 7 }, { f: [0.43, 0.49], deg: 10 }, { f: [0.68, 0.72], deg: 7 }, { f: [0.92, 0.96], deg: 7 }],

  // Kızgın zemin: yolun bir bölümünde parlayan çatlaklar kartı yavaşlatır (turbo varken yavaşlatmaz).
  // f: turun oranı, lateral: yolun solu (-) ile sağı (+) arasında metre.
  hotZones: [
    { f: [0.06, 0.11], lateral: [-8, 1.2] },
    { f: [0.31, 0.37], lateral: [-1.2, 8] },
    { f: [0.57, 0.63], lateral: [-8, 1.2] },
    { f: [0.84, 0.9], lateral: [-1.2, 8] },
  ],

  // Gayzerler: uyarı halkası kızarır, sonra kor sütunu fışkırır; içindeki kart savrulur.
  hazards: [
    { type: 'geyser', f: 0.21, lateral: -3.5, radius: 4.2, period: 7, offset: 1 },
    { type: 'geyser', f: 0.27, lateral: 3.5, radius: 4.2, period: 8, offset: 4 },
    { type: 'geyser', f: 0.41, lateral: -3.5, radius: 4.2, period: 6.5, offset: 2 },
    { type: 'geyser', f: 0.53, lateral: 3.5, radius: 4.2, period: 7.5, offset: 5.5 },
    { type: 'geyser', f: 0.69, lateral: -3.5, radius: 4.2, period: 7, offset: 3 },
    { type: 'geyser', f: 0.8, lateral: 3.5, radius: 4.2, period: 8, offset: 0 },
    { type: 'geyser', f: 0.94, lateral: -3.5, radius: 4.2, period: 7, offset: 6 },
    // Kalderaya inerken yamaçtan yuvarlanan kayalar
    { type: 'ball', skin: 'lava', ballRadius: 2.4, f: 0.555, period: 11, offset: 2, dir: 1 },
    { type: 'ball', skin: 'lava', ballRadius: 2.4, f: 0.66, period: 12, offset: 6, dir: -1 },
  ],

  // Kısayol: yanardağın eteğinden geçen toprak yol; ortasında lav nehrini aşan rampa var.
  // Yeterli hızla çıkmazsan lava düşer, girişe dönersin. İniş alanında item kutuları var.
  shortcuts: [
    {
      id: 'lavaLeap',
      name: 'Lav Atlayışı',
      points: [[111, -76], [104, -42], [99, -6], [97, 26], [92, 56], [86, 72]],
      halfWidth: 4.4,
      surface: 'dirt',
      speed: 0.9,
      color: 0x3a2b26,
      jump: { at: [99, -6], ramp: 12, height: 2.4, gap: 12, depth: 5.5, landing: 14, drop: 0.7, rampColor: 0xd9661e, water: 0xff5a10, lava: true, fallText: 'Lava düştün! 🔥' },
      boxes: { at: 'landing', lateral: [-2, 2] },
      edge: { keys: ['nature/rock_tallC', 'nature/rock_largeD', 'nature/rock_tallD', 'nature/rock_largeE'], step: 5, scale: [4.5, 7] },
      botChance: 0.5,
      botMinSpeed: 22,
    },
    // Süpriz yolu: ana yolun hemen yanında, aynı uzunlukta, yumuşak girişli çıkışlı; sonunda altın kutu (çift hak)
    {
      id: 'obsidian',
      name: 'Obsidyen Geçidi',
      follow: { from: 0.296, to: 0.458, side: 1 },
      halfWidth: 5,
      surface: 'dirt',
      color: 0x1d1618,
      surprise: { skin: 'magma', f: 0.5 },
      edge: { keys: ['nature/rock_tallA', 'nature/rock_tallB', 'nature/rock_tallE'], step: 4, scale: [5, 8] },
      botChance: 0.2,
    },
  ],

  models: [
    'racing/barrierRed', 'racing/barrierWhite', 'racing/overheadLights', 'racing/flagCheckers', 'racing/grandStandCovered',
    'racing/bannerTowerRed', 'racing/bannerTowerGreen',
    'nature/rock_tallA', 'nature/rock_tallB', 'nature/rock_tallC', 'nature/rock_tallD', 'nature/rock_tallE',
    'nature/rock_largeA', 'nature/rock_largeB', 'nature/rock_largeC', 'nature/rock_largeD', 'nature/rock_largeE',
    'nature/rock_smallA', 'nature/rock_smallB', 'nature/rock_smallC',
    'nature/cliff_large_rock', 'nature/cliff_half_rock', 'nature/cliff_rock', 'nature/stone_tallC', 'nature/stone_largeC',
    'nature/statue_column', 'nature/statue_columnDamaged', 'nature/statue_head', 'nature/statue_obelisk',
    'nature/tree_thin_dark', 'nature/tree_cone_dark', 'nature/tree_oak_dark', 'nature/tree_blocks_dark',
  ],

  decorate(ctx) {
    const { track, rng } = ctx;
    const hw = this.halfWidth;
    const edge = track.edge;
    const probe = ctx.along(0, 30);
    const outerSide = track.insideLoop(probe.x, probe.z) ? -1 : 1;
    const innerSide = -outerSide;
    const v = this.volcano;

    // --- Başlangıç alanı ---
    const gantry = ctx.along(0, 0);
    ctx.place('racing/overheadLights', gantry.x, gantry.z, gantry.acrossY, (2 * (hw + 1) + 3) / 1.26, track.centerline[0].y - 0.15);
    for (const s of [-1, 1]) {
      const f = ctx.along(1, s * (hw + 3));
      ctx.place('racing/flagCheckers', f.x, f.z, f.faceTrackY, 7);
    }
    for (let k = -2; k <= 1; k++) {
      const g = ctx.along(k * 5, outerSide * (edge + 7));
      ctx.place('racing/grandStandCovered', g.x, g.z, g.faceTrackY, 10);
      ctx.reserve(g.x, g.z, 12);
    }
    for (let k = -26; k <= 26; k += 8) {
      if (Math.abs(k) < 4) continue;
      const b = ctx.along(k, innerSide * (edge + 2.5));
      ctx.place(k % 16 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
    }
    // Kısayol girişi ve çıkışı
    for (const sc of track.shortcuts) {
      for (const s of [4, sc.length - 4]) {
        for (const side of [-1, 1]) {
          const b = ctx.shortcutAt(sc, s, side * (sc.halfAt(s) + 3));
          ctx.place(s < 10 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
        }
      }
      if (sc.jump) {
        for (const s of sc.jump ? [sc.jump.rampA - 6, sc.jump.rampA + 2, sc.jump.pitB + 2] : []) {
          for (const side of [-1, 1]) {
            const f = ctx.shortcutAt(sc, s, side * (sc.halfWidth + 1.8));
            ctx.place('racing/flagCheckers', f.x, f.z, f.faceTrackY, 6);
          }
        }
      }
    }

    // --- Yanardağ ---
    ctx.addObject(buildVolcano(v));
    ctx.reserve(v.x, v.z, v.radius * 1.3);

    // Kayalar ve ağaçlar kömürleşmiş, içten kor gibi kızarır
    const rocks = ['nature/rock_tallA', 'nature/rock_tallB', 'nature/rock_tallC', 'nature/rock_tallD', 'nature/rock_tallE', 'nature/rock_largeA', 'nature/rock_largeB', 'nature/rock_largeC', 'nature/rock_largeD', 'nature/rock_largeE', 'nature/rock_smallA', 'nature/rock_smallB', 'nature/rock_smallC', 'nature/cliff_large_rock', 'nature/cliff_half_rock', 'nature/cliff_rock', 'nature/stone_tallC', 'nature/stone_largeC'];
    ctx.tint({ color: 0x6b5a54, emissive: 0x5c1606, intensity: 0.5 }, ...rocks);
    ctx.tint({ color: 0x3a302c, emissive: 0x4a1000, intensity: 0.45 }, 'nature/tree_thin_dark', 'nature/tree_cone_dark', 'nature/tree_oak_dark', 'nature/tree_blocks_dark');
    ctx.tint({ color: 0x8a7468, emissive: 0x4a1505, intensity: 0.35 }, 'nature/statue_column', 'nature/statue_columnDamaged', 'nature/statue_head', 'nature/statue_obelisk');

    // Başlangıç düzlüğünde eski tapınak kalıntıları
    for (const k of [-16, 18]) {
      const c = ctx.along(k, innerSide * (edge + 12));
      ctx.place('nature/statue_column', c.x, c.z, 0, 9);
      ctx.reserve(c.x, c.z, 5);
    }
    const head = ctx.along(-6, innerSide * (edge + 18));
    ctx.place('nature/statue_head', head.x, head.z, head.faceTrackY, 11);
    ctx.reserve(head.x, head.z, 8);
    for (const f of [0.12, 0.36, 0.58, 0.8]) {
      const i = Math.round(track.count * f);
      const p = ctx.along(i, -track.innerSide[i] * (edge + 9 + rng() * 5));
      ctx.place(rng() < 0.5 ? 'nature/statue_columnDamaged' : 'nature/statue_column', p.x, p.z, rng() * 6, 8 + rng() * 2);
      ctx.reserve(p.x, p.z, 4);
    }

    // Meşaleler: yol boyunca sıcak ışıklı direkler
    // (gayzerlerin uyarı halkası ışık lekeleriyle karışmasın diye onların yanında meşale yok)
    const vents = this.hazards.map((h) => Math.round(h.f * track.count));
    buildStreetLamps(ctx, { every: 14, skip: (i) => vents.some((k) => Math.abs(i - k) < 9) });

    // --- Doğa: kayalar, yanmış ağaçlar ---
    const off = (d, m) => d > edge + m;
    ctx.scatter({ keys: rocks.slice(0, 10), count: 150, scale: [6, 13], where: (s, d) => off(d, 5) && d < 90 });
    ctx.scatter({ keys: ['nature/cliff_large_rock', 'nature/cliff_half_rock', 'nature/cliff_rock'], count: 50, scale: [7, 12], where: (s, d) => off(d, 14) });
    ctx.scatter({ keys: ['nature/rock_smallA', 'nature/rock_smallB', 'nature/rock_smallC', 'nature/stone_largeC'], count: 120, scale: [4, 8], where: (s, d) => off(d, 3) && d < 60 });
    ctx.scatter({ keys: ['nature/tree_thin_dark', 'nature/tree_cone_dark', 'nature/tree_oak_dark', 'nature/tree_blocks_dark'], count: 110, scale: [6, 10], where: (s, d) => s > 4 && off(d, 6) && d < 70 });
  },
};
