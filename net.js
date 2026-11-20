/* =====================================================================
   Co-op multiplayer: up to four pilots, peer to peer.

   The host's game is the real one. It runs the mission, the AI, every ship and every bullet that does damage.
   Each guest flies their own plane on their own machine (so it answers the stick instantly) and sends its state
   twenty times a second. The host flies a stand-in for each guest that fires real bullets, and passes any damage
   that stand-in takes back to its guest. The host sends everyone else a snapshot of the sky fifteen times a second;
   guests draw it, firing harmless tracers, and never decide a hit themselves.

   Transport: PeerJS (WebRTC data channels, with PeerJS's free matchmaking server). Swappable: tests plug in their own.
   ===================================================================== */
(() => {
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const PREFIX = 'ace-airways-v1-';
const SNAP_HZ = 15, STATE_HZ = 20;
const r2 = v => Math.round(v*100)/100, r4 = v => Math.round(v*10000)/10000;
const tA = new V3(), qA = new Q();

/* ---------- transports ---------- */
const wrapConn = c => ({
  send(o){ if (c.open) try { c.send(o); } catch (e) {} },
  onMessage(fn){ c.on('data', fn); },
  onClose(fn){ c.on('close', fn); c.on('error', fn); },
  close(){ try { c.close(); } catch (e) {} }
});
const PeerTransport = {
  ok(){ return typeof window.Peer === 'function'; },
  host(code, h){
    const peer = new window.Peer(PREFIX + code, {debug:0});
    peer.on('open', () => h.onReady && h.onReady());
    peer.on('connection', c => c.on('open', () => h.onConn(wrapConn(c))));
    peer.on('error', e => h.onError(e.type === 'unavailable-id' ? 'taken' : (e.message || e.type)));
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });   // lost the matchmaker; the games already linked carry on
    return {close(){ try { peer.destroy(); } catch (e) {} }};
  },
  join(code, h){
    const peer = new window.Peer(undefined, {debug:0});
    peer.on('open', () => { const c = peer.connect(PREFIX + code, {reliable:true, serialization:'json'}); c.on('open', () => h.onOpen(wrapConn(c))); });
    peer.on('error', e => h.onError(e.type === 'peer-unavailable' ? 'No game with that code. Check it with the host.' : (e.message || e.type)));
    return {close(){ try { peer.destroy(); } catch (e) {} }};
  }
};

/* ---------- small helpers ---------- */
const vec = v => v && v.isVector3 ? {_v:[r2(v.x), r2(v.y), r2(v.z)]} : v;
function specOf(o){   // a ship's constructor options, made fit for the wire
  const out = {};
  for (const [k, v] of Object.entries(o || {})) {
    if (typeof v === 'function') continue;
    if (v && v.isVector3) out[k] = vec(v);
    else if (Array.isArray(v)) out[k] = v.map(vec);
    else if (v && typeof v === 'object' && !v.isObject3D) out[k] = JSON.parse(JSON.stringify(v));
    else out[k] = v;
  }
  return out;
}
function unspec(o){
  const un = v => v && v._v ? new V3(...v._v) : v, out = {};
  for (const [k, v] of Object.entries(o)) out[k] = Array.isArray(v) ? v.map(un) : un(v);
  return out;
}
const code4 = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random()*A.length)]; return s; };
const myLoad = () => Object.assign({}, G.save.load, {mods:(G.save.mods || []).slice()});

/* on a guest, a job's AI plane is flown by the host; this only keeps the race bookkeeping (which ring they're up to) */
class JobPilot {
  constructor(g, p){ this.g = g; this.p = p; this.wp = 0; this.route = null; this.target = null; this.fake = true; }
  update(){
    const p = this.p, wp = this.route && this.route[this.wp];
    if (wp && Math.hypot(wp.x - p.pos.x, wp.z - p.pos.z) < (wp.r || 200)) { this.wp++; if (this.onWaypoint) this.onWaypoint(this.wp); }
  }
}
const Net = G.Net = {
  transport:PeerTransport, tseq:0,
  role:null,          // null | 'host' | 'guest'
  code:'', status:'', links:[], host:null, me:null, roster:[],
  g:null,             // the game being shared
  seq:0,

  available(){ return this.transport.ok(); },
  guestCount(){ return this.role === 'host' ? this.links.length : 0; },
  humans(){ return 1 + (this.role === 'host' ? this.links.length : Math.max(0, this.roster.length - 1)); },

  /* ======================= lobby ======================= */
  hostGame(code){
    this.leave(); this.role = 'host'; this.code = code || code4(); this.status = 'Opening the line…'; this.links = []; this.render();
    this.server = this.transport.host(this.code, {
      onReady:() => { this.status = 'Waiting for pilots. Give them the code.'; this.render(); },
      onConn:L => this.hostConn(L),
      onError:e => { if (e === 'taken' && !code) { this.hostGame(); return; } this.status = 'Line trouble: ' + e; this.render(); }
    });
  },
  joinGame(code){
    code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    if (code.length !== 4) { this.status = 'A game code is four letters.'; this.render(); return; }
    this.leave(); this.role = 'guest'; this.code = code; this.status = 'Calling ' + code + '…'; this.render();
    this.server = this.transport.join(code, {
      onOpen:L => {
        this.host = L; this.status = 'Connected. Waiting for the host to launch.';
        L.onMessage(m => this.guestMsg(m));
        L.onClose(() => this.lostHost());
        L.send({t:'hello', name:G.save.callsign || 'Ace', load:myLoad()});
        this.render();
      },
      onError:e => { this.status = e; this.role = null; this.render(); }
    });
  },
  leave(){
    if (this.role === 'host') { for (const L of this.links) { L.send({t:'bye'}); L.close(); } }
    if (this.role === 'guest' && this.host) { this.host.send({t:'bye'}); this.host.close(); }
    if (this.server) this.server.close();
    this.server = null; this.host = null; this.links = []; this.roster = []; this.vs = null; this.role = null; this.code = ''; this.status = ''; this.render();
  },
  lostHost(){
    if (this.role !== 'guest') return;
    const g = this.g; this.role = null; this.host = null; this.roster = []; this.status = 'Lost the host.'; this.render();
    if (g && G.game === g && !g.done) { g.done = true; G.HUD.toast('Lost the host'); setTimeout(() => { if (G.UI && G.game === g) { G.UI.quit(); G.UI.menu(); } }, 1800); }
  },

  /* host: a guest has dialled in */
  hostConn(L){
    if (this.links.length >= 3) { L.send({t:'full'}); setTimeout(() => L.close(), 300); return; }
    L.id = 'g' + (++this.seq); L.name = 'Pilot'; L.load = null;
    L.onMessage(m => this.hostMsg(L, m));
    L.onClose(() => this.dropLink(L));
    this.links.push(L);
  },
  dropLink(L){
    if (!this.links.includes(L)) return;
    this.vsGone(L.id);
    this.links = this.links.filter(x => x !== L);
    const g = this.g, p = L.proxy;
    if (g && p) { if (p.alive) { p.alive = false; p.obj.visible = false; } G.HUD.feed(`${L.name} left the flight`); this.removeNetPlane(g, p); }
    L.proxy = null; this.status = this.links.length ? `${this.links.length + 1} pilots on the line.` : 'Waiting for pilots. Give them the code.';
    this.sendRoster(); this.render();
  },
  sendRoster(){
    this.roster = [{id:'host', name:G.save.callsign || 'Ace', host:true}, ...this.links.map(L => ({id:L.id, name:L.name}))];
    for (const L of this.links) L.send({t:'roster', you:L.id, roster:this.roster});
    this.render();
  },
  broadcast(m, except){ for (const L of this.links) if (L !== except) L.send(m); },

  hostMsg(L, m){
    if (!m || typeof m !== 'object') return;
    const g = this.g;
    switch (m.t) {
      case 'hello':
        L.name = String(m.name || 'Pilot').slice(0, 18); L.load = this.cleanLoad(m.load);
        this.status = `${this.links.length + 1} pilots on the line.`; this.sendRoster();
        if (g && G.game === g && !g.done) this.sendStart(g, L);
        break;
      case 'st': if (g && G.game === g) this.guestState(g, L, m); break;
      case 'dead': if (g && L.proxy && L.proxy.alive) { const src = this.byNid(g, m.by); L.proxy.destroy(src, m.how || 'shot'); } break;
      case 'order': if (g && G.ORDERS && Object.values(G.ORDERS).includes(m.o) && g.wingmen && g.wingmen.length) { g.order(m.o); G.HUD.feed(`${L.name}: ${G.ORDER_NAMES[m.o]}`); } break;
      case 'leftgame': this.vsGone(L.id); if (L.proxy && g) { this.removeNetPlane(g, L.proxy); L.proxy = null; } this.dropSpawned(g, L); break;
      case 'bye': this.dropSpawned(g, L); L.close(); this.dropLink(L); break;
      case 'spawn': if (g && G.game === g && !g.done) this.hostSpawn(g, L, m); break;
      case 'take': if (g && G.game === g && !g.done) this.hostTake(g, L, m); break;
      case 'seaHit': if (g && G.game === g && g.sea) { const s = g.sea.ships[m.i | 0]; if (s && s.alive) g.sea.hit(s, Math.max(0, Math.min(400, +m.d || 0)), L.proxy || null, null, true); } break;
      case 'despawn': if (g && G.game === g) { const p = this.byNid(g, m.nid | 0); if (p && p.jobOwner === L) { this.removeNetPlane(g, p); L.spawned.delete(p); } } break;
      default: if (typeof m.t === 'string' && m.t.slice(0, 2) === 'vs') this.vsRelay(L, m); break;
      case 'spawnShip': if (g && G.game === g && !g.done && m.o && typeof m.o === 'object' && (L.ships = (L.ships || 0) + 1) <= 3) { this.spawnTid = String(m.tid || '').slice(0, 16); try { const sh = g.addShip(unspec(m.o)); sh.jobOwner = L; } catch (e) {} this.spawnTid = null; } break;
    }
  },
  cleanLoad(L){
    // a guest's plane as they built it, checked against what the game knows
    const C = L && G.CHASSIS[L.chassis] ? L.chassis : 'gallant', S = G.stockLoadout(C);
    try {
      if (Array.isArray(L.paint) && L.paint.length === 3) S.paint = L.paint.map(x => (x | 0) & 0xffffff);
      if (Array.isArray(L.guns) && L.guns.length === S.guns.length) S.guns = L.guns.map((x, i) => ({cal:x && G.GUNS[x.cal] ? x.cal : null, ammo:x && G.AMMO[x.ammo] ? x.ammo : 'slug'}));
      if (Array.isArray(L.arm) && L.arm.length === 4) S.arm = L.arm.map(a => Math.max(0, Math.min(G.ARMOR_MAX, +a || 0)));
      if (L.hp != null) S.hp = Math.max(0, Math.min(G.CHASSIS[C].hpMax, L.hp | 0));
      if (G.ROCKETS[L.rocket]) S.rocket = L.rocket;
      if (L.engine === 2 || L.engine === 1) S.engine = L.engine;
      S.nitro = !!L.nitro; S.mods = Array.isArray(L.mods) ? L.mods.filter(x => G.MODS && G.MODS[x]) : [];
    } catch (e) {}
    return S;
  },

  /* ======================= host: a shared game ======================= */
  onGame(g){
    if (this.building) { this.building = false; this.becomeGuest(g); return; }
    if (this.role !== 'host') return;
    this.g = g; g.netHost = true; g.snapT = 0; this.vs = null;
    for (const p of g.planes) this.tagPlane(g, p);
    for (const L of this.links) { L.proxy = null; this.sendStart(g, L); }
  },
  sendStart(g, L){
    const M = g.mission, S = G.save.open || {};
    L.send({t:'start', m:M.id, open:M.open ? {region:S.region, hour:S.hour, day:S.day} : null, host:G.save.callsign || 'Ace',
      ships:g.ships.map(s => ({kind:s.kind, spec:s.spec || null})), targets:(g.targets || []).length});
    for (const p of g.planes) if (p.nid) L.send(this.planeMsg(p));
  },
  tagPlane(g, p){
    if (p.nid) return;
    p.nid = ++this.seq; if (this.spawnTid) p.tid = this.spawnTid;
    if (this.role === 'host' && this.links.length) this.broadcast(this.planeMsg(p));
  },
  planeMsg(p){
    const L = p.L;
    return {t:'pl', nid:p.nid, tid:p.tid || undefined, team:p.team, name:p.name, cs:p.callsign, owner:p.remote ? p.remote.id : (p.isPlayer ? 'host' : null), ace:!!p.ace,
      L:{chassis:L.chassis, paint:L.paint, guns:L.guns, turrets:L.turrets, rocket:L.rocket, hp:L.hp, arm:L.arm}, ...this.parkedTag(p)};
  },
  /* ---- changing aeroplanes in co-op (game.parkPlane / swapPlayer). The host owns every parked plane; guests see them
     as puppets tagged parked. A guest stopped beside one asks ('take'); the host hands it over ('took'), rebuilds that
     guest's stand-in in the new model and parks the guest's old plane where it stood, for anyone. The host's own swaps
     reuse the plane objects, so the guests only need telling which is parked now ('plmeta'). */
  parkedTag(p){
    const sp = p.parked && p.g && (p.g.parkedSpots || []).find(s => s.plane === p);
    return sp ? {pk:this.parkedLabel(p, sp), ho:sp.hostOnly ? 1 : 0} : {};
  },
  parkedLabel(p, sp){ return String(sp.mine ? `${G.save.callsign || 'Ace'}'s ${(G.CHASSIS[p.L.chassis] || {name:'aeroplane'}).name}` : sp.label).slice(0, 60); },   // "your Gallant" here is the host's Gallant to everyone else
  parkedChanged(g, p, spot){ if (p.nid && this.links.length && this.g === g) this.broadcast({t:'plmeta', nid:p.nid, pk:this.parkedLabel(p, spot), ho:spot.hostOnly ? 1 : 0}); },
  hostSwapped(g, now, was){ if (now.nid && this.links.length && this.g === g) this.broadcast({t:'plmeta', nid:now.nid, pk:null}); },
  markParked(g, p, label, ho){
    p.parked = true; g.parkedSpots = (g.parkedSpots || []).filter(s => s.plane !== p);
    g.parkedSpots.push({plane:p, label:String(label).slice(0, 60), reach:Math.max(45, ((p.ud && p.ud.radius) || 8)*3.5), keepOld:true, hostOnly:!!ho, nid:p.nid, taken:false});
  },
  guestMeta(g, m){
    const p = g.netPlanes.get(m.nid | 0); if (!p) return;
    if (typeof m.pk === 'string') this.markParked(g, p, m.pk, m.ho);
    else { p.parked = false; g.parkedSpots = (g.parkedSpots || []).filter(s => s.plane !== p); }
  },
  askTake(g, spot){
    if (!this.host || !spot.plane || !spot.plane.nid || (g.swapAsked && g.t - g.swapAsked < 3)) return;
    g.swapAsked = g.t; this.host.send({t:'take', nid:spot.plane.nid}); G.HUD.toast(`Climbing into ${spot.label}…`);
  },
  hostTake(g, L, m){
    const p = this.byNid(g, m.nid | 0), spot = p && (g.parkedSpots || []).find(s => s.plane === p);
    if (!spot || spot.hostOnly || !p.parked || !p.alive || p === g.player) { L.send({t:'takeNo', nid:m.nid | 0}); return; }
    const why = g.mission.canSwap && g.mission.canSwap(spot, L); if (why) { L.send({t:'takeNo', nid:m.nid | 0, why}); return; }
    const old = L.proxy; if (!old || !old.alive || old.speed > 6 || old.pos.distanceTo(p.pos) > spot.reach + 30) { L.send({t:'takeNo', nid:m.nid | 0, why:'Stop beside her first'}); return; }
    const load = JSON.parse(JSON.stringify(p.L)), at = p.pos.clone(), yaw = Math.atan2(p.fwd.x, p.fwd.z);
    spot.taken = true; g.parkedSpots = g.parkedSpots.filter(s => s !== spot); this.removeNetPlane(g, p);
    // the guest's old plane stays where they left it, parked, for anyone to take
    const oy = Math.atan2(old.fwd.x, old.fwd.z), op = old.pos.clone(), oc = G.CHASSIS[(L.load || {}).chassis] || {name:'aeroplane'};
    this.removeNetPlane(g, old); L.proxy = null;
    g.parkPlane({loadout:L.load || G.stockLoadout('gallant'), pos:op, yaw:oy, label:`${L.name}'s ${oc.name}`});
    L.load = this.cleanLoad(load);
    L.send({t:'took', nid:m.nid | 0, L:L.load, p:[at.x, at.y, at.z], y:yaw});
    G.HUD.feed(`${L.name} has taken ${spot.label}`);
  },
  guestTook(g, m){
    g.swapAsked = 0;
    if (!m.L || !G.CHASSIS[m.L.chassis] || !Array.isArray(m.p) || m.p.length < 3 || m.p.some(x => typeof x !== 'number' || !isFinite(x))) return;
    const L = this.cleanLoad(m.L), was = g.player, yaw = +m.y || 0;
    this.localSpawn = true;
    const np = g.addPlane({loadout:L, team:0, name:was ? was.name : 'Ace', callsign:was ? was.callsign : 'Ace', pos:new V3(m.p[0], m.p[1], m.p[2]), q:new Q().setFromAxisAngle(new V3(0, 1, 0), yaw), speed:0});
    this.localSpawn = false;
    const sp = g.park(np, {yaw}); g.parkedSpots = g.parkedSpots.filter(s => s !== sp);
    g.swapPlayer(np, {keepOld:false});
  },
  removeNetPlane(g, p){ p.alive = false; g.scene.remove(p.obj); g.planes = g.planes.filter(x => x !== p); g.pilots = g.pilots.filter(pl => pl.p !== p); },
  byNid(g, n){ return n ? g.planes.find(p => p.nid === n) || null : null; },

  /* a guest's plane state arrives: move (or make) their stand-in */
  guestState(g, L, m){
    if (!Array.isArray(m.p) || m.p.length < 10 || m.p.some(x => typeof x !== 'number' || !isFinite(x))) return;
    let p = L.proxy;
    if (!p && m.a) {
      p = g.addPlane({loadout:L.load || G.stockLoadout('gallant'), team:0, name:L.name, callsign:L.name, pos:new V3(m.p[0], m.p[1], m.p[2]), speed:m.s || 60});
      p.remote = L; p.human = true; L.proxy = p; p.net = {p:new V3(), q:new Q(), v:new V3(), at:g.t};
      G.HUD.feed(`${L.name} is in the air`);
    }
    if (!p || !p.alive) return;
    const n = p.net; n.p.set(m.p[0], m.p[1], m.p[2]); n.q.set(m.p[3], m.p[4], m.p[5], m.p[6]).normalize(); n.v.set(m.p[7], m.p[8], m.p[9]); n.at = g.t;
    p.speed = +m.s || 0; p.fire = !!(m.f & 2); p.fireRk = !!(m.f & 4); p.gearUp = (m.g ?? 1) > 0.5; p.flaps = !!(m.f & 8); if (m.pt) p.setParts(m.pt);
  },

  /* host: damage meant for a guest's stand-in goes to the guest, whose plane takes it */
  forwardDamage(p, dmg, facing, ammo, src, o){
    if (!p.alive || !p.remote) return;
    p.hitFlash = 0.15; p.lastHitBy = src;
    p.remote.send({t:'dmg', d:r2(dmg), f:facing, a:ammo && ammo.id || 'slug', s:src && src.nid || 0, o:{armorMul:o.armorMul, wingMul:o.wingMul, pen:o.pen, sp:o.splashParts ? 1 : 0}});
    if (p.g.onHit) p.g.onHit(p, src, dmg, facing);
  },

  hostFrame(g, dt){
    if (this.vs) this.vsFrame(g, dt);
    if (!this.links.length || g.paused) return;
    g.snapT -= dt; if (g.snapT > 0) return; g.snapT = 1/SNAP_HZ;
    const P = [], S = [];
    for (const p of g.planes) {
      if (!p.nid) this.tagPlane(g, p);
      const f = (p.alive ? 1 : 0) | (p.fire ? 2 : 0) | (p.fireRk ? 4 : 0) | (p.obj.visible === false || p.docked ? 8 : 0) | (p.onGround ? 16 : 0);
      P.push([p.nid, r2(p.pos.x), r2(p.pos.y), r2(p.pos.z), r4(p.q.x), r4(p.q.y), r4(p.q.z), r4(p.q.w), r2(p.vel.x), r2(p.vel.y), r2(p.vel.z), f, r2(p.gearT || 0), r2(p.speed), p.internalMax ? r2(p.internal/p.internalMax) : 1, p.partCode ? p.partCode() : 0]);
    }
    g.ships.forEach((s, i) => {
      const dead = s.comps ? s.comps.map((c, j) => c.alive ? -1 : j).filter(j => j >= 0) : [];
      S.push([i, r2(s.pos.x), r2(s.pos.y), r2(s.pos.z), r4(s.q.x), r4(s.q.y), r4(s.q.z), r4(s.q.w), r2(s.hp/s.hpMax), s.alive ? 1 : 0, dead]);
    });
    const X = (g.targets || []).map((t, i) => t.alive ? -1 : i).filter(i => i >= 0);
    // surface shipping: where each ship is on her lane, her way, her yaw and how badly she's hurt, so everyone sees the same ships
    const W = g.sea ? g.sea.ships.map((s, i) => [i, r2(s.s), r2(s.v), r4(s.yaw), r2(s.hp/s.hpMax), s.alive ? 1 : 0, s.gone ? 1 : 0]) : [];
    this.broadcast({t:'snap', T:r2(g.t), run:g.running ? 1 : 0, P, S, X, W, B:g.netShots || [], K:g.netFlak || []}); g.netShots = []; g.netFlak = [];
  },
  hostEnd(g, r){
    if (!this.links.length) return;
    const kp = g.mission.pay && g.mission.pay.kill || (g.mission.open ? 150 : 0);
    this.broadcast({t:'end', r:r ? JSON.parse(JSON.stringify(r)) : null, hk:g.kills || 0, kp});
  },
  onQuit(g){
    if (!g) return;
    if (this.g === g) this.vsQuit();
    if (g.netHost && this.role === 'host' && !g.done) this.broadcast({t:'end', r:null, note:`${G.save.callsign || 'The host'} went back aboard.`});
    if (g.netGuest && this.role === 'guest' && this.host) this.host.send({t:'leftgame'});
    if (this.g === g) this.g = null;
  },

  /* host-side event hooks (see the wrappers below) */
  hostHit(src){ if (src && src.remote) src.remote.send({t:'hit'}); },
  hostKill(plane, src){
    if (src && src.remote && plane.team !== 0) src.remote.send({t:'kill', name:plane.callsign || 'a bandit'});
    if (plane.remote) G.HUD.feed(`${plane.callsign} ${src ? 'was shot down' + (src.callsign ? ' by ' + src.callsign : '') : 'went down'}`);
  },

  /* ---------- co-op jobs: each pilot runs their own job; the planes it calls up are flown here, on the host ---------- */
  hostSpawn(g, L, m){
    const o = m.o || {}, set = L.spawned || (L.spawned = new Set());
    for (const p of set) if (!p.alive) set.delete(p);
    if (set.size >= 14 || !o.loadout || !G.CHASSIS[o.loadout.chassis]) return;
    const num = (v, d) => typeof v === 'number' && isFinite(v) ? v : d, pos = Array.isArray(o.pos) ? new V3(num(o.pos[0], 0), num(o.pos[1], 300), num(o.pos[2], 0)) : L.proxy ? L.proxy.pos.clone() : new V3(0, 300, 0);
    const q = Array.isArray(o.q) ? new Q(num(o.q[0], 0), num(o.q[1], 0), num(o.q[2], 0), num(o.q[3], 1)).normalize() : new Q();
    const L2 = Object.assign(G.stockLoadout(o.loadout.chassis), o.loadout); L2.chassis = o.loadout.chassis;
    const ai = o.ai && typeof o.ai === 'object' ? {role:o.ai.role === 'fighter' ? 'fighter' : 'fighter', skill:Math.max(0, Math.min(1, num(o.ai.skill, 0.5)))} : {role:'fighter', skill:0.5};
    this.spawnTid = String(m.tid || '').slice(0, 16);
    let p; try { p = g.addPlane({loadout:L2, team:1, name:String(o.name || 'Bandit').slice(0, 40), callsign:String(o.callsign || o.name || 'Bandit').slice(0, 40), pos, q, speed:num(o.speed, 80), ai, internalMul:Math.max(0.5, Math.min(2, num(o.internalMul, 1))), grace:num(o.grace, 0)}); } catch (e) {}
    this.spawnTid = null; if (!p) return;
    const f = m.f || {}; p.invuln = !!f.invuln; p.ace = !!f.ace; p.duel = !!f.duel; p.bountyJob = true; p.jobOwner = L; set.add(p);
    const pl = g.pilots.find(x => x.p === p), P = m.pl || {};
    if (pl) {
      if (Array.isArray(P.route)) { pl.route = P.route.slice(0, 80).map(w => ({x:num(w.x, 0), z:num(w.z, 0), y:w.y === undefined ? undefined : num(w.y, 100), r:num(w.r, 26)})); pl.wp = 0; }
      if (P.thr) pl.raceThrottle = Math.max(0.5, Math.min(1, num(P.thr, 0.9)));
      if (P.me && L.proxy) pl.target = L.proxy;
    }
  },
  dropSpawned(g, L){ if (!g || !L.spawned) return; for (const p of L.spawned) if (g.planes.includes(p)) this.removeNetPlane(g, p); L.spawned.clear(); },

  /* guest side: a job here asks for a plane; a stand-in appears at once and is tied to the host's plane when it arrives */
  remoteSpawn(g, o){
    const tid = 'j' + (++this.tseq), ai = o.ai;
    this.localSpawn = true; const p = g.addPlane(Object.assign({}, o, {ai:undefined})); this.localSpawn = false;
    p.puppet = true; p.remote = {id:'ai'}; p.tid = tid; p.net = {p:p.pos.clone(), q:p.q.clone(), v:new V3(0, 0, 1).applyQuaternion(p.q).multiplyScalar(o.speed || 80), at:g.t};
    (g.netTids || (g.netTids = new Map())).set(tid, p);
    let pl = null; if (ai) { pl = new JobPilot(g, p); g.pilots.push(pl); }
    Promise.resolve().then(() => {
      if (!this.host || p.netGone) return;
      const L = o.loadout || {};
      this.host.send({t:'spawn', tid, o:{loadout:{chassis:L.chassis, paint:L.paint, guns:L.guns, turrets:L.turrets, rocket:L.rocket, hp:L.hp, arm:L.arm, engine:L.engine},
        name:o.name, callsign:o.callsign, pos:o.pos ? [o.pos.x, o.pos.y, o.pos.z] : null, q:o.q ? [o.q.x, o.q.y, o.q.z, o.q.w] : null, speed:o.speed, ai, internalMul:o.internalMul, grace:o.grace},
        f:{invuln:!!p.invuln, ace:!!p.ace, duel:!!p.duel}, pl:pl ? {route:pl.route, thr:pl.raceThrottle, me:pl.target === g.player} : null});
    });
    return p;
  },
  remoteShip(g, o){
    const tid = 'z' + (++this.tseq); this.localSpawn = true; const s = g.addShip(o); this.localSpawn = false;
    s.tid = tid; (g.netTids || (g.netTids = new Map())).set(tid, s);
    if (this.host) this.host.send({t:'spawnShip', tid, o:specOf(o)});
    return s;
  },
  despawn(g, p){
    p.netGone = true; p.alive = false; g.scene.remove(p.obj); g.planes = g.planes.filter(x => x !== p); g.pilots = g.pilots.filter(pl => pl.p !== p);
    if (p.nid) { g.netPlanes.delete(p.nid); if (this.host) this.host.send({t:'despawn', nid:p.nid}); }
  },
  /* guest: the open-skies script runs here for this pilot's own flying, jobs, stunts and contacts; the host still owns every bandit */
  guestOpen(g, real, dt){
    const all = g.planes; g.planes = all.filter(p => !p.puppet);
    try { real.update(g, dt); }
    finally { const now = g.planes; g.planes = all.filter(p => !p.netGone && (p.puppet || now.includes(p))).concat(now.filter(p => !all.includes(p))); }
  },

  /* ======================= guest ======================= */
  guestMsg(m){
    if (!m || typeof m !== 'object') return;
    const g = this.g;
    switch (m.t) {
      case 'roster': this.me = m.you; this.roster = Array.isArray(m.roster) ? m.roster.slice(0, 4) : []; this.render(); break;
      case 'full': this.status = 'That flight is full (four pilots).'; this.render(); break;
      case 'start': this.guestStart(m); break;
      case 'pl': if (this.g) this.guestPlane(this.g, m); else (this.pending || (this.pending = [])).push(m); break;
      case 'plmeta': if (g && G.game === g) this.guestMeta(g, m); break;
      case 'took': if (g && G.game === g) this.guestTook(g, m); break;
      case 'takeNo': if (g && G.game === g) { g.swapAsked = 0; G.HUD.toast(typeof m.why === 'string' ? m.why.slice(0, 80) : 'Somebody beat you to her'); } break;
      case 'snap': if (g && G.game === g) this.guestSnap(g, m); break;
      case 'dmg': if (g && G.game === g) this.guestDamage(g, m); break;
      case 'hit': if (g && G.game === g) { G.HUD.hitMark(); if (g.audio) g.audio.hitThem(); } break;
      case 'kill': if (g && G.game === g) g.kills++; break;   // the host's feed line already names us
      case 'hud': if (g && G.game === g) this.guestHud(m); break;
      case 'end': if (g && G.game === g) this.guestEnd(g, m); break;
      case 'ship': if (g && G.game === g) this.guestShip(g, m); break;
      case 'bye': this.lostHost(); break;
      default: if (typeof m.t === 'string' && m.t.slice(0, 2) === 'vs') this.vsMsg(m);
    }
  },
  guestStart(m){
    const M = G.MISSIONS[m.m]; if (!M) { this.status = 'The host is flying something this copy of the game doesn\'t have. Update the game.'; this.render(); return; }
    if (m.open && G.save.open) { const S = G.save.open; if (G.REGIONS[m.open.region]) S.region = m.open.region; if (m.open.hour != null) S.hour = m.open.hour | 0; }
    this.startMsg = m; this.pending = [];
    const UI = G.UI;
    if (UI) UI.netFly(M);
  },
  /* guest: the shared game has just been built on this machine; make it a puppet of the host's */
  becomeGuest(g){
    const m = this.startMsg || {ships:[]};
    this.g = g; this.vs = null; g.netGuest = true; g.hostName = m.host || 'Host'; g.lastSnap = 0; g.stateT = 0; g.netPlanes = new Map();
    // the mission's script runs on the host; here it only hangs us on the trapeze and lets us drop
    const real = g.mission, keep = {drop:1, hang:1, launch:1};
    if (real.open) {
      real.spawnWingmenSoon = 0; const skip = {onKill:1, onShipDown:1, onShipSurrender:1, onShipCaptured:1, result:1};
      g.mission = new Proxy(real, {get(t, k){
        if (k === 'update') return (gg, dt) => Net.guestOpen(gg, t, dt);
        if (k === 'playerDown') return () => Net.guestDown(g);
        if (k === 'canRedock') return () => false;
        const v = t[k];
        if (typeof v === 'function') return skip[k] ? () => {} : v.bind(t);
        return v;
      }});
    } else
    g.mission = new Proxy(real, {get(t, k){
      if (k === 'update') return () => {};
      if (k === 'playerDown') return () => Net.guestDown(g);
      if (k === 'canRedock') return () => false;
      const v = t[k];
      if (typeof v === 'function') return keep[k] ? v.bind(t) : () => {};
      return v;
    }});
    g.realMission = real;
    // no AI here: the host's planes arrive as puppets
    for (const p of g.planes.slice()) if (!p.isPlayer) this.removeNetPlane(g, p);
    g.pilots = [];
    // ships: keep the ones this machine built in the same order, build any it's missing, drop extras
    const want = m.ships || [];
    want.forEach((w, i) => {
      const s = g.ships[i];
      if (s && s.kind === w.kind) return;
      if (w.spec) { const ns = new G.Airship(g, unspec(w.spec)); if (s) { g.scene.remove(s.obj); g.ships[i] = ns; } else g.ships[i] = ns; }
    });
    for (const s of g.ships.slice(want.length)) g.scene.remove(s.obj);
    g.ships.length = Math.min(g.ships.length, want.length);
    g.onKill = function(plane){ if (this.audio) this.audio.boom(plane.pos, true); this.spawnChute(tA.copy(plane.pos).add(new V3(0, 6, 0)), plane.vel); if (plane.isPlayer) Net.guestDown(this, plane.lastHitBy); };
    for (const pm of this.pending || []) this.guestPlane(g, pm); this.pending = [];
  },
  guestPlane(g, m){
    if (m.owner && m.owner === this.me) return;   // that's my own stand-in on the host
    if (g.netPlanes.has(m.nid)) return;
    const mine = m.tid && g.netTids && g.netTids.get(m.tid);
    if (mine && m.tid[0] === 'j') { g.netTids.delete(m.tid); if (mine.netGone) { if (this.host) this.host.send({t:'despawn', nid:m.nid}); return; } mine.nid = m.nid; g.netPlanes.set(m.nid, mine); return; }
    const L = G.stockLoadout(G.CHASSIS[m.L && m.L.chassis] ? m.L.chassis : 'vandal');
    try { if (m.L.paint) L.paint = m.L.paint.slice(0, 3).map(x => x | 0); if (Array.isArray(m.L.guns) && m.L.guns.length === L.guns.length) L.guns = m.L.guns.map(x => ({cal:x && G.GUNS[x.cal] ? x.cal : null, ammo:'slug'})); if (Array.isArray(m.L.turrets)) L.turrets = m.L.turrets.filter(t => t && G.GUNS[t.cal]).map(t => ({cal:t.cal, ammo:'slug'})); if (G.ROCKETS[m.L.rocket]) L.rocket = m.L.rocket; } catch (e) {}
    this.localSpawn = true; const p = g.addPlane({loadout:L, team:m.team === 0 ? 0 : 1, name:String(m.name || '').slice(0, 30), callsign:String(m.cs || m.name || '').slice(0, 30), pos:new V3(0, -9999, 0)}); this.localSpawn = false;
    p.nid = m.nid; p.remote = {id:m.owner || 'ai'}; p.ace = !!m.ace; p.puppet = true; p.net = {p:new V3(0, -9999, 0), q:new Q(), v:new V3(), at:-1};
    p.obj.visible = false;
    g.netPlanes.set(m.nid, p);
    if (typeof m.pk === 'string') this.markParked(g, p, m.pk, m.ho);
  },
  guestSnap(g, m){
    g.lastSnap = g.t; if (g.waitBanner) { g.waitBanner = false; G.HUD.banner(null); }
    const seen = new Set();
    for (const e of m.P || []) {
      const p = g.netPlanes.get(e[0]); if (!p) continue; seen.add(e[0]);
      const n = p.net, first = n.at < 0;
      n.p.set(e[1], e[2], e[3]); n.q.set(e[4], e[5], e[6], e[7]).normalize(); n.v.set(e[8], e[9], e[10]); n.at = g.t;
      const f = e[11];
      if (first) { p.pos.copy(n.p); p.q.copy(n.q); p.obj.visible = !!(f & 1) && !(f & 8); }
      p.fire = !!(f & 2); p.fireRk = !!(f & 4); p.gearUp = e[12] > 0.5; p.speed = e[13]; p.onGround = !!(f & 16); if (typeof e[14] === 'number' && p.internalMax) p.internal = Math.max(0, e[14])*p.internalMax; if (p !== g.player && p.setParts) p.setParts(e[15]);
      if (p.alive && !(f & 1)) { p.lastHitBy = null; p.destroy(null, 'shot'); }
      else if (p.alive) p.obj.visible = !(f & 8);
    }
    for (const [nid, p] of g.netPlanes) if (!seen.has(nid)) { this.removeNetPlane(g, p); g.netPlanes.delete(nid); }
    for (const e of m.S || []) {
      const s = g.ships[e[0]]; if (!s) continue;
      s.net = s.net || {p:new V3(), q:new Q()}; s.net.p.set(e[1], e[2], e[3]); s.net.q.set(e[4], e[5], e[6], e[7]).normalize();
      if (!s.netInit) { s.netInit = true; s.pos.copy(s.net.p); s.q.copy(s.net.q); }
      s.hp = e[8]*s.hpMax;
      if (s.comps) for (const j of e[10] || []) { const c = s.comps[j]; if (c && c.alive) this.partGone(g, s, c); }
      if (s.alive && !e[9]) { s.alive = false; s.state = 'destroyed'; if (g.audio) g.audio.boom(s.pos, true); const R = g.realMission; if (R && R.open && R.job && R.job.onShipDown) R.job.onShipDown(s); }
    }
    // the ships' tracers and flak, drawn here as harmless copies
    for (const b of (m.B || []).slice(0, 60)) { const s = g.ships[b[0]]; if (!s || !Array.isArray(b) || b.length < 8) continue; const d = new V3(b[4], b[5], b[6]); if (!isFinite(d.x)) continue; g.spawnRaw(s, new V3(b[1], b[2], b[3]), d.normalize(), G.GUNS[b[7] === 40 ? '40' : '50'], G.AMMO.slug, s.vel || new V3()); }
    for (const k of (m.K || []).slice(0, 20)) { const s = g.ships[k[0]]; if (!s || !Array.isArray(k) || k.length < 8) continue; g.flakShell(s, new V3(k[1], k[2], k[3]), new V3(k[4], k[5], k[6]), Math.min(4, Math.max(0, +k[7] || 0))); }
    if (g.sea && Array.isArray(m.W)) for (const e of m.W) { const s = g.sea.ships[e[0] | 0]; if (s && Array.isArray(e)) g.sea.netState(s, e); }
    for (const i of m.X || []) { const t = g.targets && g.targets[i]; if (t && t.alive) { t.alive = false; if (t.group) t.group.visible = false; g.fx.explosion(t.pos, 1.6); if (g.audio) g.audio.boom(t.pos, true); } }
  },
  guestShip(g, m){
    const i = m.i | 0; if (i < 0 || i > 40 || !m.spec) return;
    const mine = m.tid && g.netTids && g.netTids.get(m.tid);
    if (mine) { g.netTids.delete(m.tid); const at = g.ships.indexOf(mine); if (at >= 0) g.ships.splice(at, 1); const old = g.ships[i]; if (old && old !== mine) g.ships.push(old); g.ships[i] = mine; return; }
    if (g.ships[i]) return;
    try { this.localSpawn = true; const s = g.addShip(unspec(m.spec)); this.localSpawn = false; g.ships.pop(); g.ships[i] = s; } catch (e) { this.localSpawn = false; }
  },
  partGone(g, s, c){
    c.alive = false; c.hp = 0;
    const w = s.worldPoint(c.pos, new V3());
    if (c.group) c.group.visible = false;
    g.fx.explosion(w, c.kind === 'cell' ? 1.6 : 1.1); if (g.audio) g.audio.boom(w, c.kind !== 'cell');
    (s.wrecks || (s.wrecks = [])).push({c, t:0});
  },
  guestDamage(g, m){
    const P = g.player; if (!P || !P.alive || P.frozen) return;
    const d = Math.max(0, Math.min(400, +m.d || 0)), f = Math.max(0, Math.min(3, m.f | 0));
    P.damage(d, f, G.AMMO[m.a] || G.AMMO.slug, g.netPlanes.get(m.s) || null, {armorMul:+m.o?.armorMul || undefined, wingMul:+m.o?.wingMul || undefined, pen:typeof m.o?.pen === 'number' ? Math.max(0, Math.min(1, m.o.pen)) : undefined, splashParts:!!m.o?.sp, net:true});
  },
  guestHud(m){
    const txt = s => String(s ?? '').slice(0, 300);
    if (m.k === 'radio') G.HUD.radio(txt(m.who), txt(m.text));
    else if (m.k === 'feed') G.HUD.feed(txt(m.text), false);
    else if (m.k === 'obj' && !(this.g && this.g.realMission && this.g.realMission.open)) G.HUD.objective(txt(m.text));
  },
  guestDown(g, src){
    if (g.downSent) return; g.downSent = true;
    if (this.host) this.host.send({t:'dead', by:src && src.nid || 0, how:'shot'});
    G.HUD.banner('Shot down', `Watching ${g.hostName}. You'll be back for the next sortie.`);
    // ride along behind the host until the sortie ends
    g.cine = (dt, cam) => {
      const H = [...g.netPlanes.values()].find(p => p.remote && p.remote.id === 'host');
      if (!H) return;
      tA.copy(H.pos).addScaledVector(H.fwd, -26).add(new V3(0, 7, 0)); cam.position.lerp(tA, 1 - Math.exp(-dt*3)); cam.lookAt(H.pos);
    };
  },
  guestEnd(g, m){
    if (g.done) return; g.done = true; g.running = false;
    if (!m.r) { G.HUD.banner('Back to the Margaret', String(m.note || 'The host ended the flight.').slice(0, 80)); setTimeout(() => { if (G.game === g && G.UI) { G.UI.quit(); G.UI.menu(); } }, 3000); return; }
    const r = m.r, kp = +m.kp || 0, hk = +m.hk || 0;
    // the job pays everyone; each pilot keeps their own bounties
    const base = Math.max(0, (+r.cash || 0) - hk*kp*(r.kind === 'fail' ? 0.5 : 1));
    r.cash = Math.round(base + g.kills*kp*(r.kind === 'fail' ? 0.5 : 1)); r.kills = g.kills; r.shown = r.cash;
    if (!Array.isArray(r.sides)) r.sides = [];
    const R = g.realMission; if (r.open && R) { r.shown = (R.earned || 0) + r.cash; r.sides = r.sides.map(sd => sd && sd.text === 'Earned' ? Object.assign({}, sd, {val:'$' + r.shown.toLocaleString(), st:r.shown ? 'ok' : 'fail'}) : sd); }
    setTimeout(() => { if (G.audio) G.audio.stopAll(); if (G.UI) G.UI.debrief(g, r); }, 3500);
  },

  guestFrame(g, dt){
    if (this.vs) this.vsFrame(g, dt);
    if (!this.host) return;
    if (g.t - g.lastSnap > 2 && !g.done && !g.waitBanner && g.lastSnap > 0) { g.waitBanner = true; G.HUD.banner(`Waiting for ${g.hostName}`, 'The host has paused or lost the line'); }
    g.stateT -= dt; if (g.stateT > 0) return; g.stateT = 1/STATE_HZ;
    const P = g.player; if (!P) return;
    const hasAmmo = P.guns.some(gn => gn.rounds > 0);
    const f = (P.alive ? 1 : 0) | (P.fire && hasAmmo ? 2 : 0) | (P.fireRk && P.rockets > 0 ? 4 : 0) | (P.flaps ? 8 : 0);
    if (P.frozen) return;   // still on the trapeze: the host doesn't see us yet
    this.host.send({t:'st', p:[r2(P.pos.x), r2(P.pos.y), r2(P.pos.z), r4(P.q.x), r4(P.q.y), r4(P.q.z), r4(P.q.w), r2(P.vel.x), r2(P.vel.y), r2(P.vel.z)], s:r2(P.speed), f, g:r2(P.gearT || 0), a:P.alive ? 1 : 0, pt:P.partCode()});
  },
  sendOrder(o){ if (this.host) { this.host.send({t:'order', o}); G.HUD.toast('Wingmen: ' + G.ORDER_NAMES[o]); } },

  /* ======================= lobby card ======================= */
  render(){
    if (typeof document === 'undefined') return;
    const el = document.getElementById('coop'); if (!el || !el.querySelector) return;
    const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
    if (!this.available()) { el.innerHTML = `<label class="lbl">Co-op</label><p class="co-note">Co-op flies peer to peer and needs the web version of the game (on GitHub Pages). This copy can't open a line.</p>`; return; }
    let body;
    if (!this.role) body = `<div class="row"><button class="btn sm" onclick="G.Net.hostGame()">Host a flight</button><input id="coCode" maxlength="4" placeholder="CODE" autocomplete="off" spellcheck="false"><button class="btn ghost sm" onclick="G.Net.joinGame(document.getElementById('coCode').value)">Join</button></div>`;
    else {
      const names = this.role === 'host' ? [`${G.save.callsign || 'Ace'} (you, host)`, ...this.links.map(L => L.name)] : this.roster.map(r => r.name + (r.host ? ' (host)' : '') + (r.id === this.me ? ' (you)' : ''));
      body = `<div class="co-code">${this.role === 'host' ? 'Game code' : 'Joined'} <b>${esc(this.code)}</b></div>
        <ul class="co-list">${names.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        <div class="row"><button class="btn ghost sm" onclick="G.Net.leave()">Leave</button></div>`;
    }
    el.innerHTML = `<label class="lbl">Co-op · up to four pilots</label>${body}${this.status ? `<p class="co-note">${esc(this.status)}</p>` : ''}${this.role === 'host' ? '<p class="co-note">Pick a mission and press Fly. Everyone launches with you, in their own planes.</p>' : ''}`;
  }
};

/* ---------- hooks into the game ---------- */
const GP = G.Game.prototype;
const addPlane0 = GP.addPlane;
GP.addPlane = function(o){
  if (this.netGuest && !Net.localSpawn && this.realMission && this.realMission.open && o && o.team !== 0) return Net.remoteSpawn(this, o);
  const p = addPlane0.call(this, o); if (this.netHost) Net.tagPlane(this, p); return p;
};
const addShip0 = GP.addShip;
GP.addShip = function(o){
  if (this.netGuest && !Net.localSpawn && this.realMission && this.realMission.open) return Net.remoteShip(this, o);
  const s = addShip0.call(this, o); s.spec = specOf(o);
  if (this.netHost && Net.links.length && Net.g === this) Net.broadcast({t:'ship', i:this.ships.indexOf(s), spec:s.spec, tid:Net.spawnTid || undefined});
  return s;
};
/* open skies in co-op: nobody's contact screen stops the world for the others; bandits only come for the host's flight */
{
  const O = G.MISSIONS.open, coop = g => g && ((g.netHost && Net.links.length) || g.netGuest);
  const enc0 = O.encounters; O.encounters = function(g, dt){ if (g.netGuest) return; return enc0.call(this, g, dt); };
  const rm0 = O.removePlane; O.removePlane = function(p){ const g = this.g; if (g && g.netGuest && p.puppet) return Net.despawn(g, p); return rm0.call(this, p); };
  const meet0 = O.meet; O.meet = function(site){
    const g = this.g, r = meet0.call(this, site);
    if (coop(g) && this.atSite) { g.paused = false; if (G.audio.ctx) G.audio.ctx.resume(); const P = g.player; P.meetHold = {noTarget:P.noTarget, invuln:P.invuln}; P.noTarget = true; P.invuln = true; }
    return r;
  };
  const leave0 = O.leave; O.leave = function(){ const P = this.g && this.g.player; if (P && P.meetHold) { P.noTarget = P.meetHold.noTarget; P.invuln = P.meetHold.invuln; P.meetHold = null; } return leave0.apply(this, arguments); };
}
const onHit0 = GP.onHit; GP.onHit = function(t, src, d, f){ if (this.netHost) Net.hostHit(src); return onHit0.call(this, t, src, d, f); };
const onPartHit0 = GP.onPartHit; GP.onPartHit = function(s, c, src){ if (this.netHost) Net.hostHit(src); return onPartHit0.call(this, s, c, src); };
const onKill0 = GP.onKill; GP.onKill = function(plane, src, how){ if (this.netHost) Net.hostKill(plane, src || plane.lastHitBy); return onKill0.call(this, plane, src, how); };
const end0 = GP.end; GP.end = function(r){ if (this.netHost && !this.done) Net.hostEnd(this, r); return end0.call(this, r); };
const spawnW0 = GP.spawnWingmen; GP.spawnWingmen = function(n){ return spawnW0.call(this, this.netHost ? Math.max(0, n - Net.links.length) : n); };
const key0 = GP.key;
GP.key = function(code, down){
  if (this.netGuest && down && G.ORDERS[code]) { this.keys[code] = down; Net.sendOrder(G.ORDERS[code]); return; }
  return key0.call(this, code, down);
};

/* airship fire: the host notes every machine-gun round and flak shell a ship sends, so guests can draw the same tracers and bursts */
const raw0 = GP.spawnRaw;
GP.spawnRaw = function(owner, pos, dir, def, ammo, baseVel){
  if (this.netHost && Net.links.length && owner && owner.isShip !== false && this.ships.includes(owner)) {
    const B = this.netShots || (this.netShots = []); if (B.length < 60) B.push([this.ships.indexOf(owner), r2(pos.x), r2(pos.y), r2(pos.z), r4(dir.x), r4(dir.y), r4(dir.z), def === G.GUNS['40'] ? 40 : 50]);
  }
  return raw0.call(this, owner, pos, dir, def, ammo, baseVel);
};
const flak0 = GP.flakShell;
GP.flakShell = function(ship, from, at, t){
  if (this.netHost && Net.links.length) { const K = this.netFlak || (this.netFlak = []); if (K.length < 20) K.push([Math.max(0, this.ships.indexOf(ship)), r2(from.x), r2(from.y), r2(from.z), r2(at.x), r2(at.y), r2(at.z), r2(t)]); }
  return flak0.call(this, ship, from, at, t);
};
/* the host repeats radio, kill feed and objectives to everyone */
for (const [k, fn] of [['radio', (who, text) => ({k:'radio', who, text})], ['feed', text => ({k:'feed', text})], ['objective', text => ({k:'obj', text})]]) {
  const orig = G.HUD[k];
  G.HUD[k] = function(...a){
    const g = G.game;
    if (g && g.netHost && Net.links.length && !Net.quiet) {
      const m = fn(...a);
      if (k === 'objective') { if (Net.lastObj === m.text) return orig.apply(this, a); Net.lastObj = m.text; }   // objectives are set every frame; send changes only
      if (m.text && k === 'feed') m.text = String(m.text).replace(/^You\b/, G.save.callsign || 'The host');
      Net.broadcast(Object.assign({t:'hud'}, m));
    }
    return orig.apply(this, a);
  };
}

/* puppets: planes whose state comes over the wire (guests' stand-ins on the host, everyone else's planes on a guest) */
G.Plane.prototype.remoteUpdate = function(dt){
  const n = this.net, g = this.g;
  if (n && n.at >= 0) {
    const age = Math.min(0.4, g.t - n.at), k = 1 - Math.exp(-dt*12);
    tA.copy(n.p).addScaledVector(n.v, age);
    if (this.pos.distanceToSquared(tA) > 250*250) this.pos.copy(tA); else this.pos.lerp(tA, k);
    this.q.slerp(n.q, k); this.vel.copy(n.v);
  }
  this.axes(); if (this.damageFx) this.damageFx(dt);
  for (const gn of this.guns) gn.rounds = gn.def.ammo;   // the guest counts their own ammo; a stand-in never runs dry first
  if (!this.onGround) { this.updateGuns(dt); this.updateRockets(dt); if (this.turrets.length) this.updateTurrets(dt); }
  if (this.rockets < 2) this.rockets = 6;
  this.sync(dt);
};
/* ======================= versus: races and stunt shows against each other =======================
   When a pilot in open-skies co-op takes a race or a stunt show, everyone else is invited (vsInvite). Pilots
   with no job of their own who fly into the start area (or the show box) inside 20 s join (vsJoin) and get
   their own copy of the job (a race without AI rivals: those fly once, in the job of the pilot who started it).
   When everyone has joined or turned it down (vsBusy), or the 20 s are up, and the starter is at the start
   too, the starter calls vsStart; every machine counts down 3 s and the job begins for all at once.
   Each pilot flies and scores their own copy and sends vsProg a few times a second (the starter adds their
   rivals); the last vsProg (done) carries the finish time or the show total. The judge (the starter, or the
   host if the starter drops out) settles the order and sends vsResult; each pilot is paid on their own save.
   Guests only talk to the host, which relays every vs message to everyone else. */
const VS_WIN = 20, VS_COUNT = 3, VS_HZ = 4, VS_SHARE = [1, 0.4, 0.25, 0.15];
const vsOrd = n => ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][n] || n + 'th';
const vsFmt = t => `${Math.floor(t/60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const vsJob = id => (G.JOBS || []).find(j => j.id === id);
const MEDALS = {gold:1, silver:1, bronze:1};
Object.assign(Net, {
  vs:null, vseq:0,
  myPid(){ return this.role === 'host' ? 'host' : this.me; },
  pilotName(pid){
    if (pid === this.myPid()) return G.save.callsign || 'Ace';
    if (this.role === 'host') { const L = this.links.find(x => x.id === pid); return L ? L.name : 'Pilot'; }
    const r = this.roster.find(x => x.id === pid); return r ? r.name : 'Pilot';
  },
  otherPids(){ return this.role === 'host' ? this.links.map(L => L.id) : this.roster.map(r => r.id).filter(id => id && id !== this.me); },
  vsO(){ const g = this.g; if (!g || G.game !== g) return null; const O = g.realMission || g.mission; return O && O.open ? O : null; },
  local(fn){ const q = this.quiet; this.quiet = true; try { return fn(); } finally { this.quiet = q; } },   // HUD lines for this pilot only (the host repeats radio to everyone otherwise)
  vsSend(m){
    m.from = this.myPid(); this.vsMsg(m);
    if (this.role === 'host') this.broadcast(m); else if (this.host) this.host.send(m);
  },
  vsRelay(L, m){ m.from = L.id; delete m.pid; delete m.gone; this.broadcast(m, L); this.vsMsg(m); },   // a guest's word, passed on to the others
  vsGone(pid){ if (this.role !== 'host' || !this.vs) return; for (const s of [...this.vs.values()]) if (s.phase !== 'done' && (s.joined.has(pid) || (s.pilots && s.pilots.includes(pid)) || s.owner === pid)) this.vsSend({t:'vsLeave', vid:s.vid, pid, gone:1}); },
  vsQuit(){ if (this.vs) for (const s of this.vs.values()) if (s.J && !s.settled && s.phase !== 'done') { s.settled = true; this.vsSend({t:'vsLeave', vid:s.vid}); } this.vs = null; },

  /* every machine runs every vs message the same way, its own included */
  vsMsg(m){
    if (typeof m.vid !== 'string' || m.vid.length > 24) return;
    const S = this.vs || (this.vs = new Map()), me = this.myPid(), from = m.from;
    let s = S.get(m.vid);
    switch (m.t) {
      case 'vsInvite': {
        const def = vsJob(m.job), at = Array.isArray(m.at) && m.at.length === 3 && m.at.every(x => typeof x === 'number' && isFinite(x)) ? new V3(...m.at) : null;
        if (s || !def || !at || (def.type !== 'race' && def.type !== 'stunt')) return;
        s = {vid:m.vid, owner:from, judge:from, job:def.id, type:def.type, title:def.title, at, rad:Math.max(100, Math.min(2000, +m.rad || 600)), until:VS_WIN, phase:'invite',
          joined:new Set([from]), busy:new Set(), pilots:null, prog:new Map(), rivals:[], hadRivals:false, names:{[from]:String(m.name || this.pilotName(from)).slice(0, 18)}, t:0, sendT:0};
        S.set(m.vid, s);
        if (from === me) return;
        const O = this.vsO(), who = s.names[from], what = `${s.type === 'race' ? 'racing' : 'flying a stunt show,'} ${s.title}`;
        const cant = !O || O.job || O.ended || !O.g.player.alive ? 'You\'re busy with a job of your own.' : def.needs && O.g.player.L.chassis !== def.needs ? `It takes a ${G.CHASSIS[def.needs].name}.` : '';
        if (cant) { s.iBusy = true; this.local(() => G.HUD.feed(`${who} is ${what}. ${cant}`, false)); this.vsSend({t:'vsBusy', vid:s.vid}); return; }
        const txt = `${who} is ${what} — fly to the ${s.type === 'race' ? 'start' : 'show box'} and join! ${VS_WIN} s`;
        this.local(() => { G.HUD.radio(who, txt); G.HUD.toast(txt); });
        return;
      }
      case 'vsBusy': if (s) s.busy.add(from); return;
      case 'vsJoin':
        if (!s || s.phase !== 'invite') return;
        s.joined.add(from); s.names[from] = this.pilotName(from);
        if (from !== me) this.local(() => G.HUD.feed(`${s.names[from]} joined ${s.title}`, false));
        return;
      case 'vsCancel': if (s && from === s.owner && s.phase !== 'done') this.vsEnd(s); return;
      case 'vsStart': {
        if (!s || from !== s.owner || s.phase !== 'invite' || !Array.isArray(m.pilots)) return;
        s.pilots = m.pilots.filter(p => typeof p === 'string').slice(0, 4);
        if (m.names && typeof m.names === 'object') for (const p of s.pilots) s.names[p] = String(m.names[p] || s.names[p] || this.pilotName(p)).slice(0, 18);
        s.lim = Math.max(10, +m.lim || 600); s.nR = Math.max(1, m.nR | 0); s.phase = 'count'; s.count = VS_COUNT; s.lastN = 0;
        for (const p of s.pilots) s.prog.set(p, {v:0});
        if (s.J && !s.pilots.includes(me)) { this.vsDropJob(s); this.local(() => G.HUD.toast(`Too late: ${s.title} started without you`)); }
        return;
      }
      case 'vsProg': {
        if (!s || !s.pilots || !s.pilots.includes(from) || s.phase === 'done') return;
        if (from === s.owner && Array.isArray(m.R)) { s.rivals = m.R.slice(0, 6).filter(Array.isArray).map(r => ({name:String(r[0] || 'Rival').slice(0, 30), v:+r[1] || 0, fin:typeof r[2] === 'number' ? r[2] : null, rival:true})); if (s.rivals.length) s.hadRivals = true; }
        const e = s.prog.get(from); if (!e || e.done) return;
        e.v = +m.v || 0;
        if (m.done) { e.done = true; e.dnf = !!m.dnf; e.fin = typeof m.fin === 'number' && isFinite(m.fin) ? m.fin : null; e.medal = MEDALS[m.medal] ? m.medal : null; e.hit = !!m.hit; if (e.fin === null && s.type === 'race') e.dnf = true; }
        return;
      }
      case 'vsLeave': {
        if (!s) return;
        const pid = from === 'host' && typeof m.pid === 'string' ? m.pid : from, gone = from === 'host' && m.gone;
        if (pid === s.owner && s.phase !== 'go' && s.phase !== 'done') { this.vsEnd(s); return; }
        if (s.phase === 'invite') { s.joined.delete(pid); s.busy.add(pid); return; }
        if (s.pilots) { s.pilots = s.pilots.filter(p => p !== pid); s.prog.delete(pid); }
        if (pid === s.owner && gone) { s.judge = 'host'; s.rivals = []; }   // the starter's line went dead: the host settles it, and their rivals went with them
        if (pid !== me && s.phase !== 'done') this.local(() => G.HUD.feed(`${s.names[pid] || 'A pilot'} dropped out of ${s.title}`, false));
        return;
      }
      case 'vsResult':
        if (!s || from !== s.judge || s.phase === 'done' || !Array.isArray(m.rows)) return;
        s.rows = m.rows.slice(0, 12); s.phase = 'done'; s.showT = 15; this.vsSettle(s);
        return;
    }
  },
  vsEnd(s){
    // called off before the start: joiners drop their copy; the starter carries on alone, as a normal job
    if (s.J) {
      if (s.owner !== this.myPid()) this.vsDropJob(s);
      else { s.solo = true; const O = this.vsO(); if (s.wantBegin != null && O && O.job === s.J && !s.J.started && this.g.t - s.wantBegin < 2) s.J.begin(); }   // crossed the start just as everyone turned it down: off you go
    }
    this.vs.delete(s.vid);
  },
  vsDropJob(s){
    const O = this.vsO(), J = s.J; s.J = null; s.settled = true;
    if (O && O.job === J) { O.job = null; if (J.cleanup) J.cleanup(); O.g.markers = []; }
  },

  /* this pilot flies into the start: they're in */
  vsJoin(s, O){
    const def = vsJob(s.job); if (!def) return;
    this.vsJoining = s;
    try { this.local(() => O.startJob(s.type === 'race' ? Object.assign({}, def, {rivals:0}) : def, null)); } finally { this.vsJoining = null; }
    if (!s.J) return;
    s.iJoined = true; this.vsSend({t:'vsJoin', vid:s.vid});
    this.local(() => G.HUD.toast(`Joined ${s.title}`));
  },
  /* a race or show in the versus: held until the start, then flown as normal, then held again until the result */
  vsArm(s, J){
    const up0 = J.update, beg0 = J.begin, pts0 = J.onPoints, ob0 = J.objective, race = s.type === 'race', def = J.def;
    s.J = J; s.def = def; J.vsS = s;
    if (beg0) J.begin = function(){ if (s.solo || s.phase === 'go') return beg0.apply(this, arguments); if (s.owner === Net.myPid()) s.wantBegin = Net.g ? Net.g.t : 0; };
    if (pts0) J.onPoints = function(){ if (s.solo || (s.phase === 'go' && !s.myDone)) return pts0.apply(this, arguments); };
    J.update = dt => {
      if (s.solo) return up0(dt);
      if (s.phase === 'invite' || s.phase === 'count') { up0(dt); if (!race) { J.t = 0; J.score = 0; } return; }
      if (s.phase === 'go' && !s.myDone) {
        if (race) { if (up0(dt)) { s.myDone = true; this.vsDone(s, J); } return; }
        if (J.t + dt >= def.time) { J.t = def.time; s.myDone = true; this.vsDone(s, J); return; }
        const r = up0(dt); if (r && r.win && J.hitT == null) J.hitT = J.t;
        return;
      }
      J.t += dt;   // across the line: wait for the others (the rivals' clock keeps running)
    };
    J.objective = () => {
      if (s.solo) return ob0();
      const ow = s.names[s.owner] || 'the starter';
      if (s.phase === 'invite') {
        if (s.owner !== this.myPid()) return `${s.title}: waiting at the ${race ? 'start' : 'show box'} for ${ow} · ${Math.max(0, Math.ceil(s.until))} s`;
        const n = s.joined.size - 1, there = this.g.player.pos.distanceTo(s.at) < s.rad;
        return `${s.title}: ${there ? 'waiting for the others' : `fly to the ${race ? 'start' : 'show box'}`} · ${n} pilot${n === 1 ? '' : 's'} joined${s.until > 0 ? ` · ${Math.ceil(s.until)} s` : ''}`;
      }
      if (s.phase === 'count') return `${s.title}: starting in ${Math.max(1, Math.ceil(s.count))}`;
      if (s.myDone) return `${s.title}: ${race ? (J.fin ? `finished in ${vsFmt(J.finT)}` : 'out of the race') : `${Math.round(J.score).toLocaleString()} points`} · waiting for the others`;
      return ob0();
    };
  },
  vsDone(s, J){
    if (s.type === 'race') this.vsSend(J.fin ? {t:'vsProg', vid:s.vid, done:1, v:J.nRings, fin:J.finT, medal:J.medalFor(J.finT) || undefined, R:this.vsRivals(s, J)} : {t:'vsProg', vid:s.vid, done:1, dnf:1, v:J.progOf(this.g.player.pos, J.k)});
    else { const d = s.def, hit = J.score >= d.target, h = J.hitT ?? d.time; this.vsSend({t:'vsProg', vid:s.vid, done:1, v:Math.round(J.score), hit, medal:hit ? (h < d.time*0.45 ? 'gold' : h < d.time*0.7 ? 'silver' : 'bronze') : undefined}); }
  },
  vsRivals(s, J){ return s.owner === this.myPid() && J.rivals && J.rivals.length ? J.rivals.map(r => [r.p.callsign, Math.round(J.progOf(r.p.pos, Math.min(J.nRings, r.pl.wp + 1))*100)/100, r.pl.raceDone ? r.pl.finishT : null]) : undefined; },

  vsFrame(g, dt){
    if (!this.vs.size) return;
    const O = this.vsO(), me = this.myPid(), P = g.player; if (!O || !P) return;
    for (const s of [...this.vs.values()]) {
      if (s.phase === 'invite') {
        s.until -= dt;
        if (s.owner === me) {
          if (!s.J || O.job !== s.J) { this.vsSend({t:'vsCancel', vid:s.vid}); continue; }
          const others = this.otherPids(), waiting = others.filter(p => !s.joined.has(p) && !s.busy.has(p));
          if (s.until > 0 && waiting.length) continue;
          const pilots = [...s.joined].filter(p => p === me || others.includes(p));
          if (pilots.length < 2) { this.vsSend({t:'vsCancel', vid:s.vid}); if (s.J) this.local(() => G.HUD.toast(`Nobody joined: ${s.title} is yours alone`)); continue; }
          if (P.alive && P.pos.distanceTo(s.at) < s.rad) this.vsSend({t:'vsStart', vid:s.vid, pilots, names:Object.fromEntries(pilots.map(p => [p, s.names[p] || this.pilotName(p)])), lim:s.type === 'race' ? s.J.limit : s.def.time, nR:s.type === 'race' ? s.J.nRings - 1 : 0});
        } else if (!s.iBusy && !s.iJoined && s.until > 0 && O.phase === 1 && !O.job && !O.ended && P.alive && !P.frozen) {
          const d = P.pos.distanceTo(s.at);
          if (g.markers) g.markers.push({pos:s.at, label:`JOIN ${s.names[s.owner].toUpperCase()} · ${s.title.toUpperCase()} · ${Math.ceil(s.until)} S`, col:'#f2c14e'});
          if (d < s.rad) this.vsJoin(s, O);
        }
      } else if (s.phase === 'count') {
        s.count -= dt; const n = Math.ceil(s.count);
        if (s.J && n !== s.lastN && n > 0) { s.lastN = n; this.local(() => G.HUD.banner(s.title, `Starting in ${n}`)); if (g.audio && g.audio.ding) g.audio.ding(); }
        if (s.count <= 0) {
          s.phase = 'go'; s.t = 0;
          if (s.J && O.job === s.J) {
            const J = s.J; if (s.type === 'race') { J.begin(); J.k = 0; } else { J.t = 0; J.score = 0; }
            this.local(() => G.HUD.banner('Go!', s.title)); setTimeout(() => { if (G.game === g && s.phase === 'go') G.HUD.banner(null); }, 1200);
          }
        }
      } else if (s.phase === 'go') {
        s.t += dt;
        if (s.J && O.job === s.J && (s.sendT -= dt) <= 0) {
          s.sendT = 1/VS_HZ; const J = s.J;
          if (!s.myDone) this.vsSend({t:'vsProg', vid:s.vid, v:s.type === 'race' ? Math.round(J.progOf(P.pos, J.k)*100)/100 : Math.round(J.score), R:this.vsRivals(s, J)});
          else if (s.owner === me && J.rivals && J.rivals.length) this.vsSend({t:'vsProg', vid:s.vid, R:this.vsRivals(s, J)});
        }
        if (s.judge === me) {
          if (s.owner === me && s.J && O.job === s.J && s.J.rivals && s.J.rivals.length) { const R = this.vsRivals(s, s.J); s.rivals = R.map(r => ({name:r[0], v:r[1], fin:r[2], rival:true})); s.hadRivals = true; }
          const left = s.pilots.filter(p => !(s.prog.get(p) || {}).done);
          if (left.length && s.t > s.lim + 20) for (const p of left) Object.assign(s.prog.get(p) || {}, {done:true, dnf:true});   // nobody waits for ever
          if (!left.length || s.t > s.lim + 20) this.vsSend({t:'vsResult', vid:s.vid, rows:this.vsDecide(s)});
        }
      } else if (s.phase === 'done') { s.showT -= dt; if (s.showT <= 0) this.vs.delete(s.vid); }
    }
  },

  /* the judge's call: who placed where, and what each pilot is owed */
  vsOrder(s){
    const H = s.pilots ? s.pilots.map(pid => Object.assign({pid, name:s.names[pid] || this.pilotName(pid)}, s.prog.get(pid) || {v:0})) : [];
    if (s.type === 'stunt') return H.sort((a, b) => b.v - a.v);
    const key = e => e.dnf ? [2, 0] : e.fin != null ? [0, e.fin] : [1, -e.v];
    return H.concat(s.rivals.map(r => Object.assign({}, r))).sort((a, b) => { const x = key(a), y = key(b); return x[0] - y[0] || x[1] - y[1]; });
  },
  vsDecide(s){
    const all = this.vsOrder(s), rows = [];
    if (s.type === 'race') {
      const fin = all.filter(e => !e.rival && !e.dnf && e.fin != null), rivals = s.hadRivals;
      const lead = fin[0], leadWins = !!lead && (rivals ? all[0] === lead : !!lead.medal);
      all.forEach((e, i) => {
        const row = {pid:e.pid || null, name:e.name, rival:!!e.rival, overall:i + 1, val:e.fin != null ? e.fin : null, dnf:!!e.dnf};
        if (!e.rival) {
          const hp = fin.indexOf(e);
          if (e.dnf || hp < 0) Object.assign(row, {kind:'fail', note:'Did not finish'});
          else if (leadWins && hp === 0) Object.assign(row, {kind:'win', place:1, medal:e.medal || null});
          else if (leadWins && (rivals || e.medal)) Object.assign(row, {kind:'share', place:hp + 1, mul:VS_SHARE[hp] || 0.1});
          else Object.assign(row, {kind:'fail', place:hp + 1, note:rivals ? `Finished ${vsOrd(i + 1)}` : `Too slow: ${vsFmt(e.fin)}`});
        }
        rows.push(row);
      });
    } else {
      const target = (vsJob(s.job) || {}).target || 0, leadWins = all.length && all[0].v >= target;
      all.forEach((e, i) => {
        const row = {pid:e.pid, name:e.name, overall:i + 1, val:e.v, place:i + 1};
        if (leadWins && i === 0) Object.assign(row, {kind:'win', medal:e.medal || 'bronze'});
        else if (leadWins && e.v >= target) Object.assign(row, {kind:'share', mul:VS_SHARE[i] || 0.1});
        else Object.assign(row, {kind:'fail', note:`${Math.round(e.v).toLocaleString()} of ${target.toLocaleString()} points`});
        rows.push(row);
      });
    }
    return rows;
  },
  vsBoard(s){ return (s.rows || []).map(r => `${r.overall}. ${r.name} ${r.dnf ? 'DNF' : r.val == null ? '' : s.type === 'race' ? vsFmt(r.val) : Math.round(r.val).toLocaleString()}`.trim()); },
  /* each pilot pays themselves, once, from the agreed result */
  vsSettle(s){
    const me = this.myPid(), row = s.rows.find(r => r && !r.rival && r.pid === me), board = this.vsBoard(s), O = this.vsO();
    const head = `Results · ${s.title}`;
    if (!row || !s.J || s.settled) { this.local(() => { G.HUD.feed(`${head}: ${board.join(', ')}`, false); if (!(O && O.job)) { G.HUD.banner(head, board.join(' · ')); setTimeout(() => G.HUD.banner(null), 4500); } }); s.J = null; return; }
    s.settled = true;
    const J = s.J; s.J = null; if (!O || O.job !== J) return;
    const race = s.type === 'race', n = s.pilots.length + (race ? s.rivals.length : 0);
    let res;
    if (row.kind === 'win') res = {win:true, medal:row.medal || undefined, time:race ? row.val : undefined, vsSettle:true, say:race ? `First across the line in ${vsFmt(row.val)}! Collect your purse.` : `${Math.round(row.val).toLocaleString()} points, the best in the sky! They're on their feet!`};
    else if (row.kind === 'share') res = {vsShare:Math.max(0, Math.min(1, +row.mul || 0)), place:row.place || 2};
    else res = {win:false, vsSettle:true, note:row.note || 'Beaten', say:race ? 'Not your day, flyer. There\'s always the next one.' : 'The crowd cheered the other fellow.'};
    this.local(() => O.finishJob(res));
    const sub = `${vsOrd(row.overall)} of ${n}${res.vsShare ? ` · $${Math.round(J.def.pay*res.vsShare).toLocaleString()}` : ''} · ${board.join(' · ')}`;
    this.local(() => { G.HUD.banner(head, sub); G.HUD.feed(`${head}: ${board.join(', ')}`, false); });
  },
  /* the standings, at the top of every pilot's side list while a versus is on */
  vsRows(){
    const me = this.myPid(), out = [];
    for (const s of this.vs.values()) {
      const kind = s.type === 'race' ? 'Race' : 'Stunt show';
      if (s.phase === 'invite') {
        if (s.owner !== me && (s.iBusy || s.until <= 0) && !s.iJoined) continue;
        out.push({text:`${kind} · ${s.title} · ${s.names[s.owner]}`, st:'live', val:s.owner === me ? `${s.joined.size - 1} joined` : s.iJoined ? 'joined' : `join · ${Math.ceil(s.until)} s`});
        continue;
      }
      if (s.phase === 'done') {
        out.push({text:`Results · ${s.title}`, st:'ok', val:''});
        for (const r of s.rows) out.push({text:`${r.overall}. ${r.name}${r.pid === me ? ' (you)' : ''}`, st:r.kind === 'win' ? 'ok' : r.kind === 'fail' ? 'fail' : 'live', val:r.dnf ? 'DNF' : r.val == null ? '' : s.type === 'race' ? vsFmt(r.val) : Math.round(r.val).toLocaleString()});
        continue;
      }
      out.push({text:`${kind} · ${s.title}`, st:'live', val:s.phase === 'count' ? `in ${Math.max(1, Math.ceil(s.count))}` : vsFmt(s.t)});
      this.vsOrder(s).forEach((e, i) => out.push({text:`${i + 1}. ${e.name}${e.pid === me ? ' (you)' : ''}`, st:e.pid === me ? 'ok' : 'live',
        val:s.type === 'stunt' ? Math.round(e.v).toLocaleString() : e.dnf ? 'DNF' : e.fin != null ? vsFmt(e.fin) : `ring ${Math.max(0, Math.min(s.nR || 0, Math.floor(e.v) - 1))}/${s.nR || 0}`}));
    }
    return out;
  }
});
/* open skies: taking a race or a show in co-op invites everyone; joining makes a copy; leaving early drops out */
{
  const O = G.MISSIONS.open;
  const sj0 = O.startJob;
  O.startJob = function(def, site){
    const r = sj0.call(this, def, site), J = this.job, N = Net;
    if (!J || J.def !== def) return r;
    if (N.vsJoining) { N.vsArm(N.vsJoining, J); return r; }
    const g = this.g;
    if (!N.role || N.g !== g || G.game !== g || def.treasure || (def.type !== 'race' && def.type !== 'stunt') || !N.otherPids().length) return r;
    const at = def.type === 'race' ? J.start : J.at; if (!at) return r;
    const vid = `${N.myPid()}:${++N.vseq}`;
    N.vsSend({t:'vsInvite', vid, job:def.id, at:[r2(at.x), r2(at.y), r2(at.z)], rad:def.type === 'race' ? 600 : (J.R || 800), name:G.save.callsign || 'Ace'});
    const s = N.vs && N.vs.get(vid); if (s) N.vsArm(s, J);
    return r;
  };
  const fj0 = O.finishJob;
  O.finishJob = function(res){
    const job = this.job, s = job && job.vsS;
    if (s && !s.solo && res && !res.vsSettle && !res.vsShare && !s.settled) {
      // out of a versus before the result (abandoned, or the job ended some other way): out of the standings, failed as usual
      s.settled = true; s.J = null;
      if (s.owner === Net.myPid() && s.phase === 'invite') Net.vsSend({t:'vsCancel', vid:s.vid}); else Net.vsSend({t:'vsLeave', vid:s.vid});
    }
    if (res && res.vsShare != null && job) {
      // a place behind the winner: a share of the purse, no medal, and the job isn't counted as won
      const def = job.def, pay = Math.round(def.pay*res.vsShare); this.job = null;
      if (job.cleanup) job.cleanup();
      G.save.cash += pay; this.earned += pay;
      G.HUD.banner(`${vsOrd(res.place)} · ${def.title}`, `$${pay.toLocaleString()} · ${Math.round(res.vsShare*100)}% of the purse`); setTimeout(() => G.HUD.banner(null), 4500);
      if (this.g.audio) this.g.audio.ding();
      G.persist(); this.g.markers = []; this.holdOnGround = false; return;
    }
    return fj0.call(this, res);
  };
  const sides0 = G.HUD.sides;
  G.HUD.sides = function(list){ if (Net.vs && Net.vs.size && Net.g && G.game === Net.g) list = Net.vsRows().concat(list || []); return sides0.call(this, list); };
}
})();
