// "Kapadokya" — gün doğumunda peribacaları arasından geçen kumtaşı vadisi. Gökyüzü sıcak hava balonlarıyla dolu;
// yol kanyon kenarına tırmanır, vadi tabanına iner. Yamaçlardan kaya yuvarlanır, toz hortumları yolu keser.
// Kontrol noktaları: [x, z, yükseklik]. Üreticiler: tools/gen_props.py (chimney_*, mesa, hot_air_balloon), gen_kit_cappadocia.py, gen_kart_cappadocia.py.

const CHIMNEYS = ['tayfa/chimney_a', 'tayfa/chimney_b', 'tayfa/chimney_c'];
const ROCKS = ['tayfa/rock_boulder_b', 'tayfa/rock_boulder_a'];

export default {
  id: 'cappadocia',
  name: 'Kapadokya',
  kartBody: 'karts/kart-cappadocia', // Balon Sepeti (tools/gen_kart_cappadocia.py)
  meta: 'Peribacaları · balonlar · kanyon',
  groundTex: { tex: 'sand', rock: 'rock', scale: 0.12, strength: 0.9 }, // ambientCG (CC0) detay dokusu; sadece Yüksek kalite
  roadTex: 'asphalt_n',
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5,
  terrainSize: 780,
  shoreMargin: () => 90,
  outer: 'mountains',
  noWater: true,
  baseHeight: 0,
  palette: { base: 0xdcb98a, shore: 0xc99a68, patch: 0xd2a977, patchDark: 0xc08f5e, shoulder: 0xe6c79a, cliff: 0xb87a52 },
  roadStyle: { base: '#8a6a52', blotchDark: '66,44,30', blotchLight: '176,138,104', line: '#fff0d4', curbs: [0xfff0d4, 0xc0502e] },
  dust: [0.9, 0.74, 0.54],
  sky: { top: 0x4a8fd6, horizon: 0xffd2a0, fog: 0xf3cfa4 },
  skyTex: { id: 'qwantani_late_afternoon_puresky', az: 0.6289, mix: 0.4 }, // Poly Haven (CC0) gökyüzü; Düşük kalitede kapalı
  water: { shallow: 0x7ee0d0, deep: 0x2a8f9e },
  light: { hemiSky: 0xffe6c4, hemiGround: 0xb98a5a, hemi: 1.05, sun: 0xffd9a8, sunI: 2.9, sunDir: [-0.7, 0.4, 0.35], glow: 0xffd2a0, fogNear: 190, fogFar: 720 },
  control: [
    // Yükseklik: start düzlüğü (4 m) → kanyon kenarına tırmanış (16 m) → vadi tabanına iniş (1.5 m) → düzlük
    [230, 81, 4],
    [240, -27, 4.5],
    [202, -128, 7.5],
    [128, -202, 11.5],
    [27, -230, 14.5],
    [-68, -189, 16], // kanyon kenarı (zirve)
    [-148, -128, 12],
    [-223, -47, 7],
    [-236, 54, 3],
    [-189, 148, 1.5], // vadi tabanı
    [-101, 202, 2.5],
    [-14, 182, 4],
    [68, 202, 3.2],
    [155, 176, 3.5],
  ],
  hillReach: 140,
  bank: [{ f: [0.2, 0.3], deg: 7 }, { f: [0.5, 0.6], deg: 9 }],
  bumps: [{ f: [0.34, 0.4], amp: 1.3, period: 32 }, { f: [0.78, 0.9], amp: 0.5, period: 38 }], // kanyon kenarında atlayış, vadi düzlüğünde dalgalar

  // Zemin bölgeleri: hız şeritleri (start sonrası ve vadi çıkışı)
  zones: [
    { type: 'boost', f: [0.04, 0.055], lateral: [-2.6, 2.6] },
    { type: 'boost', f: [0.62, 0.635], lateral: [-2.6, 2.6] },
  ],

  hazards: [
    // Kanyon yamaçlarından yuvarlanan kayalar
    { type: 'ball', skin: 'rock', ballRadius: 2.6, f: 0.2, period: 12, offset: 3, dir: 1 },
    { type: 'ball', skin: 'rock', ballRadius: 2.6, f: 0.44, period: 11, offset: 7, dir: -1 },
    { type: 'ball', skin: 'rock', ballRadius: 2.6, f: 0.52, period: 12, offset: 1, dir: 1 },
    // Toz hortumları
    ...[0.12, 0.3, 0.58, 0.7, 0.85].map((f, k) => ({
      type: 'geyser',
      f,
      lateral: k % 2 ? 3.5 : -3.5,
      radius: 4.2,
      period: 7.5 + (k % 3) * 0.5,
      offset: (k * 2.4) % 7,
      colors: { ring: [1.5, 0.9, 0.5], column: [1.3, 0.95, 0.6], ember: [1.4, 1.0, 0.6], hot: [1.8, 1.4, 0.9], smoke: [0.78, 0.62, 0.44] },
    })),
  ],

  // Donanım: kits/cappadocia (tools/gen_kit_cappadocia.py)
  models: [
    'racing/barrierRed', 'racing/barrierWhite', 'racing/overheadLights', 'racing/flagCheckers', 'racing/grandStandCovered', 'racing/bannerTowerRed', 'racing/bannerTowerGreen',
    ...CHIMNEYS, 'tayfa/mesa', 'tayfa/hot_air_balloon', 'tayfa/rock_boulder_a', 'tayfa/rock_boulder_b',
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

    // --- Başlangıç ---
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
    // Start alanında yerden kalkmaya hazır iki balon
    for (const [s, lat, sc] of [[-34, outerSide * (edge + 26), 9], [-52, outerSide * (edge + 40), 11]]) {
      const b = ctx.along(s, lat);
      ctx.place('tayfa/hot_air_balloon', b.x, b.z, rng() * 6.28, sc);
      ctx.reserve(b.x, b.z, sc * 0.6);
    }

    // --- Peribacaları, kayalar (çakışma denetimli) ---
    const taken = [];
    const put = (keys, [a, b], fp, dMin, dMax, count) => {
      let placed = 0;
      for (let tries = 0; placed < count * ctx.density && tries < count * 120; tries++) {
        const x = (rng() * 2 - 1) * half;
        const z = (rng() * 2 - 1) * half;
        const d = terrain.roadDistAt(x, z);
        if (d < dMin || d > dMax) continue;
        const s = a + rng() * (b - a);
        const r = fp * s;
        if (taken.some(([tx, tz, tr]) => (x - tx) ** 2 + (z - tz) ** 2 < (r + tr) ** 2)) continue;
        taken.push([x, z, r]);
        ctx.reserve(x, z, r);
        ctx.place(keys[Math.floor(rng() * keys.length)], x, z, rng() * Math.PI * 2, s);
        placed++;
      }
    };
    const off = edge + 6;
    put(['tayfa/mesa'], [26, 46], 0.5, off + 40, 190, 10);
    put(CHIMNEYS, [13, 24], 0.3, off + 4, 150, 90);
    put(ROCKS, [4, 9], 0.5, off, 120, 50);

    // --- Gökyüzünde sıcak hava balonları (yolun üstünde yüzer, çarpışma yok) ---
    const sky = [];
    for (let tries = 0; sky.length < 14 * ctx.density && tries < 600; tries++) {
      const x = (rng() * 2 - 1) * half * 0.95;
      const z = (rng() * 2 - 1) * half * 0.95;
      if (sky.some(([sx, sz]) => (x - sx) ** 2 + (z - sz) ** 2 < 70 * 70)) continue;
      sky.push([x, z]);
      const sc = 12 + rng() * 10;
      ctx.place('tayfa/hot_air_balloon', x, z, rng() * 6.28, sc, terrain.heightAt(x, z) + 38 + rng() * 55);
    }
    ctx.noShadow('tayfa/hot_air_balloon');
  },
};
