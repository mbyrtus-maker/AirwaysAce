(function(){
'use strict';
/* Bullets, rockets, the airship entity, parachutes. Attached to G.Game.prototype by game.js. */
const G = window.G, V3 = THREE.Vector3;
const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = a => { while (a > Math.PI) a -= Math.PI*2; while (a < -Math.PI) a += Math.PI*2; return a; };

/* Closest approach of segment a->b to point c: returns t in [0,1] and writes the point into out. */
function segClosest(a, b, c, out){
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const L2 = abx*abx + aby*aby + abz*abz; let t = L2 > 0 ? ((c.x - a.x)*abx + (c.y - a.y)*aby + (c.z - a.z)*abz)/L2 : 0;
  t = clamp(t, 0, 1); out.set(a.x + abx*t, a.y + aby*t, a.z + abz*t); return t;
}
G.segClosest = segClosest;

/* ---------- Airships ----------
   The Lucky Margaret takes damage as one pool. A Raider is a set of parts: armoured hull sections over virtual gas cells,
   and exposed engines, turrets, radio mast, hangar doors and rudders, plus a bridge behind the gondola's armour. */
const SECTION_NAMES = {bow:'Bow plating', stern:'Stern plating', port:'Port plating', stb:'Starboard plating', gondola:'Gondola armour'};
G.Airship = class {
  constructor(game, o){
    this.g = game; this.team = o.team; this.name = o.name; this.kind = o.kind || 'carrier';
    this.obj = this.kind === 'raider' ? G.buildRaider(Object.assign({name:o.label}, o.paint || {})) : this.kind === 'blimp' ? G.buildBlimp(o.paint || {}) : G.buildAirship(o.paint || {});
    this.noRun = !!o.noRun; this.gunCd = o.gunCd; this.gunJit = o.gunJitter; this.flakCd = o.flakCd; this.noRockets = !!o.noRockets;
    this.dest = o.dest || null; this.noTorps = !!o.noTorps; this.hidden = !!o.hidden; if (o.state) this.state = o.state;
    game.scene.add(this.obj);
    const ud = this.obj.userData;
    this.ell = ud.ell || [24, 24, 104]; this.gon = ud.gon || {hw:7, y0:-20, y1:-40, zc:-6, hz:38};
    this.comps = ud.comps || null;
    if (o.noMG && this.comps) { for (const c of this.comps) if (c.kind === 'mg' && c.group) c.group.parent.remove(c.group); this.comps = this.comps.filter(c => c.kind !== 'mg'); } this.sections = ud.sections ? Object.assign({}, ud.sections) : null; this.sectionsMax = ud.sections || null;
    this.pos = o.pos.clone(); this.heading = o.heading || 0; this.speed0 = this.speed = o.speed || 9; this.turn0 = this.turn = o.turn || 0.006;
    this.hp = this.hpMax = o.hp || 4000; this.alive = true; this.vel = new V3(); this.state = this.state || 'fighting';
    this.q = new THREE.Quaternion(); this.guns = (o.guns || []).map(p => ({p, cd:Math.random()}));
    this.flak = (o.flak ? ud.flak : []).map(p => ({p, cd:1 + Math.random()*2}));
    this.sinkT = 0; this.rkCd = 3; this.sink = 0; this.sync();
  }
  qi(){ return this._qi || (this._qi = new THREE.Quaternion()).copy(this.q).invert(); }
  toLocal(p, out){ return out.copy(p).sub(this.pos).applyQuaternion(this.qi()); }
  worldPoint(local, out){ return out.copy(local).applyQuaternion(this.q).add(this.pos); }
  insideLocal(l, m = 0){
    const e = this.ell, G2 = this.gon;
    return (l.x/(e[0] + m))**2 + (l.y/(e[1] + m))**2 + (l.z/(e[2] + m))**2 < 1 ||
      (Math.abs(l.x) < G2.hw + m && l.y < G2.y0 + m && l.y > G2.y1 - m && Math.abs(l.z - G2.zc) < G2.hz + m);
  }
  inside(p, m = 0){ return this.insideLocal(this.toLocal(p, tA), m); }
  alivePart(kind){ return this.comps ? this.comps.filter(c => c.alive && c.kind === kind) : []; }
  count(kind){ return this.comps ? this.comps.filter(c => c.kind === kind).length : 0; }

  /* ---- damage ---- */
  hitBy(a, b, dmg, ammo, src){
    if (!this.alive || this.state === 'surrendered' || this.state === 'captured' || this.state === 'passive') {
      if (this.alive && this.inside(b)) { if (this.state === 'passive' && this.g.mission.onPassiveHit) this.g.mission.onPassiveHit(this.g, this, src); return true; }
      return false;
    }
    if (!this.comps) { if (!this.inside(b)) return false; this.damage(dmg*(ammo.a + ammo.i)*0.5, src); return true; }
    const la = this.toLocal(a, tA).clone(), lb = this.toLocal(b, tB);
    for (const c of this.comps) {
      if (!c.alive || c.virtual) continue;
      segClosest(la, lb, c.pos, tC);
      if (tC.distanceToSquared(c.pos) < c.r*c.r) { this.hitComp(c, dmg, ammo, src); return true; }
    }
    if (!this.insideLocal(lb)) return false;
    this.hitHull(lb, dmg, ammo, src); return true;
  }
  sectionAt(l){
    const G2 = this.gon;
    if (l.y < G2.y0 + 1 && Math.abs(l.x) < G2.hw + 0.5) return 'gondola';
    return l.z > 40 ? 'bow' : l.z < -40 ? 'stern' : l.x > 0 ? 'port' : 'stb';
  }
  /* armour first (x ammo.a), the overflow reaches what's behind it (x ammo.i) */
  armourThen(sec, dmg, ammo, behind){
    const A = ammo.a, I = ammo.i;
    if (sec && this.sections[sec] > 0) {
      const a = dmg*A; if (a <= this.sections[sec]) { this.sections[sec] -= a; return; }
      const over = (a - this.sections[sec])/A; this.sections[sec] = 0;
      if (this.g.onPartNote) this.g.onPartNote(this, `${SECTION_NAMES[sec]} stripped`);
      if (behind) behind(over*I); return;
    }
    if (behind) behind(dmg*I);
  }
  hitHull(l, dmg, ammo, src){
    const sec = this.sectionAt(l);
    if (sec === 'gondola') { const br = this.comps.find(c => c.id === 'bridge'); this.armourThen(sec, dmg, ammo, d => { if (br.alive && l.z > 10) this.partDamage(br, d, src); }); return; }
    const cell = this.comps.filter(c => c.kind === 'cell' && c.alive).sort((x, y) => Math.abs(x.pos.z - l.z) - Math.abs(y.pos.z - l.z))[0];
    this.armourThen(sec, dmg, ammo, d => { if (cell) { this.partDamage(cell, d, src); if (ammo.splash && Math.random() < 0.06) cell.burn = 8; } });
  }
  hitComp(c, dmg, ammo, src){
    if (c.cover) this.armourThen(c.cover, dmg, ammo, d => this.partDamage(c, d, src));
    else this.partDamage(c, dmg*(ammo.a + ammo.i)*0.5, src);
  }
  /* rockets and big blasts: every part within reach takes a share */
  blast(world, dmg, reach, src, fire){
    if (!this.alive) return;
    if (!this.comps) { this.damage(dmg, src); return; }
    const l = this.toLocal(world, tA).clone(), ammo = {a:1, i:1};
    let hitPart = false;
    for (const c of this.comps) {
      if (!c.alive || c.virtual) continue;
      const d = l.distanceTo(c.pos); if (d > c.r + reach) continue;
      hitPart = true; this.hitComp(c, dmg*Math.max(0.35, 1 - Math.max(0, d - c.r)/reach), ammo, src);
    }
    if (!hitPart || this.insideLocal(l, 1)) { this.hitHull(l, dmg, ammo, src); if (fire) { const cl = this.comps.filter(c => c.kind === 'cell' && c.alive).sort((x, y) => Math.abs(x.pos.z - l.z) - Math.abs(y.pos.z - l.z))[0]; if (cl && Math.random() < 0.3) cl.burn = 10; } }
  }
  partDamage(c, d, src){
    if (this.g.netGuest) return;
    if (!c.alive || d <= 0) return; c.hp -= d;
    if (this.g.onPartHit) this.g.onPartHit(this, c, src);
    if (c.hp > 0) return;
    c.alive = false; c.hp = 0; c.burn = 0;
    const w = this.worldPoint(c.pos, new V3());
    if (c.group) { c.group.visible = false; this.g.fx.explosion(w, c.kind === 'engine' || c.kind === 'bridge' ? 1.3 : 0.9); }
    else this.g.fx.explosion(w.add(tD.set((Math.random() - 0.5)*20, 6, 0)), 1.6);
    if (this.g.audio) this.g.audio.boom(w, c.kind !== 'cell');
    (this.wrecks || (this.wrecks = [])).push({c, t:0});
    if (this.g.onPartDown) this.g.onPartDown(this, c, src);
    this.checkState(src);
  }
  checkState(src){
    if (!this.comps || !this.alive) return;
    const cellsLost = this.count('cell') - this.alivePart('cell').length, engines = this.alivePart('engine').length;
    if (cellsLost >= 4 && !engines) { this.alive = false; this.state = 'destroyed'; if (this.g.onShipDown) this.g.onShipDown(this, src); return; }
    if (this.state === 'running' && !engines) { this.state = 'fighting'; if (this.g.onShipStopped) this.g.onShipStopped(this); }
    // badly hurt: she breaks off and runs
    const stripped = Object.values(this.sections).filter(v => v <= 0).length;
    if (this.state === 'fighting' && engines && !this.noRun && (this.count('engine') - engines >= 2 || cellsLost >= 2 || !this.alivePart('bridge').length || stripped >= 3)) {
      this.state = 'running'; if (this.g.onShipRun) this.g.onShipRun(this);
    }
  }
  damage(d, src){
    if (!this.alive || this.g.netGuest) return; this.hp -= d;
    if (this.g.onShipHit) this.g.onShipHit(this, src, d);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.state = 'destroyed'; if (this.g.onShipDown) this.g.onShipDown(this, src); }
  }

  /* ---- movement and guns ---- */
  update(dt){
    if (this.alive && this.g.netGuest) {   // co-op guest: the host flies the ships
      if (this.net) { const k = 1 - Math.exp(-dt*6); this.pos.lerp(this.net.p, k); this.q.slerp(this.net.q, k); }
      this.sync(); return;
    }
    if (!this.alive) {
      this.sinkT += dt; this.pos.y -= (4 + this.sinkT*3)*dt; this.obj.rotation.z += dt*0.05; this.obj.rotation.x += dt*0.012;
      this.obj.position.copy(this.pos);
      if (Math.random() < dt*6) { const p = tA.set((Math.random() - 0.5)*30, (Math.random() - 0.5)*30, (Math.random() - 0.5)*160); this.worldPoint(p, tB); this.g.fx.explosion(tB, 1.6); }
      return;
    }
    const fx = this.g.fx;
    if (this.comps) {
      const eng = this.alivePart('engine').length/Math.max(1, this.count('engine')), fins = this.alivePart('fin').length;
      const quit = this.state !== 'fighting' && this.state !== 'running';
      const run = this.state === 'running' ? 2.2*(0.5 + 0.5*eng) : 1;
      this.speed += ((quit && this.state !== 'running' ? 0 : this.speed0*eng*run) - this.speed)*Math.min(1, dt*0.3);
      this.turn = quit && this.state !== 'running' ? 0 : this.turn0*(fins/2);
      const lost = this.count('cell') - this.alivePart('cell').length; this.pos.y -= lost*(eng > 0 ? 0.6 : 1.4)*dt;
      if (this.pos.y < 30) { this.alive = false; this.state = 'destroyed'; if (this.g.onShipDown) this.g.onShipDown(this, null); return; }
      for (const c of this.comps) if (c.burn > 0 && c.alive) { c.burn -= dt; this.partDamage(c, 14*dt, null); if (Math.random() < dt*12) { this.worldPoint(tA.set((Math.random() - 0.5)*24, 8 + Math.random()*8, c.pos.z + (Math.random() - 0.5)*12), tB); fx.fire.emit(tB.x, tB.y, tB.z, 0, 8, 0, 9, 0.6, 1, 0.5, 0.15, 0.9, 6); } }
      for (const w of this.wrecks || []) { w.t += dt; if (Math.random() < dt*(w.t < 20 ? 9 : 3)) { this.worldPoint(w.c.virtual ? tA.set(0, 16, w.c.pos.z) : w.c.pos, tB); fx.smoke.emit(tB.x, tB.y, tB.z, (Math.random() - 0.5)*3, 6, (Math.random() - 0.5)*3, 7, 4, 0.12, 0.11, 0.1, 0.6, 7, 0.3, 1.5); } }
    }
    if (this.dest && this.alive) {
      const want = Math.atan2(this.dest.x - this.pos.x, this.dest.z - this.pos.z), cap = this.turn0*dt;
      this.heading += Math.max(-cap, Math.min(cap, wrapA(want - this.heading)));
    } else if (this.foe && this.alive) {
      const F = this.foe, dx = F.pos.x - this.pos.x, dz = F.pos.z - this.pos.z, dist = Math.hypot(dx, dz), toward = Math.atan2(dx, dz);
      let want = toward;
      if (this.state === 'running') want = toward + Math.PI;
      else if (this.foe.state === 'running' && this.team === 0) want = toward;
      else if (dist < (this.standoff || 700)) { const s1 = toward + Math.PI/2, s2 = toward - Math.PI/2; want = Math.abs(wrapA(s1 - this.heading)) < Math.abs(wrapA(s2 - this.heading)) ? s1 : s2; }
      const cap = (this.comps ? this.turn0*(this.alivePart('fin').length/2) : this.turn0)*dt;
      this.heading += Math.max(-cap, Math.min(cap, wrapA(want - this.heading)));
      // torpedoes: one slow fish at the other ship every half minute inside 2 km
      this.torpCd = (this.torpCd ?? 12 + Math.random()*8) - dt;
      if (this.torpCd <= 0 && !this.g.done && !this.noTorps && F.alive && dist < 2000 && this.state !== 'surrendered' && (!this.comps || this.alivePart('engine').length)) { this.torpCd = 28 + Math.random()*8; this.g.spawnTorpedo(this, F); }
    } else this.heading += this.turn*dt;
    this.vel.set(Math.sin(this.heading), 0, Math.cos(this.heading)).multiplyScalar(this.speed);
    this.pos.addScaledVector(this.vel, dt);
    this.q.setFromAxisAngle(tA.set(0, 1, 0), this.heading); this._qi = null;
    const props = this.obj.userData.props || [];
    for (const p of props) if (p.parent && p.parent.visible !== false) p.rotation.z += dt*9*(this.speed/Math.max(1, this.speed0) + 0.2);
    if ((this.state !== 'fighting' && this.state !== 'running') || this.g.done) { this.sync(); return; }
    const foes = this.g.planes.filter(p => p.alive && !p.docked && !p.noTarget && p.team !== this.team && !p.invuln && !p.duel);
    const nearest = (mz, lo, hi) => { let best = null, bd = hi; for (const f of foes) { const d = f.pos.distanceTo(mz); if (d > lo && d < bd) { bd = d; best = f; } } return [best, bd]; };
    // machine guns: the Margaret's three stations, or a Raider's live gun blisters
    const mgs = this.comps ? this.alivePart('mg').map(c => (c.gun || (c.gun = {p:c.pos, cd:Math.random()}))) : this.guns;
    for (const gn of mgs) {
      gn.cd -= dt; if (gn.cd > 0) continue; gn.cd = (this.gunCd ?? (this.comps ? 0.2 : 0.16)) + Math.random()*0.1;
      const mz = this.worldPoint(gn.p, tC), [best, bd] = nearest(mz, 0, this.comps ? 600 : 650);
      if (!best) { gn.cd = 0.6; continue; }
      const t = bd/820, aim = tD.copy(best.pos).addScaledVector(best.vel, t).sub(mz).normalize(), j = (this.gunJit ?? (this.comps ? 0.055 : 0.05))*(this.comps && !this.alivePart('bridge').length ? 2 : 1);
      aim.x += (Math.random() - 0.5)*j; aim.y += (Math.random() - 0.5)*j; aim.z += (Math.random() - 0.5)*j; aim.normalize();
      this.g.spawnRaw(this, mz, aim, G.GUNS[this.comps ? '40' : '50'], G.AMMO.slug, this.vel);
      if (this.comps && this.g.audio) this.g.audio.shot(mz, 1.05);
    }
    // flak: time-fused shells that burst near where the target is heading
    const fl = this.comps ? this.alivePart('flak').map(c => (c.fk || (c.fk = {p:c.pos, cd:1 + Math.random()}))) : this.flak;
    for (const fk of fl) {
      fk.cd -= dt; if (fk.cd > 0) continue; fk.cd = (this.flakCd ?? (this.comps ? 1.6 : 1.1)) + Math.random()*0.7;
      const mz = this.worldPoint(fk.p, tC), [best, bd] = nearest(mz, 280, 1500);
      if (!best) { fk.cd = 0.8; continue; }
      const t = bd/620, err = bd*(this.comps ? (this.alivePart('bridge').length ? 0.05 : 0.1) : 0.06);
      const at = new V3().copy(best.pos).addScaledVector(best.vel, t).add(tD.set((Math.random() - 0.5)*err, (Math.random() - 0.5)*err, (Math.random() - 0.5)*err));
      this.g.flakShell(this, mz, at, t);
    }
    // rocket battery: a ripple of HE every few seconds at anything 250-900 m out
    for (const c of this.noRockets ? [] : this.alivePart('rocket')) {
      this.rkCd -= dt; if (this.rkCd > 0) continue; this.rkCd = 6 + Math.random()*2;
      const mz = this.worldPoint(c.pos, tC.clone()), [best, bd] = nearest(mz, 250, 900); if (!best) continue;
      const t = bd/260, aim = tD.copy(best.pos).addScaledVector(best.vel, t).sub(mz).normalize().clone();
      for (let i = 0; i < 2; i++) setTimeout(() => this.alive && (this.state === 'fighting' || this.state === 'running') && this.g.spawnRocketRaw(this, mz, aim.clone().add(tA.set((Math.random() - 0.5)*0.03, (Math.random() - 0.5)*0.03, 0)).normalize(), G.ROCKETS.he), i*250);
    }
    this.sync();
  }
  sync(){ this.obj.position.copy(this.pos); this.obj.quaternion.copy(this.q); }
};

/* ---------- Projectiles (mixed into the game) ---------- */
G.Combat = {
  initCombat(){
    this.bullets = []; this.rockets = []; this.chutes = [];
    this.rkGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6).rotateX(Math.PI/2);
    this.rkMat = G.mat(0x5d6064, {metalness:0.5});
  },
  spawnBullet(plane, muzzleLocal, gn){
    const mz = tA.copy(muzzleLocal).applyQuaternion(plane.q).add(plane.pos);
    const conv = tB.copy(plane.fwd).multiplyScalar(330).add(plane.pos).sub(mz).normalize();
    const as = plane.isPlayer && G.save.aimAssist !== false && this.assist;
    if (as && as.target.alive) { const ld = tD.copy(as.lead).sub(mz).normalize(); if (ld.dot(plane.fwd) > ((plane.L.mods || []).includes('gyro') ? 0.9903 : 0.9962)) conv.copy(ld); }
    const sp = 0.004 + (plane.isPlayer || plane.human ? 0 : 0.003);
    conv.x += (Math.random() - 0.5)*sp; conv.y += (Math.random() - 0.5)*sp; conv.z += (Math.random() - 0.5)*sp; conv.normalize();
    this.spawnRaw(plane, mz, conv, gn.def, gn.ammo, plane.vel);
    if (plane.isPlayer) this.playerShots++;
    else if (this.audio) this.audio.shot(mz, gn.def.pitch);
  },
  spawnRaw(owner, pos, dir, def, ammo, baseVel){
    const v = dir.clone().multiplyScalar(def.muzzle).add(baseVel);
    this.bullets.push({pos:pos.clone(), prev:pos.clone(), vel:v, life:def.range/def.muzzle, owner, team:owner.team, dmg:def.dmg, ammo,
      w:0.11 + def.dmg*0.012, len:7 + def.dmg*0.5, color:def.tracer});
  },
  spawnRocket(plane, railLocal, def){
    const p = tA.copy(railLocal).applyQuaternion(plane.q).add(plane.pos);
    const m = new THREE.Mesh(this.rkGeo, this.rkMat); m.position.copy(p); this.scene.add(m);
    let dir = plane.fwd.clone();
    if (plane.isPlayer) {   // no rocket pip: your rockets converge on the gun crosshair (330 m ahead), allowing for their drop
      const t = 330/def.speed, at = tB.copy(plane.pos).addScaledVector(plane.fwd, 330); at.y += 0.5*9.81*0.12*def.drop*t*t;
      dir.copy(at.sub(p).normalize());
    }
    if (plane.isPlayer && G.save.aimAssist !== false) {
      let T = null, Tv = null;
      if (this.assist && this.assist.target && this.assist.target.alive) { T = this.assist.target.pos; Tv = this.assist.target.vel; }
      else if (this.partAim) { T = this.partAim.ship.worldPoint(this.partAim.cp.pos, new V3()); Tv = this.partAim.ship.vel; }
      if (T) {
        let t = T.distanceTo(p)/def.speed; for (let i = 0; i < 2; i++) { const lp = tB.copy(T).addScaledVector(Tv, t).addScaledVector(plane.vel, -t); t = lp.distanceTo(p)/def.speed; }
        const lead = tB.copy(T).addScaledVector(Tv, t).addScaledVector(plane.vel, -t); lead.y += 0.5*9.81*0.12*def.drop*t*t;
        const ld = lead.sub(p).normalize(); if (ld.dot(plane.fwd) > 0.9986) dir.copy(ld);
      }
    }
    const v = dir.multiplyScalar(def.speed).add(plane.vel);
    this.rockets.push({pos:p.clone(), prev:p.clone(), vel:v, life:4.5, owner:plane, team:plane.team, def, m, arm:0.12});
    if (this.audio && (plane.isPlayer || plane.pos.distanceTo(this.player.pos) < 900)) this.audio.rocket(plane.isPlayer ? 1 : this.audio.att(p));
  },
  /* static targets: {pos (world), r, hp, hpMax, team, label, group, alive}; registered by a mission */
  addTarget(t){ t.hpMax = t.hpMax || t.hp; t.alive = true; t.team = t.team ?? 1; (this.targets || (this.targets = [])).push(t); return t; },
  hitTarget(t, d, src){
    if (!t.alive || this.netGuest) return;
    if (this.netHost && G.Net) G.Net.hostHit(src); t.hp -= d;
    if (src && src.isPlayer) { G.HUD.hitMark(); if (this.audio) this.audio.hitThem(); }
    if (t.hp <= 0) {
      t.alive = false; if (t.group) t.group.visible = false;
      this.fx.explosion(t.pos, t.kind === 'tank' ? 2.4 : 1.4); this.fx.burner(t.pos, 30); if (this.audio) this.audio.boom(t.pos, true);
      if (t.kind === 'tank') for (let i = 0; i < 3; i++) setTimeout(() => this.fx.explosion(tA.copy(t.pos).add(tB.set((Math.random() - 0.5)*14, 6 + Math.random()*8, (Math.random() - 0.5)*14)), 1.6), 250 + i*300);
      G.HUD.feed(`${src && src.isPlayer ? 'You' : 'Someone'} destroyed ${t.label.toLowerCase()}`, src && src.isPlayer);
      if (this.mission.onTargetDown) this.mission.onTargetDown(this, t, src);
      if (t.onDown) t.onDown(this, src);
    }
  },
  spawnRocketRaw(owner, pos, dir, def){
    const m = new THREE.Mesh(this.rkGeo, this.rkMat); m.position.copy(pos); this.scene.add(m);
    this.rockets.push({pos:pos.clone(), prev:pos.clone(), vel:dir.clone().multiplyScalar(def.speed).add(owner.vel), life:4.5, owner, team:owner.team, def, m, arm:0.4});
    if (this.audio) this.audio.rocket(this.audio.att(pos)*0.8);
  },
  /* ---------- Aerial torpedoes: slow, heavy, ship-to-ship. Planes can shoot them down. ---------- */
  spawnTorpedo(ship, target){
    const local = new V3(0, -32, 18), p = ship.worldPoint(local, new V3());
    const dist = p.distanceTo(target.pos), t = dist/38;
    const aim = target.pos.clone().addScaledVector(target.vel, t).add(new V3(0, -6, 0)).sub(p).normalize();
    const m = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 5.2, 8).rotateX(Math.PI/2), G.mat(ship.team === 0 ? 0x7d8a96 : 0x2b2826, {metalness:0.3}));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 8).rotateX(Math.PI/2), G.mat(ship.team === 0 ? 0xdba63e : 0x8e231c)); nose.position.z = 3.2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.7), G.mat(0x26221f)); fin.position.z = -2.4; const fin2 = fin.clone(); fin2.rotation.z = Math.PI/2;
    m.add(body, nose, fin, fin2); m.position.copy(p); this.scene.add(m);
    (this.torps || (this.torps = [])).push({pos:p, prev:p.clone(), vel:aim.multiplyScalar(38).add(ship.vel), m, owner:ship, team:ship.team, target, hp:40, life:90});
    if (ship.team !== 0) G.HUD.radio(G.RADIO.short, G.pick(['Torpedo away from the Nightjar! Shoot it down before it reaches us!', 'Another fish headed our way! Somebody stop it!']));
    else G.HUD.feed('The Margaret fired a torpedo', false);
  },
  /* an air torpedo from a bomber: drops off the belly, lights after half a second, runs up to 140 m/s and steers (gently) at
     the enemy airship or ground target nearest the nose when it was dropped; it bursts on that, on any enemy airship it meets,
     on a plane that comes within 8 m, or on the ground */
  spawnAirTorpedo(P){
    const p = P.pos.clone().addScaledVector(P.up, -2.4), F = P.fwd;
    let target = null, best = -1;
    const look = (o, pos, team) => { if (!o.alive || team === P.team) return; const d = pos.clone().sub(p), L = d.length(); if (L > 3500) return; const c = d.normalize().dot(F); if (c > 0.64 && c - L/9000 > best) { best = c - L/9000; target = o; } };
    for (const s of this.ships) look(s, s.pos, s.team);
    if (this.targets) for (const t of this.targets) look(t, t.pos, t.team);
    const m = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.6, 10).rotateX(Math.PI/2), G.mat(0x4a4f46, {metalness:0.35}));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1, 10).rotateX(Math.PI/2), G.mat(0xc8a24a, {metalness:0.5})); nose.position.z = 2.8;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.25, 10).rotateX(Math.PI/2), G.mat(0x8e231c)); band.position.z = 1.4;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.6), G.mat(0x26221f)); fin.position.z = -2.2; const fin2 = fin.clone(); fin2.rotation.z = Math.PI/2;
    m.add(body, nose, band, fin, fin2); m.position.copy(p); this.scene.add(m);
    (this.torps || (this.torps = [])).push({air:true, pos:p, prev:p.clone(), vel:P.vel.clone().addScaledVector(P.up, -4), m, owner:P, team:P.team, target, hp:40, life:24, age:0});
    if (this.audio) this.audio.rocket && this.audio.rocket(p);
    if (target) G.HUD.feed(`Torpedo running at ${target.name || target.label || 'the target'}`, false);
  },
  updateTorpedoes(dt){
    const T = this.torps; if (!T) return;
    for (let i = T.length - 1; i >= 0; i--) {
      const t = T[i];
      if (t.air) {   // the bomber's fish: falls, lights, runs and steers
        t.age += dt;
        if (t.age < 0.5) t.vel.y -= 9.81*dt;
        else {
          const sp = Math.min(140, t.vel.length() + 70*dt), dir = t.vel.clone().normalize();
          if (t.target && t.target.alive) { const want = t.target.pos.clone().addScaledVector(t.target.vel || tA.set(0, 0, 0), Math.min(4, t.target.pos.distanceTo(t.pos)/sp)).sub(t.pos).normalize(); const a = Math.min(1, dt*0.9); dir.lerp(want, a).normalize(); }
          t.vel.copy(dir).multiplyScalar(sp);
        }
      }
      t.prev.copy(t.pos); t.pos.addScaledVector(t.vel, dt); t.life -= dt;
      t.m.position.copy(t.pos); t.m.lookAt(tA.copy(t.pos).add(t.vel));
      if (Math.random() < dt*20) this.fx.trail(t.pos, 1.1);
      let boom = t.hp <= 0 || t.life <= 0 || t.pos.y < Math.max(this.world.height(t.pos.x, t.pos.z), 0.4);
      const S = t.target;
      if (t.air && !boom) {   // what an air torpedo bursts on
        let hit = null; for (const s of this.ships) if (s.alive && s.team !== t.team && s.inside(t.pos, 2)) { hit = s; break; }
        if (hit) { boom = true; this.fx.explosion(t.pos, 2.8); if (this.audio) this.audio.boom(t.pos, true); if (hit.comps) hit.blast(t.pos, 650, 34, t.owner, true); else hit.damage(700, t.owner); G.HUD.feed(`${t.owner && t.owner.isPlayer ? 'Your torpedo' : 'A torpedo'} hit ${hit.name || 'the airship'}!`, true); }
        if (!boom && this.targets) for (const g of this.targets) if (g.alive && g.team !== t.team && g.pos.distanceTo(t.pos) < (g.r || 10) + 4) { boom = true; this.fx.explosion(t.pos, 2.6); if (this.audio) this.audio.boom(t.pos, true); this.hitTarget(g, 400, t.owner); break; }
        if (!boom) for (const p of this.planes) if (p.alive && p.team !== t.team && p.pos.distanceTo(t.pos) < 8) { boom = true; this.fx.explosion(t.pos, 2); if (this.audio) this.audio.boom(t.pos, true); p.damage(160, p.facingOf(t.pos), G.AMMO.slug, t.owner); break; }
        if (boom || t.hp <= 0 || t.life <= 0 || t.pos.y < Math.max(this.world.height(t.pos.x, t.pos.z), 0.4)) { if (!boom) { this.fx.explosion(t.pos, 1.6); if (this.audio) this.audio.boom(t.pos, false); } this.scene.remove(t.m); T.splice(i, 1); }
        else { t.m.position.copy(t.pos); t.m.lookAt(tA.copy(t.pos).add(t.vel)); if (t.age > 0.5 && Math.random() < dt*20) this.fx.trail(t.pos, 1.1); }
        continue;
      }
      if (!boom && S.alive && S.inside(t.pos, 2)) {
        boom = true; this.fx.explosion(t.pos, 2.6); if (this.audio) this.audio.boom(t.pos, true);
        if (S.comps) S.blast(t.pos, 320, 16, t.owner, true); else S.damage(380, t.owner);
        if (S.team === 0) G.HUD.radio(G.CAPTAIN.short, 'Torpedo hit! We\'re holed amidships!'); else G.HUD.feed('Torpedo hit on the Nightjar!', true);
      } else if (boom) { this.fx.explosion(t.pos, 1.2); if (this.audio) this.audio.boom(t.pos, false); }
      if (boom) { this.scene.remove(t.m); T.splice(i, 1); }
    }
  },
  updateProjectiles(dt){
    const planes = this.planes, ships = this.ships, w = this.world;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]; b.prev.copy(b.pos); b.pos.addScaledVector(b.vel, dt); b.vel.y -= 2.5*dt; b.life -= dt;
      let dead = b.life <= 0;
      if (!dead) for (const p of planes) {
        if (!p.alive || p.team === b.team) continue;
        if (Math.abs(p.pos.x - b.pos.x) > 60 || Math.abs(p.pos.z - b.pos.z) > 60) continue;
        segClosest(b.prev, b.pos, p.pos, tC);
        if (tC.distanceToSquared(p.pos) < (p.radius*(p.isPlayer || p.human ? 0.8 : 1.05))**2) { p.damage(b.dmg, p.facingOf(tC), b.ammo, b.owner); this.fx.spark(tC); dead = true; break; }
      }
      if (!dead && this.torps) for (const t of this.torps) {
        if (t.team === b.team || t.hp <= 0 || Math.abs(t.pos.x - b.pos.x) > 40 || Math.abs(t.pos.z - b.pos.z) > 40) continue;
        segClosest(b.prev, b.pos, t.pos, tC);
        if (tC.distanceToSquared(t.pos) < 2.6*2.6) { t.hp -= b.dmg; this.fx.spark(tC); dead = true; if (t.hp <= 0) { G.HUD.feed(`${b.owner && b.owner.isPlayer ? 'You' : b.owner && b.owner.callsign ? b.owner.callsign : 'Gunners'} shot down a torpedo`, b.owner && b.owner.isPlayer); if (b.owner && b.owner.isPlayer) G.HUD.hitMark(); } break; }
      }
      if (!dead && this.targets) for (const t of this.targets) {
        if (!t.alive || t.team === b.team || Math.abs(t.pos.x - b.pos.x) > 60 || Math.abs(t.pos.z - b.pos.z) > 60) continue;
        segClosest(b.prev, b.pos, t.pos, tC);
        if (tC.distanceToSquared(t.pos) < t.r*t.r) { this.hitTarget(t, b.dmg*(b.ammo.a + b.ammo.i)*0.5, b.owner); this.fx.spark(tC); dead = true; break; }
      }
      if (!dead) for (const s of ships) if (s.alive && s.team !== b.team && b.pos.distanceToSquared(s.pos) < 130*130 && s.hitBy(b.prev, b.pos, b.dmg, b.ammo, b.owner)) { this.fx.spark(b.pos, [1, 0.7, 0.4]); dead = true; break; }
      if (!dead && b.pos.y < 600 && b.pos.y < Math.max(w.height(b.pos.x, b.pos.z), 0.4)) { this.fx.dust(b.pos); dead = true; }
      if (dead) { this.bullets[i] = this.bullets[this.bullets.length - 1]; this.bullets.pop(); }
    }
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]; r.prev.copy(r.pos); r.vel.y -= 9.81*0.12*r.def.drop*dt; r.pos.addScaledVector(r.vel, dt); r.life -= dt; r.arm -= dt;
      r.m.position.copy(r.pos); r.m.lookAt(tA.copy(r.pos).add(r.vel));
      this.fx.trail(r.pos, 0.7);
      let hitAt = null, direct = null;
      if (r.arm <= 0) for (const p of planes) {
        if (!p.alive || p.team === r.team) continue;
        const t = segClosest(r.prev, r.pos, p.pos, tC), d = tC.distanceTo(p.pos);
        if (d < p.radius*0.8) { hitAt = tC.clone(); direct = p; break; }
        if (r.def.prox && d < r.def.prox + p.radius*0.4) { hitAt = tC.clone(); break; }
      }
      if (!hitAt) for (const s of ships) {
        if (!s.alive || s.team === r.team || r.pos.distanceToSquared(s.pos) > 130*130) continue;
        const near = s.inside(r.pos) || (s.comps && s.comps.some(c => c.alive && !c.virtual && s.toLocal(r.pos, tD).distanceTo(c.pos) < c.r + 1));
        if (near) { hitAt = r.pos.clone(); s.blast(r.pos, r.def.dmg*(r.def.id === 'he' ? 2 : r.def.id === 'ap' ? 1.6 : 0.6), r.def.splash, r.owner, r.def.id === 'he'); break; }
      }
      if (!hitAt && this.targets) for (const t of this.targets) if (t.alive && t.team !== r.team && segClosest(r.prev, r.pos, t.pos, tC) >= 0 && tC.distanceTo(t.pos) < t.r) { hitAt = tC.clone(); break; }
      if (!hitAt && r.pos.y < Math.max(w.height(r.pos.x, r.pos.z), 0.4)) hitAt = r.pos.clone();
      if (!hitAt && r.life <= 0) hitAt = r.pos.clone();
      if (hitAt) { this.explodeRocket(r, hitAt, direct); this.scene.remove(r.m); this.rockets.splice(i, 1); }
    }
    this.tracers.draw(this.bullets);
  },
  explodeRocket(r, at, direct){
    const d = r.def; this.fx.explosion(at, d.id === 'flak' ? 0.5 : 0.75);
    if (this.targets) for (const t of this.targets) if (t.alive && t.team !== r.team) { const dd = t.pos.distanceTo(at); if (dd < t.r + d.splash) this.hitTarget(t, d.dmg*(d.id === 'he' ? 2.2 : d.id === 'ap' ? 1.6 : 0.8)*(dd < t.r + 2 ? 1 : 0.5), r.owner); }
    if (this.torps) for (const t of this.torps) if (t.team !== r.team && t.pos.distanceTo(at) < d.splash + 4) { t.hp = 0; G.HUD.feed(r.owner && r.owner.isPlayer ? 'You blew up a torpedo' : 'A torpedo was blown up', r.owner && r.owner.isPlayer); }
    if (this.audio) this.audio.boom(at, false);
    const ammo = {a:1, i:1};
    for (const p of this.planes) {
      if (!p.alive || p.team === r.team) continue;
      const dist = p.pos.distanceTo(at), reach = d.splash + p.radius*0.5;
      if (p !== direct && dist > reach) continue;
      const k = p === direct ? 1 : clamp(1 - dist/reach, 0, 1)*0.7;
      p.damage(d.dmg*k, p.facingOf(at), ammo, r.owner, {armorMul:d.armorMul || 1, wingMul:d.wingMul});
      if (d.choke && k > 0.3) p.choke = d.choke;
      if (d.knock && k > 0.05) { p.knock = 0.9; p.knockAx.set((Math.random() - 0.5)*2, (Math.random() - 0.5)*1, (Math.random() - 0.5)*3).multiplyScalar(k + 0.4); p.speed *= 1 - 0.2*k; }
    }
  },

  /* ---------- Flak: a muzzle flash now, a black burst later ---------- */
  flakShell(ship, from, at, t){
    this.fx.flare(from); (this.flakQ || (this.flakQ = [])).push({ship, at, t, team:ship.team});
  },
  updateFlak(dt){
    const Q = this.flakQ; if (!Q) return;
    for (let i = Q.length - 1; i >= 0; i--) {
      const s = Q[i]; s.t -= dt; if (s.t > 0) continue; Q.splice(i, 1);
      const S = this.fx.smoke, F = this.fx.fire, p = s.at;
      for (let k = 0; k < 14; k++) S.emit(p.x, p.y, p.z, (Math.random() - 0.5)*22, (Math.random() - 0.5)*22, (Math.random() - 0.5)*22, 9 + Math.random()*6, 2.8 + Math.random(), 0.07, 0.065, 0.06, 0.85, 7, 1.6, 0.6);
      for (let k = 0; k < 8; k++) F.emit(p.x, p.y, p.z, (Math.random() - 0.5)*60, (Math.random() - 0.5)*60, (Math.random() - 0.5)*60, 5, 0.18, 1, 0.7, 0.3, 1, 4, 2);
      if (this.audio) this.audio.flak(p);
      for (const pl of this.planes) {
        if (!pl.alive || pl.team === s.team || pl.invuln || pl.noTarget || pl.duel) continue;   // flak never touches rivals, duellists or anyone off-limits
        const d = pl.pos.distanceTo(p); if (d > 26) continue;
        pl.damage(15*(1 - d/26) + 3, pl.facingOf(p), {a:1, i:1}, s.ship, {wingMul:0.8});
      }
    }
  },

  /* ---------- Docking: slow down, line up with the ship, fly through a side ring; the hook catches you ---------- */
  updateRearm(dt){
    const P = this.player, s = this.ships[0]; if (!P || !s || !this.running) return;
    const docks = s.obj.userData.docks; if (!docks) return;
    const F = tC.set(Math.sin(s.heading), 0, Math.cos(s.heading));
    this.dockInfo = [];
    if (this.docked) {
      const d = this.docked, D = docks[d.i]; d.t += dt;
      s.worldPoint(tA.copy(D.ring).add(tB.set(0, 1.2, -1)), P.pos); P.q.copy(s.q); P.speed = s.speed; P.vel.copy(s.vel); P.sync(dt);
      if (!s.alive) d.t = 99;
      if (d.t >= 3.2) {
        for (const gn of P.guns) { gn.rounds = gn.def.ammo; P.spent.ammo[gn.i] = 1; }
        P.rockets = P.L.hp*3; P.spent.rockets = P.rockets;
        P.armor = P.armor.map((a, k) => Math.min(P.armorMax[k], a + P.armorMax[k]*0.6));
        P.internal = Math.min(P.internalMax, P.internal + P.internalMax*0.4);
        D.cd = 30; this.docked = null; P.frozen = false; P.speed = 52; P.throttle = 1;
        P.q.multiply(new THREE.Quaternion().setFromAxisAngle(tA.set(1, 0, 0), 0.12));
        const f = tA.set(0, 0, 1).applyQuaternion(P.q); this.aimYaw = Math.atan2(f.x, f.z); this.aimPitch = -0.05;
        G.HUD.toast('Released. Rearmed and patched'); G.HUD.radio(G.RADIO.short, G.pick(['Hook\'s off. Go give \'em hell.', 'Full cans and fresh patches. Off you go, sugar.', 'Fixed what we could. Don\'t bring it back like that again.']));
      }
      return;
    }
    if (!P.alive || !s.alive) return;
    const top = G.hookTop(this.player);
    this.updateHomeDock(s, P, F, top);
    docks.forEach((D, i) => {
      D.cd = Math.max(0, (D.cd || 0) - dt);
      const R = s.worldPoint(D.ring, new V3()), rel = tA.copy(P.pos).sub(R), along = rel.dot(F);
      const lat = tB.copy(rel).addScaledVector(F, -along).length(), dist = rel.length();
      const slowOk = P.speed <= top, alignOk = P.fwd.dot(F) > 0.94, prev = D.prevAlong;
      D.prevAlong = along;
      this.dockInfo.push({R, dist, slowOk, alignOk, lat, cd:D.cd, i});
      if (prev === undefined || !(prev < 0 && along >= 0) || lat > 6.5) return;
      if (D.cd > 0) { G.HUD.toast(`Dock crew still busy: ${Math.ceil(D.cd)}s`); return; }
      if (!slowOk) { G.HUD.toast('Too fast: the hook missed you'); return; }
      if (!alignOk) { G.HUD.toast('Not lined up with the ship: no catch'); return; }
      this.docked = {i, t:0}; P.frozen = true; P.fire = false; P.fireRk = false;
      G.HUD.toast('Hooked! Hold tight'); if (this.audio) this.audio.hitMe(true);
      G.HUD.radio(G.RADIO.short, G.pick(['Got you! Ammo cans coming down the line.', 'Nice catch, flyboy. Patching you up.', 'Hooked and holding. Give us three seconds.']));
    });
  },

  /* Redock: a catch ring round the trapeze bar on the Margaret's centre line. Come up from astern, slow and lined up,
     and the trapeze takes you back aboard: the flight ends and you go to the hangar. Not offered in story episodes. */
  updateHomeDock(s, P, F, top){
    const m = this.mission; if (!m.canRedock || !m.canRedock()) { this.homeInfo = null; return; }
    if (!s.homeRing) { const r = G.buildBoostRing(5.5); r.position.set(0, -43.5, -22); s.obj.add(r); s.homeRing = r; }
    if (this.redocking) return;
    const R = s.worldPoint(tD.set(0, -43.5, -22), new V3()), H = tA.copy(P.pos).addScaledVector(P.up, 1.6), rel = H.sub(R), along = rel.dot(F);
    const lat = tB.copy(rel).addScaledVector(F, -along).length(), dist = P.pos.distanceTo(R), slowOk = P.speed <= top, alignOk = P.fwd.dot(F) > 0.94, prev = this.homePrev;
    this.homePrev = along; this.homeInfo = {R, dist, slowOk, alignOk};
    if (prev === undefined || !(prev < 0 && along >= 0) || lat > 5.5*(G.hasMod('winch') ? 1.25 : 1)) return;
    if (m.job) { G.HUD.toast('Finish or abandon your job first'); return; }
    if (!slowOk) { G.HUD.toast('Too fast for the trapeze'); return; }
    if (!alignOk) { G.HUD.toast('Line up with the ship to catch the trapeze'); return; }
    this.redocking = true; P.frozen = true; P.fire = P.fireRk = false; this.running = false; this.homeInfo = null;
    if (m.hang) { m.g = this; m.ship = s; }
    const hold = () => { s.worldPoint(tA.set(0, -34.5 - 9 - 1.6, -22), P.pos); P.q.copy(s.q); P.speed = s.speed; P.vel.copy(s.vel); P.sync(); };
    hold(); let ct = 0;
    this.cine = (dt, cam) => { ct += dt; hold(); s.worldPoint(tA.set(-38, -22, 10), tB); cam.position.lerp(tB, ct < 0.1 ? 1 : 0.04); cam.lookAt(tC.copy(P.pos).add(tA.set(0, 2, 0))); };
    G.HUD.toast('On the trapeze! Hoisting you aboard'); if (this.audio) this.audio.hitMe(true);
    G.HUD.radio(G.RADIO.short, G.pick(['Welcome home, sugar. Mind the paint on the way in.', 'Got you on the bar. Hauling you up.', 'Hook\'s on. Wipe your feet in my hangar.']));
    setTimeout(() => { if (G.game === this) G.UI.redocked(this); }, 2600);
  },

  /* ---------- Parachutes: shot-down pilots float home (mostly) ---------- */
  spawnChute(pos, vel){
    const g = new THREE.Group();
    const can = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 4, 0, Math.PI*2, 0, Math.PI/2).scale(1, 0.55, 1), G.mat(0xf1ece0, {side:THREE.DoubleSide}));
    can.position.y = 5; g.add(can);
    const man = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.4), G.mat(0x5a3a22)); g.add(man);
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5, 3), G.mat(0x444444)); const a = i*Math.PI/2 + 0.78; l.position.set(Math.cos(a)*1.4, 2.6, Math.sin(a)*1.4); l.rotation.set(Math.sin(a)*0.5, 0, -Math.cos(a)*0.5); g.add(l); }
    g.position.copy(pos); this.scene.add(g);
    this.chutes.push({g, vel:vel.clone().multiplyScalar(0.3), t:30});
  },
  updateChutes(dt){
    for (let i = this.chutes.length - 1; i >= 0; i--) {
      const c = this.chutes[i]; c.t -= dt; c.vel.multiplyScalar(1 - dt*0.9); c.vel.y = Math.max(c.vel.y - 9.8*dt, -5.5);
      c.g.position.addScaledVector(c.vel, dt); c.g.rotation.y += dt*0.3;
      const gh = Math.max(this.world.height(c.g.position.x, c.g.position.z), 0.4);
      if (c.g.position.y < gh + 0.8 || c.t <= 0) { this.scene.remove(c.g); this.chutes.splice(i, 1); }
    }
  }
};
})();
