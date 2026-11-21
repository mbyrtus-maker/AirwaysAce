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
  const toHook = g => { const s = g.ships.find(x => x.team === 0 && x.obj.userData.trapeze) || g.ships[0], P = g.player, R = s.worldPoint(new V3(0, -43.5, -22), new V3()), F = new V3(Math.sin(s.heading), 0, Math.cos(s.heading));
    P.pos.copy(R).addScaledVector(F, -6).addScaledVector(P.up, -1.6); P.q.setFromUnitVectors(new V3(0, 0, 1), F); P.axes(); P.speed = 25; P.vel.copy(F).multiplyScalar(25); g.homePrev = undefined; };
  const go = async (g, who, chassis) => {
    for (let i = 0; i < 6 && !g.redocking; i++) { toHook(g); await run(g, 0.3); }
    log(who, 'on the hook', !!g.redocking); await run(g, 3);
    log(who, 'in hangar', !!g.inHangar, '| flight still running', g.running, '| game on', !g.done);
    if (!g.inHangar) return;
    G.UI.L = G.stockLoadout(chassis); G.UI.hangarLaunch();
    log(who, 'launched in', g.player.L.chassis, '| in hangar', !!g.inHangar, '| frozen', g.player.frozen);
  };
  if (role === 'host') {
    G.Net.hostGame('TEST');
    while (!G.Net.links.length || !G.Net.links[0].load) await sleep(50);
    G.save.open.region = 'keys'; G.save.open.hour = 12; G.save.open.wing = false; const g = new G.Game(R, G.MISSIONS.open); G.game = g; g.player.destroy = () => {}; g.mission.drop();
    await run(g, 3); await go(g, 'HOST', 'mantis'); await run(g, 7.5);
    const L = G.Net.links[0]; log('RESULT host: guest stand-in flies', L.proxy ? L.proxy.L.chassis : 'none'); await sleep(300); process.exit(0);
  } else {
    await sleep(400); G.save.callsign = 'Guesty'; G.Net.joinGame('TEST');
    while (!G.game) await sleep(50);
    const g = G.game; await sleep(100); g.mission.drop();
    await run(g, 8); const H = () => [...g.netPlanes.values()].find(p => p.remote && p.remote.id === 'host' && p.alive);
    log('GUEST sees host in', H() ? H().L.chassis : 'none');
    await go(g, 'GUEST', 'grackle'); await run(g, 2);
    log('RESULT guest sees host in', H() ? H().L.chassis : 'none'); process.exit(0);
  }
})().catch(e => { console.log(role, 'CRASH', e.stack); process.exit(1); });
