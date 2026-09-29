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
