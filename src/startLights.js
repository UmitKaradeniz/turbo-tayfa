import * as THREE from 'three';

// Başlangıç kapısındaki lambalar: geri sayımda kırmızı yanar, BAŞLA'da yeşile döner.
export function createStartLights(decor) {
  const lamps = [];
  decor.userData.byKey.get('racing/overheadLights')?.traverse((o) => {
    if (o.isMesh && o.material.name === 'red') {
      o.material = o.material.clone();
      lamps.push(o.material);
    }
  });
  const red = new THREE.Color(0xff2a1a);
  const green = new THREE.Color(0x2bff6a);
  const base = lamps[0]?.color.clone();

  const set = (color, glow) => {
    for (const m of lamps) {
      m.color.copy(color);
      m.emissive.copy(color);
      m.emissiveIntensity = glow;
    }
  };

  return {
    off() {
      if (base) set(base, 0);
    },
    countdown(n) {
      set(red, [0, 2.5, 1.6, 0.8][n] ?? 0.8); // 3 → loş, 1 → parlak
    },
    go() {
      set(green, 2.5);
    },
  };
}
