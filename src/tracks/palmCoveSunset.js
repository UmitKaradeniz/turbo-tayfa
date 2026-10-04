// "Palmiye Koyu · Gün Batımı" — Palmiye Koyu'nun aynı pisti, günbatımı ışığı ve gökyüzüyle.
// Yalnız atmosfer değişir (sky, light, water, skyTex yok); pist, dekor, tehlike ve kısayol aynıdır.
import palmCove from './palmCove.js';

export default {
  ...palmCove,
  id: 'palmCoveSunset',
  kit: 'palmCove', // donanım dosyaları palmCove ile ortak (public/models/kits/palmCove)
  name: 'Palmiye Koyu · Gün Batımı',
  meta: 'Tropikal sahil · gün batımı',
  dust: [0.95, 0.74, 0.55],
  sky: { top: 0x45368c, horizon: 0xff9a5a, fog: 0xf0a070 },
  beams: 0.6, // hafif far ışığı süzmesi (alacakaranlık)
  skyTex: undefined, // Poly Haven gündüz gökyüzü yerine gradyan + güneş parıltısı
  water: { shallow: 0x62c4c8, deep: 0x4b3a9a },
  light: {
    hemiSky: 0xffc9a0,
    hemiGround: 0x8a5a7a,
    hemi: 0.8,
    sun: 0xff8a3c,
    sunI: 2.6,
    sunDir: [-0.75, 0.2, 0.55],
    glow: 0xff7a30,
    cloud: 0xffa9a0, // pembe-turuncu bulutlar
    fogNear: 120,
    fogFar: 560,
  },
};
