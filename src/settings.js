// Oyuncu tercihleri (tarayıcıda saklanır). Grafik kalitesi quality.js'te.

const KEY = 'tt-settings';

const DEFAULTS = {
  name: '',
  character: 'fox',
  laps: 3,
  difficulty: 'normal', // easy | normal | hard
  shake: true,
  showFps: false,
  musicVolume: 0.7,
  sfxVolume: 0.9,
  autoGas: true, // dokunmatikte otomatik gaz
  track: 'palmCove',
  mode: 'race', // race | cup | timeTrial (Zamana Karşı sadece tek oyunculu)
};

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = load();

export function saveSettings(patch = {}) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
}

export const DIFFICULTY = {
  easy: { label: 'Kolay', skill: [0.82, 0.9] },
  normal: { label: 'Normal', skill: [0.9, 0.97] },
  hard: { label: 'Zor', skill: [0.96, 1.0] },
};
