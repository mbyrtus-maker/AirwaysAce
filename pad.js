/* =====================================================================
   Gamepad flying (DualSense, DualShock, Xbox: any pad the browser maps to the "standard" layout).
   In flight only; menus stay mouse and keyboard. Works alongside the mouse and keyboard.

     Left stick    pitch and roll (stick back = climb)       Right stick   swing the aim point / look
     R2            guns                                      L2            rockets
     R1 / L1       throttle up / down                        Cross (A)     nitro; drops you off the trapeze
     Circle (B)    barrel roll (toward the left stick)       Triangle (Y)  Immelmann
     Square (X)    Split-S                                   L3            flaps
     R3            hold to look back, tap for chase / cockpit   Create / View   landing gear
     D-pad         wingmen: up attack, right cover, left zeppelin, down form; down twice quickly sends them home
     Touchpad      chase / cockpit (DualSense)               Options / Menu    pause / resume
   ===================================================================== */
(() => {
const B = {cross:0, circle:1, square:2, triangle:3, l1:4, r1:5, l2:6, r2:7, create:8, options:9, l3:10, r3:11, up:12, down:13, left:14, right:15, touch:17};
const DZ = 0.14;
const dz = v => Math.abs(v) < DZ ? 0 : Math.sign(v)*((Math.abs(v) - DZ)/(1 - DZ));
const curve = v => Math.sign(v)*v*v*0.55 + v*0.45;   // gentle near the middle, full at the edge

const Pad = G.pad = {
  index:-1, prev:[], hold:{}, r3T:0, lx:0, ly:0, rx:0, ry:0, active:false, lastUsed:-1e9, downT:0, name:'',
  sens:() => G.save.padSens || 1,

  pick(){
    const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    if (this.index >= 0 && list[this.index] && list[this.index].connected) return list[this.index];
    for (const p of list) if (p && p.connected && p.mapping === 'standard') { this.index = p.index; this.name = p.id; return p; }
    for (const p of list) if (p && p.connected) { this.index = p.index; this.name = p.id; return p; }
    this.index = -1; return null;
  },
  /* called every frame by the UI loop, before the game updates */
  poll(g, dt, now){
    const p = this.pick(); if (!p) { this.active = false; this.lx = this.ly = this.rx = this.ry = 0; return; }
    const btn = i => { const b = p.buttons[i]; return !!b && (b.pressed || b.value > 0.4); };
    const val = i => p.buttons[i] ? p.buttons[i].value : 0;
    const press = i => btn(i) && !this.prev[i];
    const ax = p.axes || [];
    this.lx = dz(ax[0] || 0); this.ly = dz(ax[1] || 0); this.rx = dz(ax[2] || 0); this.ry = dz(ax[3] || 0);
    const used = this.lx || this.ly || this.rx || this.ry || p.buttons.some((b, i) => b && b.pressed && i !== 16);
    if (used) this.lastUsed = now;
    this.active = now - this.lastUsed < 4000;

    if (g && !g.done) {
      if (press(B.options)) { if (g.paused) G.UI.resume(); else G.UI.pause(true); }
      if (!g.paused) {
        const k = g.keys;
        let dropped = false;
        if (g.mission.awaitDrop && (press(B.cross) || press(B.r2))) { G.audio.init(); g.mission.drop(); dropped = true; }
        // held controls are read by playerControl below
        this.hold = {fire:btn(B.r2), rk:val(B.l2) > 0.4, up:btn(B.r1), down:btn(B.l1)};
        // R3: hold to look back, tap to switch chase / cockpit
        if (press(B.r3)) { this.r3T = now; g.lookBack = true; }
        if (!btn(B.r3) && this.prev[B.r3]) { g.lookBack = false; if (now - this.r3T < 250) g.key('KeyC', true), g.key('KeyC', false); }
        // aim point from the right stick, as the mouse would move it
        if (this.rx || this.ry) g.onMouse(curve(this.rx)*1100*dt*this.sens(), curve(this.ry)*850*dt*this.sens());
        // one-press actions
        if (g.running) {
          if (press(B.cross) && !dropped) g.key('ShiftLeft', true), g.key('ShiftLeft', false);
          if (press(B.circle)) g.stunt(this.lx < -0.25 ? 'rollL' : 'rollR');
          if (press(B.triangle)) g.stunt('immel');
          if (press(B.square)) g.stunt('splits');
        }
        if (press(B.l3)) g.key('KeyF', true), g.key('KeyF', false);
        if (press(B.create)) g.key('KeyG', true), g.key('KeyG', false);
        if (press(B.touch)) g.key('KeyC', true), g.key('KeyC', false);
        const order = c => { g.key(c, true); g.key(c, false); };
        if (press(B.up)) order('Digit1');
        if (press(B.right)) order('Digit2');
        if (press(B.left)) order('Digit3');
        if (press(B.down)) { if (now - this.downT < 450) order('Digit5'); else order('Digit4'); this.downT = now; }
      }
    }
    this.prev = p.buttons.map((b, i) => btn(i));
  },
  /* feel a hit: stronger for heavier hits; a no-op where the browser or pad has no rumble */
  rumble(strength = 0.5, ms = 120){
    if (!this.active) return;
    const p = this.pick(), a = p && p.vibrationActuator;
    if (!a || !a.playEffect) return;
    try { a.playEffect('dual-rumble', {duration:ms, strongMagnitude:Math.min(1, strength), weakMagnitude:Math.min(1, strength*0.7)}).catch(() => {}); } catch (e) {}
  }
};

/* left stick flies the plane directly, the way the arrow keys and A/D do, but in proportion */
const GP = G.Game.prototype, pc0 = GP.playerControl;
GP.playerControl = function(dt){
  pc0.call(this, dt);
  const P = this.player; if (!P || !P.alive || !Pad.active || P.frozen) return;
  const h = Pad.hold;
  if (h.up) P.throttle = Math.min(1, P.throttle + dt*0.6);
  if (h.down) P.throttle = Math.max(0, P.throttle - dt*(P.onGround ? 0.9 : 0.6));
  if (P.onGround) { if (Pad.ly > 0.3) P.wantLift = true; if (h.down && P.throttle <= 0.01) P.brake = true; return; }
  if (h.fire) P.fire = true; if (h.rk) P.fireRk = true;
  if (Pad.lx || Pad.ly) {
    P.ctrl.roll = Pad.lx; P.ctrl.pitch = Pad.ly*(G.save.invert ? -1 : 1);
    const f = P.fwd; this.aimYaw = Math.atan2(f.x, f.z); this.aimPitch = Math.asin(Math.max(-1, Math.min(1, f.y)));
  }
};
const onHit0 = GP.onHit;
GP.onHit = function(target, src, dmg, f){ if (target === this.player) Pad.rumble(dmg > 20 ? 0.9 : 0.45, dmg > 20 ? 260 : 110); return onHit0.call(this, target, src, dmg, f); };
const onKill0 = GP.onKill;
GP.onKill = function(plane, src, how){ if (plane === this.player) Pad.rumble(1, 600); else if (src && src === this.player) Pad.rumble(0.3, 90); return onKill0.call(this, plane, src, how); };

if (typeof addEventListener === 'function') {
  addEventListener('gamepadconnected', e => { Pad.index = e.gamepad.index; Pad.name = e.gamepad.id; if (G.HUD && G.game) G.HUD.toast('Controller connected'); });
  addEventListener('gamepaddisconnected', e => { if (e.gamepad.index === Pad.index) { Pad.index = -1; Pad.active = false; if (G.HUD && G.game) G.HUD.toast('Controller disconnected'); } });
}
})();
