'use strict';
/* Terrain preview: builds an open-skies region headlessly and renders the ground around a tunnel or the cavern,
   with the rebuilt rock and the bore lining, from a chosen viewpoint. Usage: node view.js region id [yawDeg] [pitchDeg] [dist] */
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
require('./three-mock.js');
const T0 = global.THREE;
class Mat { constructor(o = {}){ this.color = new T0.Color(o.color ?? 0xffffff); this.vc = !!o.vertexColors; this.transparent = !!o.transparent; this.userData = {}; this.emissive = new T0.Color(o.emissive ?? 0); } }
class Basic extends Mat { constructor(o){ super(o); this.basic = true; this.isMeshBasicMaterial = true; } }
class Geo { constructor(){ this.attributes = {}; this.index = null; } setAttribute(k, v){ this.attributes[k] = v; return this; } setIndex(i){ this.index = i; return this; } computeVertexNormals(){} dispose(){} translate(){ return this; } rotateX(){ return this; } clone(){ return this; } }
class Attr { constructor(a, n){ this.array = a; this.itemSize = n; } }
global.THREE = new Proxy({}, {get(_, p){ if (p === 'MeshStandardMaterial') return Mat; if (p === 'MeshBasicMaterial') return Basic; if (p === 'BufferGeometry') return Geo; if (p === 'BufferAttribute' || p === 'Float32BufferAttribute') return Attr; return T0[p]; }});
global.window = global; global.innerWidth = 1600; global.innerHeight = 900; global.devicePixelRatio = 1;
const els = {}; global.document = {getElementById:id => els[id] || (els[id] = Fake()), createElement:() => Fake(), addEventListener(){}, exitPointerLock(){}, pointerLockElement:null, querySelector:() => null, body:Fake()};
global.addEventListener = () => {}; global.requestAnimationFrame = () => 0; global.Path2D = function(){ return Fake(); }; global.DOMMatrix = function(){ return Fake(); };
const LS = {}; global.localStorage = {getItem:k => LS[k] ?? null, setItem:(k, v) => { LS[k] = String(v); }};
global.fetch = () => Promise.reject(new Error('offline')); global.Audio = function(){ return Fake(); };
const dir = '/home/claude/ace';
for (const f of ['data', 'sfx', 'world', 'models', 'planes', 'combat', 'ai', 'audio', 'hud', 'game', 'traffic', 'story', 'open', 'ui']) vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), {filename:f + '.js'});
const G = global.G, V3 = T0.Vector3;
const [region, id, yawD = '30', pitchD = '25', distA = '700', time = '11'] = process.argv.slice(2);
G.save.open.region = region; G.save.open.hour = +time; if (process.env.NOCUT) { const rc = G.regionCuts; G.regionCuts = R => (rc(R), []); }
const g = new G.Game(new Proxy({}, {get:() => () => {}}), G.MISSIONS.open), O = g.mission, w = g.world;
let focus;
if (id.startsWith('m:')) { const q = O.P[id.slice(2)] || (O.sites.find(x => x.id === id.slice(2)) || {}).point; focus = q.clone(); if (process.env.FX) { focus.x += +process.env.FX; focus.z += +(process.env.FZ || 0); focus.y = w.height(focus.x, focus.z); } }
else if (id === 'cavern') { const C = O.cavern; focus = new V3(C.x, C.floor + 20, C.z); if (yawD === 'inside') { global.__inside = C; } }
else { const tn = O.tunnels.find(t => t.T.td.id === id); const e = tn.T.pts[tn.T.i0]; focus = new V3(e.x, tn.T.floor + 20, e.z); if (process.argv[8] === 'mid') { const m = tn.T.pts[(tn.T.i0 + tn.T.i1) >> 1]; focus = new V3(m.x, tn.T.floor + 15, m.z); } }
// triangles: the scene's meshes near the focus, plus the terrain heightfield around it
const tris = [], R = +(process.env.VR || 900);
const walk = (o, chain) => { const m = {p:o.position.clone(), q:o.quaternion.clone(), s:o.scale.clone()}, ch = chain.concat([m]);
  const gm = o.geometry, mt = o.material; if (process.env.DBG && gm && Array.isArray(gm.index)) console.log('indexed mesh', !!(gm.attributes && gm.attributes.position), !!(mt && mt.color), o.visible, mt && mt.transparent, gm.index.length);
  if (gm && gm.attributes && gm.attributes.position && gm.attributes.position.array && mt && mt.color && o.visible !== false && !mt.transparent) {
    const a = gm.attributes.position.array, c = gm.attributes.color && gm.attributes.color.array, idx = gm.index, n = idx ? idx.length : a.length/3;
    for (let i = 0; i < n; i += 3) { const vi = [0, 1, 2].map(k => idx ? idx[i + k] : i + k);
      const pts = vi.map(v => { const p = new V3(a[v*3], a[v*3 + 1], a[v*3 + 2]); for (let j = ch.length - 1; j >= 0; j--) p.multiply(ch[j].s).applyQuaternion(ch[j].q).add(ch[j].p); return p; });
      if (pts.every(p => p.distanceTo(focus) > R)) continue;
      const col = c && mt.vc ? [0, 1, 2].map(k => (c[vi[0]*3 + k] + c[vi[1]*3 + k] + c[vi[2]*3 + k])/3) : [mt.color.r, mt.color.g, mt.color.b];
      tris.push({pts, col, basic:mt.basic}); } }
  for (const k of o.children) walk(k, ch); };
if (process.env.NOLID) g.scene.traverse(o => { if (o.material === w.terrain.material) o.visible = false; }); if (process.env.NOLINE) g.scene.traverse(o => { if (o.material && o.material.vc && o.material !== w.terrain.material) o.visible = false; });
if (process.env.LIDRED) g.scene.traverse(o => { if (o.material === w.terrain.material) { o.material = Object.assign(Object.create(Object.getPrototypeOf(o.material)), o.material, {vc:false, color:new T0.Color(0xcc2222)}); } });
walk(g.scene, []); if (process.env.LIDRED) console.log('red tris', tris.filter(t => t.col[0] > 0.7 && t.col[1] < 0.2).length, 'of', tris.length, 'lid tris near focus');
const st = 12;
for (let x = focus.x - R; x < focus.x + R; x += st) for (let z = focus.z - R; z < focus.z + R; z += st) {
  const P = [[x, z], [x + st, z], [x + st, z + st], [x, z + st]].map(([a, b]) => new V3(a, w.height(a, b, true), b));
  const h = (P[0].y + P[2].y)/2, sl = Math.abs(P[0].y - P[2].y)/st, col = h < 0.4 ? [0.15, 0.4, 0.55] : (w.cutFloor(x, z, 0) !== null && w.height(x, z, true) < w.height0(x, z) - 0.5 ? w.colorAt(x, z, w.height0(x, z), 0.9).map(c => c*0.55) : w.colorAt(x, z, h, sl));
  const W = P.map(p => p.y < 0.4 ? p.clone().setY(0.4) : p);
  tris.push({pts:[W[0], W[1], W[2]], col}); tris.push({pts:[W[0], W[2], W[3]], col});
}
// camera
const yaw = +yawD*Math.PI/180, pitch = +pitchD*Math.PI/180, dist = +distA;
let eye = focus.clone().add(new V3(Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(dist));
if (global.__inside) { const C = global.__inside; eye = new V3(C.x + C.ax[0]*(C.rx - 40), C.floor + 30, C.z + C.ax[1]*(C.rx - 40)); }
if (yawD === 'axis' && id !== 'cavern') { const tn = O.tunnels.find(t => t.T.td.id === id), e = tn.T.pts[tn.T.i0]; eye = new V3(e.x - e.dx*dist, tn.T.floor + tn.T.td.bh*0.5 + Math.tan(pitch)*dist, e.z - e.dz*dist); focus.set(e.x, tn.T.floor + tn.T.td.bh*0.5, e.z); }
const fwd = focus.clone().sub(eye).normalize(), right = new V3().crossVectors(fwd, new V3(0, 1, 0)).normalize(), up = new V3().crossVectors(right, fwd);
const Wd = 960, Hd = 600, f = Wd*0.9, img = new Float32Array(Wd*Hd*3), zb = new Float32Array(Wd*Hd).fill(1e9);
for (let i = 0; i < Wd*Hd; i++) { const y = Math.floor(i/Wd)/Hd; img[i*3] = 0.55 + 0.3*y; img[i*3 + 1] = 0.7 + 0.2*y; img[i*3 + 2] = 0.9; }
const L = new V3(-0.58, 0.6, -0.42).normalize();
for (const t of tris) {
  const n = new V3().crossVectors(new V3().subVectors(t.pts[1], t.pts[0]), new V3().subVectors(t.pts[2], t.pts[0])).normalize();
  const lit = t.basic ? 1 : 0.45 + 0.7*Math.abs(n.dot(L));
  const s = t.pts.map(p => { const d = p.clone().sub(eye), z = d.dot(fwd); return [Wd/2 + d.dot(right)/z*f, Hd/2 - d.dot(up)/z*f, z]; });
  if (s.some(q => q[2] < 1)) continue;
  const x0 = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0]))), x1 = Math.min(Wd - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])));
  const y0 = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1]))), y1 = Math.min(Hd - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])));
  const d = (s[1][1] - s[2][1])*(s[0][0] - s[2][0]) + (s[2][0] - s[1][0])*(s[0][1] - s[2][1]); if (Math.abs(d) < 1e-9) continue;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const a = ((s[1][1] - s[2][1])*(x - s[2][0]) + (s[2][0] - s[1][0])*(y - s[2][1]))/d, b = ((s[2][1] - s[0][1])*(x - s[2][0]) + (s[0][0] - s[2][0])*(y - s[2][1]))/d, c = 1 - a - b;
    if (a < 0 || b < 0 || c < 0) continue; const z = a*s[0][2] + b*s[1][2] + c*s[2][2], k = y*Wd + x; if (z >= zb[k]) continue; zb[k] = z;
    const fog = Math.min(1, z/4000); for (let j = 0; j < 3; j++) img[k*3 + j] = Math.min(1, t.col[j]*lit)*(1 - fog) + [0.8, 0.85, 0.9][j]*fog;
  }
}
const out = Buffer.alloc(Wd*Hd*3); for (let i = 0; i < img.length; i++) out[i] = Math.round(img[i]*255);
fs.writeFileSync('/tmp/v.ppm', Buffer.concat([Buffer.from(`P6 ${Wd} ${Hd} 255\n`), out]));
const name = `/home/claude/test/shots/view_${region}_${id.replace(":", "")}${process.env.TAG || ""}.png`; cp.execSync(`ffmpeg -v error -y -i /tmp/v.ppm ${name}`); console.log(name, tris.length, 'tris');
process.exit(0);
