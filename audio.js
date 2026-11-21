(function(){
'use strict';
/* Recorded audio only. Engine and gun loops trim the MP3 padding so they loop without a click. */
const G = window.G;
/* connect a chain of audio nodes without leaning on connect() returning its target (older Safari returns nothing) */
const link = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
const A = G.audio = {
  ctx:null, buf:{}, last:{}, muted:false,
  init(){
    if (this.ctx) { if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume(); return; }   // Safari also has 'interrupted'
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.vol(); this.master.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxVol(); this.sfxBus.connect(this.master);
      this.ambBus = c.createGain(); this.ambBus.gain.value = this.ambVol(); this.ambBus.connect(this.master);   // weather, wind, waves: the world's own noise, on its own slider
      // your own engine runs through one shared chain so every plane sounds like the same game: a tone filter that opens up
      // with intensity (throttle and airspeed), then a gentle compressor that glues the engine, the propeller beat and the rotor together
      this.engLP = c.createBiquadFilter(); this.engLP.type = 'lowpass'; this.engLP.frequency.value = 2500; this.engLP.Q.value = 0.6;
      this.engHP = c.createBiquadFilter(); this.engHP.type = 'highpass'; this.engHP.frequency.value = 55;
      this.engComp = c.createDynamicsCompressor ? c.createDynamicsCompressor() : c.createGain();
      if (this.engComp.threshold) { this.engComp.threshold.value = -20; this.engComp.knee.value = 12; this.engComp.ratio.value = 3; this.engComp.attack.value = 0.02; this.engComp.release.value = 0.25; }
      link(this.engHP, this.engLP, this.engComp, this.sfxBus); this.engBus = this.engHP;
      for (const k in G.SFX) {
        const bin = atob(G.SFX[k]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const ok = b => { if (!this.buf[k]) { this.buf[k] = b; this.edges(k, b); if (k === 'engine' || k === 'engine2') this.startEngines(); } };
        const pr = c.decodeAudioData(u8.buffer, ok, () => {}); if (pr && pr.then) pr.then(ok).catch(() => {});
      }
      // the Zephyr's turbine is a recording of its own, fetched alongside the game
      if (typeof fetch === 'function') fetch('sounds/turbine2.wav').then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => { const p = c.decodeAudioData(b, ok, no); if (p && p.then) p.then(ok, no); })).then(b => { this.edges('turbine', b); this.buf.turbine = this.seamless(b, this.trim.turbine, 0.35); this.trim.turbine = {s:0, e:this.buf.turbine.duration}; }).catch(() => {});
      if (typeof fetch === 'function') for (const k of ['creak', 'tear']) fetch(`sounds/${k}.wav?v=1`).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => { const p = c.decodeAudioData(b, ok, no); if (p && p.then) p.then(ok, no); })).then(b => { this.buf[k] = b; this.trim[k] = {s:0, e:b.duration}; }).catch(() => {});   // airframe failing: made from the rivet and hull recordings
      if (typeof fetch === 'function') fetch('sounds/prop_pass.wav?v=2').then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => { const p = c.decodeAudioData(b, ok, no); if (p && p.then) p.then(ok, no); })).then(b => { this.buf.pass = b; this.trim.pass = {s:0, e:b.duration}; }).catch(() => {});
      // more engine voices, each a seamless WAV loop: an inline V12 for the sleek fighters, and the Whirligig's rotor chop
      if (typeof fetch === 'function') for (const k of ['v12', 'rotor', 'heavy', 'rough', 'steam', 'prop_light', 'prop_smooth', 'prop_twin', 'prop_heavy']) fetch(`sounds/${k}.wav?v=${/^prop_/.test(k) ? 3 : 2}`).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => { const p = c.decodeAudioData(b, ok, no); if (p && p.then) p.then(ok, no); })).then(b => {
        if (/^prop_/.test(k)) { this.buf[k] = b; this.trim[k] = {s:0, e:b.duration}; return; }   // the prop recordings are cut to loop on their own, end in step with start: a long blend here would phase like a passing plane
        this.edges(k, b); this.buf[k] = this.seamless(b, this.trim[k], 0.25); this.trim[k] = {s:0, e:this.buf[k].duration}; }).catch(() => {});
    } catch (e) { this.ctx = null; }
  },
  vol(){ return this.muted ? 0 : 1; },
  sfxVol(){ return G.save ? G.save.vol ?? 0.7 : 0.7; },
  ambVol(){ return G.save ? G.save.amb ?? 0.8 : 0.8; },
  setVolume(v){ if (G.save) { G.save.vol = v; G.persist(); } if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(this.sfxVol(), this.ctx.currentTime, 0.05); },
  setAmbient(v){ if (G.save) { G.save.amb = v; G.persist(); } if (this.ambBus) this.ambBus.gain.setTargetAtTime(this.ambVol(), this.ctx.currentTime, 0.05); },
  toggleMute(){ this.muted = !this.muted; if (this.master) this.master.gain.setTargetAtTime(this.vol(), this.ctx.currentTime, 0.05); if (G.music && G.music.el) G.music.el.volume = this.muted ? 0 : G.music.vol(); return this.muted; },
  /* a loop with no seam: the recording's tail crossfaded (equal power) into its head, so nothing clicks or chirps each time round */
  seamless(b, tr, fade){
    const sr = b.sampleRate, m = Math.round(0.03*sr), s0 = Math.round(tr.s*sr) + m, s1 = Math.round(tr.e*sr) - m,   // 30 ms in from each end: the decoder's resampling smears the very edges, and that smear clicks every lap
       F = Math.min(Math.round(fade*sr), Math.floor((s1 - s0)/3)), n = s1 - s0 - F;
    const out = this.ctx.createBuffer(b.numberOfChannels, n, sr);
    for (let ch = 0; ch < b.numberOfChannels; ch++) { const d = b.getChannelData(ch), o = out.getChannelData(ch);
      for (let i = 0; i < n; i++) o[i] = d[s0 + F + i];
      for (let i = 0; i < F; i++) { const t = i/F; o[n - F + i] = d[s1 - F + i]*Math.cos(t*Math.PI/2) + d[s0 + i]*Math.sin(t*Math.PI/2); } }
    return out;
  },
  /* find where the encoder padding ends and starts again */
  edges(k, b){
    const d = b.getChannelData(0), th = 0.004; let s = 0, e = d.length - 1;
    while (s < d.length && Math.abs(d[s]) < th) s++; while (e > s && Math.abs(d[e]) < th) e--;
    (this.trim || (this.trim = {}))[k] = {s:s/b.sampleRate, e:(e + 1)/b.sampleRate};
  },
  loop(k, gain = 0){
    const c = this.ctx, b = this.buf[k]; if (!c || !b) return null;
    const src = c.createBufferSource(), g = c.createGain(), tr = this.trim[k]; src.buffer = b; src.loop = true;
    src.loopStart = tr.s; src.loopEnd = tr.e; g.gain.value = gain; link(src, g, this.sfxBus); src.start(0, tr.s);
    return {src, g};
  },
  /* which engine recording a plane sounds with: the inline-engined fighters get the V12, the rest the radial */
  // which recording each plane's engine is: an inline V12 for the sleek fighters, a deep smooth radial for the heavies,
  // a rough little rattler for the light brawlers, and the original for the rest. gain evens out how hot each recording is
  // real aircraft engines (your recordings): a buzzy light prop for the racers, a smooth one for the mid fighters, a beating
  // twin for the twin-engined, a deep heavy drone for the bruisers; the Gallant, Vandal and Whirligig keep the original
  VOICE:{mastodon:'prop_heavy', sparrowhawk:'prop_light', comet:'prop_light', hornet:'prop_light', jackal:'prop_light', mantis:'prop_smooth', grackle:'prop_smooth',
    banshee:'prop_twin', highwayman:'prop_twin', ironclad:'prop_heavy', thunderbuss:'prop_heavy', bulldog:'prop_heavy'},
  VGAIN:{engine:1}, VRATE:{engine:1},
  USE_VOICES:true,
  PITCH:{mastodon:0.78, sparrowhawk:1.06, comet:1.06, hornet:1.03, jackal:1, mantis:1.02, whirligig:1.05, vandal:1.02, gallant:1, grackle:0.97,
    banshee:1, bulldog:0.96, highwayman:0.96, ironclad:0.94, thunderbuss:0.9},
  pitchOf(P){ return (P && P.L && this.PITCH[P.L.chassis]) || 1; },
  engKey(P){ const k = this.USE_VOICES && P && P.L && this.VOICE[P.L.chassis]; return k && this.buf[k] ? k : 'engine'; },
  /* the propeller's beat: the engine's sound is pulsed by two low oscillators, the shaft turning (a rough flutter) and the
     blades passing the cowling (a buzz), so engine and propeller sound like one machine. beat(L) puts it on a loop; tune() sets
     the speeds from the engine's rpm, the blades lagging a touch behind a throttle change */
  beat(L, depth){
    const c = this.ctx; if (!c || !L || L.mod || !c.createOscillator) return L;
    const m = c.createGain(); m.gain.value = 1 - depth; L.src.disconnect(); link(L.src, m, L.g);
    const o1 = c.createOscillator(), d1 = c.createGain(), o2 = c.createOscillator(), d2 = c.createGain();
    o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = 90; o2.frequency.value = 30; d1.gain.value = depth*0.65; d2.gain.value = depth*0.35;
    link(o1, d1, m.gain); link(o2, d2, m.gain); o1.start(); o2.start();
    L.mod = {o1, o2}; return L;
  },
  tune(L, rpm, t){ if (!L || !L.mod) return; L.mod.o2.frequency.setTargetAtTime(rpm/60, t, 0.35); L.mod.o1.frequency.setTargetAtTime(rpm/60*3, t, 0.35); },
  unbeat(L, t){ if (L && L.mod) { try { L.mod.o1.stop(t + 0.35); L.mod.o2.stop(t + 0.35); } catch (e) {} } },
  toEng(L){ if (L && this.engBus && !L.onEng) { L.g.disconnect(); L.g.connect(this.engBus); L.onEng = true; } return L; },
  startEngines(){
    if (!this.eng && this.buf.engine) { this.eng = this.toEng(this.loop('engine', 0)); if (this.eng) this.eng.key = 'engine'; }
    if (!this.eng2 && this.buf.engine) { this.eng2 = this.loop('engine', 0); if (this.eng2) { this.eng2.src.detune.value = 260; this.eng2.key = 'engine'; } }
    if (!this.shipEng && this.buf.engine2) {
      // the airship: the twin-engine recording slowed right down and muffled into a soft, low thrum
      this.shipEng = this.loop('engine2', 0);
      if (this.shipEng) { const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.5;
        this.shipEng.g.disconnect(); link(this.shipEng.g, lp, this.sfxBus); this.shipEng.src.playbackRate.value = 0.36; }
    }
  },
  thr(k, gap){ const n = performance.now(); if (n - (this.last[k] || 0) < gap) return true; this.last[k] = n; return false; },
  one(k, gain = 1, rate = 1, offset = 0, dest = null){
    const c = this.ctx, b = this.buf[k]; if (!c || !b || gain < 0.01) return;
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = gain;
    link(s, g, dest || this.sfxBus); s.start(0, (this.trim[k] ? this.trim[k].s : 0) + offset);
  },
  /* damage to parts */
  cough(k){ this.one('hitshort', 0.16 + 0.24*k, 0.33 + Math.random()*0.06); },
  creak(){ if (!this.thr('creak', 1100)) this.one('creak', 0.75, 0.85 + Math.random()*0.25); },
  tear(pos){ this.one('tear', pos ? this.att(pos, 600)*0.9 : 1, 0.95 + Math.random()*0.1); },
  partHit(f, lvl){ if (!this.thr('parthit', 250)) this.one('hit', 0.3 + lvl*0.05, f === 0 ? 0.62 : 0.85); },
  att(pos, range = 1500){ const g = G.game; if (!g || !g.camera) return 0.5; return Math.max(0, 1 - g.camera.position.distanceTo(pos)/range)**1.6; },

  /* per-frame: player engine follows throttle and speed; a second loop tracks the nearest enemy for flybys; the airship drones */
  frame(game){
    if (!this.ctx) return; const t = this.ctx.currentTime, P = game.player;
    if (P && this.engLP) {   // intensity: throttle sets it, airspeed drives it; the tone opens up and closes down with it
      const vt = Math.min(1.25, P.speed/(P.top || 1)); this.intensity = Math.max(0, Math.min(1.15, 0.32*(P.throttle || 0) + 0.68*vt));
      this.engLP.frequency.setTargetAtTime(800 + 5400*Math.pow(this.intensity, 1.3), t, 0.25);
    }
    if (P && P.creak > 0 && P.alive && P.wingGone < 0) this.creak();
    if (this.eng && P) {
      const want = this.engKey(P);
      if (this.eng.key !== want) { const old = this.eng; old.g.gain.setTargetAtTime(0, t, 0.05); try { old.src.stop(t + 0.3); } catch (e) {} this.unbeat(old, t); this.eng = this.toEng(this.loop(want, 0)) || old; this.eng.key = want; }
      if (!this.eng.mod && !(P.st && P.st.jet)) this.beat(this.eng, 0.22);
      const gyro = P.L && P.L.chassis === 'whirligig' && this.buf.rotor;
      if (gyro && !this.rotor) this.rotor = this.toEng(this.loop('rotor', 0));
      if (this.rotor) { this.rotor.src.playbackRate.setTargetAtTime((P.hover ? 1.0 : 0.8) + Math.min(1, P.speed/P.top)*0.3, t, 0.3); this.rotor.g.gain.setTargetAtTime(gyro && P.alive && game.running ? 0.34 + Math.min(1, P.speed/P.top)*0.12 + (P.hover ? 0.1 : 0) : 0, t, 0.25); }   // the rotor is the big noise, louder still when she's hanging on it
      const on = P.alive && game.running && !P.engineDead;
      const jet = P.st && P.st.jet, sp = P.speed/P.top, s = jet ? (P.spool ?? P.throttle) : P.throttle, rate = jet ? 1.35 + s*0.9 + sp*0.25 : 0.72 + P.throttle*0.34 + sp*0.22 - (P.choke > 0 ? 0.25 : 0);   // the jet: the same recording wound right up into a whine
      if (jet && !this.turb && this.buf.turbine) this.turb = this.toEng(this.loop('turbine', 0));
      const realJet = jet && this.turb;   // with the turbine recording in hand the piston loop falls silent
      // a dying engine: for a few seconds it coughs, catches, misses and runs down, with a backfire or two, then silence
      if (P.engineDead && P.alive && game.running && !realJet) {
        if (this.deadAt === undefined) { this.deadAt = t; this.deadRate = this.eng.src.playbackRate.value || 1;
          for (const [d, v] of [[0.35, 0.5], [1.25, 0.42], [2.3, 0.3]]) setTimeout(() => { if (this.deadAt !== undefined) this.one('hitshort', v, 0.32 + Math.random()*0.06); }, d*1000); }
        const k = t - this.deadAt, life = 3.8; if (this.prop) this.prop.g.gain.setTargetAtTime(0, t, 0.3);
        if (k < life) { const f = 1 - k/life, beat = Math.sin(k*(15 - k*3.2) + Math.sin(k*7)*1.5) > 0.15 - k*0.12;
          this.eng.src.playbackRate.setTargetAtTime(Math.max(0.22, this.deadRate*(0.35 + 0.65*f*f)), t, 0.06);
          this.eng.g.gain.setTargetAtTime(beat ? 0.26*f : 0.012, t, 0.018); }
        else this.eng.g.gain.setTargetAtTime(0, t, 0.2);
      } else {
        if (!P.engineDead) this.deadAt = undefined;
        const dip = P.dip > 0;   // a shot-up engine misses: the note sags and drops out for a beat
        this.eng.src.playbackRate.setTargetAtTime(rate*(this.VRATE[this.eng.key] || 1)*this.pitchOf(P)*(dip ? 0.86 : 1), t, dip ? 0.05 : 0.12); this.eng.g.gain.setTargetAtTime(on && !realJet ? (0.1 + 0.24*this.intensity)*(this.VGAIN[this.eng.key] || 1)*(dip ? 0.3 : 1) : 0, t, dip ? 0.03 : 0.15);   // the V12 recording is hotter
        // the new engine voices are engine only; under them runs the original recording, quieter, for the propeller's thrum and whirr
        const propOn = on && !realJet && /^(v12|heavy|rough)$/.test(this.eng.key);
        if (propOn && !this.prop && this.buf.engine) this.prop = this.beat(this.toEng(this.loop('engine', 0)), 0.4);
        const rpm = 1150 + P.throttle*1350 + sp*350; this.tune(this.eng, rpm, t); this.tune(this.prop, rpm, t);   // a three-blade prop: the beat rises with the rpm
        if (this.prop) { this.prop.src.playbackRate.setTargetAtTime(rate*1.05, t, 0.4); this.prop.g.gain.setTargetAtTime(propOn ? (0.15 + P.throttle*0.1)*0.38 : 0, t, 0.15); }
      }
      if (this.turb) { this.turb.src.playbackRate.setTargetAtTime(0.78 + s*0.42 + sp*0.12, t, 0.25); this.turb.g.gain.setTargetAtTime(on && jet ? 0.1 + s*0.2 : 0, t, 0.3); }
    }
    if (this.eng2) {   // wingmen holding formation aren't heard here: their drift in the slot read as a plane passing
      let best = null, bd = 900; for (const p of game.planes) if (p.alive && !p.isPlayer && !p.parked && !(p.crew && P && p.vel.distanceTo(P.vel) < 30)) { const d = p.pos.distanceTo(game.camera.position); if (d < bd) { bd = d; best = p; } }
      const a = best ? (1 - bd/900)**1.8 : 0;
      // the nearest plane is heard with its own engine: a V12 Mantis, a radial Highwayman, a Zephyr's turbine
      const want = best ? (best.st && best.st.jet && this.buf.turbine ? 'turbine' : this.engKey(best)) : this.eng2.key || 'engine';
      if (this.eng2.key !== want && this.buf[want]) { const old = this.eng2; old.g.gain.setTargetAtTime(0, t, 0.05); try { old.src.stop(t + 0.3); } catch (e) {} const n = this.loop(want, 0); if (n) { this.eng2 = n; if (want === 'engine') n.src.detune.value = 260; } this.eng2.key = want; }
      const k2 = this.eng2.key, vr = k2 === 'turbine' ? 0.95 : this.VRATE[k2] || 1, vg = k2 === 'turbine' ? 1.1 : this.VGAIN[k2] || 1;
      if (best) { const closing = -best.vel.clone().sub(P ? P.vel : best.vel).dot(best.pos.clone().sub(game.camera.position).normalize()); this.eng2.src.playbackRate.setTargetAtTime(Math.max(0.6, 0.95 + closing/700)*vr*(k2 === 'turbine' ? 1 : this.pitchOf(best)), t, 0.08); }
      this.eng2.g.gain.setTargetAtTime(game.running ? a*0.32*vg : 0, t, 0.1);
      if (best && !best.crew && this.buf.pass && bd < 140 && game.running && !(best.st && best.st.jet) && best.vel.clone().sub(P ? P.vel : best.vel).length() > 45 && !this.thr('pass', 4500)) this.one('pass', 0.55*(1 - bd/140) + 0.2, this.pitchOf(best));   // whoosh: the recorded flyby
      const p2 = /^(v12|heavy|rough)$/.test(k2); if (p2 && !this.prop2 && this.buf.engine) { this.prop2 = this.loop('engine', 0); if (this.prop2) this.prop2.src.detune.value = 260; }
      if (this.prop2) { this.prop2.src.playbackRate.value = this.eng2.src.playbackRate.value*1.05/(vr || 1); this.prop2.g.gain.setTargetAtTime(game.running && p2 ? a*0.32*0.38 : 0, t, 0.1); }   // their propellers too
    }
    // the world's engines, on the ambient slider: the nearest steam train chuffs in time with its speed, and the nearest
    // steamship thrums low as she passes
    if (this.buf.steam && this.ambBus) {
      const cam = game.camera && game.camera.position; let best = null, bd = 1e9;
      if (cam) for (const T of game.trains || []) { if (!T.alive || !T.cars || !T.cars[0]) continue; const d = T.cars[0].grp.position.distanceTo(cam); if (d < bd) { bd = d; best = T; } }
      if (best && bd < 900 && !this.steamL) { this.steamL = this.loop('steam', 0); if (this.steamL) { this.steamL.g.disconnect(); this.steamL.g.connect(this.ambBus); } }
      if (this.steamL) { const a = best ? Math.max(0, 1 - bd/900)**1.5 : 0, sp = best && !best.done ? best.speed : 0;
        this.steamL.src.playbackRate.setTargetAtTime(0.55 + Math.min(1, sp/30)*0.6, t, 0.4); this.steamL.g.gain.setTargetAtTime(game.running ? a*(sp > 1 ? 0.5 : 0.18) : 0, t, 0.3); }
    }
    if (this.buf.heavy && this.ambBus && game.sea) {
      const cam = game.camera && game.camera.position; let bd = 1e9;
      if (cam) for (const S of game.sea.ships) { if (!S.alive || !S.obj || !/freighter|steamer|tug|gunboat|yacht|trawler/.test(S.kind)) continue; const d = S.obj.position.distanceTo(cam); if (d < bd) bd = d; }
      if (bd < 600 && !this.seaL) { this.seaL = this.loop('heavy', 0); if (this.seaL) { this.seaL.g.disconnect(); this.seaL.g.connect(this.ambBus); this.seaL.src.playbackRate.value = 0.42; } }
      if (this.seaL) this.seaL.g.gain.setTargetAtTime(game.running ? Math.max(0, 1 - bd/600)**1.6*0.22 : 0, t, 0.4);
    }
    if (this.shipEng) {
      const s = game.ships[0]; const a = s && s.alive ? Math.max(0, 1 - s.pos.distanceTo(game.camera.position)/900)**1.2 : 0;
      this.shipEng.src.playbackRate.setTargetAtTime(0.36, t, 0.5); this.shipEng.g.gain.setTargetAtTime(s && s.alive ? a*0.16 : 0, t, 0.4);
    }
    // the player's guns fire shot by shot (playerShot, from the guns themselves), so each caliber is heard at its own rate;
    // the tail rings out on release, pitched by the heaviest gun that was firing
    const firing = P && P.alive && P.fire && P.hasAmmo() && game.running;
    if (firing) { this.gunOn = true; this.gunRate = P.guns.filter(g => g.rounds > 0).reduce((m, g) => Math.min(m, this.calPitch(g.def)), 2); }
    else if (this.gunOn) { this.gunOn = false; this.one('guntail', 0.5, this.gunRate || 1); }
  },
  stopAll(){
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const L of [this.eng, this.eng2, this.shipEng, this.turb, this.rotor, this.steamL, this.seaL, this.prop, this.prop2]) if (L) L.g.gain.setTargetAtTime(0, t, 0.1);
    if (this.gun) { try { this.gun.src.stop(); } catch (e) {} this.gun = null; }
  },
  /* caliber sets the voice: the .30 a quick high crack, the .70 a slow deep thump */
  // a cannon's voice for the heavy guns: the recordings are nearly all below 100 Hz, which small speakers can't play, so the heavy
  // shots go through a bus that lifts the low-mids and drives a soft saturator; its harmonics let the ear hear the deep fundamental
  heavyBus(){
    if (this._heavy) return this._heavy; const c = this.ctx;
    const eq = c.createBiquadFilter(); eq.type = 'peaking'; eq.frequency.value = 170; eq.Q.value = 0.8; eq.gain.value = 11;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.5;
    const ws = c.createWaveShaper(), N = 1024, cv = new Float32Array(N); for (let i = 0; i < N; i++) { const x = i/(N - 1)*2 - 1; cv[i] = Math.tanh(x*1.15)/Math.tanh(1.15); } ws.curve = cv; ws.oversample = '4x';   // a gentle drive: enough overtones to carry, not enough to fizz
    const out = c.createGain(); out.gain.value = 0.85;
    link(eq, ws, lp, out, this.sfxBus); return (this._heavy = eq);
  },
  calPitch(def){ return {'30':1.12, '40':1.05, '50':1.0, '60':0.74, '70':0.5}[def.id] || def.pitch || 1; },   // the light guns near the recording's own pitch; the .60 and .70 well down
  playerShot(def){ if (!this.ctx || this.thr('ps' + def.id, 900/def.rps)) return; const p = this.calPitch(def), heavy = Math.max(0, Math.min(1, (0.9 - p)/0.4)), r = 0.97 + Math.random()*0.06;
    const bus = p < 0.9 ? this.heavyBus() : null;   // only the .60 and .70 go through the cannon bus
    this.one('gunshot', 0.42 + 0.2*heavy, p*r, 0, bus); this.one('guntail', 0.06 + 0.3*heavy, p*r, 0, bus);
    if (heavy > 0.3) this.one('boomsmall', 0.4*heavy, 0.9 + Math.random()*0.1, 0, bus); },
  shot(pos, pitch){ const a = this.att(pos, 1200); if (a < 0.02 || this.thr('shot', 55)) return; this.one('gunshot', a*0.5, pitch*(0.95 + Math.random()*0.1)); },
  rocket(a = 1){ this.one('rocket', 0.6*a, 0.95 + Math.random()*0.1); },
  boom(pos, big){ const a = this.att(pos, big ? 3500 : 2200); if (a < 0.02 || this.thr(big ? 'boomB' : 'boomS', 60)) return; this.one(big ? 'boom' : 'boomsmall', (big ? 1 : 0.8)*a + 0.08, big ? 0.9 + Math.random()*0.15 : 1.05 + Math.random()*0.2); },
  flak(pos){ const a = this.att(pos, 2600); if (a < 0.02 || this.thr('flak', 70)) return; this.one('boomsmall', 0.22*a + 0.02, 1.3 + Math.random()*0.15); },
  hitMe(heavy){ if (this.thr('hitMe', heavy ? 90 : 55)) return; this.one(heavy ? 'hit' : 'hitshort', heavy ? 0.8 : 0.55, 0.85 + Math.random()*0.3); },
  ding(){ if (this.thr('ding', 120)) return; this.one('ding', 0.6, 1); },
  gear(){ if (this.thr('gear', 300)) return; this.one('hitshort', 0.3, 0.5); },   // the gear locking: a low, slowed-down thunk
  hitThem(){ if (this.thr('hitThem', 70)) return; this.one('hitshort', 0.22, 1.25 + Math.random()*0.2); }
};

/* ---------- Music: the player's own recordings, fetched from the artifact's music/ folder on first use ----------
   sidewalk = aboard the Lucky Margaret (menus, hangar); swingin = a good debrief; fail = a failed one; home = the chapter's end;
   jetaime = reserved for the fancy airstrip bar. */
const TRACKS = {sidewalk:'music/sidewalk-hustle.mp3', swingin:'music/swingin-nights.mp3', home:'music/all-the-way-home.mp3', fail:'music/1920s-fail.mp3', caravan:'music/midnight-caravan.mp3', jetaime:'music/je-taime.mp3',
  indigo:'music/indigo-hour.mp3', latenight:'music/after-a-long-night-out.mp3', swingbaby:'music/swing-baby-swing.mp3', foottap:'music/foot-tappers-club.mp3', indiana:'music/indiana-moon.mp3'};
/* mission music: upbeat swing by day and at dusk, smooth jazz at night; alternates so back-to-back flights differ */
const SETS = {day:['swingbaby', 'foottap'], evening:['swingbaby', 'foottap'], night:['indigo', 'latenight'], club:['indiana', 'indigo', 'latenight']}, nextIx = {club:-1};   // the clubs open with the singer
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
/* every click, tap or key: wake the sound if the browser has paused it (Safari pauses it, and calls that 'interrupted').
   If it still won't run after you've clicked, say so once, with the setting to change. */
A.unlock = function(){
  if (!this.ctx) this.init();
  const c = this.ctx; if (!c || (G.game && G.game.paused)) return;   // paused on purpose: the pause screen's own Resume wakes it
  if (c.state !== 'running' && c.state !== 'closed') { const p = c.resume(); if (p && p.catch) p.catch(() => {}); }
  if (!this.primed) { this.primed = true; try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {} }
  clearTimeout(this.checkT);
  this.checkT = setTimeout(() => {
    if (this.warned || !this.ctx || this.ctx.state === 'running' || (G.game && G.game.paused)) return;
    this.warned = true; const msg = 'Sound is blocked. In Safari: Safari menu → Settings for This Website → Auto-Play → Allow All Auto-Play, then reload.';
    if (G.HUD && G.HUD.toast && G.game) G.HUD.toast(msg); else console.warn(msg);
  }, 700);
};
G.music = {
  urls:{}, cur:null, want:null, el:null, fadeT:null,
  vol(){ return G.save && G.save.music !== undefined ? G.save.music : 0.45; },
  setVolume(v){ if (G.save) { G.save.music = v; G.persist(); } if (this.el && !this.fading) this.el.volume = v*(G.audio.muted ? 0 : 1); },
  async url(k){
    if (this.urls[k]) return this.urls[k];
    const r = await fetch(TRACKS[k]); if (!r.ok) throw new Error('music ' + r.status);
    return (this.urls[k] = URL.createObjectURL(await r.blob()));
  },
  play(k){
    this.want = k; if (this.cur === k && this.el && !this.el.paused) return;
    this.fade(0, 0.6, () => {
      if (this.want !== k) return;
      this.url(k).then(u => {
        if (this.want !== k) return;
        if (!this.el) { this.el = new Audio(); this.el.loop = true; }
        this.el.src = u; this.cur = k; this.el.volume = 0;
        const p = this.el.play(); if (p && p.catch) p.catch(() => { this.blocked = true; });
        this.fade(this.vol()*(G.audio.muted ? 0 : 1), 1.2);
      }).catch(() => {});
    });
  },
  mission(time){ const set = SETS[time] || SETS.day, k = set[(nextIx[time] = ((nextIx[time] ?? Math.floor(Math.random()*set.length)) + 1) % set.length)]; this.play(k); return k; },
  club(){ return this.mission('club'); },
  stop(t = 1){ this.want = null; this.fade(0, t, () => { if (!this.want && this.el) { this.el.pause(); this.cur = null; } }); },
  fade(to, t, done){
    clearInterval(this.fadeT); const el = this.el;
    if (!el || el.paused) { if (done) done(); return; }
    const from = el.volume, n = Math.max(1, Math.round(t*30)); let i = 0; this.fading = true;
    this.fadeT = setInterval(() => { i++; el.volume = Math.max(0, Math.min(1, from + (to - from)*i/n)); if (i >= n) { clearInterval(this.fadeT); this.fading = false; if (done) done(); } }, 33);
  },
  /* browsers only start audio after a click: retry the wanted track on the first one */
  /* Safari counts play() only inside the click itself, so the retry has to start the element right here, not after a fetch */
  kick(){
    if (!this.want || (this.el && !this.el.paused && !this.blocked)) return;
    const k = this.want, u = this.urls[k];
    if (!this.el) { this.el = new Audio(); this.el.loop = true; }
    this.blocked = false;
    if (u) { if (this.el.src !== u) this.el.src = u; this.cur = k; this.el.volume = this.vol()*(G.audio.muted ? 0 : 1); const p = this.el.play(); if (p && p.catch) p.catch(() => { this.blocked = true; }); return; }
    // not fetched yet: unlock the element with a moment of silence now, then fetch and play into it
    this.el.src = SILENCE; const p = this.el.play(); if (p && p.catch) p.catch(() => {}); this.cur = null; this.play(k);
  }
};
})();
