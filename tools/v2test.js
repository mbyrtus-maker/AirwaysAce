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
const radio = []; const r0 = G.HUD.radio; G.HUD.radio = (w, t) => { radio.push(`${w}: ${t}`); };
G.save.story = {node:'c4m1', flags:{}, log:[]};
function play(id, script, secs = 240){
  const M = G.MISSIONS[id]; let res = null; radio.length = 0;
  const g = new G.Game(R, M); const end0 = g.end.bind(g); g.end = r => { if (!res) res = r; end0(r); };
  const P = g.player; P.destroy = () => {}; g.mission.drop();
  const m = g.mission; let i = 0;
  try {
    for (; i < secs*30 && !res; i++) { P.internal = P.internalMax; P.armor = P.armorMax.slice(); script(g, m, P, i/30); g.update(1/30); }
  } catch (e) { fail(id, e); }
  const st = res ? `${res.kind}${res.flags ? ' ' + JSON.stringify(res.flags) : ''}` : 'NO END';
  console.log(`${id.padEnd(5)} ${(i/30).toFixed(0).padStart(4)}s  ${st}  cover=${Math.round(m.cover)}${m.blown ? ' BLOWN' : ''}`);
  return {res, g, m};
}
const at = (P, v, spd) => { P.pos.copy(v); if (spd !== undefined) P.speed = spd; P.vel.copy(P.fwd).multiplyScalar(P.speed); };
const look = (P, v) => { P.q.setFromUnitVectors(new V3(0, 0, 1), v.clone().sub(P.pos).normalize()); P.axes(); };
const killAll = (g, team, src, filter) => { for (const p of g.planes) if (p.alive && p.team === team && (!filter || filter(p))) p.damage(1e5, 0, G.AMMO.slug, src); };
const which = process.argv[3] || 'all';
const run = (id, ...a) => { if (which === 'all' || which === id) return play(id, ...a); };

// c4m1: gates by teleport, photo the keep, then shoot the navy
run('c4m1', (g, m, P, t) => {
  if (m.stage === 'gates' && t > 3) { const gp = [[-1800, -4380], [-1080, -3800], [-360, -4380], [360, -3800], [1080, -4380], [1800, -3800]][m.gate]; if (gp) at(P, new V3(gp[0], Math.max(g.world.height(gp[0], gp[1]), 0.4) + 24, gp[1])); }
  if (m.stage === 'navy' && !m.secret) { const K = m.P.keep.clone().add(new V3(0, 30, 0)); at(P, K.clone().add(new V3(0, 200, -600))); look(P, K); }
  if (m.stage === 'navy' && m.secret && t > 60) killAll(g, 1, P);
});
// c4m2 spared, with the beacon
run('c4m2', (g, m, P, t) => {
  const Qn = m.queen;
  if (!m.secret && Qn.alive && t > 2) { at(P, Qn.worldPoint(new V3(0, -16, 4), new V3()), 60); }
  if (m.secret && !m.struck && t > 20) Qn.hp = Qn.hpMax*0.4;
  if (m.struck && t > 40) killAll(g, 1, P);
}, 200);
// c4m2 burned
G.save.story.flags = {};
run('c4m2', (g, m, P, t) => { const Qn = m.queen; if (t > 20 && !m.struck) Qn.hp = Qn.hpMax*0.4; if (m.struck && t > 30 && Qn.alive) Qn.damage(1e4, P); if (m.choice) killAll(g, 1, P); }, 200);
// c4m3: chase Dunmore, shoot him when no patrol is near, find the letter
run('c4m3', (g, m, P, t) => {
  const D = m.dun; if (!D) return;
  if (D.alive && t > 8) { const s = m.seenBy(D.pos, 1100); if (!s) D.damage(1e5, 0, G.AMMO.slug, P); }
  if (m.crash && !m.secret) at(P, m.crash.clone().add(new V3(0, 30, 0)), 50);
}, 200);
// c4m3: let him reach the Keep
run('c4m3', () => {}, 200);
// c5m1: signal Hale, the navy takes the Gull
run('c5m1', (g, m, P, t) => {
  if (!m.signal && t > 5) at(P, m.smokeAt.clone());
  if (m.signal && t > 30 && m.gull.alive) m.gull.damage(1e5, P);
}, 200);
// c5m1: defend, the Gull gets through (moved along)
run('c5m1', (g, m, P, t) => { if (t > 10 && m.gull.alive) m.gull.pos.lerp(new V3(m.gull.dest.x, m.gull.pos.y, m.gull.dest.z), 0.01); }, 200);
// c5m2: the Gullet, spare Bess, photo the Leviathan, home to Jawbone
run('c5m2', (g, m, P, t) => {
  const B = m.bess; if (B && B.alive && !m.yielded && t > 5) B.internal = B.internalMax*0.3;
  if (!m.secret && t > 8) { at(P, m.levAt.clone().add(new V3(0, 250, -800))); look(P, m.levAt); }
  else if (m.secret && m.stage === 'gullet') at(P, m.mid.clone(), 50);
  else if (m.stage === 'home') at(P, m.P.jawbone.clone().add(new V3(0, 80, 0)));
}, 200);
// c5m3: pass the book, then let Kit go (stay close)
run('c5m3', (g, m, P, t) => {
  const K = m.kit; if (!K || !K.alive) return;
  if (!m.secret) { at(P, K.pos.clone().addScaledVector(K.right, 30), K.speed); P.q.copy(K.q); P.axes(); }
  else { at(P, K.pos.clone().addScaledVector(K.fwd, -300), K.speed); if (t > 40) K.pos.lerp(m.picket, 0.02); }
}, 260);
// c5m3: shoot her down
run('c5m3', (g, m, P, t) => { const K = m.kit; if (K && K.alive && t > 15) K.damage(1e5, 0, G.AMMO.slug, P); }, 120);
// c6m1: flypast slowly, then the engine beacons
run('c6m1', (g, m, P, t) => {
  if (m.stage === 'flypast' && t > 3) { const fp = [[-1800, 1400], [-900, 1800], [0, 2200], [900, 1800], [1800, 1400]][m.gate]; if (fp) at(P, new V3(fp[0], Math.max(g.world.height(fp[0], fp[1]), 0.4) + 180, fp[1]), 60); }
  if (m.levRise > 0.35) { const E = (m.lev.comps || []).filter(c => c.kind === 'engine'); const c = E.find((c, ci) => !m.done[ci]); if (c) at(P, m.lev.worldPoint(c.pos, new V3()).add(new V3(0, 0, 0)), 60); }
}, 300);
// c6m2: the Margaret gets out (moved along), flak or radio knocked out
run('c6m2', (g, m, P, t) => { if (t > 10) { for (const T of m.T) if (T.alive) g.hitTarget(T, 1e4, P); m.ship.pos.lerp(new V3(m.rv.x, m.ship.pos.y, m.rv.z), 0.004); } }, 300);
// c6m3: knock out the Leviathan, then Brimstone
run('c6m3', (g, m, P, t) => {
  const W = m.lev; if (t > 20 && W.alive && W.comps) { const c = W.comps.find(c => c.alive && (c.kind === 'engine' || c.kind === 'cell')); if (c) W.partDamage(c, 1e5, P); }
  if (m.boss && m.boss.alive && t > 40) m.boss.damage(1e6, 0, G.AMMO.slug, P);
}, 300);
console.log(errs ? errs + ' ERRORS' : 'v2 done');
