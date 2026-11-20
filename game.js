(function(){
'use strict';
/* The game: scene, mouse-aim input, cameras, and the first test mission. */
const G = window.G, V3 = THREE.Vector3, Q = THREE.Quaternion;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3(), qA = new Q();

const STUNT_KEYS = {KeyA:'rollL', KeyD:'rollR', ArrowDown:'immel', ArrowUp:'splits', KeyQ:'snapL', KeyE:'snapR'};
G.RADIO = {name:'Mabel "Sparks" Calloway', short:'Sparks', role:'Radio, Lucky Margaret'};
G.CAPTAIN = {name:'Capt. Augustus Thorne', short:'Thorne'};
/* Wingmen: the Lucky Thirteen's other pilots. Shot down means a chute and a soaked flight suit, never a funeral. */
G.CREW = [
  {id:'dutch', name:'Leroy "Dutch" Kowalski', short:'Dutch', side:1, skill:0.62, paint:[0x6b4a2b, 0xe9dcc0, 0x2f5d8a],
   ack:{attack:'Going hunting.', cover:'Sticking to you like glue.', zep:'Going for her engines and guns.', form:'Forming up on your wing.', rtb:'Heading home. Don\'t do anything stupid without me.'},
   help:['I got one on my tail! Somebody shake him loose!', 'He\'s shooting at me! Little help here!', 'Bandit on my six, I can\'t lose him!'], home:'Dutch aboard. Coffee\'s on.',
   down:"I'm hit! Dutch is hitting the silk!", splash:['Splash one!', 'Got him!', 'Scratch one Lantern.']},
  {id:'hellcat', name:'Mabel "Hellcat" Pruitt', short:'Hellcat', side:-1, skill:0.7, paint:[0x1f4d3a, 0xf0d9a0, 0xb5382c],
   ack:{attack:'About time. Weapons free!', cover:'Fine, I\'ll babysit.', zep:'Let\'s pull that blimp\'s teeth.', form:'On your wing, hotshot.', rtb:'Going home? Fine. Save me one.'},
   help:['Get this creep off me! He\'s chewing my tail!', 'I\'m taking fire! Anybody? Now would be nice!', 'Somebody shoot this bum off my six!'], home:'Hellcat\'s home. Somebody owes me a drink.',
   down:'Damn it, I\'m on fire! Bailing out!', splash:['Ha! Did you see that?', 'Another one for the scrapbook.', 'Next!']},
  {id:'doc', name:'Cornelius "Doc" Abernathy', short:'Doc', side:2, back:52, skill:0.66, paint:[0x5a2a4a, 0xf1e9d6, 0xd9b44a],
   ack:{attack:'Prescribing lead.', cover:'I\'ve got your six, patient.', zep:'Time for some surgery on that gasbag.', form:'Falling in at the back.', rtb:'Discharging myself. Heading home.'},
   help:['Doc\'s being operated on! Get him off me!', 'Taking fire! I need a second opinion back here!', 'One on my tail, and he\'s a good shot. Help!'], home:'Doc\'s aboard. Clinic\'s open if you need patching.',
   down:'Doc\'s hit! Physician, heal thyself... hitting the silk!', splash:['Pronounced dead.', 'Clean incision!', 'That one won\'t need a second opinion.']}
];
G.ORDERS = {Digit1:'attack', Digit2:'cover', Digit3:'zep', Digit4:'form', Digit5:'rtb'};
G.ORDER_NAMES = {attack:'Attack my target', cover:'Cover me', zep:'Hit the zeppelin', form:'Form up', rtb:'Return to base'};

/* Squad balance: the Lucky Thirteen fly as four (you and three wingmen). When the full squad is up, enemy waves
   of two or more get one more fighter and enemy airships are a quarter tougher. Solo episodes are untouched. */
G.squadOf = g => !!(g && g.mission && (g.mission.wing || 0) >= 3);
G.squadN = (g, n) => n + (G.squadOf(g) && n >= 2 ? 1 : 0);
G.toughen = (s, k) => { s.hp *= k; s.hpMax *= k; for (const c of s.comps || []) { c.hp *= k; c.hpMax *= k; } if (s.sections) for (const key in s.sections) { s.sections[key] *= k; } if (s.sectionsMax) { const m = {}; for (const key in s.sectionsMax) m[key] = s.sectionsMax[key]*k; s.sectionsMax = m; } };
G.Game = class {
  constructor(renderer, mission){
    this.r = renderer; this.mission = mission;
    const sc = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, innerWidth/innerHeight, 0.4, 30000); this.camera.rotation.order = 'YXZ';
    this.world = new G.World(sc, mission.worldOpts ? mission.worldOpts() : {seed:1931, flats:[]});
    this.fx = new G.FX(sc); this.tracers = new G.Tracers(sc, 1200);
    this.planes = []; this.pilots = []; this.ships = []; this.audio = G.audio;
    this.initCombat();
    this.t = 0; this.running = false; this.paused = false; this.done = false; this.view = G.save.view || 'chase'; this.lookBack = false;
    this.kills = 0; this.playerShots = 0; this.events = []; if (G.HUD.cover) G.HUD.cover(null);
    this.runways = [];
    this.keys = {}; this.aimYaw = 0; this.aimPitch = -0.12; this.aimDir = new V3();
    this.camPos = new V3(); this.camLook = new V3();
    G.game = this;
    mission.setup(this);
    if (G.setNightWindows) G.setNightWindows(this.world.time);
    if (G.weatherFor) G.weatherFor(this);
    if (G.Net) G.Net.onGame(this);
  }

  /* ---- spawning ---- */
  addPlane(o){ const p = new G.Plane(this, o); this.planes.push(p); if (o.ai) this.pilots.push(new G.Pilot(this, p, o.ai)); return p; }
  addShip(o){ const s = new G.Airship(this, o); this.ships.push(s); if (s.team !== 0 && G.squadOf(this)) G.toughen(s, 1.25); return s; }

  /* ---- input ---- */
  onMouse(dx, dy){
    const s = 0.0021*(G.save.mouseSens || 1);
    this.aimYaw -= dx*s; this.aimPitch = clamp(this.aimPitch - dy*s*(G.save.invert ? -1 : 1), -1.45, 1.45);
  }
  key(code, down){
    this.keys[code] = down;
    if (!down) return;
    const now = performance.now(), last = this.tap || {};
    if (this.running && STUNT_KEYS[code] && last.code === code && now - last.t < 300) { this.stunt(STUNT_KEYS[code]); this.tap = null; }
    else this.tap = {code, t:now};
    if (this.running && (code === 'KeyR' || code === 'KeyZ')) this.stunt(code === 'KeyR' ? 'immel' : 'splits');   // left-hand keys, one press
    if (code === 'KeyC') { this.view = this.view === 'chase' ? 'cockpit' : 'chase'; G.save.view = this.view; G.persist(); }
    if (code === 'KeyX' && this.running && G.launchDrone) G.launchDrone(this);
    if (code === 'KeyT' && this.running) { const P = this.player; if (P && P.torpLeft !== undefined && (G.CHASSIS[P.L.chassis] || {}).torps) this.fireTorpedo(P); else this.toggleHover(); }
    if (code === 'KeyP' && this.running) { this.snapPhoto = true; G.HUD.shutter(); if (this.audio && this.audio.one) try { this.audio.one('hitshort', 0.25, 2.4); } catch (e) {} }   // the camera: missions read snapPhoto this frame
    if (G.ORDERS[code] && this.wingmen && this.wingmen.length) this.order(G.ORDERS[code]);
    if (code === 'KeyY' && this.running && this.swapNear) this.takeParked(this.swapNear);
    if (code === 'KeyB' && this.running && this.player && this.player.alive && !this.player.onGround) this.toggleSight();
    if (code === 'Space' && this.sight) this.dropCrate();
    if (code === 'KeyF' && this.player && this.player.alive) { const P = this.player; P.flaps = !P.flaps; G.HUD.toast(P.flaps ? `Flaps down · ${Math.round(P.flapMax()/G.MPH)} mph max` : 'Flaps up'); }
    if (code === 'KeyG' && this.player && this.player.alive) G.HUD.toast(this.player.toggleGear());
    if (code === 'KeyM' && this.audio) G.HUD.toast(this.audio.toggleMute() ? 'Sound off' : 'Sound on');
    if (code === 'ShiftLeft' || code === 'ShiftRight') { const P = this.player; if (P && !P.engineDead && (P.L.nitro || P.st.rocket) && P.nitroLeft > 0 && !(P.nitro > 0)) { if (P.st.rocket && P.pk()[1] < 0.35) { G.HUD.toast('Tail motor shot up · won\'t light'); return; } P.nitro = P.st.rocket ? 5 : 3; P.nitroLeft--; if (P.st.rocket && this.audio && this.audio.rocket) this.audio.rocket(0.7); } }
  }
  /* Canned stunts on a double-tap, as in Crimson Skies. Each is an exact rotation, so they always finish level. */
  stunt(kind){
    const P = this.player; if (!P || !P.alive || P.man || P.frozen) return;
    const gh = P.pos.y - Math.max(this.world.height(P.pos.x, P.pos.z), 0.4), PI = Math.PI;
    if (kind === 'splits' && gh < 380) { G.HUD.toast('Too low for a Split-S'); return; }
    if (P.speed < P.st.stall*1.25 && kind !== 'rollL' && kind !== 'rollR') { G.HUD.toast('Too slow for that'); return; }
    const S = {
      rollL:{name:'Barrel roll', dodge:true, steps:[{roll:-2*PI, pitch:0.35, t:1.15}]},
      rollR:{name:'Barrel roll', dodge:true, steps:[{roll:2*PI, pitch:0.35, t:1.15}]},
      immel:{name:'Immelmann', steps:[{pitch:PI, t:2.1}, {roll:PI, t:0.6}]},
      splits:{name:'Split-S', steps:[{roll:PI, t:0.6}, {pitch:PI, t:2.0}]},
      snapL:{name:'Snap turn', steps:[{roll:-1.35, t:0.3}, {pitch:PI*0.95, t:1.5, bleed:0.35}, {roll:1.35, t:0.3}]},
      snapR:{name:'Snap turn', steps:[{roll:1.35, t:0.3}, {pitch:PI*0.95, t:1.5, bleed:0.35}, {roll:-1.35, t:0.3}]}
    }[kind];
    P.man = {steps:S.steps, i:0, el:0, dodge:S.dodge, kind:kind.replace(/[LR]$/, '')}; G.HUD.toast(S.name);
  }
  onStuntDone(P, kind){ if (!P.isPlayer) return; const f = P.fwd; this.aimYaw = Math.atan2(f.x, f.z); this.aimPitch = Math.asin(clamp(f.y, -1, 1)); if (this.mission.onStunt) this.mission.onStunt(this, kind); }
  spawnWingmen(n){
    const P = this.player; this.wingmen = []; if (G.dev && G.dev.solo) n = 0;   // dev table: fly alone
    for (const c of G.CREW.slice(0, n)) {
      const L = this.mission.crewLoadout ? this.mission.crewLoadout(c) : G.stockLoadout('gallant'); if (!this.mission.crewLoadout) L.paint = c.paint;
      // abeam of the player, well clear of the Margaret; nudged out of her hull if needed
      const pos = P.pos.clone().addScaledVector(P.fwd, 10 - (c.back ? 40 : 0)).addScaledVector(P.right, c.side*45).add(new V3(0, c.back ? 12 : -10, 0));
      for (const s of this.ships) for (let i = 0; i < 20 && s.inside(pos, 30); i++) pos.addScaledVector(tA.copy(pos).sub(s.pos).setY(0).normalize(), 15).y -= 6;
      const p = this.addPlane({loadout:L, team:0, name:c.name, callsign:c.short, pos, q:P.q, speed:P.speed + 4, ai:{role:'fighter', skill:c.skill}, grace:5});
      const pl = this.pilots[this.pilots.length - 1]; pl.wing = c; pl.order = 'cover'; pl.side = c.side; pl.slotBack = c.back || 28; p.crew = c;
      this.wingmen.push(pl);
    }
    G.HUD.wing(this);
  }
  order(o){
    const back = o !== 'rtb' ? this.wingmen.filter(pl => pl.p.alive && pl.p.docked) : [];
    for (const pl of this.wingmen) { pl.order = o; pl.retT = 0; pl.part = null; if (pl.state !== 'attack') pl.state = 'attack'; }
    for (const pl of back) this.relaunch(pl);
    if (back.length) G.HUD.radio(back[0].wing.short, back.length > 1 ? 'Back off the hook. Here we come!' : 'Back in the air. Miss me?');
    const live = this.wingmen.filter(pl => pl.p.alive && !pl.p.docked);
    if (!live.length && back.length) { G.HUD.toast('Wingmen: ' + G.ORDER_NAMES[o]); G.HUD.wing(this); return; }
    if (live.length) G.HUD.radio(live[0].wing.short, live[0].wing.ack[o]);
    G.HUD.toast('Wingmen: ' + G.ORDER_NAMES[o]); G.HUD.wing(this);
  }
  /* A wingman sent home: tucked away aboard (hidden, frozen, off every target list) until the next order. */
  dockWingman(pl, where){
    const p = pl.p; p.docked = true; p.frozen = true; p.obj.visible = false; p.fire = p.fireRk = false;
    pl.dockAt = where; p.pos.set(9e5 + pl.side*1e4, -5000, 9e5); p.sync();
    G.HUD.radio(pl.wing.short, pl.wing.home); G.HUD.wing(this);
  }
  relaunch(pl){
    const p = pl.p, w = pl.dockAt, s = w && w.ship && w.ship.alive ? w.ship : null;
    if (s) { s.worldPoint(new V3(pl.side*14, -60, -30), p.pos); p.q.setFromAxisAngle(new V3(0, 1, 0), s.heading); }
    else { const P = this.player; p.pos.copy(P.pos).addScaledVector(P.fwd, -260).addScaledVector(P.right, pl.side*60).add(new V3(0, 40, 0)); p.q.copy(P.q); }
    p.pos.y = Math.max(p.pos.y, Math.max(this.world.height(p.pos.x, p.pos.z), 0.4) + 120);
    p.docked = false; p.frozen = false; p.obj.visible = true; p.grace = 5; p.speed = p.top*0.75; p.axes(); p.sync();
  }
  /* ---- changing aircraft ----
     Any mission, or the open world, can leave aeroplanes standing on the ground for the player to take:
       const spot = g.parkPlane({loadout, pos, yaw, label:'the Mastodon', reach:60, onTake(g, now, was){ ... }});
     Roll to a stop on the ground within reach and press Y (pad: Y / triangle) to climb across. The aeroplane you leave stays
     parked where you stopped it, so you can take it back (keepOld:false on the spot leaves it to the ground crew instead).
     spot.taken is set once she's yours. g.swapPlayer(plane, o) is the part that does the work, and a mission can call it
     directly to put the player in any plane at any moment, parked or flying (say, a fresh one from g.addPlane).
     Every swap reaches the mission as mission.onSwap(g, now, was); mission.canSwap(spot) can refuse one with a reason.
     In co-op the host owns the parked planes: a guest asks for one and the host hands it over (net.js); hostOnly:true keeps one for the host. */
  parkPlane(o){
    const p = o.plane || this.addPlane({loadout:o.loadout, team:o.team ?? 0, name:o.name || o.label || 'Parked', callsign:o.callsign || o.name || 'Parked', pos:o.pos.clone(), q:new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), o.yaw || 0), speed:0, throttle:0, internalMul:o.internalMul});
    return this.park(p, o);
  }
  /* settle a plane on its wheels where it stands, engines off, nobody aboard */
  park(p, o = {}){
    const yaw = o.yaw ?? Math.atan2(p.fwd.x, p.fwd.z), gh = Math.max(this.world.height(p.pos.x, p.pos.z), 0.4);
    p.onGround = true; p.parked = true; p.isPlayer = false; p.pos.y = (o.y ?? gh) + (p.ud.gear || 1.8); p.groundYaw = yaw;
    p.q.setFromAxisAngle(new V3(0, 1, 0), yaw); p.axes(); p.speed = 0; p.vel.set(0, 0, 0); p.throttle = 0; p.fire = p.fireRk = false; p.brake = true; p.man = null;
    p.noTarget = !o.target; p.hover = false;
    this.pilots = this.pilots.filter(pl => pl.p !== p);
    const spot = {plane:p, label:o.label || `the ${(G.CHASSIS[p.L.chassis] || {name:'aeroplane'}).name}`, reach:o.reach || Math.max(45, (p.ud.radius || 8)*3.5), keepOld:o.keepOld !== false, onTake:o.onTake, hostOnly:!!o.hostOnly, mine:!!o.mine, taken:false};
    if (this.netHost && G.Net && G.Net.parkedChanged) G.Net.parkedChanged(this, p, spot);
    (this.parkedSpots || (this.parkedSpots = [])).push(spot); return spot;
  }
  /* which parked plane is close enough to climb into: on the ground, all but stopped, inside its reach */
  swapTick(dt){
    const P = this.player; let near = null;
    this.parkedSpots = this.parkedSpots.filter(s => s.plane.alive && s.plane.parked);
    if (P && P.alive && P.onGround && P.speed < 4 && !this.done) for (const s of this.parkedSpots) if (s.plane !== P && P.pos.distanceTo(s.plane.pos) < s.reach) { near = s; break; }
    if (near !== this.swapNear) { this.swapNear = near; this.swapNag = 0; }
    if (near && (this.swapNag -= dt) <= 0) { this.swapNag = 4; G.HUD.toast(this.netGuest && near.hostOnly ? `${near.label} is for the lead pilot` : `Y${G.pad && G.pad.active ? ' (pad: fire)' : ''} · climb into ${near.label}`); }
  }
  takeParked(spot){
    const why = this.mission.canSwap && this.mission.canSwap(spot); if (why) { G.HUD.toast(why); return; }
    if (this.netGuest) { if (!spot.hostOnly && G.Net && G.Net.askTake) G.Net.askTake(this, spot); return; }   // the host owns it: ask
    const was = this.player, now = spot.plane; if (!now.alive || was === now) return;
    spot.taken = true; this.parkedSpots = this.parkedSpots.filter(s => s !== spot); this.swapNear = null;
    this.swapPlayer(now, {keepOld:spot.keepOld});
    if (this.netHost && G.Net && G.Net.hostSwapped) G.Net.hostSwapped(this, now, was);
    if (spot.onTake) spot.onTake(this, now, was);
  }
  swapPlayer(now, o = {}){
    const was = this.player; if (!now || now === was) return;
    if (was) {
      was.isPlayer = false; was.fire = was.fireRk = false; was.throttle = 0;
      if (o.keepOld !== false && was.alive && was.onGround) this.park(was, {label:o.oldLabel || `your ${(G.CHASSIS[was.L.chassis] || {name:'aeroplane'}).name}`, mine:true});
      else { was.alive = false; if (was.obj.parent) was.obj.parent.remove(was.obj); this.planes = this.planes.filter(x => x !== was); }
    }
    now.parked = false; now.noTarget = false; now.isPlayer = true; now.team = 0; now.invuln = false; now.frozen = false; now.grace = Math.max(now.grace || 0, 1.5);
    if (was) { now.name = was.name; now.callsign = was.callsign; }
    if (G.TUNE && !now.tunedParts && now.parts) { const k = G.TUNE.parts/0.5; now.partsMax = now.partsMax.map(x => x*k); now.parts = now.parts.map(x => x*k); now.tunedParts = true; }   // the player's parts are a little tougher than a bandit's
    if (now.torpLeft === undefined) now.torpLeft = Math.min(now.L.torps || 0, (G.CHASSIS[now.L.chassis] || {}).torps || 0);
    if (now.nitroLeft === undefined) now.nitroLeft = (G.CHASSIS[now.L.chassis] || {}).rocketBoost ? 6 : now.L.nitro ? 3 : 0;
    this.pilots = this.pilots.filter(pl => pl.p !== now);
    this.player = now;
    this.aimYaw = Math.atan2(now.fwd.x, now.fwd.z); this.aimPitch = now.onGround ? -0.03 : Math.asin(clamp(now.fwd.y, -1, 1));
    this.camPos.set(0, 0, 0);   // cut the camera across rather than swinging it
    G.HUD.toast(o.say || `You're flying ${(G.CHASSIS[now.L.chassis] || {name:'her'}).name === 'her' ? 'her' : 'the ' + G.CHASSIS[now.L.chassis].name}`);
    if (this.mission.onSwap) this.mission.onSwap(this, now, was);
    return now;
  }
  /* ---- the bombsight: a window in the floor, a co-pilot on the stick, and crates to drop ----
     Any plane whose chassis has bombsight:true and carries crates (P.packages > 0). B in the air opens and closes it.
     The co-pilot holds height and speed; A/D talk him a few degrees left or right. The sight's computer knows the height,
     the speed and the drag on a crate falling under its streamer; the wind it has to be told. Q/E swing the wind arrow,
     W/S set its strength: read them off the smoke drifting from the drop zone. Space (or the trigger) lets a crate go.
     Missions add drop zones with g.addDropZone({pos, label, onLand(g, crate, dist, zone)}) and set g.wind (V3, m/s);
     gusts wander round it, so a perfect setting still isn't a sure thing. */
  canSight(P = this.player){ return !!(P && P.alive && !P.onGround && (G.CHASSIS[P.L.chassis] || {}).bombsight && P.packages > 0); }
  toggleSight(off){
    const P = this.player;
    if (this.sight || off) { if (!this.sight) return; this.sight = null; if (P) { this.aimYaw = Math.atan2(P.fwd.x, P.fwd.z); this.aimPitch = Math.asin(clamp(P.fwd.y, -1, 1)); } G.HUD.toast('Back on the stick'); return; }
    if (!this.canSight(P)) { if (P && (G.CHASSIS[P.L.chassis] || {}).bombsight) G.HUD.toast(P.packages > 0 ? 'Get her in the air first' : 'No crates left aboard'); return; }
    this.sight = {hdg:Math.atan2(P.fwd.x, P.fwd.z), alt:P.pos.y, wDir:this.sightWind ? this.sightWind.dir : 0, wSpd:this.sightWind ? this.sightWind.spd : 0, fov:40, thr:P.throttle};
    G.HUD.toast('Bombsight · the co-pilot has her');
  }
  sightControl(dt){
    const P = this.player, S = this.sight, k = this.keys, pad = G.pad && G.pad.active ? G.pad : null;
    const steer = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + (pad ? pad.lx || 0 : 0);
    S.hdg -= steer*0.06*dt;
    S.wDir += ((k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0) + (pad ? pad.rx || 0 : 0))*1.1*dt;
    S.wSpd = clamp(S.wSpd + ((k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) - (pad ? pad.ry || 0 : 0))*3*dt, 0, 25);
    this.sightWind = {dir:S.wDir, spd:S.wSpd};
    // the co-pilot: level at the height you opened the sight, on the heading you're asking for
    const pitch = clamp((S.alt - P.pos.y)*0.004, -0.12, 0.12), cp = Math.cos(pitch);
    this.aimYaw = S.hdg; this.aimPitch = pitch; this.aimDir.set(Math.sin(S.hdg)*cp, Math.sin(pitch), Math.cos(S.hdg)*cp);
    P.steer(this.aimDir); P.throttle += (S.thr - P.throttle)*Math.min(1, dt); P.fire = false; P.fireRk = false;
    if (pad && pad.hold && pad.hold.fire && !this.padFire) this.dropCrate(); this.padFire = !!(pad && pad.hold && pad.hold.fire);
  }
  windAt(t){   // the wind with its gusts: strength and direction wander slowly round the mission's setting
    const W = this.wind; if (!W) return tD.set(0, 0, 0);
    const k = 1 + 0.22*Math.sin(t*0.13 + 1.7) + 0.09*Math.sin(t*0.71), a = 0.14*Math.sin(t*0.09 + 0.4);
    const c = Math.cos(a), s = Math.sin(a); return tD.set((W.x*c - W.z*s)*k, 0, (W.x*s + W.z*c)*k);
  }
  crateStep(c, wind, dt){   // gravity, and drag on the streamer against the moving air
    const rx = c.vel.x - wind.x, ry = c.vel.y, rz = c.vel.z - wind.z, sp = Math.hypot(rx, ry, rz), K = 0.012;
    c.vel.x -= K*sp*rx*dt; c.vel.y -= (9.81 + K*sp*ry)*dt; c.vel.z -= K*sp*rz*dt; c.pos.addScaledVector(c.vel, dt);
  }
  /* where a crate let go now would land, on the wind the bombardier has dialled in */
  predictCrate(out){
    const P = this.player, S = this.sight; if (!P || !S) return null;
    const w = new V3(Math.sin(S.wDir)*S.wSpd, 0, Math.cos(S.wDir)*S.wSpd), c = {pos:tA.copy(P.pos).add(tB.set(0, -2.5, 0)).clone(), vel:P.vel.clone()};
    let t = 0; for (; t < 80; t += 0.05) { this.crateStep(c, w, 0.05); if (c.pos.y <= Math.max(this.world.height(c.pos.x, c.pos.z), 0.4)) break; }
    S.fall = t; return (out || new V3()).copy(c.pos);
  }
  dropCrate(){
    const P = this.player; if (!this.sight || !P || !(P.packages > 0)) return;
    if ((this.crateCd || 0) > this.t) return; this.crateCd = this.t + 0.8;
    P.packages--; const m = G.buildSupplyCrate();   // models.js: userData.streamer is the drogue rig, trailing along the crate's +Y
    const c = {pos:P.pos.clone().add(new V3(0, -2.5, 0)), vel:P.vel.clone(), m, t:0, landed:false}; m.position.copy(c.pos); this.scene.add(m);
    (this.crates || (this.crates = [])).push(c);
    if (this.audio && this.audio.gear) this.audio.gear();
    G.HUD.toast(`Crate away! ${P.packages} left`);
    if (!P.packages) setTimeout(() => { if (this.sight) this.toggleSight(true); }, 2500);
  }
  addDropZone(o){
    const z = Object.assign({label:'DROP ZONE', bull:23, good:60, smoke:true}, o);
    z.pos.y = Math.max(this.world.height(z.pos.x, z.pos.z), 0.4);
    const grp = G.buildDropZone({bull:z.bull, good:z.good, ground:(x, y) => Math.max(this.world.height(z.pos.x + x, z.pos.z + y), 0.4) - z.pos.y});   // models.js: the cross, the rings, the smoke pot and a windsock
    grp.position.copy(z.pos); this.scene.add(grp); z.obj = grp;
    (this.dropZones || (this.dropZones = [])).push(z); return z;
  }
  cratesTick(dt){
    const w = this.windAt(this.t);
    for (const z of this.dropZones || []) {
      const ud = z.obj.userData, s = ud.smokeAt, ws = ud.windsock, wsp = Math.hypot(w.x, w.z);
      if (ws) { if (wsp > 0.05) ws.rotation.y = Math.atan2(w.x, w.z); if (ws.userData.sock) ws.userData.sock.rotation.x = clamp(1.25 - wsp*0.13, 0.06, 1.25); }   // the windsock: streams downwind, hangs when it drops
      if (z.smoke && !z.done && Math.random() < 0.7) this.fx.smoke.emit(z.pos.x + s.x, z.pos.y + s.y, z.pos.z + s.z, w.x*0.9, 2.2, w.z*0.9, 3.2, 7, 0.85, 0.2, 0.15, 0.55, 5, 0, 0);   // the smoke pot: red, and it leans with the wind
    }
    for (const c of this.crates || []) {
      if (c.landed) continue;
      c.t += dt; this.crateStep(c, w, dt); c.m.position.copy(c.pos);
      const sp = c.vel.clone(); sp.y = Math.min(sp.y, -0.01); c.m.lookAt(tA.copy(c.pos).sub(sp)); c.m.rotateX(-Math.PI/2);
      if (c.m.userData.spin) c.m.userData.spin.rotation.y += dt*3;   // the drogue turns as she falls
      const gh = Math.max(this.world.height(c.pos.x, c.pos.z), 0.4);
      if (c.pos.y > gh) continue;
      c.landed = true; c.pos.y = gh + 0.45; c.m.position.copy(c.pos); c.m.rotation.set(0, Math.random()*6, 0); if (c.m.userData.streamer) c.m.userData.streamer.visible = false;
      this.fx.smoke.emit(c.pos.x, c.pos.y + 1, c.pos.z, 0, 2, 0, 5, 1.6, 0.75, 0.68, 0.55, 0.6, 4, 0, 0);
      let best = null, bd = 1e9; for (const z of this.dropZones || []) { const d = Math.hypot(c.pos.x - z.pos.x, c.pos.z - z.pos.z); if (d < bd) { bd = d; best = z; } }
      const yd = Math.round(bd*1.0936), wet = this.world.height(c.pos.x, c.pos.z) < 0.4;
      G.HUD.toast(wet ? `In the drink, ${yd} yd off` : best && bd <= best.bull ? `On the cross! ${yd} yd` : best && bd <= best.good ? `Delivered, ${yd} yd off` : `Missed by ${yd} yd`);
      if (best && best.onLand) best.onLand(this, c, bd, best);
    }
  }
  /* runway rectangles: {pos, yaw, hw, hl} */
  runwayAt(p){
    for (const r of this.runways) {
      const dx = p.x - r.pos.x, dz = p.z - r.pos.z, c = Math.cos(r.yaw), s = Math.sin(r.yaw);
      const lx = dx*c - dz*s, lz = dx*s + dz*c;
      if (Math.abs(lx) < r.hw && Math.abs(lz) < r.hl) return r;
    }
    return null;
  }
  onTouchdown(P, hard){ if (!P.isPlayer) return; this.aimPitch = -0.03; G.HUD.toast(hard ? 'Hard landing!' : 'Touchdown!'); if (this.mission.onTouchdown) this.mission.onTouchdown(this, hard); }
  onLiftoff(P){ if (!P.isPlayer) return; this.aimPitch = 0.12; if (this.mission.onLiftoff) this.mission.onLiftoff(this); }
  /* T on a bomber: drop an air torpedo */
  fireTorpedo(P){
    if (!P.alive || P.onGround || P.frozen) return;
    if (!(P.torpLeft > 0)) { G.HUD.toast('Torpedo rack empty'); return; }
    if ((this.torpCd || 0) > this.t) return; this.torpCd = this.t + 1.2;
    P.torpLeft--; this.spawnAirTorpedo(P); G.HUD.toast(`Torpedo away! ${P.torpLeft} left`);
  }
  /* T: the Whirligig's hover. From the ground she lifts straight up; in the air she comes to a hover; T again tips her into flight */
  toggleHover(){
    const P = this.player; if (!P || !P.alive || P.L.chassis !== 'whirligig') { if (P && P.alive) G.HUD.toast('Only the Whirligig can hover'); return; }
    if (P.engineDead && !P.hover) return;
    if (!P.hover) {
      if (P.onGround) { P.onGround = false; P.pos.y += 1.6; P.vel.set(0, 2, 0); if (this.onLiftoff) this.onLiftoff(P); }
      P.hover = true; P.hvel = P.vel.clone(); P.flaps = false; G.HUD.toast('Hover · mouse: nose and heading · W/S climb · A/D slide · T to fly');
    } else {
      P.hover = false; const f = P.fwd, h = Math.hypot(f.x, f.z) || 1; P.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(f.x, f.z)); P.axes();
      P.speed = Math.max(P.speed, P.stallSpeed()*1.12); P.throttle = 1; G.HUD.toast('Flying');
    }
  }
  playerControl(dt){
    const P = this.player, k = this.keys; if (!P || !P.alive) return;
    if (this.sight) { this.sightControl(dt); return; }
    if (P.hover && !P.onGround) {
      const cp = Math.cos(this.aimPitch); this.aimDir.set(Math.sin(this.aimYaw)*cp, Math.sin(this.aimPitch), Math.cos(this.aimYaw)*cp);
      const turn = (k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0); if (turn) this.aimYaw -= turn*1.3*dt;
      P.hoverIn = {yaw:this.aimYaw, pitch:this.aimPitch, climb:(k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), side:(k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0)};
      P.fire = !!(k.Mouse0); P.fireRk = !!(k.Mouse2 || k.Space); return;
    }
    if (P.onGround) {
      if (k.KeyW && !P.engineDead) P.throttle = Math.min(1, P.throttle + dt*0.6);
      if (k.KeyS) P.throttle = Math.max(0, P.throttle - dt*0.9);
      const cp = Math.cos(this.aimPitch); this.aimDir.set(Math.sin(this.aimYaw)*cp, Math.sin(this.aimPitch), Math.cos(this.aimYaw)*cp);
      P.groundYaw = this.aimYaw; P.brake = !!(k.KeyS && P.throttle <= 0.01) || !!k.KeyB; P.wantLift = this.aimPitch > 0.06 || !!k.ArrowDown;
      if (this.mission.holdOnGround) { P.throttle = 0; P.brake = true; }
      P.fire = P.fireRk = false; return;
    }
    if (k.KeyW && !P.engineDead) P.throttle = Math.min(1, P.throttle + dt*0.6);
    if (k.KeyS) P.throttle = Math.max(0, P.throttle - dt*0.6);
    const cp = Math.cos(this.aimPitch); this.aimDir.set(Math.sin(this.aimYaw)*cp, Math.sin(this.aimPitch), Math.cos(this.aimYaw)*cp);
    if (P.man) { const f = P.fwd; this.aimYaw = Math.atan2(f.x, f.z); this.aimPitch = Math.asin(clamp(f.y, -1, 1)); }
    P.steer(this.aimDir);
    const roll = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), yaw = (k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0), pitch = (k.ArrowUp ? -1 : 0) + (k.ArrowDown ? 1 : 0);
    if (roll) P.ctrl.roll = roll;
    if (yaw) P.ctrl.yaw = yaw;
    if (pitch) P.ctrl.pitch = pitch*(G.save.invert ? -1 : 1);
    // keyboard flying drags the aim point along with the nose, so letting go doesn't snap the plane back
    if (roll || pitch) { const f = P.fwd; this.aimYaw = Math.atan2(f.x, f.z); this.aimPitch = Math.asin(clamp(f.y, -1, 1)); }
    P.fire = !!(k.Mouse0); P.fireRk = !!(k.Mouse2 || k.Space);
  }

  /* ---- loop ---- */
  update(dt){
    if (this.paused) return;
    dt = Math.min(dt, 0.05); this.t += dt;
    if (this.running) this.playerControl(dt);
    if (this.parkedSpots) this.swapTick(dt);
    if (this.crates || this.dropZones) this.cratesTick(dt);
    if (G.dev && G.dev.ammo && this.player && this.player.alive) { const P = this.player; for (const gn of P.guns) gn.rounds = gn.def.ammo; P.rockets = P.L.hp*3; if (P.L.nitro || P.st.rocket) P.nitroLeft = P.st.rocket ? 6 : 3; }
    else if (this.done && this.player && this.player.alive && !this.player.frozen) {
      const P = this.player, gh = P.pos.y - Math.max(this.world.height(P.pos.x, P.pos.z), 0.4);
      P.steer(tC.copy(P.fwd).setY(0).normalize().setY(gh < 300 ? 0.35 : 0.02).normalize()); P.fire = P.fireRk = false; P.throttle = 0.8;
    }
    for (const pl of this.pilots) pl.update(dt);
    for (const p of this.planes) p.update(dt);
    for (const s of this.ships) s.update(dt);
    if (this.traffic) this.traffic.update(dt);
    this.updateProjectiles(dt); this.updateTorpedoes(dt); this.updateFlak(dt); this.updateRearm(dt); this.updateChutes(dt);
    this.mission.update(this, dt);
    if (this.netHost) G.Net.hostFrame(this, dt); else if (this.netGuest) G.Net.guestFrame(this, dt);
    this.snapPhoto = false;
    this.fx.update(dt);
    this.updateCamera(dt);
    this.world.follow(this.player ? this.player.pos : this.camera.position);
    if (this.audio) this.audio.frame(this);
    G.HUD.update(this, dt);
  }
  updateCamera(dt){
    const P = this.player, cam = this.camera; if (!P) return;
    if (this.sight && (!P.alive || P.onGround)) this.toggleSight(true);
    if (this.sight) {   // the bombsight: straight down through the floor window, nose at the top of the picture
      const f = tB.set(P.fwd.x, 0, P.fwd.z).normalize(); cam.position.copy(P.pos).addScaledVector(f, 3).add(tC.set(0, -2.6, 0));
      cam.up.copy(f); cam.lookAt(tA.copy(cam.position).add(tC.set(0, -100, 0))); cam.up.set(0, 1, 0);
      cam.fov += (this.sight.fov - cam.fov)*Math.min(1, dt*6); cam.updateProjectionMatrix(); this.camPos.set(0, 0, 0); return;
    }
    const head = P.obj.getObjectByName('pilot');
    if (this.cine) { this.cine(dt, cam); if (head) head.visible = true; return; }
    const cockpit = this.view === 'cockpit' && P.alive && !this.lookBack;
    if (head) head.visible = !cockpit;
    if (cockpit) {
      tA.copy(P.ud.cockpit).applyQuaternion(P.q).add(P.pos); cam.position.copy(tA);
      qA.setFromAxisAngle(tB.set(0, 1, 0), Math.PI); cam.quaternion.copy(P.q).multiply(qA);
      cam.fov += (72 - cam.fov)*Math.min(1, dt*4); cam.updateProjectionMatrix(); return;
    }
    const dir = P.alive ? this.aimDir : tC.copy(P.vel).normalize();
    const dist = 15 + P.speed*0.025;
    if (this.lookBack) tA.copy(P.pos).addScaledVector(P.fwd, dist*1.1).add(tB.set(0, 3, 0));
    else tA.copy(P.pos).addScaledVector(dir, -dist).add(tB.set(0, 4.2, 0));
    const k = 1 - Math.exp(-dt*(P.alive ? 6 : 2));
    tA.y = Math.max(tA.y, Math.max(this.world.height(tA.x, tA.z, true), 0.4) + 3);
    if (this.camPos.lengthSq() === 0) this.camPos.copy(tA);
    this.camPos.lerp(tA, k);
    const gh = Math.max(this.world.height(this.camPos.x, this.camPos.z, true), 0.4) + 1.5; if (this.camPos.y < gh) this.camPos.y += (gh - this.camPos.y)*Math.min(1, dt*12);
    cam.position.copy(this.camPos);
    tB.copy(P.pos); if (!this.lookBack) tB.addScaledVector(dir, 90);
    if (this.camLook.lengthSq() === 0) this.camLook.copy(tB);
    this.camLook.lerp(tB, 1 - Math.exp(-dt*12)); cam.lookAt(this.camLook);
    const fov = 66 + clamp((P.speed - P.top*0.8)/P.top, 0, 0.5)*14; cam.fov += (fov - cam.fov)*Math.min(1, dt*3); cam.updateProjectionMatrix();
  }
  render(){ this.r.render(this.scene, this.camera); }

  /* ---- events from combat ---- */
  onHit(target, src, dmg){
    if (!this.audio) return;
    if (target.isPlayer) this.audio.hitMe(dmg > 20);
    else if (src && src.isPlayer) { this.audio.hitThem(); G.HUD.hitMark(); }
  }
  onKill(plane, src, how){
    if (this.audio) this.audio.boom(plane.pos, true);
    if (how !== 'crash' || Math.random() < 0.6) this.spawnChute(tA.copy(plane.pos).add(tB.set(0, 6, 0)), plane.vel);
    if (plane.isPlayer) { this.mission.playerDown(this); return; }
    if (plane.crew) { G.HUD.radio(plane.crew.short, plane.crew.down); G.HUD.feed(`${plane.crew.short} ${how === 'crash' ? 'crashed' : 'was shot down' + (src && src.name ? ' by ' + (src.callsign || src.name) : '')}`); G.HUD.wing(this); }
    if (src && src.crew && plane.team !== 0 && Math.random() < 0.6) G.HUD.radio(src.crew.short, G.pick(src.crew.splash));
    if (plane.team !== 0) {
      const mine = src && src.isPlayer;
      if (mine) this.kills++;
      G.HUD.feed(`${mine ? 'You' : src && src.callsign ? src.callsign : (how === 'crash' ? 'The ground' : 'The Margaret')} downed ${plane.callsign}`, mine);
    }
    this.mission.onKill(this, plane, src);
  }
  onPartHit(ship, c, src){ if (src && src.isPlayer) { G.HUD.hitMark(); if (this.audio) this.audio.hitThem(); } }
  onPartNote(ship, text){ if (ship.team !== 0) G.HUD.toast(text); }
  onPartDown(ship, c, src){
    if (ship.team !== 0) G.HUD.feed(`${src && src.isPlayer ? 'You' : 'Someone'} knocked out the ${ship.name}'s ${c.label.toLowerCase()}`, src && src.isPlayer);
    if (this.mission.onPartDown) this.mission.onPartDown(this, ship, c, src);
  }
  onInvulnHit(p, src){ if (src && src.isPlayer && this.mission.onInvulnHit) this.mission.onInvulnHit(this, p); }
  onShipStopped(ship){ if (this.mission.onShipStopped && this.mission.onShipStopped(this, ship)) return; if (ship.team !== 0) G.HUD.radio(G.CAPTAIN.short, 'Her last engine\'s gone. She\'s not running anywhere now. Hole those gas cells!'); }
  onShipRun(ship){ if (this.mission.onShipRun) this.mission.onShipRun(this, ship); }
  onShipSurrender(ship, src){ if (this.mission.onShipSurrender) this.mission.onShipSurrender(this, ship, src); }
  onShipCaptured(ship, src){ if (this.mission.onShipCaptured) this.mission.onShipCaptured(this, ship, src); }
  onShipHit(ship, src){ if (ship.team === 0 && this.mission.onShipHit) this.mission.onShipHit(this, ship, src); }
  onShipDown(ship){ if (this.audio) this.audio.boom(ship.pos, true); this.mission.onShipDown(this, ship); }

  end(result){
    if (this.done) return; this.done = true; this.running = false;
    setTimeout(() => { if (this.audio) this.audio.stopAll(); G.UI.debrief(this, result); }, result.delay ?? 3500);
  }
  dispose(){
    if (this.audio) this.audio.stopAll();
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
};
Object.assign(G.Game.prototype, G.Combat);

/* =====================================================================
   Test mission: "Black Lantern Ambush"
   Three waves over Halcyon Island. Branches PERFECT / SUCCESS / FAILURE, Kestrel Squadron style.
   ===================================================================== */
G.MISSIONS = {};
G.MISSIONS.ambush = {
  id:'ambush', title:'Black Lantern Ambush', place:'Over Halcyon Island, Sierra Free State',
  brief:'The Lucky Margaret is running medicine to Port Halcyon, and the Black Lantern Syndicate wants the cargo. Drop off the trapeze, keep the raiders off the Margaret, and send their ace home in a barrel.',
  sides:[{id:'ship', text:'Keep the Margaret above 75%'}, {id:'kills', text:'Down 6 raiders yourself'}],
  pay:{success:2500, perfect:1500, kill:300},
  setup(g){
    this.g = g; this.warned = false; this.phase = 0; this.pt = 0; this.wave = 0; this.waveLeft = 0; this.ace = null;
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. Black Lantern raiders on the scope. Drop when ready.`);
  },
  /* shared opening: the Margaret, the player on her trapeze, the hanging camera */
  launch(g, line, o = {}){
    const ship = this.ship = g.addShip({team:0, name:o.shipName || 'Lucky Margaret', paint:o.shipPaint, pos:o.pos || new V3(0, 720, -600), heading:o.heading ?? 0.2, speed:9, turn:o.turn ?? 0.004,
      hp:4000, flak:true, guns:[new V3(7, -24, 26), new V3(-7, -24, -8), new V3(0, 23, -20)]});
    const L = Object.assign({}, o.load || G.save.load, {mods:(G.save.mods || []).slice()});
    const P = g.player = g.addPlane({loadout:L, team:0, player:true, name:G.save.callsign || 'Ace', callsign:G.save.callsign || 'Ace', speed:0, throttle:0.9});
    P.nitroLeft = G.CHASSIS[L.chassis] && G.CHASSIS[L.chassis].rocketBoost ? 6 : L.nitro ? 3 : 0; P.torpLeft = Math.min(L.torps || 0, (G.CHASSIS[L.chassis] || {}).torps || 0); P.frozen = true;
    this.trap = ship.obj.userData.trapeze;
    this.hang();
    g.running = false;
    // launch cinematic: hang on the trapeze, then drop
    let ct = 0;
    g.cine = (dt, cam) => {
      ct += dt; this.hang();
      const side = tA.set(-38, -22, 10); ship.worldPoint(side, tB); cam.position.lerp(tB, ct < 0.1 ? 1 : 0.04);
      cam.lookAt(tC.copy(P.pos).add(tA.set(0, 2, 0)));
    };
    G.HUD.radio(G.RADIO.short, line);
    G.HUD.banner(o.banner || this.title, 'Click to drop from the trapeze');
    setTimeout(() => G.HUD.radio(G.RADIO.short, 'Need ammo or patches? Throttle back under 105, line up with us, and fly through a docking ring on either side. The hook will catch you.'), 9000);
    this.awaitDrop = true;
  },
  canRedock(){ return !this.story; },
  hang(){
    const P = this.g.player, s = this.ship;
    tA.set(0, -34.5 - 9 - 1.6, -22); s.worldPoint(tA, P.pos);
    P.q.copy(s.q); P.speed = s.speed; P.vel.copy(s.vel); P.sync();
  },
  drop(){
    const g = this.g, P = g.player; if (!this.awaitDrop) return; this.awaitDrop = false;
    g.cine = null; g.running = true; P.frozen = false; P.speed = 62; P.throttle = 0.9;
    P.q.multiply(qA.setFromAxisAngle(tA.set(1, 0, 0), 0.28));
    const f = tA.set(0, 0, 1).applyQuaternion(P.q); g.aimYaw = Math.atan2(f.x, f.z); g.aimPitch = -0.12;
    G.HUD.banner(null); this.phase = 1; this.pt = 0;
    if (this.wing) this.spawnWingmenSoon = 1.2;
    if (!this.open && !this.noMusic) G.music.mission(g.world.time);
  },
  spawnWave(n, opts){
    const g = this.g, s = this.ship, a0 = s.heading + Math.PI*(0.6 + Math.random()*0.8); n = G.squadN(g, n);
    const made = [], used = {};
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1)/2)*0.12, d = 2300 + i*60;
      const pos = new V3(s.pos.x + Math.sin(a)*d, 650 + Math.random()*250, s.pos.z + Math.cos(a)*d);
      const q = new Q().setFromUnitVectors(new V3(0, 0, 1), tA.copy(s.pos).sub(pos).setY(0).normalize());
      const ace = opts.ace && i === 0, L = this.wave > 1 && !ace ? G.gangLoadout('lantern', i, n, used, [0x7a1f1f, 0x1b1b1b, 0xd9b44a]) : G.stockLoadout('vandal');   // the opening wave is the two Vandals the radio promises
      if (ace) { L.guns = [{cal:'60', ammo:'ex'}, {cal:'40', ammo:'slug'}]; L.arm = [30, 30, 30, 30]; L.paint = [0x111111, 0xb88a2a, 0xc0392b]; }
      L.rocket = Math.random() < 0.5 ? 'he' : 'flak';
      const nm = G.name1920s({nick:ace ? true : undefined});
      const role = opts.strafe && i < opts.strafe ? 'strafe' : 'fighter';
      const p = g.addPlane({loadout:L, team:1, name:nm.full, callsign:ace ? nm.full : nm.short, pos, q, speed:95, ai:{role, skill:ace ? 0.9 : 0.35 + Math.random()*0.3}, internalMul:ace ? 1.6 : 1});
      p.ace = ace; if (ace) this.ace = p; made.push(p);
    }
    this.waveLeft = n; return made;
  },
  update(g, dt){
    this.pt += dt;
    if (this.phase === 1 && this.pt > 3) {
      this.phase = 2; this.wave = 1; this.spawnWave(2, {});
      G.HUD.radio(G.RADIO.short, 'Two Vandals coming in off the water. Make it quick, sugar.');
      G.HUD.objective('Wave 1 of 3: shoot down the Vandals');
    }
    if (this.phase === 2 && this.waveLeft <= 0) { this.phase = 3; this.pt = 0; G.HUD.radio(G.CAPTAIN.short, 'Nice shooting. Don\'t get comfortable.'); }
    if (this.phase === 3 && this.pt > 5) {
      this.phase = 4; this.wave = 2; this.spawnWave(3, {strafe:2});
      G.HUD.radio(G.RADIO.short, 'Three more! Two of \'em are making for the gondola. Get them off us!');
      G.HUD.objective('Wave 2 of 3: protect the Lucky Margaret');
    }
    if (this.phase === 4 && this.waveLeft <= 0) { this.phase = 5; this.pt = 0; G.HUD.radio(G.RADIO.short, 'Scope\'s clear... no, wait. One big blip, two little ones.'); }
    if (this.phase === 5 && this.pt > 6) {
      this.phase = 6; this.wave = 3; this.spawnWave(3, {ace:true, strafe:1});
      G.HUD.radio(G.RADIO.short, `That black-and-gold job is ${this.ace.name}. Lantern's top gun. Watch his .60s.`);
      setTimeout(() => { if (this.ace && this.ace.alive) G.HUD.radio(this.ace.callsign, G.pick(['That cargo\'s mine, flyboy. Turn around and live.', 'You\'re a long way from home, sap.', 'I\'ll paint your wreck on my tail.'])); }, 3500);
      G.HUD.objective(`Wave 3 of 3: shoot down ${this.ace.callsign}`);
    }
    if (this.phase === 6 && this.waveLeft <= 0) { this.phase = 7; this.pt = 0; this.finish(); }
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){
    return [{text:this.sides[0].text, st:this.ship.hp/this.ship.hpMax >= 0.75 ? (this.phase === 7 ? 'ok' : 'live') : 'fail', val:Math.round(this.ship.hp/this.ship.hpMax*100) + '%'},
            {text:this.sides[1].text, st:g.kills >= 6 ? 'ok' : 'live', val:`${g.kills}/6`}];
  },
  onKill(g, plane){ if (plane.team === 1) this.waveLeft--; if (plane === this.ace) G.HUD.radio(G.RADIO.short, 'The ace is down! Look at him go, chute and all.'); },
  onShipHit(g, ship){ if (ship.hp/ship.hpMax < 0.5 && !this.warned) { this.warned = true; G.HUD.radio(G.CAPTAIN.short, 'We\'re taking a beating up here! Gas cells are holed!'); } },
  onShipDown(g){ G.HUD.radio(G.CAPTAIN.short, 'She\'s going down! Abandon ship!'); g.end(this.result(g, 'fail', 'The Lucky Margaret went down in flames over Halcyon Island.')); },
  playerDown(g){ G.HUD.radio(G.RADIO.short, `${g.player.callsign}! Chute... we see a chute! Hang on, we\'ll fish you out.`); g.end(this.result(g, 'fail', 'Shot down. The crew fished you out of the bay, soaked and furious.')); },
  finish(){
    const g = this.g, perfect = this.sideState(g).every(s => s.st === 'ok');
    G.HUD.radio(G.CAPTAIN.short, perfect ? 'Not a scratch worth mentioning, and the Lantern lost its ace. Drinks are on me tonight.' : 'Cargo\'s safe. That\'s what matters. Come on home.');
    g.end(this.result(g, perfect ? 'perfect' : 'success'));
  },
  result(g, kind, note){
    const pay = this.pay, cash = kind === 'fail' ? 300 + g.kills*pay.kill/2 : pay.success + (kind === 'perfect' ? pay.perfect : 0) + g.kills*pay.kill;
    const lines = {
      perfect:{mood:'pleased', say:'Every raider down, the ace in the drink, and the Margaret barely singed. Thorne\'s buying, which never happens.', then:'Port Halcyon gets its medicine. Word spreads fast: the Lucky Thirteen have a new hotshot.'},
      success:{mood:'stern', say:'Cargo delivered. A few more holes in the old girl than I\'d like, but she flies.', then:'Port Halcyon gets its medicine. The Black Lantern will want payback.'},
      fail:{mood:'angry', say:note || 'That went sideways.', then:'The Black Lantern takes the cargo. Next time, sugar, we do better.'}
    }[kind];
    return Object.assign({kind, cash:Math.round(cash), kills:g.kills, shipPct:Math.round(this.ship.hp/this.ship.hpMax*100), sides:this.sideState(g)}, lines);
  }
};
/* =====================================================================
   Test mission 2: "The Nightjar"
   A Black Lantern Raider zeppelin. Sink her, take her bridge (surrender), or strip every engine and gun (capture).
   ===================================================================== */
G.MISSIONS.nightjar = Object.assign(Object.create(G.MISSIONS.ambush), {
  id:'nightjar', title:'The Nightjar', wing:3, place:'Off the Halcyon coast, Sierra Free State',
  brief:'The Black Lantern raider Nightjar has been picking off cargo ships along the coast. Thorne wants her stopped for good. Shoot out all four engines so she can\'t run, then hole her hydrogen cells until she can\'t stay up. Her radio mast will call for help and her belly hangar launches fighters, so silence those early.',
  sides:[{id:'radio', text:'Knock out her radio before help arrives'}, {id:'kills', text:'Down 4 fighters yourself'}],
  pay:{destroy:4500, perfect:1500, kill:300, success:4500},
  setup(g){
    this.g = g; this.warned = false; this.ended = false; this.phase = 0; this.pt = 0; this.outcome = null; this.launched = 0; this.called = 0; this.hangT = 25; this.radioT = 40;
    this.launch(g, `Hook's live, ${G.save.callsign || 'Ace'}. The Nightjar's off our bow with a fighter screen. Drop when ready.`);
    const s = this.ship;
    const pos = new V3(s.pos.x + Math.sin(s.heading)*2400, 820, s.pos.z + Math.cos(s.heading)*2400);
    this.raider = g.addShip({team:1, kind:'raider', name:'Nightjar', label:'NIGHTJAR', pos, heading:s.heading + Math.PI, speed:8, turn:0.02});
    g.targetShip = this.raider; this.runClock = 0;
    // the two ships close on each other and turn broadside at ~700 m
    s.foe = this.raider; this.raider.foe = s; s.standoff = 750; this.raider.standoff = 700; s.turn0 = 0.02; s.speed0 = s.speed = 7;
  },
  spawnNear(at, n, why, o = {}){
    const g = this.g, made = [], used = {};
    for (let i = 0; i < n; i++) {
      const L = G.gangLoadout('lantern', i, n, used, [0x7a1f1f, 0x1b1b1b, 0xd9b44a]);
      const nm = G.name1920s(), pos = at.clone().add(new V3((i - (n - 1)/2)*40, o.drop ? -30 - i*10 : (Math.random() - 0.5)*80, 0));
      const q = o.q ? o.q.clone() : new Q().setFromUnitVectors(new V3(0, 0, 1), tA.copy(this.ship.pos).sub(pos).setY(0).normalize());
      made.push(g.addPlane({loadout:L, team:1, name:nm.full, callsign:nm.short, pos, q, speed:o.drop ? 60 : 92, ai:{role:'fighter', skill:0.35 + Math.random()*0.35}}));
    }
    return made;
  },
  update(g, dt){
    this.pt += dt; const R = this.raider;
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); G.HUD.radio('Dutch', 'Dutch, Hellcat and Doc off the trapeze. We\'re covering you. Give the word: 1 attack, 2 cover, 3 the zeppelin, 4 form up, 5 send us home.'); }
    if (this.phase === 1 && this.pt > 2) {
      this.phase = 2;
      this.spawnNear(R.worldPoint(new V3(0, 30, 160), new V3()), 3, 'escort');
      G.HUD.radio(G.RADIO.short, 'Three escorts peeling off the Nightjar. Watch her flak, and that rocket battery under the gondola.');
      G.HUD.objective('Stop the Nightjar: all 4 engines, then 4 gas cells');
      setTimeout(() => G.HUD.radio(G.CAPTAIN.short, 'Engines first, so she can\'t run. Then strip her plating and hole those gas cells. Four should do it.'), 9000);
    }
    if (this.phase === 2 && !this.outcome && R.alive && R.state === 'fighting') {
      // the hangar keeps launching while the doors are intact
      this.hangT -= dt;
      if (this.hangT <= 0 && this.launched < 6 && R.alivePart('hangar').length) {
        this.hangT = 55; this.launched += 2;
        this.spawnNear(R.worldPoint(new V3(0, -40, -14), new V3()), 2, 'hangar', {drop:true, q:R.q});
        G.HUD.radio(G.RADIO.short, 'She\'s launching fighters from her belly! Shoot out those hangar doors.');
      }
      // and the radio mast calls in friends
      this.radioT -= dt;
      if (this.radioT <= 0 && this.called < 4 && R.alivePart('radio').length) {
        this.radioT = 50; this.called += 2;
        const a = Math.random()*Math.PI*2, at = new V3(R.pos.x + Math.sin(a)*2600, 750, R.pos.z + Math.cos(a)*2600);
        this.spawnNear(at, 2, 'radio');
        G.HUD.radio(G.RADIO.short, 'Nightjar\'s on the horn calling for help. Two more inbound. Knock out that radio mast!');
      }
    }
    if (R.state === 'running' && !this.outcome) {
      this.runClock -= dt;
      const m = Math.max(0, Math.ceil(this.runClock));
      G.HUD.objective(`She's running! Kill her engines: ${R.alivePart('engine').length} left · ${Math.floor(m/60)}:${String(m%60).padStart(2, '0')}`);
      if (this.runClock <= 0) { this.outcome = 'escaped'; G.HUD.radio(G.CAPTAIN.short, 'She\'s into the cloud bank and gone. Blast it!'); g.end(this.result(g, 'fail', 'The Nightjar limped into the clouds and got away. She\'ll be back, and she\'ll be angry.')); }
    }
    if (this.outcome && this.outcome !== 'escaped' && !this.ended && this.pt > 5) { this.ended = true; this.finish(); }
    if (g.player && g.player.pos.y < 0) {}
    G.HUD.sides(this.sideState(g));
  },
  sideState(g){
    const R = this.raider, radioUp = R && R.alivePart('radio').length;
    const st = !radioUp ? (this.called ? 'fail' : 'ok') : this.called ? 'fail' : 'live';
    return [{text:this.sides[0].text, st, val:!radioUp ? (this.called ? 'too late' : 'down') : this.called ? 'help called' : 'up'},
            {text:this.sides[1].text, st:g.kills >= 4 ? 'ok' : 'live', val:`${g.kills}/4`}];
  },
  onKill(){},
  onPartDown(g, ship, c){
    if (ship !== this.raider) return;
    const L = {engine:'One of her engines is gone!', hangar:'Hangar doors are scrap. No more fighters from her belly.', radio:'Radio mast is down. She can\'t call for help now.',
      fin:'Rudder shot away! She\'s steering like a barge.', cell:'Gas cell holed. She\'s losing lift!', flak:'Flak gun silenced.', mg:'One of her gun blisters is quiet.', rocket:'Rocket battery\'s out!'}[c.kind];
    if (c.kind === 'bridge') { G.HUD.radio(G.RADIO.short, 'Bridge is wrecked! Her gunners are firing blind now. She\'s still flying though.'); return; }
    if (c.kind === 'engine') { const n = ship.alivePart('engine').length; if (n) G.HUD.objective(`Engines: ${n} left · gas cells holed ${8 - ship.alivePart('cell').length}/4`); else { G.HUD.radio(G.CAPTAIN.short, 'All four engines out! She\'s dead in the air. Now hole those gas cells!'); G.HUD.objective(`Hole her gas cells: ${8 - ship.alivePart('cell').length}/4`); } return; }
    if (c.kind === 'cell') { const n = 8 - ship.alivePart('cell').length; G.HUD.objective(ship.alivePart('engine').length ? `Engines: ${ship.alivePart('engine').length} left · gas cells holed ${n}/4` : `Hole her gas cells: ${Math.min(n, 4)}/4`); if (n >= 4 && ship.alivePart('engine').length) { G.HUD.radio(G.RADIO.short, 'She\'s sinking, but her engines are still dragging her along. Finish those engines!'); return; } }
    if (L) G.HUD.radio(G.RADIO.short, L);
  },
  onShipRun(g, ship){
    if (ship !== this.raider || this.outcome) return; this.runClock = 120;
    G.HUD.radio(G.RADIO.short, 'She\'s turning tail! The Nightjar\'s making a run for the cloud bank. Two minutes and she\'s gone. Get her engines!');
  },
  onShipSurrender(g, ship){
    if (ship !== this.raider || this.outcome) return; this.outcome = 'surrender'; this.pt = 0;
    G.HUD.radio(G.RADIO.short, 'White flag on the Nightjar! Her bridge is wrecked and she\'s striking her colours!');
    this.fleePirates(g);
  },
  onShipCaptured(g, ship){
    if (ship !== this.raider || this.outcome) return; this.outcome = 'capture'; this.pt = 0;
    G.HUD.radio(G.CAPTAIN.short, 'No engines, no guns. She\'s ours. Boarding party away! Hold the sky while we tow her.');
    this.fleePirates(g);
  },
  onShipDown(g, ship){
    if (ship === this.raider) {
      if (this.outcome) return; this.outcome = 'destroy'; this.pt = 0;
      G.HUD.radio(G.RADIO.short, 'She\'s going down! No engines, no lift, and a whole lot of hydrogen. Look at her burn!');
      this.fleePirates(g); return;
    }
    G.HUD.radio(G.CAPTAIN.short, 'She\'s going down! Abandon ship!'); g.end(this.result(g, 'fail', 'The Lucky Margaret went down in flames. The Nightjar sails on.'));
  },
  fleePirates(g){
    for (const pl of g.pilots) if (pl.p.team === 1 && pl.p.alive) { pl.role = 'flee'; pl.state = 'extend'; pl.t = 999; pl.dir.copy(pl.p.pos).sub(this.raider.pos).setY(0.2).normalize(); }
  },
  playerDown(g){ G.HUD.radio(G.RADIO.short, `${g.player.callsign}! We see your chute! Hang on, sugar.`); g.end(this.result(g, 'fail', 'Shot down within sight of the Nightjar. The crew fished you out; the pirates got away.')); },
  finish(){
    const g = this.g, perfect = this.sideState(g).every(s => s.st === 'ok');
    g.end(this.result(g, perfect ? 'perfect' : 'success'));
  },
  result(g, kind, note){
    const pay = this.pay, oc = this.outcome;
    const cash = kind === 'fail' ? 300 + g.kills*pay.kill/2 : pay.destroy + (kind === 'perfect' ? pay.perfect : 0) + g.kills*pay.kill;
    const say = kind === 'fail' ? note : kind === 'perfect' ? 'Engines, gas, radio, the lot. The Nightjar never even got a word out. Thorne\'s already spending the bounty.' : 'The Nightjar\'s on the bottom of the bay. The bounty pays, and the coast is a little quieter tonight.';
    const then = kind === 'fail' ? 'The Nightjar slips away into the clouds.' : 'The Black Lantern lost a raider. They won\'t forget whose guns did it.';
    return {kind, cash:Math.round(cash), kills:g.kills, shipPct:Math.round(this.ship.hp/this.ship.hpMax*100), sides:this.sideState(g), mood:kind === 'fail' ? 'angry' : kind === 'perfect' ? 'pleased' : 'stern', say, then};
  }
});

})();
