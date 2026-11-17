(function(){
'use strict';
/* Recorded audio only. Engine and gun loops trim the MP3 padding so they loop without a click. */
const G = window.G;
const A = G.audio = {
  ctx:null, buf:{}, last:{}, muted:false,
  init(){
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.vol(); this.master.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      for (const k in G.SFX) {
        const bin = atob(G.SFX[k]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const ok = b => { if (!this.buf[k]) { this.buf[k] = b; this.edges(k, b); if (k === 'engine' || k === 'engine2') this.startEngines(); } };
        const pr = c.decodeAudioData(u8.buffer, ok, () => {}); if (pr && pr.then) pr.then(ok).catch(() => {});
      }
    } catch (e) { this.ctx = null; }
  },
  vol(){ return this.muted ? 0 : (G.save ? G.save.vol : 0.7); },
  setVolume(v){ if (G.save) { G.save.vol = v; G.persist(); } if (this.master) this.master.gain.setTargetAtTime(this.vol(), this.ctx.currentTime, 0.05); },
  toggleMute(){ this.muted = !this.muted; if (this.master) this.master.gain.setTargetAtTime(this.vol(), this.ctx.currentTime, 0.05); if (G.music && G.music.el) G.music.el.volume = this.muted ? 0 : G.music.vol(); return this.muted; },
  /* find where the encoder padding ends and starts again */
  edges(k, b){
    const d = b.getChannelData(0), th = 0.004; let s = 0, e = d.length - 1;
    while (s < d.length && Math.abs(d[s]) < th) s++; while (e > s && Math.abs(d[e]) < th) e--;
    (this.trim || (this.trim = {}))[k] = {s:s/b.sampleRate, e:(e + 1)/b.sampleRate};
  },
  loop(k, gain = 0){
    const c = this.ctx, b = this.buf[k]; if (!c || !b) return null;
    const src = c.createBufferSource(), g = c.createGain(), tr = this.trim[k]; src.buffer = b; src.loop = true;
    src.loopStart = tr.s; src.loopEnd = tr.e; g.gain.value = gain; src.connect(g).connect(this.sfxBus); src.start(0, tr.s);
    return {src, g};
  },
  startEngines(){
    if (!this.eng && this.buf.engine) this.eng = this.loop('engine', 0);
    if (!this.eng2 && this.buf.engine) { this.eng2 = this.loop('engine', 0); if (this.eng2) this.eng2.src.detune.value = 260; }
    if (!this.shipEng && this.buf.engine2) {
      // the airship: the twin-engine recording slowed right down and muffled into a soft, low thrum
      this.shipEng = this.loop('engine2', 0);
      if (this.shipEng) { const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.5;
        this.shipEng.g.disconnect(); this.shipEng.g.connect(lp).connect(this.sfxBus); this.shipEng.src.playbackRate.value = 0.36; }
    }
  },
  thr(k, gap){ const n = performance.now(); if (n - (this.last[k] || 0) < gap) return true; this.last[k] = n; return false; },
  one(k, gain = 1, rate = 1, offset = 0){
    const c = this.ctx, b = this.buf[k]; if (!c || !b || gain < 0.01) return;
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = gain;
    s.connect(g).connect(this.sfxBus); s.start(0, (this.trim[k] ? this.trim[k].s : 0) + offset);
  },
  att(pos, range = 1500){ const g = G.game; if (!g || !g.camera) return 0.5; return Math.max(0, 1 - g.camera.position.distanceTo(pos)/range)**1.6; },

  /* per-frame: player engine follows throttle and speed; a second loop tracks the nearest enemy for flybys; the airship drones */
  frame(game){
    if (!this.ctx) return; const t = this.ctx.currentTime, P = game.player;
    if (this.eng && P) {
      const on = P.alive && game.running && !P.engineDead;
      const sp = P.speed/P.top, rate = 0.72 + P.throttle*0.34 + sp*0.22 - (P.choke > 0 ? 0.25 : 0);
      this.eng.src.playbackRate.setTargetAtTime(rate, t, 0.12); this.eng.g.gain.setTargetAtTime(on ? 0.15 + P.throttle*0.1 : 0, t, 0.15);
    }
    if (this.eng2) {
      let best = null, bd = 900; for (const p of game.planes) if (p.alive && !p.isPlayer) { const d = p.pos.distanceTo(game.camera.position); if (d < bd) { bd = d; best = p; } }
      const a = best ? (1 - bd/900)**1.8 : 0;
      if (best) { const closing = -best.vel.clone().sub(P ? P.vel : best.vel).dot(best.pos.clone().sub(game.camera.position).normalize()); this.eng2.src.playbackRate.setTargetAtTime(Math.max(0.6, 0.95 + closing/700), t, 0.08); }
      this.eng2.g.gain.setTargetAtTime(game.running ? a*0.32 : 0, t, 0.1);
    }
    if (this.shipEng) {
      const s = game.ships[0]; const a = s && s.alive ? Math.max(0, 1 - s.pos.distanceTo(game.camera.position)/900)**1.2 : 0;
      this.shipEng.src.playbackRate.setTargetAtTime(0.36, t, 0.5); this.shipEng.g.gain.setTargetAtTime(s && s.alive ? a*0.16 : 0, t, 0.4);
    }
    // the player's guns: one loop while any gun fires, pitched by the heaviest caliber; the tail rings out on release
    const firing = P && P.alive && P.fire && P.hasAmmo() && game.running;
    if (firing && !this.gun) {
      const heavy = P.guns.filter(g => g.rounds > 0).reduce((m, g) => Math.min(m, g.def.pitch), 2);
      this.gun = this.loop('gunloop', 0.55); if (this.gun) { this.gun.src.playbackRate.value = heavy; this.gunRate = heavy; }
    } else if (!firing && this.gun) {
      const g = this.gun; this.gun = null; g.g.gain.setTargetAtTime(0, t, 0.015); try { g.src.stop(t + 0.08); } catch (e) {}
      this.one('guntail', 0.55, this.gunRate || 1);
    }
  },
  stopAll(){
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const L of [this.eng, this.eng2, this.shipEng]) if (L) L.g.gain.setTargetAtTime(0, t, 0.1);
    if (this.gun) { try { this.gun.src.stop(); } catch (e) {} this.gun = null; }
  },
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
  kick(){ if (this.want && (this.blocked || !this.el || this.el.paused)) { this.blocked = false; const k = this.want; this.cur = null; this.play(k); } }
};
})();
