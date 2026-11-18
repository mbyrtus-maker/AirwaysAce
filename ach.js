/* =====================================================================
   Achievements: lifetime stats kept in the save, a list of feats with their progress, a toast when one is earned,
   and a screen from the main menu. Stats are only ever counted on the pilot's own machine for the pilot's own deeds.
   ===================================================================== */
(() => {
const S = () => G.save, ST = () => (G.save.stats = Object.assign({kills:0, aces:0, ships:0, sorties:0, perfect:0, jobs:0, golds:0, duels:0, races:0, tunnels:0, hooks:0,
  landings:0, coop:0, bestSortie:0, storms:0, blizzards:0, nightKills:0, regions:[], rockets:0, bellyless:0}, G.save.stats || {}));
const story = id => !!(S().story && S().story.log.some(l => l.node === id && l.kind !== 'fail'));
const found = () => Object.keys(S().open && S().open.found || {}).length;
const allTreasures = () => Object.values(G.REGIONS).reduce((n, R) => n + R.treasures.length, 0);

/* each: id, group, name, how (what to do), goal (number), have(stats) */
const LIST = [
  // the story
  {g:'Story', id:'v1', name:'Lights, Camera, Lantern', how:'Finish Volume I', goal:1, have:() => story('c3m3') ? 1 : 0},
  {g:'Story', id:'v2', name:'Black Flag, White Lies', how:'Finish Volume II', goal:1, have:() => story('c6m3') ? 1 : 0},
  {g:'Story', id:'v3', name:'Iron Will', how:'Finish Volume III', goal:1, have:() => story('c9m3') ? 1 : 0},
  {g:'Story', id:'kroll', name:'In the Net', how:'Catch Ambrose Kroll before he escapes', goal:1, have:() => { const f = S().story && S().story.flags || {}; return f.kroll === 'caught' ? 1 : 0; }},
  {g:'Story', id:'reunion', name:'Old Friends', how:'Fly the Fleet Action with both Kit Calloway and Red Bess', goal:1, have:() => { const f = S().story && S().story.flags || {}; return story('c9m2') && f.kit === 'free' && f.bess === 'spared' ? 1 : 0; }},
  {g:'Story', id:'v4', name:'Who You Gonna Call', how:'Finish Volume IV', goal:1, have:() => story('c12m3') ? 1 : 0},
  {g:'Story', id:'ashgrove', name:'Pilot Required', how:'Catch Lucan Ashgrove', goal:1, have:() => { const f = S().story && S().story.flags || {}; return f.ashgrove === 'caught' ? 1 : 0; }},
  {g:'Story', id:'dam', name:'Dry Feet', how:'Hold the Rustwater Dam without a scratch', goal:1, have:() => { const f = S().story && S().story.flags || {}; return f.dam >= 100 ? 1 : 0; }},
  {g:'Story', id:'perfect5', name:'Picture Perfect', how:'Earn a perfect rating in 5 story episodes', goal:5, have:s => s.perfect},
  {g:'Story', id:'deepcover', name:'Deep Cover', how:'Reach the Pirate King\'s coronation with your cover at 80% or more', goal:1, have:() => { const f = S().story && S().story.flags || {}; return story('c6m1') && (f.cover || 0) >= 80 ? 1 : 0; }},
  {g:'Story', id:'kit', name:'Sister Act', how:'Let Kit Calloway go and hand her the signal book', goal:1, have:() => { const f = S().story && S().story.flags || {}; return f.kit === 'free' && f.kitCodes ? 1 : 0; }},
  {g:'Story', id:'bess', name:'Debts Paid', how:'Spare Red Bess Malone', goal:1, have:() => { const f = S().story && S().story.flags || {}; return f.bess === 'spared' ? 1 : 0; }},
  // combat
  {g:'Combat', id:'k1', name:'First Blood', how:'Shoot down an enemy plane', goal:1, have:s => s.kills},
  {g:'Combat', id:'k50', name:'Ace in the Making', how:'Shoot down 50 enemy planes', goal:50, have:s => s.kills},
  {g:'Combat', id:'k250', name:'Terror of the Skies', how:'Shoot down 250 enemy planes', goal:250, have:s => s.kills},
  {g:'Combat', id:'aces', name:'Ace Killer', how:'Shoot down 5 aces (bar duels, bosses, named pilots)', goal:5, have:s => s.aces},
  {g:'Combat', id:'ships', name:'Hindenburg Blues', how:'Bring down 10 airships', goal:10, have:s => s.ships},
  {g:'Combat', id:'sortie10', name:'Ten in a Day', how:'Shoot down 10 planes in one sortie', goal:10, have:s => s.bestSortie},
  {g:'Combat', id:'night', name:'Night Fighter', how:'Shoot down 10 planes at night', goal:10, have:s => s.nightKills},
  {g:'Combat', id:'duels', name:'Pistols at Dawn', how:'Win 5 bar duels', goal:5, have:s => s.duels},
  // flying
  {g:'Flying', id:'stunt10k', name:'Showboat', how:'Bank a 10,000-point stunt chain total', goal:10000, have:() => S().open ? S().open.stuntTotal || 0 : 0},
  {g:'Flying', id:'stuntbest', name:'Barnstormer Supreme', how:'Score a single 3,000-point stunt chain', goal:3000, have:() => S().open ? S().open.stuntBest || 0 : 0},
  {g:'Flying', id:'tunnels', name:'Threading the Needle', how:'Fly through 10 tunnels or caves end to end', goal:10, have:s => s.tunnels},
  {g:'Flying', id:'hooks', name:'Hooked', how:'Catch 25 skyhooks', goal:25, have:s => s.hooks},
  {g:'Flying', id:'landings', name:'Three-Point Landing', how:'Land on 25 airstrips', goal:25, have:s => s.landings},
  {g:'Flying', id:'storm', name:'Into the Storm', how:'Finish 3 sorties in a thunderstorm or tropical storm', goal:3, have:s => s.storms},
  {g:'Flying', id:'blizzard', name:'Snow Blind', how:'Finish a sortie in a blizzard', goal:1, have:s => s.blizzards},
  // open skies
  {g:'Open skies', id:'jobs10', name:'Odd-Job Ace', how:'Finish 10 jobs', goal:10, have:s => s.jobs},
  {g:'Open skies', id:'jobs40', name:'Never Says No', how:'Finish 40 jobs', goal:40, have:s => s.jobs},
  {g:'Open skies', id:'golds', name:'Gold Standard', how:'Win 10 gold medals', goal:10, have:s => s.golds},
  {g:'Open skies', id:'regions', name:'Globetrotter', how:'Fly in all six regions', goal:6, have:s => s.regions.length},
  {g:'Open skies', id:'treasure5', name:'Treasure Hunter', how:'Find 5 treasures', goal:5, have:found},
  {g:'Open skies', id:'treasureall', name:'X Marks Every Spot', how:'Find every treasure', goal:() => allTreasures(), have:found},
  // the hangar
  {g:'Hangar', id:'fleet', name:'Collector', how:'Own 8 airframes', goal:8, have:() => S().owned.length},
  {g:'Hangar', id:'zephyr', name:'No Propeller Required', how:'Earn the Zephyr jet', goal:1, have:() => S().owned.includes('zephyr') ? 1 : 0},
  {g:'Hangar', id:'hornet', name:'Float Like a Butterfly', how:'Earn the Hornet', goal:1, have:() => S().owned.includes('hornet') ? 1 : 0},
  {g:'Hangar', id:'banshee', name:'Wail', how:'Earn the Banshee', goal:1, have:() => S().owned.includes('banshee') ? 1 : 0},
  {g:'Hangar', id:'liveries', name:'Dressed to Kill', how:'Collect 10 liveries', goal:10, have:() => (S().liveries || []).length},
  {g:'Hangar', id:'rich', name:'Rolling in It', how:'Have $100,000 in the bank', goal:100000, have:() => S().cash},
  // co-op
  {g:'Co-op', id:'coop1', name:'Better Together', how:'Finish a co-op sortie', goal:1, have:s => s.coop},
  {g:'Co-op', id:'coop10', name:'The Whole Squadron', how:'Finish 10 co-op sorties', goal:10, have:s => s.coop}
];
const goalOf = a => typeof a.goal === 'function' ? a.goal() : a.goal;

const A = G.ach = {
  LIST,
  stats:ST,
  /* look for anything newly earned; announce each once */
  check(quiet){
    const s = ST(), got = S().ach || (S().ach = {}), fresh = [];
    for (const a of LIST) if (!got[a.id] && (a.have(s) || 0) >= goalOf(a)) { got[a.id] = Date.now(); fresh.push(a); }
    if (fresh.length) { G.persist(); if (!quiet && G.HUD) fresh.forEach((a, i) => setTimeout(() => G.HUD.toast(`🏆 Achievement: ${a.name}`), 1200*i)); }
    return fresh;
  },
  bump(k, n = 1){ const s = ST(); s[k] = (s[k] || 0) + n; this.check(); },
  render(){
    const el = document.getElementById('achBody'); if (!el) return;
    const s = ST(), got = S().ach || {}, n = LIST.filter(a => got[a.id]).length, esc = x => String(x).replace(/[&<>]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;'}[c]));
    const groups = [...new Set(LIST.map(a => a.g))];
    el.innerHTML = `<div class="kicker">The record book</div><h2 class="deco" style="font-size:44px;margin:6px 0 2px">Achievements</h2>
      <p class="pad-state">${n} of ${LIST.length} earned · ${s.kills} kills · ${s.sorties} sorties · ${s.jobs} jobs · ${found()} treasures</p>
      ${groups.map(gr => `<h3 class="ach-g">${esc(gr)}</h3><div class="ach-grid">${LIST.filter(a => a.g === gr).map(a => {
        const goal = goalOf(a), have = Math.min(goal, a.have(s) || 0), on = !!got[a.id];
        return `<div class="ach${on ? ' on' : ''}"><b>${on ? '🏆 ' : ''}${esc(a.name)}</b><span>${esc(a.how)}</span>${goal > 1 && !on ? `<i><em style="width:${Math.round(have/goal*100)}%"></em></i><small>${have.toLocaleString()} / ${goal.toLocaleString()}</small>` : on ? `<small>${new Date(got[a.id]).toLocaleDateString()}</small>` : ''}</div>`;
      }).join('')}</div>`).join('')}
      <div class="row" style="margin-top:14px"><button class="btn" onclick="G.ach.close()">Done</button></div>`;
  },
  open(){ this.check(true); G.UI.screen('ach'); this.render(); },
  close(){ G.UI.menu(); }
};

/* ---------- counting ---------- */
const GP = G.Game.prototype;
const kill0 = GP.onKill;
GP.onKill = function(plane, src, how){
  const r = kill0.apply(this, arguments);
  if (!this.netGuest && plane && plane.team !== 0 && !plane.police && (src || plane.lastHitBy) === this.player) {
    const s = ST(); s.kills++; this.achKills = (this.achKills || 0) + 1; s.bestSortie = Math.max(s.bestSortie, this.achKills);
    if (plane.ace) s.aces++; if (this.world && this.world.time === 'night') s.nightKills++; A.check();
  }
  return r;
};
const ship0 = GP.onShipDown;
GP.onShipDown = function(ship, src){ const r = ship0.apply(this, arguments); if (!this.netGuest && ship.team !== 0) { ST().ships++; A.check(); } return r; };
// co-op guests count their own kills when the host credits them
if (G.Net) { const gm0 = G.Net.guestMsg; G.Net.guestMsg = function(m){ const r = gm0.call(this, m); if (m && m.t === 'kill' && this.g) { const s = ST(); s.kills++; this.g.achKills = (this.g.achKills || 0) + 1; s.bestSortie = Math.max(s.bestSortie, this.g.achKills); A.check(); } return r; }; }
// open skies: jobs, medals, duels, tunnels, hooks, landings, regions
const O = G.MISSIONS.open;
const fin0 = O.finishJob;
O.finishJob = function(res){
  const def = this.job && this.job.def; const r = fin0.call(this, res);
  if (res && res.win && def && !def.treasure) { const s = ST(); s.jobs++; if (res.medal === 'gold') s.golds++; if (def.type === 'duel') s.duels++; if (def.type === 'race') s.races++; A.check(); }
  return r;
};
const tun0 = O.tunnelPass; if (tun0) O.tunnelPass = function(tn){ const r = tun0.apply(this, arguments); ST().tunnels++; A.check(); return r; };
const hk0 = O.hooked; O.hooked = function(){ ST().hooks++; A.check(); return hk0.apply(this, arguments); };
const meet0 = O.meet; O.meet = function(site){ if (site && site.kind === 'strip') { ST().landings++; A.check(); } return meet0.apply(this, arguments); };
const set0 = O.setup; O.setup = function(g){ const r = set0.call(this, g); const s = ST(); if (this.R && !s.regions.includes(this.R.id)) { s.regions.push(this.R.id); G.persist(); A.check(); } return r; };
// every finished sortie: storms, blizzards, perfect episodes, co-op
if (G.UI) {
  const deb0 = G.UI.debrief;
  G.UI.debrief = function(g, r){
    const s = ST(); s.sorties = (s.sorties || 0) + 1;
    if (g && g.weather && r && r.kind !== 'fail') { const w = g.weather.id; if (w === 'storm' || w === 'tropical') s.storms++; if (w === 'blizzard') s.blizzards++; }
    if (r && r.kind === 'perfect' && g && g.mission && g.mission.story) s.perfect++;
    if (G.Net && G.Net.role && (G.Net.links.length || G.Net.role === 'guest')) s.coop++;
    G.persist(); const out = deb0.apply(this, arguments); setTimeout(() => A.check(), 2500); return out;
  };
}
})();
