(function(){
'use strict';
/* AI pilots: dogfighters and airship strafers. They fly the same planes through the same steer() as the player's mouse aim. */
const G = window.G, V3 = THREE.Vector3;
const tA = new V3(), tB = new V3(), tC = new V3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

G.Pilot = class {
  constructor(game, plane, o = {}){
    this.g = game; this.p = plane; this.role = o.role || 'fighter'; this.skill = (o.skill ?? 0.5)*(plane.team !== 0 && !o.wing && G.TUNE ? G.TUNE.enemySkill : 1);
    this.state = 'attack'; this.t = 0; this.target = null; this.retT = 0; this.dir = new V3(); this.jit = new V3(); this.jitT = 0;
    this.side = Math.random() < 0.5 ? 1 : -1; this.fireT = 0;
  }
  /* steer, but below ~400 m never aim the nose much below the horizon, and keep formation turns flat */
  fly(dir){
    const gh = this.gh ?? 999;
    if (gh < 400) { const floor = -0.25 + (400 - gh)/400*0.4; if (dir.y < floor) { dir.y = floor; dir.normalize(); } }
    return this.p.steer(dir);
  }
  enemies(){ return this.g.planes.filter(q => q.alive && !q.docked && !q.noTarget && !q.invuln && q.team !== this.p.team); }
  pickTarget(){
    if (this.role === 'strafe' && this.shipTarget && this.shipTarget.alive) return this.shipTarget;
    if (this.role === 'strafe') { const s = this.g.ships.find(s => s.alive && s.team !== this.p.team && (!s.state || s.state === 'fighting' || s.state === 'running')); if (s) return s; }
    if (this.wing) {
      // pick independently: planes lining up on the player first, skip what the player is already shooting,
      // and don't double up on another wingman's target
      const P = this.g.player, mine = this.g.assist && this.g.assist.target, others = new Set((this.g.wingmen || []).filter(w => w !== this && w.p.alive).map(w => w.target));
      let best = null, bs = 1e9;
      for (const q of this.enemies()) {
        if (q.invuln || q.duel) continue;   // a duel is one-on-one: wingmen stay out of it
        const dP = P ? q.pos.distanceTo(P.pos) : 0, dMe = q.pos.distanceTo(this.p.pos);
        if (this.order === 'cover' && dP > 1100) continue;
        let sc = this.order === 'cover' ? dP + dMe*0.35 : dMe;
        if (P && P.alive && dP < 900 && tA.copy(P.pos).sub(q.pos).normalize().dot(q.fwd) > 0.75) sc *= 0.25;   // nose on the player: kill it first
        const hm = this.g.helpMark; if (hm && hm.q === q && hm.until > this.g.t && hm.by !== this) sc *= 0.4;   // a squadmate's yelling about this one
        if (q === mine) sc *= 3; if (others.has(q)) sc *= 2.5;
        if (sc < bs) { bs = sc; best = q; }
      }
      return best;
    }
    let best = null, bd = 1e9;
    for (const q of this.enemies()) { const d = q.pos.distanceTo(this.p.pos)*(q.isPlayer || q.human ? 0.8 : 1); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  /* A wingman with a bandit close behind, nose on and shooting, yells for help. The bandit is flagged on the HUD. */
  callForHelp(dt){
    this.helpCd = (this.helpCd || 0) - dt; if (this.helpCd > 0) return;
    const p = this.p;
    for (const q of this.enemies()) {
      if (!q.fire) continue;
      const d = tA.copy(p.pos).sub(q.pos), dist = d.length(); if (dist > 650) continue;
      if (d.normalize().dot(q.fwd) < 0.93 || d.dot(p.fwd) < 0.3) continue;   // nose on me, and behind me
      this.helpCd = 14; this.g.helpMark = {q, by:this, who:this.wing.short, until:this.g.t + 8};
      G.HUD.radio(this.wing.short, G.pick(this.wing.help)); return;
    }
  }
  /* Return to base: break off and head for the Margaret (or the nearest friendly strip, or just away), then dock. */
  goHome(dt){
    const p = this.p, g = this.g, s = g.ships.find(s => s.alive && s.team === p.team && !s.hidden);
    let to, r = 280;
    if (s) to = s.worldPoint(tC.set(this.side*14, -60, -30), tB);
    else if (g.runways && g.runways.length) { const rw = g.runways.reduce((a, b) => a.pos.distanceTo(p.pos) < b.pos.distanceTo(p.pos) ? a : b); to = tB.copy(rw.pos); to.y = Math.max(g.world.height(to.x, to.z), 0.4) + 140; r = 350; }
    else { this.homeT = (this.homeT || 0) + dt; to = tB.copy(p.pos).addScaledVector(tC.copy(p.pos).sub(g.player.pos).setY(0).normalize(), 500); to.y = p.pos.y + 20; }
    if (p.pos.distanceTo(to) < r || this.homeT > 25) { this.homeT = 0; g.dockWingman(this, {ship:s}); return; }
    this.fly(tA.copy(to).sub(p.pos).normalize()); p.throttle = 0.9;
  }
  /* Is an enemy sitting on my tail with its nose on me? */
  tailed(){
    for (const q of this.enemies()) {
      const d = tA.copy(this.p.pos).sub(q.pos), dist = d.length(); if (dist > 450) continue;
      if (d.normalize().dot(q.fwd) > 0.96) return q;
    }
    return null;
  }
  update(dt){
    const p = this.p; if (!p.alive || p.docked) return;
    this.t -= dt; this.retT -= dt; this.jitT -= dt;
    if (this.retT <= 0 || !this.target || !this.target.alive) { this.target = this.pickTarget(); this.retT = 2 + Math.random(); }
    if (this.jitT <= 0) { this.jitT = 0.35; const j = (1 - this.skill)*0.07 + 0.012; this.jit.set((Math.random() - 0.5)*j, (Math.random() - 0.5)*j, (Math.random() - 0.5)*j); }
    p.fire = false; p.fireRk = false; p.throttle = 1;
    if (this.g.done) { this.dir.copy(p.fwd).setY(Math.max(0.05, p.fwd.y)).normalize(); this.fly(this.dir); return; }   // mission's over: hold fire, fly straight
    if (this.wing) this.callForHelp(dt);
    const w = this.g.world;
    // terrain and sea: look ahead, pull up hard
    // terrain and sea: look further ahead the faster we're sinking, and pull up early
    const fall = Math.max(0, -p.vel.y), look = 2.6 + fall/25;
    const ahead = tA.copy(p.pos).addScaledVector(p.vel, look), gAhead = Math.max(w.height(ahead.x, ahead.z), 0.4), clear = p.pos.y - Math.max(gAhead, w.height(p.pos.x, p.pos.z));
    this.gh = p.pos.y - Math.max(w.height(p.pos.x, p.pos.z), 0.4);
    if (clear < 150 + fall*2.5 || ahead.y < gAhead + 90) {
      this.dir.copy(p.fwd).setY(0).normalize().setY(1.1).normalize(); p.steer(this.dir); p.throttle = 1; return;
    }
    // airships: don't fly into one
    for (const s of this.g.ships) {
      // friendly pilots on their own carrier look further ahead and give her a wider berth
      const own = s.team === p.team, look = own ? [0.6, 1.3, 2.2, 3.2, 4.2] : [0.8, 1.6, 2.6], pad = own ? 42 : 26;
      if (!s.alive || p.pos.distanceToSquared(s.pos) > (own ? 620 : 380)**2) continue;
      if (look.some(t => s.inside(tB.copy(p.pos).addScaledVector(p.vel, t), pad))) { this.dir.copy(p.pos).sub(s.pos).setY(0).normalize(); this.dir.y = p.pos.y > s.pos.y ? 0.9 : -0.5; this.fly(this.dir.normalize()); return; }
    }
    if (p.pos.length() > 7600) { this.dir.copy(p.pos).negate().setY(0).normalize(); this.dir.y = 0.1; this.fly(this.dir); return; }
    if (this.route) {
      {
        const w = this.g.world, wp = this.route[this.wp];
        if (wp) {
          const gy = Math.max(w.height(wp.x, wp.z), 0.4), d = Math.hypot(wp.x - p.pos.x, wp.z - p.pos.z);
          const ty = wp.y !== undefined ? Math.max(wp.y, gy + 60) : d > 1500 ? Math.max(gy + 260, Math.min(p.pos.y, gy + 600)) : gy + (wp.agl || 110);
          if (d < (wp.r || 200)) { this.wp++; if (this.onWaypoint) this.onWaypoint(this.wp); }
          this.fly(tA.set(wp.x - p.pos.x, ty - p.pos.y, wp.z - p.pos.z).normalize()); p.throttle = this.raceThrottle || 0.85; return;
        }
        const L = this.route[this.route.length - 1], a = this.g.t*0.3 + this.side, gy = Math.max(w.height(L.x, L.z), 0.4);
        this.fly(tA.set(L.x + Math.sin(a)*260 - p.pos.x, gy + 170 - p.pos.y, L.z + Math.cos(a)*260 - p.pos.z).normalize()); p.throttle = 0.7; return;
      }
    }
    if (this.wing) {
      const P = this.g.player;
      if (this.order === 'rtb') return this.goHome(dt);
      this.role = this.order === 'zep' && this.g.ships.some(s => s.alive && s.team !== p.team && (s.state === 'fighting' || s.state === 'running')) ? 'strafe' : 'fighter';
      if (P && P.onGround) {   // the lead is on the ground: circle overhead
        const a = this.g.t*0.12 + (this.side > 0 ? 0 : Math.PI), slot = tB.set(P.pos.x + Math.sin(a)*650, P.pos.y + 320, P.pos.z + Math.cos(a)*650);
        this.fly(tA.copy(slot).sub(p.pos).normalize()); p.throttle = 0.75; return;
      }
      if (P && P.alive && (this.order === 'form' || (this.order === 'cover' && !this.enemies().some(q => q.pos.distanceTo(P.pos) < 900)))) {
        if (this.state === 'extend' || this.state === 'break') this.state = 'attack';
        const slot = tB.copy(P.pos).addScaledVector(P.fwd, -(this.slotBack || 28)).addScaledVector(P.right, this.side*22).add(tC.set(0, (this.slotBack || 28) > 30 ? 9 : 4, 0));   // finger-four: Doc trails further out
        const to = tA.copy(slot).sub(p.pos), d = to.length();
        const fd = d > 40 ? to.normalize() : tA.copy(P.fwd).addScaledVector(to.normalize(), Math.min(0.6, d/60)).normalize();
        if (fd.dot(p.fwd) < 0.2) { fd.y *= 0.3; fd.normalize(); }
        this.fly(fd);
        p.throttle = clamp(P.speed/p.top + (to.dot(P.fwd) > 0 ? 0.25 : -0.2)*Math.min(1, d/80), 0.3, 1);
        return;
      }
      if (this.retT > 1.5) this.retT = 1.5;   // wingmen re-check threats more often than pirates do
    }
    if (!this.wing && !this.limping && p.parts && p.team !== 0 && p.pk()[0] < 0.35) {   // engine's going: a bandit limps away from the fight, shallow climb, everything she's got
      this.limping = true; this.role = 'flee'; const P = this.g.player; this.dir.copy(p.pos).sub(P ? P.pos : tB.set(0, 0, 0)).setY(0); if (this.dir.lengthSq() < 1) this.dir.copy(p.fwd).setY(0); this.dir.normalize().setY(0.08).normalize();
    }
    if (this.role === 'flee') { this.dir.setY(Math.max(this.dir.y, 0.05)).normalize(); this.fly(this.dir); p.throttle = 1; return; }
    if (this.state === 'extend' || this.state === 'break') {
      this.fly(this.dir); if (this.t <= 0) this.state = 'attack'; return;
    }
    const tl = this.tailed();
    if (tl && Math.random() < dt*(0.35 + this.skill*0.9)) {
      this.state = 'break'; this.t = 1.1 + Math.random()*0.9; this.side = -this.side;
      this.dir.copy(p.right).multiplyScalar(this.side).addScaledVector(p.up, 0.5).addScaledVector(p.fwd, 0.2).normalize(); return;
    }
    const T = this.target; if (!T) { this.dir.copy(p.fwd).setY(0).normalize(); this.fly(this.dir); return; }
    if (T instanceof G.Airship) return this.strafe(T, dt);
    // dogfight: lead pursuit with a skill-based wobble
    const dist = p.pos.distanceTo(T.pos), tt = dist/820;
    const lead = tB.copy(T.pos).addScaledVector(T.vel, tt).sub(p.pos).normalize().add(this.jit).normalize();
    const ang = this.fly(lead);
    if (dist < 75 || (dist < 160 && tA.copy(T.pos).sub(p.pos).normalize().dot(p.fwd) < 0.2)) {
      this.state = 'extend'; this.t = 2.5 + Math.random()*2;
      this.dir.copy(p.fwd).addScaledVector(p.right, this.side*0.6).setY(0.15).normalize(); return;
    }
    const range = 520; this.fireT -= dt;
    if (dist < range && ang < 0.05 + (1 - this.skill)*0.03 && p.hasAmmo()) p.fire = true;
    if (dist < 320 && ang < 0.04 && p.rockets > 0 && Math.random() < dt*0.25*this.skill) p.fireRk = true;
    if (dist < 220 && tA.copy(T.pos).sub(p.pos).normalize().dot(T.fwd) > 0.7) p.throttle = clamp(T.speed/p.top, 0.5, 1);
  }
  strafe(S, dt){
    const p = this.p;
    if (S.comps && (!this.part || !this.part.alive)) {
      const live = S.comps.filter(c => c.alive && !c.virtual && c.kind !== 'bridge');
      const pref = live.filter(c => c.kind === 'engine' || c.kind === 'flak' || c.kind === 'mg' || c.kind === 'rocket');
      this.part = G.pick(pref.length ? pref : live.length ? live : S.comps.filter(c => c.alive && !c.virtual));
    }
    const aim = S.worldPoint(this.part ? this.part.pos : tC.set(0, -18, 10 + this.side*20), tB), to = tA.copy(aim).sub(p.pos), dist = to.length();
    if (dist > 1100) { to.y += 180; this.fly(to.normalize()); return; }
    const ang = this.fly(to.normalize().add(this.jit).normalize());
    if (dist < 520 && ang < (this.part ? 0.05 : 0.09) && p.hasAmmo()) p.fire = true;
    if (dist < 420 && ang < 0.06 && p.rockets > 0 && Math.random() < dt*0.8) p.fireRk = true;
    if (dist < (this.part ? 170 : 260)) { this.state = 'extend'; this.t = 5 + Math.random()*2; this.dir.copy(p.fwd).setY(0.35).addScaledVector(p.right, this.side*0.7).normalize(); }
  }
};
})();
