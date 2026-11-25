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
const g = new G.Game(R, G.MISSIONS.c4m3), M = g.mission; for (let i = 0; i < 10; i++) g.update(1/30);
M.drop(); const P = g.player, D = M.dun, K = M.P.keep;
console.log('start: me->Dun', P.pos.distanceTo(D.pos).toFixed(0), 'Dun->Keep', D.pos.distanceTo(K).toFixed(0), 'me->Keep', P.pos.distanceTo(K).toFixed(0));
// chase: point the player at Dunmore at full throttle (nitro off)
let t = 0, best = 1e9, inR = 0, first = 0;
while (t < 200 && D.alive && !g.done) {
  P.throttle = 1; const to = D.pos.clone().sub(P.pos).normalize(); P.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), to); P.vel.copy(to).multiplyScalar(P.speed);
  g.update(1/30); t += 1/30; best = Math.min(best, P.pos.distanceTo(D.pos)); if (P.pos.distanceTo(D.pos) < 350) inR += 1/30; if (inR > 0 && !first) first = t;
  if (Math.abs(t % 10) < 1/30) console.log(t.toFixed(0) + 's', 'gap', P.pos.distanceTo(D.pos).toFixed(0), 'me', P.speed.toFixed(0), 'Dun', D.speed.toFixed(0), 'Dun->Keep', D.pos.distanceTo(K).toFixed(0));
}
console.log('in gun range from', first.toFixed(0) + 's', 'for', inR.toFixed(0) + 's before the Keep'); console.log('end t', t.toFixed(0), 'closest', best.toFixed(0), 'done', g.done, g.result && g.result.kind);
process.exit(0);
