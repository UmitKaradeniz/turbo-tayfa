import { settings } from './settings.js';

// Jiroskop/eğme ile direksiyon (yalnız sağ-sol): telefonu direksiyon gibi ekran düzleminde çevirmek.
// Yerçekimi vektörünün cihazın x-y düzlemindeki açısı kullanılır; iki vektörün arasındaki işaretli açı
// platformların ivme işaret farkından etkilenmez ve ekran yönüne (yatay sol/sağ) bağlı değildir.
// Gaz otomatik kalır; öne-arkaya eğme hiçbir şey yapmaz.

const DEAD_ZONE = 4; // derece
const FULL_TURN = 30; // bu açıda tam dönüş

export const tilt = { ready: false }; // ready: sensörden veri geliyor

let g = null; // yumuşatılmış yerçekimi (x, y)
let g0 = null; // "düz" referans (yarış başlayana kadar sürekli güncellenir)
let listening = false;

function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x == null || a.y == null) return;
  if (Math.hypot(a.x, a.y) < 2.5) return; // telefon yatay yatıyor: ekran düzleminde açı anlamsız
  g = g ? { x: g.x + (a.x - g.x) * 0.3, y: g.y + (a.y - g.y) * 0.3 } : { x: a.x, y: a.y };
  if (!tilt.ready) {
    tilt.ready = true;
    applyTiltUI();
  }
}

// Sol-sağ butonlar, eğme açıkken ve sensör çalışırken gizlenir
export function applyTiltUI() {
  document.getElementById('touch')?.classList.toggle('tilt', !!(settings.tiltSteer && tilt.ready));
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener('devicemotion', onMotion);
}

// iOS 13+: sensör izni yalnız kullanıcı dokunuşuyla istenir. Dönen değer: izin var mı
export async function enableTilt() {
  if (typeof DeviceMotionEvent === 'undefined') return false;
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function' && (await DeviceMotionEvent.requestPermission()) !== 'granted') return false;
  } catch {
    return false;
  }
  listen();
  return true;
}

// Açılışta ayar açıksa dinlemeye başla; iOS'ta izin ilk dokunuşta istenir
export function initTilt() {
  if (!settings.tiltSteer || typeof DeviceMotionEvent === 'undefined') return;
  if (typeof DeviceMotionEvent.requestPermission !== 'function') return listen();
  window.addEventListener('pointerdown', () => enableTilt(), { once: true });
}

// -1..1 (+1 = sola, input.js ile aynı). calibrate: yarış başlamadı, o anki tutuşu "düz" say
export function tiltSteer(calibrate) {
  if (!g) return 0;
  if (!g0 || calibrate) g0 = { ...g };
  const deg = (Math.atan2(g0.x * g.y - g0.y * g.x, g0.x * g.x + g0.y * g.y) * 180) / Math.PI; // +: saat yönünde çevirdi (sağa)
  const m = Math.min(1, Math.max(0, (Math.abs(deg) - DEAD_ZONE) / (FULL_TURN - DEAD_ZONE)));
  return -Math.sign(deg) * m;
}
