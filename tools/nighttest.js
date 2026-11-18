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
for (const h of [12, 18, 22]) {
  G.save.open.region = 'rustwater'; G.save.open.hour = h; const g = new G.Game(R, G.MISSIONS.open), O = g.mission;
  g.player.destroy = () => {}; O.drop(); step(g, 30*10);
  // fly the player straight up a beam to see it catch
  const S = O.searchlights && O.searchlights[0]; let caught = false;
  if (S) { const P = g.player; for (let i = 0; i < 60 && !caught; i++) { const d = new V3(Math.sin(S.head.rotation.y)*Math.cos(-S.head.rotation.x), Math.sin(-S.head.rotation.x), Math.cos(S.head.rotation.y)*Math.cos(-S.head.rotation.x)); P.pos.copy(S.pos).addScaledVector(d, 600); step(g, 2); caught = S.lock > 0; } }
  console.log(`hour ${h} (${g.world.time}): searchlights ${O.searchlights ? O.searchlights.length : 0} · beam catches the plane ${caught}`);
}
console.log(errs ? errs + ' ERRORS' : 'night ok');
