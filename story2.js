(function(){
'use strict';
/* =====================================================================
   VOLUME II: "Under the Black Flag"
   Commodore Hale and Naval Intelligence send the Lucky Thirteen into the Calavera Isles disguised as a pirate crew,
   the Black Thirteen, to find out what the Brethren of the Black Flag are building inside a volcano.

   Undercover rules, shared by every episode here:
   - COVER: how far the Brethren trust you (0-100, carried between episodes). Doing the Brethren's dirty work raises it;
     hesitating, sparing people and being seen doing the navy's work lowers it. At 0 your cover is blown: the Brethren
     around you turn their guns on you and you have to get clear, which fails the episode.
   - PIRATE PLANES: you and the crew fly Brethren airframes in Black Thirteen colours, not your hangar plane.
   - SECRET OBJECTIVES: each job has a hidden goal for Hale (photographs, beacons, a handover). Do it where a Brethren
     pilot can see you and it costs cover.
   - CHOICES: burn or spare, shoot or let go. They're recorded as story flags and change later episodes and the ending.
   ===================================================================== */
const G = window.G, V3 = THREE.Vector3, Q = THREE.Quaternion;
const tA = new V3(), tB = new V3(), tC = new V3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), YD = 1.0936;
const base = G.MISSIONS.ambush;
const ISLE = 'calavera';
const PIRATE = [0x161616, 0xe8e0cc, 0x9e1b1b];
const BRETHREN = [[0x161616, 0xe8e0cc, 0x9e1b1b], [0x3a1010, 0x1a1a1a, 0xe0742a], [0x1f1f24, 0xb88a2a, 0xe8e0cc]];
const NAVY = [0x2a3a52, 0xe8edf2, 0xb88a2a];
const BLACK_MARGARET = {hull:0x2a2626, band:0x9e1b1b, trim:0xe8e0cc};
const NICKS = ['Ratline', 'Cutlass', 'Bones', 'Kettle', 'Scurvy', 'Gaff', 'Pegleg', 'Barnacle', 'Shiv', 'Bilge', 'Hangman', 'Powder', 'Grog', 'Splinter', 'Keelhaul', 'Marlin'];
const MOLLY = 'Molly', HALE = 'Hale', BRIM = 'Brimstone';
const flags = () => (G.save.story && G.save.story.flags) || {};
const pirateLoad = ch => { const L = G.stockLoadout(ch); L.paint = PIRATE.slice(); return L; };
const world = time => () => G.regionWorld(ISLE, time);
const RES = (m, g, kind, R, fl) => Object.assign({kind, kills:g.kills, shipPct:m.ship ? Math.round(m.ship.hp/m.ship.hpMax*100) : 100, sides:m.sideState(g), flags:fl || {}}, R);
const ground = (g, x, z) => Math.max(g.world.height(x, z), 0.4);

/* ---------- the undercover kit, mixed into every Volume II episode ---------- */
const UC = {
  undercover:true, crewChassis:'vandal',
  crewLoadout(c){ const L = G.stockLoadout(this.crewChassis); L.paint = [0x161616, c.paint[0], 0x9e1b1b]; return L; },
  ucInit(g, start){
    const F = flags(); this.F = F;
    this.cover = clamp(F.cover ?? start ?? 65, 30, 100); this.allies = []; this.blown = false; this.secret = 0; this.secretT = 0; this.coverNote = ''; this.noteT = 0; this.escT = 0;
    this.scene = G.regionScene(g, ISLE); this.P = this.scene.P;
  },
  pirateLaunch(g, line, o){ this.launch(g, line, Object.assign({shipName:'Black Margaret', shipPaint:BLACK_MARGARET, load:pirateLoad(this.planeChassis || 'vandal')}, o)); },
  coverAdd(d, note){
    if (this.blown) return;
    this.cover = clamp(this.cover + d, 0, 100);
    if (note) { this.coverNote = `${d > 0 ? '+' : ''}${d} · ${note}`; this.noteT = 4.5; }
    if (this.cover <= 0 && !this.ended) this.blow(this.g); else if (this.cover <= 0) this.cover = 1;
  },
  ucTick(g, dt){
    this.scene.tick(dt); this.noteT -= dt;
    G.HUD.cover(this.blown ? 0 : this.cover, this.blown ? 'Cover blown! Get clear of the Brethren' : this.noteT > 0 ? this.coverNote : '');
    if (this.blown && !this.ended) this.escapeTick(g, dt);
  },
  /* the nearest Brethren pilot who could see what you're doing */
  seenBy(pos, r = 700){ let best = null, bd = r; for (const p of this.allies) if (p.alive && p.team === 0) { const d = p.pos.distanceTo(pos); if (d < bd) { bd = d; best = p; } } return best; },
  secretSeen(pos){
    const s = this.seenBy(pos);
    if (s) { this.coverAdd(-15, `${s.callsign} saw that`); G.HUD.radio(s.callsign, G.pick(['Oi! What are you playing at over there?', 'Funny place to go sightseeing, Thirteen.', 'I\'m telling Molly about that.'])); }
  },
  /* Brethren pilots on your side (for now) */
  brethren(g, at, n, o = {}){
    const made = [];
    for (let i = 0; i < n; i++) {
      const L = G.stockLoadout(o.chassis || G.pick(['vandal', 'vandal', 'bulldog', 'highwayman'])); L.paint = BRETHREN[i % BRETHREN.length].slice();
      const nm = G.name1920s({nick:false}), nick = G.pick(NICKS), pos = at.clone().add(new V3((i - (n - 1)/2)*50, i*8, -i*20));
      const p = g.addPlane({loadout:L, team:0, name:`${nm.first} "${nick}" ${nm.last}`, callsign:nick, pos, q:o.q || g.player.q, speed:o.speed || 85, ai:{role:'fighter', skill:o.skill ?? 0.5}, grace:5});
      p.pirate = true; this.allies.push(p); made.push(p);
    }
    return made;
  },
  /* the navy, and anyone else the Brethren want shot at */
  hostiles(g, gang, at, n, o = {}){
    const made = [], used = {}, paints = gang === 'navy' ? [NAVY] : G.GANGS[gang].paints; n = G.squadN(g, n);
    for (let i = 0; i < n; i++) {
      const L = G.gangLoadout(gang, i, n, used, paints[i % paints.length]);
      const nm = G.name1920s(), pos = at.clone().add(new V3((i - (n - 1)/2)*50, (Math.random() - 0.5)*50, (Math.random() - 0.5)*40));
      const face = o.face || g.player.pos, q = new Q().setFromUnitVectors(new V3(0, 0, 1), tA.copy(face).sub(pos).setY(0).normalize());
      const role = o.strafe && i < o.strafe ? 'strafe' : 'fighter';
      const p = g.addPlane({loadout:L, team:1, name:nm.full, callsign:(gang === 'navy' ? 'Lt. ' : '') + nm.short, pos, q, speed:90, ai:{role, skill:(o.skill ?? 0.45) + Math.random()*0.2}});
      if (role === 'strafe' && o.shipTarget) g.pilots[g.pilots.length - 1].shipTarget = o.shipTarget;
      p.gang = gang; made.push(p);
    }
    return made;
  },
  blow(g){
    if (this.blown) return; this.blown = true; this.cover = 0; this.escT = 0;
    G.HUD.radio(MOLLY, G.pick(['I KNEW it. Navy rats, the lot of you. Brethren! Take them!', 'Thirteen\'s turned! Shoot them down, all of them!']));
    setTimeout(() => G.HUD.radio(G.RADIO.short, 'They\'ve made us! Get clear, get clear! Head for open water!'), 2500);
    for (const p of this.allies) if (p.alive) { p.team = 1; for (const pl of g.pilots) if (pl.p === p) pl.target = null; }
    if (this.onBlown) this.onBlown(g);
  },
  escapeTick(g, dt){
    this.escT += dt; const P = g.player; let near = 1e9;
    for (const p of this.allies) if (p.alive && p.team === 1) near = Math.min(near, p.pos.distanceTo(P.pos));
    G.HUD.objective(`COVER BLOWN · get clear of the Brethren${near < 1e8 ? ` · nearest ${Math.round(near*YD)} yd` : ''} · ${Math.max(0, Math.ceil(70 - this.escT))} s`);
    if (near > 2600 || this.escT > 70) { this.ended = true; G.HUD.radio(G.RADIO.short, 'We\'re clear. Barely. Hale\'s going to have kittens.'); g.end(this.result(g, 'fail', 'blown')); }
  },
  /* secret objectives: hold a target in the gunsight (a photograph), or loiter beside it slow and close (a beacon) */
  /* a photograph: frame the target (close enough, and in the gunsight) and press the camera key (P, or the pad's camera button) */
  photoTick(g, dt, pos, need, range = 900){
    const P = g.player, d = pos.distanceTo(P.pos), ang = tA.copy(pos).sub(P.pos).normalize().angleTo(P.fwd), framed = d < range && ang < 0.16;
    this.framed = framed; this.secretT = framed ? 1 : 0;
    if (framed && (this.camHintT = (this.camHintT || 0) - dt) <= 0) { this.camHintT = 4; G.HUD.toast(`In frame · press ${G.keymap ? G.keymap.label(G.keymap.key('KeyP')) : 'P'} to photograph`); }
    if (g.snapPhoto) { if (framed) return true; G.HUD.toast(d >= range ? 'Too far away for a good picture' : 'Nothing in frame: put it in the gunsight'); }
    return false;
  },
  plantTick(g, dt, pos, r = 45, need = 1.6){
    const P = g.player;
    if (P.pos.distanceTo(pos) < r && P.speed < 78) this.secretT += dt; else this.secretT = Math.max(0, this.secretT - dt);
    return this.secretT >= need;
  },
  ucFlags(extra){ return Object.assign({cover:Math.round(this.blown ? 40 : Math.max(this.cover, 30))}, extra || {}); },
  ucDown(g, line){ if (this.ended) return; this.ended = true; G.HUD.radio(G.RADIO.short, line || 'We see your chute! Hold on, we\'re coming!'); g.end(this.result(g, 'fail', 'down')); },
  playerDown(g){ this.ucDown(g); },
  hudDone(g){ G.HUD.sides(this.sideState(g)); }
};
const EP = o => Object.assign(Object.create(base), UC, {story:true}, o);
/* a scripted flyer (no AI pilot): steer toward a point, keep clear of the ground */
function flyTo(g, p, to, o = {}){
  const gh = ground(g, p.pos.x, p.pos.z), ahead = ground(g, p.pos.x + p.fwd.x*300, p.pos.z + p.fwd.z*300);
  tC.copy(to).sub(p.pos); if (o.flat) tC.y = 0; tC.normalize();
  const clear = Math.max(gh, ahead) + (o.agl || 120) - p.pos.y; if (clear > 0) tC.y = Math.max(tC.y, Math.min(0.6, clear/200));
  if (o.weave) tC.x += Math.sin(g.t*0.9 + (o.seed || 0))*o.weave;
  p.steer(tC.normalize()); p.throttle = o.throttle ?? 1; p.fire = false; p.fireRk = false;
}

/* =====================================================================
   Chapter 4, Episode 1: The Black Thirteen
   Black Molly's audition: thread the Teeth, then shoot down a navy patrol while the Brethren watch.
   Secret: photograph Brimstone Keep.
   ===================================================================== */
const TEETH_GATES = [[-1800, -4380], [-1080, -3800], [-360, -4380], [360, -3800], [1080, -4380], [1800, -3800]];
G.MISSIONS.c4m1 = EP({
  id:'c4m1', title:'The Black Thirteen', place:'The Teeth, Calavera Isles', wing:3, planeChassis:'vandal',
  brief:'Commodore Hale has a job nobody else can do. The Brethren of the Black Flag are building something inside a volcano, and the navy can\'t get within a mile of it. So the Lucky Thirteen become the Black Thirteen: a pirate crew with a stolen zeppelin and no questions asked. You fly a Brethren Vandal now. Black Molly Quinn will audition you over the Teeth. Do what pirates do, and don\'t get caught doing what we do.',
  sides:[{text:'Thread all 6 gates through the Teeth'}, {text:'Shoot down the navy patrol'}, {text:'Photograph Brimstone Keep (camera: P)', secret:true}],
  pay:{success:4000, perfect:2000, kill:250},
  worldOpts:world('day'),
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.gate = 0; this.clock = 150; this.stage = 'gates'; this.navy = []; this.idle = 0;
    this.ucInit(g, 60);
    this.pirateLaunch(g, `Hook's live, ${G.save.callsign || 'Ace'}. Or should I say Black Thirteen? The Brethren are watching. Drop, and look mean.`, {pos:new V3(0, 650, -6600), heading:0, turn:0});
  },
  update(g, dt){
    this.pt += dt; const P = g.player; this.ucTick(g, dt);
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) {
      g.spawnWingmen(this.wing); G.HUD.radio('Hellcat', 'Black paint suits me. Don\'t tell anybody I said that.');
      this.brethren(g, new V3(-600, 420, -3400), 3, {skill:0.5}); G.HUD.radio(MOLLY, 'So you\'re the Black Thirteen. Fly the Teeth for me, pretty ones. Six gates. Low.');
    }
    if (this.phase !== 1 || this.ended || this.blown) { this.hudDone(g); return; }
    if (this.stage === 'gates') {
      this.clock -= dt; const gp = TEETH_GATES[this.gate];
      if (gp) {
        const at = new V3(gp[0], ground(g, gp[0], gp[1]) + 24, gp[1]);
        g.markers.push({pos:at, label:`GATE ${this.gate + 1}/6`, col:'#f2c14e'});
        if (Math.hypot(P.pos.x - at.x, P.pos.z - at.z) < 55 && P.pos.y < at.y + 45) { this.gate++; if (g.audio) g.audio.ding(); if (this.gate === 6) G.HUD.radio(MOLLY, 'Not bad. Not bad at all.'); }
      }
      G.HUD.objective(`Thread the Teeth: gate ${Math.min(this.gate + 1, 6)} of 6 · ${Math.max(0, Math.ceil(this.clock))} s`);
      if (this.gate >= 6 || this.clock <= 0) {
        if (this.gate < 4) this.coverAdd(-10, 'a sloppy audition');
        this.stage = 'navy'; this.navyT = 0;
        this.navy = this.hostiles(g, 'navy', new V3(-2500, 520, -1500), 3, {skill:0.45});
        G.HUD.radio(MOLLY, 'Well, would you look at that. A navy patrol, nosing about my Teeth. Put them in the drink, Thirteen, and we\'ll know whose side you\'re on.');
        setTimeout(() => G.HUD.radio(HALE, 'Thirteen, Hale here, on the quiet channel. Those boys have parachutes and orders to bail early. Do what you must. And while you\'re up, get me a picture of Brimstone Keep, on the crown.'), 6000);
      }
    } else if (this.stage === 'navy') {
      this.navyT += dt; const left = this.navy.filter(p => p.alive).length;
      // the Brethren expect you to do the shooting
      if (g.kills === this.lastKills) this.idle += dt; else { this.idle = 0; if (this.lastKills !== undefined) this.coverAdd(6, 'a navy kill'); this.lastKills = g.kills; }
      if (this.lastKills === undefined) this.lastKills = g.kills;
      if (this.idle > 35) { this.idle = 0; this.coverAdd(-10, 'Molly says you\'re shy of the navy'); G.HUD.radio(MOLLY, 'You\'re awful quiet back there, Thirteen. Shy of the navy?'); }
      G.HUD.objective(`Shoot down the navy patrol: ${left} left${this.secret ? '' : ' · (Hale wants a photo of Brimstone Keep, on the crown)'}`);
      if (!left) { this.ended = true; const ok = this.sideState(g).filter(s => s.st === 'ok').length; G.HUD.radio(MOLLY, 'Welcome to the Brethren, Black Thirteen. Port Jawbone is yours to drink dry.'); g.end(Object.assign(this.result(g, ok === 3 && this.cover >= 70 ? 'perfect' : 'success'), {delay:5000})); }
    }
    // secret: the Keep, from close and steady
    if (!this.secret) {
      const K = this.P.keep.clone().add(new V3(0, 30, 0));
      if (P.pos.distanceTo(K) < 2500) g.markers.push({pos:K, label:this.framed ? 'IN FRAME · PRESS CAMERA' : 'BRIMSTONE KEEP (photograph)', col:'#c9a6f0', box:true});
      if (this.photoTick(g, dt, K)) { this.secret = 1; G.HUD.toast('Got the Keep on film'); G.HUD.radio(HALE, 'Lovely. Flak on the north wall, a hangar under the east tower. Thank you, Thirteen.'); this.secretSeen(P.pos); }
    }
    this.hudDone(g);
  },
  onKill(){},
  sideState(g){ return [{text:this.sides[0].text, st:this.gate >= 6 ? 'ok' : this.stage === 'gates' && !this.ended ? 'live' : 'fail', val:`${this.gate}/6`},
    {text:this.sides[1].text, st:this.stage === 'navy' && !this.navy.some(p => p.alive) ? 'ok' : 'live', val:this.navy.length ? `${this.navy.filter(p => !p.alive).length}/${this.navy.length}` : ''},
    {text:this.sides[2].text, secret:true, st:this.secret ? 'ok' : this.ended ? 'fail' : 'live', val:this.secret ? 'got it' : ''}]; },
  result(g, kind, why){
    const cash = kind === 'fail' ? 600 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill;
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:'Molly bought every word, and Hale has a photograph of the Keep pinned to his wall. I\'m almost proud of us. Almost.', then:'The Black Thirteen are drinking in Port Jawbone with the worst people on the coast. Molly has a job for them already: a payroll blimp out of Ashfall.'},
      success:{mood:'stern', say:'We\'re in. The Brethren think we\'re pirates. I\'m not sure Hellcat isn\'t.', then:'The Black Thirteen are drinking in Port Jawbone with the worst people on the coast. Molly has a job for them already: a payroll blimp out of Ashfall.'},
      fail:{mood:'angry', say:why === 'blown' ? 'Molly saw straight through us. Hale\'s talked her round with a forged letter of marque, but she\'ll be watching.' : 'You came down in the Teeth. Molly fished you out and laughed for ten minutes. We\'re in, but nobody\'s impressed.', then:'Somehow the Black Thirteen are still welcome in Port Jawbone. Molly has a job for them: a payroll blimp out of Ashfall.'}
    }[kind]), this.ucFlags({keepPhoto:this.secret ? 1 : 0}));
  }
});

/* =====================================================================
   Chapter 4, Episode 2: Prize of the Sulphur Line
   Raid the Ashfall payroll blimp with Molly's raiders, make her strike, then the choice: burn her or let her go.
   Secret: slip a beacon into her strongroom so the navy can follow the payroll to the Brethren treasury.
   ===================================================================== */
G.MISSIONS.c4m2 = EP({
  id:'c4m2', weather:'smog', region:'calavera', title:'Prize of the Sulphur Line', place:'Off Ashfall, Calavera Isles', wing:3, planeChassis:'vandal',
  brief:'The Ashfall Sulphur Company flies its payroll out once a month in the blimp Ashfall Queen, under a navy escort. Molly wants it. Shoot the escort off her, put enough holes in her that she strikes her colours, and the Brethren will do the rest. Hale wants a beacon in the strongroom so the navy can follow the money home.',
  sides:[{text:'Shoot down the navy escort'}, {text:'Make the Ashfall Queen strike her colours'}, {text:'Plant a beacon on the Queen\'s gondola', secret:true}],
  pay:{success:4500, perfect:2000, kill:250},
  worldOpts:world('day'),
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.struck = false; this.choiceT = 0; this.choice = null; this.waves = 0;
    this.ucInit(g);
    const A = this.P.ashfall;
    this.pirateLaunch(g, 'Hook\'s live. The payroll blimp lifts off from Ashfall in a minute. Molly\'s raiders are already up.', {pos:new V3(A.x - 2400, 700, A.z - 1800), heading:0.8, turn:0});
    this.queen = g.addShip({team:1, kind:'blimp', name:'Ashfall Queen', paint:{hull:0xd8c890, band:0x5a5a52, trim:0xd9b44a}, pos:new V3(A.x + 200, 380, A.z + 300), heading:0.9, speed:11, turn:0.01, hp:1500, dest:new V3(A.x + 6000, 0, A.z + 4200)});
    this.escort = [];
  },
  update(g, dt){
    this.pt += dt; const P = g.player, Qn = this.queen; this.ucTick(g, dt);
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) {
      g.spawnWingmen(this.wing); this.brethren(g, P.pos.clone().add(new V3(80, 30, -100)), 3, {skill:0.5});
      this.escort = this.hostiles(g, 'navy', Qn.pos.clone().add(new V3(0, 120, 300)), 3, {skill:0.45, face:P.pos});
      G.HUD.radio(MOLLY, 'There she is, fat and slow. Escort first, then make her strike. Nobody burns her until I say.');
    }
    if (this.phase !== 1 || this.ended || this.blown) { this.hudDone(g); return; }
    if (this.escort.length && !this.escort.some(p => p.alive) && this.waves === 0 && this.pt > 20) { this.waves = 1; this.escort.push(...this.hostiles(g, 'navy', Qn.pos.clone().add(new V3(1200, 300, 900)), 2, {skill:0.5})); G.HUD.radio(G.RADIO.short, 'Two more navy fighters coming up from Ashfall!'); }
    // she strikes when she's badly hurt
    if (!this.struck && Qn.alive && Qn.hp < Qn.hpMax*0.45) {
      this.struck = true; Qn.dest = null; Qn.speed0 = Qn.speed = 2.5; Qn.state = 'struck';
      G.HUD.radio('Ashfall Queen', 'We strike! We strike! For God\'s sake, hold your fire, there are miners\' families aboard!');
      setTimeout(() => { if (!this.ended) G.HUD.radio(MOLLY, 'She\'s struck. The lads are taking the strongboxes off. Then burn her, Thirteen. No witnesses.'); }, 3500);
      setTimeout(() => { if (!this.ended) G.HUD.radio(G.RADIO.short, 'Families aboard... Your call. If you don\'t burn her, Molly will notice.'); }, 8000);
    }
    if (this.struck && !this.choice) {
      this.choiceT += dt;
      if (!Qn.alive) { this.choice = 'burned'; this.coverAdd(15, 'you burned the Queen'); G.HUD.radio(MOLLY, 'Ha! Now that\'s a Brethren answer.'); }
      else if (this.choiceT > 30) { this.choice = 'spared'; this.coverAdd(-20, 'you let the Queen go'); Qn.dest = new V3(this.P.ashfall.x, 0, this.P.ashfall.z); Qn.speed0 = Qn.speed = 6; G.HUD.radio(MOLLY, 'Soft, Thirteen. Soft. I\'ll remember that.'); setTimeout(() => G.HUD.radio('Ashfall Queen', 'God bless you, whoever you are.'), 3000); }
    }
    // secret: a beacon in the gondola, close and slow
    if (!this.secret && Qn.alive) {
      const gp = Qn.worldPoint(new V3(0, -16, 4), new V3());
      if (P.pos.distanceTo(gp) < 1200) g.markers.push({pos:gp, label:this.secretT > 0 ? `BEACON ${Math.round(this.secretT/1.6*100)}%` : 'QUEEN\'S GONDOLA (slow, close)', col:'#c9a6f0'});
      if (this.plantTick(g, dt, gp, 50)) { this.secret = 1; G.HUD.toast('Beacon planted'); G.HUD.radio(HALE, 'Beacon\'s live. We\'ll follow the money home. Well done.'); this.secretSeen(P.pos); }
    }
    const esc = this.escort.filter(p => p.alive).length;
    G.HUD.objective(!this.struck ? `Escort fighters left: ${esc} · make the Ashfall Queen strike (${Math.round(Qn.hp/Qn.hpMax*100)}%)` : !this.choice ? `The Queen has struck · Molly says burn her · ${Math.max(0, Math.ceil(30 - this.choiceT))} s` : esc ? `Escort fighters left: ${esc}` : 'Done');
    if (this.choice && !esc && !this.ended) {
      this.ended = true; const ok = this.sideState(g).filter(s => s.st === 'ok').length;
      g.end(Object.assign(this.result(g, ok === 3 ? 'perfect' : 'success'), {delay:5500}));
    }
    this.hudDone(g);
  },
  onShipDown(g, ship){ if (ship === this.queen && !this.struck) { this.struck = true; this.choice = 'burned'; G.HUD.radio(MOLLY, 'You burned her before she struck, you animal. The strongboxes went with her. Still: no witnesses.'); this.coverAdd(5, 'ruthless'); } },
  onShipRun(){}, onShipStopped(){ return true; }, onKill(){},
  sideState(g){ const Qn = this.queen; return [{text:this.sides[0].text, st:this.escort.length && !this.escort.some(p => p.alive) ? 'ok' : 'live', val:`${this.escort.filter(p => !p.alive).length}/${this.escort.length}`},
    {text:this.sides[1].text, st:this.struck ? 'ok' : 'live', val:this.choice || (Qn.alive ? Math.round(Qn.hp/Qn.hpMax*100) + '%' : '')},
    {text:this.sides[2].text, secret:true, st:this.secret ? 'ok' : this.ended ? 'fail' : 'live', val:''}]; },
  result(g, kind, why){
    const cash = kind === 'fail' ? 600 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill, spared = this.choice === 'spared';
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:spared ? 'pleased' : 'stern', say:spared ? 'You let her go, and you got the beacon in. Molly\'s sulking. I\'m not.' : 'The beacon\'s in and the Brethren think you\'re a monster. I suppose that\'s the job.', then:'The payroll is on its way to the Brethren treasury, with Hale\'s beacon in it. Then trouble: someone at the Gallows has recognised the Black Thirteen.'},
      success:{mood:'stern', say:spared ? 'The Queen made it home. Molly\'s cross. Hale says it\'s a fair trade.' : 'The Queen\'s burning on the water. The lads got the boxes off first. I don\'t want to talk about it.', then:'Then trouble: someone at the Gallows has recognised the Black Thirteen.'},
      fail:{mood:'angry', say:why === 'blown' ? 'They saw through us. Hale\'s spun them a story about a navy double-cross, but Molly is watching us now.' : 'We lost you over Ashfall. The Brethren took the payroll without us.', then:'Then trouble: someone at the Gallows has recognised the Black Thirteen.'}
    }[kind]), this.ucFlags({queen:this.choice === 'spared' ? 'spared' : 'burned', treasuryBeacon:this.secret ? 1 : 0}));
  }
});

/* =====================================================================
   Chapter 4, Episode 3: A Knife in the Dark
   Silas Dunmore, the Lantern pilot from Port Halcyon, has recognised you and is flying to tell Brimstone.
   Catch him before he reaches the Keep, without the night patrols seeing you do it. Secret: recover his letter.
   ===================================================================== */
G.MISSIONS.c4m3 = EP({
  id:'c4m3', weather:'rain', region:'calavera', title:'A Knife in the Dark', place:'Gallows Point to Brimstone Keep, Calavera Isles, night', wing:0, planeChassis:'vandal',
  brief:'Silas Dunmore, the Black Lantern pilot who led us to Skull Rock, washed up in the Calavera and he\'s seen your face at the Gallows. He\'s taken off for Brimstone Keep to sell you out. Catch him before he gets there. The Brethren fly night patrols along the crown: if one of them sees you shooting at a Brethren pilot, you\'re finished. Alone, in the dark, and quickly.',
  sides:[{text:'Stop Dunmore before he reaches the Keep'}, {text:'Don\'t shoot him where a patrol can see'}, {text:'Recover his letter from the wreck', secret:true}],
  pay:{success:5000, perfect:2500, kill:0},
  worldOpts:world('night'),
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.seenShots = 0; this.crash = null; this.dun = null; this.hitT = 0;
    this.ucInit(g);
    const Gp = this.P.gallows;
    this.launch(g, `Hook's live. Dunmore's warming up at the Gallows. Drop and go, ${G.save.callsign || 'Ace'}. Lights off.`, {pos:new V3(Gp.x - 900, 600, Gp.z - 1600), heading:0.4, turn:0, shipName:'Black Margaret', shipPaint:BLACK_MARGARET, load:pirateLoad('vandal')});
  },
  drop(){
    base.drop.call(this); const g = this.g, Gp = this.P.gallows, K = this.P.keep;
    const L = G.stockLoadout('sparrowhawk'); L.paint = [0x7a1f1f, 0x1b1b1b, 0xd9b44a];
    this.dun = g.addPlane({loadout:L, team:1, name:'Silas Dunmore', callsign:'Dunmore', pos:new V3(Gp.x, Gp.y + 150, Gp.z), q:new Q().setFromUnitVectors(new V3(0, 0, 1), tA.copy(K).sub(Gp).setY(0).normalize()), speed:70});
    this.dun.ace = true;
    this.patrols = [this.brethren(g, new V3(-500, 520, 600), 1, {skill:0.4})[0], this.brethren(g, new V3(600, 560, 1700), 1, {skill:0.4})[0]];
    this.patrolPts = [[new V3(-900, 520, 200), new V3(400, 520, 1000)], [new V3(900, 560, 1400), new V3(-300, 560, 2000)]];
    for (const p of this.patrols) g.pilots = g.pilots.filter(pl => pl.p !== p);   // scripted: they fly their beats
    G.HUD.radio(G.RADIO.short, 'He\'s off! Sparrowhawk, Lantern colours, heading north for the crown. Patrol lights on the crown road. Don\'t let them see you do it.');
  },
  update(g, dt){
    this.pt += dt; const P = g.player, D = this.dun, K = this.P.keep; this.ucTick(g, dt);
    if (this.phase !== 1 || this.ended || this.blown || !D) { this.hudDone(g); return; }
    // the patrols fly their beats; if they see Dunmore under fire, they report it
    this.patrols.forEach((p, i) => { if (!p.alive) return; const pts = this.patrolPts[i], k = Math.floor(this.pt/40) % 2; flyTo(g, p, pts[k], {throttle:0.7, agl:200}); p.fire = false;
      if (P.pos.distanceTo(p.pos) < 1400) g.markers.push({pos:p.pos, label:'PATROL', col:'#8fe3a8', noDist:false}); });
    if (D.alive) {
      flyTo(g, D, K.clone().add(new V3(0, 260, 0)), {weave:0.35, seed:3, agl:140});
      g.markers.push({pos:D.pos, label:'DUNMORE', col:'#ff6b57'});
      if (D.pos.distanceTo(K) < 700 && !this.ended) {
        this.ended = true; G.HUD.radio(BRIM, 'Silas Dunmore says the Black Thirteen are navy. Interesting. Very interesting.');
        this.cover = Math.max(1, this.cover - 40); g.end(this.result(g, 'fail', 'talked'));
      }
    } else if (this.crash) {
      if (!this.secret) {
        g.markers.push({pos:this.crash, label:this.secretT > 0 ? `SEARCHING ${Math.round(this.secretT/1.6*100)}%` : 'DUNMORE\'S WRECK (low and slow)', col:'#c9a6f0'});
        const agl = P.pos.y - ground(g, P.pos.x, P.pos.z), close = Math.hypot(P.pos.x - this.crash.x, P.pos.z - this.crash.z) < 140 && agl < 70;
        if (close) this.secretT += dt; else this.secretT = Math.max(0, this.secretT - dt);
        if (this.secretT > 1.6) { this.secret = 1; G.HUD.toast('Letter recovered'); G.HUD.radio(G.RADIO.short, 'Got his satchel! "To Captain Brimstone, the Black Thirteen are Thorne\'s crew from Halcyon..." Well. Nobody\'s reading that now.'); this.secretSeen(P.pos); }
      }
      this.endT = (this.endT || 0) + dt;
      if ((this.secret || this.endT > 45) && !this.ended) { this.ended = true; const ok = this.sideState(g).filter(s => s.st === 'ok').length; g.end(Object.assign(this.result(g, ok === 3 ? 'perfect' : 'success'), {delay:4000})); }
    }
    G.HUD.objective(D.alive ? `Stop Dunmore · ${Math.round(D.pos.distanceTo(K)*YD)} yd from the Keep · patrols watching` : this.secret ? 'Done' : `Dunmore's down · recover his letter from the wreck before the Brethren do (${Math.max(0, Math.ceil(45 - (this.endT || 0)))} s)`);
    this.hudDone(g);
  },
  onHit(g, target, src){},
  onKill(g, plane){ if (plane === this.dun) { this.crash = plane.pos.clone(); this.crash.y = ground(g, plane.pos.x, plane.pos.z); G.HUD.radio(G.RADIO.short, 'Dunmore\'s down. His chute\'s drifting out to sea. The Brethren will think he ran.'); } },
  sideState(g){ const D = this.dun; return [{text:this.sides[0].text, st:D && !D.alive ? 'ok' : this.ended ? 'fail' : 'live', val:''}, {text:this.sides[1].text, st:this.seenShots ? 'fail' : D && !D.alive ? 'ok' : 'live', val:this.seenShots ? 'seen' : ''},
    {text:this.sides[2].text, secret:true, st:this.secret ? 'ok' : this.ended ? 'fail' : 'live', val:''}]; },
  result(g, kind, why){
    const cash = kind === 'fail' ? 500 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0);
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:'Dunmore\'s swimming home, his letter\'s in my pocket and nobody saw a thing. Hale owes you a drink. Several.', then:'With Dunmore gone, the Brethren trust the Black Thirteen enough to promote them. Brimstone himself has a job: run the navy blockade.'},
      success:{mood:'stern', say:this.seenShots ? 'Dunmore\'s down, but a patrol saw you do it. Molly wants to know why we shot one of her own.' : 'Dunmore\'s down. His letter wasn\'t on him, or we didn\'t find it. Let\'s hope it sank.', then:'Somehow the Black Thirteen get promoted. Brimstone himself has a job: run the navy blockade.'},
      fail:{mood:'angry', say:why === 'talked' ? 'Dunmore made it to the Keep. Brimstone has heard his story. Hale\'s forged us an alibi, but Brimstone\'s eyes are on us now.' : why === 'blown' ? 'The patrols saw everything. Hale\'s talked us back in, just. Don\'t make me do that again.' : 'We lost you in the dark. Dunmore got away clean.', then:'Brimstone isn\'t sure about the Black Thirteen. So he gives them a test: run the navy blockade.'}
    }[kind]), this.ucFlags({dunmore:this.dun && !this.dun.alive ? 'down' : 'talked', letter:this.secret ? 1 : 0}));
  }
});
/* shots at Dunmore where a patrol can see cost cover (checked as hits land) */
G.MISSIONS.c4m3.onHitBy = function(g, target, src){
  if (target !== this.dun || !src || !src.isPlayer || this.blown) return;
  const s = this.seenBy(target.pos, 1100); if (!s || this.pt - (this.seenT || -99) < 4) return;
  this.seenT = this.pt; this.seenShots++; this.coverAdd(-25, `${s.callsign} saw you shoot Dunmore`); G.HUD.radio(s.callsign, 'Oi! That\'s Silas! What are you shooting at Silas for?!');
};

/* =====================================================================
   Chapter 5, Episode 1: Running the Blockade
   Escort the Brethren arms zeppelin Gilded Gull past the navy cruiser Resolute.
   The choice: defend the Gull, or fly through Hale's signal smoke and let the navy take her.
   ===================================================================== */
G.MISSIONS.c5m1 = EP({
  id:'c5m1', weather:'overcast', region:'calavera', title:'Running the Blockade', place:'West of Smoke Harbour, Calavera Isles, evening', wing:3, planeChassis:'bulldog', crewChassis:'bulldog',
  brief:'Promotion: the Black Thirteen get Brethren Bulldogs and a real job. The arms zeppelin Gilded Gull is running guns out past the navy cruiser Resolute, and Brimstone wants you on her escort. Those guns will crew the thing in the volcano. Hale has left a smoke marker behind the navy line. Fly through it and the Resolute will know the Black Thirteen are standing aside. Or fight for the Gull, and keep your cover.',
  sides:[{text:'Get the Gilded Gull past the blockade, or signal Hale'}, {text:'Keep the Black Margaret above 50%'}, {text:'Fly through Hale\'s signal smoke', secret:true}],
  pay:{success:5500, perfect:2500, kill:200},
  worldOpts:world('evening'),
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.signal = false; this.navyKills0 = 0; this.waves = 0; this.waveT = 25;
    this.ucInit(g);
    const S = this.P.smoke;
    this.pirateLaunch(g, 'Hook\'s live. The Gull\'s off our bow. Brimstone\'s watching from the Keep. So is Hale, from the other side.', {pos:new V3(S.x - 600, 700, S.z - 500), heading:-Math.PI/2, turn:0});
    this.ship.dest = new V3(-9000, 0, -600); this.ship.speed0 = this.ship.speed = 7;
    this.gull = g.addShip({team:0, kind:'raider', name:'Gilded Gull', label:'GILDED GULL', paint:{hull:0x3a2a20, band:0xb88a2a, trim:0x161616, scale:0.85, hpMul:0.8}, pos:new V3(S.x - 300, 640, S.z + 200), heading:-Math.PI/2, speed:9, turn:0.01, noRun:true, dest:new V3(-8600, 0, 300)});
    this.resolute = g.addShip({team:1, name:'HMS Resolute', paint:{hull:0x8a96a4, band:0x2a3a52, trim:0xb88a2a}, pos:new V3(-6400, 760, -200), heading:Math.PI/2, speed:4, turn:0.006, hp:5000, flak:true, guns:[new V3(7, -24, 26), new V3(-7, -24, -8)], noRun:true});
    this.smokeAt = new V3(-7300, 520, -1400);
    this.resolute.foe = this.gull; this.resolute.standoff = 900;
  },
  update(g, dt){
    this.pt += dt; const P = g.player, Gu = this.gull; this.ucTick(g, dt);
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); this.brethren(g, Gu.pos.clone().add(new V3(0, 60, -150)), 3, {skill:0.5, chassis:'bulldog'}); G.HUD.radio(BRIM, 'Black Thirteen. Get my guns through, and you\'ll sit at my table.'); }
    if (this.phase !== 1 || this.ended || this.blown) { this.hudDone(g); return; }
    this.waveT -= dt;
    if (this.waveT <= 0 && this.waves < 4 && this.resolute.alive) { this.waveT = 40; this.waves++; const n = this.waves === 1 ? 3 : 2;
      this.hostiles(g, 'navy', this.resolute.pos.clone().add(new V3(300, -80, 0)), n, {skill:0.5, strafe:this.signal ? n : 1, shipTarget:Gu});
      G.HUD.radio(G.RADIO.short, `${n} navy fighters off the Resolute${this.signal ? ', and they\'re going for the Gull' : ''}!`); }
    // the secret: Hale's smoke, behind the navy line
    if (!this.signal) {
      g.markers.push({pos:this.smokeAt, label:'HALE\'S SIGNAL SMOKE', col:'#c9a6f0'});
      if (P.pos.distanceTo(this.smokeAt) < 90) {
        this.signal = true; this.secret = 1; G.HUD.toast('Signal given');
        G.HUD.radio(HALE, 'Signal received, Thirteen. Stand aside. The Resolute will take the Gull.');
        this.coverAdd(-10, 'Brimstone will wonder where you went'); this.secretSeen(P.pos);
        for (const pl of g.pilots) if (pl.p.team === 1) { pl.role = 'strafe'; pl.shipTarget = Gu; }
        this.resolute.foe = Gu; this.resolute.standoff = 600;
      }
    }
    if (Gu.alive) g.markers.push({pos:Gu.worldPoint(new V3(0, 40, 0), new V3()), label:'GILDED GULL', col:'#8fe3a8', edgeOnly:true});
    const toGo = Gu.alive ? Math.hypot(Gu.pos.x - Gu.dest.x, Gu.pos.z - Gu.dest.z) : 0;
    G.HUD.objective(Gu.alive ? `Gilded Gull ${Math.round(Gu.hp/Gu.hpMax*100)}% · ${Math.round(toGo*YD)} yd to open water${this.signal ? ' · you\'ve signalled Hale' : ''}` : 'The Gull is gone');
    if (Gu.alive && toGo < 400 && !this.ended) {
      this.ended = true; this.coverAdd(15, 'the Gull got through');
      G.HUD.radio(BRIM, 'My guns are through. Black Thirteen, you have a seat at my table.');
      g.end(Object.assign(this.result(g, this.ship.hp/this.ship.hpMax >= 0.5 && this.cover >= 60 ? 'perfect' : 'success'), {delay:5000}));
    }
    this.hudDone(g);
  },
  onShipDown(g, ship){
    if (ship === this.gull && !this.ended) { this.ended = true;
      if (this.signal) { G.HUD.radio(HALE, 'The Gull\'s going down and her crew are in the boats. Those guns will never reach the Calavera. Thank you, Thirteen.'); g.end(Object.assign(this.result(g, 'success', 'taken'), {delay:5000})); }
      else { G.HUD.radio(BRIM, 'You lost my Gull. You LOST my GULL.'); this.cover = Math.max(1, this.cover - 25); g.end(this.result(g, 'fail', 'lost')); } }
    if (ship === this.ship && !this.ended) { this.ended = true; g.end(this.result(g, 'fail', 'margaret')); }
  },
  onShipRun(){}, onShipStopped(){ return true; }, onKill(){},
  sideState(g){ return [{text:this.sides[0].text, st:this.ended && (this.gull.alive || this.signal) ? 'ok' : this.gull.alive ? 'live' : this.signal ? 'ok' : 'fail', val:this.signal ? 'signalled' : ''},
    {text:this.sides[1].text, st:this.ship.hp/this.ship.hpMax >= 0.5 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(this.ship.hp/this.ship.hpMax*100) + '%'},
    {text:this.sides[2].text, secret:true, st:this.secret ? 'ok' : this.ended ? 'fail' : 'live', val:''}]; },
  result(g, kind, why){
    const cash = kind === 'fail' ? 600 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill, taken = this.signal && !this.gull.alive;
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'stern', say:'The Gull got through and Brimstone loves us. I hope those guns never get used.', then:'The Black Thirteen have a seat at Brimstone\'s table. And a rival: Red Bess Malone has stolen the map to Old Brimstone\'s treasure.'},
      success:{mood:taken ? 'pleased' : 'stern', say:taken ? 'The navy took the Gull. Brimstone thinks it was bad luck. Molly thinks it was us.' : 'The guns are through. I\'m not proud of it.', then:'Next: Red Bess Malone has stolen the map to Old Brimstone\'s treasure, and Brimstone wants it back.'},
      fail:{mood:'angry', say:why === 'blown' ? 'They made us at the blockade. Hale\'s talked Brimstone round. Barely.' : why === 'margaret' ? 'The Margaret took a beating and we limped home.' : 'The Gull is lost and Brimstone blames us.', then:'Brimstone gives the Black Thirteen one more chance: Red Bess Malone has stolen the map to Old Brimstone\'s treasure.'}
    }[kind]), this.ucFlags({gull:taken ? 'taken' : this.gull.alive ? 'through' : 'lost'}));
  }
});

/* =====================================================================
   Chapter 5, Episode 2: The Devil's Gullet
   Beat Red Bess Malone to Old Brimstone's chest in the Devil's Gullet lava tube, with her on your tail.
   Choice: when she yields, finish her or let her go. Secret: photograph the Leviathan in the Burning Eye.
   ===================================================================== */
G.MISSIONS.c5m2 = EP({
  id:'c5m2', weather:'ash', region:'calavera', title:'The Devil\'s Gullet', place:'Mount Cranium, Calavera Isles', wing:0, planeChassis:'bulldog',
  brief:'Red Bess Malone stole Old Brimstone\'s map and she\'s going for his chest, on a ledge inside the Devil\'s Gullet, a lava tube under the crown. Brimstone wants it first. Fly the Gullet, grab the chest, bring it to Port Jawbone. Bess will be on your tail the whole way. And Hale says the thing in the volcano can be seen from the rim of the Burning Eye: get him a photograph.',
  sides:[{text:'Grab the chest in the Devil\'s Gullet'}, {text:'Bring it to Port Jawbone'}, {text:'Photograph what\'s in the Burning Eye (camera: P)', secret:true}],
  pay:{success:6000, perfect:2500, kill:0},
  worldOpts:world('day'),
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.stage = 'gullet'; this.bess = null; this.yielded = false; this.clock = 360;
    this.ucInit(g);
    const T = this.scene.tunnels.find(t => t.T.td.id === 'gullet').T; this.T = T;
    this.mouth = new V3(T.pts[T.i0].x, T.floor + 10, T.pts[T.i0].z); this.mid = new V3(T.mid.x, T.floor + 8, T.mid.z);
    const s = this.mouth.clone().addScaledVector(new V3(-T.pts[T.i0].dx, 0, -T.pts[T.i0].dz), 2600); s.y = 700;
    this.pirateLaunch(g, 'Hook\'s live. The Gullet mouth is off the bow. Bess is somewhere close. Drop and go!', {pos:s, heading:Math.atan2(this.mouth.x - s.x, this.mouth.z - s.z), turn:0});
    // the Leviathan, half built, in the lava lake
    const B = this.P.burning;
    this.lev = G.buildRaider({hull:0x1a1717, band:0x9e1b1b, trim:0xb88a2a, scale:2.4, name:'LEVIATHAN'}); this.lev.position.set(B.x, 70, B.z); this.lev.rotation.y = 0.6; g.scene.add(this.lev);
    this.levAt = new V3(B.x, 110, B.z);
    this.guards = [];
  },
  drop(){
    base.drop.call(this); const g = this.g, P = g.player;
    const L = G.stockLoadout('mantis'); L.paint = [0x9e1b1b, 0x161616, 0xe8e0cc]; L.guns = [{cal:'60', ammo:'ex'}, {cal:'30', ammo:'slug'}];
    this.bess = g.addPlane({loadout:L, team:1, name:'Bess Malone', callsign:'Red Bess', pos:P.pos.clone().addScaledVector(P.fwd, -700).add(new V3(0, 80, 0)), q:P.q, speed:80, ai:{role:'fighter', skill:0.8}, internalMul:1.8});
    this.bess.ace = true; const pl = g.pilots[g.pilots.length - 1]; pl.target = P; pl.retT = 999;
    this.guards = this.brethren(g, this.levAt.clone().add(new V3(-900, 300, 0)), 2, {skill:0.4}); for (const p of this.guards) g.pilots = g.pilots.filter(pl => pl.p !== p);   // they fly their beat round the Eye
    G.HUD.radio('Red Bess', `That chest is mine, Thirteen. Old Brimstone owed my father, and the son pays. Go home.`);
  },
  update(g, dt){
    this.pt += dt; const P = g.player, B = this.bess; this.ucTick(g, dt);
    if (this.phase !== 1 || this.ended || this.blown) { this.hudDone(g); return; }
    this.clock -= dt;
    for (const p of this.guards) if (p.alive) { flyTo(g, p, this.levAt.clone().add(new V3(Math.sin(this.pt*0.15 + (p === this.guards[0] ? 0 : 3))*900, 300, Math.cos(this.pt*0.15)*900)), {throttle:0.6, agl:150}); }
    if (this.stage === 'gullet') {
      g.markers.push({pos:this.mouth, label:'THE DEVIL\'S GULLET', col:'#f2c14e'});
      if (P.pos.distanceTo(this.mid) < 40) { this.stage = 'home'; if (g.audio) g.audio.ding(); G.HUD.toast('Got the chest!'); G.HUD.radio(G.RADIO.short, 'You\'ve got it! Old Brimstone\'s chest! Now get it to Port Jawbone!'); }
    } else if (this.stage === 'home') {
      const J = this.P.jawbone; g.markers.push({pos:J.clone().add(new V3(0, 60, 0)), label:'PORT JAWBONE', col:'#f2c14e'});
      if (Math.hypot(P.pos.x - J.x, P.pos.z - J.z) < 400 && !this.ended) {
        this.ended = true; const ok = this.sideState(g).filter(s => s.st === 'ok').length;
        G.HUD.radio(BRIM, 'Old Brimstone\'s chest. My father\'s gold, home at last. You\'ve earned your place, Black Thirteen.');
        g.end(Object.assign(this.result(g, ok === 3 && this.cover >= 55 ? 'perfect' : 'success'), {delay:5000}));
      }
    }
    // Bess yields when she's had enough; finish her or let her go
    if (B && B.alive && !this.yielded && B.internal < B.internalMax*0.35) {
      this.yielded = true; B.noTarget = true; g.pilots = g.pilots.filter(pl => pl.p !== B);
      G.HUD.radio('Red Bess', 'Enough! ENOUGH. You win, Thirteen. Let me go and I\'ll owe you one. Bess Malone pays her debts.');
      setTimeout(() => { if (!this.ended && B.alive) G.HUD.radio(MOLLY, 'Finish her, Thirteen. The Brethren don\'t leave debts walking about.'); }, 3500);
    }
    if (B && B.alive && this.yielded) { flyTo(g, B, new V3(B.pos.x + B.fwd.x*2000, 500, B.pos.z + B.fwd.z*2000), {flat:true, agl:200}); }
    // the secret: the thing in the Burning Eye
    if (!this.secret) {
      if (P.pos.distanceTo(this.levAt) < 3000) g.markers.push({pos:this.levAt, label:this.framed ? 'IN FRAME · PRESS CAMERA' : 'THE BURNING EYE (photograph)', col:'#c9a6f0', box:true});
      if (this.photoTick(g, dt, this.levAt, 2.5, 1100)) { this.secret = 1; G.HUD.toast('Photographed the Leviathan'); G.HUD.radio(HALE, 'Good Lord. That\'s a zeppelin. Twice the size of anything in the navy. In a VOLCANO.'); this.secretSeen(P.pos); }
    }
    if (this.clock <= 0 && !this.ended) { this.ended = true; G.HUD.radio(G.RADIO.short, 'Too slow. Bess has the gold.'); g.end(this.result(g, 'fail', 'slow')); }
    G.HUD.objective(this.stage === 'gullet' ? `Fly into the Devil's Gullet and grab the chest on the ledge · ${Math.ceil(this.clock)} s` : `Bring the chest to Port Jawbone · ${Math.ceil(this.clock)} s${B && B.alive && this.yielded ? ' · Bess has yielded' : ''}`);
    this.hudDone(g);
  },
  onKill(g, plane, src){ if (plane === this.bess) { this.bessByYou = !!(src && src.isPlayer) || !this.yielded; if (this.yielded && !this.bessByYou) { G.HUD.radio(G.RADIO.short, 'Bess went into the rocks. Nobody shot her. Poor devil.'); return; } if (this.yielded) { this.coverAdd(10, 'no debts walking about'); G.HUD.radio(G.RADIO.short, 'She\'d yielded. ...We\'re pirates now, I suppose.'); } else G.HUD.radio('Red Bess', 'Damn you, Thirteen!'); } },
  sideState(g){ return [{text:this.sides[0].text, st:this.stage !== 'gullet' ? 'ok' : this.ended ? 'fail' : 'live', val:''}, {text:this.sides[1].text, st:this.ended && this.stage === 'home' && this.clock > 0 ? 'ok' : this.ended ? 'fail' : 'live', val:''},
    {text:this.sides[2].text, secret:true, st:this.secret ? 'ok' : this.ended ? 'fail' : 'live', val:''}]; },
  result(g, kind, why){
    const cash = kind === 'fail' ? 500 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0), spared = this.bess && (this.bess.alive || (this.yielded && !this.bessByYou));
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:`The chest, the picture and Brimstone's thanks. ${spared ? 'And Red Bess owes us one.' : ''} Hale is building a navy around that photograph.`, then:'Now Brimstone knows there is a navy spy in the Brethren. Not us: Kit Calloway. My little sister.'},
      success:{mood:'stern', say:spared ? 'Bess flew off, and she owes us. Brimstone has his gold.' : 'Brimstone has his gold.', then:'Now Brimstone knows there is a navy spy in the Brethren. Not us: Kit Calloway. My little sister.'},
      fail:{mood:'angry', say:why === 'blown' ? 'They saw you photographing the Eye. Hale\'s alibi is wearing thin.' : 'Bess beat us to it. Brimstone is not amused.', then:'Then Brimstone discovers there is a navy spy in the Brethren. Not us: Kit Calloway. My little sister.'}
    }[kind]), this.ucFlags({bess:spared ? 'spared' : 'down', levPhoto:this.secret ? 1 : 0}));
  }
});

/* =====================================================================
   Chapter 5, Episode 3: Sister of Mine
   Kit Calloway, Sparks's sister and Hale's other agent, is exposed and running for the navy picket.
   Brimstone orders the Black Thirteen to shoot her down. Choice: do it, or let her go. Secret: hand her the signal book.
   ===================================================================== */
G.MISSIONS.c5m3 = EP({
  id:'c5m3', weather:'squall', region:'calavera', title:'Sister of Mine', place:'Smoke Harbour to the western picket, Calavera Isles, evening', wing:3, planeChassis:'bulldog', crewChassis:'bulldog',
  brief:'Brimstone has found a navy spy among the Brethren, and it\'s Kit Calloway, Sparks\'s little sister. She\'s stolen a Comet and is running for the navy picket ten miles west, and Brimstone has ordered the Black Thirteen to bring her down. His hunters are behind you. Hale says: if you can, get close enough to pass her the Brethren signal book. Whatever you do, do it where everybody can see you trying.',
  sides:[{text:'Chase Kit Calloway (stay within 700 yd)'}, {text:'Keep your cover above 40%'}, {text:'Pass Kit the signal book (fly close beside her)', secret:true}],
  pay:{success:5000, perfect:2000, kill:0},
  worldOpts:world('evening'),
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.kit = null; this.near = 0; this.far = 0;
    this.ucInit(g);
    const S = this.P.smoke;
    this.pirateLaunch(g, 'Hook\'s live. That\'s her Comet. Kit... Oh, Kit. Go, Thirteen. Go!', {pos:new V3(S.x + 500, 650, S.z + 600), heading:-Math.PI/2, turn:0});
    this.picket = new V3(-7700, 500, -300);
  },
  drop(){
    base.drop.call(this); const g = this.g, P = g.player;
    const L = G.stockLoadout('comet'); L.paint = [0xe8edf2, 0x2a3a52, 0xb88a2a];
    this.kit = g.addPlane({loadout:L, team:1, name:'Kit Calloway', callsign:'Kit', pos:P.pos.clone().addScaledVector(P.fwd, 900).add(new V3(0, -60, 0)), q:P.q, speed:85, internalMul:1.6});
    this.kit.noTarget = true;   // the hunters leave her to you: that's the point
    this.hunters = this.brethren(g, P.pos.clone().addScaledVector(P.fwd, -500), 3, {skill:0.3, chassis:'bulldog'});
    G.HUD.radio(BRIM, 'The navy\'s little bird is flying home. Black Thirteen, bring her down. My hunters will watch you do it.');
    setTimeout(() => G.HUD.radio('Kit', 'Mabel? Is that you on the Margaret? ...If you\'re who I think you are, let me go.'), 5000);
  },
  update(g, dt){
    this.pt += dt; const P = g.player, K = this.kit; this.ucTick(g, dt);
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) g.spawnWingmen(this.wing);
    if (this.phase !== 1 || this.ended || this.blown || !K) { this.hudDone(g); return; }
    if (K.alive) {
      flyTo(g, K, this.picket, {weave:0.5, seed:7, agl:110, throttle:0.92});
      const d = K.pos.distanceTo(P.pos); if (d < 640) this.near += dt; else this.far += dt;
      g.markers.push({pos:K.pos, label:'KIT CALLOWAY', col:'#ff6b57'});
      if (!this.secret) {
        if (d < 120) g.markers.push({pos:K.pos, label:this.secretT > 0 ? `PASSING THE BOOK ${Math.round(this.secretT/2*100)}%` : '', col:'#c9a6f0', noDist:true});
        if (d < 55 && Math.abs(P.speed - K.speed) < 25) this.secretT += dt; else this.secretT = Math.max(0, this.secretT - dt);
        if (this.secretT > 2) { this.secret = 1; G.HUD.toast('Signal book passed'); G.HUD.radio('Kit', 'Got it! The Brethren signal book... Mabel\'s crew. I knew it. Thank you.'); this.secretSeen(P.pos); }
      }
      if (K.pos.distanceTo(this.picket) < 700 && !this.ended) {
        this.ended = true; const effort = this.near/(this.near + this.far + 0.01);
        this.coverAdd(effort > 0.6 ? -8 : -30, effort > 0.6 ? 'she was too fast for anybody' : 'you hung back');
        G.HUD.radio(HALE, 'She\'s inside the picket. Kit Calloway is safe. Thirteen, I won\'t forget this.');
        setTimeout(() => G.HUD.radio(BRIM, effort > 0.6 ? 'Too fast for you, was she? Too fast for all of us. Hmph.' : 'You let her go, Thirteen. I watched you.'), 3000);
        g.end(Object.assign(this.result(g, this.secret && this.cover >= 40 ? 'perfect' : 'success', 'escaped'), {delay:6000}));
      }
    }
    G.HUD.objective(K.alive ? `Kit is running for the navy picket · ${Math.round(K.pos.distanceTo(this.picket)*YD)} yd · you're ${Math.round(K.pos.distanceTo(P.pos)*YD)} yd behind` : 'Kit is down');
    this.hudDone(g);
  },
  onKill(g, plane){
    if (plane !== this.kit || this.ended) return;
    this.ended = true; this.coverAdd(25, 'you brought the spy down');
    G.HUD.radio(G.RADIO.short, '...Her chute opened. Her chute opened. The Brethren boats are picking her up.');
    setTimeout(() => G.HUD.radio(BRIM, 'Well done, Black Thirteen. She\'ll be my guest at the Keep. My honoured guest.'), 4000);
    g.end(Object.assign(this.result(g, 'success', 'down'), {delay:7000}));
  },
  sideState(g){ const tot = this.near + this.far; return [{text:this.sides[0].text, st:tot > 5 && this.near/tot > 0.6 ? 'ok' : this.ended ? 'fail' : 'live', val:tot > 1 ? Math.round(this.near/tot*100) + '%' : ''},
    {text:this.sides[1].text, st:this.cover >= 40 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(this.cover) + '%'},
    {text:this.sides[2].text, secret:true, st:this.secret ? 'ok' : this.ended ? 'fail' : 'live', val:''}]; },
  result(g, kind, why){
    const cash = kind === 'fail' ? 500 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0), down = this.kit && !this.kit.alive;
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:'Kit\'s safe with the navy, and she\'s got the Brethren signal book. I could kiss you. I won\'t. But I could.', then:'Tomorrow Brimstone crowns himself Pirate King at the Keep, and the Black Thirteen fly in the honour guard. So does the Leviathan.'},
      success:{mood:down ? 'angry' : 'pleased', say:down ? 'You shot my sister down. I know why. I know you had to. Don\'t talk to me for a while.' : 'Kit\'s safe. Brimstone\'s suspicious, but Kit\'s safe.', then:down ? 'Kit is a prisoner at Brimstone Keep. Tomorrow Brimstone crowns himself Pirate King there, and the Black Thirteen fly in the honour guard.' : 'Tomorrow Brimstone crowns himself Pirate King at the Keep, and the Black Thirteen fly in the honour guard.'},
      fail:{mood:'angry', say:why === 'blown' ? 'Brimstone saw everything. We\'re holed up in Smoke Harbour; Hale says sit tight.' : 'We lost you. Kit got away, no thanks to us.', then:'Tomorrow Brimstone crowns himself Pirate King at the Keep. Somehow the Black Thirteen are still invited.'}
    }[kind]), this.ucFlags({kit:down ? 'captured' : 'free', kitCodes:this.secret ? 1 : 0}));
  }
});

/* =====================================================================
   Chapter 6, Episode 1: Coronation
   The honour-guard flypast over Brimstone Keep as the Leviathan rises from the Burning Eye.
   Secret: plant a beacon on each of her four engines without the honour guard seeing.
   ===================================================================== */
const FLYPAST = [[-1800, 1400], [-900, 1800], [0, 2200], [900, 1800], [1800, 1400]];
G.MISSIONS.c6m1 = EP({
  id:'c6m1', weather:'clear', region:'calavera', title:'Coronation', place:'Brimstone Keep, Calavera Isles, evening', wing:3, planeChassis:'bulldog', crewChassis:'bulldog',
  brief:'Every pirate captain on the coast has come to Brimstone Keep to watch Ezekiel Brimstone crown himself Pirate King. The Black Thirteen fly in the honour guard: five gates over the Keep, in order, steady and slow. Then the Leviathan rises out of the Burning Eye. Hale wants a beacon on each of her four engines. The honour guard flies right beside you.',
  sides:[{text:'Fly the flypast: 5 gates, under 200 mph'}, {text:'Keep your cover above 50%'}, {text:'Plant beacons on the Leviathan\'s 4 engines', secret:true}],
  pay:{success:6000, perfect:3000, kill:0},
  worldOpts:world('evening'),
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.gate = 0; this.stage = 'flypast'; this.beacons = 0; this.done = {};
    this.ucInit(g);
    this.pirateLaunch(g, 'Hook\'s live. Half the pirates in the world are watching. Smile. With your guns.', {pos:new V3(-2600, 700, -400), heading:0.6, turn:0});
    const B = this.P.burning;
    this.lev = g.addShip({team:0, kind:'raider', name:'Leviathan', label:'LEVIATHAN', paint:{hull:0x1a1717, band:0x9e1b1b, trim:0xb88a2a, scale:2.2, hpMul:3}, pos:new V3(B.x, 90, B.z), heading:-0.4, speed:0.01, turn:0.0, noRun:true, noMG:true});
    this.lev.noGuns = true; this.levRise = 0;
  },
  update(g, dt){
    this.pt += dt; const P = g.player, L = this.lev; this.ucTick(g, dt);
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); this.guard = this.brethren(g, P.pos.clone().add(new V3(-60, 10, -80)), 4, {skill:0.4, chassis:'bulldog'}); for (const p of this.guard) g.pilots = g.pilots.filter(pl => pl.p !== p); G.HUD.radio(MOLLY, 'Honour guard, on me. Five gates, slow and pretty. Brimstone\'s watching.'); }
    if (this.phase !== 1 || this.ended || this.blown) { this.hudDone(g); return; }
    // the honour guard keeps station off your wing
    (this.guard || []).forEach((p, i) => { if (!p.alive) return; const off = new V3((i % 2 ? 1 : -1)*(60 + i*25), 6, -40 - i*20); tA.copy(off).applyQuaternion(P.q).add(P.pos); flyTo(g, p, tA.addScaledVector(P.fwd, 200), {throttle:clamp(0.4 + (p.pos.distanceTo(tA) - 200)/400, 0.3, 1), agl:80}); });
    // the Leviathan rises
    if (this.gate >= 2 || this.pt > 70) { if (!this.risen) { this.risen = true; if (g.weather) g.weather.change('ash', 'The Burning Eye\'s erupting under her! Ash everywhere!'); G.HUD.radio(BRIM, 'Brethren! Behold the Leviathan! With her, the Calavera rules the sea lanes from here to Halcyon!'); } this.levRise = Math.min(1, this.levRise + dt/60); L.pos.y = 90 + this.levRise*480; }
    if (this.stage === 'flypast') {
      const fp = FLYPAST[this.gate], at = new V3(fp[0], ground(g, fp[0], fp[1]) + 180, fp[1]);
      g.markers.push({pos:at, label:`GATE ${this.gate + 1}/5`, col:'#f2c14e'});
      if (P.pos.distanceTo(at) < 70) { if (P.speed < 200*G.MPH) { this.gate++; if (g.audio) g.audio.ding(); } else { this.coverAdd(-5, 'too fast for a flypast'); this.gate++; } }
      if (this.gate >= 5) { this.stage = 'toast'; this.toastT = 0; G.HUD.radio(BRIM, 'Black Thirteen! A pretty flypast. Stay close tonight. There\'s work tomorrow.'); }
    } else { this.toastT += dt; }
    // the secret: four engine beacons, slow and close, away from the guard
    if (this.levRise > 0.3) for (const [ci, c] of (L.comps || []).filter(c => c.kind === 'engine').entries()) {
      if (this.done[ci] || this.beacons >= 4) continue;
      const ep = L.worldPoint(c.pos, new V3()); if (P.pos.distanceTo(ep) < 1500) g.markers.push({pos:ep, label:'ENGINE', col:'#c9a6f0'});
      if (P.pos.distanceTo(ep) < 34 && P.speed < 80) { c._t = (c._t || 0) + dt; if (c._t > 1.2) { this.done[ci] = 1; this.beacons++; G.HUD.toast(`Beacon ${this.beacons}/4`); if (g.audio) g.audio.ding(); const s = this.seenBy(P.pos, 600); if (s) { this.coverAdd(-12, `${s.callsign} saw you at the engines`); } if (this.beacons === 4) { this.secret = 1; G.HUD.radio(HALE, 'Four beacons. Every gun in the navy can find her now.'); } } }
    }
    G.HUD.objective(this.stage === 'flypast' ? `Honour guard flypast · gate ${this.gate + 1}/5 · under 200 mph${this.risen ? ` · beacons ${this.beacons}/4` : ''}` : `The coronation · beacons on the Leviathan ${this.beacons}/4 · ${Math.max(0, Math.ceil(90 - this.toastT))} s`);
    if (this.stage === 'toast' && (this.toastT > 90 || this.beacons >= 4) && !this.ended) {
      this.ended = true; const ok = this.sideState(g).filter(s => s.st === 'ok').length;
      g.end(Object.assign(this.result(g, ok === 3 ? 'perfect' : 'success'), {delay:5000}));
    }
    this.hudDone(g);
  },
  onShipRun(){}, onShipStopped(){ return true; }, onKill(){},
  sideState(g){ return [{text:this.sides[0].text, st:this.gate >= 5 ? 'ok' : this.ended ? 'fail' : 'live', val:`${this.gate}/5`}, {text:this.sides[1].text, st:this.cover >= 50 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(this.cover) + '%'},
    {text:this.sides[2].text, secret:true, st:this.beacons >= 4 ? 'ok' : this.ended ? 'fail' : 'live', val:`${this.beacons}/4`}]; },
  result(g, kind, why){
    const cash = kind === 'fail' ? 500 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0);
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:'A pretty flypast and four beacons on the Leviathan. Brimstone thinks we\'re his. Tomorrow he finds out.', then:'Brimstone means to take the Leviathan against Port Halcyon. Tonight, he\'ll learn who the Black Thirteen really are.'},
      success:{mood:'stern', say:`The King has his crown. ${this.beacons ? this.beacons + ' beacon' + (this.beacons > 1 ? 's' : '') + ' on his ship.' : 'No beacons on his ship.'}`, then:'Brimstone means to take the Leviathan against Port Halcyon. Tonight, he\'ll learn who the Black Thirteen really are.'},
      fail:{mood:'angry', say:'The coronation went wrong for us.', then:'Brimstone knows. Tonight the Black Thirteen run for their lives.'}
    }[kind]), this.ucFlags({beacons:this.beacons}));
  }
});

/* =====================================================================
   Chapter 6, Episode 2: Cover Blown
   However careful you were, Brimstone finds out. Get the Margaret out of Smoke Harbour's lagoon to the navy.
   Your own plane is back. Secret: depends on Kit (free her from the Keep, or knock out the Keep's radio).
   ===================================================================== */
G.MISSIONS.c6m2 = EP({
  id:'c6m2', weather:'storm', region:'calavera', title:'Cover Blown', place:'Smoke Harbour and the crown, Calavera Isles, night', wing:3, undercover:false,
  brief:'It had to happen. Brimstone knows who the Black Thirteen are, and every pirate in the Calavera is coming for the Margaret, moored in Smoke Harbour\'s lagoon. Get her out of the caldera and west to the navy rendezvous. The paint\'s still black, but the gloves are off: you\'re flying your own plane again.',
  sides:[{text:'Get the Margaret to the navy rendezvous'}, {text:'Keep her above 40%'}, {text:'(see below)', secret:true}],
  pay:{success:7000, perfect:3000, kill:300},
  worldOpts:world('night'),
  crewLoadout:null,
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.waves = 0; const F = this.F = flags();
    this.ucInit(g, 0); this.cover = 0; this.blown = true;   // no cover to keep tonight
    const S = this.P.smoke, eye = new V3(-1750, 0, -600);
    this.launch(g, `Hook's live, and so is every gun in the Calavera. Drop, ${G.save.callsign || 'Ace'}. Get us out of here.`, {pos:new V3(eye.x + 300, 480, eye.z), heading:-Math.PI/2, turn:0.008, shipName:'Black Margaret', shipPaint:BLACK_MARGARET});
    this.ship.dest = new V3(-8200, 0, -1200); this.ship.speed0 = this.ship.speed = 11; this.ship.noRun = true;
    this.rv = new V3(-7600, 600, -1200);
    // who gave us away, and what that means
    this.why = F.dunmore === 'talked' && !F.letter ? 'dunmore' : F.kit === 'captured' ? 'kit' : !F.letter ? 'letter' : 'molly';
    this.waveT = (F.cover || 0) >= 60 ? 40 : 12;
    // the secret: break Kit out of the Keep (if she's a prisoner), or silence the Keep's radio
    const K = this.P.keep;
    if (F.kit === 'captured') { this.sides = this.sides.slice(); this.sides[2] = {text:'Knock out the Keep\'s two flak guns so Kit can escape', secret:true};
      this.T = [-1, 1].map(s => g.addTarget({kind:'flak', label:'KEEP FLAK', pos:new V3(K.x + s*28, K.y + 24, K.z + 20), r:9, hp:220, team:1, cd:3})); }
    else { this.sides = this.sides.slice(); this.sides[2] = {text:'Knock out Brimstone Keep\'s radio mast', secret:true};
      this.T = [g.addTarget({kind:'radio', label:'KEEP RADIO', pos:new V3(K.x, K.y + 50, K.z), r:8, hp:180, team:1})]; }
  },
  update(g, dt){
    this.pt += dt; const P = g.player, S = this.ship, F = this.F; this.scene.tick(dt); G.HUD.cover(null);
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) {
      g.spawnWingmen(this.wing);
      G.HUD.radio(G.RADIO.short, {dunmore:'Dunmore told him everything. Brimstone\'s known for a day.', kit:'Kit... they made her talk. It\'s not her fault.', letter:'Dunmore\'s letter washed up. Brimstone read it at breakfast.', molly:'Molly worked it out. She always would have.'}[this.why]);
    }
    if (this.phase !== 1 || this.ended) { this.hudDone(g); return; }
    this.waveT -= dt;
    if (this.waveT <= 0 && this.waves < 6) { this.waveT = 30; this.waves++; const n = F.kitCodes ? 2 : 3, from = this.waves % 2 ? this.P.keep.clone().add(new V3(0, 300, 0)) : this.P.smoke.clone().add(new V3(200, 250, 0));
      this.hostiles(g, 'brethren', from, n, {skill:0.5, strafe:1, shipTarget:S}); G.HUD.radio(G.RADIO.short, `${n} more Brethren${F.kitCodes ? ' (the navy\'s jamming the rest)' : ''}!`); }
    if (F.bess === 'spared' && !this.bessIn && this.pt > 55) { this.bessIn = true;
      for (let i = 0; i < 3; i++) { const L = G.stockLoadout(i ? 'vandal' : 'mantis'); L.paint = [0x9e1b1b, 0x161616, 0xe8e0cc]; g.addPlane({loadout:L, team:0, name:i ? 'Bess\'s crew' : 'Bess Malone', callsign:i ? 'Red ' + (i + 1) : 'Red Bess', pos:P.pos.clone().add(new V3(300 + i*40, 200, -600)), q:P.q, speed:90, ai:{role:'fighter', skill:0.75}}); }
      G.HUD.radio('Red Bess', 'Thirteen! Bess Malone pays her debts. Where do you want them?'); }
    for (const t of this.T) if (t.alive) {
      if (t.kind === 'flak') { t.cd -= dt; if (t.cd <= 0) { t.cd = 2.2; if (P.alive && !P.invuln && P.pos.distanceTo(t.pos) < 1500 && P.pos.distanceTo(t.pos) > 150) { const tt = P.pos.distanceTo(t.pos)/620; g.flakShell({team:1}, t.pos.clone(), P.pos.clone().addScaledVector(P.vel, tt).add(new V3((Math.random() - 0.5)*60, (Math.random() - 0.5)*60, 0)), tt); } } }
      if (P.pos.distanceTo(t.pos) < 3000) g.markers.push({pos:t.pos, label:t.label, col:'#c9a6f0', box:true});
    }
    if (!this.secret && this.T.every(t => !t.alive)) { this.secret = 1; G.HUD.radio(G.RADIO.short, F.kit === 'captured' ? 'The flak\'s down... and there\'s a Comet climbing out of the Keep! It\'s Kit! She\'s out!' : 'Keep radio\'s down! The Leviathan won\'t hear a thing till morning.'); }
    g.markers.push({pos:this.rv, label:'NAVY RENDEZVOUS', col:'#9ec7f0'});
    const toGo = Math.hypot(S.pos.x - this.rv.x, S.pos.z - this.rv.z);
    G.HUD.objective(`Get the Margaret to the navy · ${Math.round(toGo*YD)} yd · Margaret ${Math.round(S.hp/S.hpMax*100)}%`);
    if (toGo < 500 && !this.ended) { this.ended = true; G.HUD.radio(HALE, 'Margaret, this is the Resolute. We have you. Welcome home, Lucky Thirteen.'); const ok = this.sideState(g).filter(s => s.st === 'ok').length; g.end(Object.assign(this.result(g, ok === 3 ? 'perfect' : 'success'), {delay:5000})); }
    this.hudDone(g);
  },
  onShipDown(g, ship){ if (ship === this.ship && !this.ended) { this.ended = true; G.HUD.radio(G.CAPTAIN.short, 'She\'s going down in the lagoon! Abandon ship!'); g.end(this.result(g, 'fail', 'margaret')); } },
  onShipRun(){}, onShipStopped(){ return true; }, onKill(){},
  playerDown(g){ if (this.ended) return; G.HUD.radio(G.RADIO.short, 'We see your chute! We\'ll pick you up on the way. Keep going, Margaret!'); this.downed = true; },
  sideState(g){ return [{text:this.sides[0].text, st:this.ended && this.ship.alive ? 'ok' : this.ship.alive ? 'live' : 'fail', val:''}, {text:this.sides[1].text, st:this.ship.hp/this.ship.hpMax >= 0.4 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(this.ship.hp/this.ship.hpMax*100) + '%'},
    {text:this.sides[2].text, secret:true, st:this.secret ? 'ok' : this.ended ? 'fail' : 'live', val:''}]; },
  result(g, kind, why){
    const cash = kind === 'fail' ? 800 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill, F = this.F;
    const kitOut = F.kit !== 'captured' || this.secret;
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:`We\'re out, the Margaret\'s in one piece${F.kit === 'captured' && this.secret ? ', and Kit flew out of the Keep on her own' : ''}. Now for the Leviathan.`, then:'At dawn the Leviathan sails for Port Halcyon. The navy, the Lucky Thirteen and whoever else owes them a favour are waiting over the Teeth.'},
      success:{mood:'stern', say:'We\'re out. It wasn\'t pretty.', then:'At dawn the Leviathan sails for Port Halcyon. The navy and the Lucky Thirteen are waiting over the Teeth.'},
      fail:{mood:'angry', say:'The Margaret\'s down in the lagoon. Everyone got out. The navy took us aboard the Resolute.', then:'At dawn the Leviathan sails for Port Halcyon. The Lucky Thirteen will fight from the deck of the Resolute.'}
    }[kind]), {cover:0, margaretLost:kind === 'fail' && why === 'margaret' ? 1 : 0, kitFree:kitOut ? 1 : 0, keepRadio:F.kit !== 'captured' && this.secret ? 'down' : 'up'});
  }
});

/* =====================================================================
   Chapter 6, Episode 3: The Leviathan
   The finale over the Teeth. Every choice comes home: beacons, the treasury, the Gull, Kit, Bess.
   ===================================================================== */
G.MISSIONS.c6m3 = EP({
  id:'c6m3', weather:'overcast', region:'calavera', title:'The Leviathan', place:'Over the Teeth, Calavera Isles, dawn', wing:3, undercover:false, crewLoadout:null,
  brief:'The Leviathan: twice the Wraith, guns on every deck, a hangar full of fighters, and Ezekiel Brimstone himself at the helm. She sails at dawn for Port Halcyon, over the Teeth, and the navy cruiser Resolute and the Margaret are waiting for her. Bring her down, and when Brimstone launches in his own fighter, bring him down too.',
  sides:[{text:'Keep the Resolute flying'}, {text:'Keep the Margaret above 40%'}],
  pay:{success:15000, perfect:6000, kill:300},
  worldOpts:world('day'),
  setup(g){
    const F = this.F = flags();
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.boss = null; this.bossOut = false; this.launched = 0; this.hangT = 35;
    this.ucInit(g, 0); this.blown = true; this.cover = 0;
    const T = this.P.teeth;
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. ${F.margaretLost ? 'The Resolute\'s lending us her trapeze. ' : ''}There she is. Last dance, Thirteen.`,
      F.margaretLost ? {pos:new V3(T.x - 600, 760, T.z - 2400), heading:0, turn:0.01, shipName:'HMS Resolute', shipPaint:{hull:0x8a96a4, band:0x2a3a52, trim:0xb88a2a}} : {pos:new V3(T.x - 600, 760, T.z - 2400), heading:0, turn:0.01});
    const s = this.ship; s.hp = s.hpMax = 5000;
    this.resolute = F.margaretLost ? s : g.addShip({team:0, name:'HMS Resolute', paint:{hull:0x8a96a4, band:0x2a3a52, trim:0xb88a2a}, pos:new V3(T.x + 900, 740, T.z - 2200), heading:0, speed:5, turn:0.01, hp:6000, flak:true, guns:[new V3(7, -24, 26), new V3(-7, -24, -8), new V3(0, 23, -20)], noRun:true});
    // every choice comes home
    const hpMul = F.beacons >= 4 ? 1.3 : F.beacons >= 2 ? 1.6 : 1.9;
    this.lev = g.addShip({team:1, kind:'raider', name:'Leviathan', label:'LEVIATHAN', paint:{hull:0x1a1717, band:0x9e1b1b, trim:0xb88a2a, scale:2.0, hpMul}, pos:new V3(T.x, 820, T.z + 2200), heading:Math.PI, speed:5, turn:0.01, noRun:true, gunCd:F.gull === 'through' ? 0.22 : 0.36});
    g.targetShip = this.lev;
    for (const S of [s, this.resolute]) { S.foe = this.lev; S.standoff = 850; }
    this.lev.foe = s; this.lev.standoff = 650;
    this.launchMax = F.treasuryBeacon ? 6 : 10;
  },
  update(g, dt){
    this.pt += dt; const P = g.player, W = this.lev, F = this.F; this.scene.tick(dt); G.HUD.cover(null);
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) {
      g.spawnWingmen(this.wing); G.HUD.radio('Dutch', 'Lucky Thirteen again. Feels good.');
      const navy = F.kitCodes || F.kitFree ? 4 : 2;
      for (let i = 0; i < navy; i++) { const L = G.stockLoadout(i % 2 ? 'sparrowhawk' : 'gallant'); L.paint = NAVY.slice(); const nm = G.name1920s(); g.addPlane({loadout:L, team:0, name:nm.full, callsign:'Lt. ' + nm.short, pos:P.pos.clone().add(new V3((i - 1.5)*70, 40, -120)), q:P.q, speed:P.speed, ai:{role:'fighter', skill:0.6}}); }
      G.HUD.radio(HALE, `${navy} navy fighters with you${F.kitCodes ? ', and we\'re reading every Brethren signal thanks to Kit' : ''}. Good hunting.`);
      if (F.kitFree || F.kit !== 'captured') setTimeout(() => { const L = G.stockLoadout('comet'); L.paint = [0xe8edf2, 0x2a3a52, 0xb88a2a]; g.addPlane({loadout:L, team:0, name:'Kit Calloway', callsign:'Kit', pos:P.pos.clone().add(new V3(-200, 60, -300)), q:P.q, speed:P.speed + 10, ai:{role:'fighter', skill:0.8}}); G.HUD.radio('Kit', 'Mabel, I\'m on your wing! Well, on your pilot\'s wing.'); }, 9000);
      if (F.bess === 'spared') setTimeout(() => { for (let i = 0; i < 3; i++) { const L = G.stockLoadout(i ? 'vandal' : 'mantis'); L.paint = [0x9e1b1b, 0x161616, 0xe8e0cc]; g.addPlane({loadout:L, team:0, name:i ? 'Bess\'s crew' : 'Bess Malone', callsign:i ? 'Red ' + (i + 1) : 'Red Bess', pos:P.pos.clone().add(new V3(400, 120, 200 + i*40)), q:P.q, speed:P.speed, ai:{role:'fighter', skill:0.75}}); } G.HUD.radio('Red Bess', 'Did somebody say Brimstone? I\'ve been waiting years for this.'); }, 20000);
      if (F.treasuryBeacon) setTimeout(() => G.HUD.radio(HALE, 'The navy raided the Brethren treasury last night. Half Brimstone\'s pilots didn\'t get paid. They\'re staying home.'), 14000);
    }
    if (this.phase !== 1 || this.ended) { this.hudDone(g); return; }
    if (this.pt > 3 && !this.screen) { this.screen = 1; this.hostiles(g, 'brethren', W.worldPoint(new V3(0, 40, 300), new V3()), F.treasuryBeacon ? 4 : 6, {skill:0.55}); G.HUD.radio(G.RADIO.short, 'Fighter screen off the Leviathan!'); }
    this.hangT -= dt;
    if (this.hangT <= 0 && this.launched < this.launchMax && W.alive && W.alivePart('hangar').length) { this.hangT = 38; this.launched += 2; this.hostiles(g, 'brethren', W.worldPoint(new V3(0, -60, -20), new V3()), 2, {skill:0.5, strafe:1, shipTarget:this.ship}); G.HUD.radio(G.RADIO.short, 'Two more out of her belly!'); }
    const engLost = W.count('engine') - W.alivePart('engine').length, cellsLost = W.count('cell') - W.alivePart('cell').length;
    if (!this.bossOut && (engLost >= 2 || cellsLost >= 2)) {
      this.bossOut = true; const L = G.stockLoadout('bulldog'); L.paint = [0x161616, 0xe0742a, 0x9e1b1b]; L.guns = [{cal:'60', ammo:'ex'}, {cal:'50', ammo:'ap'}]; L.arm = [45, 40, 35, 35]; L.rocket = 'he';
      this.boss = g.addPlane({loadout:L, team:1, name:'Ezekiel Brimstone', callsign:'Brimstone', pos:W.worldPoint(new V3(0, -60, 30), new V3()), q:W.q, speed:80, ai:{role:'fighter', skill:0.95}, internalMul:2.8});
      this.boss.ace = true; const pl = g.pilots[g.pilots.length - 1]; pl.target = P; pl.retT = 8;
      G.HUD.radio(BRIM, `Black Thirteen. I gave you a seat at my table. I'll give you a grave in my sea.`);
    }
    G.HUD.objective(W.alive ? `Bring down the Leviathan: engines ${W.alivePart('engine').length} left · gas cells holed ${cellsLost}/4${this.bossOut ? (this.boss.alive ? ' · Brimstone is airborne!' : ' · Brimstone is down') : ''}` : (this.boss && this.boss.alive ? 'The Leviathan is going down! Now get Brimstone!' : ''));
    if (!W.alive && this.bossOut && !(this.boss && this.boss.alive) && !this.ended) {
      this.ended = true; G.HUD.radio(HALE, 'The Leviathan is in the sea and Brimstone is hanging from a parachute over his own Teeth. The Calavera is finished. Bravo, Lucky Thirteen. Bravo.');
      g.end(Object.assign(this.result(g, this.sideState(g).every(x => x.st === 'ok') ? 'perfect' : 'success'), {delay:7000}));
    }
    this.hudDone(g);
  },
  onPartDown(g, ship, c){ if (ship === this.lev && c.kind === 'engine') G.HUD.radio(G.RADIO.short, ship.alivePart('engine').length ? `Leviathan engine down! ${ship.alivePart('engine').length} to go!` : 'Every engine on the Leviathan is out! Hole her cells!'); },
  onShipDown(g, ship){
    if (ship === this.lev) { if (g.weather) g.weather.change('clear', false); G.HUD.radio(G.RADIO.short, this.boss && this.boss.alive ? 'The Leviathan is going down! Brimstone\'s still up there!' : 'The Leviathan is going down!'); if (!this.bossOut) { this.bossOut = true; this.boss = null; } }
    if ((ship === this.ship || ship === this.resolute) && !this.ended && ship === this.ship) { this.ended = true; G.HUD.radio(G.CAPTAIN.short, 'We\'re going down! Abandon ship!'); g.end(this.result(g, 'fail', 'margaret')); }
    if (ship === this.resolute && ship !== this.ship) G.HUD.radio(HALE, 'Resolute is going down! All hands, abandon ship!');
  },
  onKill(g, plane){ if (plane === this.boss) G.HUD.radio(BRIM, 'The sea... the sea was supposed to be MINE...'); },
  onShipRun(){}, onShipStopped(){ return true; },
  playerDown(g){ if (this.ended) return; this.ended = true; G.HUD.radio(G.RADIO.short, 'We see your chute! We\'ll hold as long as we can!'); g.end(this.result(g, 'fail', 'down')); },
  sideState(g){ return [{text:this.sides[0].text, st:this.resolute.alive ? (this.ended ? 'ok' : 'live') : 'fail', val:this.resolute.alive ? Math.round(this.resolute.hp/this.resolute.hpMax*100) + '%' : 'sunk'},
    {text:this.sides[1].text, st:this.ship.hp/this.ship.hpMax >= 0.4 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(this.ship.hp/this.ship.hpMax*100) + '%'}]; },
  result(g, kind, why){
    const F = this.F, cash = kind === 'fail' ? 1000 + g.kills*this.pay.kill/2 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill;
    const kit = F.kit === 'captured' && !F.kitFree ? ' Kit is still in the Keep; the marines are going in for her now.' : ' Kit is buying the first round, and Mabel the second.';
    const bess = F.bess === 'spared' ? ' Red Bess Malone has claimed the Keep as salvage. Hale is pretending not to notice.' : '';
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:`The Leviathan is on the bottom, Brimstone is in irons and both our ships came home.${kit}${bess}`, then:`The Brethren of the Black Flag are finished. The Lucky Thirteen scrub the black paint off the Margaret, slowly, because Hellcat insists on keeping a skull on her tail. And Augustin Hollis is waiting in the hangar with a thank-you: the Zephyr, an aeroplane with no propeller at all. The Zephyr jet is yours.`},
      success:{mood:'pleased', say:`The Leviathan is gone and the Pirate King is in a cell.${kit}`, then:`The Brethren of the Black Flag are finished. The Lucky Thirteen scrub the black paint off the Margaret, and Augustin Hollis wheels out a thank-you: the Zephyr, an aeroplane with no propeller at all. The Zephyr jet is yours.`},
      fail:{mood:'angry', say:why === 'margaret' ? 'The Margaret is going into the Teeth. Everyone got out. The Leviathan sails on.' : 'You got out under a silk canopy, and the Leviathan sails on toward Port Halcyon.', then:'The Leviathan is loose. There\'s only one thing for it: go again.'}
    }[kind]), {finale2:kind});
  }
});
/* the cover-cost hook for c4m3: hits are seen as they land */
const onHit0 = G.Game.prototype.onHit;
G.Game.prototype.onHit = function(target, src, dmg, f){ if (this.mission && this.mission.onHitBy) this.mission.onHitBy(this, target, src); return onHit0.call(this, target, src, dmg, f); };

/* ---------- the story graph, Volume II ---------- */
Object.assign(G.CHAPTERS, {c4:'Volume II, Chapter 4: Under the Black Flag', c5:'Volume II, Chapter 5: A Pirate\'s Life', c6:'Volume II, Chapter 6: The Pirate King'});
Object.assign(G.STORY, {
  c4m1:{n:1, ch:'c4', next:() => 'c4m2'},
  c4m2:{n:2, ch:'c4', next:() => 'c4m3'},
  c4m3:{n:3, ch:'c4', next:() => 'c5m1'},
  c5m1:{n:1, ch:'c5', next:() => 'c5m2'},
  c5m2:{n:2, ch:'c5', next:() => 'c5m3'},
  c5m3:{n:3, ch:'c5', next:() => 'c6m1'},
  c6m1:{n:1, ch:'c6', next:() => 'c6m2'},
  c6m2:{n:2, ch:'c6', next:() => 'c6m3'},
  c6m3:{n:3, ch:'c6', next:r => r.kind === 'fail' ? 'c6m3' : 'c6end'}
});
G.STORY.c3m3.next = r => r.kind === 'fail' ? 'c3m3' : 'c4m1';
/* The award for finishing the whole story: Hollis's jet, the Zephyr. */
const commit0 = G.storyCommit;
G.storyCommit = r => {
  commit0(r);
  const S = G.save;
  if (S.story && S.story.node === 'c6end' && !S.owned.includes('zephyr')) {
    S.owned.push('zephyr'); for (const l of ['blackthirteen', 'swallow', 'airracer', 'quicksilver', 'nightjet']) if (!S.liveries.includes(l)) S.liveries.push(l); G.persist();
    if (G.HUD) G.HUD.toast('New airframe: the Hollis Zephyr jet, and five bonus liveries');
  }
};
// saves that finished Volume I before Volume II existed pick up where it starts
if (G.save && G.save.story && G.save.story.node === 'c3end') { G.save.story.node = 'c4m1'; G.persist(); }
})();
