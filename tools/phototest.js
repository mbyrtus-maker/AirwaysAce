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
const R = new Proxy({}, {get:() => () => {}});
const want = {halcyon:'odile_cards', badlands:'pratt_brochure', frostback:'baroness_brochure', keys:'rosa_wish', calavera:'lucien_devil', rustwater:'della_supplement'};
for (const [rid, jid] of Object.entries(want)) {
  G.save.open.region = rid; G.save.open.hour = 12; G.save.open.wing = false;
  const g = new G.Game(R, G.MISSIONS.open); G.game = g; const O = g.mission; O.drop(); for (let i = 0; i < 20; i++) g.update(1/30);
  O.accept(jid); const site = O.sites.find(s => s.contact === G.JOBS.find(j => j.id === jid).contact) || O.sites[0]; O.pending = null; O.startJob(G.JOBS.find(j => j.id === jid), site);
  if (!O.job) { console.log(rid, 'job did not start; pending', !!O.pending); continue; }
  const J = O.job, P = g.player; P.destroy = () => {};
  let got = 0, res = null; const toasts = []; const t0 = G.HUD.toast; G.HUD.toast = m => toasts.push(m);
  for (const s of J.shots) {
    // fly 600 m out, level-ish, nose on the sight, then shoot
    const off = new V3(1, 0, 0.4).normalize().multiplyScalar(Math.min(600, (s.range || 1000)*0.6)); P.pos.copy(s.pos).add(off).setY(Math.max(s.pos.y + 60, O.ground(P.pos.x, P.pos.z) + 80));
    P.q.setFromUnitVectors(new V3(0, 0, 1), s.pos.clone().sub(P.pos).normalize()); P.axes(); P.speed = 50; P.vel.copy(P.fwd).multiplyScalar(50);
    g.update(1/60); g.snapPhoto = true; const r = J.update(1/60); g.snapPhoto = false; if (s.got) got++; if (r) res = r;
  }
  G.HUD.toast = t0;
  console.log(rid.padEnd(10), jid.padEnd(18), 'shots', J.shots.length, '| on film', got, '| done', res ? (res.win ? 'WIN ' + res.medal : 'lost') : 'no', '| misses:', toasts.filter(t => /Too|Nothing/.test(t)).slice(0, 2).join(' / '));
}
process.exit(0);
