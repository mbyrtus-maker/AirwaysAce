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
const order = ['data', 'sfx', 'world', 'models', 'planes', 'combat', 'ai', 'audio', 'hud', 'game', 'traffic', 'story', 'open', 'story2', 'net', 'pad', 'keys', 'ui', 'weather'];
for (const f of order) vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), {filename:f + '.js'});
const G = global.G, V3 = THREE.Vector3;
let errs = 0; const fail = (where, e) => { errs++; console.log('ERROR in', where, '\n ', e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n  ') : e); };
const R = new Proxy({}, {get:() => () => {}});
G.save.callsign = 'Tester';
function step(g, n, dt = 1/30, hook){ for (let i = 0; i < n; i++) { if (hook) hook(i); g.update(dt); } }
const btns = Array.from({length:18}, () => ({pressed:false, value:0}));
const pad = {connected:true, index:0, id:'DualSense Wireless Controller', mapping:'standard', axes:[0, 0, 0, 0], buttons:btns, vibrationActuator:{playEffect:(t, o) => { rumbles.push(o.strongMagnitude); return Promise.resolve(); }}};
let rumbles = []; Object.defineProperty(globalThis, 'navigator', {value:{getGamepads:() => [pad]}, configurable:true});
const set = (i, on) => { btns[i].pressed = on; btns[i].value = on ? 1 : 0; };
G.save.mission = 'ambush'; G.save.open.wing = true;
const g = new G.Game(R, G.MISSIONS.nightjar); g.player.destroy = () => {};
let now = 0; const tick = n => { for (let i = 0; i < n; i++) { now += 33; G.pad.poll(g, 1/30, now); g.update(1/30); } };
const P = g.player;
const rd = () => [G.pad.lx, G.pad.ly, G.pad.rx, G.pad.ry].map(v => v.toFixed(2)).join(' ');
pad.id = 'Mac pad'; pad.mapping = ''; pad.axes = [0, 0, 0, 0, 0, 0]; tick(1);            // the first frame: zeros
pad.axes = [0.02, 0.22, 0.01, -1, 0, -1];                                                 // real values: drifting pitch, a trigger at rest on the aim axis
tick(6); const early = rd();
const ya = g.aimPitch, y0 = P.fwd.y; tick(120); const settled = rd();
console.log('A: first moments', early, '| after 4 s', settled, '| aim pitch moved', (g.aimPitch - ya).toFixed(3), '| nose y', y0.toFixed(2), '->', P.fwd.y.toFixed(2));
pad.axes[1] = 0.95; tick(15); const push = G.pad.ly.toFixed(2); tick(120); const held = G.pad.ly.toFixed(2); pad.axes[1] = 0.22; tick(20);
console.log('B: stick pushed', push, '| held full for 4 s still', held, '| let go', G.pad.ly.toFixed(2));
pad.axes[1] = 0.3; tick(10); const small = G.pad.ly.toFixed(2); pad.axes[1] = 0.22; tick(5);
pad.axes[1] = 0.27; tick(90); console.log('C: small push', small, '| drift wandered to 0.27 and left alone', G.pad.ly.toFixed(2));
