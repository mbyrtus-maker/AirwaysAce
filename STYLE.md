# Ace of the Airways: art style guide

Follow this for every new model or scene change. Read models.js (the Gallant is the reference build) before adding to it.

## Look
- Low-poly, flat-shaded, chunky, in the Synty POLYGON manner. Silhouette first, then colour blocks, then small parts.
- Bright 1930s matinee adventure: late-afternoon warmth, Art Deco speed lines, saturated enamel paint, brass and polished steel.
- Everything is built in code. No image or model files. A small procedural canvas texture is allowed (terrain grain, the airship's name).

## Scene (world.js)
- Sun direction (-0.58, 0.60, -0.42), colour 0xffe2b0 at 1.35. Hemisphere fill 0xbcd4f0 over 0x8f8672 at 0.8.
  Sunlit faces show about 1.4x their paint colour and shaded faces about 0.5x, so keep paint values below about 0.9.
- Sky: zenith 0x2c68bd, mid 0x77b6e8, horizon 0xf0dfc0, sun bloom 0xffe6b0. Fog is the horizon colour, 1500 to 14000 m.
- Ground: meadow green (0.31, 0.54, 0.19) ripening to gold (0.61, 0.57, 0.25), ochre earth, pale sand, sandstone-grey rock. Sea 0x1f6f9e.
- Trees are stacked six-sided cones or one faceted ball; clouds are flat-bottomed faceted puffs in one InstancedMesh.
- Any InstancedMesh spread across the map must set frustumCulled = false (r128 culls by the base geometry's bounds).
- Output stays linear with no tone mapping (ui.js renderer untouched). Hex colours are what reaches the screen, times the light.

## Building blocks (models.js)
- Static geometry goes through a `Kit`: `k.add(tris, material, matrix)`, `k.both(...)` for port and starboard, `k.build(group)`.
  The Kit emits one mesh per material, so detail parts cost triangles but no extra draw calls.
- Primitives: `loft` (rings to solid; the workhorse), `lathe` (body of revolution along Z), `box`, `cyl`, `ball`, `torus`,
  `bar` (square strut), `tube`, `wire`, and flat decal shapes `disc`, `ring`, `poly`, `star`. Wings are `pan(f, t0, t1)` slices of a
  wing function `t -> [x, chord, thickness, zc, yc]`, finished with `tipOf`. Matrices: `T`, `RX`, `RY`, `RZ`, `SC`, `mul`.
- Solids orient themselves outward (signed-volume check). Decal shapes must be wound counter-clockwise, facing local +Z.
- Use real THREE meshes only for things other code holds on to: the propeller group and its blur disc, the 'pilot' head, dock rings.

## Proportions and budgets
- Fighters: span about 10 m, length 8.5 to 9 m, everything inside the hit sphere (userData.radius 5 to 5.6). Under 3,000 triangles
  (Gallant 2,220, Vandal 2,006) and about 25 draw calls.
- Fuselages are eight-sided lathes so the flanks are flat facets that take a stripe or roundel. Cowlings and nacelles 8 to 12 sides.
- Struts 4 to 6 cm, wires 1.5 cm, gun barrels 4 to 5 cm radius. Do not model anything finer.
- Airship: about 200 m, sixteen gores, under 25,000 triangles (currently 10,244).

## Paint and markings
- `paint = [main, second, trim]`, always applied through `G.mat(hex)`. Never tint a shared material.
- Paint in blocks by slicing the geometry (`cut` a lathe profile, `pan` a wing), never by overlapping coloured shells.
- Gallant: main fuselage and wings; second for the speed stripe, tail band, wing stripe and star; trim for cowling, wingtips, spine, spats.
- Vandal: main fuselage; second for wing and tail; trim for tips, spinner, tail band. Bare-steel nose, shark mouth on the chin radiator.
- Roundels go on wing tops (the chase camera sees these most), flanks and fins. Crew: second disc, trim disc, second star.
  Black Lantern pirates: trim ring, black field, bone skull. Layer decals with `k.decal`, 1.2 cm apart, never coplanar.
- Fixed colours: INK 0x151312, BONE 0xf1e9d6, DARK 0x26221f, STEEL 0xb9bec4, BRASS 0xdba63e, glass 0x9fd3e6 at 0.5 opacity.
- There is no environment map: keep metalness at or below 0.45 or the part turns black. Lamps and lit windows are basic or emissive.

## Contracts (other files depend on these)
- Plane frame: nose +Z, up +Y, pilot's right is -X. Metres. `G.buildPlane(chassis, paint)` returns a Group.
- Plane userData: `prop` (Group spinning about Z, with `prop.userData.disc`), `muzzles` (4 or more V3, in pairs), `rails` (2 or more V3),
  `radius`, `cockpit`, `exhaust`; `chassis` is set after building. One mesh named 'pilot'. Muzzle and rail points sit on visible hardware.
- Cockpit camera sits at `userData.cockpit` looking along +Z. Glass must be one convex solid around the eye, or face outward only,
  so it never tints the view. Keep the nose at least 3 degrees below the eye line and frames out of the centre.
- The trapeze bar is 1.6 m above the plane's origin: the Gallant's skyhook and the Vandal's wing top are at that height.
- `G.buildAirship(o)` userData: `trapeze` Group at (0, -34.5, -22) with its bar 9 m below; `props` (4 groups); `flak` at (0, 23.5, 34),
  (0, 23.5, -44), (7.5, -29, 2), (-7.5, -29, 20); `docks` [{ring, side, mesh}] with rings at (+-38, -31, 10), radius 6.5, facing Z; `radius` 110.
- game.js also hard-codes guns at (7, -24, 26), (-7, -24, -8), (0, 23, -20) and a launch camera at (-38, -22, 10): keep hardware at the
  first three and keep clutter away from the fourth. Nothing solid within 6 m of a dock ring's axis, in front of or behind it.
- Collision hull: ellipsoid 24 x 24 x 100 plus a gondola box (|x| < 6, y -20 to -40, |z + 6| < 30). Keep the visible hull inside it.
- World API is frozen: constructor(scene, opts), height, raw, flatW, shape, follow, los, slope, buildSky/Trees/Rocks/Clouds, and
  Particles, FX, Tracers. Terrain size, heightfield and coastline must not change.
- Keep the IIFE / window.G pattern and the script order in index.html. Do not touch data.js numbers, flight, combat, audio or the HUD.
