/* =====================================================================
   Region 6: Rustwater Valley and Gantry City.
   A river city of mills, smokestacks and seven bridges. Everything that's particular to it lives here: the region itself,
   its people and jobs, its landmarks (bridges, the dam, the steelworks, the gasworks, the broadcast tower, the prison),
   the industrial city, the elevated railway, barrage balloons and their cables, chimney updrafts, gas holders that go up
   in chains, and the Gantry Air Police with their "heat".
   ===================================================================== */
(() => {
'use strict';
const V3 = THREE.Vector3, RU = G.RUST, {Kit, box, cyl, bar, ball, lathe, loft, lamp, T, RX, RY, RZ, mul, xf} = G.KIT;
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
    {id:'ziegler', kind:'hook', name:'the Ziegler Building', contact:'della', at:{x:bankX(-950, 1, 260), z:-950}, tower:{h:196, w:40, mast:true, walls:0xb8a888, sign:'ZIEGLER BUILDING', signCol:'#2a1d10', signGlow:'#f2c14e'}},
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
  {id:'della_photo', contact:'della', type:'errand', title:'Who owns the Conductor?', pay:3200, night:true, time:300, cargo:'A camera and a lot of film', spot:'count', spotMax:3,
   legs:[{how:'near', mark:'wgcx', r:250, say:'Got a shot of the WGCX aerials. Funny: there are more of them than the station needs.'}, {how:'low', mark:'gasworks', say:'Picture of the gasworks gate. Two men in grey coats, unloading crates marked "radio parts".'}],
   blurb:'Della\'s chasing a story about strange radio traffic at night. Get close to the WGCX tower, then low over the gasworks gate. Stay out of the searchlights: get caught in the beams three times and every source in Gantry clams up.', go:'If anybody asks, you\'re from the Gazette.'},
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
  {id:'bucco_run', contact:'bucco', type:'errand', title:'Up the canal', pay:3600, night:true, time:300, cargo:'Crates of "machine parts"', fragile:{hard:true}, spot:'heat',
   legs:[{how:'low', mark:'reservoir', say:'Over the dam and down on the water. The boat\'s waiting.'}, {how:'land', site:'quarry', say:'Delivered at Quarry Field. Quill didn\'t ask. Smart man.'}],
   blurb:'A load for a friend up the valley. Over the dam at wave-top height and down at Quarry Field. If a searchlight catches you with these crates aboard, the Air Police will be on you in a minute. Don\'t ask what\'s in the crates.', go:'If the coppers stop you, you\'ve never heard of me. Nobody has.'},
  {id:'bucco_drain', contact:'bucco', type:'race', title:'Down the drain', pay:3400, rivals:2, laps:1, low:true, course:{path:['undercroft', 'gasworks', 'drawbridge', 'docks', 'municipal'], agl:40},
   blurb:'Out of the Undercroft and down to the harbour, against two of Sal\'s couriers. Low over the gasworks, under the drawbridge if it\'s down.', go:'Losers pay for drinks. Winners drink.'},
  {id:'strand_lights', contact:'strand', type:'errand', title:'Test the searchlights', pay:2600, night:true, time:240, cargo:'Nothing but nerve', spot:'count', spotMax:3,
   legs:[{how:'low', mark:'docks', say:'Through the docks unseen. Strand\'s sergeant is furious.'}, {how:'low', mark:'gasworks', say:'Past the gasworks lights. Not bad.'}, {how:'near', mark:'liberty', r:200, say:'Under the Liberty Span\'s own lights. Strand will have words with her crews.'}],
   blurb:'Captain Strand wants to know if her searchlight crews are any good. Slip past the docks, the gasworks and the Liberty Span at night, and don\'t get caught in the beams more than twice.', go:'If they catch you, they\'re good. If they don\'t, they\'re fired. No pressure.'},
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

/* ---------- geometry the valley is made of: flat panels laid on walls (two triangles each), open-ended posts and struts, shells, gables ---------- */
const kArr = (k, m) => { let a = k.b.get(m); if (!a) k.b.set(m, a = []); return a; };
const FN = [[0, 1], [1, 0], [0, -1], [-1, 0]];                // wall normals: +z, +x, -z, -x
// a panel on wall f of a box (centre cx,cz, half sizes hw,hd): u0..u1 along the wall (left to right from outside), y0..y1, standing e proud (eT at the top edge)
const panel = (a, cx, cz, hw, hd, f, u0, u1, y0, y1, e, eT = e) => {
  const nx = FN[f][0], nz = FN[f][1], d = nx ? hw : hd, ax = cx + nx*(d + e) + nz*u0, az = cz + nz*(d + e) - nx*u0, bx = cx + nx*(d + e) + nz*u1, bz = cz + nz*(d + e) - nx*u1, o = (eT - e);
  a.push(ax, y0, az, bx, y0, bz, bx + nx*o, y1, bz + nz*o, ax, y0, az, bx + nx*o, y1, bz + nz*o, ax + nx*o, y1, az + nz*o);
};
const wallPt = (cx, cz, hw, hd, f, u, e) => { const nx = FN[f][0], nz = FN[f][1], d = nx ? hw : hd; return [cx + nx*(d + e) + nz*u, cz + nz*(d + e) - nx*u]; };
const rect = (x, y, z) => [[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z]];
const post = (wd, h, d) => loft([rect(wd/2, -h/2, d/2), rect(wd/2, h/2, d/2)], false, false);                       // a box without its ends
const frustum = (wd, h, d, tw = 0, td = 0) => loft([rect(wd/2, 0, d/2), rect(tw/2, h, td/2)], false, tw > 0 && td > 0);   // pyramid, hip roof or tapered block, base at y=0
const prism = (wd, h, d, off = 0) => loft([[[-wd/2, 0, -d/2], [wd/2, 0, -d/2], [off, h, -d/2]], [[-wd/2, 0, d/2], [wd/2, 0, d/2], [off, h, d/2]]]);   // a gable, ridge along z
const flat = (a, x, y, z, hw, hd) => a.push(x - hw, y, z - hd, x - hw, y, z + hd, x + hw, y, z + hd, x - hw, y, z - hd, x + hw, y, z + hd, x + hw, y, z - hd);   // a roof deck, facing up
// walls sunk a little into the ground (the streets aren't level) and a roof deck on top
const shell = (k, wall, roof, cx, y, cz, wd, h, d, sink = 3) => { k.add(post(wd, h + sink, d), wall, T(cx, y + (h - sink)/2, cz)); flat(kArr(k, roof), cx, y + h, cz, wd/2, d/2); };

const aimY = (a, b) => {                                     // carries local +Y onto a->b, centred on the midpoint (as models.js does for bar)
  let yx = b[0] - a[0], yy = b[1] - a[1], yz = b[2] - a[2]; const l = Math.hypot(yx, yy, yz) || 1; yx /= l; yy /= l; yz /= l;
  const r = Math.abs(yy) < 0.9 ? [0, 1, 0] : [0, 0, 1];
  let xx = yy*r[2] - yz*r[1], xy = yz*r[0] - yx*r[2], xz = yx*r[1] - yy*r[0]; const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
  return [xx, yx, xy*yz - xz*yy, (a[0] + b[0])/2, xy, yy, xz*yx - xx*yz, (a[1] + b[1])/2, xz, yz, xx*yy - xy*yx, (a[2] + b[2])/2];
};
const strut = (a, b, wd, h = wd) => xf(post(wd, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), h), aimY(a, b));   // a girder without end caps: two thirds of a bar
// a four-sided patch facing (nx, ny, nz), whichever way round its corners come
const q4 = (o, a, b, c, d, nx, ny, nz) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  if ((uy*vz - uz*vy)*nx + (uz*vx - ux*vz)*ny + (ux*vy - uy*vx)*nz < 0) { const t = b; b = d; d = t; } o.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]); };

MK.bridge = function(g, md, p){
  const B = md.bridge, F = bridgeFrame(B.z), L = F.L, half = rw(B.z)/2, D = B.deck, k = new Kit(), w = g.world, grp = new THREE.Group();
  const toW = (u, v = 0) => new V3(F.c.x + u*Math.cos(F.yaw) + v*Math.sin(F.yaw), 0, F.c.z - u*Math.sin(F.yaw) + v*Math.cos(F.yaw));
  const PALE = M(0x9a9282), GREEN = M(0x3a4a42, {roughness:0.6, metalness:0.3}), ROAD = M(0x3a3836), GLOBE = lamp(0xffe2a0);
  // a river pier: masonry with a cutwater up and downstream and a capstone (the blocker is what it always was)
  const pier = (u, top, hw = 5, hd = 8, mat = STONE()) => {
    k.add(post(hw*2, top + 8, hd*2), mat, T(u, (top - 8)/2, 0)); k.add(box(hw*2 + 1.2, 1, hd*2 + 1.2), PALE, T(u, top - 0.5, 0));
    for (const s of [1, -1]) k.add(prism(hw*2, hw*0.9, top + 5), mat, mul(T(u, (top - 11)/2, s*hd), RX(s*PI/2)));
    const q = toW(u); w.addBlocker({x:q.x, z:q.z, hw:Math.max(hw, hd)*0.8, hd:Math.max(hw, hd)*0.8, top});
  };
  const deckBox = (u0, u1, y, wid = 14, th = 2.2, mat = DARKSTONE()) => k.add(box(u1 - u0, th, wid), mat, T((u0 + u1)/2, y - th/2, 0));
  const parapet = (u0, u1, y, wid = 14, mat = STONE()) => { for (const s of [1, -1]) k.add(box(u1 - u0, 1.2, 0.5), mat, T((u0 + u1)/2, y + 0.6, s*wid/2)); };
  const deckSlab = (u0, u1, y0, y1, wid = 16, extra = {}) => slab(this, Object.assign({c:toW((u0 + u1)/2), yaw:F.yaw, hl:(u1 - u0)/2, hw:wid/2, y0, y1}, extra));
  // the approach: a walled embankment down to the street, solid all the way to the ground (and it collides as a flight of steps)
  const ramp = (sgn, y, u0 = sgn*L/2, wid = 14) => {
    const len = 90, e = toW(u0 + sgn*len), yb = Math.max(1, w.height(e.x, e.z, true)), n = Math.max(2, Math.ceil(Math.abs(y - yb)/4)), u1 = u0 + sgn*len, a = Math.atan2(yb - y, len), sl = Math.hypot(len, y - yb);
    k.add(loft([[[u0, -8, -wid/2], [u1, -8, -wid/2], [u1, yb - 0.6, -wid/2], [u0, y - 0.6, -wid/2]], [[u0, -8, wid/2], [u1, -8, wid/2], [u1, yb - 0.6, wid/2], [u0, y - 0.6, wid/2]]]), STONE());
    k.add(box(sl, 0.7, wid - 0.6), ROAD, mul(T((u0 + u1)/2, (y + yb)/2 - 0.3, 0), RZ(sgn*a)));
    for (const s of [1, -1]) k.add(box(sl, 1.3, 0.6), PALE, mul(T((u0 + u1)/2, (y + yb)/2 + 0.55, s*wid/2), RZ(sgn*a)));
    for (let i = 0; i < n; i++) slab(this, {c:toW(u0 + sgn*(i + 0.5)*len/n), yaw:F.yaw, hl:len/n/2, hw:wid/2 + 1, y0:-12, y1:y + (yb - y)*(i + 0.5)/n + 2.2});
  };
  let label = 'UNDER THE BRIDGE';
  if (B.kind === 'stone') {
    // five elliptical arches of dressed stone, refuges over the piers with a lamp on each
    const n = 5, span = L/n, pw = 6, spring = 5.5, crown = D - 3.6, N = 10, st = kArr(k, STONE()), pale = kArr(k, PALE), dk = kArr(k, DARKSTONE());
    for (let i = 1; i < n; i++) pier(-L/2 + i*span, D - 2, 6, 9);
    deckBox(-L/2, L/2, D, 13.6, 0.8, ROAD); parapet(-L/2, L/2, D, 14, PALE);
    for (const s of [1, -1]) k.add(box(L, 0.5, 0.5), PALE, T(0, D - 0.9, s*7.15));
    for (let i = 0; i < n; i++) {
      const a = -L/2 + i*span, u0 = a + pw, u1 = a + span - pw, pts = [[a, D - 2.4]];
      for (let j = 0; j <= N; j++) pts.push([u0 + j*(u1 - u0)/N, spring + (crown - spring)*Math.sqrt(Math.max(0, 1 - (2*j/N - 1)**2))]); pts.push([a + span, D - 2.4]);
      for (let j = 1; j < pts.length; j++) { const [pu, py] = pts[j - 1], [cu, cy] = pts[j], arch = j > 1 && j < pts.length - 1;
        for (const s of [1, -1]) { q4(st, [pu, py, s*7], [cu, cy, s*7], [cu, D, s*7], [pu, D, s*7], 0, 0, s); if (arch) q4(pale, [pu, py, s*7.25], [cu, cy, s*7.25], [cu, cy + 1.1, s*7.25], [pu, py + 1.1, s*7.25], 0, 0, s); }
        if (arch) q4(dk, [pu, py, -7.25], [cu, cy, -7.25], [cu, cy, 7.25], [pu, py, 7.25], cy - py, pu - cu, 0); }
      for (const e of [0, 1]) { const uc = e ? u1 - 6.5 : u0 + 6.5; slab(this, {c:toW(uc), yaw:F.yaw, hl:6.5, hw:8, y0:7.6, y1:D}); }     // the haunches of each arch come lower than the crown
    }
    for (let i = 0; i <= n; i++) { const u = -L/2 + i*span; k.add(box(5, 4.4, 15.4), STONE(), T(u, D - 0.6, 0)); k.add(box(5.6, 0.4, 16), PALE, T(u, D + 1.6, 0));
      for (const s of [1, -1]) { k.add(post(0.25, 1.2, 0.25), IRON(), T(u, D + 2.2, s*7.2)); k.add(box(0.7, 0.7, 0.7), GLOBE, T(u, D + 2.6, s*7.2)); } }
    deckSlab(-L/2, L/2, D - 4.5, D + 3);
  } else if (B.kind === 'suspension') {
    // the Liberty Span: Deco stone towers, two catenary cables, a stiffening truss under the roadway
    const tu = half + 12, top = D + 82, sag = D + 10, end = L/2 + 40, TS = M(0x8e8676), dk = kArr(k, DARKSTONE());
    for (const sgn of [1, -1]) { const u = sgn*tu;
      for (const s of [1, -1]) {
        k.add(frustum(9.6, D + 14, 9.6, 7.4, 7.4), TS, T(u, -8, s*9));                                      // plinth, up through the deck
        k.add(box(8, 1.2, 8), PALE, T(u, D + 6.4, s*9));
        k.add(frustum(6.4, top - D - 28, 6.4, 5, 5), TS, T(u, D + 7, s*9));                                 // the shaft
        k.add(box(5.8, 1.4, 5.8), PALE, T(u, top - 21, s*9));
        k.add(frustum(4.6, 18.6, 4.6, 3.6, 3.6), TS, T(u, top - 20.3, s*9));                                // the upper stage
        k.add(box(4.4, 1, 4.4), PALE, T(u, top - 1.7, s*9)); k.add(box(5.4, 2.2, 3), IRON(), T(u, top - 0.4, s*9));   // cap and cable saddle
        for (const f of [1, 3]) panel(dk, u, s*9, 3.2, 3.2, f, -1, 1, D + 12, top - 25, 0.06 - 0.15, 0.06 - 0.6);   // a fluted recess up each face of the shaft
        for (const f of [0, 2]) panel(dk, u, s*9, 3.2, 3.2, f, -1, 1, D + 12, top - 25, 0.06 - 0.15, 0.06 - 0.6);
        k.add(box(0.8, 0.8, 0.8), lamp(0xff3b30), T(u, top + 1.1, s*9));
      }
      k.add(box(5.6, 6, 13), TS, T(u, D - 6.2, 0));                                                          // the strut below the roadway
      k.add(box(4.4, 5, 13.4), TS, T(u, D + 40, 0)); k.add(box(4.8, 0.8, 13.6), PALE, T(u, D + 42.9, 0));
      k.add(box(4, 9, 14), TS, T(u, top - 14, 0)); k.add(box(4.4, 1, 15), PALE, T(u, top - 9, 0));           // the portal, stepped up to a crest
      k.add(box(3.6, 2.6, 9), TS, T(u, top - 7.2, 0)); k.add(box(3.2, 2.4, 4.6), PALE, T(u, top - 4.7, 0));
      for (const s of [1, -1]) k.add(box(4, 4, 2.6), TS, T(u, top - 20.4, s*5.6));
      k.add(ball(0.9, 6, 3), lamp(0xff3b30), T(u, top - 2.6, 0));
      const q = toW(u); w.addBlocker({x:q.x, z:q.z, hw:12, hd:12, top:top});
      // the anchorage, where the cables go to ground
      k.add(box(22, D + 8, 24), TS, T(sgn*(end + 3), D/2 - 4, 0)); for (const s of [1, -1]) { k.add(box(22, 4.6, 5), TS, T(sgn*(end + 3), D + 2.3, s*9.5)); k.add(box(23, 0.8, 5.8), PALE, T(sgn*(end + 3), D + 4.9, s*9.5)); }
      const qa = toW(sgn*(end + 3)); w.addBlocker({x:qa.x, z:qa.z, hw:12, hd:12, top:D + 5});
      ramp(sgn, D, sgn*(end + 14), 18);
    }
    deckBox(-end, end, D, 18, 1, ROAD); parapet(-end, end, D, 18, IRON());
    for (const s of [1, -1]) { k.add(box(2*end, 0.6, 0.6), IRON(), T(0, D - 3.6, s*8.7)); k.add(box(2*end, 0.6, 0.6), IRON(), T(0, D - 0.9, s*8.7)); }
    const np = Math.round(2*end/8)*2, pl = 4*end/np;
    for (let i = 0; i < np; i += 2) { const u = -end + i*pl/2 + pl/2; for (const s of [1, -1]) { k.add(strut([u - pl/2, D - 3.6, s*8.7], [u, D - 0.9, s*8.7], 0.35), IRON()); k.add(strut([u, D - 0.9, s*8.7], [u + pl/2, D - 3.6, s*8.7], 0.35), IRON()); }
      k.add(post(0.5, 17.4, 0.7), IRON(), mul(T(u, D - 3.5, 0), RX(PI/2))); }
    for (let u = -end + 14; u < end; u += 28) for (const s of [1, -1]) { k.add(post(0.2, 1.6, 0.2), IRON(), T(u, D + 1.9, s*9)); k.add(box(0.55, 0.55, 0.55), GLOBE, T(u, D + 2.6, s*9)); }
    // main cables: anchor, tower, sag, tower, anchor; and they're deadly
    const curve = u => { const a = Math.abs(u); if (a > tu) return top - (top - D - 2)*((a - tu)/(L/2 + 40 - tu)); const t = u/tu; return sag + (top - sag)*t*t; };
    for (const s of [1, -1]) { let prev = null; for (let i = 0; i <= 40; i++) { const u = -L/2 - 40 + i*(L + 80)/40, pt = [u, curve(u), s*9]; if (prev) { k.add(bar(prev, pt, 0.9), IRON()); const a = toW(prev[0], prev[2]), b = toW(u, s*9); a.y = prev[1]; b.y = pt[1]; lists(this).cables.push({a, b, r:2.6, what:'the Liberty Span\'s cables'}); } prev = pt; } }
    for (let u = -end + 8; u < end - 4; u += 8) { if (Math.abs(Math.abs(u) - tu) < 5) continue; const y = curve(u); if (y - D < 3) continue; for (const s of [1, -1]) k.add(post(0.22, y - D, 0.22), IRON(), T(u, (y + D)/2, s*9)); }
    deckSlab(-L/2 - 40, L/2 + 40, D - 4, D + 3, 20);
  } else if (B.kind === 'draw') {
    // two leaves hinged at the banks; every two minutes they lift for shipping. A bridge house either side of the road on each pier
    const BR = M(0x6a4a3a);
    for (const sgn of [1, -1]) { const u = sgn*(half + 4);
      k.add(post(14, D + 8, 30), STONE(), T(u, (D - 8)/2 - 0.5, 0)); k.add(box(15, 1, 31), PALE, T(u, D - 1.5, 0)); for (const s of [1, -1]) k.add(prism(14, 6, D + 5), STONE(), mul(T(u, (D - 11)/2, s*15), RX(s*PI/2)));
      const q = toW(u); w.addBlocker({x:q.x, z:q.z, hw:8, hd:8, top:D});
      for (const s of [1, -1]) { const v = s*11;
        k.add(post(6.4, 20, 6.4), BR, T(u, D + 9, v)); k.add(box(7.4, 0.9, 7.4), PALE, T(u, D + 14.4, v)); k.add(box(7.6, 1, 7.6), PALE, T(u, D + 19.2, v)); k.add(frustum(7, 3.4, 7, 1.2, 1.2), GREEN, T(u, D + 19.7, v));
        k.add(post(0.14, 4, 0.14), IRON(), T(u, D + 25, v)); k.add(box(0.6, 0.6, 0.6), lamp(s*sgn > 0 ? 0x3aff6a : 0xff3b30), T(u, D + 27.2, v));
        for (let f = 0; f < 4; f++) { panel(kArr(k, M(0x2a2a30, {emissive:0xffc070, emissiveIntensity:this.night ? 0.9 : 0.06, roughness:0.4})), u, v, 3.2, 3.2, f, -2.2, 2.2, D + 15.4, D + 17.8, 0.08); panel(kArr(k, BR), u, v, 3.2, 3.2, f, -0.3, 0.3, D + 15.2, D + 18, 0.16); panel(kArr(k, M(0x1e2024)), u, v, 3.2, 3.2, f, -0.9, 0.9, D + 4, D + 7.5, 0.08); }
        const qt = toW(u, v); w.addBlocker({x:qt.x, z:qt.z, hw:4.6, hd:4.6, top:D + 27});
      }
    }
    deckBox(-L/2, -half - 2, D); deckBox(half + 2, L/2, D); parapet(-L/2, -half - 2, D, 14, PALE); parapet(half + 2, L/2, D, 14, PALE);
    const leaves = [1, -1].map(sgn => { const lg = new THREE.Group(), lk = new Kit(), len = half + 2, x1 = -sgn*len;
      lk.add(box(len, 0.6, 13), IRON(), T(x1/2, -0.3, 0));
      for (const s of [1, -1]) { lk.add(loft([[[0, -4.2, s*6.2 - 0.3], [0, -4.2, s*6.2 + 0.3], [0, -0.6, s*6.2 + 0.3], [0, -0.6, s*6.2 - 0.3]], [[x1, -1.6, s*6.2 - 0.3], [x1, -1.6, s*6.2 + 0.3], [x1, -0.6, s*6.2 + 0.3], [x1, -0.6, s*6.2 - 0.3]]]), GREEN);
        lk.add(box(len, 0.25, 0.9), GREEN, T(x1/2, -0.7, s*6.2)); lk.add(box(len, 1.3, 0.3), RED(), T(x1/2, 0.65, s*6.5)); lk.add(box(0.6, 0.6, 0.6), lamp(0xff3b30), T(x1 + sgn*0.6, 1.6, s*6.5)); }
      for (let x = 4; x < len - 2; x += 7) lk.add(post(0.4, 12.2, 0.9), GREEN, mul(T(-sgn*x, -1.1, 0), RX(PI/2)));
      lk.build(lg); lg.position.set(sgn*(half + 2), D, 0); grp.add(lg); return lg; });
    const closed = deckSlab(-half - 2, half + 2, D - 3, D + 2.5);
    const lslabs = [1, -1].map(sgn => slab(this, {c:toW(sgn*(half - 4)), yaw:F.yaw, hl:6, hw:8, y0:D - 2, y1:D - 2, off:true}));
    let t = Math.random()*100;
    this.anim.push(dt => {
      t = (t + dt) % 120; if (this.drawCtl) t = this.drawCtl(t, dt); const a = t < 80 ? 0 : t < 88 ? (t - 80)/8 : t < 112 ? 1 : (120 - t)/8, ang = a*1.25; this.drawOpen = a > 0.04; this.drawT = t;
      leaves[0].rotation.z = -ang; leaves[1].rotation.z = ang; closed.off = a > 0.08;                       // each leaf swings up about its hinge on the bank
      for (const s of lslabs) { s.off = a < 0.08; s.y1 = D + Math.sin(ang)*(half + 2); }
      if (Math.abs(t - 80) < dt && G.HUD && this.g && this.g.player && this.g.player.pos.distanceTo(F.c) < 1500) G.HUD.toast('The drawbridge is going up!');
    });
  } else if (B.kind === 'foot') {
    // a bowstring arch of latticed iron over the water, trestle spans to either bank and a stair tower at each end
    deckBox(-L/2, L/2, D, 6, 0.8, IRON()); for (const s of [1, -1]) for (const yy of [0.6, 1.2]) k.add(box(L, 0.14, 0.14), IRON(), T(0, D + yy, s*3));
    const ah = 26, N = 20, P = (i, h) => [-half + i*2*half/N, D + h*Math.sin(PI*i/N)];
    for (let i = 1; i <= N; i++) { const a = P(i - 1, ah), b = P(i, ah), c2 = P(i - 1, ah - 4), d = P(i, ah - 4);
      for (const s of [1, -1]) { k.add(strut([a[0], a[1], s*3], [b[0], b[1], s*3], 0.6), RED()); k.add(strut([c2[0], c2[1], s*3], [d[0], d[1], s*3], 0.45), RED()); k.add(strut(i % 2 ? [c2[0], c2[1], s*3] : [a[0], a[1], s*3], i % 2 ? [b[0], b[1], s*3] : [d[0], d[1], s*3], 0.2), RED());
        if (i < N) k.add(post(0.15, d[1] - D, 0.15), IRON(), T(d[0], (d[1] + D)/2, s*3)); }
      if (i > 2 && i < N - 2) { k.add(strut([b[0], b[1], -3], [b[0], b[1], 3], 0.3), RED()); k.add(strut([a[0], a[1], i % 2 ? -3 : 3], [b[0], b[1], i % 2 ? 3 : -3], 0.16), RED()); } }
    for (const sgn of [1, -1]) { pier(sgn*half, D - 1, 3, 4);
      for (const s of [1, -1]) { k.add(post(0.3, 3.4, 0.3), IRON(), T(sgn*half, D + 1.7, s*3)); k.add(box(0.7, 0.7, 0.7), GLOBE, T(sgn*half, D + 3.7, s*3)); }
      for (const off of [26, 52]) { const u = sgn*(half + off), q = toW(u); for (const s of [1, -1]) k.add(strut([u, -4, s*4.6], [u, D - 0.8, s*2.6], 0.5), IRON()); k.add(strut([u, 2, -4.2], [u, D - 2, 2.7], 0.2), IRON()); k.add(strut([u, 2, 4.2], [u, D - 2, -2.7], 0.2), IRON()); w.addBlocker({x:q.x, z:q.z, hw:3.2, hd:3.2, top:D}); }
      const u = sgn*(L/2 - 4), q = toW(u, 7); k.add(post(7, D + 9, 7), M(0x6a3022), T(u, (D + 1)/2 - 0.5, 7)); k.add(frustum(8, 3, 8, 0, 0), M(0x3a3e44), T(u, D + 5, 7)); k.add(box(7.6, 0.5, 7.6), PALE, T(u, D + 4.8, 7)); k.add(box(4, 0.6, 5), IRON(), T(u, D - 0.3, 3.4));
      panel(kArr(k, M(0x1e2024)), u, 7, 3.5, 3.5, 2, -1, 1, D, D + 2.6, 0.06); w.addBlocker({x:q.x, z:q.z, hw:4.6, hd:4.6, top:D + 8});
    }
    deckSlab(-L/2, L/2, D - 2, D + ah + 1, 8);
  } else if (B.kind === 'truss' || B.kind === 'el') {
    const th = B.kind === 'truss' ? 13 : 3.5, piers = B.kind === 'truss' ? [-half*0.33, half*0.33] : [-half*0.5, 0, half*0.5];
    for (const u of piers) pier(u, D - 1.5, 4, 7);
    if (B.kind === 'truss') {
      // three camelback through-trusses, riveted steel: end posts, verticals, diagonals in tension, portals and sway bracing overhead
      const rail = B.id === 'northern', ST = rail ? IRON() : GREEN, ends = [-L/2, ...piers, L/2];
      deckBox(-L/2, L/2, D, 11, 1.2, rail ? IRON() : ROAD);
      if (rail) for (const v of [-0.75, 0.75]) k.add(box(L, 0.22, 0.2), M(0x8a8c90, {metalness:0.4, roughness:0.4}), T(0, D + 0.1, v)); else for (const s of [1, -1]) k.add(box(L, 0.25, 1.6), PALE, T(0, D + 0.12, s*4.4));
      for (let e = 0; e < 3; e++) { const a = ends[e], b = ends[e + 1], n = Math.max(4, Math.round((b - a)/12/2)*2), pl = (b - a)/n, top = j => j === 0 || j === n ? 0 : th*(0.66 + 0.34*Math.sin(PI*(j - 1)/(n - 2)));
        for (const s of [1, -1]) { const z = s*5.5; k.add(box(b - a, 0.8, 0.6), ST, T((a + b)/2, D + 0.2, z));
          for (let j = 0; j < n; j++) { const u = a + j*pl, t0 = top(j), t1 = top(j + 1); k.add(strut([u, D + t0, z], [u + pl, D + t1, z], 0.8, 0.7), ST);
            if (j > 0) k.add(strut([u, D, z], [u, D + t0, z], 0.45), ST);
            if (j > 0 && j < n - 1) k.add(j < n/2 ? strut([u, D + t0, z], [u + pl, D, z], 0.3) : strut([u, D, z], [u + pl, D + t1, z], 0.3), ST);
            if (j > 0) k.add(box(1.5, 1.5, 0.12), ST, T(u, D + t0 - 0.3, z + s*0.42)); } }                    // gusset plates
        for (let j = 1; j < n; j++) { const u = a + j*pl, t0 = top(j); k.add(strut([u, D + t0, -5.5], [u, D + t0, 5.5], 0.45), ST); if (j < n - 1) k.add(strut([u, D + t0, j % 2 ? -5.5 : 5.5], [u + pl, D + top(j + 1), j % 2 ? 5.5 : -5.5], 0.2), ST); }
        for (const j of [1, n - 1]) { k.add(box(0.5, 1.8, 11), ST, T(a + j*pl, D + top(j) - 1.2, 0)); k.add(box(0.7, 0.9, 3), M(0xd8c8a0), T(a + j*pl, D + top(j) - 1.1, 0)); } }
      label = 'UNDER THE RAILWAY';
    } else {
      // the El: riveted plate girders on stone piers in the river and steel bents on the banks, a walkway and handrail each side
      const pl = kArr(k, GREEN);
      deckBox(-L/2, L/2, D, 10.4, 0.6, IRON());
      for (const s of [1, -1]) { k.add(box(L, 2.6, 0.4), GREEN, T(0, D - 0.9, s*5.4)); for (const yy of [D + 0.45, D - 2.25]) k.add(box(L, 0.22, 1), GREEN, T(0, yy, s*5.4));
        for (let u = -L/2 + 3; u < L/2; u += 6) panel(pl, 0, 0, 0, 5.6, s > 0 ? 0 : 2, s*u - 0.25, s*u + 0.25, D - 2.1, D + 0.3, 0.18);
        k.add(box(L, 0.12, 0.12), IRON(), T(0, D + 1.7, s*5.5)); for (let u = -L/2 + 6; u < L/2; u += 12) k.add(post(0.12, 1.3, 0.12), IRON(), T(u, D + 1.1, s*5.5)); }
      for (let u = -L/2 + 8; u < L/2 - 8; u += 16) { k.add(strut([u, D - 2, -5.2], [u + 16, D - 2, 5.2], 0.25), IRON()); k.add(strut([u, D - 1.2, -5.2], [u, D - 1.2, 5.2], 0.5, 1.4), GREEN); }
      for (const sgn of [1, -1]) for (const off of [24, 54]) { const u = sgn*(half + off), q = toW(u); for (const s of [1, -1]) { k.add(strut([u, -4, s*6.4], [u, D - 2.2, s*4.6], 0.7), GREEN); } k.add(strut([u, 1, -6], [u, D - 3, 4.7], 0.25), GREEN); k.add(strut([u, 1, 6], [u, D - 3, -4.7], 0.25), GREEN); k.add(box(1, 1, 11), GREEN, T(u, D - 2.7, 0)); w.addBlocker({x:q.x, z:q.z, hw:4, hd:4, top:D - 1.5}); }
      label = 'UNDER THE EL';
    }
    deckSlab(-L/2, L/2, D - 3, D + th + 1, 12);
  }
  if (B.kind === 'stone' || B.kind === 'draw' || B.kind === 'truss') for (const sgn of [1, -1]) ramp(sgn, D);
  k.build(grp); grp.position.set(F.c.x, 0, F.c.z); grp.rotation.y = F.yaw; g.scene.add(grp);
  this.arches.push({pos:new V3(F.c.x, 0, F.c.z), len:rw(B.z) - 8, deck:B.kind === 'draw' ? D : D - 2, yaw:F.yaw, prev:undefined, name:md.name, t:-99, label, bonus:1000});
  p.y = D; this.markObj[md.id] = grp;
};

MK.dam = function(g, md, p){
  const w = g.world, k = new Kit(), grp = new THREE.Group(), zc = RU.DAM, top = RU.LAKE + 12, x0 = rx(zc);
  // find the valley walls
  let xl = x0, xr = x0; while (xl > x0 - 3000 && w.height(xl, zc, true) < top) xl -= 20; while (xr < x0 + 3000 && w.height(xr, zc, true) < top) xr += 20;
  xl -= 30; xr += 30; const L = xr - xl, xm = (xl + xr)/2, gap = 22, sh = 32, CON = M(0xa8a298), CON2 = M(0x9a948a), TRIM = M(0xc4bca8), DK = M(0x6a6460);
  const lit = M(0x2a2a30, {emissive:0xffc070, emissiveIntensity:this.night ? 0.9 : 0.06, roughness:0.4});
  // the wall: a gravity dam, sheer to the lake and battered downstream, ribbed with buttresses, and a spillway arch at the river you can fly through
  for (const [a, b] of [[xl, x0 - gap], [x0 + gap, xr]]) {
    const sec = x => [[x, -6, 7], [x, top, 7], [x, top, -7], [x, top*0.72, -7.6], [x, -6, -17]];
    k.add(loft([sec(a - x0), sec(b - x0)]), CON);
    for (let x = a + 34; x < b - 12; x += 60) { const u = x - x0, fin = v => [[v, -6, -7], [v, -6, -19.5], [v, top - 7, -9.4], [v, top - 7, -7]]; k.add(loft([fin(u - 2.6), fin(u + 2.6)]), CON2); k.add(box(6.4, 1, 3.6), TRIM, T(u, top - 6.6, -8.6)); }
    for (let x = a; x < b; x += 30) w.addBlocker({x:x + 15, z:zc, hw:16, hd:16, top:top + 2});
  }
  { const N = 12, st = kArr(k, CON), tr = kArr(k, TRIM), dk = kArr(k, CON2), yA = j => 26 + 6*Math.sqrt(Math.max(0, 1 - (2*j/N - 1)**2));
    for (let j = 1; j <= N; j++) { const pu = -gap + (j - 1)*2*gap/N, cu = -gap + j*2*gap/N, py = yA(j - 1), cy = yA(j);
      for (const s of [1, -1]) { q4(st, [pu, py, s*7], [cu, cy, s*7], [cu, top, s*7], [pu, top, s*7], 0, 0, s); q4(tr, [pu, py, s*7.3], [cu, cy, s*7.3], [cu, cy + 1.8, s*7.3], [pu, py + 1.8, s*7.3], 0, 0, s); }
      q4(dk, [pu, py, -7.3], [cu, cy, -7.3], [cu, cy, 7.3], [pu, py, 7.3], cy - py, pu - cu, 0); }
    k.add(box(3.4, 4.6, 15.4), TRIM, T(0, 34.6, 0)); flat(st, 0, top, 0, gap, 7); }
  slab(this, {c:new V3(x0, 0, zc), yaw:0, hl:gap, hw:9, y0:sh - 2, y1:top + 2});
  // Deco pylons either side of the spillway, and the valve houses along the crest
  for (const s of [1, -1]) { const u = s*(gap + 6.5); k.add(box(11, top + 16, 9), CON2, T(u, top/2 + 2, -10.5)); k.add(box(12, 1, 10), TRIM, T(u, top + 10.4, -10.5)); k.add(box(7.5, 5, 6.5), CON2, T(u, top + 13.4, -10.5)); k.add(box(8.3, 0.8, 7.3), TRIM, T(u, top + 16.2, -10.5)); k.add(box(3.6, 3, 3.6), CON, T(u, top + 18, -10.5));
    k.add(ball(0.9, 6, 3), lamp(0xffe2a0), T(u, top + 20.2, -10.5)); panel(kArr(k, DK), u, -10.5, 5.5, 4.5, 2, -1.2, 1.2, top*0.5, top + 8, 0.08); panel(kArr(k, lit), u, -10.5, 3.75, 3.25, 2, -2.2, 2.2, top + 12.4, top + 14.6, 0.08);
    w.addBlocker({x:x0 + u, z:zc - 10.5, hw:5.5, hd:4.5, top:top + 19.5}); }
  for (let x = xl + 40; x < xr - 40; x += 60) { const u = x - x0; if (Math.abs(u) < gap + 14) continue;   // nothing stands over the spillway: a blocker there would wall it up
    k.add(box(5, 5.2, 9), CON2, T(u, top + 3.8, 2)); k.add(box(5.8, 0.6, 9.8), TRIM, T(u, top + 6.7, 2)); k.add(box(3, 1.8, 6), CON2, T(u, top + 7.9, 2)); k.add(box(0.6, 0.6, 0.6), lamp(0xffe2a0), T(u, top + 9.1, 2));
    for (const f of [1, 3]) panel(kArr(k, lit), u, 2, 2.5, 4.5, f, -3.2, 3.2, top + 3.6, top + 5.4, 0.07);
    w.addBlocker({x, z:zc + 2, hw:3, hd:5, top:top + 8.8}); }
  k.add(box(L, 1.2, 16), DK, T(xm - x0, top + 0.6, 0)); for (const s of [1, -1]) k.add(box(L, 0.8, 0.5), TRIM, T(xm - x0, top + 1.6, s*7.75));
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
  const L = lists(this), BRICK = M(0x6a3022), SOOT = M(0x2a2624), SHELL = M(0x3a3230), RUSTY = M(0x5a4a40), TIN = M(0x4a4440), TINR = M(0x3a3634), PALE = M(0xc8bca0), YEL = M(0xd9b44a, {roughness:0.5}), ORE = M(0x5a2e22), DARK = M(0x1e2024);
  const fire = M(0x2a2a30, {emissive:0xff9a40, emissiveIntensity:this.night ? 0.9 : 0.1, roughness:0.4});   // shed windows, lit by what's being poured inside
  const up = (x, y, z) => mul(T(x, y, z), RX(-PI/2));         // stands a lathe profile on end
  const hit = (a, b, r, what) => L.cables.push({a:new V3(a[0], a[1], a[2]), b:new V3(b[0], b[1], b[2]), r, what});   // long thin things in the air collide the way cables do
  // blast furnaces by the river where the ore barges tie up: cast house, stack and top gear, the skip hoist up from the stockyard, downcomer and dust catcher, three stoves
  for (let i = 0; i < 4; i++) {
    const q = at(2750 + i*330, 110), y = q.y, x = q.x, z = q.z;
    k.add(post(25, 12, 25), BRICK, T(x, y + 3, z)); k.add(prism(26, 4, 26), TINR, T(x, y + 9, z)); for (const f of [1, 3]) for (const u of [-7, 7]) panel(kArr(k, glow), x, z, 12.5, 12.5, f, u - 2.5, u + 2.5, y, y + 5.5, 0.12);
    for (const f of [0, 2]) { kArr(k, BRICK).push(...xf(f ? [12.5, 0, -12.52, -12.5, 0, -12.52, 0, 3.85, -12.52] : [-12.5, 0, 12.52, 12.5, 0, 12.52, 0, 3.85, 12.52], T(x, y + 9, z))); panel(kArr(k, fire), x, z, 12.5, 12.5, f, -9, 9, y + 5, y + 7.4, 0.12); }
    k.add(lathe([[8.6, 8], [10.6, 16], [10.6, 20], [6.3, 46], [6.9, 46.3], [6.9, 48]], 12, 1, 1, false), SHELL, up(x, y, z));
    for (const hh of [24, 30, 36, 42]) { const r = 10.6 - (hh - 20)*4.3/26 + 0.22; k.add(cyl(r - 0.13, r, 0.8, 12, false), SOOT, T(x, y + hh, z)); }
    k.add(cyl(11.8, 11.8, 1.5, 12, false), SOOT, T(x, y + 16.4, z)); k.add(cyl(10.9, 10.9, 0.7, 12, false), glow, T(x, y + 14.4, z));     // the bustle pipe, and the tuyeres glowing under it
    k.add(cyl(9.4, 9.4, 0.6, 12), IRON(), T(x, y + 48.3, z)); k.add(cyl(2.6, 5.2, 6.4, 8), SOOT, T(x, y + 51.8, z)); k.add(box(4.4, 3, 4.4), RUSTY, T(x - 3.4, y + 53.5, z));
    for (const [sx, sz] of [[1, 1], [-1, -1]]) { k.add(strut([x + sx*4.6, y + 48.6, z + sz*4.6], [x + sx*1.6, y + 63, z + sz*1.6], 1.5), SHELL); k.add(cyl(0.8, 0.8, 9.5, 6, false), SHELL, T(x + sx*1.6, y + 67.7, z + sz*1.6)); k.add(box(2.2, 0.5, 2.2), SOOT, T(x + sx*1.6, y + 72.7, z + sz*1.6)); }
    k.add(box(1.2, 1.2, 6), SHELL, T(x, y + 63, z)); k.add(post(0.2, 2, 0.2), IRON(), T(x, y + 73, z));
    const dc = [x + 4, y, z + 26], d0 = [x + 1, y + 62.5, z + 1.6], d1 = [dc[0], y + 27.5, dc[2]];
    k.add(strut(d0, d1, 2.4), SHELL); hit(d0, d1, 2.6, 'a blast furnace downcomer');
    k.add(lathe([[0.9, 5], [4.6, 11], [4.6, 23], [1.4, 27.6]], 10, 1, 1, false), SHELL, up(dc[0], y, dc[2])); for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.add(post(0.5, 12, 0.5), IRON(), T(dc[0] + sx*3.3, y + 5, dc[2] + sz*3.3));
    w.addBlocker({x:dc[0], z:dc[2], hw:4.6, hd:4.6, top:y + 27.6});
    const h0 = [x - 50, y + 0.5, z], h1 = [x - 4.5, y + 53.5, z], hn = 9;                                    // the skip hoist
    for (const s of [1, -1]) { k.add(strut([h0[0], h0[1], z + s*1.7], [h1[0], h1[1], z + s*1.7], 0.6), IRON()); k.add(strut([h0[0] + 3, h0[1] - 3, z + s*1.7], [h1[0] + 3, h1[1] - 3.5, z + s*1.7], 0.45), IRON());
      for (let j = 0; j < hn; j++) { const a = j/hn, b = (j + 1)/hn, P0 = [h0[0] + (h1[0] - h0[0])*a, h0[1] + (h1[1] - h0[1])*a, z + s*1.7], P1 = [h0[0] + 3 + (h1[0] - h0[0])*b, h0[1] - 3 + (h1[1] - h0[1] - 0.5)*b, z + s*1.7]; k.add(strut(P0, P1, 0.22), IRON()); } }
    k.add(box(3.4, 2.4, 3), RUSTY, mul(T(h0[0] + (h1[0] - h0[0])*0.42, h0[1] + (h1[1] - h0[1])*0.42 + 1.5, z), RZ(Math.atan2(h1[1] - h0[1], h1[0] - h0[0]))));
    k.add(box(7, 4, 7), BRICK, T(h0[0] - 1, y + 2, z)); hit(h0, h1, 3.2, 'a skip hoist');
    for (let j = 0; j < 3; j++) { const sz = z - 22 + j*22; k.add(cyl(6, 6, 31, 10, false), RUSTY, T(x + 30, y + 15.5, sz)); k.add(lathe([[6, 0], [5.3, 2.5], [3.3, 4.3], [0.5, 5]], 10, 1, 1, false), SOOT, up(x + 30, y + 31, sz)); for (const hh of [9, 20]) k.add(cyl(6.2, 6.2, 0.7, 10, false), SOOT, T(x + 30, y + hh, sz)); }
    k.add(strut([x + 22.6, y + 7, z - 24], [x + 22.6, y + 7, z + 24], 2), SHELL); k.add(strut([x + 22.6, y + 7, z], [x + 10, y + 15, z], 1.8), SHELL);
    w.addBlocker({x, z, hw:13, hd:13, top:y + 74}); w.addBlocker({x:x + 30, z, hw:7, hd:30, top:y + 36});
    L.chimneys.push({x, z, top:y + 74, hot:2});
  }
  // a row of chimneys, the tallest things in the valley after the radio mast
  for (let i = 0; i < 8; i++) {
    const q = at(2700 + i*180, 300 + (i % 2)*40), h = 88 + (i % 3)*12, band = M(i % 2 ? 0xe8e0d0 : 0x9e1b1b);
    k.add(frustum(8.6, 9, 8.6, 7.4, 7.4), BRICK, T(q.x, q.y - 2, q.z)); k.add(box(8, 0.8, 8), PALE, T(q.x, q.y + 7.2, q.z));
    k.add(cyl(2.6, 4.2, h, 10, false), BRICK, T(q.x, q.y + h/2, q.z)); k.add(cyl(3.3, 2.75, 2.6, 10), SOOT, T(q.x, q.y + h - 1.3, q.z));
    for (const yy of [h - 6, h - 12, h - 18]) { const r = 4.2 - 1.6*yy/h + 0.14; k.add(cyl(r, r + 0.03, 2, 10, false), band, T(q.x, q.y + yy, q.z)); }
    w.addBlocker({x:q.x, z:q.z, hw:4, hd:4, top:q.y + h}); L.chimneys.push({x:q.x, z:q.z, top:q.y + h, hot:1.4});
  }
  // rolling mills: long tin sheds on a brick footing, a monitor down the ridge and the glow of hot steel in the windows
  for (let i = 0; i < 6; i++) {
    const q = at(2700 + i*240, 470), len = 150, hw = 24, hd = len/2, x = q.x, y = q.y, z = q.z;
    k.add(post(48, 19, len), TIN, T(x, y + 6.5, z)); k.add(prism(50, 6, len + 2), TINR, T(x, y + 16, z)); k.add(box(8, 2.6, len - 18), TIN, T(x, y + 22.5, z));
    for (const f of [0, 2]) { kArr(k, TIN).push(...xf(f ? [hw, 0, -hd - 0.02, -hw, 0, -hd - 0.02, 0, 5.76, -hd - 0.02] : [-hw, 0, hd + 0.02, hw, 0, hd + 0.02, 0, 5.76, hd + 0.02], T(x, y + 16, z)));
      panel(kArr(k, DARK), x, z, hw, hd, f, -8, 8, y - 2, y + 11, 0.1); panel(kArr(k, glow), x, z, hw, hd, f, -5, 5, y - 2, y + (f ? 3 : 6), 0.2); panel(kArr(k, BRICK), x, z, hw, hd, f, 8, hw, y - 3, y + 4, 0.12); panel(kArr(k, BRICK), x, z, hw, hd, f, -hw, -8, y - 3, y + 4, 0.12); }
    for (const f of [1, 3]) { panel(kArr(k, BRICK), x, z, hw, hd, f, -hd, hd, y - 3, y + 4, 0.12); panel(kArr(k, fire), x, z, hw, hd, f, -hd + 4, hd - 4, y + 8, y + 12, 0.12); for (let u = -hd + 4; u <= hd - 3; u += 11.83) panel(kArr(k, TIN), x, z, hw, hd, f, u - 0.6, u + 0.6, y + 7.8, y + 12.2, 0.24); }
    if (i % 2 === 0) for (const f of [1, 3]) { panel(kArr(k, M(0x2a3a4a)), x, z, hw, hd, f, -16, 16, y + 12.5, y + 15.9, 0.3); sign(k, signMat(0xe8e0cc), 0, x, z, hw, hd, f, -14, 14, y + 12.45, y + 15.95, 0.36); }
    w.addBlocker({x, z, hw:24, hd:len/2, top:y + 24});
  }
  // the Long Shed: open at both ends, and you can fly straight through it
  const S = this.P.longshed || at(3050, 160), sy = w.height(S.x, S.z, true), sl = 270, swid = 36, sh = 24, WALL = M(0x5a4a40);
  for (const s of [1, -1]) { const wx = S.x + s*swid/2;
    k.add(box(2, sh, sl), WALL, T(wx, sy + sh/2, S.z));
    for (const f of [1, 3]) { panel(kArr(k, BRICK), wx, S.z, 1, sl/2, f, -sl/2, sl/2, sy - 2, sy + 5, 0.06); panel(kArr(k, fire), wx, S.z, 1, sl/2, f, -sl/2 + 3, sl/2 - 3, sy + 9, sy + 13, 0.06); }
    for (let z = -sl/2; z < sl/2; z += 18) { w.addBlocker({x:S.x + s*(swid/2 + 1), z:S.z + z + 9, hw:2.5, hd:9, top:sy + sh}); k.add(box(2.4, sh, 1.2), IRON(), T(S.x + s*(swid/2 + 0.5), sy + sh/2, S.z + z)); }
    k.add(box(2.4, sh, 1.2), IRON(), T(S.x + s*(swid/2 + 0.5), sy + sh/2, S.z + sl/2));
  }
  k.add(prism(swid + 6, 3.2, sl + 2), TINR, T(S.x, sy + sh + 0.3, S.z)); k.add(box(7, 2.4, sl - 30), TIN, T(S.x, sy + sh + 4.4, S.z));
  for (const e of [1, -1]) { k.add(box(swid + 6, 1.6, 1.2), YEL, T(S.x, sy + sh + 0.5, S.z + e*(sl/2 + 0.6))); kArr(k, WALL).push(...xf(e < 0 ? [21, 0, -sl/2 - 1.04, -21, 0, -sl/2 - 1.04, 0, 3.2, -sl/2 - 1.04] : [-21, 0, sl/2 + 1.04, 21, 0, sl/2 + 1.04, 0, 3.2, sl/2 + 1.04], T(S.x, sy + sh + 0.3, S.z))); }
  for (let z = -sl/2 + 10; z < sl/2; z += 30) k.add(box(swid, 0.6, 0.6), IRON(), T(S.x, sy + sh - 0.35, S.z + z));
  for (let z = -sl/2 + 20; z < sl/2; z += 40) k.add(ball(0.7, 6, 3), lamp(0xffb060), T(S.x, sy + sh - 2.5, S.z + z));
  for (const s of [1, -1]) { const f = s > 0 ? 1 : 3; panel(kArr(k, M(0x2a3a4a)), S.x + s*swid/2, S.z, 1, sl/2, f, -37, 37, sy + 14.2, sy + 23, 0.74); sign(k, signMat(0xe8e0cc), 0, S.x + s*swid/2, S.z, 1, sl/2, f, -34, 34, sy + 14.35, sy + 22.85, 0.82); }
  slab(this, {c:new V3(S.x, 0, S.z), yaw:0, hl:swid/2 + 3, hw:sl/2, y0:sy + sh - 0.5, y1:sy + sh + 6});
  L.sheds.push({x:S.x, z:S.z, y0:sy, y1:sy + sh, hw:swid/2, hl:sl/2, prev:0, t:-99});
  // slag heaps, still glowing where the last ladle was tipped
  for (let i = 0; i < 3; i++) { const q = at(3600 + i*160, 620); k.add(cyl(4, 40, 22, 9, false), SOOT, T(q.x, q.y + 11, q.z)); k.add(cyl(3, 6, 2, 9), glow, T(q.x, q.y + 22, q.z));
    for (const a of [0.5 + i, 2.4 + i*0.7, 4.3 + i*1.3]) k.add(strut([q.x + Math.cos(a)*5, q.y + 21.6, q.z + Math.sin(a)*5], [q.x + Math.cos(a)*(20 + i*4), q.y + 12.6 - i*2, q.z + Math.sin(a)*(20 + i*4)], 1.6, 0.3), glow);
    for (const [r, t] of [[30, 6], [17, 14], [6, 22]]) w.addBlocker({x:q.x, z:q.z, hw:r, hd:r, top:q.y + t}); }
  // ore bridges over the stockyard, between the furnaces and the river
  for (const gz of [2915, 3300]) { const gq = at(gz, 40), x = gq.x, y = gq.y, z = gq.z, x0 = x - 38, x1 = x + 24;
    for (const s of [-20, 20]) { for (const e of [1, -1]) k.add(strut([x + s, y - 2, z + e*7], [x + s, y + 29, z + e*1.6], 1.3), YEL); k.add(box(1, 1, 9), YEL, T(x + s, y + 12, z)); w.addBlocker({x:x + s, z, hw:2.5, hd:7.5, top:y + 31}); }
    for (const e of [1, -1]) { for (const yy of [29.2, 33]) k.add(box(x1 - x0, 0.7, 0.7), YEL, T((x0 + x1)/2, y + yy, z + e*2)); for (let j = 0; j < 10; j++) { const a = x0 + j*(x1 - x0)/10, b = a + (x1 - x0)/10; k.add(strut([a, y + (j % 2 ? 33 : 29.2), z + e*2], [b, y + (j % 2 ? 29.2 : 33), z + e*2], 0.4), YEL); } }
    k.add(box(5.5, 3.4, 5.6), M(0x3a3634), T(x - 12, y + 27.6, z)); for (const e of [1, -1]) k.add(post(0.14, 9.4, 0.14), IRON(), T(x - 12 + e, y + 21.2, z)); k.add(frustum(3.4, 2.6, 3, 4.2, 3.6), IRON(), T(x - 12, y + 14, z));
    hit([x0, y + 31, z], [x1, y + 31, z], 3.4, 'an ore bridge'); hit([x - 12, y + 29, z], [x - 12, y + 15, z], 2.4, 'an ore bridge');
    k.add(frustum(34, 2.4, 24, 18, 9), ORE, T(x - 2, y - 0.4, z + 26)); k.add(frustum(30, 2.2, 22, 14, 8), M(0x1e1c1c), T(x + 2, y - 0.4, z - 27)); }
  const grp = new THREE.Group(); k.build(grp); signBuild(k, grp); g.scene.add(grp);
  if (this.night) { const pl = new THREE.PointLight(0xff7a2a, 2.2, 900, 1.6); pl.position.set(bankX(3200, 1, 150), 60, 3200); g.scene.add(pl); }
  let ft = 0; this.anim.push(dt => { ft += dt; glow.emissiveIntensity = (this.night ? 1.3 : 0.45)*(0.85 + 0.15*Math.sin(ft*3.1) + 0.05*Math.sin(ft*11)); });
  p.y = w.height(p.x, p.z, true);
};

MK.gasworks = function(g, md, p){
  const w = g.world, L = lists(this), c = this, BRICK = M(0x7a3a2a), PALE = M(0xb4a890), SOOT = M(0x2a2624);
  const ring = [[0, 0], [70, 30], [-60, 50], [20, -80], [-40, -60]];
  ring.forEach(([dx, dz], i) => {
    // a telescoping holder: three lifts rising out of the tank, a shallow crown, and the red guide frame it rides up inside
    const x = p.x + dx, z = p.z + dz, y = w.height(x, z, true), r = 22 + (i % 2)*4, h = 28 + (i % 3)*8, grp = new THREE.Group(), k = new Kit(), n = 10, R = r + 2.2, H = h + 12;
    const shell = M(i % 2 ? 0x5a6a5a : 0x6a6458, {roughness:0.6, metalness:0.2}), rim = M(0x4a5248);
    k.add(cyl(r + 1, r + 1, 9, 18, false), M(0x3e4640), T(0, 1.5, 0)); k.add(cyl(r + 1, r + 1.3, 0.8, 18, false), rim, T(0, 6, 0));
    const lifts = [[r, 5, h*0.52], [r - 0.9, h*0.52, h*0.8], [r - 1.8, h*0.8, h]];
    for (const [rr, a, b] of lifts) { k.add(cyl(rr, rr, b - a, 18, false), shell, T(0, (a + b)/2, 0)); k.add(cyl(rr + 0.25, rr + 0.25, 0.9, 18, false), rim, T(0, a + 0.9, 0)); }
    k.add(lathe([[r - 1.55, -0.4], [r - 1.55, 0], [(r - 1.8)*0.72, 1.1], [(r - 1.8)*0.36, 1.75], [0.4, 2]], 18, 1, 1, false), rim, mul(T(0, h, 0), RX(-PI/2)));
    const P = (j, yy) => { const a = j/n*PI*2; return [Math.cos(a)*R, yy, Math.sin(a)*R]; }, tiers = [0, H*0.36, H*0.7, H];
    for (let j = 0; j < n; j++) { const a = j/n*PI*2; k.add(post(1.2, H + 3, 1.2), RED(), mul(T(Math.cos(a)*R, (H - 3)/2, Math.sin(a)*R), RY(-a))); k.add(frustum(1.6, 1.6, 1.6, 0, 0), RED(), T(Math.cos(a)*R, H, Math.sin(a)*R));
      for (let t = 1; t < 4; t++) { k.add(strut(P(j, tiers[t]), P(j + 1, tiers[t]), 0.7, 0.5), RED()); k.add(strut(P(j, tiers[t - 1] + (t === 1 ? 6 : 0)), P(j + 1, tiers[t]), 0.24), RED()); k.add(strut(P(j + 1, tiers[t - 1] + (t === 1 ? 6 : 0)), P(j, tiers[t]), 0.24), RED()); } }
    k.add(strut([r + 1, 7, 0], [r - 1.8, h, 0], 0.9, 0.25), IRON());                                          // the stair up the side
    k.build(grp); grp.position.set(x, y, z); g.scene.add(grp);
    w.addBlocker({x, z, hw:r*0.9, hd:r*0.9, top:y + h + 2});
    const t = g.addTarget({kind:'gas', label:'GAS HOLDER', pos:new V3(x, y + h*0.6, z), r:r + 2, hp:140, group:grp, team:9});
    t.onDown = (gg, src) => gasBoom(c, gg, t, src); L.holders.push(t);
  });
  // the retort house: brick, a louvred ridge, a row of fire-lit windows, short flues along the roof and the big chimney at its end
  const k = new Kit(), rx0 = p.x - 90, rz0 = p.z + 80, ry = w.height(rx0, rz0, true), fire = M(0x2a2a30, {emissive:0xff9a40, emissiveIntensity:this.night ? 0.9 : 0.1, roughness:0.4});
  k.add(post(30, 13, 18), BRICK, T(rx0, ry + 3.5, rz0)); k.add(prism(19.4, 5, 31.4), M(0x3a3430), mul(T(rx0, ry + 10, rz0), RY(PI/2))); k.add(box(22, 1.6, 2.4), SOOT, T(rx0, ry + 15.2, rz0));
  for (const f of [1, 3]) kArr(k, BRICK).push(...xf(f === 3 ? [-15.02, 0, -9, -15.02, 0, 9, -15.02, 4.85, 0] : [15.02, 0, 9, 15.02, 0, -9, 15.02, 4.85, 0], T(rx0, ry + 10, rz0)));
  for (const f of [0, 2]) { for (let u = -12; u <= 12; u += 4.8) { panel(kArr(k, fire), rx0, rz0, 15, 9, f, u - 1.2, u + 1.2, ry + 2, ry + 7.4, 0.1); panel(kArr(k, PALE), rx0, rz0, 15, 9, f, u - 1.5, u + 1.5, ry + 7.4, ry + 7.9, 0.14); } panel(kArr(k, PALE), rx0, rz0, 15, 9, f, -15, 15, ry + 9.3, ry + 10, 0.14); }
  for (const u of [-9, -3, 3, 9]) { k.add(post(1.2, 5, 1.2), BRICK, T(rx0 + u, ry + 14.5, rz0 + 4)); k.add(box(1.5, 0.4, 1.5), SOOT, T(rx0 + u, ry + 17.1, rz0 + 4)); }
  w.addBlocker({x:rx0, z:rz0, hw:15, hd:9, top:ry + 16});
  const cx = p.x - 100, cz = p.z + 70; k.add(frustum(6, 6, 6, 5, 5), BRICK, T(cx, p.y - 2, cz)); k.add(cyl(2, 3, 36, 8, false), M(0x6a3022), T(cx, p.y + 18, cz)); k.add(cyl(2.5, 2.1, 2, 8), SOOT, T(cx, p.y + 35, cz)); k.add(cyl(2.3, 2.34, 1.4, 8, false), PALE, T(cx, p.y + 30, cz));
  w.addBlocker({x:cx, z:cz, hw:3, hd:3, top:p.y + 36}); L.chimneys.push({x:p.x - 100, z:p.z + 70, top:p.y + 36, hot:0.6});
  // the coal store beside it, and the gas main out to the first holder
  k.add(frustum(26, 3, 16, 12, 5), M(0x1e1c1c), T(rx0 + 2, ry - 0.5, rz0 + 24)); k.add(strut([rx0 + 15, ry + 1.2, rz0 - 4], [p.x - 26, ry + 1.2, p.z + 14], 1.1), IRON());
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
  const w = g.world, k = new Kit(), H = 250, y0 = p.y, red = lamp(0xff3b30), L = lists(this), WHITE = M(0xe8e0d0), CREAM = M(0xcfc4a8), TRIM = M(0x8a7a6a);
  const wAt = y => 7 - 5.5*(y/H), C4 = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  // a four-legged lattice mast in aviation red and white: legs, a girt and a cross of bracing on every face of every panel
  for (let y = 0; y < H; y += 12) { const a = wAt(y), b = wAt(y + 12), col = Math.floor(y/36) % 2 ? WHITE : RED();
    for (const [sx, sz] of C4) k.add(strut([sx*a, y0 + y, sz*a], [sx*b, y0 + y + 12, sz*b], 0.55), col);
    for (let i = 0; i < 4; i++) { const s0 = C4[i], s1 = C4[(i + 1) % 4]; k.add(strut([s0[0]*a, y0 + y, s0[1]*a], [s1[0]*b, y0 + y + 12, s1[1]*b], 0.22), col); k.add(strut([s1[0]*a, y0 + y, s1[1]*a], [s0[0]*b, y0 + y + 12, s0[1]*b], 0.22), col); k.add(strut([s0[0]*a, y0 + y, s0[1]*a], [s1[0]*a, y0 + y, s1[1]*a], 0.3), col); }
    if (y % 48 === 0) for (const [sx, sz] of [[1, 1], [-1, -1]]) k.add(ball(0.8, 6, 3), red, T(sx*a, y0 + y, sz*a)); }
  for (const yy of [120, 228]) { const a = wAt(yy) + 1.4; k.add(box(a*2, 0.3, a*2), IRON(), T(0, y0 + yy, 0)); for (let f = 0; f < 4; f++) panel(kArr(k, IRON()), 0, 0, a, a, f, -a, a, y0 + yy + 0.9, y0 + yy + 1.1, 0); }
  for (const [sx, sz] of C4) k.add(frustum(3.4, 2.4, 3.4, 2, 2), M(0x9a948a), T(sx*7, y0 - 1.2, sz*7));
  k.add(cyl(0.3, 0.6, 30, 6, false), IRON(), T(0, y0 + H + 15, 0)); k.add(ball(1.2, 8, 4), red, T(0, y0 + H + 31, 0)); k.add(cyl(1.8, 1.8, 0.3, 8), IRON(), T(0, y0 + H + 2, 0));
  // the aerial array near the top: what Volume IV is about
  const aer = []; for (let i = 0; i < 4; i++) { const a = i*PI/2, ap = new V3(Math.cos(a)*12, y0 + H - 20, Math.sin(a)*12); k.add(strut([0, ap.y, 0], [ap.x, ap.y, ap.z], 0.4), IRON()); k.add(strut([0, ap.y + 9, 0], [ap.x, ap.y + 1, ap.z], 0.14), IRON()); k.add(box(2, 8, 2), M(0xd8d0c0), T(ap.x, ap.y, ap.z));
    for (const yy of [-2.4, 0, 2.4]) k.add(box(i % 2 ? 5 : 0.25, 0.25, i % 2 ? 0.25 : 5), IRON(), T(ap.x, ap.y + yy, ap.z)); aer.push(ap); }
  // the station at its foot: a streamlined little studio with its call sign up on the roof
  k.add(post(14, 9, 10), CREAM, T(16, y0 + 1.5, 0)); flat(kArr(k, M(0x2a2826)), 16, y0 + 6, 0, 7, 5); for (let f = 0; f < 4; f++) { const hf = f & 1 ? 5 : 7; panel(kArr(k, TRIM), 16, 0, 7, 5, f, -hf - 0.2, hf + 0.2, y0 + 5.3, y0 + 6.3, 0.2); panel(kArr(k, TRIM), 16, 0, 7, 5, f, -hf - 0.1, hf + 0.1, y0 - 3, y0 + 0.9, 0.1); panel(kArr(k, lamp(0x9ec7f0)), 16, 0, 7, 5, f, -hf + 1, hf - 1, y0 + 2.6, y0 + 4.2, 0.06); }
  k.add(box(1.2, 9.5, 2.4), TRIM, T(16, y0 + 4.75, 5.6)); panel(kArr(k, M(0x1e2024)), 16, 0, 7, 5, 0, -4.6, -2.6, y0, y0 + 2.6, 0.12);
  k.add(box(13, 2.2, 0.3), M(0x1a1a1c), T(16, y0 + 8, -2)); for (const s of [-5, 5]) k.add(post(0.25, 1, 0.25), IRON(), T(16 + s, y0 + 6.5, -2));
  for (const f of [0, 2]) sign(k, signMat(this.night ? 0xff4a6a : 0xe8e0cc, this.night), 12, 16, -2, 6.5, 0.15, f, -6.4, 6.4, y0 + 7.2, y0 + 8.8, 0.05);
  w.addBlocker({x:p.x + 16, z:p.z, hw:7, hd:5, top:y0 + 9.5});
  w.addBlocker({x:p.x, z:p.z, hw:7, hd:7, top:y0 + H + 30});
  // guy wires: three ways, three heights; they'll take a wing off
  for (let i = 0; i < 3; i++) { const a = i*PI*2/3 + 0.3, gx = p.x + Math.cos(a)*230, gz = p.z + Math.sin(a)*230, gy = w.height(gx, gz, true);
    k.add(box(4, 3, 4), M(0x9a948a), T(gx - p.x, gy + 0.5, gz - p.z));
    for (const f of [0.35, 0.62, 0.9]) { const top = new V3(p.x + Math.cos(a)*wAt(H*f), y0 + H*f, p.z + Math.sin(a)*wAt(H*f)), bot = new V3(gx, gy, gz);
      k.add(strut([top.x - p.x, top.y, top.z - p.z], [bot.x - p.x, bot.y, bot.z - p.z], 0.24), M(0x2a2a2a));
      L.cables.push({a:top, b:bot, r:2.2, what:'a guy wire on the WGCX tower'}); } }
  const grp = new THREE.Group(); k.build(grp); signBuild(k, grp); grp.position.set(p.x, 0, p.z); g.scene.add(grp);
  this.wgcx = {pos:new V3(p.x, y0 + H, p.z), aerials:aer.map(a => a.clone().add(new V3(p.x, 0, p.z))), base:new V3(p.x, y0, p.z)};
  for (let i = 0; i < 5; i++) { const a = i*PI*2/5 + 1, x = p.x + Math.cos(a)*420, z = p.z + Math.sin(a)*420; balloon(this, g, new V3(x, w.height(x, z, true), z), y0 + 120 + i*20 - w.height(x, z, true)); }
  p.y = y0;
};

MK.prison = function(g, md, p){
  const w = g.world, k = new Kit(), y = Math.max(p.y, 6), S = M(0x8a8478), S2 = M(0x7a7266), S3 = M(0x6a645a), CAP = M(0x5a5450), ROOF = M(0x3a3e44), L = lists(this);
  const dark = M(0x1e2024, {roughness:0.35, metalness:0.2}), lit = M(0x2a2a30, {emissive:0xffc070, emissiveIntensity:this.night ? 0.9 : 0.06, roughness:0.4}), facade = mkFacade(dark, lit, G.rng(4117), this.night);
  // the perimeter wall, buttressed, with a walk along the top; a gatehouse in the south wall and a guard tower at every corner
  for (const [cx, cz, lx, lz] of [[0, 60, 160, 4], [0, -60, 160, 4], [80, 0, 4, 120], [-80, 0, 4, 120]]) {
    k.add(post(lx, 17.4, lz), S, T(p.x + cx, y + 2.7, p.z + cz)); k.add(box(lx + 0.8, 0.6, lz + 0.8), CAP, T(p.x + cx, y + 11.7, p.z + cz));
    for (const f of lx > lz ? [0, 2] : [1, 3]) for (let u = -Math.max(lx, lz)/2 + 12; u < Math.max(lx, lz)/2 - 6; u += 16) panel(kArr(k, S2), p.x + cx, p.z + cz, lx/2, lz/2, f, u - 1.2, u + 1.2, y - 6, y + 10.6, 0.5, 0.15);
    w.addBlocker({x:p.x + cx, z:p.z + cz, hw:lx/2 + 1, hd:lz/2 + 1, top:y + 12}); }
  k.add(box(16, 22, 9), S2, T(p.x, y + 5, p.z - 60)); k.add(box(17, 0.8, 10), CAP, T(p.x, y + 16.2, p.z - 60)); for (const s of [-1, 1]) k.add(box(3.4, 3, 9.6), S2, T(p.x + s*6.6, y + 17.6, p.z - 60));
  panel(kArr(k, dark), p.x, p.z - 60, 8, 4.5, 2, -2.6, 2.6, y - 2, y + 6.5, 0.08); panel(kArr(k, lit), p.x, p.z - 60, 8, 4.5, 2, -5, 5, y + 10.6, y + 12.4, 0.08); panel(kArr(k, S2), p.x, p.z - 60, 8, 4.5, 2, -0.5, 0.5, y + 10.4, y + 12.6, 0.14);
  w.addBlocker({x:p.x, z:p.z - 60, hw:8.5, hd:5, top:y + 19});
  for (const [cx, cz] of [[80, 60], [80, -60], [-80, 60], [-80, -60]]) { const x = p.x + cx, z = p.z + cz;
    k.add(cyl(4.4, 5.4, 26, 8, false), S, T(x, y + 7, z)); k.add(cyl(6, 5.2, 1, 8), CAP, T(x, y + 19.6, z)); k.add(cyl(4, 4, 3.2, 8, false), lit, T(x, y + 21.7, z)); k.add(cyl(0, 5.8, 3, 8), ROOF, T(x, y + 24.8, z));
    k.add(ball(0.8, 6, 3), lamp(0xffe2a0), T(x, y + 26.6, z)); w.addBlocker({x, z, hw:5, hd:5, top:y + 26.3}); }
  // the cell block, four tiers of barred windows under a hipped roof, and the administration tower through the middle of it
  k.add(post(90, 20, 30), M(0x7a7266), T(p.x, y + 4, p.z)); k.add(frustum(92, 4, 32, 62, 2), ROOF, T(p.x, y + 14, p.z)); k.add(box(91.4, 0.7, 31.4), CAP, T(p.x, y + 13.7, p.z));
  facade(k, p.x, p.z, 45, 15, y, 4, 3.3, {pier:M(0x7a7266), pitch:3, pw:1.9, wh:1.5, sill:1.2, cap:9});
  k.add(post(16, 46, 16), S3, T(p.x, y + 17, p.z)); flat(kArr(k, CAP), p.x, y + 40, p.z, 8, 8); facade(k, p.x, p.z, 8, 8, y + 18, 5, 4, {pier:S3, pitch:3.6, pw:2, wh:2.4, sill:1, cap:3});
  for (let f = 0; f < 4; f++) { panel(kArr(k, S), p.x, p.z, 8, 8, f, -8.4, 8.4, y + 38, y + 40.8, 0.4); panel(kArr(k, S), p.x, p.z, 8, 8, f, -8.3, 8.3, y + 17.2, y + 18, 0.3); }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.add(box(3, 3.2, 3), S, T(p.x + sx*6.9, y + 41.2, p.z + sz*6.9));
  k.add(cyl(0.3, 0.3, 10, 6, false), IRON(), T(p.x, y + 45, p.z)); k.add(box(0.7, 0.7, 0.7), lamp(0xff3b30), T(p.x, y + 50.3, p.z));
  w.addBlocker({x:p.x, z:p.z, hw:45, hd:15, top:y + 18}); w.addBlocker({x:p.x, z:p.z, hw:8.5, hd:8.5, top:y + 42.8});
  // the boiler house in the yard, and its stack
  { const x = p.x - 54, z = p.z + 38; k.add(post(14, 13, 10), M(0x6a3022), T(x, y + 0.5, z)); k.add(prism(11, 3, 15), ROOF, mul(T(x, y + 7, z), RY(PI/2))); for (const f of [0, 2]) panel(kArr(k, lit), x, z, 7, 5, f, -5, 5, y + 2.4, y + 4.6, 0.08);
    k.add(cyl(1, 1.5, 22, 8, false), M(0x6a3022), T(x + 9, y + 11, z)); k.add(cyl(1.3, 1.1, 1.2, 8), M(0x2a2624), T(x + 9, y + 21.4, z));
    w.addBlocker({x, z, hw:7, hd:5, top:y + 10}); w.addBlocker({x:x + 9, z, hw:1.8, hd:1.8, top:y + 22}); L.chimneys.push({x:x + 9, z, top:y + 22, hot:0.4}); }
  const grp = new THREE.Group(); k.build(grp); g.scene.add(grp);
  this.skyBeams && this.skyBeams(g, {x:p.x, z:p.z}, 2, 60);
};

/* ---------- barrage balloons: silver, finned, on a steel cable you won't see until you hit it ---------- */
function balloon(c, g, ground, h){
  const top = ground.clone().add(new V3(0, h, 0)), grp = new THREE.Group(), k = new Kit(), TILT = RX(-0.13), SILVER = M(0xb8bcc0, {roughness:0.5, metalness:0.2}), SEAM = M(0x9a9ea2), LINE = M(0x3a3a3a);
  // a kite balloon, nose to the wind and a little high: the gas bag, three air-filled lobes at the tail to hold it steady, and the rigging down to the cable
  k.add(lathe([[0.3, -9], [2.3, -8.1], [3.9, -6], [4.65, -2.6], [4.8, 1], [4.25, 4.4], [2.7, 7.3], [1, 8.7], [0.2, 9]], 12, 1, 1), SILVER, TILT);
  for (const z of [-4.2, 2.6]) { const r = z < 0 ? 4.42 : 4.72; k.add(lathe([[r, -0.22], [r, 0.22]], 12, 1, 1, false), SEAM, mul(TILT, T(0, 0, z))); }
  k.add(lathe([[2.76, 7.3], [1.04, 8.72], [0.22, 9.03]], 12, 1, 1, false), SEAM, TILT);
  for (const a of [PI, PI/3, -PI/3]) k.add(lathe([[0.2, -3.6], [1.5, -2.2], [1.9, 0], [1.3, 2.2], [0.25, 3.5]], 6, 0.5, 1), SEAM, mul(TILT, RZ(a), T(0, 4.6, -6.3)));
  for (const [x, z] of [[2.6, 4.4], [-2.6, 4.4], [2.9, -3.6], [-2.9, -3.6]]) k.add(strut(xf([x, -3.9, z], TILT), [0, -9.5, 0], 0.08), LINE);
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
const PAL = {brick:[0x7a3a2a, 0x8a4a32, 0x6a3022, 0x5a2a20, 0x7a4a3a], stone:[0x6a645a, 0x7a7266, 0x8a8476, 0x5a5650], cream:[0xb8a888, 0xa89878, 0xc8b898], ware:[0x6a4a3a, 0x4a4a48, 0x5a4636], roof:[0x2a2826, 0x3a3430, 0x2e2a28],
  trim:[0xb4a890, 0x8a7a66], terra:[0xa8704e, 0xc09a70], span:[0x3a4a44, 0x4a3428], awning:[0x8a2a1a, 0x2f5a3a], slate:[0x3a3e44]};
const pick = (rr, a) => a[Math.floor(rr()*a.length)];
/* painted and neon lettering: one atlas of company names, laid on walls as textured panels (one extra mesh per tile and colour) */
const SIGNS = ['GANTRY STEEL CO.', 'RUSTWATER LINE', 'IRON CITY ALE', 'ZIEGLER & SONS', 'KOWALSKI COAL', 'UNION FREIGHT', 'RED ANVIL TOOLS', 'KEYSTONE FLOUR', 'ATLAS STORAGE', 'BLACK DIAMOND COKE', 'HOTEL GANTRY', 'THE COURIER', 'WGCX RADIO', 'BIJOU', 'EATS', 'DANCING'];
let signTex = null; const signMats = {};
const signMat = (hex, glow) => {
  if (typeof document === 'undefined') return null;
  const key = hex + (glow ? 'g' : 'p'); if (signMats[key]) return signMats[key];
  if (!signTex) {
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; const x = cv.getContext('2d');
    x.clearRect(0, 0, 2048, 1024); x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = '900 92px "Gill Sans", "Futura", "Century Gothic", "Trebuchet MS", Arial, sans-serif';
    SIGNS.forEach((s, i) => { const wd = x.measureText(s).width || 1, sc = Math.min(1, 940/wd); x.save(); x.translate((i % 2)*1024 + 512, (i >> 1)*128 + 68); x.scale(sc, 1); x.fillText(s, 0, 0); x.restore(); });
    signTex = new THREE.CanvasTexture(cv); signTex.anisotropy = 4;
  }
  const o = {map:signTex, color:hex, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-8};
  return (signMats[key] = glow ? new THREE.MeshBasicMaterial(o) : new THREE.MeshStandardMaterial(Object.assign(o, {roughness:0.9, metalness:0})));
};
// lettering i, 8:1, on wall f of a box; the wall behind it wants painting first
const sign = (k, mat, i, cx, cz, hw, hd, f, u0, u1, y0, y1, e) => {
  if (!mat) return; const S = k.signs || (k.signs = new Map()); let s = S.get(mat); if (!s) S.set(mat, s = {p:[], uv:[]});
  panel(s.p, cx, cz, hw, hd, f, u0, u1, y0, y1, e); const a = (i % 2)*0.5, b = a + 0.5, t = 1 - (i >> 1)/8, v = t - 0.125; s.uv.push(a, v, b, v, b, t, a, v, b, t, a, t);
};
const signBuild = (k, grp) => { if (!k.signs) return; for (const [mat, s] of k.signs) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(s.p), 3)); geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(s.uv), 2)); geo.computeVertexNormals(); grp.add(new THREE.Mesh(geo, mat)); } };

/* windows: a dark band a floor on each wall, cut into separate openings by piers that stand proud of it, and a scatter of lit ones.
   o: pier (material), pitch (bay width), pw (pier width), e (relief), wh (window height), sill, f0 (first floor to glaze), skip (a blind party wall), span (spandrel material behind the glass) */
const mkFacade = (dark, lit, rd, night) => (k, cx, cz, hw, hd, y0, floors, H0, o) => {
  if (floors <= (o.f0 || 0)) return;
  const dk = kArr(k, dark), pr = kArr(k, o.pier), lt = kArr(k, lit), e = o.e || 0.3, wh = o.wh || 1.8, sill = o.sill || 1.1, pitch = o.pitch || 3.6, pw = o.pw || pitch*0.5, f0 = o.f0 || 0, nf = floors - f0;
  const yb = y0 + f0*H0 + sill, yt = y0 + (floors - 1)*H0 + sill + wh;
  for (let f = 0; f < 4; f++) {
    if (f === o.skip) continue;
    const half = f & 1 ? hd : hw, n = Math.max(1, Math.floor((half*2 - 1.2)/pitch)), a = -n*pitch/2;
    if (o.span) panel(kArr(k, o.span), cx, cz, hw, hd, f, a + pw/2, -a - pw/2, yb, yt, e*0.5);
    for (let i = f0; i < floors; i++) panel(dk, cx, cz, hw, hd, f, a + pw/2, -a - pw/2, y0 + i*H0 + sill, y0 + i*H0 + sill + wh, e);
    for (let j = 1; j < n; j++) panel(pr, cx, cz, hw, hd, f, a + j*pitch - pw/2, a + j*pitch + pw/2, yb - 0.3, yt + 0.3, e*2);
    if (o.nolit) continue;
    for (let q = Math.min(o.cap || 7, Math.round(n*nf*(night ? 0.16 : 0.05)*(0.4 + rd()*1.2))); q > 0; q--) { const j = Math.floor(rd()*n), i = f0 + Math.floor(rd()*nf); panel(lt, cx, cz, hw, hd, f, a + j*pitch + pw/2, a + (j + 1)*pitch - pw/2, y0 + i*H0 + sill, y0 + i*H0 + sill + wh, e*1.5); }
  }
};
const course = (k, mat, cx, cz, hw, hd, y0, y1, e, skip = -1) => { const a = kArr(k, mat); for (let f = 0; f < 4; f++) if (f !== skip) { const half = f & 1 ? hd : hw; panel(a, cx, cz, hw, hd, f, -half - e, half + e, y0, y1, e); } };

function buildCity(c, g){
  const w = g.world, rr = G.rng(5519), rd = G.rng(77031), tiles = new Map(), night = c.night, L = lists(c);
  // rr lays the town out (and must be drawn from exactly as it always was, so every lot stays where the collision and the jobs expect it); rd only decorates
  const lit = M(0x2a2a30, {emissive:0xffc070, emissiveIntensity:night ? 0.9 : c.time === 'evening' ? 0.5 : 0.06, roughness:0.4}), dark = M(0x1e2024, {roughness:0.35, metalness:0.2});
  const YEL = M(0xd9b44a, {roughness:0.5}), ink = signMat(0x1e1a16), paint = signMat(0xe8e0cc);
  const burn = n => { for (let i = 0; i < n; i++) rr(); };
  const tile = (x, z) => { const key = Math.floor(x/900) + ',' + Math.floor(z/900); if (!tiles.has(key)) tiles.set(key, new Kit()); return tiles.get(key); };
  // places to keep clear: the airstrip, the skyhooks and their approaches, bridge roads, the railway, the big works
  const keep = [];
  for (const s of c.sites) if (s.kind === 'hook') { const a = Math.atan2(-s.point.x, -s.point.z); keep.push({lane:true, x:s.point.x, z:s.point.z, dx:Math.sin(a), dz:Math.cos(a), len:620, hw:62}); keep.push({x:s.point.x, z:s.point.z, r:60}); }
  for (const B of BRIDGES) { const F = bridgeFrame(B.z); for (const sgn of [1, -1]) keep.push({lane:true, x:F.c.x, z:F.c.z, dx:sgn*F.ax, dz:sgn*F.az, len:F.L/2 + 260, hw:20}); }
  for (const id of ['gasworks']) if (c.P[id]) keep.push({x:c.P[id].x, z:c.P[id].z, r:260});
  if (c.rail) for (let i = 0; i < c.rail.pts.length; i += 3) keep.push({x:c.rail.pts[i].x, z:c.rail.pts[i].z, r:16});
  const clear = (x, z) => keep.some(k => { if (!k.lane) return Math.hypot(x - k.x, z - k.z) < k.r; const ux = x - k.x, uz = z - k.z, al = ux*k.dx + uz*k.dz; return al > -k.hw && al < k.len && Math.abs(ux*k.dz - uz*k.dx) < k.hw; });
  const steel = (x, z) => z > 2550 && z < 4250 && x > rx(z);

  const facade = mkFacade(dark, lit, rd, night);
  const tank = (k, x, y, z, r = 2) => { for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.add(post(0.3, 3, 0.3), IRON(), T(x + sx*r*0.6, y + 1.5, z + sz*r*0.6)); k.add(cyl(r, r, r*1.8, 8), M(0x6a4a3a), T(x, y + 3 + r*0.9, z)); k.add(cyl(0, r*1.12, r*0.8, 8), M(0x3a3430), T(x, y + 3 + r*2.2, z)); };
  const stack = (k, x, y, z, mat) => { k.add(post(1.6, 3.4, 1.2), mat, T(x, y + 1.7, z)); k.add(box(1.9, 0.3, 1.5), M(0x3a3430), T(x, y + 3.4, z)); for (const s of [-0.4, 0.4]) k.add(post(0.45, 0.9, 0.45), M(0xa8704e), T(x + s, y + 4, z)); };
  // a fire escape: iron landings up one bay, with the stairs zigzagging between them
  const escape = (k, cx, cz, hw, hd, f, u, y0, floors, H0) => {
    const nx = FN[f][0];
    for (let i = 1; i < floors; i++) { const y = y0 + i*H0 + 0.7, [x, z] = wallPt(cx, cz, hw, hd, f, u, 0.75); k.add(box(nx ? 1.3 : 4.2, 0.18, nx ? 4.2 : 1.3), IRON(), T(x, y, z)); panel(kArr(k, IRON()), cx, cz, hw, hd, f, u - 2.1, u + 2.1, y + 0.75, y + 0.95, 1.42);
      const s = i % 2 ? 1 : -1, a = wallPt(cx, cz, hw, hd, f, u - s*1.6, 0.9), b = wallPt(cx, cz, hw, hd, f, u + s*1.6, 0.9); if (i > 1) k.add(bar([a[0], y - H0, a[1]], [b[0], y, b[1]], 0.6, 0.12), IRON()); }
  };

  /* a brick tenement or shop-and-flats block */
  const tenement = (k, cx, cz, y, wv, dv, floors, col, wantTank, wantStack, skip = -1) => {
    const hw = wv/2, hd = dv/2, h = floors*3.6 + 1.5, wall = M(col), trim = M(pick(rd, PAL.trim)), pitch = 3.3 + rd()*1.5, shop = floors >= 3 && rd() < 0.45 ? 1 : 0, small = floors <= 3 && Math.min(wv, dv) < 27 && rd() < 0.7;
    if (small && skip < 0) {                                  // a row house: pitched slate roof and a chimney at the gable
      k.add(post(wv, h + 3, dv), wall, T(cx, y + (h - 3)/2, cz)); const along = dv > wv, rh = Math.min(wv, dv)*0.32, rm = M(pick(rd, PAL.slate));
      k.add(prism(Math.min(wv, dv) + 1, rh, Math.max(wv, dv) + 1), rm, along ? T(cx, y + h, cz) : mul(T(cx, y + h, cz), RY(PI/2)));
      for (const f of along ? [0, 2] : [1, 3]) { const m = Math.min(hw, hd), a = wallPt(cx, cz, hw, hd, f, -m, 0.02), b = wallPt(cx, cz, hw, hd, f, m, 0.02), t = wallPt(cx, cz, hw, hd, f, 0, 0.02); kArr(k, wall).push(a[0], y + h, a[1], b[0], y + h, b[1], t[0], y + h + rh*m/(m + 0.5), t[1]); }   // the gable walls
      facade(k, cx, cz, hw, hd, y, floors, 3.6, {pier:wall, pitch, cap:4});
      if (wantStack || rd() < 0.5) stack(k, cx + (along ? 0 : hw - 1.2), y + h + rh*0.55 - 0.4, cz + (along ? hd - 1.2 : 0), wall);
      return y + h + rh + 2;
    }
    shell(k, wall, M(pick(rd, PAL.roof)), cx, y, cz, wv, h, dv);
    facade(k, cx, cz, hw, hd, y, floors, 3.6, {pier:wall, pitch, f0:shop, skip});
    k.add(box(wv + 1.4, 0.9, dv + 1.4), trim, T(cx, y + h - 1.1, cz));                                              // the cornice
    if (floors > 3) course(k, trim, cx, cz, hw, hd, y + (floors - 1)*3.6 + 0.35, y + (floors - 1)*3.6 + 0.75, 0.75, skip);
    if (shop) {
      course(k, trim, cx, cz, hw, hd, y + 3.25, y + 4.0, 0.75, skip);
      const fs = (skip + 2 + Math.floor(rd()*3)) % 4 || 0, f2 = skip < 0 ? Math.floor(rd()*4) : (skip + 2) % 4;
      for (const f of f2 === fs ? [fs] : [fs, f2]) { const half = f & 1 ? hd : hw; panel(kArr(k, dark), cx, cz, hw, hd, f, -half + 1.4, half - 1.4, y + 0.5, y + 2.9, 0.3); panel(kArr(k, wall), cx, cz, hw, hd, f, -1, 1, y - 1, y + 2.9, 0.6);
        if (rd() < 0.6) { const am = kArr(k, M(pick(rd, PAL.awning))), n = half > 14 ? 2 : 1; for (let j = 0; j < n; j++) { const u0 = n === 2 ? (j ? 1.6 : -half + 1.4) : -half + 1.4, u1 = n === 2 ? (j ? half - 1.4 : -1.6) : half - 1.4; panel(am, cx, cz, hw, hd, f, u0, u1, y + 2.4, y + 3.25, 2.2, 0.7); } } }
    }
    if (floors >= 4 && rd() < 0.32) { const f = skip < 0 ? Math.floor(rd()*4) : (skip + 1 + Math.floor(rd()*3)) % 4, half = f & 1 ? hd : hw; escape(k, cx, cz, hw, hd, f, (rd() - 0.5)*(half - 5), y, floors, 3.6); }
    if (wantTank) tank(k, cx + wv*0.2, y + h, cz - dv*0.15, 1.9);
    if (wantStack) stack(k, cx - wv*0.3, y + h, cz + dv*0.3, wall);
    if (rd() < 0.5) k.add(box(3.4, 2.6, 4.6), wall, T(cx - wv*0.1, y + h + 1.3, cz - dv*0.28));                     // the stair bulkhead
    if (skip < 0 && wv > 24 && rd() < 0.14) { const i = Math.floor(rd()*10), f = Math.floor(rd()*4), half = f & 1 ? hd : hw, sw = Math.min(half*1.5, 26), yy = y + h - 5.8; if (yy > y + 8) { panel(kArr(k, M(pick(rd, [0x2a3a4a, 0x7a2a1a]))), cx, cz, hw, hd, f, -sw/2 - 0.8, sw/2 + 0.8, yy - 0.5, yy + sw/8 + 0.5, 0.95); sign(k, paint, i, cx, cz, hw, hd, f, -sw/2, sw/2, yy, yy + sw/8, 1.05); } }   // a painted wall
    return y + h + (wantTank ? 9 : 4.5);
  };

  /* a Deco tower: stone piers running the full height between bands of glass and spandrel, setbacks, and something on top */
  const tower = (k, cx, cz, y, wv, dv, h, col, spire, neon, near) => {
    const terra = rd() < 0.3, stone = M(terra ? pick(rd, PAL.terra) : col), trim = M(0xc8b898), sp = M(pick(rd, PAL.span)), roof = M(pick(rd, PAL.roof)), tiers = h > 60 ? 3 : h > 36 ? 2 : 1, pitch = 3.8 + rd()*1.8;
    const crownHex = 0x4a7466, crown = M(crownHex, night ? {emissive:crownHex, emissiveIntensity:0.35, roughness:0.5} : {roughness:0.5, metalness:0.3});
    let hh = 0, ww = wv, dd = dv, tw = wv, td = dv;
    for (let t2 = 0; t2 < tiers; t2++) {
      const th = t2 === 0 ? h*0.6 : h*0.4/(tiers - 1), fl = Math.floor(th/3.6), base = t2 === 0 ? 1 : 0;
      shell(k, stone, roof, cx, y + hh, cz, ww, th, dd, t2 ? 0 : 3);
      facade(k, cx, cz, ww/2, dd/2, y + hh, fl, 3.6, {pier:stone, pitch, pw:pitch*0.42, f0:base, e:0.5, wh:1.7, sill:1.2, span:sp, cap:t2 ? 5 : 10});
      if (base) { facade(k, cx, cz, ww/2, dd/2, y, 1, 4.4, {pier:stone, pitch:pitch*2, pw:pitch*0.7, e:0.5, wh:3, sill:0.6, nolit:!night, cap:2}); course(k, trim, cx, cz, ww/2, dd/2, y + 3.9, y + 4.6, 1.25); }
      course(k, trim, cx, cz, ww/2, dd/2, y + hh + th - 1.2, y + hh + th + 0.5, 1.25);                               // the parapet at each setback
      hh += th; tw = ww; td = dd; ww *= 0.72; dd *= 0.72;
    }
    const m = Math.min(tw, td), top = y + hh;
    if (spire) {                                               // the tall ones by the Ziegler Building: a stepped lantern and a needle
      const s = 1 + near*0.5, r = m*0.36;
      k.add(frustum(tw*0.74, 5*s, td*0.74, tw*0.62, td*0.62), stone, T(cx, top, cz)); course(k, sp, cx, cz, tw*0.34, td*0.34, top + 1, top + 4*s, 0.3);
      k.add(cyl(r*0.7, r, 6*s, 8), trim, T(cx, top + 8*s, cz)); k.add(cyl(0.5, r*0.7, 9*s, 8, false), crown, T(cx, top + 15.5*s, cz)); k.add(cyl(0.12, 0.45, 9*s, 6, false), trim, T(cx, top + 24.5*s, cz));
      k.add(ball(0.7, 6, 3), lamp(0xff3b30), T(cx, top + 29.2*s, cz)); hh += 29.5*s;
    } else if (tiers > 1) {
      const style = Math.floor(rd()*6);
      if (style === 0 || style > 3) { k.add(frustum(tw*0.7, 4, td*0.7, tw*0.6, td*0.6), stone, T(cx, top, cz)); k.add(frustum(tw*0.42, 4, td*0.42, tw*0.3, td*0.3), trim, T(cx, top + 4, cz)); k.add(cyl(0.1, 0.2, 8, 5, false), IRON(), T(cx, top + 12, cz)); hh += 16; }
      else if (style === 1) { k.add(box(tw*0.62, 3, td*0.62), stone, T(cx, top + 1.5, cz)); k.add(frustum(tw*0.66, m*0.34, td*0.66, 0, 0), crown, T(cx, top + 3, cz)); hh += m*0.34 + 3; }
      else if (style === 2) { for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.add(frustum(2.2, 6, 2.2, 0.8, 0.8), trim, T(cx + sx*(tw/2 - 1.1), top - 1, cz + sz*(td/2 - 1.1))); k.add(box(tw*0.5, 4, td*0.5), stone, T(cx, top + 2, cz)); hh += 5; }
      else { k.add(box(tw*0.4, 3.5, td*0.5), stone, T(cx - tw*0.1, top + 1.75, cz)); tank(k, cx + tw*0.3, top, cz + td*0.2, 2.2); hh += 9.5; }
    } else {
      k.add(box(wv + 1.6, 1.1, dv + 1.6), trim, T(cx, top - 1.6, cz)); const style = Math.floor(rd()*4);
      if (style === 0) { tank(k, cx + wv*0.25, top, cz - dv*0.2, 2.2); hh += 9.5; } else if (style === 1) { k.add(box(wv*0.3, 3, dv*0.3), stone, T(cx, top + 1.5, cz)); hh += 3; }
    }
    // a sign: painted on a board up on the roof by day, neon at night
    if (tiers < 3 && rd() < 0.16) { const i = Math.floor(rd()*SIGNS.length), sw = Math.min(m*0.8, 24), by = y + hh + 1.5, bz = cz + td*0.3; k.add(box(sw + 1, sw/8 + 1, 0.4), M(0x2a2826), T(cx, by + sw/16 + 0.5, bz)); for (const s of [-1, 1]) k.add(post(0.3, 2, 0.3), IRON(), T(cx + s*sw*0.35, by - 0.5, bz));
      sign(k, night ? signMat(pick(rd, [0xff4a6a, 0x5fe0ff, 0xffd060]), true) : paint, i, cx, bz, sw/2, 0.2, 0, -sw/2, sw/2, by + 0.5, by + 0.5 + sw/8, 0.06); hh += sw/8 + 3; }
    if (neon) { const sw = Math.min(wv*0.6, 28), sy = y + 6.2, i = 10 + Math.floor(rd()*6); k.add(box(sw + 1.2, sw/8 + 1.6, 0.5), M(0x2a2826), T(cx, sy + sw/16, cz + dv/2 + 1.3)); for (const s of [-1, 1]) k.add(box(sw + 0.6, 0.22, 0.2), lamp(neon), T(cx, sy + sw/16 + s*(sw/16 + 0.45), cz + dv/2 + 1.6));
      sign(k, signMat(neon, true), i, cx, cz + 1.55, 0, dv/2, 0, -sw/2, sw/2, sy, sy + sw/8, 0.06); }
    return y + hh;
  };

  /* a dock warehouse: a long gabled shed with loading doors, a roof monitor and the company's name across the gable */
  const warehouse = (k, cx, cz, y, wv, h, len, col, roofCol) => {
    const wall = M(col), roof = M(roofCol), rh = wv*0.3, hw = wv/2, hd = len/2;
    k.add(post(wv, h + 3, len), wall, T(cx, y + (h - 3)/2, cz)); k.add(prism(wv + 1.6, rh + 0.25, len + 1.6), roof, T(cx, y + h - 0.25, cz));
    for (const f of [0, 2]) { const a = kArr(k, wall); a.push(...xf(f ? [hw, 0, -hd - 0.82, -hw, 0, -hd - 0.82, 0, rh, -hd - 0.82] : [-hw, 0, hd + 0.82, hw, 0, hd + 0.82, 0, rh, hd + 0.82], T(cx, y + h, cz))); }   // the gable ends, in the wall's own brick
    if (rd() < 0.6) k.add(box(wv*0.22, 1.6, len*0.7), wall, T(cx, y + h + rh - 0.2, cz));                            // the monitor along the ridge
    const nd = Math.max(2, Math.floor(len/13)), doors = kArr(k, M(0x2a3a32)); for (const f of [1, 3]) for (let j = 0; j < nd; j++) { const u = -hd + (j + 0.5)*len/nd; panel(doors, cx, cz, hw, hd, f, u - 2.2, u + 2.2, y - 1, y + 4.6, 0.25); }
    for (const f of [1, 3]) panel(kArr(k, dark), cx, cz, hw, hd, f, -hd + 2, hd - 2, y + h - 2.6, y + h - 1.4, 0.25);   // a strip of high windows under the eaves
    const pale = rd() < 0.6, band = kArr(k, M(pale ? 0xe8e0cc : pick(rd, [0x2a3a4a, 0x7a2a1a]))), i = Math.floor(rd()*10), sw = Math.min(wv*0.84, 30), sh = sw/8;
    for (const f of [0, 2]) { panel(band, cx, cz, hw, hd, f, -sw/2 - 0.8, sw/2 + 0.8, y + h - sh - 1.9, y + h - 0.9, 0.9); sign(k, pale ? ink : paint, i, cx, cz, hw, hd, f, -sw/2, sw/2, y + h - sh - 1.4, y + h - 1.4, 1); panel(doors, cx, cz, hw, hd, f, -3, 3, y - 1, y + 5.2, 0.25); }
    if (len > 34 && rd() < 0.5) { const f = rd() < 0.5 ? 1 : 3, lw = Math.min(len*0.7, 34); panel(band, cx, cz, hw, hd, f, -lw/2 - 0.8, lw/2 + 0.8, y + h - lw/8 - 3.6, y + h - 2.8, 0.4); sign(k, pale ? ink : paint, i, cx, cz, hw, hd, f, -lw/2, lw/2, y + h - lw/8 - 3.2, y + h - 3.2, 0.5); }
    return y + h + rh;
  };
  /* a yellow level-luffing crane on the quay, jib out over the water */
  const crane = (k, qx, qy, cz, side) => {
    for (const sx of [-4, 4]) for (const sz of [-3.5, 3.5]) k.add(post(1, 14, 1), YEL, T(qx + sx, qy + 7, cz + sz));
    k.add(box(10.5, 1.2, 9), YEL, T(qx, qy + 14.6, cz)); k.add(box(6.5, 5, 5.5), YEL, T(qx + side*0.5, qy + 17.7, cz)); panel(kArr(k, dark), qx + side*0.5, cz, 3.25, 2.75, side > 0 ? 3 : 1, -2.2, 2.2, qy + 17.6, qy + 19.4, 0.06);
    k.add(box(3.4, 2.6, 5), M(0x3a3430), T(qx + side*5, qy + 16.6, cz)); k.add(box(6.9, 0.4, 5.9), M(0x3a3430), T(qx + side*0.5, qy + 20.4, cz));
    const tip = [qx - side*30, qy + 34, cz], apex = [qx + side*1.5, qy + 30, cz];
    k.add(bar([qx - side*2.5, qy + 19.5, cz], tip, 1.1, 0.8), YEL); k.add(bar([qx + side*0.5, qy + 20, cz], apex, 0.7), YEL); k.add(bar([qx + side*5, qy + 18, cz], apex, 0.4), YEL); k.add(bar(apex, tip, 0.2), IRON());
    k.add(bar(tip, [tip[0], qy + 22, cz], 0.14), IRON()); k.add(box(0.9, 1.2, 0.9), IRON(), T(tip[0], qy + 21.6, cz));
    w.addBlocker({x:qx, z:cz, hw:5, hd:5, top:qy + 30});
    L.cables.push({a:new V3(qx - side*2.5, qy + 19.5, cz), b:new V3(tip[0], tip[1], tip[2]), r:2, what:'a dock crane'});
  };
  /* a mill: brick, tall windows between pilasters, a north-light sawtooth roof, and for most of them a chimney */
  const mill = (k, cx, cz, y, wv, h, len, col) => {
    const wall = M(col), hw = wv/2, hd = len/2, floors = Math.floor(h/4.2), n = Math.max(3, Math.round(len/9)), p = len/n, glass = kArr(k, dark), rm = M(pick(rd, PAL.roof));
    k.add(post(wv, h + 3, len), wall, T(cx, y + (h - 3)/2, cz));
    facade(k, cx, cz, hw, hd, y, floors, 4.2, {pier:wall, pitch:4.4 + rd()*1.2, pw:1.5, wh:2.9, sill:0.9, cap:5});
    course(k, M(pick(rd, PAL.trim)), cx, cz, hw, hd, y + h - 0.9, y + h - 0.3, 0.75);
    for (let j = 0; j < n; j++) { const z0 = cz - hd + j*p; k.add(prism(p, 4.6, wv, -p/2), rm, mul(T(cx, y + h, z0 + p/2), RY(-PI/2))); glass.push(cx + hw - 0.8, y + h + 0.6, z0 - 0.06, cx - hw + 0.8, y + h + 0.6, z0 - 0.06, cx - hw + 0.8, y + h + 3.9, z0 - 0.06, cx + hw - 0.8, y + h + 0.6, z0 - 0.06, cx - hw + 0.8, y + h + 3.9, z0 - 0.06, cx + hw - 0.8, y + h + 3.9, z0 - 0.06); }
    return y + h + 5;
  };
  const chimney = (k, qx, y, qz, ch, col) => {
    k.add(post(5.6, 7, 5.6), M(col), T(qx, y + 0.5, qz)); k.add(cyl(1.8, 3, ch, 8, false), M(col), T(qx, y + ch/2, qz)); k.add(cyl(2.35, 1.9, 2.2, 8), M(0x2a2826), T(qx, y + ch - 1.1, qz));
    k.add(cyl(2.12, 2.2, 1.4, 8, false), M(0xb4a890), T(qx, y + ch - 6, qz));
    w.addBlocker({x:qx, z:qz, hw:3, hd:3, top:y + ch}); L.chimneys.push({x:qx, z:qz, top:y + ch, hot:0.8});
  };

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
        const near = Math.max(0, 1 - Math.hypot(cx - bankX(-800, 1, 200), cz + 800)/900), h = 22 + rr()*30 + near*near*85, col = pick(rr, rr() < 0.5 ? PAL.cream : PAL.stone), tiers = h > 60 ? 3 : h > 36 ? 2 : 1;
        for (let t2 = 0; t2 < tiers; t2++) burn(Math.floor((t2 === 0 ? h*0.6 : h*0.4/(tiers - 1))/3.6));
        const spire = h > 80 && rr() < 0.6, neon = night && rr() < 0.3 ? pick(rr, [0xff4a6a, 0x5fe0ff, 0xffd060, 0x9eff7a]) : 0;
        top = tower(k, cx, cz, y, wv, dv, h, col, spire, neon, near);
      } else if (docks) {
        const h = 12 + rr()*8, col = pick(rr, PAL.ware), len = Math.min(dv + 8, 60), roofCol = pick(rr, PAL.roof);
        top = warehouse(k, cx, cz, y, wv, h, len, col, roofCol);
        if (b < 160 && rr() < 0.5) { const side = Math.sign(cx - rx(cz)), qx = bankX(cz, side, 10); crane(k, qx, w.height(qx, cz, true), cz, side); }
      } else if (mills) {
        const h = 16 + rr()*10, len = dv, col = pick(rr, PAL.brick); burn(Math.floor(h/4.2));
        top = mill(k, cx, cz, y, wv, h, len, col);
        if (rr() < 0.55) { const ch = 44 + rr()*26; chimney(k, cx + wv/2 - 4, y, cz + len/2 - 4, ch, pick(rr, PAL.brick)); }
      } else {
        const floors = b > 600 ? 2 + Math.floor(rr()*2) : 3 + Math.floor(rr()*4), col = pick(rr, PAL.brick); burn(floors);
        const wantTank = floors > 3 && rr() < 0.35, wantStack = rr() < 0.4;
        if (wv > 30 && floors >= 3 && rd() < 0.35) {             // two houses on the lot, a party wall between them
          const cut = (0.4 + rd()*0.2)*wv, f2 = Math.max(2, floors - 1 - Math.floor(rd()*2));
          top = Math.max(tenement(k, cx - wv/2 + cut/2, cz, y, cut, dv, floors, col, wantTank, false, 1), tenement(k, cx + cut/2, cz, y, wv - cut, dv - rd()*4, f2, pick(rd, PAL.brick), false, wantStack, 3));
        } else top = tenement(k, cx, cz, y, wv, dv, floors, col, wantTank, wantStack);
      }
      w.addBlocker({x:cx, z:cz, hw:wv/2 + 1, hd:dv/2 + 1, top}); n++;
    }
  }
  for (const k of tiles.values()) { const grp = new THREE.Group(); k.build(grp); signBuild(k, grp); g.scene.add(grp); }
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

/* ---------- after dark: river fog lying low in the valley, and searchlights sweeping the sky over the city ---------- */
function fogTexture(){
  if (fogTexture.t || typeof document === 'undefined' || !document.createElement) return fogTexture.t || null;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext && c.getContext('2d'); if (!x) return null;
  const R = G.rng(77); x.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) { const px = R()*256, py = R()*256, r = 20 + R()*60, gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, `rgba(255,255,255,${0.25 + R()*0.35})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) { x.save(); x.translate(ox, oy); x.fillStyle = gr; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.restore(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 20); return (fogTexture.t = t);
}
/* a beam has the player: with police heat, it brings the police; on certain night jobs, it's worse */
function spotted(c, g, S){
  const t = g.t, P = g.player, quiet = !c.caughtT || t - c.caughtT > 25;
  if (quiet) { c.caughtT = t; G.HUD.toast('Caught in a searchlight!'); }
  // police who already want you now know exactly where you are
  if (!c.noPolice && (c.heat || 0) >= 10) {
    G.policeHeat(c, g, 12); c.hostileTill = Math.max(c.hostileTill || 0, t + 25);
    if (!c.callT || t - c.callT > 20) { c.callT = t; G.HUD.radio('Gantry Air Police', G.pick(['Searchlight has him! All units, converge!', 'We have the plane in the light. Close in!', 'There he is, in the beam. Bring him down!'])); }
    for (const p of c.police || []) { const pl = p.alive && g.pilots.find(x => x.p === p); if (pl) { pl.route = null; pl.target = P; } }
  }
  // the job decides what being seen costs
  const J = c.job, sp = J && J.def && J.def.spot;
  if (!sp || (J.spotT && t - J.spotT < 6)) return;
  J.spotT = t; J.seen = (J.seen || 0) + 1;
  if (sp === 'heat') { G.policeHeat(c, g, 30); c.hostileTill = t + 40; G.HUD.radio(G.CONTACTS[J.def.contact].name.split(' ').slice(-1)[0], 'They\'ve seen the crates! Lose the police before you land, or don\'t land at all!'); }
  else if (sp === 'count') {
    const max = J.def.spotMax || 3;
    if (J.seen >= max) c.finishJob({win:false, note:'Spotted', say:'Too many people saw your face tonight. The story\'s dead; nobody will talk to the Courier now.'});
    else G.HUD.radio('Della', J.seen === max - 1 ? 'They\'ve seen you twice! Once more and every door in Gantry closes on us.' : 'You were in the light! Keep to the dark.');
  }
}
function afterDark(c, g){
  const time = g.world.time, night = time === 'night', dusk = time === 'evening'; if (!night && !dusk) return;
  // three thin sheets of mist at rooftop height and below, drifting slowly downriver; the hills stand up out of it
  const tex = fogTexture(), sheets = [];
  [[9, night ? 0.42 : 0.2], [19, night ? 0.3 : 0.14], [33, night ? 0.16 : 0.07]].forEach(([y, op], i) => {
    const m = new THREE.MeshBasicMaterial({color:night ? 0x8a96a8 : 0xc8b8a8, map:tex, transparent:true, opacity:tex ? op : op*0.5, depthWrite:false, side:THREE.DoubleSide});
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(6200, 12500), m); sh.rotation.x = -PI/2; sh.position.set(rx(0), y, -400); sh.renderOrder = 2 + i; g.scene.add(sh); sheets.push(sh);
  });
  c.anim.push(dt => { sheets.forEach((sh, i) => { if (sh.material.map) { sh.material.map.offset.y -= dt*0.0009*(1 + i*0.4); sh.material.map.offset.x += dt*0.0003*(i - 1); } }); });
  // searchlights: round downtown, on the docks, at the gasworks, the steelworks, the dam and on the Liberty Span's towers
  if (!G.buildSearchlight) return;
  const spots = [];
  const add = (x, z, y0) => { const y = y0 !== undefined ? y0 : Math.max(0, g.world.height(x, z, true)); const m = G.buildSearchlight(2600, 75, night ? 0.055 : 0.03); m.position.set(x, y - (y0 !== undefined ? 15 : 0), z); g.scene.add(m);
    const S = {m, head:m.userData.head, base:Math.random()*PI*2, ph:Math.random()*6, lock:0, pos:new V3(x, y + 1, z)}; spots.push(S); };
  for (let i = 0; i < 5; i++) { const a = i/5*PI*2 + 0.3; add(bankX(-900, 1, 300) + Math.sin(a)*320, -900 + Math.cos(a)*320); }
  for (const z of [-4100, -3700, -3300]) add(bankX(z, 1, 40), z);
  if (c.P.gasworks) { add(c.P.gasworks.x + 120, c.P.gasworks.z - 100); add(c.P.gasworks.x - 140, c.P.gasworks.z + 90); }
  for (const z of [2900, 3700]) add(bankX(z, 1, 240), z);
  add(rx(RU.DAM) - 250, RU.DAM - 60); add(rx(RU.DAM) + 250, RU.DAM - 60);
  { const F = bridgeFrame(-700), tu = rw(-700)/2 + 12; for (const sgn of [1, -1]) add(F.c.x + Math.cos(F.yaw)*sgn*tu, F.c.z - Math.sin(F.yaw)*sgn*tu, 34 + 84); }
  const dir = new V3();
  c.anim.push(dt => {
    const t = g.t, P = g.player;
    for (const S of spots) {
      let yaw = S.base + Math.sin(t*0.2 + S.ph)*1.1, el = 1.0 + 0.3*Math.sin(t*0.29 + S.ph);
      if (P && P.alive) {
        const dx = P.pos.x - S.pos.x, dy = P.pos.y - S.pos.y, dz = P.pos.z - S.pos.z, hd = Math.hypot(dx, dz), d = Math.hypot(hd, dy);
        if (S.lock > 0) { S.lock -= dt; yaw = Math.atan2(dx, dz); el = Math.atan2(dy, hd); }
        else {
          // a beam that sweeps across the player catches them and holds on for a few seconds
          const cy = Math.cos(el); dir.set(Math.sin(yaw)*cy, Math.sin(el), Math.cos(yaw)*cy);
          const along = dx*dir.x + dy*dir.y + dz*dir.z, off = Math.sqrt(Math.max(0, d*d - along*along));
          if (along > 60 && along < 2500 && off < 6 + along*0.055) { S.lock = 4 + Math.random()*3; spotted(c, g, S); }
        }
      }
      const dyaw = ((yaw - S.head.rotation.y + PI*3) % (PI*2)) - PI; S.head.rotation.y += dyaw*Math.min(1, dt*(S.lock > 0 ? 6 : 2)); S.head.rotation.x += (-el - S.head.rotation.x)*Math.min(1, dt*(S.lock > 0 ? 6 : 2));
    }
  });
  c.searchlights = spots;
}

/* ---------- the region comes together: city, railway, its train, the frame ---------- */
G.REGION_BUILD = G.REGION_BUILD || {};
G.REGION_BUILD.rustwater = (c, g) => {
  c.rw = c.rw || {slabs:[], cables:[], chimneys:[], balloons:[], holders:[], sheds:[]};
  c.heat = 0; c.police = []; c.heatAdd = (gg, n, why) => G.policeHeat(c, gg, n, why);
  buildEl(c, g);
  buildCity(c, g);
  if (G.Train && c.rail) c.train = new G.Train(g, c.rail, ['loco', 'box', 'pay', 'box'], {speed:13, s:30});
  afterDark(c, g);
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
