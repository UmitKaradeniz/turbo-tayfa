import { buildModelBuildings, buildStreetLamps, CITY_MODELS } from '../city.js';

// "Neon Şehir" — gece vakti ışıl ışıl bir liman kenti. Geniş caddeler, bina sıraları, neon tabelalar,
// şehrin ortasındaki liman ve sahil yolunda hızlı virajlar. Kontrol noktaları: [x, z, yükseklik].

export default {
  id: 'nightCity',
  name: 'Neon Şehir',
  meta: 'Gece · liman · neon',
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5,
  terrainSize: 640,
  shoreMargin: (t) => 86 - 22 * Math.cos(t * Math.PI * 2 * 2),
  ponds: [{ x: 32, z: 32, r: 36 }], // şehir limanı
  palette: { base: 0x2c3145, shore: 0x22263b, patch: 0x22402d, patchDark: 0x1b3324, shoulder: 0x393f57 },
  dust: [0.5, 0.52, 0.62],
  night: true,
  sky: { top: 0x030720, horizon: 0x1d2b66, fog: 0x0e1639 },
  water: { shallow: 0x1f4a99, deep: 0x050c30 },
  light: { hemiSky: 0x6478c0, hemiGround: 0x232848, hemi: 1.0, sun: 0xa9bdff, sunI: 1.7, sunDir: [-0.35, 0.55, -0.6], glow: 0xd6e2ff, fogNear: 70, fogFar: 430 },
  control: [
    [-56.7, 122.1, 1], // başlangıç caddesi
    [-5.8, 133.4, 1],
    [70.2, 116.4, 1],
    [107.2, 86.1, 1],
    [119.8, 59.4, 1.2],
    [124.9, 24.4, 1.5],
    [141.9, -13.3, 1.5],
    [143.8, -61.4, 1.5],
    [130.1, -96, 1],
    [82.8, -112.7, 1],
    [21.4, -108.5, 1],
    [7.6, -98.9, 1.2],
    [-29.2, -35.2, 1.4],
    [-57.2, -31.5, 1.5],
    [-99.9, -70, 1.5],
    [-122.4, -76.2, 1],
    [-163.8, -52.3, 1],
    [-163.2, 26.9, 1],
    [-128.9, 57.1, 1],
    [-110, 95, 1],
  ],

  // Kısayol: binaların arasından geçen dar servis yolu. Ortasında kanalı aşan bir rampa var: yeterli hızla
  // çıkmazsan kanala düşersin. İniş alanında item kutuları var.
  shortcuts: [
    {
      id: 'alley',
      name: 'Servis Yolu',
      points: [[11, -103], [-25, -96], [-65, -86], [-111, -75]],
      halfWidth: 4.2,
      surface: 'dirt',
      speed: 0.9,
      color: 0x4d5266,
      jump: { at: [-60, -85], ramp: 12, height: 2.4, gap: 12, depth: 5.5, landing: 14, drop: 0.7, rampColor: 0xff9a3d, water: 0x1f4a99 },
      boxes: { at: 'landing', lateral: [-2, 2] },
      edge: { keys: ['racing/barrierRed', 'racing/barrierWhite'], step: 2, scale: [8, 8], aligned: true },
      botChance: 0.5,
      botMinSpeed: 22,
    },
  ],

  // Zemin bölgeleri: ıslak asfalt (hafif kaygan) ve yola serpilmiş neon hız şeritleri
  zones: [
    { type: 'boost', f: [0.08, 0.095], lateral: [-2.6, 2.6], color: '#3fe0ff' },
    { type: 'wet', f: [0.21, 0.26], lateral: [-8, 8] },
    { type: 'boost', f: [0.295, 0.31], lateral: [-6, -1.2], color: '#ff3fa4' },
    { type: 'boost', f: [0.335, 0.35], lateral: [1.2, 6], color: '#ff3fa4' },
  ],

  // Kavşaklarda yolu kesen trafik: uyarı şeridi yanıp sönünce araba geçer
  hazards: [
    { type: 'ball', skin: 'car', ballRadius: 2.4, f: 0.43, period: 10, offset: 2, dir: 1 },
    { type: 'ball', skin: 'car', ballRadius: 2.4, f: 0.82, period: 11, offset: 6, dir: -1 },
  ],

  models: [
    'racing/barrierRed', 'racing/barrierWhite', 'racing/overheadLights', 'racing/flagCheckers', 'racing/grandStandCovered',
    'racing/bannerTowerRed', 'racing/bannerTowerGreen', 'racing/tentClosedLong',
    'nature/tree_detailed', 'nature/tree_cone', 'nature/plant_bushLarge', 'nature/plant_bush', 'nature/platform_beach', 'nature/canoe',
    ...CITY_MODELS,
  ],

  decorate(ctx) {
    const { track } = ctx;
    const hw = this.halfWidth;
    const edge = track.edge;
    const n = track.count;
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

    // Kısayol girişi ve çıkışında bayrak kuleleri, rampada bayraklar
    for (const sc of track.shortcuts) {
      for (const s of [4, sc.length - 4]) {
        for (const side of [-1, 1]) {
          const b = ctx.shortcutAt(sc, s, side * (sc.halfAt(s) + 3));
          ctx.place(s < 10 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
        }
      }
      if (sc.jump) {
        for (const s of [sc.jump.rampA - 6, sc.jump.rampA + 2, sc.jump.pitB + 2]) {
          for (const side of [-1, 1]) {
            const f = ctx.shortcutAt(sc, s, side * (sc.halfWidth + 1.8));
            ctx.place('racing/flagCheckers', f.x, f.z, f.faceTrackY, 6);
          }
        }
      }
    }

    // --- Liman: iskele ve kanolar ---
    const harbor = this.ponds[0];
    for (let k = 0; k < 4; k++) {
      const a = 0.9 + k * 0.05;
      ctx.place('nature/platform_beach', harbor.x + Math.cos(a) * (harbor.r - 2 - k * 5), harbor.z + Math.sin(a) * (harbor.r - 2 - k * 5), -a, 7, 0.35);
    }
    ctx.place('nature/canoe', harbor.x + 10, harbor.z + 5, 0.6, 6, 0.1);
    ctx.place('nature/canoe', harbor.x - 8, harbor.z - 12, 2.2, 6, 0.1);

    // --- Şehir: binalar, neon tabelalar, lambalar ---
    const nearStart = (i) => i < 16 || i > n - 16;
    buildModelBuildings(ctx, { max: 130, skip: (p, i) => nearStart(i) });
    buildStreetLamps(ctx, { every: 8 });

    // Birkaç park ağacı ve çalı (yola yakın, bina olmayan yerlerde)
    ctx.scatter({ keys: ['nature/tree_detailed', 'nature/tree_cone'], count: 60, scale: [7, 10], where: (s, d) => s > 6 && d > edge + 4 && d < edge + 30 });
    ctx.scatter({ keys: ['nature/plant_bushLarge', 'nature/plant_bush'], count: 90, scale: [6, 9], where: (s, d) => s > 6 && d > edge + 3 && d < edge + 40 });
  },
};
