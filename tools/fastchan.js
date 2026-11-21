'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
require('./three-mock.js');
global.window = global; global.innerWidth = 1600; global.innerHeight = 900; global.devicePixelRatio = 1;
const els = {}; global.document = {getElementById:id => els[id] || (els[id] = Fake()), createElement:() => Fake(), addEventListener(){}, exitPointerLock(){}, pointerLockElement:null, querySelector:() => null, body:Fake()};
global.addEventListener = () => {}; global.requestAnimationFrame = () => 0;
const LS = {}; global.localStorage = {getItem:k => LS[k] ?? null, setItem:(k, v) => { LS[k] = String(v); }, removeItem:k => { delete LS[k]; }};
global.Path2D = function(){ return Fake(); }; global.DOMMatrix = function(){ return Fake(); };
global.fetch = () => Promise.reject(new Error('offline')); global.Audio = function(){ return Fake(); }; global.Image = function(){ return Fake(); };
const dir = process.argv[2];
const order = ['data', 'sfx', 'world', 'models', 'planes', 'combat', 'ai', 'audio', 'hud', 'game', 'traffic', 'story', 'open', 'rust', 'story2', 'story3', 'story4', 'net', 'pad', 'keys', 'ui', 'weather', 'ach'];
for (const f of order) vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), {filename:f + '.js'});
const G = global.G, V3 = THREE.Vector3;
const EE = require('events'); const peers = new Map(); let nid = 0; const sent = [];
class Conn extends EE { constructor(from, o){ super(); this.peer = from; this.metadata = o.metadata; this.reliable = o.reliable; this.open = false; }
  send(o){ sent.push([this.reliable ? 'reliable' : 'fast', o.t]); setTimeout(() => this.other.emit('data', JSON.parse(JSON.stringify(o))), 1); } close(){} }
class FakePeer extends EE { constructor(id){ super(); this.id = id || 'p' + (++nid); peers.set(this.id, this); setTimeout(() => this.emit('open'), 1); }
  connect(to, o){ const a = new Conn(to, o), b = new Conn(this.id, o); a.other = b; b.other = a; setTimeout(() => { peers.get(to).emit('connection', b); setTimeout(() => { a.open = b.open = true; b.emit('open'); a.emit('open'); }, 2); }, 1); return a; } destroy(){} }
window.Peer = FakePeer;
const T = G.Net.transport, got = []; let HL, GL;
T.host('ABCD', {onReady(){}, onError(e){ console.log('err', e); }, onConn(L){ HL = L; L.onMessage(m => got.push('host<-' + m.t)); }});
setTimeout(() => T.join('ABCD', {onError(e){ console.log('err', e); }, onOpen(L){ GL = L; L.onMessage(m => got.push('guest<-' + m.t)); }}), 5);
setTimeout(() => {
  GL.sendFast({t:'st'}); GL.send({t:'gh'}); HL.sendFast({t:'snap'}); HL.sendFast({t:'bigsnap', pad:'x'.repeat(20000)});
  setTimeout(() => { console.log('sent on', JSON.stringify(sent)); console.log('received', got.join(' ')); process.exit(0); }, 30);
}, 60);
