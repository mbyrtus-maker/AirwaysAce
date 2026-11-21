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
G.save.open.region = 'rustwater'; G.save.open.hour = 12; G.save.open.wing = false;
const g = new G.Game(R, G.MISSIONS.open); const O = g.mission, rail = O.rail, w = g.world;
for (const a of O.arches) {
  const ax = Math.cos(a.yaw), az = -Math.sin(a.yaw), half = a.len/2 + 4, L2 = a.len/2 + 75;   // a.len = rw - 8; deck half-length L/2 = rw/2 + 75
  let best = null;
  for (let i = 1; i < rail.pts.length; i++) { const p = rail.pts[i - 1], q = rail.pts[i];
    // crossing of the rail segment with the bridge axis line (infinite)
    const s1 = (p.x - a.pos.x)*az - (p.z - a.pos.z)*ax, s2 = (q.x - a.pos.x)*az - (q.z - a.pos.z)*ax;
    if (s1*s2 > 0) continue; const t = s1/(s1 - s2), x = p.x + (q.x - p.x)*t, z = p.z + (q.z - p.z)*t, y = p.y + (q.y - p.y)*t, u = (x - a.pos.x)*ax + (z - a.pos.z)*az;
    if (!best || Math.abs(u) < Math.abs(best.u)) best = {u, y, gy:w.height(x, z, true)}; }
  if (!best) { console.log(a.name.padEnd(28), 'El never crosses its line'); continue; }
  const Lh = (a.len + 8)/2 + 75, rampEnd = Lh + 90, where = Math.abs(best.u) <= Lh ? 'ON THE DECK' : Math.abs(best.u) <= rampEnd ? 'ON THE RAMP' : 'clear of it';
  const structY = Math.abs(best.u) <= Lh ? a.deck : Math.abs(best.u) <= rampEnd ? a.deck - (a.deck - Math.max(1, best.gy))*(Math.abs(best.u) - Lh)/90 : null;
  console.log(a.name.padEnd(28), 'El crosses', Math.round(best.u), 'm from centre (deck ends at', Math.round(Lh), ', ramp at', Math.round(rampEnd) + ')', where, '| El rail y', best.y.toFixed(1), structY != null ? '| bridge road y ' + structY.toFixed(1) + ' → gap ' + (best.y - structY).toFixed(1) + ' m' : '');
}
process.exit(0);
