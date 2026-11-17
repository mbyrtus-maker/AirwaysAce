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
      {id:'cibola', kind:'strip', name:'Cíbola', contact:'ramon', at:{want:'cavern'}, cavern:true, town:12, townOff:[-145, 0], townR:80, strip:{sign:'CÍBOLA', walls:0xe0c8a0, trim:0x8e231c, accent:0xd9b44a, grass:0x9a7a4a, tar:0x5a4a3a, signCol:'#dba63e', signGlow:'#ffe3a0'}},
      {id:'aguafria', kind:'hook', name:'Agua Fria', contact:'lucia', at:{want:'high', x:2500, z:1000, r:900}, r:330, town:true, tower:{h:88, w:34, walls:0xe0c8a0, sign:'HOTEL AGUA FRIA', signCol:'#6b3a2a', signGlow:'#f2c14e'}}
    ],
    marks:[
      {id:'trestle', kind:'viaduct', name:'the Coronado trestle', at:{want:'low', x:600, z:2400, r:1300, minH:8}},
      {id:'mine', kind:'mine', name:'the Lucky Strike mine', at:{want:'high', x:-2600, z:-2600, r:1400}},
      {id:'hideout', kind:'hideout', name:'Rattlesnake Gulch', at:{want:'low', x:3200, z:2800, r:1500, minH:10}},
      {id:'canyon', kind:'none', name:'the deep canyon', at:{want:'low', x:1600, z:-2600, r:1500, minH:4}},
      {id:'butte', kind:'none', name:'Sentinel Butte', at:{want:'high', x:0, z:0, r:5000}}
    ],
    cavern:{id:'cibola', name:'Cíbola', rx:330, rz:230, H:95, gate:{id:'cibolagate', name:'the Gate of Cíbola', bw:38, bh:32, shape:'none'}},
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
      {id:'keep', kind:'keep', name:'Brimstone Keep', at:{want:'land', x:0, z:2200, r:500}},
      {id:'cranium', kind:'volcano', name:'Mount Cranium', at:{want:'high', x:0, z:3000, r:600}, plume:2.2},
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
      {id:'v2', name:'Crater gold', at:'cranium', hint:'Old Brimstone\'s first crew hid their gold on the rim of Mount Cranium. Nobody goes up there. It\'s on fire.', reward:{livery:'brimstone', cash:2500}},
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
   blurb:'Low and mean through the canyons: the trestle, the deep canyon, Rattlesnake Gulch and back. Three rivals. Gold wins the Mesa Sunset paint job.', go:'Stay low, stay lucky, and don\'t clip a mesa.'},
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
   blurb:'Corsairs hit the fort at night when the gun crews can\'t see them. Tonight you\'re the gun crew. Two waves.', go:'Shoot anything without navy roundels.'}
];
const JOB = id => G.JOBS.find(j => j.id === id);

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
    sc:{chain:0, mult:1, last:-99, label:'', session:0, cont:0, shown:''}, story:true});
  for (const md of R.marks) { const p = L.marks[md.id]; c.P[md.id] = new V3(p.x, Math.max(g.world.height(p.x, p.z), 0.4), p.z); c.buildMark(g, md, c.P[md.id]); }
  if (R.cavern) c.buildCavern(g, planCavern(R));
  for (const T of L.tunnels) { c.tunnels.push(c.buildTunnel(g, T)); c.P[T.td.id] = new V3(T.mid.x, T.floor, T.mid.z); }
  c.sites = R.sites.map(sd => c.buildSite(g, sd, L.sites[sd.id]));
  for (const s of c.sites) c.P[s.id] = s.point;
  if (o.traffic !== false) { const T = g.traffic || (g.traffic = new G.Traffic(g)), stops = c.sites.filter(s => !s.def.cavern).map(s => s.point), pairs = [];
    for (let i = 0; i < stops.length; i++) for (let j = i + 1; j < stops.length; j++) pairs.push([stops[i], stops[j]]);
    T.routes(pairs.slice(0, 5), {night:c.night}); }
  c.tick = dt => { g.markers = []; for (const a of c.anim) a(dt); c.towerHit(g); c.caveHit(g); c.tunnelHit(g); c.cavernHit(g); };
  c.worldOpts = time => ({seed:R.seed, region:R.terrain, time, flats:G.regionFlats(R), cuts:G.regionCuts(R)});
  return c;
};
G.regionWorld = (id, time) => { const R = REG[id]; return {seed:R.seed, region:R.terrain, time, flats:G.regionFlats(R), cuts:G.regionCuts(R)}; };
/* ---------- tunnel and cavern planning, on the region's own terrain ---------- */
const hashStr = s => [...s].reduce((a, c) => (a*31 + c.charCodeAt(0)) >>> 0, 7);
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
  const b = best, td = Object.assign({bonus:0}, C.gate), A = {x:b.x + b.ax*(C.rx + 430), z:b.z + b.az*(C.rx + 430)}, E = {x:b.x + b.ax*(C.rx - 25), z:b.z + b.az*(C.rx - 25)}, N = 30, pts = [];
  for (let i = 0; i <= N; i++) pts.push({x:A.x + (E.x - A.x)*i/N, z:A.z + (E.z - A.z)*i/N, h:f(A.x + (E.x - A.x)*i/N, A.z + (E.z - A.z)*i/N)});
  let i0 = pts.findIndex(p => p.h > b.floor + td.bh + 8); if (i0 < 1) i0 = 1;
  finishPath(pts);
  const gate = {td, pts, floor:b.floor, i0, i1:N, mid:pts[N], into:'cibola'};
  return (R._C = {x:b.x, z:b.z, ax:[b.ax, b.az], yaw:Math.atan2(b.ax, b.az), floor:b.floor, rx:C.rx, rz:C.rz, H:C.H, gate, def:C});
}
G.regionCuts = R => {
  // the cut must be wider than a terrain grid diagonal (~50 m), or ground triangles with an uncut corner rise into the bore
  const L = layout(R), cuts = L.tunnels.map(T => ({pts:T.pts.slice(T.i0, T.i1 + 1), hw:Math.max(T.td.bw/2 + 3, 54), floor:T.floor, flat:true}));   // only under the roof, squared off at the mouths
  if (R.cavern) { const C = planCavern(R); cuts.push({ell:{x:C.x, z:C.z, rx:C.rx, rz:C.rz, ax:C.ax}, floor:C.floor}); }
  return cuts;
};
G.regionFlats = R => {
  const L = layout(R), fl = R.sites.filter(s => s.r && !s.cavern).map(s => ({x:L.sites[s.id].x, z:L.sites[s.id].z, r:s.r}));
  if (R.city) fl.push({x:CITY.x, z:CITY.z, r:CITY.r});
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
function buildLava(r, night){
  const g = new THREE.Group();
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
    this.wing = S.wing ? 3 : 0; g.markers = []; this.towers = []; this.arches = []; this.anim = []; this.caves = []; this.tunnels = []; this.cavern = null;
    // landmarks first (sites may sit among them)
    this.P = {}; this.markObj = {};
    for (const md of R.marks) { const p = L.marks[md.id]; this.P[md.id] = new V3(p.x, Math.max(g.world.height(p.x, p.z), 0.4), p.z); this.buildMark(g, md, this.P[md.id]); }
    this.tunnels = []; if (R.cavern) this.buildCavern(g, planCavern(R));
    for (const T of L.tunnels) { this.tunnels.push(this.buildTunnel(g, T)); this.P[T.td.id] = new V3(T.mid.x, T.floor, T.mid.z); }
    this.sites = R.sites.map(sd => this.buildSite(g, sd, L.sites[sd.id]));
    for (const s of this.sites) this.P[s.id] = s.point;
    if (R.city) this.buildCity(g);
    this.treasures = R.treasures.map(t => this.buildTreasure(g, t)).filter(Boolean);
    // neutral traffic: mail and charter planes between the stops, cargo zeppelins crossing the region
    const T = g.traffic || (g.traffic = new G.Traffic(g)), stops = this.sites.filter(s => s.kind !== 'field' && !s.def.cavern).map(s => s.point);
    const pairs = []; for (let i = 0; i < stops.length; i++) for (let j = i + 1; j < stops.length; j++) pairs.push([stops[i], stops[j]]);
    T.routes(pairs.slice(0, 7), {night:this.night}); T.cruisers(this.night ? 2 : 3, this.R.id);
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
    const w = g.world; let o = null;
    if (md.kind === 'lighthouse') { o = G.buildLighthouse(); w.addBlocker({x:p.x, z:p.z, hw:5, hd:5, top:p.y + 47}); this.anim.push(dt => { o.userData.beam.rotation.y += dt*0.9; }); }
    if (md.kind === 'windmill') { o = G.buildWindmill(); o.rotation.y = Math.atan2(-p.x, -p.z); w.addBlocker({x:p.x, z:p.z, hw:7, hd:7, top:p.y + 25}); this.anim.push(dt => { o.userData.sails.rotation.z += dt*0.7; }); }
    if (md.kind === 'observatory') { o = buildObservatory(); w.addBlocker({x:p.x, z:p.z, hw:10, hd:10, top:p.y + 20}); }
    if (md.kind === 'mine') { o = buildMine(); w.addBlocker({x:p.x, z:p.z, hw:4, hd:4, top:p.y + 19}); }
    if (md.kind === 'hideout') o = buildHideout();
    if (md.kind === 'hulk') o = buildHulk();
    if (md.kind === 'keep') { o = buildKeep(); w.addBlocker({x:p.x, z:p.z, hw:30, hd:30, top:p.y + 28}); }
    if (md.kind === 'volcano') { o = buildPlume(md.plume || 1, this.night); this.anim.push(o.userData.tick); }
    if (md.kind === 'lava') { p.y = 3.4; o = buildLava(md.r || 800, this.night); this.anim.push(o.userData.tick); }
    if (md.kind === 'cave') { p.y = 0.4; const C = Object.assign({}, md.cave), yaw = G.rng(md.id.length*97)()*Math.PI; C.P = cavePath(C); o = buildCave(C); o.rotation.y = yaw; const cv = {obj:o, C, name:md.name, t:-99, yaw, seen:null}; this.caves.push(cv); if (this.night) this.anim.push(() => { if (Math.random() < 0.6) { const e = Math.random() < 0.5 ? C.P[0] : C.P[C.P.length - 1], sd = Math.random() < 0.5 ? 1 : -1, l = new V3(e.x + e.lx*sd*(C.bw/2 - 1.5), C.bh*0.55, e.z + e.lz*sd*(C.bw/2 - 1.5)).applyAxisAngle(UP, yaw).add(p); this.g.fx.fire.emit(l.x, l.y, l.z, 0, 0.6, 0, 2.2, 0.35, 1, 0.75, 0.35, 0.9, 0, 1, 0); } }); }
    if (md.kind === 'viaduct') {
      const len = 300, n = 5, hs = []; for (let i = 0; i <= n; i++) hs.push(Math.max(w.height(p.x - len/2 + i*len/n, p.z), 2));
      const deck = Math.max(...hs) + 46; o = G.buildViaduct(len, deck, hs); o.position.set(p.x, 0, p.z); g.scene.add(o);
      for (let i = 0; i <= n; i++) w.addBlocker({x:p.x - len/2 + i*len/n, z:p.z, hw:3, hd:4.5, top:deck + 3});
      this.arches.push({pos:new V3(p.x, 0, p.z), len, deck, prev:undefined, name:md.name, t:-99});
      p.y = this.ground(p.x, p.z, true);
      return;
    }
    if (o) { o.position.copy(p); g.scene.add(o); this.markObj[md.id] = o; }
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
      const tower = G.buildSkyhookTower(T.h || 120, T.w || 38, T); tower.position.set(at.x, th - 0.5, at.z); tower.rotation.y = ty; g.scene.add(tower);
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
    const far = Math.hypot(P.pos.x, P.pos.z);
    if (far > 7800 && !this.farWarn) { this.farWarn = true; G.HUD.radio(G.RADIO.short, 'You\'re at the edge of the chart, sugar. Turn back before you run out of map.'); }
    if (far < 7000) this.farWarn = false;
    if (!obj) obj = far > 7800 ? 'Edge of the chart. Turn back toward the Margaret.' : `Free flight · land at a field or hook a skyhook to meet contacts · stunts score points`;
    G.HUD.objective(obj);
    this.hudSides(g);
  },
  hudSides(g){
    const S = G.save.open, R = this.R, found = R.treasures.filter(t => S.found[t.id]).length;
    const list = this.job && this.job.sides ? this.job.sides() : [];
    list.push({text:'Treasures found', st:found >= R.treasures.length ? 'ok' : 'live', val:`${found}/${R.treasures.length}`});
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
        if (Math.abs(l.x) > half + 5 || Math.abs(l.z) > half + 5 || l.y > U.top + 30 || l.y < 0) continue;
        const inGallery = l.y > gl.y0 + 2 && l.y < gl.y1 - 1.6 && Math.abs(l.x) < gl.ow/2 - 5;
        const inside = Math.abs(l.x) < half + 4 && Math.abs(l.z) < half + 1 && l.y < U.top + 22;
        if (inside && !inGallery) { if (p.isPlayer && g.done) continue; p.destroy(null, 'crash'); }
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
          else if (cv.seen && !at) { if (cv.seen.lo < L*0.2 && cv.seen.hi > L*0.8 && g.t - cv.t > 4) { cv.t = g.t; this.award(D.bonus || (D.path ? 2000 : 1500), D.path ? 'THROUGH THE WINDING CAVE' : 'THROUGH THE CAVE'); if (g.audio) g.audio.ding(); } cv.seen = null; }
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
    const w = g.world, td = T.td, P = T.pts, NL = 34, W = Math.max(td.bw/2 + 3, 54) + 62, NA = 18, floor = T.floor, mat = w.terrain.material;
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
        const a = this.tunnelAt(tn, p.pos.x, p.pos.z); if (Math.abs(a.x) > tn.W || a.s < s0 - 2 || a.s > s1 + 2) { if (p.isPlayer && tn.seen && (a.s < s0 - 20 || a.s > s1 + 20 || Math.abs(a.x) > tn.W)) this.tunnelPass(tn); continue; }
        const y = p.pos.y - T.floor, inBore = Math.abs(a.x) < td.bw/2 - 3.5 && y > 1.2 && y < boreTop(td, Math.abs(a.x) + 3) - 1.5, top = tn.lidY(a.p, a.x);
        if (p.isPlayer && inBore) { tn.seen = tn.seen || {lo:1e9, hi:-1e9}; tn.seen.lo = Math.min(tn.seen.lo, a.s); tn.seen.hi = Math.max(tn.seen.hi, a.s); }
        if (inBore || p.pos.y > top + 1) continue;
        if (p.isPlayer) { if (!g.done) p.destroy(null, 'crash'); } else p.pos.y = top + 4;
      }
      const P = g.player, e = T.pts[T.i0], d = Math.hypot(P.pos.x - e.x, P.pos.z - e.z);
      if (d < 1500 && d > 60 && !(this.job && this.job.hideSites) && !T.into) g.markers.push({pos:new V3(e.x, T.floor + td.bh*0.5, e.z), label:`CAVE · ${td.name.toUpperCase()}${td.shape === 's' ? ' · it snakes' : td.shape === 'bend' ? ' · it turns' : ''}`, col:'#9ec7f0', noDist:d < 400});
      if (T.into && d < 2500 && d > 60) g.markers.push({pos:new V3(e.x, T.floor + td.bh*0.5, e.z), label:'CÍBOLA · FLY IN HERE', col:'#f2c14e', noDist:d < 400});
    }
  },
  tunnelPass(tn){
    const T = tn.T, s0 = T.pts[T.i0].s, s1 = T.pts[T.i1].s, L = s1 - s0, sn = tn.seen; tn.seen = null;
    if (T.into || !(sn.lo < s0 + L*0.2 && sn.hi > s1 - L*0.2) || this.g.t - tn.t < 4) return;
    tn.t = this.g.t; this.award(T.td.bonus || (T.td.shape === 'none' ? 1500 : 2000), T.td.sea ? 'THROUGH THE SEA CAVE' : 'THROUGH THE MOUNTAIN'); if (this.g.audio) this.g.audio.ding();
  },
  /* Cíbola's cavern: the mesa top stays where it was (rebuilt over the hollow), a domed sandstone ceiling inside,
     a rim wall with the entrance cut through it, hanging lanterns, and solid rock everywhere you can't see daylight. */
  buildCavern(g, C){
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
  /* inside the cavern: below the ceiling is air, above it is mesa */
  cavernHit(g){
    const C = this.cavern; if (!C) return;
    for (const p of g.planes) {
      if (!p.alive || p.frozen) continue;
      const dx = p.pos.x - C.x, dz = p.pos.z - C.z, lx = dx*C.ax[0] + dz*C.ax[1], lz = -dx*C.ax[1] + dz*C.ax[0], u = Math.hypot(lx/C.rx, lz/C.rz); if (u >= 1) continue;
      const cy = C.ceil(u), top = Math.max(g.world.height0(p.pos.x, p.pos.z), cy + 8);
      if (p.pos.y < cy - 2 || p.pos.y > top + 1) continue;
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
    // knife-edge has to be earned: wings within ~20° of vertical, nose roughly level, low and fast, held for 3 s before it scores
    const KE = 3, edge = Math.abs(P.right.y) > 0.94 && Math.abs(P.fwd.y) < 0.3 && agl < 150 && mph > 90 && !P.man;
    if (edge) {
      const was = sc.ke || 0; sc.ke = was + dt;
      if (sc.ke < KE && Math.floor(sc.ke*2) !== Math.floor(was*2)) G.HUD.toast(`Knife-edge… hold it ${(KE - sc.ke).toFixed(1)} s`);
      if (was < KE && sc.ke >= KE) { this.award(300, 'KNIFE-EDGE', true); if (g.audio) g.audio.ding(); sc.keT = 0; }
    } else sc.ke = 0;
    if (sc.cont <= 0) {
      sc.cont = 0;
      if (agl < 18 && mph > 125 && !g.runwayAt(P.pos)) { this.award(55, 'HEDGE-HOPPING', true); sc.cont = 0.5; }
      else if (P.up.y < -0.65 && !P.man) { this.award(40, 'INVERTED', true); sc.cont = 0.5; }
      else if (sc.ke >= KE) { this.award(40, `KNIFE-EDGE ${Math.floor(sc.ke)}s`, true); sc.cont = 0.5; }
    }
    // under a bridge
    for (const A of this.arches) {
      const rel = tA.copy(P.pos).sub(A.pos), along = rel.z;
      if (A.prev !== undefined && Math.sign(along) !== Math.sign(A.prev) && Math.abs(rel.x) < A.len/2 - 4 && P.pos.y < A.deck - 3 && g.t - A.t > 6) {
        A.t = g.t; this.award(1200, 'UNDER THE BRIDGE'); if (g.audio) g.audio.ding();
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
    const C0 = G.CONTACTS[site.contact], P = g.player;
    if (C0.local && P.alive) { P.internal = P.internalMax; P.armor = P.armorMax.slice(); for (const gn of P.guns) { gn.rounds = gn.def.ammo; P.spent.ammo[gn.i] = 1; } P.rockets = P.L.hp*3; P.spent.rockets = P.rockets; if (P.L.nitro) P.nitroLeft = 3; this.patched = true; } else this.patched = false;
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
    const jobs = G.JOBS.filter(j => j.contact === cid).map(j => {
      const rec = S.jobs[j.id] || {};
      let lock = null;
      if (j.night && !night) lock = 'After dark';
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
  accept(id){ const d = JOB(id); if (!d || this.job) return; this.pending = d; },
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
    n.y = 0; n.normalize(); const boost = i % 3 === 2, m = ringMesh(12, i === 0 ? 'start' : boost ? 'boost' : 'check');
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
        pl.route = seq.slice(1).map(ix => ({x:pts[ix].x, z:pts[ix].z, y:pts[ix].y, r:26})); pl.wp = 0; pl.raceThrottle = 0.92 + 0.03*i; pl.raceDone = false;
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
  const legPos = l => l.site ? (siteOf(l.site).apron || siteOf(l.site).hook || siteOf(l.site).point) : pointOf(O, l.mark || l.around);
  const done = () => {
    const l = legs[J.i]; if (g.audio) g.audio.ding(); if (l.say) G.HUD.radio(def.contact ? G.CONTACTS[def.contact].name.replace(/".*" /, '').split(' ').slice(-1)[0] : G.RADIO.short, l.say);
    J.i++; if (J.hoops) { for (const h of J.hoops) g.scene.remove(h.m); J.hoops = null; }
    const nx = legs[J.i]; if (nx && nx.riddle) setTimeout(() => G.HUD.radio(G.RADIO.short, nx.riddle), 2500);
  };
  if (legs[0].riddle) setTimeout(() => G.HUD.radio(G.RADIO.short, legs[0].riddle), 3000);
  J.onHooked = site => { const l = legs[J.i]; if (l && l.how === 'hook' && l.site === site.id) { J.hookedOk = true; } };
  J.onStunt = () => { if (F.stunts) J.broke = 'You did stunts with the cargo aboard!'; if (F.comfort) J.comfort -= 35; };
  J.onTouchdown = hard => { if (hard && F.hard) J.broke = 'Hard landing. The crate didn\'t survive it.'; };
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
    }
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
    if (l.how === 'land' || l.how === 'pickup') {
      const s = siteOf(l.site), spot = s.apron || s.point, rad = s.apron ? 30 : 75, d = Math.hypot(P.pos.x - spot.x, P.pos.z - spot.z);
      g.markers.push({pos:spot.clone().setY(spot.y + 10), label:P.onGround ? (d < rad ? (P.speed < 3 ? 'HOLD' : 'STOP HERE') : 'TAXI HERE') : `LAND · ${name.toUpperCase()}`, col:'#f2c14e'});
      if (P.onGround && d < rad && P.speed < 3) {
        if (l.how === 'land') { done(); s.armed = true; return legs[J.i] ? undefined : J.win(); }
        O.holdOnGround = true; J.load += dt; if (J.load >= 6) { O.holdOnGround = false; J.load = 0; done(); }
      }
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
  J.win = () => ({win:true, payMul:J.caught ? 0.6 : F.comfort ? 0.6 + 0.4*J.comfort/100 : 1, say:J.caught ? 'Delivered, but the customs men got a good look at us. Half the profit goes in bribes.' : null});
  J.objective = () => {
    const l = legs[J.i]; if (!l) return def.title;
    const verb = {land:'Land at', pickup:'Land and pick up at', hook:'Deliver by skyhook to', drop:'Air-drop at', near:'Find', low:'Low pass over', hoops:'Fly the hoops round'}[l.how];
    const where = l.site ? siteOf(l.site).name : l.around ? (O.R.marks.find(m => m.id === l.around) || {}).name : l.riddle ? 'the place in the riddle' : (O.R.marks.find(m => m.id === l.mark) || {}).name;
    return `${def.title}: ${verb} ${where}${def.time ? ' · ' + clock(J.clock) : ''}${O.holdOnGround ? ` · loading ${Math.round(J.load/6*100)}%` : ''}`;
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
  J.cleanup = () => { for (const L of J.lights) g.scene.remove(L.m); if (J.hoops) for (const h of J.hoops) g.scene.remove(h.m); O.holdOnGround = false; };
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
