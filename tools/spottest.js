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
const toasts = []; G.HUD.toast = t => toasts.push(t); const radio = []; G.HUD.radio = (w, t) => radio.push(w + ': ' + t);
G.save.open.region = 'rustwater'; G.save.open.hour = 22; const g = new G.Game(R, G.MISSIONS.open), O = g.mission;
g.player.destroy = () => {}; O.drop(); step(g, 30*45);
const S = O.searchlights[3], P = g.player;
const catchOnce = () => { for (let i = 0; i < 90; i++) { const el = -S.head.rotation.x, yaw = S.head.rotation.y; P.pos.copy(S.pos).add(new V3(Math.sin(yaw)*Math.cos(el), Math.sin(el), Math.cos(yaw)*Math.cos(el)).multiplyScalar(700)); step(g, 1); if (S.lock > 0) break; } const ok = S.lock > 0; S.lock = 0; step(g, 30*7); return ok; };
// 1) wanted: a catch calls the police in
O.heat = 20; O.heatQuiet = 0; const h0 = O.heat; const c1 = catchOnce(); console.log('caught?', c1, 'heat now', Math.round(O.heat), 'police', (O.police||[]).length, 'noPolice', O.noPolice); console.log('wanted: heat', h0, '->', Math.round(O.heat), '· hostile', G.policeHostile, '· police targeting you', (O.police || []).filter(p => { const pl = g.pilots.find(x => x.p === p); return pl && pl.target === P; }).length, '·', radio.filter(r => /Police/.test(r)).slice(-1)[0]);
// 2) the photo job: three catches and it's off
O.heat = 0; O.hostileTill = 0; step(g, 30*2); O.startJob(G.JOBS.find(j => j.id === 'della_photo')); let n = 0; while (O.job && n < 4) { catchOnce(); n++; }
console.log('photo job after', n, 'catches: job', O.job ? 'still on' : 'over', '·', radio.filter(r => /Della/.test(r)).slice(-2).join(' | '));
// 3) the smuggling run: a catch brings heat
O.heat = 0; O.hostileTill = 0; O.startJob(G.JOBS.find(j => j.id === 'bucco_run')); catchOnce(); console.log('smuggling: heat', Math.round(O.heat), 'hostile', G.policeHostile);
console.log(errs ? errs + ' ERRORS' : 'spot ok');
