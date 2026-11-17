'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
require(path.join(__dirname, 'three-mock.js'));
global.window = global; global.innerWidth = 1600; global.innerHeight = 900; global.devicePixelRatio = 1;
const els = {}; global.document = {getElementById:id => els[id] || (els[id] = Fake()), createElement:() => Fake(), addEventListener(){}, exitPointerLock(){}, pointerLockElement:null, querySelector:() => null, body:Fake()};
global.addEventListener = () => {}; global.requestAnimationFrame = () => 0;
const LS = {}; global.localStorage = {getItem:k => LS[k] ?? null, setItem:(k, v) => { LS[k] = String(v); }, removeItem:k => { delete LS[k]; }};
global.Path2D = function(){ return Fake(); }; global.DOMMatrix = function(){ return Fake(); };
global.fetch = () => Promise.reject(new Error('offline')); global.Audio = function(){ return Fake(); }; global.Image = function(){ return Fake(); };
const dir = process.argv[2];
const order = ['data', 'sfx', 'world', 'models', 'planes', 'combat', 'ai', 'audio', 'hud', 'game', 'traffic', 'story', 'open', 'story2', 'net', 'pad', 'keys', 'ui'];
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
  if (role === 'host') {
    G.Net.hostGame('TEST');
    if (!process.env.LATE) { while (!G.Net.links.length || !G.Net.links[0].load) await sleep(50); log('guest joined:', G.Net.links[0].name, G.Net.links[0].load.chassis); }
    G.save.mission = 'nightjar';
    const MID = process.argv[5] || 'nightjar'; if (MID === 'open') { G.save.open.region = 'keys'; G.save.open.hour = 22; G.save.open.wing = true; } const g = new G.Game(R, G.MISSIONS[MID]); g.player.destroy = () => {}; g.mission.drop();
    let didKill = false;
    await run(g, +(process.argv[6] || 45) - 8, (g, i) => {
      const L = G.Net.links[0], px = L && L.proxy;
      if (i % 300 === 0) log(`t=${g.t.toFixed(1)} planes=${g.planes.length} wingmenAI=${(g.wingmen || []).length} proxy=${px ? 'yes alive=' + px.alive + ' pos=' + px.pos.toArray().map(Math.round) : 'no'} host=${g.player.pos.toArray().map(Math.round)} ship0=${g.ships[0].pos.toArray().map(Math.round)}`);
      if (!didKill && px && g.t > 20) { const e = g.planes.find(p => p.alive && p.team === 1); if (e) { didKill = true; e.damage(99999, 0, G.AMMO.slug, px); log('forced kill credited to guest:', e.callsign); } }
      if (px && g.t > 25 && g.t < 25.2) { const e = g.planes.find(p => p.alive && p.team === 1); if (e) for (let k = 0; k < 5; k++) px.damage(4, 0, G.AMMO.slug, e); }
    });
    log('ending; host kills', g.kills); g.end(g.mission.result(g, 'success'));
    await sleep(1500); process.exit(0);
  } else {
    await sleep(process.env.LATE ? 6000 : 400);
    let start = null; const gm0 = G.Net.guestMsg.bind(G.Net); G.Net.guestMsg = m => { msgs[m.t] = (msgs[m.t] || 0) + 1; return gm0(m); };
    let dbg = null; G.UI.debrief = (g, r) => { dbg = r; };
    G.Net.joinGame('TEST');
    while (!G.game) await sleep(50);
    const g = G.game; await sleep(100);
    log('game built: netGuest', g.netGuest, 'ships', g.ships.length, g.ships.map(s => s.kind).join(','), 'puppets', g.netPlanes.size);
    g.mission.drop();
    const P = g.player; let dmgN = 0; const d0 = P.damage.bind(P); P.damage = (...a) => { dmgN++; return d0(...a); };
    await run(g, +(process.argv[6] || 55), (g, i) => {
      if (i % 300 === 0) { const H = [...g.netPlanes.values()].find(p => p.remote.id === 'host'); log(`t=${g.t.toFixed(1)} puppets=${g.netPlanes.size} alive=${[...g.netPlanes.values()].filter(p => p.alive).length} hostSeenAt=${H ? H.pos.toArray().map(Math.round) : '-'} me=${P.pos.toArray().map(Math.round)} kills=${g.kills} dmgMsgs=${dmgN} internal=${Math.round(P.internal)} ship0=${g.ships[0] && g.ships[0].pos.toArray().map(Math.round)}`); }
      if (dbg) return;
    });
    log('messages', JSON.stringify(msgs)); log('debrief', dbg ? JSON.stringify({kind:dbg.kind, cash:dbg.cash, kills:dbg.kills}) : 'none');
    process.exit(0);
  }
})().catch(e => { console.log(role, 'CRASH', e.stack); process.exit(1); });
