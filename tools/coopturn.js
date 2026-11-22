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
// optional real-world network: LAG ms each way, JIT ms of extra random delay and LOSS (0-1) on position updates (st, snap), which travel unreliably for real; everything else arrives late but in order
const LAG = +(process.env.LAG || 0), JIT = +(process.env.JIT || 0), LOSS = +(process.env.LOSS || 0);
const wrap = s => ({send(o){ s.write(JSON.stringify(o) + '\n'); }, onMessage(fn){ lines(s, m => { if (!LAG && !JIT) return fn(m); const fast = m.t === 'st' || m.t === 'snap'; if (fast && Math.random() < LOSS) return; setTimeout(() => fn(m), LAG + (fast ? Math.random()*JIT : 0)); }); }, onClose(fn){ s.on('close', fn); }, close(){ s.end(); }});
G.Net.transport = {ok:() => true,
  host(code, h){ const srv = netm.createServer(s => h.onConn(wrap(s))); srv.listen(port, () => h.onReady()); return {close(){ srv.close(); }}; },
  join(code, h){ const s = netm.connect(port, '127.0.0.1', () => h.onOpen(wrap(s))); s.on('error', e => h.onError(e.message)); return {close(){ s.end(); }}; }};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let msgs = {}; 
const HITCH = +(process.env.HITCH || 0);   // host only: a stall of this many ms roughly once a second, like a struggling machine
const stall = ms => { const t = Date.now(); while (Date.now() - t < ms); };
async function run(g, secs, every){ const t0 = Date.now(); let last = Date.now(), i = 0; while (Date.now() - t0 < secs*1000) { if (HITCH && role === 'host' && Math.random() < 0.016) stall(HITCH*(0.6 + Math.random()*0.8)); const now = Date.now(); g.update(Math.min(0.05, (now - last)/1000) || 1/60); last = now; if (every) every(g, i++); await sleep(5); } }
(async () => {
  const fly = (g, P, T, A) => {   // really fly: steer onto the lead point with the plane's own physics, full throttle, fire when close to on target
    const mv = 830, d = T.pos.distanceTo(P.pos), t = d/mv, lead = T.pos.clone().addScaledVector(T.vel, t).addScaledVector(P.vel, -t), dir = lead.clone().sub(P.pos).normalize();
    P.steer(dir); P.throttle = d > 250 ? 1 : 0.7; G.dev = G.dev || {}; G.dev.god = true; for (const gn of P.guns) gn.rounds = gn.def.ammo;
    const on = dir.angleTo(P.fwd) < 0.05 && d < 600; g.keys.Mouse0 = on; if (on) A.frames++; A.dist += d; A.n++;
  };
  const chase = (g, P, T, lead) => {   // sit 150 m behind the target along its path, nose on the lead point
    const v = T.vel.length() > 5 ? T.vel.clone().normalize() : T.fwd.clone(); P.pos.copy(T.pos).addScaledVector(v, -150);
    const aim = T.pos.clone().addScaledVector(T.vel, lead ? 150/900 : 0); P.q.setFromUnitVectors(new V3(0, 0, 1), aim.sub(P.pos).normalize()); P.axes();
    P.speed = T.vel.length(); P.vel.copy(P.fwd).multiplyScalar(P.speed); g.keys.Mouse0 = true; for (const gn of P.guns) gn.rounds = gn.def.ammo; P.invuln = true;
  };
  const leadErr = trk => { const e = []; let j = 0; for (let i = 0; i < trk.length; i++) { const [t, p, v] = trk[i]; while (j < trk.length && trk[j][0] < t + 0.4) j++; if (j >= trk.length) break; e.push(p.clone().addScaledVector(v, trk[j][0] - t).distanceTo(trk[j][1])); }
    e.sort((a, b) => a - b); return `median ${e[e.length >> 1].toFixed(1)} m, 90% ${e[Math.floor(e.length*0.9)].toFixed(1)} m (${e.length} samples)`; };
  const turnSum = T => { const f = T.fwd.clone(); return () => { const a = f.angleTo(T.fwd); f.copy(T.fwd); return a; }; };

  if (role === 'solo') {
    const g = new G.Game(R, G.MISSIONS.ambush); g.player.destroy = () => {}; g.mission.drop && g.mission.drop(); for (let i = 0; i < 60; i++) g.update(1/60);
    const P = g.player, T = g.addPlane({loadout:G.stockLoadout('vandal'), team:1, name:'Target', callsign:'Target', pos:P.pos.clone().add(new V3(0, 0, 400)), speed:80, ai:{role:'fighter', skill:0.8}}); T.destroy = () => {};
    let hits = 0; const d0 = T.damage.bind(T); T.damage = function(){ hits++; return d0.apply(T, arguments); };
    const ts = turnSum(T); let turn = 0; const A = {frames:0, dist:0, n:0};
    P.pos.copy(T.pos).addScaledVector(T.fwd, -200); P.q.copy(T.q); P.axes(); P.speed = 80; P.vel.copy(P.fwd).multiplyScalar(80);
    const sh0 = g.playerShots || 0; for (let i = 0; i < 60*20; i++) { fly(g, P, T, A); g.update(1/60); turn += ts(); } const shots = (g.playerShots || 0) - sh0;
    log('RESULT solo: hits', hits, 'of', shots, 'rounds =', (100*hits/Math.max(1, shots)).toFixed(1) + '% | firing frames', A.frames, '| hits per firing second', (hits/(A.frames/60)).toFixed(1), '| avg range', Math.round(A.dist/A.n), 'm | target turned', (turn*57.3).toFixed(0), 'deg'); process.exit(0);
  }
  if (role === 'host') {
    G.Net.hostGame('TEST');
    while (!G.Net.links.length || !G.Net.links[0].load) await sleep(50);
    const L = G.Net.links[0], g = new G.Game(R, G.MISSIONS.ambush); G.game = g; g.player.destroy = () => {}; g.mission.drop && g.mission.drop();
    await run(g, 2);
    const T = g.addPlane({loadout:G.stockLoadout('vandal'), team:1, name:'Target', callsign:'Target', pos:g.player.pos.clone().add(new V3(0, 0, 400)), speed:80, ai:{role:'fighter', skill:0.8}}); T.destroy = () => {};
    let applied = 0, mine = 0; const d0 = T.damage.bind(T); T.damage = function(dmg, f, am, src){ applied++; if (src === g.player) mine++; return d0.apply(T, arguments); };
    const HP = g.player, HA = {frames:0, dist:0, n:0}; HP.pos.copy(T.pos).addScaledVector(T.fwd, -220).add(new V3(30, 10, 0)); HP.q.copy(T.q); HP.axes(); HP.speed = 80; HP.vel.copy(HP.fwd).multiplyScalar(80);
    const ts = turnSum(T); let turn = 0; const trk = [];
    await run(g, 3); await run(g, 20, () => { turn += ts(); trk.push([g.t, T.pos.clone(), T.vel.clone()]); fly(g, HP, T, HA); }); g.keys.Mouse0 = false;
    log('RESULT host pilot: own hits', mine, '| firing frames', HA.frames, '| hits per firing second', (mine/Math.max(1, HA.frames/60)).toFixed(1), '| avg range', Math.round(HA.dist/HA.n), 'm');
    log('RESULT host truth: 0.4 s lead error', leadErr(trk));
    await sleep(1500); log('RESULT host: hits applied to the target', applied, '| claims', JSON.stringify(L.claims || {}), '| target turned', (turn*57.3).toFixed(0), 'deg in 11 s');
    await sleep(300); process.exit(0);
  } else {
    await sleep(400); G.save.callsign = 'Guesty'; G.Net.joinGame('TEST');
    while (!G.game) await sleep(50);
    const g = G.game; await sleep(100); g.mission.drop && g.mission.drop(); await run(g, 2.5);
    let T = null; const t0 = Date.now(); while (!T && Date.now() - t0 < 10000) { await run(g, 0.1); T = [...g.netPlanes.values()].find(p => p.callsign === 'Target'); }
    if (!T) { log('GUEST no target'); process.exit(0); }
    let claims = 0; const s0 = G.Net.host.send.bind(G.Net.host); G.Net.host.send = m => { if (m.t === 'gh') claims++; return s0(m); };
    const P = g.player, A = {frames:0, dist:0, n:0}, trk = []; P.pos.copy(T.pos).addScaledVector(T.fwd, -200); P.q.copy(T.q); P.axes(); P.speed = 80; P.vel.copy(P.fwd).multiplyScalar(80);
    const sh0 = g.playerShots || 0; await run(g, 20, () => { fly(g, P, T, A); trk.push([g.t, T.pos.clone(), T.vel.clone()]); });
    log('RESULT guest puppet: 0.4 s lead error', leadErr(trk));
    const shots = (g.playerShots || 0) - sh0; g.keys.Mouse0 = false; log('RESULT guest: hits found', claims, 'of', shots, 'rounds =', (100*claims/Math.max(1, shots)).toFixed(1) + '% | firing frames', A.frames, '| hits per firing second', (claims/(A.frames/60)).toFixed(1), '| avg range', Math.round(A.dist/A.n), 'm'); await run(g, 6); process.exit(0);
  }
})().catch(e => { console.log(role, 'CRASH', e.stack); process.exit(1); });
