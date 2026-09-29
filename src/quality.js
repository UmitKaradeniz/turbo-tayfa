// Grafik kalite ön ayarları. Seçim sırası: ?q=low|medium|high → kayıtlı tercih → cihaza göre otomatik.
// (Ayarlar menüsü Aşama 4'te gelecek.)

const PRESETS = {
  low: { name: 'low', pixelRatio: 1, shadows: false, shadowSize: 0, bloom: false, msaa: 0, decor: 0.45, particles: 0.5 },
  medium: { name: 'medium', pixelRatio: 1.5, shadows: true, shadowSize: 1024, bloom: true, msaa: 2, decor: 0.75, particles: 0.8 },
  high: { name: 'high', pixelRatio: 2, shadows: true, shadowSize: 2048, bloom: true, msaa: 4, decor: 1, particles: 1 },
};

function pick() {
  const fromUrl = new URLSearchParams(location.search).get('q');
  if (PRESETS[fromUrl]) return fromUrl;
  try {
    const saved = localStorage.getItem('tt-quality');
    if (PRESETS[saved]) return saved;
  } catch {}
  const touch = matchMedia('(pointer: coarse)').matches;
  return touch ? 'low' : 'high';
}

export const QUALITY = PRESETS[pick()];

export function saveQuality(name) {
  try {
    localStorage.setItem('tt-quality', name);
  } catch {}
}
