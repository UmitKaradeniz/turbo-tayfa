import * as THREE from 'three';

// Kartların üstünde oyuncu adı (canvas dokulu sprite). Yakındaki rakiplerde görünür.

function makeTexture(text, color, isBot) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '800 44px Nunito, system-ui, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 56;
  canvas.width = w;
  canvas.height = 76;
  ctx.font = font;
  ctx.fillStyle = isBot ? 'rgba(11,42,85,0.55)' : 'rgba(11,42,85,0.82)';
  ctx.beginPath();
  ctx.roundRect(2, 2, w - 4, 72, 24);
  ctx.fill();
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
  const plates = new Map(); // kart → sprite

  return {
    set(kart, text, isBot = false) {
      this.remove(kart);
      if (!text) return;
      const { tex, aspect } = makeTexture(text, kart.character.color, isBot);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, fog: false }));
      sprite.scale.set(0.62 * aspect, 0.62, 1);
      sprite.renderOrder = 5;
      scene.add(sprite);
      plates.set(kart, sprite);
    },
    remove(kart) {
      const s = plates.get(kart);
      if (!s) return;
      scene.remove(s);
      s.material.map.dispose();
      s.material.dispose();
      plates.delete(kart);
    },
    clear() {
      for (const k of [...plates.keys()]) this.remove(k);
    },
    update(camera, own) {
      for (const [kart, s] of plates) {
        const p = kart.object.position;
        s.position.set(p.x, p.y + 3.4, p.z);
        const d = p.distanceTo(camera.position);
        s.visible = kart !== own && kart.object.visible && d < 70;
        s.material.opacity = Math.min(1, (70 - d) / 20);
      }
    },
  };
}
