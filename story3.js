(function(){
'use strict';
/* =====================================================================
   VOLUME III: "The Iron Syndicate"
   With the Pirate King gone, a cartel buys up what's left of every gang on the coast: the Iron Syndicate, run by the armaments
   baron Ambrose Kroll, who sells guns to all sides and wants the sky to himself. The Lucky Thirteen fly their own planes again.

   Chapter 7, the Badlands: "Blood on the Rails". Chapter 8, the Frostback: "White Silence". Chapter 9, the Corsair Keys: "The Last Armada".
   What you chose in Volume II decides who answers the call in Chapter 9: Kit Calloway if you let her go, Red Bess if you spared her.
   ===================================================================== */
const G = window.G, V3 = THREE.Vector3, Q = THREE.Quaternion;
const tA = new V3(), tB = new V3(), tC = new V3(), Z = new V3(0, 0, 1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), YD = 1.0936;
const base = G.MISSIONS.ambush;
const SYN = [[0x3a3f44, 0xd9b44a, 0x1a1a1a], [0x2a2e33, 0xe0742a, 0xd9b44a], [0x4a4f54, 0x1a1a1a, 0xd9b44a]];
const SYN_SHIP = {hull:0x3a3f44, band:0xd9b44a, trim:0x1a1a1a};
const KROLL = 'Kroll', VARGA = 'Varga', HALE = 'Hale', SPARKS = () => G.RADIO.short, CAP = () => G.CAPTAIN.short;
G.GANGS.syndicate = {name:'the Iron Syndicate', paints:SYN};
const flags = () => (G.save.story && G.save.story.flags) || {};
const ground = (g, x, z) => Math.max(g.world.height(x, z), 0.4);
const RES = (m, g, kind, pay, lines, fl) => Object.assign({kind, kills:g.kills, shipPct:m.ship ? Math.round(m.ship.hp/m.ship.hpMax*100) : 100, sides:m.sideState(g), flags:fl || {}}, pay, lines);
const beaten = s => !s.alive || (s.comps && !s.alivePart('engine').length);
const fmtD = d => `${Math.round(d*YD).toLocaleString()} yd`;

/* ---------- shared kit for every Volume III episode ---------- */
const H3 = {
  story:true,
  sceneFor(g, region){ this.scene = G.regionScene(g, region); this.P = this.scene.P; },
  start(g, line, o = {}){
    for (const k of Object.keys(this)) if (!this.defKeys.has(k)) delete this[k];   // a retry starts clean: nothing left over from the last attempt
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.T = [];
    this.sceneFor(g, this.region);
    const M = G.REGIONS[this.region].margaret, at = o.at || new V3(M.x, M.y, M.z);
    this.launch(g, line, {pos:at, heading:o.heading ?? 0, turn:o.turn ?? 0.004});
  },
  /* bandits: any gang, Syndicate included; team 2 makes a gang that fights everybody */
  foes(g, gang, at, n, o = {}){
    const made = [], used = {}, paints = (G.GANGS[gang] || G.GANGS.syndicate).paints; n = G.squadN(g, n);
    for (let i = 0; i < n; i++) {
      const L = G.gangLoadout(gang, i, n, used, paints[i % paints.length]);
      const nm = G.name1920s(), pos = at.clone().add(new V3((i - (n - 1)/2)*55, (Math.random() - 0.5)*50, (Math.random() - 0.5)*40));
      const face = o.face || g.player.pos, q = new Q().setFromUnitVectors(Z, tA.copy(face).sub(pos).setY(0).normalize());
      const role = o.strafe && i < o.strafe ? 'strafe' : 'fighter';
      const p = g.addPlane({loadout:L, team:o.team || 1, name:nm.full, callsign:nm.short, pos, q, speed:90, ai:{role, skill:(o.skill ?? 0.45) + Math.random()*0.2}});
      if (role === 'strafe' && o.shipTarget) g.pilots[g.pilots.length - 1].shipTarget = o.shipTarget;
      p.gang = gang; made.push(p);
    }
    return made;
  },
  /* a named ace: a full name on the radio, a tougher airframe, better shooting */
  ace(g, name, chassis, paint, at, o = {}){
    const L = G.stockLoadout(chassis); L.paint = paint.slice(); if (o.guns) L.guns = o.guns.map(c => ({cal:c, ammo:'ex'}));
    const q = new Q().setFromUnitVectors(Z, tA.copy(g.player.pos).sub(at).setY(0).normalize());
    const p = g.addPlane({loadout:L, team:o.team || 1, name, callsign:name, pos:at, q, speed:95, ai:{role:'fighter', skill:o.skill ?? 0.85}, internalMul:o.tough ?? 1.7});
    p.ace = true; return p;
  },
  /* friends: corsairs, the navy, and whoever Volume II left owing you */
  friends(g, at, list){
    return list.map(([name, chassis, paint], i) => {
      const L = G.stockLoadout(chassis); L.paint = paint.slice();
      const p = g.addPlane({loadout:L, team:0, name, callsign:name.replace(/^.*"(.*)".*$/, '$1').split(' ').slice(-1)[0], pos:at.clone().add(new V3(i*45 - 60, i*6, -i*30)), q:g.player.q.clone(), speed:85, ai:{role:'fighter', skill:0.6}, grace:5});
      p.friend = true; return p;
    });
  },
  photo(g, dt, pos, range = 1100){
    const P = g.player, d = pos.distanceTo(P.pos), framed = d < range && tA.copy(pos).sub(P.pos).normalize().angleTo(P.fwd) < 0.16;
    this.framed = framed;
    if (framed && (this.camHintT = (this.camHintT || 0) - dt) <= 0) { this.camHintT = 4; G.HUD.toast(`In frame · press ${G.keymap ? G.keymap.label(G.keymap.key('KeyP')) : 'P'} to photograph`); }
    if (g.snapPhoto) { if (framed) return true; G.HUD.toast(d >= range ? 'Too far away for a good picture' : 'Nothing in frame: put it in the gunsight'); }
    return false;
  },
  /* ground targets: flak that shoots back, tanks that burn, machinery */
  target(g, kind, label, pos, o = {}){
    const grp = new THREE.Group(), hex = o.col || 0x4a4f54, M = (geo, c) => { const m = new THREE.Mesh(geo, G.mat(c, {roughness:0.8})); grp.add(m); return m; };
    if (kind === 'flak') { M(new THREE.CylinderGeometry(4, 5, 3, 8), 0x3a3f44).position.y = 1.5; for (const s of [-0.7, 0.7]) { const b = M(new THREE.CylinderGeometry(0.35, 0.4, 7, 6), 0x1a1a1a); b.position.set(s, 5, 1.6); b.rotation.x = -0.8; } }
    else if (kind === 'tank') { M(new THREE.CylinderGeometry(7, 7, 10, 14), hex).position.y = 5; M(new THREE.CylinderGeometry(7.3, 7.3, 0.8, 14), 0xd9b44a).position.y = 7.5; }
    else if (kind === 'hall') { M(new THREE.BoxGeometry(18, 9, 24), 0x3a3f44).position.y = 4.5; for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 4), new THREE.MeshBasicMaterial({color:0xffb040})); l.position.set(-6 + i*4, 9.5, 12.2); grp.add(l); } const pl = new THREE.PointLight(0xffb060, 1.6, 120, 1.5); pl.position.y = 14; grp.add(pl); }
    else M(new THREE.BoxGeometry(8, 6, 8), hex).position.y = 3;
    grp.position.copy(pos); g.scene.add(grp);
    const t = g.addTarget({kind, label, pos:pos.clone().add(new V3(0, kind === 'hall' ? 5 : 4, 0)), r:o.r || (kind === 'hall' ? 13 : 8), hp:o.hp || 200, group:grp, team:1, cd:2 + Math.random()*2});
    if (o.block !== false) g.world.addBlocker({x:pos.x, z:pos.z, hw:o.r || 7, hd:o.r || 7, top:pos.y + 9});
    this.T.push(t); return t;
  },
  targetsTick(g, dt){
    const P = g.player;
    for (const t of this.T) if (t.alive) {
      if (t.kind === 'flak') { t.cd -= dt; if (t.cd <= 0) { t.cd = 2.4; const d = P.pos.distanceTo(t.pos); if (P.alive && !P.invuln && d < 1500 && d > 150) { const tt = d/620; g.flakShell({team:1}, t.pos.clone(), P.pos.clone().addScaledVector(P.vel, tt).add(new V3((Math.random() - 0.5)*60, (Math.random() - 0.5)*60, 0)), tt); } } }
      if (P.pos.distanceTo(t.pos) < 3200) g.markers.push({pos:t.pos, label:t.label, col:'#ff8a6a', box:true});
    }
  },
  /* each frame: the region's animations, markers reset, wingmen once */
  tick(g, dt, wingLine){
    this.pt += dt; this.scene.tick(dt);
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); if (wingLine) G.HUD.radio('Dutch', wingLine); }
    return this.phase === 1 && !this.ended;
  },
  win(g, why){ if (this.ended) return; this.ended = true; const ok = this.sideState(g).every(s => s.st === 'ok'); g.end(this.result(g, ok ? 'perfect' : 'success', why)); },
  lose(g, why){ if (this.ended) return; this.ended = true; g.end(this.result(g, 'fail', why)); },
  playerDown(g){ G.HUD.radio(SPARKS(), 'We see your chute! Hang on, sugar, we\'re coming!'); this.lose(g, 'down'); },
  onShipDown(g, ship){ if (ship === this.ship) { G.HUD.radio(CAP(), 'She\'s going down! Everybody out!'); this.lose(g, 'margaret'); return; } if (this.shipDown) this.shipDown(g, ship); },
  onShipRun(){}, onShipStopped(){ return true; }, onKill(g, p){ if (this.killed) this.killed(g, p); },
  pay3(g, kind){ return kind === 'fail' ? 700 + g.kills*this.pay.kill/2 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill; }
};
const EP = o => { const m = Object.assign(Object.create(base), H3, o); m.defKeys = new Set(Object.keys(m)); m.defKeys.add('defKeys'); return m; };
const world = (region, time) => () => G.regionWorld(region, time);

/* scripted strafers: no AI pilot, they make low gun passes at a moving point, pull off, swing round and come again */
function strafe(g, p, at, dt, onHit){
  if (!p.alive) return;
  const st = p.raid || (p.raid = {mode:'in', t:0});
  const d = Math.hypot(at.x - p.pos.x, at.z - p.pos.z), gh = ground(g, p.pos.x, p.pos.z), ahead = ground(g, p.pos.x + p.fwd.x*250, p.pos.z + p.fwd.z*250);
  if (st.mode === 'in') { tC.set(at.x - p.pos.x, at.y + 30 - p.pos.y, at.z - p.pos.z); if (d < 120) { st.mode = 'out'; st.t = 0; st.away = tB.set(p.fwd.x, 0, p.fwd.z).normalize().clone(); } }
  else { st.t += dt; tC.copy(st.away).add(new V3(0, 0.35, 0)); if (st.t > 6 && d > 900) st.mode = 'in'; }
  tC.normalize(); const clear = Math.max(gh, ahead) + 45 - p.pos.y; if (clear > 0) tC.y = Math.max(tC.y, Math.min(0.6, clear/120));
  p.steer(tC.normalize()); p.throttle = 1;
  const aim = tA.copy(at).sub(p.pos), aligned = st.mode === 'in' && d < 650 && aim.normalize().dot(p.fwd) > 0.93;
  p.fire = aligned; p.fireRk = false;
  if (aligned) onHit(dt);
}

/* ---------- the Copperton Line: a railway through the Badlands, and a train that runs on it ---------- */
function railway(m, g){
  // the trestle crosses its river at whatever angle the layout found: the line runs straight over the deck and its approaches, at rail height
  const P = m.P, A = m.scene.arches.find(a => a.id === 'trestle') || m.scene.arches[0], L = A ? A.len : 300, B = A ? A.pos : P.trestle, deck = A ? (A.rail ?? A.deck) + 0.3 : ground(g, B.x, B.z) + 40;
  const yaw = A && A.yaw || 0, ux = Math.cos(yaw), uz = -Math.sin(yaw), ext = A && A.ext || [-L/2, L/2], on = t => new V3(B.x + ux*t, 0, B.z + uz*t);
  const C = P.copperton.clone(), D = P.dustdevil.clone();
  let E1 = on(ext[1] + 8), E2 = on(ext[1] + 250), W1 = on(ext[0] - 8), W2 = on(ext[0] - 250);
  if (C.distanceTo(W2) + D.distanceTo(E2) < C.distanceTo(E2) + D.distanceTo(W2)) [E1, E2, W1, W2] = [W1, W2, E1, E2];   // Copperton's end is whichever is nearer it
  // each leg is laid the way a surveyor would: the cheapest way over a coarse grid, where water is out (the trestle is the line's
  // one river crossing, so each leg keeps to its own bank), a metre climbed costs fourteen along and the river's edge is dearer; thinned and
  // eased into bends for the spline
  const route = (a, b, bank) => {
    const S = 80, key = (i, j) => (i + 512)*1024 + j + 512, H = new Map(), hgt = (i, j) => { const k = key(i, j); let v = H.get(k); if (v === undefined) H.set(k, v = ground(g, i*S, j*S)); return v; };
    const ai = Math.round(a.x/S), aj = Math.round(a.z/S), bi = Math.round(b.x/S), bj = Math.round(b.z/S), dist = new Map([[key(ai, aj), 0]]), from = new Map(), heap = [[0, ai, aj]];
    const push = e => { let i = heap.push(e) - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
    const pop = () => { const top = heap[0], e = heap.pop(); if (heap.length) { heap[0] = e; let i = 0; for (;;) { let m = i; const l = 2*i + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    let found = false;
    while (heap.length) {
      const [, i, j] = pop(), d0 = dist.get(key(i, j)); if (i === bi && j === bj) { found = true; break; }
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj, h = hgt(ni, nj); if (Math.abs(ni*S) > 6400 || Math.abs(nj*S) > 6400 || (h < 1 && !(ni === bi && nj === bj)) || ((ni*S - B.x)*ux + (nj*S - B.z)*uz)*bank < 0 || ground(g, (i + di/2)*S, (j + dj/2)*S) < 1) continue;
        let shore = false; for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) if (hgt(ni + a, nj + c) < 1) shore = true;
        const d = d0 + S*Math.hypot(di, dj) + 14*Math.abs(h - hgt(i, j)) + (shore ? 120 : 0), k = key(ni, nj);
        if (d < (dist.get(k) ?? 1e12)) { dist.set(k, d); from.set(k, [i, j]); push([d + S*Math.hypot(ni - bi, nj - bj), ni, nj]); }
      }
    }
    if (!found) return [];
    const cells = []; for (let c = [bi, bj]; c; c = from.get(key(c[0], c[1]))) cells.unshift(c);
    const out = []; for (let i = 2; i < cells.length - 2; i += 2) out.push(new V3(cells[i][0]*S, 0, cells[i][1]*S));
    const all = [a, ...out, b]; return out.map((q, i) => q.clone().multiplyScalar(2).add(all[i]).add(all[i + 2]).multiplyScalar(0.25));
  };
  const bank = Math.sign((E2.x - B.x)*ux + (E2.z - B.z)*uz), ctrl = [C, ...route(C, E2, bank), E2, E1, W1, W2, ...route(W2, D, -bank), D];
  // a Catmull-Rom spline through the control points, resampled to even spacing
  const dense = [], cp = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  for (let i = 1; i < cp.length - 2; i++) for (let k = 0; k < 40; k++) { const t = k/40, p0 = cp[i - 1], p1 = cp[i], p2 = cp[i + 1], p3 = cp[i + 2], t2 = t*t, t3 = t2*t;
    const f = (a, b, c, d) => 0.5*((2*b) + (-a + c)*t + (2*a - 5*b + 4*c - d)*t2 + (-a + 3*b - 3*c + d)*t3); dense.push(new V3(f(p0.x, p1.x, p2.x, p3.x), 0, f(p0.z, p1.z, p2.z, p3.z))); }
  dense.push(ctrl[ctrl.length - 1].clone().setY(0));
  let tot = 0; const cum = dense.map((p, i) => (tot += i ? p.distanceTo(dense[i - 1]) : 0)), N = Math.round(tot/9), raw = [];
  for (let i = 0, j = 1; i <= N; i++) { const d = tot*i/N; while (j < dense.length - 1 && cum[j] < d) j++; const t = (d - cum[j - 1])/Math.max(0.01, cum[j] - cum[j - 1]); raw.push(dense[j - 1].clone().lerp(dense[j], t)); }
  const pts = raw.map(v => ({x:v.x, z:v.z, gy:ground(g, v.x, v.z), y:0, bridge:Math.abs((v.z - B.z)*ux - (v.x - B.x)*uz) < 30 && (v.x - B.x)*ux + (v.z - B.z)*uz > ext[0] - 6 && (v.x - B.x)*ux + (v.z - B.z)*uz < ext[1] + 6}));
  for (const p of pts) { if (p.bridge) p.gy = deck; p.y = p.gy; }   // on the masonry: no timber bents under it
  for (let it = 0; it < 60; it++) for (let i = 1; i < pts.length - 1; i++) { const p = pts[i]; if (p.bridge) continue; p.y = Math.max(p.gy - 4, (pts[i - 1].y + pts[i + 1].y)/2); }
  let s = 0; pts.forEach((p, i) => { if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); p.s = s; });
  g.scene.add(G.buildTrack(pts));
  const at = (d, out) => { d = clamp(d, 0, s); let lo = 0, hi = pts.length - 1; while (hi - lo > 1) { const mI = (lo + hi) >> 1; if (pts[mI].s < d) lo = mI; else hi = mI; } const a = pts[lo], b = pts[hi], t = (d - a.s)/Math.max(0.01, b.s - a.s); return out.set(a.x + (b.x - a.x)*t, a.y + (b.y - a.y)*t, a.z + (b.z - a.z)*t); };
  return {pts, len:s, at};
}
class Train {
  constructor(g, rail, cars, o = {}){
    this.g = g; this.rail = rail; this.s = o.s ?? 60; this.speed = o.speed || 20; this.hp = this.hpMax = o.hp || 100; this.alive = true; this.done = false;
    let off = 0; this.cars = cars.map(kind => { const grp = G.buildTrainCar(kind); g.scene.add(grp); const c = {kind, grp, off}; off -= kind === 'loco' ? 13.5 : kind === 'tender' ? 9.5 : 15; return c; });
    this.pos = new V3(); this.update(0);
    (g.trains || (g.trains = [])).push(this);   // so the sound can find the nearest one
  }
  update(dt){
    if (this.alive && !this.done) this.s += this.speed*dt;
    if (this.s >= this.rail.len - 10) this.done = true;
    for (const c of this.cars) {
      const d = this.s + c.off, a = this.rail.at(d, tA), b = this.rail.at(d + 4, tB), yaw = Math.atan2(b.x - a.x, b.z - a.z), pitch = Math.atan2(b.y - a.y, 4);
      c.grp.position.copy(a); c.grp.rotation.set(-pitch, yaw, this.alive ? 0 : 0.5);
      if (!this.alive && c.grp.position.y > a.y - 2) c.grp.position.y -= 0.6;
    }
    this.pos.copy(this.cars[0].grp.position);
    if (this.alive && this.hp < this.hpMax*0.5 && Math.random() < dt*3) { const c = G.pick(this.cars); this.g.fx.fire.emit(c.grp.position.x, c.grp.position.y + 4, c.grp.position.z, 0, 3, 0, 2.6, 0.4, 0.3, 0.3, 0.3, 0.8, 0, 1, 1); }
    // the stack smokes
    if (Math.random() < dt*8 && this.alive) { const c = this.cars[0].grp; this.g.fx.fire.emit(c.position.x + Math.sin(c.rotation.y)*5, c.position.y + 6.5, c.position.z + Math.cos(c.rotation.y)*5, 0, 4, 0, 3, 0.5, 0.25, 0.25, 0.25, 0.7, 0, 1, 1); }
  }
  damage(d){ if (!this.alive) return; this.hp = Math.max(0, this.hp - d); if (!this.hp) { this.alive = false; for (const c of this.cars) this.g.fx.explosion(c.grp.position.clone().add(new V3(0, 3, 0)), 2); if (this.g.audio) this.g.audio.boom(this.pos, true); } }
  near(p, r){ return this.cars.some(c => c.grp.position.distanceTo(p) < r); }
  // co-op: the host runs the train; guests are told where it is (net.js movers)
  netState(){ return [Math.round(this.s*10)/10, this.alive ? 1 : 0, Math.round(this.hp), this.done ? 1 : 0]; }
  netApply(a){ this.s = +a[0] || 0; this.done = !!a[3]; if (this.alive && !a[1]) this.damage(1e9); this.hp = +a[2] || 0; this.update(0); }
}

G.Train = Train;   // the El in Gantry City uses it too
G.STORY_KIT3 = {H3, EP, RES, strafe, beaten, fmtD, world, ground, flags, SYN, SYN_SHIP};   // Volume IV builds on these

/* =====================================================================
   Chapter 7, Episode 1: The Payroll Express
   Escort the Copperton Line's armoured payroll train across the Badlands while the Rattlesnake Gang tries to rob it,
   and find out who's paying them.
   ===================================================================== */
G.MISSIONS.c7m1 = EP({
  id:'c7m1', title:'The Payroll Express', place:'The Copperton Line, Red Mesa Badlands', region:'badlands', wing:3,
  brief:'The Brethren are finished, and somebody is buying up every gang they left behind. Out in the Badlands, the Copperton Line is running its payroll train to Dust Devil Field: a month of wages for every miner on the mesa, under armour plate. The Rattlesnake Gang has never robbed a train in its life, and this week it has new planes and somebody else\'s money. Ride shotgun from Copperton across the Coronado trestle, and if anybody comes along with fresh paint, find out whose.',
  sides:[{text:'The train reaches Dust Devil Field above 60%'}, {text:'Down 6 raiders yourself'}],
  pay:{success:4500, perfect:2000, kill:300},
  worldOpts:world('badlands', 'day'),
  setup(g){
    this.start(g, `Hook's live, ${G.save.callsign || 'Ace'}. That's the Copperton Line below us, steam up. Drop and take station on her.`, {heading:Math.PI});
    this.rail = railway(this, g); this.train = new Train(g, this.rail, ['loco', 'tender', 'gun', 'pay', 'box', 'gun'], {speed:this.rail.len/220});
    const t0 = this.rail.at(this.train.s, new V3()); this.ship.pos.set(t0.x - 500, 720, t0.z - 500); this.ship.dest = this.rail.at(this.rail.len*0.7, new V3()); this.ship.turn0 = 0.01;
    this.raiders = []; this.wave = 0; this.mine = 0;
  },
  update(g, dt){
    const live = this.tick(g, dt, 'Dutch, Hellcat and Doc. A train job! I always wanted to be a cowboy.'); const T = this.train;
    T.update(this.phase === 1 ? dt : 0);
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    const W = [[6, 'rattlers', 3, 2, 'Riders in the sky! Rattlesnakes, three of \'em, and they\'re going for the train!'],
               [70, 'rattlers', 4, 2, 'More Rattlers off the mesa. Since when can that gang afford Jackals?'],
               [140, 'syndicate', 3, 1, 'Grey planes with yellow noses. Those aren\'t Rattlers, sugar. I\'ve never seen that paint.']];
    if (this.wave < W.length && this.pt > W[this.wave][0]) {
      const [, gang, n, ns, line] = W[this.wave++], a = Math.random()*Math.PI*2, from = T.pos.clone().add(new V3(Math.sin(a)*1800, 380, Math.cos(a)*1800));
      const fs = this.foes(g, gang, from, n, {skill:0.45, face:T.pos});
      // some of each wave go for the train itself, flown by script so they really do make their gun runs
      for (const p of fs.slice(0, ns)) { const i = g.pilots.findIndex(pl => pl.p === p); if (i >= 0) g.pilots.splice(i, 1); p.raider = true; this.raiders.push(p); }
      if (this.wave === 3) { this.foreman = this.ace(g, '"Foreman" Gage', 'mantis', [0x2a2e33, 0xd9b44a, 0x9e1b1b], from.clone().add(new V3(0, 60, 0)), {skill:0.8}); setTimeout(() => G.HUD.radio('"Foreman" Gage', 'The Syndicate thanks you for your custom, Lucky Thirteen. Now get off our railroad.'), 3000); }
      G.HUD.radio(SPARKS(), line);
    }
    for (const p of this.raiders) strafe(g, p, T.pos, dt, h => T.damage(h*1.6));
    // the train's own gunners chip away at anyone strafing low and close
    if (Math.random() < dt*0.5) { const p = this.raiders.find(q => q.alive && T.near(q.pos, 260)); if (p) p.damage(18, 0, G.AMMO.slug, null); }
    g.markers.push({pos:T.pos.clone().add(new V3(0, 12, 0)), label:`COPPERTON LINE · ${Math.round(T.hp)}%`, col:'#9ef0a0', edgeOnly:false});
    G.HUD.objective(`Escort the payroll train to Dust Devil Field · ${fmtD(this.rail.len - T.s)} to go${this.foreman && this.foreman.alive ? ' · the grey ace is calling himself the Foreman' : ''}`);
    if (!T.alive) { G.HUD.radio(CAP(), 'She\'s off the rails! The payroll\'s burning in a ditch.'); this.lose(g, 'train'); }
    else if (T.done) { G.HUD.radio(SPARKS(), 'She\'s pulling into Dust Devil. Every dollar safe. Now, who paints their planes grey and yellow?'); this.win(g); }
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ const T = this.train; return [{text:this.sides[0].text, st:T.hp >= 60 ? (T.done ? 'ok' : 'live') : 'fail', val:Math.round(T.hp) + '%'}, {text:this.sides[1].text, st:g.kills >= 6 ? 'ok' : 'live', val:`${Math.min(6, g.kills)}/6`}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'Every dollar delivered and a grey ace in the dirt. The Foreman had a card in his pocket: an iron ring on black. The Iron Syndicate.', then:'The Rattlesnake Gang has new friends: the Iron Syndicate, a cartel nobody has heard of with money nobody can trace. Its envoy is meeting the gangs at Sentinel Butte tonight.'},
      success:{mood:'stern', say:'The payroll got through, a little singed. Those grey planes had a calling card: an iron ring on black. The Iron Syndicate.', then:'The Rattlesnake Gang has new friends: the Iron Syndicate, a cartel nobody has heard of with money nobody can trace. Its envoy is meeting the gangs at Sentinel Butte tonight.'},
      fail:{mood:'angry', say:why === 'train' ? 'The payroll train is a burning wreck in the Badlands and the miners won\'t get paid. Somebody planned that.' : 'You came down in the Badlands. The train limped in without you.', then:'The Copperton Line wants another try, and so do we. Same train, same track, and this time we watch for grey paint.'}
    }[kind]), {train:Math.round(this.train.hp)});
  }
});

/* =====================================================================
   Chapter 7, Episode 2: Three's a Crowd
   The Syndicate's envoy blimp is buying the Rattlesnake Gang at Sentinel Butte. The Paper Tigers weren't invited, and turn up
   anyway: they'll shoot at the Rattlers, the blimp and you. Bring the envoy down before she reaches Cíbola.
   ===================================================================== */
G.MISSIONS.c7m2 = EP({
  id:'c7m2', title:'Three\'s a Crowd', place:'Sentinel Butte, Red Mesa Badlands', region:'badlands', wing:3,
  brief:'The Iron Syndicate\'s envoy, a gilded blimp called the Concord, is meeting the Rattlesnake Gang over Sentinel Butte at sundown to sign them up. Once she reaches Cíbola and the mesa\'s safe under her flag, the deal is done. Bring her down before then. Word is the Paper Tigers came out from Halcyon to bid against the Syndicate, and they don\'t like losing: anything in the sky that isn\'t a Tiger is fair game to them, Rattlers included. Let them thin each other out.',
  sides:[{text:'Bring down the Concord before she reaches Cíbola'}, {text:'Shoot down both gang bosses'}, {text:'Keep the Margaret above 60%'}],
  pay:{success:5000, perfect:2500, kill:250},
  worldOpts:world('badlands', 'evening'),
  setup(g){
    this.start(g, `Hook's live, ${G.save.callsign || 'Ace'}. There's the butte, and there's a gold blimp. Drop and take it.`, {heading:0.6});
    const B = this.P.butte, C = this.P.cibola;
    this.ship.pos.set(B.x - 2600, 760, B.z - 2200); this.ship.dest = B.clone(); this.ship.turn0 = 0.008;
    this.concord = g.addShip({team:1, kind:'blimp', name:'Concord', paint:{hull:0x3a3f44, band:0xd9b44a}, pos:new V3(B.x + 300, ground(g, B.x, B.z) + 340, B.z + 200), heading:Math.atan2(C.x - B.x, C.z - B.z), speed:6.5, turn:0.012, hp:1900, dest:C.clone()});
    this.bosses = []; this.stage = 0;
  },
  update(g, dt){
    const live = this.tick(g, dt, 'Three gangs in one sky? Lovely. I\'ll take whoever\'s ugliest.'), K = this.concord, C = this.P.cibola;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    if (this.stage === 0 && this.pt > 4) {
      this.stage = 1; this.foes(g, 'rattlers', K.pos.clone().add(new V3(-200, 80, 300)), 4, {skill:0.45});
      this.bosses.push(this.ace(g, '"Diamondback" Dixon', 'highwayman', [0xc8a25a, 0x5a3b22, 0x9e1b1b], K.pos.clone().add(new V3(0, 150, 400)), {skill:0.75}));
      G.HUD.radio('"Diamondback" Dixon', 'The Lucky Thirteen? You\'re late. The Syndicate pays better than you ever did, boys.');
    }
    if (this.stage === 1 && this.pt > 30) {
      this.stage = 2; const at = K.pos.clone().add(new V3(2200, 400, -1200));
      this.tigers = this.foes(g, 'tigers', at, 4, {team:2, skill:0.5, strafe:2, shipTarget:K, face:K.pos});
      this.bosses.push(this.ace(g, 'Madame Orchid', 'comet', [0xd94f8a, 0x2b1b3a, 0xf2c14e], at.clone().add(new V3(0, 80, 0)), {team:2, skill:0.8}));
      G.HUD.radio('Madame Orchid', 'Mr. Silk sends his regards to the Syndicate, the snakes, and the Lucky Thirteen. All of you, out of my sky.');
      setTimeout(() => G.HUD.radio(SPARKS(), 'The Tigers are shooting at everybody! Let them. Just keep your eye on that blimp.'), 5000);
    }
    if (this.stage === 2 && this.pt > 110) { this.stage = 3; this.foes(g, 'syndicate', K.pos.clone().add(new V3(0, 500, -1500)), 3, {skill:0.55}); G.HUD.radio(SPARKS(), 'Grey and yellow, inbound from the north. The Syndicate\'s covering its envoy.'); }
    const left = Math.hypot(K.pos.x - C.x, K.pos.z - C.z);
    if (K.alive) g.markers.push({pos:K.pos.clone().add(new V3(0, 30, 0)), label:`CONCORD · ${fmtD(left)} from Cíbola`, col:'#ff8a6a'});
    G.HUD.objective(K.alive ? `Bring down the Concord before she reaches Cíbola · ${fmtD(left)} · ${Math.round(K.hp/K.hpMax*100)}%` : `Clean up: ${this.bosses.filter(p => p.alive).map(p => p.callsign).join(' and ') || 'the sky\'s yours'}`);
    if (K.alive && left < 300) { G.HUD.radio('"Diamondback" Dixon', 'She\'s over Cíbola. Deal\'s done, Thirteen. The Badlands belong to the Syndicate now.'); this.lose(g, 'deal'); }
    if (!K.alive && this.stage >= 2 && (!this.bosses.some(p => p.alive) || this.pt - this.downT > 45)) this.win(g);
    G.HUD.sides(this.sideState(g));
  },
  shipDown(g, s){ if (s === this.concord) { this.downT = this.pt; G.HUD.radio(SPARKS(), 'The Concord\'s going down! Somebody bailed out of her gondola with a briefcase, and the Tigers are chasing him.'); } },
  sideState(g){ const K = this.concord, S = this.ship;
    return [{text:this.sides[0].text, st:K.alive ? 'live' : 'ok', val:Math.round(K.hp/K.hpMax*100) + '%'}, {text:this.sides[1].text, st:this.bosses.length >= 2 && !this.bosses.some(p => p.alive) ? 'ok' : 'live', val:`${this.bosses.filter(p => !p.alive).length}/2`},
            {text:this.sides[2].text, st:S.hp/S.hpMax >= 0.6 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(S.hp/S.hpMax*100) + '%'}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'The envoy\'s in the dirt, Dixon and Orchid are walking home, and the briefcase came down with a chute. Hale\'s going to want to read this.', then:'The envoy\'s briefcase holds a railway timetable and a name: the Juggernaut, an armoured zeppelin the Syndicate means to run up the Copperton Line to seize the mint.'},
      success:{mood:'stern', say:'The Concord\'s down and the deal\'s dead. We got the envoy\'s briefcase out of the wreck.', then:'The envoy\'s briefcase holds a railway timetable and a name: the Juggernaut, an armoured zeppelin the Syndicate means to run up the Copperton Line to seize the mint.'},
      fail:{mood:'angry', say:why === 'deal' ? 'The Concord made Cíbola. The Rattlesnake Gang works for the Syndicate now.' : why === 'margaret' ? 'The Margaret\'s down in the Badlands. Everybody walked away.' : 'You hit the silk over the butte. The Concord sailed on.', then:'The Syndicate has the Badlands for now. Hale says the deal isn\'t signed till the money moves, and it moves again tonight.'}
    }[kind]), {orchid:this.bosses[1] && !this.bosses[1].alive ? 'down' : 'loose'});
  }
});

/* =====================================================================
   Chapter 7, Episode 3: The Juggernaut
   The Syndicate's armoured zeppelin rides the Copperton Line toward the mint. Stop her before she reaches Copperton.
   ===================================================================== */
G.MISSIONS.c7m3 = EP({
  id:'c7m3', title:'The Juggernaut', place:'Over the Copperton Line, Red Mesa Badlands', region:'badlands', wing:3, weather:'dust', weatherScript:[[150, 'drystorm', 'The dust is settling, but there\'s lightning in it.']],
  brief:'The Juggernaut is the biggest raider anybody has built: a Syndicate zeppelin plated like a battleship, riding low up the Copperton Line toward the mint, with fighters swarming round her. If she reaches Copperton, the Syndicate owns the Badlands\' money. There\'s a dust storm blowing. Knock out her engines or bring her down before she gets there, and keep the Margaret in one piece while you do it.',
  sides:[{text:'Stop the Juggernaut before she reaches Copperton'}, {text:'Knock out all her engines'}, {text:'Keep the Margaret above 50%'}],
  pay:{success:6000, perfect:3000, kill:250},
  worldOpts:world('badlands', 'day'),
  setup(g){
    this.start(g, `Hook's live, ${G.save.callsign || 'Ace'}. Visibility's lousy. She's out there somewhere, following the rails.`, {heading:0});
    this.rail = railway(this, g);
    const s0 = this.rail.len*0.82, at = this.rail.at(s0, new V3()), C = this.P.copperton;
    this.jug = g.addShip({team:1, kind:'raider', name:'Juggernaut', label:'JUGGERNAUT', paint:Object.assign({scale:1.5, hpMul:2.2}, SYN_SHIP), pos:at.clone().setY(at.y + 230), heading:Math.atan2(C.x - at.x, C.z - at.z), speed:6, turn:0.008, noRun:true, dest:C.clone()});
    G.toughen(this.jug, 1.4);
    this.ship.pos.set(at.x - 1500, 760, at.z - 900); this.ship.dest = null; this.ship.foe = this.jug; this.ship.standoff = 1400;
    this.wave = 0; this.engines0 = this.jug.count('engine');
  },
  update(g, dt){
    const live = this.tick(g, dt, 'Can\'t see my own wingtips in this dust. Stay close, boss.'), J = this.jug, C = this.P.copperton;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    const W = [[4, 4, 1, 'Fighters coming off her! Four of them!'], [80, 4, 2, 'Another flight off the Juggernaut. Two are going for the Margaret!'], [170, 5, 2, 'Last of her fighters. She\'s throwing everything at us!']];
    if (this.wave < W.length && this.pt > W[this.wave][0] && !beaten(J)) { const [, n, s, line] = W[this.wave++]; this.foes(g, 'syndicate', J.pos.clone().add(new V3(0, 60, 0)), n, {skill:0.5, strafe:s, shipTarget:this.ship}); G.HUD.radio(SPARKS(), line); }
    const left = Math.hypot(J.pos.x - C.x, J.pos.z - C.z), eng = J.alivePart('engine').length;
    if (!beaten(J)) g.markers.push({pos:J.pos.clone().add(new V3(0, 60, 0)), label:`JUGGERNAUT · ${eng} engines · ${fmtD(left)} from Copperton`, col:'#ff8a6a'});
    G.HUD.objective(beaten(J) ? 'She\'s finished. Mop up her fighters.' : `Stop the Juggernaut: ${eng} of ${this.engines0} engines turning · ${fmtD(left)} to Copperton`);
    if (!beaten(J) && left < 550) { G.HUD.radio(CAP(), 'She\'s over the mint. They\'re lowering men on lines. It\'s over.'); this.lose(g, 'mint'); }
    if (beaten(J) && !this.stopT) { this.stopT = this.pt; G.HUD.radio(CAP(), J.alive ? 'Her engines are dead! She\'s drifting with the dust. They\'re striking their colours!' : 'The Juggernaut\'s coming apart! Look at her fall!'); }
    if (this.stopT && (this.pt - this.stopT > 25 || !g.planes.some(p => p.alive && p.team !== 0))) this.win(g);
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ const J = this.jug, S = this.ship, eng = J.alivePart('engine').length;
    return [{text:this.sides[0].text, st:beaten(J) ? 'ok' : 'live', val:Math.round(J.hp/J.hpMax*100) + '%'}, {text:this.sides[1].text, st:!eng ? 'ok' : 'live', val:`${this.engines0 - eng}/${this.engines0}`},
            {text:this.sides[2].text, st:S.hp/S.hpMax >= 0.5 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(S.hp/S.hpMax*100) + '%'}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'Not one engine left turning, and the Margaret barely scratched. The Juggernaut\'s captain sang like a canary: the Syndicate builds its ships in the Frostback.', then:'The Juggernaut\'s logbook points north: a Syndicate works hidden somewhere in the Frostback mountains, and a survey party that went looking for it hasn\'t come back.'},
      success:{mood:'stern', say:'She\'s down and the mint\'s safe. Her logbook says she was built in the Frostback.', then:'The Juggernaut\'s logbook points north: a Syndicate works hidden somewhere in the Frostback mountains, and a survey party that went looking for it hasn\'t come back.'},
      fail:{mood:'angry', say:why === 'mint' ? 'The Juggernaut parked over the Copperton mint and emptied it. The Syndicate\'s rich, and we\'re not.' : why === 'margaret' ? 'The Margaret came down in the dust. Everyone\'s out.' : 'You took to the silk in the storm. The Juggernaut sailed on.', then:'She\'s refuelling at Copperton. We hit her again before she leaves.'}
    }[kind]));
  }
});

/* =====================================================================
   Chapter 8, Episode 1: Whiteout
   A survey party looking for the Syndicate's works crashed in a blizzard. Drop supplies to their three camps, then see the
   rescue blimp St. Bernard safely to Glacier Lodge while Frost Wolves on the Syndicate's payroll hunt her.
   ===================================================================== */
const CAMPS = [['falls', 'the frozen falls'], ['meadow', 'Avalanche Meadow'], ['lake', 'Lake Weiss']];
G.MISSIONS.c8m1 = EP({
  id:'c8m1', title:'Whiteout', place:'The Frostback Range', region:'frostback', wing:3, weather:'blizzard', weatherScript:[[150, 'snow', 'The blizzard\'s easing off. Still snowing, but at least you can see.']],
  brief:'Hale sent a survey party into the Frostback to find where the Syndicate builds its ships. Their plane went down in a blizzard, and they\'ve split into three camps with flares going: by the frozen falls, on Avalanche Meadow and out on Lake Weiss. Drop each camp a supply crate (low, under 230 ft, and slow, under 150 mph). The Edelweiss rescue blimp St. Bernard is going round the camps to lift them out and take them to Glacier Lodge. The Frost Wolves are on the Syndicate\'s payroll now, and they know she\'s coming.',
  sides:[{text:'Drop supplies at all three camps'}, {text:'The St. Bernard reaches Glacier Lodge above 50%'}, {text:'Down 5 Frost Wolves yourself'}],
  pay:{success:5000, perfect:2500, kill:250},
  worldOpts:world('frostback', 'day'),
  setup(g){
    this.start(g, `Hook's live, ${G.save.callsign || 'Ace'}. You can't see a thing out there. Look for the red flares.`, {heading:0});
    this.camps = CAMPS.map(([id, name]) => ({id, name, at:this.P[id].clone(), fed:false}));
    const A = this.P.edelweiss, L = this.P.lodge;
    this.bern = g.addShip({team:0, kind:'blimp', name:'St. Bernard', paint:{hull:0xe8e0cc, band:0x9e1b1b}, pos:new V3(A.x, ground(g, A.x, A.z) + 260, A.z), heading:0, speed:7.5, turn:0.012, hp:1700});
    // the St. Bernard lifts the party off the lake (the other two camps will ski down once they're fed) and makes for the lodge
    const lake = this.P.lake; this.bern.pos.set(lake.x + 900, ground(g, lake.x, lake.z) + 240, lake.z - 600); this.bern.speed = this.bern.speed0 = 11; this.bern.heading = Math.atan2(lake.x - this.bern.pos.x, lake.z - this.bern.pos.z); this.bern.turn0 = this.bern.turn = 0.05;
    this.stops = [lake, L]; this.stop = 0; this.bern.dest = this.stops[0].clone(); this.wave = 0; this.wait = 0;
  },
  update(g, dt){
    const live = this.tick(g, dt, 'I\'ve flown in milk that was easier to see through. Stick together.'), B = this.bern, P = g.player;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    // flares at the camps, and the drops
    for (const c of this.camps) {
      if (Math.random() < dt*6) g.fx.fire.emit(c.at.x, c.at.y + 1, c.at.z, 0, 6, 0, 3.5, 0.5, 1, 0.25, 0.2, 1, 0, 1, 2);
      if (!c.fed) {
        const dH = Math.hypot(P.pos.x - c.at.x, P.pos.z - c.at.z), agl = P.pos.y - ground(g, P.pos.x, P.pos.z), ok = dH < 90 && agl < 70 && P.speed < 150*0.44704;
        g.markers.push({pos:c.at.clone().setY(c.at.y + 10), label:dH < 600 ? `DROP · ${agl < 70 ? 'alt ✓' : 'under 230 ft'} · ${P.speed < 150*0.44704 ? 'speed ✓' : 'under 150 mph'}` : `CAMP · ${c.name.toUpperCase()}`, col:'#ff6a3a'});
        if (ok) { c.fed = true; g.spawnChute(P.pos.clone().add(new V3(0, -3, 0)), P.vel, {kind:'cargo'}); G.HUD.toast('Supplies away!'); if (g.audio) g.audio.ding(); G.HUD.radio('Survey party', G.pick(['Got it! Blankets and coffee! God bless you!', 'Crate\'s down, right on the flare. We\'ll hold out now.', 'Supplies! Tell the blimp we\'re ready to go.'])); }
      }
    }
    // the St. Bernard goes round the camps, hovers to winch each party up, then makes for the lodge
    const dest = this.stops[this.stop], dB = Math.hypot(B.pos.x - dest.x, B.pos.z - dest.z);
    if (this.stop === 0 && dB < 200) { B.speed = 0.5; this.wait += dt; if (this.wait > 14) { this.wait = 0; this.stop = 1; B.speed = B.speed0; B.dest = this.stops[1].clone(); G.HUD.radio('St. Bernard', 'The lake party\'s aboard, and the leader\'s got a map. Making for Glacier Lodge!'); } }
    const W = [[25, 3, 2, 'Wolves! Out of the snow, going for the St. Bernard!'], [95, 4, 2, 'More Frost Wolves. Syndicate money buys a lot of pilots.'], [175, 4, 3, 'Last pack. They\'re desperate. Keep them off her!']];
    if (this.wave < W.length && this.pt > W[this.wave][0]) { const [, n, s, line] = W[this.wave++], a = Math.random()*Math.PI*2; this.foes(g, 'wolves', B.pos.clone().add(new V3(Math.sin(a)*1500, 260, Math.cos(a)*1500)), n, {skill:0.45, strafe:s, shipTarget:B, face:B.pos}); G.HUD.radio(SPARKS(), line); }
    g.markers.push({pos:B.pos.clone().add(new V3(0, 25, 0)), label:`ST. BERNARD · ${Math.round(B.hp/B.hpMax*100)}%`, col:'#9ef0a0'});
    const fed = this.camps.filter(c => c.fed).length;
    G.HUD.objective(`Supplies: ${fed}/3 camps · the St. Bernard is ${this.stop === 0 ? (dB < 200 ? 'winching up the lake party' : 'heading for Lake Weiss') : `making for Glacier Lodge, ${fmtD(dB)}`}`);
    if (!B.alive) this.lose(g, 'bernard');
    else if (this.stop === 1 && Math.hypot(B.pos.x - this.stops[1].x, B.pos.z - this.stops[1].z) < 260) { G.HUD.radio('St. Bernard', 'Glacier Lodge, and every one of them alive. They say they found it: a factory dug into the ice.'); this.win(g); }
    G.HUD.sides(this.sideState(g));
  },
  shipDown(g, s){ if (s === this.bern) G.HUD.radio(SPARKS(), 'The St. Bernard\'s going down in the snow!'); },
  sideState(g){ const B = this.bern, fed = this.camps.filter(c => c.fed).length;
    return [{text:this.sides[0].text, st:fed === 3 ? 'ok' : 'live', val:`${fed}/3`}, {text:this.sides[1].text, st:!B.alive || B.hp/B.hpMax < 0.5 ? 'fail' : this.ended ? 'ok' : 'live', val:Math.round(B.hp/B.hpMax*100) + '%'},
            {text:this.sides[2].text, st:g.kills >= 5 ? 'ok' : 'live', val:`${Math.min(5, g.kills)}/5`}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'Every crate on the flare and every survivor home. They saw it before they went down: a sky-dock cut into the Long Dark, lit up like Christmas.', then:'The survey party found Kroll\'s works: a sky-dock inside the Long Dark, a tunnel through the Frostback where the Syndicate builds its ships. Tonight, we pay it a visit.'},
      success:{mood:'stern', say:'The St. Bernard made the lodge. The survey party found it: a factory inside the Long Dark.', then:'The survey party found Kroll\'s works: a sky-dock inside the Long Dark, a tunnel through the Frostback where the Syndicate builds its ships. Tonight, we pay it a visit.'},
      fail:{mood:'angry', say:why === 'bernard' ? 'The St. Bernard went down in the snow. The Edelweiss guides are out on skis looking for survivors.' : 'You came down in a snowfield. Dutch found you by your swearing.', then:'The survey party is still out there. We go again before the cold gets them.'}
    }[kind]));
  }
});

/* =====================================================================
   Chapter 8, Episode 2: The Glacier Dock
   Night raid on the Syndicate's works inside the Long Dark: knock out the flak and the fuel depot at the mouth, then fly into
   the tunnel and wreck the assembly hall. Something very fast leaves in a hurry.
   ===================================================================== */
G.MISSIONS.c8m2 = EP({
  id:'c8m2', title:'The Glacier Dock', place:'The Long Dark, Frostback Range', region:'frostback', wing:3, weather:'snow',
  brief:'The Syndicate\'s works is inside the Long Dark, a tunnel clean through the Frostback. Flak guards the mouth, and the fuel for everything Kroll builds sits in a tank farm out front. Knock out the flak, burn the fuel, then fly into the tunnel and wreck the assembly hall at the heart of it. It\'s night, it\'s snowing, and the tunnel turns. Fly it slow.',
  sides:[{text:'Silence the flak and burn the fuel depot'}, {text:'Wreck the assembly hall inside the Long Dark'}, {text:'Down 4 night fighters yourself'}],
  pay:{success:5500, perfect:2500, kill:250},
  worldOpts:world('frostback', 'night'),
  setup(g){
    this.start(g, `Hook's live, ${G.save.callsign || 'Ace'}. Lights off, guns hot. The Long Dark's dead ahead.`, {heading:0});
    const tn = this.scene.tunnels.find(t => t.T.td.id === 'longdark') || this.scene.tunnels[0], T = tn.T, e = T.pts[T.i0], e2 = T.pts[Math.max(0, T.i0 - 6)];
    this.tn = tn; const out = new V3(e2.x - e.x, 0, e2.z - e.z).normalize(), lat = new V3(out.z, 0, -out.x);
    const mouth = new V3(e.x, 0, e.z).addScaledVector(out, 140), at = (f, l) => { const p = mouth.clone().addScaledVector(out, f).addScaledVector(lat, l); p.y = ground(g, p.x, p.z); return p; };
    this.target(g, 'flak', 'FLAK', at(40, -90), {hp:220}); this.target(g, 'flak', 'FLAK', at(40, 90), {hp:220}); this.target(g, 'flak', 'FLAK', at(260, 0), {hp:220});
    for (const [f, l] of [[150, -40], [170, 0], [150, 40]]) this.target(g, 'tank', 'FUEL', at(f, l), {hp:160, col:0x5a5f64});
    const mid = T.pts[(T.i0 + T.i1) >> 1];
    this.hall = this.target(g, 'hall', 'ASSEMBLY HALL', new V3(mid.x, T.floor + 0.2, mid.z), {hp:420, r:14, block:false});
    this.hall.group.rotation.y = Math.atan2(mid.lx || 0, mid.lz || 1);
    this.ship.pos.copy(mouth).addScaledVector(out, 3200).setY(900); this.ship.dest = mouth.clone(); this.ship.turn0 = 0.006;
    this.mouth = mouth; this.out = out; this.wave = 0;
    // flying the length of the tunnel counts
    const pass0 = this.scene.tunnelPass.bind(this.scene); this.scene.tunnelPass = t => { if (t === tn) this.through = true; return pass0(t); };
  },
  update(g, dt){
    const live = this.tick(g, dt, 'Night flying in a snowstorm into a mountain. Who plans these things?');
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    this.targetsTick(g, dt);
    const outside = this.T.filter(t => t !== this.hall), outLeft = outside.filter(t => t.alive).length;
    const W = [[20, 3, 'Night fighters off the dock! Frost Wolves, and grey ones with them.'], [100, 3, 'They\'re scrambling everything they\'ve got.']];
    if (this.wave < W.length && this.pt > W[this.wave][0]) { const [, n, line] = W[this.wave++]; this.foes(g, this.wave === 1 ? 'wolves' : 'syndicate', this.mouth.clone().addScaledVector(this.out, 400).setY(this.mouth.y + 300), n, {skill:0.5}); G.HUD.radio(SPARKS(), line); }
    if (!outLeft && !this.saidIn) { this.saidIn = true; G.HUD.radio(SPARKS(), 'Fuel\'s burning like the Fourth of July! Now the hall. It\'s inside the tunnel, halfway through.'); }
    const T = this.tn.T, e = T.pts[T.i0];
    if (outLeft === 0 && this.hall.alive) g.markers.push({pos:new V3(e.x, T.floor + T.td.bh*0.5, e.z), label:'THE LONG DARK · FLY IN', col:'#f2c14e'});
    G.HUD.objective(outLeft ? `Silence the flak and burn the fuel: ${outLeft} left` : this.hall.alive ? 'Fly into the Long Dark and wreck the assembly hall' : 'Get out of there!');
    if (!this.hall.alive && !this.goneT) {
      this.goneT = this.pt; G.HUD.radio(SPARKS(), 'The hall\'s gone up! Get out, get out!');
      setTimeout(() => { if (G.game === g) G.HUD.radio('Dutch', 'Something just shot out the far end of the tunnel. No propeller noise... no, there is. And a rocket. Fastest thing I ever saw.'); }, 4500);
    }
    if (this.goneT && this.pt - this.goneT > 14) this.win(g);
    G.HUD.sides(this.sideState(g));
  },
  onTargetDown(g, t){ if (t.kind === 'tank') { g.fx.burner(t.pos, 60); for (const o of this.T) if (o.alive && o.kind === 'tank' && o.pos.distanceTo(t.pos) < 70 && Math.random() < 0.5) setTimeout(() => { if (o.alive) g.hitTarget(o, 999, null); }, 600 + Math.random()*800); } },
  sideState(g){ const outLeft = this.T.filter(t => t !== this.hall && t.alive).length;
    return [{text:this.sides[0].text, st:outLeft ? 'live' : 'ok', val:`${this.T.length - 1 - outLeft}/${this.T.length - 1}`}, {text:this.sides[1].text, st:this.hall.alive ? 'live' : 'ok', val:''},
            {text:this.sides[2].text, st:g.kills >= 4 ? 'ok' : 'live', val:`${Math.min(4, g.kills)}/4`}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'The Long Dark\'s burning end to end and Kroll\'s works is scrap. But something got out: a prototype, and Hale says the pilot is the best the Syndicate has.', then:'Out of the burning works flew Kroll\'s secret: the Hornet, a rocket-boosted interceptor, flown by his test pilot Liesl Varga. She\'s escorting Kroll\'s flagship out of the mountains at dawn.'},
      success:{mood:'stern', say:'The works is wrecked. Something fast got out the far end.', then:'Out of the burning works flew Kroll\'s secret: the Hornet, a rocket-boosted interceptor, flown by his test pilot Liesl Varga. She\'s escorting Kroll\'s flagship out of the mountains at dawn.'},
      fail:{mood:'angry', say:why === 'margaret' ? 'The Margaret came down on a glacier. Nobody hurt, everybody cold.' : 'You came down in the snow outside the Long Dark. The Wolves took you in for the night. Hale paid.', then:'Kroll\'s works is still building. We go back in tomorrow night.'}
    }[kind]));
  }
});

/* =====================================================================
   Chapter 8, Episode 3: The Hornet
   Liesl Varga in the Hornet escorts Kroll's flagship, the Colossus, out of the mountains. Get a photograph of the Colossus for
   Hale, and shoot the Hornet down before Varga can get back aboard her.
   ===================================================================== */
G.MISSIONS.c8m3 = EP({
  id:'c8m3', title:'The Hornet', place:'Above the Frostback summit', region:'frostback', wing:3,
  brief:'At dawn Ambrose Kroll\'s flagship, the Colossus, slips out of the Frostback, and his prize pilot Liesl Varga flies the Hornet beside her: contra-rotating propellers and a rocket motor in the tail that makes her the fastest thing in the sky for a few seconds at a time. Hale wants two things. A photograph of the Colossus, so the navy knows what it\'s fighting. And the Hornet, in pieces. Don\'t chase her when she lights the rocket; she\'ll come back to fight, she always does.',
  sides:[{text:'Shoot down Liesl Varga in the Hornet'}, {text:'Photograph the Colossus (camera: P)'}, {text:'Keep the Margaret above 60%'}],
  pay:{success:6000, perfect:3000, kill:250},
  worldOpts:world('frostback', 'day'),
  setup(g){
    this.start(g, `Hook's live, ${G.save.callsign || 'Ace'}. Clear dawn. There's the Colossus over the summit, and a black-and-yellow speck beside her.`, {heading:0});
    const S = this.P.summit, M = this.ship.pos;
    this.col = g.addShip({team:1, kind:'raider', name:'Colossus', label:'COLOSSUS', paint:Object.assign({scale:2.2, hpMul:6}, SYN_SHIP), pos:new V3(S.x, ground(g, S.x, S.z) + 650, S.z), heading:Math.atan2(S.x - M.x, S.z - M.z), speed:5, turn:0.003, noRun:true, dest:new V3(S.x + (S.x - M.x)*3, 0, S.z + (S.z - M.z)*3)});
    for (const c of this.col.comps || []) c.hp *= 5;
    this.wave = 0; this.boostT = 18;
  },
  update(g, dt){
    const live = this.tick(g, dt, 'Rocket plane, huh? I bet it can\'t turn.'), C = this.col, P = g.player;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    if (!this.hornet && this.pt > 5) {
      this.hornet = this.ace(g, 'Liesl Varga', 'hornet', [0x2a2a2a, 0xf2c14e, 0x9e1b1b], C.pos.clone().add(new V3(250, 40, 0)), {skill:0.92, tough:2.3, guns:['60', '60', '50', '50']});
      G.HUD.radio(VARGA, 'Lucky Thirteen. Herr Kroll said you would come. He also said you would die. Shall we see which of us he was right about?');
      this.foes(g, 'syndicate', C.pos.clone().add(new V3(-200, -40, 200)), 3, {skill:0.5});
    }
    const V = this.hornet;
    if (V && V.alive) {
      // she lights the rocket to break away or to come screaming back in
      this.boostT -= dt; const d = V.pos.distanceTo(P.pos);
      if (this.boostT <= 0 && (d < 220 || d > 1400)) { this.boostT = 16 + Math.random()*8; V.nitro = 5; G.HUD.toast('The Hornet lights her rocket!'); if (Math.random() < 0.4) G.HUD.radio(VARGA, G.pick(['Too slow, Thirteen.', 'Catch me if you can.', 'You fly like a mail plane.'])); }
      if (V.internal < V.internalMax*0.35 && !this.fleeing) { this.fleeing = true; G.HUD.radio(VARGA, 'Herr Kroll, I am hit. I am coming aboard.'); const pl = g.pilots.find(x => x.p === V); if (pl) { pl.role = 'flee'; pl.state = 'extend'; pl.t = 999; } }
      if (this.fleeing) { const pl = g.pilots.find(x => x.p === V); if (pl) pl.dir = tA.copy(C.pos).sub(V.pos).normalize().clone(); if (V.pos.distanceTo(C.pos) < 160) { G.HUD.radio(VARGA, 'Aboard. Auf Wiedersehen, Thirteen.'); this.removeHornet(g); this.escaped = true; } }
    }
    if (!this.photo1 && this.photo(g, dt, C.pos, 1600)) { this.photo1 = true; G.HUD.toast('Got the Colossus on film'); G.HUD.radio(HALE, 'Good Lord. Six engines a side and a flight deck. The navy\'s going to need more ships.'); }
    if (!this.photo1 && P.pos.distanceTo(C.pos) < 4000) g.markers.push({pos:C.pos, label:this.framed ? 'IN FRAME · PRESS CAMERA' : 'COLOSSUS (photograph)', col:'#c9a6f0', box:true});
    G.HUD.objective(V && V.alive ? `Shoot down Liesl Varga in the Hornet${this.photo1 ? '' : ' · photograph the Colossus'}` : V ? (this.photo1 ? 'Done. Let the Colossus go; she\'s too big for us today.' : 'Photograph the Colossus before she gets away') : 'Close on the Colossus');
    const away = Math.hypot(C.pos.x - this.P.summit.x, C.pos.z - this.P.summit.z);
    if (V && !V.alive && !this.escaped && (this.photo1 || away > 5000) && !this.downT) this.downT = this.pt;
    if (this.downT && this.pt - this.downT > 6) this.win(g);
    if (this.escaped && !this.escT) this.escT = this.pt;
    if (this.escT && this.pt - this.escT > 5) this.lose(g, 'escaped');
    G.HUD.sides(this.sideState(g));
  },
  removeHornet(g){ const V = this.hornet; V.alive = false; g.scene.remove(V.obj); g.planes = g.planes.filter(x => x !== V); g.pilots = g.pilots.filter(pl => pl.p !== V); },
  killed(g, p){ if (p === this.hornet) G.HUD.radio(SPARKS(), 'The Hornet\'s going down! She\'s out, there\'s her chute! And the Hornet\'s gliding, not burning... she\'s putting down on the glacier!'); },
  sideState(g){ const V = this.hornet, S = this.ship;
    return [{text:this.sides[0].text, st:V && !V.alive && !this.escaped ? 'ok' : this.escaped ? 'fail' : 'live', val:V && V.alive ? Math.round(V.internal/V.internalMax*100) + '%' : ''}, {text:this.sides[1].text, st:this.photo1 ? 'ok' : 'live', val:''},
            {text:this.sides[2].text, st:S.hp/S.hpMax >= 0.6 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(S.hp/S.hpMax*100) + '%'}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'Varga\'s in a cell at Glacier Lodge, the Hornet\'s on a sledge, and Hale has a photograph of the Colossus. Hollis is already asking for the Hornet.', then:'Varga talked: Kroll is taking the Colossus to the Corsair Keys to buy the corsairs and crush the navy in one stroke. Hale is gathering every ship he can find.'},
      success:{mood:'stern', say:'The Hornet\'s down on the glacier and Varga\'s in irons. The Colossus got away south.', then:'Varga talked: Kroll is taking the Colossus to the Corsair Keys to buy the corsairs and crush the navy in one stroke. Hale is gathering every ship he can find.'},
      fail:{mood:'angry', say:why === 'escaped' ? 'Varga landed the Hornet on the Colossus and they\'re gone south.' : why === 'margaret' ? 'The Margaret\'s down on the summit snowfield. Everyone\'s out.' : 'The Hornet got you. You came down under silk over the summit.', then:'The Colossus is still over the mountains. One more try before she\'s gone.'}
    }[kind]), {varga:kind === 'fail' ? 'loose' : 'caught', colPhoto:this.photo1 ? 1 : 0});
  }
});

/* =====================================================================
   Chapter 9, Episode 1: Rallying the Keys
   The Syndicate hits HMS Resolute and HMS Valiant at anchor over Fort Maravilla. Hold them off till the corsairs decide whose
   side they're on.
   ===================================================================== */
const NAVY_SHIP = {hull:0x8a96a4, band:0x2a3a52, trim:0xb88a2a};
G.MISSIONS.c9m1 = EP({
  id:'c9m1', title:'Rallying the Keys', place:'Fort Maravilla, the Corsair Keys', region:'keys', wing:3,
  brief:'Commodore Hale has two airships left in the Keys, HMS Resolute and HMS Valiant, moored over Fort Maravilla while he tries to talk the corsairs into joining him. The Syndicate means to sink them first. Keep both ships flying until the corsairs make up their minds. Rosa says they will, if somebody shows them the navy can still fight.',
  sides:[{text:'Both navy airships survive'}, {text:'Down 8 Syndicate fighters yourself'}, {text:'Keep the Margaret above 60%'}],
  pay:{success:5500, perfect:2500, kill:250},
  worldOpts:world('keys', 'day'),
  setup(g){
    this.start(g, `Hook's live, ${G.save.callsign || 'Ace'}. That's the Resolute and the Valiant over the fort. Hale says hello.`, {heading:0});
    const F = this.P.fort;
    this.navy = [['HMS Resolute', 1], ['HMS Valiant', -1]].map(([name, s]) => g.addShip({team:0, name, paint:NAVY_SHIP, pos:new V3(F.x + s*420, 560, F.z + 200), heading:Math.PI/2, speed:2.5, turn:0.004, hp:4200, flak:true, guns:[new V3(7, -24, 26), new V3(-7, -24, -8)], noRun:true}));
    this.ship.pos.set(F.x, 760, F.z - 2200); this.ship.dest = F.clone(); this.ship.turn0 = 0.006; this.wave = 0;
  },
  update(g, dt){
    const live = this.tick(g, dt, 'The Keys again. Last time we were here, we were the pirates.'), F = this.P.fort;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    const W = [[6, 4, 2, 'Syndicate strike, out of the south! Two of them are going for the Resolute!'], [70, 5, 3, 'Second wave. Torpedo bombers with them!'], [140, 5, 3, 'Here comes the big one. The corsairs are watching, sugar. Make it count.']];
    if (this.wave < W.length && this.pt > W[this.wave][0]) {
      const [, n, s, line] = W[this.wave++], a = Math.PI + (Math.random() - 0.5)*1.2, from = new V3(F.x + Math.sin(a)*2400, 650, F.z + Math.cos(a)*2400);
      const tgt = this.navy.filter(x => x.alive)[this.wave % 2] || this.navy.find(x => x.alive);
      this.foes(g, 'syndicate', from, n, {skill:0.5, strafe:s, shipTarget:tgt, face:F}); G.HUD.radio(SPARKS(), line);
    }
    if (this.wave === 3 && !this.corsairs && this.pt > 165) {
      this.corsairs = true; const R = G.CONTACTS.rosa ? G.CONTACTS.rosa.name : 'Rosa';
      this.friends(g, new V3(F.x + 2000, 600, F.z + 800), [['Corsair "Marlin" Reyes', 'bulldog', [0x1f6f9e, 0xf1e9d6, 0xd94f4f]], ['Corsair "Barracuda" Soto', 'vandal', [0x0f3b55, 0xd9b44a, 0xd94f4f]], ['Corsair "Gaff" Ortega', 'thunderbuss', [0x1f6f9e, 0xf1e9d6, 0xd94f4f]]]);
      G.HUD.radio(R.replace(/".*" /, ''), 'The corsairs of the Keys have seen enough. Commodore, you have yourself an armada. Muchachos, take the grey ones!');
    }
    for (const s of this.navy) if (s.alive) g.markers.push({pos:s.pos.clone().add(new V3(0, 40, 0)), label:`${s.name.toUpperCase()} · ${Math.round(s.hp/s.hpMax*100)}%`, col:'#9ec7f0', edgeOnly:true});
    const foes = g.planes.filter(p => p.alive && p.team !== 0).length;
    G.HUD.objective(`Protect the Resolute and the Valiant · wave ${this.wave} of 3 · ${foes} bandits`);
    if (this.navy.some(s => !s.alive)) this.lose(g, 'navy');
    else if (this.wave === 3 && this.corsairs && !foes) { G.HUD.radio(HALE, 'Both ships flying and the corsairs on our side. Thirteen, I could kiss you. I won\'t.'); this.win(g); }
    G.HUD.sides(this.sideState(g));
  },
  shipDown(g, s){ if (this.navy.includes(s)) G.HUD.radio(HALE, `The ${s.name.replace('HMS ', '')} is gone! Abandon ship!`); },
  sideState(g){ const S = this.ship;
    return [{text:this.sides[0].text, st:this.navy.every(s => s.alive) ? (this.ended ? 'ok' : 'live') : 'fail', val:this.navy.map(s => Math.round(s.hp/s.hpMax*100) + '%').join(' · ')}, {text:this.sides[1].text, st:g.kills >= 8 ? 'ok' : 'live', val:`${Math.min(8, g.kills)}/8`},
            {text:this.sides[2].text, st:S.hp/S.hpMax >= 0.6 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(S.hp/S.hpMax*100) + '%'}]; },
  result(g, kind, why){
    const F = flags(), allies = [F.kit === 'free' ? 'Kit Calloway has sent word she\'s flying in to help her sister' : '', F.bess === 'spared' ? 'Red Bess Malone says she owes the Thirteen one more favour' : ''].filter(Boolean);
    const more = allies.length ? ` And from Volume II's loose ends: ${allies.join('; ')}.` : '';
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'Not a scratch on the navy and the corsairs signed on. Hale has his armada.' + more, then:'The navy, the corsairs and the Lucky Thirteen sail together. The Syndicate\'s fleet is coming: two big raiders, the Anvil and the Hammer, out ahead of the Colossus.'},
      success:{mood:'stern', say:'Both ships are still flying and the corsairs are in.' + more, then:'The navy, the corsairs and the Lucky Thirteen sail together. The Syndicate\'s fleet is coming: two big raiders, the Anvil and the Hammer, out ahead of the Colossus.'},
      fail:{mood:'angry', say:why === 'navy' ? 'We lost a navy ship over the fort. The corsairs are laughing at Hale.' : why === 'margaret' ? 'The Margaret\'s in the sea off Maravilla. Everyone swam ashore.' : 'You went into the water off the fort.', then:'Hale has one more day to win the corsairs over. We try again.'}
    }[kind]));
  }
});

/* =====================================================================
   Chapter 9, Episode 2: Fleet Action
   The allied fleet meets the Syndicate's raiders Anvil and Hammer off Puerto Azul. Airship against airship, torpedoes and all.
   ===================================================================== */
G.MISSIONS.c9m2 = EP({
  id:'c9m2', title:'Fleet Action', place:'Off Puerto Azul, the Corsair Keys', region:'keys', wing:3,
  brief:'The Syndicate\'s fleet is coming in two big raiders, the Anvil and the Hammer, with fighters thick around them. Hale\'s armada meets them off Puerto Azul: HMS Resolute, the corsair raider Sea Witch and the Margaret, airship against airship, torpedoes and all. Shoot down the torpedoes aimed at our ships, knock out the raiders\' engines or bring them down, and don\'t let us lose a ship. Your friends from the Calavera days may turn up.',
  sides:[{text:'Stop both Syndicate raiders'}, {text:'Lose no allied airship'}, {text:'Down 6 fighters yourself'}],
  pay:{success:6500, perfect:3000, kill:250},
  worldOpts:world('keys', 'evening'),
  setup(g){
    this.start(g, `Hook's live, ${G.save.callsign || 'Ace'}. Fleet's in line. There they are, on the horizon.`, {heading:0});
    const A = this.P.puerto, M = this.ship.pos.set(A.x - 300, 700, A.z - 2600);
    this.res = g.addShip({team:0, name:'HMS Resolute', paint:NAVY_SHIP, pos:new V3(M.x - 600, 680, M.z - 200), heading:0, speed:5, turn:0.005, hp:5000, flak:true, guns:[new V3(7, -24, 26), new V3(-7, -24, -8)], noRun:true});
    this.witch = g.addShip({team:0, kind:'raider', name:'Sea Witch', label:'SEA WITCH', paint:{hull:0x0f3b55, band:0xd94f4f, trim:0xf1e9d6}, pos:new V3(M.x + 600, 660, M.z - 100), heading:0, speed:6, turn:0.008, noRun:true});
    const ahead = new V3(M.x, 0, M.z + 3600);
    this.anvil = g.addShip({team:1, kind:'raider', name:'Anvil', label:'ANVIL', paint:Object.assign({scale:1.2, hpMul:1.4}, SYN_SHIP), pos:ahead.clone().add(new V3(-500, 660, 0)), heading:Math.PI, speed:5, turn:0.006, noRun:true});
    this.hammer = g.addShip({team:1, kind:'raider', name:'Hammer', label:'HAMMER', paint:Object.assign({scale:1.2, hpMul:1.4}, SYN_SHIP), pos:ahead.clone().add(new V3(500, 700, 200)), heading:Math.PI, speed:5, turn:0.006, noRun:true});
    this.res.foe = this.anvil; this.witch.foe = this.hammer; this.anvil.foe = this.res; this.hammer.foe = this.witch; this.ship.foe = this.anvil; this.ship.dest = null; this.ship.standoff = 1100;
    this.allies = [this.res, this.witch]; this.wave = 0;
    if (flags().mastodon === 'delivered') {   // The Heavy paid off: Hale's bomber flies with the fleet, gunners and all
      this.heavy = this.friends(g, new V3(M.x - 200, 620, M.z - 500), [['HMA Mastodon', 'mastodon', MASTODON_PAINT]])[0];
      if (this.heavy) { this.heavy.callsign = 'Mastodon'; G.HUD.radio('Mastodon', 'Mastodon on station, Thirteen. Four engines, four gunners and a belly full of trouble. Point us at something.'); }
    }
  },
  update(g, dt){
    const live = this.tick(g, dt, 'A real fleet battle. My grandmother would be proud. She was a pirate.'), en = [this.anvil, this.hammer];
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    if (!this.pals && this.pt > 8) {
      this.pals = true; const F = flags(), list = [], at = this.ship.pos.clone().add(new V3(0, -80, 300));
      if (F.kit === 'free') list.push(['Kit Calloway', 'sparrowhawk', [0x2a3a52, 0xe8e0cc, 0xd94f8a]]);
      if (F.bess === 'spared') list.push(['Red Bess Malone', 'highwayman', [0x9e1b1b, 0x161616, 0xe8e0cc]]);
      if (list.length) { this.friends(g, at, list).forEach(p => { p.internalMax *= 1.6; p.internal = p.internalMax; });
        if (F.kit === 'free') G.HUD.radio('Kit', 'Mabel? It\'s Kit. Thought you could use another gun. Don\'t cry on the radio.');
        if (F.bess === 'spared') setTimeout(() => G.HUD.radio('Red Bess', 'Bess Malone pays her debts, Thirteen. Twice, if she likes you.'), 4000); }
    }
    // the raiders' fighters, launched as the fleets close
    const W = [[10, 5, 2, 'Fighters off both raiders! Torpedo planes with them!'], [90, 5, 2, 'Second launch. They\'re going for the Resolute!'], [170, 4, 2, 'Last of their fighters!']];
    if (this.wave < W.length && this.pt > W[this.wave][0]) { const [, n, s, line] = W[this.wave++], src = en.find(x => !beaten(x)) || en[0]; this.foes(g, 'syndicate', src.pos.clone().add(new V3(0, 40, 0)), n, {skill:0.5, strafe:s, shipTarget:this.allies.find(x => x.alive)}); G.HUD.radio(SPARKS(), line); }
    // when one of theirs is out of the fight, our ship turns on the other
    for (const s of [this.res, this.witch, this.ship]) if (s.alive && s.foe && beaten(s.foe)) s.foe = en.find(x => !beaten(x)) || null;
    for (const s of en) if (!beaten(s)) g.markers.push({pos:s.pos.clone().add(new V3(0, 55, 0)), label:`${s.name.toUpperCase()} · ${s.alivePart('engine').length} engines`, col:'#ff8a6a'});
    G.HUD.objective(`Stop the Anvil and the Hammer · shoot down torpedoes aimed at our ships · ${en.filter(s => !beaten(s)).length} raiders fighting`);
    if (this.allies.some(s => !s.alive) && !this.lostOne) { this.lostOne = true; }
    if (!this.res.alive && !this.witch.alive) this.lose(g, 'fleet');
    else if (en.every(beaten) && !this.doneT) { this.doneT = this.pt; G.HUD.radio(HALE, 'Both raiders out of the fight! Well done, all ships. Now for the Colossus.'); }
    if (this.doneT && this.pt - this.doneT > 12) this.win(g);
    G.HUD.sides(this.sideState(g));
  },
  shipDown(g, s){ if (s === this.res) G.HUD.radio(HALE, 'Resolute\'s finished! Abandon ship!'); if (s === this.witch) G.HUD.radio('Sea Witch', '¡Nos hundimos! The Witch is going down!'); if (s === this.anvil || s === this.hammer) G.HUD.radio(SPARKS(), `The ${s.name} is going down in flames!`); },
  sideState(g){ const en = [this.anvil, this.hammer];
    return [{text:this.sides[0].text, st:en.every(beaten) ? 'ok' : 'live', val:`${en.filter(beaten).length}/2`}, {text:this.sides[1].text, st:this.allies.every(s => s.alive) ? (this.ended ? 'ok' : 'live') : 'fail', val:this.allies.filter(s => s.alive).length + ' afloat'},
            {text:this.sides[2].text, st:g.kills >= 6 ? 'ok' : 'live', val:`${Math.min(6, g.kills)}/6`}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'Two Syndicate raiders out of the fight and not one of ours lost. The Keys haven\'t seen a fleet action like it in a hundred years.', then:'Only the Colossus is left, and Kroll is aboard her. A tropical storm is blowing up, and he means to use it to reach Puerto Azul and burn the navy yards.'},
      success:{mood:'stern', say:'Both raiders are beaten, but it cost us. The fleet\'s battered.', then:'Only the Colossus is left, and Kroll is aboard her. A tropical storm is blowing up, and he means to use it to reach Puerto Azul and burn the navy yards.'},
      fail:{mood:'angry', say:why === 'fleet' ? 'The Resolute and the Sea Witch are both gone. The armada\'s broken.' : why === 'margaret' ? 'The Margaret took a torpedo amidships. Everyone\'s in the boats.' : 'You went into the sea off Puerto Azul. The corsairs fished you out.', then:'Hale\'s patching up what\'s left. One more go at the Anvil and the Hammer.'}
    }[kind]));
  }
});

/* =====================================================================
   Chapter 9, Episode 3: The Colossus
   In a tropical storm, Kroll's flagship drives on Puerto Azul. Stop her, then catch Kroll as he runs for Smuggler's Grotto.
   ===================================================================== */
G.MISSIONS.c9m3 = EP({
  id:'c9m3', title:'The Colossus', place:'Puerto Azul, the Corsair Keys', region:'keys', wing:3, weather:'tropical', weatherScript:[[230, 'squall', 'The worst of the storm\'s passing over.']],
  brief:'The Colossus is coming for Puerto Azul in the teeth of a tropical storm: six engines a side, a flight deck, and Ambrose Kroll on her bridge. Stop her before she reaches the navy yards: knock out her engines, or bring her down. Kroll won\'t go down with her; he never does. When she\'s finished, he\'ll run. Don\'t let him get away.',
  sides:[{text:'Stop the Colossus before she reaches Puerto Azul'}, {text:'Catch Ambrose Kroll'}, {text:'Keep the Margaret above 50%'}],
  pay:{success:8000, perfect:4000, kill:250},
  worldOpts:world('keys', 'day'),
  setup(g){
    this.start(g, `Hook's live, ${G.save.callsign || 'Ace'}. Hang on to something. This is the big one.`, {heading:0});
    const A = this.P.puerto, from = new V3(A.x + 900, 0, A.z - 5200);
    this.col = g.addShip({team:1, kind:'raider', name:'Colossus', label:'COLOSSUS', paint:Object.assign({scale:2.2, hpMul:4}, SYN_SHIP), pos:from.clone().setY(620), heading:Math.atan2(A.x - from.x, A.z - from.z), speed:5.5, turn:0.004, noRun:true, dest:A.clone()});
    G.toughen(this.col, 1.3);
    this.ship.pos.set(A.x - 1600, 760, A.z - 3000); this.ship.dest = null; this.ship.foe = this.col; this.ship.standoff = 1500;
    this.e0 = this.col.count('engine'); this.wave = 0; this.stage = 'ship';
    const F = flags(), pals = [];
    if (F.kit === 'free') pals.push(['Kit Calloway', 'sparrowhawk', [0x2a3a52, 0xe8e0cc, 0xd94f8a]]);
    if (F.bess === 'spared') pals.push(['Red Bess Malone', 'highwayman', [0x9e1b1b, 0x161616, 0xe8e0cc]]);
    this.palList = pals;
  },
  update(g, dt){
    const live = this.tick(g, dt, 'All of us. Every last plane. Let\'s finish it.'), C = this.col, A = this.P.puerto, P = g.player;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    if (!this.pals && this.pt > 6) { this.pals = true; if (this.palList.length) this.friends(g, this.ship.pos.clone().add(new V3(0, -60, 300)), this.palList); this.friends(g, this.ship.pos.clone().add(new V3(200, -40, 200)), [['Corsair "Marlin" Reyes', 'bulldog', [0x1f6f9e, 0xf1e9d6, 0xd94f4f]]]); }
    if (this.stage === 'ship') {
      const W = [[8, 5, 2, 'Fighters off the Colossus\'s deck! Here they come!'], [80, 5, 2, 'More off the deck. She\'s a carrier, sugar!'], [160, 6, 3, 'Everything she\'s got left!']];
      if (this.wave < W.length && this.pt > W[this.wave][0] && !beaten(C)) { const [, n, s, line] = W[this.wave++]; this.foes(g, 'syndicate', C.pos.clone().add(new V3(0, 80, 0)), n, {skill:0.55, strafe:s, shipTarget:this.ship}); G.HUD.radio(SPARKS(), line); }
      if (this.wave === 1 && !this.krollSaid && this.pt > 14) { this.krollSaid = true; G.HUD.radio(KROLL, 'The Lucky Thirteen. You owe me a factory, a railway and a test pilot. I will take Puerto Azul instead.'); }
      const left = Math.hypot(C.pos.x - A.x, C.pos.z - A.z), eng = C.alivePart('engine').length;
      g.markers.push({pos:C.pos.clone().add(new V3(0, 80, 0)), label:`COLOSSUS · ${eng} engines · ${fmtD(left)} from Puerto Azul`, col:'#ff8a6a'});
      G.HUD.objective(`Stop the Colossus: ${eng} of ${this.e0} engines turning · ${fmtD(left)} to Puerto Azul`);
      if (left < 700) { G.HUD.radio(HALE, 'She\'s over the yards. They\'re burning. It\'s over, Thirteen.'); this.lose(g, 'yards'); }
      if (beaten(C)) this.flee(g);
    } else this.chase(g, dt);
    G.HUD.sides(this.sideState(g));
  },
  /* Kroll takes his private plane off the Colossus and makes for Smuggler's Grotto, the sea cave, and out the far side */
  flee(g){
    this.stage = 'chase'; const C = this.col;
    G.HUD.radio(CAP(), C.alive ? 'Her engines are dead! The Colossus is drifting!' : 'The Colossus is breaking up!');
    const tn = this.scene.tunnels.find(t => t.T.td.id === 'grotto') || this.scene.tunnels[0], T = tn.T;
    const path = [C.pos.clone().add(new V3(0, -30, 120))], e0 = T.pts[T.i0], e1 = T.pts[T.i1], y = T.floor + T.td.bh*0.45;
    const before = T.pts[Math.max(0, T.i0 - 8)], after = T.pts[Math.min(T.pts.length - 1, T.i1 + 8)];
    path.push(new V3(before.x, y + 140, before.z), new V3(before.x, y, before.z));
    for (let i = T.i0; i <= T.i1; i++) path.push(new V3(T.pts[i].x, y, T.pts[i].z));
    const out = new V3(after.x - e1.x, 0, after.z - e1.z).normalize();
    path.push(new V3(after.x, y + 4, after.z), new V3(e1.x, y + 60, e1.z).addScaledVector(out, 900), new V3(e1.x, y + 220, e1.z).addScaledVector(out, 6000));
    this.kPath = path; let s = 0; this.kS = path.map((p, i) => (s += i ? p.distanceTo(path[i - 1]) : 0)); this.kLen = s; this.kd = 0; this.exitS = this.kS[path.length - 4];
    const L = G.stockLoadout('mantis'); L.paint = [0x1a1a1a, 0xd9b44a, 0xe8e0cc];
    this.kroll = g.addPlane({loadout:L, team:1, name:'Ambrose Kroll', callsign:'Kroll', pos:path[0].clone(), q:new Q(), speed:70, internalMul:1.3}); this.kroll.ace = true;
    setTimeout(() => { if (G.game === g) G.HUD.radio(KROLL, G.pick(['You have won nothing, Thirteen. I will build another.', 'There are always more ships. There is only one of me.'])); }, 2000);
    setTimeout(() => { if (G.game === g) G.HUD.radio(SPARKS(), 'Kroll\'s running in a little black plane! He\'s heading for Smuggler\'s Grotto. If he gets through that cave we\'ll never find him!'); }, 4500);
  },
  chase(g, dt){
    const K = this.kroll, P = g.player;
    if (K.alive) {
      // Kroll flies his line like a man who knows every rock in the Keys: a set path, through the cave and away
      this.kd = Math.min(this.kLen, this.kd + 68*dt); let i = 1; while (i < this.kS.length - 1 && this.kS[i] < this.kd) i++;
      const a = this.kPath[i - 1], b = this.kPath[i], t = (this.kd - this.kS[i - 1])/Math.max(0.01, this.kS[i] - this.kS[i - 1]);
      K.pos.copy(a).lerp(b, t); const dir = tA.copy(b).sub(a).normalize(); K.q.setFromUnitVectors(Z, dir); K.vel.copy(dir).multiplyScalar(68); K.speed = 68; K.throttle = 1; K.axes(); K.sync && K.sync(0);
      g.markers.push({pos:K.pos, label:`KROLL · ${fmtD(K.pos.distanceTo(P.pos))}`, col:'#ff3b30'});
      G.HUD.objective(this.kd < this.exitS ? 'Catch Kroll before he gets through Smuggler\'s Grotto' : 'He\'s out of the cave! Shoot him down before he\'s gone!');
      if (this.kd >= this.kLen - 5) { G.HUD.radio(SPARKS(), 'He\'s gone. Over the horizon. Damn him.'); this.escaped = true; this.win(g); }
    } else if (!this.caughtT) { this.caughtT = this.pt; G.HUD.radio(SPARKS(), 'Kroll\'s down! He\'s in the water, hanging on to his silk, and the corsairs are rowing out to him with a very big net!'); }
    if (this.caughtT && this.pt - this.caughtT > 8) this.win(g);
  },
  sideState(g){ const C = this.col, S = this.ship, K = this.kroll;
    return [{text:this.sides[0].text, st:beaten(C) ? 'ok' : 'live', val:`${this.e0 - C.alivePart('engine').length}/${this.e0}`}, {text:this.sides[1].text, st:K && !K.alive ? 'ok' : this.escaped ? 'fail' : 'live', val:''},
            {text:this.sides[2].text, st:S.hp/S.hpMax >= 0.5 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(S.hp/S.hpMax*100) + '%'}]; },
  result(g, kind, why){
    const caught = this.kroll && !this.kroll.alive, F = flags(), pals = [F.kit === 'free' ? 'Kit' : '', F.bess === 'spared' ? 'Red Bess' : ''].filter(Boolean);
    const thanks = pals.length ? ` ${pals.join(' and ')} flew the whole way with us.` : '';
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'The Colossus is in the sea, Kroll is in a corsair\'s net, and the Margaret flew through a hurricane to see it.' + thanks, then:'The Iron Syndicate is finished and Ambrose Kroll is in irons. Augustin Hollis rebuilt the Hornet from the glacier wreck, and it\'s yours: the Hornet rocket interceptor, and four new liveries.'},
      success:{mood:'pleased', say:(caught ? 'The Colossus is beaten and Kroll\'s in a net.' : 'The Colossus is beaten, but Kroll got away through the grotto. He\'s a man with no fleet, no factory and no friends.') + thanks, then:'The Iron Syndicate is finished. Augustin Hollis rebuilt the Hornet from the glacier wreck, and it\'s yours: the Hornet rocket interceptor, and four new liveries.'},
      fail:{mood:'angry', say:why === 'yards' ? 'The Colossus burned the Puerto Azul yards. The armada will have to start again.' : why === 'margaret' ? 'The Margaret went into the storm sea. Everyone made the boats.' : 'You went into the sea in the storm. The corsairs found you, eventually.', then:'The Colossus is coming round for another pass. We meet her again.'}
    }[kind]), {kroll:caught ? 'caught' : this.escaped ? 'escaped' : 'loose'});
  }
});

/* =====================================================================
   Chapter 9, Episode 1½: The Heavy
   Hale's last four-engine bomber, the Mastodon, sits on a hidden navy field at Blackwater Cove with no crew fit to fly her.
   Land there, climb across into her (game.parkPlane / swapPlayer), and bring her the long way round to Puerto Azul
   with the Syndicate throwing everything it has at you. Win or lose, the fleet sails; the flag says whether she sails with it.
   ===================================================================== */
const COVE = {x:2633, z:-1900, yaw:-0.525, r:360};
const MASTODON_PAINT = [0x55606a, 0xe8e0cc, 0x1f3b6b];
G.MISSIONS.c9x1 = EP({
  id:'c9x1', title:'The Heavy', place:'Blackwater Cove to Puerto Azul, the Corsair Keys', region:'keys', wing:3,
  brief:'Hale has one heavy bomber left, the Mastodon: four engines, four gunners, and a bomb bay that could sink a raider in one pass. She\'s sitting on a navy field at Blackwater Cove, and her pilot\'s in the infirmary with a Syndicate slug in him. Fly out to the cove, land, climb into her and bring her to Puerto Azul for the fleet. On the way, the bay\'s carrying three crates of medicine for Rosa\'s people at the Rusty Anchor: open the bombsight (B), let the co-pilot fly, read the wind off their smoke pot and put one on their cross. The Syndicate knows she\'s there. They\'ll come for her the moment she\'s off the ground.',
  sides:[{text:'Bring the Mastodon in above half'}, {text:'A crate right on the cross'}, {text:'Lose no wingman'}],
  pay:{success:6000, perfect:2500, kill:250},
  worldOpts:() => { const w = G.regionWorld('keys', 'evening'); w.flats = w.flats.concat([{x:COVE.x, z:COVE.z, r:COVE.r}]); return w; },
  setup(g){
    this.start(g, `Hook's live, ${G.save.callsign || 'Ace'}. Blackwater Cove's off the starboard bow. Look for the navy field.`, {heading:2.2});
    const w = g.world, sh = Math.max(w.height(COVE.x, COVE.z), 0.4), yaw = COVE.yaw, at = new V3(COVE.x, sh, COVE.z);
    const strip = G.buildAirstrip(560, 26, {sign:'NAVY FIELD 9', firm:'Royal Navy Air Arm', walls:0xd8d2c0, trim:0x2a3a52}); strip.position.copy(at); strip.rotation.y = yaw; g.scene.add(strip);
    const ud = strip.userData, rot = v => v.clone().applyAxisAngle(new V3(0, 1, 0), yaw).add(at);
    g.runways.push({pos:at.clone(), yaw, hw:ud.wid/2 + 10, hl:ud.len/2 + 22});
    const apron = rot(ud.apron); g.runways.push({pos:apron, yaw, hw:26, hl:34});
    const bar = rot(new V3(ud.apron.x + 44, 0, ud.apron.z + 10)); w.addBlocker({x:bar.x, z:bar.z, hw:12, hd:12, top:sh + 13});
    this.cove = at; this.apron = apron;
    // the Mastodon, nose to the runway on the cove's apron, waiting for somebody mad enough to fly her
    const L = G.stockLoadout('mastodon'); L.paint = MASTODON_PAINT.slice(); L.rocket = 'he'; L.arm = [75, 65, 65, 65];   // the navy plated her for this run
    this.spot = g.parkPlane({loadout:L, pos:apron.clone().add(new V3(0, 0, 0)), yaw:yaw - Math.PI/2, label:'the Mastodon', reach:95, name:'HMA Mastodon', internalMul:1.6, hostOnly:true,
      onTake:(gg, now, was) => this.tookHer(gg, now, was)});
    this.bomber = this.spot.plane; this.bomber.packages = 3; this.delivered = false; this.bull = false;
    // the wind off the sea: a steady breeze from somewhere east, gusting; the smoke pot shows it
    { const a = -0.6 + Math.random()*1.6, s = 5 + Math.random()*4; g.wind = new V3(Math.sin(a)*s, 0, Math.cos(a)*s); }
    { const A = this.P.anchor, rw = g.runways.find(r => r.hl > 100 && r.pos.distanceTo(new V3(A.x, r.pos.y, A.z)) < 300), yaw = rw ? rw.yaw || 0 : 0;
      this.zone = g.addDropZone({pos:new V3(A.x + Math.cos(yaw)*150, 0, A.z - Math.sin(yaw)*150), label:'THE RUSTY ANCHOR · MEDICINE', onLand:(gg, c, d, z) => this.crateDown(gg, d, z)}); }
    this.stage = 'out'; this.waveN = 0; this.runT = 0; this.landedAt = 0; this.wing0 = 0;
    const pz = this.P.puerto; this.puertoRw = g.runways.find(r => r.hl > 100 && r.pos.distanceTo(new V3(pz.x, r.pos.y, pz.z)) < 300) || null;
  },
  tookHer(g, now, was){
    this.stage = 'taxi'; this.wing0 = (g.wingmen || []).filter(w => w.p.alive).length;
    G.HUD.radio('Chief Mulvaney', 'She\'s fuelled, she\'s armed, and the gunners are aboard and sober. Mostly. Taxi her out and give her all four, she wants every yard of that runway.');
    G.HUD.radio(SPARKS(), `We'll have your ${(G.CHASSIS[was.L.chassis] || {name:'kite'}).name} flown home. Go on, Ace.`);
  },
  crateDown(g, d, z){
    if (d <= z.bull) this.bull = true;
    if (d <= z.good && !this.delivered) { this.delivered = true; z.done = d <= z.bull; G.HUD.radio('Rosa', d <= z.bull ? '¡Perfecto! Right on the cross. My people will drink to you tonight, Thirteen.' : 'We have it! A little walk for the boys, but we have it. Gracias.'); }
    else if (d > z.good) G.HUD.radio('Rosa', G.pick(['That one is in the mangroves. We will look for it later.', 'Too far! The wind, Thirteen, watch the smoke!', 'Again, por favor. That one went to the goats.']));
    if (this.delivered && this.bull) z.done = true;
    if (!this.delivered && !(this.bomber.packages > 0) && !g.crates.some(c => !c.landed)) { G.HUD.radio('Rosa', 'All three in the scrub. Ay. My people will have to walk for it.'); this.lose(g, 'crates'); }
  },
  onLiftoff(g){
    if (g.player !== this.bomber || this.stage === 'run') return;
    this.stage = 'run'; this.runT = 0;
    G.HUD.radio(HALE, 'Mastodon\'s airborne. Puerto Azul\'s six thousand yards north-west of you. Don\'t be clever, Thirteen. Just bring her home.');
  },
  onTouchdown(g, hard){
    if (g.player === this.bomber && this.stage === 'run' && this.puertoRw && g.runwayAt(g.player.pos) && g.player.pos.distanceTo(this.puertoRw.pos) < this.puertoRw.hl + 60) {
      if (!this.delivered) { G.HUD.radio('Puerto Azul tower', 'Mastodon, you\'ve still got the Rusty Anchor\'s medicine aboard. Rosa\'s on the line and she is not happy.'); return; }
      this.stage = 'down'; this.landedAt = this.pt;
      G.HUD.radio('Puerto Azul tower', hard ? 'Mastodon, you bounced her like a rubber ball. Welcome to Puerto Azul anyway.' : 'Mastodon, that\'s the sweetest thing I\'ve seen all week. Roll her out to the end.');
    }
  },
  update(g, dt){
    const live = this.tick(g, dt, 'Escort\'s formed up. We\'re with you all the way to Puerto Azul.'), P = g.player, B = this.bomber;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    const pz = this.P.puerto, PZ = new V3(pz.x, ground(g, pz.x, pz.z) + 30, pz.z);
    if (this.stage === 'out') {
      g.markers.push({pos:this.cove.clone().add(new V3(0, 30, 0)), label:'NAVY FIELD, BLACKWATER COVE', col:'#9ec7f0', box:true});
      G.HUD.objective(P.onGround ? 'Taxi to the Mastodon on the apron and climb across (Y)' : 'Fly to Blackwater Cove and land on the navy field');
    } else if (this.stage === 'taxi') {
      G.HUD.objective(B.onGround ? 'Taxi out, full throttle, lift her off' : 'Climb out and head for Puerto Azul');
    } else if (this.stage === 'run') {
      this.runT += dt;
      if (!this.delivered) g.markers.push({pos:this.zone.pos.clone().add(new V3(0, 40, 0)), label:'DROP THE MEDICINE · RUSTY ANCHOR (B: bombsight)', col:'#ff8a6a', box:true});
      g.markers.push({pos:PZ, label:'PUERTO AZUL · LAND THE MASTODON', col:'#9ec7f0', box:true});
      const d = Math.round(P.pos.distanceTo(PZ)*YD);
      // the assault: wave after wave out of the Syndicate's islands, heavier the closer she gets
      const W = [[8, 3, 'Bandits, high in the north! Three of them, coming straight for the big girl!', 0.9],
                 [38, 3, 'Three more out of the sun! Gunners, wake up back there!', 0.4],
                 [66, 2, 'Here\'s their best. That\'s Hacksaw Brandt in the lead, Kroll\'s own.', 0],
                 [94, 3, 'Last of them, between you and the field! Keep her straight, Ace!', -0.4]];
      if (this.waveN < W.length && this.runT > W[this.waveN][0]) {
        const [, n, line, side] = W[this.waveN++], fw = tA.copy(PZ).sub(P.pos).setY(0).normalize(), rt = tB.set(fw.z, 0, -fw.x);
        const from = P.pos.clone().addScaledVector(fw, 1800).addScaledVector(rt, side*1500).setY(Math.max(P.pos.y + 220, 420));
        this.foes(g, 'syndicate', from, n, {skill:0.42, face:P.pos});
        if (this.waveN === 3) this.brandt = this.ace(g, 'Ludwig "Hacksaw" Brandt', 'mantis', SYN[1], from.clone().add(new V3(0, 60, 0)), {skill:0.8, tough:1.6});
        G.HUD.radio(SPARKS(), line);
      }
      if (B.onGround && !this.puertoRw) G.HUD.objective('Land her at Puerto Azul');
      else if (!this.delivered) G.HUD.objective(`Drop Rosa\'s medicine on the Rusty Anchor\'s cross · B for the bombsight · ${B.packages} crates`);
      else G.HUD.objective(`Land the Mastodon at Puerto Azul · ${d.toLocaleString()} yd · ${g.planes.filter(p => p.alive && p.team !== 0).length} bandits`);
    } else if (this.stage === 'down') {
      G.HUD.objective('Roll her to a stop');
      if (B.alive && B.onGround && B.speed < 12) { G.HUD.radio(HALE, 'The Mastodon\'s on the hardstanding at Puerto Azul. Thirteen, the fleet sails at dusk tomorrow, and now it sails with teeth.'); this.win(g, 'delivered'); }
      else if (B.alive && !B.onGround && this.pt - this.landedAt > 3) this.stage = 'run';   // bounced back into the air: go round
    }
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){
    const B = this.bomber, hp = B ? Math.max(0, B.internal)/B.internalMax : 1, wm = (g.wingmen || []).filter(w => w.p.alive).length, lost = this.wing0 && wm < this.wing0;
    return [{text:this.sides[0].text, st:!B || !B.alive || hp < 0.5 ? 'fail' : this.ended ? 'ok' : 'live', val:Math.round(hp*100) + '%'},
            {text:this.sides[1].text, st:this.bull ? 'ok' : this.delivered && !(B && B.packages > 0) ? 'fail' : 'live', val:this.bull ? 'bullseye' : this.delivered ? 'delivered' : `${B ? B.packages : 0} crates`},
            {text:this.sides[2].text, st:lost ? 'fail' : this.ended ? 'ok' : 'live', val:`${wm} flying`}];
  },
  result(g, kind, why){
    const got = kind !== 'fail' && why === 'delivered';
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'The Mastodon\'s at Puerto Azul with barely a hole in her, and the Syndicate lost a squadron trying to stop you. Hale\'s found a crew for her.', then:'The fleet sails with a heavy bomber in the van. The Syndicate\'s raiders, the Anvil and the Hammer, are coming.'},
      success:{mood:'pleased', say:'She\'s down at Puerto Azul, holed like a colander, but she\'s down. The riggers are already at her.', then:'The fleet sails with a heavy bomber in the van. The Syndicate\'s raiders, the Anvil and the Hammer, are coming.'},
      fail:{mood:'stern', say:why === 'crates' ? 'Every crate missed the Anchor. Rosa\'s people walked half the night to find them, and the corsairs remember.' : why === 'margaret' ? 'The Margaret went down off the cove. Everyone swam for it.' : this.stage === 'out' ? 'You never made it to the cove. The Syndicate burned the Mastodon on the ground that night.' : 'The Mastodon\'s in the sea off the Keys. The gunners got out. Hale didn\'t say a word, which was worse.', then:'The fleet sails without its heavy bomber. The Syndicate\'s raiders, the Anvil and the Hammer, are coming.'}
    }[kind]), {mastodon:got ? 'delivered' : 'lost'});
  }
});

/* ---------- the story graph, Volume III ---------- */
Object.assign(G.CHAPTERS, {c7:'Volume III, Chapter 7: Blood on the Rails', c8:'Volume III, Chapter 8: White Silence', c9:'Volume III, Chapter 9: The Last Armada'});
Object.assign(G.STORY, {
  c7m1:{n:1, ch:'c7', next:r => r.kind === 'fail' ? 'c7m1' : 'c7m2'},
  c7m2:{n:2, ch:'c7', next:() => 'c7m3'},
  c7m3:{n:3, ch:'c7', next:r => r.kind === 'fail' ? 'c7m3' : 'c8m1'},
  c8m1:{n:1, ch:'c8', next:() => 'c8m2'},
  c8m2:{n:2, ch:'c8', next:r => r.kind === 'fail' ? 'c8m2' : 'c8m3'},
  c8m3:{n:3, ch:'c8', next:() => 'c9m1'},
  c9m1:{n:1, ch:'c9', next:() => 'c9x1'},
  c9x1:{n:2, ch:'c9', next:() => 'c9m2'},   // the Mastodon run: win or lose, the fleet sails; the flag says whether she sails with it
  c9m2:{n:3, ch:'c9', next:() => 'c9m3'},
  c9m3:{n:4, ch:'c9', next:r => r.kind === 'fail' ? 'c9m3' : 'c9end'}
});
G.STORY.c6m3.next = r => r.kind === 'fail' ? 'c6m3' : 'c7m1';
/* awards: the Zephyr for finishing Volume II (wherever the story has got to since), the Hornet for Volume III */
const won = id => G.save.story && G.save.story.log.some(l => l.node === id && l.kind !== 'fail');
G.grantStoryAwards = () => {
  const S = G.save; let said = [];
  if (won('c6m3') && !S.owned.includes('zephyr')) { S.owned.push('zephyr'); for (const l of ['blackthirteen', 'swallow', 'airracer', 'quicksilver', 'nightjet']) if (!S.liveries.includes(l)) S.liveries.push(l); said.push('the Hollis Zephyr jet and five liveries'); }
  if (won('c9m3') && !S.owned.includes('hornet')) { S.owned.push('hornet'); for (const l of ['syndicate', 'railroad', 'glacier', 'armada']) if (!S.liveries.includes(l)) S.liveries.push(l); said.push('the Hornet rocket interceptor and four liveries'); }
  if (said.length) { G.persist(); if (G.HUD) G.HUD.toast(`New in the hangar: ${said.join(', and ')}`); }
};
const commit0 = G.storyCommit;
G.storyCommit = r => { commit0(r); G.grantStoryAwards(); };
// saves that finished Volume II before Volume III existed carry straight on
if (G.save && G.save.story && G.save.story.node === 'c6end') { G.save.story.node = 'c7m1'; G.persist(); }
if (G.save && G.save.story) G.grantStoryAwards();
})();
