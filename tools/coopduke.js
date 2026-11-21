'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
require('./three-mock.js');
global.window = global; global.innerWidth = 1600; global.innerHeight = 900; global.devicePixelRatio = 1;
const els = {}; global.document = {getElementById:id => els[id] || (els[id] = Fake()), createElement:() => Fake(), addEventListener(){}, exitPointerLock(){}, pointerLockElement:null, querySelector:() => null, body:Fake()};
global.addEventListener = () => {}; global.requestAnimationFrame = () => 0;
const LS = {}; global.localStorage = {getItem:k => LS[k] ?? null, setItem:(k, v) => { LS[k] = String(v); }, removeItem:k => { delete LS[k]; }};
global.Path2D = function(){ return Fake(); }; global.DOMMatrix = function(){ return Fake(); };
global.fetch = () => Promise.reject(new Error('offline')); global.Audio = function(){ return Fake(); }; global.Image = function(){ return Fake(); };
const dir = process.argv[2];
const order = ['data', 'sfx', 'world', 'models', 'planes', 'combat', 'ai', 'audio', 'hud', 'game', 'traffic', 'story', 'open', 'rust', 'story2', 'story3', 'story4', 'net', 'pad', 'keys', 'ui', 'weather', 'ach'];
for (const f of order) vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), {filename:f + '.js'});
const G = global.G, V3 = THREE.Vector3;
let errs = 0; const fail = (where, e) => { errs++; console.log('ERROR in', where, '\n ', e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n  ') : e); };
const R = new Proxy({}, {get:() => () => {}});
G.save.callsign = 'Tester';
function step(g, n, dt = 1/30, hook){ for (let i = 0; i < n; i++) { if (hook) hook(i); g.update(dt); } }
const role = process.argv[3], port = +process.argv[4], netm = require('net');
const log = (...a) => console.log(`[${role}]`, ...a);
G.save.callsign = role === 'host' ? 'Hosty' : 'Guesty';
const lines = (sock, fn) => { let buf = ''; sock.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l) fn(JSON.parse(l)); } }); };
const wrap = s => ({send(o){ s.write(JSON.stringify(o) + '\n'); }, onMessage(fn){ lines(s, fn); }, onClose(fn){ s.on('close', fn); }, close(){ s.end(); }});
G.Net.transport = {ok:() => true,
  host(code, h){ const srv = netm.createServer(s => h.onConn(wrap(s))); srv.listen(port, () => h.onReady()); return {close(){ srv.close(); }}; },
  join(code, h){ const s = netm.connect(port, '127.0.0.1', () => h.onOpen(wrap(s))); s.on('error', e => h.onError(e.message)); return {close(){ s.end(); }}; }};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let msgs = {}; 
async function run(g, secs, every){ const t0 = Date.now(); let last = Date.now(), i = 0; while (Date.now() - t0 < secs*1000) { const now = Date.now(); g.update(Math.min(0.05, (now - last)/1000) || 1/60); last = now; if (every) every(g, i++); await sleep(5); } }
(async () => {
  const mid = process.argv[5];
  if (role === 'host') {
    G.Net.hostGame('TEST');
    while (!G.Net.links.length || !G.Net.links[0].load) await sleep(50);
    const g = new G.Game(R, G.MISSIONS[mid]); g.player.destroy = () => {}; g.mission.drop();
    await run(g, 9); log('RESULT host Dukes', g.planes.filter(p => /Duke/.test(p.callsign)).length, 'paint', g.mission.dukeP.L.paint.map(c => c.toString(16)).join(','));
    await sleep(300); process.exit(0);
  } else {
    await sleep(400); G.save.callsign = 'Guesty'; G.Net.joinGame('TEST');
    while (!G.game) await sleep(50);
    const g = G.game; await sleep(100); g.mission.drop();
    const M = g.realMission, P = g.player; let boosted = false;
    await run(g, 4);
    const r = M.rings[0]; P.pos.copy(r.pos).addScaledVector(r.n, -15); P.q.setFromUnitVectors(new V3(0, 0, 1), r.n); P.axes(); P.speed = 60; P.nitro = 0;
    await run(g, 2, g => { if (P.nitro > 0) boosted = true; });
    const D = g.planes.filter(p => /Duke/.test(p.callsign));
    log('RESULT guest Dukes', D.length, D.map(p => (p.puppet ? 'puppet ' : 'LOCAL ') + (p.rival ? 'rival ' : 'ENEMY ') + p.L.paint.map(c => c.toString(16)).join(',')).join(' | '), '| boost through ring', boosted, '| BOOST markers', g.markers.filter(k => k.label === 'BOOST').length);
    process.exit(0);
  }
})().catch(e => { console.log(role, 'CRASH', e.stack); process.exit(1); });
