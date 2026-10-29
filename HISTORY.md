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
