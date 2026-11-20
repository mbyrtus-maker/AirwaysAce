const fs=require('fs');let src=fs.readFileSync('/home/claude/test/partstest.js','utf8');src=src.slice(0,src.indexOf("G.save.load = G.stockLoadout('gallant')"));
src+=`
G.save.load=G.stockLoadout('gallant'); G.save.open.region='halcyon'; G.save.open.hour=12; const g=new G.Game(R,G.MISSIONS.open); G.game=g;
if (g.mission.drop) g.mission.drop(); for (let i=0;i<60;i++) g.update(1/30);
const P0=g.player; const rw=g.runways[0]; ok(!!rw, 'a runway to stand on');
// put the player on the runway, stopped
P0.pos.set(rw.pos.x, 0, rw.pos.z); P0.q.setFromAxisAngle(new THREE.Vector3(0,1,0), rw.yaw||0); P0.axes(); const gh=Math.max(g.world.height(P0.pos.x,P0.pos.z),0.4); P0.speed=0; P0.land(gh+(P0.ud.gear||1.8)); P0.speed=0; P0.throttle=0;
const side=new THREE.Vector3(Math.cos(rw.yaw||0),0,-Math.sin(rw.yaw||0));
let took=null; const spot=g.parkPlane({loadout:G.stockLoadout('thunderbuss'), pos:P0.pos.clone().addScaledVector(side,30), yaw:rw.yaw||0, label:'the test bomber', onTake:(gg,now,was)=>{ took=[now,was]; }});
ok(spot.plane.parked && spot.plane.onGround && spot.plane.noTarget, 'parked plane stands on its wheels, untargeted');
const bp0=spot.plane.pos.clone(); for (let i=0;i<60;i++) { g.update(1/30); P0.speed=0; P0.throttle=0; }
ok(spot.plane.pos.distanceTo(bp0)<0.01, 'parked plane stays put');
ok(g.swapNear===spot, 'stopped beside it: offered');
g.key('KeyY', true); g.key('KeyY', false);
ok(g.player===spot.plane && took && took[0]===spot.plane && took[1]===P0, 'Y climbs across, onTake fires');
ok(g.player.isPlayer && !P0.isPlayer && P0.parked && P0.onGround, 'old plane left parked');
ok(g.parkedSpots.some(s=>s.plane===P0), 'and offered back');
ok(Math.abs(g.player.partsMax[1]-g.player.internalMax*G.TUNE.parts)<1e-6, 'player tuning applied to the new plane');
for (let i=0;i<30;i++) g.update(1/30);
ok(g.swapNear && g.swapNear.plane===P0, 'can swap back');
g.key('KeyY', true); g.key('KeyY', false); ok(g.player===P0, 'swapped back');
for (let i=0;i<5;i++) g.update(1/30); g.key('KeyY', true); g.key('KeyY', false); ok(g.player===spot.plane, 'and over again');
// take off in the bomber
const B=g.player; { const fw=new THREE.Vector3(Math.sin(rw.yaw||0),0,Math.cos(rw.yaw||0)); B.pos.copy(rw.pos).addScaledVector(fw,-(rw.hl-30)); B.pos.y=Math.max(g.world.height(B.pos.x,B.pos.z),0.4)+(B.ud.gear||1.8); B.groundYaw=rw.yaw||0; B.q.setFromAxisAngle(new THREE.Vector3(0,1,0),rw.yaw||0); B.axes(); g.aimYaw=rw.yaw||0; } let roll0=B.pos.clone(); g.keys={KeyW:true}; let up=false; for (let i=0;i<30*40 && !up;i++){ g.aimPitch = B.speed>B.st.stall*1.3 ? 0.2 : -0.03; g.update(1/30); if(!B.onGround) up=true; } g.keys={};
ok(up && B.alive, 'the bomber rolls and lifts off ('+(B.alive?'alive':'dead')+', ground roll '+Math.round(B.pos.distanceTo(roll0))+' m of '+Math.round(rw.hl*2)+')');
ok(P0.parked && P0.alive, 'the Gallant still parked on the field');
// a direct swap into a fresh plane in flight
const F=g.addPlane({loadout:G.stockLoadout('mantis'), team:0, pos:B.pos.clone().add(new THREE.Vector3(0,50,0)), q:B.q.clone(), speed:80});
g.swapPlayer(F); ok(g.player===F && !B.isPlayer && !B.alive, 'direct swap mid-air: the plane left in the air is taken away');
console.log(bad ? bad+' FAILED' : 'swap: all clear');`;
fs.writeFileSync('/home/claude/test/swaptest_run.js',src);
