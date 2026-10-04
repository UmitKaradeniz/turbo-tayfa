// Grafik kalite ön ayarları. Seçim sırası: ?q=low|medium|high → kayıtlı tercih → "Otomatik" (varsayılan).
// Otomatik modda seviye cihaza göre ilk açılışta ölçülür ve yarışlardaki gerçek performansa göre yavaşça ayarlanır
// (bkz. autoQuality.js). Elle seçilen seviye hiç değiştirilmez.

// Otomatik mod 6 kademeli merdiven kullanır (en görünür kaybı en sona bırakacak sıra); elle seçimde yalnızca low/medium/high.
const PRESETS = {
  low: { name: 'low', pixelRatio: 1, shadows: false, shadowSize: 0, bloom: false, msaa: 0, decor: 0.45, particles: 0.5, sky: false, detailRoad: false, detailGround: false, beams: false },
  lowplus: { name: 'lowplus', pixelRatio: 1.25, shadows: false, shadowSize: 0, bloom: false, msaa: 0, decor: 0.6, particles: 0.6, sky: false, detailRoad: false, detailGround: false, beams: false },
  medlow: { name: 'medlow', pixelRatio: 1.25, shadows: true, shadowSize: 1024, bloom: false, msaa: 0, decor: 0.75, particles: 0.8, sky: true, detailRoad: true, detailGround: false, beams: true },
  medium: { name: 'medium', pixelRatio: 1.5, shadows: true, shadowSize: 1024, bloom: true, msaa: 0, fxaa: true, decor: 0.75, particles: 0.8, sky: true, detailRoad: true, detailGround: false, beams: true },
  highlow: { name: 'highlow', pixelRatio: 1.75, shadows: true, shadowSize: 2048, bloom: true, msaa: 0, fxaa: true, decor: 1, particles: 1, sky: true, detailRoad: true, detailGround: true, beams: true },
  high: { name: 'high', pixelRatio: 2, shadows: true, shadowSize: 2048, bloom: true, msaa: 0, fxaa: true, decor: 1, particles: 1, sky: true, detailRoad: true, detailGround: true, beams: true },
};
export const TIERS = ['low', 'lowplus', 'medlow', 'medium', 'highlow', 'high'];

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

// İlk açılış tahmini için ekran kartı adı (geçici bağlamdan; ayrıca WEBGL_debug_renderer_info yoksa genel ad)
function readGpu() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

// Mobil GPU ailesine göre başlangıç kademesi (sonra ölçüm düzeltir); bilinmeyen: null
export function gpuTier(gpu) {
  if (/swiftshader|llvmpipe|software|softpipe/i.test(gpu)) return 'low';
  if (/immortalis/i.test(gpu)) return 'highlow';
  if (/apple/i.test(gpu)) return 'highlow';
  let m = /adreno.*?(\d{3})/i.exec(gpu);
  if (m) {
    const n = +m[1];
    return n >= 730 ? 'highlow' : n >= 650 ? 'medium' : n >= 610 ? 'medlow' : n >= 530 ? 'lowplus' : 'low';
  }
  m = /mali-?\s*g\s*(\d+)/i.exec(gpu);
  if (m) {
    const n = +m[1];
    return n >= 710 ? 'medium' : n >= 76 && n < 100 ? 'medium' : n >= 68 && n < 100 ? 'medlow' : 'lowplus';
  }
  if (/mali|powervr/i.test(gpu)) return 'low';
  return null;
}

// Ölçüm yapılmadan önceki ilk tahmin: iyimser (gereğinden düşük başlama), çok zayıf donanım hariç
function guessTier() {
  const touch = matchMedia('(pointer: coarse)').matches;
  const mem = navigator.deviceMemory; // sadece Chromium
  const cores = navigator.hardwareConcurrency || 4;
  if ((mem && mem <= 2) || cores <= 2) return 'low';
  if (!touch) return 'high';
  return gpuTier(readGpu()) ?? 'medium';
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

// Gelişmiş grafik ayarları: ön ayarın üstüne tek tek biner ('auto' = ön ayar ne diyorsa). Değişince sayfa yenilenir.
const GFX_KEY = 'tt-gfx';
export const GFX_DEFAULTS = { aa: 'auto', bloom: 'auto', res: 'auto', shadows: 'auto', decor: 'auto', particles: 'auto', sharpen: 'auto', dynRes: true, fpsCap: 0 };

export function readGfx() {
  try {
    return { ...GFX_DEFAULTS, ...JSON.parse(localStorage.getItem(GFX_KEY) || '{}') };
  } catch {
    return { ...GFX_DEFAULTS };
  }
}

export function saveGfx(gfx) {
  try {
    localStorage.setItem(GFX_KEY, JSON.stringify(gfx));
  } catch {}
}

// Tanı için tek tek özellik kapatma: ?msaa=0  ?bloom=0  ?shadows=0
const params = new URLSearchParams(location.search);
const picked = pick();
export const QUALITY = { ...PRESETS[picked.tier], mode: picked.mode, auto: picked.mode === 'auto' };

const gfx = readGfx();
QUALITY.gfx = gfx;
if (gfx.bloom === 'on') QUALITY.bloom = true;
if (gfx.bloom === 'off') QUALITY.bloom = false;
if (typeof gfx.res === 'number') QUALITY.pixelRatio = gfx.res;
if (gfx.shadows === 'off') QUALITY.shadows = false;
if (gfx.shadows === 'mid' || gfx.shadows === 'high') {
  QUALITY.shadows = true;
  QUALITY.shadowSize = gfx.shadows === 'high' ? 2048 : 1024;
}
const LEVEL = { low: 0, mid: 1, high: 2 };
if (gfx.decor in LEVEL) QUALITY.decor = [0.45, 0.75, 1][LEVEL[gfx.decor]];
if (gfx.particles in LEVEL) QUALITY.particles = [0.5, 0.8, 1][LEVEL[gfx.particles]];

if (params.get('msaa') === '0') QUALITY.msaa = 0;
if (params.get('bloom') === '0') QUALITY.bloom = false;
if (params.get('shadows') === '0') QUALITY.shadows = false;

// Kenar yumuşatma: off | fxaa | smaa | msaa2 | msaa4. Ön ayar varsayılanı: bloom varsa FXAA, yoksa tarayıcının MSAA'sı.
// (TAA bilerek yok: hızlı hareket eden kamerada hayalet izi bırakır.)
QUALITY.aa = gfx.aa !== 'auto' ? gfx.aa : QUALITY.bloom ? 'fxaa' : 'msaa4';
if (params.get('msaa') === '0' && QUALITY.aa.startsWith('msaa')) QUALITY.aa = 'off';
QUALITY.msaa = QUALITY.aa === 'msaa2' ? 2 : QUALITY.aa === 'msaa4' ? 4 : 0;
QUALITY.fxaa = QUALITY.aa === 'fxaa';
QUALITY.smaa = QUALITY.aa === 'smaa';
// Keskinleştirme: FXAA/SMAA hafif bulanıklık bırakır; 'auto' bunlarla hafif keskinlik ekler
QUALITY.sharpen = gfx.sharpen === 'on' ? 0.35 : gfx.sharpen === 'off' ? 0 : QUALITY.fxaa || QUALITY.smaa ? 0.2 : 0;
QUALITY.composer = QUALITY.bloom || QUALITY.fxaa || QUALITY.smaa || QUALITY.sharpen > 0; // son işlem zinciri gerekli mi
QUALITY.dynRes = gfx.dynRes !== false;
QUALITY.fpsCap = [30, 60].includes(gfx.fpsCap) ? gfx.fpsCap : 0;
if (params.get('sky') === '1') QUALITY.sky = true; // tanı: Düşük kalitede de gerçek gökyüzü
if (params.get('sky') === '0') QUALITY.sky = false;
if (params.get('tex') === '1') QUALITY.detailRoad = QUALITY.detailGround = true; // tanı: Düşük kalitede de detay dokuları
if (params.get('tex') === '0') QUALITY.detailRoad = QUALITY.detailGround = false;

export function saveQuality(name) {
  try {
    localStorage.setItem('tt-quality', name);
  } catch {}
}
