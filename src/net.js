// Sunucu bağlantısı: WebSocket, otomatik yeniden bağlanma, sunucu saati senkronu.
// Oyun mantığı bilmez; mesajları `on(type, fn)` ile dağıtır.

const SESSION_KEY = 'tt-session'; // { code, token } — sayfa yenilenince odaya geri dön

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.offset = 0; // sunucu saati - yerel saat (ms)
    this.rtt = 0;
    this.connected = false;
    this.wanted = false; // bağlı kalmak istiyor muyuz (odadayken true)
    this.retry = 0;
    this.id = null;
    this.code = null;
    this.token = null;
    this.queue = [];
    this.wsKey = null; // bağlantının hangi odaya açıldığı (Cloudflare'de oda başına ayrı sunucu)
    this.pendingKey = null;
    this.perf = null; // () => ({ fps, rtt }): sunucuya bildirilir (bot sürücüsü seçimi)
    this.st = { last: 0, lastSrv: 0, gaps: [], win: [] }; // durum yayını ölçümü
  }

  // Ağ teşhisi: son ~3 sn'de 'states' yayınları (sunucu zaman damgası ile varış aralığı)
  noteStates(msg) {
    const a = performance.now();
    const st = this.st;
    if (st.last) st.win.push({ a, arr: a - st.last, srv: msg.server - st.lastSrv });
    st.last = a;
    st.lastSrv = msg.server;
    while (st.win.length && a - st.win[0].a > 3000) st.win.shift();
  }

  // { hz, srvMax, arrMax } ya da null (yeterli veri yok)
  statsInfo() {
    const w = this.st.win;
    if (w.length < 5 || performance.now() - this.st.last > 1500) return null;
    const span = (w[w.length - 1].a - w[0].a) / 1000 || 1;
    return {
      hz: Math.round((w.length - 1) / span),
      srvMax: Math.round(Math.max(...w.map((x) => x.srv))),
      arrMax: Math.round(Math.max(...w.map((x) => x.arr))),
    };
  }

  on(type, fn) {
    (this.handlers[type] ??= []).push(fn);
  }

  emit(type, msg) {
    for (const fn of this.handlers[type] ?? []) fn(msg);
  }

  serverNow() {
    return performance.timeOrigin + performance.now() + this.offset;
  }

  get session() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  saveSession() {
    try {
      if (this.code && this.token) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: this.code, token: this.token }));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  connect() {
    this.wanted = true;
    if (this.ws && this.ws.readyState <= 1) return;
    // Oda anahtarı: odadaysak onun kodu, katılırken girilen kod, yoksa yeni oda ('new')
    const key = this.code || this.pendingKey || 'new';
    const q = key === 'new' ? 'create=1' : `c=${encodeURIComponent(key)}`;
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?${q}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    this.wsKey = key;
    this.st = { last: 0, lastSrv: 0, gaps: [], win: [] };
    ws.onopen = () => {
      if (this.ws !== ws) return; // bu arada bırakılmış eski bağlantı
      this.connected = true;
      this.retry = 0;
      this.sync();
      // Kopmadan önce odadaysak aynı oyuncu olarak geri dön
      if (this.code && this.token) this.sendNow({ type: 'resume', code: this.code, token: this.token });
      for (const m of this.queue.splice(0)) this.sendNow(m);
      this.emit('open');
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === 'pong') return this.onPong(msg);
      if (msg.type === 'states') this.noteStates(msg);
      if (msg.type === 'welcome') {
        this.id = msg.id;
        this.code = msg.code;
        this.token = msg.token;
        this.saveSession();
      }
      if (msg.type === 'error' && msg.code === 'no-resume') {
        this.code = this.token = null;
        this.saveSession();
      }
      this.emit(msg.type, msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      const was = this.connected;
      this.connected = false;
      if (was) this.emit('disconnect');
      else if (this.wanted) this.emit('connectfail'); // hiç açılamadı
      if (this.wanted) {
        // Artan bekleme ile yeniden dene (0.5s, 1s, 2s … en çok 5s)
        const delay = Math.min(5000, 500 * 2 ** this.retry++);
        setTimeout(() => this.wanted && this.connect(), delay);
      }
    };
  }

  // Açık/bekleyen bağlantıyı yeniden bağlanma denemesi başlatmadan kapat
  dropSocket() {
    if (!this.ws) return;
    this.ws.onclose = null;
    this.ws.close();
    this.ws = null;
    this.connected = false;
    clearInterval(this.syncTimer);
  }

  // Oda ile ilgili mesajlar bağlantı yoksa kuyruğa alınır
  send(msg) {
    if (msg.type === 'join' || msg.type === 'create') {
      const key = msg.type === 'join' ? String(msg.code ?? '').toUpperCase() : 'new';
      this.pendingKey = key;
      // Eski bir oturum (kopmuş oda) kaldıysa yeni oda isteği onu geçersiz kılar; yoksa bağlanırken 'resume' hatası isteği iptal ederdi
      if (this.code) {
        this.code = this.token = this.id = null;
        this.saveSession();
        this.dropSocket();
      } else if (this.ws && this.wsKey !== key) this.dropSocket(); // başka odaya açık bağlantı (oda sunucuları ayrı olabilir)
    }
    if (this.connected) this.sendNow(msg);
    else {
      this.queue.push(msg);
      this.connect();
    }
  }

  sendNow(msg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  // Sık gönderilen, kaybolması sorun olmayan mesajlar (kart durumu)
  sendVolatile(msg) {
    if (this.connected) this.sendNow(msg);
  }

  leave() {
    this.sendNow({ type: 'leave' });
    this.wanted = false;
    this.code = this.token = this.id = null;
    this.saveSession();
    this.queue.length = 0;
    // Kapanışı beklemeden bırak: hemen ardından yeni oda kurulursa eski (kapanmakta olan) bağlantıya yazılıp mesaj kaybolmasın
    this.dropSocket();
  }

  // Saat senkronu: birkaç ping atıp en düşük gecikmeli olanı kullan
  sync() {
    this.samples = [];
    const ping = () => this.sendNow({ type: 'ping', t: performance.now(), ...this.perf?.() });
    for (let i = 0; i < 5; i++) setTimeout(ping, i * 150);
    clearInterval(this.syncTimer);
    this.syncTimer = setInterval(ping, 5000);
  }

  onPong({ t, server }) {
    const nowPerf = performance.now();
    const rtt = nowPerf - t;
    const offset = server - (performance.timeOrigin + t + rtt / 2);
    this.samples.push({ rtt, offset });
    if (this.samples.length > 8) this.samples.shift();
    const best = this.samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    this.offset = best.offset;
    this.rtt = best.rtt;
  }
}
