# TODO — DEFLECT

Status legend: `[ ]` not started · `[x]` done · `[~]` partial / placeholder · `[!]` blocked

Last updated: 2026-10-29 (v0.1.27 SWEEP.EXE and the IN TESTING build label)

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
- [x] Procedural music loop while a match runs (v0.1.7: four-bar, 82 BPM lofi house from MIDI notes)

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

## v0.1.7 — Lofi-house soundtrack (complete 2026-10-28)

### Audio
- [x] Replaced the 120 BPM square arpeggio with a four-bar, 82 BPM lofi-house loop
- [x] Cmaj7 / Am7 / Dm7 / G7 progression and bass roots encoded as MIDI note numbers
- [x] Soft four-on-the-floor kick, claps, swung hats, sustained octave bass
- [x] Rhodes-style chord downbeat plus a soft late-bar re-hit
- [x] Looped vinyl crackle under a low-passed music bus; combat cues keep their digital edge
- [x] Music starts with a match, survives rounds, and stops/restarts cleanly on leave and toggle

### Verification
- [x] `npm run build` clean: 268.20 kB JS (78.15 kB gzip), 34.18 kB CSS (7.98 kB gzip)
- [x] Browser: 27 oscillators and 14 buffer sources scheduled in a measured 3 s window of idle
      training, matching the loop math; counts stopped immediately after leave
- [x] Browser: music toggle OFF and back ON, then a fresh match restarted the loop with no console errors
- [x] No simulation files changed; bench was not rerun for this audio-only pass

---

## v0.1.8 — Controller, assembly and alpha hosting (complete 2026-10-28)

### Input and menus
- [x] Fixed gamepad menu repeat mixing milliseconds and seconds; one D-pad tap is one line
- [x] Left-stick menu navigation restored with 0.55/0.32 hysteresis so a resting stick cannot chatter
- [x] Pad-loss grace raised to 3 s; a missing poll no longer flips the active device to keyboard
- [x] Solo flow staged: program → arena with previews → bot count/tier; local/online labels removed
- [x] Audio settings split into soundtrack, SFX and menu-sound channels; master mute retained

### Presentation
- [x] Removed the title-screen grid so the CRT console treatment reads cleanly
- [x] Larger arenas, tighter follow camera, circuitry/Unicode floor signatures
- [x] Permanently visible in-match text removed; wave banners and overlays remain
- [x] Removed in-game scanlines and the extra avatar rings; larger code-symbol cores and facing arrow
- [x] Level assembly replaces the loading bar: ground → frame → dropping cover → operator skeletons → spin-up

### Threats and feel
- [x] Shooter family: pulse square, nested triplex shotgun, trapezoid homing pod, three-dart flock
- [x] Worm chain is blocked by cover; shooting family and errors use the same collision rules
- [x] Enemy assembly on spawn and size-scaled triangle de-rez on death
- [x] Laser corridor widened and damage tick shortened/higher so the beam hurts while it tracks
- [x] Deflect active window 0.16 → 0.2 s and max early angle 0.28 → 0.32 rad; timing and distance grade the return

### Hosting and license
- [x] GitHub Actions Pages workflow builds `dist/` on `main`
- [x] Play link at the top of README
- [x] Custom source-available license with non-commercial terms, credit/link requirements, permission for
      non-mod derivatives, and an explicit free-mod carve-out

### Verification
- [x] `npm run build` clean: 285.62 kB JS (82.16 kB gzip), 34.67 kB CSS (8.03 kB gzip)
- [x] `npm run bench`: gauntlet max 0.107 ms avg / 0.401 ms p99; 8P bot swarm 0.040 / 0.227
- [x] Input harness: D-pad edge/repeat, stick edge/hysteresis and release all produce one expected edge
- [x] Headless deflect angles: early 0.304 rad, mid 0.164, late 0.103, contact 0.008
- [x] Headless 60 s gauntlet: 1 worm, 6 viruses, 9 sentries, 14 error blocks, no non-finite positions
- [x] Browser: title grid display none, no loading bar element, boot overlay transparent, build v0.1.8
- [x] Browser: staged gauntlet flow reaches the arena; arena assembly renders with no console errors
- [ ] Real device controller pass (mapping still verified with a virtual standard-layout pad)
- [x] GitHub Pages deployment and play URL verified: `dist` served at
      <https://spuds0588.github.io/DEFLECT/>, menu visible, gauntlet started, no console errors

---

## v0.1.9 — Guard, pickups and gauntlet pacing (complete 2026-10-28)

### Combat
- [x] Deflect cone widened from 120° to 180°; active window 0.2 → 0.24 s and max early angle
      0.32 → 0.24 rad
- [x] Hold deflect for 0.08 s raises a 1 s guard that reflects every shot in the front half-plane;
      each caught shot burns 0.11 s of guard, broken guard cooldowns in 0.28 s, early release in 0.12 s
- [x] Removed the hold-and-release shield wave. The third tap still fires the forward wave
- [x] Target-locked guard flattens caught shots toward the locked target instead of preserving the
      incoming angle
- [x] Lock-on range 1000 → 1600 units, still line-of-sight gated
- [x] Two dodge charges with one shared 1.8 s recharge; HUD shows two chevrons
- [x] Basic bolt is a five-shot stream: 0.45 → 0.2 s recharge, 15 → 3 energy per shot, 15 → 18 energy/s
      regen; holding weak fire auto-fires at 0.1 s intervals

### Gauntlet
- [x] Automatic firewalls off behind `GAUNTLET.autoFirewalls`; a damage-triggered switch remains future work
- [x] Firewall enemy damage 1 → 3 (`FIREWALL.enemyDamage`) while player damage stays 1
- [x] Enemy health cut: worms 8 → 5, viruses 2 → 1, pulse 4 → 2, triplex 7 → 4, homing 6 → 3, flock 2 → 1,
      cascading errors 4 → 3
- [x] Sentry packs queue and land one silhouette every 0.65 s; cap 12 → 8, first delay 4 → 11 s,
      interval 9 → 17 s, minimum 5.5 → 12 s, initial pulses 2 → 1
- [x] Low-tier sentry shots are short-lived, short-ranged, and disperse on cover instead of bouncing
- [x] Enemy fire now damages worms, viruses and cascading errors
- [x] Opening worm delay 2.5 → 4.5 s and virus delay 4.5 → 7 s

### Content and presentation
- [x] Modular local pickups in `powerups.ts`: restore, machine gun, scatter, overcharge, barbed whip,
      pathfinding; 11–15 s timed effects, weighted roll, floating active icon
- [x] Pickups render in training and gauntlet, with collection FX and audio
- [x] Brighter solid cover: panel fill, inset, hard rim, top highlight, hatch marks
- [x] Toggleable lower-left minimap in Settings → Feedback (`deflect.minimap`), showing cover and threats
- [x] Training flow split into arena grid (four-way nav) → bot count → difficulty → run
- [x] Spatial menu navigation keeps arena-grid arrows inside the grid and left/right on its stage row
- [x] Endless training: `World('training')` respawns player and bots, no rounds, timer, score pips or
      match end; bot deaths respawn with a fresh chosen count

### Verification
- [x] `npm run build` clean: 304.22 kB JS (87.34 kB gzip), 34.67 kB CSS (8.03 kB gzip)
- [x] `npm run bench`: 8P bot swarm 0.076 ms avg / 0.331 ms p99; gauntlet max 0.172 / 0.573 with
      31.1 live threats
- [x] Headless guard: front shot returns (vx +700), back shot untouched, 1 s burn-out enters cooldown,
      pickup spawn/effect works, two dodge charges refill, five-shot stream reaches recharge
- [x] Headless gauntlet: no automatic firewalls, sentry pack starts at 1 and caps at 8, 60 s stable
- [x] Browser: four-way arena grid nav changed arena on each arrow, training count → tier → run,
      endless training started, gauntlet ran with no console errors, minimap toggle persisted
- [x] Commit `b106224` pushed; Pages run `40819895257` built and deployed; production serves v0.1.9 and
      the staged training flow starts cleanly
- [ ] Real device controller pass still pending
- [ ] Firewall switch and first-time pickups in competitive rooms are not built

---

## v0.1.10 — Auto-advancing training flow (complete 2026-10-28)

### Flow
- [x] Selecting an arena advances directly to bot count
- [x] Selecting a bot count advances directly to difficulty
- [x] Selecting a difficulty starts the training run
- [x] Selecting a gauntlet arena starts the run immediately
- [x] Removed the NEXT/DIFFICULTY and RUN/START confirmation buttons and their dead CSS
- [x] Pointer hover focus moved from `pointerover` to `pointermove`, so a stationary mouse cannot steal
      the cursor from the controller/keyboard when a new stage appears

### Verification
- [x] `npm run build` clean: 304.08 kB JS (87.29 kB gzip), 34.70 kB CSS (8.03 kB gzip)
- [x] Browser: five confirm presses from the hub reached a live training run (program, arena, count, tier,
      start) with no NEXT/RUN detour; gauntlet selection started directly
- [x] Browser console clean; no stale arena-continue, bot-run or console-run references remain

---

## v0.1.11 — Territory roles and kill-drop economy (complete 2026-10-28)

### Powerups
- [x] Kill drops are the primary faucet: 4% for small enemies, 25% for heavy silhouettes, 5.5 s shared
      cooldown, max 2 active pickups
- [x] Ambient safety-net spawns moved from 6 s / every 13 s to 24 s / every 42 s
- [x] Drop placement scatters 36–92 units from the kill; ambient placement stays 160–340 units away

### Gauntlet roles
- [x] Waves now escalate every 45 s without resetting every spawn timer into a synchronized burst
- [x] Caps cut to 2 worms, 10 viruses, 5 sentries and 14 cascading-error blocks
- [x] Worms hold a patrol territory, aggro only when the player enters 310 units or hits them, then return
      after 5.5 s; longer chains move slower
- [x] Viruses spread to roam points and only pursue a player inside 310 units or an uninfected worm inside
      560 units; they prefer worms as hosts
- [x] Sentries hold their landing zone with a 100–250 unit leash; triplex and homing silhouettes move much
      slower than pulse squares and flocks
- [x] Sentry packs stagger at 1.1 s, start at 18 s, and packs after the first four cap at four silhouettes
- [x] Cascading errors start at 28 s and grow one block every 3.4 s instead of every 2.2 s

### Verification
- [x] `npm run build` clean: 308.00 kB JS (88.47 kB gzip), 34.70 kB CSS (8.03 kB gzip)
- [x] `npm run bench`: 8P bot swarm 0.081 ms avg / 0.364 ms p99; gauntlet max 0.099 / 0.403 ms with
      25.9 live threats
- [x] Headless 4-minute idle gauntlet probe: 2 worms, 5 anchored sentries, 14 error blocks max; all
      sampled viruses roamed through 2 minutes (one pursued the idle player at 3 minutes), and average
      sentry drift from its anchor stayed at or below 176 units
- [x] Sentry queue stops landing silhouettes at `SENTRY.max`; a four-silhouette pack can no longer push
      the live count past five
- [x] Kill-drop probe: 11/40 worm kills and 8/40 triplex kills produced pickups at the 25% rate; pickup
      active cap stayed at 2
- [x] Browser gauntlet at 56 s: 3 roam-target viruses, 2 sentries holding 159/58 units from their
      anchors, 7 error blocks and 1 infected worm; at 132 s: 5 roam viruses, 5 sentries, 14 error blocks,
      2 infected worms, no console errors

---

## v0.1.12 — Scored gauntlet runs and local top table (complete 2026-10-29)

### Setup
- [x] Gauntlet arena choice advances to a run-setup stage instead of starting immediately
- [x] Run type choice: `SURVIVAL` (one ring, scored) and `PRACTICE` (endless respawns, unscored)
- [x] Setup stage repeats the arena name, its tagline, both run types, and the local top-eight table
- [x] Title menu shows the best wave beside `GAUNTLET` (`BEST W5`) or `SCORED` when empty

### Run records
- [x] `src/game/gauntletRecords.ts` owns the record shape, ranking, validation, localStorage and `m:ss`
      formatting
- [x] Rank by wave reached, then survival seconds, then kills; keep eight records
- [x] Scored runs freeze the arena on ring break and open a results card with wave, time, kills, arena,
      placement and actions `RETRY`, `SETUP`, `TITLE`
- [x] Practice deaths still respawn on the training timer and never write a record

### Verification
- [x] `npm run build` clean: 312.87 kB JS (90.04 kB gzip), 35.77 kB CSS (8.21 kB gzip)
- [x] `npm run bench`: 8P bot swarm 0.071 ms avg / 0.330 ms p99; gauntlet max 0.106 / 0.428 ms with
      25.9 live threats
- [x] Headless survival/practice probe: scored run sets `gauntletOver`, freezes `gauntletTime`, and stops
      stepping; practice respawns with the world still running
- [x] Headless records probe: ten runs keep the top eight, sorted W10 down to W3; `372 s` formats `6:12`
- [x] Browser: `SINGLE PLAYER` → `GAUNTLET` → arena shows `GAUNTLET // CROSSROADS // RUN SETUP` with both
      run types and an empty table; choosing survival starts immediately
- [x] Browser: a scored death opened `WAVE 1 // 0:24`, `0 KILLS // NEW PERSONAL BEST`, with `RETRY` focused;
      the setup table then showed `01 NULL W1 0:24 CROSSROADS`
- [x] Browser: a forced scored end at `WAVE 3 // 1:32` with 17 kills sorted ahead of W1; `SETUP` returned to
      the same stage and the title menu showed `BEST W1` before the second record
- [x] Browser: practice damage respawned the player after the timer, showed no overlay and left the record
      count unchanged

---

## v0.1.13 — Sector campaign blueprint (scaffold 2026-10-29)

### Archive
- [x] `SECTORS // PVPvE` is now an enabled blueprint stage inside Multiplayer, not a disabled line
- [x] `src/game/sectors.ts` owns five sector records: LOCALHOST, OFFICE LAN, CINEVAULT, BOTNET and
      SINGULARITY
- [x] 42 arena nodes across the five sectors, connected by bridges, paired teleporter pads and a central
      lift; every sector has an entry, an exit and at least one boss node
- [x] Each node names an existing arena as its first blockout (`arenaId`) so the campaign can be built on
      the current arena data instead of a second map format
- [x] Canvas schematic draws node silhouettes, bridge, pad and lift lines, boss rings, entry/exit markers
      and a legend
- [x] Sector tabs show story, objective, environmental mechanic, boss and exit; keyboard/gamepad focus
      moves across all five tabs and `ESC`/`B` returns to Multiplayer
- [x] Archive states the campaign is one route through device clusters, with a `NETWORK ROUTE` line ending
      at `ROOT`; the tabs are a review tool, not the in-play sector selector
- [x] `CAMPAIGN.md` captures the campaign arc, per-sector layout intent, map handoff checklist and open
      runtime rules

### Verification
- [x] Sector graph probe: no duplicate nodes or links, all links resolve, every sector is connected from
      its entry, every sector has a boss, and every node sits inside the map margins
- [x] Browser: Multiplayer → Sector blueprint opened; switching from LOCALHOST to OFFICE LAN to CINEVAULT
      updated arena/link counts, story, boss and schematic; ArrowRight moved focus, Enter selected, Escape
      returned to Multiplayer; no console errors

### Next
- [ ] Receive and convert the first arena sketches into `ArenaDef` blockouts, starting with LOCALHOST
- [ ] Build a local-only `SectorRuntime` for one arena node at a time, party state and bridge/pad
      transitions; no snapshots or rooms until networked PvE has its own protocol
- [ ] Decide scene cuts versus a continuous map, wipe rules, PvP rules in PvPvE and boss scaling for 1–4
      players before the first playable sector

---

## v0.1.14 — One-life gauntlet and slow wave ramp (2026-10-29)

### Rules
- [x] Gauntlet is a single-life score chase. The setup stage has one `BEGIN RUN` action and no practice or
      respawn choice; training remains the practice space
- [x] Ring break ends the run, freezes the arena and writes the local record as before
- [x] The internal practice/bench path remains for headless max-load testing; it is not exposed in the UI

### Pacing
- [x] Wave duration 45 → 30 s. Difficulty now ramps across 120 waves instead of maxing out in a few minutes
- [x] Threat families unlock one at a time: worms wave 3, viruses wave 6, triplex wave 9, cascading errors
      wave 12, homing pods wave 15, flocks wave 18
- [x] Opening is one slow pulse sentry at 9 s, then one worm at wave 3; no virus, error or heavy shooter
      dump in the opening
- [x] Spawn timers taper slowly: sentry 30 → 9 s, worm 34 → 14 s, virus 34 → 13 s, split 20 → 10 s,
      error growth 4 → 2 s
- [x] Live caps grow with the wave: sentries 1 → 5 every 9 waves, worms 1 → 2 at wave 23, viruses 4 → 10,
      error blocks 4 → 14. Virus clusters start at 2 and reach 4 at wave 34
- [x] Sentry silhouette mix is gated by wave; the bench/practice path still exercises all four silhouettes
- [x] A new wave still does not reset every timer; there is no synchronized threat dump

### Verification
- [x] 430 s headless probe: first threat at 9 s; wave 3 worm; wave 6 virus cluster; wave 9 triplex; wave 12
      error colony. Counts stayed under the wave caps throughout
- [x] 121-wave headless probe: caps grew to 2 worms, 9 live viruses, 5 sentries and 14 error blocks with no
      runaway spawn
- [x] One-life probe: damage set `gauntletOver`, froze `gauntletTime` and stopped stepping; internal
      practice still returned max caps (5/2/10/14)
- [x] `npm run bench`: gauntlet max **0.126 ms** avg / **0.460 ms** p99 with **26.3** live threats; 8P bot
      swarm 0.070 / 0.405 ms
- [x] Browser: setup shows `RUN // ONE LIFE`, `BEGIN RUN`, no practice line; after 18 s wave 1 had one pulse
      sentry and no worms, viruses or errors; a forced ring break opened `WAVE 1 // 0:25`, wrote one record
      and reset cleanly

---

## v0.1.16 — Program roster, select screen and silhouettes (2026-10-29)

### Roster
- [x] `PROGRAMS` data plus a program select stage before every solo session; persistence in
      `localStorage` and a card grid with procedural portraits
- [x] Probe keeps the five-shot burst, charged piercing beam and proximity mine; the mine now arms on a
      short fuse and detonates on proximity or contact
- [x] Wedge: three-shot string, bracket dodge that damages and recoils, charge plow with side shoves and
      shot deflection, rear-bracket bug
- [x] Fisher: piercing spear that pins, freeform drawn net that reflects shots and holds bodies, lure
      beacon that pulls aggro

### Identity
- [x] Offline avatars take their program accent and core glyph: Probe cyan `◎`, Wedge amber `▣`, Fisher
      indigo `≈`. Networked matches stay on slot identity until programs travel in the snapshot
- [x] Health outlines are program silhouettes, not one shared circle: ring, diamond and hex, each still
      three segments with real gaps and the slow rotation
- [x] Bots and remote players draw no health outline, heading arrow, energy arc or readiness dock; their
      cores stay stable. Worm and drone health pips are removed for now
- [x] Lost health segments stay as 0.42-alpha ghosts instead of gaps, keeping the local silhouette whole
- [x] Dead avatars leave no dashed ring/X marker on the field; the death burst and respawn timer carry
      the state
- [x] Wedge's core glyph is `▣`; the old triangle read as a facing/firing pointer
- [x] Program select portraits use the same hull and glyph as the arena
- [x] Player and bot avatars are **10% larger** (`PLAYER.radius` 20 → 22); hull, core glyph, collision,
      lock reticle and bot nav clearance all follow the shared radius
- [x] `MAINFRAME` spawn 3 moved from inside a southeast bar to `(2440,1240)`, the clear mirror of spawn 2;
      all 40 spawn points across the five arenas clear a 22-unit avatar
- [x] Local readiness marks (ammo, dash, skill, power, pickup) sit in one compact **top-left dock**,
      out of the avatar/enemy space: dark panel, five icon cells, cooldown rings, no labels, hidden while
      dead
- [x] Program marks may be a single glyph, a text combo or multi-line ASCII art; `drawSymbol` strips
      common indentation and blank padding and scales the picture to one glyph's footprint in the core and
      the select portrait
- [x] Core marks carry a per-program scale (Probe 1.12, Wedge 0.88, Fisher 1.10) and keep at least 0.78
      scale at low health; the Wedge plate clears the diamond's bright inner edge at 3 hp and 1 hp
- [x] Guard visual is one clean crescent: the radial fan and the 0.2-alpha cooldown ghost arc are removed
- [x] Fisher's lure mark is an open two-arc pulse instead of a ring plus dot, so the readiness dock
      cannot be mistaken for Probe's `◎`; Wedge's bracket skill and plate heavy use different marks
- [x] Player-facing action names are plain: RANGED ATTACK, MELEE ATTACK, GUARD, POWER ATTACK, SKILL;
      settings controls/kit list and README match, and stale practice copy was removed
- [x] Lock cycling while `LT` is held: `RB` steps forward, right-stick left/right steps backward or
      forward, in angular order with the same range and line-of-sight filter; no re-acquire delay
- [x] Sparring drone stays suppressed in bot training instead of respawning as a phantom target
- [x] Enemy fire slowed: sentry pulses 430→365, triplex 380→320, flock 340→290, missiles 150→130,
      drone 520→450; AI player kits (training bots, local bot matches, thralls) use 0.8× (860→688)
- [x] Bot lead and engagement range follow the slowed bolt speed: 0.8× lead (860→688 effective) and SIEGE
      closes from 355 to its real ~310 reach instead of holding outside it and wasting shots
- [x] Top-level console options drop the `01`/`02`/`03` prefixes; only the `>` cursor marks the selection

### Verification
- [x] `scripts/.tmp-programs.ts`: 19 kit checks passed (three-shard string, bracket dodge recoil, charge
      plow damage and shot shove, spear pierce, net reflect/pin, lure)
- [x] `scripts/.tmp-lockcycle.ts`: 10 checks passed — acquire, forward/backward step, wrap, range
      exclusion, lock gating, drone suppression, sentry cycling
- [x] Browser with an injected virtual pad: `LT` + `RB` and `LT` + right-stick flick both stepped the
      lock between targets
- [x] Browser settings/controls: new action names render without overflow; kit list explains tap and hold
- [x] Browser 1v3 training: four active players, no drone, practice phase runs without runtime errors
- [x] Browser solo training at 1 hp: ghost-segment path rendered for 0.6 s without errors
- [x] `scripts/.tmp-enemyspeed.ts`: 10 checks passed — AI kits fire at 688 u/s, humans and online guests
      stay at 860
- [x] `npm run build` clean; TypeScript clean
- [x] Browser at v0.1.16: program select renders all three cards, Wedge starts training, world reports
      `program: 1`, and the loop runs without console errors
- [x] Browser top-left readiness dock on Probe, Wedge and Fisher: five dots / three dots / one dot, two
      dash chevrons, the program skill mark and heavy mark, in five separate cells; Fisher's `(·)` lure
      mark no longer resembles Probe's `◎`
- [x] Browser ASCII check: a temporary two-line bulldozer picture (``o|`|o:(``) rendered centered in the
      Fisher select card and the in-world core, then was reverted to `≈`
- [x] Browser health check at 2 hp: the lost segment draws at 0.42 alpha and the local silhouette stays
      readable instead of opening a hole
- [x] Browser `GRID ZERO`, no bots: Probe, Wedge and Fisher captured at 3 hp and 1 hp; every core mark
      clears its program hull, and the Wedge plate is the tightest case
- [x] Headless digital bot vs a moving local: 30 s, 24 damage / 8 downs in 1v1; 1v3 DUELIST/TRICKSTER/SIEGE
      fired 23/37/34 shots and dealt 15 damage / 5 downs
- [x] Browser bot match after the bot lead/range fix: local 3→0 hp, `roundover`; no console errors
- [x] Forced guard frame (`guardT = 1`) and cooldown frame (`guardCd = 0.25`): clean shield crescent, no
      radial spokes or cooldown ghost arc
- [x] Browser forced-dead local avatar and bot in training: no corpse ring/X renders; only the death burst
      and respawn timer remain
- [x] Spawn-clearance check at radius 22: 0 overlaps across the five arenas; one pre-existing MAINFRAME
      overlap was fixed
- [x] Browser `GRID ZERO` 1v3 as Wedge: local hull, program core and Probe bot cores render at the larger
      radius, and the top-left dock stays clear of the hull and heading arrow
- [x] `npm run bench`: 8P max 0.033 / 0.090 ms, bot swarm 0.038 / 0.169 ms, gauntlet max 0.150 / 0.562 ms
      with 27.3 live threats

---

## v0.1.15 — Opening density, lock coverage and lash sweep (2026-10-29)

### Gauntlet opening
- [x] The first pack is two pulse squares through wave 3, placed inside the camera window instead of at a
      fixed radius that could land behind the camera. Opening pack interval is 24 s, then normal 30 s
- [x] Opening silhouettes hold their first shot for 5.5–7.5 s and cycle at 2.4× the normal cadence until
      the heavier families unlock

### Lock and damage rules
- [x] Target lock now acquires sentries and cascading-error blocks; their reticles render with the same
      translucent-to-solid acquisition state as worms and viruses
- [x] A projectile can never damage the player who fired it, including after a wall bounce arms it; mines
      were already owner-safe

### Melee and minimap
- [x] Quick `B` is a straight spiked lash that sweeps left/right across the 180° arc. It has no shield
      fill, no third-tap forward wave, and shoves players and hostiles sideways in the sweep direction
- [x] Whiff recovery 0.18 → 0.12 s so quick presses string together
- [x] Minimap is 148 px wide, 12 px from the lower-left edges, and draws sentries, error blocks, firewalls,
      the training drone, worms, viruses and pickups

### Verification
- [x] Headless: lock acquired sentry (`5`) and error (`6`); opening pack had two sentries at 12 s; an armed
      bounced own bolt left the owner at 3 hp; sweep directions were `1,-1,1` with `waveT` 0; a rightward
      sweep shoved a target on +y and removed one hp
- [x] `npm run build` clean: 330.76 kB JS (95.61 kB gzip), 37.33 kB CSS (8.45 kB gzip)
- [x] Browser on `MAINFRAME`: two pulse squares were visible by 10 s, the minimap sat against the
      lower-left edge, and its threat dots read at the smaller size

---

## v0.1.17 — Couch-scale console menus (2026-10-29)

### Scale
- [x] Main console options are `clamp(19px, 1.55vw, 30px)` in `clamp(48px, 4.2vw, 62px)` rows; the ASCII
      logo grows to 28px at 1080p; the `>` cursor and left focus bar are both visible
- [x] Stage labels, notes and status lines 18–21px at 1080p; option keys 17px; program/arena card labels
      15–20px; gauntlet record rows 13–18px
- [x] Settings tabs, controls rows, kit list, setting rows and buttons scale to 17–21px; settings content
      is `min(1400px, 100% - 96px)` wide so the controls page fits one 1080p screen
- [x] Lobby header, player rows, room stats and hints enlarged; pause/run-over overlay copy and buttons
      enlarged (760px card, 21px sub-copy)
- [x] Fixed the later console theme's stale `.btn` 9px rule and 7px tags, which were overriding the new
      lobby/overlay button scale
- [x] Sector blueprint map is capped at `min(50vh, 540px)` and keeps 16:9, so it no longer runs far below
      the fold on a TV
- [x] Short-viewport guard (`max-height: 780px`) compacts the title stage for 720p without shrinking type
      back to desktop size; `justify-content: safe center` prevents top clipping when a stage overflows
- [x] Controller navigation scrolls the focused control into view; a stage change scrolls the menu back to
      the top
- [x] Pause and result overlays focus their first action on open, so `A` works without nudging the stick;
      buttons and settings tabs use a 2px cyan focus ring instead of the browser's orange default
- [x] Version 0.1.17; service-worker cache bumped

### Wedge hull
- [x] Wedge's three health segments are matching corner brackets at three vertices instead of equal
      perimeter slices; each arm is 34% of a side, so a segment reads as a corner, not a cut side
- [x] The square's fourth corner gets a short frame-weight tab and the whole hull gets a thin rim
      (`pathProgramFrame`), so the silhouette stays closed at full health; neither counts as a health segment
- [x] The frame pass is four-sided only; Probe's ring and Fisher's hex keep their current segmentation

### Verification
- [x] Browser at 1280×720: title, program select, session, arena grid, bot count, tier, gauntlet setup,
      lobby and sector blueprint all fit; no horizontal overflow
- [x] Browser at 1920×1080: title hierarchy reads at 30px options; settings controls page fits one screen;
      feedback page fits with the preview panel
- [x] Browser: keyboard Enter through the staged solo flow lands focus on the next stage's primary option,
      and the pause overlay buttons render at the new size
- [x] Browser Wedge select portrait and in-game avatar at 3 hp: three bright corner brackets plus the thin
      fourth-corner tab and rim; no mid-side cut pieces. Probe and Fisher portraits are unchanged
- [x] `npx tsc --noEmit` and `npm run build` clean: 363.14 kB JS / 103.57 kB gzip, 40.44 kB CSS / 9.10 kB
      gzip

### Next
- [ ] Physical controller pass on an actual TV: reading distance for the 15–17px secondary text and whether
      the settings tabs need a visible d-pad hint
- [ ] Audio/feedback sliders are not gamepad-adjustable yet (range inputs are outside `navItems()`)

---

## v0.1.18 — Wedge wall, bot lures, solo sectors (2026-10-29)

### Kits
- [x] Wedge's skill is a static wall, not a shove: a bracket segment one body-length behind him, solid to
      bodies and shots, 4.6 s life, 9 s cooldown, 92 units wide with a 12-unit core
- [x] A wall that would land in cover or outside the playfield is refused and the energy is handed back
- [x] Dodge still phases through it; the bracket arms point at their owner so the open side reads, and the
      end caps blink for the last 0.8 s
- [x] Wedge's dodge bash is unchanged; the shared `bashKind` switch was removed with the old rear push
- [x] A live lure now outranks a distant player for local bots inside `FISHER.lureRadius`, so training
      bots walk to it and shoot it

### Sectors
- [x] `SINGLE PLAYER > SECTORS` opens the campaign blueprint with a companion row: NO HELP / 1 / 2 / 3
      bots, persisted in `deflect.campaignBots` and shown as the run setup
- [x] Back returns to the stage the archive was opened from; multiplayer hides the companion row
- [x] Blueprint canvases share one plot frame and one type scale: node positions are fitted to the frame,
      labels 15px, subs 11px, header 12px, and the backing store follows the CSS box at DPR (`fitCanvas`)
- [x] `src/game/road.ts` draws the five-system route plate (device silhouettes, crossings, ROOT) for the
      between-level transition; it is not mounted in a menu
- [x] Program glyphs accept Unicode dingbats/wingdings and are measured against a symbol font stack, so a
      wide mark scales down instead of crossing the health hull

### Verification
- [x] Headless probe: Wedge's bracket shove slides a body 355 units before it settles (the old 1040
      knockback moved it ~148) and the charge plow 378; the slide eases out over ~60 ticks and dusts
- [x] Headless probe: a drawn S-curve web stores 23 points, rounds the bend and keeps its 90 degree
      hinge; a body parked on it reports `netPinT` for 60 straight ticks with 0.00 drift and is released
      once `netLife` expires
- [x] Browser at 127.0.0.1:5173: an injected 26-point web renders as a smooth curved ribbon with a firm
      elbow; a shove slides the avatar and leaves grey square puffs behind it; the training drone held by
      a web drifts 0.97 units over 0.7 s with `netPinT` refreshing at 0.12
- [x] Headless probe: the wall deploys 58 units behind Wedge with a 92-unit span; a body walking into it
      stops at the wall face (x 640 -> 610); a bolt at 800 u/s reflects off it (vx -800 -> +800, one
      bounce)
- [x] Headless probe: `nearestLureIndex` finds a beacon within 300 units and a digital brain's steering
      flips toward it (mx -0.10) instead of the distant player (mx +0.76) once the lure is gone
- [x] Browser 1920×1080: solo SECTORS shows the companion row, 2 BOTS survives a reload, ESC returns to
      SINGLE PLAYER; the multiplayer archive hides the row and ESC returns to MULTIPLAYER
- [x] `npx tsc --noEmit` and `npm run build` clean

### Next
- [ ] Playtest whether a 6 s hold is too long now that the web deals no damage; tune `FISHER.netLife`
      and `netCost` together rather than adding damage back
- [ ] Mount the route plate on the between-level transition and fade it with the assembly intro
- [ ] Decide whether a wall should block gauntlet threats (worms, viruses, sentries) as well as bodies and
      shots, and whether networked guests should see another player's wall
- [ ] Give the first playable sector a loader so the solo companion choice can actually spawn bots

---

## v0.1.27 — SWEEP.EXE and the test build label (2026-10-29)

### SWEEP.EXE
- [x] `SWEEP.EXE` is in `PROGRAMS` (id 3, role `SHOVE`) with a lime accent from `identity.ts`
- [x] Identity: eight-sided hull (three equal perimeter segments read cleanly), `✦` clean core mark at
      `coreScale 1.06`, and a broom-fan portrait accent. Checked at full and one-segment health; the mark
      clears the hull. The only literal Unicode broom is a colour emoji, so the core says "clean" and the
      kit carries the broom
- [x] `drawSymbol` supports wide multi-line marks with a larger `glyphRadius` footprint, tighter rows and
      a narrower width budget; built for Sweep, available to future ASCII programs
- [x] Melee: three-hit broom combo, diagonal pushes then a big forward hit, facing locked, third hit
      reflects along the full 96-unit shaft
- [x] Ranged: dust-trailing broom projectile (type 6), 2 damage and a hard push
- [x] Power: giant broom built line by line, then swept across the facing band; each body hit once
- [x] Skill: two brooms split outward, shoving bodies and hostiles out of the lane
- [x] Bots use the kit: the generic heavy hold builds the sweep and a dedicated branch taps the split
      brooms at 50–210 units
- [x] Test builds are labelled `IN TESTING` on the title hub next to the version number

### Verification
- [x] Headless probe: ranged type 6 does 2 damage and kx +860; the melee combo reports kinds 1, 2, 3 and
      damages 1, 1, 2 with diagonal then forward shoves; the power fires and does 2 damage with kx +570;
      the skill hit does 1 and shoves the target out along the tangent; a Sweep bot fires type 6
- [x] Browser 1920×1080: program card, full-health and one-segment core clearance, broom swing, giant
      sweep, split brooms and broom projectile all render; no console errors
- [x] `?autoplay=2` on CROSSROADS: a Sweep bot in slot 0 used the split brooms (`fanT 0.39`) and fired
      broom projectiles through round 6 with no errors
- [x] Gauntlet stress: 110 s of practice with the Sweep kit reached wave 4, 15 kills, both heavy and
      skill fired, threats existed and took damage, no exceptions
- [x] `npx tsc --noEmit`, `npm run build`, and `npm run bench` clean

### Next
- [ ] Decide whether Sweep (and the other kits) should be playable online; that needs a snapshot/protocol
      change rather than a renderer branch
- [ ] Playtest the third-hit reach/damage and the power band; tune `SWEEP.bigReach`, `powerBand` and
      `SWEEP.powerKnockback` together
- [ ] If a true monochrome broom is wanted at the core, draw it as vector paths instead of text
- [ ] Re-measure the snapshot once kits are carried; `Snapshot` is untouched by this pass

---

## v0.1.25 — Bot skill pass and solo training (2026-10-29)

### Bots
- [x] Wedge bots answer a long incoming bolt by turning away from it and planting the wall between the
      threat and themselves; the old close-range random tap put the wall behind him facing the target
- [x] Wedge bots also close a lane while reloading or at one health, then leave through it
- [x] Fisher bots drop the lure at 160–280 units and step away, so the decoy has room to pull a chaser
- [x] Bots ignore their own lure; `nearestLureIndex` takes an optional owner to skip
- [x] Training and VS BOTS keep separate difficulty preferences, with the old shared tier key migrated

### Solo training
- [x] `TRAINING` exposes `NO BOTS` alongside `1 V 1`–`1 V 3`; versus matches keep one to three opponents
- [x] `NO BOTS` starts a one-player room and restores the sparring drone

### Verification
- [x] Browser: TRAINING shows `NO BOTS / 1 V 1 / 1 V 2 / 1 V 3`; VS BOTS shows only the three versus
      choices after switching modes in the same session
- [x] Browser: `NO BOTS` → EASY starts with one active player, zero brains and a live drone (hp 4)
- [x] Browser: training EASY → VS BOTS HARD → training EASY persisted as
      `deflect.botTier.training = rookie` / `deflect.botTier.bots = digital`
- [x] Browser `?autoplay=2`: a Fisher bot's lure went live (4.2 s life) and a Wedge bot's wall went live
      (4.6 s life) on CROSSROADS; the Fisher brain kept targeting its opponent, not its own beacon
- [x] `npx tsc --noEmit` and `npm run build` clean; bench rerun recorded in HISTORY

### Next
- [ ] Tune how often the new wall/lure branches fire after a live match; they are deterministic now but
      not yet paced by playtest
- [ ] Tune `IMPOSSIBLE` now that it is selectable, then decide whether VS BOTS should expose 4–7 bots

---

## v0.1.24 — Bot players and unattended self-play (2026-10-29)

### Bots
- [x] `SINGLE PLAYER > VS BOTS` runs the existing `BotBrain` through the real match flow: program →
      arena → bot count (`1 V 1` to `1 V 3`) → difficulty → countdown, rounds, first to 3
- [x] Bots occupy ordinary player slots and write `InputFrame`s; they have no world mutation and never
      enter a network snapshot
- [x] `World` takes a `botPrograms` slot list. Bots take the programs the human leaves unused, so a
      Wedge pick can face Probe and Fisher instead of three Probes; training bots use the same rule
- [x] Online opponents still default to Probe until the protocol carries programs
- [x] `BotBrain` scales engagement range by program (Wedge closes, Fisher holds farther) and commits to
      program heavies by holding the power button on a cooldown
- [x] `heavyCount` on each brain is QA telemetry for checking that heavies are actually used
- [x] `?autoplay=N` starts a VS BOTS match with AI in every slot, including slot 0, and auto-rematches at
      match end so an unattended run keeps exercising rounds
- [x] Training stays endless and separate from the round flow; only VS BOTS uses match rules

### Verification
- [x] Menu: TRAINING / VS BOTS / GAUNTLET / CAMPAIGN; VS BOTS program stage reads `VS BOTS // PROGRAM
      SELECT`, arena stage carries the program name, and the tier starts a match instead of training
- [x] Wedge local vs two HARD bots: bots took programs Probe and Fisher, moved, fired, won a round, and
      took a segment off the idle local player (`hp 3 → 2`)
- [x] `?autoplay=2`: three brains (slots 0–2), slot 0 won round 1, and the match advanced to round 2
- [x] Forced `matchend` while autoplaying: the match overlay cleared and a fresh round 1 started, so the
      unattended loop does not park
- [x] Heavy probe: all three brains reported `heavyCount 1` after roughly 15 s and a Probe beam was live
      (`laserT 0.3`) without console errors
- [x] `npx tsc --noEmit` and `npm run build` clean

### Next
- [ ] Wire campaign companions to the same brains so the bot count chosen in a new campaign run actually
      spawns

---

## v0.1.23 — How to Play, campaign naming, menu trim (2026-10-29)

### How to Play
- [x] `HOW TO PLAY` is a top-level title option, between `MULTIPLAYER` and `SETTINGS`
- [x] It detects connected gamepads and swaps between a gamepad table and a keyboard/mouse table;
      the detected pad name sits in the panel header
- [x] A short rules section covers move-to-aim, deflect, dash and the three-segment health outline
- [x] The program roster is generated from `PROGRAMS`, so new programs appear without a second list
- [x] Six clip tiles (`RANGED ATTACK`, `MELEE ATTACK`, `GUARD`, `POWER ATTACK`, `SKILL`, `DASH`) are
      dashed placeholders reading `CLIP SOON` until recorded gameplay clips exist
- [ ] Record a short loop per action and mount each one in its clip tile; keep the table fallback when
      a clip cannot autoplay
- [ ] Decide whether How to Play stays one scroll or gains mode tabs once clips land

### Menu trim
- [x] Controls and kit explanations moved out of `SETTINGS`; the settings tabs are now `FEEDBACK`,
      `AUDIO`, `SYSTEM`
- [x] The settings footer paragraphs were removed
- [x] Instructional notes were removed from the solo, program, gauntlet, campaign, bot count, tier and
      local stages; stage labels and options carry the context
- [x] The unreachable route-blueprint stage (`menu-sectors`, `renderSectorArchive`) was deleted; the
      blueprint stays parked per D13
- [x] Console options are 32px on ~72px rows, choices 24px on 54px rows, with a compact 50px row in the
      short-viewport guard
- [x] A stage opens with nothing highlighted. The first d-pad/arrow input lands on the first real option,
      not `BACK`; Enter/Space activate the current or preferred option without a focused button
- [x] Hover feedback waits for a real pointer move (`body.pointer-live`), so a stage appearing under a
      resting cursor does not look preselected; card grids keep a distinct `nav-focus` ring

### Campaign naming and difficulty
- [x] `SECTORS` is `CAMPAIGN` in every player-facing menu and in the README; `SECTORS.md` became
      [CAMPAIGN.md](CAMPAIGN.md). `src/game/sectors.ts` and the five sector records stay internal
- [x] Difficulty labels are `EASY`, `MEDIUM`, `HARD`, with `IMPOSSIBLE` reserved as the ceiling, stacked
      vertically from easiest to hardest
- [x] `IMPOSSIBLE` is a real fourth tuning row (20 ms reaction, zero aim error, short fire cadence,
      maximum dodge); tune it after a playtest before treating the numbers as final

### Sweep.exe
- [x] Built in v0.1.27; the checklist, verification and follow-ups live in that section

### Verification
- [x] `HOW TO PLAY` at 1500×844: keyboard layout by default; injected pad layout after a fake
      `navigator.getGamepads` entry; program cards and clip tiles render, page scrolls to CLIPS
- [x] Hub and solo stage at 1280×720: four hub options and three mode options fit at the larger scale;
      no option highlighted on stage entry
- [x] Arrow key then Enter walks the menu with no focused button; first arrow lands on the mode option,
      program select lands on the selected program
- [x] Campaign flow: `CAMPAIGN` slots read `CINEVAULT // LV 4` with `2 PLAYERS`; new slot → bots →
      program select → back to slots with the new-run summary
- [x] Settings opens on `FEEDBACK` with only three tabs and no footer paragraphs
- [x] Training starts from `EASY` and reaches the arena without console errors
- [x] `npx tsc --noEmit` and `npm run build` clean

---

## v0.1.22 — Campaign slots first (2026-10-29)

### Campaign
- [x] `SECTORS` opens the three save slots directly. An empty slot reads `START NEW GAME`; a filled slot
      reads `<SECTOR> // LV <n>` with `<n> PLAYERS` on the right
- [x] Empty slot → bot count → player select; a filled slot is a resume and skips both steps
- [x] Bot counts are `NO BOTS` / 1 / 2 / 3, persisted, and the stage states that bots take the programs
      the players leave unused
- [x] Player select follows the bot count with the label `SECTORS // PLAYER SELECT`; back returns to the
      bot count, then the slots
- [x] Finishing player select reports the new-game summary (`SLOT n // NEW GAME // PROGRAM + BOTS // NOT
      WIRED YET`) on the slot stage instead of starting a run; a filled-slot press reports resume-not-wired
- [x] `StorySave` now stores `players` and `bots`; parsing still accepts a missing field defensively
- [x] The blueprint row was removed from the campaign stage. `menu-sectors` and `renderSectorArchive` are
      parked and currently unreachable; decide where the review archive belongs before sectors are built
- [ ] Wire NEW GAME: write the slot with players, bots and the picked program, then load the first node
- [ ] Wire RESUME: restore program, sector, node, players and bots and skip the setup steps
- [ ] Assign bot programs from the unused roster once local player slots exist
- [ ] Write the save after every completed level, then define the death rule

### Verification
- [x] Browser 1600×900: SECTORS shows three `START NEW GAME` slots; slot 1 opens the bot stage, a bot
      count opens player select, a program returns to the slots with the new-game summary; Esc walks
      player select → bots → slots → gameplay mode
- [x] Seeded slot: reads `CINEVAULT // LV 4` and `2 PLAYERS`, and its press reports resume-not-wired; the
      seeded key was removed afterwards
- [x] `npx tsc --noEmit` and `npm run build` clean

---

## v0.1.21 — Multiplayer menu, hub-only logo (2026-10-29)

### Multiplayer
- [x] The mode screen is exactly `ONLINE` and `LOCAL`; the separate campaign row is gone
- [x] `ONLINE` holds `HOST GAME` and the room-code field with `JOIN GAME`, matching the host/join pair
- [x] `LOCAL` lists `ARENA` and `GAUNTLET`; pressing either reports that local play is not wired yet
- [x] Public games are planned as an opt-in prefix on the 4-character code; private rooms keep an
      unprefixed code and stay unlisted (no search UI yet)
- [x] The DEFLECT logo header is hidden on every sub-stage and returns on the hub
- [~] The campaign blueprint was briefly a row on the story stage; v0.1.22 removed it while the save-slot
      flow is built

### Verification
- [x] Browser 1600×900: hub is SINGLE PLAYER / MULTIPLAYER / SETTINGS; MULTIPLAYER is ONLINE / LOCAL;
      ONLINE shows HOST GAME and JOIN GAME; LOCAL shows ARENA / GAUNTLET and a not-wired status on press
- [x] Browser: logo header computes `none` on multiplayer, online and story stages, `block` back on the hub
- [x] Browser: the story stage fits its slots and placeholder line after the header is hidden
- [x] `npx tsc --noEmit` and `npm run build` clean

---

## v0.1.20 — Solo flow reorder and story saves (2026-10-29)

### Flow
- [x] Solo order is now mode → program → that mode's setup, so the mode stage no longer waits behind
      character select
- [x] `TRAINING`: mode → program → arena → bot count → tier
- [x] `GAUNTLET`: mode → program → arena → run setup
- [x] `SECTORS`: mode → program → story setup
- [x] Stage labels follow the chosen mode (`TRAINING // PROGRAM SELECT`, `GAUNTLET // PROGRAM SELECT`,
      `SECTORS // PROGRAM SELECT`); back walks the same chain in reverse
- [x] The blueprint archive is multiplayer-only again; it lost the solo origin, its companion row and
      the `SINGLE-PLAYER CAMPAIGN` label, and back returns to the Multiplayer stage

### Story saves
- [x] `src/game/saves.ts`: three local slots, versioned record (program, sector, node, level, companions,
      play seconds, timestamp), defensive load, `saveStoryProgress` for the after-level write and
      `clearStorySlot`
- [x] Story stage lists the three slots: empty reads `NEW GAME`, filled reads the sector name and
      `<PROGRAM> // CONTINUE`; the companion row lives here rather than in the archive
- [x] Pressing a slot reports that new game/resume is not wired yet instead of starting a fake run
- [ ] Wire NEW GAME: create the slot and load the first sector node with the picked program and companions
- [ ] Wire CONTINUE: restore the slot's program, sector and node, and skip the menu program pick on resume
- [ ] Write the save at the end of every completed level (`saveStoryProgress`), then define the death rule
      (last level or last sector checkpoint)
- [ ] Slot management: overwrite/delete confirmation and a visible last-played timestamp
- [ ] Decide whether a resume that picks a different program is refused or rewrites the slot

### Verification
- [x] Browser: SINGLE PLAYER → SECTORS → program reaches the story stage; three empty slots; clicking one
      shows the not-wired status; Esc walks story → program → mode → hub
- [x] Browser: TRAINING and GAUNTLET both reach the arena stage with the correct mode label and return to
      program select
- [x] Browser: the hub is SINGLE PLAYER / MULTIPLAYER / SETTINGS; MULTIPLAYER is exactly ONLINE and
      LOCAL; ONLINE holds HOST GAME plus the code field and JOIN GAME; LOCAL lists ARENA and GAUNTLET and
      reports not-wired on press; Esc returns to the multiplayer mode screen from each
- [x] Browser: `SECTORS > ROUTE BLUEPRINT` opens the blueprint from the story stage and Esc returns to
      the story stage
- [x] Seeded-slot probe: an entry renders `CINEVAULT // WEDGE.EXE // CONTINUE` and its press reports
      resume-not-wired; the test key was removed afterwards
- [x] `npx tsc --noEmit` and `npm run build` clean

---

## Local multiplayer (scaffolded 2026-10-29)

Placeholder only. `LOCAL MULTIPLAYER` is a title entry that opens a read-only setup stage; there is no
mode, no second `InputFrame`, no local slot bookkeeping and no camera work yet. The notes below are the
build order, not a design that has been approved.

### Setup stage
- [x] `MULTIPLAYER > LOCAL` entry with an `ARENA` / `GAUNTLET` mode list; both report that they are not
      wired yet, and the stage states the intent (one screen, one input per player, bots fill empty slots)
- [ ] Replace the placeholder with a real setup: player slots, per-slot input device, per-slot program
- [ ] `MANUAL ADD PLAYER` row: prompts for a detected device and binds it to the next free slot
- [ ] Per-slot program pick, reusing the `PROGRAMS` select grid (it has to grow with the roster)
- [ ] Reuse the solo arena grid; gauntlet keeps its run setup and its local top-runs table
- [ ] Bots fill empty slots on both modes, tier chosen per slot or one tier for the room

### Input devices
- [ ] Auto-claim: a newly connected pad takes the next free slot and shows a join toast
- [ ] Manual add path for a pad the game ignored or one that was already claimed
- [ ] One keyboard/mouse device option, so a pad and the keys can play together
- [ ] Device labels come from the Gamepad API (`index`, `mapping`, `id`), not a hard-coded list
- [ ] Disconnect and rebind while paused without resetting the run
- [ ] Keep online and local device code separate: online guests still send one `InputFrame` per room
      slot, local slots never enter `Snapshot`

### Simulation and view
- [ ] Feed `World.step` one `InputFrame` per local slot from its own device; keep `localSlot` per
      player so each viewport draws its own outline, energy and readiness dock
- [ ] Decide one shared pause/overlay model; no per-player menus
- [ ] Prototype **dynamic zoom** first: camera fits every live local player, clamped to the arena; it is
      cheaper than a second viewport and keeps one HUD
- [ ] Build **split screen** only if zoom gets too distant on `MAINFRAME`; each view keeps 16:9
      letterboxing, its own HUD and the minimap rule
- [ ] Decide the player cap from hardware and view readability before writing slot limits
- [ ] Arena mode: last-standing rounds as in PvP, but first-to-3 scoring across local players
- [ ] Gauntlet: shared waves; decide shared score versus per-player columns before the results screen

### Verification
- [ ] Two pads plus the keyboard claim three slots and each moves only its own avatar
- [ ] Unplugging a pad mid-run pauses and rebinds without resetting the round
- [ ] Dynamic zoom keeps every live avatar on screen on each arena, including `MAINFRAME`
- [ ] Split screen (if built) keeps readable type and HUD at couch distance
- [ ] Local sessions never allocate room slots or send packets

---

## Performance (measured 2026-10-29)

Machine: current dev laptop, Node 20 headless bench and Chromium for the browser run.

| Scenario | Sim ms/tick avg / p99 | Render | Notes |
| --- | --- | --- | --- |
| 2P duel, 0.6 live projectiles | 0.027 / 0.105 | 60 fps | v0.1.27 bench |
| 4P brawl, 1.6 live projectiles | 0.040 / 0.141 | — | v0.1.27 bench |
| 8P stress, 7.0 live projectiles | 0.059 / 0.174 | 60 fps | v0.1.27 bench + `?stress=8` |
| 8P max projectiles, 25.8 live avg | 0.095 / 0.261 | 60 fps | v0.1.27 bench; mine/trap feed |
| 8P idle | 0.015 / 0.033 | — | floor case |
| 8P bot swarm (AI + sim) | 0.096 / 0.325 | — | three styles, digital, pathfinding |
| Gauntlet max threats (2W/10V/2F + 14E + sentries + thrall) | 0.215 / 0.697 | 60 fps | v0.1.27 bench, 27.3 live threats |

Two v0.1.27 runs varied by roughly 0.01–0.03 ms on the light cases and 0.08 ms on the gauntlet; all
remain far under the 4 ms budget. A Sweep bot match and a 110 s Sweep gauntlet stress ran without a
measurable frame drop.

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
- [ ] Public game discovery: search PeerJS for room ids carrying a shared public prefix; private rooms
      keep an unprefixed 4-character code and stay unlisted
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

## Arena traversal — bridges, pads and lifts (built 2026-10-29)

The continuous-arena model is now implemented. `ArenaDef.traverse` carries chasms, bridge decks, upper
deck treatment, paired pads and linked lift plates; `TRANSIT` mixes all three. Bodies collide with
`arenaSolids()` (cover plus chasms), while shots and lasers still use `pillars` and cross a trench.
Campaign node transitions remain future work; this pass proves the geometry, the sim rules and the read.

### Built
- [x] Continuous arena model: a bridge is arena geometry, not a separate scene; the follow camera already
      handles the wider bounds. No geometry or traversal state enters `Snapshot`
- [x] `TRANSIT`: two decks over a split trench, one central bridge, paired pads on the west and a two-stop
      lift on the east
- [x] Chasms block bodies, drones, worms, viruses, sentries and placement checks; shots, lasers and
      firewall beams cross them. A dodge still phases solids, so a charged dash can cross the gap
- [x] Bots use a 20 u grid built from `arenaSolids()` and force a route when the straight walk crosses a
      gap, so a clean firing line no longer walks them into the trench lip
- [x] Paired pads arm on a still body (0.32 s dwell), lock input, cancel attacks and ignore damage for the
      ride, and stay latched after arrival until the body steps off
- [x] Pad transit unloads the avatar's hull, core and glyph in order at the source, swaps at the midpoint,
      then rebuilds them at the mate. Ride time is 0.36 s, down from the first 0.5 s pass
- [x] Lift plates arm on a 0.55 s stand and ride for 1.55 s under a shrinking-deck screen transition
- [x] Headless checks: trench blocks a walk, bridge crosses, pad dwell/ride/latch, lift ride, moving body
      ignores pads, A* route crosses only on the bridge, and a digital bot walks itself across
- [x] Browser: TRANSIT selectable as the sixth arena; pad ride landed at the mate; lift ride landed on the
      upper plate; holding W crossed the bridge from the lower deck to the top wall; bot match and
      gauntlet spawned no threat inside the trench

### Next
- [ ] Party rule for pads and lifts: one rider moves everyone, or only the bodies standing on the plate.
      Decide alongside local multiplayer, not before
- [ ] Threat traversal: let worms, viruses and infected bodies follow a pad ride into the linked room,
      with a per-family cooldown and cap. The pad is the player's escape hatch, and the same unload window
      is what lets a chasing threat or a virus spill across after them. This is how viruses spread across
      campaign arenas; do not let a whole wave spill through one plate in a single ride
- [ ] Add travel state to the network snapshot or a dedicated packet so a guest sees the unload/reload and
      gets a clean camera cut instead of a prediction snap. Protocol change, so record it in `AGENTS.md`
- [ ] Campaign node loader: one node at a time, party state, host authority, and the bridge/pad/lift cut
      between nodes. Keep geometry out of `Snapshot` until networked PvE has its own decision
- [ ] Give a bridge gate a visible `CLOSED` state without adding a second collision system
- [ ] Decide whether a lift ever serves more than two plates (a floor selector), and how that reads
      without a menu
- [ ] Confirm 8 local players and bots cross all three links without clipping cover or dropping routes
- [ ] Use `TRANSIT` as the blockout reference for the campaign's first playable sector
- [ ] Re-measure the render cost of the new deck layers with `F3` on the 8P stress case

### Verification
- [x] A bridge, a pad and a lift work in a local test arena with a bot walk and a browser session
- [x] No traversal element writes geometry, programs or sector state into `Snapshot`
- [x] The lift and pad transitions are scale/opacity strokes only; no `shadowBlur`, filter or per-frame
      gradient
- [ ] 8-player local pass across all three links

## Threat family — magic users (placeholder 2026-10-29)

The designer is preparing reference images and descriptions for a new enemy family: "magic" users built
from a collection of simple shapes, with projectiles and effects that fit their silhouettes. This is a
content placeholder, not an approved kit. Do not invent the final shapes or attacks before the references
arrive.

### When the references arrive
- [ ] Turn each described enemy into a data record: silhouette primitives, accent, size, health, assembly
      timing and death shards
- [ ] Keep them inside the existing local threat pools and `GAUNTLET` mode; no networked PvE or PvP enemies
      until a separate protocol decision exists
- [ ] Give each magic user one readable projectile or zone grammar, distinct from sentry pulses, triplex
      shotguns, homing pods and flocks
- [ ] Decide which effects are render-only and which need simulation state; keep the hitbox separate from
      the visual flourish
- [ ] Add a wave gate and live cap so the family enters gradually instead of dumping a full pack
- [ ] Decide whether they also appear in campaign encounters, or stay gauntlet-only for the first pass

### Integration
- [ ] Reuse assembly/de-rezz, factional fire, cover line-of-sight and the existing projectile pool
- [ ] Add the family to the gauntlet max case and `npm run bench` before claiming its cost
- [ ] Keep every number in `config.ts` and every definition in data, not in a switch
- [ ] Do not leak entities, effects or projectiles into `Snapshot`

### Reference checklist for the designer
- [ ] One image or sketch per silhouette, with its name and role
- [ ] The projectiles or effects it should use, and whether they can be deflected, shot down or blocked by
      cover
- [ ] Relative size and threat tier; whether it summons, shields, heals or alters the arena
- [ ] Any sound or visual identity notes

## Later phases

- [ ] Networked bot slots for underfilled rooms (host-authoritative)
- [ ] Bot refinements: team tactics, arena-specific routes, smarter candle placement
- [~] PvE foundation: local worms, viruses, firewalls, infection and a thrall copy are in GAUNTLET;
      bosses, waves, progression and any networked PvE are still unbuilt
- [ ] Gauntlet tuning from designer play: spawn cadence, worm speed/growth, virus cap, firewall frequency,
      thrall aggression, and whether the local table should split by arena and run type
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
9. Gauntlet now records wave, time and kills for survival runs. Should the table split by arena and run
   type, or stay one global local table?
10. Thrall pressure: one at a time feels readable. Should infection stack multiple thralls at higher
    threat counts, or is a single relentless copy the right rule?
11. Random bug fairness: is a per-match roll readable when the icon only appears on the avatar, or does
    the lobby need to show both players' bugs before the match?
12. Three health with a 3-shot burst means a clean burst can delete a target. Is that the intended
    close-range risk/reward, or should the burst cost more energy or have a slightly longer recharge?

## Known limitations (v0.1.24)

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
  Bot lead/range currently use Probe's bolt speed; a future bot program with a different kit needs its own
  speed in `computeAim` and the engagement range.
- Arenas are static rectangles. Rails, destructibles and switches are not built. Kill-drop and ambient
  pickups exist only in local training/gauntlet; they are not in rooms or snapshots.
- 8P bot-swarm performance is bench-only; it is not a real eight-client network test.
- Gauntlet is local only. Enemies do not appear in multiplayer rooms, and the mode has no final win or
  progression. Run records are a local top-eight table, not an online leaderboard. Sentries hold zones but
  do not coordinate fire. Worms have territory steering, not pathfinding, so a patrol target on the far
  side of deep cover can pin one briefly. Powerup drops are random with no pity timer.
- The one-life curve is tuned from headless probes and an idle browser check, not a long real playtest.
  The first wave is intentionally sparse; the later silhouette mix and wave 50+ pressure still need feel
  testing.
- Thralls use simple close-range steering; they can lose time behind deep cover and do not coordinate with
  viruses or other thralls (only one thrall can exist at a time).
- Enemy fire ignores other sentries because projectiles do not carry a source silhouette. It does damage
  worms, viruses and error blocks.
- Firewalls are disabled until a destructible switch exists; their sweep and cover rules are still tested
  by the bench scenario but not reachable from normal gauntlet play.
- Physical controller and eight real WebRTC peers remain untested.
- No control rebinding; settings cover feedback and audio, not button mapping.
- Bug assignment is a host-side roll per match. It is visible as an avatar icon but is not previewed in
  the lobby, so a guest learns their bug when the match starts.
- Charged beam/sweep and random-bug snapshots add fields; snapshot bandwidth has not been remeasured
  since v0.1.2.
- `MAINFRAME` is large enough for a follow camera, but bot routing and 8-player matches on it have not had
  a dedicated playtest or bench scenario.
- Cascading errors exist only in gauntlet; they are not in PvP, rooms, or the bench's PvP scenarios.
- Gauntlet still has no bosses, sector transitions, or online score sync. The local table covers one
  callsign profile and does not separate runs by map.
- The sector campaign is a blueprint archive only. No node is playable as a sector, no bridge or lift is
  traversable, and sector data does not enter rooms, `World`, snapshots or the network. The node layouts
  reuse existing arenas as placeholders until the real map sketches are authored. The solo companion row
  saves a run setup that nothing consumes yet.
- Wedge's wall is local-only, like Fisher's web and lure: it never enters a snapshot, so a guest does not
  see another player's wall. It blocks player bodies and projectiles; gauntlet threats still walk through
  it, and bots path around the static grid, not around a deployed wall.
- Local multiplayer is a multiplayer-menu placeholder. No local slot, second input device, shared camera
  or local match exists yet; the only local multi-body paths today are bots and the gauntlet thrall.
- Story mode lists three local save slots, but nothing writes or reads a run: the first playable sector
  and the new-game/resume wiring do not exist. The slot format is already versioned in `saves.ts`.
