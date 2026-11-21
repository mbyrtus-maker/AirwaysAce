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
for (const way of ['forward', 'backward']) {
  const g = new G.Game(R, G.MISSIONS.c2m3), M = g.mission, P = g.player; g.update(1/30);
  M.stage = 'mileA';
  const [a, b] = M.mile.map(r => r.pos), from = way === 'forward' ? a : b, to = way === 'forward' ? b : a, dir = to.clone().sub(from).normalize();
  P.onGround = false; P.engineDead = false; P.pos.copy(from).addScaledVector(dir, -300); P.q.setFromUnitVectors(new V3(0, 0, 1), dir); P.axes(); P.speed = 120; P.throttle = 1; P.vel.copy(dir).multiplyScalar(120);
  const log = [];
  for (let i = 0; i < 30*30 && M.stage !== 'stunts'; i++) { P.pos.addScaledVector(dir, 120/30); P.q.setFromUnitVectors(new V3(0, 0, 1), dir); P.axes(); P.speed = 120; P.vel.copy(dir).multiplyScalar(120); M.update(g, 1/30); g.t += 1/30; if (!log.includes(M.stage)) log.push(M.stage); }
  console.log(way.padEnd(8), 'stages:', log.join(' → '), '| mile mph', M.mileMph, '| markers then', g.markers.map(m => m.label).join(','));
}
