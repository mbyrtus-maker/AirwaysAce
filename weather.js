/* =====================================================================
   Weather for open skies. Each region has its own kinds of weather and its own odds; a spell of weather lasts a few
   minutes of flying, then blends into the next over about half a minute. The current spell is kept in the save, so
   the chart table can tell you what it's doing over the Margaret, and waiting or sailing on rolls a new one.

   What weather does: thins the view (fog), dims the sun, greys or tints the sky, rain / snow / ash / dust round the
   camera, wind that drifts every plane and bumps yours about, and lightning (with recorded thunder) in storms.
   ===================================================================== */
(() => {
const V3 = THREE.Vector3;
const lerp = (a, b, t) => a + (b - a)*t;

/* fog: multiplier on how far you can see · light: on the sun · sky: how much the sky is covered · wind m/s · turb: bumps */
/* sprites for the weather's motes, painted once: a six-armed snowflake with a soft halo, a grain of blown sand, a curl of ash, and a soft cloud */
const PTEX = {};
function precipTex(kind){
  if (PTEX[kind] !== undefined) return PTEX[kind];
  if (typeof document === 'undefined' || !document.createElement) return (PTEX[kind] = null);
  const N = kind === 'puff' ? 128 : 64, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext && c.getContext('2d'); if (!x) return (PTEX[kind] = null);
  const h = N/2, glow = (r, a) => { const gr = x.createRadialGradient(h, h, 0, h, h, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.beginPath(); x.arc(h, h, r, 0, 7); x.fill(); };
  if (kind === 'snow') {
    glow(h, 0.55); x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineCap = 'round';
    for (let k = 0; k < 6; k++) { const a = k*Math.PI/3, ca = Math.cos(a), sa = Math.sin(a), L = h*0.78; x.lineWidth = 3; x.beginPath(); x.moveTo(h, h); x.lineTo(h + ca*L, h + sa*L); x.stroke();
      x.lineWidth = 2; for (const f of [0.45, 0.7]) { const bx = h + ca*L*f, by = h + sa*L*f, l = L*0.22; for (const s of [-1, 1]) { const b = a + s*0.8; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + Math.cos(b)*l, by + Math.sin(b)*l); x.stroke(); } } }
    glow(h*0.28, 1);
  } else if (kind === 'ash') {
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); for (let k = 0; k < 9; k++) { const a = k/9*Math.PI*2, r = h*(0.35 + 0.35*((k*37) % 7)/7); x.lineTo(h + Math.cos(a)*r, h + Math.sin(a)*r*0.7); } x.closePath(); x.fill(); glow(h*0.9, 0.25);
  } else if (kind === 'dust') {
    glow(h, 0.35); for (let k = 0; k < 7; k++) { const a = k*2.4, r = h*0.25*((k*13) % 5)/5; x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath(); x.arc(h + Math.cos(a)*r, h + Math.sin(a)*r, h*(0.12 + 0.06*(k % 3)), 0, 7); x.fill(); }
  } else {   // a soft cloud: a few overlapping blobs, faded at the edge
    for (let k = 0; k < 9; k++) { const a = k*0.7, r = h*0.32*(k % 3)/2, gx = h + Math.cos(a)*r, gy = h + Math.sin(a)*r*0.7, gr = x.createRadialGradient(gx, gy, 0, gx, gy, h*0.55); gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, N, N); }
  }
  return (PTEX[kind] = new THREE.CanvasTexture(c));
}
const KINDS = {
  clear:    {label:'Clear skies', fog:1, light:1, sky:0, wind:2, turb:0, min:4, max:8, say:'Clear skies. Enjoy it while it lasts.'},
  haze:     {label:'Hazy', fog:0.6, light:0.85, sky:0.25, skyCol:0xd8c8a8, fogCol:0xd8c8a8, wind:3, turb:0.1, min:3, max:6, say:'Haze coming up off the ground. Visibility\'s dropping.'},
  overcast: {label:'Overcast', fog:0.75, light:0.68, sky:0.55, skyCol:0x9aa0a8, fogCol:0xa8acb0, wind:5, turb:0.15, min:3, max:7, say:'Cloud\'s thickening up. Grey for a while.'},
  rain:     {label:'Rain', fog:0.42, light:0.55, sky:0.7, skyCol:0x7a8088, fogCol:0x8a9098, precip:'rain', rate:1, wind:8, turb:0.35, min:3, max:6, say:'Rain coming in. Watch your windscreen.'},
  storm:    {label:'Thunderstorm', fog:0.3, light:0.4, sky:0.85, skyCol:0x4a5058, fogCol:0x5a6068, precip:'rain', rate:1.7, wind:14, turb:0.8, lightning:1, min:2, max:4, say:'Thunderstorm! Lightning about. Keep your head down and your nose up.'},
  fog:      {label:'Fog', fog:0.13, light:0.78, sky:0.55, skyCol:0xc8ccc8, fogCol:0xd0d4d0, wind:1, turb:0, min:3, max:5, say:'Fog\'s rolling in. You won\'t see a mountain till you\'re in it.'},
  dust:     {label:'Dust storm', fog:0.2, light:0.6, sky:0.75, skyCol:0xb88a52, fogCol:0xc0905a, precip:'dust', rate:1.4, wind:17, turb:0.7, min:2, max:4, say:'Dust storm! Half the desert\'s in the air. Hold on to something.'},
  drystorm: {label:'Dry lightning', fog:0.6, light:0.6, sky:0.6, skyCol:0x6a5a58, fogCol:0x9a7a62, wind:10, turb:0.45, lightning:0.7, min:2, max:4, say:'Dry storm over the mesas. Lightning, no rain. Charming.'},
  snow:     {label:'Snow', fog:0.38, light:0.78, sky:0.65, skyCol:0xd8dee6, fogCol:0xe0e6ec, precip:'snow', rate:1, wind:5, turb:0.2, min:3, max:6, say:'Snow\'s starting. Pretty, until it isn\'t.'},
  blizzard: {label:'Blizzard', fog:0.12, light:0.66, sky:0.9, skyCol:0xe6eaee, fogCol:0xeef2f6, precip:'snow', rate:2.4, wind:18, turb:0.9, min:2, max:4, say:'Blizzard! You can\'t see your own prop. Get low, get home, or get lucky.'},
  squall:   {label:'Rain squalls', fog:0.5, light:0.62, sky:0.6, skyCol:0x7a8a96, fogCol:0x8a9aa6, precip:'rain', rate:1.2, wind:12, turb:0.5, min:2, max:5, say:'Squalls coming over the keys. Short and nasty.'},
  tropical: {label:'Tropical storm', fog:0.28, light:0.42, sky:0.88, skyCol:0x4a5a62, fogCol:0x5a6a72, precip:'rain', rate:2, wind:19, turb:0.9, lightning:0.8, min:2, max:4, say:'Tropical storm! The palm trees are lying down. You might want to.'},
  mist:     {label:'Sea mist', fog:0.17, light:0.82, sky:0.45, skyCol:0xc0d0d8, fogCol:0xc8d6dc, wind:2, turb:0, min:3, max:5, say:'Sea mist. Keep an eye on your altimeter, the sea\'s closer than it looks.'},
  ash:      {label:'Ash fall', fog:0.3, light:0.5, sky:0.8, skyCol:0x5a524c, fogCol:0x6a625c, precip:'ash', rate:1.3, wind:6, turb:0.3, min:3, max:5, say:'Cranium\'s coughing. Ash coming down. It gets in everything.'},
  smog:     {label:'Volcanic smog', fog:0.25, light:0.62, sky:0.6, skyCol:0x8a7a5a, fogCol:0x9a8a62, wind:3, turb:0.1, min:3, max:6, say:'Sulphur smog off the Burning Eye. Smells like Hanne\'s laundry.'}
};
/* each region's weather and how likely each spell is; fog and mist favour the morning */
const CLIMATE = {
  halcyon:  {clear:5, overcast:2, rain:2, fog:1, storm:1},
  badlands: {clear:6, haze:2, dust:2, drystorm:1},
  frostback:{clear:3, overcast:2, snow:3, blizzard:1, fog:1},
  keys:     {clear:5, squall:3, mist:1, tropical:1},
  calavera: {clear:3, smog:2, ash:2, storm:2},
  rustwater:{overcast:4, smog:3, rain:3, fog:2, storm:1, clear:1, snow:1}
};
const pick = (region, not) => {
  const C = CLIMATE[region] || CLIMATE.halcyon, h = G.save.open ? G.save.open.hour : 12, morning = h >= 5 && h < 10;
  const list = Object.entries(C).filter(([k]) => k !== not).map(([k, w]) => [k, w*((k === 'fog' || k === 'mist') ? (morning ? 2.5 : 0.5) : 1)]);
  let r = Math.random()*list.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of list) if ((r -= w) <= 0) return k;
  return list[0][0];
};
const span = k => (KINDS[k].min + Math.random()*(KINDS[k].max - KINDS[k].min))*60;

/* the save's current spell, rolled when it doesn't match the region */
const W = G.weather = {
  KINDS, CLIMATE,
  current(region){
    const O = G.save.open; if (!O) return {id:'clear', left:300};
    if (!O.weather || O.weather.region !== region || !KINDS[O.weather.id]) O.weather = {region, id:pick(region), left:0};
    if (!(O.weather.left > 0)) O.weather.left = span(O.weather.id);
    return O.weather;
  },
  reroll(region){ const O = G.save.open; if (O) { O.weather = {region, id:pick(region, O.weather && O.weather.id), left:0}; this.current(region); } },
  label(region){ const w = this.current(region); return `${KINDS[w.id].label}, about ${Math.max(1, Math.round(w.left/60))} min more`; },
  known(region){ return Object.keys(CLIMATE[region] || {}).filter(k => k !== 'clear').map(k => KINDS[k].label.toLowerCase()).join(', '); }
};

/* ---------- weather sound: recorded loops (sounds/), faded to suit the spell ---------- */
const AMB = {rain:'sounds/rain.mp3', storm:'sounds/storm.mp3', wind:'sounds/wind.mp3', blizzard:'sounds/blizzard.mp3', breeze:'sounds/breeze.mp3', waves:'sounds/waves.mp3', canopy:'sounds/canopy.mp3', rumble:'sounds/rumble.mp3'};
const SHOTS = {thunder:'sounds/thunder.mp3', foghorn:'sounds/foghorn.mp3'};
const CRACKS = [0, 5.6, 10.6, 25.8, 34.6, 48.6, 53.6];   // where each thunderclap starts in the thunder recording
const MIX = {clear:{breeze:0.12}, haze:{breeze:0.14, wind:0.03}, overcast:{breeze:0.16, wind:0.05}, rain:{rain:0.5, breeze:0.08}, squall:{rain:0.55, wind:0.25}, storm:{storm:0.65, wind:0.2},
  tropical:{storm:0.65, wind:0.45}, dust:{wind:0.6}, drystorm:{wind:0.35}, snow:{blizzard:0.12, breeze:0.12}, blizzard:{blizzard:0.65}, ash:{wind:0.12, rumble:0.32}, smog:{wind:0.05, breeze:0.06, rumble:0.22},
  fog:{breeze:0.05, waves:0.24}, mist:{breeze:0.08, waves:0.3}};
const SEA = {halcyon:1, keys:1, calavera:1, rustwater:1};   // places where fog means a foghorn and a swell below
const Amb = G.weatherSound = {
  buf:{}, loops:{}, loading:false,
  load(){
    const A = G.audio; if (!A || !A.ctx || this.loading || typeof fetch !== 'function') return; this.loading = true;
    for (const [k, u] of Object.entries(Object.assign({}, AMB, SHOTS))) fetch(u).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => { const p = A.ctx.decodeAudioData(b, ok, no); if (p && p.then) p.then(ok, no); })).then(buf => { this.buf[k] = buf; }).catch(() => {});
  },
  set(k, gain){
    const A = G.audio; if (!A || !A.ctx) return;
    let L = this.loops[k];
    if (!L) { if (!this.buf[k] || gain < 0.01) return; const src = A.ctx.createBufferSource(), g = A.ctx.createGain(); src.buffer = this.buf[k]; src.loop = true; g.gain.value = 0; src.connect(g).connect(A.ambBus || A.sfxBus); src.start(0, Math.random()*this.buf[k].duration*0.8); L = this.loops[k] = {src, g}; }
    L.g.gain.setTargetAtTime(gain, A.ctx.currentTime, 0.8);
  },
  /* a one-off: a thunderclap or a foghorn, from a point in the recording, faded out at the end */
  shot(k, gain, off = 0, dur, rate = 1){
    const A = G.audio, b = this.buf[k]; if (!A || !A.ctx || !b) return false;
    const src = A.ctx.createBufferSource(), g = A.ctx.createGain(), t = A.ctx.currentTime, len = Math.min(dur || b.duration, b.duration - off);
    src.buffer = b; src.playbackRate.value = rate; g.gain.setValueAtTime(gain, t); g.gain.setValueAtTime(gain, t + Math.max(0, len/rate - 1.2)); g.gain.linearRampToValueAtTime(0, t + len/rate);
    src.connect(g).connect(A.ambBus || A.sfxBus); src.start(t, off, len); return true;
  },
  mix(levels){ for (const k of Object.keys(AMB)) this.set(k, levels[k] || 0); },
  silence(){ this.mix({}); }
};

/* ---------- the effect in a game ---------- */
class Sky {
  constructor(g, region, o = {}){
    this.g = g; this.region = region; this.fixed = !!o.id; this.script = o.script || []; const w = g.world, sc = g.scene, night = w.time === 'night', eve = w.time === 'evening';
    this.night = night; this.eve = eve;
    const f = sc.fog; this.base = {near:f.near, far:f.far, col:f.color.clone(), sun:w.sun.intensity, hemi:w.hemi.intensity};
    const st = o.id ? {id:o.id, left:Infinity} : W.current(region); this.id = st.id; this.from = st.id; this.blend = 1; this.left = st.left;
    this.wind = new V3(); this.windDir = Math.random()*Math.PI*2; this.gust = 0; this.bump = new V3(); this.flash = 0; this.boltT = 8;
    // the sky's cover: a tinted dome inside the painted sky
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(12000, 24, 12), new THREE.MeshBasicMaterial({color:0x888888, side:THREE.BackSide, transparent:true, opacity:0, fog:false, depthWrite:false}));
    this.dome.renderOrder = -0.5; this.dome.frustumCulled = false; sc.add(this.dome);
    // precipitation round the camera
    this.N = 1400; this.box = [150, 110, 150];
    const pos = new Float32Array(this.N*6);
    for (let i = 0; i < this.N; i++) for (let k = 0; k < 2; k++) { pos[i*6 + k*3] = (Math.random() - 0.5)*300; pos[i*6 + k*3 + 1] = (Math.random() - 0.5)*220; pos[i*6 + k*3 + 2] = (Math.random() - 0.5)*300; }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({color:night ? 0x8090a8 : 0xc8d4e0, transparent:true, opacity:0, depthWrite:false}));
    this.rain.frustumCulled = false; sc.add(this.rain);
    const pp = new Float32Array(this.N*3); for (let i = 0; i < this.N*3; i++) pp[i] = (Math.random() - 0.5)*300;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    this.flakes = new THREE.Points(pg, new THREE.PointsMaterial({color:0xffffff, size:1.6, transparent:true, opacity:0, depthWrite:false}));
    this.flakes.frustumCulled = false; sc.add(this.flakes);
    // drifting clouds of it on top of the motes: blowing sand, gusts of snow, a pall of ash
    this.NP = 70; const qp = new Float32Array(this.NP*3); for (let i = 0; i < this.NP*3; i++) qp[i] = (Math.random() - 0.5)*300;
    const qg = new THREE.BufferGeometry(); qg.setAttribute('position', new THREE.BufferAttribute(qp, 3));
    this.puffs = new THREE.Points(qg, new THREE.PointsMaterial({color:0xffffff, size:46, transparent:true, opacity:0, depthWrite:false, map:precipTex('puff')}));
    this.puffs.frustumCulled = false; sc.add(this.puffs);
    this.bolt = null; this.apply(0);
    if (!this.fixed && (!G.Net || G.Net.role !== 'guest')) this.anounce(true);
  }
  get k(){ return KINDS[this.id]; }
  anounce(first){
    const K = KINDS[this.id];
    if (first) { if (this.id !== 'clear') setTimeout(() => { if (G.game === this.g) G.HUD.radio(G.RADIO.short, K.say); }, 6500); return; }
    G.HUD.radio(G.RADIO.short, K.say); G.HUD.toast(K.label);
  }
  /* what the weather looks like right now: the outgoing spell blended into the incoming one */
  mix(key){ const a = KINDS[this.from][key] ?? 0, b = KINDS[this.id][key] ?? 0; return lerp(a, b, this.blend); }
  col(key, fallback){ const c = new THREE.Color(KINDS[this.from][key] ?? fallback), d = new THREE.Color(KINDS[this.id][key] ?? fallback); return c.lerp(d, this.blend); }
  change(id, say){ if (id === this.id || !KINDS[id]) return; this.from = this.id; this.id = id; this.blend = 0; if (say !== false) { if (say) G.HUD.radio(G.RADIO.short, say); else this.anounce(); } }
  tick(dt){
    const g = this.g, w = g.world, guest = g.netGuest;
    if (g.paused) return;
    // the clock: the host (or a lone pilot) decides when the spell changes; a co-op guest follows the host's
    if (this.fixed) {   // a story episode's weather: set by the episode, changed only by its script
      if (!guest) { const t = g.mission.pt || 0; while (this.script.length && t >= this.script[0][0]) { const [, id, say] = this.script.shift(); this.change(id, say); } }
    } else if (!guest) {
      this.left -= dt; const O = G.save.open; if (O && O.weather) O.weather.left = this.left;
      if (this.left <= 0) { const n = pick(this.region, this.id); if (O) O.weather = {region:this.region, id:n, left:span(n)}; this.left = O ? O.weather.left : span(n); this.change(n); G.persist(); }
    }
    if (this.blend < 1) this.blend = Math.min(1, this.blend + dt/30);
    this.apply(dt);
  }
  apply(dt){
    const g = this.g, w = g.world, f = g.scene.fog, B = this.base, cam = g.camera.position;
    const fogK = this.mix('fog'), light = this.mix('light'), cover = this.mix('sky'), dark = this.night ? 0.35 : this.eve ? 0.7 : 1;
    // view distance and haze colour
    f.far = B.far*fogK; f.near = Math.min(B.near, f.far*0.25);
    const fc = this.col('fogCol', B.col.getHex()).multiplyScalar(dark), haze = 1 - Math.min(1, fogK);
    f.color.copy(B.col).lerp(fc, Math.min(1, haze*1.4 + cover*0.3));
    // light: a flash of lightning brightens everything for a moment
    this.flash = Math.max(0, this.flash - dt*4);
    w.sun.intensity = B.sun*light + this.flash*1.2; w.hemi.intensity = B.hemi*(0.55 + 0.45*light) + this.flash*1.6;
    if (w.sunObj) w.sunObj.visible = cover < 0.5;
    // the sky's cover
    this.dome.position.copy(cam); this.dome.material.color.copy(this.col('skyCol', 0x888888)).multiplyScalar(dark + this.flash*0.8); this.dome.material.opacity = Math.min(0.92, cover);
    if (w.cloudMesh && w.cloudMesh.material) { const cm = w.cloudMesh.material; if (!cm.userData.base) cm.userData.base = cm.color.clone(); cm.color.copy(cm.userData.base).multiplyScalar(lerp(1, 0.55, cover)); }
    // wind: a slow-turning direction, gusting
    this.windDir += dt*0.01; this.gust += dt*0.6;
    const ws = this.mix('wind')*(0.75 + 0.35*Math.sin(this.gust) + 0.15*Math.sin(this.gust*2.7));
    this.wind.set(Math.sin(this.windDir)*ws, 0, Math.cos(this.windDir)*ws);
    this.precip(dt, cam);
    // sound: blend the outgoing spell's mix into the incoming one; quiet when the sortie's over
    if (G.audio && G.audio.ctx) { Amb.load(); const a = MIX[this.from] || {}, b = MIX[this.id] || {}, L = {}, on = this.g.done ? 0 : 1;
      for (const k of Object.keys(AMB)) L[k] = ((a[k] || 0)*(1 - this.blend) + (b[k] || 0)*this.blend)*on;
      const sea = !!SEA[this.region]; if (!sea) L.waves = 0;
      if (this.region === 'calavera') L.rumble = Math.max(L.rumble || 0, 0.1*on);   // the skull's volcanoes never quite sleep
      // in the cockpit you hear the rain drumming on the canopy rather than the hiss outside
      const wet = Math.min(1, (L.rain || 0)/0.5 + (L.storm || 0)/0.65), inside = this.g.view === 'cockpit' && this.g.player && this.g.player.alive;
      L.canopy = inside ? wet*0.55 : 0; if (inside) { L.rain = (L.rain || 0)*0.35; L.storm = (L.storm || 0)*0.6; }
      Amb.mix(L);
      // a foghorn somewhere out in the murk
      const foggy = sea ? Math.max(this.id === 'fog' || this.id === 'mist' ? this.blend : 0, this.from === 'fog' || this.from === 'mist' ? 1 - this.blend : 0) : 0;
      if (foggy > 0.5 && on && dt > 0) { this.hornT = (this.hornT ?? 8 + Math.random()*10) - dt; if (this.hornT <= 0) { this.hornT = 28 + Math.random()*40; Amb.shot('foghorn', 0.16 + Math.random()*0.14, 0, undefined, 0.9 + Math.random()*0.15); } }
    }
    // lightning
    const L = this.mix('lightning');
    if (L > 0.2 && dt > 0) { this.boltT -= dt*L; if (this.boltT <= 0) { this.boltT = 5 + Math.random()*12; this.strike(cam); } }
    if (this.bolt) { this.bolt.t -= dt; if (this.bolt.t <= 0) { g.scene.remove(this.bolt.m); this.bolt = null; } }
  }
  precip(dt, cam){
    const kind = KINDS[this.id].precip || (this.blend < 1 ? KINDS[this.from].precip : null), rate = this.mix('rate') || 1;
    const fade = KINDS[this.id].precip ? this.blend : 1 - this.blend;
    const isRain = kind === 'rain', on = kind ? Math.min(1, fade)*Math.min(1, rate) : 0, hw = this.box;
    this.rain.material.opacity = isRain ? on*0.5 : 0; this.flakes.material.opacity = !isRain && kind ? on*0.9 : 0;
    const puffK = kind === 'dust' ? 0.2 : kind === 'ash' ? 0.13 : kind === 'snow' && rate > 1.5 ? 0.16 : 0;
    this.puffs.material.opacity = on*puffK;
    if (!kind || dt <= 0) return;
    const wind = this.wind, n = Math.round(this.N*Math.min(1, 0.45 + rate*0.35));
    if (isRain) {
      const a = this.rain.geometry.attributes.position.array, fall = 34, len = 0.06;
      for (let i = 0; i < this.N; i++) {
        const o = i*6; if (i >= n) { a[o + 1] = a[o + 4] = -1e5; continue; }
        let x = a[o] + wind.x*dt, y = a[o + 1] - fall*dt, z = a[o + 2] + wind.z*dt;
        if (x - cam.x > hw[0]) x -= hw[0]*2; if (x - cam.x < -hw[0]) x += hw[0]*2; if (z - cam.z > hw[2]) z -= hw[2]*2; if (z - cam.z < -hw[2]) z += hw[2]*2;
        if (y - cam.y < -hw[1] || y - cam.y > hw[1]) y = cam.y + hw[1]*(Math.random()*0.4 + 0.6);
        a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = x - wind.x*len; a[o + 4] = y + fall*len*2.2; a[o + 5] = z - wind.z*len;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    } else {
      const a = this.flakes.geometry.attributes.position.array, M = this.flakes.material, T = this.g.t;
      const fall = kind === 'snow' ? 4 : kind === 'ash' ? 2.2 : 0.6, side = kind === 'dust' ? 1.8 : 1;
      M.size = kind === 'snow' ? 2.6 : kind === 'ash' ? 2.2 : 1.7;
      M.color.setHex(kind === 'snow' ? 0xffffff : kind === 'ash' ? 0x4a4542 : 0xd2a46a);
      if (M.userData.kind !== kind) { M.userData.kind = kind; M.map = precipTex(kind); M.alphaTest = 0.04; M.needsUpdate = true; }
      // the drifting clouds: big soft billboards tinted to the weather, blown along faster than the motes and rolling as they go
      if (this.puffs.material.opacity > 0) { const q = this.puffs.geometry.attributes.position.array, PM = this.puffs.material, sp = kind === 'dust' ? 2.4 : kind === 'snow' ? 2 : 0.8;
        PM.color.setHex(kind === 'dust' ? 0xc49260 : kind === 'ash' ? 0x55504c : 0xf2f4f8); PM.size = kind === 'dust' ? 52 : 40;
        for (let i = 0; i < this.NP; i++) { const o = i*3; let x = q[o] + wind.x*sp*dt, y = q[o + 1] + Math.sin(T*0.3 + i)*0.6*dt, z = q[o + 2] + wind.z*sp*dt;
          if (x - cam.x > hw[0]) x -= hw[0]*2; if (x - cam.x < -hw[0]) x += hw[0]*2; if (z - cam.z > hw[2]) z -= hw[2]*2; if (z - cam.z < -hw[2]) z += hw[2]*2;
          if (y - cam.y < -hw[1]*0.8 || y - cam.y > hw[1]*0.6) y = cam.y + (Math.random() - 0.6)*hw[1];
          q[o] = x; q[o + 1] = y; q[o + 2] = z; }
        this.puffs.geometry.attributes.position.needsUpdate = true; }
      for (let i = 0; i < this.N; i++) {
        const o = i*3; if (i >= n) { a[o + 1] = -1e5; continue; }
        let x = a[o] + (wind.x*side + Math.sin(T*0.8 + i)*1.2)*dt, y = a[o + 1] - fall*dt, z = a[o + 2] + (wind.z*side + Math.cos(T*0.7 + i)*1.2)*dt;
        if (x - cam.x > hw[0]) x -= hw[0]*2; if (x - cam.x < -hw[0]) x += hw[0]*2; if (z - cam.z > hw[2]) z -= hw[2]*2; if (z - cam.z < -hw[2]) z += hw[2]*2;
        if (y - cam.y < -hw[1] || y - cam.y > hw[1]) y = cam.y + (Math.random() - 0.3)*hw[1]*1.6;
        a[o] = x; a[o + 1] = y; a[o + 2] = z;
      }
      this.flakes.geometry.attributes.position.needsUpdate = true;
    }
  }
  /* a bolt somewhere off in the murk, a flash, and the thunder a few seconds later */
  strike(cam){
    const g = this.g, a = Math.random()*Math.PI*2, d = 1500 + Math.random()*4500, x = cam.x + Math.sin(a)*d, z = cam.z + Math.cos(a)*d;
    const gy = Math.max(g.world.height(x, z), 0), pts = []; let px = x, pz = z;
    for (let y = 1300; y > gy; y -= 70 + Math.random()*60) { pts.push(new V3(px, y, pz)); px += (Math.random() - 0.5)*70; pz += (Math.random() - 0.5)*70; }
    pts.push(new V3(px, gy, pz));
    const geo = new THREE.BufferGeometry().setFromPoints(pts), m = new THREE.Line(geo, new THREE.LineBasicMaterial({color:0xf4f0ff, fog:false}));
    if (this.bolt) g.scene.remove(this.bolt.m);
    g.scene.add(m); this.bolt = {m, t:0.18}; this.flash = 1;
    const delay = d/340*1000, gain = Math.max(0.12, 0.6 - d/9000);
    setTimeout(() => { if (G.game !== g || g.paused) return; if (!Amb.shot('thunder', gain*1.3, G.pick(CRACKS), 4.5 + Math.random()*2, 0.9 + Math.random()*0.15) && g.audio && g.audio.one) try { g.audio.one('boom', gain, 0.42 + Math.random()*0.08); } catch (e) {} }, delay);
  }
  /* push every plane in the air downwind, and bump yours about in rough air */
  drift(dt){
    const g = this.g, w = this.wind, turb = this.mix('turb');
    for (const p of g.planes) {
      if (!p.alive || p.frozen || p.onGround || p.remote) continue;
      p.pos.addScaledVector(w, dt*0.6);
      if (p.isPlayer && turb > 0.05) {
        this.bump.x += ((Math.random() - 0.5)*2 - this.bump.x*0.8)*dt*3; this.bump.z += ((Math.random() - 0.5)*2 - this.bump.z*0.8)*dt*3;
        const k = turb*dt*0.5;
        p.q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(this.bump.x*k, 0, this.bump.z*k*1.4))); p.pos.y += this.bump.x*turb*dt*6;
      }
    }
  }
  dispose(){ const sc = this.g.scene; sc.remove(this.dome); sc.remove(this.rain); sc.remove(this.flakes); sc.remove(this.puffs); if (this.bolt) sc.remove(this.bolt.m); }
}
G.WeatherSky = Sky;

/* story episodes: a mission can set weather:'rain' (and weatherScript:[[seconds, id, radio line]]) for a fixed sky */
G.weatherFor = g => { Amb.silence(); const M = g.mission; if (g.weather || !M || !M.weather) return; g.weather = new Sky(g, M.region || 'halcyon', {id:M.weather, script:(M.weatherScript || []).map(x => x.slice())}); };
/* ---------- hooks: open skies gets weather; the chart shows it; waiting or sailing brings new weather ---------- */
const O = G.MISSIONS.open, setup0 = O.setup;
O.setup = function(g){ setup0.call(this, g); g.weather = new Sky(g, this.R.id); };
const sides0 = O.hudSides;
O.hudSides = function(g){
  const hs = G.HUD.sides, sky = g.weather;
  if (sky) G.HUD.sides = list => hs.call(G.HUD, list.concat([{text:'Weather', st:'live', val:`${KINDS[sky.id].label}${g.netGuest ? '' : ` · ${Math.max(1, Math.ceil(sky.left/60))} min`}`}]));
  try { return sides0.call(this, g); } finally { G.HUD.sides = hs; }
};
const up0 = G.Game.prototype.update;
G.Game.prototype.update = function(dt){
  up0.call(this, dt);
  const s = this.weather; if (!s || this.paused) return;
  s.tick(Math.min(dt, 0.05)); if (this.running) s.drift(Math.min(dt, 0.05));
};
const adv0 = G.advanceHours;
G.advanceHours = n => { adv0(n); if (n > 0 && G.save.open) W.reroll(G.save.open.region); };
// the chart: today's weather over the Margaret, and what each region is known for
if (window.UI && UI.renderChart) {
  const rc = UI.renderChart;
  UI.renderChart = function(){
    rc.apply(this, arguments);
    const S = G.save.open, side = document.getElementById('cSide'), list = side && side.querySelector && side.querySelector('.np-list'); if (!list) return;
    const sel = G.REGIONS[UI.chartSel] || G.REGIONS[S.region], li = document.createElement('li');
    li.innerHTML = sel.id === S.region ? `<b>Weather</b><span>${W.label(sel.id)}.</span>` : `<b>Weather</b><span>Known for ${W.known(sel.id)}.</span>`;
    list.appendChild(li);
  };
}
// co-op: guests follow the host's weather
if (G.Net) {
  const hs0 = G.Net.hostFrame;
  G.Net.hostFrame = function(g, dt){ hs0.call(this, g, dt); if (g.weather && this.links.length && (g.wxT = (g.wxT || 0) - dt) <= 0) { g.wxT = 3; this.broadcast({t:'wx', id:g.weather.id}); } };
  const gm0 = G.Net.guestMsg;
  G.Net.guestMsg = function(m){ if (m && m.t === 'wx' && this.g && this.g.weather && KINDS[m.id]) { this.g.weather.change(m.id); return; } return gm0.call(this, m); };
}
})();
