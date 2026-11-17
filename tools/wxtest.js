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
for (const region of Object.keys(G.REGIONS)) {
  G.save.open.region = region; G.save.open.hour = 11; G.save.open.weather = null;
  const g = new G.Game(R, G.MISSIONS.open); g.player.destroy = () => {}; g.mission.drop();
  const S = g.weather, seen = [S.id]; S.left = 20;   // short spells so we see a few
  const P = g.player; const p0 = P.pos.clone();
  for (let i = 0; i < 30*150; i++) { g.update(1/30); if (S.id !== seen[seen.length - 1]) seen.push(S.id); if (S.left > 25) S.left = 25; }
  console.log(region.padEnd(9), 'spells:', seen.join(' → '), '| fog far', Math.round(g.scene.fog.far), '| wind', S.wind.length().toFixed(1), 'm/s', '| chart:', G.weather.label(region));
}
G.save.open.region = 'frostback'; G.save.open.weather = {region:'frostback', id:'blizzard', left:200};
const g = new G.Game(R, G.MISSIONS.open); g.mission.drop(); step(g, 60);
console.log('blizzard: fog far', Math.round(g.scene.fog.far), 'of base', Math.round(g.weather.base.far), '| sun', g.world.sun.intensity.toFixed(2), 'of', g.weather.base.sun.toFixed(2), '| dome opacity', g.weather.dome.material.opacity.toFixed(2), '| snow opacity', g.weather.flakes.material.opacity.toFixed(2));
G.advanceHours(3); console.log('after waiting 3 hours:', G.save.open.weather.id);
console.log(errs ? errs + ' ERRORS' : 'weather ok');
