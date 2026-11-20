/* =====================================================================
   Gamepad flying (DualSense, DualShock, Xbox: any pad the browser maps to the "standard" layout).
   In flight only; menus stay mouse and keyboard. Works alongside the mouse and keyboard.
   Every button can be remapped on the Controller screen (G.save.padMap); below are the defaults.

     Left stick    pitch and roll (stick back = climb)       Right stick   swing the aim point / look
     R2            guns                                      L2            rockets
     R1 / L1       throttle up / down                        Cross (A)     nitro; drops you off the trapeze
     Circle (B)    barrel roll (toward the left stick)       Triangle (Y)  Immelmann
     Square (X)    Split-S                                   L3            flaps
     R3            hold to look back, tap for chase / cockpit   Create / View   landing gear
     D-pad         wingmen: up attack, right cover, left zeppelin, down form; down twice quickly sends them home
     Touchpad      camera, for photo objectives (DualSense)  Options / Menu    pause / resume
   ===================================================================== */
(() => {
const B = {cross:0, circle:1, square:2, triangle:3, l1:4, r1:5, l2:6, r2:7, create:8, options:9, l3:10, r3:11, up:12, down:13, left:14, right:15, touch:17};
const DZ = 0.14;
const dz = v => Math.abs(v) < DZ ? 0 : Math.sign(v)*((Math.abs(v) - DZ)/(1 - DZ));
const curve = v => Math.sign(v)*v*v*0.55 + v*0.45;   // gentle near the middle, full at the edge

/* Every remappable action, its default button, and how it's labelled on the Controller screen. */
const ACTIONS = [
  {id:'fire',    label:'Guns',                          def:B.r2},
  {id:'rockets', label:'Rockets',                       def:B.l2},
  {id:'thrUp',   label:'Throttle up',                   def:B.r1},
  {id:'thrDown', label:'Throttle down / brake',         def:B.l1},
  {id:'nitro',   label:'Nitro (and drop off the trapeze)', def:B.cross},
  {id:'roll',    label:'Barrel roll (toward the left stick)', def:B.circle},
  {id:'immel',   label:'Immelmann',                     def:B.triangle},
  {id:'splits',  label:'Split-S',                       def:B.square},
  {id:'flaps',   label:'Flaps',                         def:B.l3},
  {id:'gear',    label:'Landing gear',                  def:B.create},
  {id:'look',    label:'Look back (hold) / view (tap)', def:B.r3},
  {id:'photo',   label:'Camera (photo objectives)',     def:B.touch},
  {id:'view',    label:'Chase / cockpit view',          def:-1},
  {id:'attack',  label:'Wingmen: attack',               def:B.up},
  {id:'cover',   label:'Wingmen: cover me',             def:B.right},
  {id:'zep',     label:'Wingmen: the zeppelin',         def:B.left},
  {id:'form',    label:'Wingmen: form up (twice: home)', def:B.down},
  {id:'home',    label:'Wingmen: go home',              def:-1},
  {id:'pause',   label:'Pause / resume',                def:B.options}
];
const DEFAULTS = Object.fromEntries(ACTIONS.map(a => [a.id, a.def]));
const NAMES = {
  ps:['Cross', 'Circle', 'Square', 'Triangle', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right', 'PS', 'Touchpad'],
  xb:['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS click', 'RS click', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right', 'Guide', 'Share']
};

const Pad = G.pad = {
  index:-1, prev:[], hold:{}, r3T:0, lx:0, ly:0, rx:0, ry:0, active:false, lastUsed:-1e9, downT:0, name:'',
  ACTIONS, DEFAULTS,
  sens:() => G.save.padSens || 1,
  map(){ return Object.assign({}, DEFAULTS, G.save.padMap || {}); },
  btnName(i){ if (i == null || i < 0) return '—'; const set = /xbox|xinput|microsoft/i.test(this.name) ? NAMES.xb : NAMES.ps; return set[i] || 'Button ' + i; },

  pick(){
    const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    if (this.index >= 0 && list[this.index] && list[this.index].connected) return list[this.index];
    for (const p of list) if (p && p.connected && p.mapping === 'standard') { this.index = p.index; this.name = p.id; return p; }
    for (const p of list) if (p && p.connected) { this.index = p.index; this.name = p.id; return p; }
    this.index = -1; return null;
  },
  /* called every frame by the UI loop, before the game updates */
  poll(g, dt, now){
    if (this.capturing) return;   // the Controller screen is listening for a button
    const p = this.pick(); if (!p) { this.active = false; this.lx = this.ly = this.rx = this.ry = 0; return; }
    const M = this.map();
    const raw = i => { const b = p.buttons[i]; return !!b && (b.pressed || b.value > 0.4); };
    const btn = a => M[a] >= 0 && raw(M[a]);
    const press = a => M[a] >= 0 && raw(M[a]) && !this.prev[M[a]];
    const release = a => M[a] >= 0 && !raw(M[a]) && this.prev[M[a]];
    const ax = p.axes || [], swap = !!G.save.padSwap;
    const L = swap ? [2, 3] : [0, 1], Rr = swap ? [0, 1] : [2, 3];
    this.lx = dz(ax[L[0]] || 0); this.ly = dz(ax[L[1]] || 0); this.rx = dz(ax[Rr[0]] || 0); this.ry = dz(ax[Rr[1]] || 0);
    const used = this.lx || this.ly || this.rx || this.ry || p.buttons.some((b, i) => b && b.pressed && i !== 16);
    if (used) this.lastUsed = now;
    this.active = now - this.lastUsed < 4000;

    if (g && !g.done) {
      if (press('pause')) { if (g.paused) G.UI.resume(); else G.UI.pause(true); }
      if (!g.paused) {
        let dropped = false;
        if (g.mission.awaitDrop && (press('nitro') || press('fire'))) { G.audio.init(); g.mission.drop(); dropped = true; }
        // held controls are read by playerControl below
        this.hold = {fire:btn('fire'), rk:btn('rockets'), up:btn('thrUp'), down:btn('thrDown')};
        // look back: hold; a quick tap switches chase / cockpit
        if (press('look')) { this.r3T = now; g.lookBack = true; }
        if (release('look')) { g.lookBack = false; if (now - this.r3T < 250) g.key('KeyC', true), g.key('KeyC', false); }
        // aim point from the right stick, as the mouse would move it
        if (this.rx || this.ry) g.onMouse(curve(this.rx)*1100*dt*this.sens(), curve(this.ry)*850*dt*this.sens()*(G.save.padInvertAim ? -1 : 1));
        const tap = c => { g.key(c, true); g.key(c, false); };
        if (g.running) {
          if (press('nitro') && !dropped) tap('ShiftLeft');
          if (press('roll')) g.stunt(this.lx < -0.25 ? 'rollL' : 'rollR');
          if (press('immel')) g.stunt('immel');
          if (press('splits')) g.stunt('splits');
        }
        if (g.swapNear && press('fire')) tap('KeyY');   // stopped beside a parked aeroplane: the trigger climbs you across
        if (press('flaps')) tap('KeyF');
        if (press('gear')) tap('KeyG');
        if (press('view')) tap('KeyC');
        if (press('photo')) tap('KeyP');
        if (press('attack')) tap('Digit1');
        if (press('cover')) tap('Digit2');
        if (press('zep')) tap('Digit3');
        if (press('home')) tap('Digit5');
        if (press('form')) { if (M.home < 0 && now - this.downT < 450) tap('Digit5'); else tap('Digit4'); this.downT = now; }
      }
    }
    this.prev = p.buttons.map((b, i) => raw(i));
  },
  /* feel a hit: stronger for heavier hits; a no-op where the browser or pad has no rumble */
  rumble(strength = 0.5, ms = 120){
    if (!this.active || G.save.padRumble === false) return;
    const p = this.pick(), a = p && p.vibrationActuator;
    if (!a || !a.playEffect) return;
    try { a.playEffect('dual-rumble', {duration:ms, strongMagnitude:Math.min(1, strength), weakMagnitude:Math.min(1, strength*0.7)}).catch(() => {}); } catch (e) {}
  },

  /* ---------- the Controller screen: remap buttons, sticks and feel ---------- */
  open(from){
    this.from = from || (G.game && G.game.paused ? 'pause' : 'menu');
    G.UI.screen('controls'); this.renderScreen();
    if (!this.screenLoop) { const loop = () => { const el = document.getElementById('controls'); if (!el || el.hidden) { this.screenLoop = null; this.capturing = null; this.capturingKey = null; return; } this.screenTick(); this.screenLoop = requestAnimationFrame(loop); }; this.screenLoop = requestAnimationFrame(loop); }
  },
  close(){ this.capturing = null; this.capturingKey = null; if (G.keymap) G.keymap.renderHelp(); if (this.from === 'pause' && G.game && G.game.paused) G.UI.screen('pause'); else G.UI.menu(); },
  listen(id){ this.capturing = id; this.capPrev = null; this.renderScreen(); },
  clear(id){ this.setMap(id, -1); },
  reset(){ this.capturingKey = null; G.save.padMap = {}; G.save.padSwap = false; G.save.padSens = 1; G.save.padInvertAim = false; G.save.padRumble = true; G.persist(); this.capturing = null; this.renderScreen(); },
  setMap(id, b){
    const M = this.map();
    // a button does one job: whatever had it before takes this action's old button
    if (b >= 0) for (const a of ACTIONS) if (a.id !== id && M[a.id] === b) M[a.id] = M[id];
    M[id] = b;
    const diff = {}; for (const a of ACTIONS) if (M[a.id] !== DEFAULTS[a.id]) diff[a.id] = M[a.id];
    G.save.padMap = diff; G.persist(); this.capturing = null; this.renderScreen();
  },
  setOpt(k, v){ G.save[k] = v; G.persist(); this.renderScreen(); },
  screenTick(){
    const p = this.pick(), st = document.getElementById('padState');
    if (st) st.textContent = p ? `Connected: ${p.id.replace(/\(.*?\)/g, '').trim().slice(0, 60)}` : 'No controller found. Plug one in or pair it, then press any button.';
    if (!this.capturing || !p) return;
    const now = p.buttons.map(b => !!b && (b.pressed || b.value > 0.5));
    if (!this.capPrev) { this.capPrev = now; return; }   // ignore whatever was already held when listening started
    const i = now.findIndex((d, j) => d && !this.capPrev[j]);
    this.capPrev = now;
    if (i >= 0) { if (i === 16) return; this.setMap(this.capturing, i); }   // the PS / Guide button belongs to the system
  },
  tabTo(t){ this.tab = t; this.capturing = null; this.capturingKey = null; this.renderScreen(); },
  listenKey(id){ this.capturing = null; this.capturingKey = id; this.renderScreen(); },
  renderScreen(){
    const el = document.getElementById('padBody'); if (!el) return;
    const M = this.map(), S = G.save, esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
    if (!this.tab) this.tab = this.pick() ? 'pad' : 'keys';
    const tabs = `<div class="kicker">Settings</div><h2 class="deco" style="font-size:44px;margin:6px 0 8px">Controls</h2>
      <div class="pad-tabs"><button class="${this.tab === 'keys' ? 'on' : ''}" onclick="G.pad.tabTo('keys')">Keyboard</button><button class="${this.tab === 'pad' ? 'on' : ''}" onclick="G.pad.tabTo('pad')">Controller</button></div>`;
    if (this.tab === 'keys') {
      const KM = G.keymap;
      el.innerHTML = tabs + `<p class="pad-state">Mouse aims, left click fires the guns, right click fires rockets, and Esc pauses. Those stay put.</p>
        <div class="pad-grid">${KM.ACTIONS.map(a => { const cap = this.capturingKey === a.id;
          return `<div class="pad-row${cap ? ' cap' : ''}"><span>${esc(a.label)}</span><b>${cap ? 'Press a key…' : esc(KM.label(KM.key(a.id)))}</b><button class="btn ghost sm" onclick="G.pad.${cap ? 'listenKey(null)' : `listenKey('${a.id}')`}">${cap ? 'Cancel' : 'Change'}</button></div>`; }).join('')}</div>
        <p class="co-note">Giving a key to a new job swaps it with whatever had it. Esc cancels while a key is being chosen. Double-taps (barrel roll, snap turn) follow the roll and rudder keys.</p>
        <div class="row"><button class="btn ghost sm" onclick="G.keymap.reset(); G.pad.renderScreen()">Defaults</button><button class="btn" onclick="G.pad.close()">Done</button></div>`;
      return;
    }
    el.innerHTML = tabs + `
      <p class="pad-state" id="padState"></p>
      <div class="pad-grid">${ACTIONS.map(a => {
        const cap = this.capturing === a.id;
        return `<div class="pad-row${cap ? ' cap' : ''}"><span>${esc(a.label)}</span><b>${cap ? 'Press a button…' : esc(this.btnName(M[a.id]))}</b>
          <button class="btn ghost sm" onclick="G.pad.${cap ? 'listen(null)' : `listen('${a.id}')`}">${cap ? 'Cancel' : 'Change'}</button>${a.id === 'home' || a.id === 'view' || a.id === 'photo' ? `<button class="btn ghost sm" onclick="G.pad.clear('${a.id}')" title="Unbind">✕</button>` : ''}</div>`;
      }).join('')}</div>
      <div class="pad-opts">
        <label><span>Aim speed (right stick)</span><input type="range" min="0.4" max="2" step="0.05" value="${S.padSens || 1}" oninput="G.save.padSens = +this.value; G.persist()"></label>
        <label><input type="checkbox" ${S.padSwap ? 'checked' : ''} onchange="G.pad.setOpt('padSwap', this.checked)"> Swap sticks (right stick flies, left aims)</label>
        <label><input type="checkbox" ${S.invert ? 'checked' : ''} onchange="G.pad.setOpt('invert', this.checked)"> Invert pitch (the same setting as the mouse's)</label>
        <label><input type="checkbox" ${S.padInvertAim ? 'checked' : ''} onchange="G.pad.setOpt('padInvertAim', this.checked)"> Invert the aim stick's up and down</label>
        <label><input type="checkbox" ${S.padRumble !== false ? 'checked' : ''} onchange="G.pad.setOpt('padRumble', this.checked)"> Rumble</label>
      </div>
      <p class="co-note">Giving a button to a new job swaps it with whatever had it. The left stick (or the right, swapped) always flies, and the other always aims. With "go home" unbound, pressing form up twice quickly sends the wingmen home.</p>
      <div class="row"><button class="btn ghost sm" onclick="G.pad.reset()">Defaults</button><button class="btn" onclick="G.pad.close()">Done</button></div>`;
    this.screenTick();
  }
};

/* left stick flies the plane directly, the way the arrow keys and A/D do, but in proportion */
const GP = G.Game.prototype, pc0 = GP.playerControl;
GP.playerControl = function(dt){
  pc0.call(this, dt);
  const P = this.player; if (!P || !P.alive || !Pad.active || P.frozen) return;
  const h = Pad.hold;
  if (h.up && !P.engineDead) P.throttle = Math.min(1, P.throttle + dt*0.6);
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
