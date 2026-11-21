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
const B = [...new Set([...(w.bgrid || new Map()).values()].flat())]; console.log('blockers', B.length);
const hits = new Map();
for (const q of rail.pts) for (const b of B) { if (Math.abs(q.x - b.x) < (b.hw || 0) + 6 && Math.abs(q.z - b.z) < (b.hd || 0) + 6 && (b.top ?? 1e9) > q.y - 3) { const k = `${Math.round(b.x)},${Math.round(b.z)} top ${Math.round(b.top)}`; hits.set(k, (hits.get(k) || 0) + 1); } }
console.log('El passes through', hits.size, 'solid things', [...hits.keys()].slice(0, 20).join(' | '));

const near = B.filter(b => Math.hypot(b.x - 1110, b.z - 3176) < 60); console.log(JSON.stringify(near.map(b => ({x:Math.round(b.x), z:Math.round(b.z), hw:b.hw, hd:b.hd, top:Math.round(b.top)}))));
const rp = rail.pts.filter(q => Math.hypot(q.x - 1110, q.z - 3176) < 40).map(q => [Math.round(q.x), Math.round(q.z), Math.round(q.y)]); console.log('rail near', JSON.stringify(rp));
console.log('works', JSON.stringify(Object.fromEntries(Object.entries(O.P || {}).filter(([k, v]) => v && Math.hypot(v.x - 1110, v.z - 3176) < 500).map(([k, v]) => [k, [Math.round(v.x), Math.round(v.z)]]))));
process.exit(0);
