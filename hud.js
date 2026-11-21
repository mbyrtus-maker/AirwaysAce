(function(){
'use strict';
/* Flight HUD: DOM gauges plus a 2D overlay canvas for reticles, markers and the lead pipper. */
const G = window.G, V3 = THREE.Vector3;
const $ = id => document.getElementById(id);
const tA = new V3(), tB = new V3(), tC = new V3();
const YD = 1/0.9144, FT = 3.28084;

const H = G.HUD = {
  init(){
    this.ov = $('ov'); this.cx = this.ov.getContext('2d'); this.domT = 0; this.hit = 0; this.lines = [];
    addEventListener('resize', () => this.size()); this.size();
  },
  size(){ const d = Math.min(2, devicePixelRatio || 1); this.ov.width = innerWidth*d; this.ov.height = innerHeight*d; this.dpr = d; },
  show(on){ $('hud').hidden = !on; this.ov.hidden = !on; if (!on) { $('hRadio').innerHTML = ''; $('hFeed').innerHTML = ''; } },
  radio(who, text){
    const el = document.createElement('div'); el.className = 'line'; el.innerHTML = `<b>${esc(who)}</b>${esc(text)}`;
    const box = $('hRadio'); box.appendChild(el); while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 900); }, 7500);
  },
  feed(text, mine){
    const el = document.createElement('div'); el.className = 'kf' + (mine ? ' me' : ''); el.textContent = text; const box = $('hFeed');
    box.appendChild(el); while (box.children.length > 5) box.removeChild(box.firstChild); setTimeout(() => el.remove(), 6000);
  },
  banner(title, sub){ const b = $('hBanner'); if (!title) { b.hidden = true; return; } b.hidden = false; b.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`; },
  objective(t){ $('hGoal').textContent = t; },
  sides(list){
    const k = JSON.stringify(list); if (k === this.sk) return; this.sk = k;
    $('hSides').innerHTML = list.map(s => `<li data-st="${s.st}"${s.secret ? ' class="sec"' : ''}><span class="st"></span><span>${s.secret ? 'Secret · ' : ''}${esc(s.text)}</span><b>${esc(s.val)}</b></li>`).join('');
  },
  /* the camera: a white flash over the screen when the shutter goes */
  shutter(){ const el = $('hFlash'); if (!el) return; el.style.transition = 'none'; el.style.opacity = '0.85'; void el.offsetWidth; el.style.transition = 'opacity .45s'; el.style.opacity = '0'; },
  /* undercover episodes: how far the Brethren still trust you (null hides the meter) */
  cover(v, note){
    const el = $('hCover'); if (!el) return;
    if (v == null) { el.hidden = true; this.cv = null; return; }
    const k = Math.round(v) + '|' + (note || ''); if (k === this.cv) return; this.cv = k; el.hidden = false;
    el.innerHTML = `<span>Cover</span><i><b style="width:${Math.max(0, Math.min(100, v))}%" class="${v < 25 ? 'lo' : v < 50 ? 'mid' : ''}"></b></i><em>${Math.round(v)}%</em>${note ? `<small>${esc(note)}</small>` : ''}`;
  },
  wing(g){
    const el = document.getElementById('hWing'); const W = g.wingmen || [];
    if (!W.length) { el.hidden = true; return; } el.hidden = false;
    el.innerHTML = `<div class="wt">Wingmen <span>${G.ORDER_NAMES[W[0].order]}</span></div>` + W.map(pl => `<div class="wr ${pl.p.alive && !pl.p.docked ? '' : 'down'}" data-id="${pl.wing.id}"><b>${G.esc(pl.wing.short)}</b><i class="bar"><i></i></i><em>${!pl.p.alive ? 'chute' : pl.p.docked ? 'aboard' : pl.order === 'rtb' ? 'heading home' : ''}</em></div>`).join('') +
      `<div class="wk"><kbd>1</kbd> attack <kbd>2</kbd> cover <kbd>3</kbd> zeppelin <kbd>4</kbd> form <kbd>5</kbd> home</div>`;
  },
  toast(t){ const el = $('hToast'); el.textContent = t; el.classList.add('on'); clearTimeout(this.tt); this.tt = setTimeout(() => el.classList.remove('on'), 1400); },
  hitMark(){ this.hit = 0.12; },

  update(g, dt){
    this.domT -= dt; this.hit = Math.max(0, this.hit - dt);
    const P = g.player; if (!P) return;
    if (this.domT <= 0) { this.domT = 0.1; this.dom(g, P); }
    this.draw(g, P);
  },
  dom(g, P){
    $('hSpd').textContent = Math.round(P.speed/G.MPH); $('hAlt').textContent = Math.round(P.pos.y*FT).toLocaleString();
    $('hThr').style.width = Math.round(P.throttle*100) + '%'; $('hThrV').textContent = Math.round(P.throttle*100) + '%';
    const gearTxt = !P.retract ? '' : P.gearT >= 1 ? '<b class="gup">GEAR UP</b> · ' : P.gearT <= 0 ? '<b class="gdn">GEAR DOWN</b> · ' : '<b class="gup">GEAR ' + (P.gearUp ? '▲' : '▼') + '</b> · ';
    $('hLoad').innerHTML = gearTxt + (P.flaps ? `<b class="flaps">FLAPS DOWN</b> · stall ${Math.round(P.stallSpeed()/G.MPH)} · max ${Math.round(P.flapMax()/G.MPH)} mph · sink ${Math.round(-P.vel.y*196.85)} ft/min` : Math.round(P.st.payload*100) + '% load · agility ' + Math.round(P.st.agilityMul*100) + '%');
    const gh = P.pos.y - Math.max(g.world.height(P.pos.x, P.pos.z, true), 0.4);
    const nearStrip = (g.runways || []).some(r => Math.hypot(r.pos.x - P.pos.x, r.pos.z - P.pos.z) < 1600);
    const impact = P.vel.y < -1 ? gh/-P.vel.y : 99, pull = !(g.mission && g.mission.lowFlying) && !nearStrip && gh < 250 && impact < 3.5;
    const warn = P.wingGone >= 0 && P.alive ? 'WING GONE · SHE\'S GOING IN' : P.creak > 0 && P.alive ? 'WING FAILING · EASE OFF THE STICK' : P.engineDead && !P.onGround ? (P.seized ? 'ENGINE SEIZED · GLIDE' : 'ENGINE OUT · GLIDE') : P.retract && P.gearT > 0 && !P.onGround && P.alive && g.running && nearStrip && gh < 200 && P.fwd.y < 0.05 && P.speed < P.st.top*0.8 ? 'GEAR UP · PRESS G' : P.onGround || P.flaps ? '' : !P.alive || P.frozen || !g.running ? (g.docked ? 'DOCKED · REPAIRING' : '') : P.choke > 0 ? 'ENGINE CHOKED' : pull ? 'PULL UP' : P.speed < P.st.stall*1.05 ? 'STALL' : !P.hasAmmo() && P.guns.length ? 'OUT OF AMMO' : '';
    const w = $('hWarn'); w.textContent = warn; w.hidden = !warn;
    // armor zones
    const zone = (id, v, m) => { const el = $(id); const f = m > 0 ? v/m : 0; el.setAttribute('fill', f <= 0 ? '#3a1712' : f < 0.35 ? '#d9534a' : f < 0.7 ? '#e8b13f' : '#cfe8b0'); };
    zone('zN', P.armor[0], P.armorMax[0]); zone('zT', P.armor[1], P.armorMax[1]); zone('zL', P.armor[2], P.armorMax[2]); zone('zR', P.armor[3], P.armorMax[3]);
    // parts behind the armour: engine, tail, wings. Dim when sound, amber/red as they go, black when gone; blinking while the oil runs or a wing creaks
    const pk = P.pk ? P.pk() : [1, 1, 1, 1], blink = (g.t*3 % 1) < 0.5;
    ['pN', 'pT', 'pL', 'pR'].forEach((id, i) => { const el = $(id); if (!el) return; const k = pk[i], gone = k <= 0 || P.wingGone === i;
      el.setAttribute('fill', gone ? '#000' : k < 0.35 ? '#ff4a3a' : k < 0.7 ? '#ffb02e' : '#2b3140'); el.setAttribute('stroke', gone ? '#ff4a3a' : k < 0.7 ? '#1a1a1a' : '#5a6478');
      el.style.opacity = ((i === 0 && P.leak && !P.engineDead) || (i >= 2 && P.creak > 0 && pk[i] < 0.25)) && blink ? 0.25 : 1; });
    $('hLeak').hidden = !(P.leak && !P.engineDead && P.alive);
    const fi = Math.max(0, P.internal/P.internalMax); $('hInt').style.width = (fi*100) + '%'; $('hInt').parentNode.classList.toggle('crit', fi < 0.35);
    // weapons
    const rows = P.guns.map(gn => {
      const f = gn.rounds/gn.def.ammo, cls = gn.rounds <= 0 ? 'out' : f < 0.2 ? 'low' : '';
      return `<div class="ar ${cls}"><span>${gn.def.name} <em>${gn.ammo.short}</em></span><b>${gn.rounds}</b><i class="am"><i style="width:${f*100}%"></i></i></div>`;
    });
    rows.push(`<div class="ar ${P.rockets ? '' : 'out'}"><span>${P.rocketDef.name} rockets</span><b>${P.rockets}</b><i class="am"><i style="width:${P.L.hp ? P.rockets/(P.L.hp*3)*100 : 0}%"></i></i></div>`);
    if ((G.CHASSIS[P.L.chassis] || {}).torps && (P.L.torps || 0) > 0) rows.push(`<div class="ar ${P.torpLeft > 0 ? '' : 'out'}"><span>Torpedoes <kbd>T</kbd></span><b>${P.torpLeft || 0}</b></div>`);
    if (P.st.drone) rows.push(`<div class="ar ${g.droneUsed ? 'out' : ''}"><span>Drone <kbd>X</kbd></span><b>${g.droneUsed ? (g.drone && g.drone.alive ? 'up' : '—') : 'ready'}</b></div>`);
    if (P.L.nitro || P.st.rocket) rows.push(`<div class="ar ${P.nitroLeft ? '' : 'out'}"><span>${P.st.rocket ? 'Rocket' : 'Nitro'} <kbd>Shift</kbd></span><b>${P.nitroLeft}</b></div>`);
    $('hArms').innerHTML = rows.join('');
    const s = g.ships[0]; if (s) { $('hShip').style.width = (s.hp/s.hpMax*100) + '%'; $('hShipV').textContent = Math.round(s.hp/s.hpMax*100) + '%'; $('hShip').parentNode.classList.toggle('crit', s.hp/s.hpMax < 0.4); }
    for (const pl of g.wingmen || []) { const r = document.querySelector(`#hWing [data-id="${pl.wing.id}"] .bar>i`); if (r) r.style.width = Math.max(0, pl.p.internal/pl.p.internalMax*100) + '%'; }
    $('hFoes').textContent = g.planes.filter(p => p.alive && p.team !== 0 && !(p.police && !G.policeHostile)).length;
    const T = g.targetShip, tp = $('hTgtP');
    if (!T) tp.hidden = true;
    else {
      tp.hidden = false;
      const n = k => `${T.alivePart(k).length}/${T.count(k)}`, ok = k => T.alivePart(k).length ? '<i class="ok">●</i>' : '<i class="x">✕</i>';
      const st = {fighting:'Fighting', running:'Running!', surrendered:'Surrendered', captured:'Captured', destroyed:'Going down'}[T.state];
      const sec = Object.keys(T.sections).map(k => `<i class="bar ${T.sections[k] <= 0 ? 'crit' : ''}" title="${k}"><i style="width:${T.sections[k]/T.sectionsMax[k]*100}%"></i></i>`).join('');
      tp.innerHTML = `<div class="tt"><b>${G.esc(T.name)}</b><span>${st}</span></div>
        <div class="tg"><span>Engines</span><b>${n('engine')}</b><span>Guns</span><b>${T.alivePart('mg').length + T.alivePart('flak').length + T.alivePart('rocket').length}/${T.count('mg') + T.count('flak') + T.count('rocket')}</b>
        <span>Holed</span><b>${8 - T.alivePart('cell').length}/4</b><span>Rudders</span><b>${n('fin')}</b><span>Bridge</span><b>${ok('bridge')}</b><span>Radio</span><b>${ok('radio')}</b><span>Hangar</span><b>${ok('hangar')}</b></div>
        <div class="tsec"><small>Plating: bow · stern · port · stbd · gondola</small><div>${sec}</div></div>`;
    }
  },
  /* the bombsight (game.toggleSight): the window, the computed fall line and where it ends, the drop zone, the wind dial */
  drawSight(g, P, c, W, Hh){
    const S = g.sight, cx = W/2, cy = Hh/2, R = Math.min(W, Hh)*0.46, pt = {x:0, y:0, z:0};
    c.save(); c.fillStyle = 'rgba(8,10,8,0.92)'; c.beginPath(); c.rect(0, 0, W, Hh); c.arc(cx, cy, R, 0, Math.PI*2, true); c.fill('evenodd');
    c.strokeStyle = 'rgba(210,200,160,0.9)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI*2); c.stroke();
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI*2); c.clip();
    // the drift wires: the line the plane's track takes across the ground, ticked
    c.strokeStyle = 'rgba(230,220,180,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.stroke();
    for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(cx - 6, cy + i*R/7); c.lineTo(cx + 6, cy + i*R/7); c.stroke(); }
    // the drop zones, ringed at their bullseye and their delivery distance
    for (const z of g.dropZones || []) {
      if (z.done) continue; this.proj(z.pos, pt); if (pt.z >= 1) continue;
      const e = {x:0, y:0, z:0}; this.proj(tA.copy(z.pos).add(tB.set(z.good, 0, 0)), e); const rr = Math.max(6, Math.hypot(e.x - pt.x, e.y - pt.y));
      c.strokeStyle = 'rgba(255,120,90,0.95)'; c.lineWidth = 2; c.beginPath(); c.arc(pt.x, pt.y, rr, 0, Math.PI*2); c.stroke();
      c.setLineDash([4, 4]); c.beginPath(); c.arc(pt.x, pt.y, rr*z.bull/z.good, 0, Math.PI*2); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(255,170,140,0.95)'; c.font = '700 13px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillText(z.label, pt.x, pt.y - rr - 6);
    }
    // where a crate let go now would come down, on the wind as set
    const hit = g.predictCrate(tC);
    if (hit) { this.proj(hit, pt); if (pt.z < 1) {
      c.strokeStyle = '#f2c14e'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx, cy); c.lineTo(pt.x, pt.y); c.stroke();
      c.beginPath(); c.arc(pt.x, pt.y, 11, 0, Math.PI*2); c.moveTo(pt.x - 20, pt.y); c.lineTo(pt.x - 6, pt.y); c.moveTo(pt.x + 6, pt.y); c.lineTo(pt.x + 20, pt.y); c.moveTo(pt.x, pt.y - 20); c.lineTo(pt.x, pt.y - 6); c.moveTo(pt.x, pt.y + 6); c.lineTo(pt.x, pt.y + 20); c.stroke();
      for (const z of g.dropZones || []) if (!z.done) { const dd = Math.hypot(hit.x - z.pos.x, hit.z - z.pos.z); if (dd < z.good*3) { c.fillStyle = dd <= z.bull ? '#9ef0a0' : dd <= z.good ? '#f2c14e' : '#ff8a6a'; c.font = '700 14px "Barlow Condensed", sans-serif'; c.textAlign = 'left'; c.fillText(`${Math.round(dd*1.0936)} yd`, pt.x + 16, pt.y + 18); } }
    } }
    c.restore();
    // the wind dial: what the bombardier has told the computer (the arrow points where the wind blows to)
    const dx = cx + R + 70 > W - 70 ? W - 90 : cx + R + 70, dy = cy - R*0.5, rd = 46;
    c.strokeStyle = 'rgba(230,220,180,0.9)'; c.lineWidth = 2; c.beginPath(); c.arc(dx, dy, rd, 0, Math.PI*2); c.stroke();
    const rel = S.wDir - Math.atan2(P.fwd.x, P.fwd.z), ax = -Math.sin(rel), ay = -Math.cos(rel), L = 10 + Math.min(1, S.wSpd/20)*(rd - 12);   // screen: up is the nose
    c.strokeStyle = '#f2c14e'; c.lineWidth = 3; c.beginPath(); c.moveTo(dx - ax*L, dy - ay*L); c.lineTo(dx + ax*L, dy + ay*L); c.stroke();
    c.beginPath(); c.arc(dx + ax*L, dy + ay*L, 4, 0, Math.PI*2); c.fillStyle = '#f2c14e'; c.fill();
    c.font = '700 13px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(240,230,200,0.95)';
    c.fillText(`WIND SET · ${Math.round(S.wSpd*2.237)} mph`, dx, dy + rd + 18); c.fillText(G.pad && G.pad.active ? 'right stick: turn and strength' : 'Q/E direction · W/S strength', dx, dy + rd + 34);
    // readouts
    const ly = cy + R*0.25, lx = dx;
    const lines = [`ALT ${Math.round(P.pos.y*FT).toLocaleString()} ft`, `GROUND SPEED ${Math.round(Math.hypot(P.vel.x, P.vel.z)/G.MPH)} mph`, `FALL ${S.fall ? S.fall.toFixed(1) : '—'} s`, `CRATES ${P.packages || 0}`];
    c.textAlign = 'center'; c.font = '700 15px "Barlow Condensed", sans-serif'; lines.forEach((t, i) => c.fillText(t, lx, ly + i*20));
    c.font = '600 13px "Barlow Condensed", sans-serif'; c.fillStyle = 'rgba(240,230,200,0.8)';
    const pad = G.pad && G.pad.active;
    c.fillText(pad ? 'Left stick steers the run · right stick sets the wind · trigger drops · Camera button back to the stick' : 'A/D steer the run · Space or click drops · B back to the stick', cx, cy + R + 26);
    c.fillText('Read the wind off the drop zone\'s smoke', cx, cy - R - 12);
  },
  proj(v, out){ tC.copy(v).project(G.game.camera); out.x = (tC.x*0.5 + 0.5)*innerWidth; out.y = (-tC.y*0.5 + 0.5)*innerHeight; out.z = tC.z; return out; },
  draw(g, P){
    const c = this.cx, d = this.dpr, W = innerWidth, Hh = innerHeight; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, Hh);
    if (g.sight) { this.drawSight(g, P, c, W, Hh); return; }
    if (!g.running || !P.alive) return;
    const pt = {x:0, y:0, z:0}, cam = g.camera;
    // gun crosshair at convergence, mouse-aim circle
    this.proj(tA.copy(P.pos).addScaledVector(P.fwd, 330), pt);
    if (pt.z < 1) { c.strokeStyle = 'rgba(255,240,200,.95)'; c.lineWidth = 2; c.beginPath(); c.moveTo(pt.x - 14, pt.y); c.lineTo(pt.x - 5, pt.y); c.moveTo(pt.x + 5, pt.y); c.lineTo(pt.x + 14, pt.y); c.moveTo(pt.x, pt.y - 14); c.lineTo(pt.x, pt.y - 5); c.moveTo(pt.x, pt.y + 5); c.lineTo(pt.x, pt.y + 14); c.stroke(); }
    const gx = pt.x, gy = pt.y;
    if (this.hit > 0 && pt.z < 1) { c.strokeStyle = 'rgba(255,120,80,' + (this.hit/0.12) + ')'; c.lineWidth = 2.5; c.beginPath(); for (const [a, b] of [[-1,-1],[1,-1],[-1,1],[1,1]]) { c.moveTo(gx + a*8, gy + b*8); c.lineTo(gx + a*16, gy + b*16); } c.stroke(); }
    if (g.view === 'chase' || true) {
      this.proj(tA.copy(P.pos).addScaledVector(g.aimDir, 1200), pt);
      if (pt.z < 1) { c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5; c.beginPath(); c.arc(pt.x, pt.y, 11, 0, 7); c.stroke(); c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(pt.x - 1, pt.y - 1, 2, 2); }
    }
    this.compass(c, g, P, W);
    // markers
    let best = null, bestA = 0.42;
    for (const p of g.planes) {
      if (!p.alive || p.isPlayer || p.docked) continue;
      const dist = p.pos.distanceTo(P.pos);
      this.proj(p.pos, pt);
      const on = pt.z < 1 && pt.x > 0 && pt.x < W && pt.y > 0 && pt.y < Hh;
      const hm = g.helpMark && g.helpMark.q === p && g.helpMark.until > g.t && g.helpMark.by.p.alive ? g.helpMark : null;
      const col = p.team === 0 ? '#8fe3a8' : p.police ? (G.policeHostile ? '#ff6b57' : '#7ab8ff') : hm ? (g.t*4 % 1 < 0.6 ? '#ffb347' : '#ff6b57') : p.ace || p.rival ? '#f2c14e' : '#ff6b57';
      if (on) {
        const s = Math.max(10, Math.min(46, 2600/dist));
        c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath();
        for (const [a, b] of [[-1,-1],[1,-1],[-1,1],[1,1]]) { c.moveTo(pt.x + a*s, pt.y + b*s*0.7); c.lineTo(pt.x + a*s*0.55, pt.y + b*s*0.7); c.moveTo(pt.x + a*s, pt.y + b*s*0.7); c.lineTo(pt.x + a*s, pt.y + b*s*0.25); }
        c.stroke();
        if (dist < 1600) { c.fillStyle = col; c.font = '600 11px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillText(`${p.callsign}  ${Math.round(dist*YD)} yd`, pt.x, pt.y - s*0.7 - 5); }
        if (hm) { c.fillStyle = '#ffb347'; c.font = '700 12px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillText(`ON ${hm.who.toUpperCase()}'S TAIL`, pt.x, pt.y - s*0.7 - (dist < 1600 ? 19 : 5)); }
        // armor ticks under the bracket
        if (dist < 900) { const f = Math.max(0, p.internal/p.internalMax); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(pt.x - 18, pt.y + s*0.7 + 4, 36, 4); c.fillStyle = col; c.fillRect(pt.x - 18, pt.y + s*0.7 + 4, 36*f, 4); }
      } else this.edge(c, pt, col);
      const ang = tA.copy(p.pos).sub(P.pos).normalize().angleTo(g.view === 'cockpit' ? P.fwd : g.aimDir);
      if (p.team !== 0 && !p.invuln && !p.rival && !(p.police && !G.policeHostile) && dist < 1000 && ang < bestA) { bestA = ang; best = p; }
    }
    for (const s of g.ships) {
      if (!s.alive || s.hidden) continue; this.proj(s.pos, pt);
      const col = s.team === 0 ? '#8fe3a8' : s.state === 'fighting' || s.state === 'running' ? '#ff6b57' : '#f1e9d6', dist = s.pos.distanceTo(P.pos);
      const on = pt.z < 1 && pt.x > 0 && pt.x < W && pt.y > 0 && pt.y < Hh;
      if (on && (s.team === 0 || dist > 700)) { c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.moveTo(pt.x, pt.y - 9); c.lineTo(pt.x + 9, pt.y); c.lineTo(pt.x, pt.y + 9); c.lineTo(pt.x - 9, pt.y); c.closePath(); c.stroke(); c.fillStyle = col; c.font = '600 11px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillText(`${s.name}  ${Math.round(dist*YD)} yd`, pt.x, pt.y - 14); }
      else if (!on) this.edge(c, pt, col);
      // shootable parts on an enemy airship, with the one under your guns named
      if (s.comps && s.team !== 0 && (s.state === 'fighting' || s.state === 'running') && dist < 1400) {
        let aimed = null, aimA = 0.05;
        for (const cp of s.comps) {
          if (!cp.alive || cp.virtual) continue;
          s.worldPoint(cp.pos, tA); this.proj(tA, pt); if (pt.z >= 1) continue;
          const a = tB.copy(tA).sub(P.pos).normalize().angleTo(P.fwd);
          if (a < aimA) { aimA = a; aimed = {cp, x:pt.x, y:pt.y}; }
          const f = cp.hp/cp.hpMax, rr = cp.kind === 'bridge' ? 7 : 5;
          c.strokeStyle = cp.kind === 'bridge' ? '#f2c14e' : 'rgba(255,107,87,.85)'; c.lineWidth = 1.4; c.beginPath(); c.arc(pt.x, pt.y, rr, 0, 7); c.stroke();
          if (f < 1) { c.fillStyle = 'rgba(255,107,87,.85)'; c.beginPath(); c.moveTo(pt.x, pt.y); c.arc(pt.x, pt.y, rr - 1.5, -Math.PI/2, -Math.PI/2 + (1 - f)*Math.PI*2); c.fill(); }
        }
        if (aimed) g.partAim = {ship:s, cp:aimed.cp};
        if (aimed) {
          const cp = aimed.cp, cov = cp.cover && s.sections[cp.cover] > 0;
          c.font = '700 12px "Barlow Condensed", sans-serif'; c.textAlign = 'left'; c.fillStyle = '#ffd2c8';
          c.fillText(`${cp.label}  ${Math.ceil(cp.hp)}/${cp.hpMax}${cov ? `  · behind armour ${Math.ceil(s.sections[cp.cover])}` : ''}`, aimed.x + 12, aimed.y - 8);
        }
      }
    }
    for (const t of g.targets || []) {
      if (!t.alive || t.team === 0 || t.pos.distanceTo(P.pos) > 2200) continue; this.proj(t.pos, pt); if (pt.z >= 1) continue;
      c.strokeStyle = t.kind === 'tank' ? '#ff9a3c' : '#ff6b57'; c.lineWidth = 1.6; c.strokeRect(pt.x - 8, pt.y - 8, 16, 16);
      if (t.hp < t.hpMax) { c.fillStyle = c.strokeStyle; c.fillRect(pt.x - 8, pt.y + 11, 16*t.hp/t.hpMax, 3); }
      if (t.pos.distanceTo(P.pos) < 1300) { c.fillStyle = '#ffd2c8'; c.font = '600 11px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillText(t.label, pt.x, pt.y - 13); }
    }
    // mission markers: course gates, clues, photo targets
    for (const m of g.markers || []) {
      if (m.hide) continue; this.proj(m.pos, pt); const on = pt.z < 1 && pt.x > 0 && pt.x < W && pt.y > 0 && pt.y < Hh, d = m.pos.distanceTo(P.pos);
      if (on && !m.edgeOnly) { c.strokeStyle = m.col || '#f2c14e'; c.lineWidth = 2; c.beginPath(); if (m.box) c.rect(pt.x - 14, pt.y - 14, 28, 28); else c.arc(pt.x, pt.y, Math.max(8, Math.min(30, 4000/Math.max(1, d))), 0, 7); c.stroke();
        c.fillStyle = c.strokeStyle; c.font = '700 12px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillText(`${m.label}${m.noDist ? '' : '  ' + Math.round(d*YD) + ' yd'}`, pt.x, pt.y - 20); }
      else if (!on) this.edge(c, pt, m.col || '#f2c14e');
    }
    // aeroplanes standing ready to be taken (game.parkPlane): marked within a couple of miles, brighter when you're close enough to climb in
    for (const s of g.parkedSpots || []) {
      const d = s.plane.pos.distanceTo(P.pos); if (d > 3500 || s.plane === P) continue; this.proj(s.plane.pos, pt); const on = pt.z < 1 && pt.x > 0 && pt.x < W && pt.y > 0 && pt.y < Hh, col = g.swapNear === s ? '#c8ffb0' : '#9ef0a0';
      if (on) { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.rect(pt.x - 16, pt.y - 16, 32, 32); c.stroke(); c.fillStyle = col; c.font = '700 12px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillText(g.swapNear === s ? `Y · TAKE ${s.label.toUpperCase()}` : `${s.label.toUpperCase()}  ${Math.round(d*YD)} yd`, pt.x, pt.y - 22); }
      else this.edge(c, pt, col);
    }
    // torpedoes: red if headed for the Margaret, green if ours
    for (const t of g.torps || []) {
      if (t.pos.distanceTo(P.pos) > 2200) continue; this.proj(t.pos, pt);
      const col = t.team === 0 ? '#8fe3a8' : '#ff6b57', on = pt.z < 1 && pt.x > 0 && pt.x < W && pt.y > 0 && pt.y < Hh;
      if (on) { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(pt.x, pt.y - 10); c.lineTo(pt.x + 8, pt.y + 6); c.lineTo(pt.x - 8, pt.y + 6); c.closePath(); c.stroke();
        c.fillStyle = col; c.font = '700 11px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillText(`TORPEDO ${Math.round(t.pos.distanceTo(P.pos)*YD)} yd`, pt.x, pt.y + 20); }
      else if (t.team !== 0) this.edge(c, pt, col);
    }
    // docking rings: show when low or close, with what's still wrong
    const low = P.guns.some(gn => gn.rounds < gn.def.ammo*0.3) || (P.L.hp && P.rockets === 0) || P.internal < P.internalMax*0.5 || P.armor.some((a, i) => a < P.armorMax[i]*0.3);
    for (const D of g.dockInfo || []) {
      if (!(low || D.dist < 500)) continue;
      this.proj(D.R, pt); const ready = D.cd <= 0, good = ready && D.slowOk && D.alignOk;
      if (pt.z < 1 && pt.x > 0 && pt.x < W && pt.y > 0 && pt.y < Hh) {
        const r = Math.max(9, Math.min(60, 7000/Math.max(1, D.dist)));
        c.strokeStyle = !ready ? '#6d6655' : good ? '#9ef0a0' : '#d9a441'; c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); c.arc(pt.x, pt.y, r, 0, 7); c.stroke(); c.setLineDash([]);
        c.font = '700 12px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillStyle = c.strokeStyle;
        const lines = [!ready ? `DOCK BUSY ${Math.ceil(D.cd)}s` : `DOCK  ${Math.round(D.dist*YD)} yd`];
        if (ready && D.dist < 700) { lines.push(D.slowOk ? 'speed ✓' : `slow to ${Math.round(G.hookTop(P)/G.MPH)} mph (${Math.round(P.speed/G.MPH)})`); lines.push(D.alignOk ? 'heading ✓' : 'line up with the ship'); }
        lines.forEach((t, k) => c.fillText(t, pt.x, pt.y + r + 14 + k*14));
      } else if (low && ready) this.edge(c, pt, '#d9a441');
    }
    // the Margaret's centre-line trapeze: fly through it from astern to go back to the hangar
    const H = g.homeInfo;
    if (H && H.dist < 1400) {
      this.proj(H.R, pt);
      if (pt.z < 1 && pt.x > 0 && pt.x < W && pt.y > 0 && pt.y < Hh) {
        const r = Math.max(8, Math.min(50, 5000/Math.max(1, H.dist))), good = H.slowOk && H.alignOk;
        c.strokeStyle = good ? '#9ef0a0' : '#9ec7f0'; c.lineWidth = 2; c.setLineDash([3, 4]); c.beginPath(); c.arc(pt.x, pt.y, r, 0, 7); c.stroke(); c.setLineDash([]);
        c.font = '700 12px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillStyle = c.strokeStyle;
        const lines = [`REDOCK · HANGAR  ${Math.round(H.dist*YD)} yd`]; if (H.dist < 700) { lines.push(H.slowOk ? 'speed ✓' : `slow to ${Math.round(G.hookTop(P)/G.MPH)} mph (${Math.round(P.speed/G.MPH)})`); lines.push(H.alignOk ? 'heading ✓' : 'come in from astern'); }
        lines.forEach((t, k) => c.fillText(t, pt.x, pt.y - r - 8 - (lines.length - 1 - k)*14));
      }
    }
    // lead pipper on the enemy nearest the aim (Normal difficulty)
    g.assist = null; if (!g.partAim || !g.partAim.cp.alive) g.partAim = null;
    if (best) {
      const mv = P.guns.length ? P.guns.reduce((s, gn) => s + gn.def.muzzle, 0)/P.guns.length : 830;
      const dist = best.pos.distanceTo(P.pos), t = dist/mv;
      tB.copy(best.pos).addScaledVector(best.vel, t).addScaledVector(P.vel, -t);
      g.assist = {target:best, lead:tB.clone()};
    }
    if (best && G.save.aimAssist) {
      this.proj(tB, pt);
      if (pt.z < 1) { c.strokeStyle = best.ace ? '#f2c14e' : '#ffb59f'; c.lineWidth = 1.8; c.beginPath(); c.arc(pt.x, pt.y, 6, 0, 7); c.stroke(); c.beginPath(); c.moveTo(pt.x, pt.y); this.proj(best.pos, tA); c.lineTo(tA.x, tA.y); c.globalAlpha = 0.35; c.stroke(); c.globalAlpha = 1; }
    }
  },
  /* heading tape across the top: north is +Z (the same north the chart and the riddles use), east is +X */
  compass(c, g, P, W){
    const hd = ((Math.atan2(P.fwd.x, P.fwd.z)*180/Math.PI) + 360) % 360, cx = W/2, y = 22, half = 190, span = 70, px = half/span;
    c.save(); c.fillStyle = 'rgba(12,16,26,.55)'; c.fillRect(cx - half - 8, y - 14, half*2 + 16, 34); c.strokeStyle = 'rgba(217,164,65,.35)'; c.lineWidth = 1; c.strokeRect(cx - half - 8, y - 14, half*2 + 16, 34);
    c.beginPath(); c.rect(cx - half, y - 14, half*2, 34); c.clip();
    c.textAlign = 'center'; c.strokeStyle = 'rgba(239,227,200,.8)';
    for (let d = Math.ceil((hd - span)/5)*5; d <= hd + span; d += 5) {
      const x = cx + (d - hd)*px, n = ((d % 360) + 360) % 360, major = n % 30 === 0, card = n % 90 === 0;
      c.lineWidth = card ? 2 : 1; c.beginPath(); c.moveTo(x, y + 14); c.lineTo(x, y + (major ? 4 : 9)); c.stroke();
      if (major) { c.fillStyle = card ? (n === 0 ? '#ff8c78' : '#f2c14e') : 'rgba(239,227,200,.85)'; c.font = card ? '700 15px "Barlow Condensed", sans-serif' : '600 11px "Barlow Condensed", sans-serif'; c.fillText(card ? ['N', 'E', 'S', 'W'][n/90] : String(n).padStart(3, '0'), x, y + 1); }
    }
    // the Margaret on the tape
    const s = g.ships.find(x => x.team === 0 && x.obj.userData.docks) || g.ships[0];
    if (s && s.alive && s.team === 0) { let b = (Math.atan2(s.pos.x - P.pos.x, s.pos.z - P.pos.z)*180/Math.PI + 360) % 360, dd = ((b - hd + 540) % 360) - 180;
      const x = cx + Math.max(-half + 6, Math.min(half - 6, dd*px)); c.fillStyle = '#8fe3a8'; c.beginPath(); c.moveTo(x, y + 14); c.lineTo(x - 5, y + 20); c.lineTo(x + 5, y + 20); c.closePath(); c.fill(); }
    c.restore();
    // centre index and the heading readout
    c.fillStyle = '#f2c14e'; c.beginPath(); c.moveTo(cx, y + 15); c.lineTo(cx - 6, y + 24); c.lineTo(cx + 6, y + 24); c.closePath(); c.fill();
    c.font = '700 13px "Barlow Condensed", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#f3d9a4'; c.fillText(`${String(Math.round(hd) % 360).padStart(3, '0')}° ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(hd/45) % 8]}`, cx, y + 38);
  },
  edge(c, pt, col){
    const W = innerWidth, Hh = innerHeight, cx = W/2, cy = Hh/2;
    let dx = pt.x - cx, dy = pt.y - cy; if (pt.z > 1) { dx = -dx; dy = -dy; }
    const a = Math.atan2(dy, dx), r = Math.min(W, Hh)*0.42, x = cx + Math.cos(a)*r, y = cy + Math.sin(a)*r;
    c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(9, 0); c.lineTo(-5, -6); c.lineTo(-5, 6); c.closePath(); c.fill(); c.restore();
  }
};
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c])); }
G.esc = esc;
})();
