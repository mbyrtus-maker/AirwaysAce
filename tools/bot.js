const fs=require('fs');let src=fs.readFileSync('/home/claude/test/partstest.js','utf8');src=src.slice(0,src.indexOf("G.save.load = G.stockLoadout('gallant')"));
src+=`
global.setTimeout = () => 0;
const ids = (process.argv[3] ? process.argv[3].split(',') : Object.keys(G.MISSIONS).filter(k => /^c\\d+m\\d+$|^c\\d+x\\d+$/.test(k) || ['ambush','nightjar','convoy','dogfight'].includes(k)));
const T = +(process.argv[4] || 240), SEEDS = +(process.argv[5] || 3); const rows = [];
let seed = 1; Math.random = () => { seed = (seed*16807) % 2147483647; return (seed - 1)/2147483646; };
for (const id of ids) { let alive = 0, kills = 0, wins = 0, losses = 0, deaths = 0, hurt = 0, broke = 0;
  for (let s = 0; s < SEEDS; s++) { seed = 1000 + s*7919;
    try {
    G.save.load = G.stockLoadout(process.env.CH || 'gallant'); const g = new G.Game(R, G.MISSIONS[id]); G.game = g; let res = null; g.end = r => { if (!g.done) { g.done = true; g.running = false; res = r; } };
    if (g.mission.drop) g.mission.drop();
    const P = g.player; const bot = new G.Pilot(g, P, {role:'fighter', skill:0.6}); g.pilots.push(bot);
    let t = 0; for (; t < T*30 && !res; t++) { g.update(1/30); if (!P.alive && !res) { deaths++; break; } }
    alive += Math.min(T, t/30); kills += g.kills; hurt += 1 - Math.max(0, P.internal)/P.internalMax; if (P.pk) broke += P.pk().filter(k => k < 0.35).length + (P.wingGone >= 0 ? 1 : 0) + (P.seized ? 1 : 0);
    if (res) { const ok = res.win ?? res.ok ?? res.success ?? (res.result === 'win'); if (ok) wins++; else losses++; }
    } catch (e) { rows.push(id + ' ERR ' + String(e).slice(0, 80)); }
  }
  rows.push(id.padEnd(8) + ' alive ' + (alive/SEEDS).toFixed(0).padStart(4) + 's  kills ' + (kills/SEEDS).toFixed(1).padStart(4) + '  died ' + deaths + '/' + SEEDS + '  won ' + wins + ' lost ' + losses + '  hurt ' + (hurt/SEEDS*100).toFixed(0).padStart(3) + '%  broken parts ' + (broke/SEEDS).toFixed(1));
  console.log(rows[rows.length - 1]);
}`;
fs.writeFileSync('/home/claude/test/bot_run.js', src);
