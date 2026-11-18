(function(){
'use strict';
/* Traffic: a street grid with cars for Port Halcyon, and civilian planes and an advertising blimp circling the city and
   flying the airway out to the back-country strip. All kinematic scenery: nothing here can be shot or crashed into. */
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
})();
