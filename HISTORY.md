# HISTORY — DEFLECT

Append-only. Newest entry at the bottom. Each entry: date, goal, what changed, verification, decisions,
next. Keep it short enough to read before a session.

---

## 2026-10-28 — Session 0: repo audit, decisions, doc scaffolding

**Goal:** Read the master spec, lock foundational decisions, set up the three tracking docs before code.

**Found:** Repo contained only `README.md` and `PRD-Deflect_game.md` (master spec). No build system,
no source, no tests.

**Decided (full reasoning in `AGENTS.md`):**
- D1 No game engine. Vanilla TypeScript + Canvas 2D + Web Audio + Vite, PWA first, Tauri later.
  The PRD already requires pure Canvas 2D and zero external assets; an engine buys nothing here.
- D2 Single-stick. The PRD's twin-stick aim is overridden by the game direction: movement sets facing.
  Mouse is buttons only; keyboard is 8-way; gamepad analog. Swinging locks facing.
- D3 N players via host-authoritative star (not peer-to-peer 2-player). v1 cap 8, to be measured.
  Host sims, guests send inputs, host sends 30 Hz snapshots with event list.
- D4 Identity = colored ring + unique geometric glyph, curated high-contrast palette, team-ready.
- D5 Feedback via replicated events.
- D6 Solo training gets one placeholder drone, explicitly not the bot-AI phase.
- D7 PeerJS cloud + binarypack arrays, 4-char room codes.

**Added:** `AGENTS.md`, `TODO.md`, `HISTORY.md`.

**Verification:** none yet (docs only).

**Next:** scaffold Vite/TS PWA, then simulation and renderer, then networking.

---

## 2026-10-28 — Session 1: v0.1 first playable

**Goal:** Build the first playable version of DEFLECT against the master spec and the direction changes:
N players, single-stick facing, shape-only neon art, synthetic audio, PWA first, controller early.

**Built:**
- Vite + strict TypeScript PWA. No game engine (D1). Manifest, generated PNG icons, service worker,
  installable shell. Vanilla Canvas 2D renderer and Web Audio synth; no image/audio/font assets.
- `src/game`: fixed 60 Hz sim, players/projectiles/rounds/drone, single-stick movement and facing lock,
  dash, swing/deflect, vector bolts with escalating damage/speed, candle bombs, pillar collisions,
  substepped hit detection, pooled particles and trails.
- `src/net`: PeerJS host-authoritative star for up to 8 players, 30 Hz snapshots, 60 Hz buffered inputs,
  guest interpolation, local movement prediction, replicated event list, lobby/ready/start/rematch,
  disconnect and room-full handling.
- UI: title, create/join lobby with invite link, training, round/match overlays, toasts, mute, perf HUD,
  gamepad menu navigation. Avatars are a colored ring plus a unique glyph; palette and callsigns are
  generated to stay visually distinct.
- Audio: fully synthesized UI/gameplay cues and a two-bar procedural pulse loop.

**Measured (this machine):**
- `npm run bench`, 1800 ticks after warmup: 8P stress avg 0.020 ms/tick, p99 0.047 ms at 16.2 live
  projectiles; 8P max case avg 0.072 ms, p99 0.214 ms at 85.9 live projectiles. Budget is 4 ms.
- Browser `?stress=8`, 96 live projectiles: 60 fps (display cap).
- Snapshot actual schema: 8P/48 projectiles = 2.83 KB at 30 Hz → 82.8 KiB/s per guest, 0.57 MiB/s
  host upload with 7 guests. 8P/96 = 5.13 KB → 150.3 KiB/s per guest, 1.03 MiB/s host.
- Production bundle: 171.42 kB JS (51.57 kB gzip), 14.29 kB CSS (4.07 kB gzip).

**Verified:**
- `npm run build` clean; `npm run bench` clean.
- Training: movement/facing, swing facing lock and slowdown, dash i-frames/cooldown, bolt deflect
  escalation, candle blast, pillar bounces, round and match flow.
- Two real tabs over PeerJS cloud: host create + guest join, guest movement and shots, network deflect,
  round end, match end, rematch with score reset, mid-match guest disconnect. Guest input and host
  authority matched.
- Production service worker: cached shell, then stopped the preview server and reloaded offline.
- Injected standard-layout virtual pad: left stick movement/facing, B candle, Start in-game menu.
  No physical controller was available.

**Fixed during verification:** spawn-slot assignment overwrote slots, swing/dash cooldown edge cases,
host room cancellation race, Space stealing focused menu-button activation, and gamepad B opening the
leave overlay while also being the candle button. Only Start/View opens the in-game menu now; B closes
an open overlay. Removed per-frame HUD string allocations.

**Known gaps:** eight actual WebRTC peers were not run (the cap is backed by sim and render stress);
the PWA install prompt was not exercised on a device; no physical controller; PeerJS public broker only.

**Next:** designer playtest and tuning. Then a real 8-client soak, followed by the deferred bot AI /
PvE / arena-interactive phases.

---

## 2026-10-28 — Session 2: arena set + local bot simulacrum

**Goal:** Give the designer a large test surface while they are away: multiple arena layouts and
credible local opponents, without weakening the single-stick rules or the host-authoritative model.

**Added:**
- `src/game/arenas.ts`: four data-driven layouts, each with pillars, an ordered 8-point spawn ring,
  accent, floor signature and title-screen mini-map.
  - `CROSSROADS`: four gates around an open center (symmetrical lane cross).
  - `GRID ZERO`: classic corner blocks plus central cover (the original layout).
  - `THE RING`: a hollow central box with four gaps; close control fights.
  - `SWITCHBACK`: staggered long bars for serpentine lanes and long ricochets.
- `src/game/bot.ts`: local bot match with ROOKIE/VETERAN/DIGITAL tiers and DUELIST/TRICKSTER/SIEGE
  styles. Bots write ordinary `InputFrame`s, face by moving, lock facing on swings and pay energy.
  Threat scan handles bolts, candles, and their own armed ricochets; line-of-fire and wall checks keep
  them from shooting into geometry.
- Title UI: arena cards with live previews, 1v1/1v3 selector, tier selector, persistent local choices.
- Lobby arena cycle for the host; arena id synchronized in `LOBBY` and `START`; guests use it for
  prediction and rendering.
- Bot match flow: best-of-three, rematch, local pause/leave overlay, HUD/badge identity.
- Bench: 8P digital bot swarm (AI + simulation) so local AI cost is measured.

**Decision:** `D8` in AGENTS.md makes arena geometry data, shared by world, movement, renderer and guest
prediction. `D6` is revised: the training drone stays dumb; the new local bots are a separate test tool,
not networked slots or PvE.

**Bug found and fixed:** a shot whose muzzle point started inside a pillar was reset to the shooter's
center and then immediately ricocheted back into them. This was making bots kill themselves at gates
and could affect humans too. `spawnProjectile` now refuses the shot before spending energy. Also fixed
bot wall pinning, own-ricochet blindness, and firing through intervening pillars.

**Measured:**
- `npm run bench`: 8P stress 0.016 ms/tick avg, p99 0.040; 8P max 0.059 ms avg, p99 0.179 at 83.4 live
  projectiles; 8P digital bot swarm (AI + sim) 0.024 ms avg, p99 0.084.
- All four arenas spawned eight players clear of geometry and ran 900 ticks without NaN.
- 1v1 DIGITAL bot completed a 3-0 match against an idle player and rematched cleanly.
- 1v3 DIGITAL swarm over 8 s: 19 bolts, 2 swings, 2 deflects, 3 dashes, 1 candle, 16 hits (invincible
  bodies to keep the sample running).
- Two-tab SWITCHBACK match: host arena 3, guest lobby/START arena 3, guest movement predicted to x863
  while host authority read x855. Host lobby cycle to GRID ZERO reached the guest lobby.
- Four training starts, one per arena, no console errors. Production build remains clean.

**Limitations:** bots are local only; they can still be baited into geometry or a bad candle, and style
balance is unplayed by a human. Arenas are static rectangles; no hazards or interactives yet. Eight real
WebRTC peers still have not been run.

**Next:** designer playtest of tiers, styles and arena layouts; then tune from notes and run a real
8-client soak before adding networked bot slots or PvE.

---

## 2026-10-28 — Session 3: bot pathing, Ring gates, test surface

**Goal:** Finish the arena/bot test pass so the designer can play long sessions without bots stalling
in cover, and make the selected map and bot styles legible before a match.

**Changed:**
- Replaced the local corner-following heuristic with `src/game/nav.ts`: a 20-unit per-arena occupancy
  grid, one reusable A* workspace, preallocated per-bot path buffers, and line-of-sight shortcuts.
  Bots re-plan on a 0.55 s timer or when their target moves; no per-frame allocation or full-grid scan.
- Fixed `THE RING`: the first version's four wall segments met at the corners, so the "gaps" were sealed.
  It is now a hollow square with a real gate at the middle of each side (60u side gates, 80u top/bottom).
- Increased the interior-cover wall-clearance threshold from 86u to 64u. The old value made a bot beside
  a central block abandon its route and push toward center, oscillating between the block and the wall.
- UI: build string is 0.1.1, title shows the selected arena tagline, and the bot panel lists the
  VEX/GLITCH/RIFT styles for the current count. In-game HUD reads `BOT DUEL/TRIAD // ARENA` instead of
  `1 UNITS`.
- Package version 0.1.1 (no git tag or commit created).

**Verification:**
- `npm run build` clean: 190.75 kB JS (57.82 kB gzip), 16.30 kB CSS (4.39 kB gzip).
- `npm run bench` final build: 8P stress 0.022 ms/tick avg (p99 0.060); 8P max 0.064 ms (p99 0.215)
  at 83.4 live projectiles; 8P bot swarm including A* 0.032 ms (p99 0.143). Budget is 4 ms.
- Headless matrix, 4 arenas × 3 tiers × 1v1/1v3: all 24 combinations reached a match winner in
  21–145 s. Before A*, a rookie 1v3 Crossroads case stalled at 180 s with two bots mirrored across a
  block.
- Browser: 1v1 DIGITAL on THE RING reached round end with no console errors; title taglines, roster,
  build string and HUD label present. Rematch/score reset and 1v1 rookie switchback were exercised before
  the A* change; neither flow was touched by it.
- Network code was not changed this session; the two-tab SWITCHBACK test from Session 2 still stands.

**Next:** designer playtest of the four maps, three tiers, 1v1/1v3, and the new routing. Tune bot
aggression, candle discipline and route smoothness from notes; then run the real eight-client soak.

---

## 2026-10-28 — Session 4: Gauntlet threats and hit feedback

**Goal:** Give the designer enemies to test in the geometric sandbox: worms that eat the arena, viruses
that swarm and convert victims, firewalls that sweep with real line of sight, and hits that physically
push and read directionally.

**Decision:** `D9` in `AGENTS.md`. Enemies live in a local-only endless `GAUNTLET` mode, not in ranked PvP
and not in the network snapshot. The mode is a PvE foundation, not a promise of networked PvE. It runs one
human, a respawn loop, and no round timer. Thralls reuse `players[1]` locally and drive an `InputFrame`
through the same single-stick rules; they are not room slots.

**Added:**
- `GameMode 'gauntlet'` and an `ENTER THE GAUNTLET` title card. Continuous practice mode; Esc pauses and
  offers `EXIT GAUNTLET`.
- Worms: preallocated segmented chains, red square body, always chase the local player, phase through
  cover, damage on touch, swallow bolts/candles and viruses, grow one segment per projectile and two per
  virus, and heal with each meal up to the cap.
- Viruses: magenta diamonds with swarm separation and proximity steering, timed replication (9 s), worm
  infection (magenta, faster) and player infection. The infection meter decays, fills on touch, and at
  full meter resets to 0.3 and spawns a nearby thrall.
- Thrall: a virus-owned copy of the player. It approaches from 150 units, strafes, swings in range, shoots
  bolts/candles and dashes, all through an `InputFrame`; it is killable and does not persist after death.
- Firewalls: warning phase (1.3 s), vertical/horizontal sweep, 22u beam, damage tick every 0.45 s.
  Pillars block both the damage test and the drawn path. Fixed a bounds bug where a vertical beam compared
  its x position against the top/bottom bounds and deactivated on spawn.
- Canvas presentation: segmented worm body with head eyes and health pips, rotating diamond viruses,
  warning and active firewall beams cut by cover, thrall ring, threat counters, kill count and infection
  bar. Hazard colors are in `THREAT_COLORS` in `identity.ts`.
- Hit feedback: `ParticleSystem.impact` sprays rotating triangle shards along the knockback vector; player,
  worm and virus hits all use it. Hit events now carry `dirX`/`dirY`; snapshot events pack and parse the
  two extra fields.

**Feel changes (old → new, why):**
- Bolt knockback 360 → 520. A clean bolt moved a player 76u over half a second instead of ~50u; the
  designer asked for hits to be felt, without becoming a launch.
- Candle knockback 620 → 820. Blast knockback should be the heaviest normal hit.
- Worm touch knockback 380 → 560. Contact has to create separation, otherwise the next tick re-contacts.
- Firewall knockback 460 → 640. A beam should shove a player out of the lane.
- Thrall swing knockback 700 (new). A thrall's melee needs to read as heavy, even though damage is 1.
- Gauntlet threat costs are in `GAUNTLET`, `WORM`, `VIRUS`, `FIREWALL`; no magic numbers in `world.ts`.

**Verification:**
- Headless gauntlet, all four arenas × 45 s with player movement and fire: 2 worms, up to 6 viruses, up to
  2 firewalls; beams moved; no NaN; 1–2 kills from player fire only (firewall kills no longer score).
- Worm eats a virus: `segCount` 7 → 9, virus inactive.
- Vertical firewall survived warning and swept 50.4u in 0.7 s active; the old bounds bug would have killed
  it on spawn.
- Thrall headless: closed 391u, reached 0.2u, dealt 12 damage to a 100 HP dummy in 8 s. Browser run also
  observed a thrall bolt in flight and the player dropping to 1 HP.
- Knockback: 520 impulse displaced a player 76.3u; event direction `(1,0)` preserved.
- Hit FX: one hit produced 16 triangle shards, all with forward velocity and all rotating.
- Browser gauntlet on `THE RING`: title flow, enemies, beams, HUD, movement (163u in 0.7s) and bolt input
  (`K`, energy 100 → 87.3) worked. Canvas pixel sample confirmed red worm geometry and magenta/orange
  hazard rendering; no console errors.
- Two-tab network after the snapshot format change: room `A5J4` on `THE RING`, host + guest started live,
  guest saw both slots, no console errors. Host upload snapshot sizes remeasured with the new event fields:
  8P/48 = 2.88 KB (86.5 KiB/s per guest, 0.59 MiB/s with seven guests); 8P/96 = 5.23 KB.
- Gauntlet max-threat benchmark (2W/12V/2F + thrall): 0.098 ms/tick avg, p99 0.468 ms across repeat
  runs, ~15.9 live threats. Browser rAF with the same load: 60.2 fps (display cap, 4-second sample).
- `npm run build` clean: 217.41 kB JS (65.24 kB gzip), 16.79 kB CSS (4.53 kB gzip). Package version 0.1.2.
- `npm run bench` all scenarios clean; current PvP numbers are in `TODO.md` §Performance.

**Limitations:** gauntlet has no win condition, waves, score persistence or progression. It is local only,
not in rooms. Thralls use simple close-range steering and can lose time behind deep cover; only one thrall
exists at a time. Worms phase through cover by design; firewalls are the threat that respects line of sight.
Eight real WebRTC peers and physical controllers remain untested.

**Next:** designer playtest of threat cadence, worm growth, virus cap, firewall frequency and thrall
pressure. Tune from notes, then decide whether gauntlet gets waves/score before any PvE network work.

---

## 2026-10-28 — Session 5: three-segment health and two projectile roles

**Goal:** Make health readable on the avatar itself and give the two projectile buttons distinct jobs:
a short fast burst and a slow long bouncy heavy hit.

**Changed:**
- Health is now **3 segments** (`PLAYER.hp` 5 → 3). Each avatar's main ring is split into three arcs;
  a lost segment disappears completely, leaving a gap. Removed the HP pips under avatars. HUD operator
  chips still show the same three segments. The low-health vignette threshold moved from 2 HP to 1.
- Respawns, round starts and thrall spawns reset all three segments through `clearPlayerForSpawn`.
- **Fast bolt** is now the close-range burst: TTL 5 s → **0.45 s** (~390 units), wall bounces 2 → **1**,
  damage 1, three shots per burst, then a **0.45 s** recharge. Added `burstLeft`/`burstCd` to `Player`,
  reset on spawn, consumed in `tryShoot`, and recharged in the fixed step. Bot and thrall shot decisions
  check burst state so they do not waste their action window.
- **Heavy candle** keeps its slower speed (470 vs 860), 1.4 s flight (~650 units), repeated bounces and
  2-damage blast, and is now explicitly the long bouncy damage option. Its role is documented instead of
  being treated as a training-only explosive.
- Training drone bolts get their own **4.5 s** lifetime (`TRAINING.droneBoltTtl`); reusing the new short
  bolt TTL would have made the drone's ranged attack vanish after ~230 units.
- Bot bolt range now derives from `BOLT.speed * BOLT.ttl`; thrall bolt range is capped at 340u. Package and
  title build string are **0.1.3**.
- Added a small bench scenario change: the 8P max-projectile case now feeds candles, because the
  three-shot burst caps bolt output well below the old 96-projectile ceiling.

**Feel changes (old → new, why):**
- `PLAYER.hp` 5 → 3. The designer asked for three visible ring segments; one hit should read as one lost
  segment, so 5 HP could not remain.
- `BOLT.ttl` 5 → 0.45 s and `maxBounces` 2 → 1. A short-range option needs to actually stop; the old bolt
  crossed most of the arena and bounced twice.
- Three-shot burst + 0.45 s recharge. The fast option should pressure at close range, then force a short
  reset instead of holding a lane indefinitely.
- Low-health vignette 2 → 1 HP. At three max segments, triggering at 2 would fire while still at 67%.
- Candle values unchanged; its existing slow, bouncy, 2-damage profile already matches the heavy role.

**Verification:**
- Headless burst: 3 shots fired from four rapid presses, fourth rejected; after the recharge the next shot
  fired. Burst left 2 and cooldown 0 after the recharge test.
- Headless range: bolt life 0.45 s; candle life 1.38 s; bolt TTL configured 0.45 s, candle speed 470.
- Headless health: max 3; damage sequence 3 → 2 → 1 → dead; respawn/round start return to 3.
- Browser training on `THE RING` at 2 HP: 107/180 sampled ring pixels active, in two separate arcs; no
  console errors. Canvas sampling confirmed the two-segment ring, not a full circle or pips.
- Browser build string 0.1.3; training starts with max 3 HP. A 1v1 DIGITAL bot match reached a 3-0
  match end with both avatars reading max 3 HP and no console errors.
- `npm run build` clean: 217.80 kB JS (65.40 kB gzip), 16.79 kB CSS (4.53 kB gzip).
- `npm run bench` clean: 8P max feeding 48.4 projectiles 0.032 ms avg, p99 0.080; gauntlet max 0.085 ms
  avg, p99 0.469; bot swarm 0.028 ms avg, p99 0.178.
- Snapshot shape is unchanged (hp was already a field; burst state is host-only). No two-tab rerun was
  needed for this pass.

**Limitations:** there is no on-screen burst-charge meter; the 0.45 s pause is the only charge feedback,
and a guest's rejected fourth press can still play a local shoot sound. Three clean burst hits can delete
a full-health target at close range, which is intentional but unplayed by the designer at this value.
Candle remains explosive at the end of its fuse; a pure non-explosive ricochet projectile would be a
separate weapon decision.

**Next:** designer playtest of the 3-health / burst / candle triangle. Tune burst cost or recharge first if
close-range kills feel too cheap; tune candle fuse or blast if it dominates long lanes.

---

## 2026-10-28 — Session 6: operator kit, console shell, settings (v0.1.4)

**Goal:** Turn the 0.1.3 duel into the designed operator sandbox: console-style title, avatar-only
telemetry, deflect combo, charged dash, target lock, random bug skills, a charged sweep beam, escalating
gauntlet waves, and a real settings screen. Then fix designer-reported beam and dash feel.

**Changed:**
- Title is a CRT console: ASCII logo, BIOS copy, blinking cursor, and a boot/fade handoff into the
  arena. `SETTINGS` moved into a dedicated tabbed screen.
- Avatars are larger and carry code/math symbols. The three health segments are the slowly rotating
  outermost ring; a damaged core reads as vulnerable. Operator name plates, top chips, and side
  life/energy bars were removed. Burst dots, dash chevron, bug icon and beam notch float behind the
  avatar instead.
- Arena set grew to five. `MAINFRAME` is a 2464×1344 multi-district map with a follow camera. Gauntlet
  waves now escalate every 30 s, and **cascading errors** spread as yellow blocks with red `!` marks.
- Deflect is a rhythm combo (left, right, forward wave); each arc reflects, swings close around the
  body, and punches at close range. Hold/release still fires the wave.
- Hold dash after the dodge to commit a charged triangle dash that damages and leaves fading squares.
  Tap dash phases through enemies and cover.
- `LT` locks a target. Candidate reticle is transparent, then solid once acquired.
- Tap strong (`Y`) for a random per-match bug: mine, slow trap, frontal wall shield, or ghost. Ghost
  dims the avatar, ignores damage/aggro, and cancels on attack.
- Hold strong to charge the beam. Two dots orbit from the player's back to the front; the beam
  auto-fires when they meet, roots the player for 3 s, pierces every enemy in line, and respects cover.
- Settings tabs: Controls, Feedback, Audio, System. Persisted hit rotation, impact flash, scanlines,
  volume, music, mute; hit preview; reset defaults.
- Snapshot player rows now carry `lockId`, `bugKind`, `bugCd` and `laserCd`.

**Feel changes (old → new, why):**
- Dash direction: facing at press → **last nonzero movement direction**. Lock can hold facing on a
  target while strafing; dashing at the target instead of the strafe made lock feel like it stole input.
- Beam start: release after full charge → **auto-fire at 0.9 s**. The extra release beat made the
  telegraph feel unresponsive and encouraged holding past the visual tell.
- Beam aim while live: instant stick facing → **0.55 rad/s sweep**. A three-second beam could otherwise
  whip across the arena; the commitment should be the firing line, not reaction speed.
- Beam damage test: worm head only → **head or any body segment**. Beams visibly crossing a worm's body
  were doing nothing.
- Beam cooldown readiness is now drawn beside the bug icon and synced, instead of being invisible.
- Deflect arc was pulled in to hug the avatar; the old arc sat too far out to read as a shield.

**Verification:**
- `npm run build` clean: 267.20 kB JS (77.88 kB gzip), 30.36 kB CSS (7.29 kB gzip).
- `npm run bench`: 2P 0.017 avg / 0.070 p99; 8P max 0.057 / 0.275; bot swarm 0.044 / 0.161; gauntlet
  max 0.096 / 0.379 with 28.9 live threats. All far under the 4 ms budget.
- Headless beam: auto-fired at tick 54 (0.9 s) with no release; 20 → 19 worm HP when only body segments
  were in the line; beam turned 0.0092 rad in one tick (0.55 rad/s), not a snap.
- Headless dash: lock facing east, last movement west, dash produced (-1, 0).
- Browser: settings opened, all four tabs switched to their own page, sliders persisted, scanlines
  toggled the overlay, reset restored 100%/100%/80%/ON, training started, no console errors.
- Build string 0.1.4; PWA cache version bumped.

**Limitations:** new kit has headless and menu-browser coverage, not a designer playtest. The new
snapshot fields were not exercised in a two-tab match yet, and 8-player bandwidth has not been
remeasured. No physical controller test. `MAINFRAME` has no dedicated bot-matrix run. Settings do not
include control rebinding.

**Next:** designer playtest of the bug/beam/deflect triangle, settings values, and `MAINFRAME` routing.
Then run a two-tab match to verify bug/laser cooldown sync and remeasure snapshot size.

---

## 2026-10-28 — Session 7: console menu and callsign settings (v0.1.5)

**Goal:** Make the title behave like a console menu instead of a decorated dashboard, move callsign into
Settings, and stop showing the Sectors concept before the player chooses multiplayer.

**Changed:**
- Title header is now only the ASCII DEFLECT mark, its blinking cursor, and `v0.1.5` underneath. Removed
  the BIOS lines, memory readout, run-command tagline and footer links.
- The menu is a single console list. Options are system text with one `>` cursor on the focused line.
  Hovering highlights but does not move the cursor; arrows/stick move focus and Enter/A confirms.
- `SETTINGS` is option 03 in the main menu. `SOUND` is option 04 and updates in place.
- Single-player and multiplayer stages use the same text rows. Arena and bot options are text choices
  with a `*` marker on the chosen value; focus returns to the chosen option after a click.
- `SECTORS // PVPvE` is a disabled in-development line inside the multiplayer stage only. The hub no
  longer advertises it.
- Callsign moved to `SETTINGS > SYSTEM`; Enter commits the name and blurs the field instead of starting
  training. It persists through reload as before.

**Verification:**
- `npm run build` clean: 266.56 kB JS (77.62 kB gzip), 34.62 kB CSS (8.06 kB gzip).
- Browser: hub exposes exactly SINGLE PLAYER, MULTIPLAYER, SETTINGS, SOUND; initial focus and `>` cursor
  on SINGLE PLAYER; ArrowDown moves the cursor to MULTIPLAYER; Enter opens that stage.
- Browser: Sectors absent from the hub, present only inside Multiplayer.
- Browser: callsign `NOVA` saved from Settings SYSTEM and still present after reload; Enter blurred the
  field and did not start a match. Sound label toggled OFF/ON in the console menu.
- Browser: arena choice kept focus on THE RING after selection; bot count kept focus and updated the run
  label to START BOT TRIAD; bot match started successfully.

**Limitations:** Settings and lobby screens retain their panel styling; this pass only converts the title
menu. No physical controller test. The disabled Sectors entry is informational, not playable.

**Next:** designer pass on menu spacing and cursor motion on a controller, then consider the same
text-menu language for lobby actions if it still feels inconsistent beside the title.

---

## 2026-10-28 — Session 8: remove input-mode readouts

**Goal:** Stop announcing the input device. The game should simply follow whichever device was used last.

**Changed:**
- Removed `KEYBOARD // MOUSE`, `GAMEPAD CONNECTED`, `GAMEPAD PREFERRED` and the Settings input-device
  row. The title status bar was removed with them; the version remains under the logo.
- `Input` now owns the active device: a keyboard/mouse event switches to keyboard, any gamepad stick,
  trigger or button switches to gamepad, and only that device builds the movement/action frame. Both
  accumulators are still cleared every sample so stale presses cannot leak across a switch.
- Missing/disconnected pads fall back to keyboard.

**Verification:**
- `npm run build` clean: 266.23 kB JS (77.47 kB gzip), 34.18 kB CSS (7.98 kB gzip).
- Browser: no input-device label remains anywhere in the UI; title header is logo + `v0.1.5` only.
- Browser: training started after the change; holding `D` moved the player 68 → 1212 on x.
- Browser: injected standard-layout pad at x=1 moved the player 424 → 498 on x; centering the stick and
  pressing ArrowLeft moved the same player back to 449, confirming the gamepad → keyboard handoff.
- No console errors.

**Limitations:** No physical controller was available; the handoff was exercised with an injected pad and
real browser keyboard events, not hardware.

**Next:** physical controller pass, then the two-tab network verification.

---

## 2026-10-28 — Session 9: lofi-house soundtrack (v0.1.7)

**Goal:** Replace the placeholder pulse with chill lofi house, still generated entirely in the browser
from MIDI note data so no audio files ship.

**Changed:**
- Music tempo 120 BPM → 82 BPM and the loop 2 bars → 4 bars. Removed the square-wave arpeggio.
- Added a Cmaj7 / Am7 / Dm7 / G7 progression and bass roots as MIDI note numbers, converted to Hz by
  the synth at schedule time.
- Chords are Rhodes-style triangle notes with a quiet sine octave, hit on the downbeat and re-hit late
  in the bar. Bass is a sustained sine root with a short octave lift.
- Beat: soft four-on-the-floor kick, claps on 2 and 4, swung closed hats, and an open hat on the backbeat.
- Added a two-second vinyl-crackle buffer looped under the music, faded in and out with the track.
  The music bus now has a 7 kHz low-pass so the bed stays warm while combat cues stay sharp.
- Leaving a match clears the music timer and stops the vinyl source; the toggle restarts both cleanly.
- Version 0.1.7; service-worker cache version bumped.

**Verification:**
- `npm run build` clean: 268.20 kB JS (78.15 kB gzip), 34.18 kB CSS (7.98 kB gzip).
- Browser: idle training scheduled 27 oscillators and 14 buffer sources in a measured three-second
  window, matching the loop math. Counts stopped immediately after leaving the match.
- Browser: music toggle OFF and back ON, then a fresh training match restarted the loop with no console
  errors.
- No simulation code changed; the bench was not rerun for this audio-only pass.

**Limitations:** The automation environment cannot listen, so this verifies scheduling and runtime
behavior, not the subjective mix. Chord/bass/vinyl levels need a designer listening pass.

**Next:** tune the mix against combat cues, then consider a sparse lead motif or a second music state
for gauntlet/boss encounters.

---

## 2026-10-28 — Session 10: controller, shooting family, assembly and alpha hosting (v0.1.8)

**Goal:** Act on the next designer playtest pass: controller reliability, staged menus, larger arenas,
shooting enemies, stronger hit feedback, a gentler deflect window, a proper level assembly intro, and a
playable GitHub Pages alpha with a clear license.

**Changed:**
- Gamepad menu repeat was mixing milliseconds and seconds (`now + 0.36` against a millisecond timer), so
  a held direction counted as a repeat every frame. Corrected to 360 ms initial delay and 110 ms repeat.
  Restored left-stick navigation, added 0.55/0.32 engage/release hysteresis, and raised pad-loss grace
  from 1.2 s to 3 s without flipping the active device to keyboard.
- Solo menu flow is now program (training/gauntlet) → arena previews → bot count/tier. Removed the
  LOCAL/ONLINE labels; added a single SETTINGS option. Audio settings split into soundtrack, SFX and
  menu channels.
- Enlarged the four compact arenas, added a 1.28× camera zoom, and replaced the flat floor-only look with
  circuitry/Unicode signatures. Removed the title-screen grid so the CRT console reads cleanly, and
  removed the title hint line.
- Removed permanent in-match HUD text, in-game scanlines, and extra avatar rings. The segmented health
  ring is the outer ring; the code-symbol core, facing arrow, and floating readiness icons carry status.
- Level intro is now a 3.1 s assembly: ground, frame, cover dropping in, operator skeletons, then spin-up.
  Removed the canvas loading bar and the DOM boot progress bar; the boot log is a small transparent
  corner overlay so the arena is visible while it builds.
- Added the shooter family: pulse square, nested triplex shotgun, trapezoid homing missile pod, and
  three-dart flock. Worms are now blocked by cover rather than phasing through it.
- Enemy spawn assembly (worm head/segments, virus diamonds, sentry frames, error blocks) and a larger,
  size-scaled triangle de-rez burst on death. New `WORM_KILL` and `VIRUS_KILL` events.
- Deflect active window **0.09 → 0.2 s**; max early return angle **0.32 rad**; early catches keep 84%
  speed. Return angle now grades both press timing and catch distance, so a last-instant catch goes
  straight and an early catch still deflects but clips wide.
- Charged beam corridor **12 → 22** half-width and damage tick **0.5 → 0.14 s**, keeping 1 damage per tick.
  This makes a tracked beam chew through targets instead of plinking twice a second.
- Added `.github/workflows/pages.yml` to build and deploy `dist/` from `main`; the play link is at the top
  of README. The page is built by Actions rather than serving the raw branch.
- Added the custom source-available `LICENSE`: non-commercial use, credit and link-back required, written
  permission for non-mod derivatives, and an explicit free-mod carve-out.
- Version 0.1.8; service-worker cache version bumped.

**Verification:**
- `npm run build` clean: **285.62 kB JS (82.16 kB gzip), 34.67 kB CSS (8.03 kB gzip)**.
- `npm run bench`: 8P bot swarm 0.040 ms avg / 0.227 ms p99; gauntlet max 0.107 ms avg / 0.401 ms p99
  with 31.3 live threats. All cases stay under the 4 ms budget.
- Input harness: D-pad edge, release, second tap, 100 ms hold (no repeat), 380 ms hold (repeat), 120 ms
  repeat, stick engage/hysteresis/release all matched one expected edge per action.
- Headless deflect check: early 0.304 rad, mid 0.164, late 0.103, contact 0.008. The early catch remains
  a deflect but is visibly angled; the contact catch returns nearly straight.
- Headless 60 s gauntlet: 1 worm, 6 viruses, 9 sentries, 14 error blocks, no non-finite positions.
- Browser: title grid display `none`, no boot-bar element, transparent boot overlay, version v0.1.8;
  staged gauntlet flow reached the arena and rendered with no console errors.
- Pages run 40814155155 completed build + deploy; `gh api .../pages` reports `status: built`,
  `build_type: workflow`. The live URL served the hashed bundle, showed the v0.1.8 console menu, and
  started gauntlet with only the expected init/state console logs.

**Limitations:** Controller verification still uses a standard-layout virtual pad, not physical hardware.
No new network or two-tab pass was run in this session.

**Next:** designer pass on the shooter mix and wave pacing, physical controller check, verify the Pages
URL, then continue toward the PvPvE sectors plan.

---

## 2026-10-28 — Session 11: guard, pickups and gauntlet pacing (v0.1.9)

**Goal:** Act on the latest playtest notes: make deflect a reliable held screen instead of a timing-only
parry, give the player two dodges and a sustainable basic stream, calm the gauntlet opening, add local
healing/powerups, and make the level read better with brighter cover and an optional minimap.

**Changed:**
- Deflect is now a **180°** cone. Tap active window **0.2 → 0.24 s**; max early return angle
  **0.32 → 0.24 rad**. The old hold-and-release shield wave is gone; the third tap still fires the
  forward wave.
- Holding deflect raises a guard that reflects every shot in the front half-plane for up to **1 s**.
  Each caught shot spends **0.11 s** of guard time. A broken guard enters a **0.28 s** cooldown; an early
  release uses **0.12 s**. Target lock flattens caught shots toward the locked target (incoming angle
  scaled to 0.02), so reflected fire goes where the player intended. Lock range **1000 → 1600** units.
- Dodge capacity **1 → 2** charges. Both share the existing 1.8 s recharge; the HUD shows two chevrons.
- Basic bolt **three shots / 0.45 s recharge / 15 energy** became **five shots / 0.2 s recharge / 3
  energy**, with held auto-fire at **0.1 s** and energy regen **15 → 18/s**. This is the
  near-continuous stream the designer asked for without making it a burst-only weapon.
- Training flow is now arena grid (four-way navigation) → bot count (1, 2 or 3) → difficulty → run.
  Training runs `World('training')` with **no rounds**; bots and the player respawn endlessly. The
  sparring drone only appears in solo training. A spatial menu navigator replaced linear menu motion so
  the arena cards behave like a real grid.
- Gauntlet opening slowed: worm initial delay **2.5 → 4.5 s**, virus **4.5 → 7 s**, sentry first pack
  **4 → 11 s**, interval **9 → 17 s**, floor **5.5 → 12 s**, initial pulses **2 → 1**, pool cap
  **12 → 8**. Packs now queue and land one silhouette every **0.65 s** instead of all at once.
- Enemy health cut across the board: worm **8 → 5**, virus **2 → 1**, pulse **4 → 2**, triplex **7 → 4**,
  homing **6 → 3**, flock **2 → 1**, cascading error **4 → 3**. Firewall damage to enemy factions is
  **1 → 3** (`FIREWALL.enemyDamage`); player damage stays 1.
- Automatic firewalls are **off** behind `GAUNTLET.autoFirewalls`. They will return as a damage-triggered
  arena switch, not ambient pressure.
- Enemy fire now damages worms, viruses and cascading errors. Low-tier sentry shots have shorter TTL and
  range and disperse on walls/pillars instead of bouncing.
- Added modular local pickups in `powerups.ts`: `RESTORE_STATUS`, machine gun, scatter, overcharge,
  barbed whip, pathfinding. Timed effects last 11–15 s, replace each other, and draw an active icon behind
  the avatar. They spawn only in training/gauntlet and never enter snapshots.
- Cover is brighter and clearly solid: panel fill, inset panel, hard rim, top highlight and hatch marks.
  Added a lower-left minimap showing cover, players, threats and pickups, with a persisted
  `Settings → Feedback → MINIMAP` toggle.
- Version 0.1.9; service-worker cache bumped.

**Verification:**
- `npm run build` clean: **304.14 kB JS (87.31 kB gzip)**, **34.67 kB CSS (8.03 kB gzip)**.
- `npm run bench`: 8P bot swarm **0.068 ms** avg / **0.342 ms** p99; gauntlet max **0.189 ms** avg /
  **0.705 ms** p99 with 31.1 live threats. Every case stays under the 4 ms budget.
- Headless combat harness: guard returns a front shot (owner 0, +700 vx) and leaves a back shot alone;
  guard burns out after 1 s into cooldown; both dodge charges spend and refill; five-shot stream reaches
  recharge; pickup spawns and applies a timed effect; gauntlet has zero automatic firewalls, starts with
  one staggered sentry, and caps at eight.
- Browser: four-way arena grid navigation, training count → tier → run, endless training start, then a
  30 s gauntlet run with no console errors. Minimap toggle persisted (`deflect.minimap`).
- No new network or two-tab pass was run in this session.

**Limitations:** Firewall switches are not built; automatic firewalls remain off. Pickups are local only.
Sentries do not friendly-fire each other because projectiles have no source silhouette. Physical
controller behavior is still verified with a virtual standard-layout pad.

**Next:** Add the destructible firewall switch, playtest the new guard and sentry pacing on a physical
pad, and decide whether pickups eventually belong in networked PvE.

---

## 2026-10-28 — Session 11b: training flow, arena grid and guard tap window

**Goal:** Finish the playtest follow-up: make the training flow a real staged grid, remove round pressure
from practice, keep a deflect tap distinct from a held guard, and record final v0.1.9 numbers.

**Changed:**
- Split the solo flow into `TRAINING` → arena grid → bot count → bot tier → run. `SECTORS // PVPvE` is
  only exposed under Multiplayer as an in-development entry. The new spatial menu navigator moves between
  stage buttons and the arena grid, so arrows change the selected card instead of leaving the grid.
- Training no longer runs rounds: the timer, score pips and round HUD are hidden (`display:none`), and the
  session has no round/match end. Bots and the player respawn endlessly with the chosen bot count.
- Held guard now arms after `PLAYER.guardStartDelay` = 0.08 s. A quick `B` tap stays the melee/deflect
  swing; holding raises the 180° shield. Releasing early applies the 0.12 s release cooldown as before.
- Minimap toggle persists; brighter cover panels use a solid fill, rim and hatch marks so cover does not
  read as floor texture.
- Version 0.1.9; service-worker cache bumped.

**Verification:**
- Probe: holding `SWING` for 4 ticks (`0.067 s`) leaves `guardT = 0`; two more ticks raises it to
  `0.967 s`; release clears it and starts a `0.12 s` cooldown.
- `npm run bench`: 2P 0.018 / 0.090, 4P 0.014 / 0.060, 8P stress 0.011 / 0.037, 8P max projectiles
  0.039 / 0.159, 8P bot swarm 0.076 / 0.331, gauntlet max 0.172 / 0.573 with 31.1 live threats.
- `npm run build` clean: 304.22 kB JS (87.34 kB gzip), 34.67 kB CSS (8.03 kB gzip).
- Browser: arena grid arrows moved through `CROSSROADS` → `GRID ZERO` → `THE RING` → `SWITCHBACK` →
  `MAINFRAME`; training started with 3 `DIGITAL` bots, reached 40 kills in 6.8 s with no rounds and no
  console errors; gauntlet launched clean; minimap toggle persisted (`deflect.minimap`).
- `git diff --check` clean.
- Commit `b106224` pushed to `main`. Pages run `40819895257` completed both build and deploy successfully.
- Production verify: <https://spuds0588.github.io/DEFLECT/> serves `v0.1.9` with
  `assets/index-DAT_q9fJ.js`; `sw.js` uses `deflect-0.1.9`; a fresh browser reached the title, walked the
  staged training flow to 3 `DIGITAL` bots on `CROSSROADS`, stayed in training with no round overlay after
  6 s, and logged only the init/state messages.

**Limitations:** Firewall switches are still not built, pickups remain local-only, and the controller pass
remains a virtual standard-layout pad rather than physical hardware. No new two-tab network pass was run.

**Next:** Build the destructible firewall switch, then do a physical-pad pass over the training flow and
held guard.

---

## 2026-10-28 — Session 12: auto-advancing training flow (v0.1.10)

**Goal:** Remove the extra NEXT/RUN stops from the solo setup. Selecting a level, bot count, and difficulty
should carry the player straight into training, so confirming repeatedly with `A` is enough.

**Changed:**
- Choosing an arena advances directly to bot count. Choosing a bot count advances directly to difficulty.
  Choosing a difficulty starts the run.
- Choosing a gauntlet arena starts the run immediately.
- Removed the arena `NEXT // OPPOSITION`, bot-count `NEXT DIFFICULTY`, and difficulty `RUN START BOT`
  buttons, along with their now-unused CSS and element references.
- Replaced per-stage helper notes with `SELECT A COUNT TO CONTINUE.` and `SELECT A TIER TO START.`.
- Title-screen hover focus now follows `pointermove` rather than `pointerover`, so a stationary mouse
  cannot steal focus when a new menu stage appears under it. This keeps the controller/keyboard cursor on
  the saved or selected choice.
- Version 0.1.10; service-worker cache bumped.

**Verification:**
- `npm run build` clean: **304.08 kB JS (87.29 kB gzip)**, **34.70 kB CSS (8.03 kB gzip)**.
- Local browser: five Enter presses from the hub reached a live training run with no intermediate NEXT or
  RUN step. Selecting a gauntlet arena started gauntlet directly.
- Local browser: arena stage focused `CROSSROADS` (the selected card) instead of the card under the
  stationary pointer.
- Production browser: GitHub Pages v0.1.10 walked the same five-confirm path to a live 3-bot training run
  on `CROSSROADS`; console showed only `[DEFLECT-INIT] Build 0.1.10 ready` and the training state line.
- Commit `9a10843` pushed. Pages run `40821032854` completed build and deploy successfully. Production
  serves `assets/index-4mQsryyT.js`; `sw.js` uses `deflect-0.1.10`.

**Limitations:** No simulation code changed, so the bench was not rerun. The physical-controller and
two-tab network passes are still pending.

**Next:** Have the designer run the shield/flood test routes, then tune guard duration, cooldown, or
gauntlet pressure from the notes.

---

## 2026-10-28 — Session 13: territory roles, kill drops and calmer waves (v0.1.11)

**Goal:** Stop the gauntlet from behaving like every threat is a player-seeking missile, cut the spawn
pile-up, and move pickups from a timer faucet to the kills the player earns.

**Changed:**
- **Pickups:** ambient placements moved from first 6 s / every 13 s / max 3 to first 24 s / every 42 s /
  max 2. Kills are now the primary source: 4% for small enemies, 25% for heavy silhouettes, with a shared
  5.5 s cooldown and a 36–92 unit drop scatter. Training bot kills feed the same drop path.
- **Worms:** added a territory anchor and patrol point. A worm leaves its patch only when the player enters
  `WORM.aggroRadius` (310) or damages it, holds interest for 5.5 s, then returns. Longer chains slow from
  1.0 toward `WORM.minSpeedMult` 0.62. Speed 78 → 74.
- **Viruses:** replaced cross-map beelining with roam points. They pursue the player only inside
  `VIRUS.huntRadius` (310) or an uninfected worm inside `VIRUS.wormHuntRadius` (560), and otherwise spread.
  Split interval 9 → 13 s; split cap stays 10. Orbit 110 → 140.
- **Sentries:** every silhouette now holds its own landing anchor with a per-kind leash (pulse 160,
  triplex 100, homing 120, flock 250). Triplex speed 68 → 46, homing 58 → 30, pulse 92 → 82. Caps cut
  from 8 to 5 live sentries; queued packs stop landing at the cap instead of overshooting it.
- **Waves and caps:** wave length 30 → 45 s, ramp 1.4 → 0.9, floor 5.5 → 9 s. New waves no longer reset
  every threat timer into a synchronized burst. Worms max 3 → 2; viruses max 16 → 10; errors max 28 → 14,
  first at 28 s and one block every 3.4 s.
- Version 0.1.11; service-worker cache bumped.

**Verification:**
- `npm run build` clean: **308.00 kB JS (88.47 kB gzip)**, **34.70 kB CSS (8.03 kB gzip)**.
- `npm run bench`: 8P bot swarm 0.081 ms avg / 0.364 ms p99; gauntlet max 0.099 / 0.403 ms with 25.9
  live threats. All player/projectile cases remain under 0.05 ms avg.
- Headless 4-minute gauntlet probe: caps held at 2 worms, 5 sentries and 14 error blocks; every sampled
  virus roamed through 2 minutes (one pursued the idle player at 3 minutes); average sentry drift stayed
  at or below 176 units from its anchor. Earlier kill-drop probe:
  11/40 worm kills and 8/40 triplex kills dropped at the 25% rate, with the active pickup cap at 2.
- Browser gauntlet at 56 s: 3 roam-target viruses, 2 sentries holding 159/58 units from their anchors,
  7 error blocks and 1 infected worm. At 132 s: 5 roam viruses, 5 sentries, 14 error blocks, 2 infected
  worms. No console errors beyond the normal Vite connection lines.

**Limitations:** The spawn and behavior probe uses an idle player, so it measures pressure rather than a
full fight. Physical-controller and two-client network passes were not rerun. The changes are local-only.

**Next:** Playtest the kill-drop rate and territory spacing on the alpha build, then build the
destructible firewall switch and the Sectors bridge flow.

---

## 2026-10-29 — Session 14: scored gauntlet runs and local top table (v0.1.12)

**Goal:** Give gauntlet its own setup choices and turn it into a score chase that records the wave and
survival time instead of only respawning forever.

**Changed:**
- Gauntlet now has a setup stage after the arena grid. It shows the chosen arena, two run types, and the
  local top-eight table. Picking a run type starts immediately; there is no extra NEXT step.
- `SURVIVAL` is the scored run: breaking the ring ends the run, freezes the world, and opens a results card
  with wave, time, kills, arena and placement. `PRACTICE` keeps the old endless respawn behavior and does
  not write a record.
- `src/game/gauntletRecords.ts` owns the `GauntletRun` record, ranking, validation, `localStorage` I/O and
  `m:ss` formatting. Runs rank by wave, then seconds survived, then kills; the table keeps eight.
- The gauntlet setup table lists all eight kept runs. The title menu shows `BEST Wn` beside `GAUNTLET` when
  a record exists, and `SCORED` when the table is empty.
- The results card focuses `RETRY`; `RETRY` starts a fresh run with the same arena and run type, `SETUP`
  returns to the gauntlet stage, and `TITLE` returns to the hub.
- World gained `gauntletOver` and a `gauntletTime` getter. A scored death stops `step()` at the frame of
  death; practice deaths still use the training respawn timer. The bench explicitly runs gauntlet in
  practice mode so its stress load does not freeze.
- Version 0.1.12; service-worker cache bumped.

**Verification:**
- `npm run build` clean: **312.87 kB JS (90.04 kB gzip)**, **35.77 kB CSS (8.21 kB gzip)**.
- `npm run bench`: 8P bot swarm 0.071 ms avg / 0.330 ms p99; gauntlet max 0.106 / 0.428 ms with 25.9
  live threats.
- Headless probe: scored damage set `gauntletOver`, froze `gauntletTime` and stopped stepping; practice
  respawned alive with the world still running. Ten records kept the top eight, W10 down to W3, and
  `formatGauntletTime(372)` returned `6:12`.
- Browser: `SINGLE PLAYER` → `GAUNTLET` → `CROSSROADS` opened `GAUNTLET // CROSSROADS // RUN SETUP` with
  `SURVIVAL // SCORED` selected and an empty table. Choosing it started the run.
- Browser: a scored death at 0:24 opened `WAVE 1 // 0:24` with `0 KILLS // NEW PERSONAL BEST` and focused
  `RETRY`; `SETUP` showed `01 NULL W1 0:24 CROSSROADS`.
- Browser: a second scored end at wave 3, 1:32, 17 kills sorted to the top of the table ahead of the W1
  run. The title menu read `BEST W1` from the first record.
- Browser: practice damage respawned the player, showed no overlay, and left the record count unchanged.
- `git diff --check` clean.

**Limitations:** The table is local to one browser profile and does not split by arena or run type. No
online leaderboard or score sync exists. The forced browser values were test data and were cleared after
the pass. Physical-controller and two-client network passes were not rerun.

**Next:** Playtest the survival curve on each map, then decide whether the table should filter per arena
or per run type. The destructible firewall switch and sector bridge flow remain the next content work.

---

## 2026-10-29 — Session 15: sector campaign blueprint (v0.1.13)

**Goal:** Turn the five-system campaign story into a data-driven layout scaffold the designer can review
and hand sketches into, without pretending a sector runtime exists.

**Changed:**
- Added `src/game/sectors.ts`: five authored sector graphs (`LOCALHOST`, `OFFICE LAN`, `CINEVAULT`,
  `BOTNET`, `SINGULARITY`) with 42 arena nodes and 49 links. Links are bridges, paired teleporter pads or
  a shared lift; each sector has an entry, an exit and at least one boss node.
- Each node stores an existing `arenaId` as its first blockout, so the campaign can grow from the current
  `ArenaDef` data instead of a second geometry format.
- `MULTIPLAYER > SECTORS // PVPvE` now opens a blueprint archive instead of a disabled line. Sector tabs
  show the schematic, story, objective, mechanic, boss and exit. The map draws node silhouettes, link
  types, boss rings, entry/exit markers and a legend.
- Added `SECTORS.md`: campaign arc, per-sector layout intent, the bridge/pad/lift grammar, an arena sketch
  checklist, open runtime rules and the first local runtime slice.
- Added the blueprint stage to the title menu with keyboard/gamepad focus and `ESC`/`B` back to
  Multiplayer. It stays out of the solo flow.
- Version 0.1.13; service-worker cache bumped.

**Verification:**
- Sector graph probe: no duplicate nodes or links, every link resolves, every sector is connected from
  its entry, every sector has a boss, and all nodes sit inside the map margins.
- `npm run build` clean: **328.40 kB JS (94.96 kB gzip)**, **37.26 kB CSS (8.43 kB gzip)**.
- Browser: `MULTIPLAYER` → `SECTORS // PVPvE` opened the archive; selecting LOCALHOST, OFFICE LAN and
  CINEVAULT updated the arena/link counts, story, boss and schematic; ArrowRight moved focus, Enter
  selected, Escape returned to Multiplayer. Canvas drew at 1200×675 with no console errors.
- No simulation files changed, so the bench was not rerun.

**Limitations:** Blueprint only. No sector node is playable, no bridge/pad/lift can be traversed, and no
sector data enters `World`, snapshots, rooms or the network. The node layouts reuse existing arenas as
placeholders. The archive has no node-level interaction; it is a sector overview, not an editor.

**Next:** Review the five topologies with the designer, collect the first arena sketches, and decide scene
cuts, wipe rules, PvP rules and boss scaling before building a local-only one-sector slice.

---

## 2026-10-29 — Session 15b: network route framing (v0.1.13)

**Goal:** Make the campaign read as one internet route through interconnected devices, not five separate
stages chosen from a menu.

**Changed:**
- The sector archive now shows a persistent `NETWORK ROUTE` line: `01 LOCALHOST > 02 OFFICE LAN >
  03 CINEVAULT > 04 BOTNET > 05 SINGULARITY > ROOT`.
- The Multiplayer note and archive heading now describe one route through five device clusters. The tabs
  are explicitly a review tool, not the in-play sector selector.
- `SECTORS.md` gained a `One route, not a level select` section with the cross-sector chain:
  open web, smart TV, botnet relay, C2 backbone, then `ROOT`.
- `AGENTS.md` D13 records that sector selection must not become the campaign flow.

**Verification:**
- `npm run build` clean: **328.52 kB JS (94.99 kB gzip)**, **37.33 kB CSS (8.45 kB gzip)**.
- Browser: archive heading and route line rendered in one line (744 px), `01 LOCALHOST` focused, and the
  existing sector map readout was unchanged.
- `git diff --check` clean.

**Limitations:** Copy and blueprint framing only. There is still no playable route, transition or
cross-sector state.

**Next:** Keep the route as the frame while authoring the first device cluster. The LOCALHOST slice should
end at the modem uplink, with the archive showing where that uplink leads.

---

## 2026-10-29 — Session 16: one-life gauntlet and slow wave ramp (v0.1.14)

**Goal:** Make the gauntlet a single-life score chase and pull the difficulty curve out of its early
spike, so the opening is quiet and the mode can support a very long wave count.

**Changed:**
- Gauntlet setup is now `RUN // ONE LIFE` with one `BEGIN RUN` action. The old `PRACTICE // RESPAWN`
  choice is gone from the UI; training remains the practice space. The internal practice path stays for
  the headless bench.
- Wave duration **45 → 30 s**. Difficulty now tapers across `GAUNTLET.fullPressureWave` = **120** waves
  instead of maxing out in a few minutes.
- Threat families unlock one at a time: worms **wave 3**, viruses **6**, triplex **9**, cascading errors
  **12**, homing pods **15**, flocks **18**. No family timer runs before its unlock.
- Opening is one pulse sentry at **9 s**, then one worm at wave 3. No virus cluster, error colony or heavy
  shooter appears in the opening.
- Spawn intervals taper slowly: sentry **30 → 9 s**, worm **34 → 14 s**, virus **34 → 13 s**, virus split
  **20 → 10 s**, error growth **4 → 2 s**.
- Live caps now grow by wave: sentries **1 → 5** every 9 waves, worms **1 → 2** at wave 23, viruses
  **4 → 10**, error blocks **4 → 14**. Virus clusters start at **2** and reach **4** at wave 34.
- Sentry silhouette mix is gated: pulse only early, then triplex, homing and flocks. The practice/bench
  path still returns max caps and all four silhouettes so max-load measurements stay comparable.
- `spawnErrorColony` and `growError` respect the dynamic block cap. A large colony cannot overshoot the
  current wave limit.
- Gauntlet records table now calls its final column `ARENA`, not `SECTOR`, and the empty line says
  `ONE-LIFE RUNS`.
- Version 0.1.14; service-worker cache bumped.

**Verification:**
- 430 s headless probe: first threat at **9 s**; first worm at **68 s**; first virus cluster at **160 s**;
  first error colony at **338 s**. At wave 13 the room held 4 error blocks, 2 sentries, 4 viruses and
  1 worm.
- 121-wave headless probe: caps grew to **2 worms, 9 live viruses, 5 sentries and 14 error blocks**, with
  max observed 2/9/5/14. No runaway spawn.
- One-life probe: damage set `gauntletOver`, froze `gauntletTime` and stopped stepping. Internal practice
  still returned caps 5/2/10/14.
- `npm run bench`: gauntlet max **0.126 ms** avg / **0.460 ms** p99 with **26.3** live threats; 8P bot
  swarm **0.070 / 0.405 ms**.
- Browser at v0.1.14: setup showed `RUN // ONE LIFE` and focused `BEGIN RUN`; no practice line or record
  was present. After 18 s wave 1 had one pulse sentry and no worms, viruses or errors. A forced ring break
  opened `WAVE 1 // 0:25`, wrote one record, and cleared from storage afterward.
- `npm run build` clean: **329.78 kB JS (95.34 kB gzip)**, **37.33 kB CSS (8.45 kB gzip)**.
- `git diff --check` clean.

**Limitations:** The curve is tuned from headless probes and an idle browser check, not a long real
playtest. Wave 1 is deliberately sparse; the first sentry can still take two segments from a stationary
player before wave 2. The late silhouette mix and wave 50+ pressure still need feel testing. The gauntlet
setup still has a separate `BEGIN RUN` step so the local top table can be seen before starting.

**Next:** Playtest the first 10 waves on a physical controller, then tune the opening sentry cadence and
the wave 20–50 mix. Keep the one-life rule fixed while tuning.

## 2026-10-29 — Session 17: opening density, lock coverage and lash sweep (v0.1.15)

**Goal:** Answer the first gauntlet playtest notes: wider-arena openings felt empty, lock-on ignored
square sentries, own fire could damage its owner, quick `B` was still drawing a shield arc, enemies were
not consistently legible on the minimap, and the minimap sat too high on screen.

**Changed:**
- Sentry opening **1 → 2 live** (`SENTRY.startCap`) and a 24 s opening pack interval instead of 30.
  Waves 1–3 queue two pulse squares instead of one; wave 4 returns to a single silhouette and the normal
  30 s interval until triplex unlocks.
- Sentry packs now spawn on a camera-window ellipse (`spawnViewX` 0.30, `spawnViewY` 0.24) instead of a
  fixed 480–700 unit radius that could put both shooters behind the camera on `MAINFRAME`.
- Opening sentries hold their first shot **0.9–2.2 → 5.5–7.5 s** and use a **2.4×** repeat cadence through
  wave 3. An idle player survives the first 13 s at full health and loses the ring around 25 s; moving
  play has a clear reaction window.
- Target lock now includes sentries (`lockKind 5`) and cascading-error blocks (`lockKind 6`) in both
  acquisition and retention. Their reticles use the same translucent acquiring / solid locked states.
- Own projectiles can never damage their owner, including after a wall bounce sets `armed`; the old
  `!armed` exemption was allowing self-hits. Mines already skipped their source.
- Quick `B` is now a straight spiked lash that sweeps left/right across the 180° arc. It has no shield
  fill, no third-tap forward shield wave, and pushes players and hostiles tangentially in the sweep
  direction. `PLAYER.swingWhiffRecovery` **0.18 → 0.12 s** so taps string together. Holding `B` still
  raises the 180° guard.
- Minimap **190 → 148 px** wide, anchored **12 px** from the lower-left edges instead of 24, with larger
  threat marks and coverage for sentries, errors, firewalls, the training drone, worms, viruses and
  pickups.
- Version 0.1.15; service-worker cache bumped.

**Verification:**
- Headless lock probe: sentry acquired as `5`, error block as `6`.
- Headless opening probe on `MAINFRAME`: 2 active pulse squares at 12 s, max observed offsets ~237 x /
  ~244 y from the player, inside the camera view.
- Headless self-damage probe: an armed, bounced own bolt left the owner at 3 hp.
- Headless sweep probe: three taps produced directions `1,-1,1`, `waveT` stayed 0, and a rightward sweep
  shoved a target on +y while removing 1 hp.
- `npm run build` clean: **330.76 kB JS (95.61 kB gzip)**, **37.33 kB CSS (8.45 kB gzip)**.
- `npm run bench`: 8P max **0.041 / 0.154 ms**, bot swarm **0.055 / 0.226 ms**, gauntlet max
  **0.131 / 0.522 ms** with 26.2 live threats.
- Browser at v0.1.15 on `MAINFRAME`: two pulse squares were visible by 10 s; minimap sat against the
  lower-left edge at the smaller size with both sentries marked. `git diff --check` clean.

**Limitations:** The minimap’s full-family coverage is verified by code path and the sentry browser run,
not a single screenshot containing every family at once. The lash art is inspected from code and the
shared arc geometry, not frame-by-frame. A stationary player still loses the ring around 25 s in the
opening; active dodging and the guard are required.

**Next:** Designer playtest of the two-shooter opening and the new lash feel, then tune opening cadence
and whether the sweep should hit one target or multiple per arc.

## 2026-10-29 — Session 18: programs, select screen and silhouettes (v0.1.16)

**Goal:** Turn the avatar into a roster. Probe.exe stays as tested; Wedge.exe and Fisher.exe bring new
weak attacks, dodge identities, heavies and signature bugs, selectable before every solo session. Each
program needed its own color and center symbol, and the health outline was freed from the shared circle.

**Changed:**
- `src/game/programs.ts` is the roster: id, name, role, kit note, accent, core glyph and signature bug.
  `PROGRAM_ID.PROBE/WEDGE/FISHER`, `programDef`, `clampProgram`. Selected program persists in
  `localStorage` (`deflect.program`) and drives `World`'s slot 0; bots stay Probe.
- Wedge.exe: three-shot string (**730 u/s**, 0.075 s apart, 0.52 s attack cooldown), bracket dodge
  (0.22 s, 86 reach, 54 half-width, 1 damage, 1040 shove, 300 recoil), charge plow (0.8 s charge, 0.5 s
  plow, pushes shots and enemies sideways, deflects while moving), rear-bracket bug.
- Fisher.exe: piercing spear (**780 u/s**, 2 damage, 0.7 s life, passes through bodies, pins near cover
  for 1.4 s), held line that deploys into a reflecting/snaring web (50 energy, 5 s cooldown, 380 max
  length, 1.8 s draw), lure beacon that pulls hostile aggro.
- Probe kit kept: five-shot burst, charged piercing beam, proximity mine. The mine is now a real trap:
  **0.55 s arm**, 2.8 s armed life, 52 trigger radius, 82 blast radius, 1 damage, 760 knockback, and it
  detonates from proximity or contact instead of only the old fuse.
- Program select is a new stage before training/gauntlet. Cards are procedural portraits: program hull,
  core glyph and accent ticks, so the roster grows by adding a `PROGRAMS` entry. Picking a program
  advances to the session stage; the old flow still auto-advances from arena to bots to tier.
- Offline identity now comes from the program: **Probe cyan `#2ee6ff` with `◎`**, **Wedge amber
  `#ffb63c` with `▣`**, **Fisher indigo `#8a7dff` with `≈`**. Match play keeps the slot palette and slot
  glyphs because the snapshot carries no program field. Wedge's old triangle read as a direction pointer,
  so his core is a plate instead.
- Bots and other non-local players no longer draw health outlines, heading arrows, energy arcs or the
  floating ammo/dash/skill/heavy/powerup icons. Their cores stay at a stable size instead of shrinking
  with damage. Action visuals (guard, lash, dash silhouette, heavy) still render.
- Removed the health pips above worms and the sparring drone; enemy and bot damage visuals are left for a
  later pass.
- Health outlines are program silhouettes via `pathProgramHealth` in `identity.ts`: Probe a circle,
  Wedge a diamond (`programId 1` = 4 sides, `+π/4` spin), Fisher a hexagon. Lost segments stay on screen
  as **0.25-alpha ghosts** instead of disappearing, so the avatar silhouette never breaks apart while the
  damage still reads. The same hull is used in the arena, the intro and the select portrait.
- Lock cycling on gamepad: hold `LT` and press `RB` for the next target or flick the right stick
  left/right for previous/next. Candidates use the same range and line-of-sight filter as acquisition,
  are ordered by angle around the player, skip the current target, and switch immediately without
  restarting `PLAYER.lockAcquire`. The stick is edge-latched (0.6 engage / 0.3 release) so a resting or
  drifting stick cannot spin through targets.
- The sparring drone no longer respawns when a second body is in the room. Bot training had been spawning
  it on the first update after construction, which also gave lock cycling a phantom invisible target.
- Enemy fire slowed for readable reflects: pulse sentry **430 → 365**, triplex **380 → 320**, flock
  **340 → 290**, homing missile **150 → 130**, sparring drone **520 → 450** u/s. Training bots, local
  bot-match bots and the gauntlet thrall also fire at **0.8×** (`BOLT.enemySpeedMult`), so their Probe
  bolts drop **860 → 688** u/s. Human shots in PvP stay at 860 u/s.
- Player-facing action names are now the plain words players expect: **RANGED ATTACK**, **MELEE
  ATTACK**, **GUARD**, **POWER ATTACK**, **SKILL**. The settings controls grid, the kit list and the
  README use them; internal identifiers (`swing`, `bolt`, `laser`, `bugKind`) are unchanged. Stale kit copy
  was fixed while renaming: the old random four-bug roll and the third-tap shield wave no longer appear.
- Top-level console options drop their `01`/`02`/`03` keys; the `>` cursor is the only selection marker
  on the hub.
- Version 0.1.16; service-worker cache bumped.

**Verification:**
- `scripts/.tmp-programs.ts`: all 19 kit checks passed — three-shard string, bracket dodge recoil
  (`kx=-267`), charge auto-fire and energy cost, plow damage and shot shove, spear pierce on two sentries,
  net deploy/reflect/pin (`pin=0.72`), lure deploy.
- `scripts/.tmp-lockcycle.ts`: all 10 checks passed — nearest acquisition, forward step, wrap, backward
  step, range exclusion, lock-required gating, drone suppression with bots, and sentry cycling.
- Browser with an injected virtual gamepad on `GRID ZERO` 1v3: `LT` acquired slot 3, `RB` stepped to
  slot 2, and a right-stick flick moved the lock again; no runtime errors. The stick pick exposed the
  drone respawn bug, now fixed and covered by the headless check above.
- `scripts/.tmp-enemyspeed.ts`: all 10 checks passed — hostile speeds match the new config, a training
  bot and a local bot-match bot fire at 688, the gauntlet thrall fires at 688, the human and an online
  guest stay at 860.
- `npm run build` clean; `npx tsc --noEmit` clean.
- Browser at v0.1.16 on `GRID ZERO` 1v3: four active players and no drone, practice phase running, no
  runtime errors after the indicator/health removal.
- Browser solo training as Wedge with health forced to 1: the ghost-segment path rendered for 0.6 s with
  no runtime errors.
- Browser at v0.1.16: hub shows three unnumbered options; program select renders all three cards and
  keeps Wedge selected across reload; Wedge training starts with `program: 1`, the world reaches
  `phase: practice`, and the console has no runtime errors.
- Browser settings/controls: the grid lists RANGED ATTACK, MELEE ATTACK / GUARD and POWER ATTACK / SKILL,
  the kit list explains tap versus hold, and neither panel overflows (grid 534/534, panel 580/580).
- `npm run bench`: 8P max **0.029 / 0.083 ms**, bot swarm **0.038 / 0.331 ms**, gauntlet max
  **0.127 / 0.526 ms** with 27.2 live threats.
- `git diff --check` clean.

**Limitations:** Online matches still identify by slot and every guest renders as Probe geometry on the
host; carrying programs over the wire is separate protocol work. Wedge and Fisher have headless kit
coverage but only Wedge has been driven in the browser this session, and their feel numbers (spear
cadence, net draw, plow duration) are first-pass. The select cards use the program glyph and hull but no
unique poster art beyond accent ticks.

**Next:** Play all three programs on a controller, especially Wedge's bracket recoil and Fisher's net
deploy/pin. Then decide whether the solo player's program should travel in the match snapshot before
local co-op work starts.

## 2026-10-29 — Session 19: Readiness column and ASCII program marks (v0.1.16)

**Goal:** Separate the local status marks so they stop running together, check them against all three
programs, make lost health segments visibly transparent rather than absent, and let program center marks
be text combos or small ASCII pictures.

**Changed:**
- The local readiness marks are one vertical column to the right of the avatar: **ranged ammo, dash,
  skill, power attack, active pickup**. It sits `PLAYER.radius + 36` from the avatar center (36 px beyond
  the hull) and uses 18 px rows, so the 15 px cooldown rings keep a 3 px gap and never touch the core or
  heading arrow.
  Bots, remote players and thralls still draw no column.
- Probe keeps five ammo dots, Wedge three and Fisher one. Dash remains two chevrons. Wedge's rear-bracket
  skill mark now has a split spine and his heavy plate has a faint fill, so the two small marks cannot be
  read as the same square. Fisher's lure mark is a center pulse with two open arcs (`(·)`), replacing the
  ring-plus-dot that collided with Probe's `◎` core glyph.
- Program center marks accept multi-character strings and multi-line ASCII art. `drawSymbol` strips blank
  padding lines, common leading indentation and trailing spaces once per symbol, then scales the picture
  to one glyph's footprint (`2.15r × 2.05r`). Single glyphs keep their original size. The line split is
  cached, so no per-frame splitting or allocation.
- Lost health segments moved from **0.25 to 0.42 alpha**. At 0.25 the ghosted slice read as a hole in the
  silhouette on dark arenas; 0.42 keeps the hull whole while the surviving segments still dominate.
- Updated the README, settings note and AGENTS renderer/identity notes to match the column and ghost alpha.

**Verification:**
- `npx tsc --noEmit`, `npm run build` and `git diff --check` clean.
- Browser, `GRID ZERO` training, 1v1 Rookie, one run each as Probe, Wedge and Fisher: the column renders
  on separate rows with the correct ammo count and program marks; no console errors or overlaps.
- Browser ASCII check: a temporary two-line bulldozer picture (``o|`|o:(`` over `_/ \_`) rendered centered
  in the Fisher select card and the in-world core, then was reverted to `≈`.
- Browser health check at 2 hp: the lost hull segment draws at 0.42 alpha, and the local silhouette stays
  readable instead of opening a gap.
- `npm run bench`: 8P max proj avg **0.035 / p99 0.125 ms**, bot swarm **0.039 / 0.290 ms**, gauntlet max
  **0.119 / 0.495 ms** with 27.2 live threats.

**Limitations:** Detailed ASCII art is legible in the select card but only broad strokes survive at the
roughly 23 px in-world core disc; the card is the place for a readable picture. A single glyph is not auto-scaled, so an
unusually wide single character can still crowd the core. Authoring stays in `PROGRAMS`; there is no
in-game glyph editor.

**Next:** Play all three programs with the new column and confirm the marks read during movement, then
consider a first-run legend that names the five rows once.

## 2026-10-29 — Session 20: Avatar scale and spawn clearance (v0.1.16)

**Goal:** Make the player character and bot avatars about 10% larger relative to the arena, enemies and
geometry without adding a second visual-only size system.

**Changed:**
- `PLAYER.radius` **20 → 22** (10%). Players, local bots, gauntlet thralls and online guests all share it,
  so hulls, collision, lock reticles and bot navigation clearance grew together. Enemy and training-drone
  radii are unchanged.
- The core glyph now scales with the avatar instead of using a fixed 10.2 radius: `PLAYER.radius * 0.51`
  keeps the same proportion as before (10.2 at radius 20, 11.22 at radius 22). The program select portrait
  stays a fixed poster size.
- The readiness column follows the radius, so it still sits 36 px beyond the hull rather than drifting
  inward as the body grows.
- Found and fixed a pre-existing bad spawn while checking the larger body: `MAINFRAME` spawn 3 was
  `(2330,1240)`, inside the southeast bar at `x 2320..2380`. It now mirrors spawn 2 at `(2440,1240)`.
  The overlap existed at radius 20 too; it was not caused by the scale change.
- Ability reaches (`swingReach`, `guardReach`, `punchReach`) are deliberately unchanged. Only the body
  scale changed; melee and shield ranges are still tuned in absolute units.

**Verification:**
- `npx tsc --noEmit`, `npm run build` and `git diff --check` clean.
- Spawn-clearance script: all 40 spawn points across the five arenas clear a 22-unit avatar; 0 overlaps
  after the `MAINFRAME` fix (1 overlap at both radius 20 and 22 before it).
- Nav route check at the larger clearance: 280/280 spawn-to-spawn routes found across the five arenas;
  no corridor was closed by the extra body size.
- Browser `GRID ZERO` 1v3 as Wedge: local hull, core glyph and Probe bot cores render at the larger
  radius; the readiness column still clears the hull and heading arrow; no console errors.
- `npm run bench`: 8P max-projectile avg **0.033 / p99 0.090 ms**, bot swarm **0.038 / 0.169 ms**, gauntlet max
  **0.150 / 0.562 ms** with 27.3 live threats.

**Limitations:** This is a true simulation size increase, not a draw-only scale, so the avatar is 2 units
wider and easier to hit. Melee and guard reach did not grow with the body, so their coverage relative to
the silhouette is slightly tighter. The training drone and enemies keep their old sizes.

**Next:** Play a match at the new size and check whether the lash and guard bands still read as attached
to the body, then decide if those reaches need a proportional pass.

## 2026-10-29 — Session 21: Readiness dock moves to the top-left corner (v0.1.16)

**Goal:** Get ammo, dash, skill, heavy and pickup readiness out of the avatar/enemy interaction space. The
side column had grown into the fight; the designer asked for a dedicated box in the top-left corner.

**Changed:**
- Removed the readiness column from `drawPlayer` and deleted the old world-space icon block.
- Added `drawReadiness` and `drawReadinessRing` in `render.ts`. The dock is a 182 × 44 screen-space panel
  at `(12, 12)`: near-opaque dark fill, player-color border and corner brackets, five 34 px cells split by
  faint dividers, no text.
- Cell order is **ammo, dash, skill, power attack, active pickup**. Skill and heavy keep their per-program
  marks; dash keeps two chevrons; ammo stays one dot per shot (Probe 5, Wedge 3, Fisher 1); the pickup cell
  shows the active icon and its remaining-time ring, or a faint placeholder when empty.
- Cooldown rings sit inside each cell at an 11 px radius. The dock is local-only and hides while the local
  avatar is dead. Health and energy remain on the avatar; no name plates, bars or labels were added.
- The panel fill is 0.94 alpha so projectiles and grid lines behind it do not bleed through the icons.

**Verification:**
- `npx tsc --noEmit`, `npm run build` and `git diff --check` clean.
- Browser `GRID ZERO` training with Probe, Wedge and Fisher: the dock renders all five cells in the
  top-left corner, with the correct ammo count and program marks; no console errors.
- Forced cooldown/pickup state (dash 1.1 s, skill 2.4 s, heavy 1.8 s, pickup 7.5 s) held through a
  screenshot: all four rings render inside their cells without touching the dividers or icons.
- The box no longer moves with the avatar, so the local hull and heading arrow are clear at every facing.

**Limitations:** The dock is icon-only; a first-time player has to learn the five cells. It occupies the
arena's top-left corner, so an avatar hiding behind it is partly covered. There is no settings toggle yet.

**Next:** Playtest the corner dock for readability during fights, then decide whether it needs a
first-run legend or a size/visibility option.

## 2026-10-29 — Session 22: Core marks fit their hulls; guard rays removed (v0.1.16)

**Goal:** Make every program's center mark clear at full and one-segment health without touching the
rotating hull, and remove the stray curved rays around the local avatar that added noise without a read.

**Changed:**
- Added `ProgramDef.coreScale`, applied only to the in-arena core mark. Probe **1.12** (up from 1.0),
  Wedge **0.88** (down from 1.0), Fisher **1.10** (up from 1.0). The select portrait keeps its poster
  size. `drawSymbol` gained an optional `fontScale`; single glyphs use it directly, while text combos and
  ASCII pictures still fit the same footprint.
- Raised the low-health core scale from `0.6 + 0.4 * coreHp` to `0.78 + 0.22 * coreHp`. At one segment the
  Wedge square was collapsing to 0.57× its normal font; the hull ghosts already carry the damage read,
  so the mark can stay legible.
- Removed the guard's radial spoke fan and the 0.2-alpha guard-cooldown ghost arc. The held shield is now
  one clean crescent: fill, rim, and the burn-down edge. There is no curved ray left beside the avatar
  when the shield is down or cooling.
- `drawSymbol` caches font strings by half-pixel size, so the new per-program sizes do not build a font
  string per glyph per frame.

**Verification:**
- Browser `GRID ZERO`, no bots, at 3 hp and 1 hp for Probe, Wedge and Fisher. Wedge is the tightest case:
  at 0.88 the plate clears the diamond's bright inner edge through the rotating hull; Probe's scan ring
  and Fisher's reel grew into their larger cores without touching the hull.
- Forced guard frames at `guardT = 1` and `guardCd = 0.25`: clean shield crescent, no spokes, no cooldown
  ghost. The local avatar is clean when the shield is not held.
- `npx tsc --noEmit` and `npm run build` clean. (The change is render/data only.)

**Limitations:** `coreScale` is a per-program value; a future multi-line ASCII mark is still fit to a
circular footprint, not to a non-circular hull, so every new program still needs the full/one-segment
screenshot check. Removing the cooldown ghost also removes the only visual for the brief guard lockout;
players now read availability from the shield/button timing.

**Next:** Check the three cores in a live bot match at 1 hp, especially a Wedge mirror, and decide whether
the guard lockout needs a readiness-dock ring instead of the removed ghost arc.

## 2026-10-29 — Session 23: Bot fire leads with its slowed bolt speed (v0.1.16)

**Goal:** Bot shots looked like they never hit or damaged a moving local player after enemy projectiles
were slowed. Confirm the collision path, then fix the aiming envelope if it was the cause.

**Cause:** The collision path was intact, but `BotBrain` still led and range-checked with the **human**
bolt speed while `spawnProjectile` fires bot-owned bolts at `BOLT.enemySpeedMult` (0.8×). Lead was 20%
short, and the SIEGE style held at 355 units while its bolt expired around 310. Long shots fell short
even when the player stood still.

**Changed:**
- `computeAim` now derives lead from `BOLT.speed * BOLT.enemySpeedMult` (old 860, new effective 688).
- `boltRange` uses the slowed speed, and `engageRange = min(style.range, boltRange - 24)` keeps every
  style inside the distance its bolt can reach. SIEGE closes from 355 to about 286 before holding.
- No damage, collision, iframe or guard rules changed. Bot aim error and tier cadence are unchanged.

**Verification:**
- Headless 1v1 DIGITAL bot vs a moving local: bot fire repeatedly drops 3→2→1→0; 30 s run had 24 damage
  events and 8 downs.
- Headless 1v3 DIGITAL bots (DUELIST/TRICKSTER/SIEGE) vs a moving local: 23/37/34 shots fired, 15 damage
  and 5 downs in 30 s; all three styles engaged.
- Browser bot match after the fix: local 3→0 hp, phase `roundover`; no console errors.
- `npx tsc --noEmit`, `npm run build` and `git diff --check` clean. `npm run bench`: 8P bot swarm
  **0.030 / 0.155 ms**, gauntlet max **0.145 / 0.536 ms** with 27.3 live threats.

**Limitations:** Bot lead and range still use Probe's bolt speed for every style; a future bot program with
Wedge's or Fisher's kit needs its own projectile speed. The fix makes DIGITAL bots land their lead at
range, so close-range digital pressure is higher than before. Holding GUARD still reflects every shot in
front; if bot fire deals no damage, check that the shield is not held.

**Next:** Play a moving 1v3 digital session and tune aim error/cadence if the corrected lead now feels too
accurate; then add per-kit bot speed if bots start using programs.

## 2026-10-29 — Session 24: Dead avatar field marker removed (v0.1.16)

**Goal:** Remove the dashed circle with an X left where a player died. It read as another interactable and
cluttered the playfield.

**Changed:**
- `drawPlayers` now simply skips a dead player. The old 0.32-alpha dashed ring and X are gone from every
  mode, including training respawns and bot matches.
- The death burst and the respawn timer remain the death read. No corpse body, ghost ring or marker was
  added in its place.
- The minimap already skipped dead players, so it needed no change.

**Verification:**
- Browser `GRID ZERO` training with the local and a bot forced dead: no ring, X or corpse silhouette is
  left at either position; the death burst and respawn timer still read.
- `npx tsc --noEmit`, `npm run build` and `git diff --check` clean.

**Limitations:** Death is now communicated only by the burst and the respawn delay; there is no body on the
floor to mark where a player fell. Round-end overlays still carry the result in matches.

**Next:** Check a training death with three bots active to confirm the empty spot does not look like a
missing entity while the respawn timer runs.

## 2026-10-29 — Session 25: Couch-scale console menus (v0.1.17)

**Goal:** Make the DOM menus readable and selectable from a couch on a TV, with a controller, instead of
at desk distance. The console screens still used 7–11px type from the monitor-first pass.

**Changed:**
- Main console options: 10px → `clamp(19px, 1.55vw, 30px)` (30px at 1080p), rows 7px padding → 48–62px
  hit areas, with a left focus bar in addition to the `>` cursor.
- ASCII logo: 6–13px → 7–28px; caret 18–36px → 26–48px. Stage labels/notes/status 7–9px → 15–21px at
  1080p; option keys and values 8px → 17px; program cards 7–9px → 15–20px; arena labels → 18px.
- Settings: tabs, row labels, kit list and notes 7–10px → 17–21px; content width 1080 → 1400 max so the
  controls page fits one 1080p screen. Lobby and overlay copy/buttons scaled to the same ladder.
- Removed the second, later `.btn` theme rule that forced 9px text and 7px tags over the new button scale.
- Sector blueprint canvas capped at `min(50vh, 540px)` with 16:9 preserved.
- Short windows (≤780px tall) get a compact title stage so 720p does not scroll or clip; safe centering
  prevents top clipping. Controller navigation scrolls the focused control into view and stage changes
  return the menu to the top. Pause/result overlays focus their first action when they open. Buttons and
  settings tabs draw a 2px cyan focus ring instead of the browser's orange default.
- Version 0.1.17; service-worker cache bumped.

**Verification:**
- Browser 1280×720: title, program select, session, arena, bot count, tier, gauntlet setup, lobby and
  sector blueprint all fit with no horizontal overflow.
- Browser 1920×1080: 30px main options; settings controls page fits one screen; feedback page fits with
  its preview panel; lobby player row and room code read at distance.
- Keyboard Enter through the staged solo flow lands focus on the next stage's primary option.
- `npx tsc --noEmit` and `npm run build` clean: 363.14 kB JS / 103.57 kB gzip, 40.44 kB CSS / 9.10 kB
  gzip.

**Limitations:** This was verified in a desktop browser at 720p and 1080p, not on a physical TV or
controller. Audio and feedback sliders are still not gamepad-adjustable; only buttons are in
`navItems()`. The sector archive below the map still needs manual scrolling because no control below the
tabs is focusable.

**Next:** A physical couch pass, then decide whether sliders need d-pad adjustment and whether the sector
archive needs a focusable row per node.

## 2026-10-29 — Session 26: Wedge health segments follow the corners (v0.1.17)

**Goal:** Wedge's three health segments read as arbitrary chopped chunks. Make them follow the corners
of the diamond instead.

**Cause:** The polygon path divided the square's perimeter into three equal slices. Any start phase cuts
through corners or leaves uneven arm lengths, so the pieces never read as corners. Three equal corner
pieces also cannot tile a four-corner loop.

**Changed:**
- Four-sided hulls now draw one bracket per fresh health segment at three vertices, with equal 34%-of-side
  arms, instead of sampling equal perimeter slices.
- Added `pathProgramFrame`: a thin rim around the square plus a short frame-weight tab at the fourth
  corner. It keeps the silhouette closed and four-cornered at full health without counting as a segment.
- The frame is drawn below the health strokes in `render.ts` and the program portrait. The fourth-corner
  tab is shorter (0.2 side) and thinner (1.4px) than a health bracket, so it cannot be mistaken for one.
- Probe's ring and Fisher's hex keep their existing equal slices; no other silhouette changed.

**Verification:**
- Browser program select at 1920×1080: Wedge shows three bright corner brackets around the diamond and
  the thin fourth-corner tab; no mid-side cut pieces. Probe and Fisher portraits are unchanged.
- Browser training as Wedge: the in-game 22px hull reads as three corner brackets plus the frame tab at
  full health, and the local avatar rendered without console errors.
- `npx tsc --noEmit` and `npm run build` clean: 364.10 kB JS / 103.86 kB gzip, 40.54 kB CSS / 9.14 kB
  gzip.

**Limitations:** The fourth corner is frame-only by design; it is not a health segment. At full health a
new player may briefly read the thin tab as a missing corner until they see a lost bracket ghost. The
segment order is fixed (vertices 0, 1, 2 fresh; vertex 3 frame), so damage always starts at vertex 2; that
is deterministic, not direction-aware.

**Next:** Watch a 2 hp and 1 hp Wedge in a live match and confirm the lost brackets read at 22px; if the
frame tab is too subtle, strengthen it before changing the segment count.

## 2026-10-29 — Session 27: Wedge's wall, lures for bots, solo sectors (v0.1.18)

**Goal:** Make Wedge's skill a static barrier instead of a shove, let Fisher's lure pull training bots, and
open the sector campaign from single player with an optional bot escort.

**Changed:**
- Wedge's skill is now `deployBarrier`: a bracket-shaped wall planted `WEDGE.wallOffset` = 58 units behind
  him, 92 units across, 12 thick, 4.6 s life, 9 s cooldown. It is solid to player bodies and reflects
  projectiles exactly like arena cover; the spear still dies on it and low-tier hostile fire disperses.
- The wall refuses to deploy inside cover or outside the playfield and refunds the energy and cooldown.
  Dodge still phases through it, and the bracket arms point at the owner so the open side reads.
- Removed the old rear-push branch and the shared `bashKind` field; the dodge bash is the only bracket.
- Local bots now treat a live lure as their focus inside `FISHER.lureRadius` unless the player is within
  four body radii, so they walk to the beacon and shoot it.
- `SINGLE PLAYER` gained `SECTORS`, which opens the same campaign archive with a `CAMPAIGN // COMPANIONS`
  row (no help or 1–3 bots, persisted as `deflect.campaignBots`). Back returns to the stage the archive
  was opened from.
- Sector blueprints were reworked to one design frame with fitted node positions and console-scale type;
  canvases now size their backing store from the CSS box at device pixel ratio (`fitCanvas`).
- Added `src/game/road.ts`: the five-system route plate for the between-level transition, with a device
  silhouette per sector and named crossings. It is parked, not mounted in a menu.
- Program glyphs accept Unicode dingbats/wingdings and are measured against a symbol font stack, so a wide
  mark scales down instead of crossing the health hull.
- Version 0.1.18; service-worker cache bumped.

**Verification:**
- Headless world probe: the wall deploys 58 units behind Wedge with a 92-unit span; a body walking into it
  stops at the wall face (x 640 → 610); a bolt at 800 u/s reflects off it (vx −800 → +800, one bounce).
- Headless bot probe: `nearestLureIndex` returns the beacon within 300 units, and a digital brain steers
  toward it (mx −0.10) instead of the distant player (mx +0.76) once the lure is gone.
- Browser at 1920×1080: solo SECTORS stage shows the companion row, 2 BOTS persists across a reload, and
  ESC returns to SINGLE PLAYER; the multiplayer archive hides the row and ESC returns to MULTIPLAYER.
- `npx tsc --noEmit` and `npm run build` clean.

**Limitations:** The wall and lure are local-only and never enter a snapshot, so a guest does not see
another player's wall. The wall blocks bodies and shots but gauntlet threats still walk through it, and bot
pathing uses the static grid rather than routing around a deployed wall. The solo companion choice is a
saved setup; no sector is playable yet. `road.ts` is unrouted until a between-level transition exists.

**Next:** Mount the route plate on the level transition, then decide wall behaviour for gauntlet threats
and for networked guests before the first playable sector.

## 2026-10-29 — Session 28: Freeform Fisher net, heavier Wedge shoves (v0.1.19)

**Goal:** Make Fisher's heavy a shape the player draws (curves and hard turns), have it trap bodies
instead of dealing damage, and give Wedge's bracket and plow real displacement with a slide-out.

**Changed:**
- Fisher's web is a polyline sampled while he moves (`FISHER.netPoints` 40 at `netPointSpacing` 11,
  `netMaxLength` 420). On release it gets two corner-preserving smoothing passes (`netCornerCos` 0.45):
  a gentle draw reads as a curve, a deliberate 90-degree turn keeps its corner. The stored points drive
  both collision and rendering, so the drawn shape is the hitbox.
- The web no longer shoves bodies out and deals no damage. Avatars, bots and thralls that touch it are
  held: `resolveNets` refreshes `Player.netPinT` (`FISHER.netHold` 0.12) every tick, and `stepPlayerMotion`
  zeroes their target speed, so a caught body stays stuck until `netLife` (6 s) expires. Worms, viruses,
  sentries and the training drone get the same treatment through their pin timers. A dash and Wedge's
  plow still phase through, because those moves already pass geometry.
- Shots still reflect off the nearest strand, so the same shape is a firebreak. Fisher's own body and
  shots are exempt.
- Wedge's bracket shove `WEDGE.bashKnockback` 1040 -> 2350 and plow `chargeKnockback` 1120 -> 2650. Under
  `PLAYER.knockDrag` 7 that slides a player about 355 units (was ~148) and the plow ~378, easing out over
  about a second so the momentum reads instead of snapping.
- Sliding bodies leave grey square dust. Avatars derive it from rendered motion; hostiles use their knock
  velocity on a 0.03 s cadence. New `PLAYER.slideDustSpeed` 470 and `slideDustSpacing` 12, plus
  `P_COLOR_DUST`; no packet field and no per-frame allocation were added.
- Version 0.1.19; service-worker cache bumped.

**Verification:**
- Headless probe: a bracket hit leaves the victim sliding 355.4 units over 60 ticks (the old 1040
  knockback moved it ~148); a drawn S-curve web stores 23 points, rounds the bend and keeps its hard
  corner; a body parked on the web reports `netPinT` 0.12 for 60 straight ticks with 0.00 drift, then is
  released once `netLife` expires.
- Browser at 127.0.0.1:5173: injected 26-point web renders as a smooth curved ribbon with a firm elbow;
  a shoved avatar leaves grey square puffs behind it; a web-held training drone drifts 0.97 units over
  0.7 s with `netPinT` refreshing.
- `npx tsc --noEmit` and `npm run build` clean.
- `npm run bench`: 8P max projectile 0.046 ms avg / 0.119 ms p99; gauntlet max 0.116 ms avg / 0.426 ms
  p99 with 27.3 live threats. Unchanged within noise.

**Limitations:** Nets, walls and lures stay local-only and never enter a snapshot, so a guest does not
see another player's web. Cascading-error blocks are not held because they spread block by block rather
than walk. A caught body can still fire and turn; shots that hit the web reflect back at it. The dust is
render-side, so a guest's screen shows dust for its own and nearby interpolated bodies, not host-side
particles.

**Next:** Playtest the 6 s hold with no damage and tune `FISHER.netLife` / `netCost` together, then decide
whether a trapped body should lose the ability to fire.

## 2026-10-29 — Session 29: Local multiplayer placeholder (v0.1.19)

**Goal:** Put local multiplayer on the title menu as a placeholder and spell out the build plan without
pretending the mode exists.

**Changed:**
- New top-level `LOCAL MULTIPLAYER` option between SINGLE PLAYER and MULTIPLAYER. It opens a read-only
  `LOCAL MULTIPLAYER // SETUP` stage that states the intent: one screen, one input per player, arena and
  gauntlet, controllers claiming slots on connect, manual device binding, split screen or dynamic zoom,
  bots in empty slots. The stage ends with `PLACEHOLDER // LOCAL PLAY IS NOT PLAYABLE YET.` and has only
  BACK.
- `MenuStage` gained `local`; Esc/BACK return to the hub and focus lands on BACK in the placeholder.
  `refreshTitleButtons` disables the new option with the rest while a session is starting.
- Version labels in the title header and the boot log now read 0.1.19; they had lagged at 0.1.18 after the
  previous bump.
- TODO.md gained a Local multiplayer scaffold (setup stage, input devices, simulation/view, verification)
  with dynamic zoom as the first view prototype and split screen conditional on `MAINFRAME` readability.
- AGENTS D11 records that the placeholder must not grow fake setup controls before the mode is built.

**Verification:**
- Browser at 1280×720 and 1280×1000: four title options at console scale, LOCAL MULTIPLAYER second; the
  stage shows its three intent notes plus the placeholder line; Esc returns to the hub with the cursor on
  SINGLE PLAYER.
- `npx tsc --noEmit` and `npm run build` clean.

**Limitations:** no local slot, second `InputFrame`, device arbitration, shared camera or local match
exists. The player cap and the split-screen versus dynamic-zoom choice are undecided and only recorded in
TODO.md.

**Next:** Prototype dynamic zoom with two local slots before authoring the setup screen.

## 2026-10-29 — Session 30: Mode-first solo flow and story save slots (v0.1.20)

**Goal:** Put gameplay mode before character select in solo, and make Sectors the story-mode entry with
new-game/resume slots, ready to wire once the campaign has its first playable level.

**Changed:**
- Solo order is now **mode → program → that mode's setup**. `SINGLE PLAYER` opens `TRAINING`, `GAUNTLET`
  or `SECTORS`; each leads to the program card grid, then training's arena/bot count/tier, gauntlet's
  arena/run setup, or the new story stage. Back walks the chain in reverse and the program stage label
  follows the chosen mode (`TRAINING // PROGRAM SELECT`, and so on).
- Sectors is now story mode: a `SECTORS // STORY MODE` stage with three local save slots and the
  companion row, moved out of the archive. An empty slot reads `NEW GAME`, a filled slot reads its sector
  name, program and `CONTINUE`; pressing one reports that the run is not wired yet instead of faking
  progress.
- Added `src/game/saves.ts`: three versioned local slots (program, sector, node, level, companions, play
  seconds, timestamp), defensive JSON load, `saveStoryProgress` for the after-level write and
  `clearStorySlot`. Nothing writes a save yet.
- The blueprint archive is multiplayer-only again: it lost the solo origin, the `SINGLE-PLAYER CAMPAIGN`
  label and the companion row, and back returns to `MULTIPLAYER`.
- Version 0.1.20; title header, boot log and service-worker cache bumped together.

**Verification:**
- Browser at 1280×720 and 1600×900: mode stage → program stage with the mode label → arena for training
  and gauntlet; `SECTORS` → program → story stage; Esc walks story → program → mode → hub; the archive
  still opens from `MULTIPLAYER` and returns there.
- Seeded `deflect.story.saves` probe: the slot rendered `SLOT 1  CINEVAULT  WEDGE.EXE // CONTINUE` and its
  press reported resume-not-wired; the seeded key was removed afterwards.
- `npx tsc --noEmit` and `npm run build` clean.

**Limitations:** there is no story run, sector loader or save write yet; the slots are display scaffolding
only. Program select still runs before a resume and its pick would be ignored in favour of the slot's
stored program. Slots are local and never enter a snapshot.

**Next:** Wire new game to load the first sector node with the picked program and companions, then write
the slot after every completed level.

## 2026-10-29 — Session 31: Multiplayer menu, hub-only logo (v0.1.21)

**Goal:** Put local multiplayer under Multiplayer instead of the title, cut the multiplayer screen down
to its two modes, move the blueprint off it, and give sub-stages the logo's space.

**Changed:**
- `LOCAL MULTIPLAYER` is no longer a title option. The hub is SINGLE PLAYER / MULTIPLAYER / SETTINGS.
- The Multiplayer screen is **ONLINE** and **LOCAL**. ONLINE holds `HOST GAME` and the room-code field
  with `JOIN GAME`; LOCAL lists `ARENA` and `GAUNTLET` and reports not-wired on press. The old campaign
  row and its note are gone.
- Public games are planned as an opt-in shared prefix on the 4-character room code; private rooms keep an
  unprefixed code and stay unlisted. No search UI was added.
- The blueprint archive moved to `SINGLE PLAYER > SECTORS > ROUTE BLUEPRINT`, is labelled
  `SECTORS // ROUTE BLUEPRINT`, and returns to the story stage. It is no longer reachable from Multiplayer.
- The ASCII logo header is hub-only: `showMenuStage` toggles `stage-open` on the title screen and CSS hides
  `.console-head` on sub-stages, so the reclaimed height goes to the program grid, save slots and notes.
- Slot keys widened to `8.5ch` with `white-space: nowrap`, so `SLOT 1` no longer wraps; a filled slot reads
  `CINEVAULT // LV 4` plus `<PROGRAM> // CONTINUE`.
- Version 0.1.21; title header, boot log and service-worker cache bumped together.

**Verification:**
- Browser 1600×900 DOM probe: the hub has three options; MULTIPLAYER has exactly ONLINE/LOCAL; ONLINE
  reads HOST GAME / JOIN GAME; LOCAL lists ARENA/GAUNTLET and sets a not-wired status; every back returns
  to the multiplayer mode screen.
- Seeded slot probe: the story stage rendered `SLOT 1  CINEVAULT // LV 4  WEDGE.EXE // CONTINUE`; the
  blueprint opened with `SECTORS // ROUTE BLUEPRINT` and Esc returned to the story stage. The seeded key
  was removed afterwards.
- Logo computed display: `block` on the hub, `none` on the multiplayer, online and story stages; the story
  stage fits at 1600×900 with the header hidden.
- `npx tsc --noEmit` and `npm run build` clean.

**Limitations:** local play is still a menu scaffold: no slots, devices, shared camera or local match. The
public-game prefix search is a written plan only. The blueprint remains a review tool with no playable
sector behind it.

**Next:** Build the local setup screen (player slots, device claim, per-slot program) before wiring ARENA
and GAUNTLET, and add the opt-in public prefix when room search is built.

## 2026-10-29 — Session 35: How to Play, menu trim, campaign naming (v0.1.23)

**Goal:** Give controls and kit explanations a home of their own, reduce the other menus to their options,
make the console type bigger, call the story mode "Campaign", and stop menus looking preselected.

**Changed:**
- `HOW TO PLAY` is a top-level title option between MULTIPLAYER and SETTINGS. It detects a connected
  gamepad and swaps between a gamepad table and a keyboard/mouse table, naming the detected pad in the
  panel header. It also carries a short rules section, the program roster generated from `PROGRAMS`, and
  six `CLIP SOON` tiles for RANGED ATTACK, MELEE ATTACK, GUARD, POWER ATTACK, SKILL and DASH.
- The `CONTROLS` settings tab is gone; settings tabs are `FEEDBACK`, `AUDIO`, `SYSTEM`, and the footer
  paragraphs under each panel were removed.
- Instructional notes were stripped from the solo, program, gauntlet, campaign, bot count, tier and local
  stages. The unreachable route-blueprint stage and its renderer were deleted; the blueprint data and
  `road.ts` stay parked per D13.
- Menu type: `.console-option` 30px/~58px rows to 32px/~72px; `.console-choice` 22px/46px to 24px/54px;
  short-viewport rows 44px to 50px; back rows 48px to 54px. Card grids and `nav-focus` keep a distinct
  ring so a selection and the cursor are not confused.
- A stage now opens with nothing highlighted. The first arrow/d-pad input lands on the first real option
  rather than BACK, and Enter/Space activate the current option without a focused button. Pointer hover
  is gated behind `body.pointer-live`, which only turns on after a real pointer move.
- `SECTORS` is `CAMPAIGN` in every menu, the README and the handoff doc; `SECTORS.md` was renamed
  `CAMPAIGN.md`. `src/game/sectors.ts` keeps the five sector records as internal campaign regions.
- Difficulty labels are `EASY`, `MEDIUM`, `HARD` and `IMPOSSIBLE`, stacked vertically easiest to hardest.
  `IMPOSSIBLE` is a real fourth tuning row (20 ms reaction, zero aim error, 0.26/0.42 s fire cadence,
  dodge 1.0) and is marked as untuned until a playtest.
- `SWEEP.EXE` is recorded as a parked program in TODO and D14: broom combo melee, dust-trail broom throw,
  a line-by-line screen-wide broom power attack and split brooms for the skill. It is not a selectable
  card yet.
- Version 0.1.23; title header, settings footer, boot log and service-worker cache bumped together.

**Verification:**
- Browser 1500×844: HOW TO PLAY shows the keyboard layout by default; after injecting a fake
  `navigator.getGamepads` entry it shows the gamepad table and pad name. Program cards and all six clip
  tiles render; the page scrolls to CLIPS.
- Browser 1280×720: hub has four options and no initial highlight; SINGLE PLAYER has TRAINING / GAUNTLET /
  CAMPAIGN with nothing highlighted. ArrowDown then Enter walked solo → program → arena → bot count →
  tier → training without a focused button.
- Campaign: slot 1 reads `CINEVAULT // LV 4` with `2 PLAYERS`; slots 2/3 start a new run, bot count opens
  player select, and a program returns to the slot stage with the new-run summary.
- Settings opens on FEEDBACK with only three tabs; training starts from EASY and from an injected
  IMPOSSIBLE selection with no console errors.
- `npx tsc --noEmit` and `npm run build` clean.

**Limitations:** clip tiles are placeholders with no media yet. Campaign slots are still display
scaffolding; there is no sector loader or save write. IMPOSSIBLE is selectable but its tuning is a first
pass. Sweep.exe is a written design only.

**Next:** Record the six short clips and mount them in How to Play, then build the local setup screen
before Sweep.exe's kit.

## 2026-10-29 — Session 36: Bot players and unattended self-play (v0.1.24)

**Goal:** Let bots drive real player slots so modes can be tested without a second human, and expose the
existing local bot match as a mode a player can actually start.

**Changed:**
- `SINGLE PLAYER` is now `TRAINING / VS BOTS / GAUNTLET / CAMPAIGN`. `VS BOTS` reuses program, arena, bot
  count and difficulty, but starts the round match (`startBotMatch`) instead of endless training.
- `World` takes an optional `botPrograms` slot list. Local bots take the programs the human did not pick
  and repeat only when there are more bots than unused programs; training and VS BOTS both pass it.
  Online opponents still default to Probe until the snapshot carries kits.
- `BotBrain` engagement ranges now scale by program (Wedge closes, Fisher holds farther). Bots also commit
  to their program heavy on a cooldown by holding the power button; a `heavyCount` field records commits
  for QA.
- `?autoplay=N` is a QA boot hook. It starts a VS BOTS match with AI in every slot, including slot 0, and
  auto-rematches 3.2 s after `matchend`, so a match keeps cycling unattended. It is not a menu option.
- Version 0.1.24; title header, settings footer, boot log and service-worker cache bumped together.

**Verification:**
- Menu: VS BOTS program stage reads `VS BOTS // PROGRAM SELECT`; arena and tier stages carry the mode and
  program; picking a difficulty starts the match.
- Wedge local vs two HARD bots: bots occupied slots 1 and 2 with programs Probe and Fisher, moved, fired,
  won a round, and took the idle local player from 3 HP to 2.
- `?autoplay=2`: three brains at slots 0–2, slot 0 won round 1, and round 2 reached countdown. Forcing
  `matchend` cleared the overlay and restarted at round 1, confirming the auto-rematch path.
- Heavy probe: all three brains reported `heavyCount 1` after about 15 s; a Probe beam was live
  (`laserT 0.3`). No console errors.
- `npx tsc --noEmit` and `npm run build` clean.

**Limitations:** bot skills are still opportunistic; Wedge does not place walls relative to incoming fire
and Fisher does not lead chases with the lure. Campaign companions are still not simulated. VS BOTS exposes
1–3 bots in the menu; autoplay accepts up to seven. Online play is unchanged and still has no bot slots.

**Next:** Wire the campaign companion count to these brains, then tune IMPOSSIBLE and give Wedge and
Fisher more deliberate skill use.

## 2026-10-29 — Session 37: bot self-play re-check and traversal plan

**Goal:** Re-verify the bot-player work after the runtime restart, and record the arena traversal plan
(bridges, transporter pads, lifts, then a mixed multiplayer arena) before building it.

**Changed:**
- No gameplay code changed this session. The bot work from Session 36 was intact on disk and is verified
  again below.
- `AGENTS.md` §3 no longer says local bots stay Probe; it now matches D6 and the `botPrograms` behaviour.
- `TODO.md` gains an **Arena traversal — bridges, pads and lifts** section with the open decisions, a
  build order for each element, the elevator render trick (concentric layers shrinking toward the lift
  center, with a fade fallback), and the mixed multiplayer arena that follows once each link works alone.
- `TODO.md` also records a placeholder for the upcoming **magic users** enemy family. No code or final
  silhouettes until the reference images and descriptions arrive; the notes cover data records, wave
  gating, effect/hitbox separation and bench coverage.

**Verification:**
- `npm run build` clean. `npm run bench`: 2P duel 0.016 / 0.067 ms, 8P bot swarm 0.046 / 0.198 ms,
  gauntlet max 0.097 / 0.336 ms with 27.3 live threats — all far inside the 4 ms budget.
- Menu: SINGLE PLAYER → VS BOTS → WEDGE.EXE → arena → `1 V 1` → difficulty shows EASY / MEDIUM / HARD /
  IMPOSSIBLE; EASY started a match with Wedge in slot 0 and a Probe bot in slot 1.
- `?autoplay=1` at HARD: Wedge vs Probe bots fought a full first-to-3 match (round 5, 3–2), both brains
  recorded a heavy (`heavyCount 1`), and the auto-rematch reset to round 1 with scores cleared. Console had
  only the boot and bot-match log lines.

**Next:** The bot work is a usable test bed now. The traversal section is design-only; start with one bridge,
one pad pair and the lift in a local test arena, then assemble the mixed arena. Campaign companions are
still the largest missing bot consumer.

## 2026-10-29 — Session 37 deployment

**Goal:** Ship the v0.1.24 alpha and confirm the GitHub Pages deployment, not just the local build.

**Changed:**
- Commit `cb273c7` carries the v0.1.11–v0.1.24 work: programs and identity, bot-driven player slots,
  gauntlet records, the couch menu pass, campaign slots, and the traversal / magic-user plans.
- This entry records the production deployment after the workflow and live page checks.

**Verification:**
- `npm run build` and `npm run bench` clean locally; the production preview smoke pass covered the hub,
  VS BOTS start, pause overlay, How to Play, Settings, gauntlet setup and campaign slots.
- GitHub Actions run `40980536181` completed successfully (build and deploy jobs).
- <https://spuds0588.github.io/DEFLECT/> serves v0.1.24 with `assets/index-BOezCEdl.js` and
  `assets/index-Dr6DFEYQ.css`. In the live page: four-option hub, How to Play, three-tab Settings,
  gauntlet setup and campaign slots rendered; a Wedge vs Probe HARD bot match started with no console
  errors. The active service-worker cache is `deflect-0.1.24-shell`.
- Workflow emitted only the existing Node 20 action deprecation warning; both jobs still passed.

**Next:** road-map items remain intentionally open: campaign node loader and saves, local multiplayer,
bridges/pads/lifts, magic users, Sweep.exe's kit, and IMPOSSIBLE tuning.

## 2026-10-29 — Session 38: deliberate bot skills and solo training (v0.1.25)

**Goal:** Improve the local bots while the designer tests v0.1.24 in production, and restore the
sparring-drone training path that the bot-count menu had hidden.

**Changed:**
- Wedge bots now answer an incoming bolt by turning away from the threat and planting the wall between
  the bolt and themselves. They also close a lane while reloading or at one health, then leave through
  it. The old opportunistic cast fired at close range facing the target, which put the wall behind him.
- Fisher bots drop the lure at 160–280 units, then step away so the decoy has room to pull a chaser.
  `nearestLureIndex` takes an optional owner so a bot no longer gets pulled toward its own beacon.
- Training exposes `NO BOTS` beside `1 V 1`–`1 V 3`; versus matches keep one to three opponents. A
  no-bots training run starts a one-player room and restores the sparring drone.
- Training and VS BOTS keep separate difficulty preferences. The old shared `deflect.botTier` key is
  migrated into both, then per-mode keys take over.
- Version 0.1.25; title header, settings footer, boot log and service-worker cache bumped together.
- README, AGENTS D6 and TODO updated; README also had stale tier names and the removed Controls settings
  tab corrected.

**Verification:**
- `npx tsc --noEmit` and `npm run build` clean.
- Bench: 2P 0.014 / 0.066 ms, 8P bot swarm 0.060 / 0.257 ms, gauntlet max 0.142 / 0.579 ms with 27.3
  live threats. All well under the 4 ms average budget.
- Browser dev: TRAINING shows `NO BOTS / 1 V 1 / 1 V 2 / 1 V 3`; selecting NO BOTS and EASY starts one
  active player, zero brains and a live drone at hp 4. VS BOTS shows only the three versus choices after
  switching modes in the same session.
- Per-mode preference: training EASY → VS BOTS HARD → back to training EASY. Storage settled at
  `deflect.botTier.training=rookie`, `deflect.botTier.bots=digital`.
- Browser `?autoplay=2`: a Fisher lure went live with 4.2 s life and a Wedge wall with 4.6 s life on
  CROSSROADS; the Fisher brain kept its opponent as the target while its own beacon was live.
- Production preview build v0.1.25: NO BOTS training reached the arena, VS BOTS reached a HARD match, and
  the console showed only the state logs.

**Next:** This batch is committed locally but intentionally not pushed while the v0.1.24 production test
is running. Tune wall/lure cadence after a live match, then IMPOSSIBLE. Campaign companions still need the
sector loader.

## 2026-10-29 — Session 39: multi-deck traversal arena (v0.1.26)

**Goal:** build the level-traversal pieces the campaign needs — bridges, elevator plates and paired
teleporter pads — link them into one playable arena, and verify every route through it.

**Changes:**
- `ArenaDef` gained an optional `traverse` record: chasms, bridge decks, upper-deck treatment, paired
  pads and linked lifts. `TRANSIT` (sixth arena) is two decks over a split service trench: one central
  bridge, paired pads on the west, a two-stop lift on the east. The trench blocks bodies but not shots;
  a dodge still phases it.
- `arenaSolids()` is the shared body-collision list (cover + chasms). Player movement, guest prediction,
  bot pathing, drone/worm/virus/sentry/error placement and powerups use it; projectiles, lasers and
  firewall beams keep using `pillars` so they cross the gap.
- Bots now force an A* route when the straight walk crosses a floor gap, and a bot pinned to the outer
  ring retreats toward the bridge instead of the arena's literal centre (which is trench on `TRANSIT`).
  Verified with a live digital brain walking from the lower deck to the upper deck.
- Pads and lifts arm on a still body: pad dwell 0.32 s (old 0.45) and ride 0.36 s (old 0.5), lift dwell
  0.55 s and ride 1.55 s. A ride cancels attacks, locks input and ignores damage, and the arrival plate
  stays latched until the body steps off so it cannot bounce back. The pad ride was made faster and is
  now an unload: hull, then core, then glyph come apart at the source, the body swaps at the midpoint,
  and the layers rebuild at the mate. The lift keeps the shrinking-deck screen transition.
- Renderer: open trench with a lit lip, a railed bridge with traffic ticks, ringed pad plates with a
  mate arrow, lift plates whose chevrons point at the linked deck, and pad/lift markers on the minimap.
  The arena picker preview draws the same deck layout.
- Version 0.1.26; title header, settings footer, boot log and service-worker cache bumped together.

**Verification:**
- `npx tsc --noEmit` and `npm run build` clean.
- Headless traversal probe: trench stops a walk at the lip (y 782), bridge walk reaches the upper deck,
  pad dwell/ride/latch lands on the mate and does not ping-pong, lift lands on the upper plate, a moving
  body ignores a pad, A* has 107 waypoints with every one on walkable floor and crosses on the bridge,
  and a bot crosses under its own brain. All pass.
- Browser dev, TRANSIT: arena card is selectable as `06 TRANSIT`; a pad ride from (330,930) arrived at
  (330,330); a lift ride from (1980,950) arrived at (1980,320); holding `W` walked the bridge from
  (1160,900) to (1160,70); a VS BOTS match ran and a gauntlet run spawned sentries with no threat inside
  the trench; no console errors.
- Visual: bridge/deck/pads/lift screenshots at 1600×900, plus the pad unload and reload and the lift
  transition. The lift chevron direction was corrected after the first look.
- Pad staging checked frame by frame with the ride pinned: at the source the hull is gone first while
  the core and glyph still hold, and at the mate the glyph returns alone before the core and then the
  hull rebuild. The scan ring and slice line track both halves.
- Bots on TRANSIT: `?autoplay=2` ran a HARD-bot match to round 2 with a bot round win, two live brains
  pathing and firing, and no console errors or vaulting into the trench. The headless probe still has
  the digital brain walking itself across the bridge.

**Deployed:** pushed `main` to `f8450c4`; the Pages workflow completed successfully and production serves
v0.1.26 with the new service-worker cache. The built bundle loaded with `[DEFLECT-INIT] Build 0.1.26 ready`.

**Next:** party rules for local multiplayer, threat traversal (the pad is also the escape and contagion
route) and the campaign node loader. See TODO.md § Arena traversal.

## 2026-10-29 — SWEEP.EXE, the fourth program

**Goal:** stand up the parked fourth program and mark the build the designer is testing.

**Identity.** `SWEEP.EXE` joins `PROGRAMS` as id 3, role `SHOVE`, lime `#b8ff3a`. The hull is
**eight-sided**: a pentagon's three equal perimeter slices cut its corners and read as arbitrary chunks,
the same problem Wedge's old diamond had. Eight sides give three clean arcs and a closed silhouette at
one health. The core mark is `✦`, a clean sparkle. The only literal broom in Unicode is `🧹`, which is a
colour emoji: it ignores `fillStyle`, so tinting it would put a bitmap in a single-hue silhouette. The
kit carries the broom; the core says "clean". The program card gets a broom-fan accent instead of the
generic ticks.

**Glyph support.** `drawSymbol` now gives wide multi-line ASCII marks a tighter row gap (0.8), a narrower
width budget (1.78r instead of 2.15r) and an optional `glyphRadius` on `ProgramDef` so the mark can use
the space between the core disc and the hull. `HOW TO PLAY` renders multi-line marks with `white-space:
pre`. This was built while testing a two-line push-broom mark; it stays available for future ASCII
programs even though Sweep's shipped mark is a single glyph.

**Kit.** All numbers are in the new `SWEEP` block.

- Melee is a three-hit broom combo, not the shared lash: kinds `1`/`2` push along opposite diagonals for
  1 damage and `SWEEP.comboKnockback` (760), the third is a forward slab at `SWEEP.bigReach` (96) for 2
  damage and `SWEEP.bigKnockback` (1150). Facing locks for every hit and the hold remains the guard. The
  big hit reflects shots along the full 96-unit shaft instead of `PLAYER.swingReach`.
- Ranged is projectile type `6`, a broom at `SWEEP.shotSpeed` (760) with a square dust trail, 2 damage,
  and `SWEEP.shotKnockback` (860) so it stops on the body and slides it.
- Power builds a giant broom line by line for 0.85 s, then sweeps from behind the cast point to
  `+SWEEP.powerReach` over 0.9 s. The live broom is one wide line (`powerBand` 230 half-height), hits each
  body once for 2 and shoves it 1450. Cooldown (6 s) starts when the sweep ends.
- Skill starts two brooms together 58 units in front and splits them to `fanReach` (250) over 0.42 s,
  hitting each body once for 1 and shoving it outward at 1100. Cover still cuts the contact.
- Bots use the kit: the generic heavy hold builds the sweep, and a dedicated branch taps the split brooms
  at 50–210 units so bot matches exercise the lane clear.
- Readiness dock: one broom round, the heavy broom mark with its cooldown ring, and a two-arrow
  split-broom skill mark. Online is unchanged; matches still run Probe because the snapshot carries no
  kits.

**Test label.** The title hub reads `v0.1.27 · IN TESTING` in a lime tag. Production build, service
worker cache and package version are all 0.1.27.

**Verification.**

- Headless probe: type `6` does 2 damage and kx +860; combo reports kinds `1, 2, 3` and damages `1, 1, 2`
  with diagonal shoves then a forward shove; the power fires and does 2 with kx +570; the fan hit does 1
  and pushes out along the tangent; a bot with Sweep fires type `6`.
- Browser 1920×1080: card, full-health and one-segment core clearance, broom swing, giant sweep, split
  brooms and the thrown broom with its dust all render; no console errors.
- `?autoplay=2`: a Sweep bot in slot 0 used the fan (`fanT 0.39`) and broom projectiles across rounds;
  the console log was clean.
- Gauntlet stress script: 110 s of practice reached wave 4 with 15 kills, both heavy and skill live,
  threats damaged, no exceptions.
- `npx tsc --noEmit`, `npm run build`, `npm run bench`: clean. Bench this pass: 2P 0.027/0.105, 8P stress
  0.059/0.174, bot swarm 0.096/0.325, gauntlet 0.215/0.697 with 27.3 threats. Recorded in TODO
  §Performance.

**Next:** playtest the third hit and the power band, decide whether kits should travel online (snapshot
change), and consider a vector broom for the core if the sparkle is too abstract.

## 2026-10-29 — Sweep.exe pass 2: character brooms, vertical strokes

**Goal:** take Sweep's brooms from vector shapes to the ASCII mark the designer asked for, fix the heavy
so it commits and does not drag enemies toward the player, and make the melee read as a broom instead of
a lash.

**Changes**
- Brooms are now drawn with real characters: a binder row (`/=====\`) over three dense bristle rows,
  cached per size and stretched to span the head. The melee, thrown broom, split brooms and heavy all
  share the shape; the old shaft-plus-fan polygon is gone.
- Core mark stays `✷`. The two-row ASCII broom was tried in the core and turned to mush at 11px, so the
  star stays; the kit carries the broom.
- Melee: upright head in front of the avatar, bristles at the bottom, stroking straight up and down
  instead of riding the 180-degree arc. Hit one strokes down, hit two back up, the big hit spans the lane.
- Heavy: generated in front of the player (`powerFront` 110) and strokes up (`powerRise` 281) then back
  down the same lane in `powerDuration` 0.9s, carrying bodies with the stroke. It used to drop from the
  top of the view, which pushed enemies toward the player. Width is 80% of the view (`powerSpan` 400)
  and contact is a moving band with cover still cutting line of sight.
- Heavy now always commits: `fireBroomSweep` no longer refuses on an energy check after the charge (the
  start already pays for it), and a release on the completion tick fires instead of cancelling.
- Core star restored, `glyphRadius` removed from Sweep.

**Verification:** `npx tsc --noEmit` clean; headless script confirmed the heavy fires, hits for 2, carries
the target up then down, and leaves a body outside the lane untouched; the skill still damages. Visual
pass in the dev arena for the melee pose, the heavy mid-stroke and the star core.

**Next:** playtest the stroke speeds and the carry feel; decide whether the thrown broom should also use
the character head at projectile scale.

## 2026-10-29 — Sweep.exe pass 3: head-only throw, wider skill, deeper return

**Goal:** finish the broom feel notes: no tails on the thrown or split brooms, wider and slower
projectiles that die on walls, and a power stroke that reaches twice as far below the player.

**Changes**
- Ranged broom: `shotSpeed` 760 → 500, `shotRadius` 8 → 15, `shotTtl` 0.82 → 0.9, and it now dies on
  arena bounds, pillars and deployed walls like Fisher's spear instead of bouncing. The projectile draws
  only the upright head (no handle, no motion trail) and its shared trail buffer is skipped entirely.
- Skill brooms: `fanLife` 0.42 → 0.62 (slower split), `fanWidth` 30 → 40, wider heads, upright with the
  bristles down, and the dust line in the lane is gone.
- Power: the return stroke now travels twice the rise (`powerRise` 281 up, 562 down), so it clears bodies
  above and below the player instead of ending back on the start line.
- Added a short puff of grey square dust behind each thrown broom (`emitBroomDust`), the same particle the
  knockback slide kicks up, so the throw reads as motion without a line trail or a handle.
- Docs: D14 updated with the new numbers and the no-bounce rule.

**Verification:** `npx tsc --noEmit` clean; headless check confirmed the thrown broom spawns at speed 500
and radius 15, is gone after hitting a pillar with zero bounces, and a body 253 units below the start line
takes the return stroke. Visual pass in the dev arena: three thrown heads with no tail, upright comb.

**Next:** playtest the slower throw range and the deeper return; decide whether the thrown broom needs a
slightly longer TTL to compensate for the lower speed.

## 2026-10-29 — Thrown broom pushback

**Goal:** the thrown broom should move a body it hits.

**Changes**
- `SWEEP.shotKnockback` 860 → 1200. Measured slide on a standing target went from 130 to 181.5 units
  (about eight body radii), which reads as a real shove without throwing the target across the arena.

**Verification:** headless measurement, `npx tsc --noEmit` clean, build and bench unchanged in profile
(8P max proj 0.082/0.234, gauntlet 0.246/0.915).

**Next:** confirm on a real pad that the push reads at gameplay zoom, and decide whether the melee combo
needs the same treatment.
