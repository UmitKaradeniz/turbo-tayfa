import * as THREE from 'three';
import { cloneModel } from './assets.js';

// Turbo Tayfa karakterleri: her biri bir Cube Pets hayvanı + bir Car Kit kartı.
export const CHARACTERS = [
  { id: 'fox', color: '#ff8a2a', name: 'Fındık', desc: 'Kurnaz ve hızlı, virajların ustası', pet: 'pets/animal-fox', kart: 'karts/kart-oopi' },
  { id: 'penguin', color: '#3b4a6b', name: 'Buzi', desc: 'Buz gibi sakin, drift yaparken hiç şaşmaz', pet: 'pets/animal-penguin', kart: 'karts/kart-oobi' },
  { id: 'panda', color: '#e9e9e9', name: 'Pofuduk', desc: 'Pofuduk ama pistte acımasız', pet: 'pets/animal-panda', kart: 'karts/kart-oodi' },
  { id: 'tiger', color: '#ffb020', name: 'Şimşek', desc: 'Düzlüklerin tartışmasız kralı', pet: 'pets/animal-tiger', kart: 'karts/kart-oozi' },
  { id: 'bunny', color: '#ffa6cf', name: 'Zıpzıp', desc: 'Enerjisi hiç bitmez, hep zıplar', pet: 'pets/animal-bunny', kart: 'karts/kart-ooli' },
  { id: 'monkey', color: '#9b6a43', name: 'Cambaz', desc: 'Her yola bir kısayol arar', pet: 'pets/animal-monkey', kart: 'karts/kart-oopi' },
  { id: 'koala', color: '#9aa3ad', name: 'Uykucu', desc: 'Yavaş görünür, son turda uyanır', pet: 'pets/animal-koala', kart: 'karts/kart-oobi' },
  { id: 'parrot', color: '#2ecc71', name: 'Geveze', desc: 'Çenesi de motoru da hiç durmaz', pet: 'pets/animal-parrot', kart: 'karts/kart-oozi' },
];

export const KART_MODELS = [...new Set(CHARACTERS.flatMap((c) => [c.pet, c.kart]))];

const KART_SCALE = 2.0; // Car Kit kartı ~1.4 m → ~2.9 m
const PET_SCALE = 0.62;

// Hiyerarşi: root (dünya konumu + zemin eğimi) → body (yatma, drift açısı) → kart modeli
export function createKartModel(character) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const { scene: kart } = cloneModel(character.kart);
  kart.scale.setScalar(KART_SCALE);
  body.add(kart);

  const seat = kart.getObjectByName('character');
  const wheels = [];
  const steerWheels = [];
  kart.traverse((o) => {
    if (!o.name.startsWith('wheel-')) return;
    o.rotation.order = 'YXZ'; // önce direksiyon (Y), sonra dönme (X)
    wheels.push(o);
    if (o.name.includes('front')) steerWheels.push(o);
  });

  // Sürücü: kaskı gizle, yerine hayvanı oturt (bacaklar kartın içinde kalsın diye gizli)
  const { scene: pet, animations } = cloneModel(character.pet);
  pet.position.copy(seat.position).add(new THREE.Vector3(0, 0.02, 0.04));
  pet.scale.setScalar(PET_SCALE);
  seat.visible = false;
  pet.traverse((o) => {
    if (o.name.startsWith('leg-')) o.visible = false;
  });
  kart.add(pet);

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
    play,
    update(dt) {
      mixer.update(dt);
    },
  };
}
