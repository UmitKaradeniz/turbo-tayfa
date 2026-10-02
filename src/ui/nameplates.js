import * as THREE from 'three';

// Online yarışta diğer gerçek oyuncuların kartı üstünde oyuncu adı (canvas dokulu sprite).
// Botlar için etiket konmaz. Ekrandaki boyut uzaktan da okunacak kadar büyür.

const NEAR = 14; // bu mesafeye kadar gerçek boyut, ötesinde ekrandaki boyutu korumak için büyür
const FADE_START = 130;
const FADE_END = 170;

function makeTexture(text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '800 44px "Baloo 2", system-ui, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 56;
  canvas.width = w;
  canvas.height = 76;
  ctx.font = font;
  ctx.fillStyle = 'rgba(11,42,85,0.85)';
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, 72, 24);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(30, 38, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 48, 40);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: w / 76 };
}

export function createNameplates(scene) {
  const plates = new Map(); // kart → { sprite, aspect }

  return {
    set(kart, text) {
      this.remove(kart);
      if (!text) return;
      const { tex, aspect } = makeTexture(text, kart.character.color);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, fog: false }));
      sprite.renderOrder = 5;
      scene.add(sprite);
      plates.set(kart, { sprite, aspect });
    },
    remove(kart) {
      const p = plates.get(kart);
      if (!p) return;
      scene.remove(p.sprite);
      p.sprite.material.map.dispose();
      p.sprite.material.dispose();
      plates.delete(kart);
    },
    clear() {
      for (const k of [...plates.keys()]) this.remove(k);
    },
    update(camera, own) {
      for (const [kart, { sprite, aspect }] of plates) {
        const p = kart.object.position;
        sprite.position.set(p.x, p.y + 3.4, p.z);
        const d = p.distanceTo(camera.position);
        sprite.visible = kart !== own && kart.object.visible && d < FADE_END;
        if (!sprite.visible) continue;
        const h = 0.75 * Math.max(1, d / NEAR);
        sprite.scale.set(h * aspect, h, 1);
        sprite.material.opacity = Math.min(1, (FADE_END - d) / (FADE_END - FADE_START));
      }
    },
  };
}
