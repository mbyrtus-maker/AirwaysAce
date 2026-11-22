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
const order = ['data', 'sfx', 'world', 'models', 'planes', 'combat', 'ai', 'audio', 'hud', 'game', 'traffic', 'story', 'open', 'rust', 'story2', 'story3', 'story4', 'tutorial', 'net', 'pad', 'keys', 'ui', 'weather', 'ach'];
for (const f of order) vm.runInThisContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), {filename:f + '.js'});
const G = global.G, V3 = THREE.Vector3;
const R = new Proxy({}, {get:() => () => {}});

G.persist = () => {};
const g = new G.Game(R, G.MISSIONS.tutorial); G.game = g; const M = g.mission;
const C = G.card, log = [];
const skip = () => { if (C.open) { C.t0 = -1e9; C.close(); } };
const tick = (n = 1) => { for (let i = 0; i < n; i++) { g.update(1/30); } };
let guard = 0;
setTimeout(() => {}, 0);
const run = async () => {
  await new Promise(r => setTimeout(r, 700));
  while (!g.done && guard++ < 4000) {
    if (C.open) { log.push(`[card ${M.step}] ${M.lessons[M.step].card.title} paused=${g.paused}`); skip(); if (g.paused && !C.open) throw new Error('still paused after card'); continue; }
    const S = M.lessons[M.step], P = g.player;
    if (M.awaitDrop) { M.drop(); }
    tick(2);
    if (S && S.check && !M.waiting) {
      const r = M.rings.find(r => !r.hit); if (r) { P.pos.copy(r.pos); tick(1); }
      if (M.stunts && /Stunts/.test(S.card.title)) { for (const k of ['roll', 'immel', 'snap']) M.onStunt(g, P, k); }
      if (/Nitro/.test(S.card.title)) P.nitro = 1;
      if (/Guns/.test(S.card.title)) for (const t of M.T) if (t.alive) g.hitTarget(t, 999, P);
      if (S.id === 'rockets' && M.shedT && M.shedT.alive) g.hitTarget(M.shedT, 999, P);
      if (/live one/.test(S.card.title) && M.foe && M.foe.alive) { if (!M.diedOnce) { M.diedOnce = true; P.destroy(null, 'crash'); await new Promise(r => setTimeout(r, 4300)); log.push('respawned: ' + (g.player !== P && g.player.alive)); } else M.foe.destroy(P, 'gun'); }
      if (S.id === 'dock') { g.docked = {i:0, t:0}; tick(1); g.docked = null; }
      if (S.id === 'land') { const Pl = g.player; Pl.onGround = true; Pl.speed = 0; Pl.pos.set(G.storyKit.STRIP.x, M.stripY + 2, G.storyKit.STRIP.z); tick(3); log.push('on strip, objective: ' + S.obj(g) + ' | still in lesson: ' + (M.lessons[M.step] === S && !!S.check)); Pl.pos.set(M.apron.x, M.stripY + 2, M.apron.z); Pl.speed = 0; }
    }
    await new Promise(r => setTimeout(r, 0)); if (S && !S.check) await new Promise(r => setTimeout(r, 950));
  }
  console.log(log.join('\n'));
  console.log('done', g.done, 'lessons', M.done + '/' + (M.lessons.length - 1), 'result', g.result ? g.result.kind : JSON.stringify(g.endR || '').slice(0, 60));
  process.exit(0);
};
run().catch(e => { console.log(log.join('\n')); console.log('ERR', e.stack); process.exit(1); });
