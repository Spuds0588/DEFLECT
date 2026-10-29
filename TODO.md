# TODO — DEFLECT

Status legend: `[ ]` not started · `[x]` done · `[~]` partial / placeholder · `[!]` blocked

Last updated: 2026-10-28 (v0.1.5 console menu + callsign settings)

---

## v0.1 — First playable (complete)

### Foundations
- [x] `AGENTS.md` decisions, doc workflow
- [x] Vite + TypeScript project, strict TS
- [x] PWA: manifest, generated icons, service worker, installable build
- [x] App shell: title → lobby → match screens, toasts, mute, perf HUD toggle
- [x] Node bench script for the simulation

### Core loop (single-stick)
- [x] Fixed 60 Hz sim + render interpolation, 1280×720 virtual space, letterbox scaling
- [x] Movement = facing (8-way keys, analog stick, deadzone), stand-still facing memory
- [x] Dash: 180u / 150ms, 100ms i-frames, 1.8s cooldown, afterimages, facing lock
- [x] Deflect racket: 30ms startup, 120ms active, 220ms whiff lag, facing lock, 55% move speed
- [x] Vector bolt: ×1.4 speed per deflect, +1 damage per deflect, 2 wall bounces (reset on deflect),
      owner-immunity until armed, 5s TTL, substepped hit detection (v0.1.3: short burst, 0.45s TTL, one bank)
- [x] Roman candle: 1.4s fuse, wall bounce, 120u blast, 2 damage, knockback, detonates on racket hit
      (v0.1.3: positioned as the slow, long, heavy ricochet option)
- [x] Arena: bounds, five pillars, player/pillar and projectile/pillar collision
- [x] Knockback from blasts, wall clamp, blast-ring FX
- [x] Health 5, energy 100 @ 15/s, bolt 15, candle 45 (health superseded in v0.1.3: 3 ring segments)
- [x] Round flow: countdown, last-standing scores, first to 3, draw on timeout, rematch
- [x] Training mode + sparring drone (placeholder only)
- [x] Bot-free stress scenario `?stress=N` for perf measurement

### Presentation
- [x] Neon vector look: grid, frame, brackets, pillars, additive glow, no `shadowBlur`
- [x] Avatars: ring color + unique glyph, heading notch, HP/energy/dash arcs
- [x] Pooled particles: shards, sparks, blast rings, dash ghosts
- [x] Trail ring buffers for bolts/candles
- [x] Camera shake driven by snapshot events, hit flash, low-HP vignette
- [x] Canvas HUD scaling to 8 players, round pips
- [x] Procedural audio: 14 distinct cues, digital/MIDI character, mute
- [x] 2-bar procedural music loop while a match runs

### Multiplayer
- [x] PeerJS star host, 4-char room codes, invite links, max 8 slots
- [x] Lobby sync, identity assignment, ready state, host start
- [x] Input packets with pressed-bit accumulation, host-side edge detection
- [x] 30 Hz compact snapshots, event list, guest interpolation (65ms)
- [x] Guest local movement prediction + correction
- [x] Round/match sync, rematch
- [x] Disconnect handling, room-full rejection, no-host error
- [x] Controller menu navigation

### Verification
- [x] `npm run build` clean
- [x] `npm run bench` with recorded numbers
- [x] Training playtest: movement, facing, swing lock, deflect escalation, candle, dash i-frames, rounds
- [x] Two-tab network test: join, start, movement, deflect, round end, rematch, disconnect
- [~] PWA offline reload verified; install prompt not exercised on a device
- [x] Controller mapping via injected standard-layout virtual pad; no physical hardware available

---

## v0.1.1 — Arena & local bot pass (complete 2026-10-28)

### Arenas
- [x] Arena data model: pillars, ordered spawn ring, accent, floor signature, mini-map preview
- [x] Four layouts: CROSSROADS (four gates), GRID ZERO (classic pillars), THE RING (four side gates),
      SWITCHBACK (staggered lanes)
- [x] Any player count spreads evenly around the selected spawn ring; training drone uses the opposite side
- [x] World, movement, renderer and guest prediction all read the same arena definition
- [x] Host arena selection in the lobby; guest receives the id in `START` and uses it for prediction
- [x] Training and bot matches use the selected arena
- [x] Muzzle-inside-geometry shots are refused instead of ricocheting into the shooter

### Bots
- [x] Local-only bot matches: 1v1 or 1v3, same `World` rules as a human
- [x] Three tiers: ROOKIE, VETERAN, DIGITAL (reaction, lead, aim error, fire cadence, dodge chance)
- [x] Three styles: DUELIST (close), TRICKSTER (orbit/deflect), SIEGE (range/candle)
- [x] Bot brains write `InputFrame`s only; no direct world mutation
- [x] Same single-stick constraint: bots must face by moving; swings lock facing
- [x] Own armed ricochets and candles enter the threat scan; wall/pillar pinning avoided
- [x] Precomputed per-arena 20u nav grid + reusable A* route, with line-of-sight shortcutting
- [x] Best-of-three flow, rematch, difficulty/count persistence
- [x] Title taglines and bot roster show the selected layout and the three styles

### Verification
- [x] All four arenas spawn eight players clear of geometry; 900 simulation ticks each, no NaN
- [x] Headless matrix: all 4 arenas × 3 tiers × 1v1/1v3 reached a match winner (21–145s), no stalls
- [x] 1v3 digital matches on all four arenas ended by round wins; 21–61 deflects per match
- [x] Two-tab match on SWITCHBACK: lobby shows host arena, guest starts on it, guest movement is
      predicted and the host's authoritative position matches
- [x] Lobby arena cycling reaches the guest
- [x] Browser bot match on THE RING with the new nav route and HUD tagline; no console errors

---

## v0.1.2 — Gauntlet threat sandbox (complete 2026-10-28)

### Threats
- [x] Local-only `GAUNTLET` mode on the title screen; endless, single player, no round flow
- [x] Worms: red square chains, cover phasing, touch damage, eat projectiles and viruses, grow and heal
- [x] Viruses: magenta diamonds, swarm separation, timed replication, worm infection, player infection
- [x] Infection meter spawns a nearby THRALL copy; thrall uses an `InputFrame`, single-stick facing, swings,
      bolts, candles, dashes and energy
- [x] Firewalls: warning phase, sweeping beams, burn players/worms/viruses, pillar line-of-sight cuts
- [x] Threat counts, infection bar and gauntlet kills in the canvas HUD
- [x] Renderer: segmented square worms, rotating diamond viruses, warning and active beam paths, thrall ring
- [x] Gauntlet added to the title screen and leave/pause flow; not exposed in rooms or snapshots
- [x] Four arenas supported; enemies spawn on the far side and viruses nudge clear of cover

### Hit feedback
- [x] Bolt knockback 360 → 520, candle 620 → 820, worm 380 → 560, firewall 460 → 640
- [x] Thrall melee knockback 700
- [x] Directional rotating-triangle spray on player, worm and virus hits
- [x] Hit event direction (`dirX`, `dirY`) added to projectiles/melee/firewall events and snapshots

### Verification
- [x] Headless gauntlet, all four arenas × 45 s: spawn cycles, beam movement, no NaN
- [x] Worm eats a virus and grows 7 → 9 segments; vertical firewall survives warning and sweeps
- [x] Thrall chases from spawn, reaches melee range, damages the player, fires bolts, and dies to player fire
- [x] Knockback test: 520 impulse moves a player 76 units over 0.5 s; event direction is preserved
- [x] Particle test: one hit produces 16 rotating triangle shards, all directed along the push vector
- [x] Browser gauntlet on THE RING: enemies render, firewalls/beam visuals run; player move and bolt input work
- [x] `npm run build` and `npm run bench` clean on v0.1.2

---

## v0.1.3 — Three-segment health and projectile roles (complete 2026-10-28)

### Health
- [x] Player health is **3 segments**, one per hit
- [x] Avatar ring is split into three arcs; a lost segment disappears, leaving a visible gap
- [x] HUD operator chips show the same three segments
- [x] Local low-health vignette triggers at 1 segment
- [x] Respawn and round start restore all three

### Projectiles
- [x] Fast burst bolt: 0.45 s life (~390 units), one bank, 1 damage, 15 energy
- [x] Three-shot burst; after the third shot a 0.45 s recharge restores the burst
- [x] Heavy candle keeps the slower, longer (~650 units), repeated-bounce role with 2 damage
- [x] Training drone bolts use a separate 4.5 s lifetime so the drone stays a ranged threat
- [x] Bot and thrall shot decisions respect burst state and short bolt range

### Verification
- [x] Headless burst: three shots fire, fourth is rejected, recharge restores the burst
- [x] Headless range: fast bolt lives 0.45 s; candle lives 1.38 s and travels farther
- [x] Headless health: 3 → 2 → 1 → dead; no segment pips remain under avatars
- [x] Browser ring sample at 2 HP: 107/180 sampled ring pixels active, in 2 arcs
- [x] Browser 1v1 DIGITAL bot match reached a 3-0 match end with max 3 HP; no console errors
- [x] `npm run build` and `npm run bench` clean on v0.1.3

---

## v0.1.4 — Operator kit, console shell, settings (complete 2026-10-28)

### Presentation
- [x] CRT console title: ASCII logo, terminal copy, blinking caret, boot/fade loading sequence
- [x] Bigger avatars with code/math symbols; rotating segmented health ring; vulnerable core
- [x] Removed operator chips, name plates, and side life/energy bars; status is drawn on the avatar
- [x] Floating burst dots, dash chevron, random-bug icon, and beam-cooldown notch
- [x] Fifth arena `MAINFRAME` (multi-district, follow camera) and arena-specific floor geometry
- [x] Knockback, rotating triangle sprays, and adjustable hit-rotation tilt

### Operator kit
- [x] Deflect is a combo: left arc, right arc, forward shield wave; each arc reflects
- [x] Shield arc sits tight to the avatar and draws right-to-left / left-to-right on alternating swings
- [x] Tap deflect next to an enemy to punch: small damage and pushback
- [x] Charged triangle dash: hold dash, cross enemies for damage, square trail; normal dash phases through
- [x] Dash uses the last movement direction, including while target lock holds facing
- [x] Lock target on `LT`; transparent candidate reticle becomes solid on acquire
- [x] Random per-match bug: mine, slow trap, frontal wall shield, or ghost
- [x] Ghost dims the avatar, ignores damage/aggro, and cancels on attack
- [x] Charged beam: orbit dots meet at the front, auto-fires at full charge, rooted but slow-sweep aim
- [x] Beam pierces all enemies in the line and is cut by pillar cover; worm body segments count
- [x] Cascading-error enemy grows block by block, hurts on touch, takes several hits per block
- [x] Gauntlet waves escalate spawn cadence every 30 s

### Settings
- [x] Dedicated settings screen with `CONTROLS`, `FEEDBACK`, `AUDIO`, `SYSTEM` tabs
- [x] Persisted hit rotation, impact flash, scanlines, volume, music, mute and arena/bot prefs
- [x] Hit-feedback preview button; reset-to-defaults option

### Verification
- [x] `npm run build` clean: 267.20 kB JS (77.88 kB gzip), 30.36 kB CSS (7.29 kB gzip)
- [x] `npm run bench` clean: 8P max 0.057 ms avg / 0.275 p99; bot swarm 0.044 / 0.161;
      gauntlet max 0.096 / 0.379 with 28.9 live threats
- [x] Headless beam: auto-fires at tick 54 (0.9 s), no release; worm body hit 20 → 19 HP with head out of line
- [x] Headless sweep: one tick turns 0.0092 rad at 0.55 rad/s, not an aim snap
- [x] Headless dash: locked facing east + last move west produces dash direction (-1, 0)
- [x] Browser: all four settings tabs switch, sliders persist, scanlines hide the overlay, training starts,
      no console errors
- [x] Build string 0.1.4; service-worker cache version bumped

---

## v0.1.5 — Console menu and callsign settings (complete 2026-10-28)

### Menu
- [x] Title reduced to ASCII mark, blinking cursor and version number only
- [x] Single plain-text console menu; one `>` cursor tracks the focused option
- [x] `SETTINGS` is a top-level menu option; footer links removed
- [x] Single-player and multiplayer stages converted to text rows and text choices
- [x] Arena picker and bot count/tier are text choices with a `*` selected marker
- [x] `SECTORS // PVPvE` appears only inside the multiplayer stage, as an in-development entry
- [x] Callsign moved out of the title menu into `SETTINGS > SYSTEM`
- [x] Input-mode labels removed from the title, settings and system diagnostics
- [x] `Input` uses the most recently touched device for movement and actions

### Verification
- [x] `npm run build` clean: 266.23 kB JS (77.47 kB gzip), 34.18 kB CSS (7.98 kB gzip)
- [x] Browser: hub shows four options with one `>` cursor; focus moves with arrow keys and Enter
- [x] Browser: no Sectors entry in the hub; it appears only in the multiplayer stage
- [x] Browser: callsign saved from Settings SYSTEM, persisted through reload, and Enter no longer starts a match
- [x] Browser: no KEYBOARD/GAMEPAD/INPUT DEVICE text remains in the UI
- [x] Browser: injected pad moved the player right, then switching the pad to neutral and pressing
      ArrowLeft moved the same player left (gamepad → keyboard handoff)
- [x] Browser: keyboard movement after the input arbitration change moved the player 68 → 1212 on x
- [x] Browser: sound label updates in the menu; bot match starts from the new solo menu

---

## Performance (measured 2026-10-28)

Machine: current dev laptop, Node 20 headless bench and Chromium for the browser run.

| Scenario | Sim ms/tick avg / p99 | Render | Notes |
| --- | --- | --- | --- |
| 2P duel, 0.6 live projectiles | 0.017 / 0.070 | 60 fps | v0.1.4 final bench |
| 4P brawl, 1.3 live projectiles | 0.009 / 0.051 | — | v0.1.4 final bench |
| 8P stress, 5.4 live projectiles | 0.010 / 0.031 | 60 fps | bench + `?stress=8` |
| 8P max projectiles, 13.6 live avg | 0.057 / 0.275 | 60 fps | v0.1.4 bench; mine/trap feed |
| 8P idle | 0.005 / 0.012 | — | floor case |
| 8P bot swarm (AI + sim) | 0.044 / 0.161 | — | three styles, digital, pathfinding |
| Gauntlet max threats (2W/12V/2F + 28E + thrall) | 0.096 / 0.379 | 60 fps | v0.1.4 bench, 28.9 live threats |

Budget is under 4 ms per tick with 8 players and 48 live projectiles. Every measured case remains far
under budget. Render held 60 fps (the display cap) under stress.

Snapshot size, **v0.1.2 schema**, 30 Hz, 4 events (kept for the bandwidth baseline):

| Party / live projectiles | Snapshot | Per guest | Host upload (N−1 guests) |
| --- | --- | --- | --- |
| 2P / 4 | 468 B | 13.7 KiB/s | — |
| 8P / 20 | 1.52 KB | 45.7 KiB/s | 0.31 MiB/s |
| 8P / 48 | 2.88 KB | 86.5 KiB/s | 0.59 MiB/s |
| 8P / 96 | 5.23 KB | 156.8 KiB/s | 1.07 MiB/s |

v0.1.4 adds `lockId`, `bugKind`, `bugCd` and `laserCd` to every player row and removes the candle, so
these sizes are **not current**. They need a fresh two-tab measurement before any new bandwidth claim.
The 8-player cap stands as a product decision; the real test is still eight actual WebRTC peers.

---

## v0.2 — Next (designer feedback first)

- [ ] Playtest pass with the designer; tune movement, swing, bolt speed, arena layouts from findings
- [ ] Tune the 3-health / burst / random-bug / charged-beam balance from live play
- [ ] Tune bot tiers/styles from live play: target choice, aggression, beam discipline, route smoothness
- [ ] Real 8-client soak test (eight tabs or machines) to confirm PeerJS fan-out and host CPU
- [ ] Reticle-free facing assist for keyboard? (only if playtests demand it)
- [ ] Sound pass: layered music states by rally speed
- [ ] Better spectator handling for dead players between rounds
- [ ] Snapshot delta compression or binary encoding if the 8P worst case causes trouble
- [ ] Self-hosted PeerJS broker option before public release
- [ ] Tauri shell spike (wrap the built PWA, window config, no Rust logic yet)
- [ ] Mobile/touch fallback investigation (PWA audience) — decide before adding

## Later phases

- [ ] Networked bot slots for underfilled rooms (host-authoritative)
- [ ] Bot refinements: team tactics, arena-specific routes, smarter candle placement
- [~] PvE foundation: local worms, viruses, firewalls, infection and a thrall copy are in GAUNTLET;
      bosses, waves, progression and any networked PvE are still unbuilt
- [ ] Gauntlet tuning from designer play: spawn cadence, worm speed/growth, virus cap, firewall frequency,
      thrall aggression, and whether a wave score/leaderboard belongs here
- [ ] Arena interactives: rails, destructible blocks, switches, hazards, power-ups
- [ ] Teams (shared ring color, unique glyphs, friendly fire rules)
- [ ] Player customization library (ring shapes, colors, glyphs) with contrast validation
- [ ] Matchmaking / room browser, lobby passwords, reconnect
- [ ] Touch controls, accessibility settings (reduced shake, colorblind palette check)
- [ ] Spectator + replay of rally

---

## Open questions for the designer

1. Keyboard facing is 8-way while the stick is analog. Is 8-way acceptable, or should keys get a
   "last-pressed wins" diagonal fine-tune?
2. Round win = last standing, first to 3. With 8 players, should a round win require a kill or just
   survival? (Current: survival, timer draw after 90s.)
3. Bolt damage +1 per deflect with no cap can one-shot a 3-segment target after two deflects. Keep the
   escalation, cap it at 2, or separate deflect damage from the base bolt?
4. Should a successful deflect grant a small energy refund? (Currently no.)
5. Preferred server: keep PeerJS cloud for playtests or self-host early?
6. Do we want a visible facing arrow, or just the notch + racket arc? (Current: subtle notch.)
7. Should 1v3 remain the default bot setup, or default to a 1v1 duel and let the player add opponents?
8. Does `MAINFRAME`'s district layout create enough distinct fights, or should sectors be gated instead
   of open? Does the follow camera need a manual look-ahead control?
9. Gauntlet now escalates in timed waves. Should it also track a best wave/kill score and show a death
   summary, or stay a pure sandbox?
10. Thrall pressure: one at a time feels readable. Should infection stack multiple thralls at higher
    threat counts, or is a single relentless copy the right rule?
11. Random bug fairness: is a per-match roll readable when the icon only appears on the avatar, or does
    the lobby need to show both players' bugs before the match?
12. Three health with a 3-shot burst means a clean burst can delete a target. Is that the intended
    close-range risk/reward, or should the burst cost more energy or have a slightly longer recharge?

## Known limitations (v0.1.4)

- PeerJS public broker only; no reconnect after a network drop (return to title).
- No dedicated servers, no NAT edge cases beyond PeerJS/WebRTC.
- Guests do not predict their own projectiles or deflects; feedback lags by RTT.
- No pause in multiplayer; leaving mid-match ends your session.
- Dead players wait for the next round (no spectate camera).
- Controller rumble not implemented.
- 8-player cap verified by simulation/render stress, not by eight real WebRTC peers.
- PWA offline reload verified in a production build; install prompt not tested on a device.
- Controller mapping verified with a standard-layout virtual pad only, not physical hardware.
- Bots are local only; they do not occupy multiplayer room slots. Their 20u-grid pathing can still look
  mechanical at tight corners, and they do not plan bank shots; tier/style tuning is the next playtest job.
- Arenas are static rectangles. Rails, destructibles, switches, hazards and power-ups are not built.
- 8P bot-swarm performance is bench-only; it is not a real eight-client network test.
- Gauntlet is local only. Enemies do not appear in multiplayer rooms, and the mode has no win condition,
  progression or score persistence yet.
- Thralls use simple close-range steering; they can lose time behind deep cover and do not coordinate with
  viruses or other thralls (only one thrall can exist at a time).
- Worms phase through pillars by design; firewall beams are the only threat that respects cover.
- Physical controller and eight real WebRTC peers remain untested.
- No control rebinding; settings cover feedback and audio, not button mapping.
- Bug assignment is a host-side roll per match. It is visible as an avatar icon but is not previewed in
  the lobby, so a guest learns their bug when the match starts.
- Charged beam/sweep and random-bug snapshots add fields; snapshot bandwidth has not been remeasured
  since v0.1.2.
- `MAINFRAME` is large enough for a follow camera, but bot routing and 8-player matches on it have not had
  a dedicated playtest or bench scenario.
- Cascading errors exist only in gauntlet; they are not in PvP, rooms, or the bench's PvP scenarios.
- Gauntlet waves have no score persistence, death summary, bosses, or sector transitions.
