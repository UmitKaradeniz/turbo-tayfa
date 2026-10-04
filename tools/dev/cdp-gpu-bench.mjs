// Gerçek GPU FPS ölçümü (headless Chrome, d3d11, vsync/kare sınırı kapalı). Kullanım: node cdp-gpu-bench.mjs <pist> <q> "<ek sorgu1>" "<ek sorgu2>" ...
// Her yapılandırma ayrı Chrome'da: yarış başlar, 7 sn ısınır, 8 sn kare süresi ölçülür. Boş sorgu = referans.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const [track = 'palmCove', q = 'high', ...cfgs] = process.argv.slice(2);
const W = Number(process.env.W || 1920);
const H = Number(process.env.H || 1080);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(extra) {
  const port = 9333 + Math.floor(Math.random() * 300);
  const dir = mkdtempSync(join(tmpdir(), 'tt-gpu-'));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${W},${H}`,
    '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-gpu-vsync', '--disable-frame-rate-limit',
    '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch {}
    await sleep(250);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description?.slice(0, 300) }; return r.result?.result?.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: Number(process.env.DPR || 1), mobile: false });
  await send('Page.navigate', { url: `http://localhost:3000/?q=${q}&nopause&fixres${extra ? '&' + extra : ''}` });
  await sleep(9000);
  const out = await ev(`(async()=>{
    const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const T=window.__tt; if(!T) return {error:'no __tt'};
    const click=(f)=>{const b=[...document.querySelectorAll('button')].find(f); b&&b.click(); return !!b;};
    window.dispatchEvent(new Event('pointerdown')); await sl(1000);
    click(b=>b.dataset.go==='quick'&&b.offsetParent); await sl(400);
    click(b=>b.parentElement?.dataset.seg==='laps'&&b.dataset.v==='3');
    click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(150);
    click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(300);
    const tb=document.querySelector('.tt-track[data-track="${track}"]'); tb&&tb.click(); await sl(2500);
    click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(300);
    click(b=>b.dataset.go==='start'&&b.offsetParent);
    const t0=performance.now(); while(!(T.race&&T.race.started)&&performance.now()-t0<30000) await sl(100);
    await sl(7000);
    const dts=[]; let last=performance.now(); const end=last+8000;
    await new Promise(res=>{ (function tick(){ const n=performance.now(); dts.push(n-last); last=n; if(n<end) requestAnimationFrame(tick); else res(); })(); });
    dts.shift(); const s=[...dts].sort((a,b)=>a-b); const med=s[Math.floor(s.length/2)]; const p95=s[Math.floor(s.length*0.95)]; const avg=dts.reduce((a,b)=>a+b,0)/dts.length;
    const gl=T.renderer.getContext(); const dbg=gl.getExtension('WEBGL_debug_renderer_info');
    const i=T.renderer.info.render;
    return {fps:+(1000/avg).toFixed(1), medMs:+med.toFixed(2), p95Ms:+p95.toFixed(2), maxMs:+Math.max(...dts).toFixed(1), frames:dts.length, pr:T.renderer.getPixelRatio(), quality:T.QUALITY.name, gpu:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'?', calls:i.calls, tris:i.triangles};
  })()`);
  ws.close(); chrome.kill();
  return { cfg: extra || '(referans)', ...out };
}

for (const c of cfgs.length ? cfgs : ['']) console.log(JSON.stringify(await run(c)));
process.exit(0);
