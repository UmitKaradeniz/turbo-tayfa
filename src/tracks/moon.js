import { buildStreetLamps } from '../city.js';

// "Ay Yolu" — Ay yüzeyinde, kraterlerin arasından geçen yarış pisti. Yerçekimi yaklaşık yarıya iner:
// kart süzülür, rampalardan uzağa uçar. Zamanlı meteorlar: yere önce uyarı halkası düşer, sonra
// meteor çarpar. Kısayol bir krater çukurunu rampayla aşar. Gökyüzünde Dünya görünür.
// Kontrol noktaları: [x, z, yükseklik].

export default {
  id: 'moon',
  name: 'Ay Yolu',
  kartBody: 'karts/kart-moon', // haritaya özel araç gövdesi (tools/gen_kart.py)
  meta: 'Düşük yerçekimi · meteor',
  groundTex: { tex: 'gravel', rock: 'rock', scale: 0.09, strength: 1.0 }, // ambientCG (CC0) detay dokusu; sadece Yüksek kalite
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5,
  terrainSize: 640,
  shoreMargin: (t) => 78 + 12 * Math.sin(t * Math.PI * 2 * 3),
  palette: { base: 0x9b9da8, shore: 0x5d6070, patch: 0x8c8f9c, patchDark: 0x777a88, shoulder: 0xa9abb6 },
  dust: [0.66, 0.66, 0.72],
  space: true,
  noWater: true,
  gravity: 0.45,
  sky: { top: 0x000106, horizon: 0x0a0e1e, fog: 0x05070f },
  water: { shallow: 0x0a0e1e, deep: 0x02030a },
  light: { hemiSky: 0xa2b2dc, hemiGround: 0x3b3e4c, hemi: 0.8, sun: 0xffffff, sunI: 3.7, sunDir: [-0.5, 0.45, 0.35], glow: 0xffffff, fogNear: 110, fogFar: 400 },
  // Yoldan uzak kraterler: çanak + yükseltilmiş kenar
  craters: [
    { x: 30, z: 0, r: 44, depth: 4 },
    { x: -20, z: -70, r: 24, depth: 3 },
    { x: 95, z: -25, r: 20, depth: 3 },
    { x: 110, z: 60, r: 15, depth: 2.4 },
    { x: 0, z: 95, r: 20, depth: 2.6 },
    { x: -45, z: 8, r: 15, depth: 2.2 },
    { x: -215, z: 150, r: 32, depth: 4 },
    { x: 230, z: -130, r: 42, depth: 5 },
    { x: 0, z: -235, r: 36, depth: 4 },
    { x: -265, z: -70, r: 30, depth: 4 },
    { x: 255, z: 105, r: 26, depth: 3.4 },
  ],
  control: [
    [-20, 160, 3], // başlangıç
    [90, 150, 5],
    [165, 95, 8],
    [185, 10, 10],
    [160, -70, 8],
    [100, -120, 5],
    [30, -150, 3],
    [-50, -140, 2],
    [-115, -100, 1.5], // kısayol girişi
    [-158, -30, 3],
    [-135, 25, 5],
    [-95, 45, 6], // kısayol çıkışı
    [-78, 92, 4],
    [-90, 135, 3],
    [-72, 158, 3],
    [-42, 166, 3],
  ],

  // Zamanlı meteorlar: uyarı halkası büyür, sonra meteor düşer ve çarptığı yerdeki kart savrulur.
  hazards: [
    { type: 'meteor', f: 0.09, lateral: 3.5, radius: 5, period: 10, offset: 3 },
    { type: 'meteor', f: 0.23, lateral: -3.5, radius: 5, period: 11, offset: 6 },
    { type: 'meteor', f: 0.33, lateral: 3.5, radius: 5, period: 9.5, offset: 1 },
    { type: 'meteor', f: 0.41, lateral: -3.5, radius: 5, period: 10.5, offset: 8 },
    { type: 'meteor', f: 0.56, lateral: 3.5, radius: 5, period: 10, offset: 5 },
    { type: 'meteor', f: 0.72, lateral: -3.5, radius: 5, period: 11, offset: 2 },
    { type: 'meteor', f: 0.9, lateral: 3.5, radius: 5, period: 9.5, offset: 7 },
  ],

  // Kısayol: krater çukurunu rampayla aşan Ay tozu yolu. Düşük yerçekiminde atlayış uzun sürer,
  // ama yeterli hız gerekir; yetmezse kratere düşüp girişe dönersin. Turbo tahtaları ve item kutuları var.
  // Dağ-bayır: düşük yerçekiminde krater kenarı tümsekleri uzun atlayışlar yaptırır; uzun virajlarda yol içe yatar
  bank: [{ f: [0.72, 0.75], deg: 8 }, { f: [0.91, 0.99], deg: 8 }],
  bumps: [{ f: [0.36, 0.5], amp: 1.1, period: 42 }],

  shortcuts: [
    {
      id: 'craterLeap',
      name: 'Krater Atlayışı',
      points: [[-115, -100], [-111, -68], [-107, -34], [-102, 0], [-98, 28], [-95, 45]],
      halfWidth: 4.4,
      surface: 'dirt',
      speed: 0.9,
      color: 0x7d7f8c,
      pads: [{ f: 0.12 }, { f: 0.88 }],
      jump: { at: [-107, -34], ramp: 14, height: 5, gap: 20, depth: 7, landing: 18, drop: 0.8, rampColor: 0x3fa9ff, water: 0x04060f, fallText: 'Kratere düştün! 🕳️' },
      boxes: { at: 'landing', lateral: [-2, 2] },
      edge: { keys: ['space/rock_largeA', 'space/rock_largeB', 'space/rock', 'space/meteor_half'], step: 5, scale: [7, 11] },
      botChance: 0.5,
      botMinSpeed: 22,
    },
    // Süpriz yolu: ana yolun hemen yanında, aynı uzunlukta, yumuşak girişli çıkışlı; sonunda altın kutu (çift hak)
    {
      id: 'crystalCave',
      name: 'Kristal Mağarası',
      follow: { from: 0.367, to: 0.518, side: -1 },
      halfWidth: 5,
      surface: 'dirt',
      color: 0x7d8696,
      surprise: { skin: 'moon', f: 0.78 },
      edge: { keys: ['space/rock_crystalsLargeA', 'space/rock_crystalsLargeB', 'space/rock_crystals', 'space/rocks_smallA'], step: 5, scale: [7, 11] },
      botChance: 0.2,
    },
  ],

  // Zemin bölgeleri: ortada turbo şeridi ve krater trambolini (düşük yerçekiminde çok yükseğe atar)
  zones: [
    { type: 'boost', f: [0.268, 0.284], lateral: [-2.6, 2.6], color: '#3fa9ff' },
    { type: 'bounce', f: [0.6, 0.615], lateral: [-3.2, 3.2], color: '#6fd0ff' },
  ],


  models: [
    'racing/barrierRed', 'racing/barrierWhite', 'racing/overheadLights', 'racing/flagCheckers',
    'racing/bannerTowerRed', 'racing/bannerTowerGreen',
    ...['rock', 'rock_largeA', 'rock_largeB', 'rocks_smallA', 'rocks_smallB', 'rock_crystals', 'rock_crystalsLargeA', 'rock_crystalsLargeB',
      'crater', 'craterLarge', 'meteor', 'meteor_detailed', 'meteor_half', 'hangar_largeA', 'hangar_largeB', 'hangar_roundA', 'hangar_smallA',
      'satelliteDish', 'satelliteDish_large', 'satelliteDish_detailed', 'astronautA', 'astronautB', 'alien', 'rover',
      'craft_speederA', 'craft_speederB', 'craft_speederC', 'craft_speederD', 'craft_racer', 'craft_cargoA', 'craft_miner',
      'rocket_baseA', 'rocket_sidesA', 'rocket_fuelA', 'rocket_topA', 'rocket_finsA',
      'machine_generatorLarge', 'machine_barrel', 'machine_wireless', 'barrels', 'turret_single',
    ].map((k) => `space/${k}`),
  ],

  decorate(ctx) {
    const { track, rng } = ctx;
    const hw = this.halfWidth;
    const edge = track.edge;
    const probe = ctx.along(0, 30);
    const outerSide = track.insideLoop(probe.x, probe.z) ? -1 : 1;
    const innerSide = -outerSide;

    // --- Başlangıç alanı ---
    const gantry = ctx.along(0, 0);
    ctx.place('racing/overheadLights', gantry.x, gantry.z, gantry.acrossY, (2 * (hw + 1) + 3) / 1.26, track.centerline[0].y - 0.15);
    for (const s of [-1, 1]) {
      const f = ctx.along(1, s * (hw + 3));
      ctx.place('racing/flagCheckers', f.x, f.z, f.faceTrackY, 7);
    }
    // Tribün yerine hangarlar
    const hangars = ['space/hangar_largeA', 'space/hangar_largeB', 'space/hangar_roundA', 'space/hangar_largeA'];
    hangars.forEach((key, k) => {
      const g = ctx.along(-16 + k * 12, outerSide * (edge + 14));
      ctx.place(key, g.x, g.z, g.faceTrackY, key.includes('round') ? 7 : 8);
      ctx.reserve(g.x, g.z, 15);
    });
    for (let k = -26; k <= 26; k += 8) {
      if (Math.abs(k) < 4) continue;
      const b = ctx.along(k, innerSide * (edge + 2.5));
      ctx.place(k % 16 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
    }
    // Start alanında astronotlar, uzaylı, rover, park etmiş uçaklar
    const crowd = ctx.along(-3, innerSide * (edge + 5));
    ctx.place('space/astronautA', crowd.x, crowd.z, crowd.faceTrackY, 4.4);
    const crowd2 = ctx.along(6, innerSide * (edge + 6));
    ctx.place('space/astronautB', crowd2.x, crowd2.z, crowd2.faceTrackY, 4.4);
    const alien = ctx.along(14, innerSide * (edge + 5.5));
    ctx.place('space/alien', alien.x, alien.z, alien.faceTrackY, 4.2);
    const rover = ctx.along(-24, innerSide * (edge + 9));
    ctx.place('space/rover', rover.x, rover.z, rover.faceTrackY + 0.6, 14);
    [['craft_speederC', -8], ['craft_speederD', 22], ['craft_racer', -34]].forEach(([k, at], n) => {
      const c = ctx.along(at, outerSide * (edge + 34 + n * 3));
      ctx.place(`space/${k}`, c.x, c.z, c.faceTrackY + 0.3, 6.5);
      ctx.reserve(c.x, c.z, 9);
    });

    // Kısayol girişi ve çıkışında bayrak kuleleri, rampada bayraklar
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

    // --- Roket rampası: parçalar üst üste dizilir ---
    const pad = ctx.along(Math.round(track.count * 0.3), -track.innerSide[Math.round(track.count * 0.3)] * (edge + 30));
    const y0 = track.terrain.heightAt(pad.x, pad.z);
    const S = 6.5;
    const stack = [['space/rocket_baseA', 1.6], ['space/rocket_sidesA', 1.0], ['space/rocket_sidesA', 1.0], ['space/rocket_topA', 0.8]];
    let y = y0;
    for (const [key, h] of stack) {
      ctx.place(key, pad.x, pad.z, 0.6, S, y);
      y += h * S;
    }
    ctx.place('space/rocket_finsA', pad.x, pad.z, 0.6, S * 1.25, y0);
    ctx.reserve(pad.x, pad.z, 14);
    ctx.place('space/machine_generatorLarge', pad.x + 16, pad.z + 6, 0.4, 7);
    ctx.place('space/barrels', pad.x - 14, pad.z + 9, 1.1, 8);

    // --- Uydu antenleri, jeneratörler, nöbetçiler ---
    for (const f of [0.14, 0.38, 0.52, 0.62, 0.84]) {
      const i = Math.round(track.count * f);
      const d = ctx.along(i, track.innerSide[i] * (edge + 18 + rng() * 6));
      ctx.place(['space/satelliteDish_large', 'space/satelliteDish', 'space/satelliteDish_detailed'][Math.floor(rng() * 3)], d.x, d.z, rng() * 6, 9 + rng() * 3);
      ctx.reserve(d.x, d.z, 7);
    }
    for (const f of [0.2, 0.45, 0.68, 0.95]) {
      const i = Math.round(track.count * f);
      const a = ctx.along(i, -track.innerSide[i] * (edge + 4 + rng() * 2));
      ctx.place(rng() < 0.5 ? 'space/astronautA' : 'space/astronautB', a.x, a.z, a.faceTrackY, 4.2);
      ctx.reserve(a.x, a.z, 3);
    }
    for (const f of [0.27, 0.58, 0.81]) {
      const i = Math.round(track.count * f);
      const p = ctx.along(i, track.innerSide[i] * (edge + 26));
      ctx.place(['space/craft_miner', 'space/craft_cargoA', 'space/machine_barrel'][Math.floor(rng() * 3)], p.x, p.z, rng() * 6, 7);
      ctx.reserve(p.x, p.z, 8);
    }

    // Işıklı direkler
    buildStreetLamps(ctx, { every: 16, skip: (i) => i < 10 });

    // --- Kayalar, kraterler, mavi kristaller ---
    const crystals = ['space/rock_crystals', 'space/rock_crystalsLargeA', 'space/rock_crystalsLargeB'];
    ctx.tint({ emissive: 0x2a7cff, intensity: 0.75 }, ...crystals);
    // Ay kayaları gri-mavi (modellerin kahverengimsi rengi Ay'a uymuyor)
    ctx.tint({ color: 0x8f97ac, mix: 0.85 }, 'space/rock', 'space/rock_largeA', 'space/rock_largeB', 'space/rocks_smallA', 'space/rocks_smallB', 'space/meteor', 'space/meteor_detailed', 'space/meteor_half', 'space/crater', 'space/craterLarge');
    const off = (d, m) => d > edge + m;
    ctx.scatter({ keys: ['space/rock', 'space/rock_largeA', 'space/rock_largeB'], count: 230, scale: [6, 15], where: (s, d) => off(d, 4) && d < 110 });
    ctx.scatter({ keys: ['space/rocks_smallA', 'space/rocks_smallB'], count: 180, scale: [5, 10], where: (s, d) => off(d, 3) });
    ctx.scatter({ keys: ['space/crater', 'space/craterLarge'], count: 26, scale: [12, 30], where: (s, d) => off(d, 14) && d < 150 });
    ctx.scatter({ keys: crystals, count: 60, scale: [6, 12], where: (s, d) => off(d, 8) && d < 120 });
    ctx.scatter({ keys: ['space/meteor', 'space/meteor_detailed', 'space/meteor_half'], count: 40, scale: [4, 9], where: (s, d) => off(d, 6) && d < 100 });
    ctx.noShadow('space/crater', 'space/craterLarge', 'space/rocks_smallA');
  },
};
