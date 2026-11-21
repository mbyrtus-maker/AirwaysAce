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
for (const id of Object.keys(G.REGIONS)) {
  G.save.open.region = id; G.save.open.hour = 12; G.save.open.wing = true;
  const g = new G.Game(R, G.MISSIONS.open); g.player.destroy = () => {}; g.mission.drop();
  for (let i = 0; i < 120; i++) g.update(1/60);
  const T = []; for (let i = 0; i < 600; i++) { const t = process.hrtime.bigint(); g.update(1/60); T.push(Number(process.hrtime.bigint() - t)/1e6); }
  T.sort((a, b) => a - b); const avg = T.reduce((a, b) => a + b, 0)/T.length;
  console.log(G.REGIONS[id].name.padEnd(20), 'update avg', avg.toFixed(2), 'ms | p95', T[Math.floor(T.length*0.95)].toFixed(2), '| max', T[T.length - 1].toFixed(1), '| planes', g.planes.length, 'ships', g.ships.length);
}
process.exit(0);
