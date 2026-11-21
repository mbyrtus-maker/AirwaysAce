(function(){
'use strict';
/* Menus, hangar, pause, debrief, input wiring and the frame loop. */
const G = window.G, V3 = THREE.Vector3;
const $ = id => document.getElementById(id), esc = s => G.esc(s);
G.loadSave();

let view = $('view');
/* WebGL: ask for the full works first, then step down; some machines (older Macs, dual-GPU laptops, locked-down browsers)
   refuse the first request but take a plainer one. If none takes, explain instead of leaving a black screen. */
const renderer = (() => {
  const tries = [{antialias:true, powerPreference:'high-performance', logarithmicDepthBuffer:true},
                 {antialias:false, powerPreference:'default', logarithmicDepthBuffer:true},
                 {antialias:false, powerPreference:'default', logarithmicDepthBuffer:false, precision:'mediump'}];
  for (let i = 0; i < tries.length; i++) {
    try { const r = new THREE.WebGLRenderer(Object.assign({canvas:view}, tries[i])); if (i) console.warn('Ace of the Airways: running with plainer WebGL settings', tries[i]); return r; }
    catch (e) { console.warn('WebGL attempt failed', tries[i], e); const c = view.cloneNode(false); view.replaceWith(c); view = c; }   // a fresh canvas for the next try
  }
  const mac = /Mac/.test(navigator.platform || navigator.userAgent), ff = /Firefox/.test(navigator.userAgent), chrome = /Chrome|Edg/.test(navigator.userAgent) && !ff, safari = /Safari/.test(navigator.userAgent) && !chrome && !ff;
  if (window.bootFail) window.bootFail('No 3D in this browser', '<p>Ace of the Airways needs <b>WebGL</b>, and this browser has it switched off or can\'t start it.</p><ul style="padding-left:20px">' +
    (safari || mac ? '<li><b>Mac:</b> if <b>Lockdown Mode</b> is on (System Settings → Privacy &amp; Security), it switches WebGL off in Safari. Turn it off for this site, or try Chrome or Firefox.</li>' : '') +
    (chrome ? '<li><b>Chrome / Edge:</b> Settings → System → turn on <b>Use graphics acceleration when available</b>, then relaunch. <code>chrome://gpu</code> shows whether WebGL is working.</li>' : '') +
    (ff ? '<li><b>Firefox:</b> Settings → General → Performance → allow <b>hardware acceleration</b>, then restart. In <code>about:config</code>, <b>webgl.disabled</b> must be false.</li>' : '') +
    '<li>Update the browser and the computer\'s graphics drivers, then reload.</li><li>Check at <b>get.webgl.org</b>: if the cube there doesn\'t spin, the game can\'t run either.</li></ul>');
  throw new Error('WebGL unavailable');
})();
G.renderer = renderer; renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1)); renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); const g = G.game; if (g) { g.camera.aspect = innerWidth/innerHeight; g.camera.updateProjectionMatrix(); } });
G.HUD.init();

const UI = G.UI = {
  screen(id){ for (const s of ['menu', 'hangar', 'pause', 'debrief', 'loading', 'chart', 'contact', 'controls', 'ach']) if ($(s)) $(s).hidden = s !== id; },
  /* ---------- main menu ---------- */
  menu(){
    if (G.Net) setTimeout(() => G.Net.render(), 0);
    UI.quit(); this.screen('menu'); G.HUD.show(false);
    G.music.play(G.save.story && /end$/.test(G.save.story.node) && (G.save.mission || 'story') === 'story' ? 'home' : 'sidewalk');
    const S = G.save; if (!S.story) S.story = G.newStory(); if (S.story.node === 'c1end') { S.story.node = 'c2m1'; G.persist(); }
    if (S.story.node === 'c2end') { S.story.node = S.story.log.some(l => l.node === 'c2m2') ? 'c2m3' : 'c2m2'; G.persist(); }
    if (S.mission === 'open') S.mission = 'story';
    if (S.mission && S.mission !== 'story' && G.MISSIONS[S.mission] && !G.MISSIONS[S.mission].story) S.mission = 'story';   // test flights live in the developer table now (Ctrl+Alt+D); the menu goes back to the story
    const storyNode = S.story.node, inStory = (S.mission || 'story') === 'story';
    const M = inStory ? (G.MISSIONS[storyNode] || null) : (G.MISSIONS[S.mission] || G.MISSIONS.ambush);
    $('mList').innerHTML = `<button class="${inStory ? 'on' : ''}" onclick="UI.pickMission('story')"><span>${esc(/end$/.test(storyNode) ? 'The story so far' : G.chapterOf(storyNode))}</span><b>${/end$/.test(storyNode) ? 'To be continued' : 'Episode ' + G.STORY[storyNode].n + ': ' + esc(G.MISSIONS[storyNode].title)}</b></button>` +
      `<button class="${S.mission === 'open' ? 'on' : ''}" onclick="UI.chart()"><span>Open skies · ${esc(G.REGIONS[S.open.region].name)}</span><b>Chart table</b></button>`;
    if (inStory && /end$/.test(storyNode)) {
      $('mBrief').innerHTML = `<div class="b-top"><span class="tag">The Lucky Thirteen</span><span>The End</span></div><h3>The End</h3><p class="recap">${esc(G.storyRecap())}</p>
        <ul>${S.story.log.map(l => `<li>${esc(l.title)} · <b>${{perfect:'Perfect', success:'Success', fail:'Failure'}[l.kind]}</b></li>`).join('')}</ul><div class="row"><button class="btn ghost sm" onclick="UI.restartChapter()">Start over from Chapter 1</button></div>`;
      $('mFly').disabled = true;
    } else {
      $('mFly').disabled = false;
      const recap = inStory ? `<p class="recap">${esc(G.storyRecap())}</p>` : '';
      $('mBrief').innerHTML = `<div class="b-top"><span class="tag">${inStory ? esc(G.chapterOf(storyNode).split(':')[0]) + ' · Episode ' + G.STORY[storyNode].n : 'Test flight'}</span><span>${esc(M.place)}</span></div><h3>${esc(M.title)}</h3>${recap}<p>${esc(M.brief)}</p>
        <ul>${M.sides.map(s => `<li>${esc(s.text)}</li>`).join('')}</ul><div class="b-pay">Pays <b>$${M.pay.success.toLocaleString()}</b> · +$${M.pay.perfect.toLocaleString()} if perfect${M.pay.kill ? ` · $${M.pay.kill} a kill` : ''}${M.wing ? ` · ${M.wing} wingmen` : ''}</div>
        ${inStory && S.story.log.length ? `<div class="row"><button class="btn ghost sm" onclick="UI.restartChapter()">Restart chapter</button></div>` : ''}`;
    }
    $('mCall').value = S.callsign || '';
    $('mCash').textContent = '$' + S.cash.toLocaleString();
    $('mRecord').textContent = `${S.sorties} sorties · ${S.wins} wins · ${S.kills} kills`;
    $('mVol').value = S.vol ?? 0.7; $('mAmb').value = S.amb ?? 0.8; $('mMus').value = G.music.vol(); $('mSens').value = S.mouseSens; $('mInv').checked = !!S.invert; $('mAssist').checked = !!S.aimAssist;
    preview.show($('mPrev'), S.load);
  },
  restartChapter(){ G.save.story = G.newStory(); G.save.mission = 'story'; G.persist(); UI.menu(); },
  current(){ const S = G.save; if (S.mission === 'open') return G.MISSIONS.open; return (S.mission || 'story') === 'story' ? G.MISSIONS[(S.story || G.newStory()).node] : (G.MISSIONS[S.mission] || G.MISSIONS.ambush); },
  pickMission(id){ G.save.mission = id; G.persist(); UI.menu(); },
  saveCall(){ const v = ($('mCall').value || G.save.callsign || '').trim().slice(0, 18); G.save.callsign = v; G.persist(); if (!v && $('menu').hidden) { UI.menu(); setTimeout(() => $('mCall').focus(), 50); } return v; },

  /* ---------- hangar (weight budget) ---------- */
  hangar(){
    UI.quit(); G.HUD.show(false); this.screen('hangar'); this.L = JSON.parse(JSON.stringify(G.save.load)); if (this.L.engine === 2 && !G.hasMod('hotrod')) this.L.engine = 1; if (this.L.nitro && !G.hasMod('nitro')) this.L.nitro = false; this.renderHangar(); G.music.play('sidewalk');
    preview.show($('hgPrev'), this.L);
  },
  renderHangar(){
    const L = this.L, c = G.CHASSIS[L.chassis], st = G.flightStats(L), w = G.loadWeight(L), over = w > c.max;
    const bar = (v, m, cls = '') => `<i class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v/m*100))}%"></i></i>`;
    const pick = (list, cur, fn, label, dis) => `<div class="seg">${list.map(x => `<button class="${x === cur ? 'on' : ''}" ${dis && dis(x) ? 'disabled' : ''} onclick="${fn}('${x}')">${label(x)}</button>`).join('')}</div>`;
    const armTot = L.arm.reduce((a, b) => a + b, 0);
    $('hgStats').innerHTML = (UI.hangarNote ? `<p class="note" style="margin:0 0 8px;color:#9ef0a0">${esc(UI.hangarNote)}</p>` : '') + `
      <div class="hg-name"><small>${esc(c.role)} · Crimson Skies ${esc(c.cs)} role</small><b>${esc(c.name)}</b></div>
      <div class="wrow ${over ? 'over' : ''}"><span>Weight</span>${bar(w, c.max, over ? 'crit' : '')}<b>${Math.round(w).toLocaleString()} / ${c.max.toLocaleString()} lb</b></div>
      <div class="srow"><span>Top speed</span>${bar(st.mph, 260)}<b>${st.mph} mph</b></div>
      <div class="srow"><span>Agility</span>${bar(G.RATE[c.agility]*st.agilityMul, 5)}<b>${c.agility}${st.agilityMul < 1 ? ` −${Math.round((1 - st.agilityMul)*100)}%` : ''}</b></div>
      <div class="srow"><span>Firepower</span>${bar(G.firepower(L), 160)}<b>${Math.round(G.firepower(L))} dmg/s</b></div>
      <div class="srow"><span>Armor</span>${bar(armTot, 200)}<b>${armTot} pts</b></div>
      <p class="note">${over ? `<b class="bad">Over max weight by ${Math.round(w - c.max)} lb.</b> Strip something before you can launch.` : st.agilityMul < 1 ? 'Payload over 70% of the budget costs agility. It comes back as you burn ammo and fire rockets.' : 'Light build: full agility.'}</p>`;
    let h = '';
    const nit = G.hasMod('nitro');
    h += `<section><h4>Engine</h4>${pick(['0', '1', '2'], String(L.engine), 'UI.setEng', x => `${G.ENGINE[x].name} <em>${G.ENGINE[x].mph >= 0 ? '+' : ''}${G.ENGINE[x].mph} mph</em>`, x => x === '2' && !G.hasMod('hotrod'))}
      ${G.hasMod('hotrod') ? '' : '<p class="desc" style="margin-left:0">High tune needs the hot-rod engine mod (Cactus Kate, Dust Devil Field).</p>'}
      <label class="chk ${nit ? '' : 'disabled'}"><input type="checkbox" ${nit ? '' : 'disabled'} ${L.nitro ? 'checked' : ''} onchange="UI.setNitro(this.checked)"> Nitro <em>${nit ? '3 boosts, Shift · 300 lb' : 'buy nitrous bottles from Hollis at Aero Works'}</em></label></section>`;
    const mods = (G.save.mods || []).map(m => G.MODS[m]);
    h += `<section><h4>Mods <em>always fitted</em></h4>${mods.length ? mods.map(m => `<p class="desc" style="margin-left:0"><b style="color:var(--cream)">${esc(m.name)}</b>: ${esc(m.desc)}</p>`).join('') : '<p class="desc" style="margin-left:0">None yet. Contacts in the open skies sell them, and treasure turns some up.</p>'}</section>`;
    h += `<section><h4>Guns <em>pairs · ${c.slots} positions</em></h4>`;
    L.guns.forEach((gn, i) => {
      h += `<div class="gslot"><span class="gn">${i + 1}</span>${pick(['none', ...G.GUN_ORDER], gn.cal || 'none', `UI.setGun.bind(null,${i})`, x => x === 'none' ? '—' : G.GUNS[x].name.replace('-cal', ''))}
        ${gn.cal ? pick(G.AMMO_ORDER, gn.ammo, `UI.setAmmo.bind(null,${i})`, x => G.AMMO[x].short) : '<div class="seg ghost">empty</div>'}</div>`;
      if (gn.cal) h += `<p class="desc">${G.GUNS[gn.cal].name}: ${G.GUNS[gn.cal].rps} rds/s, ${G.GUNS[gn.cal].ammo} rounds, ${G.GUNS[gn.cal].w} lb. ${esc(G.AMMO[gn.ammo].desc)}</p>`;
    });
    h += `</section><section><h4>Armor <em>4 lb per point · max ${G.ARMOR_MAX} per facing</em></h4><div class="armgrid">`;
    G.FACING.forEach((f, i) => { h += `<div class="arm"><span>${f}</span><button onclick="UI.setArm(${i},-5)">−</button><b>${L.arm[i]}</b><button onclick="UI.setArm(${i},5)">+</button></div>`; });
    h += `</div></section><section><h4>Rockets <em>3 per hardpoint · ${G.HP_W} lb each</em></h4>
      <div class="arm"><span>Hardpoints</span><button onclick="UI.setHp(-1)">−</button><b>${L.hp}</b><button onclick="UI.setHp(1)">+</button><em>${L.hp*3} rockets · max ${c.hpMax}</em></div>
      ${pick(G.ROCKET_ORDER, L.rocket, 'UI.setRk', x => G.ROCKETS[x].short)}<p class="desc">${esc(G.ROCKETS[L.rocket].desc)}</p></section>`;
    if (c.torps) h += `<section><h4>Air torpedoes <em>${G.TORP_W} lb each · fired with T</em></h4>
      <div class="arm"><span>Torpedoes</span><button onclick="UI.setTorp(-1)">−</button><b>${Math.min(L.torps || 0, c.torps)}</b><button onclick="UI.setTorp(1)">+</button><em>max ${c.torps}</em></div>
      <p class="desc">A slow, heavy fish that drops off the belly, lights its motor and steers itself at the airship (or ground target) nearest your nose. Wrecks a zeppelin; a fighter can shoot it down.</p></section>`;
    const livs = ['stock', ...(G.save.liveries || [])];
    h += `<section><h4>Paint</h4><div class="liv">${livs.map(id => { const p = id === 'stock' ? G.stockLoadout(L.chassis).paint : G.LIVERIES[id].paint; return `<button onclick="UI.setLivery('${id}')">${p.map(c => `<i style="background:#${c.toString(16).padStart(6, '0')}"></i>`).join('')}${id === 'stock' ? 'Factory' : esc(G.LIVERIES[id].name)}</button>`; }).join('')}</div>
      ${Object.keys(G.LIVERIES).length > livs.length - 1 ? `<p class="desc" style="margin-left:0">${Object.keys(G.LIVERIES).length - livs.length + 1} more paint jobs to find or win.</p>` : ''}<div class="paint" style="margin-top:8px">${L.paint.map((p, i) => `<label><input type="color" value="#${p.toString(16).padStart(6, '0')}" oninput="UI.setPaint(${i},this.value)"><span>${['Main', 'Second', 'Trim'][i]}</span></label>`).join('')}</div></section>`;
    $('hgBody').innerHTML = h;
    $('hgLaunch').disabled = over;
    $('hgChassis').innerHTML = Object.values(G.CHASSIS).filter(k => !k.special || G.save.owned.includes(k.id)).map(k => `<li ${G.save.owned.includes(k.id) && k.id !== L.chassis ? `onclick="UI.pickChassis('${k.id}')" style="cursor:pointer"` : ''} class="${k.id === L.chassis ? 'on' : ''} ${G.save.owned.includes(k.id) ? '' : 'locked'}"><b>${esc(k.name)}</b><span>${esc(k.role)}</span><em>${G.save.owned.includes(k.id) ? 'Owned' : esc(UI.whereChassis(k.id))}</em></li>`).join('');
  },
  pickChassis(id){ UI.L = G.stockLoadout(id); UI.renderHangar(); preview.show($('hgPrev'), UI.L); },
  setEng(x){ if (x === '2' && !G.hasMod('hotrod')) return; UI.L.engine = +x; UI.renderHangar(); },
  setNitro(on){ UI.L.nitro = on && G.hasMod('nitro'); UI.renderHangar(); },
  setLivery(id){ UI.L.paint = (id === 'stock' ? G.stockLoadout(UI.L.chassis).paint : G.LIVERIES[id].paint).slice(); UI.renderHangar(); preview.show($('hgPrev'), UI.L); },
  whereChassis(id){
    for (const [cid, C] of Object.entries(G.CONTACTS)) { const it = C.shop.find(x => x.chassis === id); if (it) return `$${it.price.toLocaleString()} · ${C.name.replace(/".*" /, '').split(' ').slice(-1)[0]}`; }
    for (const R of Object.values(G.REGIONS)) if (R.treasures.some(t => t.reward && t.reward.chassis === id)) return `Treasure · ${R.name}`;
    const j = G.JOBS.find(j => j.reward && j.reward.chassis === id); if (j) return `Job · ${j.title}`;
    return id === 'comet' ? 'Story' : id === 'zephyr' ? 'Finish Volume II' : id === 'hornet' ? 'Finish Volume III' : id === 'banshee' ? 'Finish Volume IV' : 'Later';
  },
  setGun(i, x){ UI.L.guns[i].cal = x === 'none' ? null : x; UI.renderHangar(); },
  setAmmo(i, x){ UI.L.guns[i].ammo = x; UI.renderHangar(); },
  setArm(i, d){ UI.L.arm[i] = Math.max(0, Math.min(G.ARMOR_MAX, UI.L.arm[i] + d)); UI.renderHangar(); },
  setTorp(d){ const c = G.CHASSIS[UI.L.chassis]; UI.L.torps = Math.max(0, Math.min(c.torps || 0, (UI.L.torps || 0) + d)); UI.renderHangar(); },
  setHp(d){ const c = G.CHASSIS[UI.L.chassis]; UI.L.hp = Math.max(0, Math.min(c.hpMax, UI.L.hp + d)); UI.renderHangar(); },
  setRk(x){ UI.L.rocket = x; UI.renderHangar(); },
  setPaint(i, v){ UI.L.paint[i] = parseInt(v.slice(1), 16); preview.show($('hgPrev'), UI.L); },
  hangarStock(){ const p = UI.L.paint; UI.L = G.stockLoadout(UI.L.chassis); UI.L.paint = p; UI.renderHangar(); preview.show($('hgPrev'), UI.L); },
  redocked(g){
    const m = g.mission, r = m.open ? m.redock() : null; G.save.kills += g.kills; G.persist();
    UI.hangarNote = m.open ? `Back aboard over ${G.REGIONS[G.save.open.region].name}. This flight: $${(r ? r.shown : 0).toLocaleString()} earned, ${m.jobsDone} job${m.jobsDone === 1 ? '' : 's'}, ${Math.round(m.sc.session).toLocaleString()} stunt points. ${G.timeLabel()}.` : `Back aboard. ${m.title} called off.`;
    if (document.pointerLockElement) document.exitPointerLock();
    UI.hangar();
  },
  hangarSave(){ UI.hangarNote = null; const L = UI.L; if (G.loadWeight(L) > G.CHASSIS[L.chassis].max) return false; G.save.load = L; G.persist(); return true; },

  /* ---------- flying ---------- */
  fly(){
    if (G.Net && G.Net.role === 'guest') { G.HUD.toast('The host launches the flight'); return; }
    if (!UI.saveCall()) { $('mCall').focus(); $('mCall').classList.add('need'); setTimeout(() => $('mCall').classList.remove('need'), 900); return; }
    G.audio.init(); G.music.stop(1.2); UI.quit(); this.screen('loading');
    setTimeout(() => {
      const M = this.current(); if (!M) { this.menu(); return; } $('hTitle').textContent = M.title;
      const g = new G.Game(renderer, M); g.camera.aspect = innerWidth/innerHeight; g.camera.updateProjectionMatrix();
      G.save.sorties++; G.persist();
      this.screen(null); G.HUD.show(true); if (G.keymap) G.keymap.renderHelp(); $('hHelp').hidden = false; setTimeout(() => { $('hHelp').hidden = true; }, 14000);
      $('hSides').innerHTML = ''; G.HUD.sk = null; $('hStunt').hidden = true; $('hTitle').textContent = M.open ? G.REGIONS[G.save.open.region].name : M.title; G.HUD.wing(g); G.HUD.objective('Drop from the trapeze');
    }, 40);
  },
  /* co-op guest: the host launched; build the same sortie here (net.js turns it into a puppet of the host's) */
  netFly(M){
    G.audio.init(); G.music.stop(1.2); UI.quit(); UI.inContact = false; UI.inDev = false; this.screen('loading');
    setTimeout(() => {
      G.Net.building = true;
      let g; try { g = new G.Game(renderer, M); } finally { G.Net.building = false; }
      g.camera.aspect = innerWidth/innerHeight; g.camera.updateProjectionMatrix();
      this.screen(null); G.HUD.show(true); $('hHelp').hidden = true;
      $('hSides').innerHTML = ''; G.HUD.sk = null; $('hStunt').hidden = true; $('hTitle').textContent = (M.open ? G.REGIONS[G.save.open.region].name : M.title) + ' · co-op'; G.HUD.wing(g); G.HUD.objective('Drop from the trapeze');
    }, 40);
  },
  continueStory(){ const r = this.lastResult; if (r && this.lastMission && this.lastMission.story && G.save.story && G.save.story.node === this.lastMission.id) G.storyCommit(r); this.lastResult = null; G.save.mission = 'story'; G.persist(); this.menu(); },
  retry(){ this.fly(); },
  quit(){ const g = G.game; if (G.weatherSound) G.weatherSound.silence(); if (g && G.Net) G.Net.onQuit(g); if (g) { g.dispose(); G.game = null; } if (document.pointerLockElement) document.exitPointerLock(); },
  pause(on){
    const g = G.game; if (!g || g.done || UI.inContact || UI.inDev) return; g.paused = on; this.screen(on ? 'pause' : null);
    const op = !!g.mission.open; $('pOpen').hidden = !op; $('pStd').hidden = op; if (op) $('pAbandon').hidden = !g.mission.job;
    if (G.audio.ctx) { if (on) G.audio.ctx.suspend(); else G.audio.ctx.resume(); }
    if (on) { const S = G.save; $('pVol').value = S.vol ?? 0.7; $('pAmb').value = S.amb ?? 0.8; $('pMus').value = G.music.vol(); }
  },
  resume(){ this.pause(false); lock(); },
  restart(){ this.pause(false); this.fly(); },
  debrief(g, r){
    if (G.game !== g) return;
    const S = G.save; S.cash += r.cash; S.kills += r.kills; if (r.kind !== 'fail') S.wins++; G.persist(); UI.inContact = false;
    this.lastResult = r; this.lastMission = g.mission;
    const story = !!g.mission.story, op = !!g.mission.open; $('dStory').hidden = !story; $('dTest').hidden = story || op; $('dOpen').hidden = !op;
    if (document.pointerLockElement) document.exitPointerLock();
    G.HUD.show(false); this.screen('debrief'); G.music.play(r.kind === 'fail' ? 'fail' : (g.mission.winMusic || 'swingin'));
    const head = op ? (r.kind === 'fail' ? 'Shot down' : 'Back aboard') : {perfect:'Perfect', success:'Mission accomplished', fail:'Mission failed'}[r.kind];
    $('dBody').innerHTML = `<div class="d-kind ${r.kind}">${head}</div>
      <div class="d-who"><div class="avatar">${G.radioPortrait(r.mood)}</div><div><small>${esc(G.RADIO.name)} · ${esc(G.RADIO.role)}</small><p>“${esc(r.say)}”</p></div></div>
      <p class="d-then">${esc(r.then)}</p>
      <ul class="d-sides">${r.sides.map(s => `<li data-st="${s.st === 'ok' ? 'ok' : 'fail'}"><span class="st"></span>${esc(s.text)}<b>${esc(s.val)}</b></li>`).join('')}</ul>
      <div class="d-stats"><div><small>Kills</small><b>${r.kills}</b></div><div><small>Margaret</small><b>${r.shipPct}%</b></div><div><small>${op ? 'Earned' : 'Paid'}</small><b>$${(r.shown ?? r.cash).toLocaleString()}</b></div><div><small>Bank</small><b>$${S.cash.toLocaleString()}</b></div></div>`;
  }
};

/* Radio operator portrait: original flat illustration, mood changes brows and mouth (Kestrel Squadron's portrait idea). */
G.radioPortrait = (mood = 'stern') => {
  const brow = {stern:'M64 78 Q74 75 84 78 M96 78 Q106 75 116 78', pleased:'M64 77 Q74 72 84 76 M96 76 Q106 72 116 77', angry:'M64 74 Q74 77 84 81 M96 81 Q106 77 116 74'}[mood];
  const mouth = {stern:'M84 116 Q90 117 96 116', pleased:'M82 113 Q90 121 98 113', angry:'M83 118 Q90 114 97 118'}[mood];
  return `<svg viewBox="0 0 180 200" role="img" aria-label="Sparks, looking ${mood}"><rect width="180" height="200" fill="#2a2430"/>
  <path d="M0 200 L0 150 L180 120 L180 200Z" fill="#a4322a" opacity=".35"/>
  <path d="M30 200 C34 164 60 150 90 150 C120 150 146 164 150 200Z" fill="#5c4432"/><path d="M78 150 L90 172 L102 150" fill="#e9dcc0"/>
  <ellipse cx="90" cy="96" rx="32" ry="38" fill="#e2b48e"/>
  <path d="M56 92 C54 58 76 48 92 48 C116 48 128 64 124 94 C120 80 112 70 98 66 C86 74 70 76 56 92Z" fill="#1f1714"/>
  <path d="M56 92 C50 100 52 116 60 120 L62 98Z M124 94 C130 102 128 116 120 120 L118 98Z" fill="#1f1714"/>
  <rect x="44" y="84" width="10" height="26" rx="4" fill="#3b3b3b"/><rect x="126" y="84" width="10" height="26" rx="4" fill="#3b3b3b"/><path d="M49 84 C52 40 128 40 131 84" stroke="#3b3b3b" stroke-width="5" fill="none"/>
  <path d="M131 104 Q138 128 106 128" stroke="#3b3b3b" stroke-width="3" fill="none"/><circle cx="104" cy="128" r="4" fill="#3b3b3b"/>
  <ellipse cx="76" cy="90" rx="6" ry="4" fill="#fff"/><ellipse cx="104" cy="90" rx="6" ry="4" fill="#fff"/><circle cx="76" cy="90" r="2.6" fill="#3d5a7a"/><circle cx="104" cy="90" r="2.6" fill="#3d5a7a"/>
  <path d="${brow}" stroke="#1f1714" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M90 96 L87 107 L92 108" stroke="#b78463" stroke-width="2" fill="none"/>
  <path d="${mouth}" stroke="#a8323a" stroke-width="3.4" fill="none" stroke-linecap="round"/><circle cx="66" cy="104" r="5" fill="#e0867a" opacity=".3"/><circle cx="114" cy="104" r="5" fill="#e0867a" opacity=".3"/></svg>`;
};

/* ---------- 3D preview (menu and hangar) ---------- */
const preview = {
  show(canvas, L){
    if (!this.r) {
      this.r = new THREE.WebGLRenderer({antialias:true, alpha:true}); this.scene = new THREE.Scene();
      this.cam = new THREE.PerspectiveCamera(30, 16/10, 0.5, 200);
      this.scene.add(new THREE.HemisphereLight(0xf4efe6, 0x3a3226, 0.9)); const d = new THREE.DirectionalLight(0xfff0d6, 1.1); d.position.set(6, 10, 8); this.scene.add(d);
      const loop = () => { if (!this.m || !this.canvas || this.canvas.offsetParent === null) { this.idle = true; return; } requestAnimationFrame(loop); this.m.rotation.y += 0.006; for (const pr of this.m.userData.props || [this.m.userData.prop]) if (pr) pr.rotation.z += 0.5*(pr.userData.dir || 1)*(pr.userData.rate || 1); this.draw(); };
      this.loopFn = loop; loop();
    }
    this.canvas = canvas;
    if (this.idle) { this.idle = false; requestAnimationFrame(this.loopFn); }   // the spin loop stops while hidden and restarts here
    if (this.m) this.scene.remove(this.m);
    this.m = G.buildPlane(L.chassis, L.paint); this.scene.add(this.m);
    this.draw();
  },
  draw(){
    const c = this.canvas; if (!c) return; const w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
    this.r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); this.r.setSize(w, h, false);
    this.cam.aspect = w/h; this.cam.position.set(14, 6, 14); this.cam.lookAt(0, -0.3, 0.3); this.cam.updateProjectionMatrix();
    this.r.render(this.scene, this.cam);
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); c.width = this.r.domElement.width; c.height = this.r.domElement.height; ctx.drawImage(this.r.domElement, 0, 0);
  }
};

/* ---------- input ---------- */
function lock(){ try { const p = view.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
const locked = () => document.pointerLockElement === view;
let joy = {x:0, y:0, on:false};
view.addEventListener('mousedown', e => {
  const g = G.game; if (!g || g.paused || g.done) return;
  G.audio.init();
  if (g.mission.awaitDrop) { g.mission.drop(); lock(); return; }
  if (!locked()) lock();
  g.keys['Mouse' + e.button] = true; e.preventDefault();
  if (e.button === 0 && g.sight) g.dropCrate();   // the bombsight: a click lets a crate go
});
addEventListener('mouseup', e => { const g = G.game; if (g) g.keys['Mouse' + e.button] = false; });
view.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  const g = G.game; if (!g || g.paused) return;
  if (locked()) g.onMouse(e.movementX, e.movementY);
  else { joy.x = (e.clientX/innerWidth - 0.5)*2; joy.y = (e.clientY/innerHeight - 0.5)*2; joy.on = true; joy.t = performance.now(); }
});
document.addEventListener('pointerlockchange', () => { const g = G.game; if (g && !locked() && g.running && !g.paused && !g.done) UI.pause(true); });
addEventListener('keydown', e => {
  const g = G.game;
  if (e.code === 'KeyD' && e.ctrlKey && e.altKey) { e.preventDefault(); UI.inDev ? UI.closeDev() : UI.dev(); return; }
  if (UI.inDev) { if (e.code === 'Escape') UI.closeDev(); return; }
  if (e.code === 'Escape') { if (UI.inContact) { UI.closeContact(); return; } if (g && !g.done) { if (g.paused) UI.resume(); else if (!locked()) UI.pause(true); } return; }
  if (!g || g.paused) return;
  if (e.target && e.target.tagName === 'INPUT') return;
  const code = G.keymap ? G.keymap.tr(e.code) : e.code;   // remapped keys arrive as the action's default key
  if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code) || ['Space', 'ArrowUp', 'ArrowDown'].includes(code)) e.preventDefault();
  if (!code) return;
  if (code === 'KeyV') g.lookBack = true;
  if (code === 'KeyH') $('hHelp').hidden = !$('hHelp').hidden;
  if (code === 'Space' && g.mission.awaitDrop) { g.mission.drop(); lock(); return; }
  g.key(code, true);
});
addEventListener('keyup', e => { const g = G.game; if (!g) return; const code = G.keymap ? G.keymap.tr(e.code) : e.code; if (!code) return; if (code === 'KeyV') g.lookBack = false; g.key(code, false); });
addEventListener('blur', () => { const g = G.game; if (g) for (const k in g.keys) g.keys[k] = false; });

/* settings */
$('mVol').addEventListener('input', e => G.audio.setVolume(+e.target.value));
$('mMus').addEventListener('input', e => G.music.setVolume(+e.target.value));
$('mAmb').addEventListener('input', e => G.audio.setAmbient(+e.target.value));
// the same three sliders on the pause screen, kept in step with the menu's
for (const [p, m, set] of [['pVol', 'mVol', v => G.audio.setVolume(v)], ['pAmb', 'mAmb', v => G.audio.setAmbient(v)], ['pMus', 'mMus', v => G.music.setVolume(v)]])
  $(p).addEventListener('input', e => { set(+e.target.value); $(m).value = e.target.value; });
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, () => { G.music.kick(); G.audio.unlock(); }, true);   // Safari: sound starts and wakes only on a click, tap or key
$('mSens').addEventListener('input', e => { G.save.mouseSens = +e.target.value; G.persist(); });
$('mInv').addEventListener('change', e => { G.save.invert = e.target.checked; G.persist(); });
$('mAssist').addEventListener('change', e => { G.save.aimAssist = e.target.checked; G.persist(); });
$('mCall').addEventListener('keydown', e => { if (e.key === 'Enter') UI.fly(); });
// keep the callsign as it's typed: a co-op guest never presses Fly, so this is the only place theirs gets saved and sent
$('mCall').addEventListener('input', () => { const v = $('mCall').value.trim().slice(0, 18); if (!v) return; G.save.callsign = v; G.persist(); if (G.Net && G.Net.callsignChanged) G.Net.callsignChanged(); });

/* ---------- open skies: the chart table ---------- */
Object.assign(UI, {
  chartSel:null,
  travelCost(a, b){ const d = Math.hypot(a.chart[0] - b.chart[0], a.chart[1] - b.chart[1]); return {hours:Math.max(3, Math.round(d/55)), cash:Math.round(d*2/50)*50 + 100}; },
  chart(){
    for (const id in UI.CHART_AT) if (G.REGIONS[id]) G.REGIONS[id].chart = UI.CHART_AT[id];
    UI.quit(); this.screen('chart'); G.HUD.show(false); G.music.play('sidewalk');
    const S = G.save; S.mission = 'open'; UI.chartSel = null; G.persist();
    UI.renderChart();
    // the art is painted with the newspaper font: once it has loaded, repaint the cached art one time
    if (!UI._chartFont && document.fonts && document.fonts.load) { UI._chartFont = true; document.fonts.load('700 38px "Old Standard TT"').then(() => { UI._chartArt = null; UI._chartBuilt = false; if (!$('chart').hidden) UI.renderChart(); }).catch(() => {}); }
  },
  pickRegion(id){ UI.chartSel = id; UI.renderChart(); },
  /* Where each region sits on the 600 x 440 chart: laid out here, all six together, so the labels and the title cartouche don't collide */
  CHART_AT:{rustwater:[104, 152], frostback:[305, 92], halcyon:[112, 322], calavera:[292, 296], badlands:[482, 205], keys:[470, 352]},
  /* Region outlines on the 600 x 440 chart, around each region's chart position. */
  CHART_SHAPES:{
    halcyon:'M-62 -8 C-60 -44 -14 -54 24 -42 C60 -30 72 6 54 30 C32 56 -24 56 -46 36 C-62 22 -64 8 -62 -8Z',
    badlands:'M-84 -30 L-46 -58 L28 -52 L80 -24 L88 26 L44 56 L-30 52 L-80 24Z',
    frostback:'M-94 12 L-66 -28 L-36 -16 L-6 -52 L22 -22 L52 -48 L90 -8 L74 30 L-52 38Z',
    calavera:'M-46 6 C-56 -20 -40 -52 0 -54 C40 -52 56 -20 46 6 C44 14 36 18 32 24 L32 32 L28 38 L22 32 L16 38 L10 32 L4 38 L-2 32 L-8 38 L-14 32 L-20 38 L-26 32 L-30 38 L-32 32 L-32 24 C-36 18 -44 14 -46 6Z',
    rustwater:'M-58 -46 L-20 -50 L-8 -40 L6 -50 L52 -44 L60 -10 L54 28 L30 42 L10 34 L4 46 L-6 34 L-30 40 L-56 22 L-62 -12Z',
    keys:'M-74 2 C-74 -8 -50 -10 -46 0 C-44 10 -72 12 -74 2Z M-34 -28 C-34 -42 4 -42 6 -28 C6 -16 -32 -14 -34 -28Z M12 8 C12 -6 60 -8 62 8 C62 22 12 24 12 8Z M-22 32 C-22 24 2 24 2 32 C2 40 -22 40 -22 32Z M44 -34 C44 -42 62 -42 62 -34 C62 -28 44 -28 44 -34Z'
  },
  /* The chart's art is painted once onto a canvas and cached as an image: newsprint, engraved sea, rippled coasts,
     stippled land with map symbols, routes, compass rose, scale bar and the title cartouche. */
  chartArt(){
    if (UI._chartArt) return UI._chartArt;
    const W = 1200, H = 880, k = 2, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), R = G.rng(1937), ink = 'rgba(52,36,20,', paper = '#e9dcbd';
    x.fillStyle = paper; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '90,70,40' : '255,250,235'},${0.04 + R()*0.08})`; x.fillRect(R()*W, R()*H, 1 + R()*2, 1 + R()*2); }   // newsprint grain
    x.strokeStyle = ink + '.16)'; x.lineWidth = 1; for (let y = 6; y < H; y += 7) { x.beginPath(); x.moveTo(0, y); for (let xx = 0; xx <= W; xx += 40) x.lineTo(xx, y + Math.sin(xx*0.02 + y*0.13)*1.2); x.stroke(); }   // engraved sea
    const shape = (id) => { const R0 = G.REGIONS[id], p = new Path2D(), m = new DOMMatrix().translate(R0.chart[0]*k, R0.chart[1]*k).scale(k); p.addPath(new Path2D(UI.CHART_SHAPES[id]), m); return p; };
    // routes first, so the land sits on top of them
    const ids = Object.keys(G.REGIONS); x.setLineDash([3, 9]); x.lineCap = 'round'; x.strokeStyle = ink + '.55)'; x.lineWidth = 2.4;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = G.REGIONS[ids[i]].chart, b = G.REGIONS[ids[j]].chart; x.beginPath(); x.moveTo(a[0]*k, a[1]*k); x.quadraticCurveTo((a[0] + b[0])*k/2 + (b[1] - a[1])*0.25, (a[1] + b[1])*k/2 - (b[0] - a[0])*0.25, b[0]*k, b[1]*k); x.stroke(); }
    x.setLineDash([]);
    for (const id of ids) {
      const p = shape(id);
      // coastal ripples: wide ink strokes knocked back with paper, so concentric lines run round the shore
      for (let r = 6; r >= 1; r--) { x.lineWidth = r*9; x.strokeStyle = ink + (0.05 + 0.035*(6 - r)).toFixed(3) + ')'; x.stroke(p); x.lineWidth = r*9 - 3; x.strokeStyle = paper; x.stroke(p); }
      x.fillStyle = '#efe4c6'; x.fill(p);
      x.save(); x.clip(p);
      const b = G.REGIONS[id].chart, cx = b[0]*k, cy = b[1]*k;
      for (let i = 0; i < 1400; i++) { const px = cx + (R() - 0.5)*200, py = cy + (R() - 0.5)*130, d = Math.hypot(px - cx, py - cy); x.fillStyle = ink + (0.12 + 0.18*Math.min(1, d/90)) + ')'; x.beginPath(); x.arc(px, py, 0.9 + R()*0.9, 0, 7); x.fill(); }   // halftone, denser toward the coast
      x.strokeStyle = ink + '.8)'; x.lineWidth = 1.6; x.fillStyle = ink + '.8)';
      const sym = (fn, n) => { for (let i = 0; i < n; i++) { const sx = cx + (R() - 0.5)*150, sy = cy + (R() - 0.5)*80; if (x.isPointInPath(p, sx, sy)) fn(sx, sy); } };
      if (id === 'frostback') sym((sx, sy) => { x.beginPath(); x.moveTo(sx - 9, sy + 6); x.lineTo(sx, sy - 9); x.lineTo(sx + 9, sy + 6); x.stroke(); x.beginPath(); x.moveTo(sx - 3, sy - 4); x.lineTo(sx, sy - 9); x.lineTo(sx + 3, sy - 4); x.fill(); }, 26);
      if (id === 'badlands') sym((sx, sy) => { x.beginPath(); x.moveTo(sx - 10, sy + 5); x.lineTo(sx - 6, sy - 4); x.lineTo(sx + 6, sy - 4); x.lineTo(sx + 10, sy + 5); x.stroke(); for (let h = -4; h < 5; h += 3) { x.beginPath(); x.moveTo(sx - 7, sy + h); x.lineTo(sx + 7, sy + h); x.lineWidth = 0.7; x.stroke(); x.lineWidth = 1.6; } }, 20);
      if (id === 'calavera') {   // the eye sockets and nose in heavy ink, and a smoking crown
        x.fillStyle = ink + '.85)'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s*17*k, cy + 3*k, 10*k, 8*k, 0, 0, 7); x.fill(); }
        x.beginPath(); x.moveTo(cx, cy + 12*k); x.lineTo(cx - 5*k, cy + 22*k); x.lineTo(cx + 5*k, cy + 22*k); x.closePath(); x.fill();
        x.strokeStyle = ink + '.7)'; x.lineWidth = 1.4; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(cx - 6 + i*5, cy - 44*k - i*9, 5 + i*2, 0, 7); x.stroke(); }
        x.fillStyle = 'rgba(200,70,30,.55)'; x.beginPath(); x.ellipse(cx + 17*k, cy + 3*k, 6*k, 4.5*k, 0, 0, 7); x.fill();
      }
      if (id === 'keys') sym((sx, sy) => { x.beginPath(); for (let a = 0; a < 5; a++) { x.moveTo(sx, sy - 6); x.lineTo(sx + Math.cos(a*1.26 - 1.57)*7, sy - 6 + Math.sin(a*1.26 - 1.57)*5 + 3); } x.moveTo(sx, sy - 6); x.lineTo(sx + 1, sy + 4); x.stroke(); }, 30);
      if (id === 'halcyon') { sym((sx, sy) => { x.beginPath(); x.arc(sx, sy, 3, 0, 7); x.stroke(); x.beginPath(); x.moveTo(sx, sy + 3); x.lineTo(sx, sy + 7); x.stroke(); }, 22); const tx = cx + 58, ty = cy + 18; for (let i = 0; i < 6; i++) x.fillRect(tx + i*5, ty - 6 - (i % 3)*4, 3.5, 8 + (i % 3)*4); }
      x.restore();
      x.lineWidth = 2.6; x.strokeStyle = ink + '.95)'; x.stroke(p);
    }
    // compass rose
    const rx = W - 120, ry = 150; x.save(); x.translate(rx, ry);
    x.strokeStyle = ink + '.9)'; x.lineWidth = 1.4; for (const r of [62, 56, 30]) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
    for (let i = 0; i < 32; i++) { const a = i*Math.PI/16, l = i % 4 ? 4 : 9; x.beginPath(); x.moveTo(Math.cos(a)*56, Math.sin(a)*56); x.lineTo(Math.cos(a)*(56 - l), Math.sin(a)*(56 - l)); x.stroke(); }
    for (let i = 0; i < 8; i++) { const a = i*Math.PI/4 - Math.PI/2, L = i % 2 ? 34 : 54; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a - 0.22)*10, Math.sin(a - 0.22)*10); x.lineTo(Math.cos(a)*L, Math.sin(a)*L); x.closePath(); x.fillStyle = ink + '.9)'; x.fill(); x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a + 0.22)*10, Math.sin(a + 0.22)*10); x.lineTo(Math.cos(a)*L, Math.sin(a)*L); x.closePath(); x.fillStyle = paper; x.fill(); x.stroke(); }
    x.fillStyle = ink + '1)'; x.font = '700 26px "Old Standard TT", Georgia, serif'; x.textAlign = 'center'; x.fillText('N', 0, -70); x.restore();
    // scale bar
    x.save(); x.translate(W - 220, 268); for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? paper : ink + '.9)'; x.fillRect(i*50, 0, 50, 9); } x.strokeStyle = ink + '.9)'; x.lineWidth = 1.4; x.strokeRect(0, 0, 200, 9);
    x.fillStyle = ink + '1)'; x.font = '600 17px "Old Standard TT", Georgia, serif'; x.textAlign = 'center'; ['0', '50', '100', '150', '200'].forEach((t, i) => x.fillText(t, i*50, -8)); x.fillText('MILES BY AIRSHIP', 100, 32); x.restore();
    // title cartouche
    x.save(); x.translate(40, 34); x.fillStyle = 'rgba(239,228,198,.92)'; x.fillRect(0, 0, 430, 112); x.strokeStyle = ink + '.95)'; x.lineWidth = 3; x.strokeRect(0, 0, 430, 112); x.lineWidth = 1; x.strokeRect(7, 7, 416, 98);
    x.fillStyle = ink + '1)'; x.textAlign = 'center'; x.font = '700 15px "Old Standard TT", Georgia, serif'; x.fillText('THE  HALCYON  GAZETTE  ·  AVIATION  SUPPLEMENT', 215, 32);
    { let fs = 38; const T = 'CHART of the SIERRA COAST'; do { x.font = `700 ${fs}px "Old Standard TT", Georgia, serif`; } while (x.measureText(T).width > 396 && --fs > 18); x.fillText(T, 215, 72); } { let fs = 16; const T = 'with the principal airfields, skyhooks & sea-lanes · 1937'; do { x.font = `italic ${fs}px "Old Standard TT", Georgia, serif`; } while (x.measureText(T).width > 400 && --fs > 10); } x.fillText('with the principal airfields, skyhooks & sea-lanes · 1937', 215, 96); x.restore();
    // fold creases and a coffee ring, for wear
    x.strokeStyle = 'rgba(80,60,30,.12)'; x.lineWidth = 2; x.beginPath(); x.moveTo(W/2, 0); x.lineTo(W/2, H); x.moveTo(0, H/2); x.lineTo(W, H/2); x.stroke();
    x.strokeStyle = 'rgba(120,80,30,.10)'; x.lineWidth = 9; x.beginPath(); x.arc(W - 230, H - 150, 62, 0.3, 5.6); x.stroke();
    const vg = x.createRadialGradient(W/2, H/2, H*0.35, W/2, H/2, H*0.85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(70,45,15,.28)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
    return (UI._chartArt = c.toDataURL('image/jpeg', 0.86));
  },
  renderChart(){
    for (const id in UI.CHART_AT) if (G.REGIONS[id]) G.REGIONS[id].chart = UI.CHART_AT[id];
    const S = G.save, O = S.open, here = G.REGIONS[O.region], sel = G.REGIONS[UI.chartSel] || here;
    if (!UI._chartBuilt) {
      // the static layer: the painted art plus one hit-path and label per region (built once)
      $('cImg').src = UI.chartArt(); let svg = '';   // the painted art is a plain image under a light SVG layer
      for (const R of Object.values(G.REGIONS)) {
        const ly = {frostback:56, keys:54, calavera:58, halcyon:70, rustwater:66, badlands:70}[R.id] || 72;
        svg += `<g class="rg" data-id="${R.id}" transform="translate(${R.chart[0]} ${R.chart[1]})" onclick="UI.pickRegion('${R.id}')"><path class="hit" d="${UI.CHART_SHAPES[R.id]}"/>
          <text class="rn" y="${ly}" text-anchor="middle">${esc(R.name.toUpperCase())}</text><text class="rs" y="${ly + 14}" text-anchor="middle">${esc(R.nation)}</text><text class="rt" y="${ly + 27}" text-anchor="middle"></text></g>`;
      }
      svg += `<g id="cShip"><path d="M-22 0 C-22 -8 16 -9 22 -2 C24 0 24 1 22 2 C16 9 -22 8 -22 0Z" fill="#efe4c6" stroke="#2a1d10" stroke-width="1.6"/><path d="M-22 0 L-30 -6 L-30 6Z" fill="#2a1d10"/><path d="M-8 0 L14 0" stroke="#2a1d10" stroke-width=".8"/><rect x="-7" y="6" width="12" height="4" fill="#2a1d10"/><text y="-14" text-anchor="middle" class="rs" style="font-weight:700">LUCKY MARGARET</text></g>`;
      $('cMap').innerHTML = svg; UI._chartBuilt = true;
    }
    // the moving parts: selection, the Margaret, treasure tallies
    for (const g of $('cMap').querySelectorAll('.rg')) { const R = G.REGIONS[g.dataset.id]; g.classList.toggle('sel', R === sel); g.classList.toggle('here', R === here); g.querySelector('.rt').textContent = `treasure ${R.treasures.filter(t => O.found[t.id]).length}/${R.treasures.length}` + (((O.passTotal || {})[R.id] || (R.tunnels || []).length + (R.cavern ? 1 : 0)) ? ` · tunnels ${Object.keys(O.flown || {}).filter(k => k.startsWith(R.id + ':')).length}/${(O.passTotal || {})[R.id] || (R.tunnels || []).length + (R.cavern ? 1 : 0)}` : ''); }
    $('cShip').setAttribute('transform', `translate(${here.chart[0] + 66} ${here.chart[1] - 26})`);
    const sites = sel.sites.filter(s => s.contact), jobsFor = cid => G.JOBS.filter(j => j.contact === cid && (!G.jobOpen || G.jobOpen(j)));
    const night = G.timeOfDay() === 'night', move = sel !== here ? UI.travelCost(here, sel) : null;
    const head = {halcyon:'HOME WATERS QUIET; CAFÉ DOES BRISK TRADE', badlands:'BANDITS PLAGUE RED MESA; RACE PURSES SWELL', frostback:'MAIL GETS THROUGH DESPITE SNOW', keys:'NAVY HELPLESS AS CORSAIRS RULE THE KEYS', calavera:'PIRATE BRETHREN DENY "KING" RUMOURS; VOLCANO RUMBLES', rustwater:'GHOST PLANES OVER GANTRY? CITY HALL SAYS NONSENSE'}[sel.id];
    $('cSide').innerHTML = `<div class="np-mast"><span>Day ${O.day}</span><b>THE CHART TABLE</b><span>${esc(G.timeLabel())}</span></div>
      <div class="np-kick">${esc(sel.nation)}${sel === here ? ' · the Margaret is here' : ''}</div><h3 class="np-h">${esc(sel.name)}</h3><div class="np-sub">${esc(head)}</div>
      <p class="np-body">${esc(sel.blurb)}</p>
      <div class="np-rule">Who's who</div>
      <ul class="np-list">${sites.map(s => { const C = G.CONTACTS[s.contact], js = jobsFor(s.contact), done = js.filter(j => (O.jobs[j.id] || {}).done).length, nj = js.filter(j => j.night).length;
        return `<li><b>${esc(C.name)}</b><span>${esc(s.name)}, ${s.kind === 'hook' ? 'by skyhook' : 'airfield'}. ${C.local ? 'Gossip, rumours and free repairs.' : `${done} of ${js.length} jobs done${nj ? `, ${nj} after dark` : ''}.`}</span></li>`; }).join('')}
        <li><b>Treasure</b><span>${sel.treasures.filter(t => O.found[t.id]).length} of ${sel.treasures.length} found.</span></li>
        <li><b>Bandits</b><span>${esc((sel.danger > 0.5 ? 'Plenty of ' : sel.danger > 0.3 ? 'Some ' : 'A few ') + ({tigers:'Paper Tigers', rattlers:'Rattlesnake Gang', wolves:'Frost Wolves', corsairs:'Corsairs', brethren:'Brethren of the Black Flag'}[sel.gang] || 'pirates'))}${night ? ', more at night' : ''}.</span></li>
        <li><b>Job board</b><span>${(() => { const open = sites.filter(s => !G.CONTACTS[s.contact].local).flatMap(s => jobsFor(s.contact)).filter(j => !(O.jobs[j.id] || {}).done); return open.length ? `${open.length} unfinished: ${open.slice(0, 5).map(j => `${esc(j.title)} ($${j.pay.toLocaleString()})`).join(', ')}${open.length > 5 ? '…' : ''}. Take any of them from any stop's board.` : 'Every job here is done; the regulars still pay for repeats.'; })()}</span></li>
        <li><b>Stunts</b><span>${O.stuntTotal.toLocaleString()} points all told; best chain ${O.stuntBest.toLocaleString()}.</span></li></ul>
      <div class="np-foot"><span>Kitty <b>$${S.cash.toLocaleString()}</b></span>
        ${move ? `<button class="btn sm" ${S.cash < move.cash ? 'disabled' : ''} onclick="UI.travel('${sel.id}')">Sail here · ${move.hours} h · $${move.cash}</button>` : `<button class="btn ghost sm" onclick="UI.wait()">${night ? 'Wait until morning' : G.timeOfDay() === 'evening' ? 'Wait until night' : 'Wait until dusk'}</button>`}</div>
      <label class="chk"><input type="checkbox" ${O.wing ? 'checked' : ''} onchange="UI.setWing(this.checked)"> Bring Dutch, Hellcat and Doc along</label>`;
    $('cFly').disabled = sel !== here; $('cFly').textContent = sel === here ? 'Launch' : 'Sail there first';
  },
  travel(id){
    const S = G.save, O = S.open, a = G.REGIONS[O.region], b = G.REGIONS[id], c = UI.travelCost(a, b); if (S.cash < c.cash) return;
    S.cash -= c.cash; O.region = id; G.advanceHours(c.hours); UI.chartSel = null; G.persist(); UI.renderChart();
  },
  wait(){ const O = G.save.open, t = G.timeOfDay(); const to = t === 'night' ? 8 : t === 'evening' ? 21 : 18; let h = (to - O.hour + 24) % 24 || 24; G.advanceHours(h); UI.renderChart(); },
  setWing(on){ G.save.open.wing = on; G.persist(); },

  /* ---------- meeting a contact ---------- */
  contact(O, site){
    UI.inContact = true; UI.O = O; UI.site = site;
    if (document.pointerLockElement) document.exitPointerLock();
    this.screen('contact'); UI.renderContact();
  },
  renderContact(){
    const O = UI.O, info = O.offer(UI.site), C = info.C, S = G.save;
    const kind = {race:'Race', stunt:'Stunt show', errand:'Delivery', bounty:'Bounty'};
    const jobHtml = ({def, rec, lock, C:from, at}) => `<div class="job ${lock ? 'locked' : ''}"><div class="jt"><b>${esc(def.title)}</b>${from ? `<span class="ty">for ${esc(from.name.replace(/".*" /, ''))} · ${esc(at.name)}</span>` : ''}<span class="ty">${def.night ? 'Night · ' : ''}${kind[def.type]}${def.type === 'errand' && def.legs.some(l => l.how === 'drop') ? ' · airdrop' : ''}${def.lights ? ' · smuggling' : ''}</span></div>
      <p>${esc(def.blurb)}</p><div class="jf"><span>Pays <b>$${def.pay.toLocaleString()}</b>${def.reward && !rec.done ? ` + ${esc(UI.rewardText(def.reward))}` : ''}${rec.done ? ` · done ×${rec.done}` : ''}${rec.medal ? ` · <span class="medal ${rec.medal}">${rec.medal.toUpperCase()}</span>` : ''}${rec.best !== undefined && def.type === 'race' ? ` · best ${UI.fmtT(rec.best)}` : ''}</span>
      ${lock ? `<span>${esc(lock)}</span>` : `<button class="btn sm" onclick="UI.takeJob('${def.id}')">Take the job</button>`}</div></div>`;
    const jobs = info.jobs.map(jobHtml).join('') || '<p class="note">No work today.</p>';
    if (UI.ctTab === 'board') {
      const B = O.board(UI.site), open = B.filter(j => !j.lock || j.lock === 'After dark'), list = B.map(jobHtml).join('') || '<p class="note">The board is bare.</p>';
      $('ctBody').innerHTML = `<div class="kicker">${esc(UI.site.name)} · ${esc(G.timeLabel())}</div><h3 class="deco" style="font-size:30px;margin:4px 0">The Job Board</h3>
        <p class="note">Notices pinned up by everyone flying work in ${esc(O.R.name)}. Take one here and fly straight to it; the pay is the same as asking in person. ${open.length} open.</p>
        ${O.job ? `<p class="note">You're on a job: <b>${esc(O.job.def.title)}</b>.</p>` : ''}<div class="board">${list}</div>
        <div class="row"><button class="btn ghost" onclick="UI.ctTab=null;UI.renderContact()">Back to ${esc(C.name.split(' ')[0].replace(/"/g, ''))}</button><button class="btn" onclick="UI.closeContact()">${UI.site.kind === 'hook' ? 'Drop off the hook' : 'Back to the plane'}</button></div>`;
      return;
    }
    const shop = info.shop.length ? info.shop.map(it => `<div class="shop"><b>${esc(it.name)}</b>${it.owned ? '<em class="note" style="margin:0">Owned</em>' : `<button class="btn sm" ${S.cash < it.price ? 'disabled' : ''} onclick="UI.buy('${it.kind}','${it.id}',${it.price})">$${it.price.toLocaleString()}</button>`}<span>${esc(it.desc)}</span></div>`).join('') : '<p class="note">Nothing for sale here.</p>';
    const rum = info.rumors.length ? info.rumors.slice(0, 2).map(r => `<p class="rumor">${esc(r)}</p>`).join('') : '<p class="note">"Treasure? You\'ve found it all, chéri. Leave some for the rest of us."</p>';
    $('ctBody').innerHTML = `<div class="ct-top"><div>${G.portrait(C.look)}</div><div><small>${esc(C.role)} · ${esc(UI.site.name)} · ${esc(G.timeLabel())}</small><h3>${esc(C.name)}</h3><p>“${esc(UI.hello || (UI.hello = info.hello))}”</p></div></div>
      <div class="ct-cols"><div>${C.club ? UI.barHtml(info) : ''}${C.local ? `<h4>Gossip</h4><p class="rumor">“${esc(info.gossip)}”</p>${O.patched ? '<p class="note">The town mechanic patched your plane and refilled your guns. No charge.</p>' : ''}` : `<h4>Work</h4>${O.job ? `<p class="note">You're on a job: <b>${esc(O.job.def.title)}</b>.</p>` : ''}${jobs}`}</div>
        <div><h4>For sale · bank $${S.cash.toLocaleString()}</h4>${shop}<h4 style="margin-top:14px">Word around here</h4>${rum}</div></div>
      <div class="row"><button class="btn ghost" onclick="UI.ctTab='board';UI.renderContact()">Job board</button><button class="btn" onclick="UI.closeContact()">${UI.site.kind === 'hook' ? 'Drop off the hook' : 'Back to the plane'}</button></div>`;
  },
  rewardText(rw){ const o = []; if (rw.livery) o.push(`${G.LIVERIES[rw.livery].name} paint`); if (rw.chassis) o.push(`a ${G.CHASSIS[rw.chassis].name}`); if (rw.mod) o.push(G.MODS[rw.mod].name); return o.join(' and '); },
  fmtT(t){ const m = Math.floor(t/60), s = t - m*60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; },
  takeJob(id){ UI.O.accept(id); UI.closeContact(); },
  fight(){ UI.O.acceptDuel(UI.site.contact); UI.closeContact(); },
  barHtml(info){
    const cid = UI.site.contact, a = G.aceFor(cid), beaten = (G.ACES[cid] || []).filter(x => (G.save.open.jobs['duel_' + x.id] || {}).done);
    const ch = a ? G.CHASSIS[a.chassis] : null;
    return `<h4>At the bar</h4>${a ? `<div class="job"><div class="jt"><b>${esc(a.name)}</b><span class="ty">Duel · ${esc(ch.name)}</span></div><p>“${esc(a.line)}”</p>
      <div class="jf"><span>Purse <b>$${a.purse.toLocaleString()}</b> · guns and rockets, one on one, no wingmen</span>${UI.O.job ? '<span>Finish your job first</span>' : '<button class="btn sm" onclick="UI.fight()">Pick a fight</button>'}</div></div>`
      : '<p class="note">Nobody here will fly against you any more. They just buy you drinks.</p>'}${beaten.length ? `<p class="note">Beaten here: ${beaten.map(x => esc(x.name)).join(', ')}</p>` : ''}`;
  },
  buy(kind, id, price){ if (UI.O.buy(kind, id, price)) { if (G.audio) G.audio.ding(); UI.renderContact(); } },
  closeContact(){ if (!UI.inContact) return; UI.inContact = false; UI.ctTab = null; UI.hello = null; this.screen(null); const O = UI.O; UI.O = null; O.leave(); lock(); },
  abandonJob(){ const g = G.game; if (g && g.mission.job) g.mission.abandon(); UI.resume(); },
  returnHome(){ const g = G.game; if (!g) return; this.pause(false); g.mission.finish(); }
});

/* Contact portraits: original flat illustrations from a few traits (skin, hair, hat, glasses, moustache). */
G.portrait = (L = {}) => {
  const hat = {
    cowboy:'<path d="M34 74 Q90 60 146 74 Q130 80 90 78 Q50 80 34 74Z" fill="#7a5a38"/><path d="M58 72 C58 40 122 40 122 72Z" fill="#8a6a44"/><rect x="58" y="64" width="64" height="5" fill="#3a2418"/>',
    cap:'<path d="M54 76 C54 46 126 46 126 76Z" fill="#4a5a3a"/><path d="M54 74 Q40 78 34 84 L66 80Z" fill="#3a4a2a"/>',
    beret:'<ellipse cx="96" cy="58" rx="40" ry="13" fill="#1f1714"/><circle cx="96" cy="46" r="3" fill="#1f1714"/>',
    bowler:'<ellipse cx="90" cy="66" rx="46" ry="7" fill="#1f1714"/><path d="M60 66 C60 34 120 34 120 66Z" fill="#26221f"/>',
    naval:'<path d="M54 70 L58 48 L122 48 L126 70Z" fill="#f1e9d6"/><rect x="54" y="66" width="72" height="8" fill="#1f2a44"/><path d="M52 74 Q90 84 128 74 L120 80 Q90 86 60 80Z" fill="#111"/><circle cx="90" cy="60" r="5" fill="#dba63e"/>',
    tricorn:'<path d="M30 70 Q90 40 150 70 Q120 62 90 66 Q60 62 30 70Z" fill="#1a1414"/><path d="M52 68 C56 36 124 36 128 68Z" fill="#221a1a"/><path d="M30 70 Q90 84 150 70" stroke="#b88a2a" stroke-width="2" fill="none"/><path d="M84 50 L96 50 L90 60Z" fill="#e8e0cc"/>',
    scarf:'<path d="M54 80 C50 44 130 44 126 80 C112 66 70 66 54 80Z" fill="#d94f4f"/><path d="M124 74 L138 96 L128 98Z" fill="#d94f4f"/>',
    none:''}[L.hat || 'none'];
  const hair = L.hair || '#3a2a1a', skin = L.skin || '#e2b48e', coat = L.coat || '#3a3a44';
  return `<svg viewBox="0 0 180 200" role="img" aria-label="Portrait"><rect width="180" height="200" fill="#2a2430"/><path d="M0 200 L0 150 L180 120 L180 200Z" fill="#d9a441" opacity=".18"/>
  <path d="M30 200 C34 164 60 150 90 150 C120 150 146 164 150 200Z" fill="${coat}"/><path d="M80 150 L90 168 L100 150" fill="#e9dcc0"/>
  ${L.pearls ? '<path d="M70 156 Q90 172 110 156" stroke="#f1f1f1" stroke-width="4" stroke-dasharray="1 4" stroke-linecap="round" fill="none"/>' : ''}
  <ellipse cx="90" cy="98" rx="31" ry="37" fill="${skin}"/>
  <path d="M58 92 C56 62 76 54 92 54 C114 54 126 66 122 94 C118 82 110 74 96 72 C84 78 70 80 58 92Z" fill="${hair}"/>
  ${L.lips ? `<path d="M58 92 C50 110 54 128 62 134 L64 100Z M122 94 C130 110 126 128 118 134 L116 100Z" fill="${hair}"/>` : ''}
  <ellipse cx="77" cy="94" rx="5.5" ry="3.8" fill="#fff"/><ellipse cx="103" cy="94" rx="5.5" ry="3.8" fill="#fff"/><circle cx="77" cy="94" r="2.5" fill="#3d3a32"/><circle cx="103" cy="94" r="2.5" fill="#3d3a32"/>
  ${L.glasses ? '<circle cx="77" cy="94" r="9" fill="none" stroke="#2a2420" stroke-width="2"/><circle cx="103" cy="94" r="9" fill="none" stroke="#2a2420" stroke-width="2"/><path d="M86 94 L94 94" stroke="#2a2420" stroke-width="2"/>' : ''}
  <path d="M66 84 Q76 80 85 84 M95 84 Q104 80 114 84" stroke="#2a1d14" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <path d="M90 98 L87 109 L92 110" stroke="#9a6a4a" stroke-width="2" fill="none"/>
  ${L.tache ? `<path d="M76 116 Q90 110 104 116 Q96 120 90 116 Q84 120 76 116Z" fill="${L.hair && L.hair !== '#e8d890' ? L.hair : '#5a4030'}"/>` : ''}
  <path d="M82 121 Q90 ${L.lips ? 127 : 124} 98 121" stroke="${L.lips ? '#a8323a' : '#7a4a3a'}" stroke-width="${L.lips ? 3.6 : 2.6}" fill="none" stroke-linecap="round"/>
  ${L.earring ? '<circle cx="60" cy="112" r="3.5" fill="none" stroke="#dba63e" stroke-width="2"/>' : ''}
  ${hat}</svg>`;
};

/* ---------- developer panel: Ctrl+Alt+D anywhere ---------- */
G.dev = {god:false, ammo:false, solo:false};
Object.assign(UI, {
  dev(){
    UI.inDev = true; const g = G.game;
    if (g && !g.paused) { g.paused = true; UI.devPaused = true; if (G.audio.ctx) G.audio.ctx.suspend(); }
    if (document.pointerLockElement) document.exitPointerLock();
    $('dev').hidden = false; UI.renderDev();
  },
  closeDev(){
    UI.inDev = false; $('dev').hidden = true; const g = G.game;
    if (g && UI.devPaused) { UI.devPaused = false; if (!UI.inContact && $('pause').hidden) { g.paused = false; if (G.audio.ctx) G.audio.ctx.resume(); if (g.running) lock(); } }
    if (!g && !$('chart').hidden) UI.renderChart(); else if (!g && !$('menu').hidden) UI.menu(); else if (!g && !$('hangar').hidden) UI.hangar();
  },
  devDo(fn){ try { fn(); } catch (e) { console.error(e); G.HUD.toast('Dev: ' + e.message); } G.persist(); UI.renderDev(); },
  renderDev(){
    const S = G.save, O = S.open, g = G.game, M = g && g.mission, b = (label, js, on) => `<button class="d ${on ? 'on' : ''}" onclick="UI.devDo(()=>{${js}})">${esc(label)}</button>`;
    const ch = Object.values(G.CHASSIS).map(c => b(c.name + (S.load.chassis === c.id ? ' ✓' : ''), `UI.devPlane('${c.id}')`, S.load.chassis === c.id)).join('');
    const tests = Object.values(G.MISSIONS).filter(m => !m.story && !m.open).map(m => b(m.title, `UI.devFly('${m.id}')`)).join('');
    const missions = Object.values(G.MISSIONS).filter(m => !m.open && m.story).map(m => {
      const st = G.STORY && G.STORY[m.id], tag = st ? `${G.chapterOf(m.id).split(':')[0]} · ep ${st.n}` : 'Test flight';
      return `<b>${esc(m.title)}</b><button class="d" onclick="UI.devFly('${m.id}')">Fly</button>${st ? `<button class="d" onclick="UI.devDo(()=>{G.save.story.node='${m.id}';G.save.mission='story'})">Set story</button>` : '<span></span>'}<span style="grid-column:1/-1;margin-top:-3px">${esc(tag)} · ${esc(m.place || '')}</span>`;
    }).join('');
    const regs = Object.values(G.REGIONS).map(R => b(R.name, `G.save.open.region='${R.id}'`, O.region === R.id)).join('');
    const times = [['Morning', 9], ['Afternoon', 14], ['Dusk', 18], ['Night', 22]].map(([n, h]) => b(n, `G.save.open.hour=${h}`, O.hour === h)).join('');
    const flight = g ? `<section><h4>This flight · ${esc(M.open ? G.REGIONS[O.region].name : M.title)}</h4><div class="bt">
        ${b('Win now', 'UI.devWin(true)')}${b('Fail now', 'UI.devWin(false)')}${b('Repair & rearm', 'UI.devRepair()')}
        ${M.open ? b('Spawn bandits', 'UI.devBandits()') + b('Finish job: gold', "const m=G.game.mission;if(m.job)m.finishJob({win:true,medal:'gold',time:60})") + b('+5,000 stunt pts', 'const m=G.game.mission;m.award(5000,"DEV");m.bank()') : ''}
        ${b('Teleport to Margaret', 'const g=G.game,P=g.player;P.onGround=false;P.frozen=false;P.pos.copy(g.ships[0].pos).add(new THREE.Vector3(0,-80,-200));P.speed=60')}</div></section>` : '';
    $('devBody').innerHTML = `<h2>Developer table</h2><div class="note">Ctrl+Alt+D or Esc to close. Bank $${S.cash.toLocaleString()} · ${G.save.owned.length} chassis · ${(S.mods || []).length} mods · ${(S.liveries || []).length} liveries</div>
      <div class="dg">
        <section><h4>Cheats</h4><div class="bt">${b('God mode', 'G.dev.god=!G.dev.god', G.dev.god)}${b('Infinite ammo', 'G.dev.ammo=!G.dev.ammo', G.dev.ammo)}${b('No wingmen', 'G.dev.solo=!G.dev.solo', G.dev.solo)}
          ${b('+$10,000', 'G.save.cash+=10000')}${b('+$100,000', 'G.save.cash+=100000')}${b('Unlock everything', 'UI.devUnlock()')}
          ${b('All treasure found', "for(const R of Object.values(G.REGIONS))for(const t of R.treasures)G.save.open.found[t.id]={t:Date.now()}")}${b('Reset treasure', 'G.save.open.found={}')}
          ${b('Reset job records', 'G.save.open.jobs={}')}${b('+25,000 stunt total', "G.save.open.stuntTotal+=25000")}${b('Wipe save', "if(confirm('Wipe the whole save?')){G.resetSave();UI.closeDev();UI.menu()}")}</div></section>
        <section><h4>Fly any craft <em style="font-style:normal;color:var(--dim);letter-spacing:0;text-transform:none">stock loadout</em></h4><div class="bt">${ch}</div>
          <h4 style="margin-top:12px">Open skies</h4><div class="bt">${regs}</div><div class="bt" style="margin-top:6px">${times}</div>
          <div class="bt" style="margin-top:6px"><button class="d" onclick="UI.devFly('open')">Fly open skies here</button><button class="d" onclick="UI.closeDev();UI.chart()">Chart table</button></div></section>
        <section><h4>Test flights</h4><div class="bt">${tests}</div></section>
        <section><h4>Any story mission</h4><div class="ml">${missions}</div></section>
        ${flight}
      </div>`;
  },
  devBandits(){ const g = G.game, m = g.mission, P = g.player; m.bandits = m.gang(m.R.gang, P.pos.clone().addScaledVector(P.fwd, 1200).add(new THREE.Vector3(0, 100, 0)), 3); },
  devPlane(id){ const S = G.save; if (!S.owned.includes(id)) S.owned.push(id); const p = S.load.chassis === id ? S.load.paint : null; S.load = G.stockLoadout(id); if (p) S.load.paint = p; },
  devUnlock(){ const S = G.save; S.owned = Object.keys(G.CHASSIS); S.mods = Object.keys(G.MODS); S.liveries = Object.keys(G.LIVERIES); },
  devFly(id){ G.persist(); UI.inDev = false; $('dev').hidden = true; UI.devPaused = false; G.save.mission = id; G.persist(); UI.fly(); },
  devRepair(){ const P = G.game.player; P.internal = P.internalMax; P.armor = P.armorMax.slice(); P.repairParts(); for (const gn of P.guns) gn.rounds = gn.def.ammo; P.rockets = P.L.hp*3; P.engineDead = false; },
  devWin(win){
    const g = G.game, m = g.mission; if (g.done) return;
    if (m.open) { if (m.job) m.finishJob(win ? {win:true, medal:'gold', time:60} : {win:false, note:'Dev'}); else m.finish(); }
    else { m.ended = true; g.end(Object.assign(m.result(g, win ? 'perfect' : 'fail'), {delay:300})); }
    UI.closeDev();
  }
});
window.UI = UI;

/* ---------- frame loop ---------- */
let last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last)/1000); last = now;
  const g = G.game; if (!g) return;
  try {
    // without pointer lock the mouse works as a joystick: distance from centre turns the aim point
    if (G.pad) G.pad.poll(g, dt, now);
    // the mouse-as-joystick only steers if the mouse was moved after the controller was last touched: a cursor left below centre while flying on the pad dived the plane once the pad went quiet
    if (!locked() && joy.on && g.running && !g.paused && !(G.pad && (G.pad.active || (joy.t || 0) < G.pad.lastUsed))) { const dz = v => Math.abs(v) < 0.08 ? 0 : (v - Math.sign(v)*0.08)/0.92; g.onMouse(dz(joy.x)*900*dt, dz(joy.y)*700*dt); }
    g.update(dt); g.render();
  } catch (e) { console.error('Ace of the Airways frame error', e); if (!frame.warned) { frame.warned = true; G.HUD.toast('Something went wrong: ' + e.message); } }
}
requestAnimationFrame(frame);
UI.menu();
})();
