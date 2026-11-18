(function(){
'use strict';
/* Planes: arcade prop flight, zonal armor, guns and rocket racks. Shared by the player and AI pilots. */
const G = window.G, V3 = THREE.Vector3, Q = THREE.Quaternion;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sm = (a, b, x) => { const t = clamp((x - a)/(b - a), 0, 1); return t*t*(3 - 2*t); };
const X = new V3(1, 0, 0), Y = new V3(0, 1, 0), Z = new V3(0, 0, 1);
const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3(), qA = new Q(), qB = new Q(), qInv = new Q();
G.FACING = ['Nose', 'Tail', 'L wing', 'R wing'];

/* Turret gunners: where each chassis carries its gunner, and what he can see. 'top' = a dorsal dome that covers
   the upper rear and the beams; 'tail' = a tail gun covering a cone astern. */
G.TURRET_MOUNTS = {
  jackal:     [{p:[0, 0.9, -1.15], arc:'top'}],
  highwayman: [{p:[0, 1.15, -1.6], arc:'top'}],
  grackle:    [{p:[0, 0, -2.7], arc:'tail'}],
  ironclad:   [{p:[0, 0.38, -5.6], arc:'tail'}],
  thunderbuss:[{p:[2.7, 1.0, -1.9], arc:'top'}, {p:[-2.7, 1.0, -1.9], arc:'top'}]
};
G.Plane = class {
  constructor(game, o){
    this.g = game; this.L = JSON.parse(JSON.stringify(o.loadout)); this.team = o.team; this.isPlayer = !!o.player;
    this.name = o.name || 'Pilot'; this.callsign = o.callsign || this.name;
    this.spent = {ammo:this.L.guns.map(() => 1), rockets:this.L.hp*3};
    this.st = G.flightStats(this.L, this.spent); this.stT = 0;
    this.obj = G.buildPlane(this.L.chassis, this.L.paint); game.scene.add(this.obj);
    this.ud = this.obj.userData; this.radius = this.ud.radius;
    this.pos = (o.pos || new V3()).clone(); this.q = (o.q || new Q()).clone();
    this.speed = o.speed || this.st.top*0.8; this.vel = new V3(); this.throttle = o.throttle ?? 0.85;
    this.ctrl = {pitch:0, roll:0, yaw:0}; this.cs = {pitch:0, roll:0, yaw:0}; this.fire = false; this.fireRk = false;
    const mods = this.isPlayer ? (this.L.mods || []) : [], drum = mods.includes('drums') ? 1.3 : 1;
    this.armor = this.L.arm.map(a => a*G.ARMOR_HP*(mods.includes('plate') ? 1.25 : 1)); this.armorMax = this.armor.slice();
    this.internal = this.st.internal*(o.internalMul || 1)*(mods.includes('spars') ? 1.3 : 1); this.internalMax = this.internal;
    this.guns = this.L.guns.map((s, i) => s.cal ? {i, cal:s.cal, def:drum > 1 ? Object.assign({}, G.GUNS[s.cal], {ammo:Math.round(G.GUNS[s.cal].ammo*drum)}) : G.GUNS[s.cal], ammo:G.AMMO[s.ammo] || G.AMMO.slug, rounds:Math.round(G.GUNS[s.cal].ammo*drum), cd:Math.random()*0.05, barrel:0} : null).filter(Boolean);
    const TM = G.TURRET_MOUNTS[this.L.chassis] || [];
    this.turrets = TM.length ? (this.L.turrets || []).filter(t => t.cal && G.GUNS[t.cal]).map((t, i) => ({m:TM[i % TM.length], pos:new V3(...TM[i % TM.length].p), mesh:(this.ud.turretGuns || [])[i % Math.max(1, (this.ud.turretGuns || []).length)], yaw:0, pitch:0, def:G.GUNS[t.cal], ammo:G.AMMO[t.ammo] || G.AMMO.slug, rounds:G.GUNS[t.cal].ammo, cd:0, burst:0, rest:Math.random(), tgt:null, bias:new V3()})) : [];
    this.rockets = this.L.hp*3; this.rocketDef = G.ROCKETS[this.L.rocket] || G.ROCKETS.he; this.rkCd = 0; this.rkSide = 0;
    this.alive = true; this.grace = o.grace || 0; this.choke = 0; this.knock = 0; this.knockAx = new V3(); this.age = 0; this.smokeT = 0; this.lastHitBy = null; this.hitFlash = 0;
    this.fwd = new V3(0, 0, 1); this.up = new V3(0, 1, 0); this.right = new V3(-1, 0, 0);
    this.retract = this.ud.legs.length > 0; this.gearUp = this.retract; this.gearT = this.gearUp ? 1 : 0;   // planes start in the air; groundRoll drops it
    this.sync();
  }
  get top(){ return this.st.top; }
  axes(){ this.fwd.copy(Z).applyQuaternion(this.q); this.up.copy(Y).applyQuaternion(this.q); this.right.set(-1, 0, 0).applyQuaternion(this.q); }

  /* Fly toward a world direction: roll the target into the lift plane, then pull. Writes this.ctrl. */
  steer(dir, o = {}){
    qInv.copy(this.q).invert(); const l = tA.copy(dir).normalize().applyQuaternion(qInv);
    const ang = Math.acos(clamp(l.z, -1, 1));
    const pitchErr = Math.atan2(l.y, Math.max(0.05, l.z)), yawErr = Math.atan2(-l.x, Math.max(0.05, l.z));
    const aggr = sm(0.04, 0.32, ang);
    const rollErr = Math.atan2(-l.x, l.y);
    const level = Math.asin(clamp(this.right.y, -1, 1)) + (this.up.y < 0 ? Math.sign(this.right.y || 1)*1.2 : 0);
    this.ctrl.roll = clamp(rollErr*1.7*aggr + level*1.4*(1 - aggr), -1, 1);
    const pullOk = Math.abs(rollErr) < 1.1 || ang < 0.25;
    this.ctrl.pitch = pullOk ? clamp(ang > 0.25 ? Math.max(pitchErr*3, ang*1.2) : pitchErr*3.2, -1, 1) : 0.15;
    this.ctrl.yaw = clamp(yawErr*2.4, -1, 1)*(1 - aggr*0.6);
    return ang;
  }

  update(dt){
    if (!this.alive || this.frozen) return;
    if (this.remote) { this.remoteUpdate(dt); return; }   // flown over the wire (net.js)
    if (this.onGround) { this.age += dt; this.groundRoll(dt); return; }
    this.age += dt; this.stT -= dt;
    if (this.stT <= 0) { this.stT = 0.5; this.st = G.flightStats(this.L, this.spent); }
    const st = this.st; this.axes();
    const stall = this.stallSpeed(), auth = clamp((this.speed - stall*0.55)/(stall*0.9), 0.22, 1)*(this.speed > st.top*1.15 ? 0.8 : 1);
    const wingHurt = (this.armor[3] <= 0 ? 1 : 0) - (this.armor[2] <= 0 ? 1 : 0), tailHurt = this.armor[1] <= 0 ? 0.75 : 1;
    // control surfaces ease toward the stick instead of snapping, which keeps the mouse-aim autopilot from twitching
    const cs = this.cs, ease = Math.min(1, dt*7);
    cs.pitch += (this.ctrl.pitch - cs.pitch)*ease; cs.roll += (this.ctrl.roll - cs.roll)*ease; cs.yaw += (this.ctrl.yaw - cs.yaw)*ease;
    let p = cs.pitch, r = cs.roll, y = cs.yaw;
    if (this.man) {
      const m = this.man, s = m.steps[m.i]; m.el += dt;
      const k = Math.min(dt, s.t - (m.el - dt))/s.t;
      if (s.pitch) this.q.multiply(qA.setFromAxisAngle(X, -s.pitch*k));
      if (s.roll) this.q.multiply(qA.setFromAxisAngle(Z, s.roll*k));
      if (s.yaw) this.q.multiply(qA.setFromAxisAngle(Y, -s.yaw*k));
      if (s.bleed) this.speed *= 1 - s.bleed*dt/s.t;
      if (m.el >= s.t) { m.i++; m.el = 0; if (m.i >= m.steps.length) { const kind = m.kind; this.man = null; if (this.g.onStuntDone) this.g.onStuntDone(this, kind); } }
      p = r = y = 0; cs.pitch = cs.roll = cs.yaw = 0;
    }
    if (this.knock > 0) { this.knock -= dt; p += this.knockAx.x; r += this.knockAx.z; y += this.knockAx.y; }
    const pr = -p*st.pitch*auth*tailHurt*dt, rr = (r*st.roll*auth + wingHurt*0.35)*dt, yr = -y*st.yaw*auth*dt;
    qA.setFromAxisAngle(X, pr); this.q.multiply(qA);
    qA.setFromAxisAngle(Y, yr); this.q.multiply(qA);
    qA.setFromAxisAngle(Z, rr); this.q.multiply(qA);
    // banked planes slice gently round (helps keyboard flying), and a stalled nose drops toward the ground
    const bank = clamp(-this.right.y, -1, 1);
    this.q.premultiply(qB.setFromAxisAngle(Y, -bank*0.2*auth*dt));
    if (this.speed < stall) {
      const k = (1 - this.speed/stall)*1.6*dt; tC.copy(this.fwd).lerp(tB.set(0, -1, 0), clamp(k, 0, 0.5)).normalize();
      qA.setFromUnitVectors(this.fwd, tC); this.q.premultiply(qA);
    }
    this.q.normalize(); this.axes();
    // speed: thrust toward throttle x top, gravity along the nose, hard-turn bleed
    let thr = this.engineDead ? 0 : this.choke > 0 ? 0.08 : this.throttle;
    if (st.jet) {   // a turbojet: slow to spool up and down, and short of push until it's moving fast
      this.spool = this.spool ?? thr; this.spool += (thr - this.spool)*Math.min(1, dt*(thr > this.spool ? 0.45 : 0.8)); thr = this.spool;
    }
    if (this.choke > 0) this.choke -= dt;
    let a = this.engineDead ? -0.00035*this.speed*this.speed : st.accel*(thr*1.04*(st.jet ? 0.55 + 0.45*Math.min(1, this.speed/(st.top*0.55)) : 1) - this.speed/st.top)*1.7;
    const sinC = this.fwd.y; a -= 9.81*sinC*(sinC > 0 ? 0.95/st.climb : 0.9);
    a -= st.bleed*Math.abs(p)*auth*this.speed*0.045;
    if (this.retract && this.gearT < 1) a -= st.accel*1.7*0.08*(1 - this.gearT)*this.speed/st.top;   // hanging gear costs ~7% top speed
    if (this.nitro > 0) { this.nitro -= dt; a += 22; }
    if (this.flaps) a -= Math.max(0, this.speed - this.flapMax())*0.9 + this.speed*0.004;   // flaps: big drag past the flap limit
    this.speed = clamp(this.speed + a*dt, 8, st.top*1.7);
    const sink = this.speed < stall ? (stall - this.speed)*0.9 : 0;
    this.vel.copy(this.fwd).multiplyScalar(this.speed); this.vel.y -= sink;
    this.pos.addScaledVector(this.vel, dt);
    // collisions
    const w = this.g.world, gh = Math.max(w.height(this.pos.x, this.pos.z), 0.4);
    // touchdown: on a runway, gently, wings level, nose not buried
    if (this.retract && !this.isPlayer) this.gearUp = this.pos.y - gh > 25;
    const gear = this.ud.gear || 1.8;
    if (this.isPlayer && this.pos.y < gh + gear + 0.3 && this.g.runwayAt && this.g.runwayAt(this.pos)) {
      if (this.retract && this.gearT > 0.05) { if (this.g.onBelly) this.g.onBelly(this); this.destroy(null, 'crash'); return; }   // wheels-up landing
      const ok = this.vel.y > -6.5 && Math.abs(this.right.y) < 0.22 && this.fwd.y > -0.26 && this.speed < this.st.top*0.82;
      if (ok) { this.land(gh + gear); return; }
    }
    this.grace = Math.max(0, this.grace - dt);
    if (this.grace > 0 && this.pos.y < gh + 30) { this.pos.y = gh + 30; }   // fresh off the trapeze: can't crash yet
    if (this.pos.y < gh + 1.2) { this.pos.y = gh + 1.2; if (this.isPlayer && this.g.done) { if (this.fwd.y < 0) this.q.premultiply(qB.setFromAxisAngle(this.right, 0.5*dt)); } else { this.destroy(null, 'crash'); return; } }
    if (this.pos.y > 4200) { this.pos.y = 4200; if (this.fwd.y > 0) this.speed -= 30*dt; }
    if (!(this.isPlayer && this.g.done)) for (const s of this.g.ships) if (s.alive && s.inside(this.pos, 2)) {
      // fresh wingmen, and friendly AI on their own carrier, get shoved clear instead of exploding
      if (this.grace > 0 || (!this.isPlayer && s.team === this.team)) { this.pos.addScaledVector(tA.copy(this.pos).sub(s.pos).setY(0).normalize(), 4); this.pos.y += this.pos.y > s.pos.y ? 2 : -2; continue; }
      this.destroy(null, 'crash'); return;
    }
    // weapons
    this.updateGuns(dt); this.updateRockets(dt); if (this.turrets.length) this.updateTurrets(dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    // damage smoke
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      const f = this.internal/this.internalMax; this.smokeT = 0.05;
      const fx = this.g.fx, e = tA.copy(this.ud.exhaust).applyQuaternion(this.q).add(this.pos);
      if (f < 0.55) fx.smoke.emit(e.x, e.y, e.z, 0, 1, 0, 2 + (1 - f)*4, 1.6, 0.18, 0.17, 0.16, 0.55*(1 - f) + 0.2, 6, 0.6, 2);
      if (f < 0.28) fx.fire.emit(e.x, e.y, e.z, 0, 0, 0, 2.6, 0.12, 1, 0.55, 0.2, 1);
      for (const [k, sx] of [[2, 1], [3, -1]]) if (this.armor[k] <= 0) { const wp = tA.set(sx*3.5, -0.3, 0.6).applyQuaternion(this.q).add(this.pos); fx.smoke.emit(wp.x, wp.y, wp.z, 0, 1, 0, 1.6, 0.9, 0.55, 0.55, 0.55, 0.35, 4, 0.8, 1); }
    }
    this.sync(dt);
  }
  /* flaps: stall drops to 60%, but the plane is held to about 55% of top speed */
  /* G: raise or lower retractable gear. Returns a message for the HUD. */
  toggleGear(){
    if (!this.retract) return 'Fixed undercarriage';
    if (this.onGround) return 'Not on the ground, you don\'t';
    this.gearUp = !this.gearUp; return this.gearUp ? 'Gear up' : 'Gear down';
  }
  stallSpeed(){ return this.st.stall*(this.flaps ? 0.6 : 1); }
  flapMax(){ return this.st.top*0.55; }
  land(y){
    const hard = this.vel.y < -3.5;
    this.onGround = true; this.pos.y = y; this.groundYaw = Math.atan2(this.fwd.x, this.fwd.z); this.man = null;
    this.q.setFromAxisAngle(Y, this.groundYaw); this.axes(); this.speed = Math.min(this.speed, this.st.top*0.7);
    if (hard) { this.internal -= this.internalMax*0.08; }
    if (this.g.onTouchdown) this.g.onTouchdown(this, hard);
  }
  /* on the ground: steer the tail-dragger with the aim, throttle to roll, S to brake, pull up past rotation speed to lift off */
  groundRoll(dt){
    const st = this.st, w = this.g.world;
    this.gearUp = false; this.gearT = 0;   // on the wheels means the wheels are down
    if (this.stT <= 0) this.st = G.flightStats(this.L, this.spent); this.stT -= dt;
    let yaw = Math.atan2(this.fwd.x, this.fwd.z);
    const want = this.groundYaw ?? yaw, d = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
    yaw += clamp(d*2, -1, 1)*Math.min(1, 0.3 + this.speed/25)*0.8*dt;
    const brake = this.brake ? 11 : this.throttle < 0.2 ? 2.2 : 0.4;
    const a = (this.engineDead ? 0 : st.accel*(this.throttle*1.04 - this.speed/st.top)*1.7) - brake;
    this.speed = clamp(this.speed + a*dt, 0, st.top);
    this.q.setFromAxisAngle(Y, yaw); this.axes();
    this.vel.copy(this.fwd).multiplyScalar(this.speed);
    this.pos.addScaledVector(this.vel, dt);
    this.pos.y = Math.max(w.height(this.pos.x, this.pos.z, true), 0.4) + (this.ud.gear || 1.8);
    if (!this.g.runwayAt(this.pos) && this.speed > 12) { this.onGround = false; this.destroy(null, 'crash'); return; }
    if (!this.g.runwayAt(this.pos)) this.speed = Math.max(0, this.speed - 20*dt);
    if (this.wantLift && this.speed > this.stallSpeed()*1.15) {
      this.onGround = false; this.pos.y += 0.6; this.q.multiply(qA.setFromAxisAngle(X, -0.14)); this.axes();
      if (this.g.onLiftoff) this.g.onLiftoff(this);
    }
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.sync(dt);
  }
  sync(dt = 0){
    this.obj.position.copy(this.pos); this.obj.quaternion.copy(this.q);
    if (this.retract) {
      const t0 = this.gearT; this.gearT = clamp(this.gearT + (this.gearUp ? dt : -dt)/1.6, 0, 1);
      if (t0 !== this.gearT || !dt) { const k = sm(0, 1, this.gearT); for (const L of this.ud.legs) { const s = L.userData.side; if (s) L.rotation.set(0, 0, -s*1.5*k); else L.rotation.set(1.6*k, 0, 0); } }
      if (this.isPlayer && dt && t0 !== this.gearT && (this.gearT === 0 || this.gearT === 1) && this.g.audio && this.g.audio.gear) this.g.audio.gear();
    }
    const spin = (14 + this.speed*0.5)*(this.engineDead ? 0.06 : this.choke > 0 ? 0.15 : 0.4 + this.throttle*0.6)*dt;
    if (this.ud.jet) { const s = this.alive && !this.engineDead ? (this.spool ?? this.throttle) : 0, f = this.ud.jet.flame; this.ud.jet.hot.material.opacity = 0.25 + 0.7*s; f.material.opacity = (0.1 + 0.4*s)*(0.85 + Math.random()*0.3); f.scale.set(1, 0.5 + s + (this.nitro > 0 ? 0.8 : 0), 1); }
    for (const pr of this.ud.props || [this.ud.prop]) { if (!pr) continue; const u = pr.userData; pr.rotation.z += spin*(u.dir || 1)*(u.rate || 1); if (u.disc) u.disc.material.opacity = this.choke > 0 ? 0.05 : 0.22; }   // twins counter-rotate; an autogyro rotor turns slower
  }

  /* ---- guns: rounds alternate barrels; each pair converges ~330 m ahead ---- */
  updateGuns(dt){
    for (const gn of this.guns) {
      gn.cd -= dt;
      if (!this.fire || gn.rounds <= 0) { if (gn.cd < 0) gn.cd = 0; continue; }
      while (gn.cd <= 0 && gn.rounds > 0) {
        gn.cd += 1/gn.def.rps; gn.rounds--; gn.barrel ^= 1;
        const mz = this.ud.muzzles, m = mz[(gn.i*2 + gn.barrel) % mz.length];
        this.g.spawnBullet(this, m, gn);
        if (gn.def.recoil) this.q.multiply(qA.setFromAxisAngle(X, -gn.def.recoil*(0.5 + Math.random()*0.5)));
      }
      this.spent.ammo[gn.i] = gn.rounds/gn.def.ammo;
    }
  }
  updateRockets(dt){
    this.rkCd -= dt;
    if (this.fireRk && this.rkCd <= 0 && this.rockets > 0) {
      this.rkCd = 0.32; this.rockets--; this.spent.rockets = this.rockets; this.rkSide ^= 1;
      this.g.spawnRocket(this, this.ud.rails[this.rkSide % this.ud.rails.length], this.rocketDef);
    }
  }
  /* The gunner: picks the nearest enemy inside his arc, fires short bursts with a rough lead and a wobble that
     changes every burst. Good enough to make chasing a turret plane risky, poor enough to miss a lot. */
  updateTurrets(dt){
    const g = this.g; if (g.done || this.frozen || this.docked) return;
    for (const t of this.turrets) {
      t.cd -= dt;
      if (t.rest > 0) { t.rest -= dt; if (!t.tgt) this.slew(t, null, dt); continue; }
      if (t.rounds <= 0) continue;
      const mz = tA.copy(t.pos).applyQuaternion(this.q).add(this.pos);
      if (!t.tgt || !this.inArc(t, t.tgt, mz)) {
        t.tgt = null; let bd = 600;
        for (const q of g.planes) { if (!q.alive || q.team === this.team || q.invuln || q.docked || q.noTarget) continue; const d = q.pos.distanceTo(mz); if (d < bd && this.inArc(t, q, mz)) { bd = d; t.tgt = q; } }
        if (!t.tgt) { t.rest = 0.4; continue; }
        t.burst = 0.6 + Math.random()*0.6;
        const e = 0.13 + (this.isPlayer || this.team === 0 ? 0 : 0.01); t.bias.set((Math.random() - 0.5)*e, (Math.random() - 0.5)*e, (Math.random() - 0.5)*e);   // this burst's aiming error
      }
      const q = t.tgt, dist = q.pos.distanceTo(mz), tt = dist/t.def.muzzle;
      const dir = tB.copy(q.pos).addScaledVector(q.vel, tt*0.8).sub(this.vel.clone().multiplyScalar(tt)).sub(mz).normalize().add(t.bias);   // leads short, and shakes
      if (!this.slew(t, dir, dt)) continue;   // still swinging the guns round
      while (t.cd <= 0 && t.rounds > 0) {
        t.cd += 1/(t.def.rps*0.7); t.rounds--;
        const d = tC.copy(dir); d.x += (Math.random() - 0.5)*0.05; d.y += (Math.random() - 0.5)*0.05; d.z += (Math.random() - 0.5)*0.05; d.normalize();
        g.spawnRaw(this, mz, d, t.def, t.ammo, this.vel);
        if (g.audio) g.audio.shot(mz, t.def.pitch*1.05);
      }
      t.burst -= dt; if (t.burst <= 0) { t.rest = 0.7 + Math.random()*0.9; t.tgt = null; t.cd = 0; }
    }
  }
  /* Swing a turret's guns toward world direction dir (or home to astern when dir is null). True once on target. */
  slew(t, dir, dt){
    let yw = 0, pt = 0;
    if (dir) { qInv.copy(this.q).invert(); const l = tD.copy(dir).applyQuaternion(qInv); yw = Math.atan2(-l.x, -l.z); pt = Math.atan2(l.y, Math.hypot(l.x, l.z)); }
    const lim = t.m.arc === 'tail' ? [-0.6, 0.6] : [-0.15, 1.25]; pt = clamp(pt, lim[0], lim[1]);
    let dy = yw - t.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const sp = (dir ? 2.6 : 0.8)*dt, ey = clamp(dy, -sp, sp), ep = clamp(pt - t.pitch, -sp, sp);
    t.yaw += ey; t.pitch += ep;
    if (t.mesh) { t.mesh.rotation.y = t.yaw; t.mesh.userData.pitch.rotation.x = t.pitch; }
    return Math.abs(dy - ey) < 0.12 && Math.abs(pt - t.pitch) < 0.12;
  }
  inArc(t, q, mz){
    if (!q.alive || q.docked) return false;
    qInv.copy(this.q).invert(); const l = tC.copy(q.pos).sub(mz); if (l.lengthSq() > 640*640) return false; l.normalize().applyQuaternion(qInv);
    return t.m.arc === 'tail' ? l.z < -0.4 : l.z < 0.45 && l.y > -0.15;
  }
  hasAmmo(){ return this.guns.some(g => g.rounds > 0); }

  /* ---- damage ---- */
  facingOf(worldPoint){
    qInv.copy(this.q).invert(); const l = tA.copy(worldPoint).sub(this.pos).applyQuaternion(qInv);
    if (Math.abs(l.x) > 1.5) return l.x > 0 ? 2 : 3;
    return l.z >= -0.5 ? 0 : 1;
  }
  damage(dmg, facing, ammo, src, o = {}){
    if (this.g.netGuest && !o.net) return;   // in co-op only the host decides hits
    if (this.remote && this.g.netHost) return G.Net.forwardDamage(this, dmg, facing, ammo, src, o);
    if (this.isPlayer && G.dev && G.dev.god) return;
    if (!this.alive || (this.isPlayer && this.g.done)) return;
    if (this.invuln) { this.hitFlash = 0.15; if (this.g.onInvulnHit) this.g.onInvulnHit(this, src); return; }
    if (this.man && this.man.dodge && Math.random() < 0.5) return;   // a well-timed barrel roll makes you hard to hit
    const A = ammo.a*(o.armorMul || 1), I = ammo.i;
    const hit = (f, d) => {
      if (this.armor[f] > 0) { const a = d*A; if (a <= this.armor[f]) this.armor[f] -= a; else { const over = (a - this.armor[f])/A; this.armor[f] = 0; this.internal -= over*I; } }
      else this.internal -= d*I*(o.wingMul && f >= 2 ? o.wingMul : 1);
    };
    hit(facing, dmg);
    if (ammo.splash) { const adj = facing < 2 ? 2 + (Math.random() < 0.5 ? 0 : 1) : (Math.random() < 0.5 ? 0 : 1); hit(adj, dmg*ammo.splash); }
    this.lastHitBy = src; this.hitFlash = 0.15;
    if (this.g.onHit) this.g.onHit(this, src, dmg, facing);
    if (this.internal <= 0) this.destroy(src, 'shot');
  }
  destroy(src, how){
    if (!this.alive) return; this.alive = false;
    this.g.fx.explosion(this.pos, 1.4); this.g.fx.burner(this.pos, 4);
    this.obj.visible = false;
    if (this.g.onKill) this.g.onKill(this, src || this.lastHitBy, how);
  }
  remove(){ this.g.scene.remove(this.obj); }
};
})();
