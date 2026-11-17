# Ace of the Airways

A 1937 air-pirate flight game in the spirit of Crimson Skies: Three.js, keyboard and mouse, no build step.

**Play:** open `index.html` from any static web server, or the GitHub Pages site for this repo
(Settings → Pages → Deploy from branch → `main` / root).

## Co-op (up to four pilots)

On the main menu, one pilot presses **Host a flight** and reads out the four-letter code; the others type it and press **Join**.
The host picks the mission and presses **Fly**, and everyone launches together, each in the plane from their own hangar.
Guests who join mid-flight drop in from the Margaret's trapeze.

- Peer to peer over WebRTC ([PeerJS](https://peerjs.com/) and its free matchmaking server); no game server to run.
- The host's game is the real one: it runs the mission, the AI and all hit detection. Each guest flies their own plane
  locally and streams its state; damage a guest takes is sent back to them. One AI wingman steps aside for each guest.
- A guest's bounty kills pay that guest; the mission's base pay goes to everyone.
- Some strict networks (corporate firewalls, some mobile carriers) block direct WebRTC links. PeerJS has no relay
  server by default, so those players can't connect.

## Controllers

A DualSense, DualShock or Xbox pad works in flight (menus stay mouse and keyboard). Plug it in or pair it over Bluetooth,
then press any button. Left stick flies, right stick aims, R2 guns, L2 rockets, R1/L1 throttle. The full layout is in
the in-game help (H) and at the top of `pad.js`. Every button, and every keyboard key, can be remapped on the Controls screen
(main menu or pause), which also has aim speed, stick swap, inverts and rumble.

## Code map

| File | What's in it |
|---|---|
| `data.js` | Chassis, guns, ammo, mods, saves, gang fleets |
| `world.js` | Terrain, sky, water, caves |
| `models.js` | Every airframe, airship, building, built from code |
| `planes.js` | Flight model, guns, turrets, gear |
| `combat.js` | Airships, bullets, rockets, damage |
| `ai.js` | Pilots, wingmen |
| `game.js` | The game loop, missions' shared code |
| `story.js`, `open.js` | Story campaign, open skies |
| `net.js` | Co-op |
| `pad.js` | Controller support and the Controls screen |
| `keys.js` | Keyboard remapping |
| `ui.js`, `hud.js`, `index.html` | Screens and HUD |

## Tests (Node, no browser)

```
node tools/run.js .                                   # smoke test: every mission, every plane; ends "all clear"
node tools/coop.js . host 47011 nightjar 45 &         # co-op: a host and a guest over a local socket
node tools/coop.js . guest 47011 nightjar 45
node tools/padtest.js .                                # controller: every button against a fake DualSense
```
