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

## 2026-10-30 — Gamepad Select toggles the canvas UI (v0.1.59)

**Goal:** give a controller player a quick way to hide the canvas readout without walking into Settings,
matching the `?ui=0` capture path.

**Changes:**
- `Input` now latches a dedicated `MenuEdges.ui` edge from button 8, named `PAD.SELECT` (Back/View/Select).
  It used to share `MenuEdges.menu` with Start, so pressing Select in play opened the leave overlay.
  `START` is now the only in-game menu button, matching the existing control comments.
- `handleGamepad` gives Select two jobs. In a menu or overlay it backs out exactly as before. In live play
  it calls `applyUi(!uiEnabled, false)`, so it hides or restores the whole canvas layer for the session and
  does not rewrite `deflect.ui`. The existing `GAME UI` setting keeps its persisted behavior.
- Select feeds the activity clock, so it wakes the idle attract demo like the other pad edges. It does not
  run during the attract or kiosk demo, whose UI is already forced off.
- HOW TO PLAY gains a `TOGGLE UI / VIEW / SELECT` row. README and AGENTS D11/§4 now list Select as menu
  back plus the in-play UI toggle, and Start alone as the in-game menu. Build stamped 0.1.59 in the title,
  Settings > System, the console log and the service-worker cache.

**Verification:** `npx tsc --noEmit` clean. A virtual standard gamepad was injected into the dev build at
`?gauntlet=1&arena=0&bot=1&debug=1`: the first Select press changed `GAME UI` to OFF with the pause overlay
still closed, the second changed it back to ON, Start still opened `SYSTEM // PAUSED`, and Select closed
that overlay without changing the UI. After toggling OFF, a reload came back ON, which confirms the
shortcut did not write the saved setting. A physical pad has not been tested.

**Next:** check button 8 on a real Xbox and PlayStation pad and decide whether the table should say
`VIEW`, `SELECT` or the platform's own label. Keyboard capture still has no equivalent shortcut.

## 2026-10-30 — Keep the demo simulating through a death (v0.1.60)

**Goal:** a death in the attract/kiosk gauntlet used to freeze the whole sim under the restart delay, so
the demo looked paused for four seconds before cutting to the next run.

**Changes:**
- `World.step` now reads the real-run freeze as `gauntletOver && !attractMode`. A scored gauntlet,
  campaign node and hosted match still stop under their result overlay; the attract world keeps threats,
  projectiles, particles, wave timers and `gauntletT` moving through the death aftermath.
- `gauntletOver` remains the demo pilot's restart signal, so `main.updateAttract` still waits
  `ATTRACT.restart` (4 s) and then starts the next random program/arena. No record or overlay path changed.
- README describes the live four-second aftermath. AGENTS D23 records the exception and says not to
  freeze or respawn the demo pilot on death. Build stamped 0.1.60.

**Verification:** `npx tsc --noEmit` clean. In the dev attract run, forcing the local pilot's death left
`gauntletOver` true but the same world advanced `gauntletT` from 2135.8 to 2137.3 over 1.5 s; the live
worm moved about 73 units and the live virus about 66. After 3 s the same world was still simulating, and
by 7.5 s a new attract world was live. A forced death in `?gauntlet=1` left `gauntletT` at 5.0167 for the
full 1 s check, confirming the real-run freeze is unchanged.

**Next:** watch several full aftermaths and judge the death camera; a short fade at the run cut is a
possible follow-up, but the freeze was the bug.

## 2026-10-30 — Controller rumble through the Gamepad API (v0.1.61)

**Goal:** controllers with haptics should feel local hits, deflects, explosions, dashes and deaths without
adding a second input or snapshot path.

**Changes:**
- `src/game/haptics.ts` owns a small `Haptics` device layer. It calls the standard
  `vibrationActuator.playEffect('dual-rumble', ...)` when available and falls back to the older
  `hapticActuators[n].pulse(value, duration)` surface. A pad with neither is silent; sync throws and
  rejected promises are swallowed.
- `Input.activePad()` exposes the pad only while the gamepad owns input, so keyboard/mouse play never
  rumbles a connected controller.
- Six cues live in `tuning/world.json` under `HAPTICS`: `tap`, `guard`, `hit`, `blast`, `heavy`, `death`.
  Light cues are spaced at least 55 ms apart so a frame cannot stack a swing, hit and death into noise.
- `main.ts` wires cues to a local swing/dash, deflect, heavy beam, nearby explosion, a spent health
  segment and death. Haptics are dormant in attract/kiosk and stress runs, under a menu overlay, and
  during the loading intro. `SETTINGS > FEEDBACK > RUMBLE` persists at `deflect.rumble`; the existing
  TEST HIT FEEDBACK button also proves a pad's actuator. Build stamped 0.1.61.

**Verification:** `npx tsc --noEmit` clean; `npm run build` clean. In the dev gauntlet with a synthetic
standard gamepad, `playEffect` recorded two 180 ms hit cues and a 70 ms dash tap. Swapping in a legacy
`pulse` shim recorded 0.55/180 ms. Toggling RUMBLE OFF suppressed the test cue and ON restored it; a
reload restored RUMBLE OFF from storage until it was turned back on. No physical pad was tested.

**Next:** play a run on a real DualSense/Xbox pad and tune the six strengths/durations if any cue is too
subtle or too strong at couch distance.

## 2026-10-30 — Bots guard sentry fire (v0.1.62)

**Goal:** the attract pilot almost never raised its shield. The guard was written, but the demo is a
gauntlet run, and gauntlet fire was invisible to the bot's defence filter.

**Changes:**
- `canDeflectShot` in `bot.ts` now accepts every shot type the world's guard/lash can send back (all but
  mines 1, bug walls 2 and bomber shells 8/9). The old `threatType === 0` check only allowed player bolts;
  sentry bolts are type 3 and missile pods type 4, so the shield and close swat branches never fired in
  the demo.
- Guard chance is 0.85 (was 0.7) and the bot's breather is 0.9–1.8 s (was 1.2–2.4 s). The dodge remains
  the answer when the guard is cooling down, and the pilot does not chain shields indefinitely.
- Close-range swat now reflects sentry shots too, not just player bolts. Bombs, mines and bug walls are
  still dodged rather than guarded. README and AGENTS D6 record the type rule; build stamped 0.1.62.

**Verification:** `npx tsc --noEmit` and `npm run build` clean. A headless wave-72 gauntlet simulation
ran Probe, Sweep and Atomize for 45 s on three seeds each. Every run reflected sentry fire: 14–53
deflections and 1.8–6.6 s of active guard time; six of nine pilots survived the full 45 s. The deflections
are guard catches (`EV.DEFLECT`), not merely shield idle time.

**Next:** watch a full `?demo=true` loop and confirm the shield plus deflect spark reads at the demo
camera zoom; then check the higher guard rate in VS BOTS so HARD bots do not turn into turtles.

## 2026-10-30 — Campaign calibration and kiosk wordmark (v0.1.63)

**Goal:** open `BUILD ROOT` with the authored calibration exercise (dormant shapes that wake, spin and
attack), and make `?demo=true` a clean display loop showing only the game wordmark.

**Changes:**
- `World` now scripts six calibration subjects before the drill: blue circles, red triangles and yellow
  rectangles, two of each. They are sentry kinds 4-6, so the existing player weapons, projectiles and
  damage path already hit them. Kind 4 dashes and bounces, kind 5 floats around its anchor while a
  sixteen-shard cloud churns (kind 7), and kind 6 bobs in place while cloning an axis-aligned row left
  and right (kind 8), then the whole row dashes together. A parent takes its children with it.
- Dormant subjects are hit-immune and wake the class instead. They wake on the 6 s timer, on proximity,
  or on a hit. Awake subjects carry a small red eye and run their own attack timers until the drill.
  `CALIBRATION` in `tuning/campaign.json` owns layout, wake, damage and cooldown numbers.
- Calibration kills do not count toward the assault clear, drop pickups or score. Arena emitters stay
  parked for the prologue so a stray beam cannot interrupt the lesson.
- Renderer draws the three primaries, the circle/triangle spin, the wake ring and the red eye. This pack
  deliberately has no lane, arrow or link lines: the switch from passive to attacking is the read.
  Minimap marks use the shape silhouette. Campaign banners add `CALIBRATION` and `SUBJECTS AWAKE`.
- Kiosk runs cycle one, two and three local BotBrain-driven pilots. Three-player runs filter to compact
  solid arenas so the whole arena fits one pane and the split camera never fires. Squadmate deaths
  respawn on the training timer and pay no kill credit.
- `?demo=true` card is now only the `DEFLECT_` ASCII wordmark: no `GAUNTLET` or mode kicker, 60 s fade
  cycle, pointer-events off. The README top has a demo link and clickable capture. Vite's watcher ignores
  `screenshots/`, which was causing full-page reloads whenever a capture was saved during a kiosk run.

**Verification:** `npx tsc --noEmit` and `npm run build` clean. Headless `World('gauntlet', campaign)`
run: six dormant subjects, then wake and attack after the timer; the triangle cloud peaked at 27-28 live
shards, the yellow row grew left/right and charged together, and the local body took circle/shard/echo
damage; killing all six started the drill in the same tick and left `gauntletKills` at 0. Browser runs at
1280x720 confirmed the red eyes, the floating triangle parent, the axis-aligned yellow row and the absence
of lane/arrow/link lines; the emitter was absent during calibration. `?demo=true` showed the `DEFLECT_`
wordmark over a live arena with no mode text. Console logs confirmed the cycle 1P → 2P → 3P, with the 3P
runs selecting GRID ZERO / SWITCHBACK; a manual three-pilot seed stayed in one camera pane.

**Next:** play the prologue with a pad and tune the wake radius/layout and attack cooldowns; watch a
deployed kiosk loop through death and restart to confirm no mode text flashes.

## 2026-10-30 — Calibration triangle drifts free (v0.1.63 tuning)

**Goal:** the red calibration triangle read as a stationary target. It is meant to be the watchful parent
behind the shard cloud, so it should float the whole time.

**Changed:**
- `updateTriangleSubject` drops the anchored orbit loop. The parent now drifts on a slowly wandering
  heading (sine turn, `floatTurn`/`floatTurnRate`), holds a loose band around the player
  (`floatRing` 250: re-aims the heading home past 1.35x, away inside 0.6x instead of adding a canceling
  vector), and reflects its heading off an inset border (`floatMargin` 130) so it never grinds the arena
  clamp. `floatSpeed` 34 → 44. Position is still eased, so direction changes read as floating, not snaps.
- The triangle reuses the parked sentry `orbitA`/`orbitR`/`orbitDir` fields as heading, home radius and
  turn sign; spawn seeds them per subject. No new snapshot or protocol fields; calibration stays local.
- AGENTS D17 and the v0.1.63 TODO entry now describe the drift and warn against anchoring the parent.

**Verification:** `npx tsc --noEmit` clean. Headless campaign run (`World('gauntlet', campaign)`) sampled
both parents each second for 25 s: they move at 23-44 u/s continuously, cross the room instead of holding
an anchor, stay inside 96-560 units of the player, and never pin against a wall. Browser run through
`SINGLE PLAYER > CAMPAIGN > SLOT 1 > NO BOTS > PROBE` confirmed the same drift live in the prologue.

**Next:** play the prologue with a pad and tune `floatSpeed`/`floatRing` if the parent drifts out of the
fight or crowds the player.

## 2026-10-30 — Jump-scare throws the ring clear (v0.1.63 tuning)

**Goal:** the Ghost jump-scare only nudged bodies. It should shove every enemy and player caught inside
its 210-unit ring out of the ring when it fires.

**Changed:**
- `fireJumpScare` now runs `evictJumpScare` after the blast. It is a target displacement, not a flat
  impulse: each survivor gets exactly the outward knock that covers the gap to `scareRadius` plus
  `scareClearance` (30), using its own drag (`need * drag`, because a decaying knock travels `v0 / drag`),
  and only tops up the outward speed the body already carries.
- Covers players (drill bots and other local bodies), sentries, worms and viruses. Cover still cuts the
  wave, a body riding a pad/lift is left alone, dormant calibration subjects stay asleep, and rooted
  cascading-error blocks are unchanged by design.
- `evictJumpScare` / `shoveClearOfBlast` live in `World`; `GHOST.scareClearance` is the only new number.
  No snapshot or protocol fields; the kit stays local-only.

**Verification:** `npx tsc --noEmit` clean, `npm run build` clean. Headless Ghost gauntlet: a sentry at
40 units ended 234 out and a second player body at 60 units ended 251 out, both past `scareRadius` 210;
the caster took no damage and the sentry's knock came only from the eviction (blast damage does not push
threats). AGENTS D26 and the README control/QA text now describe the eviction.

**Next:** play a Ghost gauntlet run on THE LEDGE and check that a scare can shove a threat over the lip;
tune `scareClearance` if bodies settle back in too quickly.

## 2026-10-30 — Overcharge winds up and cools down (v0.1.63 tuning)

**Goal:** the OVERCHARGE powerup's beam snapped on and off between frames. Give it a fast version of the
heavy beam charge animation, and leave particles behind when it stops.

**Changed:**
- `Player.ocChargeT` / `Player.ocFadeT` (local only, never in `Snapshot`). Holding ranged fire under
  OVERCHARGE now plays a `POWERUP.overchargeSpinup` (0.14 s) wind-up before the beam exists; the beam
  itself is unchanged (0.06 s slices while held, no cost, no root, no cooldown). Releasing during the
  spin-up cancels it, matching the heavy's release-before-charge rule.
- On release the beam stops on that frame, starts a `POWERUP.overchargeFade` (0.2 s) afterglow, and emits
  the additive `EV.BEAM_END` with the muzzle, facing and solid reach. FX sprays embers along the shaft
  and a small puff at its stop; the renderer draws a cooling shaft and stop star for the fade. Damage
  still ends the moment the trigger is released.
- `drawBeamCharge` extracts the orbiting-dot charge ring so Probe's heavy and the overcharge spin-up share
  one drawing, at a tighter radius for the powerup. A live charged heavy is untouched: the afterglow and
  the stop event only fire for the short overcharge beam (`laserT <= 0.12`).
- Death, respawn, powerup expiry and swapping to another timed drop all clear both timers.

**Verification:** `npx tsc --noEmit` and `npm run build` clean. Headless training run with the powerup
forced: the beam first exists on frame 8 (0.14 s), stays live while held, and on release `laserT` is 0,
`ocFadeT` is 0.200 and one `BEAM_END` arrives with reach 384. Browser run at 1280x720 (training, Probe,
overcharge forced): the spin-up ring and the lightning core render, the held beam draws its normal layers,
and the fade renders as a dim cooling shaft with no console errors. AGENTS D12 and the README powerup
lines are updated.

**Next:** play with the real pickup in the gauntlet and tune `overchargeSpinup`/`overchargeFade` if the
wind-up eats quick taps or the afterglow lingers too long.

## 2026-10-30 — COMPRESS.EXE: pressure orbs, size dash, pressure burst (v0.1.64)

**Goal:** add the tenth program, Compress.exe: a vice mark, six Z health segments, a shrinking orb, a
fast small skill and a room-wide pressure burst.

**Changed:**
- Roster entry 9 (`bugKind` 12), archive orchid `PROGRAM_COLORS.compress` `#c46bff`. The hull is six
  upright capital Zs on an orbiting ring at `0.8r`; the core is `drawCompressMark`, a threaded screw
  pressing a jaw onto a block on a base plate. `⊟` is the text stand-in only. Letters stay upright while
  the ring turns: the first pass rotated each Z with its angle and four of six read as Ns.
- Ranged type 13 pressure orb: 560 u/s, 1.05 s, radius 9, 1 damage, 340 shove, no trail. A hit multiplies
  the target's body scale by 0.85 (floor 0.35) and cuts its health cap by `max(cap * 0.10, 1)`, clamped at
  1. The cap loss is permanent until the body respawns; `clearPlayerForSpawn` restores the program pool and
  `shrink = 1`. Sentries and viruses scale their `radius` so the hitbox follows; worms carry `shrink` for
  the drawn head/chain only; error blocks only lose health. Player shrink also changes the projectile and
  bomb hit radius, but cover/bounds still use `PLAYER.radius`.
- Skill: `shrinkT` 3.5 s at `skillSpeed` 1.85 walking speed, with an extra `skillScale` 0.62 visual fold
  and a squeeze ring. No iframes; attacks, dashes and guard still work. Cooldown is the new
  `BUG.cooldown[12]` = 7 s.
- Power: hold 0.6 s for a 230-radius pressure burst. Each body inside loses half its scale and health cap;
  a body at 1 health is crushed through its normal damage path. Cover cuts the wave, pad/lift riders and
  dormant calibration shapes are skipped, and the caster is exempt. Survivors take no direct damage.
  `COMPRESS.powerCooldown` is 8 s. Bots hold it when the target is inside `powerRadius - 30` and tap the
  sprint to close or leave a 120–420 unit gap.
- Renderer: ring-and-caret orb, contracting heavy charge ring with eight inward ticks plus a faint radius
  circle, sprint chevrons, skill/heavy dock marks, and `EV.COMPRESS` (purple squeeze pop / wide burst ring;
  `P_COLOR_COMPRESS` is the new palette entry). Respawn and death clear the sprint and restore the pool.

**Verification:** `npx tsc --noEmit` and `npm run build` clean. Headless checks: orb spawns as type 13 at
560 u/s; first hit takes 3 hp to 2, cap to 2, shrink to 0.85; second hit caps at 1/1 and shrink to 0.7225;
the sprint reports `shrinkT` 3.5 and covers 210 units where a walk covers 114; the burst halves a bot's
scale/cap and de-rezzes a 1-hp body; a pulse sentry goes from radius 18 / hp 2 to radius 9 / hp 1. Static
hull harness shows the six Zs upright at full and three-segment health with the press mark clear of the
hull; the attract rotation already logs a 3P Compress squad with no console errors.

**Next:** play a full VS BOTS set as Compress and decide whether two orbs (3 cap → 1) is too much of a
cliff for a player target; check the Z ring at the 0.35 shrink floor and the burst at kiosk distance.

## 2026-10-31 — DISK PLATTER: round floor, moving holes, read arm

**Goal:** add a ninth arena built around a spinning hard-disc platter, with holes that move and a read arm
that can shove bodies into them.

- `ArenaDef.disc` owns a 690-radius plate, its spin, nine polar holes and a read arm. The square bounds are
  only the camera frame; `walls: 'open'` and `offFloor` read the circle. Holes turn at 0.075 rad/s, so the
  same hole geometry the world tests is what the renderer draws.
- The read arm pivots just outside the rim, crosses the spindle at rest, and follows an 11.5 s sine sweep
  (0.55 rad, 44 thick, reach 1.06r). Contact separates a body and leaves a 360 tangential shove; it never
  damages directly. It covers players, worms, viruses and sentries.
- A body pushed over a hole starts the existing 0.6 s fall hang, aimed at that hole; a dash still clears
  one, but landing inside starts the hang. Threats are clamped to the rim after every family update and are
  still deleted by holes through their normal damage path. Bots steer off the rim and the current hole
  positions; the no-hostile drift got its own steer because it bypasses `avoidFurniture`.
- The plate render is a clipped round floor with rotating servo tracks, 24 sector seams, three platter arcs,
  spindle hub, cut holes with lit lips, rotating rim ticks and a full read arm with pivot housing and head.
  The minimap and arena picker use the same hole/arm helpers.
- Online rooms keep the plate and static holes but park the spin and arm: the snapshot carries no disc
  phase. Local training, gauntlet and campaign get the moving floor.
- One spawn sat on a hole at phase 0; hole 3 moved to angle 2.55 and radius 500 so spawn 5 is clear and
  no hole crosses the 560 spawn ring. An idle gauntlet start was dying to a drifting hole at ~8 s; with
  hole 3 pulled in, an idle world survives 30 s (the arm merely shoves it near the rim). Future hole edits
  must be checked against the spawn ring at t=0.

**Verification:** `npx tsc --noEmit` clean; `npm run build` passes. Headless: after 2 s `discT` 2.00 and
`armAngle` moved 3.492 → 3.980; a player placed on a moving hole gets `fallT` 0.60 and is dead after the
grace; six steps on the arm move the body (-8.9, 24.4) with a 118/-297 residual shove; crossing the rim
starts a 0.60 hang. A 60 s training run with a HARD pilot recorded 2 deaths and 72 fall ticks, so the floor
is dangerous but not constant. Live visual at `?gauntlet=1&arena=8&debug=1` shows the round plate, moving
holes, moving arm and minimap. The first hands-off bot test walked into a hole at 1.7 s; the idle-drift hole
steer fixed it, and the same pilot now skirts the holes. An idle 30 s run after the hole-3 pull-in
remained alive, so a player reading the intro is not dropped before the first pack arrives.

**Next:** judge the arm's shove at couch distance, then watch a full bot round for repeated hole walks and
decide whether online needs a disc phase.

## 2026-10-31 — Blasts are red and orange only (tuning)

**Goal:** make a detonation read as an explosion first, not as another body de-rezzing, and stop a blast
from borrowing the shooter's programme colour.

- `EV.EXPLODE` now draws only `P_COLOR_BLAST_ORANGE` (`#ff9a1f`) and `P_COLOR_BLAST_RED` (`#ff2a18`):
  orange outer ring and burst, red inner ring, a 65/35 split of orange and red triangle shards, and no
  white. The impact flash tint moves from cream to `#ffb27a`. The shooter's slot colour is no longer read
  by this event, so Kaboom's bombs, the mine and the drone burst all share one hot palette.
- Body deaths are untouched: `EV.ELIMINATED`, `EV.WORM_KILL` and `EV.VIRUS_KILL` keep their threat tint
  plus white shards, which is now the clear visual difference between a kill and a blast.
- Docs: AGENTS D16 records the blast palette rule. No tuning JSON or protocol change; this is an FX-only fix.

**Verification:** `npx tsc --noEmit` clean. A headless `Fx` check fed one `EV.EXPLODE` (slot 7, power 116)
and found 54 active particles in exactly two colours: 38 orange and 16 red, with no owner colour and no
white. The temporary script was removed.

**Next:** judge a bomb carpet and a mine at couch distance; if the blast reads flat, lengthen the shard
life rather than adding a third colour.

## 2026-10-31 — PINBALL.EXE: ricochet ball, flipper arm, giant ball (v0.1.66)

**Goal:** add the roster's ricochet specialist, built around a ball that gets hotter as it pins around the
arena, a long-lived flipper that returns fire, and one huge wall-only super ball.

- Identity: id 10, cabinet blue `#4d8bff`, circular three-arc hull, vector circled-X (`drawPinballMark`)
  at the core and a `⊗` text glyph. The hull uses the shared circular path, so the three health segments
  keep clear of the core mark at every level.
- Movement: `Player.dashMax` carries three dodge charges for Pinball while every other program keeps two.
  `guardMax`/`guardReach` make the held shield 1.85x longer and 1.65x wider; the world guard, barrier bat
  and drawn crescent all read those fields.
- Ranged: type 14 ball, 520 u/s, 4.2 s, 24 bounces. Walls, pillars and Wedge walls gain 10% speed per
  bounce; each body gains 8%; both cap at 1480. One pass per body, damage climbs 1 → 2 → 3 → 4 → 5 and the
  fifth hit retires the ball. It bounces through the usual wall/pillar path instead of the committed heavy
  list, so it does not die on its first rail.
- Skill: a fixed flipper arm planted 30 units in front for 16 s, sweeping ±1.15 rad. Hostile shots are
  re-aimed at the nearest other enemy at 1150 u/s and returned as plain bolts (bombs keep their shell);
  bodies take 1 damage and a 1500 shove toward another enemy, one swat per 0.2 s. The base life arc is the
  only timer.
- Power: hold 0.7 s for type 15, radius 46, 3 damage, 7 s at 430 u/s. It bounces off arena walls only and
  passes through pillars, barriers, webs, props and bodies, hitting each body once. Guard and swing cannot
  turn it.
- Bots: engagement range uses the ball's own speed/TTL, not the bolt's 310 units, and a dedicated branch
  plants the arm at 90-360 units. Generic heavy hold builds the giant ball.
- Docs: AGENTS D31 (plus D4/D10 roster notes), README roster/QA lines, TODO v0.1.66. Build stamped 0.1.66
  in `index.html`, `main.ts`, `sw.js`, `package.json` and the lockfile.

**Verification:** `npx tsc --noEmit` clean; `npm run build` passes. Headless: Pinball reports dash 3/3,
guard 1.85 s and reach 95.7 (base 1.0/58); a tap deploys `armT` 16; a hostile shot near the paddle returns
owned by slot 0 as type 0 at 1150 u/s; a body on the blade drops 5 → 4 hp with 1500 knock; a wall bounce
takes the ball 520 → 572 u/s; the damage ladder reads 1,2,3,4,5 and retires the ball on the fifth; the
super ball reports radius 46, damage 3, survives a body hit and bounces off a wall without deactivating.
A 20 s HARD bot run produced balls, supers and an arm deployment with no errors. Live check on CROSSROADS
confirmed the roster card, three-chevron dock, flipper bat and both ball silhouettes.

**Next:** play a full VS BOTS set and decide whether 16 s of arm uptime is too much lane control; then watch
the 24-bounce rally at couch distance. The kit is local-only, so no snapshot work follows.

## 2026-10-31 — Wider program grid, smaller squares (layout)

**Goal:** bring the player-character picker in line with the level/arena grid: use the whole stage width
and more, smaller square cards instead of a narrow centered three-column block.

- `.console-program-grid` now uses `repeat(auto-fit, minmax(148px, 1fr))` with no `max-width`, so it fills
  the same 1040px stage as the arena picker: six squares per row at desktop width (6 + 5 for the current
  eleven programs) instead of three 258px cards inside an 800px block. Narrow windows fall to five, four
  or two columns automatically; the fixed three-column rule is gone.
- Program name and role type step down with the cards (`13-17px` name, `10-13px` role) so the smaller
  square never crowds its label. The short-viewport `max-width: 700px` override is removed, so 720p keeps
  the same wide grid.
- Menu navigation is geometric, not column-count based, so the d-pad and arrow cursor follow the new rows
  without a code change. No HTML, tuning or version change; this is CSS only.

**Verification:** dev at 1280x900 shows six columns in the first row and five in the second, all 167px
squares spanning the stage width; at 1280x720 both rows still fit without scrolling.

## 2026-10-31 — Docs split: README for builders, GAME_GUIDE for players (docs)

**Goal:** stop the README from carrying the whole game manual. It should explain how DEFLECT is built,
why it stays fast on weak hardware and how multiplayer works; gameplay specifics belong in their own file.

- Added `GAME_GUIDE.md`: playable modes, the one-stick rule, controls and touch layout, the full
  attack/skill/power table, pickups, all nine arenas plus traversal and laser emitters, training tiers,
  gauntlet threats, the campaign node, the kiosk demo, QA hooks and the test checklist. Copy moved from
  the old README, with the Pinball dash/shield notes folded into the shared tables.
- Rewrote `README.md` around the build: stack table (TypeScript, Canvas 2D, Web Audio, Vite, PeerJS,
  PWA), the fixed-step loop and simulation/render split, content-as-data, a code map, measured bench
  results, the techniques that keep it fast, PeerJS topology and bandwidth, PWA trade-offs, gamepad and
  touch input, then the roadmap (Tauri desktop, Android APK, cross-platform rooms, local mode, discovery,
  more campaign nodes), development commands and docs links.
- `AGENTS.md` §1 now lists `README.md` and `GAME_GUIDE.md` with their scopes, and the repo map includes
  the guide. D10 points player-facing names at the guide instead of the README.
- Measurements quoted in the README: today's `npm run bench` (0.035 ms avg 2P through 0.465 ms avg
  gauntlet max) and a fresh 8P/48-projectile BinaryPack snapshot at 2506 bytes (2.45 KB, 73.4 KiB/s per
  guest, ~0.50 MiB/s host upload at 30 Hz with 7 guests). Build size from the current Vite output:
  589.03 KB JS / 164.31 KB gzip plus 48.65 KB CSS / 10.92 KB gzip.

**Verification:** docs only; `npx tsc --noEmit` and `npm run build` still pass, and the README/GUIDE links
resolve on the repository page after push.

**Next:** keep new kit and threat numbers in `GAME_GUIDE.md`; the README only gets architecture,
performance or delivery changes.

## 2026-10-31 — Music mix: an audible bed with sustained chords (audio fix)

**Goal:** find out why the lofi-house soundtrack cannot be heard on a Linux laptop, and make it audible
without touching the combat cues.

- Ruled out MIDI: the soundtrack is synthesized. `MUSIC_CHORDS`/`MUSIC_BASS` are MIDI note numbers turned
  into Hz and played by `OscillatorNode`s, nothing is loaded from disk, and no host MIDI device is used. A
  laptop without MIDI support plays it exactly like any other machine.
- Cause 1, level: the music bus was 0.24 while the chord voices peaked at 0.015, which puts the whole bed
  near −59 dBFS, against roughly −28 dBFS for one bolt. Thirty-one dB under the cues is not a "quiet mix",
  it is silence on laptop speakers.
- Cause 2, envelope: `tone()` ramps its gain exponentially to 0.0001 across the note's own length, so a 2.2 s
  chord was already at 4.6 % of peak one second in. The loop had no sustained body in the 250 Hz–2 kHz band
  that laptop speakers actually reproduce, and the kick and bass sit below their rolloff.
- Fix: named `MUSIC_BUS_LEVEL` at 0.5 (replacing the two 0.24 literals), raised every music voice gain to
  match (chords 0.085/0.05, bass 0.26/0.2, kick 0.3, clap 0.11, hats 0.05/0.07), lifted the vinyl bed to
  0.09, and added a `pad()` voice — quick attack, held level, 0.38 s tail — for the chord hits and bass
  roots. Drums and cues keep `tone()`/`noise()`; the master, the compressor and the 7 kHz music low-pass are
  unchanged.
- Investigated and deliberately unchanged: the program picker. The 2-day-old 4-program screenshot showed a
  wrapped fourth card and two bright boxes; HEAD already fixes both (`2f303a3` widened the grid, and
  `.selected` is a dim border plus a dot while only the cursor carries the bright ring). Live DOM read at
  the GAUNTLET stage: 11 cards at 163×209, canvases 145×145 inset 9 px on both sides, rows aligned at
  y=253/y=474, exactly one `.selected` and no stray `.nav-focus`.
- Noted for the player, not changed in code: mute is persisted in `deflect.muted`, so a stray `M` press
  silences everything including the bed until it is toggled again, and the loop only starts with a match —
  menus are intentionally silent.

**Verification:** `npx tsc --noEmit` clean, `npm run build` passes (589.45 kB JS / 164.41 kB gzip,
48.60 kB CSS). Measured in the dev page through the engine's master tap: with the gain pass but before the
sustained envelope the loop read −21 dBFS peak / −41 dBFS RMS; after the pad it reads −18 dBFS peak /
−32.7 dBFS RMS against a −21.8 dBFS bolt peak, so the bed sits about 11 dB under the cues.

**Next:** listen on the laptop speakers at the default 65 % soundtrack; if the hats still disappear, lift
the 6–8 kHz region rather than the whole bus. Decide whether the menus should get music.

## 2026-10-31 — Menu music: a quieter bed on every menu screen (v0.1.67)

**Goal:** the title, program-select, settings and lobby screens were silent. Give them a bed of their own
without competing with the match loop, and without a second scheduler to keep in sync.

- One scheduler, two patterns. `startMusic(mode)` takes `'match' | 'menu'`, applies `MENU_BUS_TRIM` (0.6) to
  the music bus, and restarts the note clock on a mode change so the two beds never overlap;
  `startMenuMusic()` is the menu entry point. Drums, vinyl and the 7 kHz low-pass are shared.
- Menu loop: 62 BPM over the same Cmaj7/Am7/Dm7/G7 changes, no kick and no clap, one 2.9 s held pad per
  bar, a bass pad with a fifth lift, one soft bell on the off-beat and a very quiet closed hat.
- Wiring: `setScreen` stops music for `game` and starts the menu bed for every other screen; `unlockAudio`
  starts it on the first gesture outside a session, so a clicked title screen is never silent.
- `?debug=1` now exposes `audio` beside the renderer/world handles, so the mix can be measured in place.
- Build stamped 0.1.67 in `index.html`, `main.ts`, `sw.js`, `package.json` and the lockfile.

**Verification:** `npx tsc --noEmit` clean; `npm run build` passes. Measured live through the debug audio
handle at the title screen: menu bed −24.5 dBFS peak / −35.6 dBFS RMS; `startMusic()` flips the mode to
`match` with trim 1 and reads −14.4 / −28; `startMenuMusic()` returns to `menu` with trim 0.6. The menu bed
sits about 7–8 dB under the match loop.

**Next:** audition title → program select → match → title and confirm the handoff; decide whether the
attract/demo kiosk should keep the match bed or the menu one.

## 2026-11-01 — INFECTION: a timed swarm clear (v0.1.68)

**Goal:** add the second planned mode: an arena flooded with a growing virus colony, cleared against the
clock, with a 0–100% virus-cleared readout at the top of the screen and a local best time.

- The mode runs `World('gauntlet', …, infectionMode=true)` and keeps the `gauntlet` mode string, the way
  the campaign does, so the threat, camera, freeze and overlay paths did not fork. The virus pool grows
  from 10 to 44 for this run only.
- Twenty-four viruses open on a ring around the player and the colony buds one body every 1.6 s to the
  cap. They hunt across the whole floor at 1.16x speed instead of the gauntlet's 310-unit interest radius.
  The first pass opened with sixteen and a 3.2 s bud; the autopilot cleared that in 4.8 s, so the flood
  was raised until a clear was a real run.
- `infectionProgress = kills / (kills + live)`, capped at 99% while anything lives, so a split sets the
  meter back and only an empty floor reaches 100%. The HUD is one top-centred bar with the percentage and
  the run clock; the gauntlet's bottom possession strip is suppressed in this mode.
- The first probe exposed a real problem: sixteen bodies each committing the single-target charge deleted
  a stationary player in 2.97 s and froze the run before the first growth beat. The mode now disables the
  charge, bites on contact for 1 and a 540 shove, and shares a 0.85 s grace so the pack cannot stack a
  kill on one frame. The infection meter and thrall spawn are skipped in this mode.
- Pickups, kill drops and friendly fire are off, so a best time cannot come from a random roll or a colony
  that thins itself. Arena emitters and floor hazards still run.
- `infectionRecords.ts` keeps one best per arena under `deflect.infection.bests` in `m:ss.d`; the results
  overlay records a clear once and offers RETRY / ARENA / TITLE. The solo menu shows the fastest sweep.

**Verification:** `npx tsc --noEmit` clean; `npm run build` clean (596.45 kB JS / 166.18 kB gzip, 48.60 kB
CSS). Headless probe (`.tmp/check-infection.ts`): 44-body pool, 16-body opening flood, 0% start, one kill
credits and moves the meter to 1/16, the colony buds by 4 s with the clock running, no worms/sentries/
errors/pickups appear, sweeping the floor closes the run at exactly 100% with the clock frozen, death sets
the failed state, and the ordinary gauntlet still has its 10-body pool and no infection flag.

**Next:** playtest a real clear on CROSSROADS and DISK PLATTER, then tune opening count, growth interval
and the bite grace. The new arena brief is still outstanding.

## 2026-11-01 — COPYPASTA.EXE: chain files, a bot copy and a redaction super (v0.1.69)

**Goal:** add the roster's duplicate program from the design brief: an overlapping-square mark, file icons
as the health hull, a file projectile that splits into two on impact, a bot-controlled copy, and an AOE
that covers enemies in a growing stack of red files before it detonates.

- Identity: id 11, `DUPLICATE`, highlighter-yellow (`#ffe95c`), three upright file icons at 0.8r (one per
  health segment) and a vector two-square copy stamp. The file hull's inner edge is 0.61r, so the bright
  segments stay outside the core disc at full health.
- Ranged: one file (type 16), 1 damage, 620 speed, 1.15 s. On a body it tears into two smaller files that
  fly out at 0.72x speed for 0.55 s. Children carry `variant` 1 and never split again, so a shot cannot
  cascade into a projectile hose.
- The first probe exposed the important bug: children spawned six units from the hit point, inside the
  victim's hitbox, so both immediately re-hit the same body. That made every file a guaranteed 3-damage
  burst. The split now starts 26 units outside the struck body; the probe verifies two live children, one
  file of direct damage, and no re-split.
- Skill: one copy body on slot 7 for 8 s with 3 health. It writes the ordinary `InputFrame`, so it obeys
  one-stick facing, swing locks, dash charges and energy. It hunts threats in gauntlet, other programs in
  bot matches and the infection thrall, and trails its owner when the room is clear. It is excluded from
  `activeCount`, `aliveCount`, round survival and round spawns, and it never casts a second copy.
- Power: a 280-unit redaction ring. Enemies in line of sight grow 1 to 6 red file icons over 1.6 s, then
  take 2 (players) or 3 (threats). Cover blocks the cast; the mark follows the body once applied.
- Bots cast the copy at 120–380 units and use the file's own flight time for their engagement band. The
  generic heavy hold builds the redaction.
- The kit is local-only like every program; no snapshot fields were added. Marks live in a local 16-slot
  pool and the renderer reads them through `RenderState.copyMarks`.

**Verification:** `npx tsc --noEmit` clean. `npm run build` clean: 608.55 kB JS / 168.95 kB gzip, 48.60 kB
CSS / 10.90 kB gzip. Headless probe `.tmp/check-copypasta.ts` passed 19/19: two children on hit, direct
damage of one, no child re-split, copy spawn on slot 7, copy excluded from both counts, copy moves/fights,
copy expires at 8 s, redaction spends 55 and starts its 10 s cooldown, mark grows from 1 to 3 icons, 2
damage on detonation, mark clears, a pillar blocks the cast, and neither the owner nor the copy is marked.
Live browser at 1280x720: the select grid shows `COPYPASTA.EXE // DUPLICATE`; training starts with program
11 and `bugKind` 14; the copy appears on slot 7 with `copyT` 7.4 and counts stay `[1,1]`; the redaction
mark goes 1 → 3 icons over 0.8 s and the target drops 2 health; no console errors.

**Next:** human playtest the chain spacing, the copy's 8 s window and the redaction's 2/3 damage. The new
arena is still blocked on a layout brief.

## 2026-11-01 — COPY_PASTA.EXE display spelling (v0.1.70)

**Goal:** the brief spells the new player character `copy_pasta.exe`; the first ship used `COPYPASTA.EXE`.

- Renamed only the roster display string to `COPY_PASTA.EXE`, matching the `BAD_LAG.EXE` two-word
  convention. The internal key, tuning block, probe and code paths remain `COPYPASTA` so no behavior,
  save data or kit numbers moved.
- No mechanical change: same file chain, bot copy and redaction super.

**Verification:** `npx tsc --noEmit` clean; `npm run build` clean (608.55 kB JS / 168.95 kB gzip, 48.60 kB
CSS). Production select card and How to Play roster read `COPY_PASTA.EXE`.

**Next:** the arena layout brief is still outstanding; Copy Pasta's first human playtest is still pending.

## 2026-11-01 — INFECTION online co-op (v0.1.71)

**Goal:** infection was shipped as a solo mode; it is also a multiplayer mode. Add it to online rooms
without a second simulation or a new transport.

- The room lobby now carries a host-owned `MODE: VERSUS / INFECTION` toggle in the lobby packet and in
  `START`. Guests see the mode read-only. Versus rooms are unchanged.
- The host builds the infection `World('gauntlet', …, infectionMode=true)` with every connected operator.
  Infection setup now preserves connected guests through the gauntlet roster reset and places the squad
  on the arena's spawn points instead of deactivating slots 1+.
- The opening 24-virus flood is distributed around each runner's spawn. Viruses choose the nearest live
  player; contact checks every live runner; the single-target charge stays disabled in infection.
- A downed runner stays active as a spectator and the attempt fails only when no player is left standing.
  The host's result overlay records the clear and offers `RETRY` (rebuild + `REMATCH`) and `LOBBY`; a guest
  gets `LEAVE ROOM`.
- Infection snapshots add `infection` (`progress, clock, kills, cleared, failed, over`) and compact virus
  rows (`id, x, y, phase, radius, spawnT, hitFlash`). `NetView` mirrors the readout and interpolates the
  colony for rendering only. No other gauntlet entity enters the packet.
- Build stamp 0.1.71.

**Verification:** `npm run build` clean: 613.78 kB JS / 170.20 kB gzip, 48.60 kB CSS / 10.90 kB gzip.
`.tmp/check-infection-coop.ts` 21/21: guest slot survives setup, both runners spawn, 24 opening viruses
split around them, co-op clock and budding run, a downed guest stays on the roster without failing the
run, the last death fails it, a guest view mirrors progress/clock/kills and places two virus rows, and a
rematch clears the colony and readout. `.tmp/check-infection.ts` still passes 19/19 for solo infection.
A live PeerJS harness in the dev page connected a real host and guest: the guest saw lobby mode 1, `START`
carried arena 0 and mode 1, and the decoded snapshot had 2 players, 24 virus rows and a 1.5 s clock.

**Next:** two-browser production pass on the lobby toggle, guest mirror, spectator death and host retry;
then tune the shared 44-virus cap for two runners. The arena layout brief is still outstanding.

## 2026-11-01 — NETWORK SWITCH: pipes, hostile files and a firewall starter (v0.1.72)

**Goal:** turn the supplied arena brief into the tenth arena: a rectangle whose destructible pipes feed
hostile files and enemies, plus a one-shot firewall starter at one end.

- New arena id 9, `NETWORK SWITCH`, with a central switchblock cover cluster, eight perimeter spawns,
  four feed pipes and a west-end firewall plate.
- Pipes alternate a hostile file box and a small threat. Hostile files are ordinary `Prop` records with a
  `hazard` flag: they use the existing debris physics, damage a body on contact, and die to one shot.
  Later waves can feed a pulse square instead of a virus.
- Each live pipe has an intake that pulls loose files and small threats into its mouth. It is disabled for
  infection viruses so the pipes cannot raise the clear meter for free. Destroying a pipe stops both its
  emissions and its intake.
- Pipe health is six, read as ticks on the housing. Player shots and blasts chip it; hostile fire passes
  over. The pipe body is mounted through the wall and does not become pathfinding cover.
- The firewall plate starts a sweep from the opposite wall and rearms after `NETWORK.switchCooldown`
  (180 s). Automatic firewalls remain off. The switch is local-only and skipped by hosted rooms with the
  rest of the pipe fixture.
- Build stamp 0.1.72; no snapshot fields.

**Verification:** `npm run build` clean: 623.25 kB JS / 172.76 kB gzip, 48.60 kB CSS / 10.90 kB gzip.
`.tmp/check-network-switch.ts` passes 14/14: four live pipes, hostile file feed, contact damage, intake
catch, shot damage, all-pipe destruction stopping the feed, firewall sweep and the long cooldown gate.
Browser smoke on `NETWORK SWITCH`: four live pipes, three hostile files active after 13 s, no console errors.

**Next:** browser smoke the picker and a live wave, then tune pipe cadence, file speed and catch radius from
play; the arena is intentionally excluded from online rooms until fixture state has a protocol decision.

## 2026-11-01 — COPY PASTA dash afterimage (v0.1.73)

**Goal:** give Copy Pasta's dash a short-lived inert double that can pull enemy attention without adding a
second fighting summon.

- Real Copy Pasta bodies leave an afterimage at the dash takeoff point. It uses a free summon slot below
the fighting copy's reserved last slot, lives 1.5 s, has one health, and writes an empty input frame, so it
never moves, shoots, swings or spends energy.
- Sentries, worms, viruses, the training drone and campaign calibration subjects now choose the nearest
visible body instead of always reading slot 0. An afterimage can therefore take their attention and absorb
one hit. The fighting skill copy is not included in that picker.
- Copy deaths now de-rez without entering the gauntlet kill, pickup or round flow. A summon is not a player
body. Player target lock skips copy bodies so an afterimage cannot steal the lock.
- The afterimage is drawn with the existing copy hull and a fainter, sparser dashed ring. `copyDecoy` is
local-only; no snapshot fields were added.
- Build stamp 0.1.73.

**Verification:** `.tmp/check-copy-dash-decoy.ts` passes 12/12: spawn point, 1.5 s life, one health, inert
input, separate slot from the fighting copy, aggro selection, one-hit removal, no kill credit, a second
afterimage and timed expiry. `npm run build` clean: 624.52 kB JS / 173.01 kB gzip, 48.60 kB CSS /
10.90 kB gzip.

**Next:** browser smoke the dash trail in a live gauntlet, then tune the 1.5 s window and one-hit health
from play. Online matches still run Probe, so nothing enters `Snapshot`.

## 2026-11-01 — AIM_BOT.EXE: scope, rail round, sight clip, six-target volley (v0.1.74)

**Goal:** add the roster's sniper from the design brief: a scope-shaped health outline, one slow but
lethal rail round that ignores range and never bounces, a long lock with a much wider camera, a visible
laser sight with a temporary three-shot clip, and a six-target instant volley.

- Program id 12 (`bugKind` 15), signal red `#ff3355`, role `SNIPER`. The hull is an outer scope circle
  split into three thick brackets, one per health segment, each with one inward tick. The core is a
  vector twin-ring reticle; the select portrait and arena share it.
- Ranged type 17: 3200 speed, 8 damage, 20 s life, 1.65 s reload, 18 energy, no bounce, and it dies on
  the first body or solid. The drawn round is a dark bullet with a white tip and a long red speed tail.
- Lock range is 2400 through `playerLockRange`; other programs stay at the standard range. The local
  camera drops to 0.4x base while Aim Bot is alive and uses a dedicated lock pull that bypasses the
  normal focus-range cap, so a far target stays in frame.
- Skill: 7 s of visible dashed laser sight and a three-shot clip firing every 0.16 s without the normal
  reload. Each clip shot still pays 18 energy; the clip clears when the sight expires.
- Power: up to six bodies in a 0.44 rad forward cone within 2400 units and line of sight get red
  crosshairs for 0.65 s, then each takes a 12-damage shot in a 0.06 s stagger. Cover is checked again
  when each mark resolves. No projectile is spawned for the volley.
- Bots use the rail speed and a 2.4x engagement range; the generic heavy hold builds the volley. The
  program is local-only and adds no `Snapshot` fields.
- Build stamp 0.1.74.

**Verification:** `.tmp/check-aimbot.ts` passes 17/17: program id, reload, type 17, 8 damage, 3200 speed,
20 s life, no bounce, wall death, sight window, three-shot clip, 0.16 s cadence, 2400-unit lock, exposed
lock point, six crosshairs, six 12-damage hits and no volley projectile. `npm run build` clean: 633.28 kB
JS / 175.09 kB gzip, 48.60 kB CSS / 10.90 kB gzip.

**Next:** play a live match and tune the 0.4x camera floor against the real arenas; the avatar must stay
readable at the far edge. Then judge the red crosshair telegraph at couch distance.

## 2026-11-01 — SPACE CADET pinball arena (v0.1.75)

**Goal:** add a tall pinball-cabinet arena that uses the new player's bounce language.

- Arena id 10 `SPACE CADET`: tall bounds, six round posts/kickers, a bottom drain and a right-wall feed.
- Posts reflect shots and shove bodies; kickers launch bodies at 980 and boost shots 1.16x. Aim Bot's rail
  and other committed shapes die on the furniture instead of bouncing.
- The arcade pipe loops file, hostile bouncing ball, virus, sentry. The ownerless type-14 ball keeps its
  wall/pillar rally and can hurt any body.
- Renderer, minimap, arena preview, bot avoidance and AGENTS D35. Local-only; no snapshot fields.
- Build stamp 0.1.75.

**Verification:** `.tmp/check-space-cadet.ts` passes 18/18 (layout, furniture, launch, reflection, pipe
beats, hostile ball wall bounce and drain death). `npm run build` clean: 640.14 kB JS / 176.70 kB gzip,
48.60 kB CSS / 10.90 kB gzip.

**Next:** browser-test the tall camera and live pinball feed; tune the kicker launch and drain size from play.

## 2026-11-01 — INFECTION: left launch, right tide, swarm groups (v0.1.76)

**Goal:** make INFECTION read as an endless colony tide: all operators on the left, all viruses entering
from the right, and higher visual density without adding hitboxes.

- Operators now spawn on one left-side line instead of a perimeter ring. The opening colony is a vertical
  queue beyond the right lip; every opening and split spawn reuses an inactive virus at that edge.
- The recycled body glides in during its existing spawn build (`entrySpeedMult`), so the swarm appears as
  a feed from the right instead of popping in around the players. Entering bodies are skipped by void and
  platter containment until they cross the floor edge.
- `Virus.swarm` draws up to two satellite diamonds around one virus. The satellites are animation only:
  one hitbox, one health point, one kill, no extra pool slots. The field is mirrored in co-op snapshots.
- `INFECTION.leftSpawnFrac`, `entrySpeedMult`, `entryJitter` and `swarmChance` are the new tuning knobs.
- Build stamp 0.1.76.

**Verification:** `.tmp/check-infection-tide.ts` passes 11/11: two active operators on the same left line,
opening colony beyond the right lip, all entries gliding left, swarm satellites on some bodies, unchanged
entity count, movement into the arena, no cull during entry and split re-entry from the right. `npm run
build` clean: 640.83 kB JS / 176.94 kB gzip, 48.60 kB CSS / 10.90 kB gzip.

**Next:** playtest the opening density on SPACE CADET and a small arena; tune `swarmChance` and
`entrySpeedMult` against how quickly the right side becomes a wall.

## 2026-11-01 — AIM_BOT.EXE combat knife melee (v0.1.77)

**Goal:** give the sniper a crowd answer that does not come from the rail: a wider, longer melee with a
harder shove, styled as a combat knife.

- Melee shape is per body now: `Player.meleeReachMult`, `meleeHalfAngle` and `meleeKnock` are set at
  program bind like Pinball's guard reach, so respawn, the renderer and bot spacing share one source.
- Aim Bot: 1.5x reach (78 catch / 108 body), a 219.6 degree sweep (from 180), and a 980 shove (from 560).
- The swing draws as a bowie blade: dark grip and pommel, cross guard, clipped spine, curved belly and
  fuller, with thin ghost blades behind the live arc. Every other program keeps the spiked lash.
- Damage is unchanged. The trade is area and shove, not more damage.
- Numbers live in `tuning/programs.json` under `AIMBOT` (`meleeReachMult`, `meleeArcMult`,
  `meleeKnockMult`).
- Build stamp 0.1.77.

**Verification:** `.tmp/check-aimbot-knife.ts` passes 12/12: the shared lash keeps 180 degrees, 1x reach and
560 shove; Aim Bot measures 219.6 degrees, 1.5x reach and 980 shove; a body at 100 units and a body 106
degrees off facing are missed by the lash and hit by the knife; the knife carries a close body 67 units
against 38. `.tmp/check-aimbot.ts` still passes 17/17. `npm run build` clean: 642.82 kB JS / 177.48 kB
gzip, 48.60 kB CSS / 10.90 kB gzip.

**Next:** browser-check the blade at arena scale (it must read as a knife while sweeping, not a thin
line); tune `meleeKnockMult` if the shove throws bodies into walls too easily.

## 2026-11-01 — Campaign narrative context recorded (docs only)

**Goal:** capture the campaign opening, narration presentation and cast before any runtime work starts.

- Added the narrative spine to `CAMPAIGN.md`: the run opens in a dev system's quarantine section with the
  player's programs flagged malicious and being retrained; the infection breakout is the inciting incident.
- Recorded the narration format: bottom-screen text boxes with a floating emoji/Unicode/Wingdings head for
  the speaker, and the cast: 👮 quarantine manager, 🐱 friendly program who gets the players out, and the
  User/Users AI antagonist at ROOT.
- Recorded the constraints that matter before building it: the text box collides with the campaign
  objective strip at the bottom, colour emoji cannot be tinted, symbol fallbacks need the D16 check, and
  narration stays local and outside `World`/`Snapshot`.
- AGENTS D13 now points at the narrative section; TODO carries the unbuilt checklist.
- Docs only: no code, tuning or build stamp change.

**Verification:** documentation review only; no build run.

**Next:** decide whether THE WARDEN is the quarantine officer, then write the first narration beat around
BUILD ROOT.

## 2026-11-01 — Campaign narration decisions (docs only)

**Goal:** settle the open questions from the narrative spine before any runtime work.

- THE WARDEN is the quarantine officer, not a separate character: he speaks through the opening and the
  LOCALHOST sector gate is his fight. Every roster program is framed as a bad program pulled by antivirus
  and sent to quarantine for retraining, so the program pick is choosing which inmate to run.
- Narration is live over the running simulation and never pauses or dims it, reveals near-instantly instead
  of a slow typewriter, and is skippable per line and per beat.
- Campaign setup will carry a persisted `STORY BEATS` toggle beside `FRIENDLY FIRE`; skipping bypasses the
  beats for that run, for replays.
- Recorded the guardrail that makes skipping safe: beats are cosmetic and may not gate spawns, doors or
  flags gameplay reads.
- Updated `CAMPAIGN.md`, AGENTS D13 and the TODO checklist. No code, tuning or build stamp change.

**Verification:** documentation review only; no build run.

**Next:** write the first quarantine beat around BUILD ROOT once the text box layout is picked.

## 2026-11-01 — Bot balance pass: duels and wave pressure (v0.1.78)

**Goal:** measure the roster against itself with bots and take the worst outliers out of the duel matrix
before tuning gauntlet and campaign pressure.

- Built a headless harness (`.tmp/balance.ts`) on the existing `World` + `BotBrain`: a round-robin duel
  matrix (3 samples per ordered pair, both slots, HARD bots), a rail parameter sweep, a scored gauntlet
  run per program, and a wave-pressure probe that jumps to waves 3/6/9/12/15.
- First stable 72-game matrix: Atomize 87.5%, Aim Bot 75.7%, Kaboom 22.2%, Bad Lag 15.3%. The earlier
  single-sample pass had Aim Bot at 24-0, which was not noise.
- Aim Bot: the 8-damage rail stays, but speed drops 3200→2000, life 20→1.6 s and reload 1.65→2.0 s. At
  3200 the round was hitscan in practice and perfect-aim bots never missed; the slower round keeps the
  one-shot and adds travel time. Final duel rate 72.9%.
- Atomize: cadence 0.34→0.38, seek range 460→380, turn 2.8→2.4, shield cooldown 9→11 s. 6 segments stay;
  the trim is uptime, not the hull identity. Final 79.9%.
- Kaboom: bomb speed 250→330, blast 52→58, cadence 0.9→0.78. Bad Lag: hourglass speed 430→580, body hits
  3→4, cadence 0.62→0.56. Wedge: string speed 730→800, life 0.4→0.5. Final rates 32.6 / 23.6 / 34.7%.
- Gauntlet wave makeup: worm and virus intervals 34→28 s, virus burst size 4→5, sentry interval 30→26 s. The wave probe showed the mid-game room held about one virus and under one worm
  at waves 9-15, and pilots took 1-3 damage per minute; after the change Probe dies at wave 9 and Aim Bot
  at 12 in the sampled windows.
- Harness correction after the first pass: the duel world used `botSlots` 0, so only slot 0 counted as AI;
  slot 1 fired at full speed while its brain still led at the 0.8x enemy speed. The corrected all-AI setup
  (`localSlot` -1, `botSlots` 1) matches projectile speed to lead and was re-run for the final numbers.
- Extended scored run at a 420 s cap shows the kit spread the duel table cannot: Atomize and Compress reach
  wave 15, Kaboom 14, Probe and Ghost 13, Pinball 12, Copy Pasta 11, Wedge and Fisher 9, Toxic 8, Aim Bot
  and Sweep 7, Bad Lag 5. Aim Bot's low gauntlet standing is the no-crowd-clear trade, not a rail bug.
- Build stamp 0.1.78. No new systems, no snapshot changes, no protocol changes.

**Verification:** 72-game matrix before/after, wave probe at five waves, `npx tsc --noEmit` clean and
`npm run build` clean.

**Next:** human playtest the rail travel time and the mid-game gauntlet pressure; bot duels overstate Aim
Bot because the bots aim perfectly, so the next read must come from a person.

## 2026-11-01 — README: engine-free runtime and vector avatars explained (docs only)

**Goal:** explain how DEFLECT runs without a game engine and how characters are drawn and animated.

- Added a README section separating the browser platform (rAF, Canvas 2D, Web Audio, DOM, WebRTC) from the
  purpose-built runtime: fixed-step `World`, collision, kits, bots, camera, renderer, particles and
  netcode. It also records that enemies are hand-written state machines, not engine behaviours.
- Documented the immediate-mode single-canvas renderer and fixed draw order, per-program vector hull paths,
  three-pass additive glow, the hull-as-health readout, vector/text core marks and state-driven animation
  (hull spin, core pulse, dash afterimages, melee arcs, ASCII brooms, pooled trails and particles).
- Recorded the costs: per-frame path and stroke work, cached text metrics and gradients, the DPR cap,
  measured sim tick costs, and the current 643 KB JS / 177 KB gzip plus 49 KB CSS / 11 KB gzip payload.
  Noted there is no automated render benchmark, only the browser stress path and F3 HUD.
- No code, tuning or build stamp change.

**Verification:** documentation review only; no build run.

**Next:** keep the section current when the renderer, camera or asset policy changes.

## 2026-11-01 — Reflected shots get a long life (v0.1.79)

**Goal:** implement the decided reflection rule: no practical distance cap, long life, speed gain and +1
damage on every catch.

- Added `BOLT.reflectTtl` 30 s and reset `proj.fuse` at every projectile catch: guard, lash, bash, net and
  the Pinball arm. Reflected shots no longer die with the original 0.45 s bolt fuse.
- The +1 damage rule was already in the code as `BOLT.damage + proj.deflects`; two catches leave a shot at
  3 damage, so a clean return can delete a three-segment program. Speed gain stays 1.4x per catch up to
  `BOLT.maxSpeed` 2800.
- Bombs 8/9 stay outside the rule, and the Pinball arm's bomb punt keeps its shell identity.
- Updated AGENTS D10, GAME_GUIDE, the tuning README and the version stamps. `.tmp/check-reflect.ts` covers
  guard and lash catches, cumulative damage, speed, the long fuse and bomb exclusion.

**Verification:** `.tmp/check-reflect.ts` 10/10, `npx tsc --noEmit` clean and `npm run build` clean.

**Next:** boss-fight pass; decide whether 30 s and the 2800 speed cap are the right ceiling once long
returns are actually dodged and caught.

## 2026-11-01 — Probe's trap mine and cancelable beam (v0.1.80)

**Goal:** make Probe's mine a persistent trap with a larger blast, shorten the heavy warm-up and let the
player stop firing before the full 3 s root ends.

- `MINE` no longer uses a life timer. `plantMine` stores `fuse = 0`, arms after 0.55 s and leaves the trap
  until a hostile enters its 58-unit trigger. Added `maxActive: 3`; a fourth mine retires the oldest live
  trap because mines share the projectile pool.
- Blast radius 82→132 and knockback 760→900. The renderer drops the countdown arc, keeps a steady armed
  mark and adds a faint outer ring for the larger blast.
- `PLAYER.laserChargeTime` 0.63→0.45. Releasing `CANDLE` while Probe's `laserT` is live ends the beam,
  clears the charge state, frees the body and starts the full 5 s cooldown. Overcharge's beam is unchanged.
- Updated AGENTS D10, GAME_GUIDE, the program card and the tuning README. Added `.tmp/check-probe-mine.ts`.
- Clarified that guard and lash reflection are shared by every program, not just Probe; only the
  charged beam and its release-cancel are Probe-specific. Added `.tmp/check-reflect-all.ts`.

**Verification:** `.tmp/check-probe-mine.ts` 11/11, `.tmp/check-reflect-all.ts` 26/26,
`npx tsc --noEmit` clean and `npm run build` clean.

**Next:** human playtest trap placement and release timing; watch whether three persistent mines plus a
shorter beam make Probe's defensive lane too strong in VS BOTS and local PvP.

## 2026-11-01 — PvE map sweep and Bad Lag durability (v0.1.81)

**Goal:** commit the balance harness, test the roster across every arena in gauntlet mode, and make map
or character changes only where the sweep showed a repeatable outlier.

- Committed `.tmp/balance.ts` as `bf6188c`, then extended it with map id/name/`all` selection, hazard
  labels, map-average survival, wave starts through 24 and a Bad Lag variant sweep.
- Fixed the QA/gauntlet pilot's hazard blindness: static voids are baked into the nav grid, idle drift
  routes through `avoidFurniture`, and emitter lanes get a wider steer away from the beam. This removed
  the all-program wave-1 wipes on THE RING and RECYCLING BIN.
- Bad Lag gets a fourth health segment (eight clock faces). Raw hourglass speed/TTL/damage/hit variants
  did not move survival; the extra segment did: GRID ZERO wave 5→7, RECYCLING BIN 5→10 and duel win
  rate 15.3%→20.8%.
- Tuned the NETWORK SWITCH pipes specifically: first feed 2.2→3.4 s, interval 7.4→8.6 s. Its map average
  rose from wave 7.7 to 9.8 with 9/13 programs reaching the 300 s cap. RECYCLING BIN stayed at 8.3; the
  remaining Probe/Wedge/Toxic wave-3 deaths are left for a human pass rather than a blind compactor nerf.
- No wave-composition change was made: wave samples through 24 showed the families arriving on schedule.
  The next wave pass should follow human testing on the remaining map/character outliers.

**Verification:** 11-map × 13-program gauntlet sweep, focused Network/BIN reruns, GRID ZERO duels,
`npx tsc --noEmit` clean and `npm run build` clean.

**Next:** human playtest the four-segment Bad Lag hull and RECYCLING BIN; then tune wave composition at
waves 18–24 instead of adding pressure that the map hazards already supply.

## 2026-11-01 — Attract pilot uses power attacks (v0.1.82)

**Goal:** determine whether Wedge's plow was too slow or too short in demo play, or whether it was not
being attempted at all.

- Instrumented the headless gauntlet and the pilot state. The gauntlet/attract `engageHostiles` path had
  no power-attack branch; every visible `CANDLE` start was Wedge's wall skill. Across 60 demo-style runs
  the plow fired zero times.
- Added the same held-heavy commitment to `engageHostiles`. It waits for a clean 110–440-unit target,
  holds through the program's charge, and gives Fisher the longer 2.6 s net draw.
- After the branch: 13 plows / 18 hits in five CROSSROADS wave-8 runs; 5–13 plows per five-run cell at
  waves 8/24/72. The timed probe measures 0.567 s charge and 0.517 s active, with a hit at 220 units.
- Kept `WEDGE` timing unchanged: the data identifies the absent branch as the blocker, not the 0.56 s
  charge or 0.5 s active window. A human capture is still needed to judge how clearly it reads at the
  demo's wave-72 opening.

**Verification:** `.tmp/wedge-heavy.ts` demo-style and forced probes, `npx tsc --noEmit` clean, `npm run build` clean and a 60 s all-program gauntlet pass on CROSSROADS.

**Next:** capture the attract loop through a Wedge cycle and watch whether the generic heavy commitment
crowds the demo or makes other kits harder to read.

## 2026-11-01 — Aim Bot range and close-quarters audit (v0.1.82)

**Goal:** determine whether Aim Bot's 8-damage rail and 12-damage volley make it overpowered in PvE, or
whether its lack of crowd clear leaves it too vulnerable once waves and close-range programs arrive.

- 300 s gauntlet, all maps: Aim Bot reached the cap on 8/11 maps. It failed on THE LEDGE (wave 9,
  256.3 s), RECYCLING BIN (wave 1, 10.5 s) and NETWORK SWITCH (wave 6, 159.8 s). The failures are map
  hazards/first-stroke compactor deaths, not wave damage.
- Its kill efficiency is high: 47 kills on CROSSROADS and GRID ZERO, 56 on SPACE CADET, and above the
  map average on 7/11 maps. The rail one-shots ordinary threats and the volley clears packs, so PvE
  damage is deliberately elite rather than a close-range failure.
- Close duels: 73.6% on DISK PLATTER, 77.8% on THE RING and 62.5% on SPACE CADET. It was second on two
  maps and mid-pack on the third, never first, so the knife/volley package is not an all-mode outlier.
- Added a guard so the new gauntlet heavy branch cannot root a pilot while the compactor is warning or
  active. It did not rescue RECYCLING BIN: all non-Wedge pilots are carried into the hole by the first
  stroke, including Probe with no heavy started, so that remains a map/pilot hazard outside Aim Bot's kit.
- No Aim Bot tuning change was made. The finding is range-skewed power, not universal dominance.

**Verification:** 300 s all-map gauntlet, focused 60 s wave windows, DIGITAL duels on DISK PLATTER /
THE RING / SPACE CADET, `npm run build` clean and 26/26 reflection checks.

**Next:** decide whether the PvE kill lead is the intended sniper payoff; if not, trim the rail/volley, not
the close-range knife. Separately, fix the first-stroke compactor route that wipes all non-Wedge pilots.

## 2026-11-01 — KEYPAD arena (v0.1.83)

**Goal:** add a phone-keypad arena whose keys act as a moving hazard and as changing cover, dodgeable by
players but lethal to enemies that linger under a descending cap.

- Added arena id 11, `KEYPAD`: a walled room with a central 3×4 phone pad (1–9, centered 0), perimeter
  spawns and no static pillars. The pad geometry lives in `ArenaDef.keypad`; timing and damage live in
  `KEYPAD` under `tuning/world.json`.
- Each cap cycles warning → slam → down cover → rise, with a per-key offset. A slam crushes threats
  through their ordinary damage paths and takes three health segments from a player. `slam`, `down` and
  `rise` footprints block bodies, projectiles, beams and line-of-sight; dashes still phase them.
- Bots steer around warning and down caps in `avoidFurniture`. The pad is local-only like the compactor
  and emitters, so `onlineArenaIndex` skips it and nothing enters `Snapshot`.
- Added the bezel/socket/cap renderer, digit marks, minimap footprint and picker preview. The arena guide
  and AGENTS D36 record the behavior and the local-only rule.

**Verification:** `.tmp/keypad-check.ts` confirms ten keys, all five states and a key-0 crush at 0.80 s;
`npx tsc --noEmit` and `npm run build` clean (653.07 kB JS / 180.30 kB gzip).

**Limitations:** no human pass yet; warning readability at combat speed and bot routing through a pad
with several caps down are the open feel checks. Online rooms intentionally skip the map.

**Next:** play KEYPAD in training and gauntlet, then tune the warning window or cap timing only if the
slam reads as unfair or the pad fails to create useful cover.

## 2026-11-01 — DOCUMENT SCANNER arena (v0.1.84)

**Goal:** add a scanner arena where documents load onto a glass bed, a read line scans each one top to
bottom and returns fast, then the sheet is swapped, turning the page into a timed hazard and a hopscotch
rhythm.

- Added arena id 12, `DOCUMENT SCANNER`: a walled room with a central 1254×758 platen, filing-stack cover
  around it, and perimeter spawns outside the bed. The bed and six document labels live in
  `ArenaDef.scanner`; all timing/damage lives in `SCANNER` under `tuning/world.json`.
- The cycle is load (0.7 s) → warning (0.45 s) → down scan (3.2 s) → quick return (0.6 s) → unload
  (0.45 s). The horizontal read line is active on the down and return passes. A player takes one segment
  and a shove per pass; a dash phases it. Worms, viruses, sentries, errors and the training drone take
  three per pass, tracked by per-pass bitmasks.
- The page renderer slides sheets up from the bottom feed slot, draws an internal-report title, fake body
  copy, redaction bars and a review stamp, then slides the old sheet out before the next page. The labels
  are cosmetic clues to a corporate cover-up; they are not campaign flags.
- Added the minimap and picker previews. Scanner phase, page index and hit masks are local only;
  `onlineArenaIndex` skips the arena, and nothing enters `Snapshot`.
- Updated AGENTS D37, README/GAME_GUIDE arena counts and the tuning file map.

**Verification:** `.tmp/scanner-check.ts` confirms six document labels, all five phases, the line staying
inside the 120..878 bed, and a first player hit at 2.63 s; `npx tsc --noEmit` and `npm run build` clean
(662.44 kB JS / 183.02 kB gzip).

**Limitations:** no human visual/play pass yet. The open feel checks are whether the 0.6 s return telegraphs
well enough to hop, and whether bots/gauntlet threats crossing the bed read as caught rather than random.

**Next:** play the map in training and gauntlet, then tune the return duration or warning only if the line
cannot be read while fighting.

## 2026-11-01 — BROWSER arena (v0.1.85)

**Goal:** add a browser-window arena whose forum navigation changes the cover, driven by a giant cursor that
slams the page link before moving deeper into the thread.

- Added arena id 13, `BROWSER`: a static chrome band and scrollbar, a page floor, and four local forum pages
  (`FORUM / INDEX`, `FORUM / THREAD 404`, `FORUM / POST 7`, `FORUM / LOCKED`). Each page has its own solid
  forum cards and navigation link, so the fight's cover changes as the browser navigates.
- Added the `BROWSER` cycle and `ArenaBrowserPageDef` data. The cursor idles over the page, seeks the active
  link, hovers, then click-slams for one segment and a shove; the click also starts the page swap. Dash and
  cloak clear the slam. Threat families take three damage.
- Active page cards are dynamic cover for players, threats, projectiles, bombs, beams and blast line of sight.
  Bots steer around the current cards instead of baking them into the nav grid. The minimap and picker preview
  show the page silhouette; the renderer draws the URL, cards, link and large pointer from world state.
- The map is local-only: `onlineArenaIndex` skips `browser`, and page/cursor/click state never enters `Snapshot`.
- Updated AGENTS D38, README/GAME_GUIDE arena counts and payload, tuning file map, TODO and build stamp 0.1.85.

**Verification:** `.tmp/browser-check.ts` confirms four forum pages, all five cursor phases, a click at 5.07 s,
page 1 after navigation, and a player pushed out of an active card. `npx tsc --noEmit` and `npm run build` clean
(676.59 kB JS / 186.70 kB gzip).

**Limitations:** no human visual/play pass yet. The open feel checks are whether the cursor reads as a threat
before the slam, and whether the page-cover swaps create useful routes instead of trapping bots.

**Next:** play BROWSER in training and gauntlet, then tune the cursor warning or page card layout only if the
click feels unreadable or the active page pinches a spawn/route.

## 2026-11-01 — Series games (v0.1.86)

**Goal:** let VS BOTS groups and online rooms play several matches in a row on different maps, without
forcing every session through a lobby or inventing a veto/vote ceremony.

- Added `src/game/series.ts`: series lengths `1/3/5`, random/fixed map normalization, no-immediate-repeat
  map selection and a tie-aware series winner calculation.
- VS BOTS now leaves difficulty for a series setup stage. `MAPS: RANDOM` is the default; `MAPS: FIXED`
  keeps the selected arena. Each game remains first to 3 rounds, and the result panel carries `NEXT GAME`
  with the running game score. Training still goes straight into its endless practice session.
- Online versus carries the host's `SERIES` and `MAPS` rules in `LobbyState` and `START`. The host advances
  with `HostNet.startNextMatch()`; guests receive the next arena and game number without rebuilding the
  room. Infection remains one run.
- Added AGENTS D39, README/GAME_GUIDE series rules, TODO entry and build stamp 0.1.86.

**Verification:** `.tmp/series-check.ts` passes length normalization, random no-repeat selection, fixed
arena selection and tie detection. A focused browser flow (PROBE → CROSSROADS → 1 V 1 → MEDIUM) reaches
`VS BOTS // SERIES` with `MAPS: RANDOM` and the three game lengths. `.tmp/browser-check.ts` still passes.
`npx tsc --noEmit` and `npm run build` are clean (682.36 kB JS / 188.42 kB gzip).

**Limitations:** no human play pass yet, and no automated two-peer online series test. The open feel checks
are whether random map variety is enough for a 3/5-game set and whether the between-game panel gives the
host enough time to start the next map.

**Next:** play a 3-game bot series and a 3-game online room, then tune the series stage copy or between-game
pause only if the map rule is unclear or the next game starts without enough context.

## 2026-11-01 — Bad Lag: three segments and time-kit retune (v0.1.87)

**Goal:** undo the four-segment experiment and make health an identity value rather than a balance knob,
then improve Bad Lag's survivability and duel performance through its time kit.

- Reverted Bad Lag to the standard **three** health segments. No other player or enemy health pool changed.
  `PLAYER.hp` and every `healthSegments` value are now explicitly protected by the global rule in AGENTS
  D4/D10/§6 and the tuning README.
- Hourglass: speed 580→700, life 1.7→2.1 s, damage 1→1.5, body hits 4→5, cadence 0.56→0.45 s, cost 12→9.
- Fast-forward: 2.6→3.4 s at 2.5×→2.8×; its skill cooldown is 10→7.5 s. Time dilation: 5→6.2 s at
  0.3×→0.25×, charge 0.6→0.45 s and cooldown 9→7.25 s.
- Corrected the BotBrain's Bad Lag calibration: it now uses the 700-speed, 2.1-second hourglass for lead and
  engagement range instead of the generic bolt values.
- Added the global health rule to AGENTS D4/D10/§6 and `tuning/README`; updated the Bad Lag hull references
  to six clock faces and the guide to the three-segment pool.

**Verification:** `.tmp/badlag-tune.ts` asserts Bad Lag's `healthSegments` fallback is three and compares
variants. At three segments the baseline was 20.8% duels, 89.0 s average gauntlet survival and 6.0 kills;
the final package measured 34.7%, 96.5 s and 8.3 kills. The full `.tmp/balance.ts duels 0` matrix put Bad
Lag at 36.1%, up from the 23.6% three-segment baseline. `npx tsc --noEmit` and `npm run build` are clean
(682.42 kB JS / 188.45 kB gzip).

**Limitations:** no human play pass yet. The sample is HARD bots on CROSSROADS and three gauntlet maps; the
1.5-damage hourglass and stronger dilation need a feel pass before they are considered final.

**Next:** play the three-segment Bad Lag in training, a VS BOTS duel and a gauntlet run; tune the hourglass
or time windows only if the new damage breakpoint or slow field feels unfair.

## 2026-11-01 — Testing/tuning evidence policy (workflow)

**Goal:** make headed/visual testing an explicit part of balance work instead of treating the headless
harness as the only authority.

- Added the rule to AGENTS §6 and §9: headless runs are the first pass; when results are surprising, noisy,
  or depend on attack tells, off-screen threats, camera framing, hit feedback, audio, routing or control
  feel, run a headed `npm run dev` session and play the exact scenario. Report both forms of evidence.
- Named the existing headed tools: `?autoplay=N`, `?gauntlet=1&arena=N&bot=1` and `F3`, with the normal
  manual pass.

**Verification:** `git diff --check` clean. No code or build changes.

**Next:** use a headed pass for the pending three-segment Bad Lag feel check and for any future balance
result that the headless data cannot settle.

## 2026-11-01 — Arena hazards online (v0.1.88)

**Goal:** decide whether the arenas kept local because their fixtures were not in `Snapshot` could be
played online without a bandwidth or authority problem; implement the safe group and record why the rest
stay local.

- Added `Snapshot` index 13, a compact hazard block or `null`: `[pusherT, keypadT, scannerT, scannerPage,
browserT, browserPage, props]`. `props` is `[index, kind, x, y, w, h, hp, hitFlash, dropT]` for live file
boxes. Clocks are the contract; positions, key states, scan phase, cursor and click flash are derived on
every peer from the arena record.
- `NetView` mirrors the derived fixture state and the live boxes. The **host still owns every hazard hit**:
compactor carry, keypad crush, scanner pass, browser click, prop damage and prop physics stay in `World`,
and the guest reads the resulting HP from the same player rows. No guest hazard simulation or hit masks
were added.
- Guest `LocalPredictor` now uses static cover plus the active forum page's cards and solid key caps,
and clamps the local body to the compactor's leading face after motion. The plate is a carry surface,
not a solid rect: a rect would push a body above it out through the top edge. This is prediction feel
only; the host's position wins on the next snapshot.
- `isOnlineArena()` now excludes only `pipes`/`firewallSwitch`, so `RECYCLING BIN`, `KEYPAD`, `DOCUMENT
SCANNER` and `BROWSER` rejoin the online pool. `NETWORK SWITCH` and `SPACE CADET` stay local: their pipes
spawn hostile files, sentries and viruses, and `NETWORK` carries a firewall switch and sweep, none of
which is in `Snapshot` (D9).
- Updated AGENTS D36/D37/D38 and added D40, the performance guardrail, README/GAME_GUIDE online notes, TODO
and build stamp 0.1.88.

**Verification:** `.tmp/hazard-check.ts` steps match-mode worlds on all four newly eligible arenas for 45 s
and checks clock round-trip, pusher/key/scan/browser derivation, page advance, live prop counts and the
`NetView` mirror. The heaviest block measured 180 B packed (7 live boxes on `RECYCLING BIN`); clock-only
maps measured 16 B; the 48-projectile packet delta on `RECYCLING BIN` was 138 B at 8 s. At 30 Hz that is
+5.4 KB/s per guest at the heavy end. `npx tsc --noEmit` and `npm run build` are clean (687.71 kB JS /
190.00 kB gzip); `git diff --check` is clean.

**Limitations:** no real two-client online pass yet, so the compactor carry prediction and forum page-swap
fairness still need a headed room test. The guest treats the descending plate as a solid rectangle; the
host may correct a body near the trapezoid edge. Hazard damage arrives at snapshot latency, like every
other host-resolved hit. Pipes and the firewall switch remain local, so those two arenas are still absent
from hosted rooms; `DISK PLATTER` keeps its parked arm/spin and the wall emitters stay unbuilt online
because their moving voids/beams would need a separate prediction and protocol decision.

**Next:** run one online match on each of the four newly eligible maps with two clients, then re-measure the
full 8P/48-projectile snapshot with a hazard block before considering a player-cap change.

## 2026-11-01 — 4-player kit tuning + reflection telemetry (v0.1.89)

**Goal:** answer whether reflection is worth using in four-player duels, or whether skills, projectiles and
heavies make it irrelevant; then tune the programs that the 4P data actually identifies.

- Added `.tmp/duel4.ts`: balanced four-program lobbies, rotating seats, 260 rounds per seed, with
per-program placement, damage, shots, lashes, skills, heavy attempts, guard time and catch-source counts.
- Added `World.deflectTelemetry`, a QA-only local counter block that separates guard, lash, beam, atom, net,
Pinball arm, plow, broom and legacy wave catches. It is never serialized into `Snapshot`.
- Reflection is not being suppressed. Across the two baseline seeds it produced 3,856/4,417 catches in 260
rounds (58.6/58.5 per 100 shots), appeared in 90/89% of player-rounds and averaged 14.8/17.0 catches per
round. The shared guard/lash action was the dominant source. Heavies were rare in bot play because most
rounds end before the bot's 6–11 s heavy pacing, not because a heavy outclassed a catch.
- Tuned the consistent outliers without touching health. Atomize's shield balls 3→2, refill 11→18 s,
electron 1→0.72 at 0.46 s cadence; Aim Bot's rail 8→5 damage at 2.8 s reload, which no longer deletes a
six-segment hull in one shot; Ghost cloak 3.5→3.2 s, scare window 3.2→3.0 s, cooldown 9→11 s.
- Buffed the bottom half through identity-safe numbers: Wedge string damage/speed/cadence, Fisher net and
lure reach, Sweep broom speed/life, Toxic venom/spray/jet, Kaboom bomb speed/life/blast, Bad Lag hourglass
and fast-forward, Copy Pasta file damage/clone life, and Probe mine trigger/blast.
- Updated AGENTS D10/D14/D15/D16/D21/D25/D26/D34, GAME_GUIDE and the build stamp to 0.1.89. No health,
history or protocol fields changed.

**Verification:** the same 260-round 4P FFA on both seeds gives Atomize 50.0/50.0% (was 67.5/66.3), Ghost
47.5/47.5% (was 30.0/43.8), Aim Bot 35.0/36.3% (was 46.3/48.8) and the rest 8.8–33.8%. The final pass
measured 54.7/56.0 shield catches per 100 shots, 89/90% of player-rounds with a catch and 16.0/17.0
all catches per round. `npx tsc --noEmit`
and `npm run build` are clean (688.57 kB JS / 190.14 kB gzip); `git diff --check` is clean.

**Limitations:** this is a bot proxy. Atomize and Ghost still lead, and the bottom programs (especially
Wedge and Bad Lag) are limited by bot piloting: their skills or heavies barely fire, so a human 4P pass is
still required. The harness measures catches, not whether a catch was a deliberate, readable choice.

**Next:** run a headed four-player FFA, then decide whether the six-segment hulls need a separate 4P
compensation decision and whether bot heavy pacing should be shortened for future balance samples.

## 2026-11-01 — Playtest tour and no-backend feedback evaluation (v0.1.90)

**Goal:** give the designer one URL that plays three bot rounds on every arena and records a log worth
reading, then settle whether players can send playtest data to the repository without a backend.

- Added `?playtest=1`. It boots VS BOTS with three bots, the saved callsign, the selected program and the
  stored bot tier, then plays three completed rounds on each arena in `ARENAS` order. After the third round
  it waits two seconds and rotates to the next arena. The tour ends on a `PLAYTEST COMPLETE` overlay with
  DOWNLOAD LOG, COPY LOG and TITLE.
- Each round records arena, round number, duration, winner and match winner, and per player: program, hp,
  maxHp, score, shots, dashes, swings, deflects, skills, heavies, hits, damage, kills and deaths. It also
  carries the exact `World.deflectTelemetry` source split, round FPS and sim ms. A summary totals rounds,
  win/loss/draw, every action count, damage, kills, deaths and average FPS.
- The log is written to `localStorage['deflect.playtest.last']` after every round and is downloadable as
  JSON. `?debug=1` adds `playtestState()` and `playtestLog()`; leaving to the title clears live tour state
  but not the saved copy.
- Evaluated the proposed PAT-in-URL auto-issue pipeline and rejected it. A token in a URL or shipped bundle
  is readable by anyone who receives the link or opens devtools, ciphering only changes the encoding, a
  GitHub PAT is account-scoped with no per-player revocation, and a public copy invites issue spam and gets
  revoked. The recommended path is a prefilled issue plus the downloaded JSON attachment, with a small
  server relay only if automation becomes mandatory. Written up in `PLAYTEST.md`.
- Added `PLAYTEST.md`, updated AGENTS D6 and the README, and bumped the build stamp to 0.1.90.

**Verification:** browser run against the dev server shows `[PLAYTEST] START` and `MAP 1/14 CROSSROADS`,
three CROSSROADS rounds recorded, then automatic rotation to GRID ZERO with its first round logged. The
payload carries schema 1, the header, per-round player and deflect blocks and the summary. `npx tsc
--noEmit` and `npm run build` are clean; `git diff --check` is clean.

**Limitations:** the full 14-arena tour was not played end to end and the completion overlay was not
clicked in this pass; the rotation and round logging were verified live, the completion path by reading.
The log is a local QA artifact and stays out of `Snapshot` and the service worker shell.

**Next:** play one complete tour and read the exported file, then decide whether the prefilled-issue report
path is worth building.

## 2026-11-01 — Local couch multiplayer (v0.1.91)

**Goal:** build the `LOCAL` multiplayer stage for real, with controllers dropping in whenever they are
plugged in or detected.

- Added `src/game/localplay.ts`. `LocalSeats` adopts every detected gamepad as P2–P4 with no confirmation
  step, writes one `InputFrame` per seat, keeps a 0.9 s disconnect grace, and owns a `Haptics` instance per
  pad so each player rumbles on their own controller.
- Added `World.joinLocalPlayer`. A pad joining mid-round activates its spare slot, keeps the kit the
  constructor already assigned from `botPrograms`, and spawns at the arena point farthest from the live
  field. Joining during `matchend` takes effect on the rematch.
- Replaced the placeholder local menu with the real setup stage: live seat rows (keyboard plus each pad's
  name), an arena grid, and a start gate that needs one controller beside P1. A controller plugged in on
  the stage appears without a refresh.
- P1 is keyboard + mouse in local play. `Input.keyboardOnly` stops a pad from also driving P1 while still
  letting that pad navigate menus. Local matches run their own step branch over `localFrames`, use the
  existing split/shared camera through `setLocalSlots`, draw one readiness dock per seat, and rematch
  through the ordinary local rematch path. Leaving resets the seats and the camera.
- Updated AGENTS D11/D18, README, GAME_GUIDE and the build stamp to 0.1.91.

**Verification:** in the dev browser with two injected pads, `MULTIPLAYER > LOCAL` listed P1 keyboard,
P2 and P3 pads and an open P4; starting produced three active bodies, split slots `[0,1,2]`, and a left
stick push moved P2 104 units. A third pad added mid-match joined as P4 at a far spawn and the split became
`[0,1,2,3]`. Marking P3's pad disconnected aged the seat to disconnected after the grace, and reconnecting
the same index restored it. `npx tsc --noEmit` and `npm run build` are clean; `git diff --check` is clean.

**Limitations:** tested with injected virtual pads, not physical controllers; the couch readability of
three/four panes and the dock corners still needs a real TV pass. Local gauntlet co-op is not built, and
online rooms still have no local seats because seats never enter `Snapshot`.

**Next:** run a headed couch pass with real pads, then decide whether gauntlet co-op belongs in this mode.

## 2026-11-01 — Quarantine orientation + script_kitty (v0.1.92)

**Goal:** build the first part of the campaign as a testable quarantine opening: the Warden teaches the
basics while the primitives sit dormant, then they wake; the next arena introduces script_kitty and the
kit's skill and power attack.

- Added `src/game/tutorial.ts`: a reusable `TutorialRunner` plus the first two lessons. Narration steps
  auto-advance; action steps wait for the real input. `SKIP TUTORIAL` ends the lesson without changing the
  level order.
- `BUILD ROOT` now opens with `WARDEN_TUTORIAL`. The six calibration subjects stay dormant until move,
  dash, ranged, lock, cycle, melee and a reflected test shot are done, then wake on the same beat and the
  existing fight continues. The reflect lesson arms one slow hostile shot with zero damage from a clear
  lane; the step completes on the first catch.
- Added the second node, `REBOOT` on `GRID ZERO`. `KITTY_TUTORIAL` has script_kitty teach the skill tap and
  the power-attack hold in a quiet room, then the breach starts and a four-kill live-fire check clears it.
- Campaign levels are now indexed: the clear overlay saves the next node and offers `NEXT ARENA`; a resumed
  slot starts at the saved level. Keyboard lock cycling is `R` / `F` while `Q` is held; pads keep
  `RB` / right stick.
- Added the live DOM story box (speaker mark, line, action prompt, step count, skip) and updated AGENTS
  D13/D17, GAME_GUIDE, README and the build stamp to 0.1.92.

**Verification:** in the dev browser, `BUILD ROOT` opened in `calibration` with the Warden box and six
subjects dormant. Move, dash, fire, lock and cycle each advanced their step, melee reached `reflect`, and a
held guard caught the test shot; the `awake` line played and all six subjects woke. `REBOOT` started in
`briefing` on `GRID ZERO` with the script_kitty box. `npx tsc --noEmit` and `npm run build` are clean;
`git diff --check` is clean.

**Limitations:** the live tab was rAF-throttled during the script_kitty check, so that path was verified by
stepping the world directly (skill → power → `kitty-escape` → breach, clear at 4 kills), not by typing into
the running arena. The story box has skip for the whole lesson but no per-line skip control, and the
`STORY BEATS` preference is still unbuilt.

**Next:** judge the narration dwell on a real read-through, then author the node after `REBOOT`.

## 2026-11-01 — QUARANTINE tutorial route (v0.1.93)

**Goal:** turn the tutorial into a simple three-room route connected by bridges: a round prison-office
intake, a motherboard rectangle, then a larger router room that ends at the way out to the web.

- Added arena id 14, `QUARANTINE`: the circular `INTAKE` office, rectangular `MAINBOARD`, and larger
  `ROUTER` room, linked by two bridge decks. Four chasm halves remove the floor between rooms, so the
  bridges are the only body crossings; shots and beams still cross the gaps.
- Added `ArenaDef.rooms`, `bridges` and `port` as presentation data, plus the shared `ROOM_THEME_COLORS`
  palette. The picker preview and the arena renderer draw the same room plates and route.
- Added room dressing: intake carpet, cell bars, lamp cones and loose paper; mainboard copper traces and
  chip pads; router port banks, blinking link LEDs and an antenna sweep; a moving data thread on each
  bridge; and a pulsing NETWORK PORT at the router's east wall. No gradients, filters or `shadowBlur`.
- Moved `BUILD ROOT` onto `QUARANTINE`. Spawn 6 opens in the centre of the intake office. Calibration now
  anchors the six dormant subjects around the `board` room centre when the arena has rooms, so the first
  bridge crossing is the reveal instead of the class landing on the bridge or in the player's lap.
- Spread the level's data crates through the three rooms. The port is fiction and a future exit hook for
  now; the node still clears on the assault kill count.
- Room arenas are local-only: `isOnlineArena` skips `rooms`, like pipes and firewall fixtures. Room data
  never enters `Snapshot`.
- Updated AGENTS D8/D13/D17/D41, CAMPAIGN, README/GAME_GUIDE counts, TODO and the build stamp to 0.1.93.

**Verification:** `.tmp/quarantine-check.ts` passes 15 checks: arena id/index, room shapes and relative
size, two bridges and four chasm halves, solids including the chasms, campaign spawn in intake, six
subjects in mainboard, subjects clear of cover and chasms, bridge A into the board, bridge B into the
router, and the chasm blocking a body outside a deck. In the dev browser the campaign booted in
`QUARANTINE`/`calibration` at `(310,547)` with all six subjects inside the board room and no console
errors. `npx tsc --noEmit`, `npm run build` and `git diff --check` are clean.

**Limitations:** no headed visual/feel pass on the rooms, labels or port; the port is decorative; and the
router room has no unique lesson beat yet. This is one continuous arena, not three separate loadable
levels.

**Next:** judge the room read in a headed pass, then decide whether the port becomes an exit gate and
where script_kitty's lesson belongs.

## 2026-11-01 — Ordinary program carts (v0.1.94)

**Goal:** give non-combat programs a shared visual format instead of inventing a new avatar for
every civilian: a floating monitor cart with a unique shell colour and an emoji face.

- Added `src/game/regulars.ts`: the `REGULAR_PROGRAMS` data rows, id lookup, and a reusable
  `drawRegularProgram` renderer. The silhouette is fixed (ground shadow, hover ring, cart deck,
  neck, monitor shell, dark screen, antenna); colour and face carry identity.
- Defined four civilians: TICKET (teal, intake, neutral), PATCH (amber, maintenance, friendly),
  CACHE (violet, intern, sleepy) and PING (rose, courier, anxious). The monitor face is a real
  emoji on the dark screen; the shell, rim and LEDs carry the tint.
- Added `ArenaDef.regulars` placements and `drawRegularPrograms`. The arena pass draws carts
  before pillars and border, so a desk can occlude one. Three staff the `QUARANTINE` intake
  floor: TICKET at the west side, PATCH by the bridge gate, CACHE near the south desks.
- Regulars are presentation only: no `Player`, collision, health, AI, hit surface or `Snapshot`
  row. They never enter `PROGRAMS`, the select screen or `World`.
- Updated AGENTS D42, README code map, GAME_GUIDE, CAMPAIGN, TODO and the build stamp to 0.1.94.

**Verification:** `.tmp/regulars-check.ts` passes four unique definitions, unique ids/colours/faces,
lookup and fallback, three intake placements, all inside the round room and clear of cover and
chasms. The dev browser booted `BUILD ROOT` again after HMR; the arena still resolves `QUARANTINE`
with the three placements, and the console stayed clean. `npx tsc --noEmit`, `npm run build` and
`git diff --check` are clean.

**Limitations:** no headed visual pass on the carts yet; emoji rendering still depends on the host's
emoji font. PING is defined but unplaced, and regulars have no ambient behaviour or dialogue. They
are scenery, not an NPC system.

**Next:** judge cart scale and emoji readability in the intake room, then decide whether story-box
speakers should share the monitor frame.

## 2026-11-01 — Keyboard target lock toggle (v0.1.95)

**Goal:** make target lock comfortable for keyboard/mouse players who do not want to hold a key while
moving, aiming with the mouse and firing.

- `Q` now toggles `ACTION.LOCK`; releasing `Q` leaves the toggle on, and the next press clears it.
- Gamepad `LT` keeps hold-to-lock, and keyboard `R` / `F` cycling works while the toggle is active.
- Updated the Warden lock prompt, GAME_GUIDE controls and QA copy, README input notes and AGENTS D2.
- Build stamp 0.1.95.

**Verification:** `.tmp/lock-toggle-check.ts` passes 5/5 by driving the real `Input` class with minimal
browser stubs. `npx tsc --noEmit`, `npm run build` and `git diff --check` are clean. The live browser debug
handle exposes no raw frame getter, so this was verified at the input boundary rather than in a headed match.

**Limitations:** no headed feel pass; the gamepad path is deliberately unchanged.

**Next:** use the toggle through a keyboard match and confirm the lock reticle reads correctly through
reacquisition and cycling.

## 2026-11-01 — Holding tutorial route (v0.1.96)

**Goal:** split the opening lesson by room: learn the basics in the bare circle, then meet the awakened
primitives, the burning civilian office and the jailed script_kitty before the motherboard and router.

- Rebuilt `QUARANTINE` as four rooms: the intake circle, a square **HOLDING** office with a three-cell
  block, the mainboard rectangle and the router rectangle. Bridges and chasm halves now repeat three
  times; pillars, spawns, props and data crates moved to the new room centres.
- Added the `holding` room theme and `drawHoldingRoom`: three cell recesses, barred fronts that flash amber
  and retract when opened, office desks, a cell-block stencil and script_kitty in the middle cell. The
  intake circle lost its old back-wall cage and now reads as the bare orientation room.
- Moved the three civilian carts (TICKET, PATCH, CACHE) into holding. `wakeCalibration` hides them after a
  0.65 s beat and emits a short blast at each cart anchor; they still have no bodies, health or snapshot
  rows. script_kitty is a render-only cameo, not an `ArenaDef.regular`.
- Split the Warden lesson: `WARDEN_TUTORIAL` now ends with a move-to-holding beat. Reaching holding wakes
  the six subjects (18 s fallback) and starts `CALIBRATION_TUTORIAL` (skill tap, power hold) while they
  are live. The wake banner, civilian loss and combat lesson share the same beat.
- Added `CampaignPhase.release`. When the six subjects and the combat lesson are done, `beginCellRelease`
  flashes and opens the bars, clears projectiles and old shapes, grants 1.2 s of iframes, and spawns two
  viruses and a worm in front of the cells. Only those threats update in release; clearing them opens the
  existing drill. Bars stay open for the rest of the node.
- `campaignCiviliansLost`, `campaignBarsFlashT` and `campaignBarsOpen` are render-state only. Nothing
  campaign-shaped entered `Snapshot` or the network protocol.
- Updated AGENTS D13/D17/D41/D42, CAMPAIGN, GAME_GUIDE, TODO and the build stamp to 0.1.96.

**Verification:** `npx tsc --noEmit` clean. In the dev browser `BUILD ROOT` booted into
`QUARANTINE`/`calibration` with all four rooms, six dormant subjects and the three holding carts. Forced
wake hid the carts and showed the skill prompt; forced release retracted the bars and spawned the threat
group. The clean build and `git diff --check` are recorded in TODO v0.1.96.

**Limitations:** the release was exercised through the debug handle, not a complete human lesson-to-
release playthrough; the holding cell bars are visual only, so a body can still walk through the cage.
The 18 s fallback has not been feel-tested, and script_kitty has no dialogue in this beat yet.

**Next:** play the lesson naturally and judge the wake/release spacing, then decide whether the cell bars
need real body collision or a gate script.

## 2026-11-01 — Floating-head civilians (v0.1.97)

**Goal:** simplify ordinary programs to the emoji face itself, add carried file dressing, and let
civilians visibly react and flee the room instead of standing in a monitor cart through a breakout.

- Reworked `drawRegularProgram` to a floating head: ground shadow, hover ring, tinted halo, emoji face
  and a small identity tick. Removed the cart deck, neck, monitor shell, inset screen, scan line and
  antenna. `screen` is gone from the data rows; `cart` remains the halo colour for continuity.
- Added `RegularMood` and `CIVILIAN_FACES` (`scared`, `angry`, `sad`); calm keeps the portrait face.
  `ArenaRegularDef.mood` can set an unnamed civilian's resting expression, and a live threat overrides
  it with fear.
- Added `ArenaRegularDef.carry` and `drawDroppedFiles`. TICKET carries one file, PATCH none and CACHE
  two. Carried papers sit behind the head; a fleeing or destroyed civilian drops them at the anchor and
  the renderer fades the stack out.
- Added a local presentation-only flight in `Renderer`: live worms, viruses, errors or sentries within
  `CIVILIAN_FLEE_RADIUS` make a worker drop its files and move toward the arena port, then a pad/lift,
  then the room farthest from the threat. Port/pad exits fade the head; a safe room becomes the new idle
  anchor. Dormant calibration subjects do not trigger it.
- The behavior never enters `World`, collision, pathfinding or `Snapshot`; ordinary programs remain
  decoration with no bodies, health or hit surfaces. The campaign's scripted loss still wins over the
  escape path, so the holding workers vanish and leave their papers.
- Updated AGENTS D41/D42, CAMPAIGN, README, TODO and the build stamp to 0.1.97.

**Verification:** `npx tsc --noEmit` clean. The dev browser showed the three floating heads, the cat cameo
and carried papers in holding; a forced wake hid the heads, set `mood = scared`, and left TICKET's one
file and CACHE's two files on the floor. The same state showed the workers had moved toward the router
port before the scripted loss. The clean build and `git diff --check` are recorded in TODO v0.1.97.

**Limitations:** no live non-campaign pack was used to watch a worker reach a safe room, and the escape
route ignores cover and enemies on the way. The camera does not follow civilians. Mood changes are
renderer-only; a guest or a replay cannot reproduce them from a snapshot.

**Next:** judge the port-first route in a live room, then decide whether safe rooms should take priority
over exits and whether a generic unnamed civilian row is needed for crowd filler.

## 2026-11-01 — CRT-head civilians (v0.1.98)

**Goal:** keep the emoji face readable as a character while putting it back inside the CRT monitor
silhouette, with no body or limbs.

- Reworked `drawRegularProgram` again: a floating rounded CRT shell, inset bezel, dark screen, single
  scan line, power LED and the emoji face on the screen. No stand, neck, cart deck, wheels, arms or legs.
- Restored `screen` colours per regular and renamed the shell tint field from `cart` to `shell`. The
  emoji, carried-file stack and drop helper are unchanged.
- Files still overlap behind the monitor and drop on fear or the scripted holding loss; mood faces and
  the local port/pad/safe-room flight remain. script_kitty uses the same floating CRT with her cat face.
- Updated AGENTS D41/D42, CAMPAIGN, GAME_GUIDE, README, TODO and the build stamp to 0.1.98.

**Verification:** `npx tsc --noEmit` clean. The dev browser showed the three holding CRT heads and the
cat cameo at cell scale, with carried papers visible behind the shells. The clean build and
`git diff --check` are recorded in TODO v0.1.98.

**Limitations:** no live non-campaign escape pass with the new silhouette; the monitor has no stand, so
it reads as a floating terminal rather than a desk CRT.

**Next:** judge screen readability and shell scale at couch distance, then decide whether future civilians
need a second shell silhouette variant.

## 2026-11-01 — BUILD ROOT campaign stop (v0.1.99)

**Goal:** make the campaign entry the access path for the tutorial and first level, save a clear, and stop
on a clear “more levels coming soon” message instead of flowing into the parked REBOOT node.

- Added `CampaignLevel.playable` and `PLAYABLE_CAMPAIGN_LEVELS`. BUILD ROOT is the only live level;
  REBOOT remains authored on GRID ZERO but is marked `playable: false`.
- Routed campaign start, resume, clear, fail and the debug level setter through the playable list. The
  save records completed-level count; a completed slot no longer starts REBOOT or replays silently.
- The level-clear overlay now reads `CAMPAIGN // LEVEL 1 CLEAR` / `MORE LEVELS COMING SOON`, writes the
  slot, and offers `STORY SLOTS` and `REPLAY`. The slot readout becomes `COMPLETE` / `MORE LEVELS SOON`.
- A completed slot clicked from story slots reports the same coming-soon message instead of launching a
  node. Campaign access remains the existing SINGLE PLAYER > CAMPAIGN → save slot → bot count → program
  path, which starts BUILD ROOT with the Warden lesson.
- Updated GAME_GUIDE, CAMPAIGN, AGENTS D13/D17, README, TODO and build stamp to 0.1.99.

**Verification:** `npx tsc --noEmit` clean. In an incognito dev tab with no prior save,
`SINGLE PLAYER > CAMPAIGN > SLOT 1 > NO BOTS > PROBE` started BUILD ROOT (`mode: campaign`, slot 0,
phase `calibration`) and the Warden tutorial drew at step 3/10. A QA-forced clear (assault phase at the
kill threshold) wrote slot 1 with `level: 1` and `nodeId: build-root`, showed `CAMPAIGN // LEVEL 1 CLEAR` /
`MORE LEVELS COMING SOON` with `STORY SLOTS` and `REPLAY`, and returned to a `LOCALHOST // COMPLETE`
slot. Clicking that slot reported `BUILD ROOT CLEAR // MORE LEVELS COMING SOON` without creating a world.
The forced clear verifies the save/overlay path, not a full playthrough of every beat. Build and
`git diff --check` results are recorded in TODO v0.1.99.

**Limitations:** only BUILD ROOT is live; REBOOT remains parked and its route is not tested through the
campaign UI. A full human playthrough of every beat is still needed before calling the level tuned.

**Next:** author the next playable level, flip its `playable` flag, and extend the completed-slot flow to
point at it.

## 2026-11-01 — Pinball flipper art pass (v0.1.100)

**Goal:** replace Pinball's chrome-ring read with solid glossy balls and pinball flipper hardware.

- Added `pathPinballFlipper`, one tapered bat path shared by the three health segments, the melee pair
  and the deployed skill arm. The bats wrap the core on a ring, so the hull reads as pinball flippers
  instead of another circle.
- Pinball's melee now draws two flipper bats hinged at the body's sides and snapping shut across the
  forward arc. The swing hitbox, facing lock, guard and reflection rules are unchanged.
- Types 14 and 15 render as solid cabinet-blue spheres with a shaded lower edge and a fixed top
  reflection; the circled X stays at the core and is no longer stamped on the ball.
- Updated AGENTS D4/D31, README, TODO and the build stamp to 0.1.100.

**Verification:** `npx tsc --noEmit` clean. The dev browser showed the full-health bats in the select
portrait and in a 2x live crop, the two-flipper melee snap, and both ball sizes as solid glossy spheres
with a top highlight. `npm run build` succeeded at 732.43 kB / 204.17 kB gzip with the existing
chunk-size warning, and `git diff --check` is clean.

**Limitations:** the hull bats are small at arena distance; judge them at couch distance before changing
health segment sizes again. The melee change is visual only.

**Next:** judge the hull in a real match and decide whether the bats need a longer blade or wider tip.

## 2026-11-01 — Holding cell wave gate (v0.1.101)

**Goal:** make the holding cell bars a real barrier and use the cell block as the wave control for BUILD ROOT.

- Added `holdingCellLayout` so the holding renderer and the campaign collision read the same cell geometry. The
  sealed cell block is one body solid; the painted bars no longer leak at the back or sides. The solid is
  removed on the power-down, making the cells walkable for the rest of the node.
- Replaced the scattering arc spawn with a fixed two-column formation in the holding room's lower half. All
  six subjects stay in holding, the centre lane stays open for the bridge entry, and no shape falls back to
  an arena spawn elsewhere.
- Split the calibration lesson into wave beats. `CALIBRATION_SKILL_TUTORIAL` runs while the six primitives are
  live; clearing them and finishing the skill beat powers the cell block down. `CALIBRATION_POWER_TUTORIAL`
  then runs over wave 2, two viruses and a worm released from the cells. The drill waits for wave 2 and the
  heavy beat.
- Drew caged worm/virus silhouettes behind the sealed bars and changed the campaign banners to
  `WAVE 01 // SKILL CHECK` and `WAVE 02 // CONTAINMENT RELEASED`. The release line now says the cells lost
  power, not that the Warden caused it.
- Updated AGENTS D13/D17/D41, CAMPAIGN, GAME_GUIDE, TODO and the build stamp to 0.1.101.

**Verification:** `npx tsc --noEmit` clean. In the dev browser the sealed cell block measured 324x108 at
(618,346); a body driven north into it stopped at y=476. With all six primitives dead but the skill beat
unfinished, the phase stayed `calibration`, the bars stayed closed and no wave-2 body existed. Finishing
the skill beat removed the block, opened the bars and spawned two viruses and a worm in the cells while the
release line played. The heavy lesson was reached and the drill started only after wave 2 and the heavy beat
were clear. `npm run build` succeeded at 734.46 kB / 204.77 kB gzip with the existing chunk-size warning, and
`git diff --check` is clean.

**Limitations:** the collision is a body barrier; dashes still phase it like other cover. The caged wave is
painted, not simulated, until release. The timing of the heavy prompt and the worm/virus split need a human
playthrough, not just state probes.

**Next:** play the whole holding sequence without debug hooks, then tune the wave-2 spawn spacing or release
narration if the worm reaches the viruses before the heavy lesson is read.

## 2026-11-01 — Held wave 2 (v0.1.102)

**Goal:** make the wave-2 worm and viruses exist behind the holding-cell bars before release, rather than
spawning on the power-down, while keeping them inactive until the bars open.

- Added `held` to `Worm` and `Virus`. Wave 2 is created in `spawnHeldCellThreats()` during campaign setup
  and parked in the left/right cells. `spawnWorm`/`spawnVirus` accept the held flag, skip patrol/roam setup,
  and keep the bodies fully assembled with `spawnT = 0`.
- Held bodies skip AI, damage, target lock and the normal threat render. The caged worm/virus silhouettes
  remain their presentation behind the bars so the bars layer cleanly.
- `beginCellRelease` no longer spawns. `releaseHeldCellThreats()` clears `held` on the existing pool slots,
  preserves HP and positions, clears charge/pin/patrol state, and resumes the normal AI.
- Updated AGENTS D41, CAMPAIGN, GAME_GUIDE, TODO and the build stamp to 0.1.102.

**Verification:** `npx tsc --noEmit` clean. Before release the dev browser held one worm at (672,396) with
5 HP and two viruses at (873,403)/(903,417) with 1 HP each; `campaignThreatsActive()` was false. A 120-step
manual simulation left their positions, HP and the player's 3 HP unchanged and created no projectiles.
Forced damage left their HP unchanged. The calibration gate then moved the world to `release`, cleared
`held` on the same pool indices, preserved HP, and 60 steps later all three bodies had moved. `npm run
build` succeeded at 735.55 kB / 205.09 kB gzip with the existing chunk-size warning, and `git diff --check`
is clean.

**Limitations:** the caged presentation is still the drawn silhouette; the actual bodies are skipped by the
normal render until release so the bars remain in front. A human playthrough has not been run.

**Next:** play the release beat and judge whether the silhouette-to-body handoff is readable; tune the
silhouette positions if the worm or viruses visibly shift when they become live.

## 2026-11-01 — Dash respects solid cover (v0.1.103)

**Goal:** correct the dash rule: it passes enemies and clears floor gaps, but it must not phase solid
obstacles.

- Split body collision into `solids` (walking: cover plus floor gaps) and `dashSolids` (hard cover only).
  `World` builds the dash list from arena pillars plus sealed campaign bars; `LocalPredictor` builds the
  same list from pillars plus active keypad and browser cover.
- Removed the early dash returns from the Wedge barrier, keypad and browser resolvers. A dash now stops and
  pushes out of those solids. The deployed wall chooses the side the dash came from, so a charged dash
  cannot resolve through a thin plate.
- Dash movement now advances in sub-radius steps while resolving the cover-only list, preventing a fast or
  charged dash from skipping a thin pillar in one frame. Floor gaps are absent from that list, so a short
  gap is still cleared; walking still collides with gaps.
- Updated the tutorial/help wording and AGENTS D8/D10/D20/D36/D37, GAME_GUIDE, TODO and build stamp to
  0.1.103. This supersedes earlier notes that described dashes as phasing cover.

**Verification:** `.tmp/dash-rule-check.ts` passed 6/6: dash stopped at a pillar, charged dash did not tunnel
through a thin pillar, dash cleared a floor gap, walking still stopped at the gap, sealed campaign bars
stopped a dash, and a charged dash did not cross a thin deployed Wedge wall. `npx tsc --noEmit`,
`npm run build` and `git diff --check` are clean; build is 736.14 kB / 205.28 kB gzip with the existing
chunk-size warning.

**Limitations:** this is a state and collision check, not a human feel pass. A dash that hits a solid still
has its remaining dash timer, so the body presses against the surface until that timer ends instead of
cancelling the dash.

**Next:** play a dash-heavy pass on CROSSROADS, TRANSIT and the campaign cell release, then decide whether a
solid hit should cancel the dash early.

## 2026-11-01 — KEYPAD is the arena (v0.1.104)

**Goal:** make the keypad itself the playable arena rather than a pad in a larger room, scale it up, and
make the key-press animation read much slower.

- Tightened the KEYPAD bounds to 1100×1160. The 900×960 housing now fills the floor, with a 100-unit
  perimeter gutter for the eight ordered spawns. Grew the caps to 250×198 and the 0 to 802×198, and raised
  the digit face to 68px. Spawns remain clear of the pad and inside the bounds.
- Slowed the pad cycle from 6.2 s to 12 s: 1.4 s warning, 0.45 s sink, 3 s down, 0.7 s rise and 1.12 s
  between key phases. The host and guest still derive every state from the shared `keypadT` clock; no
  snapshot or protocol field changed.
- Added `keypadKeyPhase()` and used it in the renderer so the cap travels down through the slam and back up
  through the rise instead of snapping between poses. The warning pulse and hazard bars were slowed to
  match. The state boundaries, solid cover and crush timing are unchanged.
- Updated AGENTS D36, GAME_GUIDE, TODO and the build stamp to 0.1.104.

**Verification:** `.tmp/keypad-check.ts` passed: 10 keys, a 900×960 pad in 1100×1160 bounds, 100-unit
minimum gutter, all five states seen, 0.45 s sink and key-0 crush at 1.40 s. `npx tsc --noEmit`,
`npm run build` and `git diff --check` are clean; build is 736.34 kB / 205.38 kB gzip with the existing
chunk-size warning.

**Limitations:** this is a geometry, timing and headless simulation check, not a human visual pass. The
caps become solid at the start of the sink, so a body is pushed out while the cap is still visibly
travelling down.

**Next:** play KEYPAD in training and gauntlet at the new scale, then tune the gutter, warning window or
sink duration only if the lane is cramped or the slam reads unfair.

## 2026-11-01 — Dev environment cleanup rule

**Goal:** make post-task cleanup explicit for this limited-memory development environment.

- Added a required cleanup checklist to AGENTS §1: stop task-owned dev servers, watchers, harnesses and
  background shells by recorded PID/tree; close task-owned preview tabs; remove task-created scratch and
  caches; remove generated build output when it is not a deliverable; verify nothing is left listening.
- The rule preserves the user's browser tabs, tracked files, and the intentional reusable `.tmp` QA probes,
  and forbids broad `pkill -f`/`killall` cleanup.

**Verification:** Markdown-only change; `git diff --check` clean. The cleanup check found a Vite dev
server left running by earlier chat work (`npm run dev`, pid 101275) and stopped it; no new server was
started for this task.

**Next:** keep the final response of each task explicit about what was stopped or left running.

## 2026-11-01 — KEYPAD fills the frame (v0.1.105)

**Goal:** remove the remaining floor outside the keypad, scale the pad far beyond the player, and slow the
sequence and visible press enough that an attentive player can always escape.

- Set the KEYPAD bounds equal to its 2400×2640 housing. There is no exterior floor, side room or spawn
gutter now. Moved the eight spawns onto the housing bezel, clear of every cap and inside the bounds.
- Grew the caps to 680×528, with the 0 spanning 2160. Raised the key face to 156px and scaled the socket,
  insets, bolts, under-edge and hazard bars from the old 250×198 cap proportions.
- Slowed the cycle from 12 s to 30 s: 4 s warning, 1.2 s sink, 8 s down, 1.6 s rise and 3 s between key
  phases. The warning is now long enough to walk off a cap; the shared `keypadT` clock and host crush path
  are unchanged.
- Scaled the visible cap travel to 7.5% of key height (~40 units) so the slow press reads at the new scale;
  the warning pulse and hazard-bar motion were slowed to match.
- Updated AGENTS D36, GAME_GUIDE, TODO and the build stamp to 0.1.105. This supersedes the v0.1.104
  pad-plus-gutter layout.

**Verification:** `.tmp/keypad-check.ts` passed: 2400×2640 pad exactly equals the bounds, 680×528 keys,
eight bezel spawns clear, all five states seen, 4 s warning, 1.2 s sink and key-0 crush at 4.02 s.
`npx tsc --noEmit`, `npm run build` and `git diff --check` are clean; build is 736.55 kB / 205.47 kB gzip
with the existing chunk-size warning.

**Limitations:** this is a geometry, timing and headless simulation check, not a human visual pass. A body
is still pushed by the cap as soon as the 1.2 s sink starts, so the crush decision happens at the warning
boundary, not when the artwork reaches the floor.

**Next:** play KEYPAD at normal camera zoom, especially the 0 and the bezel spawns, then tune the warning
or camera framing only if a single cap hides too much of the fight.

## 2026-11-01 — INFECTION all-program balance sweep

**Goal:** measure every program in infection, headless and headed, and compare the result with the PvP
balance work rather than assuming duel strength carries over.

- Added the non-shipping `.tmp/infection-balance.ts` probe. It runs 13 programs × 3 maps without damaging hazards ×
  3 bot styles × 5 seeds, records clears, clear time, end progress, kills, damage and kit actions, and
  optionally taps a ready Y skill when a virus is within 440 units. AI ownership keeps the brain's 0.8×
  lead and projectile speed aligned.
- Headless baseline: 412/585 clears (70.4%). Compress 100%, Wedge 97.8%, Kaboom 97.8%, Pinball 95.6%,
  Probe 93.3%, Toxic 91.1%, Sweep 84.4%, Bad Lag 82.2%, Ghost 80.0%, Atomize 42.2%, Copy Pasta 37.8%,
  Fisher 13.3%, Aim Bot 0%.
- Skill tap arm: 423/585 clears (72.3%). Atomize jumps to 93.3% but still takes ~74 s; Aim Bot stays at
  0%, Fisher drops to 6.7%, and the top group is essentially unchanged.
- PvP reference on the same build: 4P FFA Atomize 53.8%, Aim Bot 42.5%, Ghost 38.8%, Compress 31.3%,
  Toxic 26.3%, Pinball 25.0%, Kaboom 25.0%, Fisher 18.8%, Sweep 17.5%, Copy Pasta 15.0%, Probe 12.5%,
  Bad Lag 8.8%, Wedge 5.0%; the 1v1 order has Pinball 69.4%, Atomize 66.7%, Compress 59.7% at the top.
  The v0.1.89 two-seed direction still holds.
- Headed Chromium on GRID ZERO: 11/13 one-run clears; Fisher failed at 13.1 s (37.5%) and Aim Bot at
  15.0 s (36.4%). Probe, Wedge, Fisher, Sweep, Toxic and Aim Bot used the normal boot path; the other results used
  the live page restart. No console errors.
- No gameplay or tuning values changed. The obvious split is mode fit, not a single weak character: PvP
  precision and overkill lose value against 1-HP bodies, while sustain, shove and area clear gain it.

**Verification:** the 585-run baseline and skill arm completed cleanly; both the 468-game 1v1 and
260-round 4P PvP probes ran on the current build; all 13 headed checks loaded and ran. `.tmp/infection-
balance-report.md` carries the full tables. No source or build stamp changed; `git diff --check` is clean.

**Limitations:** the gauntlet autopilot does not tap most Y skills or use dashes, so this is a basic-kit
read, not a full-kit verdict. The headed pass is one sample per program on one arena; the in-page restart
is not a fresh app boot. No human infection pass has been done.

**Next:** human pass on Aim Bot, Fisher, Atomize and Copy Pasta; decide whether infection-specific kit
changes are warranted without touching health; teach the autopilot the Y skills before treating its clear
rates as complete balance.

## 2026-11-01 — USB HUB arena (v0.1.106)

**Goal:** add a round USB hub with four sliding thumb-drive islands and inward/outward currents that move
players and threats between the hub and the islands.

- Added arena id 15, `USB HUB`: a 300-radius hub, four 420×240 drives on the cardinal axes, a 70-unit
dock overlap and a shared 2.8 s in / 1.25 s extend / 2.6 s out / 1.25 s retract cycle. At full extension
the drives leave a 150-unit gap; a dash can cross it, a walk falls. The only floor is the hub and the four
current drive rectangles, and the arena has no outer wall.
- Added `ArenaUsbDef`, `UsbDriveDef`, `USB_STATE` and the shared helpers (`usbCycle`, `usbPhaseAt`,
`usbExtensionAt`, `usbFlowDirAt`, `usbDriveRect`, `usbFloorAt`, `usbFlowAt`) in `arenas.ts`. Drive lanes
are 48 units wider than the plate and start 48 units inside the moving lip. The current is direct body
drift at 95 u/s, outward on extension and inward on retraction; a body on a drive also receives that
drive's per-tick delta.
- `World` now owns `usbT`, `usbRects`, ride/current application for players and threats, USB floor checks
in `checkFall`/`offFloor`, and drone target selection that respects the floor. The renderer paints the
hub, sockets, connectors, LEDs and animated flow chevrons, and gets the clock through `RenderState.usbT`.
The picker preview uses the same geometry helpers.
- USB HUB is local-only because the snapshot does not carry a drive phase; `isOnlineArena` excludes it.
Infection loads its opening colony and later arrivals onto the east drive, and the opening sentry pack is
placed on the hub instead of the normal view-sized offset. Bots check USB floor for dash landings and
steer back from an off-floor recovery.
- Added AGENTS D43, the GAME_GUIDE arena row, README count and TODO entries; bumped the build stamp to
0.1.106.

**Verification:** `.tmp/usb-hub-check.ts` passed: docked/out drive positions, 150-unit gap, outward and
inward flow vectors, drive carry, dash crossing and a walk-off fall. `npx tsc --noEmit`, `npm run build`
and `git diff --check` are clean.

**Limitations:** this is a geometry, headless-simulation and build check, not a human visual pass. The
static bot nav grid does not model the opening and closing gaps; the direct floor/dash checks are the
safety layer. No screenshot or headed playtest was taken.

**Next:** play USB HUB in training, gauntlet and infection at camera zoom; judge whether the 150-unit gap
timing and the 95 u/s current are readable and whether bots use the islands or stay on the hub. Do not
open it online until a snapshot phase is designed.

## 2026-11-01 — USB HUB playtest tune (v0.1.107)

**Goal:** play USB HUB at camera zoom, test the drive ride and both current directions, then tune the cycle
timing and travel speed rather than guessing from the geometry table.

- Headed training pass on USB HUB: the drone was disabled for an isolated cycle sample. Walking onto the
  west drive put the player at x657 at t=1.83 s; the extension carried the body to x405 by t=3.63 s with
  the player alive and on the plate. Holding outward (`A`) moved x365.5 to x150.7 in 0.68 s while the
  extension current was active; the later retract current pulled the body back toward the hub.
- The current band is deliberate. With full inward steering, the 248 u/s walk and the plate-plus-current
  push roughly cancel, so the player can resist the ride but is still carried by it. I kept the 150-unit
  gap, 220-unit extension and 95 u/s flow speed.
- Tuned the cycle from 2.8 s in / 1.25 s extend / 2.6 s out / 1.25 s retract to 2.8 s in / 1.15 s extend /
  3.3 s out / 1.15 s retract. The separated islands now hold for 0.7 s longer and the transitions are 0.1 s
  shorter, without changing the gap or current strength.
- Updated AGENTS D43, TODO, and the build stamp to 0.1.107.

**Verification:** live Chromium training on USB HUB with the cycle and current observed; `.tmp/usb-hub-check.ts`
for geometry/carry/dash/fall; `npx tsc --noEmit`, `npm run build`, `npm run bench` and `git diff --check`.

**Limitations:** this was a training pass; gauntlet and infection threat rides, bot island use and the
three-player camera framing have not been played headed. No screenshots were committed.

**Next:** play the tuned cycle in gauntlet and infection, then adjust only if a threat is visibly pinned to
a drive or the 3.3 s separation feels too long.

## 2026-11-01 — USB HUB online state and longer reach (v0.1.108)

**Goal:** make fully separated USB islands impossible to cross with a single dash, and carry the drive clock
in the multiplayer snapshot so USB HUB can enter hosted rooms.

- Grew the drive extension from 220 to 300. The full-out gap is now 230 units, just past the 180-unit
  dash; the gap remains crossable during the extension travel. The drive tips still land exactly on the
  authored square bounds (48 and 1948), so the camera box and floor edges do not change.
- Added `usbT` to `SnapshotHazards` after the browser page, moving props to index 7. The host serializes
  `round2(world.usbT)`; `parseHazards` accepts the old props-at-6 shape during a rolling reload.
- Added `NetView.usbT` and sync it from the snapshot clock plus interpolation age. Guests derive the
  plates, current overlay and drive placement from that clock; the host still owns rides, currents,
  falls and damage. `isOnlineArena` now accepts `usb` instead of excluding it.
- Updated AGENTS D43, GAME_GUIDE, TODO, the USB geometry probe and the build stamp to 0.1.108.

**Verification:** `.tmp/usb-hub-check.ts` covers the 230-unit gap versus the 180-unit dash, a full-out
refusal, a partial-gap crossing, carry, both current directions, the snapshot clock at hazards index 6,
props at 7, guest `parseSnapshot`/`NetView` (`usbT` 12.34) and local gauntlet/infection construction.
`npx tsc --noEmit`, `npm run build`, `npm run bench` and `git diff --check` pass.

**Limitations:** no two-client internet match has been run yet. The guest predictor still does not model
the moving plates or current locally; host snapshots remain authoritative, so a guest may briefly predict
across a gap before the host correction.

**Next:** run a two-tab host/join USB HUB match on a non-default arena, check drive sync through a round
and rematch, and deliberately dash into the full-out gap as a guest.

## 2026-11-01 — SWIPE RIGHT arena (v0.1.109)

**Goal:** add the dating-phone arena from the brief, with a card deck that shifts the whole fight and a
periodic match popup that becomes real floor cover, including online state.

- Added arena id 16, `SWIPE RIGHT`: a 1000×1800 phone screen with eight emoji profiles, an app header, a
  profile card and a central match popup. The picker preview uses the same profile/popup data.
- Added `ArenaSwipeDef` and shared helpers for the swipe index, direction, travel, profile index and
  popup warning/height. The cycle is 4.6 s per card, 0.36 s of travel and a 108-unit carry; directions
  alternate, with the first physical swipe going right.
- `World.tickSwipe` carries players, bots, projectiles, worms and segments, viruses, sentries, errors,
  the drone and props. Carried bodies clamp to the phone bounds and existing solids. The popup is added
  to `solids`/`dashSolids` while raised, displaces bodies caught underneath, and is removed when it
  falls. Shots use the shared `bounceCoverRect` path, so the popup is temporary cover rather than a
  decoration. Round resets clear both clocks and the solid.
- `SnapshotHazards` now carries `swipeT` at 7 and `swipePopupT` at 8, with props at 9. `parseHazards`
  still accepts the USB shape (props at 7) and the older props-at-6 shape. `NetView` exposes both clocks;
  `LocalPredictor.setHazards` adds the raised popup as dynamic cover. `isOnlineArena` accepts the map.
- Added AGENTS D44, the GAME_GUIDE arena row/test note, README and GAME_GUIDE arena counts, the TODO
  section, and bumped the build/service-worker stamp to 0.1.109.

**Verification:** `.tmp/swipe-right-check.ts` passes: id 16, 17 arenas, first swipe carries a parked
body +105 units, popup solid/displacement/removal, snapshot indices 7/8 and props at 9, guest `NetView`
clocks, and legacy USB parsing. `npm run build` passes. `npm run bench` passes (gauntlet max avg 0.173 ms,
p99 0.605 ms, 28.4 live threats; 8P max projectiles avg 0.065 ms). `git diff --check` is clean.

**Limitations:** no headed camera/framing pass and no live two-client PeerJS match. Guests receive host
body positions and clocks, but the guest predictor does not locally replay the swipe carry, so a guest can
briefly predict against the moving floor before the next host correction.

**Next:** play the card/popup pass at camera zoom on a desktop and phone viewport, then run a two-tab
host/join check for swipe/popup sync and a rematch.

## 2026-11-01 — SATELLITE orbital hazard arena (v0.1.110)

**Goal:** build the SATELLITE brief: a long hull linked to solar wings that periodically burn the map, a
telescoping bottom mast, periodic micro-meteor showers, and top capacitors whose destruction sends the
whole satellite into a bottom-up reentry burn. Keep it local-only until the snapshot can carry its clocks.

- Added arena id 17, `SATELLITE`: a five-plate floor union (central hull, port and starboard solar wings,
two bridge plates), with real space outside the plates. The picker preview uses the same geometry.
- Solar wings run independent 16 s cycles (3 s warning, 5.2 s hot, phase offsets 0 and 8 s), damaging
players, bots, hostiles and the drone inside a hot panel. The telescope is moving cover and a lift with a
3.2 s extend / 4.4 s hold / 3.2 s retract / 5.2 s rest cycle.
- Added seven-rock meteor showers every 12.5 s after an 8 s opening delay. Each rock has a 0.9 s falling
warning, a 48-unit impact radius and 1 damage; the meteor list is local state, not network projectiles.
- Added three mounted capacitor props (64×84, hp 4) at the top. They take normal prop damage but cannot be
launched. Destroying all three starts a 5 s thruster fuse and a 14 s bottom-up heat front (1 damage every
0.8 s). The front holds at the top lip for up to 2.5 s, or ends early when every live body is gone, then
the arena cools for 5 s and restores the pods.
- Added renderer treatment for space, the five plates, solar warnings/hot panels, the mast, capacitor
sockets, meteor warnings/impacts, thruster flames and the reentry wash. Floor checks, drone/pickup/threat/
prop placement, fall handling and the bot nav grid all use the satellite floor union.
- Kept the arena local-only: `isOnlineArena` excludes it and no satellite state enters `SnapshotHazards`.
Added AGENTS D45, this TODO section and the GAME_GUIDE/README arena counts.

**Verification:** `.tmp/satellite-check.ts` passes all timing chains (solar damage, meteor damage, mast
lift, capacitor trigger, reentry hold and reset). `npx tsc --noEmit`, `npm run build`, `npm run bench` and
`git diff --check` pass. Build: 776.83 kB JS / 216.58 kB gzip, 50.09 kB CSS / 11.20 kB gzip, with the
existing chunk-size warning. Bench: 8P max projectiles 0.064 ms avg; gauntlet max 0.149 ms avg, 0.466 ms
p99, 28.4 live threats.

**Limitations:** no headed camera/framing pass and no visual check of the reentry wash. SATELLITE is
intentionally absent from hosted rooms, so no two-client test was run. No render-performance measurement
was taken on the new effects.

**Next:** play SATELLITE headed in training and a gauntlet run, then adjust only the warning windows and
mast timing that read badly at camera zoom.

## 2026-11-01 — Opt-in session feedback (v0.1.111)

**Goal:** add an end-of-session feedback action that shares the balancing, performance and setup data
normal play already produces, without adding automatic upload, a client credential or a backend.

- Added `src/game/sessionReport.ts`: a session-scoped `SessionTracker` with anonymized player rows, round
deltas, deflect-source counts, result fields, environment, FPS/frame/sim samples, summary and compact share
text.
- Wired capture into normal play rather than only the QA tour: every mode starts a tracker, `handleGameEvent`
records actions/hits/kills/deaths, `syncSessionRound` closes match rounds, and the loop samples performance
once per second while live.
- Added **`SHARE FEEDBACK`** to match, series, gauntlet, infection, campaign and leave overlays. It uses the
Web Share API with a `deflect-session-*.json` file when supported; otherwise it downloads the JSON and
copies a compact summary. No names, room codes, IPs or raw inputs are included.
- Kept the existing `?playtest=1` arena-tour log separate. Neither path enters `Snapshot`; only the player
pressing share produces a file. The build stamp was corrected from the stale 0.1.109 value to 0.1.111.
- Updated AGENTS D46, PLAYTEST, GAME_GUIDE, README, TODO and the version/service-worker stamps.

**Verification:** `.tmp/session-report-check.ts` passes round/action/deflect/performance assertions and the
share-text privacy check. `npx tsc --noEmit`, `npm run build`, `npm run bench` and `git diff --check` pass.
Build: 787.54 kB JS / 220.26 kB gzip, 50.09 kB CSS / 11.20 kB gzip, with the existing chunk-size warning.
Bench: 8P max projectiles 0.064 ms avg; gauntlet max 0.153 ms avg, 0.520 ms p99, 28.4 live threats.

**Limitations:** no headed native-share or download/copy fallback check yet. The report is kept in memory and
is lost if the tab closes before the player shares it. No remote ingest exists by design.

**Next:** test the share sheet on a phone and the download/copy fallback on desktop; only add a server-side
ingest endpoint if real feedback volume justifies it.

## 2026-11-01 — SATELLITE online (v0.1.112)

**Goal:** make SATELLITE selectable in hosted rooms without moving its hazard authority off the host.

- Extended `SnapshotHazards` after the existing prop row with the solar/telescope clock, thruster fuse,
  reentry clock, heat front and live meteor rows. The prop row gains an additive capacitor flag at index 9.
- Wired `NetView` to derive solar/telescope poses from the shared clock, advance the reentry front and
  mirror active meteors and capacitor pods. `LocalPredictor` now adds the extended mast as dynamic cover.
- Removed SATELLITE from the `isOnlineArena` exclusion. The host still owns solar and meteor damage,
  capsule breaks, mast lift/carry, prop damage and reentry hits; guests only render and predict.
- Kept the wire backward-compatible: older hazard shapes still parse, and the new fields default to zero
  when a host predates them.

**Verification:** `.tmp/satellite-net-check.ts` passes hazard shape, parser, guest clock/front, meteor,
capacitor and predictor mast assertions; `.tmp/satellite-check.ts` still passes. `npx tsc --noEmit`,
`npm run build`, `npm run bench` and `git diff --check` pass. Build: 789.90 kB JS / 220.81 kB gzip,
50.09 kB CSS / 11.20 kB gzip, with the existing chunk-size warning. Bench: 8P max projectiles 0.071 ms
avg; gauntlet max 0.188 ms avg, 0.581 ms p99, 28.4 live threats. The full SATELLITE hazard block measured
192 B with seven live meteors; non-satellite maps still emit the 16 B clock-only shape.

**Limitations:** no two-client room test yet. The extended hazard block is larger during a meteor shower;
SATELLITE stays out of the remote disc-emitter group and still uses the ordinary snapshot path.

**Next:** host a two-client match on SATELLITE and verify a guest sees the solar warning, meteor impacts,
capacitor sockets and reentry front at the same time as the host.

## 2026-11-02 — ROCKET NAVIGATION and WEAPON SYSTEMS (v0.1.113)

**Goal:** add the two requested display arenas without turning either into a new engine layer or an
unsynced online hazard.

- Added `ArenaRocketDef` and `ArenaWeaponDef` data to `ArenaDef`; ROCKET NAVIGATION is id 18 and WEAPON
  SYSTEMS is id 19, after SATELLITE.
- ROCKET NAVIGATION runs a 24 s launch from below the floor lip to the upper corner. Speed, altitude and
  trajectory readouts count up while the arc grows; the atmosphere band and booster/fairing debris are
  presentation only.
- The trajectory is real cover: 128 preallocated overlapping `Rect`s grow along the same quadratic curve
  the renderer samples. They are added to both `solids` and `dashSolids`, so bodies, dashes and shots
  cannot cross the finished line. The launch clock resets in `beginRound()`; no snapshot fields were added.
- WEAPON SYSTEMS is a fighter-jet status screen with a vector side profile, cockpit readouts and three
  large console banks. Those banks are ordinary static cover and also the drawn controls (`FIRE WEAPONS`,
  `EJECTOR SEAT`, `THRUSTERS`); they do not add a jet weapon, eject action or thruster system.
- Added custom renderer branches and picker previews for both maps. Excluded both from `isOnlineArena`
  because the rocket clock/barrier and cockpit display are local-only.

**Verification:** `.tmp/two-new-maps-check.ts` passes arena ids/order, arc endpoints, 128-block barrier growth,
reset, no-hazard-snapshot and three-bank cover assertions. `npx tsc --noEmit`, `npm run build`,
`npm run bench` and `git diff --check` clean. Build: 802.14 kB JS / 224.27 kB gzip, 50.09 kB CSS /
11.20 kB gzip, with the existing chunk-size warning. Bench: 8P max projectiles 0.074 ms avg; gauntlet max
0.141 ms avg, 0.454 ms p99, 28.4 live threats.

**Limitations:** the bot nav grid does not know the growing arc, so bots can path through it while short;
both maps are local-only and have no guest presentation. Neither map was played in a headed session yet.

**Next:** run a training pass on both maps at full size, then decide whether the rocket wall belongs in bot
navigation or in a future snapshot protocol.

## 2026-11-02 — Multiplayer status telemetry (v0.1.114)

**Goal:** give online rooms visible connection data without turning telemetry into synced game state.

- Added a read-only `MpStatus` to `HostNet` and `GuestNet` with role, room code, local slot, connected
  count, measured application RTT and live snapshot cadence.
- Added rate-limited `MSG.PING` / `MSG.PONG` messages. Hosts average their guests, guests measure the host,
  and both smooth the result. Older peers ignore the messages and simply show `--`.
- Added the lobby `RTT` stat and the in-game `MP STATUS` panel. The panel hides with `GAME UI`, loading and
  overlays. No status field enters `LobbyState`, `Snapshot` or `World`.
- Documented the local-telemetry boundary in AGENTS D48 and updated README, GAME_GUIDE and TODO.

**Verification:** `npm run build` passes (includes `tsc --noEmit`): 805.20 kB JS / 225.09 kB gzip,
51.04 kB CSS / 11.39 kB gzip, with the existing chunk-size warning. `npm run bench`: 8P max projectiles
0.066 ms avg / 0.127 ms p99; gauntlet max 0.201 ms avg / 0.577 ms p99, 28.4 live threats.
`git diff --check` clean.

**Limitations:** no two-real-client pass yet. The RTT is application-level and peer-specific; it does not
measure browser/network loss or jitter separately, and a late pong can leave the smooth value stale.

**Next:** run a two-client room and verify RTT, snapshot cadence, disconnect fallback and the legacy-peer
`--` state.

## 2026-11-02 — SPEAK & FIND and CAR NAVIGATION (v0.1.115)

**Goal:** add the requested children's find toy and the map-screen car route without inventing a second
engine layer.

- Added `ArenaSeekDef` and `ArenaCarDef`; SPEAK & FIND is id 20 and CAR NAVIGATION is id 21, after the
  earlier display maps.
- SPEAK & FIND draws a moulded talking-toy floor with six picture cards, a cycling `FIND THE ...` prompt,
  a pulsing matching card, a sweeping magnifier and four chunky letter keys that are the static cover.
  The prompt and cards are presentation only; they do not grant pickups, score or new collision.
- CAR NAVIGATION draws a GPS/map floor with a city grid, river, park, named pins and a speed/ETA/next-stop
  readout. The serpentine route starts below the left lip and ends at the upper-right map edge over 26 s.
- The travelled route is real cover: 160 preallocated overlapping `Rect`s are sampled from the shared
  polyline into `solids` and `dashSolids`, blocking bodies, dashes and shots. The route resets in
  `beginRound()`. Neither map adds `SnapshotHazards` fields or enters hosted rooms.
- Added custom renderers and picker previews. Updated README, GAME_GUIDE, AGENTS D49 and TODO.

**Verification:** `.tmp/two-more-maps-check.ts` passes 22-arena order, six cards and prompts, four cover
keys, a 2044-unit serpentine route with five turns, 160-block overlap, early growth, complete wall, reset,
and `SnapshotHazards === null`. `npm run build` passes (includes `tsc --noEmit`): 817.96 kB JS /
228.29 kB gzip, 51.04 kB CSS / 11.39 kB gzip, with the existing chunk-size warning. `npm run bench` clean:
8P max projectiles 0.067 ms avg / 0.127 ms p99; gauntlet max 0.154 ms avg / 0.489 ms p99, 28.4 threats.
`git diff --check` clean.

**Limitations:** neither new map was played in a headed session. The car wall is not in the bot nav grid
and is local-only; the SPEAK & FIND cards are display art rather than collectible targets.

**Next:** play both maps at full size, then decide whether the car route needs a bot-nav representation or
an online snapshot clock.

## 2026-11-02 — PONG arena (v0.1.116)

**Goal:** add the requested arcade-game arena with a live Pong court, not another static display board.

- Added `ArenaPongDef` and `ArenaDef.pong`; PONG is id 22 after CAR NAVIGATION. The court is
  `1460 × 780` with no static cover, two automatic paddles, a square ball, a delayed serve and a scoreboard.
- `World` owns the rally: paddles track the ball, top and bottom walls return it, a missed ball scores for the
  opposite side, and `beginRound()` resets the score, paddles and serve. The ball is a local hazard that
  damages and ricochets off players, the training drone and every gauntlet threat family; dashing or phased
  bodies avoid it. Added `SRC.PONG` for the death source.
- Added a CRT cabinet renderer with phosphor scanlines, score digits, paddle rails and point flash, plus a
  picker preview. Local-only through `isOnlineArena`; the rally and score are not in `SnapshotHazards`.
- Updated README, GAME_GUIDE, AGENTS D50 and TODO.

**Verification:** `.tmp/pong-arena-check.ts` passes 23-arena order, id 22, court bounds, eight safe spawns,
serve and ball movement, paddle bounds, a body hit for three segments with `SRC.PONG`, round reset and
`SnapshotHazards === null`. `npm run build` passes (includes `tsc --noEmit`): 827.70 kB JS / 230.60 kB gzip,
51.04 kB CSS / 11.39 kB gzip, with the existing chunk-size warning. `npm run bench` clean: 8P max projectiles
0.073 ms avg / 0.224 ms p99; gauntlet max 0.172 ms avg / 0.520 ms p99, 28.4 threats. `git diff --check` clean.

**Limitations:** no headed playtest was run. Both paddles are automatic and the rally scores rarely (one
point per side in a 180-second idle simulation), so the scoreboard is mostly set dressing. The moving ball is
not in bot pathing; bots can be caught by it.

**Next:** read the court at play size, then tune paddle speed or serve angles if the rally needs more scoring.

## 2026-11-02 — AIRPORT flip-board arena (v0.1.117)

**Goal:** turn the airport arrivals/departures board into a finished local arena whose flipping numbers are
an actual floor hazard.

- Added `ArenaFlipDef` and `ArenaDef.flip`; AIRPORT is id 23 after PONG. Six flight rows split three arrivals
  and three departures; each row owns a time deck and destination/gate/status labels.
- Added `FLIP_STATE` plus row phase/state/flap/time helpers. The board advances through warning, flap and
  idle states in a staggered wave; `flipTimeRectAt` keeps the collision footprint and the rendered tile in
  sync. `beginRound()` rearms the board.
- Added six time tiles as local hazards: a flap damages and shoves players, the training drone and every
  gauntlet threat family. `SRC.FLIP` identifies the death source. Dashes and phased bodies avoid the hit.
- Added a terminal-floor renderer with gate windows, check-in/baggage/cafe/gates benches, amber board
  housing, section labels, clock strings and a split-flap sweep across the numbers. Added a picker preview.
- AIRPORT is local-only through `isOnlineArena`; its clock and row states never enter `SnapshotHazards`.
- Updated README, GAME_GUIDE, AGENTS D51 and TODO.

**Verification:** `.tmp/airport-arena-check.ts` passes 24-arena order, id 23, six rows (3 arrivals/3
departures), six time tiles, board/tile bounds, spawn safety, flap timing, a real one-segment hazard hit with
`SRC.FLIP`, round reset and `SnapshotHazards === null`. `npm run build` passes (includes `tsc --noEmit`):
836.83 kB JS / 232.93 kB gzip, 51.04 kB CSS / 11.39 kB gzip, with the existing chunk-size warning.
`npm run bench` clean: 8P max projectiles 0.067 ms avg / 0.149 ms p99; gauntlet max 0.169 ms avg / 0.600 ms
p99, 28.4 threats. `git diff --check` clean.

**Limitations:** no headed playtest was run. The time tiles are not represented in bot navigation, so a bot
can stand on a warning tile; the flip text and terminal furniture are presentation only.

**Next:** play it at full size, then decide whether warning tiles need a bot-navigation repulsion pass.

## 2026-11-02 — SPACE INVADERS simulated cannon arena (v0.1.118)

**Goal:** put the players inside the invaders' part of an arcade screen and make the simulated arcade
player at the bottom a real local threat.

- Added `ArenaInvadersDef` and `ArenaDef.invaders`; SPACE INVADERS is id 24 after AIRPORT. The painted
  fleet is five rows by ten columns of pixel invaders, with three green bunkers as static cover.
- Added a simulated cannon that patrols the bottom, tracks the nearest horizontal live body and fires
  upward local shots. The shots stop on bunkers and damage players, the training drone and every gauntlet
  threat family; dashing or phased bodies avoid them. Added `SRC.ARCADE` and the local `InvaderShot` type.
- Added a neon fleet/starfield renderer, bunker silhouettes, an aim lane, muzzle flash, local shots and a
  picker preview. `beginRound()` resets the cannon and clears its shots. The fleet is presentation only.
- SPACE INVADERS is local-only through `isOnlineArena`; its cannon, aim line and shots never enter
  `SnapshotHazards`. Updated README, GAME_GUIDE, AGENTS D52 and TODO.

**Verification:** `.tmp/invaders-arena-check.ts` passes 25-arena order, id 24, a 5×10 fleet, three bunkers,
safe spawns, cannon tracking, a two-segment `SRC.ARCADE` hazard hit, round reset and
`SnapshotHazards === null`. `npm run build` passes (includes `tsc --noEmit`): 845.42 kB JS / 235.31 kB gzip,
51.04 kB CSS / 11.39 kB gzip, with the existing chunk-size warning. `npm run bench` clean: 8P max projectiles
0.065 ms avg / 0.128 ms p99; gauntlet max 0.208 ms avg / 0.813 ms p99, 28.4 threats. `git diff --check` clean.

**Limitations:** no headed playtest was run. The cannon shots are local-only and bots do not dodge the aim
lane; the invader fleet is painted presentation, not collision.

**Next:** play it at full size, then add a bot dodge response to the cannon aim lane if it reads as too harsh.

## 2026-11-02 — FAX MACHINE shuttle-print arena (v0.1.119)

**Goal:** add a scanner-style document arena where the hazard is a printer head moving back and forth.

- Added `ArenaFaxDef` and `ArenaDef.fax`; FAX MACHINE is id 25 after SPACE INVADERS, with a 1254×758
  incoming fax sheet and four corner toner-drum/paper-stack cover pieces.
- Added a thermal carriage that shuttles left and right across the page, parks and blinks at each edge, then
  reverses. The vertical print bar damages players, the training drone and every gauntlet threat family once
  per pass; dashing and phased bodies avoid it. Added `SRC.FAX` and the four `FAX_STATE` phases.
- Added a custom fax renderer with sheet copy, routing block, rails, carriage, feed rollers, hot bar and
  reversal telegraph, plus a picker preview. `resetFax()` clears the clock, page and pass masks on round start.
- FAX MACHINE is local-only through `isOnlineArena`; its shuttle and pages never enter `SnapshotHazards`.
  Updated README, GAME_GUIDE, AGENTS D53 and TODO.

**Verification:** `.tmp/fax-arena-check.ts` passes 26-arena order, id 25, four phases, a 9.47 s cycle,
rail-bounded travel 349..1545, a live hit at 2.72 s using `SRC.FAX`, one segment of damage, round reset and
`SnapshotHazards === null`. `npm run build` passes (includes `tsc --noEmit`): 854.22 kB JS / 237.20 kB gzip,
51.04 kB CSS / 11.39 kB gzip, with the existing chunk-size warning. `npm run bench` clean: 8P max projectiles
0.064 ms avg / 0.123 ms p99; gauntlet max 0.147 ms avg / 0.488 ms p99, 28.4 threats. `git diff --check` clean.

**Limitations:** no headed playtest was run. The shuttle is local-only and bots do not dodge the print bar;
its vertical bar is a floor hazard, not solid cover.

**Next:** play the carriage and reversal telegraph at full size, then add a bot sidestep if the bar feels
unavoidable in the centre.

## 2026-11-02 — SMART PLUG circuit-ring arena (v0.1.120)

**Goal:** add a plug-themed arena with a green/red light mechanic where electricity flows between plugs
and catches bodies that stay in the live circuit.

- Added `ArenaPlugDef` and `ArenaPlugArcDef`; SMART PLUG is id 26 after FAX MACHINE, with four dual-socket
  smart-plug modules as static cover.
- Four socket-to-socket arcs form a ring around the centre. Green is safe, a short red blink warns, the red
  pulse is live, and a cooldown follows. The live band damages players, the training drone and every gauntlet
  threat family once per pulse; dashing and phased bodies avoid it. Added `SRC.PLUG`.
- Added a custom renderer with board traces, four LEDs, safe guide lines, a dashed warning preview, jagged
  live arcs, socket plates and a voltage watermark, plus a picker preview. `resetPlug()` clears the clock
  and per-pulse hit masks on round start.
- SMART PLUG is local-only through `isOnlineArena`; its clock and arcs never enter `SnapshotHazards`.
  Updated README, GAME_GUIDE, AGENTS D54 and TODO.

**Verification:** `.tmp/plug-arena-check.ts` passes 27-arena order, id 26, four modules and four arcs, all
four phases, a 5.80 s cycle, clean spawn clearance, a safe pre-live window, a live hit at 3.17 s using
`SRC.PLUG`, one segment of damage, no double hit in the same pulse, round reset and `SnapshotHazards === null`.
`npm run build` passes (includes `tsc --noEmit`): 863.80 kB JS / 239.78 kB gzip, 51.04 kB CSS / 11.39 kB
with the existing chunk-size warning. `npm run bench` clean: 8P max projectiles 0.069 ms avg / 0.223 ms p99;
gauntlet max 0.153 ms avg / 0.515 ms p99, 28.4 threats. `git diff --check` clean.

**Limitations:** no headed playtest was run. Bots do not wait out the circuit ring, and the arcs are floor
hazards rather than solid cover.

**Next:** play the green/red LEDs and live ring at full size, then add a bot sidestep or wait state if the
ring feels too punishing.

## 2026-11-02 — SMOKE DETECTOR alarm-ring arena (v0.1.121)

**Goal:** add a round smoke-detector arena with smoke sensors, an alarm sound generator that emits damaging
waves, and a destructible battery that breaks the alarm.

- Added `ArenaSmokeDef`; SMOKE DETECTOR is id 27 after SMART PLUG. Its round floor reuses the existing `disc`
  rim with zero spin, no holes and a zero-length arm, so the circular drop uses the established movement and
  camera path rather than a second round-floor system.
- Four floor sensors arm a timed central siren. The alarm emits expanding rings, each damaging a body once;
  dashing and phased bodies avoid them. Added `SRC.SMOKE`.
- Added a fixed six-hit battery prop beside the siren. Shots stop on it and chip it; destroying it stops the
  siren, clears live rings and disables the sensors for the round. `beginRound()` restores it through
  `resetSmoke()`.
- Fixed props are now never launched, moved, separated or drawn as file boxes, and `buildSnapshotHazards`
  skips them. Added the custom detector renderer with ridges, vents, sensor pads, siren, live rings and a
  battery health bar, plus a picker preview.
- SMOKE DETECTOR is local-only through `isOnlineArena`; its alarm clock, waves and battery are not in
  `SnapshotHazards`. Updated README, GAME_GUIDE, AGENTS D55 and TODO.

**Verification:** `.tmp/smoke-arena-check.ts` passes 28-arena order, id 27, round floor and spawn clearance,
four sensors, sensor-triggered alarm, a live wave hit using `SRC.SMOKE`, one segment of damage, a six-hit
battery, battery shutdown, round reset and `SnapshotHazards === null`. `npm run build` passes (includes
`tsc --noEmit`): 875.75 kB JS / 242.72 kB gzip, 51.04 kB CSS / 11.39 kB gzip, with the existing chunk-size
warning. `npm run bench` clean: 8P max projectiles 0.065 ms avg / 0.127 ms p99; gauntlet max 0.154 ms avg /
0.449 ms p99, 28.4 threats. `git diff --check` clean.

**Limitations:** no headed playtest was run. The six-hit battery shutdown is verified by the world probe,
not by a full input-driven shooting pass. Bots do not avoid sensors or alarm rings, and the rings are floor
hazards rather than solid cover.

**Next:** play the round face, sensor warning and live rings at full size, then add bot sensor avoidance or
a visible pre-alarm dwell if the first step feels too sudden.

## 2026-11-02 — SMART WATCH second-hand arena (v0.1.122)

**Goal:** add a smart-watch arena with a large watch face, readable app complications and a live clock-hand
hazard.

- Added `ArenaWatchDef`; SMART WATCH is id 28 after SMOKE DETECTOR. The face is a rounded screen inside the
  device body, with four raised app complications as static cover.
- A second hand starts at twelve and sweeps clockwise at 1.05 rad/s. Bodies crossing the forward segment
  take one segment of damage and a shove; dashing and phased bodies avoid it. Added `SRC.WATCH`.
- The hand is a floor projection, so the app cards do not stop it; cover still stops bodies, dashes and shots
  normally. Per-family masks enforce one hit per revolution and clear only when the hand wraps through
  twelve. `resetWatch()` rewinds the clock and masks in `beginRound()`.
- Added the custom renderer with a rounded case, screen, sixty minute ticks, time readout, four app cards,
  orange hand, pivot, digital crown and side button, plus a picker preview. The hand clock and state are
  local-only through `isOnlineArena` and never enter `SnapshotHazards`.
- Updated README, GAME_GUIDE, AGENTS D56, TODO and the version stamps to v0.1.122.

**Verification:** `.tmp/watch-arena-check.ts` passes 29-arena order, id 28, four cover cards, a hand that
starts at twelve and reaches three o'clock on schedule, clear opening spawns, a first hit at 1.4 s using
`SRC.WATCH`, one segment of damage, no double hit in the same revolution, round reset and
`SnapshotHazards === null`. `npm run build` passes (includes `tsc --noEmit`): 884.52 kB JS / 244.70 kB gzip,
51.04 kB CSS / 11.39 kB gzip, with the existing chunk-size warning. `npm run bench` clean: 8P max projectiles
0.072 ms avg / 0.132 ms p99; gauntlet max 0.176 ms avg / 0.633 ms p99, 28.4 threats. `git diff --check` clean.

**Limitations:** no headed playtest was run. The hand passes over cover by design, and bots do not avoid it.
The probe checks the world hit path and reset, not the full rendered arena at play size.

**Next:** play the face and hand at full size, then add bot avoidance or a short pre-sweep warning if the
first crossing feels too sudden.

## 2026-11-02 — BUSINESS LAPTOP moving-mail arena (v0.1.123)

**Goal:** add a business-laptop screen arena for the campaign, with an endless inbox and a preview pane that
rewrites the layout as messages change.

- Added `ArenaLaptopDef`; BUSINESS LAPTOP is id 29 after SMART WATCH and brings the roster to thirty arenas.
  The mail-screen variant is data-driven for campaign reuse; the spreadsheet and chat ideas remain future
  riffs rather than additional simulations in this pass.
- Four inbox cards scroll upward on `laptopCardY()`, wrap at the pane edge and become collisionless while
  off-pane. Cards and the active message's preview layout are dynamic solid cover for bodies, threats,
  shots, bombs and the heavy laser.
- Four authored messages each carry a different right-side layout. The preview swaps every 8 seconds with a
  new-message flash, and the renderer draws the mail chrome, scrolling cards, attachment blocks, progress
  bar and picker preview.
- `tickLaptop()` refreshes cover before player movement; `resetLaptop()` rewinds the mail in `beginRound()`.
  BUSINESS LAPTOP is local-only through `isOnlineArena`; no clock, card or layout enters `SnapshotHazards`.
  Bots get a repulsor around live laptop cover.
- Updated README, GAME_GUIDE, AGENTS D57, TODO and version stamps to v0.1.123.

**Verification:** `.tmp/laptop-arena-check.ts` passes 30-arena order, id 29, four messages and four cards,
all spawns clear of every authored layout, upward card travel, initial cover, the message-1 swap after the
8-second boundary, a seven-piece cover set after the swap, round reset and `SnapshotHazards === null`.
`npm run build` passes (includes `tsc --noEmit`): 896.82 kB JS / 247.80 kB gzip, 51.04 kB CSS / 11.39 kB
gzip, with the existing chunk-size warning. `npm run bench` clean: 8P max projectiles 0.068 ms avg / 0.150 ms
p99; gauntlet max 0.147 ms avg / 0.453 ms p99, 28.4 threats. `git diff --check` clean.

**Limitations:** no headed playtest was run. There is no damage source on the mail swap; dynamic cover only
blocks and pushes. Bots do not path around moving cards or new preview blocks, and no campaign node is
attached yet. The spreadsheet and chat variants are not implemented.

**Next:** play the moving inbox and preview swap at full size, then decide whether the laptop becomes a
campaign screen before adding the spreadsheet-corridor or rising-chat variants.

## 2026-11-02 — SPREADSHEET and CHAT laptop variants (v0.1.124)

**Goal:** build the two screen riffs the BUSINESS LAPTOP notes recorded, on the same arena record rather
than a second laptop simulation.

- Extended `ArenaLaptopDef` with `variant` (`mail` | `sheet` | `chat`), `bubbleW` and an optional `sheet`
  grid. BUSINESS LAPTOP keeps the mail path with no data change.
- SPREADSHEET (id 30): a 6×4 sheet with 17 authored cells and 70-unit corridors. Cells are breakable solid
  cover: a direct ranged shot spends one of two hits, a cracked cell shows the damage, and a cleared cell
  opens its lane until the round ends. Added `laptopCellRect`, `laptopCellRects`/`laptopCellHp`, a
  selection cursor clock and a cell inspector. Bombs and the heavy beam stop on a cell without chipping it.
- CHAT (id 31): four bubbles rise on the shared card clock and alternate the left and right half of the
  pane, so the open lane zig-zags. Bubbles are solid only while fully inside the pane, so a clipped card
  mid-wrap cannot block a spawn row.
- Card and cell cover still feed player, threat, shot, bomb and laser collision and the bot repulsor. Both
  variants stay local-only through `isOnlineArena` and never enter `SnapshotHazards`.
- Fixed the cover rule the variants exposed: a card clipped above the pane used to stay solid and block a
  spawn row.
- Updated README, GAME_GUIDE, AGENTS D57, TODO and the version stamps to v0.1.124.

**Verification:** `.tmp/laptop-variants-check.ts` passes 32-arena order, ids 30/31, 17 cells inside the
screen with a passable corridor, clear spawns, two-hit cell destruction with a cleared lane, cursor advance,
round restore of cell health and cover, four alternating chat bubbles with an open lane at every sampled
spawn across a full scroll, upward bubble travel and `SnapshotHazards === null` on both. `npm run build`
passes (includes `tsc --noEmit`): 909.31 kB JS / 250.80 kB gzip. `npm run bench` clean: 8P max projectiles
0.072 ms avg / 0.225 ms p99; gauntlet max 0.170 ms avg / 0.547 ms p99, 28.4 threats.

**Limitations:** no headed playtest was run. Cell damage is projectile-only, bots do not path around a
cleared lane, and neither variant is attached to a campaign node. Chat bubbles carry no hazard.

**Next:** play both screens at full size; decide whether the sheet earns a formula-error or firewall-style
sweep, and whether chat gains a pinned-message hazard.

## 2026-11-02 — Campaign spine: island hopping (documentation only)

**Goal:** record the designer's campaign direction so the route docs hold it instead of a future session's
memory.

- `CAMPAIGN.md` gains **Campaign spine: island hopping**: one network at a time — land, clear every
  infection found on that island, earn the uplink, cross. The infection is the enemy's footprint, and the
  campaign's objective is to find and delete the rogue AI agent behind the spread on the last island.
- Reconciled with the existing five-sector route (`LOCALHOST` → `OFFICE LAN` → `CINEVAULT` → `BOTNET` →
  `SINGULARITY`, ending at `ROOT` inside `THE SUCCESSOR`): the sectors become the islands and each island's
  clear condition becomes its infection count instead of a bare kill count.
- Reframed the antagonist row: one rogue AI agent, not a family of threats; how it presents on screen (one
  User or a group of Users) stays open.
- Recorded the questions the note leaves: whether an island can be left with infections alive, when the
  agent shows itself across the hops, and how a cleared island reads on the route plate.
- `AGENTS.md` D13 carries the spine as a decision and points at `CAMPAIGN.md`; `TODO.md` gains the forward
  items for the tally, the exit gate and the final encounter.

**Verification:** documentation only. No runtime, tuning, arena or protocol change, so no probe, build or
bench run was needed and the version stamps stay at v0.1.124.

**Limitations:** nothing is implemented. The campaign still reports `MORE LEVELS COMING SOON` after BUILD
ROOT, and no run state carries an infection tally yet.

**Next:** add the per-island infection tally to the campaign run state, then gate the sector exit on it so
clearing an island is what opens the next crossing.

## 2026-11-02 — Portals as threat ingress (documentation only)

**Goal:** replace "enemies appear anywhere" with a source the player can attack, and record it before any
code depends on the current spawn paths.

- Researched the existing spawn paths first: no portal or spawn-gate code exists (`portal`/`SpawnGate`
  match nothing). `World.spawnSentryPack` drops a pack in a ring around the player, `spawnVirusCluster`
  seeds a cluster at a far arena spawn point, and `setupInfection` spreads the opening flood around the
  player spawns. The campaign assault clears on `CAMPAIGN.killsToClear` (`tuning/campaign.json`, 10) with
  one pip per delete drawn in `render.ts`.
- `CAMPAIGN.md` gains **Ingress: portals, not random spawns**: red damageable ports with a square-particle
  leak emit the threats, a clear is destroy-what-is-in-play **and** close-every-port, and the party uses
  white ports at the entry and exit of each level. script_kitty becomes mission control for the hop.
- Reconciled with the island spine: each island's ports are the infection's ingress, so closing them is
  what "clear the infections" actually means, and the objective strip counts ports plus live threats
  instead of a wave number.
- `CAMPAIGN.md` topology grammar gains a **Port** element, and the map-sketch checklist now requires every
  enemy port's footprint, emitted families and closing damage plus the white party ports.
- `AGENTS.md` records **D58**: authored per arena, no second spawn clock, port health must read as damaged
  before it closes, bots must target ports, and ports stay out of `Snapshot`/`SnapshotHazards`. `TODO.md`
  gains the implementation checklist and a probe that proves emission only happens through ports.

**Verification:** documentation only. No code, tuning, arena or protocol change, so no probe, build or bench
run was needed; version stamps stay at v0.1.124.

**Limitations:** nothing is implemented. Campaign and infection still spawn through the three existing
paths, the campaign still clears on a kill count, and no white entry/exit ports exist.

**Next:** author `ports` on `ArenaDef` and route `spawnSentryPack`, `spawnVirusCluster` and the infection
flood through them, then make the clear gate require both the ports and the live threats.

## 2026-11-02 — QUARANTINE as four real plates, retractable bridges, live ports (v0.1.125)

**Goal:** BUILD ROOT read as one big rectangle with room outlines painted on it, the islands were
small, and the assault started nearly empty. Rebuild the level as separate plates with earned
crossings, then ship the ports from D58 as the thing that actually feeds the floor.

- **Four plates, no shared floor.** `ArenaDef.islands` is the floor now: when a plate is present the
  plates are the only footing and the gap is a real drop (`inVoid` is true off a plate unless an
  extended deck is under the body). Intake, holding, mainboard and router became four rectangular
  plates, roughly twice the area each; the cell block takes 46% of its plate now
  (`holdingCellLayout`), so a body fits inside a cell.
- **Bridges are earned.** `ArenaBridgeDef.closed` starts a deck retracted: it is a body barrier and a
  dash blocker in the solver until `World.openBridge` extends it. A is open, B extends when the cell
  block is cleared (`beginDrill`), C when both mainboard ports close. Every gap is wider than a dash,
  so a shut deck cannot be skipped.
- **Ports are real.** `ArenaDef.ingress` authors position, size, health, emitted family, cadence and the
  bridge it releases. Ports join the prop pool as fixed records, so the existing shot, lash and blast
  paths close them with no second damage system; they emit on a staggered clock, respect the live
  caps, and collapse over 0.9 s. Two mainboard ports release bridge C; the router port is last, and
  closing all three opens the white party port on the uplink and hands the story box to script_kitty
  (`KITTY_UPLINK_TUTORIAL`).
- **The level opens populated.** `seedAssaultFloor` posts a squad on every plate beyond intake, capped
  by the same sentry and virus limits a pack drop respects, and the ports keep adding to it.
- **Office dressing.** Intake gets a booking counter with three terminals and chain runs down both
  sides and along the front lip, alongside the four desk blocks that give cover.
- `render.ts`: plate shadow and a heavier rim over the void, deck orientation for vertical and
  horizontal spans, retracted stubs labelled `LINK x // SHUT`, and `drawPorts` for the red source and
  the white exit.

**Verification:** `.tmp/islands-ports-check.ts` passes — four non-overlapping plates, every spawn and
cover block on a plate, the gaps read as void, only bridge A started open, both shut decks are in the
solver, three ports exist, one board port does not release the bridge, both do, all three open the
exit, the exit is damage-proof, kitty takes the story box, the assault opens populated inside the caps,
an open port emits, a closed one does not, and standing in the party port clears the node.
`npm run build` passes (918.55 kB / 253.53 kB gzip). `npm run bench` is clean: 8P max-projectile
0.068 ms avg / 0.156 ms p99, gauntlet max 0.144 ms avg.

**Limitations:** INFECTION's opening flood and `spawnVirusCluster` still seed directly, so a portless
arena behaves as before. Bots do not target ports yet, the white *entry* port is not drawn, sub-agent
mini-bosses are not built, and falling off a plate is a death rather than a reset.

**Next:** route the infection flood through authored ports, teach `BotBrain` to shoot a port when the
floor is clear, then add the sub-agent schedule.

## 2026-11-02 — Every damaging action closes a port; ports tuned to bite (v0.1.126)

**Goal:** ports answered only to shots, the lash and blasts, because they ride the prop damage path, and
they were soft enough to ignore. Any action that deals damage should close one, and a port left alone
should be a real problem rather than a decoration.

- **Kit coverage.** Port damage now resolves from the heavy beam line (Probe's beam and the overcharge
  beam), the toxic cloud sink (spray and jet share it), Wedge's bracket and plow, Sweep's broom stroke and
  split brooms, and the charged dash, on top of the existing shot, lash and blast paths. A per-port 0.3 s
  contact cooldown (`Prop.portalHitCd`) gates the sustained attacks so a per-frame resolve cannot delete a
  port in two ticks, while discrete hits stay naturally rate-limited.
- **Fixed a lash bug found on the way:** the melee path launched every prop it hit, which would have shoved
  a mounted port around the plate; a fixed prop is now only chipped.
- **Tuning.** BUILD ROOT's ports went from 12 hits on a 5.5–6.5 s cadence to 20–26 hits on a 2.6–3 s
  cadence, tuned together so closing one is a real engage while leaving it open keeps refilling the plate.
  Health and cadence are authored per port, not global constants.
- `TODO.md` records the one gap left: Aim Bot's rail round and Atomize's orbit projectiles resolve through
  their own hit paths rather than `propHit`, so they still need confirming against a port.

**Verification:** `.tmp/islands-ports-check.ts` passes with new cases proving the beam, the toxic cloud, the
bracket, the charged dash and the broom stroke each take health off a port, and that the contact cooldown
blocks a second sustained hit inside the window. `npm run build` passes (920.88 kB / 254.09 kB gzip).
`npm run bench` is clean: 8P max-projectile 0.076 ms avg / 0.216 ms p99, gauntlet max 0.210 ms avg.

**Limitations:** Aim Bot's rail and Atomize's orbit are unconfirmed against a port. A port is still closed
by health alone; there is no partial-disable or re-open state.

**Next:** confirm or wire the rail and orbit paths, then give the sub-agents their schedule.

## 2026-11-02 — Replicators: the second ingress (v0.1.127)

**Goal:** a port only makes sense where an open network connection does. A satellite has an intermittent
link, so the infection needs a different way to fill that device.

- `ArenaDef.replicator` authors a machine that prints copies of one threat family. It shares the port
  clock, damage path and close beat (`portal` plus `replicator` on the prop), prints only its own family,
  releases no bridge and never counts toward `portsClosed`/`portTotal`, so a copier cannot satisfy a
  level's port objective. `AGENTS.md` records it as **D60**.
- `spawnArenaReplicators` runs for local sandbox runs (a campaign node authors ports instead) and rebuilds
  the fixtures on a restart. First fixture: SATELLITE's hull copier, 24 health printing pulse units every
  4 s.
- `render.ts` draws it as amber hardware — chassis, a print bar sweeping top to bottom, a slot, and copies
  sliding onto the tray — so it does not read as the red open port.
- Found and fixed a real emitter bug while testing: `emitPortThreat` used one jittered point and gave up
  when `sentryClear` rejected it, so a source near the player silently stopped printing. It now scans three
  rings of six points before giving up. The satellite copier also sat 156 units from the starting spawn,
  inside the 240-unit clearance, which is how the bug surfaced.

**Verification:** `.tmp/islands-ports-check.ts` passes with replicator cases (it spawns, does not count as a
campaign port, prints its family, closes, stops printing) plus every earlier plate, bridge, port and
kit-coverage case. `npm run build` passes. `npm run bench` is clean: gauntlet max 0.142 ms avg / 0.510 ms
p99.

**Limitations:** the replicator clones a plain family member; there is no armoured or faster variant yet,
and it is authored only on SATELLITE.

**Next:** author replicators on the remaining offline or hardwired campaign devices, then give the
sub-agents their schedule.

## 2026-11-02 — CAPCOM: a 1968 mission-control plate arena (v0.1.128)

**Goal:** a new arena on the space theme, built from the plate grammar rather than another single floor.

- Arena 32 `CAPCOM`: four plates in a 2×2 ring, one department each — CAPCOM (flight control), FIDO
  (flight dynamics), GUIDO (guidance) and EECOM (electrical/environmental). All four bridge decks start
  open, and the gaps are wider than a dash, so the ring is the only route between departments.
- New room theme `console`: a bank of five CRT stations per plate with drifting phosphor traces, knobs and
  a paper strip, a plotting board with a grid and a live trajectory marker, and a running `T+mm:ss` mission
  clock. The department name comes from the room label, so another department is a data entry rather than
  another draw function.
- Console banks are the cover pillars (four per plate), with two spawn stations per plate and eight loose
  teletype and tape props across the floor.
- The picker now draws `arena.bridges` for island arenas, so CAPCOM's ring is visible before a load.
  `isOnlineArena` already excludes `rooms`, so the arena is local-only like QUARANTINE.
- `ARENAS` is 33 entries now; `.tmp/laptop-variants-check.ts` was updated to assert that count.

**Verification:** `.tmp/capcom-check.ts` passes (four non-overlapping plates, one console room per plate,
four open decks, a gap wider than a dash, plate centres walkable, decks walkable, the gap void, spawns and
cover on plates, no ingress on a fighting map). `.tmp/islands-ports-check.ts` and
`.tmp/laptop-variants-check.ts` still pass. `npm run build` passes. `npm run bench` is clean: gauntlet max
0.190 ms avg / 0.577 ms p99.

**Limitations:** every department uses the same console-bank layout, the mission clock is presentation
rather than an objective, and no campaign node uses the floor yet.

**Next:** give each department its own console layout, then pick a node that uses the floor.

## 2026-11-02 — AIR TRAFFIC: a radar scope where the traffic is the hazard (v0.1.129)

**Goal:** an airport-themed arena built around a radar screen, where the aircraft are a real threat rather
than decoration.

- Arena 33 `AIR TRAFFIC`: one circular radar floor (`radar.cx/cy/radius`, 455 units), a slow 11-second
  sweep with a stepped trail, range rings, a bearing graticule and a sector caption. Six console desks sit
  on the scope as cover, eight controller stations ring it, and stepping off the disc is a drop.
- Aircraft are simulated hazards. `World.tickRadar` advances one clock and derives each straight-line pass
  from its authored bearing, heading, entry distance, speed and period; the renderer reads the same clock,
  so a drawn aircraft is exactly where the damage is. Passes damage players and, in gauntlet, worms,
  viruses, sentries, cascading errors and the training drone.
- Each aircraft hits a body once per pass (`radarHit*` bitmasks cleared when a pass wraps), so a slow pass
  cannot shred someone across several frames. Dashes, phasing, cloak and i-frames still void the hit.
- The sweep never damages. It is a read: the aircraft are the threat, and a second sweeping hazard would
  make the floor unreadable.
- Each plane is drawn as a heading-aligned silhouette with a blip ring, a trailing track and a data tag
  (`AAL 112`, `INBOUND`/`OUTBOUND`). `SRC.RADAR` tags the hits. `isOnlineArena` excludes `radar`, so the
  arena is local-only and aircraft never enter `Snapshot`.
- Two probe-found fixes along the way: the first console layout sat outside the 455-unit disc (the probe
  rejects cover hanging over the void), and the first plane headings were authored as `bearing - PI`, which
  sent several aircraft past the rim without crossing the scope.

**Verification:** `.tmp/radar-check.ts` passes (the floor ends at the rim, every pass crosses the disc, all
spawns and cover corners are on the scope, one pass takes exactly one segment, a second pass in the same
crossing takes none, the sweep clock advances). `.tmp/capcom-check.ts`, `.tmp/islands-ports-check.ts` and
`.tmp/laptop-variants-check.ts` still pass. `npm run build` passes. `npm run bench` is clean: gauntlet max
0.170 ms avg / 0.560 ms p99.

**Limitations:** the sweep does not reveal traffic (blips are always visible), aircraft are not deflectable,
and no campaign node uses the floor yet.

**Next:** a conflict alert when two aircraft cross close together, then a campaign node that treats the
sweep as a patrol clock.

## 2026-11-02 — AIRPORT: the board becomes the floor (v0.1.130)

**Goal:** the split-flap level was a terminal with a board on it. The request was the opposite: drop the
apron, triple the board, and make every line of text a flap element that can hurt you.

- The board now covers the arena (`flip.board` 1680×920 inside the bounds). The terminal floor, the gate
  windows, the runway lights and the four bench blocks are gone, and `pillars` is empty: the rows are the
  terrain. Eight spawn stations moved onto the board itself.
- Rows went from six to eighteen, split into two banks of nine (`banks: 2`), arrivals left and departures
  right, with 88-pixel rows so the cells stay legible without stretching a destination across the floor.
  Flight data is generated from balanced destination/gate/time decks in `airportFlights()`.
- Every text field is now a flap element. Time keeps its own cycling deck; destination, gate and status
  each cycle through a deck (`flip.destinations` / `gates` / `statuses`) offset by row, and each cell draws
  its own squeeze a beat behind the time tile, so the row reads as one machine working rather than a
  single flashing tile.
- A landed row damages its whole bank band (`flipRowRectAt`), not just the time cell, which is the point of
  making all the text flappable. One landing per row per period; the wave staggers across both banks.
- `drawFlapCell` carries the flap drawing, including the hinge line and the sweep, so every field shares one
  visual language. AIRPORT stays local-only (`isOnlineArena` excludes `flip`).

**Verification:** `.tmp/flipboard-check.ts` passes (the board covers over 85% of the bounds, 18 rows in two
banks, no static destination on any row, every row band on the board, and a body standing on the
destination/status cells — away from the time tile — takes exactly one segment when that row lands and not
a second). `.tmp/radar-check.ts`, `.tmp/capcom-check.ts`, `.tmp/islands-ports-check.ts` and
`.tmp/laptop-variants-check.ts` still pass. `npm run build` passes. `npm run bench` is clean: gauntlet max
0.145 ms avg / 0.481 ms p99.

**Limitations:** destinations do not respect their flight time, and the two banks share one wave clock
rather than having independent rhythms.

**Next:** a gate-change callout every few cycles, then per-bank rhythms so the floor always has a safe half.

## 2026-11-02 — WEAPON SYSTEMS: a fighter that reads as a fighter (v0.1.131)

**Goal:** the jet on the weapon console did not look like an aircraft. It was a nine-point blob with no
canopy, fin or intake, and the reticle was aimed at the middle of it rather than the nose.

- `FIGHTER_SIDE` is a new shared side profile in `arenas.ts`, traced from real fighter geometry: pointed
  nose, bubble canopy, swept wing, tail plane, swept vertical fin, belly intake, wing missile and exhaust
  nozzle. Normalized x 0 (nose) to 1 (tail), y as a fraction of the box height from the centreline.
- `drawWeaponArena` fills and strokes those shapes with the console palette, then adds panel detail — a
  spine line, two frame lines, a roundel, exhaust streaks and a `SIDE PROFILE` caption.
- The arena picker traces the same shapes at thumbnail scale, so the selector and the console can no longer
  disagree about what the aircraft looks like.
- The reticle moved to the nose (0.1 of the box length) and the exhaust streaks run off the tail.
- I checked the alternatives before drawing: the AIR TRAFFIC aircraft mark is a top-down blip shape and the
  `✈` glyph is a three-quarter mark that reads as a sticker among instrument readouts, so a purpose-built
  side profile was the right projection for a status console.

**Verification:** `.tmp/jet-check.ts` passes (eight distinct parts, every part closed and inside the box,
nose at the front and tail at the back, canopy high and forward, fin tall and aft, wing swept back and
clear of the fuselage, nozzle at the tail, and both draw paths referencing `FIGHTER_SIDE` with the old blob
gone). `.tmp/flipboard-check.ts`, `.tmp/radar-check.ts` and `.tmp/laptop-variants-check.ts` still pass.
`npm run build` passes. `npm run bench` is clean: gauntlet max 0.128 ms avg / 0.431 ms p99.

**Limitations:** the outline is static — no animated control surfaces — and the tail marking is a generic
F-19 caption rather than per-program livery.

**Next:** animate the stabilisers and fin during the console's heavy readout, then give the aircraft
per-program tail markings.

## 2026-11-02 — Gauntlet ingress: bursts from the edges (v0.1.132)

**Goal:** stop gauntlet enemies appearing on top of the player. Arrivals should be readable: a portal opens
on an edge, dumps a group, and shuts.

- `World.queueAssault` now collects every pending arrival (sentry packs, worms, virus clusters) and
  `tickAssault` delivers them through transient edge portals — open, emit the batch, close. Nothing spawns
  in the middle of the floor any more.
- `assaultPoint()` samples all four edges at `GAUNTLET.assault.edgeInset`, rejects anything in cover, and
  requires `playerClear` (430) from the body, taking the farthest qualifying point. When no edge point
  qualifies the burst waits rather than falling back to a spawn near the player.
- Sentry packs had their own ring-around-the-player spawn plus a queue drain; both are gone. Packs, worms
  and viruses share the one queue, and the pack timer waits for a pending burst so a wave cannot fill the
  cap twice.
- `spawnSentry(..., burst)` uses tight scatter (±24) and a 110-unit player clearance, because the portal
  already holds the distance.
- The portal is drawn by `drawAssaultPortals`: dark mouth, red frame, inward chevrons and flashing corner
  brackets, sharing the visual language of campaign ingress. `AssaultPortal` is local-only and never enters
  `SnapshotHazards`.
- Tuning lives in `tuning/threats.json` under `GAUNTLET.assault`: 0.32 s open, 0.13 s between arrivals,
  0.55 s close, 1.1 s cooldown, two portals, nine per burst, 24-unit scatter.

**Verification:** `.tmp/assault-check.ts` passes (a queued burst opens a portal on an edge lane, never
inside `playerClear` of the player, delivers all four sentries within 150 units of the mouth and no closer
than 200 to the body, then closes; a sentry pack request only queues and spawns nothing directly; a worm
arrives through the same ingress). `.tmp/jet-check.ts`, `.tmp/flipboard-check.ts`, `.tmp/radar-check.ts` and
`.tmp/islands-ports-check.ts` still pass. `npm run build` passes. `npm run bench` is clean: gauntlet max
0.125 ms avg / 0.388 ms p99.

**Limitations:** cascading error blocks still seed from the existing spread path rather than a portal, and
a portal that opens off-screen has no camera cue yet.

**Next:** route the first error block through the queue, then add an edge cue for off-screen portals.

## 2026-11-02 — Mega Worm: the first boss (v0.1.133)

**Goal:** a boss that forces a decision instead of soaking damage. Every plate is a target, and breaking
one changes the shape of the fight.

- `Worm` carries the boss state (`mega`, `segHp`/`segMaxHp`, `hitR`/`segR`, whip and legs fields). The boss
  lives in the normal worm pool with `MEGA_WORM.slots` extra bodies, so bots, shells, melee, beams, blasts
  and arena hazards already target it. `hitR`/`segR` replace the hard-coded `WORM` radii in the worm
  collision sites, so one loop serves both sizes.
- `spawnMegaWorm` lays 13 trailing plates behind the head: 14 nodes, 12 hp head, 7 hp per plate, 46-unit
  head and 33-unit plates. In gauntlet it arrives through the edge ingress on wave 8 and every 14 waves
  after, queued as assault family 3, so the entrance is a portal on the rim.
- Damage is per node and follows the contact point: shells pass their own position, melee falls back to
  the attacker, and the nearest plate takes it. `breakMegaNode` owns the chain rules: a head loss
  promotes the plate behind it (new eyes flare), a tail loss shortens the chain, and an interior loss
  splits the chain. The detached back half becomes its own boss with the far tip as its head, provided it
  still holds two plates; anything shorter, or a split with no free pool slot, is shredded.
- Whip: a committed arc around a pivot four plates behind the head. The windup curls back, the active beat
  drags the chain through 3.55 rad, and a player in the path takes a hit and a tangential throw. Hits use
  the `whipHit` mask (one per player per swing); contact damage is its own slower clock.
- Last plate: legs, 3.1x speed, a fast latched lunge and paired acid on the existing hostile projectile
  type 3, so deflect, friendly fire and cover already apply.
- No health bar. Cracks climb out of a plate's seams as it loses health, a nearly dead plate shudders, and
  loose code debris drifts off the body in proportion to total damage.
- `?mega=1` is a QA-only boot hook that lands the boss beside the player for inspection.

**Verification:** `.tmp/megaworm-check.ts` passes: a mid-chain break yields two bosses (front 5 /
back 7 plates) with eyes open on the detached head, a head break promotes the next plate and
moves the body onto it, the whip crosses a player placed in the committed arc and deals 1 damage,
chewing the chain down to one plate sets `legs`, the legs phase moves at the 3.1x speed multiplier, throws a
pair of acid balls and the final plate credits the kill. `npm run build` passes; `.tmp/assault-check.ts`,
`.tmp/jet-check.ts`, `.tmp/flipboard-check.ts`, `.tmp/radar-check.ts`, `.tmp/islands-ports-check.ts` and
`.tmp/laptop-variants-check.ts` still pass. `npm run bench` is clean: gauntlet max 0.128 ms avg / 0.431 ms p99.

**Limitations:** acid reuses the hostile bolt art, so it reads orange rather than green, and an off-screen
split has no minimap marker yet.

**Next:** acid art, a minimap boss marker, then a second boss on the same plate language.

## 2026-11-02 — Mini-bosses are registry content (v0.1.134)

**Goal:** make the Mega Worm a spawnable enemy rather than a one-off. Later levels should mix and match
mini-bosses, and gauntlet should be able to schedule them into any wave.

- `src/game/minibosses.ts` is the registry: id, key, label, tuning block and body shape per mini-boss.
  `Worm.bossKind` carries the registry id (-1 for an ordinary worm), and a split half inherits it.
- `World.spawnMiniboss(kind, x, y)` is the single entry point. The QA hook and the gauntlet gate both use
  it; `spawnMegaWorm` is now the private body builder behind it.
- Assault family 3 carries the boss id in its existing `kind` field, so a mini-boss is delivered by the
  same edge portal as a sentry, worm or virus. There is no second arrival path for bosses.
- `GAUNTLET.bossSchedule` replaces the hard-coded wave/repeat constants: entries are `{ kind, wave,
  repeatStep }`, gated per entry with `bossGateWave` and skipped while that kind is already live. A harder
  level or a second boss is a data entry plus a registry row.
- Rendering still branches on the body shape (`w.mega`); a mini-boss with its own silhouette adds a
  `bossKind` branch beside it.

**Verification:** `.tmp/megaworm-check.ts` passes, including its new section: the registry lists the Mega
Worm, a boss queued as assault family 3 arrives through a portal no closer than the ingress clearance, and
the wave-8 schedule asks for a boss. Every prior plate, split, whip and legs check still passes.
`npm run build` is clean; the assault, jet, flipboard, radar, islands-ports and laptop-variants probes still
pass. `npm run bench`: gauntlet max 0.108 ms avg / 0.406 ms p99.

**Next:** a second registry entry to prove mixing, then a scripted level that spawns two kinds at once.

## 2026-11-02 — CAPCOM departments get their own layouts (v0.1.135)

**Goal:** the four mission-control plates shared one furniture set and one cover arrangement, so the
departments read as copies with different labels.

- `ArenaRoomDef.variant` (`flight`, `dynamics`, `guidance`, `systems`) selects the console-room set. The
  theme stays `console`, so the graphite-and-phosphor palette is unchanged; only the station's furniture
  changes. CAPCOM keeps the tiered CRT bank, trajectory board and clock. FIDO draws three paper recorders
  and a tilted plotting table with two crossing plots and a live pen head. GUIDO draws a turning gimbal
  cage over a fixed core, a star-fix board and an attitude readout. EECOM draws two buses with breakers and
  lamps plus a four-dial gauge cluster.
- Cover is per department in `pillars`: CAPCOM's two offset flight tiers, FIDO's three plotting tables,
  GUIDO's central pedestal with four corner navigation racks, EECOM's wall switchgear with two breaker
  cabinets. The first pass put FIDO's lower table and EECOM's lower cabinet inside their spawn clearance;
  the probe caught it and both were moved up.
- The ring, the four open decks and the dash-proof gaps are unchanged.

**Verification:** `.tmp/capcom-check.ts` passes with the new assertions: four distinct variants mapped to
their departments, four distinct cover signatures, every plate owns at least one bank, and every spawn
sits at least `PLAYER.radius + 6` clear of a bank. `npm run build` is clean; assault, jet, flipboard,
radar, islands-ports, laptop-variants and megaworm probes still pass. `npm run bench`: gauntlet max
0.116 ms avg / 0.386 ms p99.

**Next:** plate ring dressing (deck stripes and department signage) now that each station has its own
silhouette.

## 2026-11-02 — Idle Hands, the second mini-boss (v0.1.136)

**Goal:** a second mini-boss that fights differently from the Mega Worm: three floating hands that slam,
charge, and can be turned on each other.

- New registry body `idle-hands` (`MINIBOSS.IDLE_HANDS = 1`), scheduled at gauntlet wave 14 and every 28
  waves after. The trio arrives through the same family-3 ingress as every other threat.
- Hands are boss bodies in the `worms` pool with `segCount` 0 and a `hand` state object, so the existing
  projectile, beam, melee, blast and bot paths all reach them. Ordinary-worm caps now test `bossKind < 0`
  instead of `!mega`, or a boss trio would have eaten the wave's worm budget.
- Slam: ring latched at the start of the tell, 0.55 s windup, 0.18 s drop, 118 AOE, 1 damage, 1050
  knockback. The renderer squashes the palm vertically, flips it palm-out, then grows it back down with a
  white landing seam; the landing also emits `PROP_BREAK` for dust.
- Finger charge: point, shake 0.6 s, then 900 units/s for 0.55 s with 1520 knockback. Hands are airborne,
  so cover does not stop them; only the arena wall does.
- Redirect: a player dash into a hand in its charge dash flips it along the dash at 1100 units/s. Hitting a
  partner hand deals 14, and the reflected damage is credited to the player.
- Palette: red palm eye `#ff5a5a`, bone `#eadcd2`. Vector palm and eye rather than a symbol glyph, because
  the only literal hands available are emoji that ignore `fillStyle`.
- `?hands=1` QA hook added beside `?mega=1`.

**Verification:** `.tmp/idlehands-check.ts` passes: trio shape and count, slam damage inside the ring,
no damage outside it, the landing lands on its own telegraph, the dash redirect deals 14 to a partner,
three kills are credited, and the trio arrives via ingress with 726 units of player clearance. Build
clean; megaworm, assault, jet, flipboard, radar, islands-ports and laptop-variants probes still pass.
`npm run bench`: gauntlet max 0.113 ms avg / 0.374 ms p99.

**Next:** a short visual pass on the slam flip timing and the palm eye during the charge tell.

## 2026-11-02 — Memory fragments give PvE deaths a reward (v0.1.137)

**Goal:** implement the discussed rule where a downed player drops a shard that permanently strengthens
whoever picks it up, making PvP inside a PvE mode worth doing.

- `src/game/memory.ts` owns the rule: three stacks, +1 health segment, +20% walk speed and +25% damage
  each. `Player.memory` and `Player.memoryDropped` are the only state.
- The drop hangs off the shared death block in `damagePlayer`, so environment, enemy and player kills all
  leave a shard. It is skipped in `match` (straight PvP), in attract runs, and for thralls and clones.
- Health is a real segment, so the program hull draws it. Speed multiplies walking in `movement.ts` only.
  Damage scales at the top of every outgoing `damage*` entry point, leaving enemy hits and copies alone.
- One shard per body per run, so respawning bots cannot be farmed. Campaign carries stacks between nodes
  through `main.ts` (`campaignMemory`) and `World.setMemoryStacks`.
- The shard is a spinning diamond with a magnet radius and a two-second fade-out. No HUD counter: the
  extra hull segment and the pickup flash are the read.

**Verification:** `.tmp/memory-check.ts` passes: a downed bot leaves exactly one shard, collecting it
yields one stack and a four-segment pool, three stacks deal 1.75 damage while an enemy hit still deals 1,
the cap leaves the shard on the floor, a respawn does not drop a second shard, respawn and campaign carry
keep the enlarged pool, and a match drops nothing. Build clean; idlehands, megaworm, assault, jet,
flipboard, radar, islands-ports, laptop-variants and capcom probes still pass. `npm run bench`:
gauntlet max 0.119 ms avg / 0.403 ms p99.

**Next:** decide whether a saved campaign slot should persist stacks; today resuming a slot starts that
session empty.

## 2026-11-02 — Starfish, the third mini-boss (v0.1.138)

**Goal:** a boss whose arms are the fight: strip one, then chase it down before it grows a new boss.

- New registry body `starfish` (`MINIBOSS.STARFISH = 2`), scheduled at gauntlet wave 20 and every 40 waves.
  One center plus five arm bodies, all in the worm pool; arms carry `armState` so every weapon and bot can
  target a specific arm without a second hit path.
- The center is plated (`armorMult` 0.15) while any arm is attached. An attached arm at zero hp detaches
  with a fresh pool and a seven-second hatch ring; destroying it in time is the mechanic, and ignoring it
  spawns another full Starfish. `maxLive` 2 caps the hatchery.
- Detaching clears the center's arm mask, so it draws a stump. At least one missing arm opens the mouth:
  suck, then a chomp AOE, with the dash as the escape. All five gone speeds the spin and sprays an
  eight-spine ring every 1.5 s.
- Attached arms throw three-spine fans; spines are hostile type-3 shots that can be guarded or lashed back.
- Killing the center clears every surviving arm body. `?starfish=1` QA hook added.

**Verification:** `.tmp/starfish-check.ts` passes: five arms with a full mask, armored center taking 1.5
from a 10-damage hit, detach to four arms with the bit cleared, destroy credit, an unkilled arm hatching a
second center with five arms, the cap holding at two, the suck pulling 139 units before a 2-damage chomp,
eight spines in the armless phase, and a center kill clearing the floor. Build clean; memory, idlehands,
megaworm, assault, jet, flipboard, radar, islands-ports, laptop-variants and capcom probes still pass.
`npm run bench`: gauntlet max 0.118 ms avg / 0.399 ms p99.

**Next:** a visual pass on the arm whip and the hatch ring, and decide whether arm kills should count
toward the campaign clear count (they do today, one per arm).

## 2026-11-02 — File Blob, the fourth mini-boss (v0.1.139)

**Goal:** a huge enemy made of file icons that visibly chips away, with a glob that glues the player.

- New registry body `blob` (`MINIBOSS.BLOB = 3`), gauntlet wave 24 then every 48. `hp` is the icon count
  (96), so one damage removes exactly one file and the silhouette shrinks with health.
- Icons are pure render: 96 logical icons drawn in 3 reused depth layers (288 glyphs at full health),
  positioned from a sine hash of the index each frame. No icon entities, no allocation, no per-icon state.
  The rim is 10 radial springs; hits kick node velocities for the squash.
- Attack: slow drift, contact damage, and a lobbed glob whose landing point is latched at windup. Landing
  does 1 plus a glue cage.
- Glue roots movement and is not dashable: it cancels an in-flight dash and blocks the dash check. Three
  attack presses tear it off through `spawnProjectile` and `trySwing` (so every program's shoot and melee
  counts), and Ghost's cloak clears it instantly. Respawn clears it.
- `?blob=1` QA hook added.

**Verification:** `.tmp/blob-check.ts` passes: 96 icons with radius 92, a 1-damage hit removing exactly one
icon and queuing a shed burst of 5, shrink from 92 to 74 at half health and death at zero, a landing glob
dealing damage and applying the 3-hit cage, shooting and swinging each tearing a file off, the third press
freeing the body, and Ghost's cloak clearing glue. Build clean; starfish, memory, idlehands, megaworm,
assault, jet, flipboard, radar, islands-ports, laptop-variants and capcom probes still pass.
`npm run bench`: gauntlet max 0.123 ms avg / 0.455 ms p99.

**Next:** a visual check of the 288-glyph blob at full health on a low-end frame, and a decision on whether
the shed burst should scale with the weapon's damage (it caps at 10 icons today).

## 2026-11-02 — Shards wait forever, and save points remember them (v0.1.140)

**Goal:** correct the fragment lifetime. Shards should never fade; they persist until collected, until a
total wipe, or until a level clear saves them.

- Removed `MEMORY.lifetime`. A fragment now carries an `age` that only drives its idle pulse; nothing
  deactivates it on a timer.
- `updateFragments` clears every shard when the run is over and no body is standing, so a TPK empties the
  floor. A retry or reload restores only what the last save point held.
- `StorySave` gained optional `memory` (per-slot stack counts) and `shards` (positions normalized to the
  arena bounds). A campaign clear banks both; the next node restores them with `restoreFragments`, scaling
  the fractions into the new arena. Older saves without the fields load with zero stacks and no shards.
- Resume now reads those fields into `campaignMemory`/`campaignShards` instead of starting empty.

**Verification:** `.tmp/memory-check.ts` passes including four new cases: a shard left for five simulated
minutes still waits, a total wipe clears the floor, `saveShards` reports normalized positions, and a
restored shard lands in the next arena. Build clean; blob, starfish, idlehands, megaworm, assault, jet,
flipboard, radar, islands-ports, laptop-variants and capcom probes still pass. `npm run bench`: gauntlet
max avg 0.124 ms / p99 0.452 ms / max 1.489 ms.

The first commit used a blanket stage and picked up local screenshots, conversation attachments and probe
dumps. A follow-up commit untracked exactly those additions (they stay on disk) and added ignore rules for
them, so the tree carries only sources and the reusable probes.

**Next:** a visual pass on a floor with several shards, since they now accumulate instead of clearing
themselves.

## 2026-11-02 — Storm Cloud, the ceiling boss (v0.1.141)

**Goal:** add the fifth mini-boss, a big weather body that holds the top of the arena, rains under itself
and throws a reflectable bolt.

- New registry body `storm-cloud` (`MINIBOSS.STORM_CLOUD = 4`), scheduled at gauntlet wave 28 and every 56.
  One worm-pool body, radius 104, 104 health, `StormState` on the worm.
- **Movement.** Hovers in a ceiling band (`hoverTop` 138 ± `hoverBob` 24), tracks at 92 u/s and slides out
  from under a body inside `repelRadius`. It never drops to the floor, which is what stops a player standing
  on it; contact damage is a cooldown shove.
- **Rain.** Alternating rows of hostile projectile type 18, 2 rows × 4 drops per 1.9 s burst, each row
  offset by half a gap. Drops are shootable through the existing hostile-projectile interception and
  catchable by guard/lash, but the burst outlasts one guard so shielding the whole thing is not a plan.
- **Lightning.** Type 19 on a 5.6 s clock with a 0.95 s telegraphed jagged line that latches halfway
  through. It deals 1 to a player; a caught one carries `Projectile.lightning` through the type conversion
  and deals 18 back, about six returns for the kill.
- **Bots.** `avoidFurniture` now pushes sideways out of a storm's rain lane. Before that every tier died in
  ~14 s at the same rate, because each pilot walked under the cloud and stayed there.
- **Tuning pass.** Three passes by harness: 13 drops/s killed a HARD bot 9/9 in 11 s; thinning rows and
  softening the bolt only reached ~15 s; the missing piece was the bot lane steer. Final measured curve:
  digital 34.1 s average, 3/9 deaths, boss left at 31%; rookie 38.5 s, 6/9 deaths, 58% left.
- **Rendering.** 7×4 grey square grid with fixed per-square scale, rain fringe, flickering windup line and
  strike flash; vector teardrops and two-pass jagged bolts.

**Verification:** `.tmp/storm-check.ts` passes (shape, ceiling band, the barrage keeps laying drops through
a held guard — 15 landings in four seconds of the final tuning — shoot-down, bolt flag and 18-damage return,
kill credit). All existing probes still pass. Build
clean; bench `Gauntlet max avg 0.127ms p99 0.448ms max 1.564ms threats 27.3 (2W/10V/2F/14E + sentries + thrall)`.

**Next:** a human playtest on the lane readability and the bolt tell; the numbers are deliberately a first
pass, and the density knobs are `rain.cycle` and `rain.count`.

## 2026-11-02 — Bosses may overhang the stage (v0.1.142)

**Goal:** let a boss silhouette reach its intended size even when that means sitting through an arena
wall, while keeping it hittable.

- Added `World.bossEdgePad(w)` = `hitR * 0.5` and used it for every mini-boss clamp: blob rim, Starfish
  center and detached arms, Idle Hands hover and charge wall stop, Mega Worm movement and spawn, and the
  Storm Cloud lane. Spawn placement uses the same pad, so a boss lands partly against the wall instead of
  fully inside.
- Ordinary worms, players, pickups, hazards and projectiles keep full-radius clamping. The half-body that
  remains inside still takes hits and still puts its attacks into the arena; the overhanging part is
  decoration plus wall overlap, not a second hitbox.
- Probes: `.tmp/blob-check.ts` and `.tmp/storm-check.ts` now push each body against the left wall and
  assert it settles at about half its radius outside rather than fully inside.

**Verification:** build clean; blob and storm probes pass including the new overhang cases; the rest of
the probe suite passes; bench `Gauntlet max avg 0.144ms p99 0.477ms max 2.072ms threats 27.3 (2W/10V/2F/14E + sentries + thrall)`.

**Next:** the campaign can size a boss against the room rather than the other way around.

## 2026-11-02 — Mega Worm at 3x, curled arrival, TEST RANGE sandbox (v0.1.143)

**Goal:** read the Mega Worm's behaviour and scale without fighting arena geometry, and give it the
larger silhouette the boss wanted.

- Added `TEST RANGE` (`ARENAS` id 90, `qa: true`): 3480x1920, empty `pillars`, no fixtures, voids or
  hazards, eight perimeter spawns. `renderArenaPicker` skips `qa` arenas, and `?range=1` boots a gauntlet
  run there (`&bot=1` autopilot, `&mega=1` Mega Worm). The arena is data, not a second mode.
- Mega Worm scaled roughly 3x: head 46-to-138, plate 33-to-99, spacing 56-to-168, whip/bite/leg ranges
  scaled to match, health doubled (head 12-to-24, plate 7-to-14), turn slowed. It is now a room-sized boss.
- `spawnMegaWorm` lays the opening chain on an arc-length spiral around the head (`MEGA_WORM.curl`), so the
  body arrives coiled instead of trailing 2,000+ units in a straight line. This is the arrival pose only;
  `followMegaChain` unrolls it as the head moves.
- Probes: `.tmp/megaworm-check.ts` asserts the 3x radii and a compact spawn footprint; new
  `.tmp/range-check.ts` asserts the sandbox is empty, huge and has eight spawns.

**Verification:** `.tmp/megaworm-check.ts`, `.tmp/range-check.ts` and the rest of the probe suite pass;
`npm run build` clean; bench `Gauntlet max avg 0.131ms p99 0.373ms max 1.465ms threats 27.3 (2W/10V/2F/14E + sentries + thrall)`.

**Next:** watch the 3x boss in a normal arena; the shared threat pool may hand it a room it cannot fit, so a
dedicated boss room is the likely follow-up.

## 2026-11-02 — Boss showcases in the attract/demo rotation (v0.1.144)

**Goal:** the demo is also boss-fight content, so the kiosk loop and `?demo=1` should alternate ordinary
wave sessions with a mini-boss fight.

- `startAttract` now alternates sessions: even sessions seed `ATTRACT.wave` (72), odd sessions seed the new
  shallow `ATTRACT.bossWave` (3) and spawn one registry mini-boss across the room from the squad.
- The boss cycle runs Mega Worm -> Idle Hands -> Starfish -> File Blob -> Storm Cloud through
  `ATTRACT_BOSSES`, so a kiosk that runs for a while shows all five rather than repeating one.
- `qa` arenas are excluded from every attract arena pool (the new TEST RANGE must never appear on a
  showfloor), and boss sessions require at least 1500 units of width so the 3x Mega Worm fits.
- Both demo paths share this function: the idle attract timer and the permanent `?demo=1` boot.

**Verification:** `npm run build` clean; the existing boss/arena probes still pass; bench unchanged
(main-loop presentation only, no `World` step change).

## 2026-11-02 — Boss review boot hook (v0.1.145)

**Goal:** watch all five mini-bosses back to back for tuning notes without waiting through ordinary
attract sessions.

- `?boss=1` (or with `?demo=1`) forces the attract/kiosk loop into boss review: every session seeds
  `ATTRACT.bossWave` and spawns the next registry boss, so the cycle covers the whole set quickly.
- Ordinary attract and `?demo=1` still alternate fight/boss sessions; the hook only exists for QA and
  never enters the menus.

**Verification:** `npm run build` clean.

## 2026-11-02 — Boss camera and floating Mega Worm (v0.1.145)

**Goal:** boss demo review found the camera ignoring the boss and the scaled Mega Worm snagging
on interior cover.

- The camera's framing box now includes a live mini-boss head, so a boss outside the normal 640-unit
  focus band still pulls the view and sets the fit zoom. The Mega Worm chain is too long to fit at combat
  scale, so its head is the subject and the tail may trail off-screen. `CAMERA.bossZoomMin` (0.42) is the
  deeper floor.
- The Mega Worm floats above the floor: head, chain, bite and acid ignore cover, and plates are no longer
  clamped to arena bounds, so the 3x body no longer bunches against pillars or the lip. Ordinary worms
  remain cover-bound.
- A showcase session now ends shortly after its boss dies instead of continuing through wave cleanup.
- Fixed an unbound `blur` handler in the touch layer that threw on every session teardown.

**Verification:** `npm run build` clean, aimed at the live demo.

## 2026-11-02 — Boss entrance camera (v0.1.145)

**Goal:** boss arrivals should read at scale before combat framing takes over.

- The renderer now plays one entrance rig per assembled mini-boss, centered on the head-to-tail midpoint
  for the Mega Worm. It pulls back to `CAMERA.bossIntroZoom` (0.36), holds, and blends out.
- `CAMERA.bossZoomMin` is now the boss-present combat floor (0.55), separate from the entrance zoom and
  from the player-only `sharedZoomMin` (0.68).

**Verification:** `npm run build` clean.

## 2026-11-02 — Boss review on the test range (v0.1.145)

**Goal:** nail down each boss on the huge empty test arena before re-checking them on regular maps.

- `?boss=1` / `?demo=1&boss=1` now selects the `qa` TEST RANGE for every showcase session.
  Normal attract and `?demo=1` still exclude `qa` arenas and use the regular pool.
- The boss cycle, entrance camera and post-boss restart are unchanged.

**Verification:** `npm run build` clean.

## 2026-11-02 — ROCKET NAVIGATION becomes a shot reflector (v0.1.145)

**Goal:** make the rocket lane a source of escalating chaos instead of a wall.

- The flown arc is now a dotted shot-only reflector. `rocketBarrierRects` left `baseSolids` and
  `baseDashSolids`, so bodies, dashes, bots and waves cross it; projectiles bounce through a dedicated
  `bounceRocketPath` that keeps hostile fire alive instead of dispersing it on cover.
- The renderer draws both the planned route and the flown route as dotted lines; the thick solid band is gone.
- Mines, traps, bombs, the super ball and the Aim Bot rail keep their existing no-bounce rules.

**Verification:** `npm run build` clean; `.tmp/rocket-path-check.ts` covers body pass-through and
player/hostile reflection.

## 2026-11-02 — Mega Worm becomes a flying boss (v0.1.145)

**Goal:** the 3x Mega Worm cannot work as a ground chaser; it needs flyby attacks and no arena limits.

- Replaced the territory patrol plus whip/bite chase with three flight phases: wide orbit, a committed
  pass through the target, and a climb-out. A pass locks its direction, moves at `MEGA_WORM.flyby.speed`,
  and lands one aimed snap; body contact remains a separate touch clock.
- Removed the head's arena clamp. The head and every plate can now leave the floor, and
  `CAMERA.bossVoidMargin` lets the boss-aware camera look past the lip during a pass.
- The old whip/bite fields and methods remain for data compatibility but are no longer driven.
- Tuning lives in `MEGA_WORM.flyby`; ordinary worms keep their cover-bound behavior.

**Verification:** `npm run build` clean; `.tmp/megaworm-check.ts` covers pass phases, leaving the arena,
movement, the snap hit, splits, head promotion and the legs phase.

## 2026-11-02 — Idle Hands switches to Unicode hand and eye marks (v0.1.145)

**Goal:** replace the vector palm plate with the same symbol language the primitive threats use.

- The open palm is `✋`, the committed point is `☝`, and the palm eye is `👁`, all through the shared
  symbol font stack with text-presentation selectors. The square palm plate, four finger rectangles and
  drawn ellipse eye are gone. A dark under-pass and a thin accent stroke keep the glyph readable over the
  floor and its slam telegraph.
- The charge trail repeats the hand glyph instead of square afterimages; the slam squash/flip and
  deflected tumble still transform the glyph, and the hit flash is now a ring rather than a rectangle.
- Verification: `npm run build` clean; the `?hands=1` screenshot at boss scale shows the tinted
  monochrome hand and red Unicode eye; `.tmp/idlehands-check.ts` still passes.

## 2026-11-02 — Idle Hands scale pass (v0.1.145)

**Goal:** make the three palms read as mini-bosses at the same scale as the other giant bodies.

- Body radius 42 -> 126. Spawn ring widened 130/100 -> 390/300, orbit 250-400 -> 520-680, slam range
  380 -> 700, slam AOE 118 -> 350, rise 120 -> 360. Health and damage are unchanged.
- Eye font capped at 84 px: the 3x palm gets a roughly 2.2x eye, so it remains clearly an eye instead of a
  pupil that fills the hand. The palm glyph and charge trail follow `hitR` automatically.
- Verification: `.tmp/idlehands-check.ts` passes (trio 3, radius 126, slam 1/AOE 350, redirect 14,
  ingress 3/clear 559); `npm run build` clean; `?hands=1` visual at boss scale.

## 2026-11-02 — Idle Hands red palm and slower tells (v0.1.145)

**Goal:** fix the symbol color/layering and give the enlarged trio more readable attack timing.

- The palm is now filled entirely in the red accent over a dark-red silhouette pass; the bone palm fill
  is gone. The eye is drawn last over an opaque bone socket at full opacity, so the hand's counters cannot
  show through the eye glyph.
- Slam timing: 0.55/0.18/0.55 -> 0.72/0.26/0.70 seconds (windup/drop/recover). Finger charge: 0.6 -> 0.8 s
  windup, 900 -> 800 units/s, 0.55 -> 0.62 s dash, keeping roughly the same ~496-unit travel.
- Verification: `npm run build` clean; `.tmp/idlehands-check.ts` passes (trio, slam, redirect, ingress);
  `?hands=1` visual confirms the red palm and opaque eye.

## 2026-11-02 — Idle Hands slam AOE tightened (v0.1.145)

**Goal:** keep the slam footprint fair after the palm scale-up.

- Slam AOE radius 350 -> 240. The circle's area drops by roughly 53% while the ring still sits outside the
  126-radius palm. Range, damage, knockback and the telegraph timing are unchanged.
- Verification: `.tmp/idlehands-check.ts` still covers the in-ring hit and out-of-ring miss; `npm run build`
  validates the tuning JSON.

## 2026-11-02 — Idle Hands shadow and eye cleanup (v0.1.145)

**Goal:** make the hover shadow layered and keep the palm eye a static red mark.

- Replaced the single flat ellipse with three smaller concentric circles. The outer radius is 0.66r instead
  of 0.95r, and the layers use 0.16/0.26/0.36 alpha so the center is more opaque than the old shadow.
- Removed the eye's blink and width animation. The eye is now a static red `👁` glyph over an opaque black
  socket, so the glyph's transparent counters no longer show the palm through it.
- Verification: `npm run build` clean; `.tmp/idlehands-check.ts` passes (slam AOE 240); `?hands=1` visual
  confirms the red eye on black and the smaller layered shadow.

## 2026-11-02 — Idle Hands stops flashing (v0.1.145)

**Goal:** remove the bright pulsing/flashing on the hand during its animations.

- Root cause: `drawWorms` enables additive (`lighter`) blending for the whole worm pool, so the hand's
  under-pass, red fill, black eye socket and layered shadow added into one another and bloomed as parts
  overlapped. `drawIdleHand` now saves the context, forces `source-over`, and restores the pool mode on exit.
- Removed the white hit-flash ring from the hand; hit reactions still use the normal particle/debris feedback.
- Verification: `npm run build` clean; `.tmp/idlehands-check.ts` passes (slam AOE 240, redirect and ingress).

## 2026-11-02 — File Blob icon armor and scale (v0.1.145)

**Goal:** make the File Blob three times bigger and stop its file icons reading as tiny translucent dots.

- Body radius 92 -> 276 (rMin 34 -> 102). The icon count, health and attack timing are unchanged.
- File icons are now opaque, 33-51 px plates at full size, laid in three overlapping shells at 0.28/0.55/0.82
  of the current rim plus a deterministic core cluster. They rotate tangentially so they overlap like armor.
- Fixed the icon draw position: the shell icons now add the blob's world x/y. They were previously drawn at
  the local origin, which left the body nearly empty.
- `drawBlob` saves the context and forces `source-over`; the worm pool's additive blend was making the paper
  transparent. Folded edges use a dark ink outline to separate overlapping plates.
- Verification: `npm run build` clean; `.tmp/blob-check.ts` passes (radius 276, shrink, glue, Ghost phase,
  overhang); `?range=1` QA view shows the filled plate pile.

## 2026-11-02 — File Blob haystack packing (v0.1.145)

**Goal:** fill the File Blob's center with an opaque haystack and cut the render load after the 3x scale-up.

- Replaced the three shells plus core cluster (about 312 glyphs) with one center-out golden-angle packing of
  all 96 health icons. The first plates cover the middle, the last plates ride the rim, and jittered rotation
  and size keep it a pile rather than a wheel. Removed `BLOB.layers`; body plates are fully opaque.
- The single pass drops the blob's icon draw cost from roughly 3.1k to 1k canvas operations, removing the
  flashing/hitching seen with the dense three-shell version.
- Verification: `npm run build` clean; `.tmp/blob-check.ts` passes (radius 276, shrink, glue, Ghost phase,
  overhang); TEST RANGE visual shows a filled opaque plate pile.

## 2026-11-02 — Idle Hands hand-on-hand stun (v0.1.145)

**Goal:** make the hand redirect a real damage/stun window instead of resetting one hand and leaving the
partner active.

- A redirected hand hitting a partner still deals `charge.deflectDamage` 14 to the partner and 3 to itself.
  Both hands now enter stun state 7, receive opposite `charge.stunKnockback` 900 impulses, and spin for
  `charge.stunTime` 1 second before returning to hover. They cannot slam or charge during the lockout.
- The renderer spins state 7 from its own timer, so the two hands visibly tumble away from the impact.
- The stun duration/recoil are tuned under `IDLE_HANDS.charge`; the probe now checks both hands enter the
  state, move apart, and remain stunned through the early window.
- Verification: `npm run build` clean; `.tmp/idlehands-check.ts` passes with `stun: 1` and all previous
  checks.

## 2026-11-02 — Starfish proportions and detached-arm silhouette (v0.1.145)

**Goal:** make the Starfish read as a smaller core with bigger arms, and stop detached arms turning into
boat-shaped pods.

- Core radius 62 -> 44. Arm radius 24 -> 32, arm reach 108 -> 150. Health, armor and attack timings are
  unchanged.
- Detached arms now draw the same curved, tapering arm path, suckers and ragged base stump as attached
  arms, rotated by their crawl angle. The old leaf/boat quadratic outline is gone.
- Verification: `npm run build` clean; `.tmp/starfish-check.ts` passes shape, detach, hatch cap, mouth and
  angry-armless checks.

## 2026-11-02 — Smaller-arena bosses stage near players (v0.1.145)

**Goal:** stop Idle Hands, Starfish and File Blob from loading at distant ingress points offscreen.

- `spawnMiniboss` now anchors those three around the nearest live player instead of using the assault
  portal point. Idle Hands ring the player; Starfish centers 320 units toward the arena center; File Blob
  centers 360 units, with the anchor clamped by the boss footprint. Mega Worm and Storm Cloud keep their
  existing staging behavior.
- The Idle Hands ingress probe now asserts a near but non-overlapping arrival; Starfish and Blob probes
  remain clean.
- Verification: `npm run build` clean; `.tmp/idlehands-check.ts` passes with ingress clearance 300;
  `.tmp/starfish-check.ts` and `.tmp/blob-check.ts` pass.

## 2026-11-02 — Bigger Starfish silhouette (v0.1.145)

**Goal:** the Starfish still read too small after the first proportion pass.

- Core radius 44 -> 50 (still below the original 62), arm radius 32 -> 46 and arm reach 150 -> 290.
  Health, armor and attack timing are unchanged.
- The near-player anchor moves from 320 to 440 units for the Starfish so the longer arms do not stage on
  top of the player.
- Verification: `npm run build` clean; `.tmp/starfish-check.ts`, `.tmp/idlehands-check.ts` and
  `.tmp/blob-check.ts` all pass.

## 2026-11-02 — Mega Worm offscreen entrance and hex plates (v0.1.145)

**Goal:** give the Mega Worm a proper offscreen entrance and change its square plates to hexagons.

- `spawnMegaWorm` no longer clamps the head inside the arena. It starts beyond the longest half-axis and
  runs a timed `MEGA_WORM.entrance` arc around the arena center and inward before the normal flight loop.
  The entrance has no bite, whip, or acid; split halves skip it and begin in combat.
- Mega Worm plates, head socket, debris flakes, and leg tips now use `traceMegaHex`; cracks radiate across
  the hex faces instead of square seams.
- Verification: `npm run build` clean; `.tmp/megaworm-check.ts` passes, including the new offscreen-start
  assertion, entrance flight, split/head promotion and legs/acid checks; `git diff --check` clean.

## 2026-11-02 — Starfish solid render fix (v0.1.145)

**Goal:** stop the Starfish flashing and losing portions while it is being watched in the browser.

- Root cause: `drawWorms` enables additive (`lighter`) blending for the whole worm pool. Starfish was still
  inheriting it, so its dark mouth and overlapping arm fills washed out and flashed as the arms rotated.
- Both `drawStarfish` and `drawStarfishArm` now save the context and force `source-over`, restoring the pool
  blend mode on exit.
- Verification: `npm run build` clean; `.tmp/starfish-check.ts` passes; the browser frame now renders the
  center solid without additive wash-through.

## 2026-11-02 — Staged mini-boss entrances (v0.1.145)

**Goal:** freeze the room for a short boss reveal, center the camera on the boss and show its entrance
animation before combat resumes.

- Added `World.bossIntro` / `BossIntro` as local presentation state. `step` advances only the intro while
  the room is frozen; the camera tracks the live focus and a `SUB-AGENT // INBOUND` title card fades over
  the scene.
- File Blob grows from one glyph through 2–3 to the full 96-plate body. Idle Hands rise from the floor and
  bounce to size. Starfish drops from above with a landing ring. Mega Worm keeps its offscreen swim and now
  finishes with a roar before the normal flight loop.
- Splits, hatched Starfish and Storm Cloud do not replay the entrance.
- Added `.tmp/bossintro-check.ts` for the freeze, title and completion contract.
- Verification: `npm run build` clean; bossintro, starfish, blob, idlehands and megaworm probes pass;
  `git diff --check` clean.

## 2026-11-02 — File Blob fixed slots and high jump slam (v0.1.145)

**Goal:** stop every hit from repacking the whole file pile, and make the File Blob pressure the player
instead of drifting passively.

- Icon slots are fixed against the full `BLOB.icons` roster and `BLOB.rMax`; hp only controls how many
  slots draw. Removed files leave holes and the survivors never repack or rotate.
- Raised chase speed to 58 and shortened the glob rearm to 2.6 s.
- Added the close-range high jump slam: 0.45 s crouch, 0.68 s airborne arc, 280-unit lift, 190-unit
  landing AOE for 2 damage and 1400 knockback, then 0.55 s recovery and a 2.8 s cooldown. The landing
  point is latched at the start, and the slam does not apply the toss glue.
- `.tmp/blob-check.ts` now covers the windup/air/landing slam cycle and still covers toss glue, the
  three-press escape, Ghost phase, shrink and kill credit.
- Verification: `npm run build` clean; `blob-check` passes.

## 2026-11-02 — CHAT bubble spacing and endless stream (v0.1.145)

**Goal:** give bodies room to cross the CHAT lane and stop the whole thread from resetting as one block.

- CHAT now authors eight bubbles with a 96-unit gap (up from four and 26), enough for players and enemies
  to pass between rows.
- `laptopCardY` wraps CHAT bubbles individually below the pane; a bubble that leaves the top re-enters
  underneath while the others keep moving. MAIL keeps its original shared scroll.
- Added four more chat lines so the visible stream does not repeat immediately. Updated
  `.tmp/laptop-variants-check.ts` to cover gap clearance, one wrap per bubble per cycle, on-screen wrap
  rejection and stable visible spacing; `.tmp/laptop-arena-check.ts` now finds arena 29 by id.
- Verification: `npm run build` clean; laptop variants and mail probes pass; `git diff --check` clean.

## 2026-11-02 — CAR NAVIGATION route recedes (v0.1.145)

**Goal:** stop the car's travelled road from growing into a permanent wall across the whole arena.

- Added `ArenaCarDef.trailLength` (560 units, about seven seconds of driving). `World.refreshCarBarrier`
  now keeps only the blocks between `carProgress - trailLength/routeLength` and the car; older blocks are
  zeroed. The rendered route and the map preview use the same window.
- Added `carRouteLength` so the world and renderer share the authored arc length.
- Updated `.tmp/two-more-maps-check.ts` for the capped trail, its moving leading edge, reset behavior and
  snapshot isolation. It now looks up CAR NAVIGATION by id rather than a fixed arena index.
- Verification: `npm run build` clean; `two-more-maps-check` passes; `git diff --check` clean.

## 2026-11-02 — WEAPON SYSTEMS becomes a nose-up plan view (v0.1.145)

**Goal:** make the fighter read as the arena's subject and put each control bank beside the aircraft
system it names.

- Replaced the side profile with `FIGHTER_TOP`, a nose-up plan view: both wings, tail planes, shoulder
  intakes, forward canopy, centred tail fin and rear nozzle. The arena and picker still share one
  silhouette.
- Moved the static cover banks around the jet: `FIRE WEAPONS` beside the left wing root, `EJECTOR SEAT`
  beside the cockpit, `THRUSTERS` beside the tail. `FCS CORE` and `HYDRAULIC` sit below the tail.
- Reworked the console detail for the new axes: centre spine, wing-root seams, hardpoints, tail exhaust
  streaks and a `TOP PROFILE` caption; the reticle now sits over the nose.
- Updated spawns for the new cover layout and extended `.tmp/jet-check.ts` and
  `.tmp/two-new-maps-check.ts` for the plan-view silhouette, bank placement and spawn clearance.
- Verification: `npm run build` clean; jet and two-new-maps probes pass; `git diff --check` clean.

## 2026-11-02 — FAX MACHINE prints row by row (v0.1.145)

**Goal:** replace the full-height thermal bar with a semi-fast printer head that traverses each row and
steps down one line before reversing.

- `ArenaFaxDef` now owns a compact `headW` × `headH`, `rows` and `lineFeed` timing instead of a page-wide
  bar and edge pause. The carriage prints even rows left-to-right and odd rows right-to-left, alternating at
  every line feed; the page advances after all rows.
- Added `faxRowAt()` and `faxHeadY()` beside the existing clock helpers. `World` clears its hit masks at each
  row change and only the head rectangle is hot; `faxHits()` checks both axes.
- Reworked the renderer and picker to draw a small carriage with a hot edge and end-of-row rail marks, not a
  vertical beam. The status strip now reports the current line and row count.
- Updated `.tmp/fax-arena-check.ts` for the compact head, 16 row steps, line-feed phases, bounded x/y travel
  and a live `SRC.FAX` hit. Also refreshed the player-facing and architecture notes.
- Verification: `npm run build` clean; `fax-arena-check` passes; `git diff --check` clean.

## 2026-11-02 — Idle Hands entrance turn (v0.1.145)

**Goal:** make the Idle Hands emergence more interesting by showing the palm's front, back and front again as
it rises.

- The entrance now drives `cos(2πu)` into the glyph's x-scale for one projected yaw and a small
  `sin(2πu)` in-plane twist. At `u=0` the front faces the room, `u=0.5` is the back, and `u=1` returns to the
  front as the hand settles.
- The palm eye is suppressed on the back half only; normal states keep the fixed eye. The animation remains
  render-only and does not change spawn timing, collision, attacks or `Snapshot`.
- Verification: `npm run build` clean; `.tmp/idlehands-check.ts` and `.tmp/bossintro-check.ts` pass;
  `git diff --check` clean.

## 2026-11-02 — Idle Hands survives the post-entrance void cull (v0.1.145)

**Goal:** stop the palms from vanishing after their entrance on the USB HUB.

- `cullVoidThreats` now skips `MINIBOSS.IDLE_HANDS`. The trio floats over the hub's gaps, so the first
  normal simulation tick after the entrance was deleting all three with the 9,999 off-floor hit.
- The entrance animation, movement clamp and attack states are unchanged; the hands now stay active and
  continue into their normal slam and charge behavior.
- Extended `.tmp/idlehands-check.ts` with a USB HUB corner case that puts the trio over void before running
  the cull, so the regression is covered without relying on a live capture.
- Verification: `npm run build` clean; `idlehands-check` and `bossintro-check` pass; live USB HUB autopilot
  run kept all three hands active after the reveal; `git diff --check` clean.

## 2026-11-02 — Mini-boss entrances get a slower, heavier read (v0.1.145)

**Goal:** make the staged mini-boss arrivals feel like a threat entering the room instead of a quick spawn.

- Extended the staged entrance timings: File Blob `2.2` → `3.6 s`, Idle Hands `1.5` → `2.7 s`, Starfish
  `1.7` → `2.9 s`, and Mega Worm `6.2` → `6.8 s` with its roar hold `1.0` → `1.5 s`.
- Reworked the Starfish drop: it hangs 620 units overhead for the first 18% of the entrance, then falls with
  an accelerating curve instead of the old smoothstep that slowed into the landing. The landing ring follows
  the fall.
- The Blob, Hands and Mega Worm animations inherit the longer timings from their existing tuning clocks, so
  the camera freeze, title card and handoff stay synchronized.
- Storm Cloud has no staged entrance yet; it keeps its existing build and combat cue.
- Verification: `.tmp/bossintro-check.ts` reports MEGA WORM 8.8 s, IDLE HANDS 2.7 s, STARFISH 2.9 s and FILE
  BLOB 3.6 s; `idlehands-check` passes; `npm run build` clean; `git diff --check` clean.

## 2026-11-02 — Idle Hands hold a low hover band (v0.1.145)

**Goal:** stop one palm from riding above the camera and keep the trio visible and trackable.

- Replaced the full vertical hover orbit with a shallow, slightly low band (`orbitYBase` 0.09, `orbitYBob`
  0.4). The palms now travel from just above the player down toward the floor instead of circling overhead.
- Lowered the arrival ring to `spawnRingY` 240 / `spawnYOffset` 60 while keeping the horizontal ring and attack
  ranges unchanged; the existing ingress clearance and no-spawn-on-player checks still pass.
- Verification: `.tmp/idlehands-check.ts` reports `clear: 181`; live USB HUB autopilot showed all three hands
  on screen after the reveal (screen y 98, 515, 554); `bossintro-check`, `npm run build` and `git diff --check`
  clean.

## 2026-11-02 — Idle Hands stay in front or at the player's side (v0.1.145)

**Goal:** keep a palm from crossing over the player's sprite while preserving a readable hover formation.

- There is no transparency pass: hands are drawn before players. The problem was the target bearing, which
  allowed a rear hand to keep orbiting through the player's space.
- `updateIdleHand` now maps a hand behind the player to the nearest side, and maps a front hand into the
  lower half (`orbitYSide` 0.1, `orbitYFront` 0.45). The arrival ring uses the same front/side mapping with
  `spawnRingY` 240 / `spawnYOffset` 60.
- Added a probe check that runs the hover for 600 ticks and fails if any hand targets behind the player.
- Verification: `.tmp/idlehands-check.ts` reports `hover: { behind: 0, hands: 3 }` and ingress `clear: 378`;
  `bossintro-check` and `npm run build` pass; `git diff --check` clean.

## 2026-11-02 — Idle Hands keep a separation margin (v0.1.145)

**Goal:** stop the three floating palms from collapsing into one silhouette.

- Added `IDLE_HANDS.separation` 340 and `World.separateIdleHands()`, a six-pass pair solver for hovering
  hands (states 0 and 3). Slam, charge and redirect states stay exempt so the committed hand-on-hand
  collision still lands.
- Widened the spawn ring (`spawnRingY` 300) to guarantee the opening trio has the same margin; the ingress
  clearance probe now reports `395`.
- Added regression cases for an exact three-way stack and a 600-tick hover run; `idlehands-check` reports
  `separation min 340/target 340`, `behind 0` and `clear 395`.
- Verification: `idlehands-check`, `bossintro-check`, `npm run build`, `npm run bench` and `git diff --check`
  all pass.

## 2026-11-02 — Starfish at 1.5x, cover phasing stated (v0.1.145)

**Goal:** give the Starfish the boss silhouette it was missing and make its obstacle rule explicit rather
than incidental.

- Scaled the whole tuning block 1.5x instead of the draw code: core `radius` 50 → 75, `armRadius` 46 → 69,
  `armReach` 290 → 435, mouth `radius` 100 → 150, `angry.chompRadius` 130 → 195, `spineRadius` 6 → 9.
  Rendering, attached-arm placement, teeth, the hatchery ring and the `bossNearPlayer` staging pad all read
  from those values, so one block carries the size.
- No health change: `hp` 84, `armHp` 8 and `armDetachedHp` 10 stay put, per the health-budget rule.
- The center and arms already skipped `pushOutOfCover` because `updateWorm` dispatches the Starfish branch
  before the shared worm path. Recorded that as the rule in both updaters (and AGENTS D69) so a later cover
  fix cannot quietly start shoving the boss around, and added a probe that parks the center and a detached
  arm inside a pillar and fails if either is ejected.

**Verification:** `.tmp/starfish-check.ts` reports `scale { core 75, arm 69, reach 435, mouth 150 }` and
`phasing { pillar 128x208, center 3, arm 7 }`; `idlehands-check`, `bossintro-check`, `npm run build` and
`npm run bench` pass; `git diff --check` clean.

**Next:** watch the scaled arms sweep a cover-heavy arena and check the staging pad on the smallest maps.

## 2026-11-02 — CAR NAVIGATION becomes a country-to-city map (v0.1.145)

**Goal:** the map floor read as a generic grid. Split it into two legible districts so the drive has a
route with a story: farmland on the left, a real city grid on the right.

- West of the new `ArenaCarDef.cityX` (990) the floor is farmland: eleven hedged parcels in three muted
  tones, five tree-cover clusters, six farm buildings as the static cover (barn, farmhouse, silo with cap
  and chute, old mill with four sails) and thin secondary county lanes. A meandering river runs the length
  of the split, and the route crosses it on a drawn bridge deck.
- East of the split the floor is a city: a 180-unit street grid drawn as casing then fill, block paper
  between the streets, five city-block buildings with a roof hatch, a civic park with crossed paths, a
  500 m scale bar and a north arrow. The route's city legs are now square to that grid, so the GPS line
  visibly switches from a country lane to city streets.
- Route rebuilt: 3.2k units over `duration` 32 s (~100 units/s, the old pace) with `trailLength` 620. Stops
  are FARM MARKET, OLD MILL, TOLL GATE at the bridge and DOWNTOWN. `farmCount` and `labels` keep farm and
  city buildings in one pillar list, so collision, bot nav and placement still read one array.
- Every map detail is presentation; `pillars` remain the only static cover. Building clearances are
  enforced by the new probe, not by eye: the tightest pillar sits well outside the barrier half-thickness
  plus a player radius.

**Verification:** `.tmp/car-arena-check.ts` passes: `districts { cityX 990, cityLegs 7, farms 4 }`,
`clearance { worst 36, need 35 }`, every spawn clear of cover (76) and the route (57), the bridge under the
crossing, 160 sampled blocks with 20.1-unit spacing under the 26-unit thickness, and a live trail inside
the 620 cap at the halfway point and at route end. The probe caught one city block sitting 30 units from a
street, which moved to a 36-unit gap. `npm run build` clean; `npm run bench` clean; `git diff --check` clean.

**Next:** read the reworked map at couch distance and trim labels rather than shrinking type.

## 2026-11-02 — Storm Cloud body is opaque overlapping squares (v0.1.145)

**Goal:** the cloud read as a flat grid of faint squares. Give it a rough, stacked silhouette and stop the
viewer from counting the pile.

- The body is now 84 squares (three 7×4 layers over the same lattice) instead of one clipped 7×4 grid, each
  with hashed position jitter, size `0.23–0.40r`, and its own rotation up to about half a radian. Layers are
  offset so they overlap without landing on each other, and a hashed elliptical envelope leaves a ragged
  rim. The `puff` array grew from 28 to 84 so every square breathes on its own phase.
- Switched the body pass from `lighter` at 0.14 alpha to `source-over` with a fully opaque fill. Overlaps
  used to accumulate brightness, which exposed the stack; now a square simply covers the one under it. Three
  layer shades keep volume and a darker seam stroke keeps single squares legible without a glow.
- Rain fringe, windup line, strike flash and every damage path are unchanged: this is presentation only.

**Verification:** `.tmp/storm-check.ts` passes unchanged (shape, ceiling band, rain rows, shoot-down,
lightning reflect, death, overhang); `.tmp/car-arena-check.ts` still passes; `npm run build` clean;
`git diff --check` clean.

**Next:** read the cloud at couch distance to confirm the square mass still reads as a threat tell, not noise.

## 2026-11-02 — Mega Worm arrival cry and tail sweep (v0.1.145)

**Goal:** make the arrival a real beat (offscreen, circle, cry, then attacks) and give the flyover kit one
committed ground move.

- The entrance is now a full lap (`sweep` 6.28, still 6.8 s). It ends on a new `EV.MEGA_CRY`: `audio.megaCry`
  plays a MIDI-note bird phrase (a scream up and a falling answer over a low boom), `Fx` answers with a
  16-unit shake, a flash and two pressure rings, and a distant body also gets the `heavy` rumble cue. The
  first pass is held by `entrance.handoff` 1.1 s after the cry, so the call is the tell for the attack.
- Contact damage now uses the full `knockback` 1300 instead of 60%; the pass and the plates are the
  primary threat, as the flyover design intends.
- The dormant whip fields are live again as the **tail sweep**: it fires only while orbiting, with at least
  `whip.minLead` left before a pass, three or more plates, and a body inside `triggerRange` 460 of the tail
  tip. Slowed to `windup` 0.95 + `active` 0.95, `sweepArc` 2.2, `cooldown` 7.5; it deals one and throws
  along the arc. Nothing else about the flyby, split or legs phases changed.

**Verification:** `.tmp/megaworm-check.ts` reports `arrival { outside true, cry true, hold 1.10 }` and
`tail { hit true, cooldown > 3, arc 2.2 }` alongside the existing plate, split, flight and legs cases;
`.tmp/storm-check.ts` and `.tmp/bossintro-check.ts` pass; `npm run build` clean; `npm run bench` clean;
`git diff --check` clean.

**Next:** watch a full Mega Worm fight and judge whether the tail sweep earns its 7.5 s cooldown.

## 2026-11-02 — Starfish and File Blob interiors go opaque (v0.1.145)

**Goal:** both bosses were blending into the floor because their bodies were translucent dark washes.

- Starfish: arm fills moved from 0.32 alpha to a solid `#ff9ecb`, the center disc from `#3a1024` at 0.92 to
  `#8f2350` at full alpha, stumps to `#c24c85` / `#5c1636`, and the detached arm matches. Strokes step up
  to `cfg.color` at 2.2–3.5 px. The body no longer multiplies opacity by the position-interpolation
  `alpha`, so the silhouette does not pulse with the render clock either.
- File Blob: the hull is a solid `#1d4a60` fill with a 3 px `tint` rim instead of a 0.16 tint wash, and the
  palette brightened (`paper` `#f8fdff`, `ink` `#1a2833`, `tint` `#9ce6ff`). Icons already drew at full
  alpha; the backing was what let the floor read through the pile.
- Presentation only: no health, hit, tuning-block or collision values changed.

**Verification:** `.tmp/starfish-check.ts` and `.tmp/blob-check.ts` pass unchanged; `npm run build` clean;
`git diff --check` clean; build output and dev server cleaned up.

## 2026-11-02 — Storm Cloud leaves the arena bounds; cover shades the rain

**Goal:** the cloud should fly past the arena edge like the other flying boss, and rain must be stopped by
cover instead of falling through a block.

- `updateStormCloud` dropped its `bossEdgePad` x-clamp, so the body can overhang or leave the floor; only
  the ceiling band still holds it. `cullVoidThreats` now skips `MINIBOSS.STORM_CLOUD` so leaving the floor
  does not delete it.
- Cover needed no new damage path: rain (type 18) and lightning (type 19) are hostile shots, and
  `bounceCoverRect` already consumes a hostile `type >= 3` shot on a pillar. A block now shelters the body
  below it and blocks return fire at the cloud, which is the same rule, not a second one.
- `.tmp/storm-check.ts` replaces the old "may overhang" case with an outside-the-arena case plus a cover
  case: a rain row and a bolt over a block leak nothing, the body under it takes no damage, and a player
  shot stops on the roof.

**Verification:** `storm-check` and `megaworm-check` pass, `npm run build` clean, `npm run bench` clean,
`git diff --check` clean; build output removed and no dev server left.

## 2026-11-02 — Storm Cloud triples in size

**Goal:** the storm cloud was too small to read as a boss-scale weather body.

- `STORM_CLOUD.radius` 104 → 312. `hoverTop` 138 → -70 so the underside stays at `top + 242`; the rain
  (`y + r + 8`) and lightning (`y + r + 10`) origins therefore do not move, which keeps cover shelter, the
  lightning tell and the contact band where they were.
- The y clamp is now the `hoverTop ± hoverBob` band. The old `top + r * 0.3` floor would have pushed a
  312-radius body 90 units down into the arena.
- `rain.width` 250 → 520 and `rain.count` 4 → 5 so the lane still sits under the wider pile; drop radius
  6.5 → 8. Cycle, damage, ttl and the health pool are unchanged, so the size pass is not a difficulty pass.

**Verification:** `storm-check` passes with `shape radius 312` and the cover case still leaking zero drops
(`leaked 0`), `megaworm-check` passes, `npm run build` clean, `npm run bench` clean, `git diff --check`
clean; build output removed.

## 2026-11-02 — Idle Hands holds the slam palm down as a punish window

**Goal:** a slam landed and immediately released to hover, so the hand was never a stable target.

- `IDLE_HANDS.slam` gained `hold: 1` and `recover` dropped 0.70 → 0.35. State 3 is now hold-then-rise: the
  palm stays pressed flat and stationary for a full second, fully damageable, then plays the rise-out.
  Cooldown still starts when the hand releases to hover, so the total grounded time is 1.35 s.
- `drawIdleHand` keeps `scaleY = 1` for the hold instead of easing it up, and pulses a faint white ring at
  the palm as the "open to fire" cue. The landing seam now lasts the whole rise-out.
- `.tmp/idlehands-check.ts` measures the hold and confirms the body is still damageable while it is down.

**Verification:** `idlehands-check` reports `slamHold {seconds 1.35, damageable 3}` and passes; `storm-check`
and `megaworm-check` pass, `npm run build` clean, `npm run bench` clean, `git diff --check` clean; build
output removed.

## 2026-11-02 — BOSS RUSH ladder for solo and local co-op

**Goal:** a way to reach every mini-boss quickly for testing, balance passes and performance tuning, and a
playable mode rather than a QA-only hook.

- `World` takes a trailing `bossRush` flag. `updateGauntlet` hands its clock to `updateBossRush`, which walks
  `BOSS_RUSH_ORDER` (derived from the mini-boss registry), spawns through `spawnMiniboss` so the normal
  entrance beats and pools apply, and retires leftover parts of a defeated kind.
- `BOSS_RUSH.firstDelay`/`.gap` are the only new timings. Fodder is off: no wave ramp, no assault queue, no
  arena replicators.
- `setupGauntlet` seats every active local player for co-op, and a boss-rush death respawns on the gauntlet
  timer instead of ending the run; the scored gauntlet one-life branch is gated on `!bossRush`.
- Menus: `BOSS RUSH` toggle in the gauntlet setup (solo) and in the local multiplayer lobby (co-op). The
  result plate distinguishes `BOSS RUSH // CLEAR` from a broken ladder and skips gauntlet records. Online
  rooms are unchanged: mini-boss bodies are not in `Snapshot`.
- `?bossrush=1` boots the solo ladder. `.tmp/bossrush-check.ts` covers order, zero fodder, the gap, clear
  state, co-op seating/respawn and the scored-gauntlet death rule.

**Verification:** `bossrush-check` passes, `npm run build` clean, `npm run bench` clean, `git diff --check`
clean; build output removed and no dev server left.

## 2026-11-02 — Starfish girth pass

**Goal:** the Starfish read as a disc with thin ribbons; the design asked for a fatter body and arms.

- `STARFISH.radius` 75 → 96 and `armRadius` 69 → 92, so the core disc, mouth, teeth, teeth ring and arm
  collision all thicken together. `armReach` stays 435: the boss gets fatter, not longer.
- New `armWidth` 0.84 (was a hard-coded 0.72 draw factor) thickens the tapered arm silhouette for both the
  attached and detached arms without widening the collision circle past `armRadius`.
- `.tmp/starfish-check.ts` now logs the width alongside core, arm, reach and mouth so the silhouette values
  stay visible in its report.

**Verification:** `starfish-check` passes with the new scale, `npm run build` clean, `npm run bench` clean,
`git diff --check` clean; build output removed and no dev server left.

## 2026-11-02 — Idle Hands cut to a pair for solo play

**Goal:** three palms give a solo player three angles of slam and charge to cover, which read as too hard.

- `IDLE_HANDS.hands` 3 → 2. The spawn ring, separation, redirect and kill credit all read the count, so the
  pair spawns on opposite sides and the hand-on-hand redirect still works without a code branch.
- Slam, the 1 s palm hold, charge, health and cooldowns are untouched. The entrance still announces IDLE HANDS.
- The count is recorded as tuning, not structure: raising it back is a one-value change and a pair fight
  should be checked again for whether the redirect is still worth setting up.

**Verification:** `idlehands-check` passes with `trio:2` and unchanged slam, AOE, redirect, void cull,
separation 340, hover, ingress and the 1.35 s palm hold; `bossrush-check` passes with the pair in the ladder;
`npm run build` clean, `npm run bench` clean, `git diff --check` clean.

## 2026-11-02 — Storm Cloud assembles square by square

**Goal:** the Storm Cloud was the one boss with no entrance; it should show one square, then gather into the
full body.

- `STORM_CLOUD.introTime` is 2.6 s and `spawnMiniboss` no longer skips the storm for `beginBossIntro`, so the
  room freezes, the camera holds and the title card plays like the other four bosses. `beginBossIntro` sets
  the storm's `spawnT` to the intro duration, which is the clock the renderer reads.
- `drawStormCloud` no longer scales the whole pile up. Square 0 snaps in at its slot, then the rest fly from
  scattered points and overlap into the lattice, each with its own delay, start point and grow. Once the
  intro ends every square sits on its final slot, so the settled cloud is unchanged; the shadow and the
  underside fringe fade in with the assembly.
- Direct spawns (`?storm=1`, boss rush, attract) use the same `spawnT`, so they assemble too.

**Verification:** `bossintro-check` now includes STORM CLOUD (`seconds 2.6, ticks 156`) and passes for all
five bosses; `storm-check` and `bossrush-check` pass, `npm run build` clean, `npm run bench` clean,
`git diff --check` clean.

## 2026-11-02 — Idle Hands stop strobing

**Goal:** the palms visibly flashed in the browser at `?hands=1`.

- `drawIdleHand` multiplied the palm under-pass, accent pass and eye socket by the renderer's `alpha`
  argument. That argument is the fixed-step interpolation factor, not an opacity fade, so it swings between
  0 and 1 every frame and the whole hand strobed at the sim rate. The body fills and the eye socket are now
  opaque; `alpha` stays only on the charge trail, hand shadow, telegraph and landing rings.
- The blend-mode fix from the earlier pass was necessary but not sufficient: `source-over` stopped the
  layers blooming, while the per-frame alpha is what actually flashed.

**Verification:** `npm run build` clean, `idlehands-check` passes, `git diff --check` clean; the local dev
build was checked at `?hands=1` for a steady palm across frames, and the change was shipped to Pages.

## 2026-11-02 — Mega Worm: straight body, off-map passes

**Goal:** the follow/split chain made the boss hard to read, left split pieces that could stall a
boss-rush stage, and dragged a tail whip the body no longer needed. Rebuild movement around a straight
body that teleports outside the map and runs a locked lane through the last detected player position.

- `followMegaChain` is now rigid: every plate is placed one `MEGA_WORM.spacing` behind the head on its
  heading, with no follow lag or coil. The spawn spiral is gone; the body is laid straight behind the head.
- `updateMegaWorm` is a three-state loop: staged (offscreen, `flyby.warning` 1.6 s, dotted lane drawn),
  pass (`flyby.speed` 1020, heading locked, contact and one maw snap), run-out (`flyby.recoverTime` 1.1 s),
  then `stageMegaPass` teleports the whole body outside and latches the next lane. The lane is latched at
  staging, not at launch, so walking off the line during the warning is a real dodge.
- `breakMegaNode` no longer splits. A middle cut truncates the body and shreds the back half; head loss
  still promotes the next plate and a tail cut still shortens the chain. Exactly one Mega Worm exists.
- Removed the tail sweep (`whip`) and its tuning, the orbit/climb flyby fields and `splitMegaPiece`.
  `flyby` now holds `warning`, `speed`, `legsSpeedMult`, `offscreen`, `angleJitter`, `exitRange`,
  `recoverTime` and the snap values.
- The entrance arc and roar are unchanged; it now hands off directly into the first straight pass.
- `drawMegaWorm` draws the staged lane as a dotted line through the latched point, with a target ring that
  brightens as the pass arms.

**Verification:** `.tmp/megaworm-check.ts` passes (straight plates, latched lane, no split, head promotion,
pass cycle, snap, legs/acid, entrance handoff); `bossrush-check` passes; `npx tsc --noEmit` clean;
`npm run build` and `npm run bench` clean. Headed pass at `?mega=1` and `?bossrush=1` after deploy.

**Next:** a human boss-rush clear time per boss; revisit pass speed/range if the lane is too easy to dodge.

## 2026-11-02 — Mega Worm is one damage sponge

**Goal:** drop the remaining segmented behaviour: no head spider-bite, no plate breaks or promotion, no
legs/acid phase and no split pieces. One body, one pool, damage on contact.

- `damageMegaWorm` subtracts from `w.hp` wherever the hit lands. Removed nearest-plate routing,
  `breakMegaNode`, `megaTotalHp` and the per-plate `segHp` writes; `headHp + segments * hpPerSegment`
  still computes the same 206 total, so health is unchanged.
- The pass no longer lands a maw snap. `megaTouch` on any plate is the only attack; the `biteHit`,
  `snapRange`, `snapDamage`, `snapKnockback` and legs/acid fields are gone from the tuning.
- Removed the last-plate legs speed, acid spit and `spitAcid`; the body always runs the straight pass at
  `flyby.speed`.
- `drawMegaWorm` reads one `w.hp / w.maxHp` fraction for every plate and the head, and no longer draws a
  promotion flare or legs. Cracks and debris still read total damage.
- `megaworm-check` now asserts a single pool: a body hit and a head hit drain the same health, plates and
  head never move, contact on the lane hurts, and the boss dies at zero.

**Verification:** `megaworm-check` and `bossrush-check` pass, `npx tsc --noEmit` clean, `npm run build`
and `npm run bench` clean. Headed check at `?mega=1` / `?bossrush=1`.

**Next:** record a human boss-rush clear time; the boss is now a straightforward grind and only the pass
lane and its warning need balance attention.

## 2026-11-02 — Mega Worm flies continuous lanes; flying bosses ignore floor culls

**Goal:** the Mega Worm teleported between lanes, which read as self-collision, and the File Blob was
being killed by the floor cull when a slam crossed a hole.

- `updateMegaWorm` is now two states: a straight run at `flyby.speed` (heading fixed until it passes the
  latched point by `exitRange`), then a wide outside turn at `turnSpeed`/`turnRate` that re-aims once and
  brings the head back over the player. Removed `stageMegaPass`, the warning lane and the teleport.
- `followMegaChain` trails the head by one `spacing` with `followRate` again, so a turn bends the chain
  instead of swinging the whole body through itself -> no teleport, no self-intersection.
- `cullVoidThreats` skips `w.mega` and `MINIBOSS.BLOB`: both fly over holes and past the lip, and the
  floor cull was deleting them. Firewalls, emitters and other hazards still damage them through their own
  paths, so only the floor rule changed.
- Tuning `MEGA_WORM.flyby` is `speed` 1020, `turnSpeed` 620, `turnRate` 0.55, `exitRange` 700; the
  `warning`, `offscreen`, `angleJitter` and `recoverTime` keys are gone.

**Verification:** `megaworm-check` asserts straight runs, wide turns, no teleport step, contact damage and
the entrance handoff; `bossrush-check` and `blob-check` pass; `npx tsc --noEmit`, `npm run build` and
`npm run bench` clean.

**Next:** watch a full rush for turn lanes that loop too close to the camera edge; adjust `turnSpeed`
before `turnRate` to open the arc.

## 2026-11-02 — Boss sweep, and campaign level 2 ends on the Mega Worm (v0.1.152)

**Goal:** make every developed mini-boss work, survive the arenas and actually die, then ship campaign
levels 1 and 2 with the Mega Worm as level 2's final encounter, verified with bots.

- `.tmp/boss-matrix.ts` puts five mini-bosses through `CROSSROADS`, `GRID ZERO`, `SWITCHBACK` and
  `QUARANTINE`: 20/20 spawn outside the fight, hold together for 3 s, stay finite and near their arena,
  and die through their own damage path. This found the File Blob and Starfish disappearing over floor
  voids: `cullVoidThreats` now skips every `bossKind >= 0`, not only the Mega Worm and the Blob.
- **Bosses could not be hit properly.** Every worm collision test used `WORM.headRadius` (16) and
  `WORM.segmentRadius` (10) instead of the body's own `w.hitR` / `w.segR`, so on the 3x Mega Worm a bomb,
  lash, dash, orbit ball, radar or keypad only registered within 16 units of the head. Twenty-four sites
  now read the body's radii. `spawnWorm` also stopped resetting radii to themselves: a pooled slot that
  had carried a boss handed a 138-unit hit circle to the next ordinary worm.
- **Explosions never reached it.** `explodeBlast` only tested the head circle and required floor line of
  sight, so a blast on the chain did nothing and every off-map pass failed the LOS test. It now tests every
  plate and skips the LOS check for a mini-boss (they fly over cover anyway).
- **A virus could heal it to full.** `infectWorm` refills health because a converted worm becomes a thrall;
  one virus touching the boss reset 200 HP to 206 repeatedly and made the level unwinnable. The virus host
  scan and its contact test now skip `bossKind >= 0`.
- **The fight was a 186 s grind.** The old wide arc (1020/700/0.55/620) spent about 80% of each cycle off
  the floor: 18 passes, 19.5% uptime, and passes that only clipped the lip. `flyby` is now 940/380/1.0/760
  (still a 760-unit turn radius, well above `spacing`, so the chain cannot fold through itself): ~35%
  uptime, 8-10 readable crossings. Every one of the thirteen programs now kills it through its own kit in
  12-115 s solo, where Kaboom, Fisher, Bad Lag, Pinball and Aim Bot previously could not finish at all.
- **Level 2.** `CampaignLevel.boss` names the `MINIBOSS` id and `World` takes it as `campaignBoss`. On a
  boss node the four assault kills are the run-up; the level clears only after the staged intro and when
  no body of that kind is live, so a port or a fodder kill cannot end it. `REBOOT` on `GRID ZERO` is now
  `playable: true` with the kitty briefing and the Mega Worm, and the overlays and slot copy read
  `LEVEL 2 CLEAR` / `MORE LEVELS COMING SOON`.
- `.tmp/campaign2-check.ts` runs the node three times with three bot companions: 67 s, 80 s and 72 s, all
  `cleared`. `.tmp/mw-programs.ts` is the per-kit gate against the boss.

**Verification:** `megaworm-check`, `idlehands-check`, `starfish-check`, `blob-check`, `storm-check`,
`bossintro-check`, `bossrush-check` and `boss-matrix` (20/20) pass; `campaign2-check` 3/3; `npx tsc
--noEmit`, `npm run build` and `npm run bench` clean (8P stress 0.046 ms avg). Headed pass still owed.

**Next:** a human run of level 2 to judge the Mega Worm's contact pressure, and a recorded boss-rush clear
time per boss.

## 2026-11-03 — Campaign playthrough pass: the pre-assault death soft-lock (v0.1.153)

**Goal:** play the shipped campaign in a real browser, four times through, and fix what breaks.

- The first headed run died to a floor gap during the Warden lesson and never came back: the body sat at zero
  health with `respawnT` frozen at 1.6 s, the tutorial waited on a movement input that could never be delivered,
  and no result overlay appeared. `damagePlayer` sets a respawn timer for every non-assault campaign death, but
  only the `drill` branch of the player loop ever decremented it, so calibration, release, briefing and breach
  each turned a knockdown into a dead body that nothing could revive.
- `world.ts` now ticks that timer in every live campaign phase (`failed` and `cleared` excluded), which also
  carries a body downed during the breach into the assault instead of stranding it. The assault is still one
  life: a downed local player sets the phase to `failed` on the same frame, which stops the timer.
- `.tmp/campaign-death-check.ts` pins the rule: five phases x the player and a drill partner all respawn with
  health and keep their tutorial progress, an assault death still fails the run, and finishing the lesson still
  releases the calibration hold.
- Headed QA harness (local only, never shipped): `.tmp/campaign-pilot.js` reads `__deflect.getWorld()` and
  dispatches ordinary key events, routing over the arena floor with a BFS grid, guarding incoming fire, and
  working the three campaign objectives (threats, port sweep, party exit). `.tmp/campaign-auto.js` clicks the
  console the way a player would: NEXT ARENA between levels, RETRY after a loss, the next slot after a clear.
- Known limitation: the pilot survives and fights, but it does not reliably finish the `BUILD ROOT` port sweep,
  so no headed campaign reached `REBOOT` on its own. Beatability is still covered headlessly.

**Verification:** `campaign-death-check` OK; `campaign2-check` 3/3 clears (80.2 s and 72 s on the logged runs);
`npx tsc --noEmit`, `npm run build`, `npm run bench` clean.

**Next:** a human solo pass on `BUILD ROOT` to judge the three-port sweep, then a full four-run headed pass with
a stronger pilot or a person at the keyboard.

## 2026-11-03 — BUILD ROOT port sweep was impossible: two ports sat inside cover (v0.1.154)

**Goal:** clear the campaign's mid-point, which nothing had ever beaten, and then play four runs through `REBOOT`.

- Evidence first: `.tmp/port-sweep-check.ts` drives the ports with ordinary ranged input and failed at step one,
  "no clear firing line to port 0 at 1240,780". A geometry dump (`.tmp/port-diag.ts`) showed why: two of the three
  `ingress` entries sat **inside `pillars` rects** (`insideSolid=1`, nearest solid 0u), so every ranged line to their
  squares crossed cover. The remaining port had three clear sides. That is why every sweep stalled no matter who
  drove it: the objective was unshootable, not hard.
- Fixed in the arena data, keeping the authored intent (two ports on the mainboard, one on the router, both mainboard
  ports still on bridge 2): mainboard A `1240,780 -> 1330,900`, router `1250,160 -> 1350,230`, mainboard B unchanged
  at `1780,940`. A placement probe verified each new square is off cover and has 170-unit clear lines on at least
  three sides.
- Guard in `World.spawnCampaignPorts`: a port authored inside cover is nudged to the nearest clear square (24 rays,
  8 rings) instead of shipping as a dead end, so bad authoring can no longer make a level unwinnable silently.
- Open item, stated plainly: the full three-port clear has not yet been observed in play. A headed probe of the
  staged fight had bolts anchoring ~170 units short of the port with movement frozen at that standoff, while the
  same harness moves and fires normally elsewhere, so the remaining blocker is in the harness staging and not yet
  separated from the game. The arena geometry bug is fixed and provable; the end-to-end sweep needs one clean
  headed run.

**Verification:** `port-sweep-check` geometry stage passes (placement, per-port clear lines), `campaign-death-check`
OK, `campaign2-check` 3/3 boss clears, `tsc --noEmit`/`build` clean.

**Next:** one headed BUILD ROOT clear, then the four `REBOOT` runs.

### Follow-up: the sweep is clearable (same day)

`.tmp/port-sweep-check.ts` now drives the ports the way a player does: pick a clear lane, stand still,
hold ranged fire, re-aim while the port's own squad shoves the body, step back onto the lane when
displaced. Result: **all three ports closed in 17.4 s of firing** (20 / 20 / 26 hp), `campaignExitReady`
true, standing in the exit gave `phase cleared`. The older probe failed because it pinned the body to one
spot every frame without re-aiming, which folded the shot and measured nothing.

Headed confirmation in Chromium (`?debug=1`, three bots, `npm run dev`): BUILD ROOT advanced through
calibration -> drill -> breach -> assault on its own and the pilot closed **2 of 3 ports by real play**
before the session budget ran out. Port damage in the shipped build is therefore confirmed, and the third
port is a pilot-routing gap rather than a game bug.

**Still open:** four complete headed start-to-finish runs (level 1 through level 2 and the Mega Worm) were
not completed. The Mega Worm's own clear path is covered by `campaign2-check` (three consecutive boss-node
clears) but not by a headed run.

## 2026-11-03 — Holding plate entry moved to the open left side of the cell block (v0.1.155)

**Goal (user report):** in QUARANTINE the bridge into the holding cells arrived behind the cells, so the closed
block sat between the player and the room. Overall arena flow should read left to right.

- Root cause: `holdingCellLayout` spanned nearly the whole holding plate (x 66..840) and `campaignCellBarRects`
  makes that whole block one body solid while the bars are powered. Bridge A landed on the plate's top edge at
  x 330..480, i.e. inside the block's footprint, leaving a 16-unit strip between the room wall and the bars: a
  body arrived behind the sealed cells with no way out until the block powered down.
- Fix: the block is back-right (`left = room.x + w - 0.52w - 12`, three 136-unit cells) and the intake deck moved
  to the open left (`140..290`), so entry is beside the cells. The holding-to-mainboard deck moved to `y 862..1000`,
  past the block's front wall (`bottom` 840), so the exit is read from the front of the cells, the way a jail does.
  Kitty and her label follow the block instead of the plate centre (`cellMidX`), so the middle cell still holds her.
- Flow rule recorded in AGENTS: a plate is entered on its left and left on its right where the layout allows;
  vertical links are the exception. This plate now reads left to right: in at the left, past the cells, out right.

**Verification:** `holding-layout-check` OK (cells 425..834 / 680..840, landing 215,688, doorway 862..1000),
`port-sweep-check` OK (three ports in 17.4 s, exit opens, phase cleared), `campaign2-check` OK (REBOOT boss clears),
`campaign-death-check` OK, `tsc --noEmit`, `build`, `bench` clean.

## 2026-11-03 — Left-to-right plate rule extended to every authored plate (v0.1.156)

**Goal:** a plate arena must be entered on its open left side and left on its right, with any other flow being a
documented choice, and both painted geometry and collision/ports driven from the same layout functions.

- `.tmp/plate-flow-check.ts` (new) reads `islands`, `rooms`, `bridges`, `pillars`, `traverse.chasms`, `spawns`,
  `port` and `holdingCellLayout` — the same data the renderer and body solver use — and asserts per arena: every deck
  lands on two different plates, no landing sits in cover or in a powered cell block, no deck is swallowed by cover,
  a deck route exists from the entry plate (spawn 0) to the exit plate (`port`), and the exit plate centre is right
  of the entry plate centre.
- Result: **QUARANTINE** entry 453 -> exit 1513 over three decks, OK. Two routes are deliberately not left-to-right
  and are named with reasons in the check: **CAPCOM** (four-plate ring, every deck open by design, no single exit)
  and **TRANSIT** (chasm arena crossed by pads west and lifts east). Nothing else in `ARENAS` is a plate arena, so
  the rule has no silent gaps.
- Deck landings now use a two-unit abutment tolerance: decks meet a plate edge rather than overlapping it, and the
  earlier strict-overlap test reported every deck as touching no plate, which would have hidden a short deck.

**Attempted and not finished:** a single sequential harness (`.tmp/campaign-run-check.ts`, since removed) that would
play BUILD ROOT and then REBOOT in one session. It drove the assault, port lanes and boss correctly, but could not
kill the pre-assault calibration subjects (trace: tutorial done, calibration awake, bodies alive, kills 0 for 240 s),
so it never left the first beat. That is a probe-aim limitation, not a game failure: the same beats are covered by
`campaign-death-check` (five pre-assault phases), `port-sweep-check` (level 1 sweep -> exit -> cleared) and
`campaign2-check` (three bots, three runs, Mega Worm defeated each time).

**Verification:** `plate-flow-check` OK (3 plate arenas), `holding-layout-check` OK, `port-validate` OK,
`port-sweep-check` OK (17.4 s), `campaign2-check` OK, `campaign-death-check` OK, `tsc --noEmit`, `build`, `bench` clean.

## 2026-11-03 — Continuous campaign probe: beats cleared by real kills, sweep still short (v0.1.157)

**Goal:** one unattended run from the start of BUILD ROOT through REBOOT and the Mega Worm, no shortcuts.

`.tmp/campaign-playthrough-check.ts` plays both nodes with three bots and no injected state: no kill quota is
written, no port or boss health is touched. The only affordance a player also has is the on-screen SKIP TUTORIAL.

What it proved, on real input:
- BUILD ROOT now advances **calibration -> release -> drill -> breach -> assault** on kills the pilot earned,
  including the six calibration silhouettes that the previous probe never killed. That was a probe bug: when a
  hostile was close it set "stand and fire" but left the target null, so the movement branch zeroed the input and it
  stood still facing nothing.
- The local body is mortal, and two real void falls showed up and were fixed in the probe's own movement, not in the
  game: the dodge override had no floor check, and a dash carried the body past a plate lip. Movement now requires
  26/52 units of floor ahead, dashes need a 170-unit clear lane, and routes keep a body-radius off every edge.
- With those, the run survives the whole window instead of dying in the void.

What it has not reached: the sweep. In the assault the run finishes with 23 kills against a quota of 10 and **0/3
ports** at the 420-second cap, so it never gets a shot away at a lane. The remaining gap is the probe's assault
routing (it presses the sweep but the objective never wins the priority cleanly against nearby hostiles), not a game
rule: `port-sweep-check` closes all three ports in 17.4 s of ordinary fire and `campaign2-check` still defeats the
Mega Worm on all three of its runs. The probe is kept as the starting point for that routing fix.

## 2026-11-03 — Continuous campaign probe: diagnosis narrowed, sweep still not shot (v0.1.158)

Iterated the continuous probe further. Three findings, all recorded by the probe itself:

1. **The sweep objective does get chosen.** With instrumentation (`goal` kind logged every 20 s) the assault shows
   `goal: sweep`, `openPortals: 3`, and the nearest port 720-800 units away while the body stays on the intake plate
   around x 545-630, y 215-295 and the decks read `110` (intake->holding and holding->mainboard both open). The pilot
   is not being out-prioritised by hostiles any more; it is failing to travel the route.
2. **The floor model had a crossing bug and it is fixed.** Containing a point with a 22-unit inset kept the body off
   plate lips, but plates and decks only *abut*, so the inset opened a 44-unit non-walkable gap at every junction and
   no path could ever cross. Containment is now 6 units with the step-clearance guard supplying the margin.
3. **Aiming at the port was wrong and is fixed.** The lane behaviour strafed across the port, and because facing comes
   from movement that pointed the body *across* the target, so no bolt could land. The lane now stands still with the
   approach's facing held on the port.

After those two fixes the sweep still reads **0/3 ports at the 420 s cap**, with 29 kills against a quota of 10 and 13
deaths (12 to sentries during calibration, 2 void falls at the arena's left bound from knockback). So the continuous
run does **not** reach REBOOT or the Mega Worm, and the three-consecutive-clear criterion is **not** met. The probe is
kept with its instrumentation so the next pass can log the body's route directly instead of inferring it.

Nothing here changes a game rule: `port-sweep-check` still closes all three ports in 17.4 s of ordinary fire and
`campaign2-check` still defeats the Mega Worm on three 3-bot runs.

## 2026-11-03 — Continuous probe: navigation rewritten, run now dies in the assault (v0.1.159)

Replaced the probe's steering with a model that cannot silently stall: eight compass steps, each accepted only if
both the floor model and a 26/52-unit look-ahead allow it, walking the BFS route one waypoint at a time. Every
refused step is counted and printed with the current goal, aim point, route length and deck state.

Effect, from the run log: BUILD ROOT now reaches `assault` at **83 s** (drill 61 s, breach 79 s) instead of never,
which confirms the previous stall was the steering, not the objective. The run then ends at **95 s** with
`phase: failed` — the local body is killed in the assault twelve seconds in, at 1 kill toward the ten-kill quota.

So the continuous clear is **still not achieved** and the three-run criterion is **not met**. The stall point is now
survival in the assault, not travel: the body reaches the fight, fights, and dies. Deaths are the game's own
one-life rule (`world.ts` sets `campaignPhase = 'failed'` when slot 0 dies during the assault), so the probe needs
real defensive play — retreat to cover, spend the guard, hold the dash for the shot that will land — before the
closing criterion can be met. Nothing here points at a game defect: the ports still close in 17.4 s under
`port-sweep-check` and the Mega Worm still dies in all three `campaign2-check` runs.

## 2026-11-03 — Continuous probe clears BUILD ROOT; REBOOT still kills the pilot (v0.1.160)

Three harness defects were found by instrumenting the pilot itself, and all three were probe faults, not game faults:

1. **Floor model disagreed with the game.** The probe inset every plate by 6 units, so each plate/deck junction read
   as a hole. It refused steps (1431 refused at the peak) and treated floor the game considers solid as void. It now
   uses `World.inVoid`'s inclusive test, so the model and the body agree.
2. **The dash was aimed with a different vector from the one it travelled along.** A dash follows the movement
   vector, so a gate that checked the "flee" direction while the body still moved elsewhere drove it off the lip at
   x≈346/y≈585 and at 1648,483 (killer 8, void). The flee step is now the movement vector and the gate looks 260
   units ahead, which is the dash's real reach.
3. **No melee answer.** The guard covers shots but not a bite, so a body inside reach now shoves with the lash and
   dashes out of the arc.

Result with 3 bots, mortal, unattended: **BUILD ROOT clears continuously** — 163.9 s, 21 kills, 3/3 ports closed,
all five deaths inside calibration/drill/breach, where the campaign deliberately respawns. An earlier run cleared the
same level in 286 s with 44 kills. The run then enters REBOOT, reaches `assault`, and **dies at 94 s** to a worm bite
(`killer 2`) at 1 segment of health with 3 of 4 kills.

So the closing criterion — three consecutive continuous clears through the Mega Worm — is **not met**. The run now
fails one level later than the last session and no longer fails for a navigation reason: the pilot arrives, fights,
and runs out of health. `campaign2-check` still defeats the Mega Worm in all three of its 3-bot runs, so the boss is
defeatable; what is unproven is a single life carrying through both levels.

## 2026-11-03 — Diagnosed the level-2 death by instrumenting it (v0.1.161)

The continuous run kept dying in REBOOT's assault, so the probe now records what actually happens: every health
segment lost (time, phase, health before/after, dash charges, whether the guard was held, distance to the nearest
hostile), every heal, and the live threat table at failure. Two harness faults came out of that immediately.

1. **The "three bots" had no brains.** Only slot 0 was driven; bots 1–3 sent empty input frames for the whole run, so
   the level-2 boss was being soloed in what was reported as a four-player match. Every slot now runs `BotBrain` at
   `digital`, the same brain a VS BOTS match uses.
2. **The pilot never picked up a heal.** `updatePickups` runs in campaign, and `RESTORE_STATUS` refills the pool, so a
   pilot that ignores pickups is not playing the game. BUILD ROOT now shows heals at 11 s, 51 s and 201 s.

The measured facts about REBOOT:

- The player **enters the assault at full health (3/3)**; nothing is carried in from the briefing or the breach, so
  there is no chip-damage-before-the-fight pacing bug to fix.
- The four fodder kills complete, and the Mega Worm **does spawn** — it was live at 200 hp.
- The death is three segments in six seconds (hits at 42 s, 43 s and 48 s), and the fatal hit lands **within three
  seconds of the boss arriving**, at a distance of 1177,607 from the arena centre-lane.

Result in this configuration: **BUILD ROOT clears continuously, unattended, with every slot on the shipped AI** —
205.8 s, 44 kills, 3/3 ports, 4 heal pickups taken. **REBOOT still fails**, in 4 of 4 attempts, always within seconds
of the Mega Worm spawning, always at 4/4 fodder kills. `campaign2-check` continues to kill the Mega Worm in all three
of its 3-bot runs, so the boss is defeatable with a healthy body; what is not yet proven is that a body which arrives
at the boss with three segments survives its arrival.

## 2026-11-03 — The two harnesses were not comparable; REBOOT remains unproven (v0.1.162)

Diffed `campaign2-check` against the continuous probe line by line. The result changes how much its green tick is
worth:

- `campaign2-check` sets **`p.iframes = 999` on every tick** and writes the phase and the kill quota directly
  (`campaignPhase = 'assault'`, `beginAssault()`, `gauntletKills = clearKills`). Its pilot is a hand-written
  aim-and-hold controller, and its bot slots 1–3 send empty frames. It therefore proves the Mega Worm can be damaged
  and killed and that the level clears when it dies; it has **never** tested whether a real body survives the fight.
  That is why "the same brain beats the worm there but dies here" was never a contradiction.
- The continuous probe enters the assault at **full 3/3 health** with no carried damage, reaches **4/4 fodder kills**,
  and the Mega Worm **does spawn** (logged at 12 s, offscreen entrance, 1603 units out, 200 hp once assembled). So
  there is no missing-recovery or chip-damage pacing fault before the fight.
- The death is the pilot's: three segments lost on three consecutive seconds (42 s, 43 s, 44 s) while every other
  body had already been cleared. `MEGA_WORM.touchCooldown` is 1.2 s and the flyby body travels at 940 u/s, so a body
  standing in its lane is hit once per cooldown. A dodge-the-lane response was added to the pilot (leave the lane,
  dash under 240 units) and it did not change the outcome in the run measured, so the evasion is still not landing
  at the right moment.

Measured status, this configuration:

- **BUILD ROOT: 3/3 continuous clears observed** (163.9 s / 286 s / 205.8 s, 21–44 kills, 3/3 ports, heals taken).
- **REBOOT: 0/6 continuous clears.** Every failure is between 43 s and 94 s, all at 4/4 fodder kills, all to a worm
  (`killer 2`), none from void, none from a phase or navigation stall. The Mega Worm never took damage in a
  continuous run, because the pilot dies before it engages.

So the mission's closing criterion — a continuous level-1 run that kills the Mega Worm in 4 of 5 attempts — is
**not met**, and I am not going to dress the boss-mechanics check up as survival proof. The next measurement that
matters is the fatal hit's actual attacker: `killerKind 2` with the only live worm 1237 units away means the damage
source is not yet identified, and that log needs projectile-level attribution before anyone changes the boss.

### Addendum — lane-based evasion (v0.1.163)

The proximity dodge was the wrong trigger for a 940 u/s body: 430 units is about 0.45 s of warning. The pilot now
reads the flight *line* — perpendicular offset from the boss's heading, with a dash under 170 — and that is
measurably better without changing the game: the death moves from **43 s to 68 s** and the fodder count from 4 to 5,
still `killer 2`, still with the Mega Worm alive. Surviving to actually engage the boss is still unsolved, so the
continuous REBOOT pass rate is **0/7** and the mission's 4-of-5 criterion remains **not met**. BUILD ROOT stays 3/3
continuous clears. Do not tune the boss down on this evidence: the run has never reached the boss with a body left.

## 2026-11-03 — Mega Worm: fixed pass cycle, warning beat, death-rage speed (v0.1.164)

The flyby is now a fixed pattern instead of a wide outside turn. After each straight pass the body runs clear of
the floor, parks offscreen on the next line, assembles there, then makes one straight run through the last position
it detected; approaches fan by golden angle so the lane changes but the rule does not. Passing speed now scales with
missing health (`flyby.rageSpeed`, +75% at empty), so the last third arrives much faster without any new attack.

Because the arrival is now a scheduled event, it is announced instead of sprung. When the run-up kills are met,
Script Kitty says "WATCH OUT — SOMETHING BIG IS COMING THROUGH", the new `SOMETHING BIG / MEGA WORM // INBOUND`
title card plays, and the body waits out `CAMPAIGN.bossWarnTime` (5 s) before spawning. Combined with the existing
6.8 s entrance arc, a player has roughly twelve seconds of notice to clear the lane. The warning is presentation
only: it never touches the quota, the arena, the clear rule, or `Snapshot`, and the line is local DOM like every
other story box.

Verified: `.tmp/boss-warning-check.ts` asserts Kitty's line, card kind 7, a 5 s window, the line clearing only when
the body arrives, and the boss live after it (`warned t=1.00, spawned t=6.01, card 7`). `campaign2-check` still kills
the Mega Worm with three bots (66.3 s). `tsc --noEmit` and `npm run build` pass.

Still open, unchanged: a continuous level-1 run still does not reach a Mega Worm kill. The pilot (shipped BotBrain)
dies to the flyby's contact damage before it engages, at 5 fodder kills. The warning window gives a human the
preparation the boss needed; it does not make the automated pilot dodge, so the 4-of-5 continuous criterion is still
not met and must not be claimed.

## 2026-11-03 — Bot boss handling: lane read, boss standoff, no giant melee (v0.1.165)

The continuous REBOOT failures were traced to the shipped `BotBrain`, not to the boss, and three genuine AI bugs
came out of it:

1. **The brain could not read a mini-boss pass at all.** Its threat model was projectiles only, so the Mega Worm was
   just "the nearest worm": the pilot walked to a 150-unit standoff from a body whose head radius is 138. It now reads
   the pass line from the visible heading and position and abandons the corridor the body sweeps.
2. **The lane gate was a third of a second wide.** The first version only reacted when the player was within 300
   units *ahead* of the body; at 940 u/s that is 0.3 s, so contact always landed first. Damage attribution showed
   every boss hit at 147–159 units from the head with both dash charges unused. The gate now reads the whole approach
   (1400 ahead) and dashes under 760 with the corridor 460 wide.
3. **The pilot hugged boss-sized bodies.** The standoff is now 330 for `bossKind >= 0` (was 150 for everything), and it
   no longer swings the lash or roots a heavy inside a body bigger than the swing.

Measured effect of those fixes in the continuous run, all other things equal: death time moved from 43–108 s to
140–285 s, and for the first time the pilot damages the boss (down to 120–150 hp from 206) instead of dying on arrival.

**The criterion is still not met: 0 of 5 continuous multi-bot runs defeat the Mega Worm.** Remaining deaths are
mixed — `killer 2` (worm contact, including the boss's chain) and `killer 4` (sentry fire) — in the crowded assault
that keeps spawning fodder while the boss cycles. Nothing in the logs shows unavoidable damage: every hit is contact
at the visible body radius, and every run has dash charges or a heal on the floor that the pilot did not use, which is
pilot behaviour rather than level unfairness. Do not reduce the boss's damage, speed ramp or pass pattern to close
this; the next step is the pilot spending dashes and heals under pressure.
