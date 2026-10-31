# DEFLECT

A browser-native, top-down geometric arena duelist. One stick sets both movement and facing; you read a
volley, lash or guard it back, and turn the rally on whoever fired first. Everything is drawn from vector
shapes and every sound is synthesized at runtime: no sprites, no audio files, no game engine.

**Play the alpha:** <https://spuds0588.github.io/DEFLECT/>
**Kiosk demo:** <https://spuds0588.github.io/DEFLECT/?demo=true>
**How to play:** [GAME_GUIDE.md](GAME_GUIDE.md)

[![DEFLECT kiosk demo](screenshots/demo-kiosk.png)](https://spuds0588.github.io/DEFLECT/?demo=true)

Solo training, endless bot practice, round matches against local bots, a one-life scored gauntlet, the
first campaign node, and host/join rooms for up to eight players. Eleven programs, nine arenas. The alpha
is deployed from `main` on every push.

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript, strict, ES2020 output |
| Rendering | Canvas 2D, one canvas, no WebGL |
| Audio | Web Audio synthesis; an 82 BPM lofi-house match loop and a 62 BPM menu bed built from MIDI notes |
| Menus | DOM/HTML over the arena canvas |
| Build | Vite, static `dist/`, no SSR and no server runtime |
| Multiplayer | PeerJS over WebRTC data channels, host-authoritative |
| Delivery | PWA: manifest, generated icons, service worker |
| Dependencies | `peerjs` at runtime; TypeScript, Vite and `tsx` in development |

No game engine (Phaser, PixiJS, Godot) is used. The simulation, renderer and netcode are small enough to
own directly, and the project avoids an engine's asset pipeline and scene model. The full reasoning is in
[AGENTS.md](AGENTS.md) §2.

## Architecture

### One loop, two clocks

`src/main.ts` owns the frame. Each `requestAnimationFrame`:

1. Clamps the frame delta to 100 ms.
2. Adds it to a fixed-step accumulator and runs up to four 1/60 s `World.step` ticks.
3. Renders with the leftover accumulator as an interpolation fraction.

So physics is always 60 Hz regardless of the display rate. A 144 Hz monitor renders smoother motion, a
30 Hz device drops frames without changing the simulation, and a slow frame cannot trigger a spiral of
death: the four-step clamp sheds time instead of falling further behind.

### Simulation is the only truth

`World` owns players, projectiles, rounds, bots' inputs, pickups and local threats. The renderer never
mutates it; it reads state and draws. Every entity is preallocated and reused through `active` flags, and
`step()` and `draw()` avoid per-frame allocation: no object literals, arrays, closures or string building
in the hot path. Particles and projectile trails are pooled ring buffers.

Content is data, not branches:

- `src/game/arenas.ts` holds pillars, spawn rings, traversal plates, wall style and floor signature.
- `src/game/programs.ts` holds the roster identity and kit tuning; the four action jobs branch in `World`.
- `src/game/tuning/*.json` holds all gameplay numbers, re-exported through the typed facade in
  `src/game/config.ts`, so most balance changes are a JSON edit with no code change.

Local bots are not part of the simulation. `BotBrain` reads public state and writes the same `InputFrame`
a human writes, then `World.step` treats it identically. That keeps bots bound by facing locks, dash
charges, energy and cooldowns, and it keeps AI cost out of the physics loop.

### Code map

| Area | Files |
| --- | --- |
| Frame loop, input routing, sessions, UI wiring | `src/main.ts` |
| Fixed-step simulation, rounds, kits, threats | `src/game/world.ts`, `entities.ts`, `movement.ts`, `collision.ts` |
| Renderer, camera framing and split view | `src/game/render.ts`, `camera.ts` |
| Program identity and vector marks | `src/game/identity.ts`, `programs.ts` |
| Bots and pathfinding | `src/game/bot.ts`, `nav.ts` |
| Local content | `powerups.ts`, `campaign.ts`, `saves.ts`, `gauntletRecords.ts` |
| Networking | `src/net/net.ts` |
| DOM and touch controls | `src/ui/dom.ts`, `src/ui/touch.ts` |
| Tuning | `src/game/tuning/*.json` |
| Build tooling | `scripts/bench.ts`, `scripts/gen-icons.mjs` |

## Performance on low-powered hardware

The design targets are a **4 ms average 60 Hz sim tick** with 8 players and 48 live projectiles, and
**144 FPS rendering** on integrated graphics. Both are guardrails, not hopes: the sim has a headless
benchmark and the renderer follows hard rules.

### Measured simulation cost

`npm run bench`, 1800 ticks after 400 warmup, on this development machine (milliseconds per 60 Hz tick):

| Scenario | avg | p99 | max | Live projectiles / threats |
| --- | --- | --- | --- | --- |
| 2P duel | 0.035 | 0.157 | 2.890 | 0.6 |
| 4P brawl | 0.050 | 0.167 | 1.002 | 1.6 |
| 8P stress | 0.071 | 0.188 | 0.770 | 7.0 |
| 8P max projectiles | 0.110 | 0.276 | 1.269 | 25.8 |
| 8P bot swarm (AI + sim) | 0.162 | 0.700 | 4.825 | 5.9 |
| Gauntlet max (all threat families) | 0.465 | 1.355 | 8.529 | 28.6 |

Average and p99 leave most of the 16.7 ms frame budget on the table. The occasional high `max` is a
scheduler or garbage-collection outlier, not steady cost; the guardrail is the average.

### Why it stays fast

- **No assets to load.** Art is paths and text glyphs drawn each frame. Audio is oscillators, noise and
  filters. The only generated files are PWA icons. The production payload is about 175 KB gzipped
  (589 KB JS, 49 KB CSS before compression), including PeerJS.
- **Allocation discipline.** Preallocated entity pools, a pooled particle system, cached label strings,
  preallocated A* scratch. The hot path is written to avoid triggering collections rather than to survive
  them.
- **Cheap glow.** Glow is a multi-pass stroke with `globalCompositeOperation = 'lighter'`. `shadowBlur`,
  `filter` and per-frame gradients are banned; gradients are built on resize only.
- **Bounded device pixels.** The backing store is capped at 2× device pixel ratio and letterboxed to 16:9,
  so a high-DPI phone does not pay for 3× or 4× pixels it cannot resolve.
- **Cheap AI.** Bots replan on a timer with a preallocated per-arena navigation grid and line-of-sight
  shortcuts, never a full-grid search per tick.
- **Local modes pay no network cost.** Training, bot matches, the gauntlet and the campaign never
  serialize or send a packet; online is opt-in.
- **Defensive catch-up.** The four-step clamp, a 100 ms delta cap and render interpolation keep a stalled
  tab from snowballing.

A phone that cannot hold 60 FPS still sees a correct simulation at the rate it can render, because
rendering and physics are decoupled.

## Multiplayer with PeerJS

There is no game server. One player hosts, everyone else connects to that browser, and the host is the
authority:

```
              host (slot 0)
              authoritative sim @ 60 Hz
             /      |       \
       guest 1   guest 2   guest N      each sends inputs, receives snapshots
```

- **Room code, not an account.** A 4-character code from an unambiguous base-32 alphabet maps to the peer
  id `defl-arena-v1-<CODE>` on the PeerJS public cloud broker. The broker only performs WebRTC signaling;
  gameplay traffic flows peer-to-peer over data channels.
- **Inputs up, snapshots down.** Guests send their `InputFrame` at 60 Hz. The host runs all physics, hit
  detection, scoring and round flow, then broadcasts a 30 Hz snapshot as nested numeric arrays serialized
  with BinaryPack. No JSON on the wire.
- **Local feel.** A guest predicts only its own movement against the shared arena, and interpolates every
  other body from a 65 ms snapshot buffer. The host never predicts; it owns the result.
- **Bandwidth.** A full 8-player, 48-projectile snapshot measures **2.45 KB** packed (one event included),
  or **73.4 KiB/s per guest** at 30 Hz. Two-way traffic for a typical guest stays well under 100 KiB/s;
  with seven guests the host uploads about **0.50 MiB/s**. That is why the v1 cap is 8 players: it is the
  host's upload that runs out first, not the protocol.
- **Failure behavior.** If the host closes the tab the room ends; guests get a disconnect state. A guest
  leaving frees its slot. There is no migration and no dedicated server.
- **What is not networked yet.** Competitive rooms carry match state only: no programs, kits, gauntlet
  threats, pickups or arena animation phase. Online opponents currently use slot identity and Probe's
  kit, and local-only content stays local. Server hosting and richer snapshots are separate future work.

The same 4-character room join path is the intended cross-platform layer for native builds (see the
roadmap): a Tauri app and a browser both speak WebRTC.

## PWA

DEFLECT ships as an installable progressive web app:

- `manifest.webmanifest` requests standalone, landscape, dark chrome. Installed, it launches without
  browser UI, which matters for a kiosk or a handheld.
- A service worker precaches the shell and caches hashed build assets on first fetch. Navigation is
  network-first, so a deploy lands on the next reload without a version bump; the cached shell is the
  fallback, and solo modes still open offline after the first visit.
- Distribution is a URL, not a store: no install gate before the first match, no review cycle for a
  balance patch, and one build for desktop and mobile browsers.
- The installed shell and the kiosk demo URL make it practical to leave a station running unattended.

The PWA also has a real cost: installability and caching differ per browser, and iOS still has its own
quirks. The app is a normal web page first and an installable app second.

## Input

Keyboard/mouse, gamepad and touch all write the same `InputFrame`.

- **Gamepad** uses the standard mapping, with an analog left stick and a 0.2 deadzone. Controller rumble
  uses the Gamepad API's `vibrationActuator` where available, with the older `hapticActuators.pulse`
  fallback; pads without either are simply silent.
- **Keyboard** is 8-way; the mouse is buttons only and never sets facing.
- **Touch** puts a stick at the bottom left and shield, skill and dash buttons at the bottom right. Auto
  lock and auto attack are on by default for touch and can be turned off.
- The most recently used device owns input; there is no on-screen input-mode switch. On a gamepad,
  `View`/`Select` toggles the canvas UI and `Start` opens the in-game menu.

Control tables and the full touch layout are in [GAME_GUIDE.md](GAME_GUIDE.md#controls).

## Roadmap

- **Tauri desktop builds (Windows, macOS, Linux).** Wrap the same static build in a Tauri shell to ship
  signed executables with native window management, offline caching and no browser chrome. The web build
  stays the source of truth; Tauri is a delivery shell, not a port.
- **Android APK through Tauri.** Tauri's mobile target can package the same web runtime into an APK while
  keeping touch controls. That makes a native Android build possible without a second engine or a second
  renderer.
- **Cross-platform play.** Browser and native clients would join the same 4-character rooms over PeerJS,
  because the network layer is browser WebRTC. The native build adds packaging, not a parallel netcode.
- **Local same-screen play.** The multiplayer menu already names `LOCAL`; it needs real local slots and a
  second input owner rather than a placeholder.
- **Public room discovery.** Planned around a shared prefix on the room code, with private rooms keeping
  an unprefixed code.
- **More campaign nodes and sectors.** Only `BUILD ROOT` is authored; the sector graph and layout handoff
  live in [CAMPAIGN.md](CAMPAIGN.md).

None of the Tauri work is built yet. It is listed because the current stack was chosen to make it a
packaging step rather than a rewrite.

## Development

```bash
npm install
npm run dev       # http://127.0.0.1:5173
npm run build     # strict typecheck + production PWA build into dist/
npm run preview   # serve the production build locally
npm run bench     # headless 60 Hz sim benchmark
npm run icons     # regenerate PWA icons
```

The alpha is deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`
(`npm ci`, `npm run build`, Pages artifact upload). The repository's Pages source must be **GitHub
Actions**, not the raw branch. Serve `dist/` over HTTPS locally if you need to exercise the service
worker, install flow or offline shell.

- Gameplay numbers: [src/game/tuning](src/game/tuning), typed in `src/game/config.ts`.
- Architecture, invariants, protocol and performance guardrails: [AGENTS.md](AGENTS.md).
- Forward plan and open questions: [TODO.md](TODO.md).
- Session log and measurements: [HISTORY.md](HISTORY.md).
- Gameplay reference and QA checklist: [GAME_GUIDE.md](GAME_GUIDE.md).
- Original design spec: [PRD-Deflect_game.md](PRD-Deflect_game.md).

## License

DEFLECT is **source-available**, not OSI open source. You can read, run, study, and modify it for
non-commercial use. Selling it or building a paid product on it requires prior written permission.
Modders are explicitly welcome to build and share free mods, provided they credit Corey Burns, link back
to this repository, include the license, and do not present their work as official. See [LICENSE](LICENSE)
for the full terms.
