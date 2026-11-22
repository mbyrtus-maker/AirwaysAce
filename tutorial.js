/* =====================================================================
   Flight School: the tutorial.
   A run of short lessons over Halcyon. Whenever the pilot has something to read, the game pauses
   and a card sits in the middle of the screen until they press any key, click, or press a pad button.
   ===================================================================== */
(() => {
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const K = G.storyKit, STRIP = K.STRIP, base = G.MISSIONS.ambush;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));

/* ---------- the reading card ---------- */
const Card = G.card = {
  open:false, cb:null, t0:0, q:[],
  /* show({tag, title, text, keys:[[keyboard, pad, what]]}, then) */
  show(c, then){
    if (this.open) { this.q.push([c, then]); return; }
    const g = G.game, el = $('tutCard'); if (!el) { if (then) then(); return; }
    this.open = true; this.cb = then || null; this.t0 = performance.now(); this.wasPaused = g ? g.paused : false;
    if (g) { g.paused = true; g.cardPause = true; }
    if (G.audio && G.audio.ctx && G.audio.ctx.state === 'running') { this.muted = true; G.audio.ctx.suspend(); } else this.muted = false;
    const pad = Card.padOn();
    const rows = (c.keys || []).map(([kb, pd, what]) => `<div class="tcRow"><span class="tcKb">${kb ? kb.split(' + ').map(k => `<kbd>${esc(k)}</kbd>`).join(' + ') : ''}</span>${pad && pd ? `<span class="tcPd"><kbd>${esc(pd)}</kbd></span>` : (pad ? '<span class="tcPd"></span>' : '')}<span class="tcWhat">${esc(what)}</span></div>`).join('');
    el.innerHTML = `<div class="tc"><div class="tcTag">${esc(c.tag || 'Flight School')}</div><h2>${esc(c.title)}</h2>${(c.text || '').split('\n').map(p => `<p>${esc(p)}</p>`).join('')}
      ${rows ? `<div class="tcKeys${pad ? '' : ' kb'}">${pad ? '<div class="tcRow tcHead"><span class="tcKb">Keyboard &amp; mouse</span><span class="tcPd">Controller</span><span class="tcWhat"></span></div>' : ''}${rows}</div>` : ''}
      <div class="tcGo">${pad ? 'Press any key or button to continue' : 'Press any key or click to continue'}</div></div>`;
    el.hidden = false; el.classList.remove('tcReady'); setTimeout(() => el.classList.add('tcReady'), 550);
    if (document.pointerLockElement) document.exitPointerLock();
  },
  ready(){ return this.open && performance.now() - this.t0 > 550; },   // a key already held when the card opens doesn't skip it
  close(){
    if (!this.ready()) return false;
    const g = G.game, el = $('tutCard'); this.open = false; if (el) el.hidden = true;
    if (g) { g.cardPause = false; g.paused = this.wasPaused; }
    if (this.muted && G.audio && G.audio.ctx) G.audio.ctx.resume();
    const cb = this.cb; this.cb = null;
    if (this.q.length) { const [c, t] = this.q.shift(); this.show(c, t); }
    else if (g && !g.paused && !g.done) { const v = $('view'); try { const p = v && v.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    if (cb) cb();
    return true;
  },
  reset(){ this.open = false; this.q = []; this.cb = null; const el = $('tutCard'); if (el) el.hidden = true; },
  padOn(){ try { return !!(G.pad && (G.pad.active || [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(p => p && p.connected))); } catch (e) { return false; } }
};
if (typeof addEventListener === 'function') {
  // capture phase, so the press that closes the card never reaches the game
  const swallow = e => { if (!Card.open) return; e.preventDefault(); e.stopImmediatePropagation(); };
  addEventListener('keydown', e => { if (!Card.open) return; swallow(e); if (!e.repeat) Card.close(); }, true);
  addEventListener('keyup', swallow, true);
  addEventListener('mousedown', e => { if (!Card.open) return; swallow(e); Card.close(); }, true);
  for (const t of ['mouseup', 'click', 'pointerdown', 'pointerup', 'contextmenu']) addEventListener(t, swallow, true);
}

/* ---------- labels for the keys as they're bound now ---------- */
const kb = id => { try { return G.keymap.label(G.keymap.key(id)); } catch (e) { return id; } };
const pb = a => { try { const M = G.pad.map(); return M[a] >= 0 ? G.pad.btnName(M[a]) : ''; } catch (e) { return ''; } };

/* ---------- the mission ---------- */
const flat = (a, b) => ({x:a, z:b});
G.MISSIONS.tutorial = Object.assign(Object.create(base), {
  id:'tutorial', tutorial:true, title:'Flight School', place:'Over Halcyon Island, Sierra Free State',
  brief:'Before Thorne trusts you with her cargo, Dutch wants to see you fly. A dozen short lessons over Halcyon: dropping off the hook, steering, stunts, guns, docking, rockets and a landing. The game stops to explain each one.',
  sides:[{id:'lessons', text:'Finish every lesson'}],
  pay:{success:250, perfect:0, kill:0},
  worldOpts:() => ({seed:1931, flats:[{x:K.CITY.x, z:K.CITY.z, r:K.CITY.r}, {x:STRIP.x, z:STRIP.z, r:STRIP.r}]}),

  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.step = -1; this.done = 0; this.ended = false; this.rings = []; this.T = [];
    Card.reset(); G.HUD.clue(null);
    this.launch(g, `Morning, ${G.save.callsign || 'cadet'}. Dutch here. I'll be your instructor today. Read the cards, then show me what you've got.`, {banner:'Flight School'});
    G.HUD.banner(null);
    // the Saint-Remy strip for the landing lesson
    const w = g.world, sh = Math.max(w.raw(STRIP.x, STRIP.z), 14);
    const strip = G.buildAirstrip(); strip.position.set(STRIP.x, sh, STRIP.z); strip.rotation.y = STRIP.yaw; g.scene.add(strip);
    const ud = strip.userData; this.stripY = sh; this.stripLen = ud.len;
    g.runways.push({pos:new V3(STRIP.x, sh, STRIP.z), yaw:STRIP.yaw, hw:ud.wid/2 + 10, hl:ud.len/2 + 22});
    const rot = v => v.clone().applyAxisAngle(new V3(0, 1, 0), STRIP.yaw).add(new V3(STRIP.x, sh, STRIP.z));
    this.apron = rot(ud.apron); g.runways.push({pos:this.apron, yaw:STRIP.yaw, hw:26, hl:34});   // the café's apron: you can roll onto it
    const bar = rot(new V3(ud.apron.x + 44, 0, ud.apron.z + 10)); w.addBlocker({x:bar.x, z:bar.z, hw:12, hd:12, top:sh + 13});
    this.lessons = this.plan(g);
    setTimeout(() => { if (G.game === g && !g.done) this.next(); }, 600);
  },
  hint(){ return ''; },

  /* the lessons, in order. Each: card, start(g), check(g, dt) -> true when passed, obj(g) -> objective text */
  plan(g){
    const P = () => g.player, me = this;
    const L = [
      {card:{title:'Welcome to Flight School', text:'You\'re hanging from the Lucky Margaret\'s trapeze, the hook that carries her fighters.\nWhenever there\'s something to read, the game stops and a card like this one waits for you. Take your time.',
        keys:[[kb('KeyH'), '', 'Show every control at any time'], ['Esc', pb('pause'), 'Pause, sound and settings']]}},
      {card:{title:'Drop off the hook', text:'Let go of the trapeze and you fall clear of the ship. The engine is already turning over, so you\'ll be flying in a second.',
        keys:[['Left click', pb('nitro'), 'Drop off the trapeze'], [kb('Space'), '', 'Also drops you']]},
        obj:() => 'Drop from the trapeze', check:() => me.phase >= 1},
      {card:{title:'Point and fly', text:'The small circle is where you are aiming. Move the mouse and the aeroplane turns to follow it, banking on its own.\nFly through the four rings. The yellow marker shows the next one.',
        keys:[['Mouse', 'Left stick', 'Aim: the plane follows'], [`${kb('KeyA')} / ${kb('KeyD')}`, '', 'Roll by hand'], [`${kb('KeyQ')} / ${kb('KeyE')}`, '', 'Rudder: small flat corrections']]},
        start:g => me.ringsAhead(g, 4, [0, 0.25, 0.5, 0.25], 0),
        obj:() => `Fly through the rings · ${me.ringsDone()}/${me.rings.length}`, check:() => me.ringsLeft() === 0},
      {card:{title:'Throttle and climbing', text:'More throttle means more speed, and speed is what lets you climb. Open her up and pull up for the high ring.\nThe gauge on the left of the screen shows your throttle; the number under it is your speed.',
        keys:[[kb('KeyW'), pb('throttle') || 'R1', 'More throttle'], [kb('KeyS'), 'L1', 'Less throttle'], [`${kb('ArrowDown')} / ${kb('ArrowUp')}`, '', 'Pull up / push down by hand']]},
        start:g => me.ringsAhead(g, 1, [0], 260),
        obj:() => 'Full throttle and climb through the high ring', check:() => me.ringsLeft() === 0},
      {card:{title:'Stunts', text:'Every stunt is a canned manoeuvre: it always finishes level, and the barrel roll throws off enemy aim.\nDo one of each: a barrel roll, an Immelmann (half loop up, then roll upright: turns you around and climbs) and a snap turn (a hard 180 without the climb).',
        keys:[[`Double-tap ${kb('KeyA')} / ${kb('KeyD')}`, pb('roll'), 'Barrel roll'], [`${kb('KeyR')} or double-tap ${kb('ArrowDown')}`, pb('immel'), 'Immelmann'], [`Double-tap ${kb('KeyQ')} / ${kb('KeyE')}`, pb('immel') ? `${pb('immel')} + stick to a side` : '', 'Snap turn'], [`${kb('KeyZ')} or double-tap ${kb('ArrowUp')}`, pb('splits'), 'Split-S (needs height): half roll, then dive out']]},
        start:() => { me.stunts = {}; },
        obj:() => `Stunts: ${['roll', 'immel', 'snap'].map(k => (me.stunts[k] ? '✓ ' : '') + {roll:'Barrel roll', immel:'Immelmann', snap:'Snap turn'}[k]).join(' · ')}`,
        check:() => me.stunts.roll && me.stunts.immel && me.stunts.snap},
      {card:{title:'Nitro', text:'A bottle of nitrous gives you a few seconds of real speed: for catching a runner or shaking one off your tail. You carry a few shots; they refill when you dock.',
        keys:[[kb('ShiftLeft'), pb('nitro'), 'Nitro']]},
        skip:() => !(P().nitroLeft > 0),
        obj:() => 'Light the nitro', check:() => P().nitro > 0},
      {card:{title:'Guns', text:'Your guns fire where the aim circle points. A moving target needs a lead: fire at the small pipper drawn ahead of it, not at the target itself.\nShoot down the four practice balloons. Short bursts keep the guns from wasting ammunition.',
        keys:[['Left click', pb('fire'), 'Guns'], [kb('KeyC'), pb('view'), 'Chase / cockpit view']]},
        start:g => me.balloons(g),
        obj:() => `Shoot the practice balloons · ${me.T.filter(t => !t.alive).length}/${me.T.length}`, check:() => me.T.every(t => !t.alive)},
      {card:{title:'A live one', text:'Dutch has talked one of the deck boys into playing the bandit in an old Vandal. He\'s slow and he can\'t shoot straight, but he will try.\nGet on his tail, lead him, and shoot him down. If you get shot down, the Margaret sends up a spare.',
        keys:[[`Double-tap ${kb('KeyA')} / ${kb('KeyD')}`, pb('roll'), 'Barrel roll out of his sights'], [kb('KeyV'), pb('look'), 'Look back (hold)']]},
        start:g => me.bandit(g),
        obj:() => 'Shoot down the practice bandit', check:() => me.foe && !me.foe.alive},
      {id:'dock', card:{title:'Dock to rearm', text:'Out of ammunition or shot full of holes? Fly back to the Margaret. Slow to under 105 mph, line up alongside her, and fly through either docking ring. The hook catches you, the crew rearms and patches you, then drops you again.\nFlaps help you go slow without stalling.',
        keys:[[kb('KeyS'), 'L1', 'Slow down'], [kb('KeyF'), pb('flaps'), 'Flaps (slower without stalling)']]},
        start:() => { me.dockT = 0; },
        obj:() => `Dock with the Lucky Margaret: under 105 mph, through a side ring${me.dockT > 150 ? ' (or carry on: Dutch will let it go in a moment)' : ''}`,
        check:(g, dt) => { me.dockT += dt; if (g.docked) me.wasDocked = true; return (me.wasDocked && !g.docked) || me.dockT > 200; }},
      {id:'rockets', card:{title:'Rockets', text:'Rockets hit hard but fly dead straight with no lead. Dive at a ground target, put the aim circle on it, and let go a pair. Pull out in good time.\nThere\'s a supply shed out by the Saint-Remy strip. Knock it flat.',
        keys:[[`Right click / ${kb('Space')}`, pb('rockets'), 'Rockets']]},
        skip:() => !(P().rockets > 0),
        start:g => me.shed(g),
        obj:() => 'Rocket the shed by the Saint-Remy strip', check:() => me.shedT && !me.shedT.alive},
      {id:'land', card:{title:'Bring her down', text:'Last lesson: a landing on the Saint-Remy strip. Come in long and low along the runway, throttle back, lower the gear and the flaps, and let her settle onto the wheels. Too steep or too fast and she\'ll bounce or break.\nOnce you\'re down, taxi to the Café Lafayette at the side of the strip and stop on its apron. Steer on the ground with the mouse, use a touch of throttle to roll, and brake to stop. Odile is buying the first round.',
        keys:[[kb('KeyG'), pb('gear'), 'Landing gear (if your aeroplane has retractable gear)'], [kb('KeyF'), pb('flaps'), 'Flaps'], [kb('KeyS'), 'L1', 'Throttle back; on the ground, brakes'], ['Mouse', 'Left stick', 'Steer on the ground'], [kb('KeyB'), '', 'Wheel brakes']]},
        start:() => { me.landed = false; },
        obj:() => { const P_ = P(); if (!P_.onGround) return me.landed ? 'Back on the ground, then taxi to the Café Lafayette' : 'Land on the Saint-Remy strip';
          const d = Math.hypot(P_.pos.x - me.apron.x, P_.pos.z - me.apron.z); return d < 26 ? 'Brake to a stop on the café apron' : `Taxi to the Café Lafayette · ${Math.round(d)} m`; },
        check:() => { const P_ = P(); if (!P_.onGround) return false;
          if (!me.landed) { me.landed = true; G.HUD.toast('Touchdown! Now taxi to the café'); G.HUD.radio('Dutch', 'Not bad, cadet. Roll her over to Odile\'s bar and shut her down. First round\'s on the house.'); }
          return Math.hypot(P_.pos.x - me.apron.x, P_.pos.z - me.apron.z) < 26 && P_.speed < 3; }},
      {card:{tag:'Flight School · graduated', title:'Wings earned', text:'That\'s everything Dutch can teach you over a cup of coffee. The rest you learn with the Black Lantern shooting back.\nFrom the menu, the Story is where the Lucky Thirteen\'s war starts, and Open skies lets you take jobs and roam.'},
        check:() => true, finish:true}
    ];
    return L;
  },

  next(){
    const g = this.g; if (this.ended || g.done || G.game !== g) return;
    this.step++; const S = this.lessons[this.step]; if (!S) return;
    if (S.skip && S.skip()) { this.done++; this.next(); return; }
    const total = this.lessons.length;
    const c = Object.assign({tag:`Flight School · lesson ${this.step + 1} of ${total}`}, S.card);
    this.waiting = true;
    Card.show(c, () => {
      this.waiting = false; if (G.game !== g || g.done) return;
      if (S.start) S.start(g);
      if (S.finish) { this.finish(); return; }
      if (S.obj) G.HUD.objective(S.obj(g));
      if (!S.check) { this.done++; this.next(); }
    });
  },

  update(g, dt){
    this.pt += dt; const S = this.lessons && this.lessons[this.step];
    this.ringTick(g);
    g.markers = [];
    if (S && !this.waiting && S.check) {
      if (S.obj) G.HUD.objective(S.obj(g));
      this.markFor(g, S);
      if (g.player.alive && S.check(g, dt)) {
        this.done++; this.clearRings(g);
        if (G.audio && G.audio.ui) try { G.audio.ui('ok'); } catch (e) {}
        G.HUD.toast('Lesson passed');
        S.check = null;
        setTimeout(() => this.next(), 900);
      }
    }
    G.HUD.sides(this.sideState(g));
  },
  markFor(g, S){
    const r = this.rings.find(r => !r.hit); if (r) { g.markers.push({pos:r.pos, label:'RING', col:'#f2c14e', course:true}); return; }
    if (S.id === 'dock' && this.ship.alive && !g.docked) g.markers.push({pos:this.ship.pos.clone().add(new V3(0, -30, 0)), label:'LUCKY MARGARET · DOCK', col:'#9ed8a0'});
    if (S.id === 'rockets' && this.shedT && this.shedT.alive) g.markers.push({pos:this.shedT.pos, label:'SUPPLY SHED', col:'#c8432f'});
    if (S.id === 'land') {
      const P = g.player;
      if (!P.onGround && !this.landed) g.markers.push({pos:new V3(STRIP.x, this.stripY + 25, STRIP.z), label:'SAINT-REMY STRIP · LAND', col:'#f2c14e'});
      else { const d = Math.hypot(P.pos.x - this.apron.x, P.pos.z - this.apron.z); g.markers.push({pos:this.apron.clone().setY(this.apron.y + 6), label:d < 26 ? (P.speed < 3 ? 'HOLD' : 'STOP HERE · BRAKE') : 'CAFÉ LAFAYETTE · TAXI HERE', col:'#f2c14e'}); }
    }
  },
  onStunt(g, P, kind){ if (this.stunts) this.stunts[kind] = true; },

  /* rings spaced out along the pilot's heading; bend: sideways drift per ring, rise: metres up for the last */
  ringsAhead(g, n, bend, rise){
    const P = g.player, f = P.fwd.clone().setY(0).normalize(), side = new V3(f.z, 0, -f.x);
    let at = P.pos.clone(); at.y = Math.max(at.y, g.world.height(at.x, at.z) + 220);
    for (let i = 0; i < n; i++) {
      const pos = at.clone().addScaledVector(f, 420*(i + 1)).addScaledVector(side, (bend[i] || 0)*260); pos.y += rise*(i + 1)/n;
      pos.y = Math.max(pos.y, g.world.height(pos.x, pos.z) + 120);
      const m = G.buildBoostRing(16); m.position.copy(pos); m.rotation.y = Math.atan2(f.x, f.z); g.scene.add(m);
      this.rings.push({pos, m, R:16, hit:false});
    }
  },
  ringTick(g){
    const P = g.player; if (!P || !P.alive) return;
    const r = this.rings.find(r => !r.hit); if (!r) return;
    if (P.pos.distanceTo(r.pos) < r.R + 3) { r.hit = true; r.m.visible = false; if (g.audio && g.audio.ring) try { g.audio.ring(); } catch (e) {} G.HUD.toast('Ring'); }
  },
  ringsLeft(){ return this.rings.filter(r => !r.hit).length; },
  ringsDone(){ return this.rings.filter(r => r.hit).length; },
  clearRings(g){ for (const r of this.rings) if (r.m.parent) r.m.parent.remove(r.m); this.rings = []; },

  /* four striped balloons, slowly drifting */
  balloons(g){
    const P = g.player, f = P.fwd.clone().setY(0).normalize(), side = new V3(f.z, 0, -f.x);
    const c = P.pos.clone().addScaledVector(f, 700); c.y = Math.max(P.pos.y, g.world.height(c.x, c.z) + 200);
    this.T = [];
    for (let i = 0; i < 4; i++) {
      const grp = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(5, 14, 10), G.mat(i % 2 ? 0xc8432f : 0xefe3c8, {roughness:0.7})); b.scale.y = 1.25; grp.add(b);
      const band = new THREE.Mesh(new THREE.TorusGeometry(5.05, 0.5, 6, 18), G.mat(0xd9a441, {roughness:0.6})); band.rotation.x = Math.PI/2; grp.add(band);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 4), G.mat(0x2a2a2a)); rope.position.y = -10; grp.add(rope);
      const pos = c.clone().addScaledVector(side, (i - 1.5)*140).add(new V3(0, (i % 2)*45, (i - 1.5)*30));
      grp.position.copy(pos); g.scene.add(grp);
      const t = g.addTarget({kind:'balloon', label:'PRACTICE BALLOON', pos, r:7, hp:40, group:grp, team:1});
      this.T.push(t);
    }
  },
  bandit(g){
    const P = g.player, f = P.fwd.clone().setY(0).normalize();
    const pos = P.pos.clone().addScaledVector(f, 1300); pos.y = Math.max(P.pos.y, g.world.height(pos.x, pos.z) + 300);
    const q = new Q().setFromUnitVectors(new V3(0, 0, 1), P.pos.clone().sub(pos).setY(0).normalize());
    const L = G.stockLoadout('vandal'); L.paint = [0xd9a441, 0x2a2a2a, 0xefe3c8];
    this.foe = g.addPlane({loadout:L, team:1, name:'Deck boy Eddie', callsign:'Eddie', pos, q, speed:80, ai:{role:'fighter', skill:0.15}});
    G.HUD.radio('Eddie', 'Ready when you are, sir! Go easy on her, she\'s the captain\'s spare.');
  },
  shed(g){
    const sx = STRIP.x + Math.cos(STRIP.yaw)*120, sz = STRIP.z - Math.sin(STRIP.yaw)*120, y = Math.max(g.world.raw(sx, sz), this.stripY);
    const grp = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 9), G.mat(0x7a5a3a, {roughness:0.9})); box.position.y = 3.5; grp.add(box);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 12.4, 3, 1), G.mat(0x4a2f22, {roughness:0.9})); roof.rotation.z = Math.PI/2; roof.position.y = 8.2; grp.add(roof);
    grp.position.set(sx, y, sz); g.scene.add(grp);
    this.shedT = g.addTarget({kind:'shed', label:'SUPPLY SHED', pos:new V3(sx, y + 4, sz), r:9, hp:160, group:grp, team:1});
  },
  onTargetDown(g, t){ if (t.kind === 'balloon') G.HUD.toast(`Balloon down · ${this.T.filter(x => !x.alive).length}/${this.T.length}`); },
  onKill(g, plane){ if (plane === this.foe) G.HUD.radio('Eddie', 'I\'m hit! Hitting the silk, sir!'); },
  onShipDown(g){ g.end(this.result(g, 'fail', 'Somehow you lost the Margaret during a training flight. Thorne would like a word.')); },

  /* shot down or crashed: a spare comes up from the Margaret and the lesson carries on */
  playerDown(g){
    if (this.respawnT || this.ended) return;
    G.HUD.radio('Dutch', 'Hit the silk, cadet! We\'re sending up a spare. No charge, this time.');
    G.HUD.banner('Shot down', 'A spare is on its way up from the Margaret');
    this.respawnT = setTimeout(() => { this.respawnT = null; if (G.game === g && !g.done) { G.HUD.banner(null); this.respawn(g); } }, 4000);
  },
  respawn(g){
    const was = g.player, ship = this.ship; if (!ship || !ship.alive) return;
    const L = Object.assign({}, was ? was.L : G.save.load, {mods:(G.save.mods || []).slice()});
    const pos = ship.worldPoint(new V3(0, -70, -90), new V3()), q = ship.q.clone();
    const np = g.addPlane({loadout:L, team:0, name:was ? was.name : G.save.callsign, callsign:was ? was.callsign : G.save.callsign, pos, q, speed:62});
    np.vel.copy(new V3(0, 0, 1).applyQuaternion(q)).multiplyScalar(62); np.throttle = 0.9;
    g.cine = null; g.swapPlayer(np, {keepOld:false}); np.grace = 4;
    const S = this.lessons[this.step]; if (S && S.start && this.rings.length) { this.clearRings(g); S.start(g); }   // fresh rings ahead of the new plane
  },

  sideState(g){
    const n = this.lessons ? this.lessons.length - 1 : 1, d = Math.min(this.done, n);
    return [{text:this.sides[0].text, st:d >= n ? 'ok' : 'live', val:`${d}/${n}`}];
  },
  finish(){
    if (this.ended) return; this.ended = true; const g = this.g;
    g.end(this.result(g, 'success'));
  },
  result(g, kind, note){
    const first = !G.save.schooled; if (kind !== 'fail') { G.save.schooled = true; G.persist(); }
    const cash = kind === 'fail' ? 0 : first ? this.pay.success : 0;
    const lines = kind === 'fail' ? {mood:'angry', say:note || 'That went sideways.', then:'Dutch says we\'ll try again after lunch.'}
      : {mood:'pleased', say:'Dutch says you\'ll do. From him that\'s practically a medal.', then:first ? 'Thorne slips you $250 for fuel and a decent dinner in Port Halcyon.' : 'A good refresher. No pay for the second time round, sugar.'};
    return Object.assign({kind, cash, kills:g.kills, shipPct:Math.round(this.ship.hp/this.ship.hpMax*100), sides:this.sideState(g)}, lines);
  }
});
})();
