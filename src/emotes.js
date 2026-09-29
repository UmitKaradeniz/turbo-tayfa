import * as THREE from 'three';

// Hızlı tepkiler: kartın üstünde "pop" diye beliren emoji baloncukları.
export const EMOTES = ['👏', '😂', '😡', '😱', '🔥', '👋'];
const LIFE = 2.6;

// Her emoji için bir kez canvas dokusu üret (sistem emoji yazı tipiyle)
const textures = EMOTES.map((e) => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  // Beyaz konuşma balonu
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0b2a55';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(64, 56, 46, 0, Math.PI * 2);
  ctx.moveTo(52, 98);
  ctx.lineTo(64, 122);
  ctx.lineTo(76, 98);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(50, 90, 28, 10); // kuyruk ile balon arasındaki çizgiyi kapat
  ctx.font = '58px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(e, 64, 60);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
});

export function createEmoteBubbles(scene) {
  const active = new Map(); // kart → { sprite, age }

  return {
    show(kart, index) {
      if (!(index >= 0 && index < EMOTES.length)) return;
      let a = active.get(kart);
      if (!a) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[index], depthWrite: false, transparent: true, fog: false }));
        sprite.renderOrder = 6;
        scene.add(sprite);
        a = { sprite, age: 0 };
        active.set(kart, a);
      }
      a.sprite.material.map = textures[index];
      a.age = 0;
    },
    update(dt) {
      for (const [kart, a] of active) {
        a.age += dt;
        if (a.age > LIFE || !kart.object.visible) {
          scene.remove(a.sprite);
          a.sprite.material.dispose();
          active.delete(kart);
          continue;
        }
        // Pop: hızla büyü, hafif zıpla, sonda sön
        const pop = Math.min(1, a.age / 0.18);
        const s = 1.6 * (pop < 1 ? pop * 1.15 : 1 + Math.sin(a.age * 9) * 0.03);
        a.sprite.scale.set(s, s, 1);
        const p = kart.object.position;
        a.sprite.position.set(p.x, p.y + 4.4 + Math.sin(a.age * 4) * 0.12, p.z);
        a.sprite.material.opacity = Math.min(1, (LIFE - a.age) / 0.35);
      }
    },
    clear() {
      for (const a of active.values()) {
        scene.remove(a.sprite);
        a.sprite.material.dispose();
      }
      active.clear();
    },
  };
}
