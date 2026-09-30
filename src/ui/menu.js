import './base.css';
import './menu.css';
import { settings, saveSettings, DIFFICULTY } from '../settings.js';
import { PERSONALITIES } from '../ai.js';
import { pickRivals } from '../kartModel.js';
import { formatTime } from './hud.js';
import { QUALITY, saveQuality } from '../quality.js';
import { CUP_SETS } from '../tracks/index.js';

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

  const toast = (msg) => {
    const el = h(`<div class="tt-toast">${msg}</div>`);
    toastWrap.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  };

  // ---------- Ana menü ----------
  const main = h(`
    <section id="screen-main" class="tt-screen">
      <div class="col">
        <div class="tt-logo enter"><span class="l1">${letters('TURBO')}</span><span class="l2">${letters('TAYFA')}</span></div>
        <p class="tt-tagline enter">Tayfanı topla, adayı fethet!</p>
        <div class="name-row enter">
          <label for="tt-name">Takma adın</label>
          <input id="tt-name" class="tt-input" maxlength="14" placeholder="Pilot" autocomplete="off" />
        </div>
        <div class="buttons enter">
          <button class="tt-btn primary big block" data-go="quick">▶ Hızlı Yarış</button>
          <div class="row2">
            <button class="tt-btn light" data-go="host">Oda Kur</button>
            <button class="tt-btn light" data-go="join">Odaya Katıl</button>
          </div>
        </div>
      </div>
      <div class="corner"><button class="tt-btn ghost icon fs-btn" data-go="fullscreen" aria-label="Tam ekran">⛶</button><button class="tt-btn ghost icon" data-go="settings" aria-label="Ayarlar">⚙</button></div>
      <div class="bubble"><span class="bn"></span><small class="bd"></small></div>
      <div class="controls" aria-label="Kontroller">
        <div class="c-title">Nasıl oynanır? <small>💡 "BAŞLA!" öncesi gaza bas: roket kalkış!</small></div>
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
  nameInput.addEventListener('input', () => saveSettings({ name: nameInput.value.trim().slice(0, 14) }));

  // Letter delays for the logo wave
  main.querySelectorAll('.tt-logo span span').forEach((s, i) => (s.style.animationDelay = `${i * 0.08}s`));

  // ---------- Yarış hazırlığı / çevrimiçi lobi ----------
  const setup = h(`
    <section id="screen-setup" class="tt-screen">
      <div class="topbar">
        <button class="tt-btn ghost icon" data-go="back" aria-label="Geri">←</button>
        <h1>Yarış Hazırlığı</h1>
      </div>
      <div class="left">
        <div class="tt-card enter">
          <h3>Karakterini seç</h3>
          <div class="tt-chars">${characters
            .map((c) => `<button class="tt-char" data-char="${c.id}" title="${c.name}"><img src="${portraits[c.id]}" alt="${c.name}" draggable="false" />${c.name}<span class="taken"></span></button>`)
            .join('')}</div>
          <div class="tt-char-info"><span class="swatch"></span><div><div class="name"></div><div class="desc"></div></div></div>
        </div>
        <div class="tt-card enter">
          <h3>Pilotlar <small class="count"></small><button class="tt-btn light icon reroll" data-go="reroll" aria-label="Rakipleri değiştir" title="Rakipleri değiştir">🔀</button></h3>
          <ul class="tt-slots"></ul>
        </div>
      </div>
      <div class="right">
        <div class="tt-card room-card enter" hidden>
          <div class="room-row">
            <div><div class="tt-label" style="margin:0">Oda kodu</div><div class="room-code"></div></div>
            <button class="tt-btn light icon" data-go="copy-code" aria-label="Kodu kopyala" title="Kodu kopyala">⧉</button>
            <button class="tt-btn light icon" data-go="share-link" aria-label="Linki paylaş" title="Linki paylaş">🔗</button>
          </div>
          <p class="room-hint">Arkadaşların ana menüde <b>Odaya Katıl</b>'a bu kodu yazsın ya da linki açsın.</p>
        </div>
        <div class="tt-card enter">
          <h3>Pist</h3>
          <div class="tt-tracks">${tracks.map((t) => `<button class="tt-track" data-track="${t.id}"><span class="th"><img class="pv" src="${t.preview}" alt="" loading="lazy" /><img class="mm" src="${t.thumb}" alt="" /></span><div><div class="t">${t.name}</div><div class="m">${t.meta}</div><div class="rec"></div></div></button>`).join('')}</div>
          <div class="tt-label">Mod</div>
          <div class="tt-seg" data-seg="mode"><button data-v="race">Yarış</button><button data-v="cup">🏆 Kupa</button><button data-v="bigCup">🏆 Büyük Kupa</button><button data-v="timeTrial">Zamana Karşı</button></div>
          <p class="cup-note" hidden></p>
          <div class="tt-label">Tur sayısı</div>
          <div class="tt-seg" data-seg="laps">${[1, 3, 5].map((n) => `<button data-v="${n}">${n} tur</button>`).join('')}</div>
          <div class="race-only"><div class="tt-label">Bot zorluğu</div>
          <div class="tt-seg" data-seg="difficulty">${Object.entries(DIFFICULTY).map(([k, v]) => `<button data-v="${k}">${v.label}</button>`).join('')}</div></div>
        </div>
        <div class="start-wrap enter"><button class="tt-btn primary big block" data-go="start">YARIŞA BAŞLA ▶</button></div>
      </div>
    </section>`);
  document.body.appendChild(setup);
  if (chatPanel) setup.appendChild(chatPanel);

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

  const renderCharacter = (id) => {
    const c = byId[id];
    setup.querySelectorAll('.tt-char').forEach((b) => b.classList.toggle('on', b.dataset.char === id));
    setup.querySelector('.tt-char-info .name').textContent = c.name;
    setup.querySelector('.tt-char-info .desc').textContent = c.desc;
    setup.querySelector('.tt-char-info .swatch').style.background = c.color;
    main.querySelector('.bubble .bn').textContent = c.name;
    main.querySelector('.bubble .bd').textContent = c.desc;
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
  setup.querySelector('.tt-chars').addEventListener('click', (e) => {
    const b = e.target.closest('[data-char]');
    if (!b || b.classList.contains('is-taken')) return;
    selectCharacter(b.dataset.char);
  });

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
    setup.querySelector('.topbar h1').textContent = online ? 'Oda Lobisi' : 'Yarış Hazırlığı';
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
  const settingsModal = h(`
    <div id="settings" class="tt-modal">
      <div class="tt-card">
        <h2>Ayarlar</h2>
        <div class="tt-label">Grafik kalitesi</div>
        <div class="tt-seg" data-q>${['low', 'medium', 'high'].map((q) => `<button data-v="${q}">${{ low: 'Düşük', medium: 'Orta', high: 'Yüksek' }[q]}</button>`).join('')}</div>
        <p class="q-note" style="font-size:13px;font-weight:700;opacity:.6;margin:6px 2px 0;display:none">Kalite değişikliği sayfa yenilenince uygulanır.</p>
        <label class="tt-toggle">Kamera sarsıntısı<input type="checkbox" data-set="shake" /><span class="sw"></span></label>
        <label class="tt-toggle">FPS göstergesi<input type="checkbox" data-set="showFps" /><span class="sw"></span></label>
        <label class="tt-toggle">Dokunmatikte otomatik gaz<input type="checkbox" data-set="autoGas" /><span class="sw"></span></label>
        <div class="tt-label">Ses</div>
        <label class="tt-range">Müzik<input type="range" min="0" max="1" step="0.05" data-vol="musicVolume" /></label>
        <label class="tt-range">Efektler<input type="range" min="0" max="1" step="0.05" data-vol="sfxVolume" /></label>
        <div class="tt-label">Kontroller</div>
        ${KEYS_HELP}
        <div class="stack"><button class="tt-btn block" data-go="settings-done">Tamam</button></div>
      </div>
    </div>`);
  document.body.appendChild(settingsModal);
  let pendingQuality = QUALITY.name;
  const syncQuality = () => {
    settingsModal.querySelectorAll('[data-q] button').forEach((b) => b.classList.toggle('on', b.dataset.v === pendingQuality));
    settingsModal.querySelector('.q-note').style.display = pendingQuality !== QUALITY.name ? 'block' : 'none';
    settingsModal.querySelector('[data-go="settings-done"]').textContent = pendingQuality !== QUALITY.name ? 'Kaydet ve yenile' : 'Tamam';
  };
  settingsModal.querySelector('[data-q]').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    pendingQuality = b.dataset.v;
    syncQuality();
  });
  settingsModal.querySelectorAll('[data-set]').forEach((input) => {
    input.checked = settings[input.dataset.set];
    input.addEventListener('change', () => {
      saveSettings({ [input.dataset.set]: input.checked });
      handlers.settingsChanged();
    });
  });
  syncQuality();
  settingsModal.querySelectorAll('[data-vol]').forEach((input) => {
    input.value = settings[input.dataset.vol];
    input.addEventListener('input', () => {
      saveSettings({ [input.dataset.vol]: Number(input.value) });
      handlers.settingsChanged();
    });
  });

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
  const screens = [main, setup];
  let settingsFromPause = false;
  const show = (el) => screens.forEach((s) => s.classList.toggle('show', s === el));

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]')?.dataset.go;
    if (!go) return;
    switch (go) {
      case 'quick':
        show(setup);
        handlers.screen('setup');
        break;
      case 'back':
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
        // Telefonda tam ekran + yatay kilit (destekleniyorsa)
        document.documentElement
          .requestFullscreen?.()
          .then(() => screen.orientation?.lock?.('landscape'))
          .catch(() => {});
        break;
      case 'join':
        joinModal.classList.add('show');
        setTimeout(() => codeInput.focus(), 50);
        break;
      case 'join-confirm':
        if (codeInput.value.length < 4) {
          toast('Oda kodu en az 4 karakter olmalı.');
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
        pendingQuality = QUALITY.name;
        syncQuality();
        settingsModal.classList.add('show');
        break;
      case 'settings-done':
        if (pendingQuality !== QUALITY.name) {
          saveQuality(pendingQuality);
          const url = new URL(location.href);
          url.searchParams.delete('q');
          location.href = url.toString();
          return;
        }
        settingsModal.classList.remove('show');
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
      online = room ? { room, myId } : null;
      renderOnline();
    },
    showLobby() {
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
