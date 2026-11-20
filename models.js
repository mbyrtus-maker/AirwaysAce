(function(){
'use strict';
/* Models built in code: flat-shaded low-poly solids in the Synty POLYGON manner. No texture or model files.
   Plane frame: nose +Z, up +Y, the pilot's right is -X (left wing at +X). Metres.
   Everything static is written as triangle soup into a Kit, which batches it into ONE mesh per material,
   so a plane costs about a dozen draw calls however many struts and decals it carries. See STYLE.md. */
const G = window.G, V3 = THREE.Vector3, PI = Math.PI;

/* ---------- materials ---------- */
const MATS = new Map();
G.mat = (hex, o = {}) => {
  const k = hex + JSON.stringify(o);
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial(Object.assign({color:hex, flatShading:true, roughness:0.58, metalness:0.06}, o)));
  return MATS.get(k);
};
/* lit windows: the warm window glass glows brighter at dusk and at night (shared cached materials) */
G.setNightWindows = time => {
  for (const m of MATS.values()) {
    if (!m.emissive || m.emissive.getHex() !== 0xffc45a) continue;
    if (m.userData.baseEI === undefined) m.userData.baseEI = m.emissiveIntensity;
    m.emissiveIntensity = time === 'night' ? Math.max(m.userData.baseEI, 1.6) : time === 'evening' ? Math.max(m.userData.baseEI, 0.8) : m.userData.baseEI;
  }
};
const LAMPS = new Map();
const lamp = hex => { if (!LAMPS.has(hex)) LAMPS.set(hex, new THREE.MeshBasicMaterial({color:hex})); return LAMPS.get(hex); };
/* There is no environment map, so metalness stays at or below 0.45: more than that just turns black. */
const GLASS = () => G.mat(0x9fd3e6, {roughness:0.12, metalness:0.1, transparent:true, opacity:0.5});
const DARK  = () => G.mat(0x26221f, {roughness:0.8});
const INK   = () => G.mat(0x151312, {roughness:0.9});
const BONE  = () => G.mat(0xf1e9d6, {roughness:0.8});
const STEEL = () => G.mat(0xb9bec4, {roughness:0.3, metalness:0.4});
const BRASS = () => G.mat(0xdba63e, {roughness:0.34, metalness:0.45});
const WINDOW = () => G.mat(0x3b3424, {roughness:0.3, emissive:0xffc45a, emissiveIntensity:0.85});

/* ---------- affine matrices, row-major 3x4: [xx,xy,xz,tx, yx,yy,yz,ty, zx,zy,zz,tz] ---------- */
const T = (x, y, z) => [1,0,0,x, 0,1,0,y, 0,0,1,z];
const SC = (x, y = x, z = x) => [x,0,0,0, 0,y,0,0, 0,0,z,0];
const RX = a => { const c = Math.cos(a), s = Math.sin(a); return [1,0,0,0, 0,c,-s,0, 0,s,c,0]; };
const RY = a => { const c = Math.cos(a), s = Math.sin(a); return [c,0,s,0, 0,1,0,0, -s,0,c,0]; };
const RZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c,-s,0,0, s,c,0,0, 0,0,1,0]; };
const MIRX = SC(-1, 1, 1);
const mul2 = (A, B) => [
  A[0]*B[0] + A[1]*B[4] + A[2]*B[8],  A[0]*B[1] + A[1]*B[5] + A[2]*B[9],  A[0]*B[2] + A[1]*B[6] + A[2]*B[10],  A[0]*B[3] + A[1]*B[7] + A[2]*B[11] + A[3],
  A[4]*B[0] + A[5]*B[4] + A[6]*B[8],  A[4]*B[1] + A[5]*B[5] + A[6]*B[9],  A[4]*B[2] + A[5]*B[6] + A[6]*B[10],  A[4]*B[3] + A[5]*B[7] + A[6]*B[11] + A[7],
  A[8]*B[0] + A[9]*B[4] + A[10]*B[8], A[8]*B[1] + A[9]*B[5] + A[10]*B[9], A[8]*B[2] + A[9]*B[6] + A[10]*B[10], A[8]*B[3] + A[9]*B[7] + A[10]*B[11] + A[11]];
const mul = (...m) => m.reduce(mul2);                       // mul(A, B, C): C is applied to the point first
/* Transform triangle soup. A mirroring matrix flips the winding back so faces keep pointing outward. */
function xf(tris, M){
  const o = new Array(tris.length);
  for (let i = 0; i < tris.length; i += 3) {
    const x = tris[i], y = tris[i+1], z = tris[i+2];
    o[i] = M[0]*x + M[1]*y + M[2]*z + M[3]; o[i+1] = M[4]*x + M[5]*y + M[6]*z + M[7]; o[i+2] = M[8]*x + M[9]*y + M[10]*z + M[11];
  }
  const det = M[0]*(M[5]*M[10] - M[6]*M[9]) - M[1]*(M[4]*M[10] - M[6]*M[8]) + M[2]*(M[4]*M[9] - M[5]*M[8]);
  if (det < 0) for (let i = 0; i < o.length; i += 9) for (let j = 0; j < 3; j++) { const t = o[i+3+j]; o[i+3+j] = o[i+6+j]; o[i+6+j] = t; }
  return o;
}
/* Matrix that carries local +Y onto the segment a->b, centred on its midpoint. For a level bar local Z ends up vertical. */
function aimY(a, b){
  let yx = b[0] - a[0], yy = b[1] - a[1], yz = b[2] - a[2]; const L = Math.hypot(yx, yy, yz) || 1; yx /= L; yy /= L; yz /= L;
  const r = Math.abs(yy) < 0.9 ? [0, 1, 0] : [0, 0, 1];
  let xx = yy*r[2] - yz*r[1], xy = yz*r[0] - yx*r[2], xz = yx*r[1] - yy*r[0]; const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
  const zx = xy*yz - xz*yy, zy = xz*yx - xx*yz, zz = xx*yy - xy*yx;
  return [xx, yx, zx, (a[0] + b[0])/2, xy, yy, zy, (a[1] + b[1])/2, xz, yz, zz, (a[2] + b[2])/2];
}

/* ---------- Kit: collects triangle soup per material, then builds one mesh per material ---------- */
class Kit {
  constructor(){ this.b = new Map(); }
  add(tris, mat, M){
    let a = this.b.get(mat); if (!a) this.b.set(mat, a = []);
    const t = M ? xf(tris, M) : tris;
    for (let i = 0; i < t.length; i++) a.push(t[i]);
    return this;
  }
  both(tris, mat, M){ this.add(tris, mat, M); return this.add(tris, mat, M ? mul2(MIRX, M) : MIRX); }   // port and starboard
  /* Flat decal layers stacked along the decal's local +Z so they never z-fight. */
  decal(M, layers, both = false, step = 0.012){
    layers.forEach((l, i) => { const m = mul2(M, T(0, 0, i*step)); if (both) this.both(l[0], l[1], m); else this.add(l[0], l[1], m); });
    return this;
  }
  build(g){
    for (const [mat, a] of this.b) {
      if (!a.length) continue;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(a), 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat), solid = !mat.transparent && !mat.isMeshBasicMaterial;
      m.castShadow = solid; m.receiveShadow = solid; g.add(m);
    }
    return g;
  }
}

/* ---------- primitive vocabulary (all return triangle soup with outward-facing triangles) ---------- */
function tri(o, a, b, c){
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
  if (nx*nx + ny*ny + nz*nz < 1e-14) return;                // collapsed triangle (a ring pinched to a point)
  o.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
}
function quad(o, a, b, c, d){ tri(o, a, b, c); tri(o, a, c, d); }
/* Make a solid face outward: signed volume about the centroid, flip every triangle if it comes out negative. */
function fix(o){
  const n = o.length/3; let cx = 0, cy = 0, cz = 0, vol = 0;
  for (let i = 0; i < o.length; i += 3) { cx += o[i]; cy += o[i+1]; cz += o[i+2]; }
  cx /= n; cy /= n; cz /= n;
  for (let i = 0; i < o.length; i += 9) {
    const ax = o[i] - cx, ay = o[i+1] - cy, az = o[i+2] - cz, bx = o[i+3] - cx, by = o[i+4] - cy, bz = o[i+5] - cz, ex = o[i+6] - cx, ey = o[i+7] - cy, ez = o[i+8] - cz;
    vol += ax*(by*ez - bz*ey) - ay*(bx*ez - bz*ex) + az*(bx*ey - by*ex);
  }
  if (vol < 0) for (let i = 0; i < o.length; i += 9) for (let j = 0; j < 3; j++) { const t = o[i+3+j]; o[i+3+j] = o[i+6+j]; o[i+6+j] = t; }
  return o;
}
/* Skin a stack of rings (arrays of [x,y,z], all the same length, each convex) and cap the ends. The workhorse. */
function loft(rings, capA = true, capB = true){
  const o = [], n = rings[0].length;
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) { const j2 = (j + 1) % n; quad(o, rings[i][j], rings[i][j2], rings[i+1][j2], rings[i+1][j]); }
  if (capA) { const r = rings[0]; for (let j = 1; j < n - 1; j++) tri(o, r[0], r[j+1], r[j]); }
  if (capB) { const r = rings[rings.length - 1]; for (let j = 1; j < n - 1; j++) tri(o, r[0], r[j], r[j+1]); }
  return fix(o);
}
/* Body of revolution along Z from [radius, z] pairs. n-sided, with a flat facet (not an edge) on each side, top and bottom. */
function lathe(profile, n, sx = 1, sy = 1, caps = true){
  return loft(profile.map(p => { const r = []; for (let j = 0; j < n; j++) { const a = (j + 0.5)*2*PI/n; r.push([Math.cos(a)*p[0]*sx, Math.sin(a)*p[0]*sy, p[1]]); } return r; }), caps, caps);
}
function cyl(rTop, rBot, h, n, caps = true){                // axis Y, centred, like THREE.CylinderGeometry
  const R = (r, y) => { const p = []; for (let j = 0; j < n; j++) { const a = (j + 0.5)*2*PI/n; p.push([Math.cos(a)*r, y, Math.sin(a)*r]); } return p; };
  return loft([R(rBot, -h/2), R(rTop, h/2)], caps, caps);
}
function box(w, h, d){ const x = w/2, y = h/2, z = d/2; return loft([[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z]], [[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]]]); }
function ball(r, n = 8, m = 5){ const p = []; for (let i = 0; i <= m; i++) { const t = -PI/2 + i*PI/m; p.push([Math.cos(t)*r, Math.sin(t)*r]); } return lathe(p, n); }
function torus(R, r, nR, nr){                               // lies in the XY plane, axis Z, like THREE.TorusGeometry
  const rings = [];
  for (let i = 0; i <= nR; i++) { const u = (i % nR)*2*PI/nR, ring = []; for (let j = 0; j < nr; j++) { const v = (j + 0.5)*2*PI/nr, q = R + r*Math.cos(v); ring.push([q*Math.cos(u), q*Math.sin(u), r*Math.sin(v)]); } rings.push(ring); }
  return loft(rings, false, false);
}
const bar = (a, b, w, h = w) => xf(box(w, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), h), aimY(a, b));              // square strut or girder
const tube = (a, b, r, n = 6, caps = true, r2 = r) => xf(cyl(r2, r, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n, caps), aimY(a, b));
const wire = (a, b, r = 0.014) => tube(a, b, r, 3, false);                                                              // bracing wire, rigging
/* Flat shapes for decals: they lie in the local XY plane and face local +Z. Points run counter-clockwise. */
function poly(pts){ const o = []; for (let j = 1; j < pts.length - 1; j++) tri(o, [pts[0][0], pts[0][1], 0], [pts[j][0], pts[j][1], 0], [pts[j+1][0], pts[j+1][1], 0]); return o; }
function disc(r, n = 12){ const p = []; for (let j = 0; j < n; j++) { const a = (j + 0.5)*2*PI/n; p.push([Math.cos(a)*r, Math.sin(a)*r]); } return poly(p); }
function ring(r0, r1, n = 12){ const o = []; for (let j = 0; j < n; j++) { const a = j*2*PI/n, b = (j + 1)*2*PI/n; quad(o, [Math.cos(a)*r0, Math.sin(a)*r0, 0], [Math.cos(a)*r1, Math.sin(a)*r1, 0], [Math.cos(b)*r1, Math.sin(b)*r1, 0], [Math.cos(b)*r0, Math.sin(b)*r0, 0]); } return o; }
function star(R, r, n = 5){ const o = [], h = PI/n; for (let i = 0; i < n; i++) { const a = PI/2 + i*2*h, O = [Math.cos(a)*R, Math.sin(a)*R, 0]; tri(o, [0,0,0], [Math.cos(a - h)*r, Math.sin(a - h)*r, 0], O); tri(o, [0,0,0], O, [Math.cos(a + h)*r, Math.sin(a + h)*r, 0]); } return o; }
const move = (tris, x, y) => xf(tris, T(x, y, 0));
/* Decal placement: on a +X side (local x runs aft, y up), or on a top surface (local y runs forward, so art is upright from the chase camera). */
const onSide = (x, y, z, yaw = 0) => mul(T(x, y, z), RY(PI/2 + yaw));
const onTop = (x, y, z, roll = 0) => mul(T(x, y, z), RZ(roll), RX(-PI/2), RZ(PI));

/* Profiles are [radius, z] lists, tail to nose. rAt reads the radius at any z, cut takes a slice for a paint block. */
const rAt = (p, z) => { for (let i = 0; i < p.length - 1; i++) if (z <= p[i+1][1]) { const t = (z - p[i][1])/(p[i+1][1] - p[i][1]); return p[i][0] + (p[i+1][0] - p[i][0])*Math.max(0, t); } return p[p.length - 1][0]; };
const cut = (p, z0, z1) => [[rAt(p, z0), z0], ...p.filter(q => q[1] > z0 + 1e-6 && q[1] < z1 - 1e-6), [rAt(p, z1), z1]];
/* Speed stripe on the +X side facet of an n-sided lathe body. lo and hi are fractions of the local radius (|k| < sin(pi/n)). */
function stripe(p, z0, z1, lo, hi, sx, sy, n, off = 0.015){
  const o = [], cf = Math.cos(PI/n), zs = cut(p, z0, z1).map(q => q[1]), P = (z, k) => [rAt(p, z)*cf*sx + off, rAt(p, z)*k*sy, z];
  for (let i = 0; i < zs.length - 1; i++) quad(o, P(zs[i], lo), P(zs[i], hi), P(zs[i+1], hi), P(zs[i+1], lo));
  return o;
}
/* Faceted aerofoil section at span station x: chord c, thickness th, centred on (yc, zc). Blunt nose, thin tail. */
const foil = (x, c, th, zc, yc) => [[x, yc + 0.18*th, zc + 0.5*c], [x, yc + 0.5*th, zc + 0.2*c], [x, yc + 0.46*th, zc - 0.15*c], [x, yc + 0.06*th, zc - 0.5*c],
                                    [x, yc - 0.06*th, zc - 0.5*c], [x, yc - 0.42*th, zc - 0.1*c], [x, yc - 0.46*th, zc + 0.25*c], [x, yc - 0.18*th, zc + 0.5*c]];
/* A wing is a function t (0 root .. 1 tip) -> [x, chord, thickness, zc, yc]. pan() takes a spanwise slice so paint blocks meet exactly. */
const pan = (f, a, b) => loft([foil(...f(a)), foil(...f(b))]);
const tipOf = (f, dx, kc) => { const s = f(1); return loft([foil(...s), foil(s[0] + dx, s[1]*kc, s[2]*0.6, s[3] - s[1]*0.1, s[4])]); };   // rounded tip cap

/* ---------- shared parts ---------- */
function propeller(blades, len, chord, bladeMat, tipMat, spinMat, spin){
  const prop = new THREE.Group(), k = new Kit(), R = len/2, th = len/3;
  const sec = (y, c, t) => [[-c/2, y, -t/2], [c/2, y, -t/2], [c/2, y, t/2], [-c/2, y, t/2]];
  for (let i = 0; i < blades; i++) {
    const M = mul(RZ(i*2*PI/blades), RY(0.42));
    k.add(loft([sec(R*0.06, chord*0.5, 0.09*th), sec(R*0.45, chord, 0.07*th), sec(R*0.84, chord*0.8, 0.05*th)]), bladeMat, M);
    k.add(loft([sec(R*0.84, chord*0.8, 0.05*th), sec(R, chord*0.45, 0.04*th)]), tipMat, M);
  }
  if (spin) k.add(lathe(spin, 8), spinMat);
  k.build(prop);
  const blur = new THREE.Mesh(new THREE.CircleGeometry(R, 20), new THREE.MeshBasicMaterial({color:0x2a2622, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide}));
  prop.add(blur); prop.userData.disc = blur;
  return prop;
}
function pilotHead(g, x, y, z, hex){
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 7, 5), G.mat(hex)); head.position.set(x, y, z); head.castShadow = true; head.name = 'pilot'; g.add(head);
}
/* The crew's roundel: second-colour disc, trim-colour disc, second-colour star. */
const emblem = (r, mS, mT) => [[disc(r, 14), mS], [disc(r*0.72, 12), mT], [star(r*0.62, r*0.26), mS]];
/* The Black Lantern skull, unit radius: trim ring, black field, bone skull. */
function skull(mT){
  const bone = move(disc(0.5, 10), 0, 0.14);
  for (const v of poly([[-0.25,-0.62],[0.25,-0.62],[0.3,-0.2],[-0.3,-0.2]])) bone.push(v);
  const ink = [];
  for (const sx of [1, -1]) { for (const v of move(disc(0.15, 6), sx*0.2, 0.12)) ink.push(v); for (const v of poly([[sx*0.09 - 0.02,-0.62],[sx*0.09 + 0.02,-0.62],[sx*0.09 + 0.02,-0.4],[sx*0.09 - 0.02,-0.4]])) ink.push(v); }
  for (const v of poly([[0,-0.08],[-0.07,-0.24],[0.07,-0.24]])) ink.push(v);
  return [[disc(1, 14), mT], [disc(0.86, 14), INK()], [bone, BONE()], [ink, INK()]];
}

/* ---------- Gallant: 1930s low-wing racer-fighter, radial engine, spatted gear ----------
   Paint: main = fuselage and wings, second = stripes and star, trim = cowling, wingtips, spine and spats. */
function gallant(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr);
  const SY = 1.06, F = [[0.04,-4.75],[0.16,-4.45],[0.34,-3.6],[0.55,-2.4],[0.74,-0.9],[0.82,0.6],[0.84,2.0],[0.80,3.0]];
  // fuselage, eight-sided, in paint blocks
  k.add(lathe(cut(F, -4.75, -4.0), 8, 1, SY), mT);
  k.add(lathe(cut(F, -4.0, -2.4), 8, 1, SY, false), mP);
  k.add(lathe(cut(F, -2.4, -1.9), 8, 1, SY, false), mS);
  k.add(lathe(cut(F, -1.9, 3.0), 8, 1, SY), mP);
  k.both(stripe(F, -4.0, 3.0, -0.06, 0.2, 1, SY, 8), mS);                                    // speed stripe, nose to tail
  k.decal(onSide(0.9239*rAt(F, -1.4) + 0.03, 0.02, -1.4, 0.117), emblem(0.25, mS, mT), true);
  // radial engine: gill ring, cowling, polished lip, seven cylinders
  k.add(lathe([[0.80,2.92],[0.90,3.08]], 12, 1, 1, false), STEEL());
  k.add(lathe([[0.90,3.08],[0.92,3.45],[0.89,3.9]], 12, 1, 1, false), mT);
  k.add(lathe([[0.89,3.9],[0.80,4.06],[0.66,4.08]], 12, 1, 1, false), STEEL());
  k.add(disc(0.84, 12), INK(), T(0, 0, 3.9));
  for (let i = 0; i < 7; i++) { const a = i*2*PI/7 + 0.2; k.add(cyl(0.09, 0.12, 0.4, 6), STEEL(), mul(T(Math.cos(a)*0.45, Math.sin(a)*0.45, 3.99), RZ(a - PI/2))); }
  k.add(lathe([[0.27,3.9],[0.22,4.1]], 8), G.mat(0x6d7278));
  k.both(tube([0.76,-0.42,2.95], [0.79,-0.52,1.7], 0.075, 6), DARK());                        // exhaust pipes
  // greenhouse canopy (one convex glass solid around the pilot's eye, so it never tints the cockpit view), frames, spine fairing
  const can = (z, wb, wt, yb, yt) => [[-wb, yb, z], [wb, yb, z], [wt, yt, z], [-wt, yt, z]];
  k.add(loft([can(1.15, 0.34, 0.30, 0.70, 0.80), can(0.55, 0.44, 0.27, 0.70, 1.44), can(-0.80, 0.44, 0.27, 0.70, 1.46)]), GLASS());
  k.add(loft([can(-0.80, 0.45, 0.28, 0.66, 1.47), can(-1.7, 0.36, 0.15, 0.55, 1.02), can(-2.9, 0.1, 0.04, 0.36, 0.50)]), mT);
  for (const [a, b] of [[[0.32,0.78,1.14],[0.27,1.44,0.55]], [[0.44,0.72,0.55],[0.27,1.44,0.55]], [[0.44,0.72,-0.8],[0.27,1.46,-0.8]], [[0.27,1.45,0.55],[0.27,1.46,-0.8]], [[0.45,0.72,0.55],[0.45,0.72,-0.8]]])
    k.both(bar(a, b, 0.05), STEEL());
  k.add(bar([-0.27,1.44,0.55], [0.27,1.44,0.55], 0.05), STEEL());
  k.add(bar([-0.27,1.46,-0.8], [0.27,1.46,-0.8], 0.05), STEEL());
  // ring-and-bead gunsight on the nose deck, on the eye line
  k.add(bar([0,0.80,1.3], [0,1.092,1.3], 0.022), DARK());
  k.add(torus(0.06, 0.009, 10, 4), DARK(), T(0, 1.15, 1.3));
  k.add(bar([0,0.8,2.7], [0,1.15,2.7], 0.02), DARK());
  // cockpit: coaming with brass dials, seat, pilot
  k.add(box(0.8, 0.2, 0.1), DARK(), T(0, 0.82, 0.52));
  for (const x of [-0.2, 0, 0.2]) k.add(ring(0.03, 0.055, 8), BRASS(), mul(T(x, 0.85, 0.465), RY(PI)));
  k.add(box(0.4, 0.5, 0.08), DARK(), T(0, 1.0, -0.6));
  k.add(box(0.46, 0.36, 0.26), G.mat(0x6b4a2e), T(0, 0.8, -0.32));
  k.add(box(0.3, 0.07, 0.3), BONE(), T(0, 0.97, -0.32));
  pilotHead(g, 0, 1.1, -0.3, 0x5a3a22);
  // skyhook for the trapeze: the bar sits 1.6 m above the plane's origin
  k.add(bar([0,1.46,-0.8], [0,1.6,-0.02], 0.05), STEEL());
  k.add(torus(0.09, 0.022, 8, 4), STEEL(), mul(T(0, 1.6, 0.05), RY(PI/2)));
  // wings: main, cream stripe, trim tips, star roundels on top
  const gw = t => [0.5 + 4.6*t, 2.05 - 1.0*t, 0.27*(1 - 0.45*t), 0.85 - 0.5*t, -0.52 + 0.42*t];
  k.both(pan(gw, 0, 0.62), mP); k.both(pan(gw, 0.62, 0.72), mS); k.both(pan(gw, 0.72, 1), mT); k.both(tipOf(gw, 0.22, 0.55), mT);
  k.decal(onTop(2.156, -0.236, 0.71, 0.078), emblem(0.45, mS, mT), true);
  k.both(tube([1.9,-0.35,1.3], [1.9,-0.35,1.9], 0.05, 6), DARK());                            // wing guns
  k.both(box(0.16, 0.12, 0.5), mP, T(1.9, -0.33, 1.35));
  for (const sx of [1, -1]) k.add(tube([sx*0.3,0.84,2.0], [sx*0.3,0.86,2.95], 0.045, 6), DARK());   // nose guns
  k.both(box(0.06, 0.16, 0.5), STEEL(), T(2.6, -0.5, 0.75));                                  // rocket rails
  k.both(box(0.07, 0.06, 1.3), STEEL(), T(2.6, -0.61, 0.8));
  k.add(tube([4.3,-0.14,0.6], [4.3,-0.14,1.35], 0.02, 4), STEEL());                           // pitot
  k.add(box(0.1, 0.07, 0.16), lamp(0xff3b30), T(5.28, -0.1, 0.35)); k.add(box(0.1, 0.07, 0.16), lamp(0x47e36a), T(-5.28, -0.1, 0.35));
  // tail
  const gt = t => [0.1 + 1.85*t, 1.25 - 0.55*t, 0.13, -3.8 - 0.25*t, 0.2];
  k.both(pan(gt, 0, 0.68), mP); k.both(pan(gt, 0.68, 1), mT); k.both(tipOf(gt, 0.14, 0.6), mT);
  const gf = t => [0.1 + 1.45*t, 1.55 - 0.8*t, 0.13, -3.8 - 0.4*t, 0], FIN = mul(T(0, 0.15, 0), RZ(PI/2));
  k.add(pan(gf, 0, 0.5), mP, FIN); k.add(pan(gf, 0.5, 0.7), mS, FIN); k.add(pan(gf, 0.7, 1), mT, FIN); k.add(tipOf(gf, 0.14, 0.6), mT, FIN);
  k.add(bar([0,-0.2,-4.15], [0,-0.55,-4.5], 0.06), DARK());
  k.add(bar([0,1.0,-1.6], [0,1.75,-1.7], 0.035), STEEL());                                    // aerial mast and wire
  k.add(wire([0,1.75,-1.7], [0,1.82,-4.2]), DARK());
  // spatted gear
  k.both(box(0.18, 0.85, 0.5), mP, T(1.6, -0.95, 1.1));
  k.both(lathe([[0.03,-0.95],[0.28,-0.55],[0.42,0.05],[0.36,0.5],[0.12,0.8]], 8, 0.5, 0.95), mT, T(1.6, -1.5, 1.05));
  k.both(cyl(0.34, 0.34, 0.2, 10), DARK(), mul(T(1.6, -1.68, 1.1), RZ(PI/2)));
  k.build(g);
  const prop = propeller(2, 3.0, 0.27, DARK(), mT, mS, [[0.25,-0.04],[0.24,0.12],[0.14,0.36],[0.03,0.5]]); prop.position.set(0, 0, 4.14); g.add(prop);
  g.userData = {prop, muzzles:[new V3(1.9, -0.35, 1.9), new V3(-1.9, -0.35, 1.9), new V3(0.3, 0.86, 2.95), new V3(-0.3, 0.86, 2.95)],
                rails:[new V3(2.6, -0.75, 0.9), new V3(-2.6, -0.75, 0.9)], radius:5.6, cockpit:new V3(0, 1.15, -0.25), exhaust:new V3(0, -0.45, 2.2), gear:2.02};
  return g;
}

/* ---------- Vandal: pirate parasol-wing light fighter, pointed inline nose ----------
   Paint: main = fuselage, second = wing and tail, trim = wingtips, spinner, tail band and skull ring. */
function vandal(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr);
  const SX = 0.9, SY = 1.12, F = [[0.04,-4.1],[0.2,-3.7],[0.44,-2.2],[0.6,-0.4],[0.64,1.4],[0.57,2.5],[0.4,3.3],[0.2,3.72]];
  const sideX = z => 0.9239*rAt(F, z)*SX;
  k.add(lathe(cut(F, -4.1, -2.9), 8, SX, SY), mP);
  k.add(lathe(cut(F, -2.9, -2.5), 8, SX, SY, false), mT);
  k.add(lathe(cut(F, -2.5, 1.4), 8, SX, SY), mP);
  k.add(lathe(cut(F, 1.4, 3.72), 8, SX, SY), STEEL());                                        // bare-metal engine cowling
  for (let i = 0; i < 5; i++) { const z = 1.65 + i*0.26; k.both(box(0.12, 0.08, 0.24), DARK(), mul(T(sideX(z) + 0.03, 0.14, z), RY(-0.5))); }   // exhaust stubs
  // chin radiator with the shark mouth on its flat sides, and an angry eye above it
  const chin = (z, hw, yT, yB) => [[-hw, yB, z], [hw, yB, z], [hw, yT, z], [-hw, yT, z]];
  k.add(loft([chin(0.7, 0.18, -0.35, -0.6), chin(1.6, 0.40, -0.2, -0.92), chin(2.9, 0.38, -0.2, -0.86), chin(3.25, 0.2, -0.22, -0.5)]), mP);
  k.add(box(0.3, 0.22, 0.06), INK(), T(0, -0.37, 3.24));
  const mouth = [[-0.72,0.06],[-0.35,-0.2],[0.3,-0.2],[0.62,0],[0.3,0.2],[-0.35,0.2]], teeth = [];
  for (let i = 0; i < 4; i++) { const x = -0.34 + i*0.16; for (const v of poly([[x,0.2],[x + 0.08,0.03],[x + 0.16,0.2]])) teeth.push(v); for (const v of poly([[x,-0.2],[x + 0.16,-0.2],[x + 0.08,-0.03]])) teeth.push(v); }
  k.decal(mul(onSide(0.405, -0.67, 2.25, -0.0154), SC(0.9)), [[xf(poly(mouth), SC(1.14, 1.3, 1)), mT], [poly(mouth), INK()], [teeth, BONE()]], true);
  k.decal(onSide(sideX(2.3) + 0.02, 0.08, 2.3, -0.07), [[disc(0.11, 8), BONE()], [move(disc(0.05, 6), -0.03, -0.01), INK()], [poly([[-0.16,0.03],[0.12,0.13],[0.12,0.2],[-0.16,0.1]]), INK()]], true);
  // parasol wing with skull roundels, cabane and lift struts, bracing wires
  const vw = t => [0.55 + 3.85*t, 1.73 - 0.48*t, 0.2*(1 - 0.4*t), 0.62 - 0.22*t, 1.46 + 0.09*t];
  k.add(loft([foil(-0.55, 1.2, 0.2, 0.885, 1.46), foil(0.55, 1.2, 0.2, 0.885, 1.46)]), mS);       // centre section with a trailing-edge cut-out over the cockpit
  k.both(pan(vw, 0, 0.68), mS); k.both(pan(vw, 0.68, 1), mT); k.both(tipOf(vw, 0.2, 0.55), mT);
  k.decal(mul(onTop(1.85, 1.595, 0.585, 0.0136), SC(0.5)), skull(mT), true, 0.03);
  for (const [a, b] of [[[0.36,0.5,1.25],[0.7,1.4,1.15]], [[0.36,0.5,0.2],[0.7,1.4,0.3]]]) k.both(bar(a, b, 0.04, 0.08), DARK());
  for (const [a, b] of [[[0.45,-0.3,0.9],[2.7,1.44,0.85]], [[0.45,-0.3,0.1],[2.7,1.44,0.25]]]) k.both(bar(a, b, 0.05, 0.11), DARK());
  k.both(wire([0.36,0.5,1.25], [0.7,1.4,0.3]), STEEL()); k.both(wire([0.36,0.5,0.2], [0.7,1.4,1.15]), STEEL());
  k.both(wire([0.45,-0.3,0.9], [2.7,1.44,0.25]), STEEL()); k.both(wire([0.45,-0.3,0.1], [2.7,1.44,0.85]), STEEL());
  // open cockpit: leather coaming, low windscreen (glass faces forward only, so it never tints the cockpit view), ring sight
  k.add(torus(0.3, 0.06, 10, 4), G.mat(0x4a2f1c), mul(T(0, 0.6, -0.7), SC(1, 1, 1.3), RX(PI/2)));
  k.add(disc(0.3, 10), INK(), mul(T(0, 0.605, -0.7), SC(1, 1, 1.3), RX(-PI/2)));
  k.add(box(0.42, 0.3, 0.24), G.mat(0x33291f), T(0, 0.72, -0.75));
  k.add(box(0.3, 0.07, 0.28), G.mat(0xa4322a), T(0, 0.86, -0.75));
  pilotHead(g, 0, 0.95, -0.72, 0x3a2a1a);
  { const o = []; quad(o, [-0.26,0.6,-0.22], [0.26,0.6,-0.22], [0.2,0.86,-0.36], [-0.2,0.86,-0.36]); k.add(o, GLASS()); }
  k.both(bar([0.26,0.6,-0.22], [0.2,0.86,-0.36], 0.035), DARK()); k.add(bar([-0.2,0.86,-0.36], [0.2,0.86,-0.36], 0.035), DARK());
  k.add(loft([chin(-1.0, 0.2, 0.86, 0.5), chin(-2.4, 0.05, 0.47, 0.38)]), mP);                 // headrest fairing
  k.add(bar([0,0.62,0.4], [0,0.895,0.4], 0.022), DARK()); k.add(torus(0.055, 0.009, 10, 4), DARK(), T(0, 0.95, 0.4));
  // guns: two on the nose, one pod under each wing; rocket rails outboard
  k.both(tube([0.33,0.5,1.3], [0.29,0.47,2.5], 0.045, 6), DARK());
  k.both(lathe([[0.02,0.3],[0.11,0.6],[0.12,1.2],[0.07,1.4]], 6), mP, T(1.6, 1.29, 0));
  k.both(tube([1.6,1.29,1.35], [1.6,1.29,1.6], 0.04, 6), DARK());
  k.both(box(0.06, 0.14, 0.4), DARK(), T(2.2, 1.36, 0.55)); k.both(box(0.07, 0.05, 1.2), STEEL(), T(2.2, 1.28, 0.6));
  // fixed gear with trim hub caps, tail skid
  k.both(cyl(0.36, 0.36, 0.16, 10), DARK(), mul(T(0.95, -1.38, 1.25), RZ(PI/2)));
  k.both(cyl(0.16, 0.16, 0.2, 8), mT, mul(T(0.95, -1.38, 1.25), RZ(PI/2)));
  k.both(bar([0.38,-0.45,1.7], [0.88,-1.36,1.25], 0.06, 0.12), DARK()); k.both(bar([0.38,-0.45,0.8], [0.88,-1.36,1.25], 0.06, 0.12), DARK());
  k.add(bar([-0.9,-1.38,1.25], [0.9,-1.38,1.25], 0.05), DARK());
  k.add(bar([0,-0.2,-3.6], [0,-0.5,-3.95], 0.06), DARK());
  // tail: black with trim tips, skull on the fin, bracing wires
  const vt = t => [0.08 + 1.6*t, 1.05 - 0.45*t, 0.1, -3.45 - 0.25*t, 0.12];
  k.both(pan(vt, 0, 0.7), mS); k.both(pan(vt, 0.7, 1), mT); k.both(tipOf(vt, 0.12, 0.6), mT);
  const vf = t => [0.1 + 1.35*t, 1.35 - 0.6*t, 0.1, -3.5 - 0.3*t, 0], FIN = mul(T(0, 0.1, 0), RZ(PI/2));
  k.add(pan(vf, 0, 0.62), mS, FIN); k.add(pan(vf, 0.62, 1), mT, FIN); k.add(tipOf(vf, 0.12, 0.6), mT, FIN);
  k.decal(mul(onSide(0.065, 0.68, -3.57), SC(0.3)), skull(mT), true, 0.03);
  k.both(wire([0,1.4,-3.8], [1.4,0.15,-3.75]), STEEL());
  k.build(g);
  const prop = propeller(3, 2.6, 0.24, DARK(), mT, mT, [[0.2,-0.02],[0.17,0.2],[0.03,0.52]]); prop.position.set(0, 0, 3.72); g.add(prop);
  g.userData = {prop, muzzles:[new V3(0.29, 0.47, 2.5), new V3(-0.29, 0.47, 2.5), new V3(1.6, 1.29, 1.6), new V3(-1.6, 1.29, 1.6)],
                rails:[new V3(2.2, 1.2, 0.6), new V3(-2.2, 1.2, 0.6)], radius:5.0, cockpit:new V3(0, 0.95, -0.7), gear:1.74, exhaust:new V3(0, 0.1, 2.6)};
  return g;
}

/* =====================================================================
   Wild airframes. Every chassis gets its own silhouette, in the spirit of 1930s prototypes and pulp aviation:
   canards, pushers, twin booms, tandem wings, flying wings, push-pull, twin fuselages, a barrel racer and an autogyro.
   Shared conventions: nose +Z, up +Y, the skyhook ring sits 1.6 m above the origin, 'gear' is the origin's height
   above the ground on its wheels.
   ===================================================================== */
const GUNMETAL = () => G.mat(0x6d7278), PLATE = () => G.mat(0x4a4a4e, {roughness:0.5, metalness:0.35}), LEATHER = () => G.mat(0x4a2f1c);
const SPAT = [[0.03,-0.95],[0.28,-0.55],[0.42,0.05],[0.36,0.5],[0.12,0.8]];
const wingF = (x0, span, c0, c1, th, z0, sweep, y0, dih) => t => [x0 + span*t, c0 + (c1 - c0)*t, th*(1 - 0.4*t), z0 - sweep*t, y0 + dih*t];
function paintWing(k, f, mP, mS, mT, a = 0.62, b = 0.72, tip = true){ k.both(pan(f, 0, a), mP); k.both(pan(f, a, b), mS); k.both(pan(f, b, 1), mT); if (tip) k.both(tipOf(f, 0.2, 0.55), mT); }
/* A fin: a wing function stood on end by the matrix M, in three paint blocks with a rounded tip. */
function paintFin(k, f, M, mA, mB, mC, a = 0.55, b = 0.7){ k.add(pan(f, 0, a), mA, M); k.add(pan(f, a, b), mB, M); k.add(pan(f, b, 1), mC, M); k.add(tipOf(f, 0.12, 0.6), mC, M); }
const UP = (x, y) => mul(T(x, y, 0), RZ(PI/2)), DOWN = (x, y) => mul(T(x, y, 0), RZ(-PI/2));
function hookMast(k, z0, y0){ k.add(bar([0, y0, z0], [0, 1.6, -0.02], 0.05), STEEL()); k.add(torus(0.09, 0.022, 8, 4), STEEL(), mul(T(0, 1.6, 0.05), RY(PI/2))); }
/* Paint panel on facet j of an n-sided lathe body (j = 0 is the +X flank, j = n/4 the top deck). lo and hi are fractions of the local radius. */
function facet(p, z0, z1, j, lo, hi, sx, sy, n, off = 0.015){
  const o = [], a = j*2*PI/n, cf = Math.cos(PI/n), cx = Math.cos(a), cy = Math.sin(a), zs = cut(p, z0, z1).map(q => q[1]);
  const Pt = (z, u) => { const r = rAt(p, z); return [(r*cf*cx - r*u*cy)*sx + off*cx, (r*cf*cy + r*u*cx)*sy + off*cy, z]; };
  for (let i = 0; i < zs.length - 1; i++) quad(o, Pt(zs[i], lo), Pt(zs[i], hi), Pt(zs[i+1], hi), Pt(zs[i+1], lo));
  return o;
}
/* Radial engine at (x, y), cowling from z to z + 0.88: gill ring, painted cowl, polished lip, cylinders and crankcase. The prop goes at z + 0.95. */
function radialCowl(k, z, r, mT, cyls = 7, x = 0, y = 0){
  const M = T(x, y, 0);
  k.add(lathe([[r*0.88, z - 0.12], [r, z]], 12, 1, 1, false), STEEL(), M);
  k.add(lathe([[r, z], [r*1.02, z + 0.36], [r*0.98, z + 0.72]], 12, 1, 1, false), mT, M);
  k.add(lathe([[r*0.98, z + 0.72], [r*0.88, z + 0.86], [r*0.72, z + 0.88]], 12, 1, 1, false), STEEL(), M);
  k.add(disc(r*0.92, 12), INK(), T(x, y, z + 0.72));
  for (let i = 0; i < cyls; i++) { const a = i*2*PI/cyls + 0.2; k.add(cyl(r*0.1, r*0.13, r*0.44, 6), STEEL(), mul(T(x + Math.cos(a)*r*0.5, y + Math.sin(a)*r*0.5, z + 0.8), RZ(a - PI/2))); }
  k.add(lathe([[r*0.3, z + 0.72], [r*0.25, z + 0.93]], 8), GUNMETAL(), M);
}
const offset = (tris, x, y, z) => xf(tris, T(x, y, z));
/* Wheel: chamfered tyre and a hub cap. The lowest point is exactly y - r. */
function wheel(k, x, y, z, r, mHub, w = 0.22){
  const M = mul(T(x, y, z), RY(PI/2));
  k.add(lathe([[r*0.7, -w/2], [r, -w*0.26], [r, w*0.26], [r*0.7, w/2]], 10), DARK(), M);
  k.add(lathe([[r*0.42, -w/2 - 0.025], [r*0.42, w/2 + 0.025]], 8), mHub || STEEL(), M);
}
/* Undercarriage leg from the airframe point a to the wheel centre c: dark sleeve, polished oleo, wheel, and a leg door in paint.
   side = +1 or -1 puts the wheel outboard of the leg on that side; side = 0 makes a forked nose leg. */
/* Retractable gear: while a plane is being built, each gearLeg goes into its own little mesh pivoted at the attach point,
   so G (planes.js) can fold it away: main legs swing inward, nose legs swing back. */
let LEGS = null;
function gearLeg(k, a, c, r, mHub, mDoor, side = 0){
  if (!LEGS) return gearLegAt(k, a, c, r, mHub, mDoor, side);
  const lk = new Kit(), s = p => [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  gearLegAt(lk, [0, 0, 0], s(c), r, mHub, mDoor, side); LEGS.push({lk, a, side});
}
function gearLegAt(k, a, c, r, mHub, mDoor, side = 0){
  const e = [c[0] - side*0.17, c[1] + (side ? 0 : r + 0.1), c[2]], L = f => [a[0] + (e[0] - a[0])*f, a[1] + (e[1] - a[1])*f, a[2] + (e[2] - a[2])*f], m = L(0.5);
  k.add(tube(a, m, 0.075, 6), DARK()); k.add(tube(m, e, 0.045, 6), STEEL());
  if (side) k.add(tube(e, c, 0.05, 6), DARK());
  else { for (const s of [1, -1]) k.add(bar([c[0] + s*0.14, e[1], c[2]], [c[0] + s*0.14, c[1], c[2]], 0.04, 0.09), DARK()); k.add(bar([c[0] - 0.17, e[1], c[2]], [c[0] + 0.17, e[1], c[2]], 0.08), DARK()); }
  if (mDoor) { const d = L(0.66); k.add(bar([a[0] + side*0.1, a[1], a[2]], [d[0] + side*0.1, d[1], d[2]], 0.035, 0.36), mDoor); }
  wheel(k, c[0], c[1], c[2], r, mHub, side ? 0.22 : 0.18);
}
function tailWheel(k, z, y0, y, r = 0.13, x = 0){ k.add(bar([x, y0, z + 0.3], [x, y, z], 0.05, 0.09), DARK()); wheel(k, x, y, z, r, STEEL(), 0.1); }
function leg(k, a, b){ k.add(bar(a, b, 0.09, 0.14), DARK()); }
const glassCan = (pts) => loft(pts.map(([z, w, yb, yt]) => [[-w, yb, z], [w, yb, z], [w*0.72, yt, z], [-w*0.72, yt, z]]));
/* Greenhouse canopy from stations [z, half width, sill y, roof y], front to back: one convex glass solid with hoops and roof rails. */
function canopy(k, st, mF, x = 0, kt = 0.72){
  k.add(loft(st.map(([z, w, yb, yt]) => [[x - w, yb, z], [x + w, yb, z], [x + w*kt, yt, z], [x - w*kt, yt, z]])), GLASS());
  st.forEach(([z, w, yb, yt], i) => {
    if (yt - yb > 0.3) { for (const s of [1, -1]) k.add(bar([x + s*w, yb, z], [x + s*w*kt, yt, z], 0.045), mF); k.add(bar([x - w*kt, yt, z], [x + w*kt, yt, z], 0.045), mF); }
    if (i) { const q = st[i - 1]; for (const s of [1, -1]) k.add(bar([x + s*q[1]*kt, q[3], q[0]], [x + s*w*kt, yt, z], 0.045), mF); }
  });
}
function seatAndPilot(g, k, x, y, z, hex){ k.add(box(0.44, 0.34, 0.26), G.mat(0x6b4a2e), T(x, y - 0.25, z)); pilotHead(g, x, y, z, hex || 0x5a3a22); }
/* Gun turret: painted ring, faceted glass dome with four ribs, twin guns on a breech block. */
function turretDome(k, x, y, z, r, mT, back = true){
  const d = back ? -1 : 1;
  k.add(torus(r, 0.07, 12, 4), mT, mul(T(x, y, z), RX(PI/2)));
  k.add(lathe([[r, 0], [r*0.92, r*0.45], [r*0.6, r*0.8], [0.02, r*0.95]], 10), GLASS(), mul(T(x, y, z), RX(-PI/2)));
  for (const j of [1, 3, 6, 8]) { const a = (j + 0.5)*PI/5, c = Math.cos(a), s = Math.sin(a); k.add(bar([x + c*r*0.93, y + r*0.42, z + s*r*0.93], [x + c*r*0.6, y + r*0.82, z + s*r*0.6], 0.035), STEEL()); }
  turretGuns(k, x, y + r*0.38, z, d*r*0.45, d*1.4, r*0.17, 0.3);
}
/* Turret guns on a breech block, built as their own little mesh so the gunner can swing them (planes.js).
   At rest they point along d (astern); the pivot is the centre of the mount. */
let GUNSINK = null;
function turretGuns(k, x, y, z, z0, z1, rise, blk){
  const gk = GUNSINK ? new Kit() : k, o = GUNSINK ? [0, 0, 0] : [x, y, z];
  gk.add(box(blk, 0.15, blk), GUNMETAL(), T(o[0], o[1], o[2] + z0));
  for (const sx of [0.09, -0.09]) gk.add(tube([o[0] + sx, o[1], o[2] + z0], [o[0] + sx, o[1] + rise, o[2] + z1], 0.04, 5), DARK());
  if (GUNSINK) GUNSINK.push({gk, at:[x, y, z]});
}
/* Fixed gun: barrel ending at the muzzle point m, with a cooling jacket over the breech end. */
function gun(k, m, len, r = 0.045, jacket = 0.5){
  k.add(tube([m.x, m.y, m.z - len], [m.x, m.y, m.z], r, 6), DARK());
  if (jacket) k.add(tube([m.x, m.y, m.z - len], [m.x, m.y, m.z - len*(1 - jacket)], r*1.7, 6), GUNMETAL());
}
function rails(k, x, y, z, len = 1.2){ k.both(box(0.06, 0.16, 0.5), STEEL(), T(x, y, z)); k.both(box(0.07, 0.06, len), STEEL(), T(x, y - 0.11, z + 0.05)); }
function navLamps(k, f){ const s = f(1); k.add(box(0.1, 0.07, 0.16), lamp(0xff3b30), T(s[0] + 0.19, s[4], s[3] - s[1]*0.08)); k.add(box(0.1, 0.07, 0.16), lamp(0x47e36a), T(-s[0] - 0.19, s[4], s[3] - s[1]*0.08)); }
function stubs(k, p, z0, n, dz, y, sx){ for (let i = 0; i < n; i++) { const z = z0 + i*dz; k.both(box(0.1, 0.08, 0.2), DARK(), mul(T(0.9239*rAt(p, z)*sx + 0.04, y, z), RY(-0.4))); } }
/* Decal layers on the flat of a wing's upper surface at span station t, tilted to the dihedral. */
function wingEmblem(k, f, t, layers, sc = 1){
  const s = f(t), s2 = f(t + 0.02), top = q => q[4] + 0.5*q[2];
  k.decal(mul(onTop(s[0], top(s) + 0.02, s[3] + 0.025*s[1], Math.atan2(top(s2) - top(s), s2[0] - s[0])), SC(sc)), layers, true, 0.012/sc);
}
/* Bomb or torpedo slung along Z: brass nose, steel body, dark tail with cruciform fins. */
function store(k, x, y, z, r, len){
  const p = [[0.03, -len*0.5], [r*0.8, -len*0.36], [r, -len*0.1], [r, len*0.3], [r*0.6, len*0.45], [r*0.15, len*0.5]], M = T(x, y, z);
  k.add(lathe(cut(p, -len*0.5, -len*0.3), 8), DARK(), M); k.add(lathe(cut(p, -len*0.3, len*0.3), 8, 1, 1, false), STEEL(), M); k.add(lathe(cut(p, len*0.3, len*0.5), 8), BRASS(), M);
  k.add(box(r*2.7, 0.03, len*0.13), DARK(), T(x, y, z - len*0.42)); k.add(box(0.03, r*2.7, len*0.13), DARK(), T(x, y, z - len*0.42));
}
function addProp(g, list, pos, blades, len, chord, mB, mT, mS, spin, pusher, dir = 1){
  const p = propeller(blades, len, chord, mB, mT, mS, spin); p.position.copy(pos); if (pusher) p.rotation.y = PI; p.userData.dir = dir; g.add(p); list.push(p); return p;
}
const quadRing = (z, x0, x1, yB, yT) => [[x0, yB, z], [x1, yB, z], [x1, yT, z], [x0, yT, z]];

/* ---------- Sparrowhawk: canard pusher. Swept wing at the back with fins halfway out, a foreplane on the nose, prop behind.
   Paint: main = fuselage, wing and fins; second = nose, foreplane, stripes; trim = tips, engine band, spine, hubs. */
function sparrowhawk(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [];
  const SY = 1.08, F = [[0.3,-4.3],[0.44,-3.9],[0.62,-2.8],[0.74,-1.1],[0.75,0.6],[0.64,2.3],[0.44,3.6],[0.26,4.25],[0.07,4.6]];
  // fuselage in blocks: polished engine ring, trim engine band, main, trim collar, second-colour gun nose
  k.add(lathe(cut(F, -4.3, -3.9), 8, 1, SY), STEEL()); k.add(lathe(cut(F, -3.9, -3.1), 8, 1, SY, false), mT);
  k.add(lathe(cut(F, -3.1, 2.7), 8, 1, SY, false), mP); k.add(lathe(cut(F, 2.7, 2.9), 8, 1, SY, false), mT); k.add(lathe(cut(F, 2.9, 4.6), 8, 1, SY), mS);
  k.both(stripe(F, -0.7, 2.7, -0.06, 0.18, 1, SY, 8), mS);
  k.decal(onSide(0.9239*rAt(F, 1.55) + 0.03, 0.03, 1.55, -0.06), emblem(0.24, mS, mT), true);
  k.add(facet(F, 1.72, 2.7, 2, -0.34, 0.34, 1, SY, 8), DARK());                                                // anti-glare deck
  canopy(k, [[1.7, 0.28, 0.66, 0.74], [1.0, 0.4, 0.62, 1.3], [-0.1, 0.4, 0.62, 1.34], [-0.9, 0.22, 0.66, 0.92]], STEEL());
  k.add(glassCan([[-0.9, 0.26, 0.6, 0.94], [-3.1, 0.1, 0.5, 0.62]]), mT);                                    // spine
  k.add(box(0.7, 0.16, 0.08), DARK(), T(0, 0.72, 1.02));
  seatAndPilot(g, k, 0, 1.06, 0.35);
  // cheek scoops feeding the buried engine, exhaust stubs on the engine band
  k.both(loft([quadRing(-0.75, 0.6, 0.92, -0.1, 0.42), quadRing(-1.5, 0.6, 0.94, -0.12, 0.44), quadRing(-2.9, 0.45, 0.61, 0.04, 0.26)]), mP);
  k.both(box(0.26, 0.44, 0.04), INK(), T(0.775, 0.16, -0.745));
  stubs(k, F, -3.75, 3, 0.22, 0.2, 1);
  // the main wing, swept, at the back; fins up and down at 58% span
  const mw = wingF(0.6, 4.3, 2.3, 1.1, 0.27, -2.0, 1.7, -0.25, 0.12);
  paintWing(k, mw, mP, mS, mT, 0.56, 0.66); navLamps(k, mw);
  wingEmblem(k, mw, 0.3, emblem(0.42, mS, mT));
  const s = mw(0.58), fu = t => [0.05 + 1.25*t, 1.5 - 0.6*t, 0.12, s[3] - 0.15 - 0.45*t, 0], fd = t => [0.05 + 0.55*t, 1.2 - 0.4*t, 0.12, s[3] - 0.2 - 0.2*t, 0];
  for (const sx of [1, -1]) { paintFin(k, fu, UP(sx*s[0], s[4]), mP, mS, mT); k.add(pan(fd, 0, 1), mT, DOWN(sx*s[0], s[4])); k.add(tipOf(fd, 0.1, 0.6), mT, DOWN(sx*s[0], s[4])); }
  // canard foreplane
  const cw = wingF(0.35, 1.75, 0.85, 0.5, 0.12, 3.15, 0.25, 0.08, 0.12);
  k.both(pan(cw, 0, 0.7), mS); k.both(pan(cw, 0.7, 1), mT); k.both(tipOf(cw, 0.12, 0.6), mT);
  // dorsal and ventral fins on the tail cone, in front of the prop; the ventral one carries a bumper
  const vf = t => [0.05 + 0.95*t, 1.5 - 0.5*t, 0.12, -3.3 - 0.35*t, 0];
  paintFin(k, vf, UP(0, 0.45), mP, mS, mT, 0.5, 0.68); k.add(pan(vf, 0, 0.8), mT, DOWN(0, -0.45));
  k.add(box(0.1, 0.1, 0.5), DARK(), T(0, -1.27, -3.6));
  // four nose guns in blast fairings, rocket rails under the wing
  const mz = [[0.2, 0.22], [-0.2, 0.22], [0.22, -0.18], [-0.22, -0.18]].map(([x, y]) => new V3(x, y, 4.72));
  for (const m of mz) { k.add(lathe([[0.03, 3.3], [0.1, 3.7], [0.1, 4.15], [0.06, 4.32]], 6), mS, T(m.x, m.y, 0)); gun(k, m, 0.7, 0.04, 0); }
  rails(k, 2.4, -0.45, -2.5);
  // tall tricycle gear (the prop is behind)
  gearLeg(k, [0, -0.55, 2.7], [0, -1.82, 2.8], 0.3, mT, null, 0);
  for (const sx of [1, -1]) gearLeg(k, [sx*1.4, -0.4, -1.7], [sx*1.57, -1.78, -1.6], 0.34, mT, mP, sx);
  hookMast(k, -0.95, 0.9);
  k.build(g);
  addProp(g, props, new V3(0, 0, -4.35), 3, 2.7, 0.26, DARK(), mT, mS, [[0.3,-0.05],[0.27,0.16],[0.14,0.44],[0.03,0.58]], true);
  g.userData = {prop:props[0], props, muzzles:mz, rails:[new V3(2.4, -0.65, -2.0), new V3(-2.4, -0.65, -2.0)], radius:5.4, cockpit:new V3(0, 1.12, 0.45), exhaust:new V3(0, 0.3, -3.6), gear:2.12};
  return g;
}

/* ---------- Mantis: twin-boom pusher interceptor with a long nose cannon and a high tail between the booms.
   Paint: main = pod, wing, booms; second = stripes and bands; trim = nose, tips, boom tails. Bare-steel engine bay. */
function mantis(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [];
  const SY = 1.1, F = [[0.3,-2.35],[0.54,-2.0],[0.78,-1.0],[0.84,0.6],[0.74,2.2],[0.5,3.3],[0.2,3.85]];
  k.add(lathe(cut(F, -2.35, -1.4), 8, 1, SY), STEEL()); k.add(lathe(cut(F, -1.4, 2.4), 8, 1, SY, false), mP);
  k.add(lathe(cut(F, 2.4, 2.6), 8, 1, SY, false), mS); k.add(lathe(cut(F, 2.6, 3.85), 8, 1, SY), mT);
  k.both(stripe(F, -1.4, 2.4, 0.05, 0.24, 1, SY, 8), mS);
  stubs(k, F, -2.1, 3, 0.24, 0.3, 1);
  canopy(k, [[2.6, 0.3, 0.6, 0.7], [1.9, 0.44, 0.58, 1.32], [0.6, 0.44, 0.6, 1.36], [-0.3, 0.24, 0.62, 0.96]], STEEL());
  k.add(box(0.76, 0.16, 0.08), DARK(), T(0, 0.74, 1.92));
  seatAndPilot(g, k, 0, 1.08, 1.1);
  // dorsal air scoop behind the canopy for the pusher engine
  k.add(loft([quadRing(-0.5, -0.22, 0.22, 0.7, 1.08), quadRing(-1.2, -0.24, 0.24, 0.6, 1.0), quadRing(-2.15, -0.1, 0.1, 0.4, 0.58)]), mP);
  k.add(box(0.36, 0.3, 0.04), INK(), T(0, 0.9, -0.495));
  // the cannon: recoil sleeve, long barrel, slotted muzzle brake
  k.add(lathe([[0.2, 3.8], [0.14, 4.3], [0.14, 4.5]], 8), GUNMETAL());
  k.add(tube([0, 0, 4.4], [0, 0, 5.85], 0.075, 8), DARK());
  k.add(lathe([[0.09, 5.8], [0.15, 5.86], [0.15, 6.02], [0.1, 6.06], [0.1, 6.1], [0.15, 6.14], [0.15, 6.28], [0.1, 6.32]], 8), STEEL());
  // wing, booms, fins and the high tailplane
  const mw = wingF(0.7, 4.5, 2.3, 1.2, 0.27, 0.1, 0.35, -0.15, 0.25);
  paintWing(k, mw, mP, mS, mT, 0.64, 0.74); navLamps(k, mw);
  wingEmblem(k, mw, 0.47, emblem(0.42, mS, mT));
  const B = [[0.06,-6.2],[0.24,-5.8],[0.32,-4.0],[0.36,-1.0],[0.34,0.8],[0.2,1.8],[0.06,2.2]];
  const bf = t => [0.05 + 1.45*t, 1.5 - 0.6*t, 0.12, -5.3 - 0.4*t, 0];
  for (const sx of [1, -1]) {
    const M = T(sx*2.0, -0.1, 0);
    k.add(lathe(cut(B, -6.2, -4.3), 8), mT, M); k.add(lathe(cut(B, -4.3, -4.0), 8, 1, 1, false), mS, M); k.add(lathe(cut(B, -4.0, 1.5), 8, 1, 1, false), mP, M); k.add(lathe(cut(B, 1.5, 2.2), 8), mT, M);
    paintFin(k, bf, UP(sx*2.0, 0.1), mP, mS, mT, 0.5, 0.66); k.add(pan(bf, 0, 0.5), mT, DOWN(sx*2.0, -0.3));
    k.add(bar([sx*2.0, -0.8, -5.2], [sx*2.0, -1.0, -5.5], 0.06), DARK());
  }
  for (const [a, b, m] of [[-2.05, -0.7, mP], [-0.7, 0.7, mS], [0.7, 2.05, mP]]) k.add(loft([foil(a, 1.0, 0.12, -5.6, 1.35), foil(b, 1.0, 0.12, -5.6, 1.35)]), m);
  const mz = [new V3(0, 0, 6.32), new V3(2.0, -0.1, 2.65), new V3(-2.0, -0.1, 2.65)];
  for (const m of mz.slice(1)) gun(k, m, 0.9, 0.04, 0);                                                    // .30s in the boom noses
  rails(k, 3.5, -0.35, 0.3);
  // tricycle gear
  gearLeg(k, [0, -0.6, 2.6], [0, -1.6, 2.7], 0.28, mT, null, 0);
  for (const sx of [1, -1]) gearLeg(k, [sx*2.0, -0.4, -0.4], [sx*2.17, -1.56, -0.4], 0.34, mT, mP, sx);
  hookMast(k, -0.3, 0.95);
  k.build(g);
  addProp(g, props, new V3(0, 0, -2.4), 4, 2.6, 0.22, DARK(), mT, mS, [[0.3,-0.05],[0.27,0.16],[0.14,0.42],[0.03,0.55]], true);
  g.userData = {prop:props[0], props, muzzles:mz, rails:[new V3(3.5, -0.55, 0.8), new V3(-3.5, -0.55, 0.8)], radius:5.6, cockpit:new V3(0, 1.14, 1.2), exhaust:new V3(0, 0.2, -1.8), gear:1.9};
  return g;
}

/* ---------- Jackal: inverted-gull-wing interceptor. Long inline nose, a belly radiator scoop, an H-tail and a glass rear turret.
   Paint: main = fuselage and wings; second = nose, radiator, tail fins, wing band; trim = stripe, tips, spats, spine. */
function jackal(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [];
  const SX = 0.92, SY = 1.12, F = [[0.05,-4.7],[0.28,-4.3],[0.52,-2.8],[0.66,-0.9],[0.7,0.9],[0.64,2.4],[0.48,3.5],[0.3,4.2],[0.22,4.45]];
  k.add(lathe(cut(F, -4.7, -3.7), 8, SX, SY), mT); k.add(lathe(cut(F, -3.7, 2.4), 8, SX, SY, false), mP); k.add(lathe(cut(F, 2.4, 4.45), 8, SX, SY), mS);
  k.both(stripe(F, -3.7, 2.4, 0.08, 0.26, SX, SY, 8), mT);
  k.decal(onSide(0.9239*rAt(F, -1.8)*SX + 0.03, 0.05, -1.8, 0.07), emblem(0.24, mS, mT), true);
  stubs(k, F, 2.55, 6, 0.24, 0.18, SX);
  // belly radiator: open mouth under the wing, tapering away aft
  k.add(loft([quadRing(0.95, -0.4, 0.4, -1.04, -0.5), quadRing(-0.9, -0.38, 0.38, -0.98, -0.5), quadRing(-1.9, -0.14, 0.14, -0.68, -0.55)]), mS);
  k.add(box(0.68, 0.4, 0.04), INK(), T(0, -0.79, 0.955));
  for (const x of [-0.17, 0.17]) k.add(box(0.03, 0.4, 0.05), STEEL(), T(x, -0.79, 0.965));
  // canopy, spine and the glass turret behind the pilot
  canopy(k, [[1.5, 0.28, 0.62, 0.7], [0.9, 0.38, 0.6, 1.24], [-0.1, 0.38, 0.62, 1.26], [-0.5, 0.3, 0.64, 1.1]], STEEL());
  k.add(box(0.66, 0.16, 0.08), DARK(), T(0, 0.74, 0.92));
  k.add(glassCan([[-1.7, 0.3, 0.58, 0.95], [-3.6, 0.1, 0.45, 0.6]]), mT);
  seatAndPilot(g, k, 0, 1.04, 0.35);
  turretDome(k, 0, 0.72, -1.15, 0.44, mT, true);
  // inverted gull wing: steep anhedral to the knee, then dihedral out to the tip
  const wIn = t => [0.55 + 1.25*t, 2.3 - 0.25*t, 0.3, 0.55 - 0.05*t, -0.25 - 0.75*t];
  const wOut = t => [1.8 + 3.4*t, 2.05 - 0.95*t, 0.27*(1 - 0.4*t), 0.5 - 0.35*t, -1.0 + 1.1*t];
  k.both(pan(wIn, 0, 1), mP); k.both(pan(wOut, 0, 0.62), mP); k.both(pan(wOut, 0.62, 0.72), mS); k.both(pan(wOut, 0.72, 1), mT); k.both(tipOf(wOut, 0.2, 0.5), mT);
  navLamps(k, wOut); wingEmblem(k, wOut, 0.4, emblem(0.42, mS, mT));
  // H-tail
  const tp = wingF(0.1, 1.85, 1.2, 0.95, 0.12, -4.1, 0.2, 0.2, 0); k.both(pan(tp, 0, 1), mP);
  const tf = t => [0.05 + 1.3*t, 1.25 - 0.45*t, 0.11, -4.15 - 0.25*t, 0];
  for (const sx of [1, -1]) { k.add(pan(tf, 0, 0.7), mS, UP(sx*1.95, 0.2)); k.add(pan(tf, 0.7, 1), mT, UP(sx*1.95, 0.2)); k.add(tipOf(tf, 0.12, 0.6), mT, UP(sx*1.95, 0.2)); k.add(pan(tf, 0, 0.5), mT, DOWN(sx*1.95, 0.2)); }
  // guns just outboard of the gull knees and on the cowl
  const mz = [new V3(2.2, -0.85, 2.0), new V3(-2.2, -0.85, 2.0), new V3(0.22, 0.5, 4.2), new V3(-0.22, 0.5, 4.2)];
  gun(k, mz[0], 1.0); gun(k, mz[1], 1.0); gun(k, mz[2], 1.1, 0.045, 0); gun(k, mz[3], 1.1, 0.045, 0);
  rails(k, 3.2, -0.73, 0.5, 1.1);
  // trousered gear straight down from the knees (the gull wing's whole point)
  for (const sx of [1, -1]) {
    k.add(box(0.2, 0.5, 0.7), mP, T(sx*1.8, -1.2, 0.75));
    k.add(lathe(SPAT, 8, 0.5, 0.95), mT, T(sx*1.8, -1.36, 0.7));
    wheel(k, sx*1.8, -1.5, 0.75, 0.36, mT, 0.2);
  }
  tailWheel(k, -4.2, -0.3, -0.75);
  hookMast(k, -0.55, 1.15);
  k.build(g);
  addProp(g, props, new V3(0, 0, 4.47), 3, 2.7, 0.24, DARK(), mT, mS, [[0.22,-0.02],[0.2,0.2],[0.11,0.48],[0.03,0.62]]);
  g.userData = {prop:props[0], props, muzzles:mz, rails:[new V3(3.2, -0.93, 1.0), new V3(-3.2, -0.93, 1.0)], radius:5.3, cockpit:new V3(0, 1.1, 0.45), exhaust:new V3(0, 0.2, 3.0), gear:1.86};
  return g;
}

/* ---------- Highwayman: twin-engine heavy fighter, H-tail, a dorsal gun turret, a black mask over the gun nose.
   Paint: main = fuselage, wings, nacelles; second = nose, stripes; trim = cowls, tips, tail cone, hubs. */
function highwayman(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [];
  const SY = 1.22, F = [[0.06,-4.9],[0.3,-4.5],[0.6,-3.0],[0.8,-1.0],[0.84,1.0],[0.74,2.4],[0.5,3.25],[0.2,3.7]];
  k.add(lathe(cut(F, -4.9, -3.8), 8, 1, SY), mT); k.add(lathe(cut(F, -3.8, 2.6), 8, 1, SY, false), mP); k.add(lathe(cut(F, 2.6, 3.7), 8, 1, SY), mS);
  k.both(stripe(F, -3.8, 2.6, -0.1, 0.12, 1, SY, 8), mS);
  k.decal(onSide(0.9239*rAt(F, -2.6) + 0.03, 0.0, -2.6, 0.09), emblem(0.26, mS, mT), true);
  for (const j of [1, 2, 3]) k.add(facet(F, 2.12, 3.35, j, -0.375, 0.375, 1, SY, 8), INK());                    // the mask
  canopy(k, [[2.1, 0.32, 0.8, 0.88], [1.4, 0.46, 0.76, 1.48], [0.2, 0.46, 0.78, 1.5], [-0.4, 0.3, 0.8, 1.1]], STEEL());
  k.add(box(0.8, 0.16, 0.08), DARK(), T(0, 0.92, 1.42));
  seatAndPilot(g, k, 0, 1.24, 0.9);
  turretDome(k, 0, 0.95, -1.6, 0.5, mT, true);
  const mw = wingF(0.75, 5.6, 2.7, 1.3, 0.3, 0.25, 0.5, -0.35, 0.3); paintWing(k, mw, mP, mS, mT, 0.7, 0.78); navLamps(k, mw);
  wingEmblem(k, mw, 0.6, emblem(0.48, mS, mT));
  // engine nacelles with radial cowls, carburettor scoops and exhaust pipes; props turn in opposite directions
  const N = [[0.08,-2.9],[0.36,-2.2],[0.56,-0.6],[0.6,1.6],[0.56,2.5]];
  for (const sx of [1, -1]) {
    const M = T(sx*2.5, -0.3, 0);
    k.add(lathe(cut(N, -2.9, -2.0), 8), mT, M); k.add(lathe(cut(N, -2.0, 2.5), 8), mP, M);
    radialCowl(k, 2.5, 0.6, mT, 7, sx*2.5, -0.3);
    k.add(loft([quadRing(2.3, sx*2.5 - 0.13, sx*2.5 + 0.13, 0.2, 0.42), quadRing(0.6, sx*2.5 - 0.08, sx*2.5 + 0.08, 0.2, 0.28)]), mP);
    k.add(box(0.2, 0.16, 0.04), INK(), T(sx*2.5, 0.31, 2.305));
    k.add(tube([sx*3.08, -0.5, 2.35], [sx*3.1, -0.55, 0.9], 0.07, 6), DARK());
    gearLeg(k, [sx*2.5, -0.7, 0.4], [sx*2.67, -1.55, 0.5], 0.4, mT, mP, sx);
  }
  // H-tail
  const tp = wingF(0.05, 2.2, 1.3, 1.0, 0.13, -4.3, 0.2, 0.25, 0); k.both(pan(tp, 0, 1), mP);
  const tf = t => [0.05 + 1.3*t, 1.35 - 0.3*t, 0.12, -4.45 - 0.1*t, 0];
  for (const sx of [1, -1]) { paintFin(k, tf, UP(sx*2.25, 0.25), mP, mS, mT, 0.55, 0.72); k.add(pan(tf, 0, 0.45), mT, DOWN(sx*2.25, 0.25)); }
  // four nose guns, rails
  const mz = [new V3(0.25, 0.3, 3.95), new V3(-0.25, 0.3, 3.95), new V3(0.25, -0.15, 3.95), new V3(-0.25, -0.15, 3.95)];
  for (const m of mz) gun(k, m, 1.0, 0.05, 0);
  rails(k, 4.4, -0.45, 0.2);
  tailWheel(k, -4.4, -0.4, -0.85, 0.15);
  hookMast(k, -0.5, 1.25);
  k.build(g);
  for (const sx of [1, -1]) addProp(g, props, new V3(sx*2.5, -0.3, 3.45), 3, 2.8, 0.25, DARK(), mT, mS, [[0.2,-0.02],[0.18,0.2],[0.03,0.5]], false, sx);
  g.userData = {prop:props[0], props, muzzles:mz, rails:[new V3(4.4, -0.65, 0.8), new V3(-4.4, -0.65, 0.8)], radius:6.6, cockpit:new V3(0, 1.3, 1.0), exhaust:new V3(2.5, -0.1, 1.5), gear:1.95};
  return g;
}

/* ---------- Grackle: flying-wing fighter-bomber, two pusher props on the trailing edge, drooping tip fins, a tail turret.
   Paint: main = wing and body; second = chevron, upper tip fins, nacelle tails; trim = nose, wingtips, nacelles, spine. */
function grackle(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [];
  const SX = 1.15, SY = 0.98, F = [[0.42,-2.5],[0.72,-1.2],[0.8,0.6],[0.68,2.0],[0.4,2.9],[0.1,3.2]];
  k.add(lathe(cut(F, -2.5, 2.0), 8, SX, SY), mP); k.add(lathe(cut(F, 2.0, 2.2), 8, SX, SY, false), mS); k.add(lathe(cut(F, 2.2, 3.2), 8, SX, SY), mT);
  canopy(k, [[2.0, 0.28, 0.5, 0.6], [1.4, 0.4, 0.5, 1.18], [0.3, 0.4, 0.5, 1.2], [-0.4, 0.22, 0.52, 0.82]], STEEL());
  k.add(glassCan([[-0.4, 0.26, 0.5, 0.84], [-2.3, 0.12, 0.3, 0.5]]), mT);                                      // spine
  seatAndPilot(g, k, 0, 0.98, 0.8);
  // glazed tail turret
  k.add(torus(0.42, 0.06, 10, 4), mT, mul(T(0, 0, -2.5), SC(SX, SY, 1)));
  k.add(lathe([[0.4, 0], [0.36, 0.35], [0.02, 0.5]], 10, SX, SY), GLASS(), mul(T(0, 0, -2.5), RX(PI)));
  turretGuns(k, 0, 0, -2.6, -0.1, -1.3, 0, 0.18);
  // the wing: deep at the root, swept, a little dihedral, painted in chevrons
  const mw = wingF(0.65, 6.0, 4.4, 1.2, 0.5, 0.0, 2.9, -0.1, 0.45);
  k.both(pan(mw, 0, 0.3), mP); k.both(pan(mw, 0.3, 0.38), mS); k.both(pan(mw, 0.38, 0.8), mP); k.both(pan(mw, 0.8, 1), mT);
  wingEmblem(k, mw, 0.6, emblem(0.55, mS, mT));
  const tip = mw(1), tf = t => [0.05 + 1.0*t, 1.1 - 0.3*t, 0.1, tip[3] - 0.2*t, 0];
  for (const sx of [1, -1]) { k.add(pan(tf, 0, 1), mT, DOWN(sx*tip[0], tip[4])); k.add(tipOf(tf, 0.1, 0.6), mT, DOWN(sx*tip[0], tip[4])); k.add(pan(tf, 0, 0.7), mS, UP(sx*tip[0], tip[4])); k.add(tipOf(t => tf(t*0.7), 0.1, 0.6), mS, UP(sx*tip[0], tip[4])); }
  // engines buried in the wing: intakes at the leading edge, pushers at the trailing edge
  const s = mw(0.22), te = s[3] - s[1]/2, ny = s[4] + 0.14;
  const Nn = [[0.2, te - 0.15], [0.32, te + 0.25], [0.42, te + 1.5], [0.4, te + 2.9], [0.3, te + 3.6], [0.3, te + 3.78]];
  for (const sx of [1, -1]) {
    const M = T(sx*s[0], ny, 0);
    k.add(lathe(cut(Nn, te - 0.15, te + 0.7), 8), mS, M); k.add(lathe(cut(Nn, te + 0.7, te + 3.6), 8, 1, 1, false), mT, M); k.add(lathe(cut(Nn, te + 3.6, te + 3.78), 8, 1, 1, false), STEEL(), M);
    k.add(disc(0.28, 8), INK(), T(sx*s[0], ny, te + 3.7));
  }
  // guns in the wing roots and under the nose, bomb/rocket rails under the wing
  const mz = [new V3(1.2, -0.05, 2.25), new V3(-1.2, -0.05, 2.25), new V3(0.3, -0.35, 3.1), new V3(-0.3, -0.35, 3.1)];
  gun(k, mz[0], 0.9); gun(k, mz[1], 0.9); gun(k, mz[2], 1.0, 0.05, 0); gun(k, mz[3], 1.0, 0.05, 0);
  rails(k, 3.4, -0.35, -1.2, 1.3);
  gearLeg(k, [0, -0.55, 2.0], [0, -1.55, 2.1], 0.3, mT, null, 0);
  for (const sx of [1, -1]) gearLeg(k, [sx*1.6, -0.35, -0.6], [sx*1.77, -1.47, -0.6], 0.38, mT, mP, sx);
  hookMast(k, -0.6, 0.85);
  k.build(g);
  for (const sx of [1, -1]) addProp(g, props, new V3(sx*s[0], ny, te - 0.17), 3, 2.4, 0.24, DARK(), mT, mS, [[0.2,-0.04],[0.18,0.12],[0.03,0.4]], true, sx);
  g.userData = {prop:props[0], props, muzzles:mz, rails:[new V3(3.4, -0.55, -0.6), new V3(-3.4, -0.55, -0.6)], radius:6.8, cockpit:new V3(0, 1.04, 0.9), exhaust:new V3(2.0, 0.3, -1.5), gear:1.85};
  return g;
}

/* ---------- Ironclad: armoured three-engine biplane bomber with a torpedo and a tail gunner.
   Paint: main = hull and wings; second = wing and tail bands; trim = cowls, tips, spats. Riveted plate bands, brass portholes. */
function ironclad(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [], plate = PLATE();
  // slab-sided armoured fuselage with riveted bands
  const sec = (z, w, yb, yt, ch = 0.18) => [[-w + ch, yb, z], [w - ch, yb, z], [w, yb + ch, z], [w, yt - ch, z], [w - ch, yt, z], [-w + ch, yt, z], [-w, yt - ch, z], [-w, yb + ch, z]];
  k.add(loft([sec(-5.6, 0.12, 0.2, 0.55, 0.04), sec(-4.4, 0.42, -0.3, 0.75), sec(-1.6, 0.72, -0.75, 0.95), sec(1.2, 0.78, -0.8, 1.0), sec(2.4, 0.74, -0.72, 0.9)]), mP);
  for (const z of [-3.6, -2.0, -0.4, 1.0]) {
    const w = 0.76*(1 - Math.max(0, -z - 1.6)*0.11);
    k.add(loft([sec(z - 0.08, w, -0.82, 1.02), sec(z + 0.08, w, -0.82, 1.02)]), plate);
    for (const y of [-0.45, 0.05, 0.55]) k.both(disc(0.04, 5), STEEL(), onSide(w + 0.012, y, z));
  }
  for (const z of [-1.2, 0.3]) k.decal(onSide(0.79, 0.4, z), [[disc(0.15, 8), BRASS()], [disc(0.1, 8), WINDOW()]], true);   // portholes
  canopy(k, [[2.2, 0.36, 0.95, 1.0], [1.6, 0.5, 0.94, 1.42], [0.5, 0.5, 0.96, 1.44]], plate);
  k.add(box(0.9, 0.08, 1.2), plate, T(0, 1.46, 1.1));                                                                  // armoured roof over the glass
  k.add(box(1.0, 0.5, 0.06), plate, T(0, 1.2, 0.47));
  seatAndPilot(g, k, 0, 1.25, 1.0);
  k.add(torus(0.56, 0.06, 10, 4), plate, T(0, 0.38, -5.28));
  k.add(lathe([[0.55, 0], [0.5, 0.4], [0.02, 0.7]], 10), GLASS(), mul(T(0, 0.38, -5.3), RX(PI)));                      // tail gunner
  turretGuns(k, 0, 0.38, -5.45, -0.05, -1.15, 0, 0.18);
  // the two wings: lower long, upper longer with a cut-out over the skyhook; interplane struts, cabane and wires
  const lw = wingF(0.75, 6.0, 2.4, 1.8, 0.24, 0.5, 0.1, -0.7, 0.15), uw = wingF(0.9, 6.4, 2.4, 1.8, 0.24, 0.7, 0.15, 1.85, 0.0);
  paintWing(k, lw, mP, mS, mT, 0.7, 0.78); paintWing(k, uw, mP, mS, mT, 0.69, 0.78); navLamps(k, uw);
  k.add(loft([foil(-0.9, 1.3, 0.24, 1.25, 1.85), foil(0.9, 1.3, 0.24, 1.25, 1.85)]), mP);
  wingEmblem(k, uw, 0.64, emblem(0.6, mS, mT));
  for (const f of [0.45, 0.9]) {
    const a = lw(f), b = uw((a[0] + 0.25 - 0.9)/6.4);
    for (const dz of [0.6, -0.6]) k.both(bar([a[0], a[4] + 0.1, a[3] + dz], [b[0], b[4] - 0.1, b[3] + dz], 0.07, 0.14), DARK());
    k.both(wire([a[0], a[4], a[3] + 0.6], [b[0], b[4], b[3] - 0.6]), STEEL()); k.both(wire([a[0], a[4], a[3] - 0.6], [b[0], b[4], b[3] + 0.6]), STEEL());
  }
  for (const z of [1.3, 0.1]) k.both(bar([0.62, 0.95, z], [0.92, 1.76, z + 0.15], 0.06, 0.1), DARK());
  k.both(wire([0.62, 0.95, 1.3], [0.92, 1.76, 0.25]), STEEL());
  // three radials: nose and one on each lower wing
  radialCowl(k, 2.4, 0.78, mT, 9);
  k.both(tube([0.8, -0.3, 2.35], [0.82, -0.4, 0.7], 0.07, 6), DARK());                                                 // exhaust pipes
  const N = [[0.1,-1.8],[0.42,-1.2],[0.58,0.2],[0.6,1.6]];
  for (const sx of [1, -1]) { k.add(lathe(N, 8), mP, T(sx*3.1, -0.55, 0.0)); radialCowl(k, 1.6, 0.6, mT, 5, sx*3.1, -0.55); }
  // torpedo slung under the belly
  store(k, 0, -1.15, 0.2, 0.26, 4.0);
  for (const z of [-0.6, 1.0]) k.add(box(0.12, 0.14, 0.24), DARK(), T(0, -0.84, z));
  // big tail
  const tp = wingF(0.1, 2.6, 1.6, 1.1, 0.15, -4.9, 0.3, 0.3, 0); paintWing(k, tp, mP, mS, mT, 0.7, 0.8);
  const tf = t => [0.05 + 2.0*t, 2.2 - 0.9*t, 0.14, -5.0 - 0.5*t, 0];
  paintFin(k, tf, UP(0, 0.55), mP, mS, mT, 0.6, 0.75);
  // deck guns either side of the windscreen, rails, spatted gear under the engines
  const mz = [new V3(0.52, 1.02, 3.35), new V3(-0.52, 1.02, 3.35)];
  for (const m of mz) gun(k, m, 1.4, 0.06, 0.55);
  rails(k, 4.8, -0.85, 0.5);
  for (const sx of [1, -1]) { k.add(bar([sx*3.1, -0.9, 0.2], [sx*3.1, -1.6, 0.3], 0.12, 0.2), DARK()); k.add(lathe(SPAT, 8, 0.55, 0.95), mT, T(sx*3.1, -1.85, 0.3)); k.add(cyl(0.36, 0.36, 0.2, 10), DARK(), mul(T(sx*3.1, -1.9576, 0.35), RZ(PI/2))); }
  tailWheel(k, -5.0, -0.25, -0.85, 0.16);
  hookMast(k, -0.6, 0.98);
  k.build(g);
  addProp(g, props, new V3(0, 0, 3.35), 3, 3.0, 0.3, DARK(), mT, mS, [[0.3,-0.04],[0.26,0.15],[0.04,0.5]]);
  for (const sx of [1, -1]) addProp(g, props, new V3(sx*3.1, -0.55, 2.55), 3, 2.6, 0.26, DARK(), mT, mS, [[0.2,-0.02],[0.18,0.15],[0.03,0.4]], false, sx);
  g.userData = {prop:props[0], props, muzzles:mz, rails:[new V3(4.8, -1.05, 1.1), new V3(-4.8, -1.05, 1.1)], radius:7.6, cockpit:new V3(0, 1.32, 1.15), exhaust:new V3(0, 0.6, 2.6), gear:2.3};
  return g;
}

/* ---------- Bulldog: armoured slab-sided gunship. Contra-rotating coaxial props on a huge radial, cheek scoops like jowls
   with a snarl painted on them, a studded collar, dihedral wings with fat rocket pods on the tips, an H-tail.
   Paint: main = hull and wings; second = jowls, collar, pod bands, hubs; trim = cowl, pods, tips. */
function bulldog(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [], plate = PLATE();
  // faceted armoured body: eight-sided sections with hard chines, deep at the front, tapering to a wedge
  const sec = (z, w, yb, yt, ch) => [[-w + ch, yb, z], [w - ch, yb, z], [w, yb + ch, z], [w, yt - ch, z], [w - ch, yt, z], [-w + ch, yt, z], [-w, yt - ch, z], [-w, yb + ch, z]];
  k.add(loft([sec(-4.4, 0.16, 0.1, 0.5, 0.06), sec(-3.2, 0.48, -0.4, 0.8, 0.16), sec(-1.0, 0.92, -0.95, 1.05, 0.3), sec(1.4, 1.02, -1.05, 1.1, 0.34), sec(2.6, 0.98, -0.98, 1.02, 0.32)]), mP);
  for (const z of [-2.0, 0.2]) {
    k.add(loft([sec(z - 0.1, z < 0 ? 0.76 : 0.99, z < 0 ? -0.76 : -1.04, z < 0 ? 0.98 : 1.1, 0.26), sec(z + 0.1, z < 0 ? 0.8 : 1.0, z < 0 ? -0.8 : -1.05, z < 0 ? 1.0 : 1.11, 0.27)]), plate);
    for (const y of [-0.4, 0.05, 0.5]) k.both(disc(0.045, 5), STEEL(), onSide((z < 0 ? 0.8 : 1.0) + 0.012, y, z));
  }
  k.add(loft([sec(-3.2, 0.5, 0.78, 0.86, 0.04), sec(-4.4, 0.18, 0.48, 0.54, 0.02)]), mT);                                              // tail cap
  // the collar, with brass studs
  k.add(loft([sec(2.16, 1.04, -1.06, 1.1, 0.34), sec(2.46, 1.03, -1.04, 1.08, 0.33)]), mS);
  for (const y of [-0.45, 0, 0.45]) k.both(cyl(0, 0.07, 0.12, 4), BRASS(), mul(T(1.09, y, 2.31), RZ(-PI/2)));
  for (const x of [-0.22, 0.22]) k.add(cyl(0, 0.07, 0.12, 4), BRASS(), T(x, 1.15, 2.31));
  radialCowl(k, 2.6, 1.0, mT, 9);
  // cheek scoops, the bulldog's jowls, with a snarl on each
  for (const sx of [1, -1]) k.add(loft([quadRing(2.3, -0.18, 0.18, -0.75, -0.2), quadRing(1.6, -0.32, 0.32, -0.95, -0.1), quadRing(0.0, -0.28, 0.28, -0.9, -0.15), quadRing(-0.8, -0.08, 0.08, -0.6, -0.35)]), mS, T(sx*1.08, 0, 0));
  for (const sx of [1, -1]) k.add(box(0.3, 0.5, 0.05), INK(), T(sx*1.08, -0.47, 2.31));
  const snarl = [[-0.5,0],[-0.2,-0.18],[0.3,-0.18],[0.5,0.02],[0.3,0.16],[-0.2,0.16]], teeth = [];
  for (let i = 0; i < 4; i++) { const x = -0.22 + i*0.13; for (const v of poly([[x,0.16],[x + 0.065,0.02],[x + 0.13,0.16]])) teeth.push(v); for (const v of poly([[x,-0.18],[x + 0.13,-0.18],[x + 0.065,-0.04]])) teeth.push(v); }
  k.decal(mul(onSide(1.415, -0.52, 0.9), SC(1.1)), [[xf(poly(snarl), SC(1.15, 1.35, 1)), mT], [poly(snarl), INK()], [teeth, BONE()]], true);
  // armoured canopy with slit windows and a roof hatch
  k.add(loft([sec(1.0, 0.5, 1.05, 1.2, 0.1), sec(0.4, 0.55, 1.05, 1.62, 0.18), sec(-0.8, 0.5, 1.05, 1.6, 0.18), sec(-1.5, 0.3, 1.0, 1.2, 0.1)]), plate);
  for (const sx of [1, -1]) k.add(box(0.04, 0.16, 0.9), GLASS(), T(sx*0.5, 1.42, -0.1)); k.add(box(0.7, 0.18, 0.04), GLASS(), T(0, 1.42, 0.52));
  k.add(cyl(0.24, 0.24, 0.05, 8), GUNMETAL(), T(0, 1.63, -0.2));
  seatAndPilot(g, k, 0, 1.38, -0.1);
  // wings with dihedral and big wingtip rocket pods
  const mw = wingF(0.95, 3.6, 2.6, 1.8, 0.36, 0.2, 0.3, -0.45, 0.55); paintWing(k, mw, mP, mS, mT, 0.6, 0.72, false);
  wingEmblem(k, mw, 0.36, emblem(0.48, mS, mT));
  const tip = mw(1), rk = [], PD = [[0.05, -1.8], [0.42, -1.4], [0.5, -0.4], [0.5, 1.0], [0.44, 1.35]];
  for (const sx of [1, -1]) {
    const px = sx*(tip[0] + 0.45), py = tip[4] - 0.05, pz = tip[3] + 0.3, M = T(px, py, pz);
    k.add(lathe(cut(PD, -1.8, -1.0), 8), mS, M); k.add(lathe(cut(PD, -1.0, 0.65), 8, 1, 1, false), mT, M); k.add(lathe(cut(PD, 0.65, 0.95), 8, 1, 1, false), mS, M); k.add(lathe(cut(PD, 0.95, 1.35), 8, 1, 1, false), STEEL(), M);
    k.add(box(1.25, 0.04, 0.5), mS, T(px, py, pz - 1.45)); k.add(box(0.04, 1.25, 0.5), mS, T(px, py, pz - 1.45));
    k.add(disc(0.42, 10), INK(), T(px, py, pz + 1.36));
    for (const [a, r] of [[0, 0], ...[0, 1, 2, 3, 4, 5].map(i => [i*PI/3, 0.26])]) { const x = px + Math.cos(a)*r, y = py + Math.sin(a)*r; k.add(disc(0.075, 6), DARK(), T(x, y, pz + 1.37)); rk.push(new V3(x, y, pz + 1.45)); }
  }
  // H-tail with fins on the tips
  const tp = wingF(0.15, 2.0, 1.3, 1.0, 0.14, -3.6, 0.2, 0.3, 0); k.both(pan(tp, 0, 1), mP);
  const tf = t => [0.05 + 1.35*t, 1.35 - 0.4*t, 0.12, -3.65 - 0.2*t, 0];
  for (const sx of [1, -1]) { paintFin(k, tf, UP(sx*2.15, 0.3), mP, mS, mT, 0.52, 0.7); k.add(pan(tf, 0, 0.5), mT, DOWN(sx*2.15, 0.3)); }
  // four heavy guns: wing roots, and on the deck over the cowl; tail-dragger gear
  const mz = [new V3(1.3, -0.35, 1.9), new V3(-1.3, -0.35, 1.9), new V3(0.42, 1.14, 3.3), new V3(-0.42, 1.14, 3.3)];
  gun(k, mz[0], 1.2, 0.07, 0.45); gun(k, mz[1], 1.2, 0.07, 0.45); gun(k, mz[2], 2.0, 0.07, 0.6); gun(k, mz[3], 2.0, 0.07, 0.6);
  for (const sx of [1, -1]) gearLeg(k, [sx*1.5, -0.7, 0.9], [sx*1.72, -1.66, 1.0], 0.44, mT, mP, sx);
  tailWheel(k, -3.9, -0.1, -0.6, 0.15);
  hookMast(k, -1.4, 1.2);
  k.build(g);
  addProp(g, props, new V3(0, 0, 3.55), 3, 3.0, 0.3, DARK(), mT, mS, [[0.3,-0.1],[0.3,0.2]], false, 1);
  addProp(g, props, new V3(0, 0, 3.9), 3, 2.9, 0.3, DARK(), mT, mS, [[0.3,-0.15],[0.27,0.12],[0.14,0.4],[0.04,0.55]], false, -1);
  g.userData = {prop:props[0], props, muzzles:mz, rails:rk, radius:5.6, cockpit:new V3(0, 1.44, 0.0), exhaust:new V3(0, 0.6, 2.4), gear:2.1};
  return g;
}

/* ---------- Thunderbuss: twin-fuselage heavy bomber. Two hulls joined by the centre wing and the tailplane.
   The pilot flies from the left (+X) hull; the right hull carries the bombardier's gondola and an astrodome.
   Paint: main = hulls and wings; second = stripes, tailplane, wing bands; trim = cowls, tips, tail cones, turret rings. */
function thunderbuss(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [];
  const X = 2.7, F = [[0.1,-5.6],[0.36,-5.1],[0.66,-3.4],[0.8,-1.0],[0.8,1.4],[0.72,2.6]];
  const tf = t => [0.05 + 1.7*t, 1.6 - 0.6*t, 0.14, -4.9 - 0.3*t, 0];
  for (const sx of [1, -1]) {
    k.add(lathe(cut(F, -5.6, -4.4), 8, 1, 1.12), mT, T(sx*X, 0, 0)); k.add(lathe(cut(F, -4.4, 2.6), 8, 1, 1.12, false), mP, T(sx*X, 0, 0));
    k.add(xf(stripe(F, -4.4, 2.6, -0.06, 0.14, 1, 1.12, 8), T(sx*X, 0, 0)), mS); k.add(xf(xf(stripe(F, -4.4, 2.6, -0.06, 0.14, 1, 1.12, 8), SC(-1, 1, 1)), T(sx*X, 0, 0)), mS);
    turretDome(k, sx*X, 0.82, -1.9, 0.48, mT, true);
    paintFin(k, tf, UP(sx*X, 0.5), mP, mS, mT, 0.55, 0.7);
    radialCowl(k, 2.6, 0.76, mT, 7, sx*X, 0);
    k.add(tube([sx*(X + 0.78), -0.25, 2.5], [sx*(X + 0.8), -0.32, 1.1], 0.07, 6), DARK());                         // exhaust pipe on the outer flank
    gearLeg(k, [sx*X, -0.7, 0.8], [sx*(X + 0.17), -1.58, 0.9], 0.42, mT, mP, sx);
    tailWheel(k, -4.9, -0.35, -0.85, 0.15, sx*X);
  }
  k.decal(onSide(X + 0.9239*rAt(F, -3.0) + 0.03, 0.03, -3.0, 0.054), emblem(0.27, mS, mT), true);
  // the pilot's greenhouse on the left hull
  canopy(k, [[2.0, 0.3, 0.76, 0.84], [1.4, 0.42, 0.74, 1.38], [0.3, 0.42, 0.76, 1.4], [-0.5, 0.26, 0.76, 0.96]], STEEL(), X);
  seatAndPilot(g, k, X, 1.18, 0.8);
  // the right hull: bombardier's glazed gondola under the nose, an astrodome on top
  k.add(loft([quadRing(2.3, -X - 0.2, -X + 0.2, -0.8, -0.6), quadRing(1.9, -X - 0.34, -X + 0.34, -1.14, -0.6), quadRing(0.9, -X - 0.34, -X + 0.34, -1.14, -0.6), quadRing(0.2, -X - 0.15, -X + 0.15, -0.8, -0.6)]), GLASS());
  for (const z of [1.9, 0.9]) { for (const s of [1, -1]) k.add(bar([-X + s*0.34, -0.7, z], [-X + s*0.34, -1.14, z], 0.045), STEEL()); k.add(bar([-X - 0.34, -1.14, z], [-X + 0.34, -1.14, z], 0.045), STEEL()); }
  for (const s of [1, -1]) k.add(bar([-X + s*0.34, -1.14, 1.9], [-X + s*0.34, -1.14, 0.9], 0.045), STEEL());
  k.add(torus(0.3, 0.045, 10, 4), mT, mul(T(-X, 0.82, 0.9), RX(PI/2)));
  k.add(lathe([[0.3, 0], [0.26, 0.16], [0.14, 0.27], [0.02, 0.3]], 10), GLASS(), mul(T(-X, 0.82, 0.9), RX(-PI/2)));
  // centre wing and tailplane joining the hulls, outer wings
  k.add(loft([foil(-X, 2.9, 0.32, 0.4, -0.25), foil(X, 2.9, 0.32, 0.4, -0.25)]), mP);
  k.add(loft([foil(-X - 0.1, 1.4, 0.14, -4.95, 0.45), foil(X + 0.1, 1.4, 0.14, -4.95, 0.45)]), mS);
  const ow = wingF(X, 5.6, 2.9, 1.4, 0.3, 0.4, 0.4, -0.25, 0.35); paintWing(k, ow, mP, mS, mT, 0.7, 0.78); navLamps(k, ow);
  wingEmblem(k, ow, 0.56, emblem(0.6, mS, mT));
  store(k, 0, -0.78, 0.3, 0.32, 3.4);                                                                                  // bomb slung under the centre wing
  for (const z of [-0.3, 0.9]) k.add(box(0.12, 0.12, 0.24), DARK(), T(0, -0.43, z));
  // four guns in the leading edge of the centre wing
  const mz = [new V3(0.5, -0.2, 2.65), new V3(-0.5, -0.2, 2.65), new V3(1.2, -0.2, 2.65), new V3(-1.2, -0.2, 2.65)];
  for (const m of mz) gun(k, m, 1.1, 0.05, 0.5);
  rails(k, 5.6, -0.4, 0.4);
  // skyhook pylon on the centre wing
  hookMast(k, 0.0, -0.1);
  k.both(bar([0.85, -0.1, 0.35], [0.03, 1.48, 0.0], 0.045), STEEL()); k.add(bar([0, -0.2, -0.85], [0, 1.48, -0.02], 0.045), STEEL());
  k.build(g);
  for (const sx of [1, -1]) addProp(g, props, new V3(sx*X, 0, 3.55), 3, 2.9, 0.28, DARK(), mT, mS, [[0.26,-0.03],[0.22,0.15],[0.04,0.5]], false, sx);
  g.userData = {prop:props[0], props, muzzles:mz, rails:[new V3(5.6, -0.6, 1.0), new V3(-5.6, -0.6, 1.0)], radius:8.6, cockpit:new V3(X, 1.24, 0.9), exhaust:new V3(X, 0.4, 2.0), gear:2.0};
  return g;
}

/* ---------- Comet: barrel racer. A fat teardrop round a huge radial, stubby braced wings, the cockpit right back at the fin.
   Paint: main = barrel and wings; second = racing bands, wing bands, comet; trim = cowl, tail cone, tips, spats. */
function comet(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [];
  const F = [[0.05,-4.6],[0.24,-4.0],[0.58,-2.8],[0.96,-1.2],[1.16,0.2],[1.2,1.4],[1.14,2.3],[1.04,2.8]];
  k.add(lathe(cut(F, -4.6, -3.0), 10, 1, 1.05), mT); k.add(lathe(cut(F, -3.0, 2.8), 10, 1, 1.05, false), mP);
  for (const [z0, z1] of [[-2.2, -1.9], [-1.2, -0.9], [-0.2, 0.1]]) k.add(lathe(cut(F, z0, z1), 10, 1.01, 1.06, false), mS);     // racing bands
  radialCowl(k, 2.8, 1.12, mT, 9);
  k.decal(onSide(0.951*rAt(F, 0.9)*1.0 + 0.04, 0.0, 0.9, 0.0), [[disc(0.6, 16), BONE()], [ring(0.52, 0.6, 16), mT]], true);
  { const eight = move(ring(0.1, 0.19, 12), 0, 0.17); for (const v of move(ring(0.11, 0.21, 12), 0, -0.19)) eight.push(v);   // racing number 8: reads the same on both sides
    k.decal(onSide(0.951*rAt(F, 0.9) + 0.07, 0.0, 0.9, 0.0), [[eight, INK()]], true); }
  // the cockpit, far aft: a tall bubble so the pilot sees over the barrel, faired straight into the fin
  canopy(k, [[-1.45, 0.2, 0.86, 0.96], [-2.2, 0.33, 0.6, 1.52], [-3.0, 0.27, 0.5, 1.56]], STEEL());
  k.add(glassCan([[-3.0, 0.29, 0.45, 1.58], [-4.3, 0.07, 0.2, 1.3]]), mT);
  seatAndPilot(g, k, 0, 1.33, -2.6);
  const tf = t => [0.3 + 1.5*t, 1.6 - 0.4*t, 0.13, -4.0 - 0.2*t, 0];
  k.add(pan(tf, 0, 0.7), mP, UP(0, 0.3)); k.add(pan(tf, 0.7, 1), mT, UP(0, 0.3)); k.add(tipOf(tf, 0.2, 0.5), mT, UP(0, 0.3));
  { const tail = []; for (const [y, w] of [[0.1, 0.07], [0, 0.09], [-0.1, 0.07]]) for (const v of poly([[-0.1, y - w/2], [0.5 - Math.abs(y), y*1.6], [-0.1, y + w/2]])) tail.push(v);   // a comet on the fin
    k.decal(onSide(0.08, 1.25, -4.2), [[tail, mS], [move(star(0.17, 0.075), -0.2, 0), mS]], true); }
  const tp = wingF(0.25, 1.5, 0.9, 0.6, 0.1, -4.0, 0.15, 0.05, 0); paintWing(k, tp, mP, mS, mT, 0.7, 0.8);
  // stubby wings braced with flying wires, and huge spats
  const mw = wingF(0.9, 2.9, 1.7, 0.9, 0.2, 0.9, 0.15, -0.75, 0.25); paintWing(k, mw, mP, mS, mT, 0.62, 0.74); navLamps(k, mw);
  for (const z of [1.2, 0.5]) { k.both(wire([2.6, -0.54, z - 0.1], [0.8, 0.72, z]), STEEL()); k.both(wire([2.6, -0.68, z - 0.1], [1.45, -1.3, z]), STEEL()); }
  for (const sx of [1, -1]) { k.add(bar([sx*1.45, -0.8, 1.0], [sx*1.45, -1.3, 1.0], 0.14, 0.4), mP); k.add(lathe([[0.03,-1.0],[0.32,-0.6],[0.46,0.1],[0.38,0.7],[0.12,1.05]], 8, 0.55, 1.0), mT, T(sx*1.45, -1.6, 1.0)); wheel(k, sx*1.45, -1.76, 1.05, 0.34, mS, 0.2); }
  k.add(bar([0, -0.25, -4.0], [0, -0.62, -4.35], 0.05), DARK());
  const mz = [new V3(1.3, -0.7, 2.05), new V3(-1.3, -0.7, 2.05), new V3(0.4, 1.26, 3.1), new V3(-0.4, 1.26, 3.1)];
  gun(k, mz[0], 0.8, 0.05, 0); gun(k, mz[1], 0.8, 0.05, 0); gun(k, mz[2], 1.3, 0.05, 0.55); gun(k, mz[3], 1.3, 0.05, 0.55);
  rails(k, 2.6, -0.75, 0.9, 1.0);
  hookMast(k, -1.0, 1.15);
  k.build(g);
  addProp(g, props, new V3(0, 0, 3.75), 2, 2.9, 0.3, DARK(), mT, mS, [[0.34,-0.04],[0.3,0.2],[0.05,0.6]]);
  g.userData = {prop:props[0], props, muzzles:mz, rails:[new V3(2.6, -0.92, 1.4), new V3(-2.6, -0.92, 1.4)], radius:4.8, cockpit:new V3(0, 1.39, -2.5), exhaust:new V3(0, -0.5, 2.2), gear:2.1};
  return g;
}

/* ---------- Whirligig: autogyro. A free-spinning rotor on a tripod pylon, nose radial, stub wings with upturned tips.
   Paint: main = fuselage and stub wings; second = stripe, tailplane, rotor blades; trim = cowl, fins, tips, hubs. */
function rotorOf(blades, R, chord, mB, mBand, mTip){
  const rot = new THREE.Group(), k = new Kit(), dz = y => -0.32*(y/R)*(y/R);                 // the blades droop a little at rest
  const sec = (y, c, t) => [[-c*0.35, y, dz(y) - t/2], [c*0.65, y, dz(y) - t/2], [c*0.65, y, dz(y) + t/2], [-c*0.35, y, dz(y) + t/2]];
  for (let i = 0; i < blades; i++) {
    const M = RZ(i*2*PI/blades);
    k.add(tube([0, 0.1, 0], [0, R*0.17, dz(R*0.17)], 0.05, 6), STEEL(), M);
    k.add(loft([sec(R*0.14, chord*0.6, 0.07), sec(R*0.24, chord, 0.08), sec(R*0.45, chord, 0.075), sec(R*0.64, chord, 0.07)]), mB, M);
    k.add(loft([sec(R*0.64, chord, 0.07), sec(R*0.71, chord, 0.07)]), mBand, M);
    k.add(loft([sec(R*0.71, chord, 0.07), sec(R*0.9, chord, 0.06)]), mB, M);
    k.add(loft([sec(R*0.9, chord, 0.06), sec(R, chord*0.6, 0.05)]), mTip, M);
  }
  k.add(lathe([[0.2, -0.16], [0.2, 0.1], [0.12, 0.2]], 8), STEEL()); k.add(lathe([[0.12, 0.2], [0.1, 0.3], [0.02, 0.36]], 8), BRASS());
  k.build(rot);
  return rot;
}
function whirligig(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [];
  const F = [[0.05,-3.9],[0.24,-3.5],[0.5,-2.0],[0.68,-0.4],[0.7,1.2],[0.62,2.1]];
  k.add(lathe(cut(F, -3.9, -2.8), 8, 1, 1.1), mT); k.add(lathe(cut(F, -2.8, 2.1), 8, 1, 1.1), mP);
  k.both(stripe(F, -2.8, 2.1, -0.05, 0.18, 1, 1.1, 8), mS);
  k.decal(onSide(0.9239*rAt(F, -1.7) + 0.03, 0.03, -1.7, 0.1), emblem(0.22, mS, mT), true);
  radialCowl(k, 2.1, 0.7, mT, 7);
  k.both(tube([0.7, -0.3, 2.05], [0.68, -0.38, 0.9], 0.06, 6), DARK());                                               // exhaust pipes
  // open cockpit: leather coaming, framed windscreen, headrest fairing
  k.add(torus(0.32, 0.06, 10, 4), LEATHER(), mul(T(0, 0.72, -0.3), SC(1, 1, 1.3), RX(PI/2)));
  k.add(disc(0.32, 10), INK(), mul(T(0, 0.72, -0.3), SC(1, 1, 1.3), RX(-PI/2)));
  seatAndPilot(g, k, 0, 1.0, -0.3);
  { const o = []; quad(o, [-0.28,0.72,0.12], [0.28,0.72,0.12], [0.22,0.98,-0.02], [-0.22,0.98,-0.02]); k.add(o, GLASS()); }
  k.both(bar([0.28,0.72,0.12], [0.22,0.98,-0.02], 0.035), DARK()); k.add(bar([-0.22,0.98,-0.02], [0.22,0.98,-0.02], 0.035), DARK());
  k.add(loft([quadRing(-0.78, -0.2, 0.2, 0.55, 1.0), quadRing(-2.3, -0.05, 0.05, 0.4, 0.52)]), mP);
  // rotor pylon: a tripod up to the hub, clear of the skyhook
  const hub = [0, 2.5, 0.3];
  for (const [x, z] of [[0.45, 0.9], [-0.45, 0.9], [0, -1.2]]) k.add(bar([x, 0.6, z], hub, 0.07), DARK());
  k.add(cyl(0.16, 0.2, 0.4, 8), STEEL(), T(hub[0], hub[1], hub[2]));
  // stub wings with upturned tips, braced to the fuselage; tail with three fins
  const mw = wingF(0.6, 2.2, 1.3, 0.9, 0.16, 0.6, 0.1, -0.45, 0.1); paintWing(k, mw, mP, mS, mT, 0.7, 0.8, false);
  const tip = mw(1), uf = t => [0.05 + 0.7*t, 0.9 - 0.3*t, 0.1, tip[3] - 0.1*t, 0];
  for (const sx of [1, -1]) { k.add(pan(uf, 0, 1), mT, UP(sx*tip[0], tip[4])); k.add(tipOf(uf, 0.1, 0.6), mT, UP(sx*tip[0], tip[4])); }
  k.both(bar([0.55, 0.3, 0.75], [2.0, -0.36, 0.65], 0.04, 0.08), DARK());
  const tp = wingF(0.1, 1.5, 1.0, 0.8, 0.1, -3.3, 0.1, 0.2, 0); k.both(pan(tp, 0, 1), mS);
  const tf = t => [0.05 + 1.0*t, 1.1 - 0.3*t, 0.1, -3.35 - 0.1*t, 0];
  paintFin(k, tf, UP(0, 0.25), mP, mS, mT, 0.5, 0.68);
  for (const sx of [1, -1]) { k.add(pan(tf, 0, 0.7), mT, UP(sx*1.6, 0.2)); k.add(tipOf(t => tf(t*0.7), 0.1, 0.6), mT, UP(sx*1.6, 0.2)); k.add(pan(tf, 0, 0.3), mT, DOWN(sx*1.6, 0.2)); }
  // two guns on the cowl deck, light rails
  const mz = [new V3(0.2, 0.81, 2.9), new V3(-0.2, 0.81, 2.9)];
  for (const m of mz) gun(k, m, 1.5, 0.04, 0.55);
  rails(k, 2.2, -0.5, 0.6, 0.9);
  // wide-track gear on V-struts
  for (const sx of [1, -1]) {
    k.add(bar([sx*0.4, -0.5, 1.0], [sx*1.2, -1.44, 0.9], 0.07, 0.12), DARK()); k.add(bar([sx*0.4, -0.55, 0.1], [sx*1.2, -1.44, 0.9], 0.05, 0.1), DARK());
    k.add(bar([sx*1.5, -0.45, 0.65], [sx*1.2, -1.44, 0.9], 0.05, 0.1), DARK());
    wheel(k, sx*1.3, -1.46, 0.9, 0.36, mT);
  }
  tailWheel(k, -3.4, -0.3, -0.7, 0.12);
  hookMast(k, -0.17, 1.9);
  k.build(g);
  addProp(g, props, new V3(0, 0, 3.05), 2, 2.3, 0.22, DARK(), mT, mS, [[0.2,-0.02],[0.18,0.12],[0.03,0.4]]);
  // the rotor turns about the vertical: built in the XY plane, then tipped flat
  const rotor = rotorOf(3, 5.4, 0.4, mS, mT, mT);
  const holder = new THREE.Group(); holder.position.set(hub[0], hub[1] + 0.25, hub[2]); holder.rotation.x = -PI/2; holder.add(rotor); g.add(holder);
  rotor.userData.dir = 1; rotor.userData.rate = 0.55; props.push(rotor);
  g.userData = {prop:props[0], props, muzzles:mz, rails:[new V3(2.2, -0.7, 1.0), new V3(-2.2, -0.7, 1.0)], radius:5.6, cockpit:new V3(0, 1.05, -0.2), exhaust:new V3(0, -0.3, 1.6), gear:1.82};
  return g;
}
/* ---------- Zephyr: Hollis's jet, in the manner of the Messerschmitt Me 262: a long, slim shark fuselage of rounded-triangle
   section (broad flat belly, soft chines, narrow back) with a blunt rounded nose, thin low wings swept on the leading edge
   and nearly straight behind, two long fat turbojets slung under them, a tall swept fin with the tailplane part-way up it,
   a tricycle undercarriage and four cannon in the top of the nose. About 10.6 m long and 12.6 m in span.
   No propellers. Paint: main = fuselage, nacelles and wing roots; second = wing panels, cheat line; trim = nose tip, intake lips, fin top, tips. */
function zephyr(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr);
  // the shark body. Stations are [z, half width at the chine, belly y, back y, roundness]: triangular amidships, oval at the nose and tail.
  const ST = [[-5.3, 0.03, 0.24, 0.36, 1], [-4.8, 0.09, 0.08, 0.47, 1], [-3.8, 0.21, -0.2, 0.55, 0.75], [-2.4, 0.38, -0.5, 0.62, 0.4], [-1.0, 0.55, -0.69, 0.66, 0.12], [0.2, 0.62, -0.74, 0.68, 0],
              [1.4, 0.62, -0.74, 0.68, 0], [2.4, 0.6, -0.73, 0.64, 0.12], [3.4, 0.53, -0.69, 0.53, 0.4], [4.2, 0.42, -0.63, 0.37, 0.7], [4.7, 0.32, -0.56, 0.23, 0.9],
              [5.05, 0.22, -0.46, 0.08, 1], [5.22, 0.13, -0.36, -0.04, 1], [5.3, 0.045, -0.26, -0.14, 1]];
  const TRI = [[0.6, 0], [0.92, 0.06], [1, 0.2], [0.84, 0.6], [0.54, 0.87], [0.23, 1]], OVL = [[0.26, 0.017], [0.71, 0.146], [0.97, 0.37], [0.97, 0.63], [0.71, 0.854], [0.26, 0.983]];
  const at = z => { let i = 0; while (i < ST.length - 2 && z > ST[i+1][0]) i++; const a = ST[i], b = ST[i+1], t = Math.min(1, Math.max(0, (z - a[0])/(b[0] - a[0]))); return a.map((v, j) => v + (b[j] - v)*t); };
  const half = z => { const [, w, yb, yt, e] = at(z); return TRI.map((p, j) => [w*(p[0] + (OVL[j][0] - p[0])*e), yb + (yt - yb)*(p[1] + (OVL[j][1] - p[1])*e), z]); };
  const sect = z => { const h = half(z); return [...h, ...h.slice().reverse().map(p => [-p[0], p[1], p[2]])]; };
  const zsOf = (z0, z1) => [z0, ...ST.map(s => s[0]).filter(z => z > z0 + 1e-6 && z < z1 - 1e-6), z1];
  const body = (z0, z1, c0 = true, c1 = true) => loft(zsOf(z0, z1).map(sect), c0, c1);
  /* Height of the upper skin at (x, z). */
  const skinY = (x, z) => { const h = half(z); x = Math.abs(x); for (let i = 5; i > 2; i--) if (x <= h[i-1][0]) { const a = h[i], b = h[i-1]; return x <= a[0] ? a[1] : a[1] + (b[1] - a[1])*(x - a[0])/(b[0] - a[0]); } return h[2][1]; };
  /* Paint strip on body facet i (2 = the flank above the chine), between fractions f0 and f1 of the facet, +X side. */
  const strip = (z0, z1, i, f0, f1, off = 0.014) => {
    const o = [], zs = zsOf(z0, z1);
    const Pt = (z, f) => { const h = half(z), a = h[i], b = h[i+1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [a[0] + dx*f + off*dy/L, a[1] + dy*f - off*dx/L, z]; };
    for (let j = 0; j < zs.length - 1; j++) quad(o, Pt(zs[j], f0), Pt(zs[j], f1), Pt(zs[j+1], f1), Pt(zs[j+1], f0));
    return o;
  };
  k.add(body(-5.3, 4.86, true, false), mP); k.add(body(4.86, 5.3, false, true), mT);                           // main, and the rounded nose cap in trim
  k.both(strip(-4.4, 4.5, 2, 0.3, 0.44), mS);                                                                // cheat line down the flank
  /* Saddle of paint over the back between z0 and z1: the two shoulder facets and the deck between them. */
  const saddle = (z0, z1, off = 0.014) => { const o = [], zs = zsOf(z0, z1), R = z => { const h = half(z), a = h[4], b = h[5]; return [[a[0] + off, a[1] + off*0.6, z], [b[0], b[1] + off, z], [-b[0], b[1] + off, z], [-a[0] - off, a[1] + off*0.6, z]]; };
    for (let j = 0; j < zs.length - 1; j++) { const a = R(zs[j]), b = R(zs[j+1]); for (let i = 0; i < 3; i++) quad(o, a[i], a[i+1], b[i+1], b[i]); } return fix(o); };
  k.add(saddle(2.3, 4.86), mS); k.add(saddle(-3.3, -1.3), mS);
  // low framed canopy on the spine: raked windscreen, hood, glazed rear, then a solid fairing running down into the back
  const CS = [[2.2, 0.22, 0.56, 0.68], [1.72, 0.3, 0.5, 1.07], [1.2, 0.32, 0.5, 1.12], [0.7, 0.32, 0.5, 1.11], [0.2, 0.29, 0.5, 1.03]];
  const hoop = ([z, w, yb, yt]) => [[-w, yb, z], [w, yb, z], [w*0.96, yb + (yt - yb)*0.55, z], [w*0.56, yt, z], [-w*0.56, yt, z], [-w*0.96, yb + (yt - yb)*0.55, z]];
  k.add(loft(CS.map(hoop)), GLASS());
  k.add(loft([hoop(CS[4]), hoop([-0.35, 0.2, 0.52, 0.86]), hoop([-0.95, 0.08, 0.56, 0.7])]), mP);                // spine fairing behind the glass
  { const fr = mP, H = CS.map(hoop), rib = 0.045;
    for (let i = 1; i < 5; i++) for (let j = 1; j < 5; j++) k.add(bar(H[i][j], H[i][j+1], i === 2 ? 0.032 : rib), fr);   // hoops: windscreen arch, hood frames, rear arch
    for (const j of [2, 3, 4, 5]) k.add(bar(H[0][j === 2 ? 1 : j === 5 ? 0 : j], H[1][j], rib), fr);             // windscreen posts
    for (let i = 0; i < 4; i++) for (const j of [1, 0]) k.add(bar([H[i][j][0], H[i][j][1] + 0.02, H[i][j][2]], [H[i+1][j][0], H[i+1][j][1] + 0.02, H[i+1][j][2]], 0.04), fr);   // sills
    for (const j of [2, 5]) k.add(bar(H[1][j], H[4][j], 0.03), fr); }                                            // rails along the shoulder of the hood
  k.add(box(0.4, 0.42, 0.04), PLATE(), T(0, 0.78, 0.82)); k.add(box(0.2, 0.14, 0.07), LEATHER(), T(0, 0.9, 0.86));   // armour plate and headrest
  k.add(box(0.44, 0.08, 0.3), DARK(), T(0, 0.66, 1.78)); k.add(box(0.06, 0.08, 0.06), GUNMETAL(), T(0, 0.74, 1.7));   // coaming and gunsight
  seatAndPilot(g, k, 0, 0.88, 1.1);
  // thin low wings: leading edge swept 18.5 degrees, trailing edge nearly straight with a kink at the nacelle
  const KT = 0.29, WY = -0.5;
  const mw = t => { const le = 1.98 - 1.91*t, te = t < KT ? -1.02 + 0.3*t/KT : -0.72 - 0.38*(t - KT)/(1 - KT); return [0.4 + 5.7*t, le - te, 0.2*(1 - 0.5*t), (le + te)/2, WY + 0.5*t]; };
  k.both(pan(mw, 0, KT), mP); k.both(pan(mw, KT, 0.5), mS); k.both(pan(mw, 0.5, 0.72), mP); k.both(pan(mw, 0.72, 0.93), mS); k.both(pan(mw, 0.93, 1), mT); k.both(tipOf(mw, 0.2, 0.6), mT); navLamps(k, mw);
  { const r = mw(0), q = mw(0.1); k.both(loft([foil(0.3, r[1]*1.05, r[2]*1.9, r[3] - 0.02, r[4] - 0.03), foil(q[0], q[1]*1.01, q[2]*1.06, q[3], q[4])]), mP); }   // root fillet
  /* Hinge seam along the 65% chord ridge of a wing function, upper and lower surface. */
  const seam = (f, t0, t1, w = 0.03) => { const a = f(t0), b = f(t1), o = bar([a[0], a[4] + 0.46*a[2], a[3] - 0.15*a[1]], [b[0], b[4] + 0.46*b[2], b[3] - 0.15*b[1]], w, 0.02);
    for (const v of bar([a[0], a[4] - 0.42*a[2], a[3] - 0.1*a[1]], [b[0], b[4] - 0.42*b[2], b[3] - 0.1*b[1]], w, 0.02)) o.push(v); return o; };
  k.both(seam(mw, 0.05, 0.2), INK()); k.both(seam(mw, 0.39, 0.6), INK()); k.both(seam(mw, 0.62, 0.98), INK());
  wingEmblem(k, mw, 0.61, [[disc(0.3, 16), BONE()], [ring(0.24, 0.3, 16), mT]]);
  { const s = mw(1); k.add(tube([s[0] - 0.1, s[4], s[3] + s[1]*0.4], [s[0] - 0.1, s[4], s[3] + s[1]*0.5 + 0.55], 0.02, 4), STEEL()); }   // pitot on the port tip
  // the twin turbojets: long fat cigars hung straight under the wing, reaching well ahead of it. Round intake lip and starter bullet
  // in front, a tapering tail with the bare nozzle and its exhaust cone poking out behind the trailing edge.
  const jets = [], NX = 2.05, NY = WY + 0.5*KT - 0.31, ZX = -1.05;
  const NA = [[0.23, ZX], [0.27, -0.8], [0.35, -0.3], [0.42, 0.3], [0.46, 1.0], [0.465, 1.7], [0.445, 2.25], [0.41, 2.55], [0.365, 2.7], [0.31, 2.76], [0.26, 2.72]];
  for (const sx of [1, -1]) {
    const x = sx*NX, M = T(x, NY, 0);
    k.add(lathe(cut(NA, ZX, -0.8), 12, 1, 1, false), DARK(), M);                                                // nozzle
    k.add(lathe(cut(NA, -0.8, -0.55), 12, 1, 1, false), GUNMETAL(), M);                                         // bare hot section
    k.add(lathe(cut(NA, -0.55, 2.3), 12, 1, 1, false), mP, M);
    k.add(lathe(cut(NA, 2.3, 2.42), 12, 1, 1, false), mS, M);
    k.add(lathe(cut(NA, 2.42, 2.72), 12, 1, 1, false), mT, M);                                                  // intake lip
    k.add(disc(0.3, 12), INK(), T(x, NY, 2.6));                                                                 // down the intake
    k.add(lathe([[0.14, 2.56], [0.14, 2.68], [0.09, 2.8], [0.025, 2.86]], 8), STEEL(), M);                      // starter bullet
    k.add(disc(0.23, 12), INK(), mul(T(x, NY, ZX + 0.08), RY(PI)));                                             // up the pipe
    k.add(lathe([[0.02, ZX - 0.3], [0.09, ZX - 0.1], [0.14, ZX + 0.1]], 8), GUNMETAL(), M);                     // exhaust cone
    k.add(loft([quadRing(1.6, -0.1, 0.1, 0.2, 0.44), quadRing(0.3, -0.13, 0.13, 0.24, 0.42), quadRing(-0.75, -0.05, 0.05, 0.14, 0.3)]), mP, M);   // fairing over the wing
    jets.push(new V3(x, NY, ZX));
  }
  // tail: tall fin with a straight, sharply swept leading edge and a rounded top; thin tailplane set part-way up it
  const FY = 0.34, vf = t => [1.55*t, 1.95 - 1.27*t, 0.11*(1 - 0.3*t), -4.3 - 0.65*t, 0];
  paintFin(k, vf, UP(0, FY), mP, mS, mT, 0.64, 0.72);
  k.add(seam(vf, 0.1, 0.97), INK(), UP(0, FY));
  const tp = wingF(0.03, 1.8, 1.2, 0.62, 0.085, -4.5, 0.27, 0.98, 0.02); paintWing(k, tp, mP, mS, mT, 0.72, 0.82);
  k.both(seam(tp, 0.1, 0.97, 0.025), INK());
  k.decal(onSide(0.07, 1.36, -4.62), [[poly([[-0.22, 0.26], [0.09, 0.04], [-0.04, 0.02], [0.22, -0.26], [-0.09, -0.04], [0.04, -0.02]]), mS]], true);   // a lightning bolt on the fin
  // four cannon in the top of the nose, the inner pair ahead of the outer, each firing from a blast trough; rocket rails outboard of the nacelles
  const mz = [[0.085, 4.72], [-0.085, 4.72], [0.215, 4.4], [-0.215, 4.4]].map(([x, z]) => new V3(x, skinY(x, z) + 0.025, z));
  for (const m of mz) { k.add(lathe([[0.02, -0.6], [0.058, -0.38], [0.058, -0.1], [0.045, -0.05]], 6), DARK(), T(m.x, m.y, m.z)); gun(k, m, 0.42, 0.038, 0); }
  rails(k, 3.4, -0.37, 0.15);
  // tricycle undercarriage: mains in the wing roots folding inward into the belly, nose leg folding back under the cockpit floor
  gearLeg(k, [0, -0.4, 3.15], [0, -1.4, 3.18], 0.3, mT, null, 0);
  for (const sx of [1, -1]) gearLeg(k, [sx*1.28, -0.36, 0.25], [sx*1.45, -1.3, 0.28], 0.4, mT, mP, sx);
  hookMast(k, -0.62, 0.74);
  k.build(g);
  // each jet glows: a hot ring in the pipe around the exhaust cone and a soft flame behind it, brighter with throttle (planes.js)
  const glow = [];
  for (const j of jets) {
    const hot = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshBasicMaterial({color:0xff9a3a, transparent:true, opacity:0.8, depthWrite:false}));
    hot.position.copy(j).add(new V3(0, 0, 0.02)); hot.rotation.y = PI; g.add(hot);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.2, 10, 1, true), new THREE.MeshBasicMaterial({color:0xffb060, transparent:true, opacity:0.35, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide}));
    flame.rotation.x = -PI/2; flame.position.copy(j).add(new V3(0, 0, -0.6)); g.add(flame);
    glow.push({hot, flame});
  }
  const prop = new THREE.Group(); prop.visible = false; g.add(prop);   // no propeller: an empty stand-in keeps the plane contract
  g.userData = {prop, props:[], jet:glow, muzzles:mz, rails:[new V3(3.4, -0.56, 0.65), new V3(-3.4, -0.56, 0.65)], radius:6.4, cockpit:new V3(0, 0.93, 1.22), exhaust:jets[0].clone(), gear:1.7};
  return g;
}

/* ---------- Hornet: Ambrose Kroll's rocket-boosted interceptor, rebuilt by Hollis.
   A long slim wasp-waisted fuselage with a chin radiator, inverted gull wings with the main gear in a knuckle pod at the kink,
   contra-rotating propellers on a long nose, a hood set well back, a tall swept fin, and a rocket motor in the tail
   that lights up when the boost is on.
   Paint: main = fuselage and wings; second = the hornet bands, flash, fin and front spinner; trim = tips, cowl ring, nozzle collar. ---------- */
/* The stinger badge: black disc, a ring and a hornet's dart with two wings in the second colour. */
function stingBadge(r, mS){
  const art = poly([[0, -0.66*r], [0.2*r, 0.08*r], [0, 0.4*r], [-0.2*r, 0.08*r]]);
  for (const t of [poly([[0.12*r, 0.14*r], [0.6*r, 0.44*r], [0.14*r, 0.36*r]]), poly([[-0.12*r, 0.14*r], [-0.14*r, 0.36*r], [-0.6*r, 0.44*r]])]) for (const v of t) art.push(v);
  return [[disc(r, 14), INK()], [ring(r*0.8, r*0.9, 14), mS], [art, mS]];
}
function hornet(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [];
  // the body: a 12-sided lathe, a little deeper than it is wide, pinched behind the cockpit and swelling again over the rocket motor
  const N = 12, SX = 0.94, SY = 1.1, CF = Math.cos(PI/N);
  const F = [[0.2, -4.72], [0.3, -4.42], [0.45, -3.8], [0.58, -3.1], [0.63, -2.5], [0.53, -1.6], [0.57, -1.0], [0.69, -0.2], [0.77, 0.8], [0.78, 1.6], [0.74, 2.6], [0.66, 3.3], [0.56, 3.8], [0.47, 4.12]];
  const seg = (z0, z1, m, caps = false, s = 1) => k.add(lathe(cut(F, z0, z1), N, SX*s, SY*s, caps), m);
  seg(-4.72, -4.42, mT, true); seg(-4.42, 3.52, mP); seg(3.52, 3.66, mS); seg(3.66, 4.12, mT, true);      // nozzle collar, body, cowl pinstripe and cowl ring
  for (const [z0, z1] of [[-3.95, -3.72], [-3.42, -3.08], [-2.74, -2.3]]) seg(z0, z1, mS, false, 1.014);  // hornet bands round the abdomen, widening forward
  k.both(stripe(F, -1.75, 3.52, -0.21, -0.07, SX, SY, N), mS);                                            // flash along the flank
  for (let i = 0; i < 6; i++) { const z = 2.0 + i*0.27; k.both(box(0.08, 0.09, 0.2), DARK(), mul(T(rAt(F, z)*CF*SX + 0.025, 0.16, z), RY(-0.5))); }   // exhaust stacks
  // chin radiator under the long nose
  const chin = (z, w, yT, yB) => [[-w, yT, z], [-w*0.78, yB, z], [w*0.78, yB, z], [w, yT, z]];
  k.add(loft([chin(3.74, 0.3, -0.42, -0.97), chin(2.9, 0.35, -0.6, -1.06), chin(1.1, 0.2, -0.7, -0.88)]), mP);
  k.add(poly([[-0.24, -0.5], [-0.19, -0.91], [0.19, -0.91], [0.24, -0.5]]), INK(), T(0, 0, 3.745));
  k.add(bar([-0.22, -0.94, 3.75], [0.22, -0.94, 3.75], 0.06), mT); k.add(bar([-0.27, -0.47, 3.75], [0.27, -0.47, 3.75], 0.06), mT);
  for (const sx of [1, -1]) k.add(bar([sx*0.275, -0.47, 3.75], [sx*0.215, -0.94, 3.75], 0.06), mT);
  // the rocket: a bare bell in the tail cone
  k.add(lathe([[0.36, -5.0], [0.3, -4.86], [0.2, -4.64]], 10, 1, 1, false), GUNMETAL());
  k.add(lathe([[0.385, -5.0], [0.385, -4.95]], 10, 1, 1, false), STEEL());
  k.add(disc(0.34, 10), INK(), mul(T(0, 0, -4.96), RY(PI)));
  // framed hood set well back, a razor spine running from it into the fin
  const CS = [[1.3, 0.2, 0.72, 0.86], [0.72, 0.33, 0.7, 1.27], [0.1, 0.35, 0.68, 1.36], [-0.6, 0.32, 0.62, 1.27], [-1.3, 0.2, 0.52, 1.0]];
  const hoop = ([z, w, yb, yt]) => [[-w, yb, z], [w, yb, z], [w*0.96, yb + (yt - yb)*0.55, z], [w*0.56, yt, z], [-w*0.56, yt, z], [-w*0.96, yb + (yt - yb)*0.55, z]];
  k.add(loft(CS.map(hoop)), GLASS());
  k.add(loft([hoop(CS[4]), hoop([-2.2, 0.1, 0.5, 0.8]), hoop([-3.3, 0.04, 0.4, 0.62])]), mP);
  { const H = CS.map(hoop);
    for (let i = 1; i < 5; i++) for (let j = 1; j < 5; j++) k.add(bar(H[i][j], H[i][j+1], i === 2 || i === 3 ? 0.032 : 0.045), mP);
    for (const j of [2, 3, 4, 5]) k.add(bar(H[0][j === 2 ? 1 : j === 5 ? 0 : j], H[1][j], 0.045), mP);
    for (let i = 0; i < 4; i++) for (const j of [1, 0]) k.add(bar([H[i][j][0], H[i][j][1] + 0.02, H[i][j][2]], [H[i+1][j][0], H[i+1][j][1] + 0.02, H[i+1][j][2]], 0.04), mP);
    for (const j of [2, 5]) k.add(bar(H[1][j], H[4][j], 0.03), mP); }
  k.add(box(0.4, 0.42, 0.04), PLATE(), T(0, 0.98, -0.42)); k.add(box(0.2, 0.14, 0.07), LEATHER(), T(0, 1.1, -0.38));
  k.add(box(0.44, 0.08, 0.3), DARK(), T(0, 0.84, 0.86)); k.add(box(0.06, 0.08, 0.06), GUNMETAL(), T(0, 0.92, 0.78));
  seatAndPilot(g, k, 0, 1.06, -0.1);
  // inverted gull wings: down and out to the kink, then up and out to the tips, the outer panels tapering on both edges
  const KK = 0.3, wf = t => { const u = t < KK ? t/KK : (t - KK)/(1 - KK), le = t < KK ? 1.78 - 0.1*u : 1.68 - 0.78*u, te = t < KK ? -0.72 + 0.1*u : -0.62 + 0.52*u;
    return [0.5 + 5.0*t, le - te, 0.3*(1 - 0.55*t), (le + te)/2, t < KK ? -0.22 - 0.6*u : -0.82 + 1.07*u]; };
  k.both(pan(wf, 0, KK), mP); k.both(pan(wf, KK, 0.62), mP); k.both(pan(wf, 0.62, 0.69), mS); k.both(pan(wf, 0.69, 0.75), mP); k.both(pan(wf, 0.75, 0.82), mS); k.both(pan(wf, 0.82, 1), mT);
  k.both(tipOf(wf, 0.2, 0.55), mT); navLamps(k, wf);
  const seam = (f, t0, t1, w = 0.03) => { const a = f(t0), b = f(t1), o = bar([a[0], a[4] + 0.46*a[2], a[3] - 0.15*a[1]], [b[0], b[4] + 0.46*b[2], b[3] - 0.15*b[1]], w, 0.02);
    for (const v of bar([a[0], a[4] - 0.42*a[2], a[3] - 0.1*a[1]], [b[0], b[4] - 0.42*b[2], b[3] - 0.1*b[1]], w, 0.02)) o.push(v); return o; };
  k.both(seam(wf, 0.04, 0.28), INK()); k.both(seam(wf, 0.33, 0.6), INK()); k.both(seam(wf, 0.62, 0.98), INK());
  { const s = wf(0.11); k.both(box(0.62, 0.09, 0.04), INK(), mul(T(s[0], s[4], s[3] + s[1]*0.5 + 0.004), RZ(-0.38))); }   // oil cooler slots in the roots
  wingEmblem(k, wf, 0.47, stingBadge(0.33, mS));
  // knuckle pod at the kink: gear bay behind, landing lamp in the nose
  const kn = wf(KK), POD = [[0.03, -1.2], [0.15, -0.75], [0.22, 0.1], [0.22, 0.95], [0.15, 1.45], [0.06, 1.72]];
  k.both(lathe(cut(POD, -1.2, 1.3), 8, 1, 1, false), mP, T(kn[0], kn[4] - 0.08, kn[3])); k.both(lathe(cut(POD, 1.3, 1.72), 8), mS, T(kn[0], kn[4] - 0.08, kn[3]));
  // four cannon in the wings outboard of the kink, rocket rails beyond them
  const mz = [0.4, 0.5].flatMap(t => { const s = wf(t), z = s[3] + s[1]*0.5 + 0.62; return [new V3(s[0], s[4] - 0.02, z), new V3(-s[0], s[4] - 0.02, z)]; });
  for (const m of mz) { gun(k, m, 1.15, 0.042, 0.58); k.add(tube([m.x, m.y, m.z - 0.12], [m.x, m.y, m.z + 0.02], 0.06, 6), GUNMETAL()); }
  const rl = wf(0.64), RYy = rl[4] - rl[2]*0.5 - 0.07; rails(k, rl[0], RYy, rl[3] + 0.05, 1.1);
  // short main legs under the knuckles, folding inward under the roots; a ventral strake carries the tail wheel
  for (const sx of [1, -1]) gearLeg(k, [sx*kn[0], kn[4] - 0.12, kn[3] + 0.35], [sx*(kn[0] + 0.18), -1.6, kn[3] + 0.42], 0.4, mT, mP, sx);
  const vs = t => [0.5*t, 1.5 - 0.85*t, 0.1, -3.7 - 0.38*t, 0];
  k.add(pan(vs, 0, 1), mP, DOWN(0, -0.36)); k.add(tipOf(vs, 0.07, 0.6), mT, DOWN(0, -0.36));
  tailWheel(k, -4.2, -0.8, -1.03, 0.13);
  // tail: a tall swept fin in the second colour with the badge on it, and a small tailplane
  const FY = 0.42, vf = t => [1.62*t, 1.85 - 1.05*t, 0.12*(1 - 0.3*t), -3.72 - 0.85*t, 0];
  paintFin(k, vf, UP(0, FY), mS, mP, mT, 0.68, 0.77);
  k.add(seam(vf, 0.06, 0.97), INK(), UP(0, FY));
  k.decal(onSide(0.072, FY + 0.6, -4.02), stingBadge(0.3, mS), true);
  const tp = wingF(0.15, 1.75, 1.1, 0.55, 0.09, -4.0, 0.45, 0.18, 0.14); paintWing(k, tp, mP, mS, mT, 0.66, 0.78);
  hookMast(k, -1.0, 1.05); k.add(wire([0, 1.58, -0.05], [0, FY + 1.56, -4.5]), DARK());
  k.build(g);
  // two propellers, turning opposite ways, on stacked spinners
  addProp(g, props, new V3(0, 0, 4.17), 3, 2.9, 0.3, DARK(), mS, mP, [[0.45, -0.05], [0.4, 0.1], [0.36, 0.24]], false, 1);
  addProp(g, props, new V3(0, 0, 4.45), 3, 2.8, 0.28, DARK(), mS, mS, [[0.36, -0.04], [0.29, 0.26], [0.17, 0.54], [0.04, 0.74]], false, -1);
  // the rocket's fire
  const hot = new THREE.Mesh(new THREE.CircleGeometry(0.31, 12), new THREE.MeshBasicMaterial({color:0xff7a2a, transparent:true, opacity:0.12, depthWrite:false})); hot.position.set(0, 0, -4.975); hot.rotation.y = PI; g.add(hot);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.6, 10, 1, true), new THREE.MeshBasicMaterial({color:0xffb060, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide}));
  flame.rotation.x = -PI/2; flame.position.set(0, 0, -6.28); g.add(flame);
  g.userData = {prop:props[0], props, burner:{hot, flame}, muzzles:mz, rails:[new V3(rl[0], RYy - 0.2, rl[3] + 0.55), new V3(-rl[0], RYy - 0.2, rl[3] + 0.55)], radius:5.6, cockpit:new V3(0, 1.12, 0), exhaust:new V3(0, 0, -4.95), gear:2.0};
  return g;
}

/* ---------- Banshee: Dr. Quill's twin-engine, twin-boom fighter from Ashgrove's drawings. An engine at the head of each boom
   with a three-bladed tractor propeller, the two turning opposite ways; a turbo-supercharger let into the top of each boom over
   the wing and radiator scoops on its flanks behind it; a short nacelle between them, starting ahead of the propeller discs,
   with a framed hood and every gun in the nose: four machine guns round two long cannon. Oval fins at the boom ends carry a
   straight tailplane and elevator between them. Tricycle gear. A raked radio mast with a glowing valve, aerial wires to both
   fins and a loop under the nose fly the ghost drone it carries.
   Paint: main = nacelle, booms and wings; second = the ghost colour: spinners, fin tops, boom flashes, wing bands; trim = tips, bands, collars. ---------- */
/* The wraith badge: black disc, a ring and a wailing ghost in the second colour. */
function wraithBadge(r, mS){
  const S2 = SC(r, r, 1), gh = move(disc(0.4, 8), 0, 0.2), ink = [];
  for (const v of poly([[-0.4, -0.3], [0.4, -0.3], [0.4, 0.2], [-0.4, 0.2]])) gh.push(v);
  for (const i of [-1, 0, 1]) for (const v of poly([[i*0.267 - 0.133, -0.3], [i*0.267, -0.62], [i*0.267 + 0.133, -0.3]])) gh.push(v);
  for (const sx of [1, -1]) for (const v of move(disc(0.1, 6), sx*0.16, 0.26)) ink.push(v);
  for (const v of poly([[0, 0.1], [-0.08, -0.06], [0, -0.24], [0.08, -0.06]])) ink.push(v);
  return [[disc(r, 10), INK()], [ring(r*0.8, r*0.9, 10), mS], [xf(gh, S2), mS], [xf(ink, S2), INK()]];
}
function banshee(paint){
  const [P, S, Tr] = paint, g = new THREE.Group(), k = new Kit(), mP = G.mat(P), mS = G.mat(S), mT = G.mat(Tr), props = [];
  // the nacelle: short, narrow and deep, a 12-sided lathe ending in a blunt bare-metal gun nose well ahead of the propellers
  const N = 12, SX = 0.8, SY = 0.94;
  const F = [[0.06, -2.15], [0.3, -1.7], [0.56, -0.8], [0.7, 0.2], [0.72, 1.2], [0.66, 2.2], [0.54, 3.0], [0.4, 3.6], [0.27, 4.0], [0.13, 4.16]];
  const seg = (z0, z1, m, caps = false) => k.add(lathe(cut(F, z0, z1), N, SX, SY, caps), m);
  seg(-2.15, -1.72, mT, true); seg(-1.72, 3.05, mP); seg(3.05, 3.17, mT); seg(3.17, 3.68, mP); seg(3.68, 4.16, GUNMETAL(), true);   // tail cone, body, pinstripe, gun bay, nose cap
  k.both(stripe(F, -1.3, 3.05, 0.08, 0.2, SX, SY, N), mS);                                                   // flash along the flank
  k.add(facet(F, 2.2, 3.68, 3, -0.24, 0.24, SX, SY, N), DARK());                                             // anti-glare deck
  // framed hood, a razor spine fairing it into the tail cone
  const CS = [[2.2, 0.2, 0.44, 0.66], [1.55, 0.31, 0.48, 1.08], [0.9, 0.33, 0.5, 1.16], [0.2, 0.31, 0.5, 1.1], [-0.55, 0.2, 0.46, 0.86]];
  const hoop = ([z, w, yb, yt]) => [[-w, yb, z], [w, yb, z], [w*0.96, yb + (yt - yb)*0.55, z], [w*0.56, yt, z], [-w*0.56, yt, z], [-w*0.96, yb + (yt - yb)*0.55, z]];
  k.add(loft(CS.map(hoop)), GLASS());
  k.add(loft([hoop(CS[4]), hoop([-1.3, 0.12, 0.3, 0.62]), hoop([-2.05, 0.03, 0.02, 0.14])]), mP);
  { const H = CS.map(hoop);
    for (let i = 1; i < 5; i++) for (let j = 1; j < 5; j++) k.add(bar(H[i][j], H[i][j+1], i === 2 || i === 3 ? 0.032 : 0.045), mP);
    for (const j of [2, 3, 4, 5]) k.add(bar(H[0][j === 2 ? 1 : j === 5 ? 0 : j], H[1][j], 0.045), mP);
    for (let i = 0; i < 4; i++) for (const j of [1, 0]) k.add(bar([H[i][j][0], H[i][j][1] + 0.02, H[i][j][2]], [H[i+1][j][0], H[i+1][j][1] + 0.02, H[i+1][j][2]], 0.04), mP);
    for (const j of [2, 5]) k.add(bar(H[1][j], H[4][j], 0.03), mP); }
  k.add(box(0.4, 0.4, 0.04), PLATE(), T(0, 0.8, 0.42)); k.add(box(0.2, 0.13, 0.07), LEATHER(), T(0, 0.92, 0.46));
  k.add(box(0.44, 0.08, 0.3), DARK(), T(0, 0.62, 1.66)); k.add(box(0.06, 0.08, 0.06), GUNMETAL(), T(0, 0.7, 1.58));
  seatAndPilot(g, k, 0, 0.88, 0.76);
  // the wing: a long straight centre section between the booms, then outer panels tapering on both edges with a little dihedral
  const BX = 2.2, BY = -0.2, KK = (BX - 0.4)/5.9, wf = t => { const u = t < KK ? t/KK : (t - KK)/(1 - KK), le = t < KK ? 1.75 : 1.75 - 1.02*u, te = t < KK ? -1.15 : -1.15 + 0.85*u;
    return [0.4 + 5.9*t, le - te, t < KK ? 0.36 : 0.34 - 0.2*u, (le + te)/2, t < KK ? -0.12 : -0.12 + 0.5*u]; };
  k.both(pan(wf, 0, KK), mP); k.both(pan(wf, KK, 0.72), mP); k.both(pan(wf, 0.72, 0.79), mS); k.both(pan(wf, 0.79, 0.88), mP); k.both(pan(wf, 0.88, 1), mT);
  k.both(tipOf(wf, 0.2, 0.5), mT); navLamps(k, wf);
  const seam = (f, t0, t1, w = 0.03) => { const a = f(t0), b = f(t1), o = bar([a[0], a[4] + 0.46*a[2], a[3] - 0.15*a[1]], [b[0], b[4] + 0.46*b[2], b[3] - 0.15*b[1]], w, 0.02);
    for (const v of bar([a[0], a[4] - 0.42*a[2], a[3] - 0.1*a[1]], [b[0], b[4] - 0.42*b[2], b[3] - 0.1*b[1]], w, 0.02)) o.push(v); return o; };
  k.both(seam(wf, 0.03, KK - 0.09), INK()); k.both(seam(wf, KK + 0.09, 0.98), INK());
  wingEmblem(k, wf, 0.56, wraithBadge(0.36, mS));
  { const s = wf(0.45); k.add(tube([s[0], s[4] - 0.05, s[3] + s[1]*0.5 - 0.05], [s[0], s[4] - 0.05, s[3] + s[1]*0.5 + 0.55], 0.022, 4), STEEL()); }   // pitot
  // the booms: engine in front, chin cooler under it, turbo let into the top over the wing, radiator scoops on the flanks, a long taper to the fins
  const BN = 10, BSY = 1.16, BCF = Math.cos(PI/BN);
  const B = [[0.05, -6.15], [0.14, -5.8], [0.2, -4.8], [0.27, -3.3], [0.37, -1.9], [0.45, -0.4], [0.48, 1.0], [0.47, 2.2], [0.41, 2.75], [0.31, 2.98]];
  const chin = (z, w, yT, yB) => [[-w, yT, z], [-w*0.78, yB, z], [w*0.78, yB, z], [w, yT, z]];
  const finU = t => [1.42*t, 1.62*Math.sqrt(1 - 0.86*t*t), 0.1*(1 - 0.3*t), -5.22 - 0.3*t, 0], finL = t => [0.62*t, 1.62*Math.sqrt(1 - 0.9*t*t), 0.1, -5.22 + 0.12*t, 0];
  const TY = BY + 0.06, TZ = -5.2;
  for (const sx of [1, -1]) {
    const M = T(sx*BX, BY, 0), bs = (z0, z1, m, caps = false) => k.add(lathe(cut(B, z0, z1), BN, 1, BSY, caps), m, M);
    bs(-6.15, -3.5, mP, true); bs(-3.5, -3.3, mT); bs(-3.3, 2.5, mP); bs(2.5, 2.62, mT); bs(2.62, 2.98, STEEL(), true);                 // tail, band, engine, collar, nose ring
    for (const s of [1, -1]) k.add(stripe(B, -5.0, -3.5, -0.1, 0.17, 1, BSY, BN), mS, mul(M, SC(s, 1, 1)));                          // ghost flash on both flanks
    // chin oil cooler
    k.add(loft([chin(2.72, 0.2, -0.2, -0.66), chin(2.0, 0.25, -0.3, -0.74), chin(0.5, 0.13, -0.42, -0.6)]), mP, M);
    k.add(poly([[-0.16, -0.27], [-0.13, -0.61], [0.13, -0.61], [0.16, -0.27]]), INK(), mul(M, T(0, 0, 2.725)));
    k.add(bar([-0.16, -0.64, 2.73], [0.16, -0.64, 2.73], 0.05), mT, M);
    for (let i = 0; i < 4; i++) { const z = 1.3 + i*0.3; k.add(box(0.08, 0.08, 0.18), DARK(), mul(M, T(-sx*(rAt(B, z)*BCF + 0.02), 0.2, z), RY(sx*0.5))); }   // exhaust stubs, inboard
    // turbo-supercharger: intake scoop, a hump faired into the boom top, the turbine wheel lying in a steel well
    k.add(loft([quadRing(1.0, -0.15, 0.15, 0.44, 0.72), quadRing(0.3, -0.25, 0.25, 0.4, 0.74), quadRing(-0.9, -0.25, 0.25, 0.38, 0.68), quadRing(-2.0, -0.09, 0.09, 0.3, 0.42)]), mP, M);
    k.add(box(0.22, 0.17, 0.04), INK(), mul(M, T(0, 0.6, 1.005)));
    k.add(cyl(0.21, 0.23, 0.07, 10), STEEL(), mul(M, T(0, 0.74, -0.3))); k.add(cyl(0.15, 0.15, 0.03, 10), INK(), mul(M, T(0, 0.775, -0.3)));
    k.add(cyl(0.05, 0.08, 0.06, 6), BRASS(), mul(M, T(0, 0.8, -0.3)));
    k.add(tube([0, 0.7, -0.62], [0, 0.78, -1.05], 0.065, 6), DARK(), M);                                                         // waste pipe
    // radiator scoops on both flanks behind the wing
    for (const s of [1, -1]) {
      k.add(loft([quadRing(-1.45, s*0.3, s*0.62, -0.24, 0.24), quadRing(-2.3, s*0.26, s*0.6, -0.24, 0.24), quadRing(-3.25, s*0.18, s*0.3, -0.12, 0.12)]), mP, M);
      k.add(box(0.2, 0.38, 0.04), INK(), mul(M, T(s*0.5, 0, -1.445)));
      k.add(box(0.035, 0.42, 0.06), mT, mul(M, T(s*0.615, 0, -1.44)));
    }
    // oval fin, above and below the boom, in bands; a whip aerial on top
    const UPM = UP(sx*BX, BY), DNM = DOWN(sx*BX, BY), ts = [0, 0.3, 0.52, 0.6, 0.82, 1];
    for (let i = 0; i < 5; i++) k.add(pan(finU, ts[i], ts[i+1]), i < 2 ? mP : i === 2 ? mT : mS, UPM);
    k.add(tipOf(finU, 0.1, 0.55), mS, UPM);
    k.add(pan(finL, 0, 0.45), mP, DNM); k.add(pan(finL, 0.45, 0.8), mP, DNM); k.add(pan(finL, 0.8, 1), mT, DNM); k.add(tipOf(finL, 0.07, 0.5), mT, DNM);
    k.add(bar([sx*(BX + 0.035), BY - 0.5, -5.78], [sx*(BX + 0.035), BY + 1.2, -6.02], 0.03, 0.02), INK()); k.add(bar([sx*(BX - 0.035), BY - 0.5, -5.78], [sx*(BX - 0.035), BY + 1.2, -6.02], 0.03, 0.02), INK());   // rudder hinge line
    k.add(tube([sx*BX, BY + 1.5, -5.66], [sx*BX, BY + 1.86, -5.82], 0.014, 4), STEEL());
    // main leg under the engine
    gearLeg(k, [sx*BX, BY - 0.42, 0.2], [sx*(BX + 0.17), -1.72, 0.26], 0.38, mT, mP, sx);
  }
  k.decal(onSide(BX + 0.07, BY + 0.38, -5.2), wraithBadge(0.3, mS), true);
  // straight tailplane between the fins with a one-piece elevator, its mass balance on a stalk, and a small tip outboard of each fin
  k.add(loft([foil(-BX, 0.78, 0.12, TZ + 0.2, TY), foil(BX, 0.78, 0.12, TZ + 0.2, TY)]), mP);
  const elev = (x, m) => [[x, TY + 0.045, TZ - 0.21], [x, TY + 0.012, TZ - 0.74], [x, TY - 0.012, TZ - 0.74], [x, TY - 0.045, TZ - 0.21]];
  for (const [a, b, m] of [[-BX + 0.06, -0.55, mP], [-0.55, 0.55, mS], [0.55, BX - 0.06, mP]]) k.add(loft([elev(a), elev(b)]), m);
  k.add(bar([-BX + 0.08, TY + 0.05, TZ - 0.2], [BX - 0.08, TY + 0.05, TZ - 0.2], 0.035, 0.02), INK());
  for (const s of [1, -1]) { k.add(bar([0, TY, TZ - 0.4], [0, TY + s*0.34, TZ - 0.3], 0.03), DARK()); k.add(ball(0.06, 6, 3), GUNMETAL(), T(0, TY + s*0.36, TZ - 0.29)); }
  k.both(loft([foil(BX, 0.8, 0.1, TZ + 0.18, TY), foil(BX + 0.55, 0.4, 0.05, TZ + 0.02, TY)]), mT);
  // radio: raked blade mast behind the hood with a glowing valve, aerial wires to both fins, a loop under the nose
  const MT = [0, 1.62, -1.5];
  k.add(bar([0, 0.6, -1.05], MT, 0.05, 0.13), DARK()); k.add(ball(0.065, 6, 3), lamp(S), T(MT[0], MT[1] + 0.05, MT[2]));
  for (const sx of [1, -1]) k.add(wire(MT, [sx*BX, BY + 1.5, -5.66]), DARK());
  k.add(bar([0, -0.7, 1.7], [0, -0.88, 1.7], 0.04, 0.1), DARK()); k.add(torus(0.17, 0.022, 8, 4), STEEL(), mul(T(0, -1.02, 1.7), RY(PI/2)));
  // all the guns in the nose: four machine guns in blast tubes round two long cannon
  const mz = [[0.19, 0.15, 4.42], [-0.19, 0.15, 4.42], [0.2, -0.13, 4.3], [-0.2, -0.13, 4.3], [0.075, 0.0, 4.74], [-0.075, 0.0, 4.74]].map(([x, y, z]) => new V3(x, y, z));
  for (const m of mz.slice(0, 4)) { k.add(tube([m.x, m.y, 3.7], [m.x, m.y, m.z - 0.2], 0.062, 6), GUNMETAL()); gun(k, m, 0.5, 0.034, 0); }
  for (const m of mz.slice(4)) { k.add(tube([m.x, m.y, 3.9], [m.x, m.y, 4.3], 0.07, 6), STEEL()); gun(k, m, 0.7, 0.048, 0); k.add(tube([m.x, m.y, m.z - 0.14], [m.x, m.y, m.z + 0.02], 0.065, 6), GUNMETAL()); }
  const rl = wf(0.66), RYy = rl[4] - rl[2]*0.5 - 0.07; rails(k, rl[0], RYy, rl[3] + 0.05, 1.1);
  // nose leg under the gun bay
  gearLeg(k, [0, -0.52, 3.0], [0, -1.8, 3.06], 0.3, mT, null, 0);
  hookMast(k, -0.85, 0.8);
  k.build(g);
  // two tractor propellers, turning opposite ways (inward over the top)
  for (const sx of [1, -1]) addProp(g, props, new V3(sx*BX, BY, 3.0), 3, 3.0, 0.27, DARK(), mT, mS, [[0.31, -0.03], [0.29, 0.14], [0.19, 0.42], [0.04, 0.64]], false, sx);
  g.userData = {prop:props[0], props, muzzles:mz, rails:[new V3(rl[0], RYy - 0.2, rl[3] + 0.55), new V3(-rl[0], RYy - 0.2, rl[3] + 0.55)], radius:6.6, cockpit:new V3(0, 0.94, 0.85), exhaust:new V3(BX, BY + 0.8, -0.5), gear:2.1};
  return g;
}

const AIRFRAMES = {gallant, vandal, sparrowhawk, mantis, jackal, highwayman, grackle, ironclad, bulldog, thunderbuss, comet, whirligig, zephyr, hornet, banshee};

G.buildPlane = (chassis, paint) => {
  const f = AIRFRAMES[chassis] || gallant;
  LEGS = []; GUNSINK = []; let m; try { m = f(paint); } finally { var legs = LEGS, tg = GUNSINK; LEGS = GUNSINK = null; }
  m.userData.chassis = chassis; if (!m.userData.props) m.userData.props = [m.userData.prop];
  m.userData.legs = legs.map(({lk, a, side}) => { const p = new THREE.Group(); p.position.set(a[0], a[1], a[2]); lk.build(p); p.userData.side = side; m.add(p); return p; });
  m.userData.turretGuns = tg.map(({gk, at}) => { const yaw = new THREE.Group(), pit = new THREE.Group(); yaw.position.set(at[0], at[1], at[2]); yaw.add(pit); gk.build(pit); m.add(yaw); yaw.userData.pitch = pit; return yaw; });
  return m;
};

/* ---------- The Lucky Margaret: the crew's converted cargo airship (~200 m) ---------- */
const NAMES = new Map();
function nameTex(text, ink, line){
  if (typeof document === 'undefined') return null;
  const key = text + ink + line; if (NAMES.has(key)) return NAMES.get(key);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const x = c.getContext('2d');
  x.clearRect(0, 0, 1024, 128); x.textBaseline = 'middle'; x.textAlign = 'center';
  x.font = '900 84px "Gill Sans", "Futura", "Century Gothic", "Trebuchet MS", Arial, sans-serif';
  const gap = 10, w = [...text].reduce((s, ch) => s + x.measureText(ch).width + gap, -gap), sc = Math.min(1, 700/w);
  let px = 512 - w*sc/2;
  x.fillStyle = ink;
  for (const ch of text) { const cw = x.measureText(ch).width; x.save(); x.translate(px + cw*sc/2, 66); x.scale(sc, 1); x.fillText(ch, 0, 0); x.restore(); px += (cw + gap)*sc; }
  x.fillStyle = line;                                         // Art Deco speed lines either side of the name
  const half = w*sc/2 + 26;
  for (let i = 0; i < 3; i++) { const len = 120 - i*34, y = 40 + i*22; x.fillRect(512 - half - len, y, len, 8); x.fillRect(512 + half, y, len, 8); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; NAMES.set(key, t); return t;
}
const css = hex => '#' + hex.toString(16).padStart(6, '0');

G.buildAirship = (o = {}) => {
  const hull = o.hull || 0xe6dcc4, band = o.band || 0xb5382c, trim = o.trim || 0x26384d, g = new THREE.Group(), k = new Kit();
  const mH = G.mat(hull, {roughness:0.66}), mB = G.mat(band), mTr = G.mat(trim), mRib = G.mat(0xc2b79d, {roughness:0.7});
  // hull: sixteen gores with a parallel midbody, painted in blocks along its length
  const N = 16, CF = Math.cos(PI/N), H = [[0.6,-100],[6.5,-95],[13,-83],[18.5,-66],[21.8,-45],[23.5,-18],[23.5,26],[22.2,48],[19,68],[13.5,84],[7,94.5],[0.8,100]];
  const seg = (z0, z1, m, caps = false) => k.add(lathe(cut(H, z0, z1), N, 1, 1, caps), m);
  seg(-100, -95, mTr, true); seg(-95, -67, mH); seg(-67, -66, mTr); seg(-66, -59, mB); seg(-59, -58, mTr); seg(-58, 47, mH);
  seg(47, 48, mTr); seg(48, 55, mB); seg(55, 56, mTr); seg(56, 84, mH); seg(84, 85.5, mTr); seg(85.5, 100, mB, true);
  k.add(lathe([[0.8,100],[0.5,102.4],[0.02,103.4]], 8), BRASS());                              // mooring spike and ring
  k.add(torus(1.3, 0.2, 10, 4), BRASS(), T(0, 0, 100.9));
  // girder ribs along every gore seam, ring frames at every station
  for (let j = 0; j < N; j++) {
    const a = (j + 0.5)*2*PI/N, b = (j + 1.5)*2*PI/N, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    for (let i = 0; i < H.length - 1; i++) {
      const r0 = H[i][0] + 0.05, r1 = H[i+1][0] + 0.05;
      k.add(bar([ca*r0, sa*r0, H[i][1]], [ca*r1, sa*r1, H[i+1][1]], 0.45), mRib);
      if (i > 0) k.add(bar([ca*r0, sa*r0, H[i][1]], [cb*r0, sb*r0, H[i][1]], 0.4), mRib);
    }
  }
  // spine walkway between the dorsal turrets
  { const zs = cut(H, -52, 42).map(q => q[1]); for (let i = 0; i < zs.length - 1; i++) k.add(bar([0, rAt(H, zs[i])*CF + 0.12, zs[i]], [0, rAt(H, zs[i+1])*CF + 0.12, zs[i+1]], 1.0, 0.25), mRib); }
  // her name on both flanks (a small canvas texture; skipped where there is no DOM)
  const nt = o.name === '' ? null : nameTex(o.name || 'LUCKY MARGARET', css(trim), css(band));
  if (nt) for (const sx of [1, -1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(42, 5.25), new THREE.MeshStandardMaterial({map:nt, transparent:true, depthWrite:false, roughness:0.7}));
    m.position.set(sx*(23.5*CF + 0.2), 0.4, 4); m.rotation.y = sx*PI/2; g.add(m);
  }
  // gondola: bridge at the bow with wrap-around windows, lit cabin windows, deeper hangar bay aft
  const gon = (z, hw, yT, yB, ch) => [[-hw, yT, z], [-hw, yB + ch, z], [-hw + ch, yB, z], [hw - ch, yB, z], [hw, yB + ch, z], [hw, yT, z]];
  k.add(loft([gon(31.5, 1.2, -21.6, -26, 0.6), gon(28, 4.6, -21.6, -28.6, 1.5), gon(22, 6, -21.6, -29.5, 1.8), gon(-12, 6, -21.6, -29.5, 1.8),
              gon(-14, 7, -21.6, -34.5, 1.5), gon(-32, 7, -21.6, -34.5, 1.5), gon(-36, 4, -21.6, -31, 1.2)]), mTr);
  const wb = (z, hw) => [[-hw, -24, z], [-hw, -25.5, z], [hw, -25.5, z], [hw, -24, z]];
  k.add(loft([wb(31.62, 1.32), wb(28.05, 4.72), wb(22, 6.1)]), WINDOW());
  for (const [x, z] of [[5.8,23.3], [5.47,24.7], [5.14,26.1], [4.82,27.5], [3.6,29.25], [2.4,30.5]]) k.both(box(0.3, 1.8, 0.3), mTr, T(x + 0.08, -24.75, z));   // mullions
  k.add(box(0.3, 1.8, 0.3), mTr, T(0, -24.75, 31.6));
  for (let z = -9.5; z < 20; z += 2.5) k.both(box(0.2, 1.5, 1.6), WINDOW(), T(6.0, -25, z));
  for (const z of [-17.5, -23, -28.5]) { k.both(disc(0.75, 8), WINDOW(), onSide(7.03, -25.5, z)); k.both(ring(0.75, 1.0, 8), BRASS(), onSide(7.02, -25.5, z)); }
  k.both(bar([4.3,-29.55,22], [4.3,-29.55,-12], 0.3, 0.2), BRASS());                           // keel strakes
  k.add(box(10, 0.3, 14), INK(), T(0, -34.45, -23));                                           // open hangar bay
  for (const [a, b] of [[[-5.2,-34.6,-16],[5.2,-34.6,-16]], [[-5.2,-34.6,-30],[5.2,-34.6,-30]], [[5.2,-34.6,-30],[5.2,-34.6,-16]], [[-5.2,-34.6,-30],[-5.2,-34.6,-16]]]) k.add(bar(a, b, 0.4, 0.3), BRASS());
  for (const sx of [1, -1]) for (const z of [-16, -30]) k.add(ball(0.35, 6, 3), lamp(0x9ef0a0), T(sx*5.2, -34.9, z));
  for (const z of [-30, -20, -8, 4, 16, 26]) k.both(wire([z > 22 ? 5 : 6, -22.4, z], [14, -18.2, z], 0.1), DARK());   // suspension rigging
  k.add(ball(0.4, 6, 3), lamp(0xff3b30), T(7.2, -23, -13)); k.add(ball(0.4, 6, 3), lamp(0x47e36a), T(-7.2, -23, -13));
  // the three machine-gun stations that game.js fires from: (7,-24,26), (-7,-24,-8), (0,23,-20)
  k.add(box(2.4, 0.9, 1.4), mTr, T(5.2, -24, 25.8)); k.add(ball(0.95, 8, 4), STEEL(), T(6.2, -24, 26)); k.add(tube([6.2,-24,26], [7.7,-24.1,26.5], 0.09, 5), DARK());
  k.add(ball(0.95, 8, 4), STEEL(), T(-6.2, -24, -8)); k.add(tube([-6.2,-24,-8], [-7.7,-24.1,-8.5], 0.09, 5), DARK());
  k.add(cyl(1.2, 1.5, 1.0, 8), mTr, T(0, 23.1, -20)); k.add(tube([0,23.5,-20], [0,24.4,-21.6], 0.09, 5), DARK());
  // hangar trapeze: the player hangs from the bar 9 m below this group
  const trap = new THREE.Group(), tk = new Kit(); trap.position.set(0, -34.5, -22); g.add(trap);
  for (const sx of [1, -1]) { tk.add(bar([sx*3.5,0.3,0], [sx*3.5,-9,0], 0.45), STEEL()); tk.add(bar([sx*3.5,-6.5,0], [sx*1.0,0.2,0], 0.24), STEEL()); tk.add(bar([sx*3.5,-4.5,0], [sx*3.5,0.2,4.5], 0.22), STEEL()); tk.add(bar([sx*3.5,-4.5,0], [sx*3.5,0.2,-4.5], 0.22), STEEL()); }
  tk.add(bar([-3.9,-9,0], [3.9,-9,0], 0.6), BRASS());
  tk.build(trap); g.userData.trapeze = trap;
  // engine pods on V struts, pusher propellers
  const props = [];
  for (const [sx, z] of [[1, 18], [-1, 18], [1, -40], [-1, -40]]) {
    const M = T(sx*27, -14, z), rh = (rAt(H, z) - 0.4)/Math.hypot(27, 14), ax = sx*27*rh, ay = -14*rh;
    k.add(lathe([[0.3,-5.2],[1.7,-3.6],[2.2,-0.5],[2.15,2.0]], 8), mTr, M);
    k.add(lathe([[2.15,2.0],[2.3,2.15],[2.3,2.5],[2.05,2.6]], 8, 1, 1, false), STEEL(), M);
    k.add(lathe([[2.05,2.6],[1.3,4.2],[0.4,4.9]], 8), mB, M);
    k.add(box(0.5, 0.9, 3.4), DARK(), mul(M, T(0, -2.1, 0.4)));                                 // radiator tub
    for (const dz of [1.9, -1.9]) k.add(bar([sx*27, -14, z + dz*0.6], [ax, ay, z + dz], 1.3, 0.5), STEEL());
    k.add(wire([sx*27, -12.2, z], [sx*(rAt(H, z) - 0.4)*0.994, -(rAt(H, z) - 0.4)*0.105, z], 0.09), DARK());
    const p = propeller(3, 7.5, 0.8, DARK(), mB, BRASS(), [[0.05,-1.0],[0.5,-0.5],[0.62,0.1]]); p.position.set(sx*27, -14, z - 5.4); g.add(p); props.push(p);
  }
  g.userData.props = props;
  // cruciform tail fins: hull colour, navy pinstripe, red outer panel; wire-braced, with a lamp on each tip
  const af = t => [6 + 21*t, 26 - 13*t, 1.6*(1 - 0.4*t), -80 - 8*t, 0];
  for (let i = 0; i < 4; i++) {
    const A = RZ(i*PI/2 + PI/4);
    k.add(pan(af, 0, 0.5), mH, A); k.add(pan(af, 0.5, 0.6), mTr, A); k.add(pan(af, 0.6, 1), mB, A); k.add(tipOf(af, 1.2, 0.6), mB, A);
    for (const s of [1, -1]) k.add(wire([23, s*0.5, -84], [19.3, s*0.3, -58], 0.09), DARK(), A);
    k.add(ball(0.45, 6, 3), lamp(i < 2 ? 0xff3b30 : 0x47e36a), mul(A, T(28.4, 0, -90)));
  }
  // flak cannons: two on the spine, two under the gondola on sponsons
  const flak = [new V3(0, 23.5, 34), new V3(0, 23.5, -44), new V3(7.5, -29, 2), new V3(-7.5, -29, 20)];
  for (const f of flak) {
    const dn = f.y < 0 ? -1 : 1, M = T(f.x, f.y, f.z);
    if (dn > 0) k.add(cyl(2.3, 3.0, 3.2, 8), mTr, mul(M, T(0, -1.6, 0)));                       // pedestal down to the hull
    else k.add(box(3.6, 0.6, 3.4), mTr, mul(M, T(-Math.sign(f.x)*1.0, 0.3, 0)));                // sponson out from the gondola
    k.add(cyl(dn > 0 ? 1.7 : 2.0, dn > 0 ? 2.0 : 1.7, 1.0, 8), BRASS(), mul(M, T(0, dn*0.5, 0)));
    k.add(box(2.0, 1.3, 2.2), STEEL(), mul(M, T(0, dn*1.6, 0)));
    k.add(box(2.8, 1.5, 0.22), mTr, mul(M, T(0, dn*1.9, 1.2), RX(-dn*0.5)));                    // gun shield
    for (const sx of [0.45, -0.45]) k.add(tube([sx, dn*1.7, 0.4], [sx, dn*3.7, 2.7], 0.17, 6, true, 0.13), DARK(), M);
  }
  g.userData.flak = flak;
  // docking booms: a girder truss under the belly out to a brass catch-ring on each side. The ring's 13 m circle is left clear.
  const docks = [];
  for (const sx of [1, -1]) {
    const R = new V3(sx*38, -31, 10), yT = x => -22.2 - (x - 6)*0.04, yB = x => -24.7 + (x - 6)*0.026;   // a jib: deep at the root, slim at the ring
    k.add(bar([sx*5.5, yT(5.5), 10], [sx*38.6, yT(38.6), 10], 0.45), STEEL()); k.add(bar([sx*5.5, yB(5.5), 10], [sx*38.6, yB(38.6), 10], 0.45), STEEL());
    for (let i = 0; i < 8; i++) { const x0 = 6.5 + i*4, x1 = x0 + 4; k.add(bar([sx*x0, i % 2 ? yT(x0) : yB(x0), 10], [sx*x1, i % 2 ? yB(x1) : yT(x1), 10], 0.28), STEEL()); }
    k.add(box(2.2, 0.9, 1.4), BRASS(), T(R.x, -23.95, 10));                                     // ring bracket
    k.add(box(1.8, 1.3, 1.8), mTr, T(sx*12, -23.5, 10));                                        // winch house
    k.add(wire([sx*30, yT(30), 10], [sx*18.4, -13.2, 10], 0.08), DARK());                        // stays up to the hull, kept clear of the launch camera at the boom tip
    for (const dz of [22, -22]) k.add(wire([sx*30, yT(30), 10], [sx*17, -15.6, 10 + dz], 0.08), DARK());
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.45, 6, 20), BRASS()); ringM.position.copy(R); ringM.castShadow = true; g.add(ringM);
    for (let i = 0; i < 8; i++) { const a = i*PI/4; for (const dz of [0.5, -0.5]) k.add(ball(0.42, 6, 3), lamp(i % 2 ? 0x9ef0a0 : 0xffd27a), T(R.x + Math.cos(a)*6.6, R.y + Math.sin(a)*6.6, R.z + dz)); }
    for (let i = 0; i < 4; i++) k.add(ball(0.3, 6, 3), lamp(0xffd27a), T(sx*(10 + i*6), yB(10 + i*6) - 0.45, 10));   // lead-in lamps along the boom
    docks.push({ring:R, side:sx, mesh:ringM});
  }
  g.userData.docks = docks;
  k.build(g);
  g.userData.radius = 110;
  return g;
};

/* ---------- Black Lantern "Raider"-class zeppelin (~170 m), the Nightjar ----------
   Built for component damage: every part you can shoot off is its own Group in userData.comps, positioned at its hit centre,
   so combat code can hide it when it's destroyed. Gas cells are virtual (no mesh). Pirates fly hydrogen. */
G.buildRaider = (o = {}) => {
  const hull = o.hull || 0x3a3633, band = o.band || 0x8e231c, trim = o.trim || 0xb88a2a, g = new THREE.Group(), k = new Kit();
  const mH = G.mat(hull, {roughness:0.7}), mB = G.mat(band), mTr = G.mat(trim, {roughness:0.4, metalness:0.35}), mRib = G.mat(0x24211f, {roughness:0.8});
  const RED = () => G.mat(0x3b2418, {roughness:0.3, emissive:0xff6a2a, emissiveIntensity:0.8});
  const N = 14, CF = Math.cos(PI/N), H = [[0.6,-85],[6,-80],[11.5,-70],[16,-56],[19,-38],[20.2,-15],[20.2,20],[19,40],[16,57],[11,71],[5.5,80],[0.7,85]];
  const seg = (z0, z1, m, caps = false) => k.add(lathe(cut(H, z0, z1), N, 1, 1, caps), m);
  seg(-85, -80, mB, true); seg(-80, -61, mH); seg(-61, -60, mTr); seg(-60, -54, mB); seg(-54, -53, mTr); seg(-53, 43, mH);
  seg(43, 44, mTr); seg(44, 50, mB); seg(50, 51, mTr); seg(51, 78, mH); seg(78, 85, mB, true);
  k.add(lathe([[0.7,85],[0.4,87.5],[0.02,88.6]], 8), mTr);                                      // ram spike
  for (let j = 0; j < N; j++) {
    const a = (j + 0.5)*2*PI/N, ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i < H.length - 1; i++) k.add(bar([ca*(H[i][0] + 0.05), sa*(H[i][0] + 0.05), H[i][1]], [ca*(H[i+1][0] + 0.05), sa*(H[i+1][0] + 0.05), H[i+1][1]], 0.42), mRib);
  }
  // name and the Black Lantern skull on both flanks
  const nt = o.name === '' ? null : nameTex(o.name || 'NIGHTJAR', css(0xe6d6b0), css(band));
  if (nt) for (const sx of [1, -1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(34, 4.25), new THREE.MeshStandardMaterial({map:nt, transparent:true, depthWrite:false, roughness:0.7}));
    m.position.set(sx*(20.2*CF + 0.2), 3.2, -2); m.rotation.y = sx*PI/2; g.add(m);
  }
  if (o.skull !== false) { k.decal(mul(onSide(rAt(H, 30)*CF + 0.15, 0, 30), SC(5.5, 5.5, 1)), skull(mTr)); k.decal(mul(onSide(-(rAt(H, 30)*CF + 0.15), 0, 30, PI), SC(5.5, 5.5, 1)), skull(mTr)); }
  // gondola (the bridge windows are a component; this is the armoured shell)
  const gon = (z, hw, yT, yB, ch) => [[-hw, yT, z], [-hw, yB + ch, z], [-hw + ch, yB, z], [hw - ch, yB, z], [hw, yB + ch, z], [hw, yT, z]];
  k.add(loft([gon(28, 1.2, -19.2, -22.5, 0.5), gon(24, 4.5, -19.2, -25.6, 1.4), gon(18, 6, -19.2, -27, 1.6), gon(-26, 6, -19.2, -27, 1.6), gon(-30, 3.5, -19.2, -24.5, 1)]), mH);
  k.both(bar([6.05, -21.2, 18], [6.05, -21.2, -26], 0.25, 0.5), mB);                           // red rubbing strake
  for (let z = -18; z < 14; z += 3) k.both(box(0.2, 1.1, 1.3), RED(), T(6.0, -23.2, z));       // lit portholes
  for (const z of [-24, -6, 8, 20]) k.both(wire([5.4, -19.4, z], [12.5, -16.0, z], 0.1), DARK());
  // side fins (static) and engine struts
  const af = t => [5 + 17*t, 22 - 11*t, 1.4*(1 - 0.4*t), -68 - 7*t, 0];
  for (const ang of [0, PI]) { const A = RZ(ang); k.add(pan(af, 0, 0.6), mH, A); k.add(pan(af, 0.6, 1), mB, A); k.add(tipOf(af, 1.0, 0.6), mB, A); }
  for (const [sx, z] of [[1, 24], [-1, 24], [1, -34], [-1, -34]]) {
    const rh = (rAt(H, z) - 0.4)/Math.hypot(25, 11), ax = sx*25*rh, ay = -11*rh;
    for (const dz of [1.6, -1.6]) k.add(bar([sx*25, -11, z + dz*0.5], [ax, ay, z + dz], 1.1, 0.45), STEEL());
  }
  k.build(g);

  // ---- components ----
  const comps = [], props = [];
  const comp = (id, kind, label, pos, r, hp, cover, build) => {
    const cg = new THREE.Group(); cg.position.copy(pos); const ck = new Kit(); build(ck, cg); ck.build(cg); g.add(cg);
    comps.push({id, kind, label, pos, r, hp, hpMax:hp, cover:cover || null, group:cg, alive:true}); return cg;
  };
  [[1, 24], [-1, 24], [1, -34], [-1, -34]].forEach(([sx, z], i) => comp('eng' + i, 'engine', `${z > 0 ? 'Fore' : 'Aft'} ${sx > 0 ? 'port' : 'starboard'} engine`, new V3(sx*25, -11, z), 5, 250, null, (ck, cg) => {
    ck.add(lathe([[0.3,-4.6],[1.6,-3.2],[2.0,-0.4],[1.95,1.8]], 8), mH); ck.add(lathe([[1.95,1.8],[2.1,1.95],[2.1,2.3],[1.85,2.4]], 8, 1, 1, false), mTr);
    ck.add(lathe([[1.85,2.4],[1.1,3.8],[0.35,4.4]], 8), mB); ck.add(box(0.45, 0.8, 3), DARK(), T(0, -1.9, 0.3));
    for (const dz of [-1, -0.2, 0.6]) ck.both(tube([1.95, 0.5, dz], [2.4, 0.9, dz - 0.4], 0.1, 5), DARK());   // stub exhausts
    const pr = propeller(3, 6.6, 0.7, DARK(), mB, mTr, [[0.05,-0.9],[0.45,-0.45],[0.55,0.1]]); pr.position.set(0, 0, -4.8); cg.add(pr); props.push(pr);
  }));
  const flakT = (ck, dn) => {
    if (dn > 0) ck.add(cyl(2.0, 2.6, 2.4, 8), mH, T(0, -1.2, 0));
    ck.add(cyl(1.6, 1.8, 0.9, 8), mTr, T(0, dn*0.4, 0)); ck.add(box(1.9, 1.2, 2.0), mRib, T(0, dn*1.4, 0));
    ck.add(box(2.6, 1.4, 0.2), mB, mul(T(0, dn*1.7, 1.1), RX(-dn*0.5)));
    for (const sx of [0.42, -0.42]) ck.add(tube([sx, dn*1.5, 0.3], [sx, dn*3.4, 2.5], 0.16, 6, true, 0.12), DARK());
  };
  const top = z => rAt(H, z)*CF;
  comp('flak0', 'flak', 'Fore flak cannon', new V3(0, top(28) + 0.9, 28), 3.2, 120, null, ck => flakT(ck, 1));
  comp('flak1', 'flak', 'Aft flak cannon', new V3(0, top(-30) + 0.9, -30), 3.2, 120, null, ck => flakT(ck, 1));
  const mgT = (ck, sx) => { ck.add(ball(0.95, 8, 4), STEEL()); ck.add(box(1.6, 0.8, 1.2), mH, T(-sx*0.9, 0, 0)); ck.add(tube([0, 0, 0], [sx*0.5, -0.1, 1.9], 0.08, 5), DARK()); ck.add(tube([0, 0.25, 0], [sx*0.5, 0.15, 1.9], 0.08, 5), DARK()); };
  comp('mg0', 'mg', 'Port gun blister', new V3(6.6, -23.6, 12), 2.4, 120, null, ck => mgT(ck, 1));
  comp('mg1', 'mg', 'Starboard gun blister', new V3(-6.6, -23.6, -6), 2.4, 120, null, ck => mgT(ck, -1));
  comp('mg2', 'mg', 'Tail gun', new V3(0, top(-60) + 0.6, -60), 2.6, 120, null, ck => { ck.add(cyl(1.3, 1.6, 1.2, 8), mH, T(0, -0.4, 0)); ck.add(ball(0.9, 8, 4), STEEL(), T(0, 0.5, 0)); ck.add(tube([0, 0.6, 0], [0, 0.9, -2.2], 0.09, 5), DARK()); ck.add(tube([0.3, 0.6, 0], [0.3, 0.9, -2.2], 0.09, 5), DARK()); });
  comp('rk0', 'rocket', 'Rocket battery', new V3(0, -27.8, 4), 2.8, 120, null, ck => { ck.add(box(3.2, 0.6, 3.2), mH); for (let i = 0; i < 4; i++) ck.add(tube([-1.2 + i*0.8, -0.7, -1.2], [-1.2 + i*0.8, -1.1, 1.8], 0.22, 6), mTr); ck.add(box(3.4, 0.5, 0.4), mB, T(0, -0.9, 1.8)); });
  comp('bridge', 'bridge', 'Bridge', new V3(0, -23.6, 22), 5.5, 300, 'gondola', ck => {
    const wb = (z, hw) => [[-hw, -0.2, z], [-hw, -1.4, z], [hw, -1.4, z], [hw, -0.2, z]];
    ck.add(loft([wb(6.05, 1.32), wb(2.05, 4.62), wb(-3.9, 6.08)]), RED());
    ck.add(box(0.3, 1.4, 0.3), mTr, T(0, -0.8, 6.1));
  });
  comp('mast', 'radio', 'Radio mast', new V3(0, top(6) + 5, 6), 3.6, 80, null, ck => {
    ck.add(tube([0, -5, 0], [0, 6, 0], 0.22, 6), STEEL()); ck.add(bar([-2.6, 3.2, 0], [2.6, 3.2, 0], 0.18), STEEL()); ck.add(bar([-1.6, 5.2, 0], [1.6, 5.2, 0], 0.15), STEEL());
    ck.add(ball(0.45, 6, 3), lamp(0xff3b30), T(0, 6.3, 0)); for (const sx of [1, -1]) { ck.add(wire([sx*2.6, 3.2, 0], [0, -5, sx*14], 0.05), DARK()); ck.add(wire([sx*2.6, 3.2, 0], [0, -5, -sx*14], 0.05), DARK()); }
  });
  comp('hangar', 'hangar', 'Hangar doors', new V3(0, -27.3, -14), 6, 250, null, ck => {
    ck.add(box(9, 0.5, 11), mTr); ck.add(box(0.4, 0.55, 11), DARK()); for (const sx of [1, -1]) ck.add(ball(0.35, 6, 3), lamp(0xffd27a), T(sx*4.6, -0.4, 5.6));
  });
  const vf = t => [5 + 15*t, 22 - 11*t, 1.4*(1 - 0.4*t), -68 - 7*t, 0];
  comp('finT', 'fin', 'Top rudder', new V3(0, 15, -73), 6.5, 150, null, ck => { const A = mul(T(0, -15, 73), RZ(PI/2)); ck.add(pan(vf, 0, 0.6), mH, A); ck.add(pan(vf, 0.6, 1), mB, A); ck.add(tipOf(vf, 1.0, 0.6), mB, A); ck.decal(mul(T(0.9, 1.5, -2), RY(PI/2), SC(3.2, 3.2, 1)), skull(mTr)); ck.decal(mul(T(-0.9, 1.5, -2), RY(-PI/2), SC(3.2, 3.2, 1)), skull(mTr)); });
  comp('finB', 'fin', 'Bottom rudder', new V3(0, -15, -73), 6.5, 150, null, ck => { const A = mul(T(0, 15, 73), RZ(-PI/2)); ck.add(pan(vf, 0, 0.6), mH, A); ck.add(pan(vf, 0.6, 1), mB, A); ck.add(tipOf(vf, 1.0, 0.6), mB, A); });
  for (let i = 0; i < 8; i++) comps.push({id:'cell' + i, kind:'cell', label:`Gas cell ${i + 1}`, pos:new V3(0, 0, -63 + i*18), r:0, hp:200, hpMax:200, cover:null, alive:true, virtual:true});
  // white flag, raised on surrender
  const flag = new THREE.Group(), fk = new Kit(); flag.position.set(0, top(36), 36);
  fk.add(tube([0, 0, 0], [0, 9, 0], 0.15, 5), STEEL()); fk.add(poly([[0, 8.8], [5, 8.2], [4.6, 5.6], [0, 6.2]]), BONE()); fk.add(xf(poly([[0, 8.8], [5, 8.2], [4.6, 5.6], [0, 6.2]]), RY(PI)), BONE());
  fk.build(flag); flag.visible = false; g.add(flag);
  g.userData = {comps, props, flag, radius:95, ell:[21, 21, 89], gon:{hw:6.5, y0:-18, y1:-29, zc:-1, hz:30},
    sections:{bow:300, stern:300, port:300, stb:300, gondola:300}};
  // a flagship is the same ship, bigger and tougher: scale the model and every hit volume, multiply the hit points
  const sc = o.scale || 1, hm = o.hpMul || 1;
  if (sc !== 1 || hm !== 1) {
    g.scale.setScalar(sc); const u = g.userData;
    for (const c of comps) { c.pos.multiplyScalar(sc); c.r *= sc; c.hp = c.hpMax = c.hpMax*hm; }
    u.radius *= sc; u.ell = u.ell.map(v => v*sc); u.gon = {hw:u.gon.hw*sc, y0:u.gon.y0*sc, y1:u.gon.y1*sc, zc:u.gon.zc*sc, hz:u.gon.hz*sc};
    for (const k in u.sections) u.sections[k] *= hm;
  }
  return g;
};

/* ---------- Chapter 1 set pieces ---------- */
/* Starlight: a film studio's courier blimp (~64 m), cream and gold, her name on both flanks. */
G.buildBlimp = (o = {}) => {
  const g = new THREE.Group(), k = new Kit(), hull = G.mat(o.hull || 0xeee3c8, {roughness:0.6}), gold = BRASS(), plum = G.mat(o.band || 0x5a2a4a);
  const H = [[0.4,-32],[3.5,-29],[7,-22],[9.2,-10],[9.6,0],[9.2,10],[7.4,20],[4.2,27.5],[0.4,32]], N = 12;
  const seg = (z0, z1, m, caps = false) => k.add(lathe(cut(H, z0, z1), N, 1, 1, caps), m);
  seg(-32, -24, plum, true); seg(-24, -23, gold); seg(-23, 18, hull); seg(18, 19, gold); seg(19, 32, plum, true);
  const gon = (z, hw, yT, yB) => [[-hw, yT, z], [-hw, yB, z], [hw, yB, z], [hw, yT, z]];
  k.add(loft([gon(8, 0.8, -9.2, -11.4), gon(5, 2.2, -9.2, -12.4), gon(-7, 2.2, -9.2, -12.4), gon(-9, 1, -9.2, -11.2)]), plum);
  for (let z = -6; z < 5; z += 1.6) k.both(box(0.12, 0.9, 1.0), WINDOW(), T(2.22, -10.9, z));
  for (let i = 0; i < 4; i++) { const A = RZ(i*PI/2 + PI/4), af = t => [3 + 7*t, 8 - 4*t, 0.5, -26 - 3*t, 0]; k.add(pan(af, 0, 0.7), hull, A); k.add(pan(af, 0.7, 1), plum, A); }
  const props = [];
  for (const sx of [1, -1]) { k.add(lathe([[0.2,-1.6],[0.8,-1],[0.9,0.8],[0.4,1.6]], 8), gold, T(sx*4.2, -10.5, -4)); k.add(bar([sx*2.2, -10.4, -4], [sx*3.5, -10.5, -4], 0.25), STEEL());
    const p = propeller(2, 2.6, 0.3, DARK(), gold, gold, null); p.position.set(sx*4.2, -10.5, -5.7); g.add(p); props.push(p); }
  k.build(g);
  const nt = nameTex(o.name || 'STARLIGHT PICTURES', css(0x5a2a4a), css(0xdba63e));
  if (nt) for (const sx of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.25), new THREE.MeshStandardMaterial({map:nt, transparent:true, depthWrite:false})); m.position.set(sx*9.5, 1.2, -2); m.rotation.y = sx*PI/2; g.add(m); }
  g.userData = {props, radius:34, ell:[10.5, 10.5, 33], gon:{hw:2.6, y0:-9, y1:-13, zc:-1, hz:9}};
  return g;
};

/* Port Halcyon skyline: stepped Art Deco towers with lit windows, a brass spire on the tall ones. */
/* ---------- Calavera pirate towns: ramshackle stilt-houses of salvaged timber, upturned-hull roofs, crow's nests and black flags.
   A whole town goes into one Kit (a handful of meshes). Every house is a little crooked, and no two are stacked alike. ---------- */
G.pirateKit = () => new Kit();
G.buildKit = (k, g = new THREE.Group()) => { k.build(g); return g; };
G.pirateHouse = (k, x, y, z, ww, hh, rr, yaw = 0, night = false) => {
  const pick = a => a[Math.floor(rr()*a.length)], P = (lx, ly, lz) => mul(T(x, y, z), RY(yaw), T(lx, ly, lz));
  const woods = [0x5a4632, 0x6b5440, 0x4a3a2e, 0x7a6248, 0x8a3a2a, 0x3a5a5a, 0x2e2a28, 0x6a4a3a, 0x58503a];
  const dark = G.mat(0x2a221c, {roughness:0.95}), deck = G.mat(0x4a3a2c, {roughness:0.95}), tar = G.mat(0x231e1b, {roughness:0.9}), rope = G.mat(0x8a7a5a, {roughness:1});
  const win = G.mat(0x1e1812, {roughness:0.6, emissive:0xffa040, emissiveIntensity:night ? 0.9 : 0.12}), black = G.mat(0x111111, {roughness:0.9}), bone = G.mat(0xe8e0cc, {roughness:0.8});
  // stilts and a plank deck: these towns stand over mud, surf and lava-crust
  const dk = ww + 2 + rr()*3;
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 1], [0, -1]]) k.add(cyl(0.32, 0.4, 8, 5), dark, P(sx*dk/2*0.92, -2.5, sz*dk/2*0.92));
  k.add(box(dk, 0.5, dk*(0.9 + rr()*0.25)), deck, P(0, 1.4, 0));
  // storeys: each one a touch smaller, shoved off-centre and twisted, in whatever paint was going
  const storeys = hh > 24 ? 3 : hh > 12 ? 2 : 1; let by = 1.6, w = ww*0.86, d = ww*(0.7 + rr()*0.25), ox = 0, oz = 0, tw = 0;
  for (let s = 0; s < storeys; s++) {
    const sh = Math.max(4.2, hh/storeys*(0.85 + rr()*0.3)), col = G.mat(pick(woods), {roughness:0.92}), M = (lx, ly, lz) => mul(P(ox, 0, oz), RY(tw), RZ((rr() - 0.5)*0.0), T(lx, ly, lz));
    const lean = (rr() - 0.5)*0.07, L = (lx, ly, lz) => mul(P(ox, by, oz), RY(tw), RZ(lean), T(lx, ly, lz));
    k.add(box(w, sh, d), col, L(0, sh/2, 0));
    // corner posts, a sill and a lintel band in dark timber
    for (const [cx, cz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) k.add(box(0.6, sh + 0.4, 0.6), dark, L(cx*w/2, sh/2, cz*d/2));
    k.add(box(w + 0.5, 0.35, d + 0.5), dark, L(0, sh - 0.2, 0));
    // shuttered windows, unevenly spaced; some boarded up
    for (const f of [1, -1]) for (let i = 0; i < Math.max(1, Math.floor(w/5)); i++) {
      const wx = -w/2 + (i + 0.3 + rr()*0.4)*w/Math.max(1, Math.floor(w/5)), wy = sh*(0.45 + rr()*0.2);
      if (rr() < 0.2) { k.add(box(1.8, 0.35, 0.2), dark, mul(L(wx, wy, f*d/2), RZ((rr() - 0.5)*0.8))); continue; }
      k.add(box(1.5, 1.8, 0.2), win, L(wx, wy, f*(d/2 + 0.05))); k.add(box(0.6, 2, 0.15), col, L(wx - 1.15, wy, f*(d/2 + 0.12)));
    }
    if (s === 0) k.add(box(2.2, 3.4, 0.25), dark, L((rr() - 0.5)*w*0.5, 1.7, d/2 + 0.08));   // the door
    by += sh; ox += (rr() - 0.5)*2.2; oz += (rr() - 0.5)*2.2; tw += (rr() - 0.5)*0.35;
    if (s < storeys - 1) { w *= 0.78 + rr()*0.15; d *= 0.78 + rr()*0.15; k.add(box(w + 2.2, 0.4, d + 2.2), deck, P(ox, by, oz)); by += 0.4; }
  }
  const R = (lx, ly, lz) => mul(P(ox, by, oz), RY(tw), T(lx, ly, lz)), roof = rr();
  if (roof < 0.45) {
    // an old boat turned keel-up for a roof
    const L = Math.max(w, d)*1.25, Rr = Math.min(w, d)*0.62, hull = lathe([[0.4, -L/2], [Rr*0.7, -L*0.36], [Rr, -L*0.1], [Rr, L*0.15], [Rr*0.75, L*0.38], [0.5, L/2]], 10, 1, 0.55);
    const rot = w > d ? RY(PI/2) : RY(0);
    k.add(hull, G.mat(pick([0x3a2e26, 0x4a3a2a, 0x2a3a3a, 0x5a2a22]), {roughness:0.9}), mul(R(0, 0, 0), rot, RX(0)));
    k.add(box(0.5, 0.7, L*0.95), tar, mul(R(0, Rr*0.55, 0), rot));
  } else if (roof < 0.75) {
    // a steep tarred hip roof, patched
    const r = Math.max(w, d)*0.78, h = 3 + rr()*4;
    k.add(cyl(0, r, h, 4), G.mat(pick([0x231e1b, 0x3a3028, 0x5a4a32, 0x7a6a44]), {roughness:0.95}), mul(R(0, h/2, 0), RY(PI/4)));
  } else {
    // a lean-to of planks with junk on top
    k.add(box(w + 1.6, 0.4, d + 1.6), deck, mul(R(0, 0.6, 0), RZ(0.18 + rr()*0.1)));
    for (let i = 0; i < 2; i++) k.add(cyl(0.6, 0.6, 1.3, 7), G.mat(0x6a4a2a, {roughness:0.9}), R((rr() - 0.5)*w*0.6, 1.6, (rr() - 0.5)*d*0.6));
  }
  // what's lying about on the deck
  for (let i = 0; i < 1 + Math.floor(rr()*3); i++) k.add(cyl(0.55, 0.55, 1.2, 7), G.mat(0x6a4a2a, {roughness:0.9}), P((rr() - 0.5)*dk*0.9, 2.25, dk/2 - 0.8));
  if (rr() < 0.18) { k.add(cyl(0.32, 0.42, 3.4, 7), black, mul(P(dk*0.3, 2.3, dk/2 - 0.3), RX(PI/2 - 0.1))); k.add(box(1.4, 0.6, 1.8), dark, P(dk*0.3, 1.9, dk/2 - 1.2)); }
  // a crow's nest or a black flag on a pole
  const top = by + 4;
  if (rr() < 0.3) {
    const px = w*0.35, pz = -d*0.3; k.add(cyl(0.22, 0.3, top + 8, 5), dark, P(ox + px, (top + 8)/2, oz + pz));
    k.add(cyl(1.2, 1, 1.6, 8), G.mat(0x5a4632, {roughness:0.9}), P(ox + px, top + 7, oz + pz));
    for (let i = 0; i < 3; i++) k.add(cyl(0.05, 0.05, top + 6, 3), rope, mul(P(ox + px + (i - 1)*1.6, (top + 6)/2, oz + pz + 1), RX(0.12)));
  }
  if (rr() < 0.45) {
    const px = -w*0.3, pz = d*0.25, fy = top + 3 + rr()*4; k.add(cyl(0.12, 0.16, fy, 4), dark, P(ox + px, fy/2, oz + pz));
    const flap = rr() < 0.5 ? black : G.mat(0x7a1a1a, {roughness:0.9});
    k.add(box(0.12, 2.4, 3.6), flap, mul(P(ox + px, fy - 1.3, oz + pz + 1.9), RX((rr() - 0.5)*0.3)));
    if (flap === black) k.add(box(0.16, 0.8, 0.8), bone, P(ox + px, fy - 1.2, oz + pz + 1.9));
  }
  if (night || rr() < 0.4) k.add(ball(0.4, 6, 3), lamp(0xffa040), P(dk/2 - 0.5, 4, dk/2 - 0.5));
  return by + 4;
};
/* ---------- The Copperton Line's armoured train. One group per car, nose +Z, rail top at y = 0, gauge 1.44 m.
   Kinds: loco, tender, gun (flak car), pay (the strongroom car), box. story3.js strings the cars along the rail at
   13.5 / 9.5 / 15 m pitches from the car origins, so each car is built about its own middle and then slid along Z
   (ZS) until its couplers meet its neighbours'. Paint: main = armour plate, second = brass, trim = boiler and beams. ---------- */
const STUD = (() => { const o = [], s = 0.04, c = [[0, -s, -s], [0, s, -s], [0, s, s], [0, -s, s]]; for (let i = 0; i < 4; i++) tri(o, [0.035, 0, 0], c[i], c[(i + 1) % 4]); return o; })();   // rivet head on a +X face
G.buildTrainCar = (kind, paint = [0x6b2a1a, 0xd9b44a, 0x1a1a1a]) => {
  const g = new THREE.Group(), k = new Kit(), shade = (hex, f) => (Math.round((hex >> 16 & 255)*f) << 16) | (Math.round((hex >> 8 & 255)*f) << 8) | Math.round((hex & 255)*f);
  const mP = G.mat(paint[0], {roughness:0.7}), mD = G.mat(shade(paint[0], 0.68), {roughness:0.75}), mS = G.mat(paint[1], {roughness:0.45, metalness:0.3}), mT = G.mat(paint[2], {roughness:0.8}),
        iron = G.mat(0x34312e, {roughness:0.6, metalness:0.35}), rod = G.mat(0x9a9fa6, {roughness:0.35, metalness:0.4}), coal = G.mat(0x100f0e, {roughness:0.95}), amber = lamp(0xffc45a);
  const GA = 0.72, W = 1.52, H = (kind === 'loco' ? 13.5 : kind === 'tender' ? 9.5 : 15)/2, ZS = kind === 'loco' ? 0 : kind === 'tender' ? 2 : -0.75;
  /* rivets: a row of n studs from a to b on the +X side, mirrored to the other */
  const rivets = (a, b, n, m = iron) => { const o = []; for (let i = 0; i < n; i++) { const t = n > 1 ? i/(n - 1) : 0.5; for (const v of offset(STUD, a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t, a[2] + (b[2] - a[2])*t)) o.push(v); } k.both(o, m); };
  /* a wheel pair on its axle: flanged tyres, painted centres, hub caps; drivers get spokes */
  const wheelset = (z, r, drv) => {
    for (const sx of [1, -1]) {
      const M = mul(T(sx*GA, r, z), RY(sx*PI/2)), n = drv ? 12 : 10;
      k.add(lathe([[r + 0.07, -0.09], [r + 0.07, -0.04], [r, -0.03], [r, 0.09]], n), iron, M);
      k.add(disc(r*0.84, n), drv ? mP : mD, mul(M, T(0, 0, 0.094)));
      k.add(lathe([[r*0.26, 0.09], [r*0.2, 0.2]], 6), drv ? mS : iron, M);
      if (drv) for (let i = 0; i < 5; i++) { const a = i*2*PI/5 + z; k.add(bar([Math.cos(a)*r*0.24, Math.sin(a)*r*0.24, 0.11], [Math.cos(a)*r*0.84, Math.sin(a)*r*0.84, 0.11], 0.07, 0.03), iron, M); }
    }
    k.add(tube([-GA, r, z], [GA, r, z], 0.08, 5, false), iron);
  };
  const bogie = zc => {
    for (const dz of [-0.85, 0.85]) { wheelset(zc + dz, 0.42); k.both(box(0.2, 0.26, 0.34), mT, T(0.99, 0.42, zc + dz)); }
    k.both(box(0.1, 0.22, 2.7), iron, T(0.93, 0.62, zc)); k.both(box(0.14, 0.1, 1.0), rod, T(0.99, 0.8, zc)); k.add(box(1.7, 0.2, 0.5), iron, T(0, 0.8, zc));
  };
  /* buffer beam, buffers and coupler at z, facing d (+1 forward, -1 aft); the coupler reaches 0.55 beyond the beam */
  const beam = (z, d) => { k.add(box(2.7, 0.42, 0.18), mT, T(0, 1.02, z)); k.add(box(0.26, 0.24, 0.52), iron, T(0, 0.92, z + d*0.29)); k.both(cyl(0.16, 0.1, 0.32, 8), rod, mul(T(0.95, 1.02, z + d*0.24), RX(d*PI/2))); };
  const sect = (z, w, y0, y1, ch = 0.25) => [[-w + ch, y0, z], [w - ch, y0, z], [w, y0 + ch, z], [w, y1, z], [-w, y1, z], [-w, y0 + ch, z]];
  const lid = (z, w, y1, wr, yr) => [[-w, y1, z], [w, y1, z], [wr, yr, z], [-wr, yr, z]];
  const deck = (y, w, z0, z1) => [[-w, y, z0], [w, y, z0], [w, y, z1], [-w, y, z1]];
  /* armoured car shell from z0 to z1: chamfered hull, sloped roof plates, underframe, two bogies and both beams */
  const shell = (z0, z1, y1 = 3.6, yr = 4.2, zb = 4.6) => {
    k.add(loft([sect(z0, W, 1.15, y1), sect(z1, W, 1.15, y1)]), mP); k.add(loft([lid(z0 - 0.07, W + 0.05, y1, 1.0, yr), lid(z1 + 0.07, W + 0.05, y1, 1.0, yr)]), mD);
    k.add(box(2.3, 0.3, z1 - z0 + 0.1), iron, T(0, 1.02, (z0 + z1)/2)); bogie(-zb); bogie(zb); beam(z0 - 0.1, -1); beam(z1 + 0.1, 1);
    rivets([W, y1 - 0.1, z0 + 0.3], [W, y1 - 0.1, z1 - 0.3], 16); rivets([W, 1.52, z0 + 0.3], [W, 1.52, z1 - 0.3], 16);
    for (const z of [z0 - 0.02, z1 + 0.02]) for (const x of [W + 0.02, -W - 0.02]) k.add(box(0.14, 0.22, 0.14), amber, T(x, y1 - 0.3, z));   // corner lanterns
  };
  const straps = (zs, y0, y1) => { for (const z of zs) { k.both(box(0.07, y1 - y0, 0.24), iron, T(W + 0.02, (y0 + y1)/2, z)); rivets([W + 0.055, y0 + 0.2, z], [W + 0.055, y1 - 0.2, z], 4, mS); } };
  const slit = (z, y, w = 0.7) => { k.both(box(0.07, 0.24, w + 0.2), iron, T(W + 0.01, y, z)); k.both(box(0.04, 0.09, w), mT, T(W + 0.035, y, z)); };
  const skirt = (zc, len) => { k.both(box(0.07, 0.5, len), mD, T(W - 0.01, 0.97, zc)); k.both(box(0.05, 0.07, len), mS, T(W + 0.02, 0.75, zc)); rivets([W + 0.025, 1.08, zc - len/2 + 0.2], [W + 0.025, 1.08, zc + len/2 - 0.2], 6); };
  const band = (y, z0, z1, h = 0.12) => k.both(box(0.04, h, z1 - z0), mS, T(W + 0.005, y, (z0 + z1)/2));
  const herald = (z, y, s = 1) => k.decal(onSide(W + 0.012, y, z), [[poly([[0, -0.5*s], [0.36*s, 0], [0, 0.5*s], [-0.36*s, 0]]), mS], [poly([[0, -0.34*s], [0.24*s, 0], [0, 0.34*s], [-0.24*s, 0]]), mT], [disc(0.1*s, 8), mS]], true);
  const z0 = -H + 0.65, z1 = H - 0.65;

  if (kind === 'loco') {
    const BY = 2.8, BR = 1.12, top = BY + BR*Math.cos(PI/12);
    // frame, pilot truck, three coupled drivers, trailing axle
    k.add(box(1.3, 0.4, 11.5), iron, T(0, 1.42, -0.45));
    wheelset(4.75, 0.42); wheelset(3.55, 0.42); k.both(box(0.1, 0.2, 1.9), iron, T(0.93, 0.5, 4.15));
    for (const z of [1.9, -0.1, -2.1]) wheelset(z, 0.92, true);
    wheelset(-4.55, 0.5); k.both(box(0.12, 0.5, 1.5), iron, T(0.94, 0.78, -4.55)); k.both(box(0.2, 0.26, 0.34), mT, T(1.0, 0.5, -4.55));
    // cylinders, steam chests, crossheads and the rods (the two sides quartered)
    k.both(lathe([[0.34, 3.5], [0.39, 3.56], [0.39, 4.76], [0.34, 4.82]], 8), mT, T(1.2, 1.0, 0)); k.both(disc(0.26, 8), mS, T(1.2, 1.0, 4.825));
    k.both(box(0.52, 0.42, 1.1), mP, T(1.2, 1.52, 4.16)); k.add(box(1.7, 1.0, 1.3), iron, T(0, 1.78, 4.3));
    for (const sx of [1, -1]) {
      const a = sx > 0 ? -2.2 : -0.6, dz = 0.42*Math.cos(a), dy = 0.42*Math.sin(a), y = 0.92 + dy;
      k.add(bar([sx*0.98, y, 1.9 + dz], [sx*0.98, y, -2.1 + dz], 0.06, 0.15), rod);
      for (const z of [1.9, -0.1, -2.1]) k.add(tube([sx*0.9, y, z + dz], [sx*1.13, y, z + dz], 0.085, 6), mS);
      k.add(bar([sx*1.08, 1.0, 3.0], [sx*1.08, y, -0.1 + dz], 0.05, 0.13), rod);
      k.add(box(0.14, 0.32, 0.3), rod, T(sx*1.1, 1.0, 3.0)); k.add(tube([sx*1.2, 1.0, 3.5], [sx*1.12, 1.0, 3.0], 0.04, 5), rod);
      for (const yy of [1.2, 0.8]) k.add(box(0.07, 0.05, 1.1), iron, T(sx*1.13, yy, 2.98));
    }
    // boiler with brass bands, smokebox and its door
    k.add(lathe([[BR, -3.2], [BR, 3.6]], 12, 1, 1, false), mT, T(0, BY, 0)); k.add(lathe([[BR + 0.05, 3.6], [BR + 0.05, 5.25]], 12), iron, T(0, BY, 0));
    for (const z of [-2.4, -0.8, 0.8, 2.4, 3.6]) k.add(lathe([[BR + 0.035, z - 0.09], [BR + 0.035, z + 0.09]], 12, 1, 1, false), mS, T(0, BY, 0));
    k.decal(T(0, BY, 5.262), [[ring(0.84, 0.98, 12), mS], [disc(0.84, 12), mT], [disc(0.18, 8), mS]], false, 0.012);
    for (const dy of [0.36, -0.36]) k.add(box(1.5, 0.08, 0.04), iron, T(-0.2, BY + dy, 5.3));
    // armour: sloped jackets over the boiler flanks, running boards, skirts over the drivers
    k.both(loft([[[1.48, 2.02, -3.1], [1.56, 2.02, -3.1], [1.3, 3.42, -3.1], [1.22, 3.42, -3.1]], [[1.48, 2.02, 3.3], [1.56, 2.02, 3.3], [1.3, 3.42, 3.3], [1.22, 3.42, 3.3]]]), mP);
    k.both(loft([[[1.22, 3.42, 3.3], [1.3, 3.42, 3.3], [1.56, 2.02, 3.3], [1.48, 2.02, 3.3]], [[0.95, 3.3, 4.0], [1.0, 3.3, 4.0], [1.2, 2.02, 4.0], [1.14, 2.02, 4.0]]]), mD);   // raked front plate
    rivets([1.535, 2.2, -2.9], [1.535, 2.2, 3.1], 13); rivets([1.33, 3.28, -2.9], [1.33, 3.28, 3.1], 13);
    for (const z of [-1.0, 1.15]) k.both(bar([1.57, 2.04, z], [1.315, 3.4, z], 0.1, 0.03), iron);
    k.both(box(0.04, 0.13, 6.3), mS, mul(T(1.45, 2.72, 0.1), RZ(0.184)));
    for (const z of [-2.0, 0.1, 2.2]) k.both(box(0.04, 0.09, 0.6), mT, mul(T(1.4, 3.0, z), RZ(0.184)));
    k.both(box(0.4, 0.07, 9.0), iron, T(1.38, 1.98, 1.1));
    k.both(box(0.07, 0.72, 6.6), mP, T(1.53, 1.6, -0.1)); k.both(box(0.05, 0.07, 6.6), mS, T(1.56, 1.28, -0.1)); rivets([1.565, 1.82, -3.2], [1.565, 1.82, 3.0], 12);
    // funnel, domes, bell, whistle, safety valves
    k.add(cyl(0.36, 0.42, 1.1, 10), iron, T(0, 4.4, 4.5)); k.add(cyl(0.8, 0.38, 0.85, 10, false), iron, T(0, 5.35, 4.5)); k.add(cyl(0.66, 0.8, 0.22, 10), iron, T(0, 5.88, 4.5));
    k.add(cyl(0.83, 0.83, 0.09, 10, false), mS, T(0, 5.78, 4.5)); k.add(cyl(0.45, 0.45, 0.1, 10, false), mS, T(0, 4.02, 4.5)); k.add(disc(0.6, 10), mT, mul(T(0, 6.0, 4.5), RX(-PI/2)));
    k.add(cyl(0.4, 0.48, 0.55, 8), mP, T(0, top + 0.2, 2.6)); k.add(ball(0.42, 8, 4), mP, T(0, top + 0.44, 2.6));
    k.add(cyl(0.5, 0.56, 0.6, 10), mS, T(0, top + 0.25, 0.4)); k.add(ball(0.5, 10, 4), mS, T(0, top + 0.52, 0.4));
    for (const sx of [1, -1]) k.add(bar([sx*0.26, top - 0.05, 1.6], [sx*0.26, top + 0.72, 1.6], 0.06), iron);
    k.add(box(0.58, 0.06, 0.06), iron, T(0, top + 0.72, 1.6)); k.add(cyl(0.09, 0.25, 0.34, 8), mS, T(0, top + 0.47, 1.6));
    k.add(cyl(0.05, 0.06, 0.6, 6), mS, T(0, top + 0.3, -1.3)); k.add(cyl(0.09, 0.09, 0.18, 6), mS, T(0, top + 0.6, -1.3));
    for (const sx of [1, -1]) k.add(cyl(0.07, 0.1, 0.4, 6), mS, T(sx*0.22, top + 0.18, -2.2));
    // headlamp in a hooded box on the smokebox
    k.add(box(0.56, 0.6, 0.5), mT, T(0, 4.32, 5.02)); k.add(box(0.66, 0.06, 0.66), mS, T(0, 4.64, 5.06)); k.add(box(0.3, 0.2, 0.3), iron, T(0, 3.98, 5.02));
    k.decal(T(0, 4.32, 5.275), [[disc(0.26, 10), mS], [disc(0.2, 10), amber]], false, 0.012);
    // armoured cab: slit windows under raised shutters, sloped roof, ember glow from the ashpan
    k.add(loft([sect(-6.2, W, 1.5, 4.25), sect(-3.1, W, 1.5, 4.25)]), mP); k.add(loft([lid(-6.6, W + 0.1, 4.25, 1.0, 4.8), lid(-2.85, W + 0.1, 4.25, 1.0, 4.8)]), mD);
    k.both(box(0.05, 0.32, 1.4), WINDOW(), T(W + 0.012, 3.7, -4.65)); k.both(box(0.05, 0.26, 1.5), mD, mul(T(W + 0.045, 3.98, -4.65), RZ(0.42)));
    k.both(box(0.06, 0.07, 1.6), mS, T(W + 0.02, 3.5, -4.65));
    for (const sx of [1, -1]) k.add(box(0.44, 0.3, 0.05), WINDOW(), T(sx*1.16, 3.9, -3.085));
    k.add(box(1.0, 2.1, 0.05), mT, T(0, 2.9, -6.215));
    rivets([W, 4.12, -6.05], [W, 4.12, -3.25], 8); rivets([W, 1.9, -6.05], [W, 1.9, -3.25], 8); rivets([W, 2.2, -6.05], [W, 3.9, -6.05], 5); rivets([W, 2.2, -3.25], [W, 3.9, -3.25], 5);
    herald(-4.65, 2.75, 0.9); band(3.2, -6.1, -3.2, 0.08);
    k.add(box(1.1, 0.2, 0.9), lamp(0xff8a30), T(0, 1.12, -3.6)); k.both(box(0.3, 0.06, 0.6), iron, T(1.38, 1.0, -5.8)); k.both(box(0.3, 0.06, 0.6), iron, T(1.38, 0.55, -5.8)); k.both(box(0.05, 1.05, 0.06), iron, T(1.5, 1.0, -5.52));
    k.add(box(0.26, 0.24, 0.6), iron, T(0, 0.92, -6.45)); k.add(box(2.7, 0.42, 0.18), mT, T(0, 1.2, -6.15));
    // buffer beam, marker lamps and the plough
    k.add(box(2.9, 0.5, 0.22), mP, T(0, 1.0, 5.6)); k.add(box(2.9, 0.07, 0.05), mS, T(0, 1.22, 5.7));
    for (const sx of [1, -1]) k.add(box(0.18, 0.22, 0.12), amber, T(sx*1.2, 1.0, 5.74));
    k.add(loft([[[-1.45, 0.14, 5.7], [1.45, 0.14, 5.7], [1.45, 1.15, 5.7], [-1.45, 1.15, 5.7]], [[-0.07, 0.14, 6.72], [0.07, 0.14, 6.72], [0.07, 0.5, 6.72], [-0.07, 0.5, 6.72]]]), iron);
    for (const sx of [1, -1]) {
      for (const t of [0.07, 0.29, 0.51, 0.73, 0.95]) { const x = sx*(0.1 + 1.38*(1 - t)), z = 5.74 + 0.96*t; k.add(bar([x, 0.14, z], [x, 1.16 - 0.65*t, z], 0.07), mS); }
      k.add(bar([sx*1.47, 1.17, 5.72], [sx*0.08, 0.52, 6.7], 0.07), mS);
    }
  } else if (kind === 'tender') {
    // riveted tub with a flared brass-rimmed coaming, coal heaped forward, water filler and ladder aft
    k.add(loft([sect(z0, W - 0.04, 1.15, 3.3), sect(z1, W - 0.04, 1.15, 3.3)]), mP);
    k.add(loft([deck(3.3, W - 0.04, z0, z1), deck(3.75, W + 0.08, z0 - 0.06, z1 + 0.06)]), mP);
    k.add(box(2.3, 0.3, z1 - z0 + 0.1), iron, T(0, 1.02, 0)); bogie(-2.45); bogie(2.45); beam(z0 - 0.1, -1); beam(z1 + 0.1, 1);
    k.both(box(0.07, 0.08, z1 - z0 + 0.2), mS, T(W + 0.08, 3.77, 0)); for (const z of [z0 - 0.06, z1 + 0.06]) k.add(box(3.2, 0.08, 0.07), mS, T(0, 3.77, z));
    k.add(loft([deck(3.74, 1.42, -1.3, z1 - 0.1), deck(4.12, 0.95, -0.5, z1 - 0.7), deck(4.4, 0.3, 0.7, z1 - 1.7)]), coal);
    for (const [x, y, z, s, a] of [[0.7, 4.05, 2.9, 0.42, 0.6], [-0.8, 4.0, 1.2, 0.5, 1.1], [0.3, 4.38, 1.6, 0.4, 0.3], [-0.5, 4.2, 3.0, 0.36, 2.0], [0.9, 3.9, 0.1, 0.44, 1.5], [-0.2, 3.95, -0.8, 0.4, 0.9]]) k.add(box(s, s*0.8, s), coal, mul(T(x, y, z), RY(a), RX(a*0.7)));
    k.add(box(2.6, 0.5, 0.1), mD, T(0, 4.0, -1.35));                                                           // coal board
    k.add(cyl(0.38, 0.44, 0.24, 10), mS, T(0, 3.87, -2.9)); k.add(box(0.9, 0.3, 0.6), mD, T(-0.7, 3.9, -3.6)); k.add(box(0.94, 0.05, 0.1), mS, T(-0.7, 4.0, -3.6));
    const tsk = W - 0.04; rivets([tsk, 3.15, z0 + 0.25], [tsk, 3.15, z1 - 0.25], 12); rivets([tsk, 1.55, z0 + 0.25], [tsk, 1.55, z1 - 0.25], 12);
    for (const z of [z0 + 0.14, -1.35, 1.35, z1 - 0.14]) { k.both(box(0.07, 1.85, 0.22), iron, T(tsk + 0.02, 2.37, z)); rivets([tsk + 0.055, 1.7, z], [tsk + 0.055, 3.05, z], 4, mS); }
    k.both(box(0.04, 0.1, z1 - z0), mS, T(tsk + 0.005, 2.95, 0)); k.decal(onSide(tsk + 0.012, 2.25, 0), [[poly([[0, -0.55], [0.4, 0], [0, 0.55], [-0.4, 0]]), mS], [poly([[0, -0.38], [0.27, 0], [0, 0.38], [-0.27, 0]]), mT], [disc(0.11, 8), mS]], true);
    for (const sx of [0.25, -0.25]) k.add(bar([sx + 0.7, 1.3, z0 - 0.06], [sx + 0.7, 3.8, z0 - 0.06], 0.05), iron);
    for (let i = 0; i < 5; i++) k.add(box(0.5, 0.05, 0.05), iron, T(0.7, 1.6 + i*0.5, z0 - 0.06));
    k.add(box(0.2, 0.2, 0.1), lamp(0xff3b30), T(-0.9, 1.5, z0 - 0.05));
  } else {
    const gunCar = kind === 'gun', y1 = gunCar ? 3.3 : 3.6, yr = gunCar ? 3.8 : 4.2;
    shell(z0, z1, y1, yr);
    if (kind === 'box') {
      // armoured boxcar: strapped plate, a sliding door on a rail, firing slits, roof walk and hatches
      skirt(-4.6, 3.6); skirt(4.6, 3.6); straps([z0 + 0.14, -4.5, -2.3, 2.3, 4.5, z1 - 0.14], 1.35, 3.6); band(3.3, z0, z1);
      k.both(box(0.1, 2.2, 2.7), mD, T(W + 0.03, 2.45, 0)); k.both(box(0.07, 0.1, 5.6), iron, T(W + 0.05, 3.62, 1.35)); k.both(box(0.07, 0.08, 5.6), iron, T(W + 0.05, 1.3, 1.35));
      for (const s of [1, -1]) k.both(bar([W + 0.085, 1.45, -1.25*s], [W + 0.085, 3.45, 1.25*s], 0.05, 0.05), iron);
      for (const z of [-1.15, 1.15]) k.both(box(0.1, 0.16, 0.2), rod, T(W + 0.07, 3.62, z)); k.both(box(0.07, 0.5, 0.08), mS, T(W + 0.09, 2.4, -1.12));
      for (const z of [-5.6, -3.4, 3.4, 5.6]) slit(z, 2.75);
      k.add(box(0.5, 0.06, z1 - z0 - 0.8), iron, T(0, yr + 0.03, 0)); for (const z of [-3.6, 3.6]) { k.add(box(0.95, 0.14, 0.95), mD, T(0, yr + 0.07, z)); k.add(box(0.12, 0.08, 0.5), mS, T(0.3, yr + 0.16, z)); }
      for (const z of [-0.9, 0.9]) k.add(cyl(0.16, 0.2, 0.3, 6), iron, T(0, yr + 0.18, z));
    } else if (kind === 'pay') {
      // the strongroom: brass-bound from sill to eaves, a round vault door each side, barred windows, a strongbox clerestory and guard cupolas
      skirt(0, z1 - z0 - 0.3); band(1.5, z0, z1, 0.16); band(3.42, z0, z1, 0.16);
      for (const z of [z0 + 0.16, z1 - 0.16, -3.05, 3.05]) k.both(box(0.09, 2.1, 0.3), mS, T(W + 0.02, 2.46, z));
      k.decal(onSide(W + 0.02, 2.46, 0), [[disc(1.12, 16), mS], [disc(0.98, 16), iron], [ring(0.62, 0.7, 16), mS]], true, 0.016);
      { const o = []; for (let i = 0; i < 10; i++) { const a = i*PI/5; for (const v of offset(STUD, W + 0.05, 2.46 + Math.sin(a)*0.84, Math.cos(a)*0.84)) o.push(v); } k.both(o, mS); }
      k.both(lathe([[0.2, 0], [0.15, 0.1]], 8), mS, onSide(W + 0.03, 2.46, 0)); k.both(torus(0.44, 0.04, 10, 4), rod, onSide(W + 0.08, 2.46, 0));
      for (let i = 0; i < 3; i++) { const a = i*PI/3 + 0.3, c = Math.cos(a)*0.44, s = Math.sin(a)*0.44; k.both(bar([W + 0.09, 2.46 + s, c], [W + 0.09, 2.46 - s, -c], 0.05), rod); }
      for (const dy of [0.62, -0.62]) k.both(box(0.12, 0.3, 0.42), mS, T(W + 0.06, 2.46 + dy, 1.12));
      for (const zc of [-4.85, 4.85]) {
        k.both(box(0.05, 1.7, 2.9), mD, T(W, 2.46, zc)); rivets([W + 0.025, 1.78, zc - 1.3], [W + 0.025, 1.78, zc + 1.3], 5, mS); rivets([W + 0.025, 3.16, zc - 1.3], [W + 0.025, 3.16, zc + 1.3], 5, mS);
        k.both(box(0.05, 0.46, 1.1), WINDOW(), T(W + 0.02, 2.75, zc)); for (let i = 0; i < 5; i++) k.both(box(0.05, 0.54, 0.05), iron, T(W + 0.05, 2.75, zc - 0.44 + i*0.22));
        for (const dy of [0.3, -0.3]) k.both(box(0.07, 0.08, 1.3), mS, T(W + 0.04, 2.75 + dy, zc));
        herald(zc, 2.08, 0.42);
      }
      for (const z of [-2.1, 2.1]) herald(z, 2.46, 0.8);
      k.add(loft([lid(-4.9, 0.78, yr - 0.02, 0.56, yr + 0.42), lid(4.9, 0.78, yr - 0.02, 0.56, yr + 0.42)]), mD); k.both(box(0.06, 0.07, 9.8), mS, T(0.56, yr + 0.44, 0));
      for (const z of [-3, -1, 1, 3]) k.both(box(0.05, 0.14, 0.7), WINDOW(), mul(T(0.69, yr + 0.2, z), RZ(0.48)));
      for (const z of [-6.05, 6.05]) { k.add(loft([deck(yr - 0.05, 0.62, z - 0.55, z + 0.55), deck(yr + 0.6, 0.5, z - 0.45, z + 0.45)]), mP); k.add(box(1.16, 0.08, 1.06), mS, T(0, yr + 0.62, z));
        k.both(box(0.05, 0.1, 0.5), mT, T(0.585, yr + 0.34, z)); k.add(box(0.5, 0.1, 0.05), mT, T(0, yr + 0.34, z + Math.sign(z)*0.52)); }
    } else {
      // flak car: low strapped hull, a twin-gun turret amidships, searchlight forward, a machine-gun cupola aft, ammunition lockers
      skirt(-4.6, 3.6); skirt(4.6, 3.6); straps([z0 + 0.14, -4.6, -2.3, 0, 2.3, 4.6, z1 - 0.14], 1.35, 3.3); band(3.02, z0, z1);
      for (const z of [-5.7, -3.45, -1.15, 1.15, 3.45, 5.7]) slit(z, 2.5);
      k.add(cyl(1.3, 1.42, 0.75, 10), iron, T(0, yr + 0.3, 0)); k.add(cyl(1.35, 1.35, 0.09, 10, false), mS, T(0, yr + 0.64, 0));
      const TM = mul(T(0, yr + 0.68, 0), RY(0.3)), EL = 0.62, ce = Math.cos(EL), se = Math.sin(EL);
      k.add(loft([deck(0, 1.0, -1.1, 0.95), deck(0.45, 1.0, -1.1, 0.95), deck(0.95, 0.66, -0.8, 0.4)]), mP, TM); k.add(box(0.7, 0.07, 0.7), mS, mul(TM, T(0, 0.96, -0.2)));
      k.add(box(1.1, 0.6, 0.3), iron, mul(TM, T(0, 0.52, 0.82), RX(-EL))); k.add(tube([-1.1, 0.7, -0.45], [1.1, 0.7, -0.45], 0.09, 6), iron, TM);
      { const o = []; for (const z of [-0.8, -0.2, 0.4]) for (const v of offset(STUD, 1.0, 0.24, z)) o.push(v); k.add(o, mS, TM); k.add(o, mS, mul(TM, MIRX)); }
      for (const sx of [0.3, -0.3]) { const a = [sx, 0.5, 0.7], P = d => [sx, 0.5 + d*se, 0.7 + d*ce];
        k.add(tube(a, P(1.3), 0.15, 6), rod, TM); k.add(tube(P(1.3), P(3.3), 0.085, 6), mT, TM); k.add(tube(P(3.3), P(3.65), 0.1, 6, true, 0.15), mT, TM); }
      k.add(cyl(0.1, 0.14, 0.7, 6), iron, T(0, yr + 0.3, 5.7)); k.add(lathe([[0.3, -0.25], [0.4, 0.2]], 8), mT, mul(T(0, yr + 0.9, 5.7), RX(-0.35))); k.add(disc(0.36, 8), amber, mul(T(0, yr + 0.9, 5.7), RX(-0.35), T(0, 0, 0.205)));
      k.add(cyl(0.6, 0.66, 0.4, 8), iron, T(0, yr + 0.15, -5.5)); k.add(ball(0.55, 8, 4), mD, T(0, yr + 0.38, -5.5));
      for (const sx of [0.1, -0.1]) k.add(tube([sx, yr + 0.6, -5.7], [sx, yr + 1.15, -6.75], 0.04, 5), mT);
      for (const z of [-3.1, 3.1]) for (const sx of [1, -1]) { k.add(box(0.7, 0.36, 1.3), mD, T(sx*0.5, yr + 0.17, z)); k.add(box(0.74, 0.05, 0.1), mS, T(sx*0.5, yr + 0.36, z - 0.35)); k.add(box(0.74, 0.05, 0.1), mS, T(sx*0.5, yr + 0.36, z + 0.35)); }
    }
  }
  k.build(g); for (const m of g.children) m.position.z = ZS;
  return g;
};
/* A railway along a list of points [{x, y, z, gy}] (y = rail level, gy = ground): sleepers, two rails, and timber bents
   holding the track up wherever it runs above the ground. */
G.buildTrack = pts => {
  const g = new THREE.Group(), k = new Kit(), tie = G.mat(0x4a3424, {roughness:1}), rail = G.mat(0x6a6a6e, {roughness:0.4, metalness:0.6}), bent = G.mat(0x5a4632, {roughness:1}), bal = G.mat(0x6a5a4a, {roughness:1});
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz); if (L < 0.01) continue;
    const yaw = Math.atan2(dx, dz), lx = dz/L, lz = -dx/L;
    for (const s of [0.72, -0.72]) k.add(bar([a.x + lx*s, a.y + 0.35, a.z + lz*s], [b.x + lx*s, b.y + 0.35, b.z + lz*s], 0.14, 0.18), rail);
    k.add(bar([a.x, a.y - 0.25, a.z], [b.x, b.y - 0.25, b.z], 3.4, 0.3), bal);   // ballast bed
    for (let d = (3 - acc % 3) % 3; d < L; d += 3) { const t = d/L, y = a.y + (b.y - a.y)*t; k.add(box(2.7, 0.18, 0.45), tie, mul(T(a.x + dx*t, y + 0.12, a.z + dz*t), RY(yaw))); }
    acc += L;
    const gap = a.y - a.gy; if (gap > 2.5 && i % 4 === 0) for (const s of [1.2, -1.2]) k.add(bar([a.x + lx*s, a.gy - 1, a.z + lz*s], [a.x + lx*s*1.4, a.y - 0.4, a.z + lz*s*1.4], 0.35), bent);
  }
  k.build(g); return g;
};
/* The heart of every pirate town: a galleon run aground and turned into a tavern, masts still standing, sails in rags. */
G.pirateTavern = (k, x, y, z, yaw, rr, night = false) => {
  const P = (lx, ly, lz) => mul(T(x, y, z), RY(yaw), T(lx, ly, lz)), L = 46, R = 9;
  const hullM = G.mat(0x3a2a20, {roughness:0.9}), band = G.mat(0x8a6a2a, {roughness:0.6, metalness:0.2}), dark = G.mat(0x2a221c, {roughness:0.95}), sail = G.mat(0xb8ac8c, {roughness:1}), win = G.mat(0x1e1812, {emissive:0xffa040, emissiveIntensity:night ? 1 : 0.2});
  const hull = lathe([[1, -L/2], [R*0.75, -L*0.38], [R, -L*0.12], [R, L*0.2], [R*0.85, L*0.4], [R*0.45, L/2]], 12, 1, 0.75);
  k.add(hull, hullM, mul(P(0, R*0.3, 0), RZ(0.16)));   // listing to one side in the mud
  k.add(box(R*1.9, 0.6, L*0.92), G.mat(0x5a4632, {roughness:0.95}), mul(P(0, R*0.3 + R*0.68, 0), RZ(0.16)));
  for (const f of [1, -1]) for (let i = 0; i < 7; i++) k.add(box(0.3, 1.4, 2), win, mul(P(0, R*0.3, 0), RZ(0.16), T(f*R*0.97, R*0.25, -L*0.32 + i*L*0.1)));
  k.add(box(R*1.5, 6, 8), hullM, mul(P(0, R*0.3, -L*0.42), RZ(0.16), T(0, R*0.75 + 3, 0)));   // the sterncastle
  for (let i = 0; i < 6; i++) k.add(box(1.4, 1.8, 0.3), win, mul(P(0, R*0.3, -L*0.42), RZ(0.16), T(-R*0.6 + i*R*0.24, R*0.75 + 3.4, -4.1)));
  for (const [mz, mh] of [[-L*0.2, 34], [L*0.12, 40], [L*0.36, 26]]) {
    const mm = mul(P(0, R*0.3, mz), RZ(0.16)); k.add(cyl(0.45, 0.6, mh, 7), dark, mul(mm, T(0, R*0.7 + mh/2, 0)));
    k.add(cyl(0.22, 0.22, mh*0.5, 5), dark, mul(mm, T(0, R*0.7 + mh*0.72, 0), RZ(PI/2)));
    k.add(box(0.12, mh*0.28, mh*0.4), sail, mul(mm, T(0, R*0.7 + mh*0.56, 0), RY(PI/2), RX(0.08)));   // what's left of a sail
    k.add(box(0.12, 1.8, 3), G.mat(0x111111), mul(mm, T(0, R*0.7 + mh + 1, 1.6)));
  }
  for (const s of [-1, 1]) for (const zz of [-L*0.3, 0, L*0.3]) k.add(cyl(0.5, 0.7, 8, 5), dark, P(s*R*0.9, 2, zz));   // the props that keep her upright
  k.add(box(4, 1.6, 0.3), G.mat(0x9e1b1b), P(R + 1, 6, 0));
  k.add(ball(0.6, 6, 3), lamp(0xffa040), P(R + 1.5, 4.5, -3)); k.add(ball(0.6, 6, 3), lamp(0xffa040), P(R + 1.5, 4.5, 3));
  return {hw:R + 2, hd:L/2 + 2, top:R*0.3 + R*0.7 + 40};
};
G.buildTower = (h, w, hex, rand = Math.random) => {
  const g = new THREE.Group(), k = new Kit(), wall = G.mat(hex, {roughness:0.85}), trimM = G.mat(0xe8dcc0), win = G.mat(0x2f3a44, {roughness:0.3, emissive:0xffc45a, emissiveIntensity:0.25});
  let y = 0, ww = w, lvl = 0;
  const tiers = h > 90 ? 3 : 2;
  for (let t = 0; t < tiers; t++) {
    const th = t === 0 ? h*0.55 : t === 1 ? h*(tiers === 3 ? 0.27 : 0.45) : h*0.18;
    k.add(box(ww, th, ww), wall, T(0, y + th/2, 0)); k.add(box(ww + 0.8, 1.2, ww + 0.8), trimM, T(0, y + th, 0));
    for (let fy = y + 4; fy < y + th - 3; fy += 4.2) for (const f of [0, 1, 2, 3]) {
      const n = Math.max(2, Math.floor(ww/5)); for (let i = 0; i < n; i++) { const off = -ww/2 + (i + 0.5)*ww/n; if (rand() < 0.15) continue; k.add(box(f < 2 ? 1.8 : 0.1, 2.2, f < 2 ? 0.1 : 1.8), win, T(f === 2 ? ww/2 + 0.02 : f === 3 ? -ww/2 - 0.02 : off, fy, f === 0 ? ww/2 + 0.02 : f === 1 ? -ww/2 - 0.02 : off)); }
    }
    for (const sx of [1, -1]) k.add(box(1.2, th, 1.2), trimM, T(sx*ww/2, y + th/2, ww/2)), k.add(box(1.2, th, 1.2), trimM, T(sx*ww/2, y + th/2, -ww/2));
    y += th; ww *= 0.7; lvl++;
  }
  if (h > 70) { k.add(cyl(0.1, ww*0.3, h*0.18, 6), BRASS(), T(0, y + h*0.09, 0)); k.add(ball(0.6, 6, 3), lamp(0xff3b30), T(0, y + h*0.18, 0)); }
  k.build(g); g.userData.top = y; return g;
};

/* A railway viaduct: stone arches you can fly through, deck at deckY above the lowest ground, spanning `len` along local X.
   o.abut = [west, east]: ground heights every o.step metres outward from each end pier; a solid masonry approach is built
   over them, so the deck runs on to the bank. o.plain leaves the rails to the caller and gives the deck parapets. */
G.buildViaduct = (len, deckY, heights, o = {}) => {
  const g = new THREE.Group(), k = new Kit(), stone = G.mat(0xb59f80, {roughness:0.95}), dark = G.mat(0x8a7860, {roughness:0.95});
  const n = heights.length - 1, span = len/n;
  const st = o.step || 8, ab = o.abut || [[], []], x0 = -len/2 - 3 - ab[0].length*st, x1 = len/2 + 3 + ab[1].length*st;
  k.add(box(x1 - x0, 3, 9), stone, T((x0 + x1)/2, deckY + 1.5, 0));
  if (o.plain) for (const s of [1, -1]) { k.add(box(x1 - x0, 1.1, 0.6), stone, T((x0 + x1)/2, deckY + 3.55, s*4.2)); k.add(box(x1 - x0, 0.3, 0.9), dark, T((x0 + x1)/2, deckY + 4.2, s*4.2)); }
  else { k.add(box(len + 6, 0.6, 1), DARK(), T(0, deckY + 3.3, 2)); k.add(box(len + 6, 0.6, 1), DARK(), T(0, deckY + 3.3, -2)); }
  for (const e of [0, 1]) ab[e].forEach((gy, j) => {            // the approaches: solid wall stepping down to the rising bank, a string course under the deck
    const x = (e ? 1 : -1)*(len/2 + 3 + (j + 0.5)*st), hh = deckY - gy + 3;
    if (hh > 0.3) k.add(box(st + 0.05, hh, 9), stone, T(x, deckY - hh/2, 0));
    k.add(box(st + 0.05, 1.2, 10), dark, T(x, deckY - 3, 0));
  });
  for (let i = 0; i <= n; i++) {
    const x = -len/2 + i*span, gy = heights[i], hh = deckY - gy + 2;
    k.add(box(6, hh, 9), stone, T(x, gy + hh/2 - 2, 0)); k.add(box(7, 1.2, 10), dark, T(x, deckY - 3, 0));
  }
  for (let i = 0; i < n; i++) {               // spandrels: fill between each semicircular arch and the deck
    const x0 = -len/2 + i*span + 3, x1 = x0 + span - 6, r = (x1 - x0)/2, cx = (x0 + x1)/2, ys = deckY - 4 - r;
    for (let j = 0; j < 10; j++) {
      const u0 = -r + j*2*r/10, u1 = u0 + 2*r/10, u = (u0 + u1)/2, ya = ys + Math.sqrt(Math.max(0, r*r - u*u)), hh = deckY - ya;
      if (hh > 0.2) k.add(box(u1 - u0 + 0.05, hh, 9), stone, T(cx + u, ya + hh/2, 0));
    }
  }
  k.build(g); g.userData = {span, n, x0, x1}; return g;
};

/* Air-race gate: two striped pylons with a pennant line between, numbered by a brass disc on each pylon. */
G.buildGate = (width = 46, height = 34) => {
  const g = new THREE.Group(), k = new Kit(), red = G.mat(0xc0392b), white = G.mat(0xf1e9d6);
  for (const sx of [1, -1]) {
    for (let i = 0; i < 6; i++) k.add(cyl(1.2, 1.4, height/6, 8), i % 2 ? white : red, T(sx*width/2, (i + 0.5)*height/6, 0));
    k.add(ball(1.6, 8, 4), BRASS(), T(sx*width/2, height + 0.8, 0));
  }
  for (let i = 0; i < 12; i++) { const x = -width/2 + (i + 0.5)*width/12; k.add(poly([[-1.4, 0], [1.4, 0], [0, -2.6]]), i % 2 ? red : BRASS(), T(x, height - 0.2, 0)); k.add(xf(poly([[-1.4, 0], [1.4, 0], [0, -2.6]]), RY(PI)), i % 2 ? red : BRASS(), T(x, height - 0.2, 0)); }
  k.add(tube([-width/2, height, 0], [width/2, height, 0], 0.08, 4), DARK());
  k.build(g); g.userData = {width, height}; return g;
};

/* Floating wreckage for the fog search: a crate, a snapped wing with a skull roundel, a smoke pot. */
G.buildWreck = () => {
  const g = new THREE.Group(), k = new Kit(), wood = G.mat(0x8a6a44), red = G.mat(0x8e231c);
  k.add(box(2.4, 1.6, 1.6), wood, T(0, 0.4, 0)); k.add(box(2.5, 0.2, 1.7), DARK(), T(0, 1.0, 0));
  const af = t => [0, 1.6 - 0.4*t, 0.2, 0, 0]; k.add(pan(t => [0.3 + 4*t, 1.6 - 0.4*t, 0.2, 0, 0], 0, 1), red, mul(T(1.5, 0.3, 1.8), RY(0.6)));
  k.decal(mul(T(3.2, 0.42, 3.2), RX(-PI/2), SC(0.6, 0.6, 1)), skull(BRASS()));
  k.add(cyl(0.3, 0.35, 0.7, 6), DARK(), T(-1.2, 0.5, -1.2));
  k.build(g); return g;
};

/* ---------- Chapter 2 set pieces ---------- */
/* A back-country airfield, the kind pilots drink at between jobs. Tarmac runway along local Z, origin = runway centre.
   East of the north end: the apron with its parking cross, a bow-roofed tin hangar with rolling doors on outrigger rails
   (a ship in the doorway, the field's name painted along the roof for anyone overhead), a lean-to workshop, a fuel tank,
   drums and crates, a pump island, a radio shack with a lattice mast, a windsock in its wind circle, and the bar:
   the Café Lafayette by default, a two-storey streamline roadhouse with a round corner tower, a BAR fin in neon,
   a rooftop sign on raking struts, a pipe-railed roof terrace, an awning and a deck of tables under strings of bulbs.
   o: tar, grass, walls, trim, accent (paint), sign / signCol / signGlow (the rooftop sign; a pale signCol is read as neon
   on a dark board, a dark one as paint on a pale board), firm (the name over the hangar doors), roof (the name on the
   hangar roof), neon (hex of the BAR fin), day (1 broad daylight .. 0 night: how far the lamp halos are turned up).
   Callers rely on: the runway footprint, userData.apron, and the bar standing at apron + (44, 0, 10) inside a 24 m square. */
const cssLum = c => { const n = parseInt(String(c).replace('#', ''), 16) || 0; return ((n >> 16 & 255)*0.3 + (n >> 8 & 255)*0.59 + (n & 255)*0.11)/255; };
const AIR_FIRMS = ['HOLLOWAY & FINCH AERO', 'RED KITE FLYING SERVICE', 'PELICAN BAY AIR FREIGHT', 'OLD MAGPIE AIR EXPRESS', 'THISTLEDOWN AVIATION', 'BRASS COMPASS AIRWAYS'];
/* block capitals for the neon fin: strokes as [x0, y0, x1, y1] in a unit cell */
const BLOCK = {B:[[0, 0, 0.26, 1], [0, 0.82, 0.84, 1], [0, 0.41, 0.84, 0.59], [0, 0, 0.84, 0.18], [0.74, 0.56, 1, 0.86], [0.74, 0.14, 1, 0.44]],
  A:[[0, 0, 0.26, 1], [0.74, 0, 1, 1], [0, 0.82, 1, 1], [0, 0.38, 1, 0.56]],
  R:[[0, 0, 0.26, 1], [0, 0.82, 0.84, 1], [0, 0.41, 0.84, 0.59], [0.74, 0.56, 1, 0.86], [0.56, 0, 0.82, 0.41]]};
const signPlane = (tex, w, h, lit) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), lit ? new THREE.MeshBasicMaterial({map:tex, transparent:true, depthWrite:false}) : new THREE.MeshStandardMaterial({map:tex, transparent:true, depthWrite:false, roughness:0.9, metalness:0}));
/* a thirties motor car, nose along local +Z: body, cabin, bonnet, wings, running boards, lit headlamps */
function motorCar(k, x, z, yaw, body, glass){
  const M = (lx, ly, lz) => mul(T(x, 0, z), RY(yaw), T(lx, ly, lz)), dk = DARK();
  k.add(box(1.7, 0.75, 4.4), body, M(0, 0.86, 0)); k.add(box(1.5, 0.75, 2.1), body, M(0, 1.6, -0.55)); k.add(box(1.12, 0.36, 1.5), body, M(0, 1.4, 1.3));
  k.add(box(1.54, 0.4, 1.76), dk, M(0, 1.64, -0.55)); k.add(box(1.3, 0.4, 2.14), dk, M(0, 1.64, -0.55)); k.add(box(0.9, 0.72, 0.1), STEEL(), M(0, 1.14, 2.2));
  for (const sx of [1, -1]) { k.add(box(0.36, 0.1, 1.7), dk, M(sx*0.98, 0.5, 0));
    for (const sz of [1.4, -1.4]) { k.add(box(0.44, 0.26, 1.3), dk, M(sx*0.98, 0.82, sz)); k.add(cyl(0.4, 0.4, 0.28, 8), dk, mul(M(sx*0.94, 0.4, sz), RZ(PI/2))); }
    k.add(gem(0.15, 0.32), glass, M(sx*0.62, 1.2, 2.3)); }
}
G.buildAirstrip = (len = 560, wid = 26, o = {}) => {
  const g = new THREE.Group(), k = new Kit(), tar = G.mat(o.tar || 0x3b3936, {roughness:0.95}), grass = G.mat(o.grass || 0x5f7a35, {roughness:1}), paint = G.mat(0xe9e2cf), red = G.mat(o.accent || 0xa4322a);
  const cream = G.mat(o.walls || 0xe6d6b4, {roughness:0.8}), green = G.mat(o.trim || 0x2e5a46), roof = G.mat(0x6b3a2a, {roughness:0.8}), wood = roof, dark = DARK(), steel = STEEL(), win = WINDOW();
  const tin = G.mat(0x9aa0a4, {roughness:0.5, metalness:0.3}), tin2 = G.mat(0x71777b, {roughness:0.6, metalness:0.25});
  const LC = G.LAMP, fit = new G.Fittings({day:o.day ?? 1}); fit.k = k; fit.iron = fit.cord = dark;       // lamps, festoons and halos go into the same kit
  const warm = fit.glass(LC.WARM), neon = lamp(o.neon || 0xff5a6a), planes = [];
  const pane = (w, h, x, y, z, face) => k.add(rect(w, h), win, mul(T(x, y, z), RY(face)));                 // a lit window on a wall facing +Z turned by `face`
  const glow = (p, hex, r, h, big) => { k.add(gem(r, h), fit.glass(hex), T(p[0], p[1], p[2])); fit.halo(p, hex, big); };
  /* ---- the runway (unchanged footprint) ---- */
  k.add(box(wid + 24, 0.12, len + 50), grass, T(0, 0.02, 0)); k.add(box(wid, 0.16, len), tar, T(0, 0.08, 0));
  for (let z = -len/2 + 40; z < len/2 - 40; z += 30) k.add(box(0.6, 0.18, 12), paint, T(0, 0.1, z));          // centre-line dashes
  for (const e of [1, -1]) for (let i = -4; i <= 4; i++) if (i) k.add(box(1.2, 0.18, 14), paint, T(i*2.6, 0.1, e*(len/2 - 12)));   // threshold bars
  for (const e of [1, -1]) for (let z = -len/2; z <= len/2; z += 40) { const end = z === -len/2 || z === len/2, p = [e*(wid/2 + 1.5), 0.56, z];   // edge lamps, green at the ends
    if (end) { k.add(gem(0.42, 0.9), lamp(0x47e36a), T(p[0], p[1], p[2])); fit.halo(p, 0x47e36a); } else glow(p, LC.WARM, 0.42, 0.9); }
  for (const e of [1, -1]) for (const sx of [2.3, -2.1]) k.add(box(0.7, 0.02, 44 + sx*3), dark, T(sx, 0.17, e*(len/2 - 58)));       // rubber where the wheels come down
  /* ---- apron, taxi stub and the way to the hangar ---- */
  const ax = wid/2 + 34, az = len/2 - 90;
  k.add(box(46, 0.14, 60), tar, T(ax, 0.07, az)); k.add(box(11.2, 0.14, 16), tar, T(wid/2 + 5.5, 0.07, az));
  k.add(box(34, 0.2, 2), paint, T(ax, 0.12, az - 26)); k.add(box(2, 0.2, 2), red, T(ax, 0.13, az));          // parking cross
  k.add(ring(5.4, 6, 20), paint, onTop(ax, 0.16, az)); k.add(box(21, 0.2, 0.4), paint, T(wid/2 + 17.5 - 6.5, 0.12, az));
  for (const [dx, dz, r] of [[-9, 13, 1.5], [7, -12, 1.1], [13, 17, 1.3], [4, 5, 0.8]]) k.add(disc(r, 7), dark, onTop(ax + dx, 0.15, az + dz));   // oil
  /* ---- the hangar: bow roof on low walls, 26 x 30 m, doors to the apron ---- */
  const hx = ax + 6, hz = az - 70, HR = 14.56, HY = -2.06, NA = 10, A = [], t0 = Math.atan2(4.5 - HY, 13);
  for (let i = 0; i <= NA; i++) { const t = t0 + i*(PI - 2*t0)/NA; A.push([Math.cos(t)*HR, HY + Math.sin(t)*HR]); }
  k.add(box(20, 0.14, 25.4), tar, T(hx, 0.07, hz + 27.5)); k.add(box(25.4, 0.12, 29.6), tin2, T(hx, 0.06, hz));
  for (let i = 0; i < NA; i++) { const a = A[i], b = A[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);      // ribbed tin, sheet by sheet
    k.add(box(L + 0.12, 0.3, 30.6), i % 2 ? tin : tin2, mul(T(hx + (a[0] + b[0])/2, (a[1] + b[1])/2, hz), RZ(Math.atan2(b[1] - a[1], b[0] - a[0])))); }
  for (const [i, dz, l] of [[2, 6, 5], [7, -8, 6.5], [8, 9, 3]]) { const a = A[i], b = A[i + 1]; k.add(box(2.4, 0.36, l), roof, mul(T(hx + (a[0] + b[0])/2, (a[1] + b[1])/2, hz + dz), RZ(Math.atan2(b[1] - a[1], b[0] - a[0])))); }   // rust
  for (const s of [1, -1]) { k.add(box(0.3, 4.7, 30), tin2, T(hx + s*12.85, 2.35, hz)); for (let j = 0; j < 5; j++) pane(2.8, 1.1, hx + s*13.04, 3.3, hz - 10.5 + j*5.25, s*PI/2); }
  const gable = [[13, 0], ...A, [-13, 0]], DW = 9.5, DH = 8.5, qy = A[1][1] + (DW - A[1][0])/(A[2][0] - A[1][0])*(A[2][1] - A[1][1]);
  k.add(poly(gable), dark, T(hx, 0, hz - 14.8)); k.add(xf(poly(gable), RY(PI)), tin2, T(hx, 0, hz - 15));     // back wall, inside and out
  k.add(box(26.1, 0.9, 0.1), red, T(hx, 2.3, hz - 15.02)); k.add(box(1.3, 2.3, 0.1), wood, T(hx + 8, 1.15, hz - 15.04)); for (const dx of [-7, -2.5, 2]) pane(2.6, 1.1, hx + dx, 6.2, hz - 15.06, PI);
  k.add(poly([[DW, 0], [13, 0], A[0], A[1], [DW, qy]]), cream, T(hx, 0, hz + 15)); k.add(poly([[-13, 0], [-DW, 0], [-DW, qy], A[NA - 1], A[NA]]), cream, T(hx, 0, hz + 15));
  k.add(poly([[-DW, DH], [DW, DH], [DW, qy], ...A.slice(2, NA - 1), [-DW, qy]]), cream, T(hx, 0, hz + 15));
  k.add(box(19.4, 0.5, 0.2), green, T(hx, DH + 0.25, hz + 15.08));
  for (const lx of [-9.75, 14.25]) {                                                                          // two rolling leaves, run back along the rail
    k.add(box(9.5, 8.4, 0.24), tin, T(hx + lx, 4.3, hz + 15.42)); k.add(box(9.54, 0.9, 0.3), red, T(hx + lx, 2.3, hz + 15.42));
    for (const dx of [-4.6, 0, 4.6]) k.add(box(0.22, 8.4, 0.34), tin2, T(hx + lx + dx, 4.3, hz + 15.42));
    for (const dx of [-2.3, 2.3]) pane(2, 1.1, hx + lx + dx, 6.3, hz + 15.58, 0);
  }
  k.add(box(36.4, 0.26, 0.34), dark, T(hx + 2.3, DH + 0.3, hz + 15.44));
  for (const px of [-15.7, 20.3]) { k.add(box(0.3, DH + 0.2, 0.3), dark, T(hx + px, (DH + 0.2)/2, hz + 15.44)); k.add(bar([hx + px, DH - 2.4, hz + 15.44], [hx + px - Math.sign(px)*2.6, DH + 0.2, hz + 15.44], 0.16), dark); }
  fit.lantern([hx, 11.6, hz + 16], {wall:[hx, 11.6, hz + 15], s:1.5, hex:LC.WARM}); fit.lantern([hx, 8.6, hz + 3], {hang:2.6, s:1.5, hex:LC.WARM});
  { const M = (...m) => mul(T(hx + 2.3, 1.36, hz + 9.6), RX(-0.2), ...m);                                       // somebody's ship, nose in the doorway
    k.add(lathe([[0.08, -4.2], [0.42, -2.6], [0.62, -0.2], [0.62, 1.5], [0.52, 2.1]], 8), red, M()); k.add(lathe([[0.66, 2.05], [0.66, 2.5], [0.3, 2.62]], 8), dark, M());
    k.add(box(9.6, 0.16, 1.7), paint, M(T(0, -0.36, 0.6))); k.add(box(3.2, 0.08, 0.9), paint, M(T(0, 0.12, -3.7))); k.add(box(0.08, 1.15, 0.95), red, M(T(0, 0.62, -3.75)));
    k.add(box(0.18, 2.7, 0.07), wood, M(T(0, 0, 2.68), RZ(0.6))); k.add(box(0.5, 0.36, 0.9), dark, M(T(0, 0.66, -0.3)));
    for (const sx of [1.25, -1.25]) { k.add(bar([sx, -0.4, 0.8], [sx, -1.0, 0.95], 0.1), dark, M()); k.add(cyl(0.38, 0.38, 0.22, 8), dark, M(T(sx, -1.12, 0.95), RZ(PI/2))); } }
  // lean-to workshop with a stovepipe, east side
  k.add(box(5, 3.3, 14), tin2, T(hx + 15.5, 1.65, hz - 4)); k.add(box(5.9, 0.2, 14.8), roof, mul(T(hx + 15.7, 3.62, hz - 4), RZ(-0.2)));
  k.add(box(1.2, 2.2, 0.12), wood, T(hx + 15.5, 1.1, hz + 3.02)); pane(2.2, 1, hx + 18.06, 2, hz - 6, PI/2); pane(2.2, 1, hx + 18.06, 2, hz - 1.5, PI/2);
  k.add(tube([hx + 17, 2.8, hz - 9], [hx + 17, 6.2, hz - 9], 0.18, 5), dark); k.add(cyl(0.34, 0.2, 0.3, 5), dark, T(hx + 17, 6.3, hz - 9));
  // fuel tank on saddles against the west wall, drums and crates by the doors
  k.add(xf(cyl(1.2, 1.2, 6.4, 10), RX(PI/2)), red, T(hx - 15.2, 2, hz - 3)); k.add(xf(cyl(1.24, 1.24, 0.9, 10, false), RX(PI/2)), paint, T(hx - 15.2, 2, hz - 3));
  for (const dz of [-2.2, 2.2]) k.add(box(2.2, 0.9, 0.5), dark, T(hx - 15.2, 0.45, hz - 3 + dz));
  k.add(tube([hx - 15.2, 3.1, hz - 1], [hx - 15.2, 3.9, hz - 1], 0.14, 5), dark); k.add(tube([hx - 15.2, 3.8, hz - 1], [hx - 13, 3.8, hz - 1], 0.07, 4), dark);
  [[-15.4, 16.6, red], [-14.5, 17.3, tin2], [-15.5, 17.7, roof], [-13.6, 16.4, green], [-14.4, 16.3, roof]].forEach(([dx, dz, m], i) => k.add(cyl(0.3, 0.3, 0.9, 7), m, T(hx + dx, 0.45, hz + dz)));
  k.add(xf(cyl(0.3, 0.3, 0.9, 7), RZ(PI/2)), red, mul(T(hx - 13, 0.3, hz + 18.3), RY(0.5)));
  k.add(box(1.3, 1, 1.3), wood, T(hx + 14.2, 0.5, hz + 16.6)); k.add(box(1, 0.8, 1), wood, mul(T(hx + 15.6, 0.4, hz + 16.9), RY(0.4))); k.add(box(0.9, 0.7, 0.9), wood, mul(T(hx + 14.3, 1.35, hz + 16.7), RY(0.3)));
  /* ---- windsock in its wind circle ---- */
  { const wx = ax - 18, wz = az + 40, M = (...m) => mul(T(wx, 8.7, wz), RY(0.5), RZ(-0.16), ...m);
    k.add(cyl(0.25, 0.42, 0.5, 6), paint, T(wx, 0.25, wz)); k.add(tube([wx, 0, wz], [wx, 9.3, wz], 0.12, 5), steel); k.add(ring(4.5, 5.1, 16), paint, onTop(wx, 0.12, wz));
    for (let i = 0; i < 4; i++) k.add(cyl(0.64 - (i + 1)*0.11, 0.64 - i*0.11, 1.12, 8, i === 3), i % 2 ? paint : red, M(T(0.7 + i*1.12, 0, 0), RZ(-PI/2))); }
  /* ---- radio shack and its mast ---- */
  { const rx = ax + 33, rz = az - 42, mx = rx + 5.5, mz = rz - 1.5, MH = 18, leg = [0, 1, 2].map(j => [Math.cos(j*2*PI/3 + 0.5), Math.sin(j*2*PI/3 + 0.5)]), at = (j, y) => { const r = 1.25 - 1.12*y/MH; return [mx + leg[j][0]*r, y, mz + leg[j][1]*r]; };
    k.add(box(5, 3, 4), cream, T(rx, 1.5, rz)); k.add(box(5.8, 0.3, 4.8), green, T(rx, 3.15, rz)); pane(3.6, 1, rx - 0.3, 2, rz + 2.05, 0); pane(2.6, 1, rx - 2.55, 2, rz, -PI/2);
    k.add(box(0.12, 2.1, 1), wood, T(rx + 2.5, 1.05, rz + 0.8)); k.add(tube([rx - 1.8, 3.3, rz], [rx - 1.8, 5, rz], 0.06, 4), dark);
    for (let j = 0; j < 3; j++) { k.add(tube(at(j, 0), at(j, MH), 0.08, 3, false), steel);
      for (let y = 3; y < MH; y += 3) { k.add(tube(at(j, y), at((j + 1) % 3, y), 0.05, 3, false), steel); k.add(tube(at(j, y - 3), at((j + 1) % 3, y), 0.04, 3, false), steel); }
      k.add(wire([mx + leg[j][0]*0.5, 12, mz + leg[j][1]*0.5], [mx - leg[j][0]*7.5, 0, mz - leg[j][1]*7.5], 0.03), dark); }
    k.add(wire([mx, 16.5, mz], [rx - 1.8, 5, rz], 0.03), dark); glow([mx, MH + 0.45, mz], LC.RED, 0.34, 0.8, true); }
  /* ---- pump island on the apron's east edge ---- */
  { const fx = ax + 21.5, fz = az + 22;
    k.add(box(2, 0.3, 8.6), paint, T(fx, 0.15, fz));
    for (const dz of [-2.3, 2.3]) { k.add(box(0.8, 1.7, 0.62), red, T(fx, 1.15, fz + dz)); k.add(cyl(0.3, 0.3, 0.8, 8, false), paint, T(fx, 2.4, fz + dz)); k.add(cyl(0.36, 0.36, 0.14, 8), red, T(fx, 2.86, fz + dz)); glow([fx, 3.2, fz + dz], LC.WARM, 0.3, 0.62);
      k.add(wire([fx - 0.4, 2.2, fz + dz], [fx - 0.75, 0.9, fz + dz + 0.3], 0.04), dark); }
    k.add(tube([fx, 0.3, fz], [fx, 5.2, fz], 0.09, 5), dark); k.add(xf(cyl(0.95, 0.95, 0.14, 12), RZ(PI/2)), paint, T(fx, 4.1, fz));
    k.add(star(0.74, 0.3), red, onSide(fx + 0.08, 4.1, fz)); k.add(star(0.74, 0.3), red, mul(T(fx - 0.08, 4.1, fz), RY(-PI/2)));
    fit.lantern([fx, 5.6, fz], {s:1.3, hex:LC.WARM}); k.add(box(0.7, 1.2, 0.5), green, T(fx, 0.9, fz + 3.7)); }
  /* ---- the bar ---- */
  const cx = ax + 44, cz = az + 10, C = (x, y, z) => T(cx + x, y, cz + z), tx = cx - 11, tz = cz - 8;
  k.add(box(22.4, 0.7, 16.4), green, C(0, 0.35, 0)); k.add(box(22, 7, 16), cream, C(0, 3.5, 0)); k.add(box(23, 0.6, 17), green, C(0, 7.2, 0));
  for (const y of [6.05, 6.5]) k.add(box(22.16, 0.12, 16.16), green, C(0, y, 0));                        // speed lines right round
  k.add(box(16, 5, 12), cream, C(1, 9.5, 0)); k.add(box(17, 0.6, 13), green, C(1, 12.2, 0)); k.add(box(16.2, 0.12, 12.2), green, C(1, 11.3, 0));
  k.add(box(21.6, 0.1, 15.6), tin2, C(0, 7.53, 0)); k.add(box(15.8, 0.1, 11.8), tin2, C(1, 12.53, 0));       // roof decks inside the copings
  // corner tower: marquee canopy with bulbs round the foot, glass strips, a stepped cap and a mast lamp
  k.add(cyl(3.2, 3.2, 13, 12), cream, T(tx, 6.5, tz)); k.add(cyl(3.5, 3.5, 0.6, 12), green, T(tx, 7.2, tz)); k.add(cyl(3.5, 3.5, 0.5, 12), green, T(tx, 13.2, tz));
  k.add(cyl(2.5, 2.5, 0.9, 12), cream, T(tx, 13.9, tz)); k.add(cyl(1.7, 1.7, 0.6, 12), green, T(tx, 14.65, tz)); k.add(tube([tx, 14.9, tz], [tx, 18.3, tz], 0.1, 5), steel);
  glow([tx, 18.7, tz], LC.RED, 0.32, 0.75, true);
  k.add(cyl(4.5, 4.5, 0.32, 12), green, T(tx, 3.7, tz)); k.add(cyl(4.56, 4.56, 0.12, 12, false), red, T(tx, 3.7, tz));
  for (let j = 0; j < 12; j++) { const c = Math.cos(j*PI/6), s = Math.sin(j*PI/6); if (c > 0.2 && s > -0.6 || s > 0.2 && c > -0.6) continue; glow([tx + c*4.1, 3.32, tz + s*4.1], LC.WARM, 0.2, 0.44); }
  k.add(box(0.14, 2.7, 1.3), wood, T(tx - 3.09, 1.35, tz)); pane(1.1, 1.7, tx, 2.1, tz - 3.15, PI);
  for (const a of [5*PI/6, 7*PI/6, 3*PI/2]) pane(1, 4.2, tx + Math.cos(a)*3.15, 10.3, tz + Math.sin(a)*3.15, PI/2 - a);     // glass strips either side of the fin
  { const FM = (...m) => mul(T(tx - 4.25, 10.65, tz), RY(PI), ...m), cw = 1.3, ch = 1.6;             // the fin, square to the runway: BAR in neon for anyone flying past, either way
    k.add(box(2.3, 6.3, 0.3), green, FM()); k.add(box(0.2, 6.5, 0.44), red, FM(T(1.2, 0, 0)));
    ['B', 'A', 'R'].forEach((L, i) => { const yc = 2.05 - i*2.05;
      for (const [x0, y0, x1, y1] of BLOCK[L]) { const w = (x1 - x0)*cw, h = (y1 - y0)*ch, lx = ((x0 + x1)/2 - 0.5)*cw - 0.1, ly = yc + ((y0 + y1)/2 - 0.5)*ch;
        if (L === 'A') k.add(box(w, h, 0.46), neon, FM(T(lx + (lx > -0.1 ? 0 : 0), ly, 0)));
        else { k.add(box(w, h, 0.08), neon, FM(T(lx, ly, 0.19))); k.add(box(w, h, 0.08), neon, FM(T(-lx - 0.2, ly, -0.19))); } }
      fit.halo([tx - 4.15, 10.65 + yc, tz], o.neon || 0xff5a6a); }); }
  // front: a ribbon of windows under a striped awning, the door under its canopy with a propeller over it
  for (let i = 0; i < 4; i++) pane(2.5, 2.8, cx - 5.7 + i*3.1, 2.75, cz - 8.06, PI); k.add(box(12.9, 0.2, 0.36), green, C(-1.05, 1.25, -8));
  for (let i = 0; i < 8; i++) k.add(box(1.62, 0.12, 3), i % 2 ? red : paint, mul(C(-6.7 + i*1.62, 4.95, -9.4), RX(-0.34))); k.add(box(12.96, 0.36, 0.1), red, C(-1.03, 4.3, -10.84));
  k.add(box(2.8, 3.1, 0.16), wood, C(7.6, 2.25, -8)); k.add(box(3.8, 0.35, 1.5), paint, C(7.6, 0.175, -8.9)); k.add(box(3.3, 0.7, 0.7), paint, C(7.6, 0.35, -8.5));
  for (const dx of [-0.65, 0.65]) k.add(disc(0.36, 8), warm, mul(C(7.6 + dx, 2.9, -8.1), RY(PI)));
  k.add(box(4.4, 0.26, 2.4), green, C(7.6, 4.15, -9.2)); k.add(box(4.5, 0.12, 2.5), red, C(7.6, 4.15, -9.2));
  for (const dx of [-2, 2]) { k.add(wire([cx + 7.6 + dx, 4.2, cz - 10.3], [cx + 7.6 + dx, 5.8, cz - 8], 0.035), dark); fit.lantern([cx + 7.6 + dx*0.95, 3.2, cz - 8.6], {wall:[cx + 7.6 + dx*0.95, 3.2, cz - 8], hex:LC.AMBER}); }
  k.add(box(3.5, 0.28, 0.1), wood, mul(C(7.6, 5.25, -8.1), RZ(0.3))); k.add(xf(cyl(0.24, 0.24, 0.2, 8), RX(PI/2)), paint, C(7.6, 5.25, -8.12));
  // the other walls: windows, the house star, a kitchen out the back with kegs and crates, a chimney
  for (const z of [-2.4, 1.2]) pane(2.3, 2.6, cx - 11.06, 2.9, cz + z, -PI/2); for (const z of [-3.6, 0, 3.6]) pane(2, 2, cx - 7.06, 9.4, cz + z, -PI/2);
  k.add(ring(1.3, 1.6, 14), red, mul(C(-11.04, 3.5, 5.2), RY(-PI/2))); k.add(star(1.15, 0.46), red, mul(C(-11.04, 3.5, 5.2), RY(-PI/2)));
  for (let i = 0; i < 4; i++) pane(2, 2, cx - 4 + i*3.2, 9.4, cz - 6.06, PI); for (const x of [-3.5, 1, 5.5]) pane(2, 2, cx + x, 9.4, cz + 6.06, 0);
  for (const z of [-3.5, 3]) { pane(2.3, 2.6, cx + 11.06, 2.9, cz + z, PI/2); pane(2, 2, cx + 9.06, 9.4, cz + z*0.8, PI/2); } for (const x of [-7.5, -3.8]) pane(2.3, 2.6, cx + x, 2.9, cz + 8.06, 0);
  k.add(box(7, 3, 3), cream, C(6.5, 1.5, 9.5)); k.add(box(7.6, 0.25, 3.6), green, C(6.5, 3.1, 9.6)); k.add(box(1.1, 2.1, 0.12), wood, C(4.6, 1.05, 11)); pane(1.6, 0.9, cx + 8, 2, cz + 11.05, 0);
  for (const [x, z] of [[1.6, 8.6], [0.8, 8.7], [1.2, 9.4]]) k.add(cyl(0.36, 0.36, 0.9, 8), wood, C(x, 0.45, z)); k.add(box(1.1, 0.8, 1.1), wood, C(-0.6, 0.4, 8.8)); k.add(box(0.9, 0.7, 0.9), wood, mul(C(-0.5, 1.15, 8.8), RY(0.4)));
  k.add(box(1.3, 2.8, 1.3), roof, C(6.5, 13.6, 3.5)); k.add(box(1.6, 0.2, 1.6), dark, C(6.5, 15.1, 3.5));
  // roof terrace behind a white pipe rail
  { const rail = (x0, z0, x1, z1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0)/3.2)); for (const y of [8.05, 8.55]) k.add(bar([cx + x0, y, cz + z0], [cx + x1, y, cz + z1], 0.09), paint);
      for (let i = 0; i <= n; i++) k.add(box(0.1, 1.05, 0.1), paint, C(x0 + (x1 - x0)*i/n, 8.02, z0 + (z1 - z0)*i/n)); };
    rail(-7.4, -8.2, 11.2, -8.2); rail(-11.2, -4.6, -11.2, 8.2);
    for (const [x, z, m] of [[-9.2, 1, red], [-9.2, 5, green]]) { k.add(cyl(0.7, 0.7, 0.07, 8), paint, C(x, 8.4, z)); k.add(tube([cx + x, 7.5, cz + z], [cx + x, 10.3, cz + z], 0.05, 4), dark); k.add(cyl(0.15, 1.45, 0.65, 8), m, C(x, 10.35, z)); } }
  // rooftop sign on raking struts
  const sy = 14.35, sz = -5.7, board = cssLum(o.signCol || '#ff5a6a') > 0.42 ? dark : paint;   // neon wants a dark board, painted letters a pale one
  k.add(box(17, 2.6, 0.24), board, C(1, sy, sz)); k.add(box(0.24, 2.6, 12), board, C(-7.38, sy, sz + 6.12));     // one board to the runway, one to the apron
  for (const e of [1, -1]) { k.add(box(17.3, 0.16, 0.36), red, C(1, sy + e*1.38, sz)); k.add(box(0.36, 0.16, 12.1), red, C(-7.38, sy + e*1.38, sz + 6.1)); }
  for (const x of [-5.4, -1.2, 3.2, 7.6]) { k.add(box(0.26, 0.6, 0.26), dark, C(x, 12.8, sz)); k.add(bar([cx + x, 12.5, cz - 2.2], [cx + x, sy + 1.2, cz + sz + 0.1], 0.13), dark); }
  for (const z of [-1.8, 2.4, 6]) { k.add(box(0.26, 0.6, 0.26), dark, C(-7.38, 12.8, z)); k.add(bar([cx - 4, 12.5, cz + z], [cx - 7.28, sy + 1.2, cz + z], 0.13), dark); }
  // the deck: tables under umbrellas, chairs, planters, strings of bulbs
  k.add(box(17.6, 0.24, 7.6), wood, C(-0.75, 0.12, -14));
  for (let i = 0; i < 4; i++) { const x = cx - 6.6 + i*4.2, z = cz - 13.8 - (i % 2)*0.9;
    k.add(cyl(0.85, 0.85, 0.08, 8), paint, T(x, 1.02, z)); k.add(tube([x, 0.24, z], [x, 3.15, z], 0.05, 4), dark); k.add(cyl(0.16, 1.65, 0.75, 8), i % 2 ? green : red, T(x, 3.3, z));
    for (const sx of [1.25, -1.25]) { k.add(box(0.46, 0.5, 0.46), wood, T(x + sx, 0.49, z)); } }
  for (const x of [-7.9, 6.4]) { k.add(box(2.8, 0.7, 0.8), cream, C(x, 0.59, -17.3)); k.add(box(2.6, 0.5, 0.6), grass, C(x, 1.15, -17.3)); }
  { const pa = [cx - 9.4, 5.3, cz - 17.5], pb = [cx + 7.9, 5.3, cz - 17.5], F = {every:2.1, cols:[LC.WARM, LC.WARM, LC.AMBER], r:0.24};
    for (const p of [pa, pb]) k.add(tube([p[0], 0, p[2]], [p[0], p[1] + 0.1, p[2]], 0.09, 5), dark);
    fit.festoon(pa, pb, Object.assign({sag:0.9}, F)); fit.festoon(pa, [cx - 7.4, 6.9, cz - 8.1], F); fit.festoon(pb, [cx + 10.6, 6.9, cz - 8.1], F); }
  // motor cars: a sedan on the gravel by the deck, the field's runabout by the workshop
  k.add(box(15, 0.12, 8), tar, C(-1, 0.06, -23.5)); motorCar(k, cx - 4, cz - 23, 0.12, G.mat(0x1f2a44), warm); motorCar(k, hx + 21.5, hz + 3, 2.9, red, warm);
  fit.build(g);
  /* ---- lettering: the rooftop sign (both faces), the firm over the hangar doors, the field's name along the hangar roof ---- */
  const accent = css(o.accent || 0xa4322a), nt = nameTex(o.sign || 'CAFÉ LAFAYETTE', o.signCol || '#ff5a6a', o.signGlow || '#ffd27a');
  if (nt) { for (const f of [-1, 1]) { const m = signPlane(nt, 16.4, 2.05, true); m.position.set(cx + 1, sy, cz + sz + f*0.135); m.rotation.y = f < 0 ? PI : 0; g.add(m); }
    const m = signPlane(nt, 11.6, 1.45, true); m.position.set(cx - 7.38 - 0.135, sy, cz + sz + 6.12); m.rotation.y = -PI/2; g.add(m); }
  const firm = o.firm || AIR_FIRMS[[...(o.sign || '')].reduce((s, c) => s + c.charCodeAt(0), 0) % AIR_FIRMS.length], ft = nameTex(firm, '#2a1d10', accent);
  if (ft) { const m = signPlane(ft, 13.2, 1.65, false); m.position.set(hx, 9.72, hz + 15.03); g.add(m); }
  const rt = nameTex(o.roof || o.sign || 'SAINT-REMY', '#e9e2cf', accent);
  if (rt) { const m = signPlane(rt, 27, 3.375, false); m.position.set(hx, 12.5 + 0.24, hz); m.rotation.set(-PI/2, 0, -PI/2); g.add(m); }   // reads from the runway side
  g.userData = {len, wid, apron:new V3(ax, 0, az), bar:new V3(cx, 0, cz), hangar:new V3(hx, 0, hz), fittings:g.userData.fittings};
  return g;
};

/* Halcyon Aero Works: a tall Deco tower with a flying-through gallery cut clean through its upper floors.
   The skyhook ring hangs from the gallery ceiling, so you fly INTO the building to deliver. The gallery runs along local Z. */
G.buildSkyhookTower = (h = 140, w = 40, o = {}) => {
  const g = new THREE.Group(), k = new Kit(), PIR = !!o.pirate, wall = G.mat(o.walls || 0xd8c6a4, {roughness:0.85}), trimM = PIR ? G.mat(0x2a221c, {roughness:0.95}) : G.mat(0xe8dcc0), dark = G.mat(0x3a3530, {roughness:0.9});
  const win = G.mat(0x2f3a44, {roughness:0.3, emissive:0xffc45a, emissiveIntensity:0.25});
  const rr = G.rng ? G.rng(Math.round(h*31 + w*7)) : Math.random;
  const y0 = o.y0 ?? Math.min(92, h - 32), oh = 18, ow = 26, y1 = y0 + oh, side = (w - ow)/2;
  const windows = (x0, x1, ya, yb, z, face) => { for (let y = ya + 3; y < yb - 2.5; y += 4.2) for (let x = x0 + 2.5; x < x1 - 2; x += 4.6) k.add(box(1.8, 2.2, 0.12), win, T(x, y, z + face*0.07)); };
  // base block, the two gallery piers, the upper block
  k.add(box(w, y0, w), wall, T(0, y0/2, 0));
  for (const sx of [1, -1]) k.add(box(side, oh, w), wall, T(sx*(ow/2 + side/2), y0 + oh/2, 0));
  k.add(box(w, h - y1, w), wall, T(0, y1 + (h - y1)/2, 0));
  if (!PIR) {
  for (const f of [1, -1]) { windows(-w/2, w/2, 0, y0, f*w/2, f); windows(-w/2, w/2, y1, h, f*w/2, f); }
  for (const f of [1, -1]) for (let y = 3; y < h - 2; y += 4.2) { if (y > y0 - 1 && y < y1 + 1) continue; for (let z = -w/2 + 2.5; z < w/2 - 2; z += 4.6) k.add(box(0.12, 2.2, 1.8), win, T(f*(w/2 + 0.07), y, z)); }
  } else {
    // a pirate's tower: rough black stone to the gallery, salvaged timber above, braced all over, windows wherever someone knocked one through
    const stone = G.mat(0x2e2a28, {roughness:1}), plank = G.mat(0x5a4632, {roughness:0.95});
    k.add(box(w + 0.6, y0*0.35, w + 0.6), stone, T(0, y0*0.175, 0));
    k.add(box(w + 0.3, h - y1, w + 0.3), plank, T(0, y1 + (h - y1)/2, 0));
    for (const f of [1, -1]) for (const ax of [0, 1]) {
      const at = (u, y) => ax ? T(f*(w/2 + 0.2), y, u) : T(u, y, f*(w/2 + 0.2));
      for (let y = 6; y < h - 3; y += 7 + rr()*5) { if (y > y0 - 2 && y < y1 + 2) continue; if (rr() < 0.55) { const u = (rr() - 0.5)*(w - 6); k.add(ax ? box(0.2, 2.4, 1.8) : box(1.8, 2.4, 0.2), win, at(u, y)); } }
      for (let y = 8; y < h - 4; y += 16) { if (y > y0 - 18 && y < y1 + 2) continue; k.add(bar(ax ? [f*(w/2 + 0.5), y, -w/2] : [-w/2, y, f*(w/2 + 0.5)], ax ? [f*(w/2 + 0.5), y + 14, w/2] : [w/2, y + 14, f*(w/2 + 0.5)], 0.35), trimM); k.add(bar(ax ? [f*(w/2 + 0.5), y + 14, -w/2] : [-w/2, y + 14, f*(w/2 + 0.5)], ax ? [f*(w/2 + 0.5), y, w/2] : [w/2, y, f*(w/2 + 0.5)], 0.35), trimM); }
    }
    for (let i = 0; i < 6; i++) { const a = rr()*PI*2, y = y1 + 6 + rr()*(h - y1 - 12); k.add(box(3 + rr()*3, 2.4, 2.4), plank, mul(T(Math.sin(a)*(w/2 + 1), y, Math.cos(a)*(w/2 + 1)), RY(a))); }   // lean-to cabins nailed on
  }
  for (const sx of [1, -1]) for (const sz of [1, -1]) k.add(box(1.6, h, 1.6), trimM, T(sx*w/2, h/2, sz*w/2));   // corner piers
  for (const y of [y0, y1]) k.add(box(w + 1.2, 1.2, w + 1.2), trimM, T(0, y, 0));
  // the gallery: dark floor and ceiling, brass edging, lamps down both walls
  k.add(box(ow, 0.4, w + 0.4), dark, T(0, y0 + 0.2, 0)); k.add(box(ow, 0.4, w + 0.4), dark, T(0, y1 - 0.2, 0));
  for (const sx of [1, -1]) { k.add(box(0.3, oh, w), dark, T(sx*(ow/2 - 0.15), y0 + oh/2, 0)); for (const f of [1, -1]) k.add(box(0.6, oh, 0.6), BRASS(), T(sx*ow/2, y0 + oh/2, f*w/2));
    for (let z = -w/2 + 4; z < w/2; z += 8) k.add(ball(0.35, 6, 3), lamp(0xffd27a), T(sx*(ow/2 - 0.5), y0 + oh - 2, z)); }
  for (const f of [1, -1]) k.add(box(ow + 1.2, 0.6, 0.6), BRASS(), T(0, y1, f*w/2));
  let mast = null;
  if (!PIR && o.mast) {
    // a zeppelin mooring mast: three setbacks with fluted piers, a winged drum, a faceted glass-and-steel shaft,
    // the mooring platform with its rail, a lantern, a nose-cone cap and the red beacon
    const u = w/40, steel = G.mat(0xaab0b6, {roughness:0.35, metalness:0.4}), glow = G.mat(0x3b3424, {roughness:0.3, emissive:0xffc45a, emissiveIntensity:0.6});
    let y = h, s = w;
    for (const [f, th] of [[0.76, 8], [0.54, 7], [0.36, 6]]) {
      s = w*f; const t = th*u;
      k.add(box(s, t, s), wall, T(0, y + t/2, 0)); k.add(box(s + 1, 0.9, s + 1), trimM, T(0, y + t, 0));
      for (const a of [0, 1, 2, 3]) { const M = RY(a*PI/2); k.add(box(s*0.3, t + 2.2*u, 1.2), trimM, mul(M, T(0, y + t/2 + 1.1*u, s/2 + 0.3))); k.add(box(s*0.09, t - 2.4*u, 0.14), win, mul(M, T(0, y + t/2 - 0.2*u, s/2 + 0.94)));
        for (const e of [1, -1]) k.add(box(1.1, t + 0.8*u, 1.1), trimM, mul(M, T(e*s/2, y + t/2 + 0.4*u, s/2))); }
      y += t;
    }
    const r0 = 6*u, r1 = 3.8*u, r2 = 3.8*u, sh = 24*u, yb = y;
    k.add(cyl(r0*0.92, r0, 5*u, 8), wall, T(0, y + 2.5*u, 0)); k.add(cyl(r0*1.02, r0*1.02, 0.7*u, 8), trimM, T(0, y + 5*u, 0));
    for (let a = 0; a < 4; a++) k.add(loft([[[0, yb, -0.5*u], [s*0.56, yb, -0.5*u], [s*0.56, yb + 2.5*u, -0.5*u], [r1, yb + 11*u, -0.5*u], [0, yb + 11*u, -0.5*u]], [[0, yb, 0.5*u], [s*0.56, yb, 0.5*u], [s*0.56, yb + 2.5*u, 0.5*u], [r1, yb + 11*u, 0.5*u], [0, yb + 11*u, 0.5*u]]]), trimM, RY(a*PI/2 + PI/4));   // the wings at the foot of the mast
    y += 5*u;
    k.add(cyl(r2, r1, sh, 8), steel, T(0, y + sh/2, 0));
    for (let a = 0; a < 8; a++) { const c = Math.cos(PI/8), M = RY(a*PI/4 + PI/8);
      if (a % 2 === 0) k.add(box(0.16, sh - 3*u, r2*0.42), glow, mul(M, T(r1*c + 0.03, y + sh/2, 0)));           // tall lit windows on four faces
      else for (let i = 0; i < 3; i++) k.add(box(0.16, 1.6*u, r2*0.36), win, mul(M, T(r1*c + 0.03, y + sh*(0.25 + i*0.25), 0))); }
    for (const f of [0.02, 0.98]) k.add(cyl(r1*1.08, r1*1.08, 0.6*u, 8), trimM, T(0, y + sh*f, 0));
    y += sh;
    const rp = 6.3*u;                                                                                               // the mooring platform
    k.add(cyl(rp, r2, 1.6*u, 12), steel, T(0, y + 0.8*u, 0)); k.add(cyl(rp, rp, 0.5*u, 12), trimM, T(0, y + 1.85*u, 0));
    k.add(torus(rp - 0.15*u, 0.1*u, 12, 4), BRASS(), mul(T(0, y + 3.3*u, 0), RX(PI/2)));
    for (let a = 0; a < 12; a++) { const t = (a + 0.5)*PI/6; k.add(box(0.14*u, 1.3*u, 0.14*u), BRASS(), T(Math.cos(t)*(rp - 0.15*u), y + 2.7*u, Math.sin(t)*(rp - 0.15*u))); }
    for (let a = 0; a < 4; a++) { const t = a*PI/2 + PI/4; k.add(ball(0.32*u, 6, 3), lamp(0xffd27a), T(Math.cos(t)*rp, y + 1.3*u, Math.sin(t)*rp)); }
    y += 2.1*u;
    k.add(cyl(r2*0.82, r2*0.88, 4.4*u, 8), steel, T(0, y + 2.2*u, 0)); k.add(cyl(r2*0.9, r2*0.9, 1.7*u, 8, false), glow, T(0, y + 2.4*u, 0));   // the lantern
    y += 4.4*u;
    k.add(cyl(r2*1.2, r2*1.2, 0.5*u, 12), trimM, T(0, y + 0.25*u, 0)); y += 0.5*u;
    k.add(cyl(r2*0.62, r2*0.95, 3.5*u, 8), steel, T(0, y + 1.75*u, 0)); k.add(cyl(r2*0.14, r2*0.62, 5*u, 8), BRASS(), T(0, y + 6*u, 0)); y += 8.5*u;   // nose cone
    k.add(cyl(0.1*u, 0.2*u, 5*u, 5), STEEL(), T(0, y + 2.5*u, 0)); k.add(bar([0, y - 0.6*u, 0], [0, y - 0.9*u, 3.6*u], 0.2*u), STEEL()); k.add(torus(0.5*u, 0.1*u, 8, 4), BRASS(), T(0, y - 1.4*u, 3.6*u));   // mooring arm and ring
    y += 5*u; k.add(ball(0.75*u, 6, 3), lamp(0xff3b30), T(0, y + 0.4*u, 0));
    mast = {y0:yb, top:y + 1.15*u, r:r0, platform:rp};
  } else if (!PIR) {
  // stepped Deco crown and spire
  k.add(box(w*0.7, 14, w*0.7), wall, T(0, h + 7, 0)); k.add(box(w*0.7 + 1, 1, w*0.7 + 1), trimM, T(0, h + 14, 0));
  k.add(box(w*0.4, 10, w*0.4), wall, T(0, h + 19, 0)); k.add(cyl(0.12, 2.2, 22, 6), BRASS(), T(0, h + 35, 0)); k.add(ball(0.7, 6, 3), lamp(0xff3b30), T(0, h + 46.5, 0));
  } else {
    // a plank deck with a rail, a ship's mast, a crow's nest and the black flag
    const plank = G.mat(0x4a3a2c, {roughness:0.95}), black = G.mat(0x111111, {roughness:0.9}), bone = G.mat(0xe8e0cc, {roughness:0.8});
    k.add(box(w + 6, 0.8, w + 6), plank, T(0, h + 0.4, 0));
    for (let i = 0; i < 16; i++) { const a = i/16*PI*2, r2 = (w + 5)/2; k.add(box(0.4, 2.2, 0.4), trimM, T(Math.cos(a)*r2*1.15*Math.min(1, 1/Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))))/1.15, h + 1.9, Math.sin(a)*r2*Math.min(1, 1/Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)))))); }
    k.add(cyl(0.5, 0.75, 40, 7), trimM, T(0, h + 20, 0)); k.add(bar([-10, h + 26, 0], [10, h + 26, 0], 0.3), trimM);
    k.add(cyl(2.4, 2, 2.6, 9), plank, T(0, h + 33, 0));
    k.add(box(0.2, 7, 11), black, T(0, h + 35, 6)); k.add(box(0.3, 2.2, 2.2), bone, T(0.1, h + 35.6, 6)); k.add(bar([0.2, h + 33.6, 4.4], [0.2, h + 33.6, 7.6], 0.18), bone);
    k.add(ball(0.7, 6, 3), lamp(0xff6a2a), T(0, h + 40.5, 0));
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) k.add(ball(0.55, 6, 3), lamp(0xffa040), T(x*(w/2 + 2), h + 3.4, z*(w/2 + 2)));
  }
  // the skyhook: a drop arm from the gallery ceiling holding the catch-ring in the middle of the opening
  const R = new V3(0, y0 + 10.5, 0);
  k.add(tube([0, y1 - 0.4, 0], [0, R.y + 4.6, 0], 0.35, 6), STEEL()); k.add(bar([0, R.y + 4.6, 0], [0, R.y + 4.3, 0], 1.0), BRASS());
  k.build(g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.32, 6, 18), BRASS()); ring.position.copy(R); ring.castShadow = true; g.add(ring);
  for (let i = 0; i < 8; i++) { const a = i*PI/4, l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), lamp(i % 2 ? 0x9ef0a0 : 0xffd27a)); l.position.set(R.x + Math.cos(a)*4.3, R.y + Math.sin(a)*4.3, 0.3); g.add(l); }
  const nt = nameTex(o.sign || 'HALCYON AERO WORKS', o.signCol || '#2a2420', o.signGlow || '#dba63e');
  if (nt) for (const f of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(30, 3.75), new THREE.MeshBasicMaterial({map:nt, transparent:true, depthWrite:false})); m.position.set(0, y1 + 4, f*(w/2 + 0.15)); m.rotation.y = f > 0 ? 0 : PI; g.add(m); }
  g.userData = {hook:R, ringR:4.2, top:h, w, gallery:{y0, y1, ow}};
  if (mast) g.userData.mast = mast;   // the slender part above the stepped crown (the crown itself stays below top + 22)
  return g;
};

/* ---------- Treasure-hunt landmarks ---------- */
/* Halcyon Point lighthouse: striped tower, gallery, lamp room with a turning beam (userData.beam spins about Y). */
G.buildLighthouse = () => {
  const g = new THREE.Group(), k = new Kit(), red = G.mat(0xb5382c), white = G.mat(0xf1e9d6), rock = G.mat(0x8a8276, {roughness:1});
  k.add(cyl(14, 18, 6, 9), rock, T(0, 1, 0)); k.add(box(12, 6, 9), white, T(14, 3, 0)); k.add(box(13, 0.8, 10), red, T(14, 6.4, 0));
  for (let i = 0; i < 6; i++) k.add(cyl(4.6 - i*0.35, 5 - i*0.35, 6, 12), i % 2 ? red : white, T(0, 4 + 3 + i*6, 0));
  k.add(cyl(3.4, 3.2, 0.6, 12), DARK(), T(0, 40.3, 0)); k.add(cyl(4.6, 4.6, 0.4, 12), DARK(), T(0, 40.8, 0));
  for (let i = 0; i < 12; i++) { const a = i*PI/6; k.add(tube([Math.cos(a)*4.4, 40.9, Math.sin(a)*4.4], [Math.cos(a)*4.4, 42, Math.sin(a)*4.4], 0.05, 3), DARK()); }
  k.add(cyl(2.4, 2.4, 3.2, 10, false), G.mat(0xfff2c4, {emissive:0xffd27a, emissiveIntensity:0.8, transparent:true, opacity:0.75}), T(0, 42.6, 0));
  k.add(lathe([[2.8,44.2],[2.2,45.4],[0.8,46.6],[0.1,47.4]], 10), red);
  k.build(g);
  const beam = new THREE.Group(); beam.position.set(0, 42.6, 0); g.add(beam);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(14, 160, 12, 1, true).rotateZ(PI/2).translate(80, 0, 0), new THREE.MeshBasicMaterial({color:0xfff0c0, transparent:true, opacity:0.12, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending}));
  beam.add(cone); g.userData = {beam, top:47};
  return g;
};

/* A Dutch-style windmill on a hill: tapered octagonal body, thatched cap, four sails (userData.sails spins about local Z). */
G.buildWindmill = () => {
  const g = new THREE.Group(), k = new Kit(), body = G.mat(0xd9c9a4, {roughness:0.9}), cap = G.mat(0x6b4a2b), wood = G.mat(0x7a5a38), cloth = G.mat(0xefe6d2, {side:THREE.DoubleSide});
  k.add(cyl(5.2, 7, 18, 8), body, T(0, 9, 0)); k.add(cyl(7.6, 7.6, 1, 8), wood, T(0, 9, 0));
  k.add(lathe([[5.6,18],[5.2,20],[3.6,23],[0.4,25]], 8), cap);
  k.add(box(2.2, 3.2, 0.2), DARK(), T(0, 1.6, 6.6)); for (const y of [6, 12]) k.add(box(1.4, 1.6, 0.2), WINDOW(), T(0, y, 5.9));
  k.add(tube([0, 21, 4.6], [0, 21, 7.4], 0.5, 6), wood);
  k.build(g);
  const sails = new THREE.Group(), sk = new Kit(); sails.position.set(0, 21, 7.6); g.add(sails);
  for (let i = 0; i < 4; i++) { const A = RZ(i*PI/2); sk.add(box(0.5, 15, 0.4), wood, mul(A, T(0, 8, 0))); sk.add(box(3.4, 11, 0.08), cloth, mul(A, T(1.9, 9.5, 0.2))); }
  sk.build(sails); g.userData = {sails, top:25};
  return g;
};

/* The Meridian: a silver record-racer lying broken on a mountainside, one wing torn off, smoke rising from the cowling. */
G.buildWreckRacer = () => {
  const g = new THREE.Group(), plane = G.buildPlane('gallant', [0xc8ced4, 0x1f3b6b, 0xdba63e]);
  plane.rotation.set(0.32, 0.6, 0.42); plane.position.y = 0.6; g.add(plane);   // nose dug in, one wing low
  const pilot = plane.getObjectByName('pilot'); if (pilot) pilot.visible = false;
  if (plane.userData.prop) plane.userData.prop.rotation.z = 0.4;
  const k = new Kit(), silver = G.mat(0xc8ced4, {metalness:0.4, roughness:0.35});
  k.add(box(4.5, 0.25, 1.6), silver, mul(T(-7, 0.4, -3), RY(1.1), RZ(0.3)));                     // the torn wing, lying apart
  for (let i = 0; i < 7; i++) k.add(box(0.6 + Math.random(), 0.15, 0.4 + Math.random()), silver, T((Math.random() - 0.5)*14, 0.2, (Math.random() - 0.5)*14));
  k.add(box(1.4, 1.0, 1.0), G.mat(0x6b5a3a), T(3, 0.5, -2)); k.add(box(1.5, 0.12, 1.1), G.mat(0x8a6a44), T(3, 1.06, -2));   // the engine crate
  k.build(g); g.userData = {smoke:new V3(0.5, 2.5, 2.5)};
  return g;
};

/* Speed-boost ring for races: a big brass hoop with green lamps and checkered flags, facing local Z. */
G.buildBoostRing = (R = 9) => {
  const g = new THREE.Group(), k = new Kit();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.55, 6, 24), BRASS()); g.add(ring);
  for (let i = 0; i < 12; i++) { const a = i*PI/6; k.add(ball(0.45, 6, 3), lamp(i % 2 ? 0x9ef0a0 : 0xfff2c4), T(Math.cos(a)*R, Math.sin(a)*R, 0.6)); k.add(ball(0.45, 6, 3), lamp(i % 2 ? 0x9ef0a0 : 0xfff2c4), T(Math.cos(a)*R, Math.sin(a)*R, -0.6)); }
  for (const sx of [1, -1]) for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) k.add(box(0.9, 0.9, 0.05), (i + j) % 2 ? INK() : BONE(), T(sx*(R + 1.2 + i*0.9), 1.5 - j*0.9, 0));
  k.build(g); g.userData.R = R; return g;
};

/* ---------- Traffic ---------- */
/* A 1930s sedan or delivery truck: rounded fenders, running boards, a lit headlamp pair. About 5 m long, nose +Z. */
G.buildCar = (hex, truck) => {
  const g = new THREE.Group(), k = new Kit(), body = G.mat(hex, {roughness:0.45, metalness:0.2});
  if (truck) { k.add(box(2.2, 2.4, 3.4), G.mat(0xe8dcc0), T(0, 1.75, -1.2)); k.add(box(2, 1.4, 2.2), body, T(0, 1.25, 1.7)); }
  else { k.add(box(1.9, 0.9, 4.6), body, T(0, 0.95, 0)); k.add(box(1.7, 0.85, 2.4), body, T(0, 1.8, -0.4)); k.add(box(1.72, 0.55, 2.2), G.mat(0x2a3640, {roughness:0.2}), T(0, 1.78, -0.4)); }
  k.add(box(2.1, 0.12, 3.6), DARK(), T(0, 0.55, 0));
  for (const sx of [1, -1]) for (const sz of [1.5, -1.5]) k.add(cyl(0.42, 0.42, 0.3, 8), DARK(), mul(T(sx*0.95, 0.42, sz), RZ(PI/2)));
  for (const sx of [0.6, -0.6]) k.add(ball(0.16, 6, 3), lamp(0xfff2c4), T(sx, 1.05, 2.33));
  k.add(box(1.5, 0.5, 0.15), STEEL(), T(0, 0.95, 2.32));
  k.build(g); return g;
};

/* ---------- Chapter 3 set pieces ---------- */
/* Skull Rock: the Black Lantern's island base. A sea stack whose cliff face reads as a skull, cave hangars at the waterline,
   and the parts the raid needs as separate Groups (returned in userData.targets with local positions). */
G.buildSkullRock = () => {
  const g = new THREE.Group(), k = new Kit(), rock = G.mat(0x6d6459, {roughness:1}), rock2 = G.mat(0x5a5248, {roughness:1}), dark = G.mat(0x1a1716);
  k.add(lathe([[0,-20],[150,-20],[140,0],[120,40],[95,85],[60,118],[20,132],[0,134]], 10), rock);
  for (const [x, z, s] of [[120, 40, 40], [-110, 60, 34], [40, -130, 30], [-80, -100, 26]]) k.add(ball(s, 7, 4), rock2, mul(T(x, 0, z), SC(1, 1.4, 1)));
  // the skull: two eye caves and a nose on the south face, a jaw of cave mouths at the waterline
  for (const sx of [1, -1]) k.add(ball(16, 8, 5), dark, mul(T(sx*30, 82, 82), SC(1, 1.2, 0.5)));
  k.add(poly([[-8, 0], [8, 0], [0, 18]]), dark, mul(T(0, 52, 108), RX(-0.25)));
  for (let i = -3; i <= 3; i++) k.add(box(10, 14, 6), dark, T(i*16, 8, 128 - Math.abs(i)*3));
  // jetty and seaplane ramp
  k.add(box(14, 2, 70), G.mat(0x5a4632), T(70, 1, 150)); k.add(box(40, 1, 30), G.mat(0x45423e), T(-60, 0.6, 140));
  k.build(g);
  const targets = [];
  const add = (kind, label, pos, r, hp, build) => { const tg = new THREE.Group(), tk = new Kit(); tg.position.copy(pos); build(tk, tg); tk.build(tg); g.add(tg); targets.push({kind, label, pos, r, hp, group:tg}); };
  const tankM = G.mat(0x8a2f2f, {roughness:0.6}), steel = STEEL();
  [[60, 2, 160], [90, 2, 160], [-70, 2, 150], [-100, 2, 160]].forEach(([x, y, z], i) => add('tank', `Fuel tank ${i + 1}`, new V3(x, y + 9, z), 10, 160, tk => {
    tk.add(cyl(8, 8, 16, 12), tankM); tk.add(lathe([[8,8],[5,10],[0.5,11]], 12), tankM); tk.add(cyl(8.3, 8.3, 0.6, 12), steel, T(0, 4, 0)); tk.add(cyl(8.3, 8.3, 0.6, 12), steel, T(0, -4, 0));
    tk.add(box(0.4, 18, 0.4), DARK(), T(8.3, 0, 0)); }));
  add('radio', 'Radio tower', new V3(0, 150, 0), 6, 120, tk => {
    tk.add(tube([0, -16, 0], [0, 26, 0], 0.5, 6), steel); for (const y of [0, 12, 22]) tk.add(bar([-5, y, 0], [5, y, 0], 0.3), steel);
    for (const sx of [1, -1]) tk.add(wire([sx*5, 12, 0], [sx*18, -16, sx*6], 0.06), DARK()); tk.add(ball(0.8, 6, 3), lamp(0xff3b30), T(0, 27, 0)); });
  [[70, 95, 40], [-75, 88, -10]].forEach(([x, y, z], i) => add('flak', `Flak tower ${i + 1}`, new V3(x, y + 6, z), 7, 140, tk => {
    tk.add(box(10, 12, 10), rock2, T(0, -6, 0)); tk.add(cyl(4, 4.6, 2, 8), DARK(), T(0, 1, 0)); tk.add(box(3, 2, 3.2), steel, T(0, 2.8, 0));
    for (const sx of [0.6, -0.6]) tk.add(tube([sx, 3, 0.5], [sx, 6.6, 4], 0.25, 6), DARK()); }));
  add('hangar', 'Cave hangar doors', new V3(0, 12, 126), 12, 220, tk => { tk.add(box(30, 20, 2), G.mat(0x4a4038)); tk.add(box(0.6, 20, 2.2), DARK()); for (const sx of [1, -1]) tk.add(ball(0.6, 6, 3), lamp(0xffd27a), T(sx*14, 11, 1.4)); });
  g.userData = {targets};
  return g;
};
/* the geometry kit, for scenery built in other files (Rustwater's city, bridges and balloons) */
/* ---------- Cíbola, the city in the mesa ----------
   A Spanish-colonial town gone Deco, crowded along one side of the runway: back-to-back rows of stucco and adobe houses on a paseo and
   two back streets, a market plaza with a fountain, a mission church, a cantina, pueblo terraces stepping up the cavern wall, and
   El Topo's Palace, a tower with a gilded dome standing as tall as the roof allows. Built in the cavern's own frame (x along the axis
   towards the gate, z across, the floor at y = 0) into one Kit, so it is one mesh per material. Returns the group and the footprints
   to make solid: {x, z, w, d, yaw, top}. o: rx, rz, ceil(x, z) (height of the roof you can hit), pillars [{lx, lz, r}]. */
G.buildCibolaCity = (o = {}) => {
  const g = new THREE.Group(), k = new Kit(), rr = G.rng(1540), pick = a => a[Math.floor(rr()*a.length)], ri = (a, b) => a + rr()*(b - a);
  const rx = o.rx || 330, rz = o.rz || 230, ceil = o.ceil || (() => 95), pillars = o.pillars || [], solids = [], taken = [];
  const fit = new G.Fittings({day:o.night ? 0 : 0.3}), LC = G.LAMP, FEST = [LC.WARM, LC.AQUA, LC.WARM, LC.PINK, LC.WARM, LC.AMBER];   // it is always dusk under the rock
  const M = (hex, r = 0.9) => G.mat(hex, {roughness:r});
  const WALLS = [0xe6d8bc, 0xdcc39a, 0xd2a878, 0xe0cfa6, 0xcf9c6c, 0xd8b488].map(h => M(h)), ADOBE = [0xc28a5c, 0xb67a4e, 0xcf9a68].map(h => M(h, 0.95)), TILE = [M(0xa6452b, 0.8), M(0x8f3a26, 0.8)];
  const wood = M(0x4a3424), trim = M(0xefe4c8), turq = M(0x2f8f8a, 0.7), stone = M(0x8f7a62, 0.95), pave = M(0x8a6e52, 1), flag = M(0xb39a78, 1), red = M(0xb5382c), yel = M(0xe0b040);
  const lit = G.mat(0x3b3424, {roughness:0.3, emissive:0xffc45a, emissiveIntensity:1.0}), unlit = M(0x2b2118, 0.5);
  const gold = G.mat(0xd9a82e, {roughness:0.3, metalness:0.4, emissive:0xff9a20, emissiveIntensity:0.3}), glow = lamp(0xffd27a), pink = lamp(0xff4f8a), aqua = lamp(0x4fe0d0);
  const rect = (w, h) => { const a = []; quad(a, [-w/2, -h/2, 0], [w/2, -h/2, 0], [w/2, h/2, 0], [-w/2, h/2, 0]); return a; };
  const at = (B, x, y, z) => [B[0]*x + B[1]*y + B[2]*z + B[3], B[4]*x + B[5]*y + B[6]*z + B[7], B[8]*x + B[9]*y + B[10]*z + B[11]];
  const face = (B, f, w, d) => mul(B, RY(f*PI/2), T(0, 0, (f % 2 ? w : d)/2));                          // a wall of a w x d block: 0 front (+z), 1 +x, 2 back, 3 -x
  const dome = (r, h, n = 10, m = 4) => { const rings = []; for (let i = 0; i <= m; i++) { const a = i/m*PI/2, ring = []; for (let j = 0; j < n; j++) { const t = (j + 0.5)*2*PI/n; ring.push([Math.cos(t)*r*Math.max(0.02, Math.cos(a)), Math.sin(a)*h, Math.sin(t)*r*Math.max(0.02, Math.cos(a))]); } rings.push(ring); } return loft(rings); };
  const inside = (x, z, m = 0) => Math.hypot(x/(rx - m), z/(rz - m)) < 0.955 && pillars.every(q => Math.hypot(x - q.lx, z - q.lz) > q.r*2.9 + 4 + m);
  const fits = (x0, x1, z0, z1, m = 2) => inside(x0, z0, m) && inside(x1, z0, m) && inside(x0, z1, m) && inside(x1, z1, m) && inside((x0 + x1)/2, (z0 + z1)/2, m + Math.hypot(x1 - x0, z1 - z0)*0.3) && !taken.some(t => x0 < t[1] && x1 > t[0] && z0 < t[3] && z1 > t[2]);
  const roofOver = (x, z, r) => Math.min(ceil(x, z), ceil(x - r, z - r), ceil(x + r, z - r), ceil(x - r, z + r), ceil(x + r, z + r));
  const solid = (x, z, w, d, yaw, top) => solids.push({x, z, w, d, yaw, top});
  /* windows on one wall: a row a floor, most of them lit */
  const windows = (F, fw, y0, floors, fh, pl = 0.62, ww = 1.15, wh = 1.7) => { const n = Math.max(1, Math.floor((fw - 1)/3.3));
    for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) { if (rr() < 0.16) continue; k.add(rect(ww, wh), rr() < pl ? lit : unlit, mul(F, T((i + 0.5 - n/2)*fw/n*0.92, y0 + fl*fh + fh*0.56, 0.05))); } };
  /* a town house: stucco under tiles or a flat roof, or an adobe block with its roof beams poking out. Front is local +z. */
  const house = (X, Z, w, d, floors, yaw, h2 = {}) => {
    const B = mul(T(X, 0, Z), RY(yaw)), fh = 3.5, h = floors*fh + 0.7, pueblo = h2.pueblo ?? rr() < 0.28, wall = h2.wall || (pueblo ? pick(ADOBE) : pick(WALLS)), sides = h2.sides || [0, 2];
    k.add(box(w, h, d), wall, mul(B, T(0, h/2, 0))); let top = h;
    const tiled = !pueblo && (h2.tiled ?? rr() < 0.55);
    if (tiled) { const along = w >= d, L = (along ? w : d)/2 + 0.6, S = (along ? d : w)/2 + 0.6, rh = Math.min(3.4, S*0.5), hip = rr() < 0.4 ? Math.min(L - 0.6, S*0.8) : 0;
      k.add(loft([[[-L, 0, -S], [L, 0, -S], [L, 0, S], [-L, 0, S]], [[-(L - hip), rh, -0.12], [L - hip, rh, -0.12], [L - hip, rh, 0.12], [-(L - hip), rh, 0.12]]]), pick(TILE), mul(B, T(0, h, 0), RY(along ? 0 : PI/2))); top = h + rh; }
    else { if (!pueblo) k.add(box(w + 0.5, 0.5, d + 0.5), rr() < 0.5 ? trim : TILE[0], mul(B, T(0, h - 0.05, 0)));
      if (rr() < 0.4) { const pw = ri(2.6, 4), px = ri(-1, 1)*(w/2 - pw/2 - 0.4), pz = ri(-1, 1)*(d/2 - pw/2 - 0.4); k.add(box(pw, 2.5, pw), wall, mul(B, T(px, h + 1.25, pz))); k.add(rect(0.9, 1.9), wood, mul(B, T(px, h + 1, pz + pw/2 + 0.04))); top = h + 2.5; }   // a stair hut on the roof
      if (pueblo) { const n = Math.min(5, Math.floor(w/2.6)); for (let i = 0; i < n; i++) k.add(box(0.3, 0.3, 1.1), wood, mul(B, T((i + 0.5 - n/2)*w/n, h - 0.9, d/2 + 0.3))); } }
    for (const f of sides) windows(face(B, f, w, d), f % 2 ? d : w, 0, floors, fh, f === 0 ? 0.7 : 0.5);
    const F0 = face(B, 0, w, d), dx = ri(-0.3, 0.3)*w;
    k.add(rect(1.5, 2.5), rr() < 0.4 ? turq : wood, mul(F0, T(dx, 1.25, 0.08)));
    if (h2.arcade ?? (floors > 1 && rr() < 0.3)) { const n = Math.max(2, Math.round(w/3.4));   // a portal: a tiled lean-to on posts along the street
      k.add(box(w, 0.3, 2.7), pick(TILE), mul(F0, T(0, 3.25, 1.3), RX(0.14))); for (let i = 0; i <= n; i++) k.add(box(0.34, 3.1, 0.34), wood, mul(F0, T(-w/2 + 0.3 + i*(w - 0.6)/n, 1.55, 2.4))); }
    else if (floors > 1 && rr() < 0.45) { const bw = Math.min(w - 1.5, ri(3.5, 7)), bx = ri(-1, 1)*(w - bw)/2*0.8, by = fh + 0.25 + (floors > 2 && rr() < 0.4 ? fh : 0);   // a balcony
      k.add(box(bw, 0.22, 1.2), wood, mul(F0, T(bx, by, 0.6))); k.add(box(bw, 0.12, 0.1), wood, mul(F0, T(bx, by + 1, 1.15))); for (const e of [-1, 1]) k.add(box(0.12, 1, 0.12), wood, mul(F0, T(bx + e*(bw/2 - 0.06), by + 0.5, 1.15)));
      k.add(rect(1.2, 2.1), lit, mul(F0, T(bx, by + 1.2, 0.07))); }
    else if (rr() < 0.4) k.add(box(Math.min(w - 1, 3.6), 0.12, 1.7), pick([red, turq, yel, trim]), mul(F0, T(dx, 2.9, 0.8), RX(0.42)));   // a shop awning
    if (rr() < 0.55) fit.lantern(at(F0, dx + 1.3, 2.75, 0.6), {s:0.8, yaw, wall:at(F0, dx + 1.3, 2.75, 0)});   // a lantern on a bracket by the door
    solid(X, Z, w, d, yaw, top); return top;
  };

  /* ----- the plan ----- */
  const PX0 = -18, PX1 = 46, PZ0 = 96, PZ1 = 126, TX = -40, TZ = 111, CX = 65, CZ = 111;   // plaza, tower, church
  taken.push([TX - 18, PX0, PZ0, PZ1], [PX0, PX1, PZ0 - 0.5, PZ1 + 0.5], [PX1, CX + 17, PZ0, PZ1]);

  /* El Topo's Palace: an arcaded podium, a ribbed Deco shaft, two setbacks, a lit lantern and a gilded dome */
  { const H = Math.min(70, roofOver(TX, TZ, 9) - 14), s = H/70, Y = v => v*s, B = T(TX, 0, TZ), cream = WALLS[0], ochre = WALLS[1];
    const pw = 30, ph = Y(11.5), sw = 17, s0 = ph, s1 = Y(44), uw = 12.5, u1 = Y(53.5), l1 = Y(60);
    k.add(box(pw, ph, pw), cream, mul(B, T(0, ph/2, 0))); k.add(box(pw + 0.8, 0.7, pw + 0.8), TILE[0], mul(B, T(0, ph, 0)));
    for (let f = 0; f < 4; f++) { const F = face(B, f, pw, pw); windows(F, pw, Y(3.6), 2, Y(3.6), 0.85, 1.4, 2);
      k.add(box(pw, 0.3, 3), TILE[1], mul(F, T(0, Y(3.7), 1.45), RX(0.14))); for (let i = 0; i <= 8; i++) k.add(box(0.45, Y(3.6), 0.45), trim, mul(F, T(-pw/2 + 0.4 + i*(pw - 0.8)/8, Y(1.8), 2.7)));   // the arcade
      for (let i = 0; i < 8; i++) k.add(rect(2.3, Y(2.6)), i % 2 ? lit : unlit, mul(F, T(-pw/2 + (i + 0.5)*pw/8, Y(1.5), 0.05)));
      const c = at(mul(B, RY(f*PI/2)), pw/2 - 2.2, 0, pw/2 - 2.2); k.add(cyl(1.9, 1.9, Y(3), 8), cream, T(c[0], ph + Y(1.5), c[2])); k.add(dome(2.2, 2.2, 8, 3), gold, T(c[0], ph + Y(3), c[2]));   // a cupola on each corner
      fit.bulb([c[0], ph + Y(3) + 2.1, c[2]], LC.WARM, 0.34, {up:true, big:true}); }
    k.add(box(sw, s1 - s0, sw), ochre, mul(B, T(0, (s0 + s1)/2, 0))); k.add(box(sw + 0.7, 0.6, sw + 0.7), TILE[0], mul(B, T(0, s0 + (s1 - s0)*0.5, 0)));
    for (let f = 0; f < 4; f++) { const F = face(B, f, sw, sw), nf = Math.floor((s1 - s0 - 2)/3.5);
      for (let i = 0; i < 4; i++) k.add(box(0.9, s1 - s0 + (i === 0 || i === 3 ? 2.5 : 4.2), 0.55), trim, mul(F, T(-sw/2 + 0.45 + i*(sw - 0.9)/3, (s0 + s1)/2 + 1.2, 0.2)));   // the ribs run up past the parapet
      for (let c = 0; c < 3; c++) for (let fl = 0; fl < nf; fl++) k.add(rect(2.4, 2.1), rr() < 0.72 ? lit : unlit, mul(F, T(-sw/2 + 0.45 + (c + 0.5)*(sw - 0.9)/3, s0 + 2.4 + fl*3.5, 0.05))); }
    k.add(box(sw + 0.5, 0.8, sw + 0.5), trim, mul(B, T(0, s1, 0)));
    k.add(box(uw, u1 - s1, uw), cream, mul(B, T(0, (s1 + u1)/2, 0))); k.add(box(uw + 0.6, 0.7, uw + 0.6), gold, mul(B, T(0, u1, 0)));
    for (let f = 0; f < 4; f++) { const F = face(B, f, uw, uw); for (let c = 0; c < 3; c++) k.add(rect(2, u1 - s1 - 3.2), glow, mul(F, T((c - 1)*3.6, (s1 + u1)/2 + 0.2, 0.05)));
      for (const e of [-1, 1]) { const c = at(mul(B, RY(f*PI/2)), e*(sw/2 - 1.3), 0, sw/2 - 1.3); if (e > 0) { k.add(box(2.2, Y(5), 2.2), cream, T(c[0], s1 + Y(2.5), c[2])); k.add(cyl(0, 1.7, 2.4, 4), gold, mul(T(c[0], s1 + Y(5) + 1.2, c[2]), RY(PI/4))); fit.bulb([c[0], s1 + Y(5) + 2.3, c[2]], LC.WARM, 0.34, {up:true, big:true}); } } }
    k.add(cyl(5.1, 5.1, l1 - u1, 8), cream, mul(B, T(0, (u1 + l1)/2, 0))); for (let i = 0; i < 8; i++) k.add(rect(2.3, l1 - u1 - 2), glow, mul(B, RY(i*PI/4), T(0, (u1 + l1)/2, 5.1*Math.cos(PI/8) + 0.05)));   // the lantern, lit from within
    k.add(cyl(6, 6, 0.7, 8), gold, mul(B, T(0, l1, 0))); k.add(dome(5.3, Y(6.2), 12, 5), gold, mul(B, T(0, l1 + 0.3, 0)));
    k.add(cyl(0.12, 0.5, H - l1 - Y(6.2), 6), gold, mul(B, T(0, (H + l1 + Y(6.2))/2, 0))); k.add(ball(0.7, 6, 4), lamp(0xffe9a8), mul(B, T(0, H - 0.4, 0)));
    for (let i = 0; i < 16; i++) { const a = i/16*2*PI; fit.bulb([TX + Math.cos(a)*6.3, l1 + 0.45, TZ + Math.sin(a)*6.3], LC.WARM, 0.18, {up:true, drop:0.45}); }   // bulbs on stalks round each cornice
    for (let i = 0; i < 24; i++) { const u = (i % 6 + 0.5)/6 - 0.5, f = Math.floor(i/6), c = at(mul(B, RY(f*PI/2)), u*(sw + 0.6), 0, sw/2 + 0.5); fit.bulb([c[0], s1 + 0.45, c[2]], LC.WARM, 0.18, {up:true, drop:0.45}); }
    for (let i = 0; i < 40; i++) { const u = (i % 10 + 0.5)/10 - 0.5, f = Math.floor(i/10), c = at(mul(B, RY(f*PI/2)), u*(pw + 0.8), 0, pw/2 + 0.6); fit.bulb([c[0], ph + 0.45, c[2]], LC.WARM, 0.18, {up:true, drop:0.45}); }
    k.add(box(13, 3, 0.4), M(0x2a1c18), mul(B, T(pw/2 - 0.1, ph + 2.6, 0), RY(PI/2))); k.add(box(13.6, 0.25, 0.5), pink, mul(B, T(pw/2 - 0.1, ph + 4.2, 0), RY(PI/2))); k.add(box(13.6, 0.25, 0.5), pink, mul(B, T(pw/2 - 0.1, ph + 1, 0), RY(PI/2)));
    g.userData.signs = [{text:'EL TOPO PALACE', w:12, h:1.5, x:TX + pw/2 + 0.2, y:ph + 2.6, z:TZ, yaw:PI/2}];
    solid(TX, TZ, pw + 2, pw + 2, 0, ph + 0.5); solid(TX, TZ, sw, sw, 0, s1 + 4); solid(TX, TZ, uw, uw, 0, u1 + 0.5); solid(TX, TZ, 11, 11, 0, H);
    g.userData.tower = {x:TX, z:TZ, h:H, w:sw}; const lt = new THREE.PointLight(0xffc070, 0.9, 240, 1.5); lt.position.set(TX + 12, Math.min(H - 6, l1 + 2), TZ - 12); g.add(lt); }

  /* the mission church on the east side of the plaza: curved gable, one bell tower, tiled nave */
  { const B = mul(T(CX, 0, CZ), RY(-PI/2)), wh = WALLS[0];   // front (+z here) faces the plaza
    k.add(box(14, 10, 24), wh, mul(B, T(0, 5, -1))); k.add(loft([[[-7.6, 0, -13.4], [7.6, 0, -13.4], [7.6, 0, 11], [-7.6, 0, 11]], [[-0.1, 4, -13.4], [0.1, 4, -13.4], [0.1, 4, 11], [-0.1, 4, 11]]]), TILE[0], mul(B, T(0, 10, 0)));
    k.add(box(17, 13, 1.4), wh, mul(B, T(0, 6.5, 11.6))); k.add(box(11, 3, 1.4), wh, mul(B, T(0, 14.5, 11.6))); k.add(box(5.5, 2.4, 1.4), wh, mul(B, T(0, 17.2, 11.6))); k.add(cyl(2.75, 2.75, 1.4, 10), wh, mul(B, T(0, 18.3, 11.6), RX(PI/2)));
    k.add(box(17.5, 0.5, 1.8), TILE[1], mul(B, T(0, 13.1, 11.6))); k.add(box(0.35, 3.4, 0.35), gold, mul(B, T(0, 22.6, 11.6))); k.add(box(1.8, 0.35, 0.35), gold, mul(B, T(0, 23.2, 11.6)));
    k.add(rect(3.2, 4.8), wood, mul(B, T(0, 2.4, 12.36))); k.add(rect(4.2, 5.4), turq, mul(B, T(0, 2.7, 12.33))); k.add(disc(1.5, 10), lit, mul(B, T(0, 9.6, 12.36))); k.add(rect(1.4, 1.6), unlit, mul(B, T(0, 15, 12.36))); k.add(cyl(0.5, 0.75, 0.9, 6), gold, mul(B, T(0, 14.9, 12.2)));
    for (let i = 0; i < 3; i++) k.add(box(9 + i*1.6, 0.4, 1.2 + i*1.1), stone, mul(B, T(0, 1 - i*0.4, 12.9 + i*0.55)));
    for (const f of [1, 3]) windows(face(mul(B, T(0, 0, -1)), f, 14, 24), 24, 3.6, 1, 4, 0.8, 1.1, 2.6);
    const BT = mul(B, T(-10.2, 0, 8.4)); k.add(box(6, 19, 6), wh, mul(BT, T(0, 9.5, 0))); k.add(box(6.6, 0.6, 6.6), TILE[1], mul(BT, T(0, 19, 0)));
    for (const [ex, ez] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) k.add(box(1.1, 4.4, 1.1), wh, mul(BT, T(ex*2.2, 21.4, ez*2.2)));
    k.add(box(5.6, 0.7, 5.6), wh, mul(BT, T(0, 23.9, 0))); k.add(dome(2.9, 3, 8, 3), TILE[0], mul(BT, T(0, 24.2, 0))); k.add(box(0.3, 2.6, 0.3), gold, mul(BT, T(0, 28.4, 0))); k.add(box(1.4, 0.3, 0.3), gold, mul(BT, T(0, 28.9, 0)));
    k.add(cyl(0.5, 1.15, 1.7, 8), gold, mul(BT, T(0, 21.6, 0))); for (let f = 0; f < 4; f++) { const F = face(BT, f, 6, 6); windows(F, 6, 5, 3, 4.4, 0.5, 0.9, 1.8); }
    fit.lantern(at(BT, 0, 22.3, 0), {s:1.5, hang:1.0}); for (const e of [-1, 1]) fit.lantern(at(B, e*3.2, 5.4, 12.9), {s:1.15, wall:at(B, e*3.2, 5.4, 12.05)});
    solid(CX + 0.5, CZ, 26, 15, 0, 14.5); solid(CX - 11.6, CZ, 2.4, 17, 0, 19.5); const c = at(BT, 0, 0, 0); solid(c[0], c[2], 6.4, 6.4, 0, 29.5); }

  /* the plaza: flagstones, a fountain, market stalls under striped awnings */
  { k.add(box(PX1 - PX0 + 10, 0.24, PZ1 - PZ0), flag, T((PX0 + PX1)/2 + 0.5, 0.1, (PZ0 + PZ1)/2)); const fx = (PX0 + PX1)/2, fz = (PZ0 + PZ1)/2;
    k.add(cyl(4.4, 4.7, 0.9, 10), stone, T(fx, 0.6, fz)); k.add(cyl(3.8, 3.8, 0.1, 10), turq, T(fx, 1.08, fz)); k.add(cyl(0.45, 0.7, 3, 6), stone, T(fx, 2.4, fz)); k.add(cyl(1.7, 0.5, 0.5, 8), stone, T(fx, 3.9, fz)); k.add(ball(0.5, 6, 4), gold, T(fx, 4.6, fz));
    const AW = [red, turq, yel, trim];
    for (let i = 0; i < 10; i++) { const sx = PX0 + 6 + (i % 5)*(PX1 - PX0 - 12)/4, sz = i < 5 ? PZ0 + 5.5 : PZ1 - 5.5, e = i < 5 ? 1 : -1; if (Math.abs(sx - fx) < 5) continue; const B = mul(T(sx, 0, sz), RY(e > 0 ? 0 : PI)), c1 = pick(AW), c2 = pick(AW);
      for (let j = 0; j < 4; j++) k.add(box(1.05, 0.1, 3.4), j % 2 ? c1 : c2, mul(B, T(-1.58 + j*1.05, 2.9, 0), RX(0.2)));
      for (const [px, pz, ph] of [[-2, -1.5, 3.2], [2, -1.5, 3.2], [-2, 1.5, 2.6], [2, 1.5, 2.6]]) k.add(box(0.14, ph, 0.14), wood, mul(B, T(px, ph/2, pz)));
      k.add(box(3.6, 0.9, 1.4), wood, mul(B, T(0, 0.45, 0))); k.add(box(1, 0.5, 0.9), pick([red, yel, M(0x6a8a3a), M(0xd9742a)]), mul(B, T(ri(-1, 1), 1.15, 0))); fit.bulb(at(B, 0, 2.82, 1.55), LC.AMBER, 0.2, {drop:0.3}); }
    { const cn = [[PX0, PZ0], [PX1, PZ0], [PX1, PZ1], [PX0, PZ1]];   // festoons from the corner poles up to the mast on the fountain, and round the square
      cn.forEach(([x, z], i) => { fit.festoon([x, 8.9, z], [fx, 13.8, fz], {sag:2.6, every:1.9, cols:FEST}); const q = cn[(i + 1) % 4]; fit.festoon([x, 8.9, z], [q[0], 8.9, q[1]], {sag:i % 2 ? 1.3 : 2.2, every:2.1, cols:[LC.WARM, LC.WARM, LC.AMBER]}); fit.lantern([x, 9.3, z], {s:1.3}); }); }
    k.add(cyl(0.16, 0.2, 9.4, 5), wood, T(fx, 4.7 + 4.6, fz)); for (const [x, z] of [[PX0, PZ0], [PX1, PZ0], [PX0, PZ1], [PX1, PZ1]]) k.add(cyl(0.14, 0.2, 9, 5), wood, T(x, 4.5, z));
    const lt = new THREE.PointLight(0xffb060, 1.0, 230, 1.5); lt.position.set(fx, 16, fz); g.add(lt); }

  /* pueblo terraces built into the wall: blocks stepping up and back, ladders from roof to roof */
  { let t = 0.5; while (t < PI - 0.3) { const W = ri(15, 25), ct = Math.cos(t), sn = Math.sin(t), wx = ct*rx*0.965, wz = sn*rz*0.965, nl = Math.hypot(ct/rx, sn/rz), nx = -ct/rx/nl, nz = -sn/rz/nl;
      const dt = (W + 0.6)/Math.hypot(rx*sn, rz*ct), tm = t + dt/2; t += dt; const cm = Math.cos(tm), sm = Math.sin(tm), ox = cm*rx*0.965, oz = sm*rz*0.965, yaw = Math.atan2(nx, nz);
      const n = 2 + Math.floor(rr()*2.6), step = ri(5.5, 7.5), front = 7 + (n - 1)*step, fc = [ox + nx*front, oz + nz*front];
      if (fc[1] < 60 || oz + nz*front - Math.abs(nx)*W/2 < 59 || pillars.some(q => Math.hypot(ox + nx*front/2 - q.lx, oz + nz*front/2 - q.lz) < q.r*2.9 + 6 + Math.hypot(W, front)/2)) continue;
      const B = mul(T(ox, 0, oz), RY(yaw)), col = pick(ADOBE); let y0 = 0, hw = Math.hypot(W, front + 12)/2;
      taken.push([ox + nx*(front - 12)/2 - hw*0.8, ox + nx*(front - 12)/2 + hw*0.8, oz + nz*(front - 12)/2 - hw*0.8, oz + nz*(front - 12)/2 + hw*0.8]);
      for (let i = 0; i < n; i++) { const fz = 7 + (n - 1 - i)*step, y1 = (i + 1)*3.9 + 0.5, w = W - i*ri(0.5, 2.5), bx = i ? ri(-1, 1)*(W - w)/2 : 0, c = i % 2 && rr() < 0.5 ? pick(ADOBE) : col, F = mul(B, T(bx, 0, fz));
        k.add(box(w, y1, fz + 12), c, mul(B, T(bx, y1/2, (fz - 12)/2)));
        const nw = Math.max(1, Math.floor(w/3.6)); for (let j = 0; j < nw; j++) { const x = (j + 0.5 - nw/2)*w/nw*0.9; if (rr() < 0.3) k.add(rect(1.3, 2.3), rr() < 0.4 ? turq : wood, mul(F, T(x, y0 + 1.2, 0.05))); else if (rr() < 0.85) k.add(rect(1, 1.2), rr() < 0.65 ? lit : unlit, mul(F, T(x, y0 + 2.2, 0.05))); }
        for (let j = 0; j < 3; j++) k.add(box(0.3, 0.3, 1.1), wood, mul(F, T((j - 1)*w*0.3, y1 - 0.95, 0.3)));
        if (i && rr() < 0.6) { const lx = ri(-1, 1)*(w/2 - 1.5); for (const e of [-0.3, 0.3]) k.add(bar([lx + e, y0, 1.7], [lx + e, y1 + 0.9, 0.15], 0.12), wood, F); }
        if (rr() < 0.7) { const lx2 = ri(-1, 1)*w*0.35; fit.lantern(at(F, lx2, y0 + 2.8, 0.55), {s:0.75, yaw, wall:at(F, lx2, y0 + 2.8, 0)}); }
        const c0 = at(B, bx, 0, (fz - 12)/2); solid(c0[0], c0[2], w, fz + 12, yaw, y1); y0 = y1; }
      if (rr() < 0.4) { const sx = ri(-1, 1)*(W/2 - 2); for (let j = 0; j < 5; j++) k.add(box(2.6, 0.88*(5 - j), 1.05), stone, mul(B, T(sx, 0.44*(5 - j), front + 0.52 + j*1.05))); }   // steps up to the first roof
    } }

  /* the cantina, facing the plaza across the paseo: neon round the door */
  { taken.push([3.5, 24.5, 76, 88.5]); const B = T(14, 0, 82.25); house(14, 82.25, 20, 11.5, 2, 0, {arcade:true, wall:WALLS[4], pueblo:false, tiled:false, sides:[0, 1, 2, 3]}); k.add(box(9, 2.2, 0.3), M(0x2a1c18), mul(B, T(0, 9, 5.95))); for (const y of [7.75, 10.25]) k.add(box(9.6, 0.22, 0.4), pink, mul(B, T(0, y, 6))); for (const e of [-1, 1]) k.add(box(0.22, 2.7, 0.4), aqua, mul(B, T(e*4.7, 9, 6)));
    g.userData.signs.push({text:'CANTINA LA GILA', w:8.4, h:1.05, x:14, y:9, z:88.45, yaw:0}); }

  /* the rows: houses back to back in blocks, between the paseo, two back streets and the cross streets */
  const cross = []; { let x = -262; while (x < 250) { x += ri(34, 52); cross.push(x); x += 6; } }
  const ROWS = [[63.5, 75, PI, 1, 2], [76.5, 88, 0, 1, 3], [96, 110, PI, 2, 4], [111.5, 126, 0, 2, 4], [132, 145, PI, 1, 3], [146.5, 159, 0, 1, 3], [165, 177, PI, 1, 3], [178.5, 190, 0, 1, 2], [195.5, 207, PI, 1, 2]];
  let nHouse = 0;
  for (const [z0, z1, yaw, f0, f1] of ROWS) { let x = -266, ci = 0, run = [];
    const flush = () => { run.forEach((h, i) => { const sides = [0, 2]; if (i === 0 || run[i - 1].x1 < h.x0 - 1.5 || run[i - 1].fl < h.fl) sides.push(yaw ? 1 : 3); if (i === run.length - 1 || run[i + 1].x0 > h.x1 + 1.5 || run[i + 1].fl < h.fl) sides.push(yaw ? 3 : 1);
        house((h.x0 + h.x1)/2, h.zc, h.x1 - h.x0, h.d, h.fl, yaw, {sides, arcade:h.arc}); nHouse++; }); run = []; };
    while (x < 252) { while (ci < cross.length && cross[ci] + 6 <= x) ci++;
      if (ci < cross.length && x >= cross[ci] && x < cross[ci] + 6) { flush(); x = cross[ci] + 6; ci++; continue; }
      let w = ri(10, 19); const lim = ci < cross.length ? cross[ci] : 252; if (x + w > lim - 4) w = lim - x; if (w < 6) { x = lim; continue; }
      const dz = z1 - z0 - ri(0, 2.5), zc = yaw ? z1 - dz/2 : z0 + dz/2, x0 = x + 0.15, x1 = x + w - 0.15; x += w;
      if (!fits(x0, x1, zc - dz/2, zc + dz/2)) { flush(); continue; }
      const near = Math.max(0, 1 - Math.hypot(x0 + w/2 - TX, zc - TZ)/150), fl = Math.max(1, Math.min(Math.round(f0 + rr()*(f1 - f0) + near*near*2.4*rr()), Math.floor((roofOver((x0 + x1)/2, zc, 8) - 22)/3.5), z0 < 70 ? 2 : 6));
      run.push({x0, x1, zc, d:dz, fl, arc:(z0 === 76.5 || z0 === 96) ? rr() < 0.6 : undefined}); }
    flush(); }

  /* streets and lamps */
  const xr = z => (rx - 4)*0.95*Math.sqrt(Math.max(0, 1 - (z/((rz - 4)*0.955))**2));
  for (const [z, w0] of [[92, 8.4], [129, 6.4], [162, 6.4]]) { let a = -xr(z + 4) + 6, b = xr(z + 4) - 6; for (const q of pillars) if (Math.abs(q.lz - z) < q.r*2.9 + 6) { if (q.lx > 0) b = Math.min(b, q.lx - q.r*2.9 - 4); else a = Math.max(a, q.lx + q.r*2.9 + 4); }
    k.add(box(b - a, 0.2, w0), pave, T((a + b)/2, 0.06, z)); if (z === 92) g.userData.paseo = {z, a, b};
    for (let x = a + 8; x < b - 4; x += z === 92 ? 17 : 26) { if (z === 92 && x > PX0 - 4 && x < PX1 + 4) continue; const z0 = z - w0/2 - 0.35, z1 = z + w0/2 + 0.35; for (const zz of [z0, z1]) k.add(cyl(0.08, 0.13, 8.2, 5), wood, T(x, 4.1, zz));   // a string across the street between two poles
      fit.festoon([x, 8, z0], [x, 8, z1], {sag:1.1, every:1.2, cols:((x/17) | 0) % 3 === 0 ? FEST : [LC.WARM]}); if (z === 92) fit.lantern([x, 5.6, z0 + 0.75], {s:1.1, wall:[x, 5.6, z0]}); } }
  for (const cx of cross) { const z1 = Math.min(212, (rz - 6)*0.955*Math.sqrt(Math.max(0, 1 - ((Math.abs(cx) + 6)/((rx - 6)*0.955))**2)) - 10); if (z1 > 70 && inside(cx + 3, 66, 4) && !(cx + 6 > TX - 18 && cx < CX + 17)) k.add(box(5.2, 0.2, z1 - 61), pave, T(cx + 3, 0, (z1 + 61)/2)); }
  for (let x = -250; x <= 240; x += 22) if (inside(x, 60, 6)) { k.add(box(0.22, 4.2, 0.22), wood, T(x, 2.1, 60)); fit.lantern([x, 4.68, 60], {s:1.25}); }   // a row of lanterns along the field
  for (const q of pillars) if (q.lz > 0) { const m = 16, hk = (i, r) => { const a = i/m*2*PI; return [q.lx + Math.cos(a)*r, 7.8, q.lz + Math.sin(a)*r]; };   // swags pegged to the rock
    for (let i = 0; i < m; i++) { fit.festoon(hk(i, q.r*2.2), hk(i + 1, q.r*2.2), {sag:0.8, every:2.2, cols:[LC.WARM, LC.AMBER]}); k.add(bar(hk(i, q.r*2.2), hk(i, q.r*1.7), 0.1), wood); } }   // and round the foot of the pillars that stand in town

  let tris = 0; for (const a of k.b.values()) tris += a.length/9;
  k.build(g);
  fit.build(g); tris += fit.tris;
  for (const s of g.userData.signs) { const nt = nameTex(s.text, '#ffd76a', '#ff6a8a'); if (!nt) continue; const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({map:nt, transparent:true, depthWrite:false})); m.position.set(s.x, s.y, s.z); m.rotation.y = s.yaw; g.add(m); }
  Object.assign(g.userData, {solids, tris, houses:nHouse, bulbs:fit.count.bulbs + fit.count.lanterns});
  return g;
};
/* ---------- light fittings ----------
   Lamps as the thirties hung them: festoons of small bulbs on sagging flex, bulbs on stalks along a cornice, and lanterns in iron housings
   (a cap, a glass, a foot) on posts, wall brackets or chains. Every lamp gets a soft halo so it reads from the air and after dark.
   Everything is merged: one mesh per material and two point clouds for the halos. day: 0 after dark or underground, 1 in broad daylight. */
let HALO = null;
function haloTex(){
  if (HALO) return HALO;
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), gr = x.createRadialGradient(N/2, N/2, 0, N/2, N/2, N/2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, N, N); return (HALO = new THREE.CanvasTexture(c));
}
const gem = (r, h, n = 4) => { const R = (q, y) => { const p = []; for (let j = 0; j < n; j++) { const a = (j + 0.5)*2*PI/n; p.push([Math.cos(a)*q, y, Math.sin(a)*q]); } return p; }; return loft([R(0, -h*0.58), R(r, 0), R(0, h*0.42)], false, false); };
G.LAMP = {WARM:0xffd890, AMBER:0xffb347, AQUA:0x5fe0d0, PINK:0xff6f9a, RED:0xff5a48, WHITE:0xfff1d0};
G.Fittings = class {
  constructor(o = {}){
    this.k = new Kit(); this.day = o.day || 0; this.h = [[], []]; this.hc = [[], []]; this.count = {bulbs:0, lanterns:0, spans:0};
    this.iron = G.mat(0x1d1b19, {roughness:0.75, metalness:0.2}); this.cord = G.mat(0x15120f, {roughness:0.9});
  }
  glass(hex){ const d = 1 - 0.2*this.day; return lamp((Math.round((hex >> 16 & 255)*d) << 16) | (Math.round((hex >> 8 & 255)*d) << 8) | Math.round((hex & 255)*d)); }
  halo(p, hex, big){ const i = big ? 1 : 0; this.h[i].push(p[0], p[1], p[2]); this.hc[i].push((hex >> 16 & 255)/255, (hex >> 8 & 255)/255, (hex & 255)/255); }
  wire(a, b, r = 0.04){ if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > 1e-3) this.k.add(tube(a, b, r, 3, false), this.cord); }
  /* a bulb in its socket: hanging `drop` below p (a point on a wire), or standing on a stalk at p (up) */
  bulb(p, hex = G.LAMP.WARM, r = 0.22, o = {}){
    const up = o.up, d = o.drop === undefined ? (up ? 0.5 : 0.28) : o.drop, e = up ? 1 : -1, ys = p[1] + e*d, yc = ys + e*(r*0.3 + r*0.7);
    if (d > 0.02) this.wire([p[0], up ? p[1] - d : p[1], p[2]], [p[0], up ? p[1] : ys, p[2]], Math.max(0.03, r*0.14));
    this.k.add(cyl(r*0.42, r*0.42, r*0.6, 3, false), this.iron, T(p[0], up ? p[1] + r*0.3 : ys, p[2]));
    const c = [p[0], up ? p[1] + r*0.6 + r*0.75 : yc, p[2]]; this.k.add(gem(r, r*2.3), this.glass(hex), up ? T(c[0], c[1], c[2]) : mul(T(c[0], c[1], c[2]), RX(PI)));
    this.halo(c, hex, o.big); this.count.bulbs++; return c;
  }
  /* a string of bulbs on flex between two fixings, sagging `sag` in the middle; cols repeat along it */
  festoon(a, b, o = {}){
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(2, Math.round(L/(o.every || 1.8))), sag = o.sag === undefined ? L*0.08 : o.sag, cols = o.cols || [G.LAMP.WARM], r = o.r || 0.22;
    const P = t => [a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t - 4*sag*t*(1 - t), a[2] + (b[2] - a[2])*t]; let q = a;
    for (let i = 1; i <= n; i++) { const p = P(i/n); this.wire(q, p, o.wr || 0.04); if (i < n) this.bulb(p, cols[(i - 1) % cols.length], r, {drop:0.01}); q = p; }
    this.count.spans++;
  }
  /* a lantern, its glass centred on p and about 0.6 s tall. hang: on a chain that long; wall: on a bracket from that point of a wall; otherwise it stands (on a post) */
  lantern(p, o = {}){
    const s = o.s || 1, hex = o.hex || G.LAMP.AMBER, [x, y, z] = p, top = y + 0.57*s, M = mul(T(x, y, z), RY(o.yaw || 0));
    this.k.add(cyl(0.3*s, 0.2*s, 0.62*s, 4, false), this.glass(hex), M);
    this.k.add(cyl(0.05*s, 0.43*s, 0.26*s, 4, false), this.iron, mul(M, T(0, 0.44*s, 0))); this.k.add(cyl(0.25*s, 0.17*s, 0.11*s, 4), this.iron, mul(M, T(0, -0.365*s, 0)));
    if (o.hang) { this.wire([x, top, z], [x, top + o.hang, z], Math.max(0.035, 0.035*s)); }
    else if (o.wall) { const w = o.wall, ya = top + 0.22*s, t = 0.06*s + 0.02;
      this.k.add(bar([w[0], ya, w[2]], [x, ya, z], t), this.iron); if (s >= 1) { this.wire([x, ya, z], [x, top - 0.02, z], 0.03*s + 0.01); this.wire([w[0], ya - 0.55*s, w[2]], [(w[0] + x)/2, ya, (w[2] + z)/2], 0.03*s + 0.01); } }
    else this.k.add(cyl(0.05*s, 0.05*s, 0.12*s, 4), this.iron, mul(M, T(0, 0.62*s, 0)));
    this.halo(p, hex, s >= 1.4); this.count.lanterns++;
  }
  get tris(){ let n = 0; for (const a of this.k.b.values()) n += a.length/9; return n; }
  build(g){
    this.k.build(g);
    for (const i of [0, 1]) { if (!this.h[i].length) continue; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(this.h[i], 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(this.hc[i], 3));
      const size = i ? 7 : 2.2, pts = new THREE.Points(geo, new THREE.PointsMaterial({size, map:haloTex(), vertexColors:true, transparent:true, opacity:(i ? 0.6 : 0.5)*(1 - 0.62*this.day), blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true}));
      pts.frustumCulled = false; pts.userData.halo = size; g.add(pts); }
    g.userData.fittings = this.count; return g;
  }
};

/* ==== SHIPS BEGIN ==== */
/* ---------- Surface ships: tramp steamers, tugs, packets, trawlers, a gunboat, schooners, a pirate galleon, a yacht ----------
   Frame: bow +Z, up +Y, port +X, origin on the waterline amidships. G.buildShip(kind, o) returns a Group whose userData
   carries what traffic.js needs: boxes (solid hull and upperworks, local [cx, cy, cz, hx, hy, hz]), masts (thin capsules
   [ax, ay, az, bx, by, bz, r]), funnels (smoke points), pad ({x, y, z, r}: a landing stage for the Whirligig) and the
   overall len / beam / top. o.pad adds the landing stage on the types that carry one well (freighter, steamer, yacht:
   never the sailing ships); o.night adds lamp halos. */
const SHIP_SAIL = (c, belly, n = 3, th = 0.04) => {
  // a sail between four corners (tack, clew, peak, throat), bellied along `belly`; both faces, a hair apart
  const o = [], P = (u, v, s) => { const a = [0, 1, 2].map(i => (c[0][i]*(1 - u) + c[1][i]*u)*(1 - v) + (c[3][i]*(1 - u) + c[2][i]*u)*v), f = Math.sin(PI*u)*Math.sin(PI*(0.15 + 0.85*v)*0.95); return [a[0] + belly[0]*f + s*belly[0]*th, a[1] + belly[1]*f, a[2] + belly[2]*f + s*belly[2]*th]; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const u0 = i/n, u1 = (i + 1)/n, v0 = j/n, v1 = (j + 1)/n;
    for (const s of [1, -1]) { const a = P(u0, v0, s), b = P(u1, v0, s), d = P(u1, v1, s), e = P(u0, v1, s);
      // face the side the belly points to with the front faces, the other with the back
      const nx = (b[1] - a[1])*(e[2] - a[2]) - (b[2] - a[2])*(e[1] - a[1]), ny = (b[2] - a[2])*(e[0] - a[0]) - (b[0] - a[0])*(e[2] - a[2]), nz = (b[0] - a[0])*(e[1] - a[1]) - (b[1] - a[1])*(e[0] - a[0]);
      const out = (nx*belly[0] + ny*belly[1] + nz*belly[2])*s > 0;
      if (out) { tri(o, a, b, d); tri(o, a, d, e); } else { tri(o, a, d, b); tri(o, a, e, d); } } }
  return o;
};
const rect = (w, h) => poly([[-w/2, -h/2], [w/2, -h/2], [w/2, h/2], [-w/2, h/2]]);
function shipParts(k, ud, night){
  const A = {};
  const WOOD = G.mat(0x8a5a32, {roughness:0.6}), ROPE = G.mat(0xa8946a, {roughness:1}), IRON = G.mat(0x2e2c2a, {roughness:0.7, metalness:0.25}), WHITE = G.mat(0xe9e4d6, {roughness:0.6}), CANVAS = G.mat(0xcfc3a2, {roughness:0.95});
  Object.assign(A, {WOOD, ROPE, IRON, WHITE, CANVAS});
  /* the hull: stations stern to bow {z, b half-beam at the deck, d deck height, w waterline fraction, k draught there, bw bulwark};
     bands [fa, fb, mat] slice it into paint strakes between two heights (functions of the station) */
  A.hull = (S, o) => {
    const wl = o.wl ?? 0.9, dr = st => st.k ?? o.draft;
    const hb = (st, y) => { const w = st.w ?? wl; if (y >= 0) return st.b*(w + (1 - w)*Math.min(1, y/Math.max(0.2, st.d))); const t = Math.min(1, -y/Math.max(0.05, dr(st))); return st.b*w*(1 - 0.62*t*t); };
    const cl = (st, y) => Math.max(-dr(st), Math.min(st.d, y));
    for (const [fa, fb, mat] of o.bands) k.add(loft(S.map(st => { const ya = cl(st, fa(st)), yb = cl(st, fb(st)), a = hb(st, ya), b = hb(st, yb); return [[-a, ya, st.z], [a, ya, st.z], [b, yb, st.z], [-b, yb, st.z]]; })), mat);
    k.add(loft(S.map(st => { const b = Math.max(0.03, st.b - 0.14); return [[-b, st.d - 0.4, st.z], [b, st.d - 0.4, st.z], [b, st.d + 0.04, st.z], [-b, st.d + 0.04, st.z]]; })), o.deck);
    for (const s of [1, -1]) { let run = [];
      const flush = () => { if (run.length > 1) k.add(loft(run.map(st => { const b = st.b, bi = Math.max(0.01, b - 0.16), h = st.bw ?? o.bw ?? 0; return [[s*b, st.d - 0.05, st.z], [s*b, st.d + h, st.z], [s*bi, st.d + h, st.z], [s*bi, st.d - 0.05, st.z]]; })), o.bulwark || o.bands[o.bands.length - 1][2]); run = []; };
      for (const st of S) { if ((st.bw ?? o.bw ?? 0) > 0) run.push(st); else flush(); } flush(); }
    ud.len = S[S.length - 1].z - S[0].z; ud.bow = S[S.length - 1].z; ud.stern = S[0].z; ud.beam = 2*Math.max(...S.map(st => st.b));
    return {hb, at:z => { for (let i = 0; i < S.length - 1; i++) if (z <= S[i + 1].z) { const t = (z - S[i].z)/Math.max(1e-6, S[i + 1].z - S[i].z); return {b:S[i].b + (S[i + 1].b - S[i].b)*t, d:S[i].d + (S[i + 1].d - S[i].d)*t}; } return S[S.length - 1]; }};
  };
  A.solid = (cx, cy, cz, hx, hy, hz) => ud.boxes.push([cx, cy, cz, hx, hy, hz]);
  /* a deckhouse: walls, an overhanging roof, a row of windows down each side and across the front */
  A.house = (x, y, z, w, h, d, mat, o = {}) => {
    k.add(box(w, h, d), mat, T(x, y + h/2, z));
    if (o.roof) k.add(box(w + (o.over ?? 0.5), 0.16, d + (o.over ?? 0.5)), o.roof, T(x, y + h + 0.08, z));
    const wm = o.win || WINDOW(), wy = y + h*(o.wy ?? 0.62), wh = o.wh ?? h*0.34;
    if (o.n) { const ww = o.ww ?? d/o.n*0.55; for (let i = 0; i < o.n; i++) { const zz = z - d/2 + (i + 0.5)*d/o.n; k.add(rect(ww, wh), wm, onSide(x + w/2 + 0.03, wy, zz)); k.add(rect(ww, wh), wm, mul(T(x - w/2 - 0.03, wy, zz), RY(-PI/2))); } }
    if (o.nf) { const ww = o.wwf ?? w/o.nf*0.62; for (let i = 0; i < o.nf; i++) { const xx = x - w/2 + (i + 0.5)*w/o.nf; k.add(rect(ww, wh), wm, T(xx, wy, z + d/2 + 0.03)); if (o.back) k.add(rect(ww, wh), wm, mul(T(xx, wy, z - d/2 - 0.03), RY(PI))); } }
    if (o.solid !== false) A.solid(x, y + h/2, z, w/2, h/2, d/2);
  };
  A.ports = (x, y, z0, z1, n, r = 0.2, m) => { for (let i = 0; i < n; i++) { const zz = z0 + (i + 0.5)*(z1 - z0)/n; k.add(disc(r, 6), m || WINDOW(), onSide(x + 0.03, y, zz)); k.add(disc(r, 6), m || WINDOW(), mul(T(-x - 0.03, y, zz), RY(-PI/2))); } };
  /* a funnel: base colour, company band, black top, raked aft */
  A.funnel = (x, y, z, r, h, rake, cols, o = {}) => {
    const M = mul(T(x, y, z), RX(-rake)), n = o.n || 10, b0 = o.b0 ?? 0.52, b1 = o.b1 ?? 0.74, seg = (a, b, m, rr = r) => k.add(cyl(rr, rr, (b - a)*h, n, false), m, mul(M, T(0, (a + b)/2*h, 0)));
    seg(0, b0, G.mat(cols[0], {roughness:0.55})); seg(b0, b1, G.mat(cols[1], {roughness:0.55})); seg(b1, 1, G.mat(cols[2], {roughness:0.7}));
    k.add(cyl(r*1.06, r*1.06, 0.12, n), IRON, mul(M, T(0, h, 0))); k.add(cyl(r*1.05, r*1.05, 0.1, n), IRON, mul(M, T(0, b1*h, 0)));
    k.add(disc(r*0.9, n), INK(), mul(M, T(0, h + 0.07, 0), RX(-PI/2)));
    if (o.mark) k.both(o.mark(r*0.5), G.mat(o.markCol || 0xf1e9d6), mul(M, T(0, (b0 + b1)/2*h, 0), RY(PI/2), T(0, 0, r*0.94)));
    if (o.pipe !== false) k.add(tube([0, h*0.2, r + 0.14], [0, h*1.04, r + 0.14], 0.07, 4), STEEL(), M);
    const top = [x, y + h*Math.cos(rake) + 0.3, z - h*Math.sin(rake)]; ud.funnels.push(top);
    A.solid(x, y + h/2, z - h*Math.sin(rake)/2, r, h/2, r + h*Math.sin(rake)/2);
    return top;
  };
  A.mast = (x, y0, z, h, r, mat, rake = 0, solid = true) => {
    const top = [x, y0 + h*Math.cos(rake), z - h*Math.sin(rake)]; k.add(tube([x, y0, z], top, r, 6, true, r*0.55), mat);
    if (solid) ud.masts.push([x, y0, z, top[0], top[1], top[2], Math.max(0.5, r + 0.3)]); return top;
  };
  A.stay = (a, b, r = 0.045) => k.add(wire(a, b, r), IRON);
  A.shrouds = (top, z, b, d, n = 2) => { for (const s of [1, -1]) for (let i = 0; i < n; i++) A.stay(top, [s*b, d, z + (i - (n - 1)/2)*1.3 - 0.6]); };
  /* an open boat in chocks or under davits */
  A.boat = (x, y, z, len, side, o = {}) => {
    const w = len*0.17, R = (zz, f, yb) => [[-w*f, 0.5, zz], [w*f, 0.5, zz], [w*f*0.5, yb, zz], [-w*f*0.5, yb, zz]];
    const M = T(x, y, z); k.add(loft([R(-len/2, 0.55, 0.12), R(-len/4, 1, -0.1), R(len/4, 1, -0.1), R(len/2 - 0.3, 0.5, 0.1), R(len/2, 0.06, 0.32)]), o.hull || WHITE, M);
    k.add(box(w*1.7, 0.07, len*0.9), o.cover || CANVAS, mul(M, T(0, 0.53, -0.1)));
    if (o.davits !== false) for (const dz of [-len*0.36, len*0.36]) { k.add(bar([x - side*w*1.3, y - 0.5, z + dz], [x - side*w*1.3, y + 1.5, z + dz], 0.1), IRON); k.add(bar([x - side*w*1.3, y + 1.5, z + dz], [x, y + 1.3, z + dz], 0.1), IRON); k.add(wire([x, y + 1.3, z + dz], [x, y + 0.5, z + dz], 0.03), IRON); }
  };
  A.vent = (x, y, z, h, r, yaw = 0, col = 0xe9e4d6) => {
    k.add(cyl(r*0.7, r*0.7, h, 6, false), G.mat(col), T(x, y + h/2, z));
    const M = mul(T(x, y + h, z), RY(yaw), RX(PI/2)); k.add(cyl(r*1.25, r*0.75, r*1.5, 8, false), G.mat(col), mul(M, T(0, r*0.4, -r*0.3))); k.add(disc(r*1.2, 8), G.mat(0xb5382c), mul(T(x, y + h, z), RY(yaw), T(0, r*0.3, r*1.1)));
  };
  A.rail = (pts, h = 1, both = true, mat = IRON) => {
    const add = both ? (t, m) => k.both(t, m) : (t, m) => k.add(t, m);
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; add(tube(p, [p[0], p[1] + h, p[2]], 0.04, 3, false), mat);
      if (i) { const q = pts[i - 1]; add(bar([q[0], q[1] + h, q[2]], [p[0], p[1] + h, p[2]], 0.07), mat); add(wire([q[0], q[1] + h*0.5, q[2]], [p[0], p[1] + h*0.5, p[2]], 0.025), mat); } }
  };
  A.railRun = (x0, x1, y, z0, z1, n, h = 1, both = true) => { const p = []; for (let i = 0; i <= n; i++) p.push([x0 + (x1 - x0)*i/n, y, z0 + (z1 - z0)*i/n]); A.rail(p, h, both); };
  A.hatch = (y, z, w, d, tarp = 0x7a6a4a) => { k.add(box(w, 0.7, d), IRON, T(0, y + 0.35, z)); k.add(box(w + 0.2, 0.22, d + 0.2), G.mat(tarp, {roughness:0.95}), T(0, y + 0.8, z)); for (const dz of [-d*0.3, 0, d*0.3]) k.add(box(w + 0.3, 0.08, 0.14), WOOD, T(0, y + 0.94, z + dz)); A.solid(0, y + 0.45, z, w/2, 0.5, d/2); };
  A.winch = (x, y, z) => { k.add(box(1.5, 0.3, 1.1), IRON, T(x, y + 0.15, z)); k.add(cyl(0.34, 0.34, 1.2, 6), G.mat(0x4a4e52, {metalness:0.3}), mul(T(x, y + 0.62, z), RZ(PI/2))); for (const s of [1, -1]) k.add(cyl(0.5, 0.5, 0.1, 8), IRON, mul(T(x + s*0.6, y + 0.62, z), RZ(PI/2))); };
  A.flag = (x, y, z, w, h, layers) => { let i = 0; for (const [fw, fh, oy, col] of layers) { k.add(SHIP_SAIL([[x, y + oy, z - i*0.001], [x, y + oy, z - fw], [x, y + oy + fh, z - fw], [x, y + oy + fh, z]], [0.25 + i*0.03, 0, 0], 2, 0.03 + i*0.012), G.mat(col, {roughness:0.9})); i++; } };
  /* navigation lights: port red, starboard green, a white masthead and stern light */
  A.navLights = (b, y, z, mastTop, sternP) => {
    k.add(box(0.28, 0.34, 0.5), lamp(0xff3b30), T(b, y, z)); k.add(box(0.28, 0.34, 0.5), lamp(0x3aff6a), T(-b, y, z)); k.both(box(0.1, 0.5, 0.7), IRON, T(b - 0.2, y, z));
    if (mastTop) k.add(ball(0.24, 6, 3), lamp(0xfff1d0), T(mastTop[0], mastTop[1] - 0.8, mastTop[2] + 0.3));
    if (sternP) k.add(ball(0.2, 6, 3), lamp(0xfff1d0), T(...sternP));
    ud.lights.push([b, y, z, 0xff3b30], [-b, y, z, 0x3aff6a]); if (mastTop) ud.lights.push([mastTop[0], mastTop[1] - 0.8, mastTop[2] + 0.3, 0xfff1d0, 1]); if (sternP) ud.lights.push([...sternP, 0xfff1d0]);
  };
  /* the landing stage: a timber platform on trestles with a painted ring and an H (or a skull), lamps at the corners */
  A.pad = (y, z, w, d, o = {}) => {
    const deck = G.mat(o.deck || 0x9a8056, {roughness:0.9}), paintM = G.mat(o.paint || 0xf2c14e, {roughness:0.7}), r = Math.min(w, d)/2 - 0.5;
    k.add(box(w, 0.3, d), deck, T(0, y - 0.15, z)); k.add(box(w + 0.3, 0.18, 0.3), IRON, T(0, y - 0.1, z - d/2)); k.add(box(w + 0.3, 0.18, 0.3), IRON, T(0, y - 0.1, z + d/2)); k.both(box(0.3, 0.18, d), IRON, T(w/2, y - 0.1, z));
    for (let i = 1; i < 6; i++) k.add(box(w - 0.1, 0.02, 0.07), G.mat(0x6a5436, {roughness:1}), T(0, y + 0.012, z - d/2 + i*d/6));
    k.add(ring(r - 0.55, r, 18), paintM, onTop(0, y + 0.03, z));
    if (o.skull) k.decal(mul(onTop(0, y + 0.035, z), SC(r*0.62, r*0.62, 1)), skull(G.mat(0x9e1b1b)).slice(2));
    else { k.both(box(0.5, 0.02, r*0.95), paintM, T(r*0.36, y + 0.035, z)); k.add(box(r*0.72, 0.02, 0.5), paintM, T(0, y + 0.035, z)); }
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { if (o.legs) k.add(bar([sx*(w/2 - 0.4), o.legs[0], z + sz*(d/2 - 0.4)], [sx*(w/2 - 0.4), y - 0.3, z + sz*(d/2 - 0.4)], 0.28), o.legMat || WOOD); if (o.braceTo) k.add(bar([sx*(w/2 - 0.5), y - 0.3, z + sz*(d/2 - 0.5)], [sx*o.braceTo[0], o.braceTo[1], z + sz*(d/2 - 2.2)], 0.2), o.legMat || WOOD);
      k.add(box(0.3, 0.3, 0.3), lamp(o.lamp || 0xffb347), T(sx*(w/2 - 0.15), y + 0.2, z + sz*(d/2 - 0.15))); ud.lights.push([sx*(w/2 - 0.15), y + 0.2, z + sz*(d/2 - 0.15), o.lamp || 0xffb347]); }
    if (o.sock !== false) { const sx = w/2 - 0.2, sz = z + d/2 - 0.3; k.add(tube([sx, y, sz], [sx, y + 2.6, sz], 0.05, 4), IRON); k.add(tube([sx, y + 2.5, sz], [sx - 1.5, y + 2.3, sz - 0.2], 0.24, 5, false, 0.1), G.mat(0xe0742a, {roughness:0.9})); }
    ud.pad = {x:0, y, z, r:r + 0.5, w, d}; A.solid(0, y - 0.5, z, w/2, 0.5, d/2);
  };
  A.gun = (x, y, z, len, r, yaw = 0, shield) => {
    const M = mul(T(x, y, z), RY(yaw)); k.add(cyl(0.5, 0.65, 0.7, 8), IRON, mul(M, T(0, 0.35, 0)));
    if (shield) k.add(loft([[[-1.1, 0.5, -0.5], [1.1, 0.5, -0.5], [1.1, 2.1, -0.5], [-1.1, 2.1, -0.5]], [[-0.8, 0.7, 0.9], [0.8, 0.7, 0.9], [0.7, 1.9, 0.7], [-0.7, 1.9, 0.7]]]), shield, M);
    k.add(tube([0, 1.3, 0.2], [0, 1.55, 0.2 + len], r, 6), G.mat(0x4a4e52, {metalness:0.35, roughness:0.4}), M);
  };
  return A;
}
const SHIP_BUILD = {};
const yf = y => () => y, deckf = (o = 0) => st => st.d + o;

/* Tramp steamer: three-island freighter, black hull, buff upperworks, a tall funnel with the company band, masts and derricks over four hatches. */
SHIP_BUILD.freighter = (k, ud, A, o) => {
  const P = o.paint || [0x1b1a1a, 0x8e231c, 0xd9b44a], hullM = G.mat(P[0], {roughness:0.75}), boot = G.mat(0x7a2a20, {roughness:0.8}), deckM = G.mat(0x6a4436, {roughness:0.9}), buff = G.mat(0xd8c9a0, {roughness:0.6}), stripe = G.mat(0xe9e4d6, {roughness:0.6});
  const S = [{z:-32, b:2.7, d:4.6, w:0.35, k:0.6}, {z:-29, b:3.9, d:4.5, w:0.75, k:2.6}, {z:-23, b:4.6, d:4.4}, {z:-22.95, b:4.6, d:2.6, bw:1}, {z:-7, b:4.8, d:2.6, bw:1}, {z:-6.95, b:4.8, d:4.4}, {z:7, b:4.8, d:4.4}, {z:7.05, b:4.8, d:2.6, bw:1}, {z:20, b:4.5, d:2.7, bw:1}, {z:20.05, b:4.5, d:4.6, bw:0.5}, {z:26, b:3.3, d:4.9, w:0.8, bw:0.5}, {z:30, b:1.5, d:5.2, w:0.6, bw:0.5}, {z:32.5, b:0.12, d:5.4, w:0.5, k:3.2, bw:0.5}];
  A.hull(S, {draft:3.6, bands:[[yf(-9), yf(0.5), boot], [yf(0.5), deckf(-0.45), hullM], [deckf(-0.45), deckf(), stripe]], deck:deckM, bulwark:hullM});
  A.solid(0, 1.2, -1, 4.8, 2.6, 30); A.solid(0, 3.4, 26, 3.4, 1.6, 6); A.solid(0, 3.5, -27.5, 4.2, 1.2, 5);
  // centre castle: accommodation, boat deck, wheelhouse with bridge wings
  A.house(0, 4.4, 0, 7.8, 2.5, 12.4, A.WHITE, {roof:G.mat(0x8a7a5a, {roughness:0.9}), over:1.6, n:7, wh:0.7, ww:0.5});
  A.house(0, 7.06, 3.4, 5.2, 2.3, 3.6, A.WOOD, {roof:A.WHITE, over:0.7, n:2, nf:5, wh:0.9, wy:0.6});
  k.both(box(2.6, 0.14, 2.2), A.WHITE, T(3.6, 7.1, 3.6)); k.both(box(0.1, 1, 2.2), A.CANVAS, T(4.85, 7.6, 3.6)); k.both(box(2.4, 1, 0.1), A.CANVAS, T(3.7, 7.6, 4.7));
  A.railRun(4.6, 4.6, 7.06, -6, 2.4, 5); A.railRun(2.5, 2.5, 9.5, 1.8, 5, 2, 0.9);
  const ft = A.funnel(0, 7.0, -2.2, 1.35, 7.4, 0.07, [P[0], P[1], 0x151312], {mark:r => star(r*1.3, r*0.55), markCol:P[2]});
  k.both(wire([0, ft[1] - 1.5, ft[2]], [3.6, 7.2, -5.6], 0.035), A.IRON);
  A.boat(3.9, 7.7, -3.6, 6, 1); A.boat(-3.9, 7.7, -3.6, 6, -1);
  for (const [x, z, yw] of [[2.3, 0.6, 0], [-2.3, 0.6, 0], [1.6, -5.2, PI], [-1.6, -5.2, PI]]) A.vent(x, 7.06, z, 1.9, 0.42, yw, 0xd8c9a0);
  // masts, derricks and hatches in the two well decks
  for (const [mz, hz] of [[13.6, [10.3, 17]], [-15, [-11.2, -18.9]]]) {
    k.add(box(3, 1.7, 2.4), buff, T(0, 3.45, mz)); A.solid(0, 3.45, mz, 1.5, 0.85, 1.2);
    const top = A.mast(0, 4.2, mz, 13.6, 0.3, buff); k.add(box(3.4, 0.16, 0.3), buff, T(0, 13.2, mz)); k.add(cyl(0.5, 0.5, 0.12, 8), buff, T(0, 11, mz));
    for (const s of [1, -1]) { k.add(tube([s*0.7, 4.5, mz + s*0.5], [s*1.3, 10.6, mz + s*6.3], 0.16, 5, true, 0.1), buff); A.stay([0, 12.9, mz], [s*1.3, 10.6, mz + s*6.3], 0.03); A.winch(s*1.9, 2.6, mz + s*0.2); }
    A.shrouds([0, top[1] - 1.2, mz], mz, 4.7, 3.6, 2);
    for (const z of hz) A.hatch(2.6, z, 4.6, 4.8);
  }
  A.stay([0, 17.4, 13.6], [0, 6.2, 31.5]); A.stay([0, 17.4, 13.6], [0, 17.4, -15], 0.03);
  // fo'c'sle: windlass, anchors, jackstaff
  A.winch(0, 4.7, 24); k.both(box(0.5, 0.9, 1.3), A.IRON, mul(T(2.1, 4.1, 29.3), RY(-0.33))); k.add(tube([0, 5.3, 31.6], [0, 7.6, 31.9], 0.05, 4), A.IRON);
  A.railRun(4.45, 0.3, 4.75, 20.2, 32, 6, 0.9); A.railRun(4.7, 4.7, 4.4, 5.5, 6.8, 1);
  if (o.pad) { A.pad(6.6, -28, 12, 11.4, {legs:[4.4], braceTo:[4.2, 3.2]}); k.add(bar([0, 4.4, -23.6], [0, 6.4, -22.2], 0.5, 1.2), A.WOOD); }
  else { A.house(0, 4.45, -27, 5.4, 2.2, 5.4, A.WHITE, {roof:G.mat(0x8a7a5a), n:3, wh:0.6}); A.railRun(4.4, 2.6, 4.5, -23.2, -31.8, 5, 0.9); k.add(tube([0, 4.6, -31.6], [0, 8.4, -32.6], 0.05, 4), A.IRON); A.flag(0, 6.6, -32.2, 0, 0, [[2.1, 1.3, 0, P[1]], [0.9, 0.5, 0.7, 0xf1e9d6]]); A.stay([0, 17.2, -15], [0, 6.8, -27]); }
  A.navLights(4.9, 7.9, 4.7, [0, 17.8, 13.6], [0, o.pad ? 5 : 6.9, -32.3]); ud.top = 18.2;
};

/* Harbour tug: beamy and low, a varnished wheelhouse, a funnel far too tall for her, tyres along the rail and a rope pudding on the stem. */
SHIP_BUILD.tug = (k, ud, A, o) => {
  const P = o.paint || [0x1d1c1b, 0xb5382c, 0xe9e4d6], hullM = G.mat(P[0], {roughness:0.8}), boot = G.mat(0x6a2620), deckM = G.mat(0x7a6a52, {roughness:0.95}), red = G.mat(P[1], {roughness:0.7});
  const S = [{z:-12, b:2.5, d:1.4, w:0.6, k:1}, {z:-9, b:3.2, d:1.25}, {z:-2, b:3.35, d:1.3}, {z:4, b:3.25, d:1.7}, {z:8, b:2.5, d:2.3, w:0.8}, {z:11, b:1.15, d:2.8, w:0.6}, {z:12.3, b:0.16, d:3, w:0.5}];
  A.hull(S, {draft:2.4, bw:0.75, bands:[[yf(-9), yf(0.35), boot], [yf(0.35), deckf(-0.5), hullM], [deckf(-0.5), deckf(), red]], deck:deckM, bulwark:hullM});
  A.solid(0, 0.4, 0, 3.3, 1.9, 12);
  for (const z of [-8, -4.5, -1, 2.5, 6]) { const b = z > 4 ? 3.05 : 3.42; k.both(torus(0.52, 0.17, 8, 4), INK(), mul(T(b + 0.14, z > 4 ? 1.5 : 0.95, z), RY(PI/2 + (z > 4 ? -0.3 : 0)))); }
  k.add(ball(1, 7, 4), A.ROPE, mul(T(0, 2.5, 12.1), SC(1.5, 0.95, 0.75))); k.both(ball(0.6, 6, 3), A.ROPE, T(1.5, 2.3, 10.9));
  A.house(0, 1.35, 1.6, 4.3, 2.1, 7.2, A.WHITE, {solid:true}); A.ports(2.15, 2.5, -1.6, 4.8, 4, 0.24);
  A.house(0, 3.45, 3.4, 3.3, 2.1, 3.2, A.WOOD, {roof:A.WHITE, over:0.7, n:2, nf:3, back:true, wh:0.85, wy:0.58});
  A.funnel(0, 3.45, -0.6, 0.78, 4.3, 0.05, [P[0], P[1], 0x151312], {b0:0.45, b1:0.7, mark:r => rect(r*1.5, r*0.5), markCol:P[2]});
  const mt = A.mast(0, 5.7, 3, 2.7, 0.1, A.WOOD, 0, false); k.add(ball(0.42, 6, 3), lamp(0xfff1d0), T(0, 6.0, 4.5)); k.add(box(0.5, 0.5, 0.5), A.IRON, T(0, 5.9, 4.3)); ud.lights.push([0, 6, 4.6, 0xfff1d0, 1]);
  A.vent(1.3, 3.45, -2, 1.3, 0.3, 0, P[1]); A.vent(-1.3, 3.45, -2, 1.3, 0.3, 0, P[1]);
  // the towing deck: bitts, hook, two tow beams, a coil of hawser
  for (const z of [-5.2, -8.2]) { k.both(bar([2.9, 1.3, z], [2.2, 2.9, z], 0.2), A.IRON); k.add(bar([-2.2, 2.9, z], [2.2, 2.9, z], 0.22), A.IRON); }
  k.both(cyl(0.2, 0.2, 1.1, 6), A.IRON, T(0.6, 1.85, -3.4)); k.add(box(1.7, 0.2, 0.2), A.IRON, T(0, 2.1, -3.4)); k.add(torus(0.75, 0.2, 8, 4), A.ROPE, mul(T(-1.3, 1.5, -10), RX(PI/2))); k.add(torus(0.5, 0.2, 8, 4), A.ROPE, mul(T(-1.3, 1.8, -10), RX(PI/2)));
  k.add(wire([0, 2.1, -3.4], [0, 1.9, -11.8], 0.07), A.ROPE);
  A.navLights(2.2, 4.9, 3.4, mt, [0, 2.3, -11.9]); ud.top = 8.5;
};

/* Coastal packet: a white two-decker with lit saloon windows, two raked funnels, six boats under davits and a sun deck aft. */
SHIP_BUILD.steamer = (k, ud, A, o) => {
  const P = o.paint || [0xe9e4d6, 0x1f4d7a, 0xe2c27a], hullM = G.mat(P[0], {roughness:0.6}), boot = G.mat(0x2f5d3a, {roughness:0.8}), band = G.mat(P[1], {roughness:0.6}), deckM = G.mat(0xb89a6a, {roughness:0.9});
  const S = [{z:-30, b:2.8, d:3.6, w:0.4, k:0.7}, {z:-27, b:4.2, d:3.4, w:0.8, k:2.4}, {z:-18, b:4.9, d:3.2}, {z:14, b:4.9, d:3.2}, {z:22, b:3.8, d:3.6, w:0.8}, {z:27, b:2, d:4, w:0.6}, {z:30.5, b:0.12, d:4.3, w:0.5}];
  A.hull(S, {draft:3.2, bw:0.9, bands:[[yf(-9), yf(0.45), boot], [yf(0.45), deckf(-0.5), hullM], [deckf(-0.5), deckf(-0.15), band], [deckf(-0.15), deckf(), hullM]], deck:deckM, bulwark:hullM});
  A.solid(0, 1, 0, 4.9, 2.6, 30); A.ports(4.75, 1.9, -24, 20, 16, 0.2);
  A.house(0, 3.2, -5, 8.4, 2.5, 38, A.WHITE, {n:17, wh:1.1, ww:1.25, nf:4, back:true});
  k.add(box(10.2, 0.2, 39), deckM, T(0, 5.8, -5)); k.add(box(10.3, 0.12, 39.1), A.WHITE, T(0, 5.66, -5));
  for (let z = -23.5; z <= 13.5; z += 3.7) k.both(tube([4.95, 3.3, z], [4.95, 5.6, z], 0.06, 4, false), A.WHITE);
  A.railRun(5, 5, 5.9, -24.4, 14.4, 12, 1);
  A.house(0, 5.9, -1, 6.8, 2.4, 22, A.WHITE, {n:9, wh:1, ww:1.4, nf:3, back:true});
  k.add(box(8.6, 0.18, 23.4), G.mat(0x8a7a5a, {roughness:0.9}), T(0, 8.4, -1)); A.solid(0, 8.4, -1, 4.3, 0.2, 11.7);
  A.house(0, 8.5, 8.2, 4.8, 2.3, 3.8, A.WOOD, {roof:A.WHITE, over:0.8, n:2, nf:5, wh:0.9});
  k.both(box(2.2, 0.12, 1.8), A.WHITE, T(3.2, 8.56, 8.6)); k.both(box(0.08, 0.9, 1.8), A.CANVAS, T(4.3, 9.05, 8.6));
  for (const z of [2.2, -6.4]) A.funnel(0, 8.5, z, 1.15, 6, 0.13, [P[2], P[1], 0x151312], {b0:0.5, b1:0.72, mark:r => disc(r*0.8, 10)});
  for (const z of [4.2, -2.4, -9]) { A.boat(3.75, 9.1, z, 5.4, 1); A.boat(-3.75, 9.1, z, 5.4, -1); }
  for (const [x, z] of [[1.9, 5.3], [-1.9, 5.3], [1.9, -2.4], [-1.9, -2.4]]) A.vent(x, 8.5, z, 1.6, 0.36, 0, P[2]);
  const f = A.mast(0, 3.4, 19.5, 14.5, 0.24, A.WOOD, 0.06); A.stay(f, [0, 4.6, 29.8]); A.shrouds([f[0], f[1] - 2, f[2]], 19, 4.3, 4.2, 2); k.add(tube([0, 5, 19.2], [0, 9, 26], 0.12, 5), A.WOOD);
  const m = A.mast(0, 8.5, -11, 9.6, 0.2, A.WOOD, 0.08); A.stay(f, m, 0.03); A.shrouds([m[0], m[1] - 2, m[2]], -11, 4.2, 8.5, 2);
  A.winch(0, 3.7, 23.5); A.railRun(4.6, 0.3, 4.2, 15, 30, 6, 0.9);
  if (o.pad) { k.add(box(10.6, 0.3, 12.4), deckM, T(0, 6.02, -18.4)); A.pad(6.3, -18.4, 11.6, 11.6, {paint:0x1f4d7a, sock:true}); A.railRun(4.9, 4.9, 3.3, -25, -29, 2, 0.9); }
  else { // the sun deck: a striped awning and deck chairs
    for (let i = 0; i < 6; i++) k.add(box(9.4/6, 0.08, 10), G.mat(i % 2 ? P[1] : 0xe9e4d6, {roughness:0.95}), T(-3.92 + i*9.4/6, 8.3, -18.3));
    for (const [x, z] of [[4.6, -13.6], [-4.6, -13.6], [4.6, -23.2], [-4.6, -23.2]]) k.add(tube([x, 5.9, z], [x, 8.3, z], 0.06, 4, false), A.WHITE);
    for (const [x, z] of [[2, -16], [-2.4, -18], [1.2, -21], [-3, -21.5]]) k.add(box(0.7, 0.5, 1.5), G.mat(0xb5382c), mul(T(x, 6.2, z), RX(-0.3))); A.solid(0, 7.1, -18.3, 4.7, 1.3, 5); }
  k.add(tube([0, 3.6, -29.6], [0, 7.4, -30.6], 0.05, 4), A.IRON); A.flag(0, 5.6, -30.2, 0, 0, [[2.2, 1.4, 0, P[1]], [2.2, 0.45, 0.48, 0xf1e9d6]]);
  A.navLights(4.4, 9.4, 8.6, f, [0, 4.5, -30.2]); ud.top = 18.4;
};

/* Trawler: a green sea-boat, wheelhouse aft, gallows and winch for the trawl, a rust-red steadying sail on the mizzen. */
SHIP_BUILD.trawler = (k, ud, A, o) => {
  const P = o.paint || [0x2f5d4a, 0xe9e4d6, 0x9a4a2a], hullM = G.mat(P[0], {roughness:0.8}), boot = G.mat(0x6a2620), white = G.mat(P[1], {roughness:0.7}), deckM = G.mat(0x8a7452, {roughness:0.95});
  const S = [{z:-10, b:2.2, d:1.5, w:0.6, k:1}, {z:-6, b:2.8, d:1.3}, {z:2, b:2.9, d:1.4}, {z:6, b:2.3, d:2, w:0.8}, {z:9, b:1, d:2.5, w:0.6}, {z:10.3, b:0.14, d:2.7, w:0.5}];
  A.hull(S, {draft:2.2, bw:0.7, bands:[[yf(-9), yf(0.3), boot], [yf(0.3), deckf(-0.35), hullM], [deckf(-0.35), deckf(), white]], deck:deckM, bulwark:hullM});
  A.solid(0, 0.4, 0, 2.9, 1.9, 10);
  A.house(0, 1.35, -5.2, 2.7, 2.2, 3, white, {roof:G.mat(0xb5382c), over:0.5, n:2, nf:3, back:true, wh:0.7, wy:0.64});
  A.funnel(0, 3.6, -6, 0.3, 1.9, 0.05, [0x1d1c1b, P[2], 0x151312], {n:6, pipe:false});
  k.add(torus(0.32, 0.09, 8, 4), G.mat(0xd94f2a), onSide(1.42, 2.4, -5.2)); k.add(box(0.36, 0.3, 0.6), lamp(0xfff1d0), T(0, 3.85, -4.2)); ud.lights.push([0, 3.85, -4.1, 0xfff1d0, 1]);
  const f = A.mast(0, 1.4, 3.6, 8.2, 0.16, A.WOOD); k.add(tube([0, 2.4, 3.3], [0, 4.6, -2.6], 0.1, 5), A.WOOD); A.stay(f, [0, 2.9, 9.9]); A.stay(f, [0, 4.6, -2.6], 0.03); A.shrouds([0, f[1] - 1.5, 3.6], 3.4, 2.75, 2.1, 2);
  const m = A.mast(0, 3.6, -7.2, 4.8, 0.11, A.WOOD, 0, false); k.add(tube([0, 4.4, -7.3], [0, 4.2, -10.6], 0.07, 4), A.WOOD);
  k.add(SHIP_SAIL([[0, 4.5, -7.4], [0, 4.3, -10.5], [0, 6.1, -9.2], [0, 8.1, -7.4]], [0.35, 0, 0], 2), G.mat(P[2], {roughness:0.95}));
  A.hatch(1.4, 0.6, 2.2, 2.2, 0x5a5648); A.winch(0, 1.4, -2.2);
  for (const z of [5.2, -2.6]) { k.add(bar([2.75, 1.4, z - 0.6], [2.6, 3.9, z], 0.16), A.IRON); k.add(bar([2.75, 1.4, z + 0.6], [2.6, 3.9, z], 0.16), A.IRON); k.add(torus(0.22, 0.07, 6, 3), A.IRON, mul(T(2.6, 3.7, z), RY(PI/2))); }
  k.add(ball(1, 7, 3), G.mat(0x3a6a5a, {roughness:1}), mul(T(-1.2, 1.75, 3.6), SC(1.2, 0.45, 1.7))); for (const [x, y, z] of [[-1.6, 2.1, 3], [-0.8, 2.2, 4.2], [-1.3, 2.15, 4.9]]) k.add(ball(0.2, 5, 3), G.mat(0xe0742a), T(x, y, z));
  for (const [x, z] of [[1.3, -0.2], [1.5, 2.5], [0.2, 6]]) { k.add(box(0.9, 0.36, 0.6), G.mat(0xc8b48a), T(x, 1.62, z)); k.add(box(0.8, 0.05, 0.5), STEEL(), T(x, 1.81, z)); }
  A.navLights(1.45, 3.2, -4.6, f, [0, 2.3, -9.9]); ud.top = 9.8;
};

/* Navy gunboat: grey, raised fo'c'sle with a shielded gun, open bridge, tripod mast with a spotting top, pom-poms aft. */
SHIP_BUILD.gunboat = (k, ud, A, o) => {
  const P = o.paint || [0x7d8791, 0x5a626c, 0xe8edf2], grey = G.mat(P[0], {roughness:0.65}), dk = G.mat(P[1], {roughness:0.7}), boot = G.mat(0x26221f), deckM = G.mat(0x565a60, {roughness:0.9}), g = ud.group;
  const S = [{z:-27, b:2.4, d:2.4, w:0.5, k:0.8}, {z:-24, b:3.4, d:2.3}, {z:-5, b:3.9, d:2.3}, {z:9.9, b:3.8, d:2.4}, {z:9.95, b:3.8, d:3.9}, {z:18, b:3, d:4.2, w:0.75}, {z:24, b:1.4, d:4.6, w:0.55}, {z:27.6, b:0.1, d:4.9, w:0.4, k:2}];
  A.hull(S, {draft:2.6, bands:[[yf(-9), yf(0.3), boot], [yf(0.3), deckf(), grey]], deck:deckM});
  A.solid(0, 0.9, 0, 3.9, 2.4, 26.5); A.solid(0, 3.2, 17, 3, 1.3, 7);
  // pennant bars on the bow instead of a number
  for (const dz of [0, 0.9]) { k.add(rect(0.5, 1.5), G.mat(P[2]), mul(T(2.62, 2.9, 21.2 + dz), RY(PI/2 - 0.3))); k.add(rect(0.5, 1.5), G.mat(P[2]), mul(T(-2.62, 2.9, 21.2 + dz), RY(-PI/2 + 0.3))); }
  // the forward gun: a turret Group that can train
  const tur = new THREE.Group(), tk = new Kit(), TA = shipParts(tk, {boxes:[], masts:[], funnels:[], lights:[]}); TA.gun(0, 0, 0, 4.6, 0.16, 0, grey); shipMesh(tk, tur); tur.position.set(0, 4.25, 16.5); g.add(tur); ud.turrets.push(tur);
  k.add(cyl(1.5, 1.5, 0.2, 10), dk, T(0, 4.25, 16.5)); A.winch(0, 4.5, 22.5); A.railRun(3.7, 0.3, 4.1, 10.2, 27, 7, 0.9);
  A.house(0, 2.35, 6.4, 5.4, 2.5, 6.4, grey, {nf:0}); A.ports(2.7, 3.7, 3.6, 9.2, 3, 0.22);
  A.house(0, 4.85, 7.4, 4.2, 2.1, 3.4, grey, {roof:dk, over:0.6, n:2, nf:5, wh:0.6, wy:0.66});
  k.both(box(2.2, 0.12, 2), dk, T(3.1, 4.9, 7.2)); k.both(box(0.08, 1, 2), grey, T(4.2, 5.4, 7.2)); k.both(box(2.2, 1, 0.08), grey, T(3.1, 5.4, 8.2));
  k.add(cyl(0.45, 0.45, 0.6, 8), dk, mul(T(0, 7.5, 7.6), RX(PI/2))); k.add(disc(0.4, 8), lamp(0xdfefff), T(0, 7.5, 7.92)); k.add(box(0.3, 0.5, 0.3), dk, T(0, 7.1, 7.6));
  // tripod mast with spotting top, yard and signal halyards
  const mt = A.mast(0, 4.85, 4.4, 12, 0.22, grey); for (const s of [1, -1]) k.add(tube([s*1.9, 4.85, 2.4], [0, 13.2, 4.3], 0.13, 5), grey);
  k.add(cyl(1.05, 0.85, 1.1, 8), grey, T(0, 13.6, 4.4)); k.add(cyl(1.15, 1.15, 0.12, 8), dk, T(0, 14.2, 4.4)); k.add(box(5.6, 0.14, 0.14), grey, T(0, 15.4, 4.4));
  for (const [x, c] of [[2.2, 0xb5382c], [2.2, 0xf2c14e], [-2.2, 0x1f4d7a]]) k.add(SHIP_SAIL([[x, 13.6 - (c === 0xf2c14e ? 1.1 : 0), 4.4], [x, 13.6 - (c === 0xf2c14e ? 1.1 : 0), 3.5], [x, 14.4 - (c === 0xf2c14e ? 1.1 : 0), 3.5], [x, 14.4 - (c === 0xf2c14e ? 1.1 : 0), 4.4]], [0.1, 0, 0], 1), G.mat(c)); A.stay([2.2, 15.4, 4.4], [2.2, 5, 4.4], 0.025); A.stay([-2.2, 15.4, 4.4], [-2.2, 5, 4.4], 0.025);
  A.funnel(0, 2.35, -2.8, 1.1, 7.2, 0.1, [P[0], P[0], 0x1d1c1b], {b0:0.6, b1:0.8}); for (const y of [6.1, 6.6]) k.add(cyl(1.14, 1.14, 0.2, 10, false), G.mat(P[2]), mul(T(0, 2.35, -2.8), RX(-0.1), T(0, y - 2.35, 0)));
  A.vent(1.9, 2.35, 0.4, 2, 0.4, 0, P[0]); A.vent(-1.9, 2.35, 0.4, 2, 0.4, 0, P[0]);
  A.boat(3.3, 3.3, -8.4, 5.6, 1, {hull:grey}); A.boat(-3.3, 3.3, -8.4, 5.6, -1, {hull:grey});
  // pom-pom on a bandstand, the after gun, depth charges and the ensign
  k.add(cyl(1.9, 1.5, 1.2, 10), grey, T(0, 2.95, -14.5)); k.add(cyl(2, 2, 0.14, 10), dk, T(0, 3.6, -14.5)); A.solid(0, 3, -14.5, 1.9, 0.8, 1.9);
  { const M = mul(T(0, 3.65, -14.5), RY(PI)); k.add(box(1, 0.8, 1), dk, mul(M, T(0, 0.5, 0))); for (const s of [1, -1]) for (const y of [0.55, 0.85]) k.add(tube([s*0.25, y, 0.3], [s*0.25, y + 0.9, 1.9], 0.05, 4), G.mat(0x3a3e42, {metalness:0.3}), M); }
  A.gun(0, 2.3, -20.5, 3.2, 0.12, PI, grey);
  for (const s of [1, -1]) { k.add(box(0.9, 0.5, 2.6), dk, T(s*1.4, 2.6, -25.3)); for (let i = 0; i < 3; i++) k.add(cyl(0.3, 0.3, 0.8, 6), G.mat(0x4a4e52), mul(T(s*1.4, 3.1, -24.4 - i*0.8), RZ(PI/2))); }
  A.railRun(3.5, 2.5, 2.4, -22, -26.8, 3, 0.9); A.railRun(3.9, 3.6, 2.35, -4, -21, 6, 0.9);
  k.add(tube([0, 2.4, -26.8], [0, 6.2, -27.8], 0.05, 4), A.IRON); A.flag(0, 4.5, -27.4, 0, 0, [[2.4, 1.5, 0, 0xe8edf2], [1.1, 0.75, 0.75, 0x2a3a52], [2.4, 0.2, 0.3, 0xb5382c]]);
  A.navLights(3.3, 6, 7.2, mt, [0, 3, -27]); ud.top = 17.2;
};

/* Corsair schooner: a fast two-master, teal-black with a red sheer strake, blood-red gaff sails, a swivel gun forward. */
SHIP_BUILD.schooner = (k, ud, A, o) => {
  const P = o.paint || [0x0f3b55, 0xd94f4f, 0x8e2a22], hullM = G.mat(P[0], {roughness:0.75}), copper = G.mat(0x3a7a6a, {roughness:0.8}), red = G.mat(P[1], {roughness:0.7}), deckM = G.mat(0xb09266, {roughness:0.95}), sailM = G.mat(P[2], {roughness:0.95}), spar = G.mat(0xa87a48, {roughness:0.7});
  const S = [{z:-16, b:1.9, d:2.5, w:0.4, k:0.5}, {z:-13, b:2.9, d:2.2, w:0.8, k:1.8}, {z:-4, b:3.5, d:1.9}, {z:5, b:3.4, d:2}, {z:11, b:2.5, d:2.4, w:0.8}, {z:16, b:1, d:2.9, w:0.5}, {z:18.6, b:0.1, d:3.2, w:0.4, k:1.6}];
  A.hull(S, {draft:2.6, bw:0.65, bands:[[yf(-9), yf(0.3), copper], [yf(0.3), deckf(-0.4), hullM], [deckf(-0.4), deckf(), red]], deck:deckM, bulwark:hullM});
  A.solid(0, 0.7, 0, 3.4, 2.1, 16); A.solid(0, 1.6, 17, 1.2, 1.4, 2);
  k.add(tube([0, 3, 17.4], [0, 4.7, 26.2], 0.2, 6, true, 0.1), spar); A.stay([0, 4.7, 26.2], [0, 0.6, 18.4], 0.05);
  const fz = 7, mz = -4, ft = A.mast(0, 2, fz, 21, 0.26, spar, 0.04), mt = A.mast(0, 1.9, mz, 24, 0.28, spar, 0.05);
  // fore and main gaff sails with their booms and gaffs
  const gaff = (tack, clew, peak, throat) => { k.add(SHIP_SAIL([tack, clew, peak, throat], [0.9, 0, 0], 3), sailM); k.add(tube([tack[0], tack[1] - 0.25, tack[2]], [clew[0], clew[1] - 0.25, clew[2] - 0.5], 0.13, 5), spar); k.add(tube(throat, [peak[0], peak[1] + 0.15, peak[2] - 0.4], 0.1, 5), spar); };
  gaff([0, 4.6, fz - 0.6], [0, 4.9, mz + 1.2], [0, 18.6, mz + 2.2], [0, 15.8, fz - 1.1]);
  gaff([0, 4.6, mz - 0.6], [0, 5.1, -18], [0, 21.6, -13.4], [0, 18.2, mz - 1.3]);
  k.add(SHIP_SAIL([[0, 3.7, 17.6], [0, 4.4, 8.6], [0, 10, 8.3], [0, 16.4, 7.6]], [0.6, 0, 0], 3), sailM); k.add(SHIP_SAIL([[0, 4.9, 25.6], [0, 5, 17.4], [0, 12, 12.6], [0, 20.4, 6.6]], [0.6, 0, 0], 3), sailM);
  A.stay([0, 20.8, 6.4], [0, 4.7, 26]); A.stay([0, 16.8, 7.4], [0, 3.6, 18]); A.stay(ft, mt, 0.03);
  A.shrouds([0, 16, fz - 0.6], fz, 3.3, 2.6, 2); A.shrouds([0, 17, mz - 0.7], mz, 3.5, 2.5, 2);
  A.flag(mt[0], mt[1] - 2.2, mt[2] - 0.2, 0, 0, [[2.6, 1.6, 0, P[1]], [0.9, 0.9, 0.35, 0xf1e9d6]]);
  // deck: cabin trunk, wheel, swivel gun, hatch, contraband
  A.house(0, 1.95, -8.4, 3.2, 1, 3.4, A.WOOD, {roof:G.mat(0x6a5436), over:0.3, n:3, wh:0.3, wy:0.55, ww:0.5, solid:false});
  k.add(torus(0.55, 0.06, 8, 3), A.WOOD, T(0, 3, -11.6)); k.add(box(0.5, 0.9, 0.5), A.WOOD, T(0, 2.5, -11.9)); k.add(box(0.5, 0.36, 0.3), lamp(0xffb347), T(0, 3.1, -9.9));
  A.gun(0, 2.3, 12.4, 2.2, 0.09, 0); A.hatch(1.95, 1.6, 2, 2.4, 0x5a5648);
  for (const [x, z, c] of [[1.9, 3.2, 0x8a6a44], [-2, -1, 0x8a6a44], [-1.6, 0, 0x6a4a2e], [1.7, -6.3, 0x7a5a3a]]) k.add(box(1, 0.9, 1), G.mat(c), T(x, 2.45, z));
  A.navLights(3.2, 3.4, 5, null, [0, 3.2, -15.9]); ud.lights.push([0, 3.1, -9.8, 0xffb347]); ud.top = 26;
};

/* Brethren galleon: an old three-decker kept afloat with boiler plate and spite. High stern castle with a lit gallery, a beak with
   a skull on it, black courses and blood-red topsails, broadside guns in a red strake, a stovepipe from the galley. */
SHIP_BUILD.galleon = (k, ud, A, o) => {
  const P = o.paint || [0x1c1a1a, 0x9e1b1b, 0xe8e0cc], tim = G.mat(0x3a2e24, {roughness:0.9}), blk = G.mat(P[0], {roughness:0.85}), red = G.mat(P[1], {roughness:0.75}), bone = G.mat(P[2], {roughness:0.85}), white = G.mat(0x9a927c, {roughness:0.9}), deckM = G.mat(0x6a543a, {roughness:0.95}), spar = G.mat(0x5a4632, {roughness:0.8}), gold = G.mat(0xb88a2a, {roughness:0.45, metalness:0.4}), bronze = G.mat(0x8a6a3a, {roughness:0.4, metalness:0.4});
  const S = [{z:-22, b:3.8, d:8.6, w:0.5, k:1.2, bw:0.9}, {z:-18, b:4.6, d:8.6, w:0.8, k:3, bw:0.9}, {z:-14, b:5.1, d:8.6, bw:0.9}, {z:-13.95, b:5.1, d:6.4, bw:0.9}, {z:-6, b:5.4, d:6.4, bw:0.9}, {z:-5.95, b:5.4, d:4.2, bw:1.1}, {z:10, b:5.2, d:4.2, bw:1.1}, {z:10.05, b:5.2, d:6, bw:0.9}, {z:16, b:3.8, d:6.2, w:0.8, bw:0.9}, {z:16.05, b:3.6, d:4.6, w:0.8, bw:0.6}, {z:20, b:1.8, d:4.8, w:0.6, bw:0.6}, {z:22.6, b:0.15, d:5, w:0.5, k:2.5, bw:0.6}];
  A.hull(S, {draft:4, bands:[[yf(-9), yf(0.4), white], [yf(0.4), yf(2.3), tim], [yf(2.3), yf(3.5), red], [yf(3.5), deckf(-0.5), blk], [deckf(-0.5), deckf(), bone]], deck:deckM, bulwark:red});
  A.solid(0, 0.6, 2, 5.4, 3.6, 20); A.solid(0, 5.4, -10, 5.3, 1.2, 4); A.solid(0, 6.4, -18, 4.9, 2.2, 4.2); A.solid(0, 5.2, 13, 4.8, 1, 3);
  // the broadside: lids up, bronze muzzles run out
  for (let i = 0; i < 7; i++) { const z = -11 + i*3.4, b = z > 9 ? 4.95 : 5.18; k.both(box(0.12, 0.8, 0.9), INK(), T(b + 0.02, 2.9, z)); k.both(box(0.3, 0.08, 0.9), red, mul(T(b + 0.22, 3.36, z), RZ(0.5))); k.both(tube([b - 0.2, 2.9, z], [b + 0.9, 2.9, z], 0.16, 6), bronze); }
  for (const z of [-3, 1, 5]) k.both(tube([4.9, 5.1, z], [6, 5.25, z], 0.14, 6), bronze);
  // stern castle: gallery windows, quarter galleries, lanterns
  for (const [y, n, w] of [[7.2, 5, 5.6], [5.2, 4, 4.6]]) for (let i = 0; i < n; i++) k.add(rect(w/n*0.7, 1.1), WINDOW(), mul(T(-w/2 + (i + 0.5)*w/n, y, -22.06 + (8.6 - y)*0.06), RY(PI)));
  k.add(box(8, 0.3, 0.5), gold, T(0, 8.1, -22.1)); k.add(box(7, 0.3, 0.5), gold, T(0, 6.2, -22.1)); k.add(box(6, 0.3, 0.5), gold, T(0, 4.3, -22));
  k.both(box(1, 2.6, 3.4), blk, T(4.9, 6.2, -19.6)); k.both(box(1.1, 0.25, 3.6), gold, T(4.9, 7.6, -19.6)); for (const z of [-20.4, -18.8]) k.both(rect(0.9, 1), WINDOW(), onSide(5.42, 6.3, z));
  A.ports(4.9, 7.3, -17.5, -6.5, 4, 0.28); A.ports(5.25, 5.4, -13, -7, 3, 0.28);
  for (const x of [-2.6, 0, 2.6]) { k.add(tube([x, 9.4, -22], [x, 10.6, -22.6], 0.07, 4), A.IRON); k.add(cyl(0.42, 0.3, 0.95, 6), lamp(0xffb347), T(x, 11.1, -22.6)); k.add(cyl(0.1, 0.5, 0.3, 6), gold, T(x, 11.7, -22.6)); ud.lights.push([x, 11.1, -22.6, 0xffb347, 1]); }
  // ladders between the decks, the capstan, the galley stovepipe, gratings
  for (const s of [1, -1]) { k.add(box(1.2, 0.2, 2.4), spar, mul(T(s*3.4, 5.3, -5), RX(-0.72))); k.add(box(1.2, 0.2, 2.2), spar, mul(T(s*3.2, 5.1, 9.2), RX(0.7))); k.add(box(1.2, 0.2, 2.4), spar, mul(T(s*3.2, 7.5, -13), RX(-0.72))); }
  k.add(cyl(0.7, 0.9, 1.3, 8), spar, T(0, 4.9, 6)); k.add(box(3.2, 0.14, 4), INK(), T(0, 4.32, 1.4)); k.add(box(3.4, 0.2, 0.3), spar, T(0, 4.4, 3.5)); k.add(box(3.4, 0.2, 0.3), spar, T(0, 4.4, -0.7));
  A.funnel(2.6, 6.4, -8.6, 0.36, 3.4, 0.06, [0x2a2826, 0x2a2826, 0x151312], {n:6, pipe:false}); k.add(cyl(0.55, 0.36, 0.5, 6), A.IRON, T(2.6, 9.9, -8.8));
  k.add(torus(0.8, 0.07, 8, 3), spar, T(0, 7.9, -9.6)); k.add(box(0.6, 1.3, 0.6), spar, T(0, 7.1, -9.9));
  // beakhead and figurehead, bowsprit
  k.add(loft([[[-1.2, 3.4, 21.6], [1.2, 3.4, 21.6], [1, 4.9, 21.6], [-1, 4.9, 21.6]], [[-0.5, 4.6, 26], [0.5, 4.6, 26], [0.5, 5.6, 26], [-0.5, 5.6, 26]], [[-0.15, 5.9, 29], [0.15, 5.9, 29], [0.15, 6.5, 29], [-0.15, 6.5, 29]]]), red);
  k.both(box(0.12, 0.25, 7.6), gold, mul(T(0.72, 5.4, 25.3), RX(-0.24), RY(-0.13))); k.add(ball(0.75, 7, 4), bone, mul(T(0, 6.5, 29.3), SC(1, 1.1, 1))); for (const s of [1, -1]) k.add(ball(0.2, 5, 3), INK(), T(s*0.3, 6.65, 29.95)); k.add(box(0.7, 0.5, 0.5), bone, T(0, 5.85, 29.4));
  k.add(tube([0, 5.6, 19], [0, 11.6, 33.5], 0.3, 6, true, 0.14), spar); ud.masts.push([0, 5.6, 19, 0, 11.6, 33.5, 0.8]);
  // masts, tops, yards and sails
  const sq = (z, y0, y1, w0, w1, m, n = 3) => { k.add(SHIP_SAIL([[w0, y0, z], [-w0, y0, z], [-w1, y1, z], [w1, y1, z]], [0, 0, 1.5], n), m); k.add(tube([w1 + 0.9, y1 + 0.15, z - 0.1], [-w1 - 0.9, y1 + 0.15, z - 0.1], 0.2, 6, true, 0.2), spar); };
  const rig = (z, y0, h, wC, wT, top3) => {
    const top = A.mast(0, y0, z, h, 0.42, spar, 0.02), yT = y0 + h*0.52;
    k.add(cyl(1.5, 1.1, 0.5, 8), spar, T(0, yT, z - 0.2)); k.add(cyl(1.6, 1.6, 0.1, 8), tim, T(0, yT + 0.3, z - 0.2));
    sq(z + 0.5, y0 + 2.6, yT - 1.2, wC, wC*0.92, blk, 4); sq(z + 0.4, yT + 1.2, y0 + h*0.86, wC*0.86, wT, G.mat(P[1], {roughness:0.95}));
    if (top3) sq(z + 0.3, y0 + h*0.88, y0 + h*0.985, wT*0.9, wT*0.55, blk, 2);
    A.shrouds([0, yT, z - 0.2], z - 0.8, 5.3, y0 + 0.6, 3); for (const s of [1, -1]) A.stay([s*1.4, yT + 0.3, z - 0.2], [0, y0 + h*0.86, z - 0.3], 0.04);
    return top;
  };
  const f = rig(12.4, 6, 25, 6.4, 4.4), m = rig(-1.4, 4.2, 32, 7.6, 5, true);
  k.decal(mul(T(0, 13.2, 0.95), SC(3.6, 3.6, 1)), skull(red).slice(2), false, 0.03);
  A.stay(f, [0, 11.4, 33]); A.stay(m, [0, 20, 12.2]); A.stay([0, 19, 12.2], [0, 8.8, 26.5]);
  A.flag(m[0], m[1] - 2.6, m[2] - 0.4, 0, 0, [[3.4, 2.1, 0, 0x111111], [1.1, 1.1, 0.5, P[2]]]);
  { const t = A.mast(0, 8.6, -16.6, 17, 0.3, spar, 0.05);
    k.add(tube([0, 11.5, -11.2], [0, 22.5, -22], 0.16, 5), spar); k.add(SHIP_SAIL([[0, 11.7, -11.4], [0, 10.4, -21.6], [0, 22.2, -21.7], [0, 17, -16.6]], [1, 0, 0], 3), G.mat(P[1], {roughness:0.95})); A.shrouds([0, 19, -17], -17, 4.7, 9.2, 2); A.stay(m, t, 0.04); }
  k.add(cyl(0.9, 0.7, 0.9, 8), A.IRON, T(0, 6.6, 13.5)); k.add(tube([0, 7.2, 13.5], [0, 8.4, 15.4], 0.07, 4), G.mat(0x3a3e42)); 
  A.navLights(5.3, 7.4, -4, null, null); ud.top = 37;
};

/* Motor yacht: white clipper-bowed hull with a gold cove line, mahogany deckhouse, a buff funnel and two raked pole masts. */
SHIP_BUILD.yacht = (k, ud, A, o) => {
  const P = o.paint || [0xf1ede2, 0xdba63e, 0xe2c27a], hullM = G.mat(P[0], {roughness:0.45}), boot = G.mat(0x1f5a4a, {roughness:0.7}), gold = G.mat(P[1], {roughness:0.4, metalness:0.35}), deckM = G.mat(0xc2a878, {roughness:0.85}), mah = G.mat(0x6a3420, {roughness:0.45}), spar = G.mat(0xb8884a, {roughness:0.55});
  const S = [{z:-23, b:1.7, d:2.7, w:0.3, k:0.3}, {z:-19, b:3.1, d:2.4, w:0.75, k:1.6}, {z:-9, b:3.9, d:2.2}, {z:7, b:4, d:2.3}, {z:15, b:3, d:2.7, w:0.8}, {z:21, b:1.4, d:3.2, w:0.5}, {z:25, b:0.1, d:3.6, w:0.35, k:1.2}];
  A.hull(S, {draft:2.6, bw:0.5, bands:[[yf(-9), yf(0.35), boot], [yf(0.35), deckf(-0.55), hullM], [deckf(-0.55), deckf(-0.38), gold], [deckf(-0.38), deckf(), hullM]], deck:deckM, bulwark:hullM});
  A.solid(0, 0.6, 0, 3.9, 2.2, 23); A.ports(3.75, 1.3, -16, 12, 9, 0.19);
  k.add(tube([0, 3.5, 24.4], [0, 4.5, 29.4], 0.13, 5, true, 0.06), spar); k.both(box(0.08, 0.3, 4.2), gold, mul(T(0.62, 3.1, 22.6), RY(-0.3), RX(-0.08)));
  A.house(0, 2.3, 1.5, 5.2, 2.1, 17, mah, {roof:G.mat(0xf1ede2, {roughness:0.5}), over:0.9, n:8, wh:0.95, ww:1.3, nf:4, back:true, wy:0.58});
  A.house(0, 4.55, 6.2, 3.8, 2, 4, G.mat(0xf1ede2, {roughness:0.5}), {roof:mah, over:0.7, n:2, nf:4, wh:0.85, wy:0.6});
  A.funnel(0, 4.5, -0.6, 0.85, 3.9, 0.17, [P[2], P[2], P[2]], {b0:0.6, b1:0.72, mark:r => star(r*1.2, r*0.5), markCol:0x1f5a4a});
  A.vent(1.5, 4.55, 2.6, 1.2, 0.3, 0, P[2]); A.vent(-1.5, 4.55, 2.6, 1.2, 0.3, 0, P[2]);
  A.boat(3.1, 5, -4.2, 5, 1, {hull:mah, cover:G.mat(0xf1ede2)}); A.boat(-3.1, 5, -4.2, 5, -1, {hull:G.mat(0xf1ede2), cover:G.mat(0x1f5a4a)});
  const f = A.mast(0, 2.5, 13.6, 15, 0.18, spar, 0.1), m = A.mast(0, 4.5, -5.6, 12.6, 0.16, spar, 0.12); A.stay(f, [0, 4.4, 29]); A.stay(f, m, 0.03); A.shrouds([f[0], f[1] - 2, f[2]], 13, 3.2, 2.9, 2); A.shrouds([m[0], m[1] - 2, m[2]], -6.2, 3.7, 2.8, 2);
  A.flag(m[0], m[1] - 1.5, m[2] - 0.1, 0, 0, [[1.8, 0.9, 0, 0x1f5a4a], [0.6, 0.5, 0.2, P[1]]]);
  A.railRun(3.9, 3, 2.75, 7.5, 15.5, 4, 0.8); A.railRun(2.9, 0.3, 3.3, 16, 24.4, 4, 0.8); A.winch(0, 3.1, 19.5);
  if (o.pad) { A.pad(3.7, -15.8, 10.6, 11.6, {paint:0x1f5a4a, deck:0xc2a878, legs:null, braceTo:[3, 2.4], legMat:G.mat(0xf1ede2), lamp:0x5fe0d0}); A.stay(m, [0, 3.8, -10.2]); }
  else { for (let i = 0; i < 6; i++) k.add(box(1.05, 0.07, 8), G.mat(i % 2 ? 0x1f5a4a : 0xf1ede2, {roughness:0.95}), T(-2.62 + i*1.05, 4.9, -13)); for (const [x, z] of [[3.1, -9.2], [-3.1, -9.2], [2.9, -16.8], [-2.9, -16.8]]) k.add(tube([x, 2.3, z], [x, 4.9, z], 0.05, 4, false), gold);
    for (const [x, z] of [[1.4, -12], [-1.4, -12.6], [0.2, -15.4]]) { k.add(box(0.8, 0.45, 1.4), G.mat(0xd8c9a0), mul(T(x, 2.65, z), RX(-0.25))); } k.add(cyl(0.6, 0.6, 0.7, 8), mah, T(-0.2, 2.65, -13.6)); A.railRun(3.5, 1.6, 2.5, -9.5, -22.6, 5, 0.8); A.solid(0, 3.7, -13, 3.2, 1.3, 4); }
  k.add(tube([0, 2.8, -22.6], [0, 5.6, -23.5], 0.04, 4), gold); A.flag(0, 4.2, -23.1, 0, 0, [[1.7, 1, 0, 0xb5382c], [0.75, 0.5, 0.5, 0x1f3b6b]]);
  A.navLights(2.7, 5.2, 6.4, f, [0, 3.4, -22.9]); ud.top = 17.6;
};
G.SHIP_KINDS = Object.keys(SHIP_BUILD);
/* One mesh for all the paint (vertex colours), one for lit windows, one for lamps: a ship costs three or four draw calls. */
function shipMesh(k, g){
  const sp = [], sc = [], lp = [], lc = [], col = new THREE.Color();
  for (const [mat, a] of k.b) {
    if (!a.length) continue;
    const basic = mat.isMeshBasicMaterial, glow = !basic && mat.emissive && mat.emissive.getHex && mat.emissive.getHex() !== 0;
    if (glow || mat.transparent) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(a), 3)); geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, mat)); continue; }
    const P = basic ? lp : sp, C = basic ? lc : sc; col.copy(mat.color);
    for (let i = 0; i < a.length; i += 3) { P.push(a[i], a[i + 1], a[i + 2]); C.push(col.r, col.g, col.b); }
  }
  const mk = (P, C, m, shadow) => { if (!P.length) return; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3)); geo.computeVertexNormals(); const me = new THREE.Mesh(geo, m); me.castShadow = me.receiveShadow = shadow; g.add(me); };
  mk(sp, sc, G.mat(0xffffff, {vertexColors:true, roughness:0.7}), true);
  mk(lp, lc, SHIP_LAMP || (SHIP_LAMP = new THREE.MeshBasicMaterial({color:0xffffff, vertexColors:true})), false);
  return g;
}
let SHIP_LAMP = null;
G.SHIP_KINDS = Object.keys(SHIP_BUILD);
G.buildShip = (kind, o = {}) => {
  const g = new THREE.Group(), k = new Kit(), ud = g.userData = {kind, boxes:[], masts:[], funnels:[], lights:[], turrets:[], pad:null, group:g};
  const A = shipParts(k, ud, o.night);
  (SHIP_BUILD[kind] || SHIP_BUILD.freighter)(k, ud, A, o);
  shipMesh(k, g);
  if (o.night) { const F = new G.Fittings({day:0}); for (const L of ud.lights) F.halo([L[0], L[1], L[2]], L[3], !!L[4]); F.build(g); }
  delete ud.group; ud.radius = Math.hypot(ud.len/2 + 6, ud.top);
  return g;
};
/* ==== SHIPS END ==== */
G.KIT = {Kit, box, cyl, bar, ball, lathe, loft, lamp, T, RX, RY, RZ, mul, xf};
})();
