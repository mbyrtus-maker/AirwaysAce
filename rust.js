/* =====================================================================
   Region 6: Rustwater Valley and Gantry City.
   A river city of mills, smokestacks and seven bridges. Everything that's particular to it lives here: the region itself,
   its people and jobs, its landmarks (bridges, the dam, the steelworks, the gasworks, the broadcast tower, the prison),
   the industrial city, the elevated railway, barrage balloons and their cables, chimney updrafts, gas holders that go up
   in chains, and the Gantry Air Police with their "heat".
   ===================================================================== */
(() => {
'use strict';
const V3 = THREE.Vector3, RU = G.RUST, {Kit, box, cyl, bar, ball, lathe, lamp, T, RX, RY, RZ, mul} = G.KIT;
const tA = new V3(), tB = new V3(), tC = new V3(), UP = new V3(0, 1, 0);
const rx = RU.rx, rw = RU.rw, PI = Math.PI;
const bankX = (z, side, off) => rx(z) + side*(rw(z)/2 + off);   // a point `off` metres back from the water on the east (+1) or west (-1) bank
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a)/(b - a))); return t*t*(3 - 2*t); };

/* ---------- the seven bridges, south to north ---------- */
const BRIDGES = [
  {id:'drawbridge', kind:'draw', name:'the Harbour drawbridge', z:-2700, deck:13},
  {id:'stonebridge', kind:'stone', name:'the Old Stone Bridge', z:-1700, deck:15},
  {id:'liberty', kind:'suspension', name:'the Liberty Span', z:-700, deck:34},
  {id:'footbridge', kind:'foot', name:'the Iron Footbridge', z:200, deck:22},
  {id:'northern', kind:'truss', name:'the Northern Railway bridge', z:900, deck:18},
  {id:'millbridge', kind:'truss', name:'the Mill Street bridge', z:2700, deck:16},
  {id:'elbridge', kind:'el', name:'the El crossing', z:3500, deck:21}
];
const bridgeFrame = z => { const sl = RU.slope(z), n = Math.hypot(1, sl), ax = 1/n, az = -sl/n; return {c:new V3(rx(z), 0, z), yaw:Math.atan2(-az, ax), ax, az, L:rw(z) + 150}; };

/* ---------- the region ---------- */
const RW = {id:'rustwater', name:'Rustwater Valley', nation:'Commonwealth of Gantry', seed:5519, terrain:'rustwater', chart:[150, 118], danger:0.6, gang:'gearjammers', industrial:true,
  blurb:'Gantry City: steel mills, smokestacks and seven bridges over the Rustwater, all of it under a pall of smoke. The Air Police keep the peace over town; out past the mills the Gearjammers do as they please.',
  margaret:{x:rx(-6400), y:720, z:-6400},
  sites:[
    {id:'municipal', kind:'strip', name:'Gantry Municipal', contact:'strand', at:{x:bankX(-3500, -1, 640), z:-3500}, r:420, yaw:RU.slope(-3500), strip:{sign:'GANTRY MUNICIPAL', walls:0x8a4a32, trim:0x2a3a52, accent:0xd9b44a, grass:0x4a4a40, tar:0x2a2826, signCol:'#e8e0cc', signGlow:'#9ec7f0'}},
    {id:'coldwater', kind:'strip', name:'Coldwater Flats', contact:'mabs', at:{x:rx(1900), z:1900}, r:0, yaw:Math.atan2(RU.slope(1900), 1), strip:{sign:'COLDWATER FLATS', walls:0xd8c8a8, trim:0x1f6f9e, accent:0xc0392b, grass:0x4a5a3a, tar:0x3a3632, signCol:'#1f2a44', signGlow:'#ffd08a'}},
    {id:'quarry', kind:'strip', name:'Quarry Field', contact:'quill', at:{want:'flat', x:bankX(3400, -1, 1900), z:3400, r:800, minH:110}, r:380, yaw:0.3, town:6, strip:{sign:'QUARRY FIELD', walls:0x9a9488, trim:0x5a3a2a, accent:0xe0742a, grass:0x5a5a48, tar:0x4a4640, signCol:'#2a2410', signGlow:'#f2c14e'}},
    {id:'ziegler', kind:'hook', name:'the Ziegler Building', contact:'della', at:{x:bankX(-950, 1, 260), z:-950}, tower:{h:196, w:40, walls:0xb8a888, sign:'ZIEGLER BUILDING', signCol:'#2a1d10', signGlow:'#f2c14e'}},
    {id:'furnace', kind:'hook', name:'Furnace Row', contact:'stan', at:{x:bankX(2300, 1, 520), z:2300}, tower:{h:92, w:34, walls:0x4a3a32, sign:'FURNACE ROW · LOCAL 9', signCol:'#e8e0cc', signGlow:'#ff8a3a'}},
    {id:'undercroft', kind:'strip', name:'the Undercroft', contact:'bucco', at:{want:'cavern'}, cavern:true, town:10, townOff:[-145, 0], townR:80, strip:{sign:'THE UNDERCROFT', walls:0x5a5650, trim:0x2a3a3a, accent:0x9ef0a0, grass:0x3a3a36, tar:0x2a2826, signCol:'#9ef0a0', signGlow:'#c8ffd0'}}
  ],
  marks:[
    ...BRIDGES.map(b => ({id:b.id, kind:'bridge', bridge:b, name:b.name, at:{x:rx(b.z), z:b.z}})),
    {id:'dam', kind:'dam', name:'the Rustwater Dam', at:{x:rx(RU.DAM), z:RU.DAM}},
    {id:'steelworks', kind:'steelworks', name:'the Gantry Steel Company works', at:{x:bankX(3300, 1, 330), z:3300}},
    {id:'longshed', kind:'none', name:'the Long Shed', at:{x:bankX(3050, 1, 160), z:3050}},
    {id:'gasworks', kind:'gasworks', name:'the gasworks', at:{x:bankX(-3150, -1, 230), z:-3150}},
    {id:'wgcx', kind:'broadcast', name:'the WGCX tower', at:{want:'high', x:bankX(-400, 1, 1700), z:-400, r:500}},
    {id:'prison', kind:'prison', name:'Gantry Island prison', at:{x:rx(-5000) + 260, z:-5050}},
    {id:'rlight', kind:'lighthouse', name:'the Rustwater light', at:{want:'coast', a:2.62}},
    {id:'docks', kind:'none', name:'the docks', at:{x:bankX(-3800, 1, 60), z:-3800}},
    {id:'downtown', kind:'none', name:'downtown', at:{x:bankX(-700, 1, 200), z:-700}},
    {id:'millrow', kind:'none', name:'the mills', at:{x:bankX(1300, -1, 220), z:1300}},
    {id:'reservoir', kind:'none', name:'the reservoir', at:{x:rx(5600), z:5600}}
  ],
  tunnels:[
    {id:'hogback', name:'the Hogback rail tunnel', shape:'straight', amp:0, len:[300, 600], bw:30, bh:22, bonus:2500},
    {id:'coalhole', name:'the Coal Hole', shape:'bend', amp:30, len:[220, 460], bw:30, bh:20}
  ],
  cavern:{id:'undercroft', name:'the Undercroft', rx:300, rz:210, H:72, gate:{id:'outfall', name:'the storm-drain outfall', bw:36, bh:28, shape:'none'}},
  treasures:[
    {id:'w1', name:'The bootlegger\'s cache', at:'longshed', off:[0, 40], hint:'A bootlegger stashed a crate in the Long Shed at the steelworks, the hall you can fly straight through. Fly it low.', reward:{cash:3500}},
    {id:'w2', name:'The spillway strongbox', at:'dam', off:[0, -120], hint:'The dam\'s paymaster dropped his strongbox off the spillway in the flood of \'24. It\'s on the rocks below the dam.', reward:{livery:'rustbucket', cash:2000}},
    {id:'w3', name:'The Rooftop Mile', at:'downtown', race:{circuit:{at:'downtown', r:900, n:10, agl:70}}, hint:'Della\'s paperboys swear somebody laid out a time trial round the downtown rooftops. The gate\'s by the Ziegler Building.', reward:{cash:4500}},
    {id:'w4', name:'The warden\'s stash', at:'prison', off:[50, 30], hint:'Gantry Island\'s old warden kept a stash of confiscated goods outside the walls. Check the rocks.', reward:{cash:4000}},
    {id:'w5', name:'Quill\'s lost prototype', at:'quarry', off:[-260, 180], hint:'Dr. Quill\'s first engine flew off its test stand and landed somewhere in the quarry. He\'d like it back. Really.', reward:{mod:'spars', cash:1500}},
    {id:'w6', name:'The gas board payroll', at:'gasworks', off:[-140, 60], hint:'A gas board clerk ran off with the payroll and buried it behind the gasworks. Don\'t shoot the holders while you look.', reward:{cash:3500}}
  ]};
G.REGIONS.rustwater = RW;

/* ---------- the people ---------- */
Object.assign(G.CONTACTS, {
  strand:{name:'Captain Ida Strand', role:'Commander, Gantry Air Police', music:'swingin', look:{skin:'#e8c0a0', hair:'#5a3a22', hat:'naval', coat:'#1f2a44'},
    hello:['You\'re the Thirteen. I\'ve read your file. Fly straight over my city and we\'ll get along.', 'Every bullet that lands in Gantry gets written up. Every one.', 'Sit down. Coffee\'s terrible. It\'s free.'],
    shop:[{mod:'plate'}, {mod:'lights'}]},
  della:{name:'Della Ricci', role:'Crime reporter, the Gantry Courier', music:'indigo', look:{skin:'#e0b090', hair:'#1f1714', hat:'beret', lips:true, coat:'#7a2a2a'},
    hello:['Got a story for me? No? Then I\'ve got one for you.', 'The Courier pays for pictures. Good ones pay double.', 'Mind the presses, they bite.'], shop:[{mod:'lights'}]},
  stan:{club:true, name:'"Big Stan" Wozniak', role:'Organiser, Steelworkers Local 9', music:'foot', look:{skin:'#e0a888', hair:'#3a2a1a', hat:'cap', tache:true, coat:'#3a3530'},
    hello:['Union hall\'s open to anybody who works for a living. Even flyers.', 'The company\'s got guns and money. We\'ve got each other. And now you.'], shop:[{mod:'drums'}]},
  bucco:{name:'Sal "Fingers" Bucco', role:'Fixer, the Undercroft', music:'caravan', look:{skin:'#c88a60', hair:'#1f1714', hat:'bowler', tache:true, coat:'#2a2a2a'},
    hello:['Nobody followed you down the drain? Good. Sit.', 'Everything in Gantry has a price, pal. Even the police. Especially the police.'],
    shop:[{mod:'winch'}, {chassis:'jackal', price:21000}]},
  quill:{name:'Dr. Tobias Quill', role:'Inventor, Quarry Field', music:'sidewalk', look:{skin:'#e8c0a0', hair:'#d8d8d0', hat:'none', glasses:true, coat:'#6a5a3a'},
    hello:['Ah! A test pilot! Do you bounce? Never mind.', 'Mind the workbench. And the other workbench. And the ceiling.'], shop:[{mod:'spars'}, {chassis:'grackle', price:16000}]},
  mabs:{club:true, name:'"Mabs" Doyle', role:'Proprietor, the Coldwater Diner', music:'swing', look:{skin:'#f0c8a8', hair:'#c0582a', hat:'scarf', lips:true, coat:'#2f5d8a'},
    hello:['Pie\'s fresh, coffee\'s hot, and the river races start at noon.', 'You want the special? It\'s pie. It\'s always pie.'], shop:[{mod:'drums'}, {chassis:'gallant', price:9000}]}
});
G.ACES.mabs = [{id:'rivet', name:'"Rivet" Rosie Callahan', chassis:'gallant', paint:[0xc0392b, 0xf1e9d6, 0x2f5d8a], skill:0.74, purse:2400, line:'Mabs says you\'re the best flyer in the place. Mabs says that to everybody.'},
               {id:'hammer', name:'"Sledge" Novak', chassis:'bulldog', paint:[0x4a3a32, 0xe0742a, 0x1a1a1a], skill:0.86, purse:5000, guns:[['60', 'ex'], ['40', 'ap']], line:'Rosie\'s my cousin. Nobody beats my cousin but me.'}];
G.ACES.stan = [{id:'scab', name:'"Lefty" Malloy, company man', chassis:'mantis', paint:[0x2a3a52, 0xb8a888, 0x1a1a1a], skill:0.8, purse:3200, line:'The company pays me to keep you agitators out of the sky. I like my work.'}];
G.GANGS.gearjammers = {name:'the Gearjammers', paints:[[0x8a3a22, 0x1a1a1a, 0xd9b44a], [0x5a2a1a, 0x3a3a3a, 0xe0742a], [0x6a4a32, 0x1a1a1a, 0xc0392b]]};
G.GANGS.bluecoats = {name:'the Gantry Air Police', paints:[[0x1f2a44, 0xe8edf2, 0xd9b44a]]};
if (G.GANG_FLEET) { G.GANG_FLEET.gearjammers = {bulldog:3, grackle:2, vandal:1, jackal:1}; G.GANG_FLEET.bluecoats = {gallant:3, mantis:1}; }
if (G.LIVERIES) G.LIVERIES.rustbucket = {name:'Rust Bucket', paint:[0x8a3a22, 0x4a4a48, 0xd9b44a], from:'A Rustwater treasure'};

const P = 'rustwater';
G.JOBS.push(
  {id:'mabs_bridges', contact:'mabs', type:'race', title:'The Seven Bridges', pay:4200, rivals:3, laps:1, low:true, course:{path:['coldwater', 'elbridge', 'millbridge', 'northern', 'footbridge', 'liberty', 'stonebridge', 'drawbridge'], agl:9},
   blurb:'The river race: from the island down the Rustwater under all seven bridges, at water height. Mabs\' regulars race it every Sunday.', go:'Under, not over. Over doesn\'t count. Over gets you laughed at.'},
  {id:'mabs_slalom', contact:'mabs', type:'stunt', title:'The Smokestack Slalom', pay:3000, at:'millrow', r:700, target:6000, time:180, gates:4,
   blurb:'Show the mill hands a thing or two: 6,000 stunt points round the chimneys on Mill Row in three minutes. They\'re betting their lunch money.', go:'Mind the smoke. And the chimneys. Mostly the chimneys.'},
  {id:'della_papers', contact:'della', type:'errand', title:'The early edition', pay:2600, time:300, cargo:'Bundles of the Courier',
   legs:[{how:'drop', mark:'downtown', say:'Paperboys downtown have got it!'}, {how:'drop', mark:'millrow', say:'The mill gate gets its paper. The foremen hate this edition.'}, {how:'drop', mark:'docks', say:'Docks delivered. The stevedores cheered. Or jeered. Hard to tell.'}],
   blurb:'The presses broke down and the morning edition\'s late. Drop bundles downtown, at the mills and at the docks before the newsstands open. Low and slow over the streets.', go:'The Courier always delivers. Today, that means you.'},
  {id:'della_photo', contact:'della', type:'errand', title:'Who owns the Conductor?', pay:3200, night:true, time:300, cargo:'A camera and a lot of film',
   legs:[{how:'near', mark:'wgcx', r:250, say:'Got a shot of the WGCX aerials. Funny: there are more of them than the station needs.'}, {how:'low', mark:'gasworks', say:'Picture of the gasworks gate. Two men in grey coats, unloading crates marked "radio parts".'}],
   blurb:'Della\'s chasing a story about strange radio traffic at night. Get close to the WGCX tower, then low over the gasworks gate. Searchlights don\'t like photographers.', go:'If anybody asks, you\'re from the Gazette.'},
  {id:'strand_bounty', contact:'strand', type:'bounty', title:'The Gearjammers\' run', pay:4200, at:'millrow', gang:'gearjammers', n:4, waves:[3],
   blurb:'The Gearjammers have been robbing payroll trucks on Mill Row. Captain Strand wants them out of the sky, in that order.', go:'Keep your fire off the rooftops. I mean it.'},
  {id:'strand_night', contact:'strand', type:'bounty', title:'Night on the docks', pay:4800, night:true, at:'docks', gang:'gearjammers', n:4, waves:[3],
   blurb:'Smugglers\' planes are landing cargo on the docks at night under Gearjammer escort. Break it up.', go:'My searchlights will light them for you. Try not to hit my searchlights.'},
  {id:'strand_patrol', contact:'strand', type:'race', title:'Beat the beat', pay:2800, rivals:0, laps:1, course:{path:['municipal', 'docks', 'downtown', 'wgcx', 'millrow', 'municipal'], agl:110},
   blurb:'Strand times her officers on the city patrol circuit. Beat their best and she\'ll put your name on the board at Municipal.', go:'The record\'s held by my sergeant. He\'s unbearable about it.'},
  {id:'stan_food', contact:'stan', type:'errand', title:'Bread for the picket', pay:2400, time:300, cargo:'Bread, soup and blankets',
   legs:[{how:'land', site:'municipal', say:'Loaded at Municipal. The company men watched every crate.'}, {how:'drop', mark:'steelworks', say:'Food on the picket line. The lads are cheering.'}],
   blurb:'The steelworkers are out on strike and the company\'s starving them out. Pick up food at Municipal and drop it at the picket by the works gate.', go:'They\'ve got guards with rifles on the roofs. Fly fast.'},
  {id:'stan_scabs', contact:'stan', type:'bounty', title:'Company planes', pay:3800, at:'steelworks', gang:'gearjammers', n:3, waves:[3],
   blurb:'The company hired Gearjammers to buzz the picket line and scare the strikers off. Show them the strikers have friends with guns too.', go:'Solidarity, flyer. And good aim.'},
  {id:'bucco_run', contact:'bucco', type:'errand', title:'Up the canal', pay:3600, night:true, time:300, cargo:'Crates of "machine parts"', fragile:{hard:true},
   legs:[{how:'low', mark:'reservoir', say:'Over the dam and down on the water. The boat\'s waiting.'}, {how:'land', site:'quarry', say:'Delivered at Quarry Field. Quill didn\'t ask. Smart man.'}],
   blurb:'A load for a friend up the valley. Over the dam at wave-top height, under the police searchlights, and down at Quarry Field. Don\'t ask what\'s in the crates.', go:'If the coppers stop you, you\'ve never heard of me. Nobody has.'},
  {id:'bucco_drain', contact:'bucco', type:'race', title:'Down the drain', pay:3400, rivals:2, laps:1, low:true, course:{path:['undercroft', 'gasworks', 'drawbridge', 'docks', 'municipal'], agl:40},
   blurb:'Out of the Undercroft and down to the harbour, against two of Sal\'s couriers. Low over the gasworks, under the drawbridge if it\'s down.', go:'Losers pay for drinks. Winners drink.'},
  {id:'quill_updraft', contact:'quill', type:'stunt', title:'Ride the smoke', pay:2800, at:'steelworks', r:800, target:5000, time:180, gates:3,
   blurb:'Dr. Quill is studying the thermals off the steelworks chimneys. Score 5,000 stunt points over the works; the updrafts will help, if they don\'t kill you.', go:'Take notes! No, don\'t. Fly.'},
  {id:'quill_test', contact:'quill', type:'errand', title:'A test flight', pay:2200, time:240, cargo:'Dr. Quill\'s new instrument',
   legs:[{how:'near', mark:'dam', r:300, say:'Reading at the dam: steady.'}, {how:'near', mark:'wgcx', r:300, say:'Reading at the tower: the needle\'s going mad. Interesting.'}, {how:'land', site:'quarry', say:'Back at the quarry. Quill is very excited about the needle.'}],
   blurb:'Quill has built a gadget that "listens to the sky". Fly it past the dam and the WGCX tower and bring it back in one piece.', go:'If it starts humming, that\'s normal. If it starts smoking, that\'s not.'}
);

/* ---------- landmark builders ---------- */
const MK = G.MARK_KINDS || (G.MARK_KINDS = {});
const mats = {};
const M = (hex, o) => { const k = hex + JSON.stringify(o || {}); return mats[k] || (mats[k] = G.mat(hex, Object.assign({roughness:0.85}, o || {}))); };
const IRON = () => M(0x2e2c2a, {roughness:0.6, metalness:0.4}), STONE = () => M(0x7a7266), DARKSTONE = () => M(0x5a5650), RED = () => M(0x8a2a1a, {roughness:0.6});

/* every region object keeps its own collision lists: slabs (bridge decks and roofs you can fly under), cables, chimneys */
const lists = c => c.rw || (c.rw = {slabs:[], cables:[], chimneys:[], balloons:[], holders:[], sheds:[]});
const slab = (c, o) => { lists(c).slabs.push(o); return o; };
const inSlab = (s, p) => { const dx = p.x - s.c.x, dz = p.z - s.c.z, cs = Math.cos(s.yaw), sn = Math.sin(s.yaw), u = dx*cs - dz*sn, v = dx*sn + dz*cs; return Math.abs(u) < s.hl && Math.abs(v) < s.hw && p.y > s.y0 && p.y < s.y1; };

MK.bridge = function(g, md, p){
  const B = md.bridge, F = bridgeFrame(B.z), L = F.L, half = rw(B.z)/2, D = B.deck, k = new Kit(), w = g.world, grp = new THREE.Group();
  const toW = (u, v = 0) => new V3(F.c.x + u*Math.cos(F.yaw) + v*Math.sin(F.yaw), 0, F.c.z - u*Math.sin(F.yaw) + v*Math.cos(F.yaw));
  const pier = (u, top, hw = 5, hd = 8) => { k.add(box(hw*2, top + 8, hd*2), STONE(), T(u, (top - 8)/2, 0)); const q = toW(u); w.addBlocker({x:q.x, z:q.z, hw:Math.max(hw, hd)*0.8, hd:Math.max(hw, hd)*0.8, top}); };
  const deckBox = (u0, u1, y, wid = 14, th = 2.2, mat = DARKSTONE()) => k.add(box(u1 - u0, th, wid), mat, T((u0 + u1)/2, y - th/2, 0));
  const parapet = (u0, u1, y, wid = 14, mat = STONE()) => { for (const s of [1, -1]) k.add(box(u1 - u0, 1.2, 0.5), mat, T((u0 + u1)/2, y + 0.6, s*wid/2)); };
  const ramp = (sgn, y) => { const len = 90, u0 = sgn*L/2; k.add(box(Math.hypot(len, y - 7), 2, 14), DARKSTONE(), mul(T(u0 + sgn*len/2, (y + 7)/2 - 1, 0), RZ(-sgn*Math.atan2(y - 7, len)))); };   // the approach road down to the street
  const deckSlab = (u0, u1, y0, y1, wid = 16, extra = {}) => slab(this, Object.assign({c:toW((u0 + u1)/2), yaw:F.yaw, hl:(u1 - u0)/2, hw:wid/2, y0, y1}, extra));
  let label = 'UNDER THE BRIDGE';
  if (B.kind === 'stone') {
    const n = 5, span = L/n; for (let i = 1; i < n; i++) pier(-L/2 + i*span, D - 2, 6, 9);
    deckBox(-L/2, L/2, D, 14, 3.5, STONE()); parapet(-L/2, L/2, D);
    for (let i = 0; i < n; i++) { const u = -L/2 + (i + 0.5)*span; for (const s of [1, -1]) k.add(lathe([[span*0.5, -0.5], [span*0.5, 0.5]], 12, 1, 1, false), STONE(), mul(T(u, D - 3.5 - span*0.0, s*6.8), RX(PI/2))); }
    deckSlab(-L/2, L/2, D - 4.5, D + 3);
  } else if (B.kind === 'suspension') {
    const tu = half + 12, top = D + 82, sag = D + 10;
    for (const sgn of [1, -1]) { const u = sgn*tu; for (const s of [1, -1]) { k.add(box(5, top, 5), STONE(), T(u, top/2 - 4, s*9)); } k.add(box(5, 6, 23), STONE(), T(u, top - 6, 0)); k.add(box(5, 4, 23), STONE(), T(u, D + 14, 0)); k.add(ball(0.9, 6, 3), lamp(0xff3b30), T(u, top + 1, 0));
      const q = toW(u); w.addBlocker({x:q.x, z:q.z, hw:8, hd:8, top:top}); }
    deckBox(-L/2 - 40, L/2 + 40, D, 18, 3, IRON()); parapet(-L/2 - 40, L/2 + 40, D, 18, IRON());
    // main cables: anchor, tower, sag, tower, anchor; and they're deadly
    const curve = u => { const a = Math.abs(u); if (a > tu) return top - (top - D - 2)*((a - tu)/(L/2 + 40 - tu)); const t = u/tu; return sag + (top - sag)*t*t; };
    for (const s of [1, -1]) { let prev = null; for (let i = 0; i <= 40; i++) { const u = -L/2 - 40 + i*(L + 80)/40, pt = [u, curve(u), s*9]; if (prev) { k.add(bar(prev, pt, 0.9), IRON()); const a = toW(prev[0], prev[2]), b = toW(u, s*9); a.y = prev[1]; b.y = pt[1]; lists(this).cables.push({a, b, r:2.6, what:'the Liberty Span\'s cables'}); } prev = pt; } }
    for (let u = -tu + 10; u < tu; u += 12) for (const s of [1, -1]) k.add(bar([u, D, s*9], [u, curve(u), s*9], 0.25), IRON());
    deckSlab(-L/2 - 40, L/2 + 40, D - 4, D + 3, 20);
  } else if (B.kind === 'draw') {
    // two leaves hinged at the banks; every two minutes they lift for shipping
    for (const sgn of [1, -1]) { const u = sgn*(half + 4); pier(u, D + 24, 7, 10); k.add(box(12, 9, 18), M(0x6a4a3a), T(u, D + 28, 0)); k.add(box(13, 1, 19), IRON(), T(u, D + 33, 0)); }
    deckBox(-L/2, -half - 2, D); deckBox(half + 2, L/2, D); parapet(-L/2, -half - 2, D); parapet(half + 2, L/2, D);
    const leaves = [1, -1].map(sgn => { const lg = new THREE.Group(), lk = new Kit(); lk.add(box(half + 2, 2.4, 13), IRON(), T(-sgn*(half + 2)/2, -1.2, 0)); for (const s of [1, -1]) lk.add(box(half + 2, 1.4, 0.4), RED(), T(-sgn*(half + 2)/2, 0.7, s*6.5)); lk.build(lg); lg.position.set(sgn*(half + 2), D, 0); grp.add(lg); return lg; });
    const closed = deckSlab(-half - 2, half + 2, D - 3, D + 2.5);
    const lslabs = [1, -1].map(sgn => slab(this, {c:toW(sgn*(half - 4)), yaw:F.yaw, hl:6, hw:8, y0:D - 2, y1:D - 2, off:true}));
    let t = Math.random()*100;
    this.anim.push(dt => {
      t = (t + dt) % 120; if (this.drawCtl) t = this.drawCtl(t, dt); const a = t < 80 ? 0 : t < 88 ? (t - 80)/8 : t < 112 ? 1 : (120 - t)/8, ang = a*1.25; this.drawOpen = a > 0.04; this.drawT = t;
      leaves[0].rotation.z = ang; leaves[1].rotation.z = -ang; closed.off = a > 0.08;
      for (const s of lslabs) { s.off = a < 0.08; s.y1 = D + Math.sin(ang)*(half + 2); }
      if (Math.abs(t - 80) < dt && G.HUD && this.g && this.g.player && this.g.player.pos.distanceTo(F.c) < 1500) G.HUD.toast('The drawbridge is going up!');
    });
  } else if (B.kind === 'foot') {
    deckBox(-L/2, L/2, D, 6, 1.2, IRON()); parapet(-L/2, L/2, D, 6, IRON());
    const ah = 26; let prev = null; for (let i = 0; i <= 20; i++) { const u = -half + i*2*half/20, y = D + ah*Math.sin(PI*i/20); for (const s of [1, -1]) { if (prev) k.add(bar([prev[0], prev[1], s*3], [u, y, s*3], 0.6), RED()); k.add(bar([u, D, s*3], [u, y, s*3], 0.15), IRON()); } prev = [u, y]; }
    for (const sgn of [1, -1]) pier(sgn*half, D - 1, 3, 4);
    deckSlab(-L/2, L/2, D - 2, D + ah + 1, 8);
  } else if (B.kind === 'truss' || B.kind === 'el') {
    const th = B.kind === 'truss' ? 13 : 3.5, piers = B.kind === 'truss' ? [-half*0.33, half*0.33] : [-half*0.5, 0, half*0.5];
    for (const u of piers) pier(u, D - 1.5, 4, 7);
    deckBox(-L/2, L/2, D, 11, 1.6, IRON());
    if (B.kind === 'truss') { for (const s of [1, -1]) { for (const yy of [D, D + th]) k.add(box(L, 0.8, 0.8), IRON(), T(0, yy, s*5.5)); for (let u = -L/2; u < L/2 - 1; u += 10) { k.add(bar([u, D, s*5.5], [u + 10, D + th, s*5.5], 0.4), IRON()); k.add(bar([u + 10, D, s*5.5], [u, D + th, s*5.5], 0.4), IRON()); k.add(bar([u, D, s*5.5], [u, D + th, s*5.5], 0.4), IRON()); } } for (let u = -L/2; u < L/2; u += 10) k.add(box(0.5, 0.5, 11), IRON(), T(u, D + th, 0)); label = 'UNDER THE RAILWAY'; }
    else { for (const s of [1, -1]) k.add(box(L, 2.2, 0.4), M(0x3a4a42, {metalness:0.3}), T(0, D + 0.6, s*5.4)); label = 'UNDER THE EL'; }
    deckSlab(-L/2, L/2, D - 3, D + th + 1, 12);
  }
  if (B.kind !== 'el') for (const sgn of [1, -1]) ramp(sgn, D);
  k.build(grp); grp.position.set(F.c.x, 0, F.c.z); grp.rotation.y = F.yaw; g.scene.add(grp);
  this.arches.push({pos:new V3(F.c.x, 0, F.c.z), len:rw(B.z) - 8, deck:B.kind === 'draw' ? D : D - 2, yaw:F.yaw, prev:undefined, name:md.name, t:-99, label, bonus:1000});
  p.y = D; this.markObj[md.id] = grp;
};

MK.dam = function(g, md, p){
  const w = g.world, k = new Kit(), grp = new THREE.Group(), zc = RU.DAM, top = RU.LAKE + 12, x0 = rx(zc);
  // find the valley walls
  let xl = x0, xr = x0; while (xl > x0 - 3000 && w.height(xl, zc, true) < top) xl -= 20; while (xr < x0 + 3000 && w.height(xr, zc, true) < top) xr += 20;
  xl -= 30; xr += 30; const L = xr - xl, xm = (xl + xr)/2, gap = 22, sh = 32;
  // the wall, with a spillway arch at the river you can fly through
  for (const [a, b] of [[xl, x0 - gap], [x0 + gap, xr]]) { const len = b - a; k.add(box(len, top, 14), M(0xa8a298), T((a + b)/2 - x0, top/2, 0)); k.add(box(len, top*0.6, 16), M(0x9a948a), T((a + b)/2 - x0, top*0.3, -9));
    for (let x = a; x < b; x += 30) w.addBlocker({x:x + 15, z:zc, hw:16, hd:16, top}); }
  k.add(box(gap*2, top - sh, 14), M(0xa8a298), T(0, sh + (top - sh)/2, 0)); k.add(lathe([[gap, -7], [gap, 7]], 14, 1, 1, false), M(0x8a847a), mul(T(0, sh - gap*0.4, 0), RX(PI/2)));
  slab(this, {c:new V3(x0, 0, zc), yaw:0, hl:gap, hw:9, y0:sh - 2, y1:top + 2});
  for (let x = xl + 40; x < xr - 40; x += 60) k.add(box(4, 6, 8), M(0x8a847a), T(x - x0, top + 3, 2));          // the gate houses along the crest
  k.add(box(L, 1.2, 16), M(0x6a6460), T(xm - x0, top + 0.6, 0));
  // the reservoir, held up behind it
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(5600, 3200), new THREE.MeshStandardMaterial({color:0x36545a, roughness:0.25, metalness:0.1, transparent:true, opacity:0.92}));
  lake.rotation.x = -PI/2; lake.position.set(x0, RU.LAKE, zc + 1610); g.scene.add(lake);
  // white water out of the spillway
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(gap*1.6, 60), new THREE.MeshBasicMaterial({color:0xe8f0f0, transparent:true, opacity:0.75})); foam.rotation.x = -PI/2 + 0.25; foam.position.set(0, 4, -32); grp.add(foam);
  this.anim.push(() => { if (Math.random() < 0.5) g.fx.smoke.emit(x0 + (Math.random() - 0.5)*30, 6, zc - 20 - Math.random()*40, 0, 3, -2, 5, 2, 0.85, 0.88, 0.9, 0.35, 4, 0.6, 2); });
  k.build(grp); grp.position.set(x0, 0, zc); g.scene.add(grp);
  this.arches.push({pos:new V3(x0, 0, zc), len:gap*2 - 6, deck:sh - 1, yaw:0, prev:undefined, name:md.name, t:-99, label:'THROUGH THE SPILLWAY', bonus:2500});
  p.y = top; this.P.spillway = new V3(x0, 14, zc);
  // barrage balloons over the dam
  for (let i = 0; i < 5; i++) balloon(this, g, new V3(xl + (i + 0.5)*L/5, w.height(xl + (i + 0.5)*L/5, zc + 140, true), zc + 140), 230 + i*18);
};

MK.steelworks = function(g, md, p){
  const w = g.world, k = new Kit(), z0 = 2650, z1 = 4150, side = 1, glow = M(0x5a2a10, {emissive:0xff6a1a, emissiveIntensity:this.night ? 1.4 : 0.5});
  const at = (z, off) => { const x = bankX(z, side, off); return {x, z, y:w.height(x, z, true)}; };
  const L = lists(this);
  // blast furnaces with their stoves, by the river where the ore barges tie up
  for (let i = 0; i < 4; i++) {
    const q = at(2750 + i*330, 110), y = q.y;
    k.add(cyl(11, 14, 40, 12), M(0x3a3230), T(q.x, y + 20, q.z)); k.add(cyl(5, 11, 12, 12), M(0x2e2826), T(q.x, y + 46, q.z)); k.add(cyl(2, 2, 22, 8), IRON(), T(q.x, y + 63, q.z));
    k.add(cyl(14.5, 14.5, 3, 12), glow, T(q.x, y + 4, q.z));
    for (let j = 0; j < 3; j++) k.add(cyl(6, 6, 36, 10), M(0x5a4a40), T(q.x + 30, y + 18, q.z - 22 + j*22));
    k.add(bar([q.x, y + 52, q.z], [q.x + 30, y + 36, q.z], 1.4), IRON());
    w.addBlocker({x:q.x, z:q.z, hw:13, hd:13, top:y + 74}); w.addBlocker({x:q.x + 30, z:q.z, hw:7, hd:30, top:y + 36});
    L.chimneys.push({x:q.x, z:q.z, top:y + 74, hot:2});
  }
  // a row of chimneys, the tallest things in the valley after the radio mast
  for (let i = 0; i < 8; i++) {
    const q = at(2700 + i*180, 300 + (i % 2)*40), h = 88 + (i % 3)*12;
    k.add(cyl(2.6, 4.2, h, 10), M(0x6a3022), T(q.x, q.y + h/2, q.z)); for (const yy of [h - 4, h - 10]) k.add(cyl(2.9, 2.9, 2, 10), M(i % 2 ? 0xe8e0d0 : 0x9e1b1b), T(q.x, q.y + yy, q.z));
    w.addBlocker({x:q.x, z:q.z, hw:4, hd:4, top:q.y + h}); L.chimneys.push({x:q.x, z:q.z, top:q.y + h, hot:1.4});
  }
  // rolling mills and sheds, and the Long Shed you can fly straight through
  for (let i = 0; i < 6; i++) { const q = at(2700 + i*240, 470), len = 150; k.add(box(48, 20, len), M(0x4a4440), T(q.x, q.y + 10, q.z)); for (let j = 0; j < 6; j++) k.add(box(48, 1, 14), M(0x3a3634), mul(T(q.x, q.y + 22, q.z - len/2 + 12 + j*25), RX(0.5))); w.addBlocker({x:q.x, z:q.z, hw:24, hd:len/2, top:q.y + 24}); }
  const S = this.P.longshed || at(3050, 160), sy = w.height(S.x, S.z, true), sl = 270, swid = 36, sh = 24;
  for (const s of [1, -1]) { k.add(box(2, sh, sl), M(0x5a4a40), T(S.x + s*swid/2, sy + sh/2, S.z)); for (let z = -sl/2; z < sl/2; z += 18) { w.addBlocker({x:S.x + s*(swid/2 + 1), z:S.z + z + 9, hw:2.5, hd:9, top:sy + sh}); k.add(box(2.4, sh, 1.2), IRON(), T(S.x + s*(swid/2 + 0.5), sy + sh/2, S.z + z)); } }
  k.add(box(swid + 4, 2, sl), M(0x3a3634), T(S.x, sy + sh + 1, S.z)); for (let z = -sl/2 + 10; z < sl/2; z += 30) k.add(box(swid, 0.8, 0.8), IRON(), T(S.x, sy + sh - 1, S.z + z));
  for (let z = -sl/2 + 20; z < sl/2; z += 40) k.add(ball(0.7, 6, 3), lamp(0xffb060), T(S.x, sy + sh - 2.5, S.z + z));
  slab(this, {c:new V3(S.x, 0, S.z), yaw:0, hl:swid/2 + 3, hw:sl/2, y0:sy + sh - 0.5, y1:sy + sh + 3});
  L.sheds.push({x:S.x, z:S.z, y0:sy, y1:sy + sh, hw:swid/2, hl:sl/2, prev:0, t:-99});
  // slag heaps glowing and a gantry crane
  for (let i = 0; i < 3; i++) { const q = at(3600 + i*160, 620); k.add(cyl(4, 40, 22, 9), M(0x2a2624), T(q.x, q.y + 11, q.z)); k.add(cyl(3, 6, 2, 9), glow, T(q.x, q.y + 22, q.z)); }
  const gq = at(3300, 40); for (const s of [-20, 20]) k.add(box(3, 30, 3), M(0xd9b44a, {roughness:0.5}), T(gq.x + s, gq.y + 15, gq.z)); k.add(box(46, 3, 4), M(0xd9b44a, {roughness:0.5}), T(gq.x, gq.y + 31, gq.z));
  const grp = new THREE.Group(); k.build(grp); g.scene.add(grp);
  if (this.night) { const pl = new THREE.PointLight(0xff7a2a, 2.2, 900, 1.6); pl.position.set(bankX(3200, 1, 150), 60, 3200); g.scene.add(pl); }
  let ft = 0; this.anim.push(dt => { ft += dt; glow.emissiveIntensity = (this.night ? 1.3 : 0.45)*(0.85 + 0.15*Math.sin(ft*3.1) + 0.05*Math.sin(ft*11)); });
  p.y = w.height(p.x, p.z, true);
};

MK.gasworks = function(g, md, p){
  const w = g.world, L = lists(this), c = this;
  const ring = [[0, 0], [70, 30], [-60, 50], [20, -80], [-40, -60]];
  ring.forEach(([dx, dz], i) => {
    const x = p.x + dx, z = p.z + dz, y = w.height(x, z, true), r = 22 + (i % 2)*4, h = 28 + (i % 3)*8, grp = new THREE.Group(), k = new Kit();
    k.add(cyl(r, r, h, 18), M(i % 2 ? 0x5a6a5a : 0x6a6458, {roughness:0.6, metalness:0.2}), T(0, h/2, 0)); k.add(cyl(r*0.6, r, 3, 18), M(0x4a5248), T(0, h + 1.5, 0));
    for (let j = 0; j < 10; j++) { const a = j/10*PI*2; k.add(box(1.2, h + 12, 1.2), RED(), T(Math.cos(a)*(r + 2), (h + 12)/2, Math.sin(a)*(r + 2))); }
    for (const yy of [h*0.4, h + 10]) k.add(lathe([[r + 2, -0.5], [r + 2, 0.5]], 18, 1, 1, false), RED(), T(0, yy, 0));
    k.build(grp); grp.position.set(x, y, z); g.scene.add(grp);
    w.addBlocker({x, z, hw:r*0.9, hd:r*0.9, top:y + h + 2});
    const t = g.addTarget({kind:'gas', label:'GAS HOLDER', pos:new V3(x, y + h*0.6, z), r:r + 2, hp:140, group:grp, team:9});
    t.onDown = (gg, src) => gasBoom(c, gg, t, src); L.holders.push(t);
  });
  const k = new Kit(); k.add(box(30, 10, 18), M(0x7a3a2a), T(p.x - 90, p.y + 5, p.z + 80)); k.add(cyl(2, 3, 36, 8), M(0x6a3022), T(p.x - 100, p.y + 18, p.z + 70)); L.chimneys.push({x:p.x - 100, z:p.z + 70, top:p.y + 36, hot:0.6});
  const grp = new THREE.Group(); k.build(grp); g.scene.add(grp);
  for (let i = 0; i < 4; i++) { const a = i*PI/2 + 0.4, x = p.x + Math.cos(a)*190, z = p.z + Math.sin(a)*190; balloon(this, g, new V3(x, w.height(x, z, true), z), 200 + i*15); }
};
/* a gas holder goes up: a fireball that hurts anything close, and sets off its neighbours a moment later */
function gasBoom(c, g, t, src){
  const at = t.pos.clone(); g.fx.explosion(at, 6); g.fx.explosion(at.clone().add(new V3(0, 14, 0)), 4); if (g.audio) g.audio.boom(at, true);
  for (let i = 0; i < 30; i++) g.fx.fire.emit(at.x + (Math.random() - 0.5)*40, at.y + Math.random()*30, at.z + (Math.random() - 0.5)*40, 0, 18 + Math.random()*20, 0, 12, 2.5, 1, 0.5, 0.15, 1, 0, 1, 2);
  for (const q of g.planes) { if (!q.alive) continue; const d = q.pos.distanceTo(at); if (d < 150) q.damage(380*(1 - d/150), q.facingOf ? q.facingOf(at) : 0, G.AMMO.slug, src || null); }
  const fromPlayer = src && src === g.player || t.byPlayer;
  if (fromPlayer && c.heatAdd) c.heatAdd(g, 25, 'You blew up a gas holder!');
  for (const o of lists(c).holders) if (o.alive && o !== t && o.pos.distanceTo(at) < 115 && Math.random() < 0.6) setTimeout(() => { if (o.alive && G.game === g) { o.byPlayer = fromPlayer; g.hitTarget(o, 9999, null); } }, 600 + Math.random()*900);
  if (c.onGasBoom) c.onGasBoom(g, t, fromPlayer);
}

MK.broadcast = function(g, md, p){
  const w = g.world, k = new Kit(), H = 250, y0 = p.y, red = lamp(0xff3b30), L = lists(this);
  const wAt = y => 7 - 5.5*(y/H);
  for (let y = 0; y < H; y += 12) { const a = wAt(y), b = wAt(y + 12);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) k.add(bar([sx*a, y0 + y, sz*a], [sx*b, y0 + y + 12, sz*b], 0.5), RED());
    for (const [s0, s1] of [[[1, 1], [1, -1]], [[1, -1], [-1, -1]], [[-1, -1], [-1, 1]], [[-1, 1], [1, 1]]]) k.add(bar([s0[0]*a, y0 + y, s0[1]*a], [s1[0]*b, y0 + y + 12, s1[1]*b], 0.25), (y/12) % 2 ? M(0xe8e0d0) : RED());
    if (y % 48 === 0) for (const [sx, sz] of [[1, 1], [-1, -1]]) k.add(ball(0.8, 6, 3), red, T(sx*a, y0 + y, sz*a)); }
  k.add(cyl(0.3, 0.6, 30, 6), IRON(), T(0, y0 + H + 15, 0)); k.add(ball(1.2, 8, 4), red, T(0, y0 + H + 31, 0));
  // the aerial array near the top: what Volume IV is about
  const aer = []; for (let i = 0; i < 4; i++) { const a = i*PI/2, ap = new V3(Math.cos(a)*12, y0 + H - 20, Math.sin(a)*12); k.add(bar([0, ap.y, 0], [ap.x, ap.y, ap.z], 0.4), IRON()); k.add(box(2, 8, 2), M(0xd8d0c0), T(ap.x, ap.y, ap.z)); aer.push(ap); }
  k.add(box(14, 6, 10), M(0x8a7a6a), T(16, y0 + 3, 0)); k.add(box(12, 1, 3), lamp(0x9ec7f0), T(16, y0 + 6.5, 5.1));
  const grp = new THREE.Group(); k.build(grp); grp.position.set(p.x, 0, p.z); g.scene.add(grp);
  w.addBlocker({x:p.x, z:p.z, hw:7, hd:7, top:y0 + H + 30});
  // guy wires: three ways, three heights; they'll take a wing off
  for (let i = 0; i < 3; i++) { const a = i*PI*2/3 + 0.3, gx = p.x + Math.cos(a)*230, gz = p.z + Math.sin(a)*230, gy = w.height(gx, gz, true);
    for (const f of [0.35, 0.62, 0.9]) { const top = new V3(p.x + Math.cos(a)*wAt(H*f), y0 + H*f, p.z + Math.sin(a)*wAt(H*f)), bot = new V3(gx, gy, gz);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, top.distanceTo(bot), 4), M(0x2a2a2a)); m.position.copy(top).add(bot).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, tA.copy(top).sub(bot).normalize()); g.scene.add(m);
      L.cables.push({a:top, b:bot, r:2.2, what:'a guy wire on the WGCX tower'}); } }
  this.wgcx = {pos:new V3(p.x, y0 + H, p.z), aerials:aer.map(a => a.clone().add(new V3(p.x, 0, p.z))), base:new V3(p.x, y0, p.z)};
  for (let i = 0; i < 5; i++) { const a = i*PI*2/5 + 1, x = p.x + Math.cos(a)*420, z = p.z + Math.sin(a)*420; balloon(this, g, new V3(x, w.height(x, z, true), z), y0 + 120 + i*20 - w.height(x, z, true)); }
  p.y = y0;
};

MK.prison = function(g, md, p){
  const w = g.world, k = new Kit(), y = Math.max(p.y, 6), S = M(0x8a8478);
  for (const [cx, cz, lx, lz] of [[0, 60, 160, 4], [0, -60, 160, 4], [80, 0, 4, 120], [-80, 0, 4, 120]]) { k.add(box(lx, 12, lz), S, T(p.x + cx, y + 6, p.z + cz)); w.addBlocker({x:p.x + cx, z:p.z + cz, hw:lx/2 + 1, hd:lz/2 + 1, top:y + 12}); }
  for (const [cx, cz] of [[80, 60], [80, -60], [-80, 60], [-80, -60]]) { k.add(box(8, 22, 8), S, T(p.x + cx, y + 11, p.z + cz)); k.add(box(10, 3, 10), M(0x5a5450), T(p.x + cx, y + 23, p.z + cz)); k.add(ball(0.8, 6, 3), lamp(0xffe2a0), T(p.x + cx, y + 26, p.z + cz)); }
  k.add(box(90, 18, 30), M(0x7a7266), T(p.x, y + 9, p.z)); k.add(box(16, 40, 16), M(0x6a645a), T(p.x, y + 20, p.z)); k.add(cyl(0.3, 0.3, 10, 6), IRON(), T(p.x, y + 45, p.z));
  w.addBlocker({x:p.x, z:p.z, hw:45, hd:15, top:y + 18}); w.addBlocker({x:p.x, z:p.z, hw:8, hd:8, top:y + 40});
  const grp = new THREE.Group(); k.build(grp); g.scene.add(grp);
  this.skyBeams && this.skyBeams(g, {x:p.x, z:p.z}, 2, 60);
};

/* ---------- barrage balloons: silver, finned, on a steel cable you won't see until you hit it ---------- */
function balloon(c, g, ground, h){
  const top = ground.clone().add(new V3(0, h, 0)), grp = new THREE.Group(), k = new Kit();
  k.add(lathe([[0.3, -9], [3.2, -7], [4.6, -3], [4.8, 1], [4, 5], [1.5, 8], [0.2, 9]], 10, 1, 1), M(0xb8bcc0, {roughness:0.5, metalness:0.2}), RX(PI/2));
  for (const a of [0, PI*2/3, PI*4/3]) k.add(box(0.3, 4.6, 4.2), M(0x9a9ea2), mul(RZ(a), T(0, 4.3, -7)));
  k.build(grp); grp.position.copy(top); grp.rotation.y = Math.random()*PI*2; g.scene.add(grp);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, h, 4), M(0x3a3a3a)); cab.position.copy(ground).add(new V3(0, h/2, 0)); g.scene.add(cab);
  const winch = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), M(0x4a5248)); winch.position.copy(ground).add(new V3(0, 1, 0)); g.scene.add(winch);
  const B = {grp, cab, cable:{a:top.clone().add(new V3(0, -4, 0)), b:ground.clone(), r:2.2, what:'a barrage balloon cable'}, alive:true, bob:Math.random()*6};
  lists(c).cables.push(B.cable); lists(c).balloons.push(B);
  const t = g.addTarget({kind:'balloon', label:'a barrage balloon', pos:top, r:6, hp:25, group:grp, team:9});
  t.onDown = () => { B.alive = false; B.cable.off = true; g.scene.remove(cab); g.fx.explosion(top, 1.2); };
  c.anim.push(dt => { if (!B.alive) return; B.bob += dt; grp.position.y = top.y + Math.sin(B.bob*0.4)*1.5; grp.rotation.y += dt*0.02; });
  return B;
}

/* ---------- Gantry City: blocks of brick and soot along both banks ---------- */
const PAL = {brick:[0x7a3a2a, 0x8a4a32, 0x6a3022, 0x5a2a20, 0x7a4a3a], stone:[0x6a645a, 0x7a7266, 0x8a8476, 0x5a5650], cream:[0xb8a888, 0xa89878, 0xc8b898], ware:[0x6a4a3a, 0x4a4a48, 0x5a4636], roof:[0x2a2826, 0x3a3430, 0x2e2a28]};
const pick = (rr, a) => a[Math.floor(rr()*a.length)];
function buildCity(c, g){
  const w = g.world, rr = G.rng(5519), tiles = new Map(), night = c.night, L = lists(c);
  const lit = M(0x2a2a30, {emissive:0xffc070, emissiveIntensity:night ? 0.9 : 0.06, roughness:0.4}), dark = M(0x1e2024, {roughness:0.35, metalness:0.2});
  const tile = (x, z) => { const key = Math.floor(x/900) + ',' + Math.floor(z/900); if (!tiles.has(key)) tiles.set(key, new Kit()); return tiles.get(key); };
  // places to keep clear: the airstrip, the skyhooks and their approaches, bridge roads, the railway, the big works
  const keep = [];
  for (const s of c.sites) if (s.kind === 'hook') { const a = Math.atan2(-s.point.x, -s.point.z); keep.push({lane:true, x:s.point.x, z:s.point.z, dx:Math.sin(a), dz:Math.cos(a), len:620, hw:62}); keep.push({x:s.point.x, z:s.point.z, r:60}); }
  for (const B of BRIDGES) { const F = bridgeFrame(B.z); for (const sgn of [1, -1]) keep.push({lane:true, x:F.c.x, z:F.c.z, dx:sgn*F.ax, dz:sgn*F.az, len:F.L/2 + 260, hw:20}); }
  for (const id of ['gasworks']) if (c.P[id]) keep.push({x:c.P[id].x, z:c.P[id].z, r:260});
  if (c.rail) for (let i = 0; i < c.rail.pts.length; i += 3) keep.push({x:c.rail.pts[i].x, z:c.rail.pts[i].z, r:16});
  const clear = (x, z) => keep.some(k => { if (!k.lane) return Math.hypot(x - k.x, z - k.z) < k.r; const ux = x - k.x, uz = z - k.z, al = ux*k.dx + uz*k.dz; return al > -k.hw && al < k.len && Math.abs(ux*k.dz - uz*k.dx) < k.hw; });
  const steel = (x, z) => z > 2550 && z < 4250 && x > rx(z);
  const bands = (k, x, y, z, wv, dv, h, floors, H0 = 3.6) => { for (let f = 0; f < floors; f++) { const yy = y + 2.4 + f*H0, m = rr() < (night ? 0.55 : 0.2) ? lit : dark; k.add(box(wv + 0.3, 1.15, dv - 3), m, T(x, yy, z)); k.add(box(wv - 3, 1.15, dv + 0.3), m, T(x, yy, z)); } };
  let n = 0;
  const STEP = 66;
  for (let z = -4400; z < 4200; z += STEP) for (let x = rx(z) - 1800; x < rx(z) + 1800; x += STEP) {
    const bx = x + STEP/2, bz = z + STEP/2, b = RU.bank(bx, bz);
    if (!RU.city(bx, bz) || b < 30 || steel(bx, bz) || w.flatW(bx, bz) > 0.01 || RU.isle(bx, bz)) continue;
    const edge = RU.fp(bz) - b, down = bz > -1800 && bz < 400 && b < 700, docks = bz < -3000, mills = bz > 300 && bz < 2500 && b < 520;
    if (edge < 220 && rr() < 0.55) continue;
    if (!down && !docks && !mills && rr() < (b > 650 ? 0.6 : 0.3)) continue;                                // the edge of town thins out
    if (rr() < 0.1) continue;                                                                            // a yard, a church, a vacant lot
    const lots = down || docks || mills ? 1 : rr() < 0.75 ? 1 : 2, lw = 52/(lots === 4 ? 2 : lots === 2 ? 2 : 1), ld = 52/(lots === 4 ? 2 : 1);
    for (let i = 0; i < lots; i++) {
      const cx = bx - 26 + lw/2 + (lots > 1 ? (i % 2)*lw : 0), cz = bz - 26 + ld/2 + (lots === 4 ? Math.floor(i/2)*ld : 0);
      if (clear(cx, cz)) continue;
      const y = w.height(cx, cz, true), k = tile(cx, cz), wv = lw - 4 - rr()*6, dv = ld - 4 - rr()*6; let top;
      if (down) {
        const near = Math.max(0, 1 - Math.hypot(cx - bankX(-800, 1, 200), cz + 800)/900), h = 22 + rr()*30 + near*near*85, col = pick(rr, rr() < 0.5 ? PAL.cream : PAL.stone);
        let hh = 0, ww = wv, dd = dv; const tiers = h > 60 ? 3 : h > 36 ? 2 : 1;
        for (let t2 = 0; t2 < tiers; t2++) { const th = t2 === 0 ? h*0.6 : h*0.4/(tiers - 1); k.add(box(ww, th, dd), M(col), T(cx, y + hh + th/2, cz)); bands(k, cx, y + hh, cz, ww, dd, th, Math.floor(th/3.6)); k.add(box(ww + 1, 0.8, dd + 1), M(0x4a4440), T(cx, y + hh + th, cz)); hh += th; ww *= 0.72; dd *= 0.72; }
        if (h > 80 && rr() < 0.6) { k.add(cyl(0.2, 2.6, 14, 8), M(0xc8c0a8, {metalness:0.4, roughness:0.4}), T(cx, y + hh + 7, cz)); k.add(ball(0.6, 6, 3), lamp(0xff3b30), T(cx, y + hh + 14.5, cz)); hh += 14; }
        if (night && rr() < 0.3) k.add(box(wv*0.6, 3, 0.4), lamp(pick(rr, [0xff4a6a, 0x5fe0ff, 0xffd060, 0x9eff7a])), T(cx, y + Math.min(hh, 18), cz + dv/2 + 0.4));
        top = y + hh;
      } else if (docks) {
        const h = 12 + rr()*8, col = pick(rr, PAL.ware), len = Math.min(dv + 8, 60);
        k.add(box(wv, h, len), M(col), T(cx, y + h/2, cz)); k.add(box(wv*0.72, wv*0.72, len), M(pick(rr, PAL.roof)), mul(T(cx, y + h, cz), RZ(PI/4)));
        k.add(box(wv*0.8, 3, 0.3), M(0xe8e0cc), T(cx, y + h - 3, cz + len/2 + 0.2));
        top = y + h + wv*0.36;
        if (b < 160 && rr() < 0.5) { const qx = bankX(cz, Math.sign(cx - rx(cz)), 10), qy = w.height(qx, cz, true); for (const s of [-4, 4]) k.add(box(1.2, 26, 1.2), M(0xd9b44a, {roughness:0.5}), T(qx + s, qy + 13, cz)); k.add(bar([qx, qy + 26, cz], [qx - Math.sign(cx - rx(cz))*30, qy + 34, cz], 0.9), M(0xd9b44a, {roughness:0.5})); w.addBlocker({x:qx, z:cz, hw:5, hd:5, top:qy + 30}); }
      } else if (mills) {
        const h = 16 + rr()*10, len = dv;
        k.add(box(wv, h, len), M(pick(rr, PAL.brick)), T(cx, y + h/2, cz)); bands(k, cx, y, cz, wv, len, h, Math.floor(h/4.2), 4.2);
        for (let j = 0; j < 4; j++) k.add(box(wv, 1, len/4*1.05), M(0x3a3634), mul(T(cx, y + h + 2.5, cz - len/2 + len/8 + j*len/4), RX(0.55)));
        top = y + h + 5;
        if (rr() < 0.55) { const ch = 44 + rr()*26, qx = cx + wv/2 - 4, qz = cz + len/2 - 4; k.add(cyl(1.8, 3, ch, 8), M(pick(rr, PAL.brick)), T(qx, y + ch/2, qz)); k.add(cyl(2.1, 2.1, 1.6, 8), M(0x2a2826), T(qx, y + ch - 1, qz)); w.addBlocker({x:qx, z:qz, hw:3, hd:3, top:y + ch}); L.chimneys.push({x:qx, z:qz, top:y + ch, hot:0.8}); }
      } else {
        const floors = b > 600 ? 2 + Math.floor(rr()*2) : 3 + Math.floor(rr()*4), h = floors*3.6 + 1.5, col = pick(rr, PAL.brick);
        k.add(box(wv, h, dv), M(col), T(cx, y + h/2, cz)); bands(k, cx, y, cz, wv, dv, h, floors);
        k.add(box(wv + 0.8, 0.8, dv + 0.8), M(0x4a3a32), T(cx, y + h, cz));
        if (floors > 3 && rr() < 0.35) { k.add(cyl(2, 2, 3.6, 8), M(0x5a4636), T(cx + wv*0.2, y + h + 3.8, cz)); k.add(cyl(0, 2.2, 1.6, 8), M(0x3a3028), T(cx + wv*0.2, y + h + 6.4, cz)); for (const s of [-1, 1]) k.add(box(0.3, 2, 0.3), IRON(), T(cx + wv*0.2 + s*1.4, y + h + 1, cz)); }
        if (rr() < 0.4) k.add(box(1.6, 3, 1.6), M(0x5a3a2a), T(cx - wv*0.3, y + h + 1.5, cz + dv*0.3));
        top = y + h + 2;
      }
      w.addBlocker({x:cx, z:cz, hw:wv/2 + 1, hd:dv/2 + 1, top}); n++;
    }
  }
  for (const k of tiles.values()) { const grp = new THREE.Group(); k.build(grp); g.scene.add(grp); }
  c.cityCount = n;
}

/* ---------- the El: an elevated railway up the east bank and over the river at the El crossing ---------- */
function buildEl(c, g){
  const w = g.world, zEl = 3500, F = bridgeFrame(zEl), ctrl = [];
  for (let z = -3900; z <= 3150; z += 350) ctrl.push(new V3(bankX(z, 1, 80), 0, z));
  ctrl.push(new V3(F.c.x + F.ax*(F.L/2 + 120), 0, F.c.z + F.az*(F.L/2 + 120)), new V3(F.c.x - F.ax*(F.L/2 + 120), 0, F.c.z - F.az*(F.L/2 + 120)), new V3(bankX(3900, -1, 160), 0, 3900), new V3(bankX(4250, -1, 260), 0, 4250));
  const cp = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], dense = [];
  for (let i = 1; i < cp.length - 2; i++) for (let k2 = 0; k2 < 30; k2++) { const t = k2/30, t2 = t*t, t3 = t2*t, p0 = cp[i - 1], p1 = cp[i], p2 = cp[i + 1], p3 = cp[i + 2], f = (a, b, c2, d) => 0.5*((2*b) + (-a + c2)*t + (2*a - 5*b + 4*c2 - d)*t2 + (-a + 3*b - 3*c2 + d)*t3); dense.push(new V3(f(p0.x, p1.x, p2.x, p3.x), 0, f(p0.z, p1.z, p2.z, p3.z))); }
  let tot = 0; const cum = dense.map((q, i) => (tot += i ? q.distanceTo(dense[i - 1]) : 0)), N = Math.round(tot/9), pts = [];
  for (let i = 0, j = 1; i <= N; i++) { const d = tot*i/N; while (j < dense.length - 1 && cum[j] < d) j++; const t = (d - cum[j - 1])/Math.max(0.01, cum[j] - cum[j - 1]), q = dense[j - 1].clone().lerp(dense[j], t); pts.push({x:q.x, z:q.z, gy:Math.max(0, w.height(q.x, q.z, true)), y:0}); }
  for (const q of pts) q.y = Math.max(q.gy + 13, 21);
  for (let it = 0; it < 30; it++) for (let i = 1; i < pts.length - 1; i++) pts[i].y = Math.max(pts[i].gy + 12, (pts[i - 1].y + pts[i + 1].y)/2);
  let s = 0; pts.forEach((q, i) => { if (i) s += Math.hypot(q.x - pts[i - 1].x, q.z - pts[i - 1].z); q.s = s; });
  const at = (d, out) => { d = Math.max(0, Math.min(s, d)); let lo = 0, hi = pts.length - 1; while (hi - lo > 1) { const m2 = (lo + hi) >> 1; if (pts[m2].s < d) lo = m2; else hi = m2; } const a = pts[lo], b = pts[hi], t = (d - a.s)/Math.max(0.01, b.s - a.s); return out.set(a.x + (b.x - a.x)*t, a.y + (b.y - a.y)*t, a.z + (b.z - a.z)*t); };
  c.rail = {pts, len:s, at};
  g.scene.add(G.buildTrack(pts));
}

/* ---------- the frame: collisions with decks and cables, updrafts, smoke, the El train, and the Air Police ---------- */
function rtick(c, g, dt){
  const L = lists(c), P = g.player;
  // bridge decks, roofs and cables
  for (const p of g.planes) {
    if (!p.alive || p.frozen || p.onGround) continue;
    for (const s of L.slabs) if (!s.off && inSlab(s, p.pos)) { if (p.isPlayer && g.done) continue; if (p.isPlayer) G.HUD.feed('You hit a bridge!', true); p.destroy(null, 'crash'); break; }
    if (!p.alive) continue;
    for (const k of L.cables) { if (k.off) continue; const ab = tA.copy(k.b).sub(k.a), t = Math.max(0, Math.min(1, tB.copy(p.pos).sub(k.a).dot(ab)/ab.lengthSq())), d = tC.copy(k.a).addScaledVector(ab, t).distanceTo(p.pos);
      if (d < k.r + (p.radius || 5)*0.4) { if (p.isPlayer && g.done) continue; G.HUD.feed(p.isPlayer ? `You flew into ${k.what}!` : `${p.callsign || 'A plane'} hit ${k.what}!`, p.isPlayer); p.destroy(null, 'crash'); break; } }
  }
  // the Long Shed: in one end and out the other
  if (P && P.alive) for (const S of L.sheds) { const dz = P.pos.z - S.z, inside = Math.abs(P.pos.x - S.x) < S.hw && P.pos.y > S.y0 && P.pos.y < S.y1;
    if (inside && S.prev && Math.abs(dz) > S.hl - 8 && Math.sign(dz) !== Math.sign(S.prev) && g.t - S.t > 6) { S.t = g.t; if (c.award) c.award(2000, 'THROUGH THE LONG SHED', true); if (G.ach) G.ach.bump('tunnels'); }
    if (inside && Math.abs(dz) > S.hl - 30) S.prev = dz; else if (!inside) S.prev = 0; }
  // chimney heat: a shove upward and a shake, and smoke from the nearest stacks
  const cam = P ? P.pos : null;
  if (cam) {
    for (const ch of L.chimneys) { const d = Math.hypot(P.pos.x - ch.x, P.pos.z - ch.z); if (d < 45 && P.pos.y > ch.top && P.pos.y < ch.top + 280) { const k = (1 - d/45)*(1 - (P.pos.y - ch.top)/280)*ch.hot; P.vel.y += 26*k*dt; P.pos.y += 9*k*dt; if (Math.random() < dt*4*k) { P.knock = 0.25; P.knockAx.set((Math.random() - 0.5)*0.6, 0, (Math.random() - 0.5)*1.2); } } }
    c.smokeT = (c.smokeT || 0) - dt;
    if (c.smokeT <= 0) { c.smokeT = 1; c.nearStacks = L.chimneys.map(ch => [ch, Math.hypot(cam.x - ch.x, cam.z - ch.z)]).sort((a, b) => a[1] - b[1]).slice(0, 16).map(a => a[0]); }
    for (const ch of c.nearStacks || []) if (Math.random() < dt*6) g.fx.smoke.emit(ch.x, ch.top + 2, ch.z, (Math.random() - 0.5)*2, 5 + ch.hot*3, 1.5, 4 + ch.hot*2, 2.2, 0.22, 0.2, 0.19, 0.5, 9, 0.5, 2);
  }
  // the El train runs up and down the line all day
  if (c.train) { c.train.update(dt); if (c.train.done) { c.trainWait = (c.trainWait || 0) + dt; if (c.trainWait > 25) { c.trainWait = 0; c.train.done = false; c.train.s = 20; } } }
  policeTick(c, g, dt);
}

/* ---------- the Gantry Air Police: they keep the peace, unless you're the one breaking it ---------- */
const HOT = 50;
function policeTick(c, g, dt){
  if (c.noPolice || g.netGuest) return;
  const P = g.player; c.heat = c.heat || 0; c.heatQuiet = (c.heatQuiet || 0) + dt;
  if (c.heatQuiet > 8) c.heat = Math.max(0, c.heat - dt*1.4);
  const hostile = c.heat >= HOT || (c.hostileTill && g.t < c.hostileTill); G.policeHostile = !!hostile;
  if (hostile && !c.saidHot) { c.saidHot = true; G.HUD.radio('Gantry Air Police', `Gantry Air Police to the plane shooting up our city: you are under arrest. Land at Gantry Municipal or be shot down.`); }
  if (!hostile && c.saidHot && c.heat < 10) { c.saidHot = false; G.HUD.radio('Gantry Air Police', 'All units, stand down. Resume patrol.'); }
  if (!c.police) c.police = [];
  c.police = c.police.filter(p => p.alive);
  if (!P || !P.alive || (c.phase !== undefined && c.phase !== 1)) return;
  const want = 2 + (hostile ? Math.min(4, Math.floor(c.heat/25)) : 0);
  c.copT = (c.copT || 4) - dt;
  if (c.police.length < want && c.copT <= 0) {
    c.copT = hostile ? 12 : 60; const muni = c.P.municipal || P.pos, a = Math.random()*PI*2;
    for (let i = 0; i < 2 && c.police.length < want; i++) {
      const L2 = G.gangLoadout('bluecoats', i, 2, {}, [0x1f2a44, 0xe8edf2, 0xd9b44a]), nm = G.name1920s();
      const pos = muni.clone().add(new V3(Math.sin(a)*900 + i*40, 260 + i*10, Math.cos(a)*900)), q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), tA.copy(P.pos).sub(pos).setY(0).normalize());
      const p = g.addPlane({loadout:L2, team:3, name:`Officer ${nm.last || nm.short}`, callsign:`Officer ${nm.last || nm.short}`, pos, q, speed:85, ai:{role:'fighter', skill:0.62}});
      p.police = true; c.police.push(p);
    }
  }
  // patrol the city on a beat unless there's trouble near
  for (const p of c.police) {
    const pl = g.pilots.find(x => x.p === p); if (!pl) continue;
    const trouble = g.planes.some(q => q.alive && (q.team === 1 || q.team === 2 || (hostile && q.team === 0)) && q.pos.distanceTo(p.pos) < 1400);
    if (trouble) { pl.route = null; continue; }
    if (!pl.route) { const beat = ['downtown', 'docks', 'gasworks', 'millrow', 'downtown'].map(id => c.P[id]).filter(Boolean); pl.route = beat.map(v => ({x:v.x, z:v.z, y:v.y + 240, r:180})); pl.wp = Math.floor(Math.random()*beat.length); }
    if (pl.wp >= pl.route.length) pl.wp = 0;
  }
}
G.policeHeat = (c, g, n, why) => { if (!c || c.noPolice) return; c.heat = Math.min(150, (c.heat || 0) + n); c.heatQuiet = 0; if (why) G.HUD.toast(why); };

/* ---------- the region comes together: city, railway, its train, the frame ---------- */
G.REGION_BUILD = G.REGION_BUILD || {};
G.REGION_BUILD.rustwater = (c, g) => {
  c.rw = c.rw || {slabs:[], cables:[], chimneys:[], balloons:[], holders:[], sheds:[]};
  c.heat = 0; c.police = []; c.heatAdd = (gg, n, why) => G.policeHeat(c, gg, n, why);
  buildEl(c, g);
  buildCity(c, g);
  if (G.Train && c.rail) c.train = new G.Train(g, c.rail, ['loco', 'box', 'pay', 'box'], {speed:13, s:30});
  if (c.skyBeams && c.night) c.skyBeams(g, {x:bankX(-900, 1, 300), z:-900}, 4, 240);
  c.rtick = (gg, dt) => rtick(c, gg, dt);
};

/* ---------- the rules that touch other code ---------- */
// police and the player's side leave each other alone unless the heat is up
if (G.Pilot && G.Pilot.prototype.enemies) {
  const en0 = G.Pilot.prototype.enemies;
  G.Pilot.prototype.enemies = function(){ const list = en0.call(this); if (G.policeHostile) return list; return list.filter(q => !((q.police && this.p.team === 0) || (this.p.police && q.team === 0))); };
}
const GP = G.Game.prototype;
const hit0 = GP.onHit;
GP.onHit = function(p, src, dmg, facing){
  const r = hit0 ? hit0.apply(this, arguments) : undefined;
  if (p.police && src === this.player && !this.netGuest) { const m = this.mission; G.policeHeat(m.scene || m, this, 3 + dmg*0.15, (m.scene || m).heat < 20 ? 'You\'re shooting at the police!' : null); }
  return r;
};
const kill0 = GP.onKill;
GP.onKill = function(plane, src, how){
  if (plane && plane.police) {
    const m = this.mission; if ((src || plane.lastHitBy) === this.player) { G.policeHeat(m.scene || m, this, 70, 'You shot down a police plane!'); }
    G.HUD.feed(`${plane.callsign} of the Air Police is down`, false); return;
  }
  return kill0.apply(this, arguments);
};
// Captain Strand settles your heat with a fine when you land at Municipal
const O = G.MISSIONS.open, meet0 = O.meet;
O.meet = function(site){
  if (site && site.id === 'municipal' && this.heat > 1) { const fine = Math.round(this.heat*40/10)*10; G.save.cash = Math.max(0, G.save.cash - fine); this.heat = 0; this.hostileTill = 0; G.policeHostile = false; G.persist(); G.HUD.toast(`Captain Strand fined you $${fine.toLocaleString()} for disturbing the peace`); }
  return meet0.apply(this, arguments);
};
const sides0 = O.hudSides;
O.hudSides = function(g){
  if (!this.heat || this.heat < 1) return sides0.call(this, g);
  const hs = G.HUD.sides, h = this.heat, stars = '★'.repeat(Math.min(3, Math.ceil(h/HOT*2))) + '☆'.repeat(Math.max(0, 3 - Math.ceil(h/HOT*2)));
  G.HUD.sides = list => hs.call(G.HUD, list.concat([{text:'Police heat', st:G.policeHostile ? 'fail' : 'live', val:stars}]));
  try { return sides0.call(this, g); } finally { G.HUD.sides = hs; }
};
const setup0 = O.setup;
O.setup = function(g){ G.policeHostile = false; this.heat = 0; return setup0.call(this, g); };
})();
