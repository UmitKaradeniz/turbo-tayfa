import './touch.css';
import { settings } from '../settings.js';

// Dokunmatik kontroller: solda direksiyon, sağda drift / item / fren (+ isteğe bağlı gaz).
// Çoklu dokunma desteklenir (Pointer Events); durum input.js tarafından okunur.

export const touchState = { active: false, left: false, right: false, drift: false, item: false, brake: false, gas: false };
export const isTouchDevice = matchMedia('(pointer: coarse)').matches;

export function createTouchControls() {
  const root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `
    <div class="pad left">
      <button data-k="left" aria-label="Sola">◀</button>
      <button data-k="right" aria-label="Sağa">▶</button>
    </div>
    <div class="pad right">
      <button data-k="item" class="item" aria-label="Item kullan">ITEM</button>
      <button data-k="brake" class="brake" aria-label="Fren / geri">FREN</button>
      <button data-k="gas" class="gas" aria-label="Gaz">GAZ</button>
      <button data-k="drift" class="drift" aria-label="Drift">DRIFT</button>
    </div>`;
  document.body.appendChild(root);

  for (const btn of root.querySelectorAll('[data-k]')) {
    const key = btn.dataset.k;
    const set = (v) => {
      touchState[key] = v;
      btn.classList.toggle('down', v);
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      set(true);
      try {
        btn.setPointerCapture(e.pointerId); // parmak butondan kayınca da basılı kalsın
      } catch {}
      navigator.vibrate?.(8);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, () => set(false));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  let shown = null;
  return {
    show(visible) {
      if (visible === shown) return;
      shown = visible;
      touchState.active = visible;
      root.classList.toggle('show', visible);
      root.classList.toggle('manual-gas', !settings.autoGas);
      if (!visible) for (const k of Object.keys(touchState)) if (k !== 'active') touchState[k] = false;
      for (const b of root.querySelectorAll('.down')) b.classList.remove('down');
    },
  };
}

// iOS Safari: birden çok parmakla basınca metin seçimi / kopyala menüsü açılmasın;
// çift dokunuş ve iki parmakla zoom da oyunu bozmasın. Yazı alanları hariç.
const isField = (t) => t instanceof Element && !!t.closest('input, textarea, .room-code');
document.addEventListener('selectstart', (e) => { if (!isField(e.target)) e.preventDefault(); });
document.addEventListener('contextmenu', (e) => { if (!isField(e.target)) e.preventDefault(); });
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
if (isTouchDevice) {
  document.addEventListener('selectionchange', () => {
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
    const s = getSelection();
    if (s && !s.isCollapsed) s.removeAllRanges();
  });
}

// Yarış sırasında (kontroller açıkken) yazı alanı/menü dışındaki her dokunuşu sahiplen:
// iOS'un uzun basma → metin seçme / büyüteç davranışı hiç başlamasın.
// (#hud-pause: tıklaması touchstart'tan türer; engellenirse duraklat tuşu hiç çalışmaz)
const nativeTouch = 'input, textarea, form, a, .tt-modal, .tt-screen, #hud-pause';
const guardTouch = (e) => {
  if (touchState.active && !(e.target instanceof Element && e.target.closest(nativeTouch))) e.preventDefault();
};
document.addEventListener('touchstart', guardTouch, { passive: false });
document.addEventListener('touchmove', guardTouch, { passive: false });
