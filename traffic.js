(function(){
'use strict';
/* Traffic: a street grid with cars for Port Halcyon, and civilian planes and an advertising blimp circling the city and
   flying the airway out to the back-country strip. All kinematic scenery: nothing here can be shot or crashed into.
   Surface shipping (G.Sea, at the end of this file) is the exception: ships are solid, can be sunk and can be landed on. */
const G = window.G, V3 = THREE.Vector3;
const CAR_COLS = [0x1f2a44, 0x6b1f1f, 0x2f4a30, 0x222222, 0x5a4632, 0x7a6a4a, 0x3a3f6a, 0x8a2f2f, 0xd9c9a4];
const CIV_PAINT = [[0xe9dcc0, 0x2f6f8f, 0xc0392b], [0xd94f2a, 0xf1e9d6, 0x26221f], [0x2f5d8a, 0xf2c14e, 0xf1e9d6], [0x6b8a3a, 0xf1e9d6, 0x5a2a1a], [0xf2c14e, 0x26221f, 0xb5382c]];

G.Traffic = class {
  constructor(g){ this.g = g; this.cars = []; this.planes = []; this.blimps = []; this.grids = []; }
  /* streets: avenues every B metres both ways across the flat city disc; returns lanes for cars and a test for "on a street" */
  streets(C, h, B = 96, W = 14){
    const g = this.g, asphalt = G.mat(0x45423e, {roughness:0.95}), kerb = G.mat(0xbdb39d, {roughness:0.9}), dash = G.mat(0xe6dcc0), lanes = [];
    const R = C.r - 30;
    for (let i = -Math.floor(R/B); i <= Math.floor(R/B); i++) {
      const c = i*B, half = Math.sqrt(Math.max(0, R*R - c*c)); if (half < 60) continue;
      for (const axis of ['x', 'z']) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? half*2 : W, 0.2, axis === 'x' ? W : half*2), asphalt); m.receiveShadow = true;
        m.position.set(C.x + (axis === 'x' ? 0 : c), h + 0.05, C.z + (axis === 'x' ? c : 0)); g.scene.add(m);
        for (const s of [1, -1]) { const kb = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? half*2 : 0.6, 0.35, axis === 'x' ? 0.6 : half*2), kerb); kb.position.set(m.position.x + (axis === 'x' ? 0 : s*(W/2 + 0.3)), h + 0.12, m.position.z + (axis === 'x' ? s*(W/2 + 0.3) : 0)); g.scene.add(kb); }
        for (let d = -half + 6; d < half - 6; d += 12) { const dm = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 4 : 0.3, 0.22, axis === 'x' ? 0.3 : 4), dash); dm.position.set(m.position.x + (axis === 'x' ? d : 0), h + 0.07, m.position.z + (axis === 'x' ? 0 : d)); g.scene.add(dm); }
        lanes.push({axis, c, half});
      }
    }
    // streetlamps after dark: one instanced mesh for the whole grid
    const tm = g.world && g.world.time;
    if (tm === 'night' || tm === 'evening') {
      const spots = []; for (const L of lanes) for (let d = -L.half + 20; d < L.half - 10; d += 46) for (const sd of [1, -1]) spots.push(L.axis === 'x' ? [C.x + d, C.z + L.c + sd*(W/2 + 1.5)] : [C.x + L.c + sd*(W/2 + 1.5), C.z + d]);
      if (spots.length) {
        const lampM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 6, 4), new THREE.MeshBasicMaterial({color:0xffd27a}), spots.length), poleM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.15, 5, 4), G.mat(0x2a2622), spots.length), mx = new THREE.Matrix4();
        spots.forEach(([x, z], i) => { lampM.setMatrixAt(i, mx.makeTranslation(x, h + 5.3, z)); poleM.setMatrixAt(i, mx.makeTranslation(x, h + 2.5, z)); });
        lampM.frustumCulled = poleM.frustumCulled = false; g.scene.add(lampM); g.scene.add(poleM);
      }
    }
    this.C = C; this.h = h; this.B = B; this.W = W; this.lanes = lanes; this.grid = {C, h, B, W, lanes}; this.grids.push(this.grid);   // several towns can each have a grid
    return {onStreet:(x, z) => { const lx = x - C.x, lz = z - C.z, mx = ((lx % B) + B*1.5) % B - B/2, mz = ((lz % B) + B*1.5) % B - B/2; return Math.abs(mx) < W/2 + 18 || Math.abs(mz) < W/2 + 18; }};
  }
  carsOn(n){
    const gr = this.grid, r = G.rng(91 + this.grids.length*13);
    for (let i = 0; i < n && gr && gr.lanes.length; i++) {
      const L = gr.lanes[Math.floor(r()*gr.lanes.length)], dir = r() < 0.5 ? 1 : -1, m = G.buildCar(CAR_COLS[Math.floor(r()*CAR_COLS.length)], r() < 0.2);
      this.g.scene.add(m);
      this.cars.push({L, dir, d:(r()*2 - 1)*L.half, sp:9 + r()*7, m, lane:dir*Math.min(3.4, gr.W/4), gr});
    }
  }
  /* civilian planes on lazy circles round the city, plus a couple flying the airway to another point */
  air(C, o = {}){
    const r = G.rng(33);
    for (let i = 0; i < (o.circlers ?? 5); i++) {
      const m = G.buildPlane('gallant', CIV_PAINT[i % CIV_PAINT.length]); const pilot = m.getObjectByName('pilot'); if (pilot) pilot.visible = true;
      this.g.scene.add(m);
      this.planes.push({m, kind:'circle', cx:C.x, cz:C.z, R:(o.R || 650) + r()*(o.R ? o.R*0.6 : 700), y:(this.h || 14) + 240 + r()*380, a:r()*Math.PI*2, w:(r() < 0.5 ? 1 : -1)*(55 + r()*15)});
    }
    for (const to of o.airways || []) for (let j = 0; j < 2; j++) {
      const m = G.buildPlane('gallant', CIV_PAINT[(j + 2) % CIV_PAINT.length]); this.g.scene.add(m);
      this.planes.push({m, kind:'line', a:new V3(C.x, 430 + j*60, C.z), b:new V3(to.x, 430 + j*60, to.z), t:j*0.5, sp:62});
    }
    if (o.blimp !== false) {
      const b = G.buildBlimp({name:'FIZZ COLA · 5¢', hull:0xf1e9d6, band:0xb5382c}); this.g.scene.add(b);
      this.blimps.push({m:b, cx:C.x, cz:C.z, R:520, y:(this.h || 14) + 330, a:1.3, w:7});
    }
  }
  /* charter and mail planes shuttling between pairs of stops, high enough to clear everything on the way */
  routes(pairs, o = {}){
    const r = G.rng(57), w = this.g.world;
    pairs.forEach(([a, b], i) => {
      let top = 0; for (let k = 0; k <= 30; k++) { const x = a.x + (b.x - a.x)*k/30, z = a.z + (b.z - a.z)*k/30; top = Math.max(top, w.height(x, z)); }
      const y = top + 170 + r()*140, m = G.buildPlane(i % 3 === 2 ? 'sparrowhawk' : 'gallant', CIV_PAINT[(i + 1) % CIV_PAINT.length]); this.g.scene.add(m);
      this.planes.push({m, kind:'line', a:new V3(a.x, y, a.z), b:new V3(b.x, y, b.z), t:r()*2, sp:55 + r()*15});
    });
  }
  /* big cargo zeppelins on long straight passages across the region, wrapping round at the edge of the chart */
  cruisers(n, region){
    const r = G.rng(region.length*17 + 3), w = this.g.world, names = {halcyon:['PAN-SIERRA FREIGHT', 'HALCYON LINES'], badlands:['CORONADO EXPRESS', 'COPPER STATE CARGO'], frostback:['ROYAL CASCADE MAIL', 'ALPINE AIR FREIGHT'], keys:['MARAVILLA PACKET CO.', 'TROPIC LINES']}[region] || ['AIR FREIGHT'];
    const paints = [[0xe8dcc0, 0x1f3b6b], [0xd8d0c8, 0x8e231c], [0xf1e9d6, 0x2f5d3a]];
    for (let i = 0; i < n; i++) {
      const ang = r()*Math.PI*2, dir = new V3(Math.sin(ang), 0, Math.cos(ang)), side = new V3(dir.z, 0, -dir.x).multiplyScalar((r() - 0.5)*6000), from = side.clone().addScaledVector(dir, -7600);
      let top = 0; for (let k = 0; k <= 40; k++) { const p = from.clone().addScaledVector(dir, k*380); top = Math.max(top, w.height(p.x, p.z)); }
      const pt = paints[i % paints.length], m = G.buildBlimp({name:names[i % names.length], hull:pt[0], band:pt[1]}); m.scale.setScalar(2.4); this.g.scene.add(m);
      this.blimps.push({m, kind:'line', from, dir, s:r()*15200, L:15200, y:Math.max(top + 260, 560 + r()*220), sp:9 + r()*4});
    }
  }
  update(dt){
    if (this.sea) this.sea.update(dt);
    for (const c of this.cars) {
      c.d += c.dir*c.sp*dt; if (c.d > c.L.half) c.d = -c.L.half; if (c.d < -c.L.half) c.d = c.L.half;
      const C = c.gr.C, x = c.L.axis === 'x' ? C.x + c.d : C.x + c.L.c + c.lane, z = c.L.axis === 'x' ? C.z + c.L.c - c.lane : C.z + c.d;
      c.m.position.set(x, c.gr.h + 0.2, z); c.m.rotation.y = c.L.axis === 'x' ? (c.dir > 0 ? Math.PI/2 : -Math.PI/2) : (c.dir > 0 ? 0 : Math.PI);
    }
    for (const p of this.planes) {
      if (p.kind === 'circle') {
        p.a += p.w/p.R*dt; const x = p.cx + Math.sin(p.a)*p.R, z = p.cz + Math.cos(p.a)*p.R;
        p.m.position.set(x, p.y + Math.sin(p.a*3)*12, z);
        const hd = p.a + Math.sign(p.w)*Math.PI/2; p.m.rotation.set(0, hd, 0); p.m.rotateZ(Math.sign(p.w)*0.35);
      } else {
        p.t += p.sp*dt/p.a.distanceTo(p.b); const k = p.t % 2, f = k < 1 ? k : 2 - k, from = k < 1 ? p.a : p.b, to = k < 1 ? p.b : p.a;
        p.m.position.lerpVectors(p.a, p.b, f); p.m.rotation.set(0, Math.atan2(to.x - from.x, to.z - from.z), 0);
      }
      for (const pr of p.m.userData.props || [p.m.userData.prop]) if (pr) { pr.rotation.z += dt*30*(pr.userData.dir || 1)*(pr.userData.rate || 1); if (pr.userData.disc) pr.userData.disc.material.opacity = 0.22; }
    }
    for (const b of this.blimps) {
      if (b.kind === 'line') { b.s = (b.s + b.sp*dt) % b.L; b.m.position.copy(b.from).addScaledVector(b.dir, b.s).setY(b.y); b.m.rotation.y = Math.atan2(b.dir.x, b.dir.z); for (const pr of b.m.userData.props || []) pr.rotation.z += dt*8; continue; }
      b.a += b.w/b.R*dt; b.m.position.set(b.cx + Math.sin(b.a)*b.R, b.y, b.cz + Math.cos(b.a)*b.R); b.m.rotation.y = b.a + Math.PI/2;
      for (const pr of b.m.userData.props || []) pr.rotation.z += dt*8;
    }
  }
};
/* ==== SEA BEGIN ==== */
/* =====================================================================
   Surface shipping. Ships steam round fixed lanes laid over the region's water (checked against the terrain when they are
   built, so a hull never crosses land). They are solid: a plane that flies into a hull or a funnel is gone. They can be
   shot, burn and sink. Firing on merchantmen or the Navy is a crime; corsairs and the Brethren are fair game.
   Some carry a landing stage. The Whirligig, slow and level with her flaps down, is caught on it and rides the ship.
   ===================================================================== */
const SEA_Y = 0.4, DECK_MAX = 29;   // the sea surface; the fastest the deck crew can catch an autogyro (65 mph over the deck)
const SHIP_STATS = {
  freighter:{hp:2400, sp:5.5, what:'freighter'}, tug:{hp:520, sp:4.6, what:'tug'}, steamer:{hp:1900, sp:7.5, what:'steamer'}, trawler:{hp:380, sp:4, what:'trawler'},
  gunboat:{hp:2600, sp:9, what:'gunboat', armed:1.5, range:1500}, schooner:{hp:700, sp:5.5, what:'schooner', armed:3.2, range:900}, galleon:{hp:2600, sp:4.2, what:'galleon', armed:2.4, range:1100}, yacht:{hp:800, sp:8, what:'yacht'}
};
const angTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/* a closed lane through way-points: Catmull-Rom, resampled every ~12 m */
function laneOf(pts){
  const n = pts.length, xs = [], zs = [];
  for (let i = 0; i < n; i++) { const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n], d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(1, Math.round(d/12));
    for (let j = 0; j < m; j++) { const t = j/m, t2 = t*t, t3 = t2*t; xs.push(0.5*(2*p1[0] + (p2[0] - p0[0])*t + (2*p0[0] - 5*p1[0] + 4*p2[0] - p3[0])*t2 + (3*p1[0] - p0[0] - 3*p2[0] + p3[0])*t3)); zs.push(0.5*(2*p1[1] + (p2[1] - p0[1])*t + (2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1])*t2 + (3*p1[1] - p0[1] - 3*p2[1] + p3[1])*t3)); } }
  const N = xs.length, L = {n:N, px:xs, pz:zs, s:new Float64Array(N + 1), holds:[]};
  for (let i = 0; i < N; i++) L.s[i + 1] = L.s[i] + Math.hypot(xs[(i + 1) % N] - xs[i], zs[(i + 1) % N] - zs[i]);
  L.len = L.s[N];
  L.at = (s, out) => { s = ((s % L.len) + L.len) % L.len; let a = 0, b = N; while (b - a > 1) { const m = (a + b) >> 1; if (L.s[m] <= s) a = m; else b = m; }
    const j = (a + 1) % N, t = (s - L.s[a])/Math.max(1e-6, L.s[a + 1] - L.s[a]); out.x = xs[a] + (xs[j] - xs[a])*t; out.z = zs[a] + (zs[j] - zs[a])*t; out.yaw = Math.atan2(xs[j] - xs[a], zs[j] - zs[a]); return out; };
  return L;
}
/* ---------- the wake ----------
   One mesh per ship, one small shared pattern. The mesh is a Kelvin wedge laid on the sea from the stem aft (its vertices
   carry the foam tint and how far it has faded), a strip of churned water astern of the screw, and a curl of foam along
   each bow. The pattern is drawn once into a texture that tiles along the ship's track: feathered crests down the arms of
   the vee, faint transverse swells between them, broken foam in the wash. Scrolling it aft is all the animation there is. */
const wakeHash = (x, y) => { let h = (x*374761393 + y*668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0)/4294967296; };
const wakeNoise = (x, y, px, py) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx*fx*(3 - 2*fx), v = fy*fy*(3 - 2*fy), H = (a, b) => wakeHash(((a % px) + px) % px, ((b % py) + py) % py + 57*px);
  return (H(xi, yi)*(1 - u) + H(xi + 1, yi)*u)*(1 - v) + (H(xi, yi + 1)*(1 - u) + H(xi + 1, yi + 1)*u)*v; };
const wakeFbm = (x, y, px, py) => wakeNoise(x, y, px, py)*0.55 + wakeNoise(x*2, y*2, px*2, py*2)*0.3 + wakeNoise(x*4, y*4, px*4, py*4)*0.15;
const WAKE_SPLIT = 0.75;   // the texture's left three-quarters is the wedge (U across the vee), the right quarter the wash and bow foam
/* foam density at a point of the pattern: U across (0..1), V along the track (tiles every 1) */
G.wakeAlpha = (U, V) => {
  V -= Math.floor(V);
  if (U < WAKE_SPLIT) {
    const u = U/WAKE_SPLIT*2 - 1, a = Math.abs(u), n = wakeFbm(u*5 + 9, V*8, 64, 8), n2 = wakeFbm(u*11 + 3, V*20, 64, 20);
    // the arms: a band of steep little crests lying slantwise along each edge of the vee, breaking into foam
    const arm = Math.exp(-(((a - 0.72)/0.17)**2)), cr = Math.sin(2*Math.PI*(V*5 + a*2.6 + n*0.22)), crest = Math.pow(Math.max(0, cr), 2.5);
    let A = arm*(0.22 + 0.78*crest)*(0.4 + 0.9*n2);
    // a second, finer rank of crests just inside the first
    A += Math.exp(-(((a - 0.46)/0.13)**2))*Math.pow(Math.max(0, Math.sin(2*Math.PI*(V*8 + a*3.4 + n*0.3))), 3.5)*0.4*(0.3 + n2);
    // transverse swells: pale arcs across the track, bowed aft, strongest down the middle
    const tr = Math.pow(Math.max(0, Math.sin(2*Math.PI*(V*3 - 0.5*a*a + n*0.08))), 5); A += tr*0.36*Math.max(0, 1 - a/0.62)*(0.5 + n2*0.7);
    // slick, disturbed water everywhere inside the vee
    A += 0.05*Math.max(0, 1 - a)*n;
    return Math.min(1, A*Math.min(1, (1 - a)/0.12));
  }
  const w = Math.abs((U - WAKE_SPLIT)/(1 - WAKE_SPLIT)*2 - 1), n = wakeFbm(w*4 + 21, V*10, 64, 10), n2 = wakeFbm(w*9 + 5, V*26, 64, 26);
  const churn = Math.pow(Math.max(0, n*1.5 - 0.28), 1.3)*(0.45 + 0.9*n2);
  return Math.min(1, (1 - w*w)*(0.22 + churn));
};
let WAKE_TEX = null;
function wakeTexture(){
  if (WAKE_TEX) return WAKE_TEX;
  const W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  if (x && x.createImageData) { const im = x.createImageData(W, H), d = im && im.data;
    if (d && d.length === W*H*4) { for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = (j*W + i)*4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = Math.round(255*G.wakeAlpha((i + 0.5)/W, 1 - (j + 0.5)/H)); } x.putImageData(im, 0, 0); } }
  return (WAKE_TEX = c);
}
function wakeMesh(ud, night, sea = 0x1f6f9e){
  const L = ud.len, b = ud.beam/2, D = Math.max(70, Math.min(190, L*3.1)), tile = Math.max(26, L*0.85), y = 0.16, pos = [], uv = [], col = [], idx = [];
  // foam is the sea's own colour let down with white, so it sits in the water instead of on it
  const sr = (sea >> 16 & 255)/255, sg = (sea >> 8 & 255)/255, sb = (sea & 255)/255, k = night ? 0.3 : 0.8, dim = night ? 0.5 : 1, fr = (sr + (1 - sr)*k)*dim, fg = (sg + (1 - sg)*k)*dim, fb = (sb + (1 - sb)*k)*dim;
  const sat = v => Math.max(0, Math.min(1, v)), hw = d => 0.7 + b*1.15*sat(d/(L*0.3)) + Math.max(0, d)*0.3;
  const V = (x, z, U, Vt, a) => { pos.push(x, y, z); uv.push(U, Vt); col.push(fr, fg, fb, a); return pos.length/3 - 1; };
  const grid = (nu, rows, f) => { const base = pos.length/3; rows.forEach((r, j) => { for (let i = 0; i <= nu; i++) f(i/nu, r, j); }); for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < nu; i++) { const a = base + j*(nu + 1) + i, c = a + nu + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); } };
  // the wedge, stem to far astern: rows crowd together near the ship, where the fade changes fastest
  const rows = []; for (let j = 0; j <= 16; j++) rows.push(-2 + (D + 2)*Math.pow(j/16, 1.5));
  grid(10, rows, (t, d) => { const u = t*2 - 1, h = hw(d), a = sat((d + 2)/(L*0.12))*Math.pow(1 - sat(d/D), 1.15)*1.4; V(-u*h, ud.bow - d, (u*0.5 + 0.5)*WAKE_SPLIT*0.998, d/tile, a); });
  // the screw's wash: a ribbon of churned water astern, widening and going slack
  const wr = []; for (let j = 0; j <= 9; j++) wr.push(L*1.75*Math.pow(j/9, 1.3));
  grid(4, wr, (t, d) => { const f = d/(L*1.75), w = b*(0.5 + 0.75*sat(f*2.2)); V((t*2 - 1)*w, ud.stern + b*0.6 - d, WAKE_SPLIT + 0.01 + t*(1 - WAKE_SPLIT - 0.02), d/(tile*0.8) + 0.37, sat(d/(b*0.9))*Math.pow(1 - f, 1.1)*1.25); });
  // the bone in her teeth: foam curling off each bow and streaming down the side
  for (const s of [1, -1]) { const br = [0, 0.05, 0.12, 0.22, 0.36, 0.55].map(q => q*L);
    grid(2, br, (t, d) => { const hb = b*sat(0.08 + d/(L*0.3))*0.96, out = 0.5 + 2.6*sat(d/(L*0.2)) + d*0.05; V(s*(hb + t*out - 0.4), ud.bow - 0.5 - d, WAKE_SPLIT + 0.02 + (0.5 + 0.46*t)*(1 - WAKE_SPLIT - 0.04), d/(tile*0.5) + 0.11, (t === 1 ? 0 : 1.7)*(1 - d/(L*0.55))*sat(0.5 + d/(L*0.05))); }); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 4)); geo.setIndex(idx);
  const tex = new THREE.CanvasTexture(wakeTexture()); tex.wrapT = THREE.RepeatWrapping; tex.wrapS = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map:tex, vertexColors:true, transparent:true, opacity:1, depthWrite:false, side:THREE.DoubleSide}));
  m.frustumCulled = false; m.renderOrder = 1; m.userData = {wake:true, tex, tile, scroll:0, op:1};
  return m;
}
G.wakeMesh = wakeMesh;
G.Sea = class {
  constructor(g, c, o = {}){
    this.g = g; this.c = c; this.ships = []; this.rid = o.region || ''; this.night = !!o.night; this.wanted = 0; this.quiet = 99; this.guardT = 0; this.sayT = -99; this.padT = -99; this.fine = 0; this.law = o.law || 'navy';
    g.sea = this; if (g.traffic) g.traffic.sea = this;
  }
  /* is the water deep and clear of land for `m` metres all round? */
  deep(x, z, m = 16, d = -1.6){
    const w = this.g.world; if (w.height(x, z) > d) return false;
    for (let k = 0; k < 8; k++) { const a = k*Math.PI/4; if (w.height(x + Math.sin(a)*m, z + Math.cos(a)*m) > d) return false; }
    return true;
  }
  /* way-points nudged off the shallows, then smoothed and checked along their whole length. Returns null if it can't be made safe. */
  lane(pts, o = {}){
    const w = this.g.world, m = o.margin || 26; pts = pts.map(p => [p[0], p[1]]);
    for (let it = 0; it < 80; it++) { let moved = false;
      for (const p of pts) { if (this.deep(p[0], p[1], m + 14)) continue; let bx = 0, bz = 0;
        for (let k = 0; k < 12; k++) { const a = k*Math.PI/6, h = w.height(p[0] + Math.sin(a)*(m + 14), p[1] + Math.cos(a)*(m + 14)); if (h > -1.6) { bx -= Math.sin(a); bz -= Math.cos(a); } }
        const l = Math.hypot(bx, bz); if (l < 1e-3) { const hx = w.height(p[0] + 8, p[1]) - w.height(p[0] - 8, p[1]), hz = w.height(p[0], p[1] + 8) - w.height(p[0], p[1] - 8), hl = Math.hypot(hx, hz) || 1; bx = -hx/hl; bz = -hz/hl; } else { bx /= l; bz /= l; }
        p[0] += bx*18; p[1] += bz*18; moved = true; }
      if (!moved) break; }
    const L = laneOf(pts); L.margin = m;
    for (let i = 0; i < L.n; i++) if (!this.deep(L.px[i], L.pz[i], m)) { L.bad = [Math.round(L.px[i]), Math.round(L.pz[i])]; break; }
    if (L.bad) { if (typeof console !== 'undefined' && !o.quiet) console.warn('sea lane crosses land at', L.bad, o.name || ''); return null; }
    return L;
  }
  /* a lane round the outside of all the land, `off` metres beyond the outermost shore */
  ring(off, o = {}){
    const w = this.g.world, N = o.n || 56, rs = [], ang = i => (o.rev ? -1 : 1)*i/N*Math.PI*2 + (o.a0 || 0);
    for (let i = 0; i < N; i++) { const a = ang(i); let r = 8300; for (; r > 400; r -= 40) if (w.height(Math.sin(a)*r, Math.cos(a)*r) > -3) break; rs.push(r + off); }
    const sm = rs.map((_, i) => { let mx = 0, av = 0; for (let k = -3; k <= 3; k++) { const v = rs[(i + k + N) % N]; mx = Math.max(mx, v); av += v/7; } return Math.min(8500, mx*0.6 + av*0.4); });
    const pts = sm.map((r, i) => { const a = ang(i); return [Math.sin(a)*r, Math.cos(a)*r]; });
    return this.lane(pts, o);
  }
  /* an oval of open water near (x, z): the nearest place it fits, searched outward in a fixed order */
  oval(x, z, rx, rz, o = {}){
    const N = 14, mk = (cx, cz, th) => { const p = []; for (let i = 0; i < N; i++) { const a = (o.rev ? -1 : 1)*i/N*Math.PI*2, u = Math.sin(a)*rx, v = Math.cos(a)*rz; p.push([cx + u*Math.cos(th) + v*Math.sin(th), cz - u*Math.sin(th) + v*Math.cos(th)]); } return p; };
    for (let d = 0; d <= (o.reach || 1800); d += 120) for (let k = 0; k < (d ? 10 : 1); k++) { const a = k*Math.PI/5 + d*0.01, cx = x + Math.sin(a)*d, cz = z + Math.cos(a)*d;
      for (const th of [o.th || 0, (o.th || 0) + Math.PI/3, (o.th || 0) + 2*Math.PI/3]) { const p = mk(cx, cz, th); if (!p.every(q => this.deep(q[0], q[1], (o.margin || 26) + 10))) continue; const L = this.lane(p, Object.assign({quiet:true}, o)); if (L) return L; } }
    if (typeof console !== 'undefined') console.warn('no open water for an oval near', x, z, o.name || ''); return null;
  }
  add(kind, lane, o = {}){
    if (!lane) return null;
    const g = this.g, st = SHIP_STATS[kind], obj = G.buildShip(kind, {pad:!!o.pad, paint:o.paint, night:this.night}), ud = obj.userData;
    const S = {kind, what:st.what, name:o.name || st.what, obj, ud, lane, s:(o.at ?? 0)*lane.len, sp:o.speed || st.sp, v:o.speed || st.sp, pos:new V3(), vel:new V3(), yaw:0, y:SEA_Y, hp:st.hp, hpMax:st.hp, alive:true, sinking:0, gone:false,
      the:(/^(La|Le|El|Los|Las) /.test(o.name || '') ? '' : 'the ') + (o.name || st.what), faction:o.faction || 'civil', bounty:o.bounty || 0, armed:st.armed || 0, range:st.range || 0, pad:ud.pad, ph:this.ships.length*1.7 + 0.4, fxT:0, gunT:2, hostile:-1, team:1, callsign:o.name || st.what, deck:null, holdI:-1, id:o.id || kind + this.ships.length};
    const P = lane.at(S.s, {}); S.yaw = P.yaw; S.pos.set(P.x, SEA_Y, P.z); obj.position.copy(S.pos); obj.rotation.y = S.yaw; g.scene.add(obj);
    S.wake = wakeMesh(ud, this.night, g.world.RT && g.world.RT.water); S.wake.position.set(P.x, SEA_Y, P.z); S.wake.rotation.y = S.yaw; g.scene.add(S.wake);
    this.ships.push(S); return S;
  }
  /* stop short of a point on the lane until ok() says go: the freighters wait here for the drawbridge */
  hold(lane, x, z, back, ok){ let bi = 0, bd = 1e9; for (let i = 0; i < lane.n; i++) { const d = Math.hypot(lane.px[i] - x, lane.pz[i] - z); if (d < bd) { bd = d; bi = i; } } lane.holds.push({s:((lane.s[bi] - back) % lane.len + lane.len) % lane.len, ok}); }
  local(S, p, out){ const dx = p.x - S.pos.x, dz = p.z - S.pos.z, c = Math.cos(S.yaw), s = Math.sin(S.yaw); out.x = dx*c - dz*s; out.z = dx*s + dz*c; out.y = p.y - S.y; return out; }
  world(S, x, y, z, out){ const c = Math.cos(S.yaw), s = Math.sin(S.yaw); return out.set(S.pos.x + x*c + z*s, S.y + y, S.pos.z - x*s + z*c); }
  /* which part of her, if any, is this point inside? 0 = nothing, 1 = hull or upperworks, 2 = a mast */
  inside(S, l, m){
    const ud = S.ud; if (l.y > ud.top + m || Math.abs(l.z) > ud.len/2 + 12 + m || Math.abs(l.x) > ud.beam/2 + 5 + m) return 0;
    for (const b of ud.boxes) if (Math.abs(l.x - b[0]) < b[3] + m && Math.abs(l.y - b[1]) < b[4] + m && Math.abs(l.z - b[2]) < b[5] + m) return 1;
    for (const M of ud.masts) { const ax = M[3] - M[0], ay = M[4] - M[1], az = M[5] - M[2], t = Math.max(0, Math.min(1, ((l.x - M[0])*ax + (l.y - M[1])*ay + (l.z - M[2])*az)/(ax*ax + ay*ay + az*az))); if (Math.hypot(l.x - M[0] - ax*t, l.y - M[1] - ay*t, l.z - M[2] - az*t) < M[6] + m*0.5) return 2; }
    return 0;
  }
  /* will a shot going from a to b this frame pass through her? The sea runs before the bullets move, so it looks ahead. (bullets cover 15 m a frame: a point test would miss a trawler) */
  swept(S, a, b, m){
    const A = this.local(S, a, tM), B = this.local(S, b, tL), d = Math.hypot(B.x - A.x, B.y - A.y, B.z - A.z), n = Math.max(1, Math.min(24, Math.ceil(d/2))), ax = A.x, ay = A.y, az = A.z, bx = B.x, by = B.y, bz = B.z;
    for (let k = 1; k <= n; k++) { const t = k/n; tM.x = ax + (bx - ax)*t; tM.y = ay + (by - ay)*t; tM.z = az + (bz - az)*t; if (this.inside(S, tM, m)) return true; }
    return false;
  }
  padTop(S, out){ return this.world(S, S.pad.x, S.pad.y, S.pad.z, out); }
  byId(id){ return this.ships.find(s => s.id === id) || null; }
  nearest(p, f){ let b = null, bd = 1e9; for (const S of this.ships) { if (S.gone || (f && !f(S))) continue; const d = S.pos.distanceTo(p); if (d < bd) { bd = d; b = S; } } return b; }

  /* ---- the law of the sea ---- */
  police(){ return this.rid === 'rustwater' && !!(this.c && this.c.heatAdd); }   // Gantry has its own Air Police and their heat
  crime(n, why){
    const g = this.g, c = this.c; if (g.netGuest) return;
    if (this.police()) { c.heatAdd(g, n, why && g.t - this.sayT > 6 ? why : null); if (why && g.t - this.sayT > 6) this.sayT = g.t; return; }
    this.wanted = Math.min(120, this.wanted + n); this.quiet = 0; this.fine += n*12;
    if (why && g.t - this.sayT > 6) { this.sayT = g.t; G.HUD.toast(why); }
    if (this.wanted >= 18 && g.t > this.guardT && c && c.gang && g.player && g.player.alive) {
      this.guardT = g.t + 75; const P = g.player, n2 = this.wanted > 60 ? 3 : 2;
      this.guards = (this.guards || []).filter(p => p.alive).concat(c.gang(this.law, P.pos.clone().add(tV.set(1500, 320, 900)), n2, {skill:0.5}));
      G.HUD.radio(G.RADIO.short, this.law === 'navy' ? 'You\'re shooting at honest shipping, sugar! The Navy\'s scrambled a patrol, and they\'ve got your number.' : 'That was a neutral ship! Coast Guard planes are coming up, and they are not coming to chat.');
    }
  }
  /* fines are settled the next time you sit down with anybody respectable */
  settle(){ if (this.fine < 60 || this.police()) return 0; const f = Math.min(G.save.cash, Math.round(this.fine/10)*10); G.save.cash -= f; this.fine = 0; this.wanted = 0; G.persist(); if (f) G.HUD.toast(`The Harbour Board fined you $${f.toLocaleString()} for firing on shipping`); return f; }
  hit(S, d, src, at){
    const g = this.g; if (!S.alive) return;
    const mine = src && src === g.player;
    if (!mine && S.aiMul !== undefined) d *= S.aiMul;   // a mission can script what other people's guns do to her
    S.hp -= d; if (mine) { G.HUD.hitMark(); if (g.audio) g.audio.hitThem(); S.hostile = g.t + 40; }
    if (mine && S.faction !== 'pirate') this.crime(Math.min(14, 2 + d*0.05), S.faction === 'navy' ? `You're firing on the Navy! That's ${S.the}!` : `You're firing on ${S.the}! She's a neutral ship!`);
    if (S.hp <= 0) this.sink(S, src);
  }
  sink(S, src){
    const g = this.g; if (!S.alive) return; S.alive = false; S.sinking = 0.001; S.hp = 0;
    const mine = (src || null) === g.player;
    g.fx.explosion(this.world(S, 0, 4, 0, tV), 2.4); if (g.audio) g.audio.boom(S.pos, true);
    if (S.deck) this.launch(S.deck, true);
    if (mine && S.faction === 'pirate') { if (S.bounty) { G.save.cash += S.bounty; if (this.c && this.c.earned !== undefined) this.c.earned += S.bounty; G.persist(); } G.HUD.feed(`You sank ${S.the}${S.bounty ? ` · $${S.bounty.toLocaleString()} bounty` : ''}`, true); }
    else { G.HUD.feed(`${S.the[0].toUpperCase() + S.the.slice(1)} is going down`, false); if (mine) this.crime(60, `You sank ${S.the}!`); }
    if (g.mission.onSeaShipDown) g.mission.onSeaShipDown(g, S, src);
  }
  /* ---- the landing stage ---- */
  latch(P, S, l){
    const g = this.g, hard = P.vel.y < -4;
    P.deck = {ship:S, lx:l.x, lz:l.z, yaw:angTo(S.yaw, Math.atan2(P.fwd.x, P.fwd.z)), jump:-1, t:0}; S.deck = P;
    P.frozen = true; P.onGround = true; P.speed = 0; P.man = null; P.throttle = Math.min(P.throttle, 0.15); P.fire = P.fireRk = false; P.gearUp = false;
    if (hard) P.internal = Math.max(1, P.internal - P.internalMax*0.06);
    this.ride(P, 0);
    if (P.isPlayer) { g.aimPitch = -0.03; g.aimYaw = Math.atan2(P.fwd.x, P.fwd.z); G.HUD.toast(hard ? 'Deck landing! (hard)' : 'Deck landing!'); if (g.audio && g.audio.gear) try { g.audio.gear(); } catch (e) {}
      if (g.mission.onDeck) g.mission.onDeck(g, S, hard); }
  }
  ride(P, dt){
    const D = P.deck, S = D.ship, pad = S.pad, r = Math.max(0.5, pad.r - 2.2), dx = D.lx - pad.x, dz = D.lz - pad.z, d = Math.hypot(dx, dz);
    if (d > r) { const k = Math.min(1, dt*1.5); D.lx -= dx*(1 - r/d)*k; D.lz -= dz*(1 - r/d)*k; }   // the deck crew haul her in from the edge
    const lift = D.jump >= 0 ? 7.5*(1 - Math.cos(Math.min(1, D.jump)*Math.PI))/2 : 0;
    this.world(S, D.lx, pad.y + (P.ud.gear || 1.8) + lift, D.lz, P.pos); P.vel.copy(S.vel); P.speed = 0;
    P.q.setFromAxisAngle(UPV, S.yaw + D.yaw); if (lift > 0) P.q.multiply(tQ.setFromAxisAngle(XV, -0.16*Math.min(1, D.jump))); P.axes();
    const th = P.throttle; if (D.jump >= 0) P.throttle = 1; P.sync(dt); P.throttle = th;
  }
  /* the jump take-off: the rotor's spun up, the deck crew let go, she leaps clear and flies */
  launch(P, forced){
    const g = this.g, D = P.deck; if (!D) return; const S = D.ship;
    P.deck = null; S.deck = null; P.frozen = false; P.onGround = false; P.deckFree = {ship:S, until:g.t + 4};
    P.speed = Math.max(P.stallSpeed()*1.18, 24); P.throttle = Math.max(P.throttle, 0.9); P.axes(); P.vel.copy(P.fwd).multiplyScalar(P.speed).add(S.vel);
    if (P.isPlayer) { if (g.onLiftoff) g.onLiftoff(P); g.aimYaw = Math.atan2(P.fwd.x, P.fwd.z); g.aimPitch = 0.16; if (g.mission.onDeckOff) g.mission.onDeckOff(g, S, forced); }
  }
  deckCheck(P, S, l){
    const g = this.g, pad = S.pad, gear = P.ud.gear || 1.8, dy = l.y - pad.y, dxz = Math.hypot(l.x - pad.x, l.z - pad.z);
    if (dxz > pad.r + 2.5 || dy > gear + 0.9 || dy < 0.2 || P.vel.y > 1.5) return false;
    const rel = Math.hypot(P.vel.x - S.vel.x, P.vel.z - S.vel.z), gyro = P.L.chassis === 'whirligig';
    const ok = gyro && rel < DECK_MAX && Math.abs(P.right.y) < 0.42 && P.fwd.y > -0.35 && P.vel.y > -8 && S.alive && !P.man;
    if (ok) { this.latch(P, S, l); return true; }
    // no landing: she skips off the planking
    P.pos.y = S.y + pad.y + gear + 1.3; P.q.multiply(tQ.setFromAxisAngle(XV, -0.2)); P.axes(); P.speed *= 0.96; P.internal -= P.internalMax*(gyro ? 0.05 : 0.14);
    if (P.isPlayer && g.t - this.padT > 2.5) { this.padT = g.t; G.HUD.toast(!gyro ? 'Only an autogyro can put down on a deck' : rel >= DECK_MAX ? `Too fast for the deck · flaps down, under ${Math.round(DECK_MAX/G.MPH)} mph` : 'Too rough for the deck · wings level, ease her down'); if (g.audio) g.audio.hitMe(false); }
    if (P.internal <= 0) P.destroy(null, 'crash');
    return true;
  }
  /* job and free-flight markers: called by the mission after it has cleared its own */
  marks(g){
    const P = g.player; if (!P || !P.alive || P.L.chassis !== 'whirligig') return;
    for (const S of this.ships) if (S.pad && S.alive && !S.marked && S.pos.distanceTo(P.pos) < 2600) g.markers.push({pos:this.padTop(S, new V3()).setY(S.y + S.pad.y + 6), label:P.deck && P.deck.ship === S ? 'ON DECK · pull up to leave' : `${S.name.toUpperCase()} · LANDING STAGE`, col:'#9ec7f0', noDist:!!P.deck});
  }
  update(dt){
    const g = this.g, P = g.player, t = g.t, near = P ? P.pos : null, fx = g.fx;
    this.quiet += dt; if (this.quiet > 25) this.wanted = Math.max(0, this.wanted - dt*0.8);
    for (const S of this.ships) {
      if (S.gone) continue;
      // under way
      if (S.alive) {
        let want = S.sp; S.holdI = -1;
        for (let i = 0; i < S.lane.holds.length; i++) { const h = S.lane.holds[i], ahead = ((h.s - S.s) % S.lane.len + S.lane.len) % S.lane.len; if (ahead < 70 && !h.ok(S)) { want = Math.min(want, ahead < 3 ? 0 : Math.max(0.6, ahead*0.09)); S.holdI = i; } }
        if (S.stop) want = 0;
        // rule of the road: don't run up the stern of the ship ahead, give way to one crossing the bow
        for (const O of this.ships) { if (O === S || O.gone) continue; const dx = O.pos.x - S.pos.x, dz = O.pos.z - S.pos.z; if (Math.abs(dx) > 260 || Math.abs(dz) > 260) continue;
          const c = Math.cos(S.yaw), sn = Math.sin(S.yaw), lx = dx*c - dz*sn, lz = dx*sn + dz*c, gap = (S.ud.len + O.ud.len)/2 + 22; if (lz < 0 || lz > gap + 90 || Math.abs(lx) > (S.ud.beam + O.ud.beam)/2 + 14 + lz*0.12) continue;
          const headOn = Math.cos(O.yaw - S.yaw) < -0.5; if (headOn && this.ships.indexOf(S) < this.ships.indexOf(O)) continue;
          want = Math.min(want, Math.max(0, (lz - gap)*0.08)); }
        S.v += Math.max(-0.5*dt, Math.min(0.35*dt, want - S.v)); S.s = (S.s + S.v*dt) % S.lane.len;
      } else S.v = Math.max(0, S.v - 0.5*dt), S.s = (S.s + S.v*dt) % S.lane.len;
      const A = S.lane.at(S.s, tL), px = S.pos.x, pz = S.pos.z; S.yaw += Math.max(-0.2*dt, Math.min(0.2*dt, angTo(S.yaw, A.yaw)));
      S.pos.x = A.x; S.pos.z = A.z; if (dt > 0) S.vel.set((A.x - px)/dt, 0, (A.z - pz)/dt);
      const bob = Math.sin(t*0.7 + S.ph)*0.1; let roll = Math.sin(t*0.55 + S.ph*2)*0.018, pit = Math.sin(t*0.45 + S.ph)*0.008;
      if (S.sinking) { S.sinking += dt; const k = Math.min(1, S.sinking/40); S.y = SEA_Y - k*k*(S.ud.top*0.55 + 6); roll += k*0.5*(S.ph % 2 > 1 ? 1 : -1); pit += k*0.16; if (S.sinking > 46) { S.gone = true; g.scene.remove(S.obj); g.scene.remove(S.wake); continue; } }
      else S.y = SEA_Y + bob;
      S.pos.y = S.y; S.obj.position.copy(S.pos); S.obj.rotation.set(pit, S.yaw, roll, 'YXZ');
      // the wake lies on the sea and trails where she has been; its foam drifts aft and it dies away as she slows
      { const W = S.wake, U = W.userData, k = Math.min(1, S.v/(S.sp*0.85)); W.position.set(S.pos.x, SEA_Y, S.pos.z); W.rotation.y = S.yaw; U.scroll -= S.v*dt*0.45/U.tile; if (U.scroll < -64) U.scroll += 64;
        if (U.tex && U.tex.offset) U.tex.offset.y = U.scroll; W.material.opacity = U.op = k*k*(0.9 + 0.1*Math.sin(t*1.7 + S.ph)); W.visible = S.v > 0.5 && !S.sinking; }
      const dP = near ? S.pos.distanceTo(near) : 1e9;
      // smoke from the funnels, foam under the forefoot, fire and smoke when she's hurt
      if (dP < 3600 && (S.fxT -= dt) <= 0) {
        S.fxT = 0.14 + (dP > 1500 ? 0.2 : 0); const f = S.hp/S.hpMax;
        if (!S.sinking || S.sinking < 20) for (const F of S.ud.funnels) { this.world(S, F[0], F[1], F[2], tV); const big = S.kind === 'freighter' || S.kind === 'tug' ? 1 : 0.7, c = S.kind === 'yacht' || S.kind === 'steamer' ? 0.42 : 0.16; fx.smoke.emit(tV.x, tV.y, tV.z, S.vel.x*0.3 + 0.6, 2.6, S.vel.z*0.3, 2.2*big, 5.5, c, c, c*1.02, 0.5, 2.4*big, 0.25, 0.5); }
        if (S.v > 1.5 && dP < 1800) { this.world(S, (Math.random() - 0.5)*2, 0.3, S.ud.bow - 1.5, tV); fx.smoke.emit(tV.x, SEA_Y + 0.4, tV.z, (Math.random() - 0.5)*3, 1.2, (Math.random() - 0.5)*3, 2.2, 1.1, 0.95, 0.98, 1, 0.5, 2.5, 1, -2); }
        if (f < 0.6 || S.sinking) { this.world(S, 0, S.ud.top*0.3, S.ud.len*0.12*Math.sin(S.ph*3), tV); fx.smoke.emit(tV.x, tV.y, tV.z, 0.5, 3, 0, 5, 4.5, 0.09, 0.085, 0.08, 0.75, 4, 0.3, 0.8); if (f < 0.3) fx.fire.emit(tV.x, tV.y - 1, tV.z, 0, 2, 0, 4.2, 0.4, 1, 0.55, 0.2, 1); }
      }
      if (dP > S.ud.radius + 450) continue;
      // the parked autogyro rides with her
      if (S.deck && S.deck.deck) { const Q = S.deck, D = Q.deck; D.t += dt;
        if (!Q.alive) { S.deck = null; Q.deck = null; }
        else { if (D.jump >= 0) { D.jump += dt/1.1; if (D.jump >= 1) { this.ride(Q, dt); this.launch(Q); } }
          else if (Q.isPlayer && g.running && !g.done && D.t > 0.8 && Q.wantLift && Q.throttle > 0.45 && !g.mission.holdOnGround) D.jump = 0;
          if (Q.deck) this.ride(Q, dt); } }
      // planes: the stage catches an autogyro; anything else that touches her hits something solid
      for (const p of g.planes) {
        if (!p.alive || p.frozen || p.remote || p.docked) continue;
        if (Math.abs(p.pos.x - S.pos.x) > S.ud.radius + 20 || Math.abs(p.pos.z - S.pos.z) > S.ud.radius + 20 || p.pos.y > S.y + S.ud.top + 6) continue;
        const l = this.local(S, p.pos, tL);
        if (p.deckFree && p.deckFree.ship === S) { if (t < p.deckFree.until) continue; p.deckFree = null; }
        if (S.pad && p.isPlayer && !(g.done) && !S.sinking && this.deckCheck(p, S, l)) continue;
        const hitp = this.inside(S, l, p.isPlayer ? 1.3 : 2.5); if (!hitp) continue;
        if (p.isPlayer && g.done) continue;
        if (!p.isPlayer || p.grace > 0) { p.pos.y = S.y + S.ud.top + 8; p.q.multiply(tQ.setFromAxisAngle(XV, -0.25)); continue; }   // AI pilots are hauled over the masthead instead
        G.HUD.feed(`You flew into ${S.the}`, false); p.destroy(null, 'crash');
      }
      // gunfire
      const R2 = (S.ud.radius + 8)**2;
      for (const b of g.bullets) { if (b.life <= 0 || b.pos.distanceToSquared(S.pos) > R2 || b.owner === S) continue; if (this.swept(S, b.pos, tV.copy(b.pos).addScaledVector(b.vel, dt), 0.2)) { fx.spark(b.pos, [1, 0.8, 0.5]); b.life = 0; this.hit(S, b.dmg*(b.ammo.a + b.ammo.i)*0.5, b.owner, b.pos); } }
      for (const r of g.rockets) { if (r.life <= 0 || r.arm > 0 || r.pos.distanceToSquared(S.pos) > R2 || r.owner === S) continue; if (this.swept(S, r.pos, tV.copy(r.pos).addScaledVector(r.vel, dt), 1)) { r.life = 0; this.hit(S, r.def.dmg*(r.def.id === 'he' ? 2.2 : r.def.id === 'ap' ? 1.7 : 0.8), r.owner, r.pos); } }
      // her guns: the Navy answers anyone wanted, pirates answer whoever shot at them
      if (S.armed && S.alive && P && P.alive && !P.deck && !g.done) {
        const angry = S.hostile > t || (S.faction === 'navy' && this.wanted >= 6);
        const tur = S.ud.turrets[0];
        if (angry && dP < S.range) {
          if (tur) tur.rotation.y += Math.max(-dt, Math.min(dt, angTo(tur.rotation.y + S.yaw, Math.atan2(P.pos.x - S.pos.x, P.pos.z - S.pos.z))));
          if ((S.gunT -= dt) <= 0 && P.pos.y > S.y + 12) { S.gunT = S.armed*(0.7 + Math.random()*0.6); const tt = Math.max(0.5, dP/420), e = 14 + dP*0.02;
            g.flakShell(S, this.world(S, 0, S.ud.top*0.3, S.ud.len*0.2, new V3()), P.pos.clone().addScaledVector(P.vel, tt).add(tV.set((Math.random() - 0.5)*e*2, (Math.random() - 0.5)*e, (Math.random() - 0.5)*e*2)), tt); }
        } else if (tur) tur.rotation.y += Math.max(-dt*0.4, Math.min(dt*0.4, angTo(tur.rotation.y, 0)));
      }
    }
  }
};
const tV = new V3(), tL = {x:0, y:0, z:0, yaw:0}, tM = {x:0, y:0, z:0}, tQ = new THREE.Quaternion(), UPV = new V3(0, 1, 0), XV = new V3(1, 0, 0);

/* ---------- who sails where: each region's lanes, built from its own water ---------- */
const SEA_REGIONS = {
  halcyon(sea){
    sea.law = 'customs';
    const inner = sea.ring(620, {name:'halcyon inner'}), outer = sea.ring(1150, {rev:true, a0:2.4, name:'halcyon outer'});
    sea.add('steamer', inner, {id:'belle', name:'Halcyon Belle', pad:true, at:0.07});
    sea.add('steamer', outer, {id:'queen', name:'Queen of the Coast', at:0.55, paint:[0xe9e4d6, 0x8e231c, 0xd8c9a0]});
    sea.add('yacht', sea.oval(5600, 1400, 520, 900, {name:'yacht'}), {id:'aurelia', name:'Aurelia', pad:true, at:0.3});
    sea.add('trawler', sea.oval(1000, 5300, 300, 420, {name:'bayport boats'}), {id:'maryellen', name:'Mary Ellen', at:0.1});
    sea.add('trawler', sea.oval(-4400, -3700, 260, 380, {name:'cove boats', rev:true}), {id:'cormorant', name:'Cormorant', at:0.6, paint:[0x2f4a6a, 0xe9e4d6, 0xb5382c]});
    sea.add('freighter', sea.ring(1800, {name:'halcyon far', a0:1}), {id:'pansierra', name:'Pan-Sierra Trader', at:0.8, paint:[0x26323a, 0x1f4d7a, 0xe9e4d6]});
  },
  keys(sea){
    sea.law = 'navy';
    sea.add('gunboat', sea.oval(-900, -1700, 620, 1000, {name:'gunboat', th:1.2, reach:2400}), {id:'resolute', name:'Resolute', faction:'navy', at:0.2});
    // the Santa Rosalía is a tramp with a stage aft, a false bottom forward and friends at the Rusty Anchor; La Golondrina is the corsair she meets at night
    sea.add('freighter', sea.oval(2300, -600, 420, 680, {name:'smuggler', reach:2400}), {id:'rosalia', name:'Santa Rosalía', pad:true, at:0.5, speed:5, paint:[0x3a2e2a, 0xd9b44a, 0xe9e4d6]});
    sea.add('schooner', sea.oval(700, 1300, 300, 480, {name:'golondrina', reach:2400}), {id:'golondrina', name:'La Golondrina', faction:'pirate', bounty:600, at:0.5});
    sea.add('schooner', sea.oval(3600, 2700, 300, 520, {name:'isle schooner', reach:2400, rev:true}), {id:'seawitch', name:'Sea Witch', faction:'pirate', bounty:600, at:0.1, paint:[0x26221f, 0xd9b44a, 0xcfc3a2]});
    sea.add('steamer', sea.oval(300, -3600, 900, 1500, {name:'packet', th:1.57, reach:2600}), {id:'maravilla', name:'Maravilla Packet', at:0.4, paint:[0xe9e4d6, 0x2f5d3a, 0xe2c27a]});
    sea.add('trawler', sea.oval(-700, 2500, 240, 340, {name:'puerto boats', reach:2000}), {id:'santaines', name:'Santa Inés', at:0.7, paint:[0x1f6f9e, 0xf1e9d6, 0xd9b44a]});
  },
  calavera(sea){
    sea.law = 'navy';
    // a prize convoy round the island: the packet Star of Maravilla, taken by the Brethren last week with her stage still on her, a galleon ahead and one astern
    const ring = sea.ring(560, {name:'calavera ring'}), sp = 4.2, gap = ring ? 190/ring.len : 0;
    sea.add('galleon', ring, {id:'blacktide', name:'Black Tide', faction:'pirate', bounty:1500, at:0.62 + gap, speed:sp});
    sea.add('steamer', ring, {id:'prize', name:'Star of Maravilla', faction:'pirate', pad:true, at:0.62, speed:sp, paint:[0xe9e4d6, 0x2f5d3a, 0xe2c27a]});
    sea.add('galleon', ring, {id:'widow', name:'Widow\'s Kiss', faction:'pirate', bounty:1500, at:0.62 - gap, speed:sp, paint:[0x2a1a1a, 0x1c1a1a, 0xb88a2a]});
    sea.add('schooner', sea.oval(-1300, -5600, 300, 520, {name:'jawbone schooner', th:1.57}), {id:'hangman', name:'Hangman\'s Daughter', faction:'pirate', bounty:500, at:0.3, paint:[0x1c1a1a, 0x9e1b1b, 0x26221f]});
    sea.add('schooner', sea.oval(-5300, 2700, 280, 480, {name:'cinder schooner', rev:true}), {id:'cinderella', name:'Cinder Rose', faction:'pirate', bounty:500, at:0.8});
    sea.add('trawler', sea.oval(4300, -3400, 240, 360, {name:'ashfall boats'}), {id:'brimstone', name:'Brimstone Lass', at:0.5, paint:[0x5a5a40, 0xd8c890, 0x8e231c]});
  },
  rustwater(sea){
    const RU = G.RUST, rx = RU.rx, c = sea.c, side = (z, off) => { const sl = RU.slope(z), n = Math.hypot(1, sl); return [rx(z) + off/n, z - off*sl/n]; };
    // up one side of the channel and down the other, a round turn at each end
    const reach = (z0, z1, off, step = 150) => { const p = []; for (let z = z0; z <= z1 + 1; z += step) p.push(side(Math.min(z, z1), off)); p.push([rx(z1 + 30), z1 + 42]); for (let z = z1; z >= z0 - 1; z -= step) p.push(side(Math.max(z, z0), -off)); p.push([rx(z0 - 30), z0 - 42]); return p; };
    const bridge = (L, z) => { for (const sg of [1, -1]) { const q = side(z, sg*34); sea.hold(L, q[0], q[1], 118, () => c.drawT !== undefined && c.drawT >= 68 && c.drawT <= 86); } };
    const up = sea.lane(reach(-4400, -1990, 34), {name:'river shuttle'}); if (up) bridge(up, -2700);
    sea.add('freighter', up, {id:'ironbound', name:'Ironbound', at:0.05});
    // the long haul: out round the bay and back up to the turning basin below the Old Stone Bridge
    const bay = reach(-5000, -1990, 34); bay.pop(); const bx = rx(-6400);
    bay.push(side(-5300, -60), [bx + 500, -5900], [bx + 900, -6700], [bx + 300, -7500], [bx - 700, -7400], [bx - 1100, -6600], [bx - 600, -5800], side(-5300, 60));
    const long = sea.lane(bay, {name:'bay haul'}); if (long) bridge(long, -2700);
    sea.add('freighter', long, {id:'kessler', name:'Maud Kessler', pad:true, at:0.42, paint:[0x1b1a1a, 0x1f4d7a, 0xe9e4d6]});
    sea.add('tug', sea.lane(reach(-4250, -1930, 70, 180), {name:'harbour tug'}), {id:'bertha', name:'Little Bertha', at:0.3});
    sea.add('tug', sea.lane(reach(-1470, 760, 40, 180), {name:'town tug'}), {id:'hercules', name:'Hercules', at:0.7, paint:[0x2a3a2a, 0xd9b44a, 0xe9e4d6]});
    sea.add('steamer', sea.oval(bx + 1500, -7300, 520, 800, {name:'bay packet'}), {id:'gantryq', name:'Gantry Queen', pad:true, at:0.2, paint:[0xe9e4d6, 0x7a2a20, 0xd8c9a0]});
    sea.add('trawler', sea.oval(bx - 1900, -6900, 260, 380, {name:'bay boats', rev:true}), {id:'kittiwake', name:'Kittiwake', at:0.5});
  }
};
/* put the region's ships to sea. c is the mission (or its scene): it supplies the drawbridge clock, police heat and gangs */
G.shipping = (c, g, rid) => {
  if (!SEA_REGIONS[rid]) return null;
  if (!g.traffic) g.traffic = new G.Traffic(g);
  const sea = new G.Sea(g, c, {region:rid, night:g.world.time === 'night' || g.world.time === 'evening'});
  SEA_REGIONS[rid](sea);
  return sea;
};
G.SEA_REGIONS = SEA_REGIONS;
/* ==== SEA END ==== */
})();
