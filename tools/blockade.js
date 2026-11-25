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
const shoot = process.argv[3] === 'defend';
const g = new G.Game(R, G.MISSIONS.c5m1), M = g.mission; for (let i = 0; i < 10; i++) g.update(1/30); M.drop();
const P = g.player; P.invuln = true; const said = []; const r0 = G.HUD.radio; G.HUD.radio = (w, t) => said.push(w + ': ' + t.slice(0, 70));
const Gu = M.gull, S = M.resolute; let t = 0, h0 = S.heading, torpsAtGull = 0, torpsAtRes = 0, seen = new Set();
while (!g.done && t < 900) {
  P.pos.copy(Gu.pos).add(new THREE.Vector3(0, 120, 0)); P.vel.set(0, 0, 0);
  for (const tp of g.torps || []) { if (!seen.has(tp)) { seen.add(tp); if (tp.target === Gu) torpsAtGull++; if (tp.target === S) torpsAtRes++; } if (shoot && tp.team === 1) tp.hp = 0; }
  if (shoot) for (const p of g.planes) if (p.team === 1 && p.alive && p.pos.distanceTo(Gu.pos) < 600 && Math.random() < 0.01) p.destroy(P, 'gun');
  g.update(1/30); t += 1/30;
  if (Math.abs(t % 60) < 1/30) console.log(`${t.toFixed(0)}s Gull ${(Gu.health()*100).toFixed(0)}% alive ${Gu.alive} · Res heading ${(S.heading - h0).toFixed(2)} dist ${Gu.pos.distanceTo(S.pos).toFixed(0)} cripple ${(S.cripple.got/S.cripple.pool*100).toFixed(0)}% · waves ${M.waves} · foes up ${g.planes.filter(p => p.team === 1 && p.alive).length}`);
}
console.log('END', t.toFixed(0) + 's', 'done', g.done, 'Gull', Gu.alive, (Gu.health()*100).toFixed(0) + '%', 'torps at Gull', torpsAtGull, 'at Resolute', torpsAtRes, 'waves', M.waves);
console.log(said.filter(s => /Gull|fish|Torpedo/i.test(s)).slice(0, 6).join('\n'));
process.exit(0);
