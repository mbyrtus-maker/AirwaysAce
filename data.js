(function(){
'use strict';
/* Ace of the Airways: game data.
   Chassis stats follow Crimson Skies (2000) stock planes under original names, with the balance changes from the
   design doc applied. Weights are starting values, tuned so the stock loadout fills each chassis exactly. */
const G = window.G = window.G || {};
const MPH = 0.44704, YD = 0.9144;
G.MPH = MPH;

/* ---------- Ratings ---------- */
G.RATE = {Poor:1, Fair:2, Average:3, Good:4, Excellent:5};
const SPEED_MPH = {Poor:175, Fair:190, Average:210, Good:230, Excellent:245};

/* ---------- Guns (fired in pairs) ---------- */
G.GUNS = {
  '30':{id:'30', name:'.30-cal', rps:20, dmg:1.5, range:600*YD, w:400, ammo:1500, muzzle:880, pitch:1.15, tracer:0xfff2b0},
  '40':{id:'40', name:'.40-cal', rps:16, dmg:2.4, range:650*YD, w:550, ammo:1200,  muzzle:860, pitch:1.06, tracer:0xffe28a},
  '50':{id:'50', name:'.50-cal', rps:12, dmg:3.6, range:650*YD, w:700, ammo:900,  muzzle:840, pitch:1.0,  tracer:0xffcf6a},
  '60':{id:'60', name:'.60-cal', rps:9,  dmg:5.4, range:600*YD, w:1050, ammo:680, muzzle:800, pitch:0.9,  tracer:0xffb050, recoil:0.012},
  '70':{id:'70', name:'.70-cal', rps:6,  dmg:8.0, range:450*YD, w:1400, ammo:450, muzzle:760, pitch:0.75, tracer:0xff9a3c, recoil:0.022}
};
G.GUN_ORDER = ['30', '40', '50', '60', '70'];
G.AMMO_W = 0.3;   // share of a gun pair's weight that is ammunition (burned off as it fires)

/* ---------- Ammunition: multipliers vs armor and vs internal structure ---------- */
G.AMMO = {
  slug:{id:'slug', name:'Slug', short:'SLUG', a:1,    i:1,   p:1,   desc:'Plain ball. No strengths, no weaknesses.'},
  dd:  {id:'dd',   name:'Dum-dum', short:'DD', a:0.5, i:2,   p:1.5, desc:'Soft-nosed. Shreds what\'s under the plating, bounces off armor. Wrecks engines and spars once it\'s through.'},
  ap:  {id:'ap',   name:'Armor-piercing', short:'AP', a:1.75, i:0.5, p:0.6, desc:'Hardened core. Strips armor fast, and a quarter of each round goes clean through to the engine, wing or tail behind it.'},
  ex:  {id:'ex',   name:'Explosive', short:'EX', a:1, i:1, p:1, splash:0.2, desc:'Small charge. Some damage spills to a neighbouring zone.'}
};
G.AMMO_ORDER = ['slug', 'dd', 'ap', 'ex'];

/* ---------- Rockets (3 per hardpoint, all dumbfire) ---------- */
G.ROCKETS = {
  he:   {id:'he', name:'High Explosive', short:'HE', dmg:60, splash:12, speed:240, drop:2.2, desc:'2-lb warhead, small blast. Best on slow or stationary targets and zeppelins.'},
  flak: {id:'flak', name:'Flak', short:'FLAK', dmg:22, splash:9, prox:6*YD, speed:260, drop:1.6, wingMul:0.6, desc:'Air-bursts within 6 yards of a plane. Lead your shot.'},
  ap:   {id:'ap', name:'Armor-Piercing', short:'AP', dmg:90, splash:3, speed:330, drop:1.2, armorMul:2, desc:'Fast and hard. Punches gunship and zeppelin plating.'},
  choke:{id:'choke', name:'Choker', short:'CHOKE', dmg:12, splash:6, speed:250, drop:1.8, choke:4, desc:'Stalls the engine of the plane it hits for 4 seconds.'},
  conc: {id:'conc', name:'Concussion', short:'CONC', dmg:15, splash:22, speed:240, drop:2, knock:1, desc:'Shockwave that knocks nearby planes off course.'}
};
G.ROCKET_ORDER = ['he', 'flak', 'ap', 'choke', 'conc'];
G.HP_W = 250; G.ROCKET_W = 70; G.ARMOR_W = 4; G.ARMOR_HP = 4; G.ARMOR_MAX = 50;
G.ENGINE = [{id:0, name:'Low', mph:-20, w:-400}, {id:1, name:'Stock', mph:0, w:0}, {id:2, name:'High', mph:20, w:400}];
G.NITRO_W = 300;
/* difficulty: one place to ease every fight at once, tuned after damage-to-parts made the player's plane fragile */
G.TUNE = {
  taken:0.8,        // damage the player takes from anything hostile
  wingTaken:0.85,   // and the player's wingmen
  parts:0.6,        // the player's parts hold this share of the airframe (bandits 0.5)
  leak:0.006,       // the player's oil leak, share of engine lost a second (bandits 0.01)
  strain:0.62,      // stick load before the player's failing wing creaks (bandits 0.55)
  tear:1.2,         // creaking a failing wing takes this long to tear it (bandits 0.9)
  enemySkill:0.9    // bandit skill scale
};
/* where a torn wing breaks off (metres out from the centreline): outboard of the fuselage, or of the booms on twin-boom ships */
G.WING_ROOT = {banshee:3.3, highwayman:3.0, thunderbuss:4.0, mantis:3.0, zephyr:2.2, whirligig:1.9, hornet:2.0, ironclad:1.8};
G.TORP_W = 600;   // an air torpedo, each: the bombers carry them on a belly rack, on top of their rockets

/* ---------- Mods: bought from contacts, found in treasure, or earned with stunt points. Player only. ---------- */
G.MODS = {
  nitro: {id:'nitro', name:'Nitrous bottles', price:6000, desc:'Three nitro boosts per sortie (Shift). Fit them in the Hangar; they weigh 300 lb.'},
  hotrod:{id:'hotrod', name:'Hot-rod engine tune', price:5000, desc:'Unlocks the High engine setting in the Hangar: +20 mph for 400 lb.'},
  prop:  {id:'prop', name:'Racing propeller', price:6500, desc:'Coarse-pitch blades: +8 mph top speed and 12% quicker acceleration.'},
  gyro:  {id:'gyro', name:'Gyro gunsight', price:4500, desc:'Your guns lean up to 8 degrees toward the lead indicator, up from 5.'},
  plate: {id:'plate', name:'Cold-rolled armor plate', price:5000, desc:'Every point of armor stops 25% more, for the same weight.'},
  spars: {id:'spars', name:'Reinforced spars', price:5000, desc:'30% more internal structure under the armor, and 30% tougher wings and tail.'},
  engplate:{id:'engplate', name:'Armoured engine bearers', price:4500, desc:'A steel cradle round the engine: armor-piercing rounds do half the damage to it.'},
  drums: {id:'drums', name:'Drum magazines', price:4000, desc:'30% more rounds in every gun.'},
  winch: {id:'winch', name:'Skyhook winch', price:3000, desc:'Skyhooks and docking rings catch you at up to 125 mph instead of 105.'},
  lights:{id:'lights', name:'Landing lights', price:2500, desc:'A pair of nose floodlights for flying and landing at night.'}
};
G.hasMod = id => (G.save.mods || []).includes(id);
G.hookTop = P => (P && P.L && (P.L.mods || []).includes('winch') ? 125 : 105)*MPH;
/* ---------- Liveries: paint schemes found or won ---------- */
G.LIVERIES = {
  swallow:    {name:'Swallow', paint:[0x7d8a5a, 0x6b5446, 0xb8c2bc], from:'Finishing Volume II (with the Zephyr)'},
  airracer:   {name:'Air Racer', paint:[0x1f3b6b, 0xd9b44a, 0xc0392b], from:'Finishing Volume II (with the Zephyr)'},
  quicksilver:{name:'Quicksilver', paint:[0xc8ced4, 0x9e1b1b, 0x1b1b1b], from:'Finishing Volume II (with the Zephyr)'},
  nightjet:   {name:'Night Jet', paint:[0x1a1f2e, 0x5a6a8a, 0x9ec7f0], from:'Finishing Volume II (with the Zephyr)'},
  courier:    {name:'Gantry Courier', paint:[0xe8e0cc, 0x1a1a1a, 0x9e1b1b], from:'Finishing Volume IV'},
  bluecoat:   {name:'Bluecoat', paint:[0x1f2a44, 0xe8edf2, 0xd9b44a], from:'Finishing Volume IV'},
  steelworks: {name:'Steelworks', paint:[0x4a3a32, 0xe0742a, 0x1a1a1a], from:'Finishing Volume IV'},
  ghost:      {name:'Ghost', paint:[0xd8dde2, 0x9ef0e0, 0x2a3238], from:'Finishing Volume IV'},
  syndicate:  {name:'Iron Syndicate', paint:[0x3a3f44, 0xd9b44a, 0x1a1a1a], from:'Finishing Volume III'},
  railroad:   {name:'Copperton Line', paint:[0x6b2a1a, 0xd9b44a, 0x1a1a1a], from:'Finishing Volume III'},
  glacier:    {name:'Glacier', paint:[0xe8edf2, 0x6fb0d9, 0x2a3a52], from:'Finishing Volume III'},
  armada:     {name:'Last Armada', paint:[0x2a3a52, 0xe8e0cc, 0x9e1b1b], from:'Finishing Volume III'},
  brimstone:  {name:'Brimstone', paint:[0x161616, 0xe0742a, 0x9e1b1b], from:'A treasure in the Calavera Isles'},
  blackthirteen:{name:'Black Thirteen', paint:[0x161616, 0xe8e0cc, 0x9e1b1b], from:'Volume II, Chapter 4'},
  barnstormer:{name:'Barnstormer', paint:[0xd94f2a, 0xf1e9d6, 0x1f2a44], from:'10,000 stunt points'},
  goldleaf:   {name:'Gold Leaf', paint:[0x151312, 0xdba63e, 0xf1e9d6], from:'60,000 stunt points'},
  halcyon:    {name:'Halcyon Blue', paint:[0x6fb0d9, 0xf1e9d6, 0x1f3b6b], from:'A treasure on Halcyon Island'},
  lafayette:  {name:'Café Lafayette', paint:[0x2e5a46, 0xe6d6b4, 0xff5a6a], from:'Odile\'s champagne run'},
  desert:     {name:'Desert Rat', paint:[0xc8a25a, 0x6b3a2a, 0x2d2d2d], from:'A treasure in the Badlands'},
  sunset:     {name:'Mesa Sunset', paint:[0xe0742a, 0x7b3fa0, 0xf2c14e], from:'Gold in the Canyon Run'},
  glacier:    {name:'Glacier', paint:[0xf1f4f8, 0x8fb4d8, 0x1f2a44], from:'A treasure in the Frostback'},
  aurora:     {name:'Aurora', paint:[0x14284a, 0x5fe0b0, 0xb48ae8], from:'The Baroness\'s northern lights tour'},
  corsair:    {name:'Corsair', paint:[0x1f6f9e, 0xf1e9d6, 0xd94f4f], from:'A treasure in the Corsair Keys'},
  ledger:     {name:'Doubloon', paint:[0x3a2418, 0xdba63e, 0x8e231c], from:'The lost ledger'}
};

/* ---------- Chassis ----------
   arm: nose, tail, left wing, right wing. guns: stock calibers, one per gun position. slots: gun positions.
   cls: light/medium/heavy sets internal structure (80/120/240 after the heavy buff). */
const C = (o) => o;
G.CHASSIS = {
  gallant:    C({id:'gallant', name:'Gallant', role:'All-round fighter', cs:'Devastator', cls:'medium', speed:'Average', agility:'Average', armorR:'Average', offense:'Average',
                 max:8900, arm:[25,25,25,25], guns:['50','40'], slots:3, turrets:[], hp:4, hpMax:6, owned:true,
                 blurb:'The starter. Balanced, forgiving, and since the weight cut it can\'t have everything at once.'}),
  sparrowhawk:C({id:'sparrowhawk', name:'Sparrowhawk', role:'Agile dogfighter', cs:'Peacemaker', cls:'light', speed:'Good', agility:'Excellent', armorR:'Average', offense:'Fair',
                 max:7205, arm:[25,20,20,20], guns:['50','40'], slots:2, turrets:[], hp:3, hpMax:5}),
  vandal:     C({id:'vandal', name:'Vandal', role:'Pirate light fighter', cs:'Bloodhawk', cls:'light', speed:'Good', agility:'Excellent', armorR:'Average', offense:'Fair',
                 max:6545, arm:[20,20,20,20], guns:['40','30'], slots:2, turrets:[], hp:3, hpMax:4, pitchMul:0.9}),
  mantis:     C({id:'mantis', name:'Mantis', role:'Interceptor', cs:'Fury', cls:'light', speed:'Good', agility:'Good', armorR:'Average', offense:'Fair',
                 max:7610, arm:[25,25,20,20], guns:['70','30'], slots:2, turrets:[], hp:3, hpMax:4, interceptor:true}),
  jackal:     C({id:'jackal', name:'Jackal', role:'Interceptor with turret', cs:'Hellhound', cls:'medium', speed:'Good', agility:'Average', armorR:'Average', offense:'Poor',
                 max:9525, arm:[30,25,20,20], guns:['50','40'], slots:2, turrets:['50'], hp:3, hpMax:5, interceptor:true}),
  highwayman: C({id:'highwayman', name:'Highwayman', role:'All-rounder with turret', cs:'Brigand', cls:'heavy', speed:'Average', agility:'Fair', armorR:'Average', offense:'Average',
                 max:10985, arm:[30,35,20,20], guns:['60','30'], slots:2, turrets:['30'], hp:4, hpMax:6}),
  grackle:    C({id:'grackle', name:'Grackle', role:'Fighter-bomber', cs:'Kestrel', cls:'heavy', speed:'Average', agility:'Poor', armorR:'Average', offense:'Average',
                 max:13780, arm:[30,30,20,20], guns:['60','50'], slots:2, turrets:['40'], hp:5, hpMax:7}),
  ironclad:   C({id:'ironclad', name:'Ironclad', role:'Bomber', cs:'Firebrand', cls:'heavy', speed:'Average', agility:'Poor', armorR:'Good', offense:'Average',
                 max:14005, arm:[30,30,25,25], guns:['70','30'], slots:2, turrets:['30'], hp:6, hpMax:8, torpedo:true}),
  bulldog:    C({id:'bulldog', name:'Bulldog', role:'Heavy rocket gunship', cs:'Warhawk', cls:'heavy', speed:'Average', agility:'Poor', armorR:'Good', offense:'Average',
                 max:14675, arm:[30,30,30,30], guns:['70','50'], slots:2, turrets:[], hp:8, hpMax:8}),
  thunderbuss:C({id:'thunderbuss', name:'Thunderbuss', role:'Heavy bomber', cs:'Balmoral', cls:'heavy', speed:'Fair', agility:'Poor', armorR:'Good', offense:'Good',
                 max:15760, arm:[40,35,25,25], guns:['50','50'], slots:2, turrets:['30','30'], hp:8, hpMax:8, torpedo:true}),
  zephyr:     C({id:'zephyr', name:'Zephyr', role:'Twin-jet interceptor (Hollis turbojets)', cs:'—', cls:'light', speed:'Excellent', agility:'Fair', armorR:'Fair', offense:'Good',
                 max:8200, arm:[20,20,20,20], guns:['70','70','60','60'], slots:4, turrets:[], hp:2, hpMax:4, jet:true, interceptor:true,
                 blurb:'Augustin Hollis\'s masterpiece: two turbojets under swept wings and not a propeller in sight. Faster than anything in the sky, four cannon in the nose, slow to spool up, heavy on the stick, and it screams. Awarded to the Lucky Thirteen for finishing the whole story.'}),
  banshee:    C({id:'banshee', name:'Banshee', role:'Twin-boom fighter with a ghost drone (Quill)', cs:'—', cls:'medium', speed:'Good', agility:'Good', armorR:'Good', offense:'Excellent',
                 max:10400, arm:[30,30,25,25], guns:['60','60','50','50','30','30'], slots:6, turrets:[], hp:3, hpMax:5, drone:true,
                 blurb:'Dr. Quill built it from Ashgrove\'s own drawings and kept the best idea: a radio set in the booms that flies a pilotless ghost wingman. Launch the drone once a sortie (X) and it fights beside you until it\'s shot down. Six guns, twin booms, a pusher prop. Awarded for finishing Volume IV.'}),
  hornet:     C({id:'hornet', name:'Hornet', role:'Rocket-boosted interceptor (Kroll prototype)', cs:'—', cls:'medium', speed:'Excellent', agility:'Good', armorR:'Average', offense:'Good',
                 max:9900, arm:[25,25,20,20], guns:['60','60','50','50'], slots:4, turrets:[], hp:3, hpMax:5, interceptor:true, rocketBoost:true,
                 blurb:'The Iron Syndicate built it to catch anything in the sky; Hollis put it back together after you shot it down. Contra-rotating propellers, inverted gull wings, four cannon, and a rocket motor in the tail: six long burns of boost (Shift) that put it past the Zephyr for a few seconds at a time. Awarded for finishing Volume III.'}),
  comet:      C({id:'comet', name:'Comet', role:'Prototype racer-fighter (Meridian engine)', cs:'—', cls:'medium', speed:'Excellent', agility:'Good', armorR:'Average', offense:'Average',
                 max:9600, arm:[25,25,25,25], guns:['60','50'], slots:3, turrets:[], hp:4, hpMax:6, interceptor:true,
                 blurb:'Hollis\'s prototype, built around Cyrus Vane\'s Meridian engine. The fastest thing in the Sierra sky.'}),
  whirligig:  C({id:'whirligig', name:'Whirligig', role:'Autogyro', cs:'Hoplite', cls:'light', speed:'Average', agility:'Excellent', armorR:'Fair', offense:'Poor',
                 max:4160, arm:[15,15,15,15], guns:['30'], slots:1, turrets:[], hp:2, hpMax:2})
};
// the bombers' torpedo racks: how many air torpedoes each can carry
G.CHASSIS.grackle.torps = 1; G.CHASSIS.ironclad.torps = 2; G.CHASSIS.thunderbuss.torps = 2;
G.INTERNAL = {light:80, medium:120, heavy:240};
const gunsW = list => list.reduce((s, g) => s + (g ? G.GUNS[g].w : 0), 0);
for (const k in G.CHASSIS) {
  const c = G.CHASSIS[k];
  const stockW = gunsW(c.guns) + gunsW(c.turrets) + c.arm.reduce((a, b) => a + b, 0)*G.ARMOR_W + c.hp*G.HP_W;
  c.empty = c.max - stockW;
  c.heavy = c.cls === 'heavy';
}

/* Default loadout = the chassis as it leaves the factory. */
G.stockLoadout = id => {
  const c = G.CHASSIS[id], guns = [];
  for (let i = 0; i < c.slots; i++) guns.push({cal:c.guns[i] || null, ammo:'slug'});
  return {chassis:id, guns, turrets:c.turrets.map(t => ({cal:t, ammo:'slug'})), arm:c.arm.slice(), hp:c.hp, rocket:'he', engine:1, nitro:false,
          paint:(G.FACTORY_PAINT[id] || [0x7a1f1f, 0x1b1b1b, 0xd9b44a]).slice()};
};
/* factory colours: each make leaves the works in its own livery */
/* Each gang flies its own mix. A group is led by a Vandal (the pirates' workhorse), and only a group of three or more
   may bring one heavy (a gunship or bomber), so fights keep their pace. Weights are rough odds per wingman. */
G.GANG_FLEET = {
  lantern: {vandal:3, mantis:2, jackal:1},
  tigers:  {vandal:3, sparrowhawk:2, comet:1},
  rattlers:{vandal:2, jackal:2, highwayman:1},
  wolves:  {vandal:2, mantis:1, sparrowhawk:1, grackle:1},
  corsairs:{vandal:2, bulldog:2, thunderbuss:1},
  customs: {gallant:2, highwayman:1},
  brethren:{vandal:2, bulldog:2, highwayman:1, thunderbuss:1},
  syndicate:{mantis:3, jackal:2, grackle:1, bulldog:1},
  ghosts:{mantis:3, jackal:2, sparrowhawk:2},
  navy:    {gallant:3, sparrowhawk:1, highwayman:1}
};
G.HEAVY = new Set(['highwayman', 'grackle', 'ironclad', 'thunderbuss']);
G.gangChassis = (gang, i, n, used = {}) => {
  const f = G.GANG_FLEET[gang]; if (!f) return 'vandal';
  if (i === 0) return f.vandal ? 'vandal' : Object.keys(f)[0];
  let r = Math.random()*Object.values(f).reduce((a, b) => a + b, 0), c = 'vandal';
  for (const [k, w] of Object.entries(f)) { if ((r -= w) < 0) { c = k; break; } }
  if (G.HEAVY.has(c) && (n < 3 || used.heavy)) c = f.vandal ? 'vandal' : Object.keys(f)[0];
  if (G.HEAVY.has(c)) used.heavy = true;
  return c;
};
G.gangLoadout = (gang, i, n, used, paint) => {
  const L = G.stockLoadout(G.gangChassis(gang, i, n, used)); if (paint) L.paint = paint.slice(); L.rocket = Math.random() < 0.5 ? 'he' : 'flak'; return L;
};
G.FACTORY_PAINT = {gallant:[0x2f5d8a, 0xe9dcc0, 0xc0392b], comet:[0xc8ced4, 0xb5382c, 0x1f3b6b], vandal:[0x7a1f1f, 0x1b1b1b, 0xd9b44a],
  sparrowhawk:[0x2e6b4f, 0xf1e9d6, 0xf2c14e], mantis:[0x3b3f46, 0x9ef0a0, 0xd94f2a], jackal:[0xb5882a, 0x26221f, 0xe9dcc0], highwayman:[0x5a4632, 0xe8d8b0, 0x8e231c],
  grackle:[0x2b2f3a, 0xd94f2a, 0xc8ced4], ironclad:[0x5a6048, 0x2b2b2b, 0xd9b44a], bulldog:[0xd9b44a, 0x26221f, 0xc0392b], thunderbuss:[0x6b7a8a, 0xf1e9d6, 0x1f3b6b], whirligig:[0xe0742a, 0xf1e9d6, 0x2f5d8a], zephyr:[0x151515, 0xd9b44a, 0xe8c45a], hornet:[0x2a2a2a, 0xf2c14e, 0x9e1b1b], banshee:[0x2a3238, 0x9ef0e0, 0xe8e0cc]};

/* Weight of a loadout; spent = {ammoFrac:[per gun 0..1], rockets:n left} lightens it in flight. */
G.loadWeight = (L, spent) => {
  const c = G.CHASSIS[L.chassis]; let w = c.empty;
  L.guns.forEach((g, i) => { if (!g.cal) return; const gw = G.GUNS[g.cal].w; w += gw*(1 - G.AMMO_W) + gw*G.AMMO_W*(spent ? spent.ammo[i] : 1); });
  L.turrets.forEach(t => { if (t.cal) w += G.GUNS[t.cal].w; });
  w += L.arm.reduce((a, b) => a + b, 0)*G.ARMOR_W;
  const rk = spent ? spent.rockets : L.hp*3;
  w += L.hp*(G.HP_W - 3*G.ROCKET_W) + rk*G.ROCKET_W;
  w += G.ENGINE[L.engine].w + (L.nitro ? G.NITRO_W : 0) + Math.min(L.torps || 0, (G.CHASSIS[L.chassis] || {}).torps || 0)*G.TORP_W;
  return w;
};

/* Flight stats derived from a loadout. Load penalty: payload past 70% of the budget costs agility, up to -25% at 100%. */
G.flightStats = (L, spent) => {
  const c = G.CHASSIS[L.chassis], ag = G.RATE[c.agility];
  const w = G.loadWeight(L, spent), pay = Math.max(0, (w - c.empty)/(c.max - c.empty));
  const pen = 1 - 0.25*Math.max(0, Math.min(1, (pay - 0.7)/0.3));
  const mph = c.jet ? 375 + G.ENGINE[L.engine].mph*0.5 : SPEED_MPH[c.speed] + G.ENGINE[L.engine].mph + (c.interceptor ? 10 : 0) + ((L.mods || []).includes('prop') ? 8 : 0);   // a jet: far faster, and no propeller to tune
  return {
    weight:w, payload:pay, agilityMul:pen,
    top:mph*MPH, mph,
    pitch:(1.0 + 0.22*ag)*pen*(c.pitchMul || 1),
    roll:(2.2 + 0.5*ag)*pen*(c.interceptor ? 1.1 : 1),
    yaw:0.32 + 0.03*ag,
    rocket:!!c.rocketBoost, drone:!!c.drone, accel:c.jet ? 11 : (c.interceptor ? 13 : 10.5)*((L.mods || []).includes('prop') ? 1.12 : 1), jet:!!c.jet,
    climb:c.interceptor ? 1.3 : 1,
    bleed:c.interceptor ? 0.45 : 1,
    stall:mph*MPH*(c.heavy ? 0.29 : 0.36),
    internal:G.INTERNAL[c.cls]
  };
};
G.firepower = L => L.guns.reduce((s, g) => s + (g.cal ? G.GUNS[g.cal].rps*G.GUNS[g.cal].dmg : 0), 0);

/* ---------- 1920s name generator ---------- */
const FIRST_M = ['Arthur','Walter','Harold','Clarence','Elmer','Floyd','Chester','Homer','Leroy','Lester','Vernon','Wilbur','Rudolph','Ambrose','Thaddeus','Cornelius','Silas','Otis','Mortimer','Lucius','Augustus','Jasper','Virgil','Ezra','August','Emil','Sal','Vito','Dominic','Moe','Benny','Lou','Abe','Irving','Seamus','Casimir'];
const FIRST_F = ['Mabel','Edna','Gertrude','Hazel','Mildred','Myrtle','Ethel','Bernice','Lucille','Opal','Pearl','Viola','Winifred','Agnes','Dorothy','Josephine','Ruby','Velma','Beatrice','Lorraine','Irene','Ida','Rosalind','Theda','Clementine','Louise'];
const SUR = ['Kowalski','Pruitt','Varga','McAllister','Delacroix','Hennessy','Fitzgerald','Brennan','Moretti','Castellano','Novak','Lindqvist','Abernathy','Whitcomb','Pendleton','Sullivan','Gallagher','Rourke','Bellamy','Crowley','Dunmore','Holloway','Kaminski','Okafor','Szabo','Duchamp','Van Horn','Marchetti','Calloway','Blackwood','Thorne','Kessler','Shaughnessy','Romano','Petrakis','Ironside','Mulligan','Galloway'];
const NICK = ['Dutch','Hellcat','Lucky','Slim','Ace','Bugsy','Doc','Kid','Red','Whitey','Smoky','Bullseye','Stretch','Knuckles','Blackjack','Spade','Tiger','Duke','Rattler','Gin','Sparky','Jinx','Ivory','Halfpint','Mad Dog','Two-Gun','Nails','Dynamite','Sully','Moonshine'];
G.pick = (a, r = Math.random) => a[Math.floor(r()*a.length)];
G.name1920s = (opts = {}) => {
  const r = opts.rand || Math.random, fem = opts.fem !== undefined ? opts.fem : r() < 0.3;
  const f = G.pick(fem ? FIRST_F : FIRST_M, r), s = G.pick(SUR, r);
  if (opts.nick === false || (opts.nick === undefined && r() < 0.35)) return {first:f, last:s, nick:null, full:`${f} ${s}`, short:s};
  const n = G.pick(NICK, r);
  return {first:f, last:s, nick:n, full:`${f} "${n}" ${s}`, short:`"${n}" ${s}`};
};

/* ---------- Save ---------- */
const KEY = 'ace-of-the-airways-save-1';
G.newSave = () => ({v:1, callsign:'', cash:5000, sorties:0, wins:0, kills:0, view:'chase', vol:0.7, mouseSens:1, invert:false, aimAssist:true,
  load:G.stockLoadout('gallant'), owned:['gallant'], best:null, times:{}, mods:[], liveries:[], open:G.newOpen()});
G.newOpen = () => ({region:'halcyon', hour:10, day:1, found:{}, jobs:{}, stuntTotal:0, stuntBest:0, wing:false, milestones:[]});
G.loadSave = () => {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  G.save = Object.assign(G.newSave(), s || {}); G.save.open = Object.assign(G.newOpen(), G.save.open || {});
  if (!G.save.load || !G.CHASSIS[G.save.load.chassis]) G.save.load = G.stockLoadout('gallant');
};
G.persist = () => { try { localStorage.setItem(KEY, JSON.stringify(G.save)); } catch (e) {} };
G.resetSave = () => { G.save = G.newSave(); G.persist(); };
})();
