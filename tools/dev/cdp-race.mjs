// Yarış sırasında JS maliyeti: kare süreleri + CPU profili (GL çağrıları ayrı sayılır). Dev sunucusu :3000'de çalışmalı.
// Kullanım: node tools/dev/cdp-race.mjs [pist=palmCove] [cpuYavaşlatma=1] [kalite=low] [saniye=12]
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const track = process.argv[2] || 'palmCove';
const cpu = Number(process.argv[3] || 1);
const q = process.argv[4] || 'low';
const secs = Number(process.argv[5] || 12);
const port = 9333 + Math.floor(Math.random() * 300);
const dir = mkdtempSync(join(tmpdir(), 'tt-cdp-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--window-size=412,820',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch {}
  await sleep(250);
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.on('open', r));
let id = 0; const pending = new Map();
ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result?.exceptionDetails ? { error: r.result.exceptionDetails.exception?.description } : r.result?.result?.value; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 820, deviceScaleFactor: 1, mobile: true });
if (cpu > 1) await send('Emulation.setCPUThrottlingRate', { rate: cpu });
await send('Page.navigate', { url: `http://localhost:3000/?q=${q}&nopause` });
for (let i = 0; i < 60 && !(await ev('!!window.__tt')); i++) await sleep(1000);
await sleep(2000);
await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 500 });
const res = await ev(`(async()=>{
  const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const T=window.__tt; if(!T) return {error:'no __tt'};
  const click=(f)=>{const b=[...document.querySelectorAll('button')].find(f); b&&b.click(); return !!b;};
  window.dispatchEvent(new Event('pointerdown')); await sl(800);
  click(b=>b.dataset.go==='quick'&&b.offsetParent); await sl(400);
  click(b=>b.parentElement?.dataset.seg==='laps'&&b.dataset.v==='5');
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(150);
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(300);
  const tb=document.querySelector('.tt-track[data-track="${track}"]'); tb&&tb.click();
  let t0=performance.now(); while(performance.now()-t0<30000){ await sl(100); if(T.lastBuild?.id==='${track}') break; } await sl(2500);
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(300);
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(300);
  click(b=>b.dataset.go==='start'&&b.offsetParent);
  t0=performance.now(); while(!(T.race&&T.race.started)&&performance.now()-t0<30000) await sl(50);
  if(!(T.race&&T.race.started)) return {error:'yarış başlamadı'};
  // gaza bas (ok yukarı) + hafif sağ/sol
  const key=(k,type)=>window.dispatchEvent(new KeyboardEvent(type,{key:k,code:k,bubbles:true}));
  key('ArrowUp','keydown'); await sl(1500);
  window.__prof=true; return {ready:true};
})()`);
if (!res?.ready) { console.log(JSON.stringify(res)); ws.close(); chrome.kill(); process.exit(1); }
await send('Profiler.start');
const stat = await ev(`(async()=>{
  const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const frames=[]; let last=performance.now(); let on=true; const long=[];
  try{ new PerformanceObserver(l=>{for(const e of l.getEntries()) long.push(Math.round(e.duration));}).observe({entryTypes:['longtask']}); }catch(e){}
  (function tick(){ const n=performance.now(); frames.push(n-last); last=n; if(on) requestAnimationFrame(tick); })();
  const key=(k,type)=>window.dispatchEvent(new KeyboardEvent(type,{key:k,code:k,bubbles:true}));
  const t0=performance.now(); let side=0;
  while(performance.now()-t0<${secs}*1000){ await sl(700); side=(side+1)%3; key('ArrowLeft','keyup'); key('ArrowRight','keyup'); if(side===1) key('ArrowLeft','keydown'); if(side===2) key('ArrowRight','keydown'); }
  on=false; await sl(100);
  const f=frames.slice(2).sort((a,b)=>a-b); const q=(p)=>Math.round(f[Math.min(f.length-1,Math.floor(f.length*p))]);
  const T=window.__tt; return { frames:f.length, p50:q(0.5), p95:q(0.95), p99:q(0.99), max:Math.round(f[f.length-1]), over50:f.filter(x=>x>50).length, long:long.length, longMax:Math.max(0,...long), calls:T.renderer.info.render.calls, tris:T.renderer.info.render.triangles };
})()`);
const p = (await send('Profiler.stop')).result.profile;
const nodes = new Map(p.nodes.map((n) => [n.id, n])); const tot = {}; let idle = 0, gc = 0, all = 0;
for (let i = 0; i < p.samples.length; i++) {
  const c = nodes.get(p.samples[i]).callFrame; const dt = p.timeDeltas[i] / 1000; all += dt;
  if (c.functionName === '(idle)') { idle += dt; continue; }
  if (c.functionName === '(garbage collector)') gc += dt;
  const k = `${c.functionName || '(anon)'} ${(c.url || '').split('/').slice(-2).join('/').replace(/\?.*$/, '')}:${c.lineNumber}`; tot[k] = (tot[k] || 0) + dt;
}
console.log(`${track} · cpu x${cpu} · ${q}`, JSON.stringify(stat));
console.log(`profil ${Math.round(all)}ms · boşta ${Math.round(idle)}ms · çöp toplama ${Math.round(gc)}ms`);
for (const [k, v] of Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log(Math.round(v), k);
ws.close(); chrome.kill(); process.exit(0);
