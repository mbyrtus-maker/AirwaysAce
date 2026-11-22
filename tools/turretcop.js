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
const g = new G.Game(R, G.MISSIONS.c3m1); g.mission.drop(); for (let i = 0; i < 30; i++) g.update(1/30);
const ch = Object.keys(G.TURRET_MOUNTS)[0];
const L = Object.assign(G.stockLoadout(ch), {turrets:[{cal:'30'}]});
const P0 = g.player, P = g.addPlane({loadout:L, team:0, name:'Me', pos:P0.pos.clone(), q:P0.q.clone(), speed:60}); g.swapPlayer(P, {keepOld:false});
const tests = [['cop, calm', {police:true}, false], ['cop, hot', {police:true}, true], ['bandit', {}, false]];
for (const [label, flags, hot] of tests) {
  G.policeHostile = hot;
  const foe = g.addPlane({loadout:G.stockLoadout('vandal'), team:flags.police ? 3 : 1, name:'X', pos:P.pos.clone().add(new THREE.Vector3(0, 5, -60).applyQuaternion(P.q)), q:P.q.clone(), speed:60});
  Object.assign(foe, flags);
  for (const t of P.turrets) { t.tgt = null; t.rest = 0; }
  let fired = false; for (let i = 0; i < 20; i++) { P.updateTurrets(1/30); if (P.turrets.some(t => t.tgt === foe)) fired = true; }
  console.log(label.padEnd(10), 'turret targets it:', fired);
  foe.alive = false;
}
