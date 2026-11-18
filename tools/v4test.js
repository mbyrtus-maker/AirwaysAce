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
const radio = []; G.HUD.radio = (w, t) => { radio.push(`${w}: ${t}`); };
G.save.story = {node:'c10m1', flags:{kroll:'caught', varga:'caught'}, log:[]};
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
const ghosts = g => g.planes.filter(p => p.alive && p.ghost);
// c10m1: drop at every corner, kill the ghosts
run('c10m1', (g, m, P, t) => { const d = m.drops.find(d => !d.done); if (d && t > 4) at(P, d.at.clone().add(new V3(0, 40, 0)), 50); if (t > 20) for (const p of ghosts(g)) p.damage(1e5, 0, G.AMMO.slug, P); }, 300, {note:(m, g) => `drops ${m.drops.filter(d => d.done).length} gyros ${m.gyros.filter(p => p.alive).length} heat ${Math.round(m.scene.heat || 0)}`});
// c10m2: kill raiders as they come
run('c10m2', (g, m, P, t) => { if (t > 12 && Math.floor(t*30) % 60 === 0) { killAll(g, 1, P); } }, 300, {note:m => `holders ${m.holders.filter(h => h.alive).length}`});
// c10m2: leave them to it
run('c10m2', () => {}, 300, {note:m => `holders ${m.holders.filter(h => h.alive).length} (left alone)`});
// c10m3: hold at each mast, photograph the Conductor
run('c10m3', (g, m, P, t) => { const M = m.masts.find(M => !M.done); if (M && t > 4) at(P, M.at.clone().add(new V3(0, 50, 0)), 40); if (m.cond && !m.snap) { at(P, m.cond.pos.clone().add(new V3(0, 150, -900)), 70); look(P, m.cond.pos); g.snapPhoto = true; } if (m.snap) killAll(g, 1, P); }, 400, {note:m => `masts ${m.masts.filter(M => M.done).length} snap ${!!m.snap}`});
// c11m1: escort the convoy (kill strafers often)
run('c11m1', (g, m, P, t) => { if (Math.floor(t*30) % 45 === 0) killAll(g, 1, P); }, 600, {note:m => `convoy ${Math.round(m.convoy.hp)}% s=${Math.round(m.convoy.s)}/${Math.round(m.convoy.len)} forced ${m.forced}`});
// c11m2: cut the line
run('c11m2', (g, m, P, t) => { if (m.cut && m.cut.alive && m.hoist > 0.3) g.hitTarget(m.cut, 999, P); if (m.stage === 'dropped') killAll(g, 1, P); }, 400, {note:m => `stage ${m.stage} who ${m.who}`});
// c11m2: let it go
run('c11m2', (g, m, P, t) => { killAll(g, 1, P, p => p.ghost); }, 500, {note:m => `stage ${m.stage}`});
// c11m3: shoot every bomber before it drops
run('c11m3', (g, m, P, t) => { for (const p of m.bombers) if (p.alive && t > 5) p.damage(1e5, 0, G.AMMO.slug, P); if (Math.floor(t*30) % 90 === 0) killAll(g, 1, P); }, 400, {note:m => `dam ${m.dam}% wave ${m.wave}`});
// c11m3: let torpedoes through
run('c11m3', () => {}, 500, {note:m => `dam ${m.dam}% torps ${m.torps.length}`});
// c12m1: shoot the aerials
run('c12m1', (g, m, P, t) => { if (t > 10) for (const a of m.aer) if (a.alive) g.hitTarget(a, 999, P); if (m.backup && t > 40) killAll(g, 1, P); }, 300, {note:(m, g) => `aerials ${m.aer.filter(a => a.alive).length} lost ghosts ${g.planes.filter(p => p.alive && p.ghost && p.lost).length} backup ${!!m.backup}`});
// c12m2: do the lot, then fly out
run('c12m2', (g, m, P, t) => { if (t > 5) { g.hitTarget(m.hall, 999, P); for (const x of m.parked) if (x.alive) g.hitTarget(x, 999, P); } if (t > 8 && !m.got) { at(P, m.set.clone().add(new V3(0, 10, 0)), 40); } if (m.outT) at(P, m.gate.clone().add(new V3(0, 300, 0)), 80); }, 200, {note:m => `got ${!!m.got} hall ${m.hall.alive}`});
// c12m3: shoot the aerials, then catch Ashgrove
run('c12m3', (g, m, P, t) => { if (t > 10) for (const a of m.masts) if (a.alive) g.hitTarget(a, 999, P); if (m.runners && m.kd > 1500) for (const R of m.runners) if (R.p.alive) R.p.damage(1e5, 0, G.AMMO.slug, P); }, 300, {note:m => `runners ${m.runners ? m.runners.length : 0} kd ${Math.round(m.kd || 0)}`});
// c12m3: let him go
run('c12m3', (g, m, P, t) => { if (t > 10) for (const a of m.masts) if (a.alive) g.hitTarget(a, 999, P); }, 300, {note:m => `escaped ${!!m.escaped} kd ${Math.round(m.kd || 0)}/${Math.round(m.kLen || 0)}`});
G.save.story = {node:'c12m3', flags:{}, log:[{node:'c6m3', kind:'success'}, {node:'c9m3', kind:'success'}]}; G.save.owned = ['gallant'];
G.storyCommit({kind:'success', flags:{}, then:''});
console.log('after the finale: node', G.save.story.node, '· banshee', G.save.owned.includes('banshee'), '· hornet', G.save.owned.includes('hornet'));
// the drone
G.save.open.region = 'halcyon'; const g2 = new G.Game(R, G.MISSIONS.open); const L = G.stockLoadout('banshee'); console.log('banshee chassis drone', G.CHASSIS.banshee.drone);
g2.player.st.drone = true; G.launchDrone(g2); console.log('drone up', !!(g2.drone && g2.drone.alive), 'used', g2.droneUsed);
console.log(errs ? errs + ' ERRORS' : 'v4 done');
