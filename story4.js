(function(){
'use strict';
/* =====================================================================
   VOLUME IV: "Ghost Squadron", in Rustwater Valley.
   Planes with empty cockpits are attacking Gantry City. They're radio-controlled, flown from the WGCX tower and from an
   airship called the Conductor by Dr. Lucan Ashgrove, Augustin Hollis's old partner, who sells "ghosts" to anyone who
   pays. Volume III carries over: if Kroll got away, he's Ashgrove's backer; if you caught him, Ashgrove tries to break
   him out of Gantry Island prison.

   Chapter 10: Smoke and Mirrors. Chapter 11: The Iron Strike. Chapter 12: Ghost Squadron.
   ===================================================================== */
const G = window.G, V3 = THREE.Vector3, Q = THREE.Quaternion, Z = new V3(0, 0, 1), RU = G.RUST;
const tA = new V3(), tB = new V3();
const {H3, EP, RES, strafe, beaten, fmtD, world, ground, flags} = G.STORY_KIT3;
const YD = 1.0936, MPH = 0.44704, PI = Math.PI;
const SPARKS = () => G.RADIO.short, CAP = () => G.CAPTAIN.short, ASH = 'Ashgrove', DELLA = 'Della', STAN = 'Big Stan', STRAND = 'Capt. Strand';
const GHOST = [[0xd8dde2, 0x2a3238, 0x9ef0e0], [0xc8ced4, 0x1a2228, 0x9ef0e0], [0xe0e4e8, 0x3a4248, 0x7ad8c8]];
G.GANGS.ghosts = {name:'the ghost squadron', paints:GHOST};
const CONDUCTOR = {hull:0x2a3238, band:0x9ef0e0, trim:0xd8dde2};

/* ---------- ghosts: radio-flown planes that lose their wits when the signal does ---------- */
// a transmitter: where the signal comes from, how far it reaches, and how strong it is (the share of aerials still standing)
const tx = (pos, range, aerials) => ({pos, range, aerials:aerials || [], strength(){ return this.aerials.length ? this.aerials.filter(a => a.alive).length/this.aerials.length : this.dead ? 0 : 1; }});
const GH = {
  spawn(m, g, at, n, o = {}){
    const ps = m.foes(g, 'ghosts', at, n, Object.assign({skill:0.9}, o));
    for (const p of ps) { p.ghost = true; p.tx = o.tx || m.tx; p.name = p.callsign = 'Ghost'; const pl = g.pilots.find(x => x.p === p); if (pl) { pl.baseSkill = pl.skill = 0.92; if (o.target) pl.target = o.target; } }
    return ps;
  },
  tick(m, g, dt){
    for (const p of g.planes) {
      if (!p.alive || !p.ghost) continue;
      const T = p.tx, s = T ? T.strength() : 0, inRange = T && s > 0 && p.pos.distanceTo(T.pos) < T.range;
      if (!inRange) {
        // the signal's gone: the ghost flies on, then falls off into a lazy spiral nobody's steering
        if (!p.lost) { p.lost = {pl:g.pilots.find(x => x.p === p), t:0}; g.pilots = g.pilots.filter(x => x.p !== p); p.fire = false; p.fireRk = false; }
        p.lost.t += dt; p.throttle = 0.55; p.ctrl.pitch = p.lost.t > 2 ? -0.25 : 0; p.ctrl.roll = p.lost.t > 2 ? 0.45 : 0; p.ctrl.yaw = 0;
      } else {
        if (p.lost) { if (p.lost.pl) g.pilots.push(p.lost.pl); p.lost = null; }
        const pl = g.pilots.find(x => x.p === p); if (pl) pl.skill = (pl.baseSkill || 0.92)*(0.35 + 0.65*s);
      }
    }
  },
  killed(m, g, p){ if (p.ghost && !m.emptySaid) { m.emptySaid = true; setTimeout(() => { if (G.game === g) G.HUD.radio(SPARKS(), 'I saw that one break up... sugar, there was nobody in it. The cockpit was empty!'); }, 1200); } }
};
const ghostsLeft = g => g.planes.filter(p => p.alive && p.ghost && !p.lost).length;

/* ---------- small things only this volume needs ---------- */
function truck(color){
  const k = new G.KIT.Kit(), {box, cyl, T, RZ, mul} = G.KIT, gr = new THREE.Group(), m = c => G.mat(c, {roughness:0.8});
  k.add(box(2.4, 2.2, 2.6), m(color), T(0, 1.8, 3.3)); k.add(box(2.2, 1.2, 1.6), m(0x2a2a2a), T(0, 1.4, 5.2)); k.add(box(2.6, 2.6, 6.6), m(0x6a5a3a), T(0, 2.2, -1.2));
  for (const z of [4.6, -0.2, -3]) for (const s of [1, -1]) k.add(cyl(0.55, 0.55, 0.35, 8), m(0x1a1a1a), mul(T(s*1.15, 0.55, z), RZ(PI/2)));
  k.add(box(2.4, 0.5, 0.2), m(0xe8e0cc), T(0, 3.1, 2.0)); k.build(gr); return gr;
}
/* the convoy: lorries following a road (a list of points with heights), stopping when they must */
class Convoy {
  constructor(g, pts, n, speed){
    this.g = g; this.pts = pts; let s = 0; pts.forEach((q, i) => { if (i) s += Math.hypot(q.x - pts[i - 1].x, q.z - pts[i - 1].z); q.s = s; }); this.len = s;
    this.s = 40 + (n - 1)*15; this.speed = speed; this.hp = 100; this.alive = true; this.done = false; this.stop = false;
    this.cars = []; for (let i = 0; i < n; i++) { const gr = truck(i % 2 ? 0x2f5d8a : 0x9e1b1b); g.scene.add(gr); this.cars.push({gr, off:-i*15}); }
    this.pos = new V3(); this.update(0);
  }
  at(d, out){ d = Math.max(0, Math.min(this.len, d)); const P = this.pts; let lo = 0, hi = P.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s < d) lo = m; else hi = m; } const a = P[lo], b = P[hi], t = (d - a.s)/Math.max(0.01, b.s - a.s); return out.set(a.x + (b.x - a.x)*t, a.y + (b.y - a.y)*t, a.z + (b.z - a.z)*t); }
  update(dt){
    if (this.alive && !this.done && !this.stop) this.s += this.speed*dt;
    if (this.s >= this.len - 5) this.done = true;
    for (const c of this.cars) { const a = this.at(this.s + c.off, tA), b = this.at(this.s + c.off + 3, tB); c.gr.position.copy(a); c.gr.rotation.set(-Math.atan2(b.y - a.y, 3), Math.atan2(b.x - a.x, b.z - a.z), this.alive ? 0 : 0.4); }
    this.pos.copy(this.cars[0].gr.position);
    if (this.alive && this.hp < 50 && Math.random() < dt*4) { const c = G.pick(this.cars).gr.position; this.g.fx.fire.emit(c.x, c.y + 3, c.z, 0, 3, 0, 2.4, 0.4, 0.3, 0.3, 0.3, 0.8, 0, 1, 1); }
  }
  damage(d){ if (!this.alive) return; this.hp = Math.max(0, this.hp - d); if (!this.hp) { this.alive = false; for (const c of this.cars) this.g.fx.explosion(c.gr.position.clone().add(new V3(0, 2, 0)), 1.6); } }
}

/* ---------- the shared start for every Rustwater episode ---------- */
const H4 = Object.assign({}, H3, {
  region:'rustwater',
  begin(g, line, o = {}){
    this.start(g, line, o);
    this.scene.noPolice = !this.police;
    // the Margaret comes in from downriver, a short hop from the action
    if (o.near) { const N = typeof o.near === 'string' ? this.P[o.near] : o.near; this.ship.pos.set(RU.rx(N.z - 1800), 720, N.z - 1800); this.ship.dest = N.clone(); this.ship.turn0 = 0.006; }
    this.tx = tx(this.scene.wgcx ? this.scene.wgcx.pos : new V3(0, 400, 0), 9000);   // until Chapter 12 the ghosts fly from a signal nobody can find
  },
  tick4(g, dt, wingLine){ const live = this.tick(g, dt, wingLine); GH.tick(this, g, dt); return live; },
  killed(g, p){ GH.killed(this, g, p); if (this.killed4) this.killed4(g, p); },
  heatOk(){ const s = this.scene; return !s || s.noPolice || (s.heat || 0) < 50; }
});
const EP4 = o => EP(Object.assign({}, H4, o));
const RW = time => world('rustwater', time);
const drop = (m, g, at, label) => {
  const P = g.player, dH = Math.hypot(P.pos.x - at.x, P.pos.z - at.z), agl = P.pos.y - ground(g, P.pos.x, P.pos.z), ok = dH < 90 && agl < 70 && P.speed < 150*MPH;
  g.markers.push({pos:at.clone().setY(at.y + 10), label:dH < 600 ? `DROP · ${agl < 70 ? 'alt ✓' : 'under 230 ft'} · ${P.speed < 150*MPH ? 'speed ✓' : 'under 150 mph'}` : `DROP · ${label}`, col:ok ? '#9ef0a0' : '#f2c14e'});
  if (Math.random() < 0.15) g.fx.fire.emit(at.x, at.y + 1, at.z, 0, 4, 0, 3, 0.4, 1, 0.3, 0.2, 1, 0, 1, 2);
  if (ok) { g.spawnChute(P.pos.clone().add(new V3(0, -3, 0)), P.vel, {kind:'cargo'}); if (g.audio) g.audio.ding(); }
  return ok;
};

/* =====================================================================
   Chapter 10, Episode 1: Extra! Extra!
   ===================================================================== */
const DROPS = [['downtown', 'DOWNTOWN'], ['millrow', 'MILL ROW'], ['docks', 'THE DOCKS'], ['furnace', 'FURNACE ROW']];
G.MISSIONS.c10m1 = EP4({
  id:'c10m1', title:'Extra! Extra!', place:'Gantry City, early morning', wing:3, police:true, weather:'fog', weatherScript:[[120, 'overcast', 'Fog\'s lifting off the river.']],
  brief:'The Lucky Thirteen come to Gantry City on Della Ricci\'s dime. Somebody\'s been shooting down the Gantry Courier\'s delivery autogyros, and the police say it\'s pilots from out of town. Make the dawn paper drops in their place: downtown, Mill Row, the docks and Furnace Row, low and slow over the streets. The Air Police are watching every move you make in their city. Don\'t give them a reason.',
  sides:[{text:'Drop the Courier at all four corners'}, {text:'Both Courier autogyros get home'}, {text:'Keep the Air Police off your back'}],
  pay:{success:4500, perfect:2000, kill:250},
  worldOpts:RW('evening'),
  setup(g){
    this.begin(g, `Hook's live, ${G.save.callsign || 'Ace'}. Gantry City, dawn, and you can smell it from up here. Della's bundles are in your hold.`, {heading:0, near:'downtown'});
    this.drops = DROPS.map(([id, label]) => ({at:this.P[id].clone(), label, done:false}));
    const D = this.P.downtown, L = G.stockLoadout('whirligig'); L.paint = [0xe8e0cc, 0x1a1a1a, 0x9e1b1b];
    this.gyros = [0, 1].map(i => { const p = g.addPlane({loadout:Object.assign({}, L), team:0, name:i ? 'Courier No. 2' : 'Courier No. 1', callsign:i ? 'Courier 2' : 'Courier 1', pos:D.clone().add(new V3(i*300 - 150, 160, -400)), q:new Q(), speed:45, ai:{role:'fighter', skill:0.3}});
      const pl = g.pilots.find(x => x.p === p); pl.route = ['downtown', 'millrow', 'footbridge', 'liberty', 'docks', 'downtown'].map(id => ({x:this.P[id].x, z:this.P[id].z, y:180 + i*25, r:150})); pl.wp = i*2; p.friend = true; p.courier = true; return p; });
    this.ghostT = 0;
  },
  update(g, dt){
    const live = this.tick4(g, dt, 'Gantry City. My uncle worked a steel mill here. He said the sky was brown. He was right.');
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    for (const p of this.gyros) { const pl = g.pilots.find(x => x.p === p); if (pl && pl.route && pl.wp >= pl.route.length) pl.wp = 0; if (p.alive) g.markers.push({pos:p.pos, label:p.callsign.toUpperCase(), col:'#9ef0a0', edgeOnly:true}); }
    for (const d of this.drops) if (!d.done && drop(this, g, d.at, d.label)) { d.done = true; G.HUD.toast(`Courier dropped: ${d.label.toLowerCase()}`); G.HUD.radio(DELLA, G.pick(['That\'s the corner! Newsboys are already shouting it.', 'Bundles down. Gantry reads the Courier with its coffee.', 'Right on the stand! You\'re a natural, flyer.'])); }
    const done = this.drops.filter(d => d.done).length;
    // the first ghosts come when the job's half done
    if (!this.wave && (done >= 2 || this.pt > 100)) { this.wave = 1; const D = this.P.downtown; GH.spawn(this, g, D.clone().add(new V3(1600, 420, 900)), 3, {target:this.gyros[0], skill:0.85}); G.HUD.radio('Courier 1', 'Planes on my tail! They don\'t answer the radio! They don\'t answer anything!'); }
    if (this.wave === 1 && this.pt > (this.w1T || (this.w1T = this.pt + 60))) { this.wave = 2; GH.spawn(this, g, this.P.millrow.clone().add(new V3(-1400, 500, 600)), 3, {target:this.gyros[1], skill:0.85}); G.HUD.radio(SPARKS(), 'More of them, from the hills! Same paint. White as a sheet.'); }
    G.HUD.objective(`Drop the Courier: ${done}/4 · ${this.wave ? `${ghostsLeft(g)} strange planes · protect the autogyros` : 'low and slow over the streets'}`);
    if (this.gyros.every(p => !p.alive)) this.lose(g, 'gyros');
    else if (done === 4 && this.wave === 2 && !ghostsLeft(g)) { G.HUD.radio(DELLA, 'Every corner in Gantry has a paper. And you\'ve got a front page: planes with nobody in them. Get back here.'); this.win(g); }
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ const done = this.drops.filter(d => d.done).length;
    return [{text:this.sides[0].text, st:done === 4 ? 'ok' : 'live', val:`${done}/4`}, {text:this.sides[1].text, st:this.gyros.every(p => p.alive) ? (this.ended ? 'ok' : 'live') : 'fail', val:`${this.gyros.filter(p => p.alive).length}/2`},
            {text:this.sides[2].text, st:this.heatOk() ? (this.ended ? 'ok' : 'live') : 'fail', val:''}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'Every paper delivered, both autogyros home, and the police never twitched. Della\'s headline: GHOST PLANES OVER GANTRY. The Air Police aren\'t laughing any more.', then:'The ghost planes went for the gasworks next. Captain Strand wants the Thirteen there tonight: the Gearjammers have been seen with white planes flying top cover.'},
      success:{mood:'stern', say:'The paper\'s out and the story\'s bigger than anybody thought: planes with empty cockpits.', then:'The ghost planes went for the gasworks next. Captain Strand wants the Thirteen there tonight: the Gearjammers have been seen with white planes flying top cover.'},
      fail:{mood:'angry', say:why === 'gyros' ? 'Both Courier autogyros are down in the streets. Della\'s furious, and so is the city.' : why === 'margaret' ? 'The Margaret\'s down in the river. Everyone swam for the quay.' : 'You came down on a Gantry rooftop. The Air Police were very interested in you.', then:'Della says she\'ll give us one more chance. One.'}
    }[kind]));
  }
});

/* =====================================================================
   Chapter 10, Episode 2: The Gasworks Job
   ===================================================================== */
G.MISSIONS.c10m2 = EP4({
  id:'c10m2', title:'The Gasworks Job', place:'The gasworks, Gantry City, night', wing:3, police:true, weather:'smog',
  brief:'The Gearjammers mean to blow the gasworks tonight, with ghost planes flying cover over them. Every holder that goes up takes its neighbours with it, so the whole works can go in a chain. Shoot down the raiders making strafing runs on the holders, keep the ghosts off them, and watch your own fire: a stray burst into a holder starts the chain, and the Air Police will put it on your bill.',
  sides:[{text:'Save at least three gas holders'}, {text:'Down 6 raiders yourself'}, {text:'Keep the Air Police off your back'}],
  pay:{success:5000, perfect:2500, kill:250},
  worldOpts:RW('night'),
  setup(g){
    this.begin(g, `Hook's live, ${G.save.callsign || 'Ace'}. Gasworks dead ahead. Those big drums are full of gas, so mind where you shoot.`, {heading:0, near:'gasworks'});
    this.holders = this.scene.rw.holders; this.raiders = []; this.wave = 0;
    this.scene.onGasBoom = (gg, t, mine) => G.HUD.radio(SPARKS(), mine ? 'That was YOU, sugar! Watch your fire!' : 'A holder\'s gone up! There goes another!');
  },
  update(g, dt){
    const live = this.tick4(g, dt, 'Shooting near the gas holders. In the dark. With ghosts. Sure, why not.'), A = this.P.gasworks;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    const W = [[30, 3, 3, 'Gearjammers coming in low! Ghosts above them!'], [95, 3, 2, 'Second run. They\'re lining up on the holders!'], [165, 4, 3, 'Here\'s the lot of them. Every Gearjammer in Gantry!']];
    if (this.wave < W.length && this.pt > W[this.wave][0]) {
      const [, nr, ng, line] = W[this.wave++], a = Math.random()*PI*2, from = A.clone().add(new V3(Math.sin(a)*1700, 300, Math.cos(a)*1700));
      const rs = this.foes(g, 'gearjammers', from, nr, {skill:0.4, face:A}); for (const p of rs) { g.pilots = g.pilots.filter(x => x.p !== p); p.raider = true; p.mark = G.pick(this.holders.filter(t => t.alive)) || this.holders[0]; this.raiders.push(p); }
      GH.spawn(this, g, from.clone().add(new V3(0, 250, 0)), ng, {skill:0.85}); G.HUD.radio(SPARKS(), line);
    }
    for (const p of this.raiders) { if (p.mark && !p.mark.alive) p.mark = this.holders.find(t => t.alive); if (p.mark) strafe(g, p, p.mark.pos, dt, h => g.hitTarget(p.mark, h*13, p)); }
    for (const t of this.holders) if (t.alive) g.markers.push({pos:t.pos.clone().add(new V3(0, 20, 0)), label:'', col:'#f2c14e', edgeOnly:true});
    const left = this.holders.filter(t => t.alive).length, rLeft = this.raiders.filter(p => p.alive).length;
    G.HUD.objective(`Stop the Gearjammers' strafing runs · ${rLeft} raiders · gas holders standing: ${left}/${this.holders.length}`);
    if (left < 3) { G.HUD.radio(STRAND, 'The whole gasworks is going up! Clear the area! Clear the area!'); this.lose(g, 'gas'); }
    else if (this.wave === 3 && !rLeft && !ghostsLeft(g)) { G.HUD.radio(STRAND, 'Gasworks secure. I\'ll grant you that much, Thirteen.'); this.win(g); }
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ const left = this.holders.filter(t => t.alive).length;
    return [{text:this.sides[0].text, st:left >= 3 ? (this.ended ? 'ok' : 'live') : 'fail', val:`${left}/${this.holders.length}`}, {text:this.sides[1].text, st:g.kills >= 6 ? 'ok' : 'live', val:`${Math.min(6, g.kills)}/6`},
            {text:this.sides[2].text, st:this.heatOk() ? (this.ended ? 'ok' : 'live') : 'fail', val:''}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'Not a single holder lost. One of the Gearjammers we fished out of the river says the white planes "come from the radio". Hale would call that a lead.', then:'Quill says radio-flown planes need a signal, and a signal can be traced. Fly to three radio masts and take bearings, and where the lines cross, there\'s the man flying them.'},
      success:{mood:'stern', say:'The gasworks is still mostly standing. A Gearjammer we pulled out of the river says the white planes "come from the radio".', then:'Quill says radio-flown planes need a signal, and a signal can be traced. Fly to three radio masts and take bearings, and where the lines cross, there\'s the man flying them.'},
      fail:{mood:'angry', say:why === 'gas' ? 'The gasworks went up like the end of the world. Half of Gantry\'s windows are on the street.' : why === 'margaret' ? 'The Margaret went down in the smog over the docks.' : 'You came down in the gasworks yard. That could have gone worse. Not much.', then:'They\'ll try again tomorrow night. So will we.'}
    }[kind]));
  }
});

/* =====================================================================
   Chapter 10, Episode 3: Dead Air
   ===================================================================== */
const MASTS = [['wgcx', 'the WGCX tower', 280], ['ziegler', 'the Ziegler mast', 230], ['dam', 'the dam', 180]];
G.MISSIONS.c10m3 = EP4({
  id:'c10m3', title:'Dead Air', place:'Over Gantry City', wing:3, weather:'smog',
  brief:'Dr. Quill has fitted the Margaret\'s set to hear the ghosts\' signal. Fly to three high points (the WGCX tower, the Ziegler Building\'s mooring mast and the Rustwater Dam) and hold close to each while Sparks takes a bearing. Where the three lines cross is where the signal comes from. The ghosts will try to stop you. If it\'s what Quill thinks it is, you\'ll want a photograph.',
  sides:[{text:'Take bearings at all three masts'}, {text:'Photograph whatever\'s sending (camera: P)'}, {text:'Down 5 ghosts yourself'}],
  pay:{success:5000, perfect:2500, kill:300},
  worldOpts:RW('day'),
  setup(g){
    this.begin(g, `Hook's live, ${G.save.callsign || 'Ace'}. Sparks has the earphones on. She says it sounds like a dentist's drill. Three masts, three bearings.`, {heading:0, near:'wgcx'});
    this.masts = MASTS.map(([id, name, alt]) => ({id, name, at:this.P[id].clone().setY(Math.max(this.P[id].y, 0) + alt), held:0, done:false}));
    if (this.scene.wgcx) this.masts[0].at.copy(this.scene.wgcx.pos);
    this.nextWave = 15; this.waveN = 0;
  },
  update(g, dt){
    const live = this.tick4(g, dt, 'Radio direction-finding. Very modern. Can I shoot something while we do it?'), P = g.player;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    if (this.pt > this.nextWave && !this.cond) { this.nextWave = this.pt + 55; this.waveN++; const a = Math.random()*PI*2; GH.spawn(this, g, P.pos.clone().add(new V3(Math.sin(a)*1500, 250, Math.cos(a)*1500)), 2 + Math.min(2, this.waveN >> 1), {skill:0.88}); G.HUD.radio(SPARKS(), 'Ghosts! They know what we\'re doing!'); }
    for (const M of this.masts) if (!M.done) {
      const d = P.pos.distanceTo(M.at), near = d < 350;
      M.held = near ? M.held + dt : Math.max(0, M.held - dt*0.5);
      g.markers.push({pos:M.at, label:near ? `HOLD STEADY · ${Math.ceil(Math.max(0, 8 - M.held))}s` : `BEARING · ${M.name.toUpperCase()}`, col:'#9ec7f0'});
      if (M.held >= 8) { M.done = true; const brg = Math.round(((Math.atan2(5600 - M.at.x, 5600 - M.at.z)*180/PI) + 360) % 360); G.HUD.toast(`Bearing from ${M.name}: ${String(brg).padStart(3, '0')}°`); G.HUD.radio(SPARKS(), G.pick(['Got it! Strong signal from up the valley.', 'Bearing logged. It\'s moving, whatever it is.', 'That\'s the third line... they cross over the reservoir!'])); }
    }
    const done = this.masts.filter(M => M.done).length;
    if (done === 3 && !this.cond) {
      // the lines cross on something moving over the reservoir: an airship, low in the smog
      const R = this.P.reservoir; this.cond = g.addShip({team:1, kind:'raider', name:'Conductor', label:'CONDUCTOR', paint:Object.assign({scale:1.6, hpMul:6}, CONDUCTOR), pos:new V3(R.x - 600, 520, R.z + 500), heading:PI*0.1, speed:6, turn:0.004, noRun:true, dest:new V3(R.x + 2600, 0, R.z + 6000)});
      this.condT = this.pt; G.HUD.radio(SPARKS(), 'There! Over the reservoir! An airship, painted like a ghost, bristling with aerials! Get a picture before she\'s gone!');
      GH.spawn(this, g, this.cond.pos.clone().add(new V3(0, 80, -300)), 3, {skill:0.9});
    }
    if (this.cond && !this.snap) {
      const C = this.cond; if (this.photo(g, dt, C.pos, 1500)) { this.snap = true; G.HUD.toast('Got the airship on film'); G.HUD.radio(DELLA, 'An airship! The papers will call her the Conductor; she\'s conducting the whole orchestra. Who owns her?'); }
      else g.markers.push({pos:C.pos, label:this.framed ? 'IN FRAME · PRESS CAMERA' : 'THE AIRSHIP (photograph)', col:'#c9a6f0', box:true});
      if (this.pt - this.condT > 100) { G.HUD.radio(SPARKS(), 'She\'s gone into the smog. Lost her.'); this.lose(g, 'lost'); }
    }
    G.HUD.objective(this.cond ? (this.snap ? 'Got her. Shake off the ghosts and come home.' : 'Photograph the airship before she slips into the smog') : `Take bearings: ${done}/3 · hold close to each mast for 8 seconds`);
    if (this.snap && (!ghostsLeft(g) || this.pt - this.condT > 70)) { if (this.cond.alive) this.cond.dest = new V3(this.cond.pos.x, 0, 9000); this.win(g); }
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ const done = this.masts.filter(M => M.done).length;
    return [{text:this.sides[0].text, st:done === 3 ? 'ok' : 'live', val:`${done}/3`}, {text:this.sides[1].text, st:this.snap ? 'ok' : 'live', val:''}, {text:this.sides[2].text, st:g.kills >= 5 ? 'ok' : 'live', val:`${Math.min(5, g.kills)}/5`}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'A photograph on Della\'s front page and five ghosts in the river. Hollis took one look at the picture and went white: "That\'s Lucan Ashgrove\'s work. I\'d know it anywhere."', then:'Lucan Ashgrove: Augustin Hollis\'s partner, before they fell out over whether a plane needs a pilot. Now he sells ghost planes. And the steelworkers have just gone out on strike.'},
      success:{mood:'stern', say:'We have the picture. Hollis recognised the work: Lucan Ashgrove, his old partner.', then:'Lucan Ashgrove: Augustin Hollis\'s partner, before they fell out over whether a plane needs a pilot. Now he sells ghost planes. And the steelworkers have just gone out on strike.'},
      fail:{mood:'angry', say:why === 'lost' ? 'Whatever it was, it slipped into the smog without a picture taken.' : why === 'margaret' ? 'The Margaret went into the reservoir. Everyone swam.' : 'You came down in the hills above the city.', then:'The signal\'s still on the air. We take the bearings again.'}
    }[kind]));
  }
});

/* =====================================================================
   Chapter 11, Episode 1: Bread and Bullets
   ===================================================================== */
function road(m, g){
  const P = m.P, F = (() => { const sl = RU.slope(-2700), n = Math.hypot(1, sl); return {c:new V3(RU.rx(-2700), 0, -2700), ax:1/n, az:-sl/n, L:RU.rw(-2700) + 150}; })();
  const W = (side, z, off) => new V3(RU.rx(z) + side*(RU.rw(z)/2 + off), 0, z);
  const ctrl = [W(-1, -3150, 160), W(-1, -2850, 150), new V3(F.c.x - F.ax*(F.L/2 + 100), 0, F.c.z - F.az*(F.L/2 + 100)), new V3(F.c.x + F.ax*(F.L/2 + 100), 0, F.c.z + F.az*(F.L/2 + 100)), W(1, -2400, 170)];
  for (let z = -1800; z <= 2400; z += 600) ctrl.push(W(1, z, 230));
  const cp = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], dense = [];
  for (let i = 1; i < cp.length - 2; i++) for (let k = 0; k < 24; k++) { const t = k/24, t2 = t*t, t3 = t2*t, p0 = cp[i - 1], p1 = cp[i], p2 = cp[i + 1], p3 = cp[i + 2], f = (a, b, c, d) => 0.5*((2*b) + (-a + c)*t + (2*a - 5*b + 4*c - d)*t2 + (-a + 3*b - 3*c + d)*t3); dense.push({x:f(p0.x, p1.x, p2.x, p3.x), z:f(p0.z, p1.z, p2.z, p3.z)}); }
  for (const q of dense) { const u = Math.abs((q.x - F.c.x)*F.ax + (q.z - F.c.z)*F.az); q.y = u < F.L/2 ? 13 : u < F.L/2 + 90 ? 13 + (Math.max(7, ground(g, q.x, q.z)) - 13)*(u - F.L/2)/90 : ground(g, q.x, q.z) + 0.2; q.bridgeU = u; }
  return {pts:dense, F};
}
G.MISSIONS.c11m1 = EP4({
  id:'c11m1', title:'Bread and Bullets', place:'The Harbour drawbridge to the steelworks, Gantry City', wing:3, police:true, weather:'rain',
  brief:'Ten thousand steelworkers are on strike, and the company means to starve them back to work. Big Stan has four lorries of bread, soup and blankets coming up from the docks: across the Harbour drawbridge and up the east bank to the picket at the steelworks gate. The company has hired ghosts. Keep them off the convoy, and if the drawbridge goes up while they\'re waiting at it, that\'s when the ghosts will come.',
  sides:[{text:'The convoy reaches the picket above 60%'}, {text:'Down 6 ghosts yourself'}, {text:'Keep the Air Police off your back'}],
  pay:{success:5500, perfect:2500, kill:250},
  worldOpts:RW('day'),
  setup(g){
    this.begin(g, `Hook's live, ${G.save.callsign || 'Ace'}. Raining, naturally. The convoy's the four lorries on the west bank. Big Stan says hello.`, {heading:0, near:'docks'});
    const R = road(this, g); this.F = R.F; this.convoy = new Convoy(g, R.pts, 4, 16);
    this.bridgeS = R.pts.find(q => q.bridgeU < this.F.L/2 + 100).s; this.forced = false; this.raiders = []; this.wave = 0;
    // the bridge goes up right as they reach it, on Ashgrove's orders
    this.scene.drawCtl = (t, dt) => { if (!this.forced && this.convoy.s > this.bridgeS - 260) { this.forced = true; G.HUD.radio(STAN, 'The bridge is going up! There\'s no ship! Somebody\'s paid off the bridge-keeper!'); return 79; } return this.forced ? t : 30; };
  },
  update(g, dt){
    const live = this.tick4(g, dt, 'A food convoy. In the rain. With ghosts. Gantry City sure knows how to show a girl a good time.'), C = this.convoy;
    const atBridge = C.s > this.bridgeS - 90 && C.s < this.bridgeS + 20; C.stop = !!(this.scene.drawOpen && atBridge);
    C.update(this.phase === 1 ? dt : 0);
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    const W = [[10, 2, 2, 'White planes, coming for the lorries!'], [60, 3, 2, 'They\'re timing it for the bridge! More of them!'], [130, 3, 2, 'Another flight over the mills!'], [200, 3, 2, 'Last of them, I hope. Stan\'s nearly home!']];
    if (this.wave < W.length && this.pt > W[this.wave][0]) { const [, n, ns, line] = W[this.wave++], a = Math.random()*PI*2, from = C.pos.clone().add(new V3(Math.sin(a)*1600, 350, Math.cos(a)*1600));
      const ps = GH.spawn(this, g, from, n, {skill:0.85, face:C.pos}); for (const p of ps.slice(0, ns)) { g.pilots = g.pilots.filter(x => x.p !== p); p.raider = true; this.raiders.push(p); } G.HUD.radio(SPARKS(), line); }
    for (const p of this.raiders) if (!p.lost) strafe(g, p, C.pos, dt, h => C.damage(h*1.5));
    g.markers.push({pos:C.pos.clone().add(new V3(0, 10, 0)), label:`CONVOY · ${Math.round(C.hp)}%${C.stop ? ' · WAITING AT THE BRIDGE' : ''}`, col:'#9ef0a0'});
    G.HUD.objective(`Escort Stan's convoy to the picket · ${fmtD(C.len - C.s)} to go${C.stop ? ' · the bridge is up!' : ''}`);
    if (!C.alive) this.lose(g, 'convoy');
    else if (C.done) { G.HUD.radio(STAN, 'Bread on the picket line! You hear that cheering? That\'s ten thousand men who owe you lunch.'); this.win(g); }
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ const C = this.convoy;
    return [{text:this.sides[0].text, st:C.hp >= 60 ? (C.done ? 'ok' : 'live') : 'fail', val:Math.round(C.hp) + '%'}, {text:this.sides[1].text, st:g.kills >= 6 ? 'ok' : 'live', val:`${Math.min(6, g.kills)}/6`}, {text:this.sides[2].text, st:this.heatOk() ? (this.ended ? 'ok' : 'live') : 'fail', val:''}]; },
  result(g, kind, why){
    const F = flags(), prisoner = F.kroll === 'caught' ? 'Ambrose Kroll' : F.varga === 'caught' ? 'Liesl Varga' : '"Diamondback" Dixon';
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'Every lorry in, and not a scratch on the bread. Big Stan wept. He denies it.', then:`Word from the prison on Gantry Island: an airship has been seen circling it at night. Somebody's coming for ${prisoner}.`},
      success:{mood:'stern', say:'The convoy got through, a bit scorched. The strike holds.', then:`Word from the prison on Gantry Island: an airship has been seen circling it at night. Somebody's coming for ${prisoner}.`},
      fail:{mood:'angry', say:why === 'convoy' ? 'The convoy\'s burning at the roadside. The company\'s laughing.' : why === 'margaret' ? 'The Margaret came down in the river by the mills.' : 'You came down on Mill Row. The strikers carried you to the union hall.', then:'Stan has more lorries. We try again tomorrow.'}
    }[kind]), {prisoner});
  }
});

/* =====================================================================
   Chapter 11, the Whirligig episode: The Bookkeeper's Passage (a man and a ledger off a moving ship's deck)
   ===================================================================== */
G.MISSIONS.c11x1 = EP4({
  id:'c11x1', title:'The Bookkeeper\'s Passage', place:'The Rustwater estuary, Gantry City', wing:3, police:true, weather:'overcast',
  brief:'Wilbur Pettibone kept the Gantry Steel Company\'s books for nineteen years. Last week he found out what the company paid Lucan Ashgrove for a squadron of planes with nobody in them, and he ran, with the ledger under his coat. He is hiding in a lifeboat aboard the packet Gantry Queen, coming up the estuary on the tide, and the company knows it: the ghosts are out looking for her. Della has lent you a Courier autogyro, the one machine that can put down on a deck. Land on the Queen\'s after stage (flaps down, under 65 mph), get Pettibone aboard, and fly him to Gantry Municipal, where Captain Strand has a cell that locks from the inside. Your wingmen can keep the ghosts busy. The Queen can\'t.',
  sides:[{text:'The Gantry Queen stays above 50%'}, {text:'Not a scratch on Pettibone'}, {text:'Keep the Air Police off your back'}],
  pay:{success:5200, perfect:2200, kill:250},
  worldOpts:RW('day'),
  // this one is flown in the Courier's machine, whatever is in the hangar
  launch(g, line, o){ const L = G.stockLoadout('whirligig'); L.paint = [0xe8e0cc, 0x1a1a1a, 0x9e1b1b]; return G.MISSIONS.ambush.launch.call(this, g, line, Object.assign({}, o, {load:L})); },
  setup(g){
    const z0 = -5500;
    this.begin(g, `Hook's live, ${G.save.callsign || 'Ace'}. That's Della's eggbeater you're hanging in, so bring it back. The Gantry Queen is the white packet coming up the estuary below us.`, {heading:Math.PI, near:new V3(RU.rx(z0), 0, z0)});
    // the harbour's own traffic, and the Queen on a passage of her own: in from the bay and up to the docks
    const sea = this.sea = G.shipping(this.scene, g, 'rustwater'), Qn = this.queen = sea.byId('gantryq'), pts = [];
    for (let z = -7500; z <= -4700; z += 280) pts.push([RU.rx(z) + 70, z]); for (let z = -4700; z >= -7500; z -= 280) pts.push([RU.rx(z) - 110, z]);
    const lane = sea.lane(pts, {name:'the Queen\'s passage'}); if (lane) { Qn.lane = lane; Qn.s = 150; const a = lane.at(Qn.s, {}); Qn.yaw = a.yaw; Qn.pos.set(a.x, Qn.y, a.z); }
    Qn.hp = Qn.hpMax = 2600; Qn.aiMul = 0; Qn.marked = true;   // the raiders' damage is scripted (see update), so a stray burst can't sink her early
    this.raiders = []; this.stage = 0; this.load = 0; this.wave = 0; this.hp0 = null; this.scratch = 0;
  },
  hpOf(P){ return P.internal + P.armor.reduce((a, b) => a + b, 0); },
  onDeck(g, S, hard){ if (S === this.queen && this.stage === 0) { this.stage = 1; this.load = 0; G.HUD.radio(SPARKS(), 'You\'re down! There he is, sugar: grey suit, coming up the companionway with a ledger the size of a paving stone.'); } else if (this.stage < 2) G.HUD.radio(SPARKS(), `Wrong boat, sugar. That's ${S.the}. The Queen's the white one with two funnels.`); },
  onDeckOff(g, S){ if (S === this.queen && this.stage === 2 && !this.offSaid) { this.offSaid = true; G.HUD.radio(DELLA, 'Is he aboard? Is the ledger aboard? Don\'t tell me which matters more.'); } },
  onSeaShipDown(g, S){ if (S !== this.queen) return; if (this.stage < 2) { G.HUD.radio(SPARKS(), 'The Queen\'s going down by the head! They\'re lowering the boats... I can\'t see him. I can\'t see him anywhere.'); this.lose(g, 'queen'); } else G.HUD.radio(SPARKS(), 'They\'ve sunk the Queen! Her boats are away. All that for one bookkeeper.'); },
  update(g, dt){
    const live = this.tick4(g, dt, 'A boat job. In an eggbeater. I\'ll just shoot things and try not to laugh.'), P = g.player, Qn = this.queen, sea = this.sea;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    // ghosts: two go for the ship, the rest for whoever's nearest; a second lot when Pettibone is in the air
    if (this.wave === 0 && this.pt > 16) { this.wave = 1; const from = Qn.pos.clone().add(new V3(1500, 380, -900));
      const rs = GH.spawn(this, g, from, 2, {skill:0.8}); for (const p of rs) { g.pilots = g.pilots.filter(x => x.p !== p); p.raider = true; this.raiders.push(p); }
      GH.spawn(this, g, from.clone().add(new V3(200, 200, 300)), 2, {skill:0.85});
      G.HUD.radio(SPARKS(), 'White planes, low over the bay, and they\'re not answering. Two of them are lining up on the Queen!'); }
    if (this.wave === 1 && this.stage === 2 && this.pt > this.liftT + 6) { this.wave = 2; GH.spawn(this, g, P.pos.clone().add(new V3(-1300, 420, 1500)), 3, {skill:0.85, target:P}); G.HUD.radio(SPARKS(), 'More of them, coming down the river! They know which machine he\'s in. Run for Municipal!'); }
    for (const p of this.raiders) if (Qn.alive) strafe(g, p, sea.world(Qn, 0, 6, 0, tA.clone()), dt, h => { Qn.hp -= h*(this.stage < 2 ? 24 : 14); if (Qn.hp <= 0) sea.sink(Qn, p); });
    if (Qn.alive && Qn.hp < Qn.hpMax*0.5 && !this.qWarn) { this.qWarn = true; G.HUD.radio('Gantry Queen', 'Mayday, mayday! We are on fire aft and taking water! Whoever you are up there, get them off us!'); }
    // the pick-up, then the run home
    const M = this.scene.sites.find(x => x.id === 'municipal'), spot = M.apron || M.point;
    if (this.stage < 2) {
      const on = P.deck && P.deck.ship === Qn, top = sea.padTop(Qn, new V3());
      g.markers.push({pos:top.setY(top.y + 7), label:on ? 'HOLD · he\'s coming' : 'GANTRY QUEEN · LAND ON HER STAGE', col:on ? '#9ef0a0' : '#f2c14e'});
      if (this.stage === 1 && on) { this.holdOnGround = true; this.load += dt;
        if (this.load >= 8) { this.stage = 2; this.holdOnGround = false; this.liftT = this.pt; this.hp0 = this.hpOf(P); if (g.audio) g.audio.ding(); G.HUD.radio('Pettibone', 'Nineteen years of double entry, young man, and it is all in here. I get airsick. Please proceed.'); }
      } else this.holdOnGround = false;
      G.HUD.objective(this.stage === 1 && on ? `Hold on the stage: Pettibone is coming aboard · ${Math.round(this.load/8*100)}%` : `Land on the Gantry Queen's after stage · flaps down, under 65 mph · the Queen ${Math.max(0, Math.round(Qn.hp/Qn.hpMax*100))}%`);
    } else {
      this.scratch = Math.max(this.scratch, this.hp0 - this.hpOf(P));
      const d = Math.hypot(P.pos.x - spot.x, P.pos.z - spot.z);
      g.markers.push({pos:spot.clone().setY(spot.y + 10), label:P.onGround && !P.deck ? (d < 34 ? 'STOP HERE' : 'TAXI HERE') : 'LAND · GANTRY MUNICIPAL', col:'#f2c14e'});
      G.HUD.objective(P.deck ? 'Pettibone is aboard: pull up with the throttle open to jump off' : `Fly Pettibone to Gantry Municipal and taxi to the hangar · ${ghostsLeft(g)} ghosts`);
      if (P.onGround && !P.deck && d < 34 && P.speed < 3) { G.HUD.radio(STRAND, 'I have him. He\'s asked for a cell, a pot of tea and an adding machine. That ledger had better be worth it, Thirteen.'); this.win(g); }
    }
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ const Qn = this.queen, pct = Qn ? Math.max(0, Math.round(Qn.hp/Qn.hpMax*100)) : 0, hurt = this.scratch > 6;
    return [{text:this.sides[0].text, st:pct >= 50 ? (this.ended ? 'ok' : 'live') : 'fail', val:pct + '%'}, {text:this.sides[1].text, st:hurt ? 'fail' : this.ended && this.stage === 2 ? 'ok' : 'live', val:''},
            {text:this.sides[2].text, st:this.heatOk() ? (this.ended ? 'ok' : 'live') : 'fail', val:''}]; },
  result(g, kind, why){
    const F = flags(), prisoner = F.prisoner || (F.kroll === 'caught' ? 'Ambrose Kroll' : F.varga === 'caught' ? 'Liesl Varga' : '"Diamondback" Dixon'), next = `The airship over Gantry Island prison comes back tonight, and this time she has a line down. Somebody means to lift ${prisoner} out of the exercise yard.`;
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'Pettibone\'s in Strand\'s cell doing sums, the Queen made her pier, and Della has the ledger on her desk: forty thousand dollars, Gantry Steel to L. Ashgrove, "for aircraft, unmanned". She says it\'s the best thing she has ever read.', then:next},
      success:{mood:'stern', say:'The bookkeeper\'s safe and so is his ledger. Gantry Steel paid Ashgrove forty thousand dollars for aircraft, unmanned. Della\'s setting it in type.', then:next},
      fail:{mood:'angry', say:why === 'queen' ? 'The Gantry Queen went down in the estuary. Her boats got everybody off but one grey suit and one ledger.' : why === 'margaret' ? 'The Margaret came down in the bay. Everyone swam.' : 'You put Della\'s eggbeater in the estuary. She wants it back. So does the Courier.', then:'No ledger and no bookkeeper: Della will have to make her case against the company the slow way. ' + next}
    }[kind]), kind === 'fail' ? {} : {ledger:true});
  }
});

/* =====================================================================
   Chapter 11, Episode 2: Jailbreak
   ===================================================================== */
G.MISSIONS.c11m2 = EP4({
  id:'c11m2', title:'Jailbreak', place:'Gantry Island prison, night', wing:3, weather:'fog',
  brief:'An airship is coming for Gantry Island prison tonight, to winch somebody out of the exercise yard on a line. Stop it: shoot through the hoist line and drop them back in the yard, or knock out the airship\'s engines so she can\'t leave. Ghosts will be flying cover. If she gets away with her passenger, the end of this business will be harder.',
  sides:[{text:'Stop the jailbreak'}, {text:'Down 5 ghosts yourself'}, {text:'Keep the Margaret above 60%'}],
  pay:{success:5500, perfect:2500, kill:250},
  worldOpts:RW('night'),
  setup(g){
    this.begin(g, `Hook's live, ${G.save.callsign || 'Ace'}. Fog on the harbour, searchlights on the island. Watch for an airship coming in low.`, {heading:0, near:'prison'});
    const F = flags(); this.who = F.kroll === 'caught' ? 'Ambrose Kroll' : F.varga === 'caught' ? 'Liesl Varga' : '"Diamondback" Dixon';
    const I = this.P.prison; this.yard = I.clone().setY(Math.max(I.y, 6) + 2);
    this.lark = g.addShip({team:1, kind:'raider', name:'Skylark', label:'SKYLARK', paint:Object.assign({scale:0.8, hpMul:1}, CONDUCTOR), pos:new V3(I.x + 2400, 260, I.z + 900), heading:-PI/2, speed:8, turn:0.01, noRun:true, dest:I.clone().setY(0)});
    this.stage = 'in'; this.hoist = 0;
  },
  update(g, dt){
    const live = this.tick4(g, dt, 'A jailbreak in the fog. I\'ve seen this picture. The guy with the moustache does it.'), S = this.lark, I = this.yard;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    if (!this.w1 && this.pt > 6) { this.w1 = true; GH.spawn(this, g, S.pos.clone().add(new V3(0, 120, 200)), 4, {skill:0.85}); G.HUD.radio(SPARKS(), 'Airship, coming in low off the sea! Ghosts all round her!'); }
    if (!this.w2 && this.pt > 80) { this.w2 = true; GH.spawn(this, g, S.pos.clone().add(new V3(-600, 200, 0)), 3, {skill:0.85}); }
    const dH = Math.hypot(S.pos.x - I.x, S.pos.z - I.z);
    if (this.stage === 'in' && dH < 140) {
      this.stage = 'hoist'; S.speed = 0.6; S.dest = null;
      // the line from her belly to the yard, and the target on it you can cut
      this.line = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 5), G.mat(0x2a2a2a)); g.scene.add(this.line);
      this.cut = g.addTarget({kind:'line', label:'HOIST LINE', pos:I.clone(), r:5, hp:30, team:1});
      this.cut.onDown = () => { this.stage = 'dropped'; g.scene.remove(this.line); G.HUD.radio(SPARKS(), `Line's cut! ${this.who.split(' ').slice(-1)[0]} fell back into the yard, into a haystack. Lucky. The guards have him.`); };
      G.HUD.radio(ASH, `Good evening, Gantry. I've come to collect ${this.who}. Do try not to interrupt.`);
    }
    if (this.stage === 'hoist') {
      this.hoist += dt/70; const top = S.pos.clone().add(new V3(0, -14, 0)), mid = I.clone().lerp(top, Math.min(0.95, this.hoist));
      this.line.position.copy(I).add(top).multiplyScalar(0.5); this.line.scale.y = top.distanceTo(I); this.line.quaternion.setFromUnitVectors(new V3(0, 1, 0), tA.copy(top).sub(I).normalize());
      this.cut.pos.copy(I).lerp(top, 0.35);
      g.markers.push({pos:mid, label:`${this.who.toUpperCase()} · ${Math.round(this.hoist*100)}%`, col:'#ff8a6a'});
      if (beaten(S)) { this.stage = 'dropped'; g.scene.remove(this.line); if (this.cut.alive) { this.cut.alive = false; } G.HUD.radio(CAP(), 'Her engines are dead! She\'s drifting onto the island! The guards are swarming her!'); }
      else if (this.hoist >= 1) { this.stage = 'out'; this.outT = this.pt; g.scene.remove(this.line); if (this.cut.alive) this.cut.alive = false; S.speed = 12; S.dest = new V3(I.x + 400, 0, -9000); G.HUD.radio(ASH, `Aboard and away. Goodbye, Thirteen. ${this.who} sends regards.`); }
    }
    if (this.stage === 'out') { const away = Math.hypot(S.pos.x - I.x, S.pos.z - I.z); g.markers.push({pos:S.pos, label:`SKYLARK · ${fmtD(Math.max(0, 1800 - away))} from the fog`, col:'#ff8a6a'}); if (beaten(S)) { this.stage = 'dropped'; G.HUD.radio(CAP(), 'Got her! She\'s going down in the harbour, passenger and all. The launches are on their way.'); } else if (away > 1800 || this.pt - this.outT > 110) { this.escaped = true; this.stage = 'gone'; } }
    G.HUD.objective({in:'An airship is coming for the prison: stop her', hoist:'Cut the hoist line, or knock out her engines!', out:'She\'s got him! Stop her before she reaches the fog bank', dropped:'Jailbreak stopped. Clean up the ghosts.', gone:'She\'s gone.'}[this.stage]);
    if ((this.stage === 'dropped' && (!ghostsLeft(g) || (this.dropT = this.dropT || this.pt) < this.pt - 30)) || this.stage === 'gone') this.win(g);
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ const S = this.ship;
    return [{text:this.sides[0].text, st:this.stage === 'dropped' ? 'ok' : this.escaped ? 'fail' : 'live', val:''}, {text:this.sides[1].text, st:g.kills >= 5 ? 'ok' : 'live', val:`${Math.min(5, g.kills)}/5`},
            {text:this.sides[2].text, st:S.hp/S.hpMax >= 0.6 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(S.hp/S.hpMax*100) + '%'}]; },
  result(g, kind, why){
    const stopped = !this.escaped, who = this.who;
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:`${who} is back in a cell, the Skylark is in the harbour, and Ashgrove was on her radio the whole time, laughing. He isn't laughing now.`, then:'Ashgrove\'s next move came over the radio at dawn: "Gantry has a dam. Gantry will have a flood." Ghost bombers are gathering up the valley.'},
      success:{mood:stopped ? 'pleased' : 'stern', say:stopped ? `${who} stays behind bars. The Skylark didn't get away.` : `${who} is out, aboard the Skylark, gone into the fog. That will cost us later.`, then:'Ashgrove\'s next move came over the radio at dawn: "Gantry has a dam. Gantry will have a flood." Ghost bombers are gathering up the valley.'},
      fail:{mood:'angry', say:why === 'margaret' ? 'The Margaret went into the harbour. Fishing boats picked everyone up.' : 'You went into the harbour under silk.', then:'The airship\'s still circling. We try again tonight.'}
    }[kind]), {breakout:stopped ? 'stopped' : 'escaped', escapee:stopped ? '' : who});
  }
});

/* =====================================================================
   Chapter 11, Episode 3: The Dam
   ===================================================================== */
G.MISSIONS.c11m3 = EP4({
  id:'c11m3', title:'The Dam', place:'The Rustwater Dam, evening', wing:3, weather:'storm',
  brief:'Ghost torpedo bombers are coming down the reservoir to put torpedoes into the Rustwater Dam. If it breaks, the lower city floods. Shoot the bombers before they drop, shoot the torpedoes in the water if they do, and mind the barrage balloon cables over the dam: they kill ghosts and Thirteens alike. It\'s blowing up a storm.',
  sides:[{text:'The dam holds above 50%'}, {text:'Down 8 bombers and ghosts yourself'}, {text:'Keep the Margaret above 60%'}],
  pay:{success:6500, perfect:3000, kill:250},
  worldOpts:RW('evening'),
  setup(g){
    this.begin(g, `Hook's live, ${G.save.callsign || 'Ace'}. The dam's ahead, the lake's behind it, and there's weather coming. Watch the balloon cables.`, {heading:0});
    this.dam = 100; this.bombers = []; this.torps = []; this.wave = 0; const D = this.P.dam;
    this.ship.pos.set(D.x - 1200, 700, D.z - 1400); this.ship.dest = D.clone(); this.ship.turn0 = 0.006;
  },
  update(g, dt){
    const live = this.tick4(g, dt, 'Torpedo bombers on a lake. Low and slow over water. My favourite kind of target.'), D = this.P.dam, LK = RU.LAKE, P = g.player;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    const W = [[8, 2, 2], [70, 3, 2], [135, 3, 3], [200, 4, 3]];
    if (this.wave < W.length && this.pt > W[this.wave][0]) {
      const [, nb, nf] = W[this.wave++];
      for (let i = 0; i < nb; i++) { const x = RU.rx(D.z + 2600) + (i - (nb - 1)/2)*220, p = GH.spawn(this, g, new V3(x, LK + 60, D.z + 2800 + i*80), 1, {skill:0.8})[0]; g.pilots = g.pilots.filter(q => q.p !== p); p.bomber = {aim:new V3(RU.rx(D.z) + (Math.random() - 0.5)*300, LK + 22, D.z + 380), dropped:false}; this.bombers.push(p); }
      GH.spawn(this, g, new V3(D.x, LK + 400, D.z + 2400), nf, {skill:0.85});
      G.HUD.radio(SPARKS(), ['Bombers on the water! Two of them, coming down the lake!', 'Three more! Torpedoes slung under them!', 'They\'re spread out this time! Watch the flanks!', 'Last wave, and the biggest. Hold the line!'][this.wave - 1]);
    }
    // the bombers fly the lake at wave height, drop, and pull up
    for (const p of this.bombers) {
      if (!p.alive || p.lost) continue; const B = p.bomber;
      if (!B.dropped) {
        tA.copy(B.aim).sub(p.pos).normalize(); p.steer(tA); p.throttle = 1; p.fire = false;
        if (p.pos.distanceTo(B.aim) < 220) { B.dropped = true; this.torpedo(g, p.pos.clone().setY(LK + 0.5)); G.HUD.toast('Torpedo in the water!'); }
      } else { tA.set(p.fwd.x, 0.5, p.fwd.z).normalize(); p.steer(tA); if (p.pos.y > LK + 300 && !B.free) { B.free = true; g.pilots.push(new G.Pilot(g, p, {role:'fighter', skill:0.8})); } }
    }
    for (const T of this.torps) if (T.alive) {
      T.pos.z -= 24*dt; T.pos.x += (RU.rx(D.z) - T.pos.x)*0.05*dt; T.group.position.copy(T.pos); g.markers.push({pos:T.pos, label:'TORPEDO', col:'#ff6b57'});
      if (Math.random() < dt*8) g.fx.smoke.emit(T.pos.x, LK + 0.5, T.pos.z + 3, 0, 1, 2, 1.6, 1, 0.85, 0.9, 0.92, 0.5, 2, 0.6, 2);
      if (T.pos.z <= D.z + 12) { T.alive = false; T.group.visible = false; this.dam = Math.max(0, this.dam - 22); g.fx.explosion(new V3(T.pos.x, LK + 6, D.z + 10), 4); if (g.audio) g.audio.boom(T.pos, true); G.HUD.radio(CAP(), this.dam > 50 ? 'Torpedo hit the dam! She\'s holding!' : this.dam > 0 ? 'Another hit! There\'s water coming through the face!' : 'She\'s breaking!'); }
    }
    g.markers.push({pos:D.clone().setY(LK + 30), label:`THE DAM · ${Math.round(this.dam)}%`, col:'#9ec7f0', edgeOnly:true});
    const left = this.bombers.filter(p => p.alive && !p.bomber.dropped).length + this.torps.filter(t => t.alive).length;
    G.HUD.objective(`Stop the torpedo bombers · the dam: ${Math.round(this.dam)}% · ${left} bombers and torpedoes in play · wave ${this.wave}/4`);
    if (this.dam <= 0) { G.HUD.radio(G.CAPTAIN.short, 'The dam\'s gone! God help the lower city!'); this.lose(g, 'dam'); }
    else if (this.wave === 4 && !left && !ghostsLeft(g)) { G.HUD.radio(STRAND, 'The dam held. Gantry owes you, Thirteen. I owe you. Don\'t tell anyone I said so.'); this.win(g); }
    G.HUD.sides(this.sideState(g));
  },
  torpedo(g, at){
    const grp = new THREE.Group(), m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 6), G.mat(0x2a2a2a, {metalness:0.5})); m.rotation.x = PI/2; grp.add(m); grp.position.copy(at); g.scene.add(grp);
    const t = g.addTarget({kind:'torpedo', label:'a torpedo', pos:at.clone(), r:5, hp:12, group:grp, team:1}); this.torps.push(t);
  },
  sideState(g){ const S = this.ship;
    return [{text:this.sides[0].text, st:this.dam >= 50 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(this.dam) + '%'}, {text:this.sides[1].text, st:g.kills >= 8 ? 'ok' : 'live', val:`${Math.min(8, g.kills)}/8`},
            {text:this.sides[2].text, st:S.hp/S.hpMax >= 0.6 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(S.hp/S.hpMax*100) + '%'}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'Not a crack in the dam. Quill was listening the whole time: the bombers took their orders from the WGCX tower, through aerials the station never asked for.', then:'The ghosts fly by the WGCX tower\'s hidden aerials. Knock them out, and every ghost over Gantry goes deaf. Tonight.'},
      success:{mood:'stern', say:'The dam\'s scarred but holding. Quill traced the bombers\' orders to the WGCX tower.', then:'The ghosts fly by the WGCX tower\'s hidden aerials. Knock them out, and every ghost over Gantry goes deaf. Tonight.'},
      fail:{mood:'angry', say:why === 'dam' ? 'The dam broke. The lower city is under four feet of water.' : why === 'margaret' ? 'The Margaret went into the reservoir in the storm.' : 'You came down on the dam\'s crest. The gate-keeper made you tea.', then:'The engineers have patched the dam. Ashgrove will try again, and we\'ll be there.'}
    }[kind]), {dam:Math.round(this.dam)});
  }
});

/* =====================================================================
   Chapter 12, Episode 1: Radio Silence
   ===================================================================== */
G.MISSIONS.c12m1 = EP4({
  id:'c12m1', title:'Radio Silence', place:'The WGCX tower, night', wing:3, weather:'smog',
  brief:'Four aerials near the top of the WGCX tower carry Ashgrove\'s signal to every ghost over Gantry. Shoot them out. Each one you kill makes the ghosts clumsier; kill all four and they\'re deaf. The tower is braced with guy wires and ringed with barrage balloons. Their cables will take your wing off as surely as the ghosts will.',
  sides:[{text:'Shoot out all four aerials'}, {text:'Down 8 ghosts yourself'}, {text:'Don\'t touch a cable'}],
  pay:{success:6500, perfect:3000, kill:250},
  worldOpts:RW('night'),
  setup(g){
    this.begin(g, `Hook's live, ${G.save.callsign || 'Ace'}. The tower's lit up like a Christmas tree. The aerials are the white boxes near the top.`, {heading:0, near:'wgcx'});
    const W = this.scene.wgcx; this.aer = W.aerials.map((a, i) => { const t = g.addTarget({kind:'aerial', label:'AERIAL', pos:a.clone(), r:4, hp:120, team:1}); return t; });
    this.tx = tx(W.pos, 9000, this.aer); this.wave = 0;
    this.target(g, 'flak', 'FLAK', W.base.clone().add(new V3(60, 0, 40)), {hp:200}); this.target(g, 'flak', 'FLAK', W.base.clone().add(new V3(-70, 0, -30)), {hp:200});
  },
  update(g, dt){
    const live = this.tick4(g, dt, 'Shooting at a radio tower full of wires at night. Fine. I\'ll stay out of the way of the wires.'), W = this.scene.wgcx;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    this.targetsTick(g, dt);
    if (this.wave === 0 && this.pt > 4) { this.wave = 1; GH.spawn(this, g, W.pos.clone().add(new V3(0, 100, -900)), 5, {skill:0.92}); G.HUD.radio(ASH, 'The Lucky Thirteen, at my tower. Hollis\'s pets. My ghosts fly better than any of you.'); }
    if (this.wave === 1 && this.pt > 60) { this.wave = 2; GH.spawn(this, g, W.pos.clone().add(new V3(900, 200, 500)), 4, {skill:0.92}); }
    const s = this.tx.strength(), left = this.aer.filter(a => a.alive).length;
    for (const a of this.aer) if (a.alive) g.markers.push({pos:a.pos, label:'AERIAL', col:'#ff8a6a', box:true});
    if (!left && !this.deafT) { this.deafT = this.pt; G.HUD.radio(SPARKS(), 'That\'s the last aerial! Look at them! They\'re falling out of the sky like leaves!'); }
    if (this.deafT && !this.backup && this.pt - this.deafT > 12) {
      this.backup = true; const B = tx(new V3(W.pos.x, 900, W.pos.z + 5000), 9000); B.dead = false; for (const p of g.planes) if (p.ghost && p.alive) { p.tx = B; }
      G.HUD.radio(ASH, 'Clever. But the Conductor has a transmitter of her own. Switching over, my children.'); setTimeout(() => { if (G.game === g) G.HUD.radio(SPARKS(), 'They\'re waking up again! Weaker, though. Sloppy.'); }, 3000);
      for (const p of g.planes) if (p.ghost) { const pl = g.pilots.find(x => x.p === p) || (p.lost && p.lost.pl); if (pl) pl.baseSkill = 0.5; }
    }
    G.HUD.objective(left ? `Shoot out the aerials: ${4 - left}/4 · the ghosts are flying at ${Math.round(s*100)}%` : this.backup ? `Finish the ghosts: ${ghostsLeft(g)} left` : 'The ghosts are deaf! Get clear of the tower');
    if (this.backup && (!ghostsLeft(g) || this.pt - this.deafT > 70)) this.win(g);
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ const left = this.aer.filter(a => a.alive).length;
    return [{text:this.sides[0].text, st:left ? 'live' : 'ok', val:`${4 - left}/4`}, {text:this.sides[1].text, st:g.kills >= 8 ? 'ok' : 'live', val:`${Math.min(8, g.kills)}/8`}, {text:this.sides[2].text, st:this.cableHit ? 'fail' : this.ended ? 'ok' : 'live', val:''}]; },
  playerDown(g){ this.cableHit = true; return H3.playerDown.call(this, g); },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'The tower\'s silent and the ghosts over Gantry flew like drunks until the last of them hit the river. One problem: they woke up again on the Conductor\'s signal.', then:'Ashgrove\'s hangar must be close: he can\'t fly the Conductor from nowhere. Sal Bucco knows the drains under Gantry. He says there\'s a room down there nobody uses. Somebody\'s using it.'},
      success:{mood:'stern', say:'The tower\'s silent. The ghosts woke up again on the Conductor\'s signal, weaker.', then:'Ashgrove\'s hangar must be close: he can\'t fly the Conductor from nowhere. Sal Bucco knows the drains under Gantry. He says there\'s a room down there nobody uses. Somebody\'s using it.'},
      fail:{mood:'angry', say:'You went down among the guy wires. Strand\'s men pulled you out of a tenement roof.', then:'The tower\'s still talking. Tomorrow night, again.'}
    }[kind]));
  }
});

/* =====================================================================
   Chapter 12, Episode 2: Down the Drain
   ===================================================================== */
G.MISSIONS.c12m2 = EP4({
  id:'c12m2', title:'Down the Drain', place:'The Undercroft, under Gantry City', wing:0, weather:'rain',
  brief:'Sal Bucco was right: Ashgrove has built his ghosts in the Undercroft, the great storm-drain hub under the city. Fly in through the outfall, alone; the drain won\'t take more than one plane at a time. Wreck the assembly line, destroy the three ghosts parked on the floor, and grab Ashgrove\'s control set: fly low and slow over it and we\'ll hook it. Then get out before the roof comes down.',
  sides:[{text:'Wreck the assembly line'}, {text:'Destroy the three parked ghosts'}, {text:'Grab Ashgrove\'s control set (low and slow over it)'}],
  pay:{success:6500, perfect:3000, kill:300},
  worldOpts:RW('night'),
  setup(g){
    this.begin(g, `Hook's live, ${G.save.callsign || 'Ace'}. The outfall is a hole in the hillside with water pouring out of it. You'll see it. Go in slow.`, {heading:0, near:'downtown'});
    const C = this.scene.cavern, cx = C.x, cz = C.z, fy = C.floor, ax = C.ax[0], az = C.ax[1], at = (lx, lz) => new V3(cx + ax*lx - az*lz, fy, cz + az*lx + ax*lz);
    this.hall = this.target(g, 'hall', 'ASSEMBLY LINE', at(-80, 0), {hp:360, r:14, block:false});
    this.parked = [[40, -70], [40, 0], [40, 70]].map(([lx, lz]) => {
      const pos = at(lx, lz), m = G.buildPlane('mantis', GHOST[0]); m.position.copy(pos).add(new V3(0, 2, 0)); m.rotation.y = Math.atan2(-ax, -az); g.scene.add(m);
      return g.addTarget({kind:'parked', label:'PARKED GHOST', pos:pos.clone().add(new V3(0, 2, 0)), r:6, hp:90, group:m, team:1});
    });
    this.set = at(-10, 110); const crate = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2), G.mat(0x3a4248, {emissive:0x9ef0e0, emissiveIntensity:0.6})); crate.position.copy(this.set).add(new V3(0, 1, 0)); g.scene.add(crate); this.crate = crate;
    const gate = this.scene.tunnels.find(t => t.T.td.id === 'outfall'); this.gate = gate ? new V3(gate.T.pts[gate.T.i0].x, gate.T.floor + 14, gate.T.pts[gate.T.i0].z) : at(400, 0);
    for (const o of [[80, 40], [-60, 90]]) this.target(g, 'flak', 'FLAK', new V3(this.gate.x + o[0], 0, this.gate.z + o[1]).setY(ground(g, this.gate.x + o[0], this.gate.z + o[1])), {hp:200});
  },
  update(g, dt){
    const live = this.tick4(g, dt), P = g.player, C = this.scene.cavern;
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    this.targetsTick(g, dt);
    if (!this.w1 && this.pt > 4) { this.w1 = true; GH.spawn(this, g, this.gate.clone().add(new V3(0, 260, -600)), 4, {skill:0.85}); G.HUD.radio(SPARKS(), 'Ghosts guarding the outfall. Lose them in the drain!'); }
    const inside = Math.hypot(P.pos.x - C.x, P.pos.z - C.z) < Math.max(C.rx, C.rz) + 20 && P.pos.y < C.floor + C.H + 10;
    if (inside && !this.inSaid) { this.inSaid = true; G.HUD.radio(SPARKS(), 'You\'re in! Look at it... a whole factory under the street. Lit up like a church.'); }
    if (!this.got) {
      const dH = Math.hypot(P.pos.x - this.set.x, P.pos.z - this.set.z), agl = P.pos.y - this.set.y;
      g.markers.push({pos:this.set.clone().add(new V3(0, 4, 0)), label:dH < 300 ? `CONTROL SET · ${agl < 25 ? 'low ✓' : 'lower'} · ${P.speed < 130*MPH ? 'slow ✓' : 'slower'}` : 'CONTROL SET', col:'#9ef0e0'});
      if (dH < 40 && agl < 25 && P.speed < 130*MPH) { this.got = true; this.crate.visible = false; if (g.audio) g.audio.ding(); G.HUD.toast('Control set aboard!'); G.HUD.radio(SPARKS(), 'Got it! Quill\'s going to be impossible to live with.'); }
    }
    for (const t of this.parked) if (t.alive) g.markers.push({pos:t.pos, label:'GHOST', col:'#ff8a6a', box:true});
    const all = !this.hall.alive && this.parked.every(t => !t.alive) && this.got;
    if (all && !this.outT) { this.outT = this.pt; G.HUD.radio(CAP(), 'That\'s everything! Now get out of there, the roof\'s coming down!'); for (let i = 0; i < 6; i++) setTimeout(() => { if (G.game === g) g.fx.explosion(new V3(C.x + (Math.random() - 0.5)*300, C.floor + 20 + Math.random()*40, C.z + (Math.random() - 0.5)*300), 3); }, 1000 + i*1500); }
    G.HUD.objective(this.outT ? (inside ? 'Get out! Back through the outfall!' : 'You\'re out. Head home.') : `In through the outfall · assembly line ${this.hall.alive ? '✗' : '✓'} · parked ghosts ${this.parked.filter(t => !t.alive).length}/3 · control set ${this.got ? '✓' : '✗'}`);
    if (this.outT && !inside && this.pt - this.outT > 4) this.win(g);
    if (this.outT && inside && this.pt - this.outT > 45) { G.HUD.radio(SPARKS(), 'The roof... no!'); this.lose(g, 'buried'); }
    if (!this.outT && this.pt > 420) this.lose(g, 'time');
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ return [{text:this.sides[0].text, st:this.hall.alive ? 'live' : 'ok', val:''}, {text:this.sides[1].text, st:this.parked.every(t => !t.alive) ? 'ok' : 'live', val:`${this.parked.filter(t => !t.alive).length}/3`}, {text:this.sides[2].text, st:this.got ? 'ok' : 'live', val:''}]; },
  result(g, kind, why){
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:'The Undercroft\'s a crater, and Quill has Ashgrove\'s control set on his workbench. He says with it he can tell where the Conductor will be tonight. Over the city, in the storm.', then:'Ashgrove has one card left: the Conductor and every ghost he has left, over Gantry City tonight in the storm. This is it.'},
      success:{mood:'pleased', say:'The ghost works under the city is wrecked. Ashgrove has only the Conductor now.', then:'Ashgrove has one card left: the Conductor and every ghost he has left, over Gantry City tonight in the storm. This is it.'},
      fail:{mood:'angry', say:why === 'buried' ? 'The Undercroft came down with you in it. Sal\'s men dug you out by morning. The plane didn\'t make it.' : why === 'time' ? 'You took too long; Ashgrove\'s men moved the works out.' : 'You came down at the outfall. Sal dragged you into a culvert.', then:'Sal knows another way in. We go again.'}
    }[kind]));
  }
});

/* =====================================================================
   Chapter 12, Episode 3: The Conductor
   ===================================================================== */
G.MISSIONS.c12m3 = EP4({
  id:'c12m3', title:'The Conductor', place:'Over Gantry City, night, in the storm', wing:3, weather:'storm',
  brief:'The Conductor is over the city with every ghost Ashgrove has left. Her four aerial masts fly the whole squadron: shoot them out and every ghost in the sky drops. Then Ashgrove will run, low down the river and under the bridges to the sea, the way he always planned. Catch him before he reaches open water.',
  sides:[{text:'Shoot out the Conductor\'s four aerials'}, {text:'Catch Ashgrove before he reaches the sea'}, {text:'Keep the Margaret above 50%'}],
  pay:{success:9000, perfect:4000, kill:250},
  worldOpts:RW('night'),
  setup(g){
    this.begin(g, `Hook's live, ${G.save.callsign || 'Ace'}. There she is over downtown, lit up and singing. Every gun we've got, all at once.`, {heading:0, near:'downtown'});
    const D = this.P.downtown, F = flags();
    this.cond = g.addShip({team:1, kind:'raider', name:'Conductor', label:'CONDUCTOR', paint:Object.assign({scale:2, hpMul:5}, CONDUCTOR), pos:new V3(D.x - 400, 560, D.z + 900), heading:PI, speed:3, turn:0.006, noRun:true, dest:D.clone()});
    G.toughen(this.cond, 1.4);
    this.masts = [[14, 22, 30], [-14, 22, 30], [14, 22, -30], [-14, 22, -30]].map(([x, y, z]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 12, 2.4), G.mat(0xd8dde2, {emissive:0x9ef0e0, emissiveIntensity:0.5})); m.position.set(x, y, z); this.cond.obj.add(m);
      return g.addTarget({kind:'aerial', label:'AERIAL', pos:new V3(), r:5, hp:150, group:m, team:1});
    });
    this.tx = tx(this.cond.pos, 6000, this.masts); this.stage = 'ship'; this.respawnT = 0;
    this.backer = F.kroll === 'escaped' || (F.breakout === 'escaped' && F.escapee === 'Ambrose Kroll');
  },
  update(g, dt){
    const live = this.tick4(g, dt, 'Everyone up. Everyone. This is the one they\'ll write songs about.'), C = this.cond;
    C.obj.updateMatrixWorld(true); for (const t of this.masts) if (t.group) t.group.getWorldPosition(t.pos);
    if (!live) { G.HUD.sides(this.sideState(g)); return; }
    if (this.stage === 'ship') {
      this.tx.pos.copy(C.pos);
      if ((this.respawnT -= dt) <= 0 && ghostsLeft(g) < 6) { this.respawnT = 18; GH.spawn(this, g, C.pos.clone().add(new V3(0, 40, 0)), 3, {skill:0.92}); if (!this.said) { this.said = true; G.HUD.radio(ASH, 'Welcome to the last concert, Thirteen. The orchestra is ghosts, and the music is you falling.'); } }
      for (const t of this.masts) if (t.alive) g.markers.push({pos:t.pos, label:'AERIAL', col:'#ff8a6a', box:true});
      const left = this.masts.filter(t => t.alive).length;
      G.HUD.objective(`Shoot out the Conductor's aerials: ${4 - left}/4 · the ghosts fly at ${Math.round(this.tx.strength()*100)}%`);
      if (!left) this.flee(g);
    } else this.chase(g, dt);
    G.HUD.sides(this.sideState(g));
  },
  flee(g){
    this.stage = 'chase'; const C = this.cond;
    G.HUD.radio(SPARKS(), 'All four! Look at them fall! Every ghost in the sky is going down!');
    // down to the river and south under every bridge to the sea
    const path = [C.pos.clone().add(new V3(0, -20, 0))]; for (let z = C.pos.z; z > -6400; z -= 300) path.push(new V3(RU.rx(z), z > C.pos.z - 900 ? 120 : 6, z)); path.push(new V3(RU.rx(-6800), 30, -7600));
    this.kPath = path; let s = 0; this.kS = path.map((p, i) => (s += i ? p.distanceTo(path[i - 1]) : 0)); this.kLen = s; this.kd = 0; this.seaS = this.kS[path.length - 2];
    const mk = (name, chassis, paint) => { const L = G.stockLoadout(chassis); L.paint = paint; const p = g.addPlane({loadout:L, team:1, name, callsign:name.split(' ').slice(-1)[0], pos:path[0].clone(), q:new Q(), speed:70, internalMul:1.4}); p.ace = true; return p; };
    this.runners = [{p:mk('Lucan Ashgrove', 'sparrowhawk', [0xd8dde2, 0x9ef0e0, 0x2a3238]), lag:0}];
    if (this.backer) this.runners.push({p:mk('Ambrose Kroll', 'mantis', [0x1a1a1a, 0xd9b44a, 0xe8e0cc]), lag:45});
    setTimeout(() => { if (G.game === g) G.HUD.radio(ASH, 'Hollis always said I\'d need a pilot one day. Today I am my own.'); }, 1500);
    if (this.backer) setTimeout(() => { if (G.game === g) G.HUD.radio('Kroll', 'Lucan, faster. They are behind us. Again.'); }, 4500);
    setTimeout(() => { if (G.game === g) G.HUD.radio(SPARKS(), 'He\'s going down the river! Under the bridges! Don\'t lose him!'); }, 3000);
  },
  chase(g, dt){
    this.kd = Math.min(this.kLen, this.kd + 72*dt);
    for (const R of this.runners) {
      const K = R.p; if (!K.alive) continue; const d = Math.max(0, this.kd - R.lag); let i = 1; while (i < this.kS.length - 1 && this.kS[i] < d) i++;
      const a = this.kPath[i - 1], b = this.kPath[i], t = (d - this.kS[i - 1])/Math.max(0.01, this.kS[i] - this.kS[i - 1]);
      K.pos.copy(a).lerp(b, t); const dir = tA.copy(b).sub(a).normalize(); K.q.setFromUnitVectors(Z, dir); K.vel.copy(dir).multiplyScalar(72); K.speed = 72; K.throttle = 1; K.axes(); K.sync && K.sync(0);
      g.markers.push({pos:K.pos, label:`${K.callsign.toUpperCase()} · ${fmtD(K.pos.distanceTo(g.player.pos))}`, col:'#ff3b30'});
    }
    const out = this.runners.filter(R => R.p.alive);
    G.HUD.objective(out.length ? `Catch ${out.map(R => R.p.callsign).join(' and ')} before the sea · ${fmtD(Math.max(0, this.seaS - this.kd))} to go` : 'Got him.');
    if (!out.length && !this.caughtT) { this.caughtT = this.pt; G.HUD.radio(SPARKS(), this.runners.length > 1 ? 'Both of them, in the river! The police launches are fishing them out!' : 'Ashgrove\'s in the river! The police launch has him!'); }
    if (this.caughtT && this.pt - this.caughtT > 8) this.win(g);
    if (out.length && this.kd >= this.kLen - 2) { this.escaped = true; G.HUD.radio(SPARKS(), 'He\'s out to sea. Gone.'); this.win(g); }
  },
  sideState(g){ const S = this.ship, left = this.masts.filter(t => t.alive).length, caught = this.runners && this.runners.every(R => !R.p.alive);
    return [{text:this.sides[0].text, st:left ? 'live' : 'ok', val:`${4 - left}/4`}, {text:this.sides[1].text, st:caught ? 'ok' : this.escaped ? 'fail' : 'live', val:''},
            {text:this.sides[2].text, st:S.hp/S.hpMax >= 0.5 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(S.hp/S.hpMax*100) + '%'}]; },
  result(g, kind, why){
    const caught = this.runners && this.runners.every(R => !R.p.alive), both = this.backer;
    return RES(this, g, kind, {cash:this.pay3(g, kind)}, Object.assign({
      perfect:{mood:'pleased', say:`The Conductor's in the river, the ghost squadron is scrap, and ${both ? 'Ashgrove and Kroll are' : 'Ashgrove is'} in a cell on Gantry Island. Della's headline: THIRTEEN BUST GHOSTS.`, then:'Gantry City is quiet, the strike is won, and Dr. Quill has built you something from Ashgrove\'s drawings: the Banshee, a twin-boom fighter that carries its own ghost wingman. Four new liveries come with it.'},
      success:{mood:'pleased', say:caught ? 'The Conductor is down and Ashgrove is in irons.' : 'The Conductor is down and the ghosts are scrap, but Ashgrove got away to sea. A man with no ghosts left.', then:'Gantry City is quiet, the strike is won, and Dr. Quill has built you something from Ashgrove\'s drawings: the Banshee, a twin-boom fighter that carries its own ghost wingman. Four new liveries come with it.'},
      fail:{mood:'angry', say:why === 'margaret' ? 'The Margaret went down over downtown. Everyone got out on the Ziegler mast.' : 'You came down in the storm over the city. The ghosts sang all night.', then:'The Conductor is still over Gantry. We go again.'}
    }[kind]), {ashgrove:caught ? 'caught' : this.escaped ? 'escaped' : 'loose'});
  }
});

/* ---------- the ghost drone: the Banshee's wingman, once a sortie ---------- */
G.launchDrone = g => {
  const P = g.player; if (!P || !P.alive || !P.st.drone || g.droneUsed || g.netGuest) return;
  const L = G.stockLoadout('sparrowhawk'); L.paint = [0xd8dde2, 0x9ef0e0, 0x2a3238];
  const p = g.addPlane({loadout:L, team:0, name:'Ghost drone', callsign:'Drone', pos:P.pos.clone().add(tA.copy(P.right || new V3(1, 0, 0)).multiplyScalar(-30)).add(new V3(0, -10, -20)), q:P.q.clone(), speed:P.speed, ai:{role:'fighter', skill:0.82}});
  p.friend = true; p.drone = true; g.droneUsed = true; g.drone = p;
  G.HUD.toast('Ghost drone away!'); G.HUD.radio('Quill', 'Drone\'s flying! It\'ll go for whatever you\'re fighting. Try not to shoot it.');
};

/* ---------- the story graph, Volume IV ---------- */
Object.assign(G.CHAPTERS, {c10:'Volume IV, Chapter 10: Smoke and Mirrors', c11:'Volume IV, Chapter 11: The Iron Strike', c12:'Volume IV, Chapter 12: Ghost Squadron'});
Object.assign(G.STORY, {
  c10m1:{n:1, ch:'c10', next:r => r.kind === 'fail' ? 'c10m1' : 'c10m2'},
  c10m2:{n:2, ch:'c10', next:() => 'c10m3'},
  c10m3:{n:3, ch:'c10', next:r => r.kind === 'fail' ? 'c10m3' : 'c11m1'},
  c11m1:{n:1, ch:'c11', next:() => 'c11x1'},
  c11x1:{n:2, ch:'c11', next:() => 'c11m2'},   // the Whirligig episode: win or lose, the story goes on to the prison
  c11m2:{n:3, ch:'c11', next:() => 'c11m3'},
  c11m3:{n:4, ch:'c11', next:r => r.kind === 'fail' ? 'c11m3' : 'c12m1'},
  c12m1:{n:1, ch:'c12', next:() => 'c12m2'},
  c12m2:{n:2, ch:'c12', next:r => r.kind === 'fail' ? 'c12m2' : 'c12m3'},
  c12m3:{n:3, ch:'c12', next:r => r.kind === 'fail' ? 'c12m3' : 'c12end'}
});
G.STORY.c9m3.next = r => r.kind === 'fail' ? 'c9m3' : 'c10m1';
const won = id => G.save.story && G.save.story.log.some(l => l.node === id && l.kind !== 'fail');
const grant0 = G.grantStoryAwards;
G.grantStoryAwards = () => {
  grant0();
  const S = G.save;
  if (won('c12m3') && !S.owned.includes('banshee')) { S.owned.push('banshee'); for (const l of ['courier', 'bluecoat', 'steelworks', 'ghost']) if (!S.liveries.includes(l)) S.liveries.push(l); G.persist(); if (G.HUD) G.HUD.toast('New in the hangar: the Banshee and four liveries'); }
};
if (G.save && G.save.story && G.save.story.node === 'c9end') { G.save.story.node = 'c10m1'; G.persist(); }
if (G.save && G.save.story) G.grantStoryAwards();
})();
