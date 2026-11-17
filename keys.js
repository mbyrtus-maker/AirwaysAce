/* =====================================================================
   Keyboard remapping. The game listens for each action's default key (its "canonical" code); this file sits between
   the browser and the game and turns whatever key the player chose into that code. Esc and the mouse stay fixed.
   Bindings live in G.save.keyMap as {canonical code: chosen code}, changes from the defaults only.
   ===================================================================== */
(() => {
const ACTIONS = [
  {id:'KeyW', label:'Throttle up'}, {id:'KeyS', label:'Throttle down'},
  {id:'KeyA', label:'Roll left (double-tap: barrel roll)'}, {id:'KeyD', label:'Roll right (double-tap: barrel roll)'},
  {id:'ArrowDown', label:'Pull up'}, {id:'ArrowUp', label:'Push down'},
  {id:'KeyQ', label:'Rudder left (double-tap: snap turn)'}, {id:'KeyE', label:'Rudder right (double-tap: snap turn)'},
  {id:'Space', label:'Rockets (and drop off the trapeze)'}, {id:'ShiftLeft', label:'Nitro'}, {id:'KeyB', label:'Wheel brakes'},
  {id:'KeyR', label:'Immelmann'}, {id:'KeyZ', label:'Split-S'},
  {id:'KeyF', label:'Flaps'}, {id:'KeyG', label:'Landing gear'},
  {id:'KeyC', label:'Chase / cockpit view'}, {id:'KeyV', label:'Look back (hold)'},
  {id:'Digit1', label:'Wingmen: attack'}, {id:'Digit2', label:'Wingmen: cover me'}, {id:'Digit3', label:'Wingmen: the zeppelin'},
  {id:'Digit4', label:'Wingmen: form up'}, {id:'Digit5', label:'Wingmen: go home'},
  {id:'KeyM', label:'Sound on / off'}, {id:'KeyH', label:'Flight help'}
];
const CANON = new Set(ACTIONS.map(a => a.id));
const ALIAS = {ShiftRight:'ShiftLeft'};   // either Shift is nitro until nitro is moved
const FIXED = new Set(['Escape', 'MetaLeft', 'MetaRight', 'ContextMenu', 'OSLeft', 'OSRight']);

const label = c => {
  if (!c) return '—';
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit\d$/.test(c)) return c.slice(5);
  if (/^Numpad/.test(c)) return 'Num ' + c.slice(6);
  return {ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→', ShiftLeft:'Left Shift', ShiftRight:'Right Shift', ControlLeft:'Left Ctrl', ControlRight:'Right Ctrl',
    AltLeft:'Left Alt', AltRight:'Right Alt', Space:'Space', Tab:'Tab', Enter:'Enter', Backspace:'Backspace', CapsLock:'Caps Lock', Semicolon:';', Quote:'\'',
    Comma:',', Period:'.', Slash:'/', Backslash:'\\', BracketLeft:'[', BracketRight:']', Minus:'-', Equal:'=', Backquote:'`'}[c] || c;
};

const KM = G.keymap = {
  ACTIONS, label,
  binds(){ const b = {}; for (const a of ACTIONS) b[a.id] = a.id; return Object.assign(b, G.save.keyMap || {}); },
  /* the key the browser saw -> the code the game understands (null: this key does nothing now) */
  tr(code){
    const B = this.binds();
    for (const [canon, phys] of Object.entries(B)) if (phys === code) return canon;
    const a = ALIAS[code];
    if (a) return B[a] === a ? a : null;
    if (CANON.has(code)) return null;   // its job moved to another key, and nothing was given to this one
    return code;
  },
  key(id){ return this.binds()[id]; },
  set(id, code){
    if (FIXED.has(code) || !CANON.has(id)) return;
    const B = this.binds();
    for (const a of ACTIONS) if (a.id !== id && B[a.id] === code) B[a.id] = B[id];   // swap with whatever had it
    B[id] = code;
    const diff = {}; for (const a of ACTIONS) if (B[a.id] !== a.id) diff[a.id] = B[a.id];
    G.save.keyMap = diff; G.persist(); this.renderHelp();
  },
  reset(){ G.save.keyMap = {}; G.persist(); this.renderHelp(); },

  /* the in-flight help card (H) shows the keys as they're bound now */
  renderHelp(){
    if (typeof document === 'undefined') return;
    const el = document.getElementById('hHelp'); const box = el && el.querySelector && el.querySelector('.controls'); if (!box) return;
    const k = id => label(this.key(id)), two = (a, b) => `${k(a)} / ${k(b)}`;
    const rows = [
      ['Mouse', 'Aim (the plane follows)'], ['Left click', 'Guns'], [`Right click / ${k('Space')}`, 'Rockets'],
      [two('KeyW', 'KeyS'), 'Throttle'], [two('KeyA', 'KeyD'), 'Roll'], [two('KeyQ', 'KeyE'), 'Rudder'], [two('ArrowUp', 'ArrowDown'), 'Push / pull'],
      [`Double-tap ${two('KeyA', 'KeyD')}`, 'Barrel roll (dodges fire)'], [two('KeyR', 'KeyZ'), 'Immelmann / Split-S'],
      [k('KeyF'), 'Flaps (land, dock, skyhook)'], [k('KeyG'), 'Landing gear (retractable planes)'], [`Double-tap ${two('KeyQ', 'KeyE')}`, 'Snap turn'],
      [['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].map(k).join(' '), 'Wingmen: attack, cover, zeppelin, form, go home'],
      [k('ShiftLeft'), 'Nitro'], [k('KeyC'), 'Chase / cockpit'], [k('KeyV'), 'Look back'], [k('KeyM'), 'Sound'], [k('KeyH'), 'This help'], ['Esc', 'Pause']
    ];
    const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;'}[c]));
    box.innerHTML = rows.map(([a, b]) => `<kbd>${esc(a)}</kbd><span>${esc(b)}</span>`).join('');
  }
};

/* while the Controls screen is listening for a key, the next key press is the answer and goes no further */
if (typeof addEventListener === 'function') addEventListener('keydown', e => {
  const P = G.pad; if (!P || !P.capturingKey) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.code === 'Escape') { P.capturingKey = null; P.renderScreen(); return; }
  if (FIXED.has(e.code)) return;
  KM.set(P.capturingKey, e.code); P.capturingKey = null; P.renderScreen();
}, true);
})();
