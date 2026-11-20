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
  if (role === 'host') {
    G.Net.hostGame('TEST');
    while (!G.Net.links.length || !G.Net.links[0].load) await sleep(50); log('guest joined:', G.Net.links[0].name, G.Net.links[0].load.chassis);
    G.save.open.region = 'keys'; G.save.open.hour = 12; G.save.open.wing = false; const g = new G.Game(R, G.MISSIONS.open); g.player.destroy = () => {}; g.mission.drop();
    const O = g.mission; log('parked spots', (g.parkedSpots || []).map(s => s.label + '#' + s.plane.nid).join(', '));
    let hostTook = false;
    await run(g, 26, (g, i) => {
      const L = G.Net.links[0], px = L && L.proxy;
      if (!hostTook && g.t > 16) {   // the host takes one too
        const sp = g.parkedSpots.find(s => !s.label.includes('Guesty')); if (sp) { const P = g.player; P.pos.copy(sp.plane.pos).add(new V3(20, 0, 0)); P.onGround = true; P.speed = 0; if (O.atSite) O.leave(); g.swapNear = sp; g.key('KeyY', true); g.key('KeyY', false); hostTook = true; log('HOST took', sp.label, '-> flying', g.player.L.chassis); }
      }
    });
    const L = G.Net.links[0];
    log('RESULT host: guest proxy chassis', L.proxy ? L.proxy.L.chassis : 'none', '| guest load', L.load.chassis, '| parked now', g.parkedSpots.map(s => s.label).join(', '));
    await sleep(1500); process.exit(0);
  } else {
    await sleep(400);
    G.Net.joinGame('TEST');
    while (!G.game) await sleep(50);
    const g = G.game; await sleep(100); g.mission.drop(); const own = g.player.L.chassis;
    let took = false, chosen = null;
    await run(g, 22, (g, i) => {
      const spots = (g.parkedSpots || []).filter(s => s.plane.alive && s.plane.parked);
      if (!took && g.t > 6 && spots.length) {
        chosen = chosen || spots[0]; const P = g.player; P.pos.copy(chosen.plane.pos).add(new V3(25, 0, 0)); P.onGround = true; P.speed = 0; P.vel.set(0, 0, 0);
        if (g.t > 8) { g.swapNear = chosen; g.key('KeyY', true); g.key('KeyY', false); took = true; log('GUEST asked for', chosen.label, chosen.plane.L.chassis); }
      }
    });
    log('RESULT guest: was', own, 'now flying', g.player.L.chassis, '| parked seen', (g.parkedSpots || []).filter(s => s.plane.alive && s.plane.parked).map(s => s.label).join(', '));
    process.exit(0);
  }
})().catch(e => { console.log(role, 'CRASH', e.stack); process.exit(1); });
