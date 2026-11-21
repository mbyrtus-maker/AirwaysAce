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
const R = new Proxy({}, {get:() => () => {}}); const g = new G.Game(R, G.MISSIONS.ambush); g.update(1/60);
function trial(smooth){
  const p = g.addPlane({loadout:G.stockLoadout('vandal'), team:1, name:'T', callsign:'T', pos:new V3(0, 500, 0), speed:80});
  p.remote = {id:'x'}; p.puppet = true; p.net = {p:new V3(), q:new THREE.Quaternion(), v:new V3(), at:-1}; const clk = {};
  const truth = t => new V3(Math.sin(t*0.2)*400, 500, Math.cos(t*0.2)*400), vel = t => new V3(Math.cos(t*0.2)*80, 0, -Math.sin(t*0.2)*80);
  const q = []; let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
  for (let T = 0; T < 12; T += 1/30) if (rnd() > 0.05) q.push({arrive:T + 0.03 + rnd()*0.09, T});   // 5% lost, 30-120 ms late, uneven
  q.sort((a, b) => a.arrive - b.arrive);
  const t0 = g.t; let qi = 0, last = null, steps = [], err = [];
  for (let f = 0; f < 60*11; f++) {
    const now = f/60;
    while (qi < q.length && q[qi].arrive <= now) { const s = q[qi++], P = truth(s.T), Vv = vel(s.T);
      p.net.p.copy(P); p.net.v.copy(Vv); p.net.at = g.t;
      if (smooth) G.netSample(g, p.net, clk, t0 + s.T, P.x, P.y, P.z, 0, 0, 0, 1, Vv.x, Vv.y, Vv.z); }
    g.t = t0 + now; p.remoteUpdate(1/60);
    if (f > 120) { if (last) steps.push(p.pos.distanceTo(last)*60); err.push(p.pos.distanceTo(truth(now))); }
    last = p.pos.clone();
  }
  const mean = steps.reduce((a, b) => a + b, 0)/steps.length, sd = Math.sqrt(steps.reduce((a, b) => a + (b - mean)**2, 0)/steps.length), jerk = Math.max(...steps.map((s, i) => i ? Math.abs(s - steps[i - 1]) : 0));
  console.log(smooth ? 'NEW' : 'OLD', '| speed on screen', mean.toFixed(1), 'm/s ± ', sd.toFixed(1), '| worst frame-to-frame speed jump', jerk.toFixed(1), '| avg distance behind truth', (err.reduce((a, b) => a + b, 0)/err.length).toFixed(1), 'm');
  g.planes = g.planes.filter(x => x !== p); g.t = t0;
}
trial(false); trial(true);
