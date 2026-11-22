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
const order = ['data', 'sfx', 'world', 'models', 'planes', 'combat', 'ai', 'audio', 'hud', 'game', 'traffic', 'story', 'open', 'rust', 'story2', 'story3', 'story4', 'tutorial', 'net', 'pad', 'keys', 'ui', 'weather', 'ach'];
for (const f of order) vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), {filename:f + '.js'});
const G = global.G, V3 = THREE.Vector3;
let errs = 0; const fail = (where, e) => { errs++; console.log('ERROR in', where, '\n ', e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n  ') : e); };
const R = new Proxy({}, {get:() => () => {}});
G.save.callsign = 'Tester';
function step(g, n, dt = 1/30, hook){ for (let i = 0; i < n; i++) { if (hook) hook(i); g.update(dt); } }
function fly(g){ const P = g.player; g.aimPitch = 0.05; P.throttle = 1; }
const regions = Object.keys(G.REGIONS);
const fin0 = G.MISSIONS.open.finishJob; G.MISSIONS.open.finishJob = function(r){ const id = this.job && this.job.def.id; console.log(`    ${id} -> ${r.win ? 'WIN' : 'FAIL'} ${r.medal || ''} ${r.note || ''} | ${r.say || ''}`.slice(0, 170)); return fin0.call(this, r); };
for (const rid of regions) for (const hour of [11, 22]) {
  const tag = `${rid}@${hour}`;
  try {
    G.save.open.region = rid; G.save.open.hour = hour; G.save.open.wing = hour === 11;
    const t0 = Date.now(); const g = new G.Game(R, G.MISSIONS.open), O = g.mission; console.log(`${tag}: built in ${Date.now() - t0} ms, sites ${O.sites.map(s => s.id + '@' + Math.round(s.point.x) + ',' + Math.round(s.point.z) + ' y' + Math.round(s.point.y)).join(' ')}`);
    O.drop(); fly(g); step(g, 300); g.player.invuln = false;
    const dmg0 = g.player.damage.bind(g.player); g.player.damage = function(){}; g.player.destroy = function(){};   // keep the test pilot alive: bandit fire is not under test
    if (!g.player.alive) console.log('  (player died in free flight; ok)');
    // meet every contact
    for (const s of O.sites.filter(s => s.contact)) { O.meet(s); G.UI.renderContact(); G.UI.closeContact(); }
    // a treasure pickup and a stunt
    const T = O.treasures.find(t => !t.def.race); if (T) { g.player.pos.copy(T.pos).add(new V3(0, 20, 0)); step(g, 2); }
    O.onStunt(g, 'immel'); O.onStunt(g, 'roll'); step(g, 200);
    // every job for this region
    for (const def of G.JOBS.filter(j => G.CONTACTS[j.contact] && O.sites.some(s => s.contact === j.contact) && !!j.night === (hour === 22))) {
      try {
        if (!g.player.alive) { console.log('  player dead, stopping jobs'); break; }
        const P = g.player; P.pos.set(0, 600, 0); P.speed = 70; P.frozen = false; g.running = true; g.paused = false;
        O.startJob(def, O.sites.find(s => s.contact === def.contact)); step(g, 60);
        const J = O.job; if (!J) { console.log(`  ${def.id}: ended at once`); continue; }
        if (J.formation) {   // formation start: wait behind the start ring for the rivals and the 3-2-1
          const st = J.start.clone(), hold = () => { P.pos.copy(st).add(new V3(0, 40, -500)); P.speed = 60; P.onGround = false; };
          let w = 0; while (!J.started && w++ < 30*40 && O.job === J) step(g, 1, 1/30, hold);
          console.log(`  ${def.id}: formation start ${J.started ? 'GO after ' + (w/30).toFixed(1) + ' s' : 'never started (' + J.stage + ')'}, rivals ${J.rivals.map(r => r.p.pos.distanceTo(st).toFixed(0) + ' m').join(', ')} from the start`);
        }
        // walk the job's targets: teleport onto each one
        for (let k = 0; k < 40 && O.job === J; k++) {
          let tgt = null;
          if (def.type === 'race') { const pts = J.len; const ring = g.markers.find(m => m.course && /NEXT|START|FINISH/.test(m.label)) || g.markers.find(m => /NEXT|START|FINISH/.test(m.label)); if (ring) tgt = ring.pos; }
          else if (def.type === 'bounty') { tgt = O.P[def.at]; for (const p of g.planes) if (p.team === 1 && p.alive && J.up) p.destroy(P, 'shot'); for (const s of g.ships) if (s !== O.ship && s.alive) { s.alive = false; g.onShipDown(s); } }
          else if (def.type === 'photo') { const sh = J.shots.find(x => !x.got); if (!sh) { step(g, 2); continue; } P.onGround = false; P.pos.copy(sh.pos).add(new V3(Math.min(500, (sh.range || 1000)*0.6), 60, 0)); P.q.setFromUnitVectors(new V3(0, 0, 1), sh.pos.clone().sub(P.pos).normalize()); P.axes(); P.speed = 50; P.vel.copy(P.fwd).multiplyScalar(50); g.snapPhoto = true; J.update(1/60); g.snapPhoto = false; step(g, 1); continue; }
          else if (def.type === 'stunt') { const c = O.P[def.at]; P.onGround = false; P.pos.set(c.x, c.y + 80, c.z); P.speed = 70; O.award(3000, 'TEST'); step(g, 2); continue; }
          else { const l = def.legs[J.i]; if (!l) { step(g, 2); continue; }
            const site = l.site && O.sites.find(s => s.id === l.site);
            if (l.how === 'land' || l.how === 'pickup') { const sp = site.apron || site.point; P.pos.set(sp.x, sp.y + 2, sp.z); P.onGround = true; P.speed = 0; step(g, l.how === 'pickup' ? 200 : 3); continue; }
            if (l.how === 'hook') { P.onGround = false; O.hooked(site, 1); await0(); G.UI.closeContact && G.UI.inContact && G.UI.closeContact(); step(g, 3); continue; }
            if (l.how === 'hoops') { const h = J.hoops && J.hoops[J.hk]; if (h) { P.pos.copy(h.pos).addScaledVector(h.n, -20); step(g, 1); P.pos.copy(h.pos).addScaledVector(h.n, 20); step(g, 1); } else step(g, 2); continue; }
            tgt = O.P[l.mark]; if (tgt) { P.onGround = false; P.pos.copy(tgt).add(new V3(0, 30, 0)); P.speed = 50; step(g, 3); continue; } }
          if (tgt) { const n = new V3(0, 0, 1); P.onGround = false; P.pos.copy(tgt).add(new V3(0, 0, -15)); P.speed = 70; step(g, 1); P.pos.copy(tgt).add(new V3(0, 0, 15)); step(g, 1); P.pos.copy(tgt).add(new V3(15, 0, 0)); step(g, 1); P.pos.copy(tgt).add(new V3(-15, 0, 0)); step(g, 1); }
          step(g, 5);
        }
        if (O.job === J) console.log(`  ${def.id}: ${O.job === J ? 'still running (' + (J.objective ? J.objective() : '') + ')' : 'finished'} · ${(G.save.open.jobs[def.id] || {}).done ? 'WON' : 'not won'}`);
        if (O.job) O.abandon();
      } catch (e) { fail(`${tag} job ${def.id}`, e); O.job = null; }
    }
    // race treasures: start a trial and finish it
    for (const T of O.treasures.filter(t => t.def.race)) { try { O.startTrial(T); step(g, 30); O.finishJob({win:true, medal:'silver', time:99}); } catch (e) { fail(`${tag} trial ${T.def.id}`, e); O.job = null; } }
    console.log(`  traffic: ${g.traffic ? g.traffic.planes.length + ' planes, ' + g.traffic.blimps.length + ' zeppelins' : 'none'} · stops ${O.sites.map(s => s.id).join(',')}`);
    O.finish();
  } catch (e) { fail(tag, e); }
}
function await0(){}
// chart, hangar, travel, wait
try { G.UI.chart(); G.UI.pickRegion('keys'); G.save.cash = 99999; G.UI.travel('keys'); G.UI.wait(); G.UI.wait(); G.UI.hangar(); G.save.mods.push('hotrod', 'nitro'); G.UI.setEng('2'); G.UI.setNitro(true); G.save.liveries.push('desert'); G.UI.setLivery('desert'); G.UI.renderHangar(); G.UI.pause(true); } catch (e) { fail('chart/hangar', e); }
// chart and developer panel (each step waits for the previous launch)
const later = (fn, ms = 120) => new Promise(r => setTimeout(() => { try { fn(); } catch (e) { fail('dev', e); } r(); }, ms));
(async () => {
  try { G.UI.chart(); G.UI.pickRegion('frostback'); G.UI.renderChart(); G.UI.dev(); G.UI.renderDev(); G.UI.devUnlock(); G.UI.devPlane('comet'); G.dev.god = true; G.dev.ammo = true; G.UI.closeDev();
    G.save.open.region = 'badlands'; G.UI.devFly('open'); } catch (e) { fail('chart/dev', e); }
  await later(() => { const g = G.game; if (!g || g.mission.id !== 'open') throw new Error('devFly open failed'); g.mission.drop(); step(g, 60); G.UI.dev(); G.UI.renderDev(); G.UI.devBandits(); G.UI.devRepair(); step(g, 30); G.UI.devWin(true); });
  await later(() => G.UI.devFly('c2m2'));
  await later(() => { const g = G.game; if (!g || g.mission.id !== 'c2m2') throw new Error('devFly c2m2 failed'); g.mission.drop(); step(g, 60); G.UI.dev(); G.UI.devWin(false); console.log('dev flows ok'); });
})();
// story regression
for (const id of ['ambush', 'nightjar', 'c1m1', 'c2m1', 'c2m3', 'c3m1', 'c3m3', 'c4m1', 'c4m2', 'c4m3', 'c5m1', 'c5m2', 'c5m3', 'c6m1', 'c6m2', 'c6m3', 'c7m1', 'c7m2', 'c7m3', 'c8m1', 'c8m2', 'c8m3', 'c9m1', 'c9m2', 'c9m3', 'c10m1', 'c10m2', 'c10m3', 'c11m1', 'c11m2', 'c11m3', 'c12m1', 'c12m2', 'c12m3']) { try { const g = new G.Game(R, G.MISSIONS[id]); g.mission.drop && g.mission.awaitDrop && g.mission.drop(); step(g, 200); } catch (e) { fail('story ' + id, e); } }
console.log(errs ? `\n${errs} error(s)` : '\nno errors');
setTimeout(() => { console.log(errs ? `${errs} error(s) total` : 'all clear'); process.exit(errs ? 1 : 0); }, 4000);
process.on('uncaughtException', e => { fail('async', e); });
// redock: fly the player through the Margaret's trapeze ring from astern
setTimeout(() => { try {
  G.save.open.region = 'halcyon'; G.save.open.hour = 11; const g = new G.Game(R, G.MISSIONS.open); g.mission.drop(); g.player.destroy = () => {}; step(g, 30);
  const s = g.ships[0], P = g.player, F = new V3(Math.sin(s.heading), 0, Math.cos(s.heading));
  const ring = s.worldPoint(new V3(0, -43.5, -22), new V3());
  for (const d of [-14, -6, 2, 8]) { P.pos.copy(ring).addScaledVector(F, d).add(new V3(0, -1.6, 0)); P.q.setFromUnitVectors(new V3(0, 0, 1), F); P.axes(); P.speed = 40; P.vel.copy(F).multiplyScalar(40); g.updateRearm(1/30); }
  console.log('redocking:', !!g.redocking);
  // a wingman parked inside the Margaret gets shoved clear rather than killed
  const W = g.addPlane({loadout:G.stockLoadout('gallant'), team:0, name:'Dutch', pos:s.pos.clone(), q:s.q, speed:60, ai:{role:'fighter', skill:0.6}}); W.grace = 0;
  for (let i = 0; i < 30; i++) W.update(1/30); console.log('wingman alive after touching the Margaret:', W.alive);
} catch (e) { fail('redock', e); } }, 3000);
setTimeout(() => { try {
  G.save.open.region = 'keys'; G.save.open.hour = 22; const g = new G.Game(R, G.MISSIONS.open), O = g.mission; O.drop(); step(g, 10);
  console.log('caves:', O.caves.map(c => `${c.name}@${Math.round(c.obj.position.x)},${Math.round(c.obj.position.z)}`).join(' '));
  const P = g.player; P.destroy = function(){ this.alive = false; };
  const flyTunnel = (tn) => { const T = tn.T; let alive = true; const s0 = O.sc.session + O.sc.chain;
    for (let k = T.i0 - 3; k <= T.i1 + 3; k++) { const i = Math.max(0, Math.min(T.pts.length - 1, k)), p = T.pts[i], ext = k < T.i0 ? (k - T.i0)*0 : 0;
      for (const f of [0, 0.5]) { const q = T.pts[Math.min(T.pts.length - 1, i + 1)]; P.pos.set(p.x + (q.x - p.x)*f, T.floor + T.td.bh*0.4, p.z + (q.z - p.z)*f); P.q.setFromUnitVectors(new V3(0, 0, 1), new V3(p.dx, 0, p.dz)); P.axes(); P.speed = 60; P.alive = true; g.done = false; O.ended = false; g.update(1/60); if (!P.alive) alive = false; } }
    const e = T.pts[T.pts.length - 1]; P.pos.set(e.x + e.dx*120, T.floor + 60, e.z + e.dz*120); g.update(1/60);
    return {alive, pts:Math.round(O.sc.session + O.sc.chain - s0)}; };
  for (const tn of O.tunnels) { const r = flyTunnel(tn); console.log(`  keys ${tn.name}: bore flight alive ${r.alive} · scored ${r.pts}`); }
  const tn = O.tunnels[0], m = tn.T.pts[(tn.T.i0 + tn.T.i1) >> 1]; P.alive = true; P.pos.set(m.x, tn.lidY(m, 0) - 3, m.z); g.update(1/60); console.log('  into the rock over a sea cave: alive', P.alive);
  for (const reg of ['frostback', 'badlands']) { G.save.open.region = reg; const g2 = new G.Game(R, G.MISSIONS.open), O2 = g2.mission; O2.drop(); const P2 = g2.player; P2.destroy = function(){ this.alive = false; };
    for (const tn of O2.tunnels) { const T = tn.T; let alive = true; for (let i = T.i0; i <= T.i1; i++) { const p = T.pts[i]; P2.pos.set(p.x, T.floor + T.td.bh*0.4, p.z); P2.q.setFromUnitVectors(new V3(0, 0, 1), new V3(p.dx, 0, p.dz)); P2.axes(); P2.alive = true; g2.done = false; O2.ended = false; g2.update(1/60); if (!P2.alive) alive = false; }
      console.log(`  ${reg} ${tn.name}: bore flight alive ${alive}`); }
    if (O2.cavern) { const C = O2.cavern; P2.alive = true; P2.pos.set(C.x, C.floor + 40, C.z); g2.update(1/60); const a1 = P2.alive; P2.alive = true; g2.done = false; O2.ended = false; P2.pos.set(C.x, C.floor + C.H + 5, C.z); g2.update(1/60);
      console.log(`  Cíbola: flying inside alive ${a1} · into the ceiling alive ${P2.alive} · stop ${O2.sites.find(s => s.id === 'cibola').point.y.toFixed(0)} m (floor ${C.floor.toFixed(0)})`); } }
} catch (e) { fail('caves', e); } }, 3300);
setTimeout(() => { try {
  G.save.open.region = 'halcyon'; G.save.open.hour = 22; const g = new G.Game(R, G.MISSIONS.open), O = g.mission; O.drop(); g.player.destroy = () => {}; g.player.damage = () => {}; step(g, 20);
  const s = O.sites.find(s => s.contact === 'odile'); O.meet(s); G.UI.renderContact(); G.UI.fight(); step(g, 30);
  const J = O.job; console.log('duel started:', !!J && J.def.type, 'ace', J && J.ace.callsign, 'dist', J && Math.round(J.ace.pos.distanceTo(g.player.pos)));
  J.ace.destroy(g.player, 'shot'); step(g, 5); console.log('duel won:', !O.job, 'next ace at the café:', G.aceFor('odile') && G.aceFor('odile').name);
} catch (e) { fail('duel', e); } }, 3600);
// every airframe flies: spawn each as the player and as AI, spin the props, fire guns and rockets
setTimeout(() => { try {
  for (const id of Object.keys(G.CHASSIS)) {
    G.save.load = G.stockLoadout(id); const g = new G.Game(R, G.MISSIONS.ambush); g.mission.drop(); const P = g.player; P.destroy = () => {}; P.fire = true; P.fireRk = true;
    for (let i = 0; i < 90; i++) { g.keys.Mouse0 = true; g.keys.Mouse2 = true; g.update(1/30); }
    const ai = g.addPlane({loadout:G.stockLoadout(id), team:1, name:'x', pos:P.pos.clone().add(new THREE.Vector3(0, 0, 600)), speed:80, ai:{role:'fighter', skill:0.6}}); for (let i = 0; i < 60; i++) g.update(1/30);
    const pr = P.ud.props; console.log(`  ${id}: props ${pr.length}, spinning ${pr.every(p => Math.abs(p.rotation.z) > 0.1)}, shots fired ${g.playerShots}, rockets left ${P.rockets}/${P.L.hp*3}`);
  }
} catch (e) { fail('airframes', e); } }, 3900);
