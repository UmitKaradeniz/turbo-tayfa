// "Otomatik" grafik kalitesi: cihaza uygun seviyeyi bulur, ama gereğinden düşük seviyeye düşmemek için temkinli davranır.
//
// 1) İlk açılış ölçümü (menüde): yükleme bittikten ve ilk takılmalar geçtikten sonra ~5 sn kare süresi ölçülür.
//    Ortanca (medyan) kare süresi kullanılır, tek tük takılmalar sonucu bozmaz. Ölçüm kararsızsa
//    (hâlâ yükleniyor, sekme arka planda, çok takılma) hükümsüz sayılıp birkaç kez tekrarlanır; hiç karar
//    çıkmazsa seviye değişmez. 30 FPS'e kilitli görünen ekran (pil tasarrufu) "yavaş cihaz" sayılmaz.
// 2) Yarışlarda gerçek performans: dinamik çözünürlük (main.js) zaten anlık düşüşleri yönetir. Sadece
//    iki ayrı yarışta çözünürlük uzun süre düşük kalırsa seviye bir kademe iner. Bir kademe yükselmek için
//    art arda 4 yarışın tam FPS ile geçmesi gerekir; yükselme/inme bir sonraki açılışta uygulanır.
//
// Kalıcı durum (tt-auto): { tier, calibrated, slow, good, max, maxAt }

import { QUALITY, TIERS, readAuto, saveAuto } from './quality.js';

const WARMUP = 1.5; // sn: yükleme bittikten sonra beklenen süre (shader/doku yükleme takılmaları)
const WINDOW = 5; // sn: ölçüm penceresi
const MIN_FRAMES = 40;
const RETRIES = 4;
const DAY = 86400000;

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

export function createAutoTuner({ canReload }) {
  let readyAt = Infinity;
  let attempts = 0;
  let frames = [];
  let windowStart = 0;
  let cooldownUntil = 0;
  let done = !QUALITY.auto || !!readAuto().calibrated;

  // Yarış başına örnekler
  let samples = [];

  const step = (tier, d) => TIERS[Math.max(0, Math.min(TIERS.length - 1, TIERS.indexOf(tier) + d))];

  function applyTier(tier, extra = {}) {
    saveAuto({ tier, ...extra });
    if (tier !== QUALITY.name) QUALITY.pendingTier = tier;
  }

  function decide(medianMs, spreadMs) {
    const fps = 1000 / medianMs;
    // 30 FPS'e kilitli, çok düzgün kare süresi: cihaz yavaş değil, ekran/pil tasarrufu sınırlıyor olabilir
    const capped30 = medianMs > 30 && medianMs < 37 && spreadMs < 4;
    if (capped30) return false;
    let tier = QUALITY.name;
    if (fps < 36) tier = step(tier, -2);
    else if (fps < 50) tier = step(tier, -1);
    applyTier(tier, { calibrated: true, slow: 0, good: 0 });
    // Ana menüdeyken, kullanıcı bir şey yapmıyorsa sessizce yeni seviyeyle yeniden başlat
    if (tier !== QUALITY.name && canReload()) {
      try {
        if (!sessionStorage.getItem('tt-auto-reloaded')) {
          sessionStorage.setItem('tt-auto-reloaded', '1');
          location.reload();
        }
      } catch {}
    }
    return true;
  }

  return {
    // Yükleme ekranı kapandı: ölçüm bundan WARMUP sn sonra başlar
    markReady(nowMs) {
      readyAt = nowMs + WARMUP * 1000;
    },

    // Menüdeyken her karede (dt: saniye)
    menuFrame(dt, nowMs, ok) {
      if (done || nowMs < readyAt || nowMs < cooldownUntil) return;
      if (!ok || document.hidden) {
        frames = []; // sekme/pencere durum değiştirdi: pencereyi baştan başlat
        return;
      }
      if (!frames.length) windowStart = nowMs;
      frames.push(dt * 1000);
      if (nowMs - windowStart < WINDOW * 1000) return;
      const f = frames;
      frames = [];
      attempts++;
      const med = median(f);
      const spread = pct(f, 0.9) - pct(f, 0.1);
      // Kararsız pencere (yükleme takılmaları): çok sayıda ortancadan çok uzun kare
      const outliers = f.filter((x) => x > med * 2.5).length / f.length;
      const reliable = f.length >= MIN_FRAMES && outliers < 0.2;
      if (reliable && decide(med, spread)) {
        done = true;
      } else if (attempts >= RETRIES) {
        done = true; // karar çıkmadı: seviye değişmez, yarış içi ölçüm devralır
      } else {
        cooldownUntil = nowMs + 2500;
      }
    },

    // Yarış başında örnekleri sıfırla
    raceReset() {
      samples = [];
    },

    // Yarışta 0.5 sn'de bir (başlamış, duraklatılmamış yarışta): FPS ve çözünürlük durumu
    raceSample(fps, pixelRatio, basePixelRatio) {
      samples.push({ fps, low: pixelRatio <= basePixelRatio * 0.75, base: pixelRatio >= basePixelRatio - 1e-3 });
    },

    // Yarış bitti: yarışı "yavaş" / "sorunsuz" / "belirsiz" olarak değerlendir
    raceFinish() {
      if (!QUALITY.auto) return;
      const s = samples.slice(20); // ilk 10 sn atılır (yükleme, shader derleme, başlangıç yığılması)
      samples = [];
      if (s.length < 60) return; // en az 30 sn kesintisiz yarış
      const auto = readAuto();
      const tier = auto.tier ?? QUALITY.name;
      const lowFrac = s.filter((x) => x.low).length / s.length;
      const baseFrac = s.filter((x) => x.base).length / s.length;
      const medFps = median(s.map((x) => x.fps));
      let slow = auto.slow ?? 0;
      let good = auto.good ?? 0;
      if (lowFrac >= 0.5) {
        slow++;
        good = 0;
      } else if (baseFrac >= 0.9 && medFps >= 56) {
        good++;
        slow = 0;
      }
      const maxTier = auto.max && Date.now() - (auto.maxAt ?? 0) < 14 * DAY ? auto.max : 'high';
      if (slow >= 2 && tier !== 'low') {
        const next = step(tier, -1);
        applyTier(next, { slow: 0, good: 0, max: next, maxAt: Date.now() });
      } else if (good >= 4 && TIERS.indexOf(tier) < TIERS.indexOf(maxTier)) {
        applyTier(step(tier, 1), { slow: 0, good: 0 });
      } else saveAuto({ slow, good });
    },
  };
}
