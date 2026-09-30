import { createSnowman } from '../props.js';

// "Kar Zirvesi" — karla kaplı bir dağ. Uzun bir tırmanış, zirvede geniş bir viraj,
// aşağı inen S virajları ve donmuş gölün kıyısında bitiş düzlüğü. Kar yağıyor.
// Kontrol noktaları: [x, z, yükseklik].

export default {
  id: 'snowPeak',
  name: 'Kar Zirvesi',
  meta: 'Kış dağı · kar yağışı',
  halfWidth: 8,
  curbWidth: 1,
  shoulder: 5,
  terrainSize: 640,
  shoreMargin: () => 95,
  outer: 'mountains',
  baseHeight: 1,
  ponds: [{ x: -116, z: 56, r: 22 }], // donmuş göl
  palette: { base: 0xf2f6fc, shore: 0xdce8f4, patch: 0xe4eef8, patchDark: 0xd0deee, shoulder: 0xdfe8f2, cliff: 0x8f99aa },
  dust: [0.92, 0.95, 1.0],
  snow: true,
  sky: { top: 0x5d8dc2, horizon: 0xe4eef8, fog: 0xd8e5f1 },
  water: { shallow: 0xc6edf8, deep: 0x72b8de },
  light: { hemiSky: 0xe0eeff, hemiGround: 0xbccadc, hemi: 1.05, sun: 0xf4f7ff, sunI: 2.5, sunDir: [-0.4, 0.5, 0.6], glow: 0xe2ecff, fogNear: 100, fogFar: 540 },
  control: [
    [-40.1, 104.5, 1.5], // başlangıç düzlüğü (göl kıyısı)
    [48.9, 106.9, 2.5],
    [93.2, 67.8, 5],
    [130.2, 41.4, 9],
    [137.1, 4.6, 13], // tırmanış
    [126.6, -42.7, 17],
    [76.8, -73.8, 20],
    [48.7, -92.7, 21], // zirve
    [-17, -67.8, 20],
    [-20.2, -36.3, 18.5],
    [-11.2, -24.2, 17], // iniş ve S virajlar
    [45.2, -1.2, 15.5],
    [48, 30, 13],
    [-23.8, 59.5, 11],
    [-75.1, 27.3, 8.5],
    [-105.7, 2.6, 6.5],
    [-135, -7.1, 5],
    [-175.8, 24.5, 3.6],
    [-161.8, 78, 2.2],
    [-142.3, 105.9, 1.7],
    [-100, 105, 1.5],
  ],

  // Kısayol: doğu tırmanışını atlayıp doğrudan zirveye çıkan sıkışmış kar yolu. Kar yavaşlatır;
  // buz tahtaları turbo verir, ortada item kutuları var.
  shortcuts: [
    {
      id: 'iceCut',
      name: 'Buz Geçidi',
      points: [[78, 83], [76, 45], [72, 5], [70, -35], [66, -58], [56, -76], [44, -90]],
      halfWidth: 4.6,
      surface: 'dirt',
      speed: 0.92,
      color: 0xb4c8dd,
      pads: [{ f: 0.2 }, { f: 0.5 }, { f: 0.8 }],
      boxes: { at: 'mid', lateral: [-2.4, 0, 2.4] },
      edge: { keys: ['nature/rock_largeA', 'nature/rock_largeB', 'nature/log_stack', 'nature/rock_largeC'], step: 5, scale: [4, 6.5] },
      botChance: 0.5,
    },
  ],

  models: [
    'racing/barrierRed', 'racing/barrierWhite', 'racing/overheadLights', 'racing/flagCheckers', 'racing/grandStandCovered',
    'racing/bannerTowerRed', 'racing/bannerTowerGreen', 'racing/tentClosedLong',
    'nature/tree_pineTallA', 'nature/tree_pineTallB', 'nature/tree_pineRoundA', 'nature/tree_pineRoundC',
    'nature/tree_pineDefaultA', 'nature/tree_cone', 'nature/rock_tallA', 'nature/rock_tallB',
    'nature/rock_largeA', 'nature/rock_largeB', 'nature/rock_largeC', 'nature/stump_round', 'nature/log_stack', 'nature/log',
    'nature/tent_detailedOpen', 'nature/tent_smallOpen', 'nature/campfire_stones', 'nature/statue_obelisk',
  ],

  decorate(ctx) {
    const { track, rng } = ctx;
    const hw = this.halfWidth;
    const edge = track.edge;
    const probe = ctx.along(0, 30);
    const outerSide = track.insideLoop(probe.x, probe.z) ? -1 : 1;
    const innerSide = -outerSide;
    const terrain = track.terrain;

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

    // --- Göl kıyısı: kamp ateşi, çadırlar ---
    const lake = this.ponds[0];
    for (let k = 0; k < 3; k++) {
      const a = -0.6 + k * 0.5;
      const x = lake.x + Math.cos(a) * (lake.r + 9);
      const z = lake.z + Math.sin(a) * (lake.r + 9);
      ctx.place(k === 1 ? 'nature/tent_detailedOpen' : 'nature/tent_smallOpen', x, z, -a + Math.PI / 2, 6);
      ctx.reserve(x, z, 8);
    }
    const cf = { x: lake.x + Math.cos(-0.1) * (lake.r + 17), z: lake.z + Math.sin(-0.1) * (lake.r + 17) };
    ctx.place('nature/campfire_stones', cf.x, cf.z, 0, 6);
    ctx.place('nature/log', cf.x + 4, cf.z + 3, 1.1, 6);
    ctx.reserve(cf.x, cf.z, 8);

    // Zirvede dikilitaş
    const top = Math.round(track.count * 0.36);
    const o = ctx.along(top, track.innerSide[top] * (edge + 14));
    ctx.place('nature/statue_obelisk', o.x, o.z, 0, 9);
    ctx.reserve(o.x, o.z, 8);

    // Kardan adamlar: yolun kenarında, piste dönük
    for (const f of [0.03, 0.1, 0.19, 0.28, 0.45, 0.58, 0.7, 0.83, 0.93]) {
      const i = Math.round(track.count * f);
      const side = rng() < 0.5 ? -1 : 1;
      const p = ctx.along(i, side * (edge + 3 + rng() * 3));
      const m = createSnowman(1.4 + rng() * 0.5);
      m.position.set(p.x, terrain.heightAt(p.x, p.z), p.z);
      m.rotation.y = p.faceTrackY + (rng() - 0.5) * 0.6;
      ctx.addObject(m);
      ctx.reserve(p.x, p.z, 4);
    }

    // Kısayol girişi ve çıkışında bayrak kuleleri
    for (const sc of track.shortcuts) {
      for (const s of [4, sc.length - 4]) {
        for (const side of [-1, 1]) {
          const b = ctx.shortcutAt(sc, s, side * (sc.halfAt(s) + 3));
          ctx.place(s < 10 ? 'racing/bannerTowerGreen' : 'racing/bannerTowerRed', b.x, b.z, b.faceTrackY, 9);
        }
      }
    }

    // --- Doğa: karlı çamlar ve kayalar ---
    ctx.noShadow('nature/stump_round');
    const pines = ['nature/tree_pineTallA', 'nature/tree_pineTallB', 'nature/tree_pineRoundA', 'nature/tree_pineRoundC', 'nature/tree_pineDefaultA', 'nature/tree_cone'];
    ctx.frost(...pines, 'nature/rock_tallA', 'nature/rock_tallB', 'nature/rock_largeA', 'nature/rock_largeB', 'nature/rock_largeC', 'nature/log_stack', 'nature/stump_round', 'nature/log');
    const off = (d, m) => d > edge + m;
    ctx.scatter({ keys: pines, count: 380, scale: [7, 12], where: (s, d) => s > -45 && off(d, 5) });
    ctx.scatter({ keys: pines, count: 260, scale: [8, 13], where: (s, d) => s > -30 && off(d, 4) && d < 55 });
    ctx.scatter({ keys: ['nature/rock_tallA', 'nature/rock_tallB'], count: 90, scale: [8, 16], where: (s, d) => s < -5 && off(d, 12) });
    ctx.scatter({ keys: ['nature/rock_largeA', 'nature/rock_largeB', 'nature/rock_largeC'], count: 80, scale: [4, 9], where: (s, d) => off(d, 4) });
    ctx.scatter({ keys: ['nature/stump_round', 'nature/log_stack', 'nature/log'], count: 40, scale: [5, 7], where: (s, d) => s > 0 && off(d, 4) });
  },
};
