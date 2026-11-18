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
const order = ['data', 'sfx', 'world', 'models', 'planes', 'combat', 'ai', 'audio', 'hud', 'game', 'traffic', 'story', 'open', 'story2', 'story3', 'net', 'pad', 'keys', 'ui', 'weather', 'ach'];
for (const f of order) vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), {filename:f + '.js'});
const G = global.G, V3 = THREE.Vector3;
let errs = 0; const fail = (where, e) => { errs++; console.log('ERROR in', where, '\n ', e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n  ') : e); };
const R = new Proxy({}, {get:() => () => {}});
G.save.callsign = 'Tester';
function step(g, n, dt = 1/30, hook){ for (let i = 0; i < n; i++) { if (hook) hook(i); g.update(dt); } }
const radio = []; G.HUD.radio = (w, t) => { radio.push(`${w}: ${t}`); };
G.save.story = {node:'c7m1', flags:{kit:'free', bess:'spared'}, log:[]};
function play(id, script, secs = 300, o = {}){
  const M = G.MISSIONS[id]; let res = null; radio.length = 0;
  const g = new G.Game(R, M); const end0 = g.end.bind(g); g.end = r => { if (!res) res = r; end0(r); };
  const P = g.player; P.destroy = () => {}; g.mission.drop();
  const m = g.mission; let i = 0;
  try { for (; i < secs*30 && !res; i++) { P.internal = P.internalMax; P.armor = P.armorMax.slice(); if (m.ship && !o.hurtShip) m.ship.hp = m.ship.hpMax; script(g, m, P, i/30); g.update(1/30); } } catch (e) { fail(id, e); }
  const st = res ? `${res.kind}${res.flags && Object.keys(res.flags).length ? ' ' + JSON.stringify(res.flags) : ''}` : 'NO END';
  console.log(`${id.padEnd(5)} ${(i/30).toFixed(0).padStart(4)}s  ${st}  kills=${g.kills} planes=${g.planes.length} weather=${g.weather ? g.weather.id : '-'}${o.note ? ' · ' + o.note(m, g) : ''}`);
  if (process.env.RADIO) console.log('   ' + radio.slice(-6).join('\n   '));
  return {res, g, m};
}
const at = (P, v, spd) => { P.pos.copy(v); if (spd !== undefined) P.speed = spd; P.vel.copy(P.fwd).multiplyScalar(P.speed); };
const look = (P, v) => { P.q.setFromUnitVectors(new V3(0, 0, 1), v.clone().sub(P.pos).normalize()); P.axes(); };
const killAll = (g, team, src, filter) => { for (const p of g.planes) if (p.alive && p.team === team && (!filter || filter(p))) p.damage(1e5, 0, G.AMMO.slug, src); };
const killEngines = s => { for (const c of s.comps || []) if (c.kind === 'engine' && c.alive) s.partHit ? s.partHit(c, 1e5, null) : (c.hp = 0); };
const which = process.argv[3] || 'all';
const run = (id, ...a) => { if (which === 'all' || which === id) return play(id, ...a); };

// c7m1: shoot down raiders as they come; the train should make it
run('c7m1', (g, m, P, t) => { if (t > 20 && Math.floor(t) % 15 === 0) killAll(g, 1, P); }, 320, {note:m => `train ${Math.round(m.train.hp)}% s=${Math.round(m.train.s)}/${Math.round(m.rail.len)} pts=${m.rail.pts.length}`});
// c7m1: do nothing and let the raiders wreck it
run('c7m1', () => {}, 320, {note:m => `train ${Math.round(m.train.hp)}% (left alone)`});
// c7m2: kill the Concord, then the bosses
run('c7m2', (g, m, P, t) => { if (t > 40 && m.concord.alive) m.concord.damage(1e5, P); if (t > 50) { killAll(g, 1, P); killAll(g, 2, P); } }, 200, {note:m => `bosses ${m.bosses.length}`});
// c7m2: let her reach Cíbola
run('c7m2', () => {}, 900, {note:m => `concord at ${Math.round(Math.hypot(m.concord.pos.x - m.P.cibola.x, m.concord.pos.z - m.P.cibola.z))}`});
// c7m3: knock out every engine
run('c7m3', (g, m, P, t) => { if (t > 30) { for (const c of m.jug.comps) if (c.kind === 'engine' && c.alive) { c.hp = 0; c.alive = false; } m.jug.update && 0; } if (t > 40) killAll(g, 1, P); }, 200, {note:m => `engines ${m.jug.alivePart('engine').length}`});
// c8m1: drop on all three camps by teleporting slow and low, kill wolves
run('c8m1', (g, m, P, t) => { const c = m.camps.find(c => !c.fed); if (c && t > 5) at(P, c.at.clone().add(new V3(0, 30, 0)), 40); if (t > 30 && Math.floor(t) % 10 === 0) killAll(g, 1, P); }, 600, {note:m => `fed ${m.camps.filter(c => c.fed).length} stop ${m.stop} bernard ${Math.round(m.bern.hp/m.bern.hpMax*100)}%`});
// c8m2: shoot targets, then the hall
run('c8m2', (g, m, P, t) => { if (t > 10) for (const T of m.T) if (T !== m.hall && T.alive) g.hitTarget(T, 999, P); if (t > 20 && m.hall.alive) g.hitTarget(m.hall, 999, P); }, 120, {note:m => `targets ${m.T.length} hall ${m.hall.alive}`});
// c8m3: photograph the Colossus, shoot the Hornet
run('c8m3', (g, m, P, t) => { if (t > 8 && !m.photo1) { at(P, m.col.pos.clone().add(new V3(0, 100, -800)), 80); look(P, m.col.pos); g.snapPhoto = true; } if (t > 12 && m.hornet && m.hornet.alive) m.hornet.damage(1e5, 0, G.AMMO.slug, P); }, 120, {note:m => `photo ${!!m.photo1} hornet ${m.hornet ? m.hornet.L.chassis : '-'}`});
// c8m3: wound her so she flees to the Colossus
run('c8m3', (g, m, P, t) => { const V = m.hornet; if (V && V.alive && t > 8 && !m.fleeing) V.internal = V.internalMax*0.3; }, 400, {note:m => `fled ${!!m.fleeing} escaped ${!!m.escaped}`});
// c9m1: protect the navy by killing everything
run('c9m1', (g, m, P, t) => { if (t > 10 && Math.floor(t) % 8 === 0) killAll(g, 1, P); }, 300, {note:m => `navy ${m.navy.map(s => Math.round(s.hp/s.hpMax*100)).join('/')} corsairs ${!!m.corsairs}`});
// c9m2: beat both raiders
run('c9m2', (g, m, P, t) => { if (t > 30) for (const s of [m.anvil, m.hammer]) for (const c of s.comps) if (c.kind === 'engine' && c.alive) { c.hp = 0; c.alive = false; } if (t > 30) killAll(g, 1, P); }, 200, {note:(m, g) => `friends ${g.planes.filter(p => p.friend).map(p => p.name).join(', ')}`});
// c9m3: stop the Colossus, then catch Kroll in the grotto
run('c9m3', (g, m, P, t) => { if (t > 30 && m.stage === 'ship') for (const c of m.col.comps) if (c.kind === 'engine' && c.alive) { c.hp = 0; c.alive = false; } if (m.kroll && m.kroll.alive && m.kd > m.exitS*0.6) m.kroll.damage(1e5, 0, G.AMMO.slug, P); }, 300, {note:m => `kroll ${m.kroll ? (m.kroll.alive ? 'alive' : 'down') : '-'} kd ${Math.round(m.kd || 0)}/${Math.round(m.kLen || 0)} exit ${Math.round(m.exitS || 0)}`});
// c9m3: let Kroll go
run('c9m3', (g, m, P, t) => { if (t > 30 && m.stage === 'ship') for (const c of m.col.comps) if (c.kind === 'engine' && c.alive) { c.hp = 0; c.alive = false; } }, 400, {note:m => `kroll escaped ${!!m.escaped}`});
// the awards
G.save.story = {node:'c9m3', flags:{}, log:[{node:'c6m3', kind:'success'}]}; G.save.owned = ['gallant'];
G.storyCommit({kind:'success', flags:{}, then:''});
console.log('after the finale: node', G.save.story.node, '· zephyr', G.save.owned.includes('zephyr'), '· hornet', G.save.owned.includes('hornet'), '· liveries', G.save.liveries.filter(l => ['syndicate','railroad','glacier','armada'].includes(l)).length);
console.log(errs ? errs + ' ERRORS' : 'v3 done');
