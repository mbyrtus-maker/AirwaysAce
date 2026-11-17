/* Headless stand-in for three.js r128: real vector/quaternion maths, real Object3D transforms, everything visual a no-op. */
'use strict';
function Fake(){
  const store = {}, f = function(){};
  return new Proxy(f, {
    get(t, p){ if (p === Symbol.toPrimitive) return () => 0; if (p === 'valueOf') return () => 0; if (p === 'toString') return () => ''; if (p === 'then') return undefined;
      if (p === Symbol.iterator) return function*(){}; if (p in store) return store[p]; return (store[p] = Fake()); },
    set(t, p, v){ store[p] = v; return true; }, apply(){ return Fake(); }, construct(){ return Fake(); }, has(){ return false; }
  });
}
const soft = o => new Proxy(o, {get(t, p){ if (p in t) return t[p]; if (typeof p === 'symbol') return undefined; return (t[p] = Fake()); }});
class Vector3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; } setScalar(s){ return this.set(s, s, s); }
  setX(v){ this.x = v; return this; } setY(v){ this.y = v; return this; } setZ(v){ this.z = v; return this; }
  copy(v){ this.x = v.x; this.y = v.y; this.z = v.z; return this; } clone(){ return new Vector3(this.x, this.y, this.z); }
  add(v){ this.x += v.x; this.y += v.y; this.z += v.z; return this; } sub(v){ this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  addVectors(a, b){ return this.set(a.x + b.x, a.y + b.y, a.z + b.z); } subVectors(a, b){ return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
  addScaledVector(v, s){ this.x += v.x*s; this.y += v.y*s; this.z += v.z*s; return this; }
  multiplyScalar(s){ this.x *= s; this.y *= s; this.z *= s; return this; } divideScalar(s){ return this.multiplyScalar(1/s); }
  multiply(v){ this.x *= v.x; this.y *= v.y; this.z *= v.z; return this; } divide(v){ this.x /= v.x; this.y /= v.y; this.z /= v.z; return this; }
  negate(){ return this.multiplyScalar(-1); } dot(v){ return this.x*v.x + this.y*v.y + this.z*v.z; }
  lengthSq(){ return this.dot(this); } length(){ return Math.sqrt(this.lengthSq()); } setLength(l){ return this.normalize().multiplyScalar(l); }
  normalize(){ return this.divideScalar(this.length() || 1); }
  distanceTo(v){ return Math.sqrt(this.distanceToSquared(v)); } distanceToSquared(v){ const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z; return dx*dx + dy*dy + dz*dz; }
  cross(v){ return this.crossVectors(this, v); }
  crossVectors(a, b){ const ax = a.x, ay = a.y, az = a.z, bx = b.x, by = b.y, bz = b.z; return this.set(ay*bz - az*by, az*bx - ax*bz, ax*by - ay*bx); }
  applyQuaternion(q){ const x = this.x, y = this.y, z = this.z, qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const ix = qw*x + qy*z - qz*y, iy = qw*y + qz*x - qx*z, iz = qw*z + qx*y - qy*x, iw = -qx*x - qy*y - qz*z;
    this.x = ix*qw + iw*-qx + iy*-qz - iz*-qy; this.y = iy*qw + iw*-qy + iz*-qx - ix*-qz; this.z = iz*qw + iw*-qz + ix*-qy - iy*-qx; return this; }
  applyAxisAngle(ax, a){ return this.applyQuaternion(new Quaternion().setFromAxisAngle(ax, a)); }
  applyMatrix4(m){ const e = m.elements, x = this.x, y = this.y, z = this.z, w = 1/(e[3]*x + e[7]*y + e[11]*z + e[15] || 1);
    return this.set((e[0]*x + e[4]*y + e[8]*z + e[12])*w, (e[1]*x + e[5]*y + e[9]*z + e[13])*w, (e[2]*x + e[6]*y + e[10]*z + e[14])*w); }
  lerp(v, t){ this.x += (v.x - this.x)*t; this.y += (v.y - this.y)*t; this.z += (v.z - this.z)*t; return this; }
  lerpVectors(a, b, t){ return this.copy(a).lerp(b, t); }
  angleTo(v){ const d = Math.sqrt(this.lengthSq()*v.lengthSq()); if (!d) return Math.PI/2; return Math.acos(Math.max(-1, Math.min(1, this.dot(v)/d))); }
  project(){ return this; } unproject(){ return this; } equals(v){ return v.x === this.x && v.y === this.y && v.z === this.z; }
  min(v){ this.x = Math.min(this.x, v.x); this.y = Math.min(this.y, v.y); this.z = Math.min(this.z, v.z); return this; }
  max(v){ this.x = Math.max(this.x, v.x); this.y = Math.max(this.y, v.y); this.z = Math.max(this.z, v.z); return this; }
  setFromMatrixPosition(m){ return this.set(m.elements[12], m.elements[13], m.elements[14]); }
  toArray(){ return [this.x, this.y, this.z]; } fromArray(a, o = 0){ return this.set(a[o], a[o + 1], a[o + 2]); }
  transformDirection(){ return this; } round(){ this.x = Math.round(this.x); this.y = Math.round(this.y); this.z = Math.round(this.z); return this; }
}
Vector3.prototype.isVector3 = true;
class Vector2 { constructor(x = 0, y = 0){ this.x = x; this.y = y; } set(x, y){ this.x = x; this.y = y; return this; } copy(v){ this.x = v.x; this.y = v.y; return this; } clone(){ return new Vector2(this.x, this.y); } }
class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1){ this.x = x; this.y = y; this.z = z; this.w = w; this._cb = null; }
  _ch(){ if (this._cb) this._cb(); return this; }
  set(x, y, z, w){ this.x = x; this.y = y; this.z = z; this.w = w; return this._ch(); } identity(){ return this.set(0, 0, 0, 1); }
  copy(q){ return this.set(q.x, q.y, q.z, q.w); } clone(){ return new Quaternion(this.x, this.y, this.z, this.w); }
  setFromAxisAngle(a, ang){ const s = Math.sin(ang/2); return this.set(a.x*s, a.y*s, a.z*s, Math.cos(ang/2)); }
  setFromUnitVectors(f, t){ let r = f.dot(t) + 1, x, y, z;
    if (r < 1e-6) { r = 0; if (Math.abs(f.x) > Math.abs(f.z)) { x = -f.y; y = f.x; z = 0; } else { x = 0; y = -f.z; z = f.y; } }
    else { x = f.y*t.z - f.z*t.y; y = f.z*t.x - f.x*t.z; z = f.x*t.y - f.y*t.x; }
    this.x = x; this.y = y; this.z = z; this.w = r; return this.normalize(); }
  setFromEuler(e){ const c1 = Math.cos(e._x/2), c2 = Math.cos(e._y/2), c3 = Math.cos(e._z/2), s1 = Math.sin(e._x/2), s2 = Math.sin(e._y/2), s3 = Math.sin(e._z/2), o = e._order || 'XYZ';
    if (o === 'YXZ') return this.set(s1*c2*c3 + c1*s2*s3, c1*s2*c3 - s1*c2*s3, c1*c2*s3 - s1*s2*c3, c1*c2*c3 + s1*s2*s3);
    return this.set(s1*c2*c3 + c1*s2*s3, c1*s2*c3 - s1*c2*s3, c1*c2*s3 + s1*s2*c3, c1*c2*c3 - s1*s2*s3); }
  multiply(q){ return this.multiplyQuaternions(this, q); } premultiply(q){ return this.multiplyQuaternions(q, this); }
  multiplyQuaternions(a, b){ const ax = a.x, ay = a.y, az = a.z, aw = a.w, bx = b.x, by = b.y, bz = b.z, bw = b.w;
    return this.set(ax*bw + aw*bx + ay*bz - az*by, ay*bw + aw*by + az*bx - ax*bz, az*bw + aw*bz + ax*by - ay*bx, aw*bw - ax*bx - ay*by - az*bz); }
  invert(){ return this.set(-this.x, -this.y, -this.z, this.w); } conjugate(){ return this.invert(); }
  dot(q){ return this.x*q.x + this.y*q.y + this.z*q.z + this.w*q.w; }
  normalize(){ let l = Math.hypot(this.x, this.y, this.z, this.w); if (!l) return this.set(0, 0, 0, 1); l = 1/l; return this.set(this.x*l, this.y*l, this.z*l, this.w*l); }
  slerp(q, t){ return this.set(this.x + (q.x - this.x)*t, this.y + (q.y - this.y)*t, this.z + (q.z - this.z)*t, this.w + (q.w - this.w)*t).normalize(); }
  angleTo(q){ return 2*Math.acos(Math.min(1, Math.abs(this.dot(q)))); }
}
class Euler {
  constructor(x = 0, y = 0, z = 0, order = 'XYZ'){ this._x = x; this._y = y; this._z = z; this._order = order; this._cb = null; }
  get x(){ return this._x; } set x(v){ this._x = v; this._ch(); } get y(){ return this._y; } set y(v){ this._y = v; this._ch(); } get z(){ return this._z; } set z(v){ this._z = v; this._ch(); }
  get order(){ return this._order; } set order(v){ this._order = v; this._ch(); }
  _ch(){ if (this._cb) this._cb(); } set(x, y, z, o){ this._x = x; this._y = y; this._z = z; if (o) this._order = o; this._ch(); return this; }
  copy(e){ return this.set(e._x, e._y, e._z, e._order); }
}
class Matrix4 {
  constructor(){ this.elements = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
  identity(){ this.elements = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; return this; } copy(m){ this.elements = m.elements.slice(); return this; } clone(){ return new Matrix4().copy(this); }
  compose(p, q, s){ const e = this.elements, x = q.x, y = q.y, z = q.z, w = q.w, x2 = x + x, y2 = y + y, z2 = z + z, xx = x*x2, xy = x*y2, xz = x*z2, yy = y*y2, yz = y*z2, zz = z*z2, wx = w*x2, wy = w*y2, wz = w*z2;
    e[0] = (1 - (yy + zz))*s.x; e[1] = (xy + wz)*s.x; e[2] = (xz - wy)*s.x; e[3] = 0; e[4] = (xy - wz)*s.y; e[5] = (1 - (xx + zz))*s.y; e[6] = (yz + wx)*s.y; e[7] = 0;
    e[8] = (xz + wy)*s.z; e[9] = (yz - wx)*s.z; e[10] = (1 - (xx + yy))*s.z; e[11] = 0; e[12] = p.x; e[13] = p.y; e[14] = p.z; e[15] = 1; return this; }
  makeTranslation(x, y, z){ this.identity(); this.elements[12] = x; this.elements[13] = y; this.elements[14] = z; return this; }
  makeRotationX(){ return this.identity(); } makeRotationY(){ return this.identity(); } makeRotationZ(){ return this.identity(); } makeScale(){ return this.identity(); }
  multiply(){ return this; } premultiply(){ return this; } multiplyMatrices(){ return this; } invert(){ return this; } decompose(){ return this; } lookAt(){ return this; }
}
class Color {
  constructor(r = 1, g, b){ if (g === undefined) this.setHex(typeof r === 'number' ? r : 0xffffff); else this.setRGB(r, g, b); }
  setRGB(r, g, b){ this.r = r; this.g = g; this.b = b; return this; } setHex(h){ this.r = (h >> 16 & 255)/255; this.g = (h >> 8 & 255)/255; this.b = (h & 255)/255; return this; }
  set(v){ return typeof v === 'number' ? this.setHex(v) : v instanceof Color ? this.copy(v) : this; } copy(c){ return this.setRGB(c.r, c.g, c.b); } clone(){ return new Color(this.r, this.g, this.b); }
  lerp(c, t){ this.r += (c.r - this.r)*t; this.g += (c.g - this.g)*t; this.b += (c.b - this.b)*t; return this; } multiplyScalar(s){ this.r *= s; this.g *= s; this.b *= s; return this; }
  getHex(){ return (Math.round(this.r*255) << 16) | (Math.round(this.g*255) << 8) | Math.round(this.b*255); } offsetHSL(){ return this; } getStyle(){ return '#000'; }
}
let ids = 0;
class Object3D {
  constructor(){
    this.id = ids++; this.name = ''; this.parent = null; this.children = []; this.userData = {}; this.visible = true;
    this.position = new Vector3(); this.scale = new Vector3(1, 1, 1); this.quaternion = new Quaternion(); this.rotation = new Euler();
    this.rotation._cb = () => { this.quaternion._cb = null; this.quaternion.setFromEuler(this.rotation); this.quaternion._cb = null; };
    this.matrix = new Matrix4(); this.matrixWorld = new Matrix4();
    return soft(this);
  }
  add(...o){ for (const c of o) { if (c.parent) c.parent.remove(c); c.parent = this; this.children.push(c); } return this; }
  remove(...o){ for (const c of o) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } } return this; }
  traverse(fn){ fn(this); for (const c of this.children.slice()) c.traverse(fn); }
  getObjectByName(n){ if (this.name === n) return this; for (const c of this.children) { const r = c.getObjectByName(n); if (r) return r; } return undefined; }
  updateMatrixWorld(){} updateMatrix(){} get geometry(){ return this._geo || (this._geo = {dispose(){}}); } set geometry(v){ this._geo = (v && typeof v === 'object' || typeof v === 'function') ? v : {dispose(){}}; } lookAt(){} clone(){ const o = new this.constructor(); o.position.copy(this.position); o.quaternion.copy(this.quaternion); o.scale.copy(this.scale); o.userData = Object.assign({}, this.userData); for (const c of this.children) o.add(c.clone()); return o; }
  localToWorld(v){ v.multiply(this.scale).applyQuaternion(this.quaternion).add(this.position); if (this.parent && !this.parent.isScene) this.parent.localToWorld(v); return v; }
  worldToLocal(v){ if (this.parent && !this.parent.isScene) this.parent.worldToLocal(v); return v.sub(this.position).applyQuaternion(this.quaternion.clone().invert()).divide(this.scale); }
  getWorldPosition(v){ return this.localToWorld(v.set(0, 0, 0)); }
  rotateX(){ return this; } rotateY(){ return this; } rotateZ(){ return this; } translateZ(){ return this; }
}
class Scene extends Object3D { constructor(){ super(); this.isScene = true; return soft(this); } }
const objClass = () => class extends Object3D { constructor(geo, mat){ super(); this.geometry = geo || Fake(); this.material = mat || Fake(); if (this.geometry && typeof this.geometry === "object" && typeof this.geometry.dispose !== 'function') this.geometry.dispose = () => {}; this.count = 0; return soft(this); } setMatrixAt(){} setColorAt(){} getMatrixAt(){} };
const real = {Vector3, Vector2, Quaternion, Euler, Matrix4, Color, Object3D, Scene, Group:objClass(), Mesh:objClass(), InstancedMesh:objClass(), Points:objClass(), Line:objClass(), LineSegments:objClass(), Sprite:objClass(),
  PerspectiveCamera:class extends Object3D { constructor(fov, aspect){ super(); this.fov = fov; this.aspect = aspect; return soft(this); } updateProjectionMatrix(){} },
  DirectionalLight:objClass(), PointLight:objClass(), SpotLight:objClass(), HemisphereLight:objClass(), AmbientLight:objClass(),
  MathUtils:{clamp:(v, a, b) => Math.max(a, Math.min(b, v)), lerp:(a, b, t) => a + (b - a)*t, degToRad:d => d*Math.PI/180},
  AdditiveBlending:2, DoubleSide:2, BackSide:1, FrontSide:0, RepeatWrapping:1000, PCFSoftShadowMap:2, DynamicDrawUsage:35048};
global.THREE = new Proxy(real, {get(t, p){ if (p in t) return t[p]; return (t[p] = Fake()); }});
global.Fake = Fake;
