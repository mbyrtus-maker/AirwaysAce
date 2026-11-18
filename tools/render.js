'use strict';
/* Software preview of plane models: loads the game's model code with a minimal THREE, rasterises the triangle soup
   with a z-buffer and flat lighting, and writes four views (3/4 front, side, top, 3/4 rear) to a PNG via ffmpeg. */
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
require('./three-mock.js');
const real = THREE;   // the proxy; patch in material and geometry classes that keep their data
class Mat { constructor(o = {}){ this.color = new real.Color(o.color ?? 0xffffff); this.transparent = !!o.transparent; this.opacity = o.opacity ?? 1; this.basic = false; this.emissive = new real.Color(o.emissive ?? 0); this.userData = {}; Object.assign(this, {side:o.side}); } }
class Basic extends Mat { constructor(o){ super(o); this.basic = true; this.isMeshBasicMaterial = true; } }
class Geo { constructor(){ this.attributes = {}; } setAttribute(k, v){ this.attributes[k] = v; return this; } computeVertexNormals(){} dispose(){} translate(){ return this; } rotateX(){ return this; } }
class Attr { constructor(a, n){ this.array = a; this.itemSize = n; } }
Object.assign(global.THREE, {});
const T0 = global.THREE; global.THREE = new Proxy({}, {get(_, p){ if (p === 'MeshStandardMaterial') return Mat; if (p === 'MeshBasicMaterial') return Basic; if (p === 'BufferGeometry') return Geo; if (p === 'BufferAttribute' || p === 'Float32BufferAttribute') return Attr; return T0[p]; }});
global.window = global; global.document = {createElement:() => Fake(), getElementById:() => Fake()};
const dir = '/home/claude/ace';
for (const f of ['data', 'models']) vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), {filename:f + '.js'});
const G = global.G, V3 = THREE.Vector3;

function tris(root){
  const out = [];
  const walk = (o, M) => {
    // compose this object's transform onto the parent's (position, quaternion, scale)
    const m = {p:o.position.clone(), q:o.quaternion.clone(), s:o.scale.clone()};
    const chain = M.concat([m]);
    if (o.geometry && o.geometry.attributes && o.geometry.attributes.position && o.geometry.attributes.position.array && o.material && o.material.color && o.visible !== false) {
      const a = o.geometry.attributes.position.array, c = o.material.color, glass = o.material.transparent;
      for (let i = 0; i < a.length; i += 9) {
        const pts = [0, 3, 6].map(k => { const v = new V3(a[i + k], a[i + k + 1], a[i + k + 2]); for (let j = chain.length - 1; j >= 0; j--) v.multiply(chain[j].s).applyQuaternion(chain[j].q).add(chain[j].p); return v; });
        out.push({pts, col:[c.r, c.g, c.b], glass, basic:o.material.basic});
      }
    }
    for (const ch of o.children) walk(ch, chain);
  };
  walk(root, []); return out;
}
function render(list, W, H, view){
  const img = new Float32Array(W*H*3).fill(0), zb = new Float32Array(W*H).fill(-1e9);
  for (let i = 0; i < W*H; i++) { img[i*3] = 0.82; img[i*3 + 1] = 0.86; img[i*3 + 2] = 0.9; }
  const L = new V3(0.4, 0.8, 0.5).normalize();
  const P = list.map(t => ({t, v:t.pts.map(view)}));
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9; for (const {v} of P) for (const p of v) { mnx = Math.min(mnx, p.x); mxx = Math.max(mxx, p.x); mny = Math.min(mny, p.y); mxy = Math.max(mxy, p.y); }
  const sc = Math.min((W - 20)/(mxx - mnx), (H - 20)/(mxy - mny)), ox = W/2 - (mnx + mxx)/2*sc, oy = H/2 + (mny + mxy)/2*sc;
  for (const {t, v} of P) {
    const n = new V3().crossVectors(new V3().subVectors(t.pts[1], t.pts[0]), new V3().subVectors(t.pts[2], t.pts[0])).normalize();
    const vn = new V3().crossVectors(new V3().subVectors(v[1], v[0]), new V3().subVectors(v[2], v[0]));
    const lit = t.basic ? 1 : 0.35 + 0.75*Math.abs(n.dot(L));
    const s = v.map(p => [ox + p.x*sc, oy - p.y*sc, p.z]);
    const x0 = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])));
    const d = (s[1][1] - s[2][1])*(s[0][0] - s[2][0]) + (s[2][0] - s[1][0])*(s[0][1] - s[2][1]); if (Math.abs(d) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const a = ((s[1][1] - s[2][1])*(x - s[2][0]) + (s[2][0] - s[1][0])*(y - s[2][1]))/d, b = ((s[2][1] - s[0][1])*(x - s[2][0]) + (s[0][0] - s[2][0])*(y - s[2][1]))/d, c = 1 - a - b;
      if (a < 0 || b < 0 || c < 0) continue;
      const z = a*s[0][2] + b*s[1][2] + c*s[2][2], k = y*W + x; if (z <= zb[k]) continue;
      if (t.glass) { for (let j = 0; j < 3; j++) img[k*3 + j] = img[k*3 + j]*0.6 + 0.6*0.4*t.col[j]; continue; }
      zb[k] = z; for (let j = 0; j < 3; j++) img[k*3 + j] = Math.min(1, t.col[j]*lit);
    }
  }
  return img;
}
const views = {
  q34:p => { const v = p.clone().applyAxisAngle(new V3(0, 1, 0), -0.75); const y = v.y*0.92 - v.z*0.38, z = v.z*0.92 + v.y*0.38; return new V3(-v.x, y, z); },
  side:p => new V3(p.z, p.y, p.x),
  top:p => new V3(-p.x, p.z, p.y),
  rear:p => { const v = p.clone().applyAxisAngle(new V3(0, 1, 0), Math.PI + 0.75); const y = v.y*0.92 - v.z*0.38, z = v.z*0.92 + v.y*0.38; return new V3(-v.x, y, z); }
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(G.CHASSIS);
for (const id of ids) {
  const L = G.stockLoadout(id); if (process.env.LIVERY) L.paint = G.LIVERIES[process.env.LIVERY].paint.slice(); const m = G.buildPlane(id, L.paint); if (process.env.TURRET) { const [y, p] = process.env.TURRET.split(",").map(Number); for (const t of m.userData.turretGuns) { t.rotation.y = y; t.userData.pitch.rotation.x = p; } } if (process.env.GEARUP) for (const l of m.userData.legs) { const s = l.userData.side; if (s) l.rotation.set(0, 0, -s*1.5); else l.rotation.set(1.6, 0, 0); l.updateMatrix && l.updateMatrix(); } const list = tris(m), W = 420, H = 300, sheet = new Uint8Array(W*2*H*2*3);
  ['q34', 'side', 'top', 'rear'].forEach((vk, i) => { const im = render(list, W, H, views[vk]), ox = (i % 2)*W, oy = Math.floor(i/2)*H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let j = 0; j < 3; j++) sheet[((oy + y)*W*2 + ox + x)*3 + j] = Math.round(im[(y*W + x)*3 + j]*255); });
  const ppm = `/tmp/${id}.ppm`; fs.writeFileSync(ppm, Buffer.concat([Buffer.from(`P6 ${W*2} ${H*2} 255\n`), Buffer.from(sheet)]));
  cp.execSync(`ffmpeg -v error -y -i ${ppm} /home/claude/test/shots/${id}.png`);
  console.log(id, list.length, 'tris', 'ud:', Object.keys(m.userData).join(','));
}
