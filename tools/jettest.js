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
const g = new G.Game(R, G.MISSIONS.ambush); g.mission.drop(); step(g, 10);
for (const ch of ['gallant', 'comet', 'zephyr']) {
  const P = g.addPlane({loadout:G.stockLoadout(ch), team:0, player:true, name:ch, pos:new V3(0, 2000, 0), speed:45}); P.destroy = () => {}; P.throttle = 0; P.spool = 0;
  const lvl = () => { P.q.set(0, 0, 0, 1); P.pos.y = 2000; P.axes(); P.ctrl.pitch = P.ctrl.roll = 0; };
  for (let i = 0; i < 30; i++) { lvl(); P.update(1/30); }
  P.throttle = 1; let t100 = null, t200 = null;
  for (let i = 0; i < 30*120; i++) { lvl(); P.update(1/30); const mph = P.speed/G.MPH; if (!t100 && mph > 150) t100 = i/30; if (!t200 && mph > 250) t200 = i/30; }
  console.log(ch.padEnd(8), 'top', Math.round(P.speed/G.MPH), 'mph · 100→150 mph', t100 ? t100.toFixed(1) + ' s' : '-', '· →250 mph', t200 ? t200.toFixed(1) + ' s' : 'never', '· legs', P.ud.legs.length, '· props', P.ud.props.length);
}
// the award
G.save.story = {node:'c6m3', flags:{}, log:[]}; G.save.owned = ['gallant'];
G.storyCommit({kind:'success', then:'x'}); console.log('after the finale: node', G.save.story.node, '· owns zephyr', G.save.owned.includes('zephyr'));
