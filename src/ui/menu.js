import './base.css';
import './menu.css';
import { settings, saveSettings, DIFFICULTY } from '../settings.js';
import { PERSONALITIES } from '../ai.js';
import { pickRivals } from '../kartModel.js';
import { formatTime } from './hud.js';
import { QUALITY, saveQuality, saveGfx, GFX_DEFAULTS } from '../quality.js';
import { CUP_SETS } from '../tracks/index.js';
import { enableTilt, applyTiltUI } from '../tilt.js';
import { VEHICLES, vehicleOf, statBar } from '../vehicles.js';
import { toggleFullscreen } from './fullscreen.js';
import { levelInfo, selection, setSelection, achievementList, bumpStat } from '../progress.js';
import { PAINTS, TRAILS } from '../cosmetics.js';

// Menü ekranları: ana menü, yarış hazırlığı, ayarlar, odaya katıl, duraklatma.
// Oyun mantığı bilmez; seçimleri geri çağrılarla (handlers) bildirir.

const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const letters = (text) => [...text].map((c) => `<span>${c}</span>`).join('');

const KEYS_HELP = `
  <div class="tt-keys">
    <kbd>W A S D</kbd><span>Sür (ok tuşları da olur)</span>
    <kbd>Space / Shift</kbd><span>Drift (bırakınca mini-turbo)</span>
    <kbd>E</kbd><span>Item kullan (S basılıyken geriye at)</span>
    <kbd>R</kbd><span>Son checkpoint'e dön</span>
    <kbd>Esc / P</kbd><span>Duraklat</span>
  </div>`;

export function createMenu({ characters, portraits, tracks, handlers, records, chatPanel }) {
  const botTag = (c) => `Bot · ${PERSONALITIES[c.personality]?.label ?? ''}`;
  const byId = Object.fromEntries(characters.map((c) => [c.id, c]));
  // Tek oyunculu yarışta rakipler: kadrodan rastgele 7 sürücü ('🔀' ile değiştirilir)
  let rivalIds = pickRivals(settings.character);
  const rerollRivals = () => {
    rivalIds = pickRivals(settings.character);
    handlers.rivals?.(rivalIds);
    renderSlots();
  };
  const toastWrap = h('<div class="tt-toast-wrap"></div>');
  document.body.appendChild(toastWrap);

  // top: ekranın üstünde, yarı saydam ve küçük (oyun sırasında tuşların önüne gelmesin)
  const topToastWrap = h('<div class="tt-toast-wrap top"></div>');
  document.body.appendChild(topToastWrap);
  const toast = (msg, { top = false } = {}) => {
    const el = h(`<div class="tt-toast${top ? ' soft' : ''}">${msg}</div>`);
    (top ? topToastWrap : toastWrap).appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  };

  // ---------- Ana menü ----------
  const main = h(`
    <section id="screen-main" class="tt-screen">
      <div class="col">
        <div class="tt-logo enter"><span class="l1">${letters('TURBO')}</span><span class="l2">${letters('TAYFA')}</span></div>
        <p class="tt-tagline enter">Tayfanı topla, adayı fethet!</p>
        <div class="lv-row enter" title="Turbo Puan"><span class="lv-badge">Sv <b></b></span><div class="lv-bar"><i></i></div><small class="lv-tp"></small></div>
        <div class="name-row enter">
          <label for="tt-name">Takma adın</label>
          <input id="tt-name" class="tt-input" maxlength="14" placeholder="İsmini yaz" autocomplete="off" />
        </div>
        <div class="name-hint enter" role="alert">✏️ Bir isim belirle</div>
        <div class="buttons enter">
          <button class="tt-btn primary big block" data-go="quick">▶ Hızlı Yarış</button>
          <div class="row2">
            <button class="tt-btn light" data-go="host">Oda Kur</button>
            <button class="tt-btn light" data-go="join">Odaya Katıl</button>
          </div>
          <div class="row2">
            <button class="tt-btn light" data-go="garage">🎨 Garaj</button>
            <button class="tt-btn light" data-go="achievements">🏅 Başarımlar</button>
          </div>
        </div>
      </div>
      <div class="corner"><button class="tt-btn ghost icon fs-btn" data-go="fullscreen" aria-label="Tam ekran">⛶</button><button class="tt-btn ghost icon" data-go="settings" aria-label="Ayarlar">⚙</button></div>
      <div class="bubble"><span class="bn"></span><small class="bd"></small></div>
      <div class="controls" aria-label="Kontroller">
        <div class="c-title">Nasıl oynanır? <small>💡 "BAŞLA!" anında herkes başlangıç turbosu alır</small></div>
        <div class="c-grid">
          <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>Sür (ok tuşları da olur)</span></div>
          <div><kbd>Space</kbd><kbd>Shift</kbd><span>Drift: virajda basılı tut, bırakınca turbo</span></div>
          <div><kbd>E</kbd><span>Item kullan (<kbd>S</kbd> + <kbd>E</kbd> geriye atar)</span></div>
          <div><kbd>1</kbd>–<kbd>6</kbd><span>Emoji tepkisi</span></div>
          <div><kbd>Enter</kbd><span>Sohbet (çevrimiçi)</span></div>
          <div><kbd>R</kbd><span>Son checkpoint'e dön</span></div>
          <div><kbd>Esc</kbd><span>Duraklat</span></div>
        </div>
      </div>
      <div class="maker">Yapımcı <b>cafunify</b></div>
      <div class="credit">3D modeller: Kenney (CC0) · Detaylar CREDITS.md</div>
    </section>`);
  document.body.appendChild(main);
  const nameInput = main.querySelector('#tt-name');
  nameInput.value = settings.name;
  // İsim zorunlu: boşken yarış/oda düğmeleri soluk, altta "Bir isim belirle" uyarısı
  const hasName = () => settings.name.trim().length > 0;
  const refreshNameGate = () => {
    main.classList.toggle('need-name', !hasName());
    for (const b of main.querySelectorAll('[data-go="quick"], [data-go="host"], [data-go="join"]')) b.setAttribute('aria-disabled', hasName() ? 'false' : 'true');
  };
  const demandName = () => {
    if (hasName()) return false;
    toast('Önce bir isim belirle!');
    nameInput.focus();
    nameInput.classList.remove('shake');
    void nameInput.offsetWidth;
    nameInput.classList.add('shake');
    return true;
  };
  nameInput.addEventListener('input', () => {
    saveSettings({ name: nameInput.value.trim().slice(0, 14) });
    refreshNameGate();
  });
  refreshNameGate();

  // Letter delays for the logo wave
  main.querySelectorAll('.tt-logo span span').forEach((s, i) => (s.style.animationDelay = `${i * 0.08}s`));

  // ---------- Yarış hazırlığı / çevrimiçi lobi ----------
  const setup = h(`
    <section id="screen-setup" class="tt-screen">
      <div class="topbar">
        <button class="tt-btn ghost icon" data-go="back" aria-label="Geri">←</button>
        <h1>Yarış Hazırlığı</h1>
        <div class="wiz-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="wiz" data-cur="1">
        <div class="tt-card enter" data-step="1">
          <h3>Karakterini seç</h3>
          <div class="tt-char-info"><span class="swatch"></span><div><div class="name"></div><div class="desc"></div></div></div>
          <div class="tt-chars">${characters
            .map((c) => `<button class="tt-char" data-char="${c.id}" title="${c.name}"><img src="${portraits[c.id]}" alt="${c.name}" draggable="false" />${c.name}<span class="taken"></span></button>`)
            .join('')}</div>
        </div>
        <div class="tt-card enter" data-step="2">
          <h3>Aracını seç</h3>
          <div class="tt-seg tt-veh">${VEHICLES.map((v) => `<button data-veh="${v.id}">${v.name}</button>`).join('')}</div>
          <p class="tt-veh-desc"></p>
          <div class="tt-stats">${[['speed', 'Hız'], ['accel', 'İvme'], ['handling', 'Tutuş'], ['weight', 'Ağırlık']].map(([k, l]) => `<div class="row"><span>${l}</span><i><b data-stat="${k}"></b></i></div>`).join('')}</div>
        </div>
        <div class="tt-card enter" data-step="5">
          <h3>Pilotlar <small class="count"></small><button class="tt-btn light icon reroll" data-go="reroll" aria-label="Rakipleri değiştir" title="Rakipleri değiştir">🔀</button></h3>
          <ul class="tt-slots"></ul>
        </div>
        <div class="tt-card room-card enter" data-step="5" hidden>
          <div class="room-row">
            <div><div class="tt-label" style="margin:0">Oda kodu</div><div class="room-code"></div></div>
            <button class="tt-btn light icon" data-go="copy-code" aria-label="Kodu kopyala" title="Kodu kopyala">⧉</button>
            <button class="tt-btn light icon" data-go="share-link" aria-label="Linki paylaş" title="Linki paylaş">🔗</button>
          </div>
          <p class="room-hint">Arkadaşların ana menüde <b>Odaya Katıl</b>'a bu kodu yazsın ya da linki açsın.</p>
        </div>
        <div class="tt-card enter" data-step="3">
          <h3>Pist seç</h3>
          <p class="host-note" hidden>Pisti oda sahibi seçer.</p>
          <div class="tt-tracks">${tracks.map((t) => `<button class="tt-track" data-track="${t.id}"><span class="th"><img class="pv" src="${t.preview}" alt="" loading="lazy" /><img class="mm" src="${t.thumb}" alt="" /></span><div><div class="t">${t.name}</div><div class="m">${t.meta}</div><div class="rec"></div></div></button>`).join('')}</div>
        </div>
        <div class="tt-card enter" data-step="4">
          <h3>Yarış ayarları</h3>
          <p class="host-note" hidden>Ayarları oda sahibi seçer.</p>
          <div class="tt-label">Mod</div>
          <div class="tt-seg" data-seg="mode"><button data-v="race">Yarış</button><button data-v="cup">🏆 Kupa</button><button data-v="bigCup">🏆 Büyük Kupa</button><button data-v="timeTrial">Zamana Karşı</button></div>
          <p class="cup-note" hidden></p>
          <div class="tt-label">Tur sayısı</div>
          <div class="tt-seg" data-seg="laps">${[1, 3, 5].map((n) => `<button data-v="${n}">${n} tur</button>`).join('')}</div>
          <div class="race-only"><div class="tt-label">Bot zorluğu</div>
          <div class="tt-seg" data-seg="difficulty">${Object.entries(DIFFICULTY).map(([k, v]) => `<button data-v="${k}">${v.label}</button>`).join('')}</div></div>
        </div>
      </div>
      <div class="wiz-bar">
        <button class="tt-btn light" data-go="wiz-prev">◀ Geri</button>
        <button class="tt-btn primary big" data-go="wiz-next">Aracı seç ▶</button>
        <button class="tt-btn primary big" data-go="start">YARIŞA BAŞLA ▶</button>
      </div>
    </section>`);
  document.body.appendChild(setup);
  if (chatPanel) {
    chatPanel.dataset.step = '5';
    setup.querySelector('.wiz').appendChild(chatPanel);
  }

  // Çevrimiçi oda durumu (null = tek oyunculu)
  let online = null; // { room, myId }
  const isHost = () => online && online.room.hostId === online.myId;
  const me = () => online?.room.players.find((p) => p.id === online.myId);

  const slotHtml = (c, name, tag, cls = '') =>
    `<li class="${cls}"><span class="n"></span><img src="${portraits[c.id]}" alt="" /><span>${name}</span><span class="tag">${tag}</span></li>`;

  const renderSlots = () => {
    const list = setup.querySelector('.tt-slots');
    if (!online) {
      const mine = byId[settings.character];
      const name = settings.name ? `${escapeHtml(settings.name)} · ${mine.name}` : mine.name;
      list.innerHTML = [slotHtml(mine, name, 'Sen', 'me'), ...(settings.mode === 'timeTrial' ? [] : rivalIds.map((id) => byId[id]).filter(Boolean).map((c) => slotHtml(c, c.name, botTag(c))))].join('');
      setup.querySelector('.count').textContent = settings.mode === 'timeTrial' ? 'Sen + rekor hayaletin' : '8/8';
      return;
    }
    const { room, myId } = online;
    const taken = new Set(room.players.map((p) => p.character));
    const rows = room.players.map((p) => {
      const tag = !p.connected ? 'kopuk' : p.id === room.hostId ? '👑 Sahip' : p.ready ? '✓ Hazır' : 'Bekliyor';
      const cls = [p.id === myId && 'me', p.ready && 'ready', !p.connected && 'off'].filter(Boolean).join(' ');
      return slotHtml(byId[p.character] ?? characters[0], escapeHtml(p.name), tag, cls);
    });
    const botCount = Math.max(0, 8 - room.players.length);
    const botRow = botCount ? `<li class="bot"><span class="n"></span><span style="font-size:28px;line-height:34px">🤖</span><span>Rastgele ${botCount} bot</span><span class="tag">Yarış başlarken seçilir</span></li>` : '';
    list.innerHTML = [...rows, botRow].join('');
    setup.querySelector('.count').textContent = `${room.players.length} oyuncu + ${botCount} bot`;
  };

  const renderVehicle = () => {
    const v = vehicleOf(settings.vehicle, byId[settings.character]);
    setup.querySelectorAll('[data-veh]').forEach((b) => b.classList.toggle('on', b.dataset.veh === v.id));
    setup.querySelector('.tt-veh-desc').textContent = v.desc;
    for (const [k, val] of Object.entries(v.stats)) setup.querySelector(`[data-stat="${k}"]`).style.width = `${Math.round(statBar(val) * 100)}%`;
  };

  const renderCharacter = (id) => {
    const c = byId[id];
    setup.querySelectorAll('.tt-char').forEach((b) => b.classList.toggle('on', b.dataset.char === id));
    setup.querySelector('.tt-char-info .name').textContent = c.name;
    setup.querySelector('.tt-char-info .desc').textContent = c.desc;
    setup.querySelector('.tt-char-info .swatch').style.background = c.color;
    main.querySelector('.bubble .bn').textContent = c.name;
    main.querySelector('.bubble .bd').textContent = c.desc;
    renderVehicle();
  };

  const selectCharacter = (id, notify = true) => {
    saveSettings({ character: id });
    renderCharacter(id);
    if (notify) handlers.character(id);
    if (!online && notify) rerollRivals();
    else renderSlots();
  };

  const segSyncs = [];
  const bindSeg = (root, key, cast = (v) => v) => {
    root.querySelectorAll(`[data-seg="${key}"]`).forEach((seg) => {
      const value = () => (online ? online.room.settings[key] : settings[key]);
      const sync = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', cast(b.dataset.v) === value()));
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || (online && !isHost())) return;
        const v = cast(b.dataset.v);
        saveSettings({ [key]: v });
        if (online) {
          online.room.settings[key] = v;
          handlers.roomSettings({ [key]: v });
        }
        sync();
      });
      segSyncs.push(() => {
        sync();
        seg.classList.toggle('locked', !!online && !isHost());
      });
      sync();
    });
  };
  bindSeg(setup, 'laps', Number);
  bindSeg(setup, 'difficulty');
  bindSeg(setup, 'mode');
  // Mod değişince: zorluk ve pilot listesi güncellensin
  setup.querySelector('[data-seg="mode"]').addEventListener('click', () => renderOnline());

  // Pist seçimi (çevrimiçide sadece oda sahibi)
  const trackValue = () => (online ? online.room.settings.track : settings.track);
  const renderTracks = () => {
    setup.querySelectorAll('.tt-track').forEach((b) => {
      const r = records?.(b.dataset.track);
      b.querySelector('.rec').textContent = r?.bestLap ? `🏆 En iyi tur ${formatTime(r.bestLap)}` : '';
    });
    setup.querySelectorAll('.tt-track').forEach((b) => b.classList.toggle('on', b.dataset.track === trackValue()));
    setup.querySelector('.tt-tracks').classList.toggle('locked', !!online && !isHost());
  };
  setup.querySelector('.tt-tracks').addEventListener('click', (e) => {
    const b = e.target.closest('[data-track]');
    if (!b || (online && !isHost())) return;
    saveSettings({ track: b.dataset.track });
    if (online) {
      online.room.settings.track = b.dataset.track;
      handlers.roomSettings({ track: b.dataset.track });
    }
    handlers.track(b.dataset.track);
    renderTracks();
  });
  segSyncs.push(renderTracks);
  setup.querySelector('.tt-veh').addEventListener('click', (e) => {
    const b = e.target.closest('[data-veh]');
    if (!b) return;
    saveSettings({ vehicle: b.dataset.veh });
    renderVehicle();
    handlers.vehicle(b.dataset.veh);
  });
  setup.querySelector('.tt-chars').addEventListener('click', (e) => {
    const b = e.target.closest('[data-char]');
    if (!b || b.classList.contains('is-taken')) return;
    selectCharacter(b.dataset.char);
  });

  // ---------- Adımlar: 1 karakter · 2 araç · 3 pist · 4 mod/tur/zorluk · 5 hazır (pilotlar, sohbet, başlat) ----------
  const STEP_TITLES = ['Karakter', 'Araç', 'Pist', 'Mod ve ayarlar', 'Hazır!'];
  const NEXT_LABELS = ['Aracı seç ▶', 'Pist seç ▶', 'Mod ve ayarlar ▶', 'Son adım ▶'];
  const wiz = setup.querySelector('.wiz');
  let step = 1;
  const renderStep = () => {
    wiz.dataset.cur = step;
    setup.dataset.step = step;
    setup.querySelector('.topbar h1').textContent = step === 5 && online ? 'Oda Lobisi' : `${step}/5 ${STEP_TITLES[step - 1]}`;
    setup.querySelectorAll('.wiz-dots i').forEach((d, i) => d.classList.toggle('on', i < step));
    setup.querySelector('[data-go="wiz-prev"]').hidden = step === 1;
    const next = setup.querySelector('[data-go="wiz-next"]');
    next.hidden = step === 5;
    next.textContent = NEXT_LABELS[step - 1] ?? '';
    setup.querySelector('[data-go="start"]').hidden = step !== 5;
  };
  const setStep = (n) => {
    step = Math.max(1, Math.min(5, n));
    renderStep();
    setup.scrollTop = 0;
    wiz.scrollTop = 0;
  };

  const renderStartButton = () => {
    const btn = setup.querySelector('[data-go="start"]');
    btn.disabled = false;
    btn.classList.add('primary');
    btn.classList.remove('light');
    if (!online) {
      btn.textContent = CUP_SETS[settings.mode] ? 'KUPAYI BAŞLAT ▶' : 'YARIŞA BAŞLA ▶';
      return;
    }
    const others = online.room.players.filter((p) => p.id !== online.myId && p.connected);
    const readyCount = others.filter((p) => p.ready).length;
    if (isHost()) {
      const all = readyCount === others.length;
      btn.textContent = all ? (CUP_SETS[online.room.settings.mode] ? 'KUPAYI BAŞLAT ▶' : 'YARIŞI BAŞLAT ▶') : `Hazır bekleniyor (${readyCount}/${others.length})`;
      btn.disabled = !all;
    } else if (me()?.ready) {
      btn.textContent = 'HAZIRSIN ✓ (vazgeç)';
      btn.classList.remove('primary');
      btn.classList.add('light');
    } else {
      btn.textContent = 'HAZIRIM ✓';
    }
  };

  // Lobi görünümünü güncelle (oda mesajı her geldiğinde ve mod değişince)
  const renderOnline = () => {
    renderStep();
    setup.querySelectorAll('.host-note').forEach((n) => (n.hidden = !(online && !isHost())));
    const card = setup.querySelector('.room-card');
    card.hidden = !online;
    if (online) {
      card.querySelector('.room-code').textContent = online.room.code;
      const mine = me();
      if (mine && mine.character !== settings.character) saveSettings({ character: mine.character });
      renderCharacter(mine?.character ?? settings.character);
      const takenByOthers = new Set(online.room.players.filter((p) => p.id !== online.myId).map((p) => p.character));
      setup.querySelectorAll('.tt-char').forEach((b) => b.classList.toggle('is-taken', takenByOthers.has(b.dataset.char)));
    } else {
      setup.querySelectorAll('.tt-char').forEach((b) => b.classList.remove('is-taken'));
      renderCharacter(settings.character);
    }
    segSyncs.forEach((f) => f());
    // Zamana Karşı sadece tek oyunculu; Kupa'da pistler sabit sırayla gelir, pist seçimi gizlenir
    const mode = online ? online.room.settings.mode ?? 'race' : settings.mode;
    setup.querySelector('[data-seg="mode"] [data-v="timeTrial"]').hidden = !!online;
    const cupTracks = CUP_SETS[mode];
    const note = setup.querySelector('.cup-note');
    note.hidden = !cupTracks;
    if (cupTracks) note.innerHTML = `🏆 <b>${mode === 'cup' ? 'Turbo Kupası' : 'Büyük Kupa'}:</b> ${cupTracks.length} pist sırayla yarışılır. Her yarışta sıraya göre puan alırsın (1. = 15 puan), en çok puanı toplayan kupayı kazanır.`;
    setup.querySelector('.tt-tracks').style.display = cupTracks ? 'none' : '';
    setup.querySelectorAll('.race-only').forEach((el) => (el.hidden = !online && mode === 'timeTrial'));
    renderSlots();
    renderStartButton();
    pause.querySelector('[data-go="restart"]').hidden = !!online;
    pause.querySelector('.online-note').hidden = !online;
  };

  // ---------- Ayarlar ----------
  // Grafik ayarları ön ayarın üstüne biner ('Ön ayar' = ön ayar ne diyorsa) ve sayfa yenilenince uygulanır.
  const GFX_ROWS = [
    { key: 'aa', icon: '🧩', label: 'Kenar yumuşatma', opts: [['auto', 'Ön ayar'], ['off', 'Kapalı'], ['fxaa', 'FXAA'], ['smaa', 'SMAA'], ['msaa2', 'MSAA 2x'], ['msaa4', 'MSAA 4x']],
      hints: { auto: 'Cihaza uygun olanı kullanılır.', off: 'En hızlı; kenarlar tırtıklı görünür.', fxaa: 'Çok hafif; kenarları biraz yumuşatır.', smaa: 'FXAA kadar hafif, daha keskin sonuç.', msaa2: 'Net kenarlar; orta ağırlıkta.', msaa4: 'En net kenarlar; zayıf cihazda FPS düşürür.' } },
    { key: 'sharpen', icon: '🔍', label: 'Keskinleştirme', opts: [['auto', 'Ön ayar'], ['off', 'Kapalı'], ['on', 'Açık']],
      hints: { auto: 'FXAA/SMAA ile hafif keskinlik eklenir.', off: 'Görüntü olduğu gibi kalır.', on: 'Bulanıklığı alır, detayları öne çıkarır.' } },
    { key: 'bloom', icon: '✨', label: 'Parlama (bloom)', opts: [['auto', 'Ön ayar'], ['on', 'Açık'], ['off', 'Kapalı']],
      hints: { auto: 'Orta ve üstü kalitede açıktır.', on: 'Nitro ve kıvılcımlar parlar; biraz ağırdır.', off: 'Daha hızlı, daha sade görüntü.' } },
    { key: 'res', icon: '📐', label: 'Çözünürlük', opts: [['auto', 'Ön ayar'], [1, '1x'], [1.25, '1.25x'], [1.5, '1.5x'], [2, '2x']],
      hints: { auto: 'Ekrana ve ön ayara göre seçilir.', 1: 'En hızlı; biraz bulanık olabilir.', 1.25: 'Hafif netlik artışı.', 1.5: 'Dengeli.', 2: 'En net; güçlü ekran kartı ister.' } },
    { key: 'shadows', icon: '🌓', label: 'Gölgeler', opts: [['auto', 'Ön ayar'], ['off', 'Kapalı'], ['mid', 'Orta'], ['high', 'Yüksek']],
      hints: { auto: 'Ön ayara göre.', off: 'En hızlı.', mid: 'Dengeli gölge kalitesi.', high: 'Keskin gölgeler; daha ağır.' } },
    { key: 'decor', icon: '🌲', label: 'Çevre yoğunluğu', opts: [['auto', 'Ön ayar'], ['low', 'Az'], ['mid', 'Orta'], ['high', 'Çok']],
      hints: { auto: 'Ön ayara göre.', low: 'Ağaç, kaya vb. az; hızlı.', mid: 'Dengeli.', high: 'Dolu dolu çevre; daha ağır.' } },
    { key: 'particles', icon: '💨', label: 'Parçacıklar', opts: [['auto', 'Ön ayar'], ['low', 'Az'], ['mid', 'Orta'], ['high', 'Çok']],
      hints: { auto: 'Ön ayara göre.', low: 'Az duman ve kıvılcım; hızlı.', mid: 'Dengeli.', high: 'Bol efekt; daha ağır.' } },
    { key: 'fpsCap', icon: '⏱', label: 'FPS sınırı', opts: [[0, 'Sınırsız'], [60, '60'], [30, '30']],
      hints: { 0: 'Ekranın yenileme hızına kadar çizer.', 60: 'Pil ve ısıyı azaltır.', 30: 'En az pil/ısı; daha az akıcı.' } },
  ];
  const chip = (v, text) => `<button data-v="${v}">${text}</button>`;
  const gfxRowHtml = (r) => `
    <div class="set-row" data-gfx-row="${r.key}">
      <div class="set-lab"><b>${r.icon} ${r.label}</b><small class="hint"></small></div>
      <div class="set-chips" data-gfx="${r.key}">${r.opts.map(([v, t]) => chip(v, t)).join('')}</div>
    </div>`;
  const toggleRow = (icon, label, hint, attr) => `
    <label class="set-row set-toggle">
      <div class="set-lab"><b>${icon} ${label}</b><small>${hint}</small></div>
      <span class="set-sw"><input type="checkbox" ${attr} /><span class="sw"></span></span>
    </label>`;
  const volRow = (icon, label, key) => `
    <label class="set-row set-vol">
      <div class="set-lab"><b>${icon} ${label}</b><output data-out="${key}"></output></div>
      <input type="range" min="0" max="1" step="0.05" data-vol="${key}" />
    </label>`;
  const settingsModal = h(`
    <div id="settings" class="tt-modal">
      <div class="tt-card set-card">
        <div class="set-head"><h2>⚙ Ayarlar</h2><button class="tt-btn light icon set-x" data-go="settings-close" aria-label="Kapat">✕</button></div>
        <div class="set-tabs" role="tablist">
          <button class="on" data-tab="gfx">🎨 Grafik</button>
          <button data-tab="game">🎮 Oyun</button>
          <button data-tab="audio">🔊 Ses</button>
          <button data-tab="keys">⌨ Kontroller</button>
        </div>
        <div class="set-body">
          <section data-pane="gfx">
            ${toggleRow('📊', 'FPS göstergesi', 'Ekranın köşesinde FPS, ping ve ağ bilgisi.', 'data-set="showFps"')}
            <div class="set-now"></div>
            <div class="set-row">
              <div class="set-lab"><b>🎚 Kalite ön ayarı</b><small class="q-info"></small></div>
              <div class="set-chips" data-q>${['auto', 'low', 'medium', 'high'].map((q) => chip(q, { auto: 'Otomatik', low: 'Düşük', medium: 'Orta', high: 'Yüksek' }[q])).join('')}</div>
            </div>
            <div class="tt-label">Görüntü</div>
            ${GFX_ROWS.slice(0, 4).map(gfxRowHtml).join('')}
            <div class="tt-label">Detay</div>
            ${GFX_ROWS.slice(4, 7).map(gfxRowHtml).join('')}
            <div class="tt-label">Performans</div>
            ${toggleRow('📉', 'Dinamik çözünürlük', 'FPS düşünce çözünürlüğü kendiliğinden azaltır.', 'data-gfxbool="dynRes"')}
            ${gfxRowHtml(GFX_ROWS[7])}
            <button class="tt-btn light block set-reset" data-go="gfx-reset">↺ Grafiği varsayılana döndür</button>
          </section>
          <section data-pane="game" hidden>
            ${toggleRow('📳', 'Kamera sarsıntısı', 'Çarpışma ve turboda kamera titrer.', 'data-set="shake"')}
            <div class="tt-label">Dokunmatik ekran</div>
            ${toggleRow('⛽', 'Otomatik gaz', 'Gaza basmana gerek kalmaz.', 'data-set="autoGas"')}
            <div class="tilt-row">${toggleRow('📱', 'Telefonu çevirerek direksiyon', 'Telefonu direksiyon gibi çevir.', 'data-set="tiltSteer"')}</div>
          </section>
          <section data-pane="audio" hidden>
            ${volRow('🎵', 'Müzik', 'musicVolume')}
            ${volRow('🔊', 'Efektler', 'sfxVolume')}
          </section>
          <section data-pane="keys" hidden>${KEYS_HELP}</section>
        </div>
        <div class="set-foot">
          <p class="q-note" hidden>Grafik değişiklikleri sayfa yenilenince uygulanır.</p>
          <button class="tt-btn block" data-go="settings-done" data-main>Tamam</button>
        </div>
      </div>
    </div>`);
  document.body.appendChild(settingsModal);
  const TIER_NAMES = { low: 'Düşük', lowplus: 'Düşük+', medlow: 'Orta−', medium: 'Orta', highlow: 'Yüksek−', high: 'Yüksek' };
  const AA_NAMES = { off: 'AA yok', fxaa: 'FXAA', smaa: 'SMAA', msaa2: 'MSAA 2x', msaa4: 'MSAA 4x' };
  let pendingQuality = QUALITY.mode;
  let pendingGfx = { ...QUALITY.gfx };
  const gfxChanged = () => pendingQuality !== QUALITY.mode || Object.keys(pendingGfx).some((k) => pendingGfx[k] !== QUALITY.gfx[k]);
  const syncQuality = () => {
    settingsModal.querySelectorAll('[data-q] button').forEach((b) => b.classList.toggle('on', b.dataset.v === pendingQuality));
    for (const r of GFX_ROWS) {
      const row = settingsModal.querySelector(`[data-gfx-row="${r.key}"]`);
      row.querySelectorAll('[data-gfx] button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(pendingGfx[r.key])));
      row.querySelector('.hint').textContent = r.hints[pendingGfx[r.key]] ?? '';
    }
    settingsModal.querySelector('[data-gfxbool="dynRes"]').checked = pendingGfx.dynRes !== false;
    const changed = gfxChanged();
    settingsModal.querySelector('.q-note').hidden = !changed;
    settingsModal.querySelector('[data-main]').textContent = changed ? 'Kaydet ve yenile' : 'Tamam';
    const next = QUALITY.pendingTier && QUALITY.pendingTier !== QUALITY.name ? ` · sonraki açılışta: ${TIER_NAMES[QUALITY.pendingTier]}` : '';
    settingsModal.querySelector('.q-info').textContent = pendingQuality === 'auto' ? `Cihaza göre ayarlanır · şu an: ${TIER_NAMES[QUALITY.name]}${next}` : 'Seçtiğin seviye hiç değiştirilmez.';
    settingsModal.querySelector('.set-now').textContent = `Şu an: ${TIER_NAMES[QUALITY.name]} · ${AA_NAMES[QUALITY.aa]}${QUALITY.sharpen ? ' + keskin' : ''} · ${QUALITY.bloom ? 'bloom' : 'bloom yok'} · ${QUALITY.shadows ? 'gölge' : 'gölge yok'} · ${QUALITY.pixelRatio}x`;
  };
  settingsModal.querySelector('[data-q]').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    pendingQuality = b.dataset.v;
    syncQuality();
  });
  settingsModal.addEventListener('click', (e) => {
    const b = e.target.closest('[data-gfx] button');
    if (b) {
      const row = GFX_ROWS.find((r) => r.key === b.parentElement.dataset.gfx);
      pendingGfx[row.key] = row.opts.find(([v]) => String(v) === b.dataset.v)[0];
      syncQuality();
      return;
    }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      settingsModal.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('on', t === tab));
      settingsModal.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== tab.dataset.tab));
      settingsModal.querySelector('.set-body').scrollTop = 0;
    }
  });
  settingsModal.querySelector('[data-gfxbool="dynRes"]').addEventListener('change', (e) => {
    pendingGfx.dynRes = e.target.checked;
    syncQuality();
  });
  settingsModal.querySelectorAll('[data-set]').forEach((input) => {
    input.checked = settings[input.dataset.set];
    input.addEventListener('change', async () => {
      if (input.dataset.set === 'tiltSteer' && input.checked && !(await enableTilt())) {
        input.checked = false; // sensör yok ya da izin verilmedi
        toast('Hareket sensörüne erişilemedi');
      }
      saveSettings({ [input.dataset.set]: input.checked });
      if (input.dataset.set === 'tiltSteer') applyTiltUI();
      handlers.settingsChanged();
    });
  });
  syncQuality();
  settingsModal.querySelectorAll('[data-vol]').forEach((input) => {
    const out = settingsModal.querySelector(`[data-out="${input.dataset.vol}"]`);
    const show = () => (out.textContent = `${Math.round(Number(input.value) * 100)}%`);
    input.value = settings[input.dataset.vol];
    show();
    input.addEventListener('input', () => {
      show();
      saveSettings({ [input.dataset.vol]: Number(input.value) });
      handlers.settingsChanged();
    });
  });
  const openSettings = () => {
    pendingQuality = QUALITY.mode;
    pendingGfx = { ...QUALITY.gfx };
    syncQuality();
    settingsModal.classList.add('show');
  };
  // Grafik değiştiyse kaydedip sayfayı yeniler (true döner); değilse sadece kapatır
  const closeSettings = () => {
    if (gfxChanged()) {
      saveQuality(pendingQuality);
      saveGfx(pendingGfx);
      const url = new URL(location.href);
      url.searchParams.delete('q');
      location.href = url.toString();
      return true;
    }
    settingsModal.classList.remove('show');
    return false;
  };

  // ---------- Odaya katıl ----------
  const joinModal = h(`
    <div id="join" class="tt-modal">
      <div class="tt-card">
        <h2>Odaya Katıl</h2>
        <p style="text-align:center;font-weight:700;opacity:.7;margin:0">Arkadaşının verdiği oda kodunu yaz</p>
        <div class="stack">
          <input class="tt-input code" maxlength="5" placeholder="ABCDE" autocomplete="off" spellcheck="false" />
          <button class="tt-btn primary block" data-go="join-confirm">Katıl</button>
          <button class="tt-btn light block" data-go="join-cancel">Vazgeç</button>
        </div>
      </div>
    </div>`);
  document.body.appendChild(joinModal);
  const codeInput = joinModal.querySelector('input');
  codeInput.addEventListener('input', () => (codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '')));

  // ---------- Duraklatma ----------
  const pause = h(`
    <div id="pause" class="tt-modal">
      <div class="tt-card">
        <h2>Duraklatıldı</h2>
        <div class="stack">
          <button class="tt-btn primary big block" data-go="resume">▶ Devam Et</button>
          <button class="tt-btn light block" data-go="restart">↻ Yeniden Başlat</button>
          <button class="tt-btn light block" data-go="settings">⚙ Ayarlar</button>
          <button class="tt-btn light block" data-go="menu">⌂ Ana Menü</button>
        </div>
        <p class="online-note" hidden>Çevrimiçi yarışta oyun durmaz, kartın yolda kalır.</p>
        <div class="help">${KEYS_HELP}</div>
      </div>
    </div>`);
  document.body.appendChild(pause);

  // ---------- Geçişler ----------
  // Seviye çubuğu (Turbo Puan)
  const refreshLevel = () => {
    const lv = levelInfo();
    main.querySelector('.lv-badge b').textContent = lv.level;
    main.querySelector('.lv-bar i').style.width = `${Math.round(lv.frac * 100)}%`;
    main.querySelector('.lv-tp').textContent = `${lv.cur}/${lv.need} TP`;
  };
  refreshLevel();

  // ---------- Garaj: boya ve iz seçimi (kart canlı sahnede önizlenir) ----------
  const garage = h(`
    <section id="screen-garage" class="tt-screen">
      <div class="topbar">
        <button class="tt-btn ghost icon" data-go="garage-back" aria-label="Geri">←</button>
        <h1>Garaj</h1>
        <span class="g-lv"></span>
      </div>
      <div class="g-panel">
        <p class="g-next"></p>
        <h3>Boya</h3>
        <div class="g-grid" data-kind="paint"></div>
        <h3>İz <small>(drift kıvılcımı ve turbo alevi)</small></h3>
        <div class="g-grid" data-kind="trail"></div>
      </div>
    </section>`);
  document.body.appendChild(garage);
  const renderGarage = () => {
    const lv = levelInfo().level;
    const sel = selection();
    garage.querySelector('.g-lv').innerHTML = `Seviye <b>${lv}</b>`;
    const tile = (kind, d) => {
      const locked = d.lv > lv;
      const on = sel[kind] === d.id && !locked;
      const bg = d.swatch.length > 1 ? `linear-gradient(135deg, ${d.swatch.join(', ')})` : d.swatch[0];
      return `<button class="g-tile${on ? ' on' : ''}${locked ? ' locked' : ''}" data-kind="${kind}" data-id="${d.id}"><i style="background:${bg}"></i><b>${d.name}</b><small>${locked ? `🔒 Sv ${d.lv}` : on ? '✓ Seçili' : ''}</small></button>`;
    };
    garage.querySelector('[data-kind="paint"]').innerHTML = PAINTS.map((d) => tile('paint', d)).join('');
    garage.querySelector('[data-kind="trail"]').innerHTML = TRAILS.map((d) => tile('trail', d)).join('');
    const next = [...PAINTS.map((d) => ({ ...d, what: 'boya' })), ...TRAILS.map((d) => ({ ...d, what: 'iz' }))].filter((d) => d.lv > lv).sort((a, b) => a.lv - b.lv)[0];
    garage.querySelector('.g-next').textContent = next ? `Sıradaki: Seviye ${next.lv} → ${next.name} ${next.what}` : 'Tüm boya ve izler açık!';
  };
  garage.addEventListener('click', (e) => {
    const t = e.target.closest('.g-tile');
    if (!t) return;
    const def = (t.dataset.kind === 'paint' ? PAINTS : TRAILS).find((d) => d.id === t.dataset.id);
    if (def.lv > levelInfo().level) {
      toast(`Seviye ${def.lv}'de açılır. Yarışarak Turbo Puan kazan!`);
      return;
    }
    setSelection(t.dataset.kind, def.id);
    renderGarage();
    handlers.cosmetic?.();
    if (def.id !== 'stock' && def.id !== 'classic') bumpStat('styled').fresh.forEach((a, i) => setTimeout(() => toast(`${a.icon} Başarım: ${a.name} (+${a.tp} TP)`), i * 900));
  });

  // ---------- Başarımlar ----------
  const achScreen = h(`
    <section id="screen-ach" class="tt-screen">
      <div class="topbar">
        <button class="tt-btn ghost icon" data-go="ach-back" aria-label="Geri">←</button>
        <h1>Başarımlar</h1>
        <span class="g-lv ach-count"></span>
      </div>
      <div class="g-panel ach-list"></div>
    </section>`);
  document.body.appendChild(achScreen);
  const renderAch = () => {
    const list = achievementList();
    achScreen.querySelector('.ach-count').innerHTML = `<b>${list.filter((a) => a.done).length}</b>/${list.length}`;
    achScreen.querySelector('.ach-list').innerHTML = [...list].sort((a, b) => b.done - a.done)
      .map((a) => {
        const [cur, max] = a.progress ?? [a.done ? 1 : 0, 1];
        return `<div class="ach${a.done ? ' done' : ''}"><span class="ico">${a.icon}</span><div class="txt"><b>${a.name}</b><small>${a.desc}</small>${a.done ? '' : `<div class="bar"><i style="width:${Math.round((cur / max) * 100)}%"></i></div>`}</div><span class="tp">${a.done ? '✓' : `+${a.tp} TP`}</span></div>`;
      })
      .join('');
  };

  const screens = [main, setup, garage, achScreen];
  let settingsFromPause = false;
  const show = (el) => {
    screens.forEach((s) => s.classList.toggle('show', s === el));
    if (el === main) refreshLevel();
  };

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]')?.dataset.go;
    if (!go) return;
    switch (go) {
      case 'quick':
        if (demandName()) break;
        setStep(1);
        show(setup);
        handlers.screen('setup');
        break;
      case 'garage':
        renderGarage();
        show(garage);
        handlers.screen('garage');
        handlers.cosmetic?.();
        break;
      case 'achievements':
        renderAch();
        show(achScreen);
        handlers.screen('garage');
        break;
      case 'ach-back':
        show(main);
        handlers.screen('main');
        break;
      case 'garage-back':
        show(main);
        handlers.screen('main');
        break;
      case 'wiz-next':
        setStep(step + 1);
        break;
      case 'wiz-prev':
        setStep(step - 1);
        break;
      case 'back':
        if (step > 1) {
          setStep(step - 1);
          break;
        }
        if (online) {
          handlers.leaveRoom();
          break;
        }
        show(main);
        handlers.screen('main');
        break;
      case 'start':
        if (online) {
          handlers.lobbyButton(isHost() ? 'start' : me()?.ready ? 'unready' : 'ready');
          break;
        }
        show(null);
        handlers.start({ character: settings.character, laps: settings.laps, difficulty: settings.difficulty, mode: settings.mode, rivals: rivalIds });
        break;
      case 'reroll':
        rerollRivals();
        break;
      case 'host':
        if (demandName()) break;
        handlers.host();
        break;
      case 'copy-code':
        copy(online?.room.code, 'Oda kodu kopyalandı!');
        break;
      case 'share-link': {
        const url = `${location.origin}/?oda=${online?.room.code}`;
        if (navigator.share) navigator.share({ title: 'Turbo Tayfa', text: 'Turbo Tayfa odama gel!', url }).catch(() => {});
        else copy(url, 'Davet linki kopyalandı!');
        break;
      }
      case 'lobby':
        handlers.toLobby();
        break;
      case 'fullscreen':
        toggleFullscreen();
        break;
      case 'join':
        if (demandName()) break;
        joinModal.classList.add('show');
        setTimeout(() => codeInput.focus(), 50);
        break;
      case 'join-confirm':
        if (codeInput.value.length < 4) {
          toast('Oda kodu en az 4 karakter olmalı.');
          break;
        }
        if (!hasName()) {
          joinModal.classList.remove('show'); // davet linkiyle gelindiyse isim kutusu pencerenin arkasında kalır
          demandName();
          break;
        }
        joinModal.classList.remove('show');
        handlers.join(codeInput.value);
        break;
      case 'join-cancel':
        joinModal.classList.remove('show');
        break;
      case 'settings':
        settingsFromPause = pause.classList.contains('show');
        pause.classList.remove('show');
        openSettings();
        break;
      case 'gfx-reset':
        pendingGfx = { ...GFX_DEFAULTS };
        pendingQuality = 'auto';
        syncQuality();
        break;
      case 'settings-close': // kaydetmeden kapat
        settingsModal.classList.remove('show');
        if (settingsFromPause) pause.classList.add('show');
        break;
      case 'settings-done':
        if (closeSettings()) return;
        if (settingsFromPause) pause.classList.add('show');
        break;
      case 'pause':
        handlers.pause();
        break;
      case 'resume':
        pause.classList.remove('show');
        handlers.resume();
        break;
      case 'restart':
        pause.classList.remove('show');
        handlers.restart();
        break;
      case 'menu':
        pause.classList.remove('show');
        handlers.toMenu();
        break;
      case 'next':
        handlers.nextRace();
        break;
    }
  });

  const copy = (text, msg) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => toast(msg),
      () => toast(text),
    );
  };

  selectCharacter(settings.character in byId ? settings.character : characters[0].id, false);
  renderOnline();
  handlers.rivals?.(rivalIds); // başlangıçtaki rakipler sahnede de aynı olsun

  return {
    toast,
    // room: sunucudan gelen oda durumu (null = tek oyunculu moda dön)
    setOnline(room, myId) {
      if (room && online?.room.code !== room.code) setStep(1); // yeni odaya girildi
      online = room ? { room, myId } : null;
      renderOnline();
    },
    showLobby(toStep = 1) {
      setStep(toStep);
      show(setup);
      handlers.screen('setup');
    },
    openJoin(code = '') {
      codeInput.value = code;
      joinModal.classList.add('show');
      setTimeout(() => codeInput.focus(), 50);
    },
    showMain() {
      show(main);
    },
    refreshRecords() {
      if (!online) {
        rivalIds = pickRivals(settings.character); // yeni yarış için yeni rakipler
        handlers.rivals?.(rivalIds);
      }
      renderOnline();
    },
    showSetup() {
      show(setup);
    },
    hideAll() {
      show(null);
    },
    get pauseOpen() {
      return pause.classList.contains('show') || settingsModal.classList.contains('show');
    },
    showPause() {
      pause.classList.add('show');
    },
    hidePause() {
      pause.classList.remove('show');
      settingsModal.classList.remove('show');
    },
    get onMainScreen() {
      return main.classList.contains('show');
    },
  };
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
