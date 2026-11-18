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
G.save.open.region = 'rustwater'; G.save.open.hour = 21;
const t0 = Date.now(); const g = new G.Game(R, G.MISSIONS.open); const O = g.mission;
console.log('built in', Date.now() - t0, 'ms · buildings', O.cityCount, '· chimneys', O.rw.chimneys.length, '· cables', O.rw.cables.length, '· slabs', O.rw.slabs.length, '· balloons', O.rw.balloons.length, '· holders', O.rw.holders.length, '· rail', Math.round(O.rail.len), 'm · train', !!O.train, '· tunnels', O.tunnels.length, '· cavern', !!O.cavern);
console.log('sites', O.sites.map(s => `${s.id}@${Math.round(s.point.x)},${Math.round(s.point.y)},${Math.round(s.point.z)}`).join(' '));
console.log('marks', Object.entries(O.P).filter(([k]) => ['wgcx','prison','rlight','dam','steelworks','gasworks'].includes(k)).map(([k, v]) => `${k}@${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.z)}`).join(' '));
g.player.destroy = () => {}; O.drop(); step(g, 30*40);
console.log('after 40s: police', (O.police || []).filter(p => p.alive).length, 'heat', O.heat, 'train s', Math.round(O.train.s), 'planes', g.planes.length);
// shoot a police plane: heat should rise and they turn hostile
const cop = O.police[0]; if (cop) { cop.damage(30, 0, G.AMMO.slug, g.player); g.onHit(cop, g.player, 30, 0); cop.damage(1e5, 0, G.AMMO.slug, g.player); }
step(g, 30*2); console.log('after shooting a cop: heat', Math.round(O.heat), 'hostile', G.policeHostile);
// blow a gas holder: chain reaction
const h0 = O.rw.holders[0]; g.hitTarget(h0, 9999, g.player); setTimeout(() => {}, 0);
step(g, 30*4); console.log('holders left', O.rw.holders.filter(t => t.alive).length, 'of', O.rw.holders.length, 'heat', Math.round(O.heat));
console.log(errs ? errs + ' ERRORS' : 'rust ok');
let tris = 0, meshes = 0; g.scene.traverse(o => { if (o.isMesh && o.geometry) { meshes++; const gg = o.geometry, n = gg.index ? gg.index.count/3 : (gg.attributes && gg.attributes.position ? gg.attributes.position.count/3 : 0); tris += n*(o.isInstancedMesh ? o.count : 1); } });
console.log('scene: meshes', meshes, 'triangles', Math.round(tris/1000) + 'k');
