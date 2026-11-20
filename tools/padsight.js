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
const g = new G.Game(R, G.MISSIONS.nightjar); g.player.destroy = () => {}; g.mission.drop(); for (let i = 0; i < 60; i++) g.update(1/30);
let now = 0; const tick = n => { for (let i = 0; i < n; i++) { now += 33; G.pad.poll(g, 1/30, now); g.update(1/30); } };
const P = g.player;

// swap into a Mastodon in the air, carrying crates
const M = g.addPlane({loadout:G.stockLoadout('mastodon'), team:0, pos:g.player.pos.clone().add(new THREE.Vector3(0, 300, 0)), q:g.player.q.clone(), speed:70}); M.packages = 3; g.swapPlayer(M);
G.pad.lastUsed = 0; tick(2);
const TOUCH = 17; set(TOUCH, true); tick(1); set(TOUCH, false); tick(2);
console.log('PADSIGHT touchpad opens the bombsight:', !!g.sight);
const h0 = g.sight && g.sight.hdg; pad.axes[0] = 0.9; tick(20); pad.axes[0] = 0; console.log('PADSIGHT left stick steers the run:', g.sight && g.sight.hdg !== h0);
const w0 = g.sight && g.sight.wSpd; pad.axes[3] = -0.9; tick(20); pad.axes[3] = 0; console.log('PADSIGHT right stick sets the wind:', g.sight && g.sight.wSpd > w0, (g.sight.wSpd*2.237).toFixed(0) + ' mph');
set(7, true); tick(2); set(7, false); tick(2); console.log('PADSIGHT trigger drops a crate:', M.packages === 2, (g.crates || []).length);
set(TOUCH, true); tick(1); set(TOUCH, false); tick(2); console.log('PADSIGHT touchpad closes it:', !g.sight);
process.exit(0);
