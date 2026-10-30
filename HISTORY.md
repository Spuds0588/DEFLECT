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

## 2026-10-29 — Toxic.exe, mode-free identity, bot hulls and the aimable jet

**Goal:** stand up the fifth program and fix the designer's notes: program identity must survive every
local mode, bots need the player hull read, Toxic's power should be an aimed stream rather than a cone,
and his skill should read as the death burst with circles.

**Changes**
- Identity is program-based in every local mode. `RenderState.online` replaces the old `mode === 'match'`
  branch, so colour, hull and glyph come from the program in training, VS BOTS and gauntlet; only a
  networked guest still falls back to slot identity.
- Local bots draw the same program hull, three health segments and glow as the local avatar, with their
  own health, and no heading arrow, energy arc or readiness column. Score pips follow program colour.
- Toxic.exe added: needle (type 7), venom ticks, 360-degree spray, and a rooted aimable jet. The star hull
  needed a real segment trim (0.05 → 0.5 of an edge) before the three pieces read at full health.
- The spray is emitted as particle circles (kind 5) for the whole cloud life, matching the death shard
  burst but round and green. The jet is clipped by cover and ticks venom every 0.2 s.
- Bots gained a close-range spray branch; the generic heavy hold builds the jet.
- Menu selections use one outline again. The focused card owns the bright border; a saved
  program or arena keeps a small dot after its name instead of a second box, and the
  sector tabs lost their bright selected border. Bumped to v0.1.31 for the production check.

**Verification:** `npx tsc --noEmit` clean; headless checks covered needle → venom → spray → jet, rooting
(0 units moved), 2.4 rad/s aim, damage ticks, and cover. Browser checks at 1920×1080 confirmed five
program cards, program identity in training and VS BOTS, a one-health bot with one lit arc and two
ghosts, the narrow jet stopping at cover, and the circle spray.

**Next:** playtest the jet's turn rate and duration, decide whether gauntlet threats should carry venom,
and give the jet a wind-up tell.

## 2026-10-30 — Kaboom.exe and the carpet spray

**Goal:** stand up the sixth program, then make the five-bomb power read as one continuous string or spray
instead of five shells appearing on the same frame.

**Changes**
- `KABOOM.EXE` added (id 5, `BOMBER`) with `PROGRAM_COLORS.kaboom` `#ff5a3d`, a square hull made of four
  inward triangles and a bomb core at `coreScale 0.98`. Three triangles are health segments, the fourth is
  frame only, the same four-corner compromise Wedge uses.
- The core and every shell draw the Wingdings bomb (`M`) when the family is genuinely installed. On this
  Linux host it is not, so a vector bomb is drawn instead. `document.fonts.check('16px Wingdings')` returns
  true even when the family is missing, so `hasSymbolFont` now also compares `M`, `Z` and the PUA bomb
  advance against a definitely-missing family and falls back when they match.
- Ranged: slow shell (type 8, 250 u/s, 1.9 s fuse) that does no direct-hit damage. It detonates on a body,
  cover, or fuse end for a 52-radius blast, 1 damage and a 520 shove. `explodeMine` was split into a shared
  `explodeBlast`, so mines and bombs use the same cover-aware damage path for players, the drone and all
  gauntlet threats.
- Skill: a heavy lobbed shell (type 9, 0.62 s arc, 300 range) that ignores pillars in flight and detonates
  on landing or contact for 2 damage in a 116 blast.
- Power: five lobbed shells in a shallow fan (`clusterSpread` 0.24 rad). Each shell waits `clusterStagger`
  0.07 s before its fuse starts, carried in the projectile's `grace` field, so the row streams out left to
  right over 0.28 s. Five 66-radius, 1-damage blasts land about 150 units wide.
- Bombs are not shots: the swing, guard, shield wave, Wedge bash/plow and Fisher net all skip types 8/9.
  Before that rule, a caught bomb would have been rewritten to a bolt by the shared `type >= 3` branch.
- Readiness dock: Kaboom is a single-shot ammo cell, the skill is a fused bomb, the heavy is a three-shell
  row, and the heavy cooldown uses `clusterCooldown`.
- Kaboom bots lob at 90 to `lobRange + 60`; the generic heavy hold builds the carpet. Bumped to v0.1.32.

**Verification:** `npx tsc --noEmit` and `npm run build` clean. Headless probe covered shell spawn/radius/
speed, two bodies in one blast, blast slide, self-immunity, lob arc and landing damage, five-shell power,
cooldown, three-body carpet and cover cutting the blast. `?autoplay=3` caught all five type-9 shells alive
together on slot 0 with 40+ units between them, confirming the stagger. Browser at 1920×1080 confirmed the
program card, hull, vector bomb mark and a shell in flight, with no console errors. `npm run bench` clean.

**Next:** playtest the 0.07 s stagger and 150-unit row; check the Wingdings path on a host that has the
font; decide whether bombs should ever be networked.

## 2026-10-30 — Kaboom hull points outward

**Goal:** correct Kaboom's silhouette after the first production pass. The square of inward triangles read
as four pieces pointing at the bomb; the health segments should point out and sit 120° apart.

**Changes**
- `pathProgramHealth` for program 5 now draws three isosceles triangles, one per health segment, each apex
  on the hull radius and each base at `0.46 * r` with a 0.95 rad half-angle. Their points face outward and
  the set reads as a larger triangle made of three smaller ones. The bases sit behind the core disc
  (`0.58 * r`), so only the points clear the bomb.
- `pathProgramFrame` draws nothing for Kaboom. The old fourth triangle was frame only because a square
  cannot split into three clean pieces; with three triangles there is nothing left over, so no rim and no
  tab are needed.
- `programHullSides(5)` is 3, matching the three blades; the custom path still lives in
  `pathProgramHealth`, so the generic polygon slicer is untouched.
- Bumped to v0.1.33 and refreshed the service worker cache name so an installed PWA picks up the new
  shell instead of the cached index.

**Verification:** `npx tsc --noEmit` and `npm run build` clean. Browser at 1920×1080: the select portrait
shows the triangle of triangles, and the in-arena avatar keeps the bomb clear of every bright edge. A
strip of the hull at 3, 2, 1 and 0 segments confirmed each triangle ghosts independently. `npm run bench`
reported the same sim and bot budgets, no regression.

**Next:** playtest the spinning hull at one segment to confirm the damage read, then tune the base radius
if the points feel too short at avatar size.

## 2026-10-30 — First campaign node: BUILD ROOT

**Goal:** make the campaign's slot flow lead somewhere. The first level should open with a training-bot
drill, warn that the system has been breached, then populate the arena with real threats.

**Changes**
- Added `src/game/campaign.ts`: the first authored node (BUILD ROOT, LOCALHOST, CROSSROADS) with its
  sector/node ids and arena blockout. Level identity is data; the script is in `World`.
- Campaign runs on the gauntlet simulation (`World('gauntlet', ..., campaign = true)`) so threats, pickups,
  infection and the thrall stay one system. The mode string deliberately stays `gauntlet`; the new
  `CampaignPhase` (`drill`, `breach`, `assault`, `cleared`, `failed`) is the only fork.
- Drill: 18 s against the run's 0–3 bots, driven by the same `BotBrain` as training. Death on either side
  respawns on the training timer, so the warm-up cannot end early. A NO BOTS run still fields one
  instructor so the drill has a partner.
- Breach: at 18 s the drill squad de-rezzes, live projectiles clear, and the local player is healed and
  given a short shield. A 3.2 s `SYSTEM BREACH` banner carries the story beat; no threats exist yet.
- Assault: the opening sentry pack lands on the breach beat. Worms arrive six seconds later, then a new
  pack every 14 s. Campaign waves start at 3 and step every 14 s, so viruses arrive around 40 s. Ten
  threat deletes clear the node; one death in the assault fails it.
- Renderer: campaign banners (SPARRING DRILL / SYSTEM BREACH / NODE CLEARED / SIGNAL LOST) with a soft
  backing plate so the beat reads over bright cover, `BREACH WAVE N` instead of the sandbox wave label,
  and a bottom strip with one pip per threat delete.
- Main: campaign session lifecycle, save on clear, fail/retry, CONTINUE back to the slot stage, resume from
  a filled slot, leave overlay text. A cleared slot is saved with the run program, players, bots and
  seconds; nothing writes mid-level.
- Bumped to v0.1.34 and refreshed the service worker cache.

**Verification:** headless probe covered the full script: three active bodies and zero threats in the
drill, the breach leaving only slot 0 alive and healed, the assault queuing two sentries at wave 3 and
reaching 2 sentries + 1 worm by 20 s, a forced 10-kill clear freezing the node, and an idle player failing
in the assault. Browser at 1920×1080 walked the real menu: slot 1 → 2 bots → KABOOM.EXE, drill with two
sparring bots, SYSTEM BREACH with the squad gone, sentries and a worm in the assault, a 4/10 fail overlay,
a forced clear that saved the slot, the saved `LOCALHOST // LV 1` readout, and resume restoring Kaboom plus
two drill bots. `npx tsc --noEmit`, `npm run build` and `npm run bench` clean.

**Next:** add the next node and the between-level route beat; add team rules before bot companions can
fight beside the player instead of serving as the drill squad; playtest drill length and the 10-kill target.

## 2026-10-30 — Drill squad in reach, camera framing (v0.1.35)

**Goal:** the campaign drill should start as a spar instead of a walk, and the follow camera should stop
losing nearby enemies and players at the edge of the view.

**Changes:**
- World: the campaign drill squad now spawns on an arc `CAMPAIGN.drillRing` (250) in front of the player,
  spread by `drillSpread` (0.72 rad), instead of taking the arena spawn ring. Drill knockdowns respawn on
  the same arc, and the player keeps the gauntlet spawn (spawn ring slot 0 is overwritten with it) so a
  drill death puts them back inside the spar rather than across the map.
- World: `drillSlotPos` steps outward (250/308/366), then inward (160/110/75), then takes the nearest
  clear arena spawn; every candidate must clear cover and keep `PLAYER.radius * 2.2` from the player.
  Verified across all six arenas with 1–3 bots.
- Renderer: `updateCamera` now pulls the frame toward nearby live bodies — other players, the training
  drone, worms, viruses, sentries and cascading-error blocks inside `CAMERA.focusRange` (640). The pull is
  a distance-weighted mean offset capped at `CAMERA.maxBias` (0.5) and `CAMERA.groupPull` (1.7), so a
  threat behind the player opens the view while a surround cancels out. The anchor (local avatar) is then
  clamped to the middle band `CAMERA.edgeMargin` (0.3), unless an arena bound pins the camera first.
  Follow rate dropped from a flat 9 to `CAMERA.follow` (6.2) so the lead reads as a pan, not a snap.
- Config: new `CAMERA` block. No dynamic zoom: `SWEEP` heavy numbers and the sentry pack window are built
  from the fixed `CAMERA_ZOOM`, so a zooming camera would need those moved first. Recorded in AGENTS.md.
- Bumped to v0.1.35 and refreshed the service worker cache. `package-lock.json` had been stuck at 0.1.27;
  it now matches `package.json`.

**Verification:** headless probe — 1–3 drill bots sit 250 units from the player and clear of cover on
CROSSROADS, GRID ZERO, THE RING, SWITCHBACK, MAINFRAME and TRANSIT; the campaign timeline still runs
drill 18.0 s → breach 21.4 s → assault, a seek-and-fire player reaches 10 kills and the node clears, and an
idle player fails in the assault at 36 s. Browser at 1440×900: drill with both bots in the fight, the
SPARRING DRILL and BREACH WAVE banners, and a staged sentry 350 units to the player's right pulled the
camera so the player sat at 0.39 of the view and the sentry at 0.90 (no pull would have put the player at
0.50 and the sentry at 1.00, off-screen). `npx tsc --noEmit`, `npm run build` and `npm run bench` clean.

**Next:** playtest the pull in 1v1, 1v3 and gauntlet and tune `focusRange`/`maxBias`; dynamic zoom stays
deferred behind the fixed-zoom kit numbers; add the next campaign node.

## 2026-10-30 — Split-screen camera plumbing, death spectate, Kaboom clearance

**Goal:** give the local camera more to work with as bridges and pads spread a match across an arena, make a
death readable by following what killed you, and finish Kaboom's hull so its health blades never cross the
bomb mark.

**Changes:**
- Renderer: the single camera became up to four `CameraView`s. `Renderer.setLocalSlots([...])` lays out one
  full-screen pane, two side-by-side panes, or a 2x2 grid for three or four local slots. Each pane owns its
  camera position, zoom, lock reticle, readiness dock, minimap and lift overlay; panes clip at their
  viewport. `?split=N` is a QA-only boot hook (no menus, no snapshot fields).
- Config: new `CAMERA.zoomMin` (0.88) and `CAMERA.zoomMax` (1.03) multipliers around `CAMERA_ZOOM`,
  `CAMERA.zoomFollow` (3.4/s), `CAMERA.splitZoom` (0.8) and `CAMERA.splitGap` (4). The old camera had no
  dynamic zoom (fixed `CAMERA_ZOOM` 1.28). A tight focus group now sits at 1.03x the base; a group spread
  across `focusRange` pulls to 0.88x. The previous fixed zoom stays the base, so the old framing is the
  center of the new range.
- Split rendering: world effect emissions (slide dust, broom dust, toxic burst, projectile trails, dash
  trails) run once per frame; only their draw passes run per pane, so a split match does not double the
  particle count.
- Death spectate: `Player` gains `killerKind`/`killerId`; `damagePlayer` records the attacker family and
  index. Hostile projectiles carry `srcKind`/`srcId` (sentry index, or the drone). Worm, cascading-error and
  firewall contact pass their pool index. While a local slot is dead the camera follows a surviving
  campaign drill partner first, then the killing body, then the nearest living player; respawn and pad
  swaps snap rather than pan across the arena.
- Kaboom hull: base radius 0.46r → 0.72r, half-base 0.95 → 0.56 rad, and `coreScale` 0.98 → 0.86. The
  three blades are now short fins on the rim instead of wedges tucked behind the core; the bomb mark has
  clear air around it. Recorded the general rule in AGENTS D4: health segments must stay outside the 0.6r
  core disc at full and one-segment health.
- Bumped to v0.1.36 and refreshed the service worker cache.

**Verification:** headless probe — Kaboom's fins clear the core disc by 1.33 units at full and one-segment
health (glow stroke included), the center mark radius is 9.65 against a 13.21 core disc, and Kaboom still
draws no frame. A sentry bolt kills through attribution kind 4 / id 2, and a worm blow records kind 2 / id
3. Browser at 1280x800: 2-pane and 4-pane layouts render with per-pane docks, minimaps and independent
cameras; killing the training player with a drone-sourced blow moved the camera from x=48 to 893 then 936
while the drone target was 904 then 945; respawn snapped back to the arena-left clamp at 48; a staged drill
ally was preferred over the drone killer, and the same world switched to the drone when the campaign phase
moved to assault. `npx tsc --noEmit`, `npm run build` and `npm run bench` clean.

**Next:** local input slots and the same-screen menu flow are still missing, so split screen is proven
plumbing rather than playable local multiplayer. Tune `zoomMin`/`zoomMax` from the production build; move
the heavy/sentry numbers only if the screen coverage at the new range reads wrong in play.

## 2026-10-30 — Fit-first split camera, shared HUD, rig director, layout slow motion

**Goal:** make local co-op framing follow the fight instead of a fixed pane count. Everyone should share one
screen while the camera can still hold them; only the players who no longer fit should peel off into their
own pane. The split also needed boundaries you can see, one shared map, corner player indicators, a camera
override framework for boss/narrative beats, and a moment of slow motion so a split or merge cannot get a
player shot while their screen moves.

**Changes:**
- Camera grouping replaced the per-local-slot split. `layoutViews` now measures the living local group's
  bounding box and keeps one full-screen view while it fits at `CAMERA.sharedZoomMin` (new, 0.68x the base)
  with `CAMERA.groupPad` (new, 60 world units) of air. Past that it clusters by farthest pair and splits
  only as far as the fit requires: a trio plus one far player is two panes, two pairs are two panes, four
  separated players are the 2x2 grid. `CAMERA.shareSlack` (new, 70) is the merge hysteresis; a dead local is
  a spectator and no longer counts toward the fit.
- The camera anchor for a pane is the group's bounding-box centre, not one avatar. The fit zoom cap includes
  the group pad, so a grouped player is never placed on the pane edge. The old combat range
  (`zoomMin` 0.88 / `zoomMax` 1.03) is unchanged for a solo view; a group on one screen may pull farther
  back to `sharedZoomMin` before the view splits.
- Split panes now carry a 1.6px outline in the primary local player's color over a 5px dark underlay, plus a
  faint inner line. Readiness docks moved to screen corners, one per local player (top-left for a solo view,
  then top-right, bottom-left, bottom-right). One shared minimap serves the whole screen: lower-left for a
  solo view, top-centre whenever the view is split or more than one local is active.
- `src/game/camera.ts` adds a pooled `CameraDirector` (`CameraRig`: fixed point or `followSlot`, zoom, hold,
  in/out, weight, priority). `Renderer.playCameraRig` is the boss/narrative API. Shipped cues: a gauntlet
  wave glances at the nearest sentry pack outside `CAMERA.waveLookAhead` (new, 380), and the campaign breach
  pushes in 8% on the local player.
- Layout slow motion: the renderer raises a one-shot flag when the pane count or group mask changes. Local
  sims dip to `CAMERA.layoutSlowScale` (new, 0.35) and hold it for `CAMERA.layoutSlowHold` (new, 1.0 s), then
  ease back over the rest of `CAMERA.layoutSlowTime` (new, 1.3 s). Network sessions and the stress bench never
  slow.
- QA hooks: `?gauntlet=1&arena=N&bot=1` boots a gauntlet with a `BotBrain` driving the local player;
  `BotBrain.engageHostiles` walks to the nearest live threat and uses ranged/melee when no player target
  exists. `?debug=1` exposes a read-only renderer/world handle for scripted split tests. Neither is in a
  menu or a snapshot.
- Bumped to v0.1.37 and refreshed the service worker cache.

**Verification:** browser at 1280x800 on TRANSIT — four clustered locals stayed on one view at zoom 1.143
(view 1120 world units); three close plus one far split into masks 7/8 (two panes); two pairs split into
masks 3/12; four separated players filled the 2x2 grid. The pane frames, four corner docks and top-centre
map were checked in each layout. With a 2→1 merge, the round timer advanced 0.68 s over 1.20 s wall, then
1.00 s over 1.01 s after the dip expired. With the final 1 s hold, a 3→2→1 merge retriggered once and the
sampled `slowMoT` sat above 1.0 (full 0.35x) for exactly 1.0 s, then eased to normal over 0.3 s. The same
dip was measured on GitHub Pages at v0.1.37: bots covered 10.1 units per 100 ms in the second after a view
change against 17.4 units in quiet windows (0.58x, the hold plus ease averaging out). A priority-5 rig at
(2200,1000) with zoom 0.7 reached
full blend and pinned the view to the arena's right/bottom bounds, then cleared back to default. The
gauntlet autopilot booted on TRANSIT, advanced to wave 4, and exercised the camera against the live threat
pool. `npx tsc --noEmit` and `npm run build` clean. `npm run bench`: gauntlet 0.251 ms avg / 0.883 ms p99,
eight-bot swarm 0.119 / 0.355, all under the 4 ms budget.

**Next:** local input slots and the same-screen menu flow are still missing, so this is camera plumbing, not
playable four-player co-op. Tune the fit threshold (`sharedZoomMin`, `groupPad`, `shareSlack`) and the
slow-motion pair from production play; per-pane campaign/wave banners and a real team field remain open.

## 2026-10-30 — Open-wall arenas: the floor ends at THE LEDGE

**Goal:** some arenas should have solid walls and some should be open, so a body pushed over the edge
de-rezzes and shoving is a real way to clear a threat. The bridge/pad/lift arena (TRANSIT) stays as it is.

**Changes**
- `ArenaDef.walls: 'solid' | 'open'` (default solid) is arena data. `stepPlayerMotion` takes the flag and
  skips the boundary clamp on open arenas; `World` checks the lip right after motion and runs
  `fallPlayer`, which clears dash iframes and feeds the ordinary `damagePlayer` death path with a new
  `SRC.VOID` family. That means a fall loses the round, respawns on the training timer, ends a one-life
  gauntlet run and fails a campaign node with no special case in any of them. The death camera has no body
  to follow for `SRC.VOID` and falls back to the nearest living player.
- Shove kills: the worm, virus and sentry bounds clamps are skipped on open arenas, so the existing kit
  shoves can carry a threat out. `cullVoidThreats` deletes anything past the lip through its normal damage
  path (worm/virus/sentry), so the gauntlet clear counter, pickup drop and de-rez event all still fire.
  Sentries are leashed to a landing zone, so their clamp only ever mattered for a shove.
- No ricochet off nothing: `bounceWalls` deactivates a shot at the lip instead of reflecting it. Committed
  shapes (spear, thrown broom, bomb types 8/9) keep their geometry death, so a bomb still detonates at the
  edge rather than vanishing.
- Bots: `avoidFurniture` gets a wider, harder edge steer on open arenas (130-unit band, /45 falloff) on top
  of the old 44-unit wall nudge, and `dashSafe` refuses an approach dash or a dodge dash that would end
  past the lip. Without it, 16 bots walked off THE LEDGE in a 60 s four-bot brawl; with it, zero.
- Presentation: the open lip is a dashed violet line over a black band that swallows the floor grid outside
  the arena, with inward chevrons so the edge reads as "this way back". Corner brackets are dropped (a
  closed bracket reads as a wall). The minimap inner rim and the picker preview use a dashed border, and
  the camera clamp pads outward by `CAMERA.voidMargin` (90) so the drop is visible before it is stepped on.
- New arena `THE LEDGE` (id 6): violet, ring signature, six pillars, an inset eight-point spawn ring. It
  has the same 1894x998 span as the walled arenas so the camera behaves identically.
- Bumped to v0.1.38 and refreshed the service worker cache.

**Verification:** `npx tsc --noEmit` and `npm run build` clean. Headless probe, 18 checks: a shove over the
lip kills and attributes `SRC.VOID`; the fall loses the round (score 1-0); training respawns and puts the
body back inside; a dash/iframe frame still falls; a solid arena still clamps at 1920 on the same shove;
walking over the lip falls; a bolt dies at the lip while the same bolt bounces (vx -900) on a walled
arena; a virus past the lip is de-rezzed and `gauntletKills` goes 0 -> 1; four HARD bots play 60 s of
THE LEDGE with zero falls (closest approach 35 units from the lip, 300 presses, 4.3 units/tick of movement
so they were playing, not parked); Sweep's thrown broom carried a body from x 1902 to 1956 and killed it.
Browser: the lip, chevrons and void band render, the picker shows seven cards with THE LEDGE dashed, a
gauntlet autopilot run on THE LEDGE reached wave 4 with 6 kills, all three threat pools inside bounds and
no console errors. `npm run bench`: gauntlet max 0.243 ms avg / 0.760 ms p99, eight-bot swarm 0.101 / 0.267.

**Next:** playtest whether the 130-unit edge band makes bots too polite near the lip and whether a shove
kill feels earned. A welcoming fix would be a hit-flash on the lip when a body is carried over, plus a
dedicated fall sound; today it reuses the hit chirp and the death burst. A second open arena (narrow lip,
or an island in the middle) is content, not a new system.

## 2026-10-30 — RECYCLING BIN compactor, light file debris, destructible Wedge wall, campaign score

**Goal:** finish the recycling-bin test arena, make Wedge's wall solid and breakable, stand up the
destructible-object read (shake + cracks) and the campaign end-of-level score with data preservation.

**Changes**
- Fall rule reworked: crossing the lip, a trapezoid slant or a hole edge no longer kills on that frame. It
  starts `FALL.grace` (0.6 s) with reduced steering against an outward pull, and the body is saved if it gets
  back on the floor. Death still runs the ordinary `SRC.VOID` path when the timer expires.
- `ArenaDef.slant` (new): trapezoid plate. RECYCLING BIN is now narrow at the top and full width at the
  bottom, with the big bottom hole at 695,786 → 1295,1046 and left/right ledges as the survival ground. Its
  cover is gone by design; only breakable boxes remain.
- Compaction arm rebuilt: it is a moving wall with a 30 s cycle (2.6 s warning, 7.5 s stroke at 98 u/s,
  5 s climb). It stops exactly on the hole's leading edge and pins bodies on the side ledges. Bodies are
  glued to the plate face instead of kicked ahead by a knock impulse, and the plate narrows with the
  trapezoid so it always fills the bin. The 130-unit thickness and diagonal hatch sell it as solid steel.
- File boxes became light debris: rounded dashed outlines, pairwise separation, body shoves, lash launches
  (damage is separate, so one hit never deletes a box), guard bats, shot/blast shoves. Motion is a target
  velocity with a 6000 u/s² ramp and low drag, so a shove eases in and glides out. Boxes also get swept by
  the arm into the hole.
- File boxes drop back into a compacted bin during the quiet window, with a fall-in animation.
- Wedge's wall has `hp`/`maxHp`/`hitFlash`: every shot type stops or reflects (type 9 lob excepted), a lash
  and blasts chip it, and at zero it de-rezzes with `EV.WALL_BREAK`. Cracks are drawn along the segment and
  the plate shakes on every hit. Plate hit points: 7.
- Campaign: `campaign.ts` now authors six data crates for BUILD ROOT; they spawn on the breach so the drill
  cannot break them. `World.dataTotal`/`dataKept`/`campaignDamage` feed a score (kills, data kept, time vs
  par, damage taken, clean-sweep bonus). Score, best score and clean-sweep count persist in the slot.
- Death result overlays now hold 1.1 s so the aftermath is visible before the buttons.
- Bumped to v0.1.39 and refreshed the service-worker cache.

**Verification:** `npx tsc --noEmit` clean. Headless: the arm carries a mid-arena body into the hole at the
rim (~7.8 s) and pins side bodies at y=1024 alive; arm speed 98 u/s; zero pillars. Fall grace: no input =
death at 0.6 s at the lip and the hole; steering back = saved. Wedge wall: seven shots, hp 7 → 0, breaks on
the seventh and blocks all of them. Campaign: six crates spawn on the breach, none overlap cover, one broken
leaves 5/6. Browser: trapezoid, hole, plate and props render on `?gauntlet=1&arena=7`; no console errors.

**Next:** playtest the arm speed and the box weight in the bin. Destructible cover (pillars) is not built —
it needs a data record before a map can ask for it. The wall's plate does not stop the charged laser; decide
that before adding another map with cover.

## 2026-10-30 — Power-attack charge cut by 30%

**Goal:** shorten the wind-up before a power attack commits.

**Changes**
- Charge times cut by 30%: Probe `PLAYER.laserChargeTime` 0.9 → 0.63 s, Wedge `WEDGE.chargeTime`
  0.8 → 0.56 s, Sweep `SWEEP.powerChargeTime` 0.85 → 0.6 s, Toxic `TOXIC.streamChargeTime`
  0.8 → 0.56 s, Kaboom `KABOOM.clusterChargeTime` 0.85 → 0.6 s. Fisher's net is unchanged: it has no
  charge timer, it is drawn by moving and released by the player.
- `PLAYER.heavyTapMax` (0.16 s) is untouched, so a tap below it still casts the skill and a hold still
  commits the heavy.
- Bumped to v0.1.40 and refreshed the service-worker cache.

**Verification:** `tsc --noEmit` and `npm run build` clean. Charge constants read back from the built page.

**Next:** playtest whether 0.63 s still leaves the beam telegraphed enough for a dodge, and whether the
shorter charges shift the balance toward heavies in bots matches.

## 2026-10-30 — BUFFER_OVERFLOW.EXE (v0.1.41)

Goal: add the seventh program, a time specialist: hourglass throw, fast-forward skill, time-dilation heavy.

Changes:
- `BUFFER` numbers in `config.ts`; program id 6, hot-pink accent, `bugKind` 9 and a 10 s skill cooldown.
- Hull: six clock faces, two per health segment, orbiting the body with live minute/hour hands. The
  core disc is skipped for this program; the hourglass is a vector mark (two rounded triangles with
  overlapping tips), never the `⧗` codepoint, which can resolve to a colour emoji.
- Ranged type 10: heavy hourglass, no tail, dies on geometry, passes through three bodies, flips spin.
- Skill fast-forward: `Player.fastT`, per-player `pdt` for cooldowns/attack rate and `speedMult` for
  walking. Power dilation: `World.timeSlowT` / `timeSlowOwner`, applied to other players, hostile
  projectiles and the gauntlet/drone simulation, with a particle burst and a frame-edge wash.
- Bots tap fast-forward at 40–320 units; the generic heavy-hold builds the dilation.
- Toxic's needle is now a shape-built hypodermic (`drawSyringe`) instead of the `†` mark, which
  read as a cross in flight.

Verification:
- `tsc --noEmit` clean, production build clean.
- Headless: hourglass hits three bodies and flips spin twice, spin rotates; fast-forward walk 2.50x,
  autoFire and bug cooldowns burn 2.5x; dilation leaves the caster at 248 u/s and other bodies at
  74.4 u/s (0.30), hostile shot 60 u instead of 200 (0.30); skill/heavy wiring and 0.6 s charge.
- Browser: program card and portrait, in-arena clock ring and vector hourglass, clock sizes at four
  scales on a light background (no opaque tile).

Next: tune the hourglass chain count and dilation window in play, then decide whether the kit should
join the online snapshot (needs a protocol decision).

## 2026-10-30 — Sweep broom speed (v0.1.42)

**Goal:** Sweep's thrown broom read as too slow to contest other players at range; a traded shot
almost always lost. Nudge the throw up without turning it into a bolt.

**Changes:**
- `SWEEP.shotSpeed` 500 → **600**, `shotTtl` 0.9 → **0.85**, so max range moves 450 → **500**. The
  broom keeps its 15-unit width, 2 damage, the roster's biggest ranged shove and its geometry death,
  so it is still a heavy throw rather than a fast one.
- Updated the D14 note in AGENTS.md (the ranged line no longer calls it "deliberately slow") and
  bumped to v0.1.42 with a refreshed service worker cache.

**Verification:** headless probe on CROSSROADS: the broom spawned at **600.0 u/s** with a 0.83 s
fuse, 500 units of maximum travel, radius 15 and 2 damage, and still stopped on cover at 330 units
after 0.57 s. `npx tsc --noEmit` clean.

**Next:** watch a Sweep vs Probe/Buffer trade in VS BOTS. If the broom still loses the exchange, the
next lever is `SWEEP.attackCooldown` (0.5), not more speed.

## 2026-10-30 — Sweep broom width (v0.1.43)

**Goal:** the broom throw is a balance tool, so widen it a little. A wider head helps Sweep contest
a traded shot without another speed bump.

**Changes:**
- `SWEEP.shotRadius` 15 → **18**, so the collision diameter goes 30 → 36 units. That is the balance
  change: a body 30 units off the flight line now clips the head (18 + 13 body radius) instead of
  slipping past it at the old 28-unit reach.
- The thrown head draws at `half` 20 / `depth` 34 instead of 17 / 32. Because the row strings are
  sized from the head width, the wider head also buys a column: `/====\` over 11 bristles instead of
  `/===\` over 10. No new drawing path, so the melee, giant and split brooms are untouched.
- Updated the D14 ranged note in AGENTS.md and bumped to v0.1.43.

**Verification:** headless probe in a two-player match: the spawned broom reports radius 18 at
600 u/s, and a target held 30 units off its line drops from 3 hp to 1 (one 2-damage hit). Browser at
in-arena scale: three stationary heads read as clean binder-plus-comb rows with no clipping, and the
grey dust puff still trails the wider head. `npx tsc --noEmit` clean.

**Next:** judge the wider grab in play. If it now feels too generous, the lever is `shotRadius` back
toward 16, not the drawing width.

## 2026-10-30 — Heavy beam: layers, solid stop, guard reflect (v0.1.44)

**Goal:** make Probe's beam read as a heavy laser instead of a flat bar, and give it real surface
rules. It should stop on walls and barriers, not pass through them, and a guarding opponent should be
able to turn it back on its caster.

**Changes:**
- Added `beamReach` to `src/game/collision.ts`: one reach test for pillars (ray/slab), deployed Wedge
  walls (ray/segment with half-thickness pad), the compactor plate when it is live, and a walled arena's
  bounds. Open arenas and chasms do not block a beam.
- `World.laserReach` and `Renderer.drawLasers` both call it. The old render-only `beamClear` probe is
  gone, so the drawn shaft and the damage line now stop on the same surface. Damage tests take the reach
  as a parameter instead of always using `PLAYER.laserRange`.
- `World.reflectLaser`: the nearest rival in the corridor with `guardT > 0`, facing the incoming shaft
  (front half-plane) catches it. The guard is untouched, the caster takes `PLAYER.laserDamage` and the
  knockback, and a charged heavy is cut into its full cooldown. The guard stores
  `beamReflectT/Facing/Dist` and draws a fading return shaft for `PLAYER.laserReflectFlash` (0.34 s).
  Overcharge tick beams still reflect but are already spent.
- Beam drawing now stacks haze, glow, body, a hot white inner band, edge rails, two travelling energy
  pulses, counter-running streaks, a muzzle flare and an impact star on the surface it stopped on.
  `emitLaserSparks` throws small streaks off both edges every 26 ms and a spray at the solid end, once
  per frame rather than once per pane.
- `Player` gained `beamReflectT/Facing/Dist` (initialised and cleared on spawn; local only). Updated D10,
  D20 and the collision notes, and added D22 to AGENTS.md.
- Bumped to v0.1.44 and refreshed the service worker cache.

**Verification:** headless in a two-player match on GRID ZERO: pillar front at 931 gave reach 231; a
deployed wall at x=900 gave reach 200 and left the target at 3 hp; the compactor helper returned 280
from y=700 to a plate at 420; a charged beam into a facing guard left the guard at 3, dropped the caster
3→2, ended the beam and started the 5 s cooldown; the same guard facing away was cut to 1 hp and the
caster stayed at 3; overcharge reflection left the guard untouched. Browser on CROSSROADS: layered
shaft stopped with an impact flare on the pillar, side sparks visible at in-game size, reflected shaft
drawn from a guard back to the caster, no console errors. `npx tsc --noEmit` and `npm run build` clean.

**Next:** watch a duel where one player holds guard against a beam. If the reflection is too punishing,
the lever is the reflected damage (one hit now) or `laserReflectFlash`, not the stop rule.

## 2026-10-30 — Angled beam deflection (v0.1.45)

**Goal:** a guard should glance the heavy beam away, not return it. The reflected shaft should leave at
30-45 degrees off the incident line, so it can never hit the player who fired it but can still cut a
body standing beside the guard.

**Changes:**
- `reflectLaser` now rotates the incoming shaft by `PLAYER.laserReflectAngle` (new, 0.65 rad = 37.2 deg),
  toward the side the guard was standing on, instead of sending it straight back. The glance reaches
  `PLAYER.laserReflectRange` (new, 380) and is clipped by `beamReach`, so pillars, walls, the compactor
  plate and bounds end it.
- The deflected line is resolved by a new `damageBeamLine` pass, shared with the live beam. It takes
  skip slots, and the reflection skips both the guard and the caster. Directly behind the guard on the
  incident line is now off the deflected path.
- The catch still cuts a charged heavy into its full cooldown, but no longer damages or shoves the
  caster. Overcharge tick beams still reflect without a heavy lock.
- `laserHits` became the origin-agnostic `beamLineHits`; the live beam now calls the shared damage pass
  with the caster's slot as its skip. Renamed to avoid colliding with the firewall's `beamHits`.
- Updated D10 and D22 in AGENTS.md, and bumped to v0.1.45.

**Verification:** headless three-player match on GRID ZERO. A centered guard deflected to +37.2 deg and
cut a target placed on that line (3 -> 2) while the caster and guard stayed at 3; the beam was cut to 0
with `laserCd` 4.9 s and the flash stored with 380 reach. A body straight behind the guard on the
incident line stayed at 3. A guard offset above the line flipped the glance to -37.2 deg and cut its
angled target (3 -> 2); the first offset test at 240 units was correctly eaten by a pillar between the
guard and the target. `npx tsc --noEmit` clean.

**Next:** judge the 37-degree glance in a real duel. If it feels too wide (hard to aim at a third body),
drop `laserReflectAngle` toward 0.55 rad (31 deg); if it feels too narrow, 0.78 rad (45 deg) is the
ceiling the design asked for.

## 2026-10-30 — Title attract demo, game-UI toggle, bot footwork (v0.1.46)

**Goal:** an idle title-screen demo, a way to hide the canvas UI, bigger/standardised readiness marks, and
fix the bot back-and-forth jitter the demo exposed.

**Changes:**
- Title attract demo. After `ATTRACT.idle` (24 s) with no real input on the hub, `main.ts` boots a
  `World('gauntlet')` with a random program and arena, seeds it 72 waves deep and hides the canvas UI.
  A random HARD `BotBrain` drives slot 0 through the ordinary `InputFrame` path. Any key, click, wheel or
  gamepad edge returns to the hub; hover only resets the idle clock, because a layout change can fire a
  synthetic pointermove under a resting cursor. Death restarts on `ATTRACT.restart` (4 s). `?attract=1`
  is the QA boot hook. Nothing is recorded.
- Demo density. `World.seedAttractRun` now fills sentries, worms and viruses to the live caps around the
  player, and `fillAttractRoom` re-tops them every `ATTRACT.refill` (5 s) while `attractMode` is set; error
  blocks come from the normal colony growth. The room opens on 5 sentries, 2 worms, 10 viruses and 12-14
  blocks instead of one pack.
- UI toggle. New persisted Settings > Feedback row **GAME UI**, plus `?ui=0` for one load without saving
  the preference. It hides the match strip, wave banners, readiness docks and minimap; the avatar's own
  health segments and lock reticle stay.
- Readiness dock. Five identical 34 px circular slots, bigger marks (ammo dots 2.7 px, dash chevrons at
  10 px spacing and 2.4 px, skill/heavy scaled 1.3/1.32) and a circular cooldown mask: recovered wedge lit,
  dark charging wedge, bright sweep edge. The panel stays 182x44.
- Bots. They now hold target lock while fighting, so facing stays on the target and shots leave along
  facing while the body strafes the standoff range. The spacing error is continuous (approach far, orbit
  at hold range, back off only when crowded) instead of hard thresholds. Once cover breaks the straight
  line the route is committed for 0.5 s, and the near-field cover probe is skipped while routing, because
  running both shoved the bot off its own path. They raise the guard on incoming bolts outside melee reach
  and turn to face the bolt while it arms.
- Overcharge. `drawLasers` no longer skips the live beam when the heavy charge ring is also drawn; the
  gauntlet pilot holds the overcharge beam for a short burst and strafes the line across the target.

**Verification:** `npx tsc --noEmit` clean. Headless: match reversals 18 -> 5 in 12 s and gauntlet 2 in
12 s; the bot closes on a distant target and the round resolves normally; a 25 s mirror match held the
guard 104 frames and had it up 228 frames; the seeded demo starts at 5/2/10/13 on CROSSROADS and 5/2/10/12
on TRANSIT and holds near the caps through 32 s. Browser on the dev server: `?attract=1` reports 5
sentries, 2 worms, 5+ viruses, 14 blocks and `showUi` false, with the pilot moving and the wave advancing;
a synthetic ArrowDown returns to the title and tears the world down; `?gauntlet=1&ui=0` reports
`GAME UI: OFF` and does not persist. A screenshot could not be captured because the preview tab was not
being drawn.

**Next:** judge the demo in motion, then tune `ATTRACT.wave`/`refill` for pacing. The dock now has the
standard circles; compare it on a pad at 1080p before changing the panel size.

## 2026-10-30 — Gameplay tuning moves to JSON (v0.1.47)

**Goal:** make every feel/timing number easy to find and adjust during playtesting without editing systems.

**Changes:**
- Split the tuning literals out of `config.ts` into `src/game/tuning/`: `player.json` (avatar, bolt, skill,
  mine), `programs.json` (six kits), `threats.json` (gauntlet families), `campaign.json` (node pacing and
  score) and `world.json` (camera, traversal, powerups, rounds, training, net, attract).
- `config.ts` is now a typed facade. It imports the records, adds the values that are derived from view
  geometry (`PLAYER.swingHalfAngle`/`guardHalfAngle`, `SWEEP.powerRise`/`powerSpan`) and re-exports all
  38 old names. No call site changed and no system imports JSON directly.
- Structural constants stayed in code: `VIEW_W/H`, `CAMERA_ZOOM`, engine limits, pool sizes, `TRAVEL`,
  `TRAIL_LEN` and `COLORS`.
- `tuning/README.md` documents the file map, units, derived fields and the tuning-adjacent invariants
  (bomb types are never deflectable, beam reflections never hit the caster, hull clearance).
- AGENTS.md gains D24 and points the per-system "all numbers live in" notes at the JSON records; README
  documents the folder and the dev hot-reload path.

**Verification:** a temporary deep-compare script imported the previous `config.ts` from `HEAD` and the new
facade and compared all 40 exports recursively: **IDENTICAL, no value or key changes**. The four derived
fields were omitted from JSON and recomputed in the facade with the same formulas. `npx tsc --noEmit` and
`npm run build` are clean; the attract demo and gauntlet run on the dev server after the move.

**Next:** tuning now has one obvious home. When playtesting a kit, edit `tuning/programs.json`; if a value
needs to scale with the view or a sector, keep that derivation in `config.ts` rather than baking the result.

## 2026-10-30 — Sweep's power reveals from the facing side (v0.1.48)

**Goal:** make Sweep's heavy read as a broom assembling across the lane instead of a screen-wide shape
appearing at once, and give the materialize beat a physical shove so bodies are moved before the hit.

**Changes:**
- `SWEEP.powerRevealTime` (0.3 s) and `SWEEP.powerRevealPush` (820) added to `tuning/programs.json`.
- On fire the broom latches a reveal direction from facing: left to right when `cos(facing) >= -0.15`,
  right to left otherwise. It is latched at the fire frame, so steering during the charge cannot flip it
  mid-materialize.
- `tickBroomSweep` runs the reveal first. `resolveBroomReveal` shoves players, sentries, viruses and worms
  that sit under the already-visible part of the lane toward the reveal front, and **deals no damage**.
  The stroke (and its per-body damage/carry) starts only after the reveal completes. Cover cuts the shove
  through the same `broomReaches` line test as the stroke.
- The reveal does not change the committed heavy cost or cooldown. During the reveal `broT` is held so the
  player stays busy; the stroke then runs its full `powerDuration` and sets the cooldown as before.
- Renderer: `drawBroomText` takes a reveal direction and clips from one edge. The charge shows a faint
  full-width ghost of the lane, the live reveal overlays the bright head with a bright front edge, and the
  committed stroke draws the full head as before.
- AGENTS.md D10/D14 updated: the reveal is a shove without damage; damage begins with the stroke.

**Verification:** `npx tsc --noEmit` clean. Headless (`scripts/.tmp-reveal.ts`): face-right fires at tick 36
with `broRevealDir=1`; a body on the early part of the lane is untouched, takes no damage through the
reveal (`hpMidReveal=3`) and is then hit at the first stroke tick; face-left gives `broRevealDir=-1` and a
negative shove. Gauntlet sentry: hp unchanged during the reveal, pushed from x=430 to 471 at fire+6, then
killed by the stroke. Temporary scripts removed after the check.

**Next:** watch it at full speed in the gauntlet and judge the 0.3 s reveal and 820 shove; those are the
two numbers to tune if the assembly feels slow or the push too weak.

## 2026-10-30 — Atomize.exe: alternating electrons, orbital shield and orbit field (v0.1.49)

**Goal:** add the roster's orbit program: a white six-segment atom, ranged shots that leave alternating
hands and curve toward a target, a persistent three-ball shield, and a power that turns incoming shots and
small enemies into an orbiting weapon.

**Changes:**
- `PROGRAMS` entry 7 (`ATOMIZE.EXE`), white `PROGRAM_COLORS.atomize`, `healthSegments: 6`. `World` now
  derives `Player.maxHp` from the program def, so spawn, respawn, bots and the local hull all read six.
- Hull: three overlapping vector ellipse orbits at 60°, split into two half-arcs each (six segments). The
  inner edge is `0.55r`, outside the low-health core mark; the atom center mark is drawn as vector orbits
  and a nucleus, never the `⚛` codepoint. `coreScale 0.9`.
- Ranged: type 11 electron, one hand per throw (`atomSide`), launch angle tilted inward by 0.52 rad, 480
  u/s, 1.5 s life, 1 damage. `findAtomTarget`/`steerAtomBolt` add the slight seek (2.8 rad/s, 460 range,
  0.1 forward dot, line of sight). Ball colours cycle yellow/green/blue; the white trail is stretched to
  14 points so the arc reads.
- Skill: `atomBalls` at `ballOrbit` 44, `ballSpin` 3.2, no timer. A ball deals 1 damage on the first
  hostile it touches; `damagePlayer` spends one ball per full hit before health is recorded. A second tap
  with balls surviving is refused and refunded.
- Power: `orbitT` 2.8 s field, caster keeps walking, 250 grab radius, 135 orbit, 5 rad/s body spin
  (8.5 rad/s shots), per-kind sentry/virus weights. Captured shots are retagged to the caster so they
  cannot hit their captor; captured sentries and viruses are held out of their own AI and trade contact
  damage. Release throws on the tangent with spread; cooldown starts when the field ends.
- Renderer: six-segment hull, white/orbital visuals, ball trail, orbit field rings, a field-shaped heavy
  charge instead of the beam muzzle, dock marks and a six-segment portrait.
- Menu type: `--ui` system console stack (Bahnschrift, DIN Alternate, Avenir Next, then platform UI). The
  body and all menu controls moved off `--mono`; the ASCII logo, boot log and schematic data tables stay
  monospace so their columns keep their shape.
- Docs: AGENTS D4/D10/D11/D25, README controls, TODO v0.1.49; build stamped 0.1.49.

**Verification:** `npx tsc --noEmit` clean. Headless (`scripts/.tmp-atomize.ts`): firing twice produces
launch `vy` -239 then +239 at 480 speed; after 20 ticks the first shot's `vy` has turned to +86 while its
speed stays 480. A full hit with three balls leaves hp 6 / balls 2; a ball touching a player drops their hp
3 → 2 and consumes the ball. In a gauntlet practice world a captured sentry reports `orbitOwner 0` and an
enemy shot is captured (`orbOwner 0`) at the same time; the player moves from x 500 to 504 while the field
is live; release hands the sentry a throw impulse and the field ends at 7 s cooldown. The test file is
temporary and will be removed after the visual pass.

**Next:** playtest the white hull at full and one-segment health in the arena and on the select portrait,
then tune `shotTurn`/`seekRange` for how much the electron should curve and `powerSpin`/`powerThrow` for
how violent the orbit feels. The kit remains local-only; no snapshot work.

## 2026-10-30 — Readiness dock drops ammo and pickup, three bigger jobs (v0.1.50)

**Goal:** make the local readiness marks legible from a couch. Ranged shot tracking and the pickup cell
were using dock space without adding a read: ammo is visible in the firing cadence, and an active pickup
already shows on the avatar and its effect.

**Changes:**
- The dock is three jobs: dash charges, skill, power attack. Every program uses the same 60 px cell with a
  50 px circular slot, so the panel shrinks from five cells to three (196×64) without shrinking the marks.
- Skill and heavy marks scale from 2.15× to 2.6× with a 2.4 px stroke over a wide dim pass; the heavy live
  state keeps its slightly brighter 2.8 px stroke. Dash chevrons widened to 4.2 px over a 9 px glow and
  spaced 12 units apart, so both charges sit centered in the slot instead of running to its left rim.
- Cooldown dials are unchanged: recovered wedge lit, dark charging wedge, bright sweep edge. The
  shared slot fill and rim also brighten a step (0.22 fill, 0.72 rim) so the larger marks sit in a
  visible cell instead of a nearly empty circle.
- Docs: AGENTS D11 now states the three jobs and the 60 px cell / 50 px slot; README stays accurate.

**Verification:** `npx tsc --noEmit` clean; `npm run build` passes (65 modules, stamped 0.1.50). Icon
extents measured against the 25 px slot radius: skill/heavy marks and their glow stay inside the circle
(max ~24.7 px for Sweep's heavy), and the dash pair spans 32 px centered. No browser screenshot pass.

**Next:** check the dock during a real match at 1080p and on a short viewport; if the skill and heavy marks
still read small, grow the slot rather than the panel, or add a second brightness step for the live heavy.

## 2026-10-30 — BUFFER_OVERFLOW.EXE renamed BAD_LAG.EXE (v0.1.51)

**Goal:** rename the time program without disturbing its kit or saved data. "Bad Lag" says what the
program does to the room more directly than the old buffer-overflow name.

**Changes:**
- `PROGRAMS` entry 6 displays `BAD_LAG.EXE`. The role, note, pink palette, six-clock hull, vector
  hourglass, hourglass throw, fast-forward and time dilation are untouched.
- All internal keys stay `BUFFER`: `PROGRAM_ID.BUFFER`, the `BUFFER` tuning block,
  `PROGRAM_COLORS.buffer`, and the id stored in save slots. Renaming the identifier would have moved
  every existing save and tuning reference for no player-visible gain.
- AGENTS D4 and D21, README controls and test notes, and the program comments now say Bad Lag. The old
  TODO v0.1.41 and HISTORY v0.1.41 entries keep `BUFFER_OVERFLOW.EXE` because they are historical.
- Build stamped 0.1.51.

**Verification:** `npm run build` clean (`tsc --noEmit` plus Vite). The select screen and How to Play
roster read from `PROGRAMS`, so both pick up the new name without a second list.

**Next:** confirm the longer name fits the select card and the How to Play roster at 1080p; if it wraps
awkwardly, tighten the card title rather than shortening the program name.

## 2026-10-30 — GHOST.EXE: cloak, chomping mouth, jump-scare (v0.1.52)

**Goal:** add the ninth program, a grey stealth kit that can disappear, throw a slow heavy bite, and trade
its cloak for a close-range scare burst.

**Changes:**
- `PROGRAMS` entry 8 (`GHOST.EXE`, `STEALTH`, `bugKind` 11), steel-grey `PROGRAM_COLORS.ghost`
  (`#b9c4d0`) and a three-arc hull in `pathProgramHealth`: three 120° gaps, one outward arc per health
  segment, inner edge at `0.69r` and bulge at `1.34r`. `coreScale` is `0.82`, keeping the eye lashes
  clear of the arcs.
- Core mark: `drawGhostEye` draws a closed eye as a vector bottom-half lid arc with five straight lashes,
  so the mark never relies on `◡` or a symbol font. `◡` remains the text metadata glyph for the roster.
  The eye was rotated once and rotated back after the designer saw it; the current lid curves through the
  bottom half with the lashes hanging below. The dock and the cloak readout reuse the same shape.
- Ranged: type 12 mouth, `GHOST.shotSpeed` 540, `shotRadius` 16, 2 damage, 0.9 s life, no motion tail,
  stops on the first body and on cover. A hit applies `shotDaze` 0.7 s at `shotDazeSlow` 0.55, so the
  victim keeps steering but moves heavily. The renderer draws a wide dark maw with five sharp teeth on
  each jaw and a per-projectile chomp phase.
- Skill: `startGhostCloak` sets `cloakT` for 3.5 s. The shared `phased()` gate covers `damagePlayer`,
  while AI target picks and sentry/worm/virus acquisition skip a cloaked body. The local avatar keeps a
  faint dark disc, dashed rim and eye so the owner can navigate; remotes draw nothing extra.
- Power: holding `Y` for `scareChargeTime` 0.45 s re-cloaks and arms `scareT` for 3.2 s. Any action press
  inside the window (`BOLT`, `SWING`, `CANDLE`, `DASH`) fires `fireJumpScare`: a cover-respecting
  `explodeBlast` at 210 radius, 2 damage and 1200 knockback, cloak dropped, and `SCARE_FACE` stamped for
  0.85 s. The press is consumed so the same button cannot also act. An armed window that expires fires
  nothing. A release inside `heavyTapMax` casts the cloak instead.
- Bots: tap cloak when a shot is in the air or after a hit; arm the scare inside scare range, chase the
  target while armed and press melee. `targetAlive` and `pickTarget` skip a cloaked player.
- Dock marks: closed eye for the cloak, open maw for the jump-scare; the armed state is the live heavy.
- Center-mark clearance: the select portrait was drawing every program mark at full poster radius and
  ignoring `coreScale`, which made the vector centers on the newest four overlap their hulls. The portrait
  now passes `coreScale`, the missing-font vector bomb scales with it too, and the four values were lowered
  to Kaboom `0.76`, Bad Lag `0.72`, Atomize `0.72` and Ghost `0.82`.
- Docs: AGENTS D4/D10/D26, README control table and QA checklist, TODO v0.1.52. Build stamped 0.1.52 in
  `index.html`, `main.ts` and `sw.js`.

**Verification:** `npx tsc --noEmit` clean; `npm run build` passes (65 modules). Headless kit check in a
training world: tap `Y` gives `cloakT` 3.50 and `bugCd` 9.0, a direct 1-damage hit is skipped while
cloaked and lands after the timer; holding the heavy arms at frame 28 with `scareT` 2.68 and energy 55, the
next `BOLT` press drops the cloak, stamps `faceT` 0.85, takes the nearby target 3 → 1 and gives ~915
knockback; letting a second armed window expire leaves no face and no damage (`cd` 4.5 remaining). The
chomping mouth reports type 12, speed 540, 2 damage, radius 16, and a clean hit leaves `dazeT` 0.70. A
visual pass on the live select screen confirmed the four newest portrait marks now sit clear of their hull
segments; the debug overlay used for the close-up was removed. The temporary test script was removed.

**Next:** playtest the eye at core and portrait size, then judge the mouth's 540 speed and 0.7 s daze in a
mirror match; those are the two numbers most likely to need a pass. The kit is local-only, so no snapshot
work follows.

## 2026-10-30 — Toxic needle carries farther (tuning)

**Goal:** let Toxic pressure a target at longer range without changing the needle's damage or venom.

**Changes:** `TOXIC.needleTtl` in `tuning/programs.json` goes from `0.62` to `0.85` s at the same `880` u/s.
The dart now clears roughly 748 units before expiry instead of 546; cost, damage, radius, knockback, venom
and fire cadence are untouched. No code path changed, so the tuning JSON is the only gameplay edit.

**Verification:** `npm run build` clean (65 modules). Headless range check in a match world fired one
needle down a clear lane: speed 880, travel 719 units from the first sampled frame (about 760 from the
muzzle with the 41-unit spawn offset), then expiry. The temporary script was removed.

**Next:** judge the longer lane in a Toxic mirror match; if it now outranges everything for free, trim
`needleTtl` toward 0.75 or raise the fire cost rather than slowing the dart.

## 2026-10-30 — Probe's target becomes a compass (v0.1.52)

**Goal:** replace the concentric target at Probe's core with a mark that reads as navigation/scouting
rather than a bullseye, while keeping the cyan scan-ring hull.

**Changes:** `PROGRAMS[0]` now carries `✥` for text metadata, and `drawProgramMark` routes program 0 to
the new `drawCompassMark`. The mark is a thin housing ring around a solid four-point rose, all in the
caller's fill colour. The rose is symmetric, so it does not become a facing arrow; the four points are
slightly concave at the waist to keep the tips reading at the 11px core size. The hull ring and accent
colour are unchanged. AGENTS D4 records the vector compass and the reason for the symmetric tips.

**Verification:** `npx tsc --noEmit` clean. A browser canvas check rendered the mark at portrait scale
(4.4x) and at a 6x enlargement of the actual arena core: the housing ring stays inside the dark core disc
and the four tips stay clear of it, and the silhouette is visibly a compass rather than concentric
targets. The select portrait and How to Play roster both pick up the new mark from `PROGRAMS`.

**Next:** check it in a live Probe mirror at normal camera zoom; if the star reads as a generic sparkle,
lengthen the cardinal tips or add four short cardinal ticks between the star and the ring.

## 2026-10-30 — Friendly fire is a gauntlet/campaign run rule (v0.1.53)

**Goal:** let a run choose whether enemy shots can damage rival threat families, without changing the
sandbox default.

**Changes:**
- `World.friendlyFire` defaults to true. `projectileHitsGauntlet` returns early for enemy fire (hostile
  AI shots with `owner < 0` / `type >= 3`, and the slot-1 thrall's bolts) when the rule is off, so it
  passes through worms, viruses and error blocks and only threatens players. Player shots, mines, spears
  and hourglasses still hit every threat family.
- The rule is set once when the run is created: `startGauntlet` and `startCampaignLevel` copy the saved
  preference onto the world. Training, VS BOTS, online matches and the attract demo keep the default on.
- `FRIENDLY FIRE` is a row in GAUNTLET run setup and the CAMPAIGN save-slot stage, so both new and resumed
  runs can change it. Both toggles read the same `deflect.friendlyFire` key and update together; the
  default is on. A short hint says what off does.
- Firewalls remain environmental damage and still burn enemies. Worm/virus feeding is untouched. Sentry
  packs still ignore each other because a projectile has no source silhouette.
- Local-only: no snapshot, network or renderer change. Build stamped 0.1.53.

**Verification:** `npx tsc --noEmit` and `npm run build` clean. Headless gauntlet check on a virus body:
a hostile bolt damages it with the rule on, passes through with the rule off, and a player-owned bolt still
damages it with the rule off. Browser pass on the two setup screens for the toggle state and the persisted
value.

**Next:** playtest whether off makes the wave ramp too hard on wide arenas; if so, lower early sentry
cadence or raise the drop rate rather than reverting the rule.

## 2026-10-30 — Arena laser emitters (v0.1.54)

**Goal:** turn the improved heavy-laser presentation into an arena hazard: a fixture that gathers in
plain sight, fires on an interval, stops on cover, and can be caught by a raised guard and sent at a
locked enemy.

**Changes:**
- `ArenaDef.emitters` (`ArenaEmitterDef`: position, firing angle, optional stagger). CROSSROADS gets two
  cross-lane fixtures on the central blocks, THE RING gets top/bottom gate beams, and MAINFRAME gets two
  mid-map lanes. RECYCLING BIN keeps the compactor as its only hazard.
- `EMITTER` in `tuning/world.json`: 2.4 s gather, 0.42 s live shaft, 7 s period; 1 direct damage and 420
  shove; 2 reflected damage, 620 shove and 1200 range; 12 gather dots.
- `World.emitters` and `updateEmitters` run in training/gauntlet practice only. A hosted match leaves
  every fixture idle. No `Snapshot`/`NetView` fields.
- The direct shaft uses `beamReach` and a line-of-sight test, burns each player once per pass, and records
  `SRC.EMITTER`. The reach refreshes during the live window so a deployed wall or moving compactor cannot
  be drawn through. A guard facing the lens catches the shaft and returns it along its own `facing`; lock
  therefore aims the return at the locked enemy. The return is one `damageBeamLine` pass at 2 damage and
  skips the guard, so it cannot hit its own shield.
- Renderer: wall bracket and red lens, converging dots with radial streaks, a shrinking gather ring,
  layered red shaft with a hot core and rails, muzzle and impact flares, red side sparks, and red emitter
  marks on the arena preview and minimap.
- Placement: THE RING's first pass fired through the side gates, which are the spawn pair, and the
  MAINFRAME lanes sat on the y=720 spawn line. Both were moved. The headless check now fails if a local
  start point is inside an emitter corridor.

**Verification:** `npm run build` clean. A temporary headless check covered the gather timing, a single
burn per pass, the guard catch with no self-damage, the reflected two-damage hit on a target at the
aimed angle, match dormancy, every authored lane clearing its mount, and every local start point outside
the lanes. In the browser, `?gauntlet=1&arena=0` and `arena=2` reached a live beam and showed no renderer
exceptions after the first hot-reload stale-class error was cleared by a full reload.

**Next:** playtest the 2.4 s gather and 7 s period in a campaign run. If the lanes read as unavoidable
on a wide camera, widen the vertical spacing between a pair before shortening the gather; the telegraph
is the only fair warning.

## 2026-10-30 — Projectile end-of-range dissolve (v0.1.55)

**Goal:** stop shots that reach their maximum flight time from blinking out of existence.

**Changes:** `EV.DISSOLVE` (40) is emitted from the general projectile lifetime branch when `fuse`
reaches zero. It carries the owner in `slot` and the projectile type in `power`. `Fx` reads it as a
small shard fizzle: four or six shards depending on the shape, a few matching sparks, two white flecks
and a short thin ring. Hostile shots use the danger tint; player shots use their program colour. No
screen shake, flash or sound. The branch is only the free-flight expiry; body hits, cover stops, mines
and bombs keep their existing effects and never emit it.

Because the event travels in the existing snapshot event list, guests get the same fizzle without a new
snapshot field. The event kind is additive; an older guest that ignores unknown kinds simply sees the old
disappearance.

**Verification:** `npm run build` clean. A temporary headless check fired a bolt into open floor and
found the `DISSOLVE` event with the owner and type; a second bolt stopped by the training drone produced
the hit path with no dissolve. The temporary script was removed. Browser console clean after reload.

**Next:** watch a full autoplay match for event volume. A deep gauntlet wave with many bolts expiring at
once should still fit the event budget comfortably, but that measurement is not taken yet.

## 2026-10-30 — Kiosk demo boot with a fading GAUNTLET title (v0.1.56)

**Goal:** a URL mode that turns the game into a hands-off showfloor loop: a bot-run gauntlet, no player
UI, and the mode title centered over the action. Nothing a viewer presses should interrupt it.

**Changes:**
- `?demo=true` (also `1`) boots the existing attract pilot as a permanent kiosk run: a random program
  and arena, `ATTRACT.wave` 72, live-cap refills, and a fresh run after a wipe. It reuses
  `startAttract`, `seedAttractRun` and the normal gauntlet simulation; there is no second demo world.
- Demo mode swallowed every wake input: `onUiKey` (keys), the idle-exit check in `updateAttract`, and
  the existing gamepad guard. `exitAttract` refuses while demo is set, so there is no pause, menu or
  exit path. The body hides the cursor and the demo cannot open an overlay or write a run.
- Added a DOM title card (`#demo-title`) over the canvas: `DEFLECT // SINGLE PLAYER`, a large
  `GAUNTLET`, a thin rule and `SURVIVE THE SWARM`. It is `pointer-events: none`, `aria-hidden`, centered
  in the viewport, and fades on a 30 s CSS cycle (`demo-title-cycle`: about 12 s visible, hidden for the
  rest, fading in again at the loop boundary).
- Build stamped 0.1.56 in the title, Settings > System, the console log and the service worker cache.
- Docs: AGENTS D23 now separates the idle attract demo from the kiosk boot; README lists the hook.

**Verification:** `npm run build` clean. In the running dev build at
`/?demo=true&debug=1`: `attract` and `demo` both true, `World('gauntlet')` at wave 72 with 5 sentries,
2 worms, 9 viruses and live projectiles, `renderer.showUi` false, body cursor `none`, title card visible
and centered (962×137 in a 1422×800 viewport), animation name `demo-title-cycle` with a 30,000 ms
duration. WAAPI scrub: opacity 1 at 2 s, 0 at 20 s and 0 at 29.5 s, 0.23 just after the loop boundary.
Escape left the demo running with no overlay and the world still live. Marking the world
`gauntletOver` (and a later natural edge fall) both produced a new program/arena at wave 72 with the
title card still visible; console had no errors. A control run of `?attract=1` still exited to the hub
on Escape, and the title card stayed hidden there.

**Next:** capture a full loop for a store page and watch a long session for audio/CPU drift. The demo
inherits the attract pilot's camera and refill behavior, so any feel issue there belongs to the pilot,
not this boot.

## 2026-10-30 — Phone touch layout and local input assists (v0.1.57)

**Goal:** start the mobile/phone framework: a touch control layer, auto-lock and auto-attack assists, a
settings home for both, and a HUD arrangement that survives a phone in landscape.

**Changes:**
- `src/ui/touch.ts` is a DOM-only `TouchControls` layer. A bottom-left stick writes the ordinary
  movement vector (0.18 deadzone, facing comes from movement exactly as with a keyboard or pad). Three
  bottom-right buttons write the ordinary action bits and support hold: SHIELD = `SWING` (tap lash, hold
  guard/reflect), SKILL = `CANDLE` (tap skill, hold power), DASH = `DASH` (tap dodge, hold charged).
  Pointer up, pointer cancel, window blur and a hidden tab release every held input, so a button cannot
  stick across a screen change.
- `touchMode` is on for `(pointer: coarse)`; `?touch=1` forces it for desktop QA and `?touch=0`
  suppresses it. The layer only appears during a live local or guest game with no overlay or loading
  intro. Menus, the attract/kiosk demo and the stress bench hide it; GAME UI and `?ui=0` do not remove
  it because it is input, not readout. The top-right pause button opens the usual leave overlay; STAY
  restores the controls.
- Settings gains a `CONTROLS` tab between FEEDBACK and AUDIO with persisted `AUTO LOCK`
  (`deflect.autoLock`) and `AUTO ATTACK` (`deflect.autoAttack`). Both default on for touch and off for
  keyboard/pad; an explicit saved choice wins, and RESET DEFAULTS follows the current device.
- `applyInputAssist` writes ordinary lock/attack bits into the local frame. Auto lock holds `ACTION.LOCK`.
  Auto attack also holds lock and, once a target is active, taps melee within `AUTO_ATTACK.meleeRange`
  (92) or holds ranged fire within `AUTO_ATTACK.rangedRange` (520); both live in `tuning/player.json`.
  It never overrides a held manual action, an active swing/guard/dash/heavy or an armed jump-scare. A
  guest assist reads only player targets, because that is all a snapshot carries.
- `Renderer.touchLayout` moves the readiness docks to the top centre and drops the minimap for the touch
  layout. The stick, buttons and pause use `env(safe-area-inset-*)`. No touch or assist state enters
  `World`, `Snapshot` or a room.
- `HOW TO PLAY` gains a touch table and the header reports `TOUCH`; README lists the layout, settings and
  URL hooks. Build stamped 0.1.57 in the title, Settings > System, the console log and the service
  worker cache.

**Verification:** `npx tsc --noEmit` and `npm run build` clean. In the running dev build at 843×390:
`touchMode`, `Renderer.touchLayout` and the three buttons were live; the stick moved the avatar and
released to zero; a shield press raised a 0.18 s guard and released into the 0.28 s cooldown; the pause
button opened `LEAVE TRAINING?`, hid the layer, and STAY restored it; a bot appeared, auto lock became
active and auto attack fired (bot at 1 hp, three live projectiles, `autoFireT` cycling); `?touch=0` left
both assists off, and toggling both in `SETTINGS > CONTROLS` persisted them across a reload. The touch
layout hid the minimap and the canvas dock was centered. Physical phone and pointer-cancel behavior are
not tested; the browser run used synthetic pointer events.

**Next:** run the layer on an actual iPhone and Android phone, tune thumb reach and the 2×2 button grid,
and decide whether AUTO LOCK off needs a manual lock-cycle control. Portrait is usable but not laid out.

## 2026-10-30 — Threat melee: worm bite, virus charge, sentry ram (v0.1.58)

**Goal:** close-range threats should do something other than touch damage; give the worms a committed bite
and the smaller mobile threats a charge or dash they can use as melee.

**Changes:**
- Worms now bite a player inside `WORM.biteRange` (76). The head rears for 0.32 s, lunges at
  `biteLunge` (210 u/s) for 0.16 s, and deals `biteDamage` (1) plus `biteKnockback` (880) once inside a
  56-unit reach. `biteRecovery` (0.38) and `biteCooldown` (2.4) follow. Touch damage is suppressed for
  the whole attack, the bite direction is latched at the trigger, and cover breaks the trigger and the
  hit. The teeth draw in the committed direction, opening on the wind-up and snapping shut on the lunge.
- Viruses charge a player between `VIRUS.chargeMinRange` (34) and `chargeRange` (150). They latch a
  direction, hold still for `chargeWindup` (0.34), dash at `chargeSpeed` (620) for `chargeActive` (0.22),
  and deal 1 damage plus a 540 shove on the first contact. `chargeRecovery` (0.34) and
  `chargeCooldown` (4.2) follow. Iframes, a cloak or cover beat the hit; the commitment still runs.
- Pulse squares and dart flocks ram instead of firing when a player is inside `SENTRY.ram.range` (92).
  The ram is a 0.3 s wind-up, a 0.16 s dash at 460, 1 damage and a 620 shove, then a 0.36 s recovery and
  a 3.8 s cooldown. The sentry stops its firing cycle for the attack and cannot shoot during it. Only
  one sentry ram commits at a time: without that gate a three-dart flock stacked three melee hits on one
  frame and deleted a full health bar. Triplex and homing silhouettes keep their existing firing bands and
  do not ram.
- Virus charges and sentry rams are cancelled by Atomize's orbit, a compactor pin, a spawn window or an
  arena transition, so a held body cannot resume an old lunge after the field drops it.
- Shared `drawLungeWarn` telegraph for virus/sentry dashes: dashed guide, arc and arrow during the
  wind-up, then a hot streak and an impact nose during the dash. The worm uses its own jaw shape so it
  reads as a bite rather than another projectile.
- Tuning lives in `tuning/threats.json`. README threat bullets and AGENTS D9 record the tells and the
  "cover cancels it" rule. Build stamped 0.1.58 in the title, Settings > System, the console log and the
  service worker cache.

**Verification:** `npx tsc --noEmit` clean after each edit; `npm run build` clean. A headless World probe
in `scripts/.tmp-threat-melee.ts` (removed after use) set each threat in range with its cooldown clear and
stepped the sim: the worm began a 0.86 s bite and dealt 1 damage (`killer === SRC.WORM`); the virus
started a 0.90 s charge at 100 units and dealt 1 damage; the pulse square started a 0.80 s ram and dealt
1 damage while a second square at the same range stayed out of the commit (`ramT` 0), so the pair dealt
one segment, not two. No test of a real player dodging the tells yet.

**Next:** run wave 3+ in the browser and watch the bite/charge/ram tells at the minimum camera zoom. The
next content question is whether flocks should burst darts on a ram impact; they currently only shove.
