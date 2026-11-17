'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
require(path.join(__dirname, 'three-mock.js'));
global.window = global; global.innerWidth = 1600; global.innerHeight = 900; global.devicePixelRatio = 1;
const els = {}; global.document = {getElementById:id => els[id] || (els[id] = Fake()), createElement:() => Fake(), addEventListener(){}, exitPointerLock(){}, pointerLockElement:null, querySelector:() => null, body:Fake()};
global.addEventListener = () => {}; global.requestAnimationFrame = () => 0;
const LS = {}; global.localStorage = {getItem:k => LS[k] ?? null, setItem:(k, v) => { LS[k] = String(v); }, removeItem:k => { delete LS[k]; }};
global.Path2D = function(){ return Fake(); }; global.DOMMatrix = function(){ return Fake(); };
global.fetch = () => Promise.reject(new Error('offline')); global.Audio = function(){ return Fake(); }; global.Image = function(){ return Fake(); };
const dir = process.argv[2];
const order = ['data', 'sfx', 'world', 'models', 'planes', 'combat', 'ai', 'audio', 'hud', 'game', 'traffic', 'story', 'open', 'story2', 'net', 'pad', 'keys', 'ui', 'weather'];
for (const f of order) vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), {filename:f + '.js'});
const G = global.G, V3 = THREE.Vector3;
let errs = 0; const fail = (where, e) => { errs++; console.log('ERROR in', where, '\n ', e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n  ') : e); };
const R = new Proxy({}, {get:() => () => {}});
G.save.callsign = 'Tester';
function step(g, n, dt = 1/30, hook){ for (let i = 0; i < n; i++) { if (hook) hook(i); g.update(dt); } }
for (const id of ['c1m2b', 'c2m1', 'c2m2', 'c2m4', 'c3m1', 'c3m3', 'c4m2', 'c4m3', 'c5m1', 'c5m2', 'c5m3', 'c6m1', 'c6m2', 'c6m3', 'c1m3', 'c1m1']) {
  const radio = []; const r0 = G.HUD.radio; G.HUD.radio = (w, t) => radio.push(t);
  const g = new G.Game(R, G.MISSIONS[id]); g.player.destroy = () => {}; g.mission.drop && g.mission.drop(); const w0 = g.weather ? g.weather.id : '-';
  step(g, 30*95); G.HUD.radio = r0;
  console.log(id.padEnd(6), 'weather', w0, '->', g.weather ? g.weather.id : '-', radio.some(t => /mist off|storm that|erupting/.test(t)) ? '(scripted change heard)' : '');
}
console.log(errs ? errs + ' ERRORS' : 'ok');
