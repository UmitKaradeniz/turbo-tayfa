// Hata raporları: oyuncunun tarayıcısındaki hatalar sunucu loguna (Render → Logs) gönderilir.
// Kişisel veri yok: sadece hata metni, tarayıcı/GPU bilgisi ve oyun bağlamı. Oturum başına en fazla 8 rapor,
// aynı hata bir kez.

const MAX_REPORTS = 8;
const sent = new Set();
let count = 0;
let contextFn = () => ({});

// fn: () => ({ track, quality, pixelRatio, fps, gpu, ... }) — rapora eklenecek güncel bağlam
export function setReportContext(fn) {
  contextFn = fn;
}

function safeContext() {
  try {
    return contextFn();
  } catch {
    return {}; // bağlam henüz hazır değil (yükleme sırasında oluşan hata)
  }
}

export function reportIssue(kind, message, stack = '') {
  try {
    const msg = String(message ?? '').slice(0, 300);
    const key = `${kind}:${msg}`;
    if (count >= MAX_REPORTS || sent.has(key)) return;
    sent.add(key);
    count++;
    const body = JSON.stringify({
      kind,
      msg,
      stack: String(stack ?? '').slice(0, 900),
      v: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '?',
      ua: navigator.userAgent.slice(0, 200),
      vp: `${innerWidth}x${innerHeight}@${(devicePixelRatio || 1).toFixed(2)}`,
      touch: matchMedia('(pointer: coarse)').matches,
      ...safeContext(),
    });
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/log', blob)) fetch('/api/log', { method: 'POST', body: blob, keepalive: true }).catch(() => {});
  } catch {
    // raporlama asla oyunu bozmamalı
  }
}

export function initErrorReports() {
  addEventListener('error', (e) => {
    // Kaynak yükleme hataları (img/script) e.message boştur; bunları da kısaca bildir
    if (!e.message && e.target && e.target !== window) reportIssue('resource', e.target.src || e.target.href || e.target.tagName);
    else reportIssue('error', e.message, `${e.filename ?? ''}:${e.lineno ?? 0}:${e.colno ?? 0}\n${e.error?.stack ?? ''}`);
  }, true);
  addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    reportIssue('promise', r?.message ?? String(r), r?.stack ?? '');
  });
}
