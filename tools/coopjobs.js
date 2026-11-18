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
const order = ['data', 'sfx', 'world', 'models', 'planes', 'combat', 'ai', 'audio', 'hud', 'game', 'traffic', 'story', 'open', 'story2', 'net', 'pad', 'keys', 'ui', 'weather', 'ach'];
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
async function run(g, secs, every){ const t0 = Date.now(); let last = Date.now(), i = 0; while (Date.now() - t0 < secs*1000) { const now = Date.now(); g.update(Math.min(0.05, (now - last)/1000) || 1/60); last = now; if (every) every(g, i++); await sleep(4); } }
(async () => {
  const JOB = id => G.JOBS.find(j => j.id === id);
  if (role === 'host') {
    G.Net.hostGame('TEST');
    while (!G.Net.links.length || !G.Net.links[0].load) await sleep(50);
    G.save.open.region = 'badlands'; G.save.open.hour = 11;
    const g = new G.Game(R, G.MISSIONS.open); g.player.destroy = () => {}; g.mission.drop();
    await sleep(1500);
    // the host takes a different job of its own at the same time
    let hostStarted = false, killed = 0;
    await run(g, 44, (g, i) => {
      if (!hostStarted && g.t > 3 && g.mission.phase === 1) { hostStarted = true; g.mission.startJob(JOB(process.env.HJ || 'kate_night')); log('host job:', g.mission.job && g.mission.job.def.title); }
      const L = G.Net.links[0]; if (!L) return;
      if (i % 250 === 0) log(`t=${g.t.toFixed(1)} planes=${g.planes.length} guestJobPlanes=${L.spawned ? [...L.spawned].filter(p => p.alive).length : 0} routes=${L.spawned ? [...L.spawned].filter(p => { const pl = g.pilots.find(x => x.p === p); return pl && pl.route; }).length : 0} hostJob=${g.mission.job ? g.mission.job.def.id : '-'}`);
      // after a while, shoot down the guest's bounty planes as the guest
      if (g.t > 20 && L.spawned && L.proxy) for (const p of L.spawned) if (p.alive && !p.invuln) { p.damage(99999, 0, G.AMMO.slug, L.proxy); killed++; }
    });
    log('host killed for guest', killed, 'host job still', g.mission.job ? g.mission.job.def.id : 'done/none');
    g.end(g.mission.result(g, 'success')); await sleep(1500); process.exit(0);
  } else {
    await sleep(400);
    let dbg = null; G.UI.debrief = (g, r) => { dbg = r; };
    const banners = []; const b0 = G.HUD.banner; G.HUD.banner = (a, b) => { if (a) banners.push(a + (b ? ' / ' + b : '')); return b0(a, b); };
    G.Net.joinGame('TEST');
    while (!G.game) await sleep(50);
    const g = G.game; await sleep(100); g.mission.drop();
    const O = g.realMission, cash0 = G.save.cash; let phase = 0, raceDone = false;
    await run(g, 46, (g, i) => {
      const P = g.player;
      if (phase === 0 && O.phase === 1 && g.t > 4) { phase = 1; O.startJob(JOB('pratt_bounty')); log('guest job:', O.job.def.title); const at = O.P.hideout; P.pos.set(at.x + 800, at.y + 400, at.z); P.frozen = false; }
      if (phase === 1 && !O.job) { phase = 2; log('bounty finished; guest cash +', G.save.cash - cash0); O.startJob(JOB('kate_canyon')); O.job.begin(); }
      if (phase === 2 && O.job && i % 250 === 0) log('race rivals', O.job.rivals.length, 'bound', O.job.rivals.filter(r => r.p.nid).length, 'rival wp', O.job.rivals.map(r => r.pl.wp).join('/'));
      if (O.job && O.job.def.type === 'race' && !O.job.started) { const r0 = O.job; }
      if (i % 250 === 0) log(`t=${g.t.toFixed(1)} job=${O.job ? O.job.def.id : '-'} foes=${O.job && O.job.foes ? O.job.foes.filter(p => p.alive).length + '/' + O.job.foes.length + ' bound ' + O.job.foes.filter(p => p.nid).length : ''} puppets=${g.netPlanes.size}`);
      if (dbg) return;
    });
    log('banners', banners.join(' | '));
    log('debrief', dbg ? JSON.stringify({kind:dbg.kind, cash:dbg.cash, shown:dbg.shown}) : 'none');
    process.exit(0);
  }
})().catch(e => { console.log(role, 'CRASH', e.stack); process.exit(1); });
