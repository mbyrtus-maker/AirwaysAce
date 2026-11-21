(function(){
'use strict';
/* =====================================================================
   Chapter 1: "The Silver Screen Job" (Sierra Free State)
   Kestrel Squadron's story format: every episode ends PERFECT, SUCCESS or FAILURE, each with a line from Sparks,
   what happens next, flags, and the next episode. Failure is a branch, never a game over.
   ===================================================================== */
const G = window.G, V3 = THREE.Vector3, Q = THREE.Quaternion;
const tA = new V3(), tB = new V3();
const base = G.MISSIONS.ambush;
const CITY = {x:2600, z:1900, r:430};
const VIVIAN = 'Vivian Lacroix';
const TIGERS = [[0xd94f8a, 0x2b1b3a, 0xf2c14e], [0xf2c14e, 0x2b1b3a, 0xd94f8a], [0x7b3fa0, 0xf1e9d6, 0xf2c14e]];
const LANTERN = [0x7a1f1f, 0x1b1b1b, 0xd9b44a];
const worldCity = (time) => ({seed:1931, time, flats:[{x:CITY.x, z:CITY.z, r:CITY.r}]});

/* shared: pirates by gang; Paper Tigers fly flashy paint, Black Lantern fly red and black */
function pirates(g, at, n, o = {}){
  const made = [], used = {}; n = G.squadN(g, n);
  for (let i = 0; i < n; i++) {
    const L = G.gangLoadout(o.gang === 'lantern' ? 'lantern' : 'tigers', i, n, used, o.gang === 'lantern' ? LANTERN : TIGERS[i % TIGERS.length]);
    const nm = G.name1920s(), pos = at.clone().add(new V3((i - (n - 1)/2)*45, (Math.random() - 0.5)*60, (Math.random() - 0.5)*40));
    const face = o.face || (g.player ? g.player.pos : new V3());
    const q = new Q().setFromUnitVectors(new V3(0, 0, 1), tA.copy(face).sub(pos).setY(0).normalize());
    const role = o.strafe && i < o.strafe ? 'strafe' : 'fighter';
    const p = g.addPlane({loadout:L, team:1, name:nm.full, callsign:nm.short, pos, q, speed:92, ai:{role, skill:(o.skill ?? 0.4) + Math.random()*0.25}});
    if (role === 'strafe' && o.shipTarget) g.pilots[g.pilots.length - 1].shipTarget = o.shipTarget;
    made.push(p);
  }
  return made;
}
/* a place off the coast or inland at distance d from the city, on bearing a */
const fromCity = (a, d, y) => new V3(CITY.x + Math.sin(a)*d, y, CITY.z + Math.cos(a)*d);
function cityscape(g, keepClear, o = {}){
  // Port Halcyon on a street grid: avenues every 96 m, a tower or a low block on most lots, a few open plazas
  const h = Math.max(g.world.height(CITY.x, CITY.z, true), 14), r = G.rng(77), B = 96;
  const T = g.traffic || (g.traffic = new G.Traffic(g));
  T.streets(CITY, h, B);
  for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
    const x = CITY.x + (i + 0.5)*B, z = CITY.z + (j + 0.5)*B, d = Math.hypot(x - CITY.x, z - CITY.z);
    if (d > CITY.r - 55 || (keepClear && keepClear(x, z))) continue;
    if (r() < 0.12) continue;   // a plaza
    const tall = d < 170 ? 70 + r()*80 : 26 + r()*44, w = 34 + r()*26;
    const t = G.buildTower(tall, w, G.pick([0xd8c6a4, 0xc9b38f, 0xb9a891, 0xe2d4b6, 0xa99c8a], r), r); t.position.set(x, h - 0.5, z); g.scene.add(t);
    g.world.addBlocker({x, z, hw:w/2, hd:w/2, top:h + tall});
  }
  T.carsOn(o.cars ?? 40);
  T.air(CITY, o.air || {});
}
/* towers are solid: crash if you fly into one */
function towerCrash(g){
  const P = g.player; if (!P || !P.alive) return;
  const top = g.world.roof(P.pos.x, P.pos.z); if (top > -1e8 && P.pos.y < top) P.destroy(null, 'crash');
}

/* ---------- Episode 1: Escort the Starlight ---------- */
G.MISSIONS.c1m1 = Object.assign(Object.create(base), {
  id:'c1m1', story:true, title:'The Starlight Run', place:'Inbound to Port Halcyon, Sierra Free State', wing:3,
  brief:`Starlight Pictures is flying its biggest star, ${VIVIAN}, to tonight's premiere in Port Halcyon, and they've hired the Lucky Thirteen to make sure she gets there. Mr. Silk's Paper Tigers have been sniffing around. Keep them off the blimp.`,
  sides:[{text:'Starlight arrives above 70%'}, {text:'Down 4 Paper Tigers yourself'}],
  pay:{success:3000, perfect:1500, kill:300},
  worldOpts:() => worldCity('evening'),
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.warned = false; this.wave = 0; this.waveLeft = 0;
    const a = Math.PI*1.25, start = fromCity(a, 3600, 620);
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. The Starlight's off our bow. Drop and take station on her.`, {pos:fromCity(a + 0.08, 3750, 760), heading:a + Math.PI, turn:0});
    this.ship.dest = new V3(CITY.x, 0, CITY.z); this.ship.turn0 = 0.01;
    this.blimp = g.addShip({team:0, kind:'blimp', name:'Starlight', pos:start, heading:a + Math.PI, speed:15, turn:0.02, hp:1600, dest:new V3(CITY.x, 0, CITY.z)});
    cityscape(g);
  },
  update(g, dt){
    this.pt += dt; const B = this.blimp;
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); G.HUD.radio('Dutch', 'Dutch, Hellcat and Doc on your wing. Cover\'s up: 1 attack, 2 cover, 3 the zeppelin, 4 form up, 5 send us home.'); }
    towerCrash(g);
    const dist = Math.hypot(B.pos.x - CITY.x, B.pos.z - CITY.z);
    if (this.phase >= 1 && !this.ended) {
      const t = Math.round(dist/B.speed); G.HUD.objective(`Escort the Starlight to Port Halcyon · ${Math.round(dist*1.0936)} yd`);
      const due = [[8, 3, 1, 'Paper Tigers! Three of \'em, coming out of the sun!'], [70, 4, 2, 'More Tigers. Two are going straight for the blimp!'], [135, 4, 3, 'Here comes Mr. Silk\'s whole flying circus. Keep them off her!']];
      for (const [at, n, strafe, line] of due) if (this.wave < due.indexOf(due.find(d => d[0] === at)) + 1 && this.pt > at && B.alive) {
        this.wave++; const ang = Math.atan2(B.vel.x, B.vel.z) + (Math.random() < 0.5 ? 1 : -1)*(0.6 + Math.random()*0.6);
        pirates(g, new V3(B.pos.x + Math.sin(ang)*2000, 720, B.pos.z + Math.cos(ang)*2000), n, {strafe, shipTarget:B, face:B.pos});
        G.HUD.radio(G.RADIO.short, line);
      }
      if (B.hp/B.hpMax < 0.5 && !this.warned) { this.warned = true; G.HUD.radio('Starlight', 'This is the Starlight! We\'re holed! Miss Lacroix is... well, she\'s furious!'); }
      if (B.hp/B.hpMax <= 0.25) { this.ended = true; B.speed0 = 4; G.HUD.radio(G.RADIO.short, 'They\'ve got grapples on the Starlight! They\'re boarding her!'); g.end(this.result(g, 'fail')); }
      else if (dist < 320) { this.ended = true; G.HUD.radio('Starlight', 'Port Halcyon, dead ahead. Thank you, darlings. Vivian says you may call her Vivian.'); g.end(this.result(g, this.sideState(g).every(s => s.st === 'ok') ? 'perfect' : 'success')); }
    }
    G.HUD.sides(this.sideState(g));
  },
  onShipHit(){},
  sideState(g){ const f = this.blimp.hp/this.blimp.hpMax; return [{text:this.sides[0].text, st:f >= 0.7 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(f*100) + '%'}, {text:this.sides[1].text, st:g.kills >= 4 ? 'ok' : 'live', val:`${g.kills}/4`}]; },
  onKill(){},
  onShipDown(g, ship){ if (this.ended) return; this.ended = true; g.end(this.result(g, 'fail')); },
  playerDown(g){ if (this.ended) return; this.ended = true; G.HUD.radio(G.RADIO.short, 'We see your chute! And... oh no. They\'re boarding the Starlight.'); g.end(this.result(g, 'fail')); },
  result(g, kind){
    const f = this.blimp.hp/this.blimp.hpMax, pay = this.pay;
    const cash = kind === 'fail' ? 300 + g.kills*pay.kill/2 : pay.success + (kind === 'perfect' ? pay.perfect : 0) + g.kills*pay.kill;
    const R = {
      perfect:{mood:'pleased', say:'Not a scratch on the Starlight, and the Tigers went home with their tails between their legs. Vivian sent flowers. To me, which was correct.', then:`${VIVIAN} arrives in style. The studio invites the Lucky Thirteen to fly in tonight's premiere air show.`, flags:{}},
      success:{mood:f < 0.7 ? 'stern' : 'pleased', say:f < 0.7 ? 'She got there, but she looks like a colander. The studio\'s lawyers are already writing letters.' : 'The Starlight\'s safe and the star\'s in one piece. Nice flying.', then:`${VIVIAN} makes the premiere. The studio wants a show, so the Lucky Thirteen fly the air show tonight${f < 0.7 ? ', though the studio\'s grumbling about the bullet holes' : ''}.`, flags:f < 0.7 ? {grudge:1} : {}},
      fail:{mood:'angry', say:'They boarded the Starlight and took Vivian Lacroix right out of her stateroom. In front of the newsreel cameras. Wonderful.', then:`Mr. Silk's Paper Tigers have ${VIVIAN}, aboard their raider the Gilded Lily, running for the Gulf.`, flags:{kidnapped:1}}
    }[kind];
    return Object.assign({kind, cash:Math.round(cash), kills:g.kills, shipPct:Math.round(f*100), sides:this.sideState(g)}, R);
  }
});

/* ---------- Episode 2A: The Premiere Air Show ---------- */
G.MISSIONS.c1m2a = Object.assign(Object.create(base), {
  id:'c1m2a', story:true, lowFlying:true, title:'The Premiere Air Show', place:'Port Halcyon, Sierra Free State', wing:0,
  brief:`It's premiere night, and the studio wants a show. Fly the course through Port Halcyon: race gates, under the old railway viaduct, low over the crowd. Points for every gate and for flying it low and fast. And keep your eyes open. Thorne doesn't like how quiet the Lantern has been.`,
  sides:[{text:'Fly all 8 gates'}, {text:'???'}],
  pay:{success:2500, perfect:2000, kill:300},
  worldOpts:worldCity,
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.gate = 0; this.score = 0; this.photo = 0; this.photoT = 0; this.clock = 210; this.revealed = false;
    const w = g.world, a0 = Math.PI*0.75;
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. The whole town's watching. Give 'em a show.`, {pos:fromCity(a0, 1500, 520), heading:a0 + Math.PI, turn:0.004});
    cityscape(g, (x, z) => [fromCity(Math.PI*1.35, 250, 0), fromCity(Math.PI*0.9, 120, 0)].some(p => Math.hypot(p.x - x, p.z - z) < 80));   // keep the in-town gates clear
    // the viaduct, across a valley north-west of town
    const vx = CITY.x - 1050, vz = CITY.z + 250, len = 300, n = 5, hs = [];
    for (let i = 0; i <= n; i++) hs.push(Math.max(w.height(vx - len/2 + i*len/n, vz), 2));
    const deck = Math.max(...hs) + 46, via = G.buildViaduct(len, deck, hs); via.position.set(vx, 0, vz); g.scene.add(via);
    for (let i = 0; i <= n; i++) w.addBlocker({x:vx - len/2 + i*len/n, z:vz, hw:3, hd:4.5, top:deck + 3});
    // the course: 8 gates in order; gate 4 is the middle arch of the viaduct
    const gh = (x, z) => Math.max(w.height(x, z), 0.4);
    const pts = [[fromCity(a0, 900, 0), a0 + Math.PI], [fromCity(a0 + 0.35, 520, 0), a0 + Math.PI*0.75], [fromCity(Math.PI*1.35, 250, 0), Math.PI*0.5],
                 [new V3(vx, 0, vz), 0, 'arch'], [new V3(vx - 380, 0, vz - 500), Math.PI], [fromCity(Math.PI*1.1, 700, 0), Math.PI*0.25],
                 [fromCity(Math.PI*0.9, 120, 0), Math.PI*0.2], [fromCity(Math.PI*0.4, 650, 0), Math.PI*0.3]];
    this.gates = pts.map(([p, yaw, kind], i) => {
      const y = gh(p.x, p.z);
      const gt = {pos:new V3(p.x, y, p.z), yaw, kind:kind || 'gate', w:kind === 'arch' ? 50 : 46, h:kind === 'arch' ? deck - 6 - y : 34, i};
      if (gt.kind === 'gate') { const m = G.buildGate(); m.position.copy(gt.pos); m.rotation.y = yaw; g.scene.add(m); gt.m = m; }
      gt.n = new V3(Math.sin(yaw), 0, Math.cos(yaw)); return gt;
    });
    g.markers = [];
    // the unmarked zeppelin, drifting off the coast and watching the crowd
    this.phantom = g.addShip({team:2, kind:'raider', name:'Unmarked zeppelin', label:'', paint:{hull:0x6f7378, band:0x4a4e52, trim:0x8a8f94, name:'', skull:false}, pos:fromCity(Math.PI*1.6, 1700, 950), heading:0.3, speed:2, turn:0.002, state:'passive'});
  },
  drop(){ base.drop.call(this); this.g.markers = []; },
  update(g, dt){
    this.pt += dt; const P = g.player; towerCrash(g);
    if (this.phase === 1 && !this.ended) {
      this.clock -= dt;
      const G8 = this.gates, gt = G8[this.gate];
      if (gt && P.alive) {
        const rel = tA.copy(P.pos).sub(gt.pos), along = rel.dot(gt.n), lat = Math.abs(rel.x*gt.n.z - rel.z*gt.n.x), up = rel.y;
        if (this.prevAlong !== undefined && Math.sign(along) !== Math.sign(this.prevAlong) && lat < gt.w/2 && up > -2 && up < gt.h) {
          const low = up < gt.h*0.5 ? 50 : 0, fast = P.speed > P.top*0.9 ? 50 : 0;
          this.score += 100 + low + fast; this.gate++; this.prevAlong = undefined;
          G.HUD.toast(`Gate ${this.gate} of 8  +${100 + low + fast}${low ? ' low' : ''}${fast ? ' fast' : ''}`); if (g.audio) g.audio.ding();
          if (gt.kind === 'arch') G.HUD.radio(G.RADIO.short, 'Under the viaduct! The crowd\'s on its feet!');
          if (this.gate === 3 && !this.revealed) { this.revealed = true; G.HUD.radio(G.RADIO.short, 'Psst. There\'s an unmarked zeppelin hanging off the coast, watching the crowd. Get close and get a good look at her markings. Hold her in your sights.'); }
        } else this.prevAlong = along;
      }
      g.markers = [];
      if (this.gate < 8) { const nx = this.gates[this.gate]; g.markers.push({pos:tB.copy(nx.pos).setY(nx.pos.y + nx.h*0.45).clone(), label:`GATE ${this.gate + 1}${nx.kind === 'arch' ? ' · UNDER THE ARCH' : ''}`, col:'#f2c14e'}); }
      // photographing the phantom: within 700 m and held near the gunsight
      const ph = this.phantom;
      if (this.revealed && !this.photo && ph) {
        const d = ph.pos.distanceTo(P.pos), ang = tA.copy(ph.pos).sub(P.pos).normalize().angleTo(P.fwd);
        if (d < 700 && ang < 0.12) { this.photoT += dt; if (this.photoT > 2.5) { this.photo = 1; G.HUD.toast('Got her markings!'); G.HUD.radio(G.RADIO.short, 'Got it! Black hull, no name, and I\'d swear that\'s a Lantern skull painted over on her tail. Thorne will want to see this.'); ph.dest = new V3(ph.pos.x + 9000, 0, ph.pos.z + 9000); ph.speed0 = ph.speed = 10; ph.turn0 = 0.01; } }
        else this.photoT = Math.max(0, this.photoT - dt*0.5);
        if (!this.photo) g.markers.push({pos:ph.pos, label:this.photoT > 0 ? `PHOTOGRAPHING ${Math.round(this.photoT/2.5*100)}%` : 'UNMARKED ZEPPELIN', col:'#c9d2da'});
      }
      const m = Math.max(0, Math.ceil(this.clock));
      G.HUD.objective(`Air show · gate ${Math.min(this.gate + 1, 8)} of 8 · ${this.score} pts · ${Math.floor(m/60)}:${String(m%60).padStart(2, '0')}`);
      if (this.gate >= 8 || this.clock <= 0) {
        this.ended = true; g.markers = [];
        const kind = this.gate >= 8 && this.photo ? 'perfect' : this.gate >= 5 ? 'success' : 'fail';
        G.HUD.radio(G.RADIO.short, this.gate >= 8 ? 'That\'s the course! Listen to that crowd!' : 'That\'s time. The crowd\'s... politely clapping.');
        g.end(this.result(g, kind));
      }
    }
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ return [{text:'Fly all 8 gates', st:this.gate >= 8 ? 'ok' : this.ended ? 'fail' : 'live', val:`${this.gate}/8`}, {text:this.revealed ? 'Photograph the unmarked zeppelin' : '???', st:this.photo ? 'ok' : this.ended ? 'fail' : 'live', val:this.photo ? 'got it' : ''}]; },
  onKill(){},
  playerDown(g){ if (this.ended) return; this.ended = true; G.HUD.radio(G.RADIO.short, 'Oh, that\'s going to be in every newsreel in the country.'); g.end(this.result(g, 'fail')); },
  result(g, kind){
    const cash = kind === 'fail' ? 500 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + Math.round(this.score*2);
    const R = {
      perfect:{mood:'pleased', say:`Every gate, under the viaduct, and you got pictures of our mystery ship. ${this.score} points! The newsreel boys are calling you the Halcyon Hawk. I'm calling you lucky.`, then:'The photographs show an unmarked zeppelin with a Black Lantern skull painted over on her tail. Thorne wants to know what the Lantern wants with a film premiere.'},
      success:{mood:'stern', say:`${this.gate} gates and ${this.score} points. The crowd loved it.${this.photo ? ' And we got a look at that unmarked zeppelin.' : ' Shame nobody got a look at that zeppelin.'}`, then:this.photo ? 'The photographs show a Black Lantern skull painted over on the mystery ship\'s tail.' : 'The unmarked zeppelin slips away into the night. Nobody knows whose she was.'},
      fail:{mood:'angry', say:'Well, it was a show. Not the one they paid for.', then:'The unmarked zeppelin slips away into the night. Nobody knows whose she was.'}
    }[kind];
    return Object.assign({kind, cash, kills:g.kills, shipPct:Math.round(this.ship.hp/this.ship.hpMax*100), sides:this.sideState(g), flags:this.photo ? {photo:1} : {}}, R);
  }
});

/* ---------- Episode 2B: Kidnapped! ---------- */
G.MISSIONS.c1m2b = Object.assign(Object.create(base), {
  id:'c1m2b', story:true, weather:'rain', title:'Kidnapped!', place:'Over the Halcyon coast, heading for the Gulf', wing:3,
  brief:`The Paper Tigers have ${VIVIAN} aboard their raider, the Gilded Lily, and she's running for the Gulf. Shoot out all four engines to stop her so our boarding party can get Vivian out. Go easy on the gas cells: if the Lily goes down, Vivian goes down with her.`,
  sides:[{text:'Hole no more than 2 gas cells'}, {text:'Down 4 Paper Tigers yourself'}],
  pay:{success:4000, perfect:1500, kill:300},
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.warned = false; this.escorts = 0; this.runClock = 240; this.launched = 0; this.hangT = 40;
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. The Lily's dead ahead and running. Drop and go get our girl back.`, {pos:new V3(-1500, 760, -2500), heading:0.9});
    const s = this.ship, pos = new V3(s.pos.x + Math.sin(s.heading)*1900, 820, s.pos.z + Math.cos(s.heading)*1900);
    this.raider = g.addShip({team:1, kind:'raider', name:'Gilded Lily', label:'GILDED LILY', paint:{hull:0x5b2a5e, band:0xf2c14e, trim:0xd94f8a, skull:false}, pos, heading:s.heading, speed:7, turn:0.02, state:'running'});
    g.targetShip = this.raider; s.foe = this.raider; this.raider.foe = s; s.noTorps = true; s.turn0 = 0.02;
  },
  update(g, dt){
    this.pt += dt; const R = this.raider;
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); G.HUD.radio('Hellcat', 'Hellcat, Dutch and Doc, right behind you. Don\'t you dare hole that blimp with Vivian on it.'); }
    if (this.phase === 1 && this.pt > 2 && !this.escorts) { this.escorts = 1; pirates(g, R.worldPoint(new V3(0, 40, -200), new V3()), 3, {face:g.player.pos}); G.HUD.radio(G.RADIO.short, 'Three Tigers dropping back to cover her. Engines, people. Only the engines!'); }
    if (this.phase === 1 && !this.ended && R.alive) {
      if (R.state === 'running') {
        this.runClock -= dt; const m = Math.max(0, Math.ceil(this.runClock));
        G.HUD.objective(`Stop the Gilded Lily: ${R.alivePart('engine').length} engines left · gas cells holed ${8 - R.alivePart('cell').length} · ${Math.floor(m/60)}:${String(m%60).padStart(2, '0')}`);
        this.hangT -= dt;
        if (this.hangT <= 0 && this.launched < 4 && R.alivePart('hangar').length) { this.hangT = 60; this.launched += 2; pirates(g, R.worldPoint(new V3(0, -40, -14), new V3()), 2, {face:g.player.pos}); G.HUD.radio(G.RADIO.short, 'Two more Tigers out of her belly!'); }
        if (this.runClock <= 0) { this.ended = true; G.HUD.radio(G.CAPTAIN.short, 'She\'s over the Gulf border. We can\'t follow. Damn it all.'); g.end(this.result(g, 'fail', 'escaped')); }
      }
      if (8 - R.alivePart('cell').length >= 3 && !this.warned) { this.warned = true; G.HUD.radio(G.CAPTAIN.short, 'Easy! She\'s losing lift! One more holed cell and she goes in with Vivian aboard!'); }
    }
    G.HUD.sides(this.sideState(g));
  },
  onShipStopped(g, ship){
    if (ship !== this.raider || this.ended) return true;
    this.ended = true; ship.state = 'captured'; ship.obj.userData.flag.visible = true;
    G.HUD.radio(G.CAPTAIN.short, 'She\'s dead in the air! Boarding party away!');
    setTimeout(() => G.HUD.radio(G.RADIO.short, 'We\'ve got her! Vivian\'s safe, and she\'s... clutching a leather satchel she won\'t let go of. Interesting.'), 2500);
    g.end(Object.assign(this.result(g, this.sideState(g).every(s => s.st === 'ok') ? 'perfect' : 'success'), {delay:5500}));
    return true;
  },
  onShipRun(){},
  onPartDown(g, ship, c){ if (ship === this.raider && c.kind === 'engine' && ship.alivePart('engine').length) G.HUD.radio(G.RADIO.short, `Engine down! ${ship.alivePart('engine').length} to go!`); },
  onShipDown(g, ship){
    if (ship === this.raider) { if (this.ended) return; this.ended = true; G.HUD.radio(G.CAPTAIN.short, 'She\'s going in! No... there! A parachute! It\'s Vivian! Pick her up!'); g.end(this.result(g, 'fail', 'sunk')); return; }
    if (this.ended) return; this.ended = true; g.end(this.result(g, 'fail', 'margaret'));
  },
  playerDown(g){ if (this.ended) return; this.ended = true; G.HUD.radio(G.RADIO.short, 'We see your chute. The Lily is getting away...'); g.end(this.result(g, 'fail', 'down')); },
  sideState(g){ const R = this.raider, holed = 8 - R.alivePart('cell').length; return [{text:this.sides[0].text, st:holed <= 2 ? (this.ended ? 'ok' : 'live') : 'fail', val:`${holed}`}, {text:this.sides[1].text, st:g.kills >= 4 ? 'ok' : 'live', val:`${g.kills}/4`}]; },
  onKill(){},
  result(g, kind, why){
    const cash = kind === 'fail' ? 400 + g.kills*this.pay.kill/2 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill;
    const R = {
      perfect:{mood:'pleased', say:'Four engines, not a scratch on her gas cells, and Vivian didn\'t even muss her hair. Thorne\'s claiming the Lily as salvage.', then:`${VIVIAN} is safe aboard the Margaret, and she won't let go of a satchel she took from the Lily's chart room.`},
      success:{mood:'stern', say:'We got her back. The Lily\'s a wreck, but Vivian\'s safe.', then:`${VIVIAN} is safe aboard the Margaret, and she won't let go of a satchel she took from the Lily's chart room.`},
      fail:{mood:'angry', say:why === 'sunk' ? 'The Lily went down. We fished Vivian out of the drink, half drowned and furious. Whatever the Tigers wanted with her went down with the ship.' : 'The Lily got away over the border. Vivian Lacroix is somebody else\'s prisoner now.', then:why === 'sunk' ? 'Vivian is safe, but she says the Tigers were taking her to meet a black zeppelin with no name.' : 'Rumour says the Lily is headed to meet a black zeppelin with no name.'}
    }[kind];
    const flags = kind === 'fail' ? (why === 'sunk' ? {freed:1, lilySunk:1} : {vivianLost:1}) : {freed:1};
    return Object.assign({kind, cash:Math.round(cash), kills:g.kills, shipPct:Math.round(this.ship.hp/this.ship.hpMax*100), sides:this.sideState(g), flags}, R);
  }
});

/* ---------- Episode 3: The Phantom Ship ---------- */
G.MISSIONS.c1m3 = Object.assign(Object.create(base), {
  id:'c1m3', story:true, title:'The Phantom Ship', place:'The fog banks off Halcyon Point', wing:3,
  brief:'Whoever wanted Vivian Lacroix, it all points to a black zeppelin with no name, hiding in the fog banks off Halcyon Point. Find her. If you can, knock out her radio so she can\'t warn the Lantern, and cripple her before she slips away.',
  sides:[{text:'Knock out her radio mast'}, {text:'Down 4 fighters yourself'}],
  pay:{success:4000, perfect:1500, kill:300},
  setup(g){
    const F = G.save.story ? G.save.story.flags : {};
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.known = !!(F.photo || F.freed); this.clue = 0; this.found = false; this.runClock = 150;
    this.launch(g, this.known ? `Hook's live, ${G.save.callsign || 'Ace'}. We know her markings now. Sparks has her on the scope.` : `Hook's live, ${G.save.callsign || 'Ace'}. Pea soup out there. We're looking for wreckage, flares, anything.`, {pos:new V3(500, 600, -1200), heading:-0.6});
    // fog: the whole sky closes in
    g.scene.fog = new THREE.Fog(0xa7b0b8, 160, 2300); g.scene.background = new THREE.Color(0xa7b0b8); if (g.world.sky) g.world.sky.visible = false; g.world.sun.intensity = 0.8;
    const s = this.ship, dir = s.heading, base0 = s.pos;
    const along = d => new V3(base0.x + Math.sin(dir + 0.2)*d, 0, base0.z + Math.cos(dir + 0.2)*d);
    this.clues = [along(1300), along(2500).add(new V3(500, 0, 0)), along(3600).add(new V3(-300, 0, 300))].map((p, i) => {
      p.y = Math.max(g.world.height(p.x, p.z), 0.4); const m = G.buildWreck(); m.position.copy(p); m.rotation.y = i; g.scene.add(m); return {pos:p, m};
    });
    const pp = along(4600); pp.y = 700;
    this.phantom = g.addShip({team:1, kind:'raider', name:'Black zeppelin', label:'', paint:{hull:0x232224, band:0x3a1414, trim:0x6a6a6a, name:'', skull:false}, pos:pp, heading:dir + 1.4, speed:6, turn:0.015, hidden:!this.known, state:'passive', noMG:true, flakCd:2.6, noRockets:true});
    g.targetShip = this.known ? this.phantom : null;
    g.markers = [];
  },
  update(g, dt){
    this.pt += dt; const P = g.player, ph = this.phantom;
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); G.HUD.radio('Dutch', 'Can\'t see my own prop out here. Sticking close.'); }
    // the smoke pots on the wreckage keep smoking
    for (const c of this.clues) if (Math.random() < dt*6) g.fx.smoke.emit(c.pos.x, c.pos.y + 1, c.pos.z, 0, 4, 0, 6, 5, 0.85, 0.3, 0.25, 0.7, 5, 0.2, 1.2);
    if (this.phase === 1 && !this.ended) {
      g.markers = [];
      if (!this.found) {
        if (this.known) { g.markers.push({pos:ph.pos, label:'BLACK ZEPPELIN', col:'#ff6b57'}); G.HUD.objective('Find the black zeppelin in the fog'); }
        else if (this.clue < 3) {
          const c = this.clues[this.clue];
          g.markers.push({pos:tB.copy(c.pos).setY(c.pos.y + 20).clone(), label:'RED SMOKE', col:'#ff9a7a', edgeOnly:P.pos.distanceTo(c.pos) > 900, noDist:true});
          G.HUD.objective(`Search the fog: wreckage ${this.clue + 1} of 3`);
          if (P.pos.distanceTo(c.pos) < 480) {
            this.clue++;
            G.HUD.radio(G.RADIO.short, ['Wreckage! Pirate wing, skull roundel. Fresh. There\'s another smoke pot further out.', 'Another one. Shot-up crates with Starlight Pictures stencils on them. Keep going.', 'Big oil slick, and... I hear engines. Big ones. She\'s close!'][this.clue - 1]);
          }
        }
        if (P.pos.distanceTo(ph.pos) < (this.known || this.clue >= 3 ? 1100 : 900)) this.reveal(g);
        else if (!this.known && this.clue >= 3) g.markers.push({pos:ph.pos, label:'ENGINES', col:'#ff6b57', edgeOnly:true});
      } else if (ph.alive) {
        if (ph.state === 'running') { this.runClock -= dt; }
        const m = Math.max(0, Math.ceil(this.runClock));
        const radio = ph.alivePart('radio').length, eng = 4 - ph.alivePart('engine').length;
        G.HUD.objective(`Cripple her: radio mast ${radio ? 'up' : 'down'} · engines out ${eng}/2 · ${Math.floor(m/60)}:${String(m%60).padStart(2, '0')}`);
        if (!radio && eng >= 2) {
          this.ended = true; ph.state = 'running'; ph.speed0 = 6; ph.hidden = false;
          G.HUD.radio(G.CAPTAIN.short, 'Her radio\'s dead and she\'s limping. She\'s turning into the thick stuff... let her go, we know what we need.');
          g.end(this.result(g, this.sideState(g).every(s => s.st === 'ok') ? 'perfect' : 'success'));
        } else if (this.runClock <= 0) {
          this.ended = true; ph.hidden = true;
          G.HUD.radio(G.CAPTAIN.short, 'She\'s gone into the fog. Not a trace.'); g.end(this.result(g, 'fail'));
        }
      }
    }
    G.HUD.sides(this.sideState(g));
  },
  reveal(g){
    const ph = this.phantom; this.found = true; ph.hidden = false; ph.state = 'fighting'; g.targetShip = ph;
    const n = this.known ? 2 : 4;
    pirates(g, g.player.pos.clone().add(new V3(0, 120, 0)).addScaledVector(g.player.fwd, this.known ? 900 : -300), n, {gang:'lantern', skill:0.55, face:g.player.pos});
    G.HUD.radio(G.RADIO.short, this.known ? 'There she is! We caught her napping. Two fighters scrambling. Get that radio mast before she calls the Lantern!' : 'It\'s a trap! Four fighters out of the fog, right on top of you!');
    setTimeout(() => { if (ph.alive && ph.state === 'fighting') { ph.state = 'running'; G.HUD.radio(G.RADIO.short, 'She\'s running! Radio mast and two engines, quick!'); } }, this.known ? 25000 : 8000);
  },
  onPassiveHit(g, ship){ if (ship === this.phantom && !this.found && this.phase === 1) this.reveal(g); },
  onShipRun(){}, onPartDown(g, ship, c){ if (ship === this.phantom && c.kind === 'radio') G.HUD.radio(G.RADIO.short, 'Radio mast is down! She can\'t warn anybody now.'); },
  onShipDown(g, ship){ if (ship === this.phantom && !this.ended) { this.ended = true; G.HUD.radio(G.CAPTAIN.short, 'She\'s going down! Whatever she was carrying, it\'s in the sea now.'); g.end(this.result(g, 'success')); } },
  playerDown(g){ if (this.ended) return; this.ended = true; G.HUD.radio(G.RADIO.short, 'We see your chute! The black ship is getting away...'); g.end(this.result(g, 'fail')); },
  sideState(g){ const ph = this.phantom; return [{text:this.sides[0].text, st:this.found && !ph.alivePart('radio').length ? 'ok' : this.ended ? 'fail' : 'live', val:''}, {text:this.sides[1].text, st:g.kills >= 4 ? 'ok' : 'live', val:`${g.kills}/4`}]; },
  onKill(){},
  result(g, kind){
    const F = G.save.story ? G.save.story.flags : {};
    const cash = kind === 'fail' ? 400 + g.kills*this.pay.kill/2 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill;
    const vivian = F.vivianLost ? 'Somewhere out there, Vivian Lacroix is still a prisoner.' : `And ${VIVIAN} finally opens her satchel: blueprints for a prototype engine, stolen from the studio's aircraft division. She was smuggling them, and the Lantern wanted them back.`;
    const R = {
      perfect:{mood:'pleased', say:'We crippled her, silenced her radio, and the Lantern never heard a peep. She\'ll be limping for weeks.', then:`The black zeppelin's name, painted under the soot, was the Wraith: the Black Lantern's flagship. ${vivian}`},
      success:{mood:'stern', say:'She got away, but she\'s hurt and she couldn\'t call home. That\'ll do.', then:`The black zeppelin was the Wraith, the Black Lantern's flagship. ${vivian}`},
      fail:{mood:'angry', say:'Gone into the fog, and every pirate on the coast will know we came looking.', then:`The Black Lantern knows the Lucky Thirteen are onto them. ${vivian}`}
    }[kind];
    return Object.assign({kind, cash:Math.round(cash), kills:g.kills, shipPct:Math.round(this.ship.hp/this.ship.hpMax*100), sides:this.sideState(g), flags:kind === 'fail' ? {wraithWarned:1} : {wraithHurt:1}}, R);
  }
});

/* =====================================================================
   Chapter 2: "Wings for Sale"
   Episode 1: Special Delivery. Land at a back-country airstrip, collect a package from the Café Lafayette,
   then hook it onto the skyhook atop Halcyon Aero Works in Port Halcyon.
   ===================================================================== */
const STRIP = {x:-2500, z:-2100, r:400, yaw:0.6};
G.MISSIONS.c2m1 = Object.assign(Object.create(base), {
  id:'c2m1', story:true, weather:'rain', winMusic:'jetaime', title:'Special Delivery', place:'Café Lafayette airstrip, then Port Halcyon', wing:3,
  brief:'Vivian\'s blueprints are too hot to keep aboard. Odile Marchand, who runs the Café Lafayette out at the old Saint-Remy strip, has the copies sealed in a film can. Land at her strip, taxi up to the café, collect the can, and deliver it to Halcyon Aero Works by skyhook: there\'s a catch-ring hanging inside the open gallery cut through the top of their tower. Fly in, through the ring, and out the other side. Slow, steady, and through the ring. The Lantern will be watching the roads and the sky.',
  sides:[{text:'Deliver within 8 minutes'}, {text:'Down 3 Lantern fighters yourself'}],
  pay:{success:5000, perfect:2000, kill:300},
  worldOpts:() => ({seed:1931, flats:[{x:CITY.x, z:CITY.z, r:CITY.r}, {x:STRIP.x, z:STRIP.z, r:STRIP.r}]}),
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.stage = 'toStrip'; this.load = 0; this.clock = 480; this.waves = 0; this.holdOnGround = false;
    const w = g.world, sh = Math.max(w.raw(STRIP.x, STRIP.z), 14);
    // airstrip and café
    const strip = G.buildAirstrip(); strip.position.set(STRIP.x, sh, STRIP.z); strip.rotation.y = STRIP.yaw; g.scene.add(strip);
    const ud = strip.userData, rot = v => v.clone().applyAxisAngle(new V3(0, 1, 0), STRIP.yaw).add(new V3(STRIP.x, sh, STRIP.z));
    g.runways.push({pos:new V3(STRIP.x, sh, STRIP.z), yaw:STRIP.yaw, hw:ud.wid/2 + 10, hl:ud.len/2 + 22});
    this.apron = rot(ud.apron); g.runways.push({pos:this.apron, yaw:STRIP.yaw, hw:26, hl:34});
    w.addBlocker({x:rot(new V3(ud.apron.x + 44, 0, ud.apron.z + 10)).x, z:rot(new V3(ud.apron.x + 44, 0, ud.apron.z + 10)).z, hw:12, hd:12, top:sh + 13});
    // the Aero Works tower, its skyhook facing the strip
    const ty = Math.atan2(STRIP.x - CITY.x, STRIP.z - CITY.z), tx = CITY.x + 48, tz = CITY.z - 48, ax = Math.sin(ty), az = Math.cos(ty);
    // keep the approach and exit lanes through the gallery free of other towers
    cityscape(g, (x, z) => { const dx = x - tx, dz = z - tz, along = dx*ax + dz*az, lat = Math.abs(dx*az - dz*ax); return Math.hypot(dx, dz) < 70 || lat < 55; }, {air:{airways:[STRIP]}});
    const T = this.tower = G.buildSkyhookTower(140, 40), th = Math.max(w.height(CITY.x, CITY.z, true), 14); T.position.set(tx, th - 0.5, tz); T.rotation.y = ty; g.scene.add(T);
    this.hook = T.userData.hook.clone().applyAxisAngle(new V3(0, 1, 0), ty).add(T.position); this.hookN = new V3(Math.sin(ty), 0, Math.cos(ty)).negate(); this.ringR = T.userData.ringR;
    // the Margaret, holding off between the two
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. Saint-Remy strip is south-west. Land gentle; Odile hates divots.`, {pos:new V3(-600, 700, -900), heading:Math.atan2(STRIP.x + 600, STRIP.z + 900), turn:0.003});
    g.markers = [];
  },
  update(g, dt){
    this.pt += dt; const P = g.player;
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); G.HUD.radio('Dutch', 'We\'ll keep the sky clear while you play delivery boy.'); }
    towerCrash(g); this.towerHit(g);
    if (this.phase !== 1 || this.ended || !P.alive) { G.HUD.sides(this.sideState(g)); return; }
    this.clock -= dt; const m = Math.max(0, Math.ceil(this.clock)), clk = `${Math.floor(m/60)}:${String(m%60).padStart(2, '0')}`;
    g.markers = [];
    if (this.stage === 'toStrip') {
      g.markers.push({pos:new V3(STRIP.x, Math.max(g.world.raw(STRIP.x, STRIP.z), 14) + 30, STRIP.z), label:'SAINT-REMY STRIP · LAND', col:'#f2c14e'});
      G.HUD.objective(`Land at the Saint-Remy strip, taxi to the café · ${clk}`);
      if (P.onGround) this.stage = 'taxi';
    }
    if (this.stage === 'taxi') {
      const d = Math.hypot(P.pos.x - this.apron.x, P.pos.z - this.apron.z);
      g.markers.push({pos:this.apron.clone().setY(this.apron.y + 6), label:d < 26 ? (P.speed < 3 ? 'HOLD' : 'STOP HERE · brake with S') : 'TAXI TO THE CAFÉ', col:'#f2c14e'});
      G.HUD.objective(P.onGround ? `Taxi to the café apron and stop (steer with the mouse, S to brake) · ${clk}` : `Land at the Saint-Remy strip · ${clk}`);
      if (!P.onGround) { this.stage = 'toStrip'; }
      else if (d < 26 && P.speed < 3) {
        this.stage = 'loading'; this.load = 0; this.holdOnGround = true;
        G.music.play('jetaime');
        G.HUD.radio('Odile', `Bonsoir, ${G.save.callsign || 'chéri'}. Your film can. Do not open it, do not lose it, and do not get shot over my terrace.`);
        setTimeout(() => G.HUD.radio('Odile', 'And tell Mademoiselle Lacroix she still owes me for the champagne.'), 6500);
      }
    }
    if (this.stage === 'loading') {
      this.load += dt; G.HUD.objective(`Loading the film can… ${Math.min(100, Math.round(this.load/9*100))}%`);
      if (this.load >= 9) {
        this.stage = 'takeoff'; this.holdOnGround = false; P.throttle = 0;
        G.HUD.radio(G.RADIO.short, 'Got the package? Then get airborne. Throttle up with W, and pull the mouse up once you\'re rolling fast.'); G.HUD.toast('Package aboard');
      }
    }
    if (this.stage === 'takeoff') {
      G.HUD.objective(`Take off and head for Port Halcyon · ${clk}`);
      if (!P.onGround) this.stage = 'deliver';
    }
    if (this.stage === 'deliver') {
      const dh = P.pos.distanceTo(this.hook);
      if (this.waves === 0 && Math.hypot(P.pos.x - STRIP.x, P.pos.z - STRIP.z) > 1200) {
        this.waves = 1;
        pirates(g, P.pos.clone().addScaledVector(P.fwd, 1500).add(new V3(0, 200, 0)), 3, {gang:'lantern', skill:0.5, face:P.pos});
        G.HUD.radio(G.RADIO.short, 'Three Lantern fighters, dead ahead! They know what you\'re carrying!');
      }
      if (this.waves === 1 && dh < 2200) { this.waves = 2; pirates(g, this.hook.clone().add(new V3(600, 150, -600)), 2, {gang:'lantern', skill:0.55, face:P.pos}); G.HUD.radio(G.RADIO.short, 'Two more over the rooftops, waiting at the tower. Watch yourself!'); }
      const S = tA.copy(P.pos).addScaledVector(P.up, 1.6), rel = tB.copy(S).sub(this.hook), along = rel.dot(this.hookN), lat = rel.addScaledVector(this.hookN, -along).length();
      const slowOk = P.speed <= 105*G.MPH;
      g.markers.push({pos:this.hook, label:dh < 700 ? `SKYHOOK${slowOk ? ' · speed ✓' : ` · slow to 105 mph (${Math.round(P.speed/G.MPH)})`}` : 'HALCYON AERO WORKS · SKYHOOK', col:slowOk && dh < 700 ? '#9ef0a0' : '#f2c14e'});
      G.HUD.objective(`Deliver to the skyhook atop Halcyon Aero Works · ${clk}`);
      if (this.prevAlong !== undefined && this.prevAlong < 0 && along >= 0 && lat < this.ringR*0.95) {
        if (!slowOk) G.HUD.toast('Too fast: the hook missed you');
        else return this.hooked(g);
      }
      this.prevAlong = along;
    }
    if (this.clock <= 0 && !this.ended) { this.ended = true; G.HUD.radio(G.CAPTAIN.short, 'Aero Works closed the deal with somebody else. We\'re too late.'); g.end(this.result(g, 'fail', 'late')); }
    G.HUD.sides(this.sideState(g));
  },
  /* the Aero Works tower is solid except for the gallery cut through it; wings that touch the walls, floor or ceiling don't make it */
  towerHit(g){
    const T = this.tower, U = T.userData, gl = U.gallery, half = U.w/2;
    for (const p of g.planes) {
      if (!p.alive || p.frozen) continue;
      const l = T.worldToLocal(tA.copy(p.pos));
      if (Math.abs(l.x) > half + 5 || Math.abs(l.z) > half + 5 || l.y > U.top + 30 || l.y < 0) continue;
      const inGallery = l.y > gl.y0 + 2 && l.y < gl.y1 - 1.6 && Math.abs(l.x) < gl.ow/2 - 5;
      const inside = Math.abs(l.x) < half + 4 && Math.abs(l.z) < half + 1 && l.y < U.top + 22;
      if (inside && !inGallery) { if (p.isPlayer && g.done) continue; p.destroy(null, 'crash'); }
    }
  },
  hooked(g){
    const P = g.player; this.ended = true; P.frozen = true; P.fire = P.fireRk = false;
    const hold = () => { P.pos.copy(this.hook).add(tA.set(0, -1.6, 0)); P.q.setFromUnitVectors(new V3(0, 0, 1), this.hookN); P.sync(); };
    hold(); g.cine = (dt, cam) => { hold(); cam.position.lerp(tB.copy(this.hook).addScaledVector(this.hookN, -40).add(tA.set(18, 6, 0)), 0.05); cam.lookAt(P.pos); };
    G.HUD.toast('Hooked! Package delivered'); if (g.audio) g.audio.hitMe(true);
    G.HUD.radio('Aero Works', 'We have it! Nice catch, flyer. Mr. Hollis would like a word with your captain.');
    g.markers = [];
    g.end(Object.assign(this.result(g, this.sideState(g).every(s => s.st === 'ok') ? 'perfect' : 'success'), {delay:5000}));
  },
  sideState(g){ return [{text:'Deliver within 8 minutes', st:this.clock > 0 ? (this.ended && this.stage === 'deliver' ? 'ok' : 'live') : 'fail', val:''}, {text:this.sides[1].text, st:g.kills >= 3 ? 'ok' : 'live', val:`${g.kills}/3`}]; },
  onKill(){},
  onTouchdown(g, hard){ if (this.stage === 'toStrip' || this.stage === 'taxi') G.HUD.radio('Odile', hard ? 'Mon Dieu, my runway! Taxi to the café, please, before you break something else.' : 'Very pretty. Taxi up to the café, chéri.'); },
  playerDown(g){ if (this.ended) return; this.ended = true; G.HUD.radio(G.RADIO.short, 'We see your chute... and the film can is going down with the plane.'); g.end(this.result(g, 'fail', 'down')); },
  result(g, kind, why){
    const cash = kind === 'fail' ? 300 + g.kills*this.pay.kill/2 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill;
    const R = {
      perfect:{mood:'pleased', say:'Through the ring like threading a needle, on time, with three Lantern fighters in the bay behind you. Hollis at Aero Works is already writing a cheque.', then:'Halcyon Aero Works has the blueprints. Their chief designer, Augustin Hollis, wants to build the prototype engine, and he wants the Lucky Thirteen to fly it.'},
      success:{mood:'stern', say:'Delivered. A little late and a little loud, but delivered.', then:'Halcyon Aero Works has the blueprints. Their chief designer, Augustin Hollis, wants to build the prototype engine, and he wants the Lucky Thirteen to fly it.'},
      fail:{mood:'angry', say:why === 'late' ? 'We missed the window. Aero Works sold the slot to a rival studio.' : 'The film can went down with your plane. Somewhere in the hills, a Lantern scavenger just got very lucky.', then:'The blueprints are out of our hands, and the Black Lantern is closing in on whoever has them.'}
    }[kind];
    return Object.assign({kind, cash:Math.round(cash), kills:g.kills, shipPct:Math.round(this.ship.hp/this.ship.hpMax*100), sides:this.sideState(g), flags:kind === 'fail' ? {blueprintsLost:1} : {delivered:1}}, R);
  }
});

/* =====================================================================
   Chapter 2, Episode 2: The Meridian Hunt
   Hollis's old partner Cyrus Vane crashed his record racer, the Meridian, in 1929 with the first prototype engine aboard,
   and hid the way to her in riddles. Follow the clues across Halcyon Island before treasure hunter "Duke" Galloway does.
   ===================================================================== */
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const bearingWord = (from, to) => COMPASS[(Math.round(Math.atan2(to.x - from.x, to.z - from.z)/(Math.PI/4)) + 8) % 8];
G.MISSIONS.c2m2 = Object.assign(Object.create(base), {
  id:'c2m2', story:true, weather:'overcast', title:'The Meridian Hunt', place:'All over Halcyon Island', wing:3,
  brief:'In 1929 Hollis\'s partner Cyrus Vane flew the first prototype engine in his racer, the Meridian, and never came back. He left riddles in his logbook, and Hollis just found it. So did Ignatius "Duke" Galloway, the most shameless treasure hunter on the coast, and he\'s got friends in the Aero Club, so shooting him is off the table. Out-fly him: follow the clues, beat Duke to the wreck, and circle it low until the Margaret\'s salvage crew can winch up the engine.',
  sides:[{text:'Beat Duke to every clue'}, {text:'Down 3 scavengers yourself'}],
  pay:{success:6000, perfect:2500, kill:300},
  worldOpts:() => ({seed:1931, flats:[{x:CITY.x, z:CITY.z, r:CITY.r}, {x:STRIP.x, z:STRIP.z, r:STRIP.r}]}),
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.clue = 0; this.duke = 0; this.salvage = 0; this.dukeSalvage = 0; this.beat = true; this.found = false; this.prevAlong = undefined;
    const w = g.world, R = w.raw.bind(w), flatNear = (x, z) => Math.hypot(x - CITY.x, z - CITY.z) < CITY.r + 300 || Math.hypot(x - STRIP.x, z - STRIP.z) < STRIP.r + 300;
    cityscape(g, null, {air:{airways:[STRIP]}});
    const strip = G.buildAirstrip(), sh = Math.max(R(STRIP.x, STRIP.z), 14); strip.position.set(STRIP.x, sh, STRIP.z); strip.rotation.y = STRIP.yaw; g.scene.add(strip);
    // 1: the lighthouse on Halcyon Point, the last bit of land heading east
    const la = Math.PI*0.42; let lr = 2500; for (let r = 2500; r < 6500; r += 20) if (R(Math.sin(la)*r, Math.cos(la)*r) > 5) lr = r;
    const L = new V3(Math.sin(la)*(lr - 70), 0, Math.cos(la)*(lr - 70)); L.y = Math.max(w.height(L.x, L.z), 1);
    this.light = G.buildLighthouse(); this.light.position.copy(L); g.scene.add(this.light); w.addBlocker({x:L.x, z:L.z, hw:5, hd:5, top:L.y + 47});
    // 2: the windmill, on the highest hill in the north-west
    let M = null, mh = -1e9; for (let x = -2600; x <= -600; x += 80) for (let z = 1600; z <= 3600; z += 80) { const h = R(x, z); if (h > mh && !flatNear(x, z) && h < 260) { mh = h; M = new V3(x, h, z); } }
    M.y = w.height(M.x, M.z); this.mill = G.buildWindmill(); this.mill.position.copy(M); this.mill.rotation.y = Math.atan2(-M.x, -M.z); g.scene.add(this.mill); w.addBlocker({x:M.x, z:M.z, hw:7, hd:7, top:M.y + 25});
    // 3: the viaduct the trains forgot, down south
    const vx = 1300, vz = -2500, len = 300, n = 5, hs = []; for (let i = 0; i <= n; i++) hs.push(Math.max(w.height(vx - len/2 + i*len/n, vz), 2));
    const deck = Math.max(...hs) + 46, via = G.buildViaduct(len, deck, hs); via.position.set(vx, 0, vz); g.scene.add(via);
    for (let i = 0; i <= n; i++) w.addBlocker({x:vx - len/2 + i*len/n, z:vz, hw:3, hd:4.5, top:deck + 3});
    this.arch = {pos:new V3(vx, Math.max(w.height(vx, vz), 2), vz), n:new V3(0, 0, 1), w:50, h:deck - 6 - Math.max(w.height(vx, vz), 2)};
    // 4: the Meridian, on the highest ground on the island
    let W = null, wh = -1e9; for (let x = -3600; x <= 3600; x += 150) for (let z = -3600; z <= 3600; z += 150) { if (Math.hypot(x, z) > 3800 || flatNear(x, z) || Math.hypot(x - M.x, z - M.z) < 900) continue; const h = R(x, z); if (h > wh) { wh = h; W = new V3(x, h, z); } }
    W.y = w.height(W.x, W.z); this.wreck = G.buildWreckRacer(); this.wreck.position.copy(W); g.scene.add(this.wreck);
    this.sites = [L, M, this.arch.pos, W];
    // speed-boost rings along each leg of the hunt: fly through one for a few seconds of extra speed. Duke uses them too.
    this.rings = []; const start = new V3(600, 0, 300), legs = [[start, L], [L, M], [M, this.arch.pos], [this.arch.pos, W]];
    legs.forEach(([a, b], li) => [0.3, 0.55, 0.8].forEach(t => {
      const p = new V3().lerpVectors(a, b, t); let gy = 0; for (const o of [-60, 0, 60]) gy = Math.max(gy, w.height(p.x + o, p.z + o), 0.4);
      p.y = gy + 150; const m = G.buildBoostRing(); m.position.copy(p); m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); g.scene.add(m);
      this.rings.push({pos:p, n:new V3(Math.sin(m.rotation.y), 0, Math.cos(m.rotation.y)), R:m.userData.R, leg:li, prev:new Map(), used:new Set(), m});
    }));
    this.riddles = [
      'Vane\'s logbook, page one: "Where the light turns all night and never tires, knock at the keeper\'s door."',
      '"Then climb to the miller who grinds the wind, on the highest green hill."',
      '"Pass beneath the stone road the trains forgot. Mind the arches."',
      '"And where the island stands tallest, she sleeps on her silver wings."'];
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. Hollis is reading us the logbook. Drop and let's go treasure hunting.`, {pos:new V3(600, 760, 300), heading:Math.atan2(L.x - 600, L.z - 300), turn:0.003});
    g.markers = [];
  },
  drop(){
    base.drop.call(this); const g = this.g, P = g.player;
    G.music.play('caravan');   // the treasure-hunt tune runs the whole hunt
    // Duke Galloway: a white-and-gold Gallant, racing the same clues
    const L = G.stockLoadout('gallant'); L.paint = [0xf1e9d6, 0xdba63e, 0x151312]; L.engine = 2; L.hp = 0;   // a stripped racer with the hot engine
    const pos = P.pos.clone().addScaledVector(P.right, -320).add(new V3(0, 40, -120));
    this.dukeP = g.addPlane({loadout:L, team:1, name:'Ignatius "Duke" Galloway', callsign:'Duke Galloway', rival:true, pos, q:P.q, speed:80, ai:{role:'fighter', skill:0.75}, internalMul:1.4});
    this.dukeP.invuln = true;   // he's a rival, not a target: you have to out-fly him
    const pl = this.dukePilot = g.pilots[g.pilots.length - 1];
    // Duke flies the rings on each leg, then the clue; his clue count only advances on the clues themselves
    const route = []; [this.sites[0], this.sites[1], this.arch.pos, this.sites[3]].forEach((p, i) => {
      for (const r of this.rings.filter(r => r.leg === i)) route.push({x:r.pos.x, z:r.pos.z, y:r.pos.y, r:30});
      route.push({x:p.x, z:p.z, r:i === 3 ? 250 : 220, agl:i === 2 ? 25 : 120, clue:i + 1});
    });
    pl.route = route; pl.wp = 0; pl.raceThrottle = 1;
    pl.onWaypoint = k => { const done = pl.route[k - 1]; if (!done || !done.clue) return; const n = done.clue; this.duke = n; if (n < 4) G.HUD.radio('Duke', ['First clue\'s mine, kid! Try to keep up.', 'The miller says hello. Too slow!', 'Under the bridge and gone! You\'re eating my dust.'][n - 1] || ''); else { G.HUD.radio('Duke', 'There she is! Boys, get the winch ready!'); this.scavengers(); } };
    setTimeout(() => G.HUD.radio('Duke', `Well, if it isn't the Lucky Thirteen. May the best treasure hunter win, ${G.save.callsign || 'kid'}. That'll be me.`), 2500);
    G.HUD.radio(G.RADIO.short, this.riddles[0]);
  },
  scavengers(){ if (this.scav) return; this.scav = 1; const W = this.sites[3]; pirates(this.g, W.clone().add(new V3(900, 350, -600)), 3, {gang:'tigers', skill:0.45, face:W}); G.HUD.radio(G.RADIO.short, 'Duke\'s scavengers are coming in over the ridge! Three of them!'); },
  update(g, dt){
    this.pt += dt; const P = g.player;
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); G.HUD.radio('Hellcat', 'A treasure hunt! Finally something fun.'); }
    if (this.light) this.light.userData.beam.rotation.y += dt*0.9;
    if (this.mill) this.mill.userData.sails.rotation.z += dt*0.7;
    if (this.wreck && Math.random() < dt*8) { const sp = tA.copy(this.wreck.userData.smoke).add(this.wreck.position); g.fx.smoke.emit(sp.x, sp.y, sp.z, 0, 5, 0, 7, 7, 0.3, 0.3, 0.3, 0.6, 6, 0.2, 1.4); }
    towerCrash(g);
    if (this.phase !== 1 || this.ended || !P.alive) { G.HUD.sides(this.sideState(g)); return; }
    g.markers = [];
    for (const r of this.rings) {
      for (const p of [P, this.dukeP]) {
        if (!p || !p.alive) continue;
        const rel = tA.copy(p.pos).sub(r.pos), along = rel.dot(r.n), lat = rel.addScaledVector(r.n, -along).length(), prev = r.prev.get(p);
        if (prev !== undefined && Math.sign(prev) !== Math.sign(along) && lat < r.R + (p.isPlayer ? 0 : 14) && !r.used.has(p)) {
          r.used.add(p); p.nitro = 4;
          if (p.isPlayer) { G.HUD.toast('Boost!'); if (g.audio) { g.audio.ding(); g.audio.rocket(0.5); } }
        }
        r.prev.set(p, along);
      }
      if (!r.used.has(P) && r.pos.distanceTo(P.pos) < 2200) g.markers.push({pos:r.pos, label:'BOOST', col:'#9ef0a0', noDist:true});
    }
    const site = this.sites[this.clue], dist = site ? Math.hypot(site.x - P.pos.x, site.z - P.pos.z) : 0;
    const names = ['THE LIGHTHOUSE', 'THE WINDMILL', 'UNDER THE VIADUCT', 'THE MERIDIAN'];
    if (this.clue < 4) {
      g.markers.push({pos:tB.copy(site).setY(site.y + (this.clue === 2 ? this.arch.h*0.45 : 40)).clone(), label:names[this.clue], col:'#f2c14e', edgeOnly:dist > 1800, noDist:dist > 1800});
      G.HUD.objective(`Clue ${this.clue + 1} of 4: ${['the lighthouse', 'the windmill', 'under the viaduct', 'the wreck'][this.clue]}, ${bearingWord(P.pos, site)} · Duke ${this.duke >= 4 ? 'is at the wreck!' : 'on clue ' + Math.min(4, this.duke + 1)}`);
      let hit = false;
      if (this.clue === 0) hit = P.pos.distanceTo(site) < 200;
      if (this.clue === 1) hit = P.pos.distanceTo(site) < 180;
      if (this.clue === 2) {
        const A = this.arch, rel = tA.copy(P.pos).sub(A.pos), along = rel.dot(A.n), lat = Math.abs(rel.x*A.n.z - rel.z*A.n.x);
        if (this.prevAlong !== undefined && Math.sign(along) !== Math.sign(this.prevAlong) && lat < A.w/2 && rel.y > -2 && rel.y < A.h) hit = true;
        this.prevAlong = along;
      }
      if (this.clue === 3 && dist < 450) hit = true;
      if (hit) {
        if (this.duke > this.clue) this.beat = false;
        this.clue++; G.HUD.toast(`Clue ${this.clue} of 4`); if (g.audio) g.audio.ding();
        if (this.clue < 4) G.HUD.radio(G.RADIO.short, this.riddles[this.clue]);
        else { this.found = true; G.HUD.radio(G.RADIO.short, 'That\'s her! The Meridian! Circle her low and slow, and the Margaret\'s crew will winch up the engine. Keep Duke\'s scavengers off it!'); this.scavengers(); }
      }
    } else {
      // salvage: circle within 450 m of the wreck, under 260 m above the ground
      const W = this.sites[3], d = Math.hypot(W.x - P.pos.x, W.z - P.pos.z), agl = P.pos.y - Math.max(g.world.height(P.pos.x, P.pos.z), 0.4), ok = d < 450 && agl < 260;
      this.salvage = ok ? this.salvage + dt : Math.max(0, this.salvage - dt*0.3);
      g.markers.push({pos:tB.copy(W).setY(W.y + 30).clone(), label:ok ? `WINCHING ${Math.round(this.salvage/18*100)}%` : 'CIRCLE LOW HERE', col:ok ? '#9ef0a0' : '#f2c14e'});
      G.HUD.objective(`Circle the Meridian low while the crew winches up the engine · ${Math.round(this.salvage/18*100)}%`);
      if (this.salvage >= 18) {
        this.ended = true; G.HUD.radio(G.CAPTAIN.short, 'Engine\'s aboard! Cyrus Vane\'s Meridian engine, after eight years on a mountain. Hollis is weeping into the radio.');
        g.end(this.result(g, this.sideState(g).every(s => s.st === 'ok') ? 'perfect' : 'success'));
      }
    }
    // Duke claims it if he circles the wreck long enough
    if (this.dukeP && this.dukeP.alive && this.duke >= 4) {
      this.dukeSalvage += dt;
      if (this.dukeSalvage > 30 && !this.ended) { this.ended = true; G.HUD.radio('Duke', 'Got it! Better luck next time, kid!'); g.end(this.result(g, 'fail')); }
    }
    G.HUD.sides(this.sideState(g));
  },
  onKill(){},
  onInvulnHit(g){ if (this.pt - (this.dukeT || -99) > 8) { this.dukeT = this.pt; G.HUD.radio('Duke', G.pick(['Shooting at me? That\'s not very sporting, kid. And you missed.', 'Hey! Keep that up and I\'ll send Thorne the paint bill!', 'Bullets bounce off a winner. Race me fair!'])); G.HUD.radio(G.RADIO.short, 'Leave Duke be! He\'s got friends in the Aero Club. Just beat him there.'); } },
  sideState(g){ return [{text:'Beat Duke to every clue', st:this.beat ? (this.clue >= 4 ? 'ok' : 'live') : 'fail', val:`${this.clue}/4`}, {text:this.sides[1].text, st:g.kills >= 3 ? 'ok' : 'live', val:`${g.kills}/3`}]; },
  playerDown(g){ if (this.ended) return; this.ended = true; G.HUD.radio(G.RADIO.short, 'We see your chute! And Duke is circling the wreck…'); g.end(this.result(g, 'fail')); },
  result(g, kind){
    const cash = kind === 'fail' ? 400 + g.kills*this.pay.kill/2 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill;
    const R = {
      perfect:{mood:'pleased', say:'Every clue first, Duke in the drink, and the Meridian engine in our hold. Hollis says it\'s still in its crate, good as new.', then:'Halcyon Aero Works has Cyrus Vane\'s lost engine and Vivian\'s blueprints. Hollis can build the prototype. The Black Lantern will want both.'},
      success:{mood:'stern', say:'We\'ve got the engine. Duke\'s furious, and that\'s just a bonus.', then:'Halcyon Aero Works has Cyrus Vane\'s lost engine and Vivian\'s blueprints. Hollis can build the prototype. The Black Lantern will want both.'},
      fail:{mood:'angry', say:'Duke Galloway winched up the Meridian engine right under our noses. He\'ll sell it to the highest bidder.', then:'Duke Galloway has the Meridian engine, and every pirate gang on the coast is about to bid for it.'}
    }[kind];
    return Object.assign({kind, cash:Math.round(cash), kills:g.kills, shipPct:Math.round(this.ship.hp/this.ship.hpMax*100), sides:this.sideState(g), flags:kind === 'fail' ? {dukeHasEngine:1} : {meridian:1}}, R);
  }
});

/* =====================================================================
   Shared helpers for Chapters 2 and 3
   ===================================================================== */
const SKULL = {x:-600, z:7000};
function rockSolid(g){ for (const [hw, top] of [[105, 95], [70, 120], [35, 134]]) g.world.addBlocker({x:SKULL.x, z:SKULL.z, hw, hd:hw, top}); }
const fmtClock = t => { const m = Math.max(0, Math.ceil(t)); return `${Math.floor(m/60)}:${String(m%60).padStart(2, '0')}`; };
function buildStrip(g){
  const w = g.world, sh = Math.max(w.raw(STRIP.x, STRIP.z), 14), strip = G.buildAirstrip();
  strip.position.set(STRIP.x, sh, STRIP.z); strip.rotation.y = STRIP.yaw; g.scene.add(strip);
  const ud = strip.userData, rot = v => v.clone().applyAxisAngle(new V3(0, 1, 0), STRIP.yaw).add(new V3(STRIP.x, sh, STRIP.z));
  g.runways.push({pos:new V3(STRIP.x, sh, STRIP.z), yaw:STRIP.yaw, hw:ud.wid/2 + 10, hl:ud.len/2 + 22});
  const apron = rot(ud.apron); g.runways.push({pos:apron, yaw:STRIP.yaw, hw:26, hl:34});
  const cafe = rot(new V3(ud.apron.x + 44, 0, ud.apron.z + 10)); w.addBlocker({x:cafe.x, z:cafe.z, hw:12, hd:12, top:sh + 13});
  return {sh, apron, rot, len:ud.len, centre:new V3(STRIP.x, sh, STRIP.z)};
}
/* skip the trapeze: the player starts parked on a runway, engine idling */
function startOnRunway(m, g, pos, yaw){
  const P = g.player; m.awaitDrop = false; g.cine = null; g.running = true; G.HUD.banner(null);
  const o = G.COOP_SLOTS ? G.COOP_SLOTS[G.coopSlot()] : [0, 0, 0];   // co-op: side by side, staggered behind (forward would be in the way)
  P.frozen = false; P.onGround = true; P.pos.copy(pos).add(new V3(o[0]*1.6, 0, -Math.abs(o[2])*1.6).applyAxisAngle(new V3(0, 1, 0), yaw)); P.pos.y += P.ud.gear || 2; P.groundYaw = yaw; P.q.setFromAxisAngle(new V3(0, 1, 0), yaw); P.axes();
  P.speed = 0; P.throttle = 0; g.aimYaw = yaw; g.aimPitch = -0.03; P.sync(); m.phase = 1; m.pt = 0; if (!m.noMusic) G.music.mission(g.world.time);
}
const flatsBoth = () => ({seed:1931, flats:[{x:CITY.x, z:CITY.z, r:CITY.r}, {x:STRIP.x, z:STRIP.z, r:STRIP.r}]});
const RES = (m, g, kind, R, flags) => Object.assign({kind, kills:g.kills, shipPct:m.ship ? Math.round(m.ship.hp/m.ship.hpMax*100) : 100, sides:m.sideState(g), flags:flags || {}}, R);

/* =====================================================================
   Chapter 2, Episode 3: Proving Grounds (no combat)
   Hollis's prototype, the Comet, on its first trials: climb, measured mile, stunt card. Then the engine dies.
   ===================================================================== */
G.MISSIONS.c2m3 = Object.assign(Object.create(base), {
  id:'c2m3', story:true, title:'Proving Grounds', place:'Saint-Remy airstrip, now Aero Works\' test field', wing:0,
  brief:'Hollis built the Comet in eleven days: Vivian\'s airframe drawings wrapped around Cyrus Vane\'s Meridian engine. Today you fly the trials. Climb to 2,000 feet, run the measured mile between the two hoops as fast as she\'ll go, then work through the stunt card. No guns, no pirates. Just you and the fastest airplane in the Sierra.',
  sides:[{text:'Climb to 2,000 ft in 75 seconds'}, {text:'Measured mile over 250 mph'}],
  pay:{success:4000, perfect:2000, kill:0},
  worldOpts:flatsBoth,
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.stage = 'roll'; this.climbT = 0; this.climbOk = false; this.mileMph = 0; this.stunts = {}; this.soft = false; this.mileA = null;
    const S = this.S = buildStrip(g);
    this.launch(g, 'Comet is fuelled and warm. Whenever you\'re ready, test pilot.', {pos:new V3(STRIP.x + 1200, 800, STRIP.z + 900), heading:0, turn:0.003, load:G.stockLoadout('comet')});
    const start = S.rot(new V3(0, 0, -S.len/2 + 40)); startOnRunway(this, g, start, STRIP.yaw);
    // the measured mile: two brass hoops 1,600 m apart on a line away from the strip, high enough to clear the hills
    const dir = new V3(Math.sin(STRIP.yaw + 0.9), 0, Math.cos(STRIP.yaw + 0.9)), a = S.centre.clone().addScaledVector(dir, 1500), b = a.clone().addScaledVector(dir, 1600);
    let top = 0; for (let t = 0; t <= 1; t += 0.05) { const p = new V3().lerpVectors(a, b, t); top = Math.max(top, g.world.height(p.x, p.z)); }
    this.mile = [a, b].map(p => { p.y = top + 140; const m = G.buildBoostRing(11); m.position.copy(p); m.rotation.y = Math.atan2(dir.x, dir.z); g.scene.add(m); return {pos:p, n:dir.clone(), R:11, prev:undefined}; });
    G.HUD.radio('Hollis', 'Throttle up with W, steer with the mouse, and pull up past rotation speed. Easy does it, she\'s the only one there is.');
  },
  through(r, P){ const rel = tA.copy(P.pos).sub(r.pos), along = rel.dot(r.n), lat = rel.addScaledVector(r.n, -along).length(), hit = r.prev !== undefined && r.prev < 0 && along >= 0 && lat < r.R; r.prev = along; return hit; },
  update(g, dt){
    this.pt += dt; const P = g.player; if (this.phase !== 1 || this.ended || !P.alive) { G.HUD.sides(this.sideState(g)); return; }
    g.markers = [];
    const agl = P.pos.y - Math.max(g.world.height(P.pos.x, P.pos.z, true), 0.4);
    if (this.stage === 'roll') { G.HUD.objective('Trial 1: take off and climb to 2,000 ft · clock starts when you open the throttle'); if (P.throttle > 0.3) { this.stage = 'climb'; this.climbT = 0; } }
    if (this.stage === 'climb') {
      this.climbT += dt; G.HUD.objective(`Trial 1: climb to 2,000 ft · ${Math.round(P.pos.y*3.28)} ft · ${fmtClock(75 - this.climbT)}`);
      if (P.pos.y*3.28 >= 2000) { this.climbOk = this.climbT <= 75; this.stage = 'mileA'; if (g.audio) g.audio.ding(); G.HUD.radio('Hollis', this.climbOk ? `2,000 feet in ${Math.round(this.climbT)} seconds! She climbs like a homesick angel.` : `2,000 feet. ${Math.round(this.climbT)} seconds. Slower than I hoped, but she's carrying test gear.`); G.HUD.radio(G.RADIO.short, 'Now the measured mile. Through the first hoop, flat out, through the second.'); }
    }
    if (this.stage === 'mileA' || this.stage === 'mileB') {
      const r = this.mile[this.stage === 'mileA' ? 0 : 1];
      g.markers.push({pos:r.pos, label:this.stage === 'mileA' ? 'MEASURED MILE · START' : 'FINISH', col:'#9ef0a0'});
      G.HUD.objective(this.stage === 'mileA' ? 'Trial 2: the measured mile. Fly through the start hoop at full throttle' : `Trial 2: flat out to the finish hoop · ${Math.round(P.speed/G.MPH)} mph`);
      if (this.through(r, P)) {
        if (g.audio) g.audio.ding();
        if (this.stage === 'mileA') { this.stage = 'mileB'; this.mileA = this.pt; }
        else { const t = this.pt - this.mileA; this.mileMph = Math.round(1600/t/G.MPH); const best = G.save.times.mile || 0; if (this.mileMph > best) { G.save.times.mile = this.mileMph; G.persist(); }
          this.stage = 'stunts'; G.HUD.radio('Hollis', `${this.mileMph} miles an hour over the mile!${this.mileMph >= 250 ? ' That\'s a record! Unofficial, but a record!' : ' Not bad. A dive into the start hoop would help.'}`);
          setTimeout(() => G.HUD.radio(G.RADIO.short, 'Last card: an Immelmann (R), a Split-S (Z), a barrel roll (double-tap A or D), and a snap turn (double-tap Q or E). Any order.'), 3000); }
      }
    }
    if (this.stage === 'stunts') {
      const need = [['immel', 'Immelmann'], ['splits', 'Split-S'], ['roll', 'Barrel roll'], ['snap', 'Snap turn']];
      G.HUD.objective('Trial 3: stunt card · ' + need.map(([k, n]) => (this.stunts[k] ? '✓ ' : '○ ') + n).join('  '));
      if (need.every(([k]) => this.stunts[k])) { this.stage = 'home'; G.HUD.radio('Hollis', 'Beautiful! That\'s the card. Bring her home and let\'s have a look at the... wait. Your fuel pressure. What\'s your fuel pressure?'); }
    }
    if (this.stage === 'home') {
      const d = Math.hypot(P.pos.x - STRIP.x, P.pos.z - STRIP.z);
      G.HUD.objective('Head back toward the Saint-Remy strip');
      g.markers.push({pos:this.S.centre.clone().setY(this.S.sh + 20), label:'SAINT-REMY STRIP', col:'#f2c14e'});
      if (d < Math.max(900, agl*4.2)) {   // fail the engine only once the strip is within gliding range
        this.stage = 'glide'; P.engineDead = true;
        G.HUD.radio('Hollis', 'Sugar! Somebody\'s put sugar in the tank! The engine\'s seizing, cut it, CUT IT!');
        setTimeout(() => G.HUD.radio(G.RADIO.short, 'Engine\'s gone. You\'re a glider now, sugar. Keep your speed up, put the flaps down (F) at the end, and land her on the strip.'), 2500);
      }
    }
    if (this.stage === 'glide') {
      g.markers.push({pos:this.S.centre.clone().setY(this.S.sh + 20), label:'DEAD-STICK LANDING', col:'#ff9a7a'});
      G.HUD.objective(`Dead-stick landing on the Saint-Remy strip · ${Math.round(agl*3.28)} ft above ground · ${Math.round(P.speed/G.MPH)} mph`);
      if (P.onGround && P.speed < 2) {
        this.ended = true; G.save.owned.includes('comet') || G.save.owned.push('comet'); G.persist();
        G.HUD.radio('Hollis', this.soft ? 'Not a scratch! You landed my airplane without an engine and not a scratch!' : 'She\'s down! Bent, but down. Thank God.');
        g.end(this.result(g, this.climbOk && this.mileMph >= 250 && this.soft ? 'perfect' : 'success'));
      }
    }
    G.HUD.sides(this.sideState(g));
  },
  onStunt(g, kind){ if (this.stage === 'stunts' && !this.stunts[kind]) { this.stunts[kind] = 1; if (g.audio) g.audio.ding(); } },
  onTouchdown(g, hard){ if (this.stage === 'glide') this.soft = !hard; },
  sideState(g){ return [{text:this.sides[0].text, st:this.stage === 'roll' || this.stage === 'climb' ? 'live' : this.climbOk ? 'ok' : 'fail', val:this.climbT ? `${Math.round(this.climbT)}s` : ''}, {text:this.sides[1].text, st:this.mileMph ? (this.mileMph >= 250 ? 'ok' : 'fail') : 'live', val:this.mileMph ? `${this.mileMph} mph` : ''}]; },
  onKill(){},
  playerDown(g){ if (this.ended) return; this.ended = true; G.HUD.radio('Hollis', 'She\'s gone. The Comet\'s gone. ...Is the pilot all right? Somebody tell me the pilot\'s all right.'); g.end(this.result(g, 'fail')); },
  result(g, kind){
    const cash = kind === 'fail' ? 500 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0);
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:`Record climb, ${this.mileMph} over the mile, a full stunt card, and a dead-stick landing like a feather. Hollis cried. Then he handed you the keys.`, then:'The Comet is yours (pick her in the Hangar). But somebody inside Aero Works put sugar in her tank, and Hollis wants to know who.'},
      success:{mood:'stern', say:'You brought the Comet home without an engine. Hollis is calling it a miracle and you a lunatic, in that order.', then:'The Comet is yours (pick her in the Hangar). But somebody inside Aero Works put sugar in her tank, and Hollis wants to know who.'},
      fail:{mood:'angry', say:'The Comet\'s in pieces on a hillside and you\'re in one piece on a stretcher. Hollis says he can build another. Slowly.', then:'Hollis rebuilds the Comet from spares and gives her to the Lucky Thirteen anyway. Somebody inside Aero Works put sugar in her tank.'}
    }[kind]), kind === 'fail' ? {cometWrecked:1} : {comet:1});
  }
});

/* =====================================================================
   Chapter 2, Episode 4: The Mole (no combat)
   Tail Hollis's assistant from Aero Works through town, then his getaway plane out to sea, without being spotted.
   ===================================================================== */
G.MISSIONS.c2m4 = Object.assign(Object.create(base), {
  id:'c2m4', story:true, weather:'overcast', title:'The Mole', place:'Port Halcyon, then out over the northern sea', wing:0,
  brief:'Hollis\'s assistant, Percival Dunmore, signed for the Comet\'s fuel. Tonight he left the Aero Works yard in a delivery truck in a tearing hurry. Follow him from the air: close enough not to lose him, high and far enough that he never looks up. Wherever he\'s going, the Lantern is waiting.',
  sides:[{text:'Never get spotted'}, {text:'Follow him all the way'}],
  pay:{success:4500, perfect:2000, kill:0},
  worldOpts:flatsBoth,
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.stage = 'truck'; this.sus = 0; this.lost = 0; this.maxSus = 0; this.ti = 0;
    cityscape(g, null, {air:{airways:[STRIP]}});
    const h = Math.max(g.world.height(CITY.x, CITY.z, true), 14), B = 96, P0 = [[1, -1], [1, 2], [-2, 2], [-2, 3.6]];
    this.path = P0.map(([i, j]) => new V3(CITY.x + i*B, h + 0.25, CITY.z + j*B));
    this.truck = G.buildCar(0x3a2a1a, true); this.truck.position.copy(this.path[0]); g.scene.add(this.truck); this.tpos = this.path[0].clone(); this.seg = 0;
    // Skull Rock waits out at sea, unseen until the end
    this.rock = G.buildSkullRock(); this.rock.position.set(SKULL.x, 0, SKULL.z); this.rock.rotation.y = Math.PI; g.scene.add(this.rock); rockSolid(g);
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. Dunmore's truck is pulling out of the Aero Works yard. Keep your distance.`, {pos:new V3(CITY.x - 600, 640, CITY.z - 900), heading:0.5, turn:0.003});
  },
  update(g, dt){
    this.pt += dt; const P = g.player; if (this.phase !== 1 || this.ended || !P.alive) { G.HUD.sides(this.sideState(g)); return; }
    g.markers = []; towerCrash(g);
    let T, close, lose;
    if (this.stage === 'truck') {
      // the truck drives the grid at a steady 26 mph
      const a = this.path[this.seg], b = this.path[this.seg + 1];
      if (b) { const d = tB.copy(b).sub(this.tpos), L = d.length(), step = 11.5*dt; if (L <= step) { this.tpos.copy(b); this.seg++; } else this.tpos.addScaledVector(d.normalize(), step); this.truck.position.copy(this.tpos); this.truck.rotation.y = Math.atan2(d.x, d.z); }
      else {
        // at the edge of town his plane is waiting: he climbs in and takes off for the sea
        this.stage = 'plane';
        const L = G.stockLoadout('vandal'); L.paint = [0x26221f, 0x3a3633, 0x8e231c]; L.hp = 0;
        const pos = this.tpos.clone().add(new V3(0, 60, 120));
        const cp = this.courier = g.addPlane({loadout:L, team:1, name:'Percival Dunmore', callsign:'Dunmore', pos, q:new Q().setFromUnitVectors(new V3(0, 0, 1), new V3(SKULL.x - pos.x, 0, SKULL.z - pos.z).normalize()), speed:60, ai:{role:'fighter', skill:0.5}});
        cp.invuln = true; const pl = g.pilots[g.pilots.length - 1];
        pl.route = [{x:CITY.x - 400, z:CITY.z + 1800, y:420, r:200}, {x:SKULL.x + 900, z:SKULL.z - 2200, y:380, r:250}, {x:SKULL.x, z:SKULL.z - 400, y:300, r:300}]; pl.wp = 0; pl.raceThrottle = 0.72;
        G.HUD.radio(G.RADIO.short, 'He\'s ditched the truck and he\'s climbing into a black monoplane! Stay on him, but hang back. He\'ll be checking his tail.');
      }
      T = this.tpos; const hd = Math.hypot(P.pos.x - T.x, P.pos.z - T.z), agl = P.pos.y - T.y;
      close = hd < 220 || (hd < 400 && agl < 120); lose = hd > 900;
      G.HUD.objective(`Follow Dunmore's truck · ${Math.round(hd*1.0936)} yd · stay high and back`);
      g.markers.push({pos:T.clone().add(new V3(0, 8, 0)), label:'DUNMORE\'S TRUCK', col:close ? '#ff6b57' : '#c9d2da', box:true});
    } else {
      const C = this.courier; T = C.pos; const d = P.pos.distanceTo(T), behind = tA.copy(P.pos).sub(T).normalize().dot(C.fwd) < -0.5;
      close = d < (behind ? 260 : 420); lose = d > 1500;
      G.HUD.objective(`Tail Dunmore's plane · ${Math.round(d*1.0936)} yd · ${behind ? 'in his blind spot' : 'he can see you if you get close'}`);
      g.markers.push({pos:T, label:'DUNMORE', col:close ? '#ff6b57' : '#c9d2da'});
      if (Math.hypot(T.x - SKULL.x, T.z - SKULL.z) < 1200 && Math.hypot(P.pos.x - SKULL.x, P.pos.z - SKULL.z) < 3000) {
        this.ended = true; G.HUD.radio(G.RADIO.short, 'Look at that. A rock shaped like a skull, with hangars cut in its teeth. Skull Rock. That\'s the Black Lantern\'s nest.');
        g.markers.push({pos:new V3(SKULL.x, 140, SKULL.z), label:'SKULL ROCK', col:'#ff6b57'});
        g.end(this.result(g, this.maxSus < 50 ? 'perfect' : 'success'));
      }
    }
    this.sus = Math.max(0, Math.min(100, this.sus + (close ? 32 : -8)*dt)); this.maxSus = Math.max(this.maxSus, this.sus);
    this.lost = lose && this.pt > 12 ? this.lost + dt : Math.max(0, this.lost - dt*2);
    if (this.sus > 60 && !this.warned) { this.warned = true; G.HUD.radio(G.RADIO.short, 'Back off! He\'s craning his neck!'); } if (this.sus < 20) this.warned = false;
    if (this.sus >= 100) { this.ended = true; G.HUD.radio(G.RADIO.short, 'He\'s seen you! He\'s... he\'s waving. Then running flat out. We\'ve lost him.'); g.end(this.result(g, 'fail', 'spotted')); }
    if (this.lost > 8) { this.ended = true; G.HUD.radio(G.RADIO.short, 'We\'ve lost him. Not a trace.'); g.end(this.result(g, 'fail', 'lost')); }
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){ return [{text:this.sides[0].text, st:this.sus >= 100 ? 'fail' : this.ended ? 'ok' : 'live', val:`suspicion ${Math.round(this.sus)}%`}, {text:this.sides[1].text, st:this.lost > 8 ? 'fail' : this.ended && this.sus < 100 ? 'ok' : 'live', val:this.stage === 'truck' ? 'truck' : 'plane'}]; },
  onKill(){},
  onInvulnHit(g){ if (!this.ended) { this.ended = true; G.HUD.radio(G.RADIO.short, 'You SHOT at him? We were supposed to follow him! He\'s gone flat out for the clouds.'); g.end(this.result(g, 'fail', 'shot')); } },
  playerDown(g){ if (this.ended) return; this.ended = true; g.end(this.result(g, 'fail', 'down')); },
  result(g, kind){
    const cash = kind === 'fail' ? 500 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0);
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:'He never knew you were there. Dunmore led us straight to Skull Rock, the Black Lantern\'s home port.', then:'Skull Rock: a sea stack off the north coast with hangars in its teeth. Thorne is calling in every favour he has. We hit it at dawn.'},
      success:{mood:'stern', say:'He got twitchy, but he led us home. Skull Rock. Who knew.', then:'Skull Rock: a sea stack off the north coast with hangars in its teeth. Thorne is calling in every favour he has. We hit it at dawn.'},
      fail:{mood:'angry', say:'We lost Dunmore. But Odile heard a Lantern pilot bragging in her café about a rock shaped like a skull, north of the coast. It\'ll have to do.', then:'The Lantern\'s nest is somewhere north of the coast, at a place they call Skull Rock. Thorne is calling in every favour he has.'}
    }[kind]), {skull:1});
  }
});

/* =====================================================================
   Chapter 3, Episode 1: Raid on Skull Rock
   ===================================================================== */
G.MISSIONS.c3m1 = Object.assign(Object.create(base), {
  id:'c3m1', story:true, weather:'mist', weatherScript:[[80, 'clear', 'Sun\'s burning the mist off the rock. They can see us now, and we can see them!']], title:'Raid on Skull Rock', place:'Skull Rock, north of Halcyon Island', wing:3,
  brief:'Dawn raid. Skull Rock is the Black Lantern\'s only fuel depot on this coast: four big tanks on the jetty. Burn them and the Lantern fleet can\'t fly far. Knock out the radio tower on the summit before they can warn the Wraith, and watch the two flak towers on the shoulders of the rock. Their fighters launch from the cave hangar in the skull\'s teeth.',
  sides:[{text:'Wreck the cave hangar doors'}, {text:'Down 5 fighters yourself'}],
  pay:{success:5500, perfect:2500, kill:300},
  worldOpts:flatsBoth,
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.launched = 0; this.hangT = 30;
    const rock = this.rock = G.buildSkullRock(); rock.position.set(SKULL.x, 0, SKULL.z); rock.rotation.y = Math.PI; g.scene.add(rock); rock.updateMatrixWorld(true); rockSolid(g);
    this.T = rock.userData.targets.map(t => g.addTarget({kind:t.kind, label:t.label, pos:rock.localToWorld(t.pos.clone()), r:t.r, hp:t.hp, group:t.group, team:1, cd:2 + Math.random()*2}));
    for (const t of this.T) if (t.kind === 'tank' || t.kind === 'flak') g.world.addBlocker({x:t.pos.x, z:t.pos.z, hw:t.r, hd:t.r, top:t.pos.y + t.r});
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. Skull Rock's off the bow. Tanks first, radio second, and keep your head down.`, {pos:new V3(SKULL.x + 400, 700, SKULL.z - 3000), heading:0, turn:0.002});
  },
  update(g, dt){
    this.pt += dt; const P = g.player;
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); G.HUD.radio('Hellcat', 'Fuel tanks on a jetty. It\'s going to be a beautiful morning.'); }
    if (this.phase === 1 && this.pt > 3 && !this.cap) { this.cap = 1; pirates(g, new V3(SKULL.x, 500, SKULL.z - 800), 4, {gang:'lantern', skill:0.5}); G.HUD.radio(G.RADIO.short, 'Four Lantern fighters up from the rock! Here we go!'); }
    if (this.phase !== 1 || this.ended) { G.HUD.sides(this.sideState(g)); return; }
    // flak towers fire time-fused shells; the cave hangar keeps launching
    for (const t of this.T) if (t.alive && t.kind === 'flak') {
      t.cd -= dt; if (t.cd > 0) continue; t.cd = 1.7 + Math.random()*0.8;
      let best = null, bd = 1600; for (const p of g.planes) if (p.alive && p.team === 0 && !p.invuln && !p.noTarget && !p.docked) { const d = p.pos.distanceTo(t.pos); if (d > 200 && d < bd) { bd = d; best = p; } }
      if (best) { const tt = bd/620, err = bd*0.06; g.flakShell({team:1}, t.pos.clone().add(new V3(0, 6, 0)), best.pos.clone().addScaledVector(best.vel, tt).add(new V3((Math.random() - 0.5)*err, (Math.random() - 0.5)*err, (Math.random() - 0.5)*err)), tt); }
    }
    const hangar = this.T.find(t => t.kind === 'hangar');
    this.hangT -= dt;
    if (hangar.alive && this.hangT <= 0 && this.launched < 6) { this.hangT = 45; this.launched += 2; pirates(g, hangar.pos.clone().add(new V3(0, 60, 120)), 2, {gang:'lantern', skill:0.5}); G.HUD.radio(G.RADIO.short, 'Two more out of the cave hangar!'); }
    const tanks = this.T.filter(t => t.kind === 'tank' && t.alive).length, radio = this.T.find(t => t.kind === 'radio').alive;
    G.HUD.objective(`Fuel tanks left: ${tanks}/4 · radio tower ${radio ? 'up' : 'down'}`);
    if (!tanks && !radio) {
      this.ended = true;
      G.HUD.radio(G.RADIO.short, 'Depot\'s burning and their radio\'s dead! And... I\'m picking up their last message to the Wraith. "Founders\' Day. Noon. The gold." That\'s tomorrow.');
      g.end(Object.assign(this.result(g, this.sideState(g).every(s => s.st === 'ok') ? 'perfect' : 'success'), {delay:6000}));
    }
    G.HUD.sides(this.sideState(g));
  },
  onTargetDown(g, t){
    if (t.kind === 'radio') G.HUD.radio(G.RADIO.short, 'Radio tower down! They can\'t call the Wraith.');
    if (t.kind === 'hangar') G.HUD.radio(G.RADIO.short, 'Cave doors are rubble! Nothing\'s getting out of there now.');
    if (t.kind === 'flak') G.HUD.radio('Dutch', 'Flak tower\'s quiet. Nice.');
  },
  sideState(g){ const h = this.T.find(t => t.kind === 'hangar'); return [{text:this.sides[0].text, st:!h.alive ? 'ok' : this.ended ? 'fail' : 'live', val:''}, {text:this.sides[1].text, st:g.kills >= 5 ? 'ok' : 'live', val:`${g.kills}/5`}]; },
  onKill(){},
  playerDown(g){ if (this.ended) return; this.ended = true; G.HUD.radio(G.RADIO.short, 'We see your chute! Pulling back, pulling back!'); g.end(this.result(g, 'fail')); },
  result(g, kind){
    const cash = kind === 'fail' ? 400 + g.kills*this.pay.kill/2 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill;
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:'Tanks, radio, hangar, the whole rotten rock. The Lantern\'s fleet is grounded except for whatever\'s already in the air. Including the Wraith.', then:'The Lamplighter\'s last order, intercepted: Founders\' Day, noon, the gold. Tomorrow the Sierra Treasury flies its gold reserve over Port Halcyon in the Founders\' Day parade.'},
      success:{mood:'stern', say:'The depot\'s burning. That\'ll keep most of them on the ground. Not the Wraith, though.', then:'The Lamplighter\'s last order, intercepted: Founders\' Day, noon, the gold. Tomorrow the Sierra Treasury flies its gold reserve over Port Halcyon in the Founders\' Day parade.'},
      fail:{mood:'angry', say:'We had to pull back with the tanks still standing. But Sparks caught one signal before we ran: "Founders\' Day. Noon. The gold."', then:'Tomorrow the Sierra Treasury flies its gold reserve over Port Halcyon in the Founders\' Day parade, and the Lantern is coming for it with a full tank of gas.'}
    }[kind]), kind === 'fail' ? {lanternFuelled:1} : {depotBurned:1});
  }
});

/* =====================================================================
   Chapter 3, Episode 2: Founders' Day
   A parade fly-past in formation (no combat)... until the Lantern comes for the gold.
   ===================================================================== */
G.MISSIONS.c3m2 = Object.assign(Object.create(base), {
  id:'c3m2', story:true, title:'Founders\' Day', place:'Over the Founders\' Day parade, Port Halcyon', wing:3,
  brief:'The city wants the Lucky Thirteen to lead the Founders\' Day fly-past: six parade hoops down Grand Avenue, in formation with Dutch, Hellcat and Doc, at a stately 140 to 190 mph. The Sierra Treasury\'s gold blimp is in the parade too. Thorne has a bad feeling about noon. So do I.',
  sides:[{text:'Fly the parade: 6 hoops at parade speed'}, {text:'Keep the gold blimp above 50%'}],
  pay:{success:6000, perfect:2500, kill:300},
  worldOpts:flatsBoth,
  setup(g){
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.stage = 'parade'; this.hoop = 0; this.good = 0; this.wave = 0; this.waveT = 0;
    cityscape(g, (x, z) => Math.abs(x - CITY.x) < 60, {air:{circlers:2, blimp:false}});
    const h = Math.max(g.world.height(CITY.x, CITY.z, true), 14);
    // Grand Avenue runs north-south through the centre: six hoops down it, coloured smoke between
    this.hoops = []; for (let i = 0; i < 6; i++) { const p = new V3(CITY.x, h + 110, CITY.z - 330 + i*130); const m = G.buildBoostRing(10); m.position.copy(p); g.scene.add(m); this.hoops.push({pos:p, n:new V3(0, 0, 1), R:10, prev:undefined, m}); }
    this.gold = g.addShip({team:0, kind:'blimp', name:'Sierra Treasury', paint:{name:'SIERRA TREASURY', hull:0xf2d27a, band:0x2f5d8a}, pos:new V3(CITY.x + 300, h + 260, CITY.z - 200), heading:0, speed:5, turn:0.03, hp:1800, dest:new V3(CITY.x + 300, 0, CITY.z + 600)});
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. The crowd's ten deep on Grand Avenue. Form up and give them a show.`, {pos:new V3(CITY.x - 200, 650, CITY.z - 2200), heading:0, turn:0});
  },
  drop(){ base.drop.call(this); setTimeout(() => { if (this.g.wingmen) this.g.order('form'); }, 2000); },
  through(r, P){ const rel = tA.copy(P.pos).sub(r.pos), along = rel.dot(r.n), lat = rel.addScaledVector(r.n, -along).length(), hit = r.prev !== undefined && r.prev < 0 && along >= 0 && lat < r.R; r.prev = along; return hit; },
  update(g, dt){
    this.pt += dt; const P = g.player, B = this.gold;
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); G.HUD.radio('Hellcat', 'Smile for the newsreels, boys.'); }
    towerCrash(g);
    for (const hp of this.hoops) if (Math.random() < dt*3) { const c = [[0.85, 0.25, 0.2], [0.95, 0.93, 0.88], [0.2, 0.35, 0.75]][this.hoops.indexOf(hp) % 3]; g.fx.smoke.emit(hp.pos.x + (Math.random() - 0.5)*30, hp.pos.y - 40, hp.pos.z, 0, 3, 0, 9, 6, c[0], c[1], c[2], 0.6, 5, 0.2, 0.8); }
    if (this.phase !== 1 || this.ended) { G.HUD.sides(this.sideState(g)); return; }
    g.markers = [];
    if (this.stage === 'parade') {
      const r = this.hoops[this.hoop], mph = P.speed/G.MPH, ok = mph >= 140 && mph <= 190;
      g.markers.push({pos:r.pos, label:`PARADE HOOP ${this.hoop + 1}${ok ? ' · speed ✓' : ` · ${Math.round(mph)} mph (140–190)`}`, col:ok ? '#9ef0a0' : '#f2c14e'});
      G.HUD.objective(`Lead the fly-past: hoop ${this.hoop + 1} of 6 down Grand Avenue at 140–190 mph`);
      if (this.through(r, P)) { this.hoop++; if (ok) this.good++; if (g.audio) g.audio.ding(); G.HUD.toast(ok ? 'Perfect pass! The crowd roars' : 'Too ' + (mph < 140 ? 'slow' : 'fast') + ' for the parade');
        if (this.hoop >= 6) { this.stage = 'attack'; this.waveT = 4; G.HUD.radio(G.RADIO.short, 'Beautiful! The whole town\'s cheering... wait. Bells. Noon bells. And bogeys coming in off the sea!'); if (g.wingmen) g.order('cover'); } }
    }
    if (this.stage === 'attack') {
      this.waveT -= dt;
      const waves = [[4, 2, 'Lantern raiders! They\'re going for the gold blimp!'], [3, 2, 'More of them, from the north! Two on the blimp!'], [4, 3, 'Here\'s the big push. Everything they\'ve got left!']];
      if (this.waveT <= 0 && this.wave < 3 && g.planes.filter(p => p.alive && p.team === 1).length < 3) {
        const [n, st, line] = waves[this.wave]; this.wave++; this.waveT = 12;
        const a = Math.random()*Math.PI*2; pirates(g, new V3(B.pos.x + Math.sin(a)*2000, 650, B.pos.z + Math.cos(a)*2000), n, {gang:'lantern', strafe:st, shipTarget:B, skill:0.5, face:B.pos});
        G.HUD.radio(G.RADIO.short, line);
      }
      G.HUD.objective(`Protect the Sierra Treasury gold blimp · wave ${this.wave} of 3`);
      if (this.wave >= 3 && !g.planes.some(p => p.alive && p.team === 1)) {
        this.ended = true; G.HUD.radio(G.CAPTAIN.short, 'That\'s the last of them. And there, on the horizon... that black shape. The Wraith. She\'s coming herself.');
        g.end(Object.assign(this.result(g, this.sideState(g).every(s => s.st === 'ok') ? 'perfect' : 'success'), {delay:6000}));
      }
      if (B.hp/B.hpMax <= 0.2 && !this.ended) { this.ended = true; G.HUD.radio(G.RADIO.short, 'They\'ve grappled the gold blimp! They\'re hauling it off!'); g.end(this.result(g, 'fail')); }
    }
    G.HUD.sides(this.sideState(g));
  },
  onShipHit(){},
  onShipDown(g, ship){ if (!this.ended) { this.ended = true; g.end(this.result(g, 'fail')); } },
  sideState(g){ const f = this.gold.hp/this.gold.hpMax; return [{text:this.sides[0].text, st:this.hoop >= 6 ? (this.good >= 6 ? 'ok' : 'fail') : 'live', val:`${this.good}/${this.hoop}`}, {text:this.sides[1].text, st:f >= 0.5 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(f*100) + '%'}]; },
  onKill(){},
  playerDown(g){ if (this.ended) return; this.ended = true; G.HUD.radio(G.RADIO.short, 'We see your chute over the rooftops! The gold blimp is on its own...'); g.end(this.result(g, 'fail')); },
  result(g, kind){
    const cash = kind === 'fail' ? 500 + g.kills*this.pay.kill/2 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill;
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:'A perfect fly-past and not a bar of gold lost. The mayor wants to give you a medal. Hold that thought.', then:'The Wraith is coming over the horizon toward Port Halcyon, and the Lamplighter is aboard. This is it.'},
      success:{mood:'stern', say:'The gold\'s safe. The parade was... memorable.', then:'The Wraith is coming over the horizon toward Port Halcyon, and the Lamplighter is aboard. This is it.'},
      fail:{mood:'angry', say:'They hooked the gold blimp and dragged it off toward the Wraith.', then:'The Wraith has the Sierra Treasury\'s gold and is coming for Port Halcyon itself. This is it.'}
    }[kind]), kind === 'fail' ? {goldTaken:1} : {goldSafe:1});
  }
});

/* =====================================================================
   Chapter 3, Episode 3: The Wraith
   The Black Lantern flagship and her escort against the Lucky Margaret, over Port Halcyon at sunset.
   Knock out the Wraith (every engine, four gas cells), and when the Lamplighter launches himself, shoot him down.
   ===================================================================== */
G.MISSIONS.c3m3 = Object.assign(Object.create(base), {
  id:'c3m3', story:true, weather:'overcast', title:'The Wraith', place:'The sky over Port Halcyon, sunset', wing:3,
  brief:'The Wraith is the biggest zeppelin on the coast: half again the Nightjar\'s size, twice her armour, flak batteries everywhere. The escort raider Black Widow flies with her. Aero Works is putting up two militia fighters to fly with Dutch, Hellcat and Doc. The Margaret will slug it out with the Wraith while you take her apart: every engine, then her gas cells. And the Lamplighter flies his own fighter. When he comes out, he\'s yours.',
  sides:[{text:'Sink the escort raider Black Widow'}, {text:'Keep the Margaret above 40%'}],
  pay:{success:12000, perfect:5000, kill:300},
  worldOpts:() => Object.assign(flatsBoth(), {time:'evening'}),
  setup(g){
    const F = (G.save.story && G.save.story.flags) || {};
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.boss = null; this.bossOut = false; this.launched = 0; this.hangT = 35;
    cityscape(g, null, {air:{circlers:2, blimp:false}, cars:30});
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. There she is. The Wraith. Give 'em hell, and come home.`, {pos:new V3(CITY.x - 400, 760, CITY.z - 1500), heading:0, turn:0.02});
    const s = this.ship; s.hp = s.hpMax = 6500;
    const wp = new V3(CITY.x + 300, 820, CITY.z + 1700), widow = new V3(CITY.x + 1100, 760, CITY.z + 1500);
    this.wraith = g.addShip({team:1, kind:'raider', name:'Wraith', label:'WRAITH', paint:{hull:0x1d1b1c, band:0x7a1414, trim:0xb88a2a, scale:1.4, hpMul:F.depotBurned ? 1.25 : 1.45}, pos:wp, heading:Math.PI, speed:6, turn:0.012, noRun:true, noMG:true});
    this.widow = g.addShip({team:1, kind:'raider', name:'Black Widow', label:'BLACK WIDOW', paint:{hull:0x2b2626, band:0x5a1a3a, trim:0x8a8f94}, pos:widow, heading:Math.PI, speed:7, turn:0.015, noRun:true, noMG:true});
    g.targetShip = this.wraith;
    s.foe = this.wraith; this.wraith.foe = s; this.widow.foe = s; s.standoff = 800; this.wraith.standoff = 650; this.widow.standoff = 900; s.turn0 = 0.02;
  },
  update(g, dt){
    this.pt += dt; const P = g.player, W = this.wraith;
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) {
      g.spawnWingmen(this.wing); G.HUD.radio('Dutch', 'This is the big one. Stay sharp, everybody.');
      // two Aero Works militia fighters join the fight under their own steam
      for (let i = 0; i < 2; i++) { const L = G.stockLoadout('gallant'); L.paint = [0xe8dcc0, 0xb5382c, 0x2f5d8a]; const nm = G.name1920s(); g.addPlane({loadout:L, team:0, name:nm.full, callsign:'Militia ' + nm.last, pos:P.pos.clone().add(new V3((i ? -1 : 1)*90, 30, -60)), q:P.q, speed:P.speed, ai:{role:'fighter', skill:0.5}, grace:5}); }
    }
    towerCrash(g);
    if (this.phase !== 1 || this.ended) { G.HUD.sides(this.sideState(g)); return; }
    if (this.pt > 3 && !this.screen) { this.screen = 1; pirates(g, W.worldPoint(new V3(0, 40, 300), new V3()), 4, {gang:'lantern', skill:0.5}); G.HUD.radio(G.RADIO.short, 'Fighter screen coming off the Wraith! Four of them!'); }
    // both raiders launch from their bellies while their hangars stand
    this.hangT -= dt;
    if (this.hangT <= 0 && this.launched < 6) { this.hangT = 50;
      for (const R of [W, this.widow]) if (R.alive && R.alivePart('hangar').length && this.launched < 6) { this.launched += 2; pirates(g, R.worldPoint(new V3(0, -60, -20), new V3()), 2, {gang:'lantern', skill:0.45}); }
    }
    // the Lamplighter comes out once his ship is hurting
    const engLost = W.count('engine') - W.alivePart('engine').length, cellsLost = W.count('cell') - W.alivePart('cell').length;
    if (!this.bossOut && (engLost >= 2 || cellsLost >= 2)) {
      if (g.weather) g.weather.change('storm', 'And here comes the storm that\'s been sitting over the bay all afternoon. Lovely timing.');
      this.bossOut = true; const L = G.stockLoadout('vandal'); L.paint = [0x111111, 0xd9b44a, 0x7a1414]; L.guns = [{cal:'60', ammo:'ex'}, {cal:'50', ammo:'slug'}]; L.arm = [32, 30, 30, 30]; L.rocket = 'flak';
      this.boss = g.addPlane({loadout:L, team:1, name:'Commodore Ezra Kessler', callsign:'The Lamplighter', pos:W.worldPoint(new V3(0, -60, 30), new V3()), q:W.q, speed:80, ai:{role:'fighter', skill:0.85}, internalMul:1.9});
      this.boss.ace = true; const pl = g.pilots[g.pilots.length - 1]; pl.target = P; pl.retT = 8;
      G.HUD.radio('The Lamplighter', `So you're the one who's been lighting fires in my house, ${G.save.callsign || 'flyboy'}. Let's settle it, you and me.`);
      setTimeout(() => G.HUD.radio(G.RADIO.short, 'That black-and-gold fighter out of the Wraith\'s belly, that\'s HIM. That\'s the Lamplighter!'), 3000);
    }
    const bossLeft = this.boss ? this.boss.alive : true;
    G.HUD.objective(W.alive ? `Bring down the Wraith: engines ${W.alivePart('engine').length} left · gas cells holed ${cellsLost}/4${this.bossOut ? (this.boss.alive ? ' · the Lamplighter is airborne!' : ' · the Lamplighter is down') : ''}` : (bossLeft ? 'The Wraith is going down! Now get the Lamplighter!' : ''));
    if (!W.alive && this.boss && !this.boss.alive && !this.ended) {
      this.ended = true;
      G.HUD.radio(G.CAPTAIN.short, 'The Wraith is going into the bay, and the Lamplighter is hanging from a parachute over Grand Avenue. Port Halcyon is ours. You hear that? Ours!');
      g.end(Object.assign(this.result(g, this.sideState(g).every(x => x.st === 'ok') ? 'perfect' : 'success'), {delay:7000}));
    }
    G.HUD.sides(this.sideState(g));
  },
  onPartDown(g, ship, c){
    if (ship !== this.wraith) return;
    if (c.kind === 'engine') G.HUD.radio(G.RADIO.short, ship.alivePart('engine').length ? `Wraith engine down! ${ship.alivePart('engine').length} to go!` : 'Every engine on the Wraith is out! Now her gas cells, hole them!');
    else if (c.kind === 'cell') G.HUD.radio(G.RADIO.short, ship.alivePart('engine').length ? 'Gas cell holed! But she won\'t go down while her engines hold her up!' : 'Another cell! She\'s sinking!');
  },
  onShipDown(g, ship){
    if (ship === this.wraith) { G.HUD.radio(G.RADIO.short, this.boss && this.boss.alive ? 'The Wraith is going down! The Lamplighter\'s still up there, and he\'s furious!' : 'The Wraith is going down in flames!'); if (!this.bossOut) { this.bossOut = true; this.boss = null; } if (!this.boss && !this.ended) { this.ended = true; g.end(Object.assign(this.result(g, this.sideState(g).every(x => x.st === 'ok') ? 'perfect' : 'success'), {delay:7000})); } return; }
    if (ship === this.widow) { G.HUD.radio('Hellcat', 'Black Widow\'s going down! Scratch one spider!'); return; }
    if (ship === this.ship && !this.ended) { this.ended = true; G.HUD.radio(G.CAPTAIN.short, 'She\'s going down! Abandon ship! Abandon...'); g.end(this.result(g, 'fail', 'margaret')); }
  },
  onKill(g, plane){ if (plane === this.boss) G.HUD.radio('The Lamplighter', 'No. NO! ...Very well. You win this one, flyboy.'); },
  onShipRun(){},
  sideState(g){ return [{text:this.sides[0].text, st:!this.widow.alive ? 'ok' : this.ended ? 'fail' : 'live', val:''}, {text:this.sides[1].text, st:this.ship.hp/this.ship.hpMax >= 0.4 ? (this.ended ? 'ok' : 'live') : 'fail', val:Math.round(this.ship.hp/this.ship.hpMax*100) + '%'}]; },
  playerDown(g){ if (this.ended) return; this.ended = true; G.HUD.radio(G.RADIO.short, 'We see your chute! We\'ll... we\'ll hold as long as we can.'); g.end(this.result(g, 'fail', 'down')); },
  result(g, kind, why){
    const cash = kind === 'fail' ? 1000 + g.kills*this.pay.kill/2 : this.pay.success + (kind === 'perfect' ? this.pay.perfect : 0) + g.kills*this.pay.kill;
    return RES(this, g, kind, Object.assign({cash}, {
      perfect:{mood:'pleased', say:'The Wraith in the bay, the Black Widow with her, the Margaret still flying and the Lamplighter in handcuffs. I\'ve run out of words, sugar. Thorne hasn\'t. He\'s been shouting for ten minutes.', then:'Port Halcyon is free of the Black Lantern. Vivian Lacroix\'s new picture is about a daring band of airship privateers. She swears it\'s fiction. The Lucky Thirteen fly on.'},
      success:{mood:'pleased', say:'The Wraith is on the bottom of the bay and the Lamplighter is in a cell. We did it. We actually did it.', then:'Port Halcyon is free of the Black Lantern. Vivian Lacroix\'s new picture is about a daring band of airship privateers. She swears it\'s fiction. The Lucky Thirteen fly on.'},
      fail:{mood:'angry', say:why === 'margaret' ? 'The Margaret is down in the bay. Everyone got out. The Wraith sails on.' : 'You got out under a silk canopy, and the Wraith sails on over Port Halcyon.', then:'Port Halcyon pays the Lamplighter\'s ransom. But the Lucky Thirteen will be back. Retry when you\'re ready.'}
    }[kind]), {finale:kind});
  }
});

G.storyKit = {CITY, STRIP, cityscape, towerCrash, startOnRunway};
/* ---------- Story graph ---------- */
G.CHAPTERS = {c1:'Chapter 1: The Silver Screen Job', c2:'Chapter 2: Wings for Sale', c3:'Chapter 3: The Lamplighter'};
G.CHAPTER = {id:'c1', title:G.CHAPTERS.c1};
G.STORY = {
  c1m1:{n:1, ch:'c1', next:r => r.kind === 'fail' ? 'c1m2b' : 'c1m2a'},
  c1m2a:{n:2, ch:'c1', next:() => 'c1m3'},
  c1m2b:{n:2, ch:'c1', next:() => 'c1m3'},
  c1m3:{n:3, ch:'c1', next:() => 'c2m1'},
  c2m1:{n:1, ch:'c2', next:() => 'c2m2'},
  c2m2:{n:2, ch:'c2', next:() => 'c2m3'},
  c2m3:{n:3, ch:'c2', next:() => 'c2m4'},
  c2m4:{n:4, ch:'c2', next:() => 'c3m1'},
  c3m1:{n:1, ch:'c3', next:() => 'c3m2'},
  c3m2:{n:2, ch:'c3', next:() => 'c3m3'},
  c3m3:{n:3, ch:'c3', next:r => r.kind === 'fail' ? 'c3m3' : 'c3end'}
};
G.chapterOf = node => G.CHAPTERS[(G.STORY[node] || {ch:'c2'}).ch];
G.newStory = () => ({node:'c1m1', flags:{}, log:[]});
G.storyCommit = r => {
  const S = G.save.story || (G.save.story = G.newStory()), node = S.node, M = G.MISSIONS[node];
  S.log.push({node, kind:r.kind, title:M.title, then:r.then});
  Object.assign(S.flags, r.flags || {});
  S.node = G.STORY[node].next(r);
  G.persist();
};
G.storyRecap = () => {
  const S = G.save.story; if (!S || !S.log.length) return 'Port Halcyon, 1937. The Lucky Thirteen take a job that should be simple: babysit a movie star.';
  return 'When last we left our heroes… ' + S.log[S.log.length - 1].then;
};
})();
