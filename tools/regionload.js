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
const rows = [];
for (const id of Object.keys(G.REGIONS)) {
  try {
    G.save.open.region = id; G.save.open.hour = 12; G.save.open.wing = false;
    const t0 = Date.now(), g = new G.Game(R, G.MISSIONS.open); const ms = Date.now() - t0;
    let meshes = 0, inst = 0, tris = 0, shadowCasters = 0, mats = new Set(), lights = 0;
    g.scene.traverse(o => { if (o.isLight) lights++; if (!o.isMesh && !o.isLine && !o.isPoints) return; if (!o.visible) return; meshes++; if (o.castShadow) shadowCasters++; const gm = o.geometry; let t = 0; try { t = gm ? (gm.index ? gm.index.count : (gm.attributes && gm.attributes.position ? gm.attributes.position.count : 0))/3 : 0; } catch (e) {} if (o.isInstancedMesh) { inst++; t *= o.count; } tris += t; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && mats.add(m)); });
    rows.push([G.REGIONS[id].name || id, meshes, inst, Math.round(tris/1000), shadowCasters, mats.size, lights, ms]);
  } catch (e) { rows.push([id, 'ERR ' + e.message.slice(0, 60)]); }
}
console.log('region | meshes | instanced | k-tris | shadow-casters | materials | lights | build ms');
for (const r of rows) console.log(r.join(' | '));
process.exit(0);
