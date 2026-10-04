// Pist önizleme resmi (public/previews/<pist>.jpg, 640x360): headless Chrome + CDP, pistin başından yukarı bakan kamera.
// Kullanım: [Q=medium] node cdp-preview.mjs <pist> [f0=0.08] [f1=0.14] [yukseklik=14] [bakisYuksekligi=22]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const [track = 'palmCove', f0 = 0.08, f1 = 0.14, up = 14, look = 22] = process.argv.slice(2);
const port = 9333 + Math.floor(Math.random() * 300);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tt-cdp-'))}`, '--window-size=412,820',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run', 'about:blank',
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
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 820, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: `http://localhost:3000/?q=${process.env.Q ?? 'low'}&nopause` });
await sleep(9000);
const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async()=>{
  const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const T=window.__tt;
  const click=(f)=>{const b=[...document.querySelectorAll('button')].find(f); b&&b.click();};
  click(b=>b.dataset.go==='quick'&&b.offsetParent); await sl(400);
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(150);
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(300);
  const tb=document.querySelector('.tt-track[data-track="${track}"]'); tb&&tb.click(); await sl(4000);
  click(b=>b.dataset.go==='wiz-next'&&b.offsetParent); await sl(300);
  click(b=>b.dataset.go==='start'&&b.offsetParent); await sl(5000);
  const {THREE,renderer,scene}=T; const cl=T.track.centerline; const at=(f)=>cl[Math.round(cl.length*f)%cl.length];
  const p=at(${f0}), q=at(${f1}); const cam=new THREE.PerspectiveCamera(55,16/9,0.5,2500);
  cam.position.set(p.x,p.y+${up},p.z); cam.lookAt(q.x,q.y+${look},q.z);
  const ps=renderer.getSize(new THREE.Vector2()), pr=renderer.getPixelRatio();
  renderer.setPixelRatio(1); renderer.setSize(640,360,false); renderer.render(scene,cam);
  const url=renderer.domElement.toDataURL('image/jpeg',0.82);
  renderer.setPixelRatio(pr); renderer.setSize(ps.x,ps.y,false); return url; })()` });
writeFileSync(`public/previews/${track}.jpg`, Buffer.from(String(r.result?.result?.value).split(',')[1], 'base64'));
chrome.kill(); process.exit(0);
