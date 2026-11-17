'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
require(path.join(__dirname, 'three-mock.js'));
global.window = global; global.innerWidth = 1600; global.innerHeight = 900; global.devicePixelRatio = 1;
const els = {}; global.document = {getElementById:id => els[id] || (els[id] = Fake()), createElement:() => Fake(), addEventListener(){}, exitPointerLock(){}, pointerLockElement:null, querySelector:() => null, body:Fake()};
global.addEventListener = () => {}; global.requestAnimationFrame = () => 0;
const LS = {}; global.localStorage = {getItem:k => LS[k] ?? null, setItem:(k, v) => { LS[k] = String(v); }, removeItem:k => { delete LS[k]; }};
global.Path2D = function(){ return Fake(); }; global.DOMMatrix = function(){ return Fake(); };
global.fetch = () => Promise.reject(new Error('offline')); global.Audio = function(){ return Fake(); }; global.Image = function(){ return Fake(); };
const dir = process.argv[2];
const order = ['data', 'sfx', 'world', 'models', 'planes', 'combat', 'ai', 'audio', 'hud', 'game', 'traffic', 'story', 'open', 'story2', 'net', 'pad', 'keys', 'ui'];
for (const f of order) vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), {filename:f + '.js'});
const G = global.G, V3 = THREE.Vector3;
let errs = 0; const fail = (where, e) => { errs++; console.log('ERROR in', where, '\n ', e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n  ') : e); };
const R = new Proxy({}, {get:() => () => {}});
G.save.callsign = 'Tester';
function step(g, n, dt = 1/30, hook){ for (let i = 0; i < n; i++) { if (hook) hook(i); g.update(dt); } }
const id = process.argv[3] || 'calavera', N = 600, S = 16000;
const o = Object.create(G.World.prototype); o.noise = G.Noise(G.REGIONS[id].seed); o.terr = G.REGIONS[id].terrain; o.RT = G.TERRAIN[o.terr]; o.flats = []; o.cuts = [];
const buf = Buffer.alloc(N*N*3);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = -S/2 + (i + 0.5)*S/N, z = S/2 - (j + 0.5)*S/N, h = o.raw(x, z);   // north (+z) at the top
  const hx = o.raw(x + 30, z) - h, hz = o.raw(x, z + 30) - h, sl = Math.min(1, Math.hypot(hx, hz)/30);
  let c = h < 0.4 ? [0.1, 0.3 + Math.max(-0.2, h/200), 0.42] : o.colorAt(x, z, h, sl);
  const shade = h < 0.4 ? 1 : Math.max(0.5, Math.min(1.3, 1 + (hx - hz)/40));
  buf[(j*N + i)*3] = Math.min(255, c[0]*255*shade); buf[(j*N + i)*3 + 1] = Math.min(255, c[1]*255*shade); buf[(j*N + i)*3 + 2] = Math.min(255, c[2]*255*shade);
}
const L = G.regionLayout(id), dot = (x, z, col) => { const i = Math.round((x + S/2)/S*N), j = Math.round((S/2 - z)/S*N); for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) { const p = ((j + b)*N + i + a)*3; if (p >= 0 && p < buf.length) { buf[p] = col[0]; buf[p + 1] = col[1]; buf[p + 2] = col[2]; } } };
for (const [k, p] of Object.entries(L.sites)) { dot(p.x, p.z, [80, 170, 255]); console.log('site', k, Math.round(p.x), Math.round(p.z), 'h', Math.round(o.raw(p.x, p.z))); }
for (const [k, p] of Object.entries(L.marks)) { dot(p.x, p.z, [255, 230, 60]); console.log('mark', k, Math.round(p.x), Math.round(p.z), 'h', Math.round(o.raw(p.x, p.z))); }
for (const T of L.tunnels) { for (const p of T.pts.slice(T.i0, T.i1 + 1)) dot(p.x, p.z, [255, 60, 220]); console.log('tunnel', T.td.id, 'roofed', T.i1 - T.i0, 'pts'); }
fs.writeFileSync('/tmp/map.rgb', buf);
require('child_process').execSync(`ffmpeg -v error -y -f rawvideo -pix_fmt rgb24 -s ${N}x${N} -i /tmp/map.rgb /tmp/map_${id}.png`);
