import { touchState } from './ui/touch.js';
import { settings } from './settings.js';

// Klavye ve dokunmatik girdiyi oyunun anladığı soyut girdiye çevirir.

const keys = new Set();

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return; // isim / oda kodu yazarken sürme
  keys.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const down = (...codes) => codes.some((c) => keys.has(c));

export function readInput() {
  const t = touchState;
  const left = down('KeyA', 'ArrowLeft') || t.left;
  const right = down('KeyD', 'ArrowRight') || t.right;
  const brake = down('KeyS', 'ArrowDown') || t.brake;
  // Dokunmatikte otomatik gaz (fren basılıyken bırakılır)
  const autoGas = t.active && settings.autoGas && !brake;
  return {
    throttle: down('KeyW', 'ArrowUp') || t.gas || autoGas ? 1 : 0,
    brake: brake ? 1 : 0,
    steer: (left ? 1 : 0) - (right ? 1 : 0), // +1 = sola
    drift: down('Space', 'ShiftLeft', 'ShiftRight') || t.drift,
    item: down('KeyE', 'KeyF') || t.item,
    reset: down('KeyR'),
  };
}
