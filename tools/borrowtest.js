const fs=require('fs');let src=fs.readFileSync('/home/claude/test/partstest.js','utf8');src=src.slice(0,src.indexOf("G.save.load = G.stockLoadout('gallant')"));
src+=`
const V=THREE.Vector3;
for (const reg of ['halcyon','badlands','frostback','keys','calavera']) {
  G.save.load=G.stockLoadout('gallant'); G.save.open.region=reg; G.save.open.hour=12; const g=new G.Game(R,G.MISSIONS.open); G.game=g; const O=g.mission;
  if (O.drop) O.drop(); for (let i=0;i<30;i++) g.update(1/30);
  const fields=O.sites.filter(s=>s.kind==='strip'||s.kind==='field').length;
  ok(O.borrowSpots.length===fields && O.borrowSpots.every(s=>s.plane.parked&&s.plane.onGround), reg+': a plane at each of '+fields+' airfields ('+O.borrowSpots.map(s=>s.label).join(', ')+')');
  // each sits on runway/apron ground, not inside a blocker
  ok(O.borrowSpots.every(s=>g.runwayAt(s.plane.pos)), reg+': parked on the apron/field');
}
// secrets, in halcyon
const kinds=['courier','stowaway','hot']; const cash0=G.save.cash;
for (const kind of kinds) {
  G.save.load=G.stockLoadout('gallant'); G.save.open.region='halcyon'; const g=new G.Game(R,G.MISSIONS.open); G.game=g; const O=g.mission; if (O.drop) O.drop(); for (let i=0;i<30;i++) g.update(1/30);
  const spot=O.borrowSpots[0], P=g.player; spot.secret=kind;
  P.pos.copy(spot.plane.pos).add(new V(25,0,0)); P.pos.y=spot.plane.pos.y; P.onGround=true; P.speed=0; P.groundYaw=0; for (let i=0;i<5;i++) g.update(1/30);
  ok(g.swapNear===spot, kind+': offered '+spot.label);
  if (O.atSite) O.leave(); g.key('KeyY',true); g.key('KeyY',false); const B=g.player;
  ok(B===spot.plane && O.job && O.job.def.secret && O.job.def.kind===kind, kind+': secret job starts: '+(O.job&&O.job.def.title));
  ok(!!g.mission.canSwap(O.borrowSpots[0]), kind+': no swapping mid-secret');
  const c0=G.save.cash; B.onGround=false; B.pos.y+=300; B.speed=60;
  if (kind==='courier') { const T=O.job.T; B.pos.copy(T.point).add(new V(0,2,0)); B.onGround=false; if (T.kind==='hook') O.job.onHooked(T); else O.job.onTouchdown(false); B.pos.y+=150; g.update(1/30); }
  if (kind==='stowaway') { const at=O.job.at; B.pos.set(at.x, O.ground(at.x,at.z)+150, at.z); g.update(1/30); }
  if (kind==='hot') { for (let i=0;i<30*14;i++) { B.pos.y=Math.max(B.pos.y,400); g.update(1/30); } ok(O.job && O.job.foes.length>0, 'hot: hunters arrive ('+(O.job?O.job.foes.length:0)+')'); for (const p of O.job.foes) p.alive=false; g.update(1/30); }
  ok(!O.job && G.save.cash>c0, kind+': done, paid $'+(G.save.cash-c0));
}
console.log(bad ? bad+' FAILED' : 'borrow: all clear');`;
fs.writeFileSync('/home/claude/test/borrowtest_run.js',src);
