const fs=require('fs');let src=fs.readFileSync('/home/claude/test/partstest.js','utf8');src=src.slice(0,src.indexOf("G.save.load = G.stockLoadout('gallant')"));
src+=`
G.save.load=G.stockLoadout('gallant'); G.save.story = G.save.story || {flags:{}};
const g=new G.Game(R,G.MISSIONS.c9x1); G.game=g; const M=g.mission; let res=null; g.end=r=>{ if(!res){res=r; g.done=true; g.running=false;} };
if (M.drop) M.drop(); for (let i=0;i<90;i++) g.update(1/30);
const P0=g.player; ok(M.stage==='out' && M.bomber && M.bomber.parked, 'starts: Mastodon parked at the cove');
ok(M.puertoRw, 'found Puerto Azul runway');
const cove=g.runways.find(r=>r.pos.distanceTo(M.cove)<5);
const putOn=(P,rw,back)=>{ const yaw=rw.yaw||0, fw=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)); P.pos.copy(rw.pos).addScaledVector(fw,back); P.pos.y=Math.max(g.world.height(P.pos.x,P.pos.z),0.4)+(P.ud.gear||1.8)+3; P.q.setFromAxisAngle(new THREE.Vector3(0,1,0),yaw); P.axes(); P.speed=P.st.stall*1.05; P.vel.set(0,-1,0); g.aimYaw=yaw; g.aimPitch=-0.02; };
putOn(P0,cove,-200); P0.throttle=0; P0.speed=20; P0.land(Math.max(g.world.height(P0.pos.x,P0.pos.z),0.4)+(P0.ud.gear||1.8)); let landed=P0.onGround; for(let i=0;i<30;i++) g.update(1/30); landed = landed && P0.onGround;
ok(landed && P0.alive, 'lands on the cove field');
// taxi up beside the bomber: teleport near and stop
for (let i=0;i<200 && P0.speed>0.5;i++){ g.keys={KeyS:true,KeyB:true}; g.update(1/30); } g.keys={};
P0.pos.x = M.bomber.pos.x + 40; P0.pos.z = M.bomber.pos.z; P0.speed=0; for (let i=0;i<10;i++) g.update(1/30);
ok(g.swapNear && g.swapNear.plane===M.bomber, 'offered the Mastodon');
g.key('KeyY',true); g.key('KeyY',false); ok(g.player===M.bomber && M.stage==='taxi', 'climbed into the Mastodon');
const B=g.player; putOn(B,cove,-260); B.pos.y=Math.max(g.world.height(B.pos.x,B.pos.z),0.4)+(B.ud.gear||1.8); B.onGround=true; B.speed=0; B.groundYaw=cove.yaw||0;
g.keys={KeyW:true}; let up=false; for(let i=0;i<30*30 && !up;i++){ g.aimPitch = B.speed>B.st.stall*1.25 ? 0.15 : -0.03; g.update(1/30); if(!B.onGround) up=true; } g.keys={};
ok(up && B.alive && M.stage==='run', 'Mastodon lifts off, run begins');
// the bomb run: head for the Rusty Anchor at 300 m, open the sight, dial the true wind, steer and drop
{ const Z=M.zone; let t=0; for(;t<30*120 && B.alive && Math.hypot(Z.pos.x-B.pos.x,Z.pos.z-B.pos.z)>1400;t++){ const d=Z.pos.clone().sub(B.pos); g.aimYaw=Math.atan2(d.x,d.z); g.aimPitch=B.pos.y<300?0.12:(B.pos.y>340?-0.05:0); g.keys={KeyW:true}; g.update(1/30); }
  g.keys={}; g.toggleSight(); ok(!!g.sight, 'bombsight opens in the air'); const W=g.wind; g.sight.wDir=Math.atan2(W.x,W.z); g.sight.wSpd=Math.hypot(W.x,W.z);
  const res0=[]; for(let i=0;i<30*120 && B.alive && (B.packages>0 || g.crates && g.crates.some(c=>!c.landed));i++){
    if (g.sight){ const hit=g.predictCrate(new THREE.Vector3()); const fw=new THREE.Vector3(B.fwd.x,0,B.fwd.z).normalize(), rt=new THREE.Vector3(fw.z,0,-fw.x); const off=Z.pos.clone().sub(hit); const side=off.dot(rt), along=off.dot(fw);
      if (along > 250) { const dz=Z.pos.clone().sub(B.pos); const want=Math.atan2(dz.x,dz.z) + Math.atan2(side*0.6, along); let e=want-g.sight.hdg; e=Math.atan2(Math.sin(e),Math.cos(e)); g.sight.hdg += Math.max(-0.004,Math.min(0.004,e*0.05)); } else g.sight.hdg += Math.max(-0.003,Math.min(0.003,side*0.0003));   // talk the pilot onto the line
      if (Math.abs(along)<6 && Math.abs(side)<12) { g.dropCrate(); res0.push('drop at side '+side.toFixed(0)+' m'); }
      if (along < -150) { const dz=Z.pos.clone().sub(B.pos); if (dz.length()>1500) { let e=Math.atan2(dz.x,dz.z)-g.sight.hdg; e=Math.atan2(Math.sin(e),Math.cos(e)); g.sight.hdg += Math.max(-0.006,Math.min(0.006,e)); } else g.sight.hdg += 0.0; }   // overshot: fly on, then come round for another pass
    } else if (B.packages>0) { g.toggleSight(); if (g.sight){ g.sight.wDir=Math.atan2(W.x,W.z); g.sight.wSpd=Math.hypot(W.x,W.z);} }
    g.update(1/30); if (M.delivered && M.bull) break; }
  console.log('BOMB: wind '+Math.round(Math.hypot(W.x,W.z)*2.237)+' mph, '+res0.join('; ')+' -> delivered '+M.delivered+', bullseye '+M.bull+', crates left '+B.packages+', bomber '+Math.round(B.internal/B.internalMax*100)+'%');
  if (g.sight) g.toggleSight(true); }
const pz=M.P.puerto, PZ=new THREE.Vector3(pz.x, 0, pz.z); let t=0, k0=g.kills; for(;t<30*150 && B.alive;t++){ const d=PZ.clone().sub(B.pos); const yaw=Math.atan2(d.x,d.z); g.aimYaw=yaw; g.aimPitch = B.pos.y<350 ? 0.12 : 0; g.keys={KeyW:true}; g.update(1/30); if (Math.hypot(d.x,d.z)<500) break; }
const turretKills=g.kills-k0; console.log('RUN: reached '+(B.alive?'yes':'NO')+' after '+(t/30).toFixed(0)+'s, waves '+M.waveN+', bomber '+Math.round(Math.max(0,B.internal)/B.internalMax*100)+'%, parts '+B.pk().map(x=>Math.round(x*100)).join('/')+', kills (gunners) '+turretKills+', bandits left '+g.planes.filter(p=>p.alive&&p.team!==0).length+', wingmen '+(g.wingmen||[]).filter(w=>w.p.alive).length);
ok(M.waveN>=2, 'waves came');
B.invuln=true; B.alive=true; for (const p of g.planes) if (p.team!==0) p.alive=false;
putOn(B,M.puertoRw,-150); B.speed=30; B.land(Math.max(g.world.height(B.pos.x,B.pos.z),0.4)+(B.ud.gear||1.8)); for(let i=0;i<30*40 && !res;i++){ g.keys={KeyS:true,KeyB:true}; g.update(1/30); }
ok(res && res.kind!=='fail', 'lands at Puerto Azul and wins: '+(res&&res.kind)+' flags '+JSON.stringify(res&&res.flags));
console.log(bad ? bad+' FAILED' : 'heavy: all clear');`;
fs.writeFileSync('/home/claude/test/heavytest_run.js',src);
