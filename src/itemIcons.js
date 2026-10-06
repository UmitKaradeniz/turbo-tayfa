// Item simgeleri (HUD yuvası ve rulet şeridi): düz vektör, iki tonlu gölge ("D2" stili), SVG data URL.
// Sıra: turbo, shield, coconut, oil, gull, parrot (rulet şeridi bu sırayla döner).
const PAL = {
  turbo: { base: '#ff6a1a', dark: '#c94a05' },
  shield: { base: '#3cc4f0', dark: '#1b8fc0' },
  coconut: { base: '#8a5630', dark: '#5a3519' },
  oil: { base: '#4a3470', dark: '#241838' },
  gull: { base: '#f4f8ff', dark: '#9db7e0' },
  parrot: { base: '#ff4b4b', dark: '#c01e1e' },
};

// Şekiller; f = gövde dolgusu (iki tonlu gradyan ya da gölge rengi)
const SHAPES = {
  turbo: (f) => `
    <rect x="39" y="9" width="22" height="14" rx="4" fill="${f.cap}"/>
    <path d="M41 24H59V33C59 40 75 44 75 62V82C75 90 69 94 61 94H39C31 94 25 90 25 82V62C25 44 41 40 41 33Z" fill="${f.body}"/>
    <rect x="25" y="58" width="50" height="24" fill="${f.label}"/>
    <path d="M55 60L43 71.5H50.5L46 82L59 68.5H51.5Z" fill="${f.bolt}"/>`,
  shield: (f) => `<circle cx="50" cy="52" r="38" fill="${f.body}"/>`,
  coconut: (f) => `<circle cx="50" cy="54" r="38" fill="${f.body}"/>`,
  oil: (f) => `<path d="M50 8C50 8 22 44 22 64A28 28 0 0 0 78 64C78 44 50 8 50 8Z" fill="${f.body}"/>`,
  // Martı: ağır kanatlı beyaz kuş silueti
  gull: (f) => `<path d="M6 42C22 20 42 26 50 46C58 26 78 20 94 42C80 40 68 48 58 64L50 82L42 64C32 48 20 40 6 42Z" fill="${f.body}"/><ellipse cx="50" cy="56" rx="13" ry="20" fill="${f.body}"/>`,
  // Papağan: yan görünüm, iri kafa ve uzun kuyruk
  parrot: (f) => `<path d="M30 64C20 80 26 94 34 98C38 86 42 78 48 72Z" fill="${f.body}"/><ellipse cx="50" cy="58" rx="22" ry="28" transform="rotate(-18 50 58)" fill="${f.body}"/><circle cx="58" cy="30" r="20" fill="${f.body}"/>`,
};

// Parlama ve yüz ayrıntıları
const DETAIL = {
  turbo: '<path d="M31 53C31 48 35 45 39 42" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="4.5" stroke-linecap="round"/>',
  shield: '<path d="M26 42A26 26 0 0 1 42 25" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="6" stroke-linecap="round"/><circle cx="68" cy="72" r="4.5" fill="#fff" fill-opacity=".7"/><circle cx="60" cy="80" r="2.4" fill="#fff" fill-opacity=".6"/>',
  coconut: '<path d="M24 42A29 29 0 0 1 40 26" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="6" stroke-linecap="round"/><circle cx="39" cy="54" r="5.5" fill="#2b1a0e"/><circle cx="61" cy="54" r="5.5" fill="#2b1a0e"/><circle cx="50" cy="68" r="5.5" fill="#2b1a0e"/>',
  oil: '<path d="M34 62A16 16 0 0 0 42 77" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="6" stroke-linecap="round"/><ellipse cx="41" cy="38" rx="4.6" ry="9" transform="rotate(22 41 38)" fill="#fff" fill-opacity=".4"/>',
  gull: '<path d="M6 42C14 33 24 30 32 33" fill="none" stroke="#5a6b86" stroke-width="5" stroke-linecap="round"/><path d="M94 42C86 33 76 30 68 33" fill="none" stroke="#5a6b86" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="40" r="2.6" fill="#14213d"/><path d="M47 45L50 54L53 45Z" fill="#ff9a1a"/>',
  parrot: '<path d="M70 32L90 38L72 44Z" fill="#2b2b2b"/><circle cx="62" cy="26" r="4" fill="#fff"/><circle cx="63" cy="26" r="2.2" fill="#111"/><path d="M36 54C42 52 50 56 54 66" fill="none" stroke="#1f6fe0" stroke-width="9" stroke-linecap="round"/><path d="M30 82L24 94M36 80L34 96" stroke="#ffc21a" stroke-width="4" stroke-linecap="round"/>',
};

const SHADOW = 'rgba(11,42,85,0.38)';

function iconSvg(kind) {
  const p = PAL[kind];
  const id = `c${kind}`;
  const defs = `<defs><linearGradient id="${id}" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset=".55" stop-color="${p.base}"/><stop offset=".55" stop-color="${p.dark}"/></linearGradient></defs>`;
  const main = { body: `url(#${id})`, cap: '#5a6273', label: '#fff', bolt: '#ffc61a' };
  const shadow = { body: SHADOW, cap: SHADOW, label: SHADOW, bolt: SHADOW };
  // Aşağıya kaydırılmış koyu siluet = gölge (blur yok: her tarayıcıda aynı)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${defs}<g transform="translate(0 3)">${SHAPES[kind](shadow)}</g>${SHAPES[kind](main)}${DETAIL[kind]}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const ITEM_ICONS = Object.fromEntries(['turbo', 'shield', 'coconut', 'oil', 'gull', 'parrot'].map((k) => [k, iconSvg(k)]));
