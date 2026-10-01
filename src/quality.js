// Grafik kalite ön ayarları. Seçim sırası: ?q=low|medium|high → kayıtlı tercih → "Otomatik" (varsayılan).
// Otomatik modda seviye cihaza göre ilk açılışta ölçülür ve yarışlardaki gerçek performansa göre yavaşça ayarlanır
// (bkz. autoQuality.js). Elle seçilen seviye hiç değiştirilmez.

const PRESETS = {
  low: { name: 'low', pixelRatio: 1, shadows: false, shadowSize: 0, bloom: false, msaa: 0, decor: 0.45, particles: 0.5 },
  medium: { name: 'medium', pixelRatio: 1.5, shadows: true, shadowSize: 1024, bloom: true, msaa: 2, decor: 0.75, particles: 0.8 },
  high: { name: 'high', pixelRatio: 2, shadows: true, shadowSize: 2048, bloom: true, msaa: 4, decor: 1, particles: 1 },
};
export const TIERS = ['low', 'medium', 'high'];

const AUTO_KEY = 'tt-auto';

export function readAuto() {
  try {
    return JSON.parse(localStorage.getItem(AUTO_KEY) || 'null') || {};
  } catch {
    return {};
  }
}

export function saveAuto(patch) {
  try {
    localStorage.setItem(AUTO_KEY, JSON.stringify({ ...readAuto(), ...patch }));
  } catch {}
}

// Ölçüm yapılmadan önceki ilk tahmin: iyimser (gereğinden düşük başlama), çok zayıf donanım hariç
function guessTier() {
  const touch = matchMedia('(pointer: coarse)').matches;
  const mem = navigator.deviceMemory; // sadece Chromium
  const cores = navigator.hardwareConcurrency || 4;
  if ((mem && mem <= 2) || cores <= 2) return 'low';
  return touch ? 'medium' : 'high';
}

function pick() {
  const fromUrl = new URLSearchParams(location.search).get('q');
  if (PRESETS[fromUrl]) return { mode: fromUrl, tier: fromUrl };
  try {
    const saved = localStorage.getItem('tt-quality');
    if (PRESETS[saved]) return { mode: saved, tier: saved };
  } catch {}
  const auto = readAuto();
  return { mode: 'auto', tier: PRESETS[auto.tier] ? auto.tier : guessTier() };
}

// Tanı için tek tek özellik kapatma: ?msaa=0  ?bloom=0  ?shadows=0
const params = new URLSearchParams(location.search);
const picked = pick();
export const QUALITY = { ...PRESETS[picked.tier], mode: picked.mode, auto: picked.mode === 'auto' };
if (params.get('msaa') === '0') QUALITY.msaa = 0;
if (params.get('bloom') === '0') QUALITY.bloom = false;
if (params.get('shadows') === '0') QUALITY.shadows = false;

export function saveQuality(name) {
  try {
    localStorage.setItem('tt-quality', name);
  } catch {}
}
