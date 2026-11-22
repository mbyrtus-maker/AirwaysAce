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
for (const [mid, kind] of [['c3m3', 'ship'], ['c9m2', 'ship'], ['c5m1', 'ship'], ['c7m2', 'ship']]) {
  const g = new G.Game(R, G.MISSIONS[mid]); g.player.destroy = () => {}; g.player.invuln = true; g.mission.drop && g.mission.drop(); G.dev = G.dev || {}; G.dev.ammo = true;
  for (let i = 0; i < 14*60; i++) g.update(1/60);
  const F = kind === 'ship' ? g.ships.find(s => s.alive && s.team !== 0) : (g.targets || []).find(t => t.alive && t.team !== 0);
  const hp = () => kind === 'ship' ? Math.round((F.hp || 0) + (F.comps || []).reduce((a, c) => a + Math.max(0, c.hp || 0), 0)) : Math.round(F.hp);
  const h0 = hp(); let hits = 0; const ht = g.hitTarget.bind(g); g.hitTarget = (t, d, s) => { hits++; return ht(t, d, s); };
  for (let i = 0; i < 5*60; i++) { const P = g.player, aim = F.pos.clone().add(new V3(0, kind === 'ship' ? 0 : 2, 0)), dir = new V3(1, 0.25, 0.4).normalize();
    P.pos.copy(aim).addScaledVector(dir, kind === 'ship' ? 260 : 220); P.q.setFromUnitVectors(new V3(0, 0, 1), aim.clone().sub(P.pos).normalize()); P.axes(); P.speed = 40; P.vel.copy(P.fwd).multiplyScalar(40); g.keys.Mouse0 = true; for (const gn of P.guns) gn.rounds = gn.def.ammo; g.update(1/60); }
  console.log('SOLO', mid, kind, 'health', h0, '->', hp(), '| hitTarget calls', hits, '| t.r', F.r, '| y above ground', F.pos.y - g.world.height(F.pos.x, F.pos.z));
}
process.exit(0);
