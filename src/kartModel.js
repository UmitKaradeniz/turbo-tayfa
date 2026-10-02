import * as THREE from 'three';
import { cloneModel } from './assets.js';

// Turbo Tayfa karakterleri: her biri bir Cube Pets hayvanı + bir Car Kit kartı.
// personality: bot olarak sürerken davranışı (ai.js → PERSONALITIES)
export const CHARACTERS = [
  { id: 'fox', personality: 'sneaky', color: '#ff8a2a', name: 'Fındık', desc: 'Kurnaz ve hızlı, virajların ustası', pet: 'pets/animal-fox', kart: 'karts/kart-oopi' },
  { id: 'penguin', personality: 'clean', color: '#3b4a6b', name: 'Buzi', desc: 'Buz gibi sakin, drift yaparken hiç şaşmaz', pet: 'pets/animal-penguin', kart: 'karts/kart-oobi' },
  { id: 'panda', personality: 'aggressive', color: '#e9e9e9', name: 'Pofuduk', desc: 'Pofuduk ama pistte acımasız', pet: 'pets/animal-panda', kart: 'karts/kart-oodi' },
  { id: 'tiger', personality: 'balanced', color: '#ffb020', name: 'Şimşek', desc: 'Düzlüklerin tartışmasız kralı', pet: 'pets/animal-tiger', kart: 'karts/kart-oozi' },
  { id: 'bunny', personality: 'aggressive', color: '#ffa6cf', name: 'Zıpzıp', desc: 'Enerjisi hiç bitmez, hep zıplar', pet: 'pets/animal-bunny', kart: 'karts/kart-ooli' },
  { id: 'monkey', personality: 'sneaky', color: '#9b6a43', name: 'Cambaz', desc: 'Her yola bir kısayol arar', pet: 'pets/animal-monkey', kart: 'karts/kart-oopi' },
  { id: 'koala', personality: 'sleepy', color: '#9aa3ad', name: 'Uykucu', desc: 'Yavaş görünür, son turda uyanır', pet: 'pets/animal-koala', kart: 'karts/kart-oobi' },
  { id: 'parrot', personality: 'chatty', color: '#2ecc71', name: 'Geveze', desc: 'Çenesi de motoru da hiç durmaz', pet: 'pets/animal-parrot', kart: 'karts/kart-oozi' },
  { id: 'cat', personality: 'sneaky', color: '#d9a066', name: 'Pamuk', desc: 'Sessiz adımlarla geçer, kimse fark etmez', pet: 'pets/animal-cat', kart: 'karts/kart-oozi' },
  { id: 'dog', personality: 'aggressive', color: '#b9814f', name: 'Bıdık', desc: 'Sadık ama yarışta hiç acımaz', pet: 'pets/animal-dog', kart: 'karts/kart-oodi' },
  { id: 'lion', personality: 'aggressive', color: '#e2a73b', name: 'Kükrer', desc: 'Pistin kralı olduğuna inanıyor', pet: 'pets/animal-lion', kart: 'karts/kart-ooli' },
  { id: 'elephant', personality: 'balanced', color: '#9aa7b8', name: 'Tombiş', desc: 'Ağır görünür ama durdurulamaz', pet: 'pets/animal-elephant', kart: 'karts/kart-oobi' },
  { id: 'giraffe', personality: 'clean', color: '#f0c04a', name: 'Uzun', desc: 'Herkesi yukarıdan izler, hata yapmaz', pet: 'pets/animal-giraffe', kart: 'karts/kart-oopi' },
  { id: 'cow', personality: 'sleepy', color: '#d8d8d8', name: 'Sütlaç', desc: 'Sakin, sabırlı, bazen inatçı', pet: 'pets/animal-cow', kart: 'karts/kart-oodi' },
  { id: 'pig', personality: 'chatty', color: '#ffb0c0', name: 'Pembe', desc: 'Çamura bulanınca daha hızlı olduğunu söyler', pet: 'pets/animal-pig', kart: 'karts/kart-ooli' },
  { id: 'hog', personality: 'balanced', color: '#8a6a55', name: 'Dişli', desc: 'Düz yolda burnunu önüne koyar', pet: 'pets/animal-hog', kart: 'karts/kart-oozi' },
  { id: 'chick', personality: 'aggressive', color: '#ffd94a', name: 'Civciv', desc: 'Minicik ama sabırsız, hep öne geçmek ister', pet: 'pets/animal-chick', kart: 'karts/kart-oopi' },
  { id: 'crab', personality: 'sneaky', color: '#e0523a', name: 'Kıskaç', desc: 'Yanlamasına gider, dosdoğru kazanır', pet: 'pets/animal-crab', kart: 'karts/kart-oobi' },
  { id: 'deer', personality: 'clean', color: '#b98b5a', name: 'Ceylan', desc: 'Zarif ve çevik, virajlarda kayar gibi döner', pet: 'pets/animal-deer', kart: 'karts/kart-oodi' },
  { id: 'bee', personality: 'aggressive', color: '#ffcf2e', name: 'Vızıltı', desc: 'Hızlı, sinirli ve iğneli', pet: 'pets/animal-bee', kart: 'karts/kart-ooli' },
  { id: 'caterpillar', personality: 'sleepy', color: '#7ed957', name: 'Tırtıl', desc: 'Yavaş başlar, kelebek gibi biter', pet: 'pets/animal-caterpillar', kart: 'karts/kart-oozi' },
  { id: 'polar', personality: 'clean', color: '#cfe3f5', name: 'Kutup', desc: 'Soğukkanlı bir rakip, hiç telaşlanmaz', pet: 'pets/animal-polar', kart: 'karts/kart-oobi' },
  { id: 'beaver', personality: 'balanced', color: '#8b5a2b', name: 'Kunduz', desc: 'Yolu kendi yapar, dişini sıkar', pet: 'pets/animal-beaver', kart: 'karts/kart-oopi' },
  { id: 'fish', personality: 'chatty', color: '#4fc3f7', name: 'Balık', desc: 'Sudan çıkmış ama en hızlısı o', pet: 'pets/animal-fish', kart: 'karts/kart-oodi' },
];

// Yarış sahası 8 kişidir: oyuncu + 7 rakip. Rakipler kadrodan rastgele seçilir.
export function pickRivals(mineId, n = 7) {
  const pool = CHARACTERS.filter((c) => c.id !== mineId).map((c) => c.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export const KART_MODELS = [...new Set(CHARACTERS.flatMap((c) => [c.pet, c.kart]))];

const KART_SCALE = 2.0; // Car Kit kartı ~1.4 m → ~2.9 m
const PET_SCALE = 0.62;

// Hiyerarşi: root (dünya konumu + zemin eğimi) → body (yatma, drift açısı) → kart modeli
export function createKartModel(character, bodyPath = character.kart) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const wheels = []; // gövde değişince yerinde yenilenir (dışarıdan aynı dizi kullanılır)
  const steerWheels = [];

  // Sürücü: kaskı gizle, yerine hayvanı oturt (bacaklar kartın içinde kalsın diye gizli)
  const { scene: pet, animations } = cloneModel(character.pet);
  pet.scale.setScalar(PET_SCALE);
  pet.traverse((o) => {
    if (o.name.startsWith('leg-')) o.visible = false;
  });

  let kart = null;
  let bodyId = null;
  const setBody = (path) => {
    if (path === bodyId) return;
    bodyId = path;
    if (kart) body.remove(kart); // hayvan eski gövdenin çocuğuydu; yenisine taşınır
    kart = cloneModel(path).scene;
    kart.scale.setScalar(KART_SCALE);
    body.add(kart);
    wheels.length = steerWheels.length = 0;
    kart.traverse((o) => {
      if (!o.name.startsWith('wheel-')) return;
      o.rotation.order = 'YXZ'; // önce direksiyon (Y), sonra dönme (X)
      wheels.push(o);
      if (o.name.includes('front')) steerWheels.push(o);
    });
    const seat = kart.getObjectByName('character');
    pet.position.copy(seat.position).add(new THREE.Vector3(0, 0.02, 0.04));
    seat.visible = false;
    kart.add(pet);
  };
  setBody(bodyPath);

  const mixer = new THREE.AnimationMixer(pet);
  const clip = (name) => animations.find((a) => a.name === name);
  let current = null;
  const play = (name, fade = 0.25) => {
    const c = clip(name);
    if (!c) return;
    const action = mixer.clipAction(c);
    if (current === action) return;
    action.reset().fadeIn(fade).play();
    current?.fadeOut(fade);
    current = action;
  };
  play('idle', 0);

  return {
    root,
    body,
    pet,
    wheels,
    steerWheels,
    wheelRadius: 0.21 * KART_SCALE,
    setBody,
    play,
    update(dt) {
      mixer.update(dt);
    },
  };
}
