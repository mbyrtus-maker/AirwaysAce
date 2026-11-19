(function(){
'use strict';
/* =====================================================================
   Open skies: four regions the Lucky Margaret can sail between, contacts you meet by landing at their field or
   hooking their skyhook, side jobs (races, stunt shows, deliveries, airdrops, rescues, smuggling, bounties,
   treasure hunts), hidden treasure, free-flight stunt scoring and the odd bandit patrol.
   ===================================================================== */
const G = window.G, V3 = THREE.Vector3, Q = THREE.Quaternion;
const K = G.storyKit, CITY = K.CITY, STRIP = K.STRIP, base = G.MISSIONS.ambush;
const tA = new V3(), tB = new V3(), tC = new V3(), UP = new V3(0, 1, 0), Z = new V3(0, 0, 1);
const MPH = G.MPH, YD = 1/0.9144, FT = 3.28084;
const fmt = t => { t = Math.max(0, t); const m = Math.floor(t/60), s = t - m*60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
const clock = t => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t/60)}:${String(t%60).padStart(2, '0')}`; };
const MEDAL = {gold:3, silver:2, bronze:1};

/* ---------- time of day ---------- */
G.timeOfDay = (h = G.save.open.hour) => h >= 20 || h < 5 ? 'night' : h >= 17 ? 'evening' : 'day';
G.timeLabel = (h = G.save.open.hour) => `${String(h).padStart(2, '0')}:00 · ${{night:'Night', evening:'Dusk', day:h < 8 ? 'Dawn' : h < 12 ? 'Morning' : 'Afternoon'}[G.timeOfDay(h)]}`;
G.advanceHours = n => { const S = G.save.open; S.hour += n; while (S.hour >= 24) { S.hour -= 24; S.day++; } G.persist(); };

/* ---------- gangs ---------- */
const GANGS = {
  tigers:  {name:'Paper Tigers', paints:[[0xd94f8a, 0x2b1b3a, 0xf2c14e], [0xf2c14e, 0x2b1b3a, 0xd94f8a], [0x7b3fa0, 0xf1e9d6, 0xf2c14e]]},
  lantern: {name:'Black Lantern', paints:[[0x7a1f1f, 0x1b1b1b, 0xd9b44a]]},
  rattlers:{name:'Rattlesnake Gang', paints:[[0xc8a25a, 0x5a3b22, 0x2d2d2d], [0x8a5a2a, 0xe8d8b0, 0x2d2d2d]]},
  wolves:  {name:'Frost Wolves', paints:[[0x5a6470, 0xe8edf2, 0x8e231c], [0xe8edf2, 0x3a4048, 0x8e231c]]},
  corsairs:{name:'Corsairs', paints:[[0x1f6f9e, 0xf1e9d6, 0xd94f4f], [0x0f3b55, 0xd9b44a, 0xd94f4f]]},
  customs: {name:'Customs', paints:[[0x22324a, 0xf1e9d6, 0xd9b44a]]},
  brethren:{name:'Brethren of Calavera', paints:[[0x161616, 0xe8e0cc, 0x9e1b1b], [0x3a1010, 0x1a1a1a, 0xe0742a], [0x1f1f24, 0xb88a2a, 0xe8e0cc]]},
  navy:    {name:'the Navy', paints:[[0x2a3a52, 0xe8edf2, 0xb88a2a]]}
};
G.GANGS = GANGS;

/* =====================================================================
   Regions. Places are found on the region's own terrain when the chart first needs them, so they always land
   somewhere sensible: 'flat' ground for a field, the 'high' point for a skyhook hotel, the 'coast' for a lighthouse.
   ===================================================================== */
const REG = G.REGIONS = {
  halcyon:{id:'halcyon', name:'Halcyon Island', nation:'Sierra Free State', seed:1931, terrain:'halcyon', chart:[150, 250], danger:0.25, gang:'tigers', city:true,
    blurb:'Home waters. Port Halcyon\'s Deco towers, the Café Lafayette out at Saint-Remy, green hills and a lighthouse on the point.',
    margaret:{x:0, y:720, z:0},
    sites:[
      {id:'aeroworks', kind:'hook', name:'Halcyon Aero Works', contact:'hollis', at:{x:CITY.x + 48, z:CITY.z - 48}, city:true, tower:{h:140, w:40}},
      {id:'stremy', kind:'strip', name:'Saint-Remy airstrip', contact:'odile', at:{x:STRIP.x, z:STRIP.z}, r:STRIP.r, yaw:STRIP.yaw, strip:{}},
      {id:'bayport', kind:'strip', name:'Bayport', contact:'tom', at:{want:'flat', x:700, z:3500, r:1500}, r:420, yaw:0.9, town:16, strip:{sign:'BAYPORT', walls:0xd8d0c0, trim:0x2f5d8a, accent:0xc0392b, signCol:'#2a1d10', signGlow:'#f2c14e'}},
      {id:'kingsbridge', kind:'hook', name:'Kingsbridge', contact:'agatha', at:{want:'flat', x:-3200, z:500, r:1500}, r:330, town:true, tower:{h:96, w:34, walls:0xb9a891, sign:'KINGSBRIDGE GRAIN CO.', signCol:'#2a1d10', signGlow:'#dba63e'}}
    ],
    marks:[
      {id:'light', kind:'lighthouse', name:'Halcyon Point lighthouse', at:{want:'coast', a:Math.PI*0.42}},
      {id:'viaduct', kind:'viaduct', name:'the old viaduct', at:{x:1300, z:-2500}},
      {id:'mill', kind:'windmill', name:'the windmill', at:{want:'high', x:-1700, z:2600, r:1000, maxH:260}},
      {id:'cove', kind:'none', name:'Smuggler\'s Cove', at:{want:'coast', a:-Math.PI*0.72}},
      {id:'crag', kind:'none', name:'Halcyon Crag', at:{want:'high', x:0, z:0, r:4000}}
    ],
    treasures:[
      {id:'h1', name:'The railwayman\'s savings', at:'viaduct', hint:'A railwayman swears he buried his savings where the trains stopped running. Under the arches, low.', reward:{livery:'halcyon', cash:1000}},
      {id:'h2', name:'The miller\'s strongbox', at:'mill', off:[40, 30], hint:'Old Hendrik the miller never trusted banks. Look up on his hill.', reward:{cash:2500}},
      {id:'h3', name:'Lighthouse Loop', at:'light', race:{circuit:{at:'light', r:1100, n:9, agl:55}, low:true}, hint:'There\'s a time-trial gate on Halcyon Point. Fly through it and the clock starts.', reward:{cash:3000}},
      {id:'h4', name:'Rum-runner\'s crate', at:'cove', hint:'Rum-runners used to stash crates on the south-west beach. One of them never came back for his.', reward:{mod:'winch'}},
      {id:'h5', name:'The eagle\'s nest', at:'crag', hint:'Somebody left a box of gold teeth on the highest crag on the island. Don\'t ask whose.', reward:{cash:4000}}
    ]},
  badlands:{id:'badlands', name:'Red Mesa Badlands', nation:'Free State of Coronado', seed:4410, terrain:'badlands', chart:[440, 210], danger:0.55, gang:'rattlers',
    blurb:'Red rock, flat-topped mesas and canyons cut down to the river. Racing country, bandit country.',
    margaret:{x:0, y:780, z:0},
    sites:[
      {id:'dustdevil', kind:'strip', name:'Dust Devil Field', contact:'kate', at:{want:'flat', x:-1800, z:1200, r:1400}, r:400, yaw:0.2, strip:{sign:'DUST DEVIL FIELD', walls:0xd9b48a, trim:0x6b3a2a, accent:0xc0392b, grass:0x9a7a4a, tar:0x5a4a3a, signCol:'#ffb04a', signGlow:'#ffe3a0'}},
      {id:'silverspur', kind:'hook', name:'Silver Spur Hotel', contact:'pratt', at:{want:'high', x:2200, z:-900, r:1200}, r:330, town:true, tower:{h:104, w:36, walls:0xc9a27a, sign:'SILVER SPUR HOTEL', signCol:'#3a2418', signGlow:'#dba63e'}},
      {id:'copperton', kind:'strip', name:'Copperton', contact:'doc', at:{want:'flat', x:-200, z:-2900, r:1500}, r:420, yaw:1.4, town:18, strip:{sign:'COPPERTON', walls:0xc9a27a, trim:0x6b3a2a, accent:0x2f5d8a, signCol:'#2a1d10', signGlow:'#f2c14e'}},
      {id:'cibola', kind:'strip', name:'Cíbola', contact:'ramon', at:{want:'cavern'}, cavern:true, cityOf:'cibola', townOff:[-145, 0], townR:80, strip:{sign:'CÍBOLA', walls:0xe0c8a0, trim:0x8e231c, accent:0xd9b44a, grass:0x9a7a4a, tar:0x5a4a3a, signCol:'#dba63e', signGlow:'#ffe3a0'}},
      {id:'aguafria', kind:'hook', name:'Agua Fria', contact:'lucia', at:{want:'high', x:2500, z:1000, r:900}, r:330, town:true, tower:{h:88, w:34, walls:0xe0c8a0, sign:'HOTEL AGUA FRIA', signCol:'#6b3a2a', signGlow:'#f2c14e'}}
    ],
    marks:[
      {id:'trestle', kind:'viaduct', name:'the Coronado trestle', at:{want:'span', x:-450, z:-780, r:350, between:['copperton', 'dustdevil']}},   // on the Copperton Line, where it has to cross the river
      {id:'mine', kind:'mine', name:'the Lucky Strike mine', at:{want:'high', x:-2600, z:-2600, r:1400}},
      {id:'hideout', kind:'hideout', name:'Rattlesnake Gulch', at:{want:'low', x:3200, z:2800, r:1500, minH:10}},
      {id:'canyon', kind:'none', name:'the deep canyon', at:{want:'low', x:1600, z:-2600, r:1500, minH:4}},
      {id:'butte', kind:'none', name:'Sentinel Butte', at:{want:'high', x:0, z:0, r:5000}}
    ],
    // rock: the rough-hewn interior. The gate is an open slot canyon ending in a short roofed portal: hw0 at the mouth to hw1 at the mesa wall are half-widths of the
    // terrain cut, cw0 to cw1 the half-widths left clear between the rock walls built inside it (a test of flying, but open to the sky)
    cavern:{id:'cibola', name:'Cíbola', rx:330, rz:230, H:95, rock:true, gate:{id:'cibolagate', name:'the Gate of Cíbola', bw:44, bh:36, shape:'none', cut:66, canyon:{hw0:92, hw1:70, cw0:51, cw1:28, len:58}}},
    treasures:[
      {id:'b1', name:'Canyon cache', at:'canyon', hint:'Prospectors say a stagecoach went off the rim into the deep canyon south-east. The strongbox is still down there.', reward:{cash:3000}},
      {id:'b2', name:'The Sentinel\'s secret', at:'butte', hint:'On top of Sentinel Butte, the tallest rock in the Badlands, there\'s a tarp over something with wings.', reward:{chassis:'grackle'}},
      {id:'b3', name:'Mesa Mile', at:[-300, -300], race:{circuit:{at:[-300, -300], r:1400, n:10, agl:45}, low:true}, hint:'Kate laid out a time trial between the mesas. The gate\'s near the middle of the Badlands.', reward:{cash:3500}},
      {id:'b4', name:'Trestle tin', at:'trestle', hint:'A railroad paymaster hid a tin under the Coronado trestle. Fly under it, low.', reward:{livery:'desert', cash:1000}},
      {id:'b5', name:'Rattler\'s gold', at:'mine', off:[60, -40], hint:'The Rattlesnake Kid buried his share near the Lucky Strike mine head.', reward:{cash:5000}}
    ]},
  frostback:{id:'frostback', name:'Frostback Range', nation:'Kingdom of the Cascades', seed:7313, terrain:'frostback', chart:[330, 80], danger:0.2, gang:'wolves',
    blurb:'Snow peaks, glacier valleys and a cold blue lake. A grand old lodge with a skyhook on the mountainside, and mail pilots who fly the passes in any weather.',
    margaret:{x:0, y:880, z:0},
    sites:[
      {id:'lodge', kind:'hook', name:'Glacier Lodge', contact:'baroness', at:{want:'high', x:-1800, z:-1600, r:1500, maxH:300}, r:150, tower:{h:96, w:34, walls:0x8a5a3a, sign:'GLACIER LODGE', signCol:'#f1e9d6', signGlow:'#8fb4d8'}},
      {id:'pass', kind:'strip', name:'Pass Station', contact:'postie', at:{want:'flat', x:1400, z:1800, r:1600, minH:20}, r:400, yaw:1.1, strip:{sign:'PASS STATION', walls:0xe8e0d0, trim:0x8e231c, accent:0x1f3b6b, grass:0x6a7a5a, signCol:'#c0392b', signGlow:'#ffe8c8'}},
      {id:'meadow', kind:'field', name:'Avalanche Meadow', at:{want:'flat', x:-3000, z:2400, r:1600, minH:60}, r:130},
      {id:'edelweiss', kind:'hook', name:'Edelweiss', contact:'otto', at:{want:'high', x:-200, z:3500, r:1300, maxH:320}, r:330, town:true, tower:{h:86, w:32, walls:0xe8e0d0, sign:'HOTEL EDELWEISS', signCol:'#1f3b6b', signGlow:'#f1e9d6'}},
      {id:'tannen', kind:'strip', name:'Tannenbrück', contact:'greta', at:{want:'flat', x:3200, z:-700, r:1500, minH:20}, r:420, yaw:0.4, town:14, strip:{sign:'TANNENBRÜCK', walls:0xe8e0d0, trim:0x8e231c, accent:0x1f3b6b, signCol:'#2a1d10', signGlow:'#f2c14e'}}
    ],
    marks:[
      {id:'observatory', kind:'observatory', name:'the Kesselberg observatory', at:{want:'high', x:2600, z:-2400, r:1600}},
      {id:'gorge', kind:'viaduct', name:'the gorge bridge', at:{want:'low', x:-500, z:2700, r:1300, minH:20}},
      {id:'lake', kind:'none', name:'Lake Weiss', at:{x:600, z:-300}},
      {id:'summit', kind:'none', name:'the Frostback summit', at:{want:'high', x:0, z:0, r:5500}},
      {id:'falls', kind:'none', name:'the frozen falls', at:{want:'low', x:-2700, z:-400, r:1400, minH:20}}
    ],
    tunnels:[
      {id:'throat', name:'the Dragon\'s Throat', shape:'s', amp:45, len:[500, 850], bw:36, bh:30},
      {id:'icegate', name:'the Ice Gate', shape:'bend', amp:70, len:[420, 750], bw:42, bh:34},
      {id:'longdark', name:'the Long Dark', shape:'s', amp:60, len:[800, 1150], bw:30, bh:24, bonus:3000}
    ],
    treasures:[
      {id:'f1', name:'Summit cairn', at:'summit', hint:'The first men up the Frostback left something in a cairn on the summit. Something with rotors.', reward:{chassis:'whirligig'}},
      {id:'f2', name:'Bridge troll\'s hoard', at:'gorge', hint:'The bridge-keeper in the gorge kept his tolls in a box under the span.', reward:{livery:'glacier', cash:1000}},
      {id:'f3', name:'Lake Circuit', at:'lake', race:{circuit:{at:'lake', r:950, n:9, agl:28}, low:true}, hint:'Postie\'s lake circuit is marked by a gate on the shore of Lake Weiss. Low and fast.', reward:{cash:3500}},
      {id:'f4', name:'Frozen falls', at:'falls', hint:'A smuggler\'s sled went through the ice at the foot of the frozen falls, west of the lake.', reward:{cash:3500}},
      {id:'f5', name:'Stargazer\'s chest', at:'observatory', off:[50, 40], hint:'The old astronomer hid his prize money beside the observatory dome.', reward:{mod:'spars'}}
    ]},
  keys:{id:'keys', name:'Corsair Keys', nation:'Free Port of Maravilla', seed:2207, terrain:'keys', chart:[450, 360], danger:0.65, gang:'corsairs',
    blurb:'Palm keys scattered across warm shallows, and sea caves you can thread at wave-top height. Rum-runners, a navy fort that can\'t keep up, and corsairs who think the sea lanes are a toll road.',
    margaret:{x:0, y:700, z:0},
    sites:[
      {id:'anchor', kind:'strip', name:'The Rusty Anchor', contact:'rosa', at:{want:'land', x:1500, z:1500, r:1600}, r:400, yaw:1.1, strip:{sign:'THE RUSTY ANCHOR', walls:0xe8d8b8, trim:0x1f6f9e, accent:0xd94f4f, grass:0x8aa04a, signCol:'#ff6a4a', signGlow:'#9ef0e0'}},
      {id:'fort', kind:'hook', name:'Fort Maravilla', contact:'hale', at:{want:'land', x:-1800, z:-700, r:1600}, r:150, tower:{h:84, w:36, walls:0xd8c8a8, sign:'FORT MARAVILLA', signCol:'#1f2a44', signGlow:'#f1e9d6'}},
      {id:'puerto', kind:'strip', name:'Puerto Azul', contact:'ignacio', at:{want:'land', x:-400, z:3200, r:1600}, r:420, yaw:2.2, town:16, strip:{sign:'PUERTO AZUL', walls:0xf1e6d0, trim:0x1f6f9e, accent:0xd94f4f, signCol:'#2a1d10', signGlow:'#f2c14e'}},
      {id:'tortuga', kind:'hook', name:'Isla Tortuga', contact:'mae', at:{want:'land', x:3200, z:900, r:1500}, r:330, town:true, tower:{h:80, w:32, walls:0xd8c0a0, sign:'THE TORTUGA ARMS', signCol:'#1f6f9e', signGlow:'#f2c14e'}}
    ],
    marks:[
      {id:'klight', kind:'lighthouse', name:'Maravilla light', at:{want:'land', x:300, z:-2700, r:1600}},
      {id:'hulk', kind:'hulk', name:'the wreck of the Esperanza', at:{want:'land', x:-2600, z:2400, r:1800}},
      {id:'kcove', kind:'none', name:'Blackwater Cove', at:{want:'land', x:2900, z:-1900, r:1600}},
      {id:'isle', kind:'hideout', name:'Corsair Isle', at:{want:'land', x:3400, z:3200, r:1800}},
      {id:'kpeak', kind:'none', name:'the tallest key', at:{want:'high', x:0, z:0, r:5000}}
    ],
    tunnels:[
      {id:'mouth', name:'the Devil\'s Mouth', shape:'s', amp:30, len:[260, 560], bw:34, bh:22, sea:true},
      {id:'grotto', name:'Smuggler\'s Grotto', shape:'bend', amp:40, len:[180, 420], bw:30, bh:18, sea:true, ledge:true},
      {id:'cathedral', name:'Cathedral Arch', shape:'bend', amp:28, len:[160, 360], bw:42, bh:22, sea:true},
      {id:'needle', name:'the Needle\'s Eye', shape:'s', amp:20, len:[160, 360], bw:24, bh:15, sea:true, bonus:2500}
    ],
    treasures:[
      {id:'k1', name:'The Esperanza\'s strongroom', at:'hulk', off:[30, 20], hint:'The Esperanza ran aground in the north-west keys with the payroll aboard. Fly low over the wreck.', reward:{livery:'corsair', cash:1500}},
      {id:'k2', name:'Hilltop hangar', at:'kpeak', hint:'A navy pilot deserted and hid his plane on the tallest key. Nobody\'s been up to look.', reward:{chassis:'jackal'}},
      {id:'k3', name:'Lagoon Sprint', at:[0, 0], race:{circuit:{at:[0, 0], r:1500, n:10, agl:24}, low:true}, hint:'There\'s a race gate in the middle of the keys. Wave-top height all the way round.', reward:{cash:3500}},
      {id:'k4', name:'Blackwater doubloons', at:'kcove', hint:'Pirates buried doubloons in Blackwater Cove, out east. The crabs are guarding them.', reward:{cash:3500}},
      {id:'k5', name:'Keeper\'s lamp oil', at:'klight', off:[40, -30], hint:'The Maravilla lighthouse keeper sells "lamp oil" by the crate. Look round the back.', reward:{cash:5000}},
      {id:'k6', name:'The grotto chest', at:'grotto', ledge:7, hint:'Rosa\'s grandfather kept a chest on a ledge inside Smuggler\'s Grotto, a sea cave through an island in the far south of the Keys, round the bend where the tunnel turns. You\'ll have to fly in to reach it.', reward:{mod:'gyro', cash:1500}}
    ]},
  calavera:{id:'calavera', name:'The Calavera Isles', nation:'Brethren of the Black Flag', seed:6613, terrain:'calavera', chart:[292, 330], danger:0.85, gang:'brethren',
    blurb:'Fly high enough and the islands grin at you: a volcanic skull with a smoking crown, a lagoon for one eye and a lake of fire for the other. The Brethren of the Black Flag run every harbour on it, and nobody flies the Calavera without paying somebody.',
    margaret:{x:0, y:720, z:-6400},
    sites:[
      {id:'jawbone', kind:'strip', name:'Port Jawbone', contact:'molly', at:{want:'flat', x:-1300, z:-3000, r:900}, r:430, yaw:1.57, town:22, strip:{sign:'PORT JAWBONE', walls:0x4a3a32, trim:0x9e1b1b, accent:0xe8e0cc, grass:0x3a3a2a, tar:0x2a2626, signCol:'#e8e0cc', signGlow:'#ff6a3a'}},
      {id:'smoke', kind:'hook', name:'Smoke Harbour', contact:'sam', at:{want:'land', x:-3050, z:-600, r:700}, r:300, town:true, tower:{h:86, w:34, walls:0x3a3434, sign:'SMOKE HARBOUR YARDS', signCol:'#e0742a', signGlow:'#ffd08a'}},
      {id:'ashfall', kind:'strip', name:'Ashfall', contact:'hanne', at:{want:'flat', x:3000, z:-2500, r:900}, r:380, yaw:0.4, town:14, strip:{sign:'ASHFALL SULPHUR CO.', walls:0xd8c890, trim:0x5a5a52, accent:0xd9b44a, grass:0x5a5a40, signCol:'#2a2410', signGlow:'#f2e24e'}},
      {id:'gallows', kind:'hook', name:'Gallows Point', contact:'lucien', at:{want:'land', x:950, z:-1300, r:600}, r:200, town:true, tower:{h:78, w:30, walls:0x2a2224, sign:'THE GALLOWS', signCol:'#9e1b1b', signGlow:'#ff8a6a'}},
      {id:'cinder', kind:'strip', name:'Cinder Cove', contact:'pike', at:{want:'flat', x:-3700, z:2600, r:1100}, r:360, yaw:2.6, town:9, strip:{sign:'CINDER COVE', walls:0x8a7a6a, trim:0x1f3b4a, accent:0xd94f4f, grass:0x3a4a30, signCol:'#e8e0cc', signGlow:'#9ef0e0'}}
    ],
    marks:[
      {id:'keep', kind:'keep', name:'Brimstone Keep', at:{want:'land', x:0, z:2200, r:500}, flat:58},
      {id:'cranium', kind:'volcano', name:'Mount Cranium', at:{x:0, z:3000}, plume:2.2, caldera:125},
      {id:'burning', kind:'lava', name:'the Burning Eye', at:{x:1750, z:-600}, r:900},
      {id:'cheekw', kind:'volcano', name:'the west cheekbone', at:{want:'high', x:-3050, z:-1150, r:400}, plume:0.9},
      {id:'cheeke', kind:'volcano', name:'the east cheekbone', at:{want:'high', x:3050, z:-1150, r:400}, plume:1.1},
      {id:'teeth', kind:'none', name:'the Teeth', at:{x:0, z:-4100}},
      {id:'galleon', kind:'hulk', name:'the wreck of the Santa Muerte', at:{want:'land', x:4300, z:1700, r:1500}}
    ],
    tunnels:[
      {id:'gullet', name:'the Devil\'s Gullet', shape:'s', amp:34, len:[300, 640], bw:34, bh:24, bonus:3000},
      {id:'ember', name:'the Ember Tube', shape:'bend', amp:40, len:[220, 480], bw:32, bh:22},
      {id:'jawarch', name:'the Jaw Arch', shape:'bend', amp:24, len:[160, 360], bw:30, bh:18, sea:true}
    ],
    treasures:[
      {id:'v1', name:'The Santa Muerte\'s silver', at:'galleon', off:[30, -20], hint:'A Spanish galleon ran onto the east coast of the Calavera with a hold full of silver. Fly low over the wreck.', reward:{cash:4000}},
      {id:'v2', name:'Crater gold', at:'cranium', off:[40, -262], hint:'Old Brimstone\'s first crew hid their gold on the rim of Mount Cranium. Nobody goes up there. It\'s on fire.', reward:{livery:'brimstone', cash:2500}},
      {id:'v3', name:'The Teeth Run', at:[0, -4000], race:{circuit:{at:[0, -4000], r:1600, n:10, agl:26}, low:true}, hint:'Pirates race through the channels between the Teeth. Wave-top height, and mind the fangs.', reward:{cash:4500}},
      {id:'v4', name:'Pike\'s rum cache', at:'cinder', off:[260, 180], hint:'"Bilge" Pike buried a cache of navy rum somewhere east of Cinder Cove and drank the map.', reward:{cash:3000}},
      {id:'v5', name:'The Gullet chest', at:'gullet', ledge:7, hint:'There\'s a chest on a ledge inside the Devil\'s Gullet, a lava tube under the crown. Fly in slow and look right.', reward:{mod:'drums', cash:2000}}
    ]}
};

/* ---------- contacts ---------- */
const LOCAL = (o) => Object.assign({local:true, shop:[], music:'sidewalk'}, o);
G.CONTACTS = {
  ramon:LOCAL({club:true, name:'Ramón "El Topo" Vargas', role:'Alcalde of Cíbola, inside the mesa', music:'caravan', shop:[{mod:'lights'}, {mod:'hotrod'}], look:{skin:'#c88a60', hair:'#3a2a1a', hat:'cowboy', tache:true, coat:'#6b3a2a'},
    hello:['Welcome to Cíbola, amigo. You found the door. Most people fly right past it.', 'Mind the ceiling. It has been there a million years; your propeller has not.'],
    gossip:['The conquistadors never found the city of gold. They were looking on the outside of the mesa.', 'We have no taxes in Cíbola. The tax man cannot find the entrance.']}),
  tom:LOCAL({name:'Old Tom Pettigrew', role:'Harbourmaster, Bayport', look:{skin:'#e0a888', hair:'#d8d8d8', hat:'cap', tache:true, coat:'#2f3a4a'},
    hello:['Bayport\'s a fishing town, flyer. Mind you don\'t land on my nets.', 'Sit down, sit down. Kettle\'s on.'], gossip:['The herring\'s been poor since the Lantern started dumping their wrecks in the bay.', 'My grandson wants to fly. I told him: learn to swim first.']}),
  agatha:LOCAL({name:'Mrs. Agatha Finch', role:'Postmistress, Kingsbridge', look:{skin:'#f0d0b8', hair:'#b8b0a8', hat:'none', glasses:true, lips:true, coat:'#5a2a4a'},
    hello:['Oh! You came in through the grain elevator. How very modern.', 'Letters for the Margaret? No? Then do sit and gossip.'], gossip:['Mr. Hollis at the Aero Works orders a great deal of champagne for a man with no wife.', 'They say the Café Lafayette has a back room. Odile denies everything.']}),
  doc:LOCAL({name:'Doc Ambrose Holloway', role:'Town doctor, Copperton', look:{skin:'#d9a07a', hair:'#6a5a4a', hat:'bowler', tache:true, coat:'#3a3530'},
    hello:['Another flyer. Sit still and let me look at that cut.', 'Copperton\'s got one doctor, one saloon and one honest man. I\'m two of those.'], gossip:['Half my patients are Rattlesnake Gang. They pay in gold teeth.', 'Kate Calhoun\'s races put more men in my surgery than the mine does.']}),
  lucia:LOCAL({club:true, name:'Señora Lucia Romero', role:'Hotel keeper, Agua Fria', music:'jetaime', look:{skin:'#c88a60', hair:'#1f1714', hat:'none', lips:true, coat:'#8e231c', earring:true},
    hello:['Bienvenido! The springs are hot and the drinks are cold.', 'You flew through my hotel. Everyone does. It is why they come.'], gossip:['The Rattlesnake Kid drinks here on Sundays. Very polite. Terrible tipper.', 'Mayor Pratt owes me for forty dinners and an election.']}),
  otto:LOCAL({club:true, name:'Herr Otto Brandt', role:'Innkeeper, Edelweiss', music:'jetaime', look:{skin:'#f0c8a8', hair:'#c8a060', hat:'none', tache:true, coat:'#2f4a30'},
    hello:['Grüß Gott! Shake the snow off before you come in.', 'You hooked my hotel in the dark? Mein Gott. Schnapps, quickly.'], gossip:['The Baroness has been married four times. Five, if you count the pilot.', 'Postie Mulligan flies drunk. He says it keeps him warm.']}),
  greta:LOCAL({name:'Greta Lindqvist', role:'Ski instructor, Tannenbrück', look:{skin:'#f0d4c0', hair:'#e8d890', hat:'cap', lips:true, coat:'#1f6f9e'},
    hello:['Hej! You land like a skier. That is a compliment.', 'Snow\'s good up top this week. Watch the cornices.'], gossip:['Wolves on the high passes. The two-legged kind, with guns.', 'The observatory men come down once a month and drink the town dry.']}),
  ignacio:LOCAL({name:'Father Ignacio Reyes', role:'Parish priest, Puerto Azul', look:{skin:'#c08a60', hair:'#3a2a1a', hat:'none', glasses:true, coat:'#1f1714'},
    hello:['Peace be with you, flyer. And with your engine.', 'We pray for the fishermen, the sailors, and lately the pilots.'], gossip:['I hear many confessions. Rosa Marchetti\'s are the longest.', 'The Commodore means well. The corsairs mean otherwise.']}),
  mae:LOCAL({club:true, name:'"One-Eyed" Mae Shaughnessy', role:'Landlady, the Tortuga Arms', music:'caravan', look:{skin:'#e0a888', hair:'#b5562a', hat:'scarf', lips:true, coat:'#3a2418', earring:true},
    hello:['Well, aren\'t you a pretty thing. Pull up a barrel.', 'No fighting in my house. Outside, you can do as you like.'], gossip:['Corsairs drink here, navy drinks here. Nobody shoots anybody. My rules.', 'The Barracuda\'s captain owes me for a broken mirror.']}),
  hanne:LOCAL({name:'Hanne Vos', role:'Mine foreman, Ashfall', look:{skin:'#e8c0a0', hair:'#d8c890', hat:'cap', lips:true, coat:'#5a5a40'},
    hello:['Sulphur, flyer. Smells like the devil\'s laundry. You get used to it.', 'The Brethren take a third of every load. The volcano takes the rest of us.'], gossip:['Brimstone\'s men have been buying every ton of steel we can dig. Steel for what, in a volcano?', 'At night the Burning Eye lights the whole cheek red. The children call it the Devil winking.']}),
  pike:LOCAL({name:'"Bilge" Pike', role:'Smuggler, Cinder Cove', look:{skin:'#d9a07a', hair:'#6a5a4a', hat:'scarf', tache:true, coat:'#3a2a1a', earring:true},
    hello:['Ahoy. You\'re not navy. Navy knocks.', 'Sit down. Mind the crate, it\'s ticking. Probably a clock.'], gossip:['Every rum-runner from here to Maravilla pays Black Molly. Them as don\'t, swim.', 'Something big\'s being built in the Burning Eye. You can hear the riveting at night, over the bubbling.']}),
  molly:{club:true, name:'"Black" Molly Quinn', role:'Quartermaster of the Brethren, Port Jawbone', music:'caravan', look:{skin:'#e0a888', hair:'#1f1714', hat:'tricorn', lips:true, coat:'#2a1a1a', earring:true},
    hello:['New faces in Port Jawbone. How exciting. How suspicious.', 'Sit. Drink. Tell me something true, and I\'ll know if you don\'t.', 'You fly a pretty ship, Thirteen. Whose was she before?'],
    shop:[{mod:'drums'}, {mod:'plate'}]},
  sam:{name:'"Smokestack" Sam Okafor', role:'Shipwright, Smoke Harbour Yards', music:'sidewalk', look:{skin:'#7a4a30', hair:'#1f1714', hat:'cap', glasses:true, coat:'#3a3530'},
    hello:['Mind the slipway. And the sparks. And me.', 'You want it faster, louder or uglier? I do all three.'],
    shop:[{mod:'winch'}, {mod:'spars'}, {chassis:'bulldog', price:19000}, {chassis:'thunderbuss', price:27000}]},
  lucien:{club:true, name:'"Lucky" Lucien Delacroix', role:'Proprietor, the Gallows', music:'jetaime', look:{skin:'#c88a60', hair:'#3a2a1a', hat:'bowler', tache:true, coat:'#4a1a2a'},
    hello:['Welcome to the Gallows. The name is a joke. Mostly.', 'Cards, dice or aeroplanes? I take bets on all three.'],
    shop:[]},
  hollis:{name:'Augustin Hollis', role:'Chief designer, Halcyon Aero Works', music:'sidewalk', look:{skin:'#e2b48e', hair:'#b8b2a8', hat:'none', glasses:true, tache:true, coat:'#3a4a5a'},
    hello:['Ah, my favourite test pilot. Mind the drafting tables.', 'Come in, come in. Don\'t touch anything that\'s smoking.', 'You flew in through the gallery again. You know there\'s a door?'],
    shop:[{mod:'nitro'}, {mod:'gyro'}, {mod:'spars'}, {chassis:'sparrowhawk', price:14000}, {chassis:'ironclad', price:24000}]},
  odile:{club:true, name:'Odile Marchand', role:'Proprietress, Café Lafayette', music:'jetaime', look:{skin:'#e8c0a0', hair:'#1f1714', hat:'beret', lips:true, coat:'#7a1f2a'},
    hello:['Bonsoir, chéri. The usual? You never have the usual.', 'You land on my runway, you buy a coffee. That is the rule.', 'Sit, sit. I have a little job, if you are not afraid of customs men.'],
    shop:[]},
  kate:{club:true, name:'"Cactus" Kate Calhoun', role:'Race promoter, Dust Devil Field', music:'caravan', look:{skin:'#d9a07a', hair:'#b5562a', hat:'cowboy', coat:'#6b3a2a', lips:true},
    hello:['Well, look what the wind blew in! You here to race or to lose?', 'Pull up a crate. The coffee\'s terrible but the purses are real.', 'Folks are already laying bets on you. Don\'t make me look bad.'],
    shop:[{mod:'hotrod'}, {mod:'prop'}, {chassis:'mantis', price:16000}]},
  pratt:{club:true, name:'Mayor Ezekiel Pratt', role:'Mayor of Silver Spur', music:'sidewalk', look:{skin:'#e0b090', hair:'#8a8a8a', hat:'bowler', tache:true, coat:'#2a2a30'},
    hello:['Welcome to Silver Spur, the jewel of the Badlands. Population: worried.', 'The Rattlesnake Gang again. Always the Rattlesnake Gang.', 'Cigar? No? More for me. Now, about this job.'],
    shop:[{chassis:'highwayman', price:18000}]},
  baroness:{club:true, name:'Baroness Ingrid von Adler', role:'Owner, Glacier Lodge', music:'jetaime', look:{skin:'#f0d4c0', hair:'#e8d890', hat:'none', lips:true, coat:'#1f3b6b', pearls:true},
    hello:['Darling! You must stay for dinner. The view is the only thing here colder than my ex-husband.', 'My guests adore a show. Do try not to crash into the ballroom.', 'Champagne? It is chilled. Everything here is chilled.'],
    shop:[{mod:'plate'}, {mod:'winch'}, {chassis:'bulldog', price:22000}]},
  postie:{name:'Seamus "Postie" Mulligan', role:'Mail pilot, Pass Station', music:'sidewalk', look:{skin:'#e8b898', hair:'#c0602a', hat:'cap', tache:true, coat:'#4a5a3a'},
    hello:['The mail must go through! Usually. Mostly.', 'Twenty years flying these passes and I\'ve only been dead twice.', 'Mind the sacks. That one\'s full of fruitcake for the observatory.'],
    shop:[{mod:'drums'}]},
  rosa:{club:true, name:'Rosa "La Sirena" Marchetti', role:'Owner, The Rusty Anchor', music:'caravan', look:{skin:'#c88a60', hair:'#1f1714', hat:'scarf', lips:true, coat:'#1f6f9e', earring:true},
    hello:['A new face. Pretty plane. Can it outrun a navy patrol?', 'Rum, flyer? On the house. The rest of the house is for sale, though.', 'The Commodore doesn\'t need to know you were here.'],
    shop:[{mod:'lights'}, {chassis:'thunderbuss', price:26000}]},
  hale:{name:'Commodore Josiah Hale', role:'Commander, Fort Maravilla', music:'sidewalk', look:{skin:'#e8c0a0', hair:'#e8e8e8', hat:'naval', tache:true, coat:'#1f2a44'},
    hello:['At ease. I have more pirates than pilots and more paperwork than both.', 'You\'re the freelancer? Good. My budget only stretches to freelancers.', 'If you see Rosa Marchetti, you didn\'t see her. Officially.'],
    shop:[]}
};

/* ---------- jobs ----------
   type race:   course (circuit around a place, or a path), rivals, laps
   type stunt:  stunt-show box at a place: score so many points before the clock runs out
   type errand: legs of land / hook / drop / pickup / near / low / hoops; optional clock, fragile cargo, searchlights, interceptors
   type bounty: bandits (and maybe a zeppelin) waiting at a place */
G.JOBS = [
  // ---- Halcyon Island ----
  {id:'hollis_card', contact:'hollis', type:'stunt', title:'Air-show rehearsal', pay:2000, at:'aeroworks', r:800, target:5000, time:180, gates:3,
   blurb:'The Founders\' Day committee wants a rehearsal over the Aero Works. Score 5,000 stunt points in front of the tower within three minutes. Pylon gates are worth extra.',
   go:'Make it pretty. The committee is watching from the gallery.'},
  {id:'hollis_parts', contact:'hollis', type:'errand', title:'Parts for Saint-Remy', pay:1800, time:240, cargo:'Crate of magneto parts', fragile:{hard:true},
   legs:[{how:'land', site:'stremy', say:'Odile\'s mechanic is unloading the crate. Lovely landing.'}],
   blurb:'Odile\'s mechanic needs magneto parts at the Saint-Remy strip in four minutes. Land gently: a hard landing breaks the crate.', go:'The crate\'s strapped in. Gently, please.'},
  {id:'hollis_night', contact:'hollis', type:'errand', title:'Medicine for the lighthouse', pay:2400, time:300, night:true, cargo:'Medicine for the keeper\'s daughter',
   legs:[{how:'drop', mark:'light', say:'Crate away! The keeper\'s waving a lantern. He\'s got it.'}],
   blurb:'The lighthouse keeper\'s daughter has a fever and the road\'s washed out. Drop the medicine crate beside the lighthouse: under 230 ft and 150 mph over the flare.', go:'Follow the beam. And don\'t hit the lighthouse.'},
  {id:'odile_champagne', contact:'odile', type:'errand', title:'The champagne run', pay:2500, time:300, cargo:'Six cases of champagne', fragile:{damage:true, stunts:true}, reward:{livery:'lafayette'},
   legs:[{how:'hook', site:'aeroworks', say:'Not a bottle broken! The Aero Works board thanks you, and so does Odile.'}],
   blurb:'Six cases of the good stuff for the Aero Works board dinner, delivered by skyhook. Not one bullet hole, not one stunt. Champagne remembers.', go:'If one bottle breaks, chéri, you buy it. At my prices.'},
  {id:'odile_moon', contact:'odile', type:'errand', title:'Moonlight run', pay:4200, night:true, time:360, cargo:'Untaxed brandy', lights:{mark:'cove', n:4, r:1100}, rep:1,
   legs:[{how:'drop', mark:'cove', say:'The boat\'s got it! Now get out of there before the customs launch wakes up.'}],
   blurb:'Untaxed brandy for a fishing boat waiting in Smuggler\'s Cove. Customs have searchlights along the shore: stay out of the beams, or they\'ll scramble fighters. Low is safest.', go:'The customs men are lazy, but their searchlights are not.'},
  {id:'odile_derby', contact:'odile', type:'race', title:'The Saint-Remy Derby', pay:3000, rivals:3, laps:1, course:{path:['stremy', 'mill', 'crag', 'viaduct', 'stremy'], agl:90},
   blurb:'Odile\'s annual derby: Saint-Remy, the windmill, the crag, under-or-over the viaduct, and home. Three rivals and a bar tab for the winner.', go:'Win, and the champagne is free. Lose, and it is double.'},
  // ---- Red Mesa Badlands ----
  {id:'kate_canyon', contact:'kate', type:'race', title:'The Canyon Run', pay:3500, rivals:3, laps:1, low:true, reward:{livery:'sunset'}, course:{path:['dustdevil', 'trestle', 'canyon', 'hideout', 'dustdevil'], agl:50},
   blurb:'Low and mean through the canyons: under the Coronado trestle, the deep canyon, Rattlesnake Gulch and back. Three rivals. Gold wins the Mesa Sunset paint job.', go:'Stay low, stay lucky, and don\'t clip a mesa.'},
  {id:'kate_night', contact:'kate', type:'race', title:'Lantern Dash', pay:3200, night:true, rivals:0, laps:2, low:true, course:{circuit:{at:'dustdevil', r:1100, n:8, agl:45}},
   blurb:'Two laps round the field at night, rings lit by kerosene. Just you and the clock. Beat the bronze time to get paid.', go:'Can\'t see the mesas? Neither could the last fella.'},
  {id:'kate_show', contact:'kate', type:'stunt', title:'Barnstorming the crowd', pay:2500, at:'dustdevil', r:900, target:6000, time:180, gates:4,
   blurb:'Sunday crowd at Dust Devil. Give them 6,000 stunt points in three minutes over the field. Low passes and pylon gates bring the house down.', go:'Wave to the grandstand. And don\'t land in it.'},
  {id:'pratt_payroll', contact:'pratt', type:'errand', title:'The Silver Spur payroll', pay:4000, time:300, cargo:'The mine payroll', foes:[{leg:0, n:3, gang:'rattlers'}],
   legs:[{how:'land', site:'dustdevil', say:'Payroll\'s safe in Kate\'s strongbox. The miners get paid this week.'}],
   blurb:'The mine payroll goes to Dust Devil Field, and the Rattlesnake Gang knows it. Land at the field and taxi to the hangar with the cash still aboard.', go:'Every man in town is counting on you. No pressure.'},
  {id:'pratt_bounty', contact:'pratt', type:'bounty', title:'The Rattlesnake Kid', pay:3000, at:'hideout', gang:'rattlers', n:3, waves:[2], rep:1, reward:{chassis:'vandal'},
   ace:{name:'"The Rattlesnake Kid" Varga', paint:[0xc8a25a, 0x151312, 0xdba63e], skill:0.85},
   blurb:'The Rattlesnake Kid and his gang roost in Rattlesnake Gulch. Bring him down and his Vandal is yours. The town will pay the rest.', go:'Wanted dead or alive. Mostly dead.'},
  {id:'pratt_dynamite', contact:'pratt', type:'errand', title:'Dynamite for the Lucky Strike', pay:2600, time:300, cargo:'Two crates of dynamite', fragile:{stunts:true, damage:true},
   legs:[{how:'drop', mark:'mine', say:'Crates down, nobody blown up! The foreman\'s doing a little dance.'}],
   blurb:'The Lucky Strike mine needs dynamite, and the road is bandit country. Air-drop it beside the mine head. No stunts and no bullet holes, unless you want to be a crater.', go:'Smooth flying. Very, very smooth flying.'},
  // ---- Frostback Range ----
  {id:'baroness_show', contact:'baroness', type:'stunt', title:'The ice ball', pay:4000, at:'lodge', r:900, target:8000, time:200, gates:3,
   blurb:'The Baroness\'s winter ball wants entertainment. 8,000 stunt points in front of the lodge terrace, and threading the gallery at speed counts double for nerve.', go:'Do something scandalous, darling. Tastefully.'},
  {id:'baroness_rescue', contact:'baroness', type:'errand', title:'Avalanche at the meadow', pay:4500, time:420, cargo:'A rescued climber',
   legs:[{how:'pickup', site:'meadow', say:'He\'s aboard! Frostbitten and very grateful. Get him to the lodge.'}, {how:'hook', site:'lodge', say:'The lodge doctor has him. You\'re a hero, darling. Again.'}],
   blurb:'An avalanche caught a climbing party below the meadow. Land at Avalanche Meadow, take the survivor aboard, and bring him back to the lodge by skyhook.', go:'Hurry. He\'s been out there all night.'},
  {id:'baroness_aurora', contact:'baroness', type:'errand', title:'Northern lights tour', pay:3200, night:true, cargo:'The Baroness\'s guest', fragile:{stunts:true, comfort:true}, reward:{livery:'aurora'},
   legs:[{how:'hoops', around:'lake', r:1200, n:6, agl:160, say:'The guest is speechless. In a good way.'}, {how:'hook', site:'lodge', say:'Back at the lodge, and the guest has tipped handsomely.'}],
   blurb:'A wealthy guest wants to see the northern lights by air. Fly the six sightseeing hoops round Lake Weiss and bring them back to the lodge. Gentle turns, no stunts: if they get airsick, you don\'t get paid.', go:'Smooth as silk, darling. They bruise like a peach.'},
  {id:'postie_mail', contact:'postie', type:'race', title:'Mail through the pass', pay:3000, rivals:0, laps:1, low:true, course:{path:['pass', 'gorge', 'falls', 'meadow', 'pass'], agl:70},
   blurb:'The mail run through the passes against the clock: the gorge bridge, the frozen falls, over Avalanche Meadow and home. Beat bronze and the mail\'s on time.', go:'Neither snow nor rain nor mountains. Mind the mountains.'},
  {id:'postie_drop', contact:'postie', type:'errand', title:'Fruitcake for the observatory', pay:2500, time:300, cargo:'Mail sack (mostly fruitcake)',
   legs:[{how:'drop', mark:'observatory', say:'Mail delivered! The astronomers are cheering. Or freezing. Hard to tell.'}],
   blurb:'The observatory hasn\'t had mail in a month. Drop the sack beside the dome on the peak. Thin air, tricky winds.', go:'If you miss, it rolls all the way down to Pass Station.'},
  {id:'postie_night', contact:'postie', type:'errand', title:'The night mail', pay:3600, night:true, time:300, cargo:'Registered mail', rep:1,
   legs:[{how:'hook', site:'lodge', say:'Registered mail, on time, by moonlight. Postie\'s going to cry.'}],
   blurb:'Registered mail for Glacier Lodge, tonight, by skyhook. Find the lodge lights in the dark and thread the needle.', go:'Follow the lodge lights and pray.'},
  // ---- Corsair Keys ----
  {id:'rosa_rum', contact:'rosa', type:'errand', title:'The rum run', pay:5000, night:true, time:360, cargo:'Forty cases of rum', lights:{mark:'kcove', n:5, r:1200},
   legs:[{how:'drop', mark:'kcove', say:'The boys in the cove have it. Rosa says drinks are on her. Well, on you.'}],
   blurb:'Forty cases for a boat in Blackwater Cove. The navy has searchlights on the keys between here and there. Wave-top height keeps you under the beams.', go:'The navy can\'t catch what it can\'t see, flyer.'},
  {id:'rosa_reef', contact:'rosa', type:'race', title:'The Reef Race', pay:4000, rivals:3, laps:1, low:true, course:{path:['anchor', 'klight', 'kcove', 'isle', 'anchor'], agl:30},
   blurb:'Rosa\'s reef race: the light, Blackwater Cove, Corsair Isle and home, at wave-top height against three local hotshots.', go:'Spray on the windscreen means you\'re doing it right.'},
  {id:'rosa_bribe', contact:'rosa', type:'errand', title:'A gift for the Commodore', pay:2500, time:300, cargo:'A case of very old rum', fragile:{damage:true},
   legs:[{how:'hook', site:'fort', say:'The Commodore\'s aide took the case without a word. Diplomacy!'}],
   blurb:'A case of very old rum for Commodore Hale, delivered by the fort\'s skyhook. It\'s a gift. Gifts are not bribes. Don\'t let anyone put holes in it.', go:'Tell him it\'s from an admirer.'},
  // ---- the Calavera Isles ----
  {id:'molly_cutter', contact:'molly', type:'bounty', title:'The revenue cutter', pay:5500, at:'teeth', gang:'navy', n:3, waves:[2], rep:1,
   zep:{name:'Vigilant', paint:{hull:0x2a3a52, band:0xe8edf2, trim:0xb88a2a, scale:0.75, hpMul:0.7}},
   blurb:'A navy revenue cutter is sniffing round the Teeth, stopping our rum boats. Sink her, or make her strike her colours. Molly doesn\'t mind which.', go:'Fly the black flag, Thirteen. Proudly.'},
  {id:'molly_rum', contact:'molly', type:'errand', title:'Rum for Cinder Cove', pay:3600, night:true, time:300, cargo:'Forty cases of navy rum', fragile:{hard:true},
   legs:[{how:'land', site:'cinder', say:'Pike\'s lads are unloading. He\'s already opened one.'}],
   blurb:'Forty cases of rum, liberated from the navy, wanted at Cinder Cove tonight. Land soft. Broken bottles come out of your share.', go:'Lights off over the Keep. Brimstone doesn\'t like traffic at night.'},
  {id:'sam_teeth', contact:'sam', type:'race', title:'The Fang Derby', pay:3800, rivals:3, laps:1, low:true, course:{circuit:{at:'teeth', r:1300, n:9, agl:30}},
   blurb:'Sam\'s apprentices race the Fang Derby through the Teeth every Sunday. Win it and Sam\'s yard owes you a favour.', go:'Low, fast, and don\'t bite anything.'},
  {id:'sam_steel', contact:'sam', type:'errand', title:'Steel from Ashfall', pay:3000, time:300, cargo:'Rolled steel plate',
   legs:[{how:'land', site:'ashfall', say:'Hanne\'s men are loading the plate. Heavy stuff.'}, {how:'hook', site:'smoke', say:'Steel delivered. Sam\'s already cutting it.'}],
   blurb:'Pick up steel plate at Ashfall and bring it back to the Yards by skyhook. Brimstone wants it yesterday, and won\'t say what for.', go:'Don\'t ask what it\'s for. I don\'t.'},
  {id:'lucien_show', contact:'lucien', type:'stunt', title:'A show for the punters', pay:2800, at:'gallows', r:800, target:6000, time:180, gates:3,
   blurb:'Lucien\'s punters want a show over the Gallows. Score 6,000 stunt points in three minutes and he\'ll cut you in on the betting.', go:'Make them gasp. Gasping punters bet badly.'},
  {id:'hale_patrol', contact:'hale', type:'bounty', title:'Sink the Barracuda', pay:6000, at:'isle', gang:'corsairs', n:3, waves:[2],
   zep:{name:'Barracuda', paint:{hull:0x1f3b4a, band:0xd94f4f, trim:0xd9b44a, scale:0.78, hpMul:0.7}},
   blurb:'The corsair raider Barracuda is anchored off Corsair Isle with a fighter screen. Sink her or force her to surrender.', go:'Fair winds. Unfair gunnery.'},
  {id:'hale_ledger', contact:'hale', type:'errand', title:'The lost ledger', pay:4000, cargo:'Nothing yet', reward:{livery:'ledger'},
   legs:[{how:'near', mark:'klight', r:250, riddle:'Clue one, in the dead purser\'s hand: "Where the light watches the southern reef, I counted my coins."', say:'Scratched on the lighthouse wall: an arrow and a ship\'s name.'},
         {how:'low', mark:'hulk', riddle:'"The Esperanza keeps my secrets. Kiss her deck."', say:'There\'s a waterproof tin nailed to the wreck\'s mast!'},
         {how:'near', mark:'kpeak', r:300, riddle:'"From the highest key, look for the cove where the water runs black."', say:'From up here you can see it: the cove to the east, dark as ink.'},
         {how:'low', mark:'kcove', riddle:'"In Blackwater, under the leaning palm."', say:'The ledger! Every bribe the corsairs ever paid. The Commodore will be delighted.'}],
   blurb:'A corsair purser\'s ledger would hang half the pirates in the Keys. He left riddles. Follow them: the lighthouse, the wreck, the tallest key, and wherever that leads.', go:'Riddles. Why is it always riddles?'},
  {id:'hale_night', contact:'hale', type:'bounty', title:'Night raiders', pay:4500, night:true, at:'fort', gang:'corsairs', n:4, waves:[3],
   blurb:'Corsairs hit the fort at night when the gun crews can\'t see them. Tonight you\'re the gun crew. Two waves.', go:'Shoot anything without navy roundels.'},
  // ---- ship work: only for a pilot who owns the Whirligig, the one machine that can put down on a deck ----
  {id:'odile_doctor', contact:'odile', type:'errand', needs:'whirligig', title:'House call at sea', pay:4200, time:480, cargo:'Dr. Vernet and his bag', fragile:{hard:true}, medal:{gold:170, silver:260},
   legs:[{how:'deck', ship:'belle', load:6, verb:'the doctor is with her', say:'Dr. Vernet says it\'s her appendix and it won\'t wait for the pier. They\'re carrying her up to your machine. Bayport has a surgeon.'},
         {how:'land', site:'bayport', say:'Old Tom has the ambulance on the apron. She\'ll keep her life and lose her appendix.'}],
   blurb:'The coastal packet Halcyon Belle has wirelessed for a doctor: a passenger is very sick, and the ship is hours from a pier. Dr. Vernet was halfway through his soup. Put him down on the Belle\'s after stage (flaps down, under 65 mph over the deck), wait while he looks at her, then fly the patient to Bayport. Gently, both times.',
   go:'He has not finished his soup, chéri. Fly as if he were still holding the bowl.'},
  {id:'hollis_yacht', contact:'hollis', type:'errand', needs:'whirligig', title:'Late for the Aurelia', pay:3800, time:330, cargo:'Mr. Thaddeus Vandermeer, investor', fragile:{stunts:true, comfort:true}, medal:{gold:120, silver:190},
   legs:[{how:'deck', ship:'aurelia', load:4, verb:'Mr. Vandermeer is climbing out', say:'Mr. Vandermeer is aboard his yacht, hat on, breakfast down. The Aero Works gets its cheque.'}],
   blurb:'Mr. Vandermeer owns a bank, a yacht and, if this goes well, a third of the Aero Works. He overslept, and the Aurelia sailed without him. She is steaming off Halcyon Point. Land him on her after deck before she is out of reach. He is a poor flyer: no stunts, no hard turns.',
   go:'He has never flown before. If he asks what a rotor is for, tell him it is decorative.'},
  {id:'rosa_crate', contact:'rosa', type:'errand', needs:'whirligig', title:'The Rosalía\'s crate', pay:5600, time:420, cargo:'Nothing yet', hot:['resolute'], foes:[{leg:1, n:2, gang:'navy'}], medal:{gold:170, silver:260},
   legs:[{how:'deck', ship:'rosalia', load:6, verb:'lashing the crate down', say:'It\'s aboard and lashed down. Captain Reyes says vaya con Dios, and go now: the gunboat has seen you.'},
         {how:'land', site:'anchor', say:'The crate is in Rosa\'s cellar and the Navy is searching a tramp steamer full of bananas. Drinks, flyer.'}],
   blurb:'The tramp steamer Santa Rosalía carries bananas, according to her papers, and one crate that Rosa wants and the Navy wants more. The gunboat Resolute is closing on her to search. The Rosalía has a landing stage aft: put down on it, take the crate off her, and bring it to the Rusty Anchor. Once it is on your machine the Resolute will shoot at you instead, and she will call her planes.',
   go:'If the Commodore asks, it is church candles. It is always church candles.'},
  {id:'lucien_chart', contact:'lucien', type:'errand', needs:'whirligig', title:'The chart in the prize', pay:6000, cargo:'Nothing yet', hot:['blacktide', 'widow'], foes:[{leg:1, n:3, gang:'brethren'}], rep:1, medal:{gold:200, silver:300},
   legs:[{how:'deck', ship:'prize', load:5, verb:'cracking the purser\'s safe', say:'Got it: Captain Sorrow\'s own chart, every cache from here to the Teeth. And the prize crew is awake. Go!'},
         {how:'hook', site:'gallows', say:'Lucien is copying it already. He says you were never here, and neither was he.'}],
   blurb:'Last week Captain Sorrow took the packet Star of Maravilla as a prize, and he likes her so well that he has moved his chart into her purser\'s safe: every cache the Brethren ever buried. She is steaming round the island between his two galleons, the Black Tide and the Widow\'s Kiss, and she still has her landing stage. Put down on it, lift the chart, and bring it to the Gallows by skyhook. The galleons will open fire the moment you leave her deck, and their fighters will follow.',
   go:'His prize crew is drunk on her wine cellar. You have until they find the brandy.'}
];
const JOB = id => G.JOBS.find(j => j.id === id);
/* ship jobs need an autogyro: nobody mentions them until you own one */
G.jobOpen = j => !j.needs || (G.save.owned || []).includes(j.needs);

/* ---------- bar-room aces: pick a fight at any bar or club and settle it in the air, one on one ----------
   Each bar keeps a short ladder; beat the first and the next one is waiting. */
G.ACES = {
  odile:[{id:'renard', name:'Jacques "Le Renard" Duval', chassis:'sparrowhawk', paint:[0x1f3b6b, 0xf1e9d6, 0xc0392b], skill:0.68, purse:1500, line:'You spilled my wine, monsieur. Outside. In the air.'},
         {id:'comtesse', name:'"La Comtesse" Hélène Varga', chassis:'mantis', paint:[0x151312, 0xd94f8a, 0xf1e9d6], skill:0.82, purse:3500, guns:[['70', 'ap'], ['30', 'slug']], line:'Renard was a child. I am not.'}],
  kate:[{id:'sidewinder', name:'"Sidewinder" Sally Mae Burke', chassis:'vandal', paint:[0xe0742a, 0x2b2b2b, 0xf2c14e], skill:0.7, purse:1800, line:'Kate says you\'re fast. Let\'s see if you\'re any good.'},
        {id:'dusty', name:'"Dusty" Rhodes McAllister', chassis:'mantis', paint:[0xc8a25a, 0x6b3a2a, 0xf1e9d6], skill:0.84, purse:4000, line:'Nobody beats Sally. Except me. And maybe you, for about a minute.'}],
  pratt:[{id:'deputy', name:'Deputy Clem Hennessy', chassis:'highwayman', paint:[0x5a4632, 0xd9b44a, 0x1b1b1b], skill:0.72, purse:2000, line:'Mayor says no brawling in the saloon. Says nothing about the sky.'}],
  baroness:[{id:'graf', name:'Graf Leopold von Rhein', chassis:'sparrowhawk', paint:[0xf1f4f8, 0x1f2a44, 0xb88a2a], skill:0.76, purse:2500, line:'You have been dancing with the Baroness. Pistols are so vulgar. Aeroplanes, then.'},
            {id:'eisfalke', name:'"Eisfalke" Ingrid Sörensen', chassis:'mantis', paint:[0xe8edf2, 0x5fa0d8, 0x1f2a44], skill:0.88, purse:5000, guns:[['60', 'ex'], ['40', 'ap']], line:'The Graf was my student. I taught him everything except how to win.'}],
  rosa:[{id:'barracuda', name:'"Barracuda" Joe Castellano', chassis:'vandal', paint:[0x1f6f9e, 0xd94f4f, 0xf1e9d6], skill:0.72, purse:2000, line:'That\'s my stool, flyboy. Wanna make something of it?'},
        {id:'sirena', name:'"Sea Witch" Marisol Romano', chassis:'highwayman', paint:[0x0f3b55, 0x5fe0b0, 0xd9b44a], skill:0.86, purse:4500, line:'Rosa\'s little sister. And the better pilot. Don\'t tell her.'}],
  ramon:[{id:'gila', name:'"Gila Monster" Ruiz', chassis:'jackal', paint:[0x2b2b2b, 0xe0742a, 0xf2c14e], skill:0.82, purse:3800, line:'Nobody leaves Cíbola without dancing with the Gila Monster.'}],
  lucien:[{id:'ironjaw', name:'"Ironjaw" Ezra Thatch', chassis:'bulldog', paint:[0x161616, 0x9e1b1b, 0xe8e0cc], skill:0.78, purse:3000, line:'You\'re sitting in my chair, mate. Outside. Up.'},
           {id:'widow', name:'"Mother" Hester Gaunt', chassis:'highwayman', paint:[0x2a1a2a, 0xb88a2a, 0x9e1b1b], skill:0.88, purse:5500, guns:[['60', 'ex'], ['40', 'ap']], line:'Ironjaw\'s my boy. Nobody shoots my boy but me.'}],
  molly:[{id:'brand', name:'Jonah "the Brand" Kettle', chassis:'jackal', paint:[0x3a1010, 0xe0742a, 0x1a1a1a], skill:0.8, purse:3200, line:'Molly says you\'re trouble. I say you\'re a target.'}],
  lucia:[{id:'vaquero', name:'"El Vaquero" Mateo Romero', chassis:'gallant', paint:[0x8e231c, 0xf2c14e, 0x2b2b2b], skill:0.74, purse:2200, line:'My aunt says I must not fight guests. My aunt is not here.'}],
  otto:[{id:'jager', name:'"Jäger" Max Brandt', chassis:'sparrowhawk', paint:[0x2f4a30, 0xe8e0d0, 0x8e231c], skill:0.78, purse:2800, line:'My father pours your schnapps. I pour your lead. Ha!'}],
  mae:[{id:'patch', name:'"Patch" O\'Rourke', chassis:'vandal', paint:[0x2b2b2b, 0xd94f4f, 0xf2c14e], skill:0.74, purse:2000, line:'Mae says no fighting in her house. So come outside.'},
       {id:'kraken', name:'Captain "Kraken" Ironside', chassis:'bulldog', paint:[0x151312, 0x1f6f9e, 0xd9b44a], skill:0.9, purse:6000, guns:[['70', 'ex'], ['50', 'ap']], line:'You beat Patch. Patch owes me money. Now you owe me money.'}]
};
G.aceFor = cid => (G.ACES[cid] || []).find(a => !((G.save.open.jobs['duel_' + a.id] || {}).done)) || null;

/* =====================================================================
   Layout: find each place on the region's own terrain (cached per region).
   ===================================================================== */
function terrainProbe(R){
  if (!R._probe) { const o = Object.create(G.World.prototype); o.noise = G.Noise(R.seed); o.terr = R.terrain; o.RT = G.TERRAIN[R.terrain] || {}; R._probe = o; }
  return R._probe;
}
function place(R, s){
  if (!s || s.want === undefined) return {x:s.x, z:s.z};
  if (s.want === 'cavern') { const C = planCavern(R); return {x:C.x, z:C.z, yaw:C.yaw}; }
  const o = terrainProbe(R), f = (x, z) => o.raw(x, z);
  if (s.want === 'span') return placeSpan(R, s, f);
  if (s.want === 'coast') { let last = 2000; for (let r = 1500; r < 8500; r += 20) if (f(Math.sin(s.a)*r, Math.cos(s.a)*r) > 5) last = r; return {x:Math.sin(s.a)*(last - 70), z:Math.cos(s.a)*(last - 70)}; }
  const r = s.r || 800, st = r/12; let best = null, bs = -Infinity;
  for (let dx = -r; dx <= r; dx += st) for (let dz = -r; dz <= r; dz += st) {
    const d = Math.hypot(dx, dz); if (d > r) continue;
    const x = s.x + dx, z = s.z + dz; if (Math.hypot(x, z) > 6800) continue;
    const h = f(x, z); if (s.maxH !== undefined && h > s.maxH) continue;
    let sc = -Infinity;
    if (s.want === 'high') sc = h - d*0.002;
    else if (s.want === 'low') sc = h > (s.minH ?? 3) ? -h - d*0.002 : -Infinity;
    else if (s.want === 'land') sc = h > 7 ? -d - Math.abs(h - 20) : -Infinity;
    else if (s.want === 'sea') { let ok = h < -7; for (const [a, b] of [[60, 0], [-60, 0], [0, 80], [0, -80]]) if (f(x + a, z + b) > -3) ok = false; sc = ok ? -d : -Infinity; }
    else if (s.want === 'flat') { const sl = Math.abs(f(x + 30, z) - f(x - 30, z)) + Math.abs(f(x, z + 30) - f(x, z - 30)); sc = h > (s.minH ?? 12) ? -sl*4 - d*0.004 : -Infinity; }
    if (sc > bs) { bs = sc; best = {x, z}; }
  }
  return best || {x:s.x, z:s.z};
}
/* A railway crossing: the shortest straight span (220 to 420 m) over a river between two banks of the same height, square to
   the water, with level ground to run on to at both ends and clear of the region's other places. `between` names the two
   stops the line runs between: the crossing that takes it least out of its way wins. Returns the middle of the
   span, its yaw (the deck runs along local X turned by yaw), its length and the height of the banks. */
function placeSpan(R, s, f){
  const others = [...R.sites.filter(q => !q.cavern), ...R.marks.filter(q => q.at && q.at.want !== 'span')].map(q => place(R, q.at)); if (R.cavern) others.push(planCavern(R));
  const r = s.r || 1200, st = 25, ends = (s.between || []).map(id => place(R, R.sites.find(q => q.id === id).at)), far = (x, z, q) => Math.hypot(x - q.x, z - q.z); let best = null, bs = -Infinity;
  for (let dx = -r; dx <= r; dx += st) for (let dz = -r; dz <= r; dz += st) {
    const d = Math.hypot(dx, dz), cx = s.x + dx, cz = s.z + dz; if (d > r || Math.hypot(cx, cz) > 6400 || f(cx, cz) > 6) continue;
    if (others.some(q => Math.hypot(q.x - cx, q.z - cz) < 800)) continue;
    for (let k = 0; k < 24; k++) { const a = k*Math.PI/24, ux = Math.cos(a), uz = -Math.sin(a);
      for (let L = 220; L <= 420; L += 20) {
        const hA = f(cx - ux*L/2, cz - uz*L/2), hB = f(cx + ux*L/2, cz + uz*L/2); if (Math.abs(hA - hB) > 6 || Math.min(hA, hB) < 45) continue;
        const D = Math.max(hA, hB); let ok = true, wet = 0, rough = 0;
        for (let t = -L/2 + 20; t <= L/2 - 20 && ok; t += 10) { const h = f(cx + ux*t, cz + uz*t); if (h > D - 5) ok = false; if (h < 0.5) wet++; }
        if (!ok || !wet) continue;
        for (const sg of [-1, 1]) for (const e of [25, 50, 90, 140, 200, 280]) rough = Math.max(rough, Math.abs(f(cx + ux*sg*(L/2 + e), cz + uz*sg*(L/2 + e)) - D));
        const ax = cx - ux*L/2, az = cz - uz*L/2, bx = cx + ux*L/2, bz = cz + uz*L/2;
        const way = ends.length === 2 ? Math.min(far(ax, az, ends[0]) + far(bx, bz, ends[1]), far(bx, bz, ends[0]) + far(ax, az, ends[1])) + L - far(ends[0].x, ends[0].z, ends[1]) : d;
        const sc = -Math.abs(hA - hB)*2 - rough*2 - (L - 220)*0.08 - way*0.02;
        if (rough <= 9 && sc > bs) { bs = sc; best = {x:cx, z:cz, yaw:a, len:L, deck:D}; }
      } }
  }
  return best || place(R, {want:'low', x:s.x, z:s.z, r, minH:8});
}
function layout(R){
  if (R._L) return R._L;
  const L = {sites:{}, marks:{}};
  for (const s of R.sites) L.sites[s.id] = place(R, s.at);
  for (const m of R.marks) L.marks[m.id] = place(R, m.at);
  // tunnels are planned after the places, so they keep clear of them
  const avoid = [...Object.values(L.sites), ...Object.values(L.marks)];
  L.tunnels = (R.tunnels || []).map(td => { const T = planTunnel(R, td, avoid); if (T) avoid.push(T.mid); return T; }).filter(Boolean);
  if (R.cavern) L.tunnels.push(planCavern(R).gate);
  return (R._L = L);
}
G.regionLayout = id => layout(REG[id]);
/* A region's scenery for a story episode: landmarks, tunnels, towns and their airstrips and skyhooks, built by the
   same code as open skies. Call tick(dt) every frame for the smoke, beacons and the solid towers and tunnels. */
G.regionScene = (g, id, o = {}) => {
  const R = REG[id], L = layout(R), c = Object.create(G.MISSIONS.open);
  Object.assign(c, {g, R, L, time:g.world.time, night:g.world.time === 'night', anim:[], towers:[], arches:[], caves:[], tunnels:[], cavern:null, P:{}, markObj:{}, job:null, phase:1,
    sc:{chain:0, mult:1, last:-99, label:'', session:0, cont:0, shown:''}, story:true, rtick:null});
  for (const md of R.marks) { const p = L.marks[md.id]; c.P[md.id] = new V3(p.x, Math.max(g.world.height(p.x, p.z), 0.4), p.z); c.buildMark(g, md, c.P[md.id]); }
  if (R.cavern) c.buildCavern(g, planCavern(R));
  for (const T of L.tunnels) { c.tunnels.push(c.buildTunnel(g, T)); c.P[T.td.id] = new V3(T.mid.x, T.floor, T.mid.z); }
  c.sites = R.sites.map(sd => c.buildSite(g, sd, L.sites[sd.id]));
  for (const s of c.sites) c.P[s.id] = s.point;
  if (G.REGION_BUILD && G.REGION_BUILD[R.id]) G.REGION_BUILD[R.id](c, g);
  if (o.traffic !== false) { const T = g.traffic || (g.traffic = new G.Traffic(g)), stops = c.sites.filter(s => !s.def.cavern).map(s => s.point), pairs = [];
    for (let i = 0; i < stops.length; i++) for (let j = i + 1; j < stops.length; j++) pairs.push([stops[i], stops[j]]);
    T.routes(pairs.slice(0, 5), {night:c.night}); }
  c.tick = dt => { g.markers = []; for (const a of c.anim) a(dt); c.towerHit(g); c.caveHit(g); c.tunnelHit(g); c.cavernHit(g); if (c.rtick) c.rtick(g, dt); };
  c.worldOpts = time => ({seed:R.seed, region:R.terrain, time, flats:G.regionFlats(R), cuts:G.regionCuts(R)});
  return c;
};
G.regionWorld = (id, time) => { const R = REG[id]; return {seed:R.seed, region:R.terrain, time, flats:G.regionFlats(R), cuts:G.regionCuts(R)}; };
/* ---------- tunnel and cavern planning, on the region's own terrain ---------- */
const hashStr = s => [...s].reduce((a, c) => (a*31 + c.charCodeAt(0)) >>> 0, 7);
/* A soup of flat-shaded, vertex-coloured triangles: the rock, masonry and timber of a set piece, merged into one mesh. */
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v, sms = (a, b, x) => { const t = clamp01((x - a)/(b - a)); return t*t*(3 - 2*t); };
function Soup(){ this.p = []; this.c = []; }
Soup.prototype = {
  tri(a, b, c, k){ this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); if (typeof k === 'function') k = k((a[0] + b[0] + c[0])/3, (a[1] + b[1] + c[1])/3, (a[2] + b[2] + c[2])/3); for (let i = 0; i < 3; i++) this.c.push(k[0], k[1], k[2]); },
  quad(a, b, c, d, k){ this.tri(a, b, c, k); this.tri(a, c, d, k); },
  /* a hexahedron from two opposite faces (a0..a3 and b0..b3, the same way round) */
  hexa(A, B, k){ this.quad(A[0], A[1], A[2], A[3], k); this.quad(B[0], B[1], B[2], B[3], k); for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.quad(A[i], A[j], B[j], B[i], k); } },
  /* a square timber from a to b, r the half-thickness */
  beam(a, b, r, k){
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]) || 1; d[0] /= L; d[1] /= L; d[2] /= L;
    const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], u = [d[1]*up[2] - d[2]*up[1], d[2]*up[0] - d[0]*up[2], d[0]*up[1] - d[1]*up[0]], ul = Math.hypot(u[0], u[1], u[2]); u[0] /= ul; u[1] /= ul; u[2] /= ul;
    const v = [d[1]*u[2] - d[2]*u[1], d[2]*u[0] - d[0]*u[2], d[0]*u[1] - d[1]*u[0]], end = e => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([s, t]) => [e[0] + (u[0]*s + v[0]*t)*r, e[1] + (u[1]*s + v[1]*t)*r, e[2] + (u[2]*s + v[2]*t)*r]);
    this.hexa(end(a), end(b), k);
  },
  get tris(){ return this.p.length/9; },
  mesh(){ const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({vertexColors:true, flatShading:true, roughness:0.95, side:THREE.DoubleSide})); }
};
const cutHW = td => Math.max(td.bw/2 + 3, 54, td.cut || 0);   // half-width of the terrain cut for a bore
const boreTop = (td, x) => td.bh - td.bw/2 + Math.sqrt(Math.max(0, (td.bw/2)**2 - x*x));   // a Roman arch, measured from the floor
function tunnelPath(cx, cz, th, L, td, N = 40){
  const dx = Math.sin(th), dz = Math.cos(th), lx = Math.cos(th), lz = -Math.sin(th), pts = [];
  for (let i = 0; i <= N; i++) { const t = i/N, off = td.shape === 's' ? td.amp*Math.sin(2*Math.PI*t) : td.shape === 'bend' ? td.amp*Math.sin(Math.PI*t) : 0; pts.push({x:cx + dx*(t - 0.5)*L + lx*off, z:cz + dz*(t - 0.5)*L + lz*off}); }
  return pts;
}
function finishPath(pts){
  let s = 0; pts.forEach((p, i) => { if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); p.s = s;
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(b.x - a.x, b.z - a.z) || 1; p.dx = (b.x - a.x)/L; p.dz = (b.z - a.z)/L; p.lx = p.dz; p.lz = -p.dx; });
  return pts;
}
function planTunnel(R, td, avoid){
  const o = terrainProbe(R), f = (x, z) => o.raw(x, z), rng = G.rng(hashStr(R.id + td.id)), N = 40; let best = null, bs = -1e9;
  for (let tr = 0; tr < (td.sea ? 9000 : 2600); tr++) {
    const cx = (rng() - 0.5)*10400, cz = (rng() - 0.5)*10400; if (Math.hypot(cx, cz) > 5400) continue;
    if (avoid.some(p => Math.hypot(p.x - cx, p.z - cz) < (td.sea ? 600 : 800))) continue;
    const th = rng()*Math.PI*2, L = td.len[0] + rng()*(td.len[1] - td.len[0]), pts = tunnelPath(cx, cz, th, L, td, N);
    for (const p of pts) p.h = f(p.x, p.z);
    const hA = pts[0].h, hB = pts[N].h;
    let floor;
    if (td.sea) { if (hA > -4 || hB > -4) continue; floor = -2; }
    else { floor = Math.max(hA, hB) + 4; if (floor < 6 || Math.abs(hA - hB) > 60) continue; }
    const top = td.sea ? 3 : floor + td.bh + 10; let i0 = -1, i1 = -1;   // a sea cave only needs island over it: the rock ridge is raised to cover the bore
    for (let i = 0; i <= N; i++) if (pts[i].h > top) { if (i0 < 0) i0 = i; i1 = i; }
    if (i0 < 2 || i1 > N - 2) continue;
    let ok = true; for (let i = i0; i <= i1; i++) if (pts[i].h < (td.sea ? 1.5 : floor + td.bh + 4)) ok = false; if (!ok) continue;
    const cover = (i1 - i0)/N; if (cover < (td.sea ? 0.22 : 0.4) || pts[i1].s0 === 0) continue;
    // keep it inside the rock sideways too
    const m = pts[(i0 + i1) >> 1], th2 = th; let side = 1e9; for (const sd of [-1, 1]) side = Math.min(side, f(m.x + Math.cos(th2)*sd*(td.bw/2 + 25), m.z - Math.sin(th2)*sd*(td.bw/2 + 25)));
    if (side < (td.sea ? 2 : floor + td.bh)) continue;
    const sc = cover + (td.sea ? Math.min(30, side)/60 : (side - floor - td.bh)/400) - (td.sea ? 0 : Math.abs(hA - hB)/300);
    if (sc > bs) { bs = sc; best = {td, pts, floor, i0, i1}; }
  }
  if (!best) return null;
  // the roof runs out to wherever the ground drops below the floor, so the mouths open onto clear ground: no open trench
  const P = best.pts; while (best.i0 > 0 && P[best.i0 - 1].h > best.floor - 1) best.i0--; while (best.i1 < P.length - 1 && P[best.i1 + 1].h > best.floor - 1) best.i1++;
  finishPath(best.pts); best.mid = best.pts[(best.i0 + best.i1) >> 1];
  return best;
}
/* Cíbola: a hollow mesa. Find the place where a broad mesa stands highest over the plain beside it, with the major axis
   pointing out at that plain, so the entrance tunnel lines up with the runway inside. */
function planCavern(R){
  if (R._C) return R._C;
  const C = R.cavern, o = terrainProbe(R), f = (x, z) => o.raw(x, z); let best = null, bs = -1e9;
  const others = R.sites.filter(s => !s.cavern).map(s => place(R, s.at));   // keep clear of the other stops and their levelled ground
  for (let x = -4600; x <= 4600; x += 200) for (let z = -4600; z <= 4600; z += 200) {
    if (Math.hypot(x, z) > 5000 || others.some(p => Math.hypot(p.x - x, p.z - z) < 1700)) continue;
    for (let k = 0; k < 8; k++) {
      const a = k*Math.PI/4, ax = Math.sin(a), az = Math.cos(a);
      let lo = 1e9; for (let i = 0; i < 16; i++) { const t = i/16*Math.PI*2; for (const u of [0, 0.6, 1.0, 1.2]) { const lx = Math.cos(t)*C.rx*u, lz = Math.sin(t)*C.rz*u; lo = Math.min(lo, f(x + ax*lx - az*lz, z + az*lx + ax*lz)); } }
      const out = f(x + ax*(C.rx + 420), z + az*(C.rx + 420)), floor = Math.max(6, out + 3), room = lo - floor - C.H - 12;
      const sc = room - Math.max(0, out - lo + 200)*0.02;
      if (sc > bs) { bs = sc; best = {x, z, ax, az, floor:Math.min(floor, lo - C.H - 14), room, lo}; }
    }
  }
  const b = best, td = Object.assign({bonus:0}, C.gate), cy = td.canyon, inset = cy ? 8 : 25;   // a canyon gate's portal stops at the cavern wall
  const A = {x:b.x + b.ax*(C.rx + 430), z:b.z + b.az*(C.rx + 430)}, E = {x:b.x + b.ax*(C.rx - inset), z:b.z + b.az*(C.rx - inset)}, N = 30, pts = [];
  for (let i = 0; i <= N; i++) pts.push({x:A.x + (E.x - A.x)*i/N, z:A.z + (E.z - A.z)*i/N, h:f(A.x + (E.x - A.x)*i/N, A.z + (E.z - A.z)*i/N)});
  let i0 = pts.findIndex(p => p.h > b.floor + td.bh + 8); if (i0 < 1) i0 = 1;
  finishPath(pts);
  if (cy) i0 = N - Math.max(2, Math.round(cy.len/(pts[N].s/N)));   // only the last stretch through the mesa wall is roofed; the rest of the way in is open to the sky
  const gate = {td, pts, floor:b.floor, i0, i1:N, mid:pts[N], into:'cibola', im:Math.max(0, pts.findIndex(p => p.h > b.floor + 1) - 1)};
  // cutM: a rock cavern's floor is cut wider than the room, so the coarse terrain's ramps stay behind the rock wall
  return (R._C = {x:b.x, z:b.z, ax:[b.ax, b.az], yaw:Math.atan2(b.ax, b.az), floor:b.floor, rx:C.rx, rz:C.rz, H:C.H, gate, def:C, cutM:C.rock ? 60 : 0});
}
G.regionCuts = R => {
  // the cut must be wider than a terrain grid diagonal (~50 m), or ground triangles with an uncut corner rise into the bore
  const L = layout(R), cuts = L.tunnels.map(T => ({pts:T.pts.slice(T.i0, T.i1 + 1), hw:cutHW(T.td), floor:T.floor, flat:true}));   // only under the roof, squared off at the mouths
  if (R.cavern) { const C = planCavern(R); cuts.push({ell:{x:C.x, z:C.z, rx:C.rx + C.cutM, rz:C.rz + C.cutM, ax:C.ax}, floor:C.floor}); }
  // a slot canyon leading to a gate: an open cut that flares towards its mouth (after the roofed cuts, which win where they overlap)
  for (const T of L.tunnels) if (T.td.canyon) { const cy = T.td.canyon, n = T.i0; cuts.push({pts:T.pts.slice(0, n + 1).map((p, i) => ({x:p.x, z:p.z, hw:cy.hw0 + (cy.hw1 - cy.hw0)*i/n})), hw:Math.max(cy.hw0, cy.hw1), floor:T.floor, flat:true, open:true}); }
  return cuts;
};
G.regionFlats = R => {
  const L = layout(R), fl = R.sites.filter(s => s.r && !s.cavern).map(s => ({x:L.sites[s.id].x, z:L.sites[s.id].z, r:s.r}));
  if (R.city) fl.push({x:CITY.x, z:CITY.z, r:CITY.r});
  for (const m of R.marks || []) if (m.flat && L.marks[m.id]) fl.push({x:L.marks[m.id].x, z:L.marks[m.id].z, r:m.flat});   // a terrace cut into the hillside
  return fl;
};

/* =====================================================================
   Small set pieces built straight from primitives
   ===================================================================== */
const mesh = (geo, hex, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, o.basic ? new THREE.MeshBasicMaterial({color:hex}) : G.mat(hex, o.mat || {})); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; m.castShadow = true; m.receiveShadow = true; return m; };
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d), CYL = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n), CONE = (r, h, n = 8) => new THREE.ConeGeometry(r, h, n);
function buildCrate(){
  const g = new THREE.Group();
  g.add(mesh(BOX(2.6, 1.6, 1.8), 0x8a6a44, 0, 0.8, 0)); g.add(mesh(BOX(2.7, 0.25, 1.9), 0xb88a2a, 0, 0.4, 0)); g.add(mesh(BOX(2.7, 0.25, 1.9), 0xb88a2a, 0, 1.25, 0));
  g.add(mesh(CYL(0.06, 0.06, 7, 5), 0x3a3530, 0, 3.5, -1.2)); g.add(mesh(BOX(0.05, 1.2, 1.8), 0xd94f2a, 0, 6.3, -0.3, {mat:{side:THREE.DoubleSide}}));
  return g;
}
function buildObservatory(){
  const g = new THREE.Group();
  g.add(mesh(CYL(9, 10, 10, 12), 0xe8e0d0, 0, 5, 0)); g.add(mesh(new THREE.SphereGeometry(9, 12, 6, 0, Math.PI*2, 0, Math.PI/2), 0xc8ced4, 0, 10, 0, {mat:{metalness:0.3, roughness:0.4}}));
  g.add(mesh(BOX(2.2, 8, 9.4), 0x26221f, 0, 14, 0, {rx:-0.5})); g.add(mesh(BOX(10, 4, 8), 0xd8d0c0, 14, 2, 0)); g.add(mesh(new THREE.SphereGeometry(0.4, 6, 4), 0xffd27a, 0, 19.5, 0, {basic:true}));
  return g;
}
function buildMine(){
  const g = new THREE.Group(), wood = 0x6b4a2b;
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) g.add(mesh(CYL(0.35, 0.45, 18, 5), wood, x*0.8, 9, z*0.8, {rx:z*0.04, rz:-x*0.04}));
  const wheel = mesh(new THREE.TorusGeometry(3, 0.35, 5, 14), 0x3a3530, 0, 18.5, 0); g.add(wheel);
  [[14, 0, 0], [-12, 6, 0.5], [6, 16, 1.2]].forEach(([x, z, r]) => { g.add(mesh(BOX(7, 4, 6), 0x8a6a44, x, 2, z, {ry:r})); g.add(mesh(BOX(7.6, 0.5, 6.6), 0x5a4632, x, 4.2, z, {ry:r})); });
  g.add(mesh(BOX(1.4, 1, 6), 0x4a4038, -4, 0.5, 10));
  return g;
}
function buildHideout(){
  const g = new THREE.Group();
  [[0, 0, 0x8e5a2a], [14, 6, 0x6a7a4a], [-10, 9, 0x8a6a44]].forEach(([x, z, c]) => g.add(mesh(CONE(5, 6, 6), c, x, 3, z)));
  for (let i = 0; i < 5; i++) g.add(mesh(BOX(2, 1.4, 1.6), 0x6b4a2b, -4 + i*2.2, 0.7, -8));
  g.add(mesh(BOX(2, 0.2, 2), 0xd94f2a, 6, 0.15, -2));
  return g;
}
/* Brimstone Keep: a black-stone fortress on the flank of Mount Cranium, with a skull banner on the tallest tower. */
function buildKeep(){
  const g = new THREE.Group(), st = 0x2a2626, st2 = 0x3a3432;
  // it sits on a terrace hewn out of the mountain: a battered stone plinth runs down into the rock, with buttresses and a stair up from below
  g.add(mesh(CYL(36, 44, 26, 8), 0x2e2826, 0, -12, 0, {ry:Math.PI/8}));
  for (let i = 0; i < 8; i++) { const a = i*Math.PI/4 + Math.PI/8, x = Math.sin(a)*41, z = Math.cos(a)*41; g.add(mesh(BOX(7, 22, 9), 0x262120, x, -9, z, {ry:a, rx:0.18*Math.cos(a), rz:-0.18*Math.sin(a)})); }
  for (let i = 0; i < 10; i++) g.add(mesh(BOX(10, 1.6, 4), 0x3a3432, 0, -i*2.2 + 0.4, -40 - i*3.4));
  for (let i = 0; i < 9; i++) { const a = i*0.7 + 0.3, d = 52 + (i % 3)*9; g.add(mesh(new THREE.DodecahedronGeometry(6 + (i % 4)*2.5, 0), 0x2a2422, Math.sin(a)*d, -6 - (i % 3)*3, Math.cos(a)*d, {rx:i, ry:i*1.7})); }
  for (let i = 0; i < 8; i++) { const a = i*Math.PI/4, x = Math.sin(a)*26, z = Math.cos(a)*26; g.add(mesh(BOX(22, 12, 4), st, x, 6, z, {ry:a})); }
  for (let i = 0; i < 4; i++) { const a = i*Math.PI/2 + Math.PI/4, x = Math.sin(a)*28, z = Math.cos(a)*28; g.add(mesh(CYL(5, 6, 20, 8), st2, x, 10, z)); g.add(mesh(CONE(6.5, 7, 8), 0x5a1a1a, x, 23.5, z)); }
  g.add(mesh(BOX(18, 22, 18), st2, 0, 11, 0)); g.add(mesh(CYL(5, 6, 14, 8), st, 0, 29, 0)); g.add(mesh(CONE(6.5, 8, 8), 0x5a1a1a, 0, 40, 0));
  g.add(mesh(CYL(0.25, 0.25, 14, 5), 0x2a2420, 0, 51, 0));
  const flag = mesh(BOX(0.2, 5, 8), 0x111111, 0, 55, 4); g.add(flag);
  g.add(mesh(BOX(0.3, 1.6, 1.8), 0xe8e0cc, 0.1, 55.4, 4.2)); g.add(mesh(BOX(0.3, 0.4, 3.6), 0xe8e0cc, 0.1, 53.8, 4.2, {rx:0.6})); g.add(mesh(BOX(0.3, 0.4, 3.6), 0xe8e0cc, 0.1, 53.8, 4.2, {rx:-0.6}));
  for (let i = 0; i < 6; i++) { const w = mesh(BOX(1.2, 2, 0.3), 0x2a1a10, -6 + i*2.4, 15, 9.1, {mat:{emissive:0xffa040, emissiveIntensity:0.9}}); g.add(w); }
  return g;
}
/* A volcano's smoke: a leaning column of grey puffs that drift up and are recycled, with a red glow in the crater. */
function buildPlume(s, night){
  const g = new THREE.Group(), puffs = [], mat = new THREE.MeshBasicMaterial({color:0x5a5450, transparent:true, opacity:0.32, depthWrite:false, fog:true});
  const geo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(geo, mat); m.userData.t = i/14; g.add(m); puffs.push(m); }
  const glow = new THREE.Mesh(new THREE.CircleGeometry(60*s, 16), new THREE.MeshBasicMaterial({color:0xff5a1a, transparent:true, opacity:0.8, depthWrite:false})); glow.rotation.x = -Math.PI/2; glow.position.y = -20*s; g.add(glow);
  if (night) { const L = new THREE.PointLight(0xff6a2a, 2.2, 900*s, 1.6); L.position.y = 30; g.add(L); }
  g.userData.tick = dt => {
    for (const m of puffs) {
      m.userData.t = (m.userData.t + dt*0.022) % 1; const t = m.userData.t, r = (24 + t*150)*s;
      m.position.set(t*t*260*s, t*620*s, t*90*s); m.scale.setScalar(r); m.material.opacity = 0.32*(1 - t);
    }
    glow.material.opacity = 0.6 + Math.sin(performance.now()*0.002)*0.2;
  };
  g.userData.tick(0);
  return g;
}
/* The Burning Eye: a glowing skin over the lava crust, breathing slowly, with steam rising off it. */
function buildLava(r, night, lake){
  const g = new THREE.Group();
  if (lake) {   // a molten lake: a solid glowing floor with a darker crust drifting over it
    const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({color:0xff5010})); pool.rotation.x = -Math.PI/2; pool.position.y = -1; g.add(pool);
    const crust = new THREE.Mesh(new THREE.RingGeometry(r*0.25, r*0.92, 40, 1), new THREE.MeshBasicMaterial({color:0x3a1a0a, transparent:true, opacity:0.45, depthWrite:false})); crust.rotation.x = -Math.PI/2; g.add(crust);
    const L = new THREE.PointLight(0xff5a1a, night ? 3 : 1.2, r*4, 1.4); L.position.y = 60; g.add(L);
    g.userData.tick = () => { const t = performance.now()*0.001; crust.rotation.z = t*0.02; crust.material.opacity = 0.35 + 0.12*Math.sin(t*0.7); pool.material.color.setRGB(1, 0.3 + 0.06*Math.sin(t*1.3), 0.05); };
    return g;
  }
  const skin = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({color:0xff6a1a, transparent:true, opacity:0.35, depthWrite:false, blending:THREE.AdditiveBlending}));
  skin.rotation.x = -Math.PI/2; skin.scale.set(1.15, 0.92, 1); g.add(skin);
  const steam = buildPlume(1.4, night); steam.position.set(r*0.2, 0, -r*0.1); g.add(steam);
  if (night) { const L = new THREE.PointLight(0xff5a1a, 3, r*3, 1.4); L.position.y = 160; g.add(L); }
  g.userData.tick = dt => { steam.userData.tick(dt); skin.material.opacity = 0.28 + 0.1*Math.sin(performance.now()*0.0013); };
  return g;
}
function buildHulk(){
  const g = new THREE.Group(), hull = 0x4a3a2a;
  const h = new THREE.Group(); h.add(mesh(BOX(10, 8, 46), hull, 0, 3, 0)); h.add(mesh(CONE(5.5, 14, 4), hull, 0, 3, 29, {rx:Math.PI/2, ry:Math.PI/4})); h.add(mesh(BOX(10.4, 0.6, 46), 0x8a6a44, 0, 7.2, 0));
  h.add(mesh(CYL(0.45, 0.55, 22, 6), 0x5a4632, 0, 18, 6)); h.add(mesh(BOX(9, 0.4, 0.4), 0x5a4632, 0, 24, 6)); h.add(mesh(BOX(5, 4, 8), 0x6b5a4a, 0, 9, -14));
  h.rotation.set(0.06, 0.3, 0.22); g.add(h);
  return g;
}
function buildWindsock(){ const g = new THREE.Group(); g.add(mesh(CYL(0.12, 0.15, 9, 5), 0x9aa0a4, 0, 4.5, 0)); for (let i = 0; i < 4; i++) g.add(mesh(CYL(0.6 - i*0.1, 0.7 - i*0.1, 1.1, 8), i % 2 ? 0xe9e2cf : 0xe0742a, 0.55 + i*1.05, 8.6, 0, {rz:Math.PI/2})); return g; }
function buildSearchlight(len = 1100, rad = 42, op = 0.09){
  const g = new THREE.Group(); g.add(mesh(BOX(4, 14, 4), 0x5a5a60, 0, 7, 0)); g.add(mesh(BOX(5, 0.6, 5), 0x3a3a40, 0, 14.3, 0));
  const head = new THREE.Group(); head.position.set(0, 16, 0); head.rotation.order = 'YXZ'; g.add(head);
  head.add(mesh(CYL(1.2, 1.2, 1.8, 10), 0x2a2a30, 0, 0, 0, {rx:Math.PI/2})); head.add(mesh(new THREE.CircleGeometry(1.1, 10), 0xfff6d8, 0, 0, 0.95, {basic:true}));
  const geo = new THREE.ConeGeometry(rad, len, 14, 1, true).rotateX(-Math.PI/2).translate(0, 0, len/2);
  head.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:0xfff0c8, transparent:true, opacity:op, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, fog:false})));
  g.userData.head = head; return g;
}
G.buildSearchlight = buildSearchlight;
/* Sea caves. Each tunnel follows a centreline: straight, a single bend, or an S. Every slice along it is a lumpy rock arch
   round a smooth Roman-arch bore; the shell bulges in the middle and tapers at the mouths. Straight caves get a sea stack
   just past the exit, so you have to break hard as you come out. */
const caveShape = {
  env:(C, s) => 0.78 + 0.22*Math.cos(Math.PI*(s - C.len/2)/C.len),
  spring:C => C.bh - C.bw/2,
  boreTop:(C, x) => caveShape.spring(C) + Math.sqrt(Math.max(0, (C.bw/2)**2 - x*x)),
  outerTop:(C, x, s) => { const e = caveShape.env(C, s), W = C.w/2*e, H = C.h*e; return Math.abs(x) >= W ? -1e9 : H*Math.pow(1 - (x/W)**2, 0.42); }
};
function cavePath(C){
  const N = 48, L = C.len, A = C.bend || 0, out = [];
  const phi = s => C.path === 's' ? A*Math.sin(2*Math.PI*s/L) : C.path === 'bend' ? A*(s/L - 0.5) : 0;
  let x = 0, z = 0;
  for (let i = 0; i <= N; i++) { const s = L*i/N; if (i) { const ds = L/N, f = phi(s - ds/2); x += Math.sin(f)*ds; z += Math.cos(f)*ds; } out.push({s, x, z, f:phi(s)}); }
  const m = out[N/2], mx = m.x, mz = m.z;
  for (const p of out) { p.x -= mx; p.z -= mz; p.dx = Math.sin(p.f); p.dz = Math.cos(p.f); p.lx = Math.cos(p.f); p.lz = -Math.sin(p.f); }
  return out;
}
/* where a local point sits relative to the tunnel: distance along it (s) and across it (x); null past the mouths */
function caveLocate(C, px, pz){
  let best = 0, bd = 1e18; for (let i = 0; i < C.P.length; i++) { const p = C.P[i], d = (px - p.x)**2 + (pz - p.z)**2; if (d < bd) { bd = d; best = i; } }
  const p = C.P[best], ox = px - p.x, oz = pz - p.z, s = p.s + ox*p.dx + oz*p.dz;
  return s < -1 || s > C.len + 1 ? null : {s, x:ox*p.lx + oz*p.lz};
}
function buildCave(C){
  const g = new THREE.Group(), deep = 40, NZ = 24, NA = 22, R = G.rng(Math.round(C.len*7 + C.w)), pos = [], col = [], P = C.P;
  const hash = (i, j) => { const v = Math.sin(i*127.1 + j*311.7 + C.len)*43758.5453; return v - Math.floor(v); };
  const slice = k => {
    const p = P[k*2], e = caveShape.env(C, p.s), W = C.w/2*e, H = C.h*e, sp = caveShape.spring(C), out = [], inn = [], end = k === 0 || k === NZ;
    const at = (x, y, jit) => [p.x + p.lx*x + p.dx*jit, y, p.z + p.lz*x + p.dz*jit];
    out.push(at(W*1.08, -deep, 0)); inn.push(at(C.bw/2, -deep, 0));
    for (let i = 0; i <= NA; i++) {
      const th = i/NA*Math.PI, n = end ? 0.04*(hash(i, k) - 0.5) : 0.16*(hash(i, k) - 0.5) + 0.07*Math.sin(i*1.7 + k*2.3);
      out.push(at(Math.cos(th)*W*(1 + n), Math.pow(Math.sin(th), 0.7)*H*(1 + n*0.8) + (1 - Math.sin(th))*2, end ? 0 : (hash(k, i) - 0.5)*C.len/NZ*0.35));
      inn.push(at(Math.cos(th)*C.bw/2, sp + Math.sin(th)*C.bw/2, 0));
    }
    out.push(at(-W*1.08, -deep, 0)); inn.push(at(-C.bw/2, -deep, 0));
    return {out, inn};
  };
  const tone = (p, inner) => { if (inner) return [0.16, 0.15, 0.14]; const y = p[1], wet = y < 3 ? 0.62 : 1, top = Math.min(1, Math.max(0, y/(C.h*0.9))); const v = (0.36 + 0.16*top + 0.05*hash(p[0], p[2]))*wet; return [v*1.08, v*0.98, v*0.86]; };
  const tri = (a, b, c, inner) => { for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); col.push(...tone(p, inner)); } };
  const quad = (a, b, c, d, inner) => { tri(a, b, c, inner); tri(a, c, d, inner); };
  const S = []; for (let k = 0; k <= NZ; k++) S.push(slice(k));
  for (let k = 0; k < NZ; k++) { const A = S[k], B = S[k + 1];
    for (let i = 0; i < A.out.length - 1; i++) quad(A.out[i], A.out[i + 1], B.out[i + 1], B.out[i], false);
    for (let i = 0; i < A.inn.length - 1; i++) quad(A.inn[i + 1], A.inn[i], B.inn[i], B.inn[i + 1], true); }
  for (const k of [0, NZ]) { const A = S[k]; for (let i = 0; i < A.out.length - 1; i++) quad(A.out[i + 1], A.out[i], A.inn[i], A.inn[i + 1], false); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({vertexColors:true, flatShading:true, roughness:0.95, side:THREE.DoubleSide})); m.castShadow = true; m.receiveShadow = true; g.add(m);
  // boulders along the foot, the ledge halfway through, palms and scrub on the crown
  for (let i = 0; i < 9; i++) { const p = P[Math.floor(R()*P.length)], sx = R() < 0.5 ? -1 : 1, sz = 5 + R()*9, off = C.w/2*caveShape.env(C, p.s) + sz*0.2; g.add(mesh(new THREE.DodecahedronGeometry(sz, 0), R() < 0.5 ? 0x5a5248 : 0x4a443c, p.x + p.lx*sx*off, sz*0.25 - 2, p.z + p.lz*sx*off, {rx:R()*3, ry:R()*3})); }
  { const p = P[24]; g.add(mesh(new THREE.DodecahedronGeometry(5, 0), 0x4a443c, p.x + p.lx*(C.bw/2 - 3.5), 4.5, p.z + p.lz*(C.bw/2 - 3.5), {rx:0.4})); }
  for (let i = 0; i < 7; i++) { const p = P[4 + Math.floor(R()*(P.length - 8))], x = (R() - 0.5)*C.w*0.35, y = caveShape.outerTop(C, x, p.s); if (y < 0) continue; const wx = p.x + p.lx*x, wz = p.z + p.lz*x;
    if (i % 2) g.add(mesh(new THREE.IcosahedronGeometry(3 + R()*3, 0), 0x3f6a32, wx, y + 1.5, wz));
    else { g.add(mesh(CYL(0.4, 0.6, 9, 5), 0x6b5a3a, wx, y + 4.5, wz, {rz:(R() - 0.5)*0.4})); for (let f = 0; f < 5; f++) g.add(mesh(BOX(0.4, 0.15, 5), 0x3f8a3a, wx + Math.cos(f*1.26)*2, y + 9, wz + Math.sin(f*1.26)*2, {ry:-f*1.26 + Math.PI/2, rx:0.35})); } }
  // a sea stack right outside the exit of a straight cave
  if (C.stack) { const e = P[P.length - 1], st = C.stack; st.x = e.x + e.dx*st.off + e.lx*st.side; st.z = e.z + e.dz*st.off + e.lz*st.side; st.h = st.r*3.4;
    [[1, 0.55, 1.25], [0.82, 1.7, 1.2], [0.6, 2.75, 1.1]].forEach(([k, y, sy], i) => { const b = mesh(new THREE.DodecahedronGeometry(st.r*k, 1), i ? 0x6d6459 : 0x4a443c, st.x, st.r*y, st.z, {ry:i*0.7}); b.scale.y = sy; g.add(b); });
    g.add(mesh(new THREE.IcosahedronGeometry(st.r*0.35, 0), 0x3f6a32, st.x, st.h + 2, st.z)); }
  return g;
}
function ringMesh(R, kind){
  const g = new THREE.Group(), col = kind === 'boost' ? 0x5fe08a : kind === 'start' ? 0xf2c14e : 0xe0583a;
  g.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.7, 6, 30), new THREE.MeshStandardMaterial({color:col, emissive:col, emissiveIntensity:0.6, roughness:0.5})));
  if (kind === 'boost') g.add(G.buildBoostRing(R - 1.8));
  return g;
}

/* =====================================================================
   The open-skies "mission": one long free flight in the current region
   ===================================================================== */
const OPEN = G.MISSIONS.open = Object.assign(Object.create(base), {
  id:'open', open:true, title:'Open skies', place:'', wing:0, brief:'', sides:[], pay:{success:0, perfect:0, kill:150},
  worldOpts(){ const R = REG[G.save.open.region] || REG.halcyon; return {seed:R.seed, region:R.terrain, time:G.timeOfDay(), flats:G.regionFlats(R), cuts:G.regionCuts(R)}; },
  setup(g){
    const S = G.save.open, R = this.R = REG[S.region] || REG.halcyon, L = this.L = layout(R);
    this.g = g; this.phase = 0; this.pt = 0; this.ended = false; this.job = null; this.earned = 0; this.jobsDone = 0; this.foundNow = 0; this.kills0 = 0;
    this.time = G.timeOfDay(); this.night = this.time === 'night'; this.lowFlying = false; this.holdOnGround = false; this.title = R.name;
    this.sc = {chain:0, mult:1, last:-99, label:'', session:0, cont:0, shown:''}; this.encT = 150 + Math.random()*90; this.bandits = [];
    this.wing = S.wing ? 3 : 0; g.markers = []; this.rtick = null; this.towers = []; this.arches = []; this.anim = []; this.caves = []; this.tunnels = []; this.cavern = null;
    // landmarks first (sites may sit among them)
    this.P = {}; this.markObj = {};
    for (const md of R.marks) { const p = L.marks[md.id]; this.P[md.id] = new V3(p.x, Math.max(g.world.height(p.x, p.z), 0.4), p.z); this.buildMark(g, md, this.P[md.id]); }
    this.tunnels = []; if (R.cavern) this.buildCavern(g, planCavern(R));
    for (const T of L.tunnels) { this.tunnels.push(this.buildTunnel(g, T)); this.P[T.td.id] = new V3(T.mid.x, T.floor, T.mid.z); }
    this.sites = R.sites.map(sd => this.buildSite(g, sd, L.sites[sd.id]));
    for (const s of this.sites) this.P[s.id] = s.point;
    if (R.city) this.buildCity(g);
    if (G.REGION_BUILD && G.REGION_BUILD[R.id]) G.REGION_BUILD[R.id](this, g);
    this.treasures = R.treasures.map(t => this.buildTreasure(g, t)).filter(Boolean);
    // neutral traffic: mail and charter planes between the stops, cargo zeppelins crossing the region
    const T = g.traffic || (g.traffic = new G.Traffic(g)), stops = this.sites.filter(s => s.kind !== 'field' && !s.def.cavern).map(s => s.point);
    const pairs = []; for (let i = 0; i < stops.length; i++) for (let j = i + 1; j < stops.length; j++) pairs.push([stops[i], stops[j]]);
    T.routes(pairs.slice(0, 7), {night:this.night}); T.cruisers(this.night ? 2 : 3, this.R.id);
    if (G.shipping) G.shipping(this, g, R.id);   // tramp steamers, tugs, packets and worse on the region's water
    const M = R.margaret, line = this.night ? `Hook's live, ${G.save.callsign || 'Ace'}. Clear night over ${R.name}. Watch for lights on the ground.` : `Hook's live, ${G.save.callsign || 'Ace'}. ${R.name}, ${G.timeLabel().split(' · ')[1].toLowerCase()}. Go find us some work.`;
    this.launch(g, line, {pos:new V3(M.x, M.y, M.z), heading:0, turn:0.012, banner:R.name});
    setTimeout(() => { if (G.game === g && !this.ended) G.HUD.radio(G.RADIO.short, `Land at a field or hook a skyhook to meet people. ${this.sites.filter(s => s.contact).map(s => G.CONTACTS[s.contact].name.replace(/".*" /, '')).join(' and ')} are expecting you.`); }, 4500);
  },
  drop(){
    base.drop.call(this); const g = this.g, P = g.player;
    if (this.night && G.hasMod('lights')) { const sp = new THREE.SpotLight(0xfff2d0, 2.4, 1100, 0.38, 0.5, 1.2), tg = new THREE.Object3D(); sp.position.set(0, -0.4, 2.5); tg.position.set(0, -6, 60); P.obj.add(sp); P.obj.add(tg); sp.target = tg; }
  },

  /* ---------- building the region ---------- */
  ground(x, z, bare){ return Math.max(this.g.world.height(x, z, bare), 0.4); },
  buildMark(g, md, p){
    if (G.MARK_KINDS && G.MARK_KINDS[md.kind]) return G.MARK_KINDS[md.kind].call(this, g, md, p);   // landmark kinds that live in a region's own file
    const w = g.world; let o = null;
    if (md.kind === 'lighthouse') { o = G.buildLighthouse(); w.addBlocker({x:p.x, z:p.z, hw:5, hd:5, top:p.y + 47}); this.anim.push(dt => { o.userData.beam.rotation.y += dt*0.9; }); }
    if (md.kind === 'windmill') { o = G.buildWindmill(); o.rotation.y = Math.atan2(-p.x, -p.z); w.addBlocker({x:p.x, z:p.z, hw:7, hd:7, top:p.y + 25}); this.anim.push(dt => { o.userData.sails.rotation.z += dt*0.7; }); }
    if (md.kind === 'observatory') { o = buildObservatory(); w.addBlocker({x:p.x, z:p.z, hw:10, hd:10, top:p.y + 20}); }
    if (md.kind === 'mine') { o = buildMine(); w.addBlocker({x:p.x, z:p.z, hw:4, hd:4, top:p.y + 19}); }
    if (md.kind === 'hideout') o = buildHideout();
    if (md.kind === 'hulk') o = buildHulk();
    if (md.kind === 'keep') { o = buildKeep(); w.addBlocker({x:p.x, z:p.z, hw:30, hd:30, top:p.y + 28}); }
    if (md.kind === 'volcano') {
      o = buildPlume(md.plume || 1, this.night); this.anim.push(o.userData.tick);
      if (md.caldera) { const lake = buildLava(md.caldera, this.night, true); lake.position.set(0, 2.5, 0); o.add(lake); this.anim.push(lake.userData.tick); }
    }
    if (md.kind === 'lava') { p.y = 3.4; o = buildLava(md.r || 800, this.night); this.anim.push(o.userData.tick); }
    if (md.kind === 'cave') { p.y = 0.4; const C = Object.assign({}, md.cave), yaw = G.rng(md.id.length*97)()*Math.PI; C.P = cavePath(C); o = buildCave(C); o.rotation.y = yaw; const cv = {obj:o, C, id:md.id, name:md.name, t:-99, yaw, seen:null}; this.caves.push(cv); if (this.night) this.anim.push(() => { if (Math.random() < 0.6) { const e = Math.random() < 0.5 ? C.P[0] : C.P[C.P.length - 1], sd = Math.random() < 0.5 ? 1 : -1, l = new V3(e.x + e.lx*sd*(C.bw/2 - 1.5), C.bh*0.55, e.z + e.lz*sd*(C.bw/2 - 1.5)).applyAxisAngle(UP, yaw).add(p); this.g.fx.fire.emit(l.x, l.y, l.z, 0, 0.6, 0, 2.2, 0.35, 1, 0.75, 0.35, 0.9, 0, 1, 0); } }); }
    if (md.kind === 'viaduct') {
      const S = this.L.marks[md.id]; if (S && S.len) return this.buildSpan(g, md, p, S);
      const len = 300, n = 5, hs = []; for (let i = 0; i <= n; i++) hs.push(Math.max(w.height(p.x - len/2 + i*len/n, p.z), 2));
      const deck = Math.max(...hs) + 46; o = G.buildViaduct(len, deck, hs); o.position.set(p.x, 0, p.z); g.scene.add(o);
      for (let i = 0; i <= n; i++) w.addBlocker({x:p.x - len/2 + i*len/n, z:p.z, hw:3, hd:4.5, top:deck + 3});
      this.arches.push({pos:new V3(p.x, 0, p.z), len, deck, prev:undefined, name:md.name, t:-99});
      p.y = this.ground(p.x, p.z, true);
      return;
    }
    if (o) { o.position.copy(p); g.scene.add(o); this.markObj[md.id] = o; }
  },
  /* A viaduct laid out by placeSpan: bank to bank across a river, at the angle the layout found. The deck is level with the
     higher bank, masonry approaches carry it on to the land at both ends, and in open skies a track runs over it and down
     on to the ground either side (a story that runs a railway over it lays its own). */
  buildSpan(g, md, p, S){
    const w = g.world, len = S.len, yaw = S.yaw, ux = Math.cos(yaw), uz = -Math.sin(yaw), n = 2*Math.round((len/48 - 1)/2) + 1, span = len/n, r = span/2 - 3, st = 8;
    const at = t => [p.x + ux*t, p.z + uz*t], gh = t => w.height(p.x + ux*t, p.z + uz*t, true);
    let rail = -1e9; for (const sg of [-1, 1]) rail = Math.max(rail, Math.min(gh(sg*(len/2 + 30)), gh(sg*(len/2 + 50)), gh(sg*(len/2 + 70))));
    rail += 0.3; const deck = rail - 3, hs = [], abut = [[], []];
    for (let i = 0; i <= n; i++) hs.push(Math.max(gh(-len/2 + i*span), 2));
    // the approaches run out until the bank comes up to the rails
    for (const e of [0, 1]) { const sg = e ? 1 : -1; for (let j = 0; j < 12; j++) { const t0 = len/2 + 3 + j*st; abut[e].push(Math.max(0.4, Math.min(gh(sg*t0), gh(sg*(t0 + st/2)), gh(sg*(t0 + st))))); if (gh(sg*(t0 + st)) > rail - 0.6 || (j > 1 && gh(sg*(t0 + st)) > rail - 4.5 && gh(sg*(t0 + st)) - gh(sg*t0) < 0.4)) break; } }   // or, on a lower bank, until it levels off: the track comes down the rest of the way
    const e0 = -(len/2 + 3 + abut[0].length*st), e1 = len/2 + 3 + abut[1].length*st;
    const o = G.buildViaduct(len, deck, hs, {abut, step:st, plain:true}); o.position.set(p.x, 0, p.z); o.rotation.y = yaw; g.scene.add(o); this.markObj[md.id] = o;
    // solid: the piers and the approaches stand as blockers, the deck and the stone over each arch are tested against the player
    for (let i = 0; i <= n; i++) for (const c of [-3, 0, 3]) { const [x, z] = at(-len/2 + i*span); w.addBlocker({x:x - uz*c, z:z + ux*c, hw:3.2, hd:3.2, top:rail}); }
    for (const e of [0, 1]) abut[e].forEach((gy, j) => { const [x, z] = at((e ? 1 : -1)*(len/2 + 3 + (j + 0.5)*st)); if (rail - gy > 1.5) w.addBlocker({x, z, hw:4.6, hd:4.6, top:rail}); });
    this.anim.push(() => {
      const P = g.player; if (!P || !P.alive || P.frozen || g.done) return;
      const dx = P.pos.x - p.x, dz = P.pos.z - p.z, lx = dx*ux + dz*uz, lz = dz*ux - dx*uz, y = P.pos.y;
      if (Math.abs(lz) > 5.3 || lx < e0 || lx > e1 || y > rail + 1.6) return;
      let hit = y > deck - 4.4;
      if (!hit && Math.abs(lx) < len/2) { const u = (lx + len/2) % span - span/2; hit = Math.abs(u) < r && y > deck - 4 - r + Math.sqrt(r*r - u*u) - 0.8; }
      if (hit) P.destroy(null, 'crash');
    });
    p.y = this.ground(p.x, p.z, true);
    this.arches.push({id:md.id, pos:new V3(p.x, 0, p.z), len, deck:deck - 2, yaw, rail, ext:[e0, e1], under:(p.y + deck - 4)/2, prev:undefined, name:md.name, t:-99});
    if (this.story) return;
    // the line: over the deck, then easing down on to the ground either side and a little way on to a buffer stop
    const pts = [], run = sg => { const out = []; let lvl = 0; for (let d = 9; d < 300 && lvl < 5; d += 9) { const t = (sg < 0 ? e0 : e1) + sg*d, gy = gh(t), y = Math.max(gy + 0.4, rail + 0.4 - d*0.025), [x, z] = at(t); out.push({x, z, y, gy}); lvl = y < gy + 0.5 ? lvl + 1 : 0; } return out; };
    pts.push(...run(-1).reverse()); for (let t = e0; t < e1; t += 9) { const [x, z] = at(t); pts.push({x, z, y:rail + 0.4, gy:rail}); } { const [x, z] = at(e1); pts.push({x, z, y:rail + 0.4, gy:rail}); } pts.push(...run(1));
    g.scene.add(G.buildTrack(pts));
    for (const q of [pts[0], pts[pts.length - 1]]) { const b = new THREE.Group(); b.add(mesh(BOX(0.5, 1.5, 3.2), 0x8e231c, 0, 1.1, 0)); for (const c of [-1.1, 1.1]) b.add(mesh(BOX(1.6, 0.3, 0.3), 0x4a3424, 0.7, 0.7, c, {rz:0.6})); b.position.set(q.x, q.y, q.z); b.rotation.y = yaw; g.scene.add(b); }
  },
  buildSite(g, sd, at){
    const w = g.world, site = {def:sd, id:sd.id, kind:sd.kind, name:sd.name, contact:sd.contact, armed:true, cool:0};
    if (sd.kind === 'strip') {
      const sh = this.ground(at.x, at.z, true), strip = G.buildAirstrip(560, 26, sd.strip || {}), yaw = sd.yaw ?? at.yaw ?? 0;
      strip.position.set(at.x, sh, at.z); strip.rotation.y = yaw; g.scene.add(strip);
      const ud = strip.userData, rot = v => v.clone().applyAxisAngle(UP, yaw).add(new V3(at.x, sh, at.z));
      g.runways.push({pos:new V3(at.x, sh, at.z), yaw, hw:ud.wid/2 + 10, hl:ud.len/2 + 22});
      site.apron = rot(ud.apron); g.runways.push({pos:site.apron, yaw, hw:26, hl:34});
      const cafe = rot(new V3(ud.apron.x + 44, 0, ud.apron.z + 10)); w.addBlocker({x:cafe.x, z:cafe.z, hw:12, hd:12, top:sh + 13});
      site.point = new V3(at.x, sh, at.z); site.yaw = yaw; site.markAt = site.apron.clone().setY(sh + 24);
      if (sd.town) { const o = sd.townOff || [235, -30]; this.buildTown(g, rot(new V3(o[0], 0, o[1])), sd.townR || 140, sd); }
      if (sd.cityOf && this.cavern) this.buildHiddenCity(g, sd);
      if (this.night) this.anim.push(() => { if (Math.random() < 0.3) g.fx.fire.emit(site.apron.x + (Math.random() - 0.5)*40, sh + 1, site.apron.z + (Math.random() - 0.5)*50, 0, 0.5, 0, 2.2, 0.3, 1, 0.8, 0.45, 0.8, 0, 1, 0); });
    }
    if (sd.kind === 'field') {
      const sh = this.ground(at.x, at.z, true); site.point = new V3(at.x, sh, at.z); site.markAt = site.point.clone().setY(sh + 24);
      g.runways.push({pos:site.point.clone(), yaw:0, hw:70, hl:110});
      const sock = buildWindsock(); sock.position.set(at.x + 64, sh, at.z); g.scene.add(sock);
      // flare pots mark the corners; they burn red at night
      const pots = [[-60, -100], [60, -100], [-60, 100], [60, 100]].map(([dx, dz]) => new V3(at.x + dx, sh + 0.6, at.z + dz));
      this.anim.push(() => { for (const q of pots) if (Math.random() < (this.night ? 0.6 : 0.15)) g.fx.fire.emit(q.x, q.y, q.z, 0, 2, 0, 2.6, 0.4, 1, 0.3, 0.2, 0.9, 0, 1, 2); });
    }
    if (sd.kind === 'hook') {
      const T = sd.tower || {}, th = sd.city ? Math.max(w.height(CITY.x, CITY.z, true), 14) : this.ground(at.x, at.z, true);
      // the gallery faces the region's centre, so the approach is over open country
      const ty = sd.city ? Math.atan2(STRIP.x - CITY.x, STRIP.z - CITY.z) : Math.atan2(-at.x, -at.z);
      const tower = G.buildSkyhookTower(T.h || 120, T.w || 38, this.R.id === 'calavera' ? Object.assign({pirate:true}, T) : T); tower.position.set(at.x, th - 0.5, at.z); tower.rotation.y = ty; g.scene.add(tower);
      site.tower = tower; site.hook = tower.userData.hook.clone().applyAxisAngle(UP, ty).add(tower.position); site.n = new V3(Math.sin(ty), 0, Math.cos(ty)); site.ringR = tower.userData.ringR;
      site.point = new V3(at.x, th, at.z); site.markAt = site.hook.clone(); site.ty = ty; this.towers.push(site);
      if (sd.town) this.buildTown(g, new V3(at.x, th, at.z), 165, sd, site);
    }
    return site;
  },
  /* promotional searchlights: tall beams swinging over a city at night. Only skyscraper cities (Port Halcyon) get them. */
  skyBeams(g, c, n, r){
    if (!this.night) return;
    for (let i = 0; i < n; i++) {
      const a = i/n*Math.PI*2 + 0.5, x = c.x + Math.sin(a)*r, z = c.z + Math.cos(a)*r, y = this.ground(x, z), m = buildSearchlight(2600, 75, 0.055);
      m.position.set(x, y, z); g.scene.add(m); const head = m.userData.head, ph = i*1.7, base = a;
      this.anim.push(() => { const t = g.t; head.rotation.y = base + Math.sin(t*0.22 + ph)*0.9; head.rotation.x = -(1.05 + 0.25*Math.sin(t*0.31 + ph)); });
    }
  },
  /* a small town on a street grid: buildings on the blocks, cars on the streets, a couple of local planes overhead.
     Round a skyhook hotel the blocks next to the hotel and along its gallery lanes stay open. */
  buildTown(g, c, r, sd, hook){
    const w = g.world, h = this.ground(c.x, c.z, true), B = 58, T = g.traffic || (g.traffic = new G.Traffic(g)), rr = G.rng(sd.id.length*131 + 7);
    const cols = this.R.id === 'badlands' ? [0xc9a27a, 0xb5885a, 0xd9b48a, 0x9a7a5a] : this.R.id === 'keys' ? [0xf1e6d0, 0xe8c8a0, 0xd9e8e0, 0xf2d8b0] : this.R.id === 'frostback' ? [0xe8e0d0, 0x8a5a3a, 0xd8d0c0, 0x6b4a2b] : this.R.id === 'calavera' ? [0x5a4a42, 0x8a6a52, 0x3a3432, 0xa08870, 0x6a2a24] : [0xd8c6a4, 0xc9b38f, 0xe2d4b6, 0xb9a891];
    if (this.R.id === 'calavera') return this.pirateTown(g, c, r, sd, hook, h, rr);
    T.streets({x:c.x, z:c.z, r}, h, B, 10);
    const ax = hook ? Math.sin(hook.ty) : 0, az = hook ? Math.cos(hook.ty) : 0, bulbs = [];
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
      const x = c.x + (i + 0.5)*B, z = c.z + (j + 0.5)*B, d = Math.hypot(x - c.x, z - c.z); if (d > r - 32 || rr() < 0.12) continue;
      if (hook) { const dx = x - c.x, dz = z - c.z; if (d < 48 || Math.abs(dx*az - dz*ax) < 46) continue; }
      const hh = d < r*0.45 ? 12 + rr()*22 : 6 + rr()*11, ww = 22 + rr()*14, gy = this.ground(x, z, true);
      const b = G.buildTower(hh, ww, G.pick(cols, rr), rr); b.position.set(x, gy - 0.5, z); g.scene.add(b); w.addBlocker({x, z, hw:ww/2, hd:ww/2, top:gy + hh});
      if (this.night || sd.cavern) { const top = gy - 0.5 + (b.userData.top || hh) + 0.4, e = ww/2 + 0.3; for (let k = -3; k <= 3; k++) for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) bulbs.push([x + (fx ? fx*e : k*ww/7), top, z + (fz ? fz*e : k*ww/7)]); }   // marquee bulbs round the roof
    }
    // bright lights, not searchlights: rooftop marquees and a string of lamps along the main street
    if (this.night || sd.cavern) {
      for (let d = -r + 25; d < r - 25; d += 9) bulbs.push([c.x + d, h + 7 + Math.sin(d*0.35)*0.6, c.z + 5.5], [c.x + d, h + 7 + Math.cos(d*0.35)*0.6, c.z - 5.5]);
      const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.75, 6, 4), new THREE.MeshBasicMaterial({color:0xffe2a0}), bulbs.length), mx = new THREE.Matrix4();
      bulbs.forEach(([x, y, z], i) => im.setMatrixAt(i, mx.makeTranslation(x, y, z))); im.frustumCulled = false; g.scene.add(im);
    }
    T.carsOn(this.night || sd.cavern ? 6 : 12);
    if (!sd.cavern) T.air({x:c.x, z:c.z}, {circlers:2, blimp:false, R:380});
  },
  /* Cíbola proper: the city in the cavern, all along one side of the field (G.buildCibolaCity lays it out in the cavern's own frame).
     Every house, terrace and stage of the tower is solid; a few cars cruise the paseo. */
  buildHiddenCity(g, sd){
    const C = this.cavern, w = g.world, ax = C.ax[0], az = C.ax[1], th = Math.atan2(-az, ax);
    const city = G.buildCibolaCity({rx:C.rx, rz:C.rz, ceil:(lx, lz) => C.ceil(0, lx, lz) - C.floor, pillars:C.pillars || [], night:this.night});
    city.position.set(C.x, C.floor, C.z); city.rotation.y = th; g.scene.add(city);
    const toW = (lx, lz) => [C.x + ax*lx - az*lz, C.z + az*lx + ax*lz];
    for (const b of city.userData.solids) { const [x, z] = toW(b.x, b.z), c = Math.abs(Math.cos(b.yaw + th)), s = Math.abs(Math.sin(b.yaw + th)); w.addBlocker({x, z, hw:(b.w*c + b.d*s)/2, hd:(b.w*s + b.d*c)/2, top:C.floor + b.top}); }
    C.city = city.userData; C.tris = (C.tris || 0) + city.userData.tris;
    const ps = city.userData.paseo;
    if (ps && Math.abs(az) < 1e-6) { const T = g.traffic || (g.traffic = new G.Traffic(g)), [x, z] = toW((ps.a + ps.b)/2, ps.z);   // the paseo runs along a world axis: Traffic can drive it
      T.grid = {C:{x, z, r:(ps.b - ps.a)/2}, h:C.floor + 0.1, B:1e6, W:8, lanes:[{axis:'x', c:0, half:(ps.b - ps.a)/2 - 4}]}; T.grids.push(T.grid); T.carsOn(5); }
  },
  /* the Brethren's towns: no street grid, just crooked stilt-houses crowded along boardwalks round a beached galleon */
  pirateTown(g, c, r, sd, hook, h, rr){
    const w = g.world, k = G.pirateKit(), ax = hook ? Math.sin(hook.ty) : 0, az = hook ? Math.cos(hook.ty) : 0, bulbs = [];
    // the tavern sits in the middle of a strip town; at a skyhook it sits off to one side of the approach
    let tc = c.clone(); if (hook) tc.add(new V3(az, 0, -ax).multiplyScalar(r*0.55));
    const ty = rr()*Math.PI*2, tg = this.ground(tc.x, tc.z, true), tv = G.pirateTavern(k, tc.x, tg - 0.6, tc.z, ty, rr, this.night);
    w.addBlocker({x:tc.x, z:tc.z, hw:Math.max(tv.hw, tv.hd)*0.8, hd:Math.max(tv.hw, tv.hd)*0.8, top:tg + 18});
    const placed = [{x:tc.x, z:tc.z, r:30}];
    // houses scattered in rough rings, never on a grid, each turned its own way
    const n = Math.round(r*r/420);
    for (let i = 0, tries = 0; i < n && tries < n*6; tries++) {
      const a = rr()*Math.PI*2, d = 30 + Math.sqrt(rr())*(r - 30), x = c.x + Math.sin(a)*d, z = c.z + Math.cos(a)*d;
      if (hook) { const dx = x - c.x, dz = z - c.z; if (Math.hypot(dx, dz) < 48 || (Math.abs(dx*az - dz*ax) < 46 && dx*ax + dz*az > -20)) continue; }
      const ww = 8 + rr()*8; if (placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r + ww*0.62)) continue;
      const gy = this.ground(x, z, true); if (gy < 0.6) continue;
      const hh = d < r*0.4 ? 10 + rr()*20 : 5 + rr()*9, yaw = Math.atan2(c.x - x, c.z - z) + (rr() - 0.5)*1.2;
      const top = G.pirateHouse(k, x, gy, z, ww, hh, rr, yaw, this.night || sd.cavern);
      w.addBlocker({x, z, hw:ww*0.6, hd:ww*0.6, top:gy + top}); placed.push({x, z, r:ww*0.62}); i++;
      if (this.night && rr() < 0.5) bulbs.push([x, gy + 4.5, z]);
    }
    // boardwalks from the tavern out between the houses
    const plank = G.mat(0x4a3a2c, {roughness:0.95});
    for (let i = 0; i < 5; i++) {
      const a = i/5*Math.PI*2 + rr(), len = r*0.8, mx = tc.x + Math.sin(a)*len/2, mz = tc.z + Math.cos(a)*len/2;
      for (let s2 = -len/2; s2 < len/2; s2 += 8) { const px = mx + Math.sin(a)*s2, pz = mz + Math.cos(a)*s2, gy = this.ground(px, pz, true); if (gy < 0.4) continue; const m = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 8.2), plank); m.position.set(px, gy + 0.3, pz); m.rotation.y = a; m.rotation.z = (rr() - 0.5)*0.05; g.scene.add(m); }
    }
    g.scene.add(G.buildKit(k));
    if (this.night || sd.cavern) for (let d = -r*0.5; d < r*0.5; d += 11) bulbs.push([tc.x + Math.sin(ty + 1.57)*d, tg + 9, tc.z + Math.cos(ty + 1.57)*d]);
    if (bulbs.length) { const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.75, 6, 4), new THREE.MeshBasicMaterial({color:0xffb060}), bulbs.length), mx = new THREE.Matrix4(); bulbs.forEach(([x, y, z], i) => im.setMatrixAt(i, mx.makeTranslation(x, y, z))); im.frustumCulled = false; g.scene.add(im); }
    if (!sd.cavern) { const T = g.traffic || (g.traffic = new G.Traffic(g)); T.air({x:c.x, z:c.z}, {circlers:2, blimp:false, R:380}); }
  },
  buildCity(g){
    const s = this.sites.find(x => x.def.city), tx = s.point.x, tz = s.point.z, ax = Math.sin(s.ty), az = Math.cos(s.ty);
    this.skyBeams(g, {x:CITY.x, z:CITY.z}, 4, 220);
    K.cityscape(g, (x, z) => { const dx = x - tx, dz = z - tz, lat = Math.abs(dx*az - dz*ax); return Math.hypot(dx, dz) < 70 || lat < 55; }, {air:{airways:[STRIP]}, cars:this.night ? 18 : 40});
  },
  buildTreasure(g, t){
    const S = G.save.open, rec = S.found[t.id];
    if (rec && !t.race) return null;
    const base0 = Array.isArray(t.at) ? new V3(t.at[0], 0, t.at[1]) : this.P[t.at] ? this.P[t.at].clone() : null; if (!base0) return null;
    if (t.off) { base0.x += t.off[0]; base0.z += t.off[1]; }
    if (t.race) { const d = Math.hypot(base0.x, base0.z); if (d > 200) { base0.x -= base0.x/d*150; base0.z -= base0.z/d*150; } }
    base0.y = t.ledge !== undefined ? t.ledge : this.ground(base0.x, base0.z, true);
    const T = {def:t, pos:base0, got:false};
    if (t.race) {
      // a race gate: two striped pylons with the start ring between them
      const gate = G.buildGate(46, 34); gate.position.copy(base0); g.scene.add(gate); T.obj = gate;
      const ring = ringMesh(14, 'start'); ring.position.copy(base0).add(new V3(0, 17, 0)); g.scene.add(ring); T.ring = ring;
      T.n = new V3(0, 0, 1); T.prev = undefined; T.start = base0.clone().add(new V3(0, 17, 0));
    } else { const c = buildCrate(); c.position.copy(base0); c.rotation.y = Math.random()*6; g.scene.add(c); T.obj = c; }
    return T;
  },

  /* ---------- the frame ---------- */
  update(g, dt){
    this.pt += dt; const P = g.player, S = G.save.open;
    if (this.spawnWingmenSoon > 0 && (this.spawnWingmenSoon -= dt) <= 0) { g.spawnWingmen(this.wing); G.HUD.radio('Hellcat', 'Sightseeing? Fine. Wake me if something needs shooting.'); }
    for (const a of this.anim) a(dt);
    if (this.R.city) K.towerCrash(g);
    this.towerHit(g); this.caveHit(g); this.tunnelHit(g); this.cavernHit(g);
    if (this.rtick) this.rtick(g, dt);
    if (this.phase !== 1 || this.ended || !P.alive) { this.hudSides(g); return; }
    g.markers = [];
    for (const s of this.sites) { s.cool = Math.max(0, s.cool - dt); if (!s.armed && P.pos.distanceTo(s.apron || s.point) > 120) s.armed = true; }
    // the job drives most of the markers and the objective line
    let obj = null;
    if (this.job) { const r = this.job.update(dt); obj = this.job.objective ? this.job.objective() : null; if (r) this.finishJob(r); }
    this.lowFlying = !!(this.job && this.job.low) || this.sc.cont > 0;
    this.scoring(g, dt);
    this.hooks(g, dt);
    this.arrivals(g);
    this.treasureCheck(g, dt);
    this.encounters(g, dt);
    // contacts on the map
    for (const s of this.sites) if (s.contact && !(this.job && this.job.hideSites)) {
      const d = P.pos.distanceTo(s.markAt), C = G.CONTACTS[s.contact];
      g.markers.push({pos:s.markAt, label:d < 2500 ? `${s.name.toUpperCase()} · ${C.name.replace(/".*" /, '').split(' ').slice(-1)[0].toUpperCase()}` : s.name.toUpperCase(), col:'#9ec7f0', edgeOnly:d > 6000, noDist:d > 6000});
    }
    if (g.sea) g.sea.marks(g);
    const far = Math.hypot(P.pos.x, P.pos.z);
    if (far > 7800 && !this.farWarn) { this.farWarn = true; G.HUD.radio(G.RADIO.short, 'You\'re at the edge of the chart, sugar. Turn back before you run out of map.'); }
    if (far < 7000) this.farWarn = false;
    if (!obj) obj = far > 7800 ? 'Edge of the chart. Turn back toward the Margaret.' : `Free flight · land at a field or hook a skyhook to meet contacts · stunts score points`;
    G.HUD.objective(obj);
    this.hudSides(g);
  },
  /* every tunnel and sea cave flown clean through, end to end, is ticked off in the save, region by region */
  passages(){ return this.tunnels.map(t => t.T.td.id).concat(this.caves.map(c => c.id)).filter(Boolean); },
  flown(id){ if (!id) return; const S = G.save.open, F = S.flown || (S.flown = {}), k = this.R.id + ':' + id; if (F[k]) return; F[k] = 1; G.persist(); const n = this.passages().filter(i => F[this.R.id + ':' + i]).length, all = this.passages().length; G.HUD.toast(`Tunnel flown: ${n} of ${all} in ${this.R.name}`); },
  hudSides(g){
    const S = G.save.open, R = this.R, found = R.treasures.filter(t => S.found[t.id]).length, ps = this.passages(), F = S.flown || {}, fl = ps.filter(i => F[R.id + ':' + i]).length;
    if (ps.length && (S.passTotal || (S.passTotal = {}))[R.id] !== ps.length) S.passTotal[R.id] = ps.length;
    const list = this.job && this.job.sides ? this.job.sides() : [];
    if (g.sea && g.sea.wanted >= 1) list.push({text:'Wanted for firing on shipping', st:'fail', val:'★'.repeat(Math.min(3, Math.ceil(g.sea.wanted/40)))});
    list.push({text:'Treasures found', st:found >= R.treasures.length ? 'ok' : 'live', val:`${found}/${R.treasures.length}`});
    if (ps.length) list.push({text:'Tunnels flown', st:fl >= ps.length ? 'ok' : 'live', val:`${fl}/${ps.length}`});
    list.push({text:this.night ? 'Stunt points tonight' : 'Stunt points today', st:'live', val:Math.round(this.sc.session + this.sc.chain).toLocaleString()});
    G.HUD.sides(list);
    const el = document.getElementById('hStunt');
    if (el) { const t = this.sc.chain > 0 ? `${this.sc.label}  +${Math.round(this.sc.chain).toLocaleString()}${this.sc.mult > 1 ? `  ×${this.sc.mult.toFixed(2).replace(/0$/, '')}` : ''}` : ''; if (t !== this.sc.shown) { this.sc.shown = t; el.textContent = t; el.hidden = !t; } }
  },
  /* the Aero Works-style towers are solid except for the gallery cut through them */
  towerHit(g){
    for (const site of this.towers) {
      const T = site.tower, U = T.userData, gl = U.gallery, half = U.w/2;
      for (const p of g.planes) {
        if (!p.alive || p.frozen) continue;
        const l = T.worldToLocal(tA.copy(p.pos));
        if (Math.abs(l.x) > half + 5 || Math.abs(l.z) > half + 5 || l.y > (U.mast ? U.mast.top + 2 : U.top + 30) || l.y < 0) continue;
        const inGallery = l.y > gl.y0 + 2 && l.y < gl.y1 - 1.6 && Math.abs(l.x) < gl.ow/2 - 5;
        const inside = Math.abs(l.x) < half + 4 && Math.abs(l.z) < half + 1 && l.y < U.top + 22;
        if (inside && !inGallery) { if (p.isPlayer && g.done) continue; p.destroy(null, 'crash'); }
        if (U.mast && l.y > U.mast.y0 && l.y < U.mast.top && Math.hypot(l.x, l.z) < U.mast.r + 1.5) { if (p.isPlayer && g.done) continue; p.destroy(null, 'crash'); }   // the mooring mast on top
      }
    }
  },

  /* sea caves: solid rock round a bore at wave-top height. The player crashes on the rock; AI pilots are lifted over it. */
  caveHit(g){
    for (const cv of this.caves) {
      const C = cv.obj, D = cv.C, L = D.len;
      for (const p of g.planes) {
        if (!p.alive || p.frozen) continue;
        const l = C.worldToLocal(tA.copy(p.pos)), at = caveLocate(D, l.x, l.z);
        let hit = false, inBore = false;
        if (at) { inBore = Math.abs(at.x) < D.bw/2 - 3.5 && l.y > 1.2 && l.y < caveShape.boreTop(D, Math.abs(at.x) + 3) - 1.5; hit = !inBore && l.y < caveShape.outerTop(D, at.x, at.s) + 1.5; }
        const st = D.stack; if (st && Math.hypot(l.x - st.x, l.z - st.z) < st.r*0.95 && l.y < st.h) hit = true;
        if (p.isPlayer) {
          // score a full pass: in at one mouth, out at the other
          if (inBore) { cv.seen = cv.seen || {lo:1e9, hi:-1e9}; cv.seen.lo = Math.min(cv.seen.lo, at.s); cv.seen.hi = Math.max(cv.seen.hi, at.s); }
          else if (cv.seen && !at) { if (cv.seen.lo < L*0.2 && cv.seen.hi > L*0.8 && g.t - cv.t > 4) { cv.t = g.t; this.flown(cv.id); this.award(D.bonus || (D.path ? 2000 : 1500), D.path ? 'THROUGH THE WINDING CAVE' : 'THROUGH THE CAVE'); if (g.audio) g.audio.ding(); } cv.seen = null; }
          if (hit && !g.done) p.destroy(null, 'crash');
        } else if (hit) p.pos.y = Math.max(p.pos.y, C.position.y + (at ? caveShape.outerTop(D, at.x, at.s) : st.h) + 4);
      }
      const P = g.player, d = P.pos.distanceTo(C.position);
      if (d < 1400 && d > 80 && !(this.job && this.job.hideSites)) { const e = D.P[0], m = new V3(e.x, D.bh*0.5, e.z).applyAxisAngle(UP, cv.yaw).add(C.position); g.markers.push({pos:m, label:`SEA CAVE · ${cv.name.toUpperCase()}${D.stack ? ' · mind the exit' : D.path ? ' · it turns' : ''}`, col:'#9ec7f0', noDist:d < 400}); }
    }
  },

  /* ---------- tunnels cut into the terrain ----------
     The ground over a tunnel is rebuilt from the uncut heights with the terrain's own colours and material, so the
     mountain or island looks untouched; underneath is the bore's lining, with a rock face at each mouth. */
  buildTunnel(g, T){
    if (T.td.canyon) return this.buildCanyonGate(g, T);
    const w = g.world, td = T.td, P = T.pts, NL = 34, W = cutHW(td) + 62, NA = 18, floor = T.floor, mat = w.terrain.material;
    const lidY = (p, x) => { const wx = p.x + p.lx*x, wz = p.z + p.lz*x, ax = Math.abs(x); let y = w.height0(wx, wz) + 0.4;
      const need = ax < td.bw/2 + 4 ? floor + boreTop(td, Math.min(ax, td.bw/2)) + 4 : floor + td.bh*0.6 + 4 - (ax - td.bw/2 - 4)*0.7; return Math.max(y, need); };
    // the rock over the bore: an indexed strip so it shades smoothly, like the terrain itself
    const pos = [], col = [], uv = [], idx = [], S = w.S;
    for (let i = T.i0; i <= T.i1; i++) { const p = P[i];
      for (let j = 0; j <= NL; j++) { const x = -W + 2*W*j/NL, y = lidY(p, x), wx = p.x + p.lx*x, wz = p.z + p.lz*x; pos.push(wx, y, wz); uv.push((wx + S/2)/S, 1 - (wz + S/2)/S);
        const raised = y > w.height0(wx, wz) + 1, sl = raised ? Math.max(0.5, Math.abs(lidY(p, Math.min(W, x + 6)) - lidY(p, Math.max(-W, x - 6)))/12) : w.slope0(wx, wz); col.push(...w.colorAt(wx, wz, raised ? y : w.height0(wx, wz), sl)); } }
    const NJ = NL + 1; for (let i = 0; i < T.i1 - T.i0; i++) for (let j = 0; j < NL; j++) { const a = i*NJ + j, b = a + NJ; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const lid = new THREE.Mesh(geo, mat); lid.receiveShadow = true; g.scene.add(lid);
    // the bore lining and the two mouth faces
    const lp = [], lc = [], shade = w.colorAt(P[T.i0].x, P[T.i0].z, floor + td.bh, 0.9).map(c => c*0.5);
    const bore = (p, k) => { const out = [[td.bw/2, floor - 3]]; for (let a = 0; a <= NA; a++) { const t = a/NA*Math.PI; out.push([Math.cos(t)*td.bw/2, floor + td.bh - td.bw/2 + Math.sin(t)*td.bw/2]); } out.push([-td.bw/2, floor - 3]); return out.map(([x, y]) => [p.x + p.lx*x, y, p.z + p.lz*x]); };
    const tri = (a, b, c, k) => { lp.push(...a, ...b, ...c); for (let q = 0; q < 3; q++) lc.push(...(k || shade)); };
    for (let i = T.i0; i < T.i1; i++) { const A = bore(P[i]), B = bore(P[i + 1]); for (let a = 0; a < A.length - 1; a++) { tri(A[a], B[a], B[a + 1]); tri(A[a], B[a + 1], A[a + 1]); } }
    for (const i of [T.i0, T.i1]) { const p = P[i], fcol = (x, y) => w.colorAt(p.x + p.lx*x, p.z + p.lz*x, y, 0.95).map(c => c*0.82);
      for (let j = 0; j < NL; j++) { const x0 = -W + 2*W*j/NL, x1 = -W + 2*W*(j + 1)/NL, ix = x => Math.abs(x) < td.bw/2 ? floor + boreTop(td, Math.abs(x)) : Math.min(floor - 3, lidY(p, x));   // no skirt hanging below the ground
        const P0 = [p.x + p.lx*x0, lidY(p, x0), p.z + p.lz*x0], P1 = [p.x + p.lx*x1, lidY(p, x1), p.z + p.lz*x1], Q0 = [p.x + p.lx*x0, ix(x0), p.z + p.lz*x0], Q1 = [p.x + p.lx*x1, ix(x1), p.z + p.lz*x1];
        lp.push(...P0, ...Q0, ...Q1, ...P0, ...Q1, ...P1); for (const [x, y] of [[x0, P0[1]], [x0, Q0[1]], [x1, Q1[1]], [x0, P0[1]], [x1, Q1[1]], [x1, P1[1]]]) lc.push(...fcol(x, y)); } }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3)); g2.computeVertexNormals();
    g.scene.add(new THREE.Mesh(g2, new THREE.MeshStandardMaterial({vertexColors:true, flatShading:true, roughness:0.95, side:THREE.DoubleSide})));
    if (td.ledge) { const m = P[(T.i0 + T.i1) >> 1]; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(5, 0), G.mat(0x4a443c)); r.position.set(m.x + m.lx*(td.bw/2 - 3.5), floor + 8, m.z + m.lz*(td.bw/2 - 3.5)); g.scene.add(r); }
    if (this.night || td.sea) this.anim.push(() => { if (Math.random() < 0.4) { const p = P[Math.random() < 0.5 ? T.i0 : T.i1], sd = Math.random() < 0.5 ? 1 : -1; g.fx.fire.emit(p.x + p.lx*sd*(td.bw/2 - 1.5), floor + td.bh*0.55, p.z + p.lz*sd*(td.bw/2 - 1.5), 0, 0.6, 0, 2.2, 0.35, 1, 0.75, 0.35, 0.9, 0, 1, 0); } });
    return {T, lidY, W, seen:null, t:-99, name:td.name};
  },
  /* where a world point sits relative to a tunnel's path: along (s), across (x) and the nearest path point */
  tunnelAt(tn, x, z){
    const P = tn.T.pts; let bi = 0, bd = 1e18; for (let i = 0; i < P.length; i++) { const d = (x - P[i].x)**2 + (z - P[i].z)**2; if (d < bd) { bd = d; bi = i; } }
    const p = P[bi], ox = x - p.x, oz = z - p.z; return {i:bi, p, s:p.s + ox*p.dx + oz*p.dz, x:ox*p.lx + oz*p.lz};
  },
  tunnelHit(g){
    for (const tn of this.tunnels) {
      const T = tn.T, td = T.td, s0 = T.pts[T.i0].s, s1 = T.pts[T.i1].s;
      for (const p of g.planes) {
        if (!p.alive || p.frozen) continue;
        const a = this.tunnelAt(tn, p.pos.x, p.pos.z);
        if (tn.wall && a.s < s0 - 2) { const wt = tn.wall(a, p.pos.x, p.pos.z); if (wt !== null && p.pos.y < wt + 1) { if (p.isPlayer) { if (!g.done) p.destroy(null, 'crash'); } else p.pos.y = wt + 4; continue; } }   // the walls of a slot canyon
        if (Math.abs(a.x) > tn.W || a.s < s0 - 2 || a.s > s1 + 2) { if (p.isPlayer && tn.seen && (a.s < s0 - 20 || a.s > s1 + 20 || Math.abs(a.x) > tn.W)) this.tunnelPass(tn); continue; }
        const y = p.pos.y - T.floor, inBore = Math.abs(a.x) < td.bw/2 - 3.5 && y > 1.2 && y < boreTop(td, Math.abs(a.x) + 3) - 1.5, top = tn.lidY(a.p, a.x);
        if (p.isPlayer && inBore) { tn.seen = tn.seen || {lo:1e9, hi:-1e9}; tn.seen.lo = Math.min(tn.seen.lo, a.s); tn.seen.hi = Math.max(tn.seen.hi, a.s); }
        if (inBore || p.pos.y > top + 1) continue;
        if (p.isPlayer) { if (!g.done) p.destroy(null, 'crash'); } else p.pos.y = top + 4;
      }
      const P = g.player, e = T.pts[T.i0], d = Math.hypot(P.pos.x - e.x, P.pos.z - e.z);
      if (d < 1500 && d > 60 && !(this.job && this.job.hideSites) && !T.into) g.markers.push({pos:new V3(e.x, T.floor + td.bh*0.5, e.z), label:`CAVE · ${td.name.toUpperCase()}${td.shape === 's' ? ' · it snakes' : td.shape === 'bend' ? ' · it turns' : ''}`, col:'#9ec7f0', noDist:d < 400});
      if (T.into && d < 2500 && d > 60) { let q = e;   // a canyon gate: point at the canyon mouth until the player is in the slot, then at the portal
        if (td.canyon) { const m = T.pts[T.im], a = this.tunnelAt(tn, P.pos.x, P.pos.z); if (a.s < m.s - 40 || Math.abs(a.x) > td.canyon.hw0 || P.pos.y > T.floor + 260) q = m; }
        g.markers.push({pos:new V3(q.x, T.floor + td.bh*0.5, q.z), label:'CÍBOLA · FLY IN HERE', col:'#f2c14e', noDist:Math.hypot(P.pos.x - q.x, P.pos.z - q.z) < 400}); }
    }
  },
  tunnelPass(tn){
    const T = tn.T, s0 = T.pts[T.i0].s, s1 = T.pts[T.i1].s, L = s1 - s0, sn = tn.seen; tn.seen = null;
    const full = sn.lo < s0 + L*0.2 && sn.hi > s1 - L*0.2;
    if (T.into) { if (full) this.flown(T.td.id); return; }   // a gate into a cavern counts as flown, but scores nothing
    if (!full || this.g.t - tn.t < 4) return;
    tn.t = this.g.t; this.flown(T.td.id); this.award(T.td.bonus || (T.td.shape === 'none' ? 1500 : 2000), T.td.sea ? 'THROUGH THE SEA CAVE' : 'THROUGH THE MOUNTAIN'); if (this.g.audio) this.g.audio.ding();
  },
  /* Cíbola's cavern: the mesa top stays where it was (rebuilt over the hollow), a domed sandstone ceiling inside,
     a rim wall with the entrance cut through it, hanging lanterns, and solid rock everywhere you can't see daylight. */
  buildCavern(g, C){
    if (C.def.rock) return this.buildRockCavern(g, C);
    const w = g.world, mat = w.terrain.material, S = w.S, ax = C.ax[0], az = C.ax[1];
    const toW = (lx, lz) => [C.x + ax*lx - az*lz, C.z + az*lx + ax*lz];
    const ceil = u => C.floor + Math.max(42, C.H*Math.sqrt(Math.max(0, 1 - u*u)));
    this.cavern = C; C.ceil = ceil;
    // lid: the mesa top over the hollow (and a margin), always above the ceiling
    const NR = 22, NT = 56, pos = [], col = [], uv = [], idx = [], M = 1.32;
    for (let i = 0; i <= NR; i++) for (let j = 0; j < NT; j++) {
      const u = i/NR*M, t = j/NT*Math.PI*2, [wx, wz] = toW(Math.cos(t)*C.rx*u, Math.sin(t)*C.rz*u), y = Math.max(w.height0(wx, wz) + 0.4, u < 1.05 ? ceil(Math.min(u, 1)) + 8 : -1e9);
      pos.push(wx, y, wz); uv.push((wx + S/2)/S, 1 - (wz + S/2)/S); col.push(...w.colorAt(wx, wz, y, y > w.height0(wx, wz) + 1 ? 0.6 : w.slope0(wx, wz)));
    }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NT; j++) { const a = i*NT + j, b = i*NT + (j + 1) % NT, c = a + NT, d = b + NT; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const lid = new THREE.Mesh(geo, mat); lid.receiveShadow = true; g.scene.add(lid);
    // the dome and the rim wall, in banded sandstone; a window in the wall where the gate tunnel comes in
    const dp = [], dc = [], band = y => { const v = 0.5 + 0.08*Math.sin(y*0.22); return [v*1.25, v*0.78, v*0.52]; };
    const tri = (a, b, c) => { dp.push(...a, ...b, ...c); dc.push(...band(a[1]), ...band(b[1]), ...band(c[1])); };
    const P3 = (u, t, y) => { const [x, z] = toW(Math.cos(t)*C.rx*u, Math.sin(t)*C.rz*u); return [x, y, z]; };
    for (let i = 0; i < 14; i++) for (let j = 0; j < NT; j++) { const u0 = i/14, u1 = (i + 1)/14, t0 = j/NT*Math.PI*2, t1 = (j + 1)/NT*Math.PI*2;
      const A = P3(u0, t0, ceil(u0)), B = P3(u1, t0, ceil(u1)), Cc = P3(u1, t1, ceil(u1)), D = P3(u0, t1, ceil(u0)); tri(A, B, Cc); tri(A, Cc, D); }
    const gateHalf = (C.gate.td.bw/2 + 3)/C.rx;
    for (let j = 0; j < NT; j++) { const t0 = j/NT*Math.PI*2, t1 = (j + 1)/NT*Math.PI*2, tm = (t0 + t1)/2; if (Math.abs(Math.atan2(Math.sin(tm), Math.cos(tm))) < gateHalf + 0.02) continue;
      const A = P3(1, t0, C.floor - 2), B = P3(1, t1, C.floor - 2), Cc = P3(1, t1, ceil(1)), D = P3(1, t0, ceil(1)); tri(A, B, Cc); tri(A, Cc, D); }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3)); g2.computeVertexNormals();
    g.scene.add(new THREE.Mesh(g2, new THREE.MeshStandardMaterial({vertexColors:true, flatShading:true, roughness:0.95, side:THREE.DoubleSide})));
    // lanterns hung from the ceiling, and a warm glow so the city reads in the gloom
    const R0 = G.rng(711), L = [];
    for (let i = 0; i < 70; i++) { const u = Math.sqrt(R0())*0.92, t = R0()*Math.PI*2, [x, z] = toW(Math.cos(t)*C.rx*u, Math.sin(t)*C.rz*u); L.push([x, ceil(u) - 6 - R0()*10, z]); }
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1.1, 6, 4), new THREE.MeshBasicMaterial({color:0xffc870}), L.length), mx = new THREE.Matrix4();
    L.forEach(([x, y, z], i) => im.setMatrixAt(i, mx.makeTranslation(x, y, z))); im.frustumCulled = false; g.scene.add(im);
    for (const [k, off] of [[0, 0], [1, 0.5], [2, -0.5]]) { const [x, z] = toW(off*C.rx, 0), lt = new THREE.PointLight(0xffb070, 0.9, 520, 1.4); lt.position.set(x, C.floor + C.H*0.6, z); g.scene.add(lt); }
  },
  /* ---------- Cíbola in the rock ----------
     A rock cavern is hewn, not turned: a rough vault with pockets, cracks and wobbling strata, stalactites hanging in the
     pockets, a ragged wall footed in scree, a few pillars clear of the runway and two chimneys letting daylight in.
     The mesa over it is put back cell for cell from the uncut terrain grid, so the top is seamless.
     Collision is the smooth shape underneath: C.ceil / C.solid. Everything you can see is at or beyond it. */
  buildRockCavern(g, C){
    const w = g.world, ax = C.ax[0], az = C.ax[1], F = C.floor, rx = C.rx, rz = C.rz, H = C.H, TAU = Math.PI*2, n = G.Noise(this.R.seed + 77), rj = G.rng(711), S = new Soup();
    const P3 = (lx, y, lz) => [C.x + ax*lx - az*lz, y, C.z + az*lx + ax*lz], W3 = v => P3(v[0], v[1], v[2]), loc = (x, z) => [(x - C.x)*ax + (z - C.z)*az, -(x - C.x)*az + (z - C.z)*ax];
    const T = C.gate, td = T.td, g0 = T.pts[T.i0], g1 = T.pts[T.i1], gLx = loc(g1.x, g1.z)[0], gHW = cutHW(td), gW = gHW + 62, gL = g1.s - g0.s;
    // the shape you can hit: the old dome (never lower than it was), a wavy wall just inside the rim, the pillars
    const base = u => Math.max(50, H*Math.sqrt(Math.max(0, 1 - u*u)));
    const ceilC = (lx, lz) => F + base(Math.hypot(lx/rx, lz/rz)) + 5*clamp01(0.5 + 1.3*n(lx*0.006 + 3, lz*0.006, 2));
    const ceilV = (lx, lz) => ceilC(lx, lz) + 1.5 + 32*Math.max(0, n(lx*0.016 + 9, lz*0.016, 2) - 0.04) + 2.5*clamp01(0.5 + n(lx*0.05, lz*0.05 + 4, 2));   // what you see: pockets and facets above it
    const wallU = t => { const a = Math.abs(Math.atan2(Math.sin(t), Math.cos(t))), wv = 0.965 + 0.015*Math.sin(5*t) - 0.008*Math.sin(11*t); return wv + (gLx/rx - wv)*sms(0.42, 0.16, a); };
    const pillars = [[215, 115, 13], [-235, 105, 11], [30, -160, 15], [-170, -135, 12]].map(([a, b, r]) => { const lx = a*rx/330, lz = b*rz/230; return {lx, lz, r, top:ceilV(lx, lz) + 5, ct:ceilC(lx, lz)}; });
    const pilR = (q, y) => { const k = 2*clamp01((y - F)/(q.ct - F)) - 1; return q.r*(1 + 1.5*k*k*k*k + 0.35*k*k); };   // waisted, flaring into floor and roof
    C.ceil = (u, lx, lz) => lx === undefined ? F + base(u) : ceilC(lx, lz); C.ceilV = ceilV; C.wallU = wallU; C.pillars = pillars;
    /* is a point in the rock? null: no (or not ours to say); otherwise the ground above it */
    C.solid = (lx, lz, y, x, z) => {
      if (Math.hypot(lx/(rx + C.cutM), lz/(rz + C.cutM)) >= 1) return null;   // out there the terrain is the rock
      const top = w.height0(x, z); if (y > top + 1) return null;
      if (td.canyon && lx >= gLx - 2 && Math.abs(lz) <= gW) return null;   // the gate looks after its own rock
      if (Math.hypot(lx/rx, lz/rz) < wallU(Math.atan2(lz/rz, lx/rx)) && y < ceilC(lx, lz) - 2) { for (const q of pillars) if (Math.hypot(lx - q.lx, lz - q.lz) < pilR(q, y)*1.15 + 1.5) return top; return null; }
      return top;
    };
    this.cavern = C;
    // sandstone: strata that wobble, a dark seam under each, cracks, and every facet its own shade
    const PAL = [[0.62, 0.4, 0.27], [0.68, 0.47, 0.31], [0.57, 0.36, 0.25], [0.72, 0.53, 0.37], [0.53, 0.33, 0.24], [0.65, 0.43, 0.28]];
    const inCol = C.inCol = (x, y, z) => { const yy = y + 7*n(x*0.01, z*0.01, 2) + 2.5*n(x*0.06 + 5, z*0.06, 1), li = Math.floor(yy/7), c = PAL[((li*7 + (li >> 2)) % 6 + 6) % 6];
      const k = (yy/7 - li < 0.16 ? 0.7 : 1)*(Math.abs(n(x*0.022 + 40, z*0.022 + y*0.03, 2)) < 0.03 ? 0.55 : 1)*(0.94 + 0.12*rj()); return [c[0]*k, c[1]*k, c[2]*k]; };
    // the vault and the wall in one skin: rings out from the crown, then down the wall to the floor
    const NT = 112, NR = 26, NW = 8, rows = [], cnt = i => i === 0 ? 1 : i <= 1 ? NT/8 : i <= 3 ? NT/4 : i <= 7 ? NT/2 : NT;   // fewer round the crown, so it is not a starburst of slivers
    const wallP = (t, f) => { const ct = Math.cos(t), st = Math.sin(t), uw = wallU(t), e = 2 + 7*clamp01(0.5 + 1.1*n(ct*4 + 7, st*4 + f*1.6, 2)) + 5*Math.pow(1 - f, 1.5); return [ct*(rx*uw + e), st*(rz*uw + e)]; };
    for (let i = 0; i <= NR + NW; i++) { const row = [], m = cnt(i); rows.push(row);
      for (let j = 0; j < m; j++) {
        const t = (j + (i > 8 ? (i & 1)*0.5 : 0) + (rj() - 0.5)*0.3)/m*TAU, [ex, ez] = wallP(t, 1);
        if (i <= NR) { const k = i === 0 ? 0 : Math.pow((i + (i < NR ? (rj() - 0.5)*0.4 : 0))/NR, 0.85), lx = ex*k, lz = ez*k; row.push([lx, ceilV(lx, lz), lz]); }
        else { const f = 1 - (i - NR)/NW, [lx, lz] = wallP(t, f); row.push([lx, F - 2 + (ceilV(ex, ez) - F + 2)*f + (f > 0 ? (rj() - 0.5)*3 : 0), lz]); }
      } }
    for (let i = 0; i < NR + NW; i++) { const A = rows[i], B = rows[i + 1], m = A.length;
      if (B.length !== m) { const k = B.length/m; for (let j = 0; j < m; j++) { const a = A[j], a1 = A[(j + 1) % m]; if (m === 1) { for (let q = 0; q < B.length; q++) S.tri(W3(a), W3(B[q]), W3(B[(q + 1) % B.length]), inCol); continue; }
          S.tri(W3(a), W3(B[j*k]), W3(B[j*k + 1]), inCol); S.tri(W3(a), W3(B[j*k + 1]), W3(a1), inCol); S.tri(W3(a1), W3(B[j*k + 1]), W3(B[(j*k + 2) % B.length]), inCol); } continue; }
      for (let j = 0; j < m; j++) { const a = A[j], b = A[(j + 1) % m], c = B[(j + 1) % m], d = B[j];
        if (i >= NR && a[0] > 0 && (Math.min(Math.abs(a[2]), Math.abs(b[2]), Math.abs(c[2]), Math.abs(d[2])) < td.bw/2 + 6 || a[2]*b[2] < 0)) continue;   // the gate comes in here
        S.quad(W3(a), W3(b), W3(c), W3(d), inCol); } }
    // scree against the foot of the wall, except at the gate, the far end of the runway and behind the town
    const site = this.R.sites.find(s => s.cavern) || {}, tz = -(site.townOff ? site.townOff[0] : 0), tr = (site.townR || 0) + 18, scree = (x, y, z) => { const c = inCol(x, y, z); return [c[0]*1.08, c[1]*1.06, c[2]*1.02]; };
    let prev = null;
    for (let j = 0; j <= NT; j++) { const t = (j % NT)/NT*TAU, ct = Math.cos(t), st = Math.sin(t), [bx, bz] = wallP(t, 0);
      const ok = j < NT && Math.abs(bz) > 56 && !(site.town && Math.hypot(bx - ct*20, bz - st*20 - tz) < tr) && !(site.cityOf && bz > 44), d1 = 7 + 4*rj(), d2 = 17 + 9*rj();
      const cur = ok ? [[bx + ct*3, F + 5 + 6*rj(), bz + st*3], [bx - ct*d1, F + 1.5 + 3*rj(), bz - st*d1], [bx - ct*d2, F - 0.5, bz - st*d2]] : null;
      if (prev && cur) for (let k = 0; k < 2; k++) S.quad(W3(prev[k]), W3(cur[k]), W3(cur[k + 1]), W3(prev[k + 1]), scree);
      prev = cur; }
    // pillars
    for (const q of pillars) { const NS = 9, NP = 9, ring = [];
      for (let i = 0; i <= NP; i++) { const y = F - 1 + (q.top - F + 1)*i/NP, r = pilR(q, y), row = []; ring.push(row);
        for (let j = 0; j < NS; j++) { const a = (j + (i & 1)*0.5)/NS*TAU, rr = r*(0.86 + 0.28*rj()); row.push([q.lx + Math.cos(a)*rr, y + (i && i < NP ? (rj() - 0.5)*3 : 0), q.lz + Math.sin(a)*rr]); } }
      for (let i = 0; i < NP; i++) for (let j = 0; j < NS; j++) S.quad(W3(ring[i][j]), W3(ring[i][(j + 1) % NS]), W3(ring[i + 1][(j + 1) % NS]), W3(ring[i + 1][j]), inCol); }
    // stalactites: only as long as the pocket they hang in is deep, so none reaches into the air a plane may use
    const cone = (lx, lz, yb, L, r) => { const tip = P3(lx + (rj() - 0.5)*r, yb - L, lz + (rj() - 0.5)*r), a0 = rj()*TAU; for (let k = 0; k < 5; k++) { const a = a0 + k/5*TAU, b = a0 + (k + 1)/5*TAU; S.tri(P3(lx + Math.cos(a)*r, yb, lz + Math.sin(a)*r), P3(lx + Math.cos(b)*r, yb, lz + Math.sin(b)*r), tip, inCol); } };
    const stal = (lx, lz, want) => { const cv = ceilV(lx, lz), L = Math.min(want, cv - ceilC(lx, lz) + 1.5); if (L < 3.5) return 0; cone(lx, lz, cv + 2, L + 2, 0.8 + L*0.13); return 1; };
    for (let k = 0; k < 420; k++) { const u = Math.sqrt(rj())*0.9, t = rj()*TAU, lx = Math.cos(t)*rx*u, lz = Math.sin(t)*rz*u; if (ceilV(lx, lz) - ceilC(lx, lz) < 7) continue;
      if (rj() < 0.3) {   // a hanging fin
        const a = rj()*Math.PI, len = 5 + 6*rj(), ca = Math.cos(a), sa = Math.sin(a), L = Math.min(8 + 8*rj(), ceilV(lx, lz) - ceilC(lx, lz) + 1.5), tip = P3(lx, ceilV(lx, lz) - L, lz);
        const e = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([p, q]) => { const x = lx + ca*len*p - sa*1.3*q, z = lz + sa*len*p + ca*1.3*q; return P3(x, ceilV(x, z) + 2, z); });
        for (let m = 0; m < 4; m++) S.tri(e[m], e[(m + 1) % 4], tip, inCol);
      } else if (stal(lx, lz, 9 + rj()*12)) for (let m = 0; m < 2; m++) stal(lx + (rj() - 0.5)*9, lz + (rj() - 0.5)*9, 4 + rj()*6); }
    for (const q of pillars) for (let k = 0; k < 8; k++) { const a = rj()*TAU, d = q.r*(1.1 + 0.4*rj()), lx = q.lx + Math.cos(a)*d, lz = q.lz + Math.sin(a)*d;
      if (k < 5) { const L = 6 + rj()*7; cone(lx, lz, ceilV(lx, lz) + 2, L + 2, 1 + L*0.12); } else cone(lx, lz, F - 0.5, -(4 + rj()*6), 1.6 + rj()); }   // and stalagmites at their feet
    g.scene.add(S.mesh()); C.tris = S.tris;
    // two chimneys in the roof: a bright mouth, a shaft of light and its pool on the floor (moonlight after dark)
    const day = !this.night, glow = (o, k) => new THREE.MeshBasicMaterial(Object.assign({color:day ? 0xfff0c8 : 0x8fa6d8, transparent:true, opacity:(day ? 1 : 0.4)*k, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false}, o));
    const fan = (c, r, m) => { const p = []; for (let k = 0; k < 12; k++) { const a = k/12*TAU, b = (k + 1)/12*TAU; p.push(c[0], c[1], c[2], c[0] + Math.cos(a)*r, c[1], c[2] + Math.sin(a)*r, c[0] + Math.cos(b)*r, c[1], c[2] + Math.sin(b)*r); }
      const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); const o = new THREE.Mesh(ge, m); o.frustumCulled = false; g.scene.add(o); };
    for (const [a, b] of [[-60, -150], [150, 95]]) { let lx = a*rx/330, lz = b*rz/230, best = 1e9;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const x = a*rx/330 + i*12, z = b*rz/230 + j*12, d = ceilV(x, z) - ceilC(x, z); if (d < best) { best = d; lx = x; lz = z; } }   // where the roof is plainest
      let cy = 1e9; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) cy = Math.min(cy, ceilV(lx + i*9, lz + j*9));
      const tp = P3(lx, cy - 0.4, lz), bt = P3(lx + 16, F + 0.35, lz - 10), cp = [];
      fan(tp, 7, new THREE.MeshBasicMaterial({color:day ? 0xfff4d6 : 0x93a8d6, side:THREE.DoubleSide, fog:false}));
      for (let k = 0; k < 12; k++) { const a0 = k/12*TAU, a1 = (k + 1)/12*TAU, q = (c, r, t) => [c[0] + Math.cos(t)*r, c[1], c[2] + Math.sin(t)*r]; cp.push(...q(tp, 6, a0), ...q(bt, 17, a0), ...q(bt, 17, a1), ...q(tp, 6, a0), ...q(bt, 17, a1), ...q(tp, 6, a1)); }
      const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); const beam = new THREE.Mesh(ge, glow({}, 0.13)); beam.frustumCulled = false; g.scene.add(beam);
      fan(bt, 17, glow({}, 0.28)); }
    // lanterns hung from the roof, and a warm glow so the city reads in the gloom
    const R0 = G.rng(711), fit = new G.Fittings({day:this.night ? 0 : 0.3});   // each in its housing on a chain from the rock; shorter chains over the runway
    for (let i = 0; i < 70; i++) { const u = Math.sqrt(R0())*0.92, t = R0()*TAU, lx = Math.cos(t)*rx*u, lz = Math.sin(t)*rz*u, y = ceilC(lx, lz) - (Math.abs(lz) < 45 ? 3.5 + R0()*3 : 5 + R0()*10); fit.lantern(P3(lx, y, lz), {s:3, hang:Math.max(0.5, ceilV(lx, lz) + 2.5 - y - 1.71)}); }
    g.scene.add(fit.build(new THREE.Group())); C.tris = (C.tris || 0) + fit.tris;
    for (const off of [0, 0.5, -0.5]) { const [x, y, z] = P3(off*rx, F + H*0.6, 0), lt = new THREE.PointLight(0xffb070, 0.9, 520, 1.4); lt.position.set(x, y, z); g.scene.add(lt); }
    // the mesa over the hollow: every terrain cell that lost a corner to the cavern or the portal, put back from the uncut
    // heights with the terrain's own colours, normals and material. Where the canyon comes in, it stops at the gate's face.
    const st = w.step, N = w.N, Wd = N + 1, S0 = w.S, e = C.cutM, hC = (ix, iz) => w.h0[Math.min(N, Math.max(0, iz))*Wd + Math.min(N, Math.max(0, ix))];
    const roofed = (x, z) => { const [lx, lz] = loc(x, z); if ((lx/(rx + e))**2 + (lz/(rz + e))**2 <= 1) return true; if (!td.canyon) return false;
      const s = (x - g0.x)*g0.dx + (z - g0.z)*g0.dz, o = (x - g0.x)*g0.lx + (z - g0.z)*g0.lz; return s >= 0 && s <= gL && Math.abs(o) <= gHW; };
    const vc = new Map(), vtx = (ix, iz) => { const key = iz*Wd + ix; let v = vc.get(key); if (v) return v;
      const x = -S0/2 + ix*st, z = -S0/2 + iz*st, y = w.h0[key], cut = w.h[key] < y - 1e-4, h = hC(ix, iz);
      const gx = (hC(ix + 1, iz) - h) + (h - hC(ix - 1, iz)) + (hC(ix, iz + 1) - hC(ix - 1, iz + 1)) + (hC(ix + 1, iz - 1) - hC(ix, iz - 1)) + (hC(ix + 1, iz) - h) + (h - hC(ix - 1, iz));
      const gz = (hC(ix, iz + 1) - h) + (hC(ix - 1, iz + 1) - hC(ix - 1, iz)) + (hC(ix, iz + 1) - h) + (h - hC(ix, iz - 1)) + (hC(ix + 1, iz) - hC(ix + 1, iz - 1)) + (h - hC(ix, iz - 1)), nl = Math.hypot(gx, 6*st, gz);
      const col = w.colorAt(x, z, y, Math.hypot(hC(ix + 1, iz) - hC(ix - 1, iz), hC(ix, iz + 1) - hC(ix, iz - 1))/(2*st));
      const n0 = w.n0, nx = n0 ? n0[key*3] : -gx/nl, ny = n0 ? n0[key*3 + 1] : 6*st/nl, nz = n0 ? n0[key*3 + 2] : -gz/nl;
      v = {a:[x, y, z, col[0], col[1], col[2], nx, ny, nz], cut, roof:cut && roofed(x, z), key}; vc.set(key, v); return v; };
    C.gridV = vtx;   // the canyon gate puts its own ground back with the same vertices
    const seam = new Set(), lp = [], lc = [], ln = [], lu = [], sd = a => (a[0] - g0.x)*g0.dx + (a[2] - g0.z)*g0.dz;
    const emit = (poly) => { for (let k = 1; k < poly.length - 1; k++) for (const a of [poly[0], poly[k], poly[k + 1]]) { lp.push(a[0], a[1], a[2]); lc.push(a[3], a[4], a[5]); ln.push(a[6], a[7], a[8]); lu.push((a[0] + S0/2)/S0, 1 - (a[2] + S0/2)/S0); } };
    const clip = poly => { const out = []; for (let k = 0; k < poly.length; k++) { const a = poly[k], b = poly[(k + 1) % poly.length], da = sd(a), db = sd(b); if (da >= 0) out.push(a); if ((da >= 0) !== (db >= 0)) { const t = da/(da - db); out.push(a.map((v, i) => v + (b[i] - v)*t)); } } return out; };
    const RR = Math.max(rx, rz) + e + gL + 120, i0 = Math.max(0, Math.floor((C.x - RR + S0/2)/st)), i1 = Math.min(N - 1, Math.ceil((C.x + RR + S0/2)/st)), k0 = Math.max(0, Math.floor((C.z - RR + S0/2)/st)), k1 = Math.min(N - 1, Math.ceil((C.z + RR + S0/2)/st));
    for (let iz = k0; iz <= k1; iz++) for (let ix = i0; ix <= i1; ix++) { const a = vtx(ix, iz), d = vtx(ix + 1, iz), b = vtx(ix, iz + 1), c = vtx(ix + 1, iz + 1), q = [a, b, c, d];
      if (!q.some(v => v.roof)) continue; const open = td.canyon && q.some(v => v.cut && !v.roof);
      if (!open) for (const v of q) if (!v.cut) seam.add(v);   // the ground round the lid: light and colour it as if nothing were cut
      for (const t of [[a, b, d], [c, d, b]]) { if (!t.some(v => v.cut)) continue;   // an untouched triangle is still there in the terrain
        const poly = open ? clip(t.map(v => v.a)) : t.map(v => v.a); if (poly.length >= 3) emit(poly); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(lu, 2));
    const lid = new THREE.Mesh(geo, w.terrain.material); lid.receiveShadow = true; g.scene.add(lid); C.tris += lp.length/9;
    { const tg = w.terrain.geometry, TN = tg.attributes.normal, TC = tg.attributes.color;
      if (TN && TC && TN.setXYZ) { for (const v of seam) { const a = v.a; TN.setXYZ(v.key, a[6], a[7], a[8]); TC.setXYZ(v.key, a[3], a[4], a[5]); } TN.needsUpdate = TC.needsUpdate = true; } }
  },
  /* The Gate of Cíbola: a slot canyon (the terrain cut, open to the sky) ending at the mesa wall in a mission front
     carved round a big arched portal, with a timber gantry, lanterns and the name over the door. Only the portal is
     roofed; tunnelHit treats it like any other bore. The canyon walls get a skin of ledged rock over the coarse terrain. */
  buildCanyonGate(g, T){
    const w = g.world, td = T.td, cy = td.canyon, P = T.pts, F = T.floor, p0 = P[T.i0], dx = p0.dx, dz = p0.dz, ox = p0.lx, oz = p0.lz, Lp = P[T.i1].s - p0.s, W = cutHW(td) + 62, hb = td.bw/2, spring = F + td.bh - hb;
    const n = G.Noise(this.R.seed + 78), rj = G.rng(4242), S = new Soup(), C = this.cavern, PI = Math.PI;
    const fit = new G.Fittings({day:this.night ? 0 : w.time === 'evening' ? 0.5 : 1}), LC = G.LAMP;   // lanterns and strings of bulbs: dim by day, the way in after dark
    const PW = (s, x, y) => [p0.x + dx*s + ox*x, y, p0.z + dz*s + oz*x], top0 = x => w.height0(p0.x + ox*x, p0.z + oz*x);
    const lidY = (p, x) => w.height0(p.x + p.lx*x, p.z + p.lz*x);
    const RED = [0.56, 0.15, 0.11], STONE = [0.83, 0.74, 0.6], GOLD = [0.93, 0.74, 0.27], TIMBER = [0.33, 0.22, 0.14], DARK = [0.12, 0.08, 0.07], WHITE = [0.92, 0.87, 0.74];
    const shade = (c, k) => [c[0]*k, c[1]*k, c[2]*k], jit = c => () => shade(c, 0.93 + 0.14*rj());
    // rock in the terrain's own colours, with seams and cracks
    const outCol = (x, y, z) => { const yy = y + 6*n(x*0.011, z*0.011, 2), c = w.colorAt(x, z, yy, 0.9), k = (yy/8 - Math.floor(yy/8) < 0.15 ? 0.74 : 1)*(Math.abs(n((x + z)*0.035 + 40, y*0.03 + (x - z)*0.02, 2)) < 0.03 ? 0.6 : 1)*(0.9 + 0.2*rj()); return shade(c, k); };
    const inCol = C && C.inCol ? C.inCol : outCol;
    const box = (s0, s1, x0, x1, y0, y1, k) => S.hexa([PW(s0, x0, y0), PW(s0, x1, y0), PW(s0, x1, y1), PW(s0, x0, y1)], [PW(s1, x0, y0), PW(s1, x1, y0), PW(s1, x1, y1), PW(s1, x0, y1)], k);
    const stroke = (s, a, b, hw, k) => { const ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1, ux = ex/L, uy = ey/L, e = hw*0.6, q = (px, py, t) => PW(s, px - uy*hw*t, py + ux*hw*t);
      S.quad(q(a[0] - ux*e, a[1] - uy*e, 1), q(b[0] + ux*e, b[1] + uy*e, 1), q(b[0] + ux*e, b[1] + uy*e, -1), q(a[0] - ux*e, a[1] - uy*e, -1), k); };
    // a wall across the canyon, pierced by the bore: columns from the ground (or the arch) up to top(x)
    const NA = 14, cols = (X, step) => { const out = [], m = Math.max(1, Math.round((X - hb)/step)); for (let k = 0; k <= m; k++) out.push([-X + (X - hb)*k/m, F - 3]);
      for (let a = 0; a <= NA; a++) { const x = -Math.cos(a/NA*PI)*hb; out.push([x, F + boreTop(td, Math.min(hb, Math.abs(x)))]); } for (let k = 0; k <= m; k++) out.push([hb + (X - hb)*k/m, F - 3]); return out; };
    const archWall = (s, cs, top, NR, disp, k) => { const V = cs.map(([x, yb]) => { const yt = top(x), col = []; for (let r = 0; r <= NR; r++) { const y = yb + (yt - yb)*r/NR; col.push(PW(s + disp(x, y), x, y)); } return col; });
      for (let c = 0; c < cs.length - 1; c++) { if (cs[c][0] === cs[c + 1][0]) continue; for (let r = 0; r < NR; r++) S.quad(V[c][r], V[c + 1][r], V[c + 1][r + 1], V[c][r + 1], k); } };
    // the mesa wall: ledged rock that bulges out round a flat niche for the mission front, and a smooth panel for the painted arrow
    const kx = td.bw/60, ky = td.bh/44, FX = 46*kx, GP = Math.min(39.3*kx, (cy.cw1 || 1e9) - 2), facTop = x => F + ky*(Math.abs(x) < 26*kx ? 68 + 24*Math.pow(Math.cos(PI*x/(52*kx)), 1.2) : 68), AY0 = F + 100*ky, AY1 = F + 146*ky;   // drawn for a 60 x 44 portal, scaled to this one
    const fmask = (x, y) => sms(0, 12, Math.hypot(Math.max(0, Math.abs(x) - FX - 3), Math.max(0, y - facTop(x) - 3))), amask = (x, y) => sms(0, 9, Math.hypot(Math.max(0, Math.abs(x) - 16), Math.max(0, AY0 - y, y - AY1)));
    const RX1 = (cy.cw1 || cy.hw1 - 40) + 5;   // beyond the canyon's rim the wall is under the ground: it must not bulge out through the slope
    const bulge = (x, y) => -fmask(x, y)*amask(x, y)*sms(0, 14, top0(x) - y)*sms(RX1, RX1 - 8, Math.abs(x))*(1.2 + 5*clamp01(0.5 + 1.2*n(x*0.025 + 11, y*0.035, 2)) + ((y + 4*n(x*0.012, 1.7, 1))/16 % 1 < 0.5 ? 2.6 : 0));
    archWall(0, cols(W, 7), top0, 18, bulge, outCol);
    // the mission front: plaster with a red dado, a curved gable and a tiled coping
    const plaster = (x, y, z) => y < F + 6*ky ? shade(RED, 0.9 + 0.15*rj()) : shade([0.88, 0.78, 0.63], 0.9 + 0.1*rj() - 0.1*clamp01(n((x + z)*0.05, y*0.012, 2) + 0.2)), fc = cols(FX, 5.4);
    archWall(-1.6, fc, facTop, 7, () => 0, plaster);
    for (let c = 0; c < fc.length - 1; c++) { const x0 = fc[c][0], x1 = fc[c + 1][0]; if (x0 === x1) continue; const y0 = facTop(x0), y1 = facTop(x1);
      S.quad(PW(-2.8, x0, y0 + 0.6), PW(-2.8, x1, y1 + 0.6), PW(2, x1, y1 + 0.6), PW(2, x0, y0 + 0.6), jit(RED)); S.quad(PW(-2.8, x0, y0 + 0.6), PW(-2.8, x1, y1 + 0.6), PW(-2.8, x1, y1 - 1.2), PW(-2.8, x0, y0 - 1.2), jit(RED)); }
    for (const e of [-1, 1]) S.quad(PW(-1.6, e*FX, F - 3), PW(2, e*FX, F - 3), PW(2, e*FX, F + 68*ky), PW(-1.6, e*FX, F + 68*ky), plaster);
    // the arch: striped voussoirs with a gilded keystone, on quoined jambs
    const NV = 17, vp = (a, r) => [-Math.cos(a)*r, spring + Math.sin(a)*r];
    for (let k = 0; k < NV; k++) { const a0 = k/NV*PI, a1 = (k + 1)/NV*PI, key = k === (NV - 1)/2, r1 = hb + (key ? 9.5 : 6.5)*kx, sf = key ? -4.2 : -3.4, col = jit(key ? GOLD : k % 2 ? STONE : RED);
      const f = [vp(a0, hb), vp(a1, hb), vp(a1, r1), vp(a0, r1)]; S.hexa(f.map(q => PW(sf, q[0], q[1])), f.map(q => PW(0.5, q[0], q[1])), col); }
    for (const e of [-1, 1]) for (let k = 0; k < 4; k++) { const y0 = F - 1 + k*(spring - F + 1)/4, y1 = F - 1 + (k + 1)*(spring - F + 1)/4, x1 = hb + (k % 2 ? 6.5 : 7.6)*kx; box(-3.4 - (k % 2 ? 0 : 0.5), 0.5, e*hb, e*x1, y0, y1, jit(k % 2 ? RED : STONE)); }
    // cornice, roof-beam ends, and the name board
    box(-4.2, 0, -FX - 1, FX + 1, F + 53.5*ky, F + 56*ky, jit(RED)); box(-3.4, 0, -FX - 0.5, FX + 0.5, F + 56*ky, F + 56.8*ky, jit(STONE));
    for (let x = -42; x <= 42; x += 6) if (Math.abs(x) > 21) S.beam(PW(-1.6, x*kx, F + 51.4*ky), PW(-5.6, x*kx, F + 51.4*ky), 0.55, jit(TIMBER));
    const BX = 25*kx, BY0 = F + 58.2*ky, BY1 = F + 66.6*ky;
    box(-2.8, -1.6, -BX, BX, BY0, BY1, jit([0.13, 0.1, 0.12])); for (const [x0, x1, y0, y1] of [[-BX, BX, BY0, BY0 + 0.5], [-BX, BX, BY1 - 0.5, BY1], [-BX, -BX + 0.5, BY0, BY1], [BX - 0.5, BX, BY0, BY1]]) box(-3.1, -2.8, x0, x1, y0, y1, jit(GOLD));
    // CÍBOLA, in strokes: each letter in a box 1 wide and 1.4 tall (x runs right as you read it, which is -x across the gate)
    const arc = (cx, cy0, rx0, ry0, a0, a1, m) => { const o = []; for (let k = 0; k <= m; k++) { const a = a0 + (a1 - a0)*k/m; o.push([cx + Math.cos(a)*rx0, cy0 + Math.sin(a)*ry0]); } return o; };
    const GL = {C:[arc(0.5, 0.7, 0.5, 0.7, 0.85, 5.43, 9)], I:[[[0.5, 0], [0.5, 1.4]], [[0.22, 0], [0.78, 0]], [[0.22, 1.4], [0.78, 1.4]], [[0.42, 1.6], [0.78, 1.86]]], B:[[[0.04, 0], [0.04, 1.4], [0.55, 1.4], [0.84, 1.24], [0.84, 0.92], [0.55, 0.75], [0.04, 0.75]], [[0.55, 0.75], [0.94, 0.58], [0.94, 0.2], [0.6, 0], [0.04, 0]]],
      O:[arc(0.5, 0.7, 0.5, 0.7, 0, PI*2, 12)], L:[[[0.08, 1.4], [0.08, 0], [0.9, 0]]], A:[[[0, 0], [0.5, 1.4], [1, 0]], [[0.2, 0.48], [0.8, 0.48]]]};
    const LW = 5.2*kx, LU = 3.5*ky, GAP = 2.1*kx, word = ['C', 'I', 'B', 'O', 'L', 'A'], TW = word.length*LW + (word.length - 1)*GAP, ink = jit([1, 0.82, 0.32]);
    word.forEach((ch, i) => { const x0 = -TW/2 + i*(LW + GAP); for (const line of GL[ch]) for (let k = 0; k < line.length - 1; k++) stroke(-3.0, [-(x0 + line[k][0]*LW), BY0 + 1.1*ky + line[k][1]*LU], [-(x0 + line[k + 1][0]*LW), BY0 + 1.1*ky + line[k + 1][1]*LU], 0.4*kx, ink); });
    for (let x = -20; x <= 20; x += 8) { S.beam(PW(-1.6, x*kx, BY1 + 1.4), PW(-4.2, x*kx, BY1 + 1.4), 0.14, DARK); fit.lantern(PW(-4.2, x*kx, BY1 + 0.5), {s:1.3, hang:0.16}); }
    // bell in its niche, and a cross on the gable
    { const ny = F + 73*ky, s = -1.75, pts = [[-4, ny], [4, ny], ...arc(0, ny + 8, 4, 4, 0, PI, 6)]; for (let k = 1; k < pts.length - 1; k++) S.tri(PW(s, pts[0][0], pts[0][1]), PW(s, pts[k][0], pts[k][1]), PW(s, pts[k + 1][0], pts[k + 1][1]), DARK);
      const rings = [[0.8, ny + 8.5], [1.5, ny + 7.2], [1.9, ny + 5], [2.7, ny + 3.6]], bz = [0.62, 0.45, 0.18];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) { const a = k/6*PI*2, b = (k + 1)/6*PI*2, q = (i, t) => PW(-3.2 + Math.cos(t)*rings[i][0]*0.6, Math.sin(t)*rings[i][0], rings[i][1]); S.quad(q(r, a), q(r, b), q(r + 1, b), q(r + 1, a), jit(bz)); }
      S.beam(PW(-3.2, -4, ny + 8.9), PW(-3.2, 4, ny + 8.9), 0.4, jit(TIMBER)); S.beam(PW(0.2, 0, F + 91*ky), PW(0.2, 0, F + 100*ky), 0.5, jit(TIMBER)); S.beam(PW(0.2, -2.6, F + 96.6*ky), PW(0.2, 2.6, F + 96.6*ky), 0.5, jit(TIMBER)); }
    // the timber gantry in front: posts on stone feet, a lintel with braces, lanterns and a string of pennants
    const GS = -10;
    for (const e of [-1, 1]) { S.beam(PW(GS, e*GP, F - 1), PW(GS, e*GP, F + 51*ky), 1.25, jit(TIMBER)); box(GS - 2.2, GS + 2.2, e*(GP - 2.3), e*(GP + 2.3), F - 1, F + 3.2*ky, jit(STONE));
      S.beam(PW(GS, e*GP, F + 33*ky), PW(GS, e*(GP - 12.3*kx), F + 47.5*ky), 0.8, jit(TIMBER)); S.beam(PW(GS, e*GP, F + 20*ky), PW(-1.6, e*GP, F + 20*ky), 0.6, jit(TIMBER)); S.beam(PW(GS, e*GP, F + 44*ky), PW(-1.6, e*GP, F + 44*ky), 0.6, jit(TIMBER));
      S.beam(PW(GS - 1.3, e*GP, F + 13*ky), PW(GS - 4, e*GP, F + 13*ky), 0.25, DARK); fit.lantern(PW(GS - 4, e*GP, F + 13*ky - 2.4), {s:2.2, hang:0.9}); }
    S.beam(PW(GS, -GP - 4.7, F + 48*ky), PW(GS, GP + 4.7, F + 48*ky), 1.3, jit(TIMBER));
    for (const x of [-26, -13, 13, 26]) { S.beam(PW(GS, x*kx, F + 46.7*ky), PW(GS, x*kx, F + 46.7*ky - 1.5), 0.12, DARK); fit.lantern(PW(GS, x*kx, F + 46.7*ky - 2.6), {s:2, hang:0.2}); }
    { const xs = [-GP, -26*kx, -13*kx, 0, 13*kx, 26*kx, GP]; for (let i = 0; i < 6; i++) fit.festoon(PW(GS - 0.9, xs[i], F + 46.4*ky), PW(GS - 0.9, xs[i + 1], F + 46.4*ky), {sag:1.3, every:1.5, r:0.27, wr:0.05, cols:[LC.WARM, LC.RED, LC.WARM, LC.AQUA]}); }   // a festoon swagged under the lintel
    { const PEN = [RED, GOLD, [0.16, 0.56, 0.6], WHITE], m = 26, at = t => [(-40 + 80*t)*kx, F + 53*ky - 5.5*ky*Math.sin(PI*t)]; for (let k = 0; k < m; k++) { const a = at(k/m), b = at((k + 0.7)/m); S.tri(PW(GS - 1.4, a[0], a[1]), PW(GS - 1.4, b[0], b[1]), PW(GS - 1.4, (a[0] + b[0])/2, Math.min(a[1], b[1]) - 2.4), PEN[k % 4]); } }
    // a painted arrow high on the wall: three whitewashed chevrons pointing down at the door
    for (let k = 0; k < 3; k++) { const yc = AY0 + 4 + k*14; for (const e of [-1, 1]) stroke(-0.45, [e*12, yc + 10], [0, yc], 2.1, jit(WHITE)); }
    // the bore: dressed stone at the mouth, then rock, with timber ribs
    { const NS = Math.max(3, Math.ceil((Lp + 1)/8)), prof = [[-hb, F - 3], ...arc(0, spring, hb, hb, PI, 0, NA), [hb, F - 3]], dim = (x, y, z) => shade(inCol(x, y, z), 0.62), lining = (x, y, z) => shade(STONE, (0.62 + 0.14*rj())*(Math.floor(y/3.2) % 2 ? 1 : 0.9));
      for (let i = 0; i < NS; i++) { const s0 = (Lp + 1)*i/NS, s1 = (Lp + 1)*(i + 1)/NS; for (let k = 0; k < prof.length - 1; k++) S.quad(PW(s0, prof[k][0], prof[k][1]), PW(s1, prof[k][0], prof[k][1]), PW(s1, prof[k + 1][0], prof[k + 1][1]), PW(s0, prof[k + 1][0], prof[k + 1][1]), i === 0 ? lining : dim); }
      const rib = arc(0, spring, hb - 0.7, hb - 0.7, PI, 0, 8); for (let s = 14; s < Lp - 6; s += 14) { for (let k = 0; k < 8; k++) S.beam(PW(s, rib[k][0], rib[k][1]), PW(s, rib[k + 1][0], rib[k + 1][1]), 0.7, jit(TIMBER)); for (const e of [-1, 1]) S.beam(PW(s, e*(hb - 0.7), F - 1), PW(s, e*(hb - 0.7), spring), 0.7, jit(TIMBER)); for (const e of [-1, 1]) fit.lantern(PW(s - 1, e*(hb - 2.4), spring + 0.4), {s:1.5, wall:PW(s - 1, e*(hb - 0.9), spring + 0.4)}); } }
    // the inside face, where the portal opens into the cavern: a buttress of rock with a timber frame
    { const IX = 62, IT = F + 86, imask = (x, y) => sms(0, 10, Math.hypot(Math.max(0, Math.abs(x) - hb - 5), Math.max(0, y - F - td.bh - 5)));
      archWall(Lp, cols(IX, 8), () => IT, 8, (x, y) => imask(x, y)*(0.4 + 3.2*clamp01(0.5 + 1.2*n(x*0.05 + 3, y*0.06, 2))), inCol);
      for (const e of [-1, 1]) { for (let k = 0; k < 6; k++) S.quad(PW(Lp, e*IX, F - 3 + (IT - F + 3)*k/6), PW(Lp - 36, e*IX, F - 3 + (IT - F + 3)*k/6), PW(Lp - 36, e*IX, F - 3 + (IT - F + 3)*(k + 1)/6), PW(Lp, e*IX, F - 3 + (IT - F + 3)*(k + 1)/6), inCol);
        S.beam(PW(Lp + 1.6, e*(hb + 2.6), F - 1), PW(Lp + 1.6, e*(hb + 2.6), F + td.bh + 5), 1.1, jit(TIMBER)); fit.lantern(PW(Lp + 3.9, e*(hb + 2.6), F + td.bh*0.68), {s:1.8, wall:PW(Lp + 2.6, e*(hb + 2.6), F + td.bh*0.68)}); }
      S.beam(PW(Lp + 1.6, -hb - 6, F + td.bh + 4.5), PW(Lp + 1.6, hb + 6, F + td.bh + 4.5), 1.2, jit(TIMBER)); }
    // the slot itself. The terrain's cut is whole grid cells (35 m) wide, far too coarse for a canyon you have to fly with care, so the walls are
    // built here: footAt(s) either side of the axis (cwAt, flaring a little at the mouth), ledged rock from the floor to the rim. Behind them the
    // bench and the mesa are put back cell for cell from the uncut terrain grid (its heights, colours, normals and triangles, as the cavern's lid is),
    // clipped along the rim, so the ground runs unbroken to the lip of the slot and the walls die away where the land falls to the river.
    // `wall` (below) is the same shape for tunnelHit: beyond the foot of the wall the ground is the uncut land again.
    const st = w.step, S0 = w.S, Lc = p0.s || 1, cw0 = cy.cw0 || cy.hw0 - 40, cw1 = cy.cw1 || cy.hw1 - 40, cwAt = s => cw1 + (cw0 - cw1)*clamp01(1 - s/Lc), outer = s => cy.hw1 + (cy.hw0 - cy.hw1)*clamp01(1 - s/Lc) + st*1.45;
    const RD = 4, FS = Math.min(22, Lc*0.2), FK = 0.5, SM = -1.6*st, cwL = s => cw1 + (cw0 - cw1)*(1 - s/Lc), footAt = s => cwL(s) + FK*Math.max(0, FS - s), rimAt = s => footAt(s) + RD;
    { const NV = 10, lp = [], lc = [], ln = [], lu = [], Wd = w.N + 1, vtx = C && C.gridV;
      const ledge = (s, y) => sms(F - 1, F + 7, y)*(0.5 + 3.4*clamp01(0.5 + 1.2*n(s*0.035, y*0.045 + s*0.02, 2)) + ((y + 4*n(s*0.01, 3.3, 1))/14 % 1 < 0.45 ? 2.4 : 0));
      const sOf = a => (a[0] - p0.x)*dx + (a[2] - p0.z)*dz + Lc, oOf = a => (a[0] - p0.x)*ox + (a[2] - p0.z)*oz;
      const clip = (poly, f) => { const out = []; for (let k = 0; k < poly.length; k++) { const a = poly[k], b = poly[(k + 1) % poly.length], da = f(a), db = f(b); if (da >= 0) out.push(a); if ((da >= 0) !== (db >= 0)) { const t = da/(da - db); out.push(a.map((v, i) => v + (b[i] - v)*t)); } } return out; };
      const emit = poly => { for (let k = 1; k < poly.length - 1; k++) for (const a of [poly[0], poly[k], poly[k + 1]]) { lp.push(a[0], a[1], a[2]); lc.push(a[3], a[4], a[5]); ln.push(a[6], a[7], a[8]); lu.push((a[0] + S0/2)/S0, 1 - (a[2] + S0/2)/S0); } };
      if (vtx) {   // the land beside the slot
        const seam = new Set(), cs = [[SM - st, 1], [SM - st, -1], [Lc + st, 1], [Lc + st, -1]].map(([s, e]) => PW(s - Lc, e*(cy.hw0 + 2*st), 0)), gi = v => Math.max(0, Math.min(w.N - 1, Math.floor((v + S0/2)/st)));
        const i0 = gi(Math.min(...cs.map(q => q[0]))), i1 = gi(Math.max(...cs.map(q => q[0]))), k0 = gi(Math.min(...cs.map(q => q[2]))), k1 = gi(Math.max(...cs.map(q => q[2])));
        const inGate = a => Lc - sOf(a), side = [-1, 1].map(e => [a => e*oOf(a) - cwL(sOf(a)) - RD, a => e*oOf(a) - cwL(sOf(a)) - FK*(FS - sOf(a)) - RD]);
        for (let iz = k0; iz <= k1; iz++) for (let ix = i0; ix <= i1; ix++) { const a = vtx(ix, iz), d = vtx(ix + 1, iz), b = vtx(ix, iz + 1), c = vtx(ix + 1, iz + 1), q = [a, b, c, d];
          if (!q.some(v => v.cut && !v.roof)) continue; const roof = q.some(v => v.roof);   // a cell that also reaches under the cavern's lid: that lid has the part beyond the gate's face
          for (const v of q) if (!v.cut) seam.add(v);
          for (const t of [[a, b, d], [c, d, b]]) { if (!t.some(v => v.cut)) continue; let poly = t.map(v => v.a); if (roof) poly = clip(poly, inGate);
            for (const [f1, f2] of side) { const pp = clip(clip(poly, f1), f2); if (pp.length >= 3) emit(pp); } } }
        const tg = w.terrain.geometry, TN = tg.attributes.normal, TC = tg.attributes.color;   // and the ground round it lit and coloured as if nothing were cut
        if (TN && TC && TN.setXYZ) { for (const v of seam) { const a = v.a; TN.setXYZ(v.key, a[6], a[7], a[8]); TC.setXYZ(v.key, a[3], a[4], a[5]); } TN.needsUpdate = TC.needsUpdate = true; }
      }
      // the walls: a station wherever the rim crosses an edge of the terrain's triangles, so their tops follow the land exactly
      for (const e of [-1, 1]) { const R3 = s => PW(s - Lc, e*rimAt(s), 0), ss = [];
        for (const [sa, sb] of [[SM, FS], [FS, Lc]]) { const A = R3(sa), B = R3(sb), fa = [(A[0] + S0/2)/st, (A[2] + S0/2)/st], fb = [(B[0] + S0/2)/st, (B[2] + S0/2)/st];
          for (const [u, v] of [[fa[0], fb[0]], [fa[1], fb[1]], [fa[0] + fa[1], fb[0] + fb[1]]]) { if (Math.abs(v - u) < 1e-9) continue; for (let k = Math.ceil(Math.min(u, v)); k <= Math.max(u, v); k++) ss.push(sa + (k - u)/(v - u)*(sb - sa)); }
          const m = Math.ceil((sb - sa)/7); for (let k = 0; k <= m; k++) ss.push(sa + (sb - sa)*k/m); }
        ss.sort((a, b) => a - b); let prev = null;
        for (let i = 0; i < ss.length; i++) { const s = ss[i]; if (i && s - ss[i - 1] < 1e-4) continue;
          const tp = R3(s), yt = w.height0(tp[0], tp[2]), hc = w.height(tp[0], tp[2], true), yb = Math.min(F - 1, hc - 2), has = yt > Math.min(F - 1, hc) + 0.3, col = []; tp[1] = yt;
          for (let r = 0; r <= NV; r++) { if (!has || r === NV) { col.push(tp); continue; } const y = yb + (yt - yb)*r/NV, dd = Math.min(ledge(s, y), RD + (NV - r)*1.3); col.push(PW(s + (i && i < ss.length - 1 && r ? 2.2*n(r*0.07 + y*0.05, s*0.3, 1) : 0) - Lc, e*(footAt(s) + dd), y)); }
          const cur = {col, has};
          if (prev && (prev.has || cur.has)) for (let r = 0; r < NV; r++) { const A = prev.col[r], B = cur.col[r], Cc = cur.col[r + 1], D = prev.col[r + 1]; if (B !== Cc) S.tri(A, B, Cc, outCol); if (A !== D) S.tri(A, Cc, D, outCol); }
          prev = cur; } }
      if (lp.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(lu, 2));
        const rim = new THREE.Mesh(geo, w.terrain.material); rim.receiveShadow = true; g.scene.add(rim); if (C) C.tris = (C.tris || 0) + lp.length/9; }
      // running lights along the canyon floor, on posts at the foot of the walls
      // (posts at the foot of the walls, a lantern on each and a string of bulbs sagging from post to post)
      const last = {}; for (let i = T.im + 2; i < T.i0; i += 2) { const p = P[i], o0 = cwAt(p.s) - 1.7; if (o0 < hb + 2) continue;
        for (const e of [-1, 1]) { const x = p.x + p.lx*o0*e, z = p.z + p.lz*o0*e; if (w.height(x, z, true) > F + 1.2) { last[e] = null; continue; }
          S.beam([x, F - 0.5, z], [x, F + 7, z], 0.3, jit(TIMBER)); S.beam([x - p.dx*0.9, F + 6.4, z - p.dz*0.9], [x + p.dx*0.9, F + 6.4, z + p.dz*0.9], 0.16, jit(TIMBER)); fit.lantern([x, F + 7.95, z], {s:2.2, yaw:Math.atan2(p.dx, p.dz)});
          const q = [x, F + 6.4, z]; if (last[e]) fit.festoon(last[e], q, {sag:2.1, every:2.4, r:0.3, wr:0.06}); last[e] = q; } } }
    const wall = (a, x, z) => { if (a.s < SM || a.s > Lc + 2 || Math.abs(a.x) < footAt(a.s) || Math.abs(a.x) > outer(a.s)) return null; const y = w.height0(x, z); return y > F + 1.5 ? y : null; };
    g.scene.add(S.mesh()); if (C) C.tris = (C.tris || 0) + S.tris;
    g.scene.add(fit.build(new THREE.Group())); if (C) C.tris = (C.tris || 0) + fit.tris;
    { const q = PW(-14, 0, F + 40), lt = new THREE.PointLight(0xffb070, 0.8, 260, 1.4); lt.position.set(q[0], q[1], q[2]); g.scene.add(lt); }   // the door glows down the canyon
    return {T, lidY, W, wall, cwAt, seen:null, t:-99, name:td.name};
  },
  /* inside the cavern: below the ceiling is air, above it is mesa */
  cavernHit(g){
    const C = this.cavern; if (!C) return;
    for (const p of g.planes) {
      if (!p.alive || p.frozen) continue;
      const dx = p.pos.x - C.x, dz = p.pos.z - C.z, lx = dx*C.ax[0] + dz*C.ax[1], lz = -dx*C.ax[1] + dz*C.ax[0], u = Math.hypot(lx/C.rx, lz/C.rz); let top;
      if (C.solid) { top = C.solid(lx, lz, p.pos.y, p.pos.x, p.pos.z); if (top === null) continue; }   // a rock cavern knows its own walls, roof and pillars
      else { if (u >= 1) continue;
        const cy = C.ceil(u); top = Math.max(g.world.height0(p.pos.x, p.pos.z), cy + 8);
        if (p.pos.y < cy - 2 || p.pos.y > top + 1) continue; }
      if (p.isPlayer) { if (!g.done) p.destroy(null, 'crash'); } else p.pos.y = top + 4;
    }
  },

  /* ---------- stunt scoring ---------- */
  award(pts, label, cont){
    const sc = this.sc, now = this.g.t;
    if (now - sc.last > 5 && sc.chain > 0) this.bank();
    if (!cont) sc.mult = now - sc.last < 5 && sc.chain > 0 ? Math.min(4, sc.mult + 0.25) : 1;
    const got = pts*sc.mult; sc.chain += got; sc.last = now; sc.label = label;
    if (this.job && this.job.onPoints) this.job.onPoints(got, label);
  },
  bank(){
    const sc = this.sc, S = G.save.open, pts = Math.round(sc.chain); if (pts <= 0) return;
    sc.session += pts; S.stuntTotal += pts; if (pts > S.stuntBest) S.stuntBest = pts;
    if (pts >= 600) G.HUD.toast(`Stunt chain +${pts.toLocaleString()}`);
    sc.chain = 0; sc.mult = 1;
    for (const [at, id, give] of [[10000, 'barnstormer', {livery:'barnstormer'}], [25000, 'nitro', G.hasMod('nitro') ? {cash:5000} : {mod:'nitro'}], [60000, 'goldleaf', {livery:'goldleaf', cash:10000}]]) {
      if (S.stuntTotal >= at && !S.milestones.includes(id)) { S.milestones.push(id); const txt = this.grant(give); G.HUD.radio(G.RADIO.short, `${at.toLocaleString()} stunt points all told! The newsreels are calling. You\'ve earned ${txt}.`); }
    }
    G.persist();
  },
  scoring(g, dt){
    const P = g.player, sc = this.sc; if (!P.alive || P.onGround || P.frozen) { sc.cont = 0; return; }
    const agl = P.pos.y - this.ground(P.pos.x, P.pos.z), mph = P.speed/MPH;
    sc.cont -= dt;
    if (sc.cont <= 0) {
      sc.cont = 0;
      if (agl < 18 && mph > 125 && !g.runwayAt(P.pos)) { this.award(55, 'HEDGE-HOPPING', true); sc.cont = 0.5; }
      else if (P.up.y < -0.65 && !P.man) { this.award(40, 'INVERTED', true); sc.cont = 0.5; }
      else if (Math.abs(P.right.y) > 0.85 && agl < 150 && !P.man) { this.award(15, 'KNIFE-EDGE', true); sc.cont = 0.5; }   // as it first was, worth less than inverted
    }
    // under a bridge
    for (const A of this.arches) {
      const rel = tA.copy(P.pos).sub(A.pos); if (A.yaw) rel.applyAxisAngle(UP, -A.yaw); const along = rel.z;
      if (A.prev !== undefined && Math.sign(along) !== Math.sign(A.prev) && Math.abs(rel.x) < A.len/2 - 4 && P.pos.y < A.deck - 3 && g.t - A.t > 6) {
        A.t = g.t; this.award(A.bonus || 1200, A.label || 'UNDER THE BRIDGE'); if (g.audio) g.audio.ding();
        if (this.job && this.job.onUnder) this.job.onUnder(A);
      }
      A.prev = along;
    }
    if (this.sc.chain > 0 && g.t - this.sc.last > 5) this.bank();
  },
  onStunt(g, kind){
    const pts = {roll:150, immel:300, splits:300, snap:250}[kind] || 100;
    this.award(pts, {roll:'BARREL ROLL', immel:'IMMELMANN', splits:'SPLIT-S', snap:'SNAP TURN'}[kind] || 'STUNT');
    if (this.job && this.job.onStunt) this.job.onStunt(kind);
  },

  /* ---------- skyhooks and fields ---------- */
  hooks(g, dt){
    const P = g.player;
    for (const s of this.towers) {
      const S0 = tA.copy(P.pos).addScaledVector(P.up, 1.6), rel = tB.copy(S0).sub(s.hook), along = rel.dot(s.n), lat = rel.addScaledVector(s.n, -along).length();
      if (s.prevAlong !== undefined && Math.sign(along) !== Math.sign(s.prevAlong) && lat < 10 && s.cool <= 0) {
        const top = G.hookTop(P), catchR = s.ringR*(G.hasMod('winch') ? 1.25 : 0.95);
        if (lat < catchR && P.speed <= top) { this.hooked(s, Math.sign(P.vel.dot(s.n)) || 1); s.prevAlong = undefined; return; }
        if (P.speed > top) { this.award(1500, 'THREAD THE NEEDLE'); if (g.audio) g.audio.ding(); s.cool = 3; }
      }
      s.prevAlong = along;
      const d = P.pos.distanceTo(s.hook);
      if (d < 700 && (!this.job || !this.job.hideSites)) g.markers.push({pos:s.hook, label:`SKYHOOK${P.speed <= G.hookTop(P) ? ' · speed ✓' : ` · slow to ${Math.round(G.hookTop(P)/MPH)} mph`}`, col:P.speed <= G.hookTop(P) ? '#9ef0a0' : '#f2c14e', noDist:true});
    }
  },
  hooked(site, dir){
    const g = this.g, P = g.player; P.frozen = true; P.fire = P.fireRk = false; g.running = false; this.hangSite = site; site.cool = 6;
    const face = site.n.clone().multiplyScalar(dir), hold = () => { P.pos.copy(site.hook).add(tA.set(0, -1.6, 0)); P.q.setFromUnitVectors(Z, face); P.sync(); };
    this.hangFace = face; hold();
    g.cine = (dt, cam) => { hold(); cam.position.lerp(tB.copy(site.hook).addScaledVector(face, -40).add(tA.set(18, 6, 0)), 0.05); cam.lookAt(P.pos); };
    G.HUD.toast('Hooked!'); if (g.audio) g.audio.hitMe(true);
    if (this.job && this.job.onHooked) { this.job.onHooked(site); const r = this.job.update(0); if (r) this.finishJob(r); }
    setTimeout(() => { if (G.game === g && !g.done) this.meet(site); }, 1200);
  },
  release(){
    const g = this.g, P = g.player, site = this.hangSite; if (!site) return; this.hangSite = null;
    g.cine = null; g.running = true; P.frozen = false; P.speed = 52; P.throttle = 0.9;
    P.q.setFromUnitVectors(Z, this.hangFace).multiply(new Q().setFromAxisAngle(new V3(1, 0, 0), 0.12)); P.axes(); P.vel.copy(P.fwd).multiplyScalar(P.speed);
    const f = P.fwd; g.aimYaw = Math.atan2(f.x, f.z); g.aimPitch = -0.05; site.cool = 4;
  },
  arrivals(g){
    const P = g.player; if (!P.onGround || P.speed > 3) return;
    for (const s of this.sites) if (s.kind === 'strip' && s.contact && s.armed && P.pos.distanceTo(s.apron) < 30) { s.armed = false; this.meet(s); return; }
  },
  meet(site){
    const g = this.g; if (g.done) return;
    this.bank(); g.paused = true; this.atSite = site;
    if (g.sea && !G.CONTACTS[site.contact].local) g.sea.settle();
    const C0 = G.CONTACTS[site.contact], P = g.player;
    if (C0.local && P.alive) { P.internal = P.internalMax; P.armor = P.armorMax.slice(); for (const gn of P.guns) { gn.rounds = gn.def.ammo; P.spent.ammo[gn.i] = 1; } P.rockets = P.L.hp*3; P.spent.rockets = P.rockets; if (P.L.nitro || P.st.rocket) P.nitroLeft = P.st.rocket ? 6 : 3; this.patched = true; } else this.patched = false;
    if (G.audio.ctx) G.audio.ctx.suspend();
    const C = G.CONTACTS[site.contact]; if (this.night && C.club) G.music.club(); else G.music.play(C.music || 'sidewalk');
    G.UI.contact(this, site);
  },
  leave(){
    const g = this.g, site = this.atSite; this.atSite = null; g.paused = false;
    if (G.audio.ctx) G.audio.ctx.resume();
    if (this.job && this.job.music) G.music.mission(this.time); else G.music.stop(2.5);
    if (site && site.kind === 'hook') this.release();
    if (this.pending) { const d = this.pending; this.pending = null; this.startJob(d, site); }
  },

  /* ---------- what a contact offers ---------- */
  offer(site){
    const S = G.save.open, cid = site.contact, C = G.CONTACTS[cid], night = this.night, rep = G.JOBS.filter(j => j.contact === cid).reduce((n, j) => n + ((S.jobs[j.id] || {}).done ? 1 : 0), 0);
    const jobs = G.JOBS.filter(j => j.contact === cid && G.jobOpen(j)).map(j => {
      const rec = S.jobs[j.id] || {};
      let lock = null;
      if (j.needs && this.g.player.L.chassis !== j.needs) lock = `Come back in the ${G.CHASSIS[j.needs].name}`;
      else if (j.night && !night) lock = 'After dark';
      else if (j.rep && rep < j.rep) lock = `Do ${j.rep} job${j.rep > 1 ? 's' : ''} for ${C.name.split(' ')[0].replace(/"/g, '')} first`;
      else if (this.job) lock = 'Finish your current job first';
      return {def:j, rec, lock};
    });
    const shop = C.shop.map(it => {
      if (it.mod) { const M = G.MODS[it.mod]; return {kind:'mod', id:it.mod, name:M.name, desc:M.desc, price:it.price || M.price, owned:G.hasMod(it.mod)}; }
      const Ch = G.CHASSIS[it.chassis]; return {kind:'chassis', id:it.chassis, name:Ch.name, desc:`${Ch.role}. Speed ${Ch.speed}, agility ${Ch.agility}, ${Ch.slots} gun positions${Ch.turrets.length ? ', tail gunner' : ''}.`, price:it.price, owned:G.save.owned.includes(it.chassis)};
    });
    let rumors = this.R.treasures.filter(t => !S.found[t.id]).map(t => t.hint);
    if (C.local) { const h = [...cid].reduce((a, c) => a + c.charCodeAt(0), 0); rumors = rumors.filter((_, i) => (i + h) % 2 === 0).slice(0, 1 + h % 2); if (!rumors.length) rumors = [G.pick(C.gossip)]; }
    return {C, site, jobs, shop, rumors, hello:G.pick(C.hello), gossip:C.gossip ? G.pick(C.gossip) : null};
  },
  buy(kind, id, price){
    const S = G.save; if (S.cash < price) return false;
    if (kind === 'mod' && !G.hasMod(id)) { S.cash -= price; S.mods.push(id); }
    else if (kind === 'chassis' && !S.owned.includes(id)) { S.cash -= price; S.owned.push(id); }
    else return false;
    G.persist(); return true;
  },
  /* the job board: every open job in the region, whoever is offering it, takeable from any stop */
  board(site){
    return this.R.sites.filter(s => s.contact && !G.CONTACTS[s.contact].local && (!site || s.contact !== site.contact))
      .flatMap(s => this.offer(s).jobs.map(j => Object.assign(j, {at:s, C:G.CONTACTS[s.contact]})));
  },
  accept(id){ const d = JOB(id); if (!d || this.job || (d.needs && this.g.player.L.chassis !== d.needs)) return; this.pending = d; },
  acceptDuel(cid){ const a = G.aceFor(cid); if (!a || this.job) return; this.pending = {id:'duel_' + a.id, contact:cid, type:'duel', title:`Duel: ${a.name}`, pay:a.purse, ace:a, go:a.line}; },
  grant(rw){
    if (!rw) return ''; const S = G.save, out = [];
    if (rw.cash) { S.cash += rw.cash; this.earned += rw.cash; out.push(`$${rw.cash.toLocaleString()}`); }
    if (rw.mod) { if (!S.mods.includes(rw.mod)) { S.mods.push(rw.mod); out.push(G.MODS[rw.mod].name); } else { S.cash += 2500; this.earned += 2500; out.push('$2,500'); } }
    if (rw.livery && !S.liveries.includes(rw.livery)) { S.liveries.push(rw.livery); out.push(`the ${G.LIVERIES[rw.livery].name} paint job`); }
    if (rw.chassis) { if (!S.owned.includes(rw.chassis)) { S.owned.push(rw.chassis); out.push(`a ${G.CHASSIS[rw.chassis].name}`); } else { S.cash += 4000; this.earned += 4000; out.push('$4,000'); } }
    G.persist(); return out.join(' and ');
  },

  /* ---------- jobs ---------- */
  startJob(def, site){
    const g = this.g, eng = ENG[def.type]; if (!eng) return;
    this.job = eng(this, def, site); this.job.def = def; this.job.t0 = g.t;
    // treasure hunts keep the treasure tune; every other job gets day swing or night jazz
    this.job.music = true; if (def.type === 'errand' && def.legs.some(l => l.riddle)) G.music.play('caravan'); else G.music.mission(this.time);
    G.HUD.banner(def.title, {race:'Race', stunt:'Stunt show', errand:def.cargo || 'Delivery', bounty:'Bounty'}[def.type]); setTimeout(() => G.HUD.banner(null), 2600);
    if (def.go) G.HUD.radio(G.CONTACTS[def.contact].name.replace(/".*" /, '').split(' ').slice(-1)[0], def.go);
  },
  finishJob(res){
    const g = this.g, job = this.job, def = job.def, S = G.save.open; this.job = null;
    if (job.cleanup) job.cleanup();
    const rec = S.jobs[def.id] || (S.jobs[def.id] = {done:0});
    const who = G.CONTACTS[def.contact].name.replace(/".*" /, '').split(' ').slice(-1)[0];
    if (res.win) {
      const first = !rec.done, pay = Math.round(def.pay*(res.payMul ?? 1)*(res.medal === 'gold' ? 1.3 : res.medal === 'silver' ? 1.1 : 1));
      rec.done++; if (res.time !== undefined && (rec.best === undefined || res.time < rec.best)) rec.best = res.time;
      if (res.medal && (MEDAL[res.medal] || 0) > (MEDAL[rec.medal] || 0)) rec.medal = res.medal;
      G.save.cash += pay; this.earned += pay; this.jobsDone++;
      let extra = '';
      if (def.reward && first && (!def.reward.goldOnly || res.medal === 'gold')) extra = this.grant(def.reward);
      G.HUD.banner(res.medal ? `${res.medal[0].toUpperCase() + res.medal.slice(1)} · ${def.title}` : 'Job done', `$${pay.toLocaleString()}${extra ? ' · ' + extra : ''}`); setTimeout(() => G.HUD.banner(null), 4500);
      if (res.say) G.HUD.radio(who, res.say);
      if (g.audio) g.audio.ding();
      G.music.play('swingin'); setTimeout(() => { if (!this.job && !this.atSite) G.music.stop(4); }, 24000);
    } else {
      G.HUD.banner('Job failed', res.note || ''); setTimeout(() => G.HUD.banner(null), 4000);
      if (res.say) G.HUD.radio(who, res.say);
      G.music.play('fail'); setTimeout(() => { if (!this.job && !this.atSite) G.music.stop(3); }, 11000);
    }
    G.persist(); g.markers = []; this.holdOnGround = false;
  },
  abandon(){ if (this.job) this.finishJob({win:false, note:'Abandoned', say:'Changed your mind? Suit yourself.'}); },

  /* ---------- treasure ---------- */
  treasureCheck(g, dt){
    const P = g.player, S = G.save.open;
    for (const T of this.treasures) {
      if (T.got) continue;
      const d = P.pos.distanceTo(T.pos);
      if (T.def.race) {
        if (this.job) continue;
        if (d < 2500) g.markers.push({pos:T.start, label:`${T.def.name.toUpperCase()} · TIME TRIAL`, col:'#f2c14e', noDist:d > 1500});
        const rel = tA.copy(P.pos).sub(T.start), along = rel.z, lat = Math.hypot(rel.x, rel.y);
        if (T.prev !== undefined && Math.sign(along) !== Math.sign(T.prev) && lat < 18) { T.prev = undefined; this.startTrial(T); continue; }
        T.prev = along; continue;
      }
      if (d < 3000 && Math.random() < dt*3) g.fx.fire.emit(T.pos.x + (Math.random() - 0.5)*3, T.pos.y + 2 + Math.random()*3, T.pos.z + (Math.random() - 0.5)*3, 0, 6, 0, 3.4, 0.7, 1, 0.85, 0.35, 1, 0, 1, 1);
      if (d < 45) {
        T.got = true; S.found[T.def.id] = {t:Date.now()}; this.foundNow++;
        g.scene.remove(T.obj); const txt = this.grant(T.def.reward);
        G.HUD.banner('Treasure!', `${T.def.name} · ${txt}`); setTimeout(() => G.HUD.banner(null), 4500);
        if (g.audio) g.audio.ding(); G.music.play('caravan'); setTimeout(() => { if (!this.job && !this.atSite) G.music.stop(4); }, 20000);
        G.HUD.radio(G.RADIO.short, `${T.def.name}! ${txt[0].toUpperCase() + txt.slice(1)}. I\'ll put it in the log.`);
        G.persist();
      }
    }
  },
  startTrial(T){
    const def = {id:'trial_' + T.def.id, contact:null, type:'race', title:T.def.name, pay:0, rivals:0, laps:1, low:T.def.race.low, course:{circuit:T.def.race.circuit}, treasure:T};
    this.job = ENG.race(this, def); this.job.def = def; this.job.t0 = this.g.t; this.job.begin(); this.job.k = 0; this.job.music = true; G.music.mission(this.time);
    G.HUD.banner(T.def.name, 'Time trial · the clock is running'); setTimeout(() => G.HUD.banner(null), 2200);
  },

  /* ---------- bandits ---------- */
  encounters(g, dt){
    if (this.job || this.atSite || g.player.onGround) return;
    if (this.bandits.some(p => p.alive)) return;
    this.encT -= dt; if (this.encT > 0) return;
    this.encT = 200 + Math.random()*140;
    if (Math.random() > this.R.danger*(this.night ? 1.4 : 1)) return;
    const P = g.player, n = 2 + (Math.random() < 0.4 ? 1 : 0), at = P.pos.clone().addScaledVector(P.fwd, 1900).add(new V3((Math.random() - 0.5)*800, 120, (Math.random() - 0.5)*800));
    at.y = Math.max(at.y, this.ground(at.x, at.z) + 200);
    this.bandits = this.gang(this.R.gang, at, n, {skill:0.4});
    G.HUD.radio(G.RADIO.short, `${GANGS[this.R.gang].name} on the scope, ${n} of them, dead ahead! The Margaret pays $150 a head.`);
  },
  gang(id, at, n, o = {}){
    const g = this.g, Gg = GANGS[id] || GANGS.tigers, made = [], used = {}; n = G.squadN(g, n);
    for (let i = 0; i < n; i++) {
      const paint = Gg.paints[i % Gg.paints.length], L = o.chassis ? G.stockLoadout(o.chassis) : G.gangLoadout(id, i, n, used, paint); L.paint = paint.slice(); if (o.chassis) L.rocket = Math.random() < 0.5 ? 'he' : 'flak';
      const nm = G.name1920s(), pos = at.clone().add(new V3((i - (n - 1)/2)*50, (Math.random() - 0.5)*50, (Math.random() - 0.5)*40));
      const q = new Q().setFromUnitVectors(Z, tA.copy(g.player.pos).sub(pos).setY(0).normalize());
      const p = g.addPlane({loadout:L, team:1, name:nm.full, callsign:nm.short, pos, q, speed:90, ai:{role:'fighter', skill:(o.skill ?? 0.4) + Math.random()*0.25}});
      made.push(p);
    }
    return made;
  },
  removePlane(p){ const g = this.g; p.alive = false; g.scene.remove(p.obj); g.planes = g.planes.filter(x => x !== p); g.pilots = g.pilots.filter(pl => pl.p !== p); },

  /* ---------- events ---------- */
  onKill(g, plane){
    if (plane.team !== 0 && !(plane.bountyJob)) { G.save.cash += this.pay.kill; this.earned += this.pay.kill; }
    if (this.job && this.job.onKill) this.job.onKill(plane);
  },
  onShipDown(g, ship){
    if (ship === this.ship) { if (!this.ended) { this.ended = true; G.HUD.radio(G.CAPTAIN.short, 'She\'s going down! Abandon ship!'); g.end(this.result(g, 'fail', 'margaret')); } return; }
    if (this.job && this.job.onShipDown) this.job.onShipDown(ship);
  },
  onShipSurrender(g, ship){ if (this.job && this.job.onShipDown) this.job.onShipDown(ship); },
  onShipCaptured(g, ship){ if (this.job && this.job.onShipDown) this.job.onShipDown(ship); },
  onShipRun(){},
  onShipHit(){},
  onTouchdown(g, hard){ if (this.job && this.job.onTouchdown) this.job.onTouchdown(hard); },
  onDeck(g, ship, hard){ if (this.job && this.job.onDeck) this.job.onDeck(ship, hard); },
  onSeaShipDown(g, ship){ if (this.job && this.job.onSeaShipDown) this.job.onSeaShipDown(ship); },
  onInvulnHit(){},
  playerDown(g){
    if (this.ended) return; this.ended = true; this.sc.chain = 0;
    if (this.job) { const j = this.job; this.job = null; if (j.cleanup) j.cleanup(); }
    G.HUD.radio(G.RADIO.short, `${g.player.callsign}! We see a chute. Hang on, we\'re coming round.`);
    g.end(this.result(g, 'fail', 'down'));
  },
  /* redocked on the Margaret: settle the flight quietly and go to the hangar */
  redock(){ if (this.ended) return null; this.ended = true; this.bank(); const r = this.result(this.g, 'success'); this.g.done = true; return r; },
  finish(){ if (this.ended) return; this.ended = true; this.bank(); if (this.job) this.abandon(); this.g.end(Object.assign(this.result(this.g, 'success'), {delay:200})); },
  result(g, kind, why){
    const R = this.R, S = G.save.open, repair = kind === 'fail' && why === 'down' ? Math.min(400, G.save.cash) : 0;
    G.save.cash -= repair; G.advanceHours(2);
    const found = R.treasures.filter(t => S.found[t.id]).length;
    const sides = [
      {text:'Jobs done', st:this.jobsDone ? 'ok' : 'fail', val:String(this.jobsDone)},
      {text:'Treasure found this flight', st:this.foundNow ? 'ok' : 'fail', val:`${this.foundNow} · ${found}/${R.treasures.length} in ${R.name}`},
      {text:'Stunt points', st:this.sc.session ? 'ok' : 'fail', val:Math.round(this.sc.session).toLocaleString()},
      {text:'Earned', st:this.earned ? 'ok' : 'fail', val:'$' + this.earned.toLocaleString()}
    ];
    const say = kind === 'fail' ? (why === 'margaret' ? 'The Margaret took a beating and limped home. Next time, sugar, keep the bandits off her.' : `We fished you out. Thorne says the repair bill is $${repair}, and he\'s taking it out of the kitty.`)
      : this.earned > 8000 ? 'Now that\'s what I call a working holiday. The kitty\'s fat and the crew\'s happy.' : this.earned > 0 ? 'Good flying. Every dollar keeps the old girl in the air.' : 'A nice quiet flight. Thorne says the scenery doesn\'t pay for gas, though.';
    return {kind:kind === 'fail' ? 'fail' : 'success', open:true, cash:0, shown:this.earned - repair, kills:g.kills, shipPct:Math.round(this.ship.hp/this.ship.hpMax*100), sides, mood:kind === 'fail' ? 'angry' : this.earned > 0 ? 'pleased' : 'stern', say,
      then:`The Lucky Margaret is holding over ${R.name}. ${G.timeLabel()}.`};
  },
  sideState(){ return []; }
});

/* =====================================================================
   Job engines. Each returns {update(dt) -> result or undefined, objective(), sides(), cleanup(), event hooks}.
   ===================================================================== */
const ENG = {};
function pointOf(O, ref){ if (Array.isArray(ref)) return new V3(ref[0], O.ground(ref[0], ref[1], true), ref[1]); return O.P[ref] ? O.P[ref].clone() : null; }
function groundMax(O, x, z, rad = 60){ let h = O.ground(x, z); for (const [a, b] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) h = Math.max(h, O.ground(x + a, z + b)); return h; }
function through(r, p, slack = 0){
  const rel = tA.copy(p.pos).sub(r.pos), along = rel.dot(r.n), lat = rel.addScaledVector(r.n, -along).length(), prev = r.prev.get(p);
  r.prev.set(p, along); return prev !== undefined && Math.sign(prev) !== Math.sign(along) && Math.abs(along - prev) < 80 && lat < r.R + slack;
}
/* ring centres for a course: a wobbly circuit round a place, or a path through places with rings every ~550 m */
function coursePoints(O, spec){
  const pts = [];
  if (spec.circuit) {
    const c = spec.circuit, at = pointOf(O, c.at), n = c.n || 8;
    for (let i = 0; i < n; i++) { const a = i/n*Math.PI*2, r = c.r*(1 + 0.22*Math.sin(a*3 + 1.3)); const x = at.x + Math.sin(a)*r, z = at.z + Math.cos(a)*r; pts.push(new V3(x, groundMax(O, x, z) + (c.agl || 60), z)); }
    return {pts, loop:true};
  }
  const ids = spec.path.map(id => pointOf(O, id)).filter(Boolean);
  for (let i = 0; i < ids.length - 1; i++) {
    const a = ids[i], b = ids[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), k = Math.max(1, Math.round(L/550));
    for (let j = 0; j < k; j++) { const t = j/k, x = a.x + (b.x - a.x)*t, z = a.z + (b.z - a.z)*t; pts.push(new V3(x, groundMax(O, x, z) + (spec.agl || 80), z)); }
    // a viaduct on the way: the ring hangs in its middle arch, square to the bridge (rivals go over the top)
    const A = O.arches.find(q => q.id && q.id === spec.path[i] && q.under !== undefined), q0 = pts[pts.length - k];
    if (A) { q0.y = A.under; q0.n = new V3(Math.sin(A.yaw), 0, Math.cos(A.yaw)); q0.over = A.rail + 24; }
  }
  const e = ids[ids.length - 1]; pts.push(new V3(e.x, groundMax(O, e.x, e.z) + (spec.agl || 80), e.z));
  const loop = ids.length > 2 && ids[0].distanceTo(e) < 50; if (loop) pts.pop();
  return {pts, loop};
}

/* ---------- RACE ---------- */
ENG.race = (O, def) => {
  const g = O.g, P = g.player, C = coursePoints(O, def.course), pts = C.pts, nR = pts.length, laps = def.laps || 1;
  // if the course isn't a loop the last ring is the finish; a loop finishes back through the start ring
  const seq = []; for (let l = 0; l < laps; l++) for (let i = 0; i < nR; i++) seq.push(i); if (C.loop) seq.push(0);
  const rings = pts.map((p, i) => {
    const nx = pts[(i + 1) % nR], pv = pts[(i - 1 + nR) % nR], n = (C.loop || (i > 0 && i < nR - 1)) ? tB.copy(nx).sub(pv) : i === 0 ? tB.copy(pts[1]).sub(p) : tB.copy(p).sub(pts[i - 1]);
    n.y = 0; n.normalize(); if (p.n) n.copy(p.n).multiplyScalar(n.dot(p.n) < 0 ? -1 : 1);
    const boost = i % 3 === 2, m = ringMesh(12, i === 0 ? 'start' : boost ? 'boost' : 'check');
    m.position.copy(p); m.rotation.y = Math.atan2(n.x, n.z); g.scene.add(m);
    return {pos:p, n:n.clone(), R:12, boost, m, prev:new Map(), used:new Set()};
  });
  let len = 0; for (let k = 1; k < seq.length; k++) len += pts[seq[k]].distanceTo(pts[seq[k - 1]]);
  // the stock Gallant tops out at 210 mph, so gold (a 228 mph average) usually takes an upgraded or faster plane; silver is a clean Gallant run
  const par = def.par || 1, gold = len/(228*MPH)*par, silver = len/(192*MPH)*par, bronze = len/(168*MPH)*par;
  const J = {low:def.low, k:0, t:0, started:false, rivals:[], len, hideSites:true};
  J.begin = () => {
    J.started = true; J.k = 1; J.t = 0; if (g.audio) g.audio.ding();
    if (def.rivals) {
      const first = rings[seq[0]], back = first.pos.clone().addScaledVector(first.n, -120);
      for (let i = 0; i < def.rivals; i++) {
        const L = G.stockLoadout(i === 2 ? 'sparrowhawk' : 'gallant'); L.paint = [[0xf1e9d6, 0x2f5d8a, 0xc0392b], [0x2b2b2b, 0xe0742a, 0xf2c14e], [0x5a2a4a, 0xf1e9d6, 0x6fb0d9]][i % 3]; L.hp = 0;
        const nm = G.name1920s({nick:true}), pos = back.clone().add(new V3((i - (def.rivals - 1)/2)*40, 10 + i*6, 0));
        const p = g.addPlane({loadout:L, team:1, name:nm.full, callsign:nm.short, pos, q:new Q().setFromUnitVectors(Z, first.n), speed:Math.max(60, P.speed), ai:{role:'fighter', skill:0.75}, grace:3});
        p.invuln = true; const pl = g.pilots[g.pilots.length - 1];
        pl.route = seq.slice(1).map(ix => ({x:pts[ix].x, z:pts[ix].z, y:pts[ix].over ?? pts[ix].y, r:26})); pl.wp = 0; pl.raceThrottle = 0.92 + 0.03*i; pl.raceDone = false;
        pl.onWaypoint = k => { if (k >= pl.route.length && !pl.raceDone) { pl.raceDone = true; pl.finishT = J.t; } };
        J.rivals.push({p, pl});
      }
      G.HUD.radio(G.RADIO.short, `They\'re off! ${J.rivals.map(r => r.p.callsign).join(', ')} on your tail.`);
    }
  };
  J.place = () => {
    if (!J.rivals.length) return 1;
    const mine = J.k + (J.k < seq.length ? 1 - Math.min(1, P.pos.distanceTo(pts[seq[J.k]])/600) : 0);
    return 1 + J.rivals.filter(r => r.pl.raceDone ? !J.fin || r.pl.finishT < J.finT : (r.pl.wp + 1 + (1 - Math.min(1, r.p.pos.distanceTo(pts[seq[Math.min(seq.length - 1, r.pl.wp + 1)]])/600))) > mine).length;
  };
  J.update = dt => {
    // each ring is tested once a frame for the player; boost rings also work for the rivals
    const crossed = new Set();
    for (const r of rings) {
      if (through(r, P, 2)) { crossed.add(r); if (r.boost) { P.nitro = 4; G.HUD.toast('Boost!'); if (g.audio) g.audio.rocket(0.5); } }
      if (r.boost) for (const x of J.rivals) if (x.p.alive && through(r, x.p, 12)) x.p.nitro = 4;
    }
    if (!J.started) {
      const r0 = rings[seq[0]]; g.markers.push({pos:r0.pos, label:`${def.title.toUpperCase()} · START`, col:'#f2c14e'});
      if (crossed.has(r0)) J.begin();
      return;
    }
    J.t += dt;
    const r = rings[seq[J.k]];
    if (r && crossed.has(r)) { J.k++; if (g.audio) g.audio.ding(); }
    if (J.k >= seq.length) {
      J.fin = true; J.finT = J.t; const place = J.place(), t = J.t;
      const medal = t <= gold ? 'gold' : t <= silver ? 'silver' : t <= bronze ? 'bronze' : null;
      const win = J.rivals.length ? place === 1 : !!medal;
      if (def.treasure) return O.trialDone(def, win, medal, t);
      return win ? {win:true, time:t, medal, say:place === 1 && J.rivals.length ? `First across the line in ${fmt(t)}! Collect your purse.` : `${fmt(t)}. ${medal ? medal[0].toUpperCase() + medal.slice(1) + ' time!' : ''}`}
                 : {win:false, note:J.rivals.length ? `Finished ${['', '1st', '2nd', '3rd', '4th'][place]}` : `Too slow: ${fmt(t)}`, say:J.rivals.length ? 'Second place pays nothing out here, flyer.' : 'The clock beat you. Try again.'};
    }
    const nx = pts[seq[J.k]], after = seq[J.k + 1] !== undefined ? pts[seq[J.k + 1]] : null;
    g.markers.push({pos:nx, label:J.k === seq.length - 1 ? 'FINISH' : rings[seq[J.k]].boost ? 'NEXT · BOOST' : 'NEXT', col:'#9ef0a0'});
    if (after) g.markers.push({pos:after, label:'', col:'rgba(158,240,160,.45)', noDist:true});
    if (J.t > bronze*2.2) return def.treasure ? O.trialDone(def, false, null, J.t) : {win:false, note:'Out of time', say:'We\'ll be here all night. Race called off.'};
  };
  J.objective = () => J.started ? `${def.title} · ring ${Math.min(J.k, seq.length)}/${seq.length - 1} · ${fmt(J.t)}${J.rivals.length ? ` · ${['', '1st', '2nd', '3rd', '4th'][J.place()]}` : ` · gold ${fmt(gold)}`}`
                                : `${def.title}: fly through the start ring to begin`;
  J.sides = () => [{text:`Gold ${fmt(gold)} · silver ${fmt(silver)} · bronze ${fmt(bronze)}`, st:'live', val:J.started ? fmt(J.t) : ''}];
  J.cleanup = () => { for (const r of rings) g.scene.remove(r.m); for (const r of J.rivals) O.removePlane(r.p); };
  return J;
};
OPEN.trialDone = function(def, win, medal, t){
  const T = def.treasure, S = G.save.open, key = 'trial_' + T.def.id, best = G.save.times[key];
  if (win && (best === undefined || t < best)) G.save.times[key] = t;
  if (win && !S.found[T.def.id]) { S.found[T.def.id] = {t:Date.now(), medal}; this.foundNow++; const txt = this.grant(T.def.reward); G.HUD.radio(G.RADIO.short, `${fmt(t)}, ${medal} time! That\'s the ${T.def.name} cracked: ${txt}.`); }
  return win ? {win:true, time:t, medal, say:`${fmt(t)}. ${medal[0].toUpperCase() + medal.slice(1)}!${best !== undefined && t < best ? ' A new best.' : ''}`} : {win:false, note:`${fmt(t)}: no medal`};
};
// time trials aren't contact jobs: settle them without the contact bookkeeping
const finishJob0 = OPEN.finishJob;
OPEN.finishJob = function(res){
  if (this.job && this.job.def.treasure) {
    const job = this.job; this.job = null; if (job.cleanup) job.cleanup();
    G.HUD.banner(res.win ? `${res.medal[0].toUpperCase() + res.medal.slice(1)} · ${job.def.title}` : 'No medal', res.win ? fmt(res.time) : res.note || ''); setTimeout(() => G.HUD.banner(null), 4000);
    if (res.say) G.HUD.radio(G.RADIO.short, res.say); if (this.g.audio && res.win) this.g.audio.ding();
    G.persist(); this.g.markers = []; return;
  }
  return finishJob0.call(this, res);
};

/* ---------- STUNT SHOW ---------- */
ENG.stunt = (O, def) => {
  const g = O.g, P = g.player, c = pointOf(O, def.at), R = def.r || 800, gates = [];
  for (let i = 0; i < (def.gates || 0); i++) {
    const a = i/(def.gates)*Math.PI*2 + 0.4, x = c.x + Math.sin(a)*R*0.45, z = c.z + Math.cos(a)*R*0.45, y = O.ground(x, z, true), m = G.buildGate(46, 34);
    m.position.set(x, y, z); m.rotation.y = a + Math.PI/2; g.scene.add(m);
    gates.push({pos:new V3(x, y + 17, z), n:new V3(Math.sin(a + Math.PI/2), 0, Math.cos(a + Math.PI/2)), R:20, prev:new Map(), m, t:-99, y});
  }
  const J = {t:0, score:0, low:true, gates};
  const inZone = () => Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < R && P.pos.y - O.ground(P.pos.x, P.pos.z) < 350;
  J.onPoints = pts => { if (inZone()) J.score += pts; };
  J.update = dt => {
    J.t += dt;
    for (const G0 of gates) {
      if (through(G0, P, 2) && P.pos.y > G0.y + 1 && P.pos.y < G0.y + 33 && g.t - G0.t > 6) { G0.t = g.t; O.award(500, 'PYLON GATE'); if (g.audio) g.audio.ding(); }
      if (P.pos.distanceTo(G0.pos) < 1500) g.markers.push({pos:G0.pos, label:'PYLON', col:'#f2c14e', noDist:true});
    }
    g.markers.push({pos:c.clone().setY(c.y + 60), label:inZone() ? 'SHOW BOX · the crowd can see you' : 'SHOW BOX', col:inZone() ? '#9ef0a0' : '#f2c14e', edgeOnly:inZone()});
    if (J.score >= def.target) { const medal = J.t < def.time*0.45 ? 'gold' : J.t < def.time*0.7 ? 'silver' : 'bronze'; return {win:true, medal, say:`${Math.round(J.score).toLocaleString()} points! They\'re on their feet!`}; }
    if (J.t > def.time) return {win:false, note:`${Math.round(J.score).toLocaleString()} of ${def.target.toLocaleString()} points`, say:'The crowd\'s gone home for supper.'};
  };
  J.objective = () => `${def.title}: ${Math.round(J.score).toLocaleString()} / ${def.target.toLocaleString()} points in the show box · ${clock(def.time - J.t)}${inZone() ? '' : ' · get back in front of the crowd'}`;
  J.sides = () => [{text:'Stay inside the show box, under 1,100 ft', st:inZone() ? 'ok' : 'live', val:''}];
  J.cleanup = () => { for (const G0 of gates) g.scene.remove(G0.m); };
  return J;
};

/* ---------- ERRAND: deliveries, airdrops, pickups, tours and treasure-hunt clues ---------- */
ENG.errand = (O, def) => {
  const g = O.g, P = g.player, F = def.fragile || {}, legs = def.legs.map(l => Object.assign({}, l));
  const J = {i:0, t:0, clock:def.time || 0, comfort:100, spotted:0, caught:false, load:0, hp0:P.internal + P.armor.reduce((a, b) => a + b, 0), foesUp:{}, lights:[], hoops:null, music:false};
  const siteOf = id => O.sites.find(s => s.id === id);
  // searchlights between the start and the drop
  if (def.lights) {
    const to = pointOf(O, def.lights.mark), from = P.pos.clone();
    for (let i = 0; i < def.lights.n; i++) {
      const t = 0.3 + 0.6*i/Math.max(1, def.lights.n - 1), side = (i % 2 ? 1 : -1)*(260 + Math.random()*200), dir = tA.copy(to).sub(from).setY(0).normalize();
      const x = from.x + (to.x - from.x)*t + dir.z*side, z = from.z + (to.z - from.z)*t - dir.x*side, y = O.ground(x, z, true);
      const m = buildSearchlight(); m.position.set(x, y, z); g.scene.add(m);
      J.lights.push({m, head:m.userData.head, pos:new V3(x, y + 16, z), base:Math.atan2(from.x - x, from.z - z), ph:Math.random()*6, dir:new V3()});
    }
  }
  const shipOf = l => g.sea ? g.sea.byId(l.ship) : null;
  const legPos = l => l.how === 'deck' ? (shipOf(l) ? shipOf(l).pos : P.pos) : l.site ? (siteOf(l.site).apron || siteOf(l.site).hook || siteOf(l.site).point) : pointOf(O, l.mark || l.around);
  const done = () => {
    const l = legs[J.i]; if (g.audio) g.audio.ding(); if (l.say) G.HUD.radio(def.contact ? G.CONTACTS[def.contact].name.replace(/".*" /, '').split(' ').slice(-1)[0] : G.RADIO.short, l.say);
    J.i++; if (J.hoops) { for (const h of J.hoops) g.scene.remove(h.m); J.hoops = null; }
    const nx = legs[J.i]; if (nx && nx.riddle) setTimeout(() => G.HUD.radio(G.RADIO.short, nx.riddle), 2500);
  };
  if (legs[0].riddle) setTimeout(() => G.HUD.radio(G.RADIO.short, legs[0].riddle), 3000);
  J.onHooked = site => { const l = legs[J.i]; if (l && l.how === 'hook' && l.site === site.id) { J.hookedOk = true; } };
  J.onStunt = () => { if (F.stunts) J.broke = 'You did stunts with the cargo aboard!'; if (F.comfort) J.comfort -= 35; };
  J.onTouchdown = hard => { if (hard && F.hard) J.broke = 'Hard landing. The crate didn\'t survive it.'; };
  J.onDeck = (ship, hard) => { if (hard && F.hard) J.broke = 'You dropped her on the deck like a sack of coal.'; };
  J.update = dt => {
    J.t += dt; if (def.time) J.clock -= dt;
    if (J.broke) return {win:false, note:J.broke, say:'Well, that\'s that.'};
    if (F.damage && P.internal + P.armor.reduce((a, b) => a + b, 0) < J.hp0 - 2) return {win:false, note:'The cargo took a bullet', say:'There\'s a hole in my cargo. And in my profits.'};
    if (def.time && J.clock <= 0) return {win:false, note:'Out of time', say:'Too late. They\'ve given the job to somebody else.'};
    if (F.comfort && !P.onGround) {   // tight turns and hard pulls make the passenger sick
      const turn = J.lastF ? Math.acos(Math.max(-1, Math.min(1, J.lastF.dot(P.fwd))))/Math.max(dt, 1e-3) : 0; J.lastF = (J.lastF || new V3()).copy(P.fwd);
      if (turn > 0.55) J.comfort -= (turn - 0.55)*dt*45;
      if (P.speed > 175*MPH) J.comfort -= dt*4;
      J.comfort = Math.min(100, J.comfort + dt*0.6);
      if (J.comfort <= 0) return {win:false, note:'Your passenger was sick everywhere', say:'They\'ll never fly again. Or tip.'};
    } else if (F.comfort) J.lastF = null;   // parked: the next take-off starts a fresh reading
    // searchlights sweep; get caught for a moment and the fighters come up
    for (const L of J.lights) {
      const yaw = L.base + Math.sin(g.t*0.32 + L.ph)*1.3, pit = 0.32 + 0.22*Math.sin(g.t*0.47 + L.ph*1.7);
      L.head.rotation.y = yaw; L.head.rotation.x = -pit; L.dir.set(Math.sin(yaw)*Math.cos(pit), Math.sin(pit), Math.cos(yaw)*Math.cos(pit));
      const v = tA.copy(P.pos).sub(L.pos), d = v.length();
      if (d < 1150 && v.normalize().dot(L.dir) > 0.9972) J.spotted += dt*70;
    }
    if (J.lights.length) { J.spotted = Math.max(0, J.spotted - dt*12); if (J.spotted >= 100 && !J.caught) { J.caught = true; O.gang('customs', P.pos.clone().add(new V3(900, 250, 900)), 2, {skill:0.55}); G.HUD.radio(G.RADIO.short, 'They\'ve got you in the beam! Customs fighters scrambling. Deliver anyway, but it\'ll cost us.'); } }
    // interceptors
    for (const f of def.foes || []) if (f.leg === J.i && !J.foesUp[J.i] && J.t > 10) { J.foesUp[J.i] = 1; O.gang(f.gang, P.pos.clone().addScaledVector(P.fwd, 1600).add(new V3(0, 180, 0)), f.n, {skill:0.45}); G.HUD.radio(G.RADIO.short, `${GANGS[f.gang].name} coming for the cargo! ${f.n} of them!`); }
    const l = legs[J.i]; if (!l) return J.win();
    const at = legPos(l), dH = Math.hypot(P.pos.x - at.x, P.pos.z - at.z), agl = P.pos.y - O.ground(P.pos.x, P.pos.z);
    const name = l.site ? siteOf(l.site).name : (O.R.marks.find(m => m.id === l.mark) || {}).name || 'the spot';
    // a ship that has taken on something hot shoots at whoever lifted it
    if (def.hot && J.i > 0 && g.sea) for (const id of def.hot) { const H = g.sea.byId(id); if (H && H.alive) H.hostile = g.t + 4; }
    if (l.how === 'land' || l.how === 'pickup') {
      const s = siteOf(l.site), spot = s.apron || s.point, rad = s.apron ? 30 : 75, d = Math.hypot(P.pos.x - spot.x, P.pos.z - spot.z);
      g.markers.push({pos:spot.clone().setY(spot.y + 10), label:P.onGround ? (d < rad ? (P.speed < 3 ? 'HOLD' : 'STOP HERE') : 'TAXI HERE') : `LAND · ${name.toUpperCase()}`, col:'#f2c14e'});
      if (P.onGround && d < rad && P.speed < 3) {
        if (l.how === 'land') { done(); s.armed = true; return legs[J.i] ? undefined : J.win(); }
        O.holdOnGround = true; J.load += dt; if (J.load >= 6) { O.holdOnGround = false; J.load = 0; done(); }
      }
    } else if (l.how === 'deck') {
      // land the Whirligig on a ship's stage and sit tight while they load (or unload) her
      const S = shipOf(l); if (!S || !S.alive) return {win:false, note:S ? `${S.the[0].toUpperCase() + S.the.slice(1)} went down` : 'No ship to meet', say:'There\'s nothing left to land on. That\'s that.'};
      const on = P.deck && P.deck.ship === S; S.marked = true;
      g.markers.push({pos:g.sea.padTop(S, new V3()).setY(S.y + S.pad.y + 7), label:on ? (J.load > 0 ? 'HOLD' : 'ON DECK') : dH < 900 ? `LAND ON HER STAGE · flaps, under ${Math.round(65)} mph` : `${S.name.toUpperCase()}`, col:on ? '#9ef0a0' : '#f2c14e'});
      if (on) { O.holdOnGround = true; J.load += dt; if (J.load >= (l.load || 5)) { O.holdOnGround = false; J.load = 0; S.marked = false; done(); } }
    } else if (l.how === 'hook') {
      g.markers.push({pos:siteOf(l.site).hook, label:`SKYHOOK · ${name.toUpperCase()}`, col:'#f2c14e'});
      if (J.hookedOk) { J.hookedOk = false; done(); }
    } else if (l.how === 'drop') {
      const ok = dH < 90 && agl < 70 && P.speed < 150*MPH;
      g.markers.push({pos:at.clone().setY(at.y + 8), label:dH < 600 ? `DROP ZONE${agl < 70 ? ' · alt ✓' : ' · under 230 ft'}${P.speed < 150*MPH ? ' · speed ✓' : ' · under 150 mph'}` : `DROP · ${name.toUpperCase()}`, col:ok ? '#9ef0a0' : '#f2c14e'});
      if (Math.random() < dt*4) g.fx.fire.emit(at.x, at.y + 1, at.z, 0, 4, 0, 3.2, 0.5, 1, 0.3, 0.2, 1, 0, 1, 2);
      if (ok) { g.spawnChute(P.pos.clone().add(new V3(0, -3, 0)), P.vel); G.HUD.toast('Cargo away!'); done(); }
    } else if (l.how === 'near') {
      g.markers.push({pos:at.clone().setY(at.y + 40), label:J.i === 0 && !def.time ? 'CLUE' : name.toUpperCase(), col:'#f2c14e', edgeOnly:!!l.riddle && dH > 1500, noDist:!!l.riddle && dH > 1500});
      if (dH < (l.r || 220) && agl < 420) done();
    } else if (l.how === 'low') {
      g.markers.push({pos:at.clone().setY(at.y + 25), label:dH < 800 ? 'LOW PASS · under 150 ft' : name.toUpperCase(), col:'#f2c14e', edgeOnly:!!l.riddle && dH > 1500, noDist:!!l.riddle && dH > 1500});
      if (P.pos.distanceTo(at) < 48) done();
    } else if (l.how === 'hoops') {
      if (!J.hoops) {
        const c = pointOf(O, l.around); J.hoops = [];
        for (let i = 0; i < l.n; i++) { const a = i/l.n*Math.PI*2, x = c.x + Math.sin(a)*l.r, z = c.z + Math.cos(a)*l.r, n = new V3(Math.cos(a), 0, -Math.sin(a)).negate(); const p = new V3(x, groundMax(O, x, z) + l.agl, z); const m = ringMesh(16, 'start'); m.position.copy(p); m.rotation.y = Math.atan2(n.x, n.z); g.scene.add(m); J.hoops.push({pos:p, n, R:16, prev:new Map(), m}); }
        J.hk = 0;
      }
      const h = J.hoops[J.hk]; g.markers.push({pos:h.pos, label:`HOOP ${J.hk + 1}/${J.hoops.length}`, col:'#9ef0a0'});
      if (through(h, P, 3)) { J.hk++; if (g.audio) g.audio.ding(); if (J.hk >= J.hoops.length) done(); }
    }
    if (!legs[J.i]) return J.win();
  };
  J.win = () => ({win:true, medal:def.medal ? (J.t <= def.medal.gold ? 'gold' : J.t <= def.medal.silver ? 'silver' : 'bronze') : undefined, time:def.medal ? J.t : undefined, payMul:J.caught ? 0.6 : F.comfort ? 0.6 + 0.4*J.comfort/100 : 1, say:J.caught ? 'Delivered, but the customs men got a good look at us. Half the profit goes in bribes.' : null});
  J.objective = () => {
    const l = legs[J.i]; if (!l) return def.title;
    const verb = {land:'Land at', pickup:'Land and pick up at', hook:'Deliver by skyhook to', drop:'Air-drop at', near:'Find', low:'Low pass over', hoops:'Fly the hoops round', deck:'Land on the stage of'}[l.how];
    const where = l.how === 'deck' ? (shipOf(l) || {the:'the ship'}).the : l.site ? siteOf(l.site).name : l.around ? (O.R.marks.find(m => m.id === l.around) || {}).name : l.riddle ? 'the place in the riddle' : (O.R.marks.find(m => m.id === l.mark) || {}).name;
    return `${def.title}: ${verb} ${where}${def.time ? ' · ' + clock(J.clock) : ''}${O.holdOnGround ? ` · ${l.how === 'deck' ? (l.verb || 'loading') : 'loading'} ${Math.round(J.load/(l.how === 'deck' ? l.load || 5 : 6)*100)}%` : ''}`;
  };
  J.sides = () => {
    const out = [];
    if (F.hard) out.push({text:'Land gently', st:J.broke ? 'fail' : 'live', val:''});
    if (F.stunts) out.push({text:'No stunts', st:J.broke ? 'fail' : 'live', val:''});
    if (F.damage) out.push({text:'Don\'t get hit', st:'live', val:''});
    if (F.comfort) out.push({text:'Passenger comfort', st:J.comfort > 30 ? 'live' : 'fail', val:Math.round(J.comfort) + '%'});
    if (J.lights.length) out.push({text:'Stay out of the searchlights', st:J.caught ? 'fail' : 'live', val:J.caught ? 'spotted' : Math.round(J.spotted) + '%'});
    return out;
  };
  J.cleanup = () => { for (const L of J.lights) g.scene.remove(L.m); if (J.hoops) for (const h of J.hoops) g.scene.remove(h.m); O.holdOnGround = false; if (g.sea) for (const S of g.sea.ships) S.marked = false; };
  return J;
};

/* ---------- DUEL: straight from the bar into the air, nose to nose with a local ace ---------- */
ENG.duel = (O, def) => {
  const g = O.g, P = g.player, A = def.ace, site = O.sites.find(s => s.contact === def.contact) || O.sites[0];
  // both pilots start airborne over the bar, 2 km apart, head-on
  const toMid = tA.set(-site.point.x, 0, -site.point.z); if (toMid.lengthSq() < 1) toMid.set(0, 0, 1); toMid.normalize();
  const y = groundMax(O, site.point.x, site.point.z, 400) + 650;
  P.onGround = false; P.frozen = false; g.cine = null; g.running = true; O.holdOnGround = false;
  P.pos.set(site.point.x, y, site.point.z); P.q.setFromUnitVectors(Z, toMid); P.axes(); P.speed = 78; P.throttle = 1; P.vel.copy(P.fwd).multiplyScalar(P.speed);
  g.aimYaw = Math.atan2(toMid.x, toMid.z); g.aimPitch = 0;
  const L = G.stockLoadout(A.chassis); L.paint = A.paint.slice(); if (A.guns) L.guns = A.guns.map(([cal, ammo]) => ({cal, ammo})); L.rocket = 'flak';
  const at = P.pos.clone().addScaledVector(toMid, 2000);
  const ace = g.addPlane({loadout:L, team:1, name:A.name, callsign:A.name, pos:at, q:new Q().setFromUnitVectors(Z, toMid.clone().negate()), speed:78, ai:{role:'fighter', skill:A.skill}, internalMul:1.3});
  ace.ace = true; ace.duel = true; ace.bountyJob = true; g.pilots[g.pilots.length - 1].target = P;
  G.HUD.banner('DUEL', A.name); setTimeout(() => G.HUD.banner(null), 2400);
  const J = {t:0, ace, music:true};
  J.update = dt => {
    J.t += dt;
    if (!ace.alive) return {win:true, say:G.pick([`${A.name} is hanging from a parachute, cursing your mother. The bar\'s buying.`, 'Down they go! The whole bar saw it from the terrace.', 'Clean kill. The purse is yours, and so is the bar\'s respect.'])};
    if (P.pos.distanceTo(ace.pos) > 4500) return {win:false, note:'You ran from a duel', say:'Running away? The whole bar is laughing at you.'};
    if (J.t > 300) return {win:false, note:'Called off', say:'Five minutes and nobody\'s down. The bar\'s lost interest.'};
  };
  J.objective = () => `Duel: shoot down ${A.name} · ${Math.round(ace.pos.distanceTo(P.pos)*YD)} yd · purse $${def.pay.toLocaleString()}`;
  J.sides = () => [{text:`${A.name}`, st:ace.alive ? 'live' : 'ok', val:ace.alive ? Math.round(ace.internal/ace.internalMax*100) + '%' : 'down'}];
  J.cleanup = () => { if (ace.alive) O.removePlane(ace); };
  return J;
};

/* ---------- BOUNTY ---------- */
ENG.bounty = (O, def) => {
  const g = O.g, P = g.player, at = pointOf(O, def.at), J = {t:0, up:false, wave:0, foes:[], ship:null, hideSites:false};
  const spawn = n => { const a = Math.random()*Math.PI*2, pos = at.clone().add(new V3(Math.sin(a)*500, 0, Math.cos(a)*500)); pos.y = groundMax(O, pos.x, pos.z, 120) + 260; const made = O.gang(def.gang, pos, n, {skill:0.5}); for (const p of made) p.bountyJob = true; J.foes.push(...made); return made; };
  J.update = dt => {
    J.t += dt; const d = Math.hypot(P.pos.x - at.x, P.pos.z - at.z);
    if (!J.up) {
      g.markers.push({pos:at.clone().setY(at.y + 120), label:`BOUNTY · ${((O.R.marks.find(m => m.id === def.at) || O.sites.find(s => s.id === def.at) || {}).name || '').toUpperCase()}`, col:'#ff6b57'});
      if (d < 2800) {
        J.up = true; spawn(def.n);
        if (def.ace) { const L = G.stockLoadout('vandal'); L.paint = def.ace.paint; L.guns = [{cal:'50', ammo:'ex'}, {cal:'40', ammo:'slug'}]; L.arm = [30, 30, 25, 25];
          const p = g.addPlane({loadout:L, team:1, name:def.ace.name, callsign:def.ace.name, pos:at.clone().add(new V3(0, groundMax(O, at.x, at.z, 120) - at.y + 320, 0)), q:new Q(), speed:90, ai:{role:'fighter', skill:def.ace.skill || 0.8}, internalMul:1.6});
          p.ace = true; p.bountyJob = true; J.ace = p; J.foes.push(p); G.HUD.radio(def.ace.name, G.pick(['You\'re a long way from home, flyboy.', 'Another bounty hunter. I collect \'em.', 'Turn around while you still got wings.'])); }
        if (def.zep) { const z = def.zep; J.ship = g.addShip({team:1, kind:'raider', name:z.name, label:z.name.toUpperCase(), paint:z.paint, pos:at.clone().setY(groundMax(O, at.x, at.z, 300) + 420), heading:Math.random()*6, speed:5, turn:0.01, noRun:true, noTorps:true}); g.targetShip = J.ship; }
        G.HUD.radio(G.RADIO.short, `There they are! ${GANGS[def.gang].name}${def.zep ? ' and the ' + def.zep.name : ''}. Weapons free!`);
      }
      return;
    }
    const left = J.foes.filter(p => p.alive).length;
    if (!left && def.waves && J.wave < def.waves.length) { const n = def.waves[J.wave++]; spawn(n); G.HUD.radio(G.RADIO.short, J.ship && !J.shipDown ? `${n} more off the ${J.ship.name}!` : `${n} more coming in!`); }
    if (!J.foes.some(p => p.alive) && (!def.waves || J.wave >= def.waves.length) && (!J.ship || J.shipDown)) return {win:true, say:def.ace ? `${def.ace.name} is hanging from a parachute. The bounty\'s yours.` : 'Sky\'s clear. Fine shooting.'};
    if (d > 6500) return {win:false, note:'They got away', say:'You flew off and left them to it?'};
  };
  J.onShipDown = s => { if (s === J.ship) { J.shipDown = true; G.HUD.radio(G.RADIO.short, `The ${s.name} is finished!`); } };
  J.objective = () => !J.up ? `${def.title}: head for ${((O.R.marks.find(m => m.id === def.at) || O.sites.find(s => s.id === def.at) || {}).name || 'the target')}` : `${def.title}: ${J.foes.filter(p => p.alive).length} bandits left${J.ship && !J.shipDown ? ` · ${J.ship.name} still flying` : ''}`;
  J.sides = () => def.ace ? [{text:`Shoot down ${def.ace.name}`, st:J.ace && !J.ace.alive ? 'ok' : 'live', val:''}] : [];
  J.cleanup = () => { g.targetShip = null; };
  return J;
};

G.OPEN = OPEN;
})();
