(function(){
'use strict';
const G = window.G, V3 = THREE.Vector3;

G.rng = function(seed){
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
};
G.Noise = function(seed){
  const r = G.rng(seed), perm = new Uint8Array(512), val = new Float32Array(256);
  const p = []; for (let i = 0; i < 256; i++) { p.push(i); val[i] = r()*2 - 1; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r()*(i+1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const h = (a, b) => val[perm[(perm[a & 255] + b) & 255]];
  const n2 = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf*xf*(3-2*xf), v = zf*zf*(3-2*zf);
    const a = h(xi, zi), b = h(xi+1, zi), c = h(xi, zi+1), d = h(xi+1, zi+1);
    return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v;
  };
  return (x, z, oct = 4) => {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += n2(x*f + i*17.3, z*f - i*9.1)*amp; norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  };
};

/* ---------- Terrain world ---------- */
/* Region looks: tree counts, palette hints, snowline, water colour. */
G.TERRAIN = {
  halcyon:{},
  badlands:{desert:true, conifers:0, broadleaf:520, treeScale:0.55, treeMax:260, rocks:1600, rock:[0.62, 0.32, 0.22], water:0x3b6f7a, beach:2, snow:900},
  frostback:{cold:true, conifers:5200, broadleaf:300, coniferShare:0.95, treeMax:230, rocks:1400, snow:215, water:0x24506a},
  keys:{tropic:true, conifers:0, broadleaf:2400, treeMax:120, rocks:500, beach:9, water:0x1c8fae}
};
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a)/(b - a))); return t*t*(3 - 2*t); };
let DETAIL = null;
function detailTex(){
  if (DETAIL) return DETAIL;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#d2d0cc'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 12000; i++) { const v = 120 + Math.random()*135 | 0; x.fillStyle = `rgba(${v},${v},${v},0.55)`; x.fillRect(Math.random()*256, Math.random()*256, 1 + Math.random()*2, 1 + Math.random()*2); }
  for (let i = 0; i < 110; i++) { x.fillStyle = `rgba(0,0,0,${0.04 + Math.random()*0.08})`; x.beginPath(); x.ellipse(Math.random()*256, Math.random()*256, 6 + Math.random()*24, 4 + Math.random()*14, Math.random()*3, 0, 7); x.fill(); }
  DETAIL = new THREE.CanvasTexture(c); DETAIL.wrapS = DETAIL.wrapT = THREE.RepeatWrapping; DETAIL.repeat.set(260, 260); DETAIL.anisotropy = 8;
  return DETAIL;
}

/* Sea surface: a tileable sketch of wave crests and troughs (grey, so the region's water colour tints it).
   Tiles are ~40 m, so close to the water the waves read clearly and give a sense of height and speed. */
let WATER = null;
function waterTex(){
  if (WATER) return WATER;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), R = G.rng(4242);
  x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, N, N);
  const wave = (cx, cy, w, col, lw) => { x.strokeStyle = col; x.lineWidth = lw; for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { x.beginPath(); x.moveTo(cx - w/2 + ox, cy + oy); x.quadraticCurveTo(cx + ox, cy - w*0.18 + oy, cx + w/2 + ox, cy + oy); x.stroke(); } };
  for (let i = 0; i < 220; i++) wave(R()*N, R()*N, 14 + R()*30, `rgba(70,80,90,${0.18 + R()*0.2})`, 2 + R()*2);     // troughs
  for (let i = 0; i < 260; i++) wave(R()*N, R()*N, 10 + R()*24, `rgba(255,255,255,${0.35 + R()*0.45})`, 1 + R()*1.6);   // crests
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,255,255,${0.5 + R()*0.5})`; x.fillRect(R()*N, R()*N, 1 + R()*2, 1); }   // whitecap flecks
  WATER = new THREE.CanvasTexture(c); WATER.wrapS = WATER.wrapT = THREE.RepeatWrapping; WATER.anisotropy = 8;
  return WATER;
}

G.World = class {
  constructor(scene, opts){
    this.scene = scene; this.noise = G.Noise(opts.seed); this.rand = G.rng(opts.seed + 7);
    this.terr = opts.region || 'halcyon'; this.RT = G.TERRAIN[this.terr] || G.TERRAIN.halcyon;
    this.flats = (opts.flats || []).map(f => Object.assign({}, f));
    for (const f of this.flats) if (f.h === undefined) f.h = Math.max(this.raw(f.x, f.z), 14);
    const S = this.S = 18000, N = this.N = 512, st = this.step = S / N, W = N + 1;
    this.h = new Float32Array(W*W); this.h0 = new Float32Array(W*W);
    // cuts: tunnels (a band along a path) and caverns (an ellipse) are carved down to a floor. h0 keeps the uncut
    // ground, so the rock over a tunnel can be rebuilt exactly as it was (see lidMesh).
    this.cuts = (opts.cuts || []).map(c => { const o = Object.assign({}, c);
      if (o.pts) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of o.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); } o.bb = [x0, x1, z0, z1]; }
      return o; });
    for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) {
      const x = -S/2 + ix*st, z = -S/2 + iz*st;
      let h = this.shape(x, z);
      if (h < 1.6) h -= (1.6 - h)*1.3;   // drop the shoreline away from the waterline so the two never overlap
      this.h0[iz*W + ix] = h;
      const cf = this.cuts.length ? this.cutFloor(x, z, 0) : null;
      this.h[iz*W + ix] = cf === null ? h : Math.min(h, cf);
    }

    const geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI/2);
    const pos = geo.attributes.position, cols = new Float32Array(pos.count*3);
    for (let i = 0; i < pos.count; i++) {
      const ix = i % W, iz = (i / W) | 0, hh = this.h[i], x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, hh);
      const hx1 = this.h[iz*W + Math.min(ix + 1, N)], hx0 = this.h[iz*W + Math.max(ix - 1, 0)];
      const hz1 = this.h[Math.min(iz + 1, N)*W + ix], hz0 = this.h[Math.max(iz - 1, 0)*W + ix];
      const slope = Math.hypot(hx1 - hx0, hz1 - hz0)/(2*st);
      let r, g, b;
      if (hh < this.h0[i] - 0.5) { const k = sm(1, 10, this.h0[i] - hh); [r, g, b] = this.colorAt(x, z, k > 0.5 ? this.h0[i] : hh, k > 0.5 ? 0.9 : slope); const d = 1 - 0.45*k; r *= d; g *= d*0.98; b *= d*0.97; }   // carved floor: darker the deeper the cut
      else [r, g, b] = this.colorAt(x, z, hh, slope);
      cols[i*3] = r; cols[i*3 + 1] = g; cols[i*3 + 2] = b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    this.terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({vertexColors:true, map:detailTex(), roughness:0.97, metalness:0}));
    this.terrain.receiveShadow = true; scene.add(this.terrain);

    const wt = this.waterTex = waterTex().clone(); wt.needsUpdate = true; wt.repeat.set(S*4/40, S*4/40);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(S*4, S*4).rotateX(-Math.PI/2),
      new THREE.MeshStandardMaterial({color:this.RT.water || 0x1f6f9e, map:wt, roughness:0.3, metalness:0.18}));   // deep lagoon blue with a sun glint
    water.position.y = 0.4; water.receiveShadow = false; scene.add(water);

    this.time = opts.time || 'day';
    this.buildSky(); this.buildTrees(); this.buildRocks(); this.buildClouds();
  }
  /* terrain colour at a point: the region palette by height and slope (shared by the ground and the rebuilt rock over tunnels) */
  colorAt(x, z, hh, slope){
    const n = this.noise;
    const v1 = n(x*0.0035, z*0.0035, 3), v2 = n(x*0.025 + 9, z*0.025, 2), lum = 0.92 + v2*0.16;
    const dry = sm(-0.25, 0.35, v1 + (hh - 60)/400);
    // Matinee palette: lush meadow green that ripens to golden grass, deep forest floor, warm ochre earth, pale sand.
    let r = (0.31 + 0.30*dry)*lum, g = (0.54 + 0.03*dry)*lum, b = (0.19 + 0.06*dry)*lum;
    const RT = this.RT;
    if (RT.desert) {
      // red-rock country: banded sandstone with pale sage scrub on the flats
      const band = 0.88 + 0.14*Math.sin(hh*0.16 + v1*2.2);
      r = 0.72*band*lum; g = 0.46*band*lum; b = 0.30*band*lum;
      const scrub = sm(0.05, 0.4, n(x*0.004 + 31, z*0.004 - 17, 3))*(1 - sm(0.25, 0.5, slope));
      r += (0.55 - r)*scrub*0.45; g += (0.52 - g)*scrub*0.45; b += (0.34 - b)*scrub*0.45;
    } else {
      if (RT.cold) { r *= 0.86; g *= 0.94; b *= 1.05; }
      const forest = sm(0.0, 0.2, n(x*0.003 + 31, z*0.003 - 17, 3));
      r -= 0.10*forest; g -= 0.10*forest; b -= 0.05*forest;
      const mud = sm(0.12, 0.42, n(x*0.0075 + 50, z*0.0075 - 80, 3))*0.6;
      r += (0.60*lum - r)*mud*0.6; g += (0.44*lum - g)*mud*0.6; b += (0.26*lum - b)*mud*0.6;
    }
    const sand = sm(RT.beach || 4, 0.5, hh);
    r += (0.93 - r)*sand; g += (0.84 - g)*sand; b += (0.6 - b)*sand;
    if (hh < -2) { const w = sm(-2, -12, hh); r += (0.33 - r)*w; g += (0.35 - g)*w; b += (0.3 - b)*w; }
    const rock = Math.min(1, sm(0.32, 0.7, slope) + sm(170, 245, hh)*0.55);
    const rl = 0.9 + v2*0.2, rc = RT.rock || [0.56, 0.49, 0.42]; r += (rc[0]*rl - r)*rock; g += (rc[1]*rl - g)*rock; b += (rc[2]*rl - b)*rock;   // warm sandstone grey
    const snow = sm(RT.snow || 340, (RT.snow || 340) + 60, hh + v1*40)*(1 - sm(0.7, 1.0, slope));
    r += (0.95 - r)*snow; g += (0.96 - g)*snow; b += (1.0 - b)*snow;
    const fs = this.flatW(x, z);
    if (fs > 0) { const fl = 0.82 + v2*0.2; r += (0.37*fl - r)*fs; g += (0.36*fl - g)*fs; b += (0.335*fl - b)*fs; }   // oil-stained hardstand
    return [r, g, b];
  }
  /* is (x,z) inside a cut (plus a margin)? returns that cut's floor, or null */
  cutFloor(x, z, m = 0){
    for (const c of this.cuts) {
      if (c.ell) { const e = c.ell, dx = x - e.x, dz = z - e.z, lx = dx*e.ax[0] + dz*e.ax[1], lz = -dx*e.ax[1] + dz*e.ax[0];   // ax: the major axis
        if ((lx/(e.rx + m))**2 + (lz/(e.rz + m))**2 <= 1) return c.floor; continue; }
      const bb = c.bb, r = c.hw + m; if (x < bb[0] - r || x > bb[1] + r || z < bb[2] - r || z > bb[3] + r) continue;
      for (let i = 0; i < c.pts.length - 1; i++) {
        const a = c.pts[i], b = c.pts[i + 1], ex = b.x - a.x, ez = b.z - a.z, L2 = ex*ex + ez*ez || 1, t0 = ((x - a.x)*ex + (z - a.z)*ez)/L2, t = Math.max(0, Math.min(1, t0));
        if (c.flat && ((i === 0 && t0 < 0) || (i === c.pts.length - 2 && t0 > 1))) continue;   // square ends: stop at the mouth, don't bulge past it
        const px = a.x + ex*t - x, pz = a.z + ez*t - z; if (px*px + pz*pz <= r*r) return c.floor;
      }
    }
    return null;
  }
  /* slope of the uncut ground, measured the way the terrain colours measure it (across two grid steps) */
  slope0(x, z){ const d = this.step; return Math.hypot(this.height0(x + d, z) - this.height0(x - d, z), this.height0(x, z + d) - this.height0(x, z - d))/(2*d); }
  /* the ground as it was before any cut, interpolated exactly like the rendered terrain */
  height0(x, z){
    const S = this.S, st = this.step, N = this.N, W = N + 1;
    let fx = (x + S/2)/st, fz = (z + S/2)/st;
    fx = Math.min(Math.max(fx, 0), N - 0.0001); fz = Math.min(Math.max(fz, 0), N - 0.0001);
    const ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz, H = this.h0;
    const ha = H[iz*W + ix], hb = H[(iz + 1)*W + ix], hc = H[(iz + 1)*W + ix + 1], hd = H[iz*W + ix + 1];
    return u + v <= 1 ? ha + (hd - ha)*u + (hb - ha)*v : hc + (hb - hc)*(1 - u) + (hd - hc)*(1 - v);
  }
  raw(x, z){
    const n = this.noise;
    const wx = x + n(x*0.0004 + 3, z*0.0004, 3)*650, wz = z + n(x*0.0004, z*0.0004 + 7, 3)*650;
    if (this.terr === 'badlands') return this.rawBadlands(x, z, wx, wz);
    if (this.terr === 'frostback') return this.rawFrost(x, z, wx, wz);
    if (this.terr === 'keys') return this.rawKeys(x, z, wx, wz);
    // Mostly broad, rolling lowland with a few gentle hills...
    let h = 30 + n(wx*0.00038, wz*0.00038, 4)*70;
    h += n(x*0.0016 + 5, z*0.0016 - 9, 3)*17;
    // ...and only a couple of mountain massifs, confined by a sparse low-frequency mask.
    const mk = Math.min(1, Math.max(0, (n(wx*0.0002 + 17, wz*0.0002 - 5, 2) - 0.12)/0.3)), m = mk*mk*(3 - 2*mk);
    if (m > 0) { const rr = 1 - Math.abs(n(wx*0.0009 + 40, wz*0.0009 - 20, 4)); h += m*(70 + rr*rr*120); }
    h += n(x*0.006, z*0.006, 2)*2.5 + n(x*0.022, z*0.022, 2)*0.5;
    const d = Math.hypot(x, z);
    // Island: a wobbly coastline around 1.9-2.4 km, then the sea floor drops away.
    const coast = 4700 + n(Math.cos(Math.atan2(z, x))*1.7 + 9, Math.sin(Math.atan2(z, x))*1.7 - 4, 3)*800;
    if (d > coast - 250) { const k = Math.min(1, (d - coast + 250)/250); h = h*(1 - k*0.6) - Math.max(0, d - coast)*0.32 - k*6; }
    h = Math.max(h, -70);
    return h;
  }
  /* Red Mesa Badlands: flat-topped mesas with sheer sides, river canyons cut down to the water. */
  rawBadlands(x, z, wx, wz){
    const n = this.noise;
    let h = 64 + n(wx*0.0003, wz*0.0003, 3)*40;
    h += sm(0.02, 0.09, n(wx*0.0011 + 11, wz*0.0011 - 3, 3))*95;           // first mesa tier
    h += sm(0.30, 0.36, n(wx*0.0016 + 70, wz*0.0016 + 13, 3))*55;           // buttes on top
    const cv = Math.abs(n(wx*0.0006 + 50, wz*0.0006 + 20, 3)); h -= sm(0.09, 0.0, cv)*120;   // canyons
    h += n(x*0.006, z*0.006, 2)*2.5 + n(x*0.03, z*0.03, 2)*0.6;
    const d = Math.hypot(x, z); if (d > 7200) h -= (d - 7200)*0.12;
    return Math.max(h, -40);
  }
  /* Frostback Range: a ring of snow peaks around long glacial valleys and a lake. */
  rawFrost(x, z, wx, wz){
    const n = this.noise;
    let h = 50 + n(wx*0.00035, wz*0.00035, 4)*60;
    const mk = sm(-0.35, 0.25, n(wx*0.00025 + 17, wz*0.00025 - 5, 2)), rr = 1 - Math.abs(n(wx*0.0008 + 40, wz*0.0008 - 20, 4));
    h += mk*(40 + rr*rr*300);
    h += n(x*0.005, z*0.005, 2)*5 + n(x*0.022, z*0.022, 2)*0.8;
    const lk = Math.hypot(x - 600, z + 300); if (lk < 1400) h -= sm(1400, 500, lk)*Math.max(0, h + 18);   // the lake
    const d = Math.hypot(x, z); if (d > 7000) h -= (d - 7000)*0.2;
    return Math.max(h, -60);
  }
  /* Corsair Keys: a scatter of low islands in warm shallow water. */
  rawKeys(x, z, wx, wz){
    const n = this.noise;
    const isl = n(wx*0.00085 + 5, wz*0.00085 - 7, 4) + n(x*0.0022, z*0.0022, 2)*0.18;
    let h = (isl - 0.16)*170;
    if (h > 0) h = h*0.7 + Math.max(0, n(x*0.0025 + 3, z*0.0025, 3))*80*sm(0, 30, h);
    h += n(x*0.02, z*0.02, 2)*0.8;
    return Math.max(h, -36);
  }
  flatW(x, z){
    let w = 0;
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r*1.8) { const t = d < f.r ? 1 : 1 - (d - f.r)/(f.r*0.8); w = Math.max(w, t*t*(3 - 2*t)); }
    }
    return w;
  }
  shape(x, z){
    let h = this.raw(x, z);
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r*1.8) { const t = d < f.r ? 1 : 1 - (d - f.r)/(f.r*0.8); const s = t*t*(3 - 2*t); h = h*(1 - s) + f.h*s; }
    }
    return h;
  }
  height(x, z, bare){
    const S = this.S, st = this.step, N = this.N, W = N + 1;
    let fx = (x + S/2)/st, fz = (z + S/2)/st;
    fx = Math.min(Math.max(fx, 0), N - 0.0001); fz = Math.min(Math.max(fz, 0), N - 0.0001);
    const ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz, H = this.h;
    const ha = H[iz*W + ix], hb = H[(iz + 1)*W + ix], hc = H[(iz + 1)*W + ix + 1], hd = H[iz*W + ix + 1];
    const h = u + v <= 1 ? ha + (hd - ha)*u + (hb - ha)*v : hc + (hb - hc)*(1 - u) + (hd - hc)*(1 - v);
    if (bare) return h;
    if (this.bgrid) { const r = this.roof(x, z); if (r > h) return r; }
    const cv = this.carrier;
    if (cv) {
      const lx = x - cv.x, lz = z - cv.z;
      if (lx > 29 && lx < 47 && lz > 6 && lz < 74) return cv.deck + 46;
      if (lx > -49 && lx < 49 && lz > -288 && lz < 304) return Math.max(h, cv.deck);
    }
    return h;
  }
  /* ---- Solid buildings: roofs count as ground, walls push things out, both block line of sight ---- */
  addBlocker(b){
    const g = this.bgrid || (this.bgrid = new Map()), C = 64;
    for (let cx = Math.floor((b.x - b.hw)/C); cx <= Math.floor((b.x + b.hw)/C); cx++)
      for (let cz = Math.floor((b.z - b.hd)/C); cz <= Math.floor((b.z + b.hd)/C); cz++) {
        const k = cx*100003 + cz; if (!g.has(k)) g.set(k, []); g.get(k).push(b);
      }
    return b;
  }
  roof(x, z){
    if (!this.bgrid) return -1e9;
    const L = this.bgrid.get(Math.floor(x/64)*100003 + Math.floor(z/64)); if (!L) return -1e9;
    let t = -1e9; for (const b of L) if (Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd && b.top > t) t = b.top;
    return t;
  }
  pushOut(pos, rad, feet){
    if (!this.bgrid) return false;
    const seen = new Set(); let pushed = false;
    for (const ox of [-rad, rad]) for (const oz of [-rad, rad]) {
      const L = this.bgrid.get(Math.floor((pos.x + ox)/64)*100003 + Math.floor((pos.z + oz)/64)); if (!L) continue;
      for (const b of L) {
        if (seen.has(b)) continue; seen.add(b);
        if (feet > b.top - 1.5) continue;
        const dx = pos.x - b.x, dz = pos.z - b.z, px = b.hw + rad - Math.abs(dx), pz = b.hd + rad - Math.abs(dz);
        if (px <= 0 || pz <= 0) continue;
        if (px < pz) pos.x += Math.sign(dx || 1)*px; else pos.z += Math.sign(dz || 1)*pz;
        pushed = true;
      }
    }
    return pushed;
  }
  los(a, b){
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (d < 20) return true;
    const n = Math.ceil(d/10);
    for (let i = 1; i < n; i++) {
      const t = i/n; if (t*d < 9 || (1 - t)*d < 9) continue;
      const x = a.x + dx*t, z = a.z + dz*t;
      if (a.y + dy*t < this.height(x, z) - 0.8) return false;
    }
    return true;
  }
  slope(x, z){ return Math.hypot(this.height(x + 6, z) - this.height(x - 6, z), this.height(x, z + 6) - this.height(x, z - 6))/12; }
  buildSky(){
    // Late-afternoon sky: deep blue overhead, pale blue mid-sky, warm cream haze at the horizon, and a golden bloom around the sun.
    const R = 16000, g = new THREE.SphereGeometry(R, 48, 24), c = [], tmp = new THREE.Color();
    // evening: the sun sits a few degrees over the horizon, the sky runs from indigo down to a burnt-orange haze
    const EVE = this.time === 'evening', NIGHT = this.time === 'night';
    if (NIGHT) return this.buildNight(R, g, c, tmp);
    const top = new THREE.Color(EVE ? 0x1d2f63 : 0x2c68bd), mid = new THREE.Color(EVE ? 0x8d6f9a : 0x77b6e8), hor = new THREE.Color(EVE ? 0xf4a467 : 0xf0dfc0), glow = new THREE.Color(EVE ? 0xffb35c : 0xffe6b0);
    const sd = this.sunDir = (EVE ? new V3(-0.74, 0.11, -0.66) : new V3(-0.58, 0.60, -0.42)).normalize();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)/R, y = p.getY(i)/R, z = p.getZ(i)/R, t = Math.max(0, y);
      tmp.copy(hor).lerp(mid, sm(0, 0.22, t)).lerp(top, sm(0.15, 0.85, t));
      const d = Math.max(0, x*sd.x + y*sd.y + z*sd.z);
      tmp.lerp(glow, Math.min(1, Math.pow(d, 10)*0.6 + Math.pow(d, 3)*0.12*(1 - t)));
      c.push(tmp.r, tmp.g, tmp.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.BackSide, fog:false, depthWrite:false}));
    sky.renderOrder = -1; sky.frustumCulled = false; this.scene.add(sky); this.sky = sky;
    // Sun: a hard disc inside two soft additive halos. The dome and the sun ride along with the player (see follow), so they never drift.
    const sun = this.sunObj = new THREE.Group();
    for (const [rad, dist, col, op] of EVE ? [[560, 14000, 0xffd08a, 1], [1100, 13950, 0xff9f55, 0.38], [2600, 13900, 0xff8a4a, 0.18]] : [[430, 14000, 0xfff4d2, 1], [820, 13950, 0xffe2a0, 0.34], [1700, 13900, 0xffd890, 0.14]]) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 28), new THREE.MeshBasicMaterial(op < 1 ? {color:col, fog:false, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false} : {color:col, fog:false}));
      m.position.copy(sd).multiplyScalar(dist); m.lookAt(0, 0, 0); m.frustumCulled = false; sun.add(m);
    }
    this.scene.add(sun);
    this.scene.fog = EVE ? new THREE.Fog(0xe39a6c, 1200, 12000) : new THREE.Fog(0xf0dfc0, 1500, 14000);   // haze matches the horizon band
    // Warm key, cool fill. Sunlit faces come out near 1.4x their paint colour, faces in shade near 0.5x.
    this.scene.add(this.hemi = EVE ? new THREE.HemisphereLight(0x8e8fc4, 0x5a4232, 0.62) : new THREE.HemisphereLight(0xbcd4f0, 0x8f8672, 0.8));
    const d = this.sun = new THREE.DirectionalLight(EVE ? 0xff9e58 : 0xffe2b0, EVE ? 1.3 : 1.35);
    d.castShadow = true; d.shadow.mapSize.set(2048, 2048);
    const sc = d.shadow.camera; sc.left = -240; sc.right = 240; sc.top = 240; sc.bottom = -240; sc.near = 20; sc.far = 1600;
    d.shadow.bias = -0.0004; d.shadow.normalBias = 0.5;
    this.scene.add(d); this.scene.add(d.target);
  }
  /* Moonlit night: navy dome, a cold full moon, stars, dark-blue haze. Light is kept bright enough to fly by. */
  buildNight(R, g, c, tmp){
    const top = new THREE.Color(0x060a1a), mid = new THREE.Color(0x14204a), hor = new THREE.Color(0x2f3f68), glow = new THREE.Color(0xc8d4ff);
    const sd = this.sunDir = new V3(0.5, 0.52, -0.55).normalize(), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)/R, y = p.getY(i)/R, z = p.getZ(i)/R, t = Math.max(0, y);
      tmp.copy(hor).lerp(mid, sm(0, 0.2, t)).lerp(top, sm(0.15, 0.8, t));
      const d = Math.max(0, x*sd.x + y*sd.y + z*sd.z); tmp.lerp(glow, Math.min(1, Math.pow(d, 40)*0.5 + Math.pow(d, 6)*0.08));
      c.push(tmp.r, tmp.g, tmp.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.BackSide, fog:false, depthWrite:false}));
    sky.renderOrder = -1; sky.frustumCulled = false; this.scene.add(sky); this.sky = sky;
    const sun = this.sunObj = new THREE.Group();
    for (const [rad, dist, col, op] of [[300, 14000, 0xeef2ff, 1], [700, 13950, 0xb8c8ff, 0.22], [1600, 13900, 0x8ea4e8, 0.08]]) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 28), new THREE.MeshBasicMaterial(op < 1 ? {color:col, fog:false, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false} : {color:col, fog:false}));
      m.position.copy(sd).multiplyScalar(dist); m.lookAt(0, 0, 0); m.frustumCulled = false; sun.add(m);
    }
    // stars: a fixed field on the upper dome, riding with the sky
    const sp = [], rnd = G.rng(99);
    for (let i = 0; i < 1800; i++) { const a = rnd()*Math.PI*2, y = 0.08 + Math.pow(rnd(), 0.7)*0.92, r = Math.sqrt(1 - y*y); sp.push(Math.cos(a)*r*13500, y*13500, Math.sin(a)*r*13500); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({color:0xdfe6ff, size:1.6, sizeAttenuation:false, fog:false, transparent:true, opacity:0.85, depthWrite:false}));
    stars.frustumCulled = false; sun.add(stars);
    this.scene.add(sun);
    this.scene.fog = new THREE.Fog(0x1b2645, 900, 9500);
    this.scene.add(this.hemi = new THREE.HemisphereLight(0x6070a8, 0x1c1e28, 0.62));
    const d = this.sun = new THREE.DirectionalLight(0xb4c4ff, 0.62);
    d.castShadow = true; d.shadow.mapSize.set(2048, 2048);
    const sc = d.shadow.camera; sc.left = -240; sc.right = 240; sc.top = 240; sc.bottom = -240; sc.near = 20; sc.far = 1600;
    d.shadow.bias = -0.0004; d.shadow.normalBias = 0.5;
    this.scene.add(d); this.scene.add(d.target);
  }
  follow(p){
    // Snap the shadow camera to whole shadow-map texels so shadows don't shimmer as you move.
    const tx = 480/2048, q = this.snapP || (this.snapP = new V3());
    q.set(Math.round(p.x/tx)*tx, Math.round(p.y/tx)*tx, Math.round(p.z/tx)*tx);
    this.sun.position.copy(q).addScaledVector(this.sunDir, 800); this.sun.target.position.copy(q); this.sun.target.updateMatrixWorld();
    if (this.sky) this.sky.position.copy(p);
    if (this.waterTex) { const t = performance.now()*0.001; this.waterTex.offset.set(t*0.0009, t*0.0005); }   // the sea drifts slowly
    if (this.sunObj) this.sunObj.position.copy(p);
  }
  buildTrees(){
    const RT = this.RT, NC = RT.conifers ?? 4200, NB = RT.broadleaf ?? 1700, R = this.rand, n = this.noise, tmax = RT.treeMax || 205;
    // Chunky faceted trees: three stacked six-sided cones for a conifer, one low-poly ball for a broadleaf.
    const layer = (r, h, y) => new THREE.ConeGeometry(r, h, 6).translate(0, y, 0);
    const conM = new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.9, flatShading:true});
    const trunkM = new THREE.MeshStandardMaterial({color:0x5a4030, roughness:1, flatShading:true});
    const meshes = [
      new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.6, 5, 5, 1, true).translate(0, 2.5, 0), trunkM, Math.max(1, NC + NB)),
      new THREE.InstancedMesh(layer(4.2, 6.5, 5.2), conM, Math.max(1, NC)), new THREE.InstancedMesh(layer(3.2, 6, 8.6), conM, Math.max(1, NC)), new THREE.InstancedMesh(layer(2.1, 5.2, 11.9), conM, Math.max(1, NC)),
      new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.9, flatShading:true}), Math.max(1, NB))
    ];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), col = new THREE.Color(), up = new V3(0, 1, 0);
    let kc = 0, kb = 0, kt = 0;
    for (let i = 0; i < (NC + NB)*6 && (kc < NC || kb < NB); i++) {
      const a = R()*Math.PI*2, d = Math.sqrt(R())*5600, x = Math.sin(a)*d, z = Math.cos(a)*d, h = this.height(x, z);
      if (h < 5 || h > tmax || this.flatW(x, z) > 0.05 || this.slope(x, z) > 0.55 || (this.cuts.length && this.cutFloor(x, z, 70) !== null)) continue;
      const dens = n(x*0.003 + 31, z*0.003 - 17, 3);
      if (dens < -0.08 && R() > 0.12) continue;
      const conifer = NB === 0 ? true : NC === 0 ? false : h > 120 ? R() < 0.92 : R() < (RT.coniferShare ?? 0.55);
      const sc = (0.7 + R()*0.8)*1.3*(RT.treeScale || 1);   // a little oversized so woods still read from the air
      q.setFromAxisAngle(up, R()*6.28);
      if (conifer && kc < NC) {
        s.set(sc, sc*(0.9 + R()*0.3), sc); m.compose(new V3(x, h - 0.3, z), q, s);
        meshes[0].setMatrixAt(kt++, m); for (let L = 1; L <= 3; L++) meshes[L].setMatrixAt(kc, m);
        col.setRGB(0.12 + R()*0.05, 0.29 + R()*0.08, 0.15 + R()*0.05); for (let L = 1; L <= 3; L++) meshes[L].setColorAt(kc, col); kc++;
      } else if (!conifer && kb < NB) {
        s.set(sc*0.9, sc, sc*0.9); m.compose(new V3(x, h - 0.3, z), q, s); meshes[0].setMatrixAt(kt++, m);
        const r = (3.6 + R()*1.8)*sc; s.set(r, r*(0.8 + R()*0.3), r); m.compose(new V3(x, h + 5*sc + r*0.6, z), q, s); meshes[4].setMatrixAt(kb, m);
        if (RT.desert) col.setRGB(0.42 + R()*0.08, 0.46 + R()*0.08, 0.28 + R()*0.05);
        else if (RT.tropic) col.setRGB(0.18 + R()*0.08, 0.55 + R()*0.12, 0.2 + R()*0.06);
        else if (R() < 0.14) col.setRGB(0.62 + R()*0.1, 0.44 + R()*0.08, 0.13 + R()*0.03); else col.setRGB(0.25 + R()*0.1, 0.42 + R()*0.1, 0.14 + R()*0.05);
        meshes[4].setColorAt(kb, col); kb++;   // one in seven has turned gold
      }
    }
    meshes[0].count = kt; for (let L = 1; L <= 3; L++) meshes[L].count = kc; meshes[4].count = kb;
    // Instances are spread over the whole island, so the per-mesh bounding sphere is meaningless: never frustum-cull them.
    for (const me of meshes) { me.castShadow = true; me.receiveShadow = true; me.frustumCulled = false; this.scene.add(me); }
  }
  buildRocks(){
    const N = this.RT.rocks || 1000, R = this.rand, mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.95, flatShading:true}), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), col = new THREE.Color(); let k = 0;
    for (let i = 0; i < N*8 && k < N; i++) {
      const a = R()*Math.PI*2, d = Math.sqrt(R())*5600, x = Math.sin(a)*d, z = Math.cos(a)*d, h = this.height(x, z);
      if (h < 2 || this.flatW(x, z) > 0.05 || (this.cuts.length && this.cutFloor(x, z, 60) !== null)) continue;
      const sl = this.slope(x, z); if (sl < 0.25 && R() > 0.25) continue;
      const sc = 1.5 + R()*R()*9; s.set(sc*(0.8 + R()*0.6), sc*(0.5 + R()*0.5), sc*(0.8 + R()*0.6));
      q.setFromEuler(new THREE.Euler(R()*3, R()*3, R()*3)); m.compose(new V3(x, h + sc*0.15, z), q, s); mesh.setMatrixAt(k, m);
      const v = 0.4 + R()*0.14; if (this.RT.desert) col.setRGB(v*1.35, v*0.85, v*0.6); else col.setRGB(v, v*0.9, v*0.8); mesh.setColorAt(k, col); k++;
    }
    mesh.count = k; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; this.scene.add(mesh);
  }
  buildClouds(){
    // Fair-weather cumulus between 900 and 1600 m: faceted puffs with their undersides sliced flat, heaped highest in the middle.
    // All puffs share one InstancedMesh (one draw call); this.clouds keeps each cloud's centre, size and puff count.
    const geo = new THREE.IcosahedronGeometry(1, 1), gp = geo.attributes.position;
    for (let i = 0; i < gp.count; i++) if (gp.getY(i) < -0.3) gp.setY(i, -0.3);
    geo.computeVertexNormals();
    const mat = this.time === 'night' ? new THREE.MeshStandardMaterial({color:0x5a6488, flatShading:true, roughness:1, emissive:0x141a30, emissiveIntensity:0.5}) : this.time === 'evening' ? new THREE.MeshStandardMaterial({color:0xffd2b0, flatShading:true, roughness:1, emissive:0x6a4a6e, emissiveIntensity:0.4}) : new THREE.MeshStandardMaterial({color:0xffffff, flatShading:true, roughness:1, emissive:0x7f8fb0, emissiveIntensity:0.35});
    const N = 110, mesh = new THREE.InstancedMesh(geo, mat, N*11);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), pos = new V3(), col = new THREE.Color(), up = new V3(0, 1, 0), R = this.rand;
    this.clouds = []; let k = 0;
    for (let i = 0; i < N; i++) {
      const x = (R() - 0.5)*17000, z = (R() - 0.5)*17000, y = 900 + R()*700, sc = 0.7 + R()*1.2, parts = 5 + Math.floor(R()*6);
      for (let j = 0; j < parts; j++) {
        const u = j === 0 ? 0 : (R() - 0.5)*2, w = j === 0 ? 0 : (R() - 0.5)*2, edge = Math.min(1, Math.hypot(u, w));
        const r = (j === 0 ? 105 : 48 + R()*52)*sc*(1 - 0.35*edge), sy = r*(0.75 + R()*0.35);
        s.set(r*(1.1 + R()*0.4), sy, r*(1 + R()*0.4)); q.setFromAxisAngle(up, R()*6.28);
        pos.set(x + u*135*sc, y + 0.3*sy + R()*8, z + w*100*sc); m.compose(pos, q, s); mesh.setMatrixAt(k, m);
        const v = 0.93 + R()*0.07; col.setRGB(v, v*0.99, v*0.97); mesh.setColorAt(k, col); k++;
      }
      this.clouds.push({x, y, z, size:sc, puffs:parts});
    }
    mesh.count = k; mesh.frustumCulled = false; this.scene.add(mesh); this.cloudMesh = mesh;
  }
};

/* ---------- Particles ---------- */
const VS = `#include <common>
#include <logdepthbuf_pars_vertex>
attribute float size; attribute vec4 pcol; varying vec4 vC; uniform float scale;
void main(){ vC = pcol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*scale/max(0.5,-mv.z); gl_Position = projectionMatrix*mv;
#include <logdepthbuf_vertex>
}`;
const FS = `#include <logdepthbuf_pars_fragment>
varying vec4 vC; void main(){
#include <logdepthbuf_fragment>
vec2 c = gl_PointCoord-0.5; float d = length(c); if(d>0.5) discard; float a = smoothstep(0.5,0.12,d); gl_FragColor = vec4(vC.rgb, vC.a*a); }`;

G.Particles = class {
  constructor(scene, max, additive){
    this.max = max; this.i = 0;
    this.p = new Float32Array(max*3); this.c = new Float32Array(max*4); this.s = new Float32Array(max);
    this.v = new Float32Array(max*3); this.l = new Float32Array(max); this.L = new Float32Array(max);
    this.gr = new Float32Array(max); this.a0 = new Float32Array(max); this.dr = new Float32Array(max); this.up = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('pcol', new THREE.BufferAttribute(this.c, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.s, 1));
    this.mat = new THREE.ShaderMaterial({uniforms:{scale:{value:600}}, vertexShader:VS, fragmentShader:FS, transparent:true, depthWrite:false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending});
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts); this.g = g;
  }
  emit(x,y,z, vx,vy,vz, size, life, r,g,b,a, grow=0, drag=0, up=0){
    const i = this.i; this.i = (i + 1) % this.max;
    this.p[i*3]=x; this.p[i*3+1]=y; this.p[i*3+2]=z; this.v[i*3]=vx; this.v[i*3+1]=vy; this.v[i*3+2]=vz;
    this.s[i]=size; this.l[i]=life; this.L[i]=life; this.c[i*4]=r; this.c[i*4+1]=g; this.c[i*4+2]=b; this.c[i*4+3]=a;
    this.a0[i]=a; this.gr[i]=grow; this.dr[i]=drag; this.up[i]=up;
  }
  update(dt){
    const p = this.p, v = this.v;
    for (let i = 0; i < this.max; i++) {
      if (this.l[i] <= 0) continue;
      this.l[i] -= dt;
      if (this.l[i] <= 0) { this.s[i] = 0; this.c[i*4+3] = 0; continue; }
      const k = Math.max(0, 1 - this.dr[i]*dt);
      v[i*3] *= k; v[i*3+1] = v[i*3+1]*k + this.up[i]*dt; v[i*3+2] *= k;
      p[i*3] += v[i*3]*dt; p[i*3+1] += v[i*3+1]*dt; p[i*3+2] += v[i*3+2]*dt;
      this.s[i] = Math.max(0, this.s[i] + this.gr[i]*dt);
      this.c[i*4+3] = this.a0[i]*(this.l[i]/this.L[i]);
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.pcol.needsUpdate = true; this.g.attributes.size.needsUpdate = true;
  }
};

const R = () => Math.random() - 0.5;
G.FX = class {
  constructor(scene){
    this.scene = scene;
    this.smoke = new G.Particles(scene, 3200, false);
    this.fire = new G.Particles(scene, 2600, true);
    this.beams = []; this.burners = []; this.lights = []; this.li = 0;
    for (let i = 0; i < 3; i++) { const L = new THREE.PointLight(0xffa255, 0, 320, 2); scene.add(L); this.lights.push({L, t:0}); }
    this.beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); this.beamGeo.rotateX(Math.PI/2); this.beamGeo.translate(0, 0, 0.5);
  }
  setScale(s){ this.smoke.mat.uniforms.scale.value = s; this.fire.mat.uniforms.scale.value = s; }
  explosion(p, s = 1){
    const F = this.fire, S = this.smoke;
    for (let i = 0; i < 24*s; i++) F.emit(p.x, p.y, p.z, R()*45*s, R()*45*s + 8, R()*45*s, (6 + Math.random()*8)*s, 0.45 + Math.random()*0.5, 1, 0.55 + Math.random()*0.3, 0.18, 1, 12*s, 2.6, 4);
    for (let i = 0; i < 16*s; i++) S.emit(p.x, p.y, p.z, R()*22*s, R()*16*s + 6, R()*22*s, (9 + Math.random()*6)*s, 2.4 + Math.random()*1.8, 0.22, 0.2, 0.19, 0.72, 9*s, 1.4, 4);
    for (let i = 0; i < 14*s; i++) F.emit(p.x, p.y, p.z, R()*170*s, R()*170*s, R()*170*s, 1.6, 0.6, 1, 0.82, 0.45, 1, 0, 1.2, -25);
    const l = this.lights[this.li++ % 3]; l.L.position.copy(p); l.L.intensity = 7*s; l.t = 0.28;
  }
  spark(p, col){
    const c = col || [1, 0.85, 0.5];
    for (let i = 0; i < 6; i++) this.fire.emit(p.x, p.y, p.z, R()*60, R()*60, R()*60, 1.4, 0.25, c[0], c[1], c[2], 1, 0, 3);
  }
  dust(p){
    for (let i = 0; i < 3; i++) this.smoke.emit(p.x, p.y + 1, p.z, R()*8, 6 + Math.random()*6, R()*8, 3, 1.2, 0.5, 0.44, 0.34, 0.6, 6, 1.5, 0);
  }
  trail(p, s = 1){
    this.smoke.emit(p.x, p.y, p.z, R()*2, R()*2, R()*2, 2.2*s, 1.5, 0.86, 0.86, 0.86, 0.5, 4, 0.8, 1.2);
    this.fire.emit(p.x, p.y, p.z, 0, 0, 0, 2.6*s, 0.07, 1, 0.7, 0.3, 1);
  }
  thrust(p, d, s = 1, col){
    const c = col || [0.55, 0.82, 1];
    this.fire.emit(p.x, p.y, p.z, d.x*40 + R()*6, d.y*40 + R()*6, d.z*40 + R()*6, 2.4*s, 0.16, c[0], c[1], c[2], 0.9, -6);
  }
  flare(p){
    this.fire.emit(p.x, p.y, p.z, R()*4, R()*4, R()*4, 5, 0.12, 1, 0.92, 0.7, 1);
    this.smoke.emit(p.x, p.y, p.z, R()*2, 0, R()*2, 2.6, 1.6, 0.9, 0.9, 0.9, 0.45, 5, 0.6, 1);
  }
  green(p){
    this.smoke.emit(p.x + R()*2, p.y, p.z + R()*2, R()*3, 9 + Math.random()*4, R()*3, 4, 4, 0.4, 0.95, 0.5, 0.6, 7, 0.4, 1.5);
  }
  burner(p, t = 20){ if (this.burners.length > 14) this.burners.shift(); this.burners.push({p: p.clone(), t, T:t}); }
  beam(a, b, color, w = 0.5, life = 0.16){
    const m = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false, fog:false}));
    m.position.copy(a); m.lookAt(b); m.scale.set(w, w, a.distanceTo(b));
    this.scene.add(m); this.beams.push({m, t:life, L:life});
  }
  update(dt){
    this.smoke.update(dt); this.fire.update(dt);
    for (const l of this.lights) if (l.t > 0) { l.t -= dt; l.L.intensity = Math.max(0, l.L.intensity - dt*28); }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i]; b.t -= dt; b.m.material.opacity = Math.max(0, b.t/b.L);
      if (b.t <= 0) { this.scene.remove(b.m); b.m.material.dispose(); this.beams.splice(i, 1); }
    }
    for (let i = this.burners.length - 1; i >= 0; i--) {
      const b = this.burners[i]; b.t -= dt;
      if (Math.random() < dt*11) this.smoke.emit(b.p.x + R()*4, b.p.y + 2, b.p.z + R()*4, R()*3 + 2.5, 8 + Math.random()*5, R()*3, 9, 6, 0.1, 0.095, 0.09, 0.62*Math.min(1, b.t/5), 9, 0.3, 1.5);
      if (Math.random() < dt*10 && b.t > b.T - 22) this.fire.emit(b.p.x + R()*3, b.p.y + 1, b.p.z + R()*3, 0, 6, 0, 4, 0.4, 1, 0.5, 0.15, 0.8, 2);
      if (b.t <= 0) this.burners.splice(i, 1);
    }
  }
};

/* ---------- Instanced tracers ---------- */
G.Tracers = class {
  constructor(scene, max = 700){
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0, -0.5);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({color:0xffffff, fog:false}), max);
    this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.max = max; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new V3(); this.d = new V3(); this.col = new THREE.Color(); this.Z = new V3(0, 0, 1);
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, this.col.setHex(0xffffff));
    this.mesh.count = 0; scene.add(this.mesh);
  }
  draw(list){
    let n = 0;
    for (const b of list) {
      if (n >= this.max) break;
      this.d.copy(b.vel).normalize(); this.q.setFromUnitVectors(this.Z, this.d);
      this.s.set(b.w, b.w, b.len); this.m.compose(b.pos, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m); this.mesh.setColorAt(n, this.col.setHex(b.color)); n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
};
})();
